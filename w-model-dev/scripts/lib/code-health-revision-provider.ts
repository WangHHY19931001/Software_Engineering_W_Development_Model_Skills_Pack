/* eslint-disable security/detect-non-literal-fs-filename -- Git runs over an explicit root with argv arrays; no shell and no implicit cwd. */
/**
 * Injected RevisionProvider: real Git commit / tree / source-bundle identity over an explicit root.
 *
 * - every Git call uses an argv array, `shell: false`, an explicit `cwd`, a timeout, and the real exit code;
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
        env: process.env,
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
