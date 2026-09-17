/* eslint-disable security/detect-non-literal-fs-filename -- Every path is resolved beneath an explicit caller-owned root and verified component by component before any read or write. */
/**
 * Campaign archive producer / consumer / verifier.
 *
 * Task 1 froze the injected boundary shape and returned a typed `NOT_IMPLEMENTED`; Task 8 replaces that stub
 * with the real implementation while keeping the same injected shape and the same fail-closed rules.
 *
 * Authority and evidence rules:
 *   - the campaign directory is CALLER-SUPPLIED: `ledger.json` / `candidate.json` / `approval.json` are read from
 *     the `--campaign` directory named by the caller. This producer validates their INTERNAL consistency
 *     (candidate/ledger/approval agreement, revision match, signature roles, redaction) but does not anchor them
 *     to HEAD or to any tracked record; authenticating the campaign directory itself is the caller's / human's
 *     responsibility. This differs from the Phase 3/4 tracked-ledger authority, whose working bytes must equal
 *     the HEAD blob;
 *   - a verified candidate is archived only after the ledger record proves human approval, V review, a G gate,
 *     structurally validated command evidence, an executable rollback, clean redaction, and a matching revision;
 *   - command evidence is SHAPE-CHECKED only: each command must be `observation === 'observed'`, `exitCode === 0`
 *     (a numeric zero), carry a repository-relative `rawOutputPath` and a 64-hex `rawOutputSha256`. The raw output
 *     file is NOT read and the digest is NOT recomputed by this boundary; byte-level verification of the raw
 *     output is the upstream `EvidenceStore`'s responsibility;
 *   - `deferred` / `rejected` / `blocked` / `rolled-back` candidates may be archived as terminal NON-success
 *     evidence but are never reported as `archivedAsPassed`;
 *   - every declared source artifact is re-verified through the shared FileVerifier (regular, non-symlink,
 *     canonical containment) and copied with its true content hash; a prediction is never written as a result;
 *   - the package is written atomically (staging directory + rename + readback) and never overwrites an
 *     existing non-empty package; the manifest digest is an unkeyed integrity checksum, not a signature;
 *   - `package-only` verification can never be described as source verified; only an explicit `sourceProject`
 *     performs a source-bound revision re-verification.
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { validateBySchema } from '../infrastructure/schema-loader.js';
import type {
  ApprovalDecision,
  ArchiveBoundaryResult,
  ArchiveConsumeInput,
  ArchiveManifest,
  ArchivePackageFile,
  ArchiveProduceInput,
  ArchiveVerifyInput,
  CodeHealthCandidate,
  CodeHealthLedger,
  ErrorCode,
  FileVerifier,
  RevisionProvider,
} from '../logic/code-health-contract.js';

import {
  createCodeHealthFileVerifier,
  resolveControlledRelativePath,
  resolveControlledRoot,
} from './code-health-file-verifier.js';
import { redactCodeHealthArtifact } from './code-health-redaction.js';
import { createCodeHealthGitRevisionProvider } from './code-health-revision-provider.js';

export type {
  ArchiveBoundaryResult,
  ArchiveConsumeInput,
  ArchiveProduceInput,
  ArchiveVerifyInput,
} from '../logic/code-health-contract.js';

/** Archive producer entrance. */
export interface ArchiveProducer {
  produce(input: ArchiveProduceInput): Promise<ArchiveBoundaryResult>;
}

/** Archive consumer entrance for package-only and source-bound packages. */
export interface ArchiveConsumer {
  consume(input: ArchiveConsumeInput): Promise<ArchiveBoundaryResult>;
}

/** Archive verification entrance; `expectedRevision` never upgrades the declared level. */
export interface ArchiveVerifier {
  verify(input: ArchiveVerifyInput): Promise<ArchiveBoundaryResult>;
}

/** The archive boundary surface consumed by the CLI and the ledger logic facade. */
export interface ArchiveBoundary {
  producer: ArchiveProducer;
  consumer: ArchiveConsumer;
  verifier: ArchiveVerifier;
}

/** Injected collaborators; each one has a real default so production wiring cannot silently no-op. */
export interface ArchiveBoundaryOptions {
  fileVerifier?: FileVerifier;
  revisionProvider?: RevisionProvider;
  now?: () => Date;
  producerId?: string;
  producerVersion?: string;
  /**
   * Optional pure readiness assessor injected by the logic layer. The archive boundary cannot import the logic
   * layer at runtime (`lib → logic` is forbidden), so the ledger's canonical archived-as-passed gate is passed
   * in. It is only consulted for a verified-success candidate and can only add blocking reasons.
   */
  assessCandidate?: (candidate: CodeHealthCandidate, ledger: CodeHealthLedger, approval: ApprovalDecision) => string[];
}

