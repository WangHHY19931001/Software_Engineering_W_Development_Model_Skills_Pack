/**
 * TLA+/BDD 同步校验纯逻辑（TLA-BDD Sync Logic）—— 防止 TLA+ 规格与 BDD features 漂移
 *
 * 对应 P3-10：TLA+ 转移/状态/不变式 与 BDD Background 状态机七要素的自动化比对。
 *
 * 设计原则（与 tla-logic.ts / bdd-logic.ts 一致）：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状，不 import 外部模块
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用
 *   3. 单点事实：所有「TLA+ 与 BDD 是否同步」的判定均委托至此
 *
 * 调用方：
 *   - CLI 脚本 check-tla-bdd-sync.ts（读 .tla 与 .feature 文件后注入文本）
 *
 * 注意：本文件只做文本正则抽取与集合 diff，不解析 manifest 结构
 *   （那是 tla-logic.ts / bdd-logic.ts 的职责）。
 */

export interface TlaBddSyncViolation {
  dimension: 'transition' | 'state' | 'invariant';
  tlaName: string;
  bddName: string | null;
  description: string;
}

export interface TlaBddSyncResult {
  passed: boolean;
  violations: TlaBddSyncViolation[];
  tlaTransitions: string[];
  bddTransitions: string[];
  tlaStates: string[];
  bddStates: string[];
  tlaInvariants: string[];
  bddInvariants: string[];
}

/** TLA+ 关键字黑名单：抽取状态变量时排除 */
const TLA_KEYWORD_BLACKLIST = [
  'VARIABLES',
  'CONSTANTS',
  'EXTENDS',
  'MODULE',
] as const;

/** TLA+ 定义名黑名单：抽取不变式时排除（非不变式定义） */
const TLA_DEF_BLACKLIST = [
  'Next',
  'Init',
  'vars',
  'VARIABLES',
  'CONSTANTS',
  'EXTENDS',
  'MODULE',
] as const;

/**
 * 从 TLA+ 内容抽取转移名。
 * 匹配 Next == \/ Act1 \/ Act2 格式（TLA+ 析取运算符 \/）。
 *
 * 注意：prefix 正则不消费首个 `\/`，使其保留在 body 中，
 * 这样 matchAll 能统一抽取所有 `\/` 后的转移名（含第一个）。
 */
