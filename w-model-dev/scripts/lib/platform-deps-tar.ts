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

import { constants as fsConstants, promises as fs, type Stats } from 'node:fs';
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
  const source = Buffer.isBuffer(blob) ? blob.toString('utf8') : blob;
  const records = new Map<string, string>();
  let cursor = 0;
  while (cursor < source.length) {
    const space = source.indexOf(' ', cursor);
    if (space < 0) break;
    const length = Number.parseInt(source.slice(cursor, space), 10);
    if (!Number.isFinite(length) || length <= 0 || cursor + length > source.length) break;
    const record = source.slice(cursor, cursor + length);
    // 注意：space 是相对整个 blob 的绝对偏移；切片必须换算成相对 record（从 cursor 起始）的偏移
    const keyOffset = space - cursor;
    cursor += length;
    const equal = record.indexOf('=');
    if (equal < 0) continue;
    const key = record.slice(keyOffset + 1, equal);
    const value = record.slice(equal + 1).replace(/\n$/, '');
    if (key !== '') records.set(key, value);
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
  let paxRecords = new Map<string, string>();
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
      for (const [key, value] of parsePaxRecords(data.toString('utf8'))) paxRecords.set(key, value);
      paxPending = true;
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
    const rawPath =
      paxPending && paxRecords.get('path') !== undefined ? paxRecords.get('path')! : (gnuLongName ?? headerName);
    const entryPath = rawPath.replace(/\/+$/, '');
    // UStar mode（八进制）——提取时用于保留可执行位（真实 platform 包 bin 为 0755）
    const mode = readModeField(header);
    let linkname: string | undefined;
    if (paxPending && paxRecords.get('linkpath') !== undefined) {
      linkname = paxRecords.get('linkpath');
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
    paxRecords = new Map<string, string>();
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
async function ensureSafeDirectory(root: string, target: string): Promise<string> {
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
    const parentReal = await ensureSafeDirectory(path.parse(parent).root, parent);
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
      const existing = await fs.lstat(next);
      if (existing.isSymbolicLink()) {
        throw new Error(`extractArchive 拒绝符号链接 directory：${next}`);
      }
      if (!existing.isDirectory()) {
        throw new Error(`extractArchive 拒绝目录位置上的非目录条目：${next}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- next is derived from a validated archive path and the pinned real parent
      await fs.mkdir(next);
    }
    // Pin the real directory before constructing the next path or opening a file.
    // If a raced replacement redirects it outside canonicalRoot, fail before writing.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- next is the newly created or lstat-validated directory below the pinned extraction root
    const resolved = await fs.realpath(next);
    if (!isWithinExtractionRoot(canonicalRoot, resolved) && resolved !== canonicalRoot) {
      throw new Error(`extractArchive 拒绝 directory 逃逸 extraction root：${next}`);
    }
    current = resolved;
  }
  return current;
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
    return await fs.lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function removeExtractionWorkspace(workspace: string): Promise<void> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- workspace is an exclusive mkdtemp directory owned by this extraction call
    await fs.rm(workspace, { recursive: true, force: true });
  } catch (error) {
    throw new Error(`extractArchive 清理失败：${error instanceof Error ? error.message : String(error)}`);
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

function hasSameFileIdentity(left: Stats, right: Stats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

async function assertDirectoryHandleIdentity(
  handle: Awaited<ReturnType<typeof fs.open>>,
  directory: string,
): Promise<void> {
  const opened = await handle.stat();
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- directory is a validated extraction parent and is compared with its already-opened handle
    const current = await fs.stat(directory);
    if (!hasSameFileIdentity(opened, current)) {
      throw new Error(`extractArchive 拒绝父目录身份变化：${directory}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('拒绝父目录身份变化')) throw error;
    throw new Error(`extractArchive 无法确认父目录身份：${directory}`);
  }
}

/**
 * Open a file without following a raced parent directory where the platform exposes
 * directory file descriptors. Windows lacks O_NOFOLLOW/O_DIRECTORY in Node, so it
 * uses the strongest available O_EXCL open plus an immediate real-path verification.
 */
async function writeFileSafely(
  workspace: string,
  parent: string,
  basename: string,
  content: Buffer,
  mode: number | undefined,
): Promise<void> {
  const noFollow = (fsConstants as { O_NOFOLLOW?: number }).O_NOFOLLOW ?? 0;
  const directoryFlag = (fsConstants as { O_DIRECTORY?: number }).O_DIRECTORY;
  const flags = fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | noFollow;
  let parentHandle: Awaited<ReturnType<typeof fs.open>> | undefined;
  let fileHandle: Awaited<ReturnType<typeof fs.open>> | undefined;
  let openedTarget: string | undefined;
  try {
    // Windows does not expose a portable no-follow open flag, but opening the parent
    // first still lets us compare its identity immediately before and after file open.
    // POSIX additionally uses the descriptor path so the parent cannot be swapped out.
    const parentFlags = fsConstants.O_RDONLY | (directoryFlag ?? 0) | noFollow;
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- parent is a validated directory below the private extraction workspace
    parentHandle = await fs.open(parent, parentFlags);
    await assertDirectoryHandleIdentity(parentHandle, parent);
    if (process.platform !== 'win32' && directoryFlag !== undefined) {
      const fdRoot = process.platform === 'darwin' ? '/dev/fd' : '/proc/self/fd';
      openedTarget = path.join(fdRoot, String(parentHandle.fd), basename);
    } else {
      openedTarget = path.join(parent, basename);
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- openedTarget is derived from a validated private extraction directory and basename
    fileHandle = await fs.open(openedTarget, flags, mode ?? 0o666);
    await assertDirectoryHandleIdentity(parentHandle, parent);

    if (process.platform === 'win32') {
      // Windows has no usable O_NOFOLLOW flag in Node. Reject a junction/symlink
      // replacement before writing and verify that the opened path remains inside.
      await assertNoSymlinkAncestors(path.join(parent, basename));
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is the validated private extraction path
      const realTarget = await fs.realpath(path.join(parent, basename));
      if (!isSamePath(realTarget, path.join(parent, basename)) || !isWithinExtractionRoot(workspace, realTarget)) {
        throw new Error(`extractArchive 拒绝文件路径逃逸 extraction root：${basename}`);
      }
    }

    await fileHandle.writeFile(content);
  } catch (error) {
    if (fileHandle !== undefined) {
      try {
        await fileHandle.close();
      } catch (closeError) {
        throw new Error(
          `extractArchive 文件关闭失败：${closeError instanceof Error ? closeError.message : String(closeError)}；原始错误：${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (process.platform === 'win32' && openedTarget !== undefined) {
      try {
        // `openedTarget` is only removed after O_EXCL created it. On a junction
        // race this removes the escaped file, leaving the junction for workspace cleanup.
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- openedTarget is derived from the validated private extraction directory
        await fs.rm(openedTarget, { force: true });
      } catch (cleanupError) {
        throw new Error(
          `extractArchive 写入失败：${error instanceof Error ? error.message : String(error)}；清理失败：${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        );
      }
    }
    throw error;
  } finally {
    if (fileHandle !== undefined) {
      await fileHandle.close().catch(() => undefined);
    }
    if (parentHandle !== undefined) {
      await parentHandle.close().catch(() => undefined);
    }
  }
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

  await assertNoSymlinkAncestors(root);
  // Create the caller-selected root only after every archive-only preflight has passed.
  await ensureSafeDirectory(path.parse(root).root, root);
  await assertNoSymlinkAncestors(root);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- root was validated as the caller-selected extraction directory
  const pinnedRoot = await fs.realpath(root);

  let workspace: string | undefined;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- root is caller-selected and validated as a non-symlink extraction directory
    workspace = await fs.mkdtemp(path.join(pinnedRoot, '.platform-deps-extract-'));
    await assertNoSymlinkAncestors(workspace);

    for (const { entry, archivePath } of planned) {
      const target = path.resolve(workspace, ...archivePath.split('/'));
      if (!isWithinExtractionRoot(workspace, target)) {
        throw new Error(`extractArchive 拒绝 extraction root 外路径：${entry.path}`);
      }
      if (entry.type === 'directory') {
        await ensureSafeDirectory(workspace, target);
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
      // Rename replaces a raced destination link itself; it does not open or write through it.
      // The immediate ancestor checks above make a raced root junction/symlink fail closed.
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- both paths are derived from the validated root and archive top-level path
      await fs.rename(staged, destination);
    }
  } catch (error) {
    if (workspace !== undefined) {
      try {
        await removeExtractionWorkspace(workspace);
      } catch (cleanupError) {
        throw new Error(
          `extractArchive 提取失败：${error instanceof Error ? error.message : String(error)}；清理失败：${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        );
      }
    }
    throw error;
  }

  if (workspace !== undefined) {
    await removeExtractionWorkspace(workspace);
  }
}
