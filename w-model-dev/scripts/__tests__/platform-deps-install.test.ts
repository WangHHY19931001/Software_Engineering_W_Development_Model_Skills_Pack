import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import { installVerifiedPackage, parseArgs } from '../cli/platform-deps-install.js';
import { extractArchive, parsePaxRecords, readArchiveEntries } from '../lib/platform-deps-tar.js';
import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(TEST_DIR, '../cli/platform-deps-install.ts');
const TAR_SOURCE = path.resolve(TEST_DIR, '../lib/platform-deps-tar.ts');

const PACKAGE_NAME = '@esbuild/linux-x64';
const PACKAGE_VERSION = '0.25.0';
const REGISTRY_HOST = 'registry.npmjs.org';

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

// ---------------------------------------------------------------------------
// 最小 tar writer（测试内）：UStar + pax 'x'/'g' + GNU long name/long link 'L'/'K'
// ---------------------------------------------------------------------------

const BLOCK = 512;

interface TarFileEntry {
  kind: 'file';
  path: string;
  content: Buffer | string;
  /** 写进主 header 的短名（配合 pax/GNU 长名测试）；默认 = path */
  headerName?: string;
  typeflag?: string;
  /** 写进主 header 的链接目标（配合 PAX linkpath 覆盖测试） */
  linkname?: string;
  /** 真实路径经 pax 扩展头（typeflag 'x' 或传给 paxType，默认 'x'）写出 */
  paxPath?: string;
  /** pax 扩展头 typeflag：'x'（默认）或 'g'（全局头） */
  paxType?: 'x' | 'g';
  /** 完整 pax 记录列表（多记录；有则覆盖 paxPath 的单记录构造） */
  paxRecords?: ReadonlyArray<[string, string]>;
  /** 经 GNU long name 'L' 的真实路径 */
  gnuLongName?: boolean;
  /** UStar mode（八进制字符串，默认 '644'） */
  mode?: string;
}

type TarTestEntry =
  | TarFileEntry
  | { kind: 'directory'; path: string; mode?: string }
  | { kind: 'symlink'; path: string; linkname: string }
  | { kind: 'hardlink'; path: string; linkname: string };

function writeField(buffer: Buffer, offset: number, length: number, value: string): void {
  buffer.fill(0, offset, offset + length);
  if (value.length > length) {
    throw new Error(`tar 字段过长: ${value}`);
  }
  buffer.write(value, offset, 'ascii');
}

function tarHeader(options: {
  name: string;
  typeflag: string;
  size: number;
  linkname?: string;
  mode?: string;
}): Buffer {
  const block = Buffer.alloc(BLOCK);
  writeField(block, 0, 100, options.name);
  writeField(block, 100, 8, options.mode ?? '644');
  writeField(block, 108, 8, '0');
  writeField(block, 116, 8, '0');
  writeField(block, 124, 12, options.size.toString(8));
  writeField(block, 136, 12, '0');
  writeField(block, 157, 100, options.linkname ?? '');
  writeField(block, 257, 6, 'ustar\0');
  writeField(block, 263, 2, '00');
  block[156] = options.typeflag.charCodeAt(0);
  let checksum = 0;
  for (let i = 0; i < BLOCK; i += 1) {
    checksum += i >= 148 && i < 156 ? 32 : block.readUInt8(i);
  }
  writeField(block, 148, 6, checksum.toString(8).padStart(6, '0'));
  block[154] = 0;
  block[155] = 32;
  return block;
}

function padded(data: Buffer): Buffer {
  const pad = (BLOCK - (data.length % BLOCK)) % BLOCK;
  return pad === 0 ? data : Buffer.concat([data, Buffer.alloc(pad)]);
}

/** 构造 pax 记录 `<len> <key>=<value>\n`，len 含整条记录含换行 */
function paxRecord(key: string, value: string): string {
  let length = Buffer.byteLength(key) + Buffer.byteLength(value) + 3;
  for (;;) {
    const record = `${length} ${key}=${value}\n`;
    if (Buffer.byteLength(record) === length) return record;
    length = Buffer.byteLength(record);
  }
}

/** 把多条 pax 记录拼进同一个 pax 扩展头 blob */
function paxRecordsBlob(records: ReadonlyArray<[string, string]>): Buffer {
  return Buffer.from(records.map(([key, value]) => paxRecord(key, value)).join(''));
}

function makeTar(entries: readonly TarTestEntry[]): Buffer {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    if (entry.kind === 'file') {
      const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content);
      if (entry.paxRecords !== undefined || entry.paxPath !== undefined) {
        const pax =
          entry.paxRecords !== undefined
            ? paxRecordsBlob(entry.paxRecords)
            : paxRecord('path', entry.paxPath as string);
        const paxType = entry.paxType ?? 'x';
        const paxName = paxType === 'g' ? 'GlobalHead.0.0' : 'PaxHeaders/0';
        const paxBytes = Buffer.from(pax);
        blocks.push(
          tarHeader({
            name: paxName,
            typeflag: paxType,
            size: paxBytes.length,
          }),
        );
        blocks.push(padded(paxBytes));
      }
      if (entry.gnuLongName === true) {
        const longName = Buffer.from(`${entry.path}\0`);
        blocks.push(
          tarHeader({
            name: '././@LongLink',
            typeflag: 'L',
            size: longName.length,
          }),
        );
        blocks.push(padded(longName));
      }
      blocks.push(
        tarHeader({
          name: entry.headerName ?? entry.path,
          typeflag: entry.typeflag ?? '0',
          size: content.length,
          linkname: entry.linkname,
          mode: entry.mode,
        }),
      );
      blocks.push(padded(content));
    } else if (entry.kind === 'directory') {
      blocks.push(
        tarHeader({
          name: entry.path,
          typeflag: '5',
          size: 0,
          mode: entry.mode,
        }),
      );
    } else if (entry.kind === 'symlink') {
      blocks.push(
        tarHeader({
          name: entry.path,
          typeflag: '2',
          size: 0,
          linkname: entry.linkname,
        }),
      );
    } else {
      blocks.push(
        tarHeader({
          name: entry.path,
          typeflag: '1',
          size: 0,
          linkname: entry.linkname,
        }),
      );
    }
  }
  blocks.push(Buffer.alloc(BLOCK), Buffer.alloc(BLOCK));
  return gzipSync(Buffer.concat(blocks));
}

function sha512(buffer: Buffer): string {
  return `sha512-${createHash('sha512').update(buffer).digest('base64')}`;
}

// ---------------------------------------------------------------------------
// fixture：合法 platform 包
// ---------------------------------------------------------------------------

interface FixtureOptions {
  entries?: readonly TarTestEntry[];
  packageName?: string;
  packageVersion?: string;
  /** 覆盖 package.json 内容（身份测试用） */
  packageJsonOverride?: string;
  /** 覆盖 tar 字节（SRI 篡改用），若不提供则由 entries 生成 */
  archiveOverride?: Buffer;
  lockfileIntegrityOverride?: string;
  resolvedOverride?: string;
}

interface Fixture {
  repoDir: string;
  archive: Buffer;
  tarPath: string;
  lockfilePath: string;
  packageName: string;
  packageVersion: string;
}

async function makeFixture(options: FixtureOptions = {}): Promise<Fixture> {
  const repoDir = await makeTempDir('platform-deps-repo-');
  const packageName = options.packageName ?? PACKAGE_NAME;
  const packageVersion = options.packageVersion ?? PACKAGE_VERSION;
  const packageJson = JSON.stringify({
    name: packageName,
    version: packageVersion,
    main: 'index.js',
  });
  const entries = options.entries ?? [
    { kind: 'directory' as const, path: 'package/' },
    {
      kind: 'file' as const,
      path: 'package/package.json',
      content: options.packageJsonOverride ?? packageJson,
    },
    {
      kind: 'file' as const,
      path: 'package/index.js',
      content: 'module.exports = { platform: true };\n',
    },
  ];
  const archive = options.archiveOverride ?? makeTar(entries);
  const tarPath = path.join(repoDir, 'pkg.tgz');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
  await fs.writeFile(tarPath, archive);

  const integrity = options.lockfileIntegrityOverride ?? sha512(archive);
  const resolved = options.resolvedOverride ?? `https://${REGISTRY_HOST}/${packageName}-${packageVersion}.tgz`;
  const lockfile = JSON.stringify({
    name: 'fixture-repo',
    version: '1.0.0',
    lockfileVersion: 3,
    packages: {
      '': { name: 'fixture-repo', version: '1.0.0' },
      [`node_modules/${packageName}`]: {
        version: packageVersion,
        resolved,
        integrity,
      },
    },
  });
  const lockfilePath = path.join(repoDir, 'package-lock.json');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
  await fs.writeFile(lockfilePath, lockfile, 'utf8');
  return {
    repoDir,
    archive,
    tarPath,
    lockfilePath,
    packageName,
    packageVersion,
  };
}

