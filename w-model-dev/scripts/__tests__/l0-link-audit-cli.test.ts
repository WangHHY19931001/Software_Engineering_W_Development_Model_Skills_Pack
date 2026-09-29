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
  // Load-sensitive: the real `tsx` CLI can exceed the 15 s runSync default when the full suite runs in
  // parallel (spawnSync then reports `status: null`). 60 s keeps the bounded-timeout intent; assertions
  // are unchanged.
  const result = runSync(process.execPath, [tsxCli, SCRIPT, ...args], { cwd: REPO_ROOT, timeout: 60_000 });
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
    const readme = await fs.readFile(path.join(REPO_ROOT, 'README.md'), 'utf8');
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
    expect(readme).toContain('npm run audit:l0-links');
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

  it('returns structured exit-1 编码类拒绝行（3 态：相对链接畸形 URI / 外部 URI 畸形编码 / Windows 盘符路径）', async () => {
    for (const { caseName, files, markers, assertJsonMarker, assertNoErrorJson, assertPayloadShape } of [
      {
        caseName: '相对链接畸形 URI 编码',
        files: [
          ['references/guide.md', '[bad fragment](./valid.md#bad%2)\n'],
          ['references/valid.md', '# valid\n'],
        ],
        markers: ['链接 URI 编码无效'],
        assertJsonMarker: true,
        assertNoErrorJson: true,
        assertPayloadShape: false,
      },
      {
        caseName: '外部 URI 畸形编码',
        files: [['references/guide.md', '[bad external](https://example.test/%2)\n']],
        markers: ['链接 URI 编码无效'],
        assertJsonMarker: false,
        assertNoErrorJson: false,
        assertPayloadShape: false,
      },
      {
        caseName: 'Windows 盘符路径不按 URI 跳过',
        files: [['references/guide.md', '[forward slash](C:/outside.md) [backslash](C:\\outside.md)\n']],
        markers: ['C:/outside.md', 'C:\\outside.md'],
        assertJsonMarker: false,
        assertNoErrorJson: false,
        assertPayloadShape: true,
      },
    ] as const) {
      const root = path.join(tmpDir, `encoding-${caseName}`);
      await createMinimalL0(root);
      for (const [rel, content] of files) {
        await fs.writeFile(path.join(root, ...rel.split('/')), content, 'utf8');
      }

      const result = run([`--root=${root}`]);
      const payload = JSON.parse(result.stdout.replace('L0_LINK_AUDIT_JSON ', ''));

      expect(result.code, `${caseName}: 应 structured exit 1`).toBe(1);
      if (assertJsonMarker) {
        expect(result.stdout, `${caseName}: stdout 应含 L0_LINK_AUDIT_JSON`).toContain('L0_LINK_AUDIT_JSON');
      }
      if (assertNoErrorJson) {
        expect(result.stdout, `${caseName}: 结构化违规不得误走 ERROR_JSON`).not.toContain('ERROR_JSON');
      }
      if (assertPayloadShape) {
        expect(payload, `${caseName}: payload 应 structured exit 1 形态`).toMatchObject({
          type: 'l0-link-audit',
          passed: false,
          exitCode: 1,
        });
      }
      expect(payload.violations, `${caseName}: violations 应具名 ${markers.join(' / ')}`).toEqual(
        expect.arrayContaining(markers.map((marker) => expect.stringContaining(marker))),
      );
    }
  }, 120_000);

  it('returns structured exit-1 缺失类拒绝行（3 态：缺 L0 目录 / 缺 SKILL.md / 缺显式 skill 根）', async () => {
    for (const { caseName, setup, marker, assertJsonMarker, assertPayloadShape } of [
      {
        caseName: '缺必需 L0 目录（templates 被删）',
        setup: 'remove-templates',
        marker: '必需 L0 目录不存在或不可读 templates',
        assertJsonMarker: true,
        assertPayloadShape: true,
      },
      {
        caseName: '缺必需 SKILL.md 文件',
        setup: 'remove-skill-md',
        marker: '必需 L0 文件不存在或不可读 SKILL.md',
        assertJsonMarker: false,
        assertPayloadShape: false,
      },
      {
        caseName: '缺显式 skill 根（根目录整体缺失）',
        setup: 'missing-root',
        marker: 'skill 根目录不存在或不可读',
        assertJsonMarker: false,
        assertPayloadShape: false,
      },
    ] as const) {
      const root = path.join(tmpDir, `missing-${caseName}`);
      if (setup !== 'missing-root') {
        await createMinimalL0(root);
        if (setup === 'remove-templates') {
          await fs.rm(path.join(root, 'templates'), { recursive: true, force: true });
        } else {
          await fs.rm(path.join(root, 'SKILL.md'), { force: true });
        }
      }

      const result = run([`--root=${root}`]);

      expect(result.code, `${caseName}: 应 structured exit 1`).toBe(1);
      if (assertJsonMarker) {
        expect(result.stdout, `${caseName}: stdout 应含 L0_LINK_AUDIT_JSON`).toContain('L0_LINK_AUDIT_JSON');
      }
      const payload = JSON.parse(result.stdout.replace('L0_LINK_AUDIT_JSON ', ''));
      if (assertPayloadShape) {
        expect(payload, `${caseName}: payload 应 structured exit 1 形态`).toMatchObject({
          type: 'l0-link-audit',
          passed: false,
          exitCode: 1,
        });
      }
      expect(payload.violations, `${caseName}: violations 应具名「${marker}」`).toContainEqual(
        expect.stringContaining(marker),
      );
    }
  }, 120_000);

  it('keeps valid external and anchor URIs outside relative-link auditing', async () => {
    const root = path.join(tmpDir, 'valid-external-uri-skill');
    await createMinimalL0(root);
    await fs.writeFile(
      path.join(root, 'references', 'guide.md'),
      '[web](https://example.test/guide) [email](mailto:owner@example.test) [anchor](#section)\n',
      'utf8',
    );

    const result = run([`--root=${root}`]);
    const payload = JSON.parse(result.stdout.replace('L0_LINK_AUDIT_JSON ', ''));

    expect(result.code).toBe(0);
    expect(payload).toMatchObject({
      type: 'l0-link-audit',
      passed: true,
      relativeLinkCount: 0,
      violations: [],
      exitCode: 0,
    });
  });

  it('returns structured exit 2 for an unknown argument', () => {
    const result = run(['--unknown']);

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('✗ [ARG_INVALID]');
    expect(result.stdout).toContain('ERROR_JSON');
    expect(JSON.parse(result.stdout.replace('ERROR_JSON ', ''))).toMatchObject({
      category: 'ARG_INVALID',
      exitCode: 2,
    });
  });
});
