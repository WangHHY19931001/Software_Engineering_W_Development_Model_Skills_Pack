/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- Paths are generated beneath test-owned temporary fixture directories; field names come from the frozen contract's literal key set. */
/**
 * Phase 3 tests: protected-test inventory, removal proof, and guarded deletion.
 *
 * Safety boundary: every real process spawn and every real deletion happens inside an isolated
 * temporary Git repository this test creates and removes. This repository's own tests are never
 * deleted or modified.
 *
 * Design lesson from Task 4: a determination that authorizes deletion derives its authority from the
 * tracked ledger record, the live revision, canonical file verification, and real stored evidence —
 * never from caller-declared labels. Author, age, name, indirectness, difficulty, and low coverage
 * are provenance only.
 */

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import type {
  ApprovalDecision,
  CodeHealthCandidate,
  CodeHealthLedger,
  CommandEvidence,
  EvidenceBinding,
  ProtectedTestClass,
  RevisionIdentity,
  TestRecord,
} from '../logic/code-health-contract.js';
import { classifyProtectedTest, evaluateDeletion, proveTestRemoval } from '../logic/code-health-ledger-logic.js';
import { DEFAULT_GOVERNANCE_FACTS, evaluateTestInventory } from '../logic/code-health-test-logic.js';
import { createCodeHealthCommandRunner } from '../lib/code-health-command.js';
import { scopePathRoles } from '../lib/code-health-deletion-authority.js';
import { createCodeHealthEvidenceStore } from '../lib/code-health-evidence-store.js';
import { createCodeHealthGitRevisionProvider } from '../lib/code-health-revision-provider.js';
import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '../../..');
const CLI_DIR = path.join(REPO_ROOT, 'w-model-dev/scripts/cli');
const PHASE3_SAMPLES = path.join(REPO_ROOT, 'w-model-dev/scripts/samples/code-health/phase3');
const APPLY_SAMPLES = path.join(REPO_ROOT, 'w-model-dev/scripts/samples/code-health/apply');

const revision: RevisionIdentity = {
  commitSha: 'a'.repeat(40),
  treeSha: 'b'.repeat(40),
  sourceBundleSha256: 'c'.repeat(64),
  analyzedAt: '2026-09-07T00:00:00.000Z',
};

const candidateId = 'CHG-P3-20260907-901';
const scopeHash = `sha256:${'e'.repeat(64)}`;
const GIT_ENV = {
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: 'code-health-phase3',
  GIT_AUTHOR_EMAIL: 'code-health-phase3@example.test',
  GIT_COMMITTER_NAME: 'code-health-phase3',
  GIT_COMMITTER_EMAIL: 'code-health-phase3@example.test',
  PATH: process.env.PATH,
  PATHEXT: process.env.PATHEXT,
  SYSTEMROOT: process.env.SYSTEMROOT,
  SYSTEMDRIVE: process.env.SYSTEMDRIVE,
  WINDIR: process.env.WINDIR,
  COMSPEC: process.env.COMSPEC,
  TEMP: process.env.TEMP,
  TMP: process.env.TMP,
  USERPROFILE: process.env.USERPROFILE,
} as NodeJS.ProcessEnv;

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true, maxRetries: 3 })));
});

function plainTest(overrides: Partial<TestRecord> = {}): TestRecord {
  return {
    testId: 'test-sum',
    file: 'tests/math.test.ts',
    symbol: 'addsTwoNumbers',
    author: 'human',
    createdAt: '2018-01-01T00:00:00.000Z',
    lastChangedAt: '2018-01-02T00:00:00.000Z',
    level: 'unit',
    setup: 'two integers',
    stimulus: 'add(1, 2)',
    oracle: 'returns 3',
    failureSensitivity: 'detects an incorrect sum',
    rtmIds: ['REQ-MATH-001'],
    scenarioClass: 'happy-path',
    governanceFacts: [],
    ...overrides,
  };
}

function oldHumanNegativeTest(overrides: Partial<TestRecord> = {}): TestRecord {
  return plainTest({
    testId: 'test-old-model-neg',
    file: 'tests/legacy/old-model.test.ts',
    symbol: 'rejectsMalformedInput',
    author: 'human',
    createdAt: '2015-01-01T00:00:00.000Z',
    lastChangedAt: '2015-01-02T00:00:00.000Z',
    setup: 'legacy fixture',
    stimulus: 'malformed payload',
    oracle: 'rejects the malformed payload',
    failureSensitivity: 'detects a missing validation guard',
    rtmIds: ['REQ-SEC-001'],
    scenarioClass: 'malformed-input',
    ...overrides,
  });
}

/** A security-classified pair: the surviving authorization oracle preserves the candidate's contract. */
function securityTest(overrides: Partial<TestRecord> = {}): TestRecord {
  return plainTest({
    testId: 'test-unauth-old',
    file: 'tests/legacy/auth.test.ts',
    symbol: 'rejectsUnauthorizedCaller',
    oracle: 'rejects an unauthorized caller',
    failureSensitivity: 'detects an authorization bypass',
    rtmIds: ['REQ-SEC-002'],
    scenarioClass: 'security',
    ...overrides,
  });
}

/** A neutral-text pair: the heuristic classifier cannot protect it, so default-deny must. */
function neutralTest(overrides: Partial<TestRecord> = {}): TestRecord {
  return plainTest({
    testId: 'test-dup-old',
    file: 'tests/legacy/dup.test.ts',
    symbol: 'computesTotal',
    setup: 'two integers',
    stimulus: 'total(1, 2)',
    oracle: 'returns 3',
    failureSensitivity: 'detects an incorrect total',
    rtmIds: ['REQ-MATH-001'],
    scenarioClass: 'happy-path',
    governanceFacts: ['unit'],
    ...overrides,
  });
}

const REHOME_FACTS = ['rehomed:rtm', 'rehomed:coverage', 'rehomed:docs-consistency', 'rehomed:sample-matrix'];

interface RegressionFacts {
  testCount: number;
  coverageProvenance: string;
  governanceFacts: string[];
}

function regressionFacts(testCount: number, coveragePath: string, extra: string[] = []): RegressionFacts {
  return { testCount, coverageProvenance: coveragePath, governanceFacts: [...REHOME_FACTS, ...extra] };
}

