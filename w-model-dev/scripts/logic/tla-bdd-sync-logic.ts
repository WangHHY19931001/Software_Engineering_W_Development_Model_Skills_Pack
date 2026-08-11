/**
 * TLA+/BDD 同步校验纯逻辑（TLA-BDD Sync Logic）—— 防止 TLA+ 规格与 BDD features 漂移
 *
 * 对应 P3-10：TLA+ 转移/状态/不变式 与 BDD Background 状态机七要素的自动化比对。
 *
 * 设计依据：
 *   - SSoT §3.4.18 第22轮第9点（check-tla-bdd-sync.ts 新增脚本）：从 TLA+ 抽取转移名
 *     （`Next == \/ Act1 \/ Act2`）/ 状态名（`vars` 声明）/ 不变式名，从 BDD feature
 *     Background 节抽取状态机七要素，diff 比对两者差异。退出码 0=一致 / 1=有差异 / 2=输入错误。
 *   - SSoT §3.4.14 第19轮 BDD 建模：BDD features 作为可执行规格，TLA+ 作为行为正确性基准，
 *     二者通过等价性校验互锁（状态集等价 + 初始状态一致 + 转移集等价 + 不变式归一化匹配）；
 *     不等价时走 R→V→G→S-fix 循环（反模式 #29：BDD 建模与需求/设计/TLA+ 不符未回退）。
 *
 * 设计原则（与 tla-logic.ts / bdd-logic.ts 一致）：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状，不 import 外部模块（A2b 复用 lib/types.js 的 StructuredViolation 类型除外）
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用
 *   3. 单点事实：所有「TLA+ 与 BDD 是否同步」的判定均委托至此
 *
 * 调用方：
 *   - CLI 脚本 check-tla-bdd-sync.ts（读 .tla 与 .feature 文件后注入文本）
 *
 * 注意：本文件只做文本正则抽取与集合 diff，不解析 manifest 结构
 *   （那是 tla-logic.ts / bdd-logic.ts 的职责）。
 */

import type { StructuredViolation } from '../lib/types.js';

export interface TlaBddSyncViolation {
  dimension: 'transition' | 'state' | 'invariant';
  tlaName: string;
  bddName: string | null;
  description: string;
}

/**
 * A2b 双轨过渡：TLA+/BDD 同步结构化违规规则 ID。
 * 命名：TLA_BDD_<类别>，对应 transition/state/invariant 三类比对规则。
 *
 * 规则 ID → 设计依据映射：
 *   - TRANSITION：转移集等价（SSoT §3.4.14 第4点「BDD↔TLA+ 等价性校验」转移集等价；
 *       防漂移反模式 #29——BDD 建模与 TLA+ 不符未回退）
 *   - STATE：状态集等价（SSoT §3.4.14 第4点「状态集等价 + 初始状态一致」）
 *   - INVARIANT：不变式归一化匹配（SSoT §3.4.14 第4点「不变式归一化匹配」）
 */
const TLA_BDD_RULES = {
  TRANSITION: 'TLA_BDD_TRANSITION',
  STATE: 'TLA_BDD_STATE',
  INVARIANT: 'TLA_BDD_INVARIANT',
} as const;

export interface TlaBddSyncResult {
  passed: boolean;
  violations: TlaBddSyncViolation[];
  /** A2b 双轨过渡：结构化违规（rule/field/message），可选字段向后兼容 */
  structuredViolations?: StructuredViolation[];
  tlaTransitions: string[];
  bddTransitions: string[];
  tlaStates: string[];
  bddStates: string[];
  tlaInvariants: string[];
  bddInvariants: string[];
}

/** TLA+ 关键字黑名单：抽取状态变量时排除（VARIABLES 声明中仅保留业务变量，不含语言关键字） */
const TLA_KEYWORD_BLACKLIST = ['VARIABLES', 'CONSTANTS', 'EXTENDS', 'MODULE'] as const;

/** TLA+ 定义名黑名单：抽取不变式时排除（Next/Init/vars 等非不变式定义，避免误判为不变式） */
const TLA_DEF_BLACKLIST = ['Next', 'Init', 'vars', 'VARIABLES', 'CONSTANTS', 'EXTENDS', 'MODULE'] as const;

