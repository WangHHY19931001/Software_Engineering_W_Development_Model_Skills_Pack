/**
 * exemption-logic.test.ts —— E1-E9 豁免审批校验单元测试
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
 *
 * 同质用例已按「循环内多断言 + 逐行具名消息」聚合（wave 3 第 B 批）。
 */

import { describe, it, expect } from 'vitest';

import { checkExemption, type ExemptionShape } from '../logic/exemption-logic.js';

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

describe('E1-E9 豁免审批校验', () => {
  // ==================== E1-E9 负例矩阵（15 负例，schema 行 / E4-E9 行两组） ====================
  describe('E1-E9 负例矩阵', () => {
    it('schema 行负例（5 态：E1×2 / E2 / E3 / E6）→ [schema] 失败', () => {
      const rows: readonly [
        string,
        (e: ExemptionShape) => Parameters<typeof checkExemption>[0],
        string | null,
        string | null,
      ][] = [
        [
          'E1: 缺 target 必填字段',
          (e) => {
            const { target: _target, ...rest } = e;
            return rest;
          },
          null,
          'request',
        ],
        ['E1: id 不匹配 pattern（BAD-ID）', (e) => ({ ...e, id: 'BAD-ID' }), null, 'request'],
        ['E2: justification < 20 字符', (e) => ({ ...e, justification: '太短了' }), 'justification', 'request'],
        ['E3: evidence 为空数组', (e) => ({ ...e, evidence: [] }), 'evidence', 'request'],
        [
          'E6: rootCauseAnalysis < 30 字符',
          (e) => {
            e.review!.rootCauseAnalysis = '太短了根本原因分析不足';
            return e;
          },
          'rootCauseAnalysis',
          null,
        ],
      ];
      for (const [name, build, token, expectedStage] of rows) {
        const result = checkExemption(build(makeValidExemption()));
        expect(result.passed, `${name} 应 fail`).toBe(false);
        expect(
          result.violations.some((v) =>
            token === null ? v.includes('[schema]') : v.includes('[schema]') && v.includes(token),
          ),
          `${name} 应报 [schema]${token ? ` 且点名 ${token}` : ''}`,
        ).toBe(true);
        if (expectedStage !== null) {
          expect(result.stage, `${name} stage 应为 ${expectedStage}`).toBe(expectedStage);
        }
      }
    });

    it('E4-E9 行负例（10 态：E4 缺失 / E5 拒绝×2 / E7×2 / E8×2 / E9 乱序×3）→ fail', () => {
      const rows: readonly [
        string,
        (e: ExemptionShape) => Parameters<typeof checkExemption>[0],
        string,
        string | null,
        string | null,
      ][] = [
        [
          'E4: review 缺失',
          (e) => {
            const { review: _review, ...rest } = e;
            return rest;
          },
          'E4',
          null,
          null,
        ],
        [
          'E5: reviewDecision = reject',
          (e) => {
            e.review!.reviewDecision = 'reject';
            return e;
          },
          'E5',
          'reject',
          null,
        ],
        [
          'E5: reviewDecision = need-more-info',
          (e) => {
            e.review!.reviewDecision = 'need-more-info';
            return e;
          },
          'E5',
          'need-more-info',
          null,
        ],
        [
          'E7: verification.verified = false',
          (e) => {
            e.verification!.verified = false;
            return e;
          },
          'E7',
          'false',
          null,
        ],
        [
          'E7: verification 缺失',
          (e) => {
            const { verification: _verification, ...rest } = e;
            return rest;
          },
          'E7',
          '缺失',
          null,
        ],
        [
          'E8: humanDecision 缺失',
          (e) => {
            const { humanDecision: _humanDecision, ...rest } = e;
            return rest;
          },
          'E8',
          '缺失',
          'verification',
        ],
        [
          'E8: humanDecision.decision = reject',
          (e) => {
            e.humanDecision!.decision = 'reject';
            return e;
          },
          'E8',
          'reject',
          'human',
        ],
        [
          'E9: submittedAt >= reviewedAt（时序乱序）',
          (e) => {
            e.submittedAt = '2026-07-28T12:00:00Z'; // 晚于 reviewedAt
            return e;
          },
          'E9',
          'submittedAt',
          null,
        ],
        [
          'E9: reviewedAt >= verifiedAt（时序乱序）',
          (e) => {
            e.review!.reviewedAt = '2026-07-28T13:00:00Z'; // 晚于 verifiedAt
            return e;
          },
          'E9',
          'reviewedAt',
          null,
        ],
        [
          'E9: verifiedAt >= decidedAt（时序乱序）',
          (e) => {
            e.verification!.verifiedAt = '2026-07-28T14:00:00Z'; // 晚于 decidedAt
            return e;
          },
          'E9',
          'verifiedAt',
          null,
        ],
      ];
      for (const [name, build, rule, token, expectedStage] of rows) {
        const result = checkExemption(build(makeValidExemption()));
        expect(result.passed, `${name} 应 fail`).toBe(false);
        expect(
          result.violations.some((v) => (token === null ? v.includes(rule) : v.includes(rule) && v.includes(token))),
          `${name} 应报 ${rule}${token ? ` 且点名 ${token}` : ''}`,
        ).toBe(true);
        if (expectedStage !== null) {
          expect(result.stage, `${name} stage 应为 ${expectedStage}`).toBe(expectedStage);
        }
      }
    });
  });

  // ==================== E2/E3/E6/E9 正例对照 ====================
  describe('E2/E3/E6/E9 正例对照', () => {
    it('完整输入下对应规则零违规（4 行：E2 / E3 / E6 / E9）', () => {
      for (const rule of ['E2', 'E3', 'E6', 'E9'] as const) {
        const e = makeValidExemption();
        const result = checkExemption(e);
        expect(
          result.violations.some((v) => v.includes(rule)),
          `正例对照 ${rule}: 不应报 ${rule}`,
        ).toBe(false);
      }
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
