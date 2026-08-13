import { describe, it, expect } from 'vitest';

import { checkIcebergSweep, type IcebergSweepReport } from '../logic/iceberg-sweep-logic.js';

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
});
