/** Deterministic contracts and lifecycle rules for code-health campaign artifacts. */

export type CodeHealthPhase = 'P1' | 'P2' | 'P3' | 'P4';
export type CodeHealthAction = 'delete-code' | 'add-test' | 'delete-test' | 'abstract';
export type CodeHealthStatus =
  | 'discovered'
  | 'evidenced'
  | 'under-review'
  | 'approved'
  | 'implemented'
  | 'verified'
  | 'archived'
  | 'rejected'
  | 'deferred'
  | 'blocked'
  | 'rolled-back';
export type EvidenceObservationStatus = 'observed' | 'not_run' | 'unavailable' | 'unverified';
export type ReviewDecision = 'approve' | 'reject' | 'defer' | 'block' | 'rollback';
export type TestLevel = 'unit' | 'integration' | 'system' | 'acceptance';

export interface RevisionIdentity {
  commitSha: string;
  treeSha: string;
  sourceBundleSha256: string;
  analyzedAt: string;
}

export interface CommandEvidence {
  command: string;
  cwd: string;
  environment: Record<string, string>;
  platform: string;
  toolVersions: Record<string, string>;
  startedAt: string;
  endedAt: string;
  exitCode: number | null;
  observation: EvidenceObservationStatus;
  rawOutputPath: string;
  rawOutputSha256: string;
}

export interface RiskProfile {
  severity: 'low' | 'medium' | 'high' | 'critical';
  behavior: 'none' | 'low' | 'medium' | 'high' | 'unknown';
  security: 'none' | 'low' | 'medium' | 'high' | 'unknown';
  concurrency: 'none' | 'low' | 'medium' | 'high' | 'unknown';
  platform: 'none' | 'low' | 'medium' | 'high' | 'unknown';
  lifecycle: 'none' | 'low' | 'medium' | 'high' | 'unknown';
  governance: 'none' | 'low' | 'medium' | 'high' | 'unknown';
  rationale: string;
}

export interface CoverageRecord {
  statements: number | null;
  branches: number | null;
  functions: number | null;
  lines: number | null;
}

export interface ImpactRecord {
  rtmBefore: string[];
  rtmAfter: string[];
  coverageBefore: CoverageRecord;
  coverageAfter: CoverageRecord;
  testLevels: TestLevel[];
  unmappedScenarios: string[];
  coverageIsSignalOnly: true;
}

export interface RollbackPlan {
  preChangeRevision: string;
  command: string;
  patchPath: string;
  owner: string;
  executable: boolean;
}

export interface SignatureRecord {
  role: 'A' | 'S' | 'V' | 'G' | 'R' | 'human';
  actor: string;
  event: string;
  scopeHash: string;
  provenanceRef: string;
  signedAt: string;
}

export interface CodeHealthCandidate {
  candidateId: string;
  phase: CodeHealthPhase;
  action: CodeHealthAction;
  status: CodeHealthStatus;
  files: string[];
  symbols: string[];
  tests: string[];
  callSites: string[];
  sources: string[];
  commands: CommandEvidence[];
  revision: RevisionIdentity;
  confidence: { level: 'low' | 'medium' | 'high'; score: number; rationale: string; uncertainties: string[] };
  risk: RiskProfile;
  rtmImpact: ImpactRecord;
  coverageImpact: ImpactRecord;
  rollback: RollbackPlan;
  review: {
    findings: string[];
    unresolvedQuestions: string[];
    decision: ReviewDecision | null;
    humanDecision: 'approve' | 'reject' | 'defer' | null;
  };
  signatures: SignatureRecord[];
  changeScope: { files: string[]; symbols: string[]; scopeHash: string };
  evidenceRef: string;
  archive: {
    state: 'not_archived' | 'archived';
    manifestPath: string | null;
    contentHash: string | null;
    redactionStatus: 'not_reviewed' | 'clean' | 'blocked';
  };
}

