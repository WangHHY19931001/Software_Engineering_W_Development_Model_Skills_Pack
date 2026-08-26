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
const LOGIC_DIRECT_IO_MODULES = new Set([
  'child_process',
  'fs',
  'fs/promises',
  'node:child_process',
  'node:fs',
  'node:fs/promises',
]);

/**
 * Existing transitional exceptions must be named here rather than silently
 * weakening the scan. Each exception is documented at file level so a new
 * logic I/O dependency cannot be added by merely extending a Set.
 */
const ALLOWED_LOGIC_NODE_IO_IMPORTS = new Map([
  ['logic/gate-logic.ts:node:fs', 'gate-logic uses the injected filesystem adapter implementation.'],
  ['logic/state-write-logic.ts:node:fs/promises', 'state-write-logic is the state persistence implementation.'],
]);

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
    if (layerOf(edge.from) === 'logic' && LOGIC_DIRECT_IO_MODULES.has(edge.to)) {
      const key = `${relative(edge.from)}:${edge.to}`;
      if (!ALLOWED_LOGIC_NODE_IO_IMPORTS.has(key)) violations.push(`logic direct IO: ${key}`);
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
  it('recursively enforces one-way runtime imports and records only explicit logic IO exceptions', async () => {
    const fixturePath = path.join(scriptsDir, 'logic', `.d2-boundary-fixture-${process.pid}.ts`);
    await fs.writeFile(fixturePath, "import 'fs';\n");
    try {
      const edges = await runtimeImportGraph();
      const runtimeEdges = edges.filter((edge) => !edge.typeOnly);
      const violations = boundaryViolations(runtimeEdges);
      const cycles = cyclesIn(runtimeEdges);
      expect(violations).toContain(`logic direct IO: ${relative(fixturePath)}:fs`);
      expect(cycles).toEqual([]);
    } finally {
      await fs.rm(fixturePath, { force: true });
    }
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

  it('requires every logic direct-I/O exception to remain explicit and documented', async () => {
    expect([...ALLOWED_LOGIC_NODE_IO_IMPORTS.entries()]).toEqual([
      ['logic/gate-logic.ts:node:fs', 'gate-logic uses the injected filesystem adapter implementation.'],
      ['logic/state-write-logic.ts:node:fs/promises', 'state-write-logic is the state persistence implementation.'],
    ]);

    for (const [key, reason] of ALLOWED_LOGIC_NODE_IO_IMPORTS) {
      const separator = key.indexOf(':node:');
      const file = key.slice(0, separator);
      const moduleName = key.slice(separator + 1);
      expect(file.startsWith('logic/')).toBe(true);
      expect(LOGIC_DIRECT_IO_MODULES.has(moduleName)).toBe(true);
      expect(reason.trim()).not.toBe('');
      await expect(fs.access(path.join(scriptsDir, file))).resolves.toBeUndefined();
    }
  });

  it('detects unregistered child_process and other direct logic I/O imports', () => {
    const logicFile = path.join(scriptsDir, 'logic', 'new-logic.ts');
    expect(
      boundaryViolations([
        { from: logicFile, to: 'node:child_process', typeOnly: false },
        { from: logicFile, to: 'child_process', typeOnly: false },
        { from: logicFile, to: 'node:fs', typeOnly: false },
        { from: logicFile, to: 'node:fs', typeOnly: true },
      ]),
    ).toEqual([
      'logic direct IO: logic/new-logic.ts:node:child_process',
      'logic direct IO: logic/new-logic.ts:child_process',
      'logic direct IO: logic/new-logic.ts:node:fs',
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
