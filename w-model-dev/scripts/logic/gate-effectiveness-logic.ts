// w-model-dev/scripts/logic/gate-effectiveness-logic.ts
/**
 * M3 门禁效能聚合——纯函数层（零 fs，由 dependency-boundaries 强制）。
 *
 * 对应 CLI wm-gate-effectiveness.ts（43.5.0 批次 7）：把 gate-logs 语料 → 每个门禁的效能聚合
 * （runs / blocked(exitCode=1) / errors(exitCode=2) / lastFired / distinctTriggers）做成可复现的
 * 确定性纯函数；I/O（目录遍历、读盘、JSON 解析、文件名归一）在 CLI 层完成并注入本层。
 *
 * 排序契约（确定性）：runs 降序；同 runs 按 script 字典序（码位序）。
 *
 * 只报告不裁决：聚合结果仅供 M4 定期简化检查点的人类评审消费——零阻断门禁是「降级候选
 * （预防性门禁 0 阻断 ≠ 无用，只提交人类评审，不自动降级）」，不在此层作任何判定。
 */

/** 一条已解析的 gate-log 记录（CLI 注入；schema-free，本层不做过度解析） */
export interface GateLogEntry {
  /** 归一化脚本名（content `script` 字段或文件名回退）；null = 回退失败（formatFallback，不计 runs） */
  script: string | null;
  /** 原始（任意 JSON 值）exitCode —— 按 `=== 1`（blocked）/ `=== 2`（errors）计数 */
  exitCode: unknown;
  /** reportSummary（未知形态；仅对可辨识触发键做尽力而为的枚举去重） */
  reportSummary?: unknown;
  /** 文件名 ISO 段原始串（如 `2026-08-24T17-31-23-175Z`）；缺失则本记录不贡献 lastFired */
  iso?: string;
}

/** 单个门禁的效能聚合 */
export interface GateEffectiveness {
  script: string;
  runs: number;
  /** exitCode === 1 的守卫阻断次数 */
  blocked: number;
  /** exitCode === 2 的输入/运行错误次数 */
  errors: number;
  /** 末次触发：文件名 ISO 段取 max 的原始串（无 ISO 记录时省略） */
  lastFired?: string;
  /** 触发枚举去重（reportSummary 可辨识键值，尽力而为；无则省略该字段） */
  distinctTriggers?: string[];
}

/** 聚合结果（gates 已按 runs 降序、同 runs 按 script 字典序排序） */
export interface GateEffectivenessVerdict {
  gates: GateEffectiveness[];
}

/**
 * reportSummary 中视为「触发/调用形态判别键」的字符串键白名单（schema-free 尽力而为，不做过度解析）。
 * 既有真实语料：iceberg-sweep 报告含 `triggerType`（ICEBERG-A/B）；preventive-review 报告含
 * `variant`（standard/fix/emergency/ingest）——两者都是门禁的调用形态枚举，统一按 distinctTriggers 消费。
 */
const TRIGGER_KEYS: readonly string[] = ['triggerType', 'variant'];

/** 从 reportSummary 对象提取可辨识触发枚举值（非对象 / 非字符串空值一律忽略） */
function collectTriggerValues(reportSummary: unknown): string[] {
  if (reportSummary === null || typeof reportSummary !== 'object' || Array.isArray(reportSummary)) return [];
  const values: string[] = [];
  for (const key of TRIGGER_KEYS) {
    // eslint-disable-next-line security/detect-object-injection -- TRIGGER_KEYS 为编译期固定白名单（triggerType/variant），非外部键注入
    const value = (reportSummary as Record<string, unknown>)[key];
    if (typeof value === 'string' && value !== '') values.push(value);
  }
  return values;
}

/**
 * 按门禁聚合注入的已解析记录。
 * @param entries CLI 已解析并归一的 gate-log 记录（script 为 null 的 formatFallback 条目不计入 runs）。
 */
export function computeGateEffectiveness(entries: readonly GateLogEntry[]): GateEffectivenessVerdict {
  const byScript = new Map<
    string,
    {
      runs: number;
      blocked: number;
      errors: number;
      lastFired: string | null;
      triggers: Set<string>;
    }
  >();
  for (const entry of entries) {
    if (entry.script === null) continue; // formatFallback：CLI 已标注，不计 runs
    let acc = byScript.get(entry.script);
    if (acc === undefined) {
      acc = {
        runs: 0,
        blocked: 0,
        errors: 0,
        lastFired: null,
        triggers: new Set(),
      };
      byScript.set(entry.script, acc);
    }
    acc.runs += 1;
    if (entry.exitCode === 1) acc.blocked += 1;
    if (entry.exitCode === 2) acc.errors += 1;
    // lastFired：ISO 定宽格式按码位比较即时序 max；与 wm-rule-lifecycle 的 GATE_LOG_ISO_RE 同口径
    if (entry.iso !== undefined && entry.iso !== '' && (acc.lastFired === null || entry.iso > acc.lastFired)) {
      acc.lastFired = entry.iso;
    }
    for (const value of collectTriggerValues(entry.reportSummary)) acc.triggers.add(value);
  }
  const gates: GateEffectiveness[] = [...byScript.entries()]
    .map(([script, acc]) => {
      const gate: GateEffectiveness = {
        script,
        runs: acc.runs,
        blocked: acc.blocked,
        errors: acc.errors,
      };
      if (acc.lastFired !== null) gate.lastFired = acc.lastFired;
      const distinctTriggers = [...acc.triggers].sort();
      if (distinctTriggers.length > 0) gate.distinctTriggers = distinctTriggers;
      return gate;
    })
    .sort((a, b) => b.runs - a.runs || (a.script < b.script ? -1 : a.script > b.script ? 1 : 0));
  return { gates };
}
