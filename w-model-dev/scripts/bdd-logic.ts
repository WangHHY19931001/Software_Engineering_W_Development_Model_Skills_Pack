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
 * 注意：本文件只校验 manifest 声明的结构与字段，不解析 .feature 文件（那是 CLI 的 I/O 职责）。
 *   features 文件头解析（parseFeatureHeader）与 Background 状态机解析（parseBackgroundStateMachine）
 *   为纯函数，供 CLI 调用后将违反合并入最终结果。
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
    terminalStates: [],
    acceptingStates: [],
    rejectingStates: [],
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
 * 校验 BDD 状态机与同层 TLA+ spec 快照的等价性（spec §6.2）。
 * 不变式集语义等价：第一阶段做归一化字符串匹配（去前后空格 + 小写 + 去除多余空白）；
 * 失败时返回 violation，由 R 子代理判定语义等价性。
 */
export function validateTlaEquivalence(
  sm: BddStateMachine,
  tla: TlaSpecSnapshot
): string[] {
  const violations: string[] = [];

  const bddStates = new Set(sm.states);
  const tlaStates = new Set(tla.states);
  if (bddStates.size !== tlaStates.size || ![...bddStates].every(s => tlaStates.has(s))) {
    violations.push(
      `[tla-equiv] state set mismatch: BDD=${[...bddStates].sort().join(',')} vs TLA+=${[...tlaStates].sort().join(',')}`
    );
  }

  if (sm.initialState !== tla.initialState) {
    violations.push(
      `[tla-equiv] initial state mismatch: BDD="${sm.initialState}" vs TLA+="${tla.initialState}"`
    );
  }

  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const bddTrans = new Set(
    sm.transitions.map(t => `${t.from}+${t.event}->${t.to}`)
  );
  const tlaTrans = new Set(
    tla.transitions.map(t => `${t.from}+${t.event}->${t.to}`)
  );
  const bddMissing = [...tlaTrans].filter(t => !bddTrans.has(t));
  const tlaMissing = [...bddTrans].filter(t => !tlaTrans.has(t));
  if (bddMissing.length > 0) {
    violations.push(`[tla-equiv] transitions in TLA+ but not in BDD: ${bddMissing.join('; ')}`);
  }
  if (tlaMissing.length > 0) {
    violations.push(`[tla-equiv] transitions in BDD but not in TLA+: ${tlaMissing.join('; ')}`);
  }

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

  const allViolations = [
    ...dims.headerCompleteness,
    ...dims.stateMachineCompleteness,
    ...dims.tlaEquivalence,
    ...dims.stepBinding,
    ...dims.scenarioPathValidity,
    ...dims.rtmMapping,
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
