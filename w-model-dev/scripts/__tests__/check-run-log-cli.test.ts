/**
 * check-run-log.ts R6 交叉校验默认化（批次 6 A3 后半）——真实子进程 CLI 测试
 *
 * 红队穿透面：伪造 run-log 的 gate 记录携带 gateLogPath + gateExitCode=0，
 * 只要不传 --gate-logs 即可绕过 R6 交叉校验（gate-log 文件根本不存在也 exit 0）。
 * 本组锁定新契约：不传 --gate-logs 时默认解析 run-log 同目录约定路径 `gate-logs/`，
 * R6 无条件执行——
 *   - gate-logs 目录整体缺失且存在带 gateLogPath + 数字 gateExitCode 的 gate 记录 → 一条汇总 blocking；
 *   - 目录在场但记录引用文件缺失/不可读 → blocking `gate-log 文件缺失`；
 *   - 文件在场但顶层 exitCode 与记录 gateExitCode 不符 → blocking `gate-log exitCode 与记录不符`；
 *   - 文件在场但非 JSON / 顶层 exitCode 非 number → 同一条 `gate-log exitCode 与记录不符`
 *     （fail-closed：默认路径不回退旧 `*_JSON {...}` 摘要提取，损坏证据不得被静默吞掉）；
 *   - 文件在场且 exitCode 一致 → exit 0（不再需要 --gate-logs）。
 *
 * 判定口径与 logic 层 R6 交叉校验前置一致（`gateLogPath` 已设且 `gateExitCode` 为 number）；
 * `--gate-logs` 显式传参保留旧整目录装载语义（覆盖参数），不在本组覆盖范围。
 */
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, afterEach } from 'vitest';

import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const RUN_LOG_CLI = path.resolve(TEST_DIR, '../cli/check-run-log.ts');

let tmpDir: string;
/**
 * 本文件全部临时目录（仓内 tmpDirs 约定，同 change-scope / check-coding-plan 测试）：
 * T13 的两处「循环内 makeTmpDir」会把 tmpDir 变量覆盖成最后一个，earlier 目录在 afterEach
 * 只清最后一处 → 临时目录泄漏；改为入账数组、afterEach 全量清理（每轮仍独立目录，保住用例隔离）。
 */
const tmpDirs: string[] = [];

afterEach(async () => {
  for (const dir of tmpDirs.splice(0)) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

async function makeTmpDir(): Promise<string> {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-run-log-r6-default-'));
  tmpDirs.push(tmpDir);
  return tmpDir;
}

/** run-log 单条记录（schema 必需 12 字段齐备；与 checkpoint-r0-bootstrap-cli 同形态）。 */
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
    entry({
      runId: 'a1',
      timestamp: '2026-09-22T00:00:00Z',
      action: 'chunk',
      role: 'A',
    }),
    entry({
      runId: 'x1',
      timestamp: '2026-09-22T00:01:00Z',
      action: 'cross',
      role: 'S',
    }),
    entry({
      runId: 'p1',
      timestamp: '2026-09-22T00:02:00Z',
      action: 'produce',
      role: 'S',
    }),
    entry({
      runId: 'v1',
      timestamp: '2026-09-22T00:03:00Z',
      action: 'review',
      role: 'V',
    }),
  ];
}

