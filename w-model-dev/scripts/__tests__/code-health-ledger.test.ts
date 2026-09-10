/* eslint-disable security/detect-non-literal-fs-filename -- All filesystem paths are generated beneath test-owned temporary output directories. */
/** Task 1 contract tests for the code-health ledger and evidence boundary. */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import type {
  CandidateSelector,
  EvidenceBinding,
  EvidenceVerificationContext,
  FileVerificationContext,
  RevisionIdentity,
} from '../logic/code-health-contract.js';
import {
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
  proveAbstraction,
  proveTestRemoval,
  recordGateFailure,
  runPhase1,
  runTddHarness,
  transitionCandidate,
  validateApprovalScope,
  validateCodeHealthCandidate,
  validateGapMatrix,
  type CodeHealthCandidate,
  type CodeHealthLedger,
  type GapDiscoveryInput,
  type LedgerEvent,
  type ApprovalDecision,
} from '../logic/code-health-ledger-logic.js';
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
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'code-health-ledger',
  GIT_AUTHOR_EMAIL: 'code-health-ledger@example.test',
  GIT_COMMITTER_NAME: 'code-health-ledger',
  GIT_COMMITTER_EMAIL: 'code-health-ledger@example.test',
};

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
  await git(root, ['init', '--quiet']);
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'unused.ts'), 'export const unusedFunction = 1;\n');
  await git(root, ['add', '--all']);
  await git(root, ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'initial']);
  return root;
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
      const timeout = await runner.run(process.execPath, ['-e', 'setTimeout(() => {}, 1000)'], {
        cwd: repoRoot,
        env: {},
        timeoutMs: 10,
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
    const evidence = { ...candidate.commands[0]!, rawOutputPath: 'evidence/actual-output.json', exitCode: 3 };
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
    void expectedLedger;
    const expectedErrors = /not implemented|fail.closed|requires/i;
    expect(() => findGaps({} as GapDiscoveryInput)).toThrow(expectedErrors);
    expect(() => validateGapMatrix({})).not.toEqual([]);
    expect(() => buildStaticInventory({ files: [], sourceText: new Map(), revision })).toThrow(expectedErrors);
    expect(() => mergeDynamicTrace({} as never, {} as never)).toThrow(expectedErrors);
    expect(() => checkFalsePositiveGuards({} as never, {} as never)).toThrow(expectedErrors);
    expect(() => classifyProtectedTest({} as never)).toThrow(expectedErrors);
    expect(() => proveTestRemoval({} as never)).toThrow(expectedErrors);
    expect(() => clusterDuplicates({} as never)).toThrow(expectedErrors);
    expect(() => proveAbstraction({} as never, {} as never)).toThrow(expectedErrors);
    await expect(runPhase1({ root: '.', output: 'report.json', scenarios: [] })).rejects.toThrow(expectedErrors);
    await expect(runTddHarness({ gap: {} as never, testCommand: [], implementation: null })).rejects.toThrow(
      expectedErrors,
    );
    await expect(
      applyApproved({
        approval: validApproval(candidate),
        candidate,
        mode: 'dry-run',
        repositoryRoot: '.',
        currentRevision: revision,
      }),
    ).rejects.toThrow(expectedErrors);
    await expect(executeRollback(candidate.rollback)).resolves.toBe(false);
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
    const rolledBack = await transitionCandidate(
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
      transitionCandidate(
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
      transitionCandidate(ledger, candidate.candidateId, rollbackEventWith(missingRawOutput), undefined, context),
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
      transitionCandidate(
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
    const recorded = await recordGateFailure(
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
      recordGateFailure(
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
      recordGateFailure(
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
      validateGapMatrix({
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
      }),
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
