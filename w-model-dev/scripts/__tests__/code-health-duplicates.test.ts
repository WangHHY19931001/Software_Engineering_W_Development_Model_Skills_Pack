/* eslint-disable security/detect-non-literal-fs-filename -- All filesystem paths are generated beneath test-owned temporary roots. */
/**
 * Task 6 (fix round 1) acceptance: Phase 4 duplicate clustering + abstraction guard.
 *
 * The equivalence default-deny layer is exercised item-wise; the F-1 fix additionally proves that
 * authorization is anchored to a HEAD-tracked ledger: a caller-declared matrix/authority never
 * authorizes, and the apply gate recomputes the cluster from the tracked authority instead of trusting
 * a hand-crafted `--cluster`.
 */

import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  clusterDuplicates,
  isQuantifiedMaintenanceBenefit,
  parseTrackedFacts,
  proveAbstraction,
  restrictAuthority,
  structuralViewSupport,
  validateDuplicateAuthority,
  validateDuplicateCluster,
  validateDuplicateInput,
  type DuplicateClusterAuthority,
} from '../logic/code-health-duplicate-logic.js';
import {
  clusterDuplicates as ledgerClusterDuplicates,
  proveAbstraction as ledgerProveAbstraction,
  type ApprovalDecision,
  type CodeHealthCandidate,
} from '../logic/code-health-ledger-logic.js';
import type {
  AbstractionProposal,
  DuplicateCluster,
  DuplicateInput,
  RevisionIdentity,
} from '../logic/code-health-contract.js';
import { createCodeHealthGitRevisionProvider } from '../lib/code-health-revision-provider.js';
import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '../../..');
const CLI_DIR = path.join(REPO_ROOT, 'w-model-dev/scripts/cli');
const SAMPLE_DIR = path.join(REPO_ROOT, 'w-model-dev/scripts/samples/code-health/phase4');

const revisionProvider = createCodeHealthGitRevisionProvider();

