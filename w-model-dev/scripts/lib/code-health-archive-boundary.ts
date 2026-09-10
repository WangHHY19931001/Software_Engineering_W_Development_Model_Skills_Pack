/**
 * Task 1D archive boundary.
 *
 * Freezes the Task 8 archive producer/consumer/verifier interfaces, the package-only/source-bound labels, and
 * the typed `NOT_IMPLEMENTED` result shape. Every entry point performs parameter type checks only: it never
 * reads `manifestPath`, computes a file hash, resolves `sourceProject`, creates directories/files, or writes
 * the ledger, and it never upgrades a declared verification level. The real archive behavior belongs to Task 8.
 */

import type {
  ArchiveBoundaryResult,
  ArchiveConsumeInput,
  ArchiveProduceInput,
  ArchiveVerifyInput,
} from '../logic/code-health-contract.js';

export type {
  ArchiveBoundaryResult,
  ArchiveConsumeInput,
  ArchiveProduceInput,
  ArchiveVerifyInput,
} from '../logic/code-health-contract.js';

/** Frozen Task 8 archive producer entrance. Never reads, hashes, creates, or archives anything in Task 1. */
export interface ArchiveProducer {
  produce(input: ArchiveProduceInput): Promise<ArchiveBoundaryResult>;
}

/** Frozen Task 8 archive consumer entrance for package-only and source-bound packages. */
export interface ArchiveConsumer {
  consume(input: ArchiveConsumeInput): Promise<ArchiveBoundaryResult>;
}

/** Frozen Task 8 archive verification entrance; `expectedRevision` never upgrades the declared level. */
export interface ArchiveVerifier {
  verify(input: ArchiveVerifyInput): Promise<ArchiveBoundaryResult>;
}

/** The Task 1D archive boundary surface consumed by Task 8. */
export interface ArchiveBoundary {
  producer: ArchiveProducer;
  consumer: ArchiveConsumer;
  verifier: ArchiveVerifier;
}

type VerificationLevel = ArchiveBoundaryResult['verificationLevel'];

const PRODUCER_NOT_IMPLEMENTED =
  'archive producer is not implemented in Task 1; the real archive producer belongs to Task 8';
const CONSUMER_NOT_IMPLEMENTED =
  'archive consumer is not implemented in Task 1; the real archive consumer belongs to Task 8';
const VERIFIER_NOT_IMPLEMENTED =
  'archive verifier is not implemented in Task 1; the real archive verifier belongs to Task 8';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isRepositoryRelativePath(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    !value.startsWith('/') &&
    !/^[A-Za-z]:[\\/]/.test(value) &&
    !value.includes('\\') &&
    !value.includes('//') &&
    !value.includes('\u0000') &&
    !value.split('/').includes('..') &&
    !value.split('/').includes('')
  );
}

interface BoundaryInspection {
  level: VerificationLevel;
  problems: string[];
}

/**
 * Read the declared verification level. The level is preserved verbatim when it is one of the two frozen
 * labels; any other value fails closed to `package-only`, so a malformed or declarative `sourceBound` claim
 * can never be upgraded to a source-bound result.
 */
function declaredVerificationLevel(input: unknown, problems: string[]): VerificationLevel {
  const level = isRecord(input) ? input.verificationLevel : undefined;
  if (level === 'package-only' || level === 'source-bound') return level;
  problems.push('verificationLevel must be exactly package-only or source-bound');
  return 'package-only';
}

function inspectProduceInput(input: unknown): BoundaryInspection {
  const problems: string[] = [];
  const level = declaredVerificationLevel(input, problems);
  if (!isRecord(input)) {
    problems.push('archive producer input must be an object');
    return { level, problems };
  }
  if (!isRecord(input.candidate) || !isNonEmptyString(input.candidate.candidateId)) {
    problems.push('archive producer input requires a candidate with a stable candidateId');
  }
  if (!isRecord(input.ledger) || !Array.isArray(input.ledger.candidates) || !Array.isArray(input.ledger.events)) {
    problems.push('archive producer input requires a ledger with candidates and events arrays');
  }
  if (!isRecord(input.approval) || !isNonEmptyString(input.approval.candidateId)) {
    problems.push('archive producer input requires a human approval decision bound to the candidate');
  }
  return { level, problems };
}

function inspectConsumeInput(input: unknown): BoundaryInspection {
  const problems: string[] = [];
  const level = declaredVerificationLevel(input, problems);
  if (!isRecord(input)) {
    problems.push('archive consumer input must be an object');
    return { level, problems };
  }
  if (!isRepositoryRelativePath(input.manifestPath)) {
    problems.push('manifestPath must be a repository-relative POSIX path');
  }
  if (!isNonEmptyString(input.packageRoot)) {
    problems.push('packageRoot must be an explicit non-empty path');
  }
  if (input.sourceProject !== undefined && !isNonEmptyString(input.sourceProject)) {
    problems.push('sourceProject must be a non-empty path when provided');
  }
  return { level, problems };
}

function inspectVerifyInput(input: unknown): BoundaryInspection {
  const inspection = inspectConsumeInput(input);
  if (!isRecord(input)) return inspection;
  const expected = input.expectedRevision;
  if (expected !== undefined) {
    const revisionFields =
      isRecord(expected) &&
      isNonEmptyString(expected.commitSha) &&
      isNonEmptyString(expected.treeSha) &&
      isNonEmptyString(expected.sourceBundleSha256) &&
      isNonEmptyString(expected.analyzedAt);
    if (!revisionFields) {
      inspection.problems.push('expectedRevision must be a complete revision identity when provided');
    }
  }
  return inspection;
}

function failClosedResult(
  level: VerificationLevel,
  notImplemented: string,
  problems: readonly string[],
): ArchiveBoundaryResult {
  return {
    ok: false,
    errorCode: 'NOT_IMPLEMENTED',
    manifest: null,
    verificationLevel: level,
    createdPaths: [],
    reason: problems.length === 0 ? notImplemented : `${notImplemented}; rejected input: ${problems.join('; ')}`,
  };
}

/**
 * Build the single Task 1D archive boundary. All three entrances only type-check their input and resolve the
 * same typed fail-closed result; no implementation detail of Task 8 is present here.
 */
export function createTask1ArchiveBoundary(): ArchiveBoundary {
  return {
    producer: {
      produce: (input: ArchiveProduceInput): Promise<ArchiveBoundaryResult> => {
        const { level, problems } = inspectProduceInput(input);
        return Promise.resolve(failClosedResult(level, PRODUCER_NOT_IMPLEMENTED, problems));
      },
    },
    consumer: {
      consume: (input: ArchiveConsumeInput): Promise<ArchiveBoundaryResult> => {
        const { level, problems } = inspectConsumeInput(input);
        return Promise.resolve(failClosedResult(level, CONSUMER_NOT_IMPLEMENTED, problems));
      },
    },
    verifier: {
      verify: (input: ArchiveVerifyInput): Promise<ArchiveBoundaryResult> => {
        const { level, problems } = inspectVerifyInput(input);
        return Promise.resolve(failClosedResult(level, VERIFIER_NOT_IMPLEMENTED, problems));
      },
    },
  };
}
