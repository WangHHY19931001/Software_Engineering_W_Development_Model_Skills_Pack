/**
 * Phase 1 read-only discovery logic (pure).
 *
 * This module never touches the filesystem or a child process: callers inject source text and real
 * command evidence. Static "no reference", low coverage, and a single unexercised environment are
 * *leads only* — they can never be promoted to a deadness conclusion. Dynamic import, reflection/DI,
 * shell/platform branching, schema/template/RTM/generated inputs, and test-only helpers all produce
 * false-positive guards that keep a lead at `unknown` or `blocked`.
 *
 * `runPhase1` (the IO orchestrator) lives in `cli/code-health-phase1.ts`; the static, dynamic, and
 * guard functions here stay pure so the dependency-boundary gate can keep `logic/` free of
 * `node:fs` / `node:child_process` / `node:path` / `process`.
 */

/* eslint-disable security/detect-object-injection -- Source text and exported-symbol tables are keyed by repository-relative paths from the caller-controlled file list. */

import { createHash } from 'node:crypto';

import * as ts from 'typescript';

import {
  isRelativePath,
  type CommandEvidence,
  type DynamicTraceScenario,
  type EnvironmentObservation,
  type EvidenceObservationStatus,
  type FalsePositiveContext,
  type Phase1CandidateLead,
  type RevisionIdentity,
  type StaticInventoryReport,
  type StaticReference,
} from './code-health-contract.js';

/** A candidate file plus its exact source text; a missing entry is an `unavailable` source. */
export interface StaticInventoryInput {
  files: string[];
  sourceText: Record<string, string>;
  revision: RevisionIdentity;
}

/** One normalized dynamic trace scenario. A scenario without real command evidence is unexercised. */
export interface DynamicTraceInputScenario {
  id: string;
  environment: string;
  reached: boolean | null;
  observation: EvidenceObservationStatus;
  command?: CommandEvidence;
  required?: boolean;
  platform?: string;
}

export interface DynamicTraceInput {
  revision: RevisionIdentity;
  scenarios: DynamicTraceInputScenario[];
  rawTraceSha256: string;
}

/**
 * A phase 1 scenario as declared by the caller. `command: 'node'` is resolved by the IO layer to the
 * current Node executable (the runner still spawns a real process); any other value is used verbatim.
 */
export interface Phase1Scenario {
  id: string;
  environment: string;
  platform?: string;
  shell?: string;
  supported?: boolean;
  required?: boolean;
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
  targets?: string[];
  env?: Record<string, string>;
}

const CODE_FILE_PATTERN = /\.(?:ts|tsx|js|jsx|mjs|cjs|mts|cts)$/i;
const TEST_HELPER_PATTERN =
  /(^|\/)(?:tests?|__tests__|__mocks__|fixtures?)\/|(^|\/)(?:setup|mock|fake|sample-builder|test-utils)[^/]*\.(?:ts|js|mjs|cjs)$/i;
const SHELL_NAMES = new Set(['powershell', 'pwsh', 'bash', 'sh', 'zsh', 'cmd.exe', 'cmd']);
const SHELL_MODULES = new Set([
  'os',
  'path',
  'child_process',
  'fs',
  'node:os',
  'node:path',
  'node:child_process',
  'node:fs',
]);
const ROUTE_OBJECTS = /^(?:app|router|server|fastify|api|route)$/i;
const CLI_OBJECTS = /^(?:program|yargs|cli|commander)$/i;

const CATEGORY_BY_KIND: Record<StaticReference['kind'], string> = {
  import: 'ast-reference',
  export: 'ast-reference',
  call: 'ast-reference',
  route: 'ast-reference',
  'cli-registration': 'ast-reference',
  'string-symbol': 'ast-reference',
  'generated-input': 'schema-template-rtm',
  schema: 'schema-template-rtm',
  template: 'schema-template-rtm',
  rtm: 'schema-template-rtm',
  'test-helper': 'test-only-helper',
  'dynamic-import': 'dynamic-import',
  reflection: 'reflection',
  'shell-platform': 'shell-platform',
};

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function isCodeFilePath(file: string): boolean {
  return CODE_FILE_PATTERN.test(file);
}

export function isTestHelperPath(file: string): boolean {
  return TEST_HELPER_PATTERN.test(file);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function posixDirname(file: string): string {
  const index = file.lastIndexOf('/');
  return index === -1 ? '.' : file.slice(0, index);
}

function posixNormalize(file: string): string {
  const segments: string[] = [];
  for (const segment of file.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (segments.length > 0 && segments[segments.length - 1] !== '..') segments.pop();
      else segments.push('..');
      continue;
    }
    segments.push(segment);
  }
  return segments.join('/');
}