const GIT_ENV = {
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: 'code-health-duplicates',
  GIT_AUTHOR_EMAIL: 'code-health-duplicates@example.test',
  GIT_COMMITTER_NAME: 'code-health-duplicates',
  GIT_COMMITTER_EMAIL: 'code-health-duplicates@example.test',
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

interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runCli(script: string, args: string[], cwd: string = REPO_ROOT): CliResult {
  const r = runSync(process.execPath, [tsxCli, path.join(CLI_DIR, script), ...args], {
    cwd,
    timeout: 90_000,
    env: { ...process.env, ...GIT_ENV },
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function jsonLine<T>(stdout: string, prefix: string): T | null {
  const line = stdout.split(/\r?\n/).find((entry) => entry.startsWith(`${prefix} `));
  if (line === undefined) return null;
  try {
    return JSON.parse(line.slice(prefix.length + 1)) as T;
  } catch {
    return null;
  }
}

async function tempRoot(prefix: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), prefix));
  createdRoots.push(root);
  return root;
}

async function git(root: string, args: string[]): Promise<CliResult> {
  const r = runSync('git', args, { cwd: root, timeout: 30_000, env: GIT_ENV });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

async function gitStatus(root: string): Promise<string> {
  return (await git(root, ['status', '--porcelain', '--untracked-files=all'])).stdout.trim();
}

async function writeJson(dir: string, name: string, value: unknown): Promise<string> {
  const target = path.join(dir, name);
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return target;
}

const PROOF = {
  inputsOutputs: 'accepted-inputs=equivalent; produced-outputs=equivalent',
  orderingMutationsSideEffects: 'ordering=equivalent; mutations=equivalent; side-effects=equivalent',
  errorsRetries:
    'error-types=equivalent; error-status=equivalent; error-messages=equivalent; retry=equivalent; failure-timing=equivalent',
  lifecycleResources:
    'initialization=equivalent; finalization=equivalent; cleanup=equivalent; cancellation=equivalent; transactions=equivalent; resource-scope=equivalent',
  security: 'authorization=equivalent; validation-order=equivalent; secrets=equivalent; privilege=equivalent',
  concurrencyPlatforms: 'locks=equivalent; atomicity=equivalent; idempotency=equivalent; platform=equivalent',
  allDimensionsProven: true as const,
};

const MAINTENANCE = 'Consolidates 2 duplicated implementations into 1 cohesive API, removing 1 behavior owner.';

const SCOPE = ['src/cache-a.ts', 'src/cache-b.ts', 'src/service-a.ts', 'src/service-b.ts', 'src/cache-service.ts'];
const SITES = ['src/service-a.ts:load', 'src/service-b.ts:load'];
const TEST_FILES = ['tests/cache-contract.test.ts'];

const AST = ['node=conditional', 'branch=missing-or-hit', 'control-flow=single-return'];
const DATA_FLOW = ['input=cache-key', 'output=value-or-loader', 'side-effect=none'];
const CALL_GRAPH = ['caller=src/service-a.ts:load', 'callee=src/cache-a.ts:readCacheA', 'lifecycle=shared-cache'];

function trackedFactsFor(sites: readonly string[]): string[] {
  const facts: string[] = [];
  for (const site of sites) facts.push(`call-site:${site}`, `contract:${site}`, `regression:${site}`);
  return facts;
}

function regressionCommand() {
  return {
    command: 'node --test tests/cache-contract.test.ts',
    cwd: '.',
    environment: { NODE_ENV: 'test' },
    platform: 'linux',
    toolVersions: { node: '20.0.0' },
    startedAt: '2026-09-07T00:01:00.000Z',
    endedAt: '2026-09-07T00:01:01.000Z',
    exitCode: 0,
    observation: 'observed' as const,
    rawOutputPath: '.w-model/code-health/raw/node-test.log',
    rawOutputSha256: 'd'.repeat(64),
  };
}

function authoritativeInput(): DuplicateInput {
  return {
    implementations: [
      { file: 'src/cache-a.ts', symbol: 'readCacheA', sourceHash: 'a'.repeat(64) },
      { file: 'src/cache-b.ts', symbol: 'readCacheB', sourceHash: 'b'.repeat(64) },
    ],
    ast: [...AST],
    dataFlow: [...DATA_FLOW],
    callGraph: [...CALL_GRAPH],
    tests: [...TEST_FILES],
  };
}

function authority(overrides: Partial<DuplicateClusterAuthority> = {}): DuplicateClusterAuthority {
  return {
    candidateId: 'CHG-P4-20260907-901',
    phase: 'P4',
    action: 'abstract',
    approvedScope: [...SCOPE],
    declaredCallSites: [...SITES],
    declaredTests: [...TEST_FILES],
    regressionCommands: [regressionCommand()],
    trackedFacts: trackedFactsFor(SITES),
    ...overrides,
  };
}

function rollback(candidateId: string): AbstractionProposal['rollback'] {
  return {
    preChangeRevision: 'a'.repeat(40),
    command: `git apply -R .w-model/code-health/apply/${candidateId}.patch`,
    patchPath: `.w-model/code-health/apply/${candidateId}.patch`,
    owner: 'S-agent',
    executable: true,
  };
}

function equivalentProposal(overrides: Partial<AbstractionProposal> = {}): AbstractionProposal {
  return {
    targetApi: 'src/cache-service.ts:readCache',
    migratedCallSites: [...SITES],
    inputsOutputs: PROOF.inputsOutputs,
    errorsRetries: PROOF.errorsRetries,
    lifecycleResources: PROOF.lifecycleResources,
    security: PROOF.security,
    concurrencyPlatforms: PROOF.concurrencyPlatforms,
    maintenanceBenefit: MAINTENANCE,
    rollback: rollback('CHG-P4-20260907-901'),
    ...overrides,
  };
}

function equivalentCluster(overrides: Partial<DuplicateCluster> = {}): DuplicateCluster {
  const base = clusterDuplicates(authoritativeInput(), authority());
  return { ...base, equivalenceProof: { ...PROOF }, maintenanceBenefit: MAINTENANCE, ...overrides };
}

// -------------------- tracked-ledger helpers --------------------

interface LedgerCandidateShape {
  candidateId: string;
  phase: string;
  action: string;
  changeScope: { files: string[]; symbols: string[]; scopeHash: string };
  callSites: string[];
  tests: string[];
  commands: unknown[];
  sources: string[];
}

function ledgerCandidate(overrides: Partial<LedgerCandidateShape> = {}): LedgerCandidateShape {
  return {
    candidateId: 'CHG-P4-20260907-901',
    phase: 'P4',
    action: 'abstract',
    changeScope: {
      files: [...SCOPE],
      symbols: ['readCacheA', 'readCacheB', 'readCache'],
      scopeHash: 'sha256:' + 'f'.repeat(64),
    },
    callSites: [...SITES],
    tests: [],
    commands: [regressionCommand()],
    sources: trackedFactsFor(SITES),
    ...overrides,
  };
}

/** A temp git repo with real production files and a HEAD-tracked ledger.json (working == HEAD blob). */
async function createTrackedRepo(
  candidateOverrides: Partial<LedgerCandidateShape> = {},
  extraFiles: Record<string, string> = {},
): Promise<string> {
  const root = await tempRoot('code-health-duplicates-repo-');
  await git(root, ['init', '--quiet']);
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'cache-a.ts'), 'export const readCacheA = 1;\n');
  await fs.writeFile(path.join(root, 'src', 'cache-b.ts'), 'export const readCacheB = 1;\n');
  await fs.writeFile(path.join(root, 'src', 'service-a.ts'), 'export const load = 1;\n');
  await fs.writeFile(path.join(root, 'src', 'service-b.ts'), 'export const load = 1;\n');
  await fs.writeFile(path.join(root, 'src', 'cache-service.ts'), 'export const readCache = 1;\n');
  // The apply gate writes its controlled patch beneath .w-model/; keep it out of the real worktree status.
  await fs.writeFile(path.join(root, '.gitignore'), '.w-model/\n');
  for (const [relative, content] of Object.entries(extraFiles)) {
    const absolute = path.join(root, ...relative.split('/'));
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content);
  }
  await fs.writeFile(
    path.join(root, 'ledger.json'),
    `${JSON.stringify({ schemaVersion: '1.0', candidates: [ledgerCandidate(candidateOverrides)] }, null, 2)}\n`,
  );
  await git(root, ['add', '--all']);
  await git(root, ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'initial']);
  return root;
}

