/* eslint-disable security/detect-non-literal-fs-filename -- Every path is resolved beneath the explicit fixture repository root through resolveControlledRelativePath before it is read. */
/**
 * Real TDD RED/GREEN harness (IO boundary).
 *
 * Running a test command is a child-process boundary, so the real harness lives in `lib/` and reuses
 * `createCodeHealthCommandRunner`: `shell: false`, exact argv (never a shell string), a real exit code,
 * and a mandatory per-run `EvidenceBinding`. The pure Phase 2 matrix logic stays in
 * `logic/code-health-gap-logic.ts`.
 *
 * `assertionHash` is derived from a fully declared and anchored artifact set:
 *   - `TddHarnessInput.candidate` is CALLER-SUPPLIED: its `changeScope.files` / `tests` are the candidate
 *     record this structural check is anchored to, and the implementation artifact must be inside
 *     `changeScope.files` (G-1/G-2: the implementation/test split comes from that record, not from caller
 *     labels), must not be a ledger-declared `tests` file, must not be an argv entry, and must not appear
 *     in the declared test artifacts. The record is not unforgeable on its own (G-4 below);
 *   - the declared test artifacts must be non-empty, repository-relative, exist, and each must be a
 *     ledger-declared candidate test;
 *   - every statically resolvable local module reachable from the argv entry points must be classified
 *     as a ledger-declared test artifact or the implementation artifact (R-C closure completeness);
 *   - every local module file in the test entry points' own directory must be declared or be the
 *     implementation, which closes non-literal dynamic imports (R-D);
 *   - every artifact/test file is resolved with the shared canonical-root containment semantics and
 *     rejected as `SECURITY_BLOCKED` when it is a symlink, a root escape, or a hardlink (`nlink > 1`)
 *     (G-3);
 *   - `testArtifacts` / `implementationArtifact` are recorded on every result so RED and GREEN symmetry
 *     is enforced by `validateRedGreenEvidence` (R-E).
 *
 * Honest residual (G-4): this harness enforces STRUCTURAL CONSISTENCY of the declarations against the
 * ledger record it is given. It is not, and cannot be, unforgeable on its own — a caller that supplies a
 * forged ledger record is out of scope. The ledger, the G gate, and the role signature chain are the
 * authority. A cross-directory non-literal dynamic specifier is an explicit, recorded acceptance
 * limitation (same-directory non-literal specifiers are closed by R-D).
 *
 * The result also carries `toolVersions[codeHealthTddFailureClass]`, the real failure classification
 * derived from the raw child output. An unrelated failure (module missing, syntax error, command not
 * found, ...) keeps its real exit code but is classified as not RED, so `validateRedGreenEvidence`
 * rejects it instead of counting it as RED.
 */

import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import type {
  CommandEvidence,
  EvidenceBinding,
  EvidenceStore,
  RevisionProvider,
  TddHarnessInput,
  TddHarnessResult,
} from '../logic/code-health-contract.js';

import { createCodeHealthCommandRunner } from './code-health-command.js';
import { CodeHealthError } from './code-health-error.js';
import {
  createCodeHealthFileVerifier,
  resolveControlledRelativePath,
  resolveControlledRoot,
} from './code-health-file-verifier.js';

/** `toolVersions` key carrying the real failure classification of one harness run. */
export const TDD_FAILURE_CLASS_KEY = 'codeHealthTddFailureClass';

export type TddFailureClass = 'assertion' | 'infrastructure' | 'unavailable' | 'none' | 'unknown';

export interface TddHarnessOptions {
  /** Explicit fixture repository root that owns the command cwd and raw outputs. */
  repositoryRoot: string;
  /** Repository-relative directory that owns raw outputs. */
  rawOutputDir: string;
  evidenceStore: EvidenceStore;
  revisionProvider: RevisionProvider;
  /** Mandatory per-run binding (candidate/scope/revision). */
  binding: EvidenceBinding;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  now?: () => Date;
}

/** Infrastructure failures that must never count as a gap-relevant RED. */
const INFRASTRUCTURE_OUTPUT_PATTERN =
  /(?:cannot find module|err_module_not_found|err_require_esm|syntaxerror|referenceerror|is not recognized as an internal or external command|command not found|enoent|no such file or directory|unknown file extension|cannot use import statement outside a module|permission denied|eacces)/i;

/** A genuine assertion failure is the only signal that counts as RED. */
const ASSERTION_OUTPUT_PATTERN = /(?:assertionerror|err_assertion|expected .* to (?:be|equal|match)|✗|not ok \d)/i;