export const ARCHIVE_PRODUCER_ID = 'code-health-archive-producer';
export const ARCHIVE_PRODUCER_VERSION = '0.1.0';
/** Package-relative manifest path inside an archive package. */
export const ARCHIVE_MANIFEST_NAME = 'manifest.json';

const ARCHIVE_FILE_KINDS = ['ledger', 'candidate', 'evidence', 'approval', 'review', 'gate', 'rollback'] as const;
const SUCCESS_TERMINAL_STATUS = 'verified';
const NON_SUCCESS_TERMINAL_STATUSES = ['deferred', 'rejected', 'blocked', 'rolled-back'] as const;
const HEX64_PATTERN = /^[0-9a-f]{64}$/;

type ManifestKind = ArchiveManifest['files'][number]['kind'];
type ArchiveStatus = ArchiveManifest['archiveStatus'];
type VerificationLevel = ArchiveBoundaryResult['verificationLevel'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 非空字符串判据（**trim 语义**，2026-09-17 审查修复）：
 * 原先用 `value.length > 0`，使 `" "`（单空格）被当作合法非空路径/ID/candidateId——
 * 与根因报告门禁（root-cause-logic）等模块的 `trim() !== ''` 语义不一致，
 * 且导致 isHumanActor 等调用点各自打补丁（`|| value.trim() === ''`）。
 * 统一为 trim 语义后，所有调用点（packageRoot / sourceProject / candidateId /
 * campaignRoot / rollback.command …）自动拒绝纯空白输入。
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isRepositoryRelativePath(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    !value.startsWith('/') &&
    !/^[A-Za-z]:[\\/]/.test(value) &&
    !value.includes('\\') &&
    !value.includes('\u0000') &&
    !value.split('/').includes('..') &&
    !value.split('/').includes('')
  );
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Deterministic JSON serializer: object keys sorted recursively so a manifest digest is machine-independent. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  if (isRecord(value)) {
    const entries = Object.keys(value)
      .sort()
      .map((key) => {
        const entry = Object.getOwnPropertyDescriptor(value, key)?.value as unknown;
        return `${JSON.stringify(key)}:${stableStringify(entry)}`;
      });
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * SHA-256 digest over the complete deterministic manifest content, computed with `contentHash` removed.
 * Producer and verifier share this single function, so a tampered manifest can never verify.
 */
export function archiveManifestDigest(manifest: ArchiveManifest): string {
  const { contentHash: _ignored, ...rest } = manifest;
  void _ignored;
  return sha256Hex(Buffer.from(stableStringify(rest), 'utf8'));
}

function refuse(
  code: ErrorCode,
  level: VerificationLevel,
  reason: string,
  exitCode: 0 | 1 | 2,
  packagePath: string | null = null,
): ArchiveBoundaryResult {
  return {
    ok: false,
    errorCode: code,
    manifest: null,
    verificationLevel: level,
    createdPaths: [],
    exitCode,
    path: packagePath,
    archivedAsPassed: false,
    reason,
  };
}

function declaredLevel(input: unknown, problems: string[]): VerificationLevel {
  const level = isRecord(input) ? input.verificationLevel : undefined;
  if (level === 'package-only' || level === 'source-bound') return level;
  problems.push('verificationLevel must be exactly package-only or source-bound');
  return 'package-only';
}

/** Human identity check: agent/bot/automation/role identities never qualify as the human decision maker. */
function isHumanActor(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  const normalized = value.toLowerCase();
  if (/(?:^|[-_\s])(?:agent|bot|automation|system|orchestrator|robot)(?:$|[-_\s])/.test(normalized)) return false;
  if (/(?:^|[-_\s])[oasvgr](?:$|[-_\s])/.test(normalized)) return false;
  return true;
}

function sortedEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((entry, index) => entry === b.at(index));
}

function sameRevision(left: unknown, right: unknown): boolean {
  if (!isRecord(left) || !isRecord(right)) return false;
  return (
    left.commitSha === right.commitSha &&
    left.treeSha === right.treeSha &&
    left.sourceBundleSha256 === right.sourceBundleSha256
  );
}

function safeRollback(candidate: CodeHealthCandidate): boolean {
  const rollback = candidate.rollback;
  if (!isRecord(rollback)) return false;
  if (rollback.executable !== true) return false;
  if (!isRepositoryRelativePath(rollback.patchPath)) return false;
  if (!isNonEmptyString(rollback.command) || /[;&|<>\r\n]/.test(rollback.command)) return false;
  return true;
}

/** The manifest terminal status a candidate contributes, or null when the candidate is not terminal. */
function terminalArchiveStatus(candidate: CodeHealthCandidate): ArchiveStatus | null {
  if (candidate.status === SUCCESS_TERMINAL_STATUS) return 'archived';
  if ((NON_SUCCESS_TERMINAL_STATUSES as readonly string[]).includes(candidate.status)) {
    return candidate.status as ArchiveStatus;
  }
  return null;
}

export interface ArchiveReadiness {
  /** True when the candidate is in an archivable terminal state that passed every readiness gate. */
  archivable: boolean;
  /** True only for a verified-success candidate that may be recorded as archived-as-passed. */
  archivedAsPassed: boolean;
  /** True when the candidate is a declared terminal non-success (blocked/deferred/rejected/rolled-back). */
  terminalNonSuccess: boolean;
  reasons: string[];
}

/**
 * Pure readiness assessment over the candidate and its ledger record. A verified candidate must carry human
 * approval, V review, a G gate, observed passing command evidence, an executable rollback, clean redaction, a
 * consistent revision, and no blocking event. A declared terminal non-success is archivable as evidence but is
 * never reported as archived-as-passed.
 */
export function assessArchiveReadiness(
  candidate: CodeHealthCandidate,
  ledger: CodeHealthLedger,
  approval?: ApprovalDecision,
): ArchiveReadiness {
  const reasons: string[] = [];
  const status = candidate.status;
  const terminalNonSuccess = (NON_SUCCESS_TERMINAL_STATUSES as readonly string[]).includes(status);
  const successTerminal = status === SUCCESS_TERMINAL_STATUS;

  const ledgerCandidate = Array.isArray(ledger?.candidates)
    ? ledger.candidates.find((entry) => entry.candidateId === candidate.candidateId)
    : undefined;
  if (!ledgerCandidate) {
    reasons.push('candidate is not present in ledger');
  } else {
    if (ledgerCandidate.status !== candidate.status) reasons.push('candidate and ledger status are inconsistent');
    if (ledgerCandidate.action !== candidate.action) reasons.push('candidate and ledger action are inconsistent');
    if (!sortedEqual(ledgerCandidate.changeScope?.files ?? [], candidate.changeScope?.files ?? [])) {
      reasons.push('candidate and ledger files are inconsistent');
    }
    if (ledgerCandidate.changeScope?.scopeHash !== candidate.changeScope?.scopeHash) {
      reasons.push('candidate and ledger scopeHash are inconsistent');
    }
    // The ledger record is the campaign authority: a candidate claiming a different revision than the
    // campaign baseline is stale evidence and can never be archived, regardless of its declared status.
    if (!sameRevision(ledgerCandidate.revision, ledger?.baseline)) {
      reasons.push('ledger candidate revision is stale (provenance mismatch with the campaign baseline)');
    }
  }
  if (!successTerminal && !terminalNonSuccess) {
    reasons.push('candidate is not in an archivable terminal state');
  }
  if (candidate.archive?.redactionStatus !== 'clean' || ledger?.redaction?.status !== 'clean') {
    reasons.push('archive redaction is not clean');
  }

  if (successTerminal) {
    if (!sameRevision(candidate.revision, ledger?.baseline)) {
      reasons.push('candidate revision is stale (provenance mismatch with the campaign baseline)');
    }
    if (!Array.isArray(candidate.commands) || candidate.commands.length === 0) {
      reasons.push('affected and full regression command evidence is missing');
    } else {
      for (const command of candidate.commands) {
        if (command.observation !== 'observed' || command.exitCode !== 0) {
          reasons.push('required command evidence did not pass');
          break;
        }
        if (!isRepositoryRelativePath(command.rawOutputPath) || !HEX64_PATTERN.test(command.rawOutputSha256)) {
          reasons.push('required command evidence hash or raw output path is unsafe');
          break;
        }
      }
    }
    if (candidate.review?.decision !== 'approve' || candidate.review?.humanDecision !== 'approve') {
      reasons.push('human approval is missing');
    }
    if (!approval) {
      reasons.push('ApprovalDecision is missing');
    } else {
      if (approval.candidateId !== candidate.candidateId) reasons.push('approval does not belong to the candidate');
      if (approval.decision !== 'approve') reasons.push('approval decision is not approve');
      if (approval.approvedAction !== candidate.action) reasons.push('approval action is inconsistent');
      if (!sortedEqual(approval.approvedFiles ?? [], candidate.changeScope?.files ?? [])) {
        reasons.push('approval files are inconsistent');
      }
      if (!sortedEqual(approval.approvedSymbols ?? [], candidate.changeScope?.symbols ?? [])) {
        reasons.push('approval symbols are inconsistent');
      }
      if (approval.scopeHash !== candidate.changeScope?.scopeHash) reasons.push('approval scopeHash is inconsistent');
      if (!sameRevision(approval.revision, candidate.revision)) reasons.push('approval revision is stale');
      if (!isHumanActor(approval.actor)) reasons.push('approval actor is not a human decision maker');
    }
    const roles = new Set((candidate.signatures ?? []).map((signature) => signature.role));
    if (!roles.has('V')) reasons.push('review signature is missing: V');
    if (!roles.has('G')) reasons.push('gate signature is missing: G');
    if (!roles.has('human')) reasons.push('human approval signature is missing');
    if (
      approval &&
      !(candidate.signatures ?? []).some(
        (signature) =>
          signature.role === 'human' && signature.event === 'approve' && signature.scopeHash === approval.scopeHash,
      )
    ) {
      reasons.push('human approval signature is not bound to approval scope');
    }
    if (!safeRollback(candidate)) {
      reasons.push('rollback is not executable or its command/path is unsafe');
    }
    if (
      Array.isArray(ledger?.environmentMatrix) &&
      ledger.environmentMatrix.some((environment) => environment.supported && environment.observed !== 'observed')
    ) {
      reasons.push('required environment observation is not observed');
    }
    if (
      Array.isArray(ledger?.events) &&
      ledger.events.some((event) => event.candidateId === candidate.candidateId && event.to === 'blocked')
    ) {
      reasons.push('candidate has a blocking event and requires the root cause chain');
    }
  }

  const archivable = reasons.length === 0;
  return {
    archivable,
    archivedAsPassed: archivable && successTerminal,
    terminalNonSuccess,
    reasons: [...new Set(reasons)],
  };
}

interface ResolvedSource extends ArchivePackageFile {
  absolutePath: string;
  bytes: Uint8Array;
  sha256: string;
  /** True when redaction changed the artifact, so the package copy is a redacted (not raw) copy. */
  redacted: boolean;
}

/** Read one declared source artifact after canonical containment + regular non-symlink verification. */
async function resolveSource(
  campaignRoot: string,
  source: ArchivePackageFile,
  fileVerifier: FileVerifier,
): Promise<ResolvedSource | { problem: string; code: ErrorCode }> {
  if (!isRepositoryRelativePath(source.path) || !ARCHIVE_FILE_KINDS.includes(source.kind)) {
    return {
      problem: `source artifact is not a safe relative path: ${String(source.path)}`,
      code: 'STRUCTURE_INVALID',
    };
  }
  const resolution = resolveControlledRelativePath(campaignRoot, source.path);
  if (!resolution.ok || !resolution.absolutePath) {
    return { problem: resolution.reason ?? 'source artifact path is not controlled', code: 'STRUCTURE_INVALID' };
  }
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(resolution.absolutePath);
  } catch {
    return {
      problem: `source artifact is missing beneath the campaign root: ${source.path}`,
      code: 'EVIDENCE_INVALID',
    };
  }
  const actual = sha256Hex(bytes);
  const verification = await fileVerifier.verifyRegularNonSymlinkFile({
    root: campaignRoot,
    relativePath: source.path,
    expectedSha256: actual,
  });
  if (!verification.ok) {
    return {
      problem: `source artifact failed file verification: ${verification.reason ?? 'unknown reason'}`,
      code: verification.code ?? 'EVIDENCE_INVALID',
    };
  }
  const redacted = redactCodeHealthArtifact({ text: bytes.toString('utf8') });
  if (redacted.status === 'blocked') {
    return { problem: `redaction blocked: ${redacted.reasons.join('; ')}`, code: 'SECURITY_BLOCKED' };
  }
  const sanitized = (redacted.value as { text: string }).text;
  const outBytes = Buffer.from(sanitized, 'utf8');
  return {
    ...source,
    absolutePath: resolution.absolutePath,
    bytes: outBytes,
    sha256: sha256Hex(outBytes),
    redacted: outBytes.compare(bytes) !== 0,
  };
}

