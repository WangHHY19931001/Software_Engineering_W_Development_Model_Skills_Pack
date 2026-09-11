/* eslint-disable security/detect-object-injection -- Every object lookup is over the frozen contract's literal key set or a Map built from parsed evidence; no caller-controlled key reaches a raw index. */
/**
 * Phase 4 duplicate clustering and abstraction guard (pure).
 *
 * Purpose: identify structurally similar implementations, but authorize an abstraction ONLY when
 *   - at least two INDEPENDENT stable production call sites are positively established from the
 *     ledger-recorded authority (declared in the approved migration scope, not test-only, and covered
 *     by a recorded regression command);
 *   - every semantic dimension (inputs/outputs, ordering/mutations/side-effects, errors/retries,
 *     lifecycle/resources, security, concurrency/platform) is proven item-wise, not merely asserted;
 *   - the maintenance benefit is quantified (fewer behaviour owners / bug-fix surfaces, a cohesive
 *     API, no configuration explosion) rather than "a few lines shorter".
 *
 * Default-deny (Task 4/5 lesson, applied here): a determination that authorizes abstraction is derived
 * from the ledger-recorded authority, and every unproven item is a violation. Textual similarity, a
 * shorter diff, fewer lines, mock/fixture similarity, and platform/lifecycle differences are
 * STRUCTURALLY incapable of clearing a dimension:
 *   - the contract has no textual-similarity or line-count input that counts as a semantic proof;
 *   - the test view never satisfies the ≥2 structural views required for an under-review cluster;
 *   - a test path (declared in `tests` or matching test conventions) is always test-only, so it is
 *     excluded from the stable call-site count and is a violation when claimed as a stable site;
 *   - a proof dimension is accepted only when it carries the canonical `item=equivalent` evidence for
 *     every required sub-item; prose, a difference claim, or a missing/negative verdict fails it.
 *
 * Honest authority boundary: a pure function cannot authenticate the ledger/authority it is handed.
 * The CLI (IO) resolves the authority from the tracked ledger and cross-checks the caller-declared
 * cluster against the recomputation; the ledger record, the human approval gate, and the role
 * signature chain remain the authority. This module never reads files or runs commands.
 *
 * `logic/` has no `node:fs` / `node:child_process` / `node:path` import (dependency-boundaries gate).
 */

import {
  CodeHealthError,
  isRelativePath,
  validateCommandEvidence,
  type AbstractionProposal,
  type CodeHealthAction,
  type CodeHealthPhase,
  type CommandEvidence,
  type DuplicateCluster,
  type DuplicateInput,
} from './code-health-contract.js';

const IMPLEMENTATION_HASH_PATTERN = /^[0-9a-f]{64}$/;
const CANDIDATE_ID_PATTERN = /^CHG-P[1-4]-[0-9]{8}-[0-9]{3,}$/;
const SHA40_PATTERN = /^[0-9a-f]{40}$/;
const CALL_SITE_PATTERN = /^([^\s:]+):([^\s:]+)$/;
/** Conservative test-surface conventions; membership only ever ADDS exclusion (default-deny). */
const TEST_PATH_PATTERN = /(^|\/)(tests?|__tests__|spec|fixtures?|mocks?|__mocks__)\/|\.(test|spec)\.[^/]+$/i;
const DISTINCT_SITE_FILES = 2;
const STRUCTURAL_VIEW_FLOOR = 2;

/**
 * Ledger-derived authority for one abstraction cluster. Fields are exactly the ledger-recorded facts
 * the CLI resolves from the tracked ledger candidate (`candidate.callSites`, `changeScope.files`,
 * `tests`, `commands`) before any pure decision is made.
 */
