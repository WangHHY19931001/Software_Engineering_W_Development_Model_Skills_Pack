/**
 * Verifier 输出校验纯逻辑（Verifier Logic）—— 防止外部 Agent 评审输出漂移
 *
 * 对应 w-model-dev/references/verifier-spec.md §6 输出 Schema。
 *
 * 设计原则：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状，不 import 外部模块，
 *      保证技能包（w-model-dev/）可独立分发给 TRAE / Claude 等 Agent。
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用。
 *   3. 单点事实：所有「Verifier 输出是否符合规范」的判定均委托至此。
 *
 * 调用方：
 *   - CLI 脚本 check-verifier-output.ts（供 Agent 直接执行）
 *
 * 注意：本文件只校验外部 Agent 产出的 VerifierOutput JSON 结构与数值合理性，
 * 不包含任何 LLM 调用、演化机制或轨迹分析。技能演化由外部工具完成：
 *   - skillopt（微软 SkillOpt）  https://github.com/microsoft/SkillOpt
 *   - https://github.com/alchaincyf/darwin-skill
 */

import { validateBySchema } from './schema-loader.js';

// ==================== 自包含类型形状 ====================

/**
 * P2.5 targetKind 枚举标准化：
 *   - 'requirement' : phase 1 需求规格
 *   - 'design'      : phase 2/3/4 系统/接口/详细设计
 *   - 'code'        : phase 5 源代码（原 'file' 已废弃）
 *   - 'test'        : phase 6/7/8 集成/系统/验收测试（原 'testcase' 已废弃）
 *   - 'rootcause'   : 返工循环 V 复审根因报告（§7.5 子标准集合，
 *                     与 verifier-spec §2.2 / §7.5、dispatch-matrix §4、反模式 #19 检测信号对齐）
 */
export type TargetKind = 'requirement' | 'design' | 'code' | 'test' | 'rootcause';
export type ScoringMethod = 'logits' | 'text-parse';
export type QualityLevel = 'A' | 'B' | 'C' | 'D';

export interface VerifierOutputShape {
  schemaVersion: string;
  meta: {
    targetKind: TargetKind;
    target: string;
    reviewedAt: string;
    agent: string;
    scoringMethod: ScoringMethod;
    repeatTimes: number;
    varianceThreshold: number;
  };
  subCriteria: Array<{
    name: string;
    description?: string;
    weight: number;
    score: number;
    rawScores: number[];
    variance: number;
    evidence: string;
  }>;
  compositeScore: number;
  qualityLevel: QualityLevel;
  summary: string;
  passed: boolean;
  reworkHints?: string[];
  ranking?: {
    algorithm: 'PPT';
    k: number;
    temperature: number;
    rounds: number;
    ordered: string[];
  };
}

// ==================== 子标准定义（与 verifier-spec.md §7 一致） ====================
//
// 刻意不依赖运行时配置，确保 Agent 不能在运行时偷换子标准集合。

export const SUB_CRITERIA: Record<TargetKind, Array<{ name: string; weight: number }>> = {
  requirement: [
    { name: 'completeness', weight: 0.3 },
    { name: 'clarity', weight: 0.25 },
    { name: 'consistency', weight: 0.2 },
    { name: 'testability', weight: 0.15 },
    { name: 'traceability', weight: 0.1 },
  ],
  design: [
    { name: 'architecture-soundness', weight: 0.25 },
    { name: 'requirement-coverage', weight: 0.25 },
    { name: 'interface-consistency', weight: 0.2 },
    { name: 'feasibility', weight: 0.15 },
    { name: 'testability', weight: 0.15 },
  ],
  test: [
    { name: 'coverage', weight: 0.3 },
    { name: 'correctness', weight: 0.25 },
    { name: 'independence', weight: 0.2 },
    { name: 'clarity', weight: 0.15 },
    { name: 'priority-reasonableness', weight: 0.1 },
  ],
  code: [
    { name: 'correctness', weight: 0.3 },
    { name: 'security', weight: 0.2 },
    { name: 'readability', weight: 0.15 },
    { name: 'maintainability', weight: 0.15 },
    { name: 'conformance', weight: 0.2 },
  ],
  // V 复审根因报告（verifier-spec §7.5）
  rootcause: [
    { name: 'correctness', weight: 0.25 },
    { name: 'completeness', weight: 0.25 },
    { name: 'falsifiability', weight: 0.2 },
    { name: 'actionability', weight: 0.15 },
    { name: 'prevention', weight: 0.15 },
  ],
};

