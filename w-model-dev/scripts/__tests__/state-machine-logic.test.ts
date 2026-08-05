/**
 * state-machine-logic.ts 单元测试 —— 状态机一致性校验纯逻辑
 *
 * 复用 samples/state-machine/ 样本断言 checkStateMachineConsistency 的 passed/reasons：
 *   - valid-consistent.json        设计↔代码状态机完全一致 → passed=true
 *   - bad-missing-transition.json  代码缺 draft→published 转移 → passed=false
 *   - bad-extra-transition.json    代码多 archived→deleted 转移 + deleted 状态 → passed=false
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkStateMachineConsistency,
  transitionKey,
  type StateMachineConsistencyInput,
  type StateMachineConsistencyResult,
} from '../state-machine-logic.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.resolve(here, '..', 'samples', 'state-machine');

function loadSample<T>(name: string): T {
  const abs = path.resolve(SAMPLES_DIR, name);
  return JSON.parse(readFileSync(abs, 'utf-8')) as T;
}

describe('state-machine-logic', () => {
  it('valid-consistent.json：设计与代码状态机一致 → passed=true 且无 reasons', () => {
    const input = loadSample<StateMachineConsistencyInput>('valid-consistent.json');
    const r = checkStateMachineConsistency(input);
    expect(r.passed).toBe(true);
    expect(r.reasons).toEqual([]);
    expect(r.missingInCode).toEqual([]);
    expect(r.extraInCode).toEqual([]);
    expect(r.missingStatesInCode).toEqual([]);
    expect(r.extraStatesInCode).toEqual([]);
    expect(r.designTransitions).toHaveLength(3);
    expect(r.codeTransitions).toHaveLength(3);
  });

  it('bad-missing-transition.json：代码缺转移 → passed=false 且 reasons 含「代码状态机缺转移」', () => {
    const input = loadSample<StateMachineConsistencyInput>('bad-missing-transition.json');
    const r = checkStateMachineConsistency(input);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(s => s.includes('代码状态机缺转移'))).toBe(true);
    expect(r.reasons.some(s => s.includes('draft→published [publish]'))).toBe(true);
    expect(r.missingInCode).toEqual([{ from: 'draft', to: 'published', event: 'publish' }]);
    expect(r.extraInCode).toEqual([]);
    expect(r.missingStatesInCode).toEqual([]);
    expect(r.extraStatesInCode).toEqual([]);
  });

  it('bad-extra-transition.json：代码多转移 + 多状态 → passed=false 且 reasons 分别含「多转移」「多状态」', () => {
    const input = loadSample<StateMachineConsistencyInput>('bad-extra-transition.json');
    const r = checkStateMachineConsistency(input);
    expect(r.passed).toBe(false);
    expect(r.reasons.some(s => s.includes('代码状态机多状态'))).toBe(true);
    expect(r.reasons.some(s => s.includes('代码状态机多转移'))).toBe(true);
    expect(r.extraStatesInCode).toEqual(['deleted']);
    expect(r.extraInCode).toEqual([{ from: 'archived', to: 'deleted', event: 'delete' }]);
    expect(r.missingInCode).toEqual([]);
    expect(r.missingStatesInCode).toEqual([]);
  });

  it('transitionKey：带 event 与不带 event 两种格式', () => {
    expect(transitionKey({ from: 'draft', to: 'published', event: 'publish' })).toBe('draft→published [publish]');
    expect(transitionKey({ from: 'draft', to: 'published' })).toBe('draft→published');
  });

  it('缺省字段容错：空输入 → passed=true（缺省降级为空数组）', () => {
    const r = checkStateMachineConsistency({});
    expect(r.passed).toBe(true);
    expect(r.reasons).toEqual([]);
    expect(r.designStates).toEqual([]);
    expect(r.codeTransitions).toEqual([]);
  });

  it('返回结构完整性：含设计/代码两侧状态与转移的镜像字段', () => {
    const input = loadSample<StateMachineConsistencyInput>('valid-consistent.json');
    const r: StateMachineConsistencyResult = checkStateMachineConsistency(input);
    expect(r.designStates).toEqual(input.designStates);
    expect(r.codeStates).toEqual(input.codeStates);
    expect(r.designTransitions).toEqual(input.designTransitions);
    expect(r.codeTransitions).toEqual(input.codeTransitions);
  });
});