export interface DuplicateClusterAuthority {
  candidateId: string;
  phase: CodeHealthPhase;
  action: CodeHealthAction;
  /** Tracked production scope the abstraction is approved to migrate (`changeScope.files`). */
  approvedScope: string[];
  /** Ledger-recorded production call-site identifiers in `file:symbol` form. */
  declaredCallSites: string[];
  /** Ledger-recorded test files; a path here is always test-only. */
  declaredTests: string[];
  /** Ledger-recorded commands; at least one observed command is the required regression signal. */
  regressionCommands: CommandEvidence[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/** Structural validity of one `DuplicateInput`; reasons rather than a throw so callers can aggregate. */
export function validateDuplicateInput(input: unknown): string[] {
  const reasons: string[] = [];
  if (!isRecord(input)) return ['duplicate input must be an object'];
  if (!Array.isArray(input.implementations) || input.implementations.length < 2) {
    reasons.push('implementations require at least two independent production implementations');
  } else {
    input.implementations.forEach((entry, index) => {
      if (!isRecord(entry)) {
        reasons.push(`implementations[${index}] must be an object`);
        return;
      }
      if (!isRelativePath(entry.file))
        reasons.push(`implementations[${index}].file must be a repository-relative path`);
      if (!isNonEmptyString(entry.symbol)) reasons.push(`implementations[${index}].symbol requires a non-empty value`);
      if (typeof entry.sourceHash !== 'string' || !IMPLEMENTATION_HASH_PATTERN.test(entry.sourceHash)) {
        reasons.push(`implementations[${index}].sourceHash must be a lowercase SHA-256 digest`);
      }
    });
  }
  for (const field of ['ast', 'dataFlow', 'callGraph', 'tests'] as const) {
    if (!isStringArray(input[field])) reasons.push(`${field} must be a string array`);
  }
  return reasons;
}

/** Structural validity of the ledger-derived authority. Phase/action/candidate identity are mandatory. */
export function validateDuplicateAuthority(authority: unknown): string[] {
  const reasons: string[] = [];
  if (!isRecord(authority)) return ['duplicate clustering requires a ledger-recorded authority'];
  if (typeof authority.candidateId !== 'string' || !CANDIDATE_ID_PATTERN.test(authority.candidateId)) {
    reasons.push('authority.candidateId must be a ledger candidate identifier');
  }
  if (authority.phase !== 'P4') reasons.push('authority.phase must be P4');
  if (authority.action !== 'abstract') reasons.push("authority.action must be 'abstract'");
  if (!Array.isArray(authority.approvedScope) || authority.approvedScope.length === 0) {
    reasons.push('authority.approvedScope must be a non-empty array');
  } else if (authority.approvedScope.some((entry) => !isRelativePath(entry))) {
    reasons.push('authority.approvedScope must contain repository-relative paths');
  }
  if (!isStringArray(authority.declaredCallSites)) reasons.push('authority.declaredCallSites must be a string array');
  if (!isStringArray(authority.declaredTests)) reasons.push('authority.declaredTests must be a string array');
  if (!Array.isArray(authority.regressionCommands)) {
    reasons.push('authority.regressionCommands must be an array');
  } else {
    authority.regressionCommands.forEach((command, index) => {
      const commandReasons: string[] = [];
      validateCommandEvidence(command, `authority.regressionCommands[${index}]`, commandReasons);
      reasons.push(...commandReasons);
    });
  }
  return reasons;
}

/** Structural validity of one cluster; a missing/derived field is not accepted. */
export function validateDuplicateCluster(value: unknown): string[] {
  const reasons: string[] = [];
  if (!isRecord(value)) return ['cluster must be an object'];
  if (!isNonEmptyString(value.clusterId)) reasons.push('cluster.clusterId requires a non-empty value');
  if (typeof value.candidateId !== 'string' || !CANDIDATE_ID_PATTERN.test(value.candidateId)) {
    reasons.push('cluster.candidateId is invalid');
  }
  if (!Array.isArray(value.implementations) || value.implementations.length < 2) {
    reasons.push('cluster.implementations require at least two entries');
  } else {
    value.implementations.forEach((entry, index) => {
      if (!isRecord(entry)) {
        reasons.push(`cluster.implementations[${index}] must be an object`);
        return;
      }
      if (!isRelativePath(entry.file)) reasons.push(`cluster.implementations[${index}].file is invalid`);
      if (!isNonEmptyString(entry.symbol)) reasons.push(`cluster.implementations[${index}].symbol is required`);
      if (typeof entry.sourceHash !== 'string' || !IMPLEMENTATION_HASH_PATTERN.test(entry.sourceHash)) {
        reasons.push(`cluster.implementations[${index}].sourceHash is invalid`);
      }
    });
  }
  if (!['under-review', 'deferred', 'rejected', 'approved'].includes(value.status as string)) {
    reasons.push('cluster.status is invalid');
  }
  if (!isStringArray(value.stableProductionCallSites)) {
    reasons.push('cluster.stableProductionCallSites must be a string array');
  }
  if (!isRecord(value.views)) {
    reasons.push('cluster.views is required');
  } else {
    for (const field of ['ast', 'dataFlow', 'callGraph', 'signatures', 'tests'] as const) {
      if (!isStringArray(value.views[field])) reasons.push(`cluster.views.${field} must be a string array`);
    }
  }
  return reasons;
}

/** Structural validity of one abstraction proposal. */
export function validateAbstractionProposal(value: unknown): string[] {
  const reasons: string[] = [];
  if (!isRecord(value)) return ['proposal must be an object'];
  if (!isNonEmptyString(value.targetApi)) reasons.push('proposal.targetApi is required');
  if (!isStringArray(value.migratedCallSites)) reasons.push('proposal.migratedCallSites must be a string array');
  for (const field of [
    'inputsOutputs',
    'errorsRetries',
    'lifecycleResources',
    'security',
    'concurrencyPlatforms',
    'maintenanceBenefit',
  ] as const) {
    if (!isNonEmptyString(value[field])) reasons.push(`proposal.${field} is required`);
  }
  return reasons;
}

function parseCallSite(value: string): { file: string; symbol: string } | null {
  const match = CALL_SITE_PATTERN.exec(value);
  if (match === null) return null;
  const file = match[1]!;
  const symbol = match[2]!;
  if (!isRelativePath(file) || symbol === '') return null;
  return { file, symbol };
}

/**
 * Test-only determination. Membership in the declared test set OR a conventional test-surface path
 * makes a path test-only; the check can only ADD exclusion, so a caller cannot relabel a test helper
 * as production to inflate the stable call-site count.
 */
export function isTestOnlyPath(file: string, declaredTests: ReadonlySet<string>): boolean {
  return declaredTests.has(file) || TEST_PATH_PATTERN.test(file);
}

/** A regression signal is a real observed command with an integer exit code, never a declaration. */
function hasRegressionSignal(commands: readonly CommandEvidence[]): boolean {
  return commands.some((command) => command.observation === 'observed' && typeof command.exitCode === 'number');
}

/**
 * Cluster one duplicate pair. Structural views and the ≥2 stable production call-site floor decide
 * whether the pair becomes an `under-review` cluster; anything missing keeps it `deferred` (a
 * non-approval state). A test-only implementation makes the pair a `rejected` cluster, because a
 * test-only helper is never a production implementation. The returned cluster never claims `approved`:
 * approval is a human decision enforced by the apply gate.
 */
export function clusterDuplicates(input: DuplicateInput, authority: DuplicateClusterAuthority): DuplicateCluster {
  const inputReasons = validateDuplicateInput(input);
  if (inputReasons.length > 0) {
    throw new CodeHealthError(
      'STRUCTURE_INVALID',
      `duplicate clustering requires a complete input: ${inputReasons.join('; ')}`,
    );
  }
  const authorityReasons = validateDuplicateAuthority(authority);
  if (authorityReasons.length > 0) {
    throw new CodeHealthError(
      'STRUCTURE_INVALID',
      `duplicate clustering requires a ledger-recorded authority: ${authorityReasons.join('; ')}`,
    );
  }

  const declaredTests = new Set<string>([...input.tests, ...authority.declaredTests]);
  const testOnlyImplementations = input.implementations.filter((entry) => isTestOnlyPath(entry.file, declaredTests));

  const structuralSupport = [input.ast, input.dataFlow, input.callGraph].filter((view) => view.length > 0).length;
  const regressionSignal = hasRegressionSignal(authority.regressionCommands);

  const approvedScope = new Set(authority.approvedScope);
  const seenSiteFiles = new Set<string>();
  const stableProductionCallSites: string[] = [];
  for (const site of authority.declaredCallSites) {
    const parsed = parseCallSite(site);
    if (parsed === null) continue;
    if (isTestOnlyPath(parsed.file, declaredTests)) continue;
    if (!approvedScope.has(parsed.file)) continue;
    if (seenSiteFiles.has(parsed.file)) continue;
    seenSiteFiles.add(parsed.file);
    stableProductionCallSites.push(site);
  }

  let status: DuplicateCluster['status'];
  if (testOnlyImplementations.length > 0) {
    status = 'rejected';
  } else if (
    stableProductionCallSites.length < DISTINCT_SITE_FILES ||
    structuralSupport < STRUCTURAL_VIEW_FLOOR ||
    !regressionSignal
  ) {
    status = 'deferred';
  } else {
    status = 'under-review';
  }

  return {
    clusterId: `DUP-${authority.candidateId}`,
    candidateId: authority.candidateId,
    implementations: input.implementations,
    views: {
      ast: input.ast,
      dataFlow: input.dataFlow,
      callGraph: input.callGraph,
      signatures: input.implementations.map((entry) => `${entry.file}:${entry.symbol}`),
      tests: [...declaredTests].sort(),
    },
    stableProductionCallSites,
    status,
    redaction: { status: 'not_reviewed', reasons: [] },
  };
}

/** One proof dimension and the item-wise sub-items it must positively prove. */
const PROOF_DIMENSIONS: Array<{ key: string; label: string; items: readonly string[] }> = [
  { key: 'inputsOutputs', label: 'inputs/outputs', items: ['accepted-inputs', 'produced-outputs'] },
  {
    key: 'orderingMutationsSideEffects',
    label: 'ordering/mutations/side-effects',
    items: ['ordering', 'mutations', 'side-effects'],
  },
  {
    key: 'errorsRetries',
    label: 'errors/retries',
    items: ['error-types', 'error-status', 'error-messages', 'retry', 'failure-timing'],
  },
  {
    key: 'lifecycleResources',
    label: 'lifecycle/resources',
    items: ['initialization', 'finalization', 'cleanup', 'cancellation', 'transactions', 'resource-scope'],
  },
  { key: 'security', label: 'security', items: ['authorization', 'validation-order', 'secrets', 'privilege'] },
  {
    key: 'concurrencyPlatforms',
    label: 'concurrency/platform',
    items: ['locks', 'atomicity', 'idempotency', 'platform'],
  },
];

const EQUIVALENT_VERDICTS = new Set(['equivalent', 'proven', 'equal']);
const DIFFERENCE_PATTERN =
  /different|not equivalent|not proven|unproven|unknown|unverified|n\/a|todo|不一致|不同|platform[- ]specific/i;

/** Parse the canonical `item=verdict; item=verdict` proof format into a Map; prose yields an empty Map. */
function parseProofItems(text: string): Map<string, string> {
  const items = new Map<string, string>();
  for (const rawEntry of text.split(/[;,]/)) {
    const entry = rawEntry.trim();
    if (entry === '') continue;
    const separator = entry.indexOf('=');
    if (separator === -1) continue;
    const key = entry.slice(0, separator).trim();
    const verdict = entry.slice(separator + 1).trim();
    if (key !== '') items.set(key, verdict);
  }
  return items;
}

/**
 * Violations of one proof dimension. A dimension is proven only when every required sub-item is
 * present with an equivalence verdict and the text carries no difference/unknown claim. The returned
 * message always names the dimension so a reviewer can recompute which dimension failed.
 */
function dimensionViolations(label: string, text: unknown, items: readonly string[]): string[] {
  if (!isNonEmptyString(text)) return [`${label} equivalence is not proven (dimension is missing)`];
  const violations: string[] = [];
  if (DIFFERENCE_PATTERN.test(text)) {
    violations.push(`${label} equivalence is not proven (a difference or unknown claim was provided)`);
  }
  const parsed = parseProofItems(text);
  const missing: string[] = [];
  const notEquivalent: string[] = [];
  for (const item of items) {
    const verdict = parsed.get(item);
    if (verdict === undefined) missing.push(item);
    else if (!EQUIVALENT_VERDICTS.has(verdict.toLowerCase())) notEquivalent.push(item);
  }
  if (missing.length > 0)
    violations.push(`${label} equivalence is not proven (missing item(s): ${missing.join(', ')})`);
  if (notEquivalent.length > 0) {
    violations.push(`${label} equivalence is not proven (non-equivalent item(s): ${notEquivalent.join(', ')})`);
  }
  return violations;
}

/**
 * Item-wise consistency between the cluster's proven dimension and the proposal's corresponding
 * dimension: the proposal must repeat the same verdict for every required sub-item. A proposal that
 * narrows, weakens, or contradicts the proof is refused.
 */
function crossCheckDimension(
  label: string,
  proofText: unknown,
  proposalText: unknown,
  items: readonly string[],
): string[] {
  if (!isNonEmptyString(proofText) || !isNonEmptyString(proposalText)) return [];
  const proof = parseProofItems(proofText);
  const proposal = parseProofItems(proposalText);
  const mismatched: string[] = [];
  for (const item of items) {
    if (proof.get(item) !== proposal.get(item)) mismatched.push(item);
  }
  if (mismatched.length > 0) {
    return [`${label} equivalence is not proven between the cluster proof and the proposal (${mismatched.join(', ')})`];
  }
  return [];
}

/**
 * Quantified maintenance benefit. Ownership/bug-fix-surface reduction, consolidation, or a cohesive
 * API counts; a shorter diff, fewer lines, or an unmetered claim does not.
 */
export function isQuantifiedMaintenanceBenefit(text: unknown): boolean {
  if (!isNonEmptyString(text)) return false;
  if (/(fewer|less)\s+(lines|loc|code)\b|shorter\s+(diff|patch|file)|smaller\s+diff|less\s+code/i.test(text)) {
    return false;
  }
  const quantified =
    /\d+\s+(behavior|behaviour|bug[- ]?fix|owner|surface|implementation|call[- ]?site|module|duplicate|configuration|code[- ]?path)/i.test(
      text,
    );
  const cohesive = /consolidat|cohesiv|single shared|one shared|eliminat/i.test(text);
  return quantified || (cohesive && /\d/.test(text));
}

function rollbackViolations(rollback: unknown): string[] {
  if (!isRecord(rollback)) return ['rollback plan is required before an abstraction can be applied'];
  if (rollback.executable !== true) return ['rollback plan must be directly executable'];
  if (typeof rollback.preChangeRevision !== 'string' || !SHA40_PATTERN.test(rollback.preChangeRevision)) {
    return ['rollback preChangeRevision is invalid'];
  }
  if (typeof rollback.command !== 'string' || rollback.command.trim() === '' || /[;&|<>\r\n]/.test(rollback.command)) {
    return ['rollback command is unsafe'];
  }
  if (!isRelativePath(rollback.patchPath)) return ['rollback patchPath must be repository-relative'];
  if (!isNonEmptyString(rollback.owner)) return ['rollback owner is required'];
  return [];
}

function structuralSupport(cluster: DuplicateCluster): number {
  return [cluster.views.ast, cluster.views.dataFlow, cluster.views.callGraph].filter((view) => view.length > 0).length;
}

/**
 * Abstraction guard. Returns the blocking violations; an empty array is the ONLY authorization for a
 * later migration. Every dimension must be positively and item-wise proven; the caller-declared
 * `allDimensionsProven` flag is never trusted on its own. Structurally invalid cluster/proposal
 * records fail closed with a typed `STRUCTURE_INVALID` error instead of being reported as a soft
 * violation, so a malformed input can never be mistaken for a reviewable one.
 */
export function proveAbstraction(cluster: DuplicateCluster, proposal: AbstractionProposal): string[] {
  const clusterReasons = validateDuplicateCluster(cluster);
  if (clusterReasons.length > 0) {
    throw new CodeHealthError(
      'STRUCTURE_INVALID',
      `abstraction proof requires a complete cluster record: ${clusterReasons.join('; ')}`,
    );
  }
  const proposalReasons = validateAbstractionProposal(proposal);
  if (proposalReasons.length > 0) {
    throw new CodeHealthError(
      'STRUCTURE_INVALID',
      `abstraction proof requires a complete proposal record: ${proposalReasons.join('; ')}`,
    );
  }

  const violations: string[] = [];

  if (cluster.status === 'rejected') {
    violations.push('the abstraction cluster is rejected and cannot be authorized');
  }
  if (cluster.status === 'deferred') {
    violations.push('the abstraction cluster is deferred; authorization facts are incomplete');
  }

  if (structuralSupport(cluster) < STRUCTURAL_VIEW_FLOOR) {
    violations.push('accidental similarity (textual or test-only) is not structural equivalence evidence');
  }

  const declaredTests = new Set<string>(cluster.views.tests);
  const testOnlyImplementation = cluster.implementations.some((entry) => isTestOnlyPath(entry.file, declaredTests));
  const testOnlyCallSites = cluster.stableProductionCallSites.filter((site) => {
    const parsed = parseCallSite(site);
    return parsed === null || isTestOnlyPath(parsed.file, declaredTests);
  });
  if (testOnlyImplementation) {
    violations.push('test-only implementation cannot authorize an abstraction');
  }
  if (testOnlyCallSites.length > 0) {
    violations.push(`test-only call sites cannot authorize an abstraction: ${testOnlyCallSites.join(', ')}`);
  }

  const distinctSiteFiles = new Set(cluster.stableProductionCallSites.map((site) => parseCallSite(site)?.file ?? site));
  if (cluster.stableProductionCallSites.length < DISTINCT_SITE_FILES || distinctSiteFiles.size < DISTINCT_SITE_FILES) {
    violations.push(
      `abstraction requires two stable production call sites (independent production paths with a contract and regression signal); observed ${cluster.stableProductionCallSites.length}`,
    );
  }

  const proof = cluster.equivalenceProof;
  if (proof === undefined) {
    for (const dimension of PROOF_DIMENSIONS) {
      violations.push(`${dimension.label} equivalence is not proven (dimension is missing)`);
    }
    violations.push('allDimensionsProven is not established for every semantic dimension');
  } else {
    for (const dimension of PROOF_DIMENSIONS) {
      const proofText = (proof as unknown as Record<string, unknown>)[dimension.key];
      violations.push(...dimensionViolations(dimension.label, proofText, dimension.items));
    }
    if (proof.allDimensionsProven !== true) {
      violations.push('allDimensionsProven is not established for every semantic dimension');
    }
    violations.push(
      ...crossCheckDimension('security', proof.security, proposal.security, [
        'authorization',
        'validation-order',
        'secrets',
        'privilege',
      ]),
    );
    violations.push(
      ...crossCheckDimension('concurrency/platform', proof.concurrencyPlatforms, proposal.concurrencyPlatforms, [
        'locks',
        'atomicity',
        'idempotency',
        'platform',
      ]),
    );
    violations.push(
      ...crossCheckDimension('lifecycle/resources', proof.lifecycleResources, proposal.lifecycleResources, [
        'initialization',
        'finalization',
        'cleanup',
        'cancellation',
        'transactions',
        'resource-scope',
      ]),
    );
    violations.push(
      ...crossCheckDimension('errors/retries', proof.errorsRetries, proposal.errorsRetries, [
        'error-types',
        'error-status',
        'error-messages',
        'retry',
        'failure-timing',
      ]),
    );
    violations.push(
      ...crossCheckDimension('inputs/outputs', proof.inputsOutputs, proposal.inputsOutputs, [
        'accepted-inputs',
        'produced-outputs',
      ]),
    );
  }

  if (!isQuantifiedMaintenanceBenefit(cluster.maintenanceBenefit)) {
    violations.push(
      'maintenance benefit is not quantified (fewer behaviour owners / bug-fix surfaces, a cohesive API, or no configuration explosion is required; a shorter diff is not a benefit)',
    );
  }
  if (!isNonEmptyString(proposal.maintenanceBenefit)) {
    violations.push('maintenance benefit is required on the proposal');
  } else if (cluster.maintenanceBenefit !== undefined && cluster.maintenanceBenefit !== proposal.maintenanceBenefit) {
    violations.push('maintenance benefit is not item-wise consistent between the cluster and the proposal');
  }

  violations.push(...rollbackViolations(proposal.rollback));

  if (typeof proposal.targetApi !== 'string' || proposal.targetApi.trim() === '') {
    violations.push('target API is required for an abstraction');
  }

  const migrated = new Set(proposal.migratedCallSites);
  const stable = new Set(cluster.stableProductionCallSites);
  const migratedDrift = migrated.size !== stable.size || [...migrated].some((site) => !stable.has(site));
  if (migratedDrift) {
    violations.push('migrated call sites must exactly match the minimal stable production call-site set');
  }
  if ([...migrated].some((site) => isTestOnlyPath(parseCallSite(site)?.file ?? site, declaredTests))) {
    violations.push('test-only call sites cannot be part of the migrated set');
  }

  if (cluster.redaction?.status === 'blocked') {
    violations.push('blocked redaction cannot authorize an abstraction');
  }

  return violations;
}
