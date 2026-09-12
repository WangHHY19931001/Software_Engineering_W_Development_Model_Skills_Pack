/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection, security/detect-non-literal-regexp -- Paths are generated beneath a test-owned temporary fixture repository; field names come from a fixed literal list. */
/**
 * Phase 2 tests: seven-dimension gap matrix (pure) and a real TDD RED/GREEN harness.
 *
 * The harness tests spawn real processes inside an isolated temporary Git fixture, so they never run
 * this repository's own test suite (which would recurse). RED/GREEN are proven with real exit codes, and
 * a RED that failed for an unrelated reason (command not found, module missing, weakened assertion) is
 * rejected instead of being counted as RED.
 */

import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import type {
  CodeHealthCandidate,
  CodeHealthLedger,
  CommandEvidence,
  EvidenceBinding,
  GapDiscoveryInput,
  GapRow,
  RevisionIdentity,
  TddHarnessInput,
} from '../logic/code-health-contract.js';
import { findGaps, missingGapDimensions } from '../logic/code-health-gap-logic.js';
import { validateGapMatrix, validateRedGreenEvidence } from '../logic/code-health-ledger-logic.js';
import { createCodeHealthEvidenceStore } from '../lib/code-health-evidence-store.js';
import { createCodeHealthGitRevisionProvider } from '../lib/code-health-revision-provider.js';
import { runTddHarness, type TddHarnessOptions } from '../lib/code-health-tdd-harness.js';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const phase2Samples = path.join(repoRoot, 'w-model-dev', 'scripts', 'samples', 'code-health', 'phase2');
const revisionProvider = createCodeHealthGitRevisionProvider();
const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
const gapCli = path.join(repoRoot, 'w-model-dev', 'scripts', 'cli', 'code-health-gap.ts');

/** End-to-end CLI probe: the real CLI process, real exit code, real streams. */
async function runGapCli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [tsxCli, gapCli, ...args], {
      cwd: repoRoot,
      windowsHide: true,
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failure = error as { code?: number | string; stdout?: string; stderr?: string };
    return {
      code: typeof failure.code === 'number' ? failure.code : 1,
      stdout: String(failure.stdout ?? ''),
      stderr: String(failure.stderr ?? ''),
    };
  }
}

const revision: RevisionIdentity = {
  commitSha: 'a'.repeat(40),
  treeSha: 'b'.repeat(40),
  sourceBundleSha256: 'c'.repeat(64),
  analyzedAt: '2026-09-07T00:00:00.000Z',
};

const candidateId = 'CHG-P2-20260907-901';
const scopeHash = `sha256:${'e'.repeat(64)}`;

const validLedger: CodeHealthLedger = {
  schemaVersion: '1.0',
  campaignId: 'CHC-20260907',
  createdAt: '2026-09-07T00:00:00.000Z',
  baseline: revision,
  environmentMatrix: [],
  candidates: [
    {
      candidateId,
      phase: 'P2',
      action: 'add-test',
      status: 'discovered',
      revision,
    } as unknown as CodeHealthLedger['candidates'][number],
  ],
  events: [],
  appendOnly: true,
  redaction: { status: 'not_reviewed', rules: [], blockedReasons: [] },
};

/** A ledger whose candidate record carries the authoritative implementation scope and declared tests. */
function redGreenLedger(scopeFiles: string[] = ['src/token.mjs'], tests: string[] = ['probe.mjs']): CodeHealthLedger {
  return {
    schemaVersion: '1.0',
    campaignId: 'CHC-20260907',
    createdAt: '2026-09-07T00:00:00.000Z',
    baseline: revision,
    environmentMatrix: [],
    candidates: [
      {
        candidateId,
        phase: 'P2',
        action: 'add-test',
        status: 'verified',
        files: ['src/token.mjs'],
        symbols: ['isValidToken'],
        tests,
        revision,
        changeScope: { files: scopeFiles, symbols: ['isValidToken'], scopeHash },
      } as unknown as CodeHealthLedger['candidates'][number],
    ],
    events: [],
    appendOnly: true,
    redaction: { status: 'not_reviewed', rules: [], blockedReasons: [] },
  };
}

