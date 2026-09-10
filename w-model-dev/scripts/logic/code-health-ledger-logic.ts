/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- Compatibility guards validate repository-relative paths and use fixed field sets. */
/** Legacy code-health lifecycle compatibility layer over the canonical contract. */

import {
  CodeHealthError,
  isIsoDate,
  isRelativePath,
  validateCodeHealthCandidate,
  validateCommandEvidence,
  validateLedgerEvent,
  validateRevision,
} from './code-health-contract.js';
import {
  clusterDuplicates,
  findGaps,
  proveTestRemoval as proveTestRemovalBoundary,
  runTddHarness,
} from './code-health-phase-boundaries.js';
import type {
  ApprovalDecision,
  ArchiveCampaignOptions,
  ArchiveResult,
  ApplyApprovedInput,
  ApplyResult,
  CodeHealthCandidate,
  CodeHealthLedger,
  CodeHealthStatus,
  CommandEvidence,
  DeletionEvaluation,
  DeletionFacts,
  DynamicTraceReport,
  DynamicTraceScenario,
  EvalDiffInput,
  EvidenceRef,
  EvidenceVerificationContext,
  FalsePositiveContext,
  FileVerificationContext,
  GapRow,
  LedgerEvent,
  Phase1CandidateLead,
  Phase1RunResult,
  ProtectedTestClass,
  RevisionIdentity,
  RollbackEvidence,
  RollbackPlan,
  StaticInventoryReport,
  TestRecord,
  TestRemovalProofInput,
  VerifyArchiveOptions,
} from './code-health-contract.js';

export { CodeHealthError, validateCodeHealthCandidate };
export { clusterDuplicates, findGaps, runTddHarness };

export function proveTestRemoval(input: TestRemovalProofInput): string[] {
  return proveTestRemovalBoundary(input);
}
export type {
  AbstractionProposal,
  ApprovalDecision,
  ArchiveCampaignOptions,
  ArchiveConsumeInput,
  ArchiveManifest,
  ArchiveProduceInput,
  ArchiveResult,
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
  VerifyArchiveOptions,
} from './code-health-contract.js';

const HEX64_PATTERN = /^[0-9a-f]{64}$/;
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
  blocked: ['rolled-back'],
  'rolled-back': [],
};

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

