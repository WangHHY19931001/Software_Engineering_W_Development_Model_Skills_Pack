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

import { validateBySchema } from '../infrastructure/schema-loader.js';
import type { StructuredViolation } from '../lib/types.js';

// ==================== 自包含类型形状 ====================

/**
 * P2.5 targetKind 枚举标准化：
 *   - 'requirement' : phase 1 需求规格
 *   - 'design'      : phase 2/3/4 系统/接口/详细设计
 *   - 'code'        : phase 5 源代码（原 'file' 已废弃）
 *   - 'test'        : phase 6/7/8 集成/系统/验收测试（原 'testcase' 已废弃）
 *   - 'rootcause'   : 返工循环 V 复审根因报告（§7.5 子标准集合，
 *                     与 verifier-spec §2.2 / §7.5、subagent-delegation.md（dispatch-matrix 节）§4、反模式 #19 检测信号对齐）
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
  /** 批次3 任务8：结构化双轨（rule/subject/fixHints），与 reasons 同源单点派生、恒一一对应；
   *  message 逐字保留 reasons 原文（既有消费者兼容）。类型保持可选（照任务 2 JsonReport 键 /
   *  GateCheckResult 既有形态），但本函数全部 6 个结果构造点均填充（运行时恒在场）。 */
  structuredViolations?: StructuredViolation[];
  /** 综合分数（直接读取自输出，不重算） */
  compositeScore: number;
  /** 重新计算的期望综合分数（用于与输出对比） */
  expectedCompositeScore: number;
  qualityLevel: string;
  /** 防漂移警告（非致命，不改变 passed），如 text-parse 扰动范围 < 0.01 */
  reworkHints?: string[];
}

// ==================== 结构化双轨（批次3 任务8：rule/subject/fixHints） ====================

/** VERIFIER-* 结构化规则 ID（键集合 = VERIFIER_FIX_HINTS 常量表） */
export type VerifierRuleId =
  'VERIFIER-SCHEMA' | 'VERIFIER-SCORE' | 'VERIFIER-VARIANCE' | 'VERIFIER-EVIDENCE' | 'VERIFIER-STRUCTURE';

/**
 * 修复建议常量表（批次3 任务8）：structuredViolations[].fixHints 的单一事实来源，
 * 取值逐字来自批次3 任务8 简报；`?? []` 归一（照任务 5/7 常量表先例）。
 * rule 分派口径（与各违规现场一一对应，subject 一律字段路径）：
 *   VERIFIER-SCHEMA    —— 值域/类型/枚举/边界违规（schema 前置拦截 + 业务层加严边界）
 *   VERIFIER-SCORE     —— 分数一致性（compositeScore ≠ Σ、qualityLevel 映射、R13 单轴下限）
 *   VERIFIER-VARIANCE  —— 方差/分布（超阈值、谎报方差、全同、完美等差、扰动越界、R18 分辨力）
 *   VERIFIER-EVIDENCE  —— evidence 内容（R12 具体引用、格式不符、空泛声明）
 *   VERIFIER-STRUCTURE —— 字段缺失/结构形态/一致性（passed、reworkHints、ranking 数组、summary）
 */
const VERIFIER_FIX_HINTS: Record<string, string[]> = {
  'VERIFIER-SCHEMA': ['按 verifier-output schema 修正 schemaVersion 与必填字段'],
  'VERIFIER-SCORE': ['对低于 0.70 的子标准补 evidence 定位后重评，不得改分数'],
  'VERIFIER-VARIANCE': ['方差超阈值属不可重复评审：换 Persona/新上下文重评'],
  'VERIFIER-EVIDENCE': ['evidence 补 <路径>:<定位>=<值> 形态；禁裸声明'],
  'VERIFIER-STRUCTURE': ['补齐缺失字段后重新提交'],
};

/**
 * 双轨单点派生工厂（批次3 任务8）：message 逐字保留 reasons 原文（既有消费者兼容），
 * classification 恒 'semantic'，fixHints 取常量表 + `?? []` 归一。
 */
function makeStructured(rule: VerifierRuleId, subject: string, message: string): StructuredViolation {
  return {
    rule,
    message,
    classification: 'semantic',
    subject,
    // eslint-disable-next-line security/detect-object-injection -- rule 参数为 VerifierRuleId 五值封闭联合（键集合 = VERIFIER_FIX_HINTS 常量表自身），非外部输入
    fixHints: VERIFIER_FIX_HINTS[rule] ?? [],
  };
}

/**
 * C16：Ajv 错误对象的 subject 提取（结构化字段优先，防文案正则随 Ajv 升级失效）。
 *   - 优先消费 `instancePath`（JSON pointer → 点号字段路径，如 `/meta/reviewedAt` → `meta.reviewedAt`）；
 *   - required 错误的字段名在 `params.missingProperty`，与父级 instancePath 拼接
 *     （`/meta` + `agent` → `meta.agent`，比文案正则只能取到父路径更精确）；
 *   - 根级（instancePath 为 `''`/`'/'`）无字段路径 → 返回 undefined，由调用方回退文案正则
 *     （既有「根级 → schema」钉死语义不变；且文案正则对根级消息解析失败时同样兜底 'schema'，
 *     故 Ajv 升级改变文案形态不影响 subject 提取）。
 * 纯函数、无 I/O；导出供单元测试以合成错误对象直接驱动。
 */
