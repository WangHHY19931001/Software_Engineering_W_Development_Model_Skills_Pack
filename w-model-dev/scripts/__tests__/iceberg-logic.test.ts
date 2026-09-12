import { describe, it, expect } from 'vitest';

import {
  checkIcebergSweep,
  deriveViewSets,
  ICEBERG_VIEW_PRESENCE,
  type IcebergSweepReport,
} from '../logic/iceberg-sweep-logic.js';

function validReport(overrides: Partial<IcebergSweepReport> = {}): IcebergSweepReport {
  return {
    reportId: 'IS-phase3-1-01',
    phase: 'phase3-outline',
    triggerType: 'ICEBERG-A',
    icebergRound: 1,
    sweptAt: '2026-08-08T10:00:00Z',
    sweptBy: 'R-iceberg',
    线索来源: { reworkHintsHistory: [], fixedPoints: [], previousFindings: [] },
    newFindings: [],
    sweepCoverage: {
      sweptArtifacts: ['docs/phase3-outline/blog-system-outline-design.md'],
      sweptDimensions: ['completeness', 'reliability', 'security'],
    },
    summary:
      '本次扫掠覆盖 completeness/reliability/security 三维度共 1 份产物，以本轮已修复问题为线索深挖，未发现新的隐藏问题，满足终止条件建议放行。',
    passed: true,
    ...overrides,
  };
}

