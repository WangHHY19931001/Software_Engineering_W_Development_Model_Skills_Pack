/**
 * 预算校验纯逻辑（Budget Logic）—— 防止预算配置漂移与 killSwitch 失灵
 *
 * 对应 w-model-dev/references/data-models.md BudgetConfig schema（§成本预算与运行日志）
 * 与 w-model-dev/references/operational-recovery.md §成本预算与运行日志。
 * 校验：时效性（R1）+ onExceed 合法（R3）+ killSwitch 触发检测（R5）+ 多角度 R token 预算（R4-A）。
 * schema 完整（R2）与 killSwitch.budgetBurnRate 范围（R4）由 budget.schema.json 前置拦截
 * （required / minimum+maximum），逻辑层不再重复校验（audit-fixes task 5，F-G2-05 死分支清理）。
 *
 * 设计原则（与 graph-logic.ts / verifier-logic.ts / tla-logic.ts 一致）：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状，不 import 外部模块
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用
 *   3. 单点事实：所有「预算是否符合规范」的判定均委托至此
 */

import { validateBySchema } from '../infrastructure/schema-loader.js';

// ==================== 自包含类型形状 ====================

export interface BudgetConfig {
  schemaVersion: '1.0';
  projectId: string;
  createdAt: string;
  updatedAt: string;
  perPhase: {
    maxTokens: number;
    maxSubagentSpawns: number;
    maxReworkRounds: number;
  };
  project: {
    maxTokensTotal: number;
    maxTokensPerSession: number;
  };
  onExceed: 'pause' | 'notify' | 'halt';
  killSwitch: {
    consecutiveReworks: number;
    budgetBurnRate: number;
    tlaReworks: number;
  };
  // ---- R4-A 扩展：多角度 R 的 token 预算（spec §9.9）----
  rootcauseParallelBudget?: {
    maxPersonasPerRound: number;
    maxTokensPerPersona: number;
    maxTotalTokensPerRound: number;
  };
  rootcauseRounds?: Array<{
    round: number;
    personas: Array<{ personaSlice: string; tokens: number }>;
    totalTokens: number;
  }>;
}

export interface BudgetCheckResult {
  passed: boolean;
  violations: string[];
  /** 非阻断警告：可选 context 缺失导致某规则未校验时的可见性提示（F-G2-04） */
  warnings: string[];
}

// ==================== 校验入口 ====================

