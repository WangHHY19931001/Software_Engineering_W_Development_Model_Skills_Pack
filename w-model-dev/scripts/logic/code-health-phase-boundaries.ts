import {
  CodeHealthError,
  type DuplicateCluster,
  type DuplicateInput,
  type GapDiscoveryInput,
  type GapRow,
  type Phase1CandidateLead,
  type TestRecord,
  type TestRemovalProofInput,
  type TddHarnessInput,
} from './code-health-contract.js';

export function consumePhase1Candidate(
  input: Phase1CandidateLead,
): Pick<Phase1CandidateLead, 'candidateId' | 'status'> {
  return { candidateId: input.candidateId, status: input.status };
}
export function consumePhase2Gap(input: GapRow): Pick<GapRow, 'gapId' | 'candidateId' | 'coverageIsSignalOnly'> {
  return { gapId: input.gapId, candidateId: input.candidateId, coverageIsSignalOnly: input.coverageIsSignalOnly };
}
export function consumePhase3Test(input: TestRecord): Pick<TestRecord, 'testId' | 'level' | 'rtmIds'> {
  return { testId: input.testId, level: input.level, rtmIds: input.rtmIds };
}
export function consumePhase4Cluster(input: DuplicateCluster): Pick<DuplicateCluster, 'clusterId' | 'status'> {
  return { clusterId: input.clusterId, status: input.status };
}
export function findGaps(_input: GapDiscoveryInput): never {
  throw new CodeHealthError('NOT_IMPLEMENTED', 'gap discovery is not implemented in Task 1A');
}
export function runTddHarness(_input: TddHarnessInput): Promise<never> {
  return Promise.reject(new CodeHealthError('NOT_IMPLEMENTED', 'TDD harness is not implemented in Task 1A'));
}
export function proveTestRemoval(input: TestRemovalProofInput): string[] {
  if (!input || typeof input !== 'object' || !('candidate' in input)) {
    throw new CodeHealthError('NOT_IMPLEMENTED', 'test removal proof is not implemented in Task 1A');
  }
  return ['NOT_IMPLEMENTED: test removal proof is not implemented in Task 1A'];
}
export function clusterDuplicates(_input: DuplicateInput): never {
  throw new CodeHealthError('NOT_IMPLEMENTED', 'duplicate clustering is not implemented in Task 1A');
}
