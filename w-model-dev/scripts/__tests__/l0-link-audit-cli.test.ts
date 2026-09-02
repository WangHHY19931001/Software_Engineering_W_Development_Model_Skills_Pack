/* eslint-disable security/detect-non-literal-fs-filename -- CLI fixtures are created beneath a test-owned temporary directory. */

import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '../../..');
const SCRIPT = path.join(REPO_ROOT, 'w-model-dev', 'scripts', 'application', 'audit-l0-links.ts');
const PACKAGE_JSON = path.join(REPO_ROOT, 'package.json');
const L0_DIRECTORIES = ['references', 'templates', 'examples', 'subagent', 'schemas'];
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'l0-link-audit-cli-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function run(args: string[]): { code: number | null; stdout: string; stderr: string } {
  const result = runSync(process.execPath, [tsxCli, SCRIPT, ...args], { cwd: REPO_ROOT });
  return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

async function createMinimalL0(root: string): Promise<void> {
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, 'SKILL.md'), '# skill\n', 'utf8');
  await Promise.all(L0_DIRECTORIES.map((directory) => fs.mkdir(path.join(root, directory), { recursive: true })));
}

describe('audit-l0-links application entrypoint', () => {
  it('registers the public npm delivery command and documentation entrypoints', async () => {
    const packageJson = JSON.parse(await fs.readFile(PACKAGE_JSON, 'utf8')) as { scripts?: Record<string, string> };
    const commandReference = await fs.readFile(
      path.join(REPO_ROOT, 'w-model-dev', 'references', 'command-reference.md'),
      'utf8',
    );
    const toolbox = await fs.readFile(path.join(REPO_ROOT, 'w-model-dev', 'references', 'toolbox.md'), 'utf8');
    const delegation = await fs.readFile(
      path.join(REPO_ROOT, 'w-model-dev', 'references', 'subagent-delegation.md'),
      'utf8',
    );

    expect(packageJson.scripts?.['audit:l0-links']).toBe('tsx w-model-dev/scripts/application/audit-l0-links.ts');
    expect(commandReference).toContain('npm run audit:l0-links [-- --root=<skill-root>]');
    expect(toolbox).toContain('npm run audit:l0-links [-- --root=<skill-root>]');
    expect(delegation).toContain('audit-l0-links（application）');
  });

  it('returns a structured exit 0 audit for the distributed skill package', () => {
    const result = run([]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('L0_LINK_AUDIT_JSON');
    expect(JSON.parse(result.stdout.replace('L0_LINK_AUDIT_JSON ', ''))).toMatchObject({
      type: 'l0-link-audit',
      passed: true,
      l1OnlyCount: 92,
      templatePlaceholderCount: 36,
      violations: [],
      exitCode: 0,
    });
  });

  it('audits an explicit --root skill package successfully', async () => {
    const root = path.join(tmpDir, 'explicit skill root');
    await createMinimalL0(root);

    const result = run([`--root=${root}`]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('L0_LINK_AUDIT_JSON');
    expect(JSON.parse(result.stdout.replace('L0_LINK_AUDIT_JSON ', ''))).toMatchObject({
      type: 'l0-link-audit',
      passed: true,
      relativeLinkCount: 0,
      violations: [],
      exitCode: 0,
    });
  });

  it('returns a structured exit 1 audit failure for a missing L0 directory', async () => {
    const root = path.join(tmpDir, 'broken-skill');
    await createMinimalL0(root);
    await fs.rm(path.join(root, 'templates'), { recursive: true, force: true });

    const result = run([`--root=${root}`]);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('L0_LINK_AUDIT_JSON');
    expect(JSON.parse(result.stdout.replace('L0_LINK_AUDIT_JSON ', ''))).toMatchObject({
      type: 'l0-link-audit',
      passed: false,
      exitCode: 1,
    });
    expect(JSON.parse(result.stdout.replace('L0_LINK_AUDIT_JSON ', '')).violations).toContainEqual(
      expect.stringContaining('必需 L0 目录不存在或不可读 templates'),
    );
  });

  it('returns a structured exit 1 instead of an unexpected error for malformed URI encoding', async () => {
    const root = path.join(tmpDir, 'malformed-uri-skill');
    await createMinimalL0(root);
    await fs.writeFile(path.join(root, 'references', 'guide.md'), '[bad fragment](./valid.md#bad%2)\n', 'utf8');
    await fs.writeFile(path.join(root, 'references', 'valid.md'), '# valid\n', 'utf8');

    const result = run([`--root=${root}`]);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('L0_LINK_AUDIT_JSON');
    expect(result.stdout).not.toContain('ERROR_JSON');
    expect(JSON.parse(result.stdout.replace('L0_LINK_AUDIT_JSON ', '')).violations).toContainEqual(
      expect.stringContaining('链接 URI 编码无效'),
    );
  });

  it('returns structured exit 1 for malformed external URI encoding', async () => {
    const root = path.join(tmpDir, 'malformed-external-uri-skill');
    await createMinimalL0(root);
    await fs.writeFile(path.join(root, 'references', 'guide.md'), '[bad external](https://example.test/%2)\n', 'utf8');

    const result = run([`--root=${root}`]);

    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout.replace('L0_LINK_AUDIT_JSON ', '')).violations).toContainEqual(
      expect.stringContaining('链接 URI 编码无效'),
    );
  });

  it('returns a structured exit 1 for a missing required SKILL.md file', async () => {
    const root = path.join(tmpDir, 'missing-skill-file');
    await createMinimalL0(root);
    await fs.rm(path.join(root, 'SKILL.md'), { force: true });

    const result = run([`--root=${root}`]);

    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout.replace('L0_LINK_AUDIT_JSON ', '')).violations).toContainEqual(
      expect.stringContaining('必需 L0 文件不存在或不可读 SKILL.md'),
    );
  });

  it('returns a structured exit 1 for a missing explicit skill root', async () => {
    const root = path.join(tmpDir, 'missing-skill-root');

    const result = run([`--root=${root}`]);

    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout.replace('L0_LINK_AUDIT_JSON ', '')).violations).toContainEqual(
      expect.stringContaining('skill 根目录不存在或不可读'),
    );
  });

  it('returns structured exit 2 for an unknown argument', () => {
    const result = run(['--unknown']);

    expect(result.code).toBe(2);
    expect(result.stdout).toContain('ERROR_JSON');
    expect(JSON.parse(result.stdout.replace('ERROR_JSON ', ''))).toMatchObject({
      category: 'ARG_INVALID',
      exitCode: 2,
    });
  });
});
