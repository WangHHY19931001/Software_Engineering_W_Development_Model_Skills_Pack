/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- Every path is resolved beneath an explicit project root and verified through the canonical file verifier; environment keys are literal allowlist members. */
/**
 * IO-side deletion authority for Phase 3 test removal.
 *
 * This module is the bridge the pure logic cannot be: it binds the inventory's recorded facts to
 * real, canonical, revision-bound stored evidence and to a tracked repo-owned governance manifest.
 * It is the single authority consulted by both `cli/code-health-apply.ts` (file-class guard) and
 * `cli/code-health-tests.ts --guard`, so there is exactly one deletion-authority implementation.
 *
 * What is enforced structurally:
 *   - the inventory's ledger-anchored review (default-deny, equivalence, deleted-test identity);
 *   - candidate/inventory revision equality with the live repository revision;
 *   - exact change-scope equality with the inventory's removal candidate file, including that every
 *     test-surface file in scope is the authorized candidate (F-1);
 *   - each pre/post regression's raw output is verified by the injected `EvidenceStore` against the
 *     candidate/scope/revision binding, then re-read and re-parsed so the recorded count must equal
 *     the recomputed count (F-4);
 *   - the coverage provenance artifact exists as a canonical regular non-symlink file with the
 *     declared hash;
 *   - repo-owned governance facts come from a tracked `.code-health-governance.json` whose working
 *     bytes must equal the HEAD blob (F-5).
 *
 * Honest authority boundary: this module authenticates the *files and hashes* it is handed. It
 * cannot authenticate a fully forged ledger/project history; the ledger record, the human approval
 * gate, and the role signature chain remain the authority.
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import type {
  CodeHealthCandidate,
  EvidenceBinding,
  EvidenceRef,
  EvidenceStore,
  RevisionIdentity,
  RevisionProvider,
} from '../logic/code-health-contract.js';

import { createCodeHealthFileVerifier, resolveControlledRelativePath } from './code-health-file-verifier.js';
import { runSync } from './run-sync.js';

/** Repo-owned expected governance facts (structural mirror of the pure logic ExpectedGovernanceFacts). */
export interface GovernanceFacts {
  prePushItems?: number;
  selfTestSamples?: number;
  docsConsistencyViolations?: number;
  fixtureReachability?: string;
}

const GOVERNANCE_MANIFEST_PATH = '.code-health-governance.json';
const SUITE_FACT_PREFIX = 'CODE_HEALTH_SUITE ';
const HEX64_PATTERN = /^[0-9a-f]{64}$/;
const GIT_TIMEOUT_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Read and parse a tracked project file, verifying its working bytes equal the HEAD blob. */
export async function readTrackedJson(
  root: string,
  relativePath: string,
): Promise<{ value: unknown; violations: string[] }> {
  const { bytes, violations } = await readVerifiedTrackedFile(root, relativePath);
  if (bytes === null) return { value: undefined, violations };
  try {
    return { value: JSON.parse(bytes.toString('utf8')), violations };
  } catch {
    return { value: undefined, violations: [...violations, `tracked file ${relativePath} is not valid JSON`] };
  }
}

/** Resolve a possibly-absolute path to a repository-relative POSIX path, or null when it escapes the root. */
export function toTrackedRelativePath(root: string, target: string): string | null {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget).replace(/\\/g, '/');
  if (relative === '' || relative.startsWith('../') || path.isAbsolute(relative)) return null;
  return relative;
}

function gitEnvironment(): NodeJS.ProcessEnv {
  const keys = [
    'PATH',
    'PATHEXT',
    'SYSTEMROOT',
    'SYSTEMDRIVE',
    'WINDIR',
    'COMSPEC',
    'TEMP',
    'TMP',
    'USERPROFILE',
  ] as const;
  const environment: NodeJS.ProcessEnv = {
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_PAGER: 'cat',
  };
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.length > 0) environment[key] = value;
  }
  return environment;
}

