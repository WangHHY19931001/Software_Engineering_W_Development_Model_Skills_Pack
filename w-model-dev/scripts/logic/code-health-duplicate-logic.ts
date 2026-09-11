/* eslint-disable security/detect-object-injection -- Every object lookup is over the frozen contract's literal key set or a Map built from parsed evidence; no caller-controlled key reaches a raw index. */
/**
 * Phase 4 duplicate clustering and abstraction guard (pure).
 *
 * Purpose: identify structurally similar implementations, but authorize an abstraction ONLY when
 *   - at least two INDEPENDENT stable production call sites are positively established from the
 *     tracked-ledger candidate: each must be declared in the approved migration scope, carry a
 *     recorded `call-site:` / `contract:` / `regression:` fact, not be recorded as
 *     generated/dead/one-off/mock/fixture, not be test-only, and be covered by an observed regression
 *     command;
 *   - at least two structural views (AST, data-flow, call-graph) carry TYPED `key=value` evidence with
 *     a meaningful arity — free text cannot satisfy the floor;
 *   - every semantic dimension (inputs/outputs, ordering/mutations/side-effects, errors/retries,
 *     lifecycle/resources, security, concurrency/platform) is proven item-wise, not merely asserted;
 *   - the maintenance benefit is quantified (fewer behaviour owners / bug-fix surfaces, a cohesive
 *     API, no configuration explosion) rather than "a few lines shorter".
 *
 * Default-deny (Task 4/5 lesson, applied here): a determination that authorizes abstraction must be
 * derived from tracked/ledger-recorded facts. This module is PURE — it cannot itself prove that the
 * `trackedFacts` it receives came from a HEAD-tracked ledger. The IO entry points must resolve the
 * authority from a HEAD-tracked ledger (working bytes equal to the HEAD blob) and derive the
 * authority from it; a caller-declared authority may only ADD restriction, never authorize. When the
 * IO layer cannot establish that tracked provenance it must pass an authority with empty
 * `trackedFacts`, which forces `deferred` (a non-approval state). This module never reads files or
 * runs commands.
 *
 * Un-authorizing inputs are STRUCTURALLY incapable of clearing a requirement:
 *   - textual similarity / line count have no representation in the frozen contract at all;
 *   - the test view never satisfies the structural-view floor, and a test path (declared in `tests`
 *     or matching test conventions) is always excluded from the stable call-site count;
 *   - `excluded:` facts for generated/dead/one-off/mock/fixture copies remove a call site from the
 *     stable set even when the candidate also declares it in `callSites`;
 *   - a proof dimension is accepted only when it carries canonical `item=equivalent` evidence for every
 *     required sub-item; prose, a difference claim, or a missing/negative verdict fails it.
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
/** Minimum typed entries per view before that view counts as structural support. */
const STRUCTURAL_VIEW_ARITY = 2;

/** Closed key vocabulary: a structural view entry counts only when it is `<allowed-key>=<value>`. */
export const STRUCTURAL_VIEW_KEYS = {
  ast: ['node', 'branch', 'control-flow', 'shape', 'expression', 'statement'],
  dataFlow: ['input', 'output', 'mutation', 'side-effect', 'flow', 'parameter', 'return'],
  callGraph: ['caller', 'callee', 'lifecycle', 'ownership', 'neighborhood', 'entry', 'exit'],
} as const;

/**
 * Per-key closed value vocabulary: `key=zzz` padding must not clear the structural floor. Keys whose
 * value is a repository call site (`caller` / `callee`) are validated as `<file>:<symbol>` instead of by
 * literal membership. A value outside the set contributes nothing (fail-closed: no authority is added).
 */