function validGap(overrides: Partial<GapRow> = {}): GapRow {
  return {
    gapId: 'GAP-CHG-P2-20260907-901-security',
    candidateId,
    kind: 'security',
    testLevels: ['integration'],
    existingTestIds: [],
    missingScenario: 'the forged-token rejection path must be exercised by an executable assertion',
    evidenceSources: ['evidence/phase2-gaps.json'],
    risk: {
      severity: 'critical',
      behavior: 'high',
      security: 'high',
      concurrency: 'none',
      platform: 'low',
      lifecycle: 'low',
      governance: 'high',
      rationale: 'An untested signature check is an authorization boundary without proof.',
    },
    priority: 'critical',
    owner: 'S-security',
    rtmIds: ['REQ-SEC-001'],
    coverageSignal: { statements: 0.9, branches: 0.5, functions: 0.8, lines: 0.9 },
    coverageIsSignalOnly: true,
    status: 'discovered',
    ...overrides,
  };
}

/** Two-dimension discovery input used for pure negative cases; entries carry a full row shape. */
function discoveryWith(overrides: Record<string, unknown> = {}): GapDiscoveryInput {
  const entry = (kind: string): Record<string, unknown> => ({
    gapId: `GAP-${candidateId}-${kind}`,
    candidateId,
    testLevels: ['unit'],
    existingTestIds: [],
    missingScenario: `${kind} scenario is not covered by an executable assertion`,
    evidenceSources: ['evidence/phase2-gaps.json'],
    risk: validGap().risk,
    priority: 'high',
    owner: 'S-agent',
    rtmIds: ['REQ-001'],
    coverageSignal: { statements: 0.9, branches: 0.5, functions: 0.8, lines: 0.9 },
  });
  return {
    requirements: [entry('requirement')],
    publicContracts: [entry('public-contract')],
    branches: [entry('branch')],
    errors: [entry('error')],
    securityProperties: [entry('security')],
    concurrencyProperties: [entry('concurrency')],
    platforms: [entry('platform')],
    coverageSignal: { lines: 0.9 },
    ...overrides,
  } as GapDiscoveryInput;
}

async function readFixture(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(path.join(phase2Samples, file), 'utf8')) as Record<string, unknown>;
}

