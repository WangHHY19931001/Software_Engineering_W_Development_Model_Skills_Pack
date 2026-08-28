#!/usr/bin/env tsx
/**
 * 平台依赖可验证安装 CLI（cli/platform-deps-install.ts）
 *
 * 为 `.githooks` 的显式安全 `--install` 路径提供生产接线：把真实 I/O 注入 A2a 交付的
 * `verifyPlatformDependency` 核心，让「显式安装一个缺失的 platform 原生包」成为可验证的
 * 原子操作。只做 CLI + 测试；`.githooks/` 接线属于 A2b2。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/cli/platform-deps-install.ts \
 *     --lockfile=<package-lock.json 绝对路径> --package=<名字> [--package=<名字> ...] \
 *     [--tarball=<本地 tarball 路径> | --tarball=<名字>=<路径>] [--registry-host=<主机>]
 *
 * 对每个包：从 lockfile（v3）取 version/resolved/integrity → 获取确定 tarball 字节
 * （默认 `npm pack <name>@<version> --json` 隔离临时 cwd；`--tarball=<路径>` 注入本地字节，
 * 测试/离线用它避免网络）→ `verifyPlatformDependency` 校验（registry allowlist / SHA-512 SRI /
 * 归档路径与链接 / package.json 身份 / 隔离暂存 + 模块加载）→ 验证通过后受控安装到
 * `<repo>/node_modules/<name>`（staging 原子移动 + 冲突/失败恢复，失败不污染既有 node_modules）。
 *
 * 退出码：
 *   0  全部包验证并安装成功
 *   1  任一包验证/安装失败（stdout 结构化 ERROR_JSON + INSTALL_JSON 汇总，人类信息走 stderr）
 *   2  输入错误（缺 --lockfile / --package、非法值、tarball/lockfile 不可读）
 *
 * 仅使用 Node 标准库；不调用网络（除生产路径的 npm pack，由 --tarball 注入完全可离线替代）。
 *
 * 设计：docs/superpowers/ 任务 A2b1 brief；核心 `lib/platform-deps-installer.ts`。
 */

import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { exitWithError, HandledCliError } from '../lib/cli-error.js';
import {
  PlatformDependencyVerificationError,
  isUnsafeArchivePath,
  resolveLockfileV3Package,
  verifyPlatformDependency,
  type ArchiveEntry,
} from '../lib/platform-deps-installer.js';
import { extractArchive, readArchiveEntries } from '../lib/platform-deps-tar.js';
import { runMain } from '../lib/run-main.js';

const DEFAULT_REGISTRY_HOSTS: readonly string[] = ['registry.npmjs.org'];

/** 参数非法（→ 用法 + exit 2） */
export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

/** 受控安装失败（安装阶段，验证已通过） */
export class PlatformDepsInstallError extends Error {
  constructor(
    readonly code: 'install-conflict' | 'extract-failed',
    message: string,
  ) {
    super(message);
    this.name = 'PlatformDepsInstallError';
  }
}

interface TarballSpec {
  /** 显式包名（`--tarball=<名字>=<路径>`）；undefined 表示对未显式指定的包都生效的兜底 tarball */
  name?: string;
  path: string;
}

export type ParsedArgs =
  | { help: true }
  | {
      help: false;
      lockfile: string;
      packages: string[];
      tarballs: TarballSpec[];
      registryHosts: string[];
    };

