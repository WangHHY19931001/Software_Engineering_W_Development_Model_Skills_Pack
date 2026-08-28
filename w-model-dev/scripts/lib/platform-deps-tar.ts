/**
 * Self-contained npm tarball reader/extractor for platform dependency repair.
 *
 * Archive bytes and all tar metadata are untrusted. Extraction is permitted only into a
 * caller-owned private staging directory: parse and canonical preflight complete before any
 * extraction write, then files are created exclusively under that staging directory. The caller
 * removes the whole staging directory in a success/failure finally block.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { gunzipSync } from 'node:zlib';

import { isUnsafeArchivePath } from './platform-deps-installer.js';
import type { ArchiveEntry } from './platform-deps-installer.js';

export type TarArchiveEntry = ArchiveEntry & {
  mode?: number;
  rawPath?: string;
};

const BLOCK_SIZE = 512;

function readByte(buffer: Buffer, offset: number, fallback = 0): number {
  return offset >= 0 && offset < buffer.length ? buffer.readUInt8(offset) : fallback;
}

function readSizeField(buffer: Buffer, offset: number, length: number): number {
  const first = readByte(buffer, offset);
  if ((first & 0x80) !== 0) {
    let value = 0;
    for (let index = 0; index < length; index += 1) {
      const byte = readByte(buffer, offset + index);
      value = value * 256 + (index === 0 ? byte & 0x7f : byte);
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

function readStrField(buffer: Buffer, offset: number, length: number): string {
  let raw = buffer.toString('utf8', offset, offset + length);
  const nul = raw.indexOf('\0');
  if (nul >= 0) raw = raw.slice(0, nul);
  return raw.replace(/ +$/, '');
}

function readModeField(header: Buffer): number {
  return readSizeField(header, 100, 8);
}

function decodeName(header: Buffer): string {
  const name = readStrField(header, 0, 100);
  const prefix = readStrField(header, 345, 155);
  return prefix === '' ? name : `${prefix}/${name}`;
}

function decodeMetaString(data: Buffer): string {
  return data.toString('utf8').replace(/[\0\n\r]+$/, '');
}

/** Parse `<length> <key>=<value>\n` PAX records without object-key prototype mutation. */
export function parsePaxRecords(blob: string | Buffer): Map<string, string> {
  const source = Buffer.isBuffer(blob) ? blob : Buffer.from(blob, 'utf8');
  const records = new Map<string, string>();
  let cursor = 0;
  while (cursor < source.length) {
    const space = source.indexOf(0x20, cursor);
    if (space < 0) break;
    const length = Number.parseInt(source.subarray(cursor, space).toString('ascii'), 10);
    if (!Number.isSafeInteger(length) || length <= 0 || cursor + length > source.length) break;
    const record = source.subarray(cursor, cursor + length);
    const equal = record.indexOf(0x3d);
    const keyOffset = space - cursor + 1;
    cursor += length;
    if (equal < keyOffset) continue;
    const key = record.subarray(keyOffset, equal).toString('utf8');
    let value = record.subarray(equal + 1);
    if (value[value.length - 1] === 0x0a) value = value.subarray(0, value.length - 1);
    if (key !== '') records.set(key, value.toString('utf8'));
  }
  return records;
}

/** Parse UStar plus PAX x/g and GNU L/K metadata; validation occurs after parsing. */
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

    const effectivePax = new Map(globalPaxRecords);
    if (paxPending) {
      for (const [key, value] of localPaxRecords) effectivePax.set(key, value);
    }
    const rawPath = effectivePax.get('path') ?? gnuLongName ?? decodeName(header);
    const entryPath = rawPath.replace(/\/+$/, '');
    const paxLink = effectivePax.get('linkpath');
    const headerLink = readStrField(header, 157, 100);
    const linkname = paxLink ?? gnuLongLink ?? (headerLink === '' ? undefined : headerLink);
    const mode = readModeField(header);

    if (typeflag === '0' || typeflag === '\0' || typeflag === '7') {
      entries.push({ path: entryPath, rawPath, type: 'file', content: Buffer.from(data), mode, linkname });
    } else if (typeflag === '5') {
      entries.push({ path: entryPath, rawPath, type: 'directory', mode, linkname });
    } else if (typeflag === '1') {
      entries.push({ path: entryPath, rawPath, type: 'hardlink', linkname });
    } else if (typeflag === '2') {
      entries.push({ path: entryPath, rawPath, type: 'symlink', linkname });
    } else {
      entries.push({ path: entryPath, rawPath, type: `unsupported:${typeflag.charCodeAt(0)}`, mode, linkname });
    }

    gnuLongName = undefined;
    gnuLongLink = undefined;
    paxPending = false;
    localPaxRecords = new Map<string, string>();
    offset = nextOffset;
  }
  return entries;
}

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

type PlannedEntry = {
  entry: TarArchiveEntry;
  archivePath: string;
  canonicalPath: string;
};

