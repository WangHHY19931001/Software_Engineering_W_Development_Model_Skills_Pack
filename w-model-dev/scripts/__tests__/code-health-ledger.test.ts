/* eslint-disable security/detect-non-literal-fs-filename -- All filesystem paths are generated beneath test-owned temporary output directories. */
/** Task 1 contract tests for the code-health ledger and evidence boundary. */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import {
  validateCommandEvidence,
  type CandidateSelector,
  type EvidenceBinding,
  type EvidenceStore,
  type EvidenceVerificationContext,
  type FileVerificationContext,
  type GapRow,
  type RevisionIdentity,
} from '../logic/code-health-contract.js';
import {
  appendReworkEvent,
  appendRootCauseEvent,
  applyApproved,
  buildStaticInventory,
  canArchiveCandidate,
  checkFalsePositiveGuards,
  classifyProtectedTest,
  clusterDuplicates,
  CodeHealthError,
  evaluateDeletion,
  executeRollback,
  findGaps,
  mergeDynamicTrace,
  nextRequiredRoles,
  proveAbstraction,
  proveTestRemoval,
  recordGateFailure,
  recordVerifiedGateFailure,
  replayCandidate,
  runTddHarness,
  transitionCandidate,
  transitionCandidateVerified,
  validateApprovalScope,
  validateCodeHealthCandidate,
  validateGapMatrix,
  validateGapRow,
  type ApprovalDecision,
  type CodeHealthCandidate,
  type CodeHealthLedger,
  type CodeHealthStatus,
  type FalsePositiveContext,
  type GapDiscoveryInput,
  type GateFailureEvidence,
  type LedgerEvent,
  type Phase1CandidateLead,
} from '../logic/code-health-ledger-logic.js';
import { runPhase1 } from '../cli/code-health-phase1.js';
import { createCodeHealthCommandRunner } from '../lib/code-health-command.js';
import { createCodeHealthEvidenceStore } from '../lib/code-health-evidence-store.js';
import { createCodeHealthFileVerifier } from '../lib/code-health-file-verifier.js';
import { createCodeHealthGitRevisionProvider } from '../lib/code-health-revision-provider.js';
import { redactCodeHealthArtifact } from '../lib/code-health-redaction.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const testOutputRoot = path.join(repoRoot, '.tmp-code-health-test-output');

const revision = {
  commitSha: 'a'.repeat(40),
  treeSha: 'b'.repeat(40),
  sourceBundleSha256: 'c'.repeat(64),
  analyzedAt: '2026-09-07T00:00:00.000Z',
};

const impact = {
  rtmBefore: ['REQ-001'],
  rtmAfter: ['REQ-001'],
  coverageBefore: { statements: 0.8, branches: null, functions: 0.7, lines: 0.8 },
  coverageAfter: { statements: 0.8, branches: null, functions: 0.7, lines: 0.8 },
  testLevels: ['unit' as const],
  unmappedScenarios: [],
  coverageIsSignalOnly: true as const,
};

export function validCandidate(candidateId: string, overrides: Partial<CodeHealthCandidate> = {}): CodeHealthCandidate {
  return {
    candidateId,
    phase: 'P1',
    action: 'delete-code',
    status: 'evidenced',
    files: ['src/unused.ts'],
    symbols: ['unusedFunction'],
    tests: ['w-model-dev/scripts/__tests__/unused.test.ts'],
    callSites: ['src/app.ts:useUnused'],
    sources: ['static-inventory.json'],
    commands: [
      {
        command: 'node --version',
        cwd: '.',
        environment: { NODE_ENV: 'test' },
        platform: 'win32',
        toolVersions: { node: '20.0.0' },
        startedAt: '2026-09-07T00:00:00.000Z',
        endedAt: '2026-09-07T00:00:01.000Z',
        exitCode: 0,
        observation: 'observed',
        rawOutputPath: '.w-model/code-health/raw/node-version.log',
        rawOutputSha256: 'f'.repeat(64),
      },
    ],
    revision,
    confidence: {
      level: 'medium',
      score: 0.8,
      rationale: 'static and dynamic evidence agree',
      uncertainties: [],
    },
    risk: {
      severity: 'low',
      behavior: 'low',
      security: 'none',
      concurrency: 'none',
      platform: 'low',
      lifecycle: 'low',
      governance: 'low',
      rationale: 'isolated helper with rollback',
    },
    rtmImpact: impact,
    coverageImpact: impact,
    rollback: {
      preChangeRevision: revision.commitSha,
      command: 'git revert COMMIT',
      patchPath: 'evidence/rollback.patch',
      owner: 'S-agent',
      executable: true,
    },
    review: {
      findings: [],
      unresolvedQuestions: [],
      decision: null,
      humanDecision: null,
    },
    signatures: [
      {
        role: 'A',
        actor: 'analyst',
        event: 'discovered',
        scopeHash: 'sha256:' + 'd'.repeat(64),
        provenanceRef: 'evidence/signature-a.json',
        signedAt: '2026-09-07T00:01:00.000Z',
      },
    ],
    changeScope: {
      files: ['src/unused.ts'],
      symbols: ['unusedFunction'],
      scopeHash: 'sha256:' + 'e'.repeat(64),
    },
    evidenceBinding: {
      candidate: {
        candidateId,
        phase: 'P1',
        action: 'delete-code',
        files: ['src/unused.ts'],
        symbols: ['unusedFunction'],
        scopeHash: 'sha256:' + 'e'.repeat(64),
      },
      revision,
      rawOutputPath: '.w-model/code-health/raw/node-version.log',
      rawOutputSha256: 'f'.repeat(64),
    },
    evidenceRef: 'evidence/CHG-P1-20260907-001.json',
    archive: {
      state: 'not_archived',
      manifestPath: null,
      contentHash: null,
      redactionStatus: 'not_reviewed',
    },
    ...overrides,
  };
}

export function validLedger(candidate: CodeHealthCandidate): CodeHealthLedger {
  return {
    schemaVersion: '1.0',
    campaignId: 'CHC-20260907',
    createdAt: '2026-09-07T00:00:00.000Z',
    baseline: revision,
    environmentMatrix: [
      {
        platform: 'win32',
        shell: 'git-bash',
        runtime: 'node20',
        supported: true,
        observed: 'observed',
        reason: 'controlled test environment',
      },
    ],
    candidates: [candidate],
    events: [],
    appendOnly: true,
    redaction: { status: 'not_reviewed', rules: ['remove secrets'], blockedReasons: [] },
  };
}

export function event(
  from: CodeHealthCandidate['status'],
  to: CodeHealthCandidate['status'],
  candidateId = 'CHG-P1-20260907-001',
): LedgerEvent {
  return {
    eventId: `EV-${candidateId}-${from}-${to}`,
    eventKind:
      to === 'blocked' ? 'gate-failure' : to === 'evidenced' ? 'evidence' : to === 'archived' ? 'archive' : 'discovery',
    candidateId,
    from,
    to,
    actorRole: 'A',
    at: '2026-09-07T00:02:00.000Z',
    revision,
    scopeHash: 'sha256:' + 'e'.repeat(64),
    evidenceRefs: ['evidence/one.json'],
    signatureRef: 'evidence/signature-a.json',
  };
}

export function validApproval(candidate: CodeHealthCandidate): ApprovalDecision {
  return {
    candidateId: candidate.candidateId,
    decision: 'approve',
    approvedAction: candidate.action,
    approvedFiles: [...candidate.changeScope.files],
    approvedSymbols: [...candidate.changeScope.symbols],
    scopeHash: candidate.changeScope.scopeHash,
    rationale: 'exact scope approved after independent review',
    actor: 'human-decision-maker',
    decidedAt: '2026-09-07T00:03:00.000Z',
    signatureRef: 'evidence/signature-human.json',
    revision: candidate.revision,
  };
}

const execFileAsync = promisify(execFile);
const gitRevisionProvider = createCodeHealthGitRevisionProvider();
const fileVerifier = createCodeHealthFileVerifier();

/**
 * Canonical Git environment shared with `code-health-evidence.test.ts`: no system or user Git config and
 * no prompt, so `git archive` source-bundle bytes are identical across machines regardless of
 * `core.autocrlf`. Reusing the 1B recipe keeps this fixture's `revision.sourceBundleSha256` comparable.
 */
const GIT_ENV = {
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: 'code-health-ledger',
  GIT_AUTHOR_EMAIL: 'code-health-ledger@example.test',
  GIT_COMMITTER_NAME: 'code-health-ledger',
  GIT_COMMITTER_EMAIL: 'code-health-ledger@example.test',
  PATH: process.env.PATH,
  PATHEXT: process.env.PATHEXT,
  SYSTEMROOT: process.env.SYSTEMROOT,
  SYSTEMDRIVE: process.env.SYSTEMDRIVE,
  WINDIR: process.env.WINDIR,
  COMSPEC: process.env.COMSPEC,
  TEMP: process.env.TEMP,
  TMP: process.env.TMP,
  USERPROFILE: process.env.USERPROFILE,
} as NodeJS.ProcessEnv;

const createdTestRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdTestRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true, maxRetries: 3 })),
  );
});

export function sha256Hex(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: root, env: GIT_ENV, shell: false, windowsHide: true });
  return stdout;
}

/** Real isolated Git repository used by the 1B authenticity assertions. */
async function createTempGitRepository(): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'code-health-ledger-1b-'));
  createdTestRoots.push(root);
  await git(root, ['init', '--quiet']);
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'unused.ts'), 'export const unusedFunction = 1;\n');
  await git(root, ['add', '--all']);
  await git(root, ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'initial']);
  return root;
}

/** Real worktree status of an isolated repository, used to prove `applyApproved` writes nothing. */
async function gitStatus(root: string): Promise<string> {
  return git(root, ['status', '--porcelain', '--untracked-files=all']);
}

async function repositoryRevision(root: string): Promise<RevisionIdentity> {
  const revision = await gitRevisionProvider.current(root);
  if (!revision) throw new Error('repository revision is unavailable for the test fixture');
  return revision;
}

function commandBinding(
  candidateId: string,
  revision: RevisionIdentity,
  rawOutputPath = '.w-model/code-health/raw/command.log',
): EvidenceBinding {
  return {
    candidate: {
      candidateId,
      phase: 'P1',
      action: 'delete-code',
      files: ['src/unused.ts'],
      symbols: ['unusedFunction'],
      scopeHash: 'sha256:' + 'e'.repeat(64),
    },
    revision,
    rawOutputPath,
    rawOutputSha256: '0'.repeat(64),
  };
}

/** Command runner over the real repository root with the injected 1B evidence boundaries. */
async function createRepositoryRunner(rawOutputDir: string, extra: { now?: () => Date } = {}) {
  const relativeRawOutputDir = path.relative(repoRoot, rawOutputDir).replace(/\\/g, '/');
  const evidenceStore = createCodeHealthEvidenceStore({
    repositoryRoot: repoRoot,
    rawOutputRoot: relativeRawOutputDir,
  });
  const runner = createCodeHealthCommandRunner({
    repositoryRoot: repoRoot,
    rawOutputDir: relativeRawOutputDir,
    evidenceStore,
    revisionProvider: gitRevisionProvider,
    ...(extra.now ? { now: extra.now } : {}),
  });
  const revision = await repositoryRevision(repoRoot);
  return {
    runner,
    evidenceStore,
    revision,
    binding: (candidateId: string) => commandBinding(candidateId, revision),
  };
}

const firstId = 'CHG-P1-20260907-101';
const secondId = 'CHG-P1-20260907-102';
const scopeHash = 'sha256:' + 'e'.repeat(64);

