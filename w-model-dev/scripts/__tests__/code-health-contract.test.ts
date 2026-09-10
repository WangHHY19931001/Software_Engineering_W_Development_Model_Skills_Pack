/* eslint-disable security/detect-non-literal-fs-filename -- Fixture names are test-local and resolved beneath the checked-in samples directory. */
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CodeHealthError,
  type CandidateSelector,
  type CodeHealthCandidate,
  type ErrorCode,
  type EvidenceBinding,
  type RevisionIdentity,
  validateCodeHealthCandidate,
  validateLedgerEvent,
} from '../logic/code-health-contract.js';
import {
  consumePhase1Candidate,
  consumePhase2Gap,
  consumePhase3Test,
  consumePhase4Cluster,
} from '../logic/code-health-phase-boundaries.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.join(here, '..', 'samples', 'code-health');
const revision: RevisionIdentity = {
  commitSha: 'a'.repeat(40),
  treeSha: 'b'.repeat(40),
  sourceBundleSha256: 'c'.repeat(64),
  analyzedAt: '2026-09-07T00:00:00.000Z',
};

async function loadFixture(file: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(path.join(samplesDir, file), 'utf8')) as unknown;
}

describe('code-health canonical contract', () => {
  it('canonical contract 暴露稳定 ErrorCode、CandidateSelector 和 EvidenceBinding', () => {
    const selector: CandidateSelector = {
      candidateId: 'CHG-P1-20260907-101',
      phase: 'P1',
      action: 'delete-code',
      files: ['src/candidate.ts'],
      symbols: ['candidate'],
      scopeHash: `sha256:${'a'.repeat(64)}`,
    };
    const binding: EvidenceBinding = {
      candidate: selector,
      revision,
      rawOutputPath: 'evidence/raw.log',
      rawOutputSha256: 'b'.repeat(64),
    };
    expect(binding.candidate.scopeHash).toBe(selector.scopeHash);
    expect(
      new Set<ErrorCode>([
        'ARG_INVALID',
        'STRUCTURE_INVALID',
        'EVIDENCE_INVALID',
        'SCOPE_MISMATCH',
        'REVISION_MISMATCH',
        'SECURITY_BLOCKED',
        'ROLE_FORBIDDEN',
        'TRANSITION_INVALID',
        'NOT_IMPLEMENTED',
      ]).size,
    ).toBe(9);
    expect(new CodeHealthError('NOT_IMPLEMENTED', 'boundary is not implemented')).toBeInstanceOf(Error);
  });

  it('Schema 与 runtime contract 同时拒绝未知嵌套字段、错误枚举和 coverage 授权', async () => {
    const valid = await loadFixture('valid-candidate.json');
    expect(validateBySchema('code-health-candidate', valid).valid).toBe(true);
    expect(validateCodeHealthCandidate(valid)).toEqual([]);
    const missingBinding = { ...(valid as Record<string, unknown>) };
    delete missingBinding.evidenceBinding;
    expect(validateCodeHealthCandidate(missingBinding)).toEqual(
      expect.arrayContaining([expect.stringMatching(/evidenceBinding|required|binding/i)]),
    );
    expect(validateBySchema('code-health-candidate', missingBinding).valid).toBe(false);
    expect(
      validateBySchema('code-health-candidate', {
        ...(valid as Record<string, unknown>),
        review: { ...((valid as Record<string, unknown>).review as Record<string, unknown>), unknownNested: true },
      }).valid,
    ).toBe(false);
    expect(
      validateCodeHealthCandidate({
        ...(valid as Record<string, unknown>),
        rtmImpact: {
          ...((valid as Record<string, unknown>).rtmImpact as Record<string, unknown>),
          coverageIsSignalOnly: false,
        },
      }),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/coverageIsSignalOnly/)]));
  });

  it('Phase 1-4 compile-only consumers 只接受 canonical 类型且不执行 IO', () => {
    expect(consumePhase1Candidate).toBeTypeOf('function');
    expect(consumePhase2Gap).toBeTypeOf('function');
    expect(consumePhase3Test).toBeTypeOf('function');
    expect(consumePhase4Cluster).toBeTypeOf('function');
  });

  it('LedgerEvent Schema 与 runtime 对 typed event shape 给出一致结论', async () => {
    const fixture = (await loadFixture('valid-ledger-event.json')) as Record<string, unknown>;
    const revisionIdentity = fixture.revision as RevisionIdentity;
    const base: Record<string, unknown> = { ...fixture };
    const failureCommand = {
      command: 'npm run check:gate',
      cwd: '.',
      environment: { NODE_ENV: 'test' },
      platform: 'win32',
      toolVersions: { node: '20.0.0' },
      startedAt: '2026-09-07T00:04:00.000Z',
      endedAt: '2026-09-07T00:04:01.000Z',
      exitCode: 7,
      observation: 'observed',
      rawOutputPath: 'evidence/raw/gate.txt',
      rawOutputSha256: 'd'.repeat(64),
    };
    const gateFailure = {
      ...failureCommand,
      candidateId: 'CHG-P1-20260907-001',
      scopeHash: `sha256:${'e'.repeat(64)}`,
      failureKind: 'gate',
    };
    const rollbackEvidence: Record<string, unknown> = {
      command: { ...failureCommand, command: 'git revert COMMIT', exitCode: 0 },
      preChangeRevision: 'a'.repeat(40),
      patchPath: 'evidence/rollback.patch',
      patchSha256: 'b'.repeat(64),
      owner: 'S-agent',
      patchExists: true,
      rawOutputExists: true,
      sourceRevision: revisionIdentity,
    };
    const archiveEvidence: Record<string, unknown> = {
      manifestRef: 'archive/CHG-P1-20260907-001.json',
      manifestSha256: 'c'.repeat(64),
      verificationLevel: 'package-only',
      sourceRevision: revisionIdentity,
      redactionStatus: 'clean',
    };
    const gateFailureEvent: Record<string, unknown> = {
      ...base,
      eventId: 'EV-CHG-P1-20260907-001-gate-failure',
      eventKind: 'gate-failure',
      from: 'discovered',
      to: 'blocked',
      actorRole: 'G',
      gateFailureEvidence: gateFailure,
    };
    const implementationEvent: Record<string, unknown> = {
      ...base,
      eventId: 'EV-CHG-P1-20260907-001-implementation',
      eventKind: 'implementation',
      from: 'approved',
      to: 'implemented',
      actorRole: 'S',
      previousRevision: revisionIdentity,
    };
    const rollbackEvent: Record<string, unknown> = {
      ...base,
      eventId: 'EV-CHG-P1-20260907-001-rollback',
      eventKind: 'rollback',
      from: 'blocked',
      to: 'rolled-back',
      actorRole: 'S',
      rollbackEvidence,
    };
    const archiveEvent: Record<string, unknown> = {
      ...base,
      eventId: 'EV-CHG-P1-20260907-001-archive',
      eventKind: 'archive',
      from: 'verified',
      to: 'archived',
      actorRole: 'G',
      archiveEvidence,
    };
    const validEvents: Array<[string, Record<string, unknown>]> = [
      ['evidence event', base],
      ['gate failure event', gateFailureEvent],
      ['implementation event', implementationEvent],
      ['rollback event', rollbackEvent],
      ['archive event', archiveEvent],
    ];
    for (const [name, event] of validEvents) {
      expect(validateBySchema('code-health-ledger-event', event).valid, name).toBe(true);
      expect(validateLedgerEvent(event), name).toEqual([]);
    }
    const blockedWithoutEvidence = { ...gateFailureEvent };
    delete blockedWithoutEvidence.gateFailureEvidence;
    const implementationWithoutPrevious = { ...implementationEvent };
    delete implementationWithoutPrevious.previousRevision;
    const rollbackWithoutSourceRevision = { ...rollbackEvidence };
    delete rollbackWithoutSourceRevision.sourceRevision;
    const invalidEvents: Array<[string, Record<string, unknown>]> = [
      ['unknown top-level field', { ...base, unknownTopLevel: true }],
      [
        'unknown nested gate failure field',
        { ...gateFailureEvent, gateFailureEvidence: { ...gateFailure, unknownNested: true } },
      ],
      ['unknown failure kind', { ...gateFailureEvent, gateFailureEvidence: { ...gateFailure, failureKind: 'bogus' } }],
      ['blocked without gate failure evidence', blockedWithoutEvidence],
      ['previous revision outside implementation', { ...base, previousRevision: revisionIdentity }],
      ['implementation without previous revision', implementationWithoutPrevious],
      ['rollback without source revision', { ...rollbackEvent, rollbackEvidence: rollbackWithoutSourceRevision }],
      [
        'rollback with missing patch',
        { ...rollbackEvent, rollbackEvidence: { ...rollbackEvidence, patchExists: false } },
      ],
      [
        'rollback with unknown nested field',
        { ...rollbackEvent, rollbackEvidence: { ...rollbackEvidence, unknownNested: true } },
      ],
      [
        'archive with legacy guard object',
        { ...archiveEvent, archiveEvidence: { ...archiveEvidence, candidateId: 'CHG-P1-20260907-001' } },
      ],
      [
        'archive with unfrozen verification level',
        { ...archiveEvent, archiveEvidence: { ...archiveEvidence, verificationLevel: 'source-verified' } },
      ],
    ];
    for (const [name, event] of invalidEvents) {
      expect(validateBySchema('code-health-ledger-event', event).valid, name).toBe(false);
      expect(validateLedgerEvent(event), name).not.toEqual([]);
    }
  });

  it('Schema 与 runtime parity 覆盖严格 ISO 时间、相对路径和敏感 environment 键', async () => {
    const candidate = (await loadFixture('valid-candidate.json')) as Record<string, unknown>;
    const event = (await loadFixture('valid-ledger-event.json')) as Record<string, unknown>;
    const candidateRevision = candidate.revision as Record<string, unknown>;
    const candidateAgreement = (value: unknown): [boolean, boolean] => [
      validateBySchema('code-health-candidate', value).valid,
      validateCodeHealthCandidate(value).length === 0,
    ];
    const eventAgreement = (value: unknown): [boolean, boolean] => [
      validateBySchema('code-health-ledger-event', value).valid,
      validateLedgerEvent(value).length === 0,
    ];

    expect(candidateAgreement(candidate)).toEqual([true, true]);
    for (const analyzedAt of ['2026-09-07T00:00:00Z', '2026-09-07T00:00:00+00:00', '2026-09-07T00:00:00.000+00:00']) {
      expect(candidateAgreement({ ...candidate, revision: { ...candidateRevision, analyzedAt } }), analyzedAt).toEqual([
        false,
        false,
      ]);
    }
    for (const invalidPath of [
      '../outside.ts',
      '/absolute.ts',
      'C:/drive.ts',
      'src//dup.ts',
      'src/dir/',
      'src\\win.ts',
    ]) {
      expect(candidateAgreement({ ...candidate, files: [invalidPath] }), invalidPath).toEqual([false, false]);
    }
    expect(candidateAgreement({ ...candidate, files: ['src/unused.ts'] })).toEqual([true, true]);
    const archive = candidate.archive as Record<string, unknown>;
    expect(candidateAgreement({ ...candidate, archive: { ...archive, manifestPath: null } })).toEqual([true, true]);
    expect(candidateAgreement({ ...candidate, archive: { ...archive, manifestPath: '../outside.json' } })).toEqual([
      false,
      false,
    ]);

    expect(eventAgreement(event)).toEqual([true, true]);
    expect(eventAgreement({ ...event, at: '2026-09-07T00:00:00Z' })).toEqual([false, false]);
    expect(eventAgreement({ ...event, evidenceRefs: ['evidence//dup.json'] })).toEqual([false, false]);
    expect(eventAgreement({ ...event, signatureRef: '/absolute/signature.json' })).toEqual([false, false]);
    expect(eventAgreement({ ...event, signatureRef: 'C:/drive/signature.json' })).toEqual([false, false]);

    const failureCommand = {
      command: 'npm run check:gate',
      cwd: '.',
      environment: { NODE_ENV: 'test' },
      platform: 'win32',
      toolVersions: { node: '20.0.0' },
      startedAt: '2026-09-07T00:04:00.000Z',
      endedAt: '2026-09-07T00:04:01.000Z',
      exitCode: 7,
      observation: 'observed',
      rawOutputPath: 'evidence/raw/gate.txt',
      rawOutputSha256: 'd'.repeat(64),
    };
    const gateFailure = {
      ...failureCommand,
      candidateId: 'CHG-P1-20260907-001',
      scopeHash: `sha256:${'e'.repeat(64)}`,
      failureKind: 'gate',
    };
    const gateFailureEvent = {
      ...event,
      eventKind: 'gate-failure',
      from: 'discovered',
      to: 'blocked',
      actorRole: 'G',
      gateFailureEvidence: gateFailure,
    };
    expect(eventAgreement(gateFailureEvent)).toEqual([true, true]);
    expect(
      eventAgreement({
        ...gateFailureEvent,
        gateFailureEvidence: { ...gateFailure, environment: { NODE_ENV: 'test' } },
      }),
    ).toEqual([true, true]);
    for (const environment of [{ API_TOKEN: 'redacted' }, { Authorization: 'redacted' }, { 'api-key': 'redacted' }]) {
      expect(
        eventAgreement({ ...gateFailureEvent, gateFailureEvidence: { ...gateFailure, environment } }),
        JSON.stringify(environment),
      ).toEqual([false, false]);
    }
  });
});

export type ContractFixture = CodeHealthCandidate;
