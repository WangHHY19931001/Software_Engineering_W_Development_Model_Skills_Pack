/**
 * lib/gate-report.ts 单元测试
 *
 * 覆盖：
 *   - 分隔线 '─'.repeat(60)
 *   - `${label}_JSON ` 行首标记（空格分隔，供 Agent 正则截取）
 *   - JSON 摘要含全部 summary 键 + exitCode 键（追加在末尾）
 *   - 不调用 process.exit，由调用方负责设置 process.exitCode
 */

import { promises as fs } from 'node:fs';
import * as fsSync from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi, afterEach } from 'vitest';

import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';
import { runSync } from '../lib/run-sync.js';
import { writeGateLog } from '../lib/gate-log-writer.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const CHECK_RUN_LOG_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli/check-run-log.ts');
const CHECK_ICEBERG_SWEEP_SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../cli/check-iceberg-sweep.ts',
);
const CHECK_BDD_MODEL_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli/check-bdd-model.ts');
const CHECK_PREVENTIVE_REVIEW_SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../cli/check-preventive-review.ts',
);
const CHECK_TLA_BDD_SYNC_SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../cli/check-tla-bdd-sync.ts',
);
const CHECK_ARTIFACT_GATE_SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../cli/check-artifact-gate.ts',
);
const ICEBERG_VALID_SAMPLE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../samples/iceberg/valid-full.json',
);
const CHECK_SAMPLES_COVERAGE_SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../cli/check-samples-coverage.ts',
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('printGateReport', () => {
  it('输出分隔线 + `${label}_JSON ` 前缀 + 摘要含 exitCode 键，但不直接调用 process.exit', () => {
    const exitSpy = vi.spyOn(process, 'exit');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    printGateReport('MATURITY', { type: 'maturity', passed: true, violations: [] }, 0);

    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenNthCalledWith(1, '─'.repeat(60));
    expect(logSpy).toHaveBeenNthCalledWith(
      2,
      'MATURITY_JSON ' + JSON.stringify({ type: 'maturity', passed: true, violations: [], exitCode: 0 }),
    );
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exitCode 键追加在 JSON 末尾（summary 展开之后），原 summary 键顺序不变', () => {
    const exitSpy = vi.spyOn(process, 'exit');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const summary = { type: 'run-log', passed: false, violations: ['v1'] };
    printGateReport('RUN_LOG', summary, 1);

    const jsonLine = logSpy.mock.calls[1]![0] as string;
    expect(jsonLine.startsWith('RUN_LOG_JSON ')).toBe(true);
    expect(jsonLine).toBe('RUN_LOG_JSON ' + JSON.stringify({ ...summary, exitCode: 1 }));
    expect(jsonLine.endsWith('"exitCode":1}')).toBe(true);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('非 0/1 exit code（如错误路径 2）原样输出且不直接退出', () => {
    const exitSpy = vi.spyOn(process, 'exit');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    printGateReport('CONTRACT', { passed: false }, 2);
    expect(logSpy).toHaveBeenNthCalledWith(2, 'CONTRACT_JSON ' + JSON.stringify({ passed: false, exitCode: 2 }));
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('summary 自带 exitCode 键时被末位实参覆盖（值与位置以函数签名参数为准）', () => {
    const exitSpy = vi.spyOn(process, 'exit');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    printGateReport('GATE', { passed: true, exitCode: 9 }, 0);
    expect(logSpy).toHaveBeenNthCalledWith(2, 'GATE_JSON ' + JSON.stringify({ passed: true, exitCode: 0 }));
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

describe('printJsonReport（--json 机器可读报告）', () => {
  it('stdout 仅输出单行 JSON（无分隔线），含全部 JsonReport 字段 + 末尾 exitCode，且不调用 process.exit', () => {
    const exitSpy = vi.spyOn(process, 'exit');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    printJsonReport(
      {
        type: 'run-log',
        passed: false,
        reasons: ['r1', 'r2'],
        violations: [{ rule: 'violation', count: 2 }],
        durationMs: 42,
      },
      1,
    );

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0]![0] as string;
    // 无分隔线、无 LABEL_JSON 前缀，可整体 JSON.parse
    expect(line).not.toContain('─');
    expect(line).not.toContain('═');
    expect(line).not.toContain('_JSON');
    expect(line).toBe(
      JSON.stringify({
        type: 'run-log',
        passed: false,
        reasons: ['r1', 'r2'],
        violations: [{ rule: 'violation', count: 2 }],
        durationMs: 42,
        exitCode: 1,
      }),
    );
    // exitCode 由调用方处理：printJsonReport 自身不退出
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

describe('buildViolationDistribution（violations 分布聚合）', () => {
  it('有 structuredViolations 时按 rule 聚合（保留各规则计数）', () => {
    const dist = buildViolationDistribution(3, [
      { rule: 'D1', message: 'a' },
      { rule: 'D2', message: 'b' },
      { rule: 'D1', message: 'c' },
    ]);
    expect(dist).toEqual([
      { rule: 'D1', count: 2 },
      { rule: 'D2', count: 1 },
    ]);
  });

  it('无 structuredViolations 时降级固定 violation 规则（count = 违规总数）', () => {
    expect(buildViolationDistribution(5)).toEqual([{ rule: 'violation', count: 5 }]);
  });

  it('无违规时返回空数组', () => {
    expect(buildViolationDistribution(0)).toEqual([]);
    expect(buildViolationDistribution(0, [])).toEqual([]);
  });

  it('类型放宽：可传入含 message/field 的 StructuredViolation 形状对象（message 不参与聚合计数）', () => {
    const dist = buildViolationDistribution(4, [
      { rule: 'TLA_BDD_TRANSITION', message: 'm1' },
      { rule: 'TLA_BDD_TRANSITION', message: 'm2', field: 'Next' },
      { rule: 'TLA_BDD_STATE' },
      { rule: 'TLA_BDD_INVARIANT', message: 'm4' },
    ]);
    expect(dist).toEqual([
      { rule: 'TLA_BDD_TRANSITION', count: 2 },
      { rule: 'TLA_BDD_STATE', count: 1 },
      { rule: 'TLA_BDD_INVARIANT', count: 1 },
    ]);
  });
});

describe('check-samples-coverage.ts --json（子进程冒烟：shell exit 与 JSON exitCode 一致）', () => {
  async function createSamplesCoverageFixture(withViolation: boolean): Promise<string> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-samples-coverage-json-'));
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test fixture path
    await fs.mkdir(path.join(tmpDir, 'w-model-dev', 'scripts', 'samples'), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test fixture path
    await fs.mkdir(path.join(tmpDir, 'w-model-dev', 'scripts', 'cli'), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test fixture path
    await fs.writeFile(path.join(tmpDir, 'w-model-dev', 'scripts', 'samples', 'README.md'), '', 'utf-8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test fixture path
    await fs.writeFile(path.join(tmpDir, 'w-model-dev', 'scripts', 'cli', 'self-test.ts'), '', 'utf-8');
    if (withViolation) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test fixture path
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(path.join(tmpDir, 'w-model-dev', 'scripts', 'samples', 'unregistered.json'), '{}', 'utf-8');
    }
    return tmpDir;
  }

  it('违规样本 → shell status=1 且 JSON exitCode=1', async () => {
    const tmpDir = await createSamplesCoverageFixture(true);
    try {
      const result = runSync(process.execPath, [tsxCli, CHECK_SAMPLES_COVERAGE_SCRIPT, tmpDir, '--json'], {});
      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout ?? '') as { passed: boolean; exitCode: number };
      expect(report.passed).toBe(false);
      expect(report.exitCode).toBe(1);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('无违规样本 → shell status=0 且 JSON exitCode=0', async () => {
    const tmpDir = await createSamplesCoverageFixture(false);
    try {
      const result = runSync(process.execPath, [tsxCli, CHECK_SAMPLES_COVERAGE_SCRIPT, tmpDir, '--json'], {});
      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout ?? '') as { passed: boolean; exitCode: number };
      expect(report.passed).toBe(true);
      expect(report.exitCode).toBe(0);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('check-run-log.ts --json（子进程冒烟：--json 输出纯 JSON、无分隔线、退出码一致）', () => {
  const makeRunLogEntry = (gateLogPath: string, gateExitCode: number) =>
    JSON.stringify({
      runId: 'gate-log-b1',
      timestamp: '2026-08-25T00:00:00.000Z',
      phase: 5,
      phaseName: '编码',
      action: 'gate',
      role: 'G',
      duration_s: 1,
      tokens: 1,
      estimated: false,
      subagentSpawns: 0,
      gateExitCode,
      gateLogPath,
      outcome: 'success',
      script: 'check-bdd-model.ts',
    });

  const makeGatePayload = (exitCode: number, passed = exitCode === 0) => ({
    script: 'check-bdd-model.ts',
    exitCode,
    passed,
    reasons: [],
    reportSummary: {
      phase: 1,
      checkedAt: '2026-08-25T00:00:00.000Z',
      summary: 'BDD model check passed for B1 integration fixture',
      violationsCount: 0,
      exitCode,
      passed,
    },
    stdoutSummary: { exitCode, passed },
  });

  it('writer 根 JSON 产物可由 --gate-logs 读取并参与 R6 比对', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-log-b1-'));
    try {
      const written = await writeGateLog(makeGatePayload(0), tmpDir, {
        now: () => new Date('2026-08-25T00:00:00.000Z'),
        randomUUID: () => '11111111-1111-4111-8111-111111111111',
      });
      expect(written.ok).toBe(true);
      if (!written.ok) throw new Error('expected writer output');
      const gateLogPath = path.relative(tmpDir, written.path);
      const runLog = path.join(tmpDir, 'run-log.jsonl');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(runLog, makeRunLogEntry(gateLogPath, 0) + '\n', 'utf8');
      const result = runSync(
        process.execPath,
        [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', runLog, `--gate-logs=${path.dirname(written.path)}`],
        {
          cwd: tmpDir,
        },
      );
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout ?? '')).toMatchObject({ passed: true, exitCode: 0 });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('多个合法 writer gate-log 均建立索引并参与 R6 比对', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-log-b1-'));
    try {
      const first = await writeGateLog(makeGatePayload(0), tmpDir, {
        now: () => new Date('2026-08-25T00:00:00.000Z'),
        randomUUID: () => '11111111-1111-4111-8111-111111111111',
      });
      const second = await writeGateLog(makeGatePayload(1, false), tmpDir, {
        now: () => new Date('2026-08-25T00:00:01.000Z'),
        randomUUID: () => '22222222-2222-4222-8222-222222222222',
      });
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (!first.ok || !second.ok) throw new Error('expected writer output');
      const runLog = path.join(tmpDir, 'run-log.jsonl');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(
        runLog,
        `${makeRunLogEntry(path.relative(tmpDir, first.path), 0)}\n${makeRunLogEntry(path.relative(tmpDir, second.path), 1)}\n`,
        'utf8',
      );
      const result = runSync(
        process.execPath,
        [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', runLog, `--gate-logs=${path.dirname(first.path)}`],
        { cwd: tmpDir },
      );
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout ?? '')).toMatchObject({ passed: true, exitCode: 0 });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it.each(['--gate-logs=', '--gate-logs'])(
    '显式 gate-logs 参数 %s 缺少目录值时返回结构化 exit 2',
    async (gateLogsArg) => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-log-b1-'));
      try {
        const runLog = path.join(tmpDir, 'run-log.jsonl');
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
        await fs.writeFile(runLog, makeRunLogEntry('missing.json', 0) + '\n', 'utf8');
        const result = runSync(process.execPath, [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', runLog, gateLogsArg], {
          cwd: tmpDir,
        });
        expect(result.status).toBe(2);
        expect(result.stdout).toContain('ERROR_JSON');
        expect(result.stdout).toContain('"exitCode":2');
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    },
  );

  it.each(['--gate-logs', '--gate-logs='])(
    '有效 gate-logs 后重复出现空参数 %s 时仍返回结构化 exit 2',
    async (emptyGateLogsArg) => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-log-b1-'));
      try {
        const runLog = path.join(tmpDir, 'run-log.jsonl');
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
        await fs.writeFile(runLog, makeRunLogEntry('missing.json', 0) + '\n', 'utf8');
        const result = runSync(
          process.execPath,
          [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', runLog, `--gate-logs=${tmpDir}`, emptyGateLogsArg],
          { cwd: tmpDir },
        );
        expect(result.status).toBe(2);
        expect(result.stdout).toContain('ERROR_JSON');
        expect(result.stdout).toContain('"exitCode":2');
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    },
  );

  it('协议无效的 gate-log 不得进入 R6 Map，R6 必须报告未找到合法证据', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-log-b1-'));
    try {
      const gateLogsDir = path.join(tmpDir, 'gate-logs');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- gateLogsDir is beneath the test-owned mkdtemp fixture
      await fs.mkdir(gateLogsDir);
      const payload = makeGatePayload(0);
      payload.stdoutSummary = { exitCode: 1, passed: false };
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(path.join(gateLogsDir, 'tampered.json'), JSON.stringify(payload), 'utf8');
      const runLog = path.join(tmpDir, 'run-log.jsonl');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(runLog, makeRunLogEntry('tampered.json', 0) + '\n', 'utf8');
      const result = runSync(
        process.execPath,
        [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', runLog, `--gate-logs=${gateLogsDir}`],
        { cwd: tmpDir },
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('stdoutSummary');
      expect(result.stdout).toContain('在 gate-logs 中未找到');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('Schema 无效的 gate-log 不得进入 R6 Map，R6 必须报告未找到合法证据', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-log-b1-'));
    try {
      const gateLogsDir = path.join(tmpDir, 'gate-logs');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- gateLogsDir is beneath the test-owned mkdtemp fixture
      await fs.mkdir(gateLogsDir);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(
        path.join(gateLogsDir, 'schema-invalid.json'),
        JSON.stringify({ exitCode: 0, passed: true }),
        'utf8',
      );
      const runLog = path.join(tmpDir, 'run-log.jsonl');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(runLog, makeRunLogEntry('schema-invalid.json', 0) + '\n', 'utf8');
      const result = runSync(
        process.execPath,
        [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', runLog, `--gate-logs=${gateLogsDir}`],
        { cwd: tmpDir },
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('[schema]');
      expect(result.stdout).toContain('在 gate-logs 中未找到');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('显式 --gate-logs 下的子目录读取失败为 blocking violation', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-log-b1-'));
    try {
      const gateLogsDir = path.join(tmpDir, 'gate-logs');
      const unreadableEntry = path.join(gateLogsDir, 'not-a-file');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- unreadableEntry is beneath the test-owned mkdtemp fixture
      await fs.mkdir(unreadableEntry, { recursive: true });
      const runLog = path.join(tmpDir, 'run-log.jsonl');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(runLog, makeRunLogEntry('not-a-file', 0) + '\n', 'utf8');
      const result = runSync(
        process.execPath,
        [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', runLog, `--gate-logs=${gateLogsDir}`],
        { cwd: tmpDir },
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('gate-log 文件读取失败');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('显式 --gate-logs 下缺根 exitCode 的 JSON 为 blocking violation', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-log-b1-'));
    try {
      const gateLogsDir = path.join(tmpDir, 'gate-logs');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- gateLogsDir is beneath the test-owned mkdtemp fixture
      await fs.mkdir(gateLogsDir);
      const payload = makeGatePayload(0) as Record<string, unknown>;
      delete payload.exitCode;
      delete (payload.reportSummary as Record<string, unknown>).exitCode;
      delete (payload.stdoutSummary as Record<string, unknown>).exitCode;
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(path.join(gateLogsDir, 'missing-exit-code.json'), JSON.stringify(payload), 'utf8');
      const runLog = path.join(tmpDir, 'run-log.jsonl');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(runLog, makeRunLogEntry('missing-exit-code.json', 0) + '\n', 'utf8');
      const result = runSync(
        process.execPath,
        [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', runLog, `--gate-logs=${gateLogsDir}`],
        { cwd: tmpDir },
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('未提取到合法 exitCode');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('显式 --gate-logs 的损坏文件为 blocking violation，不静默跳过', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-log-b1-'));
    try {
      const gateLogsDir = path.join(tmpDir, 'gate-logs');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- gateLogsDir is beneath the test-owned mkdtemp fixture
      await fs.mkdir(gateLogsDir);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(path.join(gateLogsDir, 'broken.json'), '{not-json', 'utf8');
      const runLog = path.join(tmpDir, 'run-log.jsonl');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(runLog, makeRunLogEntry('broken.json', 0) + '\n', 'utf8');
      const result = runSync(
        process.execPath,
        [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', runLog, `--gate-logs=${gateLogsDir}`],
        {
          cwd: tmpDir,
        },
      );
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout ?? '')).toMatchObject({ passed: false, exitCode: 1 });
      expect(result.stdout).toContain('未提取到合法 exitCode');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('显式 --gate-logs 目录读取失败为 blocking violation', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-log-b1-'));
    try {
      const missingDir = path.join(tmpDir, 'missing-gate-logs');
      const runLog = path.join(tmpDir, 'run-log.jsonl');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(runLog, makeRunLogEntry('missing.json', 0) + '\n', 'utf8');
      const result = runSync(
        process.execPath,
        [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', runLog, `--gate-logs=${missingDir}`],
        {
          cwd: tmpDir,
        },
      );
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout ?? '')).toMatchObject({ passed: false, exitCode: 1 });
      expect(result.stdout).toContain('gate-logs 目录读取失败');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('根字段与摘要字段矛盾为 blocking violation', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-log-b1-'));
    try {
      const gateLogsDir = path.join(tmpDir, 'gate-logs');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- gateLogsDir is beneath the test-owned mkdtemp fixture
      await fs.mkdir(gateLogsDir);
      const payload = makeGatePayload(0);
      payload.stdoutSummary = { exitCode: 1, passed: false };
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(path.join(gateLogsDir, 'mismatch.json'), JSON.stringify(payload), 'utf8');
      const runLog = path.join(tmpDir, 'run-log.jsonl');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(runLog, makeRunLogEntry('mismatch.json', 0) + '\n', 'utf8');
      const result = runSync(
        process.execPath,
        [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', runLog, `--gate-logs=${gateLogsDir}`],
        {
          cwd: tmpDir,
        },
      );
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout ?? '')).toMatchObject({ passed: false, exitCode: 1 });
      expect(result.stdout).toContain('stdoutSummary');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('schema 无效的根 JSON 为 blocking violation', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-log-b1-'));
    try {
      const gateLogsDir = path.join(tmpDir, 'gate-logs');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- gateLogsDir is beneath the test-owned mkdtemp fixture
      await fs.mkdir(gateLogsDir);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(path.join(gateLogsDir, 'invalid.json'), JSON.stringify({ exitCode: 0, passed: true }), 'utf8');
      const runLog = path.join(tmpDir, 'run-log.jsonl');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(runLog, makeRunLogEntry('invalid.json', 0) + '\n', 'utf8');
      const result = runSync(
        process.execPath,
        [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', runLog, `--gate-logs=${gateLogsDir}`],
        {
          cwd: tmpDir,
        },
      );
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout ?? '')).toMatchObject({ passed: false, exitCode: 1 });
      expect(result.stdout).toContain('[schema]');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('未传 --gate-logs 时不强制要求 gate-log', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-log-b1-'));
    try {
      const runLog = path.join(tmpDir, 'run-log.jsonl');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(runLog, makeRunLogEntry('missing.json', 0) + '\n', 'utf8');
      const result = runSync(process.execPath, [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', runLog], { cwd: tmpDir });
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout ?? '')).toMatchObject({ passed: true, exitCode: 0 });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('schema 违规样本 → stdout 为单行 JSON（type/passed/reasons/violations/durationMs/exitCode），进程退出码与 exitCode 字段一致', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-report-json-'));
    try {
      const logFile = path.join(tmpDir, 'run-log.jsonl');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(
        logFile,
        '{"phase":1,"action":"produce","role":"S","outcome":"success","timestamp":"2026-08-11T00:00:00Z"}\n',
        'utf-8',
      );
      const r = runSync(process.execPath, [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', logFile], {});
      expect(r.status).toBe(1); // schema 违规 → exit 1
      const stdout = r.stdout ?? '';
      expect(stdout).not.toContain('═');
      expect(stdout).not.toContain('─');
      const parsed = JSON.parse(stdout) as {
        type: string;
        passed: boolean;
        reasons: string[];
        violations: Array<{ rule: string; count: number }>;
        durationMs: number;
        exitCode: number;
      };
      expect(parsed.type).toBe('run-log');
      expect(parsed.passed).toBe(false);
      expect(parsed.reasons.length).toBeGreaterThan(0);
      expect(parsed.violations).toEqual([{ rule: 'violation', count: parsed.reasons.length }]);
      expect(typeof parsed.durationMs).toBe('number');
      expect(parsed.exitCode).toBe(1);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('默认路径（不带 --json）输出人类可读分隔线，行为不变', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-report-json-'));
    try {
      const logFile = path.join(tmpDir, 'run-log.jsonl');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(
        logFile,
        '{"phase":1,"action":"produce","role":"S","outcome":"success","timestamp":"2026-08-11T00:00:00Z"}\n',
        'utf-8',
      );
      const r = runSync(process.execPath, [tsxCli, CHECK_RUN_LOG_SCRIPT, logFile], {});
      expect(r.status).toBe(1);
      const stdout = r.stdout ?? '';
      expect(stdout).toContain('═');
      expect(stdout).toContain('RUN_LOG_JSON ');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('默认 RUN_LOG_JSON 与 --json 合并 parse diagnostics 和 lifecycleStatus', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-run-log-summary-parity-'));
    try {
      const logFile = path.join(tmpDir, 'run-log.jsonl');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(
        logFile,
        '{"runId":"valid","timestamp":"2026-08-24T00:00:00.000Z","phase":1,"phaseName":"需求分析","action":"chunk","role":"A","duration_s":1,"tokens":1,"estimated":false,"subagentSpawns":0,"gateExitCode":null,"outcome":"success"}\nnot-json\n',
        'utf-8',
      );
      const jsonResult = runSync(process.execPath, [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', logFile], {});
      const defaultResult = runSync(process.execPath, [tsxCli, CHECK_RUN_LOG_SCRIPT, logFile], {});
      expect(jsonResult.status).toBe(0);
      expect(defaultResult.status).toBe(0);
      const jsonSummary = JSON.parse(jsonResult.stdout ?? '') as Record<string, unknown>;
      const defaultLine = (defaultResult.stdout ?? '').split(/\r?\n/).find((line) => line.startsWith('RUN_LOG_JSON '));
      expect(defaultLine).toBeDefined();
      const defaultSummary = JSON.parse(defaultLine!.slice('RUN_LOG_JSON '.length)) as Record<string, unknown>;
      expect(defaultSummary).toMatchObject({
        lifecycleStatus: 'NOT_CLOSED_NOT_PROVEN',
        statusNote: expect.any(String),
        diagnostics: expect.arrayContaining([expect.stringContaining('PARSE_INCOMPLETE')]),
      });
      expect(defaultSummary.lifecycleStatus).toBe(jsonSummary.lifecycleStatus);
      expect(defaultSummary.diagnostics).toEqual(jsonSummary.diagnostics);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('check-tla-bdd-sync.ts --json（子进程冒烟：纯 JSON、violations 按 rule 聚合、默认路径保留 TLA_BDD_SYNC_JSON 前缀）', () => {
  const TLA_CONTENT = [
    'EXTENDS Naturals',
    'VARIABLES state',
    'Init == state = "idle"',
    'Next == \\/ Login \\/ Logout',
    'Login == state = "idle" /\\ state\' = "active"',
    'Logout == state = "active" /\\ state\' = "idle"',
    'TypeInvariant == state \\in {"idle", "active"}',
  ].join('\n');
  const FEATURE_CONTENT = [
    'Feature: Test',
    'Background:',
    '  Given initial state',
    '  When Login',
    '  When Logout',
    '  Then TypeInvariant',
  ].join('\n');

  it('--json 有效样本 → stdout 为单行纯 JSON（passed=true，exitCode=0），不输出 TLA_BDD_SYNC_JSON 前缀', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-tla-bdd-json-'));
    try {
      const tlaFile = path.join(tmpDir, 'model.tla');
      const featureFile = path.join(tmpDir, 'model.feature');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(tlaFile, TLA_CONTENT, 'utf-8');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(featureFile, FEATURE_CONTENT, 'utf-8');
      const r = runSync(process.execPath, [tsxCli, CHECK_TLA_BDD_SYNC_SCRIPT, '--json', tlaFile, featureFile], {});
      expect(r.status).toBe(0);
      const stdout = r.stdout ?? '';
      expect(stdout).not.toContain('═');
      expect(stdout).not.toContain('TLA_BDD_SYNC_JSON ');
      const parsed = JSON.parse(stdout) as {
        type: string;
        passed: boolean;
        reasons: string[];
        violations: Array<{ rule: string; count: number }>;
        durationMs: number;
        exitCode: number;
      };
      expect(parsed.type).toBe('tla-bdd-sync');
      expect(parsed.passed).toBe(true);
      expect(parsed.reasons).toEqual([]);
      expect(parsed.violations).toEqual([]);
      expect(parsed.exitCode).toBe(0);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('默认路径（不带 --json）保留 TLA_BDD_SYNC_JSON 前缀（run-log-logic 消费者兼容）', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-tla-bdd-json-'));
    try {
      const tlaFile = path.join(tmpDir, 'model.tla');
      const featureFile = path.join(tmpDir, 'model.feature');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(tlaFile, TLA_CONTENT, 'utf-8');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(featureFile, FEATURE_CONTENT, 'utf-8');
      const r = runSync(process.execPath, [tsxCli, CHECK_TLA_BDD_SYNC_SCRIPT, tlaFile, featureFile], {});
      expect(r.status).toBe(0);
      expect(r.stdout ?? '').toContain('TLA_BDD_SYNC_JSON ');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('真实 CLI 空输入 → exit 1 且 JSON 暴露 TLA_BDD_STRUCTURE violation', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-tla-bdd-empty-'));
    try {
      const tlaFile = path.join(tmpDir, 'empty.tla');
      const featureFile = path.join(tmpDir, 'empty.feature');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(tlaFile, '', 'utf-8');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(featureFile, '', 'utf-8');
      const r = runSync(process.execPath, [tsxCli, CHECK_TLA_BDD_SYNC_SCRIPT, '--json', tlaFile, featureFile], {});
      expect(r.status).toBe(1);
      expect(JSON.parse(r.stdout ?? '')).toMatchObject({
        type: 'tla-bdd-sync',
        exitCode: 1,
        passed: false,
        violations: expect.arrayContaining([{ rule: 'TLA_BDD_STRUCTURE', count: expect.any(Number) }]),
      });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('真实 CLI mismatch → exit 1 且 JSON 暴露 TLA_BDD_TRANSITION violation', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-tla-bdd-mismatch-'));
    try {
      const tlaFile = path.join(tmpDir, 'model.tla');
      const featureFile = path.join(tmpDir, 'model.feature');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(tlaFile, TLA_CONTENT, 'utf-8');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(
        featureFile,
        ['Feature: Test', 'Background:', '  Given initial state', '  When Login', '  Then TypeInvariant'].join('\n'),
        'utf-8',
      );
      const r = runSync(process.execPath, [tsxCli, CHECK_TLA_BDD_SYNC_SCRIPT, '--json', tlaFile, featureFile], {});
      expect(r.status).toBe(1);
      expect(JSON.parse(r.stdout ?? '')).toMatchObject({
        type: 'tla-bdd-sync',
        exitCode: 1,
        passed: false,
        reasons: expect.arrayContaining([expect.stringContaining('Logout')]),
        violations: expect.arrayContaining([{ rule: 'TLA_BDD_TRANSITION', count: expect.any(Number) }]),
      });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('check-artifact-gate.ts phase 1 evidence boundary', () => {
  it('真实 phase 1 gate 在无 graph 时仍运行 TLA/BDD evidence checks，不把 graph 缺失当作跳过', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-artifact-phase1-'));
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- model directory is beneath the test-owned mkdtemp fixture
      await fs.mkdir(path.join(tmpDir, '.w-model'), { recursive: true });
      const rtm = await fs.readFile(
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../samples/gate/valid-rtm.json'),
        'utf-8',
      );
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(path.join(tmpDir, '.w-model/rtm.json'), rtm, 'utf-8');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(
        path.join(tmpDir, '.w-model/bdd-manifest.json'),
        JSON.stringify({
          schemaVersion: '1.0',
          projectId: 'phase1-evidence-test',
          basePath: '.',
          currentPhase: 1,
          features: [],
          stateMachines: [],
        }),
        'utf-8',
      );

      const r = runSync(process.execPath, [tsxCli, CHECK_ARTIFACT_GATE_SCRIPT, tmpDir, '--phase=1', '--json'], {});
      expect(r.status).toBe(1);
      const report = JSON.parse(r.stdout ?? '') as { exitCode: number; passed: boolean; reasons: string[] };
      expect(report).toMatchObject({ exitCode: 1, passed: false });
      expect(report.reasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('[artifact:tla]'),
          expect.stringContaining('[artifact:bdd-model]'),
        ]),
      );
      expect(report.reasons).not.toContain('[artifact:graph] graph asset is required for project phase 2-4');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('check-iceberg-sweep.ts --json（子进程冒烟：纯 JSON、默认路径保留 ICEBERG_JSON 前缀）', () => {
  it('--json 有效样本 → stdout 为单行纯 JSON（passed=true，exitCode=0），不输出 ICEBERG_JSON 前缀', async () => {
    for (const cliFile of [CHECK_BDD_MODEL_SCRIPT, CHECK_ICEBERG_SWEEP_SCRIPT, CHECK_PREVENTIVE_REVIEW_SCRIPT]) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- source paths are fixed repository test constants
      const source = await fs.readFile(cliFile, 'utf-8');
      const jsdocStart = source.indexOf('/**');
      const jsdocEnd = source.indexOf('*/', jsdocStart);
      const jsdoc = jsdocStart >= 0 && jsdocEnd >= 0 ? source.slice(jsdocStart, jsdocEnd + 2) : '';
      expect(jsdoc).toContain('默认与 --json 均在输出摘要前尝试写');
      expect(jsdoc).toContain('gateLogWriteError');
      expect(jsdoc).toContain('不改变主 passed / exitCode');
      expect(jsdoc).not.toContain('--json 不写 gate log');
      expect(jsdoc).not.toContain('--json 模式不写');
    }

    const r = runSync(process.execPath, [tsxCli, CHECK_ICEBERG_SWEEP_SCRIPT, '--json', ICEBERG_VALID_SAMPLE]);
    expect(r.status).toBe(0);
    const stdout = r.stdout ?? '';
    expect(stdout).not.toContain('═');
    expect(stdout).not.toContain('ICEBERG_JSON ');
    const parsed = JSON.parse(stdout) as {
      type: string;
      passed: boolean;
      reasons: string[];
      violations: Array<{ rule: string; count: number }>;
      durationMs: number;
      exitCode: number;
    };
    expect(parsed.type).toBe('iceberg-sweep');
    expect(parsed.passed).toBe(true);
    expect(parsed.reasons).toEqual([]);
    expect(parsed.violations).toEqual([]);
    expect(parsed.exitCode).toBe(0);
  });

  it('默认路径保留 ICEBERG_JSON 前缀；三调用方写失败仍保留主结论并输出 gateLogWriteError', async () => {
    const r = runSync(process.execPath, [tsxCli, CHECK_ICEBERG_SWEEP_SCRIPT, ICEBERG_VALID_SAMPLE]);
    expect(r.status).toBe(0);
    expect(r.stdout ?? '').toContain('ICEBERG_JSON ');

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gatelog-cli-'));
    const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../samples');
    const blockedLogRoot = path.join(tmpDir, '.w-model');
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test directory
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(blockedLogRoot, 'not a directory', 'utf-8');

      const bddProject = path.join(tmpDir, 'bdd-project');
      const bddModelDir = path.join(bddProject, '.w-model');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test directory
      await fs.mkdir(bddModelDir, { recursive: true });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture and destination are test-controlled
      await fs.copyFile(path.join(fixturesDir, 'bdd', 'valid-manifest.json'), path.join(bddModelDir, 'manifest.json'));
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test directory
      await fs.mkdir(path.join(bddProject, 'samples', 'bdd'), { recursive: true });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture and destination are test-controlled
      await fs.copyFile(
        path.join(fixturesDir, 'bdd', 'valid-l1.feature'),
        path.join(bddProject, 'samples', 'bdd', 'valid-l1.feature'),
      );
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test directory
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(path.join(bddModelDir, 'gate-logs'), 'not a directory', 'utf-8');

      const iceberg = runSync(process.execPath, [tsxCli, CHECK_ICEBERG_SWEEP_SCRIPT, ICEBERG_VALID_SAMPLE], {
        cwd: tmpDir,
      });
      expect(iceberg.status).toBe(0);
      const icebergSummary = JSON.parse((iceberg.stdout ?? '').replace('ICEBERG_JSON ', '')) as Record<string, unknown>;
      expect(icebergSummary).toMatchObject({
        passed: true,
        exitCode: 0,
        gateLogWriteError: { code: 'GATE_LOG_WRITE_FAILED', message: 'Unable to persist gate log' },
      });
      expect(iceberg.stdout ?? '').not.toContain(blockedLogRoot);
      expect(iceberg.stderr ?? '').not.toContain(blockedLogRoot);

      const icebergJson = runSync(
        process.execPath,
        [tsxCli, CHECK_ICEBERG_SWEEP_SCRIPT, '--json', ICEBERG_VALID_SAMPLE],
        {
          cwd: tmpDir,
        },
      );
      expect(icebergJson.status).toBe(0);
      expect(JSON.parse(icebergJson.stdout ?? '')).toMatchObject({
        passed: true,
        exitCode: 0,
        gateLogWriteError: { code: 'GATE_LOG_WRITE_FAILED', message: 'Unable to persist gate log' },
      });

      const preventive = runSync(process.execPath, [tsxCli, CHECK_PREVENTIVE_REVIEW_SCRIPT, tmpDir, '--phase=1'], {});
      expect(preventive.status).toBe(1);
      const preventiveSummary = JSON.parse((preventive.stdout ?? '').replace('PREVENTIVE_REVIEW_JSON ', '')) as Record<
        string,
        unknown
      >;
      expect(preventiveSummary).toMatchObject({
        passed: false,
        exitCode: 1,
        gateLogWriteError: { code: 'GATE_LOG_WRITE_FAILED', message: 'Unable to persist gate log' },
      });
      const preventiveJson = runSync(
        process.execPath,
        [tsxCli, CHECK_PREVENTIVE_REVIEW_SCRIPT, tmpDir, '--phase=1', '--json'],
        {},
      );
      expect(preventiveJson.status).toBe(1);
      expect(JSON.parse(preventiveJson.stdout ?? '')).toMatchObject({
        passed: false,
        exitCode: 1,
        gateLogWriteError: { code: 'GATE_LOG_WRITE_FAILED', message: 'Unable to persist gate log' },
      });

      const bdd = runSync(
        process.execPath,
        [tsxCli, CHECK_BDD_MODEL_SCRIPT, path.join(bddModelDir, 'manifest.json')],
        {},
      );
      expect(bdd.status).toBe(0);
      const bddSummary = JSON.parse((bdd.stdout ?? '').match(/BDD_JSON (.+)/)?.[1] ?? '') as Record<string, unknown>;
      expect(bddSummary).toMatchObject({
        passed: true,
        exitCode: 0,
        gateLogWriteError: { code: 'GATE_LOG_WRITE_FAILED', message: 'Unable to persist gate log' },
      });
      const bddJson = runSync(
        process.execPath,
        [tsxCli, CHECK_BDD_MODEL_SCRIPT, path.join(bddModelDir, 'manifest.json'), '--json'],
        {},
      );
      expect(bddJson.status).toBe(0);
      expect(JSON.parse(bddJson.stdout ?? '')).toMatchObject({
        passed: true,
        exitCode: 0,
        gateLogWriteError: { code: 'GATE_LOG_WRITE_FAILED', message: 'Unable to persist gate log' },
      });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('D8 I2 natural-exit contract', () => {
  const scriptsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const cliRoot = path.join(scriptsRoot, 'cli');
  const libRoot = path.join(scriptsRoot, 'lib');
  const logicRoot = path.join(scriptsRoot, 'logic');
  const contractDoc = path.resolve(scriptsRoot, '../../w-model-dev/references/command-reference.md');
  const naturalExitTargets: Record<string, string> = {
    'ensure-codegraph-opsx.ts': '外部依赖检测结束后设置 `process.exitCode`，自然返回',
    'metrics-report.ts': '报告输出完成后设置 `process.exitCode=0`，自然返回',
    'security-scan.ts': '扫描/重生成结果设置 `process.exitCode`，自然返回',
    'self-test.ts': '汇总或未预期异常设置 `process.exitCode`，自然返回',
    'wm-status.ts': '状态输出或未初始化提示设置 `process.exitCode=0`，自然返回',
  };

  function sourceFiles(root: string): string[] {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- root is constrained to repository script layers
    return fsSync.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
      const absolute = path.join(root, entry.name);
      if (entry.isDirectory()) return sourceFiles(absolute);
      return entry.isFile() && entry.name.endsWith('.ts') ? [absolute] : [];
    });
  }

  it('keeps direct process.exit out of lib/logic and gate-report callers', () => {
    const violations: string[] = [];
    for (const file of [...sourceFiles(libRoot), ...sourceFiles(logicRoot)]) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- file is discovered only beneath repository script layers
      const source = fsSync.readFileSync(file, 'utf8');
      const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      if (/process\.exit\s*\(/.test(withoutComments)) violations.push(path.relative(scriptsRoot, file));
    }

    for (const file of sourceFiles(cliRoot)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- file is discovered only beneath repository script layers
      const source = fsSync.readFileSync(file, 'utf8');
      if (!/printGateReport|printJsonReport/.test(source)) continue;
      const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      if (/process\.exit\s*\(/.test(withoutComments)) violations.push(path.relative(scriptsRoot, file));
      if (!/process\.exitCode\s*=/.test(withoutComments)) {
        violations.push(`${path.relative(scriptsRoot, file)}: missing process.exitCode`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('documents every migrated runner with its natural-exit contract', () => {
    const doc = fsSync.readFileSync(contractDoc, 'utf8');
    expect(doc).toContain('D2 自然退出契约边界');
    for (const [script, contract] of Object.entries(naturalExitTargets)) {
      expect(doc).toContain(script);
      expect(doc).toContain(contract);
    }
  });
});
