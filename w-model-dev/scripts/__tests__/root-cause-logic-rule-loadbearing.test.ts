/**
 * root-cause-logic.ts 规则负载性三态测试（GREEN / RED / STRIPPED）。
 *
 * 目的（O 项）：证明 `logic/root-cause-logic.ts` 的每条**可剥离**规则都被测试真正钳住——
 * 用 `helpers/strip-rule.ts` 剥掉规则块、写出 os.tmpdir() 副本并真实 import，对同一违规输入
 * 断言「本体报该规则 / 副本不再报」，并以 samples/rootcause/valid.json 在副本上仍零违规作对照。
 *
 * RED 输入构造纪律（可触达性，实测得出）：
 *   - schema（schemas/rootcause-report.schema.json）对 rootCause 必填字段、rootCauseChain minItems、
 *     category enum 等有**前置拦截**，故这些规则的业务层分支不可达（非「死规则」，是分层防御）——
 *     本文件对它们**不建三态**，在报告「不可剥离/不可达规则」清单如实登记；
 *   - 可触达的 RED 一律用「schema 合法但业务规则不合法」的输入：如空白串 `'   '`
 *     （schema minLength=1 通过，业务 `isNonEmptyString` 的 trim 判据失败）。
 *
 * 锚点形态：紧邻待剥块之前的**唯一单行**文本（注释或规则块头）。`} else if` / 无块体 if 形态
 * （R3 falsifiability、R6 upstreamDefect、R10 reality-checker confidence）按 helper 契约不可剥离。
 *
 * 本文件不 import node:child_process、不 spawn 子进程 → 无需登记 SUBPROCESS_TEST_FILES。
 */

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { checkRootCauseReport } from '../logic/root-cause-logic.js';

import { stripRuleToCopyUrl } from './helpers/strip-rule.js';

type RootCauseModule = typeof import('../logic/root-cause-logic.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VALID_SAMPLE = path.join(HERE, '..', 'samples', 'rootcause', 'valid.json');

/** 合规报告（仓内既有样本 samples/rootcause/valid.json，GREEN 对照的唯一来源）。 */
function loadValidReport(): Record<string, unknown> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- VALID_SAMPLE 由本测试文件自身位置拼出的固定样本路径
  return JSON.parse(readFileSync(VALID_SAMPLE, 'utf-8')) as Record<string, unknown>;
}

/** 深拷贝 + 变异：避免同一测试内多次变异互相污染。 */
function mutate(mutator: (report: Record<string, unknown>) => void): unknown {
  const report = structuredClone(loadValidReport());
  mutator(report);
  return report;
}

function at(report: Record<string, unknown>, key: string): Record<string, unknown> {
  // eslint-disable-next-line security/detect-object-injection -- key 为本文件内固定的字面量键名（meta 等），非外部输入
  return report[key] as Record<string, unknown>;
}

function listAt(report: Record<string, unknown>, key: string): Array<Record<string, unknown>> {
  // eslint-disable-next-line security/detect-object-injection -- key 为本文件内固定的字面量键名（rootCauseChain 等），非外部输入
  return report[key] as Array<Record<string, unknown>>;
}

interface RuleCase {
  /** 规则标识（与 root-cause-logic.ts 中 R1-R11 编号一致） */
  id: string;
  /** 该规则独有的 reasons 文案子串 */
  forbidden: string;
  /** 剥离锚（普查已验唯一 + 可剥 + 副本可 import） */
  anchor: string;
  /** 违规输入（schema 合法、业务规则不合法） */
  red: () => unknown;
}

