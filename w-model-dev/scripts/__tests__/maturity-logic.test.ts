/* eslint-disable security/detect-non-literal-fs-filename -- 构造 mkdtemp 临时项目树（join(tmpDir, ...) 路径由测试自生成，非用户输入） */
/**
 * maturity-logic.test.ts —— 成熟度校验（R1-R5）单元测试
 *
 * 覆盖 maturity-logic.ts 中 checkMaturity 函数：
 *   - 合法 MaturityConfig 通过
 *   - schema 前置校验（缺 required 字段 → [schema] 违规，防反模式 #28）
 *   - R3 completedCycles 与 completedPhases 周期换算
 *   - R4 history / leveledUpAt 早于 project.createdAt
 *   - R5 O 系列失败模式命中达 streak 阈值 → 降级评估提醒
 *   - R5 真值通道（D-7）：只统计 run-log 的 `operationalFailureModes` 字段，note 中的 O1..O6
 *     字样（含评审规则编号同名情形，如 O3 既是运维失败模式也是 Verifier 扣分规则）按引用处理，
 *     仅作非阻断诊断；未提供 --run-log 时诊断「R5 未生效」而非静默跳过
 *   - CLI 三态（真实 tsx 子进程 + 真实临时 run-log）：仅引用 → exit 0 + 诊断 /
 *     字段标注 3 次 → exit 1 + R5 违规 / 未提供 --run-log → exit 0 + 诊断
 */

import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildR5Diagnostics, collectLexicalMentions, countOperationalFailures } from '../cli/check-maturity.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';
import { runSync } from '../lib/run-sync.js';
import { checkMaturity, type MaturityConfig } from '../logic/maturity-logic.js';

function validMaturity(): MaturityConfig {
  return {
    schemaVersion: '1.0',
    projectId: 'test-project',
    level: 'L1',
    leveledUpAt: '2026-08-01T00:00:00Z',
    unlockConditions: {
      stableDays: 30,
      completedCycles: 3,
      attemptCapRate: 0.85,
      misjudgeRate: 0.05,
      operationalFailures: 0,
    },
    history: [{ from: 'L0', to: 'L1', at: '2026-08-01T00:00:00Z', reason: '稳定运行 1 完整周期' }],
    downgradeTriggers: { operationalFailureStreak: 3, userRequested: false },
  };
}

describe('checkMaturity', () => {
  it('合法 MaturityConfig → passed=true 且零违规', () => {
    const r = checkMaturity(validMaturity());
    expect(r.passed).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('schema 前置校验：缺 projectId → [schema] 违规（防反模式 #28）', () => {
    const rest = { ...validMaturity() } as Record<string, unknown>;
    delete rest['projectId'];
    const r = checkMaturity(rest);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.startsWith('[schema]'))).toBe(true);
  });

  it('R3：completedPhases=16（2 完整周期）但 completedCycles=1 → 未更新违规', () => {
    const m = validMaturity();
    m.unlockConditions.completedCycles = 1;
    const r = checkMaturity(m, { completedPhases: 16 });
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('R3') && v.includes('completedCycles'))).toBe(true);
  });

  it('R4：history 条目早于 project.createdAt → 时序违规', () => {
    const r = checkMaturity(validMaturity(), { projectCreatedAt: '2026-08-15T00:00:00Z' });
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('R4') && v.includes('project.createdAt'))).toBe(true);
  });

  it('R5：O 系列失败模式命中达 streak 阈值 → 降级评估违规', () => {
    const r = checkMaturity(validMaturity(), { operationalFailureCount: 3 });
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('R5') && v.includes('降级评估'))).toBe(true);
  });
});

/**
 * 可见性与死分支清理（F-G2-04/05，audit-fixes task 5）：
 *   - R3 依赖可选 --project context（completedPhases），缺失时降级为非阻断 warning，不再静默
 *   - R1 死分支删除：schema required 前置拦截缺失字段，逻辑层不再重复报「schema 不完整」
 */
