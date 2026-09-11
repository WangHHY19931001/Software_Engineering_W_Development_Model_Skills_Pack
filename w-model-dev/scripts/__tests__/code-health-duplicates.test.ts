/* eslint-disable security/detect-non-literal-fs-filename -- All filesystem paths are generated beneath test-owned temporary roots. */
/**
 * Task 6 acceptance: Phase 4 duplicate clustering + abstraction guard.
 *
 * Coverage:
 *   - fewer than two stable production call sites → deferred, and `proveAbstraction` reports
 *     `two stable production call sites`;
 *   - the equivalence proof is item-wise and default-deny: a security/lifecycle/error/platform
 *     difference is a violation, a test-only call site is `test-only`, and a quantified maintenance
 *     benefit is required (a shorter diff is not a benefit);
 *   - textual similarity / line count / mock similarity are structurally unable to authorize;
 *   - the pure module is re-exported from `code-health-ledger-logic.ts` (single source);
 *   - the CLI is read-only and fail-closed (exit 2 on bad input, exit 1 on a blocked cluster,
 *     exit 0 on deferred/under-review);
 *   - `code-health-apply.ts` refuses an `abstract` candidate without the Phase 4 proof and only
 *     produces its patch inside an isolated temporary git repository.
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
  proveAbstraction,
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

function authoritativeInput(): DuplicateInput {
  return {
    implementations: [
      { file: 'src/cache-a.ts', symbol: 'readCacheA', sourceHash: 'a'.repeat(64) },
      { file: 'src/cache-b.ts', symbol: 'readCacheB', sourceHash: 'b'.repeat(64) },
    ],
    ast: ['normalized conditional shape'],
    dataFlow: ['input key → cache lookup'],
    callGraph: [...SITES],
    tests: ['tests/cache-contract.test.ts'],
  };
}

function authority(overrides: Partial<DuplicateClusterAuthority> = {}): DuplicateClusterAuthority {
  return {
    candidateId: 'CHG-P4-20260907-901',
    phase: 'P4',
    action: 'abstract',
    approvedScope: [...SCOPE],
    declaredCallSites: [...SITES],
    declaredTests: ['tests/cache-contract.test.ts'],
    regressionCommands: [
      {
        command: 'node --test tests/cache-contract.test.ts',
        cwd: '.',
        environment: { NODE_ENV: 'test' },
        platform: 'linux',
        toolVersions: { node: '20.0.0' },
        startedAt: '2026-09-07T00:01:00.000Z',
        endedAt: '2026-09-07T00:01:01.000Z',
        exitCode: 0,
        observation: 'observed',
        rawOutputPath: '.w-model/code-health/raw/node-test.log',
        rawOutputSha256: 'd'.repeat(64),
      },
    ],
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

describe('Phase 4 cluster semantics (R3/R4)', () => {
  it('至少两种结构视图支持但少于两个稳定生产调用点 → deferred，且 guard 报 two stable production call sites', () => {
    const cluster = clusterDuplicates(
      authoritativeInput(),
      authority({ declaredCallSites: ['src/service-a.ts:load'] }),
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

  it('测试专用 helper 作为实现 → rejected（test-only 绝不授权）', () => {
    const cluster = clusterDuplicates(
      {
        ...authoritativeInput(),
        implementations: [
          { file: 'src/cache-a.ts', symbol: 'readCacheA', sourceHash: 'a'.repeat(64) },
          { file: 'tests/helper.ts', symbol: 'readCacheHelper', sourceHash: 'e'.repeat(64) },
        ],
      },
      authority({ declaredTests: ['tests/cache-contract.test.ts', 'tests/helper.ts'] }),
    );
    expect(cluster.status).toBe('rejected');
    expect(
      proveAbstraction(
        { ...cluster, equivalenceProof: { ...PROOF }, maintenanceBenefit: MAINTENANCE },
        equivalentProposal(),
      ),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/test-only/i)]));
  });

  it('少于两种结构视图（仅文本相似）→ deferred，且 guard 报 accidental', () => {
    const cluster = clusterDuplicates(
      { ...authoritativeInput(), ast: [], dataFlow: [], callGraph: [], tests: ['textual similarity is high'] },
      authority(),
    );
    expect(cluster.status).toBe('deferred');
    expect(
      proveAbstraction(
        { ...cluster, equivalenceProof: { ...PROOF }, maintenanceBenefit: MAINTENANCE },
        equivalentProposal(),
      ),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/accidental/i)]));
  });

  it('稳定调用点必须是 approved scope 内、非 test-only、且存在真实回归信号', () => {
    const outsideScope = clusterDuplicates(
      authoritativeInput(),
      authority({ approvedScope: ['src/cache-a.ts', 'src/cache-b.ts'] }),
    );
    expect(outsideScope.stableProductionCallSites).toEqual([]);
    expect(outsideScope.status).toBe('deferred');

    const testSite = clusterDuplicates(
      authoritativeInput(),
      authority({
        declaredCallSites: ['src/service-a.ts:load', 'tests/helper.ts:run'],
        approvedScope: [...SCOPE, 'tests/helper.ts'],
      }),
    );
    expect(testSite.stableProductionCallSites).toEqual(['src/service-a.ts:load']);

    const noRegression = clusterDuplicates(
      authoritativeInput(),
      authority({
        regressionCommands: [
          {
            ...authority().regressionCommands[0]!,
            observation: 'unavailable',
            exitCode: null,
          },
        ],
      }),
    );
    expect(noRegression.status).toBe('deferred');
  });

  it('重复/相同文件的调用点不构成两个独立稳定点', () => {
    const cluster = clusterDuplicates(
      authoritativeInput(),
      authority({ declaredCallSites: ['src/service-a.ts:load', 'src/service-a.ts:other', 'src/service-b.ts:load'] }),
    );
    expect(cluster.stableProductionCallSites).toHaveLength(2);
  });

  it('cluster 结果确定可重算，且不复制第二份实现（ledger 单一来源）', () => {
    const first = clusterDuplicates(authoritativeInput(), authority());
    const second = clusterDuplicates(authoritativeInput(), authority());
    expect(second).toEqual(first);
    expect(ledgerClusterDuplicates).toBe(clusterDuplicates);
    expect(ledgerProveAbstraction).toBe(proveAbstraction);
  });

  it('结构性非法输入 / authority fail-closed', () => {
    expect(validateDuplicateInput({})).not.toEqual([]);
    expect(validateDuplicateAuthority({})).not.toEqual([]);
    expect(() => clusterDuplicates({} as unknown as DuplicateInput, authority())).toThrow(/requires/i);
    expect(() => clusterDuplicates(authoritativeInput(), {} as unknown as DuplicateClusterAuthority)).toThrow(
      /ledger-recorded authority/i,
    );
  });
});

describe('Phase 4 abstraction guard: eleven item-wise dimensions (R4/R9)', () => {
  it('完整等价 proof + 可量化维护收益 → 无违规（唯一授权）', () => {
    expect(proveAbstraction(equivalentCluster(), equivalentProposal())).toEqual([]);
  });

  it('security 差异（different validation order）→ 含 security 违规', () => {
    const violations = proveAbstraction(
      equivalentCluster(),
      equivalentProposal({ security: 'different validation order' }),
    );
    expect(violations.some((entry) => entry.includes('security'))).toBe(true);
  });

  it('test-only 调用点（合同形状：路径放进 views.tests 与 stableProductionCallSites）→ 含 test-only', () => {
    const violations = proveAbstraction(
      equivalentCluster({
        views: { ...equivalentCluster().views, tests: ['tests/helper.ts'] },
        stableProductionCallSites: ['tests/helper.ts:run', 'src/service-b.ts:load'],
      }),
      equivalentProposal({ migratedCallSites: ['tests/helper.ts:run', 'src/service-b.ts:load'] }),
    );
    expect(violations).toEqual(expect.arrayContaining([expect.stringMatching(/test-only/i)]));
  });

  it('文本相似 / 短 diff / 少行数 / mock-fixture 相似不能授权', () => {
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

  it('platform / lifecycle 差异 → 不授权', () => {
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

  it('allDimensionsProven 单独声明不被信任；缺维度/负向声明均拒绝', () => {
    const proof = { ...PROOF, allDimensionsProven: true as const, security: '' };
    expect(proveAbstraction(equivalentCluster({ equivalenceProof: proof }), equivalentProposal())).toEqual(
      expect.arrayContaining([expect.stringMatching(/security/i)]),
    );
    const missing = equivalentCluster({
      equivalenceProof: undefined as unknown as DuplicateCluster['equivalenceProof'],
    });
    const violations = proveAbstraction(missing, equivalentProposal());
    expect(violations.length).toBeGreaterThan(0);
  });

  it('migratedCallSites 必须恰为最小稳定点集合；rollback 必须可执行', () => {
    expect(
      proveAbstraction(equivalentCluster(), equivalentProposal({ migratedCallSites: ['src/service-a.ts:load'] })),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/migrated/i)]));
    expect(
      proveAbstraction(equivalentCluster(), equivalentProposal({ rollback: { ...rollback('x'), executable: false } })),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/rollback/i)]));
  });

  it('结构化非法 cluster/proposal fail-closed（STRUCTURE_INVALID）', () => {
    expect(() => proveAbstraction({} as unknown as DuplicateCluster, equivalentProposal())).toThrow(/requires/i);
    expect(() => proveAbstraction(equivalentCluster(), {} as unknown as AbstractionProposal)).toThrow(/requires/i);
    expect(validateDuplicateCluster({})).not.toEqual([]);
  });
});

describe('Phase 4 duplicates CLI (R7)', () => {
  it('未知 flag / 缺 --matrix → exit 2 + ERROR_JSON', () => {
    const unknown = runCli('code-health-duplicates.ts', ['--bogus']);
    expect(unknown.code).toBe(2);
    expect(unknown.stdout).toContain('ERROR_JSON');
    const missing = runCli('code-health-duplicates.ts', []);
    expect(missing.code).toBe(2);
    expect(missing.stdout).toContain('ERROR_JSON');
  }, 120_000);

  it('每个 fixture class 的 exit code / status 与 self-test 声明一致', () => {
    const expectation: Array<[string, number, string, boolean]> = [
      ['valid-cluster.json', 0, 'under-review', true],
      ['deferred-one-site.json', 0, 'deferred', false],
      ['bad-test-only.json', 1, 'rejected', false],
      ['bad-platform-difference.json', 1, 'under-review', false],
      ['bad-error-mismatch.json', 1, 'under-review', false],
      ['bad-security-mismatch.json', 1, 'under-review', false],
      ['bad-lifecycle-mismatch.json', 1, 'under-review', false],
      ['bad-maintenance-only.json', 1, 'under-review', false],
    ];
    for (const [file, exitCode, status, authorized] of expectation) {
      const r = runCli('code-health-duplicates.ts', ['--matrix', path.join(SAMPLE_DIR, file), '--validate']);
      const summary = jsonLine<{ exitCode: number; status: string; authorized: boolean }>(r.stdout, 'DUPLICATES_JSON');
      expect({
        file,
        code: r.code,
        exitCode: summary?.exitCode,
        status: summary?.status,
        authorized: summary?.authorized,
      }).toEqual({
        file,
        code: exitCode,
        exitCode,
        status,
        authorized,
      });
    }
  }, 120_000);

  it('CLI 为只读：不写任何文件', async () => {
    const before = await gitStatus(REPO_ROOT);
    runCli('code-health-duplicates.ts', ['--matrix', path.join(SAMPLE_DIR, 'valid-cluster.json'), '--validate']);
    expect(await gitStatus(REPO_ROOT)).toBe(before);
  }, 120_000);
});

// -------------------- apply gate: abstract 必须携带 Phase 4 proof，且只在隔离仓库产生 patch --------------------

interface ApplyFixture {
  candidate: CodeHealthCandidate;
  approval: ApprovalDecision;
}

let validFixture: { candidate: CodeHealthCandidate; approval: ApprovalDecision };

beforeAll(async () => {
  const raw = JSON.parse(
    await fs.readFile(path.join(REPO_ROOT, 'w-model-dev/scripts/samples/code-health/apply/valid-patch.json'), 'utf8'),
  ) as ApplyFixture;
  validFixture = raw;
});

async function createAbstractRepository(): Promise<string> {
  const root = await tempRoot('code-health-duplicates-repo-');
  await git(root, ['init', '--quiet']);
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'cache-a.ts'), 'export const readCacheA = 1;\n');
  await fs.writeFile(path.join(root, 'src', 'cache-b.ts'), 'export const readCacheB = 1;\n');
  await fs.writeFile(path.join(root, 'src', 'service-a.ts'), 'export const load = 1;\n');
  await fs.writeFile(path.join(root, 'src', 'service-b.ts'), 'export const load = 1;\n');
  await fs.writeFile(path.join(root, 'src', 'cache-service.ts'), 'export const readCache = 1;\n');
  await fs.writeFile(path.join(root, '.gitignore'), '.w-model/\n');
  await git(root, ['add', '--all']);
  await git(root, ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'initial']);
  return root;
}

/** A candidate + approval for the abstraction scope, bound to the isolated repository revision. */
function abstractFixture(revision: RevisionIdentity): {
  candidate: CodeHealthCandidate;
  approval: ApprovalDecision;
} {
  const candidate: CodeHealthCandidate = structuredClone(validFixture.candidate);
  candidate.candidateId = 'CHG-P4-20260907-901';
  candidate.phase = 'P4';
  candidate.action = 'abstract';
  candidate.files = [...SCOPE];
  candidate.symbols = ['readCacheA', 'readCacheB'];
  candidate.tests = [];
  candidate.callSites = [...SITES];
  candidate.changeScope = {
    files: [...SCOPE],
    symbols: ['readCacheA', 'readCacheB', 'readCache'],
    scopeHash: candidate.changeScope.scopeHash,
  };
  candidate.revision = revision;
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
    ...(validFixture.approval as ApprovalDecision),
    candidateId: candidate.candidateId,
    approvedAction: 'abstract',
    approvedFiles: [...SCOPE],
    approvedSymbols: candidate.changeScope.symbols,
    scopeHash: candidate.changeScope.scopeHash,
    revision,
  };
  return { candidate, approval };
}

