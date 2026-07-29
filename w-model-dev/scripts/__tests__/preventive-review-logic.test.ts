import { describe, it, expect } from 'vitest';
import { checkPreventiveReview, type PreventiveReview } from '../preventive-review-logic.js';

describe('checkPreventiveReview', () => {
  it('三份报告齐全且合规 → passed=true', () => {
    const reviews: Record<string, PreventiveReview> = {
      completeness: { reviewedAt: '2026-07-30T10:00:00Z', reviewer: 'R3-bot', phase: 1, dimension: 'completeness', findings: [], passed: true },
      reliability: { reviewedAt: '2026-07-30T10:00:00Z', reviewer: 'R3-bot', phase: 1, dimension: 'reliability', findings: [], passed: true },
      security: { reviewedAt: '2026-07-30T10:00:00Z', reviewer: 'R3-bot', phase: 1, dimension: 'security', findings: [], passed: true },
    };
    const result = checkPreventiveReview(reviews, 1);
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('缺失 completeness 报告 → passed=false', () => {
    const reviews: Record<string, PreventiveReview | null> = {
      completeness: null,
      reliability: { reviewedAt: '2026-07-30T10:00:00Z', reviewer: 'R3-bot', phase: 1, dimension: 'reliability', findings: [], passed: true },
      security: { reviewedAt: '2026-07-30T10:00:00Z', reviewer: 'R3-bot', phase: 1, dimension: 'security', findings: [], passed: true },
    };
    const result = checkPreventiveReview(reviews, 1);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('R3 报告缺失：completeness 维度报告未找到');
  });

  it('phase 不一致 → passed=false', () => {
    const reviews: Record<string, PreventiveReview> = {
      completeness: { reviewedAt: '2026-07-30T10:00:00Z', reviewer: 'R3-bot', phase: 2, dimension: 'completeness', findings: [], passed: true },
      reliability: { reviewedAt: '2026-07-30T10:00:00Z', reviewer: 'R3-bot', phase: 1, dimension: 'reliability', findings: [], passed: true },
      security: { reviewedAt: '2026-07-30T10:00:00Z', reviewer: 'R3-bot', phase: 1, dimension: 'security', findings: [], passed: true },
    };
    const result = checkPreventiveReview(reviews, 1);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => r.includes('phase 不一致'))).toBe(true);
  });
});
