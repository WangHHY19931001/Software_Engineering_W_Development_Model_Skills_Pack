/**
 * graph-logic.test.ts —— R1-R6 四维识别校验单元测试
 *
 * 覆盖 graph-logic.ts 中 phase=1 时启用的四维识别规则：
 *   R1-R4  REQ 层级树（level 必填 / orphan / multiParent / level 单调 / REQ-group 非空）
 *   R5     depends-on 与 precedes 无环
 *   R6     交叉边对称性与源/目标类型（conflicts-with / cross-cuts / precedes）
 *   扩展   reqHierarchy / crossLogic 填充正确性
 *
 * 约定：REQ→REQ parent 边方向 from=parent → to=child（与 R2 parentInCount / R3 toLevel=fromLevel+1 一致）。
 */

import { describe, it, expect } from 'vitest';
import {
  checkRequirementGraph,
  recalculatePassed,
  checkRequirementSpecEnhance,
  checkDetailedSpecEnhance,
  checkDesignSpecEnhance,
  checkOutlineSpecEnhance,
  countMermaidBlocks,
  parseMarkdownTable,
  type GraphShape,
  type GraphCheckResult,
} from '../logic/graph-logic.js';

describe('R1-R6 四维识别校验', () => {
  // ==================== R1-R4: REQ 层级树 ====================
  describe('R1-R4: REQ 层级树', () => {
    it('R1-R4: REQ 节点缺 level 字段应 fail', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          { id: 'REQ-001', type: 'REQ', phase: 1, title: '域', summary: '缺 level' },
          { id: 'REQ-002', type: 'REQ', phase: 1, title: '模块', summary: '缺 level' },
        ],
        edges: [{ from: 'REQ-001', to: 'REQ-002', type: 'parent' }],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('R1-R4'))).toBe(true);
      expect(result.reqHierarchy?.missingLevelReqs).toEqual(['REQ-001', 'REQ-002']);
    });

    it('R2: level≥2 REQ 缺 REQ→REQ parent 入边（orphan）应 fail', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          { id: 'REQ-001', type: 'REQ', phase: 1, title: '域', summary: 'level=1', level: 1 },
          { id: 'REQ-002', type: 'REQ', phase: 1, title: '模块', summary: 'level=2', level: 2, reqGroup: 'REQ-001' },
          { id: 'REQ-003', type: 'REQ', phase: 1, title: '孤儿', summary: 'level=3 缺 parent', level: 3, reqGroup: 'REQ-001' },
        ],
        edges: [{ from: 'REQ-001', to: 'REQ-002', type: 'parent' }],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('R2') && v.includes('orphan'))).toBe(true);
      expect(result.reqHierarchy?.orphanReqs).toContain('REQ-003');
    });

    it('R2: REQ 有多条 REQ→REQ parent 入边（multiParent）应 fail', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          { id: 'REQ-001', type: 'REQ', phase: 1, title: '域A', summary: 'level=1', level: 1 },
          { id: 'REQ-002', type: 'REQ', phase: 1, title: '域B', summary: 'level=1', level: 1 },
          { id: 'REQ-003', type: 'REQ', phase: 1, title: '多父', summary: 'level=2 双父', level: 2, reqGroup: 'REQ-001' },
        ],
        edges: [
          { from: 'REQ-001', to: 'REQ-003', type: 'parent' },
          { from: 'REQ-002', to: 'REQ-003', type: 'parent' },
        ],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('R2') && v.includes('multiParent'))).toBe(true);
      expect(result.reqHierarchy?.multiParentReqs).toContain('REQ-003');
    });

    it('R3: REQ→REQ parent 边 level 不单调（子level≠父level+1）应 fail', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          { id: 'REQ-001', type: 'REQ', phase: 1, title: '域', summary: 'level=1', level: 1 },
          { id: 'REQ-002', type: 'REQ', phase: 1, title: '跳级', summary: 'level=3 跳级', level: 3, reqGroup: 'REQ-001' },
        ],
        edges: [{ from: 'REQ-001', to: 'REQ-002', type: 'parent' }],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('R3'))).toBe(true);
      expect(result.reqHierarchy?.levelMonotonicViolations).toHaveLength(1);
      expect(result.reqHierarchy?.levelMonotonicViolations[0]).toMatchObject({
        from: 'REQ-001',
        to: 'REQ-002',
        fromLevel: 1,
        toLevel: 3,
      });
    });

    it('R4: REQ 总数≥5 但无 level=1 REQ 应 fail', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          { id: 'REQ-001', type: 'REQ', phase: 1, title: '模块A', summary: 'level=2', level: 2, reqGroup: 'REQ-G1' },
          { id: 'REQ-002', type: 'REQ', phase: 1, title: '模块B', summary: 'level=2', level: 2, reqGroup: 'REQ-G1' },
          { id: 'REQ-003', type: 'REQ', phase: 1, title: '功能A', summary: 'level=3', level: 3, reqGroup: 'REQ-G1' },
          { id: 'REQ-004', type: 'REQ', phase: 1, title: '功能B', summary: 'level=3', level: 3, reqGroup: 'REQ-G1' },
          { id: 'REQ-005', type: 'REQ', phase: 1, title: '验收', summary: 'level=4', level: 4, reqGroup: 'REQ-G1' },
        ],
        edges: [
          { from: 'REQ-001', to: 'REQ-003', type: 'parent' },
          { from: 'REQ-001', to: 'REQ-004', type: 'parent' },
          { from: 'REQ-003', to: 'REQ-005', type: 'parent' },
        ],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('R4'))).toBe(true);
      expect(result.reqHierarchy?.groups).toEqual([]);
    });

    it('R4: REQ 总数<5 无 level=1 REQ 不触发 R4（小项目豁免阈值）', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          { id: 'REQ-001', type: 'REQ', phase: 1, title: '模块', summary: 'level=2 小项目', level: 2, reqGroup: 'REQ-G1' },
          { id: 'REQ-002', type: 'REQ', phase: 1, title: '功能', summary: 'level=3', level: 3, reqGroup: 'REQ-G1' },
        ],
        edges: [{ from: 'REQ-001', to: 'REQ-002', type: 'parent' }],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.violations.some(v => v.includes('R4'))).toBe(false);
    });
  });

  // ==================== R5: 依赖/时序无环 ====================
  describe('R5: depends-on 与 precedes 无环', () => {
    it('R5: depends-on 子图有环应 fail', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          { id: 'REQ-001', type: 'REQ', phase: 1, title: '域', summary: 'level=1', level: 1 },
          { id: 'REQ-002', type: 'REQ', phase: 1, title: '模块A', summary: 'level=2', level: 2, reqGroup: 'REQ-001' },
          { id: 'REQ-003', type: 'REQ', phase: 1, title: '模块B', summary: 'level=2', level: 2, reqGroup: 'REQ-001' },
        ],
        edges: [
          { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
          { from: 'REQ-001', to: 'REQ-003', type: 'parent' },
          { from: 'REQ-002', to: 'REQ-003', type: 'depends-on' },
          { from: 'REQ-003', to: 'REQ-002', type: 'depends-on' },
        ],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('R5') && v.includes('depends-on'))).toBe(true);
      expect(result.crossLogic?.dependsOnCycles.length).toBeGreaterThan(0);
    });

    it('R5: precedes 子图有环应 fail', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          { id: 'REQ-001', type: 'REQ', phase: 1, title: '域', summary: 'level=1', level: 1 },
          { id: 'REQ-002', type: 'REQ', phase: 1, title: '模块A', summary: 'level=2', level: 2, reqGroup: 'REQ-001' },
          { id: 'REQ-003', type: 'REQ', phase: 1, title: '模块B', summary: 'level=2', level: 2, reqGroup: 'REQ-001' },
        ],
        edges: [
          { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
          { from: 'REQ-001', to: 'REQ-003', type: 'parent' },
          { from: 'REQ-002', to: 'REQ-003', type: 'precedes' },
          { from: 'REQ-003', to: 'REQ-002', type: 'precedes' },
        ],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('R5') && v.includes('precedes'))).toBe(true);
      expect(result.crossLogic?.precedesCycles.length).toBeGreaterThan(0);
    });

    it('R5: depends-on 与 precedes 无环不触发 R5 违规', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          { id: 'REQ-001', type: 'REQ', phase: 1, title: '域', summary: 'level=1', level: 1 },
          { id: 'REQ-002', type: 'REQ', phase: 1, title: '模块A', summary: 'level=2', level: 2, reqGroup: 'REQ-001' },
          { id: 'REQ-003', type: 'REQ', phase: 1, title: '模块B', summary: 'level=2', level: 2, reqGroup: 'REQ-001' },
        ],
        edges: [
          { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
          { from: 'REQ-001', to: 'REQ-003', type: 'parent' },
          { from: 'REQ-002', to: 'REQ-003', type: 'depends-on' },
          { from: 'REQ-002', to: 'REQ-003', type: 'precedes' },
        ],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.violations.some(v => v.includes('R5'))).toBe(false);
      expect(result.crossLogic?.dependsOnCycles).toEqual([]);
      expect(result.crossLogic?.precedesCycles).toEqual([]);
    });
  });

  // ==================== R6: 交叉边对称性与类型 ====================
  describe('R6: 交叉边对称性与源/目标类型', () => {
    it('R6: conflicts-with 非对称仅记录为 crossLogic 字段（warning，不 fail）', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          { id: 'REQ-001', type: 'REQ', phase: 1, title: '域', summary: 'level=1', level: 1 },
          { id: 'REQ-002', type: 'REQ', phase: 1, title: '模块', summary: 'level=2', level: 2, reqGroup: 'REQ-001' },
        ],
        edges: [
          { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
          { from: 'REQ-001', to: 'REQ-002', type: 'conflicts-with' },
        ],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.crossLogic?.conflictsAsymmetric).toContain('REQ-001→REQ-002');
      expect(result.violations.some(v => v.includes('conflicts'))).toBe(false);
    });

    it('R6: conflicts-with 对称（双向）不记录非对称', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          { id: 'REQ-001', type: 'REQ', phase: 1, title: '域', summary: 'level=1', level: 1 },
          { id: 'REQ-002', type: 'REQ', phase: 1, title: '模块', summary: 'level=2', level: 2, reqGroup: 'REQ-001' },
        ],
        edges: [
          { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
          { from: 'REQ-001', to: 'REQ-002', type: 'conflicts-with' },
          { from: 'REQ-002', to: 'REQ-001', type: 'conflicts-with' },
        ],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.crossLogic?.conflictsAsymmetric).toEqual([]);
    });

    it('R6: cross-cuts 目标非 REQ 应 fail', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          { id: 'REQ-001', type: 'REQ', phase: 1, title: '域', summary: 'level=1', level: 1 },
          { id: 'REQ-002', type: 'REQ', phase: 1, title: 'NFR', summary: '横切NFR', level: 1 },
          { id: 'EXT-OUT-001', type: 'EXT-OUT', phase: 1, title: '边界汇', summary: '外部输出' },
        ],
        edges: [
          { from: 'REQ-002', to: 'EXT-OUT-001', type: 'cross-cuts' },
        ],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('R6') && v.includes('cross-cuts') && v.includes('目标'))).toBe(true);
      expect(result.crossLogic?.crossCutsTargetTypeViolations.length).toBeGreaterThan(0);
    });

    it('R6: precedes 源非 REQ 应 fail', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          { id: 'REQ-001', type: 'REQ', phase: 1, title: '域', summary: 'level=1', level: 1 },
          { id: 'REQ-002', type: 'REQ', phase: 1, title: '模块', summary: 'level=2', level: 2, reqGroup: 'REQ-001' },
          { id: 'EXT-IN-001', type: 'EXT-IN', phase: 1, title: '边界源', summary: '外部输入' },
        ],
        edges: [
          { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
          { from: 'EXT-IN-001', to: 'REQ-002', type: 'precedes' },
        ],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('R6') && v.includes('precedes') && v.includes('源'))).toBe(true);
    });

    it('R6: precedes 目标非 REQ 应 fail', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          { id: 'REQ-001', type: 'REQ', phase: 1, title: '域', summary: 'level=1', level: 1 },
          { id: 'REQ-002', type: 'REQ', phase: 1, title: '模块', summary: 'level=2', level: 2, reqGroup: 'REQ-001' },
          { id: 'EXT-OUT-001', type: 'EXT-OUT', phase: 1, title: '边界汇', summary: '外部输出' },
        ],
        edges: [
          { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
          { from: 'REQ-002', to: 'EXT-OUT-001', type: 'precedes' },
        ],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('R6') && v.includes('precedes') && v.includes('目标'))).toBe(true);
    });
  });

  // ==================== 扩展字段：reqHierarchy / crossLogic 填充正确性 ====================
  describe('扩展字段填充正确性', () => {
    it('reqHierarchy: groups/maxDepth/levelDistribution 填充正确', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          { id: 'REQ-001', type: 'REQ', phase: 1, title: '域A', summary: 'level=1', level: 1 },
          { id: 'REQ-002', type: 'REQ', phase: 1, title: '域B', summary: 'level=1', level: 1 },
          { id: 'REQ-003', type: 'REQ', phase: 1, title: '模块A', summary: 'level=2', level: 2, reqGroup: 'REQ-001' },
          { id: 'REQ-004', type: 'REQ', phase: 1, title: '功能A', summary: 'level=3', level: 3, reqGroup: 'REQ-001' },
          { id: 'REQ-005', type: 'REQ', phase: 1, title: '验收A', summary: 'level=4', level: 4, reqGroup: 'REQ-001' },
        ],
        edges: [
          { from: 'REQ-001', to: 'REQ-003', type: 'parent' },
          { from: 'REQ-003', to: 'REQ-004', type: 'parent' },
          { from: 'REQ-004', to: 'REQ-005', type: 'parent' },
        ],
      };
      const result = checkRequirementGraph(graph, 1);
      const h = result.reqHierarchy;
      expect(h).toBeDefined();
      expect(h?.groups).toEqual(['REQ-001', 'REQ-002']);
      expect(h?.maxDepth).toBe(4);
      expect(h?.levelDistribution).toEqual({ 1: 2, 2: 1, 3: 1, 4: 1 });
      expect(h?.missingLevelReqs).toEqual([]);
    });

    it('crossLogic: conflictsAsymmetric/crossCutsTargetTypeViolations 填充正确', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          { id: 'REQ-001', type: 'REQ', phase: 1, title: '域', summary: 'level=1', level: 1 },
          { id: 'REQ-002', type: 'REQ', phase: 1, title: '模块', summary: 'level=2', level: 2, reqGroup: 'REQ-001' },
          { id: 'REQ-003', type: 'REQ', phase: 1, title: 'NFR', summary: '横切NFR', level: 1 },
          { id: 'EXT-OUT-001', type: 'EXT-OUT', phase: 1, title: '边界汇', summary: '外部输出' },
        ],
        edges: [
          { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
          { from: 'REQ-001', to: 'REQ-002', type: 'conflicts-with' },
          { from: 'REQ-003', to: 'EXT-OUT-001', type: 'cross-cuts' },
          { from: 'REQ-002', to: 'REQ-003', type: 'depends-on' },
          { from: 'REQ-003', to: 'REQ-002', type: 'depends-on' },
        ],
      };
      const result = checkRequirementGraph(graph, 1);
      const cl = result.crossLogic;
      expect(cl).toBeDefined();
      expect(cl?.conflictsAsymmetric).toContain('REQ-001→REQ-002');
      expect(cl?.crossCutsTargetTypeViolations.length).toBeGreaterThan(0);
      expect(cl?.dependsOnCycles.length).toBeGreaterThan(0);
      expect(cl?.precedesCycles).toEqual([]);
      expect(cl?.crossCutsSourceTypeViolations).toEqual([]);
    });
  });

  // ==================== R1-R6 全通过场景 ====================
  describe('R1-R6 全通过', () => {
    it('完整 REQ 层级树 + 无环依赖 + 对称冲突 + 合法横切 → R1-R6 无违规', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          { id: 'REQ-001', type: 'REQ', phase: 1, title: '域', summary: 'level=1', level: 1 },
          { id: 'REQ-002', type: 'REQ', phase: 1, title: '模块', summary: 'level=2', level: 2, reqGroup: 'REQ-001' },
          { id: 'REQ-003', type: 'REQ', phase: 1, title: 'NFR', summary: '横切NFR', level: 1 },
        ],
        edges: [
          { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
          { from: 'REQ-001', to: 'REQ-002', type: 'depends-on' },
          { from: 'REQ-001', to: 'REQ-002', type: 'precedes' },
          { from: 'REQ-001', to: 'REQ-002', type: 'conflicts-with' },
          { from: 'REQ-002', to: 'REQ-001', type: 'conflicts-with' },
          { from: 'REQ-003', to: 'REQ-002', type: 'cross-cuts' },
        ],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.violations.some(v => v.includes('R1-R4'))).toBe(false);
      expect(result.violations.some(v => v.includes('R5'))).toBe(false);
      expect(result.violations.some(v => v.includes('R6'))).toBe(false);
      expect(result.crossLogic?.conflictsAsymmetric).toEqual([]);
      expect(result.crossLogic?.crossCutsTargetTypeViolations).toEqual([]);
      expect(result.crossLogic?.dependsOnCycles).toEqual([]);
      expect(result.crossLogic?.precedesCycles).toEqual([]);
    });
  });
});

