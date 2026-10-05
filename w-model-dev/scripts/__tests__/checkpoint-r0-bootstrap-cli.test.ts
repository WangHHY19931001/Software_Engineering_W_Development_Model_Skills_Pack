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
 *      且 R0 文案保留（fail-closed 回归）；
 *   5. 零记录态 + checkpoint-log 仅含 phase-2 确认 → check-checkpoint.ts exit 1 且
 *      R0 文案保留（修复轮 1 相位缝隙负例：自举条件收紧为 get('1') 非空白，加载器
 *      历史宽松形态使任意 phase-<数字> 文件计入 Map，由 get('1') 兜住）；
 *      同组第三态：仅 legacy 命名 phase-1.txt → no-phase-match exit 1（canonical 收窄
 *      反例，锁死 CANONICAL_PHASE_FILE 被回宽为旧宽松正则）。
 *   6. 同 phase 双候选（phase-1.md 与 phase-1.txt 并存）→ check-checkpoint.ts exit 1
 *      且 stderr 列出两冲突路径（C14/D3 canonical 形态 phase-<N>.md + 歧义 fail-closed，
 *      42.13.0 起；不再由 readdir 顺序静默择一胜出）。
 *
 * 夹具文法参照 run-log-logic.test.ts「R11 阶段 1 自举豁免（D-6）」组的 phase-1 形态
 * （phaseLead → 四门 gate → checkpoint / check-checkpoint gate 位置两态）。
 * 本文件启动真实 tsx 子进程 → 已登记 config/vitest.config.ts 的 SUBPROCESS_TEST_FILES
 * （vitest-project-split 双向守护）。**不 spawn 全量 vitest**。
 */

import { spawnSync } from 'node:child_process';
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
const WM_STATUS_CLI = path.join(CLI_DIR, 'wm-status.ts');

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

/**
 * checkpoint-log 目录（非空 = 一条 phase-1 用户确认；可传空目录模拟 no-phase-match）。
 * `subdir`：同一 it 内多行用例（负例组）须各传互异子目录，避免行间文件叠加污染
 * （如「仅 legacy 命名」行被前一行的 phase-2.md 修正为「混合目录」态）。
 */