// ==================== 校验结果 ====================

export interface VerifierCheckResult {
  passed: boolean;
  reasons: string[];
  /** 综合分数（直接读取自输出，不重算） */
  compositeScore: number;
  /** 重新计算的期望综合分数（用于与输出对比） */
  expectedCompositeScore: number;
  qualityLevel: string;
  /** 防漂移警告（非致命，不改变 passed），如 text-parse 扰动范围 < 0.01 */
  reworkHints?: string[];
}

// ==================== 工具函数 ====================

const EPSILON = 1e-4;
/** variance 字段与重算方差的允许误差（浮点比较；与 verifier-spec.md §3.2.1 规则 2 一致：1e-6） */
const VARIANCE_EPSILON = 1e-6;
const MIN_REPEAT_TIMES = 3;
const MAX_VARIANCE_THRESHOLD = 0.1;
const SCHEMA_VERSION = '1.0';

/** ranking 字段边界（spec §5.1 默认 k=5 / temperature=4.0，此处给出合理性上界防滥用） */
const MIN_RANKING_K = 2;
const MAX_RANKING_K = 1000;
const MIN_TEMPERATURE = 1e-6;
const MAX_TEMPERATURE = 100;
const MIN_RANKING_ROUNDS = 1;

/** R13 单轴下限：任一子标准得分低于此值 → passed=false。
 *  阈值 = qualityLevel B 级分界（§6.1），语义自洽：passed 原判据为「加权平均 ≥ B」，
 *  收紧为「每个子标准自身 ≥ B」。防止加权平均掩盖单轴失败（反模式 #41）。 */
const SINGLE_AXIS_MIN_SCORE = 0.7;

function isNumber(x: unknown): x is number {
  return typeof x === 'number' && !Number.isNaN(x);
}

function inRange(x: number, lo: number, hi: number, inclusive = true): boolean {
  return Number.isFinite(x) && (inclusive ? x >= lo && x <= hi : x > lo && x < hi);
}

/**
 * R12（sig-002）：subCriteria evidence 非空校验。
 * 防止 V 评审 evidence 字段空泛描述。每个子标准 evidence 须引用具体行号/文件路径。
 * 注：evidence 字段非空校验已在主循环 R4 实现，R12 增强为「引用具体片段」校验。
 */
export function checkR12EvidenceSpecificity(evidence: unknown, idx: number): string | null {
  if (typeof evidence !== 'string') return null; // 类型校验由 R4 负责
  const e = evidence.trim();
  if (e === '') return null; // 空校验由 R4 负责
  // R12：evidence 须含具体引用（行号/文件路径/章节号），禁止纯描述
  const hasSpecificRef = /(\.md|\.ts|\.json|§|L\d+|line|行|节|章|REQ-|SD-|DD-|INTF-|TC-|UAT-)/.test(e);
  if (!hasSpecificRef && e.length < 20) {
    return `subCriteria[${idx}].evidence "${e}" 缺具体引用（R12：须含行号/文件路径/章节号/ID，如「REQ-001 §3.2」「article.service.ts:L45」）`;
  }
  return null;
}

/**
 * R13 单轴下限校验（反模式 #41 加权平均掩盖单轴失败）。
 * 防止 compositeScore 加权平均 ≥0.70 放行时，存在子标准低于 B 级（<0.70）被其余高分掩盖。
 * 返回低于下限的子标准违规列表；空数组 = 全部子标准 ≥ 下限。
 */
