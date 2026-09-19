/**
 * 覆盖分析纯逻辑层（Coverage Logic）
 *
 * 校验规格书 §7 需求覆盖分析的结构完整性与覆盖率阈值。
 * 四维识别·维度4：4 张覆盖矩阵 + 100% 覆盖率。
 *
 * 规则 C1-C10（C2/C6 已删除：stakeholder 角色与 NFR 子类不强制类别）：
 *   C1  stakeholders 数组非空
 *   C3  scenarios 数组非空
 *   C4  scenarios 含 happy/error/boundary 三类
 *   C5  requirementTypes 含 REQ/NFR/CON 三类
 *   C7  crossCuts 与 graph.json cross-cuts 边集一致（双向校验，须提供 --graph）
 *   C7b 未提供 --graph 时 crossCuts 为空 → blocking（fail-closed）；非空 → 降级 warning + skippedRules 标记
 *   C8  metrics 4 项均 = 100%
 *   C9  status=missing 须在 Out of Scope 显式声明（提供 outOfScope 时 fail，否则 warning）
 *   C10 metrics 重算一致性
 */
import { validateBySchema, type SchemaValidationResult } from '../infrastructure/schema-loader.js';

// ==================== 类型定义 ====================

export type CoverageStatus = 'covered' | 'partial' | 'missing';
export type ScenarioType = 'happy' | 'error' | 'boundary';
export type RequirementTypeCategory = 'REQ' | 'NFR' | 'CON';

export interface StakeholderEntry {
  id: string;
  role: string;
  relatedReqs: string[];
  status: CoverageStatus;
  gapDescription?: string;
}

export interface ScenarioEntry {
  id: string;
  description: string;
  steps: string[];
  relatedReqs: string[];
  status: CoverageStatus;
  scenarioType: ScenarioType;
  gapDescription?: string;
}

export interface RequirementTypeEntry {
  type: RequirementTypeCategory;
  reqIds: string[];
  status: CoverageStatus;
  gapDescription?: string;
}

export interface CrossCutEntry {
  nfrConId: string;
  governedReqs: string[];
  status: CoverageStatus;
  gapDescription?: string;
}

export interface CoverageMetrics {
  stakeholder: number;
  scenario: number;
  requirementType: number;
  crossCut: number;
}

export interface CoverageShape {
  stakeholders: StakeholderEntry[];
  scenarios: ScenarioEntry[];
  requirementTypes: RequirementTypeEntry[];
  crossCuts: CrossCutEntry[];
  metrics: CoverageMetrics;
}

export interface CoverageCheckResult {
  passed: boolean;
  violations: string[];
  warnings: string[];
  /** 因输入不足被降级为非阻断（warning）的规则 ID（如未提供 --graph 时跳过 C7） */
  skippedRules?: string[];
  metrics: CoverageMetrics;
  exemptionsApplied: string[];
  /** 重算为「空集」的覆盖率维度（vacuously true：空集与真实 100% 数值相同，须显式区分） */
  vacuousDimensions: string[];
}

// ==================== 辅助函数 ====================

/** 重算单维度覆盖率 = (covered + 0.5*partial) / total * 100；空集视作 100%（vacuously true） */
function recalcRate<T extends { status: CoverageStatus }>(entries: T[]): number {
  if (entries.length === 0) return 100;
  const covered = entries.filter((e) => e.status === 'covered').length;
  const partial = entries.filter((e) => e.status === 'partial').length;
  return ((covered + 0.5 * partial) / entries.length) * 100;
}

// ==================== 主校验函数 ====================

export interface CoverageCheckOptions {
  /** graph.json 的 cross-cuts 边集（用于 C7 双向校验）；不提供时——crossCuts 空 → C7b blocking（fail-closed），非空 → C7 降级 warning 并记入 skippedRules */
  graphCrossCuts?: Array<{ from: string; to: string }>;
  /** Out of Scope 声明的项（用于 C9），不提供则 C9 降级为 warning */
  outOfScope?: string[];
  /** 已批准豁免的 ruleId 列表（如 ['C8']），跳过对应规则 */
  exemptions?: string[];
}

