import { describe, it, expect } from 'vitest';
import { checkTlaBddSync, extractTlaTransitions, extractBddStateMachine } from '../tla-bdd-sync-logic.js';

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
    const tlaWithRegister = validTla.replace(
      'Next == \\/ Login \\/ Logout',
      'Next == \\/ Login \\/ Logout \\/ Register',
    ).replace(
      'TypeInvariant == state \\in {"idle", "active"}',
      'Register == state = "idle" /\\ state\' = "registered"\nTypeInvariant == state \\in {"idle", "active", "registered"}',
    );
    const result = checkTlaBddSync(tlaWithRegister, validFeature);
    expect(result.passed).toBe(false);
    expect(result.violations.some(v => v.dimension === 'transition' && v.tlaName === 'Register')).toBe(true);
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
});