describe('phase 2 gap matrix (pure)', () => {
  it('发现全部七维度并生成通过 validateGapMatrix 的 matrix，coverageAuthorization 恒为 false', async () => {
    const fixture = await readFixture('valid-gap.json');
    const matrix = findGaps(fixture.discovery as GapDiscoveryInput);
    expect(matrix.coverageAuthorization).toBe(false);
    expect(new Set(matrix.rows.map((row) => row.kind))).toEqual(
      new Set(['requirement', 'public-contract', 'branch', 'error', 'security', 'concurrency', 'platform']),
    );
    expect(validateGapMatrix({ rows: matrix.rows }, fixture.ledger as CodeHealthLedger)).toEqual([]);
  });

  it('每一行都带维度/test level/existing IDs/missing scenario/risk/priority/owner/RTM，缺字段被 validateGapMatrix 拦截', () => {
    const matrix = findGaps(discoveryWith());
    expect(validateGapMatrix({ rows: matrix.rows }, validLedger)).toEqual([]);
    const row = matrix.rows[0]!;
    for (const field of ['testLevels', 'existingTestIds', 'missingScenario', 'risk', 'priority', 'owner', 'rtmIds']) {
      const incomplete: Record<string, unknown> = { ...row };
      delete incomplete[field];
      const reasons = validateGapMatrix({ rows: [incomplete] }, validLedger);
      expect(reasons.join('; ')).toMatch(new RegExp(field, 'i'));
    }
  });

  it('coverage=100 不能替代任何一维：缺维度时 findGaps 仍 fail-closed', () => {
    const full = discoveryWith();
    expect(missingGapDimensions(full)).toEqual([]);
    const withoutSecurity = discoveryWith({ securityProperties: undefined, coverageSignal: { lines: 1 } });
    expect(missingGapDimensions(withoutSecurity)).toEqual(['security']);
    expect(() => findGaps(withoutSecurity)).toThrow(/security/i);
    expect(() => findGaps(withoutSecurity)).toThrow(/coverage is signal-only/i);
    expect(() => findGaps({} as GapDiscoveryInput)).toThrow(/seven dimensions/i);
  });

  it('拒绝非数组维度与缺 candidateId 的条目的 fail-closed 输入', () => {
    expect(() => findGaps(discoveryWith({ platforms: 'windows' }))).toThrow(/platform/i);
    expect(() => findGaps(discoveryWith({ errors: [{ missingScenario: 'no identity' }] }))).toThrow(/candidateId/i);
  });

  it('negative fixtures：缺维度、coverage-only、RED 未失败、GREEN 削弱断言都被拒绝', async () => {
    for (const file of ['missing-security.json', 'missing-platform.json', 'coverage-only.json']) {
      const fixture = await readFixture(file);
      expect(() => findGaps(fixture.discovery as GapDiscoveryInput)).toThrow(/missing|seven/i);
    }
    const redNotFail = await readFixture('red-not-fail.json');
    const redReasons = validateGapMatrix({ rows: redNotFail.rows }, redNotFail.ledger as CodeHealthLedger);
    expect(redReasons.join('; ')).toMatch(/redEvidence/i);

    const weakened = await readFixture('green-weakening.json');
    const weakenedReasons = validateRedGreenEvidence(
      weakened.gap as GapRow,
      weakened.results as CommandEvidence[],
      weakened.ledger as CodeHealthLedger,
    );
    expect(weakenedReasons.join('; ')).toMatch(/same assertion|assertionHash|weakened/i);

    const infrastructure = await readFixture('infrastructure-red.json');
    expect(
      validateRedGreenEvidence(
        infrastructure.gap as GapRow,
        infrastructure.results as CommandEvidence[],
        infrastructure.ledger as CodeHealthLedger,
      ).join('; '),
    ).toMatch(/unrelated|infrastructure/i);

    const unknownCommand = await readFixture('unknown-command.json');
    expect(
      validateRedGreenEvidence(
        unknownCommand.gap as GapRow,
        unknownCommand.results as CommandEvidence[],
        unknownCommand.ledger as CodeHealthLedger,
      ).join('; '),
    ).toMatch(/RED evidence required/i);
  });

  it('G-1/G-2: 伪造 scope/声明的矩阵行与 red-green 文档与 ledger 记录不一致被拒绝', async () => {
    const matrix = await readFixture('forged-scope-declaration.json');
    const matrixReasons = validateGapMatrix({ rows: matrix.rows }, matrix.ledger as CodeHealthLedger).join('; ');
    expect(matrixReasons).toMatch(/ledger candidate approved scope/i);
    expect(matrixReasons).toMatch(/ledger-declared candidate test/i);

    const redGreen = await readFixture('forged-scope-redgreen.json');
    const redGreenReasons = validateRedGreenEvidence(
      redGreen.gap as GapRow,
      redGreen.results as CommandEvidence[],
      redGreen.ledger as CodeHealthLedger,
    ).join('; ');
    expect(redGreenReasons).toMatch(/ledger candidate approved scope/i);
    expect(redGreenReasons).toMatch(/ledger-declared candidate test/i);
  });

  it('F-1: 手工非零 RED 缺分类 / 分类非 assertion / 未绑定 gap 均被拒绝', async () => {
    const fixture = await readFixture('red-unclassified.json');
    const ledger = fixture.ledger as CodeHealthLedger;
    const redUnclassified = validateGapMatrix({ rows: fixture.rows }, ledger).join('; ');
    expect(redUnclassified).toMatch(/redEvidence/i);
    expect(redUnclassified).toMatch(/classification|assertion/i);

    const baseRow = structuredClone((fixture.rows as GapRow[])[0]!);
    for (const failureClass of ['infrastructure', 'unavailable'] as const) {
      const row = structuredClone(baseRow);
      row.redEvidence = {
        ...row.redEvidence!,
        toolVersions: { ...row.redEvidence!.toolVersions, codeHealthTddFailureClass: failureClass },
      };
      expect(validateGapMatrix({ rows: [row] }, ledger).join('; ')).toMatch(
        new RegExp(`classification|${failureClass}`, 'i'),
      );
    }

    // Two hand-authored results that carry no harness gap binding cannot stand in for a real pair.
    const unbound: CommandEvidence[] = [
      {
        command: 'node probe.mjs',
        cwd: '.',
        environment: {},
        platform: process.platform,
        toolVersions: { node: process.version },
        startedAt: '2026-09-07T00:01:00.000Z',
        endedAt: '2026-09-07T00:01:01.000Z',
        exitCode: 1,
        observation: 'observed',
        rawOutputPath: '.w-model/code-health/tdd/red.log',
        rawOutputSha256: '1'.repeat(64),
      },
      {
        command: 'node probe.mjs',
        cwd: '.',
        environment: {},
        platform: process.platform,
        toolVersions: { node: process.version },
        startedAt: '2026-09-07T00:02:00.000Z',
        endedAt: '2026-09-07T00:02:01.000Z',
        exitCode: 0,
        observation: 'observed',
        rawOutputPath: '.w-model/code-health/tdd/green.log',
        rawOutputSha256: '2'.repeat(64),
      },
    ];
    const unboundReasons = validateRedGreenEvidence(
      { ...validGap(), assertionHash: 'a'.repeat(64) },
      unbound,
      redGreenLedger(),
    ).join('; ');
    expect(unboundReasons).toMatch(/not bound to gap/i);
    expect(unboundReasons).toMatch(/classification|assertion/i);

    // The genuine harness-bound pair still passes with the mandatory classification and declarations.
    const boundRed: CommandEvidence = {
      ...unbound[0]!,
      gapId: validGap().gapId,
      assertionHash: 'a'.repeat(64),
      implementationHash: null,
      testArtifacts: ['probe.mjs'],
      implementationArtifact: 'src/token.mjs',
      toolVersions: { ...unbound[0]!.toolVersions, codeHealthTddFailureClass: 'assertion' },
    } as CommandEvidence;
    const boundGreen: CommandEvidence = {
      ...unbound[1]!,
      gapId: validGap().gapId,
      assertionHash: 'a'.repeat(64),
      implementationHash: 'c'.repeat(64),
      testArtifacts: ['probe.mjs'],
      implementationArtifact: 'src/token.mjs',
      toolVersions: { ...unbound[1]!.toolVersions, codeHealthTddFailureClass: 'none' },
    } as CommandEvidence;
    expect(
      validateRedGreenEvidence(
        { ...validGap(), assertionHash: 'a'.repeat(64) },
        [boundRed, boundGreen],
        redGreenLedger(),
      ),
    ).toEqual([]);
  });

  it('R-G: 矩阵行 red/green 证据必须成对且绑定到该行 gapId（alt9）', async () => {
    const fixture = await readFixture('redgreen-binding-mismatch.json');
    const reasons = validateGapMatrix({ rows: fixture.rows }, fixture.ledger as CodeHealthLedger).join('; ');
    expect(reasons).toMatch(/redEvidence must be bound to gap/i);

    // A row with only one side of the pair is rejected too.
    const row = structuredClone((fixture.rows as GapRow[])[0]!);
    delete row.greenEvidence;
    expect(validateGapMatrix({ rows: [row] }, fixture.ledger as CodeHealthLedger).join('; ')).toMatch(
      /present as a pair/i,
    );
  });
});

