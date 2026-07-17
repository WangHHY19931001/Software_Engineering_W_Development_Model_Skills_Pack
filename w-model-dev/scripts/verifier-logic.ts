/**
 * Verifier 输出校验纯逻辑（Verifier Logic）—— 防止外部 Agent 评审输出漂移
 *
 * 对应 w-model-dev/references/verifier-spec.md §6 输出 Schema。
 *
 * 设计原则：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状，不 import src/，
 *      保证技能包（w-model-dev/）可独立分发给 TRAE / Claude 等 Agent。
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用。
 *   3. 单点事实：所有「Verifier 输出是否符合规范」的判定均委托至此。
 *
 * 调用方：
 *   - CLI 脚本 check-verifier-output.ts（供 Agent 直接执行）
 *   - src/ 编程式 API（若需要）
 *
 * 注意：本文件只校验外部 Agent 产出的 VerifierOutput JSON 结构与数值合理性，
 * 不包含任何 LLM 调用、演化机制或轨迹分析。技能演化由外部工具完成：
 *   - skillopt（微软 SkillOpt）  https://github.com/microsoft/SkillOpt
 *   - https://github.com/alchaincyf/darwin-skill
 */

// ==================== 自包含类型形状 ====================

export type TargetKind = 'requirement' | 'design' | 'testcase' | 'file';
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
    { name: 'completeness', weight: 0.30 },
    { name: 'clarity', weight: 0.25 },
    { name: 'consistency', weight: 0.20 },
    { name: 'testability', weight: 0.15 },
    { name: 'traceability', weight: 0.10 },
  ],
  design: [
    { name: 'architecture-soundness', weight: 0.25 },
    { name: 'requirement-coverage', weight: 0.25 },
    { name: 'interface-consistency', weight: 0.20 },
    { name: 'feasibility', weight: 0.15 },
    { name: 'testability', weight: 0.15 },
  ],
  testcase: [
    { name: 'coverage', weight: 0.30 },
    { name: 'correctness', weight: 0.25 },
    { name: 'independence', weight: 0.20 },
    { name: 'clarity', weight: 0.15 },
    { name: 'priority-reasonableness', weight: 0.10 },
  ],
  file: [
    { name: 'correctness', weight: 0.30 },
    { name: 'security', weight: 0.20 },
    { name: 'readability', weight: 0.15 },
    { name: 'maintainability', weight: 0.15 },
    { name: 'conformance', weight: 0.20 },
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
}

// ==================== 工具函数 ====================

const EPSILON = 1e-4;
const MIN_REPEAT_TIMES = 3;
const DEFAULT_VARIANCE_THRESHOLD = 0.10;
const SCHEMA_VERSION = '1.0';

function isNumber(x: unknown): x is number {
  return typeof x === 'number' && !Number.isNaN(x);
}

function inRange(x: number, lo: number, hi: number, inclusive = true): boolean {
  return inclusive ? x >= lo && x <= hi : x > lo && x < hi;
}

/**
 * 由综合分数映射质量等级（与 verifier-spec.md §6.1 一致）。
 */