function matrixDocument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    candidateId: 'CHG-P4-20260907-901',
    input: authoritativeInput(),
    restrictions: {},
    review: { equivalenceProof: PROOF, maintenanceBenefit: MAINTENANCE, rollback: rollback('CHG-P4-20260907-901') },
    proposal: equivalentProposal(),
    ...overrides,
  };
}

describe('Phase 4 pure cluster semantics (R3/R4)', () => {
  it('at least two typed views but fewer than two tracked stable sites → deferred; guard reports two stable production call sites', () => {
    const cluster = clusterDuplicates(
      authoritativeInput(),
      authority({
        declaredCallSites: ['src/service-a.ts:load'],
        trackedFacts: trackedFactsFor(['src/service-a.ts:load']),
      }),
    );
    expect(cluster.status).toBe('deferred');
    expect(cluster.stableProductionCallSites).toEqual(['src/service-a.ts:load']);
    expect(
      proveAbstraction(
        { ...cluster, equivalenceProof: { ...PROOF }, maintenanceBenefit: MAINTENANCE },
        equivalentProposal(),
      ).some((entry) => entry.includes('two stable production call sites')),
    ).toBe(true);
  });

  it('test-only helper as implementation → rejected (test-only never authorizes)', () => {
    const cluster = clusterDuplicates(
      {
        ...authoritativeInput(),
        implementations: [
          { file: 'src/cache-a.ts', symbol: 'readCacheA', sourceHash: 'a'.repeat(64) },
          { file: 'tests/helper.ts', symbol: 'readCacheHelper', sourceHash: 'e'.repeat(64) },
        ],
      },
      authority({ declaredTests: [...TEST_FILES, 'tests/helper.ts'] }),
    );
    expect(cluster.status).toBe('rejected');
    expect(
      proveAbstraction(
        { ...cluster, equivalenceProof: { ...PROOF }, maintenanceBenefit: MAINTENANCE },
        equivalentProposal(),
      ),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/test-only/i)]));
  });

  it('F-3: prose-only views cannot satisfy the structural floor', () => {
    const prose: DuplicateInput = {
      ...authoritativeInput(),
      ast: ['the two implementations look textually similar'],
      dataFlow: ['both read a cache'],
      callGraph: ['they seem to share a lifecycle'],
    };
    expect(structuralViewSupport(prose)).toBe(0);
    const cluster = clusterDuplicates(prose, authority());
    expect(cluster.status).toBe('deferred');
    expect(
      proveAbstraction(
        { ...cluster, equivalenceProof: { ...PROOF }, maintenanceBenefit: MAINTENANCE },
        equivalentProposal(),
      ),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/accidental/i)]));
  });

  it('F-2: generated / one-off / dead copies recorded in tracked facts are excluded', () => {
    for (const reason of ['generated', 'one-off-experiment', 'dead-copy', 'mock', 'fixture']) {
      const cluster = clusterDuplicates(
        authoritativeInput(),
        authority({ trackedFacts: [...trackedFactsFor(SITES), `excluded:${reason}:src/service-b.ts:load`] }),
      );
      expect({ reason, status: cluster.status, sites: cluster.stableProductionCallSites }).toEqual({
        reason,
        status: 'deferred',
        sites: ['src/service-a.ts:load'],
      });
    }
    const facts = parseTrackedFacts([...trackedFactsFor(SITES), 'excluded:generated:src/service-b.ts:load']);
    expect([...facts.exclusions]).toEqual(['src/service-b.ts:load']);
    expect([...facts.callSites].length).toBe(2);
  });

  it('a declared call site without tracked call-site/contract/regression facts is not stable (default-deny)', () => {
    expect(clusterDuplicates(authoritativeInput(), authority({ trackedFacts: [] })).stableProductionCallSites).toEqual(
      [],
    );
    expect(
      clusterDuplicates(
        authoritativeInput(),
        authority({ trackedFacts: ['call-site:src/service-a.ts:load', 'regression:src/service-a.ts:load'] }),
      ).stableProductionCallSites,
    ).toEqual([]);
  });

  it('stable sites must be inside the approved scope and covered by an observed regression command', () => {
    const outside = clusterDuplicates(
      authoritativeInput(),
      authority({ approvedScope: ['src/cache-a.ts', 'src/cache-b.ts'] }),
    );
    expect(outside.stableProductionCallSites).toEqual([]);
    const noRegression = clusterDuplicates(
      authoritativeInput(),
      authority({ regressionCommands: [{ ...regressionCommand(), observation: 'unavailable', exitCode: null }] }),
    );
    expect(noRegression.status).toBe('deferred');
  });

  it('restrictAuthority may only narrow the tracked authority', () => {
    const tracked = authority();
    const narrowed = restrictAuthority(tracked, {
      approvedScope: ['src/cache-a.ts', 'src/cache-b.ts', 'src/service-a.ts'],
      declaredCallSites: ['src/service-b.ts:load', 'src/forged.ts:evil'],
    });
    expect(narrowed.approvedScope).toEqual(['src/cache-a.ts', 'src/cache-b.ts', 'src/service-a.ts']);
    expect(narrowed.declaredCallSites).toEqual(['src/service-b.ts:load']);
    expect(narrowed.trackedFacts).toEqual(tracked.trackedFacts);
  });

  it('clustering is deterministic and the ledger re-export is the same single implementation', () => {
    expect(clusterDuplicates(authoritativeInput(), authority())).toEqual(
      clusterDuplicates(authoritativeInput(), authority()),
    );
    expect(ledgerClusterDuplicates).toBe(clusterDuplicates);
    expect(ledgerProveAbstraction).toBe(proveAbstraction);
  });

  it('structurally invalid input / authority fail closed', () => {
    expect(validateDuplicateInput({})).not.toEqual([]);
    expect(validateDuplicateAuthority({})).not.toEqual([]);
    expect(() => clusterDuplicates({} as unknown as DuplicateInput, authority())).toThrow(/requires/i);
    expect(() => clusterDuplicates(authoritativeInput(), {} as unknown as DuplicateClusterAuthority)).toThrow(
      /ledger-recorded authority/i,
    );
  });
});

