/**
 * 角色分派完整性校验纯逻辑（Role Dispatch Logic）
 *
 * 对应约束 #8 + 反模式 #34：编排者每阶段须至少分派 S/V/G 三角色各 1 次；
 * R3 预防性审查无条件须分派 R 角色 ≥3 条 success 记录
 * （completeness/reliability/security 三维度各 ≥1，不接受 --r3-enabled flag）。
 *
 * 审计修复（audit-gate-closure task 3）：
 *   - 空输入 fail-closed：entries 为空或解析后无任何可校验阶段（phaseMap 空）
 *     返回 blocking violation，不再把「无记录」误判为「完整」。
 *   - R3 精确计数：只统计 role=R + outcome=success + action∈{r3-completeness,
 *     r3-reliability, r3-security} 的记录；rootcause / iceberg-sweep / outcome!=success
 *     一律不计入，杜绝用重复维度或非 R3 动作充数。
 *   - 缺失维度消息指明具体维度；结果补充 r3Missing（每 phase 缺失维度列表）。
 *
 * 阶段 1-4 多角色讨论分析机制三新维度（task 3，2026-10-03）：
 *   - 覆盖：action=perspective 且 persona 非空记录的 persona 集合 ⊇ 阶段角色集矩阵
 *     persona 集（矩阵常量 PHASE_ROLE_MATRIX 硬编码于本文件，权威 =
 *     agent-personas.md「3A. 阶段角色集矩阵（A-lead 多视角分析）」节，6/7/7 集合）；
 *     lite 降级形态（阶段存在 consensus 记录且 note/纪要路径含 `phase-role-lite` 标记）
 *     按实际分派 N 通过（不冒充全矩阵，见 agent-personas.md lite 降级注）。
 *   - 时序：本阶段 action=produce 记录时间戳须严格晚于全部 perspective 记录
 *     （Date.parse 毫秒严格比较，同秒不算晚——形态同 run-log-logic R11 闭环核验）。
 *   - 互异：同阶段 action=perspective 记录 persona 重复违规（一 persona 一报告，
 *     subagent-delegation.md「A persona 视角分析分派模板」）。
 *   - 触发判据（历史零回归）：仅当该阶段（1-4）存在 action=produce 记录才进入三维度
 *     校验；无 produce 的阶段（历史 run 纯 chunk/cross 形态、阶段 5-8）不触发。
 *   - 结果经 phaseRoleCoverage（F2 形态）透出，check-role-dispatch CLI stdout JSON 同键。
 *
 * 设计原则（与 run-log-logic.ts / preventive-review-logic.ts 一致）：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用
 *   3. 单点事实：所有「角色分派是否完整」的判定均委托至此
 */

export interface RoleDispatchEntry {
  phase?: number;
  action?: string;
  role?: string;
  outcome?: string;
  /** 记录 ID（违规消息定位用；缺省时消息以 <missing> 占位） */
  runId?: string;
  /** 记录时间戳（ISO 8601；时序维度用，缺省/不可解析按 fail-closed 处理） */
  timestamp?: string;
  /** 多视角分析的 persona 标识（action=perspective 须非空且与 persona id 一致；其他 action 不得出现） */
  persona?: string;
  /** 备注（consensus lite 降级标记 `phase-role-lite` 的承载字段之一） */
  note?: string;
  /** 产物路径数组（consensus 纪要路径含 `phase-role-lite` 同样判 lite） */
  artifacts?: string[];
}

export interface RoleDispatchResult {
  passed: boolean;
  violations: string[];
  phaseSummary: Array<{
    phase: number;
    roles: Record<string, number>;
    missing: string[];
  }>;
  /** R3 维度缺失明细（每 phase 列出缺失维度；全部满足时为空数组） */
  r3Missing: Array<{ phase: number; missingDimensions: string[] }>;
  /**
   * 阶段 1-4 多角色三维度结果（F2 形态）：仅触发阶段出现（阶段 1-4 且存在
   * action=produce 记录）；维度全过时三字段为空数组 / 0。
   */
  phaseRoleCoverage: Array<{
    phase: number;
    missingPersonas: string[];
    timingViolations: number;
    duplicatePersonas: string[];
  }>;
}

const REQUIRED_ROLES = ['S', 'V', 'G'] as const;
/** R3 三维度：完整性 / 可靠性 / 安全性（约束 #11） */
const R3_ACTIONS = ['r3-completeness', 'r3-reliability', 'r3-security'] as const;
const R3_DIMENSIONS = ['completeness', 'reliability', 'security'] as const;