const LOCAL_MODULE_EXTENSIONS = ['.mjs', '.js', '.cjs', '.ts', '.tsx', '.jsx'] as const;
const LOCAL_SPECIFIER_PATTERN = /['"]((?:\.\.?\/)[^'"]+)['"]/g;
const TEST_RUNNER_NAMES = new Set(['npm', 'npx', 'pnpm', 'yarn']);
const TEST_RUNNER_SUBCOMMANDS = new Set(['test', 'vitest', 'self-test']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRelative(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

function isModuleFile(name: string): boolean {
  return LOCAL_MODULE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

/** Fail-closed input validation: a gap identity and an exact non-empty argv are mandatory. */
export function validateTddHarnessInput(input: unknown): asserts input is TddHarnessInput {
  if (!isRecord(input)) {
    throw new CodeHealthError(
      'ARG_INVALID',
      'TDD harness requires an input object with a gap and an argv test command',
    );
  }
  const gap = input.gap;
  if (!isRecord(gap) || typeof gap.gapId !== 'string' || gap.gapId.trim() === '') {
    throw new CodeHealthError('ARG_INVALID', 'TDD harness requires a gap with a stable gapId');
  }
  const testCommand = input.testCommand;
  if (
    !Array.isArray(testCommand) ||
    testCommand.length === 0 ||
    testCommand.some((argument) => typeof argument !== 'string') ||
    typeof testCommand[0] !== 'string' ||
    testCommand[0].trim() === ''
  ) {
    throw new CodeHealthError(
      'ARG_INVALID',
      'TDD harness requires a non-empty argv test command (exact argv, never a shell string)',
    );
  }
}

function isRepositoryTestArgument(argument: string): boolean {
  const normalized = argument.replace(/\\/g, '/');
  if (/(^|\/)__tests__(\/|$)/i.test(normalized)) return true;
  if (/(^|\/)self-test\.ts$/i.test(normalized)) return true;
  return /vitest/i.test(normalized);
}

/**
 * Anti-recursion guard (R4): the harness must never be pointed at this repository's own test suite.
 * Any argv entry that references `__tests__`, `self-test.ts`, or vitest — or that drives a package
 * manager's `test` verb — is rejected before a process starts.
 */
function assertNotRepositoryTestInvocation(testCommand: readonly string[]): void {
  const [command, ...args] = testCommand;
  const commandName = (command ?? '').replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? '';
  if (TEST_RUNNER_NAMES.has(commandName) && args.some((arg) => TEST_RUNNER_SUBCOMMANDS.has(arg.toLowerCase()))) {
    throw new CodeHealthError(
      'ARG_INVALID',
      'TDD harness refuses to run this repository test suite (recursion); pass an isolated fixture command instead',
    );
  }
  if (testCommand.some((argument) => isRepositoryTestArgument(argument))) {
    throw new CodeHealthError(
      'ARG_INVALID',
      'TDD harness refuses argv that targets this repository __tests__ / self-test / vitest (recursion)',
    );
  }
}

async function resolveRegularFile(root: string, relativePath: string): Promise<string | null> {
  const resolution = resolveControlledRelativePath(root, relativePath);
  if (!resolution.ok || !resolution.absolutePath) return null;
  try {
    const entry = await fs.lstat(resolution.absolutePath);
    if (entry.isSymbolicLink() || !entry.isFile()) return null;
    return resolution.absolutePath;
  } catch {
    return null;
  }
}

function requireRepositoryRelativePaths(root: string, value: unknown, field: string): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((entry) => typeof entry !== 'string' || entry.trim() === '')
  ) {
    throw new CodeHealthError('ARG_INVALID', `TDD harness requires ${field} to be a non-empty array of paths`);
  }
  const normalized: string[] = [];
  for (const entry of value) {
    const relative = normalizeRelative(entry as string);
    if (!resolveControlledRelativePath(root, relative).ok) {
      throw new CodeHealthError('ARG_INVALID', `TDD harness ${field} entry must be repository-relative: ${entry}`);
    }
    normalized.push(relative);
  }
  return [...new Set(normalized)];
}

const fileVerifier = createCodeHealthFileVerifier();

/**
 * Canonical artifact policy (G-3): every artifact/test file is resolved through the shared
 * `code-health-file-verifier` boundary — explicit repository root, no symlinked components or target,
 * no root escape — and additionally rejected when it is a hardlink (`nlink > 1`). Content is consumed
 * through the verified canonical path.
 */
async function assertCanonicalRegularFile(root: string, relative: string, field: string): Promise<void> {
  const rootResolution = await resolveControlledRoot(root);
  if (!rootResolution.ok || !rootResolution.canonicalRoot) {
    throw new CodeHealthError(
      rootResolution.code === 'SECURITY_BLOCKED' ? 'SECURITY_BLOCKED' : 'STRUCTURE_INVALID',
      `TDD harness ${field} repository root is not a controlled directory`,
    );
  }
  const canonicalTarget = path.resolve(rootResolution.canonicalRoot, ...relative.split('/'));
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(canonicalTarget);
  } catch {
    throw new CodeHealthError('EVIDENCE_INVALID', `TDD harness ${field} is missing or unreadable: ${relative}`);
  }
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  const verified = await fileVerifier.verifyRegularNonSymlinkFile({
    root,
    relativePath: relative,
    expectedSha256: actualSha256,
  });
  if (!verified.ok) {
    throw new CodeHealthError(
      verified.code === 'SECURITY_BLOCKED' ? 'SECURITY_BLOCKED' : (verified.code ?? 'EVIDENCE_INVALID'),
      `TDD harness ${field} failed canonical verification: ${verified.reason ?? 'unknown reason'}`,
    );
  }
  const entry = await fs.lstat(canonicalTarget);
  if (entry.nlink > 1) {
    throw new CodeHealthError(
      'SECURITY_BLOCKED',
      `TDD harness ${field} must not be a hardlinked file (nlink>1): ${relative}`,
    );
  }
}

