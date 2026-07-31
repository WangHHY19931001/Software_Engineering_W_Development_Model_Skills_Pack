/**
 * run-log-logic.ts 单元测试 —— R1/R3/R6/R7 扩展规则（rootcause/fix 动作）
 *
 * 覆盖：
 *   - R1 扩展：rootcause 动作字段完整性（reportId/rootCauseCategory/upstreamDefect/rollbackRecommended）
 *   - R1 扩展：fix 动作字段完整性（basedOnReport/artifacts）
 *   - R3 扩展：rootcause ↔ fix 一一对应 + V 复审 rootcause 记录数 = R 记录数
 *   - R7 扩展：返工路径时序 rootcause → review(targetKind=rootcause) → fix
 */

import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRunLog, type RunLogEntry } from '../run-log-logic.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.join(here, '..', 'samples', 'run-log');

async function loadJsonl(file: string): Promise<RunLogEntry[]> {
  const raw = await fs.readFile(path.join(samplesDir, file), 'utf-8');
  return raw
    .trim()
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

describe('run-log R1 扩展：rootcause/fix 动作字段', () => {
  it('rootcause 动作缺 reportId 时失败', async () => {
    const lines = await loadJsonl('rootcause-valid.jsonl');
    const bad = lines.map(l =>
      l.action === 'rootcause' ? { ...l, reportId: undefined } : l,
    ) as RunLogEntry[];
    const result = checkRunLog(bad);
    expect(result.passed).toBe(false);
    expect(result.violations.some(r => /R1.*rootcause.*reportId/.test(r))).toBe(true);
  });

  it('rootcause 动作缺 rootCauseCategory 时失败', async () => {
    const lines = await loadJsonl('rootcause-valid.jsonl');
    const bad = lines.map(l =>
      l.action === 'rootcause' ? { ...l, rootCauseCategory: undefined } : l,
    ) as RunLogEntry[];
    const result = checkRunLog(bad);
    expect(result.passed).toBe(false);
    expect(result.violations.some(r => /R1.*rootcause.*rootCauseCategory/.test(r))).toBe(true);
  });

  it('fix 动作缺 basedOnReport 时失败', async () => {
    const lines = await loadJsonl('rootcause-valid.jsonl');
    const bad = lines.map(l =>
      l.action === 'fix' ? { ...l, basedOnReport: undefined } : l,
    ) as RunLogEntry[];
    const result = checkRunLog(bad);
    expect(result.passed).toBe(false);
    expect(result.violations.some(r => /R1.*fix.*basedOnReport/.test(r))).toBe(true);
  });

  it('完整 rootcause-valid 样本通过所有扩展校验', async () => {
    const lines = await loadJsonl('rootcause-valid.jsonl');
    const result = checkRunLog(lines);
    expect(result.passed).toBe(true);
  });
});

describe('run-log R3 扩展：R + S-fix 一一对应 + V 复审', () => {
  it('有 R 但缺 S-fix 时失败', async () => {
    const lines = await loadJsonl('rootcause-missing-fix.jsonl');
    const result = checkRunLog(lines);
    expect(result.passed).toBe(false);
    expect(
      result.violations.some(r => /R3.*rootcause.*fix.*一一对应|basedOnReport.*缺失/.test(r)),
    ).toBe(true);
  });

  it('有 R 但缺 V 复审 rootcause 时失败', async () => {
    const lines = await loadJsonl('rootcause-missing-review.jsonl');
    const result = checkRunLog(lines);
    expect(result.passed).toBe(false);
    expect(
      result.violations.some(r => /R3.*V 复审 rootcause.*≠.*R 记录数/.test(r)),
    ).toBe(true);
  });
});

describe('run-log R7 扩展：返工路径时序', () => {
  it('有 R 但缺 S-fix 时 R7 时序校验也失败', async () => {
    const lines = await loadJsonl('rootcause-missing-fix.jsonl');
    const result = checkRunLog(lines);
    expect(
      result.violations.some(r => /R7.*rootcause.*fix/.test(r)),
    ).toBe(true);
  });

  it('有 R 但缺 V 复审 rootcause 时 R7 时序校验也失败', async () => {
    const lines = await loadJsonl('rootcause-missing-review.jsonl');
    const result = checkRunLog(lines);
    expect(
      result.violations.some(r => /R7.*rootcause.*review.*targetKind=rootcause/.test(r)),
    ).toBe(true);
  });
});

describe('run-log E5: R1 阶段 5-8 分档', () => {
  it('阶段 5 含 produce/review/gate/checkpoint 应通过（不要求 chunk/cross）', async () => {
    const lines = await loadJsonl('phase5-valid.jsonl');
    const result = checkRunLog(lines);
    expect(result.passed).toBe(true);
  });

  it('阶段 5 缺 produce 动作应失败', async () => {
    const lines = await loadJsonl('phase5-missing-produce.jsonl');
    const result = checkRunLog(lines);
    expect(result.passed).toBe(false);
    expect(result.violations.some(r => /R1.*缺 produce/.test(r))).toBe(true);
  });
});

describe('run-log E7: gateExitCode 未回填', () => {
  it('gateLogPath 已设但 gateExitCode 为 null 应被 R6 拦截', async () => {
    const lines = await loadJsonl('bad-gateExitCode-null.jsonl');
    const result = checkRunLog(lines);
    expect(result.passed).toBe(false);
    expect(result.violations.some(r => /R6.*gateLogPath.*gateExitCode/.test(r))).toBe(true);
  });
});

describe('run-log E8: rootcause 之后中间夹普通 review 不误报', () => {
  it('rootcause→普通review→review(targetKind=rootcause)→fix 应通过 R7', async () => {
    const lines = await loadJsonl('rootcause-intermediate-review.jsonl');
    const result = checkRunLog(lines);
    expect(result.passed).toBe(true);
  });
});

describe('run-log E9: 1 fix 可覆盖多份 R 报告（去重映射）', () => {
  it('1 fix（basedOnReport 分号分隔）覆盖 2 份 R 报告应通过', async () => {
    const lines = await loadJsonl('rootcause-multi-fix.jsonl');
    const result = checkRunLog(lines);
    expect(result.passed).toBe(true);
  });

  it('2 份 R 报告但仅 1 份有 fix 应被 R3 拦截', async () => {
    const lines = await loadJsonl('rootcause-multi-uncovered.jsonl');
    const result = checkRunLog(lines);
    expect(result.passed).toBe(false);
    expect(result.violations.some(r => /R3.*rootcause.*RC-phase5-1-02.*无对应 fix/.test(r))).toBe(true);
  });
});