export interface LedgerEvent {
  eventId: string;
  candidateId: string;
  from: CodeHealthStatus | null;
  to: CodeHealthStatus;
  actorRole: 'O' | 'A' | 'S' | 'V' | 'G' | 'R' | 'human';
  at: string;
  revision: RevisionIdentity;
  evidenceRefs: string[];
  signatureRef: string;
}

export interface EnvironmentObservation {
  platform: string;
  shell: string;
  runtime: string;
  supported: boolean;
  observed: EvidenceObservationStatus;
  reason: string;
}

export interface CodeHealthLedger {
  schemaVersion: '1.0';
  campaignId: string;
  createdAt: string;
  baseline: RevisionIdentity;
  environmentMatrix: EnvironmentObservation[];
  candidates: CodeHealthCandidate[];
  events: LedgerEvent[];
  appendOnly: true;
  redaction: { status: 'not_reviewed' | 'clean' | 'blocked'; rules: string[]; blockedReasons: string[] };
}

export interface ApprovalDecision {
  candidateId: string;
  decision: 'approve' | 'reject' | 'defer';
  approvedAction: CodeHealthAction;
  approvedFiles: string[];
  approvedSymbols: string[];
  scopeHash: string;
  rationale: string;
  actor: string;
  decidedAt: string;
  signatureRef: string;
}

export interface StaticReference {
  path: string;
  symbol: string;
  consumer: string;
  kind:
    | 'import'
    | 'export'
    | 'call'
    | 'route'
    | 'cli-registration'
    | 'string-symbol'
    | 'generated-input'
    | 'schema'
    | 'template'
    | 'rtm'
    | 'test-helper'
    | 'dynamic-import'
    | 'reflection'
    | 'shell-platform';
  line: number;
  sourceHash: string;
}

export interface DynamicTraceScenario {
  id: string;
  environment: string;
  reached: boolean | null;
  observation: EvidenceObservationStatus;
  command: CommandEvidence;
}

export interface DynamicTraceReport {
  revision: RevisionIdentity;
  scenarios: DynamicTraceScenario[];
  rawTraceSha256: string;
}

export interface StaticInventoryReport {
  revision: RevisionIdentity;
  files: string[];
  references: StaticReference[];
  categories: string[];
  unknowns: string[];
  commands: CommandEvidence[];
}

export interface Phase1CandidateLead {
  candidateId: string;
  classification: 'candidate' | 'unknown' | 'blocked';
  files: string[];
  symbols: string[];
  staticReferences: StaticReference[];
  dynamicScenarios: DynamicTraceScenario[];
  guardViolations: string[];
  status: 'discovered' | 'blocked';
}

export interface FalsePositiveContext {
  dynamicImports: string[];
  reflection: string[];
  platforms: string[];
  schemas: string[];
  templates: string[];
  rtmIds: string[];
  testHelpers: string[];
  generatedReferences: string[];
  externalContracts: string[];
}

export interface GapRow {
  gapId: string;
  candidateId: string;
  kind: 'requirement' | 'public-contract' | 'branch' | 'error' | 'security' | 'concurrency' | 'platform';
  testLevels: TestLevel[];
  existingTestIds: string[];
  missingScenario: string;
  evidenceSources: string[];
  risk: RiskProfile;
  priority: 'low' | 'medium' | 'high' | 'critical';
  owner: string;
  rtmIds: string[];
  coverageSignal: CoverageRecord;
  coverageIsSignalOnly: true;
  status: 'discovered' | 'approved' | 'implemented' | 'verified' | 'blocked';
}

export type ProtectedTestClass =
  | 'unique-negative'
  | 'boundary'
  | 'security'
  | 'concurrency'
  | 'platform'
  | 'migration-rollback'
  | 'pre-push'
  | 'self-test'
  | 'docs-consistency';

export interface TestRecord {
  testId: string;
  file: string;
  symbol: string;
  author: string;
  createdAt: string;
  lastChangedAt: string;
  level: TestLevel;
  setup: string;
  stimulus: string;
  oracle: string;
  failureSensitivity: string;
  rtmIds: string[];
  scenarioClass: string;
  governanceFacts: string[];
}

