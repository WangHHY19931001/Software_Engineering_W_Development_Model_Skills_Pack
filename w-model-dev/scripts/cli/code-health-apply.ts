#!/usr/bin/env tsx
/**
 * Code-health approved-application executor.
 *
 * Flags:
 *   --candidate <file>   candidate JSON (required)
 *   --approval <file>    human ApprovalDecision JSON (required for patch/commit; the plan itself is
 *                        produced by the pure `applyApproved`)
 *   --root <dir>         explicit repository root (default: cwd)
 *   --mode <mode>        dry-run | patch | commit (alias: apply = commit); default dry-run
 *
 * Guard order is fixed (R7):
 *   1. flag parsing — unknown flag, duplicated value flag, empty/missing value, unknown mode → exit 2
 *      with `ERROR_JSON` on stdout;
 *   2. approval validation — missing / non-human / scope-revision-action-files-symbols mismatch → exit 1
 *      with `HUMAN_APPROVAL_REQUIRED` on stdout;
 *   3. only then may anything be written.
 *
 * Safety: real writes happen only beneath the explicit `--root`; `dry-run` writes nothing; `patch` writes
 * one controlled patch under `<root>/.w-model/code-health/apply/`; `commit` runs `git apply --check` then
 * `git apply` with an argv array (no shell string), reads the real status back, and refuses to claim
 * success when any path outside the exact approved scope changed.
 *
 * Exit codes: 0 proposal/applied, 1 fail-closed validation or write failure, 2 input error.
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  ApplyResult,
  ApprovalDecision,
  CodeHealthCandidate,
  RevisionIdentity,
} from '../logic/code-health-contract.js';
import { applyApproved, CodeHealthError, codeHealthApplyPatchPath } from '../logic/code-health-ledger-logic.js';
import { evaluateTestInventory } from '../logic/code-health-test-logic.js';
import { exitWithError } from '../lib/cli-error.js';
import { createCodeHealthGitRevisionProvider } from '../lib/code-health-revision-provider.js';
import { resolveControlledRelativePath } from '../lib/code-health-file-verifier.js';
import { readJsonOrExit } from '../lib/read-json-or-exit.js';
import { runMain } from '../lib/run-main.js';
import { runSync } from '../lib/run-sync.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';

const VALUE_FLAGS = ['candidate', 'approval', 'root', 'mode', 'inventory'] as const;
type ApplyFlag = (typeof VALUE_FLAGS)[number];
const APPLY_MODES = new Set(['dry-run', 'patch', 'commit']);
const GIT_TIMEOUT_MS = 30_000;
const revisionProvider = createCodeHealthGitRevisionProvider();

class ApplyArgumentError extends Error {}

function parseApplyArgs(argv: readonly string[]): Partial<Record<ApplyFlag, string>> {
  const values: Partial<Record<ApplyFlag, string>> = {};
  for (let index = 0; index < argv.length; index += 1) {
    // eslint-disable-next-line security/detect-object-injection -- index is a loop counter over argv.
    const argument = argv[index]!;
    if (!argument.startsWith('--')) throw new ApplyArgumentError(`unexpected positional argument: ${argument}`);
    const equals = argument.indexOf('=');
    const name = (equals === -1 ? argument.slice(2) : argument.slice(2, equals)) as ApplyFlag;
    if (!(VALUE_FLAGS as readonly string[]).includes(name)) {
      throw new ApplyArgumentError(`unknown flag: ${argument}`);
    }
    let value: string;
    if (equals !== -1) {
      value = argument.slice(equals + 1);
      if (value === '') throw new ApplyArgumentError(`empty value for --${name}`);
    } else {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--')) throw new ApplyArgumentError(`missing value for --${name}`);
      value = next;
      index += 1;
      if (value === '') throw new ApplyArgumentError(`empty value for --${name}`);
    }
    // eslint-disable-next-line security/detect-object-injection -- name is validated against VALUE_FLAGS above.
    if (values[name] !== undefined) throw new ApplyArgumentError(`duplicate flag: --${name}`);
    // eslint-disable-next-line security/detect-object-injection -- name is validated against VALUE_FLAGS above.
    values[name] = value;
  }
  return values;
}

function gitEnvironment(): NodeJS.ProcessEnv {
  const keys = [
    'PATH',
    'PATHEXT',
    'SYSTEMROOT',
    'SYSTEMDRIVE',
    'WINDIR',
    'COMSPEC',
    'TEMP',
    'TMP',
    'HOME',
    'USERPROFILE',
    'HOMEDRIVE',
    'HOMEPATH',
    'APPDATA',
    'LOCALAPPDATA',
    'PROGRAMDATA',
    'LANG',
    'LC_ALL',
    'TERM',
  ] as const;
  const environment: NodeJS.ProcessEnv = {
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_PAGER: 'cat',
  };
  for (const key of keys) {
    // eslint-disable-next-line security/detect-object-injection -- key is a literal member of the allowlist above.
    const value = process.env[key];
    if (typeof value === 'string' && value.length > 0 && !value.includes('\u0000')) {
      // eslint-disable-next-line security/detect-object-injection -- key is a literal member of the allowlist above.
      environment[key] = value;
    }
  }
  return environment;
}

interface GitRun {
  status: number | null;
  stdout: string;
  stderr: string;
}

function git(root: string, args: string[]): GitRun {
  const result = runSync('git', args, { cwd: root, env: gitEnvironment(), timeout: GIT_TIMEOUT_MS });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

/** Build a real `git apply` deletion patch for one repository-relative file. */
function buildDeletionPatch(relativePath: string, content: string): string {
  const header = `diff --git a/${relativePath} b/${relativePath}\ndeleted file mode 100644\n--- a/${relativePath}\n+++ /dev/null\n`;
  if (content === '') return header;
  const finalNewline = content.endsWith('\n');
  const lines = (finalNewline ? content.slice(0, -1) : content).split('\n');
  const range = lines.length === 1 ? '@@ -1 +0,0 @@' : `@@ -1,${lines.length} +0,0 @@`;
  const body = lines.map((line) => `-${line}`).join('\n');
  return `${header}${range}\n${body}${finalNewline ? '' : '\n\\ No newline at end of file'}\n`;
}

