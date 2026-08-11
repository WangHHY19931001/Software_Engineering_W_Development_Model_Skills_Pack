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
import { checkTlaModel, checkCoverage, type TlaManifest, type TlaSpec } from '../logic/tla-logic.js';
import { checkVerifierOutput, type VerifierOutputShape } from '../logic/verifier-logic.js';
import { checkArtifactGate, checkPhaseSpecStructure, checkRequirementSpecStructure, checkUatPathMappingBackfill, type GateGraph, type RTMMatrixShape, type PhaseOption } from '../logic/gate-logic.js';
import { checkRequirementGraph, type GraphShape } from '../logic/graph-logic.js';
import { checkRequirementCoverage, type CoverageShape, type CoverageCheckOptions } from '../logic/coverage-logic.js';
import { checkExemption, type ExemptionShape } from '../logic/exemption-logic.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
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
 * sdCoverage：Task 3 schema 在 currentPhase>=2 时强制必填，此处补空覆盖数据以通过 schema 前置校验。
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
    sdCoverage: {
      totalSdNodes: 0,
      coveredSdNodes: [],
      uncoveredSdNodes: [],
      coverageRate: 1,
    },
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
      // schema enum 前置校验拦截，错误消息含 [schema] 和 targetKind 路径
      expect(result.reasons.some(r => r.includes('[schema]') && r.includes('targetKind'))).toBe(true);
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

describe('R11/R12 Verifier 改进（sig-002）', () => {
  it('R11: summary 长度 < 50 字符应失败', () => {
    const sample = loadVerifierSample('bad-summary-too-short.json');
    const result = checkVerifierOutput(sample);
    expect(result.passed).toBe(false);
    // schema minLength:50 前置校验拦截，错误消息含 [schema] 和 summary 路径
    expect(result.reasons.some(r => r.includes('[schema]') && r.includes('summary'))).toBe(true);
  });

  it('R11: summary 长度 ≥ 50 字符应通过（valid.json）', () => {
    const sample = loadVerifierSample('valid.json');
    const result = checkVerifierOutput(sample);
    // valid.json summary 已扩展至 ≥50 字符，R11 应通过
    expect(result.reasons.some(r => /R11/.test(r))).toBe(false);
  });

  it('R12: evidence 缺具体引用应失败', () => {
    const sample = loadVerifierSample('bad-evidence-empty.json');
    const result = checkVerifierOutput(sample);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /evidence.*缺具体引用.*R12/.test(r))).toBe(true);
  });

  it('R12: evidence 含具体引用应通过（valid.json）', () => {
    const sample = loadVerifierSample('valid.json');
    const result = checkVerifierOutput(sample);
    // valid.json evidence 含 "REQ-001 §3.2" 等具体引用，R12 应通过
    expect(result.reasons.some(r => /R12/.test(r))).toBe(false);
  });
});

// ==================== 阶段 E 集成测试：graph + coverage + exemption 联动 ====================

/**
 * 构造一份全通过的合法 GraphShape（phase=1，R1-R6 + 基础校验全通过）。
 *
 * 结构：
 *   EXT-IN-001 → REQ-001(level=1,root) → REQ-002(level=2) → EXT-OUT-001
 *                       └── NFR-001(level=2) ──┘ (cross-cuts REQ-002)
 *
 * 信息流（produces）：EXT-IN → REQ-001 → {REQ-002, NFR-001} → EXT-OUT
 * 横切层（cross-cuts）：NFR-001 → REQ-002
 */
