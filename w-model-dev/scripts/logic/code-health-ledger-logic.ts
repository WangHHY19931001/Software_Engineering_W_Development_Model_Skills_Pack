/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- Compatibility guards validate repository-relative paths and use fixed field sets. */
/** Legacy code-health lifecycle compatibility layer over the canonical contract. */

import { createTask1ArchiveBoundary } from '../lib/code-health-archive-boundary.js';
import { TDD_FAILURE_CLASS_KEY, runTddHarness } from '../lib/code-health-tdd-harness.js';

import {
  CodeHealthError,
  isIsoDate,
  isRelativePath,
  ROOT_CAUSE_CHAIN_EVENT_KINDS,
  validateCodeHealthCandidate,
  validateCommandEvidence,
  validateLedgerEvent,
  validateRevision,
} from './code-health-contract.js';
import { findGaps } from './code-health-gap-logic.js';
import { clusterDuplicates, proveTestRemoval as proveTestRemovalBoundary } from './code-health-phase-boundaries.js';
import { buildStaticInventory, checkFalsePositiveGuards, mergeDynamicTrace } from './code-health-phase1-logic.js';
import type {
  ApprovalDecision,
  ApplyApprovedInput,
  ApplyResult,
  CodeHealthCandidate,
  CodeHealthLedger,
  CodeHealthStatus,
  CommandEvidence,
  DeletionEvaluation,
  DeletionFacts,
  EvalDiffInput,
  EvidenceRef,
  EvidenceVerificationContext,
  FileVerificationContext,
  GapRow,
  GateFailureEvidence,
  LedgerEvent,
  LedgerEventKind,
  ProtectedTestClass,
  RevisionIdentity,
  RollbackEvidence,
  RollbackPlan,
  TestRecord,
  TestRemovalProofInput,
} from './code-health-contract.js';

export { CodeHealthError, validateCodeHealthCandidate };
export { clusterDuplicates, findGaps, runTddHarness };

export function proveTestRemoval(input: TestRemovalProofInput): string[] {
  return proveTestRemovalBoundary(input);
}
export type {
  AbstractionProposal,
  ApprovalDecision,
  ArchiveBoundaryResult,
  ArchiveConsumeInput,
  ArchiveManifest,
  ArchiveProduceInput,
  ArchiveTransitionEvidence,
  ArchiveVerifyInput,
  ApplyApprovedInput,
  ApplyResult,
  CandidateSelector,
  CodeHealthAction,
  CodeHealthArchive,
  CodeHealthCandidate,
  CodeHealthCommandRunner,
  CodeHealthEvidence,
  CodeHealthLedger,
  CodeHealthPhase,
  CodeHealthStatus,
  CommandEvidence,
  CoverageRecord,
  DeletionEvaluation,
  DeletionFacts,
  DuplicateCluster,
  DuplicateInput,
  DynamicTraceReport,
  DynamicTraceScenario,
  EnvironmentObservation,
  ErrorCode,
  EvalDiffInput,
  EvidenceBinding,
  EvidenceObservationStatus,
  FalsePositiveContext,
  GapDiscoveryInput,
  GapDiscoveryResult,
  GapRow,
  GateFailureEvidence,
  ImpactRecord,
  LedgerEvent,
  LedgerEventKind,
  Phase1CandidateLead,
  Phase1RunResult,
  ProtectedTestClass,
  RevisionIdentity,
  ReviewDecision,
  RiskProfile,
  RollbackEvidence,
  RollbackPlan,
  SignatureRecord,
  StaticInventoryReport,
  StaticReference,
  TestLevel,
  TestRecord,
  TestRemovalProofInput,
  TddHarnessInput,
  TddHarnessResult,
} from './code-health-contract.js';

const HEX64_PATTERN = /^[0-9a-f]{64}$/;
const CANDIDATE_ID_PATTERN = /^CHG-P[1-4]-[0-9]{8}-[0-9]{3,}$/;
const GATE_FAILURE_KINDS: readonly GateFailureEvidence['failureKind'][] = ['test', 'gate', 'command'];

/**
 * Fixed lifecycle graph. `blocked` may only return to `evidenced` through a complete R→V→G chain with an
 * S rework event (enforced separately), or terminate in `rolled-back` with real rollback evidence.
 */
const NORMAL_TRANSITIONS: Readonly<Record<CodeHealthStatus, readonly CodeHealthStatus[]>> = {
  discovered: ['evidenced', 'blocked'],
  evidenced: ['under-review', 'blocked'],
  'under-review': ['approved', 'rejected', 'deferred', 'blocked'],
  approved: ['implemented', 'blocked'],
  implemented: ['verified', 'blocked'],
  verified: ['archived', 'blocked'],
  archived: [],
  rejected: [],
  deferred: [],
  blocked: ['evidenced', 'rolled-back'],
  'rolled-back': [],
};

/** Authorized recorder role per target state. R never fixes or signs for S; O never records a transition. */
const TRANSITION_ROLES: Readonly<Record<CodeHealthStatus, readonly LedgerEvent['actorRole'][]>> = {
  discovered: ['A', 'O'],
  evidenced: ['A', 'S'],
  'under-review': ['V'],
  approved: ['human'],
  implemented: ['S'],
  verified: ['V', 'G'],
  archived: ['G', 'human'],
  rejected: ['human'],
  deferred: ['human'],
  blocked: ['G', 'V', 'R', 'human'],
  'rolled-back': ['S', 'human'],
};

const CHAIN_ROLE_BY_KIND: Readonly<Record<string, LedgerEvent['actorRole']>> = {
  'root-cause': 'R',
  'root-cause-review': 'V',
  'root-cause-gate': 'G',
};

/** Human decision each human-only target state requires from the matching ApprovalDecision. */
const HUMAN_DECISION_BY_TARGET: Readonly<Partial<Record<CodeHealthStatus, ApprovalDecision['decision']>>> = {
  approved: 'approve',
  rejected: 'reject',
  deferred: 'defer',
};

const APPROVAL_KEYS = [
  'candidateId',
  'decision',
  'approvedAction',
  'approvedFiles',
  'approvedSymbols',
  'scopeHash',
  'rationale',
  'actor',
  'decidedAt',
  'signatureRef',
  'revision',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown, allowEmpty = true): value is string[] {
  return Array.isArray(value) && (allowEmpty || value.length > 0) && value.every((item) => typeof item === 'string');
}

function sameRevision(left: RevisionIdentity, right: RevisionIdentity): boolean {
  return (
    left.commitSha === right.commitSha &&
    left.treeSha === right.treeSha &&
    left.sourceBundleSha256 === right.sourceBundleSha256
  );
}

function sortedEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((item, index) => item === sortedRight[index]);
}

/**
 * Structural rollback check inside the pure reducer: every declared value must match the candidate rollback
 * plan and the event evidence refs. Real file/hash/symlink authenticity is proven by the injected 1B
 * boundary in `transitionCandidateVerified` before this reducer ever runs.
 */
function validateRollbackTransitionEvidence(
  value: unknown,
  field: string,
  candidate: CodeHealthCandidate,
  evidenceRefs: string[],
  reasons: string[],
): value is RollbackEvidence {
  if (!isRecord(value)) {
    reasons.push(`${field} must be an object`);
    return false;
  }
  const commandReasons: string[] = [];
  const commandValid = validateCommandEvidence(value.command, `${field}.command`, commandReasons);
  const command = value.command as CommandEvidence;
  reasons.push(...commandReasons);
  if (!commandValid || command.observation !== 'observed' || command.exitCode !== 0) {
    reasons.push(`${field}.command must be an observed zero-exit rollback result`);
  }
  if (commandValid && command.command !== candidate.rollback.command) {
    reasons.push(`${field}.command does not match candidate rollback command`);
  }
  if (value.preChangeRevision !== candidate.rollback.preChangeRevision) {
    reasons.push(`${field}.preChangeRevision does not match candidate rollback revision`);
  }
  if (value.patchPath !== candidate.rollback.patchPath || !isRelativePath(value.patchPath)) {
    reasons.push(`${field}.patchPath does not match candidate rollback patch`);
  }
  if (
    typeof value.patchSha256 !== 'string' ||
    !HEX64_PATTERN.test(value.patchSha256) ||
    value.patchSha256 !== candidate.rollback.patchSha256
  ) {
    reasons.push(`${field}.patchSha256 does not match candidate rollback metadata`);
  }
  if (value.owner !== candidate.rollback.owner) reasons.push(`${field}.owner does not match candidate rollback owner`);
  if (value.patchExists !== true) reasons.push(`${field}.patchExists must be true`);
  if (value.rawOutputExists !== true) reasons.push(`${field}.rawOutputExists must be true`);
  if (commandValid && !evidenceRefs.includes(command.rawOutputPath)) {
    reasons.push(`${field}.command raw output is not bound to event evidence`);
  }
  const revisionReasons: string[] = [];
  const revisionValid = validateRevision(value.sourceRevision, `${field}.sourceRevision`, revisionReasons);
  reasons.push(...revisionReasons);
  if (!revisionValid || !sameRevision(value.sourceRevision as RevisionIdentity, candidate.revision)) {
    reasons.push(`${field}.sourceRevision is not bound to the current candidate revision`);
  }
  return reasons.length === 0;
}

