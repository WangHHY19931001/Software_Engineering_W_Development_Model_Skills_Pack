/**
 * checkpoint-logic.ts 规则负载性三态测试（GREEN / RED / STRIPPED）。
 *
 * 目的（O 项）：证明 `logic/checkpoint-logic.ts` 的每条**可剥离**规则都被测试真正钳住——
 * 用 `helpers/strip-rule.ts` 把规则块从源码中剥掉、写出 os.tmpdir() 副本并真实 import 副本，
 * 对**同一违规输入**断言「本体报该规则 / 副本不再报该规则」，并以合规输入在副本上仍零违规
 * 作为对照（防「剥坏整个函数」的假阳性）。
 *
 * 锚点形态（普查裁定，见 .superpowers/sdd/2026-09-18-leftovers-closeout/task-9-report.md）：
 *   - 锚 = **紧邻待剥块之前的整行注释**（含 `//`）或**规则 if 头整行**（起自代码字符）；
 *   - 锚在源码文件内**恰好命中一次**（唯一性由 helper 的 requireUniqueAnchor 强制，不唯一即抛错）；
 *   - 源码为 CRLF 行长，故锚一律取**单行**文本（多行锚的换行字节不可移植）；
 *   - `} else {` 形态（R3 的「未提供 checkpointLog」分支）与无块体 if 按 helper 契约不可剥离，
 *     本文件对这类规则**不建三态**，改在报告「不可剥离规则」清单中如实登记（不硬凑）。
 *
 * 本文件不 import node:child_process、不 spawn 子进程 → 无需登记 SUBPROCESS_TEST_FILES。
 */

import { describe, expect, it } from 'vitest';

import { checkCheckpoint } from '../logic/checkpoint-logic.js';

import { stripRuleToCopyUrl } from './helpers/strip-rule.js';

type CheckpointModule = typeof import('../logic/checkpoint-logic.js');

/** 合规 checkpoint 记录（抄自既有单测 checkpoint-logic.test.ts:15-29 的 fixture，未改字段）。 */
const GREEN_ENTRY = {
  runId: 'cp1',
  timestamp: '2026-07-10T04:00:00Z',
  phase: 1,
  phaseName: '需求与范围',
  action: 'checkpoint',
  role: 'O',
  duration_s: 10,
  tokens: 2000,
  estimated: false,
  subagentSpawns: 0,
  gateExitCode: null,
  outcome: 'success',
  acknowledgedDecisions: ['需求 REQ-1.1：采用 REST + JWT 认证方案'],
};

/** 合规用户确认记录（既有单测 checkpoint-logic.test.ts:39 的同一 Map 形态）。 */
const GREEN_OPTIONS = { checkpointLog: new Map([['1', '用户确认：放行进入阶段 2（user-id: alice）']]) };

interface RuleCase {
  /** 规则标识（与 logic 源码 / docs 中的规则编号一致） */
  id: string;
  /** 该规则独有的违规文案子串（禁止用整段文案：子规则间文案前缀相同） */
  forbidden: string;
  /** 剥离锚：紧邻待剥块之前的唯一单行文本（普查已验唯一 + 可剥 + 副本可 import） */
  anchor: string;
  /** 违规输入（触发该规则；其余规则不因此输入产生**同族**文案） */
  red: { entry: unknown; options?: { checkpointLog?: Map<string, string> } };
}

