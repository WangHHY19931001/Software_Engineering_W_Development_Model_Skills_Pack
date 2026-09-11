/* eslint-disable security/detect-object-injection -- Field names come from the frozen contract's literal key set; no caller-controlled key reaches an object lookup. */
/**
 * Phase 3 test-inventory logic (pure).
 *
 * This module owns protected-test classification, the real removal proof, the deletion-facts
 * evaluation, and the inventory review that cross-checks a proposed test removal against the
 * ledger-recorded candidate.
 *
 * Guarantee and honest authority boundary (inherited from Task 4's design lesson):
 *   - This module derives every deletion authorization from the record it is handed: the ledger
 *     candidate's approved scope and declared tests, the inventory's recorded pre/post regression
 *     facts, and the item-wise computed survivor equivalence. Caller-declared `*Equivalent` /
 *     `*Rehomed` labels are only ever cross-checked against the computed comparison, never trusted.
 *   - Author, age, name, indirectness, difficulty, and low coverage are provenance output only. They
 *     are never consulted when deciding whether a removal is allowed.
 *   - A pure function cannot be unforgeable: it cannot authenticate the ledger or inventory it is
 *     handed. The ledger record, the human approval gate in `cli/code-health-apply.ts`, and the role
 *     signature chain are the authority for a real deletion. The irreducible limit is documented here
 *     rather than overclaimed.
 *
 * The real process execution for pre/post suites is an IO boundary and lives in `lib/`; `logic/` has
 * no `node:fs` / `node:child_process` / `node:path` import (dependency-boundaries gate).
 */

import {
  CodeHealthError,
  validateRevision,
  type CodeHealthLedger,
  type DeletionEvaluation,
  type DeletionFacts,
  type ErrorCode,
  type ProtectedTestClass,
  type TestRecord,
  type TestRemovalProofInput,
} from './code-health-contract.js';

export const PROTECTED_TEST_CLASSES = [
  'unique-negative',
  'boundary',
  'security',
  'concurrency',
  'platform',
  'migration-rollback',
  'pre-push',
  'self-test',
  'docs-consistency',
] as const satisfies readonly ProtectedTestClass[];

/** Required non-empty text fields of a complete `TestRecord`; author/age are recorded but never decisive. */
const TEST_RECORD_TEXT_FIELDS = [
  'testId',
  'file',
  'symbol',
  'author',
  'createdAt',
  'lastChangedAt',
  'level',
  'setup',
  'stimulus',
  'oracle',
  'failureSensitivity',
  'scenarioClass',
] as const;

const TEST_LEVELS = ['unit', 'integration', 'system', 'acceptance'] as const;
const REHOME_ARTIFACTS = ['rtm', 'coverage', 'docs-consistency', 'sample-matrix'] as const;
const CANDIDATE_ID_PATTERN = /^CHG-P[1-4]-[0-9]{8}-[0-9]{3,}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/**
 * Structural validity of one `TestRecord`. Returns reasons rather than throwing so a whole inventory
 * can be reviewed fail-closed without aborting on the first malformed record.
 */
export function validateTestRecord(value: unknown, field = 'test'): string[] {
  const reasons: string[] = [];
  if (!isRecord(value)) return [`${field} must be a test record object`];
  for (const key of TEST_RECORD_TEXT_FIELDS) {
    if (!isNonEmptyString(value[key])) reasons.push(`${field}.${key} requires a non-empty value`);
  }
  if (!isNonEmptyString(value.testId)) {
    // already reported by the loop; keep the record shape stable for downstream lookups
  }
  if (!TEST_LEVELS.includes(value.level as (typeof TEST_LEVELS)[number])) {
    reasons.push(`${field}.level must be unit, integration, system, or acceptance`);
  }
  if (!isStringArray(value.rtmIds)) reasons.push(`${field}.rtmIds must be a string array`);
  if (!isStringArray(value.governanceFacts)) reasons.push(`${field}.governanceFacts must be a string array`);
  return reasons;
}

/**
 * Classify one test into the protected set, or `null` when no protected class applies. Classification
 * uses the test's behavior contract (setup/stimulus/oracle/failureSensitivity/scenarioClass/
 * governanceFacts) plus its identity; `author`, `createdAt`, and `lastChangedAt` are deliberately
 * excluded so provenance can never influence protection.
 */