/** Two-candidate ledger: only the addressed candidate may ever be touched. */
function ledgerWithTwoCandidates(firstStatus: CodeHealthStatus = 'discovered'): CodeHealthLedger {
  const first = validCandidate(firstId, { status: firstStatus });
  const second = validCandidate(secondId, { status: 'discovered' });
  const ledger = validLedger(first);
  ledger.candidates = [first, second];
  return ledger;
}

function eventKindFor(to: CodeHealthStatus): LedgerEvent['eventKind'] {
  if (to === 'blocked') return 'gate-failure';
  if (to === 'evidenced') return 'evidence';
  if (to === 'under-review') return 'review';
  if (to === 'approved') return 'approval';
  if (to === 'implemented') return 'implementation';
  if (to === 'verified') return 'verification';
  if (to === 'archived') return 'archive';
  if (to === 'rejected' || to === 'deferred') return 'review';
  if (to === 'rolled-back') return 'rollback';
  return 'discovery';
}

function candidateEvent(
  candidateId: string,
  from: CodeHealthStatus | null,
  to: CodeHealthStatus,
  overrides: Partial<LedgerEvent> = {},
): LedgerEvent {
  const at = overrides.at ?? '2026-09-07T00:02:00.000Z';
  return {
    eventId: `EV-${candidateId}-${String(from)}-${to}-${at}`,
    eventKind: eventKindFor(to),
    candidateId,
    from,
    to,
    actorRole: 'A',
    at,
    revision,
    scopeHash,
    evidenceRefs: ['evidence/one.json'],
    signatureRef: 'evidence/signature-a.json',
    ...overrides,
  };
}

function evidencedEvent(candidateId: string): LedgerEvent {
  return candidateEvent(candidateId, 'discovered', 'evidenced', { actorRole: 'A' });
}

/** Creation event: the only event allowed to carry `from: null`, restricted to A/O discovery roles. */
function creationEvent(
  candidateId: string,
  actorRole: LedgerEvent['actorRole'],
  at = '2026-09-07T00:01:00.000Z',
): LedgerEvent {
  return candidateEvent(candidateId, null, 'discovered', { eventKind: 'discovery', actorRole, at });
}

/** A real next revision used to prove implementation-only atomic revision advance. */
function nextRevision(): RevisionIdentity {
  return {
    ...revision,
    commitSha: 'b'.repeat(40),
    treeSha: 'c'.repeat(40),
    sourceBundleSha256: 'd'.repeat(64),
  };
}

function reviewEvent(candidateId: string, at = '2026-09-07T00:05:00.000Z'): LedgerEvent {
  return candidateEvent(candidateId, 'evidenced', 'under-review', { actorRole: 'V', at });
}

function eventWithRole(to: CodeHealthStatus, actorRole: LedgerEvent['actorRole']): LedgerEvent {
  return candidateEvent(firstId, 'under-review', to, { actorRole, at: '2026-09-07T00:10:00.000Z' });
}

function eventFor(candidateId: string): LedgerEvent {
  return candidateEvent(candidateId, 'under-review', 'approved', {
    actorRole: 'human',
    at: '2026-09-07T00:11:00.000Z',
  });
}

function eventWithOlderTimestamp(): LedgerEvent {
  return candidateEvent(firstId, 'under-review', 'approved', { actorRole: 'human', at: '2026-09-07T00:01:00.000Z' });
}

/**
 * 1C gate-failure fixture: a real raw output on disk, verified through the 1B EvidenceStore against the
 * candidate/scope/revision binding before the reducer is allowed to consume the structural evidence.
 */
async function realGateFailureFixture(): Promise<{
  ledger: CodeHealthLedger;
  realGateFailureEvidence: GateFailureEvidence;
  revision: RevisionIdentity;
}> {
  const root = await createTempGitRepository();
  const candidateRevision = await repositoryRevision(root);
  const rawBytes = Buffer.from('gate failure raw output\n');
  await fs.mkdir(path.join(root, 'evidence'), { recursive: true });
  await fs.writeFile(path.join(root, 'evidence', 'gate-failure.log'), rawBytes);
  const rawOutputSha256 = sha256Hex(rawBytes);
  const evidenceStore = createCodeHealthEvidenceStore({ repositoryRoot: root, rawOutputRoot: 'evidence' });
  const realGateFailureEvidence: GateFailureEvidence = {
    command: JSON.stringify({ command: 'node', args: ['--version'] }),
    cwd: '.',
    environment: { NODE_ENV: 'test' },
    platform: process.platform,
    toolVersions: { node: process.version },
    startedAt: '2026-09-07T00:02:00.000Z',
    endedAt: '2026-09-07T00:02:05.000Z',
    exitCode: 7,
    observation: 'observed',
    rawOutputPath: 'evidence/gate-failure.log',
    rawOutputSha256,
    candidateId: firstId,
    scopeHash,
    failureKind: 'gate',
  };
  const binding: EvidenceBinding = {
    candidate: {
      candidateId: firstId,
      phase: 'P1',
      action: 'delete-code',
      files: ['src/unused.ts'],
      symbols: ['unusedFunction'],
      scopeHash,
    },
    revision: candidateRevision,
    rawOutputPath: 'evidence/gate-failure.log',
    rawOutputSha256,
  };
  await evidenceStore.verify(
    {
      evidenceId: 'EVD-GATE-FAIL-REAL-001',
      candidateId: firstId,
      scopeHash,
      relativePath: 'evidence/gate-failure.log',
      sha256: rawOutputSha256,
      revision: candidateRevision,
      observation: 'observed',
    },
    binding,
  );
  const template = validCandidate(firstId, { status: 'discovered' });
  const candidate = validCandidate(firstId, {
    status: 'discovered',
    revision: candidateRevision,
    evidenceBinding: { ...template.evidenceBinding, revision: candidateRevision },
  });
  const ledger = validLedger(candidate);
  ledger.baseline = candidateRevision;
  return { ledger, realGateFailureEvidence, revision: candidateRevision };
}

function rootCauseChainEvent(
  eventKind: 'root-cause' | 'root-cause-review' | 'root-cause-gate',
  actorRole: 'R' | 'V' | 'G',
  candidateRevision: RevisionIdentity,
  at: string,
): LedgerEvent {
  return {
    eventId: `EV-${firstId}-${eventKind}`,
    eventKind,
    candidateId: firstId,
    from: 'blocked',
    to: 'blocked',
    actorRole,
    at,
    revision: candidateRevision,
    scopeHash,
    evidenceRefs: [`evidence/${eventKind}.json`],
    signatureRef: `evidence/signature-${actorRole.toLowerCase()}.json`,
  };
}

function reworkEvent(candidateRevision: RevisionIdentity, at: string): LedgerEvent {
  return {
    eventId: `EV-${firstId}-rework`,
    eventKind: 'rework',
    candidateId: firstId,
    from: 'blocked',
    to: 'evidenced',
    actorRole: 'S',
    at,
    revision: candidateRevision,
    scopeHash,
    evidenceRefs: ['evidence/rework.json'],
    signatureRef: 'evidence/signature-s.json',
  };
}

function validGapRow(candidateId: string): GapRow {
  return {
    gapId: `GAP-${candidateId}-001`,
    candidateId,
    kind: 'security',
    testLevels: ['unit'],
    existingTestIds: [],
    missingScenario: 'invalid token is rejected without exposing secret material',
    evidenceSources: ['evidence/gap.json'],
    risk: {
      severity: 'high',
      behavior: 'medium',
      security: 'high',
      concurrency: 'none',
      platform: 'low',
      lifecycle: 'low',
      governance: 'medium',
      rationale: 'An untested rejection path can expose an authorization boundary.',
    },
    priority: 'high',
    owner: 'S-agent',
    rtmIds: ['REQ-SEC-001'],
    coverageSignal: { statements: 0.9, branches: 0.5, functions: 0.8, lines: 0.9 },
    coverageIsSignalOnly: true,
    status: 'discovered',
  };
}

/** A fully evidenced gap row at `verified` status: RED observed non-zero, GREEN observed zero, assertion hash. */
function verifiedGapRow(candidateId: string): GapRow {
  const observed = validCandidate(candidateId).commands[0]!;
  return {
    ...validGapRow(candidateId),
    status: 'verified',
    redEvidence: { ...observed, exitCode: 1 },
    greenEvidence: { ...observed, exitCode: 0 },
    assertionHash: 'a'.repeat(64),
  };
}

