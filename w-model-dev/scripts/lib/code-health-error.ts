/**
 * Typed code-health error shared by the injected lib boundary and the logic lifecycle.
 *
 * The class is defined in `lib/` because the repository dependency-boundary gate forbids
 * `lib → logic` runtime imports while the boundary implementations must reject with the same
 * canonical typed error class the lifecycle consumes. `logic/code-health-contract.ts` re-exports
 * it, so every canonical import path and signature is unchanged and there is exactly one definition.
 */

import type { ErrorCode, RevisionIdentity } from '../logic/code-health-contract.js';

export class CodeHealthError extends Error {
  readonly code: ErrorCode;
  readonly safePath?: string;
  readonly candidateId?: string;
  readonly scopeHash?: string;
  readonly expectedRevision?: RevisionIdentity;
  readonly actualRevision?: RevisionIdentity;

  constructor(
    code: ErrorCode,
    reason: string,
    context: {
      safePath?: string;
      candidateId?: string;
      scopeHash?: string;
      expectedRevision?: RevisionIdentity;
      actualRevision?: RevisionIdentity;
    } = {},
  ) {
    super(reason);
    this.name = 'CodeHealthError';
    this.code = code;
    this.safePath = context.safePath;
    this.candidateId = context.candidateId;
    this.scopeHash = context.scopeHash;
    this.expectedRevision = context.expectedRevision;
    this.actualRevision = context.actualRevision;
  }
}