describe('checkIcebergSweep', () => {
  it('合法报告且无新发现 → passed=true', () => {
    const r = checkIcebergSweep(validReport());
    expect(r.passed).toBe(true);
    expect(r.reasons).toHaveLength(0);
  });

  it('icebergRound=0 越界 → passed=false（R2）', () => {
    const r = checkIcebergSweep(validReport({ icebergRound: 0 }));
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.includes('icebergRound'))).toBe(true);
  });

  it('icebergRound=6 越界 → passed=false（R2）', () => {
    const r = checkIcebergSweep(validReport({ icebergRound: 6 }));
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.includes('icebergRound'))).toBe(true);
  });

  it('findingId 与 previousFindings 重复 → passed=false（R3）', () => {
    const r = checkIcebergSweep(
      validReport({
        线索来源: { reworkHintsHistory: [], fixedPoints: [], previousFindings: ['IF-phase3-1-01'] },
        newFindings: [
          {
            findingId: 'IF-phase3-1-01',
            severity: 'Required',
            category: 'same-defect-class',
            location: 'docs/phase3-outline/blog-system-outline-design.md:L42',
            description: '重复发现的转移守卫缺陷',
            evidence: '状态机图 §3.2 缺 archived 守卫',
            hypothesis: '若补齐守卫，archived 状态不可发布',
            relatedFixedPoint: 'IS-phase3-1-01',
          },
        ],
        passed: false,
      }),
    );
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.includes('已在上一轮发现'))).toBe(true);
  });

  it('findingId 在 newFindings 内部重复（两条同名）→ passed=false（R3 内部去重，r2 ice-internal-dup 形态）', () => {
    const dupFinding = {
      findingId: 'IF-phase3-1-09',
      severity: 'Required' as const,
      category: 'same-defect-class' as const,
      location: 'docs/phase3-outline/blog-system-outline-design.md:L42',
      description: '同 ID 两条发现（内部重复）',
      evidence: '状态机图 §3.2 缺 archived 守卫',
      hypothesis: '若补齐守卫，archived 状态不可发布',
      relatedFixedPoint: 'IS-phase3-1-01',
    };
    const r = checkIcebergSweep(
      validReport({
        线索来源: { reworkHintsHistory: [], fixedPoints: [], previousFindings: [] },
        newFindings: [dupFinding, { ...dupFinding, location: '...:L99' }],
        passed: false,
      }),
    );
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.includes('IF-phase3-1-09') && m.includes('在 newFindings 内部重复'))).toBe(true);
  });

  it('newFindings 内部重复且与 previousFindings 重复同时报（两条独立 violation）', () => {
    const dupFinding = {
      findingId: 'IF-phase3-1-09',
      severity: 'Required' as const,
      category: 'coverage-gap' as const,
      location: 'docs/phase3-outline/blog-system-outline-design.md:L42',
      description: '同时命中内部重复与上一轮重复',
      evidence: 'evidence',
      hypothesis: 'hypothesis',
      relatedFixedPoint: 'IS-phase3-1-01',
    };
    const r = checkIcebergSweep(
      validReport({
        线索来源: { reworkHintsHistory: [], fixedPoints: [], previousFindings: ['IF-phase3-1-09'] },
        newFindings: [dupFinding, dupFinding],
        passed: false,
      }),
    );
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.includes('在 newFindings 内部重复'))).toBe(true);
    expect(r.reasons.some((m) => m.includes('已在上一轮发现'))).toBe(true);
  });

  it('finding 缺 hypothesis 或 evidence → passed=false（R4）', () => {
    const r = checkIcebergSweep(
      validReport({
        newFindings: [
          {
            findingId: 'IF-phase3-1-02',
            severity: 'Required',
            category: 'coverage-gap',
            location: 'docs/phase3-outline/blog-system-outline-design.md:L50',
            description: 'SD-007 未建模',
            evidence: 'graph.json type=SD 节点全集含 SD-007',
            hypothesis: '',
            relatedFixedPoint: 'IS-phase3-1-01',
          },
        ],
        passed: false,
      }),
    );
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.includes('hypothesis'))).toBe(true);
  });

  it('passed 与 newFindings 不一致 → passed=false（R5）', () => {
    const r = checkIcebergSweep(
      validReport({
        newFindings: [
          {
            findingId: 'IF-phase3-1-03',
            severity: 'Required',
            category: 'adjacent-logic',
            location: 'docs/phase3-outline/blog-system-outline-design.md:L60',
            description: 'UnpublishArticle 未校验 archived',
            evidence: '状态机图 §3.2 Unpublish 转移',
            hypothesis: '若补齐守卫，archived 文章不可下架',
            relatedFixedPoint: 'IS-phase3-1-01',
          },
        ],
        passed: true,
      }),
    );
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.includes('passed 不一致'))).toBe(true);
  });

  it('schema 违规（缺 required 字段 sweptBy）→ passed=false（R1）', () => {
    const { sweptBy, ...rest } = validReport();
    const r = checkIcebergSweep(rest as IcebergSweepReport);
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.startsWith('[schema]'))).toBe(true);
  });

  it('sweptArtifacts 为空数组 → passed=false（schema minItems=1，空声明使零发现不可对账）', () => {
    const r = checkIcebergSweep(
      validReport({
        sweepCoverage: { sweptArtifacts: [], sweptDimensions: ['completeness', 'reliability', 'security'] },
      }),
    );
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.includes('sweptArtifacts') && m.includes('minItems'))).toBe(true);
  });
});

