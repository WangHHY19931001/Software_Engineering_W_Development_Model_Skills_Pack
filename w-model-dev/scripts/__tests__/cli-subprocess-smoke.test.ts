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
    await fs.mkdir(path.join(tmpDir, '.w-model'), { recursive: true });
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
