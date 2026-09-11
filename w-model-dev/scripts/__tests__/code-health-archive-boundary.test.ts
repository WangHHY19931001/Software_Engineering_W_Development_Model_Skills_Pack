/* eslint-disable security/detect-non-literal-fs-filename -- Boundary fixtures live beneath a per-test OS temp root. */

/**
 * Campaign archive boundary tests.
 *
 * These tests freeze the `ArchiveManifest` contract and exercise the real archive producer/consumer/verifier
 * that Task 8 replaced the typed `NOT_IMPLEMENTED` boundary with. Every case proves a fail-closed judgement:
 * missing review/gate/approval/rollback/redaction, a stale revision, a source-bound declaration without a
 * source project, a tampered package file, a non-empty output package, and a declared terminal non-success all
 * resolve a typed result with no partial success. A real archive is only produced beneath a per-test OS temp
 * root; the campaign fixture itself is never mutated.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateBySchema } from '../infrastructure/schema-loader.js';
import {
  ARCHIVE_MANIFEST_NAME,
  archiveManifestDigest,
  createTask1ArchiveBoundary,
} from '../lib/code-health-archive-boundary.js';
import type {
  ApprovalDecision,
  ArchiveBoundaryResult,
  ArchiveConsumeInput,
  ArchiveManifest,
  ArchivePackageFile,
  ArchiveProduceInput,
  ArchiveVerifyInput,
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
  const manifest: ArchiveManifest = {
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
    contentHash: '0'.repeat(64),
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
    archiveStatus: 'archived',
    archivedAsPassed: true,
  };
  manifest.contentHash = archiveManifestDigest(manifest);
  return manifest;
}

function candidateFixture(overrides: Partial<CodeHealthCandidate> = {}): CodeHealthCandidate {
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
    commands: [
      {
        command: 'npm test -- affected regression',
        cwd: '.',
        environment: { NODE_ENV: 'test' },
        platform: 'test-platform',
        toolVersions: { node: '20.0.0' },
        startedAt: '2026-09-07T00:01:00.000Z',
        endedAt: '2026-09-07T00:02:00.000Z',
        exitCode: 0,
        observation: 'observed',
        rawOutputPath: 'evidence/affected-regression.txt',
        rawOutputSha256: '9'.repeat(64),
      },
    ],
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
    signatures: [
      {
        role: 'V',
        actor: 'verifier',
        event: 'review',
        scopeHash: `sha256:${'d'.repeat(64)}`,
        provenanceRef: 'reviews/verifier.json',
        signedAt: '2026-09-07T00:02:30.000Z',
      },
      {
        role: 'G',
        actor: 'gate',
        event: 'gate',
        scopeHash: `sha256:${'d'.repeat(64)}`,
        provenanceRef: 'gate-logs/check.json',
        signedAt: '2026-09-07T00:02:45.000Z',
      },
      {
        role: 'human',
        actor: 'human-decision-maker',
        event: 'approve',
        scopeHash: `sha256:${'d'.repeat(64)}`,
        provenanceRef: 'approval.json',
        signedAt: '2026-09-07T00:03:00.000Z',
      },
    ],
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
    ...overrides,
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

/** Declared archive artifacts, mirroring the real campaign layout read by the archive CLI. */
const SOURCE_FILES: Record<string, { kind: ArchivePackageFile['kind']; content: string }> = {
  'ledger.json': { kind: 'ledger', content: '{"campaignId":"CHC-20260907"}\n' },
  'candidate.json': { kind: 'candidate', content: '{"candidateId":"CHG-P1-20260907-001"}\n' },
  'approval.json': { kind: 'approval', content: '{"candidateId":"CHG-P1-20260907-001"}\n' },
  'evidence/evidence.json': { kind: 'evidence', content: '{"evidenceId":"EVD-1"}\n' },
  'reviews/verifier.json': { kind: 'review', content: '{"reviewed":true}\n' },
  'gate-logs/check.json': { kind: 'gate', content: '{"exitCode":0}\n' },
  'rollback/rollback.patch': { kind: 'rollback', content: 'diff --git a/src/unused.ts b/src/unused.ts\n' },
};

