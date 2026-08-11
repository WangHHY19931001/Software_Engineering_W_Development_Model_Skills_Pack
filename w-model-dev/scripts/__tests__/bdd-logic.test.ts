/**
 * bdd-logic.ts 单元测试 —— BDD 模型校验纯逻辑
 *
 * 覆盖：
 *   - parseFeatureHeader：合法 header 解析 / 缺必填字段
 *   - parseBackgroundStateMachine：七要素解析（含 transitions block）/ 空集 () 解析
 *   - validateStateMachineCompleteness：完整状态机 / initial state 不在 states / accepting-states 为空
 *   - validateScenarioPath：单事件路径 / 多事件链式路径 / 无效事件 / 未声明不变式
 *   - validateTlaEquivalence：匹配 / 状态集不同 / 不变式归一化
 *   - checkBddModel：schema 失败返回 exitCode=2
 */

import { describe, it, expect } from 'vitest';
import {
  parseFeatureHeader,
  parseBackgroundStateMachine,
  parseFeatureFile,
  parseTlaSpecSnapshot,
  validateStateMachineCompleteness,
  validateScenarioPath,
  validateTlaEquivalence,
  checkBddModel,
  type BddStateMachine,
  type TlaSpecSnapshot,
} from '../logic/bdd-logic.js';

describe('parseFeatureHeader', () => {
  it('parses valid header with all required fields', () => {
    const content = `# @req: REQ-001, REQ-002
# @design: SD-3.2.1
# @system: L1_blog_system
# @tla-spec: L1_blog_system
# @state-machine: SM-L1-blog_system
# @parent-features: (none)
# @child-features: L2_auth-001.feature
# @scenario-id-prefix: BDD-L1
Feature: Test`;
    const { header, violations } = parseFeatureHeader(content);
    expect(violations).toEqual([]);
    expect(header.req).toEqual(['REQ-001', 'REQ-002']);
    expect(header.parentFeatures).toBeNull();
    expect(header.childFeatures).toEqual(['L2_auth-001.feature']);
  });

  it('reports missing required field', () => {
    const content = `# @req: REQ-001
Feature: Test`;
    const { violations } = parseFeatureHeader(content);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes('@tla-spec'))).toBe(true);
  });
});

describe('parseBackgroundStateMachine', () => {
  it('parses all seven elements including transitions block', () => {
    const bg = `Background:
  # @states: A, B, C
  # @initial-state: A
  # @terminal-states: C
  # @accepting-states: C
  # @rejecting-states: A
  # @transitions:
  #   A + e1 -> B
  #   B + e2 -> C [guard: x>0] [action: log]
  # @invariants:
  #   B => x>=0`;
    const { sm, violations } = parseBackgroundStateMachine(bg);
    expect(violations).toEqual([]);
    expect(sm.states).toEqual(['A', 'B', 'C']);
    expect(sm.transitions).toHaveLength(2);
    expect(sm.transitions![1]!.guard).toBe('x>0');
    expect(sm.transitions![1]!.action).toBe('log');
    expect(sm.invariants).toEqual(['B => x>=0']);
  });

  it('parses empty set () for terminal-states', () => {
    const bg = `Background:
  # @states: A
  # @initial-state: A
  # @terminal-states: ()
  # @accepting-states: A
  # @rejecting-states: ()
  # @transitions:
  #   A + e -> A
  # @invariants:
  #   A => true`;
    const { sm } = parseBackgroundStateMachine(bg);
    expect(sm.terminalStates).toEqual([]);
    expect(sm.rejectingStates).toEqual([]);
  });
});

describe('validateStateMachineCompleteness', () => {
  it('passes for complete state machine', () => {
    const sm: Partial<BddStateMachine> = {
      states: ['A', 'B'],
      initialState: 'A',
      terminalStates: ['B'],
      acceptingStates: ['B'],
      rejectingStates: [],
      transitions: [{ from: 'A', event: 'e', to: 'B' }],
      invariants: ['B => true'],
    };
    expect(validateStateMachineCompleteness(sm)).toEqual([]);
  });

  it('fails when initial state not in states', () => {
    const sm: Partial<BddStateMachine> = {
      states: ['A'],
      initialState: 'X',
      terminalStates: [],
      acceptingStates: ['A'],
      rejectingStates: [],
      transitions: [{ from: 'A', event: 'e', to: 'A' }],
      invariants: ['A => true'],
    };
    const v = validateStateMachineCompleteness(sm);
    expect(v.some((s) => s.includes('not in @states'))).toBe(true);
  });

  it('fails when accepting-states is empty (cannot be ())', () => {
    const sm: Partial<BddStateMachine> = {
      states: ['A'],
      initialState: 'A',
      terminalStates: [],
      acceptingStates: [],
      rejectingStates: [],
      transitions: [{ from: 'A', event: 'e', to: 'A' }],
      invariants: ['A => true'],
    };
    const v = validateStateMachineCompleteness(sm);
    expect(v.some((s) => s.includes('accepting-states'))).toBe(true);
  });
});

