/* eslint-disable security/detect-non-literal-fs-filename -- fixture 仓库与 out 路径均位于本测试拥有的 os.tmpdir() 临时目录 */
/**
 * review-package CLI 端到端契约测试（S32）。
 *
 * 覆盖（P2-B 计划约束 6，逐条强制）：
 *   - 成功路径：exit 0 + stdout 单行 `REVIEW_PACKAGE_JSON {path, base, head, commits, bytes}`；
 *     文件按固定顺序（header 含 base/head range → `git log --oneline` → `git diff --stat` →
 *     `git diff -U10`）且不含任何时间戳 —— 同输入两次运行逐字节一致（可复现契约）；
 *   - `--out` 缺省：写入 cwd 下 `review-<base7>..<head7>.diff`；
 *   - 未知 flag（`--d4-invalid-argument`）→ exit 2 + stdout ERROR_JSON，且目标 out 路径零文件
 *     （exit-2 失败原子性：未知 flag 在任何磁盘写入之前拒绝）；
 *   - 缺参 / 重复 flag / 坏 rev / `--repo` 非法目录 → exit 2。
 *
 * fixture：os.tmpdir() 临时 git 仓（git init + 两个提交；git 调用一律经 lib/run-sync.ts 的
 * runSync，不直接触碰 child_process、不登记 SYNC_PROCESS_EXCEPTIONS）。本文件启动真实 tsx
 * 子进程 → 已登记 config/vitest.config.ts 的 SUBPROCESS_TEST_FILES（vitest-project-split 双向守护）。
 */

import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runSync } from '../lib/run-sync.js';

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
): { code: number | null; stdout: string; stderr: string } {
  const result = runSync(process.execPath, [tsxCli, SCRIPT, ...args], { cwd, timeout: 60_000 });
  return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function errorJson(stdout: string): Record<string, unknown> | null {
  const line = stdout.split(/\r?\n/).find((l) => l.startsWith('ERROR_JSON '));
  if (line === undefined) return null;
  return JSON.parse(line.slice('ERROR_JSON '.length)) as Record<string, unknown>;
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
    const rangeIdx = content1.indexOf(`# range: ${baseSha.slice(0, 7)}..${headSha.slice(0, 7)}`);
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

  it('--repo 非法目录（不存在 / 非 git 仓）→ exit 2', () => {
    const missing = runReviewPackage([
      `--repo=${path.join(tmpDir, 'no-such-repo')}`,
      `--base=${baseSha}`,
      `--head=${headSha}`,
    ]);
    expect(missing.code).toBe(2);
    expect(errorJson(missing.stdout)).toMatchObject({ exitCode: 2 });

    const notARepo = runReviewPackage([`--repo=${tmpDir}`, `--base=${baseSha}`, `--head=${headSha}`]);
    expect(notARepo.code).toBe(2);
    expect(errorJson(notARepo.stdout)).toMatchObject({ exitCode: 2 });
  });
});