describe('A-3b 三视角对账', () => {
  it('两视角应扫集合存在差异 → violation（R6）', () => {
    const r = checkIcebergSweep(validReport(), {
      viewSets: { graph: ['SD-001', 'SD-002'], tla: ['SD-001'], rtm: ['SD-001', 'SD-002'] },
    });
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.includes('R6') && m.includes('视角间存在未对账差异'))).toBe(true);
    // 差异项须被逐条列出（不归一化、不取并集后放行）
    expect(r.reasons.some((m) => m.includes('SD-002'))).toBe(true);
  });

  it('三视角完全一致 → 无 R6 violation', () => {
    const converged = ['docs/phase3-outline/blog-system-outline-design.md'];
    const r = checkIcebergSweep(validReport(), { viewSets: { graph: converged, tla: converged, rtm: converged } });
    expect(r.reasons.some((m) => m.includes('R6'))).toBe(false);
    expect(r.passed).toBe(true);
  });

  it('视角缺席但未在 sweepCoverage.absentViews 声明 → violation（R7，禁止静默跳过）', () => {
    // 阶段 3 的在场表为 graph/tla/rtm；只提供 graph/tla → rtm 缺席且未声明
    const r = checkIcebergSweep(validReport(), { viewSets: { graph: ['SD-001'], tla: ['SD-001'] } });
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.includes('R7') && m.includes('rtm'))).toBe(true);
  });

  it('视角缺席但已在 absentViews 显式声明 → 无 R7 violation', () => {
    const converged = ['docs/phase3-outline/blog-system-outline-design.md'];
    const r = checkIcebergSweep(
      validReport({
        sweepCoverage: {
          sweptArtifacts: converged,
          sweptDimensions: ['completeness', 'reliability', 'security'],
          absentViews: ['rtm'],
        },
      }),
      { viewSets: { graph: converged, tla: converged } },
    );
    expect(r.reasons.some((m) => m.includes('R7'))).toBe(false);
    expect(r.passed).toBe(true);
  });

  it('零发现但收敛集合为空 → violation（R8，无法证明扫掠发生）', () => {
    const r = checkIcebergSweep(validReport(), { viewSets: { graph: [], tla: [], rtm: [] } });
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.includes('R8') && m.includes('零发现但收敛集合为空'))).toBe(true);
  });

  it('零发现且收敛集合非空且 sweptArtifacts 已覆盖 → 无 R8 violation', () => {
    const converged = ['docs/phase3-outline/blog-system-outline-design.md'];
    const r = checkIcebergSweep(validReport(), { viewSets: { graph: converged, tla: converged, rtm: converged } });
    expect(r.reasons.some((m) => m.includes('R8'))).toBe(false);
  });

  it('未注入 viewSets（纯逻辑层调用）→ 跳过 R6/R7/R8，不误红（规格 §5：早期阶段/无上游产物时不得假红）', () => {
    const r = checkIcebergSweep(validReport());
    expect(r.passed).toBe(true);
    expect(r.reasons).toHaveLength(0);
  });

  it('sweptArtifacts 未覆盖收敛集合 → violation（R8 分母未覆盖）', () => {
    const r = checkIcebergSweep(
      validReport({
        sweepCoverage: {
          sweptArtifacts: ['docs/phase3-outline/other.md'],
          sweptDimensions: ['completeness', 'reliability', 'security'],
        },
      }),
      {
        viewSets: {
          graph: ['docs/phase3-outline/blog-system-outline-design.md'],
          tla: ['docs/phase3-outline/blog-system-outline-design.md'],
          rtm: ['docs/phase3-outline/blog-system-outline-design.md'],
        },
      },
    );
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.includes('R8') && m.includes('未覆盖'))).toBe(true);
  });

  it('无法从 report.phase 解析阶段号 → 报错而非静默按 0 处理', () => {
    const r = checkIcebergSweep(validReport({ phase: 'phase9-whatever' }), {
      viewSets: { graph: ['SD-001'], tla: ['SD-001'], rtm: ['SD-001'] },
    });
    expect(r.passed).toBe(false);
    expect(r.reasons.some((m) => m.includes('phase') && m.includes('解析'))).toBe(true);
  });

  it('ICEBERG_VIEW_PRESENCE 为代码常量：1-8 阶段全覆盖且取值非空', () => {
    for (let p = 1; p <= 8; p++) {
      expect(ICEBERG_VIEW_PRESENCE[p]).toBeDefined();
      expect(ICEBERG_VIEW_PRESENCE[p]!.length).toBeGreaterThan(0);
    }
  });

  it('graph 在阶段 2-8 全部在场：阶段 5-8 亦消费 graph.json（D8 SD Coverage），遗漏即盲区', () => {
    // 阶段 2-4 缺 --graph 为 ARG_INVALID/exit 2（graph 是 D8 数据源）；
    // 阶段 5-8 以 --graph=.w-model/ingestion/graph.json 校验 D8。故 2-8 均须含 graph。
    for (let p = 2; p <= 8; p++) {
      expect(ICEBERG_VIEW_PRESENCE[p]).toContain('graph');
    }
  });

  it('同一产物集在阶段 4 与阶段 5 派生出相同的 graph 视角（防 5-8 回归为盲区）', () => {
    const artifacts = {
      graph: { nodes: [{ id: 'SD-001' }, { id: 'SD-002' }] },
      tlaManifest: { sdCoverage: { coveredSdNodes: ['SD-001'] } },
      rtm: { rows: [{ designDoc: 'SD-001' }] },
      changeScope: {},
    };
    const atPhase4 = deriveViewSets(4, artifacts);
    const atPhase5 = deriveViewSets(5, artifacts);
    expect(atPhase5.graph).toEqual(atPhase4.graph);
    expect(atPhase5.graph).toEqual(['SD-001', 'SD-002']);
  });
});

