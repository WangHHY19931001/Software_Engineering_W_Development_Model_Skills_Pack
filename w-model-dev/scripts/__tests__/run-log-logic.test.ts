/**
 * run-log-logic.ts 单元测试 —— R1/R3/R6/R7 扩展规则（rootcause/fix 动作）
 *
 * 覆盖：
 *   - R1 扩展：rootcause 动作字段完整性（reportId/rootCauseCategory/upstreamDefect/rollbackRecommended）
 *   - R1 扩展：fix 动作字段完整性（basedOnReport/artifacts）
 *   - R3 扩展：rootcause ↔ fix 一一对应 + V 复审 rootcause 记录数 = R 记录数
 *   - R7 扩展：返工路径时序 rootcause → review(targetKind=rootcause) → fix
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  checkRunLog,
  extractExitCode,
  inspectGateLogContent,
  buildGateLogKeys,
  type RunLogEntry,
} from '../logic/run-log-logic.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.join(here, '..', 'samples', 'run-log');
const identity2FixturePath = path.join(here, 'fixtures', 'run-log-identity2-raw.jsonl');

async function loadJsonl(file: string): Promise<RunLogEntry[]> {
  const raw = await fs.readFile(path.join(samplesDir, file), 'utf-8');
  return raw
    .trim()
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

describe('run-log R1 扩展：rootcause/fix 动作字段', () => {
  it('rootcause 动作缺 reportId 时失败', async () => {
    const lines = await loadJsonl('rootcause-valid.jsonl');
    const bad = lines.map((l) => (l.action === 'rootcause' ? { ...l, reportId: undefined } : l)) as RunLogEntry[];
    const result = checkRunLog(bad);
    expect(result.passed).toBe(false);
    expect(result.violations.some((r) => /R1.*rootcause.*reportId/.test(r))).toBe(true);
  });

  it('rootcause 动作缺 rootCauseCategory 时失败', async () => {
    const lines = await loadJsonl('rootcause-valid.jsonl');
    const bad = lines.map((l) =>
      l.action === 'rootcause' ? { ...l, rootCauseCategory: undefined } : l,
    ) as RunLogEntry[];
    const result = checkRunLog(bad);
    expect(result.passed).toBe(false);
    expect(
      result.violations.some((r) => /R1.*rootcause.*rootCauseCategory|\[schema\].*rootCauseCategory/.test(r)),
    ).toBe(true);
  });

  it('fix 动作缺 basedOnReport 时失败', async () => {
    const lines = await loadJsonl('rootcause-valid.jsonl');
    const bad = lines.map((l) => (l.action === 'fix' ? { ...l, basedOnReport: undefined } : l)) as RunLogEntry[];
    const result = checkRunLog(bad);
    expect(result.passed).toBe(false);
    expect(result.diagnostics?.some((r) => /LEGACY_UNSCOPED.*basedOnReport/.test(r))).toBe(true);
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
    expect(result.violations.some((r) => /R3.*rootcause.*fix.*一一对应|basedOnReport.*缺失/.test(r))).toBe(true);
  });

  it('有 R 但缺 V 复审 rootcause 时失败', async () => {
    const lines = await loadJsonl('rootcause-missing-review.jsonl');
    const result = checkRunLog(lines);
    expect(result.passed).toBe(false);
    expect(result.violations.some((r) => /R3.*V 复审 rootcause.*≠.*R 记录数/.test(r))).toBe(true);
  });
});

describe('run-log R7 扩展：返工路径时序', () => {
  it('有 R 但缺 S-fix 时 R7 时序校验也失败', async () => {
    const lines = await loadJsonl('rootcause-missing-fix.jsonl');
    const result = checkRunLog(lines);
    expect(result.violations.some((r) => /R7.*rootcause.*fix/.test(r))).toBe(true);
  });

  it('有 R 但缺 V 复审 rootcause 时 R7 时序校验也失败', async () => {
    const lines = await loadJsonl('rootcause-missing-review.jsonl');
    const result = checkRunLog(lines);
    expect(result.violations.some((r) => /R7.*rootcause.*review.*targetKind=rootcause/.test(r))).toBe(true);
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
    expect(result.violations.some((r) => /R1.*缺 produce/.test(r))).toBe(true);
  });
});

describe('run-log E7: gateExitCode 未回填', () => {
  it('gateLogPath 已设但 gateExitCode 为 null 应被 R6 拦截', async () => {
    const lines = await loadJsonl('bad-gateExitCode-null.jsonl');
    const result = checkRunLog(lines);
    expect(result.passed).toBe(false);
    expect(result.violations.some((r) => /R6.*gateLogPath.*gateExitCode/.test(r))).toBe(true);
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
    expect(result.violations.some((r) => /R3.*rootcause.*RC-phase5-1-02.*无对应 fix/.test(r))).toBe(true);
  });
});

describe('run-log R8 扩展：S-fix/emergency-fix 后须 R3', () => {
  it('S-fix 后无 R3 直接 V 应失败', () => {
    const entries: RunLogEntry[] = [
      {
        runId: '1',
        timestamp: '2026-07-31T00:00:00Z',
        phase: 5,
        phaseName: 'Coding',
        action: 'fix',
        role: 'S',
        duration_s: 10,
        tokens: 100,
        estimated: false,
        subagentSpawns: 0,
        gateExitCode: null,
        outcome: 'success',
        basedOnReport: 'RC-R8',
        artifacts: ['test-artifact'],
      },
      {
        runId: '2',
        timestamp: '2026-07-31T00:01:00Z',
        phase: 5,
        phaseName: 'Coding',
        action: 'review',
        role: 'V',
        duration_s: 5,
        tokens: 50,
        estimated: false,
        subagentSpawns: 0,
        gateExitCode: null,
        outcome: 'success',
      },
    ];
    const result = checkRunLog(entries, { gateLogs: new Map() });
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => /R3 记录校验失败.*S\(fix\)/.test(v))).toBe(true);
  });

  it('S-emergency-fix 后无 R3 直接 V 应失败', () => {
    const entries: RunLogEntry[] = [
      {
        runId: '1',
        timestamp: '2026-07-31T00:00:00Z',
        phase: 5,
        phaseName: 'Coding',
        action: 'emergency-fix',
        role: 'S',
        duration_s: 10,
        tokens: 100,
        estimated: false,
        subagentSpawns: 0,
        gateExitCode: null,
        outcome: 'success',
        basedOnReport: 'RC-R8',
        artifacts: ['test-artifact'],
        variant: 'emergency-fix',
        blocker: '构建失败阻塞当前阶段推进',
      },
      {
        runId: '2',
        timestamp: '2026-07-31T00:01:00Z',
        phase: 5,
        phaseName: 'Coding',
        action: 'review',
        role: 'V',
        duration_s: 5,
        tokens: 50,
        estimated: false,
        subagentSpawns: 0,
        gateExitCode: null,
        outcome: 'success',
      },
    ];
    const result = checkRunLog(entries, { gateLogs: new Map() });
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => /R3 记录校验失败.*S\(emergency-fix\)/.test(v))).toBe(true);
  });

  it('S-fix 后有 3 条 R3 再 V 应通过 R8（不因 fix 段报违规）', () => {
    const entries: RunLogEntry[] = [
      {
        runId: '1',
        timestamp: '2026-07-31T00:00:00Z',
        phase: 5,
        phaseName: 'Coding',
        action: 'fix',
        role: 'S',
        duration_s: 10,
        tokens: 100,
        estimated: false,
        subagentSpawns: 0,
        gateExitCode: null,
        outcome: 'success',
        basedOnReport: 'RC-R8',
        artifacts: ['test-artifact'],
      },
      {
        runId: '2',
        timestamp: '2026-07-31T00:01:00Z',
        phase: 5,
        phaseName: 'Coding',
        action: 'r3-completeness',
        role: 'R',
        duration_s: 5,
        tokens: 50,
        estimated: false,
        subagentSpawns: 0,
        gateExitCode: null,
        outcome: 'success',
      },
      {
        runId: '3',
        timestamp: '2026-07-31T00:02:00Z',
        phase: 5,
        phaseName: 'Coding',
        action: 'r3-reliability',
        role: 'R',
        duration_s: 5,
        tokens: 50,
        estimated: false,
        subagentSpawns: 0,
        gateExitCode: null,
        outcome: 'success',
      },
      {
        runId: '4',
        timestamp: '2026-07-31T00:03:00Z',
        phase: 5,
        phaseName: 'Coding',
        action: 'r3-security',
        role: 'R',
        duration_s: 5,
        tokens: 50,
        estimated: false,
        subagentSpawns: 0,
        gateExitCode: null,
        outcome: 'success',
      },
      {
        runId: '5',
        timestamp: '2026-07-31T00:04:00Z',
        phase: 5,
        phaseName: 'Coding',
        action: 'review',
        role: 'V',
        duration_s: 5,
        tokens: 50,
        estimated: false,
        subagentSpawns: 0,
        gateExitCode: null,
        outcome: 'success',
      },
    ];
    const result = checkRunLog(entries, { gateLogs: new Map() });
    expect(result.violations.some((v) => /R3 记录校验失败/.test(v))).toBe(false);
  });

  it('S-emergency-fix 后有 3 条 R3 再 V 应通过 R8', () => {
    const entries: RunLogEntry[] = [
      {
        runId: '1',
        timestamp: '2026-07-31T00:00:00Z',
        phase: 5,
        phaseName: 'Coding',
        action: 'emergency-fix',
        role: 'S',
        duration_s: 10,
        tokens: 100,
        estimated: false,
        subagentSpawns: 0,
        gateExitCode: null,
        outcome: 'success',
        basedOnReport: 'RC-R8',
        artifacts: ['test-artifact'],
        variant: 'emergency-fix',
        blocker: '构建失败阻塞当前阶段推进',
      },
      {
        runId: '2',
        timestamp: '2026-07-31T00:01:00Z',
        phase: 5,
        phaseName: 'Coding',
        action: 'r3-completeness',
        role: 'R',
        duration_s: 5,
        tokens: 50,
        estimated: false,
        subagentSpawns: 0,
        gateExitCode: null,
        outcome: 'success',
      },
      {
        runId: '3',
        timestamp: '2026-07-31T00:02:00Z',
        phase: 5,
        phaseName: 'Coding',
        action: 'r3-reliability',
        role: 'R',
        duration_s: 5,
        tokens: 50,
        estimated: false,
        subagentSpawns: 0,
        gateExitCode: null,
        outcome: 'success',
      },
      {
        runId: '4',
        timestamp: '2026-07-31T00:03:00Z',
        phase: 5,
        phaseName: 'Coding',
        action: 'r3-security',
        role: 'R',
        duration_s: 5,
        tokens: 50,
        estimated: false,
        subagentSpawns: 0,
        gateExitCode: null,
        outcome: 'success',
      },
      {
        runId: '5',
        timestamp: '2026-07-31T00:04:00Z',
        phase: 5,
        phaseName: 'Coding',
        action: 'review',
        role: 'V',
        duration_s: 5,
        tokens: 50,
        estimated: false,
        subagentSpawns: 0,
        gateExitCode: null,
        outcome: 'success',
      },
    ];
    const result = checkRunLog(entries, { gateLogs: new Map() });
    expect(result.violations.some((v) => /R3 记录校验失败/.test(v))).toBe(false);
  });
});

describe('B1 gate-log 根 JSON 协议', () => {
  const rootPayload = (exitCode: number, passed = exitCode === 0): string =>
    JSON.stringify({
      script: 'check-bdd-model.ts',
      exitCode,
      passed,
      reasons: [],
      reportSummary: { exitCode, passed },
      stdoutSummary: { exitCode, passed },
    });

  it.each([0, 1, 2])('extractExitCode 从根 JSON 提取 exitCode=%s', (exitCode) => {
    expect(extractExitCode(rootPayload(exitCode))).toBe(exitCode);
  });

  it('根 JSON 优先于旧摘要标记', () => {
    const payload = JSON.parse(rootPayload(0)) as Record<string, unknown>;
    payload.note = 'GATE_JSON {"exitCode":1}';
    expect(extractExitCode(JSON.stringify(payload))).toBe(0);
  });

  it('根 JSON 与 passed 不一致返回可追踪 violation，且不提取为合法 exitCode', () => {
    const content = rootPayload(0, false);
    const inspected = inspectGateLogContent(content);
    expect(inspected.exitCode).toBe(0);
    expect(inspected.violations.some((v) => /passed.*exitCode|exitCode.*passed/.test(v))).toBe(true);
    expect(extractExitCode(content)).toBeUndefined();
  });

  it('stdoutSummary/reportSummary 与根字段不一致返回 violation', () => {
    const payload = JSON.parse(rootPayload(0)) as Record<string, unknown>;
    payload.stdoutSummary = { exitCode: 1, passed: false };
    payload.reportSummary = { exitCode: 0, passed: false };
    const inspected = inspectGateLogContent(JSON.stringify(payload));
    expect(inspected.violations).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/stdoutSummary.*exitCode/),
        expect.stringMatching(/stdoutSummary.*passed/),
        expect.stringMatching(/reportSummary.*passed/),
      ]),
    );
  });

  it('根 JSON 缺字段或非法 exitCode 返回 violation，不回退旧摘要', () => {
    expect(inspectGateLogContent('{"passed":true}').violations).toEqual(
      expect.arrayContaining([expect.stringMatching(/root.*exitCode/)]),
    );
    expect(extractExitCode('{"exitCode":3,"passed":false}')).toBeUndefined();
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

  it('extractExitCode 从 ERROR_JSON 摘要行提取 exitCode（exit 2 存档）', () => {
    const content =
      '✗ [FILE_NOT_FOUND] 文件不存在\nERROR_JSON {"category":"FILE_NOT_FOUND","message":"文件不存在","exitCode":2,"file":"C:\\\\proj\\\\.w-model\\\\project.json"}';
    expect(extractExitCode(content)).toBe(2);
  });

  it('extractExitCode 从 STATE_MACHINE_JSON 摘要行提取 exitCode', () => {
    const content = 'STATE_MACHINE_JSON {"passed":true,"exitCode":0}';
    expect(extractExitCode(content)).toBe(0);
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

// ==================== R8 轨迹模板校验辅助 ====================
// makeEntry：接收部分字段拼默认值构造 RunLogEntry（schema 前置校验要求全部必需字段，
// additionalProperties=false，故逐字段构建 + 仅透传显式提供的可选字段）。

function makeEntry(overrides: Partial<RunLogEntry>): RunLogEntry {
  const base: RunLogEntry = {
    runId: 'run-default',
    timestamp: '2026-07-31T00:00:00Z',
    phase: 5,
    phaseName: '编码',
    action: 'produce',
    role: 'S',
    duration_s: 10,
    tokens: 100,
    estimated: false,
    subagentSpawns: 0,
    gateExitCode: null,
    outcome: 'success',
  };
  const merged: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined) merged[k] = v;
  }
  if (['fix', 'emergency-fix'].includes(String(merged.action))) {
    if (merged.basedOnReport === undefined) merged.basedOnReport = 'RC-TEST';
    if (merged.artifacts === undefined) merged.artifacts = ['test-artifact'];
  }
  if (merged.action === 'rootcause') {
    if (merged.reportId === undefined) merged.reportId = 'RC-TEST';
    if (merged.rootCauseCategory === undefined) merged.rootCauseCategory = 'coding-error';
    if (merged.upstreamDefect === undefined) merged.upstreamDefect = false;
    if (merged.rollbackRecommended === undefined) merged.rollbackRecommended = false;
  }
  return merged as unknown as RunLogEntry;
}

describe('run-log R8 轨迹模板校验（agentic Ch19 轨迹符合性）', () => {
  it('已完成阶段 gate 在 checkpoint 之后 → 违规', () => {
    const lines = [
      makeEntry({
        runId: 'r1',
        phase: 5,
        action: 'produce',
        role: 'S',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r2',
        phase: 5,
        action: 'review',
        role: 'V',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r3',
        phase: 5,
        action: 'checkpoint',
        role: 'O',
        outcome: 'success',
        acknowledgedDecisions: ['ok'],
      }),
      makeEntry({
        runId: 'r4',
        phase: 5,
        action: 'gate',
        role: 'G',
        outcome: 'success',
        gateExitCode: 0,
        script: 'check-artifact-gate.ts',
      }),
    ];
    const result = checkRunLog(lines);
    expect(result.violations.some((v) => /R8.*gate.*checkpoint/.test(v))).toBe(true);
  });

  it('V 失败后无 rootcause 直接 S-fix → 违规（反模式 #18 轨迹检测）', () => {
    const lines = [
      makeEntry({
        runId: 'r1',
        phase: 5,
        action: 'produce',
        role: 'S',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r2',
        phase: 5,
        action: 'review',
        role: 'V',
        outcome: 'fail',
      }),
      makeEntry({
        runId: 'r3',
        phase: 5,
        action: 'fix',
        role: 'S',
        outcome: 'rework',
        basedOnReport: 'RC-1',
      }),
    ];
    const result = checkRunLog(lines);
    expect(result.violations.some((v) => /R8.*rootcause/.test(v))).toBe(true);
  });

  it('checkpoint 非阶段最后记录 → 违规', () => {
    const lines = [
      makeEntry({
        runId: 'r1',
        phase: 5,
        action: 'produce',
        role: 'S',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r2',
        phase: 5,
        action: 'checkpoint',
        role: 'O',
        outcome: 'success',
        acknowledgedDecisions: ['ok'],
      }),
      makeEntry({
        runId: 'r3',
        phase: 5,
        action: 'review',
        role: 'V',
        outcome: 'success',
      }),
    ];
    const result = checkRunLog(lines);
    expect(result.violations.some((v) => /R8.*checkpoint/.test(v))).toBe(true);
  });

  it('理想轨迹 produce→V→G→checkpoint 通过', () => {
    const lines = [
      makeEntry({
        runId: 'r1',
        phase: 5,
        action: 'produce',
        role: 'S',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r2',
        phase: 5,
        action: 'review',
        role: 'V',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r3',
        phase: 5,
        action: 'gate',
        role: 'G',
        outcome: 'success',
        gateExitCode: 0,
        script: 'check-artifact-gate.ts',
      }),
      makeEntry({
        runId: 'r4',
        phase: 5,
        action: 'checkpoint',
        role: 'O',
        outcome: 'success',
        acknowledgedDecisions: ['ok'],
      }),
    ];
    const result = checkRunLog(lines);
    expect(result.violations.filter((v) => v.startsWith('R8'))).toHaveLength(0);
  });

  it('V 失败后先 rootcause 再 V 复审再 fix → R8 通过（不误报合法返工轨迹）', () => {
    const lines = [
      makeEntry({
        runId: 'r1',
        phase: 5,
        action: 'produce',
        role: 'S',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r2',
        phase: 5,
        action: 'review',
        role: 'V',
        outcome: 'fail',
      }),
      makeEntry({
        runId: 'r3',
        phase: 5,
        action: 'rootcause',
        role: 'R',
        outcome: 'success',
        reportId: 'RC-1',
      }),
      makeEntry({
        runId: 'r4',
        phase: 5,
        action: 'review',
        role: 'V',
        outcome: 'success',
        targetKind: 'rootcause',
        target: 'RC-1',
      }),
      makeEntry({
        runId: 'r5',
        phase: 5,
        action: 'fix',
        role: 'S',
        outcome: 'rework',
        basedOnReport: 'RC-1',
      }),
    ];
    const result = checkRunLog(lines);
    expect(result.violations.filter((v) => v.startsWith('R8'))).toHaveLength(0);
  });

  it('gate 在中间 checkpoint 之后、最后一个 checkpoint 之前 → R8 通过', () => {
    const lines = [
      makeEntry({
        runId: 'r1',
        phase: 5,
        action: 'produce',
        role: 'S',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r2',
        phase: 5,
        action: 'checkpoint',
        role: 'O',
        outcome: 'success',
        acknowledgedDecisions: ['mid'],
      }),
      makeEntry({
        runId: 'r3',
        phase: 5,
        action: 'gate',
        role: 'G',
        outcome: 'success',
        gateExitCode: 0,
        script: 'check-artifact-gate.ts',
      }),
      makeEntry({
        runId: 'r4',
        phase: 5,
        action: 'checkpoint',
        role: 'O',
        outcome: 'success',
        acknowledgedDecisions: ['final'],
      }),
    ];
    const result = checkRunLog(lines);
    expect(result.violations.filter((v) => v.startsWith('R8'))).toHaveLength(0);
  });

  // ==================== R8-4 轨迹顺序链（审计修复 B7）====================

  it('R8-4: V(review) 先于任何 S 变体 → 轨迹顺序倒置违规', () => {
    const lines = [
      makeEntry({
        runId: 'r1',
        phase: 5,
        action: 'review',
        role: 'V',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r2',
        phase: 5,
        action: 'produce',
        role: 'S',
        outcome: 'success',
      }),
    ];
    const result = checkRunLog(lines);
    expect(result.violations.some((v) => /R8.*轨迹顺序倒置.*V\(review\).*S/.test(v))).toBe(true);
  });

  it('R8-4: R3 先于任何 S 变体 → 轨迹顺序倒置违规', () => {
    const lines = [
      makeEntry({
        runId: 'r1',
        phase: 5,
        action: 'r3-completeness',
        role: 'R',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r2',
        phase: 5,
        action: 'produce',
        role: 'S',
        outcome: 'success',
      }),
    ];
    const result = checkRunLog(lines);
    expect(result.violations.some((v) => /R8.*轨迹顺序倒置.*S.*R3/.test(v))).toBe(true);
  });

  it('R8-4: gate 先于 V(review) → 轨迹顺序倒置违规', () => {
    const lines = [
      makeEntry({
        runId: 'r1',
        phase: 5,
        action: 'produce',
        role: 'S',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r2',
        phase: 5,
        action: 'gate',
        role: 'G',
        outcome: 'success',
        gateExitCode: 0,
        script: 'check-artifact-gate.ts',
      }),
      makeEntry({
        runId: 'r3',
        phase: 5,
        action: 'review',
        role: 'V',
        outcome: 'success',
      }),
    ];
    const result = checkRunLog(lines);
    expect(result.violations.some((v) => /R8.*轨迹顺序倒置.*V\(review\).*G/.test(v))).toBe(true);
  });

  it('R8-4: 标准全链 S → R3×3 → V → G → checkpoint 通过', () => {
    const lines = [
      makeEntry({
        runId: 'r1',
        phase: 5,
        action: 'produce',
        role: 'S',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r2',
        phase: 5,
        action: 'r3-completeness',
        role: 'R',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r3',
        phase: 5,
        action: 'r3-reliability',
        role: 'R',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r4',
        phase: 5,
        action: 'r3-security',
        role: 'R',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r5',
        phase: 5,
        action: 'review',
        role: 'V',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r6',
        phase: 5,
        action: 'gate',
        role: 'G',
        outcome: 'success',
        gateExitCode: 0,
        script: 'check-artifact-gate.ts',
      }),
      makeEntry({
        runId: 'r7',
        phase: 5,
        action: 'checkpoint',
        role: 'O',
        outcome: 'success',
        acknowledgedDecisions: ['ok'],
      }),
    ];
    const result = checkRunLog(lines);
    expect(result.violations.filter((v) => v.startsWith('R8'))).toHaveLength(0);
  });

  it('R8-4: 多轮返工轨迹（首轮 V 失败 → R → 复审 → fix → R3 → V → G → checkpoint）通过', () => {
    const lines = [
      makeEntry({
        runId: 'r1',
        phase: 5,
        action: 'produce',
        role: 'S',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r2',
        phase: 5,
        action: 'r3-completeness',
        role: 'R',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r3',
        phase: 5,
        action: 'r3-reliability',
        role: 'R',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r4',
        phase: 5,
        action: 'r3-security',
        role: 'R',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r5',
        phase: 5,
        action: 'review',
        role: 'V',
        outcome: 'fail',
      }),
      makeEntry({
        runId: 'r6',
        phase: 5,
        action: 'rootcause',
        role: 'R',
        outcome: 'success',
        reportId: 'RC-1',
      }),
      makeEntry({
        runId: 'r7',
        phase: 5,
        action: 'review',
        role: 'V',
        outcome: 'success',
        targetKind: 'rootcause',
        target: 'RC-1',
      }),
      makeEntry({
        runId: 'r8',
        phase: 5,
        action: 'fix',
        role: 'S',
        outcome: 'rework',
        basedOnReport: 'RC-1',
      }),
      makeEntry({
        runId: 'r9',
        phase: 5,
        action: 'r3-completeness',
        role: 'R',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r10',
        phase: 5,
        action: 'r3-reliability',
        role: 'R',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r11',
        phase: 5,
        action: 'r3-security',
        role: 'R',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r12',
        phase: 5,
        action: 'review',
        role: 'V',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'r13',
        phase: 5,
        action: 'gate',
        role: 'G',
        outcome: 'success',
        gateExitCode: 0,
        script: 'check-artifact-gate.ts',
      }),
      makeEntry({
        runId: 'r14',
        phase: 5,
        action: 'checkpoint',
        role: 'O',
        outcome: 'success',
        acknowledgedDecisions: ['ok'],
      }),
    ];
    const result = checkRunLog(lines);
    expect(result.violations.filter((v) => v.startsWith('R8'))).toHaveLength(0);
  });
});

// ==================== D8 lifecycle identity / segmentation regressions ====================

describe('D8 lifecycle identity reducer', () => {
  const rootCause = (runId: string, reportId: string, round = 1): RunLogEntry =>
    makeEntry({
      runId,
      phase: 8,
      round,
      action: 'rootcause',
      role: 'R',
      outcome: 'success',
      reportId,
      targetKind: 'rootcause',
      rootCauseCategory: 'checker-contract',
      upstreamDefect: true,
      rollbackRecommended: false,
    });

  const rootCauseReview = (runId: string, reportId: string, round = 1): RunLogEntry =>
    makeEntry({
      runId,
      phase: 8,
      round,
      action: 'review',
      role: 'V',
      outcome: 'success',
      passed: true,
      reportId,
      target: reportId,
      targetKind: 'rootcause',
      basedOnReport: reportId,
      qualityLevel: 'A',
      reworkHints: [],
    });

  const rootCauseGate = (runId: string, reportId: string, round = 1): RunLogEntry =>
    makeEntry({
      runId,
      phase: 8,
      round,
      action: 'gate',
      role: 'G',
      outcome: 'success',
      gateExitCode: 0,
      reportId,
      target: reportId,
      targetKind: 'rootcause',
      basedOnReport: reportId,
      script: 'check-rootcause-report.ts',
    });

  const implementationReview = (
    runId: string,
    reportId: string,
    round = 1,
    target = `implementation-${reportId}`,
  ): RunLogEntry =>
    makeEntry({
      runId,
      phase: 8,
      round,
      action: 'review',
      role: 'V',
      outcome: 'success',
      passed: true,
      reportId,
      target,
      targetKind: 'code',
      implementationTarget: target,
      artifacts: [target],
      qualityLevel: 'A',
      reworkHints: [],
      basedOnReport: reportId,
    });

  const implementationGate = (
    runId: string,
    reportId: string,
    round = 1,
    target = `implementation-${reportId}`,
  ): RunLogEntry =>
    makeEntry({
      runId,
      phase: 8,
      round,
      action: 'gate',
      role: 'G',
      outcome: 'success',
      gateExitCode: 0,
      reportId,
      target,
      targetKind: 'code',
      implementationTarget: target,
      artifacts: [target],
      script: 'check-artifact-gate.ts',
      basedOnReport: reportId,
    });

  const fix = (
    runId: string,
    reportId: string,
    round = 1,
    target = `implementation-${reportId}`,
    fixReportId = reportId,
    outcome: RunLogEntry['outcome'] = 'success',
  ): RunLogEntry =>
    makeEntry({
      runId,
      phase: 8,
      round,
      action: 'fix',
      role: 'S',
      outcome,
      reportId: fixReportId,
      basedOnReport: reportId,
      target: target,
      targetKind: 'code',
      implementationTarget: target,
      artifacts: [target],
    });

  const r3 = (
    runId: string,
    dimension: 'completeness' | 'reliability' | 'security',
    reportId?: string,
    implementationTarget?: string,
  ) =>
    makeEntry({
      runId,
      phase: 8,
      round: 1,
      action: `r3-${dimension}` as RunLogEntry['action'],
      role: 'R',
      outcome: 'success',
      reportId,
      basedOnReport: reportId,
      targetKind: reportId ? 'code' : undefined,
      implementationTarget: reportId ? (implementationTarget ?? `implementation-${reportId}`) : undefined,
      target: reportId ? (implementationTarget ?? `implementation-${reportId}`) : undefined,
      artifacts: reportId ? [implementationTarget ?? `implementation-${reportId}`] : undefined,
    });

  it('does not let a different reportId rootcause V/G or fix satisfy the target lifecycle', () => {
    const entries = [
      rootCause('r-a', 'RC-A'),
      rootCause('r-b', 'RC-B'),
      rootCauseReview('v-b', 'RC-B'),
      rootCauseGate('g-b', 'RC-B'),
      fix('f-a', 'RC-A'),
    ];
    const result = checkRunLog(entries);
    expect(result.violations.some((reason) => /RC-B.*open-approved-lifecycle/.test(reason))).toBe(true);
    expect(result.violations.some((reason) => /RC-A.*pending-pre-approval/.test(reason))).toBe(false);
  });

  it('does not count rootcause V as implementation V', () => {
    const entries = [
      rootCause('r-a', 'RC-A'),
      rootCauseReview('v-a', 'RC-A'),
      rootCauseGate('g-a', 'RC-A'),
      fix('f-a', 'RC-A'),
      rootCauseReview('v-other', 'RC-OTHER', 2),
    ];
    const result = checkRunLog(entries);
    expect(result.violations.some((reason) => /implementation.*V|缺.*implementation|缺.*实现.*V/i.test(reason))).toBe(
      true,
    );
  });

  it('classifies an unapproved report without exact fix as pending-pre-approval', () => {
    const result = checkRunLog([rootCause('r-a', 'RC-A', 2)]);
    expect(result.violations.some((reason) => /RC-A.*无对应 fix|exact-fix|open-approved-lifecycle/.test(reason))).toBe(
      false,
    );
    expect(
      (result as unknown as { diagnostics?: string[] }).diagnostics?.some((d) => /pending-pre-approval/.test(d)),
    ).toBe(true);
  });

  it('reports open-approved-lifecycle when same-identity rootcause V/G passed but exact fix is absent', () => {
    const result = checkRunLog([
      rootCause('r-a', 'RC-A'),
      rootCauseReview('v-a', 'RC-A'),
      rootCauseGate('g-a', 'RC-A'),
    ]);
    expect(result.violations.some((reason) => /open-approved-lifecycle/.test(reason))).toBe(true);
    expect(result.violations.some((reason) => /RC-A.*无对应 fix/.test(reason))).toBe(false);
  });

  it('counts R3 only inside the same fix identity segment', () => {
    const entries = [
      rootCause('r-a', 'RC-A'),
      rootCauseReview('v-a', 'RC-A'),
      rootCauseGate('g-a', 'RC-A'),
      fix('f-a', 'RC-A'),
      r3('r3-a-c', 'completeness', 'RC-A'),
      r3('r3-a-r', 'reliability', 'RC-A'),
      r3('r3-a-s', 'security', 'RC-A'),
      rootCause('r-b', 'RC-B', 2),
      rootCauseReview('v-b-root', 'RC-B', 2),
      rootCauseGate('g-b-root', 'RC-B', 2),
      fix('f-b', 'RC-B', 2),
      implementationReview('v-b', 'RC-B', 2),
    ];
    const result = checkRunLog(entries);
    expect(result.violations.some((reason) => /RC-B|fix.*RC-B|implementation.*RC-B/i.test(reason))).toBe(true);
  });

  it('checks R8 ordering within an identity segment instead of phase-wide first indexes', () => {
    const entries = [
      rootCause('r-a', 'RC-A'),
      rootCauseReview('v-a-rootcause', 'RC-A'),
      rootCauseGate('g-a-rootcause', 'RC-A'),
      fix('f-a', 'RC-A'),
      r3('r3-a-c', 'completeness', 'RC-A'),
      r3('r3-a-r', 'reliability', 'RC-A'),
      r3('r3-a-s', 'security', 'RC-A'),
      implementationReview('v-a-implementation', 'RC-A'),
      implementationGate('g-a-implementation', 'RC-A'),
    ];
    const result = checkRunLog(entries);
    expect(result.violations.some((reason) => /R8.*轨迹顺序倒置/.test(reason))).toBe(false);
    expect(result.violations.some((reason) => /R3 记录校验失败/.test(reason))).toBe(false);
  });

  it('keeps missing implementation V blocking after an exact fix', () => {
    const entries = [
      rootCause('r-a', 'RC-A'),
      rootCauseReview('v-a-rootcause', 'RC-A'),
      rootCauseGate('g-a-rootcause', 'RC-A'),
      fix('f-a', 'RC-A'),
      r3('r3-a-c', 'completeness', 'RC-A'),
      r3('r3-a-r', 'reliability', 'RC-A'),
      r3('r3-a-s', 'security', 'RC-A'),
    ];
    const result = checkRunLog(entries);
    expect(result.passed).toBe(false);
    expect(result.violations.some((reason) => /fix f-a.*缺同身份 implementation V/.test(reason))).toBe(true);
  });

  it('keeps missing implementation G blocking after same-identity R3 and V', () => {
    const entries = [
      rootCause('r-a', 'RC-A'),
      rootCauseReview('v-a-rootcause', 'RC-A'),
      rootCauseGate('g-a-rootcause', 'RC-A'),
      fix('f-a', 'RC-A'),
      r3('r3-a-c', 'completeness', 'RC-A'),
      r3('r3-a-r', 'reliability', 'RC-A'),
      r3('r3-a-s', 'security', 'RC-A'),
      implementationReview('v-a-implementation', 'RC-A'),
    ];
    const result = checkRunLog(entries);
    expect(result.passed).toBe(false);
    expect(result.violations.some((reason) => /fix f-a.*缺同身份 implementation G/.test(reason))).toBe(true);
  });

  it('emits LEGACY_UNSCOPED diagnostics when lifecycle identity fields are missing', () => {
    const entries = [
      makeEntry({
        action: 'fix',
        role: 'S',
        basedOnReport: 'RC-LEGACY',
        artifacts: ['artifact'],
        outcome: 'success',
      }),
      r3('r3-legacy-c', 'completeness'),
      r3('r3-legacy-r', 'reliability'),
      r3('r3-legacy-s', 'security'),
      makeEntry({
        action: 'review',
        role: 'V',
        outcome: 'success',
        targetKind: 'code',
        target: 'artifact',
        passed: true,
      }),
    ];
    const result = checkRunLog(entries);
    expect(
      (result as unknown as { diagnostics?: string[] }).diagnostics?.some((d) => /LEGACY_UNSCOPED|deferred/i.test(d)),
    ).toBe(true);
  });

  it('defers the raw legacy fix without exact identity blocking or lifecycle credit', async () => {
    const entries = (await fs.readFile(identity2FixturePath, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line)) as RunLogEntry[];
    const result = checkRunLog(entries);
    const diagnostics = result.diagnostics ?? [];

    expect(result.passed).toBe(true);
    expect(result.violations.some((reason) => /exact fix identity incomplete/.test(reason))).toBe(false);
    expect(result.violations.some((reason) => /RC-phase8-10-01.*implementation V|同身份 R3/.test(reason))).toBe(false);
    expect(
      diagnostics.some((diagnostic) =>
        /LEGACY_UNSCOPED: fix RC-phase8-10-01-sfix-20260822033128000 identity missing targetKind, implementationTarget; deferred/.test(
          diagnostic,
        ),
      ),
    ).toBe(true);
    expect(diagnostics.some((diagnostic) => /pending-pre-approval: RC-phase8-2-02/.test(diagnostic))).toBe(true);
  });

  it('keeps the committed fixture byte/hash contract independent of raw state', async () => {
    const fixture = await fs.readFile(identity2FixturePath);
    const entries = fixture
      .toString('utf8')
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    checkRunLog(entries);
    expect(entries).toHaveLength(18);
    expect(fixture.length).toBe(14125);
    expect(createHash('sha256').update(fixture).digest('hex')).toBe(
      'e62583426efdde55d45bfa30ba1c5afffe597c2140f41b92400019023815007a',
    );
  });

  it('does not mutate the committed raw fixture JSONL bytes', async () => {
    const before = await fs.readFile(identity2FixturePath);
    checkRunLog(
      before
        .toString('utf8')
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
    );
    const after = await fs.readFile(identity2FixturePath);
    expect(after.equals(before)).toBe(true);
  });

  it('rejects implementation evidence that targets a different implementationTarget', () => {
    const entries = [
      rootCause('r-a', 'RC-A'),
      rootCauseReview('v-root', 'RC-A'),
      rootCauseGate('g-root', 'RC-A'),
      fix('f-a', 'RC-A'),
      r3('r3-c', 'completeness', 'RC-A', 'implementation-B'),
      r3('r3-r', 'reliability', 'RC-A', 'implementation-B'),
      r3('r3-s', 'security', 'RC-A', 'implementation-B'),
      implementationReview('v-impl', 'RC-A', 1, 'implementation-B'),
      implementationGate('g-impl', 'RC-A', 1, 'implementation-B'),
    ];
    const result = checkRunLog(entries);
    expect(result.passed).toBe(false);
    expect(
      result.violations.some((reason) => /same identity|implementationTarget|缺同身份 implementation V/i.test(reason)),
    ).toBe(true);
  });

  it('rejects a rootcause-to-fix relation whose fix reportId differs from the root report', () => {
    const result = checkRunLog([
      rootCause('r-a', 'RC-A'),
      rootCauseReview('v-a', 'RC-A'),
      rootCauseGate('g-a', 'RC-A'),
      fix('f-cross', 'RC-A', 1, 'implementation-A', 'RC-B'),
    ]);
    expect(result.violations.some((reason) => /R7.*RC-A.*exact.*fix|reportId/i.test(reason))).toBe(true);
  });

  it('does not approve a rootcause review with missing identity fields', () => {
    const missingReportIdReview = rootCauseReview('v-a', 'RC-A');
    delete missingReportIdReview.reportId;
    const result = checkRunLog([
      rootCause('r-a', 'RC-A'),
      missingReportIdReview,
      rootCauseGate('g-a', 'RC-A'),
      fix('f-a', 'RC-A'),
      r3('r3-c', 'completeness', 'RC-A'),
      r3('r3-r', 'reliability', 'RC-A'),
      r3('r3-s', 'security', 'RC-A'),
      implementationReview('v-impl', 'RC-A'),
      implementationGate('g-impl', 'RC-A'),
    ]);
    expect(result.violations.some((reason) => /open-approved-lifecycle/.test(reason))).toBe(false);
    expect(result.diagnostics?.some((diagnostic) => /pending-pre-approval/.test(diagnostic))).toBe(true);
  });

  it('does not approve a rootcause gate with missing identity fields', () => {
    const missingReportIdGate = rootCauseGate('g-a', 'RC-A');
    delete missingReportIdGate.reportId;
    const result = checkRunLog([
      rootCause('r-a', 'RC-A'),
      rootCauseReview('v-a', 'RC-A'),
      missingReportIdGate,
      fix('f-a', 'RC-A'),
      r3('r3-c', 'completeness', 'RC-A'),
      r3('r3-r', 'reliability', 'RC-A'),
      r3('r3-s', 'security', 'RC-A'),
      implementationReview('v-impl', 'RC-A'),
      implementationGate('g-impl', 'RC-A'),
    ]);
    expect(result.violations.some((reason) => /open-approved-lifecycle/.test(reason))).toBe(false);
    expect(result.diagnostics?.some((diagnostic) => /pending-pre-approval/.test(diagnostic))).toBe(true);
  });

  it('does not count an R3 record with missing implementation identity', () => {
    const missingTargetR3 = r3('r3-c', 'completeness', 'RC-A');
    delete missingTargetR3.implementationTarget;
    const result = checkRunLog([
      rootCause('r-a', 'RC-A'),
      rootCauseReview('v-a', 'RC-A'),
      rootCauseGate('g-a', 'RC-A'),
      fix('f-a', 'RC-A'),
      missingTargetR3,
      r3('r3-r', 'reliability', 'RC-A'),
      r3('r3-s', 'security', 'RC-A'),
      implementationReview('v-impl', 'RC-A'),
      implementationGate('g-impl', 'RC-A'),
    ]);
    expect(result.passed).toBe(false);
    expect(result.diagnostics?.some((diagnostic) => /LEGACY_UNSCOPED.*implementationTarget/.test(diagnostic))).toBe(
      true,
    );
  });

  it('rejects failed R3 evidence even when all three dimensions are present', () => {
    const failedR3 = {
      ...r3('r3-c', 'completeness', 'RC-A'),
      outcome: 'fail' as const,
    };
    const result = checkRunLog([
      rootCause('r-a', 'RC-A'),
      rootCauseReview('v-a', 'RC-A'),
      rootCauseGate('g-a', 'RC-A'),
      fix('f-a', 'RC-A'),
      failedR3,
      r3('r3-r', 'reliability', 'RC-A'),
      r3('r3-s', 'security', 'RC-A'),
      implementationReview('v-impl', 'RC-A'),
      implementationGate('g-impl', 'RC-A'),
    ]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((reason) => /R3 记录校验失败/.test(reason))).toBe(true);
  });

  it('rejects duplicate R3 dimensions instead of counting a Set of three names', () => {
    const result = checkRunLog([
      rootCause('r-a', 'RC-A'),
      rootCauseReview('v-a', 'RC-A'),
      rootCauseGate('g-a', 'RC-A'),
      fix('f-a', 'RC-A'),
      r3('r3-c1', 'completeness', 'RC-A'),
      r3('r3-c2', 'completeness', 'RC-A'),
      r3('r3-r', 'reliability', 'RC-A'),
      r3('r3-s', 'security', 'RC-A'),
      implementationReview('v-impl', 'RC-A'),
      implementationGate('g-impl', 'RC-A'),
    ]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((reason) => /R3 记录校验失败|duplicate|恰好一条/i.test(reason))).toBe(true);
  });

  it('does not let a missing-identity legacy fix satisfy a strict phase 8 lifecycle', () => {
    const legacyFix = makeEntry({
      runId: 'f-legacy',
      phase: 8,
      round: 1,
      action: 'fix',
      role: 'S',
      outcome: 'success',
      basedOnReport: 'RC-A',
      artifacts: ['implementation-A'],
    });
    const result = checkRunLog([
      rootCause('r-a', 'RC-A'),
      rootCauseReview('v-a', 'RC-A'),
      rootCauseGate('g-a', 'RC-A'),
      legacyFix,
    ]);
    expect(result.passed).toBe(true);
    expect(result.violations.some((reason) => /open-approved-lifecycle|exact.*fix|identity/i.test(reason))).toBe(false);
    expect(result.diagnostics?.some((diagnostic) => /LEGACY_UNSCOPED/.test(diagnostic))).toBe(true);
    expect(result.diagnostics?.some((diagnostic) => /deferred/.test(diagnostic))).toBe(true);
  });

  it('rejects an implementationTarget with the wrong schema type', () => {
    const bad = makeEntry({
      action: 'fix',
      role: 'S',
      outcome: 'success',
      basedOnReport: 'RC-A',
      artifacts: ['implementation-A'],
      targetKind: 'code',
      implementationTarget: 42 as unknown as string,
    });
    const result = checkRunLog([bad]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((reason) => /implementationTarget/.test(reason))).toBe(true);
  });

  it('checks each fix window independently so a later checkpoint cannot hide an earlier inversion', () => {
    const entries = [
      makeEntry({
        runId: 'p',
        phase: 8,
        action: 'produce',
        role: 'S',
        outcome: 'success',
      }),
      rootCause('r-a', 'RC-A'),
      rootCauseReview('v-root', 'RC-A'),
      rootCauseGate('g-root', 'RC-A'),
      fix('f-1', 'RC-A'),
      r3('r3-1-c', 'completeness', 'RC-A'),
      r3('r3-1-r', 'reliability', 'RC-A'),
      r3('r3-1-s', 'security', 'RC-A'),
      implementationGate('g-1', 'RC-A'),
      implementationReview('v-1', 'RC-A'),
      fix('f-2', 'RC-A', 1, 'implementation-A'),
      r3('r3-2-c', 'completeness', 'RC-A'),
      r3('r3-2-r', 'reliability', 'RC-A'),
      r3('r3-2-s', 'security', 'RC-A'),
      implementationReview('v-2', 'RC-A'),
      implementationGate('g-2', 'RC-A'),
      makeEntry({
        runId: 'checkpoint',
        phase: 8,
        action: 'checkpoint',
        role: 'O',
        outcome: 'success',
        acknowledgedDecisions: ['ok'],
      }),
    ];
    const result = checkRunLog(entries);
    expect(result.passed).toBe(false);
    expect(result.violations.some((reason) => /R8.*轨迹顺序倒置/.test(reason))).toBe(true);
  });

  it('keeps a phase-5 legacy segment on legacy rules when phase 8 has a strict segment', () => {
    const entries = [
      rootCause('r-strict', 'RC-STRICT'),
      makeEntry({
        runId: 'r-legacy',
        phase: 5,
        action: 'rootcause',
        role: 'R',
        outcome: 'success',
        reportId: 'RC-LEGACY',
        targetKind: 'rootcause',
        rootCauseCategory: 'process-gap',
        upstreamDefect: false,
        rollbackRecommended: false,
      }),
      makeEntry({
        runId: 'v-legacy-root',
        phase: 5,
        action: 'review',
        role: 'V',
        outcome: 'success',
        targetKind: 'rootcause',
        target: 'RC-LEGACY',
        passed: true,
      }),
      makeEntry({
        runId: 'f-legacy',
        phase: 5,
        action: 'fix',
        role: 'S',
        outcome: 'success',
        basedOnReport: 'RC-LEGACY',
        artifacts: ['implementation-legacy'],
      }),
      makeEntry({
        runId: 'v-legacy-implementation',
        phase: 5,
        action: 'review',
        role: 'V',
        outcome: 'success',
        targetKind: 'code',
        target: 'implementation-legacy',
        passed: true,
      }),
    ];
    const result = checkRunLog(entries);
    expect(result.violations.some((reason) => /R3 记录校验失败.*阶段 5/.test(reason))).toBe(true);
    expect(result.violations.some((reason) => /identity segment/.test(reason))).toBe(false);
  });

  it('does not treat a failed phase-5 fix as a legacy R7 chain head', () => {
    const result = checkRunLog([
      makeEntry({
        runId: 'legacy-root',
        phase: 5,
        action: 'rootcause',
        role: 'R',
        outcome: 'success',
        reportId: 'RC-LEGACY-FAILED',
      }),
      makeEntry({
        runId: 'legacy-root-review',
        phase: 5,
        action: 'review',
        role: 'V',
        outcome: 'success',
        targetKind: 'rootcause',
        target: 'RC-LEGACY-FAILED',
        passed: true,
      }),
      makeEntry({
        runId: 'legacy-failed-fix',
        phase: 5,
        action: 'fix',
        role: 'S',
        outcome: 'fail',
        basedOnReport: 'RC-LEGACY-FAILED',
        artifacts: ['legacy-artifact'],
      }),
    ]);
    expect(result.violations.some((reason) => /R7.*rootcause.*fix/.test(reason))).toBe(true);
    expect(result.diagnostics?.some((diagnostic) => /NON_CREDIT_FIX.*legacy-failed-fix/.test(diagnostic))).toBe(true);
    expect(result.lifecycleStatus).toBe('NOT_CLOSED_NOT_PROVEN');
  });

  it.each(['fail', 'blocked', 'cancelled'] as const)('does not open R3/R8 credit for a %s fix', (outcome) => {
    const entries = [
      rootCause('r-failed', 'RC-FAILED'),
      rootCauseReview('v-failed-root', 'RC-FAILED'),
      rootCauseGate('g-failed-root', 'RC-FAILED'),
      fix('f-failed', 'RC-FAILED', 1, 'implementation-FAILED', 'RC-FAILED', outcome),
      r3('r3-failed-c', 'completeness', 'RC-FAILED'),
      r3('r3-failed-r', 'reliability', 'RC-FAILED'),
      r3('r3-failed-s', 'security', 'RC-FAILED'),
      implementationReview('v-failed-implementation', 'RC-FAILED'),
      implementationGate('g-failed-implementation', 'RC-FAILED'),
    ];
    const result = checkRunLog(entries);
    expect(
      result.diagnostics?.some((diagnostic) =>
        diagnostic.includes(`NON_CREDIT_FIX: fix f-failed outcome=${outcome}; credit deferred`),
      ),
    ).toBe(true);
  });

  it('requires R7 fix target and artifacts to match the exact implementation target', () => {
    const badFix = fix('f-target', 'RC-TARGET', 1, 'implementation-TARGET');
    badFix.target = 'wrong-target';
    badFix.artifacts = ['wrong-target'];
    const result = checkRunLog([rootCause('r-target', 'RC-TARGET'), rootCauseReview('v-target', 'RC-TARGET'), badFix]);
    expect(result.violations.some((reason) => /R7.*exact.*target|R7.*artifacts/.test(reason))).toBe(true);
  });

  it('does not let an unrelated phase-8 legacy segment hide its own bad ordering', () => {
    const strictTarget = 'implementation-STRICT';
    const strictEntries = [
      rootCause('strict-root', 'RC-STRICT'),
      rootCauseReview('strict-root-v', 'RC-STRICT'),
      rootCauseGate('strict-root-g', 'RC-STRICT'),
      fix('strict-fix', 'RC-STRICT', 1, strictTarget),
      r3('strict-r3-c', 'completeness', 'RC-STRICT', strictTarget),
      r3('strict-r3-r', 'reliability', 'RC-STRICT', strictTarget),
      r3('strict-r3-s', 'security', 'RC-STRICT', strictTarget),
      implementationReview('strict-v', 'RC-STRICT', 1, strictTarget),
      implementationGate('strict-g', 'RC-STRICT', 1, strictTarget),
    ];
    const unrelatedLegacy = [
      makeEntry({ runId: 'legacy-produce', phase: 7, action: 'produce', role: 'S', outcome: 'success' }),
      makeEntry({ runId: 'legacy-gate', phase: 7, action: 'gate', role: 'G', outcome: 'success', gateExitCode: 0 }),
      makeEntry({ runId: 'legacy-review', phase: 7, action: 'review', role: 'V', outcome: 'success', passed: true }),
      makeEntry({
        runId: 'legacy-checkpoint',
        phase: 7,
        action: 'checkpoint',
        role: 'O',
        outcome: 'success',
        acknowledgedDecisions: ['legacy-ordering'],
      }),
    ];
    const result = checkRunLog([...strictEntries, ...unrelatedLegacy]);
    expect(result.violations.some((reason) => /R8.*阶段 7.*轨迹顺序倒置/.test(reason))).toBe(true);
  });

  it('keeps an incomplete legacy fix diagnostic-only instead of granting lifecycle credit', () => {
    const legacyFix = makeEntry({
      runId: 'legacy-fix-only',
      phase: 8,
      action: 'fix',
      role: 'S',
      outcome: 'success',
      basedOnReport: 'RC-LEGACY',
      artifacts: ['implementation-LEGACY'],
    });
    const result = checkRunLog([
      legacyFix,
      makeEntry({ runId: 'legacy-r3-c', phase: 8, action: 'r3-completeness', role: 'R', outcome: 'success' }),
      makeEntry({ runId: 'legacy-r3-r', phase: 8, action: 'r3-reliability', role: 'R', outcome: 'success' }),
      makeEntry({ runId: 'legacy-r3-s', phase: 8, action: 'r3-security', role: 'R', outcome: 'success' }),
      makeEntry({ runId: 'legacy-v', phase: 8, action: 'review', role: 'V', outcome: 'success', passed: true }),
    ]);
    expect(result.lifecycleStatus).toBe('NOT_CLOSED_NOT_PROVEN');
    expect(result.diagnostics?.some((diagnostic) => /LEGACY_UNSCOPED.*legacy-fix-only/.test(diagnostic))).toBe(true);
    expect(
      result.diagnostics?.some((diagnostic) => /LEGACY_UNSCOPED.*legacy-fix-only.*credit deferred/.test(diagnostic)),
    ).toBe(true);
  });

  it('does not skip a complete phase-8 legacy segment when an unrelated strict segment shares phase 8', () => {
    const legacyIdentity = {
      phase: 8,
      round: 99,
      reportId: 'RC-LEGACY',
      basedOnReport: 'RC-LEGACY',
      targetKind: 'code' as const,
      implementationTarget: 'implementation-LEGACY',
      target: 'implementation-LEGACY',
      artifacts: ['implementation-LEGACY'],
    };
    const result = checkRunLog([
      rootCause('strict-root', 'RC-STRICT'),
      makeEntry({
        runId: 'legacy-review',
        ...legacyIdentity,
        action: 'review',
        role: 'V',
        outcome: 'success',
        passed: true,
      }),
      makeEntry({
        runId: 'legacy-r3',
        ...legacyIdentity,
        action: 'r3-completeness',
        role: 'R',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'legacy-produce',
        phase: 8,
        action: 'produce',
        role: 'S',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'legacy-gate',
        ...legacyIdentity,
        action: 'gate',
        role: 'G',
        outcome: 'success',
        gateExitCode: 0,
        script: 'check-artifact-gate.ts',
      }),
      makeEntry({
        runId: 'legacy-checkpoint',
        phase: 8,
        action: 'checkpoint',
        role: 'O',
        outcome: 'success',
        acknowledgedDecisions: ['legacy segment'],
      }),
    ]);
    expect(result.violations.some((reason) => /R8.*阶段 8.*轨迹顺序倒置/.test(reason))).toBe(true);
  });

  it('does not let an unrelated strict fix truncate the current identity window', () => {
    const entries = [
      rootCause('root-a', 'RC-A'),
      rootCauseReview('root-a-v', 'RC-A'),
      rootCauseGate('root-a-g', 'RC-A'),
      rootCause('root-b', 'RC-B'),
      rootCauseReview('root-b-v', 'RC-B'),
      rootCauseGate('root-b-g', 'RC-B'),
      fix('fix-a', 'RC-A', 1, 'implementation-A'),
      fix('fix-b', 'RC-B', 1, 'implementation-B'),
      r3('a-c', 'completeness', 'RC-A', 'implementation-A'),
      r3('a-r', 'reliability', 'RC-A', 'implementation-A'),
      r3('a-s', 'security', 'RC-A', 'implementation-A'),
      implementationReview('a-v', 'RC-A', 1, 'implementation-A'),
      implementationGate('a-g', 'RC-A', 1, 'implementation-A'),
      r3('b-c', 'completeness', 'RC-B', 'implementation-B'),
      r3('b-r', 'reliability', 'RC-B', 'implementation-B'),
      r3('b-s', 'security', 'RC-B', 'implementation-B'),
      implementationReview('b-v', 'RC-B', 1, 'implementation-B'),
      implementationGate('b-g', 'RC-B', 1, 'implementation-B'),
    ];
    const result = checkRunLog(entries);
    expect(result.violations.some((reason) => /R3 记录校验失败.*fix fix-a/.test(reason))).toBe(false);
  });

  it('requires a failed implementation review to be followed by a same-segment rootcause path', () => {
    const result = checkRunLog([
      rootCause('root-a', 'RC-A'),
      rootCauseReview('root-a-v', 'RC-A'),
      rootCauseGate('root-a-g', 'RC-A'),
      makeEntry({
        runId: 'implementation-v-fail-a',
        phase: 8,
        round: 1,
        action: 'review',
        role: 'V',
        outcome: 'fail',
        passed: false,
        reworkHints: ['repair implementation A'],
        reportId: 'RC-A',
        basedOnReport: 'RC-A',
        targetKind: 'code',
        target: 'implementation-A',
        implementationTarget: 'implementation-A',
        artifacts: ['implementation-A'],
      }),
      rootCause('root-b', 'RC-B'),
      fix('fix-b', 'RC-B', 1, 'implementation-B'),
    ]);
    expect(result.violations.some((reason) => /R8.*V\(review\) 失败.*直接 S/.test(reason))).toBe(true);
  });

  it('does not let phase-8 identity-incomplete evidence cover a legacy rootcause report', () => {
    const legacyRoot = rootCause('legacy-root', 'RC-LEGACY');
    delete legacyRoot.round;
    const legacyRootReview = rootCauseReview('legacy-root-v', 'RC-LEGACY');
    delete legacyRootReview.round;
    const legacyRootGate = rootCauseGate('legacy-root-g', 'RC-LEGACY');
    delete legacyRootGate.round;
    const result = checkRunLog([
      legacyRoot,
      legacyRootReview,
      legacyRootGate,
      makeEntry({
        runId: 'legacy-identity-missing-fix',
        phase: 8,
        action: 'fix',
        role: 'S',
        outcome: 'success',
        basedOnReport: 'RC-LEGACY',
        artifacts: ['implementation-LEGACY'],
      }),
      makeEntry({
        runId: 'legacy-identity-missing-r3-c',
        phase: 8,
        action: 'r3-completeness',
        role: 'R',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'legacy-identity-missing-r3-r',
        phase: 8,
        action: 'r3-reliability',
        role: 'R',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'legacy-identity-missing-r3-s',
        phase: 8,
        action: 'r3-security',
        role: 'R',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'legacy-identity-missing-v',
        phase: 8,
        action: 'review',
        role: 'V',
        outcome: 'success',
        passed: true,
      }),
    ]);
    expect(result.violations.some((reason) => /RC-LEGACY.*无对应 fix/.test(reason))).toBe(false);
    expect(result.diagnostics?.some((diagnostic) => /LEGACY_UNSCOPED.*deferred/.test(diagnostic))).toBe(true);
  });
});

describe('RunLogEntry schema/type contract', () => {
  it('keeps the TypeScript action union and lifecycle fields aligned with the live schema', async () => {
    const schema = JSON.parse(
      await fs.readFile(path.join(here, '..', '..', 'schemas', 'run-log.schema.json'), 'utf8'),
    ) as { properties: { action: { enum: string[] } } };
    const source = await fs.readFile(path.join(here, '..', 'logic', 'run-log-logic.ts'), 'utf8');
    const actionBody = source.match(/action:\r?\n([\s\S]*?)\r?\n\s+role:/)?.[1] ?? '';
    const typeActions = [...actionBody.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
    expect(typeActions).toEqual(schema.properties.action.enum);
    expect(source).toContain('implementationTarget?: string;');
    expect(source).toMatch(/lifecycleStatus\?: RunLogLifecycleStatus;/);
  });
});

/**
 * 审计修复（audit-gate-closure task 3）：空输入 fail-closed + action-role 配对 blocking。
 */
