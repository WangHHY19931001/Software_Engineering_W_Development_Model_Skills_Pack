/* eslint-disable security/detect-non-literal-fs-filename -- This test recursively reads repository-owned source paths to verify the import graph. */

/**
 * Scripts dependency boundary tests.
 *
 * These assertions protect the runtime import graph, rather than a fixed set of
 * filenames: every relative import beneath cli/, application/, logic/, lib/,
 * and infrastructure/ is resolved recursively before the architecture rules apply.
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

type ScriptLayer = 'cli' | 'application' | 'logic' | 'lib' | 'infrastructure';

interface ImportEdge {
  from: string;
  to: string;
  typeOnly: boolean;
}

const scriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = path.resolve(scriptsDir, '../..', 'package.json');
const scriptLayers: readonly ScriptLayer[] = ['cli', 'application', 'logic', 'lib', 'infrastructure'];
const LOGIC_DIRECT_BOUNDARY_MODULES = new Set([
  'child_process',
  'fs',
  'fs/promises',
  'node:child_process',
  'node:fs',
  'node:fs/promises',
  'path',
  'node:path',
]);

/**
 * Existing transitional exceptions must be named here rather than silently
 * weakening the scan. Each exception is documented at file level so a new
 * logic boundary dependency cannot be added by merely extending a Set.
 */
const ALLOWED_LOGIC_NODE_BOUNDARY_IMPORTS = new Map([
  ['logic/gate-logic.ts:node:fs', 'gate-logic uses the injected filesystem adapter implementation.'],
  [
    'logic/l0-link-audit-logic.ts:node:fs',
    'l0-link-audit-logic reads the distributed skill package to enforce L0/L1 link boundaries.',
  ],
  ['logic/docs-consistency-logic.ts:node:path', 'docs-consistency-logic normalizes repository documentation paths.'],
  ['logic/evidence-export-logic.ts:node:path', 'evidence-export-logic normalizes and contains evidence paths.'],
  ['logic/evidence-provenance-logic.ts:node:path', 'evidence-provenance-logic normalizes source bundle paths.'],
  ['logic/gate-logic.ts:node:path', 'gate-logic normalizes project artifact paths.'],
  [
    'logic/l0-link-audit-logic.ts:node:path',
    'l0-link-audit-logic normalizes and contains distributed skill package paths.',
  ],
  ['logic/state-write-logic.ts:node:fs/promises', 'state-write-logic is the state persistence implementation.'],
  ['logic/state-write-logic.ts:node:path', 'state-write-logic normalizes state persistence paths.'],
  [
    'logic/coding-plan-logic.ts:node:path',
    'coding-plan-logic normalizes coding plan artifact and archive snapshot paths.',
  ],
]);

/**
 * CLI 分层例外登记（D6，43.3.0）。
 *
 * 下列 cli/ 承重文件仍内嵌校验 / 量测逻辑（未下沉 logic/）——这是历史沉淀的过渡形态。
 * D6 收口口径：check-artifact-gate.ts 的 gate-log 读取（maturity.json / signature-chain.jsonl）
 * 已下沉 `logic/artifact-gate-logic.ts`（经注入 fs 适配器，CLI 只传路径 + 适配器）；其余仍内嵌
 * 逻辑的 CLI 大文件在此**显式登记**（文件 + 内嵌逻辑摘要 + 理由 + 期限），由下方强制测试逐条
 * 断言（在盘 / 行数 / 非空字段 / 已下沉文件不得出现），防登记表与实现漂移。
 * 每条 `lines` 为登记时实测行数（wc -l 口径 = 换行符计数）——文件瘦身到可低成本下沉时应
 * **更新条目或下沉**，行数不匹配即测试失败，登记不会因「瘦身后无人更新」而静默失效。
 */
interface CliLayeringException {
  /** cli/ 相对文件名（相对 w-model-dev/scripts/） */
  file: string;
  /** 登记时实测行数（wc -l 口径） */
  lines: number;
  /** 仍内嵌于 CLI 的逻辑面摘要 */
  embedded: string;
  /** 暂不下沉的理由 */
  reason: string;
  /** 期限（归并批次 / 触发条件） */
  deadline: string;
}