async function buildPatchBytes(root: string, candidate: CodeHealthCandidate): Promise<Uint8Array> {
  const chunks: string[] = [];
  const seen = new Set<string>();
  for (const relativePath of candidate.changeScope.files) {
    if (seen.has(relativePath)) continue;
    seen.add(relativePath);
    const resolution = resolveControlledRelativePath(root, relativePath);
    if (!resolution.ok || resolution.absolutePath === undefined) {
      throw new CodeHealthError('STRUCTURE_INVALID', `approved scope path is unsafe: ${relativePath}`);
    }
    let stats;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- absolutePath is bounded by resolveControlledRelativePath.
      stats = await fs.lstat(resolution.absolutePath);
    } catch {
      throw new CodeHealthError('EVIDENCE_INVALID', `approved scope file is missing: ${relativePath}`);
    }
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new CodeHealthError(
        'EVIDENCE_INVALID',
        `approved scope is not a regular non-symlink file: ${relativePath}`,
      );
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- absolutePath is bounded by resolveControlledRelativePath.
    const content = await fs.readFile(resolution.absolutePath, 'utf8');
    chunks.push(buildDeletionPatch(relativePath, content));
  }
  return new TextEncoder().encode(chunks.join(''));
}

/** Parse `git status --porcelain=v1 -z` output into repository-relative POSIX paths. */
function parseStatus(stdout: string): string[] {
  const paths = new Set<string>();
  for (const entry of stdout.split('\u0000')) {
    if (entry.length <= 3) continue;
    const file = entry.slice(3).replace(/\\/g, '/');
    if (file.length > 0) paths.add(file);
  }
  return [...paths].sort();
}

