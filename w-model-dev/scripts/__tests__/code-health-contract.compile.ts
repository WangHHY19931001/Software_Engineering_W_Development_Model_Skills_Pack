import type {
  ArchiveManifest,
  ErrorCode,
  ImpactRecord,
  Phase1CandidateLead,
  RevisionIdentity,
} from '../logic/code-health-contract.js';

const revision: RevisionIdentity = {
  commitSha: 'a'.repeat(40),
  treeSha: 'b'.repeat(40),
  sourceBundleSha256: 'c'.repeat(64),
  analyzedAt: '2026-09-07T00:00:00.000Z',
};

const validImpact: ImpactRecord = {
  rtmBefore: ['REQ-1'],
  rtmAfter: ['REQ-1'],
  coverageBefore: { statements: 1, branches: 1, functions: 1, lines: 1 },
  coverageAfter: { statements: 1, branches: 1, functions: 1, lines: 1 },
  testLevels: ['unit'],
  unmappedScenarios: [],
  coverageIsSignalOnly: true,
};

export const phase1ConsumerInput = {
  candidateId: 'CHG-P1-20260907-101',
  classification: 'unknown',
  files: ['src/candidate.ts'],
  symbols: ['candidate'],
  staticReferences: [],
  dynamicScenarios: [],
  guardViolations: ['dynamic import not exercised'],
  status: 'blocked',
} satisfies Phase1CandidateLead;

export { revision, validImpact };

// @ts-expect-error ErrorCode 不允许自然语言或未知枚举。
export const invalidErrorCode: ErrorCode = 'PASS';
// @ts-expect-error coverageIsSignalOnly 只能是字面量 true。
export const invalidImpact: ImpactRecord = { ...validImpact, coverageIsSignalOnly: false };
// @ts-expect-error source-bound/package-only 只能使用冻结枚举。
export const invalidManifestLevel: ArchiveManifest['verificationLevel'] = 'source-verified';
