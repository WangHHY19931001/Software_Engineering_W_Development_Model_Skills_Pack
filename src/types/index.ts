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
}

/** 子标准定义 */
export interface SubCriterion {
  id: string;
  description: string;
  scoringPrompt: string;
  weight: number;
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
