#!/usr/bin/env tsx
/* eslint-disable security/detect-object-injection, security/detect-non-literal-fs-filename -- Flag names are fixed literal members of the CLI tables; every ledger/path is resolved beneath an explicit --root through the canonical containment helper. */
/**
 * Phase 4 duplicate-clustering CLI (read-only review).
 *
 * Flags:
 *   --matrix <file>   duplicate matrix document (required). Shape:
 *                     { candidateId, input: DuplicateInput,
 *                       restrictions?: { approvedScope?, declaredCallSites? },
 *                       review?: { equivalenceProof, maintenanceBenefit, rollback, redaction },
 *                       proposal?: AbstractionProposal }
 *   --ledger <file>   HEAD-tracked ledger JSON beneath --root supplying the P4 `abstract` candidate
 *   --root <dir>      explicit repository root for --ledger resolution (default: cwd)
 *   --validate        also run the abstraction guard (structural completeness + item-wise proof)
 *
 * Authorization is anchored to a HEAD-tracked ledger (working bytes must equal the HEAD blob). Without
 * `--ledger` (or when the ledger is not tracked at HEAD) the authority cannot be established, so the
 * result is `deferred` (a non-approval state) — a caller-declared authority is never used to authorize.
 * The caller's `restrictions` may only NARROW the tracked authority.
 *
 * This CLI clusters and reviews only; it never writes a patch and never migrates code. An
 * `under-review` result is NOT an approval: the human approval gate plus `code-health-apply.ts`
 * authorize an abstraction, and only inside an isolated project.
 *
 * Exit codes: 0 reviewed (under-review/deferred), 1 rejected or guard violation, 2 input error.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CodeHealthError } from '../logic/code-health-contract.js';
import type {
  AbstractionProposal,
  CodeHealthLedger,
  DuplicateCluster,
  DuplicateInput,
  RollbackPlan,
} from '../logic/code-health-contract.js';
import {
  authorityFromLedgerCandidate,
  clusterDuplicates,
  proveAbstraction,
  restrictAuthority,
  validateDuplicateCluster,
  type DuplicateClusterAuthority,
} from '../logic/code-health-duplicate-logic.js';
import { exitWithError } from '../lib/cli-error.js';
import { readTrackedJson, toTrackedRelativePath } from '../lib/code-health-deletion-authority.js';
import { resolveControlledRelativePath } from '../lib/code-health-file-verifier.js';
import { readJsonOrExit } from '../lib/read-json-or-exit.js';
import { runMain } from '../lib/run-main.js';

const VALUE_FLAGS = ['matrix', 'ledger', 'root'] as const;
const BOOLEAN_FLAGS = ['validate'] as const;

class DuplicateArgumentError extends Error {}

interface ParsedArgs {
  matrix?: string;
  ledger?: string;
  root?: string;
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
  return { matrix: values.matrix, ledger: values.ledger, root: values.root, validate: flags.validate === true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Attach ONLY the semantic review fields to the recomputed cluster; structural fields stay derived. */
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

/** Fail-closed authority used when no HEAD-tracked ledger establishes the P4 abstract candidate. */
function untrackedAuthority(candidateId: string): DuplicateClusterAuthority {
  return {
    candidateId,
    phase: 'P4',
    action: 'abstract',
    approvedScope: [],
    declaredCallSites: [],
    declaredTests: [],
    regressionCommands: [],
    trackedFacts: [],
  };
}

function emit(payload: Record<string, unknown>): void {
  console.log(`DUPLICATES_JSON ${JSON.stringify(payload)}`);
}

/**
 * Resolve the authority from a HEAD-tracked ledger. Returns the derived authority or a `{ error }`
 * describing why the tracked authority could not be established (an input error → exit 2).
 */