export function checkR13SingleAxisFloor(subCriteria: Array<Record<string, unknown>> | unknown[]): string[] {
  if (!Array.isArray(subCriteria)) return [];
  const violations: string[] = [];
  for (let i = 0; i < subCriteria.length; i++) {
    const sc = subCriteria[i] as Record<string, unknown>;
    if (!sc || typeof sc !== 'object') continue;
    const name = typeof sc.name === 'string' && sc.name.trim() !== '' ? sc.name : `subCriteria[${i + 1}]`;
    if (typeof sc.score === 'number' && !Number.isNaN(sc.score)) {
      if (sc.score < SINGLE_AXIS_MIN_SCORE) {
        violations.push(`子标准 ${name} 得分 ${sc.score} < ${SINGLE_AXIS_MIN_SCORE}（单轴下限，反模式 #41）`);
      }
    }
  }
  return violations;
}

/**
 * 计算样本方差（总体方差，除以 N 而非 N-1）。
 * 用于防漂移校验：根据 rawScores 重算方差，与 variance 字段对比，
 * 防止 Agent 谎报低方差掩盖「单次评估复制 N 次」的作弊（§3.2.1 规则 5）。
 *
 * 边界保护（sig-009）：
 * - 输入空数组或单元素数组 → 返回 0（无方差可言）
 * - 输入含 NaN/Infinity → 返回 NaN（让上游 isNumber 校验拦截）
 * - 计算结果 NaN/Infinity → 返回 NaN（让上游 VARIANCE_EPSILON 比较拦截）
 */
function computeVariance(scores: number[]): number {
  if (scores.length < 2) return 0;
  // 边界保护：含 NaN/Infinity 的输入返回 NaN
  if (scores.some((v) => !Number.isFinite(v))) return Number.NaN;
  const mean = scores.reduce((sum, v) => sum + v, 0) / scores.length;
  const sumSqDiff = scores.reduce((sum, v) => sum + (v - mean) ** 2, 0);
  const variance = sumSqDiff / scores.length;
  // 边界保护：计算结果 NaN/Infinity 返回 NaN
  return Number.isFinite(variance) ? variance : Number.NaN;
}

/**
 * 由综合分数映射质量等级（与 verifier-spec.md §6.1 一致）。
 */
export function determineQualityLevel(score: number): QualityLevel {
  if (score >= 0.85) return 'A';
  if (score >= 0.7) return 'B';
  if (score >= 0.5) return 'C';
  return 'D';
}

// ==================== evidence 格式校验 ====================

/**
 * evidence 格式正则（format-conventions.md §2.1）：
 *   合法格式：path:§section=statement 或 path:L42=statement 或 path:L42-58=statement
 *   非法格式：path.field=value（点号，已废弃）/ 纯文件名无定位 / 空泛声明
 */
const EVIDENCE_PATTERN = /^(?:[\w/.-]+:§[\w.-]+|[\w/.-]+:L\d+(?:-\d+)?)=.+$/;
const VAGUE_EVIDENCE_PATTERNS = [
  /^(C\d+-C\d+\s*全通过)/,
  /^(质量良好|评审通过|校验通过|全部通过)/,
  /^(全\s*通过|已\s*通过|满\s*足)/,
];
export function validateEvidenceFormat(evidence: string[]): { valid: boolean; vagueItems: string[] } {
  const vagueItems: string[] = [];
  for (const item of evidence) {
    if (!EVIDENCE_PATTERN.test(item)) {
      vagueItems.push(item);
      continue;
    }
    for (const vaguePattern of VAGUE_EVIDENCE_PATTERNS) {
      if (vaguePattern.test(item)) {
        vagueItems.push(item);
        break;
      }
    }
  }
  return { valid: vagueItems.length === 0, vagueItems };
}

// ==================== 主校验函数 ====================

