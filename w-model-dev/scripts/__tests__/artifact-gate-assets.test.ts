/**
 * artifact-gate-assets.test.ts —— lib/artifact-gate-assets.ts 资产读取/校验层单元测试
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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { spawnSyncMock } = vi.hoisted(() => ({ spawnSyncMock: vi.fn() }));
vi.mock('node:child_process', () => ({ spawnSync: spawnSyncMock }));

import { discoverGraphAsset, readTlaManifest, readBddManifest, runModelChecks } from '../lib/artifact-gate-assets.js';

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
  it('specs 非空 → true', async () => {
    const f = path.join(tmpDir, 'tla-manifest.json');
    await fs.writeFile(f, JSON.stringify({ specs: [{ id: 'L1' }] }), 'utf-8');
    expect(await readTlaManifest(f)).toBe(true);
  });

  it('specs 空数组 → false', async () => {
    const f = path.join(tmpDir, 'tla-manifest.json');
    await fs.writeFile(f, JSON.stringify({ specs: [] }), 'utf-8');
    expect(await readTlaManifest(f)).toBe(false);
  });

  it('ENOENT → false（按不存在处理，不抛）', async () => {
    expect(await readTlaManifest(path.join(tmpDir, 'nope.json'))).toBe(false);
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

  it('ENOENT + phase>=4 → 强制缺失 violation；phase<4 → 不报', async () => {
    const missing = path.join(tmpDir, 'nope-bdd.json');
    const r4 = await readBddManifest(missing, tmpDir, 4);
    expect(r4.bddManifestExists).toBe(false);
    expect(r4.bddViolations.some((v) => v.includes('bdd-manifest.json missing (required after phase 4)'))).toBe(true);

    const r1 = await readBddManifest(missing, tmpDir, 1);
    expect(r1.bddViolations).toHaveLength(0);
  });

  it('JSON 非法 → 告警且按不存在处理', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = path.join(tmpDir, 'bdd-manifest.json');
    await fs.writeFile(f, '{not json', 'utf-8');
    const r = await readBddManifest(f, tmpDir, 4);
    expect(r.bddManifestExists).toBe(false);
    expect(r.bddViolations.some((v) => v.includes('missing (required after phase 4)'))).toBe(true);
    errSpy.mockRestore();
  });
});

describe('runModelChecks', () => {
  it('manifest 不存在 / phase<2 / 无 graphPath → 不调用子进程', () => {
    expect(
      runModelChecks({
        manifestExists: false,
        effectivePhase: 2,
        graphPath: 'g',
        manifestFile: 'm',
        bddManifestExists: false,
        bddManifestFile: 'b',
      }),
    ).toHaveLength(0);
    expect(
      runModelChecks({
        manifestExists: true,
        effectivePhase: 1,
        graphPath: 'g',
        manifestFile: 'm',
        bddManifestExists: false,
        bddManifestFile: 'b',
      }),
    ).toHaveLength(0);
    expect(
      runModelChecks({
        manifestExists: true,
        effectivePhase: 2,
        graphPath: '',
        manifestFile: 'm',
        bddManifestExists: false,
        bddManifestFile: 'b',
      }),
    ).toHaveLength(0);
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it('TLA+ 与 BDD 子进程均退出 0 → 零 violation', () => {
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
});