async function resolveLocalModule(root: string, fromRelative: string, specifier: string): Promise<string | null> {
  const baseDirectory = path.posix.dirname(fromRelative);
  const joined = path.posix.normalize(path.posix.join(baseDirectory, specifier));
  const candidates = [
    joined,
    ...LOCAL_MODULE_EXTENSIONS.map((extension) => `${joined}${extension}`),
    ...LOCAL_MODULE_EXTENSIONS.map((extension) => `${joined}/index${extension}`),
  ];
  for (const candidate of candidates) {
    const normalized = normalizeRelative(candidate);
    if (normalized.startsWith('../')) continue;
    if ((await resolveRegularFile(root, normalized)) !== null) return normalized;
  }
  return null;
}

/** Transitive closure of statically resolvable (literal) local modules reachable from the entry files. */
async function collectLocalModuleClosure(root: string, entryFiles: readonly string[]): Promise<Set<string>> {
  const visited = new Set<string>();
  const queue = [...entryFiles];
  while (queue.length > 0) {
    const relative = queue.shift()!;
    if (visited.has(relative)) continue;
    const absolute = await resolveRegularFile(root, relative);
    if (absolute === null) continue;
    visited.add(relative);
    let source = '';
    try {
      source = await fs.readFile(absolute, 'utf8');
    } catch {
      continue;
    }
    for (const match of source.matchAll(LOCAL_SPECIFIER_PATTERN)) {
      const specifier = match[1];
      if (specifier === undefined) continue;
      const resolved = await resolveLocalModule(root, relative, specifier);
      if (resolved !== null && !visited.has(resolved)) queue.push(resolved);
    }
  }
  return visited;
}

interface ResolvedHarnessArtifacts {
  testArtifacts: string[];
  implementation: string;
  testSet: string[];
  entryFiles: string[];
}

/**
 * Resolve and structurally validate the anchored artifact set. The implementation/test split is derived
 * from the ledger-recorded candidate (`changeScope.files` = approved implementation scope,
 * `tests` = ledger-declared test files), not from caller labels. Every failure is a typed error; the
 * canonical artifact policy (G-3) rejects symlinks, escapes, and hardlinks.
 */
