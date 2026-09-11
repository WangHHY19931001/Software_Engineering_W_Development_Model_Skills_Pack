#!/usr/bin/env tsx
/**
 * Code-health approved-application executor.
 *
 * Flags:
 *   --candidate <file>   candidate JSON (required)
 *   --approval <file>    human ApprovalDecision JSON (required for patch/commit; the plan itself is
 *                        produced by the pure `applyApproved`)
 *   --root <dir>         explicit repository root (default: cwd)
 *   --mode <mode>        dry-run | patch | commit (alias: apply = commit); default dry-run
 *
 * Guard order is fixed (R7):
 *   1. flag parsing — unknown flag, duplicated value flag, empty/missing value, unknown mode → exit 2
 *      with `ERROR_JSON` on stdout;
 *   2. approval validation — missing / non-human / scope-revision-action-files-symbols mismatch → exit 1
 *      with `HUMAN_APPROVAL_REQUIRED` on stdout;
 *   3. only then may anything be written.
 *
 * Safety: real writes happen only beneath the explicit `--root`; `dry-run` writes nothing; `patch` writes
 * one controlled patch under `<root>/.w-model/code-health/apply/`; `commit` runs `git apply --check` then
 * `git apply` with an argv array (no shell string), reads the real status back, and refuses to claim
 * success when any path outside the exact approved scope changed.
 *
 * Exit codes: 0 proposal/applied, 1 fail-closed validation or write failure, 2 input error.
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  AbstractionProposal,
  ApplyResult,
  ApprovalDecision,
  CodeHealthCandidate,
  CodeHealthLedger,
  DuplicateCluster,
  DuplicateInput,
  RollbackPlan,
  RevisionIdentity,
} from '../logic/code-health-contract.js';
import {
  authorityFromLedgerCandidate,
  clusterDuplicates,
  proveAbstraction,
  restrictAuthority,
  type DuplicateClusterAuthority,
} from '../logic/code-health-duplicate-logic.js';
import { applyApproved, CodeHealthError, codeHealthApplyPatchPath } from '../logic/code-health-ledger-logic.js';
import { evaluateTestInventory } from '../logic/code-health-test-logic.js';
import { exitWithError } from '../lib/cli-error.js';
import {
  readTrackedGovernanceManifest,
  readTrackedJson,
  scopePathRoles,
  toTrackedRelativePath,
  verifyDeletionEvidence,
} from '../lib/code-health-deletion-authority.js';
import { createCodeHealthEvidenceStore } from '../lib/code-health-evidence-store.js';
import { createCodeHealthGitRevisionProvider } from '../lib/code-health-revision-provider.js';
import {
  isPathWithin,
  resolveControlledRelativePath,
  resolveControlledRoot,
} from '../lib/code-health-file-verifier.js';
import { readJsonOrExit } from '../lib/read-json-or-exit.js';
import { runMain } from '../lib/run-main.js';
import { runSync } from '../lib/run-sync.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';

const VALUE_FLAGS = ['candidate', 'approval', 'root', 'mode', 'inventory', 'ledger', 'matrix'] as const;
type ApplyFlag = (typeof VALUE_FLAGS)[number];
const APPLY_MODES = new Set(['dry-run', 'patch', 'commit']);
const GIT_TIMEOUT_MS = 30_000;
const revisionProvider = createCodeHealthGitRevisionProvider();

class ApplyArgumentError extends Error {}

function parseApplyArgs(argv: readonly string[]): Partial<Record<ApplyFlag, string>> {
  const values: Partial<Record<ApplyFlag, string>> = {};
  for (let index = 0; index < argv.length; index += 1) {
    // eslint-disable-next-line security/detect-object-injection -- index is a loop counter over argv.
    const argument = argv[index]!;
    if (!argument.startsWith('--')) throw new ApplyArgumentError(`unexpected positional argument: ${argument}`);
    const equals = argument.indexOf('=');
    const name = (equals === -1 ? argument.slice(2) : argument.slice(2, equals)) as ApplyFlag;
    if (!(VALUE_FLAGS as readonly string[]).includes(name)) {
      throw new ApplyArgumentError(`unknown flag: ${argument}`);
    }
    let value: string;
    if (equals !== -1) {
      value = argument.slice(equals + 1);
      if (value === '') throw new ApplyArgumentError(`empty value for --${name}`);
    } else {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--')) throw new ApplyArgumentError(`missing value for --${name}`);
      value = next;
      index += 1;
      if (value === '') throw new ApplyArgumentError(`empty value for --${name}`);
    }
    // eslint-disable-next-line security/detect-object-injection -- name is validated against VALUE_FLAGS above.
    if (values[name] !== undefined) throw new ApplyArgumentError(`duplicate flag: --${name}`);
    // eslint-disable-next-line security/detect-object-injection -- name is validated against VALUE_FLAGS above.
    values[name] = value;
  }
  return values;
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
  const environment: NodeJS.ProcessEnv = {
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_PAGER: 'cat',
  };
  for (const key of keys) {
    // eslint-disable-next-line security/detect-object-injection -- key is a literal member of the allowlist above.
    const value = process.env[key];
    if (typeof value === 'string' && value.length > 0 && !value.includes('\u0000')) {
      // eslint-disable-next-line security/detect-object-injection -- key is a literal member of the allowlist above.
      environment[key] = value;
    }
  }
  return environment;
}

interface GitRun {
  status: number | null;
  stdout: string;
  stderr: string;
}

function git(root: string, args: string[]): GitRun {
  const result = runSync('git', args, { cwd: root, env: gitEnvironment(), timeout: GIT_TIMEOUT_MS });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

/** Build a real `git apply` deletion patch for one repository-relative file. */
function buildDeletionPatch(relativePath: string, content: string): string {
  const header = `diff --git a/${relativePath} b/${relativePath}\ndeleted file mode 100644\n--- a/${relativePath}\n+++ /dev/null\n`;
  if (content === '') return header;
  const finalNewline = content.endsWith('\n');
  const lines = (finalNewline ? content.slice(0, -1) : content).split('\n');
  const range = lines.length === 1 ? '@@ -1 +0,0 @@' : `@@ -1,${lines.length} +0,0 @@`;
  const body = lines.map((line) => `-${line}`).join('\n');
  return `${header}${range}\n${body}${finalNewline ? '' : '\n\\ No newline at end of file'}\n`;
}