function makeValidGraph(): GraphShape {
  return {
    version: 1,
    currentPhase: 1,
    nodes: [
      { id: 'EXT-IN-001', type: 'EXT-IN', phase: 1, title: '外部输入', summary: '边界源' },
      { id: 'REQ-001', type: 'REQ', phase: 1, title: '用户域', summary: 'level=1 domain', level: 1 },
      { id: 'REQ-002', type: 'REQ', phase: 1, title: '注册模块', summary: 'level=2 module', level: 2, reqGroup: 'REQ-001' },
      { id: 'NFR-001', type: 'REQ', phase: 1, title: '性能NFR', summary: 'level=2 NFR', level: 2, reqGroup: 'REQ-001' },
      { id: 'EXT-OUT-001', type: 'EXT-OUT', phase: 1, title: '外部输出', summary: '边界汇' },
    ],
    edges: [
      // REQ 层级树（from=parent → to=child，与 R2 parentInCount / R3 toLevel=fromLevel+1 一致）
      { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
      { from: 'REQ-001', to: 'NFR-001', type: 'parent' },
      // 信息流（produces）
      { from: 'EXT-IN-001', to: 'REQ-001', type: 'produces' },
      { from: 'REQ-001', to: 'REQ-002', type: 'produces' },
      { from: 'REQ-002', to: 'EXT-OUT-001', type: 'produces' },
      { from: 'REQ-001', to: 'NFR-001', type: 'produces' },
      { from: 'NFR-001', to: 'EXT-OUT-001', type: 'produces' },
      // 横切层（NFR-001 治理 REQ-002）
      { from: 'NFR-001', to: 'REQ-002', type: 'cross-cuts' },
    ],
  };
}

/**
 * 构造一份全通过的合法 CoverageShape（C1-C10 全通过，crossCuts 与 graph 一致）。
 */
function makeValidCoverage(): CoverageShape {
  return {
    stakeholders: [
      { id: 'SH-001', role: '终端用户', relatedReqs: ['REQ-001'], status: 'covered' },
    ],
    scenarios: [
      { id: 'SC-001', description: '正常注册', steps: ['提交'], relatedReqs: ['REQ-001'], status: 'covered', scenarioType: 'happy' },
      { id: 'SC-002', description: '邮箱错误', steps: ['提交'], relatedReqs: ['REQ-001'], status: 'covered', scenarioType: 'error' },
      { id: 'SC-003', description: '长度边界', steps: ['提交'], relatedReqs: ['REQ-001'], status: 'covered', scenarioType: 'boundary' },
    ],
    requirementTypes: [
      { type: 'REQ', reqIds: ['REQ-001', 'REQ-002'], status: 'covered' },
      { type: 'NFR', reqIds: ['NFR-001'], status: 'covered' },
      { type: 'CON', reqIds: ['CON-001'], status: 'covered' },
    ],
    crossCuts: [
      { nfrConId: 'NFR-001', governedReqs: ['REQ-002'], status: 'covered' },
    ],
    metrics: { stakeholder: 100, scenario: 100, requirementType: 100, crossCut: 100 },
  };
}

/**
 * 构造一份全通过的合法 ExemptionShape（S→R→V→人类四阶段完整）。
 * ruleId 可由调用方指定（默认 R4）。
 */
function makeValidExemption(ruleId: string = 'R4'): ExemptionShape {
  return {
    id: 'EXEMPT-001',
    type: 'small-project-hierarchy',
    target: 'REQ-group',
    ruleId,
    justification: '项目规模小REQ总数小于5无需拆分group',
    evidence: ['graph.json:REQ总数=4'],
    proposedAlternative: '声明单group直接派生SD',
    submittedAt: '2026-07-28T10:00:00Z',
    review: {
      reviewDecision: 'approve',
      rootCauseAnalysis: '项目为MVP试点业务范围天然聚焦单一领域无多group必要5Why分析',
      falsifiabilityCheck: '若REQ总数增长至5须重新评估',
      riskAssessment: '低风险单一group不影响SD派生',
      reviewedAt: '2026-07-28T11:00:00Z',
    },
    verification: {
      verified: true,
      verifiedAt: '2026-07-28T12:00:00Z',
    },
    humanDecision: {
      decision: 'approve',
      decidedAt: '2026-07-28T13:00:00Z',
    },
  };
}

/**
 * 构造一份 R4 违规 GraphShape（5+ REQ 无 level=1，小项目豁免场景）。
 *
 * 结构：
 *   EXT-IN-001 → REQ-001(level=2,root) → REQ-002(level=3) → {REQ-003,004,005,NFR-001}(level=4) → EXT-OUT-001
 *
 * 违规：
 *   R2 orphan — REQ-001 level=2 无 parent 入边（小项目根节点天然 orphan）
 *   R4         — 6 个 REQ 无 level=1（无候选子系统 group）
 * 其余校验（连通 / 单根 / orphan BFS / 多父 / level 单调 / 信息流 / 边界 / R5 / R6）均通过。
 */
function makeR4ViolationGraph(): GraphShape {
  return {
    version: 1,
    currentPhase: 1,
    nodes: [
      { id: 'EXT-IN-001', type: 'EXT-IN', phase: 1, title: '外部输入', summary: '边界源' },
      { id: 'REQ-001', type: 'REQ', phase: 1, title: '功能A', summary: 'level=2 小项目根', level: 2, reqGroup: 'REQ-G1' },
      { id: 'REQ-002', type: 'REQ', phase: 1, title: '功能B', summary: 'level=3', level: 3, reqGroup: 'REQ-G1' },
      { id: 'REQ-003', type: 'REQ', phase: 1, title: '功能C', summary: 'level=4', level: 4, reqGroup: 'REQ-G1' },
      { id: 'REQ-004', type: 'REQ', phase: 1, title: '功能D', summary: 'level=4', level: 4, reqGroup: 'REQ-G1' },
      { id: 'REQ-005', type: 'REQ', phase: 1, title: '功能E', summary: 'level=4', level: 4, reqGroup: 'REQ-G1' },
      { id: 'NFR-001', type: 'REQ', phase: 1, title: '性能NFR', summary: 'level=4 NFR', level: 4, reqGroup: 'REQ-G1' },
      { id: 'EXT-OUT-001', type: 'EXT-OUT', phase: 1, title: '外部输出', summary: '边界汇' },
    ],
    edges: [
      // REQ 层级树（from=parent → to=child）
      { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
      { from: 'REQ-002', to: 'REQ-003', type: 'parent' },
      { from: 'REQ-002', to: 'REQ-004', type: 'parent' },
      { from: 'REQ-002', to: 'REQ-005', type: 'parent' },
      { from: 'REQ-002', to: 'NFR-001', type: 'parent' },
      // 信息流（produces）
      { from: 'EXT-IN-001', to: 'REQ-001', type: 'produces' },
      { from: 'REQ-001', to: 'REQ-002', type: 'produces' },
      { from: 'REQ-002', to: 'REQ-003', type: 'produces' },
      { from: 'REQ-002', to: 'REQ-004', type: 'produces' },
      { from: 'REQ-002', to: 'REQ-005', type: 'produces' },
      { from: 'REQ-002', to: 'NFR-001', type: 'produces' },
      { from: 'REQ-003', to: 'EXT-OUT-001', type: 'produces' },
      { from: 'REQ-004', to: 'EXT-OUT-001', type: 'produces' },
      { from: 'REQ-005', to: 'EXT-OUT-001', type: 'produces' },
      { from: 'NFR-001', to: 'EXT-OUT-001', type: 'produces' },
      // 横切层（与 makeValidCoverage 的 crossCuts 一致：NFR-001→REQ-002）
      { from: 'NFR-001', to: 'REQ-002', type: 'cross-cuts' },
    ],
  };
}

/**
 * 集成测试 Gate 辅助函数：编排 graph + coverage + exemption 三层校验。
 *
 * 工作流：
 *   1. checkRequirementGraph → 图谱校验
 *   2. checkExemption → 豁免审批（若提供）
 *   3. 已批准豁免的 ruleId 抑制图谱/覆盖对应的规则违规
 *   4. checkRequirementCoverage → 覆盖分析（注入 graph cross-cuts 边集 + 已批准 C 类豁免）
 *   5. 汇总 passed = 图谱剩余违规空 ∧ 覆盖 passed ∧ 所有豁免 passed
 *
 * small-project-hierarchy 豁免特殊处理：
 *   抑制 R2+R4（小项目无 level=1 REQ 时，根 orphan 与 group 缺失同源，一并豁免）
 */
interface GateInput {
  graph: GraphShape;
  coverage: CoverageShape;
  coverageOptions?: CoverageCheckOptions;
  exemptions?: ExemptionShape[];
  graphPhase?: number;
}

interface GateOutput {
  graphViolations: string[];
  coverageViolations: string[];
  exemptionViolations: string[][];
  suppressedRules: string[];
  overallPassed: boolean;
}

function runGate(input: GateInput): GateOutput {
  const graphPhase = input.graphPhase ?? 1;
  const graphResult = checkRequirementGraph(input.graph, graphPhase);

  // 从 graph 提取 cross-cuts 边集供 C7 双向校验
  const graphCrossCuts = input.graph.edges
    .filter(e => e.type === 'cross-cuts')
    .map(e => ({ from: e.from, to: e.to }));

  // 校验豁免
  const exemptionResults = (input.exemptions ?? []).map(e => checkExemption(e));
  const approvedRuleIds = new Set<string>();
  const suppressAllRules = new Set<string>();

  for (let i = 0; i < (input.exemptions ?? []).length; i++) {
    const exempt = input.exemptions![i]!;
    const result = exemptionResults[i]!;
    if (result.passed) {
      approvedRuleIds.add(exempt.ruleId);
      // small-project-hierarchy 豁免覆盖 R2+R4（同源：小项目无 level=1 REQ）
      if (exempt.type === 'small-project-hierarchy') {
        suppressAllRules.add('R2');
        suppressAllRules.add('R4');
      }
    }
  }

  const suppressedRules = [...new Set([...approvedRuleIds, ...suppressAllRules])];

  // 抑制图谱违规：违规消息含被豁免 ruleId 的被过滤
  const graphViolations = graphResult.violations.filter(v => {
    return !suppressedRules.some(rule => v.includes(rule));
  });

  // 覆盖分析：注入 graph cross-cuts + 已批准 C 类豁免
  const coverageExemptions = [
    ...(input.coverageOptions?.exemptions ?? []),
    ...[...approvedRuleIds].filter(r => r.startsWith('C')),
  ];
  const coverageResult = checkRequirementCoverage(input.coverage, {
    ...input.coverageOptions,
    graphCrossCuts: input.coverageOptions?.graphCrossCuts ?? graphCrossCuts,
    exemptions: coverageExemptions,
  });

  const overallPassed =
    graphViolations.length === 0 &&
    coverageResult.passed &&
    exemptionResults.every(r => r.passed);

  return {
    graphViolations,
    coverageViolations: coverageResult.violations,
    exemptionViolations: exemptionResults.map(r => r.violations),
    suppressedRules,
    overallPassed,
  };
}

describe('阶段 E 集成测试：graph + coverage + exemption 联动', () => {
  it('集成1: 合法 graph + 合法 coverage + 无豁免 → 整体通过', () => {
    const result = runGate({
      graph: makeValidGraph(),
      coverage: makeValidCoverage(),
    });
    expect(result.graphViolations).toEqual([]);
    expect(result.coverageViolations).toEqual([]);
    expect(result.overallPassed).toBe(true);
  });

  it('集成2: graph R2 orphan 违规 → 整体失败（图谱层拦截）', () => {
    const graph = makeValidGraph();
    // 删除 REQ-002 的 parent 入边，使其成为 level≥2 orphan
    graph.edges = graph.edges.filter(
      e => !(e.type === 'parent' && e.from === 'REQ-001' && e.to === 'REQ-002'),
    );
    const result = runGate({
      graph,
      coverage: makeValidCoverage(),
    });
    expect(result.overallPassed).toBe(false);
    expect(result.graphViolations.some(v => v.includes('R2') && v.includes('orphan'))).toBe(true);
  });

  it('集成3: coverage C8 覆盖率阈值违规 → 整体失败（覆盖层拦截）', () => {
    const coverage = makeValidCoverage();
    // 制造 partial 项触发 C8（100% 阈值不允许 partial）
    coverage.stakeholders = [
      { id: 'SH-001', role: '用户', relatedReqs: ['REQ-001'], status: 'covered' },
      { id: 'SH-002', role: '管理员', relatedReqs: ['REQ-002'], status: 'partial' },
    ];
    // recalc = (1 + 0.5) / 2 * 100 = 75，匹配重算避免 C10 噪声
    coverage.metrics.stakeholder = 75;
    const result = runGate({
      graph: makeValidGraph(),
      coverage,
    });
    expect(result.overallPassed).toBe(false);
    expect(result.coverageViolations.some(v => v.includes('C8'))).toBe(true);
  });

  it('集成4: 豁免 E8 humanDecision 缺失 → 整体失败（豁免层拦截）', () => {
    const exemption = makeValidExemption('R4');
    // 删除 humanDecision 触发 E8
    const { humanDecision, ...exemptWithoutHuman } = exemption;
    void humanDecision;
    const result = runGate({
      graph: makeValidGraph(),
      coverage: makeValidCoverage(),
      exemptions: [exemptWithoutHuman as ExemptionShape],
    });
    expect(result.overallPassed).toBe(false);
    expect(result.exemptionViolations[0]!.some(v => v.includes('E8'))).toBe(true);
  });

  it('集成5: graph R4 违规 + 已批准豁免 → R4 被抑制 → 整体通过', () => {
    const result = runGate({
      graph: makeR4ViolationGraph(),
      coverage: makeValidCoverage(),
      exemptions: [makeValidExemption('R4')],
    });
    // 豁免已批准，R2+R4 被抑制
    expect(result.suppressedRules).toContain('R4');
    expect(result.suppressedRules).toContain('R2');
    expect(result.graphViolations).toEqual([]);
    expect(result.exemptionViolations[0]).toEqual([]);
    expect(result.overallPassed).toBe(true);
  });
});

describe('P0-2 codeModule 格式校验（第22轮）', () => {
  it('REQ 行 codeModule 缺 SD 前缀 → 失败', () => {
    const matrix: RTMMatrixShape = {
      rows: [{
        requirementId: 'REQ-001',
        description: '登录',
        designDoc: 'SD-1',
        codeModule: 'src/auth/login.ts',
        unitTest: 'UT-001',
        integrationTest: '',
        systemTest: '',
        acceptanceTest: 'UAT-001',
      }],
      executionSummary: {
        unitTest: { total: 1, passed: 1, failed: 0, pending: 0, coverage: 90 },
        integrationTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
        systemTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
        acceptanceTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
      },
    };
    const result = checkArtifactGate(matrix, { phaseOption: 5 });
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('codeModule 格式错误'))).toBe(true);
  });

  it('NFR 行 codeModule 带非法 SD 前缀 → 失败', () => {
    const matrix: RTMMatrixShape = {
      rows: [{
        requirementId: 'NFR-001',
        description: '限流',
        designDoc: 'SD-2',
        codeModule: 'SD-2.1:src/middleware/rateLimit.ts',
        unitTest: '',
        integrationTest: '',
        systemTest: '',
        acceptanceTest: '',
      }],
      executionSummary: {
        unitTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
        integrationTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
        systemTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
        acceptanceTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
      },
    };
    const result = checkArtifactGate(matrix, { phaseOption: 5 });
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('codeModule 格式错误'))).toBe(true);
  });

  it('REQ 行 codeModule 格式正确 → 通过', () => {
    const matrix: RTMMatrixShape = {
      rows: [{
        requirementId: 'REQ-001',
        description: '登录',
        designDoc: 'SD-1',
        codeModule: 'SD-1.1:src/auth/login.ts',
        unitTest: 'UT-001',
        integrationTest: '',
        systemTest: '',
        acceptanceTest: 'UAT-001',
      }],
      executionSummary: {
        unitTest: { total: 1, passed: 1, failed: 0, pending: 0, coverage: 90 },
        integrationTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
        systemTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
        acceptanceTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
      },
    };
    const result = checkArtifactGate(matrix, { phaseOption: 5 });
    expect(result.reasons.some(r => r.includes('codeModule 格式错误'))).toBe(false);
  });
});