export interface TestRemovalProofInput {
  candidate: TestRecord;
  survivor: TestRecord | null;
  pre: { testCount: number; coverageProvenance: string; governanceFacts: string[] };
  post: { testCount: number; coverageProvenance: string; governanceFacts: string[] } | null;
}

export interface DuplicateInput {
  implementations: Array<{ file: string; symbol: string; sourceHash: string }>;
  ast: string[];
  dataFlow: string[];
  callGraph: string[];
  tests: string[];
}

export interface DuplicateCluster {
  clusterId: string;
  implementations: Array<{ file: string; symbol: string; sourceHash: string }>;
  views: { ast: string[]; dataFlow: string[]; callGraph: string[]; signatures: string[]; tests: string[] };
  stableProductionCallSites: string[];
  status: 'under-review' | 'deferred' | 'rejected' | 'approved';
}

export interface AbstractionProposal {
  targetApi: string;
  migratedCallSites: string[];
  inputsOutputs: string;
  errorsRetries: string;
  lifecycleResources: string;
  security: string;
  concurrencyPlatforms: string;
  maintenanceBenefit: string;
  rollback: RollbackPlan;
}

export interface CodeHealthEvidence {
  evidenceId: string;
  candidateId: string;
  revision: RevisionIdentity;
  staticReferences: StaticReference[];
  dynamicScenarios: DynamicTraceScenario[];
  commands: CommandEvidence[];
  environment: Record<string, string>;
  toolVersions: Record<string, string>;
  unknowns: string[];
  falsePositiveChecks: string[];
  rtmImpact?: ImpactRecord;
  coverageImpact?: ImpactRecord;
  redaction: { status: 'not_reviewed' | 'clean' | 'blocked'; reasons: string[] };
}

export interface CodeHealthArchive {
  archiveId: string;
  candidateId: string;
  status: 'archived' | 'deferred' | 'rejected' | 'blocked' | 'rolled-back';
  ledgerEventRef: string;
  diffPath: string | null;
  diffSha256: string | null;
  rollback: RollbackPlan;
  manifestPath: string;
  contentHash: string;
  reviewRefs: string[];
  gateRefs: string[];
  signatureRefs: string[];
  redaction: { status: 'clean' | 'blocked'; reasons: string[] };
  retention: { location: string; until: string };
  verificationLevel: 'package-only' | 'source-bound';
  sourceRevision: RevisionIdentity;
  archivedAt: string;
}

export interface CodeHealthCommandRunner {
  run(
    command: string,
    args: string[],
    options: { cwd: string; env: Record<string, string>; timeoutMs: number },
  ): Promise<CommandEvidence>;
}

const ID_PATTERN = /^CHG-P[1-4]-[0-9]{8}-[0-9]{3,}$/;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const HEX64_PATTERN = /^[0-9a-f]{64}$/;
const SHA40_PATTERN = /^[0-9a-f]{40}$/;
const STATUSES: readonly CodeHealthStatus[] = [
  'discovered',
  'evidenced',
  'under-review',
  'approved',
  'implemented',
  'verified',
  'archived',
  'rejected',
  'deferred',
  'blocked',
  'rolled-back',
];
const ACTIONS: readonly CodeHealthAction[] = ['delete-code', 'add-test', 'delete-test', 'abstract'];
const PHASES: readonly CodeHealthPhase[] = ['P1', 'P2', 'P3', 'P4'];
const OBSERVATIONS: readonly EvidenceObservationStatus[] = ['observed', 'not_run', 'unavailable', 'unverified'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown, allowEmpty = true): value is string[] {
  return Array.isArray(value) && (allowEmpty || value.length > 0) && value.every((item) => typeof item === 'string');
}

function recordValue(record: Record<string, unknown>, key: string): unknown {
  for (const [entryKey, entryValue] of Object.entries(record)) {
    if (entryKey === key) return entryValue;
  }
  return undefined;
}

