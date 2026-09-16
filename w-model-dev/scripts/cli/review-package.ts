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
 *   4. 文件内容顺序固定：header（含 base/head range）→ `git log --oneline base..head` →
 *      `git diff --stat base..head` → `git diff -U10 base..head`，不含任何时间戳
 *      （同输入同字节 = 可复现）；--out 缺省时写入 cwd 下 `review-<base7>..<head7>.diff`。
 *
 * 退出码：
 *   0  评审包成功写出
 *   2  输入错误（未知/重复/缺失 flag、坏 rev、--repo 不存在或非 git 仓、out 目录不存在）
 *
 * git 调用一律经 lib/run-sync.ts 的 runSync（强制 timeout/SIGKILL/UTF-8，不进 SYNC_PROCESS_EXCEPTIONS）。
 */

import { closeSync, lstatSync, openSync, renameSync, unlinkSync, writeSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';

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
    args[name] = value;
  }
  return args;
}

/** 解析 revision 为完整 commit SHA；无法解析（含 --repo 非 git 仓）返回 undefined */
function resolveRev(repo: string, rev: string): string | undefined {
  const result = runSync('git', ['rev-parse', '--verify', `${rev}^{commit}`], {
    cwd: repo,
    timeout: GIT_REV_TIMEOUT_MS,
  });
  if (result.error !== undefined || result.status !== 0) return undefined;
  const stdout = (result.stdout ?? '').trim();
  return stdout === '' ? undefined : stdout;
}

function validateOutputPath(input: string | undefined): string {
  const rawPath = input ?? `review-pending.diff`;
  if (rawPath.includes('\0') || rawPath.trim() === '') {
    exitWithError({ category: 'ARG_INVALID', rule: 'P0-1', message: '--out 不是有效文件路径', exitCode: 2 });
    throw new HandledCliError();
  }
  let outPath: string;
  try {
    outPath = path.resolve(rawPath);
  } catch {
    exitWithError({ category: 'ARG_INVALID', rule: 'P0-1', message: '--out 不是有效文件路径', exitCode: 2 });
    throw new HandledCliError();
  }
  const outDir = path.dirname(outPath);
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- outDir 派生自调用方 --out，仅作预校验
    if (!lstatSync(outDir).isDirectory()) throw new Error('not-directory');
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- outPath 派生自调用方 --out，仅作预校验
      const target = lstatSync(outPath);
      if (target.isDirectory() || target.isSymbolicLink()) throw new Error('unsafe-target');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  } catch {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-2',
      message: '--out 所在目录不存在或输出目标不可用',
      file: outDir,
      exitCode: 2,
    });
    throw new HandledCliError();
  }
  return outPath;
}

function writeAtomically(outPath: string, content: string): void {
  const temporaryPath = path.join(
    path.dirname(outPath),
    `.${path.basename(outPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let fd: number | undefined;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- temporaryPath 位于已预校验的输出目录
    fd = openSync(temporaryPath, 'wx', 0o600);
    writeSync(fd, content, undefined, 'utf8');
    closeSync(fd);
    fd = undefined;
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- 同目录临时文件到已预校验目标的原子替换
    renameSync(temporaryPath, outPath);
  } catch {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // best effort cleanup
      }
    }
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 仅清理本次创建的唯一临时文件
      unlinkSync(temporaryPath);
    } catch {
      // best effort cleanup
    }
    exitWithError({ category: 'FILE_READ', rule: 'P0-2', message: '评审包写入失败', file: outPath, exitCode: 2 });
    throw new HandledCliError();
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
    repoIsDirectory = lstatSync(repo).isDirectory();
  } catch {
    repoIsDirectory = false;
  }
  if (!repoIsDirectory) {
    exitWithError({
      category: 'FILE_NOT_FOUND',
      rule: 'P0-2',
      message: '--repo 不是存在的目录',
      file: repo,
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

  const outPath = preliminaryOut ?? validateOutputPath(`review-${baseSha.slice(0, 7)}..${headSha.slice(0, 7)}.diff`);

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
  writeAtomically(outPath, content);

  // 契约 3：stdout 单行摘要（base/head 为解析后的完整 SHA，与文件 header 一致）
  console.log(
    `REVIEW_PACKAGE_JSON ${JSON.stringify({ path: outPath, base: baseSha, head: headSha, commits, bytes: Buffer.byteLength(content, 'utf8') })}`,
  );
  process.exitCode = 0;
}

// 统一入口（lib/run-main.ts）：main().catch 统一为 UNEXPECTED + exit 2；exitWithError 已完成输出则静默退出
runMain(main);
