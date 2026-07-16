/**
 * W-Model AI Assistant Skill - 共享类型定义
 *
 * 单一事实来源：skill-design-document_SSoT.md 第 7 章（数据模型）
 * 此文件为所有模块共用的类型入口，避免重复定义。
 */

// ==================== 项目 / 需求 / 设计 / 测试用例 ====================

/** W 模型 8 个阶段 */
export type ProjectPhase =
  | '需求分析'
  | '系统设计'
  | '概要设计'
  | '详细设计'
  | '编码'
  | '集成测试'
  | '系统测试'
  | '验收测试';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectPhase;
  techStack: {
    frontend: string[];
    backend: string[];
    database: string[];
    others: string[];
  };
  createdAt: string; // ISO 字符串，便于 JSON 序列化
  updatedAt: string;
}

export type RequirementType = '功能需求' | '非功能需求' | '约束需求';
export type Priority = '高' | '中' | '低';
export type RequirementStatus = '待开发' | '开发中' | '已完成' | '已验证';

export interface Requirement {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: RequirementType;
  priority: Priority;
  acceptanceCriteria: string[];
  testCases: string[]; // TestCase id 引用列表
  status: RequirementStatus;
}

export type DesignType = '系统设计' | '概要设计' | '详细设计';

export interface Design {
  id: string;
  projectId: string;
  type: DesignType;
  content: string;
  diagrams: Diagram[];
  testCases: string[];
  createdAt: string;
}

export interface Diagram {
  id: string;
  type: '架构图' | '类图' | 'ER图' | '时序图' | '接口图' | '其他';
  content: string; // mermaid / plantuml 源码
}

export type TestCaseType = '验收测试' | '系统测试' | '集成测试' | '单元测试';
export type TestCaseStatus = '待执行' | '通过' | '失败';

export interface TestCase {
  id: string;
  projectId: string;
  type: TestCaseType;
  title: string;
  description: string;
  steps: string[];
  expectedResult: string;
  status: TestCaseStatus;
  priority: Priority;
  requirementId?: string; // 反向追溯到需求
  designId?: string; // 反向追溯到设计
}

// ==================== LLM-as-a-Verifier 类型 ====================

/** 质量等级（与连续分数对应） */
export type QualityLevel =
  | 'excellent'
  | 'good'
  | 'acceptable'
  | 'poor'
  | 'unacceptable';

/** 验证结果 */
export interface VerificationResult {
  finalScore: number;
  subScores: Record<string, number>;
  confidence: number;
  qualityLevel: QualityLevel;
  details?: unknown;
  /** 当 LLM 不支持 logits 时回退使用文本解析路径 */
  fallbackUsed?: boolean;
  /** 可靠性指标：Krippendorff's alpha（单模型多 run 代理）；null 表示无法计算（N<2） */
  reliability?: { alpha: number | null; coders: number };
  /** 部署门：pass=可放行，review=需人工复核，fail=不达标（硬门模式抛错） */
  deploymentGate?: 'pass' | 'review' | 'fail';
  /** 各维度是否违规（低于 minThreshold） */
  dimensionFlags?: { id: string; violated: boolean }[];
  /** rubric 是否回退到硬编码（RubricGenerator 失败时为 true） */
  rubricFallback?: boolean;
}

/** 子标准定义 */
export interface SubCriterion {
  id: string;
  description: string;
  scoringPrompt: string;
  weight: number;
  /** 标记此子标准是否来自自适应生成（true=LLM 生成，false/undefined=硬编码） */
  taskAdaptive?: boolean;
  /** 维度级最低可接受阈值（归一化到 1-20 等价分数）。低于此值触发 DimensionAwareFilter 降级 */
  minThreshold?: number;
  /** 5 级评分描述（可选，用于 rubric 可读性） */
  levelDescriptors?: string[];
}

/** 三维度验证框架配置 */
export interface VerificationDimension {
  // 维度一：评分粒度
  scoreGranularity: {
    range: { min: number; max: number };
    labels: string[]; // 如 ["A", "B", ..., "T"]
    granularityLevel: number;
  };
  // 维度二：重复评估
  repeatedEvaluation: {
    times: number;
    varianceThreshold: number;
    aggregationMethod: 'mean' | 'median' | 'weighted';
  };
  // 维度三：标准分解
  criteriaDecomposition: {
    originalCriteria: string;
    subCriteria: SubCriterion[];
    weights: number[];
  };
}

