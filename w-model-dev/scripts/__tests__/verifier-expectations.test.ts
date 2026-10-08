/**
 * verifier-expectations.test.ts —— 共享期望表与 43.3.0 前 self-test VERIFIER_CASES 的**等价断言测试**（D3-I）。
 *
 * 本文件把抽表**之前**的 VERIFIER_CASES（self-test.ts L186-385，43.3.0）固化为冻结黄金快照（GOLDEN），
 * 断言共享表 `samples/expectations/verifier.ts` 的 VERIFIER_EXPECTATIONS 与之逐项一致：
 *   - 用例集合等价：表内 fixture 一一对应 samples/verifier/ 在盘 fixture（无增删、无重名）；
 *   - 行为逐项等价：每个 fixture 的 expectedPassed 不变、expectedReasonPatterns 的源文本逐条不变；
 * 黄金快照是**一次性表征（characterization）**而非活声明——vitest 运行只消费共享表本身，
 * 后续任何「表与基准行为漂移」（改 passed、改正则、增删用例）都会在此红灯。
 */

import { readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { VERIFIER_EXPECTATIONS } from '../samples/expectations/verifier.js';

/** 冻结黄金快照：抽表前 self-test VERIFIER_CASES（43.3.0）逐条抄录（file → expectedPassed + 正则源文本） */
const GOLDEN: Record<string, { expectedPassed: boolean; reasonPatterns: readonly string[] }> = {
  'valid.json': { expectedPassed: true, reasonPatterns: [] },
  'persona-code-reviewer.json': { expectedPassed: true, reasonPatterns: [] },
  'persona-test-engineer.json': { expectedPassed: true, reasonPatterns: [] },
  'persona-security-auditor.json': { expectedPassed: true, reasonPatterns: [] },
  'persona-performance-auditor.json': {
    expectedPassed: true,
    reasonPatterns: [],
  },
  'bad-ranking-k.json': {
    expectedPassed: false,
    reasonPatterns: ['\\[schema\\].*ranking'],
  },
  'bad-composite-score.json': {
    expectedPassed: false,
    reasonPatterns: ['compositeScore.*Σ\\(score\\*weight\\)'],
  },
  'bad-quality-level.json': {
    expectedPassed: false,
    reasonPatterns: ['qualityLevel.*应映射为'],
  },
  'bad-variance-threshold.json': {
    expectedPassed: false,
    reasonPatterns: ['\\[schema\\].*varianceThreshold'],
  },
  'bad-variance-drift.json': {
    expectedPassed: false,
    reasonPatterns: ['variance.*重算的方差'],
  },
  'bad-passed-mismatch.json': {
    expectedPassed: false,
    reasonPatterns: ['passed.*与 qualityLevel.*不一致'],
  },
  'bad-reviewed-at.json': {
    expectedPassed: false,
    reasonPatterns: ['\\[schema\\].*reviewedAt'],
  },
  'bad-variance-threshold-range.json': {
    expectedPassed: false,
    reasonPatterns: ['varianceThreshold 必须在 \\[0,0\\.1\\]'],
  },
  'bad-ranking-ordered.json': {
    expectedPassed: false,
    reasonPatterns: ['ranking\\.ordered 不得包含重复候选项'],
  },
  'bad-rawscores-all-same.json': {
    expectedPassed: false,
    reasonPatterns: ['rawScores 全同'],
  },
  'bad-variance-mismatch.json': {
    expectedPassed: false,
    reasonPatterns: ['variance.*≠.*重算的方差'],
  },
  'bad-perturbation-out-of-range.json': {
    expectedPassed: false,
    reasonPatterns: ['扰动.*> 0\\.10'],
  },
  'bad-targetkind.json': {
    expectedPassed: false,
    reasonPatterns: ['\\[schema\\].*targetKind'],
  },
  'bad-subcriteria-name.json': {
    expectedPassed: false,
    reasonPatterns: ['应为.*fake-criterion'],
  },
  'bad-rawscores-constant.json': {
    expectedPassed: false,
    reasonPatterns: ['rawScores 全同'],
  },
  'bad-summary-too-short.json': {
    expectedPassed: false,
    reasonPatterns: ['\\[schema\\].*summary'],
  },
  'bad-evidence-empty.json': {
    expectedPassed: false,
    reasonPatterns: ['evidence.*缺具体引用.*R12'],
  },
  'bad-single-axis-low.json': {
    expectedPassed: false,
    reasonPatterns: ['completeness.*0\\.65.*0\\.7(?!\\d).*单轴下限'],
  },
  'bad-arithmetic-sequence.json': {
    expectedPassed: false,
    reasonPatterns: ['完美等差.*公差 0\\.01', '真实离散'],
  },
  'bad-resolution-floor.json': {
    expectedPassed: false,
    reasonPatterns: ['R18.*completeness.*分布坍缩'],
  },
  'bad-evidence-double-l.json': {
    expectedPassed: false,
    reasonPatterns: ['evidence 格式不符.*双 L 非法', 'L51-L53='],
  },
  'valid-rootcause.json': { expectedPassed: true, reasonPatterns: [] },
  'valid-windows-evidence.json': { expectedPassed: true, reasonPatterns: [] },
  'bad-rootcause-subcriteria.json': {
    expectedPassed: false,
    reasonPatterns: ['subCriteria.*name 应为'],
  },
  'bad-r19-evidence-not-registered.json': {
    expectedPassed: false,
    reasonPatterns: ['R19 evidence 引用未在 reviewedArtifacts 登记'],
  },
  'bad-r19-artifact-hash-mismatch.json': {
    expectedPassed: false,
    reasonPatterns: ['R19 评审对象哈希不符'],
  },
  'bad-r19-line-out-of-range.json': {
    expectedPassed: false,
    reasonPatterns: ['R19 evidence 行号越界'],
  },
};

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(TEST_DIR, '../../..');
const VERIFIER_FIXTURES_DIR = resolve(ROOT, 'w-model-dev/scripts/samples/verifier');

describe('verifier 期望表单源 —— 与旧声明等价（D3-I）', () => {
  it('表内 fixture 集与 samples/verifier 在盘 JSON 一一对应（无增删、无重名）', async () => {
    const onDisk = (await readdir(VERIFIER_FIXTURES_DIR)).filter((f) => f.endsWith('.json')).sort();
    const tableFiles = VERIFIER_EXPECTATIONS.map((e) => e.file).sort();
    expect(tableFiles).toEqual(onDisk);
    expect(new Set(VERIFIER_EXPECTATIONS.map((e) => e.file)).size).toBe(VERIFIER_EXPECTATIONS.length);
  });

  it('每个 fixture 的 expectedPassed 与 reasonPatterns 与黄金快照逐项一致', () => {
    expect(VERIFIER_EXPECTATIONS.length).toBe(Object.keys(GOLDEN).length);
    for (const e of VERIFIER_EXPECTATIONS) {
      const g = GOLDEN[e.file];
      expect(g, `表外 fixture：${e.file}`).toBeDefined();
      if (g === undefined) continue;
      expect(e.expectedPassed, `${e.file}.expectedPassed`).toBe(g.expectedPassed);
      const pats = (e.expectedReasonPatterns ?? []).map((p) => p.source);
      expect(pats, `${e.file}.reasonPatterns 源文本`).toEqual(g.reasonPatterns);
    }
    for (const file of Object.keys(GOLDEN)) {
      expect(
        VERIFIER_EXPECTATIONS.some((e) => e.file === file),
        `黄金快照 fixture 不在表中：${file}`,
      ).toBe(true);
    }
  });
});
