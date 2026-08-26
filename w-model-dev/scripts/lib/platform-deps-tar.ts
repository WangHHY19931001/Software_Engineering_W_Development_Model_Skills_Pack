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

import { promises as fs } from 'node:fs';
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

/** Create one safe directory hierarchy without accepting an existing symlink component. */
async function ensureSafeDirectory(root: string, target: string): Promise<void> {
  if (target !== root && !isWithinExtractionRoot(root, target)) {
    throw new Error(`extractArchive 拒绝 extraction root 外路径：${target}`);
  }
  const relative = path.relative(root, target);
  let current = root;
  for (const segment of relative === '' ? [] : relative.split(path.sep)) {
    current = path.join(current, segment);
    await assertNoSymlinkAncestors(current);
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- current is derived from the validated archive path and caller-selected isolated staging root; all ancestors are lstat-checked
      await fs.mkdir(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    await assertNoSymlinkAncestors(current);
  }
}

/**
 * Parse and independently enforce the extraction boundary before writing anything:
 * - rejects absolute, drive-qualified, NUL, '.', '..', or empty-segment paths;
 * - rejects symlink, hardlink, and any linkname-bearing entries;
 * - checks the resolved target is strictly beneath the caller-selected root;
 * - rejects pre-existing symlink ancestors in the root/target hierarchy.
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
  const targets = entries.map((entry) => {
    const archivePath = entry.rawPath ?? entry.path;
    if (isUnsafeArchivePath(archivePath)) {
      throw new Error(`extractArchive 拒绝不安全路径：${archivePath}`);
    }
    if (entry.type === 'symlink' || entry.type === 'hardlink' || entry.linkname !== undefined) {
      throw new Error(`extractArchive 拒绝链接条目：${entry.path}`);
    }
    const target = path.resolve(root, entry.path);
    if (!isWithinExtractionRoot(root, target)) {
      throw new Error(`extractArchive 拒绝 extraction root 外路径：${entry.path}`);
    }
    return { entry, target };
  });

  await assertNoSymlinkAncestors(root);
  // Create the caller-selected root one component at a time instead of recursively following an ancestor.
  await ensureSafeDirectory(path.parse(root).root, root);
  await assertNoSymlinkAncestors(root);

  // Preflight all existing ancestors so a malicious later entry cannot cause partial writes.
  for (const { target } of targets) {
    await assertNoSymlinkAncestors(target);
  }

  for (const { entry, target } of targets) {
    if (entry.type === 'directory') {
      await ensureSafeDirectory(root, target);
      continue;
    }

    await ensureSafeDirectory(root, path.dirname(target));
    await assertNoSymlinkAncestors(target);
    const content = entry.content ?? Buffer.alloc(0);
    if (entry.mode !== undefined) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is derived from a validated archive path under the isolated root and its ancestors were lstat-checked
      await fs.writeFile(target, content, { mode: entry.mode, flag: 'wx' });
    } else {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is derived from a validated archive path under the isolated root and its ancestors were lstat-checked
      await fs.writeFile(target, content, { flag: 'wx' });
    }
    await assertNoSymlinkAncestors(target);
  }
}