function posixJoin(base: string, specifier: string): string {
  return posixNormalize(base === '.' ? specifier : `${base}/${specifier}`);
}

/** Resolve a relative module specifier against the analyzed file set; bare specifiers stay unresolved. */
export function resolveRelativeModule(
  fromFile: string,
  specifier: string,
  files: readonly string[],
): string | undefined {
  if (!specifier.startsWith('.')) return undefined;
  const known = new Set(files);
  const base = posixJoin(posixDirname(fromFile), specifier);
  const withoutJs = base.replace(/\.js$/i, '');
  const candidates = [
    base,
    `${withoutJs}.ts`,
    `${withoutJs}.tsx`,
    `${withoutJs}.js`,
    `${base}.ts`,
    `${base}/index.ts`,
    `${withoutJs}/index.ts`,
  ];
  for (const candidate of unique(candidates)) {
    if (known.has(candidate)) return candidate;
  }
  return undefined;
}

function scriptKindFor(file: string): ts.ScriptKind {
  if (/\.tsx$/i.test(file)) return ts.ScriptKind.TSX;
  if (/\.jsx$/i.test(file)) return ts.ScriptKind.JSX;
  if (/\.(?:js|mjs|cjs)$/i.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

/** Collect exported declaration names so a string literal can be matched back to a defining symbol. */
export function collectExportedSymbols(source: string, file: string): string[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKindFor(file));
  const names: string[] = [];
  const hasExportModifier = (node: ts.Node): boolean =>
    (ts.getModifiers(node as ts.HasModifiers) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
  const collectDeclaration = (declaration: ts.Node): void => {
    if (
      (ts.isFunctionDeclaration(declaration) ||
        ts.isClassDeclaration(declaration) ||
        ts.isInterfaceDeclaration(declaration)) &&
      declaration.name !== undefined
    ) {
      names.push(declaration.name.text);
      return;
    }
    if (ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name)) {
      names.push(declaration.name.text);
    }
  };
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) continue; // `export { ... }` / re-export
    if (ts.isExportAssignment(statement)) {
      names.push('default');
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      if (!hasExportModifier(statement)) continue;
      for (const declaration of statement.declarationList.declarations) collectDeclaration(declaration);
      continue;
    }
    if (hasExportModifier(statement)) collectDeclaration(statement);
  }
  return unique(names);
}

interface ReferenceCollector {
  add(reference: Omit<StaticReference, 'sourceHash'>): void;
}

function propertyName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

function objectName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

