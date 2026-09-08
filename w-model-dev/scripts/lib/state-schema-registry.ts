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
  { relativePath: '.w-model/code-health/campaign.json', schemaName: 'code-health-campaign', format: 'json' },
  { relativePath: '.w-model/code-health/candidates.jsonl', schemaName: 'code-health-candidate', format: 'jsonl' },
  { relativePath: '.w-model/code-health/evidence.jsonl', schemaName: 'code-health-evidence', format: 'jsonl' },
  { relativePath: '.w-model/code-health/approvals.jsonl', schemaName: 'code-health-approval', format: 'jsonl' },
  { relativePath: '.w-model/code-health/archive.jsonl', schemaName: 'code-health-archive', format: 'jsonl' },
  { relativePath: '.w-model/code-health/gaps.jsonl', schemaName: 'code-health-gap', format: 'jsonl' },
  { relativePath: '.w-model/code-health/test-inventory.jsonl', schemaName: 'code-health-test-inventory', format: 'jsonl' },
  { relativePath: '.w-model/code-health/duplicate-clusters.jsonl', schemaName: 'code-health-duplicate-cluster', format: 'jsonl' },
  { relativePath: '.w-model/code-health/ledger.jsonl', schemaName: 'code-health-ledger-event', format: 'jsonl' },
];

/**
 * checkpoint-log/event-ingress/hill-climbing-report schemas currently have fixture-only inputs;
 * no runtime .w-model writer path is registered until a matching CLI write contract exists.
 */

function pathApiFor(platform: NodeJS.Platform): typeof path {
  return platform === 'win32' ? path.win32 : path.posix;
}

function relativeStateKey(absPath: string, projectRoot: string, platform: NodeJS.Platform): string | null {
  const pathApi = pathApiFor(platform);
  const target = pathApi.resolve(absPath);
  const root = pathApi.resolve(projectRoot);
  const relativePath = pathApi.relative(root, target);
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${pathApi.sep}`) ||
    pathApi.isAbsolute(relativePath)
  ) {
    return null;
  }
  const separatorNormalized = relativePath.replace(/\\/g, '/');
  return platform === 'win32' ? separatorNormalized.toLowerCase() : separatorNormalized;
}

export function resolveStateSchema(
  absPath: string,
  projectRoot: string,
  platform: NodeJS.Platform = process.platform,
): RegisteredStateSchema | null {
  const key = relativeStateKey(absPath, projectRoot, platform);
  if (!key) return null;
  return (
    REGISTERED_STATE_SCHEMAS.find((entry) => {
      const entryKey = platform === 'win32' ? entry.relativePath.toLowerCase() : entry.relativePath;
      return entryKey === key;
    }) ?? null
  );
}

export function inferProjectRoot(absPath: string): string {
  const pathApi = pathApiFor(process.platform);
  const target = pathApi.resolve(absPath);
  const marker = `${pathApi.sep}.w-model${pathApi.sep}`;
  const markerIndex =
    process.platform === 'win32' ? target.toLowerCase().lastIndexOf(marker) : target.lastIndexOf(marker);
  return markerIndex >= 0 ? target.slice(0, markerIndex) : process.cwd();
}

export function isProjectStateTarget(
  absPath: string,
  projectRoot: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  return relativeStateKey(absPath, projectRoot, platform)?.startsWith('.w-model/') === true;
}
