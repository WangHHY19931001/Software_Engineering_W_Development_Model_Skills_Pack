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

/**
 * R3 预防性审查选项（第29轮新增）。
 *
 * `variant` 用于 CLI 层（check-preventive-review.ts）构造报告路径前缀，
 * 纯逻辑层本身不依赖 variant（三份齐备校验对所有 S 变体一致）：
 *   - standard  → `<phase>-{dim}.json`
 *   - fix       → `<phase>-fix-{dim}.json`        （S-fix 返工后 R3）
 *   - emergency → `<phase>-emergency-{dim}.json`  （S-emergency-fix 后 R3）
 *   - ingest    → `<phase>-ingest-{dim}.json`     （S-ingest-tla / S-ingest-bdd 后 R3，第 41.8.0 轮补全）
 *
 * 第29轮升级：R3 无条件强制，覆盖所有 S 变体（含 S-fix / S-emergency-fix / S-ingest）。
 */
export interface PreventiveReviewOptions {
  variant?: 'standard' | 'fix' | 'emergency' | 'ingest';
}

const REQUIRED_DIMENSIONS = ['completeness', 'reliability', 'security'] as const;

/**
 * 校验 R3 三份报告完整性（第22轮新增，第29轮扩展 variant）。
 * - 三份报告须全部存在
 * - 每份报告通过 schema 校验
 * - 每份报告 passed=true（或 passed=false 但 V 已纳入 reworkHints，此处只校验报告存在性和格式）
 *
 * 第29轮：新增 `options.variant` 参数，用于 CLI 层路径前缀推断；
 * 纯逻辑层校验对所有 S 变体一致（三份齐备 + schema + phase/dimension 一致）。
 */
export function checkPreventiveReview(
  reviews: Record<string, PreventiveReview | null>,
  expectedPhase: number,
  _options?: PreventiveReviewOptions,
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
