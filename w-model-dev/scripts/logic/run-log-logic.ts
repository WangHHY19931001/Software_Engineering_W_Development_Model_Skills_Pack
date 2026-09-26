/**
 * 运行日志校验纯逻辑（Run-Log Logic）—— 防止运行日志漂移与 O 越权
 *
 * 对应 w-model-dev/references/data-models.md RunLogEntry schema（§运行日志模型）
 * 与 w-model-dev/references/operational-recovery.md §5.2。
 * 校验：R1 阶段动作完整性 + R2 tokens 非负 + R3 返工记录一致
 *       + R4 acknowledgedDecisions 非空 + R5 O 越权检测 + R6 exitCode 一致
 *       + R7 append-only 时序 + 记录哈希链（D-3a：链断 blocking / 历史段 LEGACY 非阻断）
 *         + checkpoint 放行锚（D-3b：锚与放行时刻前缀不符 blocking / 缺字段 LEGACY 非阻断）。
 *       + R8 轨迹模板校验（理想阶段轨迹：S→R3×3→V→G→checkpoint）
 *       + R9 跨轮次评审一致性 + R10 revertEvidence 回滚证伪
 *       + R11 闭环五脚本机器核验（约束 #11）
 *
 * 设计原则（与 budget-logic.ts / graph-logic.ts / tla-logic.ts 一致）：
 *   1. 仅依赖本文件类型形状 + lib/safe-json.js（parseJsonSafe）+ schema-loader.js（validateBySchema），无 I/O 副作用
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用
 *   3. 单点事实：所有「运行日志是否符合规范」的判定均委托至此
 */

import { validateBySchema } from '../infrastructure/schema-loader.js';
import { parseJsonSafe } from '../lib/safe-json.js';

// ==================== 常量 ====================

/** variant 规则引入时刻（42.2.1 发布日）：此后写入的 emergency-fix 缺 variant 不再按 legacy 吸收 */
export const LEGACY_VARIANT_CUTOFF = '2026-09-01T00:00:00Z';

/**
 * R9 跨轮次评审不一致的档差阈值（A-3d 标准偏移）。
 *
 * 2 档意味着评审标准发生实质漂移（1 档可能只是产物确实改进了）。
 * **先行取值，端到端调测后校准**（规格 D23 / 任务 16 步骤 2）——仓库内无真实
 * 历史 run-log 可回测（`.w-model/` 为 gitignored 本地生成物）。
 */
export const REVIEW_LEVEL_SPREAD = 2;

/** R9 所需最少评审数据点：仅 1 次评审无不一致可言（首次评审豁免） */
export const REVIEW_LEVEL_MIN_POINTS = 2;

/** R9 质量等级序（A > B > C > D）；未知等级记为 -1 并在计算前过滤 */
export const REVIEW_LEVEL_ORDER: Record<string, number> = {
  A: 3,
  B: 2,
  C: 1,
  D: 0,
};

/**
 * R11 闭环五脚本（约束 #11 / SSoT §10C）：每阶段门须以 5 个闭环脚本
 * exitCode=0 为前提才可放行。R11 把该约束做成机器可核验判定——
 * 凡出现 checkpoint 放行（action=checkpoint 且 outcome=success）的阶段，
 * 放行前必须已有这 5 个脚本各自一条 role=G / outcome=success /
 * gateExitCode=0 的 gate 记录；缺失或未严格早于放行（同秒不算）均 blocking
 * （无时间戳豁免）。唯一例外是阶段 1 的 `check-checkpoint.ts`（D-6 自举豁免）：
 * 该脚本自身要求 run-log 中已存在 checkpoint 记录才可能 exit 0，故 `phase===1`
 * 时允许其记录晚于放行，但须早于下一放行（无下一放行时无上界）；其余四脚本与
 * `phase>=2` 的放行判据不变。
 */
export const RUN_LOG_CLOSURE_SCRIPTS: readonly string[] = [
  'check-budget.ts',
  'check-run-log.ts',
  'check-maturity.ts',
  'check-checkpoint.ts',
  'check-preventive-review.ts',
] as const;

// ==================== 自包含类型形状 ====================

/** Canonical target kinds plus historical phase<8 legacy spellings. */
export type RunLogTargetKind = 'rootcause' | 'requirement' | 'design' | 'code' | 'test' | 'file' | 'testcase';

export interface RunLogEntry {
  runId: string;
  timestamp: string;
  phase: number;
  phaseName: string;
  action:
    | 'chunk'
    | 'cross'
    | 'evolve'
    | 'produce'
    | 'review'
    | 'gate'
    | 'tla-gate'
    | 'graph-gate'
    | 'test'
    | 'checkpoint'
    | 'rework'
    | 'rollback'
    | 'rootcause'
    | 'fix'
    | 'emergency-fix'
    | 'escalate'
    | 'r3-completeness'
    | 'r3-reliability'
    | 'r3-security'
    | 'codegraph_query'
    | 'opsx_explore'
    | 'opsx_propose'
    | 'opsx_apply'
    | 'opsx_archive'
    | 'ensure_deps'
    | 'iceberg-sweep'
    | 'iceberg-review'
    | 'plan_propose'
    | 'plan_task'
    | 'plan_review';
  role: 'O' | 'A' | 'S' | 'V' | 'G' | 'R';
  duration_s: number;
  tokens: number;
  estimated: boolean;
  subagentSpawns: number;
  gateExitCode: number | null;
  gateLogPath?: string;
  outcome: 'success' | 'fail' | 'rework' | 'escalate' | 'blocked' | 'cancelled';
  acknowledgedDecisions?: string[];
  note?: string;
  artifacts?: string[];
  /** 决策置信度（可选，0.0-1.0；agentic Ch18） */
  decisionConfidence?: number;
  // ---- rootcause/fix 扩展字段（spec §5.5）----
  /** rootcause: R 报告 ID；fix: 所基于的 R 报告 ID */
  reportId?: string;
  /** rootcause: 根因分类 */
  rootCauseCategory?: string;
  /** rootcause: 是否存在上游缺陷 */
  upstreamDefect?: boolean;
  /** rootcause: 是否建议回退 */
  rollbackRecommended?: boolean;
  /** fix: 所基于的 R 报告 ID（语义同 reportId，但字段名与 spec 对齐） */
  basedOnReport?: string;
  /** fix: RTM diff */
  rtmDiff?: Record<string, unknown>;
  /** implementation fix/review/gate/R3 所针对的实现产物身份 */
  implementationTarget?: string;
  // ---- fix/emergency-fix 变体标注（subagent-delegation.md「S 子代理修改既有产物的边界」）----
  /** fix 变体标注：S-fix 用 "fix"，紧急修复通道用 "emergency-fix"（role=S 时建议必填，schema 仅对 emergency-fix 强制） */
  variant?: 'fix' | 'emergency-fix';
  /** emergency-fix 的阻塞原因描述（"为何走紧急通道"的审计说明，variant=emergency-fix 时必填） */
  blocker?: string;
  /** fix/emergency-fix 修复位置（文件/区域），审计用 */
  fixedLocation?: string;
  /** fix/emergency-fix 依据（如 S-self-assessment 或 R 报告 ID），审计用 */
  fixBasedOn?: string;
  /** effective lifecycle status is emitted by the checker summary, never written back to raw JSONL. */
  lifecycleStatus?: RunLogLifecycleStatus;
  /** review: 审查目标类型（'rootcause' 表示复审 R 报告；phase<8 保留 file/testcase legacy） */
  targetKind?: RunLogTargetKind;
  /** review: 审查目标产物 */
  target?: string;
  /** review: 质量等级 */
  qualityLevel?: string;
  /** review: 是否通过 */
  passed?: boolean;
  /** review: 返工提示 */
  reworkHints?: string[];
  /** fix/emergency-fix: S-fix 复现测试的回滚证伪声明（R10 强制携带；schema 层 optional）。 */
  revertEvidence?: { command: string; description?: string };
  /** rootcause/fix: 返工轮次 */
  round?: number;
  /** gate: 门禁脚本名 */
  script?: string;
  // ---- 记录哈希链（D-3a，可选；公式见 canonicalJson / computeRecordHash）----
  /** 前一条带哈希记录的 recordHash（文件内首条带哈希记录为 ""）；作为记录字段参与本条哈希载荷 */
  prevRecordHash?: string;
  /** 本条记录的内容指纹：sha256(prevRecordHash + "\n" + canonicalJson(记录去掉 recordHash 字段)) 小写 hex */
  recordHash?: string;
  // ---- checkpoint 放行锚（D-3b，可选；定义见 computeRunLogAnchor）----
  /** 放行时刻的历史前缀外部锚（由追加器在写 checkpoint success 记录时自动填入；缺席 = LEGACY 非阻断） */
  runLogAnchor?: RunLogAnchor;
}

/**
 * checkpoint 放行锚（D-3b）——放行时刻的**历史前缀**外部锚。
 *
 * 哈希链（D-3a）只保护链自身：把握「整链重算」能力者对放行前历史行整体重排 + 时间戳重对齐后
 * 重算全部 `recordHash`，链判定完全自洽（真实调测盲区）；尾删同样不可见。锚把前缀字节钉死：
 *
 * - **前缀** = 文件序下 `timestamp ≤ 锚记录 timestamp` 的全部记录（含锚记录之前的历史行；**不含**
 *   锚自身所在记录）——按时间戳而非物理位置定义，故「把锚记录挪到文件更早位置」不会缩小前缀；
 * - `lines` = 该前缀的记录条数；
 * - `sha256` = 该前缀各记录**原始行字节**（行终止符 LF/CRLF 剥离后的原样文本，含空白与转义）以
 *   **单个 `"\n"` 连接**（**末尾不加换行**）后的 SHA-256（64 位小写 hex）；`lines=0` 即空串摘要
 *   `e3b0c442…`（不是 `sha256("\n")`）。
 *
 * 三方复算口径一致：写入端（`logic/run-log-append-logic.ts`）与校验端（本文件 R7 第三段）共用
 * `anchorDigestOf` / `computeRunLogAnchor`（禁止各写一份）；第三方可由 JSONL 文件按上述定义独立复算。
 */
export interface RunLogAnchor {
  /** 前缀记录条数（`timestamp ≤ 放行时间戳` 且不含锚自身所在记录） */
  lines: number;
  /** 前缀各行原始字节以单个 "\n" 连接（末尾不加换行）后的 SHA-256（64 位小写 hex） */
  sha256: string;
}

export interface RunLogCheckOptions {
  /** R3: tla-manifest 的 checkRounds（TLA+ 返工轮数），用于与 run-log rework 记录数比对 */
  tlaCheckRounds?: number;
  /** R3: 当前阶段编号，用于按阶段过滤 rework 条目 */
  phase?: number;
  /** R5/R6: gate-logs 数据，key = gateLogPath，value = { exitCode?, content } */
  gateLogs?: Map<string, { exitCode?: number; content: string }>;
  /**
   * R7 哈希链：注入的哈希实现（默认纯 TS `sha256Hex`）。
   * 用于复用宿主 crypto 或测试替换；公式不变（sha256 + canonicalJson）。
   */
  hashFn?: HashFunction;
  /**
   * R7 放行锚：run-log 文件的**原始行**（与 `entries` 同序同长，行终止符已剥离、原文未 trim）。
   *
   * 锚的 `sha256` 定义在原始字节上（见 `RunLogAnchor`），而 logic 层零 `node:fs`/`node:crypto`
   * → 文本由 CLI 层注入（`lib/read-json-or-exit.ts` 的 `rawLines`，与 `entries` 同一过滤规则）。
   * 未注入时只校验 `lines` 并记非阻断诊断（绝不假装验过 sha256）。
   */
  runLogRawLines?: readonly string[];
}

export type RunLogLifecycleStatus = 'CLOSED_UNDER_CURRENT_RULES' | 'NOT_CLOSED_NOT_PROVEN';

export interface RunLogCheckResult {
  passed: boolean;
  violations: string[];
  /** 生命周期 reducer 的非阻断诊断（legacy/pending 等状态，不改写 raw log）。 */
  diagnostics?: string[];
  /** 当前输入是否在无 blocking violation 且无 deferred diagnostic 的意义下闭合。 */
  lifecycleStatus: RunLogLifecycleStatus;
  /** R10 revertEvidence 维度计数；legacy 保留兼容且严格模式固定为 0。 */
  revertEvidence?: { checked: number; missing: number; legacy: number };
  /** R11 闭环五脚本核验计数（checkedGates=已核验的 checkpoint 放行数，missing=缺失/晚到记录数）；无 checkpoint 放行时不出现。 */
  closure?: { checkedGates: number; missing: number };
}

interface LifecycleIdentity {
  phase: number | null;
  round: number | null;
  reportId: string | null;
  targetKind: string | null;
  basedOnReport: string | null;
  implementationTarget: string | null;
}

// ==================== 工具函数 ====================

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.trim() !== '';
}

