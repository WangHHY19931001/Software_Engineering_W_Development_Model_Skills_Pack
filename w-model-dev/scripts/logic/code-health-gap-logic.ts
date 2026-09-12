/* eslint-disable security/detect-object-injection -- Dimension keys and per-entry fields are fixed literal members of the Phase 2 contract; no caller-controlled key reaches an object lookup. */
/**
 * Phase 2 gap discovery logic (pure).
 *
 * This module owns the seven-dimension gap matrix: requirement, public-contract, branch, error,
 * security, concurrency, and platform. It never reads a coverage percentage to decide whether a
 * dimension may be skipped: coverage is signal-only, so `coverageAuthorization` is always `false` and
 * a missing dimension fails closed even when `coverageSignal.lines === 1`.
 *
 * Deep row/matrix validation is NOT duplicated here. The frozen Task 1 validators
 * (`validateGapRow` / `validateGapMatrix` / `validateRedGreenEvidence`) stay in
 * `code-health-ledger-logic.ts` and remain the single authority; `findGaps` only normalizes the seven
 * declared dimensions into rows for those validators.
 *
 * The real RED/GREEN process runner is an IO boundary, so it lives in
 * `lib/code-health-tdd-harness.ts`. `logic/` stays free of `node:fs` / `node:child_process` /
 * `node:path` (dependency-boundaries gate).
 */

import {
  CodeHealthError,
  type GapDiscoveryInput,
  type GapDiscoveryResult,
  type GapRow,
} from './code-health-contract.js';

/** The frozen seven gap dimensions, in canonical order. */
export const GAP_DIMENSIONS = [
  { kind: 'requirement', key: 'requirements' },
  { kind: 'public-contract', key: 'publicContracts' },
  { kind: 'branch', key: 'branches' },
  { kind: 'error', key: 'errors' },
  { kind: 'security', key: 'securityProperties' },
  { kind: 'concurrency', key: 'concurrencyProperties' },
  { kind: 'platform', key: 'platforms' },
] as const satisfies ReadonlyArray<{ kind: GapRow['kind']; key: keyof GapDiscoveryInput }>;

export type GapDimensionKind = GapRow['kind'];

/** Fields copied verbatim from one dimension entry into the produced row. */
const GAP_ROW_ENTRY_FIELDS = [
  'testLevels',
  'existingTestIds',
  'missingScenario',
  'evidenceSources',
  'risk',
  'priority',
  'owner',
  'rtmIds',
  'coverageSignal',
  'redEvidence',
  'greenEvidence',
  'assertionHash',
  'implementationHash',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function entryList(value: unknown, dimensionKey: string): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value.entries)) return value.entries;
  throw new CodeHealthError(
    'ARG_INVALID',
    `gap discovery dimension ${dimensionKey} must be an array of scenario entries (or {"entries": [...]})`,
  );
}

/** Default row identity is deterministic and unique per (candidate, dimension, entry index). */
function defaultGapId(kind: GapRow['kind'], candidateId: string, index: number): string {
  return `GAP-${candidateId}-${kind}-${index}`;
}

/**
 * Normalize one declared gap scenario into a row. Only `candidateId` is required here so the row can be
 * identified; every other field is copied verbatim (or omitted) and validated downstream by
 * `validateGapMatrix`, which is the single authority for field-level and matrix-level rejection.
 */
function toGapRow(kind: GapRow['kind'], entry: unknown, index: number): GapRow {
  if (!isRecord(entry)) {
    throw new CodeHealthError('ARG_INVALID', `gap dimension ${kind} entry ${index} must be an object`);
  }
  const candidateId = entry.candidateId;
  if (typeof candidateId !== 'string' || candidateId.trim() === '') {
    throw new CodeHealthError('ARG_INVALID', `gap dimension ${kind} entry ${index} requires candidateId`);
  }
  const row: Record<string, unknown> = {
    gapId:
      typeof entry.gapId === 'string' && entry.gapId.trim() !== ''
        ? entry.gapId
        : defaultGapId(kind, candidateId, index),
    candidateId,
    kind,
    coverageIsSignalOnly: true,
    status: typeof entry.status === 'string' && entry.status.trim() !== '' ? entry.status : 'discovered',
  };
  for (const field of GAP_ROW_ENTRY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(entry, field)) row[field] = entry[field];
  }
  return row as unknown as GapRow;
}

/** Dimensions that are absent or not an array; a non-empty result always fails the discovery closed. */
export function missingGapDimensions(input: GapDiscoveryInput): GapDimensionKind[] {
  if (!isRecord(input)) return GAP_DIMENSIONS.map((dimension) => dimension.kind);
  const missing: GapDimensionKind[] = [];
  for (const dimension of GAP_DIMENSIONS) {
    const value = input[dimension.key];
    const present = Array.isArray(value) || (isRecord(value) && Array.isArray(value.entries));
    if (!present) missing.push(dimension.kind);
  }
  return missing;
}

/**
 * Discover the gap matrix for all seven dimensions. Missing dimensions, malformed dimension containers,
 * and entries without an identity fail closed; `coverageAuthorization` is always `false`, so a 100%
 * coverage signal can never authorize skipping a dimension.
 */
export function findGaps(input: GapDiscoveryInput): GapDiscoveryResult {
  if (!isRecord(input)) {
    throw new CodeHealthError('ARG_INVALID', 'gap discovery requires an input object with all seven dimensions');
  }
  const missing = missingGapDimensions(input);
  if (missing.length > 0) {
    throw new CodeHealthError(
      'ARG_INVALID',
      `gap discovery requires all seven dimensions; missing: ${missing.join(', ')} (coverage is signal-only and cannot substitute a dimension)`,
    );
  }
  const rows: GapRow[] = [];
  for (const dimension of GAP_DIMENSIONS) {
    const entries = entryList(input[dimension.key], dimension.key);
    entries.forEach((entry, index) => rows.push(toGapRow(dimension.kind, entry, index)));
  }
  return { rows, coverageAuthorization: false };
}
