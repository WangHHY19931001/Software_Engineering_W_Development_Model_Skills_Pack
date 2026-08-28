/**
 * 自包含 npm tarball 读取/写出（lib/platform-deps-tar.ts）
 *
 * 为生产接线 CLI（cli/platform-deps-install.ts）给 verifyPlatformDependency 注入的真实
 * tar I/O：
 *   - readArchiveEntries：gunzip（node:zlib）+ UStar header 解析；支持 pax 扩展头
 *     （typeflag 'x'/'g'）与 GNU long name / long link（'L'/'K'）。
 *   - extractArchive：在 POSIX 上以 parent directory descriptor 为边界直接写入目标目录，
 *     不创建符号链接或硬链接；Windows 及缺少所需 descriptor 能力的平台 fail-closed。
 *
 * 无网络、无 npm、无 tar 命令——只依赖 Node 标准库（node:fs/promises / node:path / node:zlib）。
 * 仅供上述 CLI 与该 CLI 的测试消费，不参与 /wm 编排。
 */

import { constants as fsConstants, promises as fs, type BigIntStats } from 'node:fs';
import * as path from 'node:path';
import { gunzipSync } from 'node:zlib';

import { isUnsafeArchivePath } from './platform-deps-installer.js';
import type { ArchiveEntry } from './platform-deps-installer.js';

/** 解析出的归档条目：ArchiveEntry + UStar mode（八进制，file/directory 条目携带） */
export type TarArchiveEntry = ArchiveEntry & {
  mode?: number;
  rawPath?: string;
};

const BLOCK_SIZE = 512;

type FileIdentityStats = BigIntStats;
type FileHandle = Awaited<ReturnType<typeof fs.open>>;

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
        entries.push({
          path: entryPath,
          rawPath,
          type: 'file',
          content: Buffer.from(data),
          mode,
          linkname,
        });
        break;
      case '5':
        entries.push({
          path: entryPath,
          rawPath,
          type: 'directory',
          mode,
          linkname,
        });
        break;
      case '1':
        entries.push({ path: entryPath, rawPath, type: 'hardlink', linkname });
        break;
      case '2':
        entries.push({ path: entryPath, rawPath, type: 'symlink', linkname });
        break;
      default:
        entries.push({
          path: entryPath,
          rawPath,
          type: 'file',
          content: Buffer.from(data),
          mode,
          linkname,
        });
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

function normalizeArchivePath(rawPath: string): string {
  return rawPath.replaceAll('\\', '/').replace(/\/+$/, '');
}