async function resolveHarnessArtifacts(root: string, input: TddHarnessInput): Promise<ResolvedHarnessArtifacts> {
  const implementationRaw = input.implementation;
  if (typeof implementationRaw !== 'string' || implementationRaw.trim() === '') {
    throw new CodeHealthError(
      'ARG_INVALID',
      'TDD harness requires an explicit implementation artifact path (string; null/absent/non-string is a violation)',
    );
  }
  const implementation = normalizeRelative(implementationRaw);
  if (!resolveControlledRelativePath(root, implementation).ok) {
    throw new CodeHealthError('ARG_INVALID', 'TDD harness implementation artifact must be repository-relative');
  }

  const candidate = input.candidate;
  if (!isRecord(candidate) || candidate.candidateId !== input.gap.candidateId) {
    throw new CodeHealthError(
      'ARG_INVALID',
      'TDD harness requires the ledger-recorded candidate whose candidateId matches the gap',
    );
  }
  const changeScope = isRecord(candidate.changeScope) ? candidate.changeScope : null;
  if (changeScope === null) {
    throw new CodeHealthError('ARG_INVALID', 'TDD harness requires the ledger candidate approved changeScope.files');
  }
  const approvedScope = requireRepositoryRelativePaths(root, changeScope.files, 'ledger candidate changeScope.files');
  const candidateTests = requireRepositoryRelativePaths(root, candidate.tests, 'ledger candidate tests');

  if (!approvedScope.includes(implementation)) {
    throw new CodeHealthError(
      'ARG_INVALID',
      `TDD harness implementation artifact is not in the ledger candidate approved scope: ${implementation}`,
    );
  }
  if (candidateTests.includes(implementation)) {
    throw new CodeHealthError(
      'ARG_INVALID',
      'TDD harness implementation artifact must not be a ledger-declared test file',
    );
  }
  await assertCanonicalRegularFile(root, implementation, 'implementation artifact');

  const testArtifacts = requireRepositoryRelativePaths(root, input.testArtifacts, 'testArtifacts');
  for (const artifact of testArtifacts) {
    if (!candidateTests.includes(artifact)) {
      throw new CodeHealthError(
        'ARG_INVALID',
        `TDD harness testArtifacts entry must be a ledger-declared candidate test: ${artifact}`,
      );
    }
    await assertCanonicalRegularFile(root, artifact, 'test artifact');
  }
  if (testArtifacts.includes(implementation)) {
    throw new CodeHealthError(
      'ARG_INVALID',
      'TDD harness implementation artifact must not be declared as a test artifact',
    );
  }

  const entryFiles: string[] = [];
  for (const argument of input.testCommand) {
    if (argument.startsWith('-')) continue;
    const relative = normalizeRelative(argument);
    const resolution = resolveControlledRelativePath(root, relative);
    if (!resolution.ok || !resolution.absolutePath) continue;
    let entry: Awaited<ReturnType<typeof fs.lstat>> | null;
    try {
      entry = await fs.lstat(resolution.absolutePath);
    } catch {
      entry = null;
    }
    if (entry === null) continue;
    if (entry.isSymbolicLink()) {
      throw new CodeHealthError('SECURITY_BLOCKED', `TDD harness argv test file must not be a symlink: ${relative}`);
    }
    if (!entry.isFile()) continue;
    await assertCanonicalRegularFile(root, relative, 'argv test file');
    entryFiles.push(relative);
  }
  if (entryFiles.length === 0) {
    throw new CodeHealthError('ARG_INVALID', 'TDD harness test command must reference at least one existing test file');
  }
  if (entryFiles.includes(implementation)) {
    throw new CodeHealthError('ARG_INVALID', 'TDD harness implementation artifact must not be an argv entry');
  }

  const closure = await collectLocalModuleClosure(root, entryFiles);
  for (const member of closure) {
    if (member !== implementation && !testArtifacts.includes(member)) {
      throw new CodeHealthError(
        'ARG_INVALID',
        `TDD harness closure member ${member} is neither a declared test artifact nor the implementation artifact`,
      );
    }
    if (member !== implementation && !candidateTests.includes(member)) {
      throw new CodeHealthError(
        'ARG_INVALID',
        `TDD harness closure member ${member} is not a ledger-declared candidate test`,
      );
    }
    if (member !== implementation) await assertCanonicalRegularFile(root, member, 'closure member');
  }

  // R-D: any local module in a test entry point's own directory that is neither declared nor the
  // implementation artifact is a violation. This closes non-literal dynamic imports, which the static
  // closure above cannot see. Symlinked local modules are rejected outright (G-3).
  for (const entry of entryFiles) {
    const directory = path.posix.dirname(entry);
    const absoluteDirectory = directory === '.' ? root : path.resolve(root, directory);
    let entries: Dirent[];
    try {
      entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const dirent of entries) {
      if (!isModuleFile(dirent.name)) continue;
      const relative = directory === '.' ? dirent.name : `${directory}/${dirent.name}`;
      if (dirent.isSymbolicLink()) {
        throw new CodeHealthError('SECURITY_BLOCKED', `TDD harness local module must not be a symlink: ${relative}`);
      }
      if (!dirent.isFile()) continue;
      if (relative !== implementation && !testArtifacts.includes(relative)) {
        throw new CodeHealthError(
          'ARG_INVALID',
          `TDD harness local module ${relative} in the test entry directory is neither a declared test artifact nor the implementation artifact`,
        );
      }
      await assertCanonicalRegularFile(root, relative, 'entry-directory module');
    }
  }

  const testSet = [...new Set([...testArtifacts, ...closure])].filter((file) => file !== implementation).sort();
  return {
    testArtifacts: [...testArtifacts].sort(),
    implementation,
    testSet,
    entryFiles,
  };
}

