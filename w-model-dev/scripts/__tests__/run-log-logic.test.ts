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
  RUN_LOG_CLOSURE_SCRIPTS,
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
  it('R1 扩展字段负例（3 态：缺 reportId/rootCauseCategory/basedOnReport）', async () => {
    const lines = await loadJsonl('rootcause-valid.jsonl');
    const cases: {
      label: string;
      mutate: (l: RunLogEntry) => RunLogEntry;
      checkPassed: boolean;
      scope: 'violations' | 'diagnostics';
      marker: RegExp;
    }[] = [
      {
        label: 'rootcause 动作缺 reportId',
        mutate: (l) => (l.action === 'rootcause' ? { ...l, reportId: undefined } : l),
        checkPassed: true,
        scope: 'violations',
        marker: /\[schema\].*reportId/,
      },
      {
        label: 'rootcause 动作缺 rootCauseCategory',
        mutate: (l) => (l.action === 'rootcause' ? { ...l, rootCauseCategory: undefined } : l),
        checkPassed: true,
        scope: 'violations',
        marker: /\[schema\].*rootCauseCategory/,
      },
      {
        label: 'fix 动作缺 basedOnReport',
        mutate: (l) => (l.action === 'fix' ? { ...l, basedOnReport: undefined } : l),
        checkPassed: true,
        scope: 'violations',
        marker: /\[schema\].*basedOnReport/,
      },
    ];
    for (const c of cases) {
      const bad = lines.map(c.mutate) as RunLogEntry[];
      const result = checkRunLog(bad);
      if (c.checkPassed) {
        expect(result.passed, `${c.label} 应 fail`).toBe(false);
      }
      const hits = c.scope === 'violations' ? result.violations : (result.diagnostics ?? []);
      expect(
        hits.some((r) => c.marker.test(r)),
        `${c.label} 应命中 ${c.marker}`,
      ).toBe(true);
    }
  });

  it('完整 rootcause-valid 样本通过所有扩展校验', async () => {
    const lines = await loadJsonl('rootcause-valid.jsonl');
    const result = checkRunLog(lines);
    expect(result.passed).toBe(true);
  });
});

describe('run-log R3 扩展：R + S-fix 一一对应 + V 复审', () => {
  it('R3 缺失对照（2 态：缺 S-fix / 缺 V 复审 rootcause）', async () => {
    const cases = [
      {
        label: '有 R 但缺 S-fix',
        fixture: 'rootcause-missing-fix.jsonl',
        marker: /R3.*rootcause.*fix.*一一对应|basedOnReport.*缺失/,
      },
      {
        label: '有 R 但缺 V 复审 rootcause',
        fixture: 'rootcause-missing-review.jsonl',
        marker: /R3.*V 复审 rootcause.*≠.*R 记录数/,
      },
    ] as const;
    for (const c of cases) {
      const lines = await loadJsonl(c.fixture);
      const result = checkRunLog(lines);
      expect(result.passed, `${c.label} 应 fail`).toBe(false);
      expect(
        result.violations.some((r) => c.marker.test(r)),
        `${c.label} 应命中 ${c.marker}`,
      ).toBe(true);
    }
  });
});

