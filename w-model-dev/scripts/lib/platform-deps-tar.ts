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

/* eslint-disable security/detect-non-literal-fs-filename -- 写盘目标由已校验安全（无绝对/../空段）的 tar 条目路径 drive，且仅落在 extract 目标目录下 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { gunzipSync } from 'node:zlib';

import type { ArchiveEntry } from './platform-deps-installer.js';

const BLOCK_SIZE = 512;

/** 读取 UStar 数值字段：octal（NUL/空格结尾）或 GNU base-256（首字节高位置位） */
function readSizeField(buffer: Buffer, offset: number, length: number): number {
  const first = buffer[offset] ?? 0;
  if ((first & 0x80) !== 0) {
    let value = 0;
    for (let i = 0; i < length; i += 1) {
      const byte = buffer[offset + i] ?? 0;
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
function parsePaxRecords(blob: string): Record<string, string> {
  const records: Record<string, string> = {};
  let cursor = 0;
  while (cursor < blob.length) {
    const space = blob.indexOf(' ', cursor);
    if (space < 0) break;
    const length = Number.parseInt(blob.slice(cursor, space), 10);
    if (!Number.isFinite(length) || length <= 0 || cursor + length > blob.length) break;
    const record = blob.slice(cursor, cursor + length);
    cursor += length;
    const equal = record.indexOf('=');
    if (equal < 0) continue;
    const key = record.slice(space + 1, equal);
    const value = record.slice(equal + 1).replace(/\n$/, '');
    if (key !== '') records[key] = value;
  }
  return records;
}

/**
 * 自包含解析 npm tarball 归档（gzip 压缩后）：
 *   常规文件/目录、symlink/hardlink、pax 'x'/'g'、GNU long name/long link。
 * 长名解析后仍是原路径——解析结果忠实交给核心校验，不在此处引入穿越。
 */
function parseArchive(archive: Buffer): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];
  let offset = 0;
  let gnuLongName: string | undefined;
  let gnuLongLink: string | undefined;
  let paxRecords: Record<string, string> = {};
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
      Object.assign(paxRecords, parsePaxRecords(data.toString('utf8')));
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
    const entryPath = (
      paxPending && paxRecords.path !== undefined ? paxRecords.path : (gnuLongName ?? headerName)
    ).replace(/\/+$/, '');
    let linkname: string | undefined;
    if (paxPending && paxRecords.linkpath !== undefined) {
      linkname = paxRecords.linkpath;
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
        entries.push({ path: entryPath, type: 'file', content: Buffer.from(data) });
        break;
      case '5':
        entries.push({ path: entryPath, type: 'directory' });
        break;
      case '1':
        entries.push({ path: entryPath, type: 'hardlink', linkname });
        break;
      case '2':
        entries.push({ path: entryPath, type: 'symlink', linkname });
        break;
      default:
        // 未知类型按普通文件保留数据（npm tarball 不含设备/管道节点）
        entries.push({ path: entryPath, type: 'file', content: Buffer.from(data) });
        break;
    }

    gnuLongName = undefined;
    gnuLongLink = undefined;
    paxPending = false;
    paxRecords = {};
    offset = nextOffset;
  }
  return entries;
}

/** 解压并解析归档条目（供 verifyPlatformDependency 注入） */
export async function readArchiveEntries(archive: Buffer): Promise<readonly ArchiveEntry[]> {
  return parseArchive(gunzipSync(archive));
}

/**
 * 把已由核心校验过安全（无绝对路径 / '..' / 空段 / NUL，无符号/硬链接）的条目按
 * package/... 写盘。链接条目兜底拒绝，不写符号/硬链接。
 */
export async function extractArchive(archive: Buffer, directory: string): Promise<void> {
  const entries = parseArchive(gunzipSync(archive));
  for (const entry of entries) {
    const target = path.resolve(directory, entry.path);
    if (entry.type === 'symlink' || entry.type === 'hardlink') {
      throw new Error(`extractArchive 拒绝链接条目：${entry.path}`);
    }
    if (entry.type === 'directory') {
      await fs.mkdir(target, { recursive: true });
      continue;
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, entry.content ?? Buffer.alloc(0));
  }
}
