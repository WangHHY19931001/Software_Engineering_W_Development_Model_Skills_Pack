/**
 * code-health-contract.ts 规则负载性三态测试（GREEN / RED / STRIPPED）。
 *
 * 目的（O 项）：证明 `logic/code-health-contract.ts` 的每条**已建三态**规则都被测试真正钳住——
 * 用 `helpers/strip-rule.ts` 把规则块从源码中剥掉、写出 os.tmpdir() 副本并真实 import 副本，
 * 对**同一违规输入**断言「本体报该规则 / 副本不再报该规则」，并以合规输入在副本上仍零违规
 * 作为对照（防「剥坏整个函数」的假阳性）。
 *
 * RED 输入构造纪律（可触达性，实测得出）：
 *   - 本文件是纯校验器库（reasons.push 风格，**无 schema 前置门**），GREEN 基线取仓内既有样本
 *     samples/code-health/valid-candidate.json 与 valid-ledger-event.json（既有单测
 *     code-health-contract.test.ts 已断言二者零 reasons），RED 在其深拷贝上做最小变异；
 *   - validateRevision / validateArchiveTransitionEvidence 为导出纯函数，直调构造最小合规输入；
 *   - 本文件绝大多数规则是**无块体单语句 if**（`if (…) reasons.push(…);`，按 helper 契约
 *     「锚点所在声明在出现 `{` 之前已结束」不可剥离）；`} else {` / `} else if` 形态
 *     （implementation 事件分支、confidence/risk/rollback/review/changeScope/archive 的
 *     非对象守卫）与多处重复的 `if (!isRecord(value)) {` 非唯一锚同样不可剥——均不硬凑，
 *     在报告「不可剥离规则」清单如实登记。
 *
 * 本文件不 import node:child_process、不 spawn 子进程 → 无需登记 SUBPROCESS_TEST_FILES。
 */

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as logic from '../logic/code-health-contract.js';

import { stripRuleToCopyUrl } from './helpers/strip-rule.js';

type ContractModule = typeof import('../logic/code-health-contract.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CANDIDATE_SAMPLE = path.join(HERE, '..', 'samples', 'code-health', 'valid-candidate.json');
const EVENT_SAMPLE = path.join(HERE, '..', 'samples', 'code-health', 'valid-ledger-event.json');

/** 合规 candidate（仓内既有样本 valid-candidate.json，既有单测已断言零 reasons）。 */
function loadValidCandidate(): Record<string, unknown> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 固定样本路径，由本测试文件自身位置拼出
  return JSON.parse(readFileSync(CANDIDATE_SAMPLE, 'utf-8')) as Record<string, unknown>;
}

/** 合规 ledger 事件（仓内既有样本 valid-ledger-event.json）。 */
function loadValidEvent(): Record<string, unknown> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 固定样本路径，由本测试文件自身位置拼出
  return JSON.parse(readFileSync(EVENT_SAMPLE, 'utf-8')) as Record<string, unknown>;
}

/** 深拷贝 + 变异：避免同一测试内多次变异互相污染。 */
function mutate(
  base: () => Record<string, unknown>,
  mutator: (value: Record<string, unknown>) => void,
): Record<string, unknown> {
  const value = structuredClone(base());
  mutator(value);
  return value;
}

/** 合规 RevisionIdentity（形态同既有单测 code-health-contract.test.ts 的 revision 常量）。 */
const REVISION: Record<string, unknown> = {
  commitSha: 'a'.repeat(40),
  treeSha: 'b'.repeat(40),
  sourceBundleSha256: 'c'.repeat(64),
  analyzedAt: '2026-09-07T00:00:00.000Z',
};

/** validateArchiveTransitionEvidence 的最小合规输入（5 键齐全 + 合法枚举）。 */
const ARCHIVE_EVIDENCE: Record<string, unknown> = {
  manifestRef: 'evidence/archive/manifest.json',
  manifestSha256: 'd'.repeat(64),
  verificationLevel: 'source-bound',
  sourceRevision: REVISION,
  redactionStatus: 'clean',
};

/** 各规则经哪个公开入口触达（签名不同 → 适配集中在此）。 */
type Entry = 'revision' | 'archive' | 'candidate' | 'event';

function reasonsOf(mod: ContractModule, entry: Entry, input: unknown): string[] {
  switch (entry) {
    case 'revision': {
      const reasons: string[] = [];
      mod.validateRevision(input, 'revision', reasons);
      return reasons;
    }
    case 'archive': {
      const reasons: string[] = [];
      mod.validateArchiveTransitionEvidence(input, 'archive', reasons);
      return reasons;
    }
    case 'candidate':
      return mod.validateCodeHealthCandidate(input);
    case 'event':
      return mod.validateLedgerEvent(input);
  }
}

