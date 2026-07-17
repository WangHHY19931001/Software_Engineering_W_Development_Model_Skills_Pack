/**
 * W-Model AI Assistant Skill - 共享类型定义
 *
 * 单一事实来源：docs/skill-design-document_SSoT.md 第 7 章（数据模型）
 * 此文件为所有模块共用的类型入口，避免重复定义。
 *
 * 设计原则：
 *   - 技能本身只包含提示词、参考、模板与门禁脚本，不包含 LLM 调用代码。
 *   - LLM-as-a-Verifier 通过 references/verifier-spec.md 提示词由外部 Agent 执行，
 *     其结构化输出由 scripts/check-verifier-output.ts 校验防漂移。
 *   - 技能演化（SkillOpt / darwin-skill）与轨迹分析不在技能内，
 *     由外部工具完成（见 SSoT §14 演化策略说明）。
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