const RULES: readonly RuleCase[] = [
  {
    id: 'R0 零证据守卫',
    forbidden: '零证据不等于合规',
    anchor: '// R0 零证据守卫：无任何 checkpoint success 记录时不得判通过。',
    red: { entry: [] },
  },
  {
    id: 'R1 acknowledgedDecisions 非空',
    forbidden: 'acknowledgedDecisions 为空',
    anchor: '// R1 acknowledgedDecisions 非空',
    red: { entry: [{ ...GREEN_ENTRY, acknowledgedDecisions: [] }], options: GREEN_OPTIONS },
  },
  {
    id: 'R2 泛化模板黑名单',
    forbidden: '命中泛化模板黑名单',
    anchor: '// 1. 黑名单检查（大小写敏感，OK/yes 英文原样）',
    red: { entry: [{ ...GREEN_ENTRY, acknowledgedDecisions: ['OK'] }], options: GREEN_OPTIONS },
  },
  {
    id: 'R2 决策长度下限',
    forbidden: '长度 < 10',
    anchor: '// 2. 长度检查（Unicode 码点数，中英文都算 1）',
    red: { entry: [{ ...GREEN_ENTRY, acknowledgedDecisions: ['太短'] }], options: GREEN_OPTIONS },
  },
  {
    id: 'R2 具体名词启发式',
    forbidden: '未含具体名词',
    anchor: 'if (!hasId && !hasTech) {',
    red: {
      entry: [{ ...GREEN_ENTRY, acknowledgedDecisions: ['本次讨论充分，结论已经形成并记录在案'] }],
      options: GREEN_OPTIONS,
    },
  },
  {
    id: 'R3 用户确认存在（已提供 checkpointLog 分支）',
    forbidden: '疑似 O 自问自答',
    anchor: "if (!userConfirm || userConfirm.trim() === '') {",
    red: {
      entry: [GREEN_ENTRY],
      options: { checkpointLog: new Map([['2', '用户确认：放行进入阶段 3（user-id: bob）']]) },
    },
  },
  {
    id: 'R4 决策与阶段匹配',
    forbidden: '与阶段主题不匹配',
    anchor: '// R4 决策与阶段匹配',
    red: {
      entry: [{ ...GREEN_ENTRY, phase: 2, acknowledgedDecisions: ['REQ-1.1 已确认，方案落地'] }],
      options: { checkpointLog: new Map([['2', '用户确认：放行进入阶段 3（user-id: bob）']]) },
    },
  },
  {
    id: 'R5 跨阶段证据一致（静默推翻）',
    forbidden: '疑似静默推翻',
    anchor: 'if (hasNegation && !reworkedPhases.has(e.phase)) {',
    red: {
      entry: [{ ...GREEN_ENTRY, acknowledgedDecisions: ['需求 REQ-1.1 改为使用 SQLite 存储方案'] }],
      options: GREEN_OPTIONS,
    },
  },
];

/** 剥离副本的真实 import（副本由 helper 写入 os.tmpdir()，相对 import 已重写为绝对 file:// URL）。 */
async function loadStripped(anchor: string): Promise<CheckpointModule> {
  const copyUrl = stripRuleToCopyUrl('checkpoint-logic.ts', anchor);
  return (await import(copyUrl)) as CheckpointModule;
}

describe('checkpoint-logic 规则负载性（GREEN / RED / STRIPPED）', () => {
  it('合规输入在本体上零违规（三态断言的对照前提）', () => {
    const result = checkCheckpoint([GREEN_ENTRY], GREEN_OPTIONS);
    expect(result.violations).toEqual([]);
    expect(result.passed).toBe(true);
  });

  for (const rule of RULES) {
    it(`${rule.id}：剥离规则块后同输入不再报该规则，且副本对合规输入仍零违规`, async () => {
      // RED（本体）：先确认本体确实报出目标规则——证明锚与输入双向匹配。
      const original = checkCheckpoint(rule.red.entry as unknown[], rule.red.options);
      expect(original.violations.some((v) => v.includes(rule.forbidden))).toBe(true);

      // STRIPPED（副本）：剥掉规则块后，同一违规输入不再产出该规则文案。
      const stripped = await loadStripped(rule.anchor);
      const strippedRed = stripped.checkCheckpoint(rule.red.entry as unknown[], rule.red.options);
      expect(strippedRed.violations.some((v) => v.includes(rule.forbidden))).toBe(false);

      // GREEN（副本对照）：合规输入在副本上仍零违规——防「剥坏整个函数」的假阳性。
      const strippedGreen = stripped.checkCheckpoint([GREEN_ENTRY], GREEN_OPTIONS);
      expect(strippedGreen.violations).toEqual([]);
      expect(strippedGreen.passed).toBe(true);
    });
  }
});
