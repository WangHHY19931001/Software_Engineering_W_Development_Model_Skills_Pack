/**
 * lib/gate-report.ts 单元测试
 *
 * 覆盖：
 *   - 分隔线 '─'.repeat(60)
 *   - `${label}_JSON ` 行首标记（空格分隔，供 Agent 正则截取）
 *   - JSON 摘要含全部 summary 键 + exitCode 键（追加在末尾，与历史契约一致）
 *   - process.exit 收到正确 exit code
 *
 * process.exit 测试策略：spyOn + mockImplementation 抛错拦截，避免真实退出。
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { printGateReport, printJsonReport, buildViolationDistribution } from '../lib/gate-report.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const CHECK_RUN_LOG_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli/check-run-log.ts');
const CHECK_ICEBERG_SWEEP_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli/check-iceberg-sweep.ts');
const CHECK_TLA_BDD_SYNC_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli/check-tla-bdd-sync.ts');
const ICEBERG_VALID_SAMPLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../samples/iceberg/valid-full.json');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('printGateReport', () => {
  it('输出分隔线 + `${label}_JSON ` 前缀 + 摘要含 exitCode 键，并携带正确 exit code 调用 process.exit', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(() =>
      printGateReport('MATURITY', { type: 'maturity', passed: true, violations: [] }, 0),
    ).toThrow('exit:0');

    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenNthCalledWith(1, '─'.repeat(60));
    expect(logSpy).toHaveBeenNthCalledWith(
      2,
      'MATURITY_JSON ' + JSON.stringify({ type: 'maturity', passed: true, violations: [], exitCode: 0 }),
    );
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exitCode 键追加在 JSON 末尾（summary 展开之后），原 summary 键顺序不变', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const summary = { type: 'run-log', passed: false, violations: ['v1'] };
    expect(() => printGateReport('RUN_LOG', summary, 1)).toThrow('exit:1');

    const jsonLine = logSpy.mock.calls[1]![0] as string;
    expect(jsonLine.startsWith('RUN_LOG_JSON ')).toBe(true);
    expect(jsonLine).toBe('RUN_LOG_JSON ' + JSON.stringify({ ...summary, exitCode: 1 }));
    expect(jsonLine.endsWith('"exitCode":1}')).toBe(true);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('非 0/1 exit code（如错误路径 2）原样透传', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(() => printGateReport('CONTRACT', { passed: false }, 2)).toThrow('exit:2');
    expect(logSpy).toHaveBeenNthCalledWith(2, 'CONTRACT_JSON ' + JSON.stringify({ passed: false, exitCode: 2 }));
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('summary 自带 exitCode 键时被末位实参覆盖（值与位置以函数签名参数为准）', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(() => printGateReport('GATE', { passed: true, exitCode: 9 }, 0)).toThrow('exit:0');
    expect(logSpy).toHaveBeenNthCalledWith(2, 'GATE_JSON ' + JSON.stringify({ passed: true, exitCode: 0 }));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});

describe('printJsonReport（B4 --json 机器可读报告）', () => {
  it('stdout 仅输出单行 JSON（无分隔线），含全部 JsonReport 字段 + 末尾 exitCode，且不调用 process.exit', () => {
    const exitSpy = vi.spyOn(process, 'exit');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    printJsonReport({
      type: 'run-log',
      passed: false,
      reasons: ['r1', 'r2'],
      violations: [{ rule: 'violation', count: 2 }],
      durationMs: 42,
    }, 1);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0]![0] as string;
    // 无分隔线、无 LABEL_JSON 前缀，可整体 JSON.parse
    expect(line).not.toContain('─');
    expect(line).not.toContain('═');
    expect(line).not.toContain('_JSON');
    expect(line).toBe(JSON.stringify({
      type: 'run-log',
      passed: false,
      reasons: ['r1', 'r2'],
      violations: [{ rule: 'violation', count: 2 }],
      durationMs: 42,
      exitCode: 1,
    }));
    // exitCode 由调用方处理：printJsonReport 自身不退出
    expect(exitSpy).not.toHaveBeenCalled();
  });
});

describe('buildViolationDistribution（B4 violations 分布聚合）', () => {
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

describe('check-run-log.ts --json（B4 子进程冒烟：--json 输出纯 JSON、无分隔线、退出码一致）', () => {
  it('schema 违规样本 → stdout 为单行 JSON（type/passed/reasons/violations/durationMs/exitCode），进程退出码与 exitCode 字段一致', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-gate-report-json-'));
    try {
      const logFile = path.join(tmpDir, 'run-log.jsonl');
      await fs.writeFile(
        logFile,
        '{"phase":1,"action":"produce","role":"S","outcome":"success","timestamp":"2026-08-11T00:00:00Z"}\n',
        'utf-8',
      );
      const r = spawnSync(process.execPath, [tsxCli, CHECK_RUN_LOG_SCRIPT, '--json', logFile], { encoding: 'utf-8' });
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
      const r = spawnSync(process.execPath, [tsxCli, CHECK_RUN_LOG_SCRIPT, logFile], { encoding: 'utf-8' });
      expect(r.status).toBe(1);
      const stdout = r.stdout ?? '';
      expect(stdout).toContain('═');
      expect(stdout).toContain('RUN_LOG_JSON ');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('check-tla-bdd-sync.ts --json（B4 子进程冒烟：纯 JSON、violations 按 rule 聚合、默认路径保留 TLA_BDD_SYNC_JSON 前缀）', () => {
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
      const r = spawnSync(process.execPath, [tsxCli, CHECK_TLA_BDD_SYNC_SCRIPT, '--json', tlaFile, featureFile], { encoding: 'utf-8' });
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
      const r = spawnSync(process.execPath, [tsxCli, CHECK_TLA_BDD_SYNC_SCRIPT, tlaFile, featureFile], { encoding: 'utf-8' });
      expect(r.status).toBe(0);
      expect(r.stdout ?? '').toContain('TLA_BDD_SYNC_JSON ');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('check-iceberg-sweep.ts --json（B4 子进程冒烟：纯 JSON、默认路径保留 ICEBERG_JSON 前缀）', () => {
  it('--json 有效样本 → stdout 为单行纯 JSON（passed=true，exitCode=0），不输出 ICEBERG_JSON 前缀', async () => {
    const r = spawnSync(process.execPath, [tsxCli, CHECK_ICEBERG_SWEEP_SCRIPT, '--json', ICEBERG_VALID_SAMPLE], { encoding: 'utf-8' });
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

  it('默认路径（不带 --json）保留 ICEBERG_JSON 前缀', async () => {
    const r = spawnSync(process.execPath, [tsxCli, CHECK_ICEBERG_SWEEP_SCRIPT, ICEBERG_VALID_SAMPLE], { encoding: 'utf-8' });
    expect(r.status).toBe(0);
    expect(r.stdout ?? '').toContain('ICEBERG_JSON ');
  });
});
