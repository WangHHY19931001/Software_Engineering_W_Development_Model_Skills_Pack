/* eslint-disable security/detect-non-literal-fs-filename -- Raw outputs are resolved beneath an explicit repository root and written with exclusive-create semantics. */
/**
 * Injected EvidenceStore over an explicit repository root.
 *
 * - `putRawOutput` validates candidate, scope, path, and bytes, creates the controlled directory
 *   chain without following symlinks, writes with `open('wx')` (existing file, symlink, or directory
 *   can never be reused as new evidence), then reads the bytes back and hashes them;
 * - `verify` binds one stored evidence ref to the candidate selector, revision, raw-output path,
 *   raw-output hash, and observation, then re-verifies the real file with the shared FileVerifier;
 * - failures reject with typed `CodeHealthError` values; no partial success object is returned and
 *   reasons never contain absolute paths.
 */

import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import type {
  EvidenceBinding,
  EvidenceObservationStatus,
  EvidenceRef,
  EvidenceStore,
  EvidenceVerificationResult,
  RevisionIdentity,
  StoredEvidenceRef,
} from '../logic/code-health-contract.js';

import { CodeHealthError } from './code-health-error.js';
import {
  createCodeHealthFileVerifier,
  isPathWithin,
  resolveControlledRelativePath,
  resolveControlledRoot,
} from './code-health-file-verifier.js';

const CANDIDATE_ID_PATTERN = /^CHG-P[1-4]-[0-9]{8}-[0-9]{3,}$/;
const SCOPE_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const HEX64_PATTERN = /^[0-9a-f]{64}$/;
const OBSERVATIONS: readonly EvidenceObservationStatus[] = ['observed', 'not_run', 'unavailable', 'unverified'];