describe('Phase 4 abstraction guard: item-wise dimensions (R4/R9)', () => {
  it('complete equivalence proof + quantified maintenance benefit → no violation (the only authorization)', () => {
    expect(proveAbstraction(equivalentCluster(), equivalentProposal())).toEqual([]);
  });

  it('security difference (different validation order) → security violation', () => {
    const violations = proveAbstraction(
      equivalentCluster(),
      equivalentProposal({ security: 'different validation order' }),
    );
    expect(violations.some((entry) => entry.includes('security'))).toBe(true);
  });

  it('test-only call site (contract shape: path in views.tests and stableProductionCallSites) → test-only', () => {
    const violations = proveAbstraction(
      equivalentCluster({
        views: { ...equivalentCluster().views, tests: ['tests/helper.ts'] },
        stableProductionCallSites: ['tests/helper.ts:run', 'src/service-b.ts:load'],
      }),
      equivalentProposal({ migratedCallSites: ['tests/helper.ts:run', 'src/service-b.ts:load'] }),
    );
    expect(violations).toEqual(expect.arrayContaining([expect.stringMatching(/test-only/i)]));
  });

  it('textual similarity / short diff / mock similarity cannot authorize', () => {
    const textual = equivalentCluster({
      equivalenceProof: { ...PROOF, security: 'the two implementations look textually similar' },
    });
    expect(proveAbstraction(textual, equivalentProposal())).toEqual(
      expect.arrayContaining([expect.stringMatching(/security/i)]),
    );

    const mockSimilar = equivalentCluster({
      views: { ...equivalentCluster().views, tests: ['tests/mocks/cache-mock.ts'] },
      stableProductionCallSites: ['tests/mocks/cache-mock.ts:run', 'src/service-b.ts:load'],
    });
    expect(proveAbstraction(mockSimilar, equivalentProposal())).toEqual(
      expect.arrayContaining([expect.stringMatching(/test-only/i)]),
    );

    const shortDiff = equivalentCluster({ maintenanceBenefit: 'The change is 40 lines shorter and a smaller diff.' });
    expect(
      proveAbstraction(
        shortDiff,
        equivalentProposal({ maintenanceBenefit: 'The change is 40 lines shorter and a smaller diff.' }),
      ),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/maintenance/i)]));
    expect(isQuantifiedMaintenanceBenefit('40 lines shorter')).toBe(false);
    expect(isQuantifiedMaintenanceBenefit(MAINTENANCE)).toBe(true);
  });

  it('platform / lifecycle differences → not authorized', () => {
    const lifecycle = equivalentCluster({
      equivalenceProof: { ...PROOF, lifecycleResources: 'cleanup=not equivalent' },
    });
    expect(proveAbstraction(lifecycle, equivalentProposal({ lifecycleResources: 'cleanup=not equivalent' }))).toEqual(
      expect.arrayContaining([expect.stringMatching(/lifecycle/i)]),
    );
    const platform = equivalentCluster({
      equivalenceProof: { ...PROOF, concurrencyPlatforms: 'locks=equivalent; platform=different' },
    });
    expect(
      proveAbstraction(platform, equivalentProposal({ concurrencyPlatforms: 'locks=equivalent; platform=different' })),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/platform/i)]));
  });

  it('allDimensionsProven alone is not trusted; missing/negative dimensions are refused', () => {
    const proof = { ...PROOF, security: '' };
    expect(proveAbstraction(equivalentCluster({ equivalenceProof: proof }), equivalentProposal())).toEqual(
      expect.arrayContaining([expect.stringMatching(/security/i)]),
    );
    const missing = equivalentCluster({
      equivalenceProof: undefined as unknown as DuplicateCluster['equivalenceProof'],
    });
    expect(proveAbstraction(missing, equivalentProposal()).length).toBeGreaterThan(0);
  });

  it('migratedCallSites must equal the minimal stable set; rollback must be executable', () => {
    expect(
      proveAbstraction(equivalentCluster(), equivalentProposal({ migratedCallSites: ['src/service-a.ts:load'] })),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/migrated/i)]));
    expect(
      proveAbstraction(equivalentCluster(), equivalentProposal({ rollback: { ...rollback('x'), executable: false } })),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/rollback/i)]));
  });

  it('structurally invalid cluster/proposal fail closed (STRUCTURE_INVALID)', () => {
    expect(() => proveAbstraction({} as unknown as DuplicateCluster, equivalentProposal())).toThrow(/requires/i);
    expect(() => proveAbstraction(equivalentCluster(), {} as unknown as AbstractionProposal)).toThrow(/requires/i);
    expect(validateDuplicateCluster({})).not.toEqual([]);
  });
});

