/* eslint-disable security/detect-non-literal-fs-filename -- fixture 仓库与 out 路径均位于本测试拥有的 os.tmpdir() 临时目录 */
/**
 * review-package CLI 端到端契约测试（S32）。
 *
 * 覆盖（P2-B 计划约束 6，逐条强制）：
 *   - 成功路径：exit 0 + stdout 单行 `REVIEW_PACKAGE_JSON {path, base, head, commits, bytes}`；
 *     文件按固定顺序（header 含完整 base/head range → 固定 `%H %s` 提交列表 →
 *     `git diff --full-index --stat` → `git diff --full-index -U10`）且不含任何时间戳 ——
 *     同输入两次运行逐字节一致（可复现契约）；
 *   - `--out` 缺省：写入 cwd 下 `review-<base7>..<head7>.diff`；
 *   - 未知 flag（`--d4-invalid-argument`）→ exit 2 + stdout ERROR_JSON，且目标 out 路径零文件
 *     （exit-2 失败原子性：未知 flag 在任何磁盘写入之前拒绝）；
 *   - 缺参 / 重复 flag / 坏 rev / `--repo` 非法目录 → exit 2。
 *
 * fixture：os.tmpdir() 临时 git 仓（git init + 两个提交；git 调用一律经 lib/run-sync.ts 的
 * runSync，不直接触碰 child_process、不登记 SYNC_PROCESS_EXCEPTIONS）。本文件启动真实 tsx
 * 子进程 → 已登记 config/vitest.config.ts 的 SUBPROCESS_TEST_FILES（vitest-project-split 双向守护）。
 */

import { createHash } from 'node:crypto';
import { unlinkSync as unlinkFileSync, writeFileSync as writeFileSyncNative } from 'node:fs';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runSync } from '../lib/run-sync.js';
import { validateOutputPath, writeAtomically, type AtomicWriteFileSystem } from '../cli/review-package.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'w-model-dev', 'scripts', 'cli', 'review-package.ts');

let tmpDir: string;
let repoDir: string;
let baseSha = '';
let headSha = '';

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'review-package-cli-'));
  repoDir = path.join(tmpDir, 'repo');
  await fs.mkdir(repoDir, { recursive: true });
  git(['init']);
  git(['config', 'user.email', 'review-package-test@example.test']);
  git(['config', 'user.name', 'Review Package Test']);
  git(['config', 'commit.gpgsign', 'false']);
  await fs.writeFile(path.join(repoDir, 'a.txt'), 'alpha\n', 'utf8');
  git(['add', '.']);
  git(['commit', '--no-verify', '-m', 'commit A: initial']);
  baseSha = git(['rev-parse', 'HEAD']).trim();
  await fs.writeFile(path.join(repoDir, 'a.txt'), 'alpha changed\n', 'utf8');
  await fs.writeFile(path.join(repoDir, 'b.txt'), 'beta\n', 'utf8');
  git(['add', '.']);
  git(['commit', '--no-verify', '-m', 'commit B: second']);
  headSha = git(['rev-parse', 'HEAD']).trim();
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

