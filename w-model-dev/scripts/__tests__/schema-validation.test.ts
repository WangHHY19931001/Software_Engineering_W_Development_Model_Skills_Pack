/**
 * schema-validation.test.ts —— JSON Schema 前置校验单元测试
 *
 * 借鉴 drawio-skill/styles/schema.json 设计实践：
 *   - additionalProperties:false 防字段漂移
 *   - required 防字段缺失
 *   - type 防类型错误
 *   - format:date-time 防时间格式错误
 *
 * 覆盖：
 *   1. validateBySchema 直接调用：合法数据通过 / 非法数据拒绝
 *   2. checkVerifierOutput 集成：schema 前置校验在业务逻辑之前拦截结构错误
 *   3. 3 个 schema 拒绝样本（additionalProperties / required / type）
 */

import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBySchema } from '../schema-loader.js';
import { checkVerifierOutput } from '../verifier-logic.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.join(here, '..', 'samples');
const schemaSamplesDir = path.join(samplesDir, 'schema');
const verifierSamplesDir = path.join(samplesDir, 'verifier');

async function loadJson(dir: string, file: string): Promise<unknown> {
  const raw = await fs.readFile(path.join(dir, file), 'utf-8');
  return JSON.parse(raw);
}

describe('JSON Schema 前置校验（validateBySchema）', () => {
  it('合法 VerifierOutput 通过 schema 校验', async () => {
    const data = await loadJson(verifierSamplesDir, 'valid.json');
    const result = validateBySchema('verifier-output', data);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeNull();
    expect(result.errorMessages).toEqual([]);
  });

  it('additionalProperties:false 拒绝未知字段', async () => {
    const data = await loadJson(schemaSamplesDir, 'bad-additional-props.json');
    const result = validateBySchema('verifier-output', data);
    expect(result.valid).toBe(false);
    expect(result.errorMessages.some(m => /additionalProperties/.test(m))).toBe(true);
  });

  it('required 拒绝缺失必填字段', async () => {
    const data = await loadJson(schemaSamplesDir, 'bad-missing-required.json');
    const result = validateBySchema('verifier-output', data);
    expect(result.valid).toBe(false);
    expect(result.errorMessages.some(m => /required/.test(m))).toBe(true);
  });

  it('type 拒绝错误数据类型', async () => {
    const data = await loadJson(schemaSamplesDir, 'bad-wrong-type.json');
    const result = validateBySchema('verifier-output', data);
    expect(result.valid).toBe(false);
    expect(result.errorMessages.some(m => /type/.test(m))).toBe(true);
  });

  it('未注册的 schema 名返回明确错误', () => {
    const result = validateBySchema('nonexistent-schema', {});
    expect(result.valid).toBe(false);
    expect(result.errorMessages.some(m => /schema 未注册/.test(m))).toBe(true);
  });
});

describe('checkVerifierOutput 集成：schema 前置校验', () => {
  it('additionalProperties 错误以 [schema] 前缀返回', async () => {
    const data = await loadJson(schemaSamplesDir, 'bad-additional-props.json');
    const result = checkVerifierOutput(data);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /\[schema\]/.test(r))).toBe(true);
    expect(result.reasons.some(r => /additionalProperties/.test(r))).toBe(true);
  });

  it('required 错误以 [schema] 前缀返回', async () => {
    const data = await loadJson(schemaSamplesDir, 'bad-missing-required.json');
    const result = checkVerifierOutput(data);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /\[schema\]/.test(r))).toBe(true);
    expect(result.reasons.some(r => /required/.test(r))).toBe(true);
  });

  it('type 错误以 [schema] 前缀返回', async () => {
    const data = await loadJson(schemaSamplesDir, 'bad-wrong-type.json');
    const result = checkVerifierOutput(data);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /\[schema\]/.test(r))).toBe(true);
    expect(result.reasons.some(r => /type/.test(r))).toBe(true);
  });

  it('schema 校验通过后业务逻辑仍能捕获数值错误', async () => {
    // bad-composite-score.json: schema 通过（结构合法），但 compositeScore 与 Σ 不一致
    const data = await loadJson(verifierSamplesDir, 'bad-composite-score.json');
    const result = checkVerifierOutput(data);
    expect(result.passed).toBe(false);
    // 不应有 [schema] 前缀（说明 schema 通过，业务逻辑拦截）
    expect(result.reasons.some(r => /\[schema\]/.test(r))).toBe(false);
    // 应有业务逻辑的 compositeScore 不一致错误
    expect(result.reasons.some(r => /compositeScore.*Σ\(score\*weight\)/.test(r))).toBe(true);
  });
});

