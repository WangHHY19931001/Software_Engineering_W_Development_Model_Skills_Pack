/**
 * W-Model AI Assistant Skill - 共享类型定义
 *
 * 单一事实来源：docs/skill-design-document_SSoT.md 第 7 章（数据模型）
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

// ==================== 元技能配置（MetaSkillConfig） ====================
//
// 对应 SSoT 第 14 章「技能演化机制」与 w-model-dev/META-SKILL.md。
// 将原硬编码在 w-model-enhancer.ts 中的子标准 / 评估次数 / 方差阈值上提为
// 可演化配置，使元技能本身成为第一类可优化对象（MetaSkill-Evolve 思想）。

/**
 * 单条子标准定义。
 * weight 在同一组 subCriteria 内应归一化（不强求和为 1，由 framework 加权）。
 */
export interface MetaSubCriterion {
  id: string;
  description: string;
  scoringPrompt: string;
  weight: number;
}

/**
 * 元技能配置：描述某一验证阶段（需求 / 设计 / 测试用例）的评估策略。
 * 所有字段均可被 SkillOptimizer 演化。
 */
export interface MetaSkillPhaseConfig {
  /** 阶段标识：requirement | design | testCase */
  phase: 'requirement' | 'design' | 'testCase';
  /** 子标准集合（对应 SSoT 第 10 章 / w-model-enhancer.verify* 方法） */
  subCriteria: MetaSubCriterion[];
  /** 重复评估次数（原硬编码 times: 5） */
  repeatedTimes: number;
  /** 方差阈值，超过则置信度衰减（原硬编码 0.1） */
  varianceThreshold: number;
  /** 聚合方法 */
  aggregationMethod: 'mean' | 'median' | 'weighted';
}

/**
 * 元技能根配置：聚合三个阶段的可演化参数。
 * 对应 META-SKILL.md 的可训练状态。
 */
export interface MetaSkillConfig {
  /** 配置版本，便于演化追踪 */
  version: string;
  /** 评分范围（默认 1-20） */
  scoreRange: { min: number; max: number };
  /** 三阶段配置 */
  phases: {
    requirement: MetaSkillPhaseConfig;
    design: MetaSkillPhaseConfig;
    testCase: MetaSkillPhaseConfig;
  };
}

// ==================== 技能演化（SkillOpt ReflectTrainer） ====================
//
// 对应 SSoT 第 14 章。将技能文档（SKILL.md / references/）视为可训练外部状态，
// 通过 Rollout → Reflect → Edit → Gate 闭环优化。

/** 受保护区域标记：被标记的章节不可被编辑（SkillOpt 的 protected region） */
export interface ProtectedRegion {
  /** 章节标题或文件路径标识 */
  id: string;
  /** 不可编辑的原因 */
  reason: string;
}

/** 单条候选编辑（add / delete / replace） */
export interface SkillEdit {
  /** 操作类型 */
  op: 'add' | 'delete' | 'replace';
  /** 目标文件路径（相对仓库根） */
  targetFile: string;
  /** 锚点：被操作文本片段或章节标题 */
  anchor: string;
  /** 新增 / 替换内容（delete 时为空） */
  content?: string;
  /** 该编辑由 optimizer 反思哪条失败轨迹得出 */
  rationale: string;
  /** 字符数预算消耗（用于学习率约束） */
  budgetCost: number;
}

/** 一次 rollout 的证据：W 模型一次完整运行的轨迹与评分 */
export interface RolloutEvidence {
  /** 运行时间戳 */
  timestamp: string;
  /** 任务标识（benchmark 项目 ID） */
  taskId: string;
  /** 是否通过质量门 */
  qualityGatePassed: boolean;
  /** RTM 覆盖率 */
  rtmCoverage: number;
  /** 阶段回退次数（skill efficiency 反指标） */
  phaseRollbacks: number;
  /** 各工件 verifier 评分 */
  verificationScores: Array<{
    phase: string;
    entityId: string;
    finalScore: number;
    confidence: number;
    subScores: Record<string, number>;
  }>;
  /** 失败的子标准（用于 reflect minibatch） */
  failedSubCriteria: string[];
}

/** Reflect 阶段产出的候选技能 */
export interface CandidateSkill {
  /** 候选 ID */
  id: string;
  /** 父技能版本哈希 */
  parentHash: string;
  /** 应用的编辑列表 */
  edits: SkillEdit[];
  /** 候选技能文本快照（用于比对） */
  snapshot: string;
  /** Reflect 时引用的证据 */
  evidenceRefs: string[];
}