/**
 * 阶段角色集矩阵常量表（多角色覆盖维度的权威 persona 集合）。
 *
 * 权威来源：`w-model-dev/references/agent-personas.md`「3A. 阶段角色集矩阵（A-lead 多视角分析）」节
 * —— persona id 与矩阵行 persona 映射列**逐字一致**，顺序=矩阵行分派顺序
 * （覆盖判定只比集合不比顺序；顺序保留矩阵行原序便于 diff 对账）。
 * 阶段 4 集合与 2/3 相同、行序不同，此处按矩阵行逐字硬编码。
 * lite 降级（需求阶段=需求分析师 / 设计阶段=系统架构师，用户显式 --lite 或 L0/L1 成熟度）
 * 由此矩阵集全量改为按实际分派 N 校验，见 `isLiteConsensus`。
 */
const PHASE_ROLE_MATRIX: Record<number, readonly string[]> = {
  1: [
    'product-requirements-analyst',
    'product-manager',
    'testing-test-manager',
    'engineering-software-architect',
    'design-ux-architect',
    'engineering-algorithm-expert',
  ],
  2: [
    'testing-test-manager',
    'engineering-software-architect',
    'engineering-senior-developer',
    'product-manager',
    'engineering-database-optimizer',
    'design-ux-architect',
    'engineering-algorithm-expert',
  ],
  3: [
    'testing-test-manager',
    'engineering-software-architect',
    'engineering-senior-developer',
    'product-manager',
    'engineering-database-optimizer',
    'design-ux-architect',
    'engineering-algorithm-expert',
  ],
  4: [
    'testing-test-manager',
    'engineering-software-architect',
    'engineering-senior-developer',
    'product-manager',
    'design-ux-architect',
    'engineering-database-optimizer',
    'engineering-algorithm-expert',
  ],
};

/** persona 允许出现（非空）的动作白名单：仅阶段 1-4 多角色机制两动作（schema persona description 同源） */
const PERSONA_ACTIONS = new Set(['perspective', 'consensus']);

/** consensus 记录的 lite 降级标记（纪要路径或 note 含此串即按实际分派 N 校验） */
const PHASE_ROLE_LITE_MARKER = 'phase-role-lite';

/**
 * 时间戳 → 毫秒（宽容口径，形态同 run-log-logic.ts recordTimestampMs）：
 * 只接受非空字符串且 `Date.parse` 可解析为有限毫秒的值；其余返回 null（fail-closed 由调用方裁定）。
 */
