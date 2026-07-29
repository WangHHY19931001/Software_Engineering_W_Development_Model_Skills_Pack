import { validateBySchema } from './schema-loader.js';

export interface PreventiveReviewFinding {
  severity: 'Critical' | 'Required' | 'Optional' | 'Nit' | 'FYI';
  description: string;
  evidence: string;
}

export interface PreventiveReview {
  reviewedAt: string;
  reviewer: string;
  phase: number;
  dimension: 'completeness' | 'reliability' | 'security';
  findings: PreventiveReviewFinding[];
  passed: boolean;
}

export interface PreventiveReviewCheckResult {
  passed: boolean;
  reasons: string[];
  reviews: { dimension: string; passed: boolean; findingCount: number }[];
}

const REQUIRED_DIMENSIONS = ['completeness', 'reliability', 'security'] as const;

/**
 * 校验 R3 三份报告完整性（第22轮新增）。
 * - 三份报告须全部存在
 * - 每份报告通过 schema 校验
 * - 每份报告 passed=true（或 passed=false 但 V 已纳入 reworkHints，此处只校验报告存在性和格式）
 */
export function checkPreventiveReview(
  reviews: Record<string, PreventiveReview | null>,
  expectedPhase: number,
): PreventiveReviewCheckResult {
  const reasons: string[] = [];
  const reviewSummaries: { dimension: string; passed: boolean; findingCount: number }[] = [];

  for (const dim of REQUIRED_DIMENSIONS) {
    const review = reviews[dim];
    if (!review) {
      reasons.push(`R3 报告缺失：${dim} 维度报告未找到`);
      reviewSummaries.push({ dimension: dim, passed: false, findingCount: 0 });
      continue;
    }

    // schema 校验
    const schemaResult = validateBySchema('preventive-review', review);
    if (!schemaResult.valid) {
      for (const msg of schemaResult.errorMessages) {
        reasons.push(`[schema] ${dim}: ${msg}`);
      }
      reviewSummaries.push({ dimension: dim, passed: false, findingCount: 0 });
      continue;
    }

    // phase 一致性
    if (review.phase !== expectedPhase) {
      reasons.push(`R3 报告 phase 不一致：${dim} 维度 phase=${review.phase}，期望=${expectedPhase}`);
    }

    // dimension 一致性
    if (review.dimension !== dim) {
      reasons.push(`R3 报告 dimension 不匹配：文件名维度=${dim}，报告维度=${review.dimension}`);
    }

    reviewSummaries.push({
      dimension: dim,
      passed: review.passed,
      findingCount: review.findings.length,
    });
  }

  return {
    passed: reasons.length === 0,
    reasons,
    reviews: reviewSummaries,
  };
}
