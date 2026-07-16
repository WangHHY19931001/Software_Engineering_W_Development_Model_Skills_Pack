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
 */

import type {
  Design,
  Requirement,
  SubCriterion,
  TestCase,
  VerificationResult,
  VerifierConfig,
} from '../types';
import { LLMVerifierEngine } from './scoring-engine';
import { VerificationFramework, determineQualityLevel } from './verification-framework';
import { PPTRanker } from './ppt-ranker';
import { MockLLMClient } from './llm-client';
import type { LLMClient } from '../types';
import { RubricGenerator, type RubricType } from './rubric-generator';

/** 默认评分范围 */
const DEFAULT_RANGE = { min: 1, max: 20 };

export class WModelVerifierEnhancer {
  private engine: LLMVerifierEngine;
  private framework: VerificationFramework;
  private ranker: PPTRanker;
  private config: VerifierConfig;
  private rubricGenerator: RubricGenerator | null = null;
  private rubricConfig: NonNullable<VerifierConfig['rubric']>;

  constructor(config: VerifierConfig, llmClient?: LLMClient) {
    this.config = config;
    // 默认使用 MockLLMClient（开箱即用，便于 CI / 演示；生产环境请注入真实客户端）
    const client = llmClient ?? new MockLLMClient(config.llm);
    this.engine = new LLMVerifierEngine(config, client);
    this.framework = new VerificationFramework(this.engine, {
      alphaThreshold: config.rubric?.alphaThreshold ?? 0.8,
    });
    this.ranker = new PPTRanker(this.engine);

    // rubric 配置（默认全关闭，向后兼容）
    this.rubricConfig = config.rubric ?? {
      adaptive: false,
      dimensions: 5,
      alphaThreshold: 0.8,
      minThresholdDefault: 8,
      hardGate: false,
      cache: true,
    };
    if (this.rubricConfig.adaptive) {
      this.rubricGenerator = new RubricGenerator({
        llm: client,
        dimensions: this.rubricConfig.dimensions,
        minThresholdDefault: this.rubricConfig.minThresholdDefault,
        cache: this.rubricConfig.cache,
      });
    }
  }

  /** 暴露底层引擎（测试 / 监控用） */
  getEngine(): LLMVerifierEngine {
    return this.engine;
  }

  // ==================== 需求验证 ====================

  /** 需求分析阶段验证：完整性 / 清晰度 / 一致性 / 可追溯性 / 可行性 */
  async verifyRequirement(
    requirement: Requirement,
    taskDescription?: string
  ): Promise<VerificationResult> {
    const subCriteria = await this.resolveSubCriteria('requirement', taskDescription);
    const result = await this.framework.verifyWithThreeDimensions(requirement, {
      scoreGranularity: { range: DEFAULT_RANGE, labels: this.generateLabels(20), granularityLevel: 20 },
      repeatedEvaluation: { times: 5, varianceThreshold: 0.1, aggregationMethod: 'mean' },
      criteriaDecomposition: { originalCriteria: '需求质量', subCriteria, weights: subCriteria.map(s => s.weight) },
    });
    if (this._lastRubricFallback !== undefined) result.rubricFallback = this._lastRubricFallback;
    return result;
  }

  // ==================== 设计验证 ====================

  /** 设计阶段验证：架构清晰度 / 接口完整性 / 可扩展性 / 性能 / 安全 / 可测试性 */
  async verifyDesign(
    design: Design,
    taskDescription?: string
  ): Promise<VerificationResult> {
    const subCriteria = await this.resolveSubCriteria('design', taskDescription);
    const result = await this.framework.verifyWithThreeDimensions(design, {
      scoreGranularity: { range: DEFAULT_RANGE, labels: this.generateLabels(20), granularityLevel: 20 },
      repeatedEvaluation: { times: 5, varianceThreshold: 0.1, aggregationMethod: 'mean' },
      criteriaDecomposition: { originalCriteria: '设计质量', subCriteria, weights: subCriteria.map(s => s.weight) },
    });
    if (this._lastRubricFallback !== undefined) result.rubricFallback = this._lastRubricFallback;
    return result;
  }

  // ==================== 测试用例验证 ====================

  /** 测试用例质量验证：覆盖完整性 / 边界 / 异常 / 步骤清晰度 / 可维护性 */
  async verifyTestCaseQuality(
    testCase: TestCase,
    taskDescription?: string
  ): Promise<VerificationResult> {
    const subCriteria = await this.resolveSubCriteria('testcase', taskDescription);
    const result = await this.framework.verifyWithThreeDimensions(testCase, {
      scoreGranularity: { range: DEFAULT_RANGE, labels: this.generateLabels(20), granularityLevel: 20 },
      repeatedEvaluation: { times: 5, varianceThreshold: 0.1, aggregationMethod: 'mean' },
      criteriaDecomposition: { originalCriteria: '测试用例质量', subCriteria, weights: subCriteria.map(s => s.weight) },
    });
    if (this._lastRubricFallback !== undefined) result.rubricFallback = this._lastRubricFallback;
    return result;
  }

