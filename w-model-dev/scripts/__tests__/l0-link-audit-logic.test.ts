import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { auditL0RelativeLinks } from '../logic/l0-link-audit-logic.js';

import { L0_BASELINE } from './helpers/l0-baseline.js';

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

  it('rejects an L1-only target whose real path escapes the skill root', async () => {
    const outsideTarget = path.join(outsideRoot, 'escape.ts');
    const symlinkTarget = path.join(fixtureRoot, 'scripts', 'cli', 'escape.ts');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- outsideTarget is beneath the mkdtemp-owned escape fixture root
    await fs.writeFile(outsideTarget, 'export {};', 'utf8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- symlinkTarget is beneath the mkdtemp-owned skill fixture root
    await fs.mkdir(path.dirname(symlinkTarget), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- both symlink endpoints are controlled mkdtemp fixture paths
    await fs.symlink(outsideTarget, symlinkTarget, 'file');
    await write('references/guide.md', '[escape](../scripts/cli/escape.ts)');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.l1Only).toEqual([]);
    expect(result.violations).toContainEqual(expect.stringContaining('L1-only 目标越出 skill 根'));
  });

  it('rejects an L0 source file whose real path escapes the skill root', async () => {
    const outsideSource = path.join(outsideRoot, 'outside.md');
    const sourceLink = path.join(fixtureRoot, 'references', 'outside.md');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- outsideSource is beneath the mkdtemp-owned escape fixture root
    await fs.writeFile(outsideSource, '[inside](../SKILL.md)', 'utf8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- both symlink endpoints are controlled mkdtemp fixture paths
    await fs.symlink(outsideSource, sourceLink, 'file');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(expect.stringContaining('L0 源文件越出 skill 根 references/outside.md'));
  });

  it('rejects an L0 directory symlink or junction whose real path escapes the skill root', async () => {
    const outsideDirectory = path.join(outsideRoot, 'nested');
    const directoryLink = path.join(fixtureRoot, 'references', 'escaped-directory');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- outsideDirectory is beneath the mkdtemp-owned escape fixture root
    await fs.mkdir(outsideDirectory, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- outsideDirectory is beneath the mkdtemp-owned escape fixture root
    await fs.writeFile(path.join(outsideDirectory, 'outside.md'), '# outside\n', 'utf8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- both symlink endpoints are controlled mkdtemp fixture paths
    await fs.symlink(outsideDirectory, directoryLink, process.platform === 'win32' ? 'junction' : 'dir');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(
      expect.stringContaining('L0 目录越出 skill 根 references/escaped-directory'),
    );
  });

  it('rejects a top-level L0 directory symlink or junction even when it stays inside the skill root', async () => {
    const targetDirectory = path.join(fixtureRoot, 'references-target');
    const directoryLink = path.join(fixtureRoot, 'references');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- targetDirectory is beneath the mkdtemp-owned skill fixture root
    await fs.mkdir(targetDirectory, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- directoryLink is a controlled mkdtemp fixture path
    await fs.rm(directoryLink, { recursive: true, force: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- both symlink endpoints are controlled mkdtemp fixture paths
    await fs.symlink(targetDirectory, directoryLink, process.platform === 'win32' ? 'junction' : 'dir');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(expect.stringContaining('L0 目录 symlink/junction 不允许 references'));
  });

  it('rejects L0 Markdown, non-Markdown, and required SKILL.md symlinks even when targets stay inside the package', async () => {
    const markdownTarget = path.join(fixtureRoot, 'markdown-target.md');
    const binaryTarget = path.join(fixtureRoot, 'binary-target.bin');
    const skillTarget = path.join(fixtureRoot, 'skill-target.md');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture targets are beneath the mkdtemp-owned skill root
    await fs.writeFile(markdownTarget, '# target\n', 'utf8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture targets are beneath the mkdtemp-owned skill root
    await fs.writeFile(binaryTarget, 'binary\n', 'utf8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture targets are beneath the mkdtemp-owned skill root
    await fs.writeFile(skillTarget, '# target skill\n', 'utf8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- symlink endpoints are controlled mkdtemp fixture paths
    await fs.symlink(markdownTarget, path.join(fixtureRoot, 'references', 'guide.md'), 'file');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- symlink endpoints are controlled mkdtemp fixture paths
    await fs.symlink(binaryTarget, path.join(fixtureRoot, 'schemas', 'schema.bin'), 'file');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- replace the required root file with a controlled symlink
    await fs.rm(path.join(fixtureRoot, 'SKILL.md'), { force: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- symlink endpoints are controlled mkdtemp fixture paths
    await fs.symlink(skillTarget, path.join(fixtureRoot, 'SKILL.md'), 'file');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(expect.stringContaining('L0 源文件 symlink/junction 不允许 SKILL.md'));
    expect(result.violations).toContainEqual(
      expect.stringContaining('L0 文件 symlink/junction 不允许 references/guide.md'),
    );
    expect(result.violations).toContainEqual(
      expect.stringContaining('L0 文件 symlink/junction 不允许 schemas/schema.bin'),
    );
  });

  it('rejects L1 file and directory symlinks instead of classifying them as L1-only', async () => {
    const fileTarget = path.join(fixtureRoot, 'l1-file-target.ts');
    const directoryTarget = path.join(fixtureRoot, 'l1-directory-target');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture targets are beneath the mkdtemp-owned skill root
    await fs.writeFile(fileTarget, 'export {};\n', 'utf8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture targets are beneath the mkdtemp-owned skill root
    await fs.mkdir(directoryTarget, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture targets are beneath the mkdtemp-owned skill root
    await fs.mkdir(path.join(fixtureRoot, 'scripts', 'cli'), {
      recursive: true,
    });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- symlink endpoints are controlled mkdtemp fixture paths
    await fs.symlink(fileTarget, path.join(fixtureRoot, 'scripts', 'cli', 'linked.ts'), 'file');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture targets are beneath the mkdtemp-owned skill root
    await fs.symlink(
      directoryTarget,
      path.join(fixtureRoot, 'scripts', 'linked-directory'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await write(
      'references/guide.md',
      '[file](../scripts/cli/linked.ts) [directory](../scripts/linked-directory/readme.md)',
    );

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.l1Only).toEqual([]);
    expect(result.violations).toContainEqual(expect.stringContaining('L1-only 文件 symlink/junction'));
    expect(result.violations).toContainEqual(expect.stringContaining('L1-only 目录 symlink/junction'));
  });

  it('rejects a top-level L1 directory symlink without traversing its target', async () => {
    const scriptsTarget = path.join(fixtureRoot, 'scripts-target');
    const scriptsDirectory = path.join(fixtureRoot, 'scripts');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- scriptsTarget is beneath the mkdtemp-owned skill root
    await fs.mkdir(scriptsTarget, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- scriptsDirectory is a controlled mkdtemp fixture path
    await fs.symlink(scriptsTarget, scriptsDirectory, process.platform === 'win32' ? 'junction' : 'dir');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(expect.stringContaining('L1-only 目录 symlink/junction 不允许 scripts'));
  });

  it('rejects unreferenced L1 symlinks and broken symlinks without traversing them', async () => {
    const outsideTarget = path.join(outsideRoot, 'outside.ts');
    const l1Directory = path.join(fixtureRoot, 'scripts', 'unreferenced-dir');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- outsideTarget is beneath the mkdtemp-owned escape fixture root
    await fs.writeFile(outsideTarget, 'export {};\n', 'utf8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- l1Directory is beneath the mkdtemp-owned skill fixture root
    await fs.mkdir(l1Directory, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- L1 fixture parents are beneath the mkdtemp-owned skill root
    await fs.mkdir(path.join(fixtureRoot, 'samples'), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- L1 fixture parents are beneath the mkdtemp-owned skill root
    await fs.mkdir(path.join(fixtureRoot, 'tools'), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture targets are beneath the mkdtemp-owned skill root
    await fs.symlink(outsideTarget, path.join(fixtureRoot, 'scripts', 'unreferenced.ts'), 'file');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- symlink endpoints are controlled mkdtemp fixture paths
    await fs.symlink(
      l1Directory,
      path.join(fixtureRoot, 'samples', 'unreferenced-dir'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- broken symlink endpoint is a controlled mkdtemp fixture path
    await fs.symlink(
      path.join(fixtureRoot, 'scripts', 'does-not-exist.ts'),
      path.join(fixtureRoot, 'tools', 'broken.ts'),
      'file',
    );

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.l1Only).toEqual([]);
    expect(result.violations).toContainEqual(expect.stringContaining('L1-only 文件越出 skill 根'));
    expect(result.violations).toContainEqual(expect.stringContaining('L1-only 目录 symlink/junction 不允许'));
    expect(result.violations).toContainEqual(expect.stringContaining('L1-only 条目 symlink/junction 目标不存在'));
  });

  it('turns malformed percent encoding into a structured violation', async () => {
    await write('references/guide.md', '[malformed](./bad%2)');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(expect.stringContaining('链接 URI 编码无效'));
  });

  it('rejects malformed percent encoding in a link fragment without throwing', async () => {
    await write('references/guide.md', '[malformed fragment](./valid.md#bad%2)');
    await write('references/valid.md', '# valid\n');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(expect.stringContaining('链接 URI 编码无效'));
  });

  it('rejects malformed percent encoding in an external URI instead of skipping it', async () => {
    await write('references/guide.md', '[malformed external](https://example.test/%2)');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(expect.stringContaining('链接 URI 编码无效'));
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

  it('rejects malformed percent encoding in an anchor-only URI instead of skipping it', async () => {
    await write('references/guide.md', '[malformed anchor](#section%2)');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(expect.stringContaining('链接 URI 编码无效'));
  });

  it('rejects a skill root symlink or junction without traversing its target', async () => {
    const rootTarget = path.join(outsideRoot, 'skill-root-target');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- rootTarget is a controlled mkdtemp fixture path
    await fs.mkdir(rootTarget, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- rootTarget is a controlled mkdtemp fixture path
    await fs.writeFile(path.join(rootTarget, 'SKILL.md'), '# outside\n', 'utf8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixtureRoot is a controlled mkdtemp fixture path
    await fs.rm(fixtureRoot, { recursive: true, force: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- both symlink endpoints are controlled mkdtemp fixture paths
    await fs.symlink(rootTarget, fixtureRoot, process.platform === 'win32' ? 'junction' : 'dir');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(expect.stringContaining('skill 根目录 symlink/junction 不允许'));
  });

  it('rejects a required L0 SKILL.md symlink whose target escapes the skill root', async () => {
    const outsideSkill = path.join(outsideRoot, 'outside-skill.md');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- outsideSkill is beneath the mkdtemp-owned escape fixture root
    await fs.writeFile(outsideSkill, '# outside skill\n', 'utf8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- the symlink endpoint is a controlled mkdtemp fixture path
    await fs.rm(path.join(fixtureRoot, 'SKILL.md'), { force: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- both symlink endpoints are controlled mkdtemp fixture paths
    await fs.symlink(outsideSkill, path.join(fixtureRoot, 'SKILL.md'), 'file');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(expect.stringContaining('必需 L0 文件越出 skill 根 SKILL.md'));
  });

  it('rejects non-Markdown L0 and L1 directory symlinks whose targets escape the skill root', async () => {
    const outsideDirectory = path.join(outsideRoot, 'outside-directory');
    const l0Link = path.join(fixtureRoot, 'schemas', 'outside-directory');
    const l1Link = path.join(fixtureRoot, 'tools', 'outside-directory');
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

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(expect.stringContaining('L0 目录越出 skill 根 schemas/outside-directory'));
    expect(result.violations).toContainEqual(
      expect.stringContaining('L1-only 目录越出 skill 根 tools/outside-directory'),
    );
  });

  it('rejects an internal non-Markdown L0 directory symlink or junction', async () => {
    const targetDirectory = path.join(fixtureRoot, 'schema-target');
    const directoryLink = path.join(fixtureRoot, 'schemas', 'linked-data');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- targetDirectory is beneath the mkdtemp-owned skill root
    await fs.mkdir(targetDirectory, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- directoryLink is a controlled mkdtemp fixture path
    await fs.symlink(targetDirectory, directoryLink, process.platform === 'win32' ? 'junction' : 'dir');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(
      expect.stringContaining('L0 目录 symlink/junction 不允许 schemas/linked-data'),
    );
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

  it('rejects malformed URI encoding even when a template placeholder is present', async () => {
    await write('templates/template.md', '[malformed](./{{module}}-contract%2)');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.templatePlaceholders).toEqual([]);
    expect(result.violations).toContainEqual(expect.stringContaining('链接 URI 编码无效'));
  });

  it('audits the real skill package without hiding L0 boundaries', async () => {
    const result = await auditL0RelativeLinks(SKILL_ROOT);

    // 基线三数单一事实来源见 helpers/l0-baseline.ts（npm run audit:l0-links 实测）。
    // 当前解析值说明：647（42.2.1 基线）+ 2 条新引用（workflow.md「阶段 5-8 门禁顺序与
    // ChangeScope」注记链接到 command-reference.md 与 subagent-delegation.md，
    // 2026-09-04 gate-closure doc sync）= 649。
    expect(result.relativeLinkCount).toBe(L0_BASELINE.relativeLinkCount);
    expect(result.l1Only).toHaveLength(L0_BASELINE.l1Only);
    expect(result.templatePlaceholders).toHaveLength(L0_BASELINE.placeholders);
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
