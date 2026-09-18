/**
 * tla-logic.ts 规则负载性三态测试（GREEN / RED / STRIPPED）。
 *
 * 目的（O 项）：证明 `logic/tla-logic.ts` 的每条**已建三态**规则都被测试真正钳住——
 * 用 `helpers/strip-rule.ts` 把规则块从源码中剥掉、写出 os.tmpdir() 副本并真实 import 副本，
 * 对**同一违规输入**断言「本体报该规则 / 副本不再报该规则」，并以合规输入在副本上仍零违规
 * 作为对照（防「剥坏整个函数」的假阳性）。
 *
 * RED 输入构造纪律（可触达性，实测得出）：
 *   - tla-manifest schema 对 basePath 空串/非串、checkRounds 元素未知字段（additionalProperties:false）、
 *     sdCoverage（currentPhase>=2 必填）等有**前置拦截**（[schema] 前缀提前返回），
 *     这些分支的业务层规则对 schema 合法输入不可达（非「死规则」，是分层防御）——如实登记，
 *     其中 R13 字段规则改经**导出的纯函数** checkRoundsSchema 直调触达（函数内无 schema 门）；
 *   - checkTlaModel 主入口 RED 一律以既有单测 tla-logic.test.ts 的
 *     makeValidManifestWithoutBasePath() + basePath:'.' 为 GREEN 基线做最小变异；
 *   - checkCoverage / checkCfgStructure / validateHeader 为导出纯函数，直调方式与既有单测一致。
 *
 * 锚点形态（普查裁定）：紧邻待剥块之前的**唯一单行**文本（整行 `//` 注释或规则块 if/for 头，起自代码字符）；
 * 源码为 CRLF 行长，故锚一律取单行文本。`} else {` / `} else if` 形态（checkHierarchy 全家、
 * sdCoverage 缺失分支等）与无块体单语句 if 按 helper 契约不可剥离，本文件不硬凑，
 * 在报告「不可剥离规则」清单中如实登记。
 *
 * 本文件不 import node:child_process、不 spawn 子进程 → 无需登记 SUBPROCESS_TEST_FILES。
 */

import { describe, expect, it } from 'vitest';

import * as logic from '../logic/tla-logic.js';
import type { TlaManifest, TlaSpec } from '../logic/tla-logic.js';

import { stripRuleToCopyUrl } from './helpers/strip-rule.js';

type TlaModule = typeof import('../logic/tla-logic.js');

/** 合规 manifest（抄自既有单测 tla-logic.test.ts:37-92 的 fixture + basePath:'.'，全部标志为通过）。 */
function makeValidManifest(): Record<string, unknown> {
  return {
    version: 1,
    currentPhase: 2,
    basePath: '.',
    tools: { jarPath: 'tools/tla2tools.jar', javaMinVersion: 11 },
    specs: [
      {
        id: 'L1-system',
        level: 'L1',
        phase: 1,
        system: 'sample-system',
        requirementIds: ['REQ-001'],
        designRef: 'docs/requirement-spec.md',
        tlaPath: 'tla/L1-system.tla',
        cfgPath: 'tla/L1-system.cfg',
        parent: null,
        siblings: [],
        children: ['tla/L2-auth.tla'],
        variableCombination: 240,
        decompositionDecision: 'kept-below-threshold',
        syntaxChecked: true,
        tlcChecked: true,
        deadlockFree: true,
        invariantsHold: true,
        stateExplosion: false,
      },
      {
        id: 'L2-auth',
        level: 'L2',
        phase: 2,
        system: 'sample-system::auth',
        requirementIds: ['REQ-001'],
        designRef: 'docs/system-design.md',
        tlaPath: 'tla/L2-auth.tla',
        cfgPath: 'tla/L2-auth.cfg',
        parent: 'tla/L1-system.tla',
        siblings: [],
        children: [],
        variableCombination: 80,
        decompositionDecision: 'kept-below-threshold',
        syntaxChecked: true,
        tlcChecked: true,
        deadlockFree: true,
        invariantsHold: true,
        stateExplosion: false,
      },
    ],
    checkRounds: [],
    sdCoverage: {
      totalSdNodes: 0,
      coveredSdNodes: [],
      uncoveredSdNodes: [],
      coverageRate: 1,
    },
  };
}

/** 深拷贝 + 变异：避免同一测试内多次变异互相污染。 */
function mutateManifest(mutator: (manifest: Record<string, unknown>) => void): Record<string, unknown> {
  const manifest = structuredClone(makeValidManifest());
  mutator(manifest);
  return manifest;
}