const KNOWN_VALUE_FLAGS = new Set(['--lockfile', '--package', '--tarball', '--registry-host']);

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  if (args.length === 0) {
    throw new CliUsageError('缺少 --lockfile 与 --package');
  }

  let help = false;
  const lockfileValues: string[] = [];
  const packages: string[] = [];
  const tarballs: TarballSpec[] = [];
  const registryHosts: string[] = [];

  for (const arg of args) {
    if (arg === '--help') {
      help = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new CliUsageError(`非法参数：${arg}`);
    }
    const equal = arg.indexOf('=');
    if (equal < 0) {
      throw new CliUsageError(`参数缺少 = 取值：${arg}`);
    }
    const key = arg.slice(0, equal);
    const value = arg.slice(equal + 1);
    if (!KNOWN_VALUE_FLAGS.has(key)) {
      throw new CliUsageError(`未知参数：${arg}`);
    }
    if (value === '') {
      throw new CliUsageError(`参数值不能为空：${arg}`);
    }
    switch (key) {
      case '--lockfile':
        lockfileValues.push(value);
        break;
      case '--package':
        if (/\s/.test(value) || isUnsafeArchivePath(value)) {
          throw new CliUsageError(`非法包名：${value}`);
        }
        packages.push(value);
        break;
      case '--tarball': {
        const separator = value.indexOf('=');
        if (separator >= 0) {
          const name = value.slice(0, separator);
          const filePath = value.slice(separator + 1);
          if (name === '' || filePath === '') {
            throw new CliUsageError(`非法 --tarball 映射：${value}`);
          }
          tarballs.push({ name, path: filePath });
        } else {
          tarballs.push({ path: value });
        }
        break;
      }
      case '--registry-host':
        registryHosts.push(value);
        break;
      default:
        throw new CliUsageError(`未知参数：${arg}`);
    }
  }

  if (help) {
    return { help: true };
  }
  if (lockfileValues.length === 0) {
    throw new CliUsageError('缺少 --lockfile=<绝对路径>');
  }
  if (lockfileValues.length > 1) {
    throw new CliUsageError('--lockfile 只能指定一次');
  }
  const lockfile = lockfileValues[0] as string;
  if (!path.isAbsolute(lockfile)) {
    throw new CliUsageError('--lockfile 必须是绝对路径');
  }
  if (packages.length === 0) {
    throw new CliUsageError('缺少 --package=<名字>');
  }
  return {
    help: false,
    lockfile,
    packages,
    tarballs,
    registryHosts: registryHosts.length > 0 ? registryHosts : [...DEFAULT_REGISTRY_HOSTS],
  };
}

export function printUsage(): void {
  console.log(`用法：npx tsx w-model-dev/scripts/cli/platform-deps-install.ts --lockfile=<package-lock.json> --package=<名字> [选项]

选项：
  --lockfile=<绝对路径>     npm lockfile（v3）路径，必填，必须为绝对路径
  --package=<名字>          要安装的 platform 包（如 @esbuild/linux-x64），可重复
  --tarball=<路径>          直接使用本地 tarball 字节（离线/测试；默认走 npm pack）
  --tarball=<名字>=<路径>   按包名指定本地 tarball（可重复）
  --registry-host=<主机>    允许的 registry host（默认 registry.npmjs.org），可重复
  --help                    显示本用法

退出码：0=全部成功  1=有包验证/安装失败  2=输入错误`);
}

interface InstallIo {
  lockfile: Buffer;
  repoRoot: string;
  allowedRegistryHosts: readonly string[];
  readArchiveEntries: (archive: Buffer) => Promise<readonly ArchiveEntry[]>;
  extractArchive: (archive: Buffer, directory: string) => Promise<void>;
  createTemporaryDirectory: () => Promise<string>;
  removeTemporaryDirectory: (directory: string) => Promise<void>;
  loadModule: (packageRoot: string) => Promise<unknown>;
}

interface PackageOutcome {
  package: string;
  version?: string;
  ok: boolean;
  errorCode?: string;
  message?: string;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is assembled from the repository root and the lockfile/package-selected install name
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/** 可动态 import 的模块扩展名（.json/.node 等不在此列，见 loadModule 策略） */
const LOADABLE_MODULE_EXTS = new Set(['.js', '.mjs', '.cjs']);
/** 无 main/exports 声明时的 index fallback */
const INDEX_ENTRY_NAMES = ['index.js', 'index.mjs', 'index.cjs'] as const;

async function isFile(target: string): Promise<boolean> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is a package entry derived from verified package metadata inside isolated staging
    const stat = await fs.stat(target);
    return stat.isFile();
  } catch {
    return false;
  }
}

