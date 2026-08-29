#!/usr/bin/env node
/**
 * 仓内评估断言 runner：验证「25 条评估提示词要求的技能行为支撑资产」是否完备。
 *
 * 三层断言（设计见 docs/superpowers/specs/2026-08-28-w-model-dev-3dim-optimization-design.md §2.2）：
 *   L1 触发词断言 —— 触发/歧义/反误触发契约在 SKILL.md 中可命中；
 *   L2 机制存在性断言 —— expected 引用的机制在「脚本 + 逻辑常量 + references 锚点」有实体；
 *   L3 行为证据映射 —— 每条 expected 映射到已存在的 self-test fixture / 测试文件 / eval 断言。
 *
 * 用法：
 *   npm run eval                          # 全量断言，写 eval/results.json，失败 exit 1
 *   npx tsx eval/runner.ts --self-check   # 引擎自检（已知真/假断言验证判定逻辑）
 *
 * 本脚本属于仓库评估资产（eval/），不属于技能包交付层，不调用 LLM。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

interface ContainsAssertion {
  type: 'contains';
  target: string;
  substring: string;
}
interface FileExistsAssertion {
  type: 'fileExists';
  target: string;
}
type Assertion = ContainsAssertion | FileExistsAssertion;

type Evidence =
  | { type: 'assertion' }
  | { type: 'fileExists'; target: string }
  | { type: 'selfTestSource'; substring: string };

interface Mapping {
  id: number;
  scenario: string;
  layer: 'L1' | 'L2';
  assertions: Assertion[];
  evidence: Evidence;
}

interface AssertionResult {
  id: number;
  layer: string;
  scenario: string;
  passed: boolean;
  failures: string[];
}

export interface FileSystemAdapter {
  read(p: string): string;
  exists(p: string): boolean;
}

function createRealFs(): FileSystemAdapter {
  return {
    read(p: string): string {
      return fs.readFileSync(path.join(repoRoot, p), 'utf-8');
    },
    exists(p: string): boolean {
      return fs.existsSync(path.join(repoRoot, p));
    },
  };
}

export function evaluateAssertion(a: Assertion, io: FileSystemAdapter): string | null {
  if (a.type === 'fileExists') {
    return io.exists(a.target) ? null : `文件不存在：${a.target}`;
  }
  try {
    return io.read(a.target).includes(a.substring) ? null : `${a.target} 未包含「${a.substring}」`;
  } catch {
    return `无法读取：${a.target}`;
  }
}

export function evaluateEvidence(e: Evidence, io: FileSystemAdapter): string | null {
  if (e.type === 'assertion') return null; // L3 由本映射自身的 L1/L2 断言覆盖
  if (e.type === 'fileExists') {
    return io.exists(e.target) ? null : `证据文件不存在：${e.target}`;
  }
  try {
    return io.read('w-model-dev/scripts/cli/self-test.ts').includes(e.substring)
      ? null
      : `self-test.ts 未包含 fixture「${e.substring}」`;
  } catch {
    return '无法读取 self-test.ts';
  }
}

export function evaluateMapping(m: Mapping, io: FileSystemAdapter): AssertionResult {
  const failures = [
    ...m.assertions.map((a) => evaluateAssertion(a, io)),
    evaluateEvidence(m.evidence, io),
  ].filter((x): x is string => x !== null);
  return { id: m.id, layer: m.layer, scenario: m.scenario, passed: failures.length === 0, failures };
}

export function crossCheckIds(mappings: Mapping[], promptIds: number[]): string[] {
  const problems: string[] = [];
  const mappingIds = new Set(mappings.map((m) => m.id));
  for (const id of promptIds) {
    if (!mappingIds.has(id)) problems.push(`提示词 id=${id} 缺少映射`);
  }
  for (const m of mappings) {
    if (!promptIds.includes(m.id)) problems.push(`映射 id=${m.id} 无对应提示词`);
  }
  return problems;
}

function selfCheck(io: FileSystemAdapter): boolean {
  const passCases: Assertion[] = [
    { type: 'fileExists', target: 'package.json' },
    { type: 'contains', target: 'package.json', substring: '"name"' },
  ];
  const failCases: Assertion[] = [
    { type: 'fileExists', target: '__no_such_file__.nomatch' },
    { type: 'contains', target: 'package.json', substring: '__no_such_substring__' },
  ];
  const ok =
    passCases.every((c) => evaluateAssertion(c, io) === null) &&
    failCases.every((c) => evaluateAssertion(c, io) !== null);
  console.log(JSON.stringify({ selfCheck: ok }));
  return ok;
}

function main(): void {
  const io = createRealFs();
  if (process.argv.includes('--self-check')) {
    process.exitCode = selfCheck(io) ? 0 : 1;
    return;
  }
  const mappings = JSON.parse(io.read('eval/mappings.json')) as { mappings: Mapping[] };
  const prompts = JSON.parse(io.read('eval/w-model-dev-test-prompts.json')) as Array<{ id: number }>;
  const problems = crossCheckIds(mappings.mappings, prompts.map((p) => p.id));
  const results = mappings.mappings.map((m) => evaluateMapping(m, io));
  const passed = results.filter((r) => r.passed).length;
  const report = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed,
    failed: results.length - passed,
    coverageProblems: problems,
    results,
  };
  fs.writeFileSync(path.join(repoRoot, 'eval', 'results.json'), JSON.stringify(report, null, 2), 'utf-8');
  console.log(`eval: ${passed}/${results.length} 通过`);
  for (const r of results.filter((x) => !x.passed)) {
    console.log(`  ✗ id=${r.id} [${r.layer}] ${r.scenario}`);
    for (const f of r.failures) console.log(`      - ${f}`);
  }
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exitCode = passed === results.length && problems.length === 0 ? 0 : 1;
}

main();