function collectTypeScriptReferences(
  file: string,
  source: string,
  files: readonly string[],
  exportedBy: ReadonlyMap<string, string>,
  collector: ReferenceCollector,
): void {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKindFor(file));

  const add = (kind: StaticReference['kind'], symbol: string, consumer: string, line: number): void => {
    collector.add({ path: file, symbol, consumer, kind, line });
  };

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text;
      const target = resolveRelativeModule(file, specifier, files) ?? specifier;
      add(ts.isImportDeclaration(node) ? 'import' : 'export', specifier, target, lineOf(sourceFile, node));
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0];
      if (argument !== undefined && ts.isStringLiteral(argument)) {
        const specifier = argument.text;
        add(
          'dynamic-import',
          specifier,
          resolveRelativeModule(file, specifier, files) ?? specifier,
          lineOf(sourceFile, node),
        );
      }
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const specifier = node.arguments[0].text;
      if (SHELL_MODULES.has(specifier)) add('shell-platform', specifier, file, lineOf(sourceFile, node));
    } else if (ts.isCallExpression(node)) {
      const callee = propertyName(node.expression);
      const owner = ts.isPropertyAccessExpression(node.expression) ? objectName(node.expression.expression) : undefined;
      if (callee !== undefined) {
        if (['readdirSync', 'readdir', 'glob', 'globSync', 'opendir'].includes(callee)) {
          add('dynamic-import', callee, file, lineOf(sourceFile, node));
        } else if (['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync'].includes(callee)) {
          add('shell-platform', callee, file, lineOf(sourceFile, node));
        } else if (
          ['getMetadata', 'getOwnMetadata', 'defineMetadata', 'getMetadataKeys', 'resolve', 'resolveAll'].includes(
            callee,
          )
        ) {
          add('reflection', callee, file, lineOf(sourceFile, node));
        } else if (['get', 'post', 'put', 'patch', 'delete', 'use', 'route', 'all'].includes(callee)) {
          if (owner !== undefined && ROUTE_OBJECTS.test(owner)) add('route', callee, file, lineOf(sourceFile, node));
        } else if (['command', 'option', 'argument', 'demandCommand'].includes(callee)) {
          if (owner === undefined || CLI_OBJECTS.test(owner)) {
            add('cli-registration', callee, file, lineOf(sourceFile, node));
          }
        } else if (callee === 'function' || callee === 'eval') {
          add('reflection', callee, file, lineOf(sourceFile, node));
        }
      }
      const argument = node.arguments[0];
      if (
        argument !== undefined &&
        ts.isStringLiteral(argument) &&
        ts.isPropertyAccessExpression(node.expression) &&
        objectName(node.expression.expression) === 'Reflect'
      ) {
        add('reflection', argument.text, file, lineOf(sourceFile, node));
      }
    }
    if (ts.canHaveDecorators(node)) {
      for (const decorator of ts.getDecorators(node) ?? []) {
        const name = propertyName(decorator.expression) ?? 'decorator';
        add('reflection', name, file, lineOf(sourceFile, node));
      }
    }
    if (ts.isElementAccessExpression(node) && node.argumentExpression !== undefined) {
      if (!ts.isStringLiteral(node.argumentExpression))
        add('reflection', 'computed-member-access', file, lineOf(sourceFile, node));
    }
    if (ts.isPropertyAccessExpression(node)) {
      const text = node.getText(sourceFile);
      if (
        ['process.platform', 'process.env', 'process.execPath', 'os.EOL', 'path.sep', 'path.delimiter'].includes(text)
      ) {
        add('shell-platform', text, file, lineOf(sourceFile, node));
      }
    }
    if (ts.isStringLiteral(node)) {
      const value = node.text;
      if (/^REQ-\d+/.test(value) || /^RTM[-_]/.test(value)) {
        add('rtm', value, file, lineOf(sourceFile, node));
      } else if (SHELL_NAMES.has(value)) {
        add('shell-platform', value, file, lineOf(sourceFile, node));
      } else if (value.startsWith('{{') || /\.(?:md|hbs|template|mustache)$/i.test(value)) {
        add('template', value, file, lineOf(sourceFile, node));
      } else if (/\.(?:json|ya?ml)$/i.test(value) || value.endsWith('.schema.json')) {
        add('schema', value, file, lineOf(sourceFile, node));
      } else if (exportedBy.has(value)) {
        add('string-symbol', value, exportedBy.get(value) ?? file, lineOf(sourceFile, node));
      } else if (/AUTO-GENERATED|@generated/i.test(value)) {
        add('generated-input', value, file, lineOf(sourceFile, node));
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  if (/AUTO-GENERATED|@generated/i.test(source)) {
    add('generated-input', '@generated', file, 1);
  }
}

function collectNonTypeScriptReferences(
  file: string,
  source: string,
  exportedBy: ReadonlyMap<string, string>,
  collector: ReferenceCollector,
): void {
  const add = (kind: StaticReference['kind'], symbol: string, consumer: string, line: number): void => {
    collector.add({ path: file, symbol, consumer, kind, line });
  };
  const lines = source.split(/\r?\n/);
  const isJson = /\.(?:json)$/i.test(file);
  if (isJson) {
    if (/"\$schema"|"type"\s*:\s*"object"/.test(source)) {
      add('schema', file, file, 1);
      add('generated-input', file, file, 1);
    }
  }
  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    for (const match of line.matchAll(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g)) {
      if (match[1] !== undefined) add('template', match[1], file, lineNumber);
    }
    for (const match of line.matchAll(/\bREQ-\d+\b/g)) {
      add('rtm', match[0], file, lineNumber);
    }
    if (/migration/i.test(line)) add('generated-input', 'migration', file, lineNumber);
  }
  if (exportedBy.has(file)) add('string-symbol', file, file, 1);
}

