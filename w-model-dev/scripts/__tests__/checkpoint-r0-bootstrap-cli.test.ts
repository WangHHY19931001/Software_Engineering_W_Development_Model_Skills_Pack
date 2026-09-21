/**
 * E-2 方案 B（R0 首阶段自举形态）端到端契约测试（真实 tsx 子进程）。
 *
 * 规格 §3.2：构造最小 phase-1 自举时序（确认落盘 → 闭环五门 → 写放行记录）跑
 * `check-run-log.ts` → exit 0 且无 R8/R11 违规（E-2 的原始判据）。同时以 CLI 级反放
 * 锁定反伪造边界（根因报告 §7.7 验收口径：复现 1 红转绿 / 复现 3 维持红）：
 *   1. 自然时序 run-log → check-run-log.ts exit 0，R8/R11 零违规，closure missing=0；
 *   2. D-6 时序（check-checkpoint 记录后置于放行）→ check-run-log.ts exit 1，
 *      恰 3 条 R8（后置窗口不合法化 R8 冲突；新建项目不应产生该形态）；
 *   3. 零记录态 + checkpoint-log 用户确认在场 → check-checkpoint.ts exit 0 且
 *      --json 携带 BOOTSTRAP_VALIDATION 非阻断诊断（旧 R0 一律违规的唯一阻塞点转绿）；
 *   4. 零记录态 + checkpoint-log 目录无 phase-N 匹配 → check-checkpoint.ts exit 1
 *      且 R0 文案保留（fail-closed 回归）。
 *
 * 夹具文法参照 run-log-logic.test.ts「R11 阶段 1 自举豁免（D-6）」组的 phase-1 形态
 * （phaseLead → 四门 gate → checkpoint / check-checkpoint gate 位置两态）。
 * 本文件启动真实 tsx 子进程 → 已登记 config/vitest.config.ts 的 SUBPROCESS_TEST_FILES
 * （vitest-project-split 双向守护）。**不 spawn 全量 vitest**。
 */

import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '..', '..', '..');
const CLI_DIR = path.join(REPO_ROOT, 'w-model-dev', 'scripts', 'cli');
const RUN_LOG_CLI = path.join(CLI_DIR, 'check-run-log.ts');
const CHECKPOINT_CLI = path.join(CLI_DIR, 'check-checkpoint.ts');

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'checkpoint-r0-bootstrap-cli-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

/** 真实 tsx 子进程运行被测 CLI（60s 超时：并行时 tsx 冷启动可超 runSync 缺省值）。 */
function runCli(script: string, args: string[]): { code: number | null; stdout: string; stderr: string } {
  const result = runSync(process.execPath, [tsxCli, script, ...args], {
    cwd: REPO_ROOT,
    timeout: 60_000,
    env: process.env,
  });
  return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

/** run-log 单条记录（schema 必需 12 字段齐备；phase-1 夹具共用形态）。 */
function entry(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    runId: 'run-default',
    timestamp: '2026-09-22T00:00:00Z',
    phase: 1,
    phaseName: '需求与范围',
    action: 'produce',
    role: 'S',
    duration_s: 10,
    tokens: 100,
    estimated: false,
    subagentSpawns: 0,
    gateExitCode: null,
    outcome: 'success',
    ...overrides,
  };
}

/** 阶段前置：A chunk → S cross → S produce → V review（R1 动作完整性）。 */
function phaseLead(): Array<Record<string, unknown>> {
  return [
    entry({ runId: 'a1', timestamp: '2026-09-22T00:00:00Z', action: 'chunk', role: 'A' }),
    entry({ runId: 'x1', timestamp: '2026-09-22T00:01:00Z', action: 'cross', role: 'S' }),
    entry({ runId: 'p1', timestamp: '2026-09-22T00:02:00Z', action: 'produce', role: 'S' }),
    entry({ runId: 'v1', timestamp: '2026-09-22T00:03:00Z', action: 'review', role: 'V' }),
  ];
}

/** 闭环 gate 记录（role=G + success + gateExitCode=0 + script）。 */
function closureGate(script: string, timestamp: string): Record<string, unknown> {
  return entry({
    runId: `g-${script}`,
    timestamp,
    action: 'gate',
    role: 'G',
    gateExitCode: 0,
    script,
  });
}

/** 放行记录（阶段末条；acknowledgedDecisions 满足 R2 具体性 + R4 阶段关键词）。 */
function release(timestamp: string): Record<string, unknown> {
  return entry({
    runId: 'c1',
    timestamp,
    action: 'checkpoint',
    role: 'O',
    gateExitCode: 0,
    acknowledgedDecisions: ['阶段 1 需求基线 REQ-001..REQ-008 冻结，非功能约束已登记'],
  });
}

/**
 * 最小 phase-1 自举时序 run-log 行集。
 * `mode: 'natural'`：五条闭环 gate 全部在放行记录之前（check-checkpoint 00:04:04 < 放行 00:05），
 * 放行为阶段末条。`mode: 'd6'`：check-checkpoint 的 gate 记录（00:06）**移到放行记录之后**
 * （数组位置与时间戳一致后移）——即 D-6 后置窗口形态，R8 轨迹模板对其报恰 3 条违规。
 */
function bootstrapRunLogLines(mode: 'natural' | 'd6'): string[] {
  const checkpointGateAt = mode === 'natural' ? '2026-09-22T00:04:04Z' : '2026-09-22T00:06:00Z';
  const lines = [
    ...phaseLead(),
    closureGate('check-budget.ts', '2026-09-22T00:04:00Z'),
    closureGate('check-run-log.ts', '2026-09-22T00:04:01Z'),
    closureGate('check-maturity.ts', '2026-09-22T00:04:02Z'),
    closureGate('check-preventive-review.ts', '2026-09-22T00:04:03Z'),
    ...(mode === 'natural' ? [closureGate('check-checkpoint.ts', checkpointGateAt)] : []),
    release('2026-09-22T00:05:00Z'),
    ...(mode === 'd6' ? [closureGate('check-checkpoint.ts', checkpointGateAt)] : []),
  ];
  return lines.map((e) => JSON.stringify(e));
}

