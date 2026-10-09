// w-model-dev/scripts/logic/complexity-logic.ts
/**
 * M1 复杂度度量——纯函数逻辑层（零 fs import，由 dependency-boundaries 强制）。
 *
 * 批次五五机制之首（43.5.0）：把技能包的复杂度面量化为可棘轮收敛的度量——
 *   references/scripts 各文件行数、反模式/硬约束计数、人格适配计数、沉积标记计数。
 * 本文件只做纯计算与数据注入；I/O 采集在 lib/complexity-collect.ts（fc-6：lib 层可为 fs），
 * 门禁预算在任务 3（check-complexity-budget.ts）由基线 caps 驱动。
 *
 * 计数口径：
 *   - 超限分桶阈值 = COMPLEXITY_DEFAULT_MAX_LINES（1200），与任务 3 的默认 cap 同源；
 *   - checkComplexityBudget 的 violations 逐条带实测值与 cap，机器/人类双读。
 */

export class ComplexityFormatError extends Error {
  constructor(detail: string) {
    super(`复杂度度量输入格式不符: ${detail}`);
    this.name = 'ComplexityFormatError';
  }
}

/** 单个待度量文件（path 为相对显示路径，如 references/tla-plus.md / scripts/cli/check-budget.ts） */
export interface FileLines {
  path: string;
  lines: number;
}

/** 一次完整复杂度度量（由 lib/complexity-collect.ts 采集，消费方数据注入） */
export interface ComplexityMeasurement {
  /** w-model-dev/references/*.md 行数 */
  referencesFiles: FileLines[];
  /** w-model-dev/scripts/{cli,logic,lib,application,infrastructure}/*.ts 行数（不含 __tests__） */
  scriptFiles: FileLines[];
  /** 反模式计数（登记册落地前暂按 hard-constraints 主表行数；任务 4 后改读登记册） */
  antiPatternCount: number;
  /** 硬约束计数（## #N 标题条数） */
  hardConstraintCount: number;
  /** 正文命中适配词表 ≥2 项的人格数 */
  personaAdaptedCount: number;
  /** 人格总数（w-model-dev/subagent/*.md 文件数） */
  personaTotal: number;
  /** references/*.md 中含「已删除|已退役|审查更正」的行数 */
  sedimentCount: number;
}

/**
 * 人格适配计数（countPersonaAdaption / PERSONA_ADAPTION_MARKERS）为本数据面共享面，
 * 权威实现位于 lib/complexity-collect.ts（lib→logic 运行时导入被 dependency-boundaries 禁止，
 * 故逻辑层再导出，仿 code-health-contract.ts 对 code-health-error.ts 的再导出范式）。
 */
export { countPersonaAdaption, PERSONA_ADAPTION_MARKERS } from '../lib/complexity-collect.js';

/** 单文件行数默认上限（超限分桶与任务 3 默认 cap 的统一口径） */
export const COMPLEXITY_DEFAULT_MAX_LINES = 1200;

/** 复杂度报告（oversized 分桶 + 原度量透传 + 人类通道时间戳） */
export interface ComplexityReport {
  /** >1200 行的 references 文件（按行数降序，同阈值分桶） */
  oversizedReferences: FileLines[];
  /** >1200 行的 scripts 文件 */
  oversizedScripts: FileLines[];
  /** 原度量（任务 3 的基线 caps 初值来源） */
  m: ComplexityMeasurement;
  /** 生成时间（仅人类通道展示；JSON 通道剔除，保证同字节确定） */
  generatedAt: string;
}

/** 棘轮预算 caps（任务 3 check-complexity-budget 的输入；exception 键 = FileLines.path） */
export interface BudgetCaps {
  referencesDefaultMaxLines: number;
  referencesExceptions: Record<string, number>;
  scriptsDefaultMaxLines: number;
  scriptsExceptions: Record<string, number>;
  antiPatternMaxCount: number;
  hardConstraintMaxCount: number;
  personaAdaptedMinCount: number;
  sedimentMaxCount: number;
}

/**
 * 解析并校验 caps 文件结构（纯函数，CLI 层把失败映射为 STRUCTURE_INVALID）。
 * 兼容 `schemaVersion` / `description` 等额外顶层键；8 个必填数值字段 + 2 个异常表
 * 缺一或非有限数值即抛 ComplexityFormatError（fail-closed：坏 caps 不得静默放宽棘轮）。
 */
