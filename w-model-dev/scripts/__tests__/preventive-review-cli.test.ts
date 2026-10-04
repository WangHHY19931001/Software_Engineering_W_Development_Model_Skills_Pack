/* eslint-disable security/detect-non-literal-fs-filename -- fixture 均建于测试自有的 mkdtemp 临时目录，路径为运行期非字面量 */
/**
 * check-preventive-review CLI 读文件异常分类契约测试（C18，2026-10-04 audit-deep-dive-fixes 任务 8）。
 *
 * 覆盖（CLI 读文件层前缀区分；logic 层判据不动，仍统一给「R3 报告缺失：<dim> 维度报告未找到」）：
 *   - exit 1 + `R3_MISSING:`：某维度报告文件不存在（ENOENT，报告未产出）；
 *   - exit 1 + `R3_UNREADABLE:`：某维度报告文件存在但 JSON 解析失败（已产出但不可读，附 err.message）；
 *   - 混合场景：同一次运行中 missing 与 unreadable 按维度各归其位，互不串扰。
 *
 * 本文件启动真实 tsx 子进程 → 已登记 config/vitest.config.ts 的 SUBPROCESS_TEST_FILES
 * （vitest-project-split 双向守护）。runSync 强制 timeout/SIGKILL；60s 理由同
 * design-fog-cli.test.ts（tsx 冷启动在满载下可超 runSync 缺省 15s）。
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CLI = path.join(REPO_ROOT, 'w-model-dev/scripts/cli/check-preventive-review.ts');

type Dimension = 'completeness' | 'reliability' | 'security';

/** 构造一份 phase=1 合规的 R3 报告 JSON 文本（与 samples/preventive-review/valid-completeness.json 同形状）。 */
function validReview(dimension: Dimension): string {
  return JSON.stringify({
    reviewedAt: '2026-10-04T00:00:00Z',
    reviewer: `R3-${dimension}-bot`,
    phase: 1,
    dimension,
    findings: [],
    passed: true,
  });
}

interface PreventiveReviewCliSummary {
  passed: boolean;
  exitCode: number;
  reasons: string[];
}

interface RunResult {
  code: number;
  summary: PreventiveReviewCliSummary | undefined;
  dir: string;
}

/**
 * 在临时项目目录落 `.w-model/preventive-reviews/` 内给定文件（值为 undefined 表示刻意不写、
 * 模拟报告缺失），跑 `check-preventive-review.ts <dir> --phase=1`，解析 PREVENTIVE_REVIEW_JSON 行。
 */
function runScenario(files: Partial<Record<`${'1-'}${Dimension}.json`, string>>): RunResult {
  const dir = mkdtempSync(path.join(tmpdir(), 'preventive-review-'));
  const reviewsDir = path.join(dir, '.w-model', 'preventive-reviews');
  mkdirSync(reviewsDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    if (content !== undefined) writeFileSync(path.join(reviewsDir, name), content, 'utf8');
  }
  const r = runSync(process.execPath, [tsxCli, CLI, dir, '--phase=1'], {
    cwd: REPO_ROOT,
    timeout: 60_000,
  });
  const jsonLine = (r.stdout ?? '').split(/\r?\n/).find((l) => l.startsWith('PREVENTIVE_REVIEW_JSON '));
  return {
    code: r.status ?? -1,
    summary: jsonLine
      ? (JSON.parse(jsonLine.slice('PREVENTIVE_REVIEW_JSON '.length)) as PreventiveReviewCliSummary)
      : undefined,
    dir,
  };
}

function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

describe('check-preventive-review CLI：读文件异常分类前缀（C18）', () => {
  it('报告缺失（ENOENT）→ exit 1 且 reasons 前缀 R3_MISSING，不再出现旧「R3 报告缺失」无差别文案', () => {
    const { code, summary, dir } = runScenario({
      '1-completeness.json': undefined, // 刻意缺失 → ENOENT
      '1-reliability.json': validReview('reliability'),
      '1-security.json': validReview('security'),
    });
    expect(code).toBe(1);
    expect(summary).toBeDefined();
    const missing = summary!.reasons.filter((r) => r.startsWith('R3_MISSING:'));
    expect(missing).toHaveLength(1);
    expect(missing[0]).toContain('completeness');
    expect(summary!.reasons.some((r) => r.startsWith('R3 报告缺失'))).toBe(false);
    cleanup(dir);
  });

  it('报告存在但 JSON 解析失败 → exit 1 且 reasons 前缀 R3_UNREADABLE（附 err.message），不得误报 R3_MISSING', () => {
    const { code, summary, dir } = runScenario({
      '1-completeness.json': '{ 这不是合法 JSON', // 文件已产出但不可读
      '1-reliability.json': validReview('reliability'),
      '1-security.json': validReview('security'),
    });
    expect(code).toBe(1);
    expect(summary).toBeDefined();
    const unreadable = summary!.reasons.filter((r) => r.startsWith('R3_UNREADABLE:'));
    expect(unreadable).toHaveLength(1);
    // 已产出但不可读：前缀后须附解析错误消息（非空括注）
    expect(unreadable[0]).toMatch(/^R3_UNREADABLE: completeness 维度报告已产出但不可读（.+）$/);
    expect(summary!.reasons.some((r) => r.startsWith('R3_MISSING:'))).toBe(false);
    cleanup(dir);
  });

  it('混合场景：missing 与 unreadable 按维度各归其位（completeness 不可读 + reliability 缺失互不串扰）', () => {
    const { code, summary, dir } = runScenario({
      '1-completeness.json': '{ 这不是合法 JSON',
      // 1-reliability.json 刻意缺失 → ENOENT
      '1-security.json': validReview('security'),
    });
    expect(code).toBe(1);
    expect(summary).toBeDefined();
    expect(summary!.reasons.some((r) => r.startsWith('R3_MISSING: reliability '))).toBe(true);
    expect(summary!.reasons.some((r) => r.startsWith('R3_UNREADABLE: completeness '))).toBe(true);
    cleanup(dir);
  });
});
