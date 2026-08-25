/**
 * 复用类型（lib/types.ts）
 *
 * 校验输入输出通用类型定义，全仓复用：
 * - StructuredViolation / GateCheckResult：结构化违规双轨的结构化形态
 * - JsonReport：--json 输出摘要形态
 */
export type { Phase } from './constants.js';

/** 结构化违规（rule/field/message 三要素） */
export interface StructuredViolation {
  rule: string;
  field?: string;
  message: string;
}

/** 门禁校验通用结果（兼容现有 violations: string[]，structuredViolations 为过渡可选字段） */
export interface GateCheckResult {
  passed: boolean;
  violations: string[];
  structuredViolations?: StructuredViolation[];
}

/** 门禁 JSON 摘要报告（--json 输出形态） */
export interface JsonReport {
  type: string;
  passed: boolean;
  reasons: string[];
  violations: { rule: string; count: number }[];
  /** verifier --json 报告的质量等级（其他门禁不提供此字段）。 */
  qualityLevel?: string;
  /** 可选的规则原始分组，供 docs-consistency 等报告保留兼容摘要同时暴露分类明细。 */
  staticViolations?: unknown[];
  dynamicViolations?: unknown[];
  /** 当前运行时采集的数值事实，不是硬编码规范。 */
  dynamicMeasurements?: Record<string, unknown>;
  /** 非阻断生命周期诊断（例如 LEGACY_UNSCOPED/pending-pre-approval）。 */
  diagnostics?: string[];
  /** run-log lifecycle 状态；通过但有历史诊断时仍为 NOT_CLOSED_NOT_PROVEN。 */
  lifecycleStatus?: 'CLOSED_UNDER_CURRENT_RULES' | 'NOT_CLOSED_NOT_PROVEN';
  /** run-log exit 0 的语义边界说明。 */
  statusNote?: string;
  durationMs: number;
}