/** Gate 阶段的验证结果 */
export interface GateResult {
  /** 候选 ID */
  candidateId: string;
  /** 留出集上的 Skill Lift（候选 - 基线） */
  skillLift: number;
  /** 是否通过验证门（严格提升才通过） */
  accepted: boolean;
  /** 拒绝原因（未通过时） */
  rejectionReason?: string;
  /** 留出集逐任务表现 */
  perTaskResults: Array<{ taskId: string; baselineMetric: number; candidateMetric: number }>;
}

/** 演化训练配置 */
export interface SkillEvolutionConfig {
  /** 训练轮数 */
  epochs: number;
  /** 每轮 rollout 任务数 */
  batchSize: number;
  /** 文本学习率：每轮最大字符编辑预算 */
  editBudget: number;
  /** 验证门是否启用（论文默认 true；false 表示强制接受，仅用于实验） */
  validationGateEnabled: boolean;
  /** 受保护区域列表 */
  protectedRegions: ProtectedRegion[];
  /** 留出集任务 ID（gate 评估用） */
  heldOutTaskIds: string[];
  /** optimizer LLM 配置（与 target 可不同） */
  optimizerLLM: LLMClientConfig;
}

// ==================== 技能评估（Skill Lift / ACES / SkillsBench） ====================
//
// 对应 SSoT 第 15 章。评估技能本身（而非工件）是否有效。

/** 评估条件（SkillsBench 三条件对照） */
export type EvalCondition = 'no-skill' | 'curated-skill' | 'self-generated-skill';

/** 单个评估任务定义 */
export interface EvalTask {
  id: string;
  /** 任务描述（自然语言需求） */
  description: string;
  /** 技术栈 */
  techStack?: Project['techStack'];
  /** 确定性 verifier：返回 pass/fail 与得分（避免 LLM-as-judge 方差） */
  deterministicVerifier?: (store: unknown) => { passed: boolean; score: number };
  /** 期望的 W 模型阶段序列 */
  expectedPhases?: ProjectPhase[];
}

/** SkillLearnBench 三级评估结果 */
export interface ThreeLevelEvalResult {
  taskId: string;
  /** Level 1：技能规格质量（coverage / executability / safety） */
  level1SpecQuality: {
    coverage: number; // 0-1
    executability: number; // 0-1
    safety: number; // 0-1
  };
  /** Level 2：轨迹分析（skill usage rate / trajectory alignment） */
  level2Trajectory: {
    skillUsageRate: number; // 0-1
    trajectoryAlignment: number; // 0-1
  };
  /** Level 3：任务结果（pass rate） */
  level3Outcome: {
    passed: boolean;
    qualityGatePassed: boolean;
    rtmCoverage: number;
  };
}

/** ACES Skill Lift：with-skill vs without-skill 配对差值 */
export interface SkillLiftResult {
  taskId: string;
  condition: EvalCondition;
  /** with-skill 指标 */
  withSkill: {
    qualityGatePassed: boolean;
    rtmCoverage: number;
    avgVerifierScore: number;
    phaseRollbacks: number;
  };
  /** baseline（no-skill）指标 */
  baseline: {
    qualityGatePassed: boolean;
    rtmCoverage: number;
    avgVerifierScore: number;
    phaseRollbacks: number;
  };
  /** Skill Lift = withSkill - baseline（越正越好） */
  lift: {
    qualityGateDelta: number; // +1 / 0 / -1
    rtmCoverageDelta: number;
    avgScoreDelta: number;
    rollbackDelta: number; // 越负越好（回退减少）
  };
}

/** 一次完整评估报告 */
export interface SkillEvalReport {
  /** 被评估的技能版本哈希 */
  skillHash: string;
  /** 评估条件 */
  condition: EvalCondition;
  /** 任务数 */
  taskCount: number;
  /** 平均 Skill Lift */
  meanSkillLift: number;
  /** 正向 lift 的任务占比 */
  positiveLiftRate: number;
  /** 三级评估汇总 */
  threeLevelSummary: {
    meanCoverage: number;
    meanSkillUsageRate: number;
    passRate: number;
  };
  /** 逐任务结果 */
  perTask: SkillLiftResult[];
}