describe('checkMaturity 可见性与死分支清理', () => {
  it('R3 context 缺失（未提供 completedPhases）→ 非阻断 warning（F-G2-04）', () => {
    const r = checkMaturity(validMaturity());
    expect(r.passed).toBe(true);
    expect(r.warnings).toEqual(['R3 未校验：未提供 --project']);
  });

  it('R3 context 提供时无 warning', () => {
    const r = checkMaturity(validMaturity(), { completedPhases: 8 });
    expect(r.warnings).toHaveLength(0);
    expect(r.passed).toBe(true);
  });

  it('R1 死分支已删除：缺 level 由 schema required 前置拦截 → [schema]（F-G2-05）', () => {
    const m = validMaturity() as unknown as Record<string, unknown>;
    delete m['level'];
    const r = checkMaturity(m);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.startsWith('[schema]'))).toBe(true);
  });
});

// ==================== R5 真值通道（D-7） ====================

/** run-log 记录最小形状（仅 R5 统计所需字段；schema 完备性由 check-run-log 负责） */
const mkEntry = (patch: Record<string, unknown>): Record<string, unknown> => ({
  phase: 1,
  action: 'gate',
  role: 'G',
  outcome: 'success',
  timestamp: '2026-09-25T10:00:00.000Z',
  ...patch,
});

/**
 * R5 用例的成熟度模型：以 validMaturity() 为底（schema 前置校验要求全 required 字段在场），
 * 覆写 level 与降级阈值 streak——故 mkMaturity(3) 的 R5 判据为「命中 ≥ 3」。
 */
const mkMaturity = (streak: number): MaturityConfig => ({
  ...validMaturity(),
  level: 'L2',
  downgradeTriggers: { ...validMaturity().downgradeTriggers, operationalFailureStreak: streak },
});

describe('R5 真值通道：只统计 operationalFailureModes 字段（D-7）', () => {
  it('R5 只统计 operationalFailureModes 字段，词法命中不改判', () => {
    const rows = [mkEntry({ note: '拦截 #9：R5 O_PATTERN 与 VerifierOutput O3 命名冲突' })];
    expect(countOperationalFailures(rows)).toBe(0);
    expect(checkMaturity(mkMaturity(3), { operationalFailureCount: countOperationalFailures(rows) }).passed).toBe(true);
  });

  it('operationalFailureModes 标注 3 次 → R5 违规', () => {
    const rows = [1, 2, 3].map(() => mkEntry({ operationalFailureModes: ['O3'] }));
    const r = checkMaturity(mkMaturity(3), { operationalFailureCount: countOperationalFailures(rows) });
    expect(r.passed).toBe(false);
    expect(r.violations.join()).toMatch(/R5: O 系列失败模式命中 3 次/);
  });

  it('同记录多枚举值按数组长度累加；非数组形态与词法命中均不计入（向后兼容）', () => {
    const rows = [
      mkEntry({ operationalFailureModes: ['O1', 'O4'] }),
      mkEntry({ operationalFailureModes: 'O3' }),
      mkEntry({ note: 'O5 命中字样仅为引用' }),
      mkEntry({}),
    ];
    expect(countOperationalFailures(rows)).toBe(2);
  });

  it('collectLexicalMentions：按命中次数返回 runId（引用位置可追溯），缺 runId 用占位符', () => {
    const rows = [
      mkEntry({ runId: 'p1-G-verifier-10', note: 'O3 既是运维失败模式也是评审规则编号' }),
      mkEntry({ runId: 'p2-V-rootcause-02c', note: 'O3 与 O4 引用' }),
      mkEntry({ runId: 'p3-G-ok', note: '无失败模式字样' }),
      mkEntry({ note: 'O1 引用但记录缺 runId' }),
    ];
    expect(collectLexicalMentions(rows)).toEqual([
      'p1-G-verifier-10',
      'p2-V-rootcause-02c',
      'p2-V-rootcause-02c',
      '<无 runId>',
    ]);
  });
});