function entryTimestampMs(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** persona 是否为有效非空标识（空白串视为未留痕，不计入覆盖集） */
function isNonEmptyPersona(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** consensus 记录是否声明 lite 降级（note 或 artifacts 纪要路径含 phase-role-lite 标记） */
function isLiteConsensus(entry: RoleDispatchEntry): boolean {
  if (entry.action !== 'consensus') return false;
  if (typeof entry.note === 'string' && entry.note.includes(PHASE_ROLE_LITE_MARKER)) return true;
  if (Array.isArray(entry.artifacts)) {
    return entry.artifacts.some((a) => typeof a === 'string' && a.includes(PHASE_ROLE_LITE_MARKER));
  }
  return false;
}

/**
 * 判定条目是否构成一条有效的 R3 记录。
 * 严格语义：role=R + outcome=success + action 为 r3-* 动作；
 * rootcause / iceberg-sweep / 非 success / 重复维度之外的充数一律不计入。
 */
function isR3Credit(entry: RoleDispatchEntry, action: string): boolean {
  return entry.role === 'R' && entry.outcome === 'success' && (R3_ACTIONS as readonly string[]).includes(action);
}

function dimensionOf(action: string): string | null {
  for (const dimension of R3_DIMENSIONS) {
    if (action === `r3-${dimension}`) return dimension;
  }
  return null;
}

/**
 * 角色分派完整性校验纯逻辑
 *
 * R3 无条件强制，不再接受 r3Enabled 参数；
 * 每阶段 run-log 须含 role=R 的有效 R3 记录覆盖三维度（各 ≥1 条 success）。
 *
 * @param entries run-log 解析后的条目数组
 */
export function checkRoleDispatch(entries: RoleDispatchEntry[]): RoleDispatchResult {
  const violations: string[] = [];
  const r3Missing: RoleDispatchResult['r3Missing'] = [];
  const phaseRoleCoverage: RoleDispatchResult['phaseRoleCoverage'] = [];

  // 空输入 fail-closed：没有条目本身即「无证据」，不得视为通过
  if (entries.length === 0) {
    return {
      passed: false,
      violations: ['run-log 为空：无任何可校验阶段记录（fail-closed：空输入不得视为通过）'],
      phaseSummary: [],
      r3Missing,
      phaseRoleCoverage,
    };
  }

  // 结构扫描：roleCounts 保留全角色原计数（phaseSummary 展示用）；
  // r3Dimensions 只收集「有效 R3 记录」覆盖的维度；
  // phaseEntries 保留原始条目（阶段 1-4 多角色三新维度扫描用）。
  const phaseMap = new Map<
    number,
    {
      roleCounts: Map<string, number>;
      r3Dimensions: Set<string>;
      phaseEntries: RoleDispatchEntry[];
    }
  >();

  for (const entry of entries) {
    if (!entry || typeof entry.phase !== 'number' || typeof entry.role !== 'string') continue;
    const bucket = phaseMap.get(entry.phase) ?? {
      roleCounts: new Map<string, number>(),
      r3Dimensions: new Set<string>(),
      phaseEntries: [],
    };
    if (!phaseMap.has(entry.phase)) phaseMap.set(entry.phase, bucket);
    bucket.roleCounts.set(entry.role, (bucket.roleCounts.get(entry.role) ?? 0) + 1);
    bucket.phaseEntries.push(entry);
    if (typeof entry.action === 'string' && isR3Credit(entry, entry.action)) {
      const dimension = dimensionOf(entry.action);
      if (dimension) bucket.r3Dimensions.add(dimension);
    }
  }

  // 全 invalid / 无 numeric phase → 同样无可校验证据，fail-closed
  if (phaseMap.size === 0) {
    return {
      passed: false,
      violations: ['run-log 无任何可校验阶段记录：全部条目缺 phase/role 字段（fail-closed：全无效输入不得视为通过）'],
      phaseSummary: [],
      r3Missing,
      phaseRoleCoverage,
    };
  }

  const phaseSummary: RoleDispatchResult['phaseSummary'] = [];

  for (const [phase, bucket] of phaseMap) {
    const { roleCounts, r3Dimensions } = bucket;
    const missing: string[] = [];
    for (const required of REQUIRED_ROLES) {
      if ((roleCounts.get(required) ?? 0) < 1) {
        missing.push(required);
        violations.push(`阶段 ${phase} 缺失 role=${required} 记录（约束 #8：每阶段须至少分派 S/V/G 各 1 次）`);
      }
    }

    // R3 无条件强制（不接受 r3Enabled 条件分支）；只按有效 R3 记录维度计数。
    // 重复维度可作为真实重工记录（已有维度多条不报错），三维度各 ≥1 即满足。
    const missingDimensions = R3_DIMENSIONS.filter((dimension) => !r3Dimensions.has(dimension)) as string[];
    if (missingDimensions.length > 0) {
      missing.push('R');
      r3Missing.push({ phase, missingDimensions });
      const rTotal = roleCounts.get('R') ?? 0;
      // R 总数为 0（无任何 role=R 记录）→ 保留「缺失 role=R 记录」消息；
      // R 记录存在（rootcause/iceberg/重复维度等）但三维度未齐 → 报维度不足，
      // 避免「缺失 role=R 记录」与 phaseSummary 的 R=N 展示并存误导。
      violations.push(
        rTotal === 0
          ? `阶段 ${phase} 缺失 role=R 记录（约束 #8：R3 无条件强制，须 role=R 的 r3-completeness/r3-reliability/r3-security 各 1 条 success，当前缺 ${missingDimensions.join('/')}）`
          : `阶段 ${phase} 有效 R3 维度记录不足：须 role=R 且 outcome=success 的 r3-completeness/r3-reliability/r3-security 各 ≥1，当前缺：${missingDimensions.join('/')}`,
      );
    }

    phaseSummary.push({
      phase,
      roles: Object.fromEntries(roleCounts),
      missing,
    });
  }

  // persona 字段误用（全局，跨阶段）：schema persona description「其他 action 不得出现
  // （role-dispatch logic 校验）」的 logic 承接——非 perspective/consensus 记录携带非空
  // persona 即 blocking。历史记录无 persona 字段，零回归。
  for (const entry of entries) {
    if (!entry || typeof entry.action !== 'string') continue;
    if (PERSONA_ACTIONS.has(entry.action)) continue;
    if (isNonEmptyPersona(entry.persona)) {
      violations.push(
        `persona 字段误用：条目 runId=${entry.runId ?? '<missing>'} action=${entry.action} 不得携带 persona（仅 perspective/consensus 允许）`,
      );
    }
  }

  // 阶段 1-4 多角色三新维度（覆盖 / 时序 / 互异）。
  // 触发判据（历史零回归）：仅当该阶段存在 action=produce 记录；无 produce 的阶段
  // （历史 run 纯 chunk/cross 形态、阶段 5-8）不触发，phaseRoleCoverage 不含该阶段。
  for (const [phase, bucket] of phaseMap) {
    if (phase < 1 || phase > 4) continue;
    const { phaseEntries } = bucket;
    if (!phaseEntries.some((e) => e.action === 'produce')) continue;

    // eslint-disable-next-line security/detect-object-injection -- phase 为 run-log schema 上游 integer 字段（run-log.schema.json "type":"integer", minimum 1/maximum 8；本 logic 结构扫描另要求 typeof phase === "number" 并以 phase<1||phase>4 守卫域）；PHASE_ROLE_MATRIX 为仅含数字键 1-4 的字面量常量（Record<number, readonly string[]>），无原型链污染面
    const matrixRow = PHASE_ROLE_MATRIX[phase] ?? [];
    const perspectives = phaseEntries.filter((e) => e.action === 'perspective');

    // ③ 互异：同阶段 perspective 记录 persona 重复（一 persona 一报告；空 persona 不计入）。
    const personaCounts = new Map<string, number>();
    for (const e of perspectives) {
      if (!isNonEmptyPersona(e.persona)) continue;
      const persona = e.persona.trim();
      personaCounts.set(persona, (personaCounts.get(persona) ?? 0) + 1);
    }
    const duplicatePersonas = [...personaCounts.entries()].filter(([, n]) => n > 1).map(([p]) => p);
    if (duplicatePersonas.length > 0) {
      violations.push(
        `阶段 ${phase} 多角色 persona 重复：${duplicatePersonas.join('/')}（一 persona 一报告，action=perspective 须与 persona id 一致）`,
      );
    }

    // ① 覆盖：perspective 非空 persona 集合 ⊇ 矩阵 persona 集；
    // lite 降级（consensus 记录 note/纪要路径含 phase-role-lite）按实际分派 N 通过
    // ——实际 N ≥1 即满足（不冒充全矩阵）；声明 lite 却零 perspective 留痕仍按全矩阵报缺。
    const covered = new Set(personaCounts.keys());
    const lite = phaseEntries.some((e) => isLiteConsensus(e));
    const missingPersonas = lite
      ? covered.size >= 1
        ? []
        : matrixRow.filter((p) => !covered.has(p))
      : matrixRow.filter((p) => !covered.has(p));
    if (missingPersonas.length > 0) {
      violations.push(
        `阶段 ${phase} 多角色覆盖不足：缺 persona=${missingPersonas.join('/')}（须 action=perspective 且 persona 非空覆盖 agent-personas 阶段角色集矩阵全 persona 集${lite ? '；lite 降级以实际分派 N 为准，当前零 perspective 留痕' : ''}）`,
      );
    }

    // ② 时序：本阶段 produce 记录时间戳须严格晚于全部 perspective 记录（同秒不算晚，
    // 形态同 run-log-logic R11 闭环核验；perspective 时间戳缺失/不可解析按 fail-closed 计违规）。
    const perspectiveTimes = perspectives
      .map((e) => entryTimestampMs(e.timestamp))
      .filter((t): t is number => t !== null);
    const perspectiveHasUnparseable = perspectives.some((e) => entryTimestampMs(e.timestamp) === null);
    let timingViolations = 0;
    for (const e of phaseEntries) {
      if (e.action !== 'produce') continue;
      const produceAt = entryTimestampMs(e.timestamp);
      if (perspectiveHasUnparseable || produceAt === null || perspectiveTimes.some((t) => t >= produceAt)) {
        timingViolations++;
        violations.push(
          `阶段 ${phase} 多角色时序违规：produce 记录 runId=${e.runId ?? '<missing>'} 未严格晚于全部 perspective 记录（同秒不算晚${produceAt === null ? '；produce 时间戳缺失/不可解析' : ''}${perspectiveHasUnparseable ? '；存在时间戳缺失/不可解析的 perspective 记录' : ''}）`,
        );
      }
    }

    phaseRoleCoverage.push({
      phase,
      missingPersonas,
      timingViolations,
      duplicatePersonas,
    });
  }

  return {
    passed: violations.length === 0,
    violations,
    phaseSummary,
    r3Missing,
    phaseRoleCoverage,
  };
}
