/**
 * W-Model 验证增强器
 *
 * 将 LLM-as-a-Verifier 集成到 W-Model 各阶段：
 *   - 需求分析阶段 → 需求质量验证
 *   - 设计阶段 → 设计文档质量验证
 *   - 测试阶段 → 测试用例质量验证 + 优先级排序
 *
 * 设计原则：每个 W 模型阶段都有对应的 verify* 方法，
 * 在阶段门评审时调用，提供连续评分与置信度，替代粗糙的二值判断。
 *
 * 可演化性（对应 SSoT 第 14 章）：
 *   子标准 / 评估次数 / 方差阈值不再硬编码在方法体内，
 *   而是从 MetaSkillConfig 读取（默认值见 meta-skill-config.ts）。
 *   SkillOptimizer 可替换此配置实现慢循环演化。
 */

import type {
  Design,
  MetaSkillConfig,
  MetaSkillPhaseConfig,
  Requirement,
  TestCase,
  VerificationResult,
  VerifierConfig,
} from '../types';
import { LLMVerifierEngine } from './scoring-engine';
import { VerificationFramework, determineQualityLevel } from './verification-framework';
import { PPTRanker } from './ppt-ranker';
import { MockLLMClient } from './llm-client';
import type { LLMClient } from '../types';
import { DEFAULT_META_SKILL_CONFIG, DEFAULT_SCORE_RANGE } from './meta-skill-config';

export class WModelVerifierEnhancer {
  private engine: LLMVerifierEngine;
  private framework: VerificationFramework;
  private ranker: PPTRanker;
  private config: VerifierConfig;
  /** 元技能配置：可被 SkillOptimizer 替换以实现慢循环演化 */
  private metaSkill: MetaSkillConfig;

  constructor(config: VerifierConfig, llmClient?: LLMClient, metaSkill?: MetaSkillConfig) {
    this.config = config;
    // 默认使用 MockLLMClient（开箱即用，便于 CI / 演示；生产环境请注入真实客户端）
    this.engine = new LLMVerifierEngine(
      config,
      llmClient ?? new MockLLMClient(config.llm)
    );
    this.framework = new VerificationFramework(this.engine);
    this.ranker = new PPTRanker(this.engine);
    this.metaSkill = metaSkill ?? DEFAULT_META_SKILL_CONFIG;
  }

  /** 暴露底层引擎（测试 / 监控用） */
  getEngine(): LLMVerifierEngine {
    return this.engine;
  }

  /** 暴露当前元技能配置（SkillOptimizer 读取 / 评估用） */
  getMetaSkillConfig(): MetaSkillConfig {
    return this.metaSkill;
  }

  /** 替换元技能配置（SkillOptimizer 在候选通过 Gate 后调用，实现技能更新） */
  setMetaSkillConfig(config: MetaSkillConfig): void {
    this.metaSkill = config;
  }

  // ==================== 需求验证 ====================

  /** 需求分析阶段验证：完整性 / 清晰度 / 一致性 / 可追溯性 / 可行性 */
  async verifyRequirement(requirement: Requirement): Promise<VerificationResult> {
    const phase = this.metaSkill.phases.requirement;
    return this.verifyWithPhase(requirement, phase, '需求质量');
  }

  // ==================== 设计验证 ====================

  /** 设计阶段验证：架构清晰度 / 接口完整性 / 可扩展性 / 性能 / 安全 / 可测试性 */
  async verifyDesign(design: Design): Promise<VerificationResult> {
    const phase = this.metaSkill.phases.design;
    return this.verifyWithPhase(design, phase, '设计质量');
  }

  // ==================== 测试用例验证 ====================

  /** 测试用例质量验证：覆盖完整性 / 边界 / 异常 / 步骤清晰度 / 可维护性 */
  async verifyTestCaseQuality(testCase: TestCase): Promise<VerificationResult> {
    const phase = this.metaSkill.phases.testCase;
    return this.verifyWithPhase(testCase, phase, '测试用例质量');
  }

  /** 测试用例优先级排序（PPT 算法） */
  async rankTestCasesByPriority(testCases: TestCase[]): Promise<import('../types').RankingResult<TestCase>> {
    return this.ranker.rankCandidates(
      testCases,
      '测试用例重要性和价值',
      this.config.pptRanking?.defaultPivotCount ?? 5
    );
  }

  // ==================== 通用 ====================

  /** 单次连续评分（直接调用引擎，不走三维度框架） */
  async score(target: unknown, prompt: string): Promise<number> {
    return this.engine.computeContinuousScore(prompt, target, DEFAULT_SCORE_RANGE);
  }

  /** 质量等级判定（对外暴露静态工具） */
  static determineQualityLevel(score: number): import('../types').QualityLevel {
    return determineQualityLevel(score, DEFAULT_SCORE_RANGE);
  }

  // ==================== 私有工具 ====================

  /**
   * 统一的三维度验证入口：从元技能配置读取子标准 / 次数 / 阈值。
   * 原三个 verify* 方法的硬编码逻辑收敛至此。
   */
  private async verifyWithPhase(
    target: Requirement | Design | TestCase,
    phase: MetaSkillPhaseConfig,
    criteriaName: string
  ): Promise<VerificationResult> {
    const subCriteria = phase.subCriteria;
    const range = this.metaSkill.scoreRange;
    return this.framework.verifyWithThreeDimensions(target, {
      scoreGranularity: {
        range,
        labels: this.generateLabels(range.max - range.min + 1),
        granularityLevel: range.max - range.min + 1,
      },
      repeatedEvaluation: {
        times: phase.repeatedTimes,
        varianceThreshold: phase.varianceThreshold,
        aggregationMethod: phase.aggregationMethod,
      },
      criteriaDecomposition: {
        originalCriteria: criteriaName,
        subCriteria,
        weights: subCriteria.map(s => s.weight),
      },
    });
  }

  private generateLabels(count: number): string[] {
    const labels: string[] = [];
    for (let i = 0; i < count; i++) {
      labels.push(String.fromCharCode(65 + i));
    }
    return labels;
  }
}
