/**
 * gate-enhancement.test.ts —— Part A 门禁增强 fixture 化回归测试
 *
 * 保护门禁脚本本身不被回归。覆盖 Part A 三项门禁增强：
 *   - P1.1 basePath 强制校验（manifest 缺/含 basePath）
 *   - P1.2 SD 覆盖率 spec 方向（spec requirementIds 无/含 SD-xxx）
 *   - P1.3 passed↔qualityLevel 一致性（B 级 passed=false 失败 / A 级 passed=true 通过）
 *
 * 策略：优先复用 samples/ 下现有 fixture（tla/valid.json、verifier/valid.json、
 *   verifier/bad-passed-mismatch.json），仅内联构造少量极简 manifest 用于
 *   单一变量切换场景（如缺 basePath）。
 */

import { describe, it, expect } from 'vitest';
import { checkTlaModel, checkCoverage, type TlaManifest, type TlaSpec } from '../tla-logic.js';
import { checkVerifierOutput, type VerifierOutputShape } from '../verifier-logic.js';
import { checkArtifactGate, type RTMMatrixShape, type PhaseOption } from '../gate-logic.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.resolve(here, '..', 'samples');

function loadJson<T>(rel: string): T {
  const abs = path.resolve(SAMPLES_DIR, rel);
  return JSON.parse(fs.readFileSync(abs, 'utf-8')) as T;
}

function loadGateSample(name: string): RTMMatrixShape {
  return loadJson<RTMMatrixShape>(path.join('gate', name));
}

function loadVerifierSample(name: string): VerifierOutputShape {
  return loadJson<VerifierOutputShape>(path.join('verifier', name));
}

/**
 * 构造一份结构合规的极简 manifest（不含 basePath）。
 * 仅一个 L1 根 spec，所有声明标志为通过，故纯逻辑校验仅 basePath 缺失会致失败。
 */