function buildManifest(
  input: ArchiveProduceInput,
  sources: readonly ResolvedSource[],
  reasons: string[],
  producerMetadata: { producerId: string; producerVersion: string },
  createdAt: string,
): ArchiveManifest {
  const byKind = (kind: ManifestKind): ResolvedSource[] => sources.filter((source) => source.kind === kind);
  const first = (kind: ManifestKind): ResolvedSource | undefined => byKind(kind)[0];
  const approvalSource = first('approval');
  const rollbackSource = first('rollback');
  const files = [...sources]
    .map((source) => ({ path: source.path, kind: source.kind, sha256: source.sha256 }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const manifest: ArchiveManifest = {
    archiveId: `ARC-${input.candidate.candidateId}`,
    candidateId: input.candidate.candidateId,
    scope: {
      candidateId: input.candidate.candidateId,
      phase: input.candidate.phase,
      action: input.candidate.action,
      files: [...input.candidate.changeScope.files],
      symbols: [...input.candidate.changeScope.symbols],
      scopeHash: input.candidate.changeScope.scopeHash,
    },
    contentHash: '0'.repeat(64),
    files,
    sourceRevision: input.candidate.revision,
    approvalRef: approvalSource?.path ?? 'approval.json',
    reviewRefs: byKind('review').map((source) => source.path),
    gateRefs: byKind('gate').map((source) => source.path),
    humanSignatureRef: approvalSource?.path ?? 'signatures/human.json',
    redaction: { status: 'clean', reasons },
    verificationLevel: input.verificationLevel,
    rollbackRef: rollbackSource?.path ?? 'rollback/rollback.patch',
    producerMetadata,
    createdAt,
    archiveStatus: terminalArchiveStatus(input.candidate) ?? 'blocked',
    archivedAsPassed: assessArchiveReadiness(input.candidate, input.ledger, input.approval).archivedAsPassed,
  };
  manifest.contentHash = archiveManifestDigest(manifest);
  return manifest;
}

interface PackageResolution {
  ok: boolean;
  code: ErrorCode | null;
  absolutePath?: string;
  reason?: string;
}

function resolveUnderRoot(root: string, relativePath: unknown, field: string): PackageResolution {
  const resolution = resolveControlledRelativePath(root, relativePath);
  if (!resolution.ok || !resolution.absolutePath) {
    return { ok: false, code: resolution.code ?? 'STRUCTURE_INVALID', reason: `${field}: ${resolution.reason}` };
  }
  return { ok: true, code: null, absolutePath: resolution.absolutePath };
}

async function lstatOrNull(target: string): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** Read a regular non-symlink file beneath an explicit root; no partial success is returned. */
async function readControlledFile(
  root: string,
  relativePath: string,
  field: string,
): Promise<PackageResolution & { bytes?: Uint8Array }> {
  const resolution = resolveUnderRoot(root, relativePath, field);
  if (!resolution.ok || !resolution.absolutePath) return resolution;
  const entry = await lstatOrNull(resolution.absolutePath);
  if (!entry) return { ok: false, code: 'EVIDENCE_INVALID', reason: `${field} is missing: ${relativePath}` };
  if (entry.isSymbolicLink()) return { ok: false, code: 'SECURITY_BLOCKED', reason: `${field} must not be a symlink` };
  if (!entry.isFile()) return { ok: false, code: 'EVIDENCE_INVALID', reason: `${field} must be a regular file` };
  try {
    return {
      ok: true,
      code: null,
      absolutePath: resolution.absolutePath,
      bytes: await fs.readFile(resolution.absolutePath),
    };
  } catch {
    return { ok: false, code: 'EVIDENCE_INVALID', reason: `${field} could not be read safely` };
  }
}

interface PackageVerification {
  ok: boolean;
  code: ErrorCode | null;
  reason: string;
  manifest: ArchiveManifest | null;
  verificationLevel: VerificationLevel;
}

/**
 * Verify one archive package. Package-only proves self-consistency (schema, declared file hashes, content hash,
 * redaction). Source-bound additionally requires an explicit source project whose current revision matches the
 * manifest source revision; a declared source-bound manifest without a source project never verifies.
 */
async function verifyPackage(
  input: ArchiveConsumeInput | ArchiveVerifyInput,
  revisionProvider: RevisionProvider,
): Promise<PackageVerification> {
  const level = declaredLevel(input, []);
  const fail = (code: ErrorCode, reason: string): PackageVerification => ({
    ok: false,
    code,
    reason,
    manifest: null,
    verificationLevel: level === 'source-bound' && input.sourceProject === undefined ? 'package-only' : level,
  });
  if (!isRecord(input)) return fail('STRUCTURE_INVALID', 'archive input must be an object');
  if (!isNonEmptyString(input.packageRoot)) {
    return fail('STRUCTURE_INVALID', 'packageRoot must be an explicit non-empty path');
  }
  if (!isRepositoryRelativePath(input.manifestPath)) {
    return fail('STRUCTURE_INVALID', 'manifestPath must be a repository-relative POSIX path');
  }
  if (input.sourceProject !== undefined && !isNonEmptyString(input.sourceProject)) {
    return fail('STRUCTURE_INVALID', 'sourceProject must be a non-empty path when provided');
  }
  const rootResolution = await resolveControlledRoot(input.packageRoot);
  if (!rootResolution.ok || !rootResolution.canonicalRoot) {
    return fail(
      rootResolution.code ?? 'STRUCTURE_INVALID',
      rootResolution.reason ?? 'packageRoot is not a controlled directory',
    );
  }
  const canonicalRoot = rootResolution.canonicalRoot;
  const manifestRead = await readControlledFile(canonicalRoot, input.manifestPath, 'manifest');
  if (!manifestRead.ok || !manifestRead.bytes) {
    return fail(manifestRead.code ?? 'EVIDENCE_INVALID', manifestRead.reason ?? 'manifest could not be read');
  }

  let manifest: ArchiveManifest;
  try {
    manifest = JSON.parse(Buffer.from(manifestRead.bytes).toString('utf8')) as ArchiveManifest;
  } catch {
    return fail('STRUCTURE_INVALID', 'archive manifest is not valid JSON');
  }
  const schema = validateBySchema('code-health-archive', manifest);
  if (!schema.valid || !Array.isArray(manifest.files)) {
    return fail('STRUCTURE_INVALID', `archive manifest failed schema validation: ${schema.errorMessages.join('; ')}`);
  }
  if (manifest.redaction?.status !== 'clean') {
    return fail('SECURITY_BLOCKED', 'archive manifest redaction is not clean');
  }
  if (manifest.files.length === 0) return fail('STRUCTURE_INVALID', 'archive manifest declares no files');
  const declaredPaths = new Set(manifest.files.map((file) => file.path));
  for (const ref of [manifest.approvalRef, ...manifest.reviewRefs, ...manifest.gateRefs, manifest.rollbackRef]) {
    if (!declaredPaths.has(ref)) {
      return fail('EVIDENCE_INVALID', `archive reference is not declared in the manifest files: ${ref}`);
    }
  }
  for (const file of manifest.files) {
    if (!isRepositoryRelativePath(file.path) || !HEX64_PATTERN.test(file.sha256)) {
      return fail('STRUCTURE_INVALID', `archive file entry is malformed: ${String(file.path)}`);
    }
    const fileRead = await readControlledFile(canonicalRoot, file.path, 'archive file');
    if (!fileRead.ok || !fileRead.bytes) {
      return fail(fileRead.code ?? 'EVIDENCE_INVALID', fileRead.reason ?? 'archive file could not be read');
    }
    if (sha256Hex(fileRead.bytes) !== file.sha256) {
      return fail('EVIDENCE_INVALID', `archive file SHA-256 does not match the manifest: ${file.path}`);
    }
    const redacted = redactCodeHealthArtifact({ text: Buffer.from(fileRead.bytes).toString('utf8') });
    if (redacted.status === 'blocked') {
      return fail('SECURITY_BLOCKED', `archive file redaction blocked: ${file.path}`);
    }
  }
  if (archiveManifestDigest(manifest) !== manifest.contentHash) {
    return fail('EVIDENCE_INVALID', 'archive contentHash does not match the deterministic manifest digest');
  }

  const expectedRevision = (input as ArchiveVerifyInput).expectedRevision;
  if (expectedRevision !== undefined && !sameRevision(expectedRevision, manifest.sourceRevision)) {
    return fail('REVISION_MISMATCH', 'expectedRevision does not match the archived source revision');
  }
  if (manifest.verificationLevel === 'source-bound') {
    if (input.sourceProject === undefined) {
      return fail('EVIDENCE_INVALID', 'source-bound package verification requires an explicit source project');
    }
    const revision = await revisionProvider.verify(input.sourceProject, manifest.sourceRevision);
    if (!revision.ok) {
      return {
        ok: false,
        code: 'REVISION_MISMATCH',
        reason: `source-bound provenance revision does not match the source project: ${revision.reason ?? 'revision mismatch'}`,
        manifest: null,
        verificationLevel: 'package-only',
      };
    }
    return {
      ok: true,
      code: null,
      reason: 'source-bound archive package verified',
      manifest,
      verificationLevel: 'source-bound',
    };
  }
  return {
    ok: true,
    code: null,
    reason: 'package-only archive package verified',
    manifest,
    verificationLevel: 'package-only',
  };
}

function toResult(verification: PackageVerification, packagePath: string): ArchiveBoundaryResult {
  if (!verification.ok || !verification.manifest) {
    // A refusal can never report a level the run did not establish: without a verified manifest nothing is
    // source-bound, so the result stays package-only regardless of what the caller declared.
    return refuse(verification.code ?? 'EVIDENCE_INVALID', 'package-only', verification.reason, 1, packagePath);
  }
  return {
    ok: true,
    errorCode: null,
    manifest: verification.manifest,
    verificationLevel: verification.verificationLevel,
    createdPaths: [],
    exitCode: 0,
    path: packagePath,
    // Verification establishes package integrity, never an archived-as-passed claim.
    archivedAsPassed: false,
    reason: verification.reason,
  };
}

function inspectProduceInput(input: unknown, problems: string[]): void {
  if (!isRecord(input)) {
    problems.push('archive producer input must be an object');
    return;
  }
  if (!isRecord(input.candidate) || !isNonEmptyString(input.candidate.candidateId)) {
    problems.push('archive producer input requires a candidate with a stable candidateId');
  }
  if (!isRecord(input.ledger) || !Array.isArray(input.ledger.candidates) || !Array.isArray(input.ledger.events)) {
    problems.push('archive producer input requires a ledger with candidates and events arrays');
  }
  if (!isRecord(input.approval) || !isNonEmptyString(input.approval.candidateId)) {
    problems.push('archive producer input requires a human approval decision bound to the candidate');
  }
  if (!isNonEmptyString(input.campaignRoot)) problems.push('campaignRoot must be an explicit non-empty path');
  if (!isNonEmptyString(input.packageRoot)) problems.push('packageRoot must be an explicit non-empty path');
  if (!Array.isArray(input.sources) || input.sources.length === 0) {
    problems.push('archive producer input requires a non-empty declared sources list');
  } else if (
    input.sources.some(
      (source) =>
        !isRecord(source) ||
        !isRepositoryRelativePath(source.path) ||
        !ARCHIVE_FILE_KINDS.includes(source.kind as ManifestKind),
    )
  ) {
    problems.push('every declared source requires a safe relative path and a frozen archive kind');
  }
}

/** Build the real archive boundary over explicit injected collaborators. */
export function createTask1ArchiveBoundary(options: ArchiveBoundaryOptions = {}): ArchiveBoundary {
  const fileVerifier = options.fileVerifier ?? createCodeHealthFileVerifier();
  const revisionProvider = options.revisionProvider ?? createCodeHealthGitRevisionProvider();
  const now = options.now ?? (() => new Date());
  const producerMetadata = {
    producerId: options.producerId ?? ARCHIVE_PRODUCER_ID,
    producerVersion: options.producerVersion ?? ARCHIVE_PRODUCER_VERSION,
  };

  async function produce(input: ArchiveProduceInput): Promise<ArchiveBoundaryResult> {
    const problems: string[] = [];
    const level = declaredLevel(input, problems);
    inspectProduceInput(input, problems);
    if (problems.length > 0) {
      return refuse('STRUCTURE_INVALID', 'package-only', `archive producer rejected input: ${problems.join('; ')}`, 2);
    }
    // A source-bound claim is only meaningful once an explicit source project can establish it; every
    // refusal below therefore reports the level actually established, never the declared one.
    const effectiveLevel: VerificationLevel =
      level === 'source-bound' && input.sourceProject !== undefined ? 'source-bound' : 'package-only';

    const readiness = assessArchiveReadiness(input.candidate, input.ledger, input.approval);
    // The injected archived-as-passed gate is authoritative only for a verified-success candidate; a declared
    // terminal non-success is archivable as evidence and must never be forced through the success gate.
    const injected =
      options.assessCandidate && input.candidate.status === SUCCESS_TERMINAL_STATUS
        ? options.assessCandidate(input.candidate, input.ledger, input.approval)
        : [];
    const reasons = [...new Set([...readiness.reasons, ...injected])];
    if (reasons.length > 0) {
      return refuse('EVIDENCE_INVALID', effectiveLevel, `archive not authorized: ${reasons.join('; ')}`, 1);
    }

    const kinds = new Set(input.sources.map((source) => source.kind));
    const requiredKinds: ManifestKind[] = ['ledger', 'candidate', 'approval', 'review', 'gate', 'rollback'];
    const missingKinds = requiredKinds.filter((kind) => !kinds.has(kind));
    if (missingKinds.length > 0) {
      return refuse(
        'EVIDENCE_INVALID',
        level,
        `archive sources are incomplete; missing artifact kinds: ${missingKinds.join(', ')}`,
        1,
      );
    }

    if (level === 'source-bound') {
      if (input.sourceProject === undefined) {
        return refuse(
          'STRUCTURE_INVALID',
          'package-only',
          'source-bound archive provenance requires an explicit source project',
          1,
        );
      }
      const revision = await revisionProvider.verify(input.sourceProject, input.candidate.revision);
      if (!revision.ok) {
        return refuse(
          'REVISION_MISMATCH',
          'package-only',
          `source-bound provenance revision does not match the source project: ${revision.reason ?? 'revision mismatch'}`,
          1,
        );
      }
    }

    const campaignRootResolution = await resolveControlledRoot(input.campaignRoot);
    if (!campaignRootResolution.ok || !campaignRootResolution.canonicalRoot) {
      return refuse(
        campaignRootResolution.code ?? 'STRUCTURE_INVALID',
        level,
        campaignRootResolution.reason ?? 'campaignRoot is not a controlled directory',
        2,
      );
    }
    const campaignRoot = campaignRootResolution.canonicalRoot;

    const resolved: ResolvedSource[] = [];
    for (const source of input.sources) {
      const result = await resolveSource(campaignRoot, source, fileVerifier);
      if ('problem' in result) return refuse(result.code, effectiveLevel, result.problem, 1);
      resolved.push(result);
    }
    const redactionReasons = resolved
      .filter((source) => source.redacted)
      .map((source) => `redacted sensitive content in ${source.path}`);

    const absolutePackageRoot = path.resolve(input.packageRoot);
    const existing = await lstatOrNull(absolutePackageRoot);
    if (existing && !existing.isDirectory()) {
      return refuse('STRUCTURE_INVALID', effectiveLevel, 'packageRoot must be a directory or absent', 1);
    }
    if (existing && (await fs.readdir(absolutePackageRoot)).length > 0) {
      return refuse(
        'STRUCTURE_INVALID',
        effectiveLevel,
        'packageRoot must be empty or absent; refusing to overwrite an archive',
        1,
      );
    }

    const createdAt = now().toISOString();
    const manifest = buildManifest(
      input,
      resolved,
      redactionReasons.length > 0 ? redactionReasons : ['no sensitive content detected'],
      producerMetadata,
      createdAt,
    );
    const schema = validateBySchema('code-health-archive', manifest);
    if (!schema.valid) {
      return refuse(
        'STRUCTURE_INVALID',
        effectiveLevel,
        `produced manifest failed schema validation: ${schema.errorMessages.join('; ')}`,
        1,
      );
    }

    const staging = `${absolutePackageRoot}.staging-${process.pid}-${Date.now()}`;
    const createdPaths: string[] = [];
    try {
      await fs.mkdir(staging, { recursive: true });
      for (const source of resolved) {
        const target = path.join(staging, ...source.path.split('/'));
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, source.bytes, { flag: 'wx' });
        createdPaths.push(source.path);
      }
      const manifestPath = path.join(staging, ARCHIVE_MANIFEST_NAME);
      const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      const temporaryManifest = `${manifestPath}.tmp-${process.pid}-${Date.now()}`;
      await fs.writeFile(temporaryManifest, manifestBytes, { flag: 'wx' });
      await fs.rename(temporaryManifest, manifestPath);
      const readback = await fs.readFile(manifestPath);
      if (sha256Hex(readback) !== sha256Hex(manifestBytes)) {
        throw new Error('archive manifest readback hash mismatch');
      }
      createdPaths.push(ARCHIVE_MANIFEST_NAME);
      await fs.rename(staging, absolutePackageRoot);
    } catch (error) {
      await fs.rm(staging, { recursive: true, force: true }).catch(() => undefined);
      return refuse(
        'EVIDENCE_INVALID',
        level,
        `archive package could not be written atomically: ${error instanceof Error ? error.message : String(error)}`,
        1,
      );
    }

    const published = await readControlledFile(absolutePackageRoot, ARCHIVE_MANIFEST_NAME, 'manifest');
    if (!published.ok || !published.bytes) {
      await fs.rm(absolutePackageRoot, { recursive: true, force: true }).catch(() => undefined);
      return refuse(
        'EVIDENCE_INVALID',
        effectiveLevel,
        'archive manifest is missing after the atomic rename',
        1,
        absolutePackageRoot,
      );
    }
    let publishedManifest: ArchiveManifest;
    try {
      publishedManifest = JSON.parse(Buffer.from(published.bytes).toString('utf8')) as ArchiveManifest;
    } catch {
      return refuse(
        'EVIDENCE_INVALID',
        effectiveLevel,
        'published archive manifest is not valid JSON',
        1,
        absolutePackageRoot,
      );
    }
    if (archiveManifestDigest(publishedManifest) !== publishedManifest.contentHash) {
      return refuse(
        'EVIDENCE_INVALID',
        effectiveLevel,
        'published archive manifest digest does not match',
        1,
        absolutePackageRoot,
      );
    }
    return {
      ok: true,
      errorCode: null,
      manifest: publishedManifest,
      verificationLevel: effectiveLevel,
      createdPaths,
      exitCode: 0,
      path: absolutePackageRoot,
      archivedAsPassed: publishedManifest.archivedAsPassed,
      reason: publishedManifest.archivedAsPassed
        ? 'verified campaign candidate archived with human approval, review, gate, and executable rollback'
        : 'terminal non-success campaign evidence archived (never archived-as-passed)',
    };
  }

  return {
    producer: { produce },
    consumer: {
      consume: async (input) => {
        const verification = await verifyPackage(input, revisionProvider);
        return toResult(verification, typeof input?.packageRoot === 'string' ? path.resolve(input.packageRoot) : '.');
      },
    },
    verifier: {
      verify: async (input) => {
        const verification = await verifyPackage(input, revisionProvider);
        return toResult(verification, typeof input?.packageRoot === 'string' ? path.resolve(input.packageRoot) : '.');
      },
    },
  };
}