export interface CodeHealthEvidenceStoreOptions {
  /** Explicit repository root that owns every raw output. */
  repositoryRoot: string;
  /** Repository-relative POSIX directory that owns raw outputs; defaults to the repository root. */
  rawOutputRoot?: string;
  /** Injectable identifier factory for deterministic tests. */
  idFactory?: () => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function sameRevision(left: RevisionIdentity, right: RevisionIdentity): boolean {
  return (
    left.commitSha === right.commitSha &&
    left.treeSha === right.treeSha &&
    left.sourceBundleSha256 === right.sourceBundleSha256
  );
}

async function lstatOrNull(target: string): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** Create a controlled directory chain component by component, refusing symlinks and non-directories. */
async function ensureControlledDirectoryChain(resolvedRoot: string, components: string[]): Promise<void> {
  let current = resolvedRoot;
  for (const component of components) {
    current = path.join(current, component);
    const entry = await lstatOrNull(current);
    if (entry) {
      if (entry.isSymbolicLink()) {
        throw new CodeHealthError('SECURITY_BLOCKED', 'raw output directory must not traverse a symlink');
      }
      if (!entry.isDirectory()) {
        throw new CodeHealthError('EVIDENCE_INVALID', 'raw output parent path must be a directory');
      }
      continue;
    }
    try {
      await fs.mkdir(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw new CodeHealthError('EVIDENCE_INVALID', 'raw output directory could not be created safely');
      }
    }
    const created = await lstatOrNull(current);
    if (!created || created.isSymbolicLink() || !created.isDirectory()) {
      throw new CodeHealthError('SECURITY_BLOCKED', 'raw output directory was replaced by a symlink or non-directory');
    }
  }
}

/** Best-effort removal of a raw output this store just created, so a failed write leaves no residue. */
async function removeFailedRawOutput(target: string): Promise<void> {
  try {
    await fs.unlink(target);
  } catch {
    // Nothing else can be done safely; the caller still fails closed.
  }
}

export function createCodeHealthEvidenceStore(options: CodeHealthEvidenceStoreOptions): EvidenceStore {
  const repositoryRoot = path.resolve(options.repositoryRoot);
  const rawOutputRoot = options.rawOutputRoot;
  const fileVerifier = createCodeHealthFileVerifier();
  const idFactory = options.idFactory ?? (() => `EVD-${randomUUID()}`);

  const rawOutputRootResolution = resolveControlledRelativePath(
    repositoryRoot,
    rawOutputRoot === undefined || rawOutputRoot === '' || rawOutputRoot === '.' ? '.' : rawOutputRoot,
  );

  function resolveRawOutputRoot(): string {
    if (rawOutputRoot === undefined || rawOutputRoot === '' || rawOutputRoot === '.') return repositoryRoot;
    if (!rawOutputRootResolution.ok || !rawOutputRootResolution.absolutePath) {
      throw new CodeHealthError(
        rawOutputRootResolution.code ?? 'STRUCTURE_INVALID',
        rawOutputRootResolution.reason ?? 'rawOutputRoot is not a controlled directory',
      );
    }
    return rawOutputRootResolution.absolutePath;
  }

  function normalizeRawPath(relativePath: unknown): { relativePath: string; absolutePath: string } {
    const resolution = resolveControlledRelativePath(repositoryRoot, relativePath);
    if (!resolution.ok || !resolution.absolutePath || typeof relativePath !== 'string') {
      throw new CodeHealthError(
        resolution.code ?? 'STRUCTURE_INVALID',
        resolution.reason ?? 'relativePath is not controlled',
        { safePath: typeof relativePath === 'string' ? relativePath : undefined },
      );
    }
    if (!isPathWithin(resolveRawOutputRoot(), resolution.absolutePath)) {
      throw new CodeHealthError(
        'STRUCTURE_INVALID',
        'raw output path must stay inside the controlled raw output root',
        {
          safePath: relativePath,
        },
      );
    }
    return { relativePath, absolutePath: resolution.absolutePath };
  }

  return {
    async putRawOutput(input): Promise<StoredEvidenceRef> {
      if (!isRecord(input)) {
        throw new CodeHealthError('ARG_INVALID', 'raw output input must be an object');
      }
      const candidateId = input.candidateId;
      const scopeHash = input.scopeHash;
      const bytes = input.bytes;
      if (typeof candidateId !== 'string' || !CANDIDATE_ID_PATTERN.test(candidateId)) {
        throw new CodeHealthError('ARG_INVALID', 'candidateId must be a stable code-health candidate identity');
      }
      if (typeof scopeHash !== 'string' || !SCOPE_HASH_PATTERN.test(scopeHash)) {
        throw new CodeHealthError('ARG_INVALID', 'scopeHash must be a sha256:<64 lowercase hex> scope identity');
      }
      if (!(bytes instanceof Uint8Array)) {
        throw new CodeHealthError('ARG_INVALID', 'raw output bytes must be a byte array');
      }
      const { relativePath } = normalizeRawPath(input.relativePath);

      // Validate the root itself (and canonicalize it once) before any byte is written: a root that
      // is a symlink or junction must never become a write target, and symlinked ancestors such as
      // macOS `/var` → `/private/var` must not break containment proofs.
      const rootResolution = await resolveControlledRoot(repositoryRoot);
      if (!rootResolution.ok || !rootResolution.canonicalRoot) {
        throw new CodeHealthError(
          rootResolution.code ?? 'STRUCTURE_INVALID',
          rootResolution.reason ?? 'repository root is not a controlled directory',
          { safePath: relativePath, candidateId, scopeHash },
        );
      }
      const canonicalRoot = rootResolution.canonicalRoot;
      const canonicalTarget = path.resolve(canonicalRoot, ...relativePath.split('/'));

      await ensureControlledDirectoryChain(canonicalRoot, relativePath.split('/').slice(0, -1));

      const existing = await lstatOrNull(canonicalTarget);
      if (existing) {
        if (existing.isSymbolicLink()) {
          throw new CodeHealthError('SECURITY_BLOCKED', 'raw output target must not be a symlink', {
            safePath: relativePath,
            candidateId,
            scopeHash,
          });
        }
        if (existing.isDirectory()) {
          throw new CodeHealthError('EVIDENCE_INVALID', 'raw output target must be a regular file path', {
            safePath: relativePath,
          });
        }
        throw new CodeHealthError('SECURITY_BLOCKED', 'existing raw output must not be overwritten', {
          safePath: relativePath,
          candidateId,
          scopeHash,
        });
      }

      let handle: Awaited<ReturnType<typeof fs.open>>;
      try {
        handle = await fs.open(canonicalTarget, 'wx');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          throw new CodeHealthError('SECURITY_BLOCKED', 'existing raw output must not be overwritten', {
            safePath: relativePath,
            candidateId,
            scopeHash,
          });
        }
        throw new CodeHealthError('EVIDENCE_INVALID', 'raw output could not be created exclusively', {
          safePath: relativePath,
        });
      }
      try {
        await handle.writeFile(Buffer.from(bytes));
      } catch {
        await handle.close().catch(() => undefined);
        await removeFailedRawOutput(canonicalTarget);
        throw new CodeHealthError('EVIDENCE_INVALID', 'raw output could not be written safely', {
          safePath: relativePath,
        });
      }
      await handle.close().catch(() => undefined);

      const entry = await lstatOrNull(canonicalTarget);
      const realPath = await fs.realpath(canonicalTarget).catch(() => null);
      if (
        !entry ||
        entry.isSymbolicLink() ||
        !entry.isFile() ||
        realPath === null ||
        path.resolve(realPath) !== canonicalTarget ||
        !isPathWithin(canonicalRoot, realPath)
      ) {
        await removeFailedRawOutput(canonicalTarget);
        throw new CodeHealthError('SECURITY_BLOCKED', 'raw output target must be a regular file beneath the root', {
          safePath: relativePath,
        });
      }
      const writtenSha256 = sha256Hex(await fs.readFile(canonicalTarget));
      const expectedSha256 = sha256Hex(bytes);
      if (writtenSha256 !== expectedSha256) {
        await removeFailedRawOutput(canonicalTarget);
        throw new CodeHealthError('EVIDENCE_INVALID', 'raw output readback hash does not match the written bytes', {
          safePath: relativePath,
        });
      }
      return {
        evidenceId: idFactory(),
        candidateId,
        scopeHash,
        relativePath,
        sha256: writtenSha256,
      };
    },

    async verify(ref: EvidenceRef, binding: EvidenceBinding): Promise<EvidenceVerificationResult> {
      if (!isRecord(ref)) {
        throw new CodeHealthError('STRUCTURE_INVALID', 'evidence ref must be an object');
      }
      const safePath = typeof ref.relativePath === 'string' ? ref.relativePath : undefined;
      if (typeof ref.evidenceId !== 'string' || ref.evidenceId.length === 0) {
        throw new CodeHealthError('STRUCTURE_INVALID', 'evidence ref requires a stable evidenceId', { safePath });
      }
      if (typeof ref.candidateId !== 'string' || !CANDIDATE_ID_PATTERN.test(ref.candidateId)) {
        throw new CodeHealthError('STRUCTURE_INVALID', 'evidence ref candidateId is invalid', { safePath });
      }
      if (typeof ref.scopeHash !== 'string' || !SCOPE_HASH_PATTERN.test(ref.scopeHash)) {
        throw new CodeHealthError('STRUCTURE_INVALID', 'evidence ref scopeHash is invalid', { safePath });
      }
      if (!resolveControlledRelativePath(repositoryRoot, ref.relativePath).ok) {
        throw new CodeHealthError('STRUCTURE_INVALID', 'evidence ref relativePath must be repository-relative', {
          safePath,
        });
      }
      if (typeof ref.sha256 !== 'string' || !HEX64_PATTERN.test(ref.sha256)) {
        throw new CodeHealthError('STRUCTURE_INVALID', 'evidence ref sha256 is invalid', { safePath });
      }
      if (!isRecord(ref.revision)) {
        throw new CodeHealthError('STRUCTURE_INVALID', 'evidence ref revision is malformed', { safePath });
      }
      if (!OBSERVATIONS.includes(ref.observation)) {
        throw new CodeHealthError('STRUCTURE_INVALID', 'evidence ref observation is invalid', { safePath });
      }
      if (ref.observation === 'unverified') {
        throw new CodeHealthError('EVIDENCE_INVALID', 'unverified evidence cannot be stored as verified evidence', {
          safePath,
        });
      }
      if (!isRecord(binding) || !isRecord(binding.candidate) || !isRecord(binding.revision)) {
        throw new CodeHealthError('STRUCTURE_INVALID', 'evidence binding is malformed', { safePath });
      }

      if (ref.candidateId !== binding.candidate.candidateId || ref.scopeHash !== binding.candidate.scopeHash) {
        throw new CodeHealthError('SCOPE_MISMATCH', 'evidence does not belong to the bound candidate scope', {
          safePath,
          candidateId: ref.candidateId,
          scopeHash: ref.scopeHash,
        });
      }
      if (ref.relativePath !== binding.rawOutputPath) {
        throw new CodeHealthError('EVIDENCE_INVALID', 'evidence raw output path is not bound to the candidate', {
          safePath,
          candidateId: ref.candidateId,
          scopeHash: ref.scopeHash,
        });
      }
      if (ref.sha256 !== binding.rawOutputSha256) {
        throw new CodeHealthError('EVIDENCE_INVALID', 'evidence raw output hash is not bound to the candidate', {
          safePath,
          candidateId: ref.candidateId,
          scopeHash: ref.scopeHash,
        });
      }
      if (!sameRevision(ref.revision, binding.revision)) {
        throw new CodeHealthError('REVISION_MISMATCH', 'evidence revision is stale for the bound revision', {
          safePath,
          expectedRevision: binding.revision,
          actualRevision: ref.revision,
        });
      }

      const fileResult = await fileVerifier.verifyRegularNonSymlinkFile({
        root: repositoryRoot,
        relativePath: ref.relativePath,
        expectedSha256: ref.sha256,
      });
      if (!fileResult.ok) {
        throw new CodeHealthError(
          fileResult.code ?? 'EVIDENCE_INVALID',
          `raw output file failed verification: ${fileResult.reason ?? 'unknown reason'}`,
          { safePath, candidateId: ref.candidateId, scopeHash: ref.scopeHash },
        );
      }
      return { ok: true, code: null, binding };
    },
  };
}