/** Bytes of a tracked file at HEAD, or null when the path is not tracked. */
function trackedHeadBytes(root: string, relativePath: string): Buffer | null {
  const result = runSync('git', ['show', `HEAD:${relativePath}`], {
    cwd: root,
    env: gitEnvironment(),
    timeout: GIT_TIMEOUT_MS,
  });
  if (result.status !== 0 || typeof result.stdout !== 'string') return null;
  return Buffer.from(result.stdout, 'binary');
}

async function readVerifiedTrackedFile(
  root: string,
  relativePath: string,
): Promise<{ bytes: Buffer | null; violations: string[] }> {
  const violations: string[] = [];
  const headBytes = trackedHeadBytes(root, relativePath);
  if (headBytes === null) {
    violations.push(`tracked source is missing from HEAD: ${relativePath}`);
    return { bytes: null, violations };
  }
  const expectedSha256 = createHashHex(headBytes);
  const verifier = createCodeHealthFileVerifier();
  const result = await verifier.verifyRegularNonSymlinkFile({ root, relativePath, expectedSha256 });
  if (!result.ok) {
    violations.push(`tracked source ${relativePath} does not match its HEAD blob: ${result.reason ?? result.code}`);
    return { bytes: null, violations };
  }
  const resolution = resolveControlledRelativePath(root, relativePath);
  if (!resolution.ok || resolution.absolutePath === undefined) {
    violations.push(`tracked source ${relativePath} path is not controlled`);
    return { bytes: null, violations };
  }
  return { bytes: await fs.readFile(resolution.absolutePath), violations };
}

function createHashHex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Repo-owned expected governance facts. The manifest must be tracked at HEAD and its working bytes
 * must equal that blob, so an inventory cannot invent the expected values on the side.
 */
export async function readTrackedGovernanceManifest(
  root: string,
): Promise<{ facts: GovernanceFacts | null; violations: string[] }> {
  const { bytes, violations } = await readVerifiedTrackedFile(root, GOVERNANCE_MANIFEST_PATH);
  if (bytes === null) {
    violations.push(
      `removal authorization requires the tracked repo-owned governance manifest ${GOVERNANCE_MANIFEST_PATH}`,
    );
    return { facts: null, violations };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    return { facts: null, violations: [...violations, `${GOVERNANCE_MANIFEST_PATH} is not valid JSON`] };
  }
  if (!isRecord(parsed))
    return { facts: null, violations: [...violations, `${GOVERNANCE_MANIFEST_PATH} must be an object`] };
  const facts: GovernanceFacts = {};
  if (typeof parsed.prePushItems === 'number' && Number.isInteger(parsed.prePushItems)) {
    facts.prePushItems = parsed.prePushItems;
  } else {
    violations.push(`${GOVERNANCE_MANIFEST_PATH}.prePushItems must be an integer`);
  }
  if (typeof parsed.selfTestSamples === 'number' && Number.isInteger(parsed.selfTestSamples)) {
    facts.selfTestSamples = parsed.selfTestSamples;
  } else {
    violations.push(`${GOVERNANCE_MANIFEST_PATH}.selfTestSamples must be an integer`);
  }
  if (typeof parsed.docsConsistencyViolations === 'number' && Number.isInteger(parsed.docsConsistencyViolations)) {
    facts.docsConsistencyViolations = parsed.docsConsistencyViolations;
  } else {
    violations.push(`${GOVERNANCE_MANIFEST_PATH}.docsConsistencyViolations must be an integer`);
  }
  if (typeof parsed.fixtureReachability === 'string' && parsed.fixtureReachability.trim() !== '') {
    facts.fixtureReachability = parsed.fixtureReachability;
  } else {
    violations.push(`${GOVERNANCE_MANIFEST_PATH}.fixtureReachability must be a non-empty string`);
  }
  return { facts, violations };
}

/** Tracked repo-owned suite manifest: the only accepted source of the pre/post suite argv (F-2). */
export async function readTrackedSuiteManifest(
  root: string,
  relativePath: string,
): Promise<{ command: string[] | null; violations: string[] }> {
  const { bytes, violations } = await readVerifiedTrackedFile(root, relativePath);
  if (bytes === null) return { command: null, violations };
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    return { command: null, violations: [...violations, `${relativePath} is not valid JSON`] };
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.command) || parsed.command.length === 0) {
    return { command: null, violations: [...violations, `${relativePath}.command must be a non-empty argv array`] };
  }
  if (!parsed.command.every((entry) => typeof entry === 'string' && entry.length > 0)) {
    return {
      command: null,
      violations: [...violations, `${relativePath}.command must contain only non-empty strings`],
    };
  }
  return { command: parsed.command as string[], violations };
}