  /**
   * 解析子标准：adaptive 开启时走 RubricGenerator，否则用硬编码。
   * 把 rubricFallback 标记注入返回结果的 details（通过 wrapper）。
   */
  private async resolveSubCriteria(
    type: RubricType,
    taskDescription?: string
  ): Promise<SubCriterion[]> {
    if (this.rubricConfig.adaptive && this.rubricGenerator && taskDescription) {
      const result = await this.rubricGenerator.generate(type, taskDescription);
      // rubricFallback 通过闭包标记，verify* 调用方需读取；此处用全局标记
      this._lastRubricFallback = result.fallback;
      return result.subCriteria;
    }
    // adaptive 关闭或无 taskDescription → 硬编码（不标 fallback）
    this._lastRubricFallback = undefined;
    return hardcodedSubCriteria(type);
  }

  /** 上一次 resolveSubCriteria 的 fallback 标记（供 verify* 包装结果用） */
  private _lastRubricFallback: boolean | undefined = undefined;

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
    return this.engine.computeContinuousScore(prompt, target, DEFAULT_RANGE);
  }

  /** 质量等级判定（对外暴露静态工具） */
  static determineQualityLevel(score: number): import('../types').QualityLevel {
    return determineQualityLevel(score, DEFAULT_RANGE);
  }

  private generateLabels(count: number): string[] {
    const labels: string[] = [];
    for (let i = 0; i < count; i++) {
      labels.push(String.fromCharCode(65 + i));
    }
    return labels;
  }
}

/** 硬编码 subCriteria（adaptive 关闭或 fallback 时使用），与 RubricGenerator 的 fallback 一致 */
function hardcodedSubCriteria(type: RubricType): SubCriterion[] {
  switch (type) {
    case 'requirement':
      return [
        { id: 'completeness', description: '需求描述完整性', scoringPrompt: '评估需求描述的完整性和详细程度(1-20分)', weight: 0.25 },
        { id: 'clarity', description: '验收标准清晰度', scoringPrompt: '评估验收标准的清晰度和可操作性(1-20分)', weight: 0.20 },
        { id: 'consistency', description: '需求内部一致性', scoringPrompt: '评估需求内部是否存在冲突或矛盾(1-20分)', weight: 0.20 },
        { id: 'traceability', description: '需求可追溯性', scoringPrompt: '评估需求的可追溯性和可追踪性(1-20分)', weight: 0.20 },
        { id: 'feasibility', description: '技术可行性', scoringPrompt: '评估需求的技术实现可行性(1-20分)', weight: 0.15 },
      ];
    case 'design':
      return [
        { id: 'arch-clarity', description: '架构设计清晰度', scoringPrompt: '评估架构设计的清晰度、模块划分合理性、技术选型依据充分性(1-20分)', weight: 0.20 },
        { id: 'interface-completeness', description: '接口定义完整性', scoringPrompt: '评估接口定义的完整性、参数明确性、异常处理覆盖度(1-20分)', weight: 0.20 },
        { id: 'scalability', description: '可扩展性设计', scoringPrompt: '评估设计的可扩展性、扩展点预留、耦合度合理性(1-20分)', weight: 0.15 },
        { id: 'performance', description: '性能考虑', scoringPrompt: '评估性能瓶颈识别、优化方案、数据库设计、缓存策略(1-20分)', weight: 0.15 },
        { id: 'security', description: '安全性设计', scoringPrompt: '评估安全风险识别、防护措施、数据加密、权限控制(1-20分)', weight: 0.15 },
        { id: 'testability', description: '可测试性', scoringPrompt: '评估单元测试便利性、mock支持、数据隔离、测试环境设计(1-20分)', weight: 0.15 },
      ];
    case 'testcase':
      return [
        { id: 'coverage', description: '覆盖完整性', scoringPrompt: '评估测试场景覆盖的完整性和全面性(1-20分)', weight: 0.25 },
        { id: 'boundary-handling', description: '边界条件处理', scoringPrompt: '评估边界条件和极端场景的测试覆盖(1-20分)', weight: 0.20 },
        { id: 'exception-handling', description: '异常场景覆盖', scoringPrompt: '评估异常场景和错误处理的测试覆盖(1-20分)', weight: 0.20 },
        { id: 'clarity', description: '测试步骤清晰度', scoringPrompt: '评估测试步骤描述的清晰度和可操作性(1-20分)', weight: 0.15 },
        { id: 'maintainability', description: '可维护性', scoringPrompt: '评估测试用例的可维护性和易修改性(1-20分)', weight: 0.20 },
      ];
  }
}