export function classifyProtectedTest(test: TestRecord): ProtectedTestClass | null {
  if (!isRecord(test)) throw new Error('test record requires a complete object');
  for (const field of TEST_RECORD_TEXT_FIELDS) {
    if (typeof test[field] !== 'string' || test[field]!.trim() === '') {
      throw new Error(`test.${field} requires a non-empty value`);
    }
  }
  if (!Array.isArray(test.rtmIds) || !Array.isArray(test.governanceFacts)) throw new Error('test arrays are required');
  const text = [
    test.testId,
    test.file,
    test.symbol,
    test.setup,
    test.stimulus,
    test.oracle,
    test.failureSensitivity,
    test.scenarioClass,
    ...test.governanceFacts,
  ]
    .join(' ')
    .toLowerCase();
  if (/pre[- ]?push/.test(text)) return 'pre-push';
  if (/self[- ]?test/.test(text)) return 'self-test';
  if (/docs?[- ]consistency/.test(text)) return 'docs-consistency';
  if (/security|auth|injection|secret|redact|privilege/.test(text)) return 'security';
  if (/concurr|race|lock|atomic|idempot|retry|ordering/.test(text)) return 'concurrency';
  if (/platform|windows|linux|git bash|powershell|line ending|executable/.test(text)) return 'platform';
  if (/rollback|migration/.test(text)) return 'migration-rollback';
  if (/boundary|empty|zero|min|max|overflow|truncat|off[- ]by[- ]one/.test(text)) return 'boundary';
  if (/negative|invalid|malformed|missing|error|failure|reject|throw|expected[- ]failure/.test(text)) {
    return 'unique-negative';
  }
  return null;
}

interface GovernanceFact {
  key: string;
  value: string | null;
}

function parseGovernanceFacts(facts: string[]): GovernanceFact[] {
  return facts.map((entry) => {
    const separator = entry.indexOf(':');
    if (separator === -1) return { key: entry.trim(), value: null };
    return { key: entry.slice(0, separator).trim(), value: entry.slice(separator + 1) };
  });
}

function factValues(entries: GovernanceFact[], key: string): string[] {
  return entries.filter((entry) => entry.key === key).map((entry) => entry.value ?? '');
}

/**
 * Evaluate the recorded deletion facts: the measured test count, the source-bound coverage
 * provenance, the 18-item pre-push gate count/order, and the self-test / docs-consistency /
 * fixture-reachability facts. Any change that is not explicitly explained blocks the deletion.
 *
 * Contract-shape note (R1): `governanceFacts` is a `string[]`; the plan's object-shaped
 * `{ prePushCount: 17 }` is expressed here as canonical `key:value` facts (for example
 * `pre-push:17` for an 18-item gate count drift and `post-docs-consistency:40` plus
 * `explained:docs-consistency` for an explained count change).
 */
