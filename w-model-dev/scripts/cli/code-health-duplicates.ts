#!/usr/bin/env tsx
/* eslint-disable security/detect-object-injection -- Flag names are fixed literal members of the CLI tables; every lookup is validated against them before use. */
/**
 * Phase 4 duplicate-clustering CLI (read-only review).
 *
 * Flags:
 *   --matrix <file>   duplicate matrix document (required). Shape:
 *                     { input: DuplicateInput, authority: DuplicateClusterAuthority,
 *                       review?: { equivalenceProof, maintenanceBenefit, rollback, redaction },
 *                       proposal?: AbstractionProposal }
 *   --validate        also run the abstraction guard (structural completeness + item-wise proof)
 *
 * This CLI clusters and reviews only; it never writes a patch and never migrates code. An
 * `under-review` result is NOT an approval: the human approval gate plus `code-health-apply.ts`
 * authorize an abstraction, and only inside an isolated project.
 *
 * Safety / default-deny:
 *   - the caller-declared cluster cannot inflate the stable call-site count: the cluster is always
 *     recomputed from `input` + `authority`, and only the semantic review fields (equivalence proof,
 *     maintenance benefit, rollback, redaction) may be attached by the caller;
 *   - a `deferred` cluster (fewer than two stable production call sites, <2 structural views, or no
 *     regression signal) exits 0 with a non-approval status; a `rejected` cluster or any guard
 *     violation exits 1; structurally invalid input exits 2 with `ERROR_JSON`.
 *
 * Exit codes: 0 reviewed (under-review/deferred), 1 rejected or guard violation, 2 input error.
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  clusterDuplicates,
  proveAbstraction,
  validateDuplicateCluster,
  type DuplicateClusterAuthority,
} from '../logic/code-health-duplicate-logic.js';
import { CodeHealthError } from '../logic/code-health-contract.js';
import type {
  AbstractionProposal,
  DuplicateCluster,
  DuplicateInput,
  RollbackPlan,
} from '../logic/code-health-contract.js';
import { exitWithError } from '../lib/cli-error.js';
import { readJsonOrExit } from '../lib/read-json-or-exit.js';
import { runMain } from '../lib/run-main.js';

const VALUE_FLAGS = ['matrix'] as const;
const BOOLEAN_FLAGS = ['validate'] as const;

class DuplicateArgumentError extends Error {}

interface ParsedArgs {
  matrix?: string;
  validate: boolean;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const values: Record<string, string> = {};
  const flags: Record<string, boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (!argument.startsWith('--')) throw new DuplicateArgumentError(`unexpected positional argument: ${argument}`);
    const equals = argument.indexOf('=');
    const name = equals === -1 ? argument.slice(2) : argument.slice(2, equals);
    if ((BOOLEAN_FLAGS as readonly string[]).includes(name)) {
      if (equals !== -1) throw new DuplicateArgumentError(`flag --${name} does not take a value`);
      if (flags[name] === true) throw new DuplicateArgumentError(`duplicate flag: --${name}`);
      flags[name] = true;
      continue;
    }
    if (!(VALUE_FLAGS as readonly string[]).includes(name)) {
      throw new DuplicateArgumentError(`unknown flag: ${argument}`);
    }
    let value: string;
    if (equals !== -1) {
      value = argument.slice(equals + 1);
    } else {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--')) {
        throw new DuplicateArgumentError(`missing value for --${name}`);
      }
      value = next;
      index += 1;
    }
    if (value === '') throw new DuplicateArgumentError(`missing value for --${name}`);
    if (values[name] !== undefined) throw new DuplicateArgumentError(`duplicate flag: --${name}`);
    values[name] = value;
  }
  if (values.matrix === undefined) throw new DuplicateArgumentError('missing required flag: --matrix <file>');
  return { matrix: values.matrix, validate: flags.validate === true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Attach ONLY the semantic review fields to the recomputed cluster. Structural fields (implementations,
 * views, stableProductionCallSites, status) are never taken from the caller, so a declared cluster
 * cannot widen the authorizing facts.
 */
