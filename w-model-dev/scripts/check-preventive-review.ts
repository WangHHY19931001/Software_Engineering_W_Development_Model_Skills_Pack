#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { checkPreventiveReview, type PreventiveReview, type PreventiveReviewOptions } from './preventive-review-logic.js';
import { exitWithError } from './lib/cli-error.js';
import { parseJsonSafe } from './lib/safe-json.js';
import { parsePhaseArg } from './lib/parse-phase.js';

const PREVENTIVE_REVIEW_JSON = {
  script: 'check-preventive-review.ts',
  exitCode: 0,
  passed: false,
  reasons: [] as string[],
  reviews: [] as { dimension: string; passed: boolean; findingCount: number }[],
};

/**
 * 第29轮：根据 variant 构造 R3 报告文件名前缀。
 *   - standard → `<phase>-{dim}.json`
 *   - fix      → `<phase>-fix-{dim}.json`        （S-fix 返工后 R3）
 *   - emergency→ `<phase>-emergency-{dim}.json`  （S-emergency-fix 后 R3）
 */
function reportFilePrefix(phase: number, variant: NonNullable<PreventiveReviewOptions['variant']>): string {
  switch (variant) {
    case 'fix':
      return `${phase}-fix-`;
    case 'emergency':
      return `${phase}-emergency-`;
    case 'standard':
    default:
      return `${phase}-`;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const projectDir = args.find(a => !a.startsWith('--')) ?? '.';
  const phaseArg = args.find(a => a.startsWith('--phase='));
  const variantArg = args.find(a => a.startsWith('--variant='));
  const autoTrigger = args.includes('--auto-trigger');
  const runLogArg = args.find(a => a.startsWith('--run-log='));

  // 统一 --phase 校验（lib/parse-phase.ts，1-8）；非法/缺失由下方 !phase 检查统一拦截
  let phase: number | undefined = phaseArg ? parsePhaseArg(process.argv, { min: 1, max: 8 })?.phase : undefined;
  let variant: PreventiveReviewOptions['variant'] = 'standard';

  // 显式 --variant= 参数解析
  if (variantArg) {
    const v = variantArg.split('=')[1] as PreventiveReviewOptions['variant'];
    if (v === 'standard' || v === 'fix' || v === 'emergency') {
      variant = v;
    } else {
      exitWithError({
        category: 'ARG_INVALID',
        message: `参数非法 --variant=${v}`,
        detail: '须为 standard | fix | emergency',
        exitCode: 2,
      });
      return;
    }
  }

  // --auto-trigger 模式：从 run-log 读取当前阶段 + 推断 variant
  if (autoTrigger) {
    if (!runLogArg) {
      exitWithError({
        category: 'ARG_INVALID',
        message: '参数缺失 --run-log=<run-log.jsonl>',
        detail: '用法: check-preventive-review.ts <project-dir> --auto-trigger --run-log=<run-log.jsonl>',
        exitCode: 2,
      });
      return;
    }
    const runLogPath = runLogArg.split('=')[1]!;
    const abs = path.resolve(runLogPath);
    try {
      const raw = await fs.readFile(abs, 'utf-8');
      const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) {
        exitWithError({
          category: 'FILE_PARSE',
          message: 'run-log 为空（--auto-trigger 无法推断阶段）',
          file: abs,
          exitCode: 2,
        });
        return;
      }
      // 取最后一条 checkpoint success 记录的 phase 作为当前阶段
      let lastPhase = 0;
      // 第29轮：扫描 run-log 推断 S 变体（最近一条 fix/emergency-fix 决定 variant）
      let inferredVariant: PreventiveReviewOptions['variant'] = 'standard';
      let lastSAction: string | null = null;
      for (const line of lines) {
        try {
          const entry = parseJsonSafe(line) as { phase?: number; action?: string; outcome?: string; role?: string };
          if (typeof entry.phase === 'number' && entry.action === 'checkpoint' && entry.outcome === 'success') {
            lastPhase = entry.phase;
          }
          // 跟踪最后一条 S 角色 action（用于推断 variant）
          if (entry.role === 'S' && typeof entry.action === 'string') {
            if (entry.action === 'fix') {
              lastSAction = 'fix';
            } else if (entry.action === 'emergency-fix') {
              lastSAction = 'emergency-fix';
            } else if (entry.action === 'produce') {
              lastSAction = 'produce';
            }
          }
        } catch {
          // 跳过非法行
        }
      }
      // 推断 variant：若未显式传 --variant，则按最后一条 S action 推断
      if (!variantArg) {
        if (lastSAction === 'fix') inferredVariant = 'fix';
        else if (lastSAction === 'emergency-fix') inferredVariant = 'emergency';
        else inferredVariant = 'standard';
        variant = inferredVariant;
      }
      if (lastPhase < 1 || lastPhase > 8) {
        exitWithError({
          category: 'ARG_INVALID',
          message: '无法从 run-log 推断当前阶段',
          detail: `最后 checkpoint phase=${lastPhase}（须为 1-8）`,
          exitCode: 2,
        });
        return;
      }
      phase = lastPhase;
      console.error(`[auto-trigger] 从 run-log 推断: phase=${phase}, variant=${variant}`);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ENOENT') {
        exitWithError({
          category: 'FILE_NOT_FOUND',
          message: '文件不存在',
          file: abs,
          exitCode: 2,
        });
        return;
      }
      throw err;
    }
  }

  if (!phase || phase < 1 || phase > 8) {
    exitWithError({
      category: 'ARG_INVALID',
      message: '参数缺失或非法 --phase=<1-8>',
      detail: '用法: check-preventive-review.ts <project-dir> --phase=<1-8> [--variant=standard|fix|emergency] | --auto-trigger --run-log=<run-log.jsonl>',
      exitCode: 2,
    });
    return;
  }

  const reviewsDir = path.resolve(projectDir, '.w-model', 'preventive-reviews');
  const dimensions = ['completeness', 'reliability', 'security'] as const;
  const reviews: Record<string, PreventiveReview | null> = {};
  const prefix = reportFilePrefix(phase, variant ?? 'standard');

  for (const dim of dimensions) {
    const filePath = path.resolve(reviewsDir, `${prefix}${dim}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      reviews[dim] = parseJsonSafe(content) as PreventiveReview;
    } catch {
      reviews[dim] = null;
    }
  }

  const result = checkPreventiveReview(reviews, phase, { variant });
  const output = {
    ...PREVENTIVE_REVIEW_JSON,
    exitCode: result.passed ? 0 : 1,
    passed: result.passed,
    reasons: result.reasons,
    reviews: result.reviews,
    autoTrigger,
    phase,
    variant,
  };

  console.log('PREVENTIVE_REVIEW_JSON ' + JSON.stringify({ type: 'preventive-review', passed: output.passed, exitCode: output.exitCode, variant: output.variant, reasons: output.reasons }));

  // 写入 gate-logs
  const gateLogsDir = path.resolve(projectDir, '.w-model', 'gate-logs');
  try {
    await fs.mkdir(gateLogsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.writeFile(
      path.resolve(gateLogsDir, `${timestamp}-preventive-review.json`),
      JSON.stringify(output, null, 2),
    );
  } catch {
    // gate-logs 写入失败不阻塞
  }

  process.exit(output.exitCode);
}

main().catch(err => {
  exitWithError({
    category: 'UNEXPECTED',
    message: '脚本异常',
    detail: err instanceof Error ? err.message : String(err),
    exitCode: 2,
  });
});
