/** Canonical code-health contract shared by every phase and schema boundary. */

import { containsSensitiveCodeHealthContent } from '../lib/code-health-redaction.js';

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

export const CODE_HEALTH_PHASES = ['P1', 'P2', 'P3', 'P4'] as const;
export const CODE_HEALTH_ACTIONS = ['delete-code', 'add-test', 'delete-test', 'abstract'] as const;
export const CODE_HEALTH_STATUSES = [
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
] as const;
export const EVIDENCE_OBSERVATIONS = ['observed', 'not_run', 'unavailable', 'unverified'] as const;

export type ErrorCode =
  | 'ARG_INVALID'
  | 'STRUCTURE_INVALID'
  | 'EVIDENCE_INVALID'
  | 'SCOPE_MISMATCH'
  | 'REVISION_MISMATCH'
  | 'SECURITY_BLOCKED'
  | 'ROLE_FORBIDDEN'
  | 'TRANSITION_INVALID'
  | 'NOT_IMPLEMENTED';

export interface CandidateSelector {
  candidateId: string;
  phase: CodeHealthPhase;
  action: CodeHealthAction;
  files: string[];
  symbols: string[];
  scopeHash: string;
}

export interface EvidenceBinding {
  candidate: CandidateSelector;
  revision: RevisionIdentity;
  rawOutputPath: string;
  rawOutputSha256: string;
}

/**
 * Canonical typed error, re-exported from the lib boundary so exactly one class is shared by the
 * injected file/evidence/revision implementations and the lifecycle.
 */
export { CodeHealthError } from '../lib/code-health-error.js';

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
  /** The actual child-process exit code; null means no process result was available. */
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
  patchSha256?: string;
}

export interface RollbackEvidence {
  command: CommandEvidence;
  preChangeRevision: string;
  patchPath: string;
  patchSha256: string;
  owner: string;
  patchExists: true;
  rawOutputExists: true;
  sourceRevision: RevisionIdentity;
}

export interface EvidenceValidationOptions {
  root?: string;
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
  evidenceBinding: EvidenceBinding;
  evidenceRef: string;
  archive: {
    state: 'not_archived' | 'archived';
    manifestPath: string | null;
    contentHash: string | null;
    redactionStatus: 'not_reviewed' | 'clean' | 'blocked';
  };
}

export interface ArchiveTransitionEvidence {
  manifestRef: string;
  manifestSha256: string;
  verificationLevel: 'package-only' | 'source-bound';
  sourceRevision: RevisionIdentity;
  redactionStatus: 'clean';
}

export interface GateFailureEvidence extends CommandEvidence {
  candidateId: string;
  scopeHash: string;
  failureKind: 'test' | 'gate' | 'command';
}

export type LedgerEventKind =
  | 'discovery'
  | 'evidence'
  | 'review'
  | 'approval'
  | 'implementation'
  | 'verification'
  | 'gate-failure'
  | 'root-cause'
  | 'root-cause-review'
  | 'root-cause-gate'
  | 'rework'
  | 'rollback'
  | 'archive';

/** Failure-chain event kinds that keep a blocked candidate blocked until R→V→G complete. */
export const ROOT_CAUSE_CHAIN_EVENT_KINDS = ['root-cause', 'root-cause-review', 'root-cause-gate'] as const;
export type RootCauseChainEventKind = (typeof ROOT_CAUSE_CHAIN_EVENT_KINDS)[number];

export interface LedgerEvent {
  eventId: string;
  eventKind: LedgerEventKind;
  candidateId: string;
  from: CodeHealthStatus | null;
  to: CodeHealthStatus;
  actorRole: 'O' | 'A' | 'S' | 'V' | 'G' | 'R' | 'human';
  at: string;
  previousRevision?: RevisionIdentity;
  revision: RevisionIdentity;
  scopeHash: string;
  evidenceRefs: string[];
  signatureRef: string;
  gateFailureEvidence?: GateFailureEvidence;
  rollbackEvidence?: RollbackEvidence;
  archiveEvidence?: ArchiveTransitionEvidence;
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
  revision: RevisionIdentity;
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
  redEvidence?: CommandEvidence;
  greenEvidence?: CommandEvidence;
  assertionHash?: string;
  implementationHash?: string | null;
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
  candidateId: string;
  implementations: Array<{ file: string; symbol: string; sourceHash: string }>;
  views: { ast: string[]; dataFlow: string[]; callGraph: string[]; signatures: string[]; tests: string[] };
  stableProductionCallSites: string[];
  status: 'under-review' | 'deferred' | 'rejected' | 'approved';
  equivalenceProof?: {
    inputsOutputs: string;
    orderingMutationsSideEffects: string;
    errorsRetries: string;
    lifecycleResources: string;
    security: string;
    concurrencyPlatforms: string;
    allDimensionsProven: true;
  };
  maintenanceBenefit?: string;
  rollback?: RollbackPlan;
  redaction?: { status: 'not_reviewed' | 'clean' | 'blocked'; reasons: string[] };
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
  evidenceBinding: EvidenceBinding;
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
    options: { cwd: string; env: Record<string, string>; timeoutMs: number; binding: EvidenceBinding },
  ): Promise<CommandEvidence>;
}

/** Result of verifying one repository-relative file; no partial success is ever returned. */
export interface FileVerificationResult {
  ok: boolean;
  code: ErrorCode | null;
  relativePath: string;
  expectedSha256: string;
  actualSha256?: string;
  reason?: string;
}

/** Injected file-safety boundary over an explicit repository root. */
export interface FileVerifier {
  verifyRegularNonSymlinkFile(input: {
    root: string;
    relativePath: string;
    expectedSha256: string;
  }): Promise<FileVerificationResult>;
}