async function buildPatchBytes(root: string, candidate: CodeHealthCandidate): Promise<Uint8Array> {
  // Canonical-root containment, aligned with `lib/code-health-file-verifier.ts`: the controlled root must
  // be a real non-symlink directory, and every parent component of a scope path must be a real non-symlink
  // directory beneath the root. Without this, a symlinked parent directory inside the root could smuggle
  // bytes from outside the root into the controlled deletion patch (read asymmetry, R11 Task 3 MINOR-3).
  const rootResolution = await resolveControlledRoot(root);
  if (!rootResolution.ok || rootResolution.canonicalRoot === undefined) {
    throw new CodeHealthError(
      rootResolution.code ?? 'STRUCTURE_INVALID',
      rootResolution.reason ?? 'the repository root is not controlled',
    );
  }
  const canonicalRoot = rootResolution.canonicalRoot;
  const chunks: string[] = [];
  const seen = new Set<string>();
  for (const relativePath of candidate.changeScope.files) {
    if (seen.has(relativePath)) continue;
    seen.add(relativePath);
    const resolution = resolveControlledRelativePath(root, relativePath);
    if (!resolution.ok || resolution.absolutePath === undefined) {
      throw new CodeHealthError('STRUCTURE_INVALID', `approved scope path is unsafe: ${relativePath}`);
    }
    // Reject a symlinked parent component before any read (mirrors the file verifier's component walk).
    let current = canonicalRoot;
    for (const component of relativePath.split('/').slice(0, -1)) {
      current = path.join(current, component);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- current is canonicalRoot joined with a validated component of a repository-relative scope path.
      const entry = await fs.lstat(current).catch(() => null);
      if (entry === null) {
        throw new CodeHealthError('EVIDENCE_INVALID', `approved scope parent is missing: ${relativePath}`);
      }
      if (entry.isSymbolicLink()) {
        throw new CodeHealthError(
          'SECURITY_BLOCKED',
          `approved scope path traverses a symlinked parent: ${relativePath}`,
        );
      }
      if (!entry.isDirectory()) {
        throw new CodeHealthError('EVIDENCE_INVALID', `approved scope parent is not a directory: ${relativePath}`);
      }
    }
    const canonicalTarget = path.resolve(canonicalRoot, ...relativePath.split('/'));
    let stats;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- canonicalTarget is bounded by the canonical root walk above.
      stats = await fs.lstat(canonicalTarget);
    } catch {
      throw new CodeHealthError('EVIDENCE_INVALID', `approved scope file is missing: ${relativePath}`);
    }
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new CodeHealthError(
        'EVIDENCE_INVALID',
        `approved scope is not a regular non-symlink file: ${relativePath}`,
      );
    }
    // The realpath must be the canonical target itself and stay inside the canonical root.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- canonicalTarget is bounded by the canonical root walk above.
    const realPath = await fs.realpath(canonicalTarget).catch(() => null);
    if (realPath === null || path.resolve(realPath) !== canonicalTarget || !isPathWithin(canonicalRoot, realPath)) {
      throw new CodeHealthError(
        'SECURITY_BLOCKED',
        `approved scope file escapes the controlled root during verification: ${relativePath}`,
      );
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- canonicalTarget is bounded by the walk above.
    const content = await fs.readFile(canonicalTarget, 'utf8');
    chunks.push(buildDeletionPatch(relativePath, content));
  }
  return new TextEncoder().encode(chunks.join(''));
}

