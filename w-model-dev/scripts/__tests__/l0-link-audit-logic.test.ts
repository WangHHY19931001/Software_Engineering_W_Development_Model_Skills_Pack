import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { auditL0RelativeLinks } from '../logic/l0-link-audit-logic.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SKILL_ROOT = path.join(REPO_ROOT, 'w-model-dev');
let fixtureRoot: string;

async function write(relativePath: string, content = ''): Promise<void> {
  const target = path.join(fixtureRoot, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');
}

beforeEach(async () => {
  fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'l0-link-audit-'));
  await write('SKILL.md');
});

afterEach(async () => {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
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

  it('audits the real skill package without hiding L0 boundaries', async () => {
    const result = await auditL0RelativeLinks(SKILL_ROOT);

    expect(result.relativeLinkCount).toBe(645);
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