/** Ref of one raw output that was exclusively created by the evidence store. */
export interface StoredEvidenceRef {
  evidenceId: string;
  candidateId: string;
  scopeHash: string;
  relativePath: string;
  sha256: string;
}

/** Stored evidence plus the revision and observation it claims. */
export interface EvidenceRef extends StoredEvidenceRef {
  revision: RevisionIdentity;
  observation: EvidenceObservationStatus;
}

export interface EvidenceVerificationResult {
  ok: boolean;
  code: ErrorCode | null;
  binding: EvidenceBinding;
  reason?: string;
}

/** Injected raw-output store: exclusive create and candidate/scope/revision binding. */
export interface EvidenceStore {
  putRawOutput(input: {
    candidateId: string;
    scopeHash: string;
    relativePath: string;
    bytes: Uint8Array;
  }): Promise<StoredEvidenceRef>;
  verify(ref: EvidenceRef, binding: EvidenceBinding): Promise<EvidenceVerificationResult>;
}

export interface RevisionVerificationResult {
  ok: boolean;
  code: 'REVISION_MISMATCH' | null;
  expected: RevisionIdentity;
  actual: RevisionIdentity | null;
  reason?: string;
}

/** Injected Git revision boundary: commit, tree, and source bundle must agree. */
export interface RevisionProvider {
  current(root: string): Promise<RevisionIdentity | null>;
  verify(root: string, expected: RevisionIdentity): Promise<RevisionVerificationResult>;
}

/** Injected file-safety boundary for lifecycle call sites that must prove declared repository files exist. */
export interface FileVerificationContext {
  repositoryRoot: string;
  fileVerifier: FileVerifier;
}

/** Injected evidence boundary that binds a candidate/scope/revision to a real stored raw output. */
export interface EvidenceVerificationContext extends FileVerificationContext {
  evidenceStore: EvidenceStore;
  binding: EvidenceBinding;
}

export interface Phase1RunResult {
  exitCode: 0 | 1 | 2;
  report: { candidates: CodeHealthCandidate[]; commands: CommandEvidence[]; unexercisedScenarios: string[] };
  changedFiles: string[];
}

export interface GapDiscoveryInput {
  requirements: unknown;
  publicContracts: unknown;
  branches: unknown;
  errors: unknown;
  securityProperties: unknown;
  concurrencyProperties: unknown;
  platforms: unknown;
  coverageSignal: { lines: number | null };
}
export interface GapDiscoveryResult {
  rows: GapRow[];
  coverageAuthorization: false;
}
export interface TddHarnessInput {
  gap: GapRow;
  /**
   * The owning candidate. CALLER-SUPPLIED: its `changeScope.files` / `tests` are used as the approved
   * target scope, so the harness is structurally consistent with whatever record the caller passes.
   * It is NOT unforgeable by itself (G-4) — the ledger, the G gate, and the role signature chain are the
   * authority, and a forged candidate record is out of scope for this pure structural check. Within that
   * scope, the implementation artifact must be one of `changeScope.files`, so an assertion/probe module
   * can never be relabelled as "the implementation" to exclude it from the assertion artifact set.
   */
  candidate: CodeHealthCandidate;
  /** Declared test artifact files (repository-relative, non-empty, exist on disk, disjoint from the implementation). */
  testArtifacts: string[];
  testCommand: string[];
  implementation: string | null;
}
export interface TddHarnessResult extends CommandEvidence {
  gapId: string;
  assertionHash: string;
  implementationHash: string | null;
  /** The declared test artifacts this run bound into `assertionHash` (sorted). */
  testArtifacts: string[];
  /** The approved implementation artifact excluded from `assertionHash`. */
  implementationArtifact: string;
}
export interface ApplyApprovedInput {
  candidate: CodeHealthCandidate;
  approval: ApprovalDecision;
  mode: 'dry-run' | 'patch' | 'commit';
  repositoryRoot: string;
  currentRevision: RevisionIdentity;
}

export interface ApplyResultNotImplemented {
  kind: 'not-implemented';
  applied: false;
  errorCode: 'NOT_IMPLEMENTED';
  patchPath: null;
  appliedFiles: [];
  unrelatedFiles: [];
  rollback: null;
}

export type ApplyMode = 'dry-run' | 'patch' | 'commit';

/**
 * Real, non-applying apply outcome: the exact approved scope resolved to one controlled patch path and an
 * executable rollback plan. `commit` plans are also represented here; the IO executor promotes them to
 * `ApplyCommitResult` only after the real patch/commit succeeded and the scope was read back.
 */
export interface ApplyProposalResult {
  kind: 'patch-proposal';
  applied: false;
  errorCode: null;
  mode: ApplyMode;
  patchPath: string;
  appliedFiles: [];
  unrelatedFiles: [];
  rollback: RollbackPlan;
}

/** A real commit that touched exactly `appliedFiles` (equal to the approved change scope). */
export interface ApplyCommitResult {
  kind: 'applied';
  applied: true;
  errorCode: null;
  mode: 'commit';
  patchPath: string;
  appliedFiles: string[];
  unrelatedFiles: [];
  rollback: RollbackPlan;
}

/** Fail-closed application result: nothing was applied and no success may be claimed. */
export interface ApplyBlockedResult {
  kind: 'blocked';
  applied: false;
  errorCode: ErrorCode;
  mode: ApplyMode;
  patchPath: string | null;
  appliedFiles: [];
  unrelatedFiles: [];
  rollback: RollbackPlan | null;
  reason: string;
}