function canonicalArchivePath(rawPath: string): string {
  const normalized = normalizeArchivePath(rawPath);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function validateCanonicalPaths(entries: readonly TarArchiveEntry[]): Array<{
  entry: TarArchiveEntry;
  archivePath: string;
  canonicalPath: string;
}> {
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

  const byCanonicalPath = new Map(planned.map((item) => [item.canonicalPath, item] as const));
  for (const current of planned) {
    let separator = current.canonicalPath.indexOf('/');
    while (separator >= 0) {
      const ancestor = byCanonicalPath.get(current.canonicalPath.slice(0, separator));
      if (ancestor?.entry.type === 'file') {
        throw new Error(`extractArchive 拒绝文件/目录路径冲突：${ancestor.archivePath} 与 ${current.archivePath}`);
      }
      separator = current.canonicalPath.indexOf('/', separator + 1);
    }
  }
  return planned;
}

const DIRECTORY_FLAG = (fsConstants as { O_DIRECTORY?: number }).O_DIRECTORY;
const NO_FOLLOW_FLAG = (fsConstants as { O_NOFOLLOW?: number }).O_NOFOLLOW;
const DIRECTORY_OPEN_FLAGS = fsConstants.O_RDONLY | (DIRECTORY_FLAG ?? 0) | (NO_FOLLOW_FLAG ?? 0);
const FILE_OPEN_FLAGS = fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | (NO_FOLLOW_FLAG ?? 0);

type DirectoryContext = {
  handle: FileHandle;
  identity: FileIdentityStats;
  rootRealPath: string;
  segments: readonly string[];
};

type DirectoryPath = {
  current: DirectoryContext;
  contexts: DirectoryContext[];
};

type OwnedEntry = {
  canonicalPath: string;
  name: string;
  parentIdentity: FileIdentityStats;
  parentHandle: FileHandle;
  rootRealPath: string;
  identity?: FileIdentityStats;
  segments: readonly string[];
  type: 'file' | 'directory';
};

type DirectoryMode = {
  canonicalPath: string;
  mode: number;
  segments: readonly string[];
};

function hasSameFileIdentity(left: FileIdentityStats, right: FileIdentityStats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function hasUsableFileIdentity(stat: FileIdentityStats): boolean {
  return stat.dev !== 0n && stat.ino !== 0n;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function combineErrors(primary: unknown, secondary: Error): Error {
  return new Error(`${describeError(primary)}；${secondary.message}`);
}

function extractionCapabilityError(): Error {
  return new Error(
    process.platform === 'win32'
      ? 'extractArchive 无法在 Windows 提供安全 descriptor-relative parent/file 绑定，拒绝提取'
      : 'extractArchive 无法在当前平台提供安全 descriptor-relative parent/file 绑定，拒绝提取',
  );
}

function descriptorRoot(): string {
  return process.platform === 'darwin' ? '/dev/fd' : '/proc/self/fd';
}

function descriptorPath(handle: FileHandle): string {
  return path.join(descriptorRoot(), String(handle.fd));
}

function descriptorChildPath(parent: FileHandle, name: string): string {
  return path.join(descriptorPath(parent), name);
}

function isSamePath(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function isPathWithin(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  return isSamePath(resolvedRoot, resolvedTarget) || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
}

async function descriptorRealPath(handle: FileHandle, label: string): Promise<string> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- descriptor path is generated from an open kernel handle
    return await fs.realpath(descriptorPath(handle));
  } catch (error) {
    throw new Error(`extractArchive 无法确认${label} descriptor containment：${describeError(error)}`);
  }
}

async function recoverHandleIdentity(handle: FileHandle): Promise<FileIdentityStats> {
  try {
    // The descriptor path follows the already-open kernel object, avoiding a path lookup race.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- descriptor path is generated from an open kernel handle
    const recovered = await fs.stat(descriptorPath(handle), { bigint: true });
    if (!hasUsableFileIdentity(recovered)) {
      throw new Error('descriptor identity is unavailable');
    }
    return recovered;
  } catch (error) {
    throw new Error(`extractArchive 无法恢复已创建对象 identity：${describeError(error)}`);
  }
}

async function assertDescriptorContained(context: DirectoryContext, handle: FileHandle, label: string): Promise<void> {
  const parentPath = await descriptorRealPath(context.handle, `${label} parent`);
  if (!isPathWithin(context.rootRealPath, parentPath)) {
    throw new Error(`extractArchive 拒绝${label} parent 越界：${parentPath}`);
  }
  const targetPath = await descriptorRealPath(handle, label);
  if (!isPathWithin(context.rootRealPath, targetPath)) {
    throw new Error(`extractArchive 拒绝${label} descriptor 越界：${targetPath}`);
  }
}

async function assertDirectoryContained(context: DirectoryContext, label: string): Promise<void> {
  await assertDescriptorContained(context, context.handle, label);
}

async function duplicateDirectoryHandle(context: DirectoryContext, label: string): Promise<FileHandle> {
  await assertDirectoryContained(context, label);
  let duplicate: FileHandle | undefined;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- descriptor path is generated from an open kernel handle
    duplicate = await fs.open(descriptorPath(context.handle), fsConstants.O_RDONLY | (DIRECTORY_FLAG ?? 0));
    const identity = await duplicate.stat({ bigint: true });
    if (
      !identity.isDirectory() ||
      !hasUsableFileIdentity(identity) ||
      !hasSameFileIdentity(identity, context.identity)
    ) {
      throw new Error(`extractArchive 拒绝${label} parent identity 变化`);
    }
    const realPath = await descriptorRealPath(duplicate, label);
    if (!isPathWithin(context.rootRealPath, realPath)) {
      throw new Error(`extractArchive 拒绝${label} parent descriptor 越界：${realPath}`);
    }
    return duplicate;
  } catch (error) {
    const closeError = await closeHandleOrThrow(duplicate, `${label} duplicate`);
    if (closeError !== undefined) throw combineErrors(error, closeError);
    throw error;
  }
}

async function assertExtractionCapabilities(): Promise<void> {
  if (
    process.platform === 'win32' ||
    DIRECTORY_FLAG === undefined ||
    NO_FOLLOW_FLAG === undefined ||
    NO_FOLLOW_FLAG === 0
  ) {
    throw extractionCapabilityError();
  }
  try {
    await fs.access(descriptorRoot());
  } catch {
    throw extractionCapabilityError();
  }
}

async function closeHandleOrThrow(handle: FileHandle | undefined, label: string): Promise<Error | undefined> {
  if (handle === undefined) return undefined;
  try {
    await handle.close();
    return undefined;
  } catch (error) {
    return new Error(`extractArchive ${label} close failed：${describeError(error)}`);
  }
}

async function closeContexts(contexts: readonly DirectoryContext[], label: string): Promise<Error | undefined> {
  let failure: Error | undefined;
  for (const context of [...contexts].reverse()) {
    const closeError = await closeHandleOrThrow(context.handle, label);
    if (closeError !== undefined) failure = failure === undefined ? closeError : combineErrors(failure, closeError);
  }
  return failure;
}

async function lstatChild(parent: DirectoryContext, name: string): Promise<FileIdentityStats | undefined> {
  await assertDirectoryContained(parent, 'directory child');
  try {
    // descriptorChildPath is anchored at the already-open parent descriptor.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- child is resolved through an already-opened, identity-checked parent descriptor
    return await fs.lstat(descriptorChildPath(parent.handle, name), {
      bigint: true,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function assertRootIdentity(root: string, expected: FileIdentityStats): Promise<void> {
  // lstat rejects a replaced root symlink before a descriptor child is used.
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- root is caller-selected and must match the previously opened extraction-root identity
  const lexical = await fs.lstat(root, { bigint: true });
  if (lexical.isSymbolicLink() || !lexical.isDirectory() || !hasSameFileIdentity(lexical, expected)) {
    throw new Error(`extractArchive 拒绝 extraction root 身份变化：${root}`);
  }
}

async function openRootContext(
  root: string,
  expected: FileIdentityStats,
  rootRealPath: string,
): Promise<DirectoryContext> {
  await assertRootIdentity(root, expected);
  let handle: FileHandle | undefined;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-selected root is opened no-follow and verified against its recorded identity
    handle = await fs.open(root, DIRECTORY_OPEN_FLAGS);
    const opened = await handle.stat({ bigint: true });
    if (!opened.isDirectory() || !hasUsableFileIdentity(opened) || !hasSameFileIdentity(opened, expected)) {
      throw new Error(`extractArchive 拒绝 extraction root 句柄身份变化：${root}`);
    }
    const openedRealPath = await descriptorRealPath(handle, 'extraction root');
    if (!isSamePath(openedRealPath, rootRealPath)) {
      throw new Error(`extractArchive 拒绝 extraction root descriptor 越界：${openedRealPath}`);
    }
    return {
      handle,
      identity: opened,
      rootRealPath,
      segments: [],
    };
  } catch (error) {
    const closeError = await closeHandleOrThrow(handle, 'extraction root');
    if (closeError !== undefined) throw combineErrors(error, closeError);
    throw error;
  }
}

async function openDirectoryChild(
  parent: DirectoryContext,
  name: string,
  verifyLexical = true,
): Promise<DirectoryContext> {
  await assertDirectoryContained(parent, 'directory child');
  const childPath = descriptorChildPath(parent.handle, name);
  let handle: FileHandle | undefined;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- childPath is descriptor-relative and opened with O_DIRECTORY plus O_NOFOLLOW
    handle = await fs.open(childPath, DIRECTORY_OPEN_FLAGS);
    const opened = await handle.stat({ bigint: true });
    if (!opened.isDirectory() || !hasUsableFileIdentity(opened)) {
      throw new Error(`extractArchive 拒绝目录身份变化：${childPath}`);
    }
    const openedRealPath = await descriptorRealPath(handle, 'directory child');
    if (!isPathWithin(parent.rootRealPath, openedRealPath)) {
      throw new Error(`extractArchive 拒绝目录 child descriptor 越界：${openedRealPath}`);
    }
    if (verifyLexical) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- descriptor-relative child is compared with the just-opened directory handle identity
      const lexical = await fs.lstat(childPath, { bigint: true });
      if (lexical.isSymbolicLink() || !lexical.isDirectory() || !hasSameFileIdentity(opened, lexical)) {
        throw new Error(`extractArchive 拒绝目录身份变化：${childPath}`);
      }
    }
    return {
      handle,
      identity: opened,
      rootRealPath: parent.rootRealPath,
      segments: [...parent.segments, name],
    };
  } catch (error) {
    const closeError = await closeHandleOrThrow(handle, 'directory');
    if (closeError !== undefined) throw combineErrors(error, closeError);
    throw error;
  }
}

/** Open a complete directory path using a fresh root descriptor as its anchor. */
async function openDirectoryPath(
  root: string,
  rootIdentity: FileIdentityStats,
  rootRealPath: string,
  segments: readonly string[],
): Promise<DirectoryPath> {
  const contexts: DirectoryContext[] = [];
  try {
    const rootContext = await openRootContext(root, rootIdentity, rootRealPath);
    contexts.push(rootContext);
    let current = rootContext;
    for (const segment of segments) {
      current = await openDirectoryChild(current, segment);
      contexts.push(current);
    }
    return { current, contexts };
  } catch (error) {
    const closeError = await closeContexts(contexts, 'directory path');
    if (closeError !== undefined) throw combineErrors(error, closeError);
    throw error;
  }
}

/** Ensure a directory path with non-recursive descriptor-relative mkdir calls. */
async function ensureDirectoryPath(
  root: string,
  rootIdentity: FileIdentityStats,
  rootRealPath: string,
  segments: readonly string[],
  owned: OwnedEntry[],
): Promise<DirectoryPath> {
  const contexts: DirectoryContext[] = [];
  try {
    const rootContext = await openRootContext(root, rootIdentity, rootRealPath);
    contexts.push(rootContext);
    let current = rootContext;
    for (const segment of segments) {
      const childPath = descriptorChildPath(current.handle, segment);
      const existing = await lstatChild(current, segment);
      let owner: OwnedEntry | undefined;
      let created: FileIdentityStats | undefined;
      if (existing === undefined) {
        await assertDirectoryContained(current, 'directory create parent');
        const parentHandle = await duplicateDirectoryHandle(current, 'directory create');
        let mkdirError: unknown;
        try {
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- childPath is a validated single segment anchored to the open parent descriptor
          await fs.mkdir(childPath, { mode: 0o777 });
        } catch (error) {
          mkdirError = error;
        }
        if (mkdirError !== undefined) {
          const closeError = await closeHandleOrThrow(parentHandle, 'directory create parent');
          if (closeError !== undefined) throw combineErrors(mkdirError, closeError);
          throw mkdirError;
        }
        owner = {
          canonicalPath: [...current.segments, segment].join('/'),
          name: segment,
          parentIdentity: current.identity,
          parentHandle,
          rootRealPath,
          segments: [...current.segments, segment],
          type: 'directory',
        };
        // mkdir success is the ownership boundary: register before any follow-up inspection or open.
        owned.push(owner);
        await assertDirectoryContained(current, 'directory create parent after mkdir');
        try {
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- the descriptor-relative child is checked immediately after creation
          created = await fs.lstat(childPath, { bigint: true });
        } catch (error) {
          // Recover identity from the still-open directory handle so rollback can remain identity-gated.
          const recovered = await openDirectoryChild(current, segment, false);
          contexts.push(recovered);
          owner.identity = recovered.identity;
          throw error;
        }
        if (created.isSymbolicLink() || !created.isDirectory() || !hasUsableFileIdentity(created)) {
          throw new Error(`extractArchive 拒绝新建目录身份：${childPath}`);
        }
        owner.identity = created;
      } else if (existing.isSymbolicLink() || !existing.isDirectory()) {
        throw new Error(`extractArchive 拒绝目录位置上的链接或非目录：${childPath}`);
      }
      const next = await openDirectoryChild(current, segment);
      // Register the opened child before comparing identities so a failed comparison still closes it.
      contexts.push(next);
      if (created !== undefined && !hasSameFileIdentity(created, next.identity)) {
        throw new Error(`extractArchive 拒绝新建目录身份变化：${childPath}`);
      }
      if (owner !== undefined && owner.identity !== undefined && !hasSameFileIdentity(owner.identity, next.identity)) {
        throw new Error(`extractArchive 拒绝新建目录句柄身份变化：${childPath}`);
      }
      current = next;
    }
    return { current, contexts };
  } catch (error) {
    const closeError = await closeContexts(contexts, 'directory path');
    if (closeError !== undefined) throw combineErrors(error, closeError);
    throw error;
  }
}

async function writeFileAt(
  directoryPath: DirectoryPath,
  name: string,
  content: Buffer,
  mode: number | undefined,
  canonicalPath: string,
  owned: OwnedEntry[],
): Promise<void> {
  const target = descriptorChildPath(directoryPath.current.handle, name);
  let fileHandle: FileHandle | undefined;
  let primaryError: unknown;
  try {
    const fileParent = directoryPath.current;
    const parentIdentity = await fileParent.handle.stat({
      bigint: true,
    });
    if (
      !parentIdentity.isDirectory() ||
      !hasUsableFileIdentity(parentIdentity) ||
      !hasSameFileIdentity(parentIdentity, fileParent.identity)
    ) {
      throw new Error(`extractArchive 拒绝文件父目录身份变化：${target}`);
    }
    const parentHandle = await duplicateDirectoryHandle(fileParent, 'file create');
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is descriptor-relative and created with O_EXCL plus O_NOFOLLOW under the verified parent
      fileHandle = await fs.open(target, FILE_OPEN_FLAGS, 0o666);
    } catch (error) {
      const closeError = await closeHandleOrThrow(parentHandle, 'file create parent');
      if (closeError !== undefined) throw combineErrors(error, closeError);
      throw error;
    }
    const fileOwner: OwnedEntry = {
      canonicalPath,
      name,
      parentIdentity: fileParent.identity,
      parentHandle,
      rootRealPath: fileParent.rootRealPath,
      segments: [...fileParent.segments, name],
      type: 'file',
    };
    // open success is the ownership boundary: register before stat, write, chmod, or close.
    owned.push(fileOwner);
    let identity: FileIdentityStats;
    try {
      identity = await fileHandle.stat({ bigint: true });
    } catch (error) {
      fileOwner.identity = await recoverHandleIdentity(fileHandle);
      throw error;
    }
    if (!hasUsableFileIdentity(identity)) {
      throw new Error(`extractArchive 拒绝新建文件 identity：${target}`);
    }
    fileOwner.identity = identity;
    if (!identity.isFile()) {
      throw new Error(`extractArchive 拒绝新建文件类型：${target}`);
    }
    await assertDescriptorContained(fileParent, fileHandle, 'file before write');
    await fileHandle.writeFile(content);
    await assertDescriptorContained(fileParent, fileHandle, 'file after write');
    const afterWrite = await fileHandle.stat({ bigint: true });
    if (!hasSameFileIdentity(identity, afterWrite) || !afterWrite.isFile()) {
      throw new Error(`extractArchive 拒绝写入后文件身份变化：${target}`);
    }
    if (mode !== undefined) {
      await fileHandle.chmod(mode & 0o7777);
      const afterChmod = await fileHandle.stat({ bigint: true });
      if (!hasSameFileIdentity(identity, afterChmod) || !afterChmod.isFile()) {
        throw new Error(`extractArchive 拒绝设置文件 mode 后身份变化：${target}`);
      }
    }
  } catch (error) {
    primaryError = error;
  }

  const fileCloseError = await closeHandleOrThrow(fileHandle, 'file');
  if (fileCloseError !== undefined) {
    primaryError = primaryError === undefined ? fileCloseError : combineErrors(primaryError, fileCloseError);
  }
  if (primaryError !== undefined) throw primaryError;
}

async function applyDirectoryMode(
  root: string,
  rootIdentity: FileIdentityStats,
  rootRealPath: string,
  item: OwnedEntry,
  mode: number,
): Promise<void> {
  const directoryPath = await openDirectoryPath(root, rootIdentity, rootRealPath, item.segments);
  let primaryError: unknown;
  try {
    const identity = item.identity;
    if (identity === undefined) {
      throw new Error(`extractArchive 拒绝设置目录 mode 前未登记 identity：${item.canonicalPath}`);
    }
    const current = await directoryPath.current.handle.stat({ bigint: true });
    if (!current.isDirectory() || !hasSameFileIdentity(current, identity)) {
      throw new Error(`extractArchive 拒绝设置目录 mode 前身份变化：${item.canonicalPath}`);
    }
    await directoryPath.current.handle.chmod(mode & 0o7777);
    const after = await directoryPath.current.handle.stat({ bigint: true });
    if (!after.isDirectory() || !hasSameFileIdentity(after, identity)) {
      throw new Error(`extractArchive 拒绝设置目录 mode 后身份变化：${item.canonicalPath}`);
    }
  } catch (error) {
    primaryError = error;
  }
  const closeError = await closeContexts(directoryPath.contexts, 'directory mode');
  if (closeError !== undefined) {
    primaryError = primaryError === undefined ? closeError : combineErrors(primaryError, closeError);
  }
  if (primaryError !== undefined) throw primaryError;
}

async function closeOwnedParentHandles(owned: readonly OwnedEntry[]): Promise<Error | undefined> {
  let failure: Error | undefined;
  for (const item of [...owned].reverse()) {
    const closeError = await closeHandleOrThrow(item.parentHandle, 'owned parent');
    if (closeError !== undefined) failure = failure === undefined ? closeError : combineErrors(failure, closeError);
  }
  return failure;
}

async function rollbackOwnedEntries(owned: readonly OwnedEntry[]): Promise<void> {
  let rollbackError: Error | undefined;
  for (const item of [...owned].reverse()) {
    let itemError: Error | undefined;
    const parentHandle = item.parentHandle;
    try {
      const identity = item.identity;
      if (identity === undefined) {
        throw new Error(`extractArchive 拒绝 rollback 未登记身份：${item.canonicalPath}`);
      }
      const parent = await parentHandle.stat({ bigint: true });
      if (
        !parent.isDirectory() ||
        !hasUsableFileIdentity(parent) ||
        !hasSameFileIdentity(parent, item.parentIdentity)
      ) {
        throw new Error(`extractArchive 拒绝 rollback 父目录身份变化：${item.canonicalPath}`);
      }
      const parentPath = await descriptorRealPath(parentHandle, 'rollback parent');
      if (!isPathWithin(item.rootRealPath, parentPath)) {
        throw new Error(`extractArchive 拒绝 rollback 父目录越界：${item.canonicalPath}`);
      }
      const target = descriptorChildPath(parentHandle, item.name);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- rollback target is anchored at the retained identity-checked parent descriptor
      const current = await fs.lstat(target, { bigint: true });
      if (
        current.isSymbolicLink() ||
        !hasSameFileIdentity(current, identity) ||
        (item.type === 'file' ? !current.isFile() : !current.isDirectory())
      ) {
        throw new Error(`extractArchive 拒绝 rollback 条目身份变化：${item.canonicalPath}`);
      }
      if (item.type === 'file') {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- rollback target remains anchored at the retained identity-checked parent descriptor
        await fs.unlink(target);
      } else {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- rollback target remains anchored at the retained identity-checked parent descriptor
        await fs.rmdir(target);
      }
    } catch (error) {
      itemError = error instanceof Error ? error : new Error(String(error));
    }
    const closeError = await closeHandleOrThrow(item.parentHandle, 'rollback owned parent');
    if (closeError !== undefined) {
      itemError = itemError === undefined ? closeError : combineErrors(itemError, closeError);
    }
    if (itemError !== undefined) {
      rollbackError = rollbackError === undefined ? itemError : combineErrors(rollbackError, itemError);
    }
  }
  if (rollbackError !== undefined) throw rollbackError;
}

async function openAndVerifyRoot(root: string): Promise<{ identity: FileIdentityStats; realPath: string }> {
  let lexical: FileIdentityStats;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-selected extraction root is inspected before any descriptor-relative write
    lexical = await fs.lstat(root, { bigint: true });
  } catch (error) {
    throw new Error(`extractArchive 无法读取 extraction root：${describeError(error)}`);
  }
  if (lexical.isSymbolicLink() || !lexical.isDirectory() || !hasUsableFileIdentity(lexical)) {
    throw new Error(`extractArchive 拒绝 extraction root 非目录或链接：${root}`);
  }

  let handle: FileHandle | undefined;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-selected extraction root is opened no-follow and bound to its lexical identity
    handle = await fs.open(root, DIRECTORY_OPEN_FLAGS);
    const opened = await handle.stat({ bigint: true });
    if (!opened.isDirectory() || !hasUsableFileIdentity(opened) || !hasSameFileIdentity(lexical, opened)) {
      throw new Error(`extractArchive 拒绝 extraction root 身份变化：${root}`);
    }
    const realPath = await descriptorRealPath(handle, 'extraction root');
    const closeError = await closeHandleOrThrow(handle, 'extraction root');
    handle = undefined;
    if (closeError !== undefined) throw closeError;
    return { identity: opened, realPath };
  } catch (error) {
    const closeError = await closeHandleOrThrow(handle, 'extraction root');
    if (closeError !== undefined) throw combineErrors(error, closeError);
    throw error;
  }
}

