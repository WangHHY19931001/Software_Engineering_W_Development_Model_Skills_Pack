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
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import type {
  CodeHealthLedger,
  CommandEvidence,
  EvidenceBinding,
  GapDiscoveryInput,
  GapRow,
  RevisionIdentity,
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
    const weakenedReasons = validateRedGreenEvidence(weakened.gap as GapRow, weakened.results as CommandEvidence[]);
    expect(weakenedReasons.join('; ')).toMatch(/same assertion|assertionHash|weakened/i);

    const infrastructure = await readFixture('infrastructure-red.json');
    expect(
      validateRedGreenEvidence(infrastructure.gap as GapRow, infrastructure.results as CommandEvidence[]).join('; '),
    ).toMatch(/unrelated|infrastructure/i);

    const unknownCommand = await readFixture('unknown-command.json');
    expect(
      validateRedGreenEvidence(unknownCommand.gap as GapRow, unknownCommand.results as CommandEvidence[]).join('; '),
    ).toMatch(/RED evidence required/i);
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
const PROBE = [
  "import assert from 'node:assert/strict';",
  "import { isValidToken } from './src/token.mjs';",
  '',
  "assert.equal(isValidToken('forged-token'), false, 'gap: forged token must be rejected');",
  "assert.equal(isValidToken('valid-token.signature'), true, 'gap: valid token must be accepted');",
  "process.stdout.write('probe passed\\n');",
  '',
].join('\n');
/** A probe that fails for an unrelated infrastructure reason (module missing), not a gap assertion. */
const MISSING_MODULE_PROBE = "import 'module-that-does-not-exist-for-code-health-gap-xyz';\n";

interface HarnessFixture {
  root: string;
  revision: RevisionIdentity;
  options: TddHarnessOptions;
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
    const testCommand = [process.execPath, 'probe.mjs'];
    const red = await runTddHarness({ gap: validGap(), testCommand, implementation: null }, fixture.options);
    expect(red.exitCode).toBe(1);
    expect(red.observation).toBe('observed');
    expect(red.toolVersions.codeHealthTddFailureClass).toBe('assertion');
    expect(red.implementationHash).toBeNull();

    await fs.writeFile(path.join(fixture.root, 'src', 'token.mjs'), FIXED_TOKEN);
    const green = await runTddHarness(
      { gap: validGap(), testCommand, implementation: 'src/token.mjs' },
      fixture.options,
    );
    expect(green.exitCode).toBe(0);
    expect(green.observation).toBe('observed');
    expect(green.toolVersions.codeHealthTddFailureClass).toBe('none');
    expect(green.implementationHash).toMatch(/^[0-9a-f]{64}$/);
    expect(green.implementationHash).not.toBeNull();

    // Same exact assertion, distinct real runs, and the pair passes the strengthened validator.
    expect(green.assertionHash).toBe(red.assertionHash);
    expect(green.rawOutputSha256).not.toBe(red.rawOutputSha256);
    expect(validateRedGreenEvidence({ ...validGap(), assertionHash: red.assertionHash }, [red, green])).toEqual([]);

    // The fixture repository HEAD is untouched: the harness only wrote raw outputs beneath its root.
    expect((await git(fixture.root, ['rev-parse', 'HEAD'])).trim()).toBe(fixture.revision.commitSha);
    expect(await fs.readdir(path.join(fixture.root, '.code-health-raw'))).toEqual(
      expect.arrayContaining([expect.any(String)]),
    );
  });

  it('拒绝因无关基础设施原因失败的 RED（模块缺失 / 命令不存在），不计为 RED', async () => {
    const fixture = await createHarnessFixture();
    const testCommand = [process.execPath, 'probe.mjs'];

    await fs.writeFile(path.join(fixture.root, 'missing.mjs'), MISSING_MODULE_PROBE);
    const unrelatedRed = await runTddHarness(
      { gap: validGap(), testCommand: [process.execPath, 'missing.mjs'], implementation: null },
      fixture.options,
    );
    expect(unrelatedRed.exitCode).toBe(1);
    expect(unrelatedRed.observation).toBe('observed');
    expect(unrelatedRed.toolVersions.codeHealthTddFailureClass).toBe('infrastructure');
    await fs.writeFile(path.join(fixture.root, 'src', 'token.mjs'), FIXED_TOKEN);
    const green = await runTddHarness(
      { gap: validGap(), testCommand, implementation: 'src/token.mjs' },
      fixture.options,
    );
    expect(green.exitCode).toBe(0);
    const unrelatedReasons = validateRedGreenEvidence({ ...validGap(), assertionHash: green.assertionHash }, [
      unrelatedRed,
      green,
    ]);
    expect(unrelatedReasons.join('; ')).toMatch(/unrelated reason|infrastructure/i);

    const missingCommand = await runTddHarness(
      { gap: validGap(), testCommand: ['definitely-not-a-real-code-health-command-xyz'], implementation: null },
      fixture.options,
    );
    expect(missingCommand.exitCode).toBeNull();
    expect(missingCommand.observation).toBe('unavailable');
    expect(missingCommand.toolVersions.codeHealthTddFailureClass).toBe('unavailable');
    expect(
      validateRedGreenEvidence({ ...validGap(), assertionHash: green.assertionHash }, [missingCommand, green]),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/RED evidence required/i)]));
  });

  it('拒绝通过削弱断言获得的 GREEN：assertionHash 改变后 RED/GREEN 不再成对', async () => {
    const fixture = await createHarnessFixture();
    const testCommand = [process.execPath, 'probe.mjs'];
    const red = await runTddHarness({ gap: validGap(), testCommand, implementation: null }, fixture.options);
    expect(red.exitCode).toBe(1);
    expect(red.toolVersions.codeHealthTddFailureClass).toBe('assertion');

    // Weaken the assertion to an unconditional success instead of fixing the implementation.
    await fs.writeFile(path.join(fixture.root, 'probe.mjs'), 'process.exit(0);\n');
    const weakenedGreen = await runTddHarness({ gap: validGap(), testCommand, implementation: null }, fixture.options);
    expect(weakenedGreen.exitCode).toBe(0);
    expect(weakenedGreen.assertionHash).not.toBe(red.assertionHash);
    const reasons = validateRedGreenEvidence({ ...validGap(), assertionHash: red.assertionHash }, [red, weakenedGreen]);
    expect(reasons.join('; ')).toMatch(/same assertion|assertionHash|weakened/i);
  });

  it('harness 未注入边界或输入非法时 fail-closed，绝不隐式执行本仓测试套件', async () => {
    await expect(runTddHarness({ gap: {} as never, testCommand: [], implementation: null } as never)).rejects.toThrow(
      /gap|argv|requires/i,
    );
    await expect(
      runTddHarness({ gap: validGap(), testCommand: [process.execPath, 'probe.mjs'], implementation: null }),
    ).rejects.toThrow(/boundaries|requires/i);
  });
});