const CLI_LAYERING_EXCEPTIONS: readonly CliLayeringException[] = [
  {
    file: 'cli/check-codegraph-queries.ts',
    lines: 694,
    embedded:
      'codegraph 索引探测（codegraphIndexPresent/codegraphIndexAnomaly）、evidence 声明违规（evidenceDeclarationViolations）、' +
      'legacy 兼容层 checkCodegraphQueries 与 strict 绑定 checkCodegraphQueriesStrict（scope 覆盖绑定 + 索引降级判据）。',
    reason:
      '校验判定与 check-artifact-gate 的 aggregateExternalChecks 深度耦合（同文件双形态导出），规则面为史层沉淀；' +
      'D6 已下沉 gate-log 读取，本文件登记过渡、不重复下沉。',
    deadline: '未指派归并批次；下次功能性改动本文件时优先下沉（否则保持登记）。',
  },
  {
    file: 'cli/check-samples-coverage.ts',
    lines: 1182,
    embedded:
      'self-test 用例条目词法抽取（collectCaseEntries/sliceArrayObjectLiterals/skipRegexLiteral 等）、' +
      '引用↔在盘双向闭环（findUncovered/findDanglingRefs/findUndeclaredDirs）、负向覆盖登记册五规则' +
      '（parseNegativeCoverage/listGateBaseNames）、exit-2 探针（runExit2Probes/runSingleProbe）。',
    reason:
      '内嵌大量词法 / 正则解析与文件树探针，判定逻辑与 CLI 输出 / 退出码强粘合，整体下沉成本显著高于收益；' +
      'D6 登记为过渡形态。',
    deadline: '未指派归并批次；下次功能性改动本文件时优先下沉（否则保持登记）。',
  },
  {
    file: 'cli/check-docs-consistency.ts',
    lines: 1027,
    embedded:
      'vitest 动态 facts 采集（collectVitestMeasurements/readVitestArtifact/readVitestCountFile，受控工件快路径 + --spawn-vitest）、' +
      'exit-2 探针结果采集（collectExit2ScriptResults）、security baseline 计数、git 变更探测（detectScriptsChanges）、' +
      'D8 计数声明扫描收集（collectCountClaimLiveDocs：git ls-files + isCountClaimScannedPath 过滤，逻辑判据在 logic 层）；' +
      '主校验判定已在 logic/docs-consistency-logic.ts（本文件为编排 + I/O + 量测）。',
    reason:
      '剩余内嵌为量测采集 / 探针 I/O / 编排；任务 13 A18（43.3.0）已删除 runSync shell 拼接回退（npx vitest），' +
      '改为 process.execPath + vitest JS 入口（findVitestBin，createRequire 上溯解析）参数数组透传；' +
      '任务 15 D8（43.3.0）新增 collectCountClaimLiveDocs（只读 git ls-files + 受控清单 readFileSync）；D6 不重复下沉。',
    deadline: '未指派归并批次；A18 去 shell / D8 扫描收集已收口，下次功能性改动本文件时仍可优先下沉（否则保持登记）。',
  },
];

async function findTypeScriptFiles(dir: string): Promise<string[]> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { encoding: 'utf8', withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) return findTypeScriptFiles(absolute);
      return entry.isFile() && entry.name.endsWith('.ts') ? [absolute] : [];
    }),
  );
  return nested.flat();
}

function importStatements(source: string): Array<{ specifier: string; typeOnly: boolean }> {
  const sourceFile = ts.createSourceFile(
    'dependency-fixture.ts',
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );
  const statements: Array<{ specifier: string; typeOnly: boolean }> = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    if (statement.moduleSpecifier === undefined || !ts.isStringLiteral(statement.moduleSpecifier)) continue;

    let typeOnly = false;
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      typeOnly =
        clause?.isTypeOnly === true ||
        (clause?.namedBindings !== undefined &&
          ts.isNamedImports(clause.namedBindings) &&
          clause.namedBindings.elements.every((element) => element.isTypeOnly));
    } else {
      const clause = statement.exportClause;
      typeOnly =
        statement.isTypeOnly ||
        (clause !== undefined && ts.isNamedExports(clause) && clause.elements.every((element) => element.isTypeOnly));
    }

    statements.push({ specifier: statement.moduleSpecifier.text, typeOnly });
  }

  // Static analysis intentionally follows only literal dynamic imports; non-literal
  // specifiers cannot be resolved without executing application code.
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1
    ) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) statements.push({ specifier: argument.text, typeOnly: false });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  return statements;
}

async function resolveRelativeModule(from: string, specifier: string): Promise<string | undefined> {
  const candidate = path.resolve(path.dirname(from), specifier.replace(/\.js$/, '.ts'));
  const extensionlessCandidate = candidate.endsWith('.ts') ? candidate.slice(0, -3) : candidate;
  const candidates = [
    candidate,
    `${candidate}.ts`,
    path.join(candidate, 'index.ts'),
    path.join(extensionlessCandidate, 'index.ts'),
  ];
  for (const modulePath of new Set(candidates)) {
    try {
      await fs.access(modulePath);
      return modulePath;
    } catch {
      // Continue to the next TypeScript resolution candidate.
    }
  }
  return undefined;
}