export type ApplyResult = ApplyResultNotImplemented | ApplyProposalResult | ApplyCommitResult | ApplyBlockedResult;
export interface DeletionFacts {
  testCount: number;
  coverageProvenance: string;
  governanceFacts: string[];
  testCountDelta?: number;
}
export interface DeletionEvaluation {
  passed: boolean;
  violations: string[];
}
export interface ArchiveManifest {
  archiveId: string;
  candidateId: string;
  scope: CandidateSelector;
  contentHash: string;
  files: Array<{
    path: string;
    kind: 'ledger' | 'candidate' | 'evidence' | 'approval' | 'review' | 'gate' | 'rollback';
    sha256: string;
  }>;
  sourceRevision: RevisionIdentity;
  approvalRef: string;
  reviewRefs: string[];
  gateRefs: string[];
  humanSignatureRef: string;
  redaction: { status: 'clean' | 'blocked'; reasons: string[] };
  verificationLevel: 'package-only' | 'source-bound';
  rollbackRef: string;
  producerMetadata: { producerId: string; producerVersion: string };
  createdAt: string;
  /** Candidate terminal state this package records; a non-success state is never archived as passed. */
  archiveStatus: 'archived' | 'deferred' | 'rejected' | 'blocked' | 'rolled-back';
  /** True only when the candidate reached `verified` with every pass gate; terminal non-success stays false. */
  archivedAsPassed: boolean;
}

/**
 * Result of every Task 1D archive boundary entry point. Task 8 replaced the Task 1 typed
 * `NOT_IMPLEMENTED` stub with the real producer/consumer/verifier, so the success path carries the verified
 * manifest. Failures still resolve a typed `ErrorCode` with `manifest: null`; `NOT_IMPLEMENTED` remains a
 * valid fail-closed value so an unwired caller can never observe a fabricated success.
 */
export interface ArchiveBoundaryResult {
  ok: boolean;
  errorCode: ErrorCode | null;
  manifest: ArchiveManifest | null;
  verificationLevel: 'package-only' | 'source-bound';
  createdPaths: string[];
  /** 0 = produced/verified, 1 = fail-closed refusal, 2 = malformed input. */
  exitCode: 0 | 1 | 2;
  /** Absolute path of the archive package produced or verified; null when no package was involved. */
  path: string | null;
  /** True only when a verified-success candidate was archived; terminal non-success archives stay false. */
  archivedAsPassed: boolean;
  reason: string;
}

/** One declared source artifact copied into a campaign archive package. */
export interface ArchivePackageFile {
  /** Campaign-relative POSIX path of the declared artifact. */
  path: string;
  /** The archive artifact kind this source is retained as. */
  kind: 'ledger' | 'candidate' | 'evidence' | 'approval' | 'review' | 'gate' | 'rollback';
}

export interface ArchiveProduceInput {
  candidate: CodeHealthCandidate;
  ledger: CodeHealthLedger;
  approval: ApprovalDecision;
  verificationLevel: 'package-only' | 'source-bound';
  /** Explicit root that owns every declared source artifact; no implicit cwd fallback. */
  campaignRoot: string;
  /** Explicit root the archive package is written beneath (created by the producer). */
  packageRoot: string;
  /** Declared source artifacts; never inferred from prose. */
  sources: ArchivePackageFile[];
  /** Explicit source project required to establish a source-bound revision. */
  sourceProject?: string;
}

export interface ArchiveConsumeInput {
  manifestPath: string;
  packageRoot: string;
  verificationLevel: 'package-only' | 'source-bound';
  sourceProject?: string;
}

export interface ArchiveVerifyInput extends ArchiveConsumeInput {
  expectedRevision?: RevisionIdentity;
}

export interface EvalDiffInput {
  changedBehavior: boolean;
  prompts: unknown[];
  mappings: unknown;
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
const REVIEW_DECISIONS: readonly ReviewDecision[] = ['approve', 'reject', 'defer', 'block', 'rollback'];
const HUMAN_DECISIONS = ['approve', 'reject', 'defer'] as const;
const LEDGER_EVENT_KINDS: readonly LedgerEventKind[] = [
  'discovery',
  'evidence',
  'review',
  'approval',
  'implementation',
  'verification',
  'gate-failure',
  'root-cause',
  'root-cause-review',
  'root-cause-gate',
  'rework',
  'rollback',
  'archive',
];
const STATIC_REFERENCE_KINDS: readonly StaticReference['kind'][] = [
  'import',
  'export',
  'call',
  'route',
  'cli-registration',
  'string-symbol',
  'generated-input',
  'schema',
  'template',
  'rtm',
  'test-helper',
  'dynamic-import',
  'reflection',
  'shell-platform',
];

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

export function isRelativePath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !value.startsWith('/') &&
    !/^[A-Za-z]:[\\/]/.test(value) &&
    !value.includes('\\') &&
    !value.includes('//') &&
    !value.includes('\u0000') &&
    !value.split('/').includes('..') &&
    !value.split('/').includes('')
  );
}

export function isIsoDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  field: string,
  reasons: string[],
): boolean {
  const allowed = new Set(keys);
  let valid = true;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      reasons.push(`${field} has unknown property: ${key}`);
      valid = false;
    }
  }
  return valid;
}

function isSafeCommand(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !/[;&|<>\r\n]/.test(value);
}

function hasSecretFieldName(fieldName: string): boolean {
  return /(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|authorization)/i.test(fieldName);
}

/** Audited environment map: credential-bearing key names and sensitive values are rejected. */
function isAuditedEnvironmentMap(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => !hasSecretFieldName(key)) &&
    Object.values(value).every((item) => typeof item === 'string' && !containsSensitiveCodeHealthContent(item))
  );
}