function runCli(args: string[]): {
  code: number | null;
  stdout: string;
  stderr: string;
} {
  const result = runSync(process.execPath, [tsxCli, SCRIPT, ...args], {});
  return {
    code: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

async function assertNoStagingLeftover(repoDir: string): Promise<void> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
  const leftovers = (await fs.readdir(repoDir)).filter((name) => name.startsWith('.platform-deps-staging-'));
  expect(leftovers).toEqual([]);
}

async function pathExistsLocal(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function installedTargetExists(fixture: Fixture): Promise<boolean> {
  try {
    await fs.access(path.join(fixture.repoDir, 'node_modules', fixture.packageName));
    return true;
  } catch {
    return false;
  }
}

const WINDOWS_EXTRACTION_REJECTION = /Windows.*安全|安全.*Windows|无法在 Windows/;

function isDescriptorChildPath(target: string): boolean {
  return target.includes('/proc/self/fd/') || target.includes('/dev/fd/');
}

async function descriptorParentMatches(target: string, expectedParent: string): Promise<boolean> {
  if (!isDescriptorChildPath(target)) return false;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is an injected descriptor child path under isolated test roots
    return path.resolve(await fs.realpath(path.dirname(target))) === path.resolve(expectedParent);
  } catch {
    return false;
  }
}

async function withPlatform<T>(platform: NodeJS.Platform, operation: () => Promise<T>): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value: platform,
  });
  try {
    return await operation();
  } finally {
    if (descriptor !== undefined) {
      Object.defineProperty(process, 'platform', descriptor);
    }
  }
}

async function isWindowsInstallRefusal(
  result: { code: number | null; stdout: string; stderr: string },
  fixture: Fixture,
): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
  expect(result.stdout).toContain('"errorCode":"install-error"');
  expect(`${result.stdout}\n${result.stderr}`).toMatch(WINDOWS_EXTRACTION_REJECTION);
  await expect(installedTargetExists(fixture)).resolves.toBe(false);
  await assertNoStagingLeftover(fixture.repoDir);
  return true;
}

