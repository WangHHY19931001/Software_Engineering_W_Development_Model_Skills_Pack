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
  it('registers the public npm delivery command', async () => {
    const packageJson = JSON.parse(await fs.readFile(PACKAGE_JSON, 'utf8')) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.['audit:l0-links']).toBe('tsx w-model-dev/scripts/application/audit-l0-links.ts');
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