function isRelativePath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !value.startsWith('/') &&
    !/^[A-Za-z]:[\\/]/.test(value) &&
    !value.includes('\\') &&
    !value.split('/').includes('..')
  );
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validateRevision(value: unknown, field: string, reasons: string[]): value is RevisionIdentity {
  if (!isRecord(value)) {
    reasons.push(`${field} must be an object`);
    return false;
  }
  if (typeof value.commitSha !== 'string' || !SHA40_PATTERN.test(value.commitSha))
    reasons.push(`${field}.commitSha is invalid`);
  if (typeof value.treeSha !== 'string' || !SHA40_PATTERN.test(value.treeSha))
    reasons.push(`${field}.treeSha is invalid`);
  if (typeof value.sourceBundleSha256 !== 'string' || !HEX64_PATTERN.test(value.sourceBundleSha256))
    reasons.push(`${field}.sourceBundleSha256 is invalid`);
  if (!isIsoDate(value.analyzedAt)) reasons.push(`${field}.analyzedAt is invalid`);
  return reasons.length === 0;
}

function validateCoverage(value: unknown, field: string, reasons: string[]): boolean {
  if (!isRecord(value)) {
    reasons.push(`${field} is required`);
    return false;
  }
  for (const key of ['statements', 'branches', 'functions', 'lines']) {
    const metric = recordValue(value, key);
    if (!Object.keys(value).includes(key)) reasons.push(`${field}.${key} is required`);
    if (metric !== null && (typeof metric !== 'number' || !Number.isFinite(metric) || metric < 0 || metric > 1)) {
      reasons.push(`${field}.${key} must be null or a number between 0 and 1`);
    }
  }
  return true;
}

function validateImpact(value: unknown, field: string, reasons: string[]): boolean {
  if (!isRecord(value)) {
    reasons.push(`${field} is required`);
    return false;
  }
  if (!isStringArray(value.rtmBefore) || !isStringArray(value.rtmAfter))
    reasons.push(`${field}.rtmBefore/rtmAfter must be string arrays`);
  if (!validateCoverage(value.coverageBefore, `${field}.coverageBefore`, reasons)) return false;
  if (!validateCoverage(value.coverageAfter, `${field}.coverageAfter`, reasons)) return false;
  if (
    !isStringArray(value.testLevels) ||
    !value.testLevels.every((level) => ['unit', 'integration', 'system', 'acceptance'].includes(level))
  )
    reasons.push(`${field}.testLevels is invalid`);
  if (!isStringArray(value.unmappedScenarios)) reasons.push(`${field}.unmappedScenarios must be a string array`);
  if (value.coverageIsSignalOnly !== true) reasons.push(`${field}.coverageIsSignalOnly must be true`);
  return true;
}