export interface SuiteFacts {
  testCount?: number;
  identities?: string[];
}

/** Parse the machine-readable suite facts from a stored raw output envelope. */
export function parseSuiteFactsFromRawOutput(raw: string): { facts: SuiteFacts; violations: string[] } {
  let payload = raw;
  try {
    const envelope = JSON.parse(raw) as unknown;
    if (isRecord(envelope) && typeof envelope.output === 'string') payload = envelope.output;
  } catch {
    // Not an envelope: parse the raw text directly.
  }
  const line = payload.split(/\r?\n/).find((entry) => entry.startsWith(SUITE_FACT_PREFIX));
  if (line === undefined) {
    return { facts: {}, violations: ['suite raw output did not report CODE_HEALTH_SUITE facts'] };
  }
  try {
    const parsed = JSON.parse(line.slice(SUITE_FACT_PREFIX.length)) as SuiteFacts;
    const violations: string[] = [];
    if (typeof parsed.testCount !== 'number' || !Number.isInteger(parsed.testCount) || parsed.testCount < 0) {
      violations.push('suite facts must report an integer testCount');
    }
    if (
      !Array.isArray(parsed.identities) ||
      parsed.identities.length === 0 ||
      !parsed.identities.every((entry) => typeof entry === 'string' && entry.length > 0)
    ) {
      violations.push('suite facts must report a non-empty list of test identities');
    } else if (new Set(parsed.identities).size !== parsed.identities.length) {
      violations.push('suite facts test identities must be unique');
    }
    return { facts: parsed, violations };
  } catch {
    return { facts: {}, violations: ['suite raw output facts are not valid JSON'] };
  }
}

async function readRawOutput(root: string, relativePath: string): Promise<string | null> {
  const resolution = resolveControlledRelativePath(root, relativePath);
  if (!resolution.ok || resolution.absolutePath === undefined) return null;
  try {
    return await fs.readFile(resolution.absolutePath, 'utf8');
  } catch {
    return null;
  }
}

function sameRevision(left: unknown, right: RevisionIdentity): boolean {
  return (
    isRecord(left) &&
    left.commitSha === right.commitSha &&
    left.treeSha === right.treeSha &&
    left.sourceBundleSha256 === right.sourceBundleSha256
  );
}

function stringSet(value: unknown): Set<string> {
  return new Set(Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []);
}

function firstLedgerCandidate(ledger: unknown, candidateId: unknown): Record<string, unknown> | undefined {
  if (!isRecord(ledger) || !Array.isArray(ledger.candidates)) return undefined;
  return (ledger.candidates as Array<Record<string, unknown>>).find((entry) => entry.candidateId === candidateId);
}

export interface ScopePathRole {
  file: string;
  /** Positively declared as a test by the candidate record or the tracked ledger record. */
  declaredTest: boolean;
  /** Positively declared inside the implementation change scope by the candidate or tracked ledger. */
  declaredImplementation: boolean;
}

/**
 * Classify every change-scope path by its DECLARED role instead of by its name. This is the
 * structural inversion of the old `isTestSurfacePath` name heuristic: renaming a test, moving it to
 * `spec/` or `legacy/`, or giving it a helper-looking name can never change its declared role.
 */
export function scopePathRoles(candidate: CodeHealthCandidate, ledger: unknown): ScopePathRole[] {
  const scopeFiles = Array.isArray(candidate?.changeScope?.files) ? candidate.changeScope.files : [];
  const candidateFiles = stringSet((candidate as unknown as { files?: unknown })?.files);
  const candidateTests = stringSet((candidate as unknown as { tests?: unknown })?.tests);
  const ledgerCandidate = firstLedgerCandidate(
    ledger,
    (candidate as unknown as { candidateId?: unknown })?.candidateId,
  );
  const ledgerFiles = stringSet(ledgerCandidate?.files);
  const ledgerTests = stringSet(ledgerCandidate?.tests);
  return scopeFiles.map((file) => ({
    file,
    declaredTest: candidateTests.has(file) || ledgerTests.has(file),
    declaredImplementation: candidateFiles.has(file) || ledgerFiles.has(file),
  }));
}