// -------------------- real TDD RED/GREEN harness --------------------

const createdRoots: string[] = [];

/**
 * Canonical Git environment shared with the Task 1 evidence tests: no system/user Git config, no prompt,
 * so the fixture revision is computed over the real committed tree on any platform.
 */
const GIT_ENV = {
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: 'code-health-phase2',
  GIT_AUTHOR_EMAIL: 'code-health-phase2@example.test',
  GIT_COMMITTER_NAME: 'code-health-phase2',
  GIT_COMMITTER_EMAIL: 'code-health-phase2@example.test',
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

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: root, env: GIT_ENV, shell: false, windowsHide: true });
  return stdout;
}

/** A real, isolated Git fixture: broken implementation plus one executable assertion. */
const BROKEN_TOKEN =
  'export function isValidToken(token) {\n  return typeof token === "string" && token.length > 0;\n}\n';
const FIXED_TOKEN = 'export function isValidToken(token) {\n  return token === "valid-token.signature";\n}\n';
const IMPLEMENTATION_ARTIFACT = 'src/token.mjs';
const PROBE = [
  "import assert from 'node:assert/strict';",
  "import { isValidToken } from './src/token.mjs';",
  '',
  "assert.equal(isValidToken('forged-token'), false, 'gap: forged token must be rejected');",
  "assert.equal(isValidToken('valid-token.signature'), true, 'gap: valid token must be accepted');",
  "process.stdout.write('probe passed\\n');",
  '',
].join('\n');
/** An assertion that lives in an imported (non-argv) module: the argv entry only imports it. */
const RUNNER = "import './assertion.mjs';\n";
const IMPORTED_ASSERTION = [
  "import assert from 'node:assert/strict';",
  "import { isValidToken } from './src/token.mjs';",
  '',
  "assert.equal(isValidToken('forged-token'), false, 'gap: imported assertion must reject a forged token');",
  "process.stdout.write('imported assertion passed\\n');",
  '',
].join('\n');
/** Non-literal dynamic import: the static closure cannot see `./assertion.mjs`. */
const NON_LITERAL_RUNNER = "const specifier = '.' + '/assertion.mjs';\nawait import(specifier);\n";
const WEAKENED_ASSERTION = 'process.exit(0);\n';
/** A probe that fails for an unrelated infrastructure reason (module missing), not a gap assertion. */
const MISSING_MODULE_PROBE = "import 'module-that-does-not-exist-for-code-health-gap-xyz';\n";

interface HarnessFixture {
  root: string;
  revision: RevisionIdentity;
  options: TddHarnessOptions;
}