function nullableString(value: unknown): string | null {
  return isNonEmptyString(value) ? value.trim() : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

/**
 * Action-specific identity projection. Rootcause records use a rootcause
 * projection; implementation evidence uses the complete fix projection.
 * Missing fields never become wildcards for lifecycle credit.
 */
function lifecycleIdentity(entry: RunLogEntry): LifecycleIdentity {
  const isRootcauseAction = entry.action === 'rootcause';
  const isRootcauseEvidence =
    (entry.action === 'review' && entry.targetKind === 'rootcause') ||
    (entry.action === 'gate' && entry.script === 'check-rootcause-report.ts');
  const isRootcauseSegment = isRootcauseAction || isRootcauseEvidence;
  return {
    phase: nullableNumber(entry.phase),
    round: nullableNumber(entry.round),
    reportId: nullableString(entry.reportId),
    targetKind: isRootcauseSegment ? 'rootcause' : nullableString(entry.targetKind),
    basedOnReport: isRootcauseAction ? null : nullableString(entry.basedOnReport),
    implementationTarget: isRootcauseSegment ? null : nullableString(entry.implementationTarget),
  };
}

function lifecycleKey(identity: LifecycleIdentity): string {
  return [
    identity.phase,
    identity.round,
    identity.reportId,
    identity.targetKind,
    identity.basedOnReport,
    identity.implementationTarget,
  ]
    .map((value) => value ?? 'unknown')
    .join('|');
}

function lifecycleScopeKey(identity: LifecycleIdentity): string {
  return [identity.phase, identity.round, identity.reportId].map((value) => value ?? 'unknown').join('|');
}

function entryScopeKey(entry: RunLogEntry): string {
  const identity = lifecycleIdentity(entry);
  const reportRef = ['fix', 'emergency-fix'].includes(entry.action)
    ? (identity.basedOnReport ?? identity.reportId)
    : (identity.reportId ?? identity.basedOnReport);
  return [identity.phase, identity.round, reportRef].map((value) => value ?? 'unknown').join('|');
}

function completeRootcauseIdentity(identity: LifecycleIdentity): boolean {
  return (
    identity.phase !== null &&
    identity.round !== null &&
    identity.reportId !== null &&
    identity.targetKind === 'rootcause'
  );
}

function completeImplementationIdentity(entry: RunLogEntry): boolean {
  const identity = lifecycleIdentity(entry);
  return (
    identity.phase !== null &&
    identity.round !== null &&
    identity.reportId !== null &&
    identity.targetKind !== null &&
    identity.targetKind !== 'rootcause' &&
    identity.basedOnReport !== null &&
    identity.implementationTarget !== null
  );
}

function sameIdentity(a: LifecycleIdentity, b: LifecycleIdentity): boolean {
  return (
    a.phase === b.phase &&
    a.round === b.round &&
    a.reportId === b.reportId &&
    a.targetKind === b.targetKind &&
    a.basedOnReport === b.basedOnReport &&
    a.implementationTarget === b.implementationTarget
  );
}

function isSuccessfulFix(entry: RunLogEntry): boolean {
  return entry.role === 'S' && ['fix', 'emergency-fix'].includes(entry.action) && entry.outcome === 'success';
}

/**
 * V 自有产物目录前缀（D-2）：V 重发被修报告时落盘的评审产物均在 V 管辖目录下，
 * artifacts 全部命中这些前缀才可视为「V 重发」的产物证据。
 */
const V_OWNED_PREFIXES = ['.w-model/verifier-outputs/', '.w-model/v-reviews/', '.w-model/preventive-reviews/'];

/**
 * D-2：V 以其自有产物重发被修报告，等价于一次修复记录。
 * VerifierOutput / 预防性报告类缺陷只能由 V 修复（重发其自有产物），
 * 此时 S-fix 记录不存在；以 review + role=V + basedOnReport + artifacts 全部
 * V 自有前缀识别该形态，仅用于 R3/R7 的 rootcause 报告配对（非 phase-8 严格分支）。
 */
function isVRepairRecord(entry: RunLogEntry): boolean {
  if (entry.action !== 'review' || entry.role !== 'V' || entry.outcome !== 'success') return false;
  if (!isNonEmptyString(entry.basedOnReport)) return false;
  const arts = entry.artifacts;
  return (
    Array.isArray(arts) &&
    arts.length > 0 &&
    arts.every((a) => typeof a === 'string' && V_OWNED_PREFIXES.some((p) => a.startsWith(p)))
  );
}

/** R3/R7 rootcause 报告配对接受的「成功修复」记录：S-fix 或 V 重发（D-2）。 */
function isSuccessfulRepair(entry: RunLogEntry): boolean {
  return isSuccessfulFix(entry) || isVRepairRecord(entry);
}

function hasExactImplementationTargetEvidence(entry: RunLogEntry): boolean {
  const identity = lifecycleIdentity(entry);
  return (
    completeImplementationIdentity(entry) &&
    entry.target === identity.implementationTarget &&
    Array.isArray(entry.artifacts) &&
    entry.artifacts.includes(identity.implementationTarget!)
  );
}

function hasExactFixEvidence(entry: RunLogEntry): boolean {
  const identity = lifecycleIdentity(entry);
  return (
    isSuccessfulFix(entry) &&
    hasExactImplementationTargetEvidence(entry) &&
    Array.isArray(entry.artifacts) &&
    entry.artifacts.includes(identity.implementationTarget!)
  );
}

function hasExactImplementationReviewEvidence(entry: RunLogEntry): boolean {
  return hasPassedReview(entry) && entry.targetKind !== 'rootcause' && hasExactImplementationTargetEvidence(entry);
}

function hasExactImplementationGateEvidence(entry: RunLogEntry): boolean {
  return hasPassedGate(entry) && entry.targetKind !== 'rootcause' && hasExactImplementationTargetEvidence(entry);
}

function hasExactR3Evidence(entry: RunLogEntry): boolean {
  return (
    entry.role === 'R' &&
    entry.outcome === 'success' &&
    R3_ACTIONS.includes(entry.action) &&
    hasExactImplementationTargetEvidence(entry)
  );
}

function identityFieldValue(identity: LifecycleIdentity, field: string): unknown {
  switch (field) {
    case 'phase':
      return identity.phase;
    case 'round':
      return identity.round;
    case 'reportId':
      return identity.reportId;
    case 'targetKind':
      return identity.targetKind;
    case 'basedOnReport':
      return identity.basedOnReport;
    case 'implementationTarget':
      return identity.implementationTarget;
    default:
      return null;
  }
}

function identityMissingFields(identity: LifecycleIdentity): string[] {
  const fields = ['phase', 'round', 'reportId', 'targetKind', 'basedOnReport', 'implementationTarget'];
  return fields.filter((field) => identityFieldValue(identity, field) === null);
}

function entryIdentityMissingFields(entry: RunLogEntry): string[] {
  const identity = lifecycleIdentity(entry);
  const isRootcauseSegment =
    entry.action === 'rootcause' ||
    (entry.action === 'review' && entry.targetKind === 'rootcause') ||
    (entry.action === 'gate' && entry.script === 'check-rootcause-report.ts');
  const fields = isRootcauseSegment
    ? ['phase', 'round', 'reportId']
    : ['phase', 'round', 'reportId', 'targetKind', 'basedOnReport', 'implementationTarget'];
  return fields.filter((field) => identityFieldValue(identity, field) === null);
}

function hasPassedReview(entry: RunLogEntry): boolean {
  return entry.action === 'review' && entry.role === 'V' && entry.outcome === 'success' && entry.passed !== false;
}

function hasPassedGate(entry: RunLogEntry): boolean {
  return (
    GATE_ACTIONS.has(entry.action) &&
    entry.role === 'G' &&
    entry.outcome === 'success' &&
    (entry.gateExitCode === null || entry.gateExitCode === 0)
  );
}

const LIFECYCLE_IDENTITY_FIELDS = new Set([
  'round',
  'reportId',
  'targetKind',
  'basedOnReport',
  'implementationTarget',
  'target',
]);

/**
 * 统一 legacy schema 吸收谓词（审计修复 task 3 + review Important-1 修正）：
 *
 * variant 规则引入前的旧记录（未声明 variant 字段）按 LEGACY 吸收——缺失的
 * required 字段若 ⊆ LIFECYCLE_IDENTITY_FIELDS ∪ {variant, blocker}，则吸收为
 * diagnostic（LEGACY_VARIANT / LEGACY_UNSCOPED）而非 blocking。该并集使
 * 「双 legacy」行（phase-8 旧 emergency-fix 同时缺 identity 与 variant/blocker）
 * 也落入吸收，不再因两条谓词互斥而翻转为 blocking。
 *
 * 一旦 variant 已声明（'variant' in record）则仅容忍 identity 字段缺失
 * （与引入 variant 前的 isLegacySchemaFailure 行为一致）；已声明
 * emergency-fix 却缺 blocker、或 variant 值不符 const，属真实不一致，
 * 一律走 blocking [schema]（吸收不覆盖，fail-closed 方向不变）。
 */
function isLegacySchemaFailure(raw: unknown, errorMessages: string[]): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const action = (raw as { action?: unknown }).action;
  if (typeof action !== 'string') return false;
  const requiredFields = errorMessages
    .map((message) => message.match(/required property '([^']+)'/)?.[1])
    .filter((field): field is string => field !== undefined);
  if (requiredFields.length === 0) return false;
  const record = raw as Record<string, unknown>;
  const tolerated =
    'variant' in record ? LIFECYCLE_IDENTITY_FIELDS : new Set([...LIFECYCLE_IDENTITY_FIELDS, 'variant', 'blocker']);
  if (requiredFields.some((field) => !tolerated.has(field))) return false;
  return errorMessages.every(
    (message) =>
      /required property '[^']+'/.test(message) ||
      message.includes('must match "then" schema') ||
      message.includes('must match "if" schema'),
  );
}

/** 记录是否为未声明 variant 的 emergency-fix（variant 规则引入前形态） */
function isUndeclaredVariantEmergencyFix(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  return (raw as { action?: unknown }).action === 'emergency-fix' && !('variant' in (raw as Record<string, unknown>));
}

/**
 * cutoff 分界（review2-fixes task 3 / A5）：未声明 variant 的 emergency-fix 且
 * timestamp 不早于 LEGACY_VARIANT_CUTOFF（variant 规则随 42.2.1 引入之后写入）
 * → 不再按 legacy 吸收，落入 blocking [schema]。timestamp 缺失/非法时视为
 * 非 post-cutoff（保守：维持既有吸收，不因分界引入新的误阻断）。
 */
function isPostCutoffUndeclaredVariantEmergencyFix(raw: unknown): boolean {
  if (!isUndeclaredVariantEmergencyFix(raw)) return false;
  const ts = (raw as { timestamp?: unknown }).timestamp;
  return typeof ts === 'string' && !Number.isNaN(Date.parse(ts)) && Date.parse(ts) >= Date.parse(LEGACY_VARIANT_CUTOFF);
}

/**
 * reworkHints 规则（audit-fixes task 4 / I-6）：review 族（review/iceberg-review）
 * passed=false 须带非空 reworkHints（schema allOf 同步强制）。判定含缺失与
 * present-but-empty 两种形态，与 schema `required` + `minItems: 1` 对齐。
 */
function isFailedReviewMissingReworkHints(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const record = raw as Record<string, unknown>;
  const isReviewFamily = record.action === 'review' || record.action === 'iceberg-review';
  const hints = record.reworkHints;
  const missingHints = !Array.isArray(hints) || hints.length === 0;
  return isReviewFamily && record.passed === false && missingHints;
}

/**
 * cutoff 分界（与 isPostCutoffUndeclaredVariantEmergencyFix 同型，复用
 * LEGACY_VARIANT_CUTOFF）：reworkHints 规则与 variant 规则同窗引入——cutoff
 * 前写入的失败 review 旧行按 LEGACY_REWORK_HINTS 非阻断 diagnostic 吸收；
 * cutoff 后属真实不一致，blocking。timestamp 缺失/非法时视为非 legacy
 * （保守：不吸收，宁可 blocking；passed=false 却无时间戳的行不构成可信旧证据）。
 */
function isLegacyMissingReworkHints(raw: RunLogEntry): boolean {
  if (!isFailedReviewMissingReworkHints(raw)) return false;
  const ts = Date.parse(raw.timestamp ?? '');
  return Number.isFinite(ts) && ts < Date.parse(LEGACY_VARIANT_CUTOFF);
}

/**
 * 共享谓词（D-5）：该条目的 schema 失败是否属可吸收的 legacy 形态。
 * 与 checkRunLog 的两条吸收分支等价（reworkHints 族 + identity/variant 族），
 * 供 check-checkpoint 复用，消除「同一记录两门裁定不一致」。
 *
 * 净语义（规格 §5「同一条记录，两门对 blocking vs 非阻断的裁定必须相同」）：
 *   真 ⇔ checkRunLog 会吸收该条（不产生 [schema] blocking）。
 * 谓词为真只表示「不按 [schema] 阻断」——吸收方**承接动作不同**：
 *   - reworkHints 族（isFailedReviewMissingReworkHints 且其他 schema 错误为空/同为
 *     legacy 可容忍，且 cutoff 前写入）→ 以 LEGACY_REWORK_HINTS 诊断吸收；
 *   - 其余 → 以身份/variant 族（LEGACY_VARIANT 等）诊断吸收。
 * 消费方按 `isFailedReviewMissingReworkHints(raw)` 分派承接动作即可：谓词为真且该族
 * 成立时，必是上表第一行（此时谓词取值即 isLegacyMissingReworkHints）。
 *
 * errorMessages 须为该条目经 run-log schema 校验得到的原始消息（validateBySchema
 * 的 errorMessages）；schema 通过（无消息）时谓词恒为假（无 schema 失败可吸收）。
 */
