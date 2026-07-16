/**
 * 元技能默认配置（MetaSkillConfig）
 *
 * 对应 SSoT 第 14 章「技能演化机制」与 w-model-dev/META-SKILL.md。
 *
 * 设计目的：
 *   原 w-model-enhancer.ts 中 verifyRequirement / verifyDesign / verifyTestCaseQuality
 *   三个方法把子标准（subCriteria）、重复评估次数（times=5）、方差阈值（0.1）
 *   硬编码在方法体内。这违背了 MetaSkill-Evolve 的核心思想：
 *   「改进流程本身」应当是第一类可优化对象。
 *
 *   本模块把上述参数上提为 MetaSkillConfig，使其：
 *     1. 可被 SkillOptimizer 读取并演化（慢循环）
 *     2. 可被人工审阅与版本管理（META-SKILL.md 与代码同源）
 *     3. 可被 SkillLiftEvaluator 评估（验证演化是否带来正向 lift）
 *
 * 与 SSoT 的对应：
 *   - 子标准定义 → SSoT 第 10 章质量保障体系
 *   - 评估次数 / 方差阈值 → SSoT 第 11 章 LLM-as-a-Verifier 集成规范
 *   - 可演化性 → SSoT 第 14 章技能演化机制
 */

import type { MetaSkillConfig, MetaSubCriterion } from '../types';

/** 默认评分范围（与 LLMVerifierEngine 一致：1-20） */
export const DEFAULT_SCORE_RANGE = { min: 1, max: 20 };

/** 需求阶段子标准（原 w-model-enhancer.verifyRequirement 硬编码） */
export const DEFAULT_REQUIREMENT_SUBCRITERIA: MetaSubCriterion[] = [
  { id: 'completeness', description: '需求描述完整性', scoringPrompt: '评估需求描述的完整性和详细程度(1-20分)', weight: 0.25 },
  { id: 'clarity', description: '验收标准清晰度', scoringPrompt: '评估验收标准的清晰度和可操作性(1-20分)', weight: 0.20 },
  { id: 'consistency', description: '需求内部一致性', scoringPrompt: '评估需求内部是否存在冲突或矛盾(1-20分)', weight: 0.20 },
  { id: 'traceability', description: '需求可追溯性', scoringPrompt: '评估需求的可追溯性和可追踪性(1-20分)', weight: 0.20 },
  { id: 'feasibility', description: '技术可行性', scoringPrompt: '评估需求的技术实现可行性(1-20分)', weight: 0.15 },
];

/** 设计阶段子标准（原 w-model-enhancer.verifyDesign 硬编码） */
export const DEFAULT_DESIGN_SUBCRITERIA: MetaSubCriterion[] = [
  { id: 'arch-clarity', description: '架构设计清晰度', scoringPrompt: '评估架构设计的清晰度、模块划分合理性、技术选型依据充分性(1-20分)', weight: 0.20 },
  { id: 'interface-completeness', description: '接口定义完整性', scoringPrompt: '评估接口定义的完整性、参数明确性、异常处理覆盖度(1-20分)', weight: 0.20 },
  { id: 'scalability', description: '可扩展性设计', scoringPrompt: '评估设计的可扩展性、扩展点预留、耦合度合理性(1-20分)', weight: 0.15 },
  { id: 'performance', description: '性能考虑', scoringPrompt: '评估性能瓶颈识别、优化方案、数据库设计、缓存策略(1-20分)', weight: 0.15 },
  { id: 'security', description: '安全性设计', scoringPrompt: '评估安全风险识别、防护措施、数据加密、权限控制(1-20分)', weight: 0.15 },
  { id: 'testability', description: '可测试性', scoringPrompt: '评估单元测试便利性、mock支持、数据隔离、测试环境设计(1-20分)', weight: 0.15 },
];

