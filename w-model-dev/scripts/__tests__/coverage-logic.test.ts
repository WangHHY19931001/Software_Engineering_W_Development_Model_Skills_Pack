/**
 * coverage-logic.test.ts —— C1-C10 覆盖分析校验单元测试
 *
 * 覆盖 coverage-logic.ts 中四维·维度4 的覆盖矩阵规则：
 *   C1  stakeholders 非空
 *   C3  scenarios 非空
 *   C4  scenarios 含 happy/error/boundary 三类
 *   C5  requirementTypes 含 REQ/NFR/CON 三类
 *   C7  crossCuts 与 graphCrossCuts 双向一致
 *   C8  metrics 4 项均 = 100%（不允许 partial）
 *   C9  status=missing 须在 Out of Scope 声明（无 outOfScope → warning；有 → fail）
 *   C10 metrics 重算一致性
 *   豁免  exemptions 跳过对应规则
 *   全通过 4 张矩阵完整 + 100% → passed=true
 */

import { describe, it, expect } from 'vitest';
import { checkRequirementCoverage, type CoverageShape } from '../coverage-logic.js';

/** 构造一份全通过的合法 CoverageShape（4 张矩阵完整 + 100% 覆盖率） */
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
      { type: 'REQ', reqIds: ['REQ-001'], status: 'covered' },
      { type: 'NFR', reqIds: ['NFR-001'], status: 'covered' },
      { type: 'CON', reqIds: ['CON-001'], status: 'covered' },
    ],
    crossCuts: [
      { nfrConId: 'NFR-001', governedReqs: ['REQ-001'], status: 'covered' },
    ],
    metrics: { stakeholder: 100, scenario: 100, requirementType: 100, crossCut: 100 },
  };
}