export function isLegacyAbsorbableEntry(raw: unknown, errorMessages: string[]): boolean {
  if (isFailedReviewMissingReworkHints(raw)) {
    const otherMessages = errorMessages.filter(
      (message) =>
        !message.includes('reworkHints') &&
        !message.includes('must match "then" schema') &&
        !message.includes('must match "if" schema'),
    );
    if (otherMessages.length === 0 || isLegacySchemaFailure(raw, otherMessages)) {
      return isLegacyMissingReworkHints(raw as RunLogEntry);
    }
  }
  return isLegacySchemaFailure(raw, errorMessages) && !isPostCutoffUndeclaredVariantEmergencyFix(raw);
}

/**
 * R10 判定：fix/emergency-fix 记录是否携带合法 revertEvidence.command（非空字符串）。
 * schema 层已保证出现时为 object 且 command 为 minLength 1 字符串；此处对仅空白
 * command（schema 可通过）按非法处理，与非空字符串判据（isNonEmptyString）对齐。
 */
function hasValidRevertEvidence(entry: RunLogEntry): boolean {
  const evidence = entry.revertEvidence as { command?: unknown } | undefined;
  return typeof evidence === 'object' && evidence !== null && isNonEmptyString(evidence.command);
}

const GATE_ACTIONS = new Set(['gate', 'tla-gate', 'graph-gate']);
const R3_ACTIONS = ['r3-completeness', 'r3-reliability', 'r3-security'];
const S_VARIANTS = ['produce', 'fix', 'emergency-fix'];
const R3_DIMENSIONS = ['completeness', 'reliability', 'security'];

/**
 * 动作→执行角色强制配对表（约束 #8 角色分派完整性 / 反模式 #10 O 越权）。
 * 由 checkRunLog logic 层强制（blocking violation），不放 schema 强制以避免
 * 破坏既有历史样本；schema 的 action/role description 已注明由 checkRunLog 强制。
 */
const ACTION_ROLE_PAIRING: Record<string, 'S' | 'V' | 'G' | 'R'> = {
  produce: 'S',
  fix: 'S',
  'emergency-fix': 'S',
  review: 'V',
  gate: 'G',
  'tla-gate': 'G',
  'graph-gate': 'G',
  'r3-completeness': 'R',
  'r3-reliability': 'R',
  'r3-security': 'R',
};

// ==================== 记录哈希链（D-3a，2026-09-25）====================
//
// 目的：R7 的时间戳单调判据只约束「相对顺序」，对既有行被**就地改写**（改 note / 改历史时间戳 /
// 删行 / 插行）完全不可见——四类突变此前全部 exit 0（真实调测中正是靠该盲区完成放行前重排）。
// 记录级哈希链把「中段篡改必须整链重算」变成可执行契约。
//
// 定稿公式（写入 `references/data-models.md` 与 `schemas/run-log.schema.json` 的字段 description，
// 第三方可独立复算）：
//
//   recordHash = sha256(prevRecordHash + "\n" + canonicalJson(record 去掉 recordHash 字段))
//   canonicalJson = 对象键按 Unicode 码点升序、无空白、UTF-8、数组保序
//
// 说明：`prevRecordHash` 是记录字段，因此**参与** canonicalJson 载荷（前缀里再出现一次，链关系因此
// 被双重绑定）；`recordHash` 字段本身必须从载荷剔除，否则哈希不可复算。

/** 哈希函数签名：输入 UTF-8 文本，输出小写 hex 摘要（默认 `sha256Hex`，可注入宿主 crypto 实现） */
export type HashFunction = (input: string) => string;

/** SHA-256 轮常量（FIPS 180-4，前 64 个素数立方根小数部分前 32 位） */
const SHA256_ROUND_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]);

/** 32 位循环右移 */
function rotateRight(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

/**
 * UTF-8 字节编码（WHATWG 口径：孤立代理对 → U+FFFD，与 `TextEncoder` 一致）。
 *
 * 不自带 `TextEncoder` 依赖（logic 层保持零运行时依赖、零全局依赖），手写规则 §3.9 逐条等价。
 */
function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (const character of text) {
    const codeUnit = character.charCodeAt(0);
    // 孤立代理对（长度为 1 的代理码元）→ U+FFFD（TextEncoder 同款替换语义）
    const isLoneSurrogate = character.length === 1 && codeUnit >= 0xd800 && codeUnit <= 0xdfff;
    const codePoint = isLoneSurrogate ? 0xfffd : (character.codePointAt(0) ?? 0);
    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return bytes;
}

/**
 * 纯 TypeScript SHA-256（UTF-8 输入 → 小写 hex 摘要）。
 *
 * 为什么手写而不用 `node:crypto`：本文件属 logic 层，D-3a 控制者裁定 A 明确要求哈希计算的
 * `node:crypto` 不得进 logic（以参数注入或由 lib/cli 层传入为准）。此处提供**自包含纯实现**作为
 * `computeRecordHash` 的默认哈希函数，使 checker（`checkRunLog`）与 writer（`planAppend`）无需任何
 * 外部注入即可复核同一公式；`HashFunction` 注入点保留给需要复用宿主 crypto 的调用方。
 * 正确性由 `__tests__/run-log-logic.test.ts` 对 `node:crypto` 的逐一比对锁定（空串 / 多块 / astral /
 * 孤立代理对 / 已知向量）。
 */
/* eslint-disable security/detect-object-injection -- SHA-256 依定义按轮次索引定长 typed array（Uint32Array / Uint8Array）与本地字节数组，下标全部来自本地循环整数与固定偏移（非外部输入），不存在对象注入面 */
export function sha256Hex(input: string): string {
  const bytes = utf8Bytes(input);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const highBits = Math.floor(bitLength / 0x100000000);
  const lowBits = bitLength >>> 0;
  for (let index = 0; index < 4; index++) {
    padded[paddedLength - 8 + index] = (highBits >>> (24 - index * 8)) & 0xff;
    padded[paddedLength - 4 + index] = (lowBits >>> (24 - index * 8)) & 0xff;
  }

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const schedule = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index++) {
      const at = offset + index * 4;
      const word = (padded[at] ?? 0) << 24;
      const second = (padded[at + 1] ?? 0) << 16;
      const third = (padded[at + 2] ?? 0) << 8;
      const fourth = padded[at + 3] ?? 0;
      schedule[index] = (word | second | third | fourth) >>> 0;
    }
    for (let index = 16; index < 64; index++) {
      const first = schedule[index - 15] ?? 0;
      const second = schedule[index - 2] ?? 0;
      const sigma0 = rotateRight(first, 7) ^ rotateRight(first, 18) ^ (first >>> 3);
      const sigma1 = rotateRight(second, 17) ^ rotateRight(second, 19) ^ (second >>> 10);
      schedule[index] = ((schedule[index - 16] ?? 0) + sigma0 + (schedule[index - 7] ?? 0) + sigma1) >>> 0;
    }

    let a = hash[0] ?? 0;
    let b = hash[1] ?? 0;
    let c = hash[2] ?? 0;
    let d = hash[3] ?? 0;
    let e = hash[4] ?? 0;
    let f = hash[5] ?? 0;
    let g = hash[6] ?? 0;
    let h = hash[7] ?? 0;
    for (let index = 0; index < 64; index++) {
      const bigSigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + bigSigma1 + choose + (SHA256_ROUND_CONSTANTS[index] ?? 0) + (schedule[index] ?? 0)) >>> 0;
      const bigSigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (bigSigma0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    hash[0] = ((hash[0] ?? 0) + a) >>> 0;
    hash[1] = ((hash[1] ?? 0) + b) >>> 0;
    hash[2] = ((hash[2] ?? 0) + c) >>> 0;
    hash[3] = ((hash[3] ?? 0) + d) >>> 0;
    hash[4] = ((hash[4] ?? 0) + e) >>> 0;
    hash[5] = ((hash[5] ?? 0) + f) >>> 0;
    hash[6] = ((hash[6] ?? 0) + g) >>> 0;
    hash[7] = ((hash[7] ?? 0) + h) >>> 0;
  }
  return [...hash].map((word) => word.toString(16).padStart(8, '0')).join('');
}
/* eslint-enable security/detect-object-injection */

/** 按 Unicode 码点升序比较字符串（≠ 默认 UTF-16 码元序：astral 字符与 U+E000..U+FFFF 的相对次序不同） */
function compareByCodePoint(left: string, right: string): number {
  const leftPoints = [...left];
  const rightPoints = [...right];
  const shared = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < shared; index++) {
    // eslint-disable-next-line security/detect-object-injection -- 同上：本地码点数组 + 循环整数下标
    const leftPoint = leftPoints[index]?.codePointAt(0) ?? 0;
    // eslint-disable-next-line security/detect-object-injection -- 同上：本地码点数组 + 循环整数下标
    const rightPoint = rightPoints[index]?.codePointAt(0) ?? 0;
    if (leftPoint !== rightPoint) return leftPoint - rightPoint;
  }
  return leftPoints.length - rightPoints.length;
}

/**
 * 规范化 JSON（`canonicalJson`，D-3a 定稿：对象键按 Unicode 码点升序、无空白、UTF-8、数组保序）。
 *
 * 值与 `JSON.stringify` 同口径：字符串按 JSON 规则转义、数组保序、值为 `undefined` 的对象键剔除
 * （数组内 `undefined` 按 JSON 语义记为 `null`）、非有限数字记为 `null`。
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item === undefined ? null : item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => compareByCodePoint(left, right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return 'null';
}

/**
 * 记录哈希（D-3a 定稿公式）：`sha256(prevRecordHash + "\n" + canonicalJson(record 去掉 recordHash 字段))`。
 *
 * writer（`logic/run-log-append-logic.ts`）与 checker（`checkRunLog` R7）共用本实现，禁止各写一份；
 * `hashFn` 为可注入哈希实现（默认纯 TS `sha256Hex`）。
 */
export function computeRecordHash(
  record: Record<string, unknown>,
  prevRecordHash: string,
  hashFn: HashFunction = sha256Hex,
): string {
  const withoutHash = Object.fromEntries(Object.entries(record).filter(([field]) => field !== 'recordHash'));
  return hashFn(`${prevRecordHash}\n${canonicalJson(withoutHash)}`);
}

/** 记录携带的链字段（空串/N 非字符串视为未带哈希） */
function recordHashOf(entry: RunLogEntry): string | undefined {
  const value = (entry as unknown as Record<string, unknown>).recordHash;
  return typeof value === 'string' && value !== '' ? value : undefined;
}

// ==================== checkpoint 放行锚（D-3b，2026-09-25）====================
//
// 单点真值（writer 与 checker 共用，禁止各写一份）：
//   anchorSha256 = sha256(前缀各行原始字节以单个 "\n" 连接，末尾不加换行)

/**
 * 放行锚摘要：各行原始字节（行终止符已由调用方的行切分剥离、原文不 trim）以单个 `"\n"`
 * 连接（**末尾不加换行**）后取 SHA-256 小写 hex；空前缀 = 空串摘要。
 *
 * `hashFn` 可注入（宿主 crypto / 测试替换），默认纯 TS `sha256Hex`（logic 层零 `node:crypto`）。
 */
export function anchorDigestOf(rawLines: readonly string[], hashFn: HashFunction = sha256Hex): string {
  return hashFn(rawLines.join('\n'));
}

/** 计算放行锚：`lines` = 前缀行数，`sha256` = `anchorDigestOf(前缀行)`。 */
export function computeRunLogAnchor(prefixRawLines: readonly string[], hashFn: HashFunction = sha256Hex): RunLogAnchor {
  return { lines: prefixRawLines.length, sha256: anchorDigestOf(prefixRawLines, hashFn) };
}

/** 锚形态判定（schema 同口径的防御性副本：direct logic 调用方可绕过 schema 校验） */
export function isWellFormedRunLogAnchor(value: unknown): value is RunLogAnchor {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const anchor = value as Record<string, unknown>;
  return (
    typeof anchor.lines === 'number' &&
    Number.isInteger(anchor.lines) &&
    anchor.lines >= 0 &&
    typeof anchor.sha256 === 'string' &&
    /^[0-9a-f]{64}$/.test(anchor.sha256)
  );
}

// ==================== 校验入口 ====================

