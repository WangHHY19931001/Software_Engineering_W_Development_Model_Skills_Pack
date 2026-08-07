/**
 * BDD 模型校验纯逻辑（BDD Logic）—— 防止 BDD features/状态机建模漂移
 *
 * 对应 docs/superpowers/specs/2026-07-27-bdd-modeling-and-acceptance-fixture-design.md。
 * 校验：manifest 结构（schema 前置）+ features 头标注 + 状态机七要素完整性
 *   + BDD↔TLA+ 等价性 + scenario 路径合法性 + RTM 映射。
 *
 * 设计原则（与 tla-logic.ts / verifier-logic.ts / gate-logic.ts 一致）：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状，不 import 外部模块
 *      （schema-loader.ts 为同目录内部工具，不计为外部依赖）
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用
 *   3. 单点事实：所有「BDD features 是否符合规范」的判定均委托至此
 *
 * 调用方：
 *   - CLI 脚本 check-bdd-model.ts（供 G 子代理执行：读文件、解析 features、调本逻辑校验）
 *   - self-test.ts（驱动 samples/bdd/ 样本回归）
 *
 * 注意：本文件只做纯逻辑校验与纯函数解析，不执行 I/O（读文件是 CLI 的职责）。
 *   features 文件解析（parseFeatureHeader / parseBackgroundStateMachine / parseFeatureFile）
 *   与 TLA+ 快照解析（parseTlaSpecSnapshot）为纯函数，供 CLI 与 self-test 调用后
 *   将违反合并入最终结果。
 */

import { validateBySchema } from './schema-loader.js';

// ==================== 自包含类型形状 ====================

export type BddLevel = 1 | 2 | 3 | 4;

export interface BddFeature {
  id: string;
  level: BddLevel;
  filePath: string;
  scenarioCount: number;
  stateMachineId: string;
  tlaSpecId: string;
  reqIds: string[];
  designIds: string[];
  parentFeatureIds: string[];
  siblingFeatureIds: string[];
  childFeatureIds: string[];
}

export interface BddTransition {
  from: string;
  event: string;
  to: string;
  guard?: string;
  action?: string;
}

export interface BddStateMachine {
  id: string;
  level: BddLevel;
  states: string[];
  initialState: string;
  terminalStates: string[];
  acceptingStates: string[];
  rejectingStates: string[];
  transitions: BddTransition[];
  invariants: string[];
}

export interface BddManifest {
  schemaVersion: '1.0';
  projectId: string;
  basePath: string;
  currentPhase: number;
  features: BddFeature[];
  stateMachines: BddStateMachine[];
  /** SD 覆盖率数据（phase>=2 强制，由 S-ingest-bdd 回填） */
  designCoverage?: {
    totalSdNodes: number;
    coveredSdNodes: string[];
    uncoveredSdNodes: string[];
    coverageRate: number;
  };
  checkRounds?: Array<{
    phase: 1 | 2 | 3 | 4;
    round: number;
    timestamp: string;
    violations: string[];
    converged: boolean;
  }>;
}

// ==================== features 文件头解析（纯函数） ====================

export interface FeatureHeader {
  req: string[];
  design: string[];
  system: string;
  tlaSpec: string;
  stateMachine: string;
  parentFeatures: string[] | null | undefined;  // undefined=未声明, null='(none)', string[]=显式列表
  siblingFeatures: string[] | null | undefined;
  childFeatures: string[] | null | undefined;
  scenarioIdPrefix: string;
}

const HEADER_KEY_PATTERN = /^#\s*@([\w-]+):\s*(.+?)\s*$/;

/**
 * 解析 .feature 文件头注释块（在 `Feature:` 行之前的所有 `# @key: value` 行）。
 * 纯函数：输入字符串，输出结构化对象。
 */
export function parseFeatureHeader(content: string): { header: FeatureHeader; violations: string[] } {
  const violations: string[] = [];
  const lines = content.split('\n');
  const raw: Record<string, string> = {};

  let featureLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.match(/^\s*Feature:/)) {
      featureLineIndex = i;
      break;
    }
    const m = lines[i]!.match(HEADER_KEY_PATTERN);
    if (m) {
      raw[m[1]!] = m[2]!;
    }
  }

  if (featureLineIndex === -1) {
    violations.push('[header] missing Feature: line');
  }

  const parseList = (val: string | undefined): string[] | null | undefined => {
    if (val === undefined) return undefined;  // 未声明
    if (val === '(none)') return null;
    return val.split(',').map(s => s.trim()).filter(s => s.length > 0);
  };

  const required = ['req', 'design', 'system', 'tla-spec', 'state-machine', 'scenario-id-prefix'];
  for (const k of required) {
    if (raw[k] === undefined) {
      violations.push(`[header] missing required field @${k}`);
    }
  }

  // @parent-features / @child-features 必填（值可 '(none)'）；@sibling-features 可选
  if (raw['parent-features'] === undefined) {
    violations.push('[header] missing required field @parent-features');
  }
  if (raw['child-features'] === undefined) {
    violations.push('[header] missing required field @child-features');
  }

  const header: FeatureHeader = {
    req: raw['req'] ? raw['req'].split(',').map(s => s.trim()).filter(s => s.length > 0) : [],
    design: raw['design'] ? raw['design'].split(',').map(s => s.trim()).filter(s => s.length > 0) : [],
    system: raw['system'] ?? '',
    tlaSpec: raw['tla-spec'] ?? '',
    stateMachine: raw['state-machine'] ?? '',
    parentFeatures: parseList(raw['parent-features']),
    siblingFeatures: parseList(raw['sibling-features']),
    childFeatures: parseList(raw['child-features']),
    scenarioIdPrefix: raw['scenario-id-prefix'] ?? '',
  };

  return { header, violations };
}

