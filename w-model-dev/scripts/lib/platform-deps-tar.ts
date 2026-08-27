/**
 * 自包含 npm tarball 读取/写出（lib/platform-deps-tar.ts）
 *
 * 为生产接线 CLI（cli/platform-deps-install.ts）给 verifyPlatformDependency 注入的真实
 * tar I/O：
 *   - readArchiveEntries：gunzip（node:zlib）+ UStar header 解析；支持 pax 扩展头
 *     （typeflag 'x'/'g'）与 GNU long name / long link（'L'/'K'），长名解析后仍是原路径、
 *     不引入穿越（解析结果忠实交给核心校验，穿越/链接由核心在解包前拒绝）。
 *   - extractArchive：把同一批条目按 package/... 写盘。链接条目在核心已拒绝的前提下
 *     兜底拒绝（不写符号/硬链接）。
 *
 * 无网络、无 npm、无 tar 命令——只依赖 Node 标准库（node:fs/promises / node:path /
 * node:zlib）。仅供上述 CLI 与该 CLI 的测试消费，不参与 /wm 编排。
 */

import { constants as fsConstants, promises as fs, type BigIntStats } from 'node:fs';
import * as path from 'node:path';
import { gunzipSync } from 'node:zlib';

import { isUnsafeArchivePath } from './platform-deps-installer.js';
import type { ArchiveEntry } from './platform-deps-installer.js';

/** 解析出的归档条目：ArchiveEntry + UStar mode（八进制，file/directory 条目携带） */
export type TarArchiveEntry = ArchiveEntry & { mode?: number; rawPath?: string };

const BLOCK_SIZE = 512;

/** Buffer 的边界受检查字节读取，避免把外部归档偏移直接作为对象属性。 */
function readByte(buffer: Buffer, offset: number, fallback = 0): number {
  return offset >= 0 && offset < buffer.length ? buffer.readUInt8(offset) : fallback;
}

