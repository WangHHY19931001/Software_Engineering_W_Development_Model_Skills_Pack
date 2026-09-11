/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- Paths are generated beneath test-owned temporary fixture directories; field names come from the frozen contract's literal key set. */
/**
 * Phase 3 tests: protected-test inventory, removal proof, and guarded deletion.
 *
 * Safety boundary: every real process spawn and every real deletion in this file happens inside an
 * isolated temporary Git repository this test creates and removes. This repository's own tests are
 * never deleted or modified; the worktree is only ever read to prove it stayed untouched.
 *
 * Design lesson inherited from Task 4: a determination that authorizes deletion must be cross-checked
 * against the ledger-recorded test inventory and the recorded pre/post facts, never against
 * caller-declared labels alone. Author, age, name, indirectness, difficulty, and low coverage are
 * provenance only and can never justify a removal.
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
  ProtectedTestClass,
  RevisionIdentity,
  TestRecord,
} from '../logic/code-health-contract.js';
import { classifyProtectedTest, evaluateDeletion, proveTestRemoval } from '../logic/code-health-ledger-logic.js';
import { evaluateTestInventory } from '../logic/code-health-test-logic.js';
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

/** A semantically neutral test: the classifier must not protect it. */
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

/** The old, human-authored unique-negative test the plan's author/age induction fixture points at. */
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

const REHOME_FACTS = ['rehomed:rtm', 'rehomed:coverage', 'rehomed:docs-consistency', 'rehomed:sample-matrix'];

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

interface RegressionFacts {
  testCount: number;
  coverageProvenance: string;
  governanceFacts: string[];
}

function regressionFacts(testCount: number, coveragePath: string, extra: string[] = []): RegressionFacts {
  return {
    testCount,
    coverageProvenance: coveragePath,
    governanceFacts: [...REHOME_FACTS, ...extra],
  };
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
    rawOutputPath: '.ch-raw/pre.log',
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

/** The ledger record that anchors a proposed test deletion (authority, not a caller label). */
function removalLedger(deletionFile: string): CodeHealthLedger {
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
        action: 'delete-test',
        status: 'verified',
        files: [deletionFile],
        symbols: ['addsTwoNumbers'],
        tests: [deletionFile],
        revision,
        changeScope: { files: [deletionFile], symbols: ['addsTwoNumbers'], scopeHash },
      } as unknown as CodeHealthLedger['candidates'][number],
    ],
    events: [],
    appendOnly: true,
    redaction: { status: 'not_reviewed', rules: [], blockedReasons: [] },
  } as unknown as CodeHealthLedger;
}

/** A complete, passing deletion-facts record in the frozen contract's `string[]` shape. */
function deletionFactsFor(
  preCount: number,
  postCount: number,
  coveragePath = 'coverage/post.json',
): {
  testCount: number;
  coverageProvenance: string;
  governanceFacts: string[];
  testCountDelta?: number;
} {
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
      'pre-self-test:302',
      'post-self-test:302',
      'pre-docs-consistency:41',
      'post-docs-consistency:41',
      'fixture-reachability:all-referenced',
      ...REHOME_FACTS,
    ],
  };
}

function validDeletionFacts(): ReturnType<typeof deletionFactsFor> {
  return deletionFactsFor(11, 10);
}

function withGovernanceFacts(
  facts: ReturnType<typeof validDeletionFacts>,
  mutate: (entries: string[]) => string[],
): ReturnType<typeof validDeletionFacts> {
  return { ...facts, governanceFacts: mutate([...facts.governanceFacts]) };
}

