import { createHash } from 'node:crypto';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  verifyPlatformDependency,
  type ArchiveEntry,
  type PlatformDependencyVerificationOptions,
} from '../lib/platform-deps-installer.js';

const packageName = '@rolldown/binding-win32-x64-msvc';
const packageVersion = '1.2.4';
const archive = Buffer.from('injected-platform-package');
const integrity = `sha512-${createHash('sha512').update(archive).digest('base64')}`;
const tempDir = '/isolated/platform-deps-test-123';

function makeLockfile(
  packageOverrides: Record<string, unknown> = {},
  lockfileOverrides: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    name: 'fixture',
    version: '1.0.0',
    lockfileVersion: 3,
    requires: true,
    ...lockfileOverrides,
    packages: {
      '': { name: 'fixture', version: '1.0.0' },
      [`node_modules/${packageName}`]: {
        version: packageVersion,
        resolved: `https://registry.npmjs.org/@rolldown/binding-win32-x64-msvc/-/${packageVersion}.tgz`,
        integrity,
        ...packageOverrides,
      },
    },
  });
}

function makeEntries(overrides?: ArchiveEntry): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [
    { path: 'package', type: 'directory' },
    {
      path: 'package/package.json',
      type: 'file',
      content: JSON.stringify({ name: packageName, version: packageVersion }),
    },
    {
      path: 'package/index.js',
      type: 'file',
      content: 'module.exports = true;',
    },
  ];
  if (overrides) {
    entries.push(overrides);
  }
  return entries;
}

function makeOptions(
  entries: ArchiveEntry[] = makeEntries(),
  overrides: Partial<PlatformDependencyVerificationOptions> = {},
): PlatformDependencyVerificationOptions {
  const removed: string[] = [];
  return {
    lockfile: makeLockfile(),
    packageName,
    allowedRegistryHosts: ['registry.npmjs.org'],
    archive,
    readArchiveEntries: async () => entries,
    extractArchive: async () => undefined,
    createTemporaryDirectory: async () => tempDir,
    removeTemporaryDirectory: async (directory) => {
      removed.push(directory);
    },
    loadModule: async () => ({ loaded: true }),
    ...overrides,
    testState: { removed },
  } as PlatformDependencyVerificationOptions;
}