/**
 * 从 TLA+ 内容抽取转移名（SSoT §3.4.18 第22轮第9点：从 TLA+ 抽取转移名）。
 * 匹配 Next == \/ Act1 \/ Act2 格式（TLA+ 析取运算符 \/）。
 *
 * 支持 \E 量化形式：`\/ \E var \in set : ActionName` 提取 ActionName。
 * Next 体边界：以 \n\n / \n\(\* / Spec == / ==== / EOF 终结（不吞入无关定义）。
 *
 * 注意：prefix 正则不消费首个 `\/`，使其保留在 body 中，
 * 这样 matchAll 能统一抽取所有 `\/` 后的转移名（含第一个）。
 */
export function extractTlaTransitions(tlaContent: string): string[] {
  const transitions: string[] = [];
  const nextMatch = tlaContent.match(/Next\s*==\s*([\s\S]+?)(?:\n\n|\n\(\*|\n\w+\s*==|\n====|$)/);
  if (nextMatch && nextMatch[1]) {
    const nextBody = nextMatch[1];
    const matches = nextBody.matchAll(/\\\/\s*(?:\\E\s*[^:]+:\s*)?([A-Za-z_][A-Za-z0-9_]*)/g);
    for (const m of matches) {
      if (m[1]) transitions.push(m[1]);
    }
  }
  return transitions;
}

/**
 * 从 TLA+ 内容抽取状态变量名（SSoT §3.4.18 第22轮第9点：从 TLA+ 抽取状态名）。
 * 匹配 VARIABLES var1 var2 ... 格式（或 VARIABLE 单数形式）。
 * 支持多行 VARIABLES 声明（变量跨多行以逗号分隔）。
 */
export function extractTlaStates(tlaContent: string): string[] {
  const states: string[] = [];
  const varsStartMatch = tlaContent.match(/VARIABLES?\s+/);
  if (!varsStartMatch) return states;
  const afterVars = tlaContent.slice(varsStartMatch.index! + varsStartMatch[0].length);
  const endMatch = afterVars.match(/\n\w+\s*==|\n====|^$/m);
  const varsBody = endMatch ? afterVars.slice(0, endMatch.index) : afterVars;
  const matches = varsBody.matchAll(/([A-Za-z_][A-Za-z0-9_]*)/g);
  for (const m of matches) {
    const name = m[1];
    if (name && !TLA_KEYWORD_BLACKLIST.includes(name as (typeof TLA_KEYWORD_BLACKLIST)[number])) {
      states.push(name);
    }
  }
  return states;
}

/**
 * 从 TLA+ 内容抽取不变式名（SSoT §3.4.18 第22轮第9点：从 TLA+ 抽取不变式名）。
 * 匹配 InvName == ... 格式，并按命名启发过滤（含 Inv / Type / Invariant 子串）。
 */
export function extractTlaInvariants(tlaContent: string): string[] {
  const invariants: string[] = [];
  const matches = tlaContent.matchAll(/^([A-Za-z_][A-Za-z0-9_]*)\s*==\s*.*?(?:\n(?!\s)|$)/gm);
  for (const m of matches) {
    const name = m[1];
    if (!name) continue;
    // 排除已知非不变式名称
    if (TLA_DEF_BLACKLIST.includes(name as (typeof TLA_DEF_BLACKLIST)[number])) {
      continue;
    }
    // 简单启发：不变式通常包含 Inv 或 Type 前缀
    // （与 W 模型 TLA+ 命名约定一致：不变式名含 Inv/Type/Invariant，见 SSoT §3.4.18 抽取规则）
    if (name.includes('Inv') || name.includes('Type') || name.includes('Invariant')) {
      invariants.push(name);
    }
  }
  return invariants;
}

/**
 * 从 BDD feature 内容抽取状态机七要素（SSoT §3.4.14 第2-3点：第2点 Background 节声明状态机七要素，第3点状态机七要素约束）。
 * 提取来源：
 *   - `# @states: value1, value2, ...` 注释声明（状态名）
 *   - `# @transitions:` 块注释声明（事件名：A + event -> B 的 event 部分）
 *   - Background 节 Given/When/Then 步骤
 *   - Scenario 体 Given/When/Then 步骤
 * - Given → 状态（取末尾 token）
 * - When  → 转移（取首 token）
 * - Then  → 不变式（取首 token）
 */
export function extractBddStateMachine(featureContent: string): {
  states: string[];
  transitions: string[];
  invariants: string[];
} {
  const states: string[] = [];
  const transitions: string[] = [];
  const invariants: string[] = [];

  // 1. 从 # @states: 注释提取状态名
  const statesMatch = featureContent.match(/^\s*#\s*@states:\s*(.+?)\s*$/m);
  if (statesMatch && statesMatch[1]) {
    for (const s of statesMatch[1].split(',').map((x) => x.trim())) {
      if (s) states.push(s);
    }
  }

  // 2. 从 # @transitions: 块提取事件名（A + event -> B 的 event 部分）
  const transBlockMatch = featureContent.match(/#\s*@transitions:\s*\n([\s\S]*?)(?:\n\s*#\s*@\w+:|$)/);
  if (transBlockMatch && transBlockMatch[1]) {
    const transPattern = /^[^+\n]*\+\s*(\w+)\s*->/gm;
    let m: RegExpExecArray | null;
    while ((m = transPattern.exec(transBlockMatch[1])) !== null) {
      const evt = m[1];
      if (evt) transitions.push(evt);
    }
  }

  // 3. 从 # @invariants: 块提取不变式名（首 token）
  const invBlockMatch = featureContent.match(/#\s*@invariants:\s*\n([\s\S]*?)(?:\n\s*#\s*@\w+:|$)/);
  if (invBlockMatch && invBlockMatch[1]) {
    const invPattern = /^\s*#\s+(\w+)/gm;
    let m: RegExpExecArray | null;
    while ((m = invPattern.exec(invBlockMatch[1])) !== null) {
      const name = m[1];
      if (name) invariants.push(name);
    }
  }

  // 4. 提取 Background 节和 Scenario 体的 Given/When/Then 步骤
  const bgMatch = featureContent.match(/Background:\s*([\s\S]+?)(?:\n\s*Scenario|\n@|$)/);
  const bgContent = bgMatch && bgMatch[1] ? bgMatch[1] : '';
  const scenarioMatches = [
    ...featureContent.matchAll(/Scenario(?: Outline)?:\s*[^\n]*\n([\s\S]*?)(?=\n\s*Scenario|\n@|$)/g),
  ];
  const scenarioContent = scenarioMatches.map((m) => m[1]).join('\n');
  const allStepsContent = bgContent + '\n' + scenarioContent;

  // Given → 状态（末尾 token）
  const givenMatches = allStepsContent.matchAll(/Given\s+(.+)/g);
  for (const m of givenMatches) {
    const grp = m[1];
    if (!grp) continue;
    const parts = grp.trim().split(/\s+/);
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      if (last) states.push(last);
    }
  }

  // When → 转移（首 token）
  const whenMatches = allStepsContent.matchAll(/When\s+(.+)/g);
  for (const m of whenMatches) {
    const grp = m[1];
    if (!grp) continue;
    const parts = grp.trim().split(/\s+/);
    if (parts.length >= 1) {
      const first = parts[0];
      if (first) transitions.push(first);
    }
  }

  // Then → 不变式（首 token）
  const thenMatches = allStepsContent.matchAll(/Then\s+(.+)/g);
  for (const m of thenMatches) {
    const grp = m[1];
    if (!grp) continue;
    const parts = grp.trim().split(/\s+/);
    if (parts.length >= 1) {
      const first = parts[0];
      if (first) invariants.push(first);
    }
  }

  return {
    states: [...new Set(states)],
    transitions: [...new Set(transitions)],
    invariants: [...new Set(invariants)],
  };
}

/**
 * diff 比对 TLA+ 与 BDD 的转移/状态/不变式（TLA+ 与 BDD 状态机同步判定，单点事实源）。
 *
 * 设计依据：SSoT §3.4.18 第22轮第9点（check-tla-bdd-sync.ts）+ SSoT §3.4.14 第4点
 * （BDD↔TLA+ 等价性校验：状态集等价 + 初始状态一致 + 转移集等价 + 不变式归一化匹配）。
 *
 * 状态集合提取规则：
 *   - TLA+ 侧：extractTlaTransitions（Next == \/ 分支）/ extractTlaStates（VARIABLES 声明）/
 *     extractTlaInvariants（命名启发含 Inv/Type/Invariant 的定义）
 *   - BDD 侧：extractBddStateMachine（# @states / # @transitions / # @invariants 注释块
 *     + Background/Scenario 的 Given/When/Then 步骤）
 *
 * transition 对齐判定（双向严格集合比对）：
 *   - TLA+ Next 中的 \/ 分支名 ↔ BDD When 首 token，双向必须一一对应
 *   - BDD feature 缺失 transition 时以 TLA+ 为基准：TLA+ 声明了但 BDD 无对应 When → 违规
 *     （对应反模式 #29：BDD features 必须忠实于 TLA+ 基准，不得擅自裁剪转移）
 *
 * 比对策略：
 *   - 转移：双向严格集合比对（TLA+ Next 中的 \/ 分支名 ↔ BDD When 首 token）
 *   - 状态：单向宽松比对（TLA+ VARIABLES 中的变量须在 BDD Given 末尾 token 中找到子串匹配）
 *   - 不变式：单向宽松比对（TLA+ Inv/Type/Invariant 名须在 BDD Then 首 token 中找到子串匹配）
 *
 * 边界处理：
 *   - 状态/不变式为单向比对（宽松子串匹配，容忍命名差异），仅记录「TLA+ 有而 BDD 无」；
 *     反向「BDD 有而 TLA+ 无」不报——以 TLA+ 为行为正确性基准（SSoT §3.4.14）
 *   - 转移为双向严格比对：BDD 多出 TLA+ 未声明的转移同样报违规（防止 BDD 擅自扩展）
 */
export function checkTlaBddSync(tlaContent: string, featureContent: string): TlaBddSyncResult {
  const tlaTransitions = extractTlaTransitions(tlaContent);
  const tlaStates = extractTlaStates(tlaContent);
  const tlaInvariants = extractTlaInvariants(tlaContent);

  const bdd = extractBddStateMachine(featureContent);

  const violations: TlaBddSyncViolation[] = [];
  const structuredViolations: StructuredViolation[] = [];

  // 转移比对（双向严格）：TLA+ Next 分支 ↔ BDD When 首 token 须一一对应
  // 任一方向缺失均违规（BDD feature 缺失 transition 时以 TLA+ 为基准判定；
  // BDD 多出的转移同样报违规，防止 BDD 擅自扩展——反模式 #29）
  for (const t of tlaTransitions) {
    if (!bdd.transitions.includes(t)) {
      const msg = `TLA+ 转移 "${t}" 在 BDD 中未找到对应 When 步骤`;
      violations.push({
        dimension: 'transition',
        tlaName: t,
        bddName: null,
        description: msg,
      });
      structuredViolations.push({ rule: TLA_BDD_RULES.TRANSITION, field: 'tlaTransitions', message: msg });
    }
  }
  for (const b of bdd.transitions) {
    if (!tlaTransitions.includes(b)) {
      const msg = `BDD 转移 "${b}" 在 TLA+ Next 中未找到`;
      violations.push({
        dimension: 'transition',
        tlaName: b,
        bddName: b,
        description: msg,
      });
      structuredViolations.push({ rule: TLA_BDD_RULES.TRANSITION, field: 'bddTransitions', message: msg });
    }
  }

  // 状态比对（BDD 状态名可能映射到 TLA+ 变量）
  // 状态比对较宽松（子串双向包含匹配，容忍命名差异），只记录 TLA+ 有但 BDD 无的状态
  // —— 以 TLA+ 为行为正确性基准（SSoT §3.4.14），BDD 多出的状态不报违规
  for (const s of tlaStates) {
    if (
      !bdd.states.some((bs) => bs.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(bs.toLowerCase()))
    ) {
      const msg = `TLA+ 状态变量 "${s}" 在 BDD Given 中未找到对应`;
      violations.push({
        dimension: 'state',
        tlaName: s,
        bddName: null,
        description: msg,
      });
      structuredViolations.push({ rule: TLA_BDD_RULES.STATE, field: 'tlaStates', message: msg });
    }
  }

  // 不变式比对（单向宽松）：TLA+ Inv/Type/Invariant 名须在 BDD Then 首 token 中找到子串匹配
  // 与状态比对一致，以 TLA+ 为基准，BDD 多出的不变式不报（SSoT §3.4.14 不变式归一化匹配）
  for (const inv of tlaInvariants) {
    if (
      !bdd.invariants.some(
        (bi) => bi.toLowerCase().includes(inv.toLowerCase()) || inv.toLowerCase().includes(bi.toLowerCase()),
      )
    ) {
      const msg = `TLA+ 不变式 "${inv}" 在 BDD Then 中未找到对应`;
      violations.push({
        dimension: 'invariant',
        tlaName: inv,
        bddName: null,
        description: msg,
      });
      structuredViolations.push({ rule: TLA_BDD_RULES.INVARIANT, field: 'tlaInvariants', message: msg });
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    structuredViolations,
    tlaTransitions,
    bddTransitions: bdd.transitions,
    tlaStates,
    bddStates: bdd.states,
    tlaInvariants,
    bddInvariants: bdd.invariants,
  };
}
