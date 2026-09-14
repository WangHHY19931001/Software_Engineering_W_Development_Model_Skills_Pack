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

import { statSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

import { exitWithError, HandledCliError } from '../lib/cli-error.js';
import { parseFlagValue } from '../lib/parse-args.js';
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

/** 参数解析：值 flag 统一 parseFlagValue（重复 → DuplicateFlagError → runMain ARG_INVALID）；未知 flag 在此检出 */
function parseArgs(argv: string[]): { args: ReviewPackageArgs; unknownFlag: string | undefined } {
  const raw = argv.slice(2);
  const unknownFlag = raw.find((a) => a.startsWith('--') && !KNOWN_FLAGS.some((f) => a.startsWith(`--${f}=`)));
  return {
    args: {
      repo: parseFlagValue(raw, 'repo'),
      base: parseFlagValue(raw, 'base'),
      head: parseFlagValue(raw, 'head'),
      out: parseFlagValue(raw, 'out'),
    },
    unknownFlag,
  };
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
  const { args, unknownFlag } = parseArgs(process.argv);

  // 契约 1：未知 flag 在任何磁盘写入（以及任何 git 调用）之前拒绝
  if (unknownFlag !== undefined) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: `未知参数 ${unknownFlag}`,
      detail:
        '用法: npx tsx w-model-dev/scripts/cli/review-package.ts --repo=<dir> --base=<sha> --head=<sha> [--out=<file>]（仅支持等号形态；未知/重复 flag 在任何磁盘写入之前拒绝）',
      exitCode: 2,
    });
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
  if (args.out !== undefined && args.out.trim() === '') {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: '--out 不能为空',
      detail: '缺省时写入 cwd 下 review-<base7>..<head7>.diff；显式传参须为非空文件路径',
      exitCode: 2,
    });
    return;
  }

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
      category: 'FILE_NOT_FOUND',
      rule: 'P0-2',
      message: '--repo 不是存在的目录',
      file: repo,
      exitCode: 2,
    });
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

  // 契约 4：内容顺序固定（header → log → stat → diff），一律使用解析后的完整 SHA（同输入同字节）
  const range = `${baseSha.slice(0, 7)}..${headSha.slice(0, 7)}`;
  const commitList = gitSection(repo, ['log', '--oneline', range], 'log --oneline');
  const diffStat = gitSection(repo, ['diff', '--stat', range], 'diff --stat');
  const diffBody = gitSection(repo, ['diff', '-U10', range], 'diff -U10');
  const commits = commitList === '' ? 0 : commitList.split('\n').length;

  const content = [
    '# review-package',
    `# base: ${baseSha}`,
    `# head: ${headSha}`,
    `# range: ${range}`,
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
  const outPath = path.resolve(args.out ?? `review-${range}.diff`);
  const outDir = path.dirname(outPath);
  let outDirIsDirectory = false;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- outDir 派生自调用方显式传入的 --out 参数，仅作存在性探测
    outDirIsDirectory = statSync(outDir).isDirectory();
  } catch {
    outDirIsDirectory = false;
  }
  if (!outDirIsDirectory) {
    exitWithError({
      category: 'FILE_NOT_FOUND',
      rule: 'P0-2',
      message: '--out 所在目录不存在',
      file: outDir,
      exitCode: 2,
    });
    return;
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- outPath 派生自调用方显式传入的 --out 参数（缺省 review-<range>.diff）
  writeFileSync(outPath, content, 'utf8');

  // 契约 3：stdout 单行摘要（base/head 为解析后的完整 SHA，与文件 header 一致）
  console.log(
    `REVIEW_PACKAGE_JSON ${JSON.stringify({ path: outPath, base: baseSha, head: headSha, commits, bytes: Buffer.byteLength(content, 'utf8') })}`,
  );
  process.exitCode = 0;
}

// 统一入口（lib/run-main.ts）：main().catch 统一为 UNEXPECTED + exit 2；exitWithError 已完成输出则静默退出
runMain(main);