function sourceKinds(): ArchivePackageFile[] {
  return Object.entries(SOURCE_FILES).map(([file, entry]) => ({ path: file, kind: entry.kind }));
}

function producerInput(
  campaignRoot: string,
  packageRoot: string,
  overrides: Partial<ArchiveProduceInput> = {},
): ArchiveProduceInput {
  const candidate = candidateFixture();
  return {
    candidate,
    ledger: ledgerFixture(),
    approval: approvalFixture(),
    verificationLevel: 'package-only',
    campaignRoot,
    packageRoot,
    sources: sourceKinds(),
    ...overrides,
  };
}

function consumerInput(
  packageRoot: string,
  verificationLevel: ArchiveConsumeInput['verificationLevel'],
  sourceProject?: string,
): ArchiveConsumeInput {
  return {
    manifestPath: ARCHIVE_MANIFEST_NAME,
    packageRoot,
    verificationLevel,
    sourceProject,
  };
}

function verifierInput(
  packageRoot: string,
  verificationLevel: ArchiveConsumeInput['verificationLevel'],
  sourceProject?: string,
): ArchiveVerifyInput {
  return { ...consumerInput(packageRoot, verificationLevel, sourceProject), expectedRevision: revision };
}

/** Every refusal must be a typed fail-closed result: no manifest, no created paths, no archived-as-passed. */
function expectRefused(result: ArchiveBoundaryResult, level: ArchiveManifest['verificationLevel']): void {
  expect(result).toMatchObject({
    ok: false,
    manifest: null,
    verificationLevel: level,
    createdPaths: [],
    archivedAsPassed: false,
  });
  expect(result.errorCode).not.toBeNull();
  expect(result.exitCode).not.toBe(0);
  expect(result.reason.length).toBeGreaterThan(0);
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

async function createTempArchiveRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'code-health-archive-boundary-'));
  for (const [file, entry] of Object.entries(SOURCE_FILES)) {
    const target = path.join(root, ...file.split('/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, entry.content, 'utf8');
  }
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'unused.ts'), 'export const unusedFunction = () => {};\n', 'utf8');
  return root;
}

