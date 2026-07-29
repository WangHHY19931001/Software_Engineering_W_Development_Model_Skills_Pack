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
  const phase = phaseArg ? parseInt(phaseArg.split('=')[1]!, 10) : undefined;

  if (!phase || phase < 1 || phase > 8) {
    console.error('用法: check-preventive-review.ts <project-dir> --phase=<1-8>');
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
  };

  console.log(JSON.stringify(output, null, 2));

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