function commandEvidence(overrides: Partial<CommandEvidence> = {}): CommandEvidence {
  return {
    command: 'node suite.mjs',
    cwd: '.',
    environment: {},
    platform: process.platform,
    toolVersions: { node: process.version },
    startedAt: '2026-09-07T00:01:00.000Z',
    endedAt: '2026-09-07T00:01:02.000Z',
    exitCode: 0,
    observation: 'observed',
    rawOutputPath: '.w-model/code-health/raw/pre.log',
    rawOutputSha256: 'd'.repeat(64),
    ...overrides,
  };
}

function regression(
  testCount: number,
  coveragePath: string,
  governanceFacts: string[] = [...REHOME_FACTS],
): Record<string, unknown> {
  return {
    command: commandEvidence(),
    testCount,
    passed: true,
    coverageProvenance: coveragePath,
    governanceFacts,
  };
}

/** Canonical, contract-shape deletion facts for a removal that reduced preCount to postCount. */
function deletionFactsFor(
  preCount: number,
  postCount: number,
  coveragePath = 'coverage/post.json',
  expected: { selfTest?: number; docs?: number } = {},
): { testCount: number; coverageProvenance: string; governanceFacts: string[]; testCountDelta?: number } {
  const selfTest = expected.selfTest ?? 302;
  const docs = expected.docs ?? 41;
  return {
    testCount: postCount,
    coverageProvenance: coveragePath,
    testCountDelta: postCount - preCount,
    governanceFacts: [
      `pre-test-count:${preCount}`,
      `post-test-count:${postCount}`,
      `coverage-provenance:${coveragePath}`,
      'pre-push:18',
      'pre-push-order:sha256:aaaa',
      'post-push-order:sha256:aaaa',
      `pre-self-test:${selfTest}`,
      `post-self-test:${selfTest}`,
      `pre-docs-consistency:${docs}`,
      `post-docs-consistency:${docs}`,
      'fixture-reachability:all-referenced',
      ...REHOME_FACTS,
    ],
  };
}

function validDeletionFacts(): ReturnType<typeof deletionFactsFor> {
  return deletionFactsFor(11, 10);
}

function withGovernanceFacts(
  facts: ReturnType<typeof deletionFactsFor>,
  mutate: (entries: string[]) => string[],
): ReturnType<typeof deletionFactsFor> {
  return { ...facts, governanceFacts: mutate([...facts.governanceFacts]) };
}

function inventoryDocument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    inventoryId: 'INV-CHG-P3-20260907-901',
    candidateId,
    revision,
    tests: [oldHumanNegativeTest()],
    protectedFacts: [
      {
        testId: 'test-old-model-neg',
        class: 'unique-negative',
        reason: 'The only assertion covering malformed input rejection.',
      },
    ],
    preRegression: regression(10, 'coverage/pre.json'),
    postRegression: regression(10, 'coverage/post.json'),
    coverageProvenance: {
      path: 'coverage/coverage-final.json',
      sha256: 'f'.repeat(64),
      revision: revision.commitSha,
      measuredAt: '2026-09-07T00:03:02.000Z',
      signalOnly: true,
    },
    redaction: { status: 'clean', reasons: ['secrets removed'] },
    ...overrides,
  };
}

/** A tracked-ledger-style record whose candidate owns the proposed deletion file. */
function removalLedger(deletionFile: string, action = 'delete-test'): CodeHealthLedger {
  return {
    schemaVersion: '1.0',
    campaignId: 'CHC-20260907',
    createdAt: '2026-09-07T00:00:00.000Z',
    baseline: revision,
    environmentMatrix: [],
    candidates: [
      {
        candidateId,
        phase: 'P3',
        action,
        status: 'verified',
        files: [deletionFile],
        symbols: ['rejectsUnauthorizedCaller'],
        tests: [deletionFile],
        revision,
        changeScope: { files: [deletionFile], symbols: ['rejectsUnauthorizedCaller'], scopeHash },
      } as unknown as CodeHealthLedger['candidates'][number],
    ],
    events: [],
    appendOnly: true,
    redaction: { status: 'not_reviewed', rules: [], blockedReasons: [] },
  } as unknown as CodeHealthLedger;
}

/** Declare every test whose computed class is protected, so no protected fact is silently omitted. */
function protectedFactsFor(tests: TestRecord[], reason: string): Array<Record<string, unknown>> {
  return tests
    .map((test) => ({ test, cls: classifyProtectedTest(test) }))
    .filter((entry): entry is { test: TestRecord; cls: ProtectedTestClass } => entry.cls !== null)
    .map((entry) => ({ testId: entry.test.testId, class: entry.cls, reason }));
}

/** Build a full removal inventory over a test pair plus a retained protected test. */
function removalInventory(options: {
  candidate: TestRecord;
  survivor: TestRecord;
  protectedTest: TestRecord;
  removalFacts: ReturnType<typeof deletionFactsFor>;
  preCount: number;
  preCoverage?: string;
}): Record<string, unknown> {
  return inventoryDocument({
    tests: [options.candidate, options.survivor, options.protectedTest],
    protectedFacts: protectedFactsFor(
      [options.candidate, options.survivor, options.protectedTest],
      'Retained protected assertion, unrelated to the proposed duplicate removal.',
    ),
    removalProof: {
      candidateTestId: options.candidate.testId,
      survivorTestId: options.survivor.testId,
      reason: 'The legacy duplicate is covered by the equivalent retained assertion and its RTM row is rehomed.',
      setupEquivalent: true,
      stimulusEquivalent: true,
      oracleEquivalent: true,
      failureSensitivityEquivalent: true,
      levelEquivalent: true,
      rtmRehomed: true,
      governanceRehomed: true,
    },
    preRegression: regression(options.preCount, options.preCoverage ?? 'coverage/pre.json'),
    postRegression: regression(
      options.removalFacts.testCount,
      options.removalFacts.coverageProvenance,
      options.removalFacts.governanceFacts,
    ),
  });
}