export const STRUCTURAL_VIEW_VALUES: Readonly<Record<string, readonly string[]>> = {
  node: ['conditional', 'sequential', 'loop', 'call', 'expression-statement', 'return', 'throw'],
  branch: ['missing-or-hit', 'multi-arm', 'early-return', 'guard', 'single-path', 'none'],
  'control-flow': ['single-return', 'multi-return', 'exception-path', 'fallthrough', 'none'],
  shape: ['block', 'expression', 'declaration', 'object', 'array', 'function'],
  expression: ['call', 'member-access', 'binary', 'literal', 'template', 'await'],
  statement: ['expression-statement', 'declaration', 'return', 'if', 'try', 'loop'],
  input: ['cache-key', 'request', 'config', 'parameter', 'state', 'none'],
  output: ['value-or-loader', 'value', 'void', 'promise', 'state', 'none'],
  mutation: ['none', 'local', 'shared-state', 'parameter', 'cache'],
  'side-effect': ['none', 'write', 'emit', 'log', 'network', 'storage'],
  flow: ['forward', 'bidirectional', 'passthrough', 'merge', 'none'],
  parameter: ['none', 'single', 'multiple', 'options-object', 'callback'],
  return: ['value', 'void', 'promise', 'early', 'conditional', 'none'],
  lifecycle: ['shared-cache', 'per-call', 'singleton', 'request-scoped', 'none'],
  ownership: ['shared', 'caller-owned', 'callee-owned', 'none'],
  neighborhood: ['single-caller', 'multi-caller', 'isolated', 'none'],
  entry: ['public-api', 'internal', 'none'],
  exit: ['return', 'throw', 'callback', 'none'],
};

/**
 * Canonical tracked-fact prefixes recorded in the ledger candidate's `sources`:
 *   - `call-site:<file>:<symbol>`  — the identifier is a supported production call site;
 *   - `contract:<file>:<symbol>`   — a contract is recorded for it;
 *   - `regression:<file>:<symbol>` — a regression signal is recorded for it;
 *   - `excluded:<reason>:<file>:<symbol>` — it must NOT be treated as a stable production site.
 * Any `excluded:` reason counts (generated / dead / one-off / mock / fixture / …): the exclusion is
 * default-deny, so a new reason cannot accidentally authorize.
 */
export const TRACKED_FACT_PREFIXES = ['call-site', 'contract', 'regression', 'excluded'] as const;

/**
 * Ledger-derived authority for one abstraction cluster. Field values mirror the tracked ledger
 * candidate (`changeScope.files`, `callSites`, `tests`, `commands`, `sources`). The IO entry points
 * must build it from a HEAD-tracked ledger; the pure layer treats it as input and never authenticates
 * the provenance itself.
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
  /**
   * Canonical tracked facts (`call-site:` / `contract:` / `regression:` / `excluded:`) from the ledger
   * candidate's `sources`. An empty list is the fail-closed default and forces `deferred`.
   */
  trackedFacts: string[];
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
  if (!Array.isArray(authority.approvedScope)) {
    reasons.push('authority.approvedScope must be an array');
  } else if (authority.approvedScope.some((entry) => !isRelativePath(entry))) {
    reasons.push('authority.approvedScope must contain repository-relative paths');
  }
  if (!isStringArray(authority.declaredCallSites)) reasons.push('authority.declaredCallSites must be a string array');
  if (!isStringArray(authority.declaredTests)) reasons.push('authority.declaredTests must be a string array');
  if (!isStringArray(authority.trackedFacts)) reasons.push('authority.trackedFacts must be a string array');
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

interface ParsedTrackedFacts {
  callSites: Set<string>;
  contracts: Set<string>;
  regressions: Set<string>;
  exclusions: Set<string>;
  /**
   * `excluded:` facts whose target id could not be parsed. They are retained (not dropped) because a
   * malformed exclusion must fail CLOSED: silently ignoring it would leave the site looking stable and
   * could authorize an abstraction the tracked facts intended to forbid (default-deny).
   */
  malformedExclusions: string[];
}

/**
 * Parse the canonical `sources` facts. Only the closed prefix vocabulary is recognised; an unknown
 * prefix is ignored (it can never add authority). Any `excluded:` reason excludes the id; a malformed
 * `excluded:` fact is retained in `malformedExclusions` so callers can refuse instead of treating the
 * site as stable.
 */