function makeValidManifestWithoutBasePath(): unknown {
  return {
    version: 1,
    currentPhase: 2,
    tools: { jarPath: 'tools/tla2tools.jar', javaMinVersion: 11 },
    specs: [
      {
        id: 'L1-system',
        level: 'L1',
        phase: 1,
        system: 'test',
        requirementIds: ['SD-001'],
        designRef: 'docs/x.md',
        tlaPath: 'tla/L1.tla',
        cfgPath: 'tla/L1.cfg',
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
    checkRounds: [],
  };
}

/** 构造一份结构合规的极简 spec（仅缺 requirementIds 内容由调用方覆盖）。 */
function makeBaseSpec(id: string, requirementIds: string[]): TlaSpec {
  return {
    id,
    level: 'L1',
    phase: 1,
    system: 'test',
    requirementIds,
    designRef: '',
    tlaPath: 'a.tla',
    cfgPath: 'a.cfg',
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
  };
}

describe('Part A 门禁增强回归测试', () => {
  describe('P1.1 basePath 强制校验', () => {
    it('manifest 缺 basePath → checkTlaModel 失败且 violations 含 "basePath 缺失"', () => {
      const manifest = makeValidManifestWithoutBasePath();
      const result = checkTlaModel(manifest, 2);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('basePath 缺失'))).toBe(true);
    });

    it('manifest 含 basePath → 不报 basePath 缺失（复用 samples/tla/valid.json）', () => {
      const manifest = loadJson<TlaManifest>('tla/valid.json');
      const result = checkTlaModel(manifest, 2);
      expect(result.violations.some(v => v.includes('basePath 缺失'))).toBe(false);
    });
  });

  describe('P1.2 SD 覆盖率 spec 方向', () => {
    it('spec requirementIds 无 SD-xxx → checkCoverage 失败且 violations 含 "无 SD 标识"', () => {
      const specs = [makeBaseSpec('L1_test', ['REQ-001'])];
      const result = checkCoverage(specs, ['SD-001']);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('无 SD 标识'))).toBe(true);
    });

    it('spec requirementIds 含 SD-xxx → spec 方向通过（不报缺 requirementIds / 无 SD 标识）', () => {
      const specs = [makeBaseSpec('L1_test', ['SD-001', 'REQ-001'])];
      const result = checkCoverage(specs, ['SD-001']);
      expect(result.violations.some(v => v.includes('缺 requirementIds'))).toBe(false);
      expect(result.violations.some(v => v.includes('无 SD 标识'))).toBe(false);
    });
  });

  describe('P1.3 passed↔qualityLevel 一致性', () => {
    it('B 级 passed=false → checkVerifierOutput 失败（复用 samples/verifier/bad-passed-mismatch.json）', () => {
      const verifier = loadJson<VerifierOutputShape>('verifier/bad-passed-mismatch.json');
      const result = checkVerifierOutput(verifier);
      expect(result.passed).toBe(false);
      expect(
        result.reasons.some(
          r => r.includes('passed') && r.includes('qualityLevel') && r.includes('不一致'),
        ),
      ).toBe(true);
    });

    it('A 级 passed=true → checkVerifierOutput 通过（复用 samples/verifier/valid.json）', () => {
      const verifier = loadJson<VerifierOutputShape>('verifier/valid.json');
      const result = checkVerifierOutput(verifier);
      expect(result.passed).toBe(true);
    });
  });

  // ==================== 第 9 轮 P1.1 阶段级校验 ====================
  describe('P1.1 阶段级校验（phaseOption）', () => {
    it('phase=6 合法场景：unit+integration 通过，system+acceptance pending 应通过', () => {
      const matrix = loadGateSample('valid-phase6.json');
      const result = checkArtifactGate(matrix, { phaseOption: 6 as PhaseOption });
      expect(result.passed).toBe(true);
      expect(result.reasons).toEqual([]);
    });

    it('phase=6 REQ 缺 integrationTest 字段应失败', () => {
      const matrix = loadGateSample('bad-phase6-pending-system.json');
      const result = checkArtifactGate(matrix, { phaseOption: 6 as PhaseOption });
      expect(result.passed).toBe(false);
      expect(
        result.reasons.some(r => r.includes('REQ-001') && r.includes('integrationTest')),
      ).toBe(true);
    });

    it('phase=5 REQ 缺 codeModule 应失败', () => {
      const matrix = loadGateSample('bad-phase5-missing-codemodule.json');
      const result = checkArtifactGate(matrix, { phaseOption: 5 as PhaseOption });
      expect(result.passed).toBe(false);
      expect(
        result.reasons.some(r => r.includes('REQ-001') && r.includes('codeModule')),
      ).toBe(true);
    });

    it('phase=5 bad 样本在 phase=8 终检也应失败', () => {
      const matrix = loadGateSample('bad-phase5-missing-codemodule.json');
      const result = checkArtifactGate(matrix, { phaseOption: 8 as PhaseOption });
      expect(result.passed).toBe(false);
    });

    it('phase=6 合法场景在 phase=8 终检应失败（system/acceptance pending）', () => {
      const matrix = loadGateSample('valid-phase6.json');
      const result = checkArtifactGate(matrix, { phaseOption: 8 as PhaseOption });
      expect(result.passed).toBe(false);
      expect(result.reasons.some(r => r.includes('待执行'))).toBe(true);
    });

    it('未传 phaseOption 默认 phase=8（向后兼容，valid-phase6 应因 pending 失败）', () => {
      const matrix = loadGateSample('valid-phase6.json');
      const result = checkArtifactGate(matrix);
      expect(result.passed).toBe(false);
    });
  });

  // ==================== 第 9 轮 P2.4/P2.5/P3.10 verifier 标准化校验 ====================
  describe('P2.4/P2.5/P3.10 verifier 标准化校验', () => {
    it('P2.5 targetKind=testcase 应失败（已废弃，须用 test）', () => {
      const v = loadVerifierSample('bad-targetkind.json');
      const result = checkVerifierOutput(v);
      expect(result.passed).toBe(false);
      expect(result.reasons.some(r => r.includes('targetKind') && r.includes('testcase'))).toBe(true);
    });

    it('P2.4 subCriteria 名称非标准应失败', () => {
      const v = loadVerifierSample('bad-subcriteria-name.json');
      const result = checkVerifierOutput(v);
      expect(result.passed).toBe(false);
      expect(result.reasons.some(r => r.includes('应为') && r.includes('fake-criterion'))).toBe(true);
    });

    it('P3.10 rawScores 全相同应失败', () => {
      const v = loadVerifierSample('bad-rawscores-constant.json');
      const result = checkVerifierOutput(v);
      expect(result.passed).toBe(false);
      expect(result.reasons.some(r => r.includes('全同'))).toBe(true);
    });
  });
});