describe('F-1: duplicates CLI authority is anchored to a HEAD-tracked ledger', () => {
  it('forged matrix with nonexistent files and no tracked ledger → exit 0 deferred, authorized:false', async () => {
    const workDir = await tempRoot('code-health-duplicates-forged-');
    const matrixPath = await writeJson(
      workDir,
      'matrix.json',
      matrixDocument({
        input: {
          ...authoritativeInput(),
          implementations: [
            { file: 'src/nonexistent-a.ts', symbol: 'a', sourceHash: 'a'.repeat(64) },
            { file: 'src/nonexistent-b.ts', symbol: 'b', sourceHash: 'b'.repeat(64) },
          ],
        },
      }),
    );
    const r = runCli('code-health-duplicates.ts', ['--matrix', matrixPath, '--validate']);
    expect(r.code).toBe(0);
    const summary = jsonLine<{ status: string; authorized: boolean; authoritySource: string }>(
      r.stdout,
      'DUPLICATES_JSON',
    );
    expect(summary?.status).toBe('deferred');
    expect(summary?.authorized).toBe(false);
    expect(summary?.authoritySource).toBe('unavailable');
  });

  it('tracked ledger + complete matrix → exit 0 authorized:true; without --ledger the same matrix is deferred', async () => {
    const root = await createTrackedRepo();
    const workDir = await tempRoot('code-health-duplicates-inputs-');
    const matrixPath = await writeJson(workDir, 'matrix.json', matrixDocument());

    const untracked = runCli('code-health-duplicates.ts', ['--matrix', matrixPath, '--validate']);
    expect(untracked.code).toBe(0);
    expect(jsonLine<{ authorized: boolean }>(untracked.stdout, 'DUPLICATES_JSON')?.authorized).toBe(false);

    const tracked = runCli('code-health-duplicates.ts', [
      '--matrix',
      matrixPath,
      '--ledger',
      path.join(root, 'ledger.json'),
      '--root',
      root,
      '--validate',
    ]);
    expect(tracked.code).toBe(0);
    const summary = jsonLine<{
      status: string;
      authorized: boolean;
      authoritySource: string;
      stableProductionCallSites: string[];
    }>(tracked.stdout, 'DUPLICATES_JSON');
    expect(summary).toMatchObject({
      status: 'under-review',
      authorized: true,
      authoritySource: 'tracked-ledger',
      stableProductionCallSites: [...SITES],
    });
  }, 120_000);

  it('tracked ledger that references a nonexistent production path → exit 1', async () => {
    const ghostSite = 'src/ghost.ts:load';
    const root = await createTrackedRepo(
      {
        changeScope: {
          files: [...SCOPE, 'src/ghost.ts'],
          symbols: ['readCacheA', 'readCacheB', 'readCache'],
          scopeHash: 'sha256:' + 'f'.repeat(64),
        },
        callSites: [...SITES, ghostSite],
        sources: trackedFactsFor([...SITES, ghostSite]),
      },
      { 'src/ghost.ts': 'export const load = 1;\n' },
    );
    await fs.rm(path.join(root, 'src', 'ghost.ts'));
    const workDir = await tempRoot('code-health-duplicates-inputs-');
    const matrixPath = await writeJson(workDir, 'matrix.json', matrixDocument());
    const r = runCli('code-health-duplicates.ts', [
      '--matrix',
      matrixPath,
      '--ledger',
      path.join(root, 'ledger.json'),
      '--root',
      root,
      '--validate',
    ]);
    expect(r.code).toBe(1);
    expect(r.stdout).toMatch(/does not exist beneath --root/i);
    expect(jsonLine<{ authorized: boolean }>(r.stdout, 'DUPLICATES_JSON')?.authorized).toBe(false);
  }, 120_000);

  it('unknown flag → exit 2 ERROR_JSON; missing --matrix → exit 2', () => {
    const unknown = runCli('code-health-duplicates.ts', ['--bogus']);
    expect(unknown.code).toBe(2);
    expect(unknown.stdout).toContain('ERROR_JSON');
    expect(runCli('code-health-duplicates.ts', []).code).toBe(2);
  });

  it('F-6: every fixture resolves to its declared pure status/authorized outcome', async () => {
    const files = (await fs.readdir(SAMPLE_DIR)).filter((entry) => entry.endsWith('.json')).sort();
    expect(files.length).toBeGreaterThanOrEqual(12);
    for (const file of files) {
      const fixture = JSON.parse(await fs.readFile(path.join(SAMPLE_DIR, file), 'utf8')) as {
        expectedStatus: DuplicateCluster['status'];
        expectAuthorized: boolean;
        input: DuplicateInput;
        authority: DuplicateClusterAuthority;
        review?: { equivalenceProof?: DuplicateCluster['equivalenceProof']; maintenanceBenefit?: string };
        proposal?: AbstractionProposal;
      };
      let status: string = 'error';
      let authorized = false;
      let violations: string[] = [];
      try {
        const cluster = clusterDuplicates(fixture.input, fixture.authority);
        status = cluster.status;
        const merged: DuplicateCluster = { ...cluster };
        if (fixture.review?.equivalenceProof !== undefined) merged.equivalenceProof = fixture.review.equivalenceProof;
        if (fixture.review?.maintenanceBenefit !== undefined)
          merged.maintenanceBenefit = fixture.review.maintenanceBenefit;
        if (fixture.proposal !== undefined) violations = proveAbstraction(merged, fixture.proposal);
        authorized =
          violations.length === 0 &&
          status === 'under-review' &&
          fixture.review?.equivalenceProof !== undefined &&
          fixture.proposal !== undefined;
      } catch (error) {
        violations = [error instanceof Error ? error.message : String(error)];
      }
      expect({ file, status, authorized, violations }).toMatchObject({
        file,
        status: fixture.expectedStatus,
        authorized: fixture.expectAuthorized,
      });
    }
  }, 120_000);
});