describe('phase 3 protection classification and default-deny (R6/F-3)', () => {
  it('protects unique malformed/missing/expected-failure tests and the L1-L4 classes', () => {
    expect(classifyProtectedTest(oldHumanNegativeTest())).toBe('unique-negative');
    expect(classifyProtectedTest(plainTest())).toBeNull();
    expect(() => classifyProtectedTest({} as never)).toThrow(/requires/i);
    const cases: Array<[Partial<TestRecord>, ProtectedTestClass]> = [
      [{ scenarioClass: 'boundary', stimulus: 'empty payload' }, 'boundary'],
      [{ scenarioClass: 'security', oracle: 'rejects an unauthorized caller' }, 'security'],
      [{ scenarioClass: 'concurrency', stimulus: 'two concurrent lock acquisitions' }, 'concurrency'],
      [{ scenarioClass: 'platform', setup: 'Git Bash on Windows' }, 'platform'],
      [{ scenarioClass: 'migration', stimulus: 'rollback of the previous schema' }, 'migration-rollback'],
      [{ scenarioClass: 'governance', governanceFacts: ['pre-push: 18 ordered gate items'] }, 'pre-push'],
      [{ scenarioClass: 'governance', governanceFacts: ['self-test: sample-to-check matrix'] }, 'self-test'],
      [{ scenarioClass: 'governance', governanceFacts: ['docs-consistency: live counts'] }, 'docs-consistency'],
    ];
    for (const [overrides, expected] of cases) expect(classifyProtectedTest(plainTest(overrides))).toBe(expected);
  });

  it('author and age never change the protected class (provenance only)', () => {
    const base = oldHumanNegativeTest();
    const younger: TestRecord = {
      ...base,
      author: 'agent-artifacts-bot',
      createdAt: '2026-09-01T00:00:00.000Z',
      lastChangedAt: '2026-09-10T00:00:00.000Z',
    };
    expect(classifyProtectedTest(younger)).toBe(classifyProtectedTest(base));
  });

  it('proveTestRemoval treats a non-protected candidate as protected unless the ledger establishes it', () => {
    const candidate = neutralTest();
    const survivor = neutralTest({ testId: 'test-dup-new', file: 'tests/dup.test.ts' });
    const violations = proveTestRemoval({
      candidate,
      survivor,
      pre: regressionFacts(12, 'coverage/pre.json'),
      post: regressionFacts(11, 'coverage/post.json'),
    });
    expect(violations.join('; ')).toMatch(/non-protected status is not positively established|treated as protected/i);
  });
});

describe('phase 3 removal proof equivalence (R1/R7)', () => {
  it('author/age/human provenance cannot justify removal of a protected unique test', () => {
    const candidate = oldHumanNegativeTest();
    expect(
      proveTestRemoval({ candidate, survivor: null, pre: regressionFacts(11, 'coverage/pre.json'), post: null }).join(
        '; ',
      ),
    ).toMatch(/protected/i);
    const younger = {
      ...candidate,
      author: 'agent-artifacts-bot',
      createdAt: '2026-09-01T00:00:00.000Z',
      lastChangedAt: '2026-09-02T00:00:00.000Z',
    };
    expect(
      proveTestRemoval({
        candidate: younger,
        survivor: null,
        pre: regressionFacts(11, 'coverage/pre.json'),
        post: null,
      }).join('; '),
    ).toMatch(/protected/i);
  });

  it('accepts removal only with an equally protected, item-wise equivalent survivor, rehome facts, and -1 count', () => {
    const candidate = securityTest({ testId: 'test-unauth-old', file: 'tests/legacy/auth.test.ts' });
    const survivor = securityTest({ testId: 'test-unauth-new', file: 'tests/auth.test.ts' });
    expect(
      proveTestRemoval({
        candidate,
        survivor,
        pre: regressionFacts(12, 'coverage/pre.json'),
        post: regressionFacts(11, 'coverage/post.json'),
      }),
    ).toEqual([]);
  });

  it('a weaker oracle, narrower RTM, lower level, or changed scenario class fails', () => {
    const candidate = securityTest({ testId: 'test-unauth-old', file: 'tests/legacy/auth.test.ts' });
    const survivor = securityTest({ testId: 'test-unauth-new', file: 'tests/auth.test.ts' });
    const pre = regressionFacts(12, 'coverage/pre.json');
    const post = regressionFacts(11, 'coverage/post.json');
    const reason = (override: Partial<TestRecord>): string =>
      proveTestRemoval({ candidate, survivor: { ...survivor, ...override }, pre, post }).join('; ');
    expect(reason({ oracle: 'weaker assertion' })).toMatch(/oracle/i);
    expect(reason({ setup: 'different fixture' })).toMatch(/setup/i);
    expect(reason({ stimulus: 'add(2, 2)' })).toMatch(/stimulus/i);
    expect(reason({ failureSensitivity: 'detects nothing' })).toMatch(/failureSensitivity/i);
    expect(reason({ rtmIds: [] })).toMatch(/rtm/i);
    expect(reason({ level: 'integration' })).toMatch(/level/i);
    expect(reason({ scenarioClass: 'other' })).toMatch(/scenario/i);
  });

  it('requires explicit rehome facts and a real post-deletion test count', () => {
    const candidate = securityTest();
    const survivor = securityTest({ testId: 'test-unauth-new', file: 'tests/auth.test.ts' });
    expect(
      proveTestRemoval({
        candidate,
        survivor,
        pre: { testCount: 12, coverageProvenance: 'coverage/pre.json', governanceFacts: [] },
        post: { testCount: 11, coverageProvenance: 'coverage/post.json', governanceFacts: [] },
      }).join('; '),
    ).toMatch(/rehome/i);
    expect(
      proveTestRemoval({
        candidate,
        survivor,
        pre: regressionFacts(12, 'coverage/pre.json'),
        post: regressionFacts(12, 'coverage/post.json'),
      }).join('; '),
    ).toMatch(/test count/i);
  });

  it('malformed input fails closed', () => {
    expect(() => proveTestRemoval({} as never)).toThrow(/requires/i);
    expect(() =>
      proveTestRemoval({
        candidate: { ...securityTest(), oracle: '' },
        survivor: null,
        pre: null,
        post: null,
      } as never),
    ).toThrow(/requires|oracle/i);
  });
});