/** Verify one declared repository file through the injected 1B file-safety boundary. */
async function verifyDeclaredFile(
  verification: FileVerificationContext,
  relativePath: string,
  expectedSha256: string,
  field: string,
): Promise<void> {
  const result = await verification.fileVerifier.verifyRegularNonSymlinkFile({
    root: verification.repositoryRoot,
    relativePath,
    expectedSha256,
  });
  if (!result.ok) {
    throw new CodeHealthError(
      result.code ?? 'EVIDENCE_INVALID',
      `${field} failed file verification: ${result.reason ?? 'unknown reason'}`,
      { safePath: relativePath },
    );
  }
}

/** Resolve one ledger candidate or fail closed with a typed structural error. */
function requireCandidate(ledger: CodeHealthLedger, candidateId: string): CodeHealthCandidate {
  const candidate = ledger.candidates.find((entry) => entry.candidateId === candidateId);
  if (!candidate) {
    throw new CodeHealthError('STRUCTURE_INVALID', `lifecycle candidate not found: ${candidateId}`);
  }
  return candidate;
}

function candidateEvents(ledger: CodeHealthLedger, candidateId: string): LedgerEvent[] {
  return ledger.events.filter((event) => event.candidateId === candidateId);
}

function hasOnlyProperties(
  value: Record<string, unknown>,
  keys: readonly string[],
  field: string,
  reasons: string[],
): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) reasons.push(`${field} has unknown property: ${key}`);
  }
}

function isRootCauseChainKind(kind: unknown): boolean {
  return (ROOT_CAUSE_CHAIN_EVENT_KINDS as readonly string[]).includes(kind as string);
}

export interface ReplayedCandidateState {
  candidateId: string;
  status: CodeHealthStatus;
  eventCount: number;
}

/**
 * Recompute one candidate status from its append-only events: event IDs must be unique across the whole
 * ledger, per-candidate timestamps strictly increase, and the chain must be contiguous. The materialized
 * candidate status must equal the replay result, otherwise the ledger is rejected as inconsistent.
 */
export function replayCandidate(ledger: CodeHealthLedger, candidateId: string): ReplayedCandidateState {
  const candidate = requireCandidate(ledger, candidateId);
  const seenEventIds = new Set<string>();
  for (const event of ledger.events) {
    if (seenEventIds.has(event.eventId)) {
      throw new CodeHealthError('STRUCTURE_INVALID', `duplicate ledger eventId: ${event.eventId}`);
    }
    seenEventIds.add(event.eventId);
  }
  const events = candidateEvents(ledger, candidateId);
  if (events.length === 0) return { candidateId, status: candidate.status, eventCount: 0 };
  const first = events[0]!;
  if (first.from === null && first.to !== 'discovered') {
    throw new CodeHealthError('STRUCTURE_INVALID', 'an initial creation event must target discovered');
  }
  let status: CodeHealthStatus = first.from ?? 'discovered';
  let runningRevision: RevisionIdentity;
  if (first.eventKind === 'implementation') {
    if (!first.previousRevision) {
      throw new CodeHealthError('STRUCTURE_INVALID', 'implementation events require previousRevision');
    }
    runningRevision = first.previousRevision;
  } else {
    runningRevision = first.revision;
  }
  events.forEach((event, index) => {
    if (index > 0) {
      const previous = events[index - 1]!;
      if (Date.parse(event.at) <= Date.parse(previous.at)) {
        throw new CodeHealthError('STRUCTURE_INVALID', 'candidate event timestamps must increase strictly');
      }
      if (event.from !== previous.to) {
        throw new CodeHealthError('STRUCTURE_INVALID', 'candidate event history is not a contiguous chain');
      }
    }
    if (event.from !== null && event.from !== status) {
      throw new CodeHealthError('STRUCTURE_INVALID', 'candidate event history does not start from its recorded state');
    }
    if (event.eventKind === 'implementation') {
      if (!event.previousRevision || !sameRevision(event.previousRevision, runningRevision)) {
        throw new CodeHealthError(
          'STRUCTURE_INVALID',
          'candidate revision history does not chain through the implementation event',
        );
      }
      runningRevision = event.revision;
    } else if (!sameRevision(event.revision, runningRevision)) {
      throw new CodeHealthError('STRUCTURE_INVALID', 'candidate event revision does not match the running revision');
    }
    status = event.to;
  });
  if (status !== candidate.status) {
    throw new CodeHealthError(
      'STRUCTURE_INVALID',
      `embedded candidate status ${candidate.status} does not match the replayed history ${status}`,
    );
  }
  if (!sameRevision(runningRevision, candidate.revision)) {
    throw new CodeHealthError(
      'STRUCTURE_INVALID',
      'embedded candidate revision does not match the replayed revision history',
    );
  }
  return { candidateId, status, eventCount: events.length };
}