// ==================== 第 28 轮 G-B gate-logic 修正（B1-B3） ====================
describe('G-B gate-logic 修正（round28）', () => {
  describe('B1: SD 数字层级 id codeModule 前缀映射兜底', () => {
    it('SD-5.2.1 命中 codeModule "SD-5.2.1:src/..." 前缀 → 应通过，不误报"无可识别段"', () => {
      const matrix: RTMMatrixShape = {
        rows: [{
          requirementId: 'REQ-001',
          description: '登录',
          designDoc: 'SD-5.2.1',
          codeModule: 'SD-5.2.1:src/auth/login.ts',
          unitTest: 'UT-001',
          integrationTest: 'IT-001',
          systemTest: 'ST-001',
          acceptanceTest: 'UAT-001',
          coverageStatus: '100%',
        }],
        executionSummary: {
          unitTest: { total: 1, passed: 1, failed: 0, pending: 0, coverage: 90 },
          integrationTest: { total: 1, passed: 1, failed: 0, pending: 0, coverage: 90 },
          systemTest: { total: 1, passed: 1, failed: 0, pending: 0, coverage: 90 },
          acceptanceTest: { total: 1, passed: 1, failed: 0, pending: 0, coverage: 90 },
        },
      };
      const graph: GateGraph = { nodes: [{ id: 'SD-5.2.1', type: 'SD' }] };
      const result = checkArtifactGate(matrix, { graph, phaseOption: 8 });
      expect(result.passed).toBe(true);
      expect(result.reasons.some(r => r.includes('TLA+ 资产校验失败'))).toBe(false);
    });
  });

  describe('B2: coverageStatus 行级一致性比较', () => {
    it('行 A 完整+"100%" 不应被 flag；行 B 缺 acceptanceTest 应被 flag（不误报行 A）', () => {
      const matrix: RTMMatrixShape = {
        rows: [
          {
            requirementId: 'REQ-A',
            description: '完整行',
            designDoc: 'SD-1.1',
            codeModule: 'SD-1.1:src/a.ts',
            unitTest: 'UT-A',
            integrationTest: 'IT-A',
            systemTest: 'ST-A',
            acceptanceTest: 'UAT-A',
            coverageStatus: '100%',
          },
          {
            requirementId: 'REQ-B',
            description: '缺验收',
            designDoc: 'SD-2.1',
            codeModule: 'SD-2.1:src/b.ts',
            unitTest: 'UT-B',
            integrationTest: 'IT-B',
            systemTest: 'ST-B',
            acceptanceTest: '',
            coverageStatus: '部分',
          },
        ],
        executionSummary: {
          unitTest: { total: 2, passed: 2, failed: 0, pending: 0, coverage: 90 },
          integrationTest: { total: 2, passed: 2, failed: 0, pending: 0, coverage: 90 },
          systemTest: { total: 2, passed: 2, failed: 0, pending: 0, coverage: 90 },
          acceptanceTest: { total: 1, passed: 1, failed: 0, pending: 0, coverage: 90 },
        },
      };
      const result = checkArtifactGate(matrix, { phaseOption: 8 });
      // 整体仍失败（行 B 追溯不完整）
      expect(result.passed).toBe(false);
      // 行 B 被 flag（缺失 acceptanceTest）
      expect(result.reasons.some(r => r.includes('REQ-B'))).toBe(true);
      // 行 A 不应因 coverageStatus 被 flag：不得再有矩阵全局比较产生的 "coverageStatus...不一致"
      expect(result.reasons.some(r => r.includes('coverageStatus') && r.includes('不一致'))).toBe(false);
    });
  });

  describe('B3: uat-path-mapping 回填校验类型 guard', () => {
    it('actualPath/mappingType 非字符串 → 不抛 TypeError，push violation 后继续', () => {
      const violations = checkUatPathMappingBackfill([
        { uatId: 'UAT-001', actualPath: 123 as unknown as string, mappingType: '直接' },
      ]);
      expect(violations.some(v => v.includes('UAT-001') && v.includes('类型'))).toBe(true);
    });
  });
});

