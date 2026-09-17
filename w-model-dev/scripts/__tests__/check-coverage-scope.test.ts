/* eslint-disable security/detect-non-literal-fs-filename -- 负向用例的坏 JSON 副本写入 samples/coverage-scope/ 固定 .tmp 文件名并在 finally 删除；其余路径均为受控仓库常量 */
/**
 * check-coverage-scope CLI 三态契约测试（2026-09-18 leftovers-closeout task 2）。
 *
 * 覆盖：
 *   - exit 0：样本达标 → stdout 单行 `COVERAGE_SCOPE_JSON`（fileCount=2、passed=true）；
 *   - exit 1：阈值抬到 100 → passed=false 且 failures 非空；
 *   - exit 2：报告缺失 / 非法 JSON / 未知 flag / 重复值 flag / 缺值 / 非数值阈值
 *     （ARG_INVALID / FILE_NOT_FOUND / FILE_PARSE；stdout ERROR_JSON + stderr `✗ [`，
 *     在任何扫描前拒绝、零副作用）。
 *
 * 本文件启动真实 tsx 子进程 → 已登记 config/vitest.config.ts 的 SUBPROCESS_TEST_FILES
 * （vitest-project-split 双向守护）。runSync 强制 timeout/SIGKILL；60s 理由同
 * review-package-cli.test.ts（tsx 冷启动在满载下可超 runSync 缺省 15s）。
 */

import { rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CLI = path.join(REPO_ROOT, 'w-model-dev/scripts/cli/check-coverage-scope.ts');
const SAMPLE = path.join(REPO_ROOT, 'w-model-dev/scripts/samples/coverage-scope/valid.json');

function runCli(args: string[]): {
  code: number;
  stdout: string;
  stderr: string;
} {
  // runSync 强制 utf-8 解码（RunSyncOptions 不接受 encoding），60s 防 tsx 冷启动超缺省 15s
  const r = runSync(process.execPath, [tsxCli, CLI, ...args], {
    cwd: REPO_ROOT,
    timeout: 60_000,
  });
  return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}
const FLAGS = ['--min-statements', '0', '--min-branches', '0', '--min-functions', '0', '--min-lines', '0'];

describe('check-coverage-scope CLI 三态', () => {
  it('exit 0：样本达标，stdout 单行 COVERAGE_SCOPE_JSON 含 fileCount=2', () => {
    const r = runCli(['--report', SAMPLE, ...FLAGS]);
    expect(r.code).toBe(0);
    const line = r.stdout.split('\n').find((l) => l.startsWith('COVERAGE_SCOPE_JSON '));
    expect(line).toBeDefined();
    const payload = JSON.parse(line!.slice('COVERAGE_SCOPE_JSON '.length)) as Record<string, unknown>;
    expect(payload.fileCount).toBe(2);
    expect(payload.passed).toBe(true);
  });

  it('exit 1：阈值抬到 100 后不达标，COVERAGE_SCOPE_JSON.passed=false 且 failures 非空', () => {
    const r = runCli([
      '--report',
      SAMPLE,
      '--min-statements',
      '100',
      '--min-branches',
      '100',
      '--min-functions',
      '100',
      '--min-lines',
      '100',
    ]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('"passed":false');
    expect(r.stdout).toContain('failures');
  });

  it('exit 2：报告文件不存在 / 非法 JSON / 未知 flag / 重复值 flag / 缺值 / 非数值阈值', () => {
    expect(runCli(['--report', path.join(REPO_ROOT, 'no-such.json'), ...FLAGS]).code).toBe(2);
    const bad = path.join(REPO_ROOT, 'w-model-dev/scripts/samples/coverage-scope/.tmp-bad.json');
    writeFileSync(bad, '{oops', 'utf8');
    try {
      expect(runCli(['--report', bad, ...FLAGS]).code).toBe(2);
    } finally {
      rmSync(bad);
    }
    expect(runCli(['--nope', 'x', ...FLAGS]).code).toBe(2);
    expect(runCli(['--report', SAMPLE, '--min-statements', '0', '--min-statements=1', ...FLAGS.slice(2)]).code).toBe(2);
    expect(runCli(['--min-statements', ...FLAGS]).code).toBe(2);
    expect(
      runCli([
        '--report',
        SAMPLE,
        '--min-statements',
        'abc',
        '--min-branches',
        '0',
        '--min-functions',
        '0',
        '--min-lines',
        '0',
      ]).code,
    ).toBe(2);
    for (const r of [runCli(['--nope', 'x'])]) {
      expect(r.stdout).toContain('ERROR_JSON');
      expect(r.stderr).toContain('✗ [');
    }
  });
});