describe('run-log fail-closed: 空输入', () => {
  it('空数组 → passed=false + NOT_CLOSED_NOT_PROVEN + fail-closed 消息', () => {
    const result = checkRunLog([]);
    expect(result.passed).toBe(false);
    expect(result.lifecycleStatus).toBe('NOT_CLOSED_NOT_PROVEN');
    expect(result.violations.join(' ')).toMatch(/为空/);
    expect(result.violations.join(' ')).toMatch(/fail-closed/);
  });
});

describe('run-log action-role 配对（blocking，logic 层强制）', () => {
  const baseEntry = (action: RunLogEntry['action'], role: RunLogEntry['role'], runId = 'pair-run'): RunLogEntry =>
    makeEntry({ runId, phase: 5, action, role, outcome: 'success', gateExitCode: null });

  const pairingViolation = (result: { violations: string[] }, action: string): string | undefined =>
    result.violations.find(
      (v) => v.startsWith('action-role 配对') && v.includes(`action=${action}`) && v.includes(`runId=`),
    );

  it('r3-* action 由非 R 角色执行 → blocking violation（含 runId/action/role）', () => {
    const result = checkRunLog([baseEntry('r3-completeness', 'V')]);
    expect(result.passed).toBe(false);
    const v = pairingViolation(result, 'r3-completeness');
    expect(v).toBeDefined();
    expect(v).toMatch(/role=R/);
    expect(v).toMatch(/role=V/);
  });

  it('produce/fix 由非 S 角色执行 → blocking violation', () => {
    const produce = checkRunLog([baseEntry('produce', 'A', 'run-produce')]);
    expect(produce.passed).toBe(false);
    expect(pairingViolation(produce, 'produce')).toBeDefined();
    const fix = checkRunLog([baseEntry('fix', 'R', 'run-fix')]);
    expect(fix.passed).toBe(false);
    expect(pairingViolation(fix, 'fix')).toBeDefined();
  });

  it('emergency-fix 由非 S 角色执行 → blocking violation', () => {
    const result = checkRunLog([baseEntry('emergency-fix', 'O', 'run-emergency')]);
    expect(result.passed).toBe(false);
    expect(pairingViolation(result, 'emergency-fix')).toBeDefined();
  });

  it('review 由非 V 角色执行 → blocking violation', () => {
    const result = checkRunLog([baseEntry('review', 'G', 'run-review')]);
    expect(result.passed).toBe(false);
    expect(pairingViolation(result, 'review')).toBeDefined();
  });

  it('gate/tla-gate/graph-gate 由非 G 角色执行 → blocking violation', () => {
    for (const action of ['gate', 'tla-gate', 'graph-gate'] as const) {
      const result = checkRunLog([baseEntry(action, 'S', `run-${action}`)]);
      expect(result.passed).toBe(false);
      expect(pairingViolation(result, action)).toBeDefined();
    }
  });

  it('合法 action-role 配对不产生 action-role violation', () => {
    const entries = [
      baseEntry('produce', 'S', 'p1'),
      baseEntry('review', 'V', 'v1'),
      baseEntry('gate', 'G', 'g1'),
      baseEntry('r3-completeness', 'R', 'r1'),
      baseEntry('r3-reliability', 'R', 'r2'),
      baseEntry('r3-security', 'R', 'r3'),
    ];
    const result = checkRunLog(entries);
    expect(result.violations.some((v) => v.startsWith('action-role 配对'))).toBe(false);
  });
});

