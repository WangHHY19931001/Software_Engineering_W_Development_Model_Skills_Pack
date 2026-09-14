/* eslint-disable security/detect-non-literal-fs-filename -- 快照路径均为仓库根下的固定相对路径常量，临时探针目录为本测试进程拥有的 OS temp 目录。 */
/**
 * exit-2 门禁「失败原子性」守护（S26）。
 *
 * 信号：门禁「失败时没留下半成品」（fail-closed 的原子性）此前只在 __tests__/ 的 code-health 区
 * 被断言（code-health-archive-boundary / code-health-cli / code-health-task1-integration 的
 * snapshotTree），其余 30+ 个 exit-2 门禁的负向路径没有任何原子性保证。
 *
 * 做法：对 check-docs-consistency.ts:233-243 同源的门禁集合（cli/*.ts 减去 self-test.ts，动态推导）
 * 逐个做一次负向调用，并在调用前后对「该调用可能触碰的仓库工作树路径」做 sha256 快照 + git 状态比对，
 * 断言前后逐字节相等。每个门禁一个 `it()`，失败可定位到具体门禁，且能用用例级 timeout。
 *
 * 口径来源（不另立一套）：
 *   - 集合与调用参数：w-model-dev/scripts/cli/check-docs-consistency.ts collectExit2ScriptResults
 *     （基础探针 `--d4-invalid-argument`；security-scan / metrics-report / wm-export-evidence /
 *     wm-status 用 :246-276 的特殊探针参数）。
 *   - 快照风格：code-health-task1-integration.test.ts:190-213 的 snapshotTree()（sha256 + 目录/符号链接标记）。
 *   - spawn 文件登记：config/vitest.config.ts 的 SUBPROCESS_TEST_FILES（本文件 spawn 真实子进程）。
 *
 * 边界：本测试只读仓库工作树、只在本测试进程拥有的 os.tmpdir() 临时目录里造探针 fixture，
 * 绝不写 .w-model/；断言失败即真实缺陷（门禁在失败路径上留下了半成品），不得放宽。
 */
import { execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, '..', '..', '..');
const CLI_DIR = join(REPO_ROOT, 'w-model-dev', 'scripts', 'cli');
const require = createRequire(import.meta.url);
const TSX_CLI = require.resolve('tsx/cli');

/**
 * 门禁集合动态推导（不硬编码名字）：与 check-docs-consistency 的 exit-2 中心探针、
 * check-samples-coverage 第 4 条规则同一口径 —— cli/*.ts 减去 self-test.ts（聚合器，非 exit-2 门禁）。
 * 4 个用特殊探针参数的脚本（security-scan / metrics-report / wm-export-evidence / wm-status）
 * 仍计入集合，见 negativeProbeFor()。
 */
const GATE_FILES: readonly string[] = readdirSync(CLI_DIR)
  .filter((name) => name.endsWith('.ts') && name !== 'self-test.ts')
  .sort();

/** 集合规模漂移守卫：43 = cli/*.ts(44) - self-test.ts。名字仍由 readdirSync 动态推导。 */
const EXPECTED_GATE_COUNT = 43;

/**
 * 负向调用可能触碰的仓库工作树路径。缺失路径记 `<missing>`（可侦测"被半成品创建出来"）。
 * - `w-model-dev/scripts/samples`：覆盖 gate-log 输出位置 samples/.w-model/ 以及全部 fixture
 *   （被门禁误改/误删会体现在 sha256 上）；
 * - `coverage/`：被覆盖率门禁创建；
 * - `.w-model/`：运行期状态与 gate-log（若存在则纳入，不存在时记 `<missing>`）。
 */
const SNAPSHOT_TARGETS = ['w-model-dev/scripts/samples', 'coverage', '.w-model'] as const;

interface RepoSnapshot {
  /** 仓库根相对 POSIX 路径 → `directory` / `symlink:<target>` / `file:<sha256>` / `<missing>`。 */
  readonly paths: Record<string, string>;
  /** `git status --porcelain` 的原始输出（跟踪/未跟踪变更）。 */
  readonly gitStatus: string;
  /** `git diff --name-only` 的原始输出（工作区 vs index）。 */
  readonly gitDiffNames: string;
}

interface NegativeProbe {
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
}

interface ProbeOutcome {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** 仓库根相对 POSIX 路径。 */
function repoRelative(absolutePath: string): string {
  return relative(REPO_ROOT, absolutePath).split(sep).join('/');
}

/** 递归快照一棵树（文件记 sha256，目录/符号链接记标记），照 code-health snapshotTree 风格。 */
function snapshotTree(absoluteRoot: string): Record<string, string> {
  const entries = new Map<string, string>();
  const walk = (directory: string): void => {
    const dirents = readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const dirent of dirents) {
      const absolute = join(directory, dirent.name);
      const key = repoRelative(absolute);
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        entries.set(key, `symlink:${readlinkSync(absolute)}`);
        continue;
      }
      if (stat.isDirectory()) {
        entries.set(key, 'directory');
        walk(absolute);
        continue;
      }
      entries.set(key, `file:${sha256Hex(readFileSync(absolute))}`);
    }
  };
  walk(absoluteRoot);
  return Object.fromEntries(entries);
}

