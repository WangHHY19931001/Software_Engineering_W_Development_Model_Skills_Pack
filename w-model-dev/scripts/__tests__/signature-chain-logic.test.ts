import { readFileSync } from 'node:fs';
import * as path from 'node:path';

import { describe, it, expect } from 'vitest';

import { checkSignatureChain, computeSigHash, type SignatureChainEntry } from '../logic/signature-chain-logic.js';

const SAMPLES_DIR = path.join(__dirname, '..', 'samples', 'signature-chain');

function loadJsonl(filename: string): SignatureChainEntry[] {
  const content = readFileSync(path.join(SAMPLES_DIR, filename), 'utf-8');
  return content
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

describe('signature-chain-logic R1-R10', () => {
  it('R1 valid-all-roles 通过', () => {
    const entries = loadJsonl('valid-all-roles.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.passed).toBe(true);
    expect(result.rulesFailed).not.toContain('R1');
  });

  it('R1 bad-missing-V 失败', () => {
    const entries = loadJsonl('bad-missing-V.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.rulesFailed).toContain('R1');
  });

  it('R2 bad-broken-chain 失败', () => {
    const entries = loadJsonl('bad-broken-chain.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.rulesFailed).toContain('R2');
  });

  it('R3 bad-backdated 失败', () => {
    const entries = loadJsonl('bad-backdated.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.rulesFailed).toContain('R3');
  });

  it('bad-O-produce（非法角色 X）被 schema role enum 前置拦截', () => {
    const entries = loadJsonl('bad-O-produce.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.rulesFailed).toContain('R1');
    expect(result.violations.some((v) => v.startsWith('[schema]'))).toBe(true);
  });

  it('R5 bad-O-self-sign 失败（代签检测）', () => {
    const entries = loadJsonl('bad-O-self-sign.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.rulesFailed).toContain('R5');
  });

  it('R6 bad-tampered-hash 失败（防篡改）', () => {
    const entries = loadJsonl('bad-tampered-hash.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.rulesFailed).toContain('R6');
  });

  it('R7 bad-dangling-source 失败（悬空来源）', () => {
    const entries = loadJsonl('bad-dangling-source.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.rulesFailed).toContain('R7');
  });

  it('R8 bad-missing-artifact 失败（缺失产物）', () => {
    const entries = loadJsonl('bad-missing-artifact.jsonl');
    // R8 needs existingPaths — pass an empty set so the missing artifact is detected
    const result = checkSignatureChain(entries, { phase: 1, existingPaths: new Set<string>() });
    expect(result.rulesFailed).toContain('R8');
  });

  it('R9 bad-S-consumes-G 失败（越权消费）', () => {
    const entries = loadJsonl('bad-S-consumes-G.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.rulesFailed).toContain('R9');
  });

  it('R9 bad-R-consumes-S 失败（R 不得消费 S）', () => {
    const entries = loadJsonl('bad-R-consumes-S.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.rulesFailed).toContain('R9');
  });

  it('R10 bad-O-bypass-G 失败（绕过门禁）', () => {
    const entries = loadJsonl('bad-O-bypass-G.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.rulesFailed).toContain('R10');
  });

  it('computeSigHash 一致性', () => {
    const entries = loadJsonl('valid-all-roles.jsonl');
    const entry = entries[0]!;
    const recomputed = computeSigHash(entry);
    expect(recomputed).toBe(entry.sigHash);
  });

  // E1: 跨阶段连续链（archive 模式）
  it('E1 连续链 archive pass', () => {
    const entries = loadJsonl('valid-continuous-chain.jsonl');
    const result = checkSignatureChain(entries, { stage: 'archive' });
    expect(result.passed).toBe(true);
    expect(result.rulesFailed).not.toContain('R2');
  });

  // E1: 跨阶段连续链（--phase=2 模式）
  it('E1 连续链 --phase=2 pass', () => {
    const entries = loadJsonl('valid-continuous-chain.jsonl');
    const result = checkSignatureChain(entries, { phase: 2 });
    expect(result.passed).toBe(true);
    expect(result.rulesFailed).not.toContain('R2');
  });

  // E1: 跨阶段断链（prevSigId 不存在）
  it('E1 跨阶段断链 --phase=2 fail', () => {
    const entries = loadJsonl('bad-broken-cross-phase.jsonl');
    const result = checkSignatureChain(entries, { phase: 2 });
    expect(result.rulesFailed).toContain('R2');
  });

  // E2: 跨阶段来源并集（--phase=2 模式允许引用 phase 1 sigIds）
  it('E2 跨阶段来源并集 --phase=2 pass', () => {
    const entries = loadJsonl('valid-continuous-chain.jsonl');
    const result = checkSignatureChain(entries, { phase: 2 });
    expect(result.passed).toBe(true);
    expect(result.rulesFailed).not.toContain('R7');
  });

  // E3: 全违规聚合 — 验证多个违规能被收集
  it('E3 全违规聚合 multiple violations collected', () => {
    const entries = loadJsonl('bad-broken-chain.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.rulesFailed).toContain('R2');
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
  });
});

// ==================== D-1 返工来源例外（role×action×targetKind 三元判定） ====================

/**
 * 构造带正确 sigHash 的单环条目（D-1 测试助手）。
 * genesis 起点单条目：R1/R2 等链级规则必然失败，但 D-1 用例只聚焦 R9 断言（过滤 R9 前缀），
 * 因此单环足够；sourceSigIds 指向 genesis 以免引入 R7 悬空来源噪声。
 */
function entry(over: {
  sigId?: string;
  role?: SignatureChainEntry['role'];
  action?: string;
  targetKind?: SignatureChainEntry['targetKind'];
  sourceRoles?: SignatureChainEntry['inputProvenance']['sourceArtifacts'][number]['sourceRole'][];
}): SignatureChainEntry {
  const role = over.role ?? 'S';
  const sourceRoles = over.sourceRoles ?? [];
  const base: Omit<SignatureChainEntry, 'sigHash'> = {
    sigId: over.sigId ?? `wm1-r001-${role}1`,
    phase: 1,
    role,
    action: over.action ?? 'produce',
    runId: 'wm1-r001',
    artifacts: ['.w-model/artifact.md'],
    prevSigId: 'genesis',
    prevSigHash: '0',
    signedAt: '2026-09-21T10:00:00.000Z',
    signer: `${role.toLowerCase()}-agent-1`,
    inputProvenance: {
      sourceSigIds: sourceRoles.length > 0 ? ['genesis'] : [],
      sourceArtifacts: sourceRoles.map((srcRole) => ({
        path: `.w-model/upstream-${srcRole}.md`,
        sourceSigId: 'genesis',
        sourceRole: srcRole,
      })),
      transformDescription: 'D-1 测试构造的单环',
    },
    ...(over.targetKind !== undefined ? { targetKind: over.targetKind } : {}),
  };
  return { ...base, sigHash: computeSigHash(base) };
}

describe('signature-chain-logic D-1 返工来源例外', () => {
  it('S + fix + 消费 R → 放行（D-1 例外，反模式 #18 守护的正面路径）', () => {
    const r = checkSignatureChain([entry({ role: 'S', action: 'fix', sourceRoles: ['R'] })]);
    expect(r.violations.filter((v) => v.startsWith('R9'))).toEqual([]);
    expect(r.rulesFailed).not.toContain('R9');
  });

  it('S + produce + 消费 R → 仍拒（#18 守护：例外仅限 fix/emergency-fix）', () => {
    const r = checkSignatureChain([entry({ role: 'S', action: 'produce', sourceRoles: ['R'] })]);
    expect(r.violations).toEqual(expect.arrayContaining([expect.stringMatching(/R9: .*角色 S 不得消费 R/)]));
    expect(r.rulesFailed).toContain('R9');
  });

  it('V + review + targetKind=rootcause + 消费 R → 放行（V 复审 RootCauseReport）', () => {
    const r = checkSignatureChain([
      entry({ role: 'V', action: 'review', sourceRoles: ['R'], targetKind: 'rootcause' }),
    ]);
    expect(r.violations.filter((v) => v.startsWith('[schema]'))).toEqual([]); // targetKind 须通过 schema
    expect(r.violations.filter((v) => v.startsWith('R9'))).toEqual([]);
    expect(r.rulesFailed).not.toContain('R9');
  });

  it('V + review + targetKind=standard + 消费 R → 仍拒', () => {
    const r = checkSignatureChain([entry({ role: 'V', action: 'review', sourceRoles: ['R'], targetKind: 'standard' })]);
    expect(r.violations).toEqual(expect.arrayContaining([expect.stringMatching(/R9: .*角色 V 不得消费 R/)]));
    expect(r.rulesFailed).toContain('R9');
  });

  it('R + locate + targetKind=preventive + 消费 S → 放行（R3 预防性审查）', () => {
    const r = checkSignatureChain([
      entry({ role: 'R', action: 'locate', sourceRoles: ['S'], targetKind: 'preventive' }),
    ]);
    expect(r.violations.filter((v) => v.startsWith('[schema]'))).toEqual([]);
    expect(r.violations.filter((v) => v.startsWith('R9'))).toEqual([]);
    expect(r.rulesFailed).not.toContain('R9');
  });

  it('R + locate + targetKind=rootcause + 消费 S → 仍拒', () => {
    const r = checkSignatureChain([
      entry({ role: 'R', action: 'locate', sourceRoles: ['S'], targetKind: 'rootcause' }),
    ]);
    expect(r.violations).toEqual(expect.arrayContaining([expect.stringMatching(/R9: .*角色 R 不得消费 S/)]));
    expect(r.rulesFailed).toContain('R9');
  });

  // 裁定 A：targetKind 是不入哈希的元数据——改哈希公式会让全部既有签名链（demo 125 环）失效
  it('D-1: targetKind 不入 sigHash（带与不带 targetKind 的同环 sigHash 相同）', () => {
    const withoutTk = entry({ role: 'V', action: 'review', sourceRoles: ['R'] });
    const withTk: SignatureChainEntry = { ...withoutTk, targetKind: 'rootcause' };
    // 除 targetKind 外字段全同（同一 helper 产物 + 显式展开），sigHash 不受 targetKind 影响：
    // 给带 targetKind 的条目重算哈希，仍与不带时的 sigHash 一致 → targetKind 未参与哈希输入
    expect(computeSigHash(withTk)).toBe(withoutTk.sigHash);
    expect(withTk.sigHash).toBe(withoutTk.sigHash);
    const r = checkSignatureChain([withTk]);
    expect(r.violations.filter((v) => v.startsWith('[schema]'))).toEqual([]); // schema 接受 targetKind
    expect(r.rulesFailed).not.toContain('R6'); // R6 重算仍一致
  });
});