/**
 * 审计修复（audit-gate-closure task 3）：schema 对 emergency-fix 强制
 * variant=emergency-fix + blocker；旧记录（无 variant）经 LEGACY 吸收为 diagnostic。
 */
describe('run-log emergency-fix variant 语义', () => {
  it('带 variant=emergency-fix + blocker 的 emergency-fix 记录 schema-valid 且无 [schema] violation', () => {
    const entry: RunLogEntry = makeEntry({
      runId: 'em-valid',
      phase: 5,
      action: 'emergency-fix',
      role: 'S',
      outcome: 'success',
      basedOnReport: 'RC-TEST',
      artifacts: ['test-artifact'],
      variant: 'emergency-fix',
      blocker: '构建阻塞当前阶段推进',
      fixedLocation: 'w-model-dev/scripts/cli/check-run-log.ts',
      fixBasedOn: 'S-self-assessment',
    });
    const result = checkRunLog([entry]);
    expect(result.violations.some((v) => v.startsWith('条目') && v.includes('[schema]'))).toBe(false);
  });

  it('无 variant 的旧 emergency-fix 记录 → LEGACY diagnostic 而非 blocking [schema]', () => {
    const entry: RunLogEntry = makeEntry({
      runId: 'em-legacy',
      phase: 5,
      action: 'emergency-fix',
      role: 'S',
      outcome: 'success',
      basedOnReport: 'RC-TEST',
      artifacts: ['test-artifact'],
    });
    const result = checkRunLog([entry]);
    expect(result.violations.some((v) => v.startsWith('条目') && v.includes('[schema]'))).toBe(false);
    expect(result.diagnostics?.some((d) => /LEGACY_VARIANT/.test(d))).toBe(true);
    expect(result.lifecycleStatus).toBe('NOT_CLOSED_NOT_PROVEN');
  });

  it('带 variant=emergency-fix 但缺 blocker → blocking（声明了紧急通道却无阻塞原因）', () => {
    const entry: RunLogEntry = makeEntry({
      runId: 'em-no-blocker',
      phase: 5,
      action: 'emergency-fix',
      role: 'S',
      outcome: 'success',
      basedOnReport: 'RC-TEST',
      artifacts: ['test-artifact'],
      variant: 'emergency-fix',
    });
    const result = checkRunLog([entry]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => /\[schema\].*blocker/.test(v))).toBe(true);
  });

  it('双 legacy（phase-8 缺 identity + 缺 variant/blocker）→ LEGACY 吸收：非 blocking + NOT_CLOSED + LEGACY_VARIANT/LEGACY_UNSCOPED', () => {
    // review Important-1 修正：两条 legacy 谓词并集吸收——此类行在任务前是
    // identity-legacy 吸收（LEGACY_UNSCOPED、exit 0 + NOT_CLOSED），
    // 不得因 variant 规则引入而翻转为 [schema] blocking。
    const entry: RunLogEntry = makeEntry({
      runId: 'em-double-legacy',
      phase: 8,
      action: 'emergency-fix',
      role: 'S',
      outcome: 'success',
      basedOnReport: 'RC-TEST',
      artifacts: ['test-artifact'],
      // 故意缺 round/reportId/targetKind（identity）+ variant/blocker
    });
    const result = checkRunLog([entry]);
    expect(result.violations.some((v) => v.startsWith('条目') && v.includes('[schema]'))).toBe(false);
    expect(result.passed).toBe(true); // logic 无 blocking → CLI exit 0
    expect(result.lifecycleStatus).toBe('NOT_CLOSED_NOT_PROVEN');
    // LEGACY_VARIANT 明示缺 variant/blocker（含 identity 缺失字段清单）
    const variantDiag = result.diagnostics?.find((d) => /LEGACY_VARIANT/.test(d));
    expect(variantDiag).toBeDefined();
    expect(variantDiag).toMatch(/variant/);
    // identity 缺失部分由 LEGACY_UNSCOPED 循环补充说明
    expect(result.diagnostics?.some((d) => /LEGACY_UNSCOPED/.test(d) && d.includes('identity missing'))).toBe(true);
  });

  it('已声明 variant=emergency-fix + blocker 但缺 identity（phase-8）→ 仍按 identity-legacy 吸收，不翻转 blocking', () => {
    const entry: RunLogEntry = makeEntry({
      runId: 'em-declared-no-identity',
      phase: 8,
      action: 'emergency-fix',
      role: 'S',
      outcome: 'success',
      basedOnReport: 'RC-TEST',
      artifacts: ['test-artifact'],
      variant: 'emergency-fix',
      blocker: '构建失败阻塞当前阶段推进',
      // 故意缺 round/reportId/targetKind
    });
    const result = checkRunLog([entry]);
    expect(result.violations.some((v) => v.startsWith('条目') && v.includes('[schema]'))).toBe(false);
    expect(result.passed).toBe(true);
    expect(result.lifecycleStatus).toBe('NOT_CLOSED_NOT_PROVEN');
    expect(result.diagnostics?.some((d) => /LEGACY_UNSCOPED/.test(d) && d.includes('identity missing'))).toBe(true);
    expect(result.diagnostics?.some((d) => /LEGACY_VARIANT/.test(d))).toBe(false);
  });

  it('已声明 variant 却缺 blocker 仍 blocking（fail-closed 方向不变）', () => {
    const entry: RunLogEntry = makeEntry({
      runId: 'em-declared-no-blocker2',
      phase: 8,
      action: 'emergency-fix',
      role: 'S',
      outcome: 'success',
      basedOnReport: 'RC-TEST',
      artifacts: ['test-artifact'],
      variant: 'emergency-fix',
      round: 1,
      reportId: 'RC-TEST',
      targetKind: 'code',
      implementationTarget: 'test-artifact',
      target: 'test-artifact',
    });
    const result = checkRunLog([entry]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => /\[schema\].*blocker/.test(v))).toBe(true);
  });
});

