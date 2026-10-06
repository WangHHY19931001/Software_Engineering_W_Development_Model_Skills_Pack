/**
 * 成熟度校验纯逻辑（Maturity Logic）—— 防止成熟度模型漂移与降级失灵
 *
 * 对应 w-model-dev/references/data-models.md MaturityConfig schema（§自主成熟度模型）
 * 与 w-model-dev/references/hard-constraints.md（反模式节）§运维失败模式清单 O1~O6。
 * 校验：level 合法（R2）+ history 时序一致（R4）+ 降级触发检测（R5）+ history 链一致性（R6）。
 * 原 R3（unlockConditions.completedCycles 周期换算）随 unlockConditions 死字段删除而退役
 * （43.0.0 A4，批次 6 任务 8；规则号不回收，R4/R5 编号保持稳定）。
 * R5 为**真值通道**（D-7）：命中次数只统计 run-log 的 `operationalFailureModes` 字段，note 中的
 * O1~O6 字样（含评审规则编号同名情形）视为引用、仅作非阻断诊断；未提供 run-log 时由调用方
 * 经 `options.diagnostics` 显式登记「R5 未生效」，不再静默跳过。
 * schema 完整（R1，level/history/downgradeTriggers required）由
 * maturity.schema.json 前置拦截，逻辑层不再重复校验（audit-fixes task 5，F-G2-05 死分支清理）。
 *
 * 设计原则（与 budget-logic.ts / graph-logic.ts / verifier-logic.ts 一致）：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状，不 import 外部模块
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用
 *   3. 单点事实：所有「成熟度模型是否符合规范」的判定均委托至此
 */

import { validateBySchema } from '../infrastructure/schema-loader.js';

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
  /** 升级历史（只承载升级链；降级走 human 审批链，不记 history，A4 43.0.0） */
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
  /** R4: project 创建时间（用于 history.at 比较） */
  projectCreatedAt?: string;
  /** R5: run-log 中 O 系列失败模式命中次数（O1-O6，只统计 operationalFailureModes 字段，D-7 真值通道） */
  operationalFailureCount?: number;
  /**
   * 非阻断诊断（D-7）：由 CLI 层组装的事实性提示（R5 未接线 / note 词法疑似引用），
   * 逐字回传进报告（与 warnings 并存），**不参与 passed 判定**。
   */
  diagnostics?: string[];
}

export interface MaturityCheckResult {
  passed: boolean;
  violations: string[];
  /** 非阻断警告：可选 context 缺失导致某规则未校验时的可见性提示（F-G2-04） */
  warnings: string[];
  /** 非阻断诊断（D-7）：R5 真值通道/词法降级/未接线可见化，与 warnings 并存且不影响 passed */
  diagnostics: string[];
}

// ==================== 校验入口 ====================

/** 成熟度升级链序（A4 R6 唯一事实源；严格递增，index 即级别高低） */
const LEVEL_ORDER = ['L0', 'L1', 'L2', 'L3'] as const;

function levelRank(value: unknown): number {
  return LEVEL_ORDER.indexOf(value as (typeof LEVEL_ORDER)[number]);
}

export function checkMaturity(maturity: unknown, options?: MaturityCheckOptions): MaturityCheckResult {
  // === Schema 前置校验 ===
  const schemaResult = validateBySchema('maturity', maturity);
  if (!schemaResult.valid) {
    return {
      passed: false,
      violations: schemaResult.errorMessages.map((m) => `[schema] ${m}`),
      warnings: [],
      diagnostics: [],
    };
  }

  const violations: string[] = [];
  // 非阻断警告（F-G2-04）保留通道：43.0.0 A4 后暂无登记项（原 R3 context warning 随死字段退役）
  const warnings: string[] = [];
  // 非阻断诊断（D-7）：调用方（CLI / self-test）注入的事实性提示，逐字回传，不影响 passed
  const diagnostics: string[] = [...(options?.diagnostics ?? [])];

  // 输入校验（先做）：非法输入返回 violations 而非抛 TypeError
  // 注意：typeof [] === 'object' 且 ![] 为 false，数组须显式排除，否则误报"maturity 必须为对象"有误导
  if (!maturity || typeof maturity !== 'object' || Array.isArray(maturity)) {
    return {
      passed: false,
      violations: ['maturity 必须为对象'],
      warnings,
      diagnostics,
    };
  }
  // narrow 为 Partial<MaturityConfig> 用于后续字段访问
  const m = maturity as Partial<MaturityConfig>;
  const dt = m.downgradeTriggers;

  // R2 level 合法（schema enum 为前置拦截，此处为纵深防御；存在性检查避免 includes(undefined) 误报）
  if (m.level && !LEVEL_ORDER.includes(m.level)) {
    violations.push(`R2: level 非法值: ${m.level}（须为 L0/L1/L2/L3）`);
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
  // 真值通道（D-7）：operationalFailureCount 由调用方只统计 run-log 的 operationalFailureModes 字段得出
  if (
    options?.operationalFailureCount !== undefined &&
    dt &&
    typeof dt.operationalFailureStreak === 'number' &&
    options.operationalFailureCount >= dt.operationalFailureStreak
  ) {
    violations.push(
      `R5: O 系列失败模式命中 ${options.operationalFailureCount} 次 ≥ downgradeTriggers.operationalFailureStreak ${dt.operationalFailureStreak}，应触发降级评估`,
    );
  }

  // R6 history 链一致性（A4，43.0.0；决策日志 rounds-48 三判定；批次 6 修复轮 1 审查裁定第三判定放宽）：
  //   1. from == 上一条 to（首条无前驱，不约束起点——存量形态允许 L1→L2 起头的升级链切片）；
  //   2. to > from（LEVEL_ORDER 严格比较；history 只承载升级链，降级走 human 审批链）；
  //   3. 末条 to 不低于当前 level（降级后 level 低于末条属合法形态——A4 起 TLA+/BDD 豁免须 human
  //      审批链，降级不再构成绕过面，R6 只锁「level 高于升级链末条」的伪造升级虚高路径）。
  // 破链/跳级/平级/level 虚高（高于链末条）即伪造路径——machine 层 fail-closed。
  if (Array.isArray(m.history)) {
    let prevTo: string | undefined;
    for (const [i, h] of m.history.entries()) {
      if (!h || typeof h !== 'object') continue; // 结构问题由 schema 拦截
      const rankFrom = levelRank(h.from);
      const rankTo = levelRank(h.to);
      if (rankFrom >= 0 && rankTo >= 0 && rankTo <= rankFrom) {
        violations.push(
          `R6: history[${i}] to=${String(h.to)} 须严格高于 from=${String(h.from)}（history 只承载升级链；降级走 human 审批链，不记 history）`,
        );
      }
      if (i > 0 && prevTo !== undefined && h.from !== prevTo) {
        violations.push(`R6: history[${i}] from=${String(h.from)} 与上一条 to=${prevTo} 断链（from 须等于上一条 to）`);
      }
      prevTo = h.to;
    }
    if (m.level) {
      const last = m.history.length > 0 ? m.history[m.history.length - 1] : undefined;
      if (!last) {
        if (m.level !== 'L0') {
          violations.push(`R6: history 为空但 level=${m.level}（初始态须为 L0；升级须以 history 升级链记录）`);
        }
      } else if (levelRank(last.to) < levelRank(m.level)) {
        violations.push(
          `R6: history 末条 to=${String(last.to)} 低于当前 level=${String(m.level)}（level 不得高于升级链末条；降级后 level 低于末条属合法形态）`,
        );
      }
    }
  }

  return { passed: violations.length === 0, violations, warnings, diagnostics };
}