// ==================== 第 37 轮 Phase 1 需求规格结构校验 ====================
// 内存 fs stub：文件键用 path.join 构造，与 checkRequirementSpecStructure 内部
// path.join 分隔符一致（Windows 反斜杠），保证 existsSync/readFileSync 命中。
describe('Phase 1 需求规格结构校验', () => {
  const mkFs = (files: Record<string, string>) => ({
    readFileSync(p: string): string {
      if (!(p in files)) throw new Error(`missing ${p}`);
      return files[p] ?? '';
    },
    existsSync(p: string): boolean {
      return p in files;
    },
  });

  it('引用块齐全 + SSOT 头 + DoD≥8 通过', () => {
    const dir = 'docs/phase1-requirements';
    const refs = ['system-context.md', 'glossary.md', 'traceability-matrix.md', 'behavior-spec.md', 'discipline-dod.md', 'uml-modeling.md'];
    let spec = refs.map(r => `> 详见 [x](./${r})`).join('\n');
    spec += '\n> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    const files: Record<string, string> = {};
    files[path.join(dir, 'requirement-spec.md')] = spec;
    for (const r of refs) files[path.join(dir, r)] = '';
    files[path.join(dir, 'discipline-dod.md')] = Array(9).fill('- [ ] x').join('\n');
    const v = checkRequirementSpecStructure(dir, mkFs(files));
    expect([...v.refs, ...v.ssot, ...v.dod]).toEqual([]);
  });

  it('引用文件缺失报 refs', () => {
    const dir = 'docs/phase1-requirements';
    const files: Record<string, string> = {};
    files[path.join(dir, 'requirement-spec.md')] = '> 详见 [x](./system-context.md)\n> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    files[path.join(dir, 'discipline-dod.md')] = Array(9).fill('- [ ] x').join('\n');
    const v = checkRequirementSpecStructure(dir, mkFs(files));
    expect(v.refs.length).toBeGreaterThan(0);
  });

  it('DoD < 8 报 dod', () => {
    const dir = 'docs/phase1-requirements';
    const refs = ['system-context.md', 'glossary.md', 'traceability-matrix.md', 'behavior-spec.md', 'discipline-dod.md', 'uml-modeling.md'];
    let spec = refs.map(r => `> 详见 [x](./${r})`).join('\n');
    spec += '\n> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    const files: Record<string, string> = {};
    files[path.join(dir, 'requirement-spec.md')] = spec;
    for (const r of refs) files[path.join(dir, r)] = '';
    files[path.join(dir, 'discipline-dod.md')] = Array(5).fill('- [ ] x').join('\n');
    const v = checkRequirementSpecStructure(dir, mkFs(files));
    expect(v.dod.some(m => m.includes('DoD 清单仅 5 项'))).toBe(true);
  });
});