/** git 调用统一走 runSync（强制 timeout/SIGKILL）；失败显式抛出，绝不吞错退化断言 */
function git(args: string[]): string {
  const result = runSync('git', args, { cwd: repoDir, timeout: 30_000 });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} 失败：status=${String(result.status)} stderr=${String(result.stderr ?? '')}`,
    );
  }
  return String(result.stdout ?? '');
}

/**
 * 真实 tsx 子进程运行被测 CLI。60s 超时理由同 l0-link-audit-cli.test.ts：
 * 全量并行时 tsx 冷启动可超 runSync 缺省 15s（spawnSync 报 status:null）。
 */
function runReviewPackage(
  args: string[],
  cwd: string = REPO_ROOT,
  env?: NodeJS.ProcessEnv,
): { code: number | null; stdout: string; stderr: string } {
  const result = runSync(process.execPath, [tsxCli, SCRIPT, ...args], {
    cwd,
    timeout: 60_000,
    env: env === undefined ? undefined : { ...process.env, ...env },
  });
  return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function errorJson(stdout: string): Record<string, unknown> | null {
  const line = stdout.split(/\r?\n/).find((l) => l.startsWith('ERROR_JSON '));
  if (line === undefined) return null;
  return JSON.parse(line.slice('ERROR_JSON '.length)) as Record<string, unknown>;
}

interface CommitObject {
  body: string;
  sha: string;
}

/** 在内存中按 Git loose-object 格式找两个不同 commit object 的 7 位 SHA-1 前缀碰撞。 */
function findCommitPrefixCollision(tree: string, parent: string, maxAttempts = 100_000): [CommitObject, CommitObject] {
  const seen = new Map<string, CommitObject>();
  for (let counter = 0; counter < maxAttempts; counter++) {
    const body = [
      `tree ${tree}`,
      `parent ${parent}`,
      'author Prefix Collision <prefix-collision@example.test> 0 +0000',
      'committer Prefix Collision <prefix-collision@example.test> 0 +0000',
      '',
      `prefix-collision-${counter}`,
      '',
    ].join('\n');
    const sha = createHash('sha1')
      .update(`commit ${Buffer.byteLength(body, 'utf8')}\0${body}`)
      .digest('hex');
    const object = { body, sha };
    const prefix = sha.slice(0, 7);
    const previous = seen.get(prefix);
    if (previous !== undefined && previous.sha !== sha) return [previous, object];
    seen.set(prefix, object);
  }
  throw new Error(`未在 ${maxAttempts} 次内找到两个不同 commit object 的 7 位 SHA-1 前缀碰撞`);
}

/** 只在碰撞找到后调用两次 Git；对象实际写入并以 ref 固定，使 git log 可遍历。 */
function writeCommitObject(name: string, object: CommitObject): void {
  const write = runSync('git', ['hash-object', '-t', 'commit', '-w', '--stdin'], {
    cwd: repoDir,
    input: object.body,
    timeout: 30_000,
  });
  if (write.status !== 0 || write.error !== undefined) throw new Error(`写入 ${name} 失败: ${write.stderr ?? ''}`);
  expect(String(write.stdout).trim()).toBe(object.sha);
  git(['update-ref', `refs/heads/${name}`, object.sha]);
}

async function createGitCallProbe(): Promise<{ marker: string; env: NodeJS.ProcessEnv }> {
  const probeDir = path.join(tmpDir, 'git-probe');
  await fs.mkdir(probeDir);
  const marker = path.join(probeDir, 'called.txt');
  if (process.platform === 'win32') {
    await fs.writeFile(
      path.join(probeDir, 'git.cmd'),
      `@echo off\r\n>>"${marker}" echo called\r\nexit /b 99\r\n`,
      'utf8',
    );
  } else {
    const escapedMarker = marker.replaceAll("'", "'\\''");
    await fs.writeFile(path.join(probeDir, 'git'), `#!/bin/sh\nprintf called >> '${escapedMarker}'\nexit 99\n`, 'utf8');
    await fs.chmod(path.join(probeDir, 'git'), 0o700);
  }
  return { marker, env: { PATH: `${probeDir}${path.delimiter}${process.env.PATH ?? ''}` } };
}