export function evaluateDeletionFacts(facts: DeletionFacts): DeletionEvaluation {
  const violations: string[] = [];
  const factsAreRecord = isRecord(facts);
  if (
    !factsAreRecord ||
    typeof facts.testCount !== 'number' ||
    !Number.isInteger(facts.testCount) ||
    facts.testCount < 0
  ) {
    violations.push('test count is invalid');
  }
  if (!factsAreRecord || !isNonEmptyString(facts.coverageProvenance)) {
    violations.push('coverage provenance is required');
  }
  if (!factsAreRecord || !Array.isArray(facts.governanceFacts) || facts.governanceFacts.length === 0) {
    violations.push('governance facts are required');
  } else if (!isStringArray(facts.governanceFacts) || facts.governanceFacts.some((entry) => entry.trim() === '')) {
    violations.push('governance facts must be non-empty strings');
  }
  if (factsAreRecord && facts.testCountDelta !== undefined && facts.testCountDelta !== -1) {
    violations.push('test count delta must explain exactly one removed test');
  }
  if (!factsAreRecord || typeof facts.testCount !== 'number' || !Array.isArray(facts.governanceFacts)) {
    return { passed: violations.length === 0, violations };
  }

  const entries = parseGovernanceFacts(facts.governanceFacts);
  const value = (key: string): string | undefined => factValues(entries, key)[0];
  const hasFact = (key: string, expectedValue: string): boolean => factValues(entries, key).includes(expectedValue);

  const postTestCount = value('post-test-count');
  if (postTestCount === undefined || Number(postTestCount) !== facts.testCount) {
    violations.push(`test count ${facts.testCount} is not explained by the recorded post-test-count fact`);
  }
  if (facts.testCountDelta === -1) {
    const preTestCount = value('pre-test-count');
    if (preTestCount === undefined || Number(preTestCount) !== facts.testCount + 1) {
      violations.push('test count delta is not explained by the recorded pre/post test count facts');
    }
  }

  const coverageFact = value('coverage-provenance');
  if (coverageFact === undefined || coverageFact !== facts.coverageProvenance) {
    violations.push('coverage provenance is not bound to the recorded coverage-provenance fact');
  }

  const prePushCount = value('pre-push');
  if (prePushCount === undefined || prePushCount.trim() !== '18') {
    violations.push(`pre-push gate count must remain 18 items (got ${String(prePushCount)})`);
  }
  const prePushOrder = value('pre-push-order');
  const postPushOrder = value('post-push-order');
  if (prePushOrder === undefined || postPushOrder === undefined || prePushOrder !== postPushOrder) {
    violations.push('pre-push gate order must be unchanged between the pre and post runs');
  }

  const selfTestDrift = value('pre-self-test') !== value('post-self-test');
  if (value('pre-self-test') === undefined || value('post-self-test') === undefined) {
    violations.push('self-test facts are incomplete (pre/post sample-to-check counts are required)');
  } else if (selfTestDrift && !hasFact('explained', 'self-test')) {
    violations.push('self-test facts drift is unexplained');
  }

  const docsDrift = value('pre-docs-consistency') !== value('post-docs-consistency');
  if (value('pre-docs-consistency') === undefined || value('post-docs-consistency') === undefined) {
    violations.push('docs-consistency facts are incomplete (pre/post live counts are required)');
  } else if (docsDrift && !hasFact('explained', 'docs-consistency')) {
    violations.push('docs-consistency facts drift is unexplained');
  }

  if (!isNonEmptyString(value('fixture-reachability'))) {
    violations.push('fixture reachability is unexplained');
  }

  for (const artifact of REHOME_ARTIFACTS) {
    if (!hasFact('rehomed', artifact)) {
      violations.push(`${artifact} rehome is not explicitly recorded`);
    }
  }
  return { passed: violations.length === 0, violations };
}

/**
 * Real removal proof (R2/R7). Removing a test is allowed only when:
 *   - the pre and post regression facts are real, the post run removed exactly one test, and both
 *     carry source-bound coverage provenance;
 *   - an independently verified equivalent survivor exists and is item-wise equal on setup,
 *     stimulus, oracle, failure sensitivity, level, and scenario class, and preserves the candidate's
 *     RTM coverage;
 *   - a protected candidate is preserved by an equally protected survivor (protection is rehomed, not
 *     dropped);
 *   - the RTM / coverage / docs-consistency / sample-matrix rehome is explicitly recorded.
 *
 * A weaker oracle, narrower RTM coverage, lower level, different scenario class, or mere similarity
 * fails. Author, age, and coverage level are never deletion criteria.
 */
