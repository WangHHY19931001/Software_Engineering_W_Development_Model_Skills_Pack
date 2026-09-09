/* eslint-disable security/detect-non-literal-fs-filename -- All filesystem paths are generated beneath test-owned temporary output directories. */
/** Task 1 contract tests for the code-health ledger and evidence boundary. */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  applyApproved,
  buildStaticInventory,
  canArchiveCandidate,
  checkFalsePositiveGuards,
  classifyProtectedTest,
  clusterDuplicates,
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
    candidateId,
    from,
    to,
    actorRole: 'A',
    at: '2026-09-07T00:02:00.000Z',
    revision,
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
      const runner = createCodeHealthCommandRunner({ rawOutputDir });
      const result = await runner.run(process.execPath, ['--version'], { cwd: repoRoot, env: {}, timeoutMs: 5000 });
      expect(result.command).toContain('--version');
      expect(result.exitCode).toBe(0);
      expect(result.observation).toBe('observed');
      expect(result.rawOutputSha256).toMatch(/^[0-9a-f]{64}$/);
      await expect(
        runner.run('node -e "process.exit(0)"', [], { cwd: repoRoot, env: {}, timeoutMs: 5000 }),
      ).rejects.toThrow(/argv/);
    } finally {
      await fs.rm(rawOutputDir, { recursive: true, force: true });
    }
  });

  it('argv/env secrets and sensitive output fail closed before execution and evidence persistence', async () => {
    await fs.mkdir(testOutputRoot, { recursive: true });
    const rawOutputDir = await fs.mkdtemp(path.join(testOutputRoot, 'code-health-secret-output-'));
    try {
      const runner = createCodeHealthCommandRunner({ rawOutputDir });
      await expect(
        runner.run(process.execPath, ['-e', 'console.log("password=super-secret")'], {
          cwd: repoRoot,
          env: { API_TOKEN: 'token-value-that-must-not-run' },
          timeoutMs: 5000,
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
      const runner = createCodeHealthCommandRunner({ rawOutputDir });
      const failed = await runner.run(process.execPath, ['-e', 'console.error("failure output") ; process.exit(1)'], {
        cwd: repoRoot,
        env: {},
        timeoutMs: 5000,
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
        });
        expect(result.exitCode).toBe(exitCode);
        expect(result.observation).toBe('observed');
      }
      const unavailable = await runner.run('definitely-not-a-real-code-health-command', [], {
        cwd: repoRoot,
        env: {},
        timeoutMs: 5000,
      });
      expect(unavailable.exitCode).toBeNull();
      expect(unavailable.observation).toBe('unavailable');
      const timeout = await runner.run(process.execPath, ['-e', 'setTimeout(() => {}, 1000)'], {
        cwd: repoRoot,
        env: {},
        timeoutMs: 10,
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
      const runner = createCodeHealthCommandRunner({ rawOutputDir });
      await expect(
        runner.run(
          process.execPath,
          ['-e', 'const bytes = Buffer.from([0xff]); process.stdout.write(bytes); process.stderr.write(bytes)'],
          { cwd: repoRoot, env: {}, timeoutMs: 5000 },
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
      const runner = createCodeHealthCommandRunner({ rawOutputDir, now: () => new Date('2026-09-07T00:00:00.000Z') });
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          runner.run(process.execPath, ['-e', 'process.stdout.write("ok")'], {
            cwd: repoRoot,
            env: {},
            timeoutMs: 5000,
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
      const runner = createCodeHealthCommandRunner({ rawOutputDir });
      const result = await runner.run(
        process.execPath,
        ['-e', 'process.stdout.write(process.env.CODE_HEALTH_UNAUDITED_SECRET || "missing")'],
        {
          cwd: repoRoot,
          env: {},
          timeoutMs: 5000,
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
      const runner = createCodeHealthCommandRunner({ rawOutputDir: linkedOutputDir });
      await expect(
        runner.run(process.execPath, ['-e', 'process.stdout.write("must-not-write")'], {
          cwd: repoRoot,
          env: {},
          timeoutMs: 5000,
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
        candidateId: completeCandidate.candidateId,
        scope: completeCandidate.changeScope,
        approval,
        commands: completeCandidate.commands,
        manifest: {
          path: 'archive/CHG-P1-20260907-008.json',
          files: archiveFiles,
          contentHash: archiveContentHash,
          redaction: { status: 'clean' as const, reasons: [] },
          verificationLevel: 'source-bound' as const,
        },
        rollback: rollbackEvidence,
        sourceRevision: revision,
        signatures: { verifier: 'evidence/v.json', gate: 'evidence/g.json', human: approval.signatureRef },
      },
    };
    const archived = transitionCandidate(completeLedger, completeCandidate.candidateId, completeArchiveEvent);
    expect(archived.candidates[0]?.status).toBe('archived');
    expect(archived.candidates[0]?.archive).toEqual({
      state: 'archived',
      manifestPath: 'archive/CHG-P1-20260907-008.json',
      contentHash: archiveContentHash,
      redactionStatus: 'clean',
    });

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
      },
    };
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

    const rollbackCandidate = validCandidate('CHG-P1-20260907-012', {
      status: 'blocked',
      rollback: { ...candidate.rollback, patchSha256: 'a'.repeat(64) },
    });
    const rollbackEvidence = {
      command: {
        ...rollbackCandidate.commands[0]!,
        rawOutputPath: 'evidence/actual-output.json',
        command: rollbackCandidate.rollback.command,
        exitCode: 0,
        observation: 'observed' as const,
      },
      preChangeRevision: rollbackCandidate.rollback.preChangeRevision,
      patchPath: rollbackCandidate.rollback.patchPath,
      patchSha256: rollbackCandidate.rollback.patchSha256,
      owner: rollbackCandidate.rollback.owner,
      patchExists: true,
      rawOutputExists: true,
    };
    const rolledBack = transitionCandidate(validLedger(rollbackCandidate), rollbackCandidate.candidateId, {
      ...event('blocked', 'rolled-back', rollbackCandidate.candidateId),
      actorRole: 'S',
      evidenceRefs: [rollbackEvidence.command.rawOutputPath],
      rollbackEvidence,
    });
    expect(rolledBack.candidates[0]?.status).toBe('rolled-back');
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
    expect(validateCodeHealthCandidate({ ...candidate, commands: [{ ...candidate.commands[0]!, exitCode: -1 }] })).toEqual(
      expect.arrayContaining([expect.stringMatching(/exitCode/i)]),
    );
    expect(validateCodeHealthCandidate({ ...candidate, commands: [{ ...candidate.commands[0]!, startedAt: '2026-09-07T00:00:00+00:00' }] })).toEqual(
      expect.arrayContaining([expect.stringMatching(/timestamp/i)]),
    );
    expect(validateCodeHealthCandidate({ ...candidate, files: ['../outside.ts'] })).toEqual(
      expect.arrayContaining([expect.stringMatching(/relative|path/i)]),
    );
    expect(validateCodeHealthCandidate({ ...candidate, archive: { ...candidate.archive, state: 'archived' } })).toEqual(
      expect.arrayContaining([expect.stringMatching(/archive|manifest|hash|redaction/i)]),
    );
  });

  it('exports every planned cross-task API with fail-closed behavior instead of false success', async () => {
    const candidate = validCandidate('CHG-P1-20260907-016');
    const ledger = validLedger(candidate);
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
    await expect(runTddHarness({ gap: {} as never, testCommand: [], implementation: null })).rejects.toThrow(expectedErrors);
    await expect(applyApproved({ approval: validApproval(candidate), candidate, mode: 'dry-run' })).rejects.toThrow(expectedErrors);
    await expect(executeRollback(candidate.rollback)).resolves.toBe(false);
    expect(evaluateDeletion({ testCount: 1, coverageProvenance: '', governanceFacts: [] }).passed).toBe(false);
  });

  it('archiveCampaign and verifyArchive fail closed instead of trusting reference names or partial manifests', async () => {
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
    const denied = await (await import('../logic/code-health-ledger-logic.js')).archiveCampaign(ledger, {
      approval: validApproval(candidate),
    });
    expect(denied.exitCode).toBe(1);

    const root = await fs.mkdtemp(path.join(testOutputRoot, 'code-health-partial-archive-'));
    try {
      const payload = Buffer.from('archive payload', 'utf8');
      const payloadHash = createHash('sha256').update(payload).digest('hex');
      await fs.writeFile(path.join(root, 'payload.txt'), payload);
      await fs.writeFile(
        path.join(root, 'manifest.json'),
        JSON.stringify({ files: [{ path: 'payload.txt', sha256: payloadHash }], contentHash: payloadHash }),
      );
      const verification = await (await import('../logic/code-health-ledger-logic.js')).verifyArchive('manifest.json', {
        root,
      });
      expect(verification.ok).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