describe('phase 3 deletion facts against repo-owned expectations (R2/F-5)', () => {
  it('accepts a fully explained deletion and still rejects malformed facts', () => {
    expect(evaluateDeletion(validDeletionFacts()).passed).toBe(true);
    expect(evaluateDeletion(validDeletionFacts()).violations).toEqual([]);
    expect(evaluateDeletion({ testCount: 1, coverageProvenance: '', governanceFacts: [] }).passed).toBe(false);
  });

  it('an unexplained pre-push count/order drift blocks (18-item gate order protected)', () => {
    const countDrift = withGovernanceFacts(validDeletionFacts(), (entries) =>
      entries.map((entry) => (entry === 'pre-push:18' ? 'pre-push:17' : entry)),
    );
    expect(evaluateDeletion(countDrift).violations.join('; ')).toMatch(/pre-push/i);
    const orderDrift = withGovernanceFacts(validDeletionFacts(), (entries) =>
      entries.map((entry) => (entry === 'post-push-order:sha256:aaaa' ? 'post-push-order:sha256:bbbb' : entry)),
    );
    expect(evaluateDeletion(orderDrift).violations.join('; ')).toMatch(/pre-push/i);
  });

  it('unexplained test count, coverage provenance, self-test, and docs-consistency facts block', () => {
    const countDrift = withGovernanceFacts(validDeletionFacts(), (entries) =>
      entries.map((entry) => (entry === 'post-test-count:10' ? 'post-test-count:9' : entry)),
    );
    expect(evaluateDeletion(countDrift).violations.join('; ')).toMatch(/test count/i);
    const provenanceDrift = withGovernanceFacts(validDeletionFacts(), (entries) =>
      entries.map((entry) =>
        entry === 'coverage-provenance:coverage/post.json' ? 'coverage-provenance:elsewhere' : entry,
      ),
    );
    expect(evaluateDeletion(provenanceDrift).violations.join('; ')).toMatch(/coverage provenance/i);
    const selfTestDrift = withGovernanceFacts(validDeletionFacts(), (entries) =>
      entries.map((entry) => (entry === 'post-self-test:302' ? 'post-self-test:301' : entry)),
    );
    expect(evaluateDeletion(selfTestDrift).violations.join('; ')).toMatch(/self-test/i);
    const docsDrift = withGovernanceFacts(validDeletionFacts(), (entries) =>
      entries.map((entry) => (entry === 'post-docs-consistency:41' ? 'post-docs-consistency:40' : entry)),
    );
    expect(evaluateDeletion(docsDrift).violations.join('; ')).toMatch(/docs-consistency/i);
  });

  it('a self-consistent declaration that contradicts the repo-owned values is refused unless explained', () => {
    const expected = {
      prePushItems: 18,
      selfTestSamples: 999,
      docsConsistencyViolations: 9,
      fixtureReachability: 'all-referenced',
    };
    const contradicted = withGovernanceFacts(validDeletionFacts(), (entries) =>
      entries.map((entry) =>
        entry === 'post-docs-consistency:41'
          ? 'post-docs-consistency:9'
          : entry === 'pre-docs-consistency:41'
            ? 'pre-docs-consistency:9'
            : entry,
      ),
    );
    expect(evaluateDeletion(contradicted, expected).violations.join('; ')).toMatch(/repo-owned value 999/i);
    const explained = withGovernanceFacts(contradicted, (entries) => [...entries, 'explained:self-test']);
    expect(evaluateDeletion(explained, expected).passed).toBe(true);
  });

  it('drift is explainable only through an explicit explained:<artifact> fact and pre-push stays 18', () => {
    const explained = withGovernanceFacts(validDeletionFacts(), (entries) => [
      ...entries.map((entry) => (entry === 'post-self-test:302' ? 'post-self-test:301' : entry)),
      'explained:self-test',
    ]);
    expect(evaluateDeletion(explained).passed).toBe(true);
    expect(DEFAULT_GOVERNANCE_FACTS.prePushItems).toBe(18);
  });
});

describe('phase 3 inventory review against the tracked ledger (R4/R7)', () => {
  it('a valid protected inventory passes and reports author/age as provenance only', () => {
    const result = evaluateTestInventory({ inventory: inventoryDocument() });
    expect(result.passed).toBe(true);
    expect(result.protectedTests).toEqual([
      expect.objectContaining({ testId: 'test-old-model-neg', class: 'unique-negative', author: 'human' }),
    ]);
  });

  it('an omitted or mis-declared protected fact is rejected', () => {
    expect(
      evaluateTestInventory({ inventory: inventoryDocument({ protectedFacts: [] }) }).violations.join('; '),
    ).toMatch(/protected/i);
    const misDeclared = evaluateTestInventory({
      inventory: inventoryDocument({
        protectedFacts: [{ testId: 'test-old-model-neg', class: 'boundary', reason: 'wrong class' }],
      }),
    });
    expect(misDeclared.passed).toBe(false);
    expect(misDeclared.violations.join('; ')).toMatch(/protected|class/i);
  });

  it('rejects a regression whose recorded command is not a real observed run (F-4 shape)', () => {
    const result = evaluateTestInventory({
      inventory: inventoryDocument({
        preRegression: {
          ...regression(10, 'coverage/pre.json'),
          command: commandEvidence({ observation: 'not_run', exitCode: null }),
        },
      }),
    });
    expect(result.passed).toBe(false);
    expect(result.violations.join('; ')).toMatch(/observed run|integer exit code/i);
  });

  it('a redundancy claim requires the ledger authority, computed equivalence, and default-deny establishment', () => {
    const candidate = securityTest({ testId: 'test-unauth-old', file: 'tests/legacy/auth.test.ts' });
    const survivor = securityTest({ testId: 'test-unauth-new', file: 'tests/auth.test.ts' });
    const doc = removalInventory({
      candidate,
      survivor,
      protectedTest: oldHumanNegativeTest(),
      removalFacts: deletionFactsFor(12, 11),
      preCount: 12,
    });
    const ledger = removalLedger('tests/legacy/auth.test.ts');
    expect(evaluateTestInventory({ inventory: doc, ledger }).passed).toBe(true);
    expect(evaluateTestInventory({ inventory: doc }).violations.join('; ')).toMatch(/ledger/i);

    const forged = evaluateTestInventory({
      inventory: inventoryDocument({
        ...(doc as Record<string, unknown>),
        tests: [candidate, { ...survivor, setup: 'different fixture' }, oldHumanNegativeTest()],
      }),
      ledger,
    });
    expect(forged.passed).toBe(false);
    expect(forged.violations.join('; ')).toMatch(/setup|declared|equivalen/i);

    // A neutral-text candidate whose ledger only says delete-code is refused by default-deny.
    const neutralDoc = removalInventory({
      candidate: neutralTest(),
      survivor: neutralTest({ testId: 'test-dup-new', file: 'tests/dup.test.ts' }),
      protectedTest: oldHumanNegativeTest(),
      removalFacts: deletionFactsFor(12, 11),
      preCount: 12,
    });
    const neutralDenied = evaluateTestInventory({
      inventory: neutralDoc,
      ledger: removalLedger('tests/legacy/dup.test.ts', 'delete-code'),
    });
    expect(neutralDenied.passed).toBe(false);
    expect(neutralDenied.violations.join('; ')).toMatch(/non-protected status is not positively established/i);

    // The same pair with a ledger delete-test action is positively established and passes.
    const neutralAllowed = evaluateTestInventory({
      inventory: neutralDoc,
      ledger: removalLedger('tests/legacy/dup.test.ts', 'delete-test'),
    });
    expect(neutralAllowed.passed).toBe(true);
    expect(neutralAllowed.removal?.nonProtectedEstablished).toBe(true);
    expect(neutralAllowed.removal?.equivalenceProven).toBe(true);
  });
});

