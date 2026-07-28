/**
 * exemption-logic.test.ts —— E1-E8 豁免审批校验单元测试
 *
 * 覆盖 exemption-logic.ts 中 S→R→V→人类四阶段审批流程规则：
 *   E1  schema 完整性
 *   E2  justification 长度 ≥ 20 字符（schema minLength:20 前置拦截）
 *   E3  evidence 数组非空（schema minItems:1 前置拦截）
 *   E4  review 阶段完整
 *   E5  review.reviewDecision = approve
 *   E6  review.rootCauseAnalysis 长度 ≥ 30 字符（schema minLength:30 前置拦截）
 *   E7  verification.verified = true
 *   E8  humanDecision.decision = approve / 缺失
 *   完整流程 四阶段全通过 → passed=true, stage=complete
 */

import { describe, it, expect } from 'vitest';
import { checkExemption, type ExemptionShape } from '../exemption-logic.js';

/** 构造一份全通过的合法 ExemptionShape（S→R→V→人类四阶段完整） */
function makeValidExemption(): ExemptionShape {
  return {
    id: 'EXEMPT-001',
    type: 'small-project-hierarchy',
    target: 'REQ-group',
    ruleId: 'R4',
    justification: '项目规模小REQ总数小于5无需拆分group',
    evidence: ['graph.json:REQ总数=4'],
    proposedAlternative: '声明单group直接派生SD',
    submittedAt: '2026-07-28T10:00:00Z',
    review: {
      reviewDecision: 'approve',
      rootCauseAnalysis: '项目为MVP试点业务范围天然聚焦单一领域无多group必要5Why分析',
      falsifiabilityCheck: '若REQ总数增长至5须重新评估',
      riskAssessment: '低风险单一group不影响SD派生',
      reviewedAt: '2026-07-28T11:00:00Z',
    },
    verification: {
      verified: true,
      verifiedAt: '2026-07-28T12:00:00Z',
    },
    humanDecision: {
      decision: 'approve',
      decidedAt: '2026-07-28T13:00:00Z',
    },
  };
}

describe('E1-E8 豁免审批校验', () => {
  // ==================== E1: schema 完整性 ====================
  describe('E1: schema 完整性', () => {
    it('E1: 缺 target 必填字段 → schema 失败 → fail', () => {
      const e = makeValidExemption();
      const { target, ...rest } = e;
      const result = checkExemption(rest);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('[schema]'))).toBe(true);
      expect(result.stage).toBe('request');
    });

    it('E1: id 不匹配 pattern → schema 失败 → fail', () => {
      const e = makeValidExemption();
      const result = checkExemption({ ...e, id: 'BAD-ID' });
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('[schema]'))).toBe(true);
      expect(result.stage).toBe('request');
    });
  });

  // ==================== E2: justification 长度 ≥ 20 字符 ====================
  describe('E2: justification 长度 ≥ 20 字符', () => {
    it('E2: justification < 20 字符 → schema 失败 → fail', () => {
      const e = makeValidExemption();
      const result = checkExemption({ ...e, justification: '太短了' });
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('[schema]') && v.includes('justification'))).toBe(true);
      expect(result.stage).toBe('request');
    });

    it('E2: justification ≥ 20 字符 → schema 通过', () => {
      const e = makeValidExemption();
      const result = checkExemption(e);
      expect(result.violations.some(v => v.includes('E2'))).toBe(false);
    });
  });

  // ==================== E3: evidence 数组非空 ====================
  describe('E3: evidence 数组非空', () => {
    it('E3: evidence 为空数组 → schema 失败 → fail', () => {
      const e = makeValidExemption();
      const result = checkExemption({ ...e, evidence: [] });
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('[schema]') && v.includes('evidence'))).toBe(true);
      expect(result.stage).toBe('request');
    });

    it('E3: evidence 非空 → schema 通过', () => {
      const e = makeValidExemption();
      const result = checkExemption(e);
      expect(result.violations.some(v => v.includes('E3'))).toBe(false);
    });
  });

  // ==================== E4: review 阶段完整 ====================
  describe('E4: review 阶段完整', () => {
    it('E4: review 缺失 → fail', () => {
      const e = makeValidExemption();
      const { review, ...rest } = e;
      const result = checkExemption(rest);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('E4'))).toBe(true);
    });
  });

  // ==================== E5: review.reviewDecision = approve ====================
  describe('E5: review.reviewDecision = approve', () => {
    it('E5: reviewDecision = reject → fail', () => {
      const e = makeValidExemption();
      e.review!.reviewDecision = 'reject';
      const result = checkExemption(e);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('E5') && v.includes('reject'))).toBe(true);
    });

    it('E5: reviewDecision = need-more-info → fail', () => {
      const e = makeValidExemption();
      e.review!.reviewDecision = 'need-more-info';
      const result = checkExemption(e);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('E5') && v.includes('need-more-info'))).toBe(true);
    });
  });

  // ==================== E6: review.rootCauseAnalysis 长度 ≥ 30 字符 ====================
  describe('E6: review.rootCauseAnalysis 长度 ≥ 30 字符', () => {
    it('E6: rootCauseAnalysis < 30 字符 → schema 失败 → fail', () => {
      const e = makeValidExemption();
      e.review!.rootCauseAnalysis = '太短了根本原因分析不足';
      const result = checkExemption(e);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('[schema]') && v.includes('rootCauseAnalysis'))).toBe(true);
    });

    it('E6: rootCauseAnalysis ≥ 30 字符 → schema 通过', () => {
      const e = makeValidExemption();
      const result = checkExemption(e);
      expect(result.violations.some(v => v.includes('E6'))).toBe(false);
    });
  });

  // ==================== E7: verification.verified = true ====================
  describe('E7: verification.verified = true', () => {
    it('E7: verification.verified = false → fail', () => {
      const e = makeValidExemption();
      e.verification!.verified = false;
      const result = checkExemption(e);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('E7') && v.includes('false'))).toBe(true);
    });

    it('E7: verification 缺失 → fail', () => {
      const e = makeValidExemption();
      const { verification, ...rest } = e;
      const result = checkExemption(rest);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('E7') && v.includes('缺失'))).toBe(true);
    });
  });

  // ==================== E8: humanDecision.decision = approve ====================
  describe('E8: humanDecision.decision = approve', () => {
    it('E8: humanDecision 缺失 → fail', () => {
      const e = makeValidExemption();
      const { humanDecision, ...rest } = e;
      const result = checkExemption(rest);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('E8') && v.includes('缺失'))).toBe(true);
      expect(result.stage).toBe('verification');
    });

    it('E8: humanDecision.decision = reject → fail', () => {
      const e = makeValidExemption();
      e.humanDecision!.decision = 'reject';
      const result = checkExemption(e);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.includes('E8') && v.includes('reject'))).toBe(true);
      expect(result.stage).toBe('human');
    });
  });

  // ==================== 完整流程：四阶段全通过 ====================
  describe('完整流程: 四阶段全通过', () => {
    it('S→R→V→人类四阶段全通过 → passed=true, stage=complete', () => {
      const e = makeValidExemption();
      const result = checkExemption(e);
      expect(result.passed).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.stage).toBe('complete');
    });
  });
});