export function parseBudgetCaps(raw: unknown): BudgetCaps {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ComplexityFormatError('caps 输入不是对象');
  }
  const o = raw as Record<string, unknown>;
  const num = (key: keyof BudgetCaps): number => {
    // eslint-disable-next-line security/detect-object-injection -- key 为 keyof BudgetCaps 字面量联合（接口属性名），受控键
    const v = o[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new ComplexityFormatError(`caps 字段 ${String(key)} 缺失或非有限数值`);
    }
    return v;
  };
  const excMap = (key: 'referencesExceptions' | 'scriptsExceptions'): Record<string, number> => {
    // eslint-disable-next-line security/detect-object-injection -- key 为两字面量联合（异常表字段名），受控键
    const v = o[key];
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      throw new ComplexityFormatError(`caps 字段 ${key} 缺失或不是对象`);
    }
    const out: Record<string, number> = {};
    for (const [k, n] of Object.entries(v)) {
      if (typeof n !== 'number' || !Number.isFinite(n)) {
        throw new ComplexityFormatError(`caps ${key}.${k} 非有限数值`);
      }
      // eslint-disable-next-line security/detect-object-injection -- k 来自 caps JSON（仓库受控维护入库文件）对象键，写入本函数新建局部 out，非注入面
      out[k] = n;
    }
    return out;
  };
  return {
    referencesDefaultMaxLines: num('referencesDefaultMaxLines'),
    referencesExceptions: excMap('referencesExceptions'),
    scriptsDefaultMaxLines: num('scriptsDefaultMaxLines'),
    scriptsExceptions: excMap('scriptsExceptions'),
    antiPatternMaxCount: num('antiPatternMaxCount'),
    hardConstraintMaxCount: num('hardConstraintMaxCount'),
    personaAdaptedMinCount: num('personaAdaptedMinCount'),
    sedimentMaxCount: num('sedimentMaxCount'),
  };
}

/** 统计正文命中的人格适配 marker 数（每个 marker 至多计一次；命中 ≥2 即视为已适配）——见上方再导出 */
function isFileLines(v: unknown): v is FileLines {
  return (
    v !== null &&
    typeof v === 'object' &&
    typeof (v as FileLines).path === 'string' &&
    typeof (v as FileLines).lines === 'number'
  );
}

/** 计算复杂度报告（fail-closed：空/畸形输入抛 ComplexityFormatError，STRUCTURE 语义由 CLI 层映射） */
export function computeComplexityReport(m: ComplexityMeasurement): ComplexityReport {
  if (m === null || typeof m !== 'object' || Array.isArray(m)) {
    throw new ComplexityFormatError('度量输入不是对象');
  }
  const refs = (m as { referencesFiles?: unknown }).referencesFiles;
  const scripts = (m as { scriptFiles?: unknown }).scriptFiles;
  if (!Array.isArray(refs) || !Array.isArray(scripts)) {
    throw new ComplexityFormatError('referencesFiles/scriptFiles 缺数组');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 守卫对运行时输入的逐项形态校验（fail-closed）
  for (const f of [...refs, ...scripts] as any[]) {
    if (!isFileLines(f)) throw new ComplexityFormatError('FileLines 条目缺 path/lines');
  }
  const oversizedReferences = refs.filter((f) => f.lines > COMPLEXITY_DEFAULT_MAX_LINES);
  const oversizedScripts = scripts.filter((f) => f.lines > COMPLEXITY_DEFAULT_MAX_LINES);
  return {
    oversizedReferences,
    oversizedScripts,
    m,
    generatedAt: new Date().toISOString(),
  };
}

function capFor(exceptions: Record<string, number>, def: number, path: string): number {
  // eslint-disable-next-line security/detect-object-injection -- path 来自采集器 FileLines.path（采集自身 readdir 枚举的受控路径），非外部输入
  return Object.prototype.hasOwnProperty.call(exceptions, path) ? exceptions[path]! : def;
}

/** 棘轮预算校验：passed 仅当全部维度 ≤/≥ cap；violations 逐条带实测值与 cap */
export function checkComplexityBudget(
  m: ComplexityMeasurement,
  caps: BudgetCaps,
): { passed: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const f of m.referencesFiles) {
    const cap = capFor(caps.referencesExceptions, caps.referencesDefaultMaxLines, f.path);
    if (f.lines > cap) violations.push(`${f.path} ${f.lines} > cap ${cap}`);
  }
  for (const f of m.scriptFiles) {
    const cap = capFor(caps.scriptsExceptions, caps.scriptsDefaultMaxLines, f.path);
    if (f.lines > cap) violations.push(`${f.path} ${f.lines} > cap ${cap}`);
  }
  if (m.antiPatternCount > caps.antiPatternMaxCount) {
    violations.push(`antiPatternCount ${m.antiPatternCount} > cap ${caps.antiPatternMaxCount}`);
  }
  if (m.hardConstraintCount > caps.hardConstraintMaxCount) {
    violations.push(`hardConstraintCount ${m.hardConstraintCount} > cap ${caps.hardConstraintMaxCount}`);
  }
  if (m.personaAdaptedCount < caps.personaAdaptedMinCount) {
    violations.push(`personaAdaptedCount ${m.personaAdaptedCount} < cap ${caps.personaAdaptedMinCount}`);
  }
  if (m.sedimentCount > caps.sedimentMaxCount) {
    violations.push(`sedimentCount ${m.sedimentCount} > cap ${caps.sedimentMaxCount}`);
  }
  return { passed: violations.length === 0, violations };
}