export function checkBudget(
  budget: unknown,
  options?: {
    projectUpdatedAt?: string;
    budgetCreatedAt?: string;
    reworkCount?: number;
    tlaReworkCount?: number;
  },
): BudgetCheckResult {
  // === Schema 前置校验 ===
  const schemaResult = validateBySchema('budget', budget);
  if (!schemaResult.valid) {
    return {
      passed: false,
      violations: schemaResult.errorMessages.map((m) => `[schema] ${m}`),
      warnings: [],
    };
  }

  const violations: string[] = [];
  // 非阻断警告（F-G2-04）：R1 时效性依赖可选 --project context（projectUpdatedAt），
  // 未提供时显式降级为警告，不再静默跳过（exit 0 须可解释）
  const warnings: string[] = [];
  if (!options?.projectUpdatedAt || !options?.budgetCreatedAt) {
    warnings.push('R1 未校验：未提供 --project');
  }

  // 输入校验（先做）：非法输入返回 violations 而非抛 TypeError
  // 注意：typeof [] === 'object' 且 ![] 为 false，数组须显式排除，否则误报"budget 必须为对象"有误导
  if (!budget || typeof budget !== 'object' || Array.isArray(budget)) {
    return { passed: false, violations: ['budget 必须为对象'], warnings };
  }
  // narrow 为 Partial<BudgetConfig> 用于后续字段访问
  const b = budget as Partial<BudgetConfig>;
  const ks = b.killSwitch;

  // R1 时效性：项目已推进（projectUpdatedAt > budgetCreatedAt）但预算未更新（updatedAt == createdAt）
  // 注意：updatedAt/createdAt 可能 undefined，须先确认两者均为 string 再比较，避免 undefined == undefined 误报
  if (
    options?.projectUpdatedAt &&
    options?.budgetCreatedAt &&
    typeof b.updatedAt === 'string' &&
    typeof b.createdAt === 'string' &&
    new Date(options.projectUpdatedAt) > new Date(options.budgetCreatedAt) &&
    b.updatedAt === b.createdAt
  ) {
    violations.push('budget.updatedAt == createdAt，项目已推进但预算未更新');
  }

  // R3 onExceed 合法（schema enum 为前置拦截，此处为纵深防御；存在性检查避免 includes(undefined) 误报）
  if (b.onExceed && !['pause', 'notify', 'halt'].includes(b.onExceed)) {
    violations.push(`onExceed 非法值: ${b.onExceed}`);
  }

  // R5 killSwitch 触发检测：返工次数已达阈值但未告警
  if (
    options?.reworkCount !== undefined &&
    ks &&
    typeof ks.consecutiveReworks === 'number' &&
    options.reworkCount >= ks.consecutiveReworks
  ) {
    violations.push(`killSwitch 应触发（返工 ${options.reworkCount} >= ${ks.consecutiveReworks}）但未告警`);
  }
  if (
    options?.tlaReworkCount !== undefined &&
    ks &&
    typeof ks.tlaReworks === 'number' &&
    options.tlaReworkCount >= ks.tlaReworks
  ) {
    violations.push(`killSwitch 应触发（TLA+ 返工 ${options.tlaReworkCount} >= ${ks.tlaReworks}）但未告警`);
  }

  // R4-A：多角度 R 的 token 预算校验（不论并行/串行均累计，spec §9.9）
  const r4a = checkRootcauseBudget(b);
  violations.push(...r4a.violations);

  return { passed: violations.length === 0, violations, warnings };
}

/**
 * R4-A：多角度 R 的 token 预算校验（不论并行/串行均累计）
 *
 * 校验规则：
 *   - 每轮 persona 数 ≤ maxPersonasPerRound
 *   - 每个 persona tokens ≤ maxTokensPerPersona
 *   - 每轮总 tokens ≤ maxTotalTokensPerRound（串行分派时累计）
 *
 * 对应 spec §9.9。
 */
export function checkRootcauseBudget(b: Partial<BudgetConfig>): BudgetCheckResult {
  const violations: string[] = [];
  const cfg = b.rootcauseParallelBudget;
  if (!cfg) {
    // 未配置多角度预算时不校验（向后兼容）
    return { passed: true, violations: [], warnings: [] };
  }
  if (!Array.isArray(b.rootcauseRounds) || b.rootcauseRounds.length === 0) {
    return { passed: true, violations: [], warnings: [] };
  }

  for (const round of b.rootcauseRounds) {
    if (round.personas.length > cfg.maxPersonasPerRound) {
      violations.push(
        `R4-A：round ${round.round} persona 数 ${round.personas.length} > maxPersonasPerRound ${cfg.maxPersonasPerRound}`,
      );
    }
    for (const p of round.personas) {
      if (p.tokens > cfg.maxTokensPerPersona) {
        violations.push(
          `R4-A：round ${round.round} persona ${p.personaSlice} tokens ${p.tokens} > maxTokensPerPersona ${cfg.maxTokensPerPersona}`,
        );
      }
    }
    if (round.totalTokens > cfg.maxTotalTokensPerRound) {
      violations.push(
        `R4-A：round ${round.round} 总 tokens ${round.totalTokens} > maxTotalTokensPerRound ${cfg.maxTotalTokensPerRound}（串行分派时累计，触发 killSwitch）`,
      );
    }
  }

  return { passed: violations.length === 0, violations, warnings: [] };
}
