import { spawnSync, type SpawnSyncOptions, type SpawnSyncReturns } from 'node:child_process';

export const DEFAULT_SYNC_TIMEOUT_MS = 15_000;
export const DEFAULT_SYNC_MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Executes a child process synchronously with mandatory process-level bounds.
 * Callers can extend a timeout for known long-running checks, but zero, omitted,
 * and invalid values fall back to the bounded default.
 */
export function runSync(command: string, args: string[], options: SpawnSyncOptions = {}): SpawnSyncReturns<string> {
  return spawnSync(command, args, {
    ...options,
    timeout: typeof options.timeout === 'number' && options.timeout > 0 ? options.timeout : DEFAULT_SYNC_TIMEOUT_MS,
    killSignal: options.killSignal ?? 'SIGKILL',
    encoding: options.encoding ?? 'utf-8',
    maxBuffer:
      typeof options.maxBuffer === 'number' && options.maxBuffer > 0 ? options.maxBuffer : DEFAULT_SYNC_MAX_BUFFER,
  }) as SpawnSyncReturns<string>;
}
