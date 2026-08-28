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
  /** 经 GNU long link 'K' 的真实链接目标 */
  gnuLongLink?: boolean;
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
      if (entry.gnuLongLink === true) {
        const longLink = Buffer.from(`${entry.linkname ?? ''}\0`);
        blocks.push(
          tarHeader({
            name: '././@LongLink',
            typeflag: 'K',
            size: longLink.length,
          }),
        );
        blocks.push(padded(longLink));
      }
      blocks.push(
        tarHeader({
          name: entry.headerName ?? entry.path,
          typeflag: entry.typeflag ?? '0',
          size: content.length,
          linkname: entry.gnuLongLink === true ? 'x' : entry.linkname,
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

describe('readArchiveEntries / extractArchive（自包含 tar 读取）', () => {
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

  it('解析常规文件与目录（路径/类型/内容忠实）', async () => {
    const archive = makeTar([
      { kind: 'directory', path: 'package/' },
      { kind: 'file', path: 'package/package.json', content: '{"name":"x"}' },
      { kind: 'file', path: 'package/lib/a.js', content: 'export 1;' },
    ]);
    const entries = await readArchiveEntries(archive);
    expect(entries.map((entry) => [entry.path, entry.type])).toEqual([
      ['package', 'directory'],
      ['package/package.json', 'file'],
      ['package/lib/a.js', 'file'],
    ]);
    expect(Buffer.from(entries[1]?.content as Buffer).toString()).toBe('{"name":"x"}');
  });

  it('解析 GNU long name（L）与 long link（K）metadata', async () => {
    const longPath = `package/${'seg/'.repeat(25)}deep-file.js`;
    const longLink = `package/${'target/'.repeat(25)}native.node`;
    const archive = makeTar([
      {
        kind: 'file',
        path: longPath,
        headerName: 'package/x',
        gnuLongName: true,
        content: 'long',
      },
      {
        kind: 'file',
        path: 'package/linked.node',
        typeflag: '2',
        linkname: longLink,
        gnuLongLink: true,
        content: '',
      },
    ]);

    const entries = await readArchiveEntries(archive);
    expect(entries).toContainEqual(
      expect.objectContaining({ path: longPath, type: 'file', content: Buffer.from('long') }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ path: 'package/linked.node', type: 'symlink', linkname: longLink }),
    );
  });

  it('解析 PAX UTF-8、x/g 多记录与 linkpath metadata', async () => {
    const unicodePath = 'package/工具/入口.txt';
    const globalPath = 'package/global.txt';
    const archive = makeTar([
      {
        kind: 'file',
        path: unicodePath,
        headerName: 'package/x',
        paxPath: unicodePath,
        content: 'unicode',
      },
      {
        kind: 'file',
        path: globalPath,
        headerName: 'package/g',
        paxType: 'g',
        paxRecords: [
          ['comment', 'global-header'],
          ['path', globalPath],
        ],
        content: 'global',
      },
      {
        kind: 'file',
        path: 'package/linked',
        content: '',
        typeflag: '2',
        linkname: 'package/from-header',
        paxRecords: [['linkpath', 'package/from-pax']],
      },
    ]);

    const entries = await readArchiveEntries(archive);
    expect(entries).toContainEqual(expect.objectContaining({ path: unicodePath, type: 'file' }));
    expect(entries).toContainEqual(expect.objectContaining({ path: globalPath, type: 'file' }));
    expect(entries).toContainEqual(
      expect.objectContaining({ path: globalPath, type: 'symlink', linkname: 'package/from-pax' }),
    );
  });

  it('解析并在当前 host 提取 UStar file/dir mode', async () => {
    const archive = makeTar([
      { kind: 'directory', path: 'package/', mode: '700' },
      { kind: 'directory', path: 'package/bin/', mode: '711' },
      { kind: 'file', path: 'package/bin/tool.bin', content: 'BIN', mode: '755' },
    ]);
    const entries = await readArchiveEntries(archive);
    expect(entries.find((entry) => entry.path === 'package/bin/tool.bin')?.mode).toBe(0o755);

    const dir = await makeTempDir('platform-deps-mode-');
    await extractArchive(archive, dir);
    const written = path.join(dir, 'package', 'bin', 'tool.bin');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is beneath the isolated caller-owned extraction root
    await expect(fs.readFile(written, 'utf8')).resolves.toBe('BIN');
    if (process.platform !== 'win32') {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is beneath the isolated caller-owned extraction root
      expect((await fs.stat(path.join(dir, 'package'))).mode & 0o777).toBe(0o700);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is beneath the isolated caller-owned extraction root
      expect((await fs.stat(path.join(dir, 'package', 'bin'))).mode & 0o777).toBe(0o711);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is beneath the isolated caller-owned extraction root
      expect((await fs.stat(written)).mode & 0o777).toBe(0o755);
    }
  });

  it('extractArchive 在当前 Windows/Linux host 成功提取合法归档', async () => {
    const dir = await makeTempDir('platform-deps-extract-valid-');
    const archive = makeTar([
      { kind: 'directory', path: 'package/' },
      { kind: 'file', path: 'package/package.json', content: '{"name":"x"}' },
      { kind: 'file', path: 'package/lib/deep.txt', content: 'deep' },
    ]);

    await extractArchive(archive, dir);

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is beneath the isolated caller-owned extraction root
    await expect(fs.readFile(path.join(dir, 'package', 'lib', 'deep.txt'), 'utf8')).resolves.toBe('deep');
  });

  it.each([
    {
      label: 'symlink',
      entry: { kind: 'symlink' as const, path: 'package/bad.node', linkname: '/etc/passwd' },
    },
    {
      label: 'hardlink',
      entry: { kind: 'hardlink' as const, path: 'package/bad.node', linkname: 'package/index.js' },
    },
    {
      label: '普通文件 linkname',
      entry: {
        kind: 'file' as const,
        path: 'package/bad.node',
        content: '',
        linkname: '../outside',
      },
    },
  ])('extractArchive 在写入前拒绝 $label', async ({ entry }) => {
    const dir = await makeTempDir('platform-deps-extract-link-');
    const archive = makeTar([{ kind: 'file', path: 'package/first.txt', content: 'must-not-write' }, entry]);

    await expect(extractArchive(archive, dir)).rejects.toThrow(/链接/);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- dir is the isolated caller-owned extraction root
    await expect(fs.readdir(dir)).resolves.toEqual([]);
  });

  it.each([
    '/absolute.txt',
    `C:\\absolute-${randomUUID()}.txt`,
    'package/../../traversal.txt',
    'package/./dot.txt',
    'package//empty.txt',
    `package/nul-${randomUUID()}\0outside`,
  ])('extractArchive 在写入前拒绝不安全路径 %s', async (archivePath) => {
    const dir = await makeTempDir('platform-deps-extract-path-');
    const archive = archivePath.includes('\0')
      ? makeTar([
          { kind: 'file', path: 'package/first.txt', content: 'must-not-write' },
          {
            kind: 'file',
            path: 'package/safe-name',
            paxRecords: [['path', archivePath]],
            content: 'blocked',
          },
        ])
      : makeTar([
          { kind: 'file', path: 'package/first.txt', content: 'must-not-write' },
          { kind: 'file', path: archivePath, content: 'blocked' },
        ]);

    await expect(extractArchive(archive, dir)).rejects.toThrow(/不安全路径/);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- dir is the isolated caller-owned extraction root
    await expect(fs.readdir(dir)).resolves.toEqual([]);
  });

  it.each([
    {
      label: 'duplicate canonical path',
      entries: [
        { kind: 'file' as const, path: 'package/duplicate.txt', content: 'first' },
        { kind: 'file' as const, path: 'package\\duplicate.txt', content: 'second' },
      ],
      message: /重复|duplicate/i,
    },
    {
      label: 'directory/file same-path conflict',
      entries: [
        { kind: 'directory' as const, path: 'package/conflict/' },
        { kind: 'file' as const, path: 'package\\conflict', content: 'blocked' },
      ],
      message: /重复|冲突|duplicate|conflict/i,
    },
    {
      label: 'non-adjacent file ancestor conflict',
      entries: [
        { kind: 'file' as const, path: 'package/prefix', content: 'file' },
        { kind: 'file' as const, path: 'package/separator', content: 'separator' },
        { kind: 'file' as const, path: 'package/prefix/descendant.txt', content: 'blocked' },
      ],
      message: /文件\/目录路径冲突/,
    },
  ])('extractArchive 在 FS write 前拒绝 $label', async ({ entries, message }) => {
    const dir = await makeTempDir('platform-deps-extract-conflict-');

    await expect(extractArchive(makeTar(entries), dir)).rejects.toThrow(message);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- dir is the isolated caller-owned extraction root
    await expect(fs.readdir(dir)).resolves.toEqual([]);
  });

  it('extractArchive 拒绝既有 file ancestor，不覆盖 caller root 条目', async () => {
    const dir = await makeTempDir('platform-deps-extract-existing-');
    const existing = path.join(dir, 'package');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- existing is beneath the isolated caller-owned extraction root
    await fs.writeFile(existing, 'keep', 'utf8');

    await expect(
      extractArchive(makeTar([{ kind: 'file', path: 'package/child.txt', content: 'blocked' }]), dir),
    ).rejects.toThrow(/冲突|目录|exist|EEXIST|ENOTDIR/i);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- existing is beneath the isolated caller-owned extraction root
    await expect(fs.readFile(existing, 'utf8')).resolves.toBe('keep');
  });

  it('extractArchive 使用独占创建，不覆盖 caller root 的既有文件', async () => {
    const dir = await makeTempDir('platform-deps-extract-existing-file-');
    const packageDir = path.join(dir, 'package');
    const existing = path.join(packageDir, 'file.txt');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- packageDir is beneath the isolated caller-owned extraction root
    await fs.mkdir(packageDir);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- existing is beneath the isolated caller-owned extraction root
    await fs.writeFile(existing, 'keep', 'utf8');

    await expect(
      extractArchive(makeTar([{ kind: 'file', path: 'package/file.txt', content: 'overwrite' }]), dir),
    ).rejects.toThrow(/exist|EEXIST|冲突/i);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- existing is beneath the isolated caller-owned extraction root
    await expect(fs.readFile(existing, 'utf8')).resolves.toBe('keep');
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
    const target = await installVerifiedPackage({
      archive,
      repoRoot: repoDir,
      packageName: 'x',
      version: '1.0.0',
      ...realIo,
    });
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

    await installVerifiedPackage({
      archive,
      repoRoot: repoDir,
      packageName: 'x',
      version: '1.0.0',
      ...realIo,
    });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    expect(await fs.readFile(path.join(target, 'new.txt'), 'utf8')).toBe('new');
    await expect(fs.access(path.join(target, 'old.txt'))).rejects.toThrow();
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    const backups = (await fs.readdir(repoDir)).filter((name) => name.includes('.wm-backup-'));
    expect(backups).toEqual([]);
  });

  it('安装提交与旧包恢复都失败时报告两项错误并清理 staging', async () => {
    const repoDir = await makeTempDir('platform-deps-install-restore-failure-');
    const archive = makeTar([
      { kind: 'file', path: 'package/package.json', content: '{"name":"x","version":"1.0.0"}' },
      { kind: 'file', path: 'package/new.txt', content: 'new' },
    ]);
    const target = path.join(repoDir, 'node_modules', 'x');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is beneath the isolated repository fixture
    await fs.mkdir(target, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is beneath the isolated repository fixture
    await fs.writeFile(path.join(target, 'package.json'), '{"name":"x","version":"1.0.0"}', 'utf8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is beneath the isolated repository fixture
    await fs.writeFile(path.join(target, 'old.txt'), 'old', 'utf8');

    const originalRename = fs.rename;
    let commitFailureInjected = false;
    let restoreFailureInjected = false;
    fs.rename = async (...args: Parameters<typeof fs.rename>): ReturnType<typeof fs.rename> => {
      const [source, destination] = args;
      if (
        !commitFailureInjected &&
        typeof source === 'string' &&
        typeof destination === 'string' &&
        source.includes('.platform-deps-staging-') &&
        destination === target
      ) {
        commitFailureInjected = true;
        const error = new Error('simulated staging commit failure') as NodeJS.ErrnoException;
        error.code = 'EIO';
        throw error;
      }
      if (
        commitFailureInjected &&
        !restoreFailureInjected &&
        typeof source === 'string' &&
        typeof destination === 'string' &&
        source.includes('.wm-backup-') &&
        destination === target
      ) {
        restoreFailureInjected = true;
        const error = new Error('simulated backup restore failure') as NodeJS.ErrnoException;
        error.code = 'EACCES';
        throw error;
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- original rename remains confined to isolated repository fixture paths
      return originalRename(...args);
    };
    try {
      await expect(
        installVerifiedPackage({
          archive,
          repoRoot: repoDir,
          packageName: 'x',
          version: '1.0.0',
          ...realIo,
        }),
      ).rejects.toMatchObject({
        code: 'extract-failed',
        message: expect.stringMatching(/restore|EACCES/i),
      });
    } finally {
      fs.rename = originalRename;
    }

    expect(commitFailureInjected).toBe(true);
    expect(restoreFailureInjected).toBe(true);
    await assertNoStagingLeftover(repoDir);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- repoDir is an isolated repository fixture
    const backups = (await fs.readdir(path.join(repoDir, 'node_modules'))).filter((name) =>
      name.includes('.wm-backup-'),
    );
    expect(backups).toHaveLength(1);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- backup remains in the isolated repository fixture because restore failed
    await expect(
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- retained backup path is beneath the isolated repository fixture
      fs.readFile(path.join(repoDir, 'node_modules', backups[0] as string, 'old.txt'), 'utf8'),
    ).resolves.toBe('old');
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

    await expect(
      installVerifiedPackage({
        archive,
        repoRoot: repoDir,
        packageName: 'x',
        version: '1.0.0',
        ...realIo,
      }),
    ).rejects.toMatchObject({
      code: 'install-conflict',
    });
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
    expect(result.stdout).toContain('"errorCode":"install-conflict"');
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
    expect(result.stdout).toContain('"failed":1');
    expect(result.stdout).toContain('"passed":1');
    expect(result.stdout).toContain('"errorCode":"integrity"');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is derived from an isolated mkdtemp workspace
    expect(await fs.readFile(path.join(repoDir, 'node_modules', 'x', 'index.js'), 'utf8')).toContain('module.exports');
    await expect(fs.access(path.join(repoDir, 'node_modules', 'y'))).rejects.toThrow();
    await assertNoStagingLeftover(repoDir);
  });
});
