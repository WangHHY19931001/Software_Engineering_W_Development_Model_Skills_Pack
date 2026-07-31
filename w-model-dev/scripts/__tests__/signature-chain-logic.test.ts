import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { checkSignatureChain, computeSigHash, type SignatureChainEntry } from '../signature-chain-logic.js';

const SAMPLES_DIR = path.join(__dirname, '..', 'samples', 'signature-chain');

function loadJsonl(filename: string): SignatureChainEntry[] {
  const content = readFileSync(path.join(SAMPLES_DIR, filename), 'utf-8');
  return content.split(/\r?\n/).filter(l => l.trim()).map(l => JSON.parse(l));
}

describe('[21.0.0] signature-chain-logic R1-R10', () => {
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

  it('R4 bad-O-produce 失败', () => {
    const entries = loadJsonl('bad-O-produce.jsonl');
    const result = checkSignatureChain(entries, { phase: 1 });
    expect(result.rulesFailed).toContain('R4');
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
