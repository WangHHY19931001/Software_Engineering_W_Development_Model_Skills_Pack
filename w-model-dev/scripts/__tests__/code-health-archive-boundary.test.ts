/* eslint-disable security/detect-non-literal-fs-filename -- Boundary fixtures live beneath a per-test OS temp root. */

/**
 * Task 1D archive boundary tests.
 *
 * These tests freeze the Task 8 ArchiveManifest contract, the two verification levels, and the typed
 * `NOT_IMPLEMENTED` results of producer/consumer/verifier. Task 1 must never write, read, or hash a real
 * archive: every entry point resolves a fail-closed boundary result and leaves the tree and ledger byte-identical.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateBySchema } from '../infrastructure/schema-loader.js';
import {
  createTask1ArchiveBoundary,
  type ArchiveConsumeInput,
  type ArchiveProduceInput,
  type ArchiveVerifyInput,
} from '../lib/code-health-archive-boundary.js';
import type {
  ApprovalDecision,
  ArchiveBoundaryResult,
  ArchiveManifest,
  CodeHealthCandidate,
  CodeHealthLedger,
  RevisionIdentity,
} from '../logic/code-health-contract.js';

const CANDIDATE_ID = 'CHG-P1-20260907-001';
const revision: RevisionIdentity = {
  commitSha: 'a'.repeat(40),
  treeSha: 'b'.repeat(40),
  sourceBundleSha256: 'c'.repeat(64),
  analyzedAt: '2026-09-07T00:00:00.000Z',
};

function validManifest(verificationLevel: ArchiveManifest['verificationLevel']): ArchiveManifest {
  return {
    archiveId: `ARC-${CANDIDATE_ID}`,
    candidateId: CANDIDATE_ID,
    scope: {
      candidateId: CANDIDATE_ID,
      phase: 'P1',
      action: 'delete-code',
      files: ['src/unused.ts'],
      symbols: ['unusedFunction'],
      scopeHash: `sha256:${'d'.repeat(64)}`,
    },
    contentHash: 'e'.repeat(64),
    files: [
      { path: 'ledger/EV-001.json', kind: 'ledger', sha256: 'f'.repeat(64) },
      { path: 'evidence/evidence.json', kind: 'evidence', sha256: '1'.repeat(64) },
      { path: 'rollback/rollback.patch', kind: 'rollback', sha256: '2'.repeat(64) },
    ],
    sourceRevision: revision,
    approvalRef: 'approval/approval.json',
    reviewRefs: ['reviews/verifier.json'],
    gateRefs: ['gate-logs/check.json'],
    humanSignatureRef: 'signatures/human.json',
    redaction: { status: 'clean', reasons: ['secrets removed'] },
    verificationLevel,
    rollbackRef: 'rollback/rollback.patch',
    producerMetadata: { producerId: 'task8-archive-producer', producerVersion: '0.0.0-frozen' },
    createdAt: '2026-09-07T00:05:00.000Z',
  };
}

function candidateFixture(): CodeHealthCandidate {
  return {
    candidateId: CANDIDATE_ID,
    phase: 'P1',
    action: 'delete-code',
    status: 'verified',
    files: ['src/unused.ts'],
    symbols: ['unusedFunction'],
    tests: [],
    callSites: [],
    sources: ['static-inventory.json'],
    commands: [],
    revision,
    confidence: { level: 'high', score: 0.9, rationale: 'frozen archive boundary fixture', uncertainties: [] },
    risk: {
      severity: 'low',
      behavior: 'low',
      security: 'none',
      concurrency: 'none',
      platform: 'low',
      lifecycle: 'low',
      governance: 'low',
      rationale: 'isolated helper with a direct rollback path',
    },
    rtmImpact: {
      rtmBefore: ['REQ-001'],
      rtmAfter: ['REQ-001'],
      coverageBefore: { statements: null, branches: null, functions: null, lines: null },
      coverageAfter: { statements: null, branches: null, functions: null, lines: null },
      testLevels: ['unit'],
      unmappedScenarios: [],
      coverageIsSignalOnly: true,
    },
    coverageImpact: {
      rtmBefore: ['REQ-001'],
      rtmAfter: ['REQ-001'],
      coverageBefore: { statements: null, branches: null, functions: null, lines: null },
      coverageAfter: { statements: null, branches: null, functions: null, lines: null },
      testLevels: ['unit'],
      unmappedScenarios: [],
      coverageIsSignalOnly: true,
    },
    rollback: {
      preChangeRevision: revision.commitSha,
      command: 'git revert HEAD',
      patchPath: 'rollback/rollback.patch',
      owner: 'S-agent',
      executable: true,
      patchSha256: '2'.repeat(64),
    },
    review: { findings: [], unresolvedQuestions: [], decision: 'approve', humanDecision: 'approve' },
    signatures: [],
    changeScope: {
      files: ['src/unused.ts'],
      symbols: ['unusedFunction'],
      scopeHash: `sha256:${'d'.repeat(64)}`,
    },
    evidenceBinding: {
      candidate: {
        candidateId: CANDIDATE_ID,
        phase: 'P1',
        action: 'delete-code',
        files: ['src/unused.ts'],
        symbols: ['unusedFunction'],
        scopeHash: `sha256:${'d'.repeat(64)}`,
      },
      revision,
      rawOutputPath: 'evidence/evidence.json',
      rawOutputSha256: '1'.repeat(64),
    },
    evidenceRef: 'evidence/evidence.json',
    archive: { state: 'not_archived', manifestPath: null, contentHash: null, redactionStatus: 'clean' },
  };
}

function approvalFixture(): ApprovalDecision {
  return {
    candidateId: CANDIDATE_ID,
    decision: 'approve',
    approvedAction: 'delete-code',
    approvedFiles: ['src/unused.ts'],
    approvedSymbols: ['unusedFunction'],
    scopeHash: `sha256:${'d'.repeat(64)}`,
    rationale: 'The exact scope is independently reviewed and directly reversible.',
    actor: 'human-decision-maker',
    decidedAt: '2026-09-07T00:03:00.000Z',
    signatureRef: 'signatures/human.json',
    revision,
  };
}

function ledgerFixture(): CodeHealthLedger {
  return {
    schemaVersion: '1.0',
    campaignId: 'CHC-20260907',
    createdAt: '2026-09-07T00:00:00.000Z',
    baseline: revision,
    environmentMatrix: [],
    candidates: [candidateFixture()],
    events: [],
    appendOnly: true,
    redaction: { status: 'clean', rules: ['remove secrets'], blockedReasons: [] },
  };
}

function producerInput(verificationLevel: ArchiveProduceInput['verificationLevel']): ArchiveProduceInput {
  return { candidate: candidateFixture(), ledger: ledgerFixture(), approval: approvalFixture(), verificationLevel };
}

function consumerInput(
  packageRoot: string,
  verificationLevel: ArchiveConsumeInput['verificationLevel'],
  sourceProject?: string,
): ArchiveConsumeInput {
  return { manifestPath: 'package/manifest.json', packageRoot, verificationLevel, sourceProject };
}

function verifierInput(
  packageRoot: string,
  verificationLevel: ArchiveConsumeInput['verificationLevel'],
  sourceProject?: string,
): ArchiveVerifyInput {
  return { ...consumerInput(packageRoot, verificationLevel, sourceProject), expectedRevision: revision };
}

function expectNotImplemented(result: ArchiveBoundaryResult, level: ArchiveManifest['verificationLevel']): void {
  expect(result).toMatchObject({
    ok: false,
    errorCode: 'NOT_IMPLEMENTED',
    manifest: null,
    verificationLevel: level,
    createdPaths: [],
  });
  expect(result.reason.length).toBeGreaterThan(0);
  expect(Object.keys(result).sort()).toEqual([
    'createdPaths',
    'errorCode',
    'manifest',
    'ok',
    'reason',
    'verificationLevel',
  ]);
}

async function snapshotTree(root: string): Promise<string[]> {
  const snapshot: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (entry.isDirectory()) {
        snapshot.push(`dir:${relative}`);
        await walk(absolute);
      } else {
        snapshot.push(`file:${relative}:${(await fs.readFile(absolute)).toString('base64')}`);
      }
    }
  };
  await walk(root);
  return snapshot;
}

async function snapshotTreeAndLedger(root: string): Promise<{ tree: string[]; ledger: string }> {
  return {
    tree: await snapshotTree(root),
    ledger: await fs.readFile(path.join(root, 'ledger', 'ledger.json'), 'utf8'),
  };
}

async function createTempArchiveRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'code-health-archive-boundary-'));
  await fs.mkdir(path.join(root, 'package'), { recursive: true });
  await fs.mkdir(path.join(root, 'ledger'), { recursive: true });
  await fs.mkdir(path.join(root, 'source'), { recursive: true });
  await fs.writeFile(path.join(root, 'ledger', 'ledger.json'), JSON.stringify(ledgerFixture(), null, 2), 'utf8');
  await fs.writeFile(
    path.join(root, 'package', 'manifest.json'),
    JSON.stringify(validManifest('package-only'), null, 2),
    'utf8',
  );
  await fs.writeFile(path.join(root, 'package', 'payload.txt'), 'frozen archive payload\n', 'utf8');
  await fs.writeFile(path.join(root, 'source', 'unused.ts'), 'export const unusedFunction = () => {};\n', 'utf8');
  return root;
}

describe('code-health task 1D archive boundary', () => {
  it('ArchiveManifest 冻结 scope、files kind/hash、revision、签名、redaction 和 verificationLevel', () => {
    const manifest: ArchiveManifest = validManifest('package-only');
    expect(validateBySchema('code-health-archive', manifest).valid).toBe(true);
    expect(validateBySchema('code-health-archive', validManifest('source-bound')).valid).toBe(true);
    expect(validateBySchema('code-health-archive', { ...manifest, verificationLevel: 'source-verified' }).valid).toBe(
      false,
    );
    expect(
      validateBySchema('code-health-archive', { ...manifest, scope: { ...manifest.scope, unknown: true } }).valid,
    ).toBe(false);
    expect(
      validateBySchema('code-health-archive', {
        ...manifest,
        files: [{ ...manifest.files[0]!, kind: 'archive-package' }],
      }).valid,
    ).toBe(false);
    expect(
      validateBySchema('code-health-archive', {
        ...manifest,
        producerMetadata: { ...manifest.producerMetadata, unknown: true },
      }).valid,
    ).toBe(false);
    const manifestAsArchivedRecord = { ...manifest, status: 'archived' } as Record<string, unknown>;
    expect(validateBySchema('code-health-archive', manifestAsArchivedRecord).valid).toBe(false);
  });

  it('Task 1D producer/consumer/verifier 全部返回 typed NOT_IMPLEMENTED 且没有文件或 ledger 副作用', async () => {
    const tempRoot = await createTempArchiveRoot();
    try {
      const before = await snapshotTreeAndLedger(tempRoot);
      const boundary = createTask1ArchiveBoundary();
      expect(typeof boundary.producer.produce).toBe('function');
      expect(typeof boundary.consumer.consume).toBe('function');
      expect(typeof boundary.verifier.verify).toBe('function');

      expectNotImplemented(await boundary.producer.produce(producerInput('package-only')), 'package-only');
      expectNotImplemented(await boundary.consumer.consume(consumerInput(tempRoot, 'package-only')), 'package-only');
      expectNotImplemented(
        await boundary.verifier.verify(verifierInput(tempRoot, 'source-bound', tempRoot)),
        'source-bound',
      );

      expect(await snapshotTreeAndLedger(tempRoot)).toEqual(before);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('package-only 与 source-bound 输入不可互换，声明性 sourceBound 与假 hash 不产生成功', async () => {
    const tempRoot = await createTempArchiveRoot();
    try {
      const before = await snapshotTreeAndLedger(tempRoot);
      const boundary = createTask1ArchiveBoundary();

      expectNotImplemented(await boundary.producer.produce(producerInput('package-only')), 'package-only');
      expectNotImplemented(
        await boundary.producer.produce({
          ...producerInput('source-bound'),
          declaredSourceBound: true,
          contentHash: '0'.repeat(64),
        } as ArchiveProduceInput),
        'source-bound',
      );
      expectNotImplemented(
        await boundary.consumer.consume({
          ...consumerInput(tempRoot, 'package-only'),
          sourceBound: true,
        } as ArchiveConsumeInput),
        'package-only',
      );
      expectNotImplemented(await boundary.consumer.consume(consumerInput(tempRoot, 'source-bound')), 'source-bound');
      expectNotImplemented(
        await boundary.consumer.consume(consumerInput(tempRoot, 'source-bound', tempRoot)),
        'source-bound',
      );
      expectNotImplemented(
        await boundary.verifier.verify(verifierInput(tempRoot, 'source-bound', tempRoot)),
        'source-bound',
      );
      const gradeAttempt = (await boundary.verifier.verify({
        ...verifierInput(tempRoot, 'package-only'),
        verificationLevel: 'source-verified',
        sourceBound: true,
      } as unknown as ArchiveVerifyInput)) as ArchiveBoundaryResult;
      expect(gradeAttempt.ok).toBe(false);
      expect(gradeAttempt.manifest).toBeNull();
      expect(gradeAttempt.verificationLevel).toBe('package-only');
      expect(gradeAttempt.createdPaths).toEqual([]);

      expect(await snapshotTreeAndLedger(tempRoot)).toEqual(before);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('三个入口只做参数类型检查，缺失或越界参数仍 typed NOT_IMPLEMENTED 且不展开 manifest', async () => {
    const boundary = createTask1ArchiveBoundary();
    expectNotImplemented(await boundary.producer.produce(undefined as unknown as ArchiveProduceInput), 'package-only');
    expectNotImplemented(await boundary.producer.produce({} as ArchiveProduceInput), 'package-only');
    expectNotImplemented(await boundary.producer.produce(null as unknown as ArchiveProduceInput), 'package-only');
    expectNotImplemented(await boundary.consumer.consume({} as ArchiveConsumeInput), 'package-only');
    expectNotImplemented(
      await boundary.consumer.consume({
        manifestPath: '/absolute/manifest.json',
        packageRoot: '',
        verificationLevel: 'source-bound',
        sourceProject: 'C:/outside',
      } as ArchiveConsumeInput),
      'source-bound',
    );
    expectNotImplemented(
      await boundary.verifier.verify({
        ...({} as ArchiveConsumeInput),
        expectedRevision: null,
      } as unknown as ArchiveVerifyInput),
      'package-only',
    );
  });
});