function validateCanonicalPaths(entries: readonly TarArchiveEntry[]): PlannedEntry[] {
  const seen = new Set<string>();
  const planned = entries.map((entry) => {
    const sourcePath = entry.rawPath ?? entry.path;
    if (isUnsafeArchivePath(sourcePath)) {
      throw new Error(`extractArchive 拒绝不安全路径：${sourcePath}`);
    }
    if (entry.type === 'symlink' || entry.type === 'hardlink' || entry.linkname !== undefined) {
      throw new Error(`extractArchive 拒绝链接条目：${entry.path}`);
    }
    if (entry.type !== 'file' && entry.type !== 'directory') {
      throw new Error(`extractArchive 拒绝不支持的 tar 条目类型：${entry.path}`);
    }
    const archivePath = normalizeArchivePath(sourcePath);
    const canonicalPath = canonicalArchivePath(sourcePath);
    if (canonicalPath === '') {
      throw new Error(`extractArchive 拒绝空路径：${sourcePath}`);
    }
    if (seen.has(canonicalPath)) {
      throw new Error(`extractArchive 拒绝重复 canonical path：${sourcePath}`);
    }
    seen.add(canonicalPath);
    return { entry, archivePath, canonicalPath };
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

function isWithinRoot(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function resolveChild(root: string, segments: readonly string[]): string {
  const target = path.resolve(root, ...segments);
  if (!isWithinRoot(root, target)) {
    throw new Error(`extractArchive 拒绝 extraction root 外路径：${segments.join('/')}`);
  }
  return target;
}

async function assertTargetsMissing(root: string, planned: readonly PlannedEntry[]): Promise<void> {
  const targets = new Set<string>();
  for (const item of planned) {
    const segments = item.archivePath.split('/');
    for (let depth = 1; depth <= segments.length; depth += 1) {
      targets.add(resolveChild(root, segments.slice(0, depth)));
    }
  }
  for (const target of targets) {
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is a validated archive-relative path beneath caller-owned private staging
      await fs.lstat(target);
      throw new Error(`extractArchive 拒绝既有目标冲突：${target}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
  }
}

async function ensureDirectoryPath(
  root: string,
  segments: readonly string[],
  createdDirectories: Set<string>,
): Promise<string> {
  let current = root;
  for (const segment of segments) {
    current = resolveChild(root, [...path.relative(root, current).split(path.sep).filter(Boolean), segment]);
    if (createdDirectories.has(current)) continue;
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- current is a single validated component beneath caller-owned private staging
    await fs.mkdir(current, { mode: 0o777 });
    createdDirectories.add(current);
  }
  return current;
}

async function writeFile(target: string, content: Buffer, mode: number | undefined): Promise<void> {
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  let failure: unknown;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is a validated archive-relative path beneath caller-owned private staging
    handle = await fs.open(target, 'wx', 0o666);
    await handle.writeFile(content);
    if (mode !== undefined) await handle.chmod(mode & 0o7777);
  } catch (error) {
    failure = error;
  }
  if (handle !== undefined) {
    try {
      await handle.close();
    } catch (error) {
      if (failure === undefined) failure = error;
    }
  }
  if (failure !== undefined) throw failure;
}

/**
 * Extract into a caller-owned private staging directory. Parsing, type/link validation, canonical
 * collision detection, file ancestor checks, and existing-target preflight happen before writes.
 */
export async function extractArchive(archive: Buffer, directory: string): Promise<void> {
  if (directory.includes('\0')) {
    throw new Error('extractArchive 拒绝包含 NUL 的 extraction root');
  }
  const root = path.resolve(directory);
  const planned = validateCanonicalPaths(parseArchive(gunzipSync(archive)));

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- root is the caller-provided private staging directory
  const rootStat = await fs.lstat(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error(`extractArchive 拒绝 extraction root 非目录或链接：${root}`);
  }
  await assertTargetsMissing(root, planned);

  const createdDirectories = new Set<string>();
  const directoryModes: Array<{ path: string; mode: number }> = [];
  for (const { entry, archivePath } of planned) {
    const segments = archivePath.split('/');
    if (entry.type === 'directory') {
      const target = await ensureDirectoryPath(root, segments, createdDirectories);
      if (entry.mode !== undefined) directoryModes.push({ path: target, mode: entry.mode });
      continue;
    }
    const parent = await ensureDirectoryPath(root, segments.slice(0, -1), createdDirectories);
    const target = resolveChild(root, [
      ...path.relative(root, parent).split(path.sep).filter(Boolean),
      segments.at(-1) as string,
    ]);
    const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content ?? '');
    await writeFile(target, content, entry.mode);
  }
  for (const directoryMode of directoryModes) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- directoryMode path was created by this extraction under caller-owned private staging
    await fs.chmod(directoryMode.path, directoryMode.mode & 0o7777);
  }
}