// -------------------- CLI end-to-end --------------------

interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runCli(script: string, args: string[], cwd: string = REPO_ROOT): CliResult {
  const r = runSync(process.execPath, [tsxCli, path.join(CLI_DIR, script), ...args], {
    cwd,
    timeout: 90_000,
    env: { ...process.env },
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

async function git(root: string, args: string[]): Promise<CliResult> {
  const r = runSync('git', args, { cwd: root, timeout: 30_000, env: GIT_ENV });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

async function gitStatus(root: string): Promise<string> {
  return (await git(root, ['status', '--porcelain', '--untracked-files=all'])).stdout.trim();
}

async function tempRoot(prefix: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), prefix));
  createdRoots.push(root);
  return root;
}

async function writeJson(dir: string, name: string, value: unknown): Promise<string> {
  const target = path.join(dir, name);
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return target;
}

describe('code-health-tests CLI validate (structural + authority split)', () => {
  it('valid inventory exits 0; negative fixtures exit 1; bad flags exit 2 with ERROR_JSON', () => {
    const valid = runCli('code-health-tests.ts', [
      '--inventory',
      path.join(PHASE3_SAMPLES, 'valid-inventory.json'),
      '--validate',
    ]);
    expect(valid.code).toBe(0);
    expect(valid.stdout).toMatch(/TEST_INVENTORY_JSON/);

    for (const file of [
      'bad-author-age-deletion.json',
      'bad-weaker-oracle.json',
      'bad-governance-drift.json',
      'bad-prepost-regression.json',
      'bad-missing-ledger.json',
      'bad-neutral-unprotected.json',
    ]) {
      const result = runCli('code-health-tests.ts', ['--inventory', path.join(PHASE3_SAMPLES, file), '--validate']);
      expect(result.code, `${file}: ${result.stdout}${result.stderr}`).toBe(1);
      expect(`${result.stdout}${result.stderr}`).not.toMatch(/APPLY_JSON|deletedFiles/);
    }

    // A removal inventory requires an explicit tracked authority; an embedded ledger is refused.
    const removal = runCli('code-health-tests.ts', [
      '--inventory',
      path.join(PHASE3_SAMPLES, 'valid-redundant-removal.json'),
      '--validate',
    ]);
    expect(removal.code).toBe(1);
    expect(`${removal.stdout}${removal.stderr}`).toMatch(/embedded inventory ledger|--project|--ledger/);

    expect(runCli('code-health-tests.ts', ['--inventory', 'x.json', '--force']).code).toBe(2);
    expect(runCli('code-health-tests.ts', ['--validate']).code).toBe(2);
    expect(runCli('code-health-tests.ts', ['--inventory', 'a.json', '--inventory', 'b.json']).code).toBe(2);
  }, 150_000);

  it('never writes the repository worktree', async () => {
    // Tracked-file equality is the load-insensitive invariant: sibling suites create untracked
    // transient fixtures (for example `logic/.d2-boundary-fixture-<pid>.ts`) that race a full
    // `--untracked-files=all` comparison under parallel load.
    const trackedStatus = (): string | undefined =>
      runSync('git', ['status', '--porcelain', '--untracked-files=no'], {
        cwd: REPO_ROOT,
        timeout: 30_000,
        env: GIT_ENV,
      }).stdout?.trim();
    const before = trackedStatus();
    runCli('code-health-tests.ts', ['--inventory', path.join(PHASE3_SAMPLES, 'valid-inventory.json'), '--validate']);
    expect(trackedStatus()).toBe(before);
    const untracked = runSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: REPO_ROOT,
      timeout: 30_000,
      env: GIT_ENV,
    }).stdout?.trim();
    expect(untracked ?? '').not.toContain('.w-model/code-health/apply/');
    expect(untracked ?? '').not.toContain('.patch');
  });
});

// -------------------- apply file-class guard (F-1) --------------------

interface ApplyFixture {
  description: string;
  mode: 'dry-run' | 'patch' | 'commit';
  candidate: CodeHealthCandidate;
  approval: ApprovalDecision | null;
}

async function loadApplyFixture(name: string): Promise<ApplyFixture> {
  return JSON.parse(await fs.readFile(path.join(APPLY_SAMPLES, name), 'utf8')) as ApplyFixture;
}