describe('phase 3 protection classification (R6)', () => {
  it('protects unique malformed/missing/expected-failure tests as unique-negative', () => {
    expect(classifyProtectedTest(oldHumanNegativeTest())).toBe('unique-negative');
    expect(classifyProtectedTest(plainTest())).toBeNull();
    expect(() => classifyProtectedTest({} as never)).toThrow(/requires/i);
  });

  it('protects boundary, security, concurrency, platform, and migration/rollback classes', () => {
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
    for (const [overrides, expected] of cases) {
      expect(classifyProtectedTest(plainTest(overrides))).toBe(expected);
    }
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
});

describe('phase 3 removal proof (R1/R7)', () => {
  it('author/age/old-human provenance cannot justify removal of a protected unique test', () => {
    const candidate = oldHumanNegativeTest();
    const result = proveTestRemoval({
      candidate,
      survivor: null,
      pre: regressionFacts(11, 'coverage/pre.json'),
      post: null,
    });
    expect(result.join('; ')).toMatch(/protected/i);

    // A younger agent-authored copy of the same contract is protected identically: provenance never decides.
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

  it('accepts removal only with item-wise equivalent survivor, rehome facts, and a real -1 count', () => {
    const candidate = plainTest({ testId: 'test-sum-old', file: 'tests/legacy/sum.test.ts' });
    const survivor = plainTest({ testId: 'test-sum-new', file: 'tests/math.test.ts' });
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
    const candidate = plainTest({ testId: 'test-sum-old', file: 'tests/legacy/sum.test.ts' });
    const survivor = plainTest({ testId: 'test-sum-new', file: 'tests/math.test.ts' });
    const pre = regressionFacts(12, 'coverage/pre.json');
    const post = regressionFacts(11, 'coverage/post.json');
    const reason = (survivorOverride: Partial<TestRecord>): string =>
      proveTestRemoval({ candidate, survivor: { ...survivor, ...survivorOverride }, pre, post }).join('; ');
    expect(reason({ oracle: 'weaker assertion' })).toMatch(/oracle/i);
    expect(reason({ setup: 'different fixture' })).toMatch(/setup/i);
    expect(reason({ stimulus: 'add(2, 2)' })).toMatch(/stimulus/i);
    expect(reason({ failureSensitivity: 'detects nothing' })).toMatch(/failureSensitivity/i);
    expect(reason({ rtmIds: [] })).toMatch(/rtm/i);
    expect(reason({ level: 'integration' })).toMatch(/level/i);
    expect(reason({ scenarioClass: 'other' })).toMatch(/scenario/i);
  });

  it('requires explicit rehome facts and a real post-deletion test count', () => {
    const candidate = plainTest({ testId: 'test-sum-old', file: 'tests/legacy/sum.test.ts' });
    const survivor = plainTest({ testId: 'test-sum-new', file: 'tests/math.test.ts' });
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
    expect(
      proveTestRemoval({ candidate, survivor, pre: regressionFacts(12, 'coverage/pre.json'), post: null }).join('; '),
    ).toMatch(/post|test count/i);
  });

  it('malformed input fails closed instead of approving a removal', () => {
    expect(() => proveTestRemoval({} as never)).toThrow(/requires/i);
    expect(() =>
      proveTestRemoval({ candidate: { ...plainTest(), oracle: '' }, survivor: null, pre: null, post: null } as never),
    ).toThrow(/requires|oracle/i);
  });
});

describe('phase 3 deletion evaluation (R2/R5)', () => {
  it('accepts a fully explained deletion and still rejects malformed facts', () => {
    expect(evaluateDeletion(validDeletionFacts()).passed).toBe(true);
    expect(evaluateDeletion(validDeletionFacts()).violations).toEqual([]);
    expect(evaluateDeletion({ testCount: 1, coverageProvenance: '', governanceFacts: [] }).passed).toBe(false);
  });

  it('an unexplained pre-push count/order drift blocks (18-item gate order protected)', () => {
    const countDrift = withGovernanceFacts(validDeletionFacts(), (entries) =>
      entries.map((entry) => (entry === 'pre-push:18' ? 'pre-push:17' : entry)),
    );
    const countResult = evaluateDeletion(countDrift);
    expect(countResult.passed).toBe(false);
    expect(countResult.violations.join('; ')).toMatch(/pre-push/i);

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

  it('drift is explainable only through an explicit explained:<artifact> fact', () => {
    const explained = withGovernanceFacts(validDeletionFacts(), (entries) => [
      ...entries.map((entry) => (entry === 'post-self-test:302' ? 'post-self-test:301' : entry)),
      'explained:self-test',
    ]);
    expect(evaluateDeletion(explained).passed).toBe(true);
  });

  it('the plan snippet in contract shape still blocks (R1: object-shaped facts are not valid)', () => {
    const result = evaluateDeletion({
      ...validDeletionFacts(),
      testCountDelta: -1,
      governanceFacts: ['pre-push: 17 items'],
    });
    expect(result.passed).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([expect.stringMatching(/test count|pre-push/)]));
  });
});

describe('phase 3 inventory review against the ledger (R4/R7 design lesson)', () => {
  it('a valid protected inventory passes and reports author/age as provenance only', () => {
    const result = evaluateTestInventory({ inventory: inventoryDocument() });
    expect(result.passed).toBe(true);
    expect(result.protectedTests).toEqual([
      expect.objectContaining({ testId: 'test-old-model-neg', class: 'unique-negative', author: 'human' }),
    ]);
  });

  it('an omitted or mis-declared protected fact is rejected', () => {
    const omitted = evaluateTestInventory({
      inventory: inventoryDocument({ protectedFacts: [] }),
    });
    expect(omitted.passed).toBe(false);
    expect(omitted.violations.join('; ')).toMatch(/protected/i);

    const misDeclared = evaluateTestInventory({
      inventory: inventoryDocument({
        protectedFacts: [{ testId: 'test-old-model-neg', class: 'boundary', reason: 'wrong class' }],
      }),
    });
    expect(misDeclared.passed).toBe(false);
    expect(misDeclared.violations.join('; ')).toMatch(/protected|class/i);
  });

  it('a redundancy claim requires the ledger authority, an equivalent survivor, and explained facts', () => {
    const candidateTest = securityTest({ testId: 'test-unauth-old', file: 'tests/legacy/auth.test.ts' });
    const survivorTest = securityTest({ testId: 'test-unauth-new', file: 'tests/auth.test.ts' });
    const protectedFacts = [
      { testId: 'test-unauth-old', class: 'security', reason: 'The authorization boundary assertion.' },
      { testId: 'test-unauth-new', class: 'security', reason: 'The equivalent retained authorization assertion.' },
    ];
    const removalProof = {
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
    };
    const removalInventory = inventoryDocument({
      tests: [candidateTest, survivorTest],
      protectedFacts,
      removalProof,
      preRegression: regression(12, 'coverage/pre.json'),
      postRegression: regression(11, 'coverage/post.json', deletionFactsFor(12, 11).governanceFacts),
    });
    const ledger = removalLedger('tests/legacy/auth.test.ts');
    expect(evaluateTestInventory({ inventory: removalInventory, ledger }).passed).toBe(true);

    // Without the ledger record the redundancy claim has no authority and must fail closed.
    const noLedger = evaluateTestInventory({ inventory: removalInventory });
    expect(noLedger.passed).toBe(false);
    expect(noLedger.violations.join('; ')).toMatch(/ledger/i);

    // A caller-declared "equivalent" that is not computed equivalent is a forged declaration.
    const forged = evaluateTestInventory({
      inventory: inventoryDocument({
        tests: [candidateTest, { ...survivorTest, setup: 'different fixture' }],
        protectedFacts,
        removalProof,
        preRegression: regression(12, 'coverage/pre.json'),
        postRegression: regression(11, 'coverage/post.json', deletionFactsFor(12, 11).governanceFacts),
      }),
      ledger,
    });
    expect(forged.passed).toBe(false);
    expect(forged.violations.join('; ')).toMatch(/setup|declared|equivalen/i);

    // The same proposal for a protected unique test with no survivor is never authorized.
    const protectedProposal = evaluateTestInventory({
      inventory: inventoryDocument({
        tests: [oldHumanNegativeTest()],
        protectedFacts: [
          { testId: 'test-old-model-neg', class: 'unique-negative', reason: 'only malformed-input assertion' },
        ],
        removalProof: {
          candidateTestId: 'test-old-model-neg',
          survivorTestId: null,
          reason: 'The author is human and the test is 3000 days old so it can be removed.',
          setupEquivalent: true,
          stimulusEquivalent: true,
          oracleEquivalent: true,
          failureSensitivityEquivalent: true,
          levelEquivalent: true,
          rtmRehomed: true,
          governanceRehomed: true,
        },
      }),
      ledger: removalLedger('tests/legacy/old-model.test.ts'),
    });
    expect(protectedProposal.passed).toBe(false);
    expect(protectedProposal.violations.join('; ')).toMatch(/protected/i);
  });

  it('rejects a deletion candidate outside the ledger-approved test scope', () => {
    const candidateTest = securityTest({ testId: 'test-unauth-old', file: 'tests/legacy/auth.test.ts' });
    const survivorTest = securityTest({ testId: 'test-unauth-new', file: 'tests/auth.test.ts' });
    const result = evaluateTestInventory({
      inventory: inventoryDocument({
        tests: [candidateTest, survivorTest],
        protectedFacts: [
          { testId: 'test-unauth-old', class: 'security', reason: 'The authorization boundary assertion.' },
          { testId: 'test-unauth-new', class: 'security', reason: 'The equivalent retained authorization assertion.' },
        ],
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
        preRegression: regression(12, 'coverage/pre.json'),
        postRegression: regression(11, 'coverage/post.json', deletionFactsFor(12, 11).governanceFacts),
      }),
      ledger: removalLedger('src/somewhere-else.ts'),
    });
    expect(result.passed).toBe(false);
    expect(result.violations.join('; ')).toMatch(/ledger.*scope|approved scope/i);
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

async function git(root: string, args: string[]): Promise<CliResult> {
  const r = runSync('git', args, { cwd: root, timeout: 30_000, env: GIT_ENV });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

async function gitStatus(root: string): Promise<string> {
  return (await git(root, ['status', '--porcelain', '--untracked-files=all'])).stdout.trim();
}

describe('code-health-tests CLI (validate + guard ordering)', () => {
  it('valid inventory exits 0; unknown/missing flags exit 2 with ERROR_JSON', () => {
    const valid = runCli('code-health-tests.ts', [
      '--inventory',
      path.join(PHASE3_SAMPLES, 'valid-inventory.json'),
      '--validate',
    ]);
    expect(valid.code).toBe(0);
    expect(`${valid.stdout}${valid.stderr}`).toMatch(/TEST_INVENTORY_JSON/);

    const unknown = runCli('code-health-tests.ts', ['--inventory', 'x.json', '--force']);
    expect(unknown.code).toBe(2);
    expect(unknown.stdout).toContain('ERROR_JSON');

    const missing = runCli('code-health-tests.ts', ['--validate']);
    expect(missing.code).toBe(2);
    expect(missing.stdout).toContain('ERROR_JSON');

    const duplicate = runCli('code-health-tests.ts', ['--inventory', 'a.json', '--inventory', 'b.json']);
    expect(duplicate.code).toBe(2);
    expect(duplicate.stdout).toContain('ERROR_JSON');
  });

  it('every negative phase3 fixture exits 1 and never deletes anything', async () => {
    const before = runSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: REPO_ROOT,
      timeout: 30_000,
      env: GIT_ENV,
    }).stdout?.trim();
    for (const file of [
      'bad-author-age-deletion.json',
      'bad-weaker-oracle.json',
      'bad-governance-drift.json',
      'bad-prepost-regression.json',
      'bad-missing-ledger.json',
    ]) {
      const result = runCli('code-health-tests.ts', ['--inventory', path.join(PHASE3_SAMPLES, file), '--validate']);
      expect(result.code).toBe(1);
      expect(`${result.stdout}${result.stderr}`).not.toMatch(/APPLY_JSON|deletedFiles/);
    }
    const after = runSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: REPO_ROOT,
      timeout: 30_000,
      env: GIT_ENV,
    }).stdout?.trim();
    expect(after).toBe(before);
  });

  it('valid redundant-removal fixture exits 0 with a ledger-anchored equivalent survivor', () => {
    const result = runCli('code-health-tests.ts', [
      '--inventory',
      path.join(PHASE3_SAMPLES, 'valid-redundant-removal.json'),
      '--validate',
    ]);
    expect(result.code).toBe(0);
  });
});

// -------------------- apply gate wiring (R4: single deletion path) --------------------

interface ApplyFixture {
  description: string;
  mode: 'dry-run' | 'patch' | 'commit';
  candidate: CodeHealthCandidate;
  approval: ApprovalDecision | null;
}

async function loadApplyFixture(name: string): Promise<ApplyFixture> {
  return JSON.parse(await fs.readFile(path.join(APPLY_SAMPLES, name), 'utf8')) as ApplyFixture;
}

async function tempRoot(prefix: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), prefix));
  createdRoots.push(root);
  return root;
}

async function createTempGitRepository(): Promise<string> {
  const root = await tempRoot('code-health-phase3-repo-');
  await git(root, ['init', '--quiet']);
  await fs.mkdir(path.join(root, 'tests', 'legacy'), { recursive: true });
  await fs.writeFile(path.join(root, 'tests', 'legacy', 'sum.test.mjs'), 'export const legacy = true;\n');
  await fs.writeFile(path.join(root, '.gitignore'), '.w-model/\n');
  await git(root, ['add', '--all']);
  await git(root, ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'initial']);
  return root;
}

async function writeJson(dir: string, name: string, value: unknown): Promise<string> {
  const target = path.join(dir, name);
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return target;
}

describe('code-health-apply delete-test guard (single approval-gated deletion path)', () => {
  it('a delete-test candidate without a removal inventory is refused before any write', async () => {
    const root = await createTempGitRepository();
    const revisionProvider = createCodeHealthGitRevisionProvider();
    const fixture = await loadApplyFixture('valid-patch.json');
    const workDir = await tempRoot('code-health-phase3-inputs-');
    const liveRevision = (await revisionProvider.current(root)) as RevisionIdentity;
    const candidate: CodeHealthCandidate = {
      ...structuredClone(fixture.candidate),
      candidateId,
      action: 'delete-test',
      revision: liveRevision,
      tests: ['tests/legacy/sum.test.mjs'],
      changeScope: { files: ['tests/legacy/sum.test.mjs'], symbols: ['legacy'], scopeHash },
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
      approvedAction: 'delete-test',
      approvedFiles: ['tests/legacy/sum.test.mjs'],
      approvedSymbols: ['legacy'],
      scopeHash,
      revision: liveRevision,
    };
    const candidatePath = await writeJson(workDir, 'candidate.json', candidate);
    const approvalPath = await writeJson(workDir, 'approval.json', approval);
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
    expect(result.code).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toMatch(/inventory|removal/i);
    expect(await gitStatus(root)).toBe(before);
    await expect(fs.stat(path.join(root, 'tests', 'legacy', 'sum.test.mjs'))).resolves.toBeTruthy();
  });
});

describe('guarded real pre/post deletion (R4/R5)', () => {
  it('runs the real suites, deletes only through the apply gate, and reads facts back from the run', async () => {
    const root = await createTempGitRepository();
    const deletionFile = 'tests/legacy/old.test.mjs';
    const coverageBytes = '{"covered":true}';
    const coverageSha256 = createHash('sha256').update(coverageBytes).digest('hex');
    const suiteSource = [
      "import { existsSync, mkdirSync, writeFileSync } from 'node:fs';",
      `const exists = existsSync(${JSON.stringify(deletionFile)});`,
      "mkdirSync('coverage', { recursive: true });",
      `writeFileSync('coverage/coverage-final.json', ${JSON.stringify(coverageBytes)});`,
      "process.stdout.write('CODE_HEALTH_SUITE ' + JSON.stringify({ testCount: exists ? 2 : 1, governanceFacts: [] }) + '\\n');",
      '',
    ].join('\n');
    await fs.writeFile(path.join(root, 'suite.mjs'), suiteSource);
    await fs.writeFile(path.join(root, deletionFile), 'export const old = true;\n');
    await git(root, ['add', '--all']);
    await git(root, ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'phase3 fixture']);
    const revisionProvider = createCodeHealthGitRevisionProvider();
    const liveRevision = (await revisionProvider.current(root)) as RevisionIdentity;

    const fixture = await loadApplyFixture('valid-patch.json');
    const candidate: CodeHealthCandidate = {
      ...structuredClone(fixture.candidate),
      candidateId,
      phase: 'P3',
      action: 'delete-test',
      status: 'under-review',
      files: [deletionFile],
      symbols: ['rejectsUnauthorizedCaller'],
      tests: [deletionFile],
      revision: liveRevision,
      changeScope: { files: [deletionFile], symbols: ['rejectsUnauthorizedCaller'], scopeHash },
      evidenceBinding: {
        ...fixture.candidate.evidenceBinding,
        candidate: {
          ...fixture.candidate.evidenceBinding.candidate,
          candidateId,
          phase: 'P3',
          action: 'delete-test',
          files: [deletionFile],
          symbols: ['rejectsUnauthorizedCaller'],
          scopeHash,
        },
        revision: liveRevision,
      },
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
      approvedAction: 'delete-test',
      approvedFiles: [deletionFile],
      approvedSymbols: ['rejectsUnauthorizedCaller'],
      scopeHash,
      revision: liveRevision,
    };
    const candidateTest = securityTest({ testId: 'test-unauth-old', file: deletionFile });
    const survivorTest = securityTest({ testId: 'test-unauth-new', file: 'tests/legacy/sum.test.mjs' });
    const inventory = {
      inventoryId: 'INV-CHG-P3-20260907-901',
      candidateId,
      revision: liveRevision,
      tests: [candidateTest, survivorTest],
      protectedFacts: [
        { testId: 'test-unauth-old', class: 'security', reason: 'The authorization boundary assertion being removed.' },
        { testId: 'test-unauth-new', class: 'security', reason: 'The retained equivalent authorization oracle.' },
      ],
      removalProof: {
        candidateTestId: 'test-unauth-old',
        survivorTestId: 'test-unauth-new',
        reason: 'The legacy duplicate is covered by the retained equivalent assertion and its RTM row is rehomed.',
        setupEquivalent: true,
        stimulusEquivalent: true,
        oracleEquivalent: true,
        failureSensitivityEquivalent: true,
        levelEquivalent: true,
        rtmRehomed: true,
        governanceRehomed: true,
      },
      preRegression: regression(2, 'coverage/coverage-final.json'),
      postRegression: regression(
        1,
        'coverage/coverage-final.json',
        deletionFactsFor(2, 1, 'coverage/coverage-final.json').governanceFacts,
      ),
      coverageProvenance: {
        path: 'coverage/coverage-final.json',
        sha256: coverageSha256,
        revision: liveRevision.commitSha,
        measuredAt: '2026-09-07T00:03:02.000Z',
        signalOnly: true,
      },
      redaction: { status: 'clean', reasons: ['secrets removed'] },
    };
    const ledger = removalLedger(deletionFile);
    const workDir = await tempRoot('code-health-phase3-guard-');
    const guardPath = await writeJson(workDir, 'guard.json', {
      projectRoot: root,
      inventory,
      ledger,
      candidate,
      approval,
      preCommand: [process.execPath, 'suite.mjs'],
      postCommand: [process.execPath, 'suite.mjs'],
      rawOutputDir: '.ch-raw',
      timeoutMs: 20_000,
    });
    const result = runCli('code-health-tests.ts', ['--guard', guardPath]);
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/GUARD_JSON/);
    // The exact approved test was really deleted in the isolated project, and nothing else.
    await expect(fs.stat(path.join(root, deletionFile))).rejects.toBeTruthy();
    await expect(fs.stat(path.join(root, 'tests', 'legacy', 'sum.test.mjs'))).resolves.toBeTruthy();
  });
});