function withReview(cluster: DuplicateCluster, review: Record<string, unknown>): DuplicateCluster {
  const merged: DuplicateCluster = { ...cluster };
  if (review.equivalenceProof !== undefined) {
    merged.equivalenceProof = review.equivalenceProof as DuplicateCluster['equivalenceProof'];
  }
  if (typeof review.maintenanceBenefit === 'string') merged.maintenanceBenefit = review.maintenanceBenefit;
  if (review.rollback !== undefined) merged.rollback = review.rollback as RollbackPlan;
  if (review.redaction !== undefined) merged.redaction = review.redaction as DuplicateCluster['redaction'];
  return merged;
}

function emit(payload: Record<string, unknown>): void {
  console.log(`DUPLICATES_JSON ${JSON.stringify(payload)}`);
}

async function main(): Promise<void> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: error instanceof Error ? error.message : String(error),
      detail: 'usage: code-health-duplicates.ts --matrix <file> [--validate]',
      exitCode: 2,
    });
    return;
  }

  const matrixPath = path.resolve(parsed.matrix as string);
  const document = await readJsonOrExit<unknown>(matrixPath);
  if (!isRecord(document)) {
    exitWithError({
      category: 'STRUCTURE_INVALID',
      rule: 'P0-2',
      message: 'duplicate matrix 必须是对象',
      file: matrixPath,
      exitCode: 2,
    });
    return;
  }
  if (!isRecord(document.input) || !isRecord(document.authority)) {
    exitWithError({
      category: 'STRUCTURE_INVALID',
      rule: 'P0-2',
      message: 'duplicate matrix 必须包含 input 与 authority 对象',
      file: matrixPath,
      exitCode: 2,
    });
    return;
  }

  let cluster: DuplicateCluster;
  try {
    cluster = clusterDuplicates(
      document.input as unknown as DuplicateInput,
      document.authority as unknown as DuplicateClusterAuthority,
    );
  } catch (error) {
    const typed = error instanceof CodeHealthError ? error : null;
    exitWithError({
      category: 'STRUCTURE_INVALID',
      rule: 'P0-3',
      message: error instanceof Error ? error.message : String(error),
      file: matrixPath,
      detail: typed?.code,
      exitCode: 2,
    });
    return;
  }

  const review = isRecord(document.review) ? document.review : {};
  const reviewed = withReview(cluster, review);
  const proposal = document.proposal;

  const violations: string[] = [];
  let authorized = false;
  if (parsed.validate) {
    violations.push(...validateDuplicateCluster(reviewed));
    if (isRecord(proposal)) {
      try {
        violations.push(...proveAbstraction(reviewed, proposal as unknown as AbstractionProposal));
      } catch (error) {
        exitWithError({
          category: 'STRUCTURE_INVALID',
          rule: 'P0-3',
          message: error instanceof Error ? error.message : String(error),
          file: matrixPath,
          exitCode: 2,
        });
        return;
      }
    }
    authorized =
      violations.length === 0 &&
      reviewed.status === 'under-review' &&
      reviewed.equivalenceProof !== undefined &&
      isRecord(proposal);
  }

  if (violations.length > 0) {
    for (const violation of violations) console.log(`✗ [duplicate-cluster] ${violation}`);
  }
  const rejected = reviewed.status === 'rejected' || violations.length > 0;
  const exitCode: 0 | 1 = rejected ? 1 : 0;
  emit({
    type: 'code-health-duplicates',
    exitCode,
    clusterId: reviewed.clusterId,
    candidateId: reviewed.candidateId,
    status: reviewed.status,
    stableProductionCallSites: reviewed.stableProductionCallSites,
    violations,
    authorized,
  });
  process.exitCode = exitCode;
}

const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  runMain(main);
}