describe('tla-manifest sdCoverage (phase>=2)', () => {
  it('phase>=2 时 sdCoverage 缺失应校验失败', () => {
    const manifest = {
      version: 1,
      project: 'test',
      currentPhase: 2,
      basePath: '.',
      tools: { jarPath: 'tla2tools.jar', javaMinVersion: 11 },
      specs: [{
        id: 'L1_Test', level: 'L1', phase: 1, system: 'test',
        requirementIds: ['REQ-001'], designRef: 'docs/phase1-requirements/requirement-spec.md:§1',
        tlaPath: 'L1_Test.tla', cfgPath: 'L1_Test.cfg',
        parent: null, siblings: [], children: [],
        variableCombination: 100, decompositionDecision: 'kept-below-threshold',
        syntaxChecked: true, tlcChecked: true, deadlockFree: true,
        invariantsHold: true, stateExplosion: false,
      }],
    };
    const result = validateBySchema('tla-manifest', manifest);
    expect(result.valid).toBe(false);
    expect(result.errorMessages.join(' ')).toMatch(/sdCoverage/);
  });

  it('phase>=2 时 sdCoverage.uncoveredSdNodes 非空应通过 schema（由业务层 checkTlaModel 校验）', () => {
    const manifest = {
      version: 1, project: 'test', currentPhase: 2, basePath: '.',
      tools: { jarPath: 'tla2tools.jar', javaMinVersion: 11 },
      specs: [{
        id: 'L1_Test', level: 'L1', phase: 1, system: 'test',
        requirementIds: ['REQ-001'], designRef: 'docs/phase1-requirements/requirement-spec.md:§1',
        tlaPath: 'L1_Test.tla', cfgPath: 'L1_Test.cfg',
        parent: null, siblings: [], children: [],
        variableCombination: 100, decompositionDecision: 'kept-below-threshold',
        syntaxChecked: true, tlcChecked: true, deadlockFree: true,
        invariantsHold: true, stateExplosion: false,
      }],
      sdCoverage: {
        totalSdNodes: 3,
        coveredSdNodes: ['SD-001', 'SD-002'],
        uncoveredSdNodes: ['SD-003'],
        coverageRate: 0.667,
      },
    };
    const result = validateBySchema('tla-manifest', manifest);
    expect(result.valid).toBe(true);
  });
});

describe('bdd-manifest designCoverage (phase>=2)', () => {
  it('phase>=2 时 designCoverage 缺失应校验失败', () => {
    const manifest = {
      schemaVersion: '1.0', projectId: 'test', basePath: 'features/',
      currentPhase: 2,
      features: [{
        id: 'L1_test-001', level: 1, filePath: 'L1/L1_test-001.feature',
        scenarioCount: 1, stateMachineId: 'SM-L1-test', tlaSpecId: 'L1_test',
        reqIds: ['REQ-001'], designIds: ['SD-001'],
        parentFeatureIds: [], siblingFeatureIds: [], childFeatureIds: [],
      }],
      stateMachines: [{
        id: 'SM-L1-test', level: 1, states: ['S1', 'S2'],
        initialState: 'S1', terminalStates: [], acceptingStates: ['S2'],
        rejectingStates: [], transitions: [{ from: 'S1', event: 'e', to: 'S2' }],
        invariants: ['S2 => true'],
      }],
    };
    const result = validateBySchema('bdd-manifest', manifest);
    expect(result.valid).toBe(false);
    expect(result.errorMessages.join(' ')).toMatch(/designCoverage/);
  });

  it('phase>=2 时 designCoverage.uncoveredSdNodes 非空应通过 schema（非空由业务层 D8 校验）', () => {
    const manifest = {
      schemaVersion: '1.0', projectId: 'test', basePath: 'features/',
      currentPhase: 2,
      features: [{
        id: 'L1_test-001', level: 1, filePath: 'L1/L1_test-001.feature',
        scenarioCount: 1, stateMachineId: 'SM-L1-test', tlaSpecId: 'L1_test',
        reqIds: ['REQ-001'], designIds: ['SD-001'],
        parentFeatureIds: [], siblingFeatureIds: [], childFeatureIds: [],
      }],
      stateMachines: [{
        id: 'SM-L1-test', level: 1, states: ['S1', 'S2'],
        initialState: 'S1', terminalStates: [], acceptingStates: ['S2'],
        rejectingStates: [], transitions: [{ from: 'S1', event: 'e', to: 'S2' }],
        invariants: ['S2 => true'],
      }],
      designCoverage: {
        totalSdNodes: 3,
        coveredSdNodes: ['SD-001'],
        uncoveredSdNodes: ['SD-002', 'SD-003'],
        coverageRate: 0.333,
      },
    };
    const result = validateBySchema('bdd-manifest', manifest);
    expect(result.valid).toBe(true);
  });
});
