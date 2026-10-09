// w-model-dev/scripts/logic/rule-lifecycle-logic.ts
/**
 * M2 规则生命周期——退役候选三判据纯函数层（零 fs，由 dependency-boundaries 强制）。
 *
 * 对应 CLI wm-rule-lifecycle.ts（43.5.0 批次 5）：把登记册 → 活文档引用 / gate-logs 出现面
 * 的判定做成可复现的确定性纯函数，I/O 采集（登记册读盘、活文档正文、gate-log 文件名）在 CLI 层。
 *
 * 退役候选三判据（全满足才是候选）：
 *   ① 活文档引用零命中（判据锚见下方「判据锚（真实语料校准）」节）
 *   ② boundScript 为 null，或该脚本名在 gate-logs 语料中零出现
 *   ③ 存续 ≥10 个 minor（登记册 v1 无 introducedVersion 字段——schema additionalProperties:false
 *      且字段未声明，首版全部条目视为自始存续，判据恒过）
 *
 * 「候选只报告不裁决」：本层只产出 candidates 清单（带 reasons 摘要），不写登记册、
 * 不返回退役建议之外的动作。
 */

import type { RegistryEntry } from './rule-registry-logic.js';

// ==================== 判据锚（43.5.0 L6 真实语料校准） ====================
//
// 计划原文锚 `[#/]?{N}（{title 前 6 字}` 对真实活文档命中不足/易批量误报（真实主流形态是
// 「反模式 #N」/「约束 #N」与编号区间，如 conventions.md「反模式 #41」、user-guide.md
// 「48 条流程反模式 #1~#48」）。实现时按真实引用语法形态重建为以下三种引用的并集：
//
//   (a) 具名编号引用：`反模式[ :=，、]*#?N`（ap）与 `约束[ :=，、]*#?N`（hc）。
//       主流形态：AGENTS.md「反模式 #18/#19」、command-reference.md「约束 #14 / 反模式 #38/#39」、
//       bdd.md「反模式 #45」、iceberg-sweep-guide.md「反模式：#44」。
//   (b) 裸编号令牌兜底：`#N` 单独成令牌（`(?!#N 更大编号)` 防 #1 命中 #10~）。
//       捕获真实语料中仅以编号区间/盘点语句引用规则而不用「反模式 N」字样的文档：
//       user-guide.md「48 条流程反模式 #1~#48」、quick-self-check.md「（#1~#48）」、
//       subagent-delegation.md「反模式（48 条，#1~#48）完整版」。
//   (c) boundScript 名（含去 `.ts`，见 boundScriptReferenced）出现在活文档正文——
//       command-reference.md / toolbox.md / phase-N 对各脚本名的引用。
//
// 候选规则（C1/C2）专用锚：候选登记形态 `候选…C[12]` / `C[12]（候选`——
// 真实形态：AGENTS.md「登记为候选反模式 C2（pending V 复审）」、SSoT「hard-constraints.md「C1（候选，pending V 复审）」节」、
// subagent-delegation.md「候选区 C2，pending V 复审」。裸 `\bC1\b`/`\bC2\b` 不采用——
// 会误吸收 C1-C10（需求覆盖门）、C1[AI生成代码]（mermaid 图节点）、ai-native 迁移 C1/C2 表。
//
// 校准验收（2026-10-09 真实仓库）：62 条 active 零误报；C1/C2 因活文档候选登记引用判 ① 命中 → 非候选，
// 结论写入任务报告「C1/C2 有明确非候选理由」。

/** ap-N 具名引用锚（反模式 #N / 反模式：N / 反模式 N） */
function apNamedAnchor(n: number): RegExp {
  // eslint-disable-next-line security/detect-non-literal-regexp -- n 为 registryNum 自登记册 id 解析出的纯数字（/^\d+$/），无数值注入面
  return new RegExp(`反模式[\\s:=：，、]*#?${n}(?![0-9])`);
}

/** hc-N 具名引用锚（约束 #N / 约束：N / 约束 N） */
function hcNamedAnchor(n: number): RegExp {
  // eslint-disable-next-line security/detect-non-literal-regexp -- 同上：n 为登记册 id 解析出的纯数字，无数值注入面
  return new RegExp(`约束[\\s:=：，、]*#?${n}(?![0-9])`);
}

/** 裸编号令牌兜底（#N 成令牌，且 N 后不接数字防 #1 命中 #10~） */
function bareHashAnchor(n: number): RegExp {
  // eslint-disable-next-line security/detect-non-literal-regexp -- 同上：n 为登记册 id 解析出的纯数字，无数值注入面
  return new RegExp(`#${n}(?![0-9])`);
}

/** 候选规则（C1/C2）候选登记形态锚（真实语料校准，见上方说明） */
function candidateRegistrationAnchor(id: string): RegExp {
  // eslint-disable-next-line security/detect-non-literal-regexp -- id 为登记册 schema 校验后的规则 id（候选词表 C1/C2），非用户输入
  return new RegExp(`候选[^）)\\n]{0,16}${id}|${id}[\\s:=：，、]*[（(][\\s]*候选`);
}