describe('R5 诊断通道：未接线可见化与词法降级（D-7）', () => {
  it('未提供 --run-log → 诊断「R5 未生效」；非阻断（退出码语义不变）', () => {
    const diagnostics = buildR5Diagnostics(false, []);
    expect(diagnostics).toEqual(['R5 未生效：未提供 --run-log（O 系列失败模式未校验）']);
    const r = checkMaturity(mkMaturity(3), { operationalFailureCount: 0, diagnostics });
    expect(r.passed).toBe(true);
    expect(r.diagnostics).toEqual(diagnostics);
  });

  it('词法命中 → 诊断含命中数与去重 runId 列表，且不改判', () => {
    const rows = [
      mkEntry({ runId: 'p1-G-verifier-10', note: 'O3 引用' }),
      mkEntry({ runId: 'p7-V-finalize-02b', note: 'O3 与 O4 引用' }),
    ];
    const diagnostics = buildR5Diagnostics(true, collectLexicalMentions(rows));
    expect(diagnostics).toEqual([
      '疑似引用 3 处（含规则编号引用，非运维失败）；若确为运维失败请在记录中以 operationalFailureModes 标注：p1-G-verifier-10, p7-V-finalize-02b',
    ]);
    const r = checkMaturity(mkMaturity(3), {
      operationalFailureCount: countOperationalFailures(rows),
      diagnostics,
    });
    expect(r.passed).toBe(true);
    expect(r.diagnostics).toEqual(diagnostics);
  });

  it('diagnostics 与 warnings 并存：互不影响，且不改判', () => {
    const r = checkMaturity(mkMaturity(3), {
      diagnostics: ['R5 未生效：未提供 --run-log（O 系列失败模式未校验）'],
    });
    expect(r.warnings).toEqual(['R3 未校验：未提供 --project']);
    expect(r.diagnostics).toHaveLength(1);
    expect(r.passed).toBe(true);
  });

  it('未传 options → diagnostics 为空数组（既有调用方零回归）', () => {
    expect(checkMaturity(validMaturity()).diagnostics).toEqual([]);
  });
});

// ==================== CLI 三态（D-7 端到端） ====================

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const cliDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli');

/** 合法 maturity.json（形状照抄 samples/maturity/valid.json） */
const VALID_MATURITY =
  '{"schemaVersion":"1.0","projectId":"smoke","level":"L1","leveledUpAt":"2026-07-23T18:00:00Z","unlockConditions":{"stableDays":30,"completedCycles":3,"attemptCapRate":0.85,"misjudgeRate":0.05,"operationalFailures":0},"history":[{"at":"2026-07-23T18:00:00Z","from":"L0","to":"L1","reason":"3 阶段稳定完成"}],"downgradeTriggers":{"operationalFailureStreak":3,"budgetBurnRateExceeded":3,"checkpointRejectionStreak":2,"userRequested":false}}';

const runLogEntry = (runId: string, patch: Record<string, unknown>): string =>
  JSON.stringify({
    runId,
    timestamp: '2026-09-25T10:00:00.000Z',
    phase: 1,
    phaseName: '需求分析',
    action: 'gate',
    role: 'G',
    duration_s: 1,
    tokens: 10,
    estimated: false,
    subagentSpawns: 0,
    gateExitCode: 0,
    outcome: 'success',
    ...patch,
  });

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'maturity-r5-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<string> {
  const p = path.join(tmpDir, rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, 'utf-8');
  return p;
}

/** 摘取单行 MATURITY_JSON 摘要（供断言机器通道字段） */
function maturitySummary(stdout: string): Record<string, unknown> {
  const line = stdout.split(/\r?\n/).find((l) => l.startsWith('MATURITY_JSON '));
  expect(line, 'stdout 缺 MATURITY_JSON 摘要行').toBeDefined();
  return JSON.parse(line!.slice('MATURITY_JSON '.length)) as Record<string, unknown>;
}