async function scriptFiles(): Promise<string[]> {
  return (await Promise.all(scriptLayers.map((layer) => findTypeScriptFiles(path.join(scriptsDir, layer))))).flat();
}

async function runtimeImportGraph(): Promise<ImportEdge[]> {
  const edges: ImportEdge[] = [];
  for (const from of await scriptFiles()) {
    const source = await fs.readFile(from, 'utf-8');
    for (const statement of importStatements(source)) {
      const to = statement.specifier.startsWith('.')
        ? await resolveRelativeModule(from, statement.specifier)
        : statement.specifier;
      if (to) edges.push({ from, to, typeOnly: statement.typeOnly });
    }
  }
  return edges;
}

async function unresolvedRelativeImports(): Promise<string[]> {
  const unresolved: string[] = [];
  for (const from of await scriptFiles()) {
    const source = await fs.readFile(from, 'utf-8');
    for (const statement of importStatements(source)) {
      if (statement.specifier.startsWith('.') && !(await resolveRelativeModule(from, statement.specifier))) {
        unresolved.push(`${relative(from)} → ${statement.specifier}`);
      }
    }
  }
  return unresolved;
}

function boundaryViolations(edges: ImportEdge[]): string[] {
  const violations: string[] = [];
  for (const edge of edges.filter((candidate) => !candidate.typeOnly)) {
    if (path.isAbsolute(edge.to)) {
      const fromLayer = layerOf(edge.from);
      const toLayer = layerOf(edge.to);
      if (fromLayer === 'lib' && toLayer === 'logic') {
        violations.push(`lib → logic: ${relative(edge.from)} → ${relative(edge.to)}`);
      }
      if (fromLayer === 'infrastructure' && toLayer === 'cli') {
        violations.push(`infrastructure → cli: ${relative(edge.from)} → ${relative(edge.to)}`);
      }
    }
    if (layerOf(edge.from) === 'logic' && LOGIC_DIRECT_BOUNDARY_MODULES.has(edge.to)) {
      const key = `${relative(edge.from)}:${edge.to}`;
      if (!ALLOWED_LOGIC_NODE_BOUNDARY_IMPORTS.has(key)) violations.push(`logic direct boundary: ${key}`);
    }
  }
  return violations;
}

function relative(file: string): string {
  return path.relative(scriptsDir, file).replaceAll(path.sep, '/');
}

function layerOf(file: string): ScriptLayer | undefined {
  const firstSegment = relative(file).split('/')[0];
  return scriptLayers.find((layer) => layer === firstSegment);
}

