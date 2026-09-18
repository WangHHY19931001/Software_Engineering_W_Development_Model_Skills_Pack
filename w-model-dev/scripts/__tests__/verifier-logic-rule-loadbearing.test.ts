/**
 * verifier-logic.ts 规则负载性三态测试（GREEN / RED / STRIPPED）。
 *
 * 目的（O 项）：证明 `logic/verifier-logic.ts` 的每条**已建三态**规则都被测试真正钳住——
 * 用 `helpers/strip-rule.ts` 把规则块从源码中剥掉、写出 os.tmpdir() 副本并真实 import 副本，
 * 对**同一违规输入**断言「本体报该规则 / 副本不再报该规则」，并以合规输入在副本上仍零违规
 * 作为对照（防「剥坏整个函数」的假阳性）。
 *
 * RED 输入构造纪律（可触达性，实测得出）：
 *   - 全部规则经主入口 checkVerifierOutput 触达（R13/R18/R12 的剥离锚在其 helper 函数内，
 *     但违规经主入口 reasons 汇聚——同时证明接线生效）；
 *   - GREEN 基线 = 仓内既有样本 samples/verifier/valid.json（合法 A 分 logits 产物），RED 一律
 *     在其深拷贝上做最小变异，且变异须**绕过 schema 前置拦截**（如 schemaVersion 的 schema 约束
 *     是 pattern `^\\d+\\.\\d+$` 而业务规则是 const "1.0"，故 '2.0' 可达业务层；
 *     meta.varianceThreshold 的 schema 上限是 1 而业务上限是 0.1，故 0.5 可达业务层）；
 *   - scoringMethod / repeatTimes / targetKind 枚举、summary 非空等业务分支被 schema
 *     （enum / minimum / minLength）前置拦截，属分层防御非死规则——本文件不建三态，
 *     在报告「不可剥离/不可达规则」清单如实登记；`} else {` / `} else if` 形态
 *     （compositeScore/qualityLevel/passed 一致性、R4 evidence 非空）按 helper 契约不可剥离。
 *
 * 本文件不 import node:child_process、不 spawn 子进程 → 无需登记 SUBPROCESS_TEST_FILES。
 */

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as logic from '../logic/verifier-logic.js';

import { stripRuleToCopyUrl } from './helpers/strip-rule.js';

type VerifierModule = typeof import('../logic/verifier-logic.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VALID_SAMPLE = path.join(HERE, '..', 'samples', 'verifier', 'valid.json');

/** 合规 VerifierOutput（仓内既有样本 samples/verifier/valid.json，GREEN 对照的唯一来源）。 */
function loadValidOutput(): Record<string, unknown> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- VALID_SAMPLE 由本测试文件自身位置拼出的固定样本路径
  return JSON.parse(readFileSync(VALID_SAMPLE, 'utf-8')) as Record<string, unknown>;
}

/** 深拷贝 + 变异：避免同一测试内多次变异互相污染。 */
function mutate(mutator: (output: Record<string, unknown>) => void): Record<string, unknown> {
  const output = structuredClone(loadValidOutput());
  mutator(output);
  return output;
}

function subAt(output: Record<string, unknown>, index: number): Record<string, unknown> {
  // eslint-disable-next-line security/detect-object-injection -- index 为本文件内固定的字面量下标（0-4），非外部输入
  return (output.subCriteria as Record<string, unknown>[])[index]!;
}

interface RuleCase {
  /** 规则标识（与 verifier-logic.ts / verifier-spec 中的规则名一致） */
  id: string;
  /** 该规则独有的 reasons 文案子串 */
  forbidden: string;
  /** 剥离锚：紧邻待剥块之前的唯一单行文本（普查已验唯一 + 可剥 + 副本可 import） */
  anchor: string;
  /** 违规输入（schema 合法、业务规则不合法） */
  red: () => Record<string, unknown>;
}