/**
 * Hash the declared+closure test set (sorted) plus the exact argv. Every declared test artifact is
 * hashed even when it is not statically imported, and the anchored implementation artifact is excluded,
 * so RED and GREEN must declare identical test artifacts for the hashes to be comparable.
 */
async function computeAssertionHash(
  root: string,
  testCommand: readonly string[],
  testSet: readonly string[],
): Promise<string> {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(testCommand), 'utf8');
  for (const relative of testSet) {
    const absolute = await resolveRegularFile(root, relative);
    if (absolute === null) continue;
    try {
      hash.update(relative, 'utf8');
      hash.update(await fs.readFile(absolute));
    } catch {
      // An unreadable artifact simply does not contribute; the argv itself is still bound.
    }
  }
  return hash.digest('hex');
}

/** Read the raw output the command runner persisted, unwrapping its redacted `{ output }` envelope. */
async function readHarnessOutput(root: string, evidence: CommandEvidence): Promise<string> {
  const absolute = await resolveRegularFile(root, evidence.rawOutputPath);
  if (absolute === null) return '';
  try {
    const text = await fs.readFile(absolute, 'utf8');
    try {
      const parsed = JSON.parse(text) as { output?: unknown };
      return typeof parsed.output === 'string' ? parsed.output : text;
    } catch {
      return text;
    }
  } catch {
    return '';
  }
}

/** Real failure classification from the real command result and its real raw output. */
async function classifyFailure(root: string, evidence: CommandEvidence): Promise<TddFailureClass> {
  if (evidence.observation !== 'observed' || typeof evidence.exitCode !== 'number') return 'unavailable';
  if (evidence.exitCode === 0) return 'none';
  const output = await readHarnessOutput(root, evidence);
  if (INFRASTRUCTURE_OUTPUT_PATTERN.test(output)) return 'infrastructure';
  if (ASSERTION_OUTPUT_PATTERN.test(output)) return 'assertion';
  return 'unknown';
}

/**
 * Run one real RED or GREEN attempt. `input.implementation` is the anchored implementation artifact; the
 * harness never mutates the fixture and the caller owns the fixture state change. Returns the real exit
 * code, the real failure classification, and the declared artifact set; invalid/unanchored input or
 * missing boundaries fail closed with a typed error.
 */
export async function runTddHarness(input: TddHarnessInput, options?: TddHarnessOptions): Promise<TddHarnessResult> {
  validateTddHarnessInput(input);
  assertNotRepositoryTestInvocation(input.testCommand);
  if (!isRecord(options)) {
    throw new CodeHealthError(
      'ARG_INVALID',
      'TDD harness requires injected repository, evidence, and revision boundaries; it never runs implicitly',
    );
  }
  const repositoryRoot = path.resolve(options.repositoryRoot);
  const artifacts = await resolveHarnessArtifacts(repositoryRoot, input);
  const runner = createCodeHealthCommandRunner({
    repositoryRoot,
    rawOutputDir: options.rawOutputDir,
    evidenceStore: options.evidenceStore,
    revisionProvider: options.revisionProvider,
    ...(options.now ? { now: options.now } : {}),
  });
  const assertionHash = await computeAssertionHash(repositoryRoot, input.testCommand, artifacts.testSet);
  const implementationAbsolute = await resolveRegularFile(repositoryRoot, artifacts.implementation);
  if (implementationAbsolute === null) {
    throw new CodeHealthError('EVIDENCE_INVALID', 'TDD harness implementation artifact became unreadable');
  }
  const implementationHash = createHash('sha256')
    .update(await fs.readFile(implementationAbsolute))
    .digest('hex');
  const evidence = await runner.run(input.testCommand[0]!, input.testCommand.slice(1), {
    cwd: options.cwd ?? '.',
    env: options.env ?? {},
    timeoutMs: options.timeoutMs ?? 30_000,
    binding: options.binding,
  });
  const failureClass = await classifyFailure(repositoryRoot, evidence);
  return {
    ...evidence,
    gapId: input.gap.gapId,
    assertionHash,
    implementationHash,
    testArtifacts: artifacts.testArtifacts,
    implementationArtifact: artifacts.implementation,
    toolVersions: { ...evidence.toolVersions, [TDD_FAILURE_CLASS_KEY]: failureClass },
  };
}