describe('check-maturity CLI：--run-log 三态（D-7 端到端，真实子进程 + 真实临时 run-log）', () => {
  it('仅引用（note 含 O3 字样，共 17 处）→ exit 0 + 引用诊断（不再误判 R5）', async () => {
    const maturity = await write('maturity.json', VALID_MATURITY);
    const mentions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
      .map((i) => runLogEntry(`p${i}-G-verifier-${i}`, { note: 'O3 既是运维失败模式也是评审规则编号' }))
      .join('\n');
    const runLog = await write('run-log.jsonl', mentions);
    const r = runSync(process.execPath, [
      tsxCli,
      path.join(cliDir, 'check-maturity.ts'),
      maturity,
      `--run-log=${runLog}`,
    ]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('疑似引用 17 处（含规则编号引用，非运维失败）');
    expect(r.stdout).toContain('operationalFailureModes 标注：');
    const summary = maturitySummary(r.stdout ?? '');
    expect(summary['passed']).toBe(true);
    expect(summary['diagnostics']).toHaveLength(1);
  });

  it('operationalFailureModes 标注 3 次 → exit 1 + R5 违规', async () => {
    const maturity = await write('maturity.json', VALID_MATURITY);
    const rows = [1, 2, 3].map((i) => runLogEntry(`p1-G-${i}`, { operationalFailureModes: ['O3'] })).join('\n');
    const runLog = await write('run-log.jsonl', rows);
    const r = runSync(process.execPath, [
      tsxCli,
      path.join(cliDir, 'check-maturity.ts'),
      maturity,
      `--run-log=${runLog}`,
    ]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('R5: O 系列失败模式命中 3 次');
    expect(maturitySummary(r.stdout ?? '')['passed']).toBe(false);
  });

  it('未提供 --run-log → exit 0 + 「R5 未生效」诊断（隐性规避通道可见化）', async () => {
    const maturity = await write('maturity.json', VALID_MATURITY);
    const r = runSync(process.execPath, [tsxCli, path.join(cliDir, 'check-maturity.ts'), maturity]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('R5 未生效：未提供 --run-log（O 系列失败模式未校验）');
    expect(maturitySummary(r.stdout ?? '')['diagnostics']).toEqual([
      'R5 未生效：未提供 --run-log（O 系列失败模式未校验）',
    ]);
  });
});

// ==================== R5 三态补强（G2-1） ====================

/**
 * 补三条廉价断言（live-run-findings Task 4 延后项，G2-1）：
 *   1. diagnostics 通道透传——含 `--json` 机器通道（此前只断言人类可读段与 MATURITY_JSON 摘要）；
 *   2. `operationalFailureModes: []`（空标注）→ 不计次；
 *   3. 重复值形态的计数口径。实现为「存在即累加数组长度」（`cli/check-maturity.ts:99-106`），
 *      「每条记录内同一取值至多出现一次」由 `run-log.schema.json` 的 `uniqueItems` 前置强制
 *      （重复值记录 schema 不合法，不进入合规 run-log）——故计数层不去重，断言按实现口径写。
 */
describe('R5 三态补强（G2-1）', () => {
  it('R5 诊断经 --json 输出透传（diagnostics 通道）', async () => {
    // 逻辑层：diagnostics 由 options 注入后逐字回传（通道名以 maturity-logic.ts 现状为准）
    const logic = checkMaturity(mkMaturity(3), {
      operationalFailureCount: 0,
      diagnostics: ['R5 未生效：未提供 --run-log'],
    });
    expect(logic.diagnostics).toContain('R5 未生效：未提供 --run-log');
    // CLI 层：--json 单行报告透传 diagnostics（非阻断，passed 仍为 true）
    const maturity = await write('maturity.json', VALID_MATURITY);
    const r = runSync(process.execPath, [tsxCli, path.join(cliDir, 'check-maturity.ts'), maturity, '--json']);
    expect(r.status).toBe(0);
    const parsed = JSON.parse((r.stdout ?? '').trim()) as { passed: boolean; diagnostics?: string[] };
    expect(parsed.passed).toBe(true);
    expect(parsed.diagnostics).toContain('R5 未生效：未提供 --run-log（O 系列失败模式未校验）');
  });

  it('R5 operationalFailureModes 空数组 → 不计次', () => {
    const rows = [mkEntry({ operationalFailureModes: [] })];
    expect(countOperationalFailures(rows)).toBe(0);
  });

  it('R5 operationalFailureModes 重复值：schema uniqueItems 拒收，计数按数组长度（每项至多一次由 schema 强制）', () => {
    const duplicate = JSON.parse(runLogEntry('r5-dup-mode', { operationalFailureModes: ['O3', 'O3'] })) as Record<
      string,
      unknown
    >;
    const single = JSON.parse(runLogEntry('r5-single-mode', { operationalFailureModes: ['O3'] })) as Record<
      string,
      unknown
    >;
    expect(validateBySchema('run-log', duplicate).valid).toBe(false); // 重复值被 uniqueItems 拒收
    expect(validateBySchema('run-log', single).valid).toBe(true); // 对照：单值形态合法
    expect(countOperationalFailures([duplicate])).toBe(2); // 计数口径 = 数组长度（合法输入不含重复值，不去重）
  });
});