export function validateCodeHealthCandidate(candidate: unknown): string[] {
  const reasons: string[] = [];
  if (!isRecord(candidate)) return ['candidate must be an object'];
  if (typeof candidate.candidateId !== 'string' || !ID_PATTERN.test(candidate.candidateId))
    reasons.push('candidateId is invalid');
  if (!PHASES.includes(candidate.phase as CodeHealthPhase)) reasons.push('phase is invalid');
  if (!ACTIONS.includes(candidate.action as CodeHealthAction)) reasons.push('action is invalid');
  if (!STATUSES.includes(candidate.status as CodeHealthStatus)) reasons.push('status is invalid');
  for (const field of ['files', 'symbols', 'tests', 'callSites', 'sources']) {
    const values = recordValue(candidate, field);
    if (!isStringArray(values, field === 'tests' || field === 'callSites'))
      reasons.push(`${field} must be a string array`);
    if (Array.isArray(values) && values.some((file) => !isRelativePath(file)))
      reasons.push(`${field} must contain repository-relative paths or identifiers`);
  }
  validateRevision(candidate.revision, 'revision', reasons);

  if (!isRecord(candidate.confidence)) reasons.push('confidence is required');
  else {
    if (!['low', 'medium', 'high'].includes(candidate.confidence.level as string))
      reasons.push('confidence.level is invalid');
    if (
      typeof candidate.confidence.score !== 'number' ||
      candidate.confidence.score < 0 ||
      candidate.confidence.score > 1
    )
      reasons.push('confidence.score is invalid');
    if (typeof candidate.confidence.rationale !== 'string' || candidate.confidence.rationale.length === 0)
      reasons.push('confidence.rationale is required');
    if (!isStringArray(candidate.confidence.uncertainties))
      reasons.push('confidence.uncertainties must be a string array');
  }

  if (!isRecord(candidate.risk)) reasons.push('risk is required');
  else {
    for (const field of ['severity', 'behavior', 'security', 'concurrency', 'platform', 'lifecycle', 'governance']) {
      if (typeof recordValue(candidate.risk, field) !== 'string') reasons.push(`risk.${field} is required`);
    }
    if (typeof candidate.risk.rationale !== 'string' || candidate.risk.rationale.length === 0)
      reasons.push('risk.rationale is required');
  }
  validateImpact(candidate.rtmImpact, 'rtmImpact', reasons);
  validateImpact(candidate.coverageImpact, 'coverageImpact', reasons);
  if (!Array.isArray(candidate.commands) || candidate.commands.length === 0) reasons.push('commands is required');
  else {
    for (const [index, command] of candidate.commands.entries()) {
      if (!isRecord(command)) {
        reasons.push(`commands[${index}] must be an object`);
        continue;
      }
      for (const field of ['command', 'cwd', 'platform', 'rawOutputPath', 'rawOutputSha256']) {
        const value = recordValue(command, field);
        if (typeof value !== 'string' || value === '') reasons.push(`commands[${index}].${field} is required`);
      }
      if (
        !isRecord(command.environment) ||
        Object.values(command.environment).some((value) => typeof value !== 'string')
      ) {
        reasons.push(`commands[${index}].environment must be a string map`);
      }
      if (
        !isRecord(command.toolVersions) ||
        Object.values(command.toolVersions).some((value) => typeof value !== 'string')
      ) {
        reasons.push(`commands[${index}].toolVersions must be a string map`);
      }
      if (!isIsoDate(command.startedAt) || !isIsoDate(command.endedAt))
        reasons.push(`commands[${index}] timestamps are invalid`);
      if (command.exitCode !== null && (typeof command.exitCode !== 'number' || !Number.isInteger(command.exitCode))) {
        reasons.push(`commands[${index}].exitCode must be an integer or null`);
      }
      if (!OBSERVATIONS.includes(command.observation as EvidenceObservationStatus))
        reasons.push(`commands[${index}].observation is invalid`);
      if (typeof command.rawOutputSha256 !== 'string' || !HEX64_PATTERN.test(command.rawOutputSha256)) {
        reasons.push(`commands[${index}].rawOutputSha256 is invalid`);
      }
      if (
        command.observation === 'observed' &&
        (typeof command.exitCode !== 'number' || !Number.isInteger(command.exitCode))
      ) {
        reasons.push(`commands[${index}] observed result must have an exitCode`);
      }
      if (command.observation !== 'observed' && command.exitCode !== null) {
        reasons.push(`commands[${index}] unknown result must have exitCode=null`);
      }
    }
  }

  if (!isRecord(candidate.rollback)) reasons.push('rollback is required');
  else {
    if (
      typeof candidate.rollback.preChangeRevision !== 'string' ||
      !SHA40_PATTERN.test(candidate.rollback.preChangeRevision)
    )
      reasons.push('rollback.preChangeRevision is invalid');
    if (typeof candidate.rollback.command !== 'string' || candidate.rollback.command.length === 0)
      reasons.push('rollback.command is required');
    if (!isRelativePath(candidate.rollback.patchPath)) reasons.push('rollback.patchPath must be repository-relative');
    if (typeof candidate.rollback.owner !== 'string' || candidate.rollback.owner.length === 0)
      reasons.push('rollback.owner is required');
    if (typeof candidate.rollback.executable !== 'boolean') reasons.push('rollback.executable is required');
  }

  if (!isRecord(candidate.review)) reasons.push('review is required');
  else {
    if (!isStringArray(candidate.review.findings) || !isStringArray(candidate.review.unresolvedQuestions))
      reasons.push('review findings/questions must be string arrays');
    if (
      candidate.review.decision !== null &&
      !['approve', 'reject', 'defer', 'block', 'rollback'].includes(candidate.review.decision as string)
    )
      reasons.push('review.decision is invalid');
    if (
      candidate.review.humanDecision !== null &&
      !['approve', 'reject', 'defer'].includes(candidate.review.humanDecision as string)
    )
      reasons.push('review.humanDecision is invalid');
  }

  if (!Array.isArray(candidate.signatures)) reasons.push('signatures is required');
  else {
    for (const [index, signature] of candidate.signatures.entries()) {
      if (!isRecord(signature)) {
        reasons.push(`signatures[${index}] must be an object`);
        continue;
      }
      if (!['A', 'S', 'V', 'G', 'R', 'human'].includes(signature.role as string))
        reasons.push(`signatures[${index}].role is invalid`);
      for (const field of ['actor', 'event', 'provenanceRef']) {
        const value = recordValue(signature, field);
        if (typeof value !== 'string' || value === '') reasons.push(`signatures[${index}].${field} is required`);
      }
      if (typeof signature.scopeHash !== 'string' || !SHA256_PATTERN.test(signature.scopeHash))
        reasons.push(`signatures[${index}].scopeHash is invalid`);
      if (!isIsoDate(signature.signedAt)) reasons.push(`signatures[${index}].signedAt is invalid`);
    }
  }

  if (!isRecord(candidate.changeScope)) reasons.push('changeScope is required');
  else {
    if (
      !isStringArray(candidate.changeScope.files) ||
      candidate.changeScope.files.length === 0 ||
      candidate.changeScope.files.some((file) => !isRelativePath(file))
    )
      reasons.push('changeScope.files is invalid');
    if (!isStringArray(candidate.changeScope.symbols) || candidate.changeScope.symbols.length === 0)
      reasons.push('changeScope.symbols is invalid');
    if (typeof candidate.changeScope.scopeHash !== 'string' || !SHA256_PATTERN.test(candidate.changeScope.scopeHash))
      reasons.push('changeScope.scopeHash is invalid');
  }
  if (!isRelativePath(candidate.evidenceRef)) reasons.push('evidenceRef must be repository-relative');

  if (!isRecord(candidate.archive)) reasons.push('archive is required');
  else {
    if (!['not_archived', 'archived'].includes(candidate.archive.state as string))
      reasons.push('archive.state is invalid');
    if (candidate.archive.manifestPath !== null && !isRelativePath(candidate.archive.manifestPath))
      reasons.push('archive.manifestPath must be repository-relative or null');
    if (
      candidate.archive.contentHash !== null &&
      (typeof candidate.archive.contentHash !== 'string' || !HEX64_PATTERN.test(candidate.archive.contentHash))
    )
      reasons.push('archive.contentHash is invalid');
    if (!['not_reviewed', 'clean', 'blocked'].includes(candidate.archive.redactionStatus as string))
      reasons.push('archive.redactionStatus is invalid');
  }
  return reasons;
}

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
  return sortedLeft.every((item) => sortedRight.includes(item));
}