describe('Phase 2 系统设计结构校验', () => {
  const mkFs = (files: Record<string, string>) => ({
    readFileSync(p: string): string {
      if (!(p in files)) throw new Error(`missing ${p}`);
      return files[p] ?? '';
    },
    existsSync(p: string): boolean {
      return p in files;
    },
    readdirSync(p: string): string[] {
      const prefix = `${p}${path.sep}`;
      return Object.keys(files)
        .filter(k => k.startsWith(prefix))
        .map(k => k.slice(prefix.length));
    },
  });

  it('引用块齐全 + SSOT 头 + DoD≥8 通过', () => {
    const dir = path.join('docs', 'phase2-design');
    const refs = ['blog-system-system-architecture.md', 'blog-system-glossary.md', 'blog-system-traceability-matrix.md', 'blog-system-behavior-spec.md', 'blog-system-discipline-dod.md', 'blog-system-uml-modeling.md'];
    let spec = refs.map(r => `> 详见 [x](./${r})`).join('\n');
    spec += '\n> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    const files: Record<string, string> = {};
    for (const r of refs) files[path.join(dir, r)] = '';
    files[path.join(dir, 'blog-system-system-design.md')] = spec;
    files[path.join(dir, 'blog-system-discipline-dod.md')] = Array(9).fill('- [ ] x').join('\n');
    const v = checkPhaseSpecStructure(2, dir, mkFs(files));
    expect([...v.refs, ...v.ssot, ...v.dod]).toEqual([]);
  });

  it('引用文件缺失报 refs', () => {
    const dir = path.join('docs', 'phase2-design');
    const files: Record<string, string> = {};
    files[path.join(dir, 'blog-system-system-design.md')] = '> 详见 [x](./blog-system-uml-modeling.md)\n> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    files[path.join(dir, 'blog-system-discipline-dod.md')] = Array(9).fill('- [ ] x').join('\n');
    const v = checkPhaseSpecStructure(2, dir, mkFs(files));
    expect(v.refs.length).toBeGreaterThan(0);
  });

  it('主文档 glob 零个报 refs', () => {
    const dir = path.join('docs', 'phase2-design');
    const files: Record<string, string> = {};
    files[path.join(dir, 'blog-system-discipline-dod.md')] = Array(9).fill('- [ ] x').join('\n');
    const v = checkPhaseSpecStructure(2, dir, mkFs(files));
    expect(v.refs.some(m => m.includes('主文档 glob'))).toBe(true);
  });

  it('主文档 glob 多个报 refs', () => {
    const dir = path.join('docs', 'phase2-design');
    const files: Record<string, string> = {};
    files[path.join(dir, 'a-system-design.md')] = '> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    files[path.join(dir, 'b-system-design.md')] = '> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    files[path.join(dir, 'blog-system-discipline-dod.md')] = Array(9).fill('- [ ] x').join('\n');
    const v = checkPhaseSpecStructure(2, dir, mkFs(files));
    expect(v.refs.some(m => m.includes('主文档 glob'))).toBe(true);
  });
});

