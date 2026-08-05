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
import { checkRunLog, extractExitCode, buildGateLogKeys, type RunLogEntry } from '../run-log-logic.js';

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

describe('run-log R8 扩展：S-fix/emergency-fix 后须 R3（第29轮）', () => {
  it('S-fix 后无 R3 直接 V 应失败', () => {
    const entries: RunLogEntry[] = [
      { runId: '1', timestamp: '2026-07-31T00:00:00Z', phase: 5, phaseName: 'Coding', action: 'fix', role: 'S', duration_s: 10, tokens: 100, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
      { runId: '2', timestamp: '2026-07-31T00:01:00Z', phase: 5, phaseName: 'Coding', action: 'review', role: 'V', duration_s: 5, tokens: 50, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
    ];
    const result = checkRunLog(entries, { gateLogs: new Map() });
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => /R3 记录校验失败.*S\(fix\)/.test(v))).toBe(true);
  });

  it('S-emergency-fix 后无 R3 直接 V 应失败', () => {
    const entries: RunLogEntry[] = [
      { runId: '1', timestamp: '2026-07-31T00:00:00Z', phase: 5, phaseName: 'Coding', action: 'emergency-fix', role: 'S', duration_s: 10, tokens: 100, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
      { runId: '2', timestamp: '2026-07-31T00:01:00Z', phase: 5, phaseName: 'Coding', action: 'review', role: 'V', duration_s: 5, tokens: 50, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
    ];
    const result = checkRunLog(entries, { gateLogs: new Map() });
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => /R3 记录校验失败.*S\(emergency-fix\)/.test(v))).toBe(true);
  });

  it('S-fix 后有 3 条 R3 再 V 应通过 R8（不因 fix 段报违规）', () => {
    const entries: RunLogEntry[] = [
      { runId: '1', timestamp: '2026-07-31T00:00:00Z', phase: 5, phaseName: 'Coding', action: 'fix', role: 'S', duration_s: 10, tokens: 100, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
      { runId: '2', timestamp: '2026-07-31T00:01:00Z', phase: 5, phaseName: 'Coding', action: 'r3-completeness', role: 'R', duration_s: 5, tokens: 50, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
      { runId: '3', timestamp: '2026-07-31T00:02:00Z', phase: 5, phaseName: 'Coding', action: 'r3-reliability', role: 'R', duration_s: 5, tokens: 50, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
      { runId: '4', timestamp: '2026-07-31T00:03:00Z', phase: 5, phaseName: 'Coding', action: 'r3-security', role: 'R', duration_s: 5, tokens: 50, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
      { runId: '5', timestamp: '2026-07-31T00:04:00Z', phase: 5, phaseName: 'Coding', action: 'review', role: 'V', duration_s: 5, tokens: 50, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
    ];
    const result = checkRunLog(entries, { gateLogs: new Map() });
    expect(result.violations.some(v => /R3 记录校验失败/.test(v))).toBe(false);
  });

  it('S-emergency-fix 后有 3 条 R3 再 V 应通过 R8', () => {
    const entries: RunLogEntry[] = [
      { runId: '1', timestamp: '2026-07-31T00:00:00Z', phase: 5, phaseName: 'Coding', action: 'emergency-fix', role: 'S', duration_s: 10, tokens: 100, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
      { runId: '2', timestamp: '2026-07-31T00:01:00Z', phase: 5, phaseName: 'Coding', action: 'r3-completeness', role: 'R', duration_s: 5, tokens: 50, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
      { runId: '3', timestamp: '2026-07-31T00:02:00Z', phase: 5, phaseName: 'Coding', action: 'r3-reliability', role: 'R', duration_s: 5, tokens: 50, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
      { runId: '4', timestamp: '2026-07-31T00:03:00Z', phase: 5, phaseName: 'Coding', action: 'r3-security', role: 'R', duration_s: 5, tokens: 50, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
      { runId: '5', timestamp: '2026-07-31T00:04:00Z', phase: 5, phaseName: 'Coding', action: 'review', role: 'V', duration_s: 5, tokens: 50, estimated: false, subagentSpawns: 0, gateExitCode: null, outcome: 'success' },
    ];
    const result = checkRunLog(entries, { gateLogs: new Map() });
    expect(result.violations.some(v => /R3 记录校验失败/.test(v))).toBe(false);
  });
});

describe('R6 契约迁移：extractExitCode / buildGateLogKeys', () => {
  it('extractExitCode 从 GATE_JSON 摘要行提取 exitCode', () => {
    const content = 'some log\nGATE_JSON {"passed":true,"exitCode":0}\nend';
    expect(extractExitCode(content)).toBe(0);
  });

  it('extractExitCode 从 VERIFIER_JSON 摘要行提取 exitCode（多标记扫描）', () => {
    const content = 'VERIFIER_JSON {"passed":false,"exitCode":1}';
    expect(extractExitCode(content)).toBe(1);
  });

  it('extractExitCode 无匹配 → undefined', () => {
    expect(extractExitCode('no json here')).toBeUndefined();
  });

  it('buildGateLogKeys 返回 basename / 绝对路径 / 相对 cwd / 正斜杠归一化 4 类 key', () => {
    const fileAbs = 'C:/proj/.w-model/gate-logs/phase5-check-a.log';
    const keys = buildGateLogKeys(fileAbs, 'C:/proj');
    expect(keys).toContain('phase5-check-a.log');
    expect(keys).toContain(fileAbs);
    expect(keys).toContain('.w-model/gate-logs/phase5-check-a.log');
    expect(keys).toContain('C:\\proj\\.w-model\\gate-logs\\phase5-check-a.log');
  });

  it('buildGateLogKeys 含反斜杠路径输入（Windows 兼容归一化）', () => {
    const fileAbs = 'C:\\proj\\.w-model\\gate-logs\\phase1-check-tla.log';
    const keys = buildGateLogKeys(fileAbs, 'C:\\proj');
    expect(keys).toContain('phase1-check-tla.log');
    expect(keys).toContain('C:/proj/.w-model/gate-logs/phase1-check-tla.log');
    expect(keys).toContain('.w-model/gate-logs/phase1-check-tla.log');
  });

  it('buildGateLogKeys cwd 为空 → 退化为 basename + 绝对路径（无相对 key）', () => {
    const keys = buildGateLogKeys('C:/proj/a.log', '');
    expect(keys).toContain('a.log');
    expect(keys).toContain('C:/proj/a.log');
    expect(keys).not.toContain('proj/a.log');
  });

  it('extractExitCode 畸形 JSON 摘要行 → 跳过继续扫描后续标记', () => {
    const content = 'GATE_JSON {broken json\nVERIFIER_JSON {"exitCode":1}';
    expect(extractExitCode(content)).toBe(1);
  });

  it('extractExitCode exitCode 非 number → undefined', () => {
    const content = 'GATE_JSON {"passed":true,"exitCode":"0"}';
    expect(extractExitCode(content)).toBeUndefined();
  });

  it('extractExitCode 首个标记无 exitCode 时继续扫后续标记（fallthrough）', () => {
    const content = 'GRAPH_JSON {"passed":true}\nMATURITY_JSON {"exitCode":1}';
    expect(extractExitCode(content)).toBe(1);
  });

  it('buildGateLogKeys cwd 外文件 → 无相对 key，仅 basename + 绝对路径 + 归一化', () => {
    const fileAbs = 'D:/other/x.log';
    const keys = buildGateLogKeys(fileAbs, 'C:/proj');
    expect(keys).toContain('x.log');
    expect(keys).toContain('D:/other/x.log');
    expect(keys).not.toContain('other/x.log');
    // 双向归一化 + 去重后应为 3 个 key（basename / 绝对正斜杠 / 绝对反斜杠）
    expect(keys.length).toBe(3);
  });
});
