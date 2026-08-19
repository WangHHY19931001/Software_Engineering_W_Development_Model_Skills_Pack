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

  it('does not register a path outside the supplied project root', () => {
    expect(
      resolveStateSchema(path.resolve('C:', 'workspace', 'other-project', '.w-model', 'project.json'), projectRoot),
    ).toBeNull();
  });

  it('uses one case-insensitive Windows key for registered and unregistered state targets', () => {
    const uppercaseProject = `${projectRoot}\\.W-MODEL\\PROJECT.JSON`;
    const uppercaseCustom = `${projectRoot}\\.W-MODEL\\CUSTOM.JSON`;

    expect(resolveStateSchema(uppercaseProject, projectRoot, 'win32')).toMatchObject({ schemaName: 'project' });
    expect(isProjectStateTarget(uppercaseProject, projectRoot, 'win32')).toBe(true);
    expect(resolveStateSchema(uppercaseCustom, projectRoot, 'win32')).toBeNull();
    expect(isProjectStateTarget(uppercaseCustom, projectRoot, 'win32')).toBe(true);
    expect(resolveStateSchema('C:\\workspace\\other-project\\.W-MODEL\\PROJECT.JSON', projectRoot, 'win32')).toBeNull();
  });

  it('keeps POSIX state target matching case-sensitive', () => {
    const posixRoot = '/workspace/example-project';
    expect(resolveStateSchema('/workspace/example-project/.W-MODEL/PROJECT.JSON', posixRoot, 'linux')).toBeNull();
    expect(isProjectStateTarget('/workspace/example-project/.W-MODEL/CUSTOM.JSON', posixRoot, 'linux')).toBe(false);
  });
});