describe('code-health-apply abstract guard (R6/R7)', () => {
  it('无 --cluster/--proposal 的 abstract candidate → exit 1 且工作树不变', async () => {
    const root = await createAbstractRepository();
    const revision = (await revisionProvider.current(root)) as RevisionIdentity;
    const workDir = await tempRoot('code-health-duplicates-inputs-');
    const { candidate, approval } = abstractFixture(revision);
    const candidatePath = await writeJson(workDir, 'candidate.json', candidate);
    const approvalPath = await writeJson(workDir, 'approval.json', approval);
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
    ]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('abstraction requires a validated Phase 4 proof');
    expect(await gitStatus(root)).toBe(before);
    expect((await fs.stat(path.join(root, 'src', 'cache-a.ts'))).isFile()).toBe(true);
  }, 120_000);

  it('cluster 来自其他 candidate / 稳定点在 approved scope 之外 → exit 1（伪造 scope fail-closed）', async () => {
    const root = await createAbstractRepository();
    const revision = (await revisionProvider.current(root)) as RevisionIdentity;
    const workDir = await tempRoot('code-health-duplicates-inputs-');
    const { candidate, approval } = abstractFixture(revision);
    const candidatePath = await writeJson(workDir, 'candidate.json', candidate);
    const approvalPath = await writeJson(workDir, 'approval.json', approval);

    const forgedCluster = {
      ...equivalentCluster(),
      candidateId: 'CHG-P4-20260907-999',
      stableProductionCallSites: ['src/service-a.ts:load', 'src/other/outside.ts:load'],
    };
    const clusterPath = await writeJson(workDir, 'cluster.json', forgedCluster);
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
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('abstraction requires a validated Phase 4 proof');
  }, 120_000);

  it('完整 Phase 4 proof → 只在隔离仓库生成受控 patch，工作树不变', async () => {
    const root = await createAbstractRepository();
    const revision = (await revisionProvider.current(root)) as RevisionIdentity;
    const workDir = await tempRoot('code-health-duplicates-inputs-');
    const { candidate, approval } = abstractFixture(revision);
    const candidatePath = await writeJson(workDir, 'candidate.json', candidate);
    const approvalPath = await writeJson(workDir, 'approval.json', approval);
    const clusterPath = await writeJson(workDir, 'cluster.json', equivalentCluster());
    const proposalPath = await writeJson(workDir, 'proposal.json', equivalentProposal());
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
      '--cluster',
      clusterPath,
      '--proposal',
      proposalPath,
    ]);
    expect(r.code).toBe(0);
    const summary = jsonLine<{ applied: boolean; patchPath: string | null; rollback: { executable: boolean } | null }>(
      r.stdout,
      'APPLY_JSON',
    );
    expect(summary?.applied).toBe(false);
    expect(summary?.patchPath).toMatch(/\.patch$/);
    expect((await fs.stat(path.join(root, summary?.patchPath as string))).isFile()).toBe(true);
    expect(await gitStatus(root)).toBe(before);
  }, 120_000);

  it('完整 Phase 4 proof 的 commit 只删除 exact scope，并可回滚', async () => {
    const root = await createAbstractRepository();
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
      'commit',
      '--cluster',
      clusterPath,
      '--proposal',
      proposalPath,
    ]);
    expect(r.code).toBe(0);
    const summary = jsonLine<{
      applied: boolean;
      appliedFiles: string[];
      unrelatedFiles: string[];
      rollback: { patchPath: string };
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
