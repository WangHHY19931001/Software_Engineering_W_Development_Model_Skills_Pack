/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection, security/detect-unsafe-regex -- Archive paths are validated as repository-relative; dynamic keys are fixed allowlists; regexes validate bounded contract values. */
/** Deterministic contracts and lifecycle rules for code-health campaign artifacts. */

import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync, promises as fs } from 'node:fs';
import * as path from 'node:path';

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
  patchSha256?: string;
  owner: string;
  patchExists: boolean;
  rawOutputExists: boolean;
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

export interface ArchiveTransitionEvidence {
  candidateId: string;
  scope: { files: string[]; symbols: string[]; scopeHash: string };
  approval: ApprovalDecision;
  commands: CommandEvidence[];
  manifest: {
    path: string;
    files: Array<{ path: string; sha256: string }>;
    contentHash: string;
    redaction: { status: 'clean'; reasons: string[] };
    verificationLevel: 'package-only' | 'source-bound';
  };
  rollback: RollbackEvidence;
  sourceRevision: RevisionIdentity;
  signatures: { verifier: string; gate: string; human: string };
}

export interface GateFailureEvidence extends CommandEvidence {
  candidateId: string;
  failureKind: 'test' | 'gate' | 'command';
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
  testCommand: string[];
  implementation: string | null;
}
export interface TddHarnessResult extends CommandEvidence {
  gapId: string;
  assertionHash: string;
  implementationHash: string | null;
}
export interface ApplyApprovedInput {
  approval: ApprovalDecision;
  candidate: CodeHealthCandidate;
  mode: 'patch' | 'commit' | 'dry-run';
}
export interface ApplyResult {
  patchPath: string;
  applied: boolean;
  appliedFiles: string[];
  unrelatedFiles: string[];
  rollback: RollbackPlan;
}
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
export interface ArchiveResult {
  exitCode: 0 | 1 | 2;
  path: string;
  manifest: CodeHealthArchiveManifest | null;
  verificationLevel: 'package-only' | 'source-bound';
  reason?: string;
}
export interface CodeHealthArchiveManifest {
  archiveId: string;
  candidateId: string;
  ledger: CodeHealthLedger;
  approval: ApprovalDecision;
  files: Array<{ path: string; sha256: string }>;
  contentHash: string;
  redaction: { status: 'clean'; reasons: string[] };
  sourceRevision: RevisionIdentity;
  verificationLevel: 'package-only' | 'source-bound';
}
export interface EvalDiffInput {
  changedBehavior: boolean;
  prompts: unknown[];
  mappings: unknown;
}
export interface VerifyArchiveOptions {
  root?: string;
  sourceProject?: string;
}
export interface ArchiveCampaignOptions {
  root?: string;
  outputDir?: string;
  approval?: ApprovalDecision;
  verificationLevel?: 'package-only' | 'source-bound';
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
    !value.includes('//') &&
    !value.includes('\u0000') &&
    !value.split('/').includes('..') &&
    !value.split('/').includes('')
  );
}

