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

interface ScopeFields {
  /** 行域限定：只在本文件内包含该锚文本的行上判定；锚行不存在视为失败 */
  scopeAnchor?: string;
}
interface ContainsAssertion extends ScopeFields {
  type: 'contains';
  target: string;
  substring: string;
}
interface NotContainsAssertion extends ScopeFields {
  type: 'notContains';
  target: string;
  substring: string;
}
interface FileExistsAssertion {
  type: 'fileExists';
  target: string;
}
type Assertion = ContainsAssertion | NotContainsAssertion | FileExistsAssertion;

type Evidence =
  | { type: 'assertion' }
  | { type: 'fileExists'; target: string }
  | { type: 'selfTestSource'; substring: string };

interface Mapping {
  id: number;
  scenario: string;
  layer: 'L1' | 'L2';
  category?: string;
  route?: 'enable' | 'ask' | 'skip';
  assertions: Assertion[];
  evidence: Evidence;
}

export interface CorpusEntry {
  id: number;
  scenario: string;
  prompt: string;
  expected: string;
  category?: string;
  route?: 'enable' | 'ask' | 'skip';
}

export interface MatrixDeclaration {
  routeTotals: { enable: number; ask: number; skip: number };
  minPerCategory: number;
  guidePath: string;
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

function anchoredLines(io: FileSystemAdapter, target: string, anchor: string): string[] {
  const lines = io
    .read(target)
    .split(/\r?\n/)
    .filter((l) => l.includes(anchor));
  if (lines.length === 0) throw new Error(`锚定行不存在（target=${target}, anchor=${anchor}）`);
  return lines;
}

export function evaluateAssertion(a: Assertion, io: FileSystemAdapter): string | null {
  if (a.type === 'fileExists') {
    return io.exists(a.target) ? null : `文件不存在：${a.target}`;
  }
  try {
    if (a.scopeAnchor !== undefined) {
      const lines = anchoredLines(io, a.target, a.scopeAnchor);
      const hit = lines.some((l) => l.includes(a.substring));
      if (a.type === 'notContains') {
        return hit ? `${a.target} 锚定「${a.scopeAnchor}」的行包含不该出现的「${a.substring}」` : null;
      }
      return hit ? null : `${a.target} 锚定「${a.scopeAnchor}」的行未包含「${a.substring}」`;
    }
    const includes = io.read(a.target).includes(a.substring);
    if (a.type === 'notContains') {
      return includes ? `${a.target} 不应包含「${a.substring}」却包含` : null;
    }
    return includes ? null : `${a.target} 未包含「${a.substring}」`;
  } catch (e) {
    return `无法判定：${(e as Error).message}`;
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

/** 覆盖矩阵五项校验：①语料↔映射 route/category 对齐 ②route 总数符合声明 ③每类别 ≥ minPerCategory ④guide 节示例数==语料条数（双向）⑤每负向类别 ≥1 组「立即启用」行 notContains 守卫 */
export function coverageMatrix(
  corpus: CorpusEntry[],
  mappings: Mapping[],
  decl: MatrixDeclaration,
  io: FileSystemAdapter,
): string[] {
  const problems: string[] = [];
  const routed = corpus.filter((c) => c.route !== undefined);
  const byId = new Map(mappings.map((m) => [m.id, m]));
  for (const c of routed) {
    const m = byId.get(c.id);
    if (!m) continue; // 1:1 缺失由 crossCheckIds 报告
    if (m.route !== c.route) problems.push(`id=${c.id} route 不一致：语料=${c.route} 映射=${m.route ?? '无'}`);
    if (m.category !== c.category) problems.push(`id=${c.id} category 不一致：语料=${c.category} 映射=${m.category ?? '无'}`);
  }
  for (const [route, expected] of Object.entries(decl.routeTotals) as Array<[keyof MatrixDeclaration['routeTotals'], number]>) {
    const actual = routed.filter((c) => c.route === route).length;
    if (actual !== expected) problems.push(`route=${route} 总数 ${actual} ≠ 声明 ${expected}`);
  }
  const catCounts = new Map<string, number>();
  for (const c of routed) if (c.category) catCounts.set(c.category, (catCounts.get(c.category) ?? 0) + 1);
  const isRegistryCat = (cat: string) => /^(N|A)\d+$/.test(cat);
  for (const [cat, n] of catCounts) {
    if (isRegistryCat(cat) && n < decl.minPerCategory) {
      problems.push(`类别 ${cat} 条数 ${n} < 下限 ${decl.minPerCategory}`);
    }
  }
  let guide: string;
  try {
    guide = io.read(decl.guidePath);
  } catch {
    return [...problems, `无法读取：${decl.guidePath}`];
  }
  const sections = new Map<string, number>();
  let current: string | null = null;
  for (const line of guide.split(/\r?\n/)) {
    const h = line.match(/^## ((?:N|A)\d+) /);
    if (h) {
      current = h[1];
      sections.set(current, 0);
      continue;
    }
    if (current && /^\s*- id=\d+:/.test(line)) sections.set(current, (sections.get(current) ?? 0) + 1);
  }
  for (const [cat, n] of catCounts) {
    if (!isRegistryCat(cat)) continue;
    if (!sections.has(cat)) problems.push(`guide 缺少类别节：${cat}`);
    else if (sections.get(cat) !== n) problems.push(`类别 ${cat}：guide 示例 ${sections.get(cat)} 条 ≠ 语料 ${n} 条`);
  }
  for (const [cat] of sections) {
    if (!catCounts.has(cat)) problems.push(`guide 类别节 ${cat} 无对应语料`);
  }
  for (const [cat] of catCounts) {
    if (!/^N\d+$/.test(cat)) continue;
    const guarded = mappings.some(
      (m) =>
        m.category === cat &&
        m.assertions.some((a) => a.type === 'notContains' && a.scopeAnchor === '立即启用'),
    );
    if (!guarded) problems.push(`负向类别 ${cat} 缺少「立即启用」行 notContains 守卫`);
  }
  return problems;
}

function selfCheck(io: FileSystemAdapter): boolean {
  const passCases: Assertion[] = [
    { type: 'fileExists', target: 'package.json' },
    { type: 'contains', target: 'package.json', substring: '"name"' },
    { type: 'notContains', target: 'package.json', substring: '__no_such_substring__' },
    { type: 'notContains', target: 'package.json', substring: 'name', scopeAnchor: '"version"' },
    { type: 'contains', target: 'package.json', substring: '"name"', scopeAnchor: '"name"' },
  ];
  const failCases: Assertion[] = [
    { type: 'fileExists', target: '__no_such_file__.nomatch' },
    { type: 'contains', target: 'package.json', substring: '__no_such_substring__' },
    { type: 'notContains', target: 'package.json', substring: '"name"' },
    { type: 'notContains', target: 'package.json', substring: '"name"', scopeAnchor: '"name"' },
    { type: 'contains', target: 'package.json', substring: '"name"', scopeAnchor: '__no_such_anchor__' },
    { type: 'notContains', target: '__no_such_file__.nomatch', substring: 'x' },
  ];
  const ok =
    passCases.every((c) => evaluateAssertion(c, io) === null) &&
    failCases.every((c) => evaluateAssertion(c, io) !== null);
  console.log(JSON.stringify({ selfCheck: ok }));
  return ok;
}

function selfCheckMatrix(): boolean {
  const guide = ['## N1 测试类别', '- id=1: 示例一', '- id=2: 示例二'].join('\n');
  const io: FileSystemAdapter = {
    read: (p: string) => {
      if (p === 'guide.md') return guide;
      throw new Error(`意外读取：${p}`);
    },
    exists: (p: string) => p === 'guide.md',
  };
  const corpus: CorpusEntry[] = [
    { id: 1, scenario: '', prompt: '', expected: '', category: 'N1', route: 'skip' },
    { id: 2, scenario: '', prompt: '', expected: '', category: 'N1', route: 'skip' },
  ];
  const mappings: Mapping[] = [
    { id: 1, category: 'N1', route: 'skip', layer: 'L1N', scenario: '',
      assertions: [{ type: 'notContains', target: 's.md', substring: '测试类别', scopeAnchor: '立即启用' }],
      evidence: { type: 'assertion' } },
    { id: 2, category: 'N1', route: 'skip', layer: 'L1N', scenario: '', assertions: [], evidence: { type: 'assertion' } },
  ];
  const decl: MatrixDeclaration = { routeTotals: { enable: 0, ask: 0, skip: 2 }, minPerCategory: 2, guidePath: 'guide.md' };
  const okCase = coverageMatrix(corpus, mappings, decl, io);
  const badDecl: MatrixDeclaration = { ...decl, routeTotals: { enable: 0, ask: 0, skip: 3 } };
  const badCase = coverageMatrix(corpus, mappings, badDecl, io);
  const ok = okCase.length === 0 && badCase.length > 0;
  console.log(JSON.stringify({ selfCheckMatrix: ok }));
  return ok;
}

function main(): void {
  const io = createRealFs();
  if (process.argv.includes('--self-check')) {
    const ok = selfCheck(io) && selfCheckMatrix();
    process.exitCode = ok ? 0 : 1;
    return;
  }
  const mappingsDoc = JSON.parse(io.read('eval/mappings.json')) as {
    mappings: Mapping[];
    matrix: MatrixDeclaration;
  };
  const corpus = JSON.parse(io.read('eval/w-model-dev-test-prompts.json')) as CorpusEntry[];
  const problems = crossCheckIds(mappingsDoc.mappings, corpus.map((p) => p.id));
  const matrixProblems = coverageMatrix(corpus, mappingsDoc.mappings, mappingsDoc.matrix, io);
  const results = mappingsDoc.mappings.map((m) => evaluateMapping(m, io));
  const passed = results.filter((r) => r.passed).length;
  const report = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed,
    failed: results.length - passed,
    coverageProblems: problems,
    matrixProblems,
    results,
  };
  fs.writeFileSync(path.join(repoRoot, 'eval', 'results.json'), JSON.stringify(report, null, 2), 'utf-8');
  console.log(`eval: ${passed}/${results.length} 通过`);
  for (const r of results.filter((x) => !x.passed)) {
    console.log(`  ✗ id=${r.id} [${r.layer}] ${r.scenario}`);
    for (const f of r.failures) console.log(`      - ${f}`);
  }
  for (const p of [...problems, ...matrixProblems]) console.log(`  ✗ ${p}`);
  process.exitCode = passed === results.length && problems.length === 0 && matrixProblems.length === 0 ? 0 : 1;
}

main();
