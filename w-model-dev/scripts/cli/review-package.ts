#!/usr/bin/env tsx
/**
 * 评审包落盘 CLI（Review Package）—— 把 diff 评审包按 range 命名落盘为可复现单文件（S32）
 *
 * 「评审包不进编排者上下文」：V 评审 / 审计所需的 diff 输入按固定顺序物化为单个文件，
 * 同输入（同 repo 状态 + 同 base/head）重跑逐字节一致，可独立复现与归档。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/review-package.ts --repo=<dir> --base=<sha> --head=<sha> [--out=<file>]
 *
 * 行为契约（P2-B 计划约束 6，逐条强制）：
 *   1. 未知 flag（含 --d4-invalid-argument）与重复 flag → ARG_INVALID exit 2，
 *      且发生在任何磁盘写入之前（exit-2 失败原子性，exit2-failure-atomicity.test.ts 探针）；
 *   2. 坏 rev（--base/--head 无法解析为 commit）→ exit 2；
 *   3. 成功 exit 0，stdout 单行 `REVIEW_PACKAGE_JSON {path, base, head, commits, bytes}`；
 *   4. 文件内容顺序固定：header（含完整 base/head range）→ `git log --format=%H %s base..head` →
 *      `git diff --full-index --stat base..head` → `git diff --full-index -U10 base..head`，不含任何时间戳
 *      （同输入同字节 = 可复现）；--out 缺省时写入 cwd 下 `review-<base7>..<head7>.diff`。
 *
 * 退出码：
 *   0  评审包成功写出
 *   2  输入错误（未知/重复/缺失 flag、坏 rev、--repo 不存在或非 git 仓、out 目录不存在）
 *
 * git 调用一律经 lib/run-sync.ts 的 runSync（强制 timeout/SIGKILL/UTF-8，不进 SYNC_PROCESS_EXCEPTIONS）。
 */

import { randomUUID } from 'node:crypto';
import { lstatSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { exitWithError, HandledCliError } from '../lib/cli-error.js';
import { runMain } from '../lib/run-main.js';
import { runSync } from '../lib/run-sync.js';

/** 已知等号形态 flag（--repo/--base/--head/--out）；其余 --xxx 一律未知 flag 拒绝 */
const KNOWN_FLAGS = ['repo', 'base', 'head', 'out'] as const;

/** git 子进程上限：rev 解析用短超时，diff 采集放宽到 30s（大 diff 场景） */
const GIT_REV_TIMEOUT_MS = 15_000;
const GIT_CAPTURE_TIMEOUT_MS = 30_000;

interface ReviewPackageArgs {
  repo: string | undefined;
  base: string | undefined;
  head: string | undefined;
  out: string | undefined;
}

/** 严格解析仅支持 --name=value；所有位置参数、无值选项和空值均拒绝。 */
function parseArgs(argv: string[]): ReviewPackageArgs {
  const raw = argv.slice(2);
  const args: ReviewPackageArgs = { repo: undefined, base: undefined, head: undefined, out: undefined };
  const seen = new Set<string>();
  for (const token of raw) {
    if (!token.startsWith('--')) {
      throw new Error(`未知位置参数 ${token}`);
    }
    const match = /^--([^=]+)=(.*)$/s.exec(token);
    if (match === null || !(KNOWN_FLAGS as readonly string[]).includes(match[1]!)) {
      throw new Error(`未知或无值参数 ${token}`);
    }
    const name = match[1] as keyof ReviewPackageArgs;
    const value = match[2]!;
    if (seen.has(name)) throw new Error(`重复的命令行参数 --${name}`);
    if (value.trim() === '') throw new Error(`--${name} 不能为空`);
    seen.add(name);
    // eslint-disable-next-line security/detect-object-injection -- 写入本函数内新建的局部参数表；name 来自 KNOWN_FLAGS 白名单匹配（match[1]），非未校验输入
    args[name] = value;
  }
  return args;
}

/** 解析 revision 为完整 commit SHA；无法解析返回 undefined。 */
function resolveRev(repo: string, rev: string): string | undefined {
  const result = runSync('git', ['rev-parse', '--verify', `${rev}^{commit}`], {
    cwd: repo,
    timeout: GIT_REV_TIMEOUT_MS,
  });
  if (result.error !== undefined || result.status !== 0) return undefined;
  const stdout = (result.stdout ?? '').trim();
  return stdout === '' ? undefined : stdout;
}

class OutputPathError extends Error {
  constructor(
    public readonly kind: 'invalid-path' | 'missing-parent' | 'unsafe-target' | 'changed-parent',
    public readonly file?: string,
  ) {
    super('输出路径校验失败');
  }
}

export class AtomicWriteError extends Error {
  constructor() {
    super('评审包原子写入失败');
  }
}

interface OutputDirectoryIdentity {
  canonicalPath: string;
  dev: number;
  ino: number;
}

export interface ValidatedOutputPath {
  path: string;
  parent: OutputDirectoryIdentity;
}

export interface AtomicWriteFileSystem {
  writeFileSync: (filePath: string, data: string, options: { encoding: 'utf8'; flag: 'wx'; mode: number }) => void;
  renameSync: (oldPath: string, newPath: string) => void;
  unlinkSync: (filePath: string) => void;
}

const DEFAULT_ATOMIC_WRITE_FS: AtomicWriteFileSystem = { writeFileSync, renameSync, unlinkSync };

function normalizeOutputPath(input: string): string {
  if (input.includes('\0') || input.trim() === '') throw new OutputPathError('invalid-path');
  try {
    return path.resolve(input);
  } catch {
    throw new OutputPathError('invalid-path');
  }
}

function readOutputDirectoryIdentity(outDir: string): OutputDirectoryIdentity {
  let directoryStats: ReturnType<typeof statSync>;
  let canonicalPath: string;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- outDir 派生自调用方 --out，仅作目录预校验
    directoryStats = statSync(outDir);
    if (!directoryStats.isDirectory()) throw new OutputPathError('missing-parent', outDir);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- canonicalize 已预校验的输出父目录
    canonicalPath = realpathSync(outDir);
  } catch (error) {
    if (error instanceof OutputPathError) throw error;
    throw new OutputPathError('missing-parent', outDir);
  }
  return { canonicalPath, dev: directoryStats.dev, ino: directoryStats.ino };
}