/** 读取 UStar 数值字段：octal（NUL/空格结尾）或 GNU base-256（首字节高位置位） */
function readSizeField(buffer: Buffer, offset: number, length: number): number {
  const first = readByte(buffer, offset);
  if ((first & 0x80) !== 0) {
    let value = 0;
    for (let i = 0; i < length; i += 1) {
      const byte = readByte(buffer, offset + i);
      value = value * 256 + (i === 0 ? byte & 0x7f : byte);
    }
    return value;
  }
  let raw = buffer.toString('latin1', offset, offset + length);
  const terminator = raw.search(/[\0 ]/);
  if (terminator >= 0) raw = raw.slice(0, terminator);
  raw = raw.trim();
  if (raw === '') return 0;
  const parsed = Number.parseInt(raw, 8);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 读取 UStar 字符串字段：NUL 结尾，去掉拖尾空格 */
function readStrField(buffer: Buffer, offset: number, length: number): string {
  let raw = buffer.toString('utf8', offset, offset + length);
  const nul = raw.indexOf('\0');
  if (nul >= 0) raw = raw.slice(0, nul);
  return raw.replace(/ +$/, '');
}

/** 读取 UStar mode 字段（offset 100，八进制，如 '0000755'） */
function readModeField(header: Buffer): number {
  return readSizeField(header, 100, 8);
}

/** 组合 UStar prefix(155) + name(100) 为完整 tar 路径 */
function decodeName(header: Buffer): string {
  const name = readStrField(header, 0, 100);
  const prefix = readStrField(header, 345, 155);
  return prefix === '' ? name : `${prefix}/${name}`;
}

/** GNU 'L'/'K' 元头载荷字符串（去尾 NUL/换行） */
function decodeMetaString(data: Buffer): string {
  return data.toString('utf8').replace(/[\0\n\r]+$/, '');
}

/** 解析 pax 记录 blob：`<len> <key>=<value>\n`，len 含整条记录含换行 */
export function parsePaxRecords(blob: string | Buffer): Map<string, string> {
  const source = Buffer.isBuffer(blob) ? blob : Buffer.from(blob, 'utf8');
  const records = new Map<string, string>();
  let cursor = 0;
  while (cursor < source.length) {
    const space = source.indexOf(0x20, cursor);
    if (space < 0) break;
    const length = Number.parseInt(source.subarray(cursor, space).toString('ascii'), 10);
    if (!Number.isSafeInteger(length) || length <= 0 || cursor + length > source.length) break;
    const recordStart = cursor;
    const record = source.subarray(recordStart, recordStart + length);
    const equal = record.indexOf(0x3d);
    const keyOffset = space - recordStart + 1;
    cursor += length;
    if (equal < keyOffset) continue;
    const key = record.subarray(keyOffset, equal).toString('utf8');
    let value = record.subarray(equal + 1);
    if (value[value.length - 1] === 0x0a) value = value.subarray(0, value.length - 1);
    if (key !== '') records.set(key, value.toString('utf8'));
  }
  return records;
}

/**
 * 自包含解析 npm tarball 归档（gzip 压缩后）：
 *   常规文件/目录、symlink/hardlink、pax 'x'/'g'、GNU long name/long link。
 * 长名解析后仍是原路径——解析结果忠实交给核心校验，不在此处引入穿越。
 */
function parseArchive(archive: Buffer): TarArchiveEntry[] {
  const entries: TarArchiveEntry[] = [];
  let offset = 0;
  let gnuLongName: string | undefined;
  let gnuLongLink: string | undefined;
  const globalPaxRecords = new Map<string, string>();
  let localPaxRecords = new Map<string, string>();
  let paxPending = false;

  while (offset + BLOCK_SIZE <= archive.length) {
    const header = archive.subarray(offset, offset + BLOCK_SIZE);
    if (header.every((byte) => byte === 0)) break;

    const typeflag = String.fromCharCode(header[156] ?? 0x30);
    const size = readSizeField(header, 124, 12);
    const dataStart = offset + BLOCK_SIZE;
    if (size < 0 || dataStart + size > archive.length) {
      throw new Error(`tar 数据块越界：条目 size=${size} 超出归档`);
    }
    const data = archive.subarray(dataStart, dataStart + size);
    const nextOffset = dataStart + Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;

    if (typeflag === 'x' || typeflag === 'g') {
      const parsed = parsePaxRecords(data);
      if (typeflag === 'g') {
        for (const [key, value] of parsed) globalPaxRecords.set(key, value);
      } else {
        localPaxRecords = parsed;
        paxPending = true;
      }
      offset = nextOffset;
      continue;
    }
    if (typeflag === 'L') {
      gnuLongName = decodeMetaString(data);
      offset = nextOffset;
      continue;
    }
    if (typeflag === 'K') {
      gnuLongLink = decodeMetaString(data);
      offset = nextOffset;
      continue;
    }

    const headerName = decodeName(header);
    const effectivePax = new Map(globalPaxRecords);
    if (paxPending) {
      for (const [key, value] of localPaxRecords) effectivePax.set(key, value);
    }
    const rawPath = effectivePax.get('path') ?? gnuLongName ?? headerName;
    const entryPath = rawPath.replace(/\/+$/, '');
    // UStar mode（八进制）——提取时用于保留可执行位（真实 platform 包 bin 为 0755）
    const mode = readModeField(header);
    let linkname: string | undefined;
    if (effectivePax.get('linkpath') !== undefined) {
      linkname = effectivePax.get('linkpath');
    } else if (gnuLongLink !== undefined) {
      linkname = gnuLongLink;
    } else {
      const rawLink = readStrField(header, 157, 100);
      linkname = rawLink === '' ? undefined : rawLink;
    }

    switch (typeflag) {
      case '0':
      case '\0':
      case '7':
        entries.push({ path: entryPath, rawPath, type: 'file', content: Buffer.from(data), mode, linkname });
        break;
      case '5':
        entries.push({ path: entryPath, rawPath, type: 'directory', mode, linkname });
        break;
      case '1':
        entries.push({ path: entryPath, rawPath, type: 'hardlink', linkname });
        break;
      case '2':
        entries.push({ path: entryPath, rawPath, type: 'symlink', linkname });
        break;
      default:
        // 未知类型按普通文件保留数据（npm tarball 不含设备/管道节点）
        entries.push({ path: entryPath, rawPath, type: 'file', content: Buffer.from(data), mode, linkname });
        break;
    }

    gnuLongName = undefined;
    gnuLongLink = undefined;
    paxPending = false;
    localPaxRecords = new Map<string, string>();
    offset = nextOffset;
  }
  return entries;
}

/** 解压并解析归档条目（供 verifyPlatformDependency 注入）；条目含 UStar mode */
export async function readArchiveEntries(archive: Buffer): Promise<readonly TarArchiveEntry[]> {
  return parseArchive(gunzipSync(archive));
}

/**
 * Return whether a lexical target remains strictly below the extraction root.
 * `path.resolve` alone is not sufficient: `../` must be rejected before any filesystem I/O.
 */
function isWithinExtractionRoot(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/** Reject symlink components in the caller-selected root and every target ancestor. */
async function assertNoSymlinkAncestors(target: string): Promise<void> {
  const ancestors: string[] = [];
  let current = path.resolve(target);
  for (;;) {
    ancestors.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  for (const ancestor of ancestors) {
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- ancestor is derived from the validated extraction root/entry path and is checked before each extraction filesystem operation
      const stat = await fs.lstat(ancestor);
      if (stat.isSymbolicLink()) {
        throw new Error(`extractArchive 拒绝符号链接 ancestor：${ancestor}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('拒绝符号链接 ancestor')) throw error;
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw error;
    }
  }
}

/**
 * Create one safe directory hierarchy and return its pinned real path.
 * Each next operation uses the real path returned by the previous component, so a
 * component replaced by a junction/symlink after lstat cannot redirect a later mkdir.
 */
async function ensureSafeDirectory(
  root: string,
  target: string,
  mode?: number,
  boundaryRoot?: string,
): Promise<string> {
  if (target !== root && !isWithinExtractionRoot(root, target)) {
    throw new Error(`extractArchive 拒绝 extraction root 外路径：${target}`);
  }
  let canonicalRoot: string;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- root is the caller-selected filesystem root and is checked before use
    canonicalRoot = await fs.realpath(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    // The caller-selected root may not exist yet; its parent is created and pinned by
    // the caller before this helper is used for the extraction workspace.
    const parent = path.dirname(root);
    const parentReal = await ensureSafeDirectory(path.parse(parent).root, parent, undefined, boundaryRoot);
    const rootName = path.basename(root);
    const rootPath = path.join(parentReal, rootName);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- rootPath is derived from the pinned caller-selected parent
    await fs.mkdir(rootPath);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- rootPath is the newly created caller-selected root
    canonicalRoot = await fs.realpath(rootPath);
  }
  const relative = path.relative(root, target);
  let current = canonicalRoot;
  for (const segment of relative === '' ? [] : relative.split(path.sep)) {
    const next = path.join(current, segment);
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- next is derived from a validated archive path and the pinned real parent
      const existing = await fs.lstat(next, { bigint: true });
      if (existing.isSymbolicLink()) {
        throw new Error(`extractArchive 拒绝符号链接 directory：${next}`);
      }
      if (!existing.isDirectory()) {
        throw new Error(`extractArchive 拒绝目录位置上的非目录条目：${next}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      // The archive mode belongs to the directory entry being created, not to
      // intermediate ancestors that merely happen to be missing.
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- next is derived from a validated archive path and the pinned real parent
      await fs.mkdir(next, { mode: 0o777 });
    }
    if (mode !== undefined && segment === relative.split(path.sep).at(-1)) {
      await chmodEntrySafely(next, mode, 'directory');
    }
    // Pin the real directory before constructing the next path or opening a file.
    // If a raced replacement redirects it outside canonicalRoot, fail before writing.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- next is the newly created or lstat-validated directory below the pinned extraction root
    const resolved = await fs.realpath(next);
    if (!isWithinExtractionRoot(canonicalRoot, resolved) && resolved !== canonicalRoot) {
      throw new Error(`extractArchive 拒绝 directory 逃逸 extraction root：${next}`);
    }
    if (boundaryRoot !== undefined && !isWithinExtractionRoot(boundaryRoot, resolved)) {
      throw new Error(`extractArchive 拒绝 directory 逃逸 pinned root：${next}`);
    }
    current = resolved;
  }
  return current;
}

async function chmodEntrySafely(target: string, mode: number, kind: 'file' | 'directory'): Promise<void> {
  // Modes are applied only to the entry itself. Verify the object again after
  // chmod so a replacement is never treated as success.
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is a validated entry below the private extraction workspace
  const before = await fs.lstat(target, { bigint: true });
  const valid = kind === 'directory' ? before.isDirectory() : before.isFile();
  if (before.isSymbolicLink() || !valid || !hasUsableFileIdentity(before)) {
    throw new Error(`extractArchive 拒绝设置${kind === 'directory' ? '目录' : '文件'} mode：${target}`);
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is the identity-checked entry created below the private extraction workspace
  await fs.chmod(target, mode);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- target remains the identity-checked private entry
  const after = await fs.lstat(target, { bigint: true });
  const remainsValid = kind === 'directory' ? after.isDirectory() : after.isFile();
  if (after.isSymbolicLink() || !remainsValid || !hasSameFileIdentity(before, after)) {
    throw new Error(`extractArchive 拒绝设置 mode 后身份变化：${target}`);
  }
}

function normalizeArchivePath(rawPath: string): string {
  return rawPath.replaceAll('\\', '/').replace(/\/+$/, '');
}

function canonicalArchivePath(rawPath: string): string {
  const normalized = normalizeArchivePath(rawPath);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function validateCanonicalPaths(
  entries: readonly TarArchiveEntry[],
): Array<{ entry: TarArchiveEntry; archivePath: string; canonicalPath: string }> {
  const seen = new Set<string>();
  const planned = entries.map((entry) => {
    const archivePath = entry.rawPath ?? entry.path;
    if (isUnsafeArchivePath(archivePath)) {
      throw new Error(`extractArchive 拒绝不安全路径：${archivePath}`);
    }
    if (entry.type === 'symlink' || entry.type === 'hardlink' || entry.linkname !== undefined) {
      throw new Error(`extractArchive 拒绝链接条目：${entry.path}`);
    }
    const normalizedPath = normalizeArchivePath(archivePath);
    const canonicalPath = canonicalArchivePath(archivePath);
    if (canonicalPath === '') {
      throw new Error(`extractArchive 拒绝空路径：${archivePath}`);
    }
    if (seen.has(canonicalPath)) {
      throw new Error(`extractArchive 拒绝重复 canonical path：${archivePath}`);
    }
    seen.add(canonicalPath);
    return { entry, archivePath: normalizedPath, canonicalPath };
  });

  let previous: (typeof planned)[number] | undefined;
  for (const current of [...planned].sort((left, right) => left.canonicalPath.localeCompare(right.canonicalPath))) {
    if (
      previous !== undefined &&
      previous.entry.type === 'file' &&
      current.canonicalPath.startsWith(`${previous.canonicalPath}/`)
    ) {
      throw new Error(`extractArchive 拒绝文件/目录路径冲突：${previous.archivePath} 与 ${current.archivePath}`);
    }
    previous = current;
  }
  return planned;
}

/** Return an existing path's lstat, or undefined when the path is absent. */
async function lstatIfPresent(target: string): Promise<Awaited<ReturnType<typeof fs.lstat>> | undefined> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is derived from the caller-selected extraction root and validated archive top-level path
    return await fs.lstat(target, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function removeExtractionWorkspace(
  workspace: string,
  expectedIdentity: FileIdentityStats,
  boundaryRoot: string,
): Promise<void> {
  try {
    await assertPathInside(boundaryRoot, workspace, 'workspace');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- workspace is an exclusive mkdtemp directory owned by this extraction call
    const current = await fs.lstat(workspace, { bigint: true });
    if (current.isSymbolicLink() || !hasSameFileIdentity(expectedIdentity, current)) {
      throw new Error(`extractArchive 拒绝清理时 workspace 身份变化：${workspace}`);
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- workspace is an exclusive mkdtemp directory owned by this extraction call
    await fs.rm(workspace, { recursive: true, force: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- workspace is the exclusive temporary directory just removed
    if ((await lstatIfPresent(workspace)) !== undefined) {
      throw new Error(`extractArchive 清理后 workspace 仍存在：${workspace}`);
    }
  } catch (error) {
    throw new Error(`extractArchive 清理失败：${describeError(error)}`);
  }
}

async function removeOwnedDirectory(
  target: string,
  expectedIdentity: FileIdentityStats,
  boundaryRoot: string,
): Promise<void> {
  // This operation is deliberately identity-gated. If the destination was replaced,
  // do not follow or remove the replacement: leave it for explicit fail-closed handling.
  await assertPathInside(boundaryRoot, target, 'destination');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is the atomically claimed extraction destination
  const current = await fs.lstat(target, { bigint: true });
  if (current.isSymbolicLink() || !current.isDirectory() || !hasSameFileIdentity(expectedIdentity, current)) {
    throw new Error(`extractArchive 拒绝回滚时 destination 身份变化：${target}`);
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- target remains the identity-verified claimed destination
  await fs.rmdir(target);
  if ((await lstatIfPresent(target)) !== undefined) {
    throw new Error(`extractArchive 回滚后 destination 仍存在：${target}`);
  }
}

type OwnedEntry = { path: string; identity: FileIdentityStats; type: 'file' | 'directory' };

async function claimDirectoryNoReplace(
  destination: string,
  boundaryRoot: string,
  mode: number,
  owned: OwnedEntry[],
): Promise<FileIdentityStats> {
  await assertPathInside(boundaryRoot, path.dirname(destination), 'destination parent', true);
  const parentHandle = await openDirectory(path.dirname(destination));
  let claimed: FileIdentityStats | undefined;
  let primaryError: unknown;
  try {
    await assertDirectoryHandleIdentity(parentHandle, path.dirname(destination));
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- destination is a validated child of the claimed extraction root
    await fs.mkdir(destination, { mode });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- destination was just exclusively claimed below the validated root
    claimed = await fs.lstat(destination, { bigint: true });
    if (claimed.isSymbolicLink() || !claimed.isDirectory() || !hasUsableFileIdentity(claimed)) {
      throw new Error(`extractArchive 拒绝新建目录身份：${destination}`);
    }
    // Register ownership before the second parent-boundary check. If that check
    // observes a race, rollback can remove this newly claimed directory only when
    // its identity still matches; an unregistered claim would leak an empty target.
    owned.push({ path: destination, identity: claimed, type: 'directory' });
    await assertDirectoryHandleIdentity(parentHandle, path.dirname(destination));
  } catch (error) {
    primaryError = error;
  }
  const closeError = await closeHandleOrThrow(parentHandle, 'destination 父目录');
  if (primaryError !== undefined && closeError !== undefined) {
    throw new Error(`${describeError(primaryError)}；${closeError.message}`);
  }
  if (primaryError !== undefined) throw primaryError;
  if (closeError !== undefined) throw closeError;
  if (claimed === undefined) throw new Error(`extractArchive 无法确认新建目录身份：${destination}`);
  return claimed;
}

async function transferTreeNoReplace(
  source: string,
  destination: string,
  boundaryRoot: string,
  owned: OwnedEntry[],
): Promise<void> {
  // Source is private staging output; reject any unexpected reparse/link object.
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- source is beneath the private extraction workspace
  const sourceStat = await fs.lstat(source, { bigint: true });
  if (sourceStat.isSymbolicLink() || !sourceStat.isDirectory()) {
    throw new Error(`extractArchive 拒绝 transfer source 非目录或链接：${source}`);
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- source is beneath the private extraction workspace
  const children = await fs.readdir(source);
  for (const name of children) {
    const sourceChild = path.join(source, name);
    const destinationChild = path.join(destination, name);
    if (!isWithinExtractionRoot(boundaryRoot, destinationChild)) {
      throw new Error(`extractArchive 拒绝 destination 越界：${destinationChild}`);
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- sourceChild is beneath private staging and destinationChild is beneath the claimed destination
    const sourceChildStat = await fs.lstat(sourceChild, { bigint: true });
    if (sourceChildStat.isSymbolicLink()) {
      throw new Error(`extractArchive 拒绝 transfer source 链接：${sourceChild}`);
    }
    if (sourceChildStat.isDirectory()) {
      await claimDirectoryNoReplace(destinationChild, boundaryRoot, Number(sourceChildStat.mode & 0o7777n), owned);
      await transferTreeNoReplace(sourceChild, destinationChild, boundaryRoot, owned);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- sourceChild is private staging and was emptied by the recursive transfer
      await fs.rmdir(sourceChild);
      continue;
    }
    if (!sourceChildStat.isFile()) {
      throw new Error(`extractArchive 拒绝 transfer source 特殊文件：${sourceChild}`);
    }
    // Verify the claimed parent immediately before and after the no-replace copy.
    const destinationParent = path.dirname(destinationChild);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- destinationParent is beneath the claimed destination
    const destinationParentHandle = await openDirectory(destinationParent);
    let transferError: unknown;
    try {
      await assertDirectoryHandleIdentity(destinationParentHandle, destinationParent);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- destinationChild is beneath the claimed destination and COPYFILE_EXCL is no-replace
      await fs.copyFile(sourceChild, destinationChild, fsConstants.COPYFILE_EXCL);
      await assertDirectoryHandleIdentity(destinationParentHandle, destinationParent);
    } catch (error) {
      transferError = error;
    }
    const closeError = await closeHandleOrThrow(destinationParentHandle, 'destination 父目录');
    if (transferError !== undefined && closeError !== undefined) {
      throw new Error(`${describeError(transferError)}；${closeError.message}`);
    }
    if (transferError !== undefined) throw transferError;
    if (closeError !== undefined) throw closeError;
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- destinationChild was just created by this call
    const destinationStat = await fs.lstat(destinationChild, { bigint: true });
    if (destinationStat.isSymbolicLink() || !destinationStat.isFile() || !hasUsableFileIdentity(destinationStat)) {
      throw new Error(`extractArchive 拒绝新建文件身份：${destinationChild}`);
    }
    owned.push({ path: destinationChild, identity: destinationStat, type: 'file' });
    const fileMode = Number(sourceChildStat.mode & 0o7777n);
    if (fileMode !== 0) {
      await chmodEntrySafely(destinationChild, fileMode, 'file');
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- sourceChild remains private staging and its identity is checked before unlink
    const sourceAfterCopy = await fs.lstat(sourceChild, { bigint: true });
    if (!hasSameFileIdentity(sourceChildStat, sourceAfterCopy) || !sourceAfterCopy.isFile()) {
      throw new Error(`extractArchive 拒绝 transfer source 身份变化：${sourceChild}`);
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- sourceChild is private staging and identity-checked above
    await fs.unlink(sourceChild);
  }
}

async function rollbackOwnedEntries(owned: readonly OwnedEntry[], boundaryRoot: string): Promise<void> {
  for (const item of [...owned].reverse()) {
    await assertPathInside(boundaryRoot, item.path, 'rollback target');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- item.path was created by this extraction call and remains identity-gated
    const current = await fs.lstat(item.path, { bigint: true });
    if (current.isSymbolicLink() || !hasSameFileIdentity(item.identity, current)) {
      throw new Error(`extractArchive 拒绝 rollback 条目身份变化：${item.path}`);
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- item.path remains identity-verified and owned by this extraction call
    if (item.type === 'file') await fs.unlink(item.path);
    else await removeOwnedDirectory(item.path, item.identity, boundaryRoot);
  }
}

function isSamePath(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

async function assertPinnedDirectory(selected: string, pinned: string): Promise<void> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- selected is the caller-selected extraction root checked by the caller
    const current = await fs.realpath(selected);
    if (!isSamePath(current, pinned)) {
      throw new Error(`extractArchive 拒绝 extraction root 身份变化：${selected}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('拒绝 extraction root 身份变化')) throw error;
    throw new Error(`extractArchive 无法确认 extraction root 身份：${selected}`);
  }
}

type FileIdentityStats = BigIntStats;

function hasSameFileIdentity(left: FileIdentityStats, right: FileIdentityStats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function hasUsableFileIdentity(stat: FileIdentityStats): boolean {
  return stat.dev !== 0n && stat.ino !== 0n;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function assertPathInside(root: string, target: string, label: string, allowRoot = false): Promise<string> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is derived from the validated extraction root and archive path
    const resolved = await fs.realpath(target);
    if (
      !isSamePath(resolved, target) ||
      (!allowRoot && !isWithinExtractionRoot(root, resolved)) ||
      (allowRoot && !isWithinExtractionRoot(root, resolved) && !isSamePath(root, resolved))
    ) {
      throw new Error(`extractArchive 拒绝${label}逃逸 extraction root：${target}`);
    }
    return resolved;
  } catch (error) {
    if (error instanceof Error && error.message.includes('拒绝')) throw error;
    throw new Error(`extractArchive 无法确认${label}边界：${target}`);
  }
}

async function assertDirectoryHandleIdentity(
  handle: Awaited<ReturnType<typeof fs.open>>,
  directory: string,
): Promise<BigIntStats> {
  const opened = await handle.stat({ bigint: true });
  if (!hasUsableFileIdentity(opened) || !opened.isDirectory()) {
    throw new Error(`extractArchive 无法确认父目录句柄身份：${directory}`);
  }
  try {
    // lstat is required in addition to stat: a junction/symlink may otherwise resolve
    // to the same object as the handle and appear valid while changing the path boundary.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- directory is a validated extraction parent and is compared with its already-opened handle
    const lexical = await fs.lstat(directory, { bigint: true });
    if (lexical.isSymbolicLink() || !lexical.isDirectory()) {
      throw new Error(`extractArchive 拒绝父目录链接或非目录：${directory}`);
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- directory is a validated extraction parent and is compared with its already-opened handle
    const current = await fs.stat(directory, { bigint: true });
    if (!hasSameFileIdentity(opened, current)) {
      throw new Error(`extractArchive 拒绝父目录身份变化：${directory}`);
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- directory is a validated extraction parent whose lexical identity was checked above
    const resolved = await fs.realpath(directory);
    if (!isSamePath(resolved, directory)) {
      throw new Error(`extractArchive 拒绝父目录 realpath 变化：${directory}`);
    }
    return opened;
  } catch (error) {
    if (error instanceof Error && error.message.includes('拒绝')) throw error;
    throw new Error(`extractArchive 无法确认父目录身份：${directory}`);
  }
}

const DIRECTORY_FLAG = (fsConstants as { O_DIRECTORY?: number }).O_DIRECTORY;
const NO_FOLLOW_FLAG = (fsConstants as { O_NOFOLLOW?: number }).O_NOFOLLOW ?? 0;

function descriptorChildPath(handle: Awaited<ReturnType<typeof fs.open>>, child: string): string {
  if (process.platform === 'win32' || DIRECTORY_FLAG === undefined || NO_FOLLOW_FLAG === 0) {
    throw new Error('extractArchive 无法在当前平台提供安全原子 parent/file 绑定，拒绝提取');
  }
  const fdRoot = process.platform === 'darwin' ? '/dev/fd' : '/proc/self/fd';
  return path.join(fdRoot, String(handle.fd), path.basename(child));
}

async function openDirectory(directory: string): Promise<Awaited<ReturnType<typeof fs.open>>> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- directory is the caller-selected or private extraction directory
  return fs.open(directory, fsConstants.O_RDONLY | (DIRECTORY_FLAG ?? 0) | NO_FOLLOW_FLAG);
}

async function closeHandleOrThrow(
  handle: Awaited<ReturnType<typeof fs.open>> | undefined,
  label: string,
): Promise<Error | undefined> {
  if (handle === undefined) return undefined;
  try {
    await handle.close();
    return undefined;
  } catch (error) {
    return new Error(`extractArchive ${label}关闭失败：${describeError(error)}`);
  }
}

/**
 * Open a file relative to an already-opened parent directory descriptor. There is no
 * path-based fallback: a platform without the required descriptor/no-follow support
 * must reject extraction before it writes anything.
 */
async function writeFileSafely(
  workspace: string,
  parent: string,
  basename: string,
  content: Buffer,
  mode: number | undefined,
): Promise<FileIdentityStats> {
  const flags = fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | NO_FOLLOW_FLAG;
  let parentHandle: Awaited<ReturnType<typeof fs.open>> | undefined;
  let fileHandle: Awaited<ReturnType<typeof fs.open>> | undefined;
  let openedTarget: string | undefined;
  let fileCreated = false;
  let createdIdentity: FileIdentityStats | undefined;
  let verifiedCreatedPath: string | undefined;
  let primaryError: unknown;
  try {
    const parentFlags = fsConstants.O_RDONLY | (DIRECTORY_FLAG ?? 0) | NO_FOLLOW_FLAG;
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- parent is a validated directory below the private extraction workspace
    parentHandle = await fs.open(parent, parentFlags);
    await assertDirectoryHandleIdentity(parentHandle, parent);
    openedTarget = descriptorChildPath(parentHandle, basename);

    // O_EXCL success is the only point at which this call owns a newly-created file.
    // Do not infer ownership from the path string before this operation succeeds.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- openedTarget is derived from a validated private extraction directory and basename
    fileHandle = await fs.open(openedTarget, flags, mode ?? 0o666);
    fileCreated = true;
    createdIdentity = await fileHandle.stat({ bigint: true });
    if (!hasUsableFileIdentity(createdIdentity) || !createdIdentity.isFile()) {
      throw new Error(`extractArchive 无法确认新建文件身份：${basename}`);
    }

    // Windows has no portable Node no-follow open flag. First bind cleanup to the
    // exact object that O_EXCL created. This is intentionally done before any later
    // boundary check: a junction race may resolve the opened path outside the
    // workspace, but an identity-checked cleanup can still remove only this call's
    // newly-created file. A failed identity check is never treated as success.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- openedTarget is the validated private extraction path
    const realTarget = await fs.realpath(openedTarget);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- realTarget is obtained from the just-opened file handle path
    const realStat = await fs.stat(realTarget, { bigint: true });
    if (!hasSameFileIdentity(createdIdentity, realStat)) {
      throw new Error(`extractArchive 拒绝新建文件身份变化：${basename}`);
    }
    verifiedCreatedPath = realTarget;
    if (!isWithinExtractionRoot(workspace, realTarget)) {
      throw new Error(`extractArchive 拒绝文件路径逃逸 extraction root：${basename}`);
    }

    // Verify the parent both before and immediately before the write. On Windows
    // these checks are not a kernel-level no-follow guarantee; any observed
    // replacement therefore fails closed and the operation never reports success.
    await assertDirectoryHandleIdentity(parentHandle, parent);
    await assertDirectoryHandleIdentity(parentHandle, parent);
    const beforeWrite = await fileHandle.stat({ bigint: true });
    if (!hasSameFileIdentity(createdIdentity, beforeWrite)) {
      throw new Error(`extractArchive 拒绝写入前文件身份变化：${basename}`);
    }
    await fileHandle.writeFile(content);
    const afterWrite = await fileHandle.stat({ bigint: true });
    if (!hasSameFileIdentity(createdIdentity, afterWrite)) {
      throw new Error(`extractArchive 拒绝写入后文件身份变化：${basename}`);
    }
  } catch (error) {
    primaryError = error;
  }

  const fileCloseError = await closeHandleOrThrow(fileHandle, '文件');
  fileHandle = undefined;
  if (fileCloseError !== undefined) {
    primaryError =
      primaryError === undefined
        ? fileCloseError
        : new Error(`${describeError(primaryError)}；${fileCloseError.message}`);
  }

  const parentCloseError = await closeHandleOrThrow(parentHandle, '父目录');
  parentHandle = undefined;
  if (parentCloseError !== undefined) {
    primaryError =
      primaryError === undefined
        ? parentCloseError
        : new Error(`${describeError(primaryError)}；${parentCloseError.message}`);
  }

  if (primaryError !== undefined && fileCreated && verifiedCreatedPath !== undefined && createdIdentity !== undefined) {
    try {
      // Re-verify the exact real path and identity before removing the file created by
      // this call. Never remove openedTarget: it may now resolve through a junction.
      // This runs after both handles close so a parent-close failure cannot leave an
      // identity-verified file behind while still reporting a failed extraction.
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- verifiedCreatedPath was realpath- and identity-verified while the file handle was open
      const cleanupStat = await fs.lstat(verifiedCreatedPath, { bigint: true });
      if (!hasSameFileIdentity(createdIdentity, cleanupStat) || cleanupStat.isSymbolicLink()) {
        throw new Error(`extractArchive 清理前文件身份变化：${verifiedCreatedPath}`);
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- verifiedCreatedPath remains identity-verified and names the file created by this call
      await fs.unlink(verifiedCreatedPath);
    } catch (cleanupError) {
      primaryError = new Error(
        `extractArchive 写入失败：${describeError(primaryError)}；清理失败：${describeError(cleanupError)}`,
      );
    }
  }

  if (primaryError !== undefined) throw primaryError;
  if (createdIdentity === undefined) {
    throw new Error(`extractArchive 无法确认新建文件身份：${basename}`);
  }
  return createdIdentity;
}

/**
 * Parse and independently enforce the extraction boundary before writing anything.
 * Entries are first checked for unsafe links/paths and canonical duplicates, then extracted
 * into an exclusive private workspace. Only after extraction succeeds are top-level entries
 * atomically renamed into the caller-selected root, preventing writes through a raced target.
 *
 * The caller-side `validateArchiveEntries` remains in place as defense in depth. Files use
 * the tar mode when present, preserving executable bits for valid UStar/PAX/GNU entries.
 */
export async function extractArchive(archive: Buffer, directory: string): Promise<void> {
  if (directory.includes('\0')) {
    throw new Error('extractArchive 拒绝包含 NUL 的 extraction root');
  }
  const root = path.resolve(directory);
  const entries = parseArchive(gunzipSync(archive));
  const planned = validateCanonicalPaths(entries);

  if (process.platform === 'win32') {
    throw new Error('extractArchive 无法在 Windows 提供安全原子 parent/file 绑定，拒绝提取');
  }

  await assertNoSymlinkAncestors(root);
  // Create the caller-selected root only after every archive-only preflight has passed.
  await ensureSafeDirectory(path.parse(root).root, root);
  await assertNoSymlinkAncestors(root);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- root was validated as the caller-selected extraction directory
  const pinnedRoot = await fs.realpath(root);

  let workspace: string | undefined;
  let workspaceIdentity: BigIntStats | undefined;
  const owned: OwnedEntry[] = [];
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- root is caller-selected and validated as a non-symlink extraction directory
    workspace = await fs.mkdtemp(path.join(pinnedRoot, '.platform-deps-extract-'));
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- workspace is the exclusive temporary directory just created below the pinned root
    workspaceIdentity = await fs.lstat(workspace, { bigint: true });
    if (
      workspaceIdentity.isSymbolicLink() ||
      !workspaceIdentity.isDirectory() ||
      !hasUsableFileIdentity(workspaceIdentity)
    ) {
      throw new Error(`extractArchive 无法确认 workspace 身份：${workspace}`);
    }
    await assertNoSymlinkAncestors(workspace);

    for (const { entry, archivePath } of planned) {
      const target = path.resolve(workspace, ...archivePath.split('/'));
      if (!isWithinExtractionRoot(workspace, target)) {
        throw new Error(`extractArchive 拒绝 extraction root 外路径：${entry.path}`);
      }
      if (entry.type === 'directory') {
        await ensureSafeDirectory(workspace, target, entry.mode);
        continue;
      }
      const parent = await ensureSafeDirectory(workspace, path.dirname(target));
      const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content ?? '');
      await writeFileSafely(workspace, parent, path.basename(target), content, entry.mode);
    }

    const topLevels = [...new Set(planned.map(({ canonicalPath }) => canonicalPath.split('/')[0]!))];
    for (const topLevel of topLevels) {
      const staged = path.join(workspace, topLevel);
      const destination = path.join(root, topLevel);
      if (!isWithinExtractionRoot(root, destination)) {
        throw new Error(`extractArchive 拒绝 extraction root 外路径：${topLevel}`);
      }
      await assertPinnedDirectory(root, pinnedRoot);
      await assertNoSymlinkAncestors(root);
      await assertNoSymlinkAncestors(destination);
      const existing = await lstatIfPresent(destination);
      if (existing !== undefined) {
        throw new Error(`extractArchive 拒绝覆盖既有目标：${destination}`);
      }
      // Claim a destination directory without replacement, then transfer every staged child
      // with COPYFILE_EXCL. A failure rolls back only identity-verified entries owned by us.
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- staged is beneath the private extraction workspace and destination is beneath the pinned root
      const stagedStat = await fs.lstat(staged, { bigint: true });
      if (stagedStat.isDirectory()) {
        await claimDirectoryNoReplace(destination, root, Number(stagedStat.mode & 0o7777n), owned);
        await transferTreeNoReplace(staged, destination, root, owned);
      } else if (stagedStat.isFile()) {
        const parent = path.dirname(destination);
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- staged is an identity-checked file below the private extraction workspace
        const stagedContent = await fs.readFile(staged);
        const identity = await writeFileSafely(
          root,
          parent,
          path.basename(destination),
          stagedContent,
          Number(stagedStat.mode & 0o7777n),
        );
        owned.push({ path: destination, identity, type: 'file' });
      } else {
        throw new Error(`extractArchive 拒绝 staging 顶层特殊文件：${staged}`);
      }
    }
  } catch (error) {
    let rollbackError: unknown;
    try {
      await rollbackOwnedEntries(owned, root);
    } catch (candidate) {
      rollbackError = candidate;
    }
    if (workspace !== undefined && workspaceIdentity !== undefined) {
      try {
        await removeExtractionWorkspace(workspace, workspaceIdentity, pinnedRoot);
      } catch (cleanupError) {
        rollbackError = rollbackError ?? cleanupError;
      }
    }
    if (rollbackError !== undefined) {
      throw new Error(
        `extractArchive 提取失败：${describeError(error)}；回滚/清理失败：${describeError(rollbackError)}`,
      );
    }
    throw error;
  }

  if (workspace !== undefined && workspaceIdentity !== undefined) {
    await removeExtractionWorkspace(workspace, workspaceIdentity, pinnedRoot);
  }
}