export function proveTestRemoval(input: TestRemovalProofInput): string[] {
  if (!isRecord(input) || !isRecord(input.candidate)) {
    throw new CodeHealthError('ARG_INVALID', 'test removal proof requires a candidate test record');
  }
  const candidateReasons = validateTestRecord(input.candidate, 'candidate');
  if (candidateReasons.length > 0) {
    throw new CodeHealthError(
      'STRUCTURE_INVALID',
      `test removal proof requires a complete candidate test record: ${candidateReasons.join('; ')}`,
    );
  }
  const candidate = input.candidate as TestRecord;
  const protectedClass = classifyProtectedTest(candidate);
  const violations: string[] = [];
  const survivor = input.survivor;

  if (survivor === null || survivor === undefined) {
    if (protectedClass) {
      violations.push(
        `protected: the ${protectedClass} contract still needs an independently verified equivalent survivor`,
      );
    } else {
      violations.push('an independently verified equivalent survivor is required before a test can be removed');
    }
  } else {
    const survivorReasons = validateTestRecord(survivor, 'survivor');
    if (survivorReasons.length > 0) {
      throw new CodeHealthError(
        'STRUCTURE_INVALID',
        `test removal proof requires a complete survivor test record: ${survivorReasons.join('; ')}`,
      );
    }
    const survivorRecord = survivor as TestRecord;
    if (protectedClass && classifyProtectedTest(survivorRecord) !== protectedClass) {
      violations.push(`protected: the ${protectedClass} contract is not preserved by an equally protected survivor`);
    }
    const comparisons: Array<[keyof TestRecord, string]> = [
      ['setup', 'setup'],
      ['stimulus', 'stimulus'],
      ['oracle', 'oracle'],
      ['failureSensitivity', 'failureSensitivity'],
      ['level', 'level'],
      ['scenarioClass', 'scenarioClass'],
    ];
    for (const [field, label] of comparisons) {
      if (survivorRecord[field] !== candidate[field]) {
        violations.push(`${label} equivalence is not proven between the candidate and the survivor`);
      }
    }
    const missingRtmIds = candidate.rtmIds.filter((rtmId) => !survivorRecord.rtmIds.includes(rtmId));
    if (missingRtmIds.length > 0) {
      violations.push(`rtm coverage is not preserved by the survivor: ${missingRtmIds.join(', ')}`);
    }
  }

  const preFacts = isRecord(input.pre)
    ? (input.pre as unknown as { testCount?: unknown; coverageProvenance?: unknown; governanceFacts?: unknown })
    : null;
  const postFacts = isRecord(input.post)
    ? (input.post as unknown as { testCount?: unknown; coverageProvenance?: unknown; governanceFacts?: unknown })
    : null;
  const declaredFacts = [
    ...(preFacts && isStringArray(preFacts.governanceFacts) ? preFacts.governanceFacts : []),
    ...(postFacts && isStringArray(postFacts.governanceFacts) ? postFacts.governanceFacts : []),
  ];
  for (const artifact of REHOME_ARTIFACTS) {
    if (!declaredFacts.includes(`rehomed:${artifact}`)) {
      violations.push(`${artifact} rehome is not explicitly recorded in the pre/post regression facts`);
    }
  }

  const preTestCount = typeof preFacts?.testCount === 'number' ? preFacts.testCount : null;
  const postTestCount = typeof postFacts?.testCount === 'number' ? postFacts.testCount : null;
  if (preTestCount === null || !Number.isInteger(preTestCount)) {
    violations.push('pre-deletion regression test count is required');
  }
  if (postTestCount === null || !Number.isInteger(postTestCount)) {
    violations.push('post-deletion regression facts with a real test count are required');
  } else if (preTestCount !== null && postTestCount !== preTestCount - 1) {
    violations.push(`test count must decrease by exactly one: pre ${preTestCount}, post ${postTestCount}`);
  }
  if (!isNonEmptyString(preFacts?.coverageProvenance)) {
    violations.push('pre-deletion coverage provenance is required');
  }
  if (!isNonEmptyString(postFacts?.coverageProvenance)) {
    violations.push('post-deletion coverage provenance is required');
  }
  return violations;
}

/** One protected test plus its provenance-only author/age metadata. */
export interface ProtectedTestProvenance {
  testId: string;
  class: ProtectedTestClass;
  author: string;
  createdAt: string;
  lastChangedAt: string;
}

export interface TestInventoryRemovalSummary {
  candidateTestId: string;
  survivorTestId: string | null;
  candidateProtectedClass: ProtectedTestClass | null;
  equivalent: boolean;
}

export interface TestInventoryEvaluation {
  passed: boolean;
  violations: string[];
  protectedTests: ProtectedTestProvenance[];
  removal: TestInventoryRemovalSummary | null;
}

export interface TestInventoryReviewInput {
  /** A `code-health-test-inventory` document, either flat or unwrapped by the caller. */
  inventory: unknown;
  /** The ledger-recorded candidate that anchors any removal claim; required whenever a removal is proposed. */
  ledger?: unknown;
}

function regressionViolations(value: unknown, field: string): string[] {
  const reasons: string[] = [];
  if (!isRecord(value)) return [`${field} is required`];
  if (typeof value.testCount !== 'number' || !Number.isInteger(value.testCount) || value.testCount < 0) {
    reasons.push(`${field}.testCount must be a non-negative integer`);
  }
  if (!isNonEmptyString(value.coverageProvenance)) reasons.push(`${field}.coverageProvenance is required`);
  if (!isStringArray(value.governanceFacts)) reasons.push(`${field}.governanceFacts must be a string array`);
  return reasons;
}

function declaredEquivalence(proof: Record<string, unknown>): Record<string, unknown> {
  return {
    setupEquivalent: proof.setupEquivalent,
    stimulusEquivalent: proof.stimulusEquivalent,
    oracleEquivalent: proof.oracleEquivalent,
    failureSensitivityEquivalent: proof.failureSensitivityEquivalent,
    levelEquivalent: proof.levelEquivalent,
  };
}