describe('validateScenarioPath', () => {
  const sm: BddStateMachine = {
    id: 'SM-L1-test',
    level: 1,
    states: ['A', 'B', 'C'],
    initialState: 'A',
    terminalStates: ['C'],
    acceptingStates: ['C'],
    rejectingStates: [],
    transitions: [
      { from: 'A', event: 'e1', to: 'B' },
      { from: 'B', event: 'e2', to: 'C' },
    ],
    invariants: ['C => done'],
  };

  it('passes for single-event path', () => {
    const v = validateScenarioPath(
      { scenarioName: 's1', startState: 'A', events: ['e1'], expectedEndState: 'B', invariantAssertions: [] },
      sm,
    );
    expect(v).toEqual([]);
  });

  it('passes for chained multi-event path', () => {
    const v = validateScenarioPath(
      {
        scenarioName: 's2',
        startState: 'A',
        events: ['e1', 'e2'],
        expectedEndState: 'C',
        invariantAssertions: ['C => done'],
      },
      sm,
    );
    expect(v).toEqual([]);
  });

  it('fails for invalid event from current state', () => {
    const v = validateScenarioPath(
      { scenarioName: 's3', startState: 'A', events: ['e2'], expectedEndState: 'C', invariantAssertions: [] },
      sm,
    );
    expect(v.some((s) => s.includes('no transition'))).toBe(true);
  });

  it('fails for undeclared invariant assertion', () => {
    const v = validateScenarioPath(
      { scenarioName: 's4', startState: 'A', events: ['e1'], expectedEndState: 'B', invariantAssertions: ['X => y'] },
      sm,
    );
    expect(v.some((s) => s.includes('not declared'))).toBe(true);
  });
});

describe('validateTlaEquivalence', () => {
  const sm: BddStateMachine = {
    id: 'SM-L1-test',
    level: 1,
    states: ['A', 'B'],
    initialState: 'A',
    terminalStates: ['B'],
    acceptingStates: ['B'],
    rejectingStates: [],
    transitions: [{ from: 'A', event: 'e', to: 'B' }],
    invariants: ['B => done'],
  };

  it('passes when BDD and TLA+ match', () => {
    const tla: TlaSpecSnapshot = {
      specId: 'L1_test',
      states: ['A', 'B'],
      initialState: 'A',
      transitions: [{ from: 'A', event: 'e', to: 'B' }],
      invariants: ['B => done'],
    };
    expect(validateTlaEquivalence(sm, tla)).toEqual([]);
  });

  it('fails when state sets differ', () => {
    const tla: TlaSpecSnapshot = {
      specId: 'L1_test',
      states: ['A', 'B', 'C'],
      initialState: 'A',
      transitions: [{ from: 'A', event: 'e', to: 'B' }],
      invariants: ['B => done'],
    };
    const v = validateTlaEquivalence(sm, tla);
    expect(v.some((s) => s.includes('state set mismatch'))).toBe(true);
  });

  it('normalizes invariant strings (whitespace + case)', () => {
    const tla: TlaSpecSnapshot = {
      specId: 'L1_test',
      states: ['A', 'B'],
      initialState: 'A',
      transitions: [{ from: 'A', event: 'e', to: 'B' }],
      invariants: ['  b  =>  DONE  '],
    };
    const v = validateTlaEquivalence(sm, tla);
    expect(v.filter((s) => s.includes('invariant'))).toEqual([]);
  });
});

