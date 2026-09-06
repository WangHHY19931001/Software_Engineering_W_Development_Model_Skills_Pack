/**
 * 运行日志校验纯逻辑（Run-Log Logic）—— 防止运行日志漂移与 O 越权
 *
 * 对应 w-model-dev/references/data-models.md RunLogEntry schema（§运行日志模型）
 * 与 w-model-dev/references/operational-recovery.md §5.2。
 * 校验：R1 阶段动作完整性 + R2 tokens 非负 + R3 返工记录一致
 *       + R4 acknowledgedDecisions 非空 + R5 O 越权检测 + R6 exitCode 一致
 *       + R7 append-only 时序。
 *       + R8 轨迹模板校验（理想阶段轨迹：S→R3×3→V→G→checkpoint）
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
    | 'iceberg-review';
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
  /** rootcause/fix: 返工轮次 */
  round?: number;
  /** gate: 门禁脚本名 */
  script?: string;
}

export interface RunLogCheckOptions {
  /** R3: tla-manifest 的 checkRounds（TLA+ 返工轮数），用于与 run-log rework 记录数比对 */
  tlaCheckRounds?: number;
  /** R3: 当前阶段编号，用于按阶段过滤 rework 条目 */
  phase?: number;
  /** R5/R6: gate-logs 数据，key = gateLogPath，value = { exitCode?, content } */
  gateLogs?: Map<string, { exitCode?: number; content: string }>;
}

export type RunLogLifecycleStatus = 'CLOSED_UNDER_CURRENT_RULES' | 'NOT_CLOSED_NOT_PROVEN';

export interface RunLogCheckResult {
  passed: boolean;
  violations: string[];
  /** 生命周期 reducer 的非阻断诊断（legacy/pending 等状态，不改写 raw log）。 */
  diagnostics?: string[];
  /** 当前输入是否在无 blocking violation 且无 deferred diagnostic 的意义下闭合。 */
  lifecycleStatus: RunLogLifecycleStatus;
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
      if (isFailedReviewMissingReworkHints(raw)) {
        const otherMessages = schemaResult.errorMessages.filter(
          (message) =>
            !message.includes('reworkHints') &&
            !message.includes('must match "then" schema') &&
            !message.includes('must match "if" schema'),
        );
        if (otherMessages.length === 0 || isLegacySchemaFailure(raw, otherMessages)) {
          if (isLegacyMissingReworkHints(raw as RunLogEntry)) {
            const withoutHints = Object.fromEntries(
              Object.entries(raw as Record<string, unknown>).filter(([field]) => field !== 'reworkHints'),
            );
            valid.push(withoutHints as unknown as RunLogEntry);
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
      if (isLegacySchemaFailure(raw, schemaResult.errorMessages) && !isPostCutoffUndeclaredVariantEmergencyFix(raw)) {
        const missingFields = schemaResult.errorMessages
          .map((message) => message.match(/required property '([^']+)'/)?.[1])
          .filter((field): field is string => field !== undefined);
        const withoutIdentity = Object.fromEntries(
          Object.entries(raw as Record<string, unknown>).filter(([field]) => !missingFields.includes(field)),
        );
        valid.push(withoutIdentity as unknown as RunLogEntry);
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
    for (const f of fixActions) {
      if (f.phase !== legacyPhase || !isSuccessfulFix(f) || !isNonEmptyString(f.basedOnReport)) continue;
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
    const successfulFix = valid.slice(j + 1).find(isSuccessfulFix);
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

  const passed = violations.length === 0;
  return {
    passed,
    violations,
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
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

  return { ...(exitCode !== undefined ? { exitCode } : {}), violations, rootJson: true };
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
  return { ...(exitCode !== undefined ? { exitCode } : {}), violations: [], rootJson: false };
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