/** 从登记册 id 取编号（`ap-N` / `hc-N` → N；C1/C2 → null） */
function registryNum(id: string): { kind: 'anti-pattern' | 'hard-constraint'; n: number } | null {
  const m = /^(ap|hc)-(\d+)$/.exec(id);
  if (!m) return null;
  return {
    kind: m[1] === 'ap' ? 'anti-pattern' : 'hard-constraint',
    n: Number(m[2]),
  };
}

/** 判据①：活文档引用是否零命中（含编号锚 + boundScript 名锚；候选规则用候选登记锚） */
export function isLiveReferenced(rule: RegistryEntry, liveDocsText: string): boolean {
  if (rule.kind === 'candidate') {
    return candidateRegistrationAnchor(rule.id).test(liveDocsText);
  }
  const info = registryNum(rule.id);
  if (info !== null) {
    const named = info.kind === 'anti-pattern' ? apNamedAnchor(info.n) : hcNamedAnchor(info.n);
    if (named.test(liveDocsText)) return true;
    if (bareHashAnchor(info.n).test(liveDocsText)) return true;
  }
  return boundScriptReferenced(rule, liveDocsText);
}

/** boundScript 名（含去 .ts 形态）是否出现在活文档正文 */
export function boundScriptReferenced(rule: RegistryEntry, liveDocsText: string): boolean {
  if (rule.boundScript === null) return false;
  const name = rule.boundScript;
  return liveDocsText.includes(name) || liveDocsText.includes(name.replace(/\.ts$/, ''));
}

/**
 * 判据②：boundScript 是否在 gate-logs 语料中零出现。
 * @param gateLogScripts CLI 已归一的 script 段集合（文件名去 `<ISO>` 前缀与可选 `<uuid>` 前缀后的段）。
 *   匹配容忍历史命名漂移：段 === boundScript（含 .ts）/ 段 === boundScript 去 .ts /
 *   boundScript 去 .ts 以 `-` 拼接该段结尾（如 `iceberg-sweep` 段命中 `check-iceberg-sweep.ts`）。
 *   boundScript 为 null → 视为「空 gate 面」，判据 ② 通过（规则本身无脚本可核对）。
 */
export function gateLogAppears(boundScript: string | null, gateLogScripts: readonly string[]): boolean {
  if (boundScript === null) return false;
  const bare = boundScript.replace(/\.ts$/, '');
  return gateLogScripts.some((s) => s === boundScript || s === bare || bare.endsWith(`-${s}`));
}

/** 输入契约（cli 采集注入；logic 层零 fs） */
export interface LifecycleInput {
  /** 登记册全部条目（cli 读盘并经结构校验后注入） */
  rules: readonly RegistryEntry[];
  /** 所有活文档正文拼接（cli 采集；排除 hard-constraints.md 自身与登记册；缺项可容） */
  liveDocsText: string;
  /** gate-logs 归一化 script 段集合（cli 采集；目录缺失 = 空数组，corpus 标注由 CLI 处理） */
  gateLogScripts: readonly string[];
}

/** 一条退役候选（带 reasons 摘要） */
export interface CandidateFinding {
  id: string;
  reasons: string[];
}

/** 生命周期判定结果（只报告不裁决） */
export interface LifecycleVerdict {
  candidates: CandidateFinding[];
}

/**
 * 退役候选判定（三判据全满足才是候选）。
 * 判据③：登记册 v1 无 introducedVersion 字段，首版条目视为自始存续 ≥10 个 minor → 恒过。
 */
export function computeRuleLifecycle(input: LifecycleInput): LifecycleVerdict {
  const candidates: CandidateFinding[] = [];
  for (const rule of input.rules) {
    const reasons: string[] = [];
    // 判据①
    let c1: boolean;
    if (rule.kind === 'candidate') {
      c1 = candidateRegistrationAnchor(rule.id).test(input.liveDocsText);
    } else {
      const info = registryNum(rule.id);
      c1 =
        (info !== null &&
          (info.kind === 'anti-pattern' ? apNamedAnchor(info.n) : hcNamedAnchor(info.n)).test(input.liveDocsText)) ||
        (info !== null && bareHashAnchor(info.n).test(input.liveDocsText)) ||
        boundScriptReferenced(rule, input.liveDocsText);
    }
    if (c1) continue;
    reasons.push('① 活文档引用零命中');
    // 判据②
    const appears = gateLogAppears(rule.boundScript, input.gateLogScripts);
    if (rule.boundScript !== null && appears) continue;
    reasons.push(
      rule.boundScript === null
        ? '② boundScript 为 null（无守护脚本）'
        : `② boundScript ${rule.boundScript} 在 gate-logs 零出现`,
    );
    // 判据③（v1 首版恒过）
    reasons.push('③ 存续 ≥10 个 minor（登记册 v1 无 introducedVersion，首版条目视为自始存续）');
    candidates.push({ id: rule.id, reasons });
  }
  return { candidates };
}