/**
 * review2-fixes task 3（A5）：LEGACY_VARIANT 吸收以 LEGACY_VARIANT_CUTOFF
 * （2026-09-01T00:00:00Z，variant 规则随 42.2.1 发布）为分界——此后写入的
 * emergency-fix 缺 variant 属真实不一致，blocking [schema]，不再按 legacy 吸收。
 */
describe('run-log LEGACY_VARIANT cutoff 分界', () => {
  const baseEmergencyFix: Partial<RunLogEntry> = {
    phase: 5,
    action: 'emergency-fix',
    role: 'S',
    outcome: 'success',
    basedOnReport: 'RC-TEST',
    artifacts: ['test-artifact'],
    // 缺 variant/blocker（两条用例同形，仅 timestamp 跨 cutoff）
  };

  it('blocks post-cutoff emergency-fix missing variant instead of absorbing as LEGACY_VARIANT', () => {
    const entry: RunLogEntry = makeEntry({
      ...baseEmergencyFix,
      runId: 'em-post-cutoff',
      timestamp: '2026-09-02T00:00:00.000Z',
    });
    const result = checkRunLog([entry]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.startsWith('条目') && v.includes('[schema]'))).toBe(true);
    expect(result.diagnostics?.some((d) => /LEGACY_VARIANT/.test(d)) ?? false).toBe(false);
  });

  it('still absorbs pre-cutoff undeclared-variant emergency-fix as LEGACY_VARIANT', () => {
    const entry: RunLogEntry = makeEntry({
      ...baseEmergencyFix,
      runId: 'em-pre-cutoff',
      timestamp: '2026-08-31T00:00:00.000Z',
    });
    const result = checkRunLog([entry]);
    expect(result.violations.some((v) => v.startsWith('条目') && v.includes('[schema]'))).toBe(false);
    expect(result.diagnostics?.some((d) => /LEGACY_VARIANT/.test(d))).toBe(true);
    expect(result.lifecycleStatus).toBe('NOT_CLOSED_NOT_PROVEN');
  });
});