describe('apply guard default-denies by declared role, never by path name (FIX-A)', () => {
  async function createRepoWithTrackedPath(relativePath: string): Promise<string> {
    const root = await tempRoot('code-health-phase3-evade-');
    await git(root, ['init', '--quiet']);
    const absolute = path.join(root, ...relativePath.split('/'));
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, 'export const evasive = true;\n');
    await fs.writeFile(path.join(root, '.gitignore'), '.w-model/\n');
    await git(root, ['add', '--all']);
    await git(root, ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'initial']);
    return root;
  }

  const evasivePaths = [
    'spec/unique-negative.mjs',
    'src/a.test-helper.mjs',
    'legacy/unique-negative.mjs',
    'Spec/Unique-Negative.mjs',
  ];

  it('a renamed/relocated test-declared path cannot evade the deletion gate', async () => {
    const revisionProvider = createCodeHealthGitRevisionProvider();
    const fixture = await loadApplyFixture('valid-patch.json');
    const workDir = await tempRoot('code-health-phase3-inputs-');
    for (const evasion of evasivePaths) {
      for (const action of ['delete-code', 'abstract'] as const) {
        const root = await createRepoWithTrackedPath(evasion);
        const liveRevision = (await revisionProvider.current(root)) as RevisionIdentity;
        const candidate: CodeHealthCandidate = {
          ...structuredClone(fixture.candidate),
          candidateId,
          phase: 'P3',
          action,
          revision: liveRevision,
          files: [evasion],
          symbols: ['evasive'],
          tests: [evasion],
          changeScope: { files: [evasion], symbols: ['evasive'], scopeHash },
          evidenceBinding: { ...fixture.candidate.evidenceBinding, revision: liveRevision },
          rollback: {
            ...fixture.candidate.rollback,
            preChangeRevision: liveRevision.commitSha,
            command: `git apply -R .w-model/code-health/apply/${candidateId}.patch`,
            patchPath: `.w-model/code-health/apply/${candidateId}.patch`,
          },
        };
        const approval: ApprovalDecision = {
          ...(fixture.approval as ApprovalDecision),
          candidateId,
          approvedAction: action,
          approvedFiles: [evasion],
          approvedSymbols: ['evasive'],
          scopeHash,
          revision: liveRevision,
        };
        const candidatePath = await writeJson(workDir, `candidate-${action}.json`, candidate);
        const approvalPath = await writeJson(workDir, `approval-${action}.json`, approval);
        const before = await gitStatus(root);
        const result = runCli('code-health-apply.ts', [
          '--candidate',
          candidatePath,
          '--approval',
          approvalPath,
          '--root',
          root,
          '--mode',
          'commit',
        ]);
        expect(result.code, `${evasion} (${action}): ${result.stdout}${result.stderr}`).toBe(1);
        expect(`${result.stdout}${result.stderr}`).toMatch(
          /a test deletion requires|not in the candidate's tracked implementation scope/i,
        );
        expect(await gitStatus(root)).toBe(before);
        await expect(fs.stat(path.join(root, ...evasion.split('/')))).resolves.toBeTruthy();
      }
    }
  }, 150_000);

  it('scopePathRoles classifies by declaration, not by name', () => {
    const candidate = {
      candidateId,
      files: ['src/unused.ts'],
      tests: ['spec/unique-negative.mjs'],
      changeScope: { files: ['src/unused.ts', 'spec/unique-negative.mjs', 'legacy/other.mjs'], scopeHash },
    } as unknown as CodeHealthCandidate;
    const roles = scopePathRoles(candidate, undefined);
    expect(roles).toEqual([
      { file: 'src/unused.ts', declaredTest: false, declaredImplementation: true },
      { file: 'spec/unique-negative.mjs', declaredTest: true, declaredImplementation: false },
      { file: 'legacy/other.mjs', declaredTest: false, declaredImplementation: false },
    ]);
    // A tracked ledger can additionally declare the path as a test, regardless of its name/location.
    const ledger = removalLedger('legacy/other.mjs');
    const ledgerRoles = scopePathRoles(candidate, ledger);
    expect(ledgerRoles.find((role) => role.file === 'legacy/other.mjs')).toMatchObject({ declaredTest: true });
  });
});

// -------------------- guarded real pre/post deletion (F-2/F-4/F-7) --------------------

const SUITE_SCRIPT = [
  "import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';",
  'const files = [];',
  'const walk = (dir) => {',
  '  for (const entry of readdirSync(dir, { withFileTypes: true })) {',
  "    const full = dir + '/' + entry.name;",
  '    if (entry.isDirectory()) walk(full);',
  "    else if (entry.name.endsWith('.test.mjs')) files.push(full);",
  '  }',
  '};',
  "walk('tests');",
  'files.sort();',
  "mkdirSync('coverage', { recursive: true });",
  "writeFileSync('coverage/coverage-final.json', JSON.stringify({ covered: true }));",
  "process.stdout.write('CODE_HEALTH_SUITE ' + JSON.stringify({ testCount: files.length, identities: files }) + '\\n');",
  '',
].join('\n');
const IDENTITIES_ONLY_SCRIPT = [
  "import { readdirSync } from 'node:fs';",
  'const files = [];',
  'const walk = (dir) => {',
  '  for (const entry of readdirSync(dir, { withFileTypes: true })) {',
  "    const full = dir + '/' + entry.name;",
  '    if (entry.isDirectory()) walk(full);',
  "    else if (entry.name.endsWith('.test.mjs')) files.push(full);",
  '  }',
  '};',
  "walk('tests');",
  'files.sort();',
  "process.stdout.write('CODE_HEALTH_SUITE ' + JSON.stringify({ testCount: files.length, identities: files }) + '\\n');",
  '',
].join('\n');
const NOOP_SCRIPT = 'process.exit(0);\n';
const COVERAGE_BYTES = JSON.stringify({ covered: true });

interface GuardedProject {
  root: string;
  liveRevision: RevisionIdentity;
  candidate: CodeHealthCandidate;
  approval: ApprovalDecision;
  inventory: Record<string, unknown>;
  guardDoc: Record<string, unknown>;
  ledgerPath: string;
}

/**
 * Build an isolated project whose deletion is authorized by real stored evidence. The inventory's
 * pre/post raw outputs are produced by real runner invocations; the tracked suite manifest can be
 * pointed at a different script to probe no-op / pre-placed-coverage shapes.
 */