/**
 * 校验外部 Agent 产出的 VerifierOutput JSON 是否符合
 * verifier-spec.md §6 Schema 与各数值约束。
 *
 * 校验项：
 *   1. schemaVersion 必须为 "1.0"
 *   2. meta 字段齐全；targetKind / scoringMethod 取值合法；repeatTimes ≥ 3
 *   3. subCriteria 数组长度 ≥ 3，且与 §7 中 targetKind 对应子标准集合完全匹配
 *      （名称与权重均不得改动）
 *   4. 每个子标准：score ∈ [0,1]；rawScores.length = repeatTimes；variance ≤ 阈值；
 *      evidence 非空字符串
 *   5. 防漂移：根据 rawScores 重算方差，与 variance 字段误差 ≤ VARIANCE_EPSILON，
 *      防止 Agent 谎报低方差掩盖「单次评估复制 N 次」的作弊
 *   6. 综合分数 = Σ(score * weight)，与输出 compositeScore 误差 ≤ EPSILON
 *   7. 证据格式校验（O3 空泛声明→compositeScore -0.1，再判定 qualityLevel/passed）
 *   8. qualityLevel 与降级后综合分数映射一致（§6.1），evidence 扣分后重新判定
 *   9. passed = (qualityLevel === A || B) 且所有子标准得分 ≥ 0.70（R13 单轴下限）
 *  10. passed=false 时 reworkHints 必须非空数组
 *  11. ranking（可选）字段类型合法
 */