const RULES: readonly RuleCase[] = [
  {
    id: 'R2 rootCauseChain 环节字段非空',
    forbidden: 'rootCauseChain[0].evidence 必填且非空',
    anchor: 'for (let i = 0; i < r.rootCauseChain.length; i++) {',
    red: () =>
      mutate((report) => {
        listAt(report, 'rootCauseChain')[0]!.evidence = '   ';
      }),
  },
  {
    id: 'R4 fixRecommendation 四字段',
    forbidden: 'fixRecommendation[0].rationale 必填且非空',
    anchor: 'for (let i = 0; i < r.fixRecommendation.length; i++) {',
    red: () =>
      mutate((report) => {
        listAt(report, 'fixRecommendation')[0]!.rationale = '   ';
      }),
  },
  {
    id: 'R5 prevention 三字段',
    forbidden: 'prevention[0].owner 必填且非空',
    anchor: 'for (let i = 0; i < r.prevention.length; i++) {',
    red: () =>
      mutate((report) => {
        listAt(report, 'prevention')[0]!.owner = '   ';
      }),
  },
  {
    id: 'R7 qualityLevel 与 passed 一致',
    forbidden: 'qualityLevel=A 与 passed=false 不一致',
    anchor: 'if (r.passed !== expectedPassed) {',
    red: () =>
      mutate((report) => {
        report.passed = false;
      }),
  },
  {
    id: 'R8 reportId 格式',
    forbidden: 'reportId 格式必须为',
    anchor: '// R8 reportId 格式',
    red: () =>
      mutate((report) => {
        at(report, 'meta').reportId = 'RC_BAD-1-1';
      }),
  },
  {
    id: 'R9 method=combined 须有 partialReports',
    forbidden: 'partialReports 必须为非空数组',
    anchor: 'if (isCombined) {',
    red: () =>
      mutate((report) => {
        at(report, 'meta').method = 'combined';
        delete report.partialReports;
      }),
  },
  {
    id: 'R11 persona 须在矩阵内',
    forbidden: '含矩阵外 persona',
    anchor: 'if (unknownSlices.length > 0) {',
    red: () =>
      mutate((report) => {
        at(report, 'meta').method = 'combined';
        report.partialReports = [
          {
            personaSlice: 'engineering-not-in-matrix',
            path: '.w-model/rootcause/partial/RC-phase5-1-01/unknown.json',
            confidence: 0.8,
          },
        ];
      }),
  },
  {
    id: 'R11 persona 须与 category 矩阵行有交集',
    forbidden: '矩阵行无交集',
    anchor: 'if (matrixRow !== undefined && !slices.some((name) => matrixRow.includes(name))) {',
    red: () =>
      mutate((report) => {
        at(report, 'meta').method = 'combined';
        report.partialReports = [
          {
            personaSlice: 'engineering-code-reviewer',
            path: '.w-model/rootcause/partial/RC-phase5-1-01/code-reviewer.json',
            confidence: 0.8,
          },
        ];
      }),
  },
];

async function loadStripped(anchor: string): Promise<RootCauseModule> {
  const copyUrl = stripRuleToCopyUrl('root-cause-logic.ts', anchor);
  return (await import(copyUrl)) as RootCauseModule;
}

describe('root-cause-logic 规则负载性（GREEN / RED / STRIPPED）', () => {
  it('合规报告在本体上零 reasons（三态断言的对照前提）', () => {
    const result = checkRootCauseReport(loadValidReport());
    expect(result.reasons).toEqual([]);
    expect(result.passed).toBe(true);
  });

  for (const rule of RULES) {
    it(`${rule.id}：剥离规则块后同输入不再报该规则，且副本对合规报告仍零 reasons`, async () => {
      const red = rule.red();

      const original = checkRootCauseReport(red);
      expect(original.reasons.some((r) => r.includes(rule.forbidden))).toBe(true);

      const stripped = await loadStripped(rule.anchor);
      const strippedRed = stripped.checkRootCauseReport(red);
      expect(strippedRed.reasons.some((r) => r.includes(rule.forbidden))).toBe(false);

      const strippedGreen = stripped.checkRootCauseReport(loadValidReport());
      expect(strippedGreen.reasons).toEqual([]);
      expect(strippedGreen.passed).toBe(true);
    });
  }
});