describe('code-health ledger contract', () => {
  it('合法候选包含完整 evidence/impact/rollback/review/signature/archive 字段并可从 discovered 转 evidenced', () => {
    const candidate = validCandidate('CHG-P1-20260907-001', { status: 'discovered' });
    expect(validateCodeHealthCandidate(candidate)).toEqual([]);
    const ledger = validLedger(candidate);
    const next = transitionCandidate(ledger, candidate.candidateId, event('discovered', 'evidenced'));
    expect(next.candidates[0]?.status).toBe('evidenced');
  });

  it('发现记录不能伪装为结论，未知动态加载和缺失环境 fail-closed', () => {
    const candidate = validCandidate('CHG-P1-20260907-002', {
      status: 'discovered',
      confidence: { level: 'high', score: 0.99, rationale: 'no grep hit', uncertainties: ['dynamic import'] },
    });
    expect(validateCodeHealthCandidate(candidate)).toEqual([]);
    expect(canArchiveCandidate(candidate, validLedger(candidate), validApproval(candidate))).toContain(
      'candidate is not verified',
    );
  });

  it('不合法状态跳转、scope 扩展、伪造命令结果和不安全 redaction 都被拒绝', () => {
    const candidate = validCandidate('CHG-P3-20260907-003');
    expect(() =>
      transitionCandidate(validLedger(candidate), candidate.candidateId, event('discovered', 'archived')),
    ).toThrow(/transition/);
    expect(
      validateApprovalScope(candidate, {
        ...validApproval(candidate),
        approvedFiles: ['unknown.ts'],
        scopeHash: 'sha256:wrong',
      }),
    ).not.toEqual([]);
    expect(redactCodeHealthArtifact({ password: 'x', absolute: 'C:\\secret\\file' }).status).toBe('clean');
    expect(redactCodeHealthArtifact({ payload: '\u0000binary-secret' }).status).toBe('blocked');
  });

  it('command runner 契约保留真实 exitCode/unknown 状态和 raw output hash，禁止 shell 拼接', async () => {
    await fs.mkdir(testOutputRoot, { recursive: true });
    const rawOutputDir = await fs.mkdtemp(path.join(testOutputRoot, 'code-health-output-'));
    try {
      const { runner, binding } = await createRepositoryRunner(rawOutputDir);
      const result = await runner.run(process.execPath, ['--version'], {
        cwd: repoRoot,
        env: {},
        timeoutMs: 5000,
        binding: binding('CHG-P1-20260907-019'),
      });
      expect(result.command).toContain('--version');
      expect(result.exitCode).toBe(0);
      expect(result.observation).toBe('observed');
      expect(result.rawOutputSha256).toMatch(/^[0-9a-f]{64}$/);
      await expect(
        runner.run('node -e "process.exit(0)"', [], {
          cwd: repoRoot,
          env: {},
          timeoutMs: 5000,
          binding: binding('CHG-P1-20260907-019'),
        }),
      ).rejects.toThrow(/argv/);
    } finally {
      await fs.rm(rawOutputDir, { recursive: true, force: true });
    }
  });

  it('argv/env secrets and sensitive output fail closed before execution and evidence persistence', async () => {
    await fs.mkdir(testOutputRoot, { recursive: true });
    const rawOutputDir = await fs.mkdtemp(path.join(testOutputRoot, 'code-health-secret-output-'));
    try {
      const { runner, binding } = await createRepositoryRunner(rawOutputDir);
      await expect(
        runner.run(process.execPath, ['-e', 'console.log("password=super-secret")'], {
          cwd: repoRoot,
          env: { API_TOKEN: 'token-value-that-must-not-run' },
          timeoutMs: 5000,
          binding: binding('CHG-P1-20260907-020'),
        }),
      ).rejects.toThrow(/redaction|unsafe|secret/i);
      expect((await fs.readdir(rawOutputDir)).length).toBe(0);
    } finally {
      await fs.rm(rawOutputDir, { recursive: true, force: true });
    }
  });

  it('records nonzero, unavailable, and timeout commands with real exit codes and redacted output', async () => {
    await fs.mkdir(testOutputRoot, { recursive: true });
    const rawOutputDir = await fs.mkdtemp(path.join(testOutputRoot, 'code-health-outcomes-'));
    try {
      const { runner, binding } = await createRepositoryRunner(rawOutputDir);
      const failed = await runner.run(process.execPath, ['-e', 'console.error("failure output") ; process.exit(1)'], {
        cwd: repoRoot,
        env: {},
        timeoutMs: 5000,
        binding: binding('CHG-P1-20260907-021'),
      });
      expect(failed.exitCode).toBe(1);
      expect(failed.observation).toBe('observed');
      const emittedSecret = await runner.run(
        process.execPath,
        [
          '-e',
          'process.stdout.write(["pass", "word"].join("")+"=stdout-secret "+["Author", "ization"].join("")+": "+["Bear", "er"].join("")+" super-secret-token"); process.stderr.write(["to", "ken"].join("")+"=stderr-secret")',
        ],
        {
          cwd: repoRoot,
          env: {},
          timeoutMs: 5000,
          binding: binding('CHG-P1-20260907-021'),
        },
      );
      const emittedOutput = await fs.readFile(path.resolve(repoRoot, emittedSecret.rawOutputPath), 'utf8');
      expect(emittedOutput).not.toContain('stdout-secret');
      expect(emittedOutput).not.toContain('stderr-secret');
      expect(emittedOutput).not.toContain('super-secret-token');
      expect(emittedOutput).toContain('[REDACTED]');
      for (const exitCode of [3, 7, 127]) {
        const result = await runner.run(process.execPath, ['-e', `process.exit(${exitCode})`], {
          cwd: repoRoot,
          env: {},
          timeoutMs: 5000,
          binding: binding('CHG-P1-20260907-021'),
        });
        expect(result.exitCode).toBe(exitCode);
        expect(result.observation).toBe('observed');
      }
      const unavailable = await runner.run('definitely-not-a-real-code-health-command', [], {
        cwd: repoRoot,
        env: {},
        timeoutMs: 5000,
        binding: binding('CHG-P1-20260907-021'),
      });
      expect(unavailable.exitCode).toBeNull();
      expect(unavailable.observation).toBe('unavailable');
      // A child that never exits on its own: the runner timer is the only termination path, so a slow or
      // loaded event loop cannot race the assertion (unlike a short-lived child with a near-zero timeout).
      const timeout = await runner.run(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
        cwd: repoRoot,
        env: {},
        timeoutMs: 250,
        binding: binding('CHG-P1-20260907-021'),
      });
      expect(timeout.exitCode).toBeNull();
      expect(timeout.observation).toBe('not_run');
      const rawOutput = await fs.readFile(path.resolve(repoRoot, failed.rawOutputPath), 'utf8');
      expect(rawOutput).not.toMatch(/password|secret|token/i);
    } finally {
      await fs.rm(rawOutputDir, { recursive: true, force: true });
    }
  });

  it('blocks stdout and stderr that cannot be decoded safely for redaction', async () => {
    await fs.mkdir(testOutputRoot, { recursive: true });
    const rawOutputDir = await fs.mkdtemp(path.join(testOutputRoot, 'code-health-invalid-utf8-'));
    try {
      const { runner, binding } = await createRepositoryRunner(rawOutputDir);
      await expect(
        runner.run(
          process.execPath,
          ['-e', 'const bytes = Buffer.from([0xff]); process.stdout.write(bytes); process.stderr.write(bytes)'],
          { cwd: repoRoot, env: {}, timeoutMs: 5000, binding: binding('CHG-P1-20260907-022') },
        ),
      ).rejects.toThrow(/redaction|utf-?8|decode/i);
      expect(await fs.readdir(rawOutputDir)).toEqual([]);
    } finally {
      await fs.rm(rawOutputDir, { recursive: true, force: true });
    }
  });

  it('redacts embedded POSIX and Windows absolute paths and preserves unique concurrent raw outputs', async () => {
    const redacted = redactCodeHealthArtifact({
      stdout: 'trace C:\\Users\\alice\\secret.txt /home/alice/secret.txt',
    });
    expect(redacted.status).toBe('clean');
    expect(JSON.stringify(redacted.value)).not.toContain('C:\\Users\\alice');
    expect(JSON.stringify(redacted.value)).not.toContain('/home/alice');
    expect(JSON.stringify(redacted.value)).not.toContain('[REDACTED]sers');
    expect(JSON.stringify(redactCodeHealthArtifact('trace /home/alice/secret file.txt').value)).not.toContain(
      '/home/alice',
    );

    await fs.mkdir(testOutputRoot, { recursive: true });
    const rawOutputDir = await fs.mkdtemp(path.join(testOutputRoot, 'code-health-concurrent-output-'));
    try {
      const { runner, binding } = await createRepositoryRunner(rawOutputDir, {
        now: () => new Date('2026-09-07T00:00:00.000Z'),
      });
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          runner.run(process.execPath, ['-e', 'process.stdout.write("ok")'], {
            cwd: repoRoot,
            env: {},
            timeoutMs: 5000,
            binding: binding('CHG-P1-20260907-023'),
          }),
        ),
      );
      expect(new Set(results.map((result) => result.rawOutputPath)).size).toBe(8);
      expect((await fs.readdir(rawOutputDir)).length).toBe(8);
    } finally {
      await fs.rm(rawOutputDir, { recursive: true, force: true });
    }
  });

  it('archive rejects failed evidence, approval mismatch, unauthorized transitions, and unverifiable rollback', () => {
    const candidate = validCandidate('CHG-P1-20260907-004', {
      status: 'verified',
      review: { findings: [], unresolvedQuestions: [], decision: 'approve', humanDecision: 'approve' },
      signatures: [
        {
          role: 'A',
          actor: 'analyst',
          event: 'discovered',
          scopeHash: 'sha256:' + 'd'.repeat(64),
          provenanceRef: 'evidence/a.json',
          signedAt: '2026-09-07T00:01:00.000Z',
        },
        {
          role: 'V',
          actor: 'verifier',
          event: 'verified',
          scopeHash: 'sha256:' + 'd'.repeat(64),
          provenanceRef: 'evidence/v.json',
          signedAt: '2026-09-07T00:02:00.000Z',
        },
        {
          role: 'G',
          actor: 'gate',
          event: 'gate',
          scopeHash: 'sha256:' + 'd'.repeat(64),
          provenanceRef: 'evidence/g.json',
          signedAt: '2026-09-07T00:03:00.000Z',
        },
        {
          role: 'human',
          actor: 'human-decision-maker',
          event: 'approve',
          scopeHash: 'sha256:' + 'e'.repeat(64),
          provenanceRef: 'evidence/human.json',
          signedAt: '2026-09-07T00:04:00.000Z',
        },
      ],
      archive: { state: 'not_archived', manifestPath: null, contentHash: null, redactionStatus: 'clean' },
    });
    const ledger = validLedger(candidate);
    ledger.redaction = { status: 'clean', rules: ['remove secrets'], blockedReasons: [] };
    candidate.commands[0]!.exitCode = 1;
    const approval = validApproval(candidate);
    approval.approvedFiles = ['unknown.ts'];
    expect(canArchiveCandidate(candidate, ledger, approval)).toEqual(
      expect.arrayContaining([expect.stringMatching(/exit|pass|failure/i)]),
    );
    expect(canArchiveCandidate(candidate, ledger, approval)).toEqual(
      expect.arrayContaining([expect.stringMatching(/approval|scope/i)]),
    );

    expect(() =>
      transitionCandidate(
        validLedger(validCandidate('CHG-P1-20260907-005', { status: 'evidenced' })),
        'CHG-P1-20260907-005',
        {
          ...event('evidenced', 'under-review', 'CHG-P1-20260907-005'),
          actorRole: 'V',
        },
      ),
    ).not.toThrow();
    expect(() =>
      transitionCandidate(
        validLedger(validCandidate('CHG-P1-20260907-006', { status: 'under-review' })),
        'CHG-P1-20260907-006',
        {
          ...event('under-review', 'approved', 'CHG-P1-20260907-006'),
          actorRole: 'A',
        },
      ),
    ).toThrow(/human|approval/);
    expect(() =>
      transitionCandidate(
        validLedger(validCandidate('CHG-P1-20260907-007', { status: 'blocked' })),
        'CHG-P1-20260907-007',
        {
          ...event('blocked', 'rolled-back', 'CHG-P1-20260907-007'),
          evidenceRefs: ['evidence/rollback.json'],
        },
      ),
    ).toThrow(/rollback|verified|real/i);
  });

  it('does not inherit unaudited process environment and preserves real exit code 3', async () => {
    await fs.mkdir(testOutputRoot, { recursive: true });
    const rawOutputDir = await fs.mkdtemp(path.join(testOutputRoot, 'code-health-inherited-env-'));
    const original = process.env.CODE_HEALTH_UNAUDITED_SECRET;
    process.env.CODE_HEALTH_UNAUDITED_SECRET = 'inherited-secret-must-not-leak';
    try {
      const { runner, binding } = await createRepositoryRunner(rawOutputDir);
      const result = await runner.run(
        process.execPath,
        ['-e', 'process.stdout.write(process.env.CODE_HEALTH_UNAUDITED_SECRET || "missing")'],
        {
          cwd: repoRoot,
          env: {},
          timeoutMs: 5000,
          binding: binding('CHG-P1-20260907-024'),
        },
      );
      expect(result.exitCode).toBe(0);
      const output = await fs.readFile(path.resolve(repoRoot, result.rawOutputPath), 'utf8');
      expect(output).toContain('missing');
      expect(output).not.toContain('inherited-secret-must-not-leak');

      const exitThree = await runner.run(process.execPath, ['-e', 'process.exit(3)'], {
        cwd: repoRoot,
        env: {},
        timeoutMs: 5000,
        binding: binding('CHG-P1-20260907-024'),
      });
      expect(exitThree.exitCode).toBe(3);
    } finally {
      if (original === undefined) delete process.env.CODE_HEALTH_UNAUDITED_SECRET;
      else process.env.CODE_HEALTH_UNAUDITED_SECRET = original;
      await fs.rm(rawOutputDir, { recursive: true, force: true });
    }
  });

  it('rejects a repository-local raw output symlink that resolves outside the repository', async () => {
    await fs.mkdir(testOutputRoot, { recursive: true });
    const linkParent = await fs.mkdtemp(path.join(testOutputRoot, 'code-health-output-link-'));
    const outsideDir = await fs.mkdtemp(path.join(tmpdir(), 'code-health-outside-'));
    const linkedOutputDir = path.join(linkParent, 'raw');
    try {
      await fs.symlink(outsideDir, linkedOutputDir, process.platform === 'win32' ? 'junction' : 'dir');
      const { runner, binding } = await createRepositoryRunner(linkedOutputDir);
      await expect(
        runner.run(process.execPath, ['-e', 'process.stdout.write("must-not-write")'], {
          cwd: repoRoot,
          env: {},
          timeoutMs: 5000,
          binding: binding('CHG-P1-20260907-025'),
        }),
      ).rejects.toThrow(/symlink|controlled|repository/i);
      expect(await fs.readdir(outsideDir)).toEqual([]);
    } finally {
      await fs.rm(linkParent, { recursive: true, force: true });
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });

  it('requires complete archive guard for verified to archived and binds rollback metadata', () => {
    const candidate = validCandidate('CHG-P1-20260907-008', { status: 'verified' });
    const ledger = validLedger(candidate);
    const archiveEvent = {
      ...event('verified', 'archived', candidate.candidateId),
      actorRole: 'G' as const,
      evidenceRefs: ['evidence/gate.json'],
    };
    expect(() => transitionCandidate(ledger, candidate.candidateId, archiveEvent)).toThrow(/archive|approval|guard/i);

    const completeCandidate = validCandidate('CHG-P1-20260907-008', {
      status: 'verified',
      review: { findings: [], unresolvedQuestions: [], decision: 'approve', humanDecision: 'approve' },
      rollback: { ...candidate.rollback, command: 'git revert COMMIT', patchSha256: 'a'.repeat(64) },
      signatures: [
        {
          role: 'A',
          actor: 'analyst',
          event: 'discovered',
          scopeHash: candidate.changeScope.scopeHash,
          provenanceRef: 'evidence/a.json',
          signedAt: '2026-09-07T00:01:00.000Z',
        },
        {
          role: 'V',
          actor: 'verifier',
          event: 'verified',
          scopeHash: candidate.changeScope.scopeHash,
          provenanceRef: 'evidence/v.json',
          signedAt: '2026-09-07T00:02:00.000Z',
        },
        {
          role: 'G',
          actor: 'gate',
          event: 'gate',
          scopeHash: candidate.changeScope.scopeHash,
          provenanceRef: 'evidence/g.json',
          signedAt: '2026-09-07T00:03:00.000Z',
        },
        {
          role: 'human',
          actor: 'human-decision-maker',
          event: 'approve',
          scopeHash: candidate.changeScope.scopeHash,
          provenanceRef: 'evidence/signature-human.json',
          signedAt: '2026-09-07T00:04:00.000Z',
        },
      ],
      archive: { state: 'not_archived', manifestPath: null, contentHash: null, redactionStatus: 'clean' },
    });
    const completeLedger = validLedger(completeCandidate);
    completeLedger.redaction = { status: 'clean', rules: ['remove secrets'], blockedReasons: [] };
    const approval = validApproval(completeCandidate);
    const archiveFiles = [{ path: completeCandidate.evidenceRef, sha256: '1'.repeat(64) }];
    const archiveContentHash = createHash('sha256').update(JSON.stringify(archiveFiles), 'utf8').digest('hex');
    const rollbackEvidence = {
      command: {
        ...completeCandidate.commands[0]!,
        command: completeCandidate.rollback.command,
        rawOutputPath: 'evidence/rollback.log',
        exitCode: 0,
        observation: 'observed' as const,
      },
      preChangeRevision: completeCandidate.rollback.preChangeRevision,
      patchPath: completeCandidate.rollback.patchPath,
      patchSha256: completeCandidate.rollback.patchSha256!,
      owner: completeCandidate.rollback.owner,
      patchExists: true,
      rawOutputExists: true,
      sourceRevision: revision,
    };
    const completeArchiveEvent = {
      ...event('verified', 'archived', completeCandidate.candidateId),
      actorRole: 'G' as const,
      at: '2026-09-07T00:05:00.000Z',
      evidenceRefs: [
        'archive/CHG-P1-20260907-008.json',
        completeCandidate.commands[0]!.rawOutputPath,
        rollbackEvidence.command.rawOutputPath,
        'evidence/v.json',
        'evidence/g.json',
        'evidence/human.json',
        approval.signatureRef,
      ],
      signatureRef: 'evidence/g.json',
      archiveEvidence: {
        manifestRef: 'archive/CHG-P1-20260907-008.json',
        manifestSha256: archiveContentHash,
        verificationLevel: 'source-bound' as const,
        sourceRevision: revision,
        redactionStatus: 'clean' as const,
      },
    };
    expect(() => transitionCandidate(completeLedger, completeCandidate.candidateId, completeArchiveEvent)).toThrowError(
      expect.objectContaining({
        code: 'NOT_IMPLEMENTED',
      }),
    );
    expect(completeLedger.candidates[0]?.status).toBe('verified');

    const rollbackEvent = {
      ...event('blocked', 'rolled-back', candidate.candidateId),
      actorRole: 'S' as const,
      evidenceRefs: ['evidence/rollback.json'],
      rollbackEvidence: {
        command: { ...candidate.commands[0]!, exitCode: 0, observation: 'observed' as const },
        preChangeRevision: candidate.rollback.preChangeRevision,
        patchPath: candidate.rollback.patchPath,
        patchSha256: 'a'.repeat(64),
        owner: candidate.rollback.owner,
        patchExists: false,
        rawOutputExists: true,
        sourceRevision: revision,
      },
    } as unknown as LedgerEvent;
    expect(() =>
      transitionCandidate(
        validLedger(validCandidate(candidate.candidateId, { status: 'blocked' })),
        candidate.candidateId,
        rollbackEvent,
      ),
    ).toThrow(/rollback|patch|exist/i);
  });

  it('rejects validator bypasses and gate failures without candidate identity', () => {
    const candidate = validCandidate('CHG-P1-20260907-009');
    expect(validateCodeHealthCandidate({ ...candidate, unknownField: true })).toEqual(
      expect.arrayContaining([expect.stringMatching(/unknown property/i)]),
    );
    expect(validateCodeHealthCandidate({ ...candidate, risk: { ...candidate.risk, security: 'bogus' } })).toEqual(
      expect.arrayContaining([expect.stringMatching(/risk|security/i)]),
    );
    expect(
      validateCodeHealthCandidate({ ...candidate, commands: [{ ...candidate.commands[0]!, exitCode: 7 }] }),
    ).toEqual([]);
    expect(
      validateCodeHealthCandidate({
        ...candidate,
        commands: [{ ...candidate.commands[0]!, rawOutputPath: '/outside/raw.log' }],
      }),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/path|relative/i)]));
    expect(
      validateCodeHealthCandidate({
        ...candidate,
        status: 'discovered',
        review: { ...candidate.review, decision: 'approve', humanDecision: 'approve' },
      }),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/discovered|conclusion|decision/i)]));

    expect(() =>
      recordGateFailure(validLedger(candidate), { ...candidate.commands[0]!, exitCode: 1, observation: 'observed' }),
    ).toThrow(/candidate|identity|scope/i);
  });

  it('strictly validates nested candidate records and terminal archive invariants', () => {
    const candidate = validCandidate('CHG-P1-20260907-010');
    expect(validateCodeHealthCandidate({ ...candidate, review: { ...candidate.review, unknown: true } })).toEqual(
      expect.arrayContaining([expect.stringMatching(/review.*unknown property/i)]),
    );
    expect(
      validateCodeHealthCandidate({
        ...candidate,
        status: 'archived',
        archive: { ...candidate.archive, state: 'not_archived' },
      }),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/archive|archived/i)]));
  });

  it('uses structured gate-failure evidence and does not infer evidence from reference names', () => {
    const candidate = validCandidate('CHG-P1-20260907-011');
    const evidence: GateFailureEvidence = {
      ...candidate.commands[0]!,
      rawOutputPath: 'evidence/actual-output.json',
      exitCode: 3,
      observation: 'observed',
      candidateId: candidate.candidateId,
      scopeHash: candidate.changeScope.scopeHash,
      failureKind: 'gate',
    };
    const next = recordGateFailure(validLedger(candidate), candidate.candidateId, evidence);
    expect(next.candidates[0]?.status).toBe('blocked');
    expect(next.events[0]?.gateFailureEvidence).toMatchObject({
      candidateId: candidate.candidateId,
      rawOutputPath: evidence.rawOutputPath,
      exitCode: 3,
    });
  });

  it('requires a human for every review conclusion and rejects successful gate failures', () => {
    const candidate = validCandidate('CHG-P1-20260907-013', { status: 'under-review' });
    expect(() =>
      transitionCandidate(validLedger(candidate), candidate.candidateId, {
        ...event('under-review', 'deferred', candidate.candidateId),
        actorRole: 'V',
      }),
    ).toThrow(/human|role/i);

    expect(() =>
      recordGateFailure(validLedger(validCandidate('CHG-P1-20260907-014')), 'CHG-P1-20260907-014', {
        ...candidate.commands[0]!,
        exitCode: 0,
        observation: 'observed',
        candidateId: 'CHG-P1-20260907-014',
        scopeHash: candidate.changeScope.scopeHash,
        failureKind: 'gate',
      }),
    ).toThrow(/failure|non-zero|exit/i);
  });

  it('runtime validation mirrors schema for exit codes, UTC, paths, and nested additional properties', () => {
    const candidate = validCandidate('CHG-P1-20260907-015');
    expect(validateCodeHealthCandidate({ ...candidate, review: { ...candidate.review, unknown: true } })).toEqual(
      expect.arrayContaining([expect.stringMatching(/review.*unknown property/i)]),
    );
    expect(
      validateCodeHealthCandidate({ ...candidate, commands: [{ ...candidate.commands[0]!, exitCode: -1 }] }),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/exitCode/i)]));
    expect(
      validateCodeHealthCandidate({
        ...candidate,
        commands: [{ ...candidate.commands[0]!, startedAt: '2026-09-07T00:00:00+00:00' }],
      }),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/timestamp/i)]));
    expect(validateCodeHealthCandidate({ ...candidate, files: ['../outside.ts'] })).toEqual(
      expect.arrayContaining([expect.stringMatching(/relative|path/i)]),
    );
    expect(validateCodeHealthCandidate({ ...candidate, archive: { ...candidate.archive, state: 'archived' } })).toEqual(
      expect.arrayContaining([expect.stringMatching(/archive|manifest|hash|redaction/i)]),
    );
  });

  it('exports every planned cross-task API with fail-closed behavior instead of false success', async () => {
    const candidate = validCandidate('CHG-P1-20260907-016', { status: 'under-review' });
    const expectedLedger = validLedger(candidate);
    const expectedErrors = /not implemented|fail.closed|requires/i;
    // Phase 2 gap discovery is real now: an input missing dimensions fails closed instead of being a stub.
    expect(() => findGaps({} as GapDiscoveryInput)).toThrow(/seven dimensions|requires|missing/i);
    expect(validateGapMatrix({}, expectedLedger)).not.toEqual([]);
    // Phase 1 pure implementations are real now: an empty inventory is an empty report, a malformed dynamic
    // trace fails closed on its hash, and a guard closure reports the unexercised scenario.
    expect(buildStaticInventory({ files: [], sourceText: {}, revision })).toMatchObject({
      files: [],
      references: [],
      unknowns: [],
      categories: [],
      commands: [],
    });
    expect(() => mergeDynamicTrace({} as never, {} as never)).toThrow(/sha256/i);
    const emptyContext: FalsePositiveContext = {
      dynamicImports: [],
      reflection: [],
      platforms: [],
      schemas: [],
      templates: [],
      rtmIds: [],
      testHelpers: [],
      generatedReferences: [],
      externalContracts: [],
    };
    const guardLead: Phase1CandidateLead = {
      candidateId: 'CHG-P1-20260907-016',
      classification: 'candidate',
      files: ['src/unused.ts'],
      symbols: ['unusedFunction'],
      staticReferences: [],
      dynamicScenarios: [],
      guardViolations: [],
      status: 'discovered',
    };
    expect(checkFalsePositiveGuards(guardLead, emptyContext)).toEqual(
      expect.arrayContaining([expect.stringMatching(/unexercised-scenario/i)]),
    );
    expect(() => classifyProtectedTest({} as never)).toThrow(expectedErrors);
    expect(() => proveTestRemoval({} as never)).toThrow(expectedErrors);
    expect(() => clusterDuplicates({} as never)).toThrow(expectedErrors);
    expect(() => proveAbstraction({} as never, {} as never)).toThrow(expectedErrors);
    const phase1Root = await createTempGitRepository();
    await expect(
      runPhase1({
        root: phase1Root,
        output: path.join(tmpdir(), 'code-health-phase1-ledger-report.json'),
        scenarios: [],
      }),
    ).resolves.toMatchObject({ exitCode: 0 });
    // Phase 2 TDD harness is real now and requires a gap identity plus an exact argv; it never runs implicitly.
    await expect(runTddHarness({ gap: {} as never, testCommand: [], implementation: null })).rejects.toThrow(
      /gap|argv|requires/i,
    );
    // Valid, exactly-scoped human approval resolves to a controlled patch proposal; nothing is applied.
    await expect(
      applyApproved({
        approval: validApproval(candidate),
        candidate,
        mode: 'dry-run',
        repositoryRoot: '.',
        currentRevision: revision,
      }),
    ).resolves.toMatchObject({
      kind: 'patch-proposal',
      applied: false,
      errorCode: null,
      patchPath: expect.stringMatching(/\.patch$/),
      appliedFiles: [],
      unrelatedFiles: [],
    });
    // The generated rollback plan is real and executable; a non-executable plan is rejected above.
    await expect(executeRollback(candidate.rollback)).resolves.toBe(true);
    expect(evaluateDeletion({ testCount: 1, coverageProvenance: '', governanceFacts: [] }).passed).toBe(false);
  });

  it('rollback evidence binds real patch and raw-output files', async () => {
    const root = await createTempGitRepository();
    const candidateRevision = await repositoryRevision(root);
    const fixture = validCandidate('CHG-P1-20260907-017', { status: 'blocked' });
    const patchBytes = Buffer.from(
      '--- a/src/unused.ts\n+++ b/src/unused.ts\n@@ -1 +1 @@\n-export const unusedFunction = 1;\n+export const unusedFunction = 2;\n',
    );
    const rawBytes = Buffer.from('rollback raw output\n');
    await fs.mkdir(path.join(root, 'evidence'), { recursive: true });
    await fs.writeFile(path.join(root, 'evidence', 'rollback.patch'), patchBytes);
    await fs.writeFile(path.join(root, 'evidence', 'rollback.log'), rawBytes);
    const patchSha256 = sha256Hex(patchBytes);
    const rawOutputSha256 = sha256Hex(rawBytes);
    const candidate = validCandidate('CHG-P1-20260907-017', {
      status: 'blocked',
      revision: candidateRevision,
      commands: [{ ...fixture.commands[0]!, rawOutputPath: 'evidence/rollback.log', rawOutputSha256 }],
      evidenceBinding: { ...fixture.evidenceBinding, revision: candidateRevision },
      rollback: {
        ...fixture.rollback,
        preChangeRevision: candidateRevision.commitSha,
        command: 'git apply evidence/rollback.patch',
        patchPath: 'evidence/rollback.patch',
        patchSha256,
      },
    });
    const rollbackEvidence = {
      command: {
        ...candidate.commands[0]!,
        command: candidate.rollback.command,
        rawOutputPath: 'evidence/rollback.log',
        rawOutputSha256,
        exitCode: 0,
        observation: 'observed' as const,
      },
      preChangeRevision: candidate.rollback.preChangeRevision,
      patchPath: candidate.rollback.patchPath,
      patchSha256: candidate.rollback.patchSha256!,
      owner: candidate.rollback.owner,
      patchExists: true as const,
      rawOutputExists: true as const,
      sourceRevision: candidateRevision,
    };
    const rollbackEventWith = (evidence: typeof rollbackEvidence): LedgerEvent =>
      ({
        ...event('blocked', 'rolled-back', candidate.candidateId),
        actorRole: 'S',
        revision: candidateRevision,
        evidenceRefs: [evidence.command.rawOutputPath],
        rollbackEvidence: evidence,
      }) as unknown as LedgerEvent;
    const context: FileVerificationContext = { repositoryRoot: root, fileVerifier };

    // The real patch and raw output are regular non-symlink files with the declared hashes.
    await expect(
      fileVerifier.verifyRegularNonSymlinkFile({
        root,
        relativePath: 'evidence/rollback.patch',
        expectedSha256: patchSha256,
      }),
    ).resolves.toMatchObject({ ok: true, code: null });
    await expect(
      fileVerifier.verifyRegularNonSymlinkFile({
        root,
        relativePath: 'evidence/rollback.log',
        expectedSha256: rawOutputSha256,
      }),
    ).resolves.toMatchObject({ ok: true, code: null });
    const rolledBack = await transitionCandidateVerified(
      validLedger(candidate),
      candidate.candidateId,
      rollbackEventWith(rollbackEvidence),
      undefined,
      context,
    );
    expect(rolledBack.candidates[0]?.status).toBe('rolled-back');
    expect(rolledBack.events[0]?.rollbackEvidence).toMatchObject({
      patchPath: 'evidence/rollback.patch',
      patchSha256,
      sourceRevision: candidateRevision,
    });

    // Negative cases fail closed with typed codes and never mutate the input ledger.
    const ledger = validLedger(candidate);
    const before = structuredClone(ledger);
    const tamperedCandidate = validCandidate('CHG-P1-20260907-017', {
      ...candidate,
      rollback: { ...candidate.rollback, patchSha256: 'a'.repeat(64) },
    });
    const tamperedLedger = validLedger(tamperedCandidate);
    const tamperedBefore = structuredClone(tamperedLedger);
    await expect(
      transitionCandidateVerified(
        tamperedLedger,
        candidate.candidateId,
        rollbackEventWith({ ...rollbackEvidence, patchSha256: 'a'.repeat(64) }),
        undefined,
        context,
      ),
    ).rejects.toMatchObject({ code: 'EVIDENCE_INVALID' });
    expect(tamperedLedger).toEqual(tamperedBefore);

    const missingRawOutput = {
      ...rollbackEvidence,
      command: { ...rollbackEvidence.command, rawOutputPath: 'evidence/missing-rollback.log' },
    };
    await expect(
      transitionCandidateVerified(
        ledger,
        candidate.candidateId,
        rollbackEventWith(missingRawOutput),
        undefined,
        context,
      ),
    ).rejects.toMatchObject({ code: 'EVIDENCE_INVALID' });
    expect(ledger).toEqual(before);

    await fs.symlink(
      path.join(root, 'evidence', 'rollback.patch'),
      path.join(root, 'evidence', 'rollback-link.patch'),
      'file',
    );
    const symlinkCandidate = validCandidate('CHG-P1-20260907-017', {
      ...candidate,
      rollback: { ...candidate.rollback, patchPath: 'evidence/rollback-link.patch' },
    });
    await expect(
      transitionCandidateVerified(
        validLedger(symlinkCandidate),
        symlinkCandidate.candidateId,
        rollbackEventWith({ ...rollbackEvidence, patchPath: 'evidence/rollback-link.patch' }),
        undefined,
        context,
      ),
    ).rejects.toMatchObject({ code: 'SECURITY_BLOCKED' });
  });

  it('gate failure evidence cannot be recorded from a missing raw-output file', async () => {
    const root = await createTempGitRepository();
    const candidateRevision = await repositoryRevision(root);
    const fixture = validCandidate('CHG-P1-20260907-018');
    const rawBytes = Buffer.from('gate failure raw output\n');
    await fs.mkdir(path.join(root, 'evidence'), { recursive: true });
    await fs.writeFile(path.join(root, 'evidence', 'gate-failure.log'), rawBytes);
    const rawOutputSha256 = sha256Hex(rawBytes);
    const evidenceStore = createCodeHealthEvidenceStore({ repositoryRoot: root, rawOutputRoot: 'evidence' });
    const selector: CandidateSelector = {
      candidateId: fixture.candidateId,
      phase: fixture.phase,
      action: fixture.action,
      files: [...fixture.files],
      symbols: [...fixture.symbols],
      scopeHash: fixture.changeScope.scopeHash,
    };

    // Positive: a real raw output bound to candidate/scope/revision can be recorded as a gate failure.
    const realCandidate = validCandidate('CHG-P1-20260907-018', {
      revision: candidateRevision,
      commands: [{ ...fixture.commands[0]!, rawOutputPath: 'evidence/gate-failure.log', rawOutputSha256 }],
      evidenceBinding: {
        ...fixture.evidenceBinding,
        revision: candidateRevision,
        rawOutputPath: 'evidence/gate-failure.log',
        rawOutputSha256,
      },
    });
    const realContext: EvidenceVerificationContext = {
      repositoryRoot: root,
      fileVerifier,
      evidenceStore,
      binding: {
        candidate: selector,
        revision: candidateRevision,
        rawOutputPath: 'evidence/gate-failure.log',
        rawOutputSha256,
      },
    };
    const recorded = await recordVerifiedGateFailure(
      validLedger(realCandidate),
      realCandidate.candidateId,
      { ...realCandidate.commands[0]!, exitCode: 7, observation: 'observed' },
      realContext,
    );
    expect(recorded.candidates[0]?.status).toBe('blocked');
    expect(recorded.events[0]?.gateFailureEvidence).toMatchObject({
      candidateId: realCandidate.candidateId,
      rawOutputPath: 'evidence/gate-failure.log',
      exitCode: 7,
    });

    // Negative: the same evidence with a missing raw-output file fails closed with a typed code.
    const missingCandidate = validCandidate('CHG-P1-20260907-018', {
      revision: candidateRevision,
      evidenceBinding: { ...fixture.evidenceBinding, revision: candidateRevision },
    });
    const ledger = validLedger(missingCandidate);
    const before = structuredClone(ledger);
    const missingContext: EvidenceVerificationContext = {
      ...realContext,
      binding: {
        candidate: selector,
        revision: candidateRevision,
        rawOutputPath: 'evidence/missing-gate-output.log',
        rawOutputSha256: missingCandidate.commands[0]!.rawOutputSha256,
      },
    };
    await expect(
      recordVerifiedGateFailure(
        ledger,
        missingCandidate.candidateId,
        {
          ...missingCandidate.commands[0]!,
          rawOutputPath: 'evidence/missing-gate-output.log',
          exitCode: 7,
          observation: 'observed',
        },
        missingContext,
      ),
    ).rejects.toMatchObject({ code: 'EVIDENCE_INVALID' });
    await expect(
      recordVerifiedGateFailure(
        ledger,
        missingCandidate.candidateId,
        {
          ...missingCandidate.commands[0]!,
          rawOutputPath: 'evidence/missing-gate-output.log',
          exitCode: 7,
          observation: 'observed',
        },
        missingContext,
      ),
    ).rejects.toBeInstanceOf(CodeHealthError);
    expect(ledger).toEqual(before);
  });

  it('gap validator rejects invalid identity, priority, status, risk, and coverage signal', () => {
    expect(
      validateGapMatrix(
        {
          rows: [
            {
              gapId: 'GAP-1',
              candidateId: 'CHG-P0-00000000-000',
              kind: 'security',
              testLevels: ['unit'],
              existingTestIds: [],
              missingScenario: 'auth bypass',
              evidenceSources: ['evidence/gap.json'],
              risk: null,
              priority: 'urgent',
              owner: 'S-agent',
              rtmIds: ['REQ-1'],
              coverageSignal: null,
              coverageIsSignalOnly: true,
              status: 'bogus',
            },
          ],
        },
        validLedger(validCandidate('CHG-P1-20260907-001', { status: 'under-review' })),
      ),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/candidateId|priority|status|risk|coverage/i)]));
  });

  it('archiveCampaign and verifyArchive return typed NOT_IMPLEMENTED at the 1D boundary', async () => {
    const candidate = validCandidate('CHG-P1-20260907-015', {
      status: 'verified',
      review: { findings: [], unresolvedQuestions: [], decision: 'approve', humanDecision: 'approve' },
      rollback: { ...validCandidate('CHG-P1-20260907-016').rollback, patchSha256: 'a'.repeat(64) },
      signatures: [
        {
          role: 'V',
          actor: 'verifier',
          event: 'verified',
          scopeHash: 'sha256:' + 'e'.repeat(64),
          provenanceRef: 'evidence/verifier.json',
          signedAt: '2026-09-07T00:01:00.000Z',
        },
        {
          role: 'G',
          actor: 'gate',
          event: 'gate',
          scopeHash: 'sha256:' + 'e'.repeat(64),
          provenanceRef: 'evidence/gate.json',
          signedAt: '2026-09-07T00:02:00.000Z',
        },
        {
          role: 'human',
          actor: 'human-decision-maker',
          event: 'approve',
          scopeHash: 'sha256:' + 'e'.repeat(64),
          provenanceRef: 'evidence/human.json',
          signedAt: '2026-09-07T00:03:00.000Z',
        },
      ],
      archive: { state: 'not_archived', manifestPath: null, contentHash: null, redactionStatus: 'clean' },
    });
    const ledger = validLedger(candidate);
    ledger.redaction = { status: 'clean', rules: ['remove secrets'], blockedReasons: [] };
    await expect(
      (await import('../logic/code-health-ledger-logic.js')).archiveCampaign(ledger, {
        approval: validApproval(candidate),
      }),
    ).rejects.toThrowError(
      expect.objectContaining({
        code: 'NOT_IMPLEMENTED',
      }),
    );
    await expect(
      (await import('../logic/code-health-ledger-logic.js')).verifyArchive('manifest.json'),
    ).rejects.toThrowError(
      expect.objectContaining({
        code: 'NOT_IMPLEMENTED',
      }),
    );
  });
});

