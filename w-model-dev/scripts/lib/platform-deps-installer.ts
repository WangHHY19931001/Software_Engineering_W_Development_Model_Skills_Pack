import { createHash } from "node:crypto";
import * as path from "node:path";

export interface ArchiveEntry {
  path: string;
  type: "file" | "directory" | "symlink" | "hardlink" | string;
  content?: string | Buffer;
  linkname?: string;
}

export interface LockedPackage {
  name: string;
  version: string;
  resolved: string;
  integrity: string;
}

export interface PlatformDependencyVerificationResult {
  locked: LockedPackage;
  loadedModule: unknown;
}

export interface PlatformDependencyVerificationOptions {
  lockfile: string | Buffer;
  packageName: string;
  allowedRegistryHosts: readonly string[];
  archive: Buffer;
  readArchiveEntries: (archive: Buffer) => Promise<readonly ArchiveEntry[]>;
  extractArchive: (archive: Buffer, directory: string) => Promise<void>;
  createTemporaryDirectory: () => Promise<string>;
  removeTemporaryDirectory: (directory: string) => Promise<void>;
  loadModule: (packageRoot: string) => Promise<unknown>;
}

export class PlatformDependencyVerificationError extends Error {
  constructor(
    readonly code:
      | "lockfile-json"
      | "lockfile-version"
      | "lockfile-package"
      | "registry-protocol"
      | "registry-host"
      | "integrity"
      | "archive-path"
      | "archive-link"
      | "package-json"
      | "package-name"
      | "package-version",
    message: string,
  ) {
    super(message);
    this.name = "PlatformDependencyVerificationError";
  }
}

type LockfileV3 = {
  lockfileVersion?: unknown;
  packages?: Record<string, unknown>;
};

type LockfilePackage = {
  version?: unknown;
  resolved?: unknown;
  integrity?: unknown;
};

type PackageManifest = {
  name?: unknown;
  version?: unknown;
};

function fail(
  code: PlatformDependencyVerificationError["code"],
  message: string,
): never {
  throw new PlatformDependencyVerificationError(code, message);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseLockfile(lockfile: string | Buffer): LockfileV3 {
  try {
    const parsed: unknown = JSON.parse(lockfile.toString());
    const record = asRecord(parsed);
    if (!record) {
      fail("lockfile-json", "npm lockfile 必须是 JSON 对象");
    }
    return record;
  } catch (error: unknown) {
    if (error instanceof PlatformDependencyVerificationError) {
      throw error;
    }
    fail("lockfile-json", "npm lockfile 不是有效 JSON");
  }
}

export function resolveLockfileV3Package(
  lockfile: string | Buffer,
  packageName: string,
): LockedPackage {
  const parsed = parseLockfile(lockfile);
  if (parsed.lockfileVersion !== 3) {
    fail("lockfile-version", "仅接受 npm lockfileVersion 3");
  }

  const packageEntry = asRecord(
    parsed.packages?.[`node_modules/${packageName}`],
  ) as LockfilePackage | undefined;
  if (
    !packageEntry ||
    typeof packageEntry.version !== "string" ||
    typeof packageEntry.resolved !== "string" ||
    typeof packageEntry.integrity !== "string"
  ) {
    fail(
      "lockfile-package",
      `lockfile 未提供 ${packageName} 的 version/resolved/integrity`,
    );
  }

  return {
    name: packageName,
    version: packageEntry.version,
    resolved: packageEntry.resolved,
    integrity: packageEntry.integrity,
  };
}

function validateResolvedUrl(
  resolved: string,
  allowedRegistryHosts: readonly string[],
): void {
  let url: URL;
  try {
    url = new URL(resolved);
  } catch {
    fail("registry-protocol", "lockfile resolved 必须是绝对 HTTPS URL");
  }

  if (url.protocol !== "https:") {
    fail("registry-protocol", "lockfile resolved 必须使用 HTTPS");
  }
  if (!allowedRegistryHosts.includes(url.hostname)) {
    fail("registry-host", `registry host 未在 allowlist 中：${url.hostname}`);
  }
}

function validateSha512Integrity(archive: Buffer, integrity: string): void {
  const match = /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(integrity);
  if (!match || !match[1]) {
    fail("integrity", "lockfile integrity 必须是 SHA-512 SRI");
  }

  const expected = Buffer.from(match[1], "base64");
  if (expected.length !== 64 || expected.toString("base64") !== match[1]) {
    fail("integrity", "lockfile integrity 必须是规范 SHA-512 SRI");
  }

  const actual = createHash("sha512").update(archive).digest();
  if (!actual.equals(expected)) {
    fail("integrity", "下载 archive 的 SHA-512 不匹配 lockfile integrity");
  }
}

function isUnsafeArchivePath(entryPath: string): boolean {
  if (
    !entryPath ||
    entryPath.includes("\0") ||
    path.posix.isAbsolute(entryPath) ||
    path.win32.isAbsolute(entryPath)
  ) {
    return true;
  }

  const normalized = entryPath.replaceAll("\\", "/").replace(/\/$/, "");
  return normalized
    .split("/")
    .some((segment) => segment === ".." || segment === "");
}

function validateArchiveEntries(entries: readonly ArchiveEntry[]): void {
  for (const entry of entries) {
    if (isUnsafeArchivePath(entry.path)) {
      fail("archive-path", `archive 包含不安全路径：${entry.path}`);
    }
    if (
      entry.type === "symlink" ||
      entry.type === "hardlink" ||
      entry.linkname !== undefined
    ) {
      fail("archive-link", `archive 包含链接条目：${entry.path}`);
    }
  }
}

function readPackageManifest(
  entries: readonly ArchiveEntry[],
): PackageManifest {
  const packageJson = entries.find(
    (entry) => entry.path === "package/package.json" && entry.type === "file",
  );
  if (!packageJson || packageJson.content === undefined) {
    fail("package-json", "archive 缺少 package/package.json");
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.isBuffer(packageJson.content)
        ? packageJson.content.toString("utf8")
        : packageJson.content,
    );
    const manifest = asRecord(parsed);
    if (!manifest) {
      fail("package-json", "package/package.json 必须是 JSON 对象");
    }
    return manifest;
  } catch (error: unknown) {
    if (error instanceof PlatformDependencyVerificationError) {
      throw error;
    }
    fail("package-json", "package/package.json 不是有效 JSON");
  }
}

function validatePackageManifest(
  manifest: PackageManifest,
  locked: LockedPackage,
): void {
  if (manifest.name !== locked.name) {
    fail("package-name", `package/package.json name 与 ${locked.name} 不一致`);
  }
  if (manifest.version !== locked.version) {
    fail(
      "package-version",
      `package/package.json version 与 ${locked.version} 不一致`,
    );
  }
}

export async function verifyPlatformDependency(
  options: PlatformDependencyVerificationOptions,
): Promise<PlatformDependencyVerificationResult> {
  const locked = resolveLockfileV3Package(
    options.lockfile,
    options.packageName,
  );
  validateResolvedUrl(locked.resolved, options.allowedRegistryHosts);
  validateSha512Integrity(options.archive, locked.integrity);

  const entries = await options.readArchiveEntries(options.archive);
  validateArchiveEntries(entries);
  validatePackageManifest(readPackageManifest(entries), locked);

  const temporaryDirectory = await options.createTemporaryDirectory();
  try {
    await options.extractArchive(options.archive, temporaryDirectory);
    const loadedModule = await options.loadModule(
      path.join(temporaryDirectory, "package"),
    );
    return { locked, loadedModule };
  } finally {
    await options.removeTemporaryDirectory(temporaryDirectory);
  }
}