/** checkCoverage 直调用的最小合规 spec（形态同既有单测 tla-logic.test.ts:131-148 的 baseSpec）。 */
function makeCoverageSpec(requirementIds: string[]): TlaSpec {
  return {
    id: 'L1_system',
    level: 'L1',
    phase: 1,
    system: 'test',
    requirementIds,
    designRef: '',
    tlaPath: 'a.tla',
    cfgPath: 'a.cfg',
    parent: null,
    siblings: [],
    children: [],
    variableCombination: 1,
    decompositionDecision: 'kept-below-threshold',
    syntaxChecked: true,
    tlcChecked: true,
    deadlockFree: true,
    invariantsHold: true,
    stateExplosion: false,
  };
}

/** 合规 checkRounds 元素（全部必填字段 + 合法类型，schema 同款约束）。 */
const VALID_ROUND: Record<string, unknown> = {
  phase: 1,
  round: 1,
  specId: 'L1-system',
  syntaxCheck: true,
  tlcCheck: true,
  violations: [],
  converged: true,
};

/** validateHeader 的合规 header/spec 组合（8 字段齐全且一致）。 */
const VALID_HEADER_SPEC = {
  header: {
    system: 'sample-system',
    requirement: 'REQ-001',
    design: 'docs/requirement-spec.md',
    parent: null,
    sibling: null,
    child: null,
    level: 'L1',
    phase: '1',
  } as Record<string, string | null>,
  spec: {
    id: 'L1-system',
    system: 'sample-system',
    requirementIds: ['REQ-001'],
    designRef: 'docs/requirement-spec.md',
    parent: null,
    siblings: [],
    children: [],
    level: 'L1',
    phase: 1,
  },
};

const VALID_CFG = 'SPECIFICATION Spec\nINVARIANT TypeOK\nINIT Init';

/** 各规则经哪个公开入口触达（签名不同 → 2-4 行适配集中在此）。 */
type Entry = 'model' | 'rounds' | 'header' | 'coverage' | 'cfgStructure';

function violationsOf(mod: TlaModule, entry: Entry, input: unknown): string[] {
  switch (entry) {
    case 'model':
      return mod.checkTlaModel(input, 2).violations;
    case 'rounds':
      return mod.checkRoundsSchema(input as Partial<TlaManifest>);
    case 'header': {
      const { header, spec } = input as typeof VALID_HEADER_SPEC;
      return mod.validateHeader(header, spec as never);
    }
    case 'coverage': {
      const { specs, graphSdNodes } = input as { specs: TlaSpec[]; graphSdNodes: string[] };
      return mod.checkCoverage(specs, graphSdNodes).violations;
    }
    case 'cfgStructure':
      return mod.checkCfgStructure(input as string).violations;
  }
}

interface RuleCase {
  /** 规则标识（与 tla-logic.ts / 设计文档中的规则名一致） */
  id: string;
  /** 该规则独有的违规文案子串 */
  forbidden: string;
  /** 剥离锚：紧邻待剥块之前的唯一单行文本（普查已验唯一 + 可剥 + 副本可 import） */
  anchor: string;
  /** 规则入口 */
  entry: Entry;
  /** 违规输入（触发该规则；其余规则不因此输入产生同族文案） */
  red: () => unknown;
  /** 合规输入（副本对照，期望零违规） */
  green: () => unknown;
}

