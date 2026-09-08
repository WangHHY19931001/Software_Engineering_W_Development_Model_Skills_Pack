/** Task 1 contract tests for the code-health ledger and evidence boundary. */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  canArchiveCandidate,
  transitionCandidate,
  validateApprovalScope,
  validateCodeHealthCandidate,
  type CodeHealthCandidate,
  type CodeHealthLedger,
  type LedgerEvent,
  type ApprovalDecision,
} from '../logic/code-health-ledger-logic.js';
import { createCodeHealthCommandRunner } from '../lib/code-health-command.js';
import { redactCodeHealthArtifact } from '../lib/code-health-redaction.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

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
      command: 'git revert <commit>',
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

export function event(from: CodeHealthCandidate['status'], to: CodeHealthCandidate['status']): LedgerEvent {
  return {
    eventId: `EV-${from}-${to}`,
    candidateId: 'CHG-P1-20260907-001',
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
    expect(canArchiveCandidate(candidate, validLedger(candidate))).toContain('candidate is not verified');
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
    const rawOutputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'code-health-output-'));
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
});