function validateRollbackEvidence(
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
    reasons.push(`${field}.command must be an observed zero-exit result`);
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

/**
 * 1B injected-authenticity entry point: the sync reducer runs unchanged and the declared rollback
 * patch and raw output are then proven to exist as regular non-symlink files with matching hashes.
 */
async function transitionCandidateVerified(
  ledger: CodeHealthLedger,
  candidateId: string,
  event: LedgerEvent,
  approval: ApprovalDecision | undefined,
  verification: FileVerificationContext,
): Promise<CodeHealthLedger> {
  const next = transitionCandidateRecord(ledger, candidateId, event, approval);
  if (event.to !== 'rolled-back' || !event.rollbackEvidence) return next;
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
  return next;
}

export function transitionCandidate(
  ledger: CodeHealthLedger,
  candidateId: string,
  event: LedgerEvent,
  approval?: ApprovalDecision,
): CodeHealthLedger;
export function transitionCandidate(
  ledger: CodeHealthLedger,
  candidateId: string,
  event: LedgerEvent,
  approval: ApprovalDecision | undefined,
  verification: FileVerificationContext,
): Promise<CodeHealthLedger>;
export function transitionCandidate(
  ledger: CodeHealthLedger,
  candidateId: string,
  event: LedgerEvent,
  approval?: ApprovalDecision,
  verification?: FileVerificationContext,
): CodeHealthLedger | Promise<CodeHealthLedger> {
  if (!verification) return transitionCandidateRecord(ledger, candidateId, event, approval);
  return transitionCandidateVerified(ledger, candidateId, event, approval, verification);
}

function transitionCandidateRecord(
  ledger: CodeHealthLedger,
  candidateId: string,
  event: LedgerEvent,
  approval?: ApprovalDecision,
): CodeHealthLedger {
  const eventReasons = validateLedgerEvent(event);
  if (eventReasons.length > 0) {
    throw new CodeHealthError('STRUCTURE_INVALID', `transition event is malformed: ${eventReasons.join('; ')}`);
  }
  const current = ledger.candidates.find((candidate) => candidate.candidateId === candidateId);
  if (!current) throw new CodeHealthError('STRUCTURE_INVALID', `transition candidate not found: ${candidateId}`);
  const candidateReasons = validateCodeHealthCandidate(current);
  if (candidateReasons.length > 0) throw new Error(`transition candidate is invalid: ${candidateReasons.join('; ')}`);
  if (event.candidateId !== candidateId) throw new Error('transition candidateId mismatch');
  if (event.from !== current.status) {
    throw new Error(`transition from ${String(event.from)} does not match ${current.status}`);
  }
  if (!sameRevision(event.revision, current.revision)) throw new Error('transition revision is stale');
  if (ledger.events.some((existing) => existing.eventId === event.eventId)) {
    throw new Error(`transition eventId already exists: ${event.eventId}`);
  }
  const previousEvent = ledger.events.at(-1);
  if (previousEvent && Date.parse(event.at) <= Date.parse(previousEvent.at)) {
    throw new Error('transition timestamp must be monotonic');
  }
  if (!isIsoDate(event.at) || event.evidenceRefs.length === 0 || event.signatureRef.length === 0) {
    throw new Error('transition evidence is incomplete');
  }
  if (!NORMAL_TRANSITIONS[current.status].includes(event.to)) {
    throw new Error(`transition ${current.status} -> ${event.to} is not allowed`);
  }
  if (event.to === 'archived') {
    if (!event.archiveEvidence) {
      throw new Error('archive transition requires complete archive evidence');
    }
    throw new CodeHealthError('NOT_IMPLEMENTED', 'archive transition producer is reserved for the Task 1D boundary');
  }
  if (event.to === 'rolled-back') {
    if (event.actorRole !== 'S' && event.actorRole !== 'human') {
      throw new Error('rollback transition requires S or human authorization');
    }
    const rollbackReasons: string[] = [];
    if (
      !validateRollbackEvidence(
        event.rollbackEvidence,
        'transition rollback',
        current,
        event.evidenceRefs,
        rollbackReasons,
      )
    ) {
      throw new Error(rollbackReasons.join('; ') || 'transition rollback evidence is incomplete');
    }
  }
  const roleForTransition: Partial<Record<CodeHealthStatus, LedgerEvent['actorRole'][]>> = {
    evidenced: ['A', 'S'],
    'under-review': ['V'],
    approved: ['human'],
    implemented: ['S'],
    verified: ['V', 'G'],
    rejected: ['human'],
    deferred: ['human'],
    blocked: ['G', 'V', 'S', 'R', 'human'],
  };
  if (roleForTransition[event.to] && !roleForTransition[event.to]!.includes(event.actorRole)) {
    throw new Error(`transition ${event.to} requires an authorized human role`);
  }
  if (event.to === 'approved') {
    if (event.actorRole !== 'human') throw new Error('transition approval requires a human actor');
    if (!approval || validateApprovalScope(current, approval).length > 0 || approval.decision !== 'approve') {
      throw new Error('transition approval requires a matching human ApprovalDecision');
    }
  }
  if (event.to === 'blocked') {
    if (!event.gateFailureEvidence || event.gateFailureEvidence.candidateId !== candidateId) {
      throw new Error('blocked transition requires structured gate failure evidence bound to candidate');
    }
    if (event.gateFailureEvidence.scopeHash !== current.changeScope.scopeHash) {
      throw new Error('gate failure evidence scope does not match candidate');
    }
    const commandEvidence: CommandEvidence = {
      command: event.gateFailureEvidence.command,
      cwd: event.gateFailureEvidence.cwd,
      environment: event.gateFailureEvidence.environment,
      platform: event.gateFailureEvidence.platform,
      toolVersions: event.gateFailureEvidence.toolVersions,
      startedAt: event.gateFailureEvidence.startedAt,
      endedAt: event.gateFailureEvidence.endedAt,
      exitCode: event.gateFailureEvidence.exitCode,
      observation: event.gateFailureEvidence.observation,
      rawOutputPath: event.gateFailureEvidence.rawOutputPath,
      rawOutputSha256: event.gateFailureEvidence.rawOutputSha256,
    };
    const gateReasons: string[] = [];
    if (!validateCommandEvidence(commandEvidence, 'gateFailureEvidence', gateReasons)) {
      throw new Error(gateReasons.join('; '));
    }
    if (
      event.gateFailureEvidence.observation !== 'observed' ||
      event.gateFailureEvidence.exitCode === null ||
      event.gateFailureEvidence.exitCode === 0
    ) {
      throw new Error('blocked transition requires an observed non-zero gate failure');
    }
    if (event.gateFailureEvidence.rawOutputPath !== event.evidenceRefs[0]) {
      throw new Error('gate failure evidence raw output must be bound to event evidence');
    }
  }

  const candidates = ledger.candidates.map((candidate) =>
    candidate.candidateId === candidateId ? { ...candidate, status: event.to } : candidate,
  );
  return { ...ledger, candidates, events: [...ledger.events, event] };
}

export function validateApprovalScope(candidate: CodeHealthCandidate, approval: ApprovalDecision): string[] {
  const reasons: string[] = [];
  if (!isRecord(approval)) return ['approval must be an object'];
  if (approval.candidateId !== candidate.candidateId) reasons.push('approval candidateId does not match candidate');
  if (approval.approvedAction !== candidate.action) reasons.push('approval action does not match candidate');
  if (!sortedEqual(approval.approvedFiles, candidate.changeScope.files)) {
    reasons.push('approval files expand or shrink candidate scope');
  }
  if (!sortedEqual(approval.approvedSymbols, candidate.changeScope.symbols)) {
    reasons.push('approval symbols expand or shrink candidate scope');
  }
  if (approval.scopeHash !== candidate.changeScope.scopeHash)
    reasons.push('approval scopeHash does not match candidate');
  if (!sameRevision(approval.revision, candidate.revision)) reasons.push('approval revision is stale');
  if (!['approve', 'reject', 'defer'].includes(approval.decision)) reasons.push('approval decision is invalid');
  if (
    approval.decision === 'approve' &&
    !['under-review', 'approved', 'implemented', 'verified'].includes(candidate.status)
  ) {
    reasons.push('candidate must be under-review or in an approved lifecycle state before approval');
  }
  if (typeof approval.rationale !== 'string' || approval.rationale.length === 0) {
    reasons.push('approval rationale is required');
  }
  if (
    typeof approval.actor !== 'string' ||
    approval.actor.length === 0 ||
    approval.actor.toLowerCase().includes('agent')
  ) {
    reasons.push('approval actor must identify a human decision maker');
  }
  if (!isIsoDate(approval.decidedAt)) reasons.push('approval decidedAt is invalid');
  if (!isRelativePath(approval.signatureRef)) reasons.push('approval signatureRef is required');
  return reasons;
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

/**
 * 1B injected-authenticity entry point: gate-failure evidence must resolve to a real stored raw output
 * that is bound to the candidate, scope, revision, path, and hash before the reducer records it.
 */
async function verifyGateFailureEvidence(
  ledger: CodeHealthLedger,
  candidateId: string,
  evidence: CommandEvidence,
  verification: EvidenceVerificationContext,
): Promise<void> {
  const candidate = ledger.candidates.find((entry) => entry.candidateId === candidateId);
  if (!candidate) {
    throw new CodeHealthError('STRUCTURE_INVALID', `gate failure candidate identity not found: ${candidateId}`);
  }
  const ref: EvidenceRef = {
    evidenceId: `EVD-GATE-FAIL-${candidateId}-${evidence.rawOutputSha256.slice(0, 16)}`,
    candidateId,
    scopeHash: candidate.changeScope.scopeHash,
    relativePath: evidence.rawOutputPath,
    sha256: evidence.rawOutputSha256,
    revision: candidate.revision,
    observation: evidence.observation,
  };
  await verification.evidenceStore.verify(ref, verification.binding);
}

export function recordGateFailure(
  ledger: CodeHealthLedger,
  candidateId: string,
  evidence: CommandEvidence,
): CodeHealthLedger;
export function recordGateFailure(ledger: CodeHealthLedger, evidence: CommandEvidence): never;
export function recordGateFailure(
  ledger: CodeHealthLedger,
  candidateId: string,
  evidence: CommandEvidence,
  verification: EvidenceVerificationContext,
): Promise<CodeHealthLedger>;
export function recordGateFailure(
  ledger: CodeHealthLedger,
  candidateIdOrEvidence: string | CommandEvidence,
  evidence?: CommandEvidence,
  verification?: EvidenceVerificationContext,
): CodeHealthLedger | Promise<CodeHealthLedger> {
  if (typeof candidateIdOrEvidence !== 'string' || !evidence) {
    throw new Error('gate failure requires explicit candidate identity and evidence');
  }
  const candidateId = candidateIdOrEvidence;
  if (!verification) return recordGateFailureRecord(ledger, candidateId, evidence);
  return verifyGateFailureEvidence(ledger, candidateId, evidence, verification).then(() =>
    recordGateFailureRecord(ledger, candidateId, evidence),
  );
}

function recordGateFailureRecord(
  ledger: CodeHealthLedger,
  candidateId: string,
  evidence: CommandEvidence,
): CodeHealthLedger {
  const candidate = ledger.candidates.find((entry) => entry.candidateId === candidateId);
  if (!candidate) throw new Error(`gate failure candidate identity not found: ${candidateId}`);
  if (!isRelativePath(evidence.rawOutputPath)) {
    throw new Error('gate failure evidence raw output path is unsafe');
  }
  const event: LedgerEvent = {
    eventId: `EV-GATE-FAIL-${candidate.candidateId}-${ledger.events.length + 1}`,
    eventKind: 'gate-failure',
    candidateId: candidate.candidateId,
    from: candidate.status,
    to: 'blocked',
    actorRole: 'G',
    at: evidence.endedAt,
    revision: candidate.revision,
    scopeHash: candidate.changeScope.scopeHash,
    evidenceRefs: [evidence.rawOutputPath],
    signatureRef: 'evidence/signature-gate-failure.json',
    gateFailureEvidence: {
      ...evidence,
      candidateId: candidate.candidateId,
      scopeHash: candidate.changeScope.scopeHash,
      failureKind: 'gate',
    },
  };
  return transitionCandidateRecord(ledger, candidate.candidateId, event);
}

export function nextRequiredRoles(ledger: CodeHealthLedger): Array<'R' | 'V' | 'G' | 'S'> {
  const blocked =
    ledger.candidates.some((candidate) => candidate.status === 'blocked') ||
    ledger.events.some((event) => event.to === 'blocked');
  return blocked ? ['R', 'V', 'G', 'S'] : [];
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

function validateGapCoverage(value: unknown, field: string, reasons: string[]): void {
  if (!isRecord(value)) {
    reasons.push(`${field} is required`);
    return;
  }
  const allowedKeys = new Set(['statements', 'branches', 'functions', 'lines']);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) reasons.push(`${field} has unknown property: ${key}`);
  }
  for (const metric of ['statements', 'branches', 'functions', 'lines']) {
    if (!(metric in value)) {
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
  const allowedKeys = new Set([
    'severity',
    'behavior',
    'security',
    'concurrency',
    'platform',
    'lifecycle',
    'governance',
    'rationale',
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) reasons.push(`${field} has unknown property: ${key}`);
  }
  const riskEnums: Record<string, readonly string[]> = {
    severity: ['low', 'medium', 'high', 'critical'],
    behavior: ['none', 'low', 'medium', 'high', 'unknown'],
    security: ['none', 'low', 'medium', 'high', 'unknown'],
    concurrency: ['none', 'low', 'medium', 'high', 'unknown'],
    platform: ['none', 'low', 'medium', 'high', 'unknown'],
    lifecycle: ['none', 'low', 'medium', 'high', 'unknown'],
    governance: ['none', 'low', 'medium', 'high', 'unknown'],
  };
  for (const [key, allowed] of Object.entries(riskEnums)) {
    if (typeof value[key] !== 'string' || !allowed.includes(value[key] as string)) {
      reasons.push(`${field}.${key} is invalid`);
    }
  }
  if (typeof value.rationale !== 'string' || value.rationale.trim() === '') {
    reasons.push(`${field}.rationale is required`);
  }
}

function isBoundedGapText(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    !/^(?:unknown|tbd|todo|n\/a|none|not[ -]?provided)$/i.test(value.trim())
  );
}

export function validateGapMatrix(matrix: unknown): string[] {
  if (!isRecord(matrix)) return ['gap matrix requires an object'];
  if (!Array.isArray(matrix.rows)) return ['gap matrix rows are required'];
  const reasons: string[] = [];
  matrix.rows.forEach((row, index) => {
    const field = `rows[${index}]`;
    if (!isRecord(row)) {
      reasons.push(`${field} must be an object`);
      return;
    }
    const allowedKeys = new Set([
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
    ]);
    for (const key of Object.keys(row)) {
      if (!allowedKeys.has(key)) reasons.push(`${field} has unknown property: ${key}`);
    }
    const required = [
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
    ];
    for (const key of required) {
      if (!(key in row)) reasons.push(`${field} requires ${key}`);
    }
    if (typeof row.gapId !== 'string' || !GAP_ID_PATTERN.test(row.gapId)) reasons.push(`${field}.gapId is invalid`);
    if (typeof row.candidateId !== 'string' || !GAP_CANDIDATE_ID_PATTERN.test(row.candidateId)) {
      reasons.push(`${field}.candidateId is invalid`);
    }
    if (!GAP_KINDS.includes(row.kind as (typeof GAP_KINDS)[number])) reasons.push(`${field}.kind is invalid`);
    if (
      !isStringArray(row.testLevels, false) ||
      row.testLevels.some((level) => !GAP_TEST_LEVELS.includes(level as (typeof GAP_TEST_LEVELS)[number]))
    ) {
      reasons.push(`${field}.testLevels is invalid`);
    }
    if (!isStringArray(row.existingTestIds)) reasons.push(`${field}.existingTestIds must be a string array`);
    if (!isBoundedGapText(row.missingScenario))
      reasons.push(`${field}.missingScenario is required and must be specific`);
    if (!isStringArray(row.evidenceSources, false)) reasons.push(`${field}.evidenceSources is required`);
    else if (row.evidenceSources.some((source) => !isRelativePath(source))) {
      reasons.push(`${field}.evidenceSources must be repository-relative`);
    }
    validateGapRisk(row.risk, `${field}.risk`, reasons);
    if (!GAP_PRIORITIES.includes(row.priority as (typeof GAP_PRIORITIES)[number])) {
      reasons.push(`${field}.priority is invalid`);
    }
    if (!isBoundedGapText(row.owner)) reasons.push(`${field}.owner is required and must be specific`);
    if (!isStringArray(row.rtmIds, false)) reasons.push(`${field}.rtmIds is required`);
    if (row.coverageIsSignalOnly !== true) reasons.push(`${field}.coverageIsSignalOnly must be true`);
    validateGapCoverage(row.coverageSignal, `${field}.coverageSignal`, reasons);
    if (!GAP_STATUSES.includes(row.status as (typeof GAP_STATUSES)[number])) {
      reasons.push(`${field}.status is invalid`);
    }
  });
  return reasons;
}

function notImplemented(reason: string): CodeHealthError {
  return new CodeHealthError('NOT_IMPLEMENTED', reason);
}

export function buildStaticInventory(input: {
  files: string[];
  sourceText: Map<string, string>;
  revision: RevisionIdentity;
}): StaticInventoryReport {
  if (!isRecord(input) || !Array.isArray(input.files) || input.files.length === 0) {
    throw notImplemented('static inventory requires Phase 1 implementation');
  }
  throw notImplemented('static inventory is not implemented in Task 1A');
}

export function mergeDynamicTrace(
  _staticReport: StaticInventoryReport,
  _trace: DynamicTraceReport,
): Phase1CandidateLead[] {
  throw notImplemented('dynamic trace merge is not implemented in Task 1A');
}

export function checkFalsePositiveGuards(_lead: Phase1CandidateLead, _context: FalsePositiveContext): string[] {
  throw notImplemented('false-positive analysis is not implemented in Task 1A');
}

export function runPhase1(_input: {
  root: string;
  output: string;
  scenarios: DynamicTraceScenario[];
}): Promise<Phase1RunResult> {
  return Promise.reject(notImplemented('Phase 1 runner is not implemented in Task 1A'));
}

export function validateRedGreenEvidence(_gap: GapRow, results: CommandEvidence[]): string[] {
  if (!Array.isArray(results)) return ['RED/GREEN results are required'];
  const reasons: string[] = [];
  const red = results.some(
    (result) => result.observation === 'observed' && result.exitCode !== null && result.exitCode !== 0,
  );
  const green = results.some((result) => result.observation === 'observed' && result.exitCode === 0);
  if (!red) reasons.push('RED evidence required');
  if (!green) reasons.push('GREEN evidence required');
  return reasons;
}

export function applyApproved(input: ApplyApprovedInput): Promise<ApplyResult> {
  if (!isRecord(input) || !isRecord(input.approval) || !isRecord(input.candidate)) {
    return Promise.reject(new CodeHealthError('ARG_INVALID', 'approved application requires candidate and approval'));
  }
  const scopeReasons = validateApprovalScope(input.candidate, input.approval);
  if (scopeReasons.length > 0) {
    return Promise.reject(
      new CodeHealthError('SCOPE_MISMATCH', `approved application scope is invalid: ${scopeReasons.join('; ')}`),
    );
  }
  return Promise.reject(notImplemented('approved application is not implemented in Task 1A'));
}

export async function executeRollback(_rollback: RollbackPlan): Promise<boolean> {
  return false;
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

export async function archiveCampaign(
  _campaign: CodeHealthLedger,
  _options: ArchiveCampaignOptions = {},
): Promise<ArchiveResult> {
  throw notImplemented('archive producer is reserved for the Task 1D boundary');
}

export async function verifyArchive(
  _archivePath: string,
  _options: VerifyArchiveOptions = {},
): Promise<{ ok: boolean; verificationLevel: 'package-only' | 'source-bound' }> {
  throw notImplemented('archive consumer is reserved for the Task 1D boundary');
}