function computedEquivalence(candidate: TestRecord, survivor: TestRecord): Record<string, boolean> {
  return {
    setupEquivalent: survivor.setup === candidate.setup,
    stimulusEquivalent: survivor.stimulus === candidate.stimulus,
    oracleEquivalent: survivor.oracle === candidate.oracle,
    failureSensitivityEquivalent: survivor.failureSensitivity === candidate.failureSensitivity,
    levelEquivalent: survivor.level === candidate.level,
  };
}

/**
 * Review a whole Phase 3 test inventory. Structural completeness and protected-fact declarations are
 * always checked; a proposed removal additionally requires the ledger-recorded candidate (approved
 * scope + declared tests), a computed survivor equivalence whose caller-declared booleans must agree
 * with the computation, a passing removal proof, and fully explained deletion facts.
 *
 * Honest limit: the ledger and inventory are inputs. A pure reviewer cannot authenticate them; the
 * ledger record, the human approval gate, and the signature chain remain the authority.
 */
export function evaluateTestInventory(input: TestInventoryReviewInput): TestInventoryEvaluation {
  const empty: TestInventoryEvaluation = { passed: false, violations: [], protectedTests: [], removal: null };
  if (!isRecord(input) || !isRecord(input.inventory)) {
    return { ...empty, violations: ['a test inventory document is required'] };
  }
  const inventory = input.inventory;
  const violations: string[] = [];
  const protectedTests: ProtectedTestProvenance[] = [];

  if (!isNonEmptyString(inventory.inventoryId)) violations.push('inventoryId is required');
  if (typeof inventory.candidateId !== 'string' || !CANDIDATE_ID_PATTERN.test(inventory.candidateId)) {
    violations.push('inventory candidateId is invalid');
  }
  const revisionReasons: string[] = [];
  if (!validateRevision(inventory.revision, 'revision', revisionReasons)) {
    violations.push(...revisionReasons);
  }

  const records = new Map<string, TestRecord>();
  if (!Array.isArray(inventory.tests) || inventory.tests.length === 0) {
    violations.push('inventory tests are required');
  } else {
    inventory.tests.forEach((entry, index) => {
      const reasons = validateTestRecord(entry, `tests[${index}]`);
      violations.push(...reasons);
      if (reasons.length === 0 && isRecord(entry) && typeof entry.testId === 'string') {
        records.set(entry.testId, entry as unknown as TestRecord);
      }
    });
  }

  const declaredProtected = new Map<string, ProtectedTestClass>();
  if (!Array.isArray(inventory.protectedFacts) || inventory.protectedFacts.length === 0) {
    violations.push('protected facts are required; no unique protected test may be silently omitted');
  } else {
    inventory.protectedFacts.forEach((entry, index) => {
      const field = `protectedFacts[${index}]`;
      if (!isRecord(entry)) {
        violations.push(`${field} must be an object`);
        return;
      }
      if (!isNonEmptyString(entry.testId) || !records.has(entry.testId)) {
        violations.push(`${field} must reference a test in the inventory`);
        return;
      }
      if (!(PROTECTED_TEST_CLASSES as readonly string[]).includes(entry.class as string)) {
        violations.push(`${field}.class is not a protected test class`);
        return;
      }
      if (!isNonEmptyString(entry.reason)) violations.push(`${field}.reason is required`);
      declaredProtected.set(entry.testId, entry.class as ProtectedTestClass);
    });
  }

  for (const [testId, record] of records) {
    let computed: ProtectedTestClass | null = null;
    try {
      computed = classifyProtectedTest(record);
    } catch (error) {
      violations.push(
        `test ${testId} could not be classified: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }
    if (computed !== null) {
      protectedTests.push({
        testId,
        class: computed,
        author: record.author,
        createdAt: record.createdAt,
        lastChangedAt: record.lastChangedAt,
      });
      const declared = declaredProtected.get(testId);
      if (declared === undefined) {
        violations.push(`protected ${computed} test ${testId} is omitted from protectedFacts`);
      } else if (declared !== computed) {
        violations.push(`protected fact ${testId} declares ${declared} but the record classifies as ${computed}`);
      }
    } else if (declaredProtected.has(testId)) {
      violations.push(`protected fact ${testId} declares a class but the record classifies as unprotected`);
    }
  }

  violations.push(...regressionViolations(inventory.preRegression, 'preRegression'));
  violations.push(...regressionViolations(inventory.postRegression, 'postRegression'));

  let removal: TestInventoryRemovalSummary | null = null;
  if (inventory.removalProof !== undefined) {
    const proof = inventory.removalProof;
    if (!isRecord(proof)) {
      violations.push('removalProof must be an object');
    } else {
      const candidateTestId = typeof proof.candidateTestId === 'string' ? proof.candidateTestId : '';
      const survivorTestId = typeof proof.survivorTestId === 'string' ? proof.survivorTestId : null;
      const candidateRecord = records.get(candidateTestId);
      const survivorRecord = survivorTestId === null ? null : records.get(survivorTestId);
      if (!candidateRecord) violations.push('removalProof must reference a candidate test in the inventory');
      if (survivorTestId !== null && !survivorRecord) {
        violations.push('removalProof must reference a survivor test in the inventory');
      }

      if (!isRecord(input.ledger)) {
        violations.push('a removal proof requires the ledger-recorded candidate as its authority (ledger is missing)');
      } else {
        const ledger = input.ledger as unknown as CodeHealthLedger;
        const ledgerCandidate = Array.isArray(ledger.candidates)
          ? ledger.candidates.find((entry) => entry.candidateId === inventory.candidateId)
          : undefined;
        if (!ledgerCandidate) {
          violations.push('ledger does not contain the inventory candidate record');
        } else {
          if (ledgerCandidate.action !== 'delete-test') {
            violations.push('ledger candidate action is not delete-test');
          }
          const scopeFiles = Array.isArray(ledgerCandidate.changeScope?.files) ? ledgerCandidate.changeScope.files : [];
          const declaredTests = Array.isArray(ledgerCandidate.tests) ? ledgerCandidate.tests : [];
          if (candidateRecord) {
            const inScope = scopeFiles.includes(candidateRecord.file) || declaredTests.includes(candidateRecord.file);
            if (!inScope) {
              violations.push('deletion candidate is not in the ledger candidate approved scope');
            }
          }
          if (
            survivorRecord &&
            (scopeFiles.includes(survivorRecord.file) || declaredTests.includes(survivorRecord.file))
          ) {
            violations.push('the declared survivor is itself inside the ledger-approved deletion scope');
          }
        }
      }

      if (candidateRecord) {
        if (survivorRecord) {
          const computed = computedEquivalence(candidateRecord, survivorRecord);
          const declared = declaredEquivalence(proof);
          for (const [key, computedValue] of Object.entries(computed)) {
            if (declared[key] !== computedValue) {
              violations.push(`declared ${key} does not match the computed survivor comparison`);
            }
          }
        }
        if (proof.rtmRehomed !== true) violations.push('removalProof must record rtmRehomed');
        if (proof.governanceRehomed !== true) violations.push('removalProof must record governanceRehomed');
        if (!isRecord(inventory.preRegression) || !isRecord(inventory.postRegression)) {
          // regression shape already reported; skip the proof derivation to avoid duplicate crashes
        } else {
          const pre = {
            testCount: inventory.preRegression.testCount as number,
            coverageProvenance: inventory.preRegression.coverageProvenance as string,
            governanceFacts: inventory.preRegression.governanceFacts as string[],
          };
          const post = {
            testCount: inventory.postRegression.testCount as number,
            coverageProvenance: inventory.postRegression.coverageProvenance as string,
            governanceFacts: inventory.postRegression.governanceFacts as string[],
          };
          violations.push(
            ...proveTestRemoval({
              candidate: candidateRecord,
              survivor: survivorRecord ?? null,
              pre,
              post,
            }),
          );
          violations.push(
            ...evaluateDeletionFacts({
              testCount: post.testCount,
              coverageProvenance: post.coverageProvenance,
              governanceFacts: post.governanceFacts,
              testCountDelta: post.testCount - pre.testCount,
            }).violations,
          );
        }
        removal = {
          candidateTestId,
          survivorTestId,
          candidateProtectedClass: (() => {
            try {
              return classifyProtectedTest(candidateRecord);
            } catch {
              return null;
            }
          })(),
          equivalent: survivorRecord !== null,
        };
      }
    }
  }

  return { passed: violations.length === 0, violations, protectedTests, removal };
}

/** Typed fail-closed error helper kept local so the module never leaks an untyped throw. */
export function testInventoryError(code: ErrorCode, reason: string): CodeHealthError {
  return new CodeHealthError(code, reason);
}
