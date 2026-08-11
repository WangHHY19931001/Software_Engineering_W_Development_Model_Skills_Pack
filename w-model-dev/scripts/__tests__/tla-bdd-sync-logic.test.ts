import { describe, it, expect } from 'vitest';
import {
  checkTlaBddSync,
  extractTlaTransitions,
  extractTlaStates,
  extractBddStateMachine,
} from '../logic/tla-bdd-sync-logic.js';

describe('checkTlaBddSync', () => {
  const validTla = `EXTENDS Naturals
VARIABLES state
Init == state = "idle"
Next == \\/ Login \\/ Logout
Login == state = "idle" /\\ state' = "active"
Logout == state = "active" /\\ state' = "idle"
TypeInvariant == state \\in {"idle", "active"}`;

  const validFeature = `Feature: Test
Background:
  Given initial state
  When Login
  When Logout
  Then TypeInvariant`;

  it('TLA+/BDD 一致 → passed=true', () => {
    const result = checkTlaBddSync(validTla, validFeature);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('TLA+ 有 Register 但 BDD 无 → violations 非空', () => {
    const tlaWithRegister = validTla
      .replace('Next == \\/ Login \\/ Logout', 'Next == \\/ Login \\/ Logout \\/ Register')
      .replace(
        'TypeInvariant == state \\in {"idle", "active"}',
        'Register == state = "idle" /\\ state\' = "registered"\nTypeInvariant == state \\in {"idle", "active", "registered"}',
      );
    const result = checkTlaBddSync(tlaWithRegister, validFeature);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.dimension === 'transition' && v.tlaName === 'Register')).toBe(true);
  });

  it('extractTlaTransitions 正确解析转移名', () => {
    const transitions = extractTlaTransitions(validTla);
    expect(transitions).toContain('Login');
    expect(transitions).toContain('Logout');
  });

  it('extractBddStateMachine 正确解析状态机七要素', () => {
    const sm = extractBddStateMachine(validFeature);
    expect(sm.transitions).toContain('Login');
  });

  // D7: \\E 量化项提取
  it('extractTlaTransitions 支持 \\E 量化形式', () => {
    const tlaWithE = `Next ==
  \\/ StartSystem
  \\/ \\E req \\in Request : ReceiveRequest
  \\/ ProcessRequest
  \\/ \\E resp \\in Response : SendResponse

Spec == Init /\\ [][Next]_vars`;
    const transitions = extractTlaTransitions(tlaWithE);
    expect(transitions).toContain('StartSystem');
    expect(transitions).toContain('ReceiveRequest');
    expect(transitions).toContain('ProcessRequest');
    expect(transitions).toContain('SendResponse');
    expect(transitions).not.toContain('Spec');
  });

  // D7: 多行 VARIABLES
  it('extractTlaStates 支持多行 VARIABLES 声明', () => {
    const tlaMultiVar = `VARIABLES
  systemState,
  pendingRequests,
  totalProcessed

Init == systemState = "INIT"`;
    const states = extractTlaStates(tlaMultiVar);
    expect(states).toContain('systemState');
    expect(states).toContain('pendingRequests');
    expect(states).toContain('totalProcessed');
  });

  // D6: Scenario 体步骤提取
  it('extractBddStateMachine 从 Scenario 体提取 Given/When/Then', () => {
    const featureWithScenarios = `Feature: Test
Background:
  Given initial state
  When Login
  Then TypeInvariant

Scenario: user registers
  Given user is idle
  When Register
  Then TypeInvariant`;
    const sm = extractBddStateMachine(featureWithScenarios);
    expect(sm.transitions).toContain('Login');
    expect(sm.transitions).toContain('Register');
  });

  // D6: @states / @transitions 注释声明
  it('extractBddStateMachine 识别 # @states: 和 # @transitions: 注释', () => {
    const featureWithAnnotations = `Feature: Test
Background:
  # @states: INIT, RUNNING, SHUTDOWN
  # @initial-state: INIT
  # @transitions:
  #   INIT + StartSystem -> RUNNING
  #   RUNNING + ShutdownSystem -> SHUTDOWN
  # @invariants:
  #   TypeOK
  Given 系统处于初始状态`;
    const sm = extractBddStateMachine(featureWithAnnotations);
    expect(sm.states).toContain('INIT');
    expect(sm.states).toContain('RUNNING');
    expect(sm.states).toContain('SHUTDOWN');
    expect(sm.transitions).toContain('StartSystem');
    expect(sm.transitions).toContain('ShutdownSystem');
    expect(sm.invariants).toContain('TypeOK');
  });
});
