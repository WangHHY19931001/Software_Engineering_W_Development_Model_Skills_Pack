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
}

const REQUIRED_ROLES = ['S', 'V', 'G'] as const;
/** R3 三维度：完整性 / 可靠性 / 安全性（约束 #11） */
const R3_ACTIONS = ['r3-completeness', 'r3-reliability', 'r3-security'] as const;
const R3_DIMENSIONS = ['completeness', 'reliability', 'security'] as const;

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

  // 空输入 fail-closed：没有条目本身即「无证据」，不得视为通过
  if (entries.length === 0) {
    return {
      passed: false,
      violations: ['run-log 为空：无任何可校验阶段记录（fail-closed：空输入不得视为通过）'],
      phaseSummary: [],
      r3Missing,
    };
  }

  // 结构扫描：roleCounts 保留全角色原计数（phaseSummary 展示用）；
  // r3Dimensions 只收集「有效 R3 记录」覆盖的维度。
  const phaseMap = new Map<number, { roleCounts: Map<string, number>; r3Dimensions: Set<string> }>();

  for (const entry of entries) {
    if (!entry || typeof entry.phase !== 'number' || typeof entry.role !== 'string') continue;
    const bucket = phaseMap.get(entry.phase) ?? {
      roleCounts: new Map<string, number>(),
      r3Dimensions: new Set<string>(),
    };
    if (!phaseMap.has(entry.phase)) phaseMap.set(entry.phase, bucket);
    bucket.roleCounts.set(entry.role, (bucket.roleCounts.get(entry.role) ?? 0) + 1);
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

  return {
    passed: violations.length === 0,
    violations,
    phaseSummary,
    r3Missing,
  };
}
