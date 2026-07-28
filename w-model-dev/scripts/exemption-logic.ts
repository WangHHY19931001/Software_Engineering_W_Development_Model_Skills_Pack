/**
 * 豁免审批纯逻辑层（Exemption Logic）
 *
 * 校验豁免审批流程完整性（S→R→V→人类四阶段）。
 * 规则 E1-E8：
 *   E1  schema 完整性
 *   E2  justification 长度 ≥ 20 字符
 *   E3  evidence 数组非空
 *   E4  review 阶段完整
 *   E5  review.reviewDecision = approve
 *   E6  review.rootCauseAnalysis 长度 ≥ 30 字符
 *   E7  verification.verified = true
 *   E8  humanDecision.decision = approve
 */
import { validateBySchema, type SchemaValidationResult } from './schema-loader.js';

// ==================== 类型定义 ====================

export interface ExemptionReview {
  reviewDecision: 'approve' | 'reject' | 'need-more-info';
  rootCauseAnalysis: string;
  falsifiabilityCheck: string;
  riskAssessment: string;
  conditions?: string[];
  reviewedAt: string;
}

export interface ExemptionVerification {
  verified: boolean;
  reworkHints?: string[];
  verifiedAt: string;
}

export interface ExemptionHumanDecision {
  decision: 'approve' | 'reject';
  decidedAt: string;
  decidedBy?: string;
}

export interface ExemptionShape {
  id: string;
  type: 'small-project-hierarchy' | 'stakeholder-not-applicable' | 'scenario-type-not-applicable' | 'coverage-missing-declared' | 'nfr-subtype-not-applicable';
  target: string;
  ruleId: string;
  justification: string;
  evidence: string[];
  proposedAlternative: string;
  submittedAt: string;
  review?: ExemptionReview;
  verification?: ExemptionVerification;
  humanDecision?: ExemptionHumanDecision;
}

export interface ExemptionCheckResult {
  passed: boolean;
  violations: string[];
  stage: 'request' | 'review' | 'verification' | 'human' | 'complete';
}

// ==================== 主校验函数 ====================

export function checkExemption(exemption: unknown): ExemptionCheckResult {
  const result: ExemptionCheckResult = {
    passed: false,
    violations: [],
    stage: 'request',
  };

  // E1: schema 完整性
  const schemaResult: SchemaValidationResult = validateBySchema('exemption', exemption);
  if (!schemaResult.valid) {
    result.violations.push(...schemaResult.errorMessages.map(m => `[schema] ${m}`));
    result.passed = false;
    return result;
  }

  const e = exemption as ExemptionShape;

  // E2: justification 长度 ≥ 20 字符
  if (e.justification.length < 20) {
    result.violations.push(`E2 justification 长度 ${e.justification.length} < 20 字符（防止敷衍）`);
  }

  // E3: evidence 数组非空
  if (e.evidence.length === 0) {
    result.violations.push('E3 evidence 数组为空（须有证据支撑）');
  }

  // E4: review 阶段完整
  if (!e.review) {
    result.violations.push('E4 review 阶段缺失（R 审查未执行）');
  } else {
    result.stage = 'review';
    // E5: review.reviewDecision = approve
    if (e.review.reviewDecision !== 'approve') {
      result.violations.push(`E5 review.reviewDecision = ${e.review.reviewDecision}（须为 approve 才能进入 V 阶段）`);
    }
    // E6: review.rootCauseAnalysis 长度 ≥ 30 字符
    if (e.review.rootCauseAnalysis.length < 30) {
      result.violations.push(`E6 review.rootCauseAnalysis 长度 ${e.review.rootCauseAnalysis.length} < 30 字符（防止模板化）`);
    }
  }

  // E7: verification.verified = true
  if (!e.verification) {
    result.violations.push('E7 verification 阶段缺失（V 校验未执行）');
  } else {
    result.stage = 'verification';
    if (!e.verification.verified) {
      result.violations.push('E7 verification.verified = false（V 校验未通过）');
    }
  }

  // E8: humanDecision.decision = approve
  if (!e.humanDecision) {
    result.violations.push('E8 humanDecision 阶段缺失（人类未确认）');
  } else {
    result.stage = 'human';
    if (e.humanDecision.decision !== 'approve') {
      result.violations.push(`E8 humanDecision.decision = ${e.humanDecision.decision}（须为 approve）`);
    }
  }

  if (result.violations.length === 0) {
    result.stage = 'complete';
  }

  result.passed = result.violations.length === 0;
  return result;
}