export function parseTrackedFacts(facts: readonly string[]): ParsedTrackedFacts {
  const callSites = new Set<string>();
  const contracts = new Set<string>();
  const regressions = new Set<string>();
  const exclusions = new Set<string>();
  const malformedExclusions: string[] = [];
  for (const fact of facts) {
    if (typeof fact !== 'string') continue;
    const separator = fact.indexOf(':');
    if (separator === -1) continue;
    const prefix = fact.slice(0, separator);
    const rest = fact.slice(separator + 1);
    if (prefix === 'excluded') {
      const secondSeparator = rest.indexOf(':');
      if (secondSeparator === -1) {
        malformedExclusions.push(fact);
        continue;
      }
      const id = rest.slice(secondSeparator + 1);
      if (parseCallSite(id) === null) malformedExclusions.push(fact);
      else exclusions.add(id);
      continue;
    }
    if (parseCallSite(rest) === null) continue;
    if (prefix === 'call-site') callSites.add(rest);
    else if (prefix === 'contract') contracts.add(rest);
    else if (prefix === 'regression') regressions.add(rest);
  }
  return { callSites, contracts, regressions, exclusions, malformedExclusions };
}

/**
 * Test-only determination. Membership in the declared test set OR a conventional test-surface path
 * makes a path test-only; the check can only ADD exclusion, so a caller cannot relabel a test helper
 * as production to inflate the stable call-site count.
 */
export function isTestOnlyPath(file: string, declaredTests: ReadonlySet<string>): boolean {
  return declaredTests.has(file) || TEST_PATH_PATTERN.test(file);
}

/**
 * Count of typed `key=value` entries whose key is in the view's closed vocabulary AND whose value is in
 * that key's closed value set (call-site-valued keys are validated as `<file>:<symbol>`).
 */
function typedEntryCount(entries: readonly string[], allowed: readonly string[]): number {
  let count = 0;
  for (const entry of entries) {
    if (typeof entry !== 'string') continue;
    const separator = entry.indexOf('=');
    if (separator <= 0) continue;
    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (value === '' || !(allowed as readonly string[]).includes(key)) continue;
    // eslint-disable-next-line security/detect-object-injection -- key is validated against the closed key vocabulary above.
    const allowedValues = STRUCTURAL_VIEW_VALUES[key];
    if (key === 'caller' || key === 'callee') {
      if (parseCallSite(value) === null) continue;
    } else if (allowedValues === undefined || !allowedValues.includes(value)) {
      continue;
    }
    count += 1;
  }
  return count;
}

/**
 * Evidence-based structural support: the number of views that carry at least `STRUCTURAL_VIEW_ARITY`
 * typed entries from the closed vocabulary. Free text (no `=`, unknown key, empty value) contributes
 * nothing, so prose placed in `ast`/`dataFlow`/`callGraph` cannot satisfy the floor.
 */
export function structuralViewSupport(views: {
  ast: readonly string[];
  dataFlow: readonly string[];
  callGraph: readonly string[];
}): number {
  const counts = [
    typedEntryCount(views.ast, STRUCTURAL_VIEW_KEYS.ast),
    typedEntryCount(views.dataFlow, STRUCTURAL_VIEW_KEYS.dataFlow),
    typedEntryCount(views.callGraph, STRUCTURAL_VIEW_KEYS.callGraph),
  ];
  return counts.filter((count) => count >= STRUCTURAL_VIEW_ARITY).length;
}

/** A regression signal is a real observed command with an integer exit code, never a declaration. */
function hasRegressionSignal(commands: readonly CommandEvidence[]): boolean {
  return commands.some((command) => command.observation === 'observed' && typeof command.exitCode === 'number');
}

/**
 * Derive the pure authority from a ledger-recorded candidate. The IO layer calls this only after it
 * has verified the ledger is tracked at HEAD; this helper performs no IO and adds no authority.
 */