/** Parse `git status --porcelain=v1 -z` output into repository-relative POSIX paths. */
function parseStatus(stdout: string): string[] {
  const paths = new Set<string>();
  for (const entry of stdout.split('\u0000')) {
    if (entry.length <= 3) continue;
    const file = entry.slice(3).replace(/\\/g, '/');
    if (file.length > 0) paths.add(file);
  }
  return [...paths].sort();
}

async function writePatch(root: string, patchRelativePath: string, bytes: Uint8Array): Promise<string> {
  const resolution = resolveControlledRelativePath(root, patchRelativePath);
  if (!resolution.ok || resolution.absolutePath === undefined) {
    throw new CodeHealthError('STRUCTURE_INVALID', 'controlled patch path escapes the repository root');
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- absolutePath is bounded by resolveControlledRelativePath.
  await fs.mkdir(path.dirname(resolution.absolutePath), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- absolutePath is bounded by resolveControlledRelativePath.
  await fs.writeFile(resolution.absolutePath, bytes);
  return createHash('sha256').update(bytes).digest('hex');
}

function blockResult(
  mode: 'dry-run' | 'patch' | 'commit',
  reason: string,
  errorCode: CodeHealthError['code'],
): ApplyResult {
  return {
    kind: 'blocked',
    applied: false,
    errorCode,
    mode,
    patchPath: null,
    appliedFiles: [],
    unrelatedFiles: [],
    rollback: null,
    reason,
  };
}

function emit(exitCode: 0 | 1, payload: object): void {
  console.log(`APPLY_JSON ${JSON.stringify({ type: 'code-health-apply', exitCode, ...payload })}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Declared-role deletion guard (FIX-A). The decision never depends on a path name: a path is a test
 * only when the candidate record or the tracked ledger record positively declares it as one
 * (`tests`), and it is an implementation file only when one of them declares it in `files`. Every
 * other path is refused (default-deny). A test deletion additionally requires a ledger-anchored
 * inventory authorization citing that exact path/identity, and a Phase 3 candidate is always treated
 * as a test deletion. The authority is delegated to the shared IO verifier, which re-verifies the
 * stored evidence and the tracked governance manifest.
 */
async function deletionScopeGuardViolations(
  candidate: CodeHealthCandidate,
  inventoryFlag: string | undefined,
  ledgerFlag: string | undefined,
  root: string,
): Promise<string[]> {
  const scopeFiles = Array.isArray(candidate.changeScope?.files) ? candidate.changeScope.files : [];
  if (scopeFiles.length === 0) return [];

  let ledgerValue: unknown;
  let ledgerRelative: string | null = null;
  if (ledgerFlag !== undefined) {
    ledgerRelative = toTrackedRelativePath(root, ledgerFlag);
    if (ledgerRelative === null) {
      return ['the --ledger authority must be a repository-relative tracked file beneath --root'];
    }
    const ledgerRead = await readTrackedJson(root, ledgerRelative);
    if (ledgerRead.value === undefined) {
      return [...ledgerRead.violations, 'the --ledger authority must be a tracked project file recorded at HEAD'];
    }
    ledgerValue = ledgerRead.value;
  }
  const roles = scopePathRoles(candidate, ledgerValue);
  const requiresTestAuthorization = candidate.phase === 'P3' || roles.some((role) => role.declaredTest);

  if (!requiresTestAuthorization) {
    const notImplementation = roles.filter((role) => !role.declaredImplementation);
    if (notImplementation.length > 0) {
      return notImplementation.map(
        (role) => `path ${role.file} is not in the candidate's tracked implementation scope`,
      );
    }
    // Pure implementation deletion: Task 3's approval gate remains the authority.
    return [];
  }

  if (inventoryFlag === undefined) {
    return ['a test deletion requires --inventory <removal-proof>'];
  }
  if (ledgerFlag === undefined) {
    return ['a test deletion requires an explicit tracked --ledger <file> authority'];
  }
  const document = await readJsonOrExit<unknown>(inventoryFlag);
  if (!isRecord(document)) return ['the removal inventory must be an object'];
  if (isRecord(document.ledger)) {
    return ['an embedded inventory ledger is not an accepted authority; supply a tracked --ledger file'];
  }
  const inventory = isRecord(document.inventory) ? document.inventory : document;
  const violations: string[] = [];
  const schema = validateBySchema('code-health-test-inventory', inventory);
  if (!schema.valid) violations.push(...schema.errorMessages.map((message) => `[schema] ${message}`));
  const manifest = await readTrackedGovernanceManifest(root);
  violations.push(...manifest.violations);
  const evidenceStore = createCodeHealthEvidenceStore({
    repositoryRoot: root,
    rawOutputRoot: '.w-model/code-health/raw',
  });
  const review = evaluateTestInventory({ inventory, ledger: ledgerValue }, manifest.facts ?? {});
  const authority = await verifyDeletionEvidence({
    repositoryRoot: root,
    candidate,
    inventory,
    ledger: ledgerValue,
    review,
    evidenceStore,
    revisionProvider,
  });
  violations.push(...authority.violations);
  return violations;
}

