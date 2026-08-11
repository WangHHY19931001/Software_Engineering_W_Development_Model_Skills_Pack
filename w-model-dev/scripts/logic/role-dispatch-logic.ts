/**
 * 角色分派完整性校验纯逻辑（Role Dispatch Logic）
 *
 * 对应约束 #19 + 反模式 #34：编排者每阶段须至少分派 S/V/G 三角色各 1 次；
 * R3 预防性审查无条件须分派 R 角色 ≥3 次（第29轮升级：移除 --r3-enabled flag）。
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
}

const REQUIRED_ROLES = ['S', 'V', 'G'] as const;
const R3_REQUIRED_COUNT = 3;

/**
 * 角色分派完整性校验纯逻辑
 *
 * 第29轮升级：R3 无条件强制。不再接受 r3Enabled 参数；
 * 每阶段 run-log 须含 role=R 记录 ≥3 条（completeness/reliability/security）。
 *
 * @param entries run-log 解析后的条目数组
 */
export function checkRoleDispatch(entries: RoleDispatchEntry[]): RoleDispatchResult {
  const violations: string[] = [];
  const phaseMap = new Map<number, Map<string, number>>();

  for (const entry of entries) {
    if (!entry || typeof entry.phase !== 'number' || typeof entry.role !== 'string') continue;
    if (!phaseMap.has(entry.phase)) phaseMap.set(entry.phase, new Map());
    const roles = phaseMap.get(entry.phase)!;
    roles.set(entry.role, (roles.get(entry.role) ?? 0) + 1);
  }

  const phaseSummary: RoleDispatchResult['phaseSummary'] = [];

  for (const [phase, roles] of phaseMap) {
    const missing: string[] = [];
    for (const required of REQUIRED_ROLES) {
      if ((roles.get(required) ?? 0) < 1) {
        missing.push(required);
        violations.push(`阶段 ${phase} 缺失 role=${required} 记录（约束 #19：每阶段须至少分派 S/V/G 各 1 次）`);
      }
    }

    // R3 无条件强制（第29轮：移除 r3Enabled 条件分支）
    const rCount = roles.get('R') ?? 0;
    if (rCount < R3_REQUIRED_COUNT) {
      missing.push('R');
      violations.push(
        `阶段 ${phase} 缺失 role=R 记录（约束 #19：R3 无条件强制，须有 3 条 R3 记录 completeness/reliability/security，当前 ${rCount} 条）`,
      );
    }

    phaseSummary.push({
      phase,
      roles: Object.fromEntries(roles),
      missing,
    });
  }

  return {
    passed: violations.length === 0,
    violations,
    phaseSummary,
  };
}
