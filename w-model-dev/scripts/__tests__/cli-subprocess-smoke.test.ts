/**
 * CLI 真实子进程冒烟（Wave 2：进程内化后唯一保留的真实 spawn 面，集中单文件）
 *
 * 每个 CLI 一条：最小有效夹具 → 期望退出码 + 关键 stdout 标记。
 * 全量三态/负例由进程内用例（helpers/cli-invoker.ts）与 48 条 exit-2 探针承载。
 * 本文件在 SUBPROCESS_TEST_FILES 登记（真实 spawn，串行项目）。
 */
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));

const PROJECT_JSON =
  '{"id":"smoke","name":"Smoke","description":"","status":"编码","techStack":{"frontend":[],"backend":[],"database":[],"others":[]},"createdAt":"2026-08-05T00:00:00Z","updatedAt":"2026-08-05T01:00:00Z"}';

describe('wm-status 真实子进程冒烟', () => {
  let tmpDir: string;
  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-smoke-'));
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- controlled mkdtemp temp root
    await fs.mkdir(path.join(tmpDir, '.w-model'), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- controlled mkdtemp fixture file
    await fs.writeFile(path.join(tmpDir, '.w-model', 'project.json'), PROJECT_JSON, 'utf-8');
  });
  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
  it('最小夹具 exit 0 + STATUS_JSON 标记', () => {
    const r = runSync(process.execPath, [tsxCli, path.resolve(TEST_DIR, '../cli/wm-status.ts'), tmpDir]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('STATUS_JSON ');
  });
});

describe('check-verifier-output 真实子进程冒烟', () => {
  it('有效样本 exit 0 + 报告头标记', () => {
    const r = runSync(process.execPath, [
      tsxCli,
      path.resolve(TEST_DIR, '../cli/check-verifier-output.ts'),
      path.resolve(TEST_DIR, '../samples/verifier/valid.json'),
    ]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Verifier 输出校验');
  });
});

describe('metrics-report 真实子进程冒烟', () => {
  let tmpDir: string;
  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'metrics-smoke-'));
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- controlled mkdtemp temp root
    await fs.mkdir(path.join(tmpDir, '.w-model'), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- controlled mkdtemp fixture file
    await fs.writeFile(
      path.join(tmpDir, '.w-model', 'run-log.jsonl'),
      '{"phase":1,"action":"produce","role":"S","outcome":"success","tokens":10,"duration_s":1,"subagentSpawns":1,"gateExitCode":null,"timestamp":"2026-08-05T01:00:00Z"}\n',
      'utf-8',
    );
  });
  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
  it('最小夹具 exit 0 + METRICS_JSON 标记', () => {
    const r = runSync(process.execPath, [tsxCli, path.resolve(TEST_DIR, '../cli/metrics-report.ts'), tmpDir]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('METRICS_JSON ');
  });
});

describe('check-artifact-gate 真实子进程冒烟', () => {
  let tmpDir: string;
  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gate-smoke-'));
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- controlled mkdtemp temp root
    await fs.mkdir(path.join(tmpDir, '.w-model'), { recursive: true });
    await fs.copyFile(
      path.resolve(TEST_DIR, '../samples/gate/valid-phase1.json'),
      path.join(tmpDir, '.w-model', 'rtm.json'),
    );
  });
  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
  // RTM-only 最小夹具（无 TLA/BDD 资产）走 fail-closed：exit 1 + 机器可读 GATE_JSON。
  // 冒烟职责是「真实子进程边界保真」——非零退出码经 runMain→process.exitCode→Node flush
  // 的传递与 stdout JSON 标记均在真实进程形态验证（与进程内用例互为对照），exit 0 全资产
  // 正向路径由 gate-report / gate-test-evidence 等既有子进程用例覆盖。
  it('最小夹具（valid-phase1，--phase=1）fail-closed exit 1 + GATE_JSON 标记', () => {
    const r = runSync(process.execPath, [
      tsxCli,
      path.resolve(TEST_DIR, '../cli/check-artifact-gate.ts'),
      tmpDir,
      '--phase=1',
      '--json',
    ]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('"type":"artifact"');
    expect(r.stdout).toContain('tla-manifest.json missing');
  });
});