// -------------------- apply gate: abstract must recompute from a tracked ledger --------------------

let baseCandidate: CodeHealthCandidate | null = null;

beforeAll(async () => {
  const raw = JSON.parse(
    await fs.readFile(path.join(REPO_ROOT, 'w-model-dev/scripts/samples/code-health/apply/valid-patch.json'), 'utf8'),
  ) as { candidate: CodeHealthCandidate };
  baseCandidate = raw.candidate;
});

function abstractFixture(revision: RevisionIdentity): { candidate: CodeHealthCandidate; approval: ApprovalDecision } {
  const candidate: CodeHealthCandidate = {
    ...structuredClone(baseCandidate as CodeHealthCandidate),
    candidateId: 'CHG-P4-20260907-901',
    phase: 'P4',
    action: 'abstract',
    files: [...SCOPE],
    symbols: ['readCacheA', 'readCacheB'],
    tests: [],
    callSites: [...SITES],
    changeScope: {
      files: [...SCOPE],
      symbols: ['readCacheA', 'readCacheB', 'readCache'],
      scopeHash: 'sha256:' + 'f'.repeat(64),
    },
    revision,
  };
  candidate.evidenceBinding = {
    ...candidate.evidenceBinding,
    candidate: {
      ...candidate.evidenceBinding.candidate,
      candidateId: candidate.candidateId,
      phase: 'P4',
      action: 'abstract',
      files: candidate.changeScope.files,
      symbols: candidate.changeScope.symbols,
      scopeHash: candidate.changeScope.scopeHash,
    },
    revision,
  };
  candidate.rollback = {
    ...candidate.rollback,
    preChangeRevision: revision.commitSha,
    command: `git apply -R .w-model/code-health/apply/${candidate.candidateId}.patch`,
    patchPath: `.w-model/code-health/apply/${candidate.candidateId}.patch`,
  };
  const approval: ApprovalDecision = {
    candidateId: candidate.candidateId,
    decision: 'approve',
    approvedAction: 'abstract',
    approvedFiles: [...SCOPE],
    approvedSymbols: candidate.changeScope.symbols,
    scopeHash: candidate.changeScope.scopeHash,
    rationale: 'The exact abstraction scope is independently reviewed and directly reversible.',
    actor: 'human-decision-maker',
    decidedAt: '2026-09-07T00:03:00.000Z',
    signatureRef: 'evidence/signature-human.json',
    revision,
  };
  return { candidate, approval };
}

