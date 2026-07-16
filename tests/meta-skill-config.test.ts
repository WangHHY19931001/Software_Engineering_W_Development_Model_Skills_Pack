/**
 * MetaSkillConfig 单元测试
 *
 * 覆盖：
 *   - DEFAULT_META_SKILL_CONFIG 默认值完整性
 *   - cloneMetaSkillConfig 深拷贝独立性
 *   - validateMetaSkillConfig 合法 / 非法配置校验
 */

import { describe, it, expect } from '@jest/globals';
import {
  DEFAULT_META_SKILL_CONFIG,
  cloneMetaSkillConfig,
  validateMetaSkillConfig,
  DEFAULT_REQUIREMENT_SUBCRITERIA,
  DEFAULT_DESIGN_SUBCRITERIA,
  DEFAULT_TESTCASE_SUBCRITERIA,
} from '../src/core/meta-skill-config.js';

describe('DEFAULT_META_SKILL_CONFIG', () => {
  it('包含三阶段配置', () => {
    expect(DEFAULT_META_SKILL_CONFIG.phases.requirement).toBeDefined();
    expect(DEFAULT_META_SKILL_CONFIG.phases.design).toBeDefined();
    expect(DEFAULT_META_SKILL_CONFIG.phases.testCase).toBeDefined();
  });

  it('需求阶段有 5 条子标准，权重非负', () => {
    expect(DEFAULT_REQUIREMENT_SUBCRITERIA).toHaveLength(5);
    for (const sc of DEFAULT_REQUIREMENT_SUBCRITERIA) {
      expect(sc.weight).toBeGreaterThanOrEqual(0);
      expect(sc.scoringPrompt).toBeTruthy();
    }
  });

  it('设计阶段有 6 条子标准', () => {
    expect(DEFAULT_DESIGN_SUBCRITERIA).toHaveLength(6);
  });

  it('测试用例阶段有 5 条子标准', () => {
    expect(DEFAULT_TESTCASE_SUBCRITERIA).toHaveLength(5);
  });

  it('默认评估次数为 5，方差阈值为 0.1', () => {
    expect(DEFAULT_META_SKILL_CONFIG.phases.requirement.repeatedTimes).toBe(5);
    expect(DEFAULT_META_SKILL_CONFIG.phases.requirement.varianceThreshold).toBeCloseTo(0.1);
  });

  it('评分范围为 1-20', () => {
    expect(DEFAULT_META_SKILL_CONFIG.scoreRange).toEqual({ min: 1, max: 20 });
  });
});

describe('cloneMetaSkillConfig', () => {
  it('深拷贝：修改副本不污染默认值', () => {
    const copy = cloneMetaSkillConfig(DEFAULT_META_SKILL_CONFIG);
    copy.phases.requirement.subCriteria[0].weight = 0.99;
    copy.phases.requirement.repeatedTimes = 99;

    // 默认值未被污染
    expect(DEFAULT_META_SKILL_CONFIG.phases.requirement.subCriteria[0].weight).not.toBe(0.99);
    expect(DEFAULT_META_SKILL_CONFIG.phases.requirement.repeatedTimes).toBe(5);
  });
});

describe('validateMetaSkillConfig', () => {
  it('默认配置校验通过（无错误）', () => {
    const errors = validateMetaSkillConfig(DEFAULT_META_SKILL_CONFIG);
    expect(errors).toEqual([]);
  });

  it('子标准为空时报错', () => {
    const bad = cloneMetaSkillConfig(DEFAULT_META_SKILL_CONFIG);
    bad.phases.requirement.subCriteria = [];
    const errors = validateMetaSkillConfig(bad);
    expect(errors.some(e => e.includes('subCriteria 至少 1 条'))).toBe(true);
  });

  it('权重为负时报错', () => {
    const bad = cloneMetaSkillConfig(DEFAULT_META_SKILL_CONFIG);
    bad.phases.design.subCriteria[0].weight = -0.5;
    const errors = validateMetaSkillConfig(bad);
    expect(errors.some(e => e.includes('weight 不能为负'))).toBe(true);
  });

  it('repeatedTimes < 1 报错', () => {
    const bad = cloneMetaSkillConfig(DEFAULT_META_SKILL_CONFIG);
    bad.phases.testCase.repeatedTimes = 0;
    const errors = validateMetaSkillConfig(bad);
    expect(errors.some(e => e.includes('repeatedTimes >= 1'))).toBe(true);
  });

  it('varianceThreshold 超出 [0,1] 报错', () => {
    const bad = cloneMetaSkillConfig(DEFAULT_META_SKILL_CONFIG);
    bad.phases.requirement.varianceThreshold = 1.5;
    const errors = validateMetaSkillConfig(bad);
    expect(errors.some(e => e.includes('varianceThreshold 须在 [0, 1]'))).toBe(true);
  });
});