/** 调用前后的完整仓库状态快照：可能被触碰的路径树 + git 状态。 */
function takeSnapshot(): RepoSnapshot {
  const pathEntries = new Map<string, string>();
  for (const target of SNAPSHOT_TARGETS) {
    const absolute = join(REPO_ROOT, ...target.split('/'));
    if (!existsSync(absolute)) {
      pathEntries.set(target, '<missing>');
      continue;
    }
    const stat = lstatSync(absolute);
    if (stat.isDirectory()) {
      pathEntries.set(target, 'directory');
      for (const [key, value] of Object.entries(snapshotTree(absolute))) pathEntries.set(key, value);
    } else {
      pathEntries.set(target, `file:${sha256Hex(readFileSync(absolute))}`);
    }
  }
  const sortedPaths = Object.fromEntries([...pathEntries.entries()].sort(([a], [b]) => a.localeCompare(b)));
  return {
    paths: sortedPaths,
    gitStatus: execFileSync('git', ['status', '--porcelain'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }),
    gitDiffNames: execFileSync('git', ['diff', '--name-only'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }),
  };
}

/** 与 collectExit2ScriptResults 同源的每门禁负向探针参数。 */
function negativeProbeFor(gateFile: string, probeRoot: string): NegativeProbe {
  switch (gateFile) {
    case 'security-scan.ts':
      // 清空 PATH：eslint 不可用 → 输入错误 exit 2（check-docs-consistency.ts:246-250）。
      return { args: [], env: { ...process.env, PATH: '', Path: '' } };
    case 'metrics-report.ts':
      // 非法 --phase=0，cwd 为 mktemp 探针根（:251-255）。
      return { args: [join(probeRoot, 'probe-project'), '--phase=0', '--json'], cwd: probeRoot };
    case 'wm-export-evidence.ts':
      // 未知选项（:266-270 的 unknown-option 探针，与基础探针同参数）。
      return { args: ['--d4-invalid-argument'] };
    case 'wm-status.ts':
      // 损坏 project.json 的探针项目（:276）。
      return { args: [join(probeRoot, 'invalid-status-project')] };
    default:
      // 基础探针（:233-244）。
      return { args: ['--d4-invalid-argument'] };
  }
}

function runNegativeProbe(gateFile: string, probeRoot: string): Promise<ProbeOutcome> {
  const probe = negativeProbeFor(gateFile, probeRoot);
  return new Promise((resolveOutcome) => {
    execFile(
      process.execPath,
      [TSX_CLI, join(CLI_DIR, gateFile), ...probe.args],
      {
        cwd: probe.cwd ?? REPO_ROOT,
        ...(probe.env === undefined ? {} : { env: probe.env }),
        encoding: 'utf8',
        timeout: 30_000,
        maxBuffer: 64 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const code = (error as { code?: number | string } | null)?.code;
        resolveOutcome({
          status: error === null ? 0 : typeof code === 'number' ? code : -1,
          stdout: String(stdout ?? ''),
          stderr: String(stderr ?? ''),
        });
      },
    );
  });
}

describe('exit-2 门禁失败原子性（S26）', () => {
  let probeRoot = '';

  beforeAll(() => {
    probeRoot = mkdtempSync(join(tmpdir(), 'wm-exit2-atomicity-'));
    mkdirSync(join(probeRoot, 'invalid-status-project', '.w-model'), { recursive: true });
    writeFileSync(join(probeRoot, 'invalid-status-project', '.w-model', 'project.json'), '{', 'utf-8');
  });

  afterAll(() => {
    if (probeRoot !== '') rmSync(probeRoot, { recursive: true, force: true });
  });

  it('门禁集合 = cli/*.ts 减去 self-test.ts（43 个，动态推导，无手抄名单）', () => {
    expect(GATE_FILES).toHaveLength(EXPECTED_GATE_COUNT);
    expect(GATE_FILES).not.toContain('self-test.ts');
    expect(GATE_FILES.every((name) => name.endsWith('.ts'))).toBe(true);
  });

  for (const gateFile of GATE_FILES) {
    it(`${gateFile} 负向调用 exit 2 后仓库状态逐字节不变`, async () => {
      const before = takeSnapshot();
      // 快照非空守卫：空快照会让"前后相等"恒真（断言被架空）。
      expect(Object.keys(before.paths).length, `${gateFile} 的快照不应为空`).toBeGreaterThan(0);

      const outcome = await runNegativeProbe(gateFile, probeRoot);
      const after = takeSnapshot();

      expect(
        outcome.status,
        `${gateFile} 的负向探针应 exit 2（stdout=${outcome.stdout.slice(0, 300)} stderr=${outcome.stderr.slice(0, 300)}）`,
      ).toBe(2);
      expect(after.paths, `${gateFile} 失败后仓库路径快照应逐字节不变`).toEqual(before.paths);
      expect(after.gitStatus, `${gateFile} 失败后 git status --porcelain 应不变`).toBe(before.gitStatus);
      expect(after.gitDiffNames, `${gateFile} 失败后 git diff --name-only 应不变（工作区无新增/回退改动）`).toBe(
        before.gitDiffNames,
      );
    }, 60_000);
  }
});
