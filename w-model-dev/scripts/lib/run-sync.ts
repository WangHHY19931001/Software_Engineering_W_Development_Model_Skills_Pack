import { spawnSync, type SpawnSyncOptions, type SpawnSyncReturns } from 'node:child_process';

export const DEFAULT_SYNC_TIMEOUT_MS = 15_000;
export const DEFAULT_SYNC_MAX_BUFFER = 64 * 1024 * 1024;

/** Callers may tune safe execution settings but cannot weaken process termination or output typing. */
export type RunSyncOptions = Omit<SpawnSyncOptions, 'encoding' | 'killSignal'>;

type DirectSyncApi = 'spawnSync' | 'execSync' | 'execFileSync';
type SyncProcessException = {
  api: DirectSyncApi;
  file: string;
  line: number;
  symbol: string;
  reason: string;
  timeout: {
    required: true;
    status: 'present' | 'missing-followup';
  };
};

/**
 * Full scripts-directory inventory of direct synchronous child-process calls.
 * Direct calls are retained only where B4 scope prohibits migration or where their
 * command-specific implementation already needs a distinct API; each entry records
 * whether a process-level timeout is already present or requires follow-up work.
 */
export const SYNC_PROCESS_EXCEPTIONS: readonly SyncProcessException[] = [
  {
    api: 'spawnSync',
    file: 'cli/check-docs-consistency.ts',
    line: 105,
    symbol: 'detectScriptsChanges',
    reason: 'B4 excludes docs-consistency; git diff probe has no timeout and needs a dedicated follow-up.',
    timeout: { required: true, status: 'missing-followup' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-docs-consistency.ts',
    line: 114,
    symbol: 'detectScriptsChanges',
    reason: 'B4 excludes docs-consistency; git status probe has no timeout and needs a dedicated follow-up.',
    timeout: { required: true, status: 'missing-followup' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-docs-consistency.ts',
    line: 232,
    symbol: 'collectVitestTestCount',
    reason: 'B4 excludes docs-consistency; direct Node Vitest execution needs its 180-second timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-docs-consistency.ts',
    line: 238,
    symbol: 'collectVitestTestCount',
    reason: 'B4 excludes docs-consistency; shell fallback keeps its 180-second timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-tla-model.ts',
    line: 113,
    symbol: 'checkEnvironment',
    reason: 'B4 excludes check-tla-model; Java environment probe has no timeout and needs a dedicated follow-up.',
    timeout: { required: true, status: 'missing-followup' },
  },
  {
    api: 'execFileSync',
    file: 'cli/check-tla-model.ts',
    line: 193,
    symbol: 'runTools',
    reason: 'B4 excludes check-tla-model; SANY uses a command-specific bounded timeout and SIGKILL.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/check-tla-model.ts',
    line: 220,
    symbol: 'runTools',
    reason: 'B4 excludes check-tla-model; TLC uses a command-specific bounded timeout and SIGKILL.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-tla-model.ts',
    line: 283,
    symbol: 'main',
    reason: 'B4 excludes check-tla-model; preflight Java probe uses EXEC_LIMITS.shortTimeoutMs.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/ensure-codegraph-opsx.ts',
    line: 45,
    symbol: 'checkCli',
    reason: 'Existing CLI version probe has an explicit 10-second timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/ensure-codegraph-opsx.ts',
    line: 60,
    symbol: 'installCli',
    reason: 'Existing npm installation command has an explicit 120-second timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/ensure-codegraph-opsx.ts',
    line: 78,
    symbol: 'checkMcpCodegraph',
    reason: 'Existing codegraph probe has an explicit 15-second timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/ensure-codegraph-opsx.ts',
    line: 98,
    symbol: 'registerMcpCodegraph',
    reason: 'Existing codegraph registration has an explicit 60-second timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/ensure-codegraph-opsx.ts',
    line: 113,
    symbol: 'initCodegraph',
    reason: 'Existing codegraph initialization has an explicit 300-second timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/ensure-codegraph-opsx.ts',
    line: 128,
    symbol: 'initOpenspec',
    reason: 'Existing OpenSpec initialization has an explicit 60-second timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/security-scan.ts',
    line: 156,
    symbol: 'main',
    reason: 'B4 excludes security-scan; ESLint execution has maxBuffer but no timeout and needs a dedicated follow-up.',
    timeout: { required: true, status: 'missing-followup' },
  },
  {
    api: 'execSync',
    file: '__tests__/coverage-logic.test.ts',
    line: 377,
    symbol: 'C7 invalid out-of-scope fixture',
    reason: 'Existing real CLI assertion has an explicit 15-second timeout; brief explicitly preserves it.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execSync',
    file: '__tests__/coverage-logic.test.ts',
    line: 395,
    symbol: 'C7 non-array items fixture',
    reason: 'Existing real CLI assertion has an explicit 15-second timeout; brief explicitly preserves it.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execSync',
    file: '__tests__/coverage-logic.test.ts',
    line: 413,
    symbol: 'C7 valid out-of-scope fixture',
    reason: 'Existing real CLI assertion has an explicit 15-second timeout; brief explicitly preserves it.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    line: 1336,
    symbol: 'runDocsConsistencyCli',
    reason: 'B4 excludes docs-consistency tests; real CLI helper has no timeout and needs a dedicated follow-up.',
    timeout: { required: true, status: 'missing-followup' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/wm-write.test.ts',
    line: 35,
    symbol: 'runArgs',
    reason: 'B4 excludes state/wm-write; real CLI helper has no timeout and needs a dedicated follow-up.',
    timeout: { required: true, status: 'missing-followup' },
  },
];

function boundedPositiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Executes a child process synchronously with mandatory process-level bounds.
 * Callers may extend a known long-running timeout but cannot override SIGKILL,
 * UTF-8 output decoding, or the finite positive default fallbacks.
 */
export function runSync(command: string, args: string[], options: RunSyncOptions = {}): SpawnSyncReturns<string> {
  return spawnSync(command, args, {
    ...options,
    timeout: boundedPositiveNumber(options.timeout, DEFAULT_SYNC_TIMEOUT_MS),
    killSignal: 'SIGKILL',
    encoding: 'utf-8',
    maxBuffer: boundedPositiveNumber(options.maxBuffer, DEFAULT_SYNC_MAX_BUFFER),
  }) as SpawnSyncReturns<string>;
}
