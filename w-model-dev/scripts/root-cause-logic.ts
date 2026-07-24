/**
 * RootCauseReport 校验纯逻辑（Root Cause Logic）—— 防止 R 子代理产出漂移
 *
 * 对应 spec §4 RootCauseReport Schema 与 R1-R10 校验规则。
 *
 * 设计原则（与 verifier-logic.ts / graph-logic.ts / tla-logic.ts 一致）：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状，不 import 外部模块
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用
 *   3. 单点事实：所有「R 报告是否符合规范」的判定均委托至此
 */

// ==================== 自包含类型形状 ====================

export type TargetKind = 'rootcause';
export type ReworkSource = 'verifier' | 'gate';
export type AnalysisMethod = '5-why' | 'fishbone' | 'defect-chain' | 'upstream-trace' | 'combined';
export type RootCauseCategory =
  | 'requirement-gap'
  | 'design-flaw'
  | 'coding-error'
  | 'test-gap'
  | 'process-missing'
  | 'tool-gap'
  | 'upstream-defect';
export type QualityLevel = 'A' | 'B' | 'C' | 'D';

export interface RootCauseReportShape {
  schemaVersion: string;
  meta: {
    reportId: string;
    targetKind: 'rootcause';
    targetArtifact: string;
    targetPhase: string;
    reworkRound: number;
    reworkSource: ReworkSource;
    persona: string;
    method: AnalysisMethod;
    analysisTimestamp: string;
  };
  input: {
    reworkHints: string[];
    verifierOutputPath?: string;
    gateJsonPath?: string;
  };
  phenomenon: {
    summary: string;
    severity: 'Critical' | 'Required' | 'Optional' | 'Nit' | 'FYI';
    affectedArtifacts: string[];
  };
  rootCauseChain: Array<{
    step: number;
    why: string;
    answer: string;
    evidence: string;
  }>;
  rootCause: {
    category: RootCauseCategory;
    description: string;
    evidence: string;
    falsifiabilityCheck: string;
  };
  upstreamDefect: {
    present: boolean;
    upstreamPhase?: string;
    upstreamArtifactId?: string;
    defectDescription?: string;
    rollbackRecommended: boolean;
  };
  fixRecommendation: Array<{
    target: string;
    location: string;
    action: string;
    rationale: string;
  }>;
  prevention: Array<{
    scope: string;
    measure: string;
    owner: string;
  }>;
  qualityLevel: QualityLevel;
  passed: boolean;
  summary: string;
  reviewNotes?: string;
  /** 多角度场景（method=combined）附录：PartialReport 路径列表 */
  partialReports?: Array<{
    personaSlice: string;
    path: string;
    confidence: number;
  }>;
}

// ==================== 校验结果 ====================

export interface RootCauseCheckResult {
  passed: boolean;
  reasons: string[];
}

// ==================== 常量 ====================

const SCHEMA_VERSION = '1.0';
const MIN_CHAIN_LENGTH = 2;
const MAX_CHAIN_LENGTH = 5;
const MIN_REALITY_CONFIDENCE = 0.5;
const REPORT_ID_PATTERN = /^RC-[a-z0-9]+-\d+-\d+$/;
const FALSIFIABILITY_PATTERN = /若.*则/;

// ==================== 工具函数 ====================

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.trim() !== '';
}

function isIso8601(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value));
}

// ==================== 主校验函数 ====================

/**
 * 校验外部 R 子代理产出的 RootCauseReport JSON 是否符合 spec §4 Schema。
 *
 * 校验项 R1-R10（见 spec §4.4）：
 *   R1 Schema 完整性
 *   R2 rootCauseChain 长度 [2,5] + evidence 非空
 *   R3 falsifiabilityCheck 含「若...则」句式
 *   R4 fixRecommendation 四字段
 *   R5 prevention 三字段
 *   R6 upstreamDefect.present=true 时后续字段非空
 *   R7 qualityLevel 与 passed 一致
 *   R8 reportId 格式
 *   R9 多角度场景 partialReports 非空
 *   R10 多角度场景 reality-checker confidence ≥ 0.5
 */
