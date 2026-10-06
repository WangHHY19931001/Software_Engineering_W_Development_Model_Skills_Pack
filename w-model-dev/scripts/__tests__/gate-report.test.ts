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
import { computeSigHash, type SignatureChainEntry } from '../logic/signature-chain-logic.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const CHECK_RUN_LOG_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli/check-run-log.ts');
const CHECK_ROLE_DISPATCH_SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../cli/check-role-dispatch.ts',
);
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
      'MATURITY_JSON ' +
        JSON.stringify({
          type: 'maturity',
          passed: true,
          violations: [],
          exitCode: 0,
        }),
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
    await fs.mkdir(path.join(tmpDir, 'w-model-dev', 'scripts', 'samples'), {
      recursive: true,
    });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test fixture path
    await fs.mkdir(path.join(tmpDir, 'w-model-dev', 'scripts', 'cli'), {
      recursive: true,
    });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test fixture path
    await fs.writeFile(path.join(tmpDir, 'w-model-dev', 'scripts', 'samples', 'README.md'), '', 'utf-8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test fixture path
    await fs.writeFile(path.join(tmpDir, 'w-model-dev', 'scripts', 'cli', 'self-test.ts'), '', 'utf-8');
    // 任务 2 起 samples/NEGATIVE-COVERAGE.md 属必需文件；本夹具 cli/ 仅含 self-test.ts（门禁集合为空），
    // 故只写表头即同时满足两条路径：违规路径仍是单一的 fixture-unregistered，无违规路径仍 exit 0。
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test fixture path
    await fs.writeFile(
      path.join(tmpDir, 'w-model-dev', 'scripts', 'samples', 'NEGATIVE-COVERAGE.md'),
      [
        '# 负向覆盖登记册',
        '',
        '| 门禁脚本 | 负向机制 | 负向案例 / 证据位置 | 所防回归（一句话） |',
        '| --- | --- | --- | --- |',
      ].join('\n'),
      'utf-8',
    );
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
      const report = JSON.parse(result.stdout ?? '') as {
        passed: boolean;
        exitCode: number;
      };
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
      const report = JSON.parse(result.stdout ?? '') as {
        passed: boolean;
        exitCode: number;
      };
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
      expect(JSON.parse(result.stdout ?? '')).toMatchObject({
        passed: true,
        exitCode: 0,
      });
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
      expect(JSON.parse(result.stdout ?? '')).toMatchObject({
        passed: true,
        exitCode: 0,
      });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('显式 gate-logs 参数缺少目录值时返回结构化 exit 2（2 形态：--gate-logs= / --gate-logs，每迭代自备 fixture）', async () => {
    for (const gateLogsArg of ['--gate-logs=', '--gate-logs']) {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-log-b1-'));
      try {
        const runLog = path.join(tmpDir, 'run-log.jsonl');
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
        await fs.writeFile(runLog, makeRunLogEntry('missing.json', 0) + '\n', 'utf8');
        const result = runSync(process.execPath, [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', runLog, gateLogsArg], {
          cwd: tmpDir,
        });
        expect(result.status, `flag=${gateLogsArg}: 应 exit 2`).toBe(2);
        expect(result.stdout, `flag=${gateLogsArg}: 应含 ERROR_JSON`).toContain('ERROR_JSON');
        expect(result.stdout, `flag=${gateLogsArg}: 应含 "exitCode":2`).toContain('"exitCode":2');
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    }
  });

  it('有效 gate-logs 后重复出现空参数时仍返回结构化 exit 2（2 形态：--gate-logs / --gate-logs=，每迭代自备 fixture）', async () => {
    for (const emptyGateLogsArg of ['--gate-logs', '--gate-logs=']) {
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
        expect(result.status, `flag=${emptyGateLogsArg}: 应 exit 2`).toBe(2);
        expect(result.stdout, `flag=${emptyGateLogsArg}: 应含 ERROR_JSON`).toContain('ERROR_JSON');
        expect(result.stdout, `flag=${emptyGateLogsArg}: 应含 "exitCode":2`).toContain('"exitCode":2');
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    }
  });

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

  it('显式 --gate-logs 读取失败行（2 态：子目录当作文件读 / --gate-logs 目录缺失）', async () => {
    for (const [形态名, setup, gateLogsTarget, marker] of [
      [
        '子目录读取失败（entry 为目录）',
        async (tmpDir: string) => {
          const gateLogsDir = path.join(tmpDir, 'gate-logs');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- gateLogsDir is beneath the test-owned mkdtemp fixture
          await fs.mkdir(path.join(gateLogsDir, 'not-a-file'), {
            recursive: true,
          });
          return { gateLogsDir, entry: 'not-a-file' };
        },
        (gateLogsDir: string) => gateLogsDir,
        'gate-log 文件读取失败',
      ],
      [
        '目录读取失败（--gate-logs 指向不存在目录）',
        async (tmpDir: string) => {
          const gateLogsDir = path.join(tmpDir, 'gate-logs');
          return { gateLogsDir, entry: 'missing.json' };
        },
        (gateLogsDir: string) => path.join(path.dirname(gateLogsDir), 'missing-gate-logs'),
        'gate-logs 目录读取失败',
      ],
    ] as const) {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-log-b1-'));
      try {
        const { gateLogsDir, entry } = await setup(tmpDir);
        const runLog = path.join(tmpDir, 'run-log.jsonl');
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
        await fs.writeFile(runLog, makeRunLogEntry(entry, 0) + '\n', 'utf8');
        const result = runSync(
          process.execPath,
          [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', runLog, `--gate-logs=${gateLogsTarget(gateLogsDir)}`],
          { cwd: tmpDir },
        );
        expect(result.status, `${形态名}: 应 exit 1`).toBe(1);
        expect(result.stdout, `${形态名}: 应含「${marker}」`).toContain(marker);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    }
  }, 120_000);

  it('显式 --gate-logs 内容无效行（4 态：缺根 exitCode / 损坏文件 / 根摘要矛盾 / schema 无效，不静默跳过）', async () => {
    for (const [形态名, entryName, makeContent, marker, assertJsonShape] of [
      [
        '缺根 exitCode',
        'missing-exit-code.json',
        () => {
          const payload = makeGatePayload(0) as Record<string, unknown>;
          delete payload.exitCode;
          delete (payload.reportSummary as Record<string, unknown>).exitCode;
          delete (payload.stdoutSummary as Record<string, unknown>).exitCode;
          return JSON.stringify(payload);
        },
        '未提取到合法 exitCode',
        false,
      ],
      ['损坏文件（非 JSON）', 'broken.json', () => '{not-json', '未提取到合法 exitCode', true],
      [
        '根字段与摘要字段矛盾',
        'mismatch.json',
        () => {
          const payload = makeGatePayload(0);
          payload.stdoutSummary = { exitCode: 1, passed: false };
          return JSON.stringify(payload);
        },
        'stdoutSummary',
        true,
      ],
      ['schema 无效的根 JSON', 'invalid.json', () => JSON.stringify({ exitCode: 0, passed: true }), '[schema]', true],
    ] as const) {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-log-b1-'));
      try {
        const gateLogsDir = path.join(tmpDir, 'gate-logs');
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- gateLogsDir is beneath the test-owned mkdtemp fixture
        await fs.mkdir(gateLogsDir);
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
        await fs.writeFile(path.join(gateLogsDir, entryName), makeContent(), 'utf8');
        const runLog = path.join(tmpDir, 'run-log.jsonl');
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
        await fs.writeFile(runLog, makeRunLogEntry(entryName, 0) + '\n', 'utf8');
        const result = runSync(
          process.execPath,
          [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', runLog, `--gate-logs=${gateLogsDir}`],
          { cwd: tmpDir },
        );
        expect(result.status, `${形态名}: 应 exit 1`).toBe(1);
        if (assertJsonShape) {
          expect(JSON.parse(result.stdout ?? ''), `${形态名}: 判定应 fail-closed`).toMatchObject({
            passed: false,
            exitCode: 1,
          });
        }
        expect(result.stdout, `${形态名}: 应含「${marker}」`).toContain(marker);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    }
  }, 150_000);

  it('批次 6 A3 后半：未传 --gate-logs 时 R6 默认核验——gate 记录带 gateLogPath 且同目录 gate-logs/ 整体缺失 → exit 1（旧「不强制」契约已废除）', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-log-b1-'));
    try {
      const runLog = path.join(tmpDir, 'run-log.jsonl');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(runLog, makeRunLogEntry('missing.json', 0) + '\n', 'utf8');
      const result = runSync(process.execPath, [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', runLog], { cwd: tmpDir });
      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout ?? '') as {
        passed: boolean;
        exitCode: number;
        reasons: string[];
      };
      expect(report).toMatchObject({ passed: false, exitCode: 1 });
      // 目录整体缺失 → 一条汇总 blocking R6 违规（不逐条展开）
      expect(report.reasons.filter((v) => v.startsWith('R6:'))).toHaveLength(1);
      expect(report.reasons.some((v) => v.includes('gate-logs 目录缺失'))).toBe(true);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('批次 6 A3 后半：未传 --gate-logs 且无任何带 gateLogPath 的 gate 记录 → 不触发默认核验（同目录无 gate-logs/ 仍 exit 0）', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-log-b1-'));
    try {
      const runLog = path.join(tmpDir, 'run-log.jsonl');
      // gateExitCode=null 且无 gateLogPath：R6 默认核验无对象，不因 gate-logs/ 缺失而触发
      const bareGate = makeRunLogEntry('missing.json', 0)
        .replace('"gateExitCode":0', '"gateExitCode":null')
        .replace(',"gateLogPath":"missing.json"', '');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(runLog, bareGate + '\n', 'utf8');
      const result = runSync(process.execPath, [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', runLog], { cwd: tmpDir });
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout ?? '')).toMatchObject({
        passed: true,
        exitCode: 0,
      });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('schema 违规样本 → stdout 为单行 JSON（type/passed/reasons/violations/exitCode，不含非确定性 durationMs），进程退出码与 exitCode 字段一致', async () => {
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
        exitCode: number;
      };
      expect(parsed.type).toBe('run-log');
      expect(parsed.passed).toBe(false);
      expect(parsed.reasons.length).toBeGreaterThan(0);
      expect(parsed.violations).toEqual([{ rule: 'violation', count: parsed.reasons.length }]);
      // D3（2026-09-18）：性能计量字段退出机器通道——durationMs 每次运行都不同，进 --json 即破坏
      // 「同输入同字节可复现」（与 review-package.ts 同哲学）；原「有界整数」断言随字段迁移到
      // 人类可读路径用例（RUN_LOG_JSON 按规格保留该字段），此处改为断言它**不在**机器通道。
      expect(Object.keys(parsed)).not.toContain('durationMs');
      expect(parsed.exitCode).toBe(1);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('默认路径（不带 --json）输出人类可读分隔线，行为不变；RUN_LOG_JSON 仍保留 durationMs（有界整数）', async () => {
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
      const defaultLine = stdout.split(/\r?\n/).find((line) => line.startsWith('RUN_LOG_JSON '));
      expect(defaultLine).toBeDefined();
      const summary = JSON.parse(defaultLine!.slice('RUN_LOG_JSON '.length)) as { durationMs: number };
      // 有界断言（2026-09-17 审查把「仅断言 typeof」收紧为有界值；D3 修复后该断言随字段移到人类通道）：
      // 整数、非负、且远小于任何真实运行时长。键缺失时 Number.isInteger(undefined)=false → 仍然红。
      expect(Number.isInteger(summary.durationMs) && summary.durationMs >= 0 && summary.durationMs < 600_000).toBe(
        true,
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('D3：同输入两次 --json → stdout 逐字节相同，且判定字段仍在（剔除面只限性能计量）', async () => {
    const sample = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../samples/run-log/valid.jsonl');
    const first = runSync(process.execPath, [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', sample], {});
    const second = runSync(process.execPath, [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', sample], {});
    expect(first.status).toBe(0);
    expect(second.status).toBe(first.status);
    // 字节级复现：同输入同输出（修复前 durationMs=175/209/221… → 三次哈希互异）
    expect(second.stdout).toBe(first.stdout);
    const parsed = JSON.parse(first.stdout ?? '') as Record<string, unknown>;
    // 判定字段仍在（防「顺手删多了」）：结论 + 生命周期 + R10 维度计数（R11 见下，按 D3 面单独断言）
    expect(parsed).toMatchObject({
      type: 'run-log',
      passed: true,
      exitCode: 0,
      // 批次 6 A3/C14：legacy 吸收诊断循环删除后，valid.jsonl 无非阻断诊断 → 真闭合
      lifecycleStatus: 'CLOSED_UNDER_CURRENT_RULES',
      r10: { checked: 0, missing: 0 },
    });
    // r11 的 checkedGates 数值由 **任务 4/J1 在途改动**（logic/run-log-logic.ts 的 closure 维度）
    // 与本次已改的 samples/run-log/valid.jsonl（放行条数）共同决定——此处只钉 D3 关心的
    // 「R11 机器核验字段仍在且无缺失」，不锁 checkedGates 具体值，避免 J1 语义/样本调整连带本用例红。
    const r11 = parsed.r11 as { checkedGates?: unknown; missing?: unknown } | undefined;
    expect(r11).toBeDefined();
    expect(r11?.missing).toBe(0);
    expect(typeof r11?.checkedGates).toBe('number');
    expect(Array.isArray(parsed.reasons)).toBe(true);
    expect(Array.isArray(parsed.violations)).toBe(true);
    // 批次 6 A3/C14：legacy 吸收诊断删除后 valid.jsonl 无任何非阻断诊断 →
    // diagnostics 键按「空则不产出」契约整体缺席（非空数组）。
    expect(parsed.diagnostics).toBeUndefined();
    expect(Object.keys(parsed)).not.toContain('durationMs');
  });

  it('默认 RUN_LOG_JSON 与 --json 一致：malformed 行并入 blocking violations（exit 1，非纯 diagnostics）', async () => {
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
      expect(jsonResult.status).toBe(1); // malformed 行是 blocking → exit 1
      expect(defaultResult.status).toBe(1);
      const jsonSummary = JSON.parse(jsonResult.stdout ?? '') as Record<string, unknown>;
      expect(jsonSummary).toMatchObject({
        passed: false,
        lifecycleStatus: 'NOT_CLOSED_NOT_PROVEN',
      });
      const reasons = jsonSummary.reasons as string[];
      expect(reasons.some((r) => r.startsWith('PARSE_INCOMPLETE: line 2') && r.includes('run-log'))).toBe(true);
      const defaultLine = (defaultResult.stdout ?? '').split(/\r?\n/).find((line) => line.startsWith('RUN_LOG_JSON '));
      expect(defaultLine).toBeDefined();
      const defaultSummary = JSON.parse(defaultLine!.slice('RUN_LOG_JSON '.length)) as Record<string, unknown>;
      expect(defaultSummary.lifecycleStatus).toBe(jsonSummary.lifecycleStatus);
      expect(defaultSummary.reasons).toEqual(jsonSummary.reasons);
      expect(defaultSummary.diagnostics).toEqual(jsonSummary.diagnostics);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('空文件 fail-closed 族（3 态：空文件 / 仅空行 / malformed-only）→ exit 1 且 lifecycleStatus=NOT_CLOSED_NOT_PROVEN', async () => {
    for (const [文件形态, content, marker, parseIncomplete] of [
      ['空文件', '', /fail-closed/, false],
      ['空白文件（仅空行）', '\n  \n\r\n', /fail-closed/, false],
      ['malformed-only 文件', 'not-json\n{also bad}\n', /PARSE_INCOMPLETE/, true],
    ] as const) {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-run-log-empty-'));
      try {
        const logFile = path.join(tmpDir, 'run-log.jsonl');
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
        await fs.writeFile(logFile, content, 'utf-8');
        const r = runSync(process.execPath, [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', logFile], {});
        expect(r.status, `${文件形态}: 应 exit 1`).toBe(1);
        const parsed = JSON.parse(r.stdout ?? '') as {
          passed: boolean;
          reasons: string[];
          lifecycleStatus: string;
        };
        expect(parsed.passed, `${文件形态}: 应 fail-closed`).toBe(false);
        if (parseIncomplete) {
          expect(
            parsed.reasons.filter((reason) => reason.startsWith('PARSE_INCOMPLETE')).length,
            `${文件形态}: PARSE_INCOMPLETE 应 ≥2`,
          ).toBeGreaterThanOrEqual(2);
        } else {
          expect(parsed.reasons.join(' '), `${文件形态}: reasons 应含 ${marker}`).toMatch(marker);
        }
        expect(parsed.lifecycleStatus, `${文件形态}: lifecycleStatus 应为 NOT_CLOSED_NOT_PROVEN`).toBe(
          'NOT_CLOSED_NOT_PROVEN',
        );
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    }
  }, 120_000);
});

describe('check-role-dispatch.ts --json（子进程冒烟：空输入 fail-closed 与 R3 维度明细）', () => {
  it('空文件 → exit 1（fail-closed），reasons 含"无任何可校验阶段"语义', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-role-dispatch-empty-'));
    try {
      const logFile = path.join(tmpDir, 'run-log.jsonl');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(logFile, '', 'utf-8');
      const r = runSync(process.execPath, [tsxCli, CHECK_ROLE_DISPATCH_SCRIPT, '--json', logFile], {});
      expect(r.status).toBe(1);
      const parsed = JSON.parse(r.stdout ?? '') as {
        type: string;
        passed: boolean;
        reasons: string[];
        exitCode: number;
      };
      expect(parsed.type).toBe('role-dispatch');
      expect(parsed.passed).toBe(false);
      expect(parsed.exitCode).toBe(1);
      expect(parsed.reasons.join(' ')).toMatch(/无任何可校验阶段/);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('重复单维缺他维的 run-log → exit 1 且 reasons 指明缺失维度（可机器读取）', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-role-dispatch-dims-'));
    try {
      const logFile = path.join(tmpDir, 'run-log.jsonl');
      const entry = (runId: string, action: string, role: string): string =>
        JSON.stringify({
          runId,
          timestamp: `2026-09-03T00:0${runId.slice(1)}:00Z`,
          phase: 1,
          phaseName: '需求与范围',
          action,
          role,
          duration_s: 1,
          tokens: 1,
          estimated: false,
          subagentSpawns: 0,
          gateExitCode: null,
          outcome: 'success',
        });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(
        logFile,
        [
          entry('r1', 'produce', 'S'),
          entry('r2', 'review', 'V'),
          entry('r3', 'gate', 'G'),
          entry('r4', 'r3-completeness', 'R'),
        ].join('\n') + '\n',
        'utf-8',
      );
      const r = runSync(process.execPath, [tsxCli, CHECK_ROLE_DISPATCH_SCRIPT, '--json', logFile], {});
      expect(r.status).toBe(1);
      const parsed = JSON.parse(r.stdout ?? '') as {
        passed: boolean;
        reasons: string[];
        exitCode: number;
      };
      expect(parsed.passed).toBe(false);
      expect(parsed.exitCode).toBe(1);
      expect(parsed.reasons.join(' ')).toMatch(/有效 R3 维度记录不足/);
      expect(parsed.reasons.join(' ')).toMatch(/缺：reliability\/security/);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('合法三维度 run-log → exit 0', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-role-dispatch-valid-'));
    try {
      const logFile = path.join(tmpDir, 'run-log.jsonl');
      // S 记录 action 用 'test'：阶段 1 夹具若用 'produce' 会误触阶段 1-4 多角色三新维度
      // （phaseRoleCoverage 覆盖维度）导致本「合法三维度」正例转红；该维度由
      // role-dispatch-logic.test.ts 与 self-test ROLE_DISPATCH_CASES（valid-phase-role.jsonl 等）专测。
      const entry = (runId: string, action: string, role: string): string =>
        JSON.stringify({
          runId,
          timestamp: `2026-09-03T00:0${runId.slice(1)}:00Z`,
          phase: 1,
          phaseName: '需求与范围',
          action,
          role,
          duration_s: 1,
          tokens: 1,
          estimated: false,
          subagentSpawns: 0,
          gateExitCode: null,
          outcome: 'success',
        });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(
        logFile,
        [
          entry('r1', 'test', 'S'),
          entry('r2', 'review', 'V'),
          entry('r3', 'gate', 'G'),
          entry('r4', 'r3-completeness', 'R'),
          entry('r5', 'r3-reliability', 'R'),
          entry('r6', 'r3-security', 'R'),
        ].join('\n') + '\n',
        'utf-8',
      );
      const r = runSync(process.execPath, [tsxCli, CHECK_ROLE_DISPATCH_SCRIPT, '--json', logFile], {});
      expect(r.status).toBe(0);
      const parsed = JSON.parse(r.stdout ?? '') as {
        passed: boolean;
        exitCode: number;
      };
      expect(parsed.passed).toBe(true);
      expect(parsed.exitCode).toBe(0);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('坏行并入 blocking violations → exit 1 且 reasons 含 PARSE_INCOMPLETE（与 check-run-log 同 fixture 同 exit）', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-role-dispatch-malformed-'));
    try {
      const logFile = path.join(tmpDir, 'run-log.jsonl');
      // 同一 fixture：1 条合法 entry + 1 条坏行（F-G2-03 口径对齐：两 checker 同 exit）
      const entry =
        '{"runId":"r1","timestamp":"2026-09-03T00:01:00Z","phase":1,"phaseName":"需求与范围","action":"produce","role":"S","duration_s":1,"tokens":1,"estimated":false,"subagentSpawns":0,"gateExitCode":null,"outcome":"success"}';
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(logFile, `${entry}\nnot-json\n`, 'utf-8');
      const roleDispatch = runSync(process.execPath, [tsxCli, CHECK_ROLE_DISPATCH_SCRIPT, '--json', logFile], {});
      const runLog = runSync(process.execPath, [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', logFile], {});
      // 实跑对照：同 fixture 同 exit 1（坏行 blocking，非 exit 2 输入错误）
      expect(roleDispatch.status).toBe(1);
      expect(runLog.status).toBe(1);
      const parsed = JSON.parse(roleDispatch.stdout ?? '') as {
        passed: boolean;
        reasons: string[];
        exitCode: number;
      };
      expect(parsed.passed).toBe(false);
      expect(parsed.exitCode).toBe(1);
      const parseReasons = parsed.reasons.filter((r) => r.startsWith('PARSE_INCOMPLETE: line 2'));
      expect(parseReasons.length).toBeGreaterThanOrEqual(1);
      expect(parseReasons[0]).toContain('; blocking');
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
      const report = JSON.parse(r.stdout ?? '') as {
        exitCode: number;
        passed: boolean;
        reasons: string[];
        external?: unknown;
      };
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

  it('--json 输出含 external 字段（S46：与 GATE_JSON 同构；phase 1 无外部校验时为 null）', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-artifact-json-external-'));
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- model directory is beneath the test-owned mkdtemp fixture
      await fs.mkdir(path.join(tmpDir, '.w-model'), { recursive: true });
      const rtm = await fs.readFile(
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../samples/gate/valid-rtm.json'),
        'utf-8',
      );
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(path.join(tmpDir, '.w-model/rtm.json'), rtm, 'utf-8');
      const r = runSync(process.execPath, [tsxCli, CHECK_ARTIFACT_GATE_SCRIPT, tmpDir, '--phase=1', '--json'], {});
      const report = JSON.parse(r.stdout ?? '') as Record<string, unknown>;
      // S46：--json 与 GATE_JSON 同构，external 键恒存在（非 5-8 阶段为 null）
      expect('external' in report).toBe(true);
      expect(report['external']).toBeNull();
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  /** A4 human 审批条目构造器（v3 sigHash 经 computeSigHash 真实重算；形态同 samples/gate/valid-maturity-waiver-with-approval/ 与 gate-logic.test.ts 同名 helper） */
  function humanMaturityApprovalEntry(): SignatureChainEntry {
    const base: Omit<SignatureChainEntry, 'sigHash'> = {
      sigId: 'wm1-r001-human',
      phase: 1,
      role: 'human',
      action: 'approve',
      targetKind: 'maturity',
      runId: 'wm1-r001',
      artifacts: ['.w-model/maturity.json'],
      prevSigId: 'genesis',
      prevSigHash: '0',
      signedAt: '2026-09-18T00:00:00.000Z',
      signer: 'user-wangh',
      inputProvenance: {
        sourceSigIds: [],
        sourceArtifacts: [],
        transformDescription: '用户确认 L0→L1 成熟度升级（A4 human 审批链）',
      },
      sigHashAlgo: 'v3',
    };
    return { ...base, sigHash: computeSigHash(base) };
  }

  // 成熟度豁免（2026-09-17 审查修复）：文档承诺 L0/L1 阶段 1-4 可不产出 TLA+/BDD 资产，
  // 而门禁此前无 maturity 输入 → 合法 L1 项目必被阻断。四臂（A4 后）：豁免命中（L1 + 合法
  // human 审批链）/ L2 不命中 / 阶段 5 不命中 / 无链拒绝（A4 fail-closed 新契约的拒绝路径）。
  it('maturity 豁免矩阵（4 态：L1+链+阶段1 豁免 / L2+阶段1 不豁免 / L1+阶段5 不豁免 / L1+阶段1+无链 拒绝）', async () => {
    for (const [
      场景,
      level,
      phase,
      期望Waived,
      assertMaturityLevel,
      assertNoTlaReasons,
      assertTlaReason,
      带审批链,
      assertRejectReason,
    ] of [
      ['L1 + 阶段 1 + 合法 human 审批链 → 豁免', 'L1', 1, true, true, true, false, true, false],
      ['L2 + 阶段 1 → 不豁免', 'L2', 1, null, false, false, true, false, false],
      ['L1 + 阶段 5 → 不豁免（豁免只覆盖阶段 1-4）', 'L1', 5, null, false, false, false, false, false],
      ['L1 + 阶段 1 + 无链 → 拒绝（A4 fail-closed）', 'L1', 1, null, false, false, true, false, true],
    ] as const) {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `wm-artifact-maturity-${level.toLowerCase()}-`));
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned mkdtemp fixture
        await fs.mkdir(path.join(tmpDir, '.w-model'), { recursive: true });
        const rtm = await fs.readFile(
          path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../samples/gate/valid-rtm.json'),
          'utf-8',
        );
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned mkdtemp fixture
        await fs.writeFile(path.join(tmpDir, '.w-model/rtm.json'), rtm, 'utf-8');
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned mkdtemp fixture
        await fs.writeFile(
          path.join(tmpDir, '.w-model/maturity.json'),
          JSON.stringify({
            level,
            history: [],
            lastUpdated: '2026-09-17T00:00:00.000Z',
          }),
          'utf-8',
        );
        if (带审批链) {
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned mkdtemp fixture
          await fs.writeFile(
            path.join(tmpDir, '.w-model/signature-chain.jsonl'),
            `${JSON.stringify(humanMaturityApprovalEntry())}\n`,
            'utf-8',
          );
        }
        const r = runSync(
          process.execPath,
          [tsxCli, CHECK_ARTIFACT_GATE_SCRIPT, tmpDir, `--phase=${phase}`, '--json'],
          {},
        );
        const report = JSON.parse(r.stdout ?? '') as {
          tlaBddWaived: boolean | null;
          maturityLevel: string | null;
          reasons: string[];
        };
        expect(report.tlaBddWaived, `${场景}: tlaBddWaived 应为 ${String(期望Waived)}`).toBe(期望Waived);
        if (assertMaturityLevel) {
          expect(report.maturityLevel, `${场景}: maturityLevel 应为 ${level}`).toBe(level);
        }
        if (assertNoTlaReasons) {
          expect(
            report.reasons.some((x) => x.includes('[artifact:tla]')),
            `${场景}: 不应报 [artifact:tla]`,
          ).toBe(false);
          expect(
            report.reasons.some((x) => x.includes('[artifact:bdd')),
            `${场景}: 不应报 [artifact:bdd]`,
          ).toBe(false);
        }
        if (assertTlaReason) {
          expect(
            report.reasons.some((x) => x.includes('[artifact:tla]')),
            `${场景}: 应报 [artifact:tla]`,
          ).toBe(true);
        }
        if (assertRejectReason) {
          expect(
            report.reasons.some((x) => x.includes('maturity 豁免被拒绝')),
            `${场景}: reasons 应含 maturity 豁免被拒绝（A4 fail-closed 拒绝路径）`,
          ).toBe(true);
        }
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    }
  }, 120_000);
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
      // A8（批次 6）：valid-manifest.json 的 filePath 改为相对 projectDir 的 bdd/valid-l1.feature，
      // 本测试的项目布局须同步（manifest 在 <project>/.w-model/，feature 在 <project>/bdd/）。
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp-controlled test directory
      await fs.mkdir(path.join(bddProject, 'bdd'), {
        recursive: true,
      });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture and destination are test-controlled
      await fs.copyFile(
        path.join(fixturesDir, 'bdd', 'valid-l1.feature'),
        path.join(bddProject, 'bdd', 'valid-l1.feature'),
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
        gateLogWriteError: {
          code: 'GATE_LOG_WRITE_FAILED',
          message: 'Unable to persist gate log',
        },
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
        gateLogWriteError: {
          code: 'GATE_LOG_WRITE_FAILED',
          message: 'Unable to persist gate log',
        },
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
        gateLogWriteError: {
          code: 'GATE_LOG_WRITE_FAILED',
          message: 'Unable to persist gate log',
        },
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
        gateLogWriteError: {
          code: 'GATE_LOG_WRITE_FAILED',
          message: 'Unable to persist gate log',
        },
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
        gateLogWriteError: {
          code: 'GATE_LOG_WRITE_FAILED',
          message: 'Unable to persist gate log',
        },
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
        gateLogWriteError: {
          code: 'GATE_LOG_WRITE_FAILED',
          message: 'Unable to persist gate log',
        },
      });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('报告结构违规 → gate-log 审计写入降级 stderr 诊断，stdout 摘要无 GATE_LOG_SCHEMA_INVALID 噪音（S10）', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-iceberg-gatelog-degrade-'));
    try {
      // 合法样本改坏 triggerType：logic R1 schema 拦截（exit 1），同时 reportSummary
      // 不满足 gate-log schema（triggerType enum）→ 写入注定 GATE_LOG_SCHEMA_INVALID
      const base = JSON.parse(await fs.readFile(ICEBERG_VALID_SAMPLE, 'utf-8')) as Record<string, unknown>;
      base.triggerType = 'BOGUS';
      const badReport = path.join(tmpDir, 'bad-report.json');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is confined to this test's mkdtemp-owned gate-log fixture
      await fs.writeFile(badReport, JSON.stringify(base), 'utf-8');

      const r = runSync(process.execPath, [tsxCli, CHECK_ICEBERG_SWEEP_SCRIPT, '--json', badReport], {
        cwd: tmpDir,
      });
      expect(r.status).toBe(1);
      const parsed = JSON.parse(r.stdout ?? '') as {
        passed: boolean;
        exitCode: number;
        gateLogWriteError?: unknown;
        reasons: string[];
      };
      expect(parsed.passed).toBe(false);
      expect(parsed.exitCode).toBe(1);
      expect(parsed.reasons.some((m) => m.startsWith('[schema]'))).toBe(true);
      // 降级：schema-invalid 噪音不进入 stdout 摘要，诊断走 stderr
      expect('gateLogWriteError' in parsed).toBe(false);
      expect(r.stderr ?? '').toContain('GATE_LOG_SCHEMA_INVALID');

      // 默认（非 --json）路径同样降级：ICEBERG_JSON 摘要不含 gateLogWriteError
      const rDefault = runSync(process.execPath, [tsxCli, CHECK_ICEBERG_SWEEP_SCRIPT, badReport], { cwd: tmpDir });
      expect(rDefault.status).toBe(1);
      const summaryDefault = JSON.parse((rDefault.stdout ?? '').replace('ICEBERG_JSON ', '')) as Record<
        string,
        unknown
      >;
      expect('gateLogWriteError' in summaryDefault).toBe(false);
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
    'ensure-codegraph.ts': '外部依赖检测结束后设置 `process.exitCode`，自然返回',
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
