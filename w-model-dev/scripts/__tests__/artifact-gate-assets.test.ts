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

import {
  buildTlaBddSyncPairs,
  discoverGraphAsset,
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
    expect(await readTlaManifest(f)).toMatchObject({ valid: true, exists: true });
  });

  it.each([
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
  ])('fails closed for %s', async (_label, value) => {
    const f = path.join(tmpDir, 'tla-manifest.json');
    await fs.writeFile(f, value, 'utf-8');
    const result = await readTlaManifest(f);
    expect(result.exists).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('ENOENT → missing invalid result', async () => {
    const result = await readTlaManifest(path.join(tmpDir, 'nope.json'));
    expect(result).toMatchObject({ exists: false, valid: false });
    expect(result.violations.length).toBeGreaterThan(0);
  });
});

describe('readBddManifest', () => {
  it('合法 manifest + feature 文件存在 + SM 七要素齐 → 零 violation', async () => {
    const f = path.join(tmpDir, 'bdd-manifest.json');
    await fs.writeFile(f, JSON.stringify(makeBddManifest()), 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'exists.feature'), '# Feature: x', 'utf-8');
    const r = await readBddManifest(f, tmpDir, 4);
    expect(r.bddManifestExists).toBe(true);
    expect(r.bddViolations).toHaveLength(0);
  });

  it('schema 失败 → [artifact:bdd] manifest schema failed', async () => {
    const f = path.join(tmpDir, 'bdd-manifest.json');
    await fs.writeFile(f, JSON.stringify({ schemaVersion: '1.0' }), 'utf-8');
    const r = await readBddManifest(f, tmpDir, 4);
    expect(r.bddViolations.some((v) => v.includes('[artifact:bdd] manifest schema failed'))).toBe(true);
  });

  it('feature 文件缺失 → [artifact:bdd] feature file missing', async () => {
    const f = path.join(tmpDir, 'bdd-manifest.json');
    await fs.writeFile(f, JSON.stringify(makeBddManifest()), 'utf-8');
    const r = await readBddManifest(f, tmpDir, 4);
    expect(r.bddViolations.some((v) => v.includes('feature file missing: exists.feature'))).toBe(true);
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

  it('JSON 非法 → 保留存在性并产生 parse violation', async () => {
    const f = path.join(tmpDir, 'bdd-manifest.json');
    await fs.writeFile(f, '{not json', 'utf-8');
    const r = await readBddManifest(f, tmpDir, 4);
    expect(r.bddManifestExists).toBe(true);
    expect(r.bddManifestValid).toBe(false);
    expect(r.bddViolations.some((v) => v.includes('manifest JSON parse failed'))).toBe(true);
  });
});

describe('readCucumberReport', () => {
  it.each([
    ['missing', undefined],
    ['invalid JSON', '{not json'],
    ['wrong shape', JSON.stringify({ scenarios: [] })],
    ['empty execution', JSON.stringify({ elements: [] })],
    ['skipped step', JSON.stringify({ elements: [{ name: 'scenario', steps: [{ result: { status: 'skipped' } }] }] })],
    [
      'unknown status',
      JSON.stringify({ elements: [{ name: 'scenario', steps: [{ result: { status: 'unknown' } }] }] }),
    ],
    ['failed step', JSON.stringify({ elements: [{ name: 'scenario', steps: [{ result: { status: 'failed' } }] }] })],
  ])('fails closed for %s Cucumber evidence', async (_label, value) => {
    const report = path.join(tmpDir, 'cucumber-report.json');
    if (value !== undefined) await fs.writeFile(report, value, 'utf-8');
    const result = await readCucumberReport(report, true);
    expect(result.cucumberReportValid).toBe(false);
    expect(result.cucumberViolations.length).toBeGreaterThan(0);
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

  it('phase 1 project gate passes required TLA evidence flags without graph', () => {
    spawnSyncMock.mockReturnValue({ status: 0, stdout: '' });
    const v = runModelChecks({
      manifestExists: true,
      effectivePhase: 1,
      graphPath: '',
      manifestFile: 'm.json',
      bddManifestExists: true,
      bddManifestFile: 'b.json',
    });
    expect(v).toHaveLength(0);
    expect(spawnSyncMock).toHaveBeenCalledTimes(2);
    const bddArgs = spawnSyncMock.mock.calls[1]?.[1] as string[];
    expect(bddArgs).toEqual(expect.arrayContaining(['--require-tla-equivalence', '--tla-manifest=m.json']));
    expect(bddArgs).not.toContain('--graph=');
  });

  it('phase 5 project gate passes required Cucumber evidence flags', () => {
    spawnSyncMock.mockReturnValue({ status: 0, stdout: '' });
    const v = runModelChecks({
      manifestExists: true,
      effectivePhase: 5,
      graphPath: 'g.json',
      manifestFile: 'm.json',
      bddManifestExists: true,
      bddManifestFile: 'b.json',
      cucumberReportFile: 'reports/cucumber.json',
    });
    expect(v).toHaveLength(0);
    const bddArgs = spawnSyncMock.mock.calls.find(([, args]) =>
      (args as string[])[2]?.endsWith('check-bdd-model.ts'),
    )?.[1] as string[];
    expect(bddArgs).toEqual(
      expect.arrayContaining(['--require-cucumber-report', '--cucumber-report=reports/cucumber.json']),
    );
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
        timeout: 15_000,
        killSignal: 'SIGKILL',
        encoding: 'utf-8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }
  });

  it('TLA+ 子进程退出码非 0 → [artifact:tla-model] 违反（含 stdout 末尾摘要）', () => {
    spawnSyncMock.mockReturnValue({ status: 1, stdout: 'line1\nline2\nline3\nline4\nline5\nline6' });
    const v = runModelChecks({
      manifestExists: true,
      effectivePhase: 2,
      graphPath: 'g.json',
      manifestFile: 'm.json',
      bddManifestExists: false,
      bddManifestFile: 'b.json',
    });
    expect(v).toHaveLength(1);
    expect(v[0]).toContain('[artifact:tla-model] check-tla-model 退出码 1');
    expect(v[0]).toContain('line6');
  });

  it('BDD 子进程退出码非 0 → [artifact:bdd-model] 违反', () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 0, stdout: '' })
      .mockReturnValueOnce({ status: 2, stdout: 'bdd error' });
    const v = runModelChecks({
      manifestExists: true,
      effectivePhase: 2,
      graphPath: 'g.json',
      manifestFile: 'm.json',
      bddManifestExists: true,
      bddManifestFile: 'b.json',
    });
    expect(v).toHaveLength(1);
    expect(v[0]).toContain('[artifact:bdd-model] check-bdd-model 退出码 2');
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
});