export function authorityFromLedgerCandidate(candidate: unknown): DuplicateClusterAuthority | null {
  if (!isRecord(candidate)) return null;
  if (
    typeof candidate.candidateId !== 'string' ||
    candidate.phase !== 'P4' ||
    candidate.action !== 'abstract' ||
    !CANDIDATE_ID_PATTERN.test(candidate.candidateId)
  ) {
    return null;
  }
  const changeScope = isRecord(candidate.changeScope) ? candidate.changeScope : {};
  const approvedScope = Array.isArray(changeScope.files)
    ? changeScope.files.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const declaredCallSites = isStringArray(candidate.callSites) ? candidate.callSites : [];
  const declaredTests = isStringArray(candidate.tests) ? candidate.tests : [];
  const regressionCommands = Array.isArray(candidate.commands)
    ? (candidate.commands as unknown[]).filter((entry): entry is CommandEvidence => isRecord(entry))
    : [];
  const trackedFacts = isStringArray(candidate.sources) ? candidate.sources : [];
  return {
    candidateId: candidate.candidateId,
    phase: 'P4',
    action: 'abstract',
    approvedScope,
    declaredCallSites,
    declaredTests,
    regressionCommands,
    trackedFacts,
  };
}

/**
 * Restrict a tracked authority with caller-declared values. A caller may only NARROW
 * (`approvedScope` / `declaredCallSites` intersection); a caller-declared call site that is not in the
 * tracked authority is dropped, never added.
 */
export function restrictAuthority(
  tracked: DuplicateClusterAuthority,
  restriction: { approvedScope?: unknown; declaredCallSites?: unknown },
): DuplicateClusterAuthority {
  const scopeRestriction = isStringArray(restriction.approvedScope) ? new Set(restriction.approvedScope) : undefined;
  const siteRestriction = isStringArray(restriction.declaredCallSites)
    ? new Set(restriction.declaredCallSites)
    : undefined;
  return {
    ...tracked,
    approvedScope:
      scopeRestriction === undefined
        ? tracked.approvedScope
        : tracked.approvedScope.filter((entry) => scopeRestriction.has(entry)),
    declaredCallSites:
      siteRestriction === undefined
        ? tracked.declaredCallSites
        : tracked.declaredCallSites.filter((entry) => siteRestriction.has(entry)),
  };
}

/**
 * Cluster one duplicate pair. The stable production call-site set is derived from tracked facts only;
 * a call site needs a `call-site:` + `contract:` + `regression:` fact, must be inside the approved
 * scope, must not be test-only, and must not be recorded as generated/dead/one-off/mock/fixture.
 * Anything missing keeps the pair `deferred` (a non-approval state); a test-only implementation makes
 * it `rejected`. The returned cluster never claims `approved`: approval is a human decision enforced by
 * the apply gate.
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

  const support = structuralViewSupport(input);
  const regressionSignal = hasRegressionSignal(authority.regressionCommands);
  const facts = parseTrackedFacts(authority.trackedFacts);
  // Default-deny: an `excluded:` fact whose target cannot be parsed is a contradiction in the tracked
  // facts. Refuse rather than silently dropping it and treating the site as stable.
  if (facts.malformedExclusions.length > 0) {
    throw new CodeHealthError(
      'STRUCTURE_INVALID',
      `duplicate clustering refuses malformed excluded: facts (default-deny): ${facts.malformedExclusions.join(', ')}`,
    );
  }

  const approvedScope = new Set(authority.approvedScope);
  const seenSiteFiles = new Set<string>();
  const stableProductionCallSites: string[] = [];
  for (const site of authority.declaredCallSites) {
    const parsed = parseCallSite(site);
    if (parsed === null) continue;
    if (isTestOnlyPath(parsed.file, declaredTests)) continue;
    if (!approvedScope.has(parsed.file)) continue;
    if (!facts.callSites.has(site) || !facts.contracts.has(site) || !facts.regressions.has(site)) continue;
    if (facts.exclusions.has(site)) continue;
    if (seenSiteFiles.has(parsed.file)) continue;
    seenSiteFiles.add(parsed.file);
    stableProductionCallSites.push(site);
  }

  let status: DuplicateCluster['status'];
  if (testOnlyImplementations.length > 0) {
    status = 'rejected';
  } else if (
    stableProductionCallSites.length < DISTINCT_SITE_FILES ||
    support < STRUCTURAL_VIEW_FLOOR ||
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

  if (structuralViewSupport(cluster.views) < STRUCTURAL_VIEW_FLOOR) {
    violations.push('accidental similarity (prose or test-only) is not structural equivalence evidence');
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