describe('review-package CLI（S32 确定性评审包）', () => {
  it('成功：exit 0 + REVIEW_PACKAGE_JSON 单行；文件按固定顺序生成且同输入两次逐字节一致（无时间戳）', async () => {
    const out1 = path.join(tmpDir, 'pkg1.diff');
    const out2 = path.join(tmpDir, 'pkg2.diff');
    const common = [`--repo=${repoDir}`, `--base=${baseSha}`, `--head=${headSha}`];

    const run1 = runReviewPackage([...common, `--out=${out1}`]);
    expect(run1.code, `stderr=${run1.stderr}`).toBe(0);
    const outLines = run1.stdout.trim().split(/\r?\n/);
    expect(outLines).toHaveLength(1);
    expect(outLines[0]).toContain('REVIEW_PACKAGE_JSON ');
    const payload = JSON.parse(outLines[0]!.replace('REVIEW_PACKAGE_JSON ', '')) as Record<string, unknown>;
    expect(payload).toMatchObject({ path: out1, base: baseSha, head: headSha, commits: 1 });
    expect(typeof payload.bytes).toBe('number');

    const run2 = runReviewPackage([...common, `--out=${out2}`]);
    expect(run2.code).toBe(0);
    expect(JSON.parse(run2.stdout.trim().replace('REVIEW_PACKAGE_JSON ', ''))).toMatchObject({
      path: out2,
      bytes: payload.bytes,
    });

    const content1 = await fs.readFile(out1, 'utf8');
    const content2 = await fs.readFile(out2, 'utf8');
    expect(content1).toBe(content2);

    // 固定顺序：header（含 base/head range）→ commits → diff-stat → diff
    const headerIdx = content1.indexOf('# review-package');
    const rangeIdx = content1.indexOf(`# range: ${baseSha}..${headSha}`);
    const commitsIdx = content1.indexOf('## commits');
    const statIdx = content1.indexOf('## diff-stat');
    const diffIdx = content1.indexOf('## diff\n'); // 含换行防前缀命中 '## diff-stat'
    expect(headerIdx).toBeGreaterThanOrEqual(0);
    expect(rangeIdx).toBeGreaterThan(headerIdx);
    expect(commitsIdx).toBeGreaterThan(rangeIdx);
    expect(statIdx).toBeGreaterThan(commitsIdx);
    expect(diffIdx).toBeGreaterThan(statIdx);
    expect(content1).toContain('commit B: second');
    expect(content1).toContain('files changed');
    expect(content1).toContain('+beta');

    // 可复现契约：不含任何时间戳
    expect(content1).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(content1).not.toMatch(/\bDate:\s/);
  });

  it('--out 缺省：写入 cwd 下 review-<base7>..<head7>.diff', async () => {
    const cwdDir = path.join(tmpDir, 'cwd');
    await fs.mkdir(cwdDir, { recursive: true });

    const run = runReviewPackage([`--repo=${repoDir}`, `--base=${baseSha}`, `--head=${headSha}`], cwdDir);

    expect(run.code, `stderr=${run.stderr}`).toBe(0);
    const expectedName = `review-${baseSha.slice(0, 7)}..${headSha.slice(0, 7)}.diff`;
    const payload = JSON.parse(run.stdout.trim().replace('REVIEW_PACKAGE_JSON ', '')) as { path: string };
    expect(path.basename(payload.path)).toBe(expectedName);
    expect(payload.path).toBe(path.join(cwdDir, expectedName));
    await expect(fs.readFile(path.join(cwdDir, expectedName), 'utf8')).resolves.toContain('# review-package');
  });

  it('未知 flag（--d4-invalid-argument）→ exit 2 + stdout ERROR_JSON 且目标 out 路径零文件（写盘前原子拒绝）', async () => {
    const out = path.join(tmpDir, 'must-not-exist.diff');

    const run = runReviewPackage([
      `--repo=${repoDir}`,
      `--base=${baseSha}`,
      `--head=${headSha}`,
      `--out=${out}`,
      '--d4-invalid-argument',
    ]);

    expect(run.code).toBe(2);
    expect(run.stderr).toContain('✗ [ARG_INVALID]');
    expect(errorJson(run.stdout)).toMatchObject({ category: 'ARG_INVALID', exitCode: 2 });
    await expect(fs.access(out)).rejects.toThrow();
  });

  it('缺参（无参 / 缺 --base / 缺 --head）→ exit 2', () => {
    const none = runReviewPackage([]);
    expect(none.code).toBe(2);
    expect(errorJson(none.stdout)).toMatchObject({ category: 'ARG_INVALID', exitCode: 2 });

    const noBase = runReviewPackage([`--repo=${repoDir}`, `--head=${headSha}`]);
    expect(noBase.code).toBe(2);
    expect(errorJson(noBase.stdout)).toMatchObject({ category: 'ARG_INVALID' });

    const noHead = runReviewPackage([`--repo=${repoDir}`, `--base=${baseSha}`]);
    expect(noHead.code).toBe(2);
    expect(errorJson(noHead.stdout)).toMatchObject({ category: 'ARG_INVALID' });
  });

  it('重复 flag（--base 两次）→ exit 2 ARG_INVALID「重复」', () => {
    const run = runReviewPackage([`--repo=${repoDir}`, `--base=${baseSha}`, `--base=${headSha}`, `--head=${headSha}`]);

    expect(run.code).toBe(2);
    expect(run.stderr).toContain('ARG_INVALID');
    expect(run.stderr).toContain('重复');
    expect(errorJson(run.stdout)).toMatchObject({ category: 'ARG_INVALID', exitCode: 2 });
  });

  it('坏 rev（不存在的 sha / 非法标识）→ exit 2', () => {
    const badSha = runReviewPackage([
      `--repo=${repoDir}`,
      '--base=0123456789abcdef0123456789abcdef01234567',
      `--head=${headSha}`,
    ]);
    expect(badSha.code).toBe(2);
    expect(errorJson(badSha.stdout)).toMatchObject({ category: 'ARG_INVALID', exitCode: 2 });

    const garbage = runReviewPackage([`--repo=${repoDir}`, `--base=${baseSha}`, '--head=not-a-rev']);
    expect(garbage.code).toBe(2);
    expect(errorJson(garbage.stdout)).toMatchObject({ category: 'ARG_INVALID' });
  });

  it('--repo 不存在、不是目录或不是 Git 仓库时统一 ARG_INVALID → exit 2', async () => {
    const filePath = path.join(tmpDir, 'repo-file');
    await fs.writeFile(filePath, 'not a directory\n', 'utf8');
    const missing = runReviewPackage([
      `--repo=${path.join(tmpDir, 'no-such-repo')}`,
      `--base=${baseSha}`,
      `--head=${headSha}`,
    ]);
    expect(missing.code).toBe(2);
    expect(errorJson(missing.stdout)).toMatchObject({ category: 'ARG_INVALID', exitCode: 2 });

    const file = runReviewPackage([`--repo=${filePath}`, `--base=${baseSha}`, `--head=${headSha}`]);
    expect(file.code).toBe(2);
    expect(errorJson(file.stdout)).toMatchObject({ category: 'ARG_INVALID', exitCode: 2 });

    const notARepo = runReviewPackage([`--repo=${tmpDir}`, `--base=${baseSha}`, `--head=${headSha}`]);
    expect(notARepo.code).toBe(2);
    expect(errorJson(notARepo.stdout)).toMatchObject({ category: 'ARG_INVALID', exitCode: 2 });
  });

  it('两个真实 commit object 共享 7 位前缀时，完整 SHA 输入仍生成非空评审包', async () => {
    const tree = git(['rev-parse', `${baseSha}^{tree}`]).trim();
    const [collisionBase, collisionPeer] = findCommitPrefixCollision(tree, baseSha);
    expect(collisionBase.sha).not.toBe(collisionPeer.sha);
    expect(collisionBase.sha.slice(0, 7)).toBe(collisionPeer.sha.slice(0, 7));
    writeCommitObject('prefix-collision-a', collisionBase);
    writeCommitObject('prefix-collision-b', collisionPeer);
    const out = path.join(tmpDir, 'real-prefix-collision.diff');

    const result = runReviewPackage([
      `--repo=${repoDir}`,
      `--base=${collisionBase.sha}`,
      `--head=${headSha}`,
      `--out=${out}`,
    ]);

    expect(result.code, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout.replace('REVIEW_PACKAGE_JSON ', ''))).toMatchObject({
      base: collisionBase.sha,
      head: headSha,
      commits: expect.any(Number),
    });
    const content = await fs.readFile(out, 'utf8');
    expect(content).toContain(`# range: ${collisionBase.sha}..${headSha}`);
    expect(content).toContain('commit B: second');
  });

  it('空 --repo 与位置参数 → ARG_INVALID，且不创建输出目标', async () => {
    const out = path.join(tmpDir, 'must-not-exist.diff');
    for (const args of [
      ['--repo=', `--base=${baseSha}`, `--head=${headSha}`, `--out=${out}`],
      [`--repo=${repoDir}`, `--base=${baseSha}`, `--head=${headSha}`, `--out=${out}`, 'unexpected'],
    ]) {
      const result = runReviewPackage(args);
      expect(result.code).toBe(2);
      expect(result.stderr).toContain('ARG_INVALID');
      expect(errorJson(result.stdout)).toMatchObject({ category: 'ARG_INVALID', exitCode: 2 });
      await expect(fs.access(out)).rejects.toThrow();
    }
  });

  it('输出目标为 symlink 时须拒绝且不改写其项目外目标', async () => {
    const external = path.join(tmpDir, 'external.diff');
    const out = path.join(tmpDir, 'out-link.diff');
    await fs.writeFile(external, 'unchanged\n', 'utf8');
    await fs.symlink(external, out, 'file');

    const result = runReviewPackage([`--repo=${repoDir}`, `--base=${baseSha}`, `--head=${headSha}`, `--out=${out}`]);

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('ARG_INVALID');
    expect(errorJson(result.stdout)).toMatchObject({ category: 'ARG_INVALID', exitCode: 2 });
    await expect(fs.readFile(external, 'utf8')).resolves.toBe('unchanged\n');
  });

  it('输出目标是目录时须 ARG_INVALID 拒绝，并且目录内容不变', async () => {
    const out = path.join(tmpDir, 'out-directory');
    await fs.mkdir(out);
    await fs.writeFile(path.join(out, 'sentinel.txt'), 'unchanged\n', 'utf8');

    const result = runReviewPackage([`--repo=${repoDir}`, `--base=${baseSha}`, `--head=${headSha}`, `--out=${out}`]);

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('ARG_INVALID');
    expect(errorJson(result.stdout)).toMatchObject({ category: 'ARG_INVALID', exitCode: 2 });
    await expect(fs.readFile(path.join(out, 'sentinel.txt'), 'utf8')).resolves.toBe('unchanged\n');
  });

  it('在 Git 采集前拒绝非法 --out，即使 revision 也无效', async () => {
    const out = path.join(tmpDir, 'missing-parent', 'package.diff');
    const result = runReviewPackage([`--repo=${repoDir}`, '--base=not-a-rev', `--head=${headSha}`, `--out=${out}`]);

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('--out 所在目录不存在');
    expect(errorJson(result.stdout)).toMatchObject({ category: 'FILE_NOT_FOUND', exitCode: 2 });
  });

  it('非法 --out 前置校验时真实 Git 调用计数为 0', async () => {
    const out = path.join(tmpDir, 'missing-parent-for-git-probe', 'package.diff');
    const probe = await createGitCallProbe();
    const result = runReviewPackage(
      [`--repo=${repoDir}`, `--base=${baseSha}`, `--head=${headSha}`, `--out=${out}`],
      REPO_ROOT,
      probe.env,
    );

    expect(result.code).toBe(2);
    expect(errorJson(result.stdout)).toMatchObject({ category: 'FILE_NOT_FOUND', exitCode: 2 });
    await expect(fs.access(probe.marker)).rejects.toThrow();
  });

  it('core.abbrev 改变时正文提交列表保持完整 SHA 且字节一致', async () => {
    const out4 = path.join(tmpDir, 'abbrev-4.diff');
    const out12 = path.join(tmpDir, 'abbrev-12.diff');
    const common = [`--repo=${repoDir}`, `--base=${baseSha}`, `--head=${headSha}`];

    git(['config', 'core.abbrev', '4']);
    const run4 = runReviewPackage([...common, `--out=${out4}`]);
    git(['config', 'core.abbrev', '12']);
    const run12 = runReviewPackage([...common, `--out=${out12}`]);

    expect(run4.code).toBe(0);
    expect(run12.code).toBe(0);
    const content4 = await fs.readFile(out4, 'utf8');
    const content12 = await fs.readFile(out12, 'utf8');
    expect(content4).toBe(content12);
    expect(content4).toContain(`${headSha} commit B: second`);
  });

  it('无值选项、空白值和未知位置参数均为 ARG_INVALID', async () => {
    const out = path.join(tmpDir, 'must-not-exist-2.diff');
    for (const args of [
      ['--repo', `--base=${baseSha}`, `--head=${headSha}`],
      [`--repo=${repoDir}`, '--base', `--head=${headSha}`],
      [`--repo=${repoDir}`, `--base=${baseSha}`, '--head', `--out=${out}`],
      [`--repo=  `, `--base=${baseSha}`, `--head=${headSha}`, `--out=${out}`],
      [`--repo=${repoDir}`, `--base=${baseSha}`, `--head=${headSha}`, `--out=  `],
      [`--repo=${repoDir}`, `--base=${baseSha}`, `--head=${headSha}`, `--out=${out}`, 'unexpected'],
    ]) {
      const result = runReviewPackage(args);
      expect(result.code).toBe(2);
      expect(result.stderr).toContain('ARG_INVALID');
      expect(errorJson(result.stdout)).toMatchObject({ category: 'ARG_INVALID', exitCode: 2 });
      await expect(fs.access(out)).rejects.toThrow();
    }
  });

  it.skipIf(process.platform === 'win32')('Unix 权限拒绝时保留既有 sentinel 文件', async () => {
    const readonlyDir = path.join(tmpDir, 'readonly');
    const out = path.join(readonlyDir, 'package.diff');
    await fs.mkdir(readonlyDir);
    await fs.writeFile(out, 'sentinel\n', 'utf8');
    await fs.chmod(readonlyDir, 0o500);
    try {
      const result = runReviewPackage([`--repo=${repoDir}`, `--base=${baseSha}`, `--head=${headSha}`, `--out=${out}`]);
      expect(result.code).toBe(2);
      expect(errorJson(result.stdout)).toMatchObject({ exitCode: 2 });
      await expect(fs.readFile(out, 'utf8')).resolves.toBe('sentinel\n');
    } finally {
      await fs.chmod(readonlyDir, 0o700);
    }
  });

  it('注入 writeFileSync 失败时清理临时文件并保留 sentinel', async () => {
    const out = path.join(tmpDir, 'write-failure.diff');
    await fs.writeFile(out, 'sentinel\n', 'utf8');
    const validated = validateOutputPath(out);
    const unlinkCalls: string[] = [];
    const fileSystem: AtomicWriteFileSystem = {
      writeFileSync: () => {
        throw new Error('injected write failure');
      },
      renameSync: () => {
        throw new Error('rename must not be reached');
      },
      unlinkSync: (filePath) => {
        unlinkCalls.push(filePath);
        try {
          unlinkFileSync(filePath);
        } catch {
          // The injected write may fail before creating the temporary file.
        }
      },
    };

    expect(() => writeAtomically(validated, 'replacement\n', fileSystem)).toThrow('评审包原子写入失败');
    await expect(fs.readFile(out, 'utf8')).resolves.toBe('sentinel\n');
    expect(unlinkCalls).toHaveLength(1);
    expect((await fs.readdir(tmpDir)).some((name) => name.startsWith('.write-failure.diff.'))).toBe(false);
  });

  it('注入 renameSync 失败时清理已写入临时文件并保留 sentinel', async () => {
    const out = path.join(tmpDir, 'rename-failure.diff');
    await fs.writeFile(out, 'sentinel\n', 'utf8');
    const validated = validateOutputPath(out);
    const fileSystem: AtomicWriteFileSystem = {
      writeFileSync: (filePath, data, options) => writeFileSyncNative(filePath, data, options),
      renameSync: () => {
        throw new Error('injected rename failure');
      },
      unlinkSync: unlinkFileSync,
    };

    expect(() => writeAtomically(validated, 'replacement\n', fileSystem)).toThrow('评审包原子写入失败');
    await expect(fs.readFile(out, 'utf8')).resolves.toBe('sentinel\n');
    expect((await fs.readdir(tmpDir)).some((name) => name.startsWith('.rename-failure.diff.'))).toBe(false);
  });

  it('父目录 canonical 身份改变时写入前拒绝且不创建输出', async () => {
    const outputDir = path.join(tmpDir, 'identity-check');
    const movedDir = path.join(tmpDir, 'identity-check-moved');
    const out = path.join(outputDir, 'package.diff');
    await fs.mkdir(outputDir);
    const validated = validateOutputPath(out);
    await fs.rename(outputDir, movedDir);
    await fs.mkdir(outputDir);

    expect(() => writeAtomically(validated, 'replacement\n')).toThrow('评审包原子写入失败');
    await expect(fs.access(out)).rejects.toThrow();
    await expect(fs.readdir(outputDir)).resolves.toEqual([]);
  });
});