function isWithin(packageRoot: string, target: string): boolean {
  const rel = path.relative(packageRoot, target);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** 从 package.json 提取可加载入口候选（main / module / exports["."]） */
function manifestEntryCandidates(manifest: Record<string, unknown>): string[] {
  const out: string[] = [];
  if (typeof manifest.main === 'string') out.push(manifest.main);
  if (typeof manifest.module === 'string') out.push(manifest.module);
  const exportsValue = manifest.exports;
  if (typeof exportsValue === 'string') {
    out.push(exportsValue);
  } else if (typeof exportsValue === 'object' && exportsValue !== null && !Array.isArray(exportsValue)) {
    const dot = Object.getOwnPropertyDescriptor(exportsValue, '.')?.value;
    if (typeof dot === 'string') {
      out.push(dot);
    } else if (typeof dot === 'object' && dot !== null && !Array.isArray(dot)) {
      for (const value of [
        Object.getOwnPropertyDescriptor(dot, 'import')?.value,
        Object.getOwnPropertyDescriptor(dot, 'require')?.value,
        Object.getOwnPropertyDescriptor(dot, 'default')?.value,
      ]) {
        if (typeof value === 'string') out.push(value);
      }
    }
  }
  return out;
}

/**
 * 纯二进制 / .node binding 包的制品校验（弹性 loadModule 的降级分支）：
 * 核心已校验 package/package.json 身份与 lockfile 一致；此处确认落盘身份字段完整、
 * 声明的主要制品（bin / 非 JS 入口候选）确实落盘、且至少存在一个非 package.json 的
 * 制品文件（证明 platform 二进制/资产被提取）。满足即视为通过，不硬失败。
 * bin 声明额外校验可执行位（仅 POSIX 有意义；.githooks 运行在 Git Bash/WSL）。
 */
async function verifyPackageArtifacts(
  packageRoot: string,
  manifest: Record<string, unknown>,
  declaredArtifacts: readonly string[],
): Promise<void> {
  if (typeof manifest.name !== 'string' || manifest.name === '') {
    throw new Error('loadModule: 无 JS 入口的包缺少有效 name');
  }
  if (typeof manifest.version !== 'string' || manifest.version === '') {
    throw new Error('loadModule: 无 JS 入口的包缺少有效 version');
  }

  const binRelPaths: string[] = [];
  const bin = manifest.bin;
  if (typeof bin === 'string') {
    if (bin !== '') binRelPaths.push(bin);
  } else if (typeof bin === 'object' && bin !== null) {
    for (const value of Object.values(bin as Record<string, unknown>)) {
      if (typeof value === 'string' && value !== '') binRelPaths.push(value);
    }
  }

  const required: string[] = [...declaredArtifacts, ...binRelPaths];
  for (const rel of required) {
    const target = path.resolve(packageRoot, rel);
    // 逃逸出包目录的声明不校验（不做硬失败），只校验包内落盘
    if (isWithin(packageRoot, target) && !(await isFile(target))) {
      throw new Error(`loadModule: 声明的制品缺失：${rel}`);
    }
  }

  // bin 可执行位：POSIX 上有意义（提取时保留 tar 的 0755）；Windows chmod 语义不同，跳过
  if (process.platform !== 'win32') {
    for (const rel of binRelPaths) {
      const target = path.resolve(packageRoot, rel);
      if (!isWithin(packageRoot, target) || !(await isFile(target))) continue;
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is a package bin path derived from verified package metadata inside isolated staging
      const stat = await fs.stat(target);
      if ((stat.mode & 0o111) === 0) {
        throw new Error(`loadModule: bin 制品缺少可执行位：${rel}`);
      }
    }
  }

  if (!(await hasArtifactFile(packageRoot))) {
    throw new Error('loadModule: 纯二进制包未检出任何制品文件（缺少 platform 二进制/资产）');
  }
}

/**
 * 把声明的入口候选归类为「可加载 JS」或「制品」，并加固：
 * - 逃逸出包目录的候选一律忽略（不加载包外文件、不把包外路径计入制品）——保持
 *   「隔离验证只加载本包」不变量，与制品分支的 isWithin 阻挡对称；
 * - 无扩展名候选按 Node 解析语义做「补扩展名」isFile 探测（.js/.mjs/.cjs），命中即归为 JS；
 * - 其余（.node、.exe 等）归为制品。
 */
async function classifyDeclaredEntries(
  packageRoot: string,
  declaredCandidates: readonly string[],
): Promise<{ js: string[]; artifacts: string[] }> {
  const js: string[] = [];
  const artifacts: string[] = [];
  for (const candidate of declaredCandidates) {
    if (!isWithin(packageRoot, candidate)) continue;
    if (LOADABLE_MODULE_EXTS.has(path.extname(candidate))) {
      js.push(candidate);
    } else if (path.extname(candidate) === '') {
      // Node 解析语义：无扩展名入口做扩展名探测（extname('') === ''）
      let resolvedJs: string | undefined;
      for (const ext of ['.js', '.mjs', '.cjs'] as const) {
        const probed = `${candidate}${ext}`;
        if (await isFile(probed)) {
          resolvedJs = probed;
          break;
        }
      }
      if (resolvedJs !== undefined) js.push(resolvedJs);
      else artifacts.push(candidate);
    } else {
      artifacts.push(candidate);
    }
  }
  return { js, artifacts };
}

/** 递归探测包目录是否有非 package.json 的普通文件 */
async function hasArtifactFile(packageRoot: string): Promise<boolean> {
  const stack = [packageRoot];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- current is reached only by descending from the verified isolated package root
    const names = await fs.readdir(current).catch(() => [] as string[]);
    for (const name of names) {
      const full = path.join(current, name);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- full is a child of the verified isolated package root while walking extracted package artifacts
      const stat = await fs.stat(full).catch(() => undefined);
      if (stat === undefined) continue;
      if (stat.isDirectory()) {
        stack.push(full);
      } else if (stat.isFile() && !(current === packageRoot && name === 'package.json')) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 弹性加载已提取包的入口模块（CLI 侧注入策略，不改 A2a 核心）。
 * 动态 import(<dir>/package) 的实际可运行等价：
 * 1. 包声明了可加载 JS 入口（main / module / exports["."]，含无扩展名补 .js/.mjs/.cjs 探测）
 *    → 动态 import 验证其可加载；声明了 JS 入口但文件缺失视为损坏包（硬失败）。
 *    JS 入口候选一律先经 isWithin 守卫，逃逸包目录的声明被忽略（隔离验证只加载本包）。
 * 2. 无 JS 入口时回退 index.js/index.mjs/index.cjs fallback → 动态 import。
 * 3. 仍无 JS 入口（纯二进制 / .node binding，如 @esbuild/linux-x64、@rolldown/binding-*）
 *    → 降级为「制品校验」：身份字段 + 声明 bin/制品落盘 + 至少一个制品文件；bin 在
 *    POSIX 上校验可执行位（提取保留 tar mode）。满足视为通过，不因 MODULE_NOT_FOUND /
 *    ERR_UNKNOWN_FILE_EXTENSION 硬失败。
 */
async function loadModule(packageRoot: string): Promise<unknown> {
  let manifest: Record<string, unknown>;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- packageRoot is the isolated staging root produced after lockfile/package/archive validation
    const raw = await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('package/package.json 必须是 JSON 对象');
    }
    manifest = parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `loadModule: 无法读取已提取包的 package.json：${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const declaredCandidates = manifestEntryCandidates(manifest).map((candidate) => path.resolve(packageRoot, candidate));
  const classified = await classifyDeclaredEntries(packageRoot, declaredCandidates);

  for (const candidate of classified.js) {
    if (await isFile(candidate)) {
      return import(pathToFileURL(candidate).href);
    }
  }
  if (classified.js.length > 0) {
    throw new Error(
      `loadModule: 包声明了 JS 入口（${classified.js.map((entry) => path.basename(entry)).join(', ')}）但文件缺失`,
    );
  }

  for (const indexName of INDEX_ENTRY_NAMES) {
    const candidate = path.join(packageRoot, indexName);
    if (await isFile(candidate)) {
      return import(pathToFileURL(candidate).href);
    }
  }

  await verifyPackageArtifacts(packageRoot, manifest, classified.artifacts);
  return { __artifactVerified: true, packageName: manifest.name, version: manifest.version };
}

/** 读取已存在安装目录的 identity；非本包目录（无/坏 package.json）返回 null */
async function readInstalledIdentity(target: string): Promise<{ name?: unknown; version?: unknown } | null> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is the existing install selected by the lockfile package and checked before replacement
    const raw = await fs.readFile(path.join(target, 'package.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as { name?: unknown; version?: unknown })
      : null;
  } catch {
    return null;
  }
}

export interface InstallVerifiedPackageInput {
  archive: Buffer;
  repoRoot: string;
  packageName: string;
  version: string;
  extractArchive: (archive: Buffer, directory: string) => Promise<void>;
  removeTemporaryDirectory: (directory: string) => Promise<void>;
}

/**
 * 受控安装：把已验证安全的暂存 `package/` 原子移动到 `<repo>/node_modules/<name>`。
 * - staging 建在 repo 根同卷（保证 rename 原子、无跨设备），finally 必清理。
 * - 目标已存在且非本包 → install-conflict 失败，不动 node_modules。
 * - 目标已存在且是本包 → 移旧到备份、移新到位；最终移动失败则还原备份；成功后删备份。
 * - 非本包冲突绝不覆盖；若旧包恢复本身失败，保留备份并报告两个失败。返回安装目标路径。
 */
export async function installVerifiedPackage(input: InstallVerifiedPackageInput): Promise<string> {
  const nodeModulesRoot = path.join(input.repoRoot, 'node_modules');
  const target = path.join(nodeModulesRoot, input.packageName);
  const staging = await fs.mkdtemp(path.join(input.repoRoot, '.platform-deps-staging-'));
  let backup: string | undefined;
  try {
    await input.extractArchive(input.archive, staging);
    const stagedPackageRoot = path.join(staging, 'package');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- target parent is derived from the lockfile-selected repository root and validated package name
    await fs.mkdir(path.dirname(target), { recursive: true });

    if (await pathExists(target)) {
      const identity = await readInstalledIdentity(target);
      if (identity === null || identity.name !== input.packageName || identity.version !== input.version) {
        throw new PlatformDepsInstallError(
          'install-conflict',
          `node_modules/${input.packageName} 已存在且不是 ${input.packageName}@${input.version}`,
        );
      }
      backup = `${target}.wm-backup-${randomUUID()}`;
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- both paths are derived from the lockfile-selected package target and unique staging token
      await fs.rename(target, backup);
    }

    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- stagedPackageRoot is the validated package directory under isolated staging and target is lockfile/package-derived
      await fs.rename(stagedPackageRoot, target);
    } catch (error) {
      if (backup !== undefined) {
        try {
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- backup and target are lockfile/package-derived paths within the repository root
          await fs.rename(backup, target);
        } catch (restoreError) {
          const commitMessage = error instanceof Error ? error.message : String(error);
          const restoreMessage = restoreError instanceof Error ? restoreError.message : String(restoreError);
          throw new Error(
            `安装 staging 提交失败：${commitMessage}；既有包恢复失败，备份保留在 ${backup}：${restoreMessage}`,
          );
        }
      }
      throw error;
    }

    if (backup !== undefined) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- backup is a unique path derived from the lockfile/package-selected target
      await fs.rm(backup, { recursive: true, force: true });
    }
    return target;
  } catch (error) {
    if (error instanceof PlatformDepsInstallError) throw error;
    throw new PlatformDepsInstallError('extract-failed', error instanceof Error ? error.message : String(error));
  } finally {
    await input.removeTemporaryDirectory(staging);
  }
}

/** 获取某包的确定 tarball 字节：优先 --tarball 注入；否则 npm pack（生产网络路径） */
async function resolveArchiveBytes(
  io: InstallIo,
  packageName: string,
  explicitTarball: ReadonlyMap<string, Buffer>,
  fallbackTarball: Buffer | undefined,
): Promise<Buffer> {
  const injected = explicitTarball.get(packageName) ?? fallbackTarball;
  if (injected !== undefined) return injected;

  const locked = resolveLockfileV3Package(io.lockfile, packageName);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- staging prefix is fixed under the OS temporary directory and npm pack runs only inside it
  const packDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-npm-pack-'));
  try {
    const execFileAsync = promisify(execFile) as (
      file: string,
      args: readonly string[],
      options: { cwd: string; timeout: number; maxBuffer: number },
    ) => Promise<{ stdout: string; stderr: string }>;
    // eslint-disable-next-line security/detect-child-process -- npm pack 在隔离临时 cwd 内受控执行
    const { stdout } = await execFileAsync('npm', ['pack', `${packageName}@${locked.version}`, '--json'], {
      cwd: packDir,
      timeout: 300000,
      maxBuffer: 64 * 1024 * 1024,
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch (error) {
      throw new Error(error instanceof Error ? `npm pack 未输出 JSON：${error.message}` : 'npm pack 未输出 JSON');
    }
    const list = Array.isArray(parsed) ? parsed : [];
    const first = list[0] as { filename?: unknown } | undefined;
    const filename = typeof first?.filename === 'string' ? first.filename : undefined;
    if (filename === undefined || path.basename(filename) !== filename || filename.includes('\0')) {
      throw new Error('npm pack 返回了不安全 tarball 文件名');
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- filename is returned by npm pack and constrained to a basename beneath its isolated staging directory
    return await fs.readFile(path.join(packDir, filename));
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message.startsWith('npm pack')
        ? error.message
        : `npm pack 失败：${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- packDir is the fixed-prefix isolated staging directory created above
    await fs.rm(packDir, { recursive: true, force: true });
  }
}

/** 单包完整管线：取字节 → 核心验证 → 受控安装；失败记录结构化错误并继续剩余包 */
async function runOne(
  io: InstallIo,
  packageName: string,
  explicitTarball: ReadonlyMap<string, Buffer>,
  fallbackTarball: Buffer | undefined,
): Promise<PackageOutcome> {
  try {
    const archive = await resolveArchiveBytes(io, packageName, explicitTarball, fallbackTarball);
    const verified = await verifyPlatformDependency({
      lockfile: io.lockfile,
      packageName,
      allowedRegistryHosts: io.allowedRegistryHosts,
      archive,
      readArchiveEntries: io.readArchiveEntries,
      extractArchive: io.extractArchive,
      createTemporaryDirectory: io.createTemporaryDirectory,
      removeTemporaryDirectory: io.removeTemporaryDirectory,
      loadModule: io.loadModule,
    });
    const target = await installVerifiedPackage({
      archive,
      repoRoot: io.repoRoot,
      packageName,
      version: verified.locked.version,
      extractArchive: io.extractArchive,
      removeTemporaryDirectory: io.removeTemporaryDirectory,
    });
    console.log(`ok ${packageName}@${verified.locked.version} → ${target}`);
    return { package: packageName, version: verified.locked.version, ok: true };
  } catch (error) {
    const code =
      error instanceof PlatformDependencyVerificationError
        ? error.code
        : error instanceof PlatformDepsInstallError
          ? error.code
          : 'install-error';
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ [${packageName}] ${code}: ${message}`);
    console.log(`ERROR_JSON ${JSON.stringify({ packageName, errorCode: code, message, exitCode: 1 })}`);
    return { package: packageName, ok: false, errorCode: code, message };
  }
}

export async function main(): Promise<void> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(process.argv);
  } catch (error) {
    if (error instanceof CliUsageError) {
      printUsage();
      exitWithError({ category: 'ARG_INVALID', rule: 'P0-1', message: error.message, exitCode: 2 });
      throw new HandledCliError();
    }
    throw error;
  }
  if (parsed.help) {
    printUsage();
    return;
  }

  const explicitTarball = new Map<string, Buffer>();
  let fallbackTarball: Buffer | undefined;
  try {
    for (const spec of parsed.tarballs) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- spec.path is an explicit user-selected offline tarball input, read only as the requested source artifact
      const data = await fs.readFile(spec.path);
      if (spec.name !== undefined) {
        explicitTarball.set(spec.name, data);
      } else {
        fallbackTarball = data;
      }
    }
  } catch (error) {
    const e = error as NodeJS.ErrnoException;
    exitWithError({
      category: e.code === 'ENOENT' ? 'FILE_NOT_FOUND' : 'FILE_READ',
      message: '读取 --tarball 失败',
      file: e.path,
      detail: error instanceof Error ? error.message : String(error),
      exitCode: 2,
    });
    throw new HandledCliError();
  }

  let lockfile: Buffer;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- parsed.lockfile is required to be an absolute caller-selected lockfile path and is read as the package source of truth
    lockfile = await fs.readFile(parsed.lockfile);
  } catch (error) {
    const e = error as NodeJS.ErrnoException;
    exitWithError({
      category: e.code === 'ENOENT' ? 'FILE_NOT_FOUND' : 'FILE_READ',
      message: '读取 lockfile 失败',
      file: parsed.lockfile,
      detail: e.code ?? String(error),
      exitCode: 2,
    });
    throw new HandledCliError();
  }

  const io: InstallIo = {
    lockfile,
    repoRoot: path.dirname(parsed.lockfile),
    allowedRegistryHosts: parsed.registryHosts,
    readArchiveEntries,
    extractArchive,
    createTemporaryDirectory: async () => fs.mkdtemp(path.join(os.tmpdir(), 'wm-platform-deps-')),
    removeTemporaryDirectory: async (directory) => {
      await fs.rm(directory, { recursive: true, force: true });
    },
    loadModule,
  };

  const outcomes: PackageOutcome[] = [];
  for (const packageName of parsed.packages) {
    outcomes.push(await runOne(io, packageName, explicitTarball, fallbackTarball));
  }

  const failed = outcomes.filter((outcome) => !outcome.ok).length;
  console.log(
    `INSTALL_JSON ${JSON.stringify({
      packages: outcomes,
      passed: outcomes.length - failed,
      failed,
      exitCode: failed > 0 ? 1 : 0,
    })}`,
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
}

// 直接执行（`npx tsx .../platform-deps-install.ts`）时才跑 main；被测试 import 时不触发。
if (process.argv[1] !== undefined && process.argv[1].endsWith('platform-deps-install.ts')) {
  runMain(main);
}
