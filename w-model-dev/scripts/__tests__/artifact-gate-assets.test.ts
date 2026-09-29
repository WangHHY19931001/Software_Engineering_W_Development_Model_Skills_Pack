/**
 * artifact-gate-assets.test.ts —— application/artifact-gate-assets.ts 资产读取/校验层单元测试
 *
 * 覆盖：
 *   - discoverGraphAsset：graph.json → consolidated-phaseN 优先级回退 / 非法 JSON 告警回退 / 无资产
 *   - readTlaManifest：specs 非空 / 空 / ENOENT 三态
 *   - readBddManifest：合法 / schema 失败 / feature 文件缺失 / ENOENT + phase>=4 强制
 *   - runModelChecks：mock spawnSync 验证 TLA+/BDD 子进程调用与退出码违反（CLI 集成侧由 pre-push 第 3/7/8 项覆盖）
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { spawnSyncMock } = vi.hoisted(() => ({ spawnSyncMock: vi.fn() }));
vi.mock('node:child_process', () => ({ spawnSync: spawnSyncMock }));

import { checkTlaBddSync } from '../logic/tla-bdd-sync-logic.js';
import { EXEC_LIMITS } from '../lib/constants.js';
import {
  buildTlaBddSyncPairs,
  discoverGraphAsset,
  isProjectTlaBddEvidencePhase,
  isTlaBddSyncContractPhase,
  readTlaManifest,
  readBddManifest,
  readCucumberReport,
  runModelChecks,
} from '../application/artifact-gate-assets.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gate-assets-test-'));
  spawnSyncMock.mockReset();
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function makeBddManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: '1.0',
    projectId: 'test-project',
    basePath: '.',
    currentPhase: 1,
    features: [
      {
        id: 'F1',
        level: 1,
        filePath: 'exists.feature',
        scenarioCount: 1,
        stateMachineId: 'SM1',
        tlaSpecId: 't1',
        reqIds: ['REQ-001'],
        designIds: ['SD-3.2.1'],
        parentFeatureIds: [],
        siblingFeatureIds: [],
        childFeatureIds: [],
      },
    ],
    stateMachines: [
      {
        id: 'SM1',
        level: 1,
        states: ['S1', 'S2'],
        initialState: 'S1',
        terminalStates: ['S2'],
        acceptingStates: ['S2'],
        rejectingStates: [],
        transitions: [{ from: 'S1', event: 'go', to: 'S2' }],
        invariants: ['S2 => ok'],
      },
    ],
    ...overrides,
  };
}

describe('discoverGraphAsset', () => {
  it('graph.json 优先于 consolidated-phaseN', async () => {
    await fs.writeFile(path.join(tmpDir, 'graph.json'), JSON.stringify({ nodes: [{ id: 'REQ-1' }] }), 'utf-8');
    await fs.writeFile(
      path.join(tmpDir, 'consolidated-phase4.json'),
      JSON.stringify({ nodes: [{ id: 'REQ-2' }] }),
      'utf-8',
    );
    const r = await discoverGraphAsset(tmpDir);
    expect(r.graphSource).toBe('graph.json');
    expect(r.graph?.nodes).toHaveLength(1);
  });

  it('无 graph.json 时回退到 consolidated-phaseN（按 4→1 优先级）', async () => {
    await fs.writeFile(path.join(tmpDir, 'consolidated-phase1.json'), JSON.stringify({ nodes: [] }), 'utf-8');
    await fs.writeFile(
      path.join(tmpDir, 'consolidated-phase3.json'),
      JSON.stringify({ nodes: [{ id: 'REQ-3' }] }),
      'utf-8',
    );
    const r = await discoverGraphAsset(tmpDir);
    expect(r.graphSource).toBe('consolidated-phase3.json');
  });

  it('候选 JSON 非法 → 告警并继续回退（首个合法含 nodes 者胜出）', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await fs.writeFile(path.join(tmpDir, 'graph.json'), '{not json', 'utf-8');
    await fs.writeFile(
      path.join(tmpDir, 'consolidated-phase2.json'),
      JSON.stringify({ nodes: [{ id: 'REQ-2' }] }),
      'utf-8',
    );
    const r = await discoverGraphAsset(tmpDir);
    expect(r.graphSource).toBe('consolidated-phase2.json');
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('graph.json 读取失败'));
    errSpy.mockRestore();
  });

  it('解析成功但无 nodes 数组 → 继续回退；全无 → 空结果', async () => {
    await fs.writeFile(path.join(tmpDir, 'graph.json'), JSON.stringify({ foo: 1 }), 'utf-8');
    const r = await discoverGraphAsset(tmpDir);
    expect(r.graph).toBeUndefined();
    expect(r.graphSource).toBe('');
  });
});

describe('readTlaManifest', () => {
  it('specs 非空且 schema 合法 → valid', async () => {
    const f = path.join(tmpDir, 'tla-manifest.json');
    await fs.writeFile(
      f,
      JSON.stringify({
        version: 1,
        currentPhase: 1,
        basePath: '.',
        tools: { jarPath: 'tla2tools.jar', javaMinVersion: 11 },
        specs: [
          {
            id: 'L1-test',
            level: 'L1',
            phase: 1,
            system: 'test',
            requirementIds: ['REQ-1'],
            designRef: 'docs/design.md',
            tlaPath: 'test.tla',
            cfgPath: 'test.cfg',
            parent: null,
            siblings: [],
            children: [],
            variableCombination: 1,
            decompositionDecision: 'kept-below-threshold',
            syntaxChecked: true,
            tlcChecked: true,
            deadlockFree: true,
            invariantsHold: true,
            stateExplosion: false,
          },
        ],
      }),
      'utf-8',
    );
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test assets are created beneath the mkdtemp-owned tmpDir
    await fs.writeFile(path.join(tmpDir, 'test.tla'), '---- MODULE test ----', 'utf-8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test assets are created beneath the mkdtemp-owned tmpDir
    await fs.writeFile(path.join(tmpDir, 'test.cfg'), 'SPECIFICATION Spec', 'utf-8');
    expect(await readTlaManifest(f)).toMatchObject({ valid: true, exists: true });
  });

  it('schema-valid manifest with missing TLA/Cfg assets fails closed', async () => {
    const f = path.join(tmpDir, 'tla-manifest.json');
    await fs.writeFile(
      f,
      JSON.stringify({
        version: 1,
        currentPhase: 1,
        basePath: '.',
        tools: { jarPath: 'tla2tools.jar', javaMinVersion: 11 },
        specs: [
          {
            id: 'L1-test',
            level: 'L1',
            phase: 1,
            system: 'test',
            requirementIds: ['REQ-1'],
            designRef: 'docs/design.md',
            tlaPath: 'missing.tla',
            cfgPath: 'missing.cfg',
            parent: null,
            siblings: [],
            children: [],
            variableCombination: 1,
            decompositionDecision: 'kept-below-threshold',
            syntaxChecked: true,
            tlcChecked: true,
            deadlockFree: true,
            invariantsHold: true,
            stateExplosion: false,
          },
        ],
      }),
      'utf-8',
    );
    const result = await readTlaManifest(f);
    expect(result.valid).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('[artifact:tla] tla asset missing'),
        expect.stringContaining('[artifact:tla] cfg asset missing'),
      ]),
    );
  });

  it('fails closed for invalid TLA manifest（3 态：empty specs/schema-invalid/invalid JSON）', async () => {
    const cases = [
      [
        'empty specs',
        JSON.stringify({
          version: 1,
          currentPhase: 1,
          basePath: '.',
          tools: { jarPath: 'j', javaMinVersion: 11 },
          specs: [],
        }),
      ],
      ['schema-invalid object', JSON.stringify({ specs: [{ id: 'L1' }] })],
      ['invalid JSON', '{not json'],
    ] as const;
    for (const [label, value] of cases) {
      const f = path.join(tmpDir, 'tla-manifest.json');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- f is derived from the mkdtemp-owned tmpDir
      await fs.writeFile(f, value, 'utf-8');
      const result = await readTlaManifest(f);
      expect(result.exists, `${label} 应报存在`).toBe(true);
      expect(result.valid, `${label} 应 fail-closed`).toBe(false);
      expect(result.violations.length, `${label} 应有 violations`).toBeGreaterThan(0);
    }
  });

  it('ENOENT → missing invalid result', async () => {
    const result = await readTlaManifest(path.join(tmpDir, 'nope.json'));
    expect(result).toMatchObject({ exists: false, valid: false });
    expect(result.violations.length).toBeGreaterThan(0);
  });
});

describe('readBddManifest', () => {
  it('合法 manifest + feature 文件存在 + SM 七要素齐 → 零 violation（通过行）', async () => {
    const f = path.join(tmpDir, 'bdd-manifest.json');
    await fs.writeFile(f, JSON.stringify(makeBddManifest()), 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'exists.feature'), '# Feature: x', 'utf-8');
    const r = await readBddManifest(f, tmpDir, 4);
    expect(r.bddManifestExists).toBe(true);
    expect(r.bddViolations).toHaveLength(0);
  });

  it('BDD manifest 负例（4 态：schema 失败/空 features/feature 缺失/JSON 非法）', async () => {
    type BddResult = Awaited<ReturnType<typeof readBddManifest>>;
    const cases: {
      label: string;
      run: () => Promise<BddResult>;
      verify: (r: BddResult, label: string) => void;
    }[] = [
      {
        label: 'schema 失败',
        run: async () => {
          const f = path.join(tmpDir, 'bdd-manifest.json');
          await fs.writeFile(f, JSON.stringify({ schemaVersion: '1.0' }), 'utf-8');
          return readBddManifest(f, tmpDir, 4);
        },
        verify: (r, label) => {
          expect(
            r.bddViolations.some((v) => v.includes('[artifact:bdd] manifest schema failed')),
            `${label} 应报 manifest schema failed`,
          ).toBe(true);
        },
      },
      {
        label: 'schema-valid manifest with empty features or state machines',
        run: async () => {
          const f = path.join(tmpDir, 'bdd-manifest.json');
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- f is derived from the mkdtemp-owned tmpDir
          await fs.writeFile(f, JSON.stringify(makeBddManifest({ features: [], stateMachines: [] })), 'utf-8');
          return readBddManifest(f, tmpDir, 1);
        },
        verify: (r, label) => {
          expect(r.bddManifestValid, `${label} 应 invalid`).toBe(false);
          expect(r.bddViolations, `${label} 应含两条空集合 violation`).toEqual(
            expect.arrayContaining([
              '[artifact:bdd] manifest features must not be empty',
              '[artifact:bdd] manifest stateMachines must not be empty',
            ]),
          );
        },
      },
      {
        label: 'feature 文件缺失',
        run: async () => {
          const f = path.join(tmpDir, 'bdd-manifest.json');
          await fs.writeFile(f, JSON.stringify(makeBddManifest()), 'utf-8');
          return readBddManifest(f, tmpDir, 4);
        },
        verify: (r, label) => {
          expect(
            r.bddViolations.some((v) => v.includes('feature file missing: exists.feature')),
            `${label} 应报 feature file missing`,
          ).toBe(true);
        },
      },
      {
        label: 'JSON 非法（保留存在性并产生 parse violation）',
        run: async () => {
          const f = path.join(tmpDir, 'bdd-manifest.json');
          await fs.writeFile(f, '{not json', 'utf-8');
          return readBddManifest(f, tmpDir, 4);
        },
        verify: (r, label) => {
          expect(r.bddManifestExists, `${label} 应保留存在性`).toBe(true);
          expect(r.bddManifestValid, `${label} 应 invalid`).toBe(false);
          expect(
            r.bddViolations.some((v) => v.includes('manifest JSON parse failed')),
            `${label} 应报 parse failed`,
          ).toBe(true);
        },
      },
    ];
    for (const c of cases) {
      c.verify(await c.run(), c.label);
    }
  });

  it('BDD manifest 缺失在 phase 1-8 均产生 blocking violation', async () => {
    const missing = path.join(tmpDir, 'nope-bdd.json');
    const r4 = await readBddManifest(missing, tmpDir, 4);
    expect(r4.bddManifestExists).toBe(false);
    expect(r4.bddViolations.some((v) => v.includes('bdd-manifest.json missing'))).toBe(true);
    expect(r4.bddViolations.some((v) => v.includes('required for project phases 1-8'))).toBe(true);

    const r1 = await readBddManifest(missing, tmpDir, 1);
    expect(r1.bddViolations.length).toBeGreaterThan(0);
  });
});

describe('readCucumberReport', () => {
  it('fails closed for invalid Cucumber evidence（7 态）', async () => {
    const cases = [
      ['missing', undefined],
      ['invalid JSON', '{not json'],
      ['wrong shape', JSON.stringify({ scenarios: [] })],
      ['empty execution', JSON.stringify({ elements: [] })],
      [
        'skipped step',
        JSON.stringify({ elements: [{ name: 'scenario', steps: [{ result: { status: 'skipped' } }] }] }),
      ],
      [
        'unknown status',
        JSON.stringify({ elements: [{ name: 'scenario', steps: [{ result: { status: 'unknown' } }] }] }),
      ],
      ['failed step', JSON.stringify({ elements: [{ name: 'scenario', steps: [{ result: { status: 'failed' } }] }] })],
    ] as const;
    for (const [label, value] of cases) {
      const report = path.join(tmpDir, 'cucumber-report.json');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- report is derived from the mkdtemp-owned tmpDir
      if (value === undefined) {
        // 每迭代自备 fixture：missing 态须清除前序迭代落盘的报告
        await fs.rm(report, { force: true });
      } else {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- report 派生自 mkdtemp 临时目录，value 为用例内字面量 fixture，非用户输入
        await fs.writeFile(report, value, 'utf-8');
      }
      const result = await readCucumberReport(report, true);
      expect(result.cucumberReportValid, `${label} 应 fail-closed`).toBe(false);
      expect(result.cucumberViolations.length, `${label} 应有 violations`).toBeGreaterThan(0);
    }
  });

  it('accepts a named scenario with a passed step as execution evidence', async () => {
    const report = path.join(tmpDir, 'cucumber-report.json');
    await fs.writeFile(
      report,
      JSON.stringify({ elements: [{ name: 'scenario', steps: [{ result: { status: 'passed' } }] }] }),
      'utf-8',
    );
    await expect(readCucumberReport(report, true)).resolves.toMatchObject({
      cucumberReportExists: true,
      cucumberReportValid: true,
      cucumberViolations: [],
    });
  });
});

describe('buildTlaBddSyncPairs', () => {
  it('blocks an orphan TLA spec instead of checking only BDD-to-TLA mappings', () => {
    const result = buildTlaBddSyncPairs({
      tlaManifest: {
        basePath: '.',
        specs: [
          { id: 'paired', tlaPath: 'paired.tla' },
          { id: 'orphan', tlaPath: 'orphan.tla' },
        ],
      },
      bddManifest: {
        basePath: '.',
        features: [{ id: 'feature-paired', tlaSpecId: 'paired', filePath: 'paired.feature' }],
      },
      manifestFile: path.join(tmpDir, '.w-model', 'tla-manifest.json'),
      projectDir: tmpDir,
    });

    expect(result.syncPairs).toHaveLength(1);
    expect(result.syncPairViolations).toContain(
      '[artifact:tla-bdd-sync] TLA+ spec "orphan" has no matching BDD feature',
    );
    expect(result.pairCoverageValid).toBe(false);
  });
});

describe('TLA↔BDD sync contract phase matrix', () => {
  it('uses required TLA/BDD project evidence for phases 1-4（4 相位）', () => {
    for (const phase of [1, 2, 3, 4] as const) {
      expect(isProjectTlaBddEvidencePhase(phase), `phase=${phase}`).toBe(true);
    }
  });

  it('does not use TLA/BDD project evidence for phases 5-8（Cucumber 证据相位，4 相位）', () => {
    for (const phase of [5, 6, 7, 8] as const) {
      expect(isProjectTlaBddEvidencePhase(phase), `phase=${phase}`).toBe(false);
    }
  });

  it('enables independent sync for phases 1-4（4 相位）', () => {
    for (const phase of [1, 2, 3, 4] as const) {
      expect(isTlaBddSyncContractPhase(phase), `phase=${phase}`).toBe(true);
    }
  });

  it('disables independent sync for phase 5', () => {
    expect(isTlaBddSyncContractPhase(5)).toBe(false);
  });

  it('does not invoke independent sync in phase 5 even when a pair is supplied', () => {
    spawnSyncMock.mockReturnValue({ status: 0, stdout: '' });
    const violations = runModelChecks({
      manifestExists: true,
      manifestValid: true,
      effectivePhase: 5,
      graphPath: 'g.json',
      manifestFile: 'm.json',
      bddManifestExists: true,
      bddManifestValid: true,
      bddManifestFile: 'b.json',
      syncRequired: true,
      syncPairCoverageValid: true,
      syncPairs: [{ tlaFile: 'spec.tla', featureFile: 'feature.feature' }],
    });

    expect(violations).toHaveLength(0);
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock.mock.calls[0]?.[1]).not.toEqual(
      expect.arrayContaining([expect.stringContaining('check-tla-bdd-sync.ts')]),
    );
  });

  it('runs sync for phases 1-4 only with complete pair coverage（4 相位，每相位重建 mock fixture）', () => {
    for (const phase of [1, 2, 3, 4] as const) {
      spawnSyncMock.mockReset();
      spawnSyncMock.mockReturnValue({ status: 0, stdout: '' });
      const violations = runModelChecks({
        manifestExists: true,
        manifestValid: true,
        effectivePhase: phase,
        graphPath: phase === 1 ? '' : 'g.json',
        manifestFile: 'm.json',
        bddManifestExists: true,
        bddManifestValid: true,
        bddManifestFile: 'b.json',
        syncRequired: true,
        syncPairCoverageValid: true,
        syncPairs: [{ tlaFile: 'spec.tla', featureFile: 'feature.feature' }],
      });

      expect(violations, `phase=${phase} 应零 violation`).toHaveLength(0);
      expect(spawnSyncMock, `phase=${phase} 应调用 3 个子进程`).toHaveBeenCalledTimes(3);
      expect(spawnSyncMock.mock.calls[2]?.[1], `phase=${phase} 第三调应含 sync 入口与 pair 文件`).toEqual(
        expect.arrayContaining([expect.stringContaining('check-tla-bdd-sync.ts'), 'spec.tla', 'feature.feature']),
      );
    }
  });

  it('accepts a real complete TLA/BDD pair for phases 1-4（4 相位，每相位自备 fixture 文件）', async () => {
    for (const phase of [1, 2, 3, 4] as const) {
      const tlaFile = path.join(tmpDir, `paired-phase${phase}.tla`);
      const featureFile = path.join(tmpDir, `paired-phase${phase}.feature`);
      await fs.writeFile(
        tlaFile,
        `EXTENDS Naturals\nVARIABLES state\nInit == state = "idle"\nNext == \\/ Login \\/ Logout\nLogin == state = "idle" /\\ state' = "active"\nLogout == state = "active" /\\ state' = "idle"\nTypeInvariant == state \\in {"idle", "active"}`,
        'utf-8',
      );
      await fs.writeFile(
        featureFile,
        `Feature: Test\nBackground:\n  Given initial state\n  When Login\n  When Logout\n  Then TypeInvariant`,
        'utf-8',
      );

      const pairResult = buildTlaBddSyncPairs({
        tlaManifest: { basePath: '.', specs: [{ id: 'paired', tlaPath: `paired-phase${phase}.tla` }] },
        bddManifest: {
          basePath: '.',
          features: [{ id: 'feature-paired', tlaSpecId: 'paired', filePath: `paired-phase${phase}.feature` }],
        },
        manifestFile: path.join(tmpDir, 'tla-manifest.json'),
        projectDir: tmpDir,
      });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- both files are created beneath the mkdtemp-owned tmpDir
      const syncResult = checkTlaBddSync(await fs.readFile(tlaFile, 'utf-8'), await fs.readFile(featureFile, 'utf-8'));

      expect(isTlaBddSyncContractPhase(phase), `phase=${phase} 应为 sync 契约相位`).toBe(true);
      expect(pairResult, `phase=${phase} pair 覆盖应完整`).toMatchObject({
        pairCoverageValid: true,
        syncPairs: [{ tlaFile, featureFile }],
      });
      expect(syncResult, `phase=${phase} TLA↔BDD 内容同步应通过`).toMatchObject({ passed: true, violations: [] });
    }
  });

  it('does not treat incomplete pair coverage as sync success', () => {
    spawnSyncMock.mockReturnValue({ status: 0, stdout: '' });
    const violations = runModelChecks({
      manifestExists: true,
      manifestValid: true,
      effectivePhase: 1,
      graphPath: '',
      manifestFile: 'm.json',
      bddManifestExists: true,
      bddManifestValid: true,
      bddManifestFile: 'b.json',
      syncRequired: true,
      syncPairCoverageValid: false,
      syncPairs: [{ tlaFile: 'spec.tla', featureFile: 'feature.feature' }],
      syncPairViolations: ['[artifact:tla-bdd-sync] incomplete bidirectional pair coverage'],
    });

    expect(violations).toContain('[artifact:tla-bdd-sync] incomplete bidirectional pair coverage');
    expect(spawnSyncMock).toHaveBeenCalledTimes(2);
  });

  it('fails closed on missing sync assets for phases 1-4（4 相位，每相位重建 mock fixture）', () => {
    for (const phase of [1, 2, 3, 4] as const) {
      spawnSyncMock.mockReset();
      spawnSyncMock.mockReturnValue({ status: 0, stdout: '' });
      const violations = runModelChecks({
        manifestExists: false,
        manifestValid: false,
        effectivePhase: phase,
        graphPath: phase === 1 ? '' : 'g.json',
        manifestFile: 'missing-tla.json',
        bddManifestExists: false,
        bddManifestValid: false,
        bddManifestFile: 'missing-bdd.json',
        syncRequired: true,
      });

      expect(violations, `phase=${phase} 应报资产缺失`).toContain(
        '[artifact:tla-bdd-sync] required TLA+/BDD sync assets are invalid',
      );
      expect(spawnSyncMock, `phase=${phase} 不应调用子进程`).not.toHaveBeenCalled();
    }
  });
});

describe('runModelChecks', () => {
  it('invalid or graph-less project evidence does not silently invoke model checks', () => {
    expect(
      runModelChecks({
        manifestExists: false,
        manifestValid: false,
        effectivePhase: 2,
        graphPath: 'g',
        manifestFile: 'm',
        bddManifestExists: false,
        bddManifestValid: false,
        bddManifestFile: 'b',
      }),
    ).toHaveLength(0);
    expect(
      runModelChecks({
        manifestExists: true,
        manifestValid: true,
        effectivePhase: 2,
        graphPath: '',
        manifestFile: 'm',
        bddManifestExists: false,
        bddManifestFile: 'b',
      }),
    ).toContain('[artifact:graph] graph asset is required for project phase 2-4');
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it('阶段证据对照对（2 态：phase1 TLA 证据 flag / phase5 Cucumber 证据 flag）', () => {
    type ModelCheckOpts = Parameters<typeof runModelChecks>[0];
    const cases: {
      label: string;
      opts: ModelCheckOpts;
      verify: (v: string[], label: string) => void;
    }[] = [
      {
        label: 'phase 1 无 graph 传 required TLA 证据 flag',
        opts: {
          manifestExists: true,
          effectivePhase: 1,
          graphPath: '',
          manifestFile: 'm.json',
          bddManifestExists: true,
          bddManifestFile: 'b.json',
        },
        verify: (v, label) => {
          expect(v, `${label} 应零 violation`).toHaveLength(0);
          expect(spawnSyncMock, `${label} 应调用 2 个子进程`).toHaveBeenCalledTimes(2);
          const bddArgs = spawnSyncMock.mock.calls[1]?.[1] as string[];
          expect(bddArgs, `${label} bdd 参数`).toEqual(
            expect.arrayContaining(['--require-tla-equivalence', '--tla-manifest=m.json']),
          );
          expect(bddArgs, `${label} 不应传 --graph=`).not.toContain('--graph=');
        },
      },
      {
        label: 'phase 5 传 required Cucumber 证据 flag',
        opts: {
          manifestExists: true,
          effectivePhase: 5,
          graphPath: 'g.json',
          manifestFile: 'm.json',
          bddManifestExists: true,
          bddManifestFile: 'b.json',
          cucumberReportFile: 'reports/cucumber.json',
        },
        verify: (v, label) => {
          expect(v, `${label} 应零 violation`).toHaveLength(0);
          const bddArgs = spawnSyncMock.mock.calls.find(([, args]) =>
            (args as string[])[2]?.endsWith('check-bdd-model.ts'),
          )?.[1] as string[];
          expect(bddArgs, `${label} bdd 参数`).toEqual(
            expect.arrayContaining(['--require-cucumber-report', '--cucumber-report=reports/cucumber.json']),
          );
        },
      },
    ];
    for (const c of cases) {
      spawnSyncMock.mockReset();
      spawnSyncMock.mockReturnValue({ status: 0, stdout: '' });
      c.verify(runModelChecks(c.opts), c.label);
    }
  });

  it('TLA+ 与 BDD 子进程均退出 0 → 零 violation，并经受控 helper 传递实际 CLI 入口和进程级边界', async () => {
    spawnSyncMock.mockReturnValue({ status: 0, stdout: '' });
    const v = runModelChecks({
      manifestExists: true,
      effectivePhase: 2,
      graphPath: 'g.json',
      manifestFile: 'm.json',
      bddManifestExists: true,
      bddManifestFile: 'b.json',
    });
    expect(v).toHaveLength(0);
    expect(spawnSyncMock).toHaveBeenCalledTimes(2);

    const scriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const expectedEntries = [
      path.join(scriptsDir, 'cli', 'check-tla-model.ts'),
      path.join(scriptsDir, 'cli', 'check-bdd-model.ts'),
    ];
    const actualEntries = spawnSyncMock.mock.calls.map(([, args]) => args[2]);
    expect(actualEntries).toEqual(expectedEntries);
    for (const entry of actualEntries) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Assert the application resolves repository-owned CLI entry files.
      await expect(fs.access(entry)).resolves.toBeUndefined();
    }
    for (const [, , options] of spawnSyncMock.mock.calls) {
      expect(options).toMatchObject({
        timeout: EXEC_LIMITS.modelCheckChildTimeoutMs,
        killSignal: 'SIGKILL',
        encoding: 'utf-8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }
  });

  it('子进程退出码非 0 → 违反（2 态：TLA [artifact:tla-model] / BDD [artifact:bdd-model]）', () => {
    type ModelCheckOpts = Parameters<typeof runModelChecks>[0];
    const cases: {
      label: string;
      mock: () => void;
      opts: ModelCheckOpts;
      verify: (v: string[], label: string) => void;
    }[] = [
      {
        label: 'TLA+ 子进程退出码非 0（含 stdout 末尾摘要）',
        mock: () => spawnSyncMock.mockReturnValue({ status: 1, stdout: 'line1\nline2\nline3\nline4\nline5\nline6' }),
        opts: {
          manifestExists: true,
          effectivePhase: 2,
          graphPath: 'g.json',
          manifestFile: 'm.json',
          bddManifestExists: false,
          bddManifestFile: 'b.json',
        },
        verify: (v, label) => {
          expect(v, `${label} 应恰 1 条 violation`).toHaveLength(1);
          expect(v[0], `${label} 违规码`).toContain('[artifact:tla-model] check-tla-model 退出码 1');
          expect(v[0], `${label} 应含 stdout 末尾摘要`).toContain('line6');
        },
      },
      {
        label: 'BDD 子进程退出码非 0',
        mock: () =>
          spawnSyncMock
            .mockReturnValueOnce({ status: 0, stdout: '' })
            .mockReturnValueOnce({ status: 2, stdout: 'bdd error' }),
        opts: {
          manifestExists: true,
          effectivePhase: 2,
          graphPath: 'g.json',
          manifestFile: 'm.json',
          bddManifestExists: true,
          bddManifestFile: 'b.json',
        },
        verify: (v, label) => {
          expect(v, `${label} 应恰 1 条 violation`).toHaveLength(1);
          expect(v[0], `${label} 违规码`).toContain('[artifact:bdd-model] check-bdd-model 退出码 2');
        },
      },
    ];
    for (const c of cases) {
      spawnSyncMock.mockReset();
      c.mock();
      c.verify(runModelChecks(c.opts), c.label);
    }
  });

  it('required TLA↔BDD sync mismatch blocks the project gate', () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: '' })
      .mockReturnValueOnce({ status: 0, stdout: '' })
      .mockReturnValueOnce({ status: 1, stdout: 'transition mismatch' });
    const v = runModelChecks({
      manifestExists: true,
      manifestValid: true,
      effectivePhase: 1,
      graphPath: '',
      manifestFile: 'm.json',
      bddManifestExists: true,
      bddManifestValid: true,
      bddManifestFile: 'b.json',
      syncRequired: true,
      syncPairCoverageValid: true,
      syncPairs: [{ tlaFile: 'spec.tla', featureFile: 'feature.feature' }],
    });
    expect(v).toEqual(
      expect.arrayContaining([expect.stringContaining('[artifact:tla-bdd-sync] check-tla-bdd-sync 退出码 1')]),
    );
  });

  it('required TLA↔BDD sync invocation failure blocks the project gate', () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: '' })
      .mockReturnValueOnce({ status: 0, stdout: '' })
      .mockReturnValueOnce(undefined);
    const v = runModelChecks({
      manifestExists: true,
      manifestValid: true,
      effectivePhase: 1,
      graphPath: '',
      manifestFile: 'm.json',
      bddManifestExists: true,
      bddManifestValid: true,
      bddManifestFile: 'b.json',
      syncRequired: true,
      syncPairCoverageValid: true,
      syncPairs: [{ tlaFile: 'spec.tla', featureFile: 'feature.feature' }],
    });
    expect(v).toEqual(
      expect.arrayContaining([expect.stringContaining('[artifact:tla-bdd-sync] check-tla-bdd-sync 退出码 unknown')]),
    );
  });

  it('does not run optional sync when the project contract does not require it', () => {
    spawnSyncMock.mockReturnValue({ status: 0, stdout: '' });
    const v = runModelChecks({
      manifestExists: true,
      manifestValid: true,
      effectivePhase: 1,
      graphPath: '',
      manifestFile: 'm.json',
      bddManifestExists: true,
      bddManifestValid: true,
      bddManifestFile: 'b.json',
      syncRequired: false,
      syncPairs: [{ tlaFile: 'spec.tla', featureFile: 'feature.feature' }],
    });
    expect(v).toHaveLength(0);
    expect(spawnSyncMock).toHaveBeenCalledTimes(2);
  });

  it('passes the model-check child budget to the TLA child process', () => {
    spawnSyncMock.mockReturnValue({ status: 0, stdout: '' });
    runModelChecks({
      manifestExists: true,
      manifestValid: true,
      effectivePhase: 1,
      graphPath: '',
      manifestFile: 'm.json',
      bddManifestExists: false,
      bddManifestValid: false,
      bddManifestFile: 'b.json',
    });
    const call = spawnSyncMock.mock.calls.find((c) => {
      const args = (c[1] ?? []) as string[];
      return args.some((a) => typeof a === 'string' && a.endsWith('check-tla-model.ts'));
    });
    expect(call?.[2]).toMatchObject({ timeout: EXEC_LIMITS.modelCheckChildTimeoutMs });
  });

  it('reports signal termination with a timeout hint', () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: null, signal: 'SIGKILL', stdout: '', stderr: '' })
      .mockReturnValue({ status: 0, stdout: '' });
    const violations = runModelChecks({
      manifestExists: true,
      manifestValid: true,
      effectivePhase: 1,
      graphPath: '',
      manifestFile: 'm.json',
      bddManifestExists: false,
      bddManifestValid: false,
      bddManifestFile: 'b.json',
    });
    const tla = violations.find((v) => v.includes('[artifact:tla-model]'));
    expect(tla).toBeDefined();
    expect(tla).toContain('SIGKILL');
    expect(tla).toContain('超时');
  });
});