function collectReferences(
  file: string,
  source: string,
  files: readonly string[],
  exportedBy: ReadonlyMap<string, string>,
): StaticReference[] {
  const collected: Array<Omit<StaticReference, 'sourceHash'>> = [];
  const sourceHash = sha256Hex(source);
  const collector: ReferenceCollector = { add: (reference) => collected.push(reference) };
  if (isTestHelperPath(file)) {
    collector.add({ path: file, symbol: file, consumer: file, kind: 'test-helper', line: 1 });
  }
  if (isCodeFilePath(file)) {
    collectTypeScriptReferences(file, source, files, exportedBy, collector);
  } else {
    collectNonTypeScriptReferences(file, source, exportedBy, collector);
  }
  const seen = new Set<string>();
  const references: StaticReference[] = [];
  for (const reference of collected) {
    const key = `${reference.path}|${reference.kind}|${reference.symbol}|${reference.line}|${reference.consumer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    references.push({ ...reference, sourceHash });
  }
  return references;
}

/** Build a pure static inventory over injected source text. Unreadable files stay in `unknowns`. */
export function buildStaticInventory(input: StaticInventoryInput): StaticInventoryReport {
  const files = input.files.map((file) => file.replace(/\\/g, '/'));
  const exportedBy = new Map<string, string>();
  const unknowns: string[] = [];
  for (const file of files) {
    const source = input.sourceText[file];
    if (typeof source !== 'string') {
      unknowns.push(file);
      continue;
    }
    if (isCodeFilePath(file)) {
      for (const name of collectExportedSymbols(source, file)) {
        if (!exportedBy.has(name)) exportedBy.set(name, file);
      }
    }
  }
  const references: StaticReference[] = [];
  for (const file of files) {
    const source = input.sourceText[file];
    if (typeof source !== 'string') continue;
    references.push(...collectReferences(file, source, files, exportedBy));
  }
  const categories = unique(references.map((reference) => CATEGORY_BY_KIND[reference.kind])).sort();
  return { revision: input.revision, files, references, categories, unknowns, commands: [] };
}

function candidateSymbols(file: string, references: readonly StaticReference[]): string[] {
  const exported = references
    .filter((reference) => reference.path === file && reference.kind === 'export')
    .map((reference) => reference.symbol)
    .filter((symbol) => isRelativePath(symbol));
  if (exported.length > 0) return unique(exported);
  const base = file.split('/').pop() ?? file;
  return [base.replace(/\.[^.]+$/, '')];
}

function nextCandidateId(revision: RevisionIdentity, index: number): string {
  const date = revision.analyzedAt.slice(0, 10).replace(/-/g, '');
  return `CHG-P1-${date}-${String(index + 1).padStart(3, '0')}`;
}

function scenarioExercised(scenario: DynamicTraceInputScenario): boolean {
  return scenario.command !== undefined && scenario.observation === 'observed' && scenario.reached === true;
}

/**
 * Normalize only scenario traces that were produced by a real command runner. A scenario without
 * command evidence is never a trace: it stays an unexercised scenario and forces `unknown`.
 */
export function mergeDynamicTrace(
  staticReport: StaticInventoryReport,
  trace: DynamicTraceInput,
): Phase1CandidateLead[] {
  if (!/^[0-9a-f]{64}$/.test(trace.rawTraceSha256)) {
    throw new Error('dynamic trace rawTraceSha256 must be a lowercase SHA-256 digest');
  }
  const testHelperPaths = new Set(
    staticReport.references.filter((reference) => reference.kind === 'test-helper').map((reference) => reference.path),
  );
  const inboundTargets = new Set(
    staticReport.references.filter((reference) => reference.kind === 'import').map((reference) => reference.consumer),
  );
  const candidateFiles = staticReport.files.filter(
    (file) => isCodeFilePath(file) && !testHelperPaths.has(file) && !inboundTargets.has(file),
  );
  const dynamicScenarios: DynamicTraceScenario[] = trace.scenarios
    .filter((scenario) => scenario.command !== undefined)
    .map((scenario) => ({
      id: scenario.id,
      environment: scenario.environment,
      reached: scenario.reached,
      observation: scenario.observation,
      command: scenario.command as CommandEvidence,
    }));
  const hasUnexercised = trace.scenarios.some((scenario) => !scenarioExercised(scenario));
  return candidateFiles.map((file, index) => {
    const staticReferences = staticReport.references.filter((reference) => reference.path === file);
    const blocked = staticReport.unknowns.includes(file);
    const classification: Phase1CandidateLead['classification'] = blocked
      ? 'blocked'
      : hasUnexercised
        ? 'unknown'
        : 'candidate';
    return {
      candidateId: nextCandidateId(trace.revision, index),
      classification,
      files: [file],
      symbols: candidateSymbols(file, staticReport.references),
      staticReferences,
      dynamicScenarios,
      guardViolations: [],
      status: classification === 'blocked' ? 'blocked' : 'discovered',
    };
  });
}

function matches(value: string, lead: Phase1CandidateLead, includeTargets: boolean): boolean {
  const paths = new Set(lead.files);
  const symbols = new Set(lead.symbols);
  const targets = new Set(lead.staticReferences.map((reference) => reference.consumer));
  if (paths.has(value) || symbols.has(value)) return true;
  if (includeTargets && targets.has(value)) return true;
  for (const file of paths) {
    const base = file.split('/').pop();
    if (base === value) return true;
  }
  return false;
}

function pushMatches(
  violations: string[],
  label: string,
  entries: readonly string[],
  lead: Phase1CandidateLead,
  includeTargets = false,
): void {
  for (const entry of entries) {
    if (matches(entry, lead, includeTargets)) violations.push(`${label}: ${entry} may reach the candidate`);
  }
}

/**
 * Produce a non-empty guard list whenever a false-positive mechanism could explain the apparent
 * absence: dynamic import, reflection, shell/platform, schema/template/RTM, generated/external
 * contracts, plugin/deployment entry points, and test-only helpers.
 */
export function checkFalsePositiveGuards(lead: Phase1CandidateLead, context: FalsePositiveContext): string[] {
  const violations: string[] = [];
  pushMatches(violations, 'dynamic-import', context.dynamicImports, lead, true);
  pushMatches(violations, 'reflection', context.reflection, lead);
  pushMatches(violations, 'schema', context.schemas, lead, true);
  pushMatches(violations, 'template', context.templates, lead, true);
  pushMatches(violations, 'rtm', context.rtmIds, lead);
  pushMatches(violations, 'external-contract', context.externalContracts, lead, true);
  pushMatches(violations, 'generated-reference', context.generatedReferences, lead, true);
  for (const helper of context.testHelpers) {
    if (matches(helper, lead, true)) violations.push(`test-helper: ${helper} is test-only reachability`);
  }
  if (context.platforms.length > 0) {
    violations.push(
      `platform: declared environments [${context.platforms.join(', ')}] are not all exercised; a missing supported environment is not deadness evidence`,
    );
  }
  if (context.dynamicImports.length > 0 || context.reflection.length > 0) {
    violations.push('unresolved-mechanism: dynamic import or reflection cannot be resolved statically');
  }
  for (const scenario of lead.dynamicScenarios) {
    if (scenario.observation !== 'observed' || scenario.reached !== true) {
      violations.push(`unexercised-scenario: ${scenario.id} (${scenario.observation}) is not deadness evidence`);
    }
  }
  if (lead.dynamicScenarios.length === 0) {
    violations.push('unexercised-scenario: no real dynamic trace was recorded for the candidate');
  }
  return unique(violations);
}

/** Derive the false-positive mechanisms actually present in a static inventory (report-level view). */
export function deriveFalsePositiveContext(
  staticReport: StaticInventoryReport,
  platforms: readonly string[] = [],
): FalsePositiveContext {
  const ofKind = (kind: StaticReference['kind']): StaticReference[] =>
    staticReport.references.filter((reference) => reference.kind === kind);
  const bareSpecifiers = staticReport.references
    .filter(
      (reference) =>
        reference.kind === 'import' && !reference.symbol.startsWith('.') && reference.consumer === reference.symbol,
    )
    .map((reference) => reference.consumer);
  return {
    dynamicImports: unique(ofKind('dynamic-import').map((reference) => reference.consumer)),
    reflection: unique(ofKind('reflection').map((reference) => reference.symbol)),
    platforms: unique([...platforms]),
    schemas: unique(ofKind('schema').map((reference) => reference.path)),
    templates: unique(ofKind('template').map((reference) => reference.path)),
    rtmIds: unique(ofKind('rtm').map((reference) => reference.symbol)),
    testHelpers: unique(ofKind('test-helper').map((reference) => reference.path)),
    generatedReferences: unique(ofKind('generated-input').map((reference) => reference.symbol)),
    externalContracts: unique(bareSpecifiers),
  };
}

/** Applicability of one declared scenario on the current host. */
export interface ScenarioApplicability {
  applicable: boolean;
  observation: EvidenceObservationStatus;
  reason: string;
}

export function classifyScenario(scenario: Phase1Scenario, currentPlatform: string): ScenarioApplicability {
  if (scenario.supported === false) {
    return { applicable: false, observation: 'not_run', reason: 'environment is declared unsupported by the campaign' };
  }
  if (scenario.platform !== undefined && scenario.platform !== currentPlatform) {
    return {
      applicable: false,
      observation: 'unavailable',
      reason: `platform ${scenario.platform} is not available on ${currentPlatform}`,
    };
  }
  return { applicable: true, observation: 'unavailable', reason: 'applicable on the current host' };
}

/** Environment matrix row for one declared scenario. */
export function environmentRow(
  scenario: Phase1Scenario,
  platform: string,
  observation: EvidenceObservationStatus,
  reason: string,
  defaultShell?: string,
): EnvironmentObservation {
  return {
    platform: scenario.platform ?? platform,
    shell: scenario.shell ?? defaultShell ?? 'unspecified',
    runtime: 'node',
    supported: scenario.supported !== false,
    observed: observation,
    reason,
  };
}
