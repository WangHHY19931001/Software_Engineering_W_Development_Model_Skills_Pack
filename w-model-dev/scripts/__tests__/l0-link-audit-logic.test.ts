import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { auditL0RelativeLinks } from '../logic/l0-link-audit-logic.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SKILL_ROOT = path.join(REPO_ROOT, 'w-model-dev');
const L0_DIRECTORIES = ['references', 'templates', 'examples', 'subagent', 'schemas'];
let fixtureRoot: string;
let outsideRoot: string;

async function write(relativePath: string, content = ''): Promise<void> {
  const target = path.join(fixtureRoot, relativePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is built beneath the mkdtemp-owned fixture root
  await fs.mkdir(path.dirname(target), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is built beneath the mkdtemp-owned fixture root
  await fs.writeFile(target, content, 'utf8');
}

/** 聚合族每行自备 fixture（互不污染；skill root symlink 行会整体替换 root）。 */
interface SymlinkFixture {
  root: string;
  outside: string;
  write: (relativePath: string, content?: string) => Promise<void>;
}

async function makeSymlinkFixture(): Promise<SymlinkFixture> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'l0-link-audit-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'l0-link-audit-outside-'));
  const write = async (relativePath: string, content = ''): Promise<void> => {
    const target = path.join(root, relativePath);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is built beneath the mkdtemp-owned fixture root
    await fs.mkdir(path.dirname(target), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- target is built beneath the mkdtemp-owned fixture root
    await fs.writeFile(target, content, 'utf8');
  };
  await write('SKILL.md');
  await Promise.all(
    L0_DIRECTORIES.map((directory) => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- every directory is created beneath the mkdtemp-owned fixture root
      return fs.mkdir(path.join(root, directory), { recursive: true });
    }),
  );
  return { root, outside, write };
}

beforeEach(async () => {
  fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'l0-link-audit-'));
  outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'l0-link-audit-outside-'));
  await write('SKILL.md');
  await Promise.all(
    L0_DIRECTORIES.map((directory) => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- every directory is created beneath the mkdtemp-owned fixture root
      return fs.mkdir(path.join(fixtureRoot, directory), { recursive: true });
    }),
  );
});

afterEach(async () => {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
  await fs.rm(outsideRoot, { recursive: true, force: true });
});

