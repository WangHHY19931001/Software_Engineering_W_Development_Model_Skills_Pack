#!/usr/bin/env node
/**
 * 预防性审查校验脚本（Preventive Review Checker）
 *
 * 对应 R3 预防性审查门禁：按 variant 读取各维度审查报告（标准 / fix / emergency / ingest），
 * 校验维度齐全与通过状态，并支持 --auto-trigger 从 run-log 推断当前阶段。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/check-preventive-review.ts <project-dir> [--phase=N] [--variant=standard|fix|emergency|ingest] [--json]
 *   npx tsx w-model-dev/scripts/cli/check-preventive-review.ts <project-dir> --auto-trigger --run-log=<run-log.jsonl> [--json]
 *
 * 参数：
 *   project-dir              项目根目录（默认：当前工作目录）
 *   --phase=N                当前阶段 1-8（与 --auto-trigger 二选一必填；--auto-trigger 从 --run-log 推断阶段）
 *   --variant=<v>            报告文件名变体：standard | fix | emergency | ingest（默认 standard；
 *                            ingest 为 S-ingest-tla / S-ingest-bdd 后 R3，须显式传参，auto-trigger 不推断）
 *   --auto-trigger           从 --run-log 读取当前阶段并推断 variant
 *   --run-log=<path>         run-log.jsonl 路径（--auto-trigger 模式必填）
 *   --json                   机器可读输出模式：stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）
 *
 * 退出码：
 *   0  校验通过（各维度审查报告齐全且格式合规——存在性 + schema + phase/dimension 一致；报告内 passed 状态由 V 评审纳入 reworkHints）
 *   1  校验失败（reasons 列出具体原因，S 子代理须按原因返工后重跑）
 *   2  输入错误（参数非法 / 文件不存在 / JSON 解析失败，stderr 打印人类可读错误，stdout 输出 ERROR_JSON）
 *
 * 输出：
 *   stdout 打印单行 PREVENTIVE_REVIEW_JSON 摘要（便于 Agent 正则截取；非 --json 模式无人类可读正文）
 *   exit 2 场景 stdout 输出 `ERROR_JSON {...}`（category/message/exitCode=2；file/rule/field 仅在有值时输出进 ERROR_JSON；detail 仅出现在 stderr 人类可读消息 `✗ [CATEGORY] msg: <file|detail>`，不进入 ERROR_JSON）
 *
 * 错误字段（ERROR_JSON）：
 *   file=相关文件路径；rule=违规规则链（如 'P0-1'）；field=具体字段位置；detail=补充详情（如收到的参数值）
 *
 * 命令行参数：支持 --json（机器可读输出）、--phase=N、--variant=、--auto-trigger、--run-log=
 * 退出码：0=通过 / 1=校验失败（reasons）/ 2=输入错误（ERROR_JSON）
 *
 * @module
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import {
  checkPreventiveReview,
  type PreventiveReview,
  type PreventiveReviewOptions,
} from '../logic/preventive-review-logic.js';
import { exitWithError } from '../lib/cli-error.js';
import { writeGateLog } from '../lib/gate-log-writer.js';
import { runMain } from '../lib/run-main.js';
import { hasFlag, parseFlagValue } from '../lib/parse-args.js';
import { parseJsonSafe } from '../lib/safe-json.js';
import { parsePhaseArg } from '../lib/parse-phase.js';
import { readJsonlOrExit } from '../lib/read-json-or-exit.js';
import { printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';

const PREVENTIVE_REVIEW_JSON = {
  script: 'check-preventive-review.ts',
  exitCode: 0,
  passed: false,
  reasons: [] as string[],
  reviews: [] as { dimension: string; passed: boolean; findingCount: number }[],
};

/**
 * 根据 variant 构造 R3 报告文件名前缀。
 *   - standard → `<phase>-{dim}.json`
 *   - fix      → `<phase>-fix-{dim}.json`        （S-fix 返工后 R3）
 *   - emergency→ `<phase>-emergency-{dim}.json`  （S-emergency-fix 后 R3）
 *   - ingest   → `<phase>-ingest-{dim}.json`     （S-ingest-tla / S-ingest-bdd 后 R3）
 */
function reportFilePrefix(phase: number, variant: NonNullable<PreventiveReviewOptions['variant']>): string {
  switch (variant) {
    case 'fix':
      return `${phase}-fix-`;
    case 'emergency':
      return `${phase}-emergency-`;
    case 'ingest':
      return `${phase}-ingest-`;
    case 'standard':
    default:
      return `${phase}-`;
  }
}