// ==================== Background 状态机解析（纯函数） ====================

const TRANSITION_PATTERN =
  /^\s*#\s+(\w+)\s*\+\s*(\w+)\s*->\s*(\w+)\s*(?:\[guard:\s*(.+?)\s*\])?\s*(?:\[action:\s*(\w+)\s*\])?\s*$/;

/**
 * 解析 Background 节中的状态机七要素注释。
 * 纯函数：输入 Background 节文本，输出结构化对象。
 */
export function parseBackgroundStateMachine(
  backgroundContent: string
): { sm: Partial<BddStateMachine>; violations: string[] } {
  const violations: string[] = [];
  const lines = backgroundContent.split('\n');

  const sm: Partial<BddStateMachine> = {
    states: [],
    initialState: '',
    // terminalStates / rejectingStates 初始化为 undefined（而非 []），
    // 以区分「字段缺失」与「声明为空集 ()」—— validateStateMachineCompleteness 依赖 === undefined 判定缺失。
    terminalStates: undefined,
    acceptingStates: [],
    rejectingStates: undefined,
    transitions: [],
    invariants: [],
  };

  let inTransitionsBlock = false;
  let inInvariantsBlock = false;

  for (const line of lines) {
    const statesMatch = line.match(/^\s*#\s*@states:\s*(.+?)\s*$/);
    if (statesMatch) {
      sm.states = statesMatch[1]!.split(',').map(s => s.trim()).filter(s => s.length > 0);
      continue;
    }
    const initMatch = line.match(/^\s*#\s*@initial-state:\s*(\w+)\s*$/);
    if (initMatch) {
      sm.initialState = initMatch[1];
      continue;
    }
    const termMatch = line.match(/^\s*#\s*@terminal-states:\s*(.+?)\s*$/);
    if (termMatch) {
      const val = termMatch[1]!.trim();
      sm.terminalStates = val === '()' ? [] : val.split(',').map(s => s.trim()).filter(s => s.length > 0);
      continue;
    }
    const accMatch = line.match(/^\s*#\s*@accepting-states:\s*(.+?)\s*$/);
    if (accMatch) {
      const val = accMatch[1]!.trim();
      sm.acceptingStates = val === '()' ? [] : val.split(',').map(s => s.trim()).filter(s => s.length > 0);
      continue;
    }
    const rejMatch = line.match(/^\s*#\s*@rejecting-states:\s*(.+?)\s*$/);
    if (rejMatch) {
      const val = rejMatch[1]!.trim();
      sm.rejectingStates = val === '()' ? [] : val.split(',').map(s => s.trim()).filter(s => s.length > 0);
      continue;
    }
    if (line.match(/^\s*#\s*@transitions:\s*$/)) {
      inTransitionsBlock = true;
      inInvariantsBlock = false;
      continue;
    }
    if (line.match(/^\s*#\s*@invariants:\s*$/)) {
      inTransitionsBlock = false;
      inInvariantsBlock = true;
      continue;
    }
    if (line.match(/^\s*#\s*@\w+:/)) {
      // 其他 @key: 切换出 transitions/invariants 块
      inTransitionsBlock = false;
      inInvariantsBlock = false;
      continue;
    }
    const tMatch = line.match(TRANSITION_PATTERN);
    if (tMatch && inTransitionsBlock) {
      sm.transitions!.push({
        from: tMatch[1]!,
        event: tMatch[2]!,
        to: tMatch[3]!,
        guard: tMatch[4] || undefined,
        action: tMatch[5] || undefined,
      });
      continue;
    }
    const invMatch = line.match(/^\s*#\s+(.+?)\s*$/);
    if (invMatch && inInvariantsBlock) {
      sm.invariants!.push(invMatch[1]!);
      continue;
    }
  }

  return { sm, violations };
}

// ==================== features 文件全文解析（纯函数） ====================

/**
 * 解析 .feature 文件全文：头标注 + Background 状态机 + scenarios。
 * 纯函数：输入文件内容字符串（不读文件，I/O 由 CLI 负责），输出结构化对象。
 *
 * 语义基线（统一 check-bdd-model.ts 与 self-test.ts 的复制漂移，以 self-test 为准）：
 *   - events：When 与 And 步骤双取（`(?:When|And)`），行末单词为事件名；
 *     保留行末括号 `)` 容错（check-bdd-model.ts 原实现支持 `When 用户提交注册信息 (Register)` 格式）
 *   - expectedEndState：取第一个 Then 声明的状态（self-test 基线；check-bdd-model 原取最后一个）
 *   - startState（Given）/ invariantAssertions（Then|And 不变式）：两处原实现一致
 */
export function parseFeatureFile(
  content: string
): { header: FeatureHeader; stateMachine: Partial<BddStateMachine>; scenarios: ScenarioPathCheck[]; violations: string[] } {
  const { header, violations: headerViolations } = parseFeatureHeader(content);

  // 提取 Background 节
  const bgMatch = content.match(/Background:\n([\s\S]*?)(?=\n\s*Scenario:|\n\s*Scenario Outline:|$)/);
  const bgContent = bgMatch ? bgMatch[1]! : '';
  const { sm, violations: smViolations } = parseBackgroundStateMachine(bgContent);

  // 提取 scenarios（场景解析为手写正则，不依赖 @cucumber/* Gherkin 解析器）
  const scenarios: ScenarioPathCheck[] = [];
  const scenarioRegex = /Scenario:\s*(.+?)\n([\s\S]*?)(?=\n\s*Scenario:|\n\s*Scenario Outline:|$)/g;
  let m: RegExpExecArray | null;
  while ((m = scenarioRegex.exec(content)) !== null) {
    const name = m[1]!.trim();
    const body = m[2]!;
    const startState = extractStateFromStep(body, /Given.*?"(\w+)"/);
    const events = extractEventsFromStep(body);
    const expectedEndState = extractStateFromStep(body, /Then.*?"(\w+)"/);
    const invariantAssertions = extractInvariantsFromThen(body);
    scenarios.push({ scenarioName: name, startState, events, expectedEndState, invariantAssertions });
  }

  return {
    header,
    stateMachine: sm,
    scenarios,
    violations: [...headerViolations, ...smViolations],
  };
}

function extractStateFromStep(body: string, pattern: RegExp): string | null {
  const m = body.match(pattern);
  return m ? m[1]! : null;
}

/**
 * 从 scenario body 中提取事件名（When 与 And 步骤行末英文单词，容忍行末括号）。
 * 事件名是行末括号中的英文单词，如 (CreateComment)，或行末最后一个英文单词。
 */
function extractEventsFromStep(body: string): string[] {
  const events: string[] = [];
  const lines = body.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*(?:When|And)\s+.+?\b(\w+)\s*\)?\s*$/);
    if (m) events.push(m[1]!);
  }
  return events;
}

/**
 * 从 scenario body 中提取不变式断言（Then/And 步骤的「不变式 "..." 应成立」）。
 */
function extractInvariantsFromThen(body: string): string[] {
  const invs: string[] = [];
  const lines = body.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*(?:Then|And)\s+不变式\s+"(.+?)"\s+应成立/);
    if (m) invs.push(m[1]!);
  }
  return invs;
}

// ==================== 七要素完整性校验（纯函数） ====================

/**
 * 校验 Background 解析出的状态机七要素完整性（spec §5.2）。
 */
export function validateStateMachineCompleteness(sm: Partial<BddStateMachine>): string[] {
  const violations: string[] = [];

  if (!sm.states || sm.states.length === 0) {
    violations.push('[state-machine] @states missing or empty (must have ≥1 state)');
  }
  if (!sm.initialState) {
    violations.push('[state-machine] @initial-state missing');
  } else if (sm.states && !sm.states.includes(sm.initialState)) {
    violations.push(`[state-machine] @initial-state "${sm.initialState}" not in @states`);
  }
  if (sm.terminalStates === undefined) {
    violations.push('[state-machine] @terminal-states missing (declare () if no terminals)');
  } else if (sm.states) {
    for (const t of sm.terminalStates) {
      if (!sm.states.includes(t)) {
        violations.push(`[state-machine] terminal state "${t}" not in @states`);
      }
    }
  }
  if (!sm.acceptingStates || sm.acceptingStates.length === 0) {
    violations.push('[state-machine] @accepting-states missing or empty (must have ≥1, cannot be ())');
  } else if (sm.states) {
    for (const a of sm.acceptingStates) {
      if (!sm.states.includes(a)) {
        violations.push(`[state-machine] accepting state "${a}" not in @states`);
      }
    }
  }
  if (sm.rejectingStates === undefined) {
    violations.push('[state-machine] @rejecting-states missing (declare () if none)');
  } else if (sm.states) {
    for (const r of sm.rejectingStates) {
      if (!sm.states.includes(r)) {
        violations.push(`[state-machine] rejecting state "${r}" not in @states`);
      }
    }
  }
  if (!sm.transitions || sm.transitions.length === 0) {
    violations.push('[state-machine] @transitions missing or empty (must have ≥1)');
  } else if (sm.states) {
    for (const t of sm.transitions) {
      if (!sm.states.includes(t.from)) {
        violations.push(`[state-machine] transition from "${t.from}" not in @states`);
      }
      if (!sm.states.includes(t.to)) {
        violations.push(`[state-machine] transition to "${t.to}" not in @states`);
      }
    }
  }
  if (!sm.invariants || sm.invariants.length === 0) {
    violations.push('[state-machine] @invariants missing or empty (must have ≥1)');
  }

  return violations;
}

// ==================== Scenario 路径合法性校验（纯函数） ====================

export interface ScenarioStep {
  keyword: 'Given' | 'When' | 'Then' | 'And';
  text: string;
}

export interface ScenarioPathCheck {
  scenarioName: string;
  startState: string | null;
  events: string[];
  expectedEndState: string | null;
  invariantAssertions: string[];
}

/**
 * 校验 scenario 的 Given→When→Then 路径在状态机转移表中是否合法（spec §7.2 D6）。
 * 多事件 scenario 按链式查找：S0 + e1 -> S1, S1 + e2 -> S2, ...
 */
export function validateScenarioPath(
  check: ScenarioPathCheck,
  sm: BddStateMachine
): string[] {
  const violations: string[] = [];

  if (!check.startState) {
    violations.push(`[scenario:${check.scenarioName}] no Given state declared`);
    return violations;
  }
  if (!sm.states.includes(check.startState)) {
    violations.push(`[scenario:${check.scenarioName}] start state "${check.startState}" not in @states`);
    return violations;
  }

  let currentState = check.startState;
  for (let i = 0; i < check.events.length; i++) {
    const evt = check.events[i];
    const transition = sm.transitions.find(t => t.from === currentState && t.event === evt);
    if (!transition) {
      violations.push(
        `[scenario:${check.scenarioName}] no transition from "${currentState}" on event "${evt}"`
      );
      return violations;
    }
    currentState = transition.to;
  }

  if (check.expectedEndState && check.expectedEndState !== currentState) {
    violations.push(
      `[scenario:${check.scenarioName}] expected end state "${check.expectedEndState}" but got "${currentState}"`
    );
  }

  // 不变式存在性校验（语义求值由 V 子代理执行）
  for (const inv of check.invariantAssertions) {
    if (!sm.invariants.includes(inv)) {
      violations.push(
        `[scenario:${check.scenarioName}] invariant "${inv}" not declared in @invariants`
      );
    }
  }

  return violations;
}

// ==================== BDD↔TLA+ 等价性校验（纯函数） ====================

export interface TlaSpecSnapshot {
  specId: string;
  states: string[];
  initialState: string;
  transitions: Array<{ from: string; event: string; to: string }>;
  invariants: string[];
}

/**
 * 从 .tla 文件内容中提取状态机快照（states / initialState / transitions / invariants），
 * 供 D4 BDD↔TLA+ 等价性校验使用。纯函数：输入 .tla 文本内容 + specId，输出 TlaSpecSnapshot。
 *
 * 解析约定（与本项目所有 .tla 文件一致，迁移自 check-bdd-model.ts 的内联实现）：
 *   - 状态变量：在 TypeInvariant 中以 `var \in {"s1", "s2", ...}`（内联枚举）或
 *     `var \in SETNAME`（命名集合，值从 `SETNAME == {...}` 定义解析）声明（区别于计数器 `var \in Nat`）
 *   - 初始状态：在 Init 中以 `var = "Value"` 赋值
 *   - 转移：每个 Action 定义中 `var = "From"`（或 `var \in {...}` / `var \in SETNAME`）+ `var' = "To"`
 *   - 不变式：`var = "State" => condition`、`var # "State" => condition`、
 *     `condition => (var = "State")` 均归一化为 `State => condition`
 */
export function parseTlaSpecSnapshot(tlaContent: string, specId: string): TlaSpecSnapshot {
  return {
    specId,
    states: extractTlaStates(tlaContent),
    initialState: extractTlaInit(tlaContent),
    transitions: extractTlaTransitions(tlaContent),
    invariants: extractTlaInvariants(tlaContent),
  };
}

/**
 * 解析 TLA+ 命名集合定义 `SETNAME == {"v1", "v2", ...}`（支持单行与跨行、行内注释）中的字符串值。
 * 找不到定义或集合不含字符串字面量时返回空数组。
 * 注意：与内联枚举一致的已知限制——不提取空串 "" 值（`"([^"]+)"` 要求至少 1 字符）。
 */
function resolveSetValues(content: string, setName: string): string[] {
  const defRegex = new RegExp('\\b' + setName + '\\s*==\\s*\\{([\\s\\S]*?)\\}');
  const defMatch = defRegex.exec(content);
  if (!defMatch) return [];
  const values: string[] = [];
  const valMatches = defMatch[1]!.match(/"([^"]+)"/g);
  if (valMatches) {
    for (const v of valMatches) {
      const val = v.slice(1, -1);
      if (!values.includes(val)) values.push(val);
    }
  }
  return values;
}

/**
 * 提取 TLA+ 规格中枚举状态数最多的状态变量名。
 * 当规格有多个带枚举值的状态变量时（如 L1 的 systemState 和 userState），
 * 选择状态数最多的那个（通常是 BDD 对应的用户行为状态变量）。
 * 支持两种取值域声明风格：
 *   - 内联字面量枚举：`var \in {"s1", "s2", ...}`
 *   - 命名集合引用：`var \in SETNAME`，值从文件中的 `SETNAME == {...}` 定义解析
 */
function extractStateVarName(content: string): string | null {
  const typeDefMatch = content.match(/\b(?:TypeOK|TypeInvariant|Invariants)\s*==/);
  if (!typeDefMatch) return null;
  const typeInvStart = typeDefMatch.index!;
  const afterTypeInv = content.slice(typeInvStart);
  const bodyOffset = typeDefMatch[0].length;
  const endMatch = afterTypeInv.slice(bodyOffset).match(/\n\w+\s*==|\n====/);
  const typeInvBody = endMatch ? afterTypeInv.slice(0, endMatch.index! + bodyOffset) : afterTypeInv;

  const varPattern = /(\w+)\s*\\in\s*\{((?:"[^"]+"\s*,?\s*)+)\}/g;
  let bestVar: string | null = null;
  let maxCount = 0;
  let match: RegExpExecArray | null;
  while ((match = varPattern.exec(typeInvBody)) !== null) {
    const valMatches = match[2]!.match(/"([^"]+)"/g);
    const count = valMatches ? valMatches.length : 0;
    if (count > maxCount) {
      maxCount = count;
      bestVar = match[1]!;
    }
  }

  // 命名集合形式：var \in SETNAME（标识符而非 {..} 字面量；值需从 SETNAME == {...} 解析）。
  // 仅当解析出 ≥1 个值时计入候选（\in Nat / \in BOOLEAN 等无定义引用不参与选择）。
  const varNamedPattern = /(\w+)\s*\\in\s*([A-Za-z_]\w*)/g;
  while ((match = varNamedPattern.exec(typeInvBody)) !== null) {
    const values = resolveSetValues(content, match[2]!);
    if (values.length > 0 && values.length > maxCount) {
      maxCount = values.length;
      bestVar = match[1]!;
    }
  }
  return bestVar;
}

/**
 * 提取 TLA+ 规格中的所有状态值。
 * 优先匹配 TypeInvariant 中 `stateVar \in {"s1", "s2", ...}` 内联枚举；
 * 命名集合形式 `stateVar \in SETNAME` 时通过 resolveSetValues 解析 `SETNAME == {...}`。
 */
function extractTlaStates(content: string): string[] {
  const states: string[] = [];
  const stateVar = extractStateVarName(content);
  if (!stateVar) return states;
  const typeDefMatch = content.match(/\b(?:TypeOK|TypeInvariant|Invariants)\s*==/);
  if (!typeDefMatch) return states;
  const typeInvStart = typeDefMatch.index!;
  const afterTypeInv = content.slice(typeInvStart);
  const bodyOffset = typeDefMatch[0].length;
  const endMatch = afterTypeInv.slice(bodyOffset).match(/\n\w+\s*==|\n====/);
  const typeInvBody = endMatch ? afterTypeInv.slice(0, endMatch.index! + bodyOffset) : afterTypeInv;

  // 内联枚举：stateVar \in { "val1", "val2", ... }（不匹配 \in Nat）
  const stateVarPattern = new RegExp('\\b' + stateVar + '\\s*\\\\in\\s*\\{((?:"[^"]+"\\s*,?\\s*)+)\\}');
  const m = stateVarPattern.exec(typeInvBody);
  if (m) {
    const valMatches = m[1]!.match(/"([^"]+)"/g);
    if (valMatches) {
      for (const v of valMatches) {
        const val = v.slice(1, -1);
        if (!states.includes(val)) states.push(val);
      }
    }
    return states;
  }

  // 命名集合：stateVar \in SETNAME → 解析 SETNAME == {...} 的字面量值
  const namedPattern = new RegExp('\\b' + stateVar + '\\s*\\\\in\\s*([A-Za-z_]\\w*)');
  const namedMatch = namedPattern.exec(typeInvBody);
  if (namedMatch) {
    const values = resolveSetValues(content, namedMatch[1]!);
    for (const val of values) {
      if (!states.includes(val)) states.push(val);
    }
  }
  return states;
}

/**
 * 提取 TLA+ 规格的初始状态值（从 Init 中解析状态变量的赋值）。
 */
function extractTlaInit(content: string): string {
  const stateVar = extractStateVarName(content);
  if (!stateVar) return '';

  const initStart = content.indexOf('Init ==');
  if (initStart === -1) return '';
  const afterInit = content.slice(initStart);
  const endMatch = afterInit.slice(8).match(/\n\w+\s*==|\n====/);
  const initBody = endMatch ? afterInit.slice(0, endMatch.index! + 8) : afterInit;

  // 匹配 stateVar = "Value"（不匹配 stateVar' = ...）
  const m = initBody.match(new RegExp(stateVar + '\\s*=\\s*"([^"]+)"'));
  return m ? m[1]! : '';
}

/**
 * 提取 TLA+ 规格的转移列表（从各 Action 定义中解析 from→to，事件名转 camelCase）。
 * 处理 `var \in {"s1", "s2"}` 形式的多 from-state 展开。
 */
function extractTlaTransitions(content: string): Array<{ from: string; event: string; to: string }> {
  const transitions: Array<{ from: string; event: string; to: string }> = [];
  const stateVar = extractStateVarName(content);
  if (!stateVar) return transitions;

  // 从 Next == 中提取 action 名称列表
  const nextStart = content.indexOf('Next ==');
  if (nextStart === -1) return transitions;
  const afterNext = content.slice(nextStart);
  const specStart = afterNext.indexOf('Spec ==');
  const nextBody = specStart > 0 ? afterNext.slice(0, specStart) : afterNext;
  // 匹配 \/ ActionName 或 \/ \E var \in set : ActionName(args)
  // 注意：JS 正则中 \E 不是转义序列，需用 \\E 匹配字面反斜杠+E
  const actionNames = [...nextBody.matchAll(/\\\/\s*(?:\\E[^:]+:\s*)?(\w+)/g)].map(m => m[1]!);

  for (const actionName of actionNames) {
    // 定位 action 定义体（支持 ActionName == 和 ActionName(params) == 两种形式）
    const defRegex = new RegExp('\\b' + actionName + '\\s*(?:\\([^)]*\\))?\\s*==');
    const defMatch = defRegex.exec(content);
    if (!defMatch) continue;
    const afterDef = content.slice(defMatch.index + defMatch[0].length);
    const endMatch = afterDef.match(/\n\w+\s*==|\n====/);
    const actionBody = endMatch ? afterDef.slice(0, endMatch.index) : afterDef;

    // 提取 to-state: stateVar' = "Value"
    const toRegex = new RegExp(stateVar + "'\\s*=\\s*\"([^\"]+)\"");
    const toMatch = actionBody.match(toRegex);
    if (!toMatch) continue;

    const toState = toMatch[1]!;
    // 事件名：PascalCase → camelCase
    const event = actionName.charAt(0).toLowerCase() + actionName.slice(1);

    // 提取 from-state: stateVar = "Value" / stateVar \in {"s1", "s2", ...} / stateVar \in SETNAME
    const fromSingleRegex = new RegExp(stateVar + '\\s*=\\s*"([^"]+)"');
    const fromSingleMatch = actionBody.match(fromSingleRegex);
    if (fromSingleMatch) {
      transitions.push({ from: fromSingleMatch[1]!, event, to: toState });
    } else {
      const fromSetRegex = new RegExp(stateVar + '\\s*\\\\in\\s*\\{((?:"[^"]+"\\s*,?\\s*)+)\\}');
      const fromSetMatch = actionBody.match(fromSetRegex);
      if (fromSetMatch) {
        const fromStates = fromSetMatch[1]!.match(/"([^"]+)"/g)!;
        for (const fs of fromStates) {
          transitions.push({ from: fs.slice(1, -1), event, to: toState });
        }
      } else {
        // 命名集合 from-state：stateVar \in SETNAME → 解析 SETNAME == {...} 的值展开
        const fromNamedRegex = new RegExp(stateVar + '\\s*\\\\in\\s*([A-Za-z_]\\w*)');
        const fromNamedMatch = actionBody.match(fromNamedRegex);
        if (fromNamedMatch) {
          const fromStates = resolveSetValues(content, fromNamedMatch[1]!);
          for (const fs of fromStates) {
            transitions.push({ from: fs, event, to: toState });
          }
        }
      }
    }
  }

  return transitions;
}

/**
 * 提取 TLA+ 规格的不变式列表（归一化 `var = "State" => cond` / `var # "State" => cond`
 * 与反向 `cond => (var = "State")` 为 `State => cond`）。
 * 其中 # 形式语义为「未处于 State 蕴含 cond」；反向形式语义为「cond 蕴含处于 State」，
 * 两者均归一化为 `State => cond` 供 D4 字符串等价比对。
 */
function extractTlaInvariants(content: string): string[] {
  const invariants: string[] = [];
  const stateVar = extractStateVarName(content);
  if (!stateVar) return invariants;

  // 形式 1/2：stateVar = "State" => cond 与 stateVar # "State" => cond（不匹配 stateVar' = ...）
  const invRegex = new RegExp(
    stateVar + '\\s*(?:=|#)\\s*"([^"]+)"\\s*=>\\s*([^\\n]+)',
    'g'
  );

  const matches = [...content.matchAll(invRegex)];
  for (const m of matches) {
    const stateValue = m[1]!;
    const condition = m[2]!.trim();
    invariants.push(`${stateValue} => ${condition}`);
  }

  // 形式 3（反向）：cond => (stateVar = "State") → State => cond
  const invReverseRegex = new RegExp(
    '([^\\n]*?)\\s*=>\\s*\\(?\\s*' + stateVar + '\\s*=\\s*"([^"]+)"\\s*\\)?',
    'g'
  );

  const revMatches = [...content.matchAll(invReverseRegex)];
  for (const m of revMatches) {
    const condition = m[1]!.trim();
    const stateValue = m[2]!;
    invariants.push(`${stateValue} => ${condition}`);
  }

  return invariants;
}

/**
 * 校验 BDD 状态机与同层 TLA+ spec 快照的等价性（spec §6.2）。
 * 不变式集语义等价：第一阶段做归一化字符串匹配（去前后空格 + 小写 + 去除多余空白）；
 * 失败时返回 violation，由 R 子代理判定语义等价性。
 */
export function validateTlaEquivalence(
  sm: BddStateMachine,
  tla: TlaSpecSnapshot
): string[] {
  const violations: string[] = [];

  // 大小写不敏感比较：将 BDD 和 TLA+ 的状态集统一转小写后比较
  const normalizeState = (s: string) => s.trim().toLowerCase();
  const bddStates = new Set(sm.states.map(normalizeState));
  const tlaStates = new Set(tla.states.map(normalizeState));
  if (bddStates.size !== tlaStates.size || ![...bddStates].every(s => tlaStates.has(s))) {
    violations.push(
      `[tla-equiv] state set mismatch: BDD=${[...new Set(sm.states)].sort().join(',')} vs TLA+=${[...new Set(tla.states)].sort().join(',')}`
    );
  }

  if (normalizeState(sm.initialState) !== normalizeState(tla.initialState)) {
    violations.push(
      `[tla-equiv] initial state mismatch: BDD="${sm.initialState}" vs TLA+="${tla.initialState}"`
    );
  }

  const normalizeTransition = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const bddTrans = new Set(
    sm.transitions.map(t => normalizeTransition(`${t.from}+${t.event}->${t.to}`))
  );
  const tlaTrans = new Set(
    tla.transitions.map(t => normalizeTransition(`${t.from}+${t.event}->${t.to}`))
  );
  const bddMissing = [...tlaTrans].filter(t => !bddTrans.has(t));
  const tlaMissing = [...bddTrans].filter(t => !tlaTrans.has(t));
  if (bddMissing.length > 0) {
    violations.push(`[tla-equiv] transitions in TLA+ but not in BDD: ${bddMissing.join('; ')}`);
  }
  if (tlaMissing.length > 0) {
    violations.push(`[tla-equiv] transitions in BDD but not in TLA+: ${tlaMissing.join('; ')}`);
  }

  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const bddInv = new Set(sm.invariants.map(normalize));
  const tlaInv = new Set(tla.invariants.map(normalize));
  const invOnlyBdd = [...bddInv].filter(i => !tlaInv.has(i));
  const invOnlyTla = [...tlaInv].filter(i => !bddInv.has(i));
  if (invOnlyBdd.length > 0 || invOnlyTla.length > 0) {
    violations.push(
      `[tla-equiv] invariant set mismatch (normalized string match): only-in-BDD=${invOnlyBdd.join(';')} only-in-TLA+=${invOnlyTla.join(';')}`
    );
  }

  return violations;
}

// ==================== 综合校验入口（纯函数） ====================

export interface BddCheckInput {
  manifest: BddManifest;
  phase: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** 由 CLI 解析 .feature 文件后注入（features 文件头 + Background + scenarios） */
  parsedFeatures?: Array<{
    featureId: string;
    header: FeatureHeader;
    stateMachine: Partial<BddStateMachine>;
    scenarios: ScenarioPathCheck[];
  }>;
  /** 由 CLI 读取 tla-manifest.json + 调 tla-logic 解析后注入（用于 D4 等价性校验） */
  tlaSnapshots?: TlaSpecSnapshot[];
  /** 由 CLI 读取 rtm.json 后注入（用于 D7 RTM 映射校验） */
  rtmRows?: Array<{ reqId: string; acceptanceTest: string | null; systemTest: string | null; integrationTest: string | null; unitTest: string | null }>;
  /** 阶段 5-8 注入：cucumber 运行报告 */
  cucumberReport?: { undefinedCount: number; pendingCount: number; failedCount: number };
  /** 由 CLI 通过 --graph 提取的 SD 节点 ID 列表（phase>=2 时用于 D8 交叉校验） */
  graphSdNodes?: string[];
  /** 校验时间戳：纯函数测试可注入固定值以确保可重放；CLI 不传时回退到当前时间 */
  checkedAt?: string;
}

export interface BddCheckResult {
  passed: boolean;
  exitCode: 0 | 1 | 2;
  checkedAt: string;
  phase: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  dimensions: {
    headerCompleteness: string[];
    stateMachineCompleteness: string[];
    tlaEquivalence: string[];
    stepBinding: string[];
    scenarioPathValidity: string[];
    rtmMapping: string[];
    sdCoverage: string[];
  };
  summary: string;
  violations: string[];
}

/**
 * BDD 模型综合校验入口（spec §7.2）。
 * 纯函数：输入 BddCheckInput，输出 BddCheckResult。
 */
export function checkBddModel(input: BddCheckInput): BddCheckResult {
  const checkedAt = input.checkedAt ?? new Date().toISOString();
  const phase = input.phase;

  // 入口 schema 校验（防反模式 #28）
  const schemaResult = validateBySchema('bdd-manifest', input.manifest);
  if (!schemaResult.valid) {
    return {
      passed: false,
      exitCode: 2,
      checkedAt,
      phase,
      dimensions: {
        headerCompleteness: [],
        stateMachineCompleteness: [],
        tlaEquivalence: [],
        stepBinding: [],
        scenarioPathValidity: [],
        rtmMapping: schemaResult.errorMessages.map(m => `[schema] ${m}`),
        sdCoverage: [],
      },
      summary: `schema validation failed: ${schemaResult.errorMessages.length} errors`,
      violations: schemaResult.errorMessages.map(m => `[schema] ${m}`),
    };
  }

  const dims = {
    headerCompleteness: [] as string[],
    stateMachineCompleteness: [] as string[],
    tlaEquivalence: [] as string[],
    stepBinding: [] as string[],
    scenarioPathValidity: [] as string[],
    rtmMapping: [] as string[],
    sdCoverage: [] as string[],
  };

  // D1: features 头标注完整性 + D3: 状态机七要素
  for (const pf of input.parsedFeatures ?? []) {
    // 头标注字段必填校验已在 parseFeatureHeader 完成；这里补充跨 manifest 一致性校验
    const manifestFeature = input.manifest.features.find(f => f.id === pf.featureId);
    if (!manifestFeature) {
      dims.headerCompleteness.push(`[D1] feature "${pf.featureId}" not in manifest`);
      continue;
    }
    if (pf.header.tlaSpec && pf.header.tlaSpec !== manifestFeature.tlaSpecId) {
      dims.headerCompleteness.push(
        `[D1] feature "${pf.featureId}" @tla-spec="${pf.header.tlaSpec}" != manifest.tlaSpecId="${manifestFeature.tlaSpecId}"`
      );
    }
    if (pf.header.stateMachine && pf.header.stateMachine !== manifestFeature.stateMachineId) {
      dims.headerCompleteness.push(
        `[D1] feature "${pf.featureId}" @state-machine="${pf.header.stateMachine}" != manifest.stateMachineId="${manifestFeature.stateMachineId}"`
      );
    }

    // D3: 状态机七要素完整性
    const smViolations = validateStateMachineCompleteness(pf.stateMachine);
    dims.stateMachineCompleteness.push(...smViolations.map(v => `[D3:${pf.featureId}] ${v}`));
  }

  // D4: BDD↔TLA+ 等价性（阶段 1-4 校验，阶段 5-8 跳过）
  if (phase <= 4 && input.tlaSnapshots) {
    for (const sm of input.manifest.stateMachines) {
      // L1 系统级规格豁免 D4 自动等价：L1 是请求-响应抽象而非内部状态机，
      // 自动等价比对无意义，由 R3/V 语义评审把关（不产生任何 D4 violation）；
      // L2+ 子系统级规格仍执行完整自动等价校验。
      if (sm.level === 1) continue;
      const tlaSnap = input.tlaSnapshots.find(t => t.specId === sm.id.replace(/^SM-/, ''));
      if (!tlaSnap) {
        // TLA+ 未提供对应 spec：由 R 子代理判定是缺失还是层级不对应
        dims.tlaEquivalence.push(`[D4] no TLA+ snapshot for state machine "${sm.id}"`);
        continue;
      }
      const equivViolations = validateTlaEquivalence(sm, tlaSnap);
      dims.tlaEquivalence.push(...equivViolations.map(v => `[D4:${sm.id}] ${v}`));
    }
  }

  // D5: step definitions 绑定完整性（阶段 5-8 强制；阶段 1-4 跳过）
  if (phase >= 5) {
    if (input.cucumberReport) {
      if (input.cucumberReport.undefinedCount > 0) {
        dims.stepBinding.push(`[D5] cucumber report has ${input.cucumberReport.undefinedCount} undefined steps`);
      }
      if (input.cucumberReport.pendingCount > 0) {
        dims.stepBinding.push(`[D5] cucumber report has ${input.cucumberReport.pendingCount} pending steps`);
      }
      if (input.cucumberReport.failedCount > 0) {
        dims.stepBinding.push(`[D5] cucumber report has ${input.cucumberReport.failedCount} failed steps`);
      }
    }
  }

  // D6: scenario 路径合法性
  for (const pf of input.parsedFeatures ?? []) {
    const sm = input.manifest.stateMachines.find(s => s.id === pf.header.stateMachine);
    if (!sm) {
      dims.scenarioPathValidity.push(`[D6:${pf.featureId}] state machine "${pf.header.stateMachine}" not in manifest`);
      continue;
    }
    for (const sc of pf.scenarios) {
      const pathViolations = validateScenarioPath(sc, sm);
      dims.scenarioPathValidity.push(...pathViolations.map(v => `[D6:${pf.featureId}:${sc.scenarioName}] ${v}`));
    }
  }

  // D7: RTM 映射校验
  if (input.rtmRows) {
    for (const f of input.manifest.features) {
      for (const reqId of f.reqIds) {
        const rtmRow = input.rtmRows.find(r => r.reqId === reqId);
        if (!rtmRow) {
          dims.rtmMapping.push(`[D7:${f.id}] req "${reqId}" not in RTM`);
          continue;
        }
        // 检查对应层级的测试列是否登记了本 feature 文件引用
        const testField = f.level === 1 ? rtmRow.acceptanceTest
          : f.level === 2 ? rtmRow.systemTest
          : f.level === 3 ? rtmRow.integrationTest
          : rtmRow.unitTest;
        if (!testField || !testField.includes(f.id)) {
          dims.rtmMapping.push(`[D7:${f.id}] feature id not in RTM row ${reqId} test field (level ${f.level})`);
        }
      }
    }
  }

  // D8: SD Coverage 校验（phase>=2 强制）
  if (phase >= 2) {
    const dc = (input.manifest as any).designCoverage;
    if (!dc) {
      dims.sdCoverage.push(
        '[D8] designCoverage 字段缺失（phase>=2 强制必填，须由 S-ingest-bdd 从 .feature @designIds + graph.json 比对后回填）',
      );
    } else {
      if (typeof dc.totalSdNodes !== 'number' || typeof dc.coverageRate !== 'number') {
        dims.sdCoverage.push('[D8] designCoverage.totalSdNodes / coverageRate 须为数字');
      } else if (!Array.isArray(dc.coveredSdNodes) || !Array.isArray(dc.uncoveredSdNodes)) {
        dims.sdCoverage.push('[D8] designCoverage.coveredSdNodes / uncoveredSdNodes 须为数组');
      } else if (dc.uncoveredSdNodes.length > 0) {
        dims.sdCoverage.push(
          `[D8] 以下 SD 节点未被任何 BDD feature 覆盖: ${dc.uncoveredSdNodes.join(', ')}`,
        );
      }
      // 交叉校验：与 graphSdNodes 比对
      if (input.graphSdNodes && input.graphSdNodes.length > 0) {
        const manifestCovered = new Set<string>();
        for (const f of input.manifest.features) {
          for (const did of f.designIds ?? []) manifestCovered.add(did);
        }
        const graphUncovered = input.graphSdNodes.filter(sd => !manifestCovered.has(sd));
        if (graphUncovered.length > 0 && dc.uncoveredSdNodes.length === 0) {
          dims.sdCoverage.push(
            `[D8] designCoverage.uncoveredSdNodes 为空但 graphSdNodes 比对发现未覆盖: ${graphUncovered.join(', ')}`,
          );
        }
      }
    }
  }

  const allViolations = [
    ...dims.headerCompleteness,
    ...dims.stateMachineCompleteness,
    ...dims.tlaEquivalence,
    ...dims.stepBinding,
    ...dims.scenarioPathValidity,
    ...dims.rtmMapping,
    ...dims.sdCoverage,
  ];

  const passed = allViolations.length === 0;
  return {
    passed,
    exitCode: passed ? 0 : 1,
    checkedAt,
    phase,
    dimensions: dims,
    summary: passed
      ? `BDD model check passed (phase ${phase})`
      : `BDD model check failed with ${allViolations.length} violations (phase ${phase})`,
    violations: allViolations,
  };
}