/**
 * Parse and independently enforce the extraction boundary before writing anything.
 * Entries are checked for unsafe links/paths and canonical duplicates before platform or
 * filesystem work. POSIX writes use descriptor child paths, O_EXCL, O_NOFOLLOW and
 * identity-gated reverse rollback. Directory modes are applied only after all entries exist.
 */
export async function extractArchive(archive: Buffer, directory: string): Promise<void> {
  if (directory.includes('\0')) {
    throw new Error('extractArchive 拒绝包含 NUL 的 extraction root');
  }
  const root = path.resolve(directory);
  const entries = parseArchive(gunzipSync(archive));
  const planned = validateCanonicalPaths(entries);

  // This refusal is deliberately after parse/canonical preflight and before any FS write.
  await assertExtractionCapabilities();
  const rootInfo = await openAndVerifyRoot(root);
  const rootIdentity = rootInfo.identity;
  const rootRealPath = rootInfo.realPath;
  const owned: OwnedEntry[] = [];
  const directoryModes = new Map<string, DirectoryMode>();
  let primaryError: unknown;

  try {
    for (const { entry, archivePath, canonicalPath } of planned) {
      const segments = archivePath.split('/');
      if (entry.type === 'directory') {
        const ensured = await ensureDirectoryPath(root, rootIdentity, rootRealPath, segments, owned);
        const closeError = await closeContexts(ensured.contexts, 'directory path');
        if (closeError !== undefined) throw closeError;
        if (entry.mode !== undefined) {
          directoryModes.set(canonicalPath, {
            canonicalPath,
            mode: entry.mode,
            segments,
          });
        }
        continue;
      }

      const parentSegments = segments.slice(0, -1);
      const parent = await ensureDirectoryPath(root, rootIdentity, rootRealPath, parentSegments, owned);
      const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content ?? '');
      let entryError: unknown;
      try {
        await writeFileAt(parent, segments[segments.length - 1] as string, content, entry.mode, canonicalPath, owned);
      } catch (error) {
        entryError = error;
      }
      const parentCloseError = await closeContexts(parent.contexts, 'parent directory');
      if (entryError !== undefined && parentCloseError !== undefined) {
        throw combineErrors(entryError, parentCloseError);
      }
      if (entryError !== undefined) throw entryError;
      if (parentCloseError !== undefined) throw parentCloseError;
    }

    for (const mode of directoryModes.values()) {
      const owner = owned.find((item) => item.type === 'directory' && item.canonicalPath === mode.canonicalPath);
      if (owner !== undefined) await applyDirectoryMode(root, rootIdentity, rootRealPath, owner, mode.mode);
    }
  } catch (error) {
    primaryError = error;
  }

  if (primaryError !== undefined) {
    try {
      await rollbackOwnedEntries(owned);
    } catch (rollbackError) {
      throw new Error(
        `extractArchive 提取失败：${describeError(primaryError)}；rollback 失败：${describeError(rollbackError)}`,
      );
    }
    throw primaryError;
  }

  const closeError = await closeOwnedParentHandles(owned);
  if (closeError !== undefined) throw closeError;
}