describe('Phase 3 概要设计结构校验', () => {
  const mkFs = (files: Record<string, string>) => ({
    readFileSync(p: string): string {
      if (!(p in files)) throw new Error(`missing ${p}`);
      return files[p] ?? '';
    },
    existsSync(p: string): boolean {
      return p in files;
    },
    readdirSync(p: string): string[] {
      const prefix = `${p}${path.sep}`;
      return Object.keys(files)
        .filter(k => k.startsWith(prefix))
        .map(k => k.slice(prefix.length));
    },
  });

  it('引用块齐全 + SSOT 头 + DoD≥8 通过', () => {
    const dir = path.join('docs', 'phase3-outline');
    const refs = ['blog-system-interface-contract.md', 'blog-system-glossary.md', 'blog-system-traceability-matrix.md', 'blog-system-behavior-spec.md', 'blog-system-discipline-dod.md', 'blog-system-uml-modeling.md'];
    let spec = refs.map(r => `> 详见 [x](./${r})`).join('\n');
    spec += '\n> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    const files: Record<string, string> = {};
    for (const r of refs) files[path.join(dir, r)] = '';
    files[path.join(dir, 'blog-system-interface-design.md')] = spec;
    files[path.join(dir, 'blog-system-discipline-dod.md')] = Array(9).fill('- [ ] x').join('\n');
    const v = checkPhaseSpecStructure(3, dir, mkFs(files));
    expect([...v.refs, ...v.ssot, ...v.dod]).toEqual([]);
  });

  it('引用文件缺失报 refs', () => {
    const dir = path.join('docs', 'phase3-outline');
    const files: Record<string, string> = {};
    files[path.join(dir, 'blog-system-interface-design.md')] = '> 详见 [x](./blog-system-uml-modeling.md)\n> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    files[path.join(dir, 'blog-system-discipline-dod.md')] = Array(9).fill('- [ ] x').join('\n');
    const v = checkPhaseSpecStructure(3, dir, mkFs(files));
    expect(v.refs.length).toBeGreaterThan(0);
  });

  it('主文档 glob 零个报 refs', () => {
    const dir = path.join('docs', 'phase3-outline');
    const files: Record<string, string> = {};
    files[path.join(dir, 'blog-system-discipline-dod.md')] = Array(9).fill('- [ ] x').join('\n');
    const v = checkPhaseSpecStructure(3, dir, mkFs(files));
    expect(v.refs.some(m => m.includes('主文档 glob'))).toBe(true);
  });
});