export function checkRunLog(entries: unknown, options?: RunLogCheckOptions): RunLogCheckResult {
  const violations: string[] = [];
  const diagnostics: string[] = [];

  // 输入校验（先做）：非法输入返回 violations 而非抛 TypeError
  if (!Array.isArray(entries)) {
    return {
      passed: false,
      violations: ['run-log entries 必须为数组'],
      lifecycleStatus: 'NOT_CLOSED_NOT_PROVEN',
    };
  }

  // 空输入 fail-closed（审计修复 task 3）：[] 此前会走完全流程并在无任何
  // checkpoint 时静默 passed=true + CLOSED_UNDER_CURRENT_RULES——空日志无
  // 阶段/角色/门禁/CHECKPOINT 证据，不得视为「闭合通过」。
  if (entries.length === 0) {
    return {
      passed: false,
      violations: ['run-log 为空：无任何阶段/角色/门禁/CHECKPOINT 证据（fail-closed）'],
      lifecycleStatus: 'NOT_CLOSED_NOT_PROVEN',
    };
  }

  // 结构校验：narrow 每个元素为 Partial<RunLogEntry>，缺失必需字段则跳过并记录（容错，不 crash）
  // 必需字段为 R1-R8 实际访问的核心字段：runId / timestamp / phase / action / outcome
  const valid: RunLogEntry[] = [];
  /** valid[i] 在**入参数组**中的原始下标（D-3b 放行锚需按原始文件序定位前缀，故不能只留 valid 下标） */
  const validOrigins: number[] = [];
  for (let i = 0; i < entries.length; i++) {
    const raw = entries[i];
    // === Schema 前置校验 ===
    const schemaResult = validateBySchema('run-log', raw);
    if (!schemaResult.valid) {
      // reworkHints 规则（audit-fixes task 4 / I-6）：review 族 passed=false 缺非空
      // reworkHints 按 LEGACY_VARIANT_CUTOFF 分界——cutoff 前旧行 LEGACY_REWORK_HINTS
      // 诊断吸收，cutoff 后 [rework-hints] blocking。仅当其余 schema 错误为空或全部
      // 为 identity/variant legacy 可容忍时才分派；存在真实类型错误则回退通用
      // [schema] blocking（不吞错，fail-closed 方向不变）。
      // D-5：吸收判定统一走共享谓词 isLegacyAbsorbableEntry（与 check-checkpoint 同谓词，
      // 消除两门对同一条记录的裁定差异）；本块只负责 reworkHints 族的承接动作分派
      // （absorb → LEGACY_REWORK_HINTS 诊断 / 不 absorb → [rework-hints] blocking）。
      if (isFailedReviewMissingReworkHints(raw)) {
        const otherMessages = schemaResult.errorMessages.filter(
          (message) =>
            !message.includes('reworkHints') &&
            !message.includes('must match "then" schema') &&
            !message.includes('must match "if" schema'),
        );
        if (otherMessages.length === 0 || isLegacySchemaFailure(raw, otherMessages)) {
          if (isLegacyAbsorbableEntry(raw, schemaResult.errorMessages)) {
            const withoutHints = Object.fromEntries(
              Object.entries(raw as Record<string, unknown>).filter(([field]) => field !== 'reworkHints'),
            );
            valid.push(withoutHints as unknown as RunLogEntry);
            validOrigins.push(i);
            diagnostics.push(
              `LEGACY_REWORK_HINTS: ${(raw as { action?: string }).action} 条目 ${i + 1} passed=false 缺非空 reworkHints（variant 规则同窗前的旧记录）; deferred`,
            );
            continue;
          }
          violations.push(
            `[rework-hints] 条目 ${i + 1} ${(raw as { action?: string }).action} passed=false 须带非空 reworkHints`,
          );
          continue;
        }
      }
      // D-5：身份/variant 族吸收判定同样走共享谓词（承接动作不变：
      // LEGACY_VARIANT 诊断 + 裁剪缺失 required 字段后按 legacy 行继续消费）。
      if (isLegacyAbsorbableEntry(raw, schemaResult.errorMessages)) {
        const missingFields = schemaResult.errorMessages
          .map((message) => message.match(/required property '([^']+)'/)?.[1])
          .filter((field): field is string => field !== undefined);
        const withoutIdentity = Object.fromEntries(
          Object.entries(raw as Record<string, unknown>).filter(([field]) => !missingFields.includes(field)),
        );
        valid.push(withoutIdentity as unknown as RunLogEntry);
        validOrigins.push(i);
        // variant 规则引入前形态（未声明 variant）的 emergency-fix：缺失的
        // variant/blocker（可能连同 identity 字段）以 LEGACY_VARIANT 明示；
        // identity 缺失部分随后由 LEGACY_UNSCOPED 循环补充说明。
        if (
          isUndeclaredVariantEmergencyFix(raw) &&
          (missingFields.includes('variant') || missingFields.includes('blocker'))
        ) {
          diagnostics.push(
            `LEGACY_VARIANT: emergency-fix 条目 ${i + 1} 缺 required ${missingFields.join(', ')}（variant 规则引入前的旧记录）; deferred`,
          );
        }
        continue;
      }
      // schema 拒绝：记录 [schema] 前缀违规并跳过该条
      for (const m of schemaResult.errorMessages) {
        violations.push(`条目 ${i + 1} [schema] ${m}`);
      }
      continue;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      violations.push(`条目 ${i + 1} 非对象，已跳过`);
      continue;
    }
    const e = raw as Partial<RunLogEntry>;
    const missing: string[] = [];
    if (typeof e.runId !== 'string') missing.push('runId');
    if (typeof e.timestamp !== 'string') missing.push('timestamp');
    if (typeof e.phase !== 'number') missing.push('phase');
    if (typeof e.action !== 'string') missing.push('action');
    if (typeof e.outcome !== 'string') missing.push('outcome');
    if (missing.length > 0) {
      violations.push(`条目 ${i + 1} 缺字段 ${missing.join(', ')}`);
      continue;
    }
    valid.push(e as RunLogEntry);
    validOrigins.push(i);
  }

  // Missing lifecycle identity is observable and deferred, never inferred from
  // neighboring rows. This preserves legacy raw records while making their
  // scope limitation explicit to both logic and CLI consumers.
  for (const entry of valid) {
    if (!['rootcause', 'review', 'gate', 'fix', 'emergency-fix', ...R3_ACTIONS].includes(entry.action)) continue;
    const missing = entryIdentityMissingFields(entry);
    if (missing.length > 0) {
      diagnostics.push(
        `LEGACY_UNSCOPED: ${entry.action} ${entry.runId} identity missing ${missing.join(', ')}; deferred`,
      );
    }
  }

  // action-role 配对强制（审计修复 task 3）：对每条 schema-valid 记录，
  // action∈{r3-*} 须 role=R；{fix,emergency-fix,produce} 须 role=S；{review} 须
  // role=V；{gate,tla-gate,graph-gate} 须 role=G。违反即 blocking（含 runId/action/role）。
  for (const e of valid) {
    const requiredRole = ACTION_ROLE_PAIRING[e.action];
    if (requiredRole !== undefined && e.role !== requiredRole) {
      violations.push(
        `action-role 配对：条目 runId=${e.runId} action=${e.action} 要求 role=${requiredRole}，实际 role=${e.role}`,
      );
    }
  }

  // R1 阶段动作完整性
  // "已完成阶段"定义：该阶段有 action=checkpoint 且 outcome=success 的记录。
  // 对每个已完成阶段，按阶段分档检查动作完整性：
  //   阶段 1-4：chunk / cross / gate(类) / checkpoint
  //   阶段 5-8：produce / review / gate(类) / checkpoint
  const completedPhases = new Set<number>();
  for (const e of valid) {
    if (e.action === 'checkpoint' && e.outcome === 'success') {
      completedPhases.add(e.phase);
    }
  }
  for (const phase of completedPhases) {
    const phaseEntries = valid.filter((e) => e.phase === phase);
    const actions = new Set(phaseEntries.map((e) => e.action));
    const hasGate = actions.has('gate') || actions.has('tla-gate') || actions.has('graph-gate');
    const hasCheckpoint = actions.has('checkpoint');
    if (phase >= 1 && phase <= 4) {
      if (!actions.has('chunk')) violations.push(`R1: 阶段 ${phase} 缺 chunk 动作`);
      if (!actions.has('cross')) violations.push(`R1: 阶段 ${phase} 缺 cross 动作`);
    } else {
      if (!actions.has('produce')) violations.push(`R1: 阶段 ${phase} 缺 produce 动作`);
      if (!actions.has('review')) violations.push(`R1: 阶段 ${phase} 缺 review 动作`);
    }
    if (!hasGate) violations.push(`R1: 阶段 ${phase} 缺 gate 类动作`);
    if (!hasCheckpoint) violations.push(`R1: 阶段 ${phase} 缺 checkpoint 动作`);
  }

  // R1 扩展：rootcause/fix 动作字段完整性（spec §7.5）
  for (const e of valid) {
    if (e.action === 'rootcause') {
      if (!isNonEmptyString(e.reportId)) violations.push(`R1: rootcause 动作 ${e.runId} 须含 reportId`);
      if (!isNonEmptyString(e.rootCauseCategory))
        violations.push(`R1: rootcause 动作 ${e.runId} 须含 rootCauseCategory`);
      if (typeof e.upstreamDefect !== 'boolean')
        violations.push(`R1: rootcause 动作 ${e.runId} 须含 upstreamDefect(boolean)`);
      if (typeof e.rollbackRecommended !== 'boolean')
        violations.push(`R1: rootcause 动作 ${e.runId} 须含 rollbackRecommended(boolean)`);
    }
    if (['fix', 'emergency-fix'].includes(e.action)) {
      if (!isNonEmptyString(e.basedOnReport)) violations.push(`R1: ${e.action} 动作 ${e.runId} 须含 basedOnReport`);
      if (!Array.isArray(e.artifacts) || e.artifacts.length === 0)
        violations.push(`R1: ${e.action} 动作 ${e.runId} 须含 artifacts(非空数组)`);
    }
  }

  // R2 tokens 非负
  for (const e of valid) {
    if (typeof e.tokens === 'number' && e.tokens < 0) {
      violations.push(`R2: 条目 ${e.runId ?? '?'} tokens 为负: ${e.tokens}`);
    }
    // checkpoint success 须 tokens > 0（除非 note 标注首次/L0）
    // L0 首次或 note 含 "首次" 可豁免——简化：仅当 note 不含 "首次" 时报
    if (e.action === 'checkpoint' && e.outcome === 'success' && typeof e.tokens === 'number' && e.tokens === 0) {
      if (!e.note || !e.note.includes('首次')) {
        violations.push(`R2: 条目 ${e.runId ?? '?'} checkpoint success 但 tokens=0`);
      }
    }
  }

  // R3 返工记录一致性（可选校验：仅当 tlaCheckRounds 提供时执行）
  // 按 phase 过滤 + 仅统计 target/note 含 TLA 的返工，与 tla-manifest checkRounds 语义对齐
  if (options?.tlaCheckRounds !== undefined) {
    let reworkEntries = valid.filter((e) => e.action === 'rework');
    if (options.phase !== undefined) {
      reworkEntries = reworkEntries.filter((e) => e.phase === options.phase);
    }
    const tlaReworkCount = reworkEntries.filter(
      (e) => (e.note && /TLA/i.test(e.note)) || (e.target && /TLA/i.test(e.target)),
    ).length;
    if (tlaReworkCount !== options.tlaCheckRounds) {
      violations.push(
        `R3: run-log TLA rework 记录数 ${tlaReworkCount} 与 tla-manifest.checkRounds ${options.tlaCheckRounds} 不一致`,
      );
    }
  }

  // R3 扩展：rootcause/fix 只按 action-specific lifecycle projection 关联。
  const rootcauseActions = valid.filter((e) => e.action === 'rootcause');
  const fixActions = valid.filter((e) => S_VARIANTS.includes(e.action) && e.action !== 'produce');
  const rootcauseReviews = valid.filter((e) => e.action === 'review' && e.role === 'V' && e.targetKind === 'rootcause');
  const rootcauseReports = new Map<string, RunLogEntry>();

  for (const rootcause of rootcauseActions) {
    const identity = lifecycleIdentity(rootcause);
    if (!completeRootcauseIdentity(identity)) {
      diagnostics.push(
        `LEGACY_UNSCOPED: rootcause ${rootcause.runId} identity missing ${entryIdentityMissingFields(rootcause).join(', ') || 'unknown'}; deferred`,
      );
      continue;
    }
    const key = lifecycleKey(identity);
    if (!rootcauseReports.has(key)) rootcauseReports.set(key, rootcause);
  }

  const reportStatus = new Map<
    string,
    {
      hasReview: boolean;
      hasGate: boolean;
      hasFix: boolean;
      hasDeferredFix: boolean;
    }
  >();
  const strictLifecycleScopes = new Set(
    [...rootcauseReports.values()]
      .map(lifecycleIdentity)
      .filter((identity) => identity.phase === 8 && completeRootcauseIdentity(identity))
      .map(lifecycleScopeKey),
  );
  /** Strictness belongs to one complete phase/round/report segment, never to a phase bucket. */
  const isStrictLifecycleEntry = (entry: RunLogEntry): boolean => {
    if (entry.phase !== 8) return false;
    const identity = lifecycleIdentity(entry);
    const isRootcauseEvidence =
      entry.action === 'rootcause' ||
      (entry.action === 'review' && entry.targetKind === 'rootcause') ||
      (entry.action === 'gate' && entry.script === 'check-rootcause-report.ts');
    if (isRootcauseEvidence) {
      return completeRootcauseIdentity(identity) && strictLifecycleScopes.has(lifecycleScopeKey(identity));
    }
    return completeImplementationIdentity(entry) && strictLifecycleScopes.has(entryScopeKey(entry));
  };
  const isPhase8IdentityIncomplete = (entry: RunLogEntry): boolean =>
    entry.phase === 8 &&
    ['rootcause', 'review', 'gate', 'fix', 'emergency-fix', ...R3_ACTIONS].includes(entry.action) &&
    entryIdentityMissingFields(entry).length > 0;

  for (const [key, rootcause] of rootcauseReports) {
    const identity = lifecycleIdentity(rootcause);
    const strictRootcause = strictLifecycleScopes.has(lifecycleScopeKey(identity));
    const sameRootcause = (entry: RunLogEntry): boolean => {
      const candidate = lifecycleIdentity(entry);
      return (
        completeRootcauseIdentity(candidate) &&
        candidate.phase === identity.phase &&
        candidate.round === identity.round &&
        candidate.reportId === identity.reportId &&
        entry.target === identity.reportId &&
        (!strictRootcause || entry.basedOnReport === identity.reportId)
      );
    };
    const hasReview = valid.some(
      (entry) => hasPassedReview(entry) && entry.targetKind === 'rootcause' && sameRootcause(entry),
    );
    const hasGate = valid.some(
      (entry) =>
        hasPassedGate(entry) &&
        entry.action === 'gate' &&
        entry.script === 'check-rootcause-report.ts' &&
        sameRootcause(entry),
    );
    const exactFixes = fixActions.filter((entry) => {
      const candidate = lifecycleIdentity(entry);
      return (
        hasExactFixEvidence(entry) &&
        candidate.phase === identity.phase &&
        candidate.round === identity.round &&
        candidate.reportId === identity.reportId &&
        candidate.basedOnReport === identity.reportId
      );
    });
    const legacyFixes = fixActions.filter((entry) => {
      const candidate = lifecycleIdentity(entry);
      return (
        isSuccessfulFix(entry) &&
        !completeImplementationIdentity(entry) &&
        candidate.phase === identity.phase &&
        candidate.round === identity.round &&
        candidate.basedOnReport === identity.reportId
      );
    });
    // Legacy rows are diagnostic-only for every lifecycle. They never provide
    // R3/V/G/R7/R8 credit, even when no strict phase-8 report exists.
    const hasFix = exactFixes.length > 0;
    const hasDeferredFix = legacyFixes.length > 0;
    reportStatus.set(key, { hasReview, hasGate, hasFix, hasDeferredFix });

    if (strictRootcause && hasReview && hasGate && !hasFix && !hasDeferredFix) {
      violations.push(
        `R3: ${identity.reportId} open-approved-lifecycle：同身份 V/G 已通过但缺 exact basedOnReport fix`,
      );
    } else if (!hasReview || !hasGate) {
      diagnostics.push(
        `pending-pre-approval: ${identity.reportId} 同身份 V/G 未全部通过，缺 exact fix 暂不分类为 open-approved-lifecycle`,
      );
    }
  }

  // Legacy compatibility is explicitly phase<8. A phase-8 entry with an
  // incomplete identity is diagnostic-only and must never enter this aggregate,
  // while complete phase-8 rootcause segments are handled by exact predicates.
  const legacyRootcauses = rootcauseActions.filter((rootcause) => rootcause.phase < 8);
  const legacyReportsByPhase = new Map<number, Set<string>>();
  for (const rootcause of legacyRootcauses) {
    if (!isNonEmptyString(rootcause.reportId)) continue;
    if (!legacyReportsByPhase.has(rootcause.phase)) legacyReportsByPhase.set(rootcause.phase, new Set());
    legacyReportsByPhase.get(rootcause.phase)!.add(rootcause.reportId);
  }
  for (const [legacyPhase, reportIds] of legacyReportsByPhase) {
    const coveredReportIds = new Set<string>();
    // D-2：扫全量 valid 而非 fixActions——V 重发记录是 review 条目，不在 fixActions 内；
    // isSuccessfulRepair 同时接受 S-fix 与 V 重发（review + role=V + basedOnReport + V 自有 artifacts）。
    for (const f of valid) {
      if (f.phase !== legacyPhase || !isSuccessfulRepair(f) || !isNonEmptyString(f.basedOnReport)) continue;
      for (const rid of f.basedOnReport.split(/[;,]\s*/)) if (rid.trim()) coveredReportIds.add(rid.trim());
    }
    for (const rid of reportIds) {
      if (!coveredReportIds.has(rid))
        violations.push(`R3: rootcause 报告 ${rid} 无对应 fix 记录（basedOnReport 缺失）`);
    }
    const reviewedReportIds = new Set(
      rootcauseReviews
        .filter((review) => review.phase === legacyPhase && reportIds.has(review.target ?? ''))
        .map((r) => r.target)
        .filter((target): target is string => isNonEmptyString(target)),
    );
    if (reviewedReportIds.size !== reportIds.size) {
      violations.push(
        `R3: V 复审 rootcause 记录数(${reviewedReportIds.size}) ≠ R 记录数(${reportIds.size})，每份 R 报告须有 V 复审`,
      );
    }
  }

  // R3 预防审查：严格模式只在 fix → 同身份 implementation V 窗口内计数。
  // Legacy entries remain phase/action compatible but are explicitly deferred.
  const phaseEntries = new Map<number, Array<{ entry: RunLogEntry; index: number }>>();
  valid.forEach((entry, index) => {
    if (!phaseEntries.has(entry.phase)) phaseEntries.set(entry.phase, []);
    phaseEntries.get(entry.phase)!.push({ entry, index });
  });

  for (const [phase, entryList] of phaseEntries) {
    for (let i = 0; i < entryList.length; i++) {
      const fixSegment = entryList.at(i);
      if (!fixSegment || fixSegment.entry.role !== 'S' || !['fix', 'emergency-fix'].includes(fixSegment.entry.action))
        continue;
      const fixIdentity = lifecycleIdentity(fixSegment.entry);
      const strictForFix = isStrictLifecycleEntry(fixSegment.entry);
      if (!isSuccessfulFix(fixSegment.entry)) {
        diagnostics.push(
          `NON_CREDIT_FIX: ${fixSegment.entry.action} ${fixSegment.entry.runId} outcome=${fixSegment.entry.outcome}; credit deferred`,
        );
        continue;
      }
      const legacyPhase8 = phase === 8 && !strictForFix;
      if (legacyPhase8) {
        diagnostics.push(
          `LEGACY_UNSCOPED: ${fixSegment.entry.action} ${fixSegment.entry.runId} R3/implementation credit deferred`,
        );
        continue;
      }
      let vIndex = -1;
      for (let j = i + 1; j < entryList.length; j++) {
        const candidate = entryList.at(j)!.entry;
        const candidateIdentity = lifecycleIdentity(candidate);
        const implementationReview = strictForFix
          ? completeImplementationIdentity(fixSegment.entry) &&
            hasExactImplementationReviewEvidence(candidate) &&
            sameIdentity(candidateIdentity, fixIdentity)
          : hasPassedReview(candidate) && candidate.action === 'review';
        if (implementationReview) {
          vIndex = j;
          break;
        }
        if (candidate.action === 'fix' || candidate.action === 'emergency-fix') {
          if (!strictForFix || sameIdentity(candidateIdentity, fixIdentity)) break;
        }
      }
      if (vIndex < 0) {
        if (strictForFix && completeImplementationIdentity(fixSegment.entry)) {
          violations.push(
            `R3 记录校验失败：阶段 ${phase} fix ${fixSegment.entry.runId} (${fixIdentity.basedOnReport}) 缺同身份 implementation V，R3 窗口未闭合`,
          );
        } else if (strictForFix) {
          diagnostics.push(
            `LEGACY_UNSCOPED: fix ${fixSegment.entry.runId} R3/implementation V identity missing ${identityMissingFields(fixIdentity).join(', ') || 'unknown'}; deferred`,
          );
        } else {
          violations.push(
            `R3 记录校验失败：阶段 ${phase} 的 S(${fixSegment.entry.action})→V 之间仅有 0 条 R3 记录，须有 3 条（completeness/reliability/security）`,
          );
        }
        continue;
      }
      const r3Records = entryList.slice(i + 1, vIndex).filter(({ entry }) => {
        const identity = lifecycleIdentity(entry);
        return strictForFix
          ? hasExactR3Evidence(entry) &&
              R3_DIMENSIONS.some((dimension) => entry.action.includes(dimension)) &&
              sameIdentity(identity, fixIdentity)
          : entry.role === 'R' &&
              entry.outcome === 'success' &&
              R3_ACTIONS.includes(entry.action) &&
              R3_DIMENSIONS.some((dimension) => entry.action.includes(dimension));
      });
      const dimensionCounts = new Map<string, number>();
      for (const { entry } of r3Records) {
        const dimension = R3_DIMENSIONS.find((candidate) => entry.action === `r3-${candidate}`);
        if (dimension) dimensionCounts.set(dimension, (dimensionCounts.get(dimension) ?? 0) + 1);
      }
      const invalidDimensions = R3_DIMENSIONS.filter((dimension) => dimensionCounts.get(dimension) !== 1);
      if (invalidDimensions.length > 0) {
        violations.push(
          strictForFix
            ? `R3 记录校验失败：阶段 ${phase} 的 fix ${fixSegment.entry.runId} (${fixIdentity.basedOnReport})→implementation V 之间 R3 维度不满足恰一条：${invalidDimensions.join(', ')}`
            : `R3 记录校验失败：阶段 ${phase} 的 S(${fixSegment.entry.action})→V 之间 R3 维度不满足恰一条：${invalidDimensions.join(', ')}`,
        );
      }
      if (strictForFix) {
        const nextFixIndex = entryList.findIndex(({ entry }, index) => {
          if (index <= i || entry.role !== 'S' || !['fix', 'emergency-fix'].includes(entry.action)) return false;
          return sameIdentity(lifecycleIdentity(entry), fixIdentity);
        });
        const terminalIndex = entryList.findIndex(
          ({ entry }, index) => index > i && entry.action === 'checkpoint' && entry.outcome === 'success',
        );
        const gateEnd = Math.min(
          nextFixIndex >= 0 ? nextFixIndex : entryList.length,
          terminalIndex >= 0 ? terminalIndex + 1 : entryList.length,
        );
        const implementationGate = entryList.slice(vIndex + 1, gateEnd).find(({ entry }) => {
          const candidateIdentity = lifecycleIdentity(entry);
          return hasExactImplementationGateEvidence(entry) && sameIdentity(candidateIdentity, fixIdentity);
        });
        if (!implementationGate) {
          violations.push(
            `R3 记录校验失败：阶段 ${phase} fix ${fixSegment.entry.runId} (${fixIdentity.basedOnReport}) 缺同身份 implementation G`,
          );
        }
      }
    }
  }

  // R4 acknowledgedDecisions 非空
  for (const e of valid) {
    if (e.action === 'checkpoint' && e.outcome === 'success') {
      if (!Array.isArray(e.acknowledgedDecisions) || e.acknowledgedDecisions.length === 0) {
        violations.push(
          `R4: 条目 ${e.runId ?? '?'} checkpoint success 但 acknowledgedDecisions 为空（O4 Comprehension Debt）`,
        );
      }
    }
  }

  // R5 O 越权检测（可选校验：仅当 gateLogs 提供时执行）
  // 扫描 gate-logs 内容，检测 O 是否绕过 A/S 子代理直接操作 .w-model/*.json
  // 注意：gateLogs Map 可能因 gateLogPath 匹配策略（basename + 绝对路径 + 相对路径）
  //       对同一文件存多 key，此处按 content 去重，避免对同一日志重复报告。
  if (options?.gateLogs) {
    const suspiciousPatterns = [
      /node\s+-e\s+/i, // node -e 直接执行
      /node\s+--eval\s+/i, // node --eval
      /writeFileSync\s*\(\s*['"].*\.w-model\//i, // writeFileSync('.w-model/...')
      /writeFile\s*\(\s*['"].*\.w-model\//i, // writeFile('.w-model/...')
    ];
    const scannedContents = new Set<string>();
    for (const [logPath, logData] of options.gateLogs) {
      if (scannedContents.has(logData.content)) continue;
      scannedContents.add(logData.content);
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(logData.content)) {
          violations.push(`R5: gate-log ${logPath} 检测到 O 直接操作 .w-model/ 模式: ${pattern.source}`);
        }
      }
    }
  }

  // R6 gateExitCode 回填检查：gateLogPath 存在但 gateExitCode 非 number → 始终报
  for (const e of valid) {
    if (e.gateLogPath && typeof e.gateExitCode !== 'number') {
      violations.push(`R6: 条目 ${e.runId ?? '?'} gateLogPath 已设但 gateExitCode 未回填`);
    }
  }

  // R6 exitCode 一致（可选校验：仅当 gateLogs 提供时执行）
  // 交叉校验 run-log 条目 gateExitCode 与 gate-log 存档 exitCode 一致（SSoT §10E 防伪造）
  if (options?.gateLogs) {
    for (const e of valid) {
      if (e.gateLogPath && typeof e.gateExitCode === 'number') {
        const logData = options.gateLogs.get(e.gateLogPath);
        if (!logData) {
          violations.push(`R6: 条目 ${e.runId ?? '?'} gateLogPath=${e.gateLogPath} 在 gate-logs 中未找到`);
        } else if (logData.exitCode === undefined) {
          violations.push(`R6: gate-log ${e.gateLogPath} 未提取到 exitCode`);
        } else if (e.gateExitCode !== logData.exitCode) {
          violations.push(
            `R6: 条目 ${e.runId ?? '?'} gateExitCode=${e.gateExitCode} 与 gate-log ${e.gateLogPath} exitCode=${logData.exitCode} 不一致`,
          );
        }
      }
    }
  }

  // R6 扩展：check-rootcause-report.ts gate 须有 exitCode（spec §7.6）
  const rootcauseGateActions = valid.filter((e) => e.action === 'gate' && e.script === 'check-rootcause-report.ts');
  for (const g of rootcauseGateActions) {
    if (typeof g.gateExitCode !== 'number' || g.gateExitCode === null) {
      violations.push(`R6: check-rootcause-report.ts gate 记录 ${g.runId} 缺 gateExitCode`);
    }
  }

  // R7 append-only（时间戳单调递增）
  let prevTimestamp: string | undefined;
  for (const e of valid) {
    if (typeof e.timestamp === 'string' && typeof prevTimestamp === 'string') {
      if (new Date(e.timestamp) < new Date(prevTimestamp)) {
        violations.push(
          `R7: 条目 ${e.runId ?? '?'} 时间戳 ${e.timestamp} 早于前一条 ${prevTimestamp}（非 append-only）`,
        );
      }
    }
    prevTimestamp = e.timestamp;
  }

  // R7 扩展（D-3a）：记录哈希链。
  // 时间戳单调只约束「相对顺序」，对既有行被就地改写（改 note / 改历史时间戳 / 删行 / 插行）不可见；
  // 链判定补上「记录内容 + 记录间链接」两个维度：
  //   1. link：第 i 条（i > 首个带哈希记录）的 prevRecordHash 必须等于第 i-1 条的 recordHash；
  //      首个带哈希记录的 prevRecordHash 必须为 ""（文件内无更早的带哈希记录）；
  //   2. content：逐条按定稿公式复算 recordHash（载荷含 prevRecordHash，故链字段自身篡改同样暴露）；
  //   3. 哈希段（首个带哈希记录起）之后不得出现无哈希记录（插入/就地删除 recordHash 的突变形态）；
  //   4. 首个带哈希记录之前的历史段（以及全无哈希的日志）只记非阻断 LEGACY 诊断——历史行不补链，
  //      禁止回溯补哈希；该段的改写超出现有证据能力（Task 8 的 checkpoint 锚负责收口）。
  // 断链/内容不符/哈希段缺哈希一律 blocking（文案含 R7 + runId）。
  const chainHashFn = options?.hashFn ?? sha256Hex;
  const firstHashedIndex = valid.findIndex((e) => recordHashOf(e) !== undefined);
  if (firstHashedIndex < 0) {
    diagnostics.push(`R7: 历史段 ${valid.length} 条无哈希（LEGACY，未参与链校验）`);
  } else {
    if (firstHashedIndex > 0) {
      diagnostics.push(`R7: 历史段 ${firstHashedIndex} 条无哈希（LEGACY，未参与链校验）`);
    }
    for (let index = firstHashedIndex; index < valid.length; index++) {
      // eslint-disable-next-line security/detect-object-injection -- index 为本地数组下界循环计数（非外部输入），数组为同函数内的 valid 记录列表
      const entry = valid[index]!;
      const ownHash = recordHashOf(entry);
      if (ownHash === undefined) {
        violations.push(
          `R7: 哈希链断裂：条目 ${entry.runId ?? '?'} 无 recordHash（哈希段之后不得出现未入链记录；就地删除 recordHash 亦命中）`,
        );
        continue;
      }
      const predecessor = index > firstHashedIndex ? valid[index - 1] : undefined;
      const expectedPrev = predecessor === undefined ? '' : recordHashOf(predecessor);
      if (entry.prevRecordHash !== undefined && typeof entry.prevRecordHash !== 'string') {
        violations.push(`R7: 哈希链断裂：条目 ${entry.runId ?? '?'} 的 prevRecordHash 不是字符串（链字段形态非法）`);
      } else if (expectedPrev !== undefined && entry.prevRecordHash !== expectedPrev) {
        violations.push(
          `R7: 哈希链断裂：条目 ${entry.runId ?? '?'} 的 prevRecordHash=${String(entry.prevRecordHash)} ` +
            `与前一条 recordHash=${expectedPrev} 不符（链被重排/删除/插入）`,
        );
      }
      const recomputed = computeRecordHash(
        entry as unknown as Record<string, unknown>,
        typeof entry.prevRecordHash === 'string' ? entry.prevRecordHash : '',
        chainHashFn,
      );
      if (recomputed !== ownHash) {
        violations.push(
          `R7: 哈希链断裂：条目 ${entry.runId ?? '?'} 记录内容与 recordHash 不符（记录被就地改写或链字段被篡改）`,
        );
      }
    }
  }

  // R7 扩展（D-3b）：checkpoint 放行锚（外部锚，第三段）。
  //
  // 为什么需要第三段：哈希链（D-3a）只保护链自身——把握「整链重算」能力者把放行前的历史行整体
  // 重排 + 时间戳重对齐后重算全部 recordHash，链判定完全自洽（真实调测盲区）；尾删同样不可见。
  // 放行锚把「放行时刻的历史前缀」钉死为外部锚（定义见 RunLogAnchor / computeRunLogAnchor）：
  //   prefix = 文件序下 timestamp ≤ 锚记录 timestamp 的全部记录（不含锚自身所在记录）
  //   lines  = 前缀记录条数；sha256 = 前缀各行原始字节以单个 "\n" 连接（末尾不加换行）的 SHA-256
  // 校验：按同法重算并比对——不符即 blocking（文案含 R7 + runLogAnchor/放行锚 + runId）。锚字段
  // 缺席 = 非阻断（历史记录 LEGACY：本机制引入前写入的放行记录不补锚，禁止回溯补锚）。
  // sha256 维度需要**原始行文本**（logic 层零 fs → 由调用方注入 options.runLogRawLines，与 entries
  // 同序同长）；未注入时只校验 lines 并记非阻断诊断（绝不假装验过 sha256）。
  {
    const rawLines = options?.runLogRawLines;
    const rawLinesAligned = Array.isArray(rawLines) && rawLines.length === entries.length;
    for (let index = 0; index < valid.length; index++) {
      // eslint-disable-next-line security/detect-object-injection -- index 为本地数组下界循环计数（非外部输入），数组为同函数内的有效记录列表
      const entry = valid[index]!;
      const anchorValue = (entry as unknown as Record<string, unknown>).runLogAnchor;
      if (anchorValue === undefined) continue; // LEGACY：缺席非阻断（不回溯补锚）
      const anchorRunId = entry.runId ?? '?';
      if (!isWellFormedRunLogAnchor(anchorValue)) {
        violations.push(
          `R7: 放行锚形态非法：条目 ${anchorRunId} 的 runLogAnchor 须为 { lines: 非负整数, sha256: 64 位小写 hex }`,
        );
        continue;
      }
      const anchorMs = Date.parse(String(entry.timestamp));
      if (!Number.isFinite(anchorMs)) {
        violations.push(
          `R7: 放行锚不可核验：条目 ${anchorRunId} 的 timestamp 不可解析，无法重算放行时刻前缀（fail-closed）`,
        );
        continue;
      }
      // eslint-disable-next-line security/detect-object-injection -- index 与 validOrigins 同步推进的本地下标（非外部输入），数组为本函数内构造的原始下标列表
      const anchorOrigin = validOrigins[index]!;
      const prefixIndexes: number[] = [];
      for (let i = 0; i < entries.length; i++) {
        if (i === anchorOrigin) continue;
        // eslint-disable-next-line security/detect-object-injection -- i 为本地数组下界循环计数（非外部输入），数组为同函数内的 run-log 入参数组
        const candidate = entries[i];
        if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) continue;
        const candidateMs = Date.parse(String((candidate as { timestamp?: unknown }).timestamp ?? ''));
        if (!Number.isFinite(candidateMs) || candidateMs > anchorMs) continue;
        prefixIndexes.push(i);
      }
      if (anchorValue.lines !== prefixIndexes.length) {
        violations.push(
          `R7: 放行记录 ${anchorRunId} 的 runLogAnchor 与当前历史前缀不符（放行后被改写/重排）：` +
            `lines=${anchorValue.lines} ≠ 当前前缀记录数 ${prefixIndexes.length}`,
        );
      }
      if (rawLinesAligned) {
        const recomputed = anchorDigestOf(
          // eslint-disable-next-line security/detect-object-injection -- i 为前缀下标（本地数值数组），rawLines 与 entries 同序同长（已断言对齐）
          prefixIndexes.map((i) => rawLines![i] ?? ''),
          options?.hashFn ?? sha256Hex,
        );
        if (recomputed !== anchorValue.sha256) {
          violations.push(
            `R7: 放行记录 ${anchorRunId} 的 runLogAnchor 与当前历史前缀不符（放行后被改写/重排）：` +
              `sha256=${anchorValue.sha256} ≠ 当前前缀原始字节摘要 ${recomputed}`,
          );
        }
      } else {
        diagnostics.push(
          `R7: 条目 ${anchorRunId} 的 runLogAnchor.sha256 未校验（调用方未注入 runLogRawLines 原始行文本，仅校验 lines）`,
        );
      }
    }
  }

  // R7 扩展：返工路径按同身份 segment 检查，禁止跨 report/targetKind 借动作。
  const checkedRootcauseSegments = new Set<string>();
  for (let i = 0; i < valid.length; i++) {
    const curEntry = valid[i];
    if (!curEntry || curEntry.action !== 'rootcause') continue;
    const rootIdentity = lifecycleIdentity(curEntry);
    const strictForRoot = strictLifecycleScopes.has(lifecycleScopeKey(rootIdentity));
    if (strictForRoot && completeRootcauseIdentity(rootIdentity)) {
      const segmentKey = lifecycleKey(rootIdentity);
      if (checkedRootcauseSegments.has(segmentKey)) continue;
      checkedRootcauseSegments.add(segmentKey);
    }
    if (strictForRoot && completeRootcauseIdentity(rootIdentity)) {
      const rootReviewIndex = valid.findIndex(
        (candidate, index) =>
          index > i &&
          hasPassedReview(candidate) &&
          candidate.targetKind === 'rootcause' &&
          lifecycleIdentity(candidate).phase === rootIdentity.phase &&
          lifecycleIdentity(candidate).round === rootIdentity.round &&
          lifecycleIdentity(candidate).reportId === rootIdentity.reportId &&
          candidate.target === rootIdentity.reportId &&
          candidate.basedOnReport === rootIdentity.reportId,
      );
      if (rootReviewIndex < 0) {
        diagnostics.push(
          `pending-pre-approval: rootcause ${curEntry.reportId} 同身份缺 review(targetKind=rootcause)，不判定为 exact-fix omission`,
        );
        continue;
      }
      const fixIndex = valid.findIndex((candidate, index) => {
        if (index <= rootReviewIndex || !['fix', 'emergency-fix'].includes(candidate.action)) return false;
        const fixIdentity = lifecycleIdentity(candidate);
        return (
          hasExactFixEvidence(candidate) &&
          fixIdentity.phase === rootIdentity.phase &&
          fixIdentity.round === rootIdentity.round &&
          fixIdentity.reportId === rootIdentity.reportId &&
          fixIdentity.basedOnReport === rootIdentity.reportId
        );
      });
      if (fixIndex < 0) {
        const hasNonExactFix = valid.slice(rootReviewIndex + 1).some((candidate) => {
          if (!['fix', 'emergency-fix'].includes(candidate.action)) return false;
          const candidateIdentity = lifecycleIdentity(candidate);
          return (
            candidateIdentity.phase === rootIdentity.phase &&
            candidateIdentity.round === rootIdentity.round &&
            (candidateIdentity.reportId !== rootIdentity.reportId ||
              candidateIdentity.basedOnReport !== rootIdentity.reportId ||
              candidate.target !== candidateIdentity.implementationTarget ||
              !Array.isArray(candidate.artifacts) ||
              !candidate.artifacts.includes(candidateIdentity.implementationTarget ?? ''))
          );
        });
        const hasDeferredFix = valid.slice(rootReviewIndex + 1).some((candidate) => {
          if (!['fix', 'emergency-fix'].includes(candidate.action)) return false;
          const candidateIdentity = lifecycleIdentity(candidate);
          return (
            candidateIdentity.phase === rootIdentity.phase &&
            candidateIdentity.round === rootIdentity.round &&
            candidateIdentity.basedOnReport === rootIdentity.reportId &&
            !completeImplementationIdentity(candidate)
          );
        });
        if (hasDeferredFix) {
          diagnostics.push(`LEGACY_UNSCOPED: rootcause ${curEntry.reportId} exact fix identity incomplete; deferred`);
        } else if (hasNonExactFix) {
          violations.push(`R7: rootcause ${curEntry.reportId} exact fix target/artifacts/reportId relation mismatch`);
        } else {
          violations.push(`R7: rootcause ${curEntry.reportId} 同身份缺 exact basedOnReport fix`);
        }
      }
      continue;
    }

    // Legacy path retains its original targetKind-aware ordering semantics.
    let j = i + 1;
    while (j < valid.length && !(valid[j]?.action === 'review' && valid[j]?.targetKind === 'rootcause')) j++;
    if (j >= valid.length) {
      violations.push(`R7: rootcause 记录 ${curEntry.runId} 后须有 review(targetKind=rootcause)`);
      continue;
    }
    // D-2：V 重发记录（review + role=V + basedOnReport + V 自有 artifacts）同样视为修复证据。
    const successfulFix = valid.slice(j + 1).find(isSuccessfulRepair);
    if (!successfulFix) violations.push(`R7: rootcause 记录 ${curEntry.runId} 后须有 successful fix 记录`);
  }

  // R8 轨迹模板校验（agentic Ch19 轨迹符合性）
  // 理想阶段轨迹：S 变体(produce/fix/emergency-fix) → R3×3 → V(review) → G(gate 类) → checkpoint(阶段最后)。
  // R8 校验「轨迹正确」（R7 仅「时序正确」）：偏离理想动作序列即违规。
  const GATE_ACTIONS = new Set(['gate', 'tla-gate', 'graph-gate']);
  for (const phase of completedPhases) {
    const phaseEntries = valid.filter((e) => e.phase === phase);
    const checkpointIndexes = phaseEntries
      .map((e, i) => (e.action === 'checkpoint' && e.outcome === 'success' ? i : -1))
      .filter((i) => i >= 0);
    const lastCheckpoint = checkpointIndexes.length > 0 ? checkpointIndexes[checkpointIndexes.length - 1]! : -1;

    // R8-1: checkpoint 必须是该阶段最后一条记录（阶段结束后再无后续动作）
    if (lastCheckpoint >= 0 && lastCheckpoint !== phaseEntries.length - 1) {
      violations.push(
        `R8: 阶段 ${phase} checkpoint 非阶段最后记录（checkpoint 之后仍有 ${phaseEntries.length - 1 - lastCheckpoint} 条动作，理想轨迹中 checkpoint 为阶段终点）`,
      );
    }

    // R8-2: gate 类动作必须出现在最后一个 checkpoint 之前
    for (let i = 0; i < phaseEntries.length; i++) {
      const entry = phaseEntries[i];
      if (entry && GATE_ACTIONS.has(entry.action) && lastCheckpoint >= 0 && i > lastCheckpoint) {
        violations.push(
          `R8: 阶段 ${phase} gate 动作(${entry.action})出现在 checkpoint 之后，理想轨迹中 gate 先于 checkpoint`,
        );
      }
    }
  }

  // R8-3: V(review) 失败后不得直接 S 变体——须先 rootcause（反模式 #18 轨迹检测）
  // 独立于 completedPhases 遍历所有阶段：反模式 #18 是行为级违规，
  // 未完成阶段（尚无 checkpoint success）同样禁止 V 失败后跳过 R 直接 S 返工。
  const r8PhaseGroups = new Map<number, RunLogEntry[]>();
  for (const e of valid) {
    if (!r8PhaseGroups.has(e.phase)) r8PhaseGroups.set(e.phase, []);
    r8PhaseGroups.get(e.phase)!.push(e);
  }
  for (const [, phaseEntries] of r8PhaseGroups) {
    for (let i = 0; i < phaseEntries.length; i++) {
      const entry = phaseEntries[i];
      if (!entry || entry.action !== 'review' || entry.outcome !== 'fail') continue;
      // Phase-8 incomplete identity is diagnostic-only: it must not consume
      // legacy R8-3 credit or create a cross-segment violation.
      if (isPhase8IdentityIncomplete(entry)) continue;
      const failedIdentity = lifecycleIdentity(entry);
      const strictReview = entry.phase === 8 && completeImplementationIdentity(entry);
      for (let j = i + 1; j < phaseEntries.length; j++) {
        const next = phaseEntries[j];
        if (!next) continue;
        if (next.action === 'rootcause') {
          const rootIdentity = lifecycleIdentity(next);
          const sameSegmentRootcause = strictReview
            ? completeRootcauseIdentity(rootIdentity) &&
              rootIdentity.phase === failedIdentity.phase &&
              rootIdentity.round === failedIdentity.round &&
              rootIdentity.reportId === failedIdentity.reportId &&
              failedIdentity.basedOnReport === rootIdentity.reportId
            : true;
          if (sameSegmentRootcause) break; // 正确路径：同 segment 先 R 再 S-fix
          continue;
        }
        if (S_VARIANTS.includes(next.action)) {
          violations.push(
            `R8: 阶段 ${entry.phase} V(review) 失败(${entry.runId})后直接 S(${next.action})(${next.runId})，理想轨迹须先同身份 rootcause 再 S-fix（反模式 #18）`,
          );
          break;
        }
        if (next.action === 'checkpoint' && next.outcome === 'success') break; // 阶段结束，不再追溯
      }
    }
  }

  // R8-4：严格生命周期按每个 fix 的独立窗口校验。窗口在下一 fix 或
  // 第一个成功 checkpoint（terminal event）处结束，后续记录不能掩盖前段顺序。
  if (strictLifecycleScopes.size > 0) {
    for (const [phase, phaseEntryList] of phaseEntries) {
      for (let start = 0; start < phaseEntryList.length; start++) {
        const startEntry = phaseEntryList.at(start)!.entry;
        if (startEntry.role !== 'S' || !['fix', 'emergency-fix'].includes(startEntry.action)) continue;
        if (!isStrictLifecycleEntry(startEntry) || !isSuccessfulFix(startEntry)) continue;
        if (!completeImplementationIdentity(startEntry)) continue;
        const identity = lifecycleIdentity(startEntry);
        const nextFix = phaseEntryList.findIndex(
          ({ entry }, index) => index > start && entry.role === 'S' && ['fix', 'emergency-fix'].includes(entry.action),
        );
        const terminal = phaseEntryList.findIndex(
          ({ entry }, index) => index > start && entry.action === 'checkpoint' && entry.outcome === 'success',
        );
        const boundaries = [phaseEntryList.length];
        if (nextFix >= 0) boundaries.push(nextFix);
        if (terminal >= 0) boundaries.push(terminal + 1);
        const windowEnd = Math.min(...boundaries);
        const window = phaseEntryList.slice(start, windowEnd);
        const exactEntry = (entry: RunLogEntry): boolean => sameIdentity(lifecycleIdentity(entry), identity);
        const firstIndex = (pred: (e: RunLogEntry) => boolean): number => window.findIndex(({ entry }) => pred(entry));
        const chain: Array<[string, number]> = [
          ['S(fix|emergency-fix)', 0],
          [
            'R3(r3-completeness|r3-reliability|r3-security)',
            firstIndex((entry) => exactEntry(entry) && hasExactR3Evidence(entry)),
          ],
          [
            'V(implementation review)',
            firstIndex((entry) => exactEntry(entry) && hasExactImplementationReviewEvidence(entry)),
          ],
          [
            'G(implementation gate)',
            firstIndex(
              (entry) =>
                exactEntry(entry) && GATE_ACTIONS.has(entry.action) && hasExactImplementationGateEvidence(entry),
            ),
          ],
          ['checkpoint', firstIndex((entry) => entry.action === 'checkpoint' && entry.outcome === 'success')],
        ];
        const [, r3Index] = chain[1]!;
        const [, reviewIndex] = chain[2]!;
        const [, gateIndex] = chain[3]!;
        if (gateIndex >= 0 && reviewIndex < 0) {
          violations.push(
            `R8: 阶段 ${phase} identity segment ${identity.reportId} fix ${startEntry.runId} 在窗口内先出现 implementation G，但缺同窗口 implementation V；后续 fix/terminal event 不得回填前段`,
          );
        }
        if (reviewIndex >= 0 && r3Index < 0) {
          violations.push(
            `R8: 阶段 ${phase} identity segment ${identity.reportId} fix ${startEntry.runId} 在窗口内出现 implementation V，但缺同窗口 R3`,
          );
        }
        for (let a = 0; a < chain.length - 1; a++) {
          for (let b = a + 1; b < chain.length; b++) {
            const [nameA, idxA] = chain[a]!;
            const [nameB, idxB] = chain[b]!;
            if (idxA >= 0 && idxB >= 0 && idxA > idxB) {
              violations.push(
                `R8: 阶段 ${phase} identity segment ${identity.reportId} fix ${startEntry.runId} 轨迹顺序倒置：${nameA}(第 ${idxA + 1} 条) 晚于 ${nameB}(第 ${idxB + 1} 条)，窗口须按 S → R3 → V → G → checkpoint 独立闭合`,
              );
            }
          }
        }
      }
    }
  }
  {
    const legacyR3Actions = ['r3-completeness', 'r3-reliability', 'r3-security'];
    for (const [, allPhaseEntries] of r8PhaseGroups) {
      // Never let one strict phase-8 segment suppress an unrelated legacy
      // segment. Incomplete phase-8 identity rows stay diagnostic-only and
      // therefore do not become legacy R8 credit or chain heads.
      const phaseEntries =
        allPhaseEntries[0]?.phase === 8
          ? allPhaseEntries.filter((entry) => !isStrictLifecycleEntry(entry) && !isPhase8IdentityIncomplete(entry))
          : allPhaseEntries;
      if (phaseEntries.length === 0) continue;
      const firstIndex = (pred: (e: RunLogEntry) => boolean): number => phaseEntries.findIndex(pred);
      const lastIndex = (pred: (e: RunLogEntry) => boolean): number => {
        for (let i = phaseEntries.length - 1; i >= 0; i--) if (pred(phaseEntries.at(i)!)) return i;
        return -1;
      };
      const phaseNo = phaseEntries[0]?.phase;
      const chain: Array<[string, number]> = [
        ['S(produce|fix|emergency-fix)', firstIndex((e) => e.action === 'produce' || isSuccessfulFix(e))],
        ['R3(r3-completeness|r3-reliability|r3-security)', firstIndex((e) => legacyR3Actions.includes(e.action))],
        ['V(review)', firstIndex((e) => e.action === 'review')],
        ['G(gate 类)', lastIndex((e) => GATE_ACTIONS.has(e.action))],
        ['checkpoint', lastIndex((e) => e.action === 'checkpoint' && e.outcome === 'success')],
      ];
      for (let a = 0; a < chain.length - 1; a++) {
        for (let b = a + 1; b < chain.length; b++) {
          const [nameA, idxA] = chain[a]!;
          const [nameB, idxB] = chain[b]!;
          if (idxA >= 0 && idxB >= 0 && idxA > idxB) {
            violations.push(
              `R8: 阶段 ${phaseNo} 轨迹顺序倒置：${nameA}(第 ${idxA + 1} 条) 晚于 ${nameB}(第 ${idxB + 1} 条)，理想链为 S → R3 → V → G → checkpoint（修法：按链序补录缺失动作或用 /wm 修正轨迹后重跑门禁）`,
            );
          }
        }
      }
    }
  }

  // R9: 跨轮次评审一致性（A-3d 标准偏移检测）。
  //
  // 同一产物在不同轮次被同一评审标准判出差异显著的等级（≥2 档，如 A→C）意味着
  // 评审标准发生实质漂移——1 档差异可能合理（产物确实改进了），2 档不是。
  // 数据基础已具备：run-log 既有 qualityLevel 与 artifacts 字段，无需新字段。
  //
  // 处置与 R6（冰山三视角不一致）**刻意不同**：此处不一致的是**评审者自身**，
  // 而 R 无法自查评审标准，故按 design-philosophy.md 的人机分工线走高成熟度
  // CHECKPOINT 交人裁定，**不走 R**。不得与产物间客观差异混同。
  //
  // 阈值 REVIEW_LEVEL_SPREAD = 2 为先行取值，端到端调测后校准（规格 D23）。
  const byArtifact = new Map<string, Array<{ level: string; runId: string }>>();
  for (const e of valid) {
    if (e.action !== 'review' || typeof e.qualityLevel !== 'string') continue;
    if (!Array.isArray(e.artifacts)) continue;
    for (const a of e.artifacts) {
      if (typeof a !== 'string' || a.trim() === '') continue;
      const list = byArtifact.get(a) ?? [];
      list.push({ level: e.qualityLevel, runId: e.runId });
      byArtifact.set(a, list);
    }
  }
  for (const [artifact, list] of byArtifact) {
    if (list.length < REVIEW_LEVEL_MIN_POINTS) continue; // 首次评审豁免：无不一致可言
    const ranks = list.map((x) => REVIEW_LEVEL_ORDER[x.level] ?? -1).filter((r) => r >= 0);
    if (ranks.length < REVIEW_LEVEL_MIN_POINTS) continue;
    const spread = Math.max(...ranks) - Math.min(...ranks);
    if (spread >= REVIEW_LEVEL_SPREAD) {
      violations.push(
        `R9 跨轮次评审不一致：${artifact} 的 qualityLevel 跨 ${spread} 档（${list.map((x) => `${x.runId}=${x.level}`).join(', ')}）；` +
          `评审者自身不一致，须走高成熟度 CHECKPOINT 交人裁定而非 R（R 无法自查评审标准），不走 R 返工链`,
      );
    }
  }

  // R10: revertEvidence 回滚证伪协议（P2-B / S27 / AC-8）。
  //
  // fix/emergency-fix 记录必须携带合法 revertEvidence.command（非空字符串）：执行该
  // 命令使 S-fix 的复现测试回到失败态，证明测试确实锚定被修缺陷——反模式 #45
  // 「改断言让测试通过」的确定性挂点（命令本身由 S 在真实执行中出示，此处只验
  // 载体存在与形态）。
  //
  // timestamp 仅为日志元数据，不参与证据信任判定；缺失/非法声明始终 blocking。
  const r10Counts = { checked: 0, missing: 0, legacy: 0 };
  for (const e of valid) {
    if (!['fix', 'emergency-fix'].includes(e.action)) continue;
    r10Counts.checked++;
    if (hasValidRevertEvidence(e)) continue;
    r10Counts.missing++;
    violations.push(
      `R10: ${e.action} 动作 ${e.runId} 须携带合法 revertEvidence.command（非空字符串；S-fix 复现测试的回滚证伪声明，执行后复现测试回到失败态，AC-8）`,
    );
  }

  // R11: 闭环五脚本机器核验（约束 #11 / SSoT §10C）。
  //
  // 触发域是「checkpoint 放行」（action=checkpoint 且 outcome=success）——只有放行
  // 过的阶段才有闭环义务，无放行的 run-log（如 fix 变体）不受约束。对每个放行，
  // 统计放行前（timestamp < 放行 timestamp，严格早于放行）已存在的闭环脚本 gate
  // 记录：action=gate + role=G + outcome=success + gateExitCode=0 +
  // script ∈ RUN_LOG_CLOSURE_SCRIPTS。非 G 角色、exitCode≠0、outcome≠success 或
  // 时间戳不早于放行的同名脚本记录一律不充数（无时间戳豁免；schema 的 timestamp 为
  // RFC3339 date-time，同秒内先后不可判定，故同秒不算「早于放行」），缺失即
  // blocking 并指明阶段与脚本名。同一阶段多次放行逐个核验（不合并）。
  //
  // D-6 阶段 1 后置窗口（**历史日志兼容形态**——E-2 方案 B 落地后的重定性，判据零变化）：
  // `phase===1` 的 `check-checkpoint.ts` 允许落在后置窗口 (releaseAt, nextReleaseAt)：
  // nextReleaseAt 取全部阶段中时间戳严格晚于本放行的最早一条放行记录，不存在下一放行时
  // 无上界（只要求晚于本放行）。后置窗口是**增补**而非替换——早于放行的同脚本记录照旧
  // 充数（既有 run-log 不受影响）；窗口只放宽时间轴，记录仍须属本阶段（phase 相同）。
  // 其余四脚本与 phase>=2 的放行判据完全不变。
  // 定性沿革：本窗口合入时（D-6，2026-09-21）用于绕开「check-checkpoint 自身要求 run-log
  // 已有放行记录才可能 exit 0」与 R11 严格早于判据的首阶段自举死锁（先跑门则门红，先放行
  // 则 R11 红）。E-2 方案 B（2026-09-22 规格修正案，R0 首阶段自举形态：run-log 零放行记录
  // 时以 checkpoint-log 用户确认为初级证据，见 checkpoint-logic.ts）使自然时序「确认落盘 →
  // 闭环五门 → 最后写放行记录」合法——新建项目常态满足上方严格判据，不再产生后置形态；
  // 本窗口仅保留用于兼容以旧时序写入的历史 run-log（删除会使其变红）。注意：后置形态仍
  // 违反 R8 轨迹模板（R8 零改动，后置记录照常报 R8 三条），新建项目不应产生该形态。
  const releaseTimes = valid
    .filter((e) => e.action === 'checkpoint' && e.outcome === 'success')
    .map((e) => Date.parse(e.timestamp))
    .sort((a, b) => a - b);
  const closureReleases: Array<{ phase: number; proven: Set<string> }> = [];
  let closureMissingCount = 0;
  for (const e of valid) {
    if (e.action !== 'checkpoint' || e.outcome !== 'success' || typeof e.phase !== 'number') continue;
    const releaseAt = Date.parse(e.timestamp);
    const proven = new Set<string>();
    for (const g of valid) {
      if (g.phase !== e.phase || g.action !== 'gate' || g.role !== 'G' || g.outcome !== 'success') continue;
      if (g.gateExitCode !== 0) continue;
      if (typeof g.script !== 'string' || !RUN_LOG_CLOSURE_SCRIPTS.includes(g.script)) continue;
      const gateAt = Date.parse(g.timestamp);
      if (g.script === 'check-checkpoint.ts' && e.phase === 1) {
        const nextReleaseAt = releaseTimes.find((t) => t > releaseAt);
        if (gateAt < releaseAt || (gateAt > releaseAt && (nextReleaseAt === undefined || gateAt < nextReleaseAt))) {
          proven.add(g.script);
        }
        continue;
      }
      if (gateAt < releaseAt) proven.add(g.script);
    }
    closureReleases.push({ phase: e.phase, proven });
  }
  for (const release of closureReleases) {
    for (const script of RUN_LOG_CLOSURE_SCRIPTS) {
      if (release.proven.has(script)) continue;
      closureMissingCount++;
      violations.push(
        `R11: 阶段 ${release.phase} 的 checkpoint 放行缺少闭环脚本 ${script} 的成功 gate 记录（须 role=G、gateExitCode=0 且早于放行；约束 #11：闭环五脚本每阶段门 exitCode=0）`,
      );
    }
  }

  const passed = violations.length === 0;
  return {
    passed,
    violations,
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
    revertEvidence: r10Counts,
    ...(closureReleases.length > 0
      ? { closure: { checkedGates: closureReleases.length, missing: closureMissingCount } }
      : {}),
    lifecycleStatus: passed && diagnostics.length === 0 ? 'CLOSED_UNDER_CURRENT_RULES' : 'NOT_CLOSED_NOT_PROVEN',
  };
}

// ==================== R6 契约：gate-log exitCode 提取与路径索引 ====================

/** 各门禁脚本 stdout 摘要标记 */
const GATE_JSON_PATTERNS: RegExp[] = [
  /GRAPH_JSON\s+(\{.*\})/,
  /VERIFIER_JSON\s+(\{.*\})/,
  /TLA_JSON\s+(\{.*\})/,
  /BUDGET_JSON\s+(\{.*\})/,
  /RUN_LOG_JSON\s+(\{.*\})/,
  /MATURITY_JSON\s+(\{.*\})/,
  /CHECKPOINT_JSON\s+(\{.*\})/,
  /GATE_JSON\s+(\{.*\})/,
  /SIGNATURE_CHAIN_JSON\s+(\{.*\})/,
  /ARCHIVE_INTEGRITY_JSON\s+(\{.*\})/,
  /ROLE_DISPATCH_JSON\s+(\{.*\})/,
  /CODE_TLA_JSON\s+(\{.*\})/,
  /COVERAGE_JSON\s+(\{.*\})/,
  /EXEMPTION_JSON\s+(\{.*\})/,
  /CONTRACT_JSON[:\s]+(\{.*\})/,
  /OPSX_ARTIFACTS_JSON\s+(\{.*\})/,
  /OPENSPEC_ARCHIVE_JSON\s+(\{.*\})/,
  /CODING_PLAN_JSON\s+(\{.*\})/,
  /CODEGRAPH_QUERIES_JSON\s+(\{.*\})/,
  /BDD_JSON\s+(\{.*\})/,
  /PREVENTIVE_REVIEW_JSON\s+(\{.*\})/,
  /ROOTCAUSE_JSON\s+(\{.*\})/,
  /TLA_BDD_SYNC_JSON\s+(\{.*\})/,
  /STATE_MACHINE_JSON\s+(\{.*\})/,
  /STATUS_JSON\s+(\{.*\})/,
  /METRICS_JSON\s+(\{.*\})/,
  /ERROR_JSON\s+(\{.*\})/,
];

/**
 * 从 gate-log 内容提取 exitCode（gate-log 是脚本 stdout 存档，含一行 `XXX_JSON {...}` 摘要）。
 * 纯函数、无 IO。
 */
export interface GateLogInspection {
  /** Root JSON payloads expose the numeric exit code even when semantic checks fail. */
  exitCode?: number;
  /** Blocking semantic violations found in a root JSON gate-log. */
  violations: string[];
  /** True when the complete content parsed as a JSON object. */
  rootJson: boolean;
}

const VALID_GATE_EXIT_CODES = new Set([0, 1, 2]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidGateExitCode(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && VALID_GATE_EXIT_CODES.has(value);
}

function inspectRootGateLog(root: Record<string, unknown>): GateLogInspection {
  const violations: string[] = [];
  const rawExitCode = root.exitCode;
  const exitCode = isValidGateExitCode(rawExitCode) ? rawExitCode : undefined;

  if (!isValidGateExitCode(rawExitCode)) {
    violations.push('root exitCode 必须为 0、1 或 2');
  }

  if (typeof root.passed !== 'boolean') {
    violations.push('root passed 必须为 boolean');
  } else if (exitCode !== undefined && (exitCode === 0) !== root.passed) {
    violations.push(`root passed 与 exitCode=${exitCode} 不一致`);
  }

  for (const summaryName of ['stdoutSummary', 'reportSummary'] as const) {
    const summary = summaryName === 'stdoutSummary' ? root.stdoutSummary : root.reportSummary;
    if (summary === undefined) continue;
    if (!isRecord(summary)) {
      violations.push(`${summaryName} 必须为 object`);
      continue;
    }
    if (exitCode !== undefined && 'exitCode' in summary && summary.exitCode !== exitCode) {
      violations.push(`${summaryName}.exitCode 与 root exitCode=${exitCode} 不一致`);
    }
    if (typeof root.passed === 'boolean' && 'passed' in summary && summary.passed !== root.passed) {
      violations.push(`${summaryName}.passed 与 root passed=${root.passed} 不一致`);
    }
  }

  return {
    ...(exitCode !== undefined ? { exitCode } : {}),
    violations,
    rootJson: true,
  };
}

function extractLegacyExitCode(content: string): number | undefined {
  for (const pattern of GATE_JSON_PATTERNS) {
    const match = content.match(pattern);
    if (!match || !match[1]) continue;
    try {
      const json = parseJsonSafe(match[1]) as { exitCode?: unknown };
      if (isValidGateExitCode(json.exitCode)) return json.exitCode;
    } catch {
      /* 继续扫描后续旧摘要标记 */
    }
  }
  return undefined;
}

/**
 * Inspect a gate-log payload without I/O. A complete JSON object is always
 * treated as a root gate-log candidate; malformed/missing root fields are not
 * allowed to fall through to a legacy stdout marker. Non-root content keeps
 * the historical `*_JSON {...}` extraction path.
 */
export function inspectGateLogContent(content: string): GateLogInspection {
  try {
    const parsed = parseJsonSafe(content);
    if (isRecord(parsed)) return inspectRootGateLog(parsed);
    return { violations: ['root gate-log 必须为 JSON object'], rootJson: true };
  } catch {
    /* Legacy stdout gate-log content is not itself a JSON document. */
  }
  const exitCode = extractLegacyExitCode(content);
  return {
    ...(exitCode !== undefined ? { exitCode } : {}),
    violations: [],
    rootJson: false,
  };
}

/**
 * 从 gate-log 内容提取 exitCode。根 JSON 优先；根 JSON 一旦成功解析为
 * object，即使字段缺失或非法也不再回退旧摘要，避免明确损坏的证据被吞掉。
 */
export function extractExitCode(content: string): number | undefined {
  const inspection = inspectGateLogContent(content);
  return inspection.violations.length === 0 ? inspection.exitCode : undefined;
}

/**
 * 构建 gateLogPath 多索引 key 集：basename / 绝对路径 / 相对 cwd 路径 / 各路径双向斜杠归一化（正↔反）。
 * 纯字符串实现（不 import node:path，遵守 *-logic.ts pure 边界）；兼容 Windows 反斜杠。
 * cwd 前缀裁剪：仅覆盖 cwd 内文件，cwd 外无相对 key，依赖 basename/绝对路径兜底；大小写敏感；调用方须保证 cwd 与 fileAbs 同源同分隔符。
 */
export function buildGateLogKeys(fileAbs: string, cwd: string): string[] {
  const basename = fileAbs.split(/[\\/]/).filter(Boolean).pop() ?? fileAbs;
  const keys = new Set<string>([basename, fileAbs]);
  if (cwd) {
    const sep = cwd.includes('\\') ? '\\' : '/';
    const prefix = cwd.endsWith(sep) ? cwd : `${cwd}${sep}`;
    if (fileAbs.startsWith(prefix)) {
      keys.add(fileAbs.slice(prefix.length));
    }
  }
  for (const k of [...keys]) {
    keys.add(k.replace(/\\/g, '/'));
    keys.add(k.replace(/\//g, '\\'));
  }
  return [...keys];
}