/** 测试用例子标准（原 w-model-enhancer.verifyTestCaseQuality 硬编码） */
export const DEFAULT_TESTCASE_SUBCRITERIA: MetaSubCriterion[] = [
  { id: 'coverage', description: '覆盖完整性', scoringPrompt: '评估测试场景覆盖的完整性和全面性(1-20分)', weight: 0.25 },
  { id: 'boundary-handling', description: '边界条件处理', scoringPrompt: '评估边界条件和极端场景的测试覆盖(1-20分)', weight: 0.20 },
  { id: 'exception-handling', description: '异常场景覆盖', scoringPrompt: '评估异常场景和错误处理的测试覆盖(1-20分)', weight: 0.20 },
  { id: 'clarity', description: '测试步骤清晰度', scoringPrompt: '评估测试步骤描述的清晰度和可操作性(1-20分)', weight: 0.15 },
  { id: 'maintainability', description: '可维护性', scoringPrompt: '评估测试用例的可维护性和易修改性(1-20分)', weight: 0.20 },
];

/**
 * 默认元技能配置：完全保留原硬编码行为，确保演化前后行为兼容。
 *
 * SkillOptimizer 演化时会在内存中深拷贝此对象并修改副本，
 * 不直接污染默认值；只有通过验证门（Gate）的候选才会写回此模块。
 */
export const DEFAULT_META_SKILL_CONFIG: MetaSkillConfig = {
  version: 'v0.1.0',
  scoreRange: DEFAULT_SCORE_RANGE,
  phases: {
    requirement: {
      phase: 'requirement',
      subCriteria: DEFAULT_REQUIREMENT_SUBCRITERIA,
      repeatedTimes: 5,
      varianceThreshold: 0.1,
      aggregationMethod: 'mean',
    },
    design: {
      phase: 'design',
      subCriteria: DEFAULT_DESIGN_SUBCRITERIA,
      repeatedTimes: 5,
      varianceThreshold: 0.1,
      aggregationMethod: 'mean',
    },
    testCase: {
      phase: 'testCase',
      subCriteria: DEFAULT_TESTCASE_SUBCRITERIA,
      repeatedTimes: 5,
      varianceThreshold: 0.1,
      aggregationMethod: 'mean',
    },
  },
};

/**
 * 深拷贝元技能配置（演化前必须拷贝，避免污染默认值）。
 */
export function cloneMetaSkillConfig(config: MetaSkillConfig): MetaSkillConfig {
  return JSON.parse(JSON.stringify(config)) as MetaSkillConfig;
}

/**
 * 校验元技能配置合法性（SkillOptimizer 接受候选配置前的预检）：
 *   - 每阶段至少 1 条子标准
 *   - 权重为非负数
 *   - repeatedTimes >= 1
 *   - 0 <= varianceThreshold <= 1
 */
export function validateMetaSkillConfig(config: MetaSkillConfig): string[] {
  const errors: string[] = [];
  for (const phaseKey of ['requirement', 'design', 'testCase'] as const) {
    const phase = config.phases[phaseKey];
    if (!phase) {
      errors.push(`阶段 ${phaseKey} 配置缺失`);
      continue;
    }
    if (!Array.isArray(phase.subCriteria) || phase.subCriteria.length === 0) {
      errors.push(`${phaseKey}: subCriteria 至少 1 条`);
      continue;
    }
    for (const sc of phase.subCriteria) {
      if (sc.weight < 0) errors.push(`${phaseKey}.${sc.id}: weight 不能为负`);
      if (!sc.scoringPrompt?.trim()) errors.push(`${phaseKey}.${sc.id}: scoringPrompt 不能为空`);
    }
    if (phase.repeatedTimes < 1) errors.push(`${phaseKey}: repeatedTimes >= 1`);
    if (phase.varianceThreshold < 0 || phase.varianceThreshold > 1) {
      errors.push(`${phaseKey}: varianceThreshold 须在 [0, 1]`);
    }
  }
  return errors;
}