function harnessCandidate(
  files: string[] = [IMPLEMENTATION_ARTIFACT],
  tests: string[] = ['probe.mjs'],
): CodeHealthCandidate {
  return {
    candidateId,
    tests,
    changeScope: { files, symbols: ['isValidToken'], scopeHash },
  } as unknown as CodeHealthCandidate;
}

interface HarnessInputOverrides {
  testCommand?: string[];
  testArtifacts?: string[];
  implementation?: string | null;
  candidate?: CodeHealthCandidate;
}

function harnessInput(overrides: HarnessInputOverrides = {}): TddHarnessInput {
  return {
    gap: validGap(),
    candidate: overrides.candidate ?? harnessCandidate(),
    testArtifacts: overrides.testArtifacts ?? ['probe.mjs'],
    testCommand: overrides.testCommand ?? [process.execPath, 'probe.mjs'],
    implementation: overrides.implementation === undefined ? IMPLEMENTATION_ARTIFACT : overrides.implementation,
  };
}

async function createHarnessFixture(): Promise<HarnessFixture> {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'code-health-phase2-'));
  createdRoots.push(root);
  await git(root, ['init', '--quiet']);
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'token.mjs'), BROKEN_TOKEN);
  await fs.writeFile(path.join(root, 'probe.mjs'), PROBE);
  await git(root, ['add', '--all']);
  await git(root, ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'initial fixture']);
  const fixtureRevision = await revisionProvider.current(root);
  if (!fixtureRevision) throw new Error('fixture revision is unavailable');
  const evidenceStore = createCodeHealthEvidenceStore({ repositoryRoot: root, rawOutputRoot: '.code-health-raw' });
  const binding: EvidenceBinding = {
    candidate: {
      candidateId,
      phase: 'P2',
      action: 'add-test',
      files: ['probe.mjs'],
      symbols: ['probe'],
      scopeHash,
    },
    revision: fixtureRevision,
    rawOutputPath: '.code-health-raw/pending.log',
    rawOutputSha256: '0'.repeat(64),
  };
  return {
    root,
    revision: fixtureRevision,
    options: {
      repositoryRoot: root,
      rawOutputDir: '.code-health-raw',
      evidenceStore,
      revisionProvider,
      binding,
      env: {},
      timeoutMs: 20_000,
    },
  };
}

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true, maxRetries: 3 })));
});