export function checkRequirementCoverage(coverage: unknown, options: CoverageCheckOptions = {}): CoverageCheckResult {
  const result: CoverageCheckResult = {
    passed: false,
    violations: [],
    warnings: [],
    skippedRules: [],
    metrics: { stakeholder: 0, scenario: 0, requirementType: 0, crossCut: 0 },
    exemptionsApplied: [],
    vacuousDimensions: [],
  };

  // Schema 前置校验
  const schemaResult: SchemaValidationResult = validateBySchema('coverage', coverage);
  if (!schemaResult.valid) {
    result.violations.push(...schemaResult.errorMessages.map((m) => `[schema] ${m}`));
    result.passed = false;
    return result;
  }

  const c = coverage as CoverageShape;
  const exempt = new Set(options.exemptions ?? []);

  // C1: stakeholders 非空
  if (!exempt.has('C1') && c.stakeholders.length === 0) {
    result.violations.push('C1 stakeholders 数组为空（至少 1 个 stakeholder）');
  }

  // C3: scenarios 非空
  if (!exempt.has('C3') && c.scenarios.length === 0) {
    result.violations.push('C3 scenarios 数组为空');
  }

  // C4: scenarios 含 happy/error/boundary 三类
  if (!exempt.has('C4')) {
    const types = new Set(c.scenarios.map((s) => s.scenarioType));
    const required: ScenarioType[] = ['happy', 'error', 'boundary'];
    const missing = required.filter((t) => !types.has(t));
    if (missing.length > 0) {
      result.violations.push(`C4 scenarios 缺失场景类型：${missing.join(', ')}`);
    }
  }

  // C5: requirementTypes 含 REQ/NFR/CON 三类
  if (!exempt.has('C5')) {
    const types = new Set(c.requirementTypes.map((r) => r.type));
    const required: RequirementTypeCategory[] = ['REQ', 'NFR', 'CON'];
    const missing = required.filter((t) => !types.has(t));
    if (missing.length > 0) {
      result.violations.push(`C5 requirementTypes 缺失需求类型：${missing.join(', ')}`);
    }
  }

  // C7: crossCuts 与 graph.json cross-cuts 边集一致（双向校验，须提供 --graph）
  // C7b: 未提供 --graph 时不得静默放行——crossCuts 空 → blocking（fail-closed）；非空 → 降级 warning + skippedRules 标记
  if (!exempt.has('C7')) {
    if (options.graphCrossCuts) {
      const coverageEdges = new Set(c.crossCuts.flatMap((cc) => cc.governedReqs.map((req) => `${cc.nfrConId}→${req}`)));
      const graphEdges = new Set(options.graphCrossCuts.map((e) => `${e.from}→${e.to}`));
      const inCoverageNotGraph = [...coverageEdges].filter((e) => !graphEdges.has(e));
      const inGraphNotCoverage = [...graphEdges].filter((e) => !coverageEdges.has(e));
      if (inCoverageNotGraph.length > 0) {
        result.violations.push(`C7 coverage 有但 graph.json 无的 cross-cuts 边：${inCoverageNotGraph.join('；')}`);
      }
      if (inGraphNotCoverage.length > 0) {
        result.violations.push(`C7 graph.json 有但 coverage 无的 cross-cuts 边：${inGraphNotCoverage.join('；')}`);
      }
    } else {
      const cuts = c.crossCuts ?? [];
      if (cuts.length === 0) {
        result.violations.push('C7b crossCuts 为空且未提供 --graph，无法证明横切一致性（fail-closed）');
      } else {
        result.warnings.push('C7 未校验：未提供 --graph');
        result.skippedRules?.push('C7');
      }
    }
  }

  // C8: metrics 4 项均 = 100%
  if (!exempt.has('C8')) {
    const dims: Array<[keyof CoverageMetrics, string]> = [
      ['stakeholder', 'stakeholder'],
      ['scenario', 'scenario'],
      ['requirementType', 'requirementType'],
      ['crossCut', 'crossCut'],
    ];
    for (const [key, label] of dims) {
      if (c.metrics[key] !== 100) {
        result.violations.push(`C8 ${label} 覆盖率 ${c.metrics[key]}% < 100%`);
      }
    }
    // 额外：存在 partial 项也算 C8 失败（100% 意味着不允许 partial）
    const allEntries = [...c.stakeholders, ...c.scenarios, ...c.requirementTypes, ...c.crossCuts];
    const partialEntries = allEntries.filter((e) => e.status === 'partial');
    if (partialEntries.length > 0) {
      result.violations.push(`C8 存在 partial 项未补齐（100% 阈值不允许 partial）：${partialEntries.length} 项`);
    }
  }

  // C9: status=missing 须在 Out of Scope 显式声明
  const allEntries2 = [...c.stakeholders, ...c.scenarios, ...c.requirementTypes, ...c.crossCuts];
  const missingEntries = allEntries2.filter((e) => e.status === 'missing');
  if (missingEntries.length > 0) {
    const missingIds: string[] = [];
    for (const e of missingEntries) {
      const entry = e as StakeholderEntry | ScenarioEntry | RequirementTypeEntry | CrossCutEntry;
      if ('id' in entry && typeof entry.id === 'string' && entry.id) {
        missingIds.push(entry.id);
      } else if ('nfrConId' in entry && typeof entry.nfrConId === 'string' && entry.nfrConId) {
        missingIds.push(entry.nfrConId);
      } else if ('reqIds' in entry && Array.isArray(entry.reqIds) && entry.reqIds.length > 0) {
        missingIds.push(...entry.reqIds);
      }
    }
    if (options.outOfScope) {
      const declared = new Set(options.outOfScope);
      const undeclared = missingIds.filter((id) => !declared.has(id));
      if (!exempt.has('C9') && undeclared.length > 0) {
        result.violations.push(`C9 status=missing 项未在 Out of Scope 声明：${undeclared.join(', ')}`);
      }
    } else {
      result.warnings.push(
        `C9 status=missing 项建议在 Out of Scope 声明：${missingIds.join(', ')}（未提供 --out-of-scope，降级为 warning）`,
      );
    }
  }

  // C10: metrics 重算一致性
  if (!exempt.has('C10')) {
    const recalced: CoverageMetrics = {
      stakeholder: recalcRate(c.stakeholders),
      scenario: recalcRate(c.scenarios),
      requirementType: recalcRate(c.requirementTypes),
      crossCut: recalcRate(c.crossCuts),
    };
    const dims: Array<[keyof CoverageMetrics, string]> = [
      ['stakeholder', 'stakeholder'],
      ['scenario', 'scenario'],
      ['requirementType', 'requirementType'],
      ['crossCut', 'crossCut'],
    ];
    for (const [key, label] of dims) {
      if (c.metrics[key] !== recalced[key]) {
        result.violations.push(`C10 ${label} metrics 重算不一致：声明 ${c.metrics[key]}% vs 重算 ${recalced[key]}%`);
      }
    }
  }

  // 空集维度显式化：空集的 recalcRate 为 100%（vacuously true），与「确实全覆盖」在数值上
  // 完全不可分。这里不把它升级为 violation——非空约束已分别由 C1/C3/C5（数组非空）与 C7b
  // （crossCuts 空且无 --graph 时 fail-closed）处置，改判会与既有语义冲突；但它必须**可见**：
  // 报告里的 100% 若来自空集却被读成"已覆盖"，就是「零命中当通过」的静默假成功。
  const dimEntries: Array<[string, readonly unknown[]]> = [
    ['stakeholder', c.stakeholders],
    ['scenario', c.scenarios],
    ['requirementType', c.requirementTypes],
    ['crossCut', c.crossCuts],
  ];
  result.vacuousDimensions = dimEntries.filter(([, entries]) => entries.length === 0).map(([name]) => name);
  if (result.vacuousDimensions.length > 0) {
    result.warnings.push(
      `空集维度：${result.vacuousDimensions.join(', ')} 无条目，重算覆盖率 100% 系 vacuously true（非真实覆盖）`,
    );
  }

  // 记录豁免
  if (options.exemptions) {
    result.exemptionsApplied = [...options.exemptions];
  }

  // passed 汇总
  result.metrics = c.metrics;
  result.passed = result.violations.length === 0;
  return result;
}
