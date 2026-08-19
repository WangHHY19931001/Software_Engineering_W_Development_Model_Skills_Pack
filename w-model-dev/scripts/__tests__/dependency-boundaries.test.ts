/* eslint-disable security/detect-non-literal-fs-filename -- This test recursively reads repository-owned source paths to verify the import graph. */

/**
 * Scripts dependency boundary tests.
 *
 * These assertions protect the runtime import graph, rather than a fixed set of
 * filenames: every relative import beneath cli/, application/, logic/, lib/,
 * and infrastructure/ is resolved recursively before the architecture rules apply.
 */

import * as fs from 'node:fs/promises';
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
const scriptLayers: readonly ScriptLayer[] = ['cli', 'application', 'logic', 'lib', 'infrastructure'];

/**
 * Existing transitional exceptions must be named here rather than silently
 * weakening the scan. gate-logic receives its filesystem adapter as an
 * argument; state-write-logic is the state persistence implementation.
 */
const ALLOWED_LOGIC_NODE_IO_IMPORTS = new Set([
  'logic/gate-logic.ts:node:fs',
  'logic/state-write-logic.ts:node:fs/promises',
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
  return statements;
}

async function resolveRelativeModule(from: string, specifier: string): Promise<string | undefined> {
  const candidate = path.resolve(path.dirname(from), specifier.replace(/\.js$/, '.ts'));
  for (const modulePath of [candidate, `${candidate}.ts`, path.join(candidate, 'index.ts')]) {
    try {
      await fs.access(modulePath);
      return modulePath;
    } catch {
      // Continue to the next TypeScript resolution candidate.
    }
  }
  return undefined;
}

async function runtimeImportGraph(): Promise<ImportEdge[]> {
  const files = (
    await Promise.all(scriptLayers.map((layer) => findTypeScriptFiles(path.join(scriptsDir, layer))))
  ).flat();
  const edges: ImportEdge[] = [];
  for (const from of files) {
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
    const edges = await runtimeImportGraph();
    const runtimeEdges = edges.filter((edge) => !edge.typeOnly);
    const violations: string[] = [];

    for (const edge of runtimeEdges) {
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
      if (
        layerOf(edge.from) === 'logic' &&
        (edge.to === 'node:fs' || edge.to === 'node:fs/promises' || edge.to === 'node:child_process')
      ) {
        const key = `${relative(edge.from)}:${edge.to}`;
        if (!ALLOWED_LOGIC_NODE_IO_IMPORTS.has(key)) violations.push(`logic direct IO: ${key}`);
      }
    }

    const cycles = cyclesIn(runtimeEdges);
    expect(violations).toEqual([]);
    expect(cycles).toEqual([]);
  });

  it('classifies import and export specifiers by their runtime presence', () => {
    expect(
      importStatements(`
        import type { ModuleType } from '../logic/type-only.js';
        import { type NamedType } from '../logic/named-type-only.js';
        import { value, type MixedType } from '../logic/mixed.js';
        export { type ExportedType } from '../logic/re-export-type-only.js';
        export { value as exportedValue, type ExportedMixedType } from '../logic/re-export-mixed.js';
      `),
    ).toEqual([
      { specifier: '../logic/type-only.js', typeOnly: true },
      { specifier: '../logic/named-type-only.js', typeOnly: true },
      { specifier: '../logic/mixed.js', typeOnly: false },
      { specifier: '../logic/re-export-type-only.js', typeOnly: true },
      { specifier: '../logic/re-export-mixed.js', typeOnly: false },
    ]);
  });
});