describe('C1-C10 覆盖分析校验', () => {
  // ==================== C1: stakeholders 非空 ====================
  describe('C1: stakeholders 非空', () => {
    it('C1: stakeholders 数组为空应 fail', () => {
      const coverage = makeValidCoverage();
      coverage.stakeholders = [];
      coverage.metrics.stakeholder = 100; // 空集视作 100%（vacuously true），匹配重算避免 C10 噪声
      const result = checkRequirementCoverage(coverage);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('C1'))).toBe(true);
    });
  });

  // ==================== C3: scenarios 非空 ====================
  describe('C3: scenarios 非空', () => {
    it('C3: scenarios 数组为空应 fail', () => {
      const coverage = makeValidCoverage();
      coverage.scenarios = [];
      coverage.metrics.scenario = 100; // 空集视作 100%（vacuously true），匹配重算避免 C10 噪声
      const result = checkRequirementCoverage(coverage);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('C3'))).toBe(true);
    });
  });

  // ==================== C4: scenarios 含 happy/error/boundary ====================
  describe('C4: scenarios 场景类型完整', () => {
    it('C4: 缺 error 场景类型应 fail', () => {
      const coverage = makeValidCoverage();
      coverage.scenarios = coverage.scenarios.filter(s => s.scenarioType !== 'error');
      coverage.metrics.scenario = 100; // 2 covered → recalc 100，匹配
      const result = checkRequirementCoverage(coverage);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('C4') && v.includes('error'))).toBe(true);
    });

    it('C4: 缺 boundary 场景类型应 fail', () => {
      const coverage = makeValidCoverage();
      coverage.scenarios = coverage.scenarios.filter(s => s.scenarioType !== 'boundary');
      coverage.metrics.scenario = 100;
      const result = checkRequirementCoverage(coverage);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('C4') && v.includes('boundary'))).toBe(true);
    });
  });

  // ==================== C5: requirementTypes 含 REQ/NFR/CON ====================
  describe('C5: requirementTypes 需求类型完整', () => {
    it('C5: 缺 NFR 类型应 fail', () => {
      const coverage = makeValidCoverage();
      coverage.requirementTypes = coverage.requirementTypes.filter(r => r.type !== 'NFR');
      coverage.metrics.requirementType = 100; // 2 covered → recalc 100
      const result = checkRequirementCoverage(coverage);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('C5') && v.includes('NFR'))).toBe(true);
    });

    it('C5: 缺 CON 类型应 fail', () => {
      const coverage = makeValidCoverage();
      coverage.requirementTypes = coverage.requirementTypes.filter(r => r.type !== 'CON');
      coverage.metrics.requirementType = 100;
      const result = checkRequirementCoverage(coverage);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('C5') && v.includes('CON'))).toBe(true);
    });
  });

  // ==================== C7: crossCuts 与 graphCrossCuts 一致 ====================
  describe('C7: crossCuts 与 graphCrossCuts 双向一致', () => {
    it('C7: coverage 有但 graph 无的 cross-cuts 边应 fail', () => {
      const coverage = makeValidCoverage();
      const result = checkRequirementCoverage(coverage, {
        graphCrossCuts: [], // graph 无任何 cross-cuts 边
      });
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('C7') && v.includes('coverage 有但'))).toBe(true);
    });

    it('C7: graph 有但 coverage 无的 cross-cuts 边应 fail', () => {
      const coverage = makeValidCoverage();
      coverage.crossCuts = []; // coverage 无 cross-cuts
      coverage.metrics.crossCut = 0; // 匹配重算
      const result = checkRequirementCoverage(coverage, {
        graphCrossCuts: [{ from: 'NFR-001', to: 'REQ-001' }],
      });
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('C7') && v.includes('graph.json 有但'))).toBe(true);
    });

    it('C7: 双向一致时无违规', () => {
      const coverage = makeValidCoverage();
      const result = checkRequirementCoverage(coverage, {
        graphCrossCuts: [{ from: 'NFR-001', to: 'REQ-001' }],
      });
      expect(result.violations.some(v => v.includes('C7'))).toBe(false);
    });
  });

  // ==================== C8: metrics 4 项均 = 100% ====================
  describe('C8: metrics 4 项均 = 100%', () => {
    it('C8: metrics.stakeholder < 100 应 fail', () => {
      const coverage = makeValidCoverage();
      coverage.stakeholders = [
        { id: 'SH-001', role: '用户', relatedReqs: ['REQ-001'], status: 'covered' },
        { id: 'SH-002', role: '管理员', relatedReqs: ['REQ-002'], status: 'partial' },
      ];
      coverage.metrics.stakeholder = 75; // (1 + 0.5) / 2 * 100 = 75，匹配重算
      const result = checkRequirementCoverage(coverage);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('C8') && v.includes('stakeholder'))).toBe(true);
    });

    it('C8: 存在 partial 项应 fail（即使 metrics=100）', () => {
      const coverage = makeValidCoverage();
      coverage.stakeholders = [
        { id: 'SH-001', role: '用户', relatedReqs: ['REQ-001'], status: 'covered' },
        { id: 'SH-002', role: '管理员', relatedReqs: ['REQ-002'], status: 'partial' },
      ];
      // recalc = 75，设 metrics=75 以匹配重算（隔离 C10），但 partial 仍触发 C8
      coverage.metrics.stakeholder = 75;
      const result = checkRequirementCoverage(coverage);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('C8') && v.includes('partial'))).toBe(true);
    });
  });

  // ==================== C9: status=missing 声明 ====================
  describe('C9: status=missing 须在 Out of Scope 声明', () => {
    it('C9: status=missing 无 outOfScope → warning（不 fail）', () => {
      const coverage = makeValidCoverage();
      coverage.stakeholders = [
        { id: 'SH-001', role: '用户', relatedReqs: ['REQ-001'], status: 'covered' },
        { id: 'SH-002', role: '管理员', relatedReqs: ['REQ-002'], status: 'missing' },
      ];
      coverage.metrics.stakeholder = 50; // (1 + 0) / 2 * 100 = 50
      const result = checkRequirementCoverage(coverage);
      expect(result.warnings.some(w => w.includes('C9'))).toBe(true);
      expect(result.violations.some(v => v.includes('C9'))).toBe(false);
    });

    it('C9: status=missing 有 outOfScope 但未声明 → fail', () => {
      const coverage = makeValidCoverage();
      coverage.stakeholders = [
        { id: 'SH-001', role: '用户', relatedReqs: ['REQ-001'], status: 'covered' },
        { id: 'SH-002', role: '管理员', relatedReqs: ['REQ-002'], status: 'missing' },
      ];
      coverage.metrics.stakeholder = 50;
      const result = checkRequirementCoverage(coverage, {
        outOfScope: ['SH-OTHER'], // SH-002 未声明
      });
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('C9') && v.includes('SH-002'))).toBe(true);
    });

    it('C9: status=missing 有 outOfScope 且已声明 → 无违规', () => {
      const coverage = makeValidCoverage();
      coverage.stakeholders = [
        { id: 'SH-001', role: '用户', relatedReqs: ['REQ-001'], status: 'covered' },
        { id: 'SH-002', role: '管理员', relatedReqs: ['REQ-002'], status: 'missing' },
      ];
      coverage.metrics.stakeholder = 50;
      const result = checkRequirementCoverage(coverage, {
        outOfScope: ['SH-002'],
      });
      expect(result.violations.some(v => v.includes('C9'))).toBe(false);
    });
  });

  // ==================== C10: metrics 重算一致性 ====================
  describe('C10: metrics 重算一致性', () => {
    it('C10: metrics.stakeholder 与重算不一致应 fail', () => {
      const coverage = makeValidCoverage();
      // 全 covered → recalc=100，但声明 metrics=90 → 不一致
      coverage.metrics.stakeholder = 90;
      const result = checkRequirementCoverage(coverage);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('C10') && v.includes('stakeholder'))).toBe(true);
    });

    it('C10: metrics.scenario 与重算不一致应 fail', () => {
      const coverage = makeValidCoverage();
      coverage.metrics.scenario = 80; // recalc=100 → 不一致
      const result = checkRequirementCoverage(coverage);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('C10') && v.includes('scenario'))).toBe(true);
    });
  });

  // ==================== 豁免：exemptions 跳过对应规则 ====================
  describe('豁免: exemptions 跳过对应规则', () => {
    it('豁免 C8: partial 项 + metrics<100 被跳过 → 不报 C8', () => {
      const coverage = makeValidCoverage();
      coverage.stakeholders = [
        { id: 'SH-001', role: '用户', relatedReqs: ['REQ-001'], status: 'covered' },
        { id: 'SH-002', role: '管理员', relatedReqs: ['REQ-002'], status: 'partial' },
      ];
      coverage.metrics.stakeholder = 75; // recalc=75，匹配重算
      const result = checkRequirementCoverage(coverage, { exemptions: ['C8'] });
      expect(result.violations.some(v => v.includes('C8'))).toBe(false);
      expect(result.exemptionsApplied).toContain('C8');
    });

    it('豁免 C1: stakeholders 空被跳过 → 不报 C1', () => {
      const coverage = makeValidCoverage();
      coverage.stakeholders = [];
      coverage.metrics.stakeholder = 100; // 空集视作 100%，匹配重算避免 C10 噪声
      const result = checkRequirementCoverage(coverage, { exemptions: ['C1'] });
      expect(result.violations.some(v => v.includes('C1'))).toBe(false);
      expect(result.exemptionsApplied).toContain('C1');
    });
  });

  // ==================== 完整通过 ====================
  describe('完整通过', () => {
    it('4 张矩阵完整 + 100% 覆盖率 → passed=true', () => {
      const coverage = makeValidCoverage();
      const result = checkRequirementCoverage(coverage, {
        graphCrossCuts: [{ from: 'NFR-001', to: 'REQ-001' }],
      });
      expect(result.passed).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.metrics).toEqual({ stakeholder: 100, scenario: 100, requirementType: 100, crossCut: 100 });
    });
  });
});
