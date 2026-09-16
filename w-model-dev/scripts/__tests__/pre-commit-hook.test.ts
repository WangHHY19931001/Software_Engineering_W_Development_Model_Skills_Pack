/* eslint-disable security/detect-non-literal-fs-filename -- 隔离 git 夹具由 mkdtemp 创建，测试仅写入其目录 */
/** pre-commit 的 staged-only 反向契约：hook 必须读取 index 内容而非工作树内容。 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runSync } from '../lib/run-sync.js';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const hook = path.join(repoRoot, '.githooks', 'pre-commit');
const tempDirs: string[] = [];

async function makeRepository(): Promise<string> {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'wmodel-pre-commit-'));
  tempDirs.push(repo);
  await fs.mkdir(path.join(repo, 'config'), { recursive: true });
  await fs.copyFile(path.join(repoRoot, 'config', 'prettier.config.cjs'), path.join(repo, 'config', 'prettier.config.cjs'));
  // junction 使真实 hook 在隔离仓库中使用本工作树已安装的确定性工具链。
  await fs.symlink(path.join(repoRoot, 'node_modules'), path.join(repo, 'node_modules'), 'junction');
  git(repo, ['init']);
  return repo;
}

function git(repo: string, args: string[]): string {
  const result = runSync('git', args, { cwd: repo, timeout: 30_000 });
  if (result.status !== 0 || result.error !== undefined) throw new Error(`git ${args.join(' ')} failed: ${result.stderr ?? ''}`);
  return result.stdout ?? '';
}

function runHook(repo: string): { code: number | null; stdout: string; stderr: string } {
  // 当前 bash 是 WSL：Node 的 D:\\ 路径须映射为 /mnt/d；再统一 POSIX 分隔符。
  const bashHook = hook.replace(/^([A-Za-z]):/, (_whole, drive: string) => `/mnt/${drive.toLowerCase()}`).replaceAll('\\', '/');
  const result = runSync('bash', [bashHook], { cwd: repo, timeout: 60_000 });
  return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function indexText(repo: string): string {
  return git(repo, ['show', ':fixture.json']);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })));
});

describe('pre-commit staged-only（真实 hook 入口）', () => {
  it('暂存格式合法、工作树格式非法时通过；hook 不得读取或改写工作树版本', async () => {
    const repo = await makeRepository();
    const file = path.join(repo, 'fixture.json');
    const staged = '{\n  "ok": true\n}\n';
    const worktree = '{"ok":true}\n';
    await fs.writeFile(file, staged, 'utf8');
    git(repo, ['add', 'fixture.json']);
    await fs.writeFile(file, worktree, 'utf8');

    const result = runHook(repo);

    expect(result.code, result.stderr).toBe(0);
    await expect(fs.readFile(file, 'utf8')).resolves.toBe(worktree);
    expect(indexText(repo)).toBe(staged);
  });

  it('暂存格式非法、工作树格式合法时阻断；hook 不得用工作树掩盖 index 缺陷', async () => {
    const repo = await makeRepository();
    const file = path.join(repo, 'fixture.json');
    const staged = '{"ok":true}\n';
    const worktree = '{\n  "ok": true\n}\n';
    await fs.writeFile(file, staged, 'utf8');
    git(repo, ['add', 'fixture.json']);
    await fs.writeFile(file, worktree, 'utf8');

    const result = runHook(repo);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('格式不符合 Prettier');
    await expect(fs.readFile(file, 'utf8')).resolves.toBe(worktree);
    expect(indexText(repo)).toBe(staged);
  });
});