export function determineQualityLevel(score: number): QualityLevel {
  if (score >= 0.85) return 'A';
  if (score >= 0.70) return 'B';
  if (score >= 0.50) return 'C';
  return 'D';
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
 *   5. 综合分数 = Σ(score * weight)，与输出 compositeScore 误差 ≤ EPSILON
 *   6. qualityLevel 与综合分数映射一致（§6.1）
 *   7. passed = (qualityLevel === A || B)
 *   8. passed=false 时 reworkHints 必须非空数组
 *   9. ranking（可选）字段类型合法
 */
export function checkVerifierOutput(
  raw: unknown,
): VerifierCheckResult {
  const reasons: string[] = [];

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
  const allowedKinds: TargetKind[] = ['requirement', 'design', 'testcase', 'file'];
  if (!allowedKinds.includes(targetKind as TargetKind)) {
    reasons.push(`meta.targetKind 必须为 ${allowedKinds.join(' / ')}，实际为 ${JSON.stringify(targetKind)}`);
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
  if (typeof meta.reviewedAt !== 'string' || meta.reviewedAt.trim() === '') {
    reasons.push('meta.reviewedAt 必须为非空 ISO 8601 字符串');
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

  const varianceThreshold = isNumber(meta.varianceThreshold)
    ? meta.varianceThreshold
    : DEFAULT_VARIANCE_THRESHOLD;
  if (!isNumber(meta.varianceThreshold)) {
    reasons.push(`meta.varianceThreshold 缺失或非数字，已按默认 ${DEFAULT_VARIANCE_THRESHOLD} 处理`);
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
    if (typeof sc.evidence !== 'string' || sc.evidence.trim() === '') {
      reasons.push(`subCriteria[${idx}].evidence 必须为非空字符串（引用目标内具体片段）`);
    }
  }

  // 子标准集合必须与 §7 定义完全匹配（名称 + 权重）
  for (let i = 0; i < expected.length; i++) {
    const exp = expected[i];
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
  const compositeScore = o.compositeScore;
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

  // 5. qualityLevel
  const qualityLevel = o.qualityLevel;
  const allowedLevels: QualityLevel[] = ['A', 'B', 'C', 'D'];
  if (!allowedLevels.includes(qualityLevel as QualityLevel)) {
    reasons.push(`qualityLevel 必须为 A/B/C/D，实际为 ${JSON.stringify(qualityLevel)}`);
  } else if (isNumber(compositeScore)) {
    const expectedLevel = determineQualityLevel(compositeScore);
    if (qualityLevel !== expectedLevel) {
      reasons.push(`qualityLevel ${qualityLevel} 与综合分数 ${compositeScore} 应映射为 ${expectedLevel}（§6.1）`);
    }
  }

  // 6. passed
  const passed = o.passed;
  const expectedPassed = qualityLevel === 'A' || qualityLevel === 'B';
  if (typeof passed !== 'boolean') {
    reasons.push(`passed 必须为布尔值，实际为 ${JSON.stringify(passed)}`);
  } else if (passed !== expectedPassed) {
    reasons.push(`passed ${passed} 与 qualityLevel ${qualityLevel} 不一致（应 = ${expectedPassed}）`);
  }

  // 7. summary
  if (typeof o.summary !== 'string' || o.summary.trim() === '') {
    reasons.push('summary 必须为非空字符串');
  }

  // 8. reworkHints
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

  // 9. ranking（可选）
  if (o.ranking !== undefined) {
    const r = o.ranking as Record<string, unknown>;
    if (!r || typeof r !== 'object') {
      reasons.push('ranking 必须为对象');
    } else {
      if (r.algorithm !== 'PPT') {
        reasons.push(`ranking.algorithm 必须为 "PPT"，实际为 ${JSON.stringify(r.algorithm)}`);
      }
      if (!isNumber(r.k) || r.k < 2) {
        reasons.push(`ranking.k 必须为 ≥2 的整数，实际为 ${JSON.stringify(r.k)}`);
      }
      if (!isNumber(r.temperature) || r.temperature <= 0) {
        reasons.push(`ranking.temperature 必须为正数，实际为 ${JSON.stringify(r.temperature)}`);
      }
      if (!isNumber(r.rounds) || r.rounds < 1) {
        reasons.push(`ranking.rounds 必须为 ≥1 的整数，实际为 ${JSON.stringify(r.rounds)}`);
      }
      if (!Array.isArray(r.ordered) || r.ordered.length < 2) {
        reasons.push('ranking.ordered 必须为长度 ≥2 的字符串数组');
      }
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
    compositeScore: isNumber(compositeScore) ? compositeScore : 0,
    expectedCompositeScore: expectedComposite,
    qualityLevel: typeof qualityLevel === 'string' ? qualityLevel : 'N/A',
  };
}
