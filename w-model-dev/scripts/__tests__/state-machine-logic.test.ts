/* eslint-disable security/detect-non-literal-fs-filename -- 读取本仓 samples/state-machine fixture（SAMPLES_DIR），非用户输入 */
/**
 * state-machine-logic.ts 单元测试 —— 状态机一致性校验纯逻辑
 *
 * 复用 samples/state-machine/ 样本断言 checkStateMachineConsistency 的 passed/reasons：
 *   - valid-consistent.json        设计↔代码状态机完全一致 → passed=true
 *   - bad-missing-transition.json  代码缺 draft→published 转移 → passed=false
 *   - bad-extra-transition.json    代码多 archived→deleted 转移 + deleted 状态 → passed=false
 */

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, expectTypeOf } from 'vitest';

import type { ChangeClassification } from '../lib/types.js';
import {
  checkStateMachineConsistency,
  transitionKey,
  type StateMachineConsistencyInput,
  type StateMachineConsistencyResult,
} from '../logic/state-machine-logic.js';

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

  it('bad fixtures 负例（2 夹具逐具名：bad-missing-transition / bad-extra-transition）→ passed=false 且 reasons/分池字段具名', () => {
    const rows = [
      {
        fixture: 'bad-missing-transition.json',
        name: '代码缺转移（bad-missing-transition.json）',
        check: (r: StateMachineConsistencyResult) => {
          expect(r.passed, 'bad-missing-transition.json 应不通过').toBe(false);
          expect(
            r.reasons.some((s) => s.includes('代码状态机缺转移')),
            'bad-missing-transition.json：reasons 含「代码状态机缺转移」',
          ).toBe(true);
          expect(
            r.reasons.some((s) => s.includes('draft→published [publish]')),
            'bad-missing-transition.json：点名缺失转移',
          ).toBe(true);
          expect(r.missingInCode, 'bad-missing-transition.json：missingInCode 具体转移').toEqual([
            { from: 'draft', to: 'published', event: 'publish' },
          ]);
          expect(r.extraInCode, 'bad-missing-transition.json：extraInCode 为空').toEqual([]);
          expect(r.missingStatesInCode, 'bad-missing-transition.json：missingStatesInCode 为空').toEqual([]);
          expect(r.extraStatesInCode, 'bad-missing-transition.json：extraStatesInCode 为空').toEqual([]);
        },
      },
      {
        fixture: 'bad-extra-transition.json',
        name: '代码多转移 + 多状态（bad-extra-transition.json）',
        check: (r: StateMachineConsistencyResult) => {
          expect(r.passed, 'bad-extra-transition.json 应不通过').toBe(false);
          expect(
            r.reasons.some((s) => s.includes('代码状态机多状态')),
            'bad-extra-transition.json：reasons 含「代码状态机多状态」',
          ).toBe(true);
          expect(
            r.reasons.some((s) => s.includes('代码状态机多转移')),
            'bad-extra-transition.json：reasons 含「代码状态机多转移」',
          ).toBe(true);
          expect(r.extraStatesInCode, 'bad-extra-transition.json：extraStatesInCode 具名状态').toEqual(['deleted']);
          expect(r.extraInCode, 'bad-extra-transition.json：extraInCode 具体转移').toEqual([
            { from: 'archived', to: 'deleted', event: 'delete' },
          ]);
          expect(r.missingInCode, 'bad-extra-transition.json：missingInCode 为空').toEqual([]);
          expect(r.missingStatesInCode, 'bad-extra-transition.json：missingStatesInCode 为空').toEqual([]);
        },
      },
    ] as const;
    for (const row of rows) {
      const input = loadSample<StateMachineConsistencyInput>(row.fixture);
      const r = checkStateMachineConsistency(input);
      row.check(r);
    }
  });

  it('transitionKey：带 event 与不带 event 两种格式', () => {
    expect(transitionKey({ from: 'draft', to: 'published', event: 'publish' })).toBe('draft→published [publish]');
    expect(transitionKey({ from: 'draft', to: 'published' })).toBe('draft→published');
  });

  it('零证据守卫（2 态：空输入 / 四数组显式全空）→ passed=false（全空不得判通过，fail-closed）', () => {
    // 语义变更（2026-09-17 审查修复）：原先空输入判 passed=true，
    // 与 CLI 头注「不得按『全空合法图』放行」矛盾——抽取失败会表现为两侧都空而非差异，
    // 属「零证据=通过」类 fail-open，已改为 fail-closed。
    const rows = [
      {
        name: '空输入（缺省字段降级为空数组）',
        input: {} as StateMachineConsistencyInput,
        deep: true,
      },
      {
        name: '四数组显式全空',
        input: {
          designStates: [],
          designTransitions: [],
          codeStates: [],
          codeTransitions: [],
        } as StateMachineConsistencyInput,
        deep: false,
      },
    ] as const;
    for (const row of rows) {
      const r = checkStateMachineConsistency(row.input);
      expect(r.passed, `${row.name}：不得判通过（零证据=通过属 fail-open）`).toBe(false);
      expect(
        r.reasons.some((x) => /输入为空/.test(x)),
        `${row.name}：reasons 含「输入为空」`,
      ).toBe(true);
      if (row.deep) {
        expect(r.designStates, `${row.name}：designStates 降级为空数组`).toEqual([]);
        expect(r.codeTransitions, `${row.name}：codeTransitions 降级为空数组`).toEqual([]);
      }
    }
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

describe('批次1 A2：分类差异 + 零交集守卫', () => {
  it('差异条目附 classification=topology', () => {
    const r = checkStateMachineConsistency({
      designStates: ['idle', 'running'],
      codeStates: ['idle'],
      designTransitions: [{ from: 'idle', to: 'running' }],
      codeTransitions: [],
    });
    expect(r.differences).toContainEqual(
      expect.objectContaining({
        kind: 'transition',
        direction: 'missing-in-code',
        subject: 'idle→running',
        classification: 'topology',
      }),
    );
  });
  it('零交集：两侧非空且状态/转移均无交集 → cannot prove same system，passed=false', () => {
    const r = checkStateMachineConsistency({
      designStates: ['a'],
      codeStates: ['x'],
      designTransitions: [{ from: 'a', to: 'a' }],
      codeTransitions: [{ from: 'x', to: 'x' }],
    });
    expect(r.passed).toBe(false);
    expect(r.reasons).toContain('无共享状态与转移（cannot prove same system），不判一致');
  });
  it('部分交集不触发守卫（正常差异报告）', () => {
    const r = checkStateMachineConsistency({
      designStates: ['a', 'b'],
      codeStates: ['a'],
      designTransitions: [{ from: 'a', to: 'b' }],
      codeTransitions: [],
    });
    expect(r.reasons).not.toContain('无共享状态与转移（cannot prove same system），不判一致');
    expect(r.passed).toBe(false);
  });
});

describe('批次3 任务9：classification 权威类型挂钩 + sharedTransition 救场', () => {
  it('批次3 classification 挂钩权威类型 + sharedTransition 救场', () => {
    const cls: ChangeClassification = 'topology';
    const r = checkStateMachineConsistency({
      designStates: ['a'],
      codeStates: ['x'], // 状态零交集
      designTransitions: [{ from: 'a', to: 'b' }],
      codeTransitions: [{ from: 'a', to: 'b' }], // 转移有交集
    });
    expect(r.reasons.some((s: string) => s.includes('cannot prove same system'))).toBe(false); // 救场路径
    expect(r.differences!.every((d) => d.classification === cls)).toBe(true);
  });

  it("编译期类型挂钩验证：differences[].classification 与权威类型同一（Extract<ChangeClassification, 'topology'>）", () => {
    // 双向同一性断言（漂移即编译失败）：若 classification 被加宽为全量 ChangeClassification
    // 或退化为 string，toEqualTypeOf 不再成立（tsc/vitest typecheck 阶段失败）。
    type ClassificationOf = NonNullable<StateMachineConsistencyResult['differences']>[number]['classification'];
    expectTypeOf<ClassificationOf>().toEqualTypeOf<Extract<ChangeClassification, 'topology'>>();
  });
});