async function writePatch(root: string, patchRelativePath: string, bytes: Uint8Array): Promise<string> {
  const resolution = resolveControlledRelativePath(root, patchRelativePath);
  if (!resolution.ok || resolution.absolutePath === undefined) {
    throw new CodeHealthError('STRUCTURE_INVALID', 'controlled patch path escapes the repository root');
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- absolutePath is bounded by resolveControlledRelativePath.
  await fs.mkdir(path.dirname(resolution.absolutePath), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- absolutePath is bounded by resolveControlledRelativePath.
  await fs.writeFile(resolution.absolutePath, bytes);
  return createHash('sha256').update(bytes).digest('hex');
}

function blockResult(
  mode: 'dry-run' | 'patch' | 'commit',
  reason: string,
  errorCode: CodeHealthError['code'],
): ApplyResult {
  return {
    kind: 'blocked',
    applied: false,
    errorCode,
    mode,
    patchPath: null,
    appliedFiles: [],
    unrelatedFiles: [],
    rollback: null,
    reason,
  };
}

function emit(exitCode: 0 | 1, payload: object): void {
  console.log(`APPLY_JSON ${JSON.stringify({ type: 'code-health-apply', exitCode, ...payload })}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sortedEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.join('\u0000') === b.join('\u0000');
}

function sameRevisionValue(left: unknown, right: RevisionIdentity): boolean {
  return (
    isRecord(left) &&
    left.commitSha === right.commitSha &&
    left.treeSha === right.treeSha &&
    left.sourceBundleSha256 === right.sourceBundleSha256
  );
}

/**
 * Refuse a `delete-test` application unless the supplied removal inventory authorizes it: the
 * inventory must pass schema + ledger-anchored review, target the same candidate and revision, and
 * name exactly the approved test files. Returns blocking reasons; empty means the inventory authorizes.
 */
async function deleteTestGuardViolations(
  candidate: CodeHealthCandidate,
  inventoryFlag: string | undefined,
): Promise<string[]> {
  if (inventoryFlag === undefined) {
    return ['a delete-test candidate requires --inventory <removal-proof>'];
  }
  const document = await readJsonOrExit<unknown>(inventoryFlag);
  if (!isRecord(document)) return ['the removal inventory must be an object'];
  const inventory = isRecord(document.inventory) ? document.inventory : document;
  const ledger = isRecord(document.ledger) ? document.ledger : undefined;
  const violations: string[] = [];
  const schema = validateBySchema('code-health-test-inventory', inventory);
  if (!schema.valid) violations.push(...schema.errorMessages.map((message) => `[schema] ${message}`));
  violations.push(...evaluateTestInventory({ inventory, ledger }).violations);

  if (typeof inventory.candidateId !== 'string' || inventory.candidateId !== candidate.candidateId) {
    violations.push('inventory candidateId does not match the delete-test candidate');
  }
  if (!sameRevisionValue(inventory.revision, candidate.revision)) {
    violations.push('inventory revision is stale for the delete-test candidate');
  }
  const tests = Array.isArray(inventory.tests) ? inventory.tests : [];
  const removalProof = isRecord(inventory.removalProof) ? inventory.removalProof : null;
  const removalCandidate =
    removalProof && typeof removalProof.candidateTestId === 'string'
      ? tests.find((entry) => isRecord(entry) && entry.testId === removalProof.candidateTestId)
      : undefined;
  const expectedFiles =
    isRecord(removalCandidate) && typeof removalCandidate.file === 'string' ? [removalCandidate.file] : [];
  const scopeFiles = Array.isArray(candidate.changeScope?.files) ? candidate.changeScope.files : [];
  if (expectedFiles.length === 0 || !sortedEqual(expectedFiles, scopeFiles)) {
    violations.push('delete-test scope is not exactly the inventory removal candidate file');
  }
  return violations;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let parsed: Partial<Record<ApplyFlag, string>>;
  try {
    parsed = parseApplyArgs(argv);
  } catch (error) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: error instanceof Error ? error.message : String(error),
      detail:
        'usage: code-health-apply.ts --candidate <file> [--approval <file>] [--root <dir>] [--mode dry-run|patch|commit]',
      exitCode: 2,
    });
    return;
  }
  if (parsed.candidate === undefined) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: 'missing required flag: --candidate',
      exitCode: 2,
    });
    return;
  }
  const rawMode = parsed.mode ?? 'dry-run';
  const mode: 'dry-run' | 'patch' | 'commit' =
    rawMode === 'apply' ? 'commit' : (rawMode as 'dry-run' | 'patch' | 'commit');
  if (!APPLY_MODES.has(mode)) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: `unknown --mode value: ${rawMode}`,
      detail: 'allowed modes: dry-run | patch | commit (alias: apply)',
      exitCode: 2,
    });
    return;
  }

  const root = path.resolve(parsed.root ?? process.cwd());
  const candidate = await readJsonOrExit<CodeHealthCandidate>(parsed.candidate);
  const approval = parsed.approval === undefined ? undefined : await readJsonOrExit<ApprovalDecision>(parsed.approval);

  // Phase 3 (Task 5): a test deletion is only reachable with a validated removal inventory. The
  // inventory must be anchored to the ledger, prove an item-wise equivalent survivor, and explain
  // every measured fact; anything else is refused before a single write.
  if (candidate?.action === 'delete-test') {
    const guardViolations = await deleteTestGuardViolations(candidate, parsed.inventory);
    if (guardViolations.length > 0) {
      for (const violation of guardViolations) console.error(`✗ [EVIDENCE_INVALID] ${violation}`);
      const reason = `delete-test requires a validated removal inventory: ${guardViolations.join('; ')}`;
      emit(1, blockResult(mode, reason, 'EVIDENCE_INVALID'));
      process.exitCode = 1;
      return;
    }
  }

  const revision = await revisionProvider.current(root);
  if (revision === null) {
    console.log('HUMAN_APPROVAL_REQUIRED: repository revision is unavailable');
    emit(1, blockResult(mode, 'repository revision is unavailable', 'REVISION_MISMATCH'));
    process.exitCode = 1;
    return;
  }

  let plan: ApplyResult;
  try {
    plan = await applyApproved({
      candidate,
      approval: approval as ApprovalDecision,
      mode,
      repositoryRoot: root,
      currentRevision: revision as RevisionIdentity,
    });
  } catch (error) {
    const typed = error instanceof CodeHealthError ? error : null;
    const reason = error instanceof Error ? error.message : String(error);
    if (/HUMAN_APPROVAL_REQUIRED/.test(reason)) console.log(reason);
    else console.error(`✗ [${typed?.code ?? 'EVIDENCE_INVALID'}] ${reason}`);
    emit(1, blockResult(mode, reason, typed?.code ?? 'EVIDENCE_INVALID'));
    process.exitCode = 1;
    return;
  }
  if (plan.kind !== 'patch-proposal') {
    emit(1, blockResult(mode, 'approved application did not resolve to a proposal', 'EVIDENCE_INVALID'));
    process.exitCode = 1;
    return;
  }

  if (mode === 'dry-run') {
    emit(0, {
      mode,
      applied: false,
      patchPath: plan.patchPath,
      appliedFiles: [],
      unrelatedFiles: [],
      rollback: plan.rollback,
    });
    return;
  }

  let patchBytes: Uint8Array;
  try {
    patchBytes = await buildPatchBytes(root, candidate);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const typed = error instanceof CodeHealthError ? error : null;
    console.error(`✗ [${typed?.code ?? 'EVIDENCE_INVALID'}] ${reason}`);
    emit(1, blockResult(mode, reason, typed?.code ?? 'EVIDENCE_INVALID'));
    process.exitCode = 1;
    return;
  }
  const patchPath = codeHealthApplyPatchPath(candidate.candidateId);
  const patchSha256 = await writePatch(root, patchPath, patchBytes);
  const rollback = { ...plan.rollback, patchSha256 };

  if (mode === 'patch') {
    emit(0, { mode, applied: false, patchPath, appliedFiles: [], unrelatedFiles: [], rollback });
    return;
  }

  // commit: real `git apply --check` then `git apply`, then a real scope read-back.
  const before = parseStatus(git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']).stdout);
  const check = git(root, ['apply', '--check', path.isAbsolute(patchPath) ? patchPath : path.join(root, patchPath)]);
  if (check.status !== 0) {
    const reason = `git apply --check failed: ${check.stderr.trim() || check.stdout.trim()}`;
    console.error(`✗ [EVIDENCE_INVALID] ${reason}`);
    emit(1, blockResult(mode, reason, 'EVIDENCE_INVALID'));
    process.exitCode = 1;
    return;
  }
  const applied = git(root, ['apply', path.isAbsolute(patchPath) ? patchPath : path.join(root, patchPath)]);
  if (applied.status !== 0) {
    const reason = `git apply failed: ${applied.stderr.trim() || applied.stdout.trim()}`;
    console.error(`✗ [EVIDENCE_INVALID] ${reason}`);
    emit(1, blockResult(mode, reason, 'EVIDENCE_INVALID'));
    process.exitCode = 1;
    return;
  }
  const after = parseStatus(git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']).stdout);
  const beforeSet = new Set(before);
  const changed = after.filter((entry) => !beforeSet.has(entry));
  const scope = new Set(candidate.changeScope.files);
  const unrelatedFiles = changed.filter((entry) => !scope.has(entry));
  const appliedFiles = changed.filter((entry) => scope.has(entry));
  const exactScope =
    unrelatedFiles.length === 0 &&
    appliedFiles.length === scope.size &&
    candidate.changeScope.files.every((file) => appliedFiles.includes(file));
  if (!exactScope) {
    git(root, ['apply', '-R', path.isAbsolute(patchPath) ? patchPath : path.join(root, patchPath)]);
    const reason = `commit touched scope ${JSON.stringify(appliedFiles)} with unrelated ${JSON.stringify(unrelatedFiles)}`;
    console.error(`✗ [SCOPE_MISMATCH] ${reason}`);
    emit(1, blockResult(mode, reason, 'SCOPE_MISMATCH'));
    process.exitCode = 1;
    return;
  }

  emit(0, { mode, applied: true, patchPath, appliedFiles, unrelatedFiles: [], rollback });
}

const entryArg = process.argv[1];
const isMain = entryArg !== undefined && fileURLToPath(import.meta.url) === path.resolve(entryArg);
if (isMain) {
  runMain(main);
}
