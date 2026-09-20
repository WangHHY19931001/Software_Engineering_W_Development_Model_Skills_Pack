/**
 * 预算校验纯逻辑（Budget Logic）—— 防止预算配置漂移与 killSwitch 失灵
 *
 * 对应 w-model-dev/references/data-models.md BudgetConfig schema（§成本预算与运行日志）
 * 与 w-model-dev/references/operational-recovery.md §成本预算与运行日志。
 * 校验：时效性（R1）+ onExceed 合法（R3）+ killSwitch 触发检测（R5）+ 多角度 R token 预算（R4-A）
 *      + 用量实效（R6，D-4b：Σtokens(阶段/总量) 超上限 → blocking；≥ budgetBurnRate × maxTokens
 *        → killSwitch 用量告警，文案以 `R5-b：` 开头以区别于 R5 的返工/TLA 触发文案）。
 * schema 完整（R2）与 killSwitch.budgetBurnRate 范围（R4）由 budget.schema.json 前置拦截
 * （required / minimum+maximum），逻辑层不再重复校验（audit-fixes task 5，F-G2-05 死分支清理）。
 *
 * 用量口径（D-4b）：R6/R5-b 只判定「实际用量 vs 上限」，用量由调用方从 run-log.jsonl 累计后
 * 经 options.tokensUsed 传入（CLI 侧 sumTokens）；未提供时 R6/R5-b 整体跳过，行为与新增前**一字不变**
 * （向后兼容硬线：既有 callers / samples / self-test 不受影响，跳过不等于通过由调用方保证可见）。
 *
 * 返工计数口径（D-4a 复审记录，D-4a 文档侧处置）：options.reworkCount 的语义是
 * 「返工事件 + 未过门事件」的**累计**条数——run-log 中 action ∈ {rework, fix, emergency-fix}
 * 或 outcome ∈ {fail, rework} 的记录均计入（详见 check-budget.ts countReworks）。因此
 * killSwitch.consecutiveReworks 实际约束的是「本阶段返工/未过门事件累计阈值」，不是
 * 「连续 N 轮返工」的滑动窗口（字段名沿用 schema，语义以本口径为准）。
 *
 * 设计原则（与 graph-logic.ts / verifier-logic.ts / tla-logic.ts 一致）：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状，不 import 外部模块
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用
 *   3. 单点事实：所有「预算是否符合规范」的判定均委托至此
 */

import { validateBySchema } from '../infrastructure/schema-loader.js';

// ==================== 自包含类型形状 ====================

/**
 * 用量实效校验的 token 汇总（R6/R5-b 的输入）
 *
 * - `phase`：当前阶段的累计消耗（CLI 按 `--phase` 过滤 run-log 后累计）
 * - `total`：全项目累计消耗（不过滤阶段）
 *
 * 由 CLI 侧 `sumTokens` 从 run-log.jsonl 累计（仅有限非负数计入），未经 schema 校验——
 * 它是运行期用量而非 config 字段，故不属于 BudgetConfig。
 */
export interface TokenUsage {
  phase: number;
  total: number;
}

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

/**
 * 预算校验入口（纯函数）
 *
 * @param budget  budget.json 的解析结果（先经 budget.schema.json 校验，schema 不符即返回 [schema] violations）
 * @param options 交叉校验的运行时上下文，全部可选；缺失的规则会以 warnings 显式声明「未校验」（不静默通过）：
 *   - `projectUpdatedAt` / `budgetCreatedAt`：R1 时效性
 *   - `reworkCount` / `tlaReworkCount`：R5 killSwitch 触发检测。口径见文件头「返工计数口径」——
 *     `reworkCount` 是「返工事件 + 未过门事件」的累计条数，故 `consecutiveReworks` 实际约束的是
 *     本阶段返工/未过门事件累计阈值
 *   - `tokensUsed`：R6 用量实效 / R5-b burnRate 告警。**未提供时 R6/R5-b 不参与判定，
 *     输出与新增前一字不变**（向后兼容硬线，见文件头「用量口径」）
 */
export function checkBudget(
  budget: unknown,
  options?: {
    projectUpdatedAt?: string;
    budgetCreatedAt?: string;
    reworkCount?: number;
    tlaReworkCount?: number;
    tokensUsed?: TokenUsage;
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

  // R6 用量实效 + R5-b burnRate 预警（D-4b）：预算配置合法 ≠ 用量在预算内。
  // 真实 8 阶段调测消耗 580M subagent tokens 而门禁全程未红，正是因为原先只校验配置合法性、
  // 没有任何「实际用量 vs 上限」判定——perPhase.maxTokens / project.maxTokensTotal 形同虚设。
  // 边界：R6 用严格 `>`（恰等于上限不算超限）；R5-b 用 `>=`（达 burnRate 阈值即告警，与
  // budgetBurnRate「≥ 此值暂停后续子代理」的 schema 语义一致）。
  // 文案前缀 `R5-b：`：R5 的三条既有文案（返工/TLA）没有规则号前缀，用 `R5-b：` 而非 `R5：`
  // 使 burnRate 用量告警在输出中可独立归属——既有 `killSwitch 应触发（返工 N >= M）但未告警`
  // 逐字不变（被 samples/self-test 断言），新增文案不与任何既有正则/子串断言相撞。
  const usage = options?.tokensUsed;
  if (usage) {
    const perPhaseMax = b.perPhase?.maxTokens;
    const totalMax = b.project?.maxTokensTotal;
    if (typeof perPhaseMax === 'number' && usage.phase > perPhaseMax) {
      violations.push(
        `R6：阶段 tokens ${usage.phase} > perPhase.maxTokens ${perPhaseMax}（${((usage.phase / perPhaseMax) * 100).toFixed(1)}%）`,
      );
    }
    if (typeof totalMax === 'number' && usage.total > totalMax) {
      violations.push(
        `R6：总 tokens ${usage.total} > project.maxTokensTotal ${totalMax}（${((usage.total / totalMax) * 100).toFixed(1)}%）`,
      );
    }
    if (
      typeof perPhaseMax === 'number' &&
      typeof ks?.budgetBurnRate === 'number' &&
      usage.phase >= ks.budgetBurnRate * perPhaseMax
    ) {
      violations.push(
        `R5-b：killSwitch 应触发（阶段消耗占比 ${(usage.phase / perPhaseMax).toFixed(2)} >= budgetBurnRate ${ks.budgetBurnRate}）`,
      );
    }
  }

  // R4-A：多角度 R 的 token 预算校验（不论并行/串行均累计，spec §9.9）
  const r4a = checkRootcauseBudget(b);
  violations.push(...r4a.violations);
  // R4-A 的跳过说明（未配置字段/无 rounds）必须一并透传：原先只取 violations，
  // 会把「R4-A 未校验」这条诊断静默丢掉，使跳过再次不可见。
  warnings.push(...r4a.warnings);

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
    // 未配置多角度预算时不校验（向后兼容）；跳过必须可见——不静默等于通过。
    return {
      passed: true,
      violations: [],
      warnings: ['R4-A 未校验：未配置 rootcauseParallelBudget（跳过不等于通过）'],
    };
  }
  if (!Array.isArray(b.rootcauseRounds) || b.rootcauseRounds.length === 0) {
    return {
      passed: true,
      violations: [],
      warnings: ['R4-A 未校验：无 rootcauseRounds 记录（跳过不等于通过）'],
    };
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