export interface DeletionAuthorizationInput {
  repositoryRoot: string;
  candidate: CodeHealthCandidate;
  inventory: unknown;
  /** The tracked ledger record, already read from HEAD by the caller via `readTrackedJson`. */
  ledger: unknown;
  /** Pure review result computed by the caller via `evaluateTestInventory` against the tracked ledger. */
  review: { violations: string[] };
  evidenceStore: EvidenceStore;
  revisionProvider: RevisionProvider;
}

export interface DeletionAuthorizationResult {
  ok: boolean;
  violations: string[];
  liveRevision: RevisionIdentity | null;
}

async function verifyRegressionEvidence(
  field: 'preRegression' | 'postRegression',
  inventory: Record<string, unknown>,
  candidate: CodeHealthCandidate,
  liveRevision: RevisionIdentity,
  input: DeletionAuthorizationInput,
): Promise<string[]> {
  const violations: string[] = [];
  const regression = inventory[field];
  if (!isRecord(regression) || !isRecord(regression.command)) {
    return [`${field}.command evidence is required`];
  }
  const command = regression.command;
  const rawOutputPath = command.rawOutputPath;
  const rawOutputSha256 = command.rawOutputSha256;
  if (
    typeof rawOutputPath !== 'string' ||
    typeof rawOutputSha256 !== 'string' ||
    !HEX64_PATTERN.test(rawOutputSha256)
  ) {
    return [`${field}.command must carry a controlled raw output path and SHA-256`];
  }
  const binding: EvidenceBinding = {
    candidate: {
      candidateId: candidate.candidateId,
      phase: candidate.phase,
      action: candidate.action,
      files: candidate.changeScope.files,
      symbols: candidate.changeScope.symbols,
      scopeHash: candidate.changeScope.scopeHash,
    },
    revision: liveRevision,
    rawOutputPath,
    rawOutputSha256,
  };
  const ref: EvidenceRef = {
    evidenceId: `EVD-DELETION-${field}-${candidate.candidateId}`,
    candidateId: candidate.candidateId,
    scopeHash: candidate.changeScope.scopeHash,
    relativePath: rawOutputPath,
    sha256: rawOutputSha256,
    revision: liveRevision,
    observation: command.observation === 'observed' ? 'observed' : 'not_run',
  };
  let verified: Awaited<ReturnType<EvidenceStore['verify']>> | null = null;
  try {
    verified = await input.evidenceStore.verify(ref, binding);
  } catch (error) {
    violations.push(`${field} evidence verification failed: ${error instanceof Error ? error.message : String(error)}`);
    return violations;
  }
  if (!verified.ok) {
    violations.push(`${field} raw output is not bound to the candidate/revision: ${verified.reason ?? verified.code}`);
    return violations;
  }
  const raw = await readRawOutput(input.repositoryRoot, rawOutputPath);
  if (raw === null) {
    violations.push(`${field} raw output could not be read back from the controlled run`);
    return violations;
  }
  const parsed = parseSuiteFactsFromRawOutput(raw);
  violations.push(...parsed.violations);
  if (typeof parsed.facts.testCount === 'number' && parsed.facts.testCount !== regression.testCount) {
    violations.push(
      `${field} recorded test count ${String(regression.testCount)} disagrees with the recomputed count ${parsed.facts.testCount}`,
    );
  }
  return violations;
}

/**
 * Verify that a proposed test deletion is authorized. Returns blocking reasons; empty means the live
 * revision, the canonical stored evidence, and the existing tracked artifacts all agree. Never reads
 * or writes the caller's declared labels for authority.
 */
