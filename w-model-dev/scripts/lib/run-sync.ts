import { spawnSync, type SpawnSyncOptions, type SpawnSyncReturns } from 'node:child_process';

import * as ts from 'typescript';

export const DEFAULT_SYNC_TIMEOUT_MS = 15_000;
export const DEFAULT_SYNC_MAX_BUFFER = 64 * 1024 * 1024;

/** Callers may tune safe execution settings but cannot weaken process termination or output typing. */
export type RunSyncOptions = Omit<SpawnSyncOptions, 'encoding' | 'killSignal'>;

export type DirectSyncApi = 'spawnSync' | 'execSync' | 'execFileSync';
type SyncProcessException = {
  api: DirectSyncApi;
  file: string;
  line: number;
  symbol: string;
  reason: string;
  /** Retained audit provenance for a call migrated through the centralized runSync wrapper. */
  migratedToRunSync?: true;
  timeout: {
    required: true;
    status: 'present' | 'missing-followup';
  };
};

/**
 * Full scripts-directory inventory of direct synchronous child-process calls.
 * Direct calls are retained only where B4 scope prohibits migration or where their
 * command-specific implementation already needs a distinct API. Calls migrated to
 * runSync retain their entries as audit provenance instead of being deleted.
 */
export const SYNC_PROCESS_EXCEPTIONS: readonly SyncProcessException[] = [
  {
    api: 'spawnSync',
    file: 'cli/check-docs-consistency.ts',
    line: 118,
    symbol: 'detectScriptsChanges',
    reason: 'B3 migrated git diff probe through runSync; retained as audit provenance with a 15-second timeout.',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-docs-consistency.ts',
    line: 127,
    symbol: 'detectScriptsChanges',
    reason: 'B3 migrated git status probe through runSync; retained as audit provenance with a 15-second timeout.',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-docs-consistency.ts',
    line: 478,
    symbol: 'currentCommitSha',
    reason: 'B3 migrated the bounded git HEAD probe through runSync; retained as audit provenance.',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-docs-consistency.ts',
    line: 604,
    symbol: 'collectVitestMeasurements',
    reason:
      'B3 migrated direct Node Vitest execution through runSync; retained as audit provenance with its 300-second timeout.',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-docs-consistency.ts',
    line: 610,
    symbol: 'collectVitestMeasurements',
    reason:
      'B3 migrated the shell Vitest fallback through runSync; retained as audit provenance with its 300-second timeout.',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-tla-model.ts',
    line: 115,
    symbol: 'checkEnvironment',
    reason: 'B3 migrated the Java environment probe through runSync with EXEC_LIMITS.shortTimeoutMs.',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-tla-model.ts',
    line: 285,
    symbol: 'main',
    reason: 'B3 migrated the preflight Java probe through runSync with EXEC_LIMITS.shortTimeoutMs.',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/security-scan.ts',
    line: 156,
    symbol: 'main',
    reason: 'B3 migrated ESLint execution through runSync with a 300-second timeout and existing 10 MiB maxBuffer.',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/check-tla-model.ts',
    line: 195,
    symbol: 'runTools',
    reason: 'B4 excludes check-tla-model; SANY uses a command-specific bounded timeout and SIGKILL.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/check-tla-model.ts',
    line: 222,
    symbol: 'runTools',
    reason: 'B4 excludes check-tla-model; TLC uses a command-specific bounded timeout and SIGKILL.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/ensure-codegraph-opsx.ts',
    line: 45,
    symbol: 'checkCli',
    reason: 'Existing CLI version probe has an explicit 10-second timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/ensure-codegraph-opsx.ts',
    line: 66,
    symbol: 'installCli',
    reason: 'Existing npm installation command has an explicit 120-second timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/ensure-codegraph-opsx.ts',
    line: 90,
    symbol: 'checkMcpCodegraph',
    reason: 'Existing codegraph probe has an explicit 15-second timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/ensure-codegraph-opsx.ts',
    line: 113,
    symbol: 'registerMcpCodegraph',
    reason: 'Existing codegraph registration has an explicit 60-second timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/ensure-codegraph-opsx.ts',
    line: 134,
    symbol: 'initCodegraph',
    reason: 'Existing codegraph initialization has an explicit 300-second timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/ensure-codegraph-opsx.ts',
    line: 156,
    symbol: 'initOpenspec',
    reason: 'Existing OpenSpec initialization has an explicit 60-second timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execSync',
    file: '__tests__/coverage-logic.test.ts',
    line: 377,
    symbol: 'C7 invalid out-of-scope fixture',
    reason: 'Existing real CLI assertion has an explicit 15-second timeout; brief explicitly preserves it.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execSync',
    file: '__tests__/coverage-logic.test.ts',
    line: 395,
    symbol: 'C7 non-array items fixture',
    reason: 'Existing real CLI assertion has an explicit 15-second timeout; brief explicitly preserves it.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execSync',
    file: '__tests__/coverage-logic.test.ts',
    line: 413,
    symbol: 'C7 valid out-of-scope fixture',
    reason: 'Existing real CLI assertion has an explicit 15-second timeout; brief explicitly preserves it.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    line: 2341,
    symbol: 'withDocsConsistencyFixture git init',
    reason: 'D5 creates a real temporary Git repository so provenance binds to an actual HEAD.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    line: 2344,
    symbol: 'withDocsConsistencyFixture git config email',
    reason: 'D5 configures the isolated fixture Git identity before creating its commit.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    line: 2350,
    symbol: 'withDocsConsistencyFixture git config name',
    reason: 'D5 configures the isolated fixture Git identity before creating its commit.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    line: 2353,
    symbol: 'withDocsConsistencyFixture git config gpgSign',
    reason: 'D5 disables inherited signing for the isolated provenance fixture.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    line: 2360,
    symbol: 'withDocsConsistencyFixture git add',
    reason: 'D5 stages the copied fixture before creating its provenance-bound commit.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    line: 2361,
    symbol: 'withDocsConsistencyFixture git commit',
    reason: 'D5 creates the real fixture HEAD with isolated hooks/signing/editor settings and a bounded timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    line: 2397,
    symbol: 'fixtureCommitSha',
    reason: 'D5 reads the isolated fixture HEAD for same-run provenance assertions.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    line: 2413,
    symbol: 'runDocsConsistencyCli',
    reason: 'D5 keeps the real docs-consistency CLI boundary test with an explicit bounded timeout for exit-2 probes.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/evidence-export-logic.test.ts',
    line: 170,
    symbol: 'runCli',
    reason:
      'D3 requires actual CLI child-process exit-code tests; execution uses the default 15-second process timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/wm-write.test.ts',
    line: 35,
    symbol: 'runArgs',
    reason: 'B4 excludes state/wm-write; real CLI helper uses an explicit 15-second timeout.',
    timeout: { required: true, status: 'present' },
  },
];