export function checkVerifierOutput(raw: unknown): VerifierCheckResult {
  // === Schema 前置校验 ===
  // 结构性约束（additionalProperties / required / type）由 schema 拦截，
  // 通过后才进入下方业务规则校验（数值合理性 / 防漂移 / 权重匹配等）。
  const schemaResult = validateBySchema('verifier-output', raw);
  if (!schemaResult.valid) {
    return {
      passed: false,
      reasons: schemaResult.errorMessages.map((m) => `[schema] ${m}`),
      compositeScore: 0,
      expectedCompositeScore: 0,
      qualityLevel: 'N/A',
    };
  }

  const reasons: string[] = [];
  const reworkHints: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      passed: false,
      reasons: ['输出不是合法 JSON 对象'],
      compositeScore: 0,
      expectedCompositeScore: 0,
      qualityLevel: 'N/A',
    };
  }

  const o = raw as Record<string, unknown>;

  // 1. schemaVersion
  if (o.schemaVersion !== SCHEMA_VERSION) {
    reasons.push(`schemaVersion 必须为 "${SCHEMA_VERSION}"，实际为 ${JSON.stringify(o.schemaVersion)}`);
  }

  // 2. meta
  const meta = o.meta as Record<string, unknown> | undefined;
  if (!meta || typeof meta !== 'object') {
    return {
      passed: false,
      reasons: ['meta 字段缺失或非对象'],
      compositeScore: 0,
      expectedCompositeScore: 0,
      qualityLevel: 'N/A',
    };
  }

  const targetKind = meta.targetKind as string;
  // P2.5 targetKind 枚举标准化：'testcase'/'file' 已废弃；'rootcause' 用于返工循环 V 复审根因报告（§7.5）
  const allowedKinds: TargetKind[] = ['requirement', 'design', 'code', 'test', 'rootcause'];
  if (!allowedKinds.includes(targetKind as TargetKind)) {
    reasons.push(
      `meta.targetKind 必须为 ${allowedKinds.join(' / ')}，实际为 ${JSON.stringify(targetKind)}（P2.5: 'testcase'/'file' 已废弃，分别用 'test'/'code'）`,
    );
    return {
      passed: false,
      reasons,
      compositeScore: 0,
      expectedCompositeScore: 0,
      qualityLevel: 'N/A',
    };
  }

  if (typeof meta.target !== 'string' || meta.target.trim() === '') {
    reasons.push('meta.target 必须为非空字符串');
  }
  if (typeof meta.agent !== 'string' || meta.agent.trim() === '') {
    reasons.push('meta.agent 必须为非空字符串');
  }

  const scoringMethod = meta.scoringMethod as string;
  if (!['logits', 'text-parse'].includes(scoringMethod)) {
    reasons.push(`meta.scoringMethod 必须为 logits / text-parse，实际为 ${JSON.stringify(scoringMethod)}`);
  }

  const repeatTimes = meta.repeatTimes;
  if (!isNumber(repeatTimes) || !Number.isInteger(repeatTimes) || repeatTimes < MIN_REPEAT_TIMES) {
    reasons.push(`meta.repeatTimes 必须为整数且 ≥ ${MIN_REPEAT_TIMES}，实际为 ${JSON.stringify(repeatTimes)}`);
  }

  const varianceThreshold = isNumber(meta.varianceThreshold) ? meta.varianceThreshold : Number.NaN;
  if (!inRange(varianceThreshold, 0, MAX_VARIANCE_THRESHOLD)) {
    reasons.push(
      `meta.varianceThreshold 必须在 [0,${MAX_VARIANCE_THRESHOLD}] 范围内，实际为 ${JSON.stringify(meta.varianceThreshold)}`,
    );
  }

  // 3. subCriteria
  const subCriteria = o.subCriteria;
  if (!Array.isArray(subCriteria) || subCriteria.length < 3) {
    reasons.push(`subCriteria 必须为数组且长度 ≥ 3，实际为 ${JSON.stringify(subCriteria)?.slice(0, 80)}`);
    return {
      passed: false,
      reasons,
      compositeScore: 0,
      expectedCompositeScore: 0,
      qualityLevel: 'N/A',
    };
  }

  const expected = SUB_CRITERIA[targetKind as TargetKind];
  if (subCriteria.length !== expected.length) {
    reasons.push(`targetKind=${targetKind} 应有 ${expected.length} 个子标准，实际 ${subCriteria.length} 个`);
  }

  // 子标准名称与权重逐一比对
  const actualNames: string[] = [];
  for (let i = 0; i < subCriteria.length; i++) {
    const sc = subCriteria[i] as Record<string, unknown>;
    const idx = i + 1;
    if (!sc || typeof sc !== 'object') {
      reasons.push(`subCriteria[${idx}] 非对象`);
      continue;
    }
    if (typeof sc.name !== 'string' || sc.name.trim() === '') {
      reasons.push(`subCriteria[${idx}].name 缺失或非字符串`);
    } else {
      actualNames.push(sc.name);
    }
    if (!isNumber(sc.weight) || !inRange(sc.weight, 0, 1)) {
      reasons.push(`subCriteria[${idx}].weight 必须在 [0,1]，实际为 ${JSON.stringify(sc.weight)}`);
    }
    if (!isNumber(sc.score) || !inRange(sc.score, 0, 1)) {
      reasons.push(`subCriteria[${idx}].score 必须在 [0,1]，实际为 ${JSON.stringify(sc.score)}`);
    }
    if (!Array.isArray(sc.rawScores)) {
      reasons.push(`subCriteria[${idx}].rawScores 必须为数组`);
    } else {
      if (isNumber(repeatTimes) && sc.rawScores.length !== repeatTimes) {
        reasons.push(`subCriteria[${idx}].rawScores 长度 ${sc.rawScores.length} ≠ meta.repeatTimes ${repeatTimes}`);
      }
      for (let j = 0; j < sc.rawScores.length; j++) {
        const v = sc.rawScores[j];
        if (!isNumber(v) || !inRange(v, 0, 1)) {
          reasons.push(`subCriteria[${idx}].rawScores[${j + 1}] 不在 [0,1]：${JSON.stringify(v)}`);
        }
      }
    }
    if (!isNumber(sc.variance) || sc.variance < 0) {
      reasons.push(`subCriteria[${idx}].variance 必须为非负数，实际为 ${JSON.stringify(sc.variance)}`);
    } else if (sc.variance > varianceThreshold) {
      reasons.push(`subCriteria[${idx}].variance ${sc.variance} > 阈值 ${varianceThreshold}（不可重复，需重评）`);
    }

    // 防漂移规则 5（§3.2.1）：重算 rawScores 方差并与 variance 字段对比。
    // 防止 Agent 谎报低方差以掩盖「实际只评估 1 次、复制 N 次」的作弊。
    // 边界保护（sig-009）：computeVariance 对 NaN/Infinity 返回 NaN，
    //   Math.abs(NaN - x) = NaN > VARIANCE_EPSILON 为 false，不会误报；
    //   上游 isNumber(sc.variance) 已过滤非数字 variance 字段。
    if (Array.isArray(sc.rawScores) && sc.rawScores.length >= 2 && isNumber(sc.variance)) {
      const numericScores = sc.rawScores.filter(isNumber) as number[];
      if (numericScores.length === sc.rawScores.length && numericScores.length >= 2 && isNumber(sc.variance)) {
        const recomputed = computeVariance(numericScores);
        if (Number.isFinite(recomputed) && Math.abs(recomputed - sc.variance) > VARIANCE_EPSILON) {
          reasons.push(
            `subCriteria[${idx}].variance ${sc.variance} ≠ 由 rawScores 重算的方差 ${recomputed.toFixed(6)}（误差 > ${VARIANCE_EPSILON}，疑似谎报方差）`,
          );
        }
      }
    }
    // 防漂移规则 1（§3.2.1）：rawScores 全同 = 复制填入作弊（D31）。
    // 两种模式均执行：spec §3.2.1 规则 4 明确 logits 模式仅豁免规则 3（扰动范围），
    // 规则 1 / 2 仍对 logits 模式生效。
    const dimName = typeof sc.name === 'string' && sc.name.trim() !== '' ? sc.name : `subCriteria[${idx}]`;
    if (Array.isArray(sc.rawScores) && sc.rawScores.length > 1) {
      const numericScores = sc.rawScores.filter(isNumber) as number[];
      if (numericScores.length === sc.rawScores.length && numericScores.every((v) => v === numericScores[0])) {
        reasons.push(`维度 ${dimName} 的 rawScores 全同 [${numericScores.join(',')}], 疑似手工填写`);
      }
    }

    // P3.10 rawScores 完美等差数列（公差 0.01）检测。
    // 仅 text-parse 模式执行：text-parse 来源于文本解析，不应形成完美等差数列；
    // logits 模式天然可能产生等差分布（如 [0.89,0.90,0.91]），故豁免。
    if (scoringMethod === 'text-parse' && Array.isArray(sc.rawScores) && sc.rawScores.length >= 3) {
      const numericScores = sc.rawScores.filter(isNumber) as number[];
      if (numericScores.length === sc.rawScores.length) {
        const sorted = [...numericScores].sort((a, b) => a - b);
        const diff = sorted[1]! - sorted[0]!;
        let isArithmetic = diff > 0;
        for (let k = 2; k < sorted.length; k++) {
          const curDiff = sorted[k]! - sorted[k - 1]!;
          if (Math.abs(curDiff - diff) > 1e-9) {
            isArithmetic = false;
            break;
          }
        }
        if (isArithmetic && Math.abs(diff - 0.01) < 1e-9) {
          reasons.push(
            `维度 ${dimName} 的 rawScores 为完美等差数列 [${numericScores.join(',')}]（公差 0.01），疑似构造数据`,
          );
        }
      }
    }

    // 防漂移规则 3（§3.2.1）：text-parse ±0.05 扰动范围须 ∈ [0.01, 0.10]。
    // > 0.10 → fail（reasons）；< 0.01 → 警告（reworkHints）。logits 模式豁免（规则 4）。
    if (scoringMethod === 'text-parse' && Array.isArray(sc.rawScores) && sc.rawScores.length > 1) {
      const numericScores = sc.rawScores.filter(isNumber) as number[];
      if (numericScores.length === sc.rawScores.length) {
        const spread = Math.max(...numericScores) - Math.min(...numericScores);
        if (spread > 0.1) {
          reasons.push(`维度 ${dimName} 的 rawScores 扰动范围 ${spread.toFixed(4)} > 0.10, 扰动越界`);
        } else if (spread < 0.01) {
          reworkHints.push(`维度 ${dimName} 的 rawScores 扰动范围 ${spread.toFixed(4)} < 0.01, 疑似未扰动`);
        }
      }
    }

    if (typeof sc.evidence !== 'string' || sc.evidence.trim() === '') {
      reasons.push(`subCriteria[${idx}].evidence 必须为非空字符串（引用目标内具体片段）`);
    } else {
      // R12（sig-002）：evidence 须含具体引用，禁止纯描述
      const r12 = checkR12EvidenceSpecificity(sc.evidence, idx);
      if (r12) reasons.push(r12);
    }
  }

  // 子标准集合必须与 §7 定义完全匹配（名称 + 权重）
  for (let i = 0; i < expected.length; i++) {
    const exp = expected[i];
    if (!exp) continue;
    const act = subCriteria[i] as Record<string, unknown> | undefined;
    if (!act) continue;
    if (act.name !== exp.name) {
      reasons.push(`subCriteria[${i + 1}].name 应为 "${exp.name}"，实际为 ${JSON.stringify(act.name)}`);
    }
    if (isNumber(act.weight) && Math.abs(act.weight - exp.weight) > EPSILON) {
      reasons.push(`subCriteria[${i + 1}].weight 应为 ${exp.weight}，实际为 ${act.weight}（权重不得改动）`);
    }
  }

  // 4. 综合分数
  let compositeScore = o.compositeScore;
  let expectedComposite = 0;
  for (const sc of subCriteria as Array<Record<string, unknown>>) {
    if (isNumber(sc.score) && isNumber(sc.weight)) {
      expectedComposite += sc.score * sc.weight;
    }
  }
  expectedComposite = Math.round(expectedComposite * 1e4) / 1e4;

  if (!isNumber(compositeScore) || !inRange(compositeScore, 0, 1)) {
    reasons.push(`compositeScore 必须在 [0,1]，实际为 ${JSON.stringify(compositeScore)}`);
  } else if (Math.abs(compositeScore - expectedComposite) > EPSILON) {
    reasons.push(`compositeScore ${compositeScore} ≠ Σ(score*weight) ${expectedComposite}（误差 > ${EPSILON}）`);
  }

  // 5. evidence 格式校验（先于 qualityLevel/passed 判定，evidence 扣分后重新判定两者）
  const evidenceList = (subCriteria as Array<Record<string, unknown>>)
    .map((sc) => sc.evidence)
    .filter((e): e is string => typeof e === 'string');
  let evidenceDeduction = false;
  if (evidenceList.length > 0) {
    const evidenceResult = validateEvidenceFormat(evidenceList);
    if (!evidenceResult.valid) {
      if (isNumber(compositeScore)) {
        compositeScore = Math.max(0, compositeScore - 0.1);
      }
      evidenceDeduction = true;
      reasons.push(`evidence 格式校验失败（空泛声明，O3 命中）：${evidenceResult.vagueItems.join('; ')}`);
    }
  }

  // 6. qualityLevel — 基于证据扣分后的 compositeScore 重新判定
  let qualityLevel = o.qualityLevel;
  const allowedLevels: QualityLevel[] = ['A', 'B', 'C', 'D'];
  if (!allowedLevels.includes(qualityLevel as QualityLevel)) {
    reasons.push(`qualityLevel 必须为 A/B/C/D，实际为 ${JSON.stringify(qualityLevel)}`);
  } else if (isNumber(compositeScore)) {
    const expectedLevel = determineQualityLevel(compositeScore);
    if (qualityLevel !== expectedLevel) {
      reasons.push(`qualityLevel ${qualityLevel} 与综合分数 ${compositeScore} 应映射为 ${expectedLevel}（§6.1）`);
    }
  }
  // evidence 扣分后，qualityLevel 重新判定（覆盖可能的 text-parse 降级）
  if (evidenceDeduction && isNumber(compositeScore)) {
    qualityLevel = determineQualityLevel(compositeScore);
  }

  // 7. passed
  // R13：单轴下限。qualityLevel 由证据扣分后的 compositeScore 映射（§6.1），
  // passed 判定收紧为「加权平均 ≥ B 且每个子标准得分 ≥ 0.70（B 级分界）」。
  // 防止加权平均掩盖单轴失败（反模式 #41）。
  const passed = o.passed;
  const singleAxisViolations = checkR13SingleAxisFloor(subCriteria);
  const expectedPassed = (qualityLevel === 'A' || qualityLevel === 'B') && singleAxisViolations.length === 0;
  if (typeof passed !== 'boolean') {
    reasons.push(`passed 必须为布尔值，实际为 ${JSON.stringify(passed)}`);
  } else if (passed !== expectedPassed) {
    reasons.push(`passed ${passed} 与 qualityLevel ${qualityLevel} 不一致（应 = ${expectedPassed}）`);
  }
  reasons.push(...singleAxisViolations);

  // 8. summary（R1 非空）
  if (typeof o.summary !== 'string' || o.summary.trim() === '') {
    reasons.push('summary 必须为非空字符串');
  }

  // 9. reworkHints
  if (expectedPassed === false) {
    if (!Array.isArray(o.reworkHints) || o.reworkHints.length === 0) {
      reasons.push('passed=false 时 reworkHints 必须为非空数组');
    } else {
      for (let i = 0; i < o.reworkHints.length; i++) {
        const h = o.reworkHints[i];
        if (typeof h !== 'string' || h.trim() === '') {
          reasons.push(`reworkHints[${i + 1}] 必须为非空字符串`);
        }
      }
    }
  }

  // 10. ranking（可选）
  if (o.ranking !== undefined) {
    const r = o.ranking as Record<string, unknown>;
    if (!r || typeof r !== 'object') {
      reasons.push('ranking 必须为对象');
    } else {
      if (r.algorithm !== 'PPT') {
        reasons.push(`ranking.algorithm 必须为 "PPT"，实际为 ${JSON.stringify(r.algorithm)}`);
      }
      if (!isNumber(r.k) || !Number.isInteger(r.k) || r.k < MIN_RANKING_K || r.k > MAX_RANKING_K) {
        reasons.push(`ranking.k 必须为整数且 ∈ [${MIN_RANKING_K}, ${MAX_RANKING_K}]，实际为 ${JSON.stringify(r.k)}`);
      }
      if (!isNumber(r.temperature) || r.temperature <= MIN_TEMPERATURE || r.temperature > MAX_TEMPERATURE) {
        reasons.push(
          `ranking.temperature 必须为正数且 ≤ ${MAX_TEMPERATURE}（过大 sigmoid 失去区分度），实际为 ${JSON.stringify(r.temperature)}`,
        );
      }
      if (!isNumber(r.rounds) || !Number.isInteger(r.rounds) || r.rounds < MIN_RANKING_ROUNDS) {
        reasons.push(`ranking.rounds 必须为 ≥${MIN_RANKING_ROUNDS} 的整数，实际为 ${JSON.stringify(r.rounds)}`);
      }
      if (!Array.isArray(r.ordered) || r.ordered.length < 2) {
        reasons.push('ranking.ordered 必须为长度 ≥2 的字符串数组');
      } else {
        const ordered = r.ordered as unknown[];
        if (ordered.some((item) => typeof item !== 'string' || item.trim() === '')) {
          reasons.push('ranking.ordered 的每项必须为非空字符串');
        }
        const unique = new Set(ordered.filter((item): item is string => typeof item === 'string'));
        if (unique.size !== ordered.length) {
          reasons.push('ranking.ordered 不得包含重复候选项');
        }
        if (isNumber(r.k) && Number.isInteger(r.k) && r.k > ordered.length) {
          reasons.push(`ranking.k ${r.k} 不得大于候选项数量 ${ordered.length}`);
        }
      }
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
    reworkHints,
    compositeScore: isNumber(compositeScore) ? compositeScore : 0,
    expectedCompositeScore: expectedComposite,
    qualityLevel: typeof qualityLevel === 'string' ? qualityLevel : 'N/A',
  };
}
