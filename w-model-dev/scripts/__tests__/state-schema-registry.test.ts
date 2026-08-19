import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveStateSchema } from '../lib/state-schema-registry.js';

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
});