export function transitionCandidate(
  ledger: CodeHealthLedger,
  candidateId: string,
  event: LedgerEvent,
): CodeHealthLedger {
  const current = ledger.candidates.find((candidate) => candidate.candidateId === candidateId);
  if (!current) throw new Error(`transition candidate not found: ${candidateId}`);
  if (event.candidateId !== candidateId) throw new Error('transition candidateId mismatch');
  if (event.from !== current.status)
    throw new Error(`transition from ${String(event.from)} does not match ${current.status}`);
  if (!sameRevision(event.revision, current.revision)) throw new Error('transition revision is stale');
  if (ledger.events.some((existing) => existing.eventId === event.eventId))
    throw new Error(`transition eventId already exists: ${event.eventId}`);
  const previousEvent = ledger.events.at(-1);
  if (previousEvent && Date.parse(event.at) <= Date.parse(previousEvent.at))
    throw new Error('transition timestamp must be monotonic');
  if (!isIsoDate(event.at) || event.evidenceRefs.length === 0 || event.signatureRef.length === 0)
    throw new Error('transition evidence is incomplete');
  if (!NORMAL_TRANSITIONS[current.status].includes(event.to))
    throw new Error(`transition ${current.status} -> ${event.to} is not allowed`);
  if (event.to === 'rolled-back' && !event.evidenceRefs.some((ref) => /rollback|revert|patch/i.test(ref))) {
    throw new Error('transition rollback requires real evidence');
  }
  if (event.to === 'approved' && event.actorRole !== 'human') {
    throw new Error('transition approval requires a human actor');
  }

  const candidates = ledger.candidates.map((candidate) =>
    candidate.candidateId === candidateId
      ? {
          ...candidate,
          status: event.to,
          archive: event.to === 'archived' ? { ...candidate.archive, state: 'archived' as const } : candidate.archive,
        }
      : candidate,
  );
  return { ...ledger, candidates, events: [...ledger.events, event] };
}