function inspectOutputPath(input: string): ValidatedOutputPath {
  const outPath = normalizeOutputPath(input);
  const outDir = path.dirname(outPath);
  const parent = readOutputDirectoryIdentity(outDir);
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- outPath 派生自调用方 --out，仅作目标预校验
    const target = lstatSync(outPath);
    if (target.isDirectory() || target.isSymbolicLink() || !target.isFile()) {
      throw new OutputPathError('unsafe-target', outPath);
    }
  } catch (error) {
    if (error instanceof OutputPathError) throw error;
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new OutputPathError('unsafe-target', outPath);
  }
  return { path: outPath, parent };
}

export function validateOutputPath(input: string): ValidatedOutputPath {
  try {
    return inspectOutputPath(input);
  } catch (error) {
    const outputError = error instanceof OutputPathError ? error : new OutputPathError('invalid-path');
    if (outputError.kind === 'missing-parent') {
      exitWithError({
        category: 'FILE_NOT_FOUND',
        rule: 'P0-2',
        message: '--out 所在目录不存在',
        file: outputError.file,
        exitCode: 2,
      });
    } else {
      exitWithError({
        category: 'ARG_INVALID',
        rule: 'P0-2',
        message: '--out 不是可用的普通文件路径',
        file: outputError.file,
        exitCode: 2,
      });
    }
    throw new HandledCliError();
  }
}