/**
 * audit-fixes task 4（I-6 / F-G4-01）：review 族（review/iceberg-review）passed=false
 * 强制非空 reworkHints。schema allOf 强制 + logic 按 LEGACY_VARIANT_CUTOFF
 * （2026-09-01T00:00:00Z，与 variant 规则同窗）分界：cutoff 前失败 review 旧行按
 * LEGACY_REWORK_HINTS 非阻断 diagnostic 吸收，cutoff 后属真实不一致 blocking。
 */
describe('run-log reworkHints 强制（LEGACY_REWORK_HINTS cutoff 分界）', () => {
  const failedReview = (overrides: Partial<RunLogEntry>): RunLogEntry =>
    makeEntry({ runId: 'review-fail', phase: 5, action: 'review', role: 'V', outcome: 'fail', ...overrides });

  it('cutoff 后 review passed=false 无 reworkHints → blocking', () => {
    const result = checkRunLog([failedReview({ timestamp: '2026-09-02T00:00:00.000Z', passed: false })]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => /\[rework-hints\].*passed=false.*reworkHints/.test(v))).toBe(true);
    expect(result.diagnostics?.some((d) => /LEGACY_REWORK_HINTS/.test(d)) ?? false).toBe(false);
  });

  it('cutoff 前 review passed=false 无 reworkHints → LEGACY_REWORK_HINTS 诊断放行', () => {
    const result = checkRunLog([failedReview({ timestamp: '2026-08-01T00:00:00.000Z', passed: false })]);
    expect(result.passed).toBe(true);
    expect(result.violations.some((v) => v.includes('[schema]') || v.includes('[rework-hints]'))).toBe(false);
    expect(result.diagnostics?.some((d) => /LEGACY_REWORK_HINTS/.test(d))).toBe(true);
    expect(result.lifecycleStatus).toBe('NOT_CLOSED_NOT_PROVEN');
  });

  it('passed=false 且 reworkHints 非空 → 正常（无该规则违规）', () => {
    const result = checkRunLog([
      failedReview({
        timestamp: '2026-09-02T00:00:00.000Z',
        passed: false,
        reworkHints: ['补齐 X 模块错误分支的测试'],
      }),
    ]);
    expect(result.violations.some((v) => /\[rework-hints\]|\[schema\].*reworkHints/.test(v))).toBe(false);
  });
});