function isIsoDate(value: unknown): value is string {
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

function resolveWithinRoot(root: string, relativePath: string): string | null {
  if (!isRelativePath(relativePath)) return null;
  const rootPath = path.resolve(root);
  const resolved = path.resolve(rootPath, relativePath);
  const relative = path.relative(rootPath, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
  return resolved;
}

function verifyLocalFile(root: string, relativePath: string, expectedHash?: string): boolean {
  const resolved = resolveWithinRoot(root, relativePath);
  if (!resolved || !existsSync(resolved)) return false;
  try {
    const stat = lstatSync(resolved);
    if (!stat.isFile() || path.resolve(realpathSync(resolved)) !== path.resolve(resolved)) return false;
    const actualHash = createHash('sha256').update(readFileSync(resolved)).digest('hex');
    return expectedHash === undefined || actualHash === expectedHash;
  } catch {
    return false;
  }
}

function archiveFilesHash(files: Array<{ path: string; sha256: string }>): string {
  return createHash('sha256')
    .update(JSON.stringify([...files].sort((left, right) => left.path.localeCompare(right.path))), 'utf8')
    .digest('hex');
}

function validateRevision(value: unknown, field: string, reasons: string[]): value is RevisionIdentity {
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
    for (const field of Object.keys(riskEnums)) {
      const value = recordValue(candidate.risk, field);
      if (typeof value !== 'string' || !riskEnums[field]!.includes(value)) reasons.push(`risk.${field} is invalid`);
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
      if (
        !isRecord(command.environment) ||
        Object.keys(command.environment).some((key) => hasSecretFieldName(key)) ||
        Object.values(command.environment).some(
          (value) => typeof value !== 'string' || containsSensitiveCodeHealthContent(value),
        )
      ) {
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
    hasOnlyKeys(candidate.rollback, ['preChangeRevision', 'command', 'patchPath', 'owner', 'executable', 'patchSha256'], 'rollback', reasons);
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
    if (
      candidate.review.decision !== null &&
      !REVIEW_DECISIONS.includes(candidate.review.decision as ReviewDecision)
    )
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
      hasOnlyKeys(signature, ['role', 'actor', 'event', 'scopeHash', 'provenanceRef', 'signedAt'], `signatures[${index}]`, reasons);
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

function sameCommandEvidence(left: CommandEvidence, right: CommandEvidence): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sortedEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((item, index) => item === sortedRight[index]);
}

function validateCommandEvidence(value: unknown, field: string, reasons: string[]): value is CommandEvidence {
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
  if (
    !isRecord(value.environment) ||
    Object.keys(value.environment).some(hasSecretFieldName) ||
    Object.values(value.environment).some(
      (item) => typeof item !== 'string' || containsSensitiveCodeHealthContent(item),
    )
  )
    reasons.push(`${field}.environment is not audited and redacted`);
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
    (typeof value.exitCode !== 'number' ||
      !Number.isInteger(value.exitCode) ||
      value.exitCode < 0)
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
  hasOnlyKeys(
    value,
    ['command', 'preChangeRevision', 'patchPath', 'patchSha256', 'owner', 'patchExists', 'rawOutputExists'],
    field,
    reasons,
  );
  const commandReasons: string[] = [];
  if (!validateCommandEvidence(value.command, `${field}.command`, commandReasons)) reasons.push(...commandReasons);
  if (
    value.command &&
    (!isRecord(value.command) || value.command.observation !== 'observed' || value.command.exitCode !== 0)
  ) {
    reasons.push(`${field}.command must be an observed zero-exit result`);
  }
  if (isRecord(value.command) && value.command.command !== candidate.rollback.command)
    reasons.push(`${field}.command does not match candidate rollback command`);
  if (typeof value.preChangeRevision !== 'string' || value.preChangeRevision !== candidate.rollback.preChangeRevision)
    reasons.push(`${field}.preChangeRevision does not match candidate rollback revision`);
  if (!isRelativePath(value.patchPath) || value.patchPath !== candidate.rollback.patchPath)
    reasons.push(`${field}.patchPath does not match candidate rollback patch`);
  if (
    typeof value.patchSha256 !== 'string' ||
    !HEX64_PATTERN.test(value.patchSha256) ||
    value.patchSha256 !== candidate.rollback.patchSha256
  )
    reasons.push(`${field}.patchSha256 does not match candidate rollback metadata`);
  if (typeof value.owner !== 'string' || value.owner !== candidate.rollback.owner)
    reasons.push(`${field}.owner does not match candidate rollback owner`);
  if (value.patchExists !== true) reasons.push(`${field}.patchExists must be true`);
  if (value.rawOutputExists !== true) reasons.push(`${field}.rawOutputExists must be true`);
  if (
    isRecord(value.command) &&
    (!isRelativePath(value.command.rawOutputPath) || !evidenceRefs.includes(value.command.rawOutputPath as string))
  )
    reasons.push(`${field}.command raw output is not bound to event evidence`);
  return reasons.length === 0;
}

function validateArchiveTransitionEvidence(
  candidate: CodeHealthCandidate,
  ledger: CodeHealthLedger,
  event: LedgerEvent,
  reasons: string[],
): boolean {
  const value = event.archiveEvidence;
  if (!isRecord(value)) {
    reasons.push('archive transition requires complete archive evidence');
    return false;
  }
  hasOnlyKeys(
    value,
    ['candidateId', 'scope', 'approval', 'commands', 'manifest', 'rollback', 'sourceRevision', 'signatures'],
    'archiveEvidence',
    reasons,
  );
  if (value.candidateId !== candidate.candidateId)
    reasons.push('archive evidence candidateId does not match candidate');
  if (!isRecord(value.scope)) reasons.push('archive evidence scope is required');
  else {
    if (!sortedEqual(value.scope.files as string[], candidate.changeScope.files))
      reasons.push('archive evidence files expand or shrink candidate scope');
    if (!sortedEqual(value.scope.symbols as string[], candidate.changeScope.symbols))
      reasons.push('archive evidence symbols expand or shrink candidate scope');
    if (value.scope.scopeHash !== candidate.changeScope.scopeHash)
      reasons.push('archive evidence scopeHash does not match candidate scope');
  }

  if (!isRecord(value.approval)) reasons.push('archive evidence approval is required');
  else {
    const approvalReasons = validateApprovalScope(candidate, value.approval as ApprovalDecision);
    if (approvalReasons.length > 0) reasons.push(...approvalReasons.map((reason) => `archive approval: ${reason}`));
    if (value.approval.decision !== 'approve') reasons.push('archive transition requires an approved human decision');
    if (!event.evidenceRefs.includes(value.approval.signatureRef as string))
      reasons.push('archive approval signature is not bound to event evidence');
  }

  if (!Array.isArray(value.commands) || value.commands.length === 0)
    reasons.push('archive evidence commands are required');
  else {
    const commands = value.commands as unknown[];
    commands.forEach((command, index) => {
      const commandReasons: string[] = [];
      if (!validateCommandEvidence(command, `archiveEvidence.commands[${index}]`, commandReasons))
        reasons.push(...commandReasons);
      if (!isRecord(command) || command.observation !== 'observed' || command.exitCode !== 0)
        reasons.push(`archiveEvidence.commands[${index}] must be an observed zero-exit result`);
      if (isRecord(command) && !event.evidenceRefs.includes(command.rawOutputPath as string))
        reasons.push(`archiveEvidence.commands[${index}] raw output is not bound to event evidence`);
    });
    for (const command of candidate.commands) {
      if (
        !(value.commands as CommandEvidence[]).some((archivedCommand) => sameCommandEvidence(archivedCommand, command))
      )
        reasons.push('archive evidence is missing a candidate command result');
    }
  }

  if (!isRecord(value.manifest)) reasons.push('archive evidence manifest is required');
  else {
    hasOnlyKeys(
      value.manifest,
      ['path', 'files', 'contentHash', 'redaction', 'verificationLevel'],
      'archiveEvidence.manifest',
      reasons,
    );
    if (!isRelativePath(value.manifest.path) || !event.evidenceRefs.includes(value.manifest.path as string))
      reasons.push('archive manifest path is unsafe or not bound to event evidence');
    if (!Array.isArray(value.manifest.files) || value.manifest.files.length === 0)
      reasons.push('archive manifest must contain files');
    else {
      for (const [index, file] of (value.manifest.files as unknown[]).entries()) {
        if (
          !isRecord(file) ||
          !isRelativePath(file.path) ||
          typeof file.sha256 !== 'string' ||
          !HEX64_PATTERN.test(file.sha256)
        )
          reasons.push(`archive manifest file[${index}] is invalid`);
      }
      if (
        Array.isArray(value.manifest.files) &&
        typeof value.manifest.contentHash === 'string' &&
        archiveFilesHash(value.manifest.files as Array<{ path: string; sha256: string }>) !== value.manifest.contentHash
      )
        reasons.push('archive manifest contentHash does not match file hashes');
    }
    if (!isRecord(value.manifest.redaction) || value.manifest.redaction.status !== 'clean')
      reasons.push('archive manifest redaction must be clean');
    if (value.manifest.verificationLevel !== 'source-bound') reasons.push('archive manifest must be source-bound');
    if (
      isRecord(value.manifest) &&
      candidate.archive.manifestPath !== null &&
      value.manifest.path !== candidate.archive.manifestPath
    )
      reasons.push('archive manifest path does not match candidate archive metadata');
  }

  const rollbackReasons: string[] = [];
  if (
    !validateRollbackEvidence(
      value.rollback,
      'archiveEvidence.rollback',
      candidate,
      event.evidenceRefs,
      rollbackReasons,
    )
  )
    reasons.push(...rollbackReasons);
  const sourceRevisionReasons: string[] = [];
  const sourceRevisionValid = validateRevision(
    value.sourceRevision,
    'archiveEvidence.sourceRevision',
    sourceRevisionReasons,
  );
  if (!sourceRevisionValid) reasons.push(...sourceRevisionReasons);
  if (
    !sourceRevisionValid ||
    !sameRevision(value.sourceRevision as RevisionIdentity, candidate.revision) ||
    !sameRevision(value.sourceRevision as RevisionIdentity, ledger.baseline) ||
    !sameRevision(value.sourceRevision as RevisionIdentity, event.revision)
  )
    reasons.push('archive source revision is stale or not bound to the candidate and ledger');

  if (!isRecord(value.signatures)) reasons.push('archive evidence signatures are required');
  else {
    hasOnlyKeys(value.signatures, ['verifier', 'gate', 'human'], 'archiveEvidence.signatures', reasons);
    for (const role of ['verifier', 'gate', 'human'] as const) {
      const reference = value.signatures[role];
      if (!isRelativePath(reference) || !event.evidenceRefs.includes(reference)) {
        reasons.push(`archive ${role} signature is missing or not bound to event evidence`);
        continue;
      }
      const expectedRole = role === 'verifier' ? 'V' : role === 'gate' ? 'G' : 'human';
      if (
        !candidate.signatures.some(
          (signature) =>
            signature.role === expectedRole &&
            signature.provenanceRef === reference &&
            signature.scopeHash === candidate.changeScope.scopeHash,
        )
      )
        reasons.push(`archive ${role} signature is not bound to candidate scope`);
    }
    if (value.signatures.gate !== event.signatureRef)
      reasons.push('archive gate signature does not match transition signatureRef');
    if (isRecord(value.approval) && value.signatures.human !== value.approval.signatureRef)
      reasons.push('archive human signature does not match approval signatureRef');
  }
  return reasons.length === 0;
}

export function transitionCandidate(
  ledger: CodeHealthLedger,
  candidateId: string,
  event: LedgerEvent,
  approval?: ApprovalDecision,
): CodeHealthLedger {
  const current = ledger.candidates.find((candidate) => candidate.candidateId === candidateId);
  if (!current) throw new Error(`transition candidate not found: ${candidateId}`);
  const candidateReasons = validateCodeHealthCandidate(current);
  if (candidateReasons.length > 0) throw new Error(`transition candidate is invalid: ${candidateReasons.join('; ')}`);
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
  if (event.to === 'rolled-back') {
    if (event.actorRole !== 'S' && event.actorRole !== 'human')
      throw new Error('rollback transition requires S or human authorization');
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
    if (!event.evidenceRefs.some((ref) => /rollback|revert|patch/i.test(ref))) {
      throw new Error('transition rollback evidence reference is incomplete');
    }
  }
  const roleForTransition: Partial<Record<CodeHealthStatus, LedgerEvent['actorRole'][]>> = {
    evidenced: ['A', 'S'],
    'under-review': ['V'],
    approved: ['human'],
    implemented: ['S'],
    verified: ['V', 'G'],
    archived: ['G', 'human'],
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
    if (!event.gateFailureEvidence || event.gateFailureEvidence.candidateId !== candidateId)
      throw new Error('blocked transition requires structured gate failure evidence bound to candidate');
    const gateReasons: string[] = [];
    const { candidateId: _candidateId, failureKind: _failureKind, ...commandEvidence } = event.gateFailureEvidence;
    if (!validateCommandEvidence(commandEvidence, 'gateFailureEvidence', gateReasons))
      throw new Error(gateReasons.join('; '));
    if (
      event.gateFailureEvidence.observation !== 'observed' ||
      event.gateFailureEvidence.exitCode === null ||
      event.gateFailureEvidence.exitCode === 0
    )
      throw new Error('blocked transition requires an observed non-zero gate failure');
    if (event.gateFailureEvidence.rawOutputPath !== event.evidenceRefs[0])
      throw new Error('gate failure evidence raw output must be bound to event evidence');
  }
  if (event.to === 'archived') {
    const archiveReasons: string[] = [];
    if (!validateArchiveTransitionEvidence(current, ledger, event, archiveReasons)) {
      throw new Error(archiveReasons.join('; ') || 'archive transition guard failed');
    }
  }

  const candidates = ledger.candidates.map((candidate) =>
    candidate.candidateId === candidateId
      ? {
          ...candidate,
          status: event.to,
          archive:
            event.to === 'archived' && event.archiveEvidence
              ? {
                  state: 'archived' as const,
                  manifestPath: event.archiveEvidence.manifest.path,
                  contentHash: event.archiveEvidence.manifest.contentHash,
                  redactionStatus: 'clean' as const,
                }
              : candidate.archive,
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
  if (
    approval.decision === 'approve' &&
    !['under-review', 'approved', 'implemented', 'verified'].includes(candidate.status)
  )
    reasons.push('candidate must be under-review or in an approved lifecycle state before approval');
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
    if (!sortedEqual(ledgerCandidate.changeScope.files, candidate.changeScope.files))
      reasons.push('candidate and ledger files are inconsistent');
    if (!sortedEqual(ledgerCandidate.changeScope.symbols, candidate.changeScope.symbols))
      reasons.push('candidate and ledger symbols are inconsistent');
    if (ledgerCandidate.changeScope.scopeHash !== candidate.changeScope.scopeHash)
      reasons.push('candidate and ledger scopeHash are inconsistent');
  }
  if (!sameRevision(candidate.revision, ledger.baseline)) reasons.push('candidate revision is stale');
  if (candidate.status !== 'verified') reasons.push('candidate is not verified');
  if (candidate.archive.redactionStatus !== 'clean' || ledger.redaction.status !== 'clean')
    reasons.push('archive redaction is not clean');
  if (!candidate.rollback.executable || !isRelativePath(candidate.rollback.patchPath))
    reasons.push('rollback is not executable or path is unsafe');
  if (!candidate.rollback.command || /[;&|<>\r\n]/.test(candidate.rollback.command))
    reasons.push('rollback command is unsafe');
  if (candidate.review.decision !== 'approve' || candidate.review.humanDecision !== 'approve')
    reasons.push('human approval is missing');
  if (!approval) reasons.push('ApprovalDecision is missing');
  else reasons.push(...validateApprovalScope(candidate, approval));
  for (const command of candidate.commands) {
    if (command.observation !== 'observed' || command.exitCode !== 0)
      reasons.push('required command evidence did not pass');
    if (!isRelativePath(command.rawOutputPath)) reasons.push('command raw output path is unsafe');
  }
  const roles = new Set(candidate.signatures.map((signature) => signature.role));
  for (const role of ['V', 'G', 'human'] as const) if (!roles.has(role)) reasons.push(`signature is missing: ${role}`);
  if (
    approval &&
    !candidate.signatures.some(
      (signature) =>
        signature.role === 'human' && signature.event === 'approve' && signature.scopeHash === approval.scopeHash,
    )
  ) {
    reasons.push('human approval signature is not bound to approval scope');
  }
  if (ledger.environmentMatrix.some((environment) => environment.supported && environment.observed !== 'observed'))
    reasons.push('required environment is not observed');
  if (ledger.events.some((event) => event.candidateId === candidate.candidateId && event.to === 'blocked'))
    reasons.push('candidate has a blocking event');
  return [...new Set(reasons)];
}

export function recordGateFailure(
  ledger: CodeHealthLedger,
  candidateId: string,
  evidence: CommandEvidence,
): CodeHealthLedger;
export function recordGateFailure(ledger: CodeHealthLedger, evidence: CommandEvidence): never;
export function recordGateFailure(
  ledger: CodeHealthLedger,
  candidateIdOrEvidence: string | CommandEvidence,
  evidence?: CommandEvidence,
): CodeHealthLedger {
  if (typeof candidateIdOrEvidence !== 'string' || !evidence) {
    throw new Error('gate failure requires explicit candidate identity and evidence');
  }
  const candidate = ledger.candidates.find((entry) => entry.candidateId === candidateIdOrEvidence);
  if (!candidate) throw new Error(`gate failure candidate identity not found: ${candidateIdOrEvidence}`);
  const event: LedgerEvent = {
    eventId: `EV-GATE-FAIL-${candidate.candidateId}-${ledger.events.length + 1}`,
    candidateId: candidate.candidateId,
    from: candidate.status,
    to: 'blocked',
    actorRole: 'G',
    at: evidence.endedAt,
    revision: candidate.revision,
    evidenceRefs: [evidence.rawOutputPath],
    signatureRef: 'evidence/signature-gate-failure.json',
    gateFailureEvidence: {
      ...evidence,
      candidateId: candidate.candidateId,
      failureKind: 'gate',
    },
  };
  return transitionCandidate(ledger, candidate.candidateId, event);
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

function requireRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} requires a complete object`);
}

function requireNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} requires a non-empty value`);
}

function requireRevision(value: unknown, label: string): asserts value is RevisionIdentity {
  const reasons: string[] = [];
  if (!validateRevision(value, label, reasons)) throw new Error(`${label} is invalid: ${reasons.join('; ')}`);
}

export function validateGapMatrix(matrix: unknown): string[] {
  if (!isRecord(matrix)) return ['gap matrix requires an object'];
  const rows = matrix.rows;
  if (!Array.isArray(rows)) return ['gap matrix rows are required'];
  const reasons: string[] = [];
  rows.forEach((row, index) => {
    if (!isRecord(row)) {
      reasons.push(`rows[${index}] must be an object`);
      return;
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
    for (const key of required) if (!(key in row)) reasons.push(`rows[${index}] requires ${key}`);
    if (row.coverageIsSignalOnly !== true) reasons.push(`rows[${index}].coverageIsSignalOnly must be true`);
    if (!['requirement', 'public-contract', 'branch', 'error', 'security', 'concurrency', 'platform'].includes(String(row.kind)))
      reasons.push(`rows[${index}].kind is invalid`);
    if (!isStringArray(row.testLevels, false)) reasons.push(`rows[${index}].testLevels is required`);
    if (!isStringArray(row.evidenceSources, false)) reasons.push(`rows[${index}].evidenceSources is required`);
    if (!isStringArray(row.rtmIds, false)) reasons.push(`rows[${index}].rtmIds is required`);
    if (typeof row.missingScenario !== 'string' || row.missingScenario.trim() === '')
      reasons.push(`rows[${index}].missingScenario is required`);
    if (typeof row.owner !== 'string' || row.owner.trim() === '') reasons.push(`rows[${index}].owner is required`);
  });
  return reasons;
}

export function findGaps(input: GapDiscoveryInput): GapDiscoveryResult {
  requireRecord(input, 'gap discovery');
  throw new Error('gap discovery is not implemented in task 1; fail-closed until phase 2 evidence exists');
}

export function buildStaticInventory(input: {
  files: string[];
  sourceText: Map<string, string>;
  revision: RevisionIdentity;
}): StaticInventoryReport {
  requireRecord(input, 'static inventory');
  if (!Array.isArray(input.files) || input.files.length === 0) throw new Error('static inventory requires files');
  requireRevision(input.revision, 'static inventory revision');
  throw new Error('static inventory is not implemented in task 1; fail-closed until phase 1 analysis exists');
}

export function mergeDynamicTrace(
  staticReport: StaticInventoryReport,
  trace: DynamicTraceReport,
): Phase1CandidateLead[] {
  requireRecord(staticReport, 'dynamic trace static report');
  requireRecord(trace, 'dynamic trace report');
  throw new Error('dynamic trace merge is not implemented in task 1; fail-closed until phase 1 evidence exists');
}

export function checkFalsePositiveGuards(lead: Phase1CandidateLead, context: FalsePositiveContext): string[] {
  requireRecord(lead, 'false-positive lead');
  requireRecord(context, 'false-positive context');
  throw new Error('false-positive guard analysis is not implemented in task 1; fail-closed until phase 1 evidence exists');
}

export function runPhase1(input: {
  root: string;
  output: string;
  scenarios: DynamicTraceScenario[];
}): Promise<Phase1RunResult> {
  requireRecord(input, 'phase 1 run');
  return Promise.reject(new Error('phase 1 runner is not implemented in task 1; fail-closed'));
}

export function validateRedGreenEvidence(gap: GapRow, results: CommandEvidence[]): string[] {
  const reasons: string[] = [];
  if (!isRecord(gap)) return ['gap is required'];
  if (!Array.isArray(results)) return ['RED/GREEN results are required'];
  const red = results.filter((result) => result.observation === 'observed' && result.exitCode !== null && result.exitCode !== 0);
  const green = results.filter((result) => result.observation === 'observed' && result.exitCode === 0);
  if (red.length === 0) reasons.push('RED evidence required');
  if (green.length === 0) reasons.push('GREEN evidence required');
  return reasons;
}

export function runTddHarness(input: TddHarnessInput): Promise<TddHarnessResult> {
  requireRecord(input, 'TDD harness');
  return Promise.reject(new Error('TDD harness is not implemented in task 1; fail-closed'));
}

export function applyApproved(input: ApplyApprovedInput): Promise<ApplyResult> {
  requireRecord(input, 'approved application');
  if (!isRecord(input.approval) || !isRecord(input.candidate))
    return Promise.reject(new Error('approved application requires candidate and approval'));
  const scopeReasons = validateApprovalScope(input.candidate, input.approval);
  if (scopeReasons.length > 0) return Promise.reject(new Error(`approved application scope is invalid: ${scopeReasons.join('; ')}`));
  return Promise.reject(new Error('approved application is not implemented in task 1; fail-closed'));
}

export async function executeRollback(rollback: RollbackPlan): Promise<boolean> {
  if (!isRecord(rollback) || !rollback.executable || !isRelativePath(rollback.patchPath)) return false;
  return false;
}

export function evaluateDeletion(facts: DeletionFacts): DeletionEvaluation {
  const violations: string[] = [];
  if (!isRecord(facts) || typeof facts.testCount !== 'number' || !Number.isInteger(facts.testCount) || facts.testCount < 0)
    violations.push('test count is invalid');
  if (!isRecord(facts) || typeof facts.coverageProvenance !== 'string' || facts.coverageProvenance.trim() === '')
    violations.push('coverage provenance is required');
  if (!isRecord(facts) || !Array.isArray(facts.governanceFacts) || facts.governanceFacts.length === 0)
    violations.push('governance facts are required');
  if (isRecord(facts) && facts.testCountDelta !== undefined && facts.testCountDelta !== -1)
    violations.push('test count delta must explain exactly one removed test');
  return { passed: violations.length === 0, violations };
}

export function classifyProtectedTest(test: TestRecord): ProtectedTestClass | null {
  requireRecord(test, 'test record');
  for (const field of ['testId', 'file', 'symbol', 'author', 'createdAt', 'lastChangedAt', 'level', 'setup', 'stimulus', 'oracle', 'failureSensitivity', 'scenarioClass'])
    requireNonEmptyString(test[field], `test.${field}`);
  if (!Array.isArray(test.rtmIds) || !Array.isArray(test.governanceFacts)) throw new Error('test arrays are required');
  const text = [test.testId, test.file, test.symbol, test.setup, test.stimulus, test.oracle, test.failureSensitivity, test.scenarioClass, ...test.governanceFacts]
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

export function proveTestRemoval(input: TestRemovalProofInput): string[] {
  requireRecord(input, 'test removal proof');
  requireRecord(input.candidate, 'test removal candidate');
  const reasons: string[] = [];
  if (classifyProtectedTest(input.candidate)) reasons.push('candidate is protected');
  if (!input.survivor) reasons.push('equivalent survivor is required');
  else {
    for (const field of ['setup', 'stimulus', 'oracle', 'failureSensitivity', 'level'])
      if (input.candidate[field] !== input.survivor[field]) reasons.push(`${field} is not equivalent`);
    if (!sortedEqual(input.candidate.rtmIds, input.survivor.rtmIds)) reasons.push('RTM mapping is not rehomed');
    if (!input.candidate.governanceFacts.every((fact) => input.survivor!.governanceFacts.includes(fact)))
      reasons.push('governance facts are not rehomed');
  }
  if (!isRecord(input.pre) || !input.post) reasons.push('pre/post regression facts are required');
  else {
    const deletion = evaluateDeletion({ ...input.post, testCountDelta: input.post.testCount - input.pre.testCount });
    reasons.push(...deletion.violations);
    if (input.pre.coverageProvenance !== input.post.coverageProvenance) reasons.push('coverage provenance changed');
  }
  return [...new Set(reasons)];
}

export function clusterDuplicates(input: DuplicateInput): DuplicateCluster[] {
  requireRecord(input, 'duplicate cluster input');
  if (!Array.isArray(input.implementations) || input.implementations.length < 2) throw new Error('duplicate cluster requires implementations');
  if (!Array.isArray(input.callGraph) || input.callGraph.length === 0) throw new Error('duplicate cluster requires call graph evidence');
  throw new Error('duplicate clustering is not implemented in task 1; fail-closed until phase 4 evidence exists');
}

export function proveAbstraction(cluster: DuplicateCluster, proposal: AbstractionProposal): string[] {
  requireRecord(cluster, 'abstraction cluster');
  requireRecord(proposal, 'abstraction proposal');
  if (!Array.isArray(cluster.stableProductionCallSites)) throw new Error('abstraction cluster requires stable call-site evidence');
  requireNonEmptyString(proposal.targetApi, 'abstraction targetApi');
  const reasons: string[] = [];
  if (!Array.isArray(cluster.stableProductionCallSites) || cluster.stableProductionCallSites.length < 2)
    reasons.push('two stable production call sites are required');
  if (cluster.status !== 'approved') reasons.push('cluster must be approved before abstraction');
  for (const [field, value] of Object.entries(proposal)) {
    if (['targetApi', 'maintenanceBenefit', 'inputsOutputs', 'errorsRetries', 'lifecycleResources', 'security', 'concurrencyPlatforms'].includes(field) && typeof value !== 'string')
      reasons.push(`${field} proof is required`);
  }
  if (typeof proposal.maintenanceBenefit !== 'string' || proposal.maintenanceBenefit.trim().length < 20)
    reasons.push('maintenance benefit must be concrete');
  return reasons;
}

function emptyArchiveResult(reason: string): ArchiveResult {
  return { exitCode: 1, path: '', manifest: null, verificationLevel: 'package-only', reason };
}

export async function archiveCampaign(
  campaign: CodeHealthLedger,
  options: ArchiveCampaignOptions = {},
): Promise<ArchiveResult> {
  const candidate = campaign.candidates[0];
  if (!candidate) return emptyArchiveResult('candidate is missing');
  const reasons = canArchiveCandidate(candidate, campaign, options.approval);
  if (reasons.length > 0) return emptyArchiveResult(reasons.join('; '));
  if (!options.approval) return emptyArchiveResult('ApprovalDecision is missing');

  const manifestPath = candidate.archive.manifestPath ?? `archive/${candidate.candidateId}.json`;
  const files = candidate.commands.map((command) => ({ path: command.rawOutputPath, sha256: command.rawOutputSha256 }));
  files.push({ path: candidate.evidenceRef, sha256: candidate.commands[0]!.rawOutputSha256 });
  const verificationLevel = options.verificationLevel ?? 'source-bound';
  const manifest: CodeHealthArchiveManifest = {
    archiveId: `ARC-${candidate.candidateId}`,
    candidateId: candidate.candidateId,
    ledger: campaign,
    approval: options.approval,
    files,
    contentHash: archiveFilesHash(files),
    redaction: { status: 'clean', reasons: [] },
    sourceRevision: candidate.revision,
    verificationLevel,
  };
  return { exitCode: 0, path: manifestPath, manifest, verificationLevel };
}

export async function verifyArchive(
  archivePath: string,
  options: VerifyArchiveOptions = {},
): Promise<{ ok: boolean; verificationLevel: 'package-only' | 'source-bound' }> {
  if (!isRelativePath(archivePath)) return { ok: false, verificationLevel: 'package-only' };
  const root = options.root ?? process.cwd();
  const resolvedArchive = path.resolve(root, archivePath);
  if (!isRelativePath(archivePath) || !resolvedArchive.startsWith(`${path.resolve(root)}${path.sep}`)) {
    return { ok: false, verificationLevel: 'package-only' };
  }
  try {
    const raw = await fs.readFile(resolvedArchive, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      !Array.isArray(parsed.files) ||
      typeof parsed.contentHash !== 'string' ||
      !HEX64_PATTERN.test(parsed.contentHash)
    ) {
      return { ok: false, verificationLevel: 'package-only' };
    }
    const files: Array<{ path: string; sha256: string }> = [];
    for (const entry of parsed.files) {
      if (
        !isRecord(entry) ||
        !isRelativePath(entry.path) ||
        typeof entry.sha256 !== 'string' ||
        !HEX64_PATTERN.test(entry.sha256)
      ) {
        return { ok: false, verificationLevel: 'package-only' };
      }
      const resolvedFile = path.resolve(root, entry.path);
      if (!resolvedFile.startsWith(`${path.resolve(root)}${path.sep}`))
        return { ok: false, verificationLevel: 'package-only' };
      const content = await fs.readFile(resolvedFile);
      const actualHash = createHash('sha256').update(content).digest('hex');
      if (actualHash !== entry.sha256) return { ok: false, verificationLevel: 'package-only' };
      files.push({ path: entry.path, sha256: entry.sha256 });
    }
    if (archiveFilesHash(files) !== parsed.contentHash) return { ok: false, verificationLevel: 'package-only' };
    if (isRecord(parsed.redaction) && parsed.redaction.status !== 'clean')
      return { ok: false, verificationLevel: 'package-only' };
    const verificationLevel =
      parsed.verificationLevel === 'source-bound' && options.sourceProject ? 'source-bound' : 'package-only';
    return { ok: true, verificationLevel };
  } catch {
    return { ok: false, verificationLevel: 'package-only' };
  }
}
