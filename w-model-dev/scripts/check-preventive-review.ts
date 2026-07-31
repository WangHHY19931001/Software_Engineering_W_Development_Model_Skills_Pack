#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { checkPreventiveReview, type PreventiveReview } from './preventive-review-logic.js';

const PREVENTIVE_REVIEW_JSON = {
  script: 'check-preventive-review.ts',
  exitCode: 0,
  passed: false,
  reasons: [] as string[],
  reviews: [] as { dimension: string; passed: boolean; findingCount: number }[],
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const projectDir = args.find(a => !a.startsWith('--')) ?? '.';
  const phaseArg = args.find(a => a.startsWith('--phase='));
  const autoTrigger = args.includes('--auto-trigger');
  const runLogArg = args.find(a => a.startsWith('--run-log='));

  let phase: number | undefined = phaseArg ? parseInt(phaseArg.split('=')[1]!, 10) : undefined;

  // --auto-trigger 模式：从 run-log 读取当前阶段
  if (autoTrigger) {
    if (!runLogArg) {
      console.error('用法: check-preventive-review.ts <project-dir> --auto-trigger --run-log=<run-log.jsonl>');
      process.exit(2);
    }
    const runLogPath = runLogArg.split('=')[1]!;
    const abs = path.resolve(runLogPath);
    try {
      const raw = await fs.readFile(abs, 'utf-8');
      const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) {
        console.error('✗ run-log 为空');
        process.exit(2);
      }
      // 取最后一条 checkpoint success 记录的 phase 作为当前阶段
      let lastPhase = 0;
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as { phase?: number; action?: string; outcome?: string };
          if (typeof entry.phase === 'number' && entry.action === 'checkpoint' && entry.outcome === 'success') {
            lastPhase = entry.phase;
          }
        } catch {
          // 跳过非法行
        }
      }
      if (lastPhase < 1 || lastPhase > 8) {
        console.error(`✗ 无法从 run-log 推断当前阶段（最后 checkpoint phase=${lastPhase}）`);
        process.exit(2);
      }
      phase = lastPhase;
      console.error(`[auto-trigger] 从 run-log 推断当前阶段: phase=${phase}`);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ENOENT') {
        console.error(`✗ run-log 文件不存在: ${abs}`);
        process.exit(2);
      }
      throw err;
    }
  }

  if (!phase || phase < 1 || phase > 8) {
    console.error('用法: check-preventive-review.ts <project-dir> --phase=<1-8> | --auto-trigger --run-log=<run-log.jsonl>');
    process.exit(2);
  }

  const reviewsDir = path.resolve(projectDir, '.w-model', 'preventive-reviews');
  const dimensions = ['completeness', 'reliability', 'security'] as const;
  const reviews: Record<string, PreventiveReview | null> = {};

  for (const dim of dimensions) {
    const filePath = path.resolve(reviewsDir, `${phase}-${dim}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      reviews[dim] = JSON.parse(content) as PreventiveReview;
    } catch {
      reviews[dim] = null;
    }
  }

  const result = checkPreventiveReview(reviews, phase);
  const output = {
    ...PREVENTIVE_REVIEW_JSON,
    exitCode: result.passed ? 0 : 1,
    passed: result.passed,
    reasons: result.reasons,
    reviews: result.reviews,
    autoTrigger,
    phase,
  };

  console.log('PREVENTIVE_REVIEW_JSON ' + JSON.stringify({ type: 'preventive-review', passed: output.passed, exitCode: output.exitCode, reasons: output.reasons }));

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
  console.error(err);
  process.exit(2);
});