export interface SynchronousChildProcessCall {
  api: DirectSyncApi;
  file: string;
  line: number;
}

export interface SynchronousChildProcessAuditViolation {
  file: string;
  line: number;
  message: 'dynamic child_process property access cannot be safely audited';
}

export interface SynchronousChildProcessAudit {
  calls: SynchronousChildProcessCall[];
  violations: SynchronousChildProcessAuditViolation[];
}

const SYNC_APIS = new Set<DirectSyncApi>(['spawnSync', 'execSync', 'execFileSync']);
const CHILD_PROCESS_MODULES = new Set(['node:child_process', 'child_process']);

function isSyncApi(name: string): name is DirectSyncApi {
  return SYNC_APIS.has(name as DirectSyncApi);
}

function isChildProcessModule(moduleSpecifier: ts.Expression): boolean {
  return ts.isStringLiteral(moduleSpecifier) && CHILD_PROCESS_MODULES.has(moduleSpecifier.text);
}

function childProcessPropertyName(expression: ts.ElementAccessExpression): DirectSyncApi | undefined {
  const argument = expression.argumentExpression;
  if (argument === undefined) return undefined;
  if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
    return isSyncApi(argument.text) ? argument.text : undefined;
  }
  return undefined;
}

/**
 * Parses one TypeScript source file and inventories synchronous child_process API calls.
 * Imports, aliases, namespace access, and static element access resolve to stable call
 * records. Non-literal namespace element access is reported rather than ignored.
 */
export function auditSynchronousChildProcessSource(source: string, file: string): SynchronousChildProcessAudit {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const directBindings = new Map<string, DirectSyncApi>();
  const namespaceBindings = new Set<string>();
  const calls: SynchronousChildProcessCall[] = [];
  const violations: SynchronousChildProcessAuditViolation[] = [];

  const addCall = (api: DirectSyncApi, node: ts.Node): void => {
    calls.push({ api, file, line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1 });
  };
  const addDynamicViolation = (node: ts.Node): void => {
    violations.push({
      file,
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
      message: 'dynamic child_process property access cannot be safely audited',
    });
  };

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !isChildProcessModule(statement.moduleSpecifier)) continue;
    const clause = statement.importClause;
    if (clause === undefined || clause.namedBindings === undefined) continue;
    if (ts.isNamespaceImport(clause.namedBindings)) {
      namespaceBindings.add(clause.namedBindings.name.text);
      continue;
    }
    for (const element of clause.namedBindings.elements) {
      const imported = element.propertyName?.text ?? element.name.text;
      if (isSyncApi(imported)) directBindings.set(element.name.text, imported);
    }
  }

  const inspectVariableDeclaration = (node: ts.VariableDeclaration): void => {
    if (!ts.isObjectBindingPattern(node.name) || node.initializer === undefined || !ts.isIdentifier(node.initializer))
      return;
    if (!namespaceBindings.has(node.initializer.text)) return;
    for (const element of node.name.elements) {
      const property = element.propertyName?.getText(sourceFile) ?? element.name.getText(sourceFile);
      if (isSyncApi(property)) directBindings.set(element.name.getText(sourceFile), property);
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node)) inspectVariableDeclaration(node);

    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression)) {
        const api = directBindings.get(expression.text);
        // eslint-disable-next-line security/detect-possible-timing-attacks -- AST symbol classification, not a secret comparison
        if (api !== undefined) addCall(api, node);
      } else if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
        if (namespaceBindings.has(expression.expression.text) && isSyncApi(expression.name.text)) {
          addCall(expression.name.text, node);
        }
      } else if (ts.isElementAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
        if (namespaceBindings.has(expression.expression.text)) {
          const api = childProcessPropertyName(expression);
          // eslint-disable-next-line security/detect-possible-timing-attacks -- AST symbol classification, not a secret comparison
          if (api !== undefined) addCall(api, node);
          else addDynamicViolation(node);
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return { calls, violations };
}

function boundedPositiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Executes a child process synchronously with mandatory process-level bounds.
 * Callers may extend a known long-running timeout but cannot override SIGKILL,
 * UTF-8 output decoding, or the finite positive default fallbacks.
 */
export function runSync(command: string, args: string[], options: RunSyncOptions = {}): SpawnSyncReturns<string> {
  return spawnSync(command, args, {
    ...options,
    timeout: boundedPositiveNumber(options.timeout, DEFAULT_SYNC_TIMEOUT_MS),
    killSignal: 'SIGKILL',
    encoding: 'utf-8',
    maxBuffer: boundedPositiveNumber(options.maxBuffer, DEFAULT_SYNC_MAX_BUFFER),
  }) as SpawnSyncReturns<string>;
}