function nextEventId(ledger: CodeHealthLedger, prefix: string): string {
  let index = ledger.events.length + 1;
  while (ledger.events.some((event) => event.eventId === `${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

/** Validate one gate failure against the addressed candidate and the canonical command contract. */
function requireGateFailureEvidence(value: unknown, candidate: CodeHealthCandidate): GateFailureEvidence {
  if (!isRecord(value)) {
    throw new CodeHealthError('EVIDENCE_INVALID', 'gate failure evidence must be an object');
  }
  const commandEvidence = { ...value };
  delete commandEvidence.candidateId;
  delete commandEvidence.scopeHash;
  delete commandEvidence.failureKind;
  const commandReasons: string[] = [];
  validateCommandEvidence(commandEvidence, 'gateFailureEvidence', commandReasons);
  if (commandReasons.length > 0) {
    throw new CodeHealthError('EVIDENCE_INVALID', `gate failure evidence is malformed: ${commandReasons.join('; ')}`);
  }
  if (typeof value.candidateId !== 'string' || !CANDIDATE_ID_PATTERN.test(value.candidateId)) {
    throw new CodeHealthError('EVIDENCE_INVALID', 'gate failure evidence requires the bound candidate identity');
  }
  if (value.candidateId !== candidate.candidateId) {
    throw new CodeHealthError('EVIDENCE_INVALID', 'gate failure candidate identity does not match the candidate');
  }
  if (typeof value.scopeHash !== 'string' || value.scopeHash !== candidate.changeScope.scopeHash) {
    throw new CodeHealthError('SCOPE_MISMATCH', 'gate failure scope does not match the candidate scope');
  }
  if (!GATE_FAILURE_KINDS.includes(value.failureKind as GateFailureEvidence['failureKind'])) {
    throw new CodeHealthError('EVIDENCE_INVALID', 'gate failure kind must be test, gate, or command');
  }
  if (
    value.observation !== 'observed' ||
    typeof value.exitCode !== 'number' ||
    !Number.isInteger(value.exitCode) ||
    value.exitCode === 0
  ) {
    throw new CodeHealthError(
      'EVIDENCE_INVALID',
      'gate failure must be an observed command failure with a real non-zero exit code',
    );
  }
  return value as unknown as GateFailureEvidence;
}

interface AppendEventOptions {
  /** Root-cause chain events keep the candidate blocked and are exempt from the normal transition graph. */
  rootCauseChain?: boolean;
}

/**
 * Pure reducer core: validate one event, then return a new ledger with the event appended and only the
 * addressed candidate updated. Every check is fail-closed and the previous ledger is never mutated.
 */
function appendEvent(
  ledger: CodeHealthLedger,
  candidateId: string,
  event: LedgerEvent,
  approval?: ApprovalDecision,
  options: AppendEventOptions = {},
): CodeHealthLedger {
  const eventReasons = validateLedgerEvent(event);
  if (eventReasons.length > 0) {
    throw new CodeHealthError('STRUCTURE_INVALID', `transition event is malformed: ${eventReasons.join('; ')}`);
  }
  const current = requireCandidate(ledger, candidateId);
  const candidateReasons = validateCodeHealthCandidate(current);
  if (candidateReasons.length > 0) {
    throw new CodeHealthError('STRUCTURE_INVALID', `transition candidate is invalid: ${candidateReasons.join('; ')}`);
  }
  if (event.candidateId !== candidateId) {
    throw new CodeHealthError(
      'STRUCTURE_INVALID',
      `event candidateId ${event.candidateId} does not match the addressed candidate ${candidateId}`,
    );
  }
  if (ledger.events.some((existing) => existing.eventId === event.eventId)) {
    throw new CodeHealthError('STRUCTURE_INVALID', `transition eventId already exists: ${event.eventId}`);
  }
  if (event.scopeHash !== current.changeScope.scopeHash) {
    throw new CodeHealthError('SCOPE_MISMATCH', 'event scopeHash does not match the candidate scope');
  }
  if (event.eventKind === 'implementation') {
    if (!event.previousRevision || !sameRevision(event.previousRevision, current.revision)) {
      throw new CodeHealthError(
        'REVISION_MISMATCH',
        'implementation previousRevision does not match the candidate revision',
      );
    }
    if (sameRevision(event.revision, event.previousRevision)) {
      throw new CodeHealthError('REVISION_MISMATCH', 'implementation must advance the candidate to a new revision');
    }
  } else if (!sameRevision(event.revision, current.revision)) {
    throw new CodeHealthError('REVISION_MISMATCH', 'event revision is stale for the candidate revision');
  }
  replayCandidate(ledger, candidateId);
  const chain = options.rootCauseChain === true;
  if (chain) {
    if (event.from !== current.status || event.to !== current.status) {
      throw new CodeHealthError('TRANSITION_INVALID', 'root-cause chain events keep the candidate blocked');
    }
  } else {
    if (event.from === null) {
      if (
        event.to !== 'discovered' ||
        current.status !== 'discovered' ||
        candidateEvents(ledger, candidateId).length > 0
      ) {
        throw new CodeHealthError(
          'TRANSITION_INVALID',
          'an initial discovery event is only valid for a discovered candidate without history',
        );
      }
    } else if (event.from !== current.status) {
      throw new CodeHealthError(
        'TRANSITION_INVALID',
        `transition from ${String(event.from)} does not match ${current.status}`,
      );
    }
    if (event.from !== null && !NORMAL_TRANSITIONS[current.status].includes(event.to)) {
      throw new CodeHealthError('TRANSITION_INVALID', `transition ${current.status} -> ${event.to} is not allowed`);
    }
    if (event.eventKind === 'rework') {
      requireCompleteReworkChain(ledger, candidateId);
    } else if (current.status === 'blocked' && event.to === 'evidenced') {
      throw new CodeHealthError(
        'TRANSITION_INVALID',
        'blocked candidates may only return to evidenced through a rework event after the complete R→V→G chain',
      );
    }
  }
  const previousEvent = candidateEvents(ledger, candidateId).at(-1);
  if (previousEvent && Date.parse(event.at) <= Date.parse(previousEvent.at)) {
    throw new CodeHealthError('STRUCTURE_INVALID', 'transition timestamp must be strictly monotonic per candidate');
  }
  const authorizedRoles = TRANSITION_ROLES[event.to];
  if (!authorizedRoles.includes(event.actorRole)) {
    throw new CodeHealthError(
      'ROLE_FORBIDDEN',
      `transition to ${event.to} requires an authorized role (${authorizedRoles.join(', ')}); actor ${event.actorRole} cannot record it`,
    );
  }
  const humanDecision = HUMAN_DECISION_BY_TARGET[event.to];
  if (humanDecision) {
    if (!approval || approval.decision !== humanDecision) {
      throw new CodeHealthError(
        'EVIDENCE_INVALID',
        `transition to ${event.to} requires a matching human ${humanDecision} ApprovalDecision`,
      );
    }
    const approvalReasons = validateApprovalScope(current, approval);
    if (approvalReasons.length > 0) {
      throw new CodeHealthError('EVIDENCE_INVALID', `transition approval is invalid: ${approvalReasons.join('; ')}`);
    }
  } else if (approval !== undefined) {
    throw new CodeHealthError(
      'EVIDENCE_INVALID',
      'an ApprovalDecision is only valid for a human approval, rejection, or deferral transition',
    );
  }
  if (event.to === 'blocked' && !chain) {
    if (event.eventKind !== 'gate-failure') {
      throw new CodeHealthError('TRANSITION_INVALID', 'only a structured gate-failure event may block a candidate');
    }
    const gateFailure = requireGateFailureEvidence(event.gateFailureEvidence, current);
    if (!event.evidenceRefs.includes(gateFailure.rawOutputPath)) {
      throw new CodeHealthError('EVIDENCE_INVALID', 'gate failure raw output must be bound to the event evidence refs');
    }
  }
  if (event.to === 'rolled-back') {
    const rollbackReasons: string[] = [];
    if (
      !validateRollbackTransitionEvidence(
        event.rollbackEvidence,
        'transition rollback',
        current,
        event.evidenceRefs,
        rollbackReasons,
      )
    ) {
      throw new CodeHealthError(
        'EVIDENCE_INVALID',
        rollbackReasons.join('; ') || 'rollback transition evidence is incomplete',
      );
    }
  }
  if (event.to === 'archived') {
    if (event.eventKind !== 'archive') {
      throw new CodeHealthError('TRANSITION_INVALID', 'only an archive event may archive a candidate');
    }
    if (!event.archiveEvidence) {
      throw new CodeHealthError(
        'STRUCTURE_INVALID',
        'archive transition requires complete source-bound archive evidence',
      );
    }
    throw new CodeHealthError(
      'NOT_IMPLEMENTED',
      'archive transition is not implemented in Task 1; the real archive producer belongs to Task 8',
    );
  }
  const candidates = ledger.candidates.map((candidate) => {
    if (candidate.candidateId !== candidateId) return candidate;
    if (event.eventKind !== 'implementation') return { ...candidate, status: event.to };
    // Implementation is the only event kind allowed to advance the revision; it advances the candidate
    // revision and the evidence binding that must stay bound to it in the same atomic update.
    return {
      ...candidate,
      status: event.to,
      revision: event.revision,
      evidenceBinding: { ...candidate.evidenceBinding, revision: event.revision },
    };
  });
  return { ...ledger, candidates, events: [...ledger.events, event] };
}

function requireCompleteReworkChain(ledger: CodeHealthLedger, candidateId: string): void {
  const required = nextRequiredRoles(ledger, candidateId);
  if (required.length !== 1 || required[0] !== 'S') {
    throw new CodeHealthError(
      'TRANSITION_INVALID',
      `rework requires the complete root-cause (R), review (V), and gate (G) chain; still required: ${required.join(', ')}`,
    );
  }
}

/** Pure append-only lifecycle reducer: consumes only events whose evidence was authenticated upstream. */
export function transitionCandidate(
  ledger: CodeHealthLedger,
  candidateId: string,
  event: LedgerEvent,
  approval?: ApprovalDecision,
): CodeHealthLedger {
  return appendEvent(ledger, candidateId, event, approval);
}

/**
 * 1B-authenticated rollback entry point: the declared rollback patch and raw output are proven to exist as
 * regular non-symlink files with matching hashes through the injected FileVerifier before the pure reducer
 * appends the rolled-back event. No repository check is repeated inside the reducer.
 */
export async function transitionCandidateVerified(
  ledger: CodeHealthLedger,
  candidateId: string,
  event: LedgerEvent,
  approval: ApprovalDecision | undefined,
  verification: FileVerificationContext,
): Promise<CodeHealthLedger> {
  if (event.to === 'rolled-back' && event.rollbackEvidence) {
    await verifyDeclaredFile(
      verification,
      event.rollbackEvidence.patchPath,
      event.rollbackEvidence.patchSha256,
      'rollback patch',
    );
    await verifyDeclaredFile(
      verification,
      event.rollbackEvidence.command.rawOutputPath,
      event.rollbackEvidence.command.rawOutputSha256,
      'rollback raw output',
    );
  }
  return appendEvent(ledger, candidateId, event, approval);
}

interface ApprovalScopeCheck {
  scope: string[];
  evidence: string[];
  revision: string[];
}

/** Human actor identity: agent, bot, automation, system, or single-letter role identities never qualify. */
function isHumanApprovalActor(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const normalized = value.toLowerCase();
  if (/(?:^|[-_\s])(?:agent|bot|automation|system|orchestrator|robot)(?:$|[-_\s])/.test(normalized)) return false;
  if (/(?:^|[-_\s])[oasvgr](?:$|[-_\s])/.test(normalized)) return false;
  return true;
}

/**
 * Precise approval comparison: identity, action, files, symbols, scope hash, revision, human actor,
 * decision, timestamp, and signature ref must all match the candidate exactly.
 */
function checkApprovalScope(candidate: CodeHealthCandidate, approval: unknown): ApprovalScopeCheck {
  const result: ApprovalScopeCheck = { scope: [], evidence: [], revision: [] };
  if (!isRecord(approval)) {
    result.evidence.push('approval must be an object');
    return result;
  }
  hasOnlyProperties(approval, APPROVAL_KEYS, 'approval', result.evidence);
  if (approval.candidateId !== candidate.candidateId)
    result.scope.push('approval candidateId does not match candidate');
  if (approval.approvedAction !== candidate.action) result.scope.push('approval action does not match candidate');
  const approvedFiles = Array.isArray(approval.approvedFiles) ? (approval.approvedFiles as string[]) : null;
  if (!approvedFiles || !sortedEqual(approvedFiles, candidate.changeScope.files)) {
    result.scope.push('approval files expand or shrink candidate scope');
  }
  const approvedSymbols = Array.isArray(approval.approvedSymbols) ? (approval.approvedSymbols as string[]) : null;
  if (!approvedSymbols || !sortedEqual(approvedSymbols, candidate.changeScope.symbols)) {
    result.scope.push('approval symbols expand or shrink candidate scope');
  }
  if (approval.scopeHash !== candidate.changeScope.scopeHash) {
    result.scope.push('approval scopeHash does not match candidate');
  }
  if (
    !isRecord(approval.revision) ||
    !sameRevision(approval.revision as unknown as RevisionIdentity, candidate.revision)
  ) {
    result.revision.push('approval revision is stale for the candidate revision');
  }
  if (!['approve', 'reject', 'defer'].includes(approval.decision as string)) {
    result.evidence.push('approval decision is invalid');
  }
  if (
    approval.decision === 'approve' &&
    !['under-review', 'approved', 'implemented', 'verified'].includes(candidate.status)
  ) {
    result.evidence.push('candidate must be under-review or in an approved lifecycle state before approval');
  }
  if (typeof approval.rationale !== 'string' || approval.rationale.length < 20) {
    result.evidence.push('approval rationale must be specific and at least 20 characters');
  }
  if (!isHumanApprovalActor(approval.actor)) {
    result.evidence.push(
      'approval actor must identify a human decision maker; role or agent identities cannot approve',
    );
  }
  if (!isIsoDate(approval.decidedAt)) result.evidence.push('approval decidedAt is invalid');
  if (!isRelativePath(approval.signatureRef)) result.evidence.push('approval signatureRef is required');
  return result;
}

/** Full approval scope comparison, flattened for callers that only need blocking reasons. */
export function validateApprovalScope(candidate: CodeHealthCandidate, approval: ApprovalDecision): string[] {
  const check = checkApprovalScope(candidate, approval);
  return [...check.scope, ...check.evidence, ...check.revision];
}

export function canArchiveCandidate(
  candidate: CodeHealthCandidate,
  ledger: CodeHealthLedger,
  approval?: ApprovalDecision,
): string[] {
  const reasons = validateCodeHealthCandidate(candidate);
  const ledgerCandidate = ledger.candidates.find((entry) => entry.candidateId === candidate.candidateId);
  if (!ledgerCandidate) reasons.push('candidate is not present in ledger');
  if (ledgerCandidate) {
    if (ledgerCandidate.status !== candidate.status) reasons.push('candidate and ledger status are inconsistent');
    if (ledgerCandidate.action !== candidate.action) reasons.push('candidate and ledger action are inconsistent');
    if (!sortedEqual(ledgerCandidate.changeScope.files, candidate.changeScope.files)) {
      reasons.push('candidate and ledger files are inconsistent');
    }
    if (!sortedEqual(ledgerCandidate.changeScope.symbols, candidate.changeScope.symbols)) {
      reasons.push('candidate and ledger symbols are inconsistent');
    }
    if (ledgerCandidate.changeScope.scopeHash !== candidate.changeScope.scopeHash) {
      reasons.push('candidate and ledger scopeHash are inconsistent');
    }
  }
  if (!sameRevision(candidate.revision, ledger.baseline)) reasons.push('candidate revision is stale');
  if (candidate.status !== 'verified') reasons.push('candidate is not verified');
  if (candidate.archive.redactionStatus !== 'clean' || ledger.redaction.status !== 'clean') {
    reasons.push('archive redaction is not clean');
  }
  if (!candidate.rollback.executable || !isRelativePath(candidate.rollback.patchPath)) {
    reasons.push('rollback is not executable or path is unsafe');
  }
  if (!candidate.rollback.command || /[;&|<>\r\n]/.test(candidate.rollback.command)) {
    reasons.push('rollback command is unsafe');
  }
  if (candidate.review.decision !== 'approve' || candidate.review.humanDecision !== 'approve') {
    reasons.push('human approval is missing');
  }
  if (!approval) reasons.push('ApprovalDecision is missing');
  else reasons.push(...validateApprovalScope(candidate, approval));
  for (const command of candidate.commands) {
    if (command.observation !== 'observed' || command.exitCode !== 0) {
      reasons.push('required command evidence did not pass');
    }
    if (!isRelativePath(command.rawOutputPath)) reasons.push('command raw output path is unsafe');
  }
  const roles = new Set(candidate.signatures.map((signature) => signature.role));
  for (const role of ['V', 'G', 'human'] as const) {
    if (!roles.has(role)) reasons.push(`signature is missing: ${role}`);
  }
  if (
    approval &&
    !candidate.signatures.some(
      (signature) =>
        signature.role === 'human' && signature.event === 'approve' && signature.scopeHash === approval.scopeHash,
    )
  ) {
    reasons.push('human approval signature is not bound to approval scope');
  }
  if (ledger.environmentMatrix.some((environment) => environment.supported && environment.observed !== 'observed')) {
    reasons.push('required environment is not observed');
  }
  if (ledger.events.some((event) => event.candidateId === candidate.candidateId && event.to === 'blocked')) {
    reasons.push('candidate has a blocking event');
  }
  return [...new Set(reasons)];
}

export function recordGateFailure(
  ledger: CodeHealthLedger,
  candidateId: string,
  evidence: GateFailureEvidence,
): CodeHealthLedger;
export function recordGateFailure(ledger: CodeHealthLedger, evidence: CommandEvidence): never;
/**
 * Pure append-only gate-failure reducer. It consumes only evidence whose candidate/scope binding was
 * already authenticated by the 1B EvidenceStore boundary (`recordVerifiedGateFailure`); it never reads the
 * filesystem itself. Any refused call leaves the previous ledger, candidate status, and events untouched.
 */
export function recordGateFailure(
  ledger: CodeHealthLedger,
  candidateIdOrEvidence: string | CommandEvidence,
  evidence?: GateFailureEvidence,
): CodeHealthLedger {
  if (typeof candidateIdOrEvidence !== 'string' || evidence === undefined) {
    throw new CodeHealthError(
      'EVIDENCE_INVALID',
      'gate failure requires an explicit candidate identity and already-verified candidate-scoped evidence',
    );
  }
  const candidateId = candidateIdOrEvidence;
  const candidate = requireCandidate(ledger, candidateId);
  const gateFailure = requireGateFailureEvidence(evidence, candidate);
  const event: LedgerEvent = {
    eventId: nextEventId(ledger, `EV-GATE-FAIL-${candidateId}`),
    eventKind: 'gate-failure',
    candidateId,
    from: candidate.status,
    to: 'blocked',
    actorRole: 'G',
    at: gateFailure.endedAt,
    revision: candidate.revision,
    scopeHash: candidate.changeScope.scopeHash,
    evidenceRefs: [gateFailure.rawOutputPath],
    signatureRef: 'evidence/signature-gate-failure.json',
    gateFailureEvidence: gateFailure,
  };
  return appendEvent(ledger, candidateId, event);
}

/**
 * 1B-authenticated gate-failure entry point: the raw output is verified through the injected EvidenceStore
 * against the candidate/scope/revision binding before the pure reducer appends the blocked event.
 */
export async function recordVerifiedGateFailure(
  ledger: CodeHealthLedger,
  candidateId: string,
  evidence: CommandEvidence,
  verification: EvidenceVerificationContext,
): Promise<CodeHealthLedger> {
  const candidate = requireCandidate(ledger, candidateId);
  if (!isRelativePath(evidence?.rawOutputPath) || typeof evidence.rawOutputSha256 !== 'string') {
    throw new CodeHealthError(
      'EVIDENCE_INVALID',
      'verified gate failure requires a repository-relative raw output path and hash',
    );
  }
  const ref: EvidenceRef = {
    evidenceId: `EVD-GATE-FAIL-${candidateId}-${ledger.events.length + 1}`,
    candidateId,
    scopeHash: candidate.changeScope.scopeHash,
    relativePath: evidence.rawOutputPath,
    sha256: evidence.rawOutputSha256,
    revision: candidate.revision,
    observation: evidence.observation,
  };
  const verificationResult = await verification.evidenceStore.verify(ref, verification.binding);
  if (verificationResult?.ok !== true) {
    throw new CodeHealthError(
      verificationResult?.code ?? 'EVIDENCE_INVALID',
      'gate failure evidence failed store verification',
      { safePath: evidence.rawOutputPath, candidateId, scopeHash: candidate.changeScope.scopeHash },
    );
  }
  const gateFailure: GateFailureEvidence = {
    ...evidence,
    candidateId,
    scopeHash: candidate.changeScope.scopeHash,
    failureKind: 'gate',
  };
  return recordGateFailure(ledger, candidateId, gateFailure);
}

/**
 * Roles still required, in fixed order, before a blocked candidate may be reworked: R root cause, V review,
 * G gate, then S rework. A candidate that is not blocked requires no failure-chain roles.
 */
export function nextRequiredRoles(ledger: CodeHealthLedger, candidateId: string): Array<'R' | 'V' | 'G' | 'S'> {
  const candidate = requireCandidate(ledger, candidateId);
  if (candidate.status !== 'blocked') return [];
  const events = candidateEvents(ledger, candidateId);
  let blockedIndex = -1;
  for (const [index, event] of events.entries()) {
    if (event.to === 'blocked' && !isRootCauseChainKind(event.eventKind)) blockedIndex = index;
  }
  if (blockedIndex < 0) return [];
  const chain = events.slice(blockedIndex + 1);
  const signed = (kind: LedgerEventKind, role: LedgerEvent['actorRole']): boolean =>
    chain.some((event) => event.eventKind === kind && event.actorRole === role);
  if (!signed('root-cause', 'R')) return ['R', 'V', 'G', 'S'];
  if (!signed('root-cause-review', 'V')) return ['V', 'G', 'S'];
  if (!signed('root-cause-gate', 'G')) return ['G', 'S'];
  return ['S'];
}

/**
 * Append one RootCauseReport chain event (R report, V review, G gate) while the candidate is blocked. The
 * order is fixed and cannot be skipped: each call must supply the next required role.
 */
export function appendRootCauseEvent(
  ledger: CodeHealthLedger,
  candidateId: string,
  event: LedgerEvent,
): CodeHealthLedger {
  const candidate = requireCandidate(ledger, candidateId);
  if (candidate.status !== 'blocked') {
    throw new CodeHealthError(
      'TRANSITION_INVALID',
      'root-cause chain events are only valid while the candidate is blocked',
    );
  }
  if (!isRootCauseChainKind(event?.eventKind)) {
    throw new CodeHealthError('STRUCTURE_INVALID', 'appendRootCauseEvent only accepts root-cause chain events');
  }
  const expectedRole = CHAIN_ROLE_BY_KIND[event.eventKind as string];
  if (event.actorRole !== expectedRole) {
    throw new CodeHealthError(
      'ROLE_FORBIDDEN',
      `root-cause event ${event.eventKind} requires the ${String(expectedRole)} role`,
    );
  }
  const required = nextRequiredRoles(ledger, candidateId);
  if (required[0] !== expectedRole) {
    throw new CodeHealthError(
      'TRANSITION_INVALID',
      `root-cause chain is out of order: the next required role is ${required[0] ?? 'none'}`,
    );
  }
  if (event.from !== 'blocked' || event.to !== 'blocked') {
    throw new CodeHealthError('TRANSITION_INVALID', 'root-cause chain events must keep the candidate blocked');
  }
  return appendEvent(ledger, candidateId, event, undefined, { rootCauseChain: true });
}

/** Append the S rework event that returns a blocked candidate to evidenced after the complete R→V→G chain. */
export function appendReworkEvent(ledger: CodeHealthLedger, candidateId: string, event: LedgerEvent): CodeHealthLedger {
  const candidate = requireCandidate(ledger, candidateId);
  if (event?.eventKind !== 'rework') {
    throw new CodeHealthError('STRUCTURE_INVALID', 'appendReworkEvent only accepts rework events');
  }
  if (candidate.status !== 'blocked') {
    throw new CodeHealthError('TRANSITION_INVALID', 'rework requires a blocked candidate');
  }
  if (event.actorRole !== 'S') {
    throw new CodeHealthError('ROLE_FORBIDDEN', 'rework requires the S role');
  }
  if (event.to !== 'evidenced') {
    throw new CodeHealthError('TRANSITION_INVALID', 'rework must return the candidate to evidenced');
  }
  requireCompleteReworkChain(ledger, candidateId);
  return appendEvent(ledger, candidateId, event);
}

export function validateEvalDiff(input: EvalDiffInput): string[] {
  if (input.changedBehavior) return [];
  if (!Array.isArray(input.prompts)) return ['prompts must be an array'];
  if (!isRecord(input.mappings) && !Array.isArray(input.mappings)) return ['mappings must be an object or array'];
  return [];
}

const GAP_KINDS = ['requirement', 'public-contract', 'branch', 'error', 'security', 'concurrency', 'platform'] as const;
const GAP_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const GAP_STATUSES = ['discovered', 'approved', 'implemented', 'verified', 'blocked'] as const;
const GAP_TEST_LEVELS = ['unit', 'integration', 'system', 'acceptance'] as const;
const GAP_ID_PATTERN = /^GAP-[A-Za-z0-9][A-Za-z0-9._-]*$/;
const GAP_CANDIDATE_ID_PATTERN = /^CHG-P[1-4]-[0-9]{8}-[0-9]{3,}$/;
const GAP_ROW_KEYS = [
  'gapId',
  'candidateId',
  'kind',
  'testLevels',
  'existingTestIds',
  'missingScenario',
  'evidenceSources',
  'risk',
  'priority',
  'owner',
  'rtmIds',
  'coverageSignal',
  'coverageIsSignalOnly',
  'status',
  'redEvidence',
  'greenEvidence',
  'assertionHash',
  'implementationHash',
] as const;
const GAP_REQUIRED_KEYS = [
  'gapId',
  'candidateId',
  'kind',
  'testLevels',
  'existingTestIds',
  'missingScenario',
  'evidenceSources',
  'risk',
  'priority',
  'owner',
  'rtmIds',
  'coverageSignal',
  'coverageIsSignalOnly',
  'status',
] as const;
const RISK_KEYS = [
  'severity',
  'behavior',
  'security',
  'concurrency',
  'platform',
  'lifecycle',
  'governance',
  'rationale',
] as const;
const RISK_ENUMS: Readonly<Record<string, readonly string[]>> = {
  severity: ['low', 'medium', 'high', 'critical'],
  behavior: ['none', 'low', 'medium', 'high', 'unknown'],
  security: ['none', 'low', 'medium', 'high', 'unknown'],
  concurrency: ['none', 'low', 'medium', 'high', 'unknown'],
  platform: ['none', 'low', 'medium', 'high', 'unknown'],
  lifecycle: ['none', 'low', 'medium', 'high', 'unknown'],
  governance: ['none', 'low', 'medium', 'high', 'unknown'],
};
const COVERAGE_KEYS = ['statements', 'branches', 'functions', 'lines'] as const;

/** Highest gap status a candidate lifecycle state may carry; a gap can never run ahead of its candidate. */
function gapStatusAllowedForCandidate(status: CodeHealthStatus): readonly GapRow['status'][] {
  if (status === 'implemented') {
    // Implemented code does not prove the gap was verified: only `verified`/`archived` candidates may carry it.
    return ['discovered', 'approved', 'implemented', 'blocked'];
  }
  if (status === 'verified' || status === 'archived') {
    return ['discovered', 'approved', 'implemented', 'verified', 'blocked'];
  }
  if (status === 'under-review' || status === 'approved' || status === 'deferred') {
    return ['discovered', 'approved', 'blocked'];
  }
  return ['discovered', 'blocked'];
}

/**
 * A gap may bind to a candidate whose revision is the ledger baseline or a revision traceable through a
 * contiguous implementation chain that starts at the baseline; an implementation advance must never
 * invalidate every gap of that candidate.
 */
function isCandidateRevisionBoundToLedger(ledger: CodeHealthLedger, candidate: CodeHealthCandidate): boolean {
  if (sameRevision(candidate.revision, ledger.baseline)) return true;
  const events = candidateEvents(ledger, candidate.candidateId);
  const first = events[0];
  if (!first) return false;
  let running: RevisionIdentity;
  if (first.eventKind === 'implementation') {
    if (!first.previousRevision) return false;
    running = first.previousRevision;
  } else {
    running = first.revision;
  }
  if (!sameRevision(running, ledger.baseline)) return false;
  for (const event of events) {
    if (event.eventKind === 'implementation') {
      if (!event.previousRevision || !sameRevision(event.previousRevision, running)) return false;
      running = event.revision;
    } else if (!sameRevision(event.revision, running)) {
      return false;
    }
  }
  return sameRevision(running, candidate.revision);
}

function validateGapCoverage(value: unknown, field: string, reasons: string[]): void {
  if (!isRecord(value)) {
    reasons.push(`${field} is required`);
    return;
  }
  hasOnlyProperties(value, COVERAGE_KEYS, field, reasons);
  for (const metric of COVERAGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, metric)) {
      reasons.push(`${field}.${metric} is required`);
      continue;
    }
    const metricValue = value[metric];
    if (
      metricValue !== null &&
      (typeof metricValue !== 'number' || !Number.isFinite(metricValue) || metricValue < 0 || metricValue > 1)
    ) {
      reasons.push(`${field}.${metric} must be null or a number between 0 and 1`);
    }
  }
}

function validateGapRisk(value: unknown, field: string, reasons: string[]): void {
  if (!isRecord(value)) {
    reasons.push(`${field} is required`);
    return;
  }
  hasOnlyProperties(value, RISK_KEYS, field, reasons);
  for (const [key, allowed] of Object.entries(RISK_ENUMS)) {
    if (typeof value[key] !== 'string' || !allowed.includes(value[key] as string)) {
      reasons.push(`${field}.${key} is invalid`);
    }
  }
  if (typeof value.rationale !== 'string' || value.rationale.trim() === '') {
    reasons.push(`${field}.rationale is required`);
  }
}

/**
 * Unbounded placeholder tokens (English and Chinese) that must never count as a specific, auditable
 * `missingScenario`/`owner`; matching is full-string so bounded text that merely mentions a token still passes.
 */
const GAP_TEXT_PLACEHOLDER_PATTERN =
  /^(?:unknown|tbd|todo|n\/a|none|not[ -]?provided|pending|later|待补|待补充|以后处理|待定|后续处理|待办|稍后|暂缓|未知|未提供|暂无|无)$/i;

/**
 * Wrapper characters and sentence punctuation that may enclose or terminate a placeholder without making it
 * specific: paired brackets/quotes (ASCII, full-width, CJK) and terminal punctuation. Only the edges of the
 * trimmed value are stripped so interior content, including interior placeholder tokens, is never rewritten.
 */
const GAP_TEXT_EDGE_CHARACTERS: ReadonlySet<string> = new Set([
  '（',
  '）',
  '(',
  ')',
  '[',
  ']',
  '［',
  '］',
  '【',
  '】',
  '<',
  '>',
  '《',
  '》',
  '"',
  "'",
  '\u201c',
  '\u201d',
  '\u2018',
  '\u2019',
  '「',
  '」',
  '『',
  '』',
  '。',
  '．',
  '.',
  '、',
  ',',
  '，',
  ';',
  '；',
  ':',
  '：',
  '!',
  '！',
  '?',
  '？',
  '~',
  '～',
]);

/** Normalize gap text by trimming and stripping leading/trailing wrapper/punctuation characters only. */
function normalizeGapText(value: string): string {
  const isEdgeCharacter = (character: string): boolean =>
    GAP_TEXT_EDGE_CHARACTERS.has(character) || /\s/.test(character);
  let start = 0;
  let end = value.length;
  while (start < end && isEdgeCharacter(value[start]!)) start += 1;
  while (end > start && isEdgeCharacter(value[end - 1]!)) end -= 1;
  return value.slice(start, end);
}

function isBoundedGapText(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const normalized = normalizeGapText(value);
  return normalized !== '' && !GAP_TEXT_PLACEHOLDER_PATTERN.test(normalized);
}

function validateGapEvidenceCommand(value: unknown, field: string, expected: 'red' | 'green', reasons: string[]): void {
  if (!isRecord(value)) {
    reasons.push(`${field} must be an object`);
    return;
  }
  // Harness binding/declaration fields travel with the command evidence (R-G/R-E); strip them before the
  // canonical CommandEvidence validator, which only allows its frozen key set.
  const commandRecord: Record<string, unknown> = { ...value };
  for (const bindingKey of [
    'gapId',
    'assertionHash',
    'implementationHash',
    'testArtifacts',
    'implementationArtifact',
  ]) {
    delete commandRecord[bindingKey];
  }
  const commandReasons: string[] = [];
  validateCommandEvidence(commandRecord, field, commandReasons);
  if (commandReasons.length > 0) {
    reasons.push(...commandReasons);
    return;
  }
  const command = value as unknown as CommandEvidence;
  const failureClass = command.toolVersions?.[TDD_FAILURE_CLASS_KEY];
  if (expected === 'red') {
    if (command.observation !== 'observed' || command.exitCode === null || command.exitCode === 0) {
      reasons.push(`${field} must be an observed non-zero RED result`);
    }
    // A gap-bound RED must prove it failed on the assertion, not on unrelated infrastructure. The
    // classification is mandatory: absent evidence fails closed and can never be counted as RED.
    if (failureClass !== 'assertion') {
      reasons.push(
        `${field} must carry the real assertion-failure classification (${TDD_FAILURE_CLASS_KEY}=assertion); got ${String(failureClass)}`,
      );
    }
  } else {
    if (command.observation !== 'observed' || command.exitCode !== 0) {
      reasons.push(`${field} must be an observed zero-exit GREEN result`);
    }
    if (failureClass !== undefined && failureClass !== 'none') {
      reasons.push(`${field} must not carry a non-GREEN failure classification; got ${String(failureClass)}`);
    }
  }
}

/**
 * Strict GapRow validation against the owning ledger: frozen enums, complete risk profile, non-empty
 * evidence/RTM bindings, signal-only coverage, lifecycle-consistent status, ledger-bound revision, and no
 * unknown nested fields. Any reason blocks the whole row.
 */
export function validateGapRow(row: unknown, ledger: CodeHealthLedger, seenGapIds: ReadonlySet<string>): string[] {
  const reasons: string[] = [];
  if (!isRecord(row)) return ['gap row must be an object'];
  if (!isRecord(ledger) || !Array.isArray(ledger.candidates)) return ['gap row requires the ledger candidates'];
  hasOnlyProperties(row, GAP_ROW_KEYS, 'gap row', reasons);
  for (const key of GAP_REQUIRED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) reasons.push(`gap row requires ${key}`);
  }
  if (typeof row.gapId !== 'string' || !GAP_ID_PATTERN.test(row.gapId)) {
    reasons.push('gapId is invalid');
  } else if (seenGapIds.has(row.gapId)) {
    reasons.push(`duplicate gapId: ${row.gapId}`);
  }
  if (typeof row.candidateId !== 'string' || !GAP_CANDIDATE_ID_PATTERN.test(row.candidateId)) {
    reasons.push('candidateId is invalid');
  }
  const candidate =
    typeof row.candidateId === 'string'
      ? ledger.candidates.find((entry) => entry.candidateId === row.candidateId)
      : undefined;
  if (!candidate) {
    reasons.push('gap candidateId does not reference a candidate in the ledger');
  } else if (!isCandidateRevisionBoundToLedger(ledger, candidate)) {
    reasons.push('gap candidate revision is not bound to a ledger revision');
  }
  if (!GAP_KINDS.includes(row.kind as (typeof GAP_KINDS)[number])) reasons.push('kind is invalid');
  if (
    !isStringArray(row.testLevels, false) ||
    row.testLevels.some((level) => !GAP_TEST_LEVELS.includes(level as (typeof GAP_TEST_LEVELS)[number]))
  ) {
    reasons.push('testLevels is invalid');
  }
  if (!isStringArray(row.existingTestIds) || row.existingTestIds.some((testId) => testId.trim() === '')) {
    reasons.push('existingTestIds must contain non-empty test identifiers');
  }
  if (!isBoundedGapText(row.missingScenario)) reasons.push('missingScenario is required and must be specific');
  if (!isStringArray(row.evidenceSources, false)) {
    reasons.push('evidenceSources is required');
  } else if (row.evidenceSources.some((source) => !isRelativePath(source))) {
    reasons.push('evidenceSources must be repository-relative');
  }
  validateGapRisk(row.risk, 'risk', reasons);
  if (!GAP_PRIORITIES.includes(row.priority as (typeof GAP_PRIORITIES)[number])) reasons.push('priority is invalid');
  if (!isBoundedGapText(row.owner)) reasons.push('owner is required and must be specific');
  if (!isStringArray(row.rtmIds, false) || row.rtmIds.some((rtmId) => rtmId.trim() === '')) {
    reasons.push('rtmIds must contain non-empty requirement identifiers');
  }
  validateGapCoverage(row.coverageSignal, 'coverageSignal', reasons);
  if (row.coverageIsSignalOnly !== true) reasons.push('coverageIsSignalOnly must be true');
  if (!GAP_STATUSES.includes(row.status as (typeof GAP_STATUSES)[number])) {
    reasons.push('status is invalid');
  } else if (candidate && !gapStatusAllowedForCandidate(candidate.status).includes(row.status as GapRow['status'])) {
    reasons.push(`status ${String(row.status)} is ahead of the candidate lifecycle state ${candidate.status}`);
  }
  if (row.redEvidence !== undefined) validateGapEvidenceCommand(row.redEvidence, 'redEvidence', 'red', reasons);
  if (row.greenEvidence !== undefined) validateGapEvidenceCommand(row.greenEvidence, 'greenEvidence', 'green', reasons);
  // R-G: row-level red/green evidence is a pair bound to THIS row's gapId and one assertion hash.
  const hasRedEvidence = row.redEvidence !== undefined;
  const hasGreenEvidence = row.greenEvidence !== undefined;
  if (hasRedEvidence !== hasGreenEvidence) {
    reasons.push('redEvidence and greenEvidence must be present as a pair');
  }
  if (hasRedEvidence && hasGreenEvidence) {
    const redBinding = tddHarnessBinding(row.redEvidence as CommandEvidence);
    const greenBinding = tddHarnessBinding(row.greenEvidence as CommandEvidence);
    if (!redBinding || redBinding.gapId !== row.gapId) {
      reasons.push(`redEvidence must be bound to gap ${String(row.gapId)}`);
    }
    if (!greenBinding || greenBinding.gapId !== row.gapId) {
      reasons.push(`greenEvidence must be bound to gap ${String(row.gapId)}`);
    }
    if (redBinding && greenBinding && redBinding.assertionHash !== greenBinding.assertionHash) {
      reasons.push('redEvidence and greenEvidence must share one assertionHash');
    }
    if (typeof row.assertionHash === 'string') {
      if (redBinding && redBinding.assertionHash !== row.assertionHash) {
        reasons.push('redEvidence assertionHash does not match the gap assertionHash');
      }
      if (greenBinding && greenBinding.assertionHash !== row.assertionHash) {
        reasons.push('greenEvidence assertionHash does not match the gap assertionHash');
      }
    }
    // G-1/G-2: any declared artifact set must be consistent with the LEDGER candidate record.
    for (const [field, evidence] of [
      ['redEvidence', row.redEvidence],
      ['greenEvidence', row.greenEvidence],
    ] as const) {
      const declaration = tddArtifactDeclarations(evidence as CommandEvidence);
      if (declaration === null) continue;
      reasons.push(...validateDeclarationAgainstCandidate(declaration, candidate, field));
    }
  }
  if (
    row.assertionHash !== undefined &&
    (typeof row.assertionHash !== 'string' || !HEX64_PATTERN.test(row.assertionHash))
  ) {
    reasons.push('assertionHash is invalid');
  }
  if (
    row.implementationHash !== undefined &&
    row.implementationHash !== null &&
    (typeof row.implementationHash !== 'string' || !HEX64_PATTERN.test(row.implementationHash))
  ) {
    reasons.push('implementationHash is invalid');
  }
  if (row.status === 'implemented' || row.status === 'verified') {
    for (const key of ['redEvidence', 'greenEvidence', 'assertionHash'] as const) {
      if (row[key] === undefined) reasons.push(`${row.status} gap requires ${key}`);
    }
  }
  return reasons;
}

/** Validate a whole gap matrix; duplicate gap IDs, unknown rows, and cross-candidate references all block. */
export function validateGapMatrix(matrix: unknown, ledger: CodeHealthLedger): string[] {
  if (!isRecord(matrix)) return ['gap matrix requires an object'];
  if (!Array.isArray(matrix.rows)) return ['gap matrix rows are required'];
  if (matrix.rows.length === 0) return ['gap matrix rows must not be empty'];
  const reasons: string[] = [];
  hasOnlyProperties(matrix, ['rows'], 'gap matrix', reasons);
  const seenGapIds = new Set<string>();
  matrix.rows.forEach((row, index) => {
    const rowReasons = validateGapRow(row, ledger, seenGapIds);
    if (isRecord(row) && typeof row.gapId === 'string') seenGapIds.add(row.gapId);
    reasons.push(...rowReasons.map((reason) => `rows[${index}] ${reason}`));
  });
  return reasons;
}

function notImplemented(reason: string): CodeHealthError {
  return new CodeHealthError('NOT_IMPLEMENTED', reason);
}

/**
 * Phase 1 discovery surface (R8 closure). The real pure implementations live in
 * `logic/code-health-phase1-logic.ts`; this legacy module re-exports them so existing consumers keep one
 * import path. `runPhase1` (the IO orchestrator) lives in `cli/code-health-phase1.ts` and is intentionally
 * not re-exported here: `logic/` must never depend on `cli/`.
 */
export { buildStaticInventory, checkFalsePositiveGuards, mergeDynamicTrace };

/** Structural view of a harness-produced RED/GREEN result bound to one gap and one assertion. */
interface TddHarnessBinding {
  gapId: string;
  assertionHash: string;
}

function tddHarnessBinding(result: CommandEvidence): TddHarnessBinding | null {
  const candidate = result as Partial<TddHarnessBinding>;
  if (typeof candidate.gapId === 'string' && typeof candidate.assertionHash === 'string') {
    return { gapId: candidate.gapId, assertionHash: candidate.assertionHash };
  }
  return null;
}

/** Structural view of the declared artifact set one harness result was produced with (R-E). */
interface TddArtifactDeclarations {
  testArtifacts: string[];
  implementationArtifact: string;
}

function tddArtifactDeclarations(result: CommandEvidence): TddArtifactDeclarations | null {
  const candidate = result as Partial<TddArtifactDeclarations>;
  if (
    Array.isArray(candidate.testArtifacts) &&
    candidate.testArtifacts.every((entry) => typeof entry === 'string') &&
    typeof candidate.implementationArtifact === 'string'
  ) {
    return {
      testArtifacts: candidate.testArtifacts as string[],
      implementationArtifact: candidate.implementationArtifact,
    };
  }
  return null;
}

/**
 * Structural consistency of one declared artifact set against the ledger-recorded candidate: the
 * implementation artifact must be in the ledger-approved `changeScope.files`, every declared test
 * artifact must be a ledger-declared `tests` file, and the two sets must be disjoint. This is a
 * consistency check against the record passed in — it is NOT unforgeable by itself; the ledger,
 * G gate, and signature chain are the authority (G-4).
 */
function validateDeclarationAgainstCandidate(
  declaration: TddArtifactDeclarations,
  candidate: CodeHealthCandidate | undefined,
  field: string,
): string[] {
  const reasons: string[] = [];
  if (!candidate) {
    reasons.push(`${field} declaration requires the ledger candidate record for the gap`);
    return reasons;
  }
  const scopeFiles =
    isRecord(candidate.changeScope) && Array.isArray(candidate.changeScope.files)
      ? candidate.changeScope.files.filter((file): file is string => typeof file === 'string')
      : [];
  const candidateTests = Array.isArray(candidate.tests)
    ? candidate.tests.filter((test): test is string => typeof test === 'string')
    : [];
  if (scopeFiles.length === 0) {
    reasons.push(`${field} declaration requires ledger candidate changeScope.files`);
  } else if (!scopeFiles.includes(declaration.implementationArtifact)) {
    reasons.push(`${field} implementationArtifact is not in the ledger candidate approved scope`);
  }
  if (candidateTests.length === 0) {
    reasons.push(`${field} declaration requires ledger candidate tests`);
  } else {
    for (const artifact of declaration.testArtifacts) {
      if (!candidateTests.includes(artifact)) {
        reasons.push(`${field} test artifact ${artifact} is not a ledger-declared candidate test`);
      }
    }
  }
  if (declaration.testArtifacts.includes(declaration.implementationArtifact)) {
    reasons.push(`${field} testArtifacts must not include the implementation artifact`);
  }
  return reasons;
}

/**
 * Strict RED/GREEN validation. Presence is not enough: every observed result must be harness-bound to
 * the owning gap and declare the artifact set it was produced with; the declared set must be consistent
 * with the LEDGER-recorded candidate (`changeScope.files` = implementation scope, `tests` = declared
 * tests); RED and GREEN must declare identical test artifacts and the same implementation artifact
 * (R-E symmetry), share one assertion hash (so a weakened or deleted assertion cannot produce a matching
 * GREEN), remain disjoint, be distinguishable, and RED must carry the mandatory real assertion-failure
 * classification — unrelated failures and unclassified hand-authored rows are rejected.
 *
 * Honest residual (G-4): this is a pure consistency check against the ledger record passed in. A pure
 * function cannot be unforgeable; the ledger, the G gate, and the role signature chain are the authority.
 */
export function validateRedGreenEvidence(gap: GapRow, results: CommandEvidence[], ledger: CodeHealthLedger): string[] {
  if (!Array.isArray(results)) return ['RED/GREEN results are required'];
  if (!isRecord(gap) || typeof gap.gapId !== 'string') return ['RED/GREEN validation requires the owning gap'];
  if (!isRecord(ledger) || !Array.isArray(ledger.candidates)) {
    return ['RED/GREEN validation requires the ledger candidate record'];
  }
  const ledgerCandidate = ledger.candidates.find((entry) => entry.candidateId === gap.candidateId);
  if (!ledgerCandidate) {
    return [`RED/GREEN validation requires the ledger candidate record for gap ${gap.gapId}`];
  }
  const reasons: string[] = [];
  const observed = results.filter((result) => result.observation === 'observed' && typeof result.exitCode === 'number');
  const reds = observed.filter((result) => (result.exitCode as number) !== 0);
  const greens = observed.filter((result) => result.exitCode === 0);
  if (reds.length === 0) reasons.push('RED evidence required');
  if (greens.length === 0) reasons.push('GREEN evidence required');

  // Gap binding is mandatory: a hand-authored pair of results that carries no gapId/assertionHash can
  // never stand in for a real RED/GREEN pair.
  for (const result of observed) {
    const binding = tddHarnessBinding(result);
    if (binding === null || binding.gapId !== gap.gapId) {
      reasons.push(
        `${result.exitCode === 0 ? 'GREEN' : 'RED'} evidence is not bound to gap ${gap.gapId} (missing harness gapId/assertionHash)`,
      );
      continue;
    }
    if (typeof gap.assertionHash === 'string' && binding.assertionHash !== gap.assertionHash) {
      reasons.push('RED/GREEN assertionHash does not match the recorded gap assertion');
    }
  }
  const bound = observed
    .map((result) => tddHarnessBinding(result))
    .filter((binding): binding is TddHarnessBinding => binding !== null && binding.gapId === gap.gapId);
  const assertionHashes = new Set(bound.map((binding) => binding.assertionHash));
  if (bound.length > 1 && assertionHashes.size > 1) {
    reasons.push('RED and GREEN were not produced by the same assertion (the assertion was changed or weakened)');
  }

  // R-E + G-1/G-2: the declared artifact set is mandatory, symmetric, and consistent with the ledger.
  const declarations = observed.map((result) => ({ result, declaration: tddArtifactDeclarations(result) }));
  for (const { result, declaration } of declarations) {
    const label = result.exitCode === 0 ? 'GREEN' : 'RED';
    if (declaration === null) {
      reasons.push(`${label} evidence must declare its testArtifacts and implementationArtifact`);
      continue;
    }
    if (declaration.testArtifacts.length === 0 || !declaration.testArtifacts.every((entry) => isRelativePath(entry))) {
      reasons.push(`${label} evidence testArtifacts must be non-empty repository-relative paths`);
    }
    if (declaration.testArtifacts.includes(declaration.implementationArtifact)) {
      reasons.push(`${label} evidence testArtifacts must not include the implementation artifact`);
    }
    reasons.push(...validateDeclarationAgainstCandidate(declaration, ledgerCandidate, label));
  }
  const declarationSignatures = new Set(
    declarations
      .map((entry) => entry.declaration)
      .filter((declaration): declaration is TddArtifactDeclarations => declaration !== null)
      .map(
        (declaration) =>
          `${JSON.stringify([...declaration.testArtifacts].sort())}|${declaration.implementationArtifact}`,
      ),
  );
  if (declarationSignatures.size > 1) {
    reasons.push('RED and GREEN must declare identical test artifacts and the same implementation artifact');
  }

  const rawOutputHashes = results.map((result) => result.rawOutputSha256).filter((hash) => typeof hash === 'string');
  if (results.length > 1 && new Set(rawOutputHashes).size < results.length) {
    reasons.push('RED and GREEN evidence is not distinguishable');
  }
  for (const red of reds) {
    const failureClass = red.toolVersions?.[TDD_FAILURE_CLASS_KEY];
    if (failureClass !== 'assertion') {
      reasons.push(
        `RED failed for an unrelated reason or is unclassified (${String(failureClass)}); only a real assertion failure (${TDD_FAILURE_CLASS_KEY}=assertion) can count as RED`,
      );
    }
  }
  return reasons;
}

const APPLY_PATCH_RELATIVE_ROOT = '.w-model/code-health/apply';
const SHA40_PATTERN = /^[0-9a-f]{40}$/;

/** Controlled repository-relative patch path for one approved candidate. */
export function codeHealthApplyPatchPath(candidateId: string): string {
  return `${APPLY_PATCH_RELATIVE_ROOT}/${candidateId}.patch`;
}

/**
 * Real approved-application plan. It validates the candidate, the exact human approval scope, the mode, and
 * the current revision, then returns a `patch-proposal` carrying one controlled patch path and an executable
 * rollback plan. It never touches the filesystem, Git, or the ledger: the IO executor in
 * `cli/code-health-apply.ts` writes the patch and, for `commit`, applies it and promotes the result to
 * `ApplyCommitResult` only after a real scope read-back. Missing / non-human / scope / revision approval
 * failures carry the `HUMAN_APPROVAL_REQUIRED` guard token.
 */
export function applyApproved(input: ApplyApprovedInput): Promise<ApplyResult> {
  if (!isRecord(input)) {
    return Promise.reject(new CodeHealthError('ARG_INVALID', 'approved application requires an input object'));
  }
  const { candidate, approval, mode, repositoryRoot, currentRevision } = input;
  if (mode !== 'dry-run' && mode !== 'patch' && mode !== 'commit') {
    return Promise.reject(
      new CodeHealthError(
        'ARG_INVALID',
        `approved application mode must be dry-run, patch, or commit; received ${String(mode)}`,
      ),
    );
  }
  if (typeof repositoryRoot !== 'string' || repositoryRoot.length === 0) {
    return Promise.reject(
      new CodeHealthError('EVIDENCE_INVALID', 'approved application requires an explicit repository root'),
    );
  }
  if (!isRecord(candidate)) {
    return Promise.reject(new CodeHealthError('EVIDENCE_INVALID', 'approved application requires a candidate object'));
  }
  const candidateReasons = validateCodeHealthCandidate(candidate);
  if (candidateReasons.length > 0) {
    return Promise.reject(
      new CodeHealthError(
        'EVIDENCE_INVALID',
        `approved application candidate is invalid: ${candidateReasons.join('; ')}`,
      ),
    );
  }
  if (!isRecord(approval)) {
    return Promise.reject(
      new CodeHealthError('ROLE_FORBIDDEN', 'HUMAN_APPROVAL_REQUIRED: a human ApprovalDecision is required'),
    );
  }
  const approvalCheck = checkApprovalScope(candidate, approval);
  if (approvalCheck.revision.length > 0) {
    return Promise.reject(
      new CodeHealthError(
        'REVISION_MISMATCH',
        `HUMAN_APPROVAL_REQUIRED: approval revision is stale for the candidate (${approvalCheck.revision.join('; ')})`,
      ),
    );
  }
  if (approvalCheck.evidence.length > 0) {
    return Promise.reject(
      new CodeHealthError(
        'EVIDENCE_INVALID',
        `HUMAN_APPROVAL_REQUIRED: approval is not a valid human decision (${approvalCheck.evidence.join('; ')})`,
      ),
    );
  }
  if (approvalCheck.scope.length > 0) {
    return Promise.reject(
      new CodeHealthError(
        'SCOPE_MISMATCH',
        `HUMAN_APPROVAL_REQUIRED: approval scope does not match the candidate (${approvalCheck.scope.join('; ')})`,
      ),
    );
  }
  if (approval.decision !== 'approve') {
    return Promise.reject(
      new CodeHealthError('EVIDENCE_INVALID', 'HUMAN_APPROVAL_REQUIRED: the approval decision must be approve'),
    );
  }
  if (!isRecord(currentRevision) || !sameRevision(currentRevision as unknown as RevisionIdentity, candidate.revision)) {
    return Promise.reject(
      new CodeHealthError('REVISION_MISMATCH', 'approved application current revision does not match the candidate'),
    );
  }
  const patchPath = codeHealthApplyPatchPath(candidate.candidateId);
  const rollback: RollbackPlan = {
    preChangeRevision: candidate.revision.commitSha,
    command: `git apply -R ${patchPath}`,
    patchPath,
    owner: 'code-health-apply',
    executable: true,
  };
  return Promise.resolve({
    kind: 'patch-proposal',
    applied: false,
    errorCode: null,
    mode,
    patchPath,
    appliedFiles: [],
    unrelatedFiles: [],
    rollback,
  });
}

/**
 * Real rollback executability gate. The plan must be explicitly executable, carry a safe exact revert
 * command, a controlled repository-relative patch path, a real pre-change revision, and an optional valid
 * patch hash. A non-executable or malformed plan can never report success; the IO executor runs the recorded
 * exact command via argv (never a shell string).
 */
export async function executeRollback(rollback: RollbackPlan): Promise<boolean> {
  if (!isRecord(rollback) || rollback.executable !== true) return false;
  if (typeof rollback.preChangeRevision !== 'string' || !SHA40_PATTERN.test(rollback.preChangeRevision)) return false;
  if (typeof rollback.owner !== 'string' || rollback.owner.length === 0) return false;
  if (typeof rollback.command !== 'string' || rollback.command.length === 0 || /[;&|<>\r\n]/.test(rollback.command)) {
    return false;
  }
  if (!isRelativePath(rollback.patchPath)) return false;
  if (
    rollback.patchSha256 !== undefined &&
    (typeof rollback.patchSha256 !== 'string' || !HEX64_PATTERN.test(rollback.patchSha256))
  ) {
    return false;
  }
  return true;
}

export function evaluateDeletion(facts: DeletionFacts): DeletionEvaluation {
  const violations: string[] = [];
  if (
    !isRecord(facts) ||
    typeof facts.testCount !== 'number' ||
    !Number.isInteger(facts.testCount) ||
    facts.testCount < 0
  ) {
    violations.push('test count is invalid');
  }
  if (!isRecord(facts) || typeof facts.coverageProvenance !== 'string' || facts.coverageProvenance.trim() === '') {
    violations.push('coverage provenance is required');
  }
  if (!isRecord(facts) || !Array.isArray(facts.governanceFacts) || facts.governanceFacts.length === 0) {
    violations.push('governance facts are required');
  }
  if (isRecord(facts) && facts.testCountDelta !== undefined && facts.testCountDelta !== -1) {
    violations.push('test count delta must explain exactly one removed test');
  }
  return { passed: violations.length === 0, violations };
}

export function classifyProtectedTest(test: TestRecord): ProtectedTestClass | null {
  if (!isRecord(test)) throw new Error('test record requires a complete object');
  const requiredTextFields = [
    'testId',
    'file',
    'symbol',
    'author',
    'createdAt',
    'lastChangedAt',
    'level',
    'setup',
    'stimulus',
    'oracle',
    'failureSensitivity',
    'scenarioClass',
  ] as const;
  for (const field of requiredTextFields) {
    if (typeof test[field] !== 'string' || test[field].trim() === '') {
      throw new Error(`test.${field} requires a non-empty value`);
    }
  }
  if (!Array.isArray(test.rtmIds) || !Array.isArray(test.governanceFacts)) throw new Error('test arrays are required');
  const text = [
    test.testId,
    test.file,
    test.symbol,
    test.setup,
    test.stimulus,
    test.oracle,
    test.failureSensitivity,
    test.scenarioClass,
    ...test.governanceFacts,
  ]
    .join(' ')
    .toLowerCase();
  if (/pre[- ]?push/.test(text)) return 'pre-push';
  if (/self[- ]?test/.test(text)) return 'self-test';
  if (/docs?[- ]consistency/.test(text)) return 'docs-consistency';
  if (/security|auth|injection|secret|redact|privilege/.test(text)) return 'security';
  if (/concurr|race|lock|atomic|idempot|retry|ordering/.test(text)) return 'concurrency';
  if (/platform|windows|linux|git bash|powershell|line ending|executable/.test(text)) return 'platform';
  if (/rollback|migration/.test(text)) return 'migration-rollback';
  if (/boundary|empty|zero|min|max|overflow|truncat|off[- ]by[- ]one/.test(text)) return 'boundary';
  if (/negative|invalid|malformed|missing|error|failure/.test(text)) return 'unique-negative';
  return null;
}

export function proveAbstraction(cluster: unknown, proposal: unknown): string[] {
  if (!isRecord(cluster) || !isRecord(proposal)) {
    throw notImplemented('abstraction proof requires Phase 4 implementation');
  }
  throw notImplemented('abstraction proof is not implemented in Task 1A');
}

/**
 * Compatibility facade for the removed archive campaign entry point. It contains no archive logic of its own:
 * it routes through the single Task 1D boundary factory and surfaces the same typed `NOT_IMPLEMENTED` failure,
 * so no second, half-implemented archive producer can be observed by existing callers.
 */
export async function archiveCampaign(
  campaign: CodeHealthLedger,
  options: { approval?: ApprovalDecision; verificationLevel?: 'package-only' | 'source-bound' } = {},
): Promise<never> {
  const candidates = Array.isArray(campaign?.candidates) ? campaign.candidates : [];
  const candidate = options.approval
    ? candidates.find((entry) => entry.candidateId === options.approval?.candidateId)
    : undefined;
  const result = await createTask1ArchiveBoundary().producer.produce({
    candidate: candidate as CodeHealthCandidate,
    ledger: campaign,
    approval: options.approval as ApprovalDecision,
    verificationLevel: options.verificationLevel ?? 'package-only',
  });
  throw new CodeHealthError(result.errorCode, result.reason);
}

/**
 * Compatibility facade for the removed archive verification entry point. It delegates to the Task 1D boundary
 * verifier and surfaces the same typed `NOT_IMPLEMENTED` failure without reading or hashing anything.
 */
export async function verifyArchive(
  manifestPath: string,
  options: {
    packageRoot?: string;
    sourceProject?: string;
    expectedRevision?: RevisionIdentity;
    verificationLevel?: 'package-only' | 'source-bound';
  } = {},
): Promise<never> {
  const result = await createTask1ArchiveBoundary().verifier.verify({
    manifestPath,
    packageRoot: options.packageRoot ?? '.',
    verificationLevel: options.verificationLevel ?? 'package-only',
    sourceProject: options.sourceProject,
    expectedRevision: options.expectedRevision,
  });
  throw new CodeHealthError(result.errorCode, result.reason);
}