async function resolveTrackedAuthority(
  root: string,
  ledgerFlag: string,
  candidateId: string,
  restrictions: Record<string, unknown>,
): Promise<{ authority: DuplicateClusterAuthority } | { error: string; detail?: string }> {
  const ledgerRelative = toTrackedRelativePath(root, ledgerFlag);
  if (ledgerRelative === null) {
    return { error: 'the --ledger authority must be a repository-relative tracked file beneath --root' };
  }
  const ledgerRead = await readTrackedJson(root, ledgerRelative);
  if (ledgerRead.value === undefined) {
    return {
      error: 'the --ledger authority must be tracked at HEAD with working bytes equal to the HEAD blob',
      detail: ledgerRead.violations.join('; '),
    };
  }
  const ledger = ledgerRead.value as CodeHealthLedger;
  const candidates: unknown[] = isRecord(ledger) && Array.isArray(ledger.candidates) ? ledger.candidates : [];
  const candidate = candidates.find(
    (entry): entry is Record<string, unknown> => isRecord(entry) && entry.candidateId === candidateId,
  );
  if (candidate === undefined) {
    return { error: `the tracked ledger does not record candidate ${candidateId}` };
  }
  const authority = authorityFromLedgerCandidate(candidate);
  if (authority === null) {
    return { error: `the tracked ledger candidate ${candidateId} is not a P4 abstract candidate` };
  }
  return { authority: restrictAuthority(authority, restrictions) };
}

/** Every stable call site and implementation must exist as a real file beneath the explicit root. */
async function missingTrackedPaths(root: string, cluster: DuplicateCluster): Promise<string[]> {
  const files = new Set<string>();
  for (const site of cluster.stableProductionCallSites) {
    const file = site.slice(0, site.lastIndexOf(':'));
    if (file !== '') files.add(file);
  }
  for (const implementation of cluster.implementations) files.add(implementation.file);
  const missing: string[] = [];
  for (const file of files) {
    const resolution = resolveControlledRelativePath(root, file);
    if (!resolution.ok || resolution.absolutePath === undefined) {
      missing.push(file);
      continue;
    }
    try {
      const stats = await fs.stat(resolution.absolutePath);
      if (!stats.isFile()) missing.push(file);
    } catch {
      missing.push(file);
    }
  }
  return missing.sort();
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
      detail: 'usage: code-health-duplicates.ts --matrix <file> [--ledger <file>] [--root <dir>] [--validate]',
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
  if (!isRecord(document.input) || typeof document.candidateId !== 'string') {
    exitWithError({
      category: 'STRUCTURE_INVALID',
      rule: 'P0-2',
      message: 'duplicate matrix 必须包含 input 对象与 candidateId',
      file: matrixPath,
      exitCode: 2,
    });
    return;
  }

  const input = document.input as unknown as DuplicateInput;
  const restrictions = isRecord(document.restrictions) ? document.restrictions : {};

  let authority: DuplicateClusterAuthority;
  let authoritySource: 'tracked-ledger' | 'unavailable';
  if (parsed.ledger === undefined) {
    authority = untrackedAuthority(document.candidateId);
    authoritySource = 'unavailable';
  } else {
    const root = path.resolve(parsed.root ?? process.cwd());
    const resolved = await resolveTrackedAuthority(root, parsed.ledger, document.candidateId, restrictions);
    if ('error' in resolved) {
      exitWithError({
        category: 'STRUCTURE_INVALID',
        rule: 'P0-3',
        message: resolved.error,
        file: root,
        detail: resolved.detail,
        exitCode: 2,
      });
      return;
    }
    authority = resolved.authority;
    authoritySource = 'tracked-ledger';
  }

  let cluster: DuplicateCluster;
  try {
    cluster = clusterDuplicates(input, authority);
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

  const reviewed = withReview(cluster, isRecord(document.review) ? document.review : {});
  const proposal = document.proposal;

  const violations: string[] = [];
  if (parsed.ledger !== undefined && authoritySource === 'tracked-ledger') {
    const root = path.resolve(parsed.root ?? process.cwd());
    const missing = await missingTrackedPaths(root, reviewed);
    for (const file of missing) {
      violations.push(`tracked production path does not exist beneath --root: ${file}`);
    }
  }
  if (parsed.validate) {
    violations.push(...validateDuplicateCluster(reviewed));
    // A deferred cluster is a non-approval state: the guard is not run as a failure (exit 0) because
    // the authorization facts were never established. Only an under-review/rejected cluster is judged.
    if (reviewed.status !== 'deferred' && isRecord(proposal)) {
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
  }

  const authorized =
    authoritySource === 'tracked-ledger' &&
    violations.length === 0 &&
    reviewed.status === 'under-review' &&
    reviewed.equivalenceProof !== undefined &&
    isRecord(proposal);

  if (violations.length > 0) {
    for (const violation of violations) console.log(`✗ [duplicate-cluster] ${violation}`);
  }
  const rejected = reviewed.status === 'rejected' || violations.length > 0;
  const exitCode: 0 | 1 = rejected ? 1 : 0;
  emit({
    type: 'code-health-duplicates',
    exitCode,
    authoritySource,
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