describe('run-log R7 扩展：返工路径时序', () => {
  it('R7 时序负例（2 态：缺 fix / 缺 V 复审）', async () => {
    const cases = [
      { label: '有 R 但缺 S-fix', fixture: 'rootcause-missing-fix.jsonl', marker: /R7.*rootcause.*fix/ },
      {
        label: '有 R 但缺 V 复审 rootcause',
        fixture: 'rootcause-missing-review.jsonl',
        marker: /R7.*rootcause.*review.*targetKind=rootcause/,
      },
    ] as const;
    for (const c of cases) {
      const lines = await loadJsonl(c.fixture);
      const result = checkRunLog(lines);
      expect(
        result.violations.some((r) => c.marker.test(r)),
        `${c.label} R7 应命中 ${c.marker}`,
      ).toBe(true);
    }
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

describe('run-log R8 扩展：S-fix 后须 R3（批次 6 A15：emergency-fix 死词已删除，紧急通道以 fix 留痕）', () => {
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

  it('携带已删除 action 死词 emergency-fix → schema enum 拒绝（批次 6 A15，R8 不再单独可达）', () => {
    const deadWordEntry = {
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
      blocker: '构建失败阻塞当前阶段推进',
    } as unknown as RunLogEntry;
    const entries: RunLogEntry[] = [
      deadWordEntry,
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
    expect(result.violations.some((v) => v.startsWith('条目') && v.includes('[schema]'))).toBe(true);
    expect(
      result.violations.some((v) => /R3 记录校验失败/.test(v)),
      '死词记录在 schema 层即被拒，R8 不再单独可达',
    ).toBe(false);
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

  it('S-fix（+ blocker 紧急通道审计说明）后有 3 条 R3 再 V 应通过 R8（批次 6 A15：emergency-fix 动作已删除，紧急通道以 fix+blocker 留痕）', () => {
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

  it('extractExitCode 从根 JSON 提取 exitCode（3 态：0/1/2）', () => {
    for (const exitCode of [0, 1, 2] as const) {
      expect(extractExitCode(rootPayload(exitCode)), `exitCode=${exitCode}`).toBe(exitCode);
    }
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
  it('extractExitCode 从四类摘要标记提取 exitCode（GATE/VERIFIER/ERROR/STATE_MACHINE）', () => {
    const cases = [
      ['GATE_JSON', 'some log\nGATE_JSON {"passed":true,"exitCode":0}\nend', 0],
      ['VERIFIER_JSON', 'VERIFIER_JSON {"passed":false,"exitCode":1}', 1],
      [
        'ERROR_JSON',
        '✗ [FILE_NOT_FOUND] 文件不存在\nERROR_JSON {"category":"FILE_NOT_FOUND","message":"文件不存在","exitCode":2,"file":"C:\\\\proj\\\\.w-model\\\\project.json"}',
        2,
      ],
      ['STATE_MACHINE_JSON', 'STATE_MACHINE_JSON {"passed":true,"exitCode":0}', 0],
    ] as const;
    for (const [marker, content, expected] of cases) {
      expect(extractExitCode(content), `${marker} 摘要行`).toBe(expected);
    }
  });

  it('extractExitCode 边界负例（4 态：无匹配/畸形跳过/非数值/无 exitCode fallthrough）', () => {
    const cases = [
      ['无匹配', 'no json here', undefined],
      ['畸形 JSON 摘要行跳过继续扫描后续标记', 'GATE_JSON {broken json\nVERIFIER_JSON {"exitCode":1}', 1],
      ['exitCode 非 number', 'GATE_JSON {"passed":true,"exitCode":"0"}', undefined],
      [
        '首个标记无 exitCode 继续扫后续标记（fallthrough）',
        'GRAPH_JSON {"passed":true}\nMATURITY_JSON {"exitCode":1}',
        1,
      ],
    ] as const;
    for (const [label, content, expected] of cases) {
      expect(extractExitCode(content), `${label} → ${expected === undefined ? 'undefined' : String(expected)}`).toBe(
        expected,
      );
    }
  });

  it('buildGateLogKeys 归一化（4 态：正斜杠/反斜杠/空 cwd/cwd 外）', () => {
    const cases: {
      label: string;
      fileAbs: string;
      cwd: string;
      mustContain: string[];
      mustNotContain: string[];
      exactLength?: number;
    }[] = [
      {
        label: '正斜杠绝对路径 + cwd → basename/绝对/相对/反斜杠归一化 4 类 key',
        fileAbs: 'C:/proj/.w-model/gate-logs/phase5-check-a.log',
        cwd: 'C:/proj',
        mustContain: [
          'phase5-check-a.log',
          'C:/proj/.w-model/gate-logs/phase5-check-a.log',
          '.w-model/gate-logs/phase5-check-a.log',
          'C:\\proj\\.w-model\\gate-logs\\phase5-check-a.log',
        ],
        mustNotContain: [],
      },
      {
        label: '反斜杠路径输入（Windows 兼容归一化）',
        fileAbs: 'C:\\proj\\.w-model\\gate-logs\\phase1-check-tla.log',
        cwd: 'C:\\proj',
        mustContain: [
          'phase1-check-tla.log',
          'C:/proj/.w-model/gate-logs/phase1-check-tla.log',
          '.w-model/gate-logs/phase1-check-tla.log',
        ],
        mustNotContain: [],
      },
      {
        label: 'cwd 为空 → 退化为 basename + 绝对路径（无相对 key）',
        fileAbs: 'C:/proj/a.log',
        cwd: '',
        mustContain: ['a.log', 'C:/proj/a.log'],
        mustNotContain: ['proj/a.log'],
      },
      {
        label: 'cwd 外文件 → 无相对 key，去重后 3 key',
        fileAbs: 'D:/other/x.log',
        cwd: 'C:/proj',
        mustContain: ['x.log', 'D:/other/x.log'],
        mustNotContain: ['other/x.log'],
        exactLength: 3,
      },
    ];
    for (const c of cases) {
      const keys = buildGateLogKeys(c.fileAbs, c.cwd);
      for (const key of c.mustContain) {
        expect(keys, `${c.label} 应含 ${key}`).toContain(key);
      }
      for (const key of c.mustNotContain) {
        expect(keys, `${c.label} 不应含 ${key}`).not.toContain(key);
      }
      if (c.exactLength !== undefined) {
        // 双向归一化 + 去重后应为 3 个 key（basename / 绝对正斜杠 / 绝对反斜杠）
        expect(keys.length, `${c.label} 去重后 key 数`).toBe(c.exactLength);
      }
    }
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
  if (String(merged.action) === 'fix') {
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

describe('run-log R2 扩展：estimated=true tokens 违规化（约束 #4，43.0.0 A5）', () => {
  it('A5：estimated=true 的 tokens 记录 → R2 blocking（消息含 estimated 与约束 #4 指引）', () => {
    const log = [makeEntry({ runId: 'est-1', tokens: 1200, estimated: true })];
    const result = checkRunLog(log);
    expect(result.passed).toBe(false);
    const hit = result.violations.find((v) => v.includes('estimated'));
    expect(hit, '应产出含 estimated 的违规').toBeDefined();
    expect(hit).toContain('R2');
    expect(hit).toContain('约束 #4');
  });

  it('estimated=false 不受影响（只加违规判定，不改 Σtokens 求和口径）', () => {
    const result = checkRunLog([makeEntry({ runId: 'est-0', tokens: 1200, estimated: false })]);
    expect(result.passed).toBe(true);
    expect(result.violations.some((v) => v.includes('estimated'))).toBe(false);
  });
});

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

  it('phase-8 行缺 lifecycle identity → [schema] blocking（不再诊断绕行）', () => {
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
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('[schema]'))).toBe(true);
    expect(result.diagnostics, '诊断绕行不复存在').toBeUndefined();
  });

  it('raw 旧形态 fixture（phase-8 缺 identity）→ 一律 [schema] blocking（毁弃存量数据）', async () => {
    const entries = (await fs.readFile(identity2FixturePath, 'utf8'))
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line)) as RunLogEntry[];
    const result = checkRunLog(entries);

    expect(result.passed, '旧形态 raw 记录不再吸收放行').toBe(false);
    expect(result.violations.some((v) => v.includes('[schema]'))).toBe(true);
    // 曾以 LEGACY 诊断吸收的 RC-phase8-10-01-sfix 行（缺 targetKind/implementationTarget）
    // 现按 schema additionalProperties/required 拦截
    expect(
      result.violations.some((v) => v.includes('[schema]') && (v.includes('targetKind') || v.includes('round'))),
      '缺 identity 的 phase-8 行被 schema 拦截',
    ).toBe(true);
    expect(result.diagnostics, 'LEGACY 吸收诊断不复存在').toBeUndefined();
  });

  it('keeps the committed fixture byte/hash contract independent of raw state', async () => {
    const fixture = await fs.readFile(identity2FixturePath);
    // 字节/哈希契约必须先归一化行尾再比对：core.autocrlf=true 的 Windows 检出会把索引里的 LF 展开成 CRLF
    // （14226 → 14244 字节），Linux/WSL 检出则是 LF——把落盘形态写进常量会让契约只在某台机器的字节形态下成立
    // （本用例原先记录的是「17 CRLF + 末行无换行」= 14243，任何一次干净检出都对不上，只有原作者的工作区恰好相符）。
    // 归一化到 git 存储形态（LF）后，跨平台、跨 checkout 比对的是**内容**，内容漂移仍会被下面的长度 + sha256 抓到。
    const canonical = Buffer.from(fixture.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
    const entries = canonical
      .toString('utf8')
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    checkRunLog(entries);
    expect(entries).toHaveLength(18);
    expect(canonical.length).toBe(14226);
    expect(createHash('sha256').update(canonical).digest('hex')).toBe(
      '17037cb7f71bc634fe13f9746269b374370f6f7297a4a1b58323cc69efbf7c02',
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
    expect(result.violations.some((v) => v.includes('[schema]') && v.includes('implementationTarget'))).toBe(true);
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

  it('phase-8 fix 缺 identity → [schema] blocking，不得满足严格 lifecycle（不再 diagnostic-only）', () => {
    const legacyFix = makeEntry({
      runId: 'f-legacy',
      phase: 8,
      round: 1,
      action: 'fix',
      role: 'S',
      outcome: 'success',
      basedOnReport: 'RC-A',
      artifacts: ['implementation-A'],
      revertEvidence: { command: 'npm run reproduce-failure' },
    });
    const result = checkRunLog([
      rootCause('r-a', 'RC-A'),
      rootCauseReview('v-a', 'RC-A'),
      rootCauseGate('g-a', 'RC-A'),
      legacyFix,
    ]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('[schema]') && v.includes('targetKind'))).toBe(true);
    expect(result.diagnostics, '诊断绕行不复存在').toBeUndefined();
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

  it('does not open R3/R8 credit for a non-success fix（3 态：fail/blocked/cancelled）', () => {
    for (const outcome of ['fail', 'blocked', 'cancelled'] as const) {
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
        `outcome=${outcome}`,
      ).toBe(true);
    }
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
      makeEntry({
        runId: 'legacy-produce',
        phase: 7,
        action: 'produce',
        role: 'S',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'legacy-gate',
        phase: 7,
        action: 'gate',
        role: 'G',
        outcome: 'success',
        gateExitCode: 0,
      }),
      makeEntry({
        runId: 'legacy-review',
        phase: 7,
        action: 'review',
        role: 'V',
        outcome: 'success',
        passed: true,
      }),
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

  it('phase-8 缺 identity 的 fix 与 r3 行 → [schema] blocking（不再 diagnostic-only 绕行）', () => {
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
      makeEntry({
        runId: 'legacy-r3-c',
        phase: 8,
        action: 'r3-completeness',
        role: 'R',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'legacy-r3-r',
        phase: 8,
        action: 'r3-reliability',
        role: 'R',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'legacy-r3-s',
        phase: 8,
        action: 'r3-security',
        role: 'R',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'legacy-v',
        phase: 8,
        action: 'review',
        role: 'V',
        outcome: 'success',
        passed: true,
      }),
    ]);
    expect(result.passed, '旧形态 phase-8 行不再诊断放行').toBe(false);
    expect(result.violations.some((v) => v.includes('[schema]'))).toBe(true);
    expect(result.lifecycleStatus).toBe('NOT_CLOSED_NOT_PROVEN');
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

  it('phase-8 identity-incomplete 证据不再覆盖 legacy rootcause 报告（整体 [schema] blocking）', () => {
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
    // 缺 round 的 phase-8 行全部被 schema 拦截：不进入 lifecycle 聚合，
    // 既无「RC-LEGACY 无对应 fix」误报，也无 LEGACY 诊断绕行。
    expect(result.violations.some((reason) => /RC-LEGACY.*无对应 fix/.test(reason))).toBe(false);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('[schema]'))).toBe(true);
    expect(result.diagnostics, 'LEGACY 吸收诊断不复存在').toBeUndefined();
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
    makeEntry({
      runId,
      phase: 5,
      action,
      role,
      outcome: 'success',
      gateExitCode: null,
    });

  const pairingViolation = (result: { violations: string[] }, action: string): string | undefined =>
    result.violations.find(
      (v) => v.startsWith('action-role 配对') && v.includes(`action=${action}`) && v.includes(`runId=`),
    );

  it('非法 action-role 配对 → blocking violation（r3/produce/fix/review/gate 族；批次 6 A15：emergency-fix 死词已删除，原第 4 态移除）', () => {
    const cases: {
      label: string;
      action: RunLogEntry['action'];
      role: RunLogEntry['role'];
      runId: string;
      messageMarkers?: RegExp[];
    }[] = [
      {
        label: 'r3-completeness 由 V 执行',
        action: 'r3-completeness',
        role: 'V',
        runId: 'pair-run',
        messageMarkers: [/role=R/, /role=V/],
      },
      { label: 'produce 由 A 执行', action: 'produce', role: 'A', runId: 'run-produce' },
      { label: 'fix 由 R 执行', action: 'fix', role: 'R', runId: 'run-fix' },
      { label: 'review 由 G 执行', action: 'review', role: 'G', runId: 'run-review' },
      { label: 'gate 由 S 执行', action: 'gate', role: 'S', runId: 'run-gate' },
      { label: 'tla-gate 由 S 执行', action: 'tla-gate', role: 'S', runId: 'run-tla-gate' },
      { label: 'graph-gate 由 S 执行', action: 'graph-gate', role: 'S', runId: 'run-graph-gate' },
      {
        label: 'perspective 由 S 执行（阶段 1-4 多角色机制，须 role=A）',
        action: 'perspective',
        role: 'S',
        runId: 'run-perspective',
      },
      {
        label: 'consensus 由 V 执行（A-lead 汇总，须 role=A）',
        action: 'consensus',
        role: 'V',
        runId: 'run-consensus',
      },
    ];
    for (const c of cases) {
      const result = checkRunLog([baseEntry(c.action, c.role, c.runId)]);
      expect(result.passed, `${c.label} 应 blocking`).toBe(false);
      const v = pairingViolation(result, c.action);
      expect(v, `${c.label} 应有 action-role 配对 violation`).toBeDefined();
      for (const marker of c.messageMarkers ?? []) {
        expect(v, `${c.label} 消息应含 ${marker}`).toMatch(marker);
      }
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

  it('plan_propose（S）与新增 event-route（O）通过 schema 校验且不触发新违规（批次 6 A15：plan_task/plan_review 死词已删除）', () => {
    const entries = [baseEntry('plan_propose', 'S', 'plan-p1'), baseEntry('event-route', 'O', 'event-r1')];
    const result = checkRunLog(entries);
    expect(result.violations.some((v) => v.includes('[schema]'))).toBe(false);
    expect(result.violations.some((v) => v.startsWith('action-role 配对'))).toBe(false);
  });

  it('携带已删除 action 死词（plan_task/plan_review）→ schema enum 拒绝（批次 6 A15 负例）', () => {
    for (const dead of ['plan_task', 'plan_review'] as const) {
      const bad = {
        ...baseEntry('produce', 'S', `dead-${dead}`),
        action: dead,
      } as unknown as RunLogEntry;
      const result = checkRunLog([bad]);
      expect(result.passed, `${dead} 应 schema 拒绝`).toBe(false);
      expect(
        result.violations.some((v) => v.includes('[schema]')),
        `${dead} 应报 [schema]`,
      ).toBe(true);
    }
  });

  it('perspective/consensus 由 A 执行 + persona 字段通过 schema 校验且无配对违规（阶段 1-4 多角色机制，task 3）', () => {
    const entries = [
      { ...baseEntry('perspective', 'A', 'mr-p1'), persona: 'product-requirements-analyst' },
      { ...baseEntry('consensus', 'A', 'mr-c1'), persona: 'A-lead' },
      { ...baseEntry('consensus', 'A', 'mr-c2'), persona: '' }, // consensus 允许 persona 留空（以 role=A 判定）
    ];
    const result = checkRunLog(entries);
    expect(result.violations.some((v) => v.includes('[schema]'))).toBe(false);
    expect(result.violations.some((v) => v.startsWith('action-role 配对'))).toBe(false);
  });

  it('schema additionalProperties:false 不回归：persona 合法化后未知字段仍被拒绝（bad-additional-props）', () => {
    const bad = { ...baseEntry('perspective', 'A', 'mr-typo'), persna: 'typo-field' } as unknown as RunLogEntry;
    const result = checkRunLog([bad]);
    expect(result.passed).toBe(false);
    expect(result.violations.join(' ')).toMatch(/\[schema\]/);
  });
});

/**
 * 批次 6 A15：emergency-fix 动作已从 18 值词表删除——紧急通道以 `fix` + `blocker`
 * （可选审计说明）留痕；携带已删除 action 死词（emergency-fix / rework 等 15 死词）
 * 或已删除 `variant` 字段的记录一律 [schema] blocking（毁弃存量数据，无吸收绕行）。
 */
describe('run-log fix 紧急通道审计字段与已删除 action 死词（批次 6 A15）', () => {
  it('fix + blocker/fixedLocation/fixBasedOn 审计说明 → schema-valid 且无 [schema] violation', () => {
    const entry: RunLogEntry = makeEntry({
      runId: 'em-valid',
      phase: 5,
      action: 'fix',
      role: 'S',
      outcome: 'success',
      basedOnReport: 'RC-TEST',
      artifacts: ['test-artifact'],
      revertEvidence: { command: 'npm run reproduce-failure' },
      blocker: '构建阻塞当前阶段推进',
      fixedLocation: 'w-model-dev/scripts/cli/check-run-log.ts',
      fixBasedOn: 'S-self-assessment',
    });
    const result = checkRunLog([entry]);
    expect(result.violations.some((v) => v.startsWith('条目') && v.includes('[schema]'))).toBe(false);
  });

  it('携带已删除 action 死词（emergency-fix / rework）→ schema enum 拒绝 [schema] blocking', () => {
    const deadWordCases = ['emergency-fix', 'rework'];
    for (const dead of deadWordCases) {
      const entry = {
        ...makeEntry({
          runId: `dead-${dead}`,
          phase: 5,
          role: 'S',
          outcome: 'success',
          basedOnReport: 'RC-TEST',
          artifacts: ['test-artifact'],
        }),
        action: dead,
      } as unknown as RunLogEntry;
      const result = checkRunLog([entry]);
      expect(result.passed, `${dead} 应 schema 拒绝`).toBe(false);
      expect(
        result.violations.some((v) => v.startsWith('条目') && v.includes('[schema]')),
        `${dead} 应报 [schema]`,
      ).toBe(true);
      expect(result.diagnostics, `${dead} 无吸收诊断`).toBeUndefined();
    }
  });

  it('fix 携带 variant 字段 → schema additionalProperties 拒绝（字段已删除）', () => {
    const entry = {
      ...makeEntry({
        runId: 'em-with-variant',
        phase: 5,
        action: 'fix',
        role: 'S',
        outcome: 'success',
        basedOnReport: 'RC-TEST',
        artifacts: ['test-artifact'],
        blocker: '构建失败阻塞当前阶段推进',
      }),
      variant: 'emergency-fix',
    } as unknown as RunLogEntry;
    const result = checkRunLog([entry]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('[schema]') && v.includes('variant'))).toBe(true);
  });
});

/**
 * 批次 6 A15：已删除 action 死词无历史时间分界——任何时间戳写入的死词记录
 * 一律 [schema] blocking（enum 拒绝，无吸收绕行）。
 */
describe('run-log 已删除 action 死词无历史时间分界（批次 6 A15）', () => {
  it('emergency-fix 死词：任意时间戳一律 [schema] blocking（2 态：2026-09-02 / 2026-08-31）', () => {
    const cases = [
      { label: '2026-09-02 死词记录', runId: 'em-post-cutoff', timestamp: '2026-09-02T00:00:00.000Z' },
      { label: '2026-08-31 死词记录', runId: 'em-pre-cutoff', timestamp: '2026-08-31T00:00:00.000Z' },
    ];
    for (const c of cases) {
      const entry = {
        ...makeEntry({
          runId: c.runId,
          timestamp: c.timestamp,
          phase: 5,
          role: 'S',
          outcome: 'success',
          basedOnReport: 'RC-TEST',
          artifacts: ['test-artifact'],
        }),
        action: 'emergency-fix',
      } as unknown as RunLogEntry;
      const result = checkRunLog([entry]);
      expect(
        result.violations.some((v) => v.startsWith('条目') && v.includes('[schema]')),
        `${c.label} [schema] blocking`,
      ).toBe(true);
      expect(result.passed, `${c.label} 应 blocking`).toBe(false);
      expect(result.diagnostics, `${c.label} 无吸收诊断`).toBeUndefined();
    }
  });
});

/**
 * audit-fixes task 4（I-6 / F-G4-01）：review 动作 passed=false
 * 强制非空 reworkHints（批次 6 A15：原 review/iceberg-review 两值族中 iceberg-review 死词已删除）。schema allOf 强制 + logic `[rework-hints]` blocking（分类命名：
 * 仅当全部 schema 错误都由 reworkHints 缺失引起时用该前缀）。批次 6 A3/C14：历史
 * cutoff 吸收路径已删除——任何时间戳写入的失败 review 旧行一律 blocking，无诊断绕行。
 */
describe('run-log reworkHints 强制（无历史吸收）', () => {
  const failedReview = (overrides: Partial<RunLogEntry>): RunLogEntry =>
    makeEntry({
      runId: 'review-fail',
      phase: 5,
      action: 'review',
      role: 'V',
      outcome: 'fail',
      ...overrides,
    });

  it('passed=false 缺非空 reworkHints：任意时间戳一律 blocking（2 态）', () => {
    const cases = [
      { label: '2026-09-02 review passed=false 无 reworkHints', timestamp: '2026-09-02T00:00:00.000Z' },
      { label: '2026-08-01 review passed=false 无 reworkHints', timestamp: '2026-08-01T00:00:00.000Z' },
    ];
    for (const c of cases) {
      const result = checkRunLog([failedReview({ timestamp: c.timestamp, passed: false })]);
      expect(result.passed, `${c.label} 应 blocking`).toBe(false);
      expect(
        result.violations.some((v) => /\[rework-hints\].*passed=false.*reworkHints/.test(v)),
        `${c.label} 应报 [rework-hints]`,
      ).toBe(true);
      expect(result.diagnostics, `${c.label} 无吸收诊断`).toBeUndefined();
    }
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

describe('A-3d 跨轮次评审一致性（R9 标准偏移）', () => {
  function entry(over: Partial<RunLogEntry>): RunLogEntry {
    return {
      runId: 'r1',
      timestamp: '2026-09-12T00:00:00Z',
      phase: 3,
      phaseName: '概要设计',
      action: 'review',
      role: 'V',
      duration_s: 30,
      tokens: 100,
      estimated: false,
      subagentSpawns: 0,
      gateExitCode: null,
      outcome: 'success',
      ...over,
    };
  }

  it('同一产物两次 review 的 qualityLevel 差 ≥2 档 → violation（走人裁定，不走 R）', () => {
    const out = checkRunLog([
      entry({
        runId: 'r1',
        artifacts: ['a.md'],
        qualityLevel: 'A',
        timestamp: '2026-09-12T00:00:00Z',
      }),
      entry({
        runId: 'r2',
        artifacts: ['a.md'],
        qualityLevel: 'C',
        timestamp: '2026-09-12T00:01:00Z',
      }),
    ]);
    expect(out.passed).toBe(false);
    const hit = out.violations.find((v) => v.includes('跨轮次评审不一致'));
    expect(hit).toBeDefined();
    // 语义：处置方是人类 CHECKPOINT，而非 R（R 无法自查评审标准）
    expect(hit).toContain('CHECKPOINT');
    expect(hit).toContain('不走 R');
    expect(hit).toContain('a.md');
  });

  it('qualityLevel 不触发跨轮次评审不一致（3 态：差 1 档/单次/不同产物）', () => {
    const cases: [string, RunLogEntry[]][] = [
      [
        '同一产物两次 review 只差 1 档（产物确实可能改进了）',
        [
          entry({ runId: 'r1', artifacts: ['a.md'], qualityLevel: 'A', timestamp: '2026-09-12T00:00:00Z' }),
          entry({ runId: 'r2', artifacts: ['a.md'], qualityLevel: 'B', timestamp: '2026-09-12T00:01:00Z' }),
        ],
      ],
      [
        '同一产物仅一次 review（首次评审豁免，无不一致可言）',
        [entry({ runId: 'r1', artifacts: ['a.md'], qualityLevel: 'A' })],
      ],
      [
        '不同产物各自的等级不同（只在同一产物内比对）',
        [
          entry({ runId: 'r1', artifacts: ['a.md'], qualityLevel: 'A', timestamp: '2026-09-12T00:00:00Z' }),
          entry({ runId: 'r2', artifacts: ['b.md'], qualityLevel: 'C', timestamp: '2026-09-12T00:01:00Z' }),
        ],
      ],
    ];
    for (const [label, entries] of cases) {
      const out = checkRunLog(entries);
      expect(
        out.violations.some((v) => v.includes('跨轮次评审不一致')),
        `${label} 不应触发`,
      ).toBe(false);
    }
  });

  it('四条记录 A→C 跨多轮 → 只报一次（按产物聚合，不重复报）', () => {
    const out = checkRunLog([
      entry({
        runId: 'r1',
        artifacts: ['a.md'],
        qualityLevel: 'A',
        timestamp: '2026-09-12T00:00:00Z',
      }),
      entry({
        runId: 'r2',
        artifacts: ['a.md'],
        qualityLevel: 'B',
        timestamp: '2026-09-12T00:01:00Z',
      }),
      entry({
        runId: 'r3',
        artifacts: ['a.md'],
        qualityLevel: 'B',
        timestamp: '2026-09-12T00:02:00Z',
      }),
      entry({
        runId: 'r4',
        artifacts: ['a.md'],
        qualityLevel: 'C',
        timestamp: '2026-09-12T00:03:00Z',
      }),
    ]);
    expect(out.violations.filter((v) => v.includes('跨轮次评审不一致'))).toHaveLength(1);
  });
});

// ==================== R10: revertEvidence 回滚证伪协议（P2-B / S27 / AC-8） ====================
//
// fix 记录必须携带合法 revertEvidence.command（非空字符串）：执行该命令使
// S-fix 的复现测试回到失败态，证明测试确实锚定被修缺陷（反模式 #45「改断言让测试通过」
// 的确定性挂点）。timestamp 仅为日志元数据，不参与证据信任判定；缺失/非法声明始终
// blocking。（批次 6 A15：emergency-fix 死词已删除，R10 只覆盖 fix。）
// 注：规则编号为 R10——R9 已被 A-3d 跨轮次评审一致性占用（计划文本写作 R9 属编号漂移）。

describe('run-log R10: revertEvidence 回滚证伪（严格证据模式）', () => {
  const VALID_EVIDENCE = {
    command: 'git apply -R fix.patch && npm run self-test',
    description: '回滚修复后复现测试应回到失败态',
  };

  /** 样本整体平移到现代日期（保持 R7 时序单调）。 */
  async function loadShiftedModernDate(): Promise<RunLogEntry[]> {
    const lines = await loadJsonl('rootcause-valid.jsonl');
    return lines.map((l) => ({
      ...l,
      timestamp: l.timestamp.replace('2026-07-24', '2026-09-16'),
    }));
  }

  /** 去掉 fix 条目的 revertEvidence（无论夹具是否已登记该字段） */
  function stripRevertEvidence(entries: RunLogEntry[]): RunLogEntry[] {
    return entries.map((l) => {
      if (l.action !== 'fix') return l;
      const clone = { ...l } as RunLogEntry & { revertEvidence?: unknown };
      delete clone.revertEvidence;
      return clone;
    });
  }

  it('R10 revertEvidence 负例（4 态：缺失/空白命令/旧日期缺失/emergency-fix 死词不入 R10）', async () => {
    const cases: {
      label: string;
      build: () => Promise<RunLogEntry[]> | RunLogEntry[];
      verify: (result: ReturnType<typeof checkRunLog>, label: string) => void;
    }[] = [
      {
        label: 'fix 缺 revertEvidence（无历史吸收）',
        build: async () => stripRevertEvidence(await loadShiftedModernDate()),
        verify: (result, label) => {
          expect(result.passed, `${label} 应 blocking`).toBe(false);
          expect(
            result.violations.some((v) => v.startsWith('R10:') && v.includes('revertEvidence')),
            `${label} 应报 R10:revertEvidence`,
          ).toBe(true);
          expect(
            (result.diagnostics ?? []).some((d) => /LEGACY|deferred/.test(d)),
            `${label} 无 legacy 吸收诊断（pending-pre-approval 等合法诊断不受影响）`,
          ).toBe(false);
          expect(result.revertEvidence, `${label} r10 计数`).toEqual({
            checked: 1,
            missing: 1,
          });
        },
      },
      {
        label: 'fix command 仅空白（不能以字符串存在替代有效命令）',
        build: async () =>
          (await loadShiftedModernDate()).map((l) =>
            l.action === 'fix' ? { ...l, revertEvidence: { command: '   ' } } : l,
          ),
        verify: (result, label) => {
          expect(result.passed, `${label} 应 schema 阻断`).toBe(false);
          expect(
            result.violations.some((v) => v.includes('[schema]') && v.includes('command')),
            `${label} 应报 [schema] command`,
          ).toBe(true);
        },
      },
      {
        label: '旧日期 fix 缺 revertEvidence（timestamp 不得作为吸收依据）',
        build: async () => stripRevertEvidence(await loadJsonl('rootcause-valid.jsonl')),
        verify: (result, label) => {
          expect(result.passed, `${label} 应 blocking`).toBe(false);
          expect(
            result.violations.some((v) => v.startsWith('R10:')),
            `${label} 应报 R10:`,
          ).toBe(true);
          expect(
            (result.diagnostics ?? []).some((d) => /LEGACY|deferred/.test(d)),
            `${label} 无 legacy 吸收诊断（pending-pre-approval 等合法诊断不受影响）`,
          ).toBe(false);
          expect(result.revertEvidence, `${label} r10 计数`).toEqual({
            checked: 1,
            missing: 1,
          });
        },
      },
      {
        label: 'emergency-fix 死词 → schema enum 拒绝，R10 不再计入（批次 6 A15）',
        build: () => [
          {
            ...makeEntry({
              runId: 'em-r10-old-date',
              action: 'fix',
              role: 'S',
              blocker: '线上阻断须立即修复',
              timestamp: '2026-07-24T00:00:00.000Z',
            }),
            action: 'emergency-fix',
          } as unknown as RunLogEntry,
        ],
        verify: (result, label) => {
          expect(
            result.violations.some((v) => v.startsWith('条目') && v.includes('[schema]')),
            `${label} 应报 [schema] 死词拒绝`,
          ).toBe(true);
          expect(result.revertEvidence, `${label} r10 计数（死词不入 R10）`).toEqual({
            checked: 0,
            missing: 0,
          });
        },
      },
    ];
    for (const c of cases) {
      c.verify(checkRunLog(await c.build()), c.label);
    }
  });

  it('合法携带 revertEvidence → 通过且 r10 计数 checked=1/missing=0', async () => {
    const entries = (await loadShiftedModernDate()).map((l) =>
      l.action === 'fix' ? { ...l, revertEvidence: VALID_EVIDENCE } : l,
    );
    const result = checkRunLog(entries);
    expect(result.passed).toBe(true);
    expect(result.violations.some((v) => v.startsWith('R10:'))).toBe(false);
    expect(result.revertEvidence).toEqual({
      checked: 1,
      missing: 0,
    });
  });
});

// ==================== R11: 闭环五脚本机器核验（约束 #11） ====================
//
// 约束 #11（SSoT §10C）：每阶段门须以 5 个闭环脚本 exitCode=0 为前提才可放行。
// R11 把该约束做成机器可核验判定：凡出现 checkpoint 放行（action=checkpoint 且
// outcome=success）的阶段，放行前必须已有 5 个闭环脚本各自一条
// role=G / outcome=success / gateExitCode=0 的 gate 记录；缺失或未严格早于放行
// （同秒不算「早于」）均 blocking（无时间戳豁免）。触发域是「checkpoint 放行」，
// 无放行的 run-log（如 fix 变体、blocked checkpoint）不受约束。

describe('run-log R11: 闭环五脚本机器核验（约束 #11）', () => {
  /**
   * 阶段 5 最小合法前置（R1 分档：produce/review/gate/checkpoint）
   */
  const phaseLead = (phase = 5): RunLogEntry[] => [
    makeEntry({
      runId: `p${phase}`,
      phase,
      timestamp: '2026-09-18T01:00:00Z',
      action: 'produce',
      role: 'S',
      outcome: 'success',
    }),
    makeEntry({
      runId: `v${phase}`,
      phase,
      timestamp: '2026-09-18T02:00:00Z',
      action: 'review',
      role: 'V',
      outcome: 'success',
    }),
  ];

  const closureEntry = (script: string, timestamp: string, runId: string, phase = 5): RunLogEntry =>
    makeEntry({
      runId,
      phase,
      timestamp,
      action: 'gate',
      role: 'G',
      outcome: 'success',
      gateExitCode: 0,
      script,
    });

  /** 5 条闭环记录，时间戳 03:00:00Z ~ 03:00:04Z（严格早于 05:00 的放行） */
  const closureFive = (phase = 5): RunLogEntry[] =>
    RUN_LOG_CLOSURE_SCRIPTS.map((script, index) =>
      closureEntry(script, `2026-09-18T03:00:0${index}Z`, `g${phase}-${index}`, phase),
    );

  const checkpoint = (phase = 5): RunLogEntry =>
    makeEntry({
      runId: `c${phase}`,
      phase,
      timestamp: '2026-09-18T05:00:00Z',
      action: 'checkpoint',
      role: 'O',
      outcome: 'success',
      acknowledgedDecisions: ['阶段 5 放行：article-service 模块完成'],
    });

  const r11 = (result: { violations: string[] }): string[] => result.violations.filter((v) => v.startsWith('R11'));

  it('五条闭环记录齐备且早于 checkpoint 放行 → 无 R11 违规', () => {
    const result = checkRunLog([...phaseLead(), ...closureFive(), checkpoint()]);
    expect(r11(result)).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.closure).toEqual({ checkedGates: 1, missing: 0 });
  });

  it('R11 不充数（3 态：缺脚本/非 G 角色/非成功记录）', () => {
    const cases: {
      label: string;
      build: () => RunLogEntry[];
      verify: (result: ReturnType<typeof checkRunLog>, label: string) => void;
    }[] = [
      {
        label: '缺 check-maturity.ts 一条',
        build: () => [
          ...phaseLead(),
          ...closureFive().filter((entry) => entry.script !== 'check-maturity.ts'),
          checkpoint(),
        ],
        verify: (result, label) => {
          const hits = r11(result);
          expect(
            hits.some((v) => v.includes('check-maturity.ts')),
            `${label} 消息应含缺失脚本名`,
          ).toBe(true);
          expect(
            hits.some((v) => v.includes('check-budget.ts')),
            `${label} 不应误报其他脚本`,
          ).toBe(false);
          expect(result.passed, `${label} 应 blocking`).toBe(false);
          expect(result.closure, `${label} closure 计数`).toEqual({ checkedGates: 1, missing: 1 });
        },
      },
      {
        label: '非 G 角色的同名脚本记录（check-budget.ts role=S）不充数',
        build: () => {
          const fake = { ...closureEntry('check-budget.ts', '2026-09-18T03:00:00Z', 'g0'), role: 'S' as const };
          const rest = closureFive().filter((entry) => entry.script !== 'check-budget.ts');
          return [...phaseLead(), fake, ...rest, checkpoint()];
        },
        verify: (result, label) => {
          expect(
            r11(result).some((v) => v.includes('check-budget.ts')),
            `${label} 应 blocking`,
          ).toBe(true);
        },
      },
      {
        label: 'gateExitCode≠0 / outcome≠success 的同名脚本记录不充数',
        build: () => {
          const failedExit = { ...closureEntry('check-budget.ts', '2026-09-18T03:00:00Z', 'g0'), gateExitCode: 1 };
          const failedOutcome = {
            ...closureEntry('check-run-log.ts', '2026-09-18T03:00:01Z', 'g1'),
            outcome: 'fail' as const,
          };
          const rest = closureFive().filter(
            (entry) => entry.script !== 'check-budget.ts' && entry.script !== 'check-run-log.ts',
          );
          return [...phaseLead(), failedExit, failedOutcome, ...rest, checkpoint()];
        },
        verify: (result, label) => {
          const hits = r11(result);
          expect(
            hits.some((v) => v.includes('check-budget.ts')),
            `${label} exitCode≠0 不充数`,
          ).toBe(true);
          expect(
            hits.some((v) => v.includes('check-run-log.ts')),
            `${label} outcome≠success 不充数`,
          ).toBe(true);
          expect(
            hits.some((v) => v.includes('check-maturity.ts')),
            `${label} 不应误报其他脚本`,
          ).toBe(false);
          expect(result.closure, `${label} closure 计数`).toEqual({ checkedGates: 1, missing: 2 });
        },
      },
    ];
    for (const c of cases) {
      c.verify(checkRunLog(c.build()), c.label);
    }
  });

  it('R11 时序边界（2 态：闭环记录晚于放行 / 同秒不算早于）', () => {
    const cases: {
      label: string;
      build: () => RunLogEntry[];
      verify: (result: ReturnType<typeof checkRunLog>, label: string) => void;
    }[] = [
      {
        label: '闭环记录晚于 checkpoint 放行（check-budget.ts → 06:00）',
        build: () => {
          const late = closureFive().map((entry) =>
            entry.script === 'check-budget.ts' ? { ...entry, timestamp: '2026-09-18T06:00:00Z' } : entry,
          );
          return [...phaseLead(), ...late, checkpoint()];
        },
        verify: (result, label) => {
          expect(
            r11(result).some((v) => v.includes('check-budget.ts')),
            `${label} 应 blocking`,
          ).toBe(true);
          expect(result.closure, `${label} closure 计数`).toEqual({ checkedGates: 1, missing: 1 });
        },
      },
      {
        label: '闭环 gate 与 checkpoint 放行同一时间戳（同秒，check-preventive-review.ts 不充数）',
        build: () => {
          // 边界钉死：schema 的 timestamp 是 RFC3339 date-time（允许小数秒），同一秒内的
          // 先后不可判定，故「早于放行」取严格小于。把最后一条闭环记录移到与放行同一时刻
          // （数组内时间戳仍非递减，不引入 R7 连带），断言该记录不充数。
          const releaseAt = checkpoint().timestamp;
          const sameSecond = closureFive().map((entry) =>
            entry.script === 'check-preventive-review.ts' ? { ...entry, timestamp: releaseAt } : entry,
          );
          return [...phaseLead(), ...sameSecond, checkpoint()];
        },
        verify: (result, label) => {
          const hits = r11(result);
          expect(
            hits.some((v) => v.includes('check-preventive-review.ts')),
            `${label} 应 blocking`,
          ).toBe(true);
          expect(
            hits.some((v) => v.includes('check-budget.ts')),
            `${label} 不应误报其他脚本`,
          ).toBe(false);
          expect(result.closure, `${label} closure 计数`).toEqual({ checkedGates: 1, missing: 1 });
        },
      },
    ];
    for (const c of cases) {
      c.verify(checkRunLog(c.build()), c.label);
    }
  });

  it('无 checkpoint 放行的 run-log（如 fix 变体）不触发 R11，也不产出 closure 计数', () => {
    const result = checkRunLog([...phaseLead(), closureEntry('check-budget.ts', '2026-09-18T03:00:00Z', 'g0')]);
    expect(r11(result)).toEqual([]);
    expect(result.closure).toBeUndefined();
  });

  it('checkpoint 记录存在但 outcome≠success（未放行）→ 同样不触发 R11', () => {
    // 触发域的另一半：action=checkpoint 且 outcome=success 才算放行；
    // blocked checkpoint 不产生闭环义务（bad-missing-G-role.jsonl 所依赖的过滤）。
    const blocked = { ...checkpoint(), outcome: 'blocked' as const };
    const result = checkRunLog([...phaseLead(), blocked]);
    expect(r11(result)).toEqual([]);
    expect(result.closure).toBeUndefined();
  });

  it('多阶段各自放行时逐阶段核验（缺一条的阶段单独报）', () => {
    // 阶段 1 整体前移一天，保持 R7 append-only 单调（只隔离 R11 判定）
    const shiftDay = (entries: RunLogEntry[]): RunLogEntry[] =>
      entries.map((entry) => ({ ...entry, timestamp: entry.timestamp.replace('2026-09-18', '2026-09-17') }));
    const phase1 = shiftDay([...phaseLead(1), ...closureFive(1), checkpoint(1)]);
    const phase5 = [
      ...phaseLead(5),
      ...closureFive(5).filter((entry) => entry.script !== 'check-checkpoint.ts'),
      checkpoint(5),
    ];
    const result = checkRunLog([...phase1, ...phase5]);
    expect(r11(result)).toEqual(expect.arrayContaining([expect.stringMatching(/阶段 5.*check-checkpoint\.ts/)]));
    expect(r11(result).some((v) => v.includes('阶段 1 '))).toBe(false);
    expect(result.closure).toEqual({ checkedGates: 2, missing: 1 });
  });
});

// ==================== R11 阶段 1 统一严格时序（D-6 后置窗口已删除） ====================
//
// 历史 D-6（2026-09-21）曾给 `phase===1` × `check-checkpoint.ts` 开「允许晚于放行」的
// 后置窗口（历史日志兼容形态：先写放行、后补 check-checkpoint gate 记录）。批次 6
// A3/C14 裁定「毁弃存量数据，不兼容」：窗口删除，五门（含 check-checkpoint.ts）对
// 全部阶段一律「严格早于放行」。自然时序「确认落盘 → 闭环五门 → 最后写放行记录」
// （R0 首阶段自举形态，见 checkpoint-logic.ts）下新建项目常态满足判据；旧时序历史
// run-log 直接 R11 blocking。

describe('run-log R11 阶段 1 统一严格时序（D-6 后置窗口删除）', () => {
  /** 单条闭环 gate 记录（shape 与 R11 充数条件一致：role=G / success / exitCode=0） */
  const closureGateRecords = (phase: number, script: string, timestamp: string): RunLogEntry[] => [
    makeEntry({
      runId: `g${phase}-${script}`,
      phase,
      timestamp,
      action: 'gate',
      role: 'G',
      outcome: 'success',
      gateExitCode: 0,
      script,
    }),
  ];

  /** 放行记录（action=checkpoint + outcome=success） */
  const cpRecord = (phase: number, timestamp: string): RunLogEntry =>
    makeEntry({
      runId: `c${phase}`,
      phase,
      timestamp,
      action: 'checkpoint',
      role: 'O',
      outcome: 'success',
      acknowledgedDecisions: [`阶段 ${phase} 放行：采用 REST + JWT 方案`],
    });

  /** 阶段前置（A chunk → S cross → S produce → V review；阶段 1-4 的 R1 动作完整性） */
  const phaseLead = (phase: number, baseAt: string): RunLogEntry[] => {
    const at = (minutes: number): string =>
      new Date(Date.parse(baseAt) + minutes * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    return [
      makeEntry({ runId: `a${phase}`, phase, timestamp: at(0), action: 'chunk', role: 'A', outcome: 'success' }),
      makeEntry({ runId: `x${phase}`, phase, timestamp: at(1), action: 'cross', role: 'S', outcome: 'success' }),
      makeEntry({ runId: `p${phase}`, phase, timestamp: at(2), action: 'produce', role: 'S', outcome: 'success' }),
      makeEntry({ runId: `v${phase}`, phase, timestamp: at(3), action: 'review', role: 'V', outcome: 'success' }),
    ];
  };

  /**
   * 阶段 1 夹具（新语义正常形态）：前置 → 四门（00:00:01~03）→ check-checkpoint（默认
   * 00:00:04）→ 预防审查门（00:00:04.500）→ 放行（00:00:05），毫秒递增。
   * `checkpointAt` 覆盖 check-checkpoint 记录时点（`null` = 完全缺失；后置时点用于锁定
   * blocking）；`omit` 剔除指定的前置闭环脚本；`moveBudgetTo` 把 check-budget 记录挪到
   * 指定时点（后置违规用，缺省前置 00:00:01）。
   */
  const phase1 = (
    opts: { checkpointAt?: string | null; omit?: string[]; moveBudgetTo?: string } = {},
  ): RunLogEntry[] => {
    const checkpointAt = opts.checkpointAt === undefined ? '2026-01-01T00:00:04Z' : opts.checkpointAt;
    const omit = new Set(opts.omit ?? []);
    const gate = checkpointAt === null ? [] : closureGateRecords(1, 'check-checkpoint.ts', checkpointAt);
    // 后置（≥ 放行 00:00:05）的 check-checkpoint 记录按日志顺序排在放行之后
    //（与旧时序写入形态一致，R8 轨迹模板照常对其报违规）。
    const gateIsPost = checkpointAt !== null && Date.parse(checkpointAt) >= Date.parse('2026-01-01T00:00:05Z');
    return [
      ...phaseLead(1, '2025-12-31T23:50:00Z'),
      ...(opts.moveBudgetTo === undefined && !omit.has('check-budget.ts')
        ? closureGateRecords(1, 'check-budget.ts', '2026-01-01T00:00:01Z')
        : []),
      ...closureGateRecords(1, 'check-run-log.ts', '2026-01-01T00:00:02Z'),
      ...closureGateRecords(1, 'check-maturity.ts', '2026-01-01T00:00:03Z'),
      ...(gateIsPost ? [] : gate),
      ...closureGateRecords(1, 'check-preventive-review.ts', '2026-01-01T00:00:04.500Z'),
      cpRecord(1, '2026-01-01T00:00:05Z'),
      ...(gateIsPost ? gate : []),
      ...(opts.moveBudgetTo !== undefined ? closureGateRecords(1, 'check-budget.ts', opts.moveBudgetTo) : []),
    ];
  };

  /** 阶段 2：五条闭环记录齐备且均早于本阶段放行（00:10:00）——供跨阶段隔离对照 */
  const phase2 = (): RunLogEntry[] => [
    ...phaseLead(2, '2026-01-01T00:00:07Z'),
    ...closureGateRecords(2, 'check-budget.ts', '2026-01-01T00:09:01Z'),
    ...closureGateRecords(2, 'check-run-log.ts', '2026-01-01T00:09:02Z'),
    ...closureGateRecords(2, 'check-maturity.ts', '2026-01-01T00:09:03Z'),
    ...closureGateRecords(2, 'check-checkpoint.ts', '2026-01-01T00:09:04Z'),
    ...closureGateRecords(2, 'check-preventive-review.ts', '2026-01-01T00:09:05Z'),
    cpRecord(2, '2026-01-01T00:10:00Z'),
  ];

  const r11 = (result: { violations: string[] }): string[] => result.violations.filter((v) => v.startsWith('R11:'));

  it('阶段 1：五门齐备且全部严格早于放行 → 通过（毫秒递增正常形态）', () => {
    const result = checkRunLog(phase1());
    expect(r11(result)).toEqual([]);
    expect(result.closure).toEqual({ checkedGates: 1, missing: 0 });
    expect(result.violations, '正常形态无任何违规').toEqual([]);
  });

  it('阶段 1：完全缺失 check-checkpoint 成功记录 → 阻断', () => {
    const result = checkRunLog([...phase1({ checkpointAt: null }), ...phase2()]);
    const hits = r11(result);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain('阶段 1');
    expect(hits[0]).toMatch(/R11.*check-checkpoint/);
    expect(result.closure).toEqual({ checkedGates: 2, missing: 1 });
  });

  it('阶段 1：check-checkpoint 成功记录晚于放行 → R11 blocking（D-6 窗口删除；阶段 2 正常隔离）', () => {
    const result = checkRunLog([...phase1({ checkpointAt: '2026-01-01T00:00:06Z' }), ...phase2()]);
    const hits = r11(result);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain('阶段 1');
    expect(hits[0]).toMatch(/R11.*check-checkpoint/);
    expect(result.closure).toEqual({ checkedGates: 2, missing: 1 });
    // 后置记录仍照常触发 R8 轨迹模板违规（R8 零改动）
    expect(result.violations.some((v) => v.startsWith('R8: 阶段 1 '))).toBe(true);
  });

  it('阶段 2 回归：后置 check-checkpoint 记录 → 仍阻断（全部阶段同一判据）', () => {
    const entries = [
      ...closureGateRecords(2, 'check-budget.ts', '2026-01-01T00:00:01Z'),
      ...closureGateRecords(2, 'check-run-log.ts', '2026-01-01T00:00:02Z'),
      ...closureGateRecords(2, 'check-maturity.ts', '2026-01-01T00:00:03Z'),
      ...closureGateRecords(2, 'check-preventive-review.ts', '2026-01-01T00:00:04Z'),
      cpRecord(2, '2026-01-01T00:00:05Z'),
      ...closureGateRecords(2, 'check-checkpoint.ts', '2026-01-01T00:00:06Z'), // 后置 → blocking
    ];
    const result = checkRunLog([...phaseLead(2, '2025-12-31T22:00:00Z'), ...entries]);
    const hits = r11(result);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatch(/R11.*check-checkpoint/);
    expect(hits[0]).toContain('阶段 2');
    expect(result.closure).toEqual({ checkedGates: 1, missing: 1 });
  });

  it('阶段 1：后置记录晚于下一放行 → 阻断（不再有窗口上界概念）', () => {
    const result = checkRunLog([
      ...phase1({ checkpointAt: null }),
      ...phase2(),
      ...closureGateRecords(1, 'check-checkpoint.ts', '2026-01-01T00:20:00Z'), // 晚于阶段 2 的 00:10:00 放行
    ]);
    const hits = r11(result);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain('阶段 1');
    expect(hits[0]).toMatch(/R11.*check-checkpoint/);
    expect(result.closure).toEqual({ checkedGates: 2, missing: 1 });
  });

  it('阶段 1：同毫秒不算早于放行 → 阻断（严格早于判据不变）', () => {
    const result = checkRunLog([...phase1({ checkpointAt: '2026-01-01T00:00:05Z' }), ...phase2()]);
    const hits = r11(result);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatch(/R11.*check-checkpoint/);
  });

  it('阶段 1：无下一放行时后置记录 → 阻断（旧「无上界」豁免删除）', () => {
    const result = checkRunLog(phase1({ checkpointAt: '2026-01-01T00:00:06Z' }));
    const hits = r11(result);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatch(/R11.*check-checkpoint/);
    expect(result.closure).toEqual({ checkedGates: 1, missing: 1 });
  });

  it('阶段 1：check-budget 后置 → 只报 check-budget（check-checkpoint 前置照常充数）', () => {
    const result = checkRunLog([
      ...phase1({ moveBudgetTo: '2026-01-01T00:00:07Z' }), // 后置 → blocking
    ]);
    const hits = r11(result);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain('check-budget.ts');
    expect(hits.some((v) => v.includes('check-checkpoint.ts'))).toBe(false);
    expect(result.closure).toEqual({ checkedGates: 1, missing: 1 });
  });
});

// ==================== D-2：R3/R7 配对接受 V 重发记录 ====================

describe('run-log D-2: R3/R7 配对接受 V 重发记录（V 自有产物重发 = 修复证据）', () => {
  /** 最小 phase-3 run-log 条目构造（schema 必需字段 + 可覆盖字段）。 */
  function entry(over: Partial<RunLogEntry>): RunLogEntry {
    return {
      runId: 'r-x',
      timestamp: '2026-09-21T00:00:00Z',
      phase: 3,
      phaseName: '设计',
      duration_s: 10,
      tokens: 100,
      estimated: false,
      subagentSpawns: 0,
      gateExitCode: null,
      outcome: 'success',
      ...over,
    } as RunLogEntry;
  }

  /** V 重发记录：action=review + role=V + basedOnReport + artifacts 全部 V 自有前缀。 */
  function vResend(over: Partial<RunLogEntry> = {}): RunLogEntry {
    return entry({
      runId: 'r-vresend',
      action: 'review',
      role: 'V',
      basedOnReport: 'RC-p3-1',
      artifacts: ['.w-model/verifier-outputs/phase-3.json'],
      qualityLevel: 'A',
      passed: true,
      reworkHints: [],
      ...over,
    });
  }

  /** 最小返工链：rootcause → V 复审(targetKind=rootcause) → [被测重发记录] → R 报告门禁。 */
  function reworkChain(resend: RunLogEntry): RunLogEntry[] {
    return [
      entry({
        runId: 'r-rootcause',
        action: 'rootcause',
        role: 'R',
        round: 1,
        reportId: 'RC-p3-1',
        rootCauseCategory: 'design-gap',
        upstreamDefect: false,
        rollbackRecommended: false,
      }),
      entry({
        runId: 'r-review',
        action: 'review',
        role: 'V',
        targetKind: 'rootcause',
        target: 'RC-p3-1',
        qualityLevel: 'A',
        passed: true,
        reworkHints: [],
      }),
      resend,
      entry({ runId: 'r-gate', action: 'gate', role: 'G', script: 'check-rootcause-report.ts', gateExitCode: 0 }),
    ];
  }

  const isPairingViolation = (v: string): boolean =>
    v.startsWith('R3: rootcause 报告 RC-p3-1') || (v.startsWith('R7: rootcause 记录') && v.includes('successful fix'));

  it('V 重发记录（review + basedOnReport + V 自有 artifacts）闭合 R3/R7 配对（正例）', () => {
    const r = checkRunLog(reworkChain(vResend()));
    expect(r.violations.filter(isPairingViolation)).toEqual([]);
  });

  it('V 重发缺 basedOnReport → 不充数（负例，R3/R7 配对违规仍在）', () => {
    const resend = vResend();
    delete (resend as Partial<RunLogEntry>).basedOnReport;
    const r = checkRunLog(reworkChain(resend));
    expect(r.violations.some((v) => v.startsWith('R3: rootcause 报告 RC-p3-1'))).toBe(true);
    expect(r.violations.some((v) => v.startsWith('R7: rootcause 记录') && v.includes('successful fix'))).toBe(true);
  });

  it('V 重发 artifacts 指向非 V 前缀 → 不充数（负例）', () => {
    const r = checkRunLog(reworkChain(vResend({ artifacts: ['src/counter.ts'] })));
    expect(r.violations.some((v) => v.startsWith('R3: rootcause 报告 RC-p3-1'))).toBe(true);
    expect(r.violations.some((v) => v.startsWith('R7: rootcause 记录') && v.includes('successful fix'))).toBe(true);
  });

  it("V 重发 outcome≠'success' → 不充数（边界负例）", () => {
    const r = checkRunLog(reworkChain(vResend({ outcome: 'fail' })));
    expect(r.violations.some((v) => v.startsWith('R3: rootcause 报告 RC-p3-1'))).toBe(true);
    expect(r.violations.some((v) => v.startsWith('R7: rootcause 记录') && v.includes('successful fix'))).toBe(true);
  });
});

// ==================== C9：R7 时间戳不可解析 fail-closed ====================

describe('C9 R7 时间戳不可解析 fail-closed', () => {
  it('相邻行 timestamp 非法（Date.parse NaN）→ blocking violation，而非静默跳过', () => {
    // 后一条使用闰秒形态 23:59:60Z：run-log schema（RFC3339 full 模式）接受该形态，
    // 但 V8 Date.parse 返回 NaN——schema 拦不住、JS 又解析不了。C9 前该行会被静默
    // 跳过（Invalid Date 参与比较恒为 false），现改为 fail-closed blocking。
    const entries: RunLogEntry[] = [
      makeEntry({ runId: 'c9-1', timestamp: '2026-01-01T00:00:00Z' }),
      makeEntry({ runId: 'c9-2', timestamp: '2026-01-01T23:59:60Z' }),
    ];
    const result = checkRunLog(entries);
    expect(result.passed).toBe(false);
    expect(result.violations).toEqual(['R7: 记录 c9-2 时间戳不可解析（2026-01-01T23:59:60Z），时序校验 fail-closed']);
  });
});

// ==================== C15：R5 越权检测形态补全 ====================

describe('C15 R5 越权检测形态补全', () => {
  // 42.13.1 收紧后仍须命中的形态（检测面不缩小的回归钉）。
  // 注：fs.promises/fsPromises 两例在 fs.promises 冗余形态去除后改由 writeFile 模式命中；
  // --eval= / python -c 两例走「形态 + .w-model/ 路径」复合判定（含路径 → 命中）。
  it.each([
    "node -e \"require('fs').appendFileSync('.w-model/rtm.json','x')\"",
    "require('fs').appendFileSync('.w-model/rtm.json','x')",
    "fs.promises.writeFile('.w-model/rtm.json', 'x')",
    "fsPromises.writeFile('.w-model/rtm.json', 'x')",
    "node --eval=\"fs.readFileSync('.w-model/rtm.json','utf8')\"",
    "python -c \"open('.w-model/rtm.json','w').write('x')\"",
  ])('检测 %s 形态', (cmd) => {
    // 单条 produce（无 checkpoint → 不触发 R1/R4/R11），gateLogs 携带含越权命令的
    // gate-log 内容；R5 扫描 gateLogs content 命中即 blocking。
    const entries: RunLogEntry[] = [makeEntry({ runId: 'c15-1' })];
    const gateLogs = new Map([['gate-logs/o-direct.log', { exitCode: 0, content: cmd }]]);
    const result = checkRunLog(entries, { gateLogs });
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.startsWith('R5:'))).toBe(true);
  });

  // 42.13.1 收紧：--eval= / python -c 两形态改为复合锚定——gate-log 中仅提及形态、
  // 命令文本不含 .w-model/ 路径引用的良性命令不再误报（检测面其余部分不变）。
  it.each(['node --eval=console.log(1)', 'python -c "print(1)"'])('良性引用不误报：%s', (cmd) => {
    const entries: RunLogEntry[] = [makeEntry({ runId: 'c15-2' })];
    const gateLogs = new Map([['gate-logs/benign.log', { exitCode: 0, content: cmd }]]);
    const result = checkRunLog(entries, { gateLogs });
    expect(result.violations.some((v) => v.startsWith('R5:'))).toBe(false);
    expect(result.passed).toBe(true);
  });
});

// ==================== A3/C14：legacy 吸收机器删除（旧形态一律 fail-closed） ====================
//
// 批次 6 任务 5：三种 legacy 诊断性吸收（variant 族 / unscoped 族 / reworkHints 族）、
// 共享吸收谓词与 R11 D-6「阶段 1 check-checkpoint 后置窗口」全部删除——
// 用户裁定「毁弃存量数据，不兼容」：旧形态数据直接 fail-closed（[schema] / R11 blocking），
// 不再有非阻断绕行。R0 首阶段自举（BOOTSTRAP_VALIDATION）是首次运行语义，不在本组。

describe('A3/C14 legacy 清除：旧形态一律 fail-closed', () => {
  it('variant 非标准字段 → schema additionalProperties 拒绝（不再是 legacy 吸收诊断）', () => {
    const entry: RunLogEntry = makeEntry({
      runId: 'legacy-variant-field',
      phase: 5,
      action: 'fix',
      role: 'S',
      outcome: 'success',
      revertEvidence: { command: 'npm run reproduce-failure' },
    });
    const legacy = { ...entry, variant: 'fix' } as unknown as RunLogEntry;
    const result = checkRunLog([legacy]);
    expect(result.violations.some((v) => v.includes('[schema]') && v.includes('variant'))).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.diagnostics, 'legacy 吸收诊断不复存在').toBeUndefined();
  });

  it('unscoped/variant 双旧字段 → schema 拒绝（字段容忍列表移除）', () => {
    const entry: RunLogEntry = makeEntry({
      runId: 'legacy-unscoped-field',
      phase: 5,
      action: 'fix',
      role: 'S',
      outcome: 'success',
      revertEvidence: { command: 'npm run reproduce-failure' },
    });
    const legacy = { ...entry, variant: 'fix', unscoped: true } as unknown as RunLogEntry;
    const result = checkRunLog([legacy]);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('[schema]'))).toBe(true);
  });

  it('R11：phase-1 check-checkpoint 记录后置于放行 → blocking（D-6 后置窗口删除）', () => {
    // 五门在放行前齐备（00:00:01~04），放行 05，check-checkpoint 后置 06——
    // 旧 D-6 窗口下此形态 R11 通过（无下一放行时无上界）；删除后一律「严格早于放行」。
    const at = (): RunLogEntry[] =>
      RUN_LOG_CLOSURE_SCRIPTS.filter((s) => s !== 'check-checkpoint.ts').map((script, index) =>
        makeEntry({
          runId: `g1-${script}`,
          phase: 1,
          timestamp: `2026-01-01T00:00:0${index + 1}Z`,
          action: 'gate',
          role: 'G',
          outcome: 'success',
          gateExitCode: 0,
          script,
        }),
      );
    const lead = [
      makeEntry({
        runId: 'a1',
        phase: 1,
        timestamp: '2025-12-31T23:50:00Z',
        action: 'chunk',
        role: 'A',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'x1',
        phase: 1,
        timestamp: '2025-12-31T23:51:00Z',
        action: 'cross',
        role: 'S',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'p1',
        phase: 1,
        timestamp: '2025-12-31T23:52:00Z',
        action: 'produce',
        role: 'S',
        outcome: 'success',
      }),
      makeEntry({
        runId: 'v1',
        phase: 1,
        timestamp: '2025-12-31T23:53:00Z',
        action: 'review',
        role: 'V',
        outcome: 'success',
      }),
    ];
    const release = makeEntry({
      runId: 'c1',
      phase: 1,
      timestamp: '2026-01-01T00:00:05Z',
      action: 'checkpoint',
      role: 'O',
      outcome: 'success',
      acknowledgedDecisions: ['阶段 1 放行：REQ 全量锐利'],
    });
    const postCheckpointGate = makeEntry({
      runId: 'g1-check-checkpoint.ts',
      phase: 1,
      timestamp: '2026-01-01T00:00:06Z',
      action: 'gate',
      role: 'G',
      outcome: 'success',
      gateExitCode: 0,
      script: 'check-checkpoint.ts',
    });
    const result = checkRunLog([...lead, ...at(), release, postCheckpointGate]);
    expect(result.violations.some((v) => v.startsWith('R11:') && v.includes('check-checkpoint.ts'))).toBe(true);
  });
});
