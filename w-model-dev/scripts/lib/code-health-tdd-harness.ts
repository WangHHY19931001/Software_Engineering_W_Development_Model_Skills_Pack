/* eslint-disable security/detect-non-literal-fs-filename -- Every path is resolved beneath the explicit fixture repository root through resolveControlledRelativePath before it is read. */
/**
 * Real TDD RED/GREEN harness (IO boundary).
 *
 * Running a test command is a child-process boundary, so the real harness lives in `lib/` and reuses
 * `createCodeHealthCommandRunner`: `shell: false`, exact argv (never a shell string), a real exit code,
 * and a mandatory per-run `EvidenceBinding`. The pure Phase 2 matrix logic stays in
 * `logic/code-health-gap-logic.ts`.
 *
 * Every result additionally binds:
 *   - `gapId` and `assertionHash` (the exact argv plus the content of every file argument, so weakening
 *     or deleting the assertion changes the hash and cannot produce a matching GREEN);
 *   - `implementationHash` (the content of the declared implementation artifact, or `null` for RED);
 *   - `toolVersions[codeHealthTddFailureClass]`, the real failure classification derived from the raw
 *     child output. A non-assertion failure (module missing, syntax error, command not found, ...) is
 *     preserved faithfully with its real exit code but is classified as not RED, so
 *     `validateRedGreenEvidence` rejects it instead of counting an unrelated failure as RED.
 */

import { createHash } from 'node:crypto';
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
import { resolveControlledRelativePath } from './code-health-file-verifier.js';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

/**
 * Hash the exact assertion: the full argv plus the content of every file argument. Changing, deleting,
 * or `.skip`-ing the assertion changes the hash, so a weakened GREEN cannot be paired with the RED.
 */
async function computeAssertionHash(root: string, testCommand: readonly string[]): Promise<string> {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(testCommand), 'utf8');
  for (const argument of testCommand) {
    if (argument.startsWith('-')) continue;
    const normalized = argument.replace(/\\/g, '/');
    const absolute = await resolveRegularFile(root, normalized);
    if (absolute === null) continue;
    try {
      const bytes = await fs.readFile(absolute);
      hash.update(normalized, 'utf8');
      hash.update(bytes);
    } catch {
      // An unreadable file argument simply does not contribute; the argv itself is still bound.
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

async function hashImplementation(root: string, implementation: string | null): Promise<string | null> {
  if (implementation === null) return null;
  if (typeof implementation !== 'string' || implementation.trim() === '') {
    throw new CodeHealthError('ARG_INVALID', 'TDD harness implementation must be null or a repository-relative file');
  }
  const absolute = await resolveRegularFile(root, implementation.replace(/\\/g, '/'));
  if (absolute === null) {
    throw new CodeHealthError(
      'EVIDENCE_INVALID',
      `TDD harness implementation is not a readable repository-relative file: ${implementation}`,
    );
  }
  return createHash('sha256')
    .update(await fs.readFile(absolute))
    .digest('hex');
}

/**
 * Run one real RED or GREEN attempt. `input.implementation` is the repository-relative implementation
 * artifact (or `null` for RED); the harness reads it to record `implementationHash` but never mutates the
 * fixture — the caller owns the fixture state change. Returns the real exit code and the real failure
 * classification; invalid input or missing boundaries fail closed with a typed error.
 */
export async function runTddHarness(input: TddHarnessInput, options?: TddHarnessOptions): Promise<TddHarnessResult> {
  validateTddHarnessInput(input);
  if (!isRecord(options)) {
    throw new CodeHealthError(
      'ARG_INVALID',
      'TDD harness requires injected repository, evidence, and revision boundaries; it never runs implicitly',
    );
  }
  const repositoryRoot = path.resolve(options.repositoryRoot);
  const runner = createCodeHealthCommandRunner({
    repositoryRoot,
    rawOutputDir: options.rawOutputDir,
    evidenceStore: options.evidenceStore,
    revisionProvider: options.revisionProvider,
    ...(options.now ? { now: options.now } : {}),
  });
  const assertionHash = await computeAssertionHash(repositoryRoot, input.testCommand);
  const implementationHash = await hashImplementation(repositoryRoot, input.implementation);
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
    toolVersions: { ...evidence.toolVersions, [TDD_FAILURE_CLASS_KEY]: failureClass },
  };
}