async function main(): Promise<void> {
  // --json：机器可读报告模式（不打印人类可读 JSON 摘要与 gate-logs 写入）
  const jsonMode = hasFlag(process.argv.slice(2), 'json');
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const projectDir = args.find((a) => !a.startsWith('--')) ?? '.';
  const phaseArg = parseFlagValue(args, 'phase');
  const variantArg = parseFlagValue(args, 'variant');
  const autoTrigger = hasFlag(args, 'auto-trigger');
  const runLogFile = parseFlagValue(args, 'run-log');

  // 统一 --phase 校验（lib/parse-phase.ts，1-8）；非法/缺失由下方 !phase 检查统一拦截
  let phase: number | undefined = phaseArg ? parsePhaseArg(process.argv, { min: 1, max: 8 })?.phase : undefined;
  let variant: PreventiveReviewOptions['variant'] = 'standard';

  // 显式 --variant= 参数解析
  if (variantArg) {
    const v = variantArg as PreventiveReviewOptions['variant'];
    if (v === 'standard' || v === 'fix' || v === 'emergency' || v === 'ingest') {
      variant = v;
    } else {
      exitWithError({
        category: 'ARG_INVALID',
        rule: 'P0-1',
        message: `参数非法 --variant=${v}`,
        detail: '须为 standard | fix | emergency | ingest',
        exitCode: 2,
      });
      return;
    }
  }

  // --auto-trigger 模式：从 run-log 读取当前阶段 + 推断 variant
  if (autoTrigger) {
    if (!runLogFile) {
      exitWithError({
        category: 'ARG_INVALID',
        rule: 'P0-1',
        message: '参数缺失 --run-log=<run-log.jsonl>',
        detail: '用法: check-preventive-review.ts <project-dir> --auto-trigger --run-log=<run-log.jsonl>',
        exitCode: 2,
      });
      return;
    }
    const runLogPath = runLogFile;
    const abs = path.resolve(runLogPath);
    try {
      // 先 access 探测：FILE_NOT_FOUND 走 ERROR_JSON 输出（readJsonlOrExit 对 ENOENT 同样输出 ERROR_JSON 并 exit 2，此处预探测保证本分支 `return` 后由 Node 自然退出、stdout 完整 flush）
      await fs.access(abs);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ENOENT') {
        exitWithError({
          category: 'FILE_NOT_FOUND',
          rule: 'P0-2',
          message: '文件不存在',
          file: abs,
          exitCode: 2,
        });
        return;
      }
      throw err;
    }
    // 读取 + 逐行解析（坏行 warn+skip；ENOENT 已在 access 探测处拦截）
    const entries = await readJsonlOrExit(abs, 'run-log');
    if (entries.length === 0) {
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
    // 扫描 run-log 推断 S 变体（最近一条 fix/emergency-fix 决定 variant）
    let inferredVariant: PreventiveReviewOptions['variant'] = 'standard';
    let lastSAction: string | null = null;
    for (const entryRaw of entries) {
      const entry = entryRaw as { phase?: number; action?: string; outcome?: string; role?: string } | null;
      // null / 非对象行静默跳过（readJsonlOrExit 复用后恢复原逐行守卫语义）
      if (typeof entry !== 'object' || entry === null) continue;
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
        rule: 'P0-1',
        message: '无法从 run-log 推断当前阶段',
        detail: `最后 checkpoint phase=${lastPhase}（须为 1-8）`,
        exitCode: 2,
      });
      return;
    }
    phase = lastPhase;
    console.error(`[auto-trigger] 从 run-log 推断: phase=${phase}, variant=${variant}`);
  }

  if (!phase || phase < 1 || phase > 8) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '参数缺失或非法 --phase=<1-8>',
      detail:
        '用法: check-preventive-review.ts <project-dir> --phase=<1-8> [--variant=standard|fix|emergency|ingest] | --auto-trigger --run-log=<run-log.jsonl>',
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

  // --json：输出机器可读报告（无分隔线），exitCode 由调用方设置
  if (jsonMode) {
    printJsonReport(
      {
        type: 'preventive-review',
        passed: output.passed,
        reasons: output.reasons,
        violations: buildViolationDistribution(output.reasons.length),
        durationMs: Date.now() - startTime,
      },
      output.exitCode,
    );
    process.exitCode = output.exitCode;
    return;
  }

  console.log(
    'PREVENTIVE_REVIEW_JSON ' +
      JSON.stringify({
        type: 'preventive-review',
        passed: output.passed,
        exitCode: output.exitCode,
        variant: output.variant,
        reasons: output.reasons,
      }),
  );

  // 写入 gate-logs（失败不阻塞）
  await writeGateLog('preventive-review', output, projectDir);

  process.exit(output.exitCode);
}

runMain(main);