interface RuleCase {
  /** 规则标识（与 code-health-contract.ts 中的规则名一致） */
  id: string;
  /** 该规则独有的 reasons 文案子串 */
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
    id: 'hasOnlyKeys 未知属性拒绝（additionalProperties 镜像）',
    forbidden: 'has unknown property',
    anchor: 'for (const key of Object.keys(value)) {',
    entry: 'revision',
    red: () =>
      mutate(
        () => ({ ...REVISION }),
        (r) => {
          r.unexpectedExtra = 'x';
        },
      ),
    green: () => REVISION,
  },
  {
    id: 'archive verificationLevel 枚举',
    forbidden: 'verificationLevel is invalid',
    anchor: "if (value.verificationLevel !== 'package-only' && value.verificationLevel !== 'source-bound') {",
    entry: 'archive',
    red: () =>
      mutate(
        () => ARCHIVE_EVIDENCE,
        (a) => {
          a.verificationLevel = 'bogus';
        },
      ),
    green: () => ARCHIVE_EVIDENCE,
  },
  {
    id: 'coverage 指标范围（[0,1] 或 null）',
    forbidden: 'must be null or a number between 0 and 1',
    anchor: "for (const key of ['statements', 'branches', 'functions', 'lines']) {",
    entry: 'candidate',
    red: () =>
      mutate(loadValidCandidate, (c) => {
        ((c.rtmImpact as Record<string, unknown>).coverageBefore as Record<string, unknown>).statements = 1.5;
      }),
    green: () => loadValidCandidate(),
  },
  {
    id: 'risk 枚举校验',
    forbidden: 'risk.severity is invalid',
    anchor: 'for (const [field, allowed] of Object.entries(riskEnums)) {',
    entry: 'candidate',
    red: () =>
      mutate(loadValidCandidate, (c) => {
        (c.risk as Record<string, unknown>).severity = 'bogus';
      }),
    green: () => loadValidCandidate(),
  },
  {
    id: 'command environment 须为审计脱敏 map（凭据键名拒绝）',
    forbidden: 'environment must be an audited redacted string map',
    anchor: 'if (!isAuditedEnvironmentMap(command.environment)) {',
    entry: 'candidate',
    red: () =>
      mutate(loadValidCandidate, (c) => {
        (c.commands as Record<string, unknown>[])[0]!.environment = { token: 'Bearer secret-value' };
      }),
    green: () => loadValidCandidate(),
  },
  {
    id: 'archived 迁移强制 archiveEvidence',
    forbidden: 'archive transition requires archiveEvidence',
    anchor: "if ((value.to === 'archived' || value.eventKind === 'archive') && value.archiveEvidence === undefined) {",
    entry: 'event',
    red: () =>
      mutate(loadValidEvent, (e) => {
        e.to = 'archived';
      }),
    green: () => loadValidEvent(),
  },
  {
    id: 'gateFailureEvidence.failureKind 枚举',
    forbidden: 'failureKind is invalid',
    anchor: 'if (value.gateFailureEvidence !== undefined) {',
    entry: 'event',
    red: () =>
      mutate(loadValidEvent, (e) => {
        const candidate = loadValidCandidate();
        e.gateFailureEvidence = {
          ...(candidate.commands as Record<string, unknown>[])[0]!,
          candidateId: e.candidateId,
          scopeHash: e.scopeHash,
          failureKind: 'bogus',
        };
      }),
    green: () => loadValidEvent(),
  },
];

/** 剥离副本的真实 import（副本由 helper 写入 os.tmpdir()，相对 import 已重写为绝对 file:// URL）。 */
async function loadStripped(anchor: string): Promise<ContractModule> {
  const copyUrl = stripRuleToCopyUrl('code-health-contract.ts', anchor);
  return (await import(copyUrl)) as ContractModule;
}

describe('code-health-contract 规则负载性（GREEN / RED / STRIPPED）', () => {
  it('全部合规输入在本体上零 reasons（三态断言的对照前提）', () => {
    expect(reasonsOf(logic, 'revision', REVISION)).toEqual([]);
    expect(reasonsOf(logic, 'archive', ARCHIVE_EVIDENCE)).toEqual([]);
    expect(reasonsOf(logic, 'candidate', loadValidCandidate())).toEqual([]);
    expect(reasonsOf(logic, 'event', loadValidEvent())).toEqual([]);
  });

  for (const rule of RULES) {
    it(`${rule.id}：剥离规则块后同输入不再报该规则，且副本对合规输入仍零违规`, async () => {
      // RED（本体）：先确认本体确实报出目标规则——证明锚与输入双向匹配。
      const original = reasonsOf(logic, rule.entry, rule.red());
      expect(original.some((r) => r.includes(rule.forbidden))).toBe(true);

      // STRIPPED（副本）：剥掉规则块后，同一违规输入不再产出该规则文案。
      const stripped = await loadStripped(rule.anchor);
      const strippedRed = reasonsOf(stripped, rule.entry, rule.red());
      expect(strippedRed.some((r) => r.includes(rule.forbidden))).toBe(false);

      // GREEN（副本对照）：合规输入在副本上仍零违规——防「剥坏整个函数」的假阳性。
      const strippedGreen = reasonsOf(stripped, rule.entry, rule.green());
      expect(strippedGreen).toEqual([]);
    });
  }
});