async function createGuardedProject(
  manifestScript: 'suite.mjs' | 'identities.mjs' | 'noop.mjs',
): Promise<GuardedProject> {
  const root = await tempRoot('code-health-phase3-guard-');
  await git(root, ['init', '--quiet']);
  await fs.mkdir(path.join(root, 'tests', 'legacy'), { recursive: true });
  await fs.writeFile(path.join(root, '.gitignore'), '.w-model/\n.code-health-raw/\ncoverage/\n');
  await fs.writeFile(path.join(root, 'suite.mjs'), SUITE_SCRIPT);
  await fs.writeFile(path.join(root, 'identities.mjs'), IDENTITIES_ONLY_SCRIPT);
  await fs.writeFile(path.join(root, 'noop.mjs'), NOOP_SCRIPT);
  await fs.writeFile(
    path.join(root, '.code-health-suite.json'),
    `${JSON.stringify({ command: [process.execPath, manifestScript] })}\n`,
  );
  await fs.writeFile(path.join(root, 'tests', 'legacy', 'old.test.mjs'), 'export const old = true;\n');
  await fs.writeFile(path.join(root, 'tests', 'legacy', 'sum.test.mjs'), 'export const sum = true;\n');
  await fs.writeFile(
    path.join(root, '.code-health-governance.json'),
    `${JSON.stringify(
      { prePushItems: 18, selfTestSamples: 2, docsConsistencyViolations: 0, fixtureReachability: 'all-referenced' },
      null,
      2,
    )}\n`,
  );

  const revisionProvider = createCodeHealthGitRevisionProvider();
  const fixture = await loadApplyFixture('valid-patch.json');
  const scopeHashLive = scopeHash;
  const candidate: CodeHealthCandidate = {
    ...structuredClone(fixture.candidate),
    candidateId,
    phase: 'P3',
    action: 'delete-code',
    status: 'under-review',
    files: ['tests/legacy/old.test.mjs'],
    symbols: ['old'],
    tests: ['tests/legacy/old.test.mjs'],
    changeScope: { files: ['tests/legacy/old.test.mjs'], symbols: ['old'], scopeHash: scopeHashLive },
    evidenceBinding: {
      ...fixture.candidate.evidenceBinding,
      candidate: {
        ...fixture.candidate.evidenceBinding.candidate,
        candidateId,
        phase: 'P3',
        action: 'delete-code',
        files: ['tests/legacy/old.test.mjs'],
        symbols: ['old'],
        scopeHash: scopeHashLive,
      },
    },
    rollback: {
      ...fixture.candidate.rollback,
      command: `git apply -R .w-model/code-health/apply/${candidateId}.patch`,
      patchPath: `.w-model/code-health/apply/${candidateId}.patch`,
    },
  };
  const ledger = removalLedger('tests/legacy/old.test.mjs');
  ledger.baseline = revision;
  await fs.writeFile(path.join(root, 'ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`);
  await git(root, ['add', '--all']);
  await git(root, ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'phase3 fixture']);
  const liveRevision = (await revisionProvider.current(root)) as RevisionIdentity;

  candidate.revision = liveRevision;
  candidate.evidenceBinding = { ...candidate.evidenceBinding, revision: liveRevision };
  candidate.rollback = { ...candidate.rollback, preChangeRevision: liveRevision.commitSha };
  ledger.candidates[0]!.revision = liveRevision;
  ledger.baseline = liveRevision;

  const evidenceStore = createCodeHealthEvidenceStore({
    repositoryRoot: root,
    rawOutputRoot: '.w-model/code-health/raw',
  });
  const runner = createCodeHealthCommandRunner({
    repositoryRoot: root,
    rawOutputDir: '.w-model/code-health/raw',
    evidenceStore,
    revisionProvider,
  });
  const binding: EvidenceBinding = {
    candidate: {
      candidateId,
      phase: 'P3',
      action: 'delete-code',
      files: candidate.changeScope.files,
      symbols: candidate.changeScope.symbols,
      scopeHash: scopeHashLive,
    },
    revision: liveRevision,
    rawOutputPath: 'tests/legacy/old.test.mjs',
    rawOutputSha256: '0'.repeat(64),
  };
  const pre = await runner.run(process.execPath, ['suite.mjs'], { cwd: root, env: {}, timeoutMs: 20_000, binding });
  await fs.rename(path.join(root, 'tests', 'legacy', 'old.test.mjs'), path.join(root, 'old.test.mjs.away'));
  const post = await runner.run(process.execPath, ['suite.mjs'], { cwd: root, env: {}, timeoutMs: 20_000, binding });
  await fs.rename(path.join(root, 'old.test.mjs.away'), path.join(root, 'tests', 'legacy', 'old.test.mjs'));
  if (pre.exitCode !== 0 || post.exitCode !== 0) throw new Error('fixture suite did not run');
  const coverageSha = createHash('sha256').update(COVERAGE_BYTES).digest('hex');

  const candidateTest = securityTest({ testId: 'test-unauth-old', file: 'tests/legacy/old.test.mjs' });
  const survivorTest = securityTest({ testId: 'test-unauth-new', file: 'tests/legacy/sum.test.mjs' });
  const protectedTest = oldHumanNegativeTest();
  const facts = deletionFactsFor(2, 1, 'coverage/coverage-final.json', { selfTest: 2, docs: 0 });

  const inventory: Record<string, unknown> = {
    inventoryId: 'INV-CHG-P3-20260907-901',
    candidateId,
    revision: liveRevision,
    tests: [candidateTest, survivorTest, protectedTest],
    protectedFacts: protectedFactsFor(
      [candidateTest, survivorTest, protectedTest],
      'Retained protected assertion, unrelated to the proposed duplicate removal.',
    ),
    removalProof: {
      candidateTestId: 'test-unauth-old',
      survivorTestId: 'test-unauth-new',
      reason: 'The legacy duplicate is covered by the equivalent retained assertion and its RTM row is rehomed.',
      setupEquivalent: true,
      stimulusEquivalent: true,
      oracleEquivalent: true,
      failureSensitivityEquivalent: true,
      levelEquivalent: true,
      rtmRehomed: true,
      governanceRehomed: true,
    },
    preRegression: {
      command: pre,
      testCount: 2,
      passed: true,
      coverageProvenance: 'coverage/coverage-final.json',
      governanceFacts: facts.governanceFacts,
    },
    postRegression: {
      command: post,
      testCount: 1,
      passed: true,
      coverageProvenance: 'coverage/coverage-final.json',
      governanceFacts: facts.governanceFacts,
    },
    coverageProvenance: {
      path: 'coverage/coverage-final.json',
      sha256: coverageSha,
      revision: liveRevision.commitSha,
      measuredAt: new Date().toISOString(),
      signalOnly: true,
    },
    redaction: { status: 'clean', reasons: ['secrets removed'] },
  };
  const approval: ApprovalDecision = {
    ...(fixture.approval as ApprovalDecision),
    candidateId,
    approvedAction: 'delete-code',
    approvedFiles: ['tests/legacy/old.test.mjs'],
    approvedSymbols: ['old'],
    scopeHash: scopeHashLive,
    revision: liveRevision,
  };
  const guardDoc = { inventory, candidate, approval, suiteManifest: '.code-health-suite.json' };
  return { root, liveRevision, candidate, approval, inventory, guardDoc, ledgerPath: path.join(root, 'ledger.json') };
}

describe('guarded real pre/post deletion (F-1/F-2/F-4/F-7)', () => {
  it('deletes the authorized test via the apply gate and proves identity-based before/after evidence', async () => {
    const project = await createGuardedProject('suite.mjs');
    const workDir = await tempRoot('code-health-phase3-guard-inputs-');
    const guardPath = await writeJson(workDir, 'guard.json', project.guardDoc);
    const result = runCli('code-health-tests.ts', [
      '--guard',
      guardPath,
      '--project',
      project.root,
      '--ledger',
      project.ledgerPath,
    ]);
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/GUARD_JSON/);
    expect(result.stdout).toMatch(/"removedIdentityPresentPre":true/);
    expect(result.stdout).toMatch(/"removedIdentityAbsentPost":true/);
    await expect(fs.stat(path.join(project.root, 'tests', 'legacy', 'old.test.mjs'))).rejects.toBeTruthy();
    await expect(fs.stat(path.join(project.root, 'tests', 'legacy', 'sum.test.mjs'))).resolves.toBeTruthy();
  }, 150_000);

  it('a no-op suite that prints no facts cannot authorize deletion', async () => {
    const project = await createGuardedProject('noop.mjs');
    const workDir = await tempRoot('code-health-phase3-guard-inputs-');
    const guardPath = await writeJson(workDir, 'guard.json', project.guardDoc);
    const result = runCli('code-health-tests.ts', [
      '--guard',
      guardPath,
      '--project',
      project.root,
      '--ledger',
      project.ledgerPath,
    ]);
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toMatch(/did not report CODE_HEALTH_SUITE facts/i);
    await expect(fs.stat(path.join(project.root, 'tests', 'legacy', 'old.test.mjs'))).resolves.toBeTruthy();
  }, 150_000);

  it('a failed final proof rolls the deletion back and leaves a clean tree (FIX-B)', async () => {
    const project = await createGuardedProject('identities.mjs');
    const coveragePath = path.join(project.root, 'coverage', 'coverage-final.json');
    await fs.writeFile(coveragePath, COVERAGE_BYTES);
    const pinned = new Date(Date.now() - 60_000);
    await fs.utimes(coveragePath, pinned, pinned);
    const workDir = await tempRoot('code-health-phase3-guard-inputs-');
    const guardPath = await writeJson(workDir, 'guard.json', project.guardDoc);
    const victim = path.join(project.root, 'tests', 'legacy', 'old.test.mjs');
    await expect(fs.stat(victim)).resolves.toBeTruthy();
    const result = runCli('code-health-tests.ts', [
      '--guard',
      guardPath,
      '--project',
      project.root,
      '--ledger',
      project.ledgerPath,
    ]);
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toMatch(/coverage artifact was not produced by the controlled run/i);
    // Two-phase: the deletion really happened, then the failed proof rolled it back.
    expect(result.stdout).toMatch(/"applied":false/);
    expect(result.stdout).toMatch(/"rolledBack":true/);
    await expect(fs.stat(victim)).resolves.toBeTruthy();
    const diff = runSync('git', ['diff', '--exit-code'], {
      cwd: project.root,
      timeout: 30_000,
      env: GIT_ENV,
    });
    expect(diff.status).toBe(0);
  }, 150_000);

  it('an embedded guard ledger is refused even before any suite runs', async () => {
    const project = await createGuardedProject('suite.mjs');
    const workDir = await tempRoot('code-health-phase3-guard-inputs-');
    const guardPath = await writeJson(workDir, 'guard.json', { ...project.guardDoc, ledger: removalLedger('x') });
    const result = runCli('code-health-tests.ts', [
      '--guard',
      guardPath,
      '--project',
      project.root,
      '--ledger',
      project.ledgerPath,
    ]);
    expect(result.code).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toMatch(/embedded guard ledger/i);
  }, 150_000);

  it('hand-filled facts with fabricated command evidence are refused by stored-evidence verification (F-4)', async () => {
    const project = await createGuardedProject('suite.mjs');
    const fabricated = structuredClone(project.inventory) as Record<string, unknown>;
    const pre = fabricated.preRegression as Record<string, unknown>;
    const command = pre.command as Record<string, unknown>;
    // Keep the shape valid but change the declared hash so it no longer matches any stored raw output.
    command.rawOutputSha256 = '0'.repeat(64);
    (fabricated.preRegression as Record<string, unknown>).testCount = 9999;
    (fabricated.postRegression as Record<string, unknown>).testCount = 9998;
    const workDir = await tempRoot('code-health-phase3-guard-inputs-');
    const inventoryPath = await writeJson(workDir, 'inventory.json', fabricated);
    const candidatePath = await writeJson(workDir, 'candidate.json', project.candidate);
    const result = runCli('code-health-tests.ts', [
      '--inventory',
      inventoryPath,
      '--validate',
      '--project',
      project.root,
      '--ledger',
      project.ledgerPath,
      '--candidate',
      candidatePath,
    ]);
    expect(result.code, `${result.stdout}${result.stderr}`).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toMatch(/raw output|evidence|hash|bound|count/i);
    await expect(fs.stat(path.join(project.root, 'tests', 'legacy', 'old.test.mjs'))).resolves.toBeTruthy();
  }, 150_000);
});
