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
  validateStateMachineCompleteness,
  validateScenarioPath,
  validateTlaEquivalence,
  checkBddModel,
  type BddStateMachine,
  type TlaSpecSnapshot,
} from '../bdd-logic.js';

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
    expect(violations.some(v => v.includes('@tla-spec'))).toBe(true);
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
    expect(sm.transitions![1].guard).toBe('x>0');
    expect(sm.transitions![1].action).toBe('log');
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
    expect(v.some(s => s.includes('not in @states'))).toBe(true);
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
    expect(v.some(s => s.includes('accepting-states'))).toBe(true);
  });
});

describe('validateScenarioPath', () => {
  const sm: BddStateMachine = {
    id: 'SM-L1-test', level: 1,
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
      sm
    );
    expect(v).toEqual([]);
  });

  it('passes for chained multi-event path', () => {
    const v = validateScenarioPath(
      { scenarioName: 's2', startState: 'A', events: ['e1', 'e2'], expectedEndState: 'C', invariantAssertions: ['C => done'] },
      sm
    );
    expect(v).toEqual([]);
  });

  it('fails for invalid event from current state', () => {
    const v = validateScenarioPath(
      { scenarioName: 's3', startState: 'A', events: ['e2'], expectedEndState: 'C', invariantAssertions: [] },
      sm
    );
    expect(v.some(s => s.includes('no transition'))).toBe(true);
  });

  it('fails for undeclared invariant assertion', () => {
    const v = validateScenarioPath(
      { scenarioName: 's4', startState: 'A', events: ['e1'], expectedEndState: 'B', invariantAssertions: ['X => y'] },
      sm
    );
    expect(v.some(s => s.includes('not declared'))).toBe(true);
  });
});

describe('validateTlaEquivalence', () => {
  const sm: BddStateMachine = {
    id: 'SM-L1-test', level: 1,
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
    expect(v.some(s => s.includes('state set mismatch'))).toBe(true);
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
    expect(v.filter(s => s.includes('invariant'))).toEqual([]);
  });
});

describe('checkBddModel', () => {
  it('returns exitCode=2 when manifest fails schema', () => {
    const result = checkBddModel({
      manifest: { schemaVersion: '0.0' } as any,  // 故意非法
      phase: 1,
    });
    expect(result.exitCode).toBe(2);
    expect(result.passed).toBe(false);
  });
});