export async function verifyDeletionEvidence(input: DeletionAuthorizationInput): Promise<DeletionAuthorizationResult> {
  const violations: string[] = [];
  violations.push(...input.review.violations);
  const ledger = input.ledger;
  const inventory = isRecord(input.inventory) ? input.inventory : {};
  const liveRevision = await input.revisionProvider.current(input.repositoryRoot);
  if (liveRevision === null) {
    violations.push('removal authorization requires an available live repository revision');
  } else {
    if (!sameRevision(input.candidate.revision, liveRevision)) {
      violations.push('candidate revision is stale for the live repository revision');
    }
    if (!sameRevision(inventory.revision, liveRevision)) {
      violations.push('inventory revision is stale for the live repository revision');
    }
  }

  const roles = scopePathRoles(input.candidate, ledger);
  for (const role of roles) {
    if (!role.declaredTest && !role.declaredImplementation) {
      violations.push(`path ${role.file} is not in the candidate's tracked implementation scope`);
    }
  }
  const declaredTestFiles = roles.filter((role) => role.declaredTest).map((role) => role.file);

  const proof = isRecord(inventory.removalProof) ? inventory.removalProof : null;
  if (proof === null) {
    violations.push('a test-surface change requires a removalProof citing the exact deleted test identity');
  }
  const tests = Array.isArray(inventory.tests) ? inventory.tests : [];
  const removalCandidate =
    proof && typeof proof.candidateTestId === 'string'
      ? tests.find((entry) => isRecord(entry) && entry.testId === proof.candidateTestId)
      : undefined;
  const removalFile =
    isRecord(removalCandidate) && typeof removalCandidate.file === 'string' ? removalCandidate.file : null;
  const scopeFiles = Array.isArray(input.candidate.changeScope?.files) ? input.candidate.changeScope.files : [];
  if (removalFile === null || !scopeFiles.includes(removalFile)) {
    violations.push('deletion scope does not cite the inventory removal candidate file');
  } else {
    for (const file of declaredTestFiles) {
      if (file !== removalFile) {
        violations.push(`test-declared scope file ${file} has no ledger-anchored removal authorization`);
      }
    }
  }

  // The tracked ledger must declare the candidate file inside the approved scope and tests.
  if (isRecord(ledger) && liveRevision !== null) {
    const ledgerCandidate = Array.isArray(ledger.candidates)
      ? (ledger.candidates as Array<Record<string, unknown>>).find(
          (entry) => entry.candidateId === inventory.candidateId,
        )
      : undefined;
    if (!ledgerCandidate) {
      violations.push('ledger does not record the candidate authorizing this deletion');
    } else {
      const ledgerScopeFiles =
        isRecord(ledgerCandidate.changeScope) && Array.isArray(ledgerCandidate.changeScope.files)
          ? (ledgerCandidate.changeScope.files as string[])
          : [];
      const ledgerTests = Array.isArray(ledgerCandidate.tests) ? (ledgerCandidate.tests as string[]) : [];
      if (removalFile !== null && !ledgerScopeFiles.includes(removalFile) && !ledgerTests.includes(removalFile)) {
        violations.push('ledger record does not declare the removal candidate inside its approved scope');
      }
    }
  }

  if (liveRevision !== null) {
    violations.push(
      ...(await verifyRegressionEvidence('preRegression', inventory, input.candidate, liveRevision, input)),
    );
    violations.push(
      ...(await verifyRegressionEvidence('postRegression', inventory, input.candidate, liveRevision, input)),
    );
  }

  const coverage = isRecord(inventory.coverageProvenance) ? inventory.coverageProvenance : {};
  if (typeof coverage.path === 'string' && typeof coverage.sha256 === 'string' && HEX64_PATTERN.test(coverage.sha256)) {
    const verifier = createCodeHealthFileVerifier();
    const verifiedCoverage = await verifier.verifyRegularNonSymlinkFile({
      root: input.repositoryRoot,
      relativePath: coverage.path,
      expectedSha256: coverage.sha256,
    });
    if (!verifiedCoverage.ok) {
      violations.push(
        `coverage provenance re-verification failed: ${verifiedCoverage.reason ?? verifiedCoverage.code}`,
      );
    }
  } else {
    violations.push('coverage provenance must carry a controlled path and SHA-256');
  }

  return { ok: violations.length === 0, violations, liveRevision };
}