export function validateRevision(value: unknown, field: string, reasons: string[]): value is RevisionIdentity {
  if (!isRecord(value)) {
    reasons.push(`${field} must be an object`);
    return false;
  }
  hasOnlyKeys(value, ['commitSha', 'treeSha', 'sourceBundleSha256', 'analyzedAt'], field, reasons);
  if (typeof value.commitSha !== 'string' || !SHA40_PATTERN.test(value.commitSha))
    reasons.push(`${field}.commitSha is invalid`);
  if (typeof value.treeSha !== 'string' || !SHA40_PATTERN.test(value.treeSha))
    reasons.push(`${field}.treeSha is invalid`);
  if (typeof value.sourceBundleSha256 !== 'string' || !HEX64_PATTERN.test(value.sourceBundleSha256))
    reasons.push(`${field}.sourceBundleSha256 is invalid`);
  if (!isIsoDate(value.analyzedAt)) reasons.push(`${field}.analyzedAt is invalid`);
  return reasons.length === 0;
}

export function validateCandidateSelector(
  value: unknown,
  field: string,
  reasons: string[],
): value is CandidateSelector {
  if (!isRecord(value)) {
    reasons.push(`${field} must be an object`);
    return false;
  }
  hasOnlyKeys(value, ['candidateId', 'phase', 'action', 'files', 'symbols', 'scopeHash'], field, reasons);
  if (typeof value.candidateId !== 'string' || !ID_PATTERN.test(value.candidateId))
    reasons.push(`${field}.candidateId is invalid`);
  if (!PHASES.includes(value.phase as CodeHealthPhase)) reasons.push(`${field}.phase is invalid`);
  if (!ACTIONS.includes(value.action as CodeHealthAction)) reasons.push(`${field}.action is invalid`);
  if (!isStringArray(value.files, false) || value.files.some((item) => !isRelativePath(item)))
    reasons.push(`${field}.files must be non-empty repository-relative paths`);
  if (!isStringArray(value.symbols, false)) reasons.push(`${field}.symbols must be a non-empty string array`);
  if (typeof value.scopeHash !== 'string' || !SHA256_PATTERN.test(value.scopeHash))
    reasons.push(`${field}.scopeHash is invalid`);
  return reasons.length === 0;
}

export function validateEvidenceBinding(
  value: unknown,
  field: string,
  reasons: string[],
  expectedCandidate?: CandidateSelector,
  expectedRevision?: RevisionIdentity,
): value is EvidenceBinding {
  if (!isRecord(value)) {
    reasons.push(`${field} is required`);
    return false;
  }
  hasOnlyKeys(value, ['candidate', 'revision', 'rawOutputPath', 'rawOutputSha256'], field, reasons);
  const selectorReasons: string[] = [];
  const selectorValid = validateCandidateSelector(value.candidate, `${field}.candidate`, selectorReasons);
  reasons.push(...selectorReasons);
  const revisionReasons: string[] = [];
  const revisionValid = validateRevision(value.revision, `${field}.revision`, revisionReasons);
  reasons.push(...revisionReasons);
  if (!isRelativePath(value.rawOutputPath)) reasons.push(`${field}.rawOutputPath must be repository-relative`);
  if (typeof value.rawOutputSha256 !== 'string' || !HEX64_PATTERN.test(value.rawOutputSha256))
    reasons.push(`${field}.rawOutputSha256 is invalid`);
  if (selectorValid && expectedCandidate && isRecord(value.candidate)) {
    if (value.candidate.candidateId !== expectedCandidate.candidateId) reasons.push(`${field}.candidateId mismatch`);
    if (value.candidate.scopeHash !== expectedCandidate.scopeHash) reasons.push(`${field}.scopeHash mismatch`);
  }
  if (revisionValid && expectedRevision && !sameRevisionIdentity(value.revision as RevisionIdentity, expectedRevision))
    reasons.push(`${field}.revision mismatch`);
  return reasons.length === 0;
}

function sameRevisionIdentity(left: RevisionIdentity, right: RevisionIdentity): boolean {
  return (
    left.commitSha === right.commitSha &&
    left.treeSha === right.treeSha &&
    left.sourceBundleSha256 === right.sourceBundleSha256
  );
}

export function validateRollbackEvidenceRecord(
  value: unknown,
  field: string,
  reasons: string[],
): value is RollbackEvidence {
  if (!isRecord(value)) {
    reasons.push(`${field} must be an object`);
    return false;
  }
  const localReasons: string[] = [];
  hasOnlyKeys(
    value,
    [
      'command',
      'preChangeRevision',
      'patchPath',
      'patchSha256',
      'owner',
      'patchExists',
      'rawOutputExists',
      'sourceRevision',
    ],
    field,
    localReasons,
  );
  validateCommandEvidence(value.command, `${field}.command`, localReasons);
  if (typeof value.preChangeRevision !== 'string' || !SHA40_PATTERN.test(value.preChangeRevision))
    localReasons.push(`${field}.preChangeRevision is invalid`);
  if (!isRelativePath(value.patchPath)) localReasons.push(`${field}.patchPath must be repository-relative`);
  if (typeof value.patchSha256 !== 'string' || !HEX64_PATTERN.test(value.patchSha256))
    localReasons.push(`${field}.patchSha256 is invalid`);
  if (typeof value.owner !== 'string' || value.owner.length === 0) localReasons.push(`${field}.owner is required`);
  if (value.patchExists !== true) localReasons.push(`${field}.patchExists must be true`);
  if (value.rawOutputExists !== true) localReasons.push(`${field}.rawOutputExists must be true`);
  validateRevision(value.sourceRevision, `${field}.sourceRevision`, localReasons);
  reasons.push(...localReasons);
  return localReasons.length === 0;
}