describe('auditL0RelativeLinks', () => {
  it('classifies only existing scripts, samples, and tools targets as L1-only', async () => {
    await write(
      'references/guide.md',
      '[CLI](../scripts/cli/check.ts) [sample](../samples/valid.json) [tool](../tools/tool.jar)',
    );
    await write('scripts/cli/check.ts');
    await write('samples/valid.json');
    await write('tools/tool.jar');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.l1Only).toHaveLength(3);
    expect(result.violations).toEqual([]);
  });

  it('rejects a broken L1-only target instead of silently classifying it', async () => {
    await write('references/guide.md', '[missing CLI](../scripts/cli/missing.ts)');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.l1Only).toEqual([]);
    expect(result.violations).toContainEqual(expect.stringContaining('L1-only 目标不存在'));
  });

  it('fails closed when a required L0 directory is missing', async () => {
    await fs.rm(path.join(fixtureRoot, 'templates'), {
      recursive: true,
      force: true,
    });

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(expect.stringContaining('必需 L0 目录不存在或不可读 templates'));
  });

  it('fails closed when the required L0 SKILL.md file is missing', async () => {
    await fs.rm(path.join(fixtureRoot, 'SKILL.md'), { force: true });

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(expect.stringContaining('必需 L0 文件不存在或不可读 SKILL.md'));
  });

  it('rejects symlink fixtures whose real paths escape the skill root（4 态：L0 源文件 / L0 目录 / SKILL.md / L0+L1 目录，每行自备 fixture）', async () => {
    for (const [场景, setup, 期望] of [
      [
        'rejects an L0 source file whose real path escapes the skill root',
        async ({ root, outside }: SymlinkFixture) => {
          const outsideSource = path.join(outside, 'outside.md');
          const sourceLink = path.join(root, 'references', 'outside.md');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- outsideSource is beneath the mkdtemp-owned escape fixture root
          await fs.writeFile(outsideSource, '[inside](../SKILL.md)', 'utf8');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- both symlink endpoints are controlled mkdtemp fixture paths
          await fs.symlink(outsideSource, sourceLink, 'file');
        },
        ['L0 源文件越出 skill 根 references/outside.md'],
      ],
      [
        'rejects an L0 directory symlink or junction whose real path escapes the skill root',
        async ({ root, outside }: SymlinkFixture) => {
          const outsideDirectory = path.join(outside, 'nested');
          const directoryLink = path.join(root, 'references', 'escaped-directory');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- outsideDirectory is beneath the mkdtemp-owned escape fixture root
          await fs.mkdir(outsideDirectory, { recursive: true });
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- outsideDirectory is beneath the mkdtemp-owned escape fixture root
          await fs.writeFile(path.join(outsideDirectory, 'outside.md'), '# outside\n', 'utf8');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- both symlink endpoints are controlled mkdtemp fixture paths
          await fs.symlink(outsideDirectory, directoryLink, process.platform === 'win32' ? 'junction' : 'dir');
        },
        ['L0 目录越出 skill 根 references/escaped-directory'],
      ],
      [
        'rejects a required L0 SKILL.md symlink whose target escapes the skill root',
        async ({ root, outside }: SymlinkFixture) => {
          const outsideSkill = path.join(outside, 'outside-skill.md');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- outsideSkill is beneath the mkdtemp-owned escape fixture root
          await fs.writeFile(outsideSkill, '# outside skill\n', 'utf8');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- the symlink endpoint is a controlled mkdtemp fixture path
          await fs.rm(path.join(root, 'SKILL.md'), { force: true });
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- both symlink endpoints are controlled mkdtemp fixture paths
          await fs.symlink(outsideSkill, path.join(root, 'SKILL.md'), 'file');
        },
        ['必需 L0 文件越出 skill 根 SKILL.md'],
      ],
      [
        'rejects non-Markdown L0 and L1 directory symlinks whose targets escape the skill root',
        async ({ root, outside }: SymlinkFixture) => {
          const outsideDirectory = path.join(outside, 'outside-directory');
          const l0Link = path.join(root, 'schemas', 'outside-directory');
          const l1Link = path.join(root, 'tools', 'outside-directory');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- outsideDirectory is beneath the mkdtemp-owned escape fixture root
          await fs.mkdir(outsideDirectory, { recursive: true });
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- both L0/L1 parents are controlled mkdtemp fixture paths
          await fs.mkdir(path.dirname(l0Link), { recursive: true });
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- both L0/L1 parents are controlled mkdtemp fixture paths
          await fs.mkdir(path.dirname(l1Link), { recursive: true });
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- both symlink endpoints are controlled mkdtemp fixture paths
          await fs.symlink(outsideDirectory, l0Link, process.platform === 'win32' ? 'junction' : 'dir');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- both symlink endpoints are controlled mkdtemp fixture paths
          await fs.symlink(outsideDirectory, l1Link, process.platform === 'win32' ? 'junction' : 'dir');
        },
        ['L0 目录越出 skill 根 schemas/outside-directory', 'L1-only 目录越出 skill 根 tools/outside-directory'],
      ],
    ] as const) {
      const fx = await makeSymlinkFixture();
      try {
        await setup(fx);
        const result = await auditL0RelativeLinks(fx.root);
        for (const marker of 期望) {
          expect(result.violations, `${场景}: 应含「${marker}」`).toContainEqual(expect.stringContaining(marker));
        }
      } finally {
        await fs.rm(fx.root, { recursive: true, force: true });
        await fs.rm(fx.outside, { recursive: true, force: true });
      }
    }
  });

  it('rejects internal L0 symlinks even when targets stay inside the package（4 态：顶层目录 / 文件×3 / 内部目录 / skill 根，每行自备 fixture）', async () => {
    for (const [场景, setup, 期望] of [
      [
        'rejects a top-level L0 directory symlink or junction even when it stays inside the skill root',
        async ({ root }: SymlinkFixture) => {
          const targetDirectory = path.join(root, 'references-target');
          const directoryLink = path.join(root, 'references');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- targetDirectory is beneath the mkdtemp-owned skill fixture root
          await fs.mkdir(targetDirectory, { recursive: true });
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- directoryLink is a controlled mkdtemp fixture path
          await fs.rm(directoryLink, { recursive: true, force: true });
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- both symlink endpoints are controlled mkdtemp fixture paths
          await fs.symlink(targetDirectory, directoryLink, process.platform === 'win32' ? 'junction' : 'dir');
        },
        ['L0 目录 symlink/junction 不允许 references'],
      ],
      [
        'rejects L0 Markdown, non-Markdown, and required SKILL.md symlinks even when targets stay inside the package',
        async ({ root }: SymlinkFixture) => {
          const markdownTarget = path.join(root, 'markdown-target.md');
          const binaryTarget = path.join(root, 'binary-target.bin');
          const skillTarget = path.join(root, 'skill-target.md');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture targets are beneath the mkdtemp-owned skill root
          await fs.writeFile(markdownTarget, '# target\n', 'utf8');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture targets are beneath the mkdtemp-owned skill root
          await fs.writeFile(binaryTarget, 'binary\n', 'utf8');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture targets are beneath the mkdtemp-owned skill root
          await fs.writeFile(skillTarget, '# target skill\n', 'utf8');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- symlink endpoints are controlled mkdtemp fixture paths
          await fs.symlink(markdownTarget, path.join(root, 'references', 'guide.md'), 'file');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- symlink endpoints are controlled mkdtemp fixture paths
          await fs.symlink(binaryTarget, path.join(root, 'schemas', 'schema.bin'), 'file');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- replace the required root file with a controlled symlink
          await fs.rm(path.join(root, 'SKILL.md'), { force: true });
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- symlink endpoints are controlled mkdtemp fixture paths
          await fs.symlink(skillTarget, path.join(root, 'SKILL.md'), 'file');
        },
        [
          'L0 源文件 symlink/junction 不允许 SKILL.md',
          'L0 文件 symlink/junction 不允许 references/guide.md',
          'L0 文件 symlink/junction 不允许 schemas/schema.bin',
        ],
      ],
      [
        'rejects an internal non-Markdown L0 directory symlink or junction',
        async ({ root }: SymlinkFixture) => {
          const targetDirectory = path.join(root, 'schema-target');
          const directoryLink = path.join(root, 'schemas', 'linked-data');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- targetDirectory is beneath the mkdtemp-owned skill root
          await fs.mkdir(targetDirectory, { recursive: true });
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- directoryLink is a controlled mkdtemp fixture path
          await fs.symlink(targetDirectory, directoryLink, process.platform === 'win32' ? 'junction' : 'dir');
        },
        ['L0 目录 symlink/junction 不允许 schemas/linked-data'],
      ],
      [
        // skill 根 symlink 会整体替换 fixture root，故为本组末行；清理 rm 仅摘除链接本身
        'rejects a skill root symlink or junction without traversing its target',
        async ({ root, outside }: SymlinkFixture) => {
          const rootTarget = path.join(outside, 'skill-root-target');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- rootTarget is a controlled mkdtemp fixture path
          await fs.mkdir(rootTarget, { recursive: true });
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- rootTarget is a controlled mkdtemp fixture path
          await fs.writeFile(path.join(rootTarget, 'SKILL.md'), '# outside\n', 'utf8');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixtureRoot is a controlled mkdtemp fixture path
          await fs.rm(root, { recursive: true, force: true });
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- both symlink endpoints are controlled mkdtemp fixture paths
          await fs.symlink(rootTarget, root, process.platform === 'win32' ? 'junction' : 'dir');
        },
        ['skill 根目录 symlink/junction 不允许'],
      ],
    ] as const) {
      const fx = await makeSymlinkFixture();
      try {
        await setup(fx);
        const result = await auditL0RelativeLinks(fx.root);
        for (const marker of 期望) {
          expect(result.violations, `${场景}: 应含「${marker}」`).toContainEqual(expect.stringContaining(marker));
        }
      } finally {
        await fs.rm(fx.root, { recursive: true, force: true });
        await fs.rm(fx.outside, { recursive: true, force: true });
      }
    }
  });

  it('rejects L1 symlinks instead of classifying them as L1-only（4 态：目标越出 / 文件+目录 / 顶层目录 / 未引用+断链，每行自备 fixture）', async () => {
    for (const [场景, setup, 期望, assertEmptyL1Only] of [
      [
        'rejects an L1-only target whose real path escapes the skill root',
        async ({ root, outside, write }: SymlinkFixture) => {
          const outsideTarget = path.join(outside, 'escape.ts');
          const symlinkTarget = path.join(root, 'scripts', 'cli', 'escape.ts');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- outsideTarget is beneath the mkdtemp-owned escape fixture root
          await fs.writeFile(outsideTarget, 'export {};', 'utf8');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- symlinkTarget is beneath the mkdtemp-owned skill fixture root
          await fs.mkdir(path.dirname(symlinkTarget), { recursive: true });
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- both symlink endpoints are controlled mkdtemp fixture paths
          await fs.symlink(outsideTarget, symlinkTarget, 'file');
          await write('references/guide.md', '[escape](../scripts/cli/escape.ts)');
        },
        ['L1-only 目标越出 skill 根'],
        true,
      ],
      [
        'rejects L1 file and directory symlinks instead of classifying them as L1-only',
        async ({ root, write }: SymlinkFixture) => {
          const fileTarget = path.join(root, 'l1-file-target.ts');
          const directoryTarget = path.join(root, 'l1-directory-target');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture targets are beneath the mkdtemp-owned skill root
          await fs.writeFile(fileTarget, 'export {};\n', 'utf8');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture targets are beneath the mkdtemp-owned skill root
          await fs.mkdir(directoryTarget, { recursive: true });
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture targets are beneath the mkdtemp-owned skill root
          await fs.mkdir(path.join(root, 'scripts', 'cli'), {
            recursive: true,
          });
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- symlink endpoints are controlled mkdtemp fixture paths
          await fs.symlink(fileTarget, path.join(root, 'scripts', 'cli', 'linked.ts'), 'file');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- symlink endpoints are controlled mkdtemp fixture paths
          await fs.symlink(
            directoryTarget,
            path.join(root, 'scripts', 'linked-directory'),
            process.platform === 'win32' ? 'junction' : 'dir',
          );
          await write(
            'references/guide.md',
            '[file](../scripts/cli/linked.ts) [directory](../scripts/linked-directory/readme.md)',
          );
        },
        ['L1-only 文件 symlink/junction', 'L1-only 目录 symlink/junction'],
        true,
      ],
      [
        'rejects a top-level L1 directory symlink without traversing its target',
        async ({ root }: SymlinkFixture) => {
          const scriptsTarget = path.join(root, 'scripts-target');
          const scriptsDirectory = path.join(root, 'scripts');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- scriptsTarget is beneath the mkdtemp-owned skill root
          await fs.mkdir(scriptsTarget, { recursive: true });
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- scriptsDirectory is a controlled mkdtemp fixture path
          await fs.symlink(scriptsTarget, scriptsDirectory, process.platform === 'win32' ? 'junction' : 'dir');
        },
        ['L1-only 目录 symlink/junction 不允许 scripts'],
        false,
      ],
      [
        'rejects unreferenced L1 symlinks and broken symlinks without traversing them',
        async ({ root, outside }: SymlinkFixture) => {
          const outsideTarget = path.join(outside, 'outside.ts');
          const l1Directory = path.join(root, 'scripts', 'unreferenced-dir');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- outsideTarget is beneath the mkdtemp-owned escape fixture root
          await fs.writeFile(outsideTarget, 'export {};\n', 'utf8');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- l1Directory is beneath the mkdtemp-owned skill fixture root
          await fs.mkdir(l1Directory, { recursive: true });
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- L1 fixture parents are beneath the mkdtemp-owned skill root
          await fs.mkdir(path.join(root, 'samples'), { recursive: true });
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- L1 fixture parents are beneath the mkdtemp-owned skill root
          await fs.mkdir(path.join(root, 'tools'), { recursive: true });
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture targets are beneath the mkdtemp-owned skill root
          await fs.symlink(outsideTarget, path.join(root, 'scripts', 'unreferenced.ts'), 'file');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- symlink endpoints are controlled mkdtemp fixture paths
          await fs.symlink(
            l1Directory,
            path.join(root, 'samples', 'unreferenced-dir'),
            process.platform === 'win32' ? 'junction' : 'dir',
          );
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- broken symlink endpoint is a controlled mkdtemp fixture path
          await fs.symlink(
            path.join(root, 'scripts', 'does-not-exist.ts'),
            path.join(root, 'tools', 'broken.ts'),
            'file',
          );
        },
        [
          'L1-only 文件越出 skill 根',
          'L1-only 目录 symlink/junction 不允许',
          'L1-only 条目 symlink/junction 目标不存在',
        ],
        true,
      ],
    ] as const) {
      const fx = await makeSymlinkFixture();
      try {
        await setup(fx);
        const result = await auditL0RelativeLinks(fx.root);
        if (assertEmptyL1Only) {
          expect(result.l1Only, `${场景}: 不得归为 L1-only`).toEqual([]);
        }
        for (const marker of 期望) {
          expect(result.violations, `${场景}: 应含「${marker}」`).toContainEqual(expect.stringContaining(marker));
        }
      } finally {
        await fs.rm(fx.root, { recursive: true, force: true });
        await fs.rm(fx.outside, { recursive: true, force: true });
      }
    }
  });

  it('rejects malformed percent encoding（4 态：链接 body / fragment / 外部 URI / 纯 anchor）', async () => {
    for (const [位置, markdown, extraFiles] of [
      ['链接 body', '[malformed](./bad%2)', []],
      ['链接 fragment', '[malformed fragment](./valid.md#bad%2)', [['references/valid.md', '# valid\n']]],
      ['外部 URI', '[malformed external](https://example.test/%2)', []],
      ['纯 anchor', '[malformed anchor](#section%2)', []],
    ] as const) {
      for (const [rel, content] of extraFiles) {
        await write(rel, content);
      }
      await write('references/guide.md', markdown);

      const result = await auditL0RelativeLinks(fixtureRoot);

      expect(result.violations, `${位置}: 应报「链接 URI 编码无效」`).toContainEqual(
        expect.stringContaining('链接 URI 编码无效'),
      );
    }
  });

  it('treats Windows drive-letter paths as package links, not external URIs', async () => {
    await write('references/guide.md', '[forward slash](C:/outside.md) [backslash](C:\\outside.md)');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.l1Only).toEqual([]);
    expect(result.violations).toHaveLength(2);
    expect(result.violations).toEqual(
      expect.arrayContaining([expect.stringContaining('C:/outside.md'), expect.stringContaining('C:\\outside.md')]),
    );
  });

  it('keeps valid external and anchor URIs outside relative-link auditing', async () => {
    await write(
      'references/guide.md',
      '[web](https://example.test/guide) [email](mailto:owner@example.test) [anchor](#section)',
    );

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.relativeLinkCount).toBe(0);
    expect(result.violations).toEqual([]);
  });

  it('rejects missing non-L1 relative targets', async () => {
    await write('references/guide.md', '[missing](./missing.md)');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(expect.stringContaining('相对链接目标不存在'));
  });

  it('collects a reference-style definition whose target does not exist as a violation', async () => {
    await write('references/readme.md', '[text][docs] [docs][]\n\n[docs]: ./guide.md');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.relativeLinkCount).toBe(1);
    expect(result.violations).toContainEqual(expect.stringContaining('相对链接目标不存在'));
  });

  it('counts an existing reference-style definition target in relativeLinkCount', async () => {
    await write('references/readme.md', '[text][docs] [docs][]\n\n[docs]: ./guide.md');
    await write('references/guide.md', '# guide\n');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.relativeLinkCount).toBe(1);
    expect(result.violations).toEqual([]);
  });

  it('parses inline angle-bracket target with title without trailing ">"', async () => {
    await write('references/guide.md', '[a](<./x.md> "title")');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.relativeLinkCount).toBe(1);
    expect(result.violations).toEqual(['references/guide.md: 相对链接目标不存在 → ./x.md']);
  });

  it('parses reference definitions without whitespace after colon', async () => {
    await write('references/readme.md', '[a]:./x.md');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.relativeLinkCount).toBe(1);
    expect(result.violations).toEqual(['references/readme.md: 相对链接目标不存在 → ./x.md']);
  });

  it('parses reference definitions with destination on the next line', async () => {
    await write('references/readme.md', '[a]:\n  ./x.md');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.relativeLinkCount).toBe(1);
    expect(result.violations).toEqual(['references/readme.md: 相对链接目标不存在 → ./x.md']);
  });

  it('reference definition target 不得吞并后续行', async () => {
    await write('references/guide.md', '[b]:./y.md\n[c]:\n  ./z.md\n[d](./w.md)\n');
    await write('references/y.md');
    await write('references/z.md');
    await write('references/w.md');

    const result = await auditL0RelativeLinks(fixtureRoot);

    // 期望仅采集 [b]→./y.md、[c]→./z.md、[d]→./w.md 三条相对链接；target 不含换行
    expect(result.relativeLinkCount).toBe(3);
    expect(result.violations).toEqual([]);
  });

  it('平衡括号 bare destination 归一', async () => {
    await write('references/guide.md', '[f]: (./x2.md)\n');
    await write('references/x2.md');

    const result = await auditL0RelativeLinks(fixtureRoot);

    // 期望 target 归一为 ./x2.md（x2.md 存在 → 无 violation）
    expect(result.relativeLinkCount).toBe(1);
    expect(result.violations).toEqual([]);
  });

  it('classifies single-letter scheme (C:temp) as package-relative, not URI', async () => {
    await write('references/guide.md', '[a](C:temp)');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.relativeLinkCount).toBe(1);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toContain('C:temp');
  });

  it('rejects a root-relative target outside the skill package boundary', async () => {
    await write('references/guide.md', '[outside](/outside/readme.md)');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(expect.stringContaining('不允许的分发边界'));
  });

  it('rejects a relative target outside the L0 roots when it is not an L1-only boundary', async () => {
    await write('references/guide.md', '[outside](../other/readme.md)');
    await write('other/readme.md');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(expect.stringContaining('不允许的分发边界'));
  });

  it('classifies {{module}} only inside templates as a placeholder', async () => {
    await write('templates/template.md', '[module](./{{module}}-contract.md)');
    await write('references/guide.md', '[module](./{{module}}-contract.md)');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.templatePlaceholders).toHaveLength(1);
    expect(result.violations).toContainEqual(expect.stringContaining('非模板文件不得使用 {{module}} 占位链接'));
  });

  it('rejects malformed URI encoding even when a template placeholder is present（templatePlaceholders 不误收，1 态）', async () => {
    await write('templates/template.md', '[malformed](./{{module}}-contract%2)');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.templatePlaceholders).toEqual([]);
    expect(result.violations).toContainEqual(expect.stringContaining('链接 URI 编码无效'));
  });

  it('audits the real skill package without hiding L0 boundaries', async () => {
    const result = await auditL0RelativeLinks(SKILL_ROOT);

    expect(result.violations).toEqual([]);
  });

  it('normalizes a relative skill root before classifying ../SKILL.md links', async () => {
    const relativeRoot = path.relative(process.cwd(), SKILL_ROOT);
    const result = await auditL0RelativeLinks(relativeRoot);

    expect(result.violations).toEqual([]);
  });

  it('requires the consumer-project contribution guide placeholder and rejects the old relative link', async () => {
    const content = await fs.readFile(path.join(SKILL_ROOT, 'subagent', 'engineering-technical-writer.md'), 'utf8');

    expect(content).toContain('{{CONTRIBUTING_URL}}');
    expect(content).not.toContain('](CONTRIBUTING.md)');
  });
});