describe('[21.0.0] R11 level 正整数校验', () => {
  it('R11: REQ 节点 level 为非正整数应 fail', () => {
    const graph: GraphShape = {
      version: 1,
      currentPhase: 1,
      nodes: [
        { id: 'REQ-001', type: 'REQ', phase: 1, title: '域A', summary: 'level=1', level: 1 },
        { id: 'REQ-002', type: 'REQ', phase: 1, title: '模块A', summary: 'level=0', level: 0, reqGroup: 'REQ-001' },
        { id: 'REQ-003', type: 'REQ', phase: 1, title: '模块B', summary: 'level=-1', level: -1, reqGroup: 'REQ-001' },
      ],
      edges: [
        { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
        { from: 'REQ-001', to: 'REQ-003', type: 'parent' },
      ],
    };
    const result = checkRequirementGraph(graph, 1);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});

// ==================== recalculatePassed（round28 C1/C2） ====================
describe('recalculatePassed（round28 G-C）', () => {
  it('C1: 新增 violation 后 passed 应变为 false', () => {
    const graph: GraphShape = {
      version: 1,
      currentPhase: 1,
      nodes: [
        { id: 'REQ-001', type: 'REQ', phase: 1, title: '域', summary: 'level=1', level: 1 },
        { id: 'REQ-002', type: 'REQ', phase: 1, title: '模块', summary: 'level=2', level: 2, reqGroup: 'REQ-001' },
        { id: 'NFR-001', type: 'REQ', phase: 1, title: '横切NFR', summary: '' },
      ],
      edges: [
        { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
        { from: 'NFR-001', to: 'REQ-002', type: 'cross-cuts' },
      ],
    };
    const result = checkRequirementGraph(graph, 1);
    // 初始应通过（R6 cross-cuts target type OK，NFR→REQ）
    expect(result.passed).toBe(true);
    // 模拟 CLI --rtm R6 检查发现 cross-cuts 源非 NFR/CON 行
    result.violations.push('R6 cross-cuts 源类型校验失败：NFR-001 非 NFR/CON 行');
    result.crossLogic!.crossCutsSourceTypeViolations.push('NFR-001→REQ-002（源 NFR-001 非 NFR/CON 行）');
    recalculatePassed(result, false);
    expect(result.passed).toBe(false);
  });

  it('C2: 多 group 纯 REQ 图重算 passed 应接受 roots.length >= 1', () => {
    const graph: GraphShape = {
      version: 1,
      currentPhase: 1,
      nodes: [
        { id: 'REQ-001', type: 'REQ', phase: 1, title: '域A', summary: 'level=1', level: 1 },
        { id: 'REQ-002', type: 'REQ', phase: 1, title: '域B', summary: 'level=1', level: 1 },
        { id: 'REQ-003', type: 'REQ', phase: 1, title: '模块A', summary: 'level=2', level: 2, reqGroup: 'REQ-001' },
        { id: 'REQ-004', type: 'REQ', phase: 1, title: '模块B', summary: 'level=2', level: 2, reqGroup: 'REQ-002' },
      ],
      edges: [
        { from: 'REQ-001', to: 'REQ-003', type: 'parent' },
        { from: 'REQ-002', to: 'REQ-004', type: 'parent' },
        { from: 'REQ-001', to: 'REQ-002', type: 'collaborates-with' },
      ],
    };
    const result = checkRequirementGraph(graph, 1);
    // 多 group 纯 REQ 图应通过
    expect(result.passed).toBe(true);
    expect(result.roots.length).toBe(2);
    // 模拟豁免对 R3 违规的过滤（实际无 R3 违规，但重算应保持通过）
    recalculatePassed(result, true);
    expect(result.passed).toBe(true);
  });

  it('C2: 非纯 REQ 图重算 passed 仍要求 roots.length === 1', () => {
    const result: GraphCheckResult = {
      passed: false,
      phase: 2,
      totalNodes: 4,
      totalEdges: 3,
      connectedComponents: 1,
      isolatedNodes: [],
      roots: ['REQ-001', 'REQ-002'],
      orphans: [],
      multiParent: [],
      traceabilityViolations: { SD_without_implements: 0, INTF_without_defines: 0, DD_without_realizes: 0 },
      dataflowViolations: { blackHoles: [], miracles: [], deadModules: [] },
      boundary: { extIn: 1, extOut: 1, complete: true },
      violations: [],
    };
    recalculatePassed(result, false);
    expect(result.passed).toBe(false);
  });
});

// ==================== R7/R8 需求规格产物校验（第 37 轮） ====================
describe('R7 追踪矩阵一致性', () => {
  it('合法矩阵通过', () => {
    const v = checkRequirementSpecEnhance(
      '| 需求号 | 候选落点§ | 验收关联 |\n|---|---|---|\n| REQ-001 | §4.1 | UAT-001 |\n',
      '## 4. 需求层级树\n',
      '```mermaid\ngraph TB\n  A --> B\n```\n',
    );
    expect(v.r7).toEqual([]);
  });
  it('候选落点§ 非法报 R7', () => {
    const v = checkRequirementSpecEnhance(
      '| 需求号 | 候选落点§ | 验收关联 |\n|---|---|---|\n| REQ-001 | xxx | UAT-001 |\n',
      '## 4. 需求层级树\n',
      '',
    );
    expect(v.r7.some(m => m.includes('候选落点§'))).toBe(true);
  });
  it('RTM 集合交叉校验', () => {
    const v = checkRequirementSpecEnhance(
      '| 需求号 | 候选落点§ | 验收关联 |\n|---|---|---|\n| REQ-001 | §4.1 | UAT-001 |\n',
      '## 4. 需求层级树\n',
      '',
      new Set(['REQ-002']),
    );
    expect(v.r7.some(m => m.includes('RTM 登记缺失'))).toBe(true);
  });
});

describe('R8 UML mermaid 块配平', () => {
  it('配平通过', () => {
    const { balanced, pairs } = countMermaidBlocks('```mermaid\na\n```\n```mermaid\nb\n```\n');
    expect(balanced).toBe(true);
    expect(pairs).toBe(2);
  });
  it('未配平报 R8', () => {
    const v = checkRequirementSpecEnhance('', '', '```mermaid\na\n');
    expect(v.r8.some(m => m.includes('配平'))).toBe(true);
  });
});

describe('parseMarkdownTable', () => {
  it('解析表头与数据行', () => {
    const rows = parseMarkdownTable('| 需求号 | 候选落点§ |\n|---|---|\n| REQ-001 | §4.1 |\n');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['需求号']).toBe('REQ-001');
  });

  it('多表格独立解析（§1 字段表 + §2 承接矩阵，模拟模板真实形态）', () => {
    const md = '| 需求号 | 候选落点§ | 验收关联 |\n|---|---|---|\n| REQ-001 | §4.1 | UAT-001 |\n\n## 2. 需求×测试层级承接矩阵\n\n| 需求号 | 单元 | 集成 | 系统端到端 | 验收 |\n|---|---|---|---|---|\n| REQ-001 | ― | ― | ― | ● UAT-001 |\n';
    const rows = parseMarkdownTable(md);
    // §2 表头行不得被当数据行
    expect(rows.some(r => r['需求号'] === '需求号')).toBe(false);
    // 两条真实数据行（REQ-001 各一）
    expect(rows.filter(r => r['需求号'] === 'REQ-001')).toHaveLength(2);
  });
});

describe('R9 系统设计追踪矩阵一致性', () => {
  it('合法矩阵通过', () => {
    const v = checkDesignSpecEnhance(
      '| SD 编号 | 对应需求号 | 设计落点§ |\n|---|---|---|\n| SD-001 | REQ-001 | M-001 |\n',
      '## 3. 模块划分\n',
      '```mermaid\ngraph TB\n  A --> B\n```\n',
    );
    expect(v.r9).toEqual([]);
  });
  it('SD 编号非法报 R9', () => {
    const v = checkDesignSpecEnhance(
      '| SD 编号 | 对应需求号 | 设计落点§ |\n|---|---|---|\n| DD-001 | REQ-001 | M-001 |\n',
      '## 3. 模块划分\n',
      '',
    );
    expect(v.r9.some(m => m.includes('SD 编号格式'))).toBe(true);
  });
});

describe('R10 UML mermaid 块配平', () => {
  it('未配平报 R10', () => {
    const v = checkDesignSpecEnhance('', '', '```mermaid\na\n');
    expect(v.r10.some(m => m.includes('配平'))).toBe(true);
  });
});

describe('R11 概要设计追踪矩阵一致性', () => {
  it('合法矩阵通过', () => {
    const v = checkOutlineSpecEnhance(
      '| INTF 编号 | 对应 SD 编号 | 设计落点§ |\n|---|---|---|\n| INTF-001 | SD-001 | §2.1 |\n',
      '## 2. 接口定义\n',
      '```mermaid\ngraph TB\n  A --> B\n```\n',
    );
    expect(v.r11).toEqual([]);
  });
  it('INTF 编号非法报 R11', () => {
    const v = checkOutlineSpecEnhance(
      '| INTF 编号 | 对应 SD 编号 | 设计落点§ |\n|---|---|---|\n| DD-001 | SD-001 | §2.1 |\n',
      '## 2. 接口定义\n',
      '',
    );
    expect(v.r11.some(m => m.includes('INTF 编号格式'))).toBe(true);
  });
  it('主文档缺 §2 接口定义节报 R11', () => {
    const v = checkOutlineSpecEnhance(
      '| INTF 编号 | 对应 SD 编号 | 设计落点§ |\n|---|---|---|\n| INTF-001 | SD-001 | §2.1 |\n',
      '## 1. 模块调用关系\n',
      '',
    );
    expect(v.r11.some(m => m.includes('主文档缺 §2 接口定义节'))).toBe(true);
  });
});

describe('R12 UML mermaid 块配平', () => {
  it('未配平报 R12', () => {
    const v = checkOutlineSpecEnhance('', '', '```mermaid\na\n');
    expect(v.r12.some(m => m.includes('配平'))).toBe(true);
  });
});

describe('R13 详细设计追踪矩阵一致性', () => {
  it('合法矩阵通过', () => {
    const v = checkDetailedSpecEnhance(
      '| DD 编号 | 对应 INTF 编号 | 设计落点§ |\n|---|---|---|\n| DD-001 | INTF-001 | §1 |\n',
      '## 1. 类设计\n',
      '```mermaid\nclassDiagram\n  class E1 { +attr }\n```\n',
    );
    expect(v.r13).toEqual([]);
  });
  it('DD 编号非法报 R13', () => {
    const v = checkDetailedSpecEnhance(
      '| DD 编号 | 对应 INTF 编号 | 设计落点§ |\n|---|---|---|\n| SD-001 | INTF-001 | §1 |\n',
      '## 1. 类设计\n',
      '',
    );
    expect(v.r13.some(m => m.includes('DD 编号格式'))).toBe(true);
  });
  it('主文档缺 §1 类设计节报 R13', () => {
    const v = checkDetailedSpecEnhance(
      '| DD 编号 | 对应 INTF 编号 | 设计落点§ |\n|---|---|---|\n| DD-001 | INTF-001 | §1 |\n',
      '## 2. 数据库设计\n',
      '',
    );
    expect(v.r13.some(m => m.includes('主文档缺 §1 类设计节'))).toBe(true);
  });
});

describe('R14 UML mermaid 块配平', () => {
  it('未配平报 R14', () => {
    const v = checkDetailedSpecEnhance('', '', '```mermaid\na\n');
    expect(v.r14.some(m => m.includes('配平'))).toBe(true);
  });
});