export function checkRootCauseReport(input: unknown): RootCauseCheckResult {
  const reasons: string[] = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { passed: false, reasons: ['RootCauseReport 必须为对象'] };
  }
  const r = input as Partial<RootCauseReportShape>;

  // schemaVersion
  if (r.schemaVersion !== SCHEMA_VERSION) {
    reasons.push(`schemaVersion 必须为 "${SCHEMA_VERSION}"，实际为 ${JSON.stringify(r.schemaVersion)}`);
  }

  // R1 Schema 完整性：所有必填字段非空
  if (!r.meta || typeof r.meta !== 'object') {
    reasons.push('meta 字段缺失或非对象');
  } else {
    if (!isNonEmptyString(r.meta.reportId)) reasons.push('meta.reportId 必填且非空');
    if (r.meta.targetKind !== 'rootcause') reasons.push('meta.targetKind 必须为 "rootcause"');
    if (!isNonEmptyString(r.meta.targetArtifact)) reasons.push('meta.targetArtifact 必填且非空');
    if (!isNonEmptyString(r.meta.targetPhase)) reasons.push('meta.targetPhase 必填且非空');
    if (typeof r.meta.reworkRound !== 'number' || r.meta.reworkRound < 1) reasons.push('meta.reworkRound 必须为 ≥1 的整数');
    if (!['verifier', 'gate'].includes(r.meta.reworkSource ?? '')) reasons.push('meta.reworkSource 必须为 verifier|gate');
    if (!isNonEmptyString(r.meta.persona)) reasons.push('meta.persona 必填且非空');
    if (!['5-why', 'fishbone', 'defect-chain', 'upstream-trace', 'combined'].includes(r.meta.method ?? '')) {
      reasons.push('meta.method 必须为 5-why|fishbone|defect-chain|upstream-trace|combined');
    }
    if (!isIso8601(r.meta.analysisTimestamp)) reasons.push('meta.analysisTimestamp 必须为 ISO 8601');
  }

  if (!r.input || !Array.isArray(r.input.reworkHints) || r.input.reworkHints.length === 0) {
    reasons.push('input.reworkHints 必须为非空数组');
  }

  if (!r.phenomenon || typeof r.phenomenon !== 'object') {
    reasons.push('phenomenon 字段缺失或非对象');
  } else {
    if (!isNonEmptyString(r.phenomenon.summary)) reasons.push('phenomenon.summary 必填且非空');
    if (!['Critical', 'Required', 'Optional', 'Nit', 'FYI'].includes(r.phenomenon.severity ?? '')) {
      reasons.push('phenomenon.severity 必须为 Critical|Required|Optional|Nit|FYI');
    }
    if (!Array.isArray(r.phenomenon.affectedArtifacts) || r.phenomenon.affectedArtifacts.length === 0) {
      reasons.push('phenomenon.affectedArtifacts 必须为非空数组');
    }
  }

  // R2 rootCauseChain 长度 [2,5] + evidence 非空
  if (!Array.isArray(r.rootCauseChain) || r.rootCauseChain.length < MIN_CHAIN_LENGTH || r.rootCauseChain.length > MAX_CHAIN_LENGTH) {
    reasons.push(`rootCauseChain 长度必须在 [${MIN_CHAIN_LENGTH},${MAX_CHAIN_LENGTH}]，实际为 ${Array.isArray(r.rootCauseChain) ? r.rootCauseChain.length : '非数组'}`);
  } else {
    for (let i = 0; i < r.rootCauseChain.length; i++) {
      const step = r.rootCauseChain[i];
      if (!step || typeof step !== 'object') {
        reasons.push(`rootCauseChain[${i}] 非对象`);
        continue;
      }
      if (!isNonEmptyString(step.why)) reasons.push(`rootCauseChain[${i}].why 必填且非空`);
      if (!isNonEmptyString(step.answer)) reasons.push(`rootCauseChain[${i}].answer 必填且非空`);
      if (!isNonEmptyString(step.evidence)) reasons.push(`rootCauseChain[${i}].evidence 必填且非空`);
    }
  }

  // R1 rootCause 字段 + R3 falsifiabilityCheck 句式
  if (!r.rootCause || typeof r.rootCause !== 'object') {
    reasons.push('rootCause 字段缺失或非对象');
  } else {
    const validCategories: RootCauseCategory[] = ['requirement-gap', 'design-flaw', 'coding-error', 'test-gap', 'process-missing', 'tool-gap', 'upstream-defect'];
    if (!validCategories.includes(r.rootCause.category)) {
      reasons.push(`rootCause.category 必须为 ${validCategories.join('|')} 之一`);
    }
    if (!isNonEmptyString(r.rootCause.description)) reasons.push('rootCause.description 必填且非空');
    if (!isNonEmptyString(r.rootCause.evidence)) reasons.push('rootCause.evidence 必填且非空');
    if (!isNonEmptyString(r.rootCause.falsifiabilityCheck)) {
      reasons.push('rootCause.falsifiabilityCheck 必填且非空');
    } else if (!FALSIFIABILITY_PATTERN.test(r.rootCause.falsifiabilityCheck)) {
      reasons.push('rootCause.falsifiabilityCheck 必须含「若...则」句式（可证伪假设）');
    }
  }

  // R6 upstreamDefect.present=true 时后续字段非空
  if (!r.upstreamDefect || typeof r.upstreamDefect !== 'object') {
    reasons.push('upstreamDefect 字段缺失或非对象');
  } else if (r.upstreamDefect.present === true) {
    if (!isNonEmptyString(r.upstreamDefect.upstreamPhase)) reasons.push('upstreamDefect.present=true 时 upstreamPhase 必填且非空');
    if (!isNonEmptyString(r.upstreamDefect.upstreamArtifactId)) reasons.push('upstreamDefect.present=true 时 upstreamArtifactId 必填且非空');
    if (!isNonEmptyString(r.upstreamDefect.defectDescription)) reasons.push('upstreamDefect.present=true 时 defectDescription 必填且非空');
  }

  // R4 fixRecommendation 四字段
  if (!Array.isArray(r.fixRecommendation) || r.fixRecommendation.length === 0) {
    reasons.push('fixRecommendation 必须为非空数组');
  } else {
    for (let i = 0; i < r.fixRecommendation.length; i++) {
      const f = r.fixRecommendation[i];
      if (!f || typeof f !== 'object') {
        reasons.push(`fixRecommendation[${i}] 非对象`);
        continue;
      }
      if (!isNonEmptyString(f.target)) reasons.push(`fixRecommendation[${i}].target 必填且非空`);
      if (!isNonEmptyString(f.location)) reasons.push(`fixRecommendation[${i}].location 必填且非空`);
      if (!isNonEmptyString(f.action)) reasons.push(`fixRecommendation[${i}].action 必填且非空`);
      if (!isNonEmptyString(f.rationale)) reasons.push(`fixRecommendation[${i}].rationale 必填且非空`);
    }
  }

  // R5 prevention 三字段
  if (!Array.isArray(r.prevention) || r.prevention.length === 0) {
    reasons.push('prevention 必须为非空数组');
  } else {
    for (let i = 0; i < r.prevention.length; i++) {
      const p = r.prevention[i];
      if (!p || typeof p !== 'object') {
        reasons.push(`prevention[${i}] 非对象`);
        continue;
      }
      if (!isNonEmptyString(p.scope)) reasons.push(`prevention[${i}].scope 必填且非空`);
      if (!isNonEmptyString(p.measure)) reasons.push(`prevention[${i}].measure 必填且非空`);
      if (!isNonEmptyString(p.owner)) reasons.push(`prevention[${i}].owner 必填且非空`);
    }
  }

  // R7 qualityLevel 与 passed 一致
  const validLevels: QualityLevel[] = ['A', 'B', 'C', 'D'];
  if (!validLevels.includes(r.qualityLevel as QualityLevel)) {
    reasons.push(`qualityLevel 必须为 A|B|C|D，实际为 ${JSON.stringify(r.qualityLevel)}`);
  } else if (typeof r.passed !== 'boolean') {
    reasons.push('passed 必须为 boolean');
  } else {
    const expectedPassed = r.qualityLevel === 'A' || r.qualityLevel === 'B';
    if (r.passed !== expectedPassed) {
      reasons.push(`qualityLevel=${r.qualityLevel} 与 passed=${r.passed} 不一致（A/B→true，C/D→false）`);
    }
  }

  if (!isNonEmptyString(r.summary)) reasons.push('summary 必填且非空');

  // R8 reportId 格式
  if (r.meta && isNonEmptyString(r.meta.reportId) && !REPORT_ID_PATTERN.test(r.meta.reportId)) {
    reasons.push(`meta.reportId 格式必须为 ^RC-[a-z0-9]+-\\d+-\\d+$，实际为 ${r.meta.reportId}`);
  }

  // R9 多角度场景 partialReports 非空
  // R10 多角度场景 reality-checker confidence ≥ 0.5
  const isMultiPersona = r.meta?.method === 'combined';
  if (isMultiPersona) {
    if (!Array.isArray(r.partialReports) || r.partialReports.length === 0) {
      reasons.push('多角度场景（method=combined）partialReports 必须为非空数组');
    } else {
      const realityChecker = r.partialReports.find(p => p.personaSlice?.includes('reality-checker'));
      if (realityChecker && typeof realityChecker.confidence === 'number' && realityChecker.confidence < MIN_REALITY_CONFIDENCE) {
        reasons.push(`多角度场景 reality-checker persona confidence=${realityChecker.confidence} < ${MIN_REALITY_CONFIDENCE}（防幻想根因）`);
      }
    }
  }

  return { passed: reasons.length === 0, reasons };
}