describe('F-1: apply gate recomputes the abstraction from a tracked ledger', () => {
  it('a hand-crafted --cluster is refused (unknown flag → exit 2), no patch written', async () => {
    const root = await createTrackedRepo();
    const revision = (await revisionProvider.current(root)) as RevisionIdentity;
    const workDir = await tempRoot('code-health-duplicates-inputs-');
    const { candidate, approval } = abstractFixture(revision);
    const candidatePath = await writeJson(workDir, 'candidate.json', candidate);
    const approvalPath = await writeJson(workDir, 'approval.json', approval);
    const clusterPath = await writeJson(workDir, 'cluster.json', equivalentCluster());
    const proposalPath = await writeJson(workDir, 'proposal.json', equivalentProposal());

    const r = runCli('code-health-apply.ts', [
      '--candidate',
      candidatePath,
      '--approval',
      approvalPath,
      '--root',
      root,
      '--mode',
      'patch',
      '--cluster',
      clusterPath,
      '--proposal',
      proposalPath,
    ]);
    expect(r.code).toBe(2);
    expect(r.stdout).toContain('ERROR_JSON');
    await expect(fs.stat(path.join(root, '.w-model'))).rejects.toBeTruthy();
  }, 120_000);

  it('without a tracked ledger → exit 1 and no write', async () => {
    const root = await createTrackedRepo();
    const revision = (await revisionProvider.current(root)) as RevisionIdentity;
    const workDir = await tempRoot('code-health-duplicates-inputs-');
    const { candidate, approval } = abstractFixture(revision);
    const candidatePath = await writeJson(workDir, 'candidate.json', candidate);
    const approvalPath = await writeJson(workDir, 'approval.json', approval);
    const matrixPath = await writeJson(workDir, 'matrix.json', matrixDocument());
    const before = await gitStatus(root);

    const r = runCli('code-health-apply.ts', [
      '--candidate',
      candidatePath,
      '--approval',
      approvalPath,
      '--root',
      root,
      '--mode',
      'patch',
      '--matrix',
      matrixPath,
    ]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('abstraction requires a validated Phase 4 proof');
    expect(await gitStatus(root)).toBe(before);
  }, 120_000);

  it('tracked ledger + complete matrix → controlled patch only, worktree unchanged', async () => {
    const root = await createTrackedRepo();
    const revision = (await revisionProvider.current(root)) as RevisionIdentity;
    const workDir = await tempRoot('code-health-duplicates-inputs-');
    const { candidate, approval } = abstractFixture(revision);
    const candidatePath = await writeJson(workDir, 'candidate.json', candidate);
    const approvalPath = await writeJson(workDir, 'approval.json', approval);
    const matrixPath = await writeJson(workDir, 'matrix.json', matrixDocument());
    const before = await gitStatus(root);

    const r = runCli('code-health-apply.ts', [
      '--candidate',
      candidatePath,
      '--approval',
      approvalPath,
      '--root',
      root,
      '--mode',
      'patch',
      '--matrix',
      matrixPath,
      '--ledger',
      path.join(root, 'ledger.json'),
    ]);
    expect(r.code).toBe(0);
    const summary = jsonLine<{ applied: boolean; patchPath: string | null }>(r.stdout, 'APPLY_JSON');
    expect(summary?.applied).toBe(false);
    expect(summary?.patchPath).toMatch(/\.patch$/);
    expect((await fs.stat(path.join(root, summary?.patchPath as string))).isFile()).toBe(true);
    expect(await gitStatus(root)).toBe(before);
  }, 120_000);

  it('tracked-ledger commit deletes exactly the approved scope and rolls back', async () => {
    const root = await createTrackedRepo();
    const revision = (await revisionProvider.current(root)) as RevisionIdentity;
    const workDir = await tempRoot('code-health-duplicates-inputs-');
    const { candidate, approval } = abstractFixture(revision);
    const candidatePath = await writeJson(workDir, 'candidate.json', candidate);
    const approvalPath = await writeJson(workDir, 'approval.json', approval);
    const matrixPath = await writeJson(workDir, 'matrix.json', matrixDocument());

    const r = runCli('code-health-apply.ts', [
      '--candidate',
      candidatePath,
      '--approval',
      approvalPath,
      '--root',
      root,
      '--mode',
      'commit',
      '--matrix',
      matrixPath,
      '--ledger',
      path.join(root, 'ledger.json'),
    ]);
    expect(r.code).toBe(0);
    const summary = jsonLine<{
      applied: boolean;
      appliedFiles: string[];
      unrelatedFiles: string[];
      rollback: { patchPath: string; command: string };
    }>(r.stdout, 'APPLY_JSON');
    expect(summary?.applied).toBe(true);
    expect([...(summary?.appliedFiles ?? [])].sort()).toEqual([...SCOPE].sort());
    expect(summary?.unrelatedFiles).toEqual([]);
    const reverted = runSync('git', ['apply', '-R', path.join(root, summary?.rollback.patchPath as string)], {
      cwd: root,
      timeout: 30_000,
      env: GIT_ENV,
    });
    expect(reverted.status).toBe(0);
    expect((await git(root, ['diff', '--exit-code'])).code).toBe(0);
    expect(await gitStatus(root)).toBe('');
  }, 120_000);
});