/** Fresh, empty output parent so every package write starts from a clean target. */
async function createOutputRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'code-health-archive-out-'));
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
    expect(validateBySchema('code-health-archive', { ...manifest, archiveStatus: 'passed' }).valid).toBe(false);
    const manifestAsArchivedRecord = { ...manifest, status: 'archived' } as Record<string, unknown>;
    expect(validateBySchema('code-health-archive', manifestAsArchivedRecord).valid).toBe(false);
  });

  it('producer writes a read-only-preserving package and consumer/verifier prove package-only integrity', async () => {
    const campaignRoot = await createTempArchiveRoot();
    const outputRoot = await createOutputRoot();
    const packageRoot = path.join(outputRoot, 'package');
    try {
      const before = await snapshotTree(campaignRoot);
      const boundary = createTask1ArchiveBoundary({ now: () => new Date('2026-09-07T00:05:00.000Z') });
      const produced = await boundary.producer.produce(producerInput(campaignRoot, packageRoot));

      expect(produced.ok).toBe(true);
      expect(produced.exitCode).toBe(0);
      expect(produced.archivedAsPassed).toBe(true);
      expect(produced.manifest?.archiveStatus).toBe('archived');
      expect(produced.manifest?.files.length).toBe(Object.keys(SOURCE_FILES).length);
      for (const file of produced.manifest?.files ?? []) {
        expect(file.path).not.toContain('..');
        expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
      }
      expect(produced.createdPaths).toContain(ARCHIVE_MANIFEST_NAME);

      const consumed = await boundary.consumer.consume(consumerInput(packageRoot, 'package-only'));
      expect(consumed).toMatchObject({ ok: true, verificationLevel: 'package-only', archivedAsPassed: false });
      const verified = await boundary.verifier.verify(verifierInput(packageRoot, 'package-only'));
      expect(verified.ok).toBe(true);
      expect(verified.verificationLevel).toBe('package-only');
      expect(verified.reason).toMatch(/package-only/);

      // The campaign root is read-only: it is byte-identical after a real archive.
      expect(await snapshotTree(campaignRoot)).toEqual(before);
    } finally {
      await fs.rm(campaignRoot, { recursive: true, force: true });
      await fs.rm(outputRoot, { recursive: true, force: true });
    }
  });

  it('refuses a package-only producer whose required artifact kinds are incomplete', async () => {
    const campaignRoot = await createTempArchiveRoot();
    const outputRoot = await createOutputRoot();
    const packageRoot = path.join(outputRoot, 'package');
    try {
      const boundary = createTask1ArchiveBoundary();
      const base = producerInput(campaignRoot, packageRoot);
      const cases: Array<{ drop: ArchivePackageFile['kind']; pattern: RegExp }> = [
        { drop: 'review', pattern: /review/i },
        { drop: 'gate', pattern: /gate/i },
        { drop: 'approval', pattern: /approval/i },
        { drop: 'rollback', pattern: /rollback/i },
      ];
      for (const testCase of cases) {
        const result = await boundary.producer.produce({
          ...base,
          sources: base.sources.filter((source) => source.kind !== testCase.drop),
        });
        expectRefused(result, 'package-only');
        expect(result.reason).toMatch(testCase.pattern);
      }
      await expect(fs.stat(packageRoot)).rejects.toBeTruthy();
    } finally {
      await fs.rm(campaignRoot, { recursive: true, force: true });
      await fs.rm(outputRoot, { recursive: true, force: true });
    }
  });

  it('package-only 与 source-bound 输入不可互换，声明性 sourceBound 与假 hash 不产生成功', async () => {
    const campaignRoot = await createTempArchiveRoot();
    const outputRoot = await createOutputRoot();
    const packageRoot = path.join(outputRoot, 'package');
    try {
      const before = await snapshotTree(campaignRoot);
      const boundary = createTask1ArchiveBoundary();

      // A source-bound declaration without an explicit source project can never be produced.
      expectRefused(
        await boundary.producer.produce(
          producerInput(campaignRoot, packageRoot, { verificationLevel: 'source-bound' }),
        ),
        'package-only',
      );
      // A forged `contentHash` is not part of the producer input contract and cannot influence a result.
      const forged = await boundary.producer.produce({
        ...producerInput(campaignRoot, packageRoot),
        contentHash: '0'.repeat(64),
      } as ArchiveProduceInput);
      expect(forged.ok).toBe(true);
      expect(forged.manifest?.contentHash).toBe(archiveManifestDigest(forged.manifest!));

      // An unknown declared level never upgrades the claim: it is resolved as package-only, never source-bound.
      const gradeAttempt = await boundary.verifier.verify({
        ...consumerInput(packageRoot, 'package-only'),
        verificationLevel: 'source-verified',
        sourceProject: 'source-project',
      } as unknown as ArchiveVerifyInput);
      expect(gradeAttempt.verificationLevel).toBe('package-only');
      expect(gradeAttempt.manifest?.verificationLevel).toBe('package-only');

      // A package-only package verified with a source-bound declaration can never claim source binding.
      const declaredSourceBound = await boundary.verifier.verify({
        ...consumerInput(packageRoot, 'source-bound'),
        expectedRevision: revision,
      });
      expect(declaredSourceBound.ok).toBe(true);
      expect(declaredSourceBound.verificationLevel).toBe('package-only');
      expect(declaredSourceBound.reason).toMatch(/package-only/);

      expect(await snapshotTree(campaignRoot)).toEqual(before);
    } finally {
      await fs.rm(campaignRoot, { recursive: true, force: true });
      await fs.rm(outputRoot, { recursive: true, force: true });
    }
  });

  it('stale revision fail-closed：ledger 记录与 campaign baseline 不一致的候选不可归档', async () => {
    const campaignRoot = await createTempArchiveRoot();
    const outputRoot = await createOutputRoot();
    try {
      const boundary = createTask1ArchiveBoundary();
      // The candidate (and its ledger record) sit on a newer revision than the campaign baseline, which is
      // the stale-provenance shape: the ledger record no longer matches the baseline it was opened against.
      const staleRevision = { ...revision, treeSha: 'e'.repeat(40) };
      const staleCandidate = candidateFixture({ revision: staleRevision });
      const staleLedger = ledgerFixture();
      staleLedger.candidates = [{ ...staleCandidate, revision: { ...staleRevision } }];
      // The campaign baseline stays on the original revision while the candidate record moved on.
      staleLedger.baseline = {
        commitSha: revision.commitSha,
        treeSha: revision.treeSha,
        sourceBundleSha256: revision.sourceBundleSha256,
        analyzedAt: revision.analyzedAt,
      };
      const stale = await boundary.producer.produce({
        ...producerInput(campaignRoot, path.join(outputRoot, 'package')),
        candidate: staleCandidate,
        ledger: staleLedger,
      });
      expectRefused(stale, 'package-only');
      expect(stale.reason).toMatch(/revision|provenance/i);
    } finally {
      await fs.rm(campaignRoot, { recursive: true, force: true });
      await fs.rm(outputRoot, { recursive: true, force: true });
    }
  });

  it('缺失或非人类 approval fail-closed，且不产生 package', async () => {
    const campaignRoot = await createTempArchiveRoot();
    const outputRoots: string[] = [];
    const freshPackage = async (): Promise<string> => {
      const root = await createOutputRoot();
      outputRoots.push(root);
      return path.join(root, 'package');
    };
    try {
      const boundary = createTask1ArchiveBoundary();

      const noApproval = await boundary.producer.produce({
        ...producerInput(campaignRoot, await freshPackage()),
        approval: null as unknown as ApprovalDecision,
      });
      expectRefused(noApproval, 'package-only');
      expect(noApproval.reason).toMatch(/approval/i);

      const nonHumanApproval = await boundary.producer.produce({
        ...producerInput(campaignRoot, await freshPackage()),
        approval: { ...approvalFixture(), actor: 'S-agent' },
      });
      expectRefused(nonHumanApproval, 'package-only');
      expect(nonHumanApproval.reason).toMatch(/human/i);
    } finally {
      await fs.rm(campaignRoot, { recursive: true, force: true });
      for (const root of outputRoots) await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('blocking event 与不安全 redaction fail-closed', async () => {
    const campaignRoot = await createTempArchiveRoot();
    const outputRoots: string[] = [];
    const freshPackage = async (): Promise<string> => {
      const root = await createOutputRoot();
      outputRoots.push(root);
      return path.join(root, 'package');
    };
    try {
      const boundary = createTask1ArchiveBoundary();

      const blockingLedger = ledgerFixture();
      blockingLedger.events = [
        {
          eventId: 'EV-GATE-FAIL',
          eventKind: 'gate-failure',
          candidateId: CANDIDATE_ID,
          from: 'verified',
          to: 'blocked',
          actorRole: 'G',
          at: '2026-09-07T00:04:00.000Z',
          revision,
          scopeHash: `sha256:${'d'.repeat(64)}`,
          evidenceRefs: ['gate-logs/fail.json'],
          signatureRef: 'gate-logs/check.json',
        },
      ];
      const blocked = await boundary.producer.produce({
        ...producerInput(campaignRoot, await freshPackage()),
        ledger: blockingLedger,
      });
      expectRefused(blocked, 'package-only');
      expect(blocked.reason).toMatch(/root cause|blocking/i);

      // Unsafe content in a declared artifact is blocked, never exported and then patched.
      await fs.writeFile(path.join(campaignRoot, 'evidence', 'evidence.json'), 'unsafe\u0007content\n', 'utf8');
      const unsafePackage = await freshPackage();
      const unsafe = await boundary.producer.produce(producerInput(campaignRoot, unsafePackage));
      expectRefused(unsafe, 'package-only');
      expect(unsafe.errorCode).toBe('SECURITY_BLOCKED');
      expect(unsafe.reason).toMatch(/redaction/i);
      await expect(fs.stat(unsafePackage)).rejects.toBeTruthy();
    } finally {
      await fs.rm(campaignRoot, { recursive: true, force: true });
      for (const root of outputRoots) await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('a declared terminal non-success is archived as evidence but never as passed', async () => {
    const campaignRoot = await createTempArchiveRoot();
    const outputRoot = await createOutputRoot();
    const packageRoot = path.join(outputRoot, 'package');
    try {
      const blockedCandidate = { ...candidateFixture(), status: 'blocked' as const };
      const blockedLedger = ledgerFixture();
      blockedLedger.candidates = [blockedCandidate];
      blockedLedger.events = [
        {
          eventId: 'EV-GATE-FAIL',
          eventKind: 'gate-failure',
          candidateId: CANDIDATE_ID,
          from: 'verified',
          to: 'blocked',
          actorRole: 'G',
          at: '2026-09-07T00:04:00.000Z',
          revision,
          scopeHash: `sha256:${'d'.repeat(64)}`,
          evidenceRefs: ['gate-logs/fail.json'],
          signatureRef: 'gate-logs/check.json',
        },
      ];
      const boundary = createTask1ArchiveBoundary();
      const result = await boundary.producer.produce({
        ...producerInput(campaignRoot, packageRoot),
        candidate: blockedCandidate,
        ledger: blockedLedger,
      });
      expect(result.ok).toBe(true);
      expect(result.archivedAsPassed).toBe(false);
      expect(result.manifest?.archiveStatus).toBe('blocked');
      expect(result.manifest?.archivedAsPassed).toBe(false);
    } finally {
      await fs.rm(campaignRoot, { recursive: true, force: true });
      await fs.rm(outputRoot, { recursive: true, force: true });
    }
  });

  it('tampered package files、tampered contentHash 与既有非空 package 一律 fail-closed', async () => {
    const campaignRoot = await createTempArchiveRoot();
    const outputRoot = await createOutputRoot();
    const packageRoot = path.join(outputRoot, 'package');
    try {
      const boundary = createTask1ArchiveBoundary();
      const produced = await boundary.producer.produce(producerInput(campaignRoot, packageRoot));
      expect(produced.ok).toBe(true);

      // Editing only the manifest contentHash is detected by the deterministic digest recomputation.
      const manifestPath = path.join(packageRoot, ARCHIVE_MANIFEST_NAME);
      const cleanManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as ArchiveManifest;
      const tamperedHash = { ...cleanManifest, contentHash: '0'.repeat(64) };
      await fs.writeFile(manifestPath, `${JSON.stringify(tamperedHash, null, 2)}\n`, 'utf8');
      const digestTamper = await boundary.verifier.verify(verifierInput(packageRoot, 'package-only'));
      expectRefused(digestTamper, 'package-only');
      expect(digestTamper.reason).toMatch(/contentHash|digest/i);

      // Tampering a packaged artifact is detected by its declared SHA-256.
      await fs.writeFile(manifestPath, `${JSON.stringify(cleanManifest, null, 2)}\n`, 'utf8');
      await fs.writeFile(path.join(packageRoot, 'ledger.json'), '{"tampered":true}\n', 'utf8');
      const tampered = await boundary.verifier.verify(verifierInput(packageRoot, 'package-only'));
      expectRefused(tampered, 'package-only');
      expect(tampered.errorCode).toBe('EVIDENCE_INVALID');

      // A non-empty output package is never overwritten.
      const occupiedRoot = await createOutputRoot();
      const occupied = path.join(occupiedRoot, 'package');
      await fs.mkdir(occupied, { recursive: true });
      await fs.writeFile(path.join(occupied, 'existing.txt'), 'keep\n', 'utf8');
      const before = await snapshotTree(occupied);
      const overwrite = await boundary.producer.produce(producerInput(campaignRoot, occupied));
      expectRefused(overwrite, 'package-only');
      expect(overwrite.reason).toMatch(/overwrite|empty/i);
      expect(await snapshotTree(occupied)).toEqual(before);
      await fs.rm(occupiedRoot, { recursive: true, force: true });
    } finally {
      await fs.rm(campaignRoot, { recursive: true, force: true });
      await fs.rm(outputRoot, { recursive: true, force: true });
    }
  });

  it('source-bound 生产与验证需要显式 source project 且 revision 必须匹配', async () => {
    const campaignRoot = await createTempArchiveRoot();
    const outputRoot = await createOutputRoot();
    const packageRoot = path.join(outputRoot, 'package');
    try {
      const matching = createTask1ArchiveBoundary({
        revisionProvider: {
          current: async () => revision,
          verify: async (_root, expected) => ({ ok: true, code: null, expected, actual: revision }),
        },
      });
      const produced = await matching.producer.produce(
        producerInput(campaignRoot, packageRoot, {
          verificationLevel: 'source-bound',
          sourceProject: 'source-project',
        }),
      );
      expect(produced.ok).toBe(true);
      expect(produced.verificationLevel).toBe('source-bound');

      const sourceBound = await matching.verifier.verify(verifierInput(packageRoot, 'source-bound', 'source-project'));
      expect(sourceBound.ok).toBe(true);
      expect(sourceBound.verificationLevel).toBe('source-bound');

      const mismatching = createTask1ArchiveBoundary({
        revisionProvider: {
          current: async () => null,
          verify: async (_root, expected) => ({
            ok: false,
            code: 'REVISION_MISMATCH',
            expected,
            actual: null,
            reason: 'repository revision could not be read',
          }),
        },
      });
      const mismatch = await mismatching.verifier.verify(verifierInput(packageRoot, 'source-bound', 'source-project'));
      expect(mismatch.ok).toBe(false);
      expect(mismatch.errorCode).toBe('REVISION_MISMATCH');
    } finally {
      await fs.rm(campaignRoot, { recursive: true, force: true });
      await fs.rm(outputRoot, { recursive: true, force: true });
    }
  });

  it('畸形或越界输入以 exit 2 fail-closed，且不产生 package', async () => {
    const boundary = createTask1ArchiveBoundary();
    const malformedProduce = await boundary.producer.produce(undefined as unknown as ArchiveProduceInput);
    expect(malformedProduce.ok).toBe(false);
    expect(malformedProduce.exitCode).toBe(2);
    expect(malformedProduce.manifest).toBeNull();

    const emptyProduce = await boundary.producer.produce({} as ArchiveProduceInput);
    expect(emptyProduce.ok).toBe(false);
    expect(emptyProduce.exitCode).toBe(2);

    const nullProduce = await boundary.producer.produce(null as unknown as ArchiveProduceInput);
    expect(nullProduce.ok).toBe(false);
    expect(nullProduce.exitCode).toBe(2);

    // An unsafe absolute manifest path is rejected structurally, never resolved.
    const unsafeConsume = await boundary.consumer.consume({
      manifestPath: '/absolute/manifest.json',
      packageRoot: '',
      verificationLevel: 'source-bound',
      sourceProject: 'C:/outside',
    } as ArchiveConsumeInput);
    expect(unsafeConsume.ok).toBe(false);
    expect(unsafeConsume.manifest).toBeNull();

    const malformedVerify = await boundary.verifier.verify({
      ...({} as ArchiveConsumeInput),
      expectedRevision: null,
    } as unknown as ArchiveVerifyInput);
    expect(malformedVerify.ok).toBe(false);
    expect(malformedVerify.manifest).toBeNull();
  });

  it('manifest digest 是确定性的且与 key 顺序无关', () => {
    const manifest = validManifest('package-only');
    const digest = archiveManifestDigest(manifest);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    const reordered = Object.fromEntries(Object.entries(manifest).reverse()) as unknown as ArchiveManifest;
    expect(archiveManifestDigest(reordered)).toBe(digest);
  });
});