describe('checkBddModel', () => {
  it('returns exitCode=2 when manifest fails schema', () => {
    const result = checkBddModel({
      manifest: { schemaVersion: '0.0' } as any, // 故意非法
      phase: 1,
    });
    expect(result.exitCode).toBe(2);
    expect(result.passed).toBe(false);
  });

  it('D7: passes when rtmRows uses correct schema (rows + requirementId) and feature id is registered', () => {
    // 回归测试：check-bdd-model.ts D7 曾误用 rtm.requirements（不存在字段），
    // 修正为 rtm.rows + requirementId（与 gate-logic.ts RTMMatrixShape 对齐）。
    // 本测试确保 rtmRows 注入正确字段名时 D7 能通过。
    const manifest = {
      schemaVersion: '1.0',
      projectId: 'test',
      basePath: 'bdd',
      currentPhase: 4,
      features: [
        {
          id: 'BDD-L1-test',
          level: 1,
          filePath: 'test.feature',
          scenarioCount: 1,
          stateMachineId: 'SM-L1-test',
          tlaSpecId: 'L1-test',
          reqIds: ['REQ-001'],
          designIds: [],
          parentFeatureIds: [],
          siblingFeatureIds: [],
          childFeatureIds: [],
        },
      ],
      stateMachines: [
        {
          id: 'SM-L1-test',
          level: 1,
          states: ['A'],
          initialState: 'A',
          terminalStates: [],
          acceptingStates: ['A'],
          rejectingStates: [],
          transitions: [{ from: 'A', event: 'e', to: 'A' }],
          invariants: ['A => true'],
        },
      ],
      designCoverage: {
        totalSdNodes: 0,
        coveredSdNodes: [],
        uncoveredSdNodes: [],
        coverageRate: 1,
      },
    };
    const result = checkBddModel({
      manifest: manifest as any,
      phase: 8,
      rtmRows: [
        // 正确 schema：requirementId（非 id），acceptanceTest 含 feature id
        {
          reqId: 'REQ-001',
          acceptanceTest: 'UAT-001 | BDD-L1-test',
          systemTest: null,
          integrationTest: null,
          unitTest: null,
        },
      ],
    });
    expect(result.dimensions.rtmMapping).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  it('D7: fails when feature id not registered in RTM test field', () => {
    const manifest = {
      schemaVersion: '1.0',
      projectId: 'test',
      basePath: 'bdd',
      currentPhase: 4,
      features: [
        {
          id: 'BDD-L1-test',
          level: 1,
          filePath: 'test.feature',
          scenarioCount: 1,
          stateMachineId: 'SM-L1-test',
          tlaSpecId: 'L1-test',
          reqIds: ['REQ-001'],
          designIds: [],
          parentFeatureIds: [],
          siblingFeatureIds: [],
          childFeatureIds: [],
        },
      ],
      stateMachines: [
        {
          id: 'SM-L1-test',
          level: 1,
          states: ['A'],
          initialState: 'A',
          terminalStates: [],
          acceptingStates: ['A'],
          rejectingStates: [],
          transitions: [{ from: 'A', event: 'e', to: 'A' }],
          invariants: ['A => true'],
        },
      ],
      designCoverage: {
        totalSdNodes: 0,
        coveredSdNodes: [],
        uncoveredSdNodes: [],
        coverageRate: 1,
      },
    };
    const result = checkBddModel({
      manifest: manifest as any,
      phase: 8,
      rtmRows: [
        // feature id 未登记在 acceptanceTest 字段
        { reqId: 'REQ-001', acceptanceTest: 'UAT-001', systemTest: null, integrationTest: null, unitTest: null },
      ],
    });
    expect(result.dimensions.rtmMapping.some((v) => v.includes('feature id not in RTM'))).toBe(true);
    expect(result.exitCode).toBe(1);
  });

  it('D7: fails when reqId not in RTM at all', () => {
    const manifest = {
      schemaVersion: '1.0',
      projectId: 'test',
      basePath: 'bdd',
      currentPhase: 4,
      features: [
        {
          id: 'BDD-L1-test',
          level: 1,
          filePath: 'test.feature',
          scenarioCount: 1,
          stateMachineId: 'SM-L1-test',
          tlaSpecId: 'L1-test',
          reqIds: ['REQ-999'],
          designIds: [],
          parentFeatureIds: [],
          siblingFeatureIds: [],
          childFeatureIds: [],
        },
      ],
      stateMachines: [
        {
          id: 'SM-L1-test',
          level: 1,
          states: ['A'],
          initialState: 'A',
          terminalStates: [],
          acceptingStates: ['A'],
          rejectingStates: [],
          transitions: [{ from: 'A', event: 'e', to: 'A' }],
          invariants: ['A => true'],
        },
      ],
      designCoverage: {
        totalSdNodes: 0,
        coveredSdNodes: [],
        uncoveredSdNodes: [],
        coverageRate: 1,
      },
    };
    const result = checkBddModel({
      manifest: manifest as any,
      phase: 8,
      rtmRows: [
        {
          reqId: 'REQ-001',
          acceptanceTest: 'UAT-001 | BDD-L1-test',
          systemTest: null,
          integrationTest: null,
          unitTest: null,
        },
      ],
    });
    expect(result.dimensions.rtmMapping.some((v) => v.includes('not in RTM'))).toBe(true);
    expect(result.exitCode).toBe(1);
  });

  it('D4: L1 系统级规格豁免自动等价（空/不匹配快照零 violation）；L2 不匹配快照仍报 violation', () => {
    // L1 系统级规格是请求-响应抽象而非内部状态机，D4 自动等价由 R3/V 语义评审把关；
    // L2+ 子系统级规格仍执行完整自动等价校验（level === 1 时跳过 validateTlaEquivalence）。
    const manifest = {
      schemaVersion: '1.0',
      projectId: 'test',
      basePath: 'features/',
      currentPhase: 2,
      features: [],
      stateMachines: [
        {
          id: 'SM-L1-sys',
          level: 1,
          states: ['A', 'B'],
          initialState: 'A',
          terminalStates: [],
          acceptingStates: ['B'],
          rejectingStates: [],
          transitions: [{ from: 'A', event: 'e', to: 'B' }],
          invariants: ['B => done'],
        },
        {
          id: 'SM-L2-sub',
          level: 2,
          states: ['X', 'Y'],
          initialState: 'X',
          terminalStates: [],
          acceptingStates: ['Y'],
          rejectingStates: [],
          transitions: [{ from: 'X', event: 'f', to: 'Y' }],
          invariants: ['Y => ok'],
        },
      ],
      designCoverage: { totalSdNodes: 0, coveredSdNodes: [], uncoveredSdNodes: [], coverageRate: 1 },
    } as any;
    const result = checkBddModel({
      manifest,
      phase: 2,
      parsedFeatures: [],
      // L1 快照为空（与 BDD 完全不匹配）；L2 快照同样不匹配（多一个状态 + 转移目标不同）
      tlaSnapshots: [
        { specId: 'L1-sys', states: [], initialState: '', transitions: [], invariants: [] },
        {
          specId: 'L2-sub',
          states: ['X', 'Y', 'Z'],
          initialState: 'X',
          transitions: [{ from: 'X', event: 'f', to: 'Z' }],
          invariants: ['Y => ok'],
        },
      ],
    });
    // L1：即使快照为空也不产生任何 tlaEquivalence violation
    expect(result.dimensions.tlaEquivalence.filter((v) => v.includes('SM-L1-sys'))).toEqual([]);
    // L2：不匹配快照产生 violation（自动等价校验仍完整执行）
    expect(result.dimensions.tlaEquivalence.some((v) => v.includes('SM-L2-sub'))).toBe(true);
    expect(result.exitCode).toBe(1);
  });
});

// ==================== parseTlaSpecSnapshot（批次 3 Task 6 补强：直接单测） ====================

describe('parseTlaSpecSnapshot', () => {
  it('named-set style: multi-var TypeInvariant picks the largest named set（22 REQUESTS）作为状态集', () => {
    // 复刻调测前 demo L1 的命名集合风格：REQUESTS(22) > ACTORS(4) > RESPONSES(7)，
    // → 状态变量选择 request，状态集 = REQUESTS 的 22 个请求类别（解析器已支持命名集合）。
    // 第 35 轮起改为自包含内联规格，不再依赖 demo 实时文件（demo L1 已重写为 4 状态生命周期风格）。
    const content = `---- MODULE L1_BlogSystem ----
VARIABLES request, actor, response, published

TypeInvariant ==
  /\\ request \\in REQUESTS
  /\\ actor \\in ACTORS
  /\\ response \\in RESPONSES

ACTORS == {"Reader", "Writer", "Admin", "Guest"}
REQUESTS == {"Register", "BrowseArticle", "PublishArticle", "DeleteArticle", "EditArticle",
             "Comment", "ReplyComment", "DeleteComment", "Like", "Unlike",
             "Follow", "Unfollow", "CreateBlog", "UpdateBlog", "DeleteBlog",
             "UploadImage", "DeleteImage", "SearchArticle", "TagArticle", "Subscribe",
             "Unsubscribe", "Logout"}
RESPONSES == {"ok1xx", "ok2xx", "ok3xx", "err4xx", "err5xx"}

Init ==
  /\\ request = "BrowseArticle"
  /\\ actor = "Guest"
  /\\ response = "ok2xx"
  /\\ published = FALSE

RegisterReq ==
  /\\ request' = "Register"
  /\\ UNCHANGED <<actor, response, published>>

BrowseReq ==
  /\\ request' = "BrowseArticle"
  /\\ UNCHANGED <<actor, response, published>>

Next ==
  \\/ RegisterReq
  \\/ BrowseReq

Spec == Init /\\ [][Next]_vars

Invariants ==
  /\\ TypeInvariant
  /\\ (request = "BrowseArticle" /\\ response = "ok2xx") => published
====
`;
    const snap = parseTlaSpecSnapshot(content, 'L1_BlogSystem');
    expect(snap.specId).toBe('L1_BlogSystem');
    expect(snap.states).toHaveLength(22);
    expect(snap.states).toContain('Register');
    expect(snap.states).toContain('BrowseArticle');
    expect(snap.initialState).toBe('BrowseArticle');
    // L1 动作用 `request' = "..."` 表达新请求、无 `request = "..."` 前置断言，
    // 且不变式为 `(request = "BrowseArticle" /\ response = "ok2xx") => published` 复合形式
    // → 单变量快照无法提取转移/不变式（保持空，符合解析器约定）
    expect(snap.transitions).toEqual([]);
    expect(snap.invariants).toEqual([]);
  });

  it('realistic inline-enum spec: full field assertions (TypeInvariant + Init + Next + Invariants)', () => {
    const content = `---- MODULE L1Handwritten ----
VARIABLES sysState, pending

TypeInvariant ==
  /\\ sysState \\in {"INIT", "RUNNING", "SHUTDOWN"}
  /\\ pending \\in Nat

Init ==
  /\\ sysState = "INIT"
  /\\ pending = 0

StartSystem ==
  /\\ sysState = "INIT"
  /\\ sysState' = "RUNNING"
  /\\ UNCHANGED pending

ShutdownSystem ==
  /\\ sysState = "RUNNING"
  /\\ sysState' = "SHUTDOWN"
  /\\ UNCHANGED pending

Next ==
  \\/ StartSystem
  \\/ ShutdownSystem

Spec == Init /\\ [][Next]_vars

Invariants ==
  /\\ TypeInvariant
  /\\ sysState = "SHUTDOWN" => pending = 0
====
`;
    const snap = parseTlaSpecSnapshot(content, 'L1-handwritten');
    expect(snap.specId).toBe('L1-handwritten');
    expect(snap.states).toEqual(['INIT', 'RUNNING', 'SHUTDOWN']);
    expect(snap.initialState).toBe('INIT');
    // 事件名 PascalCase → camelCase；from/to 从 action 内 stateVar 赋值提取
    expect(snap.transitions).toEqual([
      { from: 'INIT', event: 'startSystem', to: 'RUNNING' },
      { from: 'RUNNING', event: 'shutdownSystem', to: 'SHUTDOWN' },
    ]);
    // 不变式归一化：`var = "State" => cond` → `State => cond`
    expect(snap.invariants).toEqual(['SHUTDOWN => pending = 0']);
  });

  it('picks the state var with the most enum values when multiple vars present', () => {
    const content = `---- MODULE MultiVar ----
VARIABLES s, t

TypeOK ==
  /\\ s \\in {"A", "B"}
  /\\ t \\in {"X", "Y", "Z"}

Init ==
  /\\ s = "A"
  /\\ t = "X"

GoToY ==
  /\\ t = "X"
  /\\ t' = "Y"
  /\\ UNCHANGED s

Next ==
  \\/ GoToY

Spec == Init /\\ [][Next]_vars
====
`;
    const snap = parseTlaSpecSnapshot(content, 'multi-var');
    // t 有 3 个枚举值 > s 的 2 个 → 选 t 作为状态变量
    expect(snap.states).toEqual(['X', 'Y', 'Z']);
    expect(snap.initialState).toBe('X');
    expect(snap.transitions).toEqual([{ from: 'X', event: 'goToY', to: 'Y' }]);
  });

  it('expands `var \\in {"A", "B"}` from-set into one transition per state', () => {
    const content = `---- MODULE MultiFrom ----
VARIABLES s, u

TypeOK ==
  /\\ s \\in {"A", "B"}
  /\\ u \\in Nat

Init ==
  /\\ s = "A"
  /\\ u = 0

RetryToInflight ==
  /\\ s \\in {"A", "B"}
  /\\ s' = "B"
  /\\ u' = u + 1

Next ==
  \\/ RetryToInflight

Spec == Init /\\ [][Next]_vars
====
`;
    const snap = parseTlaSpecSnapshot(content, 'multi-from');
    expect(snap.transitions).toEqual([
      { from: 'A', event: 'retryToInflight', to: 'B' },
      { from: 'B', event: 'retryToInflight', to: 'B' },
    ]);
  });

  it('extracts action names from `\\/ \\E u \\in Users : Register(u)` form in Next', () => {
    const content = `---- MODULE Quantified ----
VARIABLES s

TypeOK ==
  /\\ s \\in {"A"}

Init ==
  /\\ s = "A"

Register(u) ==
  /\\ u \\in Users
  /\\ s = "A"
  /\\ s' = "A"

Next ==
  \\/ \\E u \\in Users : Register(u)

Spec == Init /\\ [][Next]_vars
====
`;
    const snap = parseTlaSpecSnapshot(content, 'quantified');
    // Next 中 `\/ \E u \in Users : Register(u)` → 动作名 Register → camelCase register
    expect(snap.transitions).toEqual([{ from: 'A', event: 'register', to: 'A' }]);
  });

  it('stops collecting Next actions at `Spec ==`', () => {
    const content = `---- MODULE Truncate ----
VARIABLES s

TypeOK ==
  /\\ s \\in {"A"}

Init ==
  /\\ s = "A"

RealAction ==
  /\\ s = "A"
  /\\ s' = "A"

Next ==
  \\/ RealAction

Spec == Init /\\ [][Next]_vars

Invariants ==
  /\\ TypeOK
  \\/ \\E u \\in Users : GhostAction(u)
====
`;
    const snap = parseTlaSpecSnapshot(content, 'truncate');
    const events = snap.transitions.map((t) => t.event);
    expect(events).toEqual(['realAction']);
    expect(events).not.toContain('ghostAction');
  });

  it('degrades gracefully (no throw, empty fields) when TypeInvariant/Init/Next missing', () => {
    // 缺 TypeInvariant → 各字段全空
    const bare = `---- MODULE Bare ----
VARIABLES s

Init ==
  /\\ s = "A"
====
`;
    const snapBare = parseTlaSpecSnapshot(bare, 'bare');
    expect(snapBare.states).toEqual([]);
    expect(snapBare.initialState).toBe('');
    expect(snapBare.transitions).toEqual([]);
    expect(snapBare.invariants).toEqual([]);

    // 缺 Init → initialState 为空串，其余正常提取
    const noInit = `---- MODULE NoInit ----
VARIABLES s

TypeOK ==
  /\\ s \\in {"A"}

Foo ==
  /\\ s = "A"
  /\\ s' = "A"

Next ==
  \\/ Foo
====
`;
    const snapNoInit = parseTlaSpecSnapshot(noInit, 'no-init');
    expect(snapNoInit.states).toEqual(['A']);
    expect(snapNoInit.initialState).toBe('');
    expect(snapNoInit.transitions).toEqual([{ from: 'A', event: 'foo', to: 'A' }]);

    // 缺 Next → transitions 为空
    const noNext = `---- MODULE NoNext ----
VARIABLES s

TypeOK ==
  /\\ s \\in {"A"}

Init ==
  /\\ s = "A"
====
`;
    const snapNoNext = parseTlaSpecSnapshot(noNext, 'no-next');
    expect(snapNoNext.states).toEqual(['A']);
    expect(snapNoNext.initialState).toBe('A');
    expect(snapNoNext.transitions).toEqual([]);
  });

  it('realistic empty-string enum value (`content \\in {"", "valid"}`) is not matched — known limitation', () => {
    // 观察项：varPattern 的 (?:"[^"]+"...)+ 无法匹配以空串 "" 开头的枚举集合
    // （真实文件 L3/L4 的 content / lastError 即此形式），故这些规格同样提取为空。
    const content = `---- MODULE EmptyStr ----
VARIABLES content

TypeOK ==
  /\\ content \\in {"", "valid", "invalid"}

Init ==
  /\\ content = ""

Foo ==
  /\\ content = "valid"
  /\\ content' = "invalid"

Next ==
  \\/ Foo

Spec == Init /\\ [][Next]_vars
====
`;
    const snap = parseTlaSpecSnapshot(content, 'empty-str');
    expect(snap.states).toEqual([]);
    expect(snap.initialState).toBe('');
    expect(snap.transitions).toEqual([]);
  });

  it('named-set style: resolves `var \\in SETNAME` via `SETNAME == {...}` (L2_BlogSystemAuth 风格)', () => {
    const content = `---- MODULE L2_BlogSystemAuth ----
VARIABLES authState

TypeInvariant ==
  /\\ authState \\in AUTH_STATES

AUTH_STATES == {"none", "registered", "loggedIn"}

Init ==
  /\\ authState = "none"

Register ==
  /\\ authState = "none"
  /\\ authState' = "registered"

Next ==
  \\/ Register

Spec == Init /\\ [][Next]_<<authState>>
====
`;
    const snap = parseTlaSpecSnapshot(content, 'L2_BlogSystemAuth');
    // 状态集来自命名集合定义 AUTH_STATES == {...}（非内联字面量）
    expect(snap.states).toEqual(['none', 'registered', 'loggedIn']);
    expect(snap.initialState).toBe('none');
    // 转移沿用 `stateVar = "From"` + `stateVar' = "To"`，事件名 PascalCase → camelCase
    expect(snap.transitions).toContainEqual({ from: 'none', event: 'register', to: 'registered' });
  });

  it('expands `stateVar \\in SETNAME` from-state via named-set resolution', () => {
    const content = `---- MODULE NamedFrom ----
VARIABLES s, u

TypeOK ==
  /\\ s \\in S_STATES
  /\\ u \\in Nat

S_STATES == {"A", "B"}

Init ==
  /\\ s = "A"
  /\\ u = 0

Retry ==
  /\\ s \\in S_STATES
  /\\ s' = "B"

Next ==
  \\/ Retry

Spec == Init /\\ [][Next]_vars
====
`;
    const snap = parseTlaSpecSnapshot(content, 'named-from');
    expect(snap.states).toEqual(['A', 'B']);
    expect(snap.transitions).toEqual([
      { from: 'A', event: 'retry', to: 'B' },
      { from: 'B', event: 'retry', to: 'B' },
    ]);
  });

  it('invariants: normalizes `var # "State" => cond` 与反向 `cond => (var = "State")` 为 `State => cond`', () => {
    const content = `---- MODULE L2AuthInv ----
VARIABLES authState, tokenValid, pwdHashed

TypeInvariant ==
  /\\ authState \\in AUTH_STATES

AUTH_STATES == {"none", "registered", "loggedIn"}

PasswordHashedWhenRegistered ==
  authState # "none" => pwdHashed

TokenValidRequiresLogin ==
  tokenValid => (authState = "loggedIn")

Spec == Init /\\ [][Next]_vars
====
`;
    const snap = parseTlaSpecSnapshot(content, 'L2-auth-inv');
    // # 形式：authState # "none" => pwdHashed → none => pwdHashed（未处于 none 蕴含 pwdHashed）
    expect(snap.invariants).toContain('none => pwdHashed');
    // 反向形式：tokenValid => (authState = "loggedIn") → loggedIn => tokenValid
    expect(snap.invariants).toContain('loggedIn => tokenValid');
  });

  it('passes through specId verbatim', () => {
    const snap = parseTlaSpecSnapshot('', 'REQ-001/SPEC-2');
    expect(snap.specId).toBe('REQ-001/SPEC-2');
  });
});

// ==================== parseFeatureFile（批次 3 Task 6 补强：直接单测） ====================

describe('parseFeatureFile', () => {
  const feat = `# @req: REQ-001
# @design: SD-3.2.1
# @system: L1_blog_system
# @tla-spec: L1_blog_system
# @state-machine: SM-L1-blog_system
# @parent-features: (none)
# @child-features: L2_auth-001.feature
# @scenario-id-prefix: BDD-L1
Feature: Test
Background:
  # @states: A, B, C
  # @initial-state: A
  # @terminal-states: ()
  # @accepting-states: C
  # @rejecting-states: ()
  # @transitions:
  #   A + e -> B
  # @invariants:
  #   A => true
Scenario: 注册成功
  Given 系统处于 "A"
  When 用户执行注册 (Register)
  And 校验通过 (Validate)
  Then 系统进入 "B"
  Then 系统进入 "C"
  And 不变式 "A => true" 应成立
Scenario Outline: 模板
  Given 系统处于 "A"
  When 动作 (Act)
  Then 系统进入 "B"
Scenario: 无 Given 无 Then
  When 动作 (Act)
`;

  it('collects When and And events (tolerating trailing parens), takes first Then, extracts invariant assertions', () => {
    const result = parseFeatureFile(feat);
    const sc = result.scenarios.find((s) => s.scenarioName === '注册成功')!;
    expect(sc.startState).toBe('A');
    // When 与 And 双取，行末括号 (Register) 容忍
    expect(sc.events).toEqual(['Register', 'Validate']);
    // 多 Then 取首个
    expect(sc.expectedEndState).toBe('B');
    expect(sc.invariantAssertions).toEqual(['A => true']);
  });

  it('terminates previous scenario at `Scenario Outline:` and does not parse the outline itself', () => {
    const result = parseFeatureFile(feat);
    const names = result.scenarios.map((s) => s.scenarioName);
    // Scenario Outline 只作终结符：注册成功 场景在 Outline 前结束，Outline 本身不入 scenarios
    expect(names).toEqual(['注册成功', '无 Given 无 Then']);
  });

  it('returns null start/end state when Given/Then missing', () => {
    const result = parseFeatureFile(feat);
    const sc = result.scenarios.find((s) => s.scenarioName === '无 Given 无 Then')!;
    expect(sc.startState).toBeNull();
    expect(sc.events).toEqual(['Act']);
    expect(sc.expectedEndState).toBeNull();
  });
});

// ==================== D8 SD Coverage（Task 6） ====================
// 注：schema（Task 4）在 currentPhase>=2 时强制必填 designCoverage，且 uncoveredSdNodes
// maxItems:0 —— 非空 uncoveredSdNodes 在 schema 层即被拦截（checkBddModel 提前返回）。
// 因此以下用例的构造须让 manifest 通过 schema 以触达业务层 D8 校验（与 Task 5 tla-logic 同模式）：
//   - 用例 1/2：manifest.currentPhase=1 绕过 schema 拦截（uncoveredSdNodes 非空 / designCoverage 缺失），
//     以 phase 参数=2 触发业务层 D8 校验
//   - 用例 3：currentPhase=2 + 全覆盖（uncoveredSdNodes 空数组），应零 violation

describe('D8 SD Coverage', () => {
  it('designCoverage.uncoveredSdNodes 非空时应产生 D8 violations', () => {
    const manifest = {
      schemaVersion: '1.0',
      projectId: 'test',
      basePath: 'features/',
      currentPhase: 1, // currentPhase=1 让 schema 放行非空 uncoveredSdNodes；phase 参数=2 触发业务层 D8 校验
      features: [
        {
          id: 'L1_test-001',
          level: 1,
          filePath: 'L1/L1_test-001.feature',
          scenarioCount: 1,
          stateMachineId: 'SM-L1-test',
          tlaSpecId: 'L1_test',
          reqIds: ['REQ-001'],
          designIds: ['SD-001'],
          parentFeatureIds: [],
          siblingFeatureIds: [],
          childFeatureIds: [],
        },
      ],
      stateMachines: [
        {
          id: 'SM-L1-test',
          level: 1,
          states: ['S1', 'S2'],
          initialState: 'S1',
          terminalStates: [],
          acceptingStates: ['S2'],
          rejectingStates: [],
          transitions: [{ from: 'S1', event: 'e', to: 'S2' }],
          invariants: ['S2 => true'],
        },
      ],
      designCoverage: {
        totalSdNodes: 3,
        coveredSdNodes: ['SD-001'],
        uncoveredSdNodes: ['SD-002', 'SD-003'],
        coverageRate: 0.333,
      },
    } as any;
    const result = checkBddModel({ manifest, phase: 2, parsedFeatures: [] });
    expect(result.dimensions.sdCoverage.length).toBeGreaterThan(0);
    expect(result.dimensions.sdCoverage.join(' ')).toMatch(/SD-002|SD-003/);
    expect(result.passed).toBe(false);
  });

  it('designCoverage 缺失（phase>=2）应产生 D8 violations', () => {
    const manifest = {
      schemaVersion: '1.0',
      projectId: 'test',
      basePath: 'features/',
      currentPhase: 1,
      features: [
        {
          id: 'L1_test-001',
          level: 1,
          filePath: 'L1/L1_test-001.feature',
          scenarioCount: 1,
          stateMachineId: 'SM-L1-test',
          tlaSpecId: 'L1_test',
          reqIds: ['REQ-001'],
          designIds: ['SD-001'],
          parentFeatureIds: [],
          siblingFeatureIds: [],
          childFeatureIds: [],
        },
      ],
      stateMachines: [
        {
          id: 'SM-L1-test',
          level: 1,
          states: ['S1', 'S2'],
          initialState: 'S1',
          terminalStates: [],
          acceptingStates: ['S2'],
          rejectingStates: [],
          transitions: [{ from: 'S1', event: 'e', to: 'S2' }],
          invariants: ['S2 => true'],
        },
      ],
    } as any;
    // currentPhase=1 让 schema 放行；phase 参数=2 触发业务层缺失校验
    const result = checkBddModel({ manifest, phase: 2, parsedFeatures: [] });
    expect(result.dimensions.sdCoverage.length).toBeGreaterThan(0);
    expect(result.dimensions.sdCoverage.join(' ')).toMatch(/designCoverage.*缺失|designCoverage.*missing/);
  });

  it('designCoverage 全覆盖时 D8 violations 为空', () => {
    const manifest = {
      schemaVersion: '1.0',
      projectId: 'test',
      basePath: 'features/',
      currentPhase: 2,
      features: [
        {
          id: 'L1_test-001',
          level: 1,
          filePath: 'L1/L1_test-001.feature',
          scenarioCount: 1,
          stateMachineId: 'SM-L1-test',
          tlaSpecId: 'L1_test',
          reqIds: ['REQ-001'],
          designIds: ['SD-001', 'SD-002'],
          parentFeatureIds: [],
          siblingFeatureIds: [],
          childFeatureIds: [],
        },
      ],
      stateMachines: [
        {
          id: 'SM-L1-test',
          level: 1,
          states: ['S1', 'S2'],
          initialState: 'S1',
          terminalStates: [],
          acceptingStates: ['S2'],
          rejectingStates: [],
          transitions: [{ from: 'S1', event: 'e', to: 'S2' }],
          invariants: ['S2 => true'],
        },
      ],
      designCoverage: {
        totalSdNodes: 2,
        coveredSdNodes: ['SD-001', 'SD-002'],
        uncoveredSdNodes: [],
        coverageRate: 1.0,
      },
    } as any;
    const result = checkBddModel({ manifest, phase: 2, parsedFeatures: [] });
    expect(result.dimensions.sdCoverage).toEqual([]);
  });
});
