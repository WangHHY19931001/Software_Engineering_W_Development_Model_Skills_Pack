import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { isProjectStateTarget, resolveStateSchema } from '../lib/state-schema-registry.js';

describe('state schema registry', () => {
  const projectRoot = path.resolve('C:', 'workspace', 'example-project');

  it('resolves registered JSON and JSONL targets across platform separators', () => {
    expect(resolveStateSchema(path.join(projectRoot, '.w-model', 'project.json'), projectRoot)).toEqual({
      relativePath: '.w-model/project.json',
      schemaName: 'project',
      format: 'json',
    });
    expect(resolveStateSchema(`${projectRoot}\\.w-model\\run-log.jsonl`, projectRoot)).toEqual({
      relativePath: '.w-model/run-log.jsonl',
      schemaName: 'run-log',
      format: 'jsonl',
    });
  });

  it('keeps fixture-only state schemas out of the runtime registration table', () => {
    expect(
      [
        ['checkpoint-log.jsonl', 'jsonl'],
        ['event-ingress.jsonl', 'jsonl'],
        ['hill-climbing-report.json', 'json'],
      ].map(([name]) => resolveStateSchema(path.join(projectRoot, '.w-model', name!), projectRoot, 'win32')),
    ).toEqual([null, null, null]);
  });

  it('does not classify prefix-like or outside paths as project state targets（2 态：前缀形态 / 根外路径）', () => {
    const prefixLike = path.join(projectRoot, '.w-model-backup', 'custom.json');
    const outside = path.resolve('C:', 'workspace', 'other-project', '.w-model', 'custom.json');
    const rows = [
      { name: '前缀形态（.w-model-backup）', p: prefixLike },
      { name: '根外路径（other-project）', p: outside },
    ] as const;
    for (const row of rows) {
      expect(isProjectStateTarget(row.p, projectRoot), `${row.name} isProjectStateTarget 应为 false`).toBe(false);
      expect(resolveStateSchema(row.p, projectRoot), `${row.name} resolveStateSchema 应为 null`).toBeNull();
    }
  });

  it('uses one case-insensitive Windows key / keeps POSIX matching case-sensitive（2 态平台口径）', () => {
    // 态 1：Windows 不敏感（registered 与 unregistered 共用一个大小写不敏感键）
    const uppercaseProject = `${projectRoot}\\.W-MODEL\\PROJECT.JSON`;
    const uppercaseCustom = `${projectRoot}\\.W-MODEL\\CUSTOM.JSON`;
    expect(
      resolveStateSchema(uppercaseProject, projectRoot, 'win32'),
      'win32 大写 registered 路径解析出 project',
    ).toMatchObject({ schemaName: 'project' });
    expect(isProjectStateTarget(uppercaseProject, projectRoot, 'win32'), 'win32 大写 registered 路径在盘认定').toBe(
      true,
    );
    expect(resolveStateSchema(uppercaseCustom, projectRoot, 'win32'), 'win32 大写 unregistered 路径不注册').toBeNull();
    expect(isProjectStateTarget(uppercaseCustom, projectRoot, 'win32'), 'win32 大写 unregistered 路径在盘认定').toBe(
      true,
    );
    expect(
      resolveStateSchema('C:\\workspace\\other-project\\.W-MODEL\\PROJECT.JSON', projectRoot, 'win32'),
      'win32 根外大写路径不注册',
    ).toBeNull();
    // 态 2：POSIX 敏感
    const posixRoot = '/workspace/example-project';
    expect(
      resolveStateSchema('/workspace/example-project/.W-MODEL/PROJECT.JSON', posixRoot, 'linux'),
      'linux 大写 registered 路径不注册（大小写敏感）',
    ).toBeNull();
    expect(
      isProjectStateTarget('/workspace/example-project/.W-MODEL/CUSTOM.JSON', posixRoot, 'linux'),
      'linux 大写 custom 路径不在盘认定（大小写敏感）',
    ).toBe(false);
  });
});