export function validateApprovalScope(candidate: CodeHealthCandidate, approval: ApprovalDecision): string[] {
  const reasons: string[] = [];
  if (!isRecord(approval)) return ['approval must be an object'];
  if (approval.candidateId !== candidate.candidateId) reasons.push('approval candidateId does not match candidate');
  if (approval.approvedAction !== candidate.action) reasons.push('approval action does not match candidate');
  if (!sortedEqual(approval.approvedFiles, candidate.changeScope.files))
    reasons.push('approval files expand or shrink candidate scope');
  if (!sortedEqual(approval.approvedSymbols, candidate.changeScope.symbols))
    reasons.push('approval symbols expand or shrink candidate scope');
  if (approval.scopeHash !== candidate.changeScope.scopeHash)
    reasons.push('approval scopeHash does not match candidate');
  if (!['approve', 'reject', 'defer'].includes(approval.decision)) reasons.push('approval decision is invalid');
  if (approval.decision === 'approve' && candidate.status !== 'under-review')
    reasons.push('candidate must be under-review before approval');
  if (typeof approval.rationale !== 'string' || approval.rationale.length === 0)
    reasons.push('approval rationale is required');
  if (
    typeof approval.actor !== 'string' ||
    approval.actor.length === 0 ||
    approval.actor.toLowerCase().includes('agent')
  )
    reasons.push('approval actor must identify a human decision maker');
  if (!isIsoDate(approval.decidedAt)) reasons.push('approval decidedAt is invalid');
  if (typeof approval.signatureRef !== 'string' || approval.signatureRef.length === 0)
    reasons.push('approval signatureRef is required');
  return reasons;
}

export function canArchiveCandidate(candidate: CodeHealthCandidate, ledger: CodeHealthLedger): string[] {
  const reasons = validateCodeHealthCandidate(candidate);
  const ledgerCandidate = ledger.candidates.find((entry) => entry.candidateId === candidate.candidateId);
  if (!ledgerCandidate) reasons.push('candidate is not present in ledger');
  if (ledgerCandidate && !sameRevision(candidate.revision, ledger.baseline))
    reasons.push('candidate revision is stale');
  if (candidate.status !== 'verified') reasons.push('candidate is not verified');
  if (candidate.archive.redactionStatus !== 'clean' || ledger.redaction.status !== 'clean')
    reasons.push('archive redaction is not clean');
  if (!candidate.rollback.executable) reasons.push('rollback is not executable');
  if (candidate.review.decision !== 'approve' || candidate.review.humanDecision !== 'approve')
    reasons.push('human approval is missing');
  const roles = new Set(candidate.signatures.map((signature) => signature.role));
  for (const role of ['V', 'G', 'human'] as const) if (!roles.has(role)) reasons.push(`signature is missing: ${role}`);
  if (ledger.environmentMatrix.some((environment) => environment.supported && environment.observed !== 'observed'))
    reasons.push('required environment is not observed');
  if (ledger.events.some((event) => event.candidateId === candidate.candidateId && event.to === 'blocked'))
    reasons.push('candidate has a blocking event');
  return [...new Set(reasons)];
}
