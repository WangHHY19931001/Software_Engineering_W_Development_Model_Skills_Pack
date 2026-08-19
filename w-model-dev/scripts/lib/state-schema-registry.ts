import * as path from 'node:path';

export type RegisteredStateFormat = 'json' | 'jsonl';

export interface RegisteredStateSchema {
  relativePath: string;
  schemaName: string;
  format: RegisteredStateFormat;
}

const REGISTERED_STATE_SCHEMAS: readonly RegisteredStateSchema[] = [
  { relativePath: '.w-model/project.json', schemaName: 'project', format: 'json' },
  { relativePath: '.w-model/rtm.json', schemaName: 'rtm', format: 'json' },
  { relativePath: '.w-model/budget.json', schemaName: 'budget', format: 'json' },
  { relativePath: '.w-model/maturity.json', schemaName: 'maturity', format: 'json' },
  { relativePath: '.w-model/run-log.jsonl', schemaName: 'run-log', format: 'jsonl' },
];

/**
 * checkpoint-log/event-ingress/hill-climbing-report schemas currently have fixture-only inputs;
 * no runtime .w-model writer path is registered until a matching CLI write contract exists.
 */

function normalizedAbsolutePath(value: string): string {
  return path.resolve(value.replace(/\\/g, path.sep));
}

export function resolveStateSchema(absPath: string, projectRoot: string): RegisteredStateSchema | null {
  const target = normalizedAbsolutePath(absPath);
  const root = normalizedAbsolutePath(projectRoot);
  const relativePath = path.relative(root, target).replace(/\\/g, '/');
  if (relativePath === '' || relativePath === '..' || relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
    return null;
  }
  return REGISTERED_STATE_SCHEMAS.find((entry) => entry.relativePath === relativePath) ?? null;
}

export function inferProjectRoot(absPath: string): string {
  const target = normalizedAbsolutePath(absPath);
  const marker = `${path.sep}.w-model${path.sep}`;
  const markerIndex = target.lastIndexOf(marker);
  return markerIndex >= 0 ? target.slice(0, markerIndex) : process.cwd();
}

export function isProjectStateTarget(absPath: string, projectRoot: string): boolean {
  const target = normalizedAbsolutePath(absPath);
  const root = normalizedAbsolutePath(projectRoot);
  const relativePath = path.relative(root, target).replace(/\\/g, '/');
  return relativePath.startsWith('.w-model/');
}
