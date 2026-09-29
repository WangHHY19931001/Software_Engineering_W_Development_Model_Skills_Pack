import { describe, it, expect } from 'vitest';

import { checkPreventiveReview, type PreventiveReview } from '../logic/preventive-review-logic.js';

describe('checkPreventiveReview', () => {
  it('三份报告齐全且合规 → passed=true', () => {
    const reviews: Record<string, PreventiveReview> = {
      completeness: {
        reviewedAt: '2026-07-30T10:00:00Z',
        reviewer: 'R3-bot',
        phase: 1,
        dimension: 'completeness',
        findings: [],
        passed: true,
      },
      reliability: {
        reviewedAt: '2026-07-30T10:00:00Z',
        reviewer: 'R3-bot',
        phase: 1,
        dimension: 'reliability',
        findings: [],
        passed: true,
      },
      security: {
        reviewedAt: '2026-07-30T10:00:00Z',
        reviewer: 'R3-bot',
        phase: 1,
        dimension: 'security',
        findings: [],
        passed: true,
      },
    };
    const result = checkPreventiveReview(reviews, 1);
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('缺失 completeness 报告 → passed=false', () => {
    const reviews: Record<string, PreventiveReview | null> = {
      completeness: null,
      reliability: {
        reviewedAt: '2026-07-30T10:00:00Z',
        reviewer: 'R3-bot',
        phase: 1,
        dimension: 'reliability',
        findings: [],
        passed: true,
      },
      security: {
        reviewedAt: '2026-07-30T10:00:00Z',
        reviewer: 'R3-bot',
        phase: 1,
        dimension: 'security',
        findings: [],
        passed: true,
      },
    };
    const result = checkPreventiveReview(reviews, 1);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('R3 报告缺失：completeness 维度报告未找到');
  });

  it('phase 不一致 → passed=false', () => {
    const reviews: Record<string, PreventiveReview> = {
      completeness: {
        reviewedAt: '2026-07-30T10:00:00Z',
        reviewer: 'R3-bot',
        phase: 2,
        dimension: 'completeness',
        findings: [],
        passed: true,
      },
      reliability: {
        reviewedAt: '2026-07-30T10:00:00Z',
        reviewer: 'R3-bot',
        phase: 1,
        dimension: 'reliability',
        findings: [],
        passed: true,
      },
      security: {
        reviewedAt: '2026-07-30T10:00:00Z',
        reviewer: 'R3-bot',
        phase: 1,
        dimension: 'security',
        findings: [],
        passed: true,
      },
    };
    const result = checkPreventiveReview(reviews, 1);
    expect(result.passed).toBe(false);
    expect(result.reasons.some((r) => r.includes('phase 不一致'))).toBe(true);
  });
});

describe('checkPreventiveReview: variant 选项（S-fix/emergency）', () => {
  /** 三份齐备合规报告（phase 5），供 variant 通过矩阵逐变体复用（每迭代同 fixture 构造）。 */
  const completeReviews: Record<string, PreventiveReview> = {
    completeness: {
      reviewedAt: '2026-07-31T00:00:00Z',
      reviewer: 'R',
      phase: 5,
      dimension: 'completeness',
      findings: [],
      passed: true,
    },
    reliability: {
      reviewedAt: '2026-07-31T00:00:00Z',
      reviewer: 'R',
      phase: 5,
      dimension: 'reliability',
      findings: [],
      passed: true,
    },
    security: {
      reviewedAt: '2026-07-31T00:00:00Z',
      reviewer: 'R',
      phase: 5,
      dimension: 'security',
      findings: [],
      passed: true,
    },
  };

  it('variant 通过矩阵（4 态：fix / emergency / standard 默认 / ingest）三份齐备应通过（逻辑层不依赖 variant）', () => {
    const rows = [
      { label: 'variant=fix', options: { variant: 'fix' as const } },
      { label: 'variant=emergency', options: { variant: 'emergency' as const } },
      { label: 'variant=standard（默认）', options: undefined },
      { label: 'variant=ingest', options: { variant: 'ingest' as const } },
    ];
    for (const row of rows) {
      const r = checkPreventiveReview(completeReviews, 5, row.options);
      expect(r.passed, `${row.label} 三份齐备应通过（逻辑层对所有 S 变体不变）`).toBe(true);
      expect(r.reasons, `${row.label} 零 reasons`).toHaveLength(0);
    }
  });

  it('variant=fix 时缺 security 仍应失败（逻辑层校验不变）', () => {
    const reviews: Record<string, PreventiveReview | null> = {
      completeness: {
        reviewedAt: '2026-07-31T00:00:00Z',
        reviewer: 'R',
        phase: 5,
        dimension: 'completeness',
        findings: [],
        passed: true,
      },
      reliability: {
        reviewedAt: '2026-07-31T00:00:00Z',
        reviewer: 'R',
        phase: 5,
        dimension: 'reliability',
        findings: [],
        passed: true,
      },
      security: null,
    };
    const r = checkPreventiveReview(reviews, 5, { variant: 'fix' });
    expect(r.passed).toBe(false);
    expect(r.reasons.some((msg) => /security.*未找到/.test(msg))).toBe(true);
  });
});

describe('passed=false 的 R3 报告必须产生 violation', () => {
  it('三份报告齐备但其一 passed=false → passed 应为 false 且 reasons 指名该维度', () => {
    const reviews: Record<string, PreventiveReview | null> = {
      completeness: {
        reviewedAt: '2026-07-30T10:00:00Z',
        reviewer: 'R3-completeness-bot',
        phase: 3,
        dimension: 'completeness',
        findings: [],
        passed: true,
      },
      reliability: {
        reviewedAt: '2026-07-30T10:00:00Z',
        reviewer: 'R3-reliability-bot',
        phase: 3,
        dimension: 'reliability',
        findings: [{ severity: 'Required', description: 'x', evidence: 'y' }],
        passed: false,
      },
      security: {
        reviewedAt: '2026-07-30T10:00:00Z',
        reviewer: 'R3-security-bot',
        phase: 3,
        dimension: 'security',
        findings: [],
        passed: true,
      },
    };
    const out = checkPreventiveReview(reviews, 3);
    expect(out.passed).toBe(false);
    expect(out.reasons.some((r) => r.includes('reliability'))).toBe(true);
  });
});
