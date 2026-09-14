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
import { execFile } from 'node:child_process';
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

import { runSync } from '../lib/run-sync.js';

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
  /** `git status --porcelain` 的原始输出（跟踪/未跟踪变更）；消费方式为**单调**，见 expectNoNewDirtyPaths()。 */
  readonly gitStatus: string;
  /** `git diff --name-only` 的原始输出（工作区 vs index）；同样按单调口径消费。 */
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
    gitStatus: runGit(['status', '--porcelain']),
    gitDiffNames: runGit(['diff', '--name-only']),
  };
}

/**
 * 经 `lib/run-sync` 的 `runSync` 入口执行 git 探针（见其"正规入口"约定）。
 * 这样本文件不再出现任何**直接**的同步 child_process 调用（spawnSync/execSync/execFileSync），
 * 因而无需登记 `SYNC_PROCESS_EXCEPTIONS`（该清单只约束直接同步调用；由 run-sync.test.ts 守护）。
 * runSync 返回 `{ status, stdout, stderr, error }`；失败时在此**显式抛出**而非吞错，
 * 保证状态探针不会静默退化（不得用 try/catch 掩盖）。
 */
function runGit(args: readonly string[]): string {
  const result = runSync('git', [...args], { cwd: REPO_ROOT });
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} 失败：status=${String(result.status)} stderr=${String(result.stderr ?? '')}`,
    );
  }
  return String(result.stdout ?? '');
}

/**
 * 从 `git status --porcelain` 输出解析脏路径集合。
 * porcelain v1 每行形如 `XY PATH`（固定 3 字符前缀）；rename/copy 为 `XY OLD -> NEW`，取 NEW。
 * 解析保持宽松（不反转义 C-quote）：只用于子集比较，同一输入的解析是稳定的。
 */
function porcelainDirtyPaths(statusOutput: string): Set<string> {
  const paths = new Set<string>();
  for (const line of statusOutput.split(/\r?\n/)) {
    if (line.length < 4) continue;
    const rest = line.slice(3);
    const arrow = rest.lastIndexOf(' -> ');
    paths.add(arrow === -1 ? rest : rest.slice(arrow + 4));
  }
  return paths;
}

/** 从 `git diff --name-only` 输出解析脏路径集合（每行一个路径）。 */
function nameOnlyDirtyPaths(diffOutput: string): Set<string> {
  return new Set(diffOutput.split(/\r?\n/).filter((line) => line.length > 0));
}

/**
 * 单调断言：after 的脏路径集合必须是 before 的**子集** —— 只禁止门禁**新增**脏路径。
 *
 * 为什么是单调而非相等（请勿"修回"成相等）：全仓 `git status` 对任何**与本任务无关**的并发
 * 工作树变动都敏感。本仓库已有 vitest 抖动记录（docs/changes/vitest-parallel-flakiness-finding.md），
 * P2-A 不应引入新的抖动源：开发者机器、prepush 双 project 并发、乃至审查期间控制者提交别的
 * 文件，都会让"快照前脏、快照后被外部改干净"从而相等断言假红（真实发生过一次：审查独立复跑时
 * 控制者正在提交 `check-samples-coverage.ts` 的安全扫描修复）。单调口径保留真正要防的风险
 * （门禁不能把干净文件弄脏 / 不能"回退"已有脏项——后者为 after 新增了另一个路径也算新增），
 * 不要求 after 仍包含 before 里与本测试无关的脏项。门禁自身的可写面由 `paths` 的**相等**断言
 * （sha256 逐字节）覆盖，那才是本测试的核心证据，保持不变。
 */
function expectNoNewDirtyPaths(after: Set<string>, before: Set<string>, label: string): void {
  const added = [...after].filter((path) => !before.has(path));
  expect(added, `${label} 失败后不得新增脏路径（allowed: after ⊆ before）`).toEqual([]);
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
      // 快照非空守卫（一）：三个目标全缺失时各记一条 `<missing>`，故 `>0` 单独不足以证明快照有效。
      expect(Object.keys(before.paths).length, `${gateFile} 的快照不应为空`).toBeGreaterThan(0);
      // 快照非空守卫（二）：必须至少有一条**真实**路径条目（samples/ 整树必然在盘），
      // 使"快照失效到只剩 `<missing>` 占位"无法蒙混过关（前后相等会近似真空）。
      expect(
        Object.keys(before.paths).some((key) => key.startsWith('w-model-dev/scripts/samples/')),
        `${gateFile} 的快照必须含 samples/ 下的真实条目（防 <missing> 占位蒙混）`,
      ).toBe(true);

      const outcome = await runNegativeProbe(gateFile, probeRoot);
      const after = takeSnapshot();

      expect(
        outcome.status,
        `${gateFile} 的负向探针应 exit 2（stdout=${outcome.stdout.slice(0, 300)} stderr=${outcome.stderr.slice(0, 300)}）`,
      ).toBe(2);
      expect(after.paths, `${gateFile} 失败后仓库路径快照应逐字节不变`).toEqual(before.paths);
      // git 状态用**单调**口径（不新增脏路径），非相等；理由见 expectNoNewDirtyPaths() 的 JSDoc。
      expectNoNewDirtyPaths(
        porcelainDirtyPaths(after.gitStatus),
        porcelainDirtyPaths(before.gitStatus),
        `${gateFile} git status --porcelain`,
      );
      expectNoNewDirtyPaths(
        nameOnlyDirtyPaths(after.gitDiffNames),
        nameOnlyDirtyPaths(before.gitDiffNames),
        `${gateFile} git diff --name-only`,
      );
    }, 60_000);
  }
});
