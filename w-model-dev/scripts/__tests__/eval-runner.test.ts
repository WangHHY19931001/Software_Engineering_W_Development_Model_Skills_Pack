import { createRequire } from 'node:module';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateEvalDiff } from '../logic/code-health-ledger-logic.js';
import { runSync } from '../lib/run-sync.js';

const repoRoot = join(import.meta.dirname, '..', '..', '..');
const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');

describe('eval runner 引擎自检', () => {
  it('--self-check 退出码 0 且报告 selfCheck=true', () => {
    const r = runSync(process.execPath, [tsxCli, join(repoRoot, 'eval', 'runner.ts'), '--self-check'], {
      cwd: repoRoot,
      timeout: 15_000,
      windowsHide: true,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('"selfCheck":true');
  });

  it('--self-check 输出为合法 JSON（可被脚本消费）', () => {
    const r = runSync(process.execPath, [tsxCli, join(repoRoot, 'eval', 'runner.ts'), '--self-check'], {
      cwd: repoRoot,
      timeout: 15_000,
      windowsHide: true,
    });
    expect(r.status).toBe(0);
    expect(() => JSON.parse(r.stdout.trim().split('\n').pop()!)).not.toThrow();
  });
});

describe('eval corpus diff guard（R6 不虚增语料）', () => {
  const originalPrompts = [
    { id: 1, scenario: 'a', prompt: 'p1', expected: 'e1', route: 'enable' as const },
    { id: 2, scenario: 'b', prompt: 'p2', expected: 'e2', route: 'skip' as const },
  ];
  const originalMappings = {
    mappings: [
      { id: 1, scenario: 'a', layer: 'L1' as const, assertions: [], evidence: { type: 'assertion' as const } },
      { id: 2, scenario: 'b', layer: 'L1N' as const, assertions: [], evidence: { type: 'assertion' as const } },
    ],
    matrix: { routeTotals: { enable: 1, ask: 0, skip: 1 }, minPerCategory: 1, guidePath: 'guide.md' },
  };

  it('未变更语料与 mapping 时保持原 matrix（零违规）', () => {
    expect(validateEvalDiff({ changedBehavior: false, prompts: originalPrompts, mappings: originalMappings })).toEqual(
      [],
    );
  });

  it('未声明 behavior change 时新增 prompt / mapping 被拒（2 态对称缺口，reason 含 behavior change）', () => {
    // 态 1：新增 prompt
    const fakePrompt = { id: 99, scenario: 'fake', prompt: 'p99', expected: 'e99', route: 'enable' as const };
    const promptProblems = validateEvalDiff({
      changedBehavior: false,
      prompts: [...originalPrompts, fakePrompt],
      mappings: originalMappings,
    });
    expect(
      promptProblems.some((problem) => problem.includes('behavior change')),
      '新增 prompt 未声明 behavior change 应被拒',
    ).toBe(true);
    expect(
      promptProblems.some((problem) => problem.includes('id:99')),
      '新增 prompt 应点名 id:99',
    ).toBe(true);
    // 态 2：新增 mapping（对称缺口）
    const mappingProblems = validateEvalDiff({
      changedBehavior: false,
      prompts: originalPrompts,
      mappings: {
        ...originalMappings,
        mappings: [
          ...originalMappings.mappings,
          { id: 99, scenario: 'fake', layer: 'L1', assertions: [], evidence: { type: 'assertion' } },
        ],
      },
    });
    expect(
      mappingProblems.some((problem) => problem.includes('behavior change')),
      '新增 mapping 未声明 behavior change 应被拒（对称缺口）',
    ).toBe(true);
  });

  it('显式声明 behavior change 后允许新增语料', () => {
    const fakePrompt = { id: 99, scenario: 'fake', prompt: 'p99', expected: 'e99', route: 'enable' as const };
    expect(
      validateEvalDiff({
        changedBehavior: true,
        prompts: [...originalPrompts, fakePrompt],
        mappings: originalMappings,
      }),
    ).toEqual([]);
  });
});