function samePath(left: string, right: string): boolean {
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function sameDirectoryIdentity(left: OutputDirectoryIdentity, right: OutputDirectoryIdentity): boolean {
  return samePath(left.canonicalPath, right.canonicalPath) && left.dev === right.dev && left.ino === right.ino;
}

function revalidateOutputPath(output: ValidatedOutputPath): void {
  let current: ValidatedOutputPath;
  try {
    current = inspectOutputPath(output.path);
  } catch {
    throw new OutputPathError('changed-parent', output.path);
  }
  if (!sameDirectoryIdentity(output.parent, current.parent)) {
    throw new OutputPathError('changed-parent', output.path);
  }
}

export function writeAtomically(
  output: ValidatedOutputPath,
  content: string,
  fileSystem: AtomicWriteFileSystem = DEFAULT_ATOMIC_WRITE_FS,
): void {
  const temporaryPath = path.join(
    output.parent.canonicalPath,
    `.${path.basename(output.path)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    // 父目录 canonical 身份和目标类型在创建临时文件前再次确认。
    revalidateOutputPath(output);
    // writeFileSync 负责完整 UTF-8 写入并在返回前关闭文件，不存在 writeSync 短写窗口。
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 临时文件位于已确认 canonical 父目录
    fileSystem.writeFileSync(temporaryPath, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    // rename 前再次确认父目录 canonical 身份和目标类型，避免采集期间目录被替换。
    revalidateOutputPath(output);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同目录临时文件到已确认目标的原子替换
    fileSystem.renameSync(temporaryPath, output.path);
  } catch (error) {
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 仅清理本次生成的 canonical 临时文件
      fileSystem.unlinkSync(temporaryPath);
    } catch {
      // best effort cleanup；不覆盖原始写入/rename 错误
    }
    if (error instanceof AtomicWriteError) throw error;
    throw new AtomicWriteError();
  }
}

/** 按 section 采集 git 输出（去尾换行，保持确定性）；失败 → exit 2（UNEXPECTED）并中断 */
function gitSection(repo: string, gitArgs: string[], label: string): string {
  const result = runSync('git', gitArgs, { cwd: repo, timeout: GIT_CAPTURE_TIMEOUT_MS });
  if (result.error !== undefined || result.status !== 0) {
    exitWithError({
      category: 'UNEXPECTED',
      message: `git ${label} 执行失败`,
      detail: `status=${String(result.status)} stderr=${(result.stderr ?? '').trim().slice(0, 500)}`,
      exitCode: 2,
    });
    throw new HandledCliError();
  }
  const stdout = result.stdout ?? '';
  return stdout.endsWith('\n') ? stdout.slice(0, -1) : stdout;
}

async function main(): Promise<void> {
  let args: ReviewPackageArgs;
  try {
    args = parseArgs(process.argv);
  } catch (error) {
    exitWithError({ category: 'ARG_INVALID', rule: 'P0-1', message: (error as Error).message, exitCode: 2 });
    return;
  }

  // 缺参校验（--base/--head 必需；--repo 缺省 cwd；--out 缺省 cwd 下 review-<base7>..<head7>.diff）
  if (args.base === undefined || args.base === '' || args.head === undefined || args.head === '') {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '缺少必需参数 --base / --head',
      detail:
        '用法: npx tsx w-model-dev/scripts/cli/review-package.ts --repo=<dir> --base=<sha> --head=<sha> [--out=<file>]',
      exitCode: 2,
    });
    return;
  }

  // 输出路径必须在任何 Git 调用前完成规范化与目标安全检查。
  const requestedOut = args.out;

  const repo = path.resolve(args.repo ?? process.cwd());
  let repoIsDirectory = false;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- repo 为调用方显式传入的 --repo 参数（缺省 cwd），仅作存在性探测
    repoIsDirectory = statSync(repo).isDirectory();
  } catch {
    repoIsDirectory = false;
  }
  if (!repoIsDirectory) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '--repo 必须是存在的目录',
      exitCode: 2,
    });
    return;
  }

  const preliminaryOut = requestedOut === undefined ? undefined : validateOutputPath(requestedOut);

  const repoCheck = runSync('git', ['rev-parse', '--git-dir'], { cwd: repo, timeout: GIT_REV_TIMEOUT_MS });
  if (repoCheck.error !== undefined || repoCheck.status !== 0) {
    exitWithError({ category: 'ARG_INVALID', rule: 'P0-1', message: '--repo 不是 Git 仓库', exitCode: 2 });
    return;
  }

  // 契约 2：坏 rev 在任何写盘之前拒绝（同时覆盖「--repo 非 git 仓」场景）
  const baseSha = resolveRev(repo, args.base);
  if (baseSha === undefined) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '--base 不是有效 revision',
      detail: `收到 ${args.base}（或 --repo 不是 git 仓库）`,
      exitCode: 2,
    });
    return;
  }
  const headSha = resolveRev(repo, args.head);
  if (headSha === undefined) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '--head 不是有效 revision',
      detail: `收到 ${args.head}（或 --repo 不是 git 仓库）`,
      exitCode: 2,
    });
    return;
  }

  const output = preliminaryOut ?? validateOutputPath(`review-${baseSha.slice(0, 7)}..${headSha.slice(0, 7)}.diff`);
  try {
    revalidateOutputPath(output);
  } catch {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-2',
      message: '--out 父目录身份或目标类型在采集前发生变化',
      exitCode: 2,
    });
    return;
  }

  // 契约 4：内容顺序固定（header → log → stat → diff），一律使用解析后的完整 SHA（同输入同字节）
  const fullRange = `${baseSha}..${headSha}`;
  const commitList = gitSection(repo, ['log', '--format=%H %s', '--no-decorate', fullRange], 'log --format');
  const diffStat = gitSection(repo, ['diff', '--full-index', '--stat', fullRange], 'diff --stat');
  const diffBody = gitSection(repo, ['diff', '--full-index', '-U10', fullRange], 'diff -U10');
  const commits = commitList === '' ? 0 : commitList.split('\n').length;

  const content = [
    '# review-package',
    `# base: ${baseSha}`,
    `# head: ${headSha}`,
    `# range: ${fullRange}`,
    '',
    '## commits',
    commitList,
    '',
    '## diff-stat',
    diffStat,
    '',
    '## diff',
    diffBody,
    '',
  ].join('\n');

  // 契约 1（原子性）：到这里全部校验已完成，之后才是唯一的磁盘写入
  try {
    writeAtomically(output, content);
  } catch (error) {
    if (error instanceof AtomicWriteError) {
      exitWithError({ category: 'FILE_READ', rule: 'P0-2', message: '评审包写入失败', file: output.path, exitCode: 2 });
      return;
    }
    throw error;
  }

  // 契约 3：stdout 单行摘要（base/head 为解析后的完整 SHA，与文件 header 一致）
  console.log(
    `REVIEW_PACKAGE_JSON ${JSON.stringify({ path: output.path, base: baseSha, head: headSha, commits, bytes: Buffer.byteLength(content, 'utf8') })}`,
  );
  process.exitCode = 0;
}

// 统一入口（lib/run-main.ts）：main().catch 统一为 UNEXPECTED + exit 2；导入模块时不启动 CLI，便于测试写入层。
const modulePath = path.resolve(fileURLToPath(import.meta.url));
const invokedAsScript = process.argv.slice(1, 3).some((argument) => {
  try {
    return path.resolve(argument) === modulePath;
  } catch {
    return false;
  }
});
if (invokedAsScript) runMain(main);