describe('code-health candidate lifecycle reducer (1C)', () => {
  it('reducer 只更新目标 candidate，events append-only 且可重放', () => {
    const ledger = ledgerWithTwoCandidates();
    const next = transitionCandidate(ledger, firstId, evidencedEvent(firstId));
    expect(next.candidates.find((c) => c.candidateId === secondId)?.status).toBe('discovered');
    expect(next.events).toHaveLength(1);
    expect(replayCandidate(next, firstId).status).toBe('evidenced');
    expect(() =>
      transitionCandidate(next, firstId, { ...evidencedEvent(firstId), eventId: next.events[0]!.eventId }),
    ).toThrowError(expect.objectContaining({ code: 'STRUCTURE_INVALID' }));
    // Append-only: the previous ledger is never mutated, never rewritten, and never trimmed.
    expect(ledger.events).toHaveLength(0);
    expect(ledger.candidates[0]?.status).toBe('discovered');
    expect(next).not.toBe(ledger);
  });

  it('状态、角色、candidate identity、revision、scope 和事件时间不匹配均拒绝且 ledger 深相等不变', () => {
    const ledger = ledgerWithTwoCandidates('under-review');
    ledger.events = [reviewEvent(firstId)];
    const before = structuredClone(ledger);
    expect(() => transitionCandidate(ledger, firstId, eventWithRole('approved', 'A'))).toThrow(/human|role/i);
    expect(() => transitionCandidate(ledger, secondId, eventFor(firstId))).toThrow(/candidate|scope/i);
    expect(() =>
      transitionCandidate(ledger, firstId, { ...evidencedEvent(firstId), scopeHash: 'sha256:' + 'f'.repeat(64) }),
    ).toThrow(/scope/i);
    expect(() =>
      transitionCandidate(ledger, firstId, {
        ...evidencedEvent(firstId),
        revision: { ...revision, commitSha: 'b'.repeat(40) },
      }),
    ).toThrow(/revision/i);
    expect(() => transitionCandidate(ledger, firstId, eventWithOlderTimestamp())).toThrow(/timestamp|monotonic/i);
    expect(ledger).toEqual(before);
  });

  it('gate failure 必须是已验证 observed non-zero evidence，并把 nextRequiredRoles 固定为 R→V→G→S', async () => {
    const { ledger, realGateFailureEvidence } = await realGateFailureFixture();
    const blocked = recordGateFailure(ledger, firstId, realGateFailureEvidence);
    expect(blocked.candidates.find((c) => c.candidateId === firstId)?.status).toBe('blocked');
    expect(nextRequiredRoles(blocked, firstId)).toEqual(['R', 'V', 'G', 'S']);
    expect(() => recordGateFailure(ledger, firstId, { ...realGateFailureEvidence, exitCode: 0 })).toThrowError(
      expect.objectContaining({ code: 'EVIDENCE_INVALID' }),
    );
    expect(() =>
      recordGateFailure(ledger, firstId, { ...realGateFailureEvidence, observation: 'not_run', exitCode: null }),
    ).toThrowError(expect.objectContaining({ code: 'EVIDENCE_INVALID' }));
    // A refused gate-failure call is atomic: the previous ledger keeps its status and history.
    expect(ledger.candidates[0]?.status).toBe('discovered');
    expect(ledger.events).toEqual([]);
  });

  it('没有完整 R→V→G 就不能由 S 返工，成功事件不能覆盖 blocked', async () => {
    const { ledger, realGateFailureEvidence, revision: candidateRevision } = await realGateFailureFixture();
    const blocked = recordGateFailure(ledger, firstId, realGateFailureEvidence);
    const validRootCauseEvent = rootCauseChainEvent('root-cause', 'R', candidateRevision, '2026-09-07T00:03:00.000Z');
    const sReworkEvent = reworkEvent(candidateRevision, '2026-09-07T00:04:00.000Z');
    expect(() => appendReworkEvent(blocked, firstId, sReworkEvent)).toThrow(/R|root|review|gate/i);
    const afterR = appendRootCauseEvent(blocked, firstId, validRootCauseEvent);
    expect(nextRequiredRoles(afterR, firstId)).toEqual(['V', 'G', 'S']);
    expect(() => appendReworkEvent(afterR, firstId, sReworkEvent)).toThrow(/V|G/i);
    expect(() =>
      transitionCandidate(
        blocked,
        firstId,
        candidateEvent(firstId, 'blocked', 'approved', {
          actorRole: 'human',
          at: '2026-09-07T00:04:00.000Z',
          revision: candidateRevision,
        }),
      ),
    ).toThrow(/blocked|transition|allow/i);
    expect(afterR.candidates.find((c) => c.candidateId === firstId)?.status).toBe('blocked');
  });

  it('GapRow 严格拒绝未知枚举、缺 risk、错误 candidate、空 evidence、coverage 非 signal-only 和未知字段', () => {
    const ledger = ledgerWithTwoCandidates('under-review');
    const validGap = validGapRow(firstId);
    const errors = validateGapMatrix(
      {
        rows: [
          {
            ...validGap,
            kind: 'bogus',
            priority: 'urgent',
            status: 'verified',
            unknown: true,
            risk: null,
            coverageIsSignalOnly: false,
          },
        ],
      },
      ledger,
    );
    expect(errors).toEqual(
      expect.arrayContaining([expect.stringMatching(/kind|priority|status|risk|coverage|unknown|candidate/i)]),
    );
    expect(validateGapMatrix({ rows: [validGap, validGap] }, ledger)).toEqual(
      expect.arrayContaining([expect.stringMatching(/duplicate|gapId/i)]),
    );
    expect(validateGapMatrix({ rows: [{ ...validGap, evidenceSources: [] }] }, ledger)).toEqual(
      expect.arrayContaining([expect.stringMatching(/evidence/i)]),
    );
    expect(validateGapMatrix({ rows: [{ ...validGap, candidateId: 'CHG-P1-20260907-999' }] }, ledger)).toEqual(
      expect.arrayContaining([expect.stringMatching(/candidate/i)]),
    );
    expect(validateGapMatrix({ rows: [validGap] }, ledger)).toEqual([]);
  });

  it('approval 只能匹配 human exact scope/revision，applyApproved 返回受控 proposal 且不写工作树', async () => {
    const tempRoot = await createTempGitRepository();
    const candidate = validCandidate(firstId, { status: 'under-review' });
    const approval = validApproval(candidate);
    const headBefore = await git(tempRoot, ['rev-parse', 'HEAD']);
    const before = await gitStatus(tempRoot);
    const result = await applyApproved({
      candidate,
      approval,
      mode: 'dry-run',
      repositoryRoot: tempRoot,
      currentRevision: candidate.revision,
    });
    expect(result).toMatchObject({
      kind: 'patch-proposal',
      applied: false,
      errorCode: null,
      mode: 'dry-run',
      patchPath: expect.stringMatching(/\.patch$/),
      appliedFiles: [],
      unrelatedFiles: [],
    });
    expect(result.rollback?.executable).toBe(true);
    expect(await gitStatus(tempRoot)).toEqual(before);
    await expect(
      applyApproved({
        candidate,
        approval: { ...approval, actor: 'S-agent' },
        mode: 'patch',
        repositoryRoot: tempRoot,
        currentRevision: candidate.revision,
      }),
    ).rejects.toMatchObject({ code: 'EVIDENCE_INVALID' });
    await expect(
      applyApproved({
        candidate,
        approval: { ...approval, approvedFiles: ['src/outside.ts'] },
        mode: 'commit',
        repositoryRoot: tempRoot,
        currentRevision: candidate.revision,
      }),
    ).rejects.toMatchObject({ code: 'SCOPE_MISMATCH' });
    expect(await gitStatus(tempRoot)).toEqual(before);
    expect(await git(tempRoot, ['rev-parse', 'HEAD'])).toBe(headBefore);
  });

  it('角色约束只允许 A/S evidence、V review、human approval、S implementation、V/G verification，R/O 不得代签', () => {
    const underReview = ledgerWithTwoCandidates('under-review');
    for (const role of ['R', 'O', 'V', 'S', 'A'] as const) {
      expect(() => transitionCandidate(underReview, firstId, eventWithRole('approved', role))).toThrowError(
        expect.objectContaining({ code: 'ROLE_FORBIDDEN' }),
      );
    }
    const approved = ledgerWithTwoCandidates('approved');
    const advancedRevision = nextRevision();
    expect(() =>
      transitionCandidate(
        approved,
        firstId,
        candidateEvent(firstId, 'approved', 'implemented', {
          eventKind: 'implementation',
          actorRole: 'V',
          previousRevision: revision,
          revision: advancedRevision,
          at: '2026-09-07T00:06:00.000Z',
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'ROLE_FORBIDDEN' }));
    const implemented = transitionCandidate(
      approved,
      firstId,
      candidateEvent(firstId, 'approved', 'implemented', {
        eventKind: 'implementation',
        actorRole: 'S',
        previousRevision: revision,
        revision: advancedRevision,
        at: '2026-09-07T00:06:00.000Z',
      }),
    );
    expect(implemented.candidates.find((c) => c.candidateId === firstId)?.status).toBe('implemented');
    expect(() =>
      transitionCandidate(
        implemented,
        firstId,
        candidateEvent(firstId, 'implemented', 'verified', {
          eventKind: 'verification',
          actorRole: 'S',
          revision: advancedRevision,
          at: '2026-09-07T00:07:00.000Z',
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'ROLE_FORBIDDEN' }));
    const verified = transitionCandidate(
      implemented,
      firstId,
      candidateEvent(firstId, 'implemented', 'verified', {
        eventKind: 'verification',
        actorRole: 'V',
        revision: advancedRevision,
        at: '2026-09-07T00:07:00.000Z',
      }),
    );
    expect(verified.candidates.find((c) => c.candidateId === firstId)?.status).toBe('verified');
  });

  it('replayCandidate 对嵌入状态不一致、事件重排和重复 eventId fail-closed', () => {
    const next = transitionCandidate(ledgerWithTwoCandidates(), firstId, evidencedEvent(firstId));
    const tampered = structuredClone(next);
    tampered.candidates[0]!.status = 'verified';
    expect(() => replayCandidate(tampered, firstId)).toThrowError(
      expect.objectContaining({ code: 'STRUCTURE_INVALID' }),
    );

    const second = transitionCandidate(next, firstId, reviewEvent(firstId));
    const reordered = structuredClone(second);
    reordered.events = [reordered.events[1]!, reordered.events[0]!];
    expect(() => replayCandidate(reordered, firstId)).toThrowError(
      expect.objectContaining({ code: 'STRUCTURE_INVALID' }),
    );

    const duplicated = structuredClone(next);
    duplicated.events = [duplicated.events[0]!, structuredClone(duplicated.events[0]!)];
    expect(() => replayCandidate(duplicated, firstId)).toThrowError(
      expect.objectContaining({ code: 'STRUCTURE_INVALID' }),
    );
    expect(second.events).toHaveLength(2);
    expect(replayCandidate(second, firstId).status).toBe('under-review');
  });

  it('root-cause 链必须按 R→V→G 顺序推进，完成前 S 不得 rework', async () => {
    const { ledger, realGateFailureEvidence, revision: candidateRevision } = await realGateFailureFixture();
    const blocked = recordGateFailure(ledger, firstId, realGateFailureEvidence);
    const validRootCauseEvent = rootCauseChainEvent('root-cause', 'R', candidateRevision, '2026-09-07T00:03:00.000Z');
    const rootCauseReview = rootCauseChainEvent(
      'root-cause-review',
      'V',
      candidateRevision,
      '2026-09-07T00:03:30.000Z',
    );
    const rootCauseGate = rootCauseChainEvent('root-cause-gate', 'G', candidateRevision, '2026-09-07T00:03:45.000Z');
    expect(() => appendRootCauseEvent(blocked, firstId, rootCauseReview)).toThrow(/R|order|required/i);
    expect(() => appendRootCauseEvent(blocked, firstId, { ...validRootCauseEvent, actorRole: 'V' })).toThrowError(
      expect.objectContaining({ code: 'ROLE_FORBIDDEN' }),
    );
    expect(() =>
      appendRootCauseEvent(blocked, firstId, reworkEvent(candidateRevision, '2026-09-07T00:03:10.000Z')),
    ).toThrow(/root-cause/i);
    const afterR = appendRootCauseEvent(blocked, firstId, validRootCauseEvent);
    const afterV = appendRootCauseEvent(afterR, firstId, rootCauseReview);
    expect(nextRequiredRoles(afterV, firstId)).toEqual(['G', 'S']);
    const afterG = appendRootCauseEvent(afterV, firstId, rootCauseGate);
    expect(nextRequiredRoles(afterG, firstId)).toEqual(['S']);
    const reworked = appendReworkEvent(afterG, firstId, reworkEvent(candidateRevision, '2026-09-07T00:04:00.000Z'));
    expect(reworked.candidates.find((c) => c.candidateId === firstId)?.status).toBe('evidenced');
    expect(nextRequiredRoles(reworked, firstId)).toEqual([]);
    expect(replayCandidate(reworked, firstId).status).toBe('evidenced');
    // R never fixes and never signs for S.
    expect(() =>
      appendReworkEvent(afterG, firstId, {
        ...reworkEvent(candidateRevision, '2026-09-07T00:04:00.000Z'),
        actorRole: 'R',
      }),
    ).toThrowError(expect.objectContaining({ code: 'ROLE_FORBIDDEN' }));
  });

  it('GapRow 拒绝未知嵌套字段、空 RTM、未绑定 revision 和越权 status', () => {
    const ledger = ledgerWithTwoCandidates('discovered');
    const validGap = validGapRow(firstId);
    expect(validateGapRow(validGap, ledger, new Set())).toEqual([]);
    expect(validateGapRow({ ...validGap, risk: { ...validGap.risk, unknownNested: true } }, ledger, new Set())).toEqual(
      expect.arrayContaining([expect.stringMatching(/risk|unknown/i)]),
    );
    expect(validateGapRow({ ...validGap, rtmIds: [] }, ledger, new Set())).toEqual(
      expect.arrayContaining([expect.stringMatching(/rtm/i)]),
    );
    expect(validateGapRow({ ...validGap, testLevels: [] }, ledger, new Set())).toEqual(
      expect.arrayContaining([expect.stringMatching(/testLevels/i)]),
    );
    expect(validateGapRow({ ...validGap, coverageIsSignalOnly: false }, ledger, new Set())).toEqual(
      expect.arrayContaining([expect.stringMatching(/coverage/i)]),
    );
    expect(validateGapRow({ ...validGap, status: 'verified' }, ledger, new Set())).toEqual(
      expect.arrayContaining([expect.stringMatching(/status|candidate/i)]),
    );
    const staleLedger = ledgerWithTwoCandidates('discovered');
    staleLedger.baseline = { ...revision, commitSha: 'b'.repeat(40) };
    expect(validateGapRow(validGap, staleLedger, new Set())).toEqual(
      expect.arrayContaining([expect.stringMatching(/revision/i)]),
    );
    expect(validateGapRow(validGap, ledger, new Set([validGap.gapId]))).toEqual(
      expect.arrayContaining([expect.stringMatching(/duplicate|gapId/i)]),
    );
  });

  it('approval 拒绝 V/S/G/O actor、stale revision、空 signatureRef 与扩大 symbols 的 scope', async () => {
    const candidate = validCandidate(firstId, { status: 'under-review' });
    const approval = validApproval(candidate);
    for (const actor of ['V-agent', 'S-agent', 'G-agent', 'O-agent', 'automation-bot']) {
      expect(validateApprovalScope(candidate, { ...approval, actor })).toEqual(
        expect.arrayContaining([expect.stringMatching(/human|actor/i)]),
      );
    }
    expect(
      validateApprovalScope(candidate, { ...approval, revision: { ...revision, treeSha: 'c'.repeat(40) } }),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/revision/i)]));
    expect(validateApprovalScope(candidate, { ...approval, signatureRef: '' })).toEqual(
      expect.arrayContaining([expect.stringMatching(/signature/i)]),
    );
    expect(
      validateApprovalScope(candidate, { ...approval, approvedSymbols: [...approval.approvedSymbols, 'extra'] }),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/scope|symbols/i)]));
    await expect(
      applyApproved({
        candidate,
        approval: { ...approval, revision: { ...revision, commitSha: 'b'.repeat(40) } },
        mode: 'dry-run',
        repositoryRoot: '.',
        currentRevision: revision,
      }),
    ).rejects.toMatchObject({ code: 'REVISION_MISMATCH' });
  });

  it('gate failure evidence 接受 argv JSON 命令，但拒绝携带 shell 控制符的实参（M6 裁定）', () => {
    const candidate = validCandidate(firstId, { status: 'discovered' });
    const reasons: string[] = [];
    const argvJson = {
      ...candidate.commands[0]!,
      command: JSON.stringify({ command: 'node', args: ['--version'] }),
    };
    expect(validateCommandEvidence(argvJson, 'commands[0]', reasons)).toBe(true);
    expect(reasons).toEqual([]);
    const unsafe = { ...argvJson, command: JSON.stringify({ command: 'node', args: ['a && rm -rf b'] }) };
    expect(validateCommandEvidence(unsafe, 'commands[0]', [])).toBe(false);
    expect(() =>
      recordGateFailure(ledgerWithTwoCandidates(), firstId, {
        ...unsafe,
        exitCode: 7,
        observation: 'observed',
        candidateId: firstId,
        scopeHash,
        failureKind: 'gate',
      }),
    ).toThrowError(expect.objectContaining({ code: 'EVIDENCE_INVALID' }));
  });
});