export function validateArchiveTransitionEvidence(
  value: unknown,
  field: string,
  reasons: string[],
): value is ArchiveTransitionEvidence {
  if (!isRecord(value)) {
    reasons.push(`${field} must be an object`);
    return false;
  }
  const localReasons: string[] = [];
  hasOnlyKeys(
    value,
    ['manifestRef', 'manifestSha256', 'verificationLevel', 'sourceRevision', 'redactionStatus'],
    field,
    localReasons,
  );
  if (!isRelativePath(value.manifestRef)) localReasons.push(`${field}.manifestRef must be repository-relative`);
  if (typeof value.manifestSha256 !== 'string' || !HEX64_PATTERN.test(value.manifestSha256))
    localReasons.push(`${field}.manifestSha256 is invalid`);
  if (value.verificationLevel !== 'package-only' && value.verificationLevel !== 'source-bound') {
    localReasons.push(`${field}.verificationLevel is invalid`);
  }
  validateRevision(value.sourceRevision, `${field}.sourceRevision`, localReasons);
  if (value.redactionStatus !== 'clean') localReasons.push(`${field}.redactionStatus must be clean`);
  reasons.push(...localReasons);
  return localReasons.length === 0;
}

function validateCoverage(value: unknown, field: string, reasons: string[]): boolean {
  if (!isRecord(value)) {
    reasons.push(`${field} is required`);
    return false;
  }
  hasOnlyKeys(value, ['statements', 'branches', 'functions', 'lines'], field, reasons);
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
  hasOnlyKeys(
    value,
    [
      'rtmBefore',
      'rtmAfter',
      'coverageBefore',
      'coverageAfter',
      'testLevels',
      'unmappedScenarios',
      'coverageIsSignalOnly',
    ],
    field,
    reasons,
  );
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

export function validateCommandEvidence(value: unknown, field: string, reasons: string[]): value is CommandEvidence {
  if (!isRecord(value)) {
    reasons.push(`${field} must be an object`);
    return false;
  }
  hasOnlyKeys(
    value,
    [
      'command',
      'cwd',
      'environment',
      'platform',
      'toolVersions',
      'startedAt',
      'endedAt',
      'exitCode',
      'observation',
      'rawOutputPath',
      'rawOutputSha256',
    ],
    field,
    reasons,
  );
  if (!isSafeCommand(value.command)) reasons.push(`${field}.command is unsafe`);
  if (typeof value.platform !== 'string' || value.platform.length === 0) reasons.push(`${field}.platform is required`);
  if (!isRelativePath(value.cwd)) reasons.push(`${field}.cwd must be repository-relative`);
  if (!isRelativePath(value.rawOutputPath)) reasons.push(`${field}.rawOutputPath must be repository-relative`);
  if (!isAuditedEnvironmentMap(value.environment)) reasons.push(`${field}.environment is not audited and redacted`);
  if (!isRecord(value.toolVersions) || Object.values(value.toolVersions).some((item) => typeof item !== 'string'))
    reasons.push(`${field}.toolVersions must be a string map`);
  if (
    !isIsoDate(value.startedAt) ||
    !isIsoDate(value.endedAt) ||
    Date.parse(value.endedAt as string) < Date.parse(value.startedAt as string)
  )
    reasons.push(`${field} timestamps are invalid`);
  if (!OBSERVATIONS.includes(value.observation as EvidenceObservationStatus))
    reasons.push(`${field}.observation is invalid`);
  if (
    value.exitCode !== null &&
    (typeof value.exitCode !== 'number' || !Number.isInteger(value.exitCode) || value.exitCode < 0)
  )
    reasons.push(`${field}.exitCode must be null or a non-negative integer`);
  if (typeof value.rawOutputSha256 !== 'string' || !HEX64_PATTERN.test(value.rawOutputSha256))
    reasons.push(`${field}.rawOutputSha256 is invalid`);
  if (value.observation === 'observed' && (typeof value.exitCode !== 'number' || value.exitCode < 0))
    reasons.push(`${field} observed result must have an exitCode`);
  if (value.observation !== 'observed' && value.exitCode !== null)
    reasons.push(`${field} unknown result must have exitCode=null`);
  return reasons.length === 0;
}

function validateStaticReference(value: unknown, field: string, reasons: string[]): boolean {
  if (!isRecord(value)) {
    reasons.push(`${field} must be an object`);
    return false;
  }
  hasOnlyKeys(value, ['path', 'symbol', 'consumer', 'kind', 'line', 'sourceHash'], field, reasons);
  if (!isRelativePath(value.path)) reasons.push(`${field}.path must be repository-relative`);
  if (typeof value.symbol !== 'string' || value.symbol.length === 0) reasons.push(`${field}.symbol is required`);
  if (typeof value.consumer !== 'string' || value.consumer.length === 0) reasons.push(`${field}.consumer is required`);
  if (!STATIC_REFERENCE_KINDS.includes(value.kind as StaticReference['kind'])) reasons.push(`${field}.kind is invalid`);
  if (typeof value.line !== 'number' || !Number.isInteger(value.line) || value.line < 1)
    reasons.push(`${field}.line must be a positive integer`);
  if (typeof value.sourceHash !== 'string' || !HEX64_PATTERN.test(value.sourceHash))
    reasons.push(`${field}.sourceHash is invalid`);
  return true;
}

function validateDynamicScenario(value: unknown, field: string, reasons: string[]): boolean {
  if (!isRecord(value)) {
    reasons.push(`${field} must be an object`);
    return false;
  }
  hasOnlyKeys(value, ['id', 'environment', 'reached', 'observation', 'command'], field, reasons);
  if (typeof value.id !== 'string' || value.id.length === 0) reasons.push(`${field}.id is required`);
  if (typeof value.environment !== 'string' || value.environment.length === 0)
    reasons.push(`${field}.environment is required`);
  if (value.reached !== null && typeof value.reached !== 'boolean') reasons.push(`${field}.reached is invalid`);
  if (!OBSERVATIONS.includes(value.observation as EvidenceObservationStatus))
    reasons.push(`${field}.observation is invalid`);
  validateCommandEvidence(value.command, `${field}.command`, reasons);
  return true;
}

/** Runtime mirror of code-health-evidence.schema.json, including the audited environment parity. */
export function validateCodeHealthEvidence(value: unknown): string[] {
  const reasons: string[] = [];
  if (!isRecord(value)) return ['evidence must be an object'];
  hasOnlyKeys(
    value,
    [
      'evidenceId',
      'candidateId',
      'evidenceBinding',
      'revision',
      'staticReferences',
      'dynamicScenarios',
      'commands',
      'environment',
      'toolVersions',
      'unknowns',
      'falsePositiveChecks',
      'rtmImpact',
      'coverageImpact',
      'redaction',
    ],
    'evidence',
    reasons,
  );
  if (typeof value.evidenceId !== 'string' || value.evidenceId.length === 0)
    reasons.push('evidence.evidenceId is required');
  if (typeof value.candidateId !== 'string' || !ID_PATTERN.test(value.candidateId))
    reasons.push('evidence.candidateId is invalid');
  validateEvidenceBinding(value.evidenceBinding, 'evidence.evidenceBinding', reasons);
  validateRevision(value.revision, 'evidence.revision', reasons);
  if (!Array.isArray(value.staticReferences)) reasons.push('evidence.staticReferences must be an array');
  else
    for (const [index, reference] of value.staticReferences.entries())
      validateStaticReference(reference, `evidence.staticReferences[${index}]`, reasons);
  if (!Array.isArray(value.dynamicScenarios)) reasons.push('evidence.dynamicScenarios must be an array');
  else
    for (const [index, scenario] of value.dynamicScenarios.entries())
      validateDynamicScenario(scenario, `evidence.dynamicScenarios[${index}]`, reasons);
  if (!Array.isArray(value.commands) || value.commands.length === 0)
    reasons.push('evidence.commands must be a non-empty array');
  else
    for (const [index, command] of value.commands.entries())
      validateCommandEvidence(command, `evidence.commands[${index}]`, reasons);
  if (!isAuditedEnvironmentMap(value.environment)) reasons.push('evidence.environment is not audited and redacted');
  if (!isRecord(value.toolVersions) || Object.values(value.toolVersions).some((item) => typeof item !== 'string'))
    reasons.push('evidence.toolVersions must be a string map');
  if (!isStringArray(value.unknowns) || value.unknowns.some((item) => item.length === 0))
    reasons.push('evidence.unknowns must be a string array');
  if (!isStringArray(value.falsePositiveChecks, false) || value.falsePositiveChecks.some((item) => item.length === 0))
    reasons.push('evidence.falsePositiveChecks must be a non-empty string array');
  if (value.rtmImpact !== undefined) validateImpact(value.rtmImpact, 'evidence.rtmImpact', reasons);
  if (value.coverageImpact !== undefined) validateImpact(value.coverageImpact, 'evidence.coverageImpact', reasons);
  if (!isRecord(value.redaction)) reasons.push('evidence.redaction is required');
  else {
    hasOnlyKeys(value.redaction, ['status', 'reasons'], 'evidence.redaction', reasons);
    if (!['not_reviewed', 'clean', 'blocked'].includes(value.redaction.status as string))
      reasons.push('evidence.redaction.status is invalid');
    if (!isStringArray(value.redaction.reasons)) reasons.push('evidence.redaction.reasons must be a string array');
  }
  return reasons;
}

export function validateLedgerEvent(value: unknown, field = 'event'): string[] {
  const reasons: string[] = [];
  if (!isRecord(value)) return [`${field} must be an object`];
  hasOnlyKeys(
    value,
    [
      'eventId',
      'eventKind',
      'candidateId',
      'from',
      'to',
      'actorRole',
      'at',
      'previousRevision',
      'revision',
      'scopeHash',
      'evidenceRefs',
      'signatureRef',
      'gateFailureEvidence',
      'rollbackEvidence',
      'archiveEvidence',
    ],
    field,
    reasons,
  );
  if (typeof value.eventId !== 'string' || value.eventId.length === 0) reasons.push(`${field}.eventId is required`);
  if (!LEDGER_EVENT_KINDS.includes(value.eventKind as LedgerEventKind)) reasons.push(`${field}.eventKind is invalid`);
  if (typeof value.candidateId !== 'string' || !ID_PATTERN.test(value.candidateId))
    reasons.push(`${field}.candidateId is invalid`);
  if (value.from !== null && !STATUSES.includes(value.from as CodeHealthStatus))
    reasons.push(`${field}.from is invalid`);
  if (!STATUSES.includes(value.to as CodeHealthStatus)) reasons.push(`${field}.to is invalid`);
  if (!['O', 'A', 'S', 'V', 'G', 'R', 'human'].includes(value.actorRole as string))
    reasons.push(`${field}.actorRole is invalid`);
  if (!isIsoDate(value.at)) reasons.push(`${field}.at is invalid`);
  if (value.previousRevision !== undefined)
    validateRevision(value.previousRevision, `${field}.previousRevision`, reasons);
  validateRevision(value.revision, `${field}.revision`, reasons);
  if (typeof value.scopeHash !== 'string' || !SHA256_PATTERN.test(value.scopeHash))
    reasons.push(`${field}.scopeHash is invalid`);
  if (!isStringArray(value.evidenceRefs, false) || value.evidenceRefs.some((item) => !isRelativePath(item)))
    reasons.push(`${field}.evidenceRefs must be non-empty repository-relative paths`);
  if (!isRelativePath(value.signatureRef)) reasons.push(`${field}.signatureRef must be repository-relative`);
  if (value.eventKind === 'implementation') {
    if (value.to !== 'implemented') reasons.push(`${field}.implementation must target implemented`);
    if (value.previousRevision === undefined) reasons.push(`${field}.implementation requires previousRevision`);
  } else if (value.previousRevision !== undefined) {
    reasons.push(`${field}.previousRevision is only valid for implementation events`);
  }
  const rootCauseChainKind = (ROOT_CAUSE_CHAIN_EVENT_KINDS as readonly string[]).includes(value.eventKind as string);
  if (value.eventKind === 'gate-failure' && value.to !== 'blocked')
    reasons.push(`${field}.gate-failure must target blocked`);
  if (value.eventKind === 'gate-failure' && value.gateFailureEvidence === undefined)
    reasons.push(`${field}.gate-failure requires gateFailureEvidence`);
  if (value.eventKind === 'archive' && value.to !== 'archived') reasons.push(`${field}.archive must target archived`);
  if (rootCauseChainKind && value.to !== 'blocked')
    reasons.push(`${field}.${String(value.eventKind)} must target blocked`);
  if (value.eventKind === 'rework' && value.to !== 'evidenced') reasons.push(`${field}.rework must target evidenced`);
  if (value.to === 'blocked' && !rootCauseChainKind && value.gateFailureEvidence === undefined)
    reasons.push(`${field}.blocked transition requires gateFailureEvidence`);
  if ((value.to === 'archived' || value.eventKind === 'archive') && value.archiveEvidence === undefined) {
    reasons.push(`${field}.archive transition requires archiveEvidence`);
  }
  if (value.to === 'rolled-back' && value.rollbackEvidence === undefined)
    reasons.push(`${field}.rollback transition requires rollbackEvidence`);
  if (value.rollbackEvidence !== undefined)
    validateRollbackEvidenceRecord(value.rollbackEvidence, `${field}.rollbackEvidence`, reasons);
  if (value.archiveEvidence !== undefined)
    validateArchiveTransitionEvidence(value.archiveEvidence, `${field}.archiveEvidence`, reasons);
  if (value.gateFailureEvidence !== undefined) {
    if (!isRecord(value.gateFailureEvidence)) reasons.push(`${field}.gateFailureEvidence must be an object`);
    else {
      const gateFailure = { ...value.gateFailureEvidence };
      delete gateFailure.candidateId;
      delete gateFailure.scopeHash;
      delete gateFailure.failureKind;
      validateCommandEvidence(gateFailure, `${field}.gateFailureEvidence`, reasons);
      if (
        typeof value.gateFailureEvidence.candidateId !== 'string' ||
        !ID_PATTERN.test(value.gateFailureEvidence.candidateId)
      )
        reasons.push(`${field}.gateFailureEvidence.candidateId is invalid`);
      if (
        typeof value.gateFailureEvidence.scopeHash !== 'string' ||
        !SHA256_PATTERN.test(value.gateFailureEvidence.scopeHash)
      )
        reasons.push(`${field}.gateFailureEvidence.scopeHash is invalid`);
      if (!['test', 'gate', 'command'].includes(value.gateFailureEvidence.failureKind as string))
        reasons.push(`${field}.gateFailureEvidence.failureKind is invalid`);
    }
  }
  return reasons;
}

export function validateCodeHealthCandidate(candidate: unknown): string[] {
  const reasons: string[] = [];
  if (!isRecord(candidate)) return ['candidate must be an object'];
  hasOnlyKeys(
    candidate,
    [
      'candidateId',
      'phase',
      'action',
      'status',
      'files',
      'symbols',
      'tests',
      'callSites',
      'sources',
      'commands',
      'revision',
      'confidence',
      'risk',
      'rtmImpact',
      'coverageImpact',
      'rollback',
      'review',
      'signatures',
      'changeScope',
      'evidenceBinding',
      'evidenceRef',
      'archive',
    ],
    'candidate',
    reasons,
  );
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
    hasOnlyKeys(candidate.confidence, ['level', 'score', 'rationale', 'uncertainties'], 'confidence', reasons);
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
    hasOnlyKeys(
      candidate.risk,
      ['severity', 'behavior', 'security', 'concurrency', 'platform', 'lifecycle', 'governance', 'rationale'],
      'risk',
      reasons,
    );
    const riskEnums: Record<string, readonly string[]> = {
      severity: ['low', 'medium', 'high', 'critical'],
      behavior: ['none', 'low', 'medium', 'high', 'unknown'],
      security: ['none', 'low', 'medium', 'high', 'unknown'],
      concurrency: ['none', 'low', 'medium', 'high', 'unknown'],
      platform: ['none', 'low', 'medium', 'high', 'unknown'],
      lifecycle: ['none', 'low', 'medium', 'high', 'unknown'],
      governance: ['none', 'low', 'medium', 'high', 'unknown'],
    };
    for (const [field, allowed] of Object.entries(riskEnums)) {
      const value = recordValue(candidate.risk, field);
      if (typeof value !== 'string' || !allowed.includes(value)) reasons.push(`risk.${field} is invalid`);
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
      hasOnlyKeys(
        command,
        [
          'command',
          'cwd',
          'environment',
          'platform',
          'toolVersions',
          'startedAt',
          'endedAt',
          'exitCode',
          'observation',
          'rawOutputPath',
          'rawOutputSha256',
        ],
        `commands[${index}]`,
        reasons,
      );
      for (const field of ['command', 'cwd', 'platform', 'rawOutputPath', 'rawOutputSha256']) {
        const value = recordValue(command, field);
        if (typeof value !== 'string' || value === '') reasons.push(`commands[${index}].${field} is required`);
      }
      if (!isSafeCommand(command.command)) reasons.push(`commands[${index}].command contains unsafe shell syntax`);
      if (!isRelativePath(command.cwd)) reasons.push(`commands[${index}].cwd must be repository-relative`);
      if (!isRelativePath(command.rawOutputPath))
        reasons.push(`commands[${index}].rawOutputPath must be repository-relative`);
      if (!isAuditedEnvironmentMap(command.environment)) {
        reasons.push(`commands[${index}].environment must be an audited redacted string map`);
      }
      if (
        !isRecord(command.toolVersions) ||
        Object.values(command.toolVersions).some((value) => typeof value !== 'string')
      ) {
        reasons.push(`commands[${index}].toolVersions must be a string map`);
      }
      if (
        !isIsoDate(command.startedAt) ||
        !isIsoDate(command.endedAt) ||
        Date.parse(command.endedAt) < Date.parse(command.startedAt)
      )
        reasons.push(`commands[${index}] timestamps are invalid`);
      if (
        command.exitCode !== null &&
        (typeof command.exitCode !== 'number' || !Number.isInteger(command.exitCode) || command.exitCode < 0)
      ) {
        reasons.push(`commands[${index}].exitCode must be a non-negative integer or null`);
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
    hasOnlyKeys(
      candidate.rollback,
      ['preChangeRevision', 'command', 'patchPath', 'owner', 'executable', 'patchSha256'],
      'rollback',
      reasons,
    );
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
    if (
      candidate.rollback.patchSha256 !== undefined &&
      (typeof candidate.rollback.patchSha256 !== 'string' || !HEX64_PATTERN.test(candidate.rollback.patchSha256))
    )
      reasons.push('rollback.patchSha256 is invalid');
  }

  if (!isRecord(candidate.review)) reasons.push('review is required');
  else {
    hasOnlyKeys(candidate.review, ['findings', 'unresolvedQuestions', 'decision', 'humanDecision'], 'review', reasons);
    if (!isStringArray(candidate.review.findings) || !isStringArray(candidate.review.unresolvedQuestions))
      reasons.push('review findings/questions must be string arrays');
    if (candidate.review.decision !== null && !REVIEW_DECISIONS.includes(candidate.review.decision as ReviewDecision))
      reasons.push('review.decision is invalid');
    if (
      candidate.review.humanDecision !== null &&
      !HUMAN_DECISIONS.includes(candidate.review.humanDecision as (typeof HUMAN_DECISIONS)[number])
    )
      reasons.push('review.humanDecision is invalid');
    if (
      candidate.status === 'discovered' &&
      (candidate.review.decision !== null || candidate.review.humanDecision !== null)
    )
      reasons.push('discovered candidate cannot carry a review or human conclusion');
  }

  if (!Array.isArray(candidate.signatures)) reasons.push('signatures is required');
  else {
    for (const [index, signature] of candidate.signatures.entries()) {
      if (!isRecord(signature)) {
        reasons.push(`signatures[${index}] must be an object`);
        continue;
      }
      hasOnlyKeys(
        signature,
        ['role', 'actor', 'event', 'scopeHash', 'provenanceRef', 'signedAt'],
        `signatures[${index}]`,
        reasons,
      );
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
    hasOnlyKeys(candidate.changeScope, ['files', 'symbols', 'scopeHash'], 'changeScope', reasons);
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
  const candidateSelector: CandidateSelector = {
    candidateId: typeof candidate.candidateId === 'string' ? candidate.candidateId : '',
    phase: candidate.phase as CodeHealthPhase,
    action: candidate.action as CodeHealthAction,
    files: Array.isArray(candidate.files) ? (candidate.files as string[]) : [],
    symbols: Array.isArray(candidate.symbols) ? (candidate.symbols as string[]) : [],
    scopeHash:
      isRecord(candidate.changeScope) && typeof candidate.changeScope.scopeHash === 'string'
        ? candidate.changeScope.scopeHash
        : '',
  };
  validateEvidenceBinding(
    candidate.evidenceBinding,
    'candidate.evidenceBinding',
    reasons,
    candidateSelector,
    candidate.revision as RevisionIdentity,
  );

  if (!isRecord(candidate.archive)) reasons.push('archive is required');
  else {
    hasOnlyKeys(candidate.archive, ['state', 'manifestPath', 'contentHash', 'redactionStatus'], 'archive', reasons);
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
    if (
      candidate.status === 'archived' &&
      (candidate.archive.state !== 'archived' ||
        !isRelativePath(candidate.archive.manifestPath) ||
        typeof candidate.archive.contentHash !== 'string' ||
        !HEX64_PATTERN.test(candidate.archive.contentHash) ||
        candidate.archive.redactionStatus !== 'clean')
    )
      reasons.push('archived candidate requires archived state, manifest, content hash, and clean redaction');
    if (candidate.status !== 'archived' && candidate.archive.state === 'archived')
      reasons.push('only archived candidates may carry archived archive state');
  }
  return reasons;
}
