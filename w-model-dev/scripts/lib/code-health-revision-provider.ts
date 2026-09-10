/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- Git runs over an explicit root with argv arrays; the child environment is an explicit allowlist. */
/**
 * Injected RevisionProvider: real Git commit / tree / source-bundle identity over an explicit root.
 *
 * - every Git call uses an argv array, `shell: false`, an explicit `cwd`, a timeout, a minimal
 *   audited environment, and the real exit code;
 * - the child environment never inherits `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`,
 *   `GIT_OBJECT_DIRECTORY`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`, or `GIT_CONFIG_*`, so `rev-parse`
 *   and `archive` cannot be redirected to another repository while `verify` still reports success;
 * - `current` returns null when the root is not a Git repository or commit, tree, or archive cannot be read;
 * - `verify` compares commit, tree, and source bundle and never falls back to branch names, short SHAs,
 *   or the `HEAD` string;
 * - the source-bundle digest is a pure function of an immutable commit object, so it is cached per
 *   root + commit to keep repeated command-evidence verification cheap.
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as path from 'node:path';

import type { RevisionIdentity, RevisionProvider, RevisionVerificationResult } from '../logic/code-health-contract.js';

import { CodeHealthError } from './code-health-error.js';

const SHA40_PATTERN = /^[0-9a-f]{40}$/;
const GIT_TIMEOUT_MS = 30_000;
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const SOURCE_BUNDLE_CACHE_LIMIT = 64;
const sourceBundleCache = new Map<string, string>();

/**
 * Platform values Git needs to start (Windows: SYSTEMROOT/PATH/PATHEXT/COMSPEC, plus HOME for the
 * user config). Every `GIT_*` variable is deliberately absent; the two pinned Git flags are set below.
 */
const GIT_PLATFORM_ENVIRONMENT_KEYS = [
  'PATH',
  'PATHEXT',
  'SYSTEMROOT',
  'SYSTEMDRIVE',
  'WINDIR',
  'COMSPEC',
  'TEMP',
  'TMP',
  'HOME',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
  'APPDATA',
  'LOCALAPPDATA',
  'PROGRAMDATA',
  'LANG',
  'LC_ALL',
  'TERM',
] as const;

/**
 * Explicit minimal child environment that cannot redirect Git to a different repository.
 *
 * `GIT_CONFIG_NOSYSTEM` and `GIT_CONFIG_GLOBAL` (pinned to the platform null device) keep the source
 * bundle independent of local Git configuration such as `core.autocrlf`, so the same commit yields
 * the same bundle bytes on every machine.
 */
function auditedGitEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_PAGER: 'cat',
  };
  for (const key of GIT_PLATFORM_ENVIRONMENT_KEYS) {
    const value = process.env[key];
    if (typeof value === 'string' && value.length > 0 && !value.includes('\u0000')) environment[key] = value;
  }
  return environment;
}

interface GitResult {
  ok: boolean;
  exitCode: number | null;
  stdout: Buffer;
}

function runGit(root: string, args: string[]): Promise<GitResult> {
  return new Promise<GitResult>((resolve) => {
    execFile(
      'git',
      args,
      {
        cwd: root,
        env: auditedGitEnvironment(),
        shell: false,
        windowsHide: true,
        timeout: GIT_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER_BYTES,
        encoding: 'buffer',
      },
      (error, stdout) => {
        if (error) {
          const exitCode =
            typeof (error as NodeJS.ErrnoException & { code?: unknown }).code === 'number'
              ? (error as { code: number }).code
              : null;
          resolve({ ok: false, exitCode, stdout: Buffer.alloc(0) });
          return;
        }
        resolve({ ok: true, exitCode: 0, stdout: Buffer.from(stdout) });
      },
    );
  });
}

function cacheSourceBundle(root: string, commitSha: string, sha256: string): void {
  if (sourceBundleCache.size >= SOURCE_BUNDLE_CACHE_LIMIT) sourceBundleCache.clear();
  sourceBundleCache.set(`${root}\u0000${commitSha}`, sha256);
}

async function readCurrentRevision(root: string): Promise<RevisionIdentity | null> {
  if (typeof root !== 'string' || root.length === 0) return null;
  const resolvedRoot = path.resolve(root);
  const commit = await runGit(resolvedRoot, ['rev-parse', 'HEAD']);
  if (!commit.ok) return null;
  const commitSha = commit.stdout.toString('utf8').trim();
  if (!SHA40_PATTERN.test(commitSha)) return null;
  const tree = await runGit(resolvedRoot, ['rev-parse', 'HEAD^{tree}']);
  if (!tree.ok) return null;
  const treeSha = tree.stdout.toString('utf8').trim();
  if (!SHA40_PATTERN.test(treeSha)) return null;

  const cacheKey = `${resolvedRoot}\u0000${commitSha}`;
  let sourceBundleSha256 = sourceBundleCache.get(cacheKey);
  if (sourceBundleSha256 === undefined) {
    const archive = await runGit(resolvedRoot, ['archive', '--format=tar', commitSha]);
    if (!archive.ok) return null;
    sourceBundleSha256 = createHash('sha256').update(archive.stdout).digest('hex');
    cacheSourceBundle(resolvedRoot, commitSha, sourceBundleSha256);
  }
  return { commitSha, treeSha, sourceBundleSha256, analyzedAt: new Date().toISOString() };
}

function sameRevision(left: RevisionIdentity, right: RevisionIdentity): boolean {
  return (
    left.commitSha === right.commitSha &&
    left.treeSha === right.treeSha &&
    left.sourceBundleSha256 === right.sourceBundleSha256
  );
}

export function createCodeHealthGitRevisionProvider(): RevisionProvider {
  return {
    current: readCurrentRevision,
    async verify(root: string, expected: RevisionIdentity): Promise<RevisionVerificationResult> {
      if (!expected || typeof expected !== 'object') {
        throw new CodeHealthError('ARG_INVALID', 'revision to verify must be a revision identity object');
      }
      const actual = await readCurrentRevision(root);
      if (!actual) {
        return {
          ok: false,
          code: 'REVISION_MISMATCH',
          expected,
          actual: null,
          reason: 'repository revision could not be read from Git',
        };
      }
      if (!sameRevision(actual, expected)) {
        return {
          ok: false,
          code: 'REVISION_MISMATCH',
          expected,
          actual,
          reason: 'repository commit, tree, or source bundle does not match the expected revision',
        };
      }
      return { ok: true, code: null, expected, actual };
    },
  };
}