async function writeRunLog(name: string, lines: string[]): Promise<string> {
  const abs = path.join(tmpDir, name);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- abs 由本测试创建于 os.tmpdir() 下的固定临时目录拼装，仅写入 fixture
  await fs.writeFile(abs, lines.join('\n') + '\n', 'utf8');
  return abs;
}

/** checkpoint-log 目录（非空 = 一条 phase-1 用户确认；可传空目录模拟 no-phase-match）。 */
async function writeCheckpointLog(fileNames: string[]): Promise<string> {
  const dir = path.join(tmpDir, 'clog');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- dir 由本测试创建于 os.tmpdir() 下的固定临时目录拼装，仅建 fixture 目录
  await fs.mkdir(dir, { recursive: true });
  for (const [i, name] of fileNames.entries()) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- dir/name 均为本测试自建的 os.tmpdir() 临时 fixture 路径
    await fs.writeFile(path.join(dir, name), `同意放行：阶段 1 需求基线 REQ-001..REQ-008 冻结（user-${i}）\n`, 'utf8');
  }
  return dir;
}

interface JsonReportShape {
  passed: boolean;
  reasons: string[];
  diagnostics?: string[];
  r11?: { checkedGates: number; missing: number };
  exitCode: number;
}

function parseJsonReport(stdout: string): JsonReportShape {
  return JSON.parse(stdout.trim()) as JsonReportShape;
}

describe('E-2 方案 B：phase-1 自举时序端到端（真实子进程）', () => {
  it('自然时序（确认落盘 → 闭环五门 → 写放行记录）→ check-run-log exit 0 且无 R8/R11 违规', async () => {
    const runLog = await writeRunLog('natural.jsonl', bootstrapRunLogLines('natural'));
    const run = runCli(RUN_LOG_CLI, [runLog, '--json']);
    expect(run.code, `stderr=${run.stderr}\nstdout=${run.stdout}`).toBe(0);
    const report = parseJsonReport(run.stdout);
    expect(report.passed).toBe(true);
    expect(report.reasons.some((v) => v.startsWith('R8:'))).toBe(false);
    expect(report.reasons.some((v) => v.startsWith('R11:'))).toBe(false);
    expect(report.r11).toEqual({ checkedGates: 1, missing: 0 });
  });

  it('D-6 时序（check-checkpoint 记录后置于放行）→ exit 1 恰 3 条 R8（后置窗口不合法化 R8，反放回归）', async () => {
    const runLog = await writeRunLog('d6order.jsonl', bootstrapRunLogLines('d6'));
    const run = runCli(RUN_LOG_CLI, [runLog, '--json']);
    expect(run.code, `stderr=${run.stderr}\nstdout=${run.stdout}`).toBe(1);
    const report = parseJsonReport(run.stdout);
    expect(report.passed).toBe(false);
    const r8 = report.reasons.filter((v) => v.startsWith('R8:'));
    expect(r8).toHaveLength(3);
    expect(r8.every((v) => v.includes('阶段 1'))).toBe(true);
    expect(report.reasons.some((v) => v.startsWith('R11:'))).toBe(false);
  });

  it('零记录态 + checkpoint-log 确认在场 → check-checkpoint exit 0 且含 BOOTSTRAP_VALIDATION 诊断', async () => {
    // 放行前的自然时序中间态：run-log 仅有 chunk+cross（零 checkpoint 记录）——旧 R0 在此必红
    const preLog = await writeRunLog(
      'pre.jsonl',
      [
        entry({ runId: 'a1', action: 'chunk', role: 'A' }),
        entry({ runId: 'x1', timestamp: '2026-09-22T00:01:00Z', action: 'cross', role: 'S' }),
      ].map((e) => JSON.stringify(e)),
    );
    const clog = await writeCheckpointLog(['phase-1.txt']);
    const run = runCli(CHECKPOINT_CLI, [preLog, `--checkpoint-log=${clog}`, '--json']);
    expect(run.code, `stderr=${run.stderr}\nstdout=${run.stdout}`).toBe(0);
    const report = parseJsonReport(run.stdout);
    expect(report.passed).toBe(true);
    expect(report.reasons.some((v) => v.includes('零证据不等于合规'))).toBe(false);
    expect((report.diagnostics ?? []).some((d) => d.startsWith('BOOTSTRAP_VALIDATION:'))).toBe(true);
  });

  it('零记录态 + checkpoint-log 无 phase-N 匹配 → check-checkpoint exit 1 且 R0 文案保留（fail-closed 回归）', async () => {
    const preLog = await writeRunLog('pre-empty.jsonl', [
      JSON.stringify(entry({ runId: 'a1', action: 'chunk', role: 'A' })),
    ]);
    const emptyClog = await writeCheckpointLog([]);
    const run = runCli(CHECKPOINT_CLI, [preLog, `--checkpoint-log=${emptyClog}`, '--json']);
    expect(run.code, `stderr=${run.stderr}\nstdout=${run.stdout}`).toBe(1);
    const report = parseJsonReport(run.stdout);
    expect(report.passed).toBe(false);
    expect(report.reasons.some((v) => v.includes('零证据不等于合规'))).toBe(true);
    expect((report.diagnostics ?? []).some((d) => d.startsWith('BOOTSTRAP_VALIDATION:'))).toBe(false);
  });
});