describe('readArchiveEntries / extractArchive（自包含 tar 读取）', () => {
  it('extractArchive 不保留 staging/transfer path-based 写入方案', async () => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed test source path
    const source = await fs.readFile(TAR_SOURCE, 'utf8');
    expect(source).not.toMatch(/mkdtemp|copyFile|rename|transferTree|claimDirectoryNoReplace|transfer source|staging/i);
  });

  it('POSIX extraction 静态 seam 固定 descriptor-relative 写入与 identity rollback', async () => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed test source path
    const source = await fs.readFile(TAR_SOURCE, 'utf8');
    expect(source).toMatch(/const DIRECTORY_FLAG = .*\.O_DIRECTORY;/);
    expect(source).toMatch(/const NO_FOLLOW_FLAG = .*\.O_NOFOLLOW;/);
    expect(source).toContain('fsConstants.O_EXCL');
    expect(source).toContain('const childPath = descriptorChildPath(current.handle, segment)');
    const directoryCreate = source.indexOf('await fs.mkdir(childPath, { mode: 0o777 })');
    const directoryIdentity = source.indexOf('created = await fs.lstat(childPath, { bigint: true })', directoryCreate);
    const directoryOwnership = source.indexOf('owned.push({', directoryIdentity);
    const directoryOpen = source.indexOf('const next = await openDirectoryChild(current, segment)', directoryOwnership);
    expect(directoryCreate).toBeGreaterThan(-1);
    expect(directoryIdentity).toBeGreaterThan(directoryCreate);
    expect(directoryOwnership).toBeGreaterThan(directoryIdentity);
    expect(directoryOpen).toBeGreaterThan(directoryOwnership);

    const fileOpen = source.indexOf('fileHandle = await fs.open(target, FILE_OPEN_FLAGS, 0o666)');
    const fileOwnership = source.indexOf('owned.push({', fileOpen);
    const fileWrite = source.indexOf('await fileHandle.writeFile(content)', fileOwnership);
    expect(fileOpen).toBeGreaterThan(-1);
    expect(fileOwnership).toBeGreaterThan(fileOpen);
    expect(fileWrite).toBeGreaterThan(fileOwnership);

    const rollback = source.indexOf('for (const item of [...owned].reverse())');
    const rollbackIdentity = source.indexOf('!hasSameFileIdentity(current, item.identity)', rollback);
    const rollbackUnlink = source.indexOf('await fs.unlink(target)', rollback);
    const rollbackRmdir = source.indexOf('await fs.rmdir(target)', rollback);
    expect(rollback).toBeGreaterThan(-1);
    expect(rollbackIdentity).toBeGreaterThan(rollback);
    expect(rollbackUnlink).toBeGreaterThan(rollbackIdentity);
    expect(rollbackRmdir).toBeGreaterThan(rollbackIdentity);
  });

  it('PAX 记录使用安全键容器保留 __proto__ 键而不写入对象原型', () => {
    const records = parsePaxRecords(
      paxRecordsBlob([
        ['__proto__', 'pax-value'],
        ['path', 'package/safe.js'],
      ]),
    );

    expect(records.get('__proto__')).toBe('pax-value');
    expect(records.get('path')).toBe('package/safe.js');
  });

  it('PAX linkpath 以 Map 条目覆盖 symlink header 的 linkname', async () => {
    const archive = makeTar([
      {
        kind: 'file',
        path: 'package/linked',
        content: '',
        typeflag: '2',
        linkname: 'package/from-header',
        paxRecords: [['linkpath', 'package/from-pax']],
      },
    ]);

    await expect(readArchiveEntries(archive)).resolves.toMatchObject([
      { path: 'package/linked', type: 'symlink', linkname: 'package/from-pax' },
    ]);
  });

  it('解析常规文件与目录（路径/类型/内容忠实）', async () => {
    const archive = makeTar([
      { kind: 'directory', path: 'package/' },
      { kind: 'file', path: 'package/package.json', content: '{"name":"x"}' },
      { kind: 'file', path: 'package/lib/a.js', content: 'export 1;' },
    ]);
    const entries = await readArchiveEntries(archive);
    expect(entries.map((e) => [e.path, e.type])).toEqual([
      ['package', 'directory'],
      ['package/package.json', 'file'],
      ['package/lib/a.js', 'file'],
    ]);
    expect(Buffer.from(entries[1]?.content as Buffer).toString()).toBe('{"name":"x"}');
  });

  it('GNU long name（typeflag L）解析为完整路径', async () => {
    const longPath = `package/${'seg/'.repeat(25).slice(0, -1)}deep-file.js`;
    expect(longPath.length).toBeGreaterThan(100);
    const archive = makeTar([
      { kind: 'directory', path: 'package/' },
      {
        kind: 'file',
        path: longPath,
        headerName: 'package/x',
        gnuLongName: true,
        content: 'long',
      },
    ]);
    const entries = await readArchiveEntries(archive);
    expect(entries.map((e) => e.path)).toContain(longPath);
    const longFile = entries.find((e) => e.path === longPath);
    expect(longFile?.type).toBe('file');
    expect(Buffer.from(longFile?.content as Buffer).toString()).toBe('long');
  });

  it("pax 'x' 扩展头 `path` 覆盖主 header 短名", async () => {
    const longPath = `package/${'d/'.repeat(50)}file.js`;
    const archive = makeTar([
      { kind: 'directory', path: 'package/' },
      {
        kind: 'file',
        path: longPath,
        headerName: 'package/y',
        paxPath: longPath,
        content: 'pax',
      },
    ]);
    const entries = await readArchiveEntries(archive);
    const longFile = entries.find((e) => e.path === longPath);
    expect(longFile).toBeDefined();
    expect(Buffer.from(longFile?.content as Buffer).toString()).toBe('pax');
  });

  it('PAX UTF-8 字节长度按字节解析，非 ASCII 路径不丢失', async () => {
    const unicodePath = 'package/工具/入口.txt';
    const archive = makeTar([
      { kind: 'directory', path: 'package/' },
      {
        kind: 'file',
        path: unicodePath,
        headerName: 'package/x',
        paxPath: unicodePath,
        content: 'unicode',
      },
    ]);

    await expect(readArchiveEntries(archive)).resolves.toContainEqual(
      expect.objectContaining({
        path: unicodePath,
        rawPath: unicodePath,
        type: 'file',
      }),
    );
  });

  it("pax 'g' 全局扩展头（真实 typeflag 'g'）多记录持续作用于后续条目", async () => {
    const globPath = 'package/glob/from-g.txt';
    const archive = makeTar([
      { kind: 'directory', path: 'package/' },
      {
        kind: 'file',
        path: globPath,
        headerName: 'package/z',
        paxType: 'g',
        paxRecords: [
          ['comment', 'global-header'],
          ['path', globPath],
        ],
        content: 'g-data',
      },
      { kind: 'file', path: 'package/second-header.txt', content: 'second' },
    ]);
    const entries = await readArchiveEntries(archive);
    const globalEntries = entries.filter((e) => e.path === globPath);
    expect(globalEntries).toHaveLength(2);
    expect(Buffer.from(globalEntries[1]?.content as Buffer).toString()).toBe('second');
  });

  it('同一 pax header 多条记录：path（位于第二条）按 record 内相对偏移解析生效', async () => {
    // 复现 parsePaxRecords 用绝对 space 切相对 record 的 bug：第一条后的记录被静默丢弃
    const pathInPax = 'package/second-record.txt';
    const archive = makeTar([
      { kind: 'directory', path: 'package/' },
      {
        kind: 'file',
        path: pathInPax,
        headerName: 'package/x',
        paxRecords: [
          ['comment', 'first'],
          ['path', pathInPax],
        ],
        content: 'multi',
      },
    ]);
    const entries = await readArchiveEntries(archive);
    const found = entries.find((e) => e.path === pathInPax);
    expect(found).toBeDefined();
    expect(Buffer.from(found?.content as Buffer).toString()).toBe('multi');
  });

  it('解析 UStar mode（八进制）并在提取时保留文件与目录 mode', async () => {
    const archive = makeTar([
      { kind: 'directory', path: 'package/', mode: '700' },
      { kind: 'directory', path: 'package/bin/', mode: '711' },
      {
        kind: 'file',
        path: 'package/package.json',
        content: '{"name":"x","version":"1.0.0"}',
      },
      {
        kind: 'file',
        path: 'package/bin/tool.bin',
        content: 'BIN',
        mode: '755',
      },
    ]);
    const entries = await readArchiveEntries(archive);
    const tool = entries.find((e) => e.path === 'package/bin/tool.bin');
    // 跨平台：断言解析出的八进制 mode 值正确
    expect(tool?.mode).toBe(0o755);
    expect(tool?.type).toBe('file');

    const dir = await makeTempDir('platform-deps-mode-');
    if (process.platform === 'win32') {
      await expect(extractArchive(archive, dir)).rejects.toThrow(WINDOWS_EXTRACTION_REJECTION);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
      await expect(fs.readdir(dir)).resolves.toEqual([]);
      return;
    }
    await extractArchive(archive, dir);
    const written = path.join(dir, 'package/bin/tool.bin');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    expect(await fs.readFile(written, 'utf8')).toBe('BIN');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    expect((await fs.stat(path.join(dir, 'package'))).mode & 0o777).toBe(0o700);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    expect((await fs.stat(path.join(dir, 'package/bin'))).mode & 0o777).toBe(0o711);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    const stat = await fs.stat(written);
    // 该分支只在上面的 Windows 早退之后执行，因此仅覆盖支持 chmod 语义的平台（POSIX）。
    expect(stat.mode & 0o777).toBe(0o755);
  });

  it('解析 symlink 与 hardlink（类型 + linkname）', async () => {
    const archive = makeTar([
      { kind: 'directory', path: 'package/' },
      {
        kind: 'symlink',
        path: 'package/link.node',
        linkname: '/outside/native.node',
      },
      {
        kind: 'hardlink',
        path: 'package/hard.node',
        linkname: 'package/index.js',
      },
    ]);
    const entries = await readArchiveEntries(archive);
    expect(entries.find((e) => e.path === 'package/link.node')).toMatchObject({
      type: 'symlink',
      linkname: '/outside/native.node',
    });
    expect(entries.find((e) => e.path === 'package/hard.node')).toMatchObject({
      type: 'hardlink',
      linkname: 'package/index.js',
    });
  });

  it('extractArchive 按 package/... 写盘；symlink/hardlink 兜底拒绝且不部分写盘', async () => {
    const dir = await makeTempDir('platform-deps-extract-');
    const archive = makeTar([
      { kind: 'directory', path: 'package/' },
      { kind: 'file', path: 'package/package.json', content: '{"a":1}' },
      { kind: 'file', path: 'package/lib/deep.txt', content: 'deep' },
      { kind: 'symlink', path: 'package/bad.node', linkname: '/etc/passwd' },
    ]);
    await expect(extractArchive(archive, dir)).rejects.toThrow(/链接/);
    await expect(fs.access(path.join(dir, 'package', 'package.json'))).rejects.toThrow();
    await expect(fs.access(path.join(dir, 'package', 'lib', 'deep.txt'))).rejects.toThrow();
  });

  it('extractArchive 直接拒绝穿越路径且不会写出 extraction root', async () => {
    const dir = await makeTempDir('platform-deps-extract-traversal-');
    const escapedName = `escaped-${randomUUID()}.txt`;
    const escaped = path.resolve(dir, '..', escapedName);
    const archive = makeTar([
      {
        kind: 'file',
        path: `package/../../${escapedName}`,
        content: 'outside',
      },
    ]);

    await expect(extractArchive(archive, dir)).rejects.toThrow(/不安全路径/);
    await expect(fs.access(escaped)).rejects.toThrow();
  });

  it.each(['/absolute.txt', `C:\\absolute-${randomUUID()}.txt`])(
    'extractArchive 直接拒绝绝对路径 %s',
    async (archivePath) => {
      const dir = await makeTempDir('platform-deps-extract-absolute-');
      const archive = makeTar([{ kind: 'file', path: archivePath, content: 'blocked' }]);

      await expect(extractArchive(archive, dir)).rejects.toThrow(/不安全路径/);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
      await expect(fs.readdir(dir)).resolves.toEqual([]);
    },
  );

  it('extractArchive 直接拒绝携带 linkname 的非链接条目', async () => {
    const dir = await makeTempDir('platform-deps-extract-linkname-');
    const archive = makeTar([
      {
        kind: 'file',
        path: 'package/fake-link',
        typeflag: '0',
        linkname: '../outside',
        content: 'blocked',
      },
    ]);

    await expect(extractArchive(archive, dir)).rejects.toThrow(/链接/);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await expect(fs.readdir(dir)).resolves.toEqual([]);
  });

  it('extractArchive 直接拒绝 hardlink 且不会创建目标文件', async () => {
    const dir = await makeTempDir('platform-deps-extract-hardlink-');
    const archive = makeTar([
      {
        kind: 'hardlink',
        path: 'package/escape.node',
        linkname: '../../outside.node',
      },
    ]);

    await expect(extractArchive(archive, dir)).rejects.toThrow(/链接/);
    await expect(fs.access(path.resolve(dir, '..', 'outside.node'))).rejects.toThrow();
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await expect(fs.readdir(dir)).resolves.toEqual([]);
  });

  it.each([
    { archivePath: 'package//empty-segment', label: '空段' },
    { archivePath: 'package/../dotdot', label: '..' },
  ])('extractArchive 直接拒绝$label路径', async ({ archivePath }) => {
    const dir = await makeTempDir('platform-deps-extract-path-');
    const archive = makeTar([{ kind: 'file', path: archivePath, content: 'blocked' }]);

    await expect(extractArchive(archive, dir)).rejects.toThrow(/不安全路径/);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await expect(fs.readdir(dir)).resolves.toEqual([]);
  });

  it('extractArchive 直接拒绝 PAX NUL 路径', async () => {
    const dir = await makeTempDir('platform-deps-extract-nul-');
    const archive = makeTar([
      {
        kind: 'file',
        path: 'package/safe-name',
        paxRecords: [['path', `package/nul-${randomUUID()}\0outside`]],
        content: 'blocked',
      },
    ]);

    await expect(extractArchive(archive, dir)).rejects.toThrow(/不安全路径/);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await expect(fs.readdir(dir)).resolves.toEqual([]);
  });

  it('Windows archive extraction 明确 fail-closed 且在拒绝前不写盘', async () => {
    const dir = await makeTempDir('platform-deps-extract-windows-reject-');
    const archive = makeTar([
      { kind: 'directory', path: 'package/' },
      { kind: 'file', path: 'package/package.json', content: '{}' },
    ]);

    await expect(withPlatform('win32', () => extractArchive(archive, dir))).rejects.toThrow(
      /Windows.*安全|安全.*Windows|无法在 Windows/,
    );
    // The refusal must happen before creating the caller-selected root or staging tree.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await expect(fs.readdir(dir)).resolves.toEqual([]);
  });

  it('extractArchive 拒绝重复 canonical path 且不会部分写盘', async () => {
    const dir = await makeTempDir('platform-deps-extract-duplicate-');
    const archive = makeTar([
      { kind: 'file', path: 'package/duplicate.txt', content: 'first' },
      { kind: 'file', path: 'package\\duplicate.txt', content: 'second' },
    ]);

    await expect(extractArchive(archive, dir)).rejects.toThrow(/重复|duplicate/i);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await expect(fs.readdir(dir)).resolves.toEqual([]);
  });

  it.each([
    {
      label: '重复目录',
      entries: [
        { kind: 'directory' as const, path: 'package/repeated/' },
        { kind: 'directory' as const, path: 'package\\repeated' },
      ],
    },
    {
      label: '目录/文件冲突',
      entries: [
        { kind: 'directory' as const, path: 'package/conflict/' },
        {
          kind: 'file' as const,
          path: 'package\\conflict',
          content: 'blocked',
        },
      ],
    },
  ])('extractArchive 拒绝$label且不会部分写盘', async ({ entries }) => {
    const dir = await makeTempDir('platform-deps-extract-conflict-');

    await expect(extractArchive(makeTar(entries), dir)).rejects.toThrow(/重复|冲突|duplicate|conflict/i);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await expect(fs.readdir(dir)).resolves.toEqual([]);
  });

  it('extractArchive 在 FS I/O 前拒绝非相邻 file ancestor/descendant 冲突', async () => {
    const dir = await makeTempDir('platform-deps-extract-non-adjacent-');
    const archive = makeTar([
      { kind: 'file', path: 'package/prefix', content: 'file' },
      { kind: 'file', path: 'package/prefix-0', content: 'separator' },
      {
        kind: 'file',
        path: 'package/prefix/descendant.txt',
        content: 'blocked',
      },
    ]);

    await expect(withPlatform('linux', () => extractArchive(archive, dir))).rejects.toThrow(/文件\/目录路径冲突/);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await expect(fs.readdir(dir)).resolves.toEqual([]);
  });

  it('extractArchive 顶层文件 descriptor-relative open 失败时回滚已拥有文件', async () => {
    const dir = await makeTempDir('platform-deps-extract-file-rollback-');
    const archive = makeTar([
      { kind: 'file', path: 'first.txt', content: 'first' },
      { kind: 'file', path: 'second.txt', content: 'second' },
    ]);
    if (process.platform === 'win32') {
      await expect(extractArchive(archive, dir)).rejects.toThrow(WINDOWS_EXTRACTION_REJECTION);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
      await expect(fs.readdir(dir)).resolves.toEqual([]);
      return;
    }
    const originalOpen = fs.open;
    let injected = false;
    const interceptedOpen = async (...args: Parameters<typeof fs.open>): ReturnType<typeof fs.open> => {
      const target = typeof args[0] === 'string' ? args[0] : '';
      if (target.endsWith('/second.txt') && (await descriptorParentMatches(target, dir))) {
        injected = true;
        const error = new Error('simulated descriptor-relative top-level open failure') as NodeJS.ErrnoException;
        error.code = 'EIO';
        throw error;
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- original open is invoked only with isolated test fixture paths
      return originalOpen(...args);
    };
    fs.open = interceptedOpen as typeof fs.open;
    try {
      await expect(extractArchive(archive, dir)).rejects.toThrow(/open|EIO|失败/i);
    } finally {
      fs.open = originalOpen;
    }
    expect(injected).toBe(true);
    await expect(fs.access(path.join(dir, 'first.txt'))).rejects.toThrow();
    await expect(fs.access(path.join(dir, 'second.txt'))).rejects.toThrow();
  });

  it('Windows archive extraction 在任何 extraction handle 或写入前拒绝，不触碰既有目标', async () => {
    const dir = await makeTempDir('platform-deps-extract-open-failure-');
    const existing = path.join(dir, 'package', 'not-created.txt');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await fs.mkdir(path.dirname(existing), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await fs.writeFile(existing, 'pre-existing');
    const archive = makeTar([{ kind: 'file', path: 'package/not-created.txt', content: 'blocked' }]);
    const touched = new Set<string>();
    const original = {
      open: fs.open,
      mkdir: fs.mkdir,
      mkdtemp: fs.mkdtemp,
      writeFile: fs.writeFile,
      unlink: fs.unlink,
      rmdir: fs.rmdir,
      rm: fs.rm,
      chmod: fs.chmod,
    };
    const rejectTouch = (operation: string) => async (): Promise<never> => {
      touched.add(operation);
      throw new Error(`unexpected Windows extraction FS ${operation}`);
    };
    fs.open = rejectTouch('open') as typeof fs.open;
    fs.mkdir = rejectTouch('mkdir') as typeof fs.mkdir;
    fs.mkdtemp = rejectTouch('mkdtemp') as typeof fs.mkdtemp;
    fs.writeFile = rejectTouch('writeFile') as typeof fs.writeFile;
    fs.unlink = rejectTouch('unlink') as typeof fs.unlink;
    fs.rmdir = rejectTouch('rmdir') as typeof fs.rmdir;
    fs.rm = rejectTouch('rm') as typeof fs.rm;
    fs.chmod = rejectTouch('chmod') as typeof fs.chmod;
    try {
      await expect(withPlatform('win32', () => extractArchive(archive, dir))).rejects.toThrow(
        WINDOWS_EXTRACTION_REJECTION,
      );
    } finally {
      fs.open = original.open;
      fs.mkdir = original.mkdir;
      fs.mkdtemp = original.mkdtemp;
      fs.writeFile = original.writeFile;
      fs.unlink = original.unlink;
      fs.rmdir = original.rmdir;
      fs.rm = original.rm;
      fs.chmod = original.chmod;
    }
    expect([...touched]).toEqual([]);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await expect(fs.readFile(existing, 'utf8')).resolves.toBe('pre-existing');
  });

  it('extractArchive root identity 在 open 前被替换时拒绝且此前没有写入', async () => {
    const dir = await makeTempDir('platform-deps-extract-root-race-');
    if (process.platform === 'win32') {
      await expect(
        extractArchive(makeTar([{ kind: 'file', path: 'package/escaped.txt', content: 'blocked' }]), dir),
      ).rejects.toThrow(WINDOWS_EXTRACTION_REJECTION);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
      await expect(fs.readdir(dir)).resolves.toEqual([]);
      return;
    }
    const outside = await makeTempDir('platform-deps-extract-root-race-outside-');
    const escaped = path.join(outside, 'package', 'escaped.txt');
    const archive = makeTar([
      {
        kind: 'file',
        path: 'package/escaped.txt',
        content: 'must stay inside',
      },
    ]);
    const originalOpen = fs.open;
    const originalMkdtemp = fs.mkdtemp;
    const originalRm = fs.rm;
    let rootOpenSeen = false;
    let wroteBeforeRootOpen = false;
    let injected = false;
    const interceptedMkdtemp = async (...args: Parameters<typeof fs.mkdtemp>): ReturnType<typeof fs.mkdtemp> => {
      if (!rootOpenSeen) wroteBeforeRootOpen = true;
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- original mkdtemp is limited to isolated test roots
      return originalMkdtemp(...args);
    };
    const interceptedOpen = async (...args: Parameters<typeof fs.open>): ReturnType<typeof fs.open> => {
      const target = typeof args[0] === 'string' ? args[0] : '';
      if (!injected && target === dir) {
        rootOpenSeen = true;
        injected = true;
        await originalRm(dir, { recursive: true, force: true });
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture link target and path are isolated temporary roots
        await fs.symlink(outside, dir, 'dir');
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- original open is invoked only with isolated test fixture paths
      return originalOpen(...args);
    };
    fs.mkdtemp = interceptedMkdtemp as typeof fs.mkdtemp;
    fs.open = interceptedOpen as typeof fs.open;
    let extractionError: unknown;
    try {
      try {
        await extractArchive(archive, dir);
      } catch (error) {
        extractionError = error;
      }
    } finally {
      fs.open = originalOpen;
      fs.mkdtemp = originalMkdtemp;
    }

    expect(injected).toBe(true);
    expect(wroteBeforeRootOpen).toBe(false);
    expect(extractionError).toBeInstanceOf(Error);
    await expect(fs.access(escaped)).rejects.toThrow();
    // A root replacement must not leave a staging directory in the external target.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- outside is an isolated temporary root
    const outsideLeftovers = (await fs.readdir(outside)).filter((name) => name.startsWith('.platform-deps-extract-'));
    expect(outsideLeftovers).toEqual([]);
  });

  it('extractArchive 直接写入 descriptor root 且不创建 extraction workspace', async () => {
    const dir = await makeTempDir('platform-deps-extract-workspace-root-race-');
    const outside = await makeTempDir('platform-deps-extract-workspace-root-race-outside-');
    const archive = makeTar([
      { kind: 'directory', path: 'package/' },
      { kind: 'file', path: 'package/inside.txt', content: 'inside' },
    ]);
    if (process.platform === 'win32') {
      await expect(extractArchive(archive, dir)).rejects.toThrow(WINDOWS_EXTRACTION_REJECTION);
      return;
    }

    const originalMkdtemp = fs.mkdtemp;
    let workspaceRequested = false;
    const interceptedMkdtemp = async (...args: Parameters<typeof fs.mkdtemp>): ReturnType<typeof fs.mkdtemp> => {
      const prefix = typeof args[0] === 'string' ? args[0] : '';
      if (prefix.includes('.platform-deps-extract-')) {
        workspaceRequested = true;
        throw new Error('path-based extraction workspace is forbidden');
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- original mkdtemp is limited to isolated test roots
      return originalMkdtemp(...args);
    };
    fs.mkdtemp = interceptedMkdtemp as typeof fs.mkdtemp;
    try {
      await extractArchive(archive, dir);
    } finally {
      fs.mkdtemp = originalMkdtemp;
    }

    expect(workspaceRequested).toBe(false);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- outside is an isolated temporary root
    const outsideLeftovers = (await fs.readdir(outside)).filter((name) => name.startsWith('.platform-deps-extract-'));
    expect(outsideLeftovers).toEqual([]);
    await expect(fs.access(path.join(outside, 'package', 'inside.txt'))).rejects.toThrow();
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- written is below the isolated extraction root
    await expect(fs.readFile(path.join(dir, 'package', 'inside.txt'), 'utf8')).resolves.toBe('inside');
  });

  it('extractArchive descriptor-relative file open 返回 ELOOP 时 fail-closed', async () => {
    const dir = await makeTempDir('platform-deps-extract-open-race-');
    const outside = await makeTempDir('platform-deps-extract-open-race-outside-');
    const escaped = path.join(outside, 'race.txt');
    const archive = makeTar([
      { kind: 'directory', path: 'package/' },
      { kind: 'file', path: 'package/race.txt', content: 'must stay inside' },
    ]);
    if (process.platform === 'win32') {
      await expect(extractArchive(archive, dir)).rejects.toThrow(WINDOWS_EXTRACTION_REJECTION);
      await expect(fs.access(escaped)).rejects.toThrow();
      return;
    }
    const originalOpen = fs.open;
    let injected = false;
    const interceptedOpen = async (...args: Parameters<typeof fs.open>): ReturnType<typeof fs.open> => {
      const target = typeof args[0] === 'string' ? args[0] : '';
      if (!injected && isDescriptorChildPath(target) && target.endsWith('/race.txt')) {
        injected = true;
        // This is the real descriptor-relative child-open point. Refuse the
        // operation to model a no-follow boundary race and require fail-closed behavior.
        const error = new Error('simulated descriptor-relative open race') as NodeJS.ErrnoException;
        error.code = 'ELOOP';
        throw error;
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- original open is invoked only with isolated test fixture paths
      return originalOpen(...args);
    };
    fs.open = interceptedOpen as typeof fs.open;
    let extractionError: unknown;
    try {
      try {
        await extractArchive(archive, dir);
      } catch (error) {
        extractionError = error;
      }
    } finally {
      fs.open = originalOpen;
    }

    expect(injected).toBe(true);
    expect(extractionError).toBeInstanceOf(Error);
    await expect(fs.access(escaped)).rejects.toThrow();
  });

  it('extractArchive descriptor-relative mkdir 失败时不留 root 或外部条目', async () => {
    const dir = await makeTempDir('platform-deps-extract-mkdir-failure-');
    const outside = await makeTempDir('platform-deps-extract-mkdir-failure-outside-');
    const archive = makeTar([{ kind: 'file', path: 'package/nested/file.txt', content: 'blocked' }]);
    if (process.platform === 'win32') {
      await expect(extractArchive(archive, dir)).rejects.toThrow(WINDOWS_EXTRACTION_REJECTION);
      return;
    }
    const originalMkdir = fs.mkdir;
    let injected = false;
    const interceptedMkdir = async (...args: Parameters<typeof fs.mkdir>): ReturnType<typeof fs.mkdir> => {
      const target = typeof args[0] === 'string' ? args[0] : '';
      if (!injected && isDescriptorChildPath(target) && target.endsWith('/package')) {
        injected = true;
        const error = new Error('simulated descriptor-relative mkdir failure') as NodeJS.ErrnoException;
        error.code = 'EIO';
        throw error;
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- original mkdir is limited to isolated test roots
      return originalMkdir(...args);
    };
    fs.mkdir = interceptedMkdir as typeof fs.mkdir;
    try {
      await expect(extractArchive(archive, dir)).rejects.toThrow(/mkdir|EIO|失败/i);
    } finally {
      fs.mkdir = originalMkdir;
    }
    expect(injected).toBe(true);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- dir is an isolated extraction root
    await expect(fs.readdir(dir)).resolves.toEqual([]);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- outside is an isolated temporary root
    await expect(fs.readdir(outside)).resolves.toEqual([]);
  });

  it('extractArchive 文件创建后 write 失败时回滚 descriptor-owned 条目', async () => {
    const dir = await makeTempDir('platform-deps-extract-write-failure-');
    const archive = makeTar([{ kind: 'file', path: 'package/write-failure.txt', content: 'blocked' }]);
    if (process.platform === 'win32') {
      await expect(extractArchive(archive, dir)).rejects.toThrow(WINDOWS_EXTRACTION_REJECTION);
      return;
    }
    const originalOpen = fs.open;
    let injected = false;
    const interceptedOpen = async (...args: Parameters<typeof fs.open>): ReturnType<typeof fs.open> => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- original open is limited to isolated test roots and descriptor paths
      const handle = await originalOpen(...args);
      const target = typeof args[0] === 'string' ? args[0] : '';
      if (
        !injected &&
        target.endsWith('/write-failure.txt') &&
        (await descriptorParentMatches(target, path.join(dir, 'package')))
      ) {
        injected = true;
        handle.writeFile = async () => {
          const error = new Error('simulated write failure after create') as NodeJS.ErrnoException;
          error.code = 'EIO';
          throw error;
        };
      }
      return handle;
    };
    fs.open = interceptedOpen as typeof fs.open;
    try {
      await expect(extractArchive(archive, dir)).rejects.toThrow(/write|EIO|失败/i);
    } finally {
      fs.open = originalOpen;
    }
    expect(injected).toBe(true);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- dir is an isolated extraction root
    await expect(fs.readdir(dir)).resolves.toEqual([]);
  });

  it('extractArchive 文件创建后 close 失败时回滚 descriptor-owned 条目', async () => {
    const dir = await makeTempDir('platform-deps-extract-close-failure-');
    const archive = makeTar([{ kind: 'file', path: 'package/close.txt', content: 'close' }]);
    if (process.platform === 'win32') {
      await expect(extractArchive(archive, dir)).rejects.toThrow(WINDOWS_EXTRACTION_REJECTION);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
      await expect(fs.readdir(dir)).resolves.toEqual([]);
      return;
    }
    const originalOpen = fs.open;
    let injected = false;
    const interceptedOpen = async (...args: Parameters<typeof fs.open>): ReturnType<typeof fs.open> => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- original open is invoked only with isolated test fixture paths
      const handle = await originalOpen(...args);
      const target = typeof args[0] === 'string' ? args[0] : '';
      if (
        !injected &&
        target.endsWith('/close.txt') &&
        (await descriptorParentMatches(target, path.join(dir, 'package')))
      ) {
        injected = true;
        const actualClose = handle.close.bind(handle);
        handle.close = async () => {
          await actualClose();
          throw new Error('simulated close failure');
        };
      }
      return handle;
    };
    fs.open = interceptedOpen as typeof fs.open;
    try {
      await expect(extractArchive(archive, dir)).rejects.toThrow(/close|关闭/i);
    } finally {
      fs.open = originalOpen;
    }
    expect(injected).toBe(true);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- dir is an isolated extraction root
    await expect(fs.readdir(dir)).resolves.toEqual([]);
  });

  it('extractArchive 顶层文件父目录 close 失败时回滚已创建文件', async () => {
    const dir = await makeTempDir('platform-deps-extract-top-level-close-failure-');
    const archive = makeTar([{ kind: 'file', path: 'close.txt', content: 'close' }]);
    if (process.platform === 'win32') {
      await expect(extractArchive(archive, dir)).rejects.toThrow(WINDOWS_EXTRACTION_REJECTION);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
      await expect(fs.readdir(dir)).resolves.toEqual([]);
      return;
    }
    const originalOpen = fs.open;
    let injected = false;
    const interceptedOpen = async (...args: Parameters<typeof fs.open>): ReturnType<typeof fs.open> => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- original open is invoked only with isolated test fixture paths
      const handle = await originalOpen(...args);
      const target = typeof args[0] === 'string' ? args[0] : '';
      if (!injected && target === dir) {
        injected = true;
        const actualClose = handle.close.bind(handle);
        handle.close = async () => {
          await actualClose();
          throw new Error('simulated top-level parent close failure');
        };
      }
      return handle;
    };
    fs.open = interceptedOpen as typeof fs.open;
    try {
      await expect(extractArchive(archive, dir)).rejects.toThrow(/close|关闭/i);
    } finally {
      fs.open = originalOpen;
    }
    expect(injected).toBe(true);
    await expect(fs.access(path.join(dir, 'close.txt'))).rejects.toThrow();
  });

  it('extractArchive 在最终提交前父目录变为 junction/symlink 时 fail-closed', async () => {
    const dir = await makeTempDir('platform-deps-extract-race-');
    if (process.platform === 'win32') {
      await expect(
        extractArchive(makeTar([{ kind: 'file', path: 'package/race.txt', content: 'blocked' }]), dir),
      ).rejects.toThrow(WINDOWS_EXTRACTION_REJECTION);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
      await expect(fs.readdir(dir)).resolves.toEqual([]);
      return;
    }
    const outside = await makeTempDir('platform-deps-extract-race-outside-');
    const escaped = path.join(outside, 'race.txt');
    const archive = makeTar([
      { kind: 'directory', path: 'package/' },
      { kind: 'file', path: 'package/race.txt', content: 'must stay inside' },
    ]);

    const originalOpen = fs.open;
    let injected = false;
    const interceptedOpen = async (...args: Parameters<typeof fs.open>): ReturnType<typeof fs.open> => {
      const target = typeof args[0] === 'string' ? args[0] : '';
      const isParentOpen = target.endsWith(path.join('package'));
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
      const handle = await originalOpen(...args);
      if (!injected && isParentOpen) {
        injected = true;
        await fs.rm(target, { recursive: true, force: true });
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
        await fs.symlink(outside, target, process.platform === 'win32' ? 'junction' : 'dir');
      }
      return handle;
    };
    fs.open = interceptedOpen as typeof fs.open;
    let extractionError: unknown;
    try {
      try {
        await extractArchive(archive, dir);
      } catch (error) {
        extractionError = error;
      }
    } finally {
      fs.open = originalOpen;
    }

    // The race is injected between ancestor validation and file opening. It must never write outside.
    expect(injected).toBe(true);
    expect(extractionError).toBeInstanceOf(Error);
    await expect(fs.access(escaped)).rejects.toThrow();
  });

  it('extractArchive 拒绝既有 symlink ancestor 且不会写到链接目标', async () => {
    const dir = await makeTempDir('platform-deps-extract-ancestor-');
    const outside = await makeTempDir('platform-deps-extract-outside-');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await fs.symlink(outside, path.join(dir, 'package'));
    const archive = makeTar([{ kind: 'file', path: 'package/escaped.txt', content: 'outside' }]);

    await expect(extractArchive(archive, dir)).rejects.toThrow(
      process.platform === 'win32' ? WINDOWS_EXTRACTION_REJECTION : /符号链接|symlink|ancestor/i,
    );
    await expect(fs.access(path.join(outside, 'escaped.txt'))).rejects.toThrow();
  });

  it('extractArchive 多 top-level 部分提交失败时回滚已拥有条目', async () => {
    const dir = await makeTempDir('platform-deps-extract-rollback-');
    const archive = makeTar([
      { kind: 'directory', path: 'first/' },
      { kind: 'file', path: 'first/a.txt', content: 'a' },
      { kind: 'directory', path: 'second/' },
      { kind: 'file', path: 'second/b.txt', content: 'b' },
    ]);
    if (process.platform === 'win32') {
      await expect(extractArchive(archive, dir)).rejects.toThrow(WINDOWS_EXTRACTION_REJECTION);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
      await expect(fs.readdir(dir)).resolves.toEqual([]);
      return;
    }
    const originalOpen = fs.open;
    let injected = false;
    const interceptedOpen = async (...args: Parameters<typeof fs.open>): ReturnType<typeof fs.open> => {
      const target = typeof args[0] === 'string' ? args[0] : '';
      if (target.endsWith('/b.txt') && (await descriptorParentMatches(target, path.join(dir, 'second')))) {
        injected = true;
        const error = new Error('simulated second top-level descriptor open failure') as NodeJS.ErrnoException;
        error.code = 'EIO';
        throw error;
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- original open is limited to isolated test roots and descriptor paths
      return originalOpen(...args);
    };
    fs.open = interceptedOpen as typeof fs.open;
    try {
      await expect(extractArchive(archive, dir)).rejects.toThrow(/open|EIO|失败/i);
    } finally {
      fs.open = originalOpen;
    }
    expect(injected).toBe(true);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await expect(fs.readdir(dir)).resolves.toEqual([]);
  });
});

describe('parseArgs（CLI 参数契约）', () => {
  /** parseArgs 按真实 process.argv 语义（argv[0]=node、argv[1]=脚本）解析，测试补前缀 */
  const asArgv = (args: string[]): string[] => ['node', SCRIPT, ...args];
  const base = ['--lockfile=C:\\abs\\package-lock.json', '--package=@esbuild/linux-x64'];

  it('解析合法参数并给默认 registry allowlist', () => {
    const parsed = parseArgs(asArgv(base));
    expect(parsed).toMatchObject({
      help: false,
      lockfile: 'C:\\abs\\package-lock.json',
      packages: ['@esbuild/linux-x64'],
      registryHosts: [REGISTRY_HOST],
      tarballs: [],
    });
  });

  it('支持重复 --package、命名/兜底 --tarball、--registry-host', () => {
    const parsed = parseArgs(
      asArgv([
        ...base,
        '--package=@rolldown/binding-win32-x64-msvc',
        '--tarball=C:\\tmp\\x.tgz',
        '--tarball=@esbuild/linux-x64=C:\\tmp\\esbuild.tgz',
        '--registry-host=registry.yarnpkg.com',
      ]),
    );
    if (parsed.help) throw new Error('unexpected help');
    expect(parsed.packages).toEqual(['@esbuild/linux-x64', '@rolldown/binding-win32-x64-msvc']);
    expect(parsed.registryHosts).toEqual(['registry.yarnpkg.com']);
    expect(parsed.tarballs).toEqual([
      { path: 'C:\\tmp\\x.tgz' },
      { name: '@esbuild/linux-x64', path: 'C:\\tmp\\esbuild.tgz' },
    ]);
  });

  it.each([
    { args: [], why: '缺少全部参数' },
    { args: ['--package=@esbuild/linux-x64'], why: '缺少 --lockfile' },
    { args: ['--lockfile=C:\\a\\package-lock.json'], why: '缺少 --package' },
    { args: [...base, '--bogus=1'], why: '未知参数' },
    {
      args: ['--lockfile=C:\\a\\package-lock.json', '--package'],
      why: '--package 缺 = 取值',
    },
    {
      args: ['--lockfile=relative\\lock.json', '--package=x'],
      why: 'lockfile 非绝对路径',
    },
    { args: ['--lockfile=C:\\a\\lock.json', '--package='], why: '空包名' },
    {
      args: ['--lockfile=C:\\a\\lock.json', '--package=../../escape'],
      why: '包名路径穿越',
    },
  ])('拒绝非法参数：$why', ({ args }) => {
    expect(() => parseArgs(asArgv(args))).toThrow();
  });

  it('--help 返回 help 分支', () => {
    expect(parseArgs(asArgv(['--help'])).help).toBe(true);
  });
});

describe('installVerifiedPackage（受控安装）', () => {
  const realIo = {
    extractArchive,
    removeTemporaryDirectory: async (dir: string) => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };

  it('验证通过的包原子安装到 node_modules/<name>，staging 清理', async () => {
    const repoDir = await makeTempDir('platform-deps-install-');
    const archive = makeTar([
      { kind: 'directory', path: 'package/' },
      {
        kind: 'file',
        path: 'package/package.json',
        content: '{"name":"x","version":"1.0.0"}',
      },
      { kind: 'file', path: 'package/custom.bin', content: 'BINARY' },
    ]);
    const installation = installVerifiedPackage({
      archive,
      repoRoot: repoDir,
      packageName: 'x',
      version: '1.0.0',
      ...realIo,
    });
    if (process.platform === 'win32') {
      await expect(installation).rejects.toMatchObject({
        code: 'extract-failed',
      });
      await expect(fs.access(path.join(repoDir, 'node_modules', 'x'))).rejects.toThrow();
      await assertNoStagingLeftover(repoDir);
      return;
    }
    const target = await installation;
    expect(target).toBe(path.join(repoDir, 'node_modules', 'x'));
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    expect(await fs.readFile(path.join(repoDir, 'node_modules', 'x', 'custom.bin'), 'utf8')).toBe('BINARY');
    await assertNoStagingLeftover(repoDir);
  });

  it('目标已存在且是本包 → 替换旧目录，成功后删除备份', async () => {
    const repoDir = await makeTempDir('platform-deps-install-replace-');
    const archive = makeTar([
      {
        kind: 'file',
        path: 'package/package.json',
        content: '{"name":"x","version":"1.0.0"}',
      },
      { kind: 'file', path: 'package/new.txt', content: 'new' },
    ]);
    const target = path.join(repoDir, 'node_modules', 'x');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await fs.mkdir(path.dirname(target), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await fs.mkdir(target, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await fs.writeFile(path.join(target, 'package.json'), '{"name":"x","version":"1.0.0"}', 'utf8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await fs.writeFile(path.join(target, 'old.txt'), 'old', 'utf8');

    const installation = installVerifiedPackage({
      archive,
      repoRoot: repoDir,
      packageName: 'x',
      version: '1.0.0',
      ...realIo,
    });
    if (process.platform === 'win32') {
      await expect(installation).rejects.toMatchObject({
        code: 'extract-failed',
      });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
      expect(await fs.readFile(path.join(target, 'old.txt'), 'utf8')).toBe('old');
      await assertNoStagingLeftover(repoDir);
      return;
    }
    await installation;
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    expect(await fs.readFile(path.join(target, 'new.txt'), 'utf8')).toBe('new');
    await expect(fs.access(path.join(target, 'old.txt'))).rejects.toThrow();
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    const backups = (await fs.readdir(repoDir)).filter((name) => name.includes('.wm-backup-'));
    expect(backups).toEqual([]);
  });

  it('目标已存在但非本包 → install-conflict 失败且不动 node_modules', async () => {
    const repoDir = await makeTempDir('platform-deps-install-conflict-');
    const archive = makeTar([
      {
        kind: 'file',
        path: 'package/package.json',
        content: '{"name":"x","version":"1.0.0"}',
      },
    ]);
    const target = path.join(repoDir, 'node_modules', 'x');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await fs.mkdir(target, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await fs.writeFile(path.join(target, 'package.json'), '{"name":"other","version":"9.9.9"}', 'utf8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await fs.writeFile(path.join(target, 'keep.txt'), 'keep', 'utf8');

    const installation = installVerifiedPackage({
      archive,
      repoRoot: repoDir,
      packageName: 'x',
      version: '1.0.0',
      ...realIo,
    });
    if (process.platform === 'win32') {
      await expect(installation).rejects.toMatchObject({
        code: 'extract-failed',
      });
    } else {
      await expect(installation).rejects.toMatchObject({
        code: 'install-conflict',
      });
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    expect(await fs.readFile(path.join(target, 'keep.txt'), 'utf8')).toBe('keep');
    await assertNoStagingLeftover(repoDir);
  });

  it('extractArchive 抛错（链接条目）→ 失败且清理 staging、不污染 node_modules', async () => {
    const repoDir = await makeTempDir('platform-deps-install-extract-');
    const archive = makeTar([
      { kind: 'directory', path: 'package/' },
      {
        kind: 'file',
        path: 'package/package.json',
        content: '{"name":"x","version":"1.0.0"}',
      },
      { kind: 'symlink', path: 'package/bad.node', linkname: '/etc/passwd' },
    ]);
    await expect(
      installVerifiedPackage({
        archive,
        repoRoot: repoDir,
        packageName: 'x',
        version: '1.0.0',
        ...realIo,
      }),
    ).rejects.toMatchObject({ code: 'extract-failed' });
    await expect(installedTargetExists({ repoDir, packageName: 'x' } as Fixture)).resolves.toBe(false);
    // extract 在创建 node_modules 之前失败，目标目录与 staging 均不残留
    const hasNodeModules = await pathExistsLocal(path.join(repoDir, 'node_modules'));
    if (hasNodeModules) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
      expect(await fs.readdir(path.join(repoDir, 'node_modules'))).toEqual([]);
    }
    await assertNoStagingLeftover(repoDir);
  });
});

describe('CLI 子进程 exit 契约（离线，--tarball 注入）', () => {
  async function runInstall(
    fixture: Fixture,
    extra: string[] = [],
  ): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return runCli([
      `--lockfile=${fixture.lockfilePath}`,
      `--package=${fixture.packageName}`,
      `--tarball=${fixture.tarPath}`,
      ...extra,
    ]);
  }

  it('退出码 0：合法包验证并安装到隔离 tmp 的 node_modules', async () => {
    const fixture = await makeFixture();
    const result = await runInstall(fixture);
    if (await isWindowsInstallRefusal(result, fixture)) return;
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(`ok ${fixture.packageName}@${fixture.packageVersion}`);
    expect(result.stdout).toContain('"exitCode":0');
    const target = path.join(fixture.repoDir, 'node_modules', fixture.packageName);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    expect(await fs.readFile(path.join(target, 'index.js'), 'utf8')).toContain('platform');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    expect(JSON.parse(await fs.readFile(path.join(target, 'package.json'), 'utf8'))).toMatchObject({
      name: fixture.packageName,
      version: fixture.packageVersion,
    });
    await assertNoStagingLeftover(fixture.repoDir);
  });

  it('退出码 0：--tarball=<名字>=<路径> 命名注入同样走通', async () => {
    const fixture = await makeFixture();
    const result = runCli([
      `--lockfile=${fixture.lockfilePath}`,
      `--package=${fixture.packageName}`,
      `--tarball=${fixture.packageName}=${fixture.tarPath}`,
    ]);
    if (await isWindowsInstallRefusal(result, fixture)) return;
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    await expect(installedTargetExists(fixture)).resolves.toBe(true);
  });

  it('退出码 0：GNU long name 长路径文件在安装后落在原始路径', async () => {
    const longPath = `package/${'deep/'.repeat(30)}native.node`;
    const fixture = await makeFixture({
      entries: [
        { kind: 'directory', path: 'package/' },
        {
          kind: 'file',
          path: 'package/package.json',
          content: '{"name":"x","version":"1.0.0","main":"index.js"}',
        },
        {
          kind: 'file',
          path: 'package/index.js',
          content: 'module.exports = true;\n',
        },
        {
          kind: 'file',
          path: longPath,
          headerName: 'package/x',
          gnuLongName: true,
          content: 'LONG',
        },
      ],
      packageName: 'x',
      packageVersion: '1.0.0',
    });
    const longFile = longPath.replace(/^package\//, '');
    const result = await runInstall(fixture);
    if (await isWindowsInstallRefusal(result, fixture)) return;
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    const installedLong = path.join(fixture.repoDir, 'node_modules', 'x', longFile);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    expect(await fs.readFile(installedLong, 'utf8')).toBe('LONG');
  });

  it('退出码 0：pax `path` 长路径文件在安装后落在原始路径', async () => {
    const longPath = `package/${'nested/'.repeat(40)}file.data`;
    const fixture = await makeFixture({
      entries: [
        { kind: 'directory', path: 'package/' },
        {
          kind: 'file',
          path: 'package/package.json',
          content: '{"name":"x","version":"1.0.0","main":"index.js"}',
        },
        {
          kind: 'file',
          path: 'package/index.js',
          content: 'module.exports = true;\n',
        },
        {
          kind: 'file',
          path: longPath,
          headerName: 'package/y',
          paxPath: longPath,
          content: 'PAX',
        },
      ],
      packageName: 'x',
      packageVersion: '1.0.0',
    });
    const result = await runInstall(fixture);
    if (await isWindowsInstallRefusal(result, fixture)) return;
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    const installedLong = path.join(fixture.repoDir, 'node_modules', 'x', longPath.replace(/^package\//, ''));
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    expect(await fs.readFile(installedLong, 'utf8')).toBe('PAX');
  });

  it('退出码 0：无 main、声明 bin、纯二进制制品 → 弹性 loadModule 制品校验通过且不触网', async () => {
    // @esbuild/linux-x64 形态：无 main/exports/index，bin 指向可执行二进制、非 JS
    const fixture = await makeFixture({
      entries: [
        { kind: 'directory', path: 'package/' },
        {
          kind: 'file' as const,
          path: 'package/package.json',
          content: JSON.stringify({
            name: PACKAGE_NAME,
            version: PACKAGE_VERSION,
            os: ['linux'],
            cpu: ['x64'],
            bin: { esbuild: 'bin/esbuild' },
          }),
        },
        {
          kind: 'file' as const,
          path: 'package/bin/esbuild',
          content: Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]),
          mode: '755',
        },
      ],
    });
    const result = await runInstall(fixture);
    if (await isWindowsInstallRefusal(result, fixture)) return;
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain(`ok ${PACKAGE_NAME}@${PACKAGE_VERSION}`);
    const target = path.join(fixture.repoDir, 'node_modules', PACKAGE_NAME);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    const binBytes = await fs.readFile(path.join(target, 'bin', 'esbuild'));
    expect([...binBytes.subarray(0, 4)]).toEqual([0x7f, 0x45, 0x4c, 0x46]);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    expect(JSON.parse(await fs.readFile(path.join(target, 'package.json'), 'utf8'))).toMatchObject({
      name: PACKAGE_NAME,
      version: PACKAGE_VERSION,
    });
    await assertNoStagingLeftover(fixture.repoDir);
  });

  it('退出码 0：main 指向 .node 的 binding 包 → 弹性 loadModule 降级制品校验通过且不触网', async () => {
    // @rolldown/binding-* 形态：main 指向 .node，非 JS 入口，动态 import 不可行（ERR_UNKNOWN_FILE_EXTENSION）
    const rolldownName = '@rolldown/binding-win32-x64-msvc';
    const rolldownVersion = '0.15.0';
    const nodeMain = 'rolldown-binding.win32-x64-msvc.node';
    const fixture = await makeFixture({
      entries: [
        { kind: 'directory', path: 'package/' },
        {
          kind: 'file' as const,
          path: 'package/package.json',
          content: JSON.stringify({
            name: rolldownName,
            version: rolldownVersion,
            main: nodeMain,
          }),
        },
        {
          kind: 'file' as const,
          path: `package/${nodeMain}`,
          content: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]),
        },
      ],
      packageName: rolldownName,
      packageVersion: rolldownVersion,
    });
    const result = await runInstall(fixture);
    if (await isWindowsInstallRefusal(result, fixture)) return;
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    await expect(installedTargetExists(fixture)).resolves.toBe(true);
    await expect(
      fs.access(path.join(fixture.repoDir, 'node_modules', rolldownName, nodeMain)),
    ).resolves.toBeUndefined();
    await assertNoStagingLeftover(fixture.repoDir);
  });

  it('退出码 0：main 逃逸包目录的声明被忽略，不加载包外文件', async () => {
    // 复现 loadModule 无 isWithin 守卫的 bug：main='../../x.js' 指向包外
    // → 旧代码会 isFile 为真并 import() 包外文件（隔离验证被打破）；新代码忽略该声明。
    const evilName = `escape-evil-${randomUUID()}.js`;
    const evilPath = path.join(os.tmpdir(), evilName);
    const fixture = await makeFixture({
      entries: [
        { kind: 'directory', path: 'package/' },
        {
          kind: 'file' as const,
          path: 'package/package.json',
          content: JSON.stringify({
            name: 'x',
            version: '1.0.0',
            main: `../../${evilName}`,
          }),
        },
        {
          kind: 'file' as const,
          path: 'package/data.txt',
          content: 'artifact',
        },
      ],
      packageName: 'x',
      packageVersion: '1.0.0',
    });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await fs.writeFile(evilPath, 'throw new Error("ESCAPED_LOAD");\n', 'utf8');
    try {
      const result = await runInstall(fixture);
      if (await isWindowsInstallRefusal(result, fixture)) return;
      expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(result.stderr).not.toContain('ESCAPED_LOAD');
      await expect(installedTargetExists(fixture)).resolves.toBe(true);
      await assertNoStagingLeftover(fixture.repoDir);
    } finally {
      await fs.rm(evilPath, { force: true });
    }
  });

  it('退出码 0：main 无扩展名按 Node 解析补 .js 命中，不再是制品硬拒', async () => {
    // 复现 path.extname 误判的 bug：main:'./lib/entry'（缺扩展名）被归入制品，
    // verifyPackageArtifacts 要求字面 ./lib/entry 存在 → 硬失败（exit 1）。
    const fixture = await makeFixture({
      entries: [
        { kind: 'directory', path: 'package/' },
        {
          kind: 'file' as const,
          path: 'package/package.json',
          content: '{"name":"x","version":"1.0.0","main":"./lib/entry"}',
        },
        {
          kind: 'file' as const,
          path: 'package/lib/entry.js',
          content: 'module.exports = { entry: true };\n',
        },
      ],
      packageName: 'x',
      packageVersion: '1.0.0',
    });
    const result = await runInstall(fixture);
    if (await isWindowsInstallRefusal(result, fixture)) return;
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    await expect(installedTargetExists(fixture)).resolves.toBe(true);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    expect(await fs.readFile(path.join(fixture.repoDir, 'node_modules', 'x', 'lib', 'entry.js'), 'utf8')).toContain(
      'entry',
    );
    await assertNoStagingLeftover(fixture.repoDir);
  });

  it.each([
    { args: [], why: '无任何参数' },
    { args: ['--package=@esbuild/linux-x64'], why: '缺 --lockfile' },
    { args: ['--lockfile=C:\\abs\\lock.json'], why: '缺 --package' },
    {
      args: ['--lockfile=rel\\lock.json', '--package=x'],
      why: 'lockfile 非绝对路径',
    },
  ])('退出码 2：$why', async ({ args }) => {
    const result = runCli(args);
    expect(result.code).toBe(2);
    expect(result.stdout).toContain('用法');
    expect(result.stdout).toMatch(/ERROR_JSON .*"rule":"P0-1"/);
  });

  it('退出码 2：--tarball 文件不可读（FILE_NOT_FOUND）', async () => {
    const fixture = await makeFixture();
    const result = runCli([
      `--lockfile=${fixture.lockfilePath}`,
      `--package=${fixture.packageName}`,
      `--tarball=${path.join(fixture.repoDir, 'missing.tgz')}`,
    ]);
    expect(result.code).toBe(2);
    expect(result.stdout).toContain('ERROR_JSON');
  });

  it('退出码 1：SRI 篡改拒绝且不动 node_modules', async () => {
    const archive = makeTar([
      { kind: 'directory', path: 'package/' },
      {
        kind: 'file',
        path: 'package/package.json',
        content: '{"name":"x","version":"1.0.0","main":"index.js"}',
      },
      {
        kind: 'file',
        path: 'package/index.js',
        content: 'module.exports = true;\n',
      },
    ]);
    const tamperedIntegrity = sha512(Buffer.concat([archive, Buffer.from('tamper')]));
    const fixture = await makeFixture({
      archiveOverride: archive,
      lockfileIntegrityOverride: tamperedIntegrity,
      packageName: 'x',
      packageVersion: '1.0.0',
    });
    const result = await runInstall(fixture);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('"errorCode":"integrity"');
    await expect(installedTargetExists(fixture)).resolves.toBe(false);
    await expect(fs.access(path.join(fixture.repoDir, 'node_modules'))).rejects.toThrow();
  });

  it('退出码 1：绝对/穿越路径拒绝且不动 node_modules', async () => {
    const fixture = await makeFixture({
      entries: [
        { kind: 'directory', path: 'package/' },
        {
          kind: 'file',
          path: 'package/package.json',
          content: '{"name":"x","version":"1.0.0","main":"index.js"}',
        },
        { kind: 'file', path: 'package/../../evil.txt', content: 'evil' },
      ],
      packageName: 'x',
      packageVersion: '1.0.0',
    });
    const result = await runInstall(fixture);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('"errorCode":"archive-path"');
    await expect(installedTargetExists(fixture)).resolves.toBe(false);
  });

  it('退出码 1：symlink 拒绝且不动 node_modules', async () => {
    const fixture = await makeFixture({
      entries: [
        { kind: 'directory', path: 'package/' },
        {
          kind: 'file',
          path: 'package/package.json',
          content: '{"name":"x","version":"1.0.0","main":"index.js"}',
        },
        {
          kind: 'file',
          path: 'package/index.js',
          content: 'module.exports = true;\n',
        },
        { kind: 'symlink', path: 'package/bad.node', linkname: '/etc/passwd' },
      ],
      packageName: 'x',
      packageVersion: '1.0.0',
    });
    const result = await runInstall(fixture);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('"errorCode":"archive-link"');
    await expect(installedTargetExists(fixture)).resolves.toBe(false);
  });

  it('退出码 1：hardlink 拒绝且不动 node_modules', async () => {
    const fixture = await makeFixture({
      entries: [
        { kind: 'directory', path: 'package/' },
        {
          kind: 'file',
          path: 'package/package.json',
          content: '{"name":"x","version":"1.0.0","main":"index.js"}',
        },
        {
          kind: 'file',
          path: 'package/index.js',
          content: 'module.exports = true;\n',
        },
        {
          kind: 'hardlink',
          path: 'package/hard.node',
          linkname: 'package/index.js',
        },
      ],
      packageName: 'x',
      packageVersion: '1.0.0',
    });
    const result = await runInstall(fixture);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('"errorCode":"archive-link"');
    await expect(installedTargetExists(fixture)).resolves.toBe(false);
  });

  it('退出码 1：package.json 身份不一致拒绝', async () => {
    const fixture = await makeFixture({
      packageJsonOverride: JSON.stringify({
        name: 'other-package',
        version: '1.0.0',
        main: 'index.js',
      }),
      packageName: 'x',
      packageVersion: '1.0.0',
    });
    const result = await runInstall(fixture);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('"errorCode":"package-name"');
    await expect(installedTargetExists(fixture)).resolves.toBe(false);
  });

  it('退出码 1：loadModule 失败清理（index.js 加载抛错）', async () => {
    const fixture = await makeFixture({
      entries: [
        { kind: 'directory', path: 'package/' },
        {
          kind: 'file',
          path: 'package/package.json',
          content: '{"name":"x","version":"1.0.0","main":"index.js"}',
        },
        {
          kind: 'file',
          path: 'package/index.js',
          content: 'throw new Error("boom");\n',
        },
      ],
      packageName: 'x',
      packageVersion: '1.0.0',
    });
    const result = await runInstall(fixture);
    expect(result.code).toBe(1);
    await expect(installedTargetExists(fixture)).resolves.toBe(false);
    await assertNoStagingLeftover(fixture.repoDir);
  });

  it('退出码 1：安装冲突（node_modules/<name> 已存在且非本包）失败且不动既有包', async () => {
    const fixture = await makeFixture();
    const target = path.join(fixture.repoDir, 'node_modules', fixture.packageName);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await fs.mkdir(target, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await fs.writeFile(
      path.join(target, 'package.json'),
      JSON.stringify({ name: fixture.packageName, version: '9.9.9' }),
      'utf8',
    );
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await fs.writeFile(path.join(target, 'keep.txt'), 'keep', 'utf8');
    const result = await runInstall(fixture);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain(
      process.platform === 'win32' ? '"errorCode":"install-error"' : '"errorCode":"install-conflict"',
    );
    if (process.platform === 'win32') {
      expect(`${result.stdout}\n${result.stderr}`).toMatch(WINDOWS_EXTRACTION_REJECTION);
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    expect(await fs.readFile(path.join(target, 'keep.txt'), 'utf8')).toBe('keep');
    await assertNoStagingLeftover(fixture.repoDir);
  });

  it('退出码 1：多包部分失败时汇总 + 成功包仍安装', async () => {
    const goodArchive = makeTar([
      { kind: 'directory', path: 'package/' },
      {
        kind: 'file',
        path: 'package/package.json',
        content: '{"name":"x","version":"1.0.0","main":"index.js"}',
      },
      {
        kind: 'file',
        path: 'package/index.js',
        content: 'module.exports = true;\n',
      },
    ]);
    const badArchive = makeTar([
      { kind: 'directory', path: 'package/' },
      {
        kind: 'file',
        path: 'package/package.json',
        content: '{"name":"y","version":"1.0.0","main":"index.js"}',
      },
      {
        kind: 'file',
        path: 'package/index.js',
        content: 'module.exports = true;\n',
      },
    ]);
    const repoDir = await makeTempDir('platform-deps-multi-');
    const goodTar = path.join(repoDir, 'good.tgz');
    const badTar = path.join(repoDir, 'bad.tgz');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await fs.writeFile(goodTar, goodArchive);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await fs.writeFile(badTar, badArchive);
    const lockfile = JSON.stringify({
      name: 'fixture-repo',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: {
        '': { name: 'fixture-repo', version: '1.0.0' },
        'node_modules/x': {
          version: '1.0.0',
          resolved: `https://${REGISTRY_HOST}/x-1.0.0.tgz`,
          integrity: sha512(goodArchive),
        },
        'node_modules/y': {
          version: '1.0.0',
          resolved: `https://${REGISTRY_HOST}/y-1.0.0.tgz`,
          integrity: sha512(Buffer.concat([badArchive, Buffer.from('tamper')])),
        },
      },
    });
    const lockfilePath = path.join(repoDir, 'package-lock.json');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    await fs.writeFile(lockfilePath, lockfile, 'utf8');

    const result = runCli([
      `--lockfile=${lockfilePath}`,
      '--package=x',
      '--package=y',
      `--tarball=x=${goodTar}`,
      `--tarball=y=${badTar}`,
    ]);
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    if (process.platform === 'win32') {
      expect(result.stdout).toContain('"failed":2');
      expect(result.stdout).toContain('"passed":0');
      expect(result.stdout).toContain('"errorCode":"install-error"');
      expect(result.stdout).toContain('"errorCode":"integrity"');
      expect(`${result.stdout}\n${result.stderr}`).toMatch(WINDOWS_EXTRACTION_REJECTION);
      await expect(fs.access(path.join(repoDir, 'node_modules', 'x'))).rejects.toThrow();
    } else {
      expect(result.stdout).toContain('"failed":1');
      expect(result.stdout).toContain('"passed":1');
      expect(result.stdout).toContain('"errorCode":"integrity"');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
      expect(await fs.readFile(path.join(repoDir, 'node_modules', 'x', 'index.js'), 'utf8')).toContain(
        'module.exports',
      );
    }
    await expect(fs.access(path.join(repoDir, 'node_modules', 'y'))).rejects.toThrow();
    await assertNoStagingLeftover(repoDir);
  });
});
