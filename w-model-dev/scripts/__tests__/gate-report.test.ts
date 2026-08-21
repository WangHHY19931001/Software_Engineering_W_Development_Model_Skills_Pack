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
  it('schema 违规样本 → stdout 为单行 JSON（type/passed/reasons/violations/durationMs/exitCode），进程退出码与 exitCode 字段一致', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-report-json-'));
    try {
      const logFile = path.join(tmpDir, 'run-log.jsonl');
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
      await fs.writeFile(tlaFile, TLA_CONTENT, 'utf-8');
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
      await fs.writeFile(tlaFile, TLA_CONTENT, 'utf-8');
      await fs.writeFile(featureFile, FEATURE_CONTENT, 'utf-8');
      const r = runSync(process.execPath, [tsxCli, CHECK_TLA_BDD_SYNC_SCRIPT, tlaFile, featureFile], {});
      expect(r.status).toBe(0);
      expect(r.stdout ?? '').toContain('TLA_BDD_SYNC_JSON ');
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
  const processLevelExitInventory: Record<string, string> = {
    'ensure-codegraph-opsx.ts': '依赖检测可能执行外部 CLI，保留 process-level runner 的直接退出语义',
    'metrics-report.ts': '只读报告 runner，保留既有成功退出语义',
    'security-scan.ts': '安全扫描 runner，保留扫描结果的既有退出语义',
    'self-test.ts': '回归基线 runner，保留最终汇总退出语义',
    'wm-status.ts': '只读状态 runner，保留既有成功退出语义',
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

  it('documents every retained process-level direct exit with its reason', () => {
    const doc = fsSync.readFileSync(contractDoc, 'utf8');
    expect(doc).toContain('D2 自然退出契约边界');
    for (const [script, reason] of Object.entries(processLevelExitInventory)) {
      expect(doc).toContain(script);
      expect(doc).toContain(reason);
    }
  });
});
