/**
 * 成熟度校验纯逻辑（Maturity Logic）—— 防止成熟度模型漂移与降级失灵
 *
 * 对应 w-model-dev/references/data-models.md MaturityConfig schema（§自主成熟度模型）
 * 与 w-model-dev/references/anti-patterns.md §运维失败模式清单 O1~O6。
 * 校验：schema 完整（R1）+ level 合法（R2）+ 成功阶段更新一致（R3）
 *       + history 时序一致（R4）+ 降级触发检测（R5）。
 *
 * 设计原则（与 budget-logic.ts / graph-logic.ts / verifier-logic.ts 一致）：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状，不 import 外部模块
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用
 *   3. 单点事实：所有「成熟度模型是否符合规范」的判定均委托至此
 */

// ==================== 自包含类型形状 ====================

export interface MaturityConfig {
  /** Schema 版本，当前固定为 "1.0" */
  schemaVersion: '1.0';
  /** 项目 ID（与 project.json 一致） */
  projectId: string;
  /** 当前成熟度级别 */
  level: 'L0' | 'L1' | 'L2' | 'L3';
  /** 升级到此级别的时间 ISO 8601 */
  leveledUpAt: string;
  /** 解锁条件达成状态 */
  unlockConditions: {
    /** 稳定运行时长（天） */
    stableDays: number;
    /** 完整 8 阶段周期数（L0→L1 需要 ≥1） */
    completedCycles: number;
    /** attempt cap 达标率（L1→L2 需要 ≥0.8） */
    attemptCapRate: number;
    /** 误判率（L2→L3 需要 ≤0.1） */
    misjudgeRate: number;
    /** O 系列失败模式命中次数（升级需 0） */
    operationalFailures: number;
  };
  /** 升级历史 */
  history: Array<{
    from: 'L0' | 'L1' | 'L2' | 'L3';
    to: 'L0' | 'L1' | 'L2' | 'L3';
    at: string;
    reason: string;
  }>;
  /** 降级触发条件（自动降级回 L0） */
  downgradeTriggers: {
    /** 连续 O 系列失败模式命中 ≥ 此值 */
    operationalFailureStreak: number;
    /** 用户显式降级 */
    userRequested: boolean;
  };
}

export interface MaturityCheckOptions {
  /** R3: project 已完成的阶段数（从 project.json status 推断） */
  completedPhases?: number;
  /** R4: project 创建时间（用于 history.at 比较） */
  projectCreatedAt?: string;
  /** R5: run-log 中 O 系列失败模式命中次数（O1-O6，从 note 字段统计） */
  operationalFailureCount?: number;
}

export interface MaturityCheckResult {
  passed: boolean;
  violations: string[];
}

// ==================== 校验入口 ====================

export function checkMaturity(
  maturity: unknown,
  options?: MaturityCheckOptions,
): MaturityCheckResult {
  const violations: string[] = [];

  // 输入校验（先做）：非法输入返回 violations 而非抛 TypeError
  // 注意：typeof [] === 'object' 且 ![] 为 false，数组须显式排除，否则落到 R1 报"schema 不完整"有误导
  if (!maturity || typeof maturity !== 'object' || Array.isArray(maturity)) {
    return { passed: false, violations: ['maturity 必须为对象'] };
  }
  // narrow 为 Partial<MaturityConfig> 用于后续字段访问
  const m = maturity as Partial<MaturityConfig>;
  const uc = m.unlockConditions;
  const dt = m.downgradeTriggers;

  // R1 schema 完整
  // 注意：history 须为数组；非数组（含 null/对象）等同缺失，避免后续 R4 for-of 在非数组上报错
  const historyMissing = !m.history || !Array.isArray(m.history);
  if (!m.level || !m.unlockConditions || historyMissing || !m.downgradeTriggers) {
    violations.push('R1: maturity schema 不完整（缺 level/unlockConditions/history/downgradeTriggers）');
  }

  // R2 level 合法（先检查存在，避免 includes(undefined) 误报；R1 已报缺失）
  if (m.level && !['L0', 'L1', 'L2', 'L3'].includes(m.level)) {
    violations.push(`R2: level 非法值: ${m.level}（须为 L0/L1/L2/L3）`);
  }

  // R3 成功阶段更新：project 已完成 N 阶段但 unlockConditions.completedCycles 未更新
  // 注：completedPhases 为阶段数，completedCycles 为完整 8 阶段周期数；
  //     简化语义——completedCycles < completedPhases 即报违规（后续可改为 floor(completedPhases/8)）
  if (
    options?.completedPhases !== undefined &&
    uc &&
    typeof uc.completedCycles === 'number' &&
    uc.completedCycles < options.completedPhases
  ) {
    violations.push(`R3: project 已完成 ${options.completedPhases} 阶段，但 unlockConditions.completedCycles=${uc.completedCycles} 未更新`);
  }

  // R4 history 时序一致：history.at 与 leveledUpAt 不得早于 project.createdAt
  if (options?.projectCreatedAt && Array.isArray(m.history)) {
    for (const h of m.history) {
      if (h && typeof h === 'object' && typeof h.at === 'string') {
        if (new Date(h.at) < new Date(options.projectCreatedAt)) {
          violations.push(`R4: history 条目 at=${h.at} 早于 project.createdAt=${options.projectCreatedAt}`);
        }
      }
    }
  }
  if (options?.projectCreatedAt && typeof m.leveledUpAt === 'string') {
    if (new Date(m.leveledUpAt) < new Date(options.projectCreatedAt)) {
      violations.push(`R4: leveledUpAt=${m.leveledUpAt} 早于 project.createdAt=${options.projectCreatedAt}`);
    }
  }

  // R5 降级触发：O 系列失败模式命中次数已达 streak 阈值，应触发降级评估
  if (
    options?.operationalFailureCount !== undefined &&
    dt &&
    typeof dt.operationalFailureStreak === 'number' &&
    options.operationalFailureCount >= dt.operationalFailureStreak
  ) {
    violations.push(`R5: O 系列失败模式命中 ${options.operationalFailureCount} 次 ≥ downgradeTriggers.operationalFailureStreak ${dt.operationalFailureStreak}，应触发降级评估`);
  }

  return { passed: violations.length === 0, violations };
}