describe('phase 2 TDD RED/GREEN harness (real processes, real exit codes)', () => {
  it('RED 是真实断言失败，GREEN 在同一断言上真实 exit 0，且实现 hash 变化', async () => {
    const fixture = await createHarnessFixture();
    const red = await runTddHarness(harnessInput(), fixture.options);
    expect(red.exitCode).toBe(1);
    expect(red.observation).toBe('observed');
    expect(red.toolVersions.codeHealthTddFailureClass).toBe('assertion');
    expect(red.implementationHash).toMatch(/^[0-9a-f]{64}$/);

    await fs.writeFile(path.join(fixture.root, 'src', 'token.mjs'), FIXED_TOKEN);
    const green = await runTddHarness(harnessInput(), fixture.options);
    expect(green.exitCode).toBe(0);
    expect(green.observation).toBe('observed');
    expect(green.toolVersions.codeHealthTddFailureClass).toBe('none');
    expect(green.implementationHash).toMatch(/^[0-9a-f]{64}$/);
    expect(green.implementationHash).not.toBe(red.implementationHash);

    // Same exact declaration/assertion, distinct real runs, and the pair passes the strengthened validator.
    expect(green.assertionHash).toBe(red.assertionHash);
    expect(green.testArtifacts).toEqual(['probe.mjs']);
    expect(green.implementationArtifact).toBe(IMPLEMENTATION_ARTIFACT);
    expect(green.rawOutputSha256).not.toBe(red.rawOutputSha256);
    expect(
      validateRedGreenEvidence({ ...validGap(), assertionHash: red.assertionHash }, [red, green], redGreenLedger()),
    ).toEqual([]);

    // The fixture repository HEAD is untouched: the harness only wrote raw outputs beneath its root.
    expect((await git(fixture.root, ['rev-parse', 'HEAD'])).trim()).toBe(fixture.revision.commitSha);
    expect(await fs.readdir(path.join(fixture.root, '.code-health-raw'))).toEqual(
      expect.arrayContaining([expect.any(String)]),
    );
  });

  it('拒绝因无关基础设施原因失败的 RED（模块缺失），不计为 RED', async () => {
    const fixture = await createHarnessFixture();
    await fs.writeFile(path.join(fixture.root, 'missing.mjs'), MISSING_MODULE_PROBE);
    const artifacts = ['probe.mjs', 'missing.mjs'];
    const candidate = harnessCandidate([IMPLEMENTATION_ARTIFACT], artifacts);
    const unrelatedRed = await runTddHarness(
      harnessInput({ testCommand: [process.execPath, 'missing.mjs'], testArtifacts: artifacts, candidate }),
      fixture.options,
    );
    expect(unrelatedRed.exitCode).toBe(1);
    expect(unrelatedRed.observation).toBe('observed');
    expect(unrelatedRed.toolVersions.codeHealthTddFailureClass).toBe('infrastructure');
    await fs.writeFile(path.join(fixture.root, 'src', 'token.mjs'), FIXED_TOKEN);
    const green = await runTddHarness(harnessInput({ testArtifacts: artifacts, candidate }), fixture.options);
    expect(green.exitCode).toBe(0);
    const unrelatedReasons = validateRedGreenEvidence(
      { ...validGap(), assertionHash: green.assertionHash },
      [unrelatedRed, green],
      redGreenLedger([IMPLEMENTATION_ARTIFACT], artifacts),
    );
    expect(unrelatedReasons.join('; ')).toMatch(/unrelated reason|infrastructure/i);
  });

  it('拒绝通过削弱断言获得的 GREEN：assertionHash 改变后 RED/GREEN 不再成对', async () => {
    const fixture = await createHarnessFixture();
    const red = await runTddHarness(harnessInput(), fixture.options);
    expect(red.exitCode).toBe(1);
    expect(red.toolVersions.codeHealthTddFailureClass).toBe('assertion');

    // Weaken the assertion to an unconditional success instead of fixing the implementation.
    await fs.writeFile(path.join(fixture.root, 'probe.mjs'), 'process.exit(0);\n');
    const weakenedGreen = await runTddHarness(harnessInput(), fixture.options);
    expect(weakenedGreen.exitCode).toBe(0);
    expect(weakenedGreen.assertionHash).not.toBe(red.assertionHash);
    const reasons = validateRedGreenEvidence(
      { ...validGap(), assertionHash: red.assertionHash },
      [red, weakenedGreen],
      redGreenLedger(),
    );
    expect(reasons.join('; ')).toMatch(/same assertion|assertionHash|weakened/i);
  });

  it('R-F(i): 把断言模块声明为 implementation 必须被拒绝（ledger scope 锚定）', async () => {
    const fixture = await createHarnessFixture();
    await fs.writeFile(path.join(fixture.root, 'runner.mjs'), RUNNER);
    await fs.writeFile(path.join(fixture.root, 'assertion.mjs'), IMPORTED_ASSERTION);
    // The bypass: exclude the assertion module from assertionHash by calling it "the implementation".
    await expect(
      runTddHarness(
        harnessInput({
          candidate: harnessCandidate([IMPLEMENTATION_ARTIFACT], ['runner.mjs']),
          testCommand: [process.execPath, 'runner.mjs'],
          testArtifacts: ['runner.mjs'],
          implementation: 'assertion.mjs',
        }),
        fixture.options,
      ),
    ).rejects.toThrow(/approved scope/i);
    // Even if the approved scope is forged to include it, the real implementation imported by the
    // closure becomes an unclassified closure member and is rejected.
    await expect(
      runTddHarness(
        harnessInput({
          candidate: harnessCandidate(['assertion.mjs'], ['runner.mjs']),
          testCommand: [process.execPath, 'runner.mjs'],
          testArtifacts: ['runner.mjs'],
          implementation: 'assertion.mjs',
        }),
        fixture.options,
      ),
    ).rejects.toThrow(/closure member|declared test artifact/i);
    // Declaring an argv entry as the implementation is rejected by R-B.
    await expect(
      runTddHarness(
        harnessInput({
          candidate: harnessCandidate(['probe.mjs'], ['src/token.mjs']),
          testArtifacts: ['src/token.mjs'],
          implementation: 'probe.mjs',
        }),
        fixture.options,
      ),
    ).rejects.toThrow(/argv entry/i);
  });

  it('consumer validator 拒绝把 implementation artifact 同时声明为 candidate test', async () => {
    const fixture = await createHarnessFixture();
    // The producer harness enforces the four set relations; the consumer validator must apply the same
    // disjointness rule to the LEDGER candidate, not just to the declaration. A ledger whose `tests`
    // includes the approved implementation file is rejected even when the declaration itself is disjoint.
    const red = await runTddHarness(harnessInput(), fixture.options);
    expect(red.exitCode).toBe(1);
    await fs.writeFile(path.join(fixture.root, 'src', 'token.mjs'), FIXED_TOKEN);
    const green = await runTddHarness(harnessInput(), fixture.options);
    expect(green.exitCode).toBe(0);
    const reasons = validateRedGreenEvidence(
      validGap(),
      [red, green],
      redGreenLedger([IMPLEMENTATION_ARTIFACT], ['probe.mjs', IMPLEMENTATION_ARTIFACT]),
    );
    expect(reasons.join('; ')).toMatch(/implementation artifact must not be a ledger-declared candidate test/i);
  });

  it('R-F(ii): 非字面量动态 import 的未声明断言文件被拒绝；声明后削弱它改变 hash 并拒绝 GREEN', async () => {
    const fixture = await createHarnessFixture();
    await fs.writeFile(path.join(fixture.root, 'runner.mjs'), NON_LITERAL_RUNNER);
    await fs.writeFile(path.join(fixture.root, 'assertion.mjs'), IMPORTED_ASSERTION);
    await fs.rm(path.join(fixture.root, 'probe.mjs'));

    // Undeclared assertion file in the test entry directory → R-D violation (the static closure is blind).
    await expect(
      runTddHarness(
        harnessInput({
          candidate: harnessCandidate([IMPLEMENTATION_ARTIFACT], ['runner.mjs']),
          testCommand: [process.execPath, 'runner.mjs'],
          testArtifacts: ['runner.mjs'],
        }),
        fixture.options,
      ),
    ).rejects.toThrow(/entry directory|declared test artifact/i);

    // Declared: the pair is now well-formed, and weakening the assertion changes the hash.
    const declaredArtifacts = ['runner.mjs', 'assertion.mjs'];
    const candidate = harnessCandidate([IMPLEMENTATION_ARTIFACT], declaredArtifacts);
    const red = await runTddHarness(
      harnessInput({ candidate, testCommand: [process.execPath, 'runner.mjs'], testArtifacts: declaredArtifacts }),
      fixture.options,
    );
    expect(red.exitCode).toBe(1);
    expect(red.toolVersions.codeHealthTddFailureClass).toBe('assertion');
    await fs.writeFile(path.join(fixture.root, 'assertion.mjs'), WEAKENED_ASSERTION);
    const weakenedGreen = await runTddHarness(
      harnessInput({ candidate, testCommand: [process.execPath, 'runner.mjs'], testArtifacts: declaredArtifacts }),
      fixture.options,
    );
    expect(weakenedGreen.exitCode).toBe(0);
    expect(weakenedGreen.assertionHash).not.toBe(red.assertionHash);
    expect(
      validateRedGreenEvidence(
        { ...validGap(), assertionHash: red.assertionHash },
        [red, weakenedGreen],
        redGreenLedger([IMPLEMENTATION_ARTIFACT], declaredArtifacts),
      ).join('; '),
    ).toMatch(/same assertion|assertionHash|weakened/i);
  });

  it('G-3: symlink / hardlink 断言文件被 SECURITY_BLOCKED 拒绝', async () => {
    const fixture = await createHarnessFixture();
    await fs.writeFile(path.join(fixture.root, 'real-probe.mjs'), PROBE);
    await fs.rm(path.join(fixture.root, 'probe.mjs'));
    await fs.symlink(path.join(fixture.root, 'real-probe.mjs'), path.join(fixture.root, 'probe.mjs'), 'file');
    await expect(runTddHarness(harnessInput(), fixture.options)).rejects.toThrow(/symlink/i);

    await fs.rm(path.join(fixture.root, 'probe.mjs'));
    await fs.writeFile(path.join(fixture.root, 'probe.mjs'), PROBE);
    await fs.link(path.join(fixture.root, 'probe.mjs'), path.join(fixture.root, 'probe-hard.mjs'));
    await expect(
      runTddHarness(
        harnessInput({
          candidate: harnessCandidate([IMPLEMENTATION_ARTIFACT], ['probe-hard.mjs']),
          testCommand: [process.execPath, 'probe-hard.mjs'],
          testArtifacts: ['probe-hard.mjs'],
        }),
        fixture.options,
      ),
    ).rejects.toThrow(/hardlink|nlink/i);
  });

  it('R-B/R-C/R-H: 未声明 closure 成员、空/不存在 testArtifacts、非字符串 implementation 均 fail-closed', async () => {
    const fixture = await createHarnessFixture();
    await fs.writeFile(path.join(fixture.root, 'src', 'helper.mjs'), 'export const helper = true;\n');
    await fs.writeFile(path.join(fixture.root, 'probe2.mjs'), "import './src/helper.mjs';\n");
    await fs.rm(path.join(fixture.root, 'probe.mjs'));
    await expect(
      runTddHarness(
        harnessInput({
          candidate: harnessCandidate([IMPLEMENTATION_ARTIFACT], ['probe2.mjs']),
          testCommand: [process.execPath, 'probe2.mjs'],
          testArtifacts: ['probe2.mjs'],
        }),
        fixture.options,
      ),
    ).rejects.toThrow(/closure member/i);

    await expect(runTddHarness(harnessInput({ testArtifacts: [] }), fixture.options)).rejects.toThrow(/testArtifacts/i);
    await expect(
      runTddHarness(
        harnessInput({
          candidate: harnessCandidate([IMPLEMENTATION_ARTIFACT], ['does-not-exist.mjs', 'probe.mjs']),
          testArtifacts: ['does-not-exist.mjs'],
        }),
        fixture.options,
      ),
    ).rejects.toThrow(/missing or unreadable/i);
    await expect(
      runTddHarness(harnessInput({ testArtifacts: [IMPLEMENTATION_ARTIFACT] }), fixture.options),
    ).rejects.toThrow(/ledger-declared candidate test/i);
    await expect(runTddHarness(harnessInput({ implementation: null }), fixture.options)).rejects.toThrow(
      /implementation artifact path/i,
    );
    await expect(
      runTddHarness(harnessInput({ implementation: 42 as unknown as string }), fixture.options),
    ).rejects.toThrow(/implementation artifact path/i);
  });

  it('R-E: RED/GREEN 声明的 test artifacts 不一致时被拒绝', async () => {
    const fixture = await createHarnessFixture();
    const red = await runTddHarness(harnessInput(), fixture.options);
    await fs.writeFile(path.join(fixture.root, 'extra.mjs'), 'process.stdout.write("extra\\n");\n');
    await fs.writeFile(path.join(fixture.root, 'src', 'token.mjs'), FIXED_TOKEN);
    const greenArtifacts = ['probe.mjs', 'extra.mjs'];
    const green = await runTddHarness(
      harnessInput({
        candidate: harnessCandidate([IMPLEMENTATION_ARTIFACT], greenArtifacts),
        testArtifacts: greenArtifacts,
      }),
      fixture.options,
    );
    expect(green.exitCode).toBe(0);
    expect(
      validateRedGreenEvidence(
        { ...validGap(), assertionHash: green.assertionHash },
        [red, green],
        redGreenLedger([IMPLEMENTATION_ARTIFACT], greenArtifacts),
      ).join('; '),
    ).toMatch(/identical test artifacts|same implementation artifact/i);
  });

  it('F-4: harness 拒绝指向本仓测试套件的 argv（防递归）', async () => {
    const fixture = await createHarnessFixture();
    const repoTestPath = path.join(repoRoot, 'w-model-dev', 'scripts', '__tests__', 'code-health-gap.test.ts');
    await expect(
      runTddHarness(harnessInput({ testCommand: [process.execPath, repoTestPath] }), fixture.options),
    ).rejects.toThrow(/recursion|repository|__tests__|test suite/i);
    await expect(runTddHarness(harnessInput({ testCommand: ['npm', 'run', 'test'] }), fixture.options)).rejects.toThrow(
      /recursion|repository|test suite/i,
    );
    await expect(
      runTddHarness(harnessInput({ testCommand: [process.execPath, '--vitest'] }), fixture.options),
    ).rejects.toThrow(/recursion|repository|vitest|test suite/i);
  });

  it('harness 未注入边界或输入非法时 fail-closed，绝不隐式执行本仓测试套件', async () => {
    await expect(runTddHarness({ gap: {} as never, testCommand: [] } as never)).rejects.toThrow(/gap|argv|requires/i);
    await expect(runTddHarness(harnessInput())).rejects.toThrow(/boundaries|requires/i);
  });

  it('G-1: 伪造 scope 的 fixture 经真实 CLI --validate 必须 exit 1（end-to-end）', async () => {
    for (const file of ['forged-scope-declaration.json', 'forged-scope-redgreen.json']) {
      const result = await runGapCli(['--matrix', path.join(phase2Samples, file), '--validate']);
      expect(result.code).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toMatch(
        /ledger candidate approved scope|ledger-declared candidate test/i,
      );
    }
    const valid = await runGapCli(['--matrix', path.join(phase2Samples, 'valid-gap.json'), '--validate']);
    expect(valid.code).toBe(0);
  });
});