describe('deriveViewSets（CLI 侧上游产物 → 各视角应扫集合）', () => {
  it('阶段 3 存在 graph/tla/rtm 三份产物 → 三视角均派生，且只取设计 ID 命名空间', () => {
    const sets = deriveViewSets(3, {
      graph: { nodes: [{ id: 'SD-001' }, { id: 'REQ-001' }, { id: 'INTF-002' }] },
      tlaManifest: { sdCoverage: { coveredSdNodes: ['SD-001'] } },
      rtm: { rows: [{ requirementId: 'REQ-001', designDoc: 'docs/x.md:§3 SD-001' }] },
    });
    expect(sets.graph).toEqual(['SD-001', 'INTF-002']);
    expect(sets.tla).toEqual(['SD-001']);
    expect(sets.rtm).toEqual(['SD-001']);
  });

  it('阶段 3 缺 tla-manifest → tla 键缺席（不合成空集合，交由 R7 要求显式声明）', () => {
    const sets = deriveViewSets(3, {
      graph: { nodes: [{ id: 'SD-001' }] },
      rtm: { rows: [{ requirementId: 'REQ-001', designDoc: 'docs/x.md:§3 SD-001' }] },
    });
    expect(sets.tla).toBeUndefined();
    expect(Object.keys(sets)).not.toContain('tla');
  });

  it('阶段 1 的在场表为 graph/rtm → 不派生 tla/scope（即使在盘也不在场）', () => {
    const sets = deriveViewSets(1, {
      graph: { nodes: [{ id: 'SD-001' }] },
      tlaManifest: { sdCoverage: { coveredSdNodes: ['SD-001'] } },
      rtm: { rows: [{ requirementId: 'REQ-001', designDoc: 'docs/x.md:§3 SD-001' }] },
    });
    expect(Object.keys(sets).sort()).toEqual(['graph', 'rtm']);
  });

  it('阶段 5 的在场表为 tla/rtm/scope → scope 从 change-scope.changedFiles 派生', () => {
    const sets = deriveViewSets(5, {
      changeScope: { changedFiles: ['src/a.ts', 'src/b.ts'] },
      tlaManifest: { sdCoverage: { coveredSdNodes: ['SD-001'] } },
      rtm: { rows: [{ requirementId: 'REQ-001', designDoc: 'docs/x.md:§3 SD-001' }] },
    });
    expect(sets.scope).toEqual(['src/a.ts', 'src/b.ts']);
    expect(sets.graph).toBeUndefined();
  });

  it('上游产物形状非法（非数组）→ 相应视角键缺席而非抛错', () => {
    const sets = deriveViewSets(3, { graph: { nodes: 'not-an-array' }, tlaManifest: {}, rtm: {} });
    expect(Object.keys(sets)).toHaveLength(0);
  });
});