async function writeCheckpointLog(fileNames: string[], subdir = 'clog'): Promise<string> {
  const dir = path.join(tmpDir, subdir);
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
    const clog = await writeCheckpointLog(['phase-1.md']);
    const run = runCli(CHECKPOINT_CLI, [preLog, `--checkpoint-log=${clog}`, '--json']);
    expect(run.code, `stderr=${run.stderr}\nstdout=${run.stdout}`).toBe(0);
    const report = parseJsonReport(run.stdout);
    expect(report.passed).toBe(true);
    expect(report.reasons.some((v) => v.includes('零证据不等于合规'))).toBe(false);
    expect((report.diagnostics ?? []).some((d) => d.startsWith('BOOTSTRAP_VALIDATION:'))).toBe(true);
  });

  it('零记录态负例组（3 态：无 phase-N 匹配 / 仅 phase-2 确认无 phase-1 / 仅 legacy 命名）→ exit 1 且 R0 文案保留（fail-closed 回归）', async () => {
    // 第二态为审查复现态（修复轮 1）：加载器按 canonical 形态 phase-<N>.md 加载，仅含
    // phase-2.md 的目录加载为非空 Map——初版「Map 非空」在此 exit 0，穿透「零证据不等于合规」。
    // 收紧为 `get('1')` 非空白后，此态维持违规（零放行记录 ⇒ 下一次放行必为首放行，仅首放行
    // 确认可支撑自举）。
    // 第三态为 canonical 收窄反例（C14/D3 审查修复）：目录仅含 legacy 命名 phase-1.txt——若
    // CANONICAL_PHASE_FILE 被回宽为旧宽松正则（(?:phase-|checkpoint-)?(\d+)\.(?:txt|md|log)$），
    // 此态会加载出 phase-1 确认 → BOOTSTRAP_VALIDATION → exit 0，本用例即刻转红锁死回宽。
    const rows: ReadonlyArray<{ name: string; clogFiles: string[]; expectedStderrPattern?: RegExp }> = [
      { name: 'checkpoint-log 无 phase-N 匹配', clogFiles: [] },
      { name: 'checkpoint-log 仅含 phase-2 确认（无 phase-1）', clogFiles: ['phase-2.md'] },
      {
        name: 'checkpoint-log 仅 legacy 命名 phase-1.txt（canonical 收窄反例，no-phase-match）',
        clogFiles: ['phase-1.txt'],
        expectedStderrPattern: /未匹配到 canonical 形态 phase-<N>\.md 文件/,
      },
    ];
    for (const [rowIdx, row] of rows.entries()) {
      const preLog = await writeRunLog('pre-negative.jsonl', [
        JSON.stringify(entry({ runId: 'a1', action: 'chunk', role: 'A' })),
      ]);
      // 每行独立子目录：防止前一行文件叠加污染本行目录语义（见 writeCheckpointLog 注释）
      const clog = await writeCheckpointLog([...row.clogFiles], `clog-neg-${rowIdx}`);
      const run = runCli(CHECKPOINT_CLI, [preLog, `--checkpoint-log=${clog}`, '--json']);
      expect(run.code, `${row.name}：应 exit 1（stderr=${run.stderr}\nstdout=${run.stdout}）`).toBe(1);
      const report = parseJsonReport(run.stdout);
      expect(report.passed, `${row.name}：应不通过`).toBe(false);
      expect(
        report.reasons.some((v) => v.includes('零证据不等于合规')),
        `${row.name}：R0 文案保留`,
      ).toBe(true);
      expect(
        (report.diagnostics ?? []).some((d) => d.startsWith('BOOTSTRAP_VALIDATION:')),
        `${row.name}：不得出现 BOOTSTRAP_VALIDATION 诊断`,
      ).toBe(false);
      if (row.expectedStderrPattern) {
        expect(run.stderr, `${row.name}：stderr 须含 canonical 收窄 no-phase-match 警告`).toMatch(
          row.expectedStderrPattern,
        );
      }
    }
  });

  it('同 phase 双候选（phase-1.md 与 phase-1.txt 并存）→ exit 1 且 stderr 列出两冲突路径（C14/D3 歧义 fail-closed）', async () => {
    // canonical 形态为 phase-<N>.md；phase-1.txt 与其并存构成同 phase 命名歧义 →
    // 既有 violation 失败路径 exit 1（非 exit 2 ARG_INVALID 域），消息列出两冲突路径，
    // 不再由 readdir 顺序静默择一胜出。
    const preLog = await writeRunLog('pre-ambiguous.jsonl', [
      JSON.stringify(entry({ runId: 'a1', action: 'chunk', role: 'A' })),
    ]);
    const clog = await writeCheckpointLog(['phase-1.md', 'phase-1.txt']);
    const run = runCli(CHECKPOINT_CLI, [preLog, `--checkpoint-log=${clog}`, '--json']);
    expect(run.code, `应 exit 1（stderr=${run.stderr}\nstdout=${run.stdout}）`).toBe(1);
    expect(run.stderr, 'stderr 须列出两冲突路径（phase-1.md）').toContain('phase-1.md');
    expect(run.stderr, 'stderr 须列出两冲突路径（phase-1.txt）').toContain('phase-1.txt');
    const report = parseJsonReport(run.stdout);
    expect(report.passed).toBe(false);
    expect(
      report.reasons.some(
        (v) => v.includes('同 phase 双候选文件歧义') && v.includes('phase-1.md') && v.includes('phase-1.txt'),
      ),
      'violations 须承载含两冲突路径的歧义消息',
    ).toBe(true);
    expect(
      (report.diagnostics ?? []).some((d) => d.startsWith('BOOTSTRAP_VALIDATION:')),
      '歧义态不得出现 BOOTSTRAP_VALIDATION 诊断',
    ).toBe(false);
  });
});

describe('CLI 入口无 VITEST 环境旁路（C1 反证，真实子进程）', () => {
  it('VITEST=1 环境下 CLI 必须正常执行而非静默 exit 0（C1 反证）', () => {
    // 直接 spawnSync 而非 runSync：runSync 的 childProcessEnv 会剥离 VITEST，
    // 无法构造「子进程带 VITEST」的旁路形态；台账登记见 lib/run-sync.ts
    // SYNC_PROCESS_EXCEPTIONS（本文件唯一直接同步调用）。
    const result = spawnSync(process.execPath, [tsxCli, WM_STATUS_CLI], {
      cwd: REPO_ROOT,
      timeout: 60_000,
      encoding: 'utf-8',
      env: { ...process.env, VITEST: '1' },
    });
    // spawn 级失败（如 ENOENT / 超时被杀）时 status 为 null，下方三支断言的
    // `status !== 0` 分支恒真 → 空洞通过；先断言无 spawn 错误再查旁路形态。
    expect(result.error).toBeUndefined();
    // 断言「有输出/有行为」，杜绝静默通过：旧旁路（run-main.ts 的
    // `if (process.env.VITEST) return;`）下本用例形态 = exit 0 且零输出。
    expect(
      (result.stdout ?? '') !== '' || (result.stderr ?? '') !== '' || result.status !== 0,
      `VITEST=1 下 CLI 被静默跳过（status=${String(result.status)}，stdout=${JSON.stringify(result.stdout)}，stderr=${JSON.stringify(result.stderr)}）`,
    ).toBe(true);
  });
});