const RULES: readonly RuleCase[] = [
  {
    id: 'P1.1 basePath 强制字段（缺失）',
    forbidden: 'manifest.basePath 缺失',
    anchor: "if (typeof m.basePath !== 'string' || m.basePath === '') {",
    entry: 'model',
    red: () => {
      const m = mutateManifest(() => {});
      delete m.basePath; // schema 未列 required → 业务层可达（既有单测同款）
      return m;
    },
    green: () => makeValidManifest(),
  },
  {
    id: '声明标志 tlcChecked=false',
    forbidden: 'TLC 模型检查未完成',
    anchor: 'if (!s.tlcChecked) {',
    entry: 'model',
    red: () =>
      mutateManifest((m) => {
        (m.specs as Record<string, unknown>[])[1]!.tlcChecked = false;
      }),
    green: () => makeValidManifest(),
  },
  {
    id: '声明标志 syntaxChecked=false',
    forbidden: 'SANY 语法检查未通过或未执行',
    anchor: 'if (!s.syntaxChecked) {',
    entry: 'model',
    red: () =>
      mutateManifest((m) => {
        (m.specs as Record<string, unknown>[])[1]!.syntaxChecked = false;
      }),
    green: () => makeValidManifest(),
  },
  {
    id: '拆解决策 must-split',
    forbidden: '拆解校验失败',
    anchor: "if (combo > MUST_SPLIT_THRESHOLD && s.decompositionDecision !== 'split-done') {",
    entry: 'model',
    red: () =>
      mutateManifest((m) => {
        const spec = (m.specs as Record<string, unknown>[])[1]!;
        spec.variableCombination = 20000; // schema 无上限 → 业务层可达
        spec.decompositionDecision = 'must-split';
      }),
    green: () => makeValidManifest(),
  },
  {
    id: 'R13 checkRounds 禁止 phase 级摘要字段',
    forbidden: '含禁止字段',
    anchor: 'for (const f of FORBIDDEN_FIELDS) {',
    entry: 'rounds',
    red: () => ({ checkRounds: [{ ...VALID_ROUND, phaseSummary: 'phase 级摘要' }] }),
    green: () => ({ checkRounds: [VALID_ROUND] }),
  },
  {
    id: '文件头必填字段齐全',
    forbidden: '文件头缺失字段',
    anchor: 'for (const field of REQUIRED_HEADER_FIELDS) {',
    entry: 'header',
    red: () => ({ header: { system: 'sample-system' }, spec: VALID_HEADER_SPEC.spec }),
    green: () => VALID_HEADER_SPEC,
  },
  {
    id: 'P1.2 SD 覆盖 spec 方向：缺 requirementIds',
    forbidden: '缺 requirementIds',
    anchor: 'if (!Array.isArray(spec.requirementIds) || spec.requirementIds.length === 0) {',
    entry: 'coverage',
    red: () => ({ specs: [makeCoverageSpec([])], graphSdNodes: ['SD-001'] }),
    green: () => ({ specs: [makeCoverageSpec(['SD-001'])], graphSdNodes: ['SD-001'] }),
  },
  {
    id: 'P1.2 SD 覆盖 spec 方向：无 SD 标识',
    forbidden: '无 SD 标识',
    anchor: 'if (!hasSdId) {',
    entry: 'coverage',
    red: () => ({ specs: [makeCoverageSpec(['REQ-001'])], graphSdNodes: ['SD-001'] }),
    green: () => ({ specs: [makeCoverageSpec(['SD-001'])], graphSdNodes: ['SD-001'] }),
  },
  {
    id: 'cfg 结构：禁止 MODULE 声明',
    forbidden: '含 MODULE 声明',
    anchor: 'if (/----\\s*MODULE\\s/m.test(content)) {',
    entry: 'cfgStructure',
    red: () => '---- MODULE M ----\nSPECIFICATION Spec\nINIT Init',
    green: () => VALID_CFG,
  },
  {
    id: 'cfg 结构：裸 INVARIANT 缺不变式名',
    forbidden: 'INVARIANT 缺少不变式名',
    anchor: 'for (let i = 0; i < lines.length; i++) {',
    entry: 'cfgStructure',
    red: () => 'SPECIFICATION Spec\nINVARIANT\nINIT Init',
    green: () => VALID_CFG,
  },
];

/** 剥离副本的真实 import（副本由 helper 写入 os.tmpdir()，相对 import 已重写为绝对 file:// URL）。 */
async function loadStripped(anchor: string): Promise<TlaModule> {
  const copyUrl = stripRuleToCopyUrl('tla-logic.ts', anchor);
  return (await import(copyUrl)) as TlaModule;
}

describe('tla-logic 规则负载性（GREEN / RED / STRIPPED）', () => {
  it('全部合规输入在本体上零违规（三态断言的对照前提）', () => {
    expect(violationsOf(logic, 'model', makeValidManifest())).toEqual([]);
    expect(violationsOf(logic, 'rounds', { checkRounds: [VALID_ROUND] })).toEqual([]);
    expect(violationsOf(logic, 'header', VALID_HEADER_SPEC)).toEqual([]);
    expect(
      violationsOf(logic, 'coverage', { specs: [makeCoverageSpec(['SD-001'])], graphSdNodes: ['SD-001'] }),
    ).toEqual([]);
    expect(violationsOf(logic, 'cfgStructure', VALID_CFG)).toEqual([]);
  });

  for (const rule of RULES) {
    it(`${rule.id}：剥离规则块后同输入不再报该规则，且副本对合规输入仍零违规`, async () => {
      // RED（本体）：先确认本体确实报出目标规则——证明锚与输入双向匹配。
      const original = violationsOf(logic, rule.entry, rule.red());
      expect(original.some((v) => v.includes(rule.forbidden))).toBe(true);

      // STRIPPED（副本）：剥掉规则块后，同一违规输入不再产出该规则文案。
      const stripped = await loadStripped(rule.anchor);
      const strippedRed = violationsOf(stripped, rule.entry, rule.red());
      expect(strippedRed.some((v) => v.includes(rule.forbidden))).toBe(false);

      // GREEN（副本对照）：合规输入在副本上仍零违规——防「剥坏整个函数」的假阳性。
      const strippedGreen = violationsOf(stripped, rule.entry, rule.green());
      expect(strippedGreen).toEqual([]);
    });
  }
});
