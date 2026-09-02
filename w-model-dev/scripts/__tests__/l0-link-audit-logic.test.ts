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
    await fs.rm(path.join(fixtureRoot, 'templates'), { recursive: true, force: true });

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
    await fs.mkdir(path.join(fixtureRoot, 'scripts', 'cli'), { recursive: true });
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

  it('rejects missing non-L1 relative targets', async () => {
    await write('references/guide.md', '[missing](./missing.md)');

    const result = await auditL0RelativeLinks(fixtureRoot);

    expect(result.violations).toContainEqual(expect.stringContaining('相对链接目标不存在'));
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

    expect(result.relativeLinkCount).toBe(647);
    expect(result.l1Only).toHaveLength(92);
    expect(result.templatePlaceholders).toHaveLength(36);
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