/** 闭环 gate 记录（role=G + success + gateExitCode=0 + script）。 */
function closureGate(
  script: string,
  timestamp: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return entry({
    runId: `g-${script}`,
    timestamp,
    action: 'gate',
    role: 'G',
    gateExitCode: 0,
    script,
    ...overrides,
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
 * 最小合法 phase-1 自举 run-log（自然时序：五门严格早于放行，R1-R11 全过）。
 * `gateLogPath` 指定携带证据引用的闭环 gate 记录路径（默认无引用 → 不触发 R6 默认核验）。
 */
function validRunLogLines(gateLogPath?: string): string[] {
  const lines = [
    ...phaseLead(),
    closureGate('check-budget.ts', '2026-09-22T00:04:00Z', gateLogPath ? { gateLogPath } : {}),
    closureGate('check-run-log.ts', '2026-09-22T00:04:01Z'),
    closureGate('check-maturity.ts', '2026-09-22T00:04:02Z'),
    closureGate('check-preventive-review.ts', '2026-09-22T00:04:03Z'),
    closureGate('check-checkpoint.ts', '2026-09-22T00:04:04Z'),
    release('2026-09-22T00:05:00Z'),
  ];
  return lines.map((e) => JSON.stringify(e));
}

async function writeRunLog(lines: string[]): Promise<string> {
  const abs = path.join(tmpDir, 'run-log.jsonl');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- abs 由本测试创建于 os.tmpdir() 下的固定临时目录拼装，仅写入 fixture
  await fs.writeFile(abs, lines.join('\n') + '\n', 'utf8');
  return abs;
}

/**
 * 最小合法 gate-log（满足 gate-log.schema.json：check-bdd-model.ts 绑定 bddSummary 形态）。
 */
function gateLogPayload(exitCode: number): Record<string, unknown> {
  const passed = exitCode === 0;
  return {
    script: 'check-bdd-model.ts',
    exitCode,
    passed,
    reasons: [],
    reportSummary: {
      phase: 1,
      checkedAt: '2026-09-22T00:04:00.000Z',
      summary: passed
        ? 'BDD model check passed for R6 default fixture'
        : 'BDD model check failed for R6 default fixture',
      violationsCount: 0,
      exitCode,
      passed,
    },
    stdoutSummary: { exitCode, passed },
  };
}

/** 在 tmpDir 下写同目录约定 gate-logs/ 伴生文件（相对路径 'gate-logs/<name>'）。 */
async function writeCompanionGateLog(name: string, exitCode: number): Promise<void> {
  const dir = path.join(tmpDir, 'gate-logs');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- dir 由本测试创建于 os.tmpdir() 下的固定临时目录拼装
  await fs.mkdir(dir, { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同上，fixture 写入
  await fs.writeFile(path.join(dir, name), JSON.stringify(gateLogPayload(exitCode)), 'utf8');
}

/** 在 tmpDir 下写同目录约定 gate-logs/ 伴生**原始内容**（损坏态 fixture，不经过 JSON 序列化）。 */
async function writeCompanionGateLogRaw(name: string, content: string): Promise<void> {
  const dir = path.join(tmpDir, 'gate-logs');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- dir 由本测试创建于 os.tmpdir() 下的固定临时目录拼装
  await fs.mkdir(dir, { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同上，fixture 写入
  await fs.writeFile(path.join(dir, name), content, 'utf8');
}

interface JsonReportShape {
  passed: boolean;
  reasons: string[];
  exitCode: number;
}

function runCli(runLog: string): {
  code: number | null;
  stdout: string;
  stderr: string;
} {
  const result = runSync(process.execPath, [tsxCli, RUN_LOG_CLI, runLog, '--json'], {
    cwd: tmpDir,
    timeout: 60_000,
    env: process.env,
  });
  return {
    code: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/** 人类可读通道（不带 --json）：摘要为 `RUN_LOG_JSON <json>` 单行，供 Agent 正则截取。 */
function runCliHuman(runLog: string): {
  summary: Record<string, unknown> | null;
  stdout: string;
} {
  const result = runSync(process.execPath, [tsxCli, RUN_LOG_CLI, runLog], {
    cwd: tmpDir,
    timeout: 60_000,
    env: process.env,
  });
  const stdout = result.stdout ?? '';
  const line = stdout.split(/\r?\n/).find((l) => l.startsWith('RUN_LOG_JSON '));
  return {
    summary: line === undefined ? null : (JSON.parse(line.slice('RUN_LOG_JSON '.length)) as Record<string, unknown>),
    stdout,
  };
}

describe('check-run-log R6 交叉校验默认化（批次 6 A3 后半，不传 --gate-logs）', () => {
  it('同目录 gate-logs/ 目录整体缺失 + gate 记录带 gateLogPath → exit 1 且一条汇总 R6 违规', async () => {
    await makeTmpDir();
    const runLog = await writeRunLog(validRunLogLines('gate-logs/missing.json'));
    const r = runCli(runLog);
    expect(r.code, `stderr=${r.stderr}\nstdout=${r.stdout}`).toBe(1);
    const report = JSON.parse(r.stdout) as JsonReportShape;
    expect(report.passed).toBe(false);
    const r6 = report.reasons.filter((v) => v.startsWith('R6:'));
    expect(r6).toHaveLength(1); // 目录整体缺失 → 一条汇总违规，不逐条展开
    expect(r6[0]).toContain('gate-logs 目录缺失');
  });

  it('同目录 gate-logs/ 在场但记录引用文件缺失 → exit 1 且 gate-log 文件缺失', async () => {
    await makeTmpDir();
    await writeCompanionGateLog('unrelated.json', 0); // 目录在场（否则走汇总形态）
    const runLog = await writeRunLog(validRunLogLines('gate-logs/absent.json'));
    const r = runCli(runLog);
    expect(r.code, `stderr=${r.stderr}\nstdout=${r.stdout}`).toBe(1);
    const report = JSON.parse(r.stdout) as JsonReportShape;
    const r6 = report.reasons.filter((v) => v.startsWith('R6:'));
    expect(r6.some((v) => v.includes('gate-log 文件缺失：gate-logs/absent.json'))).toBe(true);
  });

  it('gate-log 在场但顶层 exitCode 与记录 gateExitCode 不符 → exit 1 且 gate-log exitCode 与记录不符', async () => {
    await makeTmpDir();
    await writeCompanionGateLog('gate-evidence.json', 1); // 文件说 1，记录说 0
    const runLog = await writeRunLog(validRunLogLines('gate-logs/gate-evidence.json'));
    const r = runCli(runLog);
    expect(r.code, `stderr=${r.stderr}\nstdout=${r.stdout}`).toBe(1);
    const report = JSON.parse(r.stdout) as JsonReportShape;
    const r6 = report.reasons.filter((v) => v.startsWith('R6:'));
    expect(r6.some((v) => v.includes('gate-log exitCode 与记录不符：gate-logs/gate-evidence.json'))).toBe(true);
  });

  it('gate-log 非 JSON → 默认路径 R6 fail-closed exit 1', async () => {
    // 两形态同判：(a) 纯垃圾内容；(b) 含旧 `*_JSON {...}` 摘要标记但整体非 JSON 文档——
    // (b) 若默认路径回退旧摘要提取即可读出 exitCode=0 与记录一致而放行，故一并锁定
    // 「损坏证据 fail-closed，不回退旧提取路径」。
    for (const [label, content] of [
      ['纯非 JSON 内容', '<not-json truncated'],
      ['含旧 BUDGET_JSON 摘要标记但非 JSON 文档', 'BUDGET_JSON {"exitCode":0,"passed":true}\n<not-json truncated'],
    ] as const) {
      await makeTmpDir();
      await writeCompanionGateLogRaw('broken.json', content);
      const runLog = await writeRunLog(validRunLogLines('gate-logs/broken.json'));
      const r = runCli(runLog);
      expect(r.code, `${label}: stderr=${r.stderr}\nstdout=${r.stdout}`).toBe(1);
      const report = JSON.parse(r.stdout) as JsonReportShape;
      expect(report.passed, label).toBe(false);
      const r6 = report.reasons.filter((v) => v.startsWith('R6:'));
      expect(r6, label).toEqual([expect.stringContaining('R6: gate-log exitCode 与记录不符：gate-logs/broken.json')]);
      expect(r6[0], label).toContain('gate-log 未提取到合法顶层 exitCode');
    }
  });

  it('gate-log 顶层 exitCode 非 number → 默认路径 R6 fail-closed exit 1', async () => {
    // 伪造形态：JSON 合法、passed/摘要字段齐备，仅顶层 exitCode 类型被换掉（字符串 "0" / null / true）。
    // 默认路径只认「顶层 exitCode 为 number」，类型不符一律按不符 fail-closed，不得按真值比较放行。
    for (const [label, exitCode] of [
      ['字符串 "0"', '0'],
      ['null', null],
      ['boolean true', true],
    ] as const) {
      await makeTmpDir();
      const payload: Record<string, unknown> = { ...gateLogPayload(0), exitCode };
      await writeCompanionGateLogRaw('spoofed.json', JSON.stringify(payload));
      const runLog = await writeRunLog(validRunLogLines('gate-logs/spoofed.json'));
      const r = runCli(runLog);
      expect(r.code, `${label}: stderr=${r.stderr}\nstdout=${r.stdout}`).toBe(1);
      const report = JSON.parse(r.stdout) as JsonReportShape;
      expect(report.passed, label).toBe(false);
      const r6 = report.reasons.filter((v) => v.startsWith('R6:'));
      expect(r6, label).toEqual([expect.stringContaining('R6: gate-log exitCode 与记录不符：gate-logs/spoofed.json')]);
      expect(r6[0], label).toContain('gate-log 未提取到合法顶层 exitCode');
    }
  });

  it('gate-log 在场且 exitCode 一致 → exit 0（不再需要 --gate-logs）', async () => {
    await makeTmpDir();
    await writeCompanionGateLog('gate-evidence.json', 0);
    const runLog = await writeRunLog(validRunLogLines('gate-logs/gate-evidence.json'));
    const r = runCli(runLog);
    expect(r.code, `stderr=${r.stderr}\nstdout=${r.stdout}`).toBe(0);
    const report = JSON.parse(r.stdout) as JsonReportShape;
    expect(report.passed).toBe(true);
    expect(report.exitCode).toBe(0);
  });

  it('gateLogPath 为绝对路径时按原样解析（指向一致文件 → exit 0）', async () => {
    await makeTmpDir();
    const dir = path.join(tmpDir, 'gate-logs');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- dir 由本测试创建于 os.tmpdir() 下的固定临时目录拼装
    await fs.mkdir(dir, { recursive: true });
    const absFile = path.join(dir, 'abs-evidence.json');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同上，fixture 写入
    await fs.writeFile(absFile, JSON.stringify(gateLogPayload(0)), 'utf8');
    const runLog = await writeRunLog(validRunLogLines(absFile));
    const r = runCli(runLog);
    expect(r.code, `stderr=${r.stderr}\nstdout=${r.stdout}`).toBe(0);
  });
});

describe('check-run-log A17：durationMs 为非确定尾部字段（43.3.0）', () => {
  it('人类通道 RUN_LOG_JSON 携带 durationMs（number），且位于 exitCode 之后（摘要尾部）', async () => {
    await makeTmpDir();
    const runLog = await writeRunLog(validRunLogLines());
    const { summary, stdout } = runCliHuman(runLog);
    expect(summary, stdout).not.toBeNull();
    expect(typeof summary!.durationMs, stdout).toBe('number');
    expect(summary!.exitCode, stdout).toBe(0);
    const keys = Object.keys(summary!);
    // 非确定运行时字段置于摘要尾部：durationMs 键序在 exitCode 之后
    expect(keys.indexOf('durationMs')).toBeGreaterThan(keys.indexOf('exitCode'));
    // 确定字段（exitCode 前的判定字段）仍按原序出现
    expect(keys.indexOf('passed')).toBeLessThan(keys.indexOf('exitCode'));
  });

  it('机器通道 --json 仍不携带 durationMs（行为不变守卫）', async () => {
    await makeTmpDir();
    const runLog = await writeRunLog(validRunLogLines());
    const r = runCli(runLog);
    expect(r.code, `stderr=${r.stderr}\nstdout=${r.stdout}`).toBe(0);
    const report = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(report.durationMs).toBeUndefined();
    expect(report.exitCode).toBe(0);
  });
});
