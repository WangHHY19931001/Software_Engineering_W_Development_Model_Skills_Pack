/**
 * 批次3 任务10：gate SDMAP ≡ code-tla D1 双实现 property 测试
 *
 * 同期项 3（gate-engineering 批次 3）：gate-logic.checkArtifactGate 的 sdmapViolations
 * （SDMAP-1..4 + SDMAP-5 同池）与 code-tla-logic.checkCodeTlaConsistency 维度1
 * sdToCodeModule.structuredViolations（SDMAP-1/2）同源于批次 1 SDMAP 规则，
 * 本测试以表驱动 5 场景逐例断言「rule@field 投影集合相等」，防两实现漂移。
 *
 * 投影集合语义：判定与规则 ID 一致（field 为定位标签，须逐字一致）；
 * message 文案允许两实现差异（不参与投影）。
 * SDMAP-5 排除在投影外：code-tla 侧 D1 无条目格式校验形态（SDMAP-5 为 gate 侧独有，
 * 由 gate-logic checkCodeModuleFormat 承担）。
 *
 * helper 来源（照既有构造拷改）：
 *   - makeMatrix  照 gate-enhancement.test.ts 内联矩阵构造（rows 补齐 rtm.schema.json
 *     required 八字段 + executionSummary 四层摘要，保证通过 checkArtifactGate 的
 *     schema 前置校验进入 SDMAP 家族执行段）
 *   - makeTlaInput 照 code-tla-logic.test.ts 批次1 makeInput（manifest 空 specs →
 *     维度3/4 跳过；codeFiles 空 → 维度2 不产生维度1 投影面违规）
 */

import { describe, expect, it } from 'vitest';

import { checkArtifactGate, type RTMMatrixShape } from '../logic/gate-logic.js';
import { checkCodeTlaConsistency, type CodeTlaConsistencyInput, type TlaManifest } from '../logic/code-tla-logic.js';

// ==================== helper（照既有测试构造拷改） ====================

/** 用例行形状（简报 CASES 行仅含两键；显式键型避免 Record 索引访问的 string | undefined）。 */
type ParityRow = { requirementId: string; codeModule: string };

/** gate 侧矩阵构造（照 gate-enhancement.test.ts 内联矩阵拷改：补齐 schema 必填九字段，A13 后含 coverageStatus）。 */
function makeMatrix(rows: ParityRow[]): RTMMatrixShape {
  return {
    rows: rows.map((row) => ({
      requirementId: row.requirementId,
      description: 'd',
      designDoc: 'SD-1',
      codeModule: row.codeModule,
      unitTest: 'UT-001',
      integrationTest: 'IT-001',
      systemTest: 'ST-001',
      acceptanceTest: 'UAT-001',
      coverageStatus: '100%',
    })),
    executionSummary: {
      unitTest: { total: 1, passed: 1, failed: 0, pending: 0, coverage: 90 },
      integrationTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
      systemTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
      acceptanceTest: { total: 0, passed: 0, failed: 0, pending: 0, coverage: 0 },
    },
  };
}

/** code-tla 侧 manifest 构造（照 code-tla-logic.test.ts makeManifest 拷改：空 specs，维度3/4 跳过）。 */
function makeManifest(): TlaManifest {
  return { specs: [] };
}

/** code-tla 侧输入构造（照 code-tla-logic.test.ts makeInput 拷改：manifest+graph+rtm+空 codeFiles）。 */
function makeTlaInput(
  graph: { nodes: Array<{ id: string; type: string }> },
  rows: ParityRow[],
): CodeTlaConsistencyInput {
  return {
    manifest: makeManifest(),
    graph: { nodes: graph.nodes.map((n) => ({ ...n })), edges: [] },
    rtm: { rows: rows.map((row) => ({ requirementId: row.requirementId, codeModule: row.codeModule })) },
    codeFiles: [],
  };
}

// ==================== 用例（简报 5 场景，取值逐字保留） ====================

const CASES: Array<{
  name: string;
  graph: { nodes: Array<{ id: string; type: string }> };
  rows: ParityRow[];
}> = [
  {
    name: '全对齐',
    graph: { nodes: [{ id: 'SD-AUTH', type: 'SD' }] },
    rows: [{ requirementId: 'REQ-1', codeModule: 'SD-AUTH:src/auth.ts:L1' }],
  },
  {
    name: '缺映射',
    graph: { nodes: [{ id: 'SD-AUTH', type: 'SD' }] },
    rows: [{ requirementId: 'REQ-1', codeModule: 'SD-BILL:src/b.ts:L1' }],
  },
  {
    name: '幽灵前缀',
    graph: { nodes: [{ id: 'SD-AUTH', type: 'SD' }] },
    rows: [{ requirementId: 'REQ-1', codeModule: 'SD-AUTH:src/a.ts:L1, SD-GHOST:src/g.ts:L1' }],
  },
  {
    name: '多 SD 混合',
    graph: {
      nodes: [
        { id: 'SD-A', type: 'SD' },
        { id: 'SD-B', type: 'SD' },
      ],
    },
    rows: [
      { requirementId: 'REQ-1', codeModule: 'SD-A:src/a.ts:L1' },
      { requirementId: 'REQ-2', codeModule: 'SD-C:src/c.ts:L1' },
    ],
  },
  {
    name: '数字层级',
    graph: { nodes: [{ id: 'SD-5.2.1', type: 'SD' }] },
    rows: [{ requirementId: 'REQ-1', codeModule: 'SD-5.2.1:src/auth/login.ts:L42-58' }],
  },
];

// ==================== property：rule@field 投影集合相等 ====================

describe.each(CASES)('双实现一致性（批次3 property）: $name', ({ graph, rows }) => {
  // 投影 = `${rule}@${field ?? ''}`：判定与规则 ID 一致（field 定位标签逐字一致），message 允许差异
  const project = (sv: Array<{ rule: string; field?: string }>) => new Set(sv.map((s) => `${s.rule}@${s.field ?? ''}`));

  it('gate SDMAP ≡ code-tla D1（rule@field 投影集合相等）', () => {
    const gate = checkArtifactGate(makeMatrix(rows), { graph, phaseOption: 5 });
    const tla = checkCodeTlaConsistency(makeTlaInput(graph, rows));
    // SDMAP-5 排除：code-tla 侧 D1 无条目格式校验形态，gate 侧独有
    expect(project(tla.dimensions.sdToCodeModule.structuredViolations ?? [])).toEqual(
      project(gate.sdmapViolations?.filter((s) => s.rule !== 'SDMAP-5') ?? []),
    );
  });
});