// ==================== 第 38 轮 Phase 3 结构校验经 checkArtifactGate 生效 ====================
// checkArtifactGate 内部经 nodeFsAdapter 真实读盘（不可注入内存 fs），故用 node:fs + os.tmpdir
// 构造真实产物目录，正反双向断言 phase=3 分支被触发（缺陷态：reasons 无任何 structure 消息）。
describe('Phase 3 结构校验经 checkArtifactGate 生效', () => {
  // phase=3 合法 RTM（PHASE_TRACE_FIELDS[3]=description/designDoc/acceptanceTest，测试层不强制）
  const matrix: RTMMatrixShape = {
    rows: [{
      requirementId: 'REQ-001',
      description: '登录',
      designDoc: 'SD-3.1',
      codeModule: '',
      unitTest: '',
      integrationTest: '',
      systemTest: '',
      acceptanceTest: 'UAT-001',
    }],
    executionSummary: {
      unitTest: { total: 1, passed: 1, failed: 0, pending: 0, coverage: 90 },
      integrationTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
      systemTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
      acceptanceTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
    },
  };

  it('phase=3 + specDir 合法目录 → 零 structure 违反；删 1 个引用文件 → 含 structure 违反', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase3-gate-'));
    try {
      const dir = path.join(tmp, 'docs', 'phase3-outline');
      fs.mkdirSync(dir, { recursive: true });
      const module = 'blog-system';
      const refs = ['interface-contract', 'glossary', 'traceability-matrix', 'behavior-spec', 'discipline-dod', 'uml-modeling'];
      // 主文档：6 个引用块 + §0 SSOT 头四项
      const spec =
        refs.map(r => `> 详见 [x](./${module}-${r}.md)`).join('\n') +
        '\n> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
      for (const r of refs) fs.writeFileSync(path.join(dir, `${module}-${r}.md`), '');
      fs.writeFileSync(path.join(dir, `${module}-interface-design.md`), spec);
      fs.writeFileSync(path.join(dir, `${module}-discipline-dod.md`), Array(9).fill('- [ ] x').join('\n'));

      // 正向：合法 7 文件产物 → structure 零违反
      const ok = checkArtifactGate(matrix, { phaseOption: 3, specDir: dir });
      expect(ok.reasons.some(r => r.startsWith('structure'))).toBe(false);

      // 反向：删 1 个引用文件 → structure 违反出现（证明 phase=3 分支被触发，false-pass 已闭合）
      fs.rmSync(path.join(dir, `${module}-uml-modeling.md`));
      const bad = checkArtifactGate(matrix, { phaseOption: 3, specDir: dir });
      expect(bad.reasons.some(r => r.startsWith('structure'))).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ==================== 第 38 轮 Phase 4 详细设计结构校验 ====================
// 样本键统一用正斜杠书写，mkFs 内部按 path.sep 归一化，保证 Windows 反斜杠下可命中。
describe('Phase 4 详细设计结构校验', () => {
  const mkFs = (files: Record<string, string>) => ({
    readFileSync(p: string): string {
      const k = p.split(path.sep).join('/');
      if (!(k in files)) throw new Error(`missing ${p}`);
      return files[k] ?? '';
    },
    existsSync(p: string): boolean {
      return p.split(path.sep).join('/') in files;
    },
    readdirSync(p: string): string[] {
      const prefix = `${p.split(path.sep).join('/')}/`;
      return Object.keys(files)
        .filter(k => k.startsWith(prefix))
        .map(k => k.slice(prefix.length));
    },
  });

  it('引用块齐全 + SSOT 头 + DoD≥8 通过', () => {
    const files: Record<string, string> = {};
    const refs = ['blog-system-class-design.md', 'blog-system-data-model.md', 'blog-system-glossary.md', 'blog-system-traceability-matrix.md', 'blog-system-behavior-spec.md', 'blog-system-discipline-dod.md'];
    let spec = refs.map(r => `> 详见 [x](./${r})`).join('\n');
    spec += '\n> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    for (const r of refs) files[`docs/phase4-detailed/${r}`] = '';
    files['docs/phase4-detailed/blog-system-detailed-design.md'] = spec;
    files['docs/phase4-detailed/blog-system-discipline-dod.md'] = Array(9).fill('- [ ] x').join('\n');
    const v = checkPhaseSpecStructure(4, 'docs/phase4-detailed', mkFs(files));
    expect([...v.refs, ...v.ssot, ...v.dod]).toEqual([]);
  });

  it('引用文件缺失报 refs', () => {
    const files: Record<string, string> = {};
    files['docs/phase4-detailed/blog-system-detailed-design.md'] = '> 详见 [x](./blog-system-discipline-dod.md)\n> **文档版本**\n> **SSOT 声明**\n> **自身校验**\n> **禁止占位词**\n';
    files['docs/phase4-detailed/blog-system-discipline-dod.md'] = Array(9).fill('- [ ] x').join('\n');
    const v = checkPhaseSpecStructure(4, 'docs/phase4-detailed', mkFs(files));
    expect(v.refs.length).toBeGreaterThan(0);
  });

  it('主文档 glob 零个报 refs', () => {
    const files: Record<string, string> = {};
    files['docs/phase4-detailed/blog-system-discipline-dod.md'] = Array(9).fill('- [ ] x').join('\n');
    const v = checkPhaseSpecStructure(4, 'docs/phase4-detailed', mkFs(files));
    expect(v.refs.some(m => m.includes('主文档 glob'))).toBe(true);
  });
});