/**
 * Phase 4 abstraction guard (Task 6, fix round 1). An `abstract` candidate may never be applied on the
 * strength of a human approval alone, and the cluster may never be caller-supplied: the guard requires
 * a HEAD-tracked ledger (`--ledger`, working bytes equal to the HEAD blob) plus the duplicate matrix
 * (`--matrix`), derives the authority from the tracked ledger candidate, RECOMPUTES the cluster from
 * the matrix input, and refuses unless
 *   - the tracked ledger records a P4 `abstract` candidate matching the approved candidate;
 *   - the caller's `restrictions` only narrow the tracked scope (never add a call site);
 *   - every recomputed stable site and implementation is inside the human-approved change scope;
 *   - `proveAbstraction` returns no violation (≥2 independent tracked stable production call sites, all
 *     semantic items proven item-wise, a quantified maintenance benefit, an executable rollback, and an
 *     exact minimal migrated call-site set).
 * A malformed matrix/ledger/proposal is a blocking violation here (never a silent pass).
 */
async function abstractionGuardViolations(
  candidate: CodeHealthCandidate,
  matrixFlag: string | undefined,
  ledgerFlag: string | undefined,
  root: string,
): Promise<string[]> {
  if (candidate.action !== 'abstract') return [];
  if (matrixFlag === undefined || ledgerFlag === undefined) {
    return [
      'an abstract candidate requires a HEAD-tracked --ledger <file> and a --matrix <file> Phase 4 authorization',
    ];
  }
  const matrixValue = await readJsonOrExit<unknown>(matrixFlag);
  if (!isRecord(matrixValue) || !isRecord(matrixValue.input)) {
    return ['the Phase 4 matrix must be an object carrying the duplicate input'];
  }
  const violations: string[] = [];
  if (matrixValue.candidateId !== candidate.candidateId) {
    violations.push('the Phase 4 matrix does not belong to the approved candidate');
  }

  const ledgerRelative = toTrackedRelativePath(root, ledgerFlag);
  if (ledgerRelative === null) {
    return ['the --ledger authority must be a repository-relative tracked file beneath --root'];
  }
  const ledgerRead = await readTrackedJson(root, ledgerRelative);
  if (ledgerRead.value === undefined) {
    return [
      `the --ledger authority must be tracked at HEAD with working bytes equal to the HEAD blob${ledgerRead.violations.length > 0 ? `: ${ledgerRead.violations.join('; ')}` : ''}`,
    ];
  }
  const ledger = ledgerRead.value as CodeHealthLedger;
  const candidates: unknown[] = isRecord(ledger) && Array.isArray(ledger.candidates) ? ledger.candidates : [];
  const ledgerCandidate = candidates.find(
    (entry): entry is Record<string, unknown> => isRecord(entry) && entry.candidateId === candidate.candidateId,
  );
  if (ledgerCandidate === undefined) {
    return [`the tracked ledger does not record the approved candidate ${candidate.candidateId}`];
  }
  const trackedAuthority = authorityFromLedgerCandidate(ledgerCandidate);
  if (trackedAuthority === null) {
    return [`the tracked ledger candidate ${candidate.candidateId} is not a P4 abstract candidate`];
  }

  const restrictions = isRecord(matrixValue.restrictions) ? matrixValue.restrictions : {};
  const authority: DuplicateClusterAuthority = restrictAuthority(trackedAuthority, restrictions);

  // The tracked ledger is the authority; the human-approved candidate scope may only NARROW it.
  const ledgerScope = new Set(trackedAuthority.approvedScope);
  for (const file of candidate.changeScope.files) {
    if (!ledgerScope.has(file)) {
      violations.push(`approved change scope ${file} is not declared by the tracked ledger candidate`);
    }
  }

  let cluster: DuplicateCluster;
  try {
    cluster = clusterDuplicates(matrixValue.input as unknown as DuplicateInput, authority);
  } catch (error) {
    return [...violations, error instanceof Error ? error.message : String(error)];
  }
  const review = isRecord(matrixValue.review) ? matrixValue.review : {};
  const merged: DuplicateCluster = { ...cluster };
  if (review.equivalenceProof !== undefined)
    merged.equivalenceProof = review.equivalenceProof as DuplicateCluster['equivalenceProof'];
  if (typeof review.maintenanceBenefit === 'string') merged.maintenanceBenefit = review.maintenanceBenefit;
  if (review.rollback !== undefined) merged.rollback = review.rollback as RollbackPlan;
  if (review.redaction !== undefined) merged.redaction = review.redaction as DuplicateCluster['redaction'];

  const scope = new Set(candidate.changeScope.files);
  for (const site of merged.stableProductionCallSites) {
    const file = site.slice(0, site.lastIndexOf(':'));
    if (!scope.has(file)) violations.push(`stable call site ${site} is outside the approved change scope`);
  }
  for (const entry of merged.implementations) {
    if (!scope.has(entry.file)) {
      violations.push(`clustered implementation ${entry.file} is outside the approved change scope`);
    }
  }

  if (isRecord(matrixValue.proposal)) {
    try {
      violations.push(...proveAbstraction(merged, matrixValue.proposal as unknown as AbstractionProposal));
    } catch (error) {
      violations.push(error instanceof Error ? error.message : String(error));
    }
  } else {
    violations.push('the Phase 4 matrix must carry an abstraction proposal');
  }
  return violations;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let parsed: Partial<Record<ApplyFlag, string>>;
  try {
    parsed = parseApplyArgs(argv);
  } catch (error) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: error instanceof Error ? error.message : String(error),
      detail:
        'usage: code-health-apply.ts --candidate <file> [--approval <file>] [--root <dir>] [--mode dry-run|patch|commit] [--ledger <file> --matrix <file>]',
      exitCode: 2,
    });
    return;
  }
  if (parsed.candidate === undefined) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: 'missing required flag: --candidate',
      exitCode: 2,
    });
    return;
  }
  const rawMode = parsed.mode ?? 'dry-run';
  const mode: 'dry-run' | 'patch' | 'commit' =
    rawMode === 'apply' ? 'commit' : (rawMode as 'dry-run' | 'patch' | 'commit');
  if (!APPLY_MODES.has(mode)) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: `unknown --mode value: ${rawMode}`,
      detail: 'allowed modes: dry-run | patch | commit (alias: apply)',
      exitCode: 2,
    });
    return;
  }

  const root = path.resolve(parsed.root ?? process.cwd());
  const candidate = await readJsonOrExit<CodeHealthCandidate>(parsed.candidate);
  const approval = parsed.approval === undefined ? undefined : await readJsonOrExit<ApprovalDecision>(parsed.approval);

  // Phase 3 (Task 5, FIX-A): the guard is keyed on the DECLARED ROLE of every change-scope path,
  // never on a path name. A test-declared path (or any Phase 3 candidate) may only be deleted with a
  // ledger-anchored inventory authorization citing that exact path/identity; a path in neither the
  // implementation nor the test declaration is refused. Embedded ledgers and missing evidence are
  // refused before a single write.
  // Phase 3 declared-role guard runs for every candidate (including `abstract`): a scope path that
  // is test-declared, or not declared in the candidate's implementation scope, is refused before any
  // write. An `abstract` candidate additionally needs the Phase 4 proof below.
  const guardViolations = await deletionScopeGuardViolations(candidate, parsed.inventory, parsed.ledger, root);
  if (guardViolations.length > 0) {
    for (const violation of guardViolations) console.error(`✗ [EVIDENCE_INVALID] ${violation}`);
    const reason = `deletion scope requires a validated authorization: ${guardViolations.join('; ')}`;
    emit(1, blockResult(mode, reason, 'EVIDENCE_INVALID'));
    process.exitCode = 1;
    return;
  }

  // Phase 4 (Task 6, fix round 1): an `abstract` candidate must additionally carry a HEAD-tracked
  // ledger + duplicate matrix; the cluster is recomputed from the tracked authority (a caller-supplied
  // cluster can no longer authorize), before any write.
  if (candidate.action === 'abstract') {
    const abstractionViolations = await abstractionGuardViolations(candidate, parsed.matrix, parsed.ledger, root);
    if (abstractionViolations.length > 0) {
      for (const violation of abstractionViolations) console.error(`✗ [EVIDENCE_INVALID] ${violation}`);
      const reason = `abstraction requires a validated Phase 4 proof: ${abstractionViolations.join('; ')}`;
      emit(1, blockResult(mode, reason, 'EVIDENCE_INVALID'));
      process.exitCode = 1;
      return;
    }
  }

  const revision = await revisionProvider.current(root);
  if (revision === null) {
    console.log('HUMAN_APPROVAL_REQUIRED: repository revision is unavailable');
    emit(1, blockResult(mode, 'repository revision is unavailable', 'REVISION_MISMATCH'));
    process.exitCode = 1;
    return;
  }

  let plan: ApplyResult;
  try {
    plan = await applyApproved({
      candidate,
      approval: approval as ApprovalDecision,
      mode,
      repositoryRoot: root,
      currentRevision: revision as RevisionIdentity,
    });
  } catch (error) {
    const typed = error instanceof CodeHealthError ? error : null;
    const reason = error instanceof Error ? error.message : String(error);
    if (/HUMAN_APPROVAL_REQUIRED/.test(reason)) console.log(reason);
    else console.error(`✗ [${typed?.code ?? 'EVIDENCE_INVALID'}] ${reason}`);
    emit(1, blockResult(mode, reason, typed?.code ?? 'EVIDENCE_INVALID'));
    process.exitCode = 1;
    return;
  }
  if (plan.kind !== 'patch-proposal') {
    emit(1, blockResult(mode, 'approved application did not resolve to a proposal', 'EVIDENCE_INVALID'));
    process.exitCode = 1;
    return;
  }

  if (mode === 'dry-run') {
    emit(0, {
      mode,
      applied: false,
      patchPath: plan.patchPath,
      appliedFiles: [],
      unrelatedFiles: [],
      rollback: plan.rollback,
    });
    return;
  }

  let patchBytes: Uint8Array;
  try {
    patchBytes = await buildPatchBytes(root, candidate);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const typed = error instanceof CodeHealthError ? error : null;
    console.error(`✗ [${typed?.code ?? 'EVIDENCE_INVALID'}] ${reason}`);
    emit(1, blockResult(mode, reason, typed?.code ?? 'EVIDENCE_INVALID'));
    process.exitCode = 1;
    return;
  }
  const patchPath = codeHealthApplyPatchPath(candidate.candidateId);
  const patchSha256 = await writePatch(root, patchPath, patchBytes);
  const rollback = { ...plan.rollback, patchSha256 };

  if (mode === 'patch') {
    emit(0, { mode, applied: false, patchPath, appliedFiles: [], unrelatedFiles: [], rollback });
    return;
  }

  // commit: real `git apply --check` then `git apply`, then a real scope read-back.
  const before = parseStatus(git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']).stdout);
  const check = git(root, ['apply', '--check', path.isAbsolute(patchPath) ? patchPath : path.join(root, patchPath)]);
  if (check.status !== 0) {
    const reason = `git apply --check failed: ${check.stderr.trim() || check.stdout.trim()}`;
    console.error(`✗ [EVIDENCE_INVALID] ${reason}`);
    emit(1, blockResult(mode, reason, 'EVIDENCE_INVALID'));
    process.exitCode = 1;
    return;
  }
  const applied = git(root, ['apply', path.isAbsolute(patchPath) ? patchPath : path.join(root, patchPath)]);
  if (applied.status !== 0) {
    const reason = `git apply failed: ${applied.stderr.trim() || applied.stdout.trim()}`;
    console.error(`✗ [EVIDENCE_INVALID] ${reason}`);
    emit(1, blockResult(mode, reason, 'EVIDENCE_INVALID'));
    process.exitCode = 1;
    return;
  }
  const after = parseStatus(git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']).stdout);
  const beforeSet = new Set(before);
  const changed = after.filter((entry) => !beforeSet.has(entry));
  const scope = new Set(candidate.changeScope.files);
  const unrelatedFiles = changed.filter((entry) => !scope.has(entry));
  const appliedFiles = changed.filter((entry) => scope.has(entry));
  const exactScope =
    unrelatedFiles.length === 0 &&
    appliedFiles.length === scope.size &&
    candidate.changeScope.files.every((file) => appliedFiles.includes(file));
  if (!exactScope) {
    git(root, ['apply', '-R', path.isAbsolute(patchPath) ? patchPath : path.join(root, patchPath)]);
    const reason = `commit touched scope ${JSON.stringify(appliedFiles)} with unrelated ${JSON.stringify(unrelatedFiles)}`;
    console.error(`✗ [SCOPE_MISMATCH] ${reason}`);
    emit(1, blockResult(mode, reason, 'SCOPE_MISMATCH'));
    process.exitCode = 1;
    return;
  }

  emit(0, { mode, applied: true, patchPath, appliedFiles, unrelatedFiles: [], rollback });
}

const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  runMain(main);
}