export function extractTlaTransitions(tlaContent: string): string[] {
  const transitions: string[] = [];
  const nextMatch = tlaContent.match(/Next\s*==\s*([\s\S]+?)(?:\n\n|\n\(\*|$)/);
  if (nextMatch && nextMatch[1]) {
    const nextBody = nextMatch[1];
    const matches = nextBody.matchAll(/\\\/\s*([A-Za-z_][A-Za-z0-9_]*)/g);
    for (const m of matches) {
      if (m[1]) transitions.push(m[1]);
    }
  }
  return transitions;
}

/**
 * 从 TLA+ 内容抽取状态变量名。
 * 匹配 VARIABLES var1 var2 ... 格式（或 VARIABLE 单数形式）。
 */
export function extractTlaStates(tlaContent: string): string[] {
  const states: string[] = [];
  const varsMatch = tlaContent.match(/VARIABLES?\s+([\s\S]+?)(?:\n|$)/);
  if (varsMatch && varsMatch[1]) {
    const varsBody = varsMatch[1];
    const matches = varsBody.matchAll(/([A-Za-z_][A-Za-z0-9_]*)/g);
    for (const m of matches) {
      const name = m[1];
      if (name && !TLA_KEYWORD_BLACKLIST.includes(name as typeof TLA_KEYWORD_BLACKLIST[number])) {
        states.push(name);
      }
    }
  }
  return states;
}

/**
 * 从 TLA+ 内容抽取不变式名。
 * 匹配 InvName == ... 格式，并按命名启发过滤（含 Inv / Type / Invariant 子串）。
 */
export function extractTlaInvariants(tlaContent: string): string[] {
  const invariants: string[] = [];
  const matches = tlaContent.matchAll(/^([A-Za-z_][A-Za-z0-9_]*)\s*==\s*.*?(?:\n(?!\s)|$)/gm);
  for (const m of matches) {
    const name = m[1];
    if (!name) continue;
    // 排除已知非不变式名称
    if (TLA_DEF_BLACKLIST.includes(name as typeof TLA_DEF_BLACKLIST[number])) {
      continue;
    }
    // 简单启发：不变式通常包含 Inv 或 Type 前缀
    if (name.includes('Inv') || name.includes('Type') || name.includes('Invariant')) {
      invariants.push(name);
    }
  }
  return invariants;
}

/**
 * 从 BDD feature 内容抽取 Background 节的状态机七要素。
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

  const bgMatch = featureContent.match(/Background:\s*([\s\S]+?)(?:\nScenario|\n@|$)/);
  const bgContent = bgMatch && bgMatch[1] ? bgMatch[1] : featureContent;

  // Given → 状态
  const givenMatches = bgContent.matchAll(/Given\s+(.+)/g);
  for (const m of givenMatches) {
    const grp = m[1];
    if (!grp) continue;
    const parts = grp.trim().split(/\s+/);
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      if (last) states.push(last);
    }
  }

  // When → 转移
  const whenMatches = bgContent.matchAll(/When\s+(.+)/g);
  for (const m of whenMatches) {
    const grp = m[1];
    if (!grp) continue;
    const parts = grp.trim().split(/\s+/);
    if (parts.length >= 1) {
      const first = parts[0];
      if (first) transitions.push(first);
    }
  }

  // Then → 不变式
  const thenMatches = bgContent.matchAll(/Then\s+(.+)/g);
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
 * diff 比对 TLA+ 与 BDD 的转移/状态/不变式。
 *
 * 比对策略：
 *   - 转移：双向严格集合比对（TLA+ Next 中的 \/ 分支名 ↔ BDD When 首 token）
 *   - 状态：单向宽松比对（TLA+ VARIABLES 中的变量须在 BDD Given 末尾 token 中找到子串匹配）
 *   - 不变式：单向宽松比对（TLA+ Inv/Type/Invariant 名须在 BDD Then 首 token 中找到子串匹配）
 */
export function checkTlaBddSync(tlaContent: string, featureContent: string): TlaBddSyncResult {
  const tlaTransitions = extractTlaTransitions(tlaContent);
  const tlaStates = extractTlaStates(tlaContent);
  const tlaInvariants = extractTlaInvariants(tlaContent);

  const bdd = extractBddStateMachine(featureContent);

  const violations: TlaBddSyncViolation[] = [];

  // 转移比对（双向严格）
  for (const t of tlaTransitions) {
    if (!bdd.transitions.includes(t)) {
      violations.push({
        dimension: 'transition',
        tlaName: t,
        bddName: null,
        description: `TLA+ 转移 "${t}" 在 BDD 中未找到对应 When 步骤`,
      });
    }
  }
  for (const b of bdd.transitions) {
    if (!tlaTransitions.includes(b)) {
      violations.push({
        dimension: 'transition',
        tlaName: b,
        bddName: b,
        description: `BDD 转移 "${b}" 在 TLA+ Next 中未找到`,
      });
    }
  }

  // 状态比对（BDD 状态名可能映射到 TLA+ 变量）
  // 状态比对较宽松，只记录 TLA+ 有但 BDD 无的状态
  for (const s of tlaStates) {
    if (!bdd.states.some(bs => bs.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(bs.toLowerCase()))) {
      violations.push({
        dimension: 'state',
        tlaName: s,
        bddName: null,
        description: `TLA+ 状态变量 "${s}" 在 BDD Given 中未找到对应`,
      });
    }
  }

  // 不变式比对
  for (const inv of tlaInvariants) {
    if (!bdd.invariants.some(bi => bi.toLowerCase().includes(inv.toLowerCase()) || inv.toLowerCase().includes(bi.toLowerCase()))) {
      violations.push({
        dimension: 'invariant',
        tlaName: inv,
        bddName: null,
        description: `TLA+ 不变式 "${inv}" 在 BDD Then 中未找到对应`,
      });
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    tlaTransitions,
    bddTransitions: bdd.transitions,
    tlaStates,
    bddStates: bdd.states,
    tlaInvariants,
    bddInvariants: bdd.invariants,
  };
}