function cyclesIn(edges: ImportEdge[]): string[][] {
  const graph = new Map<string, string[]>();
  for (const edge of edges.filter((candidate) => !candidate.typeOnly && path.isAbsolute(candidate.to))) {
    const successors = graph.get(edge.from) ?? [];
    successors.push(edge.to);
    graph.set(edge.from, successors);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles: string[][] = [];
  const visit = (node: string, trail: string[]): void => {
    if (visiting.has(node)) {
      const start = trail.indexOf(node);
      cycles.push([...trail.slice(start), node].map(relative));
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of graph.get(node) ?? []) visit(next, [...trail, node]);
    visiting.delete(node);
    visited.add(node);
  };
  for (const node of graph.keys()) visit(node, []);
  return cycles;
}

describe('scripts runtime dependency boundaries', () => {
  it('recursively discovers a bare fs runtime import in a logic fixture', async () => {
    const fixturePath = path.join(scriptsDir, 'logic', `.d2-boundary-fixture-${process.pid}.ts`);
    await fs.writeFile(fixturePath, "import 'fs';\n");
    try {
      const edges = await runtimeImportGraph();
      const runtimeEdges = edges.filter((edge) => !edge.typeOnly);
      const violations = boundaryViolations(runtimeEdges);
      const cycles = cyclesIn(runtimeEdges);
      expect(violations).toContain(`logic direct boundary: ${relative(fixturePath)}:fs`);
      expect(cycles).toEqual([]);
    } finally {
      await fs.rm(fixturePath, { force: true });
    }
  });

  it('keeps the fixture-free production runtime graph clean', async () => {
    const runtimeEdges = (await runtimeImportGraph()).filter((edge) => !edge.typeOnly);

    expect(boundaryViolations(runtimeEdges)).toEqual([]);
    expect(cyclesIn(runtimeEdges)).toEqual([]);
  });

  it('classifies import, export, and literal dynamic import specifiers by runtime presence', () => {
    expect(
      importStatements(`
        import type { ModuleType } from '../logic/type-only.js';
        import { type NamedType } from '../logic/named-type-only.js';
        import { value, type MixedType } from '../logic/mixed.js';
        export { type ExportedType } from '../logic/re-export-type-only.js';
        export { value as exportedValue, type ExportedMixedType } from '../logic/re-export-mixed.js';
        const literal = import('../logic/dynamic.js');
        const nonLiteral = import(dynamicSpecifier);
      `),
    ).toEqual([
      { specifier: '../logic/type-only.js', typeOnly: true },
      { specifier: '../logic/named-type-only.js', typeOnly: true },
      { specifier: '../logic/mixed.js', typeOnly: false },
      { specifier: '../logic/re-export-type-only.js', typeOnly: true },
      { specifier: '../logic/re-export-mixed.js', typeOnly: false },
      { specifier: '../logic/dynamic.js', typeOnly: false },
    ]);
  });

  it('keeps application internals out of the public TypeDoc entry points', async () => {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const docsBuild = packageJson.scripts?.['docs:build'] ?? '';

    expect(docsBuild).toContain('w-model-dev/scripts/cli');
    expect(docsBuild).toContain('w-model-dev/scripts/logic');
    expect(docsBuild).toContain('w-model-dev/scripts/infrastructure');
    expect(docsBuild).not.toMatch(/\s+w-model-dev\/scripts\/application(?:\s|$)/);
    expect(docsBuild).toContain('--exclude "w-model-dev/scripts/application/**"');
  });

  it('requires every logic boundary exception to remain explicit and documented', async () => {
    expect([...ALLOWED_LOGIC_NODE_BOUNDARY_IMPORTS.entries()]).toEqual([
      ['logic/gate-logic.ts:node:fs', 'gate-logic uses the injected filesystem adapter implementation.'],
      [
        'logic/l0-link-audit-logic.ts:node:fs',
        'l0-link-audit-logic reads the distributed skill package to enforce L0/L1 link boundaries.',
      ],
      [
        'logic/docs-consistency-logic.ts:node:path',
        'docs-consistency-logic normalizes repository documentation paths.',
      ],
      ['logic/evidence-export-logic.ts:node:path', 'evidence-export-logic normalizes and contains evidence paths.'],
      ['logic/evidence-provenance-logic.ts:node:path', 'evidence-provenance-logic normalizes source bundle paths.'],
      ['logic/gate-logic.ts:node:path', 'gate-logic normalizes project artifact paths.'],
      [
        'logic/l0-link-audit-logic.ts:node:path',
        'l0-link-audit-logic normalizes and contains distributed skill package paths.',
      ],
      ['logic/state-write-logic.ts:node:fs/promises', 'state-write-logic is the state persistence implementation.'],
      ['logic/state-write-logic.ts:node:path', 'state-write-logic normalizes state persistence paths.'],
      [
        'logic/coding-plan-logic.ts:node:path',
        'coding-plan-logic normalizes coding plan artifact and archive snapshot paths.',
      ],
    ]);

    for (const [key, reason] of ALLOWED_LOGIC_NODE_BOUNDARY_IMPORTS) {
      const separator = key.indexOf(':node:');
      const file = key.slice(0, separator);
      const moduleName = key.slice(separator + 1);
      expect(file.startsWith('logic/')).toBe(true);
      expect(LOGIC_DIRECT_BOUNDARY_MODULES.has(moduleName)).toBe(true);
      expect(reason.trim()).not.toBe('');
      await expect(fs.access(path.join(scriptsDir, file))).resolves.toBeUndefined();
    }
  });

  it('keeps CLI layering exceptions registered, on-disk, and non-stale', async () => {
    // 登记表非空且不空转：已下沉 gate-log 读取的 check-artifact-gate 不得出现在例外表
    // （防登记与下沉反向漂移——下沉完成即应移除条目，而非留在表中）
    expect(CLI_LAYERING_EXCEPTIONS.length).toBeGreaterThan(0);
    expect(CLI_LAYERING_EXCEPTIONS.some((ex) => ex.file === 'cli/check-artifact-gate.ts')).toBe(false);
    const seen = new Set<string>();
    for (const ex of CLI_LAYERING_EXCEPTIONS) {
      expect(ex.file.startsWith('cli/')).toBe(true);
      expect(seen.has(ex.file)).toBe(false);
      seen.add(ex.file);
      expect(ex.embedded.trim()).not.toBe('');
      expect(ex.reason.trim()).not.toBe('');
      expect(ex.deadline.trim()).not.toBe('');
      // 在盘存在（登记引用了不存在的文件即红）
      await expect(fs.access(path.join(scriptsDir, ex.file))).resolves.toBeUndefined();
      // 行数与登记一致（wc -l 口径 = 换行符计数）：文件瘦身后登记失效即红，
      // 强制「更新条目或下沉」，登记不会因瘦身后无人更新而静默失效
      const content = await fs.readFile(path.join(scriptsDir, ex.file), 'utf-8');
      expect((content.match(/\n/g) ?? []).length).toBe(ex.lines);
    }
  });

  it('detects unregistered child_process, path, and other direct logic boundary imports', () => {
    const logicFile = path.join(scriptsDir, 'logic', 'new-logic.ts');
    expect(
      boundaryViolations([
        { from: logicFile, to: 'node:child_process', typeOnly: false },
        { from: logicFile, to: 'child_process', typeOnly: false },
        { from: logicFile, to: 'node:fs', typeOnly: false },
        { from: logicFile, to: 'path', typeOnly: false },
        { from: logicFile, to: 'node:path', typeOnly: false },
        { from: logicFile, to: 'node:fs', typeOnly: true },
      ]),
    ).toEqual([
      'logic direct boundary: logic/new-logic.ts:node:child_process',
      'logic direct boundary: logic/new-logic.ts:child_process',
      'logic direct boundary: logic/new-logic.ts:node:fs',
      'logic direct boundary: logic/new-logic.ts:path',
      'logic direct boundary: logic/new-logic.ts:node:path',
    ]);
  });

  it('rejects layer violations while ignoring type-only edges', () => {
    const libFile = path.join(scriptsDir, 'lib', 'fixture.ts');
    const infrastructureFile = path.join(scriptsDir, 'infrastructure', 'fixture.ts');
    const logicFile = path.join(scriptsDir, 'logic', 'fixture.ts');
    const cliFile = path.join(scriptsDir, 'cli', 'fixture.ts');

    expect(
      boundaryViolations([
        { from: libFile, to: logicFile, typeOnly: false },
        { from: infrastructureFile, to: cliFile, typeOnly: false },
        { from: libFile, to: logicFile, typeOnly: true },
        { from: infrastructureFile, to: cliFile, typeOnly: true },
      ]),
    ).toEqual([
      'lib → logic: lib/fixture.ts → logic/fixture.ts',
      'infrastructure → cli: infrastructure/fixture.ts → cli/fixture.ts',
    ]);
  });

  it('does not treat type-only edges as runtime cycles', () => {
    const first = path.join(scriptsDir, 'logic', 'first.ts');
    const second = path.join(scriptsDir, 'logic', 'second.ts');

    expect(
      cyclesIn([
        { from: first, to: second, typeOnly: true },
        { from: second, to: first, typeOnly: false },
      ]),
    ).toEqual([]);
    expect(
      cyclesIn([
        { from: first, to: second, typeOnly: false },
        { from: second, to: first, typeOnly: false },
      ]),
    ).toEqual([['logic/first.ts', 'logic/second.ts', 'logic/first.ts']]);
  });

  it('resolves relative .js imports to TypeScript files and index modules', async () => {
    const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'w-model-boundary-'));
    const source = path.join(fixtureRoot, 'source.ts');
    const sibling = path.join(fixtureRoot, 'sibling.ts');
    const nestedDir = path.join(fixtureRoot, 'nested');
    const index = path.join(nestedDir, 'index.ts');
    try {
      await fs.mkdir(nestedDir);
      await fs.writeFile(sibling, 'export const sibling = true;');
      await fs.writeFile(index, 'export const index = true;');

      await expect(resolveRelativeModule(source, './sibling.js')).resolves.toBe(sibling);
      await expect(resolveRelativeModule(source, './nested.js')).resolves.toBe(index);
      await expect(resolveRelativeModule(source, './missing.js')).resolves.toBeUndefined();
    } finally {
      await fs.rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('resolves all production relative imports without scanning samples or tests', async () => {
    const files = await scriptFiles();
    expect(files.some((file) => file.includes(`${path.sep}samples${path.sep}`))).toBe(false);
    expect(files.some((file) => file.includes(`${path.sep}__tests__${path.sep}`))).toBe(false);
    expect(await unresolvedRelativeImports()).toEqual([]);
  });
});
