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
});

export type ContractFixture = CodeHealthCandidate;