describe('check-coding-plan 真实子进程冒烟', () => {
  // exit 0 需完整 git 仓库 + scope + 制品树（check-coding-plan.test.ts 已覆盖该形态）；
  // 冒烟取零夹具的 ARG_INVALID 路径：验证真实子进程边界（argv 解析 → ERROR_JSON + exitCode 2 传递）。
  it('无参 → exit 2 + stdout ERROR_JSON 标记', () => {
    const r = runSync(process.execPath, [tsxCli, path.resolve(TEST_DIR, '../cli/check-coding-plan.ts')]);
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/^ERROR_JSON \{/);
    expect(r.stderr).toContain('参数缺失');
  });
});

describe('check-codegraph-queries 真实子进程冒烟', () => {
  // 同 check-coding-plan：exit 0 需 git 仓库 + 合法 scope（check-codegraph-queries.test.ts 已覆盖）；
  // 冒烟取零夹具的 ARG_INVALID 路径。
  it('无参 → exit 2 + stdout ERROR_JSON 标记', () => {
    const r = runSync(process.execPath, [tsxCli, path.resolve(TEST_DIR, '../cli/check-codegraph-queries.ts')]);
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/^ERROR_JSON \{/);
    expect(r.stderr).toContain('参数缺失');
  });
});

describe('code-health-apply 真实子进程冒烟', () => {
  // exit 0 需完整 git 仓库 + candidate/approval fixture（code-health-cli.test.ts 已覆盖）；
  // 冒烟取零夹具的 ARG_INVALID 路径。
  it('无参 → exit 2 + stdout ERROR_JSON 标记', () => {
    const r = runSync(process.execPath, [tsxCli, path.resolve(TEST_DIR, '../cli/code-health-apply.ts')]);
    expect(r.status).toBe(2);
    expect(r.stdout).toContain('ERROR_JSON');
    expect(r.stderr).toContain('--candidate');
  });
});

describe('code-health-ledger 真实子进程冒烟', () => {
  // --help 零读盘纯输出（发现性用法面），exit 0；init/append/validate 正向由 code-health-cli.test.ts 覆盖。
  it('--help → exit 0 + stdout usage 标记', () => {
    const r = runSync(process.execPath, [tsxCli, path.resolve(TEST_DIR, '../cli/code-health-ledger.ts'), '--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('usage: code-health-ledger.ts');
  });
});

describe('code-health-archive 真实子进程冒烟', () => {
  // --help 零读盘纯输出，exit 0；campaign/verify 正向由 code-health-cli.test.ts 覆盖。
  it('--help → exit 0 + stdout usage 标记', () => {
    const r = runSync(process.execPath, [tsxCli, path.resolve(TEST_DIR, '../cli/code-health-archive.ts'), '--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/--campaign/);
  });
});

describe('code-health-duplicates 真实子进程冒烟', () => {
  // exit 0 需合法 duplicate matrix 夹具（code-health-duplicates.test.ts 已覆盖）；
  // 冒烟取零夹具的 ARG_INVALID 路径。
  it('未知 flag → exit 2 + stdout ERROR_JSON 标记', () => {
    const r = runSync(process.execPath, [
      tsxCli,
      path.resolve(TEST_DIR, '../cli/code-health-duplicates.ts'),
      '--bogus',
    ]);
    expect(r.status).toBe(2);
    expect(r.stdout).toContain('ERROR_JSON');
  });
});

describe('review-package 真实子进程冒烟', () => {
  // exit 0 需真实 git 仓库 + base/head rev（review-package-cli.test.ts 已覆盖）；
  // 冒烟取零夹具的 ARG_INVALID 路径。
  it('无参 → exit 2 + stdout ERROR_JSON 标记', () => {
    const r = runSync(process.execPath, [tsxCli, path.resolve(TEST_DIR, '../cli/review-package.ts')]);
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/^ERROR_JSON \{/);
    expect(r.stderr).toContain('--base');
  });
});
