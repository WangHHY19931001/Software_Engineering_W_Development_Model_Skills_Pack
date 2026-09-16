/**
 * 复用类型（lib/types.ts）
 *
 * 校验输入输出通用类型定义，全仓复用：
 * - StructuredViolation / GateCheckResult：结构化违规双轨的结构化形态
 * - JsonReport：--json 输出摘要形态
 */
export type { Phase } from "./constants.js";

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
  /** 非阻断警告（如 check-requirement-coverage 未提供 --graph 时 C7 降级）。 */
  warnings?: string[];
  /** 因输入不足降级为非阻断的规则 ID（如 check-requirement-coverage 未提供 --graph 时的 C7）。 */
  skippedRules?: string[];
  /** 阶段 5-8 外部校验 summary（check-artifact-gate --json，与 GATE_JSON external 同构；非 5-8 阶段为 null）。 */
  external?: unknown;
  /** M07 兼容字段；严格模式固定为空数组，不提供时间戳豁免诊断。 */
  legacy?: string[];
  /** M07 测试证据维度计数（checked/withEvidence/missing/legacy + E1-E4 违规计数）；结构失败早退时为 null。 */
  testEvidence?: unknown;
  /**
   * S18 票据内容校验计数（check-artifact-gate --json，与 `GATE_JSON.tickets` 同构）。
   * 形状与运行时一致：`checked`=票据块数 / `criticalMissing`=六条黑名单命中数 /
   * `buildabilityMissing`=Buildability 命中数；**键恒存在**——未给定 `--tickets` 时为 `null`。
   * 其它门禁不提供此字段（可选）。
   */
  tickets?: {
    checked: number;
    criticalMissing: number;
    buildabilityMissing: number;
  } | null;
  /** run-log lifecycle 状态；通过但有历史诊断时仍为 NOT_CLOSED_NOT_PROVEN。 */
  lifecycleStatus?: "CLOSED_UNDER_CURRENT_RULES" | "NOT_CLOSED_NOT_PROVEN";
  /** run-log exit 0 的语义边界说明。 */
  statusNote?: string;
  durationMs: number;
}