describe('verifyPlatformDependency', () => {
  it('verifies lock metadata, archive integrity, package identity, and isolated module loading', async () => {
    let extractedTo = '';
    let loadedFrom = '';
    const options = makeOptions(undefined, {
      extractArchive: async (_input, directory) => {
        extractedTo = directory;
      },
      loadModule: async (packageRoot) => {
        loadedFrom = packageRoot;
        return { loaded: true };
      },
    });

    const result = await verifyPlatformDependency(options);

    expect(result.locked).toEqual({
      name: packageName,
      version: packageVersion,
      resolved: `https://registry.npmjs.org/@rolldown/binding-win32-x64-msvc/-/${packageVersion}.tgz`,
      integrity,
    });
    expect(result.loadedModule).toEqual({ loaded: true });
    expect(extractedTo).toBe(tempDir);
    expect(loadedFrom).toBe(path.join(tempDir, 'package'));
    expect(
      (
        options as PlatformDependencyVerificationOptions & {
          testState: { removed: string[] };
        }
      ).testState.removed,
    ).toEqual([tempDir]);
  });

  it('rejects corrupt lockfiles（3 态：非 v3 / 非法 JSON / 缺包条目）', async () => {
    for (const [形态, lockfile, code] of [
      ['非 v3（lockfileVersion=2）', makeLockfile({}, { lockfileVersion: 2 }), 'lockfile-version'],
      ['非法 JSON', 'not json {', 'lockfile-json'],
      [
        '缺目标包条目（packages 空）',
        JSON.stringify({
          name: 'fixture',
          version: '1.0.0',
          lockfileVersion: 3,
          packages: {},
        }),
        'lockfile-package',
      ],
    ] as const) {
      await expect(
        verifyPlatformDependency({ ...makeOptions(), lockfile }),
        `${形态}: 应拒 ${code}`,
      ).rejects.toMatchObject({ code });
    }
  });

  it('rejects a registry URL whose host is not allowlisted', async () => {
    await expect(
      verifyPlatformDependency({
        ...makeOptions(),
        lockfile: makeLockfile({
          resolved: 'https://evil.example.invalid/package.tgz',
        }),
      }),
    ).rejects.toMatchObject({ code: 'registry-host' });
  });

  it('rejects a registry URL that is not HTTPS', async () => {
    await expect(
      verifyPlatformDependency({
        ...makeOptions(),
        lockfile: makeLockfile({
          resolved: 'http://registry.npmjs.org/package.tgz',
        }),
      }),
    ).rejects.toMatchObject({ code: 'registry-protocol' });
  });

  it('rejects malformed SHA-512 SRI（3 态：非规范 unpadded / 非 64 字节 / 非 SHA-512 前缀）', async () => {
    for (const [形态, sri] of [
      ['非规范 unpadded（解码仍为 64 字节）', `${integrity.replace(/==$/, '')}`],
      ['base64 载荷非 64 字节', 'sha512-QUJD'],
      ['非 SHA-512 前缀', 'sha1-QUJD'],
    ] as const) {
      await expect(
        verifyPlatformDependency({ ...makeOptions(), lockfile: makeLockfile({ integrity: sri }) }),
        `SRI 形态「${形态}」: 应拒 integrity`,
      ).rejects.toMatchObject({ code: 'integrity' });
    }
  });

  it('rejects an archive whose SHA-512 SRI does not match the lockfile（读取前置拦截）', async () => {
    let readCalled = false;
    await expect(
      verifyPlatformDependency({
        ...makeOptions(),
        lockfile: makeLockfile({
          integrity: 'sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
        }),
        readArchiveEntries: async () => {
          readCalled = true;
          return makeEntries();
        },
      }),
    ).rejects.toMatchObject({ code: 'integrity' });
    expect(readCalled).toBe(false);
  });

  it('accepts a conventional trailing slash on a safe tar directory entry', async () => {
    const entries = makeEntries();
    entries[0] = { path: 'package/', type: 'directory' };

    await expect(verifyPlatformDependency(makeOptions(entries))).resolves.toMatchObject({
      locked: { name: packageName },
    });
  });

  it('rejects unsafe tar entry paths（5 路径，path 具名）', async () => {
    for (const entryPath of [
      '/absolute/file',
      '../outside/file',
      'package/../../outside/file',
      'C:\\outside\\file',
      '\\\\server\\share\\file',
    ]) {
      await expect(
        verifyPlatformDependency(makeOptions([{ path: entryPath, type: 'file', content: 'bad' }])),
        `path=${entryPath}: 应拒 archive-path`,
      ).rejects.toMatchObject({ code: 'archive-path' });
    }
  });

  it('rejects link-bearing tar entries before extraction（3 态：symlink / hardlink / file 带 linkname，含未抽取断言）', async () => {
    for (const [label, entry, appendToEntries, guardExtraction] of [
      [
        'symlink entry',
        { path: 'package/native.node', type: 'symlink', linkname: '/outside/native.node' } as ArchiveEntry,
        false,
        true,
      ],
      [
        'hardlink entry',
        { path: 'package/native.node', type: 'hardlink', linkname: 'lib/native.node' } as ArchiveEntry,
        true,
        true,
      ],
      [
        'file entry that carries a linkname',
        { path: 'package/weird.node', type: 'file', content: 'x', linkname: '/etc/passwd' } as ArchiveEntry,
        true,
        false,
      ],
    ] as const) {
      let extracted = false;
      await expect(
        verifyPlatformDependency(
          makeOptions(appendToEntries ? makeEntries(entry) : [entry], {
            extractArchive: async () => {
              extracted = true;
            },
          }),
        ),
        `${label}: 应拒 archive-link`,
      ).rejects.toMatchObject({ code: 'archive-link' });
      if (guardExtraction) {
        expect(extracted, `${label}: 抽取不得发生`).toBe(false);
      }
    }
  });

  it('rejects malformed archive entry paths（3 态：空路径 / NUL / 空段）', async () => {
    for (const [形态, entry] of [
      ['空路径', { path: '', type: 'directory' } as ArchiveEntry],
      ['NUL 字节', { path: 'package\0x', type: 'file' } as ArchiveEntry],
      ['空段', { path: 'package//evil', type: 'file', content: 'x' } as ArchiveEntry],
    ] as const) {
      await expect(
        verifyPlatformDependency(makeOptions([entry])),
        `path=${JSON.stringify(entry.path)}（${形态}）: 应拒 archive-path`,
      ).rejects.toMatchObject({ code: 'archive-path' });
    }
  });

  it('rejects package identity mismatches（2 态：name / version）', async () => {
    for (const [label, identity, code] of [
      ['name 不符', { name: 'different-package', version: packageVersion }, 'package-name'],
      ['version 不符', { name: packageName, version: '9.9.9' }, 'package-version'],
    ] as const) {
      const entries = makeEntries();
      entries[1] = {
        path: 'package/package.json',
        type: 'file',
        content: JSON.stringify(identity),
      };
      await expect(verifyPlatformDependency(makeOptions(entries)), `${label}: 应拒 ${code}`).rejects.toMatchObject({
        code,
      });
    }
  });

  it('rejects missing or corrupt package/package.json（2 态：缺失 / 非法 JSON）', async () => {
    for (const [label, entries] of [
      ['缺 package/package.json', [{ path: 'package', type: 'directory' } as ArchiveEntry]],
      [
        'package/package.json 非法 JSON',
        [
          { path: 'package', type: 'directory' } as ArchiveEntry,
          { path: 'package/package.json', type: 'file', content: '{bad json' } as ArchiveEntry,
        ],
      ],
    ] as const) {
      await expect(
        verifyPlatformDependency(makeOptions([...entries])),
        `${label}: 应拒 package-json`,
      ).rejects.toMatchObject({ code: 'package-json' });
    }
  });

  it('cleans the isolated temporary directory when module loading fails', async () => {
    const removed: string[] = [];
    await expect(
      verifyPlatformDependency(
        makeOptions(undefined, {
          removeTemporaryDirectory: async (directory) => {
            removed.push(directory);
          },
          loadModule: async () => {
            throw new Error('load failed');
          },
        }),
      ),
    ).rejects.toThrow('load failed');
    expect(removed).toEqual([tempDir]);
  });
});
