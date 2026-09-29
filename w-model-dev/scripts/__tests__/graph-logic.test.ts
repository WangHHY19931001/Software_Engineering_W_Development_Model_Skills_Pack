/**
 * graph-logic.test.ts —— R1-R6 四维识别校验单元测试
 *
 * 覆盖 graph-logic.ts 中 phase=1 时启用的四维识别规则：
 *   R1-R4  REQ 层级树（level 必填 / orphan / multiParent / level 单调 / REQ-group 非空）
 *   R5     depends-on 与 precedes 无环
 *   R6     交叉边对称性与源/目标类型（conflicts-with / cross-cuts / precedes）
 *   扩展   reqHierarchy / crossLogic 填充正确性
 *
 * 末段另有**真实目录树 + 真实 CLI 子进程**用例锁锚点基准解析（D2 回归：
 * gitignored `.w-model/gate-logs` 残留不得截断项目根）——该维度发生在 CLI 层 I/O 解析，
 * logic 层用例（注入 existingAnchorPaths）覆盖不到。
 *
 * 约定：REQ→REQ parent 边方向 from=parent → to=child（与 R2 parentInCount / R3 toLevel=fromLevel+1 一致）。
 */

import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

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
import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');

describe('R1-R6 四维识别校验', () => {
  // ==================== R1-R4: REQ 层级树 ====================
  describe('R1-R4: REQ 层级树', () => {
    it('R1-R4: REQ 节点缺 level 字段应 fail', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          {
            id: 'REQ-001',
            type: 'REQ',
            phase: 1,
            title: '域',
            summary: '缺 level',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
          },
          {
            id: 'REQ-002',
            type: 'REQ',
            phase: 1,
            title: '模块',
            summary: '缺 level',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
          },
        ],
        edges: [{ from: 'REQ-001', to: 'REQ-002', type: 'parent' }],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.includes('R1-R4'))).toBe(true);
      expect(result.reqHierarchy?.missingLevelReqs).toEqual(['REQ-001', 'REQ-002']);
    });

    it('R2: level≥2 REQ 缺 REQ→REQ parent 入边（orphan）应 fail', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          {
            id: 'REQ-001',
            type: 'REQ',
            phase: 1,
            title: '域',
            summary: 'level=1',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 1,
          },
          {
            id: 'REQ-002',
            type: 'REQ',
            phase: 1,
            title: '模块',
            summary: 'level=2',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 2,
            reqGroup: 'REQ-001',
          },
          {
            id: 'REQ-003',
            type: 'REQ',
            phase: 1,
            title: '孤儿',
            summary: 'level=3 缺 parent',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 3,
            reqGroup: 'REQ-001',
          },
        ],
        edges: [{ from: 'REQ-001', to: 'REQ-002', type: 'parent' }],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.includes('R2') && v.includes('orphan'))).toBe(true);
      expect(result.reqHierarchy?.orphanReqs).toContain('REQ-003');
    });

    it('R2: REQ 有多条 REQ→REQ parent 入边（multiParent）应 fail', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          {
            id: 'REQ-001',
            type: 'REQ',
            phase: 1,
            title: '域A',
            summary: 'level=1',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 1,
          },
          {
            id: 'REQ-002',
            type: 'REQ',
            phase: 1,
            title: '域B',
            summary: 'level=1',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 1,
          },
          {
            id: 'REQ-003',
            type: 'REQ',
            phase: 1,
            title: '多父',
            summary: 'level=2 双父',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 2,
            reqGroup: 'REQ-001',
          },
        ],
        edges: [
          { from: 'REQ-001', to: 'REQ-003', type: 'parent' },
          { from: 'REQ-002', to: 'REQ-003', type: 'parent' },
        ],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.includes('R2') && v.includes('multiParent'))).toBe(true);
      expect(result.reqHierarchy?.multiParentReqs).toContain('REQ-003');
    });

    it('R3: REQ→REQ parent 边 level 不单调（子level≠父level+1）应 fail', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          {
            id: 'REQ-001',
            type: 'REQ',
            phase: 1,
            title: '域',
            summary: 'level=1',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 1,
          },
          {
            id: 'REQ-002',
            type: 'REQ',
            phase: 1,
            title: '跳级',
            summary: 'level=3 跳级',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 3,
            reqGroup: 'REQ-001',
          },
        ],
        edges: [{ from: 'REQ-001', to: 'REQ-002', type: 'parent' }],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.includes('R3'))).toBe(true);
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
          {
            id: 'REQ-001',
            type: 'REQ',
            phase: 1,
            title: '模块A',
            summary: 'level=2',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 2,
            reqGroup: 'REQ-G1',
          },
          {
            id: 'REQ-002',
            type: 'REQ',
            phase: 1,
            title: '模块B',
            summary: 'level=2',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 2,
            reqGroup: 'REQ-G1',
          },
          {
            id: 'REQ-003',
            type: 'REQ',
            phase: 1,
            title: '功能A',
            summary: 'level=3',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 3,
            reqGroup: 'REQ-G1',
          },
          {
            id: 'REQ-004',
            type: 'REQ',
            phase: 1,
            title: '功能B',
            summary: 'level=3',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 3,
            reqGroup: 'REQ-G1',
          },
          {
            id: 'REQ-005',
            type: 'REQ',
            phase: 1,
            title: '验收',
            summary: 'level=4',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 4,
            reqGroup: 'REQ-G1',
          },
        ],
        edges: [
          { from: 'REQ-001', to: 'REQ-003', type: 'parent' },
          { from: 'REQ-001', to: 'REQ-004', type: 'parent' },
          { from: 'REQ-003', to: 'REQ-005', type: 'parent' },
        ],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.includes('R4'))).toBe(true);
      expect(result.reqHierarchy?.groups).toEqual([]);
    });

    it('R4: REQ 总数<5 无 level=1 REQ 不触发 R4（小项目豁免阈值）', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          {
            id: 'REQ-001',
            type: 'REQ',
            phase: 1,
            title: '模块',
            summary: 'level=2 小项目',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 2,
            reqGroup: 'REQ-G1',
          },
          {
            id: 'REQ-002',
            type: 'REQ',
            phase: 1,
            title: '功能',
            summary: 'level=3',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 3,
            reqGroup: 'REQ-G1',
          },
        ],
        edges: [{ from: 'REQ-001', to: 'REQ-002', type: 'parent' }],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.violations.some((v) => v.includes('R4'))).toBe(false);
    });
  });

  // ==================== R5: 依赖/时序无环 ====================
  describe('R5: depends-on 与 precedes 无环', () => {
    /** 三节点双层 REQ 树基底（两测试共用，仅环边类型不同） */
    function cycleGraph(cycleEdgeType: 'depends-on' | 'precedes'): GraphShape {
      return {
        version: 1,
        currentPhase: 1,
        nodes: [
          {
            id: 'REQ-001',
            type: 'REQ',
            phase: 1,
            title: '域',
            summary: 'level=1',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 1,
          },
          {
            id: 'REQ-002',
            type: 'REQ',
            phase: 1,
            title: '模块A',
            summary: 'level=2',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 2,
            reqGroup: 'REQ-001',
          },
          {
            id: 'REQ-003',
            type: 'REQ',
            phase: 1,
            title: '模块B',
            summary: 'level=2',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 2,
            reqGroup: 'REQ-001',
          },
        ],
        edges: [
          { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
          { from: 'REQ-001', to: 'REQ-003', type: 'parent' },
          { from: 'REQ-002', to: 'REQ-003', type: cycleEdgeType },
          { from: 'REQ-003', to: 'REQ-002', type: cycleEdgeType },
        ],
      };
    }

    it('R5 环（2 态：depends-on 子图 / precedes 子图）→ fail 且对应 cycle 字段非空', () => {
      const rows: readonly [
        string,
        'depends-on' | 'precedes',
        (r: GraphCheckResult) => { length: number } | undefined,
      ][] = [
        ['R5: depends-on 子图有环', 'depends-on', (r) => r.crossLogic?.dependsOnCycles],
        ['R5: precedes 子图有环', 'precedes', (r) => r.crossLogic?.precedesCycles],
      ];
      for (const [name, edgeType, cyclesOf] of rows) {
        const result = checkRequirementGraph(cycleGraph(edgeType), 1);
        expect(result.passed, `${name} 应 fail`).toBe(false);
        expect(
          result.violations.some((v) => v.includes('R5') && v.includes(edgeType)),
          `${name} 应报 R5 且点名 ${edgeType}`,
        ).toBe(true);
        expect(cyclesOf(result)?.length, `${name} 对应 cycle 字段应非空`).toBeGreaterThan(0);
      }
    });

    it('R5: depends-on 与 precedes 无环不触发 R5 违规', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          {
            id: 'REQ-001',
            type: 'REQ',
            phase: 1,
            title: '域',
            summary: 'level=1',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 1,
          },
          {
            id: 'REQ-002',
            type: 'REQ',
            phase: 1,
            title: '模块A',
            summary: 'level=2',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 2,
            reqGroup: 'REQ-001',
          },
          {
            id: 'REQ-003',
            type: 'REQ',
            phase: 1,
            title: '模块B',
            summary: 'level=2',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 2,
            reqGroup: 'REQ-001',
          },
        ],
        edges: [
          { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
          { from: 'REQ-001', to: 'REQ-003', type: 'parent' },
          { from: 'REQ-002', to: 'REQ-003', type: 'depends-on' },
          { from: 'REQ-002', to: 'REQ-003', type: 'precedes' },
        ],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.violations.some((v) => v.includes('R5'))).toBe(false);
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
          {
            id: 'REQ-001',
            type: 'REQ',
            phase: 1,
            title: '域',
            summary: 'level=1',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 1,
          },
          {
            id: 'REQ-002',
            type: 'REQ',
            phase: 1,
            title: '模块',
            summary: 'level=2',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 2,
            reqGroup: 'REQ-001',
          },
        ],
        edges: [
          { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
          { from: 'REQ-001', to: 'REQ-002', type: 'conflicts-with' },
        ],
      };
      const result = checkRequirementGraph(graph, 1);
      expect(result.crossLogic?.conflictsAsymmetric).toContain('REQ-001→REQ-002');
      expect(result.violations.some((v) => v.includes('conflicts'))).toBe(false);
    });

    it('R6: conflicts-with 对称（双向）不记录非对称', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          {
            id: 'REQ-001',
            type: 'REQ',
            phase: 1,
            title: '域',
            summary: 'level=1',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 1,
          },
          {
            id: 'REQ-002',
            type: 'REQ',
            phase: 1,
            title: '模块',
            summary: 'level=2',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 2,
            reqGroup: 'REQ-001',
          },
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

    it('R6 非 REQ 端点（3 态：cross-cuts 目标 / precedes 源 / precedes 目标）→ fail', () => {
      const anchor = 'docs/phase1-requirements/requirement-spec.md:§4=sample fact';
      const req = (
        id: string,
        title: string,
        summary: string,
        level: number,
        reqGroup?: string,
      ): GraphShape['nodes'][number] => ({
        id,
        type: 'REQ',
        phase: 1,
        title,
        summary,
        evidenceAnchor: anchor,
        evidenceStatus: 'confirmed',
        level,
        ...(reqGroup ? { reqGroup } : {}),
      });
      const ext = (
        id: string,
        type: 'EXT-IN' | 'EXT-OUT',
        title: string,
        summary: string,
      ): GraphShape['nodes'][number] => ({
        id,
        type,
        phase: 1,
        title,
        summary,
        evidenceAnchor: anchor,
        evidenceStatus: 'confirmed',
      });
      const rows: readonly [
        string,
        GraphShape['nodes'],
        GraphShape['edges'],
        string[],
        ((r: GraphCheckResult) => void) | null,
      ][] = [
        [
          'R6: cross-cuts 目标非 REQ',
          [
            req('REQ-001', '域', 'level=1', 1),
            req('REQ-002', 'NFR', '横切NFR', 1),
            ext('EXT-OUT-001', 'EXT-OUT', '边界汇', '外部输出'),
          ],
          [{ from: 'REQ-002', to: 'EXT-OUT-001', type: 'cross-cuts' }],
          ['R6', 'cross-cuts', '目标'],
          (r) => {
            expect(
              r.crossLogic?.crossCutsTargetTypeViolations.length,
              'cross-cuts 目标违规应记入 crossLogic',
            ).toBeGreaterThan(0);
          },
        ],
        [
          'R6: precedes 源非 REQ',
          [
            req('REQ-001', '域', 'level=1', 1),
            req('REQ-002', '模块', 'level=2', 2, 'REQ-001'),
            ext('EXT-IN-001', 'EXT-IN', '边界源', '外部输入'),
          ],
          [
            { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
            { from: 'EXT-IN-001', to: 'REQ-002', type: 'precedes' },
          ],
          ['R6', 'precedes', '源'],
          null,
        ],
        [
          'R6: precedes 目标非 REQ',
          [
            req('REQ-001', '域', 'level=1', 1),
            req('REQ-002', '模块', 'level=2', 2, 'REQ-001'),
            ext('EXT-OUT-001', 'EXT-OUT', '边界汇', '外部输出'),
          ],
          [
            { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
            { from: 'REQ-002', to: 'EXT-OUT-001', type: 'precedes' },
          ],
          ['R6', 'precedes', '目标'],
          null,
        ],
      ];
      for (const [name, nodes, edges, tokens, extra] of rows) {
        const result = checkRequirementGraph({ version: 1, currentPhase: 1, nodes, edges } as GraphShape, 1);
        expect(result.passed, `${name} 应 fail`).toBe(false);
        expect(
          result.violations.some((v) => tokens.every((t) => v.includes(t))),
          `${name} 应报 ${tokens.join(' + ')}`,
        ).toBe(true);
        if (extra) extra(result);
      }
    });
  });

  // ==================== 扩展字段：reqHierarchy / crossLogic 填充正确性 ====================
  describe('扩展字段填充正确性', () => {
    it('reqHierarchy: groups/maxDepth/levelDistribution 填充正确', () => {
      const graph: GraphShape = {
        version: 1,
        currentPhase: 1,
        nodes: [
          {
            id: 'REQ-001',
            type: 'REQ',
            phase: 1,
            title: '域A',
            summary: 'level=1',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 1,
          },
          {
            id: 'REQ-002',
            type: 'REQ',
            phase: 1,
            title: '域B',
            summary: 'level=1',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 1,
          },
          {
            id: 'REQ-003',
            type: 'REQ',
            phase: 1,
            title: '模块A',
            summary: 'level=2',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 2,
            reqGroup: 'REQ-001',
          },
          {
            id: 'REQ-004',
            type: 'REQ',
            phase: 1,
            title: '功能A',
            summary: 'level=3',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 3,
            reqGroup: 'REQ-001',
          },
          {
            id: 'REQ-005',
            type: 'REQ',
            phase: 1,
            title: '验收A',
            summary: 'level=4',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 4,
            reqGroup: 'REQ-001',
          },
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
          {
            id: 'REQ-001',
            type: 'REQ',
            phase: 1,
            title: '域',
            summary: 'level=1',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 1,
          },
          {
            id: 'REQ-002',
            type: 'REQ',
            phase: 1,
            title: '模块',
            summary: 'level=2',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 2,
            reqGroup: 'REQ-001',
          },
          {
            id: 'REQ-003',
            type: 'REQ',
            phase: 1,
            title: 'NFR',
            summary: '横切NFR',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 1,
          },
          {
            id: 'EXT-OUT-001',
            type: 'EXT-OUT',
            phase: 1,
            title: '边界汇',
            summary: '外部输出',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
          },
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
          {
            id: 'REQ-001',
            type: 'REQ',
            phase: 1,
            title: '域',
            summary: 'level=1',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 1,
          },
          {
            id: 'REQ-002',
            type: 'REQ',
            phase: 1,
            title: '模块',
            summary: 'level=2',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 2,
            reqGroup: 'REQ-001',
          },
          {
            id: 'REQ-003',
            type: 'REQ',
            phase: 1,
            title: 'NFR',
            summary: '横切NFR',
            evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
            evidenceStatus: 'confirmed',
            level: 1,
          },
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
      expect(result.violations.some((v) => v.includes('R1-R4'))).toBe(false);
      expect(result.violations.some((v) => v.includes('R5'))).toBe(false);
      expect(result.violations.some((v) => v.includes('R6'))).toBe(false);
      expect(result.crossLogic?.conflictsAsymmetric).toEqual([]);
      expect(result.crossLogic?.crossCutsTargetTypeViolations).toEqual([]);
      expect(result.crossLogic?.dependsOnCycles).toEqual([]);
      expect(result.crossLogic?.precedesCycles).toEqual([]);
    });
  });
});

describe('轮次上限校验（MAX_GRAPH_ROUNDS=5）', () => {
  /** 合法 phase=1 纯 REQ 图基底（单根 + 单子，无其他违规） */
  function baseGraph(analysisRounds?: GraphShape['analysisRounds']): GraphShape {
    return {
      version: 1,
      currentPhase: 1,
      nodes: [
        {
          id: 'REQ-001',
          type: 'REQ',
          phase: 1,
          title: '域',
          summary: 'level=1',
          evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
          evidenceStatus: 'confirmed',
          level: 1,
        },
        {
          id: 'REQ-002',
          type: 'REQ',
          phase: 1,
          title: '模块',
          summary: 'level=2',
          evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
          evidenceStatus: 'confirmed',
          level: 2,
          reqGroup: 'REQ-001',
        },
      ],
      edges: [{ from: 'REQ-001', to: 'REQ-002', type: 'parent' }],
      ...(analysisRounds ? { analysisRounds } : {}),
    };
  }

  it('analysisRounds 边界（4 态：round=6 越界 / round=5 边界值 / 仅点名越界者 / 缺字段不校验）', () => {
    const rows: readonly [
      string,
      GraphShape['analysisRounds'] | undefined,
      string,
      'violation' | 'clean-passed' | 'named-only' | 'clean',
    ][] = [
      [
        'analysisRounds 含 round=6 > 5 → 轮次上限违规且 passed=false',
        [{ phase: 1, round: 6, violations: [], converged: false }],
        /轮次上限校验失败.*round > 5.*phase1\/round6/.source,
        'violation',
      ],
      [
        'round=5 恰好等于上限 → 不报轮次违规（passed 由其余校验决定）',
        [{ phase: 1, round: 5, violations: [], converged: true }],
        '轮次上限校验失败',
        'clean-passed',
      ],
      [
        '多轮记录仅越界者被点名（round 1-4 合法 + round 7 越界）',
        [
          { phase: 1, round: 1, violations: ['x'], converged: false },
          { phase: 1, round: 4, violations: [], converged: false },
          { phase: 1, round: 7, violations: [], converged: false },
        ],
        'phase1/round7',
        'named-only',
      ],
      ['无 analysisRounds 字段 → 不报轮次违规（存在才校验）', undefined, '轮次上限校验失败', 'clean'],
    ];
    for (const [name, rounds, token, kind] of rows) {
      const graph = baseGraph(rounds);
      const result = checkRequirementGraph(graph, 1);
      if (kind === 'violation') {
        expect(result.passed, `${name} 应 fail`).toBe(false);
        expect(
          result.violations.some((v) => new RegExp(token).test(v)),
          `${name} 应报轮次上限违规（${token}）`,
        ).toBe(true);
      } else if (kind === 'clean-passed') {
        expect(
          result.violations.some((v) => v.includes(token)),
          `${name} 不应报轮次违规`,
        ).toBe(false);
        expect(result.passed, `${name} 应通过`).toBe(true);
      } else if (kind === 'named-only') {
        const v = result.violations.find((x) => x.includes('轮次上限校验失败'))!;
        expect(v, `${name} 应点名 phase1/round7`).toContain(token);
        expect(v, `${name} 不应点名合法轮次`).not.toContain('phase1/round4');
      } else {
        expect(
          result.violations.some((v) => v.includes(token)),
          `${name} 不应报轮次违规`,
        ).toBe(false);
      }
    }
  });
});

describe('R11 level 正整数校验', () => {
  it('R11: REQ 节点 level 为非正整数应 fail', () => {
    const graph: GraphShape = {
      version: 1,
      currentPhase: 1,
      nodes: [
        {
          id: 'REQ-001',
          type: 'REQ',
          phase: 1,
          title: '域A',
          summary: 'level=1',
          evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
          evidenceStatus: 'confirmed',
          level: 1,
        },
        {
          id: 'REQ-002',
          type: 'REQ',
          phase: 1,
          title: '模块A',
          summary: 'level=0',
          evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
          evidenceStatus: 'confirmed',
          level: 0,
          reqGroup: 'REQ-001',
        },
        {
          id: 'REQ-003',
          type: 'REQ',
          phase: 1,
          title: '模块B',
          summary: 'level=-1',
          evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
          evidenceStatus: 'confirmed',
          level: -1,
          reqGroup: 'REQ-001',
        },
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

// ==================== recalculatePassed（C1/C2） ====================
describe('recalculatePassed', () => {
  it('C1: 新增 violation 后 passed 应变为 false', () => {
    const graph: GraphShape = {
      version: 1,
      currentPhase: 1,
      nodes: [
        {
          id: 'REQ-001',
          type: 'REQ',
          phase: 1,
          title: '域',
          summary: 'level=1',
          evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
          evidenceStatus: 'confirmed',
          level: 1,
        },
        {
          id: 'REQ-002',
          type: 'REQ',
          phase: 1,
          title: '模块',
          summary: 'level=2',
          evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
          evidenceStatus: 'confirmed',
          level: 2,
          reqGroup: 'REQ-001',
        },
        {
          id: 'NFR-001',
          type: 'REQ',
          phase: 1,
          title: '横切NFR',
          summary: '',
          evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
          evidenceStatus: 'confirmed',
        },
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
        {
          id: 'REQ-001',
          type: 'REQ',
          phase: 1,
          title: '域A',
          summary: 'level=1',
          evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
          evidenceStatus: 'confirmed',
          level: 1,
        },
        {
          id: 'REQ-002',
          type: 'REQ',
          phase: 1,
          title: '域B',
          summary: 'level=1',
          evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
          evidenceStatus: 'confirmed',
          level: 1,
        },
        {
          id: 'REQ-003',
          type: 'REQ',
          phase: 1,
          title: '模块A',
          summary: 'level=2',
          evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
          evidenceStatus: 'confirmed',
          level: 2,
          reqGroup: 'REQ-001',
        },
        {
          id: 'REQ-004',
          type: 'REQ',
          phase: 1,
          title: '模块B',
          summary: 'level=2',
          evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4=sample fact',
          evidenceStatus: 'confirmed',
          level: 2,
          reqGroup: 'REQ-002',
        },
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
      traceabilityViolations: {
        SD_without_implements: 0,
        INTF_without_defines: 0,
        DD_without_realizes: 0,
      },
      dataflowViolations: { blackHoles: [], miracles: [], deadModules: [] },
      boundary: { extIn: 1, extOut: 1, complete: true },
      duplicateNodeIds: [],
      violations: [],
    };
    recalculatePassed(result, false);
    expect(result.passed).toBe(false);
  });
});

// ==================== R7-R14 阶段设计级产物校验（同构族按「循环内多断言」聚合） ====================
describe('R7 追踪矩阵一致性', () => {
  const REQ_MATRIX = '| 需求号 | 候选落点§ | 验收关联 |\n|---|---|---|\n| REQ-001 | §4.1 | UAT-001 |\n';
  const REQ_MAIN = '## 4. 需求层级树\n';
  const MERMAID_GRAPH = '```mermaid\ngraph TB\n  A --> B\n```\n';

  it('矩阵合法对照（4 态：R7 / R9 / R11 / R13）→ 零违规', () => {
    const rows: readonly [string, (matrix: string, main: string, uml: string) => string[], string, string, string][] = [
      [
        'R7 需求规格合法矩阵',
        (m, d, u) => checkRequirementSpecEnhance(m, d, u).r7,
        REQ_MATRIX,
        REQ_MAIN,
        MERMAID_GRAPH,
      ],
      [
        'R9 系统设计合法矩阵',
        (m, d, u) => checkDesignSpecEnhance(m, d, u).r9,
        '| SD 编号 | 对应需求号 | 设计落点§ |\n|---|---|---|\n| SD-001 | REQ-001 | M-001 |\n',
        '## 3. 模块划分\n',
        MERMAID_GRAPH,
      ],
      [
        'R11 概要设计合法矩阵',
        (m, d, u) => checkOutlineSpecEnhance(m, d, u).r11,
        '| INTF 编号 | 对应 SD 编号 | 设计落点§ |\n|---|---|---|\n| INTF-001 | SD-001 | §2.1 |\n',
        '## 2. 接口定义\n',
        MERMAID_GRAPH,
      ],
      [
        'R13 详细设计合法矩阵',
        (m, d, u) => checkDetailedSpecEnhance(m, d, u).r13,
        '| DD 编号 | 对应 INTF 编号 | 设计落点§ |\n|---|---|---|\n| DD-001 | INTF-001 | §1 |\n',
        '## 1. 类设计\n',
        '```mermaid\nclassDiagram\n  class E1 { +attr }\n```\n',
      ],
    ];
    for (const [name, fieldOf, matrix, main, uml] of rows) {
      expect(fieldOf(matrix, main, uml), `${name} 应零违规`).toEqual([]);
    }
  });

  it('候选落点§ 非法报 R7', () => {
    const v = checkRequirementSpecEnhance(
      '| 需求号 | 候选落点§ | 验收关联 |\n|---|---|---|\n| REQ-001 | xxx | UAT-001 |\n',
      '## 4. 需求层级树\n',
      '',
    );
    expect(v.r7.some((m) => m.includes('候选落点§'))).toBe(true);
  });

  it('RTM 集合交叉校验', () => {
    const v = checkRequirementSpecEnhance(REQ_MATRIX, REQ_MAIN, '', new Set(['REQ-002']));
    expect(v.r7.some((m) => m.includes('RTM 登记缺失'))).toBe(true);
  });
});

describe('R8/R10/R12/R14 UML mermaid 块配平', () => {
  it('配平通过（R8 基线：两对 mermaid 块）', () => {
    const { balanced, pairs } = countMermaidBlocks('```mermaid\na\n```\n```mermaid\nb\n```\n');
    expect(balanced).toBe(true);
    expect(pairs).toBe(2);
  });

  it('矩阵未配平（4 态：R8 / R10 / R12 / R14）→ 报「配平」', () => {
    const rows: readonly [string, (matrix: string, main: string, uml: string) => string[]][] = [
      ['R8 需求规格未配平', (m, d, u) => checkRequirementSpecEnhance(m, d, u).r8],
      ['R10 系统设计未配平', (m, d, u) => checkDesignSpecEnhance(m, d, u).r10],
      ['R12 概要设计未配平', (m, d, u) => checkOutlineSpecEnhance(m, d, u).r12],
      ['R14 详细设计未配平', (m, d, u) => checkDetailedSpecEnhance(m, d, u).r14],
    ];
    for (const [name, fieldOf] of rows) {
      expect(
        fieldOf('', '', '```mermaid\na\n').some((m) => m.includes('配平')),
        `${name} 应报配平违规`,
      ).toBe(true);
    }
  });
});

describe('parseMarkdownTable', () => {
  it('解析表头与数据行', () => {
    const rows = parseMarkdownTable('| 需求号 | 候选落点§ |\n|---|---|\n| REQ-001 | §4.1 |\n');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['需求号']).toBe('REQ-001');
  });

  it('多表格独立解析（§1 字段表 + §2 承接矩阵，模拟模板真实形态）', () => {
    const md =
      '| 需求号 | 候选落点§ | 验收关联 |\n|---|---|---|\n| REQ-001 | §4.1 | UAT-001 |\n\n## 2. 需求×测试层级承接矩阵\n\n| 需求号 | 单元 | 集成 | 系统端到端 | 验收 |\n|---|---|---|---|---|\n| REQ-001 | ― | ― | ― | ● UAT-001 |\n';
    const rows = parseMarkdownTable(md);
    // §2 表头行不得被当数据行
    expect(rows.some((r) => r['需求号'] === '需求号')).toBe(false);
    // 两条真实数据行（REQ-001 各一）
    expect(rows.filter((r) => r['需求号'] === 'REQ-001')).toHaveLength(2);
  });
});

describe('R9/R11/R13 编号非法与主文档缺节', () => {
  const INTF_MATRIX = '| INTF 编号 | 对应 SD 编号 | 设计落点§ |\n|---|---|---|\n| INTF-001 | SD-001 | §2.1 |\n';
  const DD_MATRIX = '| DD 编号 | 对应 INTF 编号 | 设计落点§ |\n|---|---|---|\n| DD-001 | INTF-001 | §1 |\n';

  it('矩阵编号非法（3 态：SD-R9 / INTF-R11 / DD-R13）→ 报编号格式', () => {
    const rows: readonly [
      string,
      (matrix: string, main: string, uml: string) => string[],
      string,
      string,
      string,
      string,
    ][] = [
      [
        'SD 编号非法报 R9（矩阵内混入 DD-001）',
        (m, d, u) => checkDesignSpecEnhance(m, d, u).r9,
        '| SD 编号 | 对应需求号 | 设计落点§ |\n|---|---|---|\n| DD-001 | REQ-001 | M-001 |\n',
        '## 3. 模块划分\n',
        '',
        'SD 编号格式',
      ],
      [
        'INTF 编号非法报 R11（矩阵内混入 DD-001）',
        (m, d, u) => checkOutlineSpecEnhance(m, d, u).r11,
        '| INTF 编号 | 对应 SD 编号 | 设计落点§ |\n|---|---|---|\n| DD-001 | SD-001 | §2.1 |\n',
        '## 2. 接口定义\n',
        '',
        'INTF 编号格式',
      ],
      [
        'DD 编号非法报 R13（矩阵内混入 SD-001）',
        (m, d, u) => checkDetailedSpecEnhance(m, d, u).r13,
        '| DD 编号 | 对应 INTF 编号 | 设计落点§ |\n|---|---|---|\n| SD-001 | INTF-001 | §1 |\n',
        '## 1. 类设计\n',
        '',
        'DD 编号格式',
      ],
    ];
    for (const [name, fieldOf, matrix, main, uml, marker] of rows) {
      expect(
        fieldOf(matrix, main, uml).some((m) => m.includes(marker)),
        `${name} 应报 ${marker}`,
      ).toBe(true);
    }
  });

  it('主文档缺节（2 态：R11 缺 §2 接口定义节 / R13 缺 §1 类设计节）→ 报缺节', () => {
    const rows: readonly [
      string,
      (matrix: string, main: string, uml: string) => string[],
      string,
      string,
      string,
      string,
    ][] = [
      [
        'R11 主文档缺 §2 接口定义节',
        (m, d, u) => checkOutlineSpecEnhance(m, d, u).r11,
        INTF_MATRIX,
        '## 1. 模块调用关系\n',
        '',
        '主文档缺 §2 接口定义节',
      ],
      [
        'R13 主文档缺 §1 类设计节',
        (m, d, u) => checkDetailedSpecEnhance(m, d, u).r13,
        DD_MATRIX,
        '## 2. 数据库设计\n',
        '',
        '主文档缺 §1 类设计节',
      ],
    ];
    for (const [name, fieldOf, matrix, main, uml, marker] of rows) {
      expect(
        fieldOf(matrix, main, uml).some((m) => m.includes(marker)),
        `${name} 应报「${marker}」`,
      ).toBe(true);
    }
  });
});

describe('R15 evidenceAnchor 格式校验', () => {
  function makeReqGraph(anchor?: string, nodes?: Array<Record<string, unknown>>) {
    const baseNodes = [
      {
        id: 'REQ-001',
        type: 'REQ',
        phase: 1,
        title: '用户登录',
        summary: '登录',
        level: 1,
        evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4.2=登录需密码策略（用户原话）',
        evidenceStatus: 'confirmed',
      },
      {
        id: 'REQ-002',
        type: 'REQ',
        phase: 1,
        title: '密码策略',
        summary: '密码',
        level: 2,
        reqGroup: 'REQ-001',
        evidenceAnchor: 'docs/phase1-requirements/requirement-spec.md:§4.2=登录需密码策略（用户原话）',
        evidenceStatus: 'confirmed',
      },
    ];
    let ns = nodes ?? baseNodes;
    if (anchor !== undefined) ns = ns.map((n) => (n.id === 'REQ-002' ? { ...n, evidenceAnchor: anchor } : n));
    return {
      version: 1,
      currentPhase: 1,
      nodes: ns,
      edges: [
        { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
        { from: 'REQ-001', to: 'REQ-002', type: 'produces' },
      ],
      analysisRounds: [{ phase: 1, round: 1, violations: [], converged: true }],
    };
  }

  it('合法锚点形态（2 态：path:§section=statement / path:L42=statement）→ 通过且无 R15', () => {
    const rows: readonly [string, string][] = [
      ['§section 形态', 'docs/phase1-requirements/requirement-spec.md:§4.2=登录需密码策略（用户原话）'],
      ['L42 行号形态', 'src/auth.ts:L42-58=JWT 签发逻辑'],
    ];
    for (const [name, anchor] of rows) {
      const r = checkRequirementGraph(makeReqGraph(anchor), 1);
      expect(r.passed, `${name} 合法锚点应通过`).toBe(true);
      expect(
        r.violations.some((v) => v.includes('R15')),
        `${name} 不应报 R15`,
      ).toBe(false);
    }
  });

  it('非法锚点（无定位）R15 拦截', () => {
    const r = checkRequirementGraph(makeReqGraph('登录需要密码'), 1);
    expect(r.violations.some((v) => v.includes('R15 evidenceAnchor 格式校验失败'))).toBe(true);
    expect(r.passed).toBe(false);
  });

  it('空串锚点由 schema minLength=1 拦截（而非 R15 格式校验）', () => {
    const r = checkRequirementGraph(makeReqGraph(''), 1);
    expect(r.passed).toBe(false);
    expect(r.violations.some((v) => v.includes('R15 evidenceAnchor 格式校验失败'))).toBe(false);
  });
});

// ==================== R15a-f 六子项（A-3c：锚点必填 + 状态 + 存在性 + 行号 + 签名链对账） ====================
describe('R15a-f 证据锚点子项', () => {
  /**
   * 构造纯 REQ 图：默认两节点均带合法锚点 + confirmed，可逐项覆写。
   * r15Violation(out, 'a') 取回以 'R15a' 开头的 violation 文本。
   */
  function makeGraph(overrides: { nodes?: Array<Record<string, unknown>> }): Record<string, unknown> {
    return {
      version: 1,
      currentPhase: 1,
      nodes: overrides.nodes ?? [
        {
          id: 'REQ-001',
          type: 'REQ',
          phase: 1,
          title: '用户登录',
          summary: '登录',
          level: 1,
          evidenceAnchor: 'docs/req.md:§4=登录需密码',
          evidenceStatus: 'confirmed',
        },
        {
          id: 'REQ-002',
          type: 'REQ',
          phase: 1,
          title: '密码策略',
          summary: '密码',
          level: 2,
          reqGroup: 'REQ-001',
          evidenceAnchor: 'docs/req.md:§4=登录需密码',
          evidenceStatus: 'confirmed',
        },
      ],
      edges: [
        { from: 'REQ-001', to: 'REQ-002', type: 'parent' },
        { from: 'REQ-001', to: 'REQ-002', type: 'produces' },
      ],
    };
  }

  function r15(out: GraphCheckResult, sub: string): string | undefined {
    return out.violations.find((v) => v.startsWith(`R15${sub} `) || v.startsWith(`R15${sub} `));
  }

  it('R15a/b 负例（3 态：缺 evidenceAnchor / evidenceStatus 非法 / evidenceStatus 缺失）→ violation', () => {
    const rows: readonly [string, Array<Record<string, unknown>>, string, string | null, boolean][] = [
      [
        'R15a 节点缺 evidenceAnchor',
        [{ id: 'REQ-001', type: 'REQ', phase: 1, title: 't', summary: 's', level: 1, evidenceStatus: 'confirmed' }],
        'a',
        'evidenceAnchor 缺失',
        true,
      ],
      [
        'R15b evidenceStatus 非法（maybe）',
        [
          {
            id: 'REQ-001',
            type: 'REQ',
            phase: 1,
            title: 't',
            summary: 's',
            level: 1,
            evidenceAnchor: 'docs/req.md:§4=x',
            evidenceStatus: 'maybe',
          },
        ],
        'b',
        'evidenceStatus 非法',
        true,
      ],
      [
        'R15b evidenceStatus 缺失',
        [
          {
            id: 'REQ-001',
            type: 'REQ',
            phase: 1,
            title: 't',
            summary: 's',
            level: 1,
            evidenceAnchor: 'docs/req.md:§4=x',
          },
        ],
        'b',
        null,
        false,
      ],
    ];
    for (const [name, nodes, sub, fragment, expectFailed] of rows) {
      const out = checkRequirementGraph(makeGraph({ nodes }), 1);
      const violation = r15(out, sub);
      expect(violation, `${name} 应报 R15${sub}`).toBeDefined();
      if (fragment !== null) {
        expect(violation, `${name} 文案应含「${fragment}」`).toContain(fragment);
      }
      if (expectFailed) {
        expect(out.passed, `${name} 应 fail`).toBe(false);
      }
    }
  });

  it('R15c（2 态：path 不存在注入后触发 / path 存在不触发）', () => {
    const missingPathNode: Record<string, unknown> = {
      id: 'REQ-001',
      type: 'REQ',
      phase: 1,
      title: 't',
      summary: 's',
      level: 1,
      evidenceAnchor: 'nonexistent/path.md:§4=x',
      evidenceStatus: 'confirmed',
    };
    // 与 makeGraph({}) 默认节点同形（合法锚点 docs/req.md）
    const defaultNode: Record<string, unknown> = {
      id: 'REQ-001',
      type: 'REQ',
      phase: 1,
      title: 't',
      summary: 's',
      level: 1,
      evidenceAnchor: 'docs/req.md:§4=x',
      evidenceStatus: 'confirmed',
    };
    const rows: readonly [string, Record<string, unknown>, string][] = [
      [
        // 未注入 → R15c 不触发（纯函数不做 I/O，存在性由 CLI 注入）；注入不含该 path 的集合 → 触发
        'R15c 锚点 path 不存在（须注入 existingAnchorPaths）',
        missingPathNode,
        'violate',
      ],
      ['R15c 锚点 path 存在 → 不触发', defaultNode, 'clean'],
    ];
    for (const [name, node, kind] of rows) {
      const g = makeGraph({ nodes: [node] });
      if (kind === 'violate') {
        const without = checkRequirementGraph(g, 1);
        expect(r15(without, 'c'), `${name} 未注入时不应触发`).toBeUndefined();
        const out = checkRequirementGraph(g, 1, { existingAnchorPaths: new Set(['other.md']) });
        expect(out.passed, `${name} 注入后应 fail`).toBe(false);
        expect(r15(out, 'c'), `${name} 注入后应报证据路径不存在`).toContain('证据路径不存在');
      } else {
        const out = checkRequirementGraph(g, 1, { existingAnchorPaths: new Set(['docs/req.md']) });
        expect(r15(out, 'c'), `${name} 不应触发`).toBeUndefined();
      }
    }
  });

  it('R15e confirmed 但签名链无引用该节点的 V review 环 → violation', () => {
    const g = makeGraph({
      nodes: [
        {
          id: 'REQ-001',
          type: 'REQ',
          phase: 1,
          title: 't',
          summary: 's',
          level: 1,
          evidenceAnchor: 'docs/req.md:§4=x',
          evidenceStatus: 'confirmed',
        },
      ],
    });
    const out = checkRequirementGraph(g, 1, { signatureChainEntries: [] });
    expect(out.passed).toBe(false);
    expect(out.violations.some((v) => v.startsWith('R15e '))).toBe(true);
    expect(out.violations.some((v) => v.includes('缺签名链 V review 环'))).toBe(true);
  });

  it('R15e 不触发行（3 态：pending / 未注入签名链 / 存在引用该节点的 V review 环且 inputProvenance 指向锚点）', () => {
    const confirmedNode: Record<string, unknown> = {
      id: 'REQ-001',
      type: 'REQ',
      phase: 1,
      title: 't',
      summary: 's',
      level: 1,
      evidenceAnchor: 'docs/req.md:§4=x',
      evidenceStatus: 'confirmed',
    };
    const rows: readonly [string, Array<Record<string, unknown>>, Record<string, unknown> | undefined][] = [
      [
        'R15e pending 不触发（避免早期阶段误红）',
        [{ ...confirmedNode, evidenceStatus: 'pending' }],
        { signatureChainEntries: [] },
      ],
      ['R15e 未注入签名链（阶段 1 早期文件不存在）→ 不触发', [confirmedNode], undefined],
      [
        'R15e 存在引用该节点的 V review 环且 inputProvenance 指向锚点 → 不触发',
        [confirmedNode],
        {
          signatureChainEntries: [
            {
              role: 'V',
              action: 'review',
              artifacts: ['REQ-001'],
              inputProvenance: { sourceArtifacts: [{ path: 'docs/req.md' }] },
            },
          ],
        },
      ],
    ];
    for (const [name, nodes, opts] of rows) {
      const out = checkRequirementGraph(makeGraph({ nodes }), 1, opts as Record<string, unknown>);
      expect(
        out.violations.some((v) => v.startsWith('R15e ')),
        `${name} 不应报 R15e`,
      ).toBe(false);
    }
  });

  /**
   * R15f 行号锚点越界。修复前 `path:L42` 只验 path 存在、不验行号，
   * 故 `x.md:L99999` 能通过门禁——锚点从"可证伪的证据"退化成"看起来像证据的字符串"。
   */
  it('R15f 违规行（2 态：行号超出文件行数 / 区间倒置）→ violation（须注入 anchorLineCounts）', () => {
    const rows: readonly [string, string, number, string[], ((g: Record<string, unknown>) => void) | null][] = [
      [
        'R15f 行号超出文件行数',
        'docs/req.md:L99999=不存在的行',
        30,
        ['行号锚点越界', '超出文件 30 行'],
        (g) => {
          // 未注入行数表 → R15f 不触发（纯函数不做 I/O，行数由 CLI 注入）
          expect(r15(checkRequirementGraph(g, 1), 'f'), '未注入行数表时 R15f 不应触发').toBeUndefined();
        },
      ],
      ['R15f 区间倒置（end < start）', 'docs/req.md:L80-3=倒置区间', 200, ['区间非法'], null],
    ];
    for (const [name, anchor, lineCount, fragments, extra] of rows) {
      const g = makeGraph({
        nodes: [
          {
            id: 'REQ-001',
            type: 'REQ',
            phase: 1,
            title: 't',
            summary: 's',
            level: 1,
            evidenceAnchor: anchor,
            evidenceStatus: 'confirmed',
          },
        ],
      });
      const out = checkRequirementGraph(g, 1, {
        existingAnchorPaths: new Set(['docs/req.md']),
        anchorLineCounts: new Map([['docs/req.md', lineCount]]),
      });
      expect(out.passed, `${name} 应 fail`).toBe(false);
      for (const fragment of fragments) {
        expect(r15(out, 'f'), `${name} 文案应含「${fragment}」`).toContain(fragment);
      }
      if (extra) extra(g);
    }
  });

  it('R15f 不触发行（3 态：行号在文件内 / path 不在行数表 / section 锚点无行号）→ 不误红', () => {
    const rows: readonly [string, Record<string, unknown>, Map<string, number>][] = [
      [
        'R15f 行号在文件内',
        {
          id: 'REQ-001',
          type: 'REQ',
          phase: 1,
          title: 't',
          summary: 's',
          level: 1,
          evidenceAnchor: 'docs/req.md:L5-12=合法区间',
          evidenceStatus: 'confirmed',
        },
        new Map([['docs/req.md', 30]]),
      ],
      [
        'R15f path 不在行数表（不可读/未登记）→ 跳过，不误红',
        {
          id: 'REQ-001',
          type: 'REQ',
          phase: 1,
          title: 't',
          summary: 's',
          level: 1,
          evidenceAnchor: 'docs/req.md:L99999=越界但行数未知',
          evidenceStatus: 'confirmed',
        },
        new Map([['other.md', 10]]),
      ],
      [
        'R15f section 锚点无行号 → 不受行号校验',
        {
          id: 'REQ-001',
          type: 'REQ',
          phase: 1,
          title: 't',
          summary: 's',
          level: 1,
          evidenceAnchor: 'docs/req.md:§4=x',
          evidenceStatus: 'confirmed',
        },
        new Map([['docs/req.md', 1]]),
      ],
    ];
    for (const [name, node, lineCounts] of rows) {
      const out = checkRequirementGraph(makeGraph({ nodes: [node] }), 1, {
        existingAnchorPaths: new Set(['docs/req.md']),
        anchorLineCounts: lineCounts,
      });
      expect(r15(out, 'f'), `${name} 不应触发 R15f`).toBeUndefined();
    }
  });
});

// ==================== R16 节点 id 全项目唯一（graph-guide §1「全局唯一」的机器强制） ====================
describe('R16 节点 id 全项目唯一', () => {
  /** 2 节点纯 REQ 图；`duplicate` 为 true 时追加一个与 REQ-002 同 id 的节点 */
  function makeGraph(duplicate: boolean): Record<string, unknown> {
    const nodes: Array<Record<string, unknown>> = [
      {
        id: 'REQ-001',
        type: 'REQ',
        phase: 1,
        title: '根',
        summary: 'level=1',
        level: 1,
        evidenceAnchor: 'docs/req.md:§4=x',
        evidenceStatus: 'confirmed',
      },
      {
        id: 'REQ-002',
        type: 'REQ',
        phase: 1,
        title: '子',
        summary: 'level=2',
        level: 2,
        reqGroup: 'REQ-001',
        evidenceAnchor: 'docs/req.md:§4=x',
        evidenceStatus: 'confirmed',
      },
    ];
    if (duplicate) {
      nodes.push({ ...nodes[1], title: '同 id 的另一个节点' });
    }
    return {
      version: 1,
      currentPhase: 1,
      nodes,
      edges: [{ from: 'REQ-001', to: 'REQ-002', type: 'parent' }],
    };
  }

  it('R16 duplicate id（2 态：id 唯一不触发 / 重复 id violation）', () => {
    for (const duplicate of [false, true] as const) {
      const name = duplicate
        ? '重复 id → violation（修复前 Set 去重使两个节点被合并成一个判定单元）'
        : 'id 唯一 → duplicateNodeIds 为空，不触发';
      const out = checkRequirementGraph(makeGraph(duplicate), 1);
      if (duplicate) {
        expect(out.totalNodes, `${name} totalNodes 应为 3`).toBe(3);
        expect(out.duplicateNodeIds, `${name} 应点名 REQ-002`).toEqual(['REQ-002']);
        expect(out.passed, `${name} 应 fail`).toBe(false);
        const r16 = out.violations.find((v) => v.startsWith('R16 '));
        expect(r16, `${name} R16 文案应含 REQ-002`).toContain('REQ-002');
        expect(r16, `${name} R16 文案应含「全局唯一」`).toContain('全局唯一');
      } else {
        expect(out.duplicateNodeIds, `${name} 应为空`).toEqual([]);
        expect(
          out.violations.some((v) => v.startsWith('R16 ')),
          `${name} 不应报 R16`,
        ).toBe(false);
        expect(out.passed, `${name} 应通过`).toBe(true);
      }
    }
  });
});

describe('check-requirement-graph CLI 锚点基准解析（D2 回归：gitignored .w-model 残留不得截断项目根）', () => {
  const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli/check-requirement-graph.ts');
  // 该 fixture 的 evidenceAnchor 全部按**仓库根相对**书写（w-model-dev/references/graph-guide.md:§…），
  // 故基准必须是含 .git/（或真实项目 .w-model/）的那一层，锚点才解析得到。
  const FIXTURE = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../samples/graph/valid-req-hierarchy.json',
  );
  const RESIDUE_LOG = '2026-08-07T05-16-27-682Z-bdd.json';
  const ANCHOR_REL = path.join('w-model-dev', 'references', 'graph-guide.md');

  interface TreeOptions {
    /** 树根是否放 `.git/`（模拟真实仓库根） */
    gitRoot: boolean;
    /** 树根 `.w-model/` 是否放项目状态文件（模拟「只有 .w-model/、无 .git/」的真实项目） */
    projectStateAtRoot: boolean;
    /** 相对树根的残留目录：各自造 `.w-model/gate-logs/`（技能运行期残留，只有目录、无状态文件） */
    residueDirs: string[];
  }

  /**
   * 构建真实目录树（非 mock）：graph fixture 复制自 samples，锚点目标按 fixture 的
   * evidenceAnchor 落在树根下（`w-model-dev/references/graph-guide.md`）。
   * @param opts 盘面构成（.git/ 与 .w-model/ 残留/状态文件）
   */
  async function buildTree(opts: TreeOptions): Promise<{ root: string; graph: string }> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-d2-anchor-'));
    const graphDir = path.join(root, 'w-model-dev', 'scripts', 'samples', 'graph');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp 自有临时目录内的受控目录树
    await fs.mkdir(graphDir, { recursive: true });
    const graph = path.join(graphDir, 'valid-req-hierarchy.json');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp 自有临时目录内的受控样本复制
    await fs.copyFile(FIXTURE, graph);
    const anchorTarget = path.join(root, ANCHOR_REL);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp 自有临时目录内的受控目录树
    await fs.mkdir(path.dirname(anchorTarget), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp 自有临时目录内的受控锚点目标
    await fs.writeFile(anchorTarget, '# D2 回归锚点目标（内容无关，存在即可）\n', 'utf-8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp 自有临时目录内的受控目录树（模拟仓库根 .git/）
    if (opts.gitRoot) await fs.mkdir(path.join(root, '.git'), { recursive: true });
    if (opts.projectStateAtRoot) {
      const stateDir = path.join(root, '.w-model');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp 自有临时目录内的受控状态目录
      await fs.mkdir(stateDir, { recursive: true });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp 自有临时目录内的受控状态文件
      await fs.writeFile(path.join(stateDir, 'run-log.jsonl'), '{"runId":"d2-project-state"}\n', 'utf-8');
    }
    for (const rel of opts.residueDirs) {
      const logsDir = path.join(root, rel, '.w-model', 'gate-logs');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp 自有临时目录内的受控残留目录
      await fs.mkdir(logsDir, { recursive: true });
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- mkdtemp 自有临时目录内的受控残留日志
      await fs.writeFile(path.join(logsDir, RESIDUE_LOG), '{"type":"bdd"}\n', 'utf-8');
    }
    return { root, graph };
  }

  /** 真实 CLI 子进程（--json 在 exit 0/1 时输出纯 JSON），返回退出码与解析后的摘要 */
  function runCli(
    graphAbs: string,
    cwd: string,
  ): {
    exitCode: number | null;
    passed: boolean | undefined;
    reasons: string[];
    violations: Array<{ rule: string; count: number }>;
    stderr: string;
  } {
    const r = runSync(process.execPath, [tsxCli, CLI, graphAbs, '--phase=1', '--json'], { cwd });
    const stdout = r.stdout ?? '';
    let parsed: { passed?: boolean; reasons?: string[]; violations?: Array<{ rule: string; count: number }> };
    try {
      parsed = JSON.parse(stdout) as typeof parsed;
    } catch {
      throw new Error(
        `--json 输出不是纯 JSON（exit=${String(r.status)}）；stdout:\n${stdout}\nstderr:\n${r.stderr ?? ''}`,
      );
    }
    return {
      exitCode: r.status,
      passed: parsed.passed,
      reasons: parsed.reasons ?? [],
      violations: parsed.violations ?? [],
      stderr: r.stderr ?? '',
    };
  }

  it('① 仓库根有 .git/，子树内有两处仅含 gate-logs 的 .w-model 残留 → 仍解析到仓库根（R15c 通过，exit 0）', async () => {
    const tree = await buildTree({
      gitRoot: true,
      projectStateAtRoot: false,
      // 与真实机器盘面一致：w-model-dev/.w-model 与 w-model-dev/scripts/samples/.w-model 各一处残留
      residueDirs: ['w-model-dev', path.join('w-model-dev', 'scripts', 'samples')],
    });
    try {
      const r = runCli(tree.graph, tree.root);
      expect(r.reasons, '修复前：残留被当作项目根 → 仓库根相对的 evidenceAnchor 解析失败 → R15c 误报').toEqual([]);
      expect(r.passed).toBe(true);
      expect(r.exitCode).toBe(0);
    } finally {
      await fs.rm(tree.root, { recursive: true, force: true });
    }
  });

  it('② 只有 .w-model/ 的真实项目（无 .git/）→ 仍解析到该项目目录（含子树残留时亦然）', async () => {
    const clean = await buildTree({ gitRoot: false, projectStateAtRoot: true, residueDirs: [] });
    const withResidue = await buildTree({
      gitRoot: false,
      projectStateAtRoot: true,
      residueDirs: [path.join('w-model-dev', 'scripts', 'samples')],
    });
    try {
      const cases = [
        { label: '无残留', tree: clean },
        { label: '有子树残留', tree: withResidue },
      ];
      for (const c of cases) {
        const r = runCli(c.tree.graph, c.tree.root);
        expect(
          r.reasons,
          `${c.label}：无 .git/ 的真实项目仍须以自身 .w-model/ 为基准（不得退化到 graph 所在目录）`,
        ).toEqual([]);
        expect(r.exitCode, `${c.label}（stderr: ${r.stderr}）`).toBe(0);
      }
    } finally {
      await fs.rm(clean.root, { recursive: true, force: true });
      await fs.rm(withResidue.root, { recursive: true, force: true });
    }
  });

  it('③ 同输入同结论：同一 fixture 在「有残留 / 无残留」两种盘面下 passed/reasons/exitCode 一致', async () => {
    const withResidue = await buildTree({
      gitRoot: true,
      projectStateAtRoot: false,
      residueDirs: ['w-model-dev', path.join('w-model-dev', 'scripts', 'samples')],
    });
    const clean = await buildTree({ gitRoot: true, projectStateAtRoot: false, residueDirs: [] });
    try {
      const a = runCli(withResidue.graph, withResidue.root);
      const b = runCli(clean.graph, clean.root);
      // 正向基线：一致不得建立在「两种盘面同样误红」之上
      expect(a.exitCode, `有残留盘面（stderr: ${a.stderr}）`).toBe(0);
      expect(b.exitCode, `无残留盘面（stderr: ${b.stderr}）`).toBe(0);
      expect(a.passed).toBe(b.passed);
      expect(a.reasons).toEqual(b.reasons);
      expect(a.violations).toEqual(b.violations);
    } finally {
      await fs.rm(withResidue.root, { recursive: true, force: true });
      await fs.rm(clean.root, { recursive: true, force: true });
    }
  });
});