export function ajvErrorSubject(
  err: { instancePath?: string; params?: { missingProperty?: string } } | null | undefined,
): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const rawPath = typeof err.instancePath === 'string' ? err.instancePath : '';
  if (rawPath === '' || rawPath === '/') return undefined; // 根级：交由文案正则回退（→ 'schema'）
  const missing = typeof err.params?.missingProperty === 'string' ? err.params.missingProperty : '';
  const pointer = missing !== '' ? `${rawPath}/${missing}` : rawPath;
  return pointer.replace(/^\/+/, '').replace(/\/+/g, '.');
}

/**
 * schema 前置拦截的 subject 提取：ajv 格式化消息形如 `/meta/repeatTimes: must be integer [type]`
 * （formatAjvError：instancePath 为空时为 `/`）。提取 JSON-pointer 字段路径并转点号形态，
 * 与业务层 subject 的 `subCriteria[N].field` 形态对齐；根级/无路径 → 'schema'。
 * C16：优先消费 Ajv 错误对象的结构化字段（ajvErrorSubject），undefined 再走现有文案正则回退
 * ——errorMessages 与 errors 由 schema-loader 1:1 map(formatAjvError) 派生，按下标 zip 安全。
 */
function schemaErrorSubject(
  message: string,
  err?: { instancePath?: string; params?: { missingProperty?: string } } | null,
): string {
  const structured = ajvErrorSubject(err);
  if (structured !== undefined) return structured;
  const m = /^\/([^:]*):/.exec(message);
  const pointer = m?.[1] ?? '';
  return pointer === '' ? 'schema' : pointer.replace(/\//g, '.');
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

/**
 * R18 分辨力下限：`rawScores` 方差低于此值（且非全等）→ 疑似 V 分辨力坍缩（D19）。
 *
 * **取值依据（实测，非设计期估算）**：对仓库 `samples/verifier/` 全部含 `subCriteria`
 * 的 fixture 逐一重算方差，合法产物的实测方差一律为 **6.67e-5**（如 persona×4、
 * `valid.json`、`valid-rootcause.json`）。计划书原先预定的 `1e-4` **高于**该值，
 * 会导致 100% 的合法 V 产物被误判红——这是"计划代码片段只是意图草图"的实例。
 * 现取 `1e-6`：比全部合法产物低 67 倍，比"分布坍缩"形态（`[0.9001, 0.9002, 0.9000]`
 * → 方差 6.67e-9）高 667 倍，两侧各留约两个数量级的余量。
 *
 * **仍为先行取值，端到端调测后校准**（规格 D23 / 任务 16 步骤 2）：仓库内无真实
 * 历史评审可回测（`.w-model/` 为 gitignored 本地生成物）。
 */
export const RESOLUTION_FLOOR = 1e-6;

/** R18 所需最少数据点：少于 3 个不足以判定分布坍缩 */
export const RESOLUTION_MIN_POINTS = 3;
/** Only the verifier-spec's explicit Critical/Required prefixes block an otherwise valid review. */
const BLOCKING_REWORK_HINT_PATTERN = /^\s*(?:\[(Critical|Required)\]|(Critical|Required):)/i;

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
/**
 * R12 具体引用的结构化判据（模块级常量，便于测试与复用）：
 *   文件路径（带扩展名，可选 `:L45`/`:45` 行号）| §章节号 | 第 N[章节行] | L 级（L1-L4）| 仓库 ID 编号前缀
 * 刻意**不含**裸「行」「节」「章」——见 checkR12EvidenceSpecificity 的判据演进注释。
 * C11（Windows 路径）同构扩展：扩展名分支对路径分隔符不敏感（`src\mod\a.ts` 中的 `.ts`
 * 照常命中），另补 **盘符前缀分支** `\b[A-Za-z]:[\\/]`——`D:\proj\notes:L5=…` 这类无已登记
 * 扩展名的 Windows 绝对路径也是具体文件引用（无内部量词，star height 0）。
 */
const R12_SPECIFIC_REF_PATTERN =
  // 判据只需「出现具体引用」，故每个分支都以**字面锚点**起始（`.` + 已知扩展名 / `§` / `第` / `L` / `line` / ID 前缀 / 盘符前缀），
  // 且**不含「含量词的组再被量化」形态**（star height ≤1；`(?::L?\d+)?` 这类写法虽线性也会被
  // security/detect-unsafe-regex 判为不安全，且对判据无贡献——`:L45` 前置必然已有 `.ts` 扩展名）。
  /(?:\.(?:md|ts|tsx|js|jsx|mjs|cjs|json|ya?ml|py|java|go|rs|rb|php|sql|tla|cfg|feature|html|css|sh|txt|log|csv|xml|toml|ini)|§\s*[\d.]+|第\s*[\d.]+\s*[章节行]|\bL\d\b|\bline\s*\d+|\b(?:REQ|SD|DD|INTF|TC|UAT|RC|PUB|M|F|R)-\d+|\b[A-Za-z]:[\\/])/;

export function checkR12EvidenceSpecificity(evidence: unknown, idx: number): string | null {
  if (typeof evidence !== 'string') return null; // 类型校验由 R4 负责
  const e = evidence.trim();
  if (e === '') return null; // 空校验由 R4 负责
  // R12：evidence 须含**结构化**具体引用（文件路径+可选行号 / §章节 / L 级 / 第 N 章节行 / 仓库 ID 编号）。
  // 判据演进（2026-09-17 审查修复，两处都曾放行）：
  //   ① 原判据 `!hasSpecificRef && e.length < 20` → 「长而无引用」被放行；
  //   ② 修 ① 后暴露裸词根误判：正则含裸「行」「节」「章」，使「执行」「细节」「文章」被当成引用。
  // 故改为结构化形态匹配，不再接受裸词根。
  const hasSpecificRef = R12_SPECIFIC_REF_PATTERN.test(e);
  if (!hasSpecificRef) {
    return `subCriteria[${idx}].evidence "${e}" 缺具体引用（R12：须含行号/文件路径/章节号/ID，如「REQ-001 §3.2」「article.service.ts:L45」）`;
  }
  return null;
}

/**
 * R13 单轴下限校验（反模式 #41 加权平均掩盖单轴失败）。
 * 防止 compositeScore 加权平均 ≥0.70 放行时，存在子标准低于 B 级（<0.70）被其余高分掩盖。
 * 返回低于下限的子标准违规列表；空数组 = 全部子标准 ≥ 下限。
 *
 * 批次3 任务8：reasons/structured 双轨收集收敛于 collectR13SingleAxisFloor 单点，
 * 本导出函数为兼容签名（string[]）的薄包装。
 */
export function checkR13SingleAxisFloor(subCriteria: Array<Record<string, unknown>> | unknown[]): string[] {
  return collectR13SingleAxisFloor(subCriteria).reasons;
}

/** 双轨同源收集结果（批次3 任务8）：reasons 与 structured 恒一一对应 */
interface DualTrackViolations {
  reasons: string[];
  structured: StructuredViolation[];
}

/** R13 单轴下限的双轨收集（批次3 任务8）：单点派生，导出 wrapper 只取 reasons 轨。 */
function collectR13SingleAxisFloor(subCriteria: Array<Record<string, unknown>> | unknown[]): DualTrackViolations {
  const reasons: string[] = [];
  const structured: StructuredViolation[] = [];
  if (!Array.isArray(subCriteria)) return { reasons, structured };
  for (let i = 0; i < subCriteria.length; i++) {
    const sc = subCriteria[i] as Record<string, unknown>;
    if (!sc || typeof sc !== 'object') continue;
    const name = typeof sc.name === 'string' && sc.name.trim() !== '' ? sc.name : `subCriteria[${i + 1}]`;
    if (typeof sc.score === 'number' && !Number.isNaN(sc.score)) {
      if (sc.score < SINGLE_AXIS_MIN_SCORE) {
        const msg = `子标准 ${name} 得分 ${sc.score} < ${SINGLE_AXIS_MIN_SCORE}（单轴下限，反模式 #41）`;
        reasons.push(msg);
        structured.push(makeStructured('VERIFIER-SCORE', `subCriteria[${i + 1}].score`, msg));
      }
    } else {
      // 非数值 score 不得静默跳过：无法参与下限判定的子标准必须显式暴露
      const msg = `子标准 ${name} 的 score 非有限数值（实际 ${JSON.stringify(sc.score)}），无法参与单轴下限校验`;
      reasons.push(msg);
      structured.push(makeStructured('VERIFIER-STRUCTURE', `subCriteria[${i + 1}].score`, msg));
    }
  }
  return { reasons, structured };
}

/**
 * R18 分辨力下限（A-3d 校准偏移，D19）。
 *
 * **与既有"全等检测"的区别**（刻意不重复）：主循环的防漂移规则 1 检 `max === min`
 * （完全相等的 rawScores = 复制填入作弊）；本判据检**非全等但方差极小**——
 * 评分分布坍缩，V 实际上没有区分正负样本的能力。两者互补：全等是"没打分"，
 * 方差坍缩是"打了分但没分辨力"。故 `max === min` 时本判据**跳过**，避免重复报。
 *
 * 论文依据（arXiv:2607.05391）：粒度上升 → 正负样本分离 SNR 上升（Table 1：`G=1 → 0.775`、
 * `G=20 → 0.799`）；标准 judge 在 100 次重复中 **88 次产生平局**——分辨力不足是真实
 * 且可测量的失效模式，不是理论担忧。
 *
 * 阈值 RESOLUTION_FLOOR 为**先行取值**，端到端调测后校准（规格 D23 / 任务 16 步骤 2）；
 * 仓库内无真实历史评审可回测（`.w-model/` 为 gitignored 本地生成物）。
 * 取值保守（显著低于正常评分离散度）以避免假阳性。
 *
 * 纯函数、无 I/O；与 R13 同形态，便于独立定位与测试。
 * 返回违规列表；空数组 = 无分辨力塌缩信号。
 *
 * 批次3 任务8：reasons/structured 双轨收集收敛于 collectR18ResolutionFloor 单点，
 * 本导出函数为兼容签名（string[]）的薄包装。
 */
export function checkR18ResolutionFloor(subCriteria: Array<Record<string, unknown>> | unknown[]): string[] {
  return collectR18ResolutionFloor(subCriteria).reasons;
}

/** R18 分辨力下限的双轨收集（批次3 任务8）：单点派生，导出 wrapper 只取 reasons 轨。 */
function collectR18ResolutionFloor(subCriteria: Array<Record<string, unknown>> | unknown[]): DualTrackViolations {
  const reasons: string[] = [];
  const structured: StructuredViolation[] = [];
  if (!Array.isArray(subCriteria)) return { reasons, structured };
  for (let i = 0; i < subCriteria.length; i++) {
    const sc = subCriteria[i] as Record<string, unknown>;
    if (!sc || typeof sc !== 'object') continue;
    if (!Array.isArray(sc.rawScores)) continue;
    const nums = (sc.rawScores as unknown[]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    // 少于 3 个数据点不足以判定分布坍缩（也低于 MIN_REPEAT_TIMES 语义）
    if (nums.length < RESOLUTION_MIN_POINTS) continue;
    const max = Math.max(...nums);
    const min = Math.min(...nums);
    // 全等由既有防漂移规则 1 覆盖，此处跳过以免重复报
    if (max === min) continue;
    const variance = computeVariance(nums);
    if (!Number.isFinite(variance)) continue;
    if (variance < RESOLUTION_FLOOR) {
      const name = typeof sc.name === 'string' && sc.name.trim() !== '' ? sc.name : `subCriteria[${i + 1}]`;
      const msg = `R18 子标准 ${name} 的 rawScores 方差 ${variance} < 分辨力下限 ${RESOLUTION_FLOOR}（非全等但分布坍缩，疑似 V 无区分能力）`;
      reasons.push(msg);
      structured.push(makeStructured('VERIFIER-VARIANCE', `subCriteria[${i + 1}].rawScores`, msg));
    }
  }
  return { reasons, structured };
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
 * evidence 格式正则（conventions.md「格式约定」§2.1）：
 *   合法格式：path:§section=statement 或 path:L42=statement 或 path:L42-58=statement
 *   非法格式：path.field=value（点号，已废弃）/ 纯文件名无定位 / 双 L 区间 `path:L51-L53=statement`
 *     （行号区间须写 `path:L51-53=statement`，单 L 形态）/ 空泛声明
 *   C11（Windows 路径）：路径段字符集补反斜杠 `[\w/.\-\\]`，路径首允许盘符前缀
 *     `(?:[A-Za-z]:)?`——`src\utils\a.ts:L12=…` 与 `D:\proj\x.ts:L1-5=…` 均为合法形态。
 *     回溯安全：盘符组为无内部量词的字面二字符（star height 1），路径段为单字符类一次
 *     量化（无「含量词的组再被量化」形态），双 L 区间仍被 `=` 锚点拒绝（`-L53` 不匹配 `-\d+`）。
 */
const EVIDENCE_PATTERN = /^(?:(?:[A-Za-z]:)?[\w/.\-\\]+:§[\w.-]+|(?:[A-Za-z]:)?[\w/.\-\\]+:L\d+(?:-\d+)?)=.+$/;
const VAGUE_EVIDENCE_PATTERNS = [
  /^(C\d+-C\d+\s*全通过)/,
  /^(质量良好|评审通过|校验通过|全部通过)/,
  /^(全\s*通过|已\s*通过|满\s*足)/,
];
export function validateEvidenceFormat(evidence: string[]): {
  valid: boolean;
  vagueItems: string[];
  formatMismatchItems: string[];
} {
  const vagueItems: string[] = [];
  // D-10①：失败分两路可归因——正则不匹配（格式不符：缺 `path:Lnn=` / `path:§sec=` 定位，
  // 或双 L 区间 `path:L51-L53=` 这类非规范形态）与匹配后命中空泛前缀（空泛声明）。
  // vagueItems 保持「全部不合规条目」的历史语义（字段名为历史命名，实际语义是并集而非仅空泛项；
  // 既有调用方与断言依赖该并集语义），
  // formatMismatchItems 为其中属格式不符的子集，供主流程产出可执行的诊断文案。
  //
  // 可达性事实（实测，非估计）：VAGUE_EVIDENCE_PATTERNS 全部 `^` 锚定在裸声明前缀，
  // 而 EVIDENCE_PATTERN 要求行首即 `path:` 前缀——两者互斥，故「匹配后命中空泛前缀」
  // 当前恒不可达，O3 文案桶保留为语义定义（判据将来放宽时的兜底），实际归因全部走格式不符路。
  const formatMismatchItems: string[] = [];
  for (const item of evidence) {
    if (!EVIDENCE_PATTERN.test(item)) {
      formatMismatchItems.push(item);
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
  return { valid: vagueItems.length === 0, vagueItems, formatMismatchItems };
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
 *   7. 证据格式校验（两路文案：正则不匹配 → 格式不符；匹配但空泛声明 → O3 命中；
 *      两条路径都 → compositeScore -0.1，再判定 qualityLevel/passed）
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
    // 批次3 任务8：schema 前置拦截路径同样双轨同源——每条 [schema] 原文恰派生一条
    // VERIFIER-SCHEMA 结构化违规（subject 由 schemaErrorSubject 提取字段路径；
    // C16：errorMessages 与 errors 1:1（schema-loader map(formatAjvError)），zip 后优先结构化字段）
    const schemaReasons = schemaResult.errorMessages.map((m) => `[schema] ${m}`);
    return {
      passed: false,
      reasons: schemaReasons,
      structuredViolations: schemaResult.errorMessages.map((m, i) =>
        // eslint-disable-next-line security/detect-object-injection -- i 为 errorMessages 与 errors 的 1:1 zip 下标（schema-loader map(formatAjvError) 派生），非外部可控键
        makeStructured('VERIFIER-SCHEMA', schemaErrorSubject(m, schemaResult.errors?.[i]), `[schema] ${m}`),
      ),
      compositeScore: 0,
      expectedCompositeScore: 0,
      qualityLevel: 'N/A',
    };
  }

  const reasons: string[] = [];
  const reworkHints: string[] = [];
  // 批次3 任务8：结构化双轨——与 reasons 同源单点派生（pushViolation 恒成对），一一对应
  const structuredViolations: StructuredViolation[] = [];
  function pushViolation(reason: string, rule: VerifierRuleId, subject: string): void {
    reasons.push(reason);
    structuredViolations.push(makeStructured(rule, subject, reason));
  }

  if (!raw || typeof raw !== 'object') {
    pushViolation('输出不是合法 JSON 对象', 'VERIFIER-STRUCTURE', 'root');
    return {
      passed: false,
      reasons,
      structuredViolations,
      compositeScore: 0,
      expectedCompositeScore: 0,
      qualityLevel: 'N/A',
    };
  }

  const o = raw as Record<string, unknown>;

  // 1. schemaVersion
  if (o.schemaVersion !== SCHEMA_VERSION) {
    pushViolation(
      `schemaVersion 必须为 "${SCHEMA_VERSION}"，实际为 ${JSON.stringify(o.schemaVersion)}`,
      'VERIFIER-SCHEMA',
      'schemaVersion',
    );
  }

  // 2. meta
  const meta = o.meta as Record<string, unknown> | undefined;
  if (!meta || typeof meta !== 'object') {
    pushViolation('meta 字段缺失或非对象', 'VERIFIER-STRUCTURE', 'meta');
    return {
      passed: false,
      reasons,
      structuredViolations,
      compositeScore: 0,
      expectedCompositeScore: 0,
      qualityLevel: 'N/A',
    };
  }

  const targetKind = meta.targetKind as string;
  // P2.5 targetKind 枚举标准化：'testcase'/'file' 已废弃；'rootcause' 用于返工循环 V 复审根因报告（§7.5）
  const allowedKinds: TargetKind[] = ['requirement', 'design', 'code', 'test', 'rootcause'];
  if (!allowedKinds.includes(targetKind as TargetKind)) {
    pushViolation(
      `meta.targetKind 必须为 ${allowedKinds.join(' / ')}，实际为 ${JSON.stringify(targetKind)}（P2.5: 'testcase'/'file' 已废弃，分别用 'test'/'code'）`,
      'VERIFIER-SCHEMA',
      'meta.targetKind',
    );
    return {
      passed: false,
      reasons,
      structuredViolations,
      compositeScore: 0,
      expectedCompositeScore: 0,
      qualityLevel: 'N/A',
    };
  }

  if (typeof meta.target !== 'string' || meta.target.trim() === '') {
    pushViolation('meta.target 必须为非空字符串', 'VERIFIER-STRUCTURE', 'meta.target');
  }
  if (typeof meta.agent !== 'string' || meta.agent.trim() === '') {
    pushViolation('meta.agent 必须为非空字符串', 'VERIFIER-STRUCTURE', 'meta.agent');
  }

  const scoringMethod = meta.scoringMethod as string;
  if (!['logits', 'text-parse'].includes(scoringMethod)) {
    pushViolation(
      `meta.scoringMethod 必须为 logits / text-parse，实际为 ${JSON.stringify(scoringMethod)}`,
      'VERIFIER-SCHEMA',
      'meta.scoringMethod',
    );
  }

  const repeatTimes = meta.repeatTimes;
  if (!isNumber(repeatTimes) || !Number.isInteger(repeatTimes) || repeatTimes < MIN_REPEAT_TIMES) {
    pushViolation(
      `meta.repeatTimes 必须为整数且 ≥ ${MIN_REPEAT_TIMES}，实际为 ${JSON.stringify(repeatTimes)}`,
      'VERIFIER-SCHEMA',
      'meta.repeatTimes',
    );
  }

  const varianceThreshold = isNumber(meta.varianceThreshold) ? meta.varianceThreshold : Number.NaN;
  if (!inRange(varianceThreshold, 0, MAX_VARIANCE_THRESHOLD)) {
    pushViolation(
      `meta.varianceThreshold 必须在 [0,${MAX_VARIANCE_THRESHOLD}] 范围内，实际为 ${JSON.stringify(meta.varianceThreshold)}`,
      'VERIFIER-SCHEMA',
      'meta.varianceThreshold',
    );
  }

  // 3. subCriteria
  const subCriteria = o.subCriteria;
  if (!Array.isArray(subCriteria) || subCriteria.length < 3) {
    pushViolation(
      `subCriteria 必须为数组且长度 ≥ 3，实际为 ${JSON.stringify(subCriteria)?.slice(0, 80)}`,
      'VERIFIER-STRUCTURE',
      'subCriteria',
    );
    return {
      passed: false,
      reasons,
      structuredViolations,
      compositeScore: 0,
      expectedCompositeScore: 0,
      qualityLevel: 'N/A',
    };
  }

  const expected = SUB_CRITERIA[targetKind as TargetKind];
  if (subCriteria.length !== expected.length) {
    // C17：长度不符即结构错位，继续按下标比对只会叠加错位误报（如缺首项后共享下标全部移位，
    // 连权重都逐项错位）。单条清晰 violation 后立即返回，不再进入逐项/按下标比对循环；
    // 方向仍 fail-closed（passed=false，下游字段校验对本形态无增量信息）。
    pushViolation(
      `subCriteria 数量不符（expected ${expected.length}, got ${subCriteria.length}）`,
      'VERIFIER-STRUCTURE',
      'subCriteria',
    );
    return {
      passed: false,
      reasons,
      structuredViolations,
      compositeScore: 0,
      expectedCompositeScore: 0,
      qualityLevel: 'N/A',
    };
  }

  // 子标准名称与权重逐一比对
  const actualNames: string[] = [];
  for (let i = 0; i < subCriteria.length; i++) {
    const sc = subCriteria[i] as Record<string, unknown>;
    const idx = i + 1;
    if (!sc || typeof sc !== 'object') {
      pushViolation(`subCriteria[${idx}] 非对象`, 'VERIFIER-STRUCTURE', `subCriteria[${idx}]`);
      continue;
    }
    if (typeof sc.name !== 'string' || sc.name.trim() === '') {
      pushViolation(`subCriteria[${idx}].name 缺失或非字符串`, 'VERIFIER-STRUCTURE', `subCriteria[${idx}].name`);
    } else {
      actualNames.push(sc.name);
    }
    if (!isNumber(sc.weight) || !inRange(sc.weight, 0, 1)) {
      pushViolation(
        `subCriteria[${idx}].weight 必须在 [0,1]，实际为 ${JSON.stringify(sc.weight)}`,
        'VERIFIER-SCHEMA',
        `subCriteria[${idx}].weight`,
      );
    }
    if (!isNumber(sc.score) || !inRange(sc.score, 0, 1)) {
      pushViolation(
        `subCriteria[${idx}].score 必须在 [0,1]，实际为 ${JSON.stringify(sc.score)}`,
        'VERIFIER-SCHEMA',
        `subCriteria[${idx}].score`,
      );
    }
    if (!Array.isArray(sc.rawScores)) {
      pushViolation(`subCriteria[${idx}].rawScores 必须为数组`, 'VERIFIER-STRUCTURE', `subCriteria[${idx}].rawScores`);
    } else {
      if (isNumber(repeatTimes) && sc.rawScores.length !== repeatTimes) {
        pushViolation(
          `subCriteria[${idx}].rawScores 长度 ${sc.rawScores.length} ≠ meta.repeatTimes ${repeatTimes}`,
          'VERIFIER-STRUCTURE',
          `subCriteria[${idx}].rawScores`,
        );
      }
      for (let j = 0; j < sc.rawScores.length; j++) {
        const v = sc.rawScores[j];
        if (!isNumber(v) || !inRange(v, 0, 1)) {
          pushViolation(
            `subCriteria[${idx}].rawScores[${j + 1}] 不在 [0,1]：${JSON.stringify(v)}`,
            'VERIFIER-SCHEMA',
            `subCriteria[${idx}].rawScores[${j + 1}]`,
          );
        }
      }
    }
    if (!isNumber(sc.variance) || sc.variance < 0) {
      pushViolation(
        `subCriteria[${idx}].variance 必须为非负数，实际为 ${JSON.stringify(sc.variance)}`,
        'VERIFIER-SCHEMA',
        `subCriteria[${idx}].variance`,
      );
    } else if (sc.variance > varianceThreshold) {
      pushViolation(
        `subCriteria[${idx}].variance ${sc.variance} > 阈值 ${varianceThreshold}（不可重复，需重评）`,
        'VERIFIER-VARIANCE',
        `subCriteria[${idx}].variance`,
      );
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
          const msg = `subCriteria[${idx}].variance ${sc.variance} ≠ 由 rawScores 重算的方差 ${recomputed.toFixed(6)}（误差 > ${VARIANCE_EPSILON}，疑似谎报方差）`;
          pushViolation(msg, 'VERIFIER-VARIANCE', `subCriteria[${idx}].variance`);
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
        const msg = `维度 ${dimName} 的 rawScores 全同 [${numericScores.join(',')}], 疑似手工填写`;
        pushViolation(msg, 'VERIFIER-VARIANCE', `subCriteria[${idx}].rawScores`);
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
          pushViolation(
            `维度 ${dimName} 的 rawScores 为完美等差数列 [${numericScores.join(',')}]（公差 0.01），疑似构造数据；` +
              '请改用真实离散值（相邻打分差值不得恒等、不得为 0.01 完美等差）',
            'VERIFIER-VARIANCE',
            `subCriteria[${idx}].rawScores`,
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
          const msg = `维度 ${dimName} 的 rawScores 扰动范围 ${spread.toFixed(4)} > 0.10, 扰动越界`;
          pushViolation(msg, 'VERIFIER-VARIANCE', `subCriteria[${idx}].rawScores`);
        } else if (spread < 0.01) {
          reworkHints.push(`维度 ${dimName} 的 rawScores 扰动范围 ${spread.toFixed(4)} < 0.01, 疑似未扰动`);
        }
      }
    }

    if (typeof sc.evidence !== 'string' || sc.evidence.trim() === '') {
      pushViolation(
        `subCriteria[${idx}].evidence 必须为非空字符串（引用目标内具体片段）`,
        'VERIFIER-STRUCTURE',
        `subCriteria[${idx}].evidence`,
      );
    } else {
      // R12（sig-002）：evidence 须含具体引用，禁止纯描述
      const r12 = checkR12EvidenceSpecificity(sc.evidence, idx);
      if (r12) pushViolation(r12, 'VERIFIER-EVIDENCE', `subCriteria[${idx}].evidence`);
    }
  }

  // 子标准集合必须与 §7 定义完全匹配（名称 + 权重）
  for (let i = 0; i < expected.length; i++) {
    const exp = expected[i];
    if (!exp) continue;
    const act = subCriteria[i] as Record<string, unknown> | undefined;
    if (!act) continue;
    if (act.name !== exp.name) {
      pushViolation(
        `subCriteria[${i + 1}].name 应为 "${exp.name}"，实际为 ${JSON.stringify(act.name)}`,
        'VERIFIER-STRUCTURE',
        `subCriteria[${i + 1}].name`,
      );
    }
    if (isNumber(act.weight) && Math.abs(act.weight - exp.weight) > EPSILON) {
      pushViolation(
        `subCriteria[${i + 1}].weight 应为 ${exp.weight}，实际为 ${act.weight}（权重不得改动）`,
        'VERIFIER-SCHEMA',
        `subCriteria[${i + 1}].weight`,
      );
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
    pushViolation(
      `compositeScore 必须在 [0,1]，实际为 ${JSON.stringify(compositeScore)}`,
      'VERIFIER-SCHEMA',
      'compositeScore',
    );
  } else if (Math.abs(compositeScore - expectedComposite) > EPSILON) {
    pushViolation(
      `compositeScore ${compositeScore} ≠ Σ(score*weight) ${expectedComposite}（误差 > ${EPSILON}）`,
      'VERIFIER-SCORE',
      'compositeScore',
    );
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
      // D-10①：两路文案区分——正则不匹配 → 格式不符（给出可执行形态）；
      // 匹配后命中 VAGUE_EVIDENCE_PATTERNS → 保留空泛声明（O3）文案。两者扣分与
      // qualityLevel/passed 重判定路径完全一致，只有诊断归因不同。
      if (evidenceResult.formatMismatchItems.length > 0) {
        pushViolation(
          `evidence 格式不符（须 path:Lnn=stmt 或 path:§sec=stmt；行号区间合法写法 path:L51-53=stmt，双 L 非法）：${evidenceResult.formatMismatchItems.join('; ')}`,
          'VERIFIER-EVIDENCE',
          // 聚合文案跨多个子标准，无单一索引 → 取集合级字段路径
          'subCriteria.evidence',
        );
      }
      const vagueItemsOnly = evidenceResult.vagueItems.filter(
        (item) => !evidenceResult.formatMismatchItems.includes(item),
      );
      if (vagueItemsOnly.length > 0) {
        pushViolation(
          `evidence 格式校验失败（空泛声明，O3 命中）：${vagueItemsOnly.join('; ')}`,
          'VERIFIER-EVIDENCE',
          'subCriteria.evidence',
        );
      }
    }
  }

  // 6. qualityLevel — 基于证据扣分后的 compositeScore 重新判定
  let qualityLevel = o.qualityLevel;
  const allowedLevels: QualityLevel[] = ['A', 'B', 'C', 'D'];
  if (!allowedLevels.includes(qualityLevel as QualityLevel)) {
    pushViolation(
      `qualityLevel 必须为 A/B/C/D，实际为 ${JSON.stringify(qualityLevel)}`,
      'VERIFIER-SCHEMA',
      'qualityLevel',
    );
  } else if (isNumber(compositeScore)) {
    const expectedLevel = determineQualityLevel(compositeScore);
    if (qualityLevel !== expectedLevel) {
      pushViolation(
        `qualityLevel ${qualityLevel} 与综合分数 ${compositeScore} 应映射为 ${expectedLevel}（§6.1）`,
        'VERIFIER-SCORE',
        'qualityLevel',
      );
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
  const suppliedReworkHints = o.reworkHints;
  let hasBlockingReworkHint = false;
  if (Array.isArray(suppliedReworkHints)) {
    suppliedReworkHints.forEach((hint, index) => {
      if (typeof hint !== 'string') return;
      const match = BLOCKING_REWORK_HINT_PATTERN.exec(hint);
      if (!match) return;
      hasBlockingReworkHint = true;
      const severity = match[1] ?? match[2];
      pushViolation(
        `reworkHints[${index + 1}] 标记为 ${severity}，属于阻断性返工提示；不得与 passed=true 并存（verifier-spec.md §7.4A.2）`,
        'VERIFIER-STRUCTURE',
        `reworkHints[${index + 1}]`,
      );
    });
  }
  const passed = o.passed;
  // 批次3 任务8：R13/R18 双轨收集单点汇入（reasons 与 structured 恒成对）
  const singleAxis = collectR13SingleAxisFloor(subCriteria);
  // R18：分辨力下限（A-3d 校准偏移）。与 R13 同形态、同层级接入 reasons，
  // 不改变 passed 判定公式本身——R18 的影响经由 reasons 长度传导（任何 reasons 即 passed=false）。
  const resolution = collectR18ResolutionFloor(subCriteria);
  const expectedPassed =
    !hasBlockingReworkHint && (qualityLevel === 'A' || qualityLevel === 'B') && singleAxis.reasons.length === 0;
  if (typeof passed !== 'boolean') {
    pushViolation(`passed 必须为布尔值，实际为 ${JSON.stringify(passed)}`, 'VERIFIER-STRUCTURE', 'passed');
  } else if (passed !== expectedPassed) {
    pushViolation(
      `passed ${passed} 与 qualityLevel ${qualityLevel} 不一致（应 = ${expectedPassed}）`,
      'VERIFIER-STRUCTURE',
      'passed',
    );
  }
  reasons.push(...singleAxis.reasons);
  structuredViolations.push(...singleAxis.structured);
  reasons.push(...resolution.reasons);
  structuredViolations.push(...resolution.structured);

  // 8. summary（R1 非空）
  if (typeof o.summary !== 'string' || o.summary.trim() === '') {
    pushViolation('summary 必须为非空字符串', 'VERIFIER-STRUCTURE', 'summary');
  }

  // 9. reworkHints
  if (expectedPassed === false) {
    if (!Array.isArray(o.reworkHints) || o.reworkHints.length === 0) {
      pushViolation('passed=false 时 reworkHints 必须为非空数组', 'VERIFIER-STRUCTURE', 'reworkHints');
    } else {
      for (let i = 0; i < o.reworkHints.length; i++) {
        const h = o.reworkHints[i];
        if (typeof h !== 'string' || h.trim() === '') {
          pushViolation(`reworkHints[${i + 1}] 必须为非空字符串`, 'VERIFIER-STRUCTURE', `reworkHints[${i + 1}]`);
        }
      }
    }
  }

  // 10. ranking（可选）
  if (o.ranking !== undefined) {
    const r = o.ranking as Record<string, unknown>;
    if (!r || typeof r !== 'object') {
      pushViolation('ranking 必须为对象', 'VERIFIER-STRUCTURE', 'ranking');
    } else {
      if (r.algorithm !== 'PPT') {
        pushViolation(
          `ranking.algorithm 必须为 "PPT"，实际为 ${JSON.stringify(r.algorithm)}`,
          'VERIFIER-SCHEMA',
          'ranking.algorithm',
        );
      }
      if (!isNumber(r.k) || !Number.isInteger(r.k) || r.k < MIN_RANKING_K || r.k > MAX_RANKING_K) {
        pushViolation(
          `ranking.k 必须为整数且 ∈ [${MIN_RANKING_K}, ${MAX_RANKING_K}]，实际为 ${JSON.stringify(r.k)}`,
          'VERIFIER-SCHEMA',
          'ranking.k',
        );
      }
      if (!isNumber(r.temperature) || r.temperature <= MIN_TEMPERATURE || r.temperature > MAX_TEMPERATURE) {
        pushViolation(
          `ranking.temperature 必须为正数且 ≤ ${MAX_TEMPERATURE}（过大 sigmoid 失去区分度），实际为 ${JSON.stringify(r.temperature)}`,
          'VERIFIER-SCHEMA',
          'ranking.temperature',
        );
      }
      if (!isNumber(r.rounds) || !Number.isInteger(r.rounds) || r.rounds < MIN_RANKING_ROUNDS) {
        pushViolation(
          `ranking.rounds 必须为 ≥${MIN_RANKING_ROUNDS} 的整数，实际为 ${JSON.stringify(r.rounds)}`,
          'VERIFIER-SCHEMA',
          'ranking.rounds',
        );
      }
      if (!Array.isArray(r.ordered) || r.ordered.length < 2) {
        pushViolation('ranking.ordered 必须为长度 ≥2 的字符串数组', 'VERIFIER-STRUCTURE', 'ranking.ordered');
      } else {
        const ordered = r.ordered as unknown[];
        if (ordered.some((item) => typeof item !== 'string' || item.trim() === '')) {
          pushViolation('ranking.ordered 的每项必须为非空字符串', 'VERIFIER-STRUCTURE', 'ranking.ordered');
        }
        const unique = new Set(ordered.filter((item): item is string => typeof item === 'string'));
        if (unique.size !== ordered.length) {
          pushViolation('ranking.ordered 不得包含重复候选项', 'VERIFIER-STRUCTURE', 'ranking.ordered');
        }
        if (isNumber(r.k) && Number.isInteger(r.k) && r.k > ordered.length) {
          pushViolation(`ranking.k ${r.k} 不得大于候选项数量 ${ordered.length}`, 'VERIFIER-SCHEMA', 'ranking.k');
        }
      }
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
    structuredViolations,
    reworkHints,
    compositeScore: isNumber(compositeScore) ? compositeScore : 0,
    expectedCompositeScore: expectedComposite,
    qualityLevel: typeof qualityLevel === 'string' ? qualityLevel : 'N/A',
  };
}