/** 连续评分引擎接口 */
export interface ContinuousScoringEngine {
  computeContinuousScore(
    prompt: string,
    candidate: unknown,
    scoreRange?: { min: number; max: number }
  ): Promise<number>;
  getScoreDistribution(
    prompt: string,
    candidate: unknown
  ): Promise<Map<number, number>>;
}

// ==================== LLM 客户端类型 ====================

/**
 * LLM 客户端响应。
 * `logits` 可选——当模型 / SDK 不支持时为 undefined，引擎会走 fallback 路径。
 */
export interface LLMResponse {
  text: string;
  logits?: number[][];
  /** 标记本次调用是否支持 logits（用于诊断与统计） */
  supportsLogits: boolean;
}

export interface LLMGenerateOptions {
  returnLogits?: boolean;
  temperature?: number;
  candidate?: string;
  maxTokens?: number;
}

/**
 * LLM 客户端抽象接口。
 * 任何符合此接口的实现（OpenAI / Anthropic / 本地推理 / Mock）都可注入。
 */
export interface LLMClient {
  generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse>;
}

export interface LLMClientConfig {
  model: string;
  apiKey?: string;
  baseURL?: string;
  /** 是否原生支持返回 logits（用于决定是否启用 fallback） */
  supportsLogits?: boolean;
}

// ==================== Verifier 配置 ====================

export interface VerifierConfig {
  llm: LLMClientConfig;
  temperature?: number;
  continuousScoring?: {
    enabled: boolean;
    scoreRange: { min: number; max: number };
  };
  threeDimensions?: {
    granularity: { level: number; adaptive: boolean };
    repeatedEvaluation: { defaultTimes: number; varianceThreshold: number };
  };
  pptRanking?: {
    enabled: boolean;
    defaultPivotCount: number;
  };
  /**
   * 当 LLM 不支持 logits 时的回退策略：
   * - 'text-parse'：让 LLM 输出字母 / 数字，正则解析后映射为分数（默认）
   * - 'discrete'：退化为离散分数（仅取整数值）
   * - 'throw'：直接抛错
   */
  fallbackStrategy?: 'text-parse' | 'discrete' | 'throw';
  /**
   * 自适应 rubric 与可靠性门控配置。
   * 未提供时：adaptive=false，行为与原版完全一致。
   */
  rubric?: {
    /** 是否启用自适应 rubric 生成（默认 false） */
    adaptive: boolean;
    /** 生成的维度数（默认 5） */
    dimensions: number;
    /** Krippendorff's alpha 部署门阈值（默认 0.80） */
    alphaThreshold: number;
    /** 维度级 minThreshold 默认值（归一化到 1-20 等价分数，默认 8） */
    minThresholdDefault: number;
    /** 硬门模式：gate=fail 时抛 ReliabilityGateError（默认 false=软标记） */
    hardGate: boolean;
    /** 是否缓存生成的 rubric（默认 true） */
    cache: boolean;
  };
}

// ==================== PPT 排名类型 ====================

export interface RankingResult<T = unknown> {
  ranking: Array<{ candidate: T; score: number }>;
  pivots: T[];
  totalComparisons: number;
  complexity: string;
}

// ==================== RTM 类型 ====================

export interface RTMRow {
  requirementId: string;
  requirementDescription: string;
  designDoc?: string;
  codeModule?: string;
  unitTest?: string;
  integrationTest?: string;
  systemTest?: string;
  acceptanceTest?: string;
  coverageStatus: '100%' | '部分' | '待覆盖';
}

export interface RTMMatrix {
  projectName: string;
  lastUpdated: string;
  currentPhase: ProjectPhase;
  rows: RTMRow[];
  executionSummary: {
    unitTest: { total: number; passed: number; failed: number; pending: number; coverage: number };
    integrationTest: { total: number; passed: number; failed: number; pending: number; coverage: number };
    systemTest: { total: number; passed: number; failed: number; pending: number; coverage: number };
    acceptanceTest: { total: number; passed: number; failed: number; pending: number; coverage: number };
  };
  changeLog: Array<{
    date: string;
    change: string;
    affectedRequirements: string[];
    operator: string;
  }>;
}

// ==================== 命令处理类型 ====================

export interface CommandContext {
  projectState: import('../state/project-state').ProjectStateManager;
  rtm: import('../state/rtm-manager').RTMManager;
  verifier?: import('../core/w-model-enhancer').WModelVerifierEnhancer;
  cwd: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  artifacts?: string[]; // 产出文件路径
  data?: unknown;
}

export type CommandHandler = (
  args: string[],
  ctx: CommandContext
) => Promise<CommandResult>;