const RULES: readonly RuleCase[] = [
  {
    id: 'schemaVersion 固定 "1.0"',
    forbidden: 'schemaVersion 必须为',
    anchor: 'if (o.schemaVersion !== SCHEMA_VERSION) {',
    red: () =>
      mutate((o) => {
        o.schemaVersion = '2.0'; // schema 仅约束 pattern ^\d+\.\d+$ → 业务层可达
      }),
  },
  {
    id: 'meta.varianceThreshold 业务上限 0.1',
    forbidden: 'meta.varianceThreshold 必须在 [0,0.1]',
    anchor: 'if (!inRange(varianceThreshold, 0, MAX_VARIANCE_THRESHOLD)) {',
    red: () =>
      mutate((o) => {
        (o.meta as Record<string, unknown>).varianceThreshold = 0.5; // schema 上限 1 → 业务层可达
      }),
  },
  {
    id: '防漂移规则 5：variance ≠ 重算方差（谎报方差）',
    forbidden: '疑似谎报方差',
    anchor: 'if (Array.isArray(sc.rawScores) && sc.rawScores.length >= 2 && isNumber(sc.variance)) {',
    red: () =>
      mutate((o) => {
        subAt(o, 0).rawScores = [0.89, 0.9, 0.92]; // 重算方差 1.5556e-4 ≠ 字段 6.67e-5
      }),
  },
  {
    id: '防漂移规则 1：rawScores 全同（复制填入）',
    forbidden: '疑似手工填写',
    anchor: 'if (Array.isArray(sc.rawScores) && sc.rawScores.length > 1) {',
    red: () =>
      mutate((o) => {
        const sc = subAt(o, 0);
        sc.rawScores = [0.9, 0.9, 0.9];
        sc.variance = 0; // 与重算方差一致，仅规则 1 命中
      }),
  },
  {
    id: 'O3 evidence 格式（EVIDENCE_PATTERN）',
    forbidden: 'O3 命中',
    anchor: 'if (!EVIDENCE_PATTERN.test(item)) {',
    red: () =>
      mutate((o) => {
        subAt(o, 0).evidence = '评审意见整体良好'; // 非「path:§=」格式且非空泛前缀 → 仅格式规则命中
      }),
  },
  {
    id: '阻断性 reworkHint 不得与 passed=true 并存',
    forbidden: '属于阻断性返工提示',
    anchor: 'if (Array.isArray(suppliedReworkHints)) {',
    red: () =>
      mutate((o) => {
        o.reworkHints = ['[Critical] 认证模块缺少威胁模型，必须补充'];
      }),
  },
  {
    id: 'ranking 字段边界（k/temperature/ordered）',
    forbidden: 'ranking.k 必须为整数且 ∈',
    anchor: 'if (o.ranking !== undefined) {',
    red: () =>
      mutate((o) => {
        // schema 仅约束 k≥1/temperature≥0/ordered minItems:1 → k=1、temperature=0、单项 ordered 业务层可达
        o.ranking = { algorithm: 'PPT', k: 1, temperature: 0, rounds: 1, ordered: ['only-one'] };
      }),
  },
  {
    id: 'R13 单轴下限（反模式 #41）',
    forbidden: '单轴下限',
    anchor: 'if (sc.score < SINGLE_AXIS_MIN_SCORE) {',
    red: () =>
      mutate((o) => {
        const sc = subAt(o, 3); // testability（权重 0.15）
        sc.score = 0.6;
        sc.rawScores = [0.59, 0.6, 0.61];
        sc.variance = 6.67e-5; // 与重算方差一致（6.6667e-5，误差 1e-6 内）
        o.compositeScore = 0.8435; // 同步 Σ(score*weight)，隔离 R13 单因子
      }),
  },
  {
    id: 'R18 分辨力下限（非全等但分布坍缩）',
    forbidden: '分布坍缩',
    anchor: 'if (variance < RESOLUTION_FLOOR) {',
    red: () =>
      mutate((o) => {
        const sc = subAt(o, 0);
        sc.rawScores = [0.9001, 0.9002, 0.9]; // 方差 6.667e-9 < 1e-6 且非全等
        sc.variance = 6.67e-9; // 与重算方差一致
      }),
  },
  {
    id: 'R12 evidence 须含具体引用',
    forbidden: '缺具体引用',
    anchor: 'if (!hasSpecificRef) {',
    red: () =>
      mutate((o) => {
        subAt(o, 1).evidence = '整体结论良好且风险可控'; // 无文件路径/行号/章节/ID
      }),
  },
];

function violationsOf(mod: VerifierModule, input: unknown): string[] {
  return mod.checkVerifierOutput(input).reasons;
}

/** 剥离副本的真实 import（副本由 helper 写入 os.tmpdir()，相对 import 已重写为绝对 file:// URL）。 */
async function loadStripped(anchor: string): Promise<VerifierModule> {
  const copyUrl = stripRuleToCopyUrl('verifier-logic.ts', anchor);
  return (await import(copyUrl)) as VerifierModule;
}

describe('verifier-logic 规则负载性（GREEN / RED / STRIPPED）', () => {
  it('合规 VerifierOutput 在本体上零 reasons（三态断言的对照前提）', () => {
    const result = logic.checkVerifierOutput(loadValidOutput());
    expect(result.reasons).toEqual([]);
    expect(result.passed).toBe(true);
  });

  for (const rule of RULES) {
    it(`${rule.id}：剥离规则块后同输入不再报该规则，且副本对合规输入仍零违规`, async () => {
      // RED（本体）：先确认本体确实报出目标规则——证明锚与输入双向匹配。
      const original = violationsOf(logic, rule.red());
      expect(original.some((r) => r.includes(rule.forbidden))).toBe(true);

      // STRIPPED（副本）：剥掉规则块后，同一违规输入不再产出该规则文案。
      const stripped = await loadStripped(rule.anchor);
      const strippedRed = violationsOf(stripped, rule.red());
      expect(strippedRed.some((r) => r.includes(rule.forbidden))).toBe(false);

      // GREEN（副本对照）：合规输入在副本上仍零违规——防「剥坏整个函数」的假阳性。
      const strippedGreen = stripped.checkVerifierOutput(loadValidOutput());
      expect(strippedGreen.reasons).toEqual([]);
      expect(strippedGreen.passed).toBe(true);
    });
  }
});