describe('code-health lifecycle fix round 1', () => {
  it('I1: implementation 事件原子推进 candidate revision 与 evidenceBinding.revision，后续事件必须使用新 revision', () => {
    const ledger = ledgerWithTwoCandidates('approved');
    const advancedRevision = nextRevision();
    const implemented = transitionCandidate(
      ledger,
      firstId,
      candidateEvent(firstId, 'approved', 'implemented', {
        eventKind: 'implementation',
        actorRole: 'S',
        previousRevision: revision,
        revision: advancedRevision,
        at: '2026-09-07T00:06:00.000Z',
      }),
    );
    const advanced = implemented.candidates.find((c) => c.candidateId === firstId);
    expect(advanced?.status).toBe('implemented');
    expect(advanced?.revision).toEqual(advancedRevision);
    expect(advanced?.evidenceBinding.revision).toEqual(advancedRevision);
    expect(advanced && validateCodeHealthCandidate(advanced)).toEqual([]);
    expect(replayCandidate(implemented, firstId).status).toBe('implemented');
    // Atomic: the previous ledger still carries the pre-implementation revision.
    expect(ledger.candidates[0]?.revision).toEqual(revision);
    // A later event still pinned to the old revision is stale.
    expect(() =>
      transitionCandidate(
        implemented,
        firstId,
        candidateEvent(firstId, 'implemented', 'verified', {
          eventKind: 'verification',
          actorRole: 'V',
          at: '2026-09-07T00:07:00.000Z',
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'REVISION_MISMATCH' }));
    const verified = transitionCandidate(
      implemented,
      firstId,
      candidateEvent(firstId, 'implemented', 'verified', {
        eventKind: 'verification',
        actorRole: 'V',
        revision: advancedRevision,
        at: '2026-09-07T00:07:00.000Z',
      }),
    );
    expect(verified.candidates.find((c) => c.candidateId === firstId)?.status).toBe('verified');
    // A revision advanced by a verified implementation chain must not reject the candidate gaps.
    expect(validateGapRow(validGapRow(firstId), verified, new Set())).toEqual([]);
  });

  it('I1 负例：缺 previousRevision、previousRevision 不匹配、相同 revision、非 implementation 事件携带新 revision 均拒绝', () => {
    const advancedRevision = nextRevision();
    const ledger = ledgerWithTwoCandidates('approved');
    expect(() =>
      transitionCandidate(
        ledger,
        firstId,
        candidateEvent(firstId, 'approved', 'implemented', {
          eventKind: 'implementation',
          actorRole: 'S',
          revision: advancedRevision,
          at: '2026-09-07T00:06:00.000Z',
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'STRUCTURE_INVALID' }));
    expect(() =>
      transitionCandidate(
        ledger,
        firstId,
        candidateEvent(firstId, 'approved', 'implemented', {
          eventKind: 'implementation',
          actorRole: 'S',
          previousRevision: { ...revision, commitSha: 'f'.repeat(40) },
          revision: advancedRevision,
          at: '2026-09-07T00:06:00.000Z',
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'REVISION_MISMATCH' }));
    expect(() =>
      transitionCandidate(
        ledger,
        firstId,
        candidateEvent(firstId, 'approved', 'implemented', {
          eventKind: 'implementation',
          actorRole: 'S',
          previousRevision: revision,
          revision,
          at: '2026-09-07T00:06:00.000Z',
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'REVISION_MISMATCH' }));
    expect(() =>
      transitionCandidate(
        ledgerWithTwoCandidates(),
        firstId,
        candidateEvent(firstId, 'discovered', 'evidenced', {
          revision: advancedRevision,
          at: '2026-09-07T00:02:00.000Z',
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'REVISION_MISMATCH' }));
    // Refused advances stay atomic.
    expect(ledger.candidates[0]?.revision).toEqual(revision);
    expect(ledger.candidates[0]?.status).toBe('approved');
    expect(ledger.events).toEqual([]);
  });

  it('I1 负例：重放拒绝与事件历史不一致的 revision', () => {
    const advancedRevision = nextRevision();
    const ledger = ledgerWithTwoCandidates('approved');
    const implemented = transitionCandidate(
      ledger,
      firstId,
      candidateEvent(firstId, 'approved', 'implemented', {
        eventKind: 'implementation',
        actorRole: 'S',
        previousRevision: revision,
        revision: advancedRevision,
        at: '2026-09-07T00:06:00.000Z',
      }),
    );
    const verified = transitionCandidate(
      implemented,
      firstId,
      candidateEvent(firstId, 'implemented', 'verified', {
        eventKind: 'verification',
        actorRole: 'V',
        revision: advancedRevision,
        at: '2026-09-07T00:07:00.000Z',
      }),
    );
    const staleEmbedded = structuredClone(verified);
    staleEmbedded.candidates[0]!.revision = revision;
    expect(() => replayCandidate(staleEmbedded, firstId)).toThrowError(
      expect.objectContaining({ code: 'STRUCTURE_INVALID' }),
    );
    const staleEvent = structuredClone(verified);
    staleEvent.events[1] = { ...staleEvent.events[1]!, revision };
    expect(() => replayCandidate(staleEvent, firstId)).toThrowError(
      expect.objectContaining({ code: 'STRUCTURE_INVALID' }),
    );
  });

  it('I2: recordVerifiedGateFailure 消费 store 的 ok=false 结果，拒绝且 ledger 不变', async () => {
    const fixture = await realGateFailureFixture();
    const binding: EvidenceBinding = {
      candidate: {
        candidateId: firstId,
        phase: 'P1',
        action: 'delete-code',
        files: ['src/unused.ts'],
        symbols: ['unusedFunction'],
        scopeHash,
      },
      revision: fixture.revision,
      rawOutputPath: fixture.realGateFailureEvidence.rawOutputPath,
      rawOutputSha256: fixture.realGateFailureEvidence.rawOutputSha256,
    };
    const rejectingStore = (code: 'EVIDENCE_INVALID' | 'SECURITY_BLOCKED'): EvidenceStore => ({
      putRawOutput: () => Promise.reject(new Error('unused in this negative case')),
      verify: async (_ref, expected) => ({ ok: false, code, binding: expected, reason: 'injected store rejection' }),
    });
    const contextOf = (evidenceStore: EvidenceStore): EvidenceVerificationContext => ({
      repositoryRoot: '.',
      fileVerifier,
      evidenceStore,
      binding,
    });
    const before = structuredClone(fixture.ledger);
    await expect(
      recordVerifiedGateFailure(
        fixture.ledger,
        firstId,
        fixture.realGateFailureEvidence,
        contextOf(rejectingStore('EVIDENCE_INVALID')),
      ),
    ).rejects.toMatchObject({ code: 'EVIDENCE_INVALID' });
    await expect(
      recordVerifiedGateFailure(
        fixture.ledger,
        firstId,
        fixture.realGateFailureEvidence,
        contextOf(rejectingStore('SECURITY_BLOCKED')),
      ),
    ).rejects.toBeInstanceOf(CodeHealthError);
    await expect(
      recordVerifiedGateFailure(
        fixture.ledger,
        firstId,
        fixture.realGateFailureEvidence,
        contextOf(rejectingStore('SECURITY_BLOCKED')),
      ),
    ).rejects.toMatchObject({ code: 'SECURITY_BLOCKED' });
    expect(fixture.ledger).toEqual(before);
  });

  it('I3: 创建事件 null→discovered 作为首条事件真实可用（限 A/O），并可继续正常转移', () => {
    const ledger = ledgerWithTwoCandidates();
    const created = transitionCandidate(ledger, firstId, creationEvent(firstId, 'A'));
    expect(created.candidates.find((c) => c.candidateId === firstId)?.status).toBe('discovered');
    expect(created.events).toHaveLength(1);
    expect(replayCandidate(created, firstId)).toMatchObject({ status: 'discovered', eventCount: 1 });
    expect(transitionCandidate(ledger, firstId, creationEvent(firstId, 'O')).events).toHaveLength(1);
    const evidenced = transitionCandidate(created, firstId, evidencedEvent(firstId));
    expect(replayCandidate(evidenced, firstId).status).toBe('evidenced');
    expect(ledger.events).toEqual([]);
  });

  it('I3 负例：重复创建、非首条创建、null→非 discovered、非 A/O 角色与重放伪造创建均拒绝', () => {
    const ledger = ledgerWithTwoCandidates();
    const created = transitionCandidate(ledger, firstId, creationEvent(firstId, 'A'));
    expect(() =>
      transitionCandidate(created, firstId, creationEvent(firstId, 'A', '2026-09-07T00:02:00.000Z')),
    ).toThrow(/creation|history|discovered/i);
    expect(() =>
      transitionCandidate(
        ledger,
        firstId,
        candidateEvent(firstId, null, 'evidenced', { eventKind: 'evidence', actorRole: 'A' }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'TRANSITION_INVALID' }));
    for (const role of ['S', 'V', 'G', 'R', 'human'] as const) {
      expect(() => transitionCandidate(ledger, firstId, creationEvent(firstId, role))).toThrowError(
        expect.objectContaining({ code: 'ROLE_FORBIDDEN' }),
      );
    }
    const forged = structuredClone(created);
    forged.events = [{ ...forged.events[0]!, to: 'evidenced' }];
    expect(() => replayCandidate(forged, firstId)).toThrowError(expect.objectContaining({ code: 'STRUCTURE_INVALID' }));
  });

  it('M2: GapRow 拒绝空字符串的 existingTestIds/rtmIds 条目', () => {
    const ledger = ledgerWithTwoCandidates('under-review');
    const validGap = validGapRow(firstId);
    expect(validateGapRow({ ...validGap, existingTestIds: [''] }, ledger, new Set())).toEqual(
      expect.arrayContaining([expect.stringMatching(/existingTestIds/i)]),
    );
    expect(validateGapRow({ ...validGap, rtmIds: [''] }, ledger, new Set())).toEqual(
      expect.arrayContaining([expect.stringMatching(/rtm/i)]),
    );
  });

  it('M9: 空 GapRow 矩阵不通过', () => {
    const ledger = ledgerWithTwoCandidates('under-review');
    expect(validateGapMatrix({ rows: [] }, ledger)).toEqual(
      expect.arrayContaining([expect.stringMatching(/empty|row/i)]),
    );
  });
});

describe('code-health final review fix (I-1/I-2)', () => {
  it('I-1: GapRow 拒绝中英文无边界占位语义，具体可审计文本仍通过', () => {
    const ledger = ledgerWithTwoCandidates('discovered');
    const validGap = validGapRow(firstId);
    expect(validateGapRow(validGap, ledger, new Set())).toEqual([]);
    const placeholders = [
      '待补',
      '待补充',
      '以后处理',
      '待定',
      '后续处理',
      '待办',
      '稍后',
      '暂缓',
      '未知',
      '未提供',
      '暂无',
      '无',
      'TBD',
      'TODO',
      'pending',
      'unknown',
      'N/A',
      'none',
      'later',
      'not provided',
      'Not-Provided',
    ];
    for (const placeholder of placeholders) {
      expect(validateGapRow({ ...validGap, missingScenario: placeholder }, ledger, new Set())).toEqual(
        expect.arrayContaining([expect.stringMatching(/missingScenario/i)]),
      );
      expect(validateGapRow({ ...validGap, owner: placeholder }, ledger, new Set())).toEqual(
        expect.arrayContaining([expect.stringMatching(/owner/i)]),
      );
    }
    // Whitespace-padded placeholder tokens are still placeholders.
    expect(
      validateGapRow({ ...validGap, missingScenario: '  待补  ', owner: '　以后处理　' }, ledger, new Set()),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/missingScenario/i), expect.stringMatching(/owner/i)]));
    // Concrete, bounded text keeps passing.
    expect(
      validateGapRow(
        {
          ...validGap,
          missingScenario: 'invalid token is rejected without exposing secret material',
          owner: 'S-agent (security owner)',
        },
        ledger,
        new Set(),
      ),
    ).toEqual([]);
  });

  it('I-1b: GapRow 拒绝带标点/包裹的占位语义，含 token 的具体文本仍通过', () => {
    const ledger = ledgerWithTwoCandidates('discovered');
    const validGap = validGapRow(firstId);
    expect(validateGapRow(validGap, ledger, new Set())).toEqual([]);
    // Edge-wrapped or punctuated placeholders must be rejected for both fields.
    const wrappedPlaceholders = [
      '待补。',
      '（待补）',
      '（ 待补 ）',
      '"以后处理"',
      '「待定」',
      '[待定]',
      '暂无。',
      ' 暂无 ',
      '　待办　',
      'later.',
      '(TBD)',
      'N/A.',
      'unknown！',
      '"待补充"',
    ];
    for (const placeholder of wrappedPlaceholders) {
      expect(validateGapRow({ ...validGap, missingScenario: placeholder }, ledger, new Set())).toEqual([
        'missingScenario is required and must be specific',
      ]);
      expect(validateGapRow({ ...validGap, owner: placeholder }, ledger, new Set())).toEqual([
        'owner is required and must be specific',
      ]);
    }
    // Bounded text that merely mentions a placeholder token keeps passing.
    expect(
      validateGapRow(
        {
          ...validGap,
          missingScenario: '无风险不等于已验证',
          owner: '待补工作已在前一阶段完成',
        },
        ledger,
        new Set(),
      ),
    ).toEqual([]);
    expect(
      validateGapRow(
        {
          ...validGap,
          missingScenario: '未知的输入 token 被拒绝',
          owner: 'None of the existing tests cover this path',
        },
        ledger,
        new Set(),
      ),
    ).toEqual([]);
    expect(
      validateGapRow({ ...validGap, owner: 'TODO is mentioned but the text is specific' }, ledger, new Set()),
    ).toEqual([]);
  });

  it('I-2: gap 不得领先 candidate：implemented candidate 只允许到 implemented，verified gap 仅限 verified/archived candidate', () => {
    const implementedLedger = ledgerWithTwoCandidates('implemented');
    expect(validateGapRow(validGapRow(firstId), implementedLedger, new Set())).toEqual([]);
    const verifiedGap = verifiedGapRow(firstId);
    expect(validateGapRow({ ...verifiedGap, status: 'implemented' }, implementedLedger, new Set())).toEqual([]);
    expect(validateGapRow(verifiedGap, implementedLedger, new Set())).toEqual(
      expect.arrayContaining([expect.stringMatching(/status|candidate/i)]),
    );
    // Exactly matching lifecycles pass: verified gap at verified candidate, and at archived candidate.
    expect(validateGapRow(verifiedGap, ledgerWithTwoCandidates('verified'), new Set())).toEqual([]);
    expect(validateGapRow(verifiedGap, ledgerWithTwoCandidates('archived'), new Set())).toEqual([]);
    // Before implementation, both implemented and verified gaps stay ahead of the candidate.
    for (const status of ['discovered', 'evidenced', 'under-review', 'approved', 'deferred'] as const) {
      const ledger = ledgerWithTwoCandidates(status);
      expect(validateGapRow({ ...verifiedGap, status: 'implemented' }, ledger, new Set())).toEqual(
        expect.arrayContaining([expect.stringMatching(/status|candidate/i)]),
      );
      expect(validateGapRow(verifiedGap, ledger, new Set())).toEqual(
        expect.arrayContaining([expect.stringMatching(/status|candidate/i)]),
      );
    }
  });
});
