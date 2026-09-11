#!/usr/bin/env tsx
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- Guard inputs are resolved beneath an explicit caller-owned project root; flag names are fixed literal members of the CLI table. */
/**
 * Phase 3 test inventory CLI (protected inventory review + guarded deletion).
 *
 * Modes:
 *   --inventory <file> [--ledger <file>] [--project <dir>] [--candidate <file>] [--validate]
 *     Review a `code-health-test-inventory` document. Structural completeness, default-deny
 *     protection, computed equivalence, and deletion-fact shape are always checked. A proposed
 *     removal additionally requires an explicit `--ledger` authority, an explicit `--project` to
 *     verify the stored raw outputs and the tracked `.code-health-governance.json`, and an explicit
 *     `--candidate` to bind the evidence; without them the removal is refused.
 *
 *   --guard <file> --project <dir> --ledger <file>
 *     The only path that may delete a test: read the tracked repo-owned suite argv from
 *     `.code-health-suite.json`, authorize the deletion against the ledger + stored evidence +
 *     tracked governance manifest, run the real pre-deletion suite, delete the exact approved test
 *     only through `cli/code-health-apply.ts`, run the real post-change suite, and prove with
 *     identity-based evidence that exactly the authorized test identity disappeared and every other
 *     identity is unchanged. A no-op command or a pre-placed coverage artifact cannot satisfy this.
 *
 * Exit codes: 0 pass, 1 validation/guard failure, 2 input error.
 */

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  ApprovalDecision,
  CodeHealthCandidate,
  CommandEvidence,
  EvidenceBinding,
  EvidenceStore,
  RevisionIdentity,
} from '../logic/code-health-contract.js';
import { evaluateTestInventory, type ExpectedGovernanceFacts } from '../logic/code-health-test-logic.js';
import { exitWithError } from '../lib/cli-error.js';
import { createCodeHealthCommandRunner } from '../lib/code-health-command.js';
import {
  parseSuiteFactsFromRawOutput,
  readTrackedGovernanceManifest,
  readTrackedJson,
  readTrackedSuiteManifest,
  toTrackedRelativePath,
  verifyDeletionEvidence,
  type SuiteFacts,
} from '../lib/code-health-deletion-authority.js';
import { createCodeHealthEvidenceStore } from '../lib/code-health-evidence-store.js';
import { resolveControlledRelativePath } from '../lib/code-health-file-verifier.js';
import { createCodeHealthGitRevisionProvider } from '../lib/code-health-revision-provider.js';
import { readJsonOrExit } from '../lib/read-json-or-exit.js';
import { runMain } from '../lib/run-main.js';
import { runSync } from '../lib/run-sync.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';

const VALUE_FLAGS = ['inventory', 'ledger', 'project', 'candidate', 'guard', 'suite-manifest'] as const;
const BOOLEAN_FLAGS = ['validate'] as const;
const DEFAULT_SUITE_MANIFEST = '.code-health-suite.json';
const GUARD_RAW_OUTPUT_DIR = '.code-health-raw';
const DEFAULT_TIMEOUT_MS = 60_000;
const HEX64_PATTERN = /^[0-9a-f]{64}$/;

class TestInventoryArgumentError extends Error {}

interface ParsedArgs {
  inventory?: string;
  ledger?: string;
  project?: string;
  candidate?: string;
  guard?: string;
  suiteManifest?: string;
  validate: boolean;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const values: Record<string, string> = {};
  const flags: Record<string, boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (!argument.startsWith('--')) throw new TestInventoryArgumentError(`unexpected positional argument: ${argument}`);
    const equals = argument.indexOf('=');
    const name = equals === -1 ? argument.slice(2) : argument.slice(2, equals);
    if ((BOOLEAN_FLAGS as readonly string[]).includes(name)) {
      if (equals !== -1) throw new TestInventoryArgumentError(`flag --${name} does not take a value`);
      if (flags[name] === true) throw new TestInventoryArgumentError(`duplicate flag: --${name}`);
      flags[name] = true;
      continue;
    }
    if (!(VALUE_FLAGS as readonly string[]).includes(name))
      throw new TestInventoryArgumentError(`unknown flag: ${argument}`);
    let value: string;
    if (equals !== -1) {
      value = argument.slice(equals + 1);
    } else {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--'))
        throw new TestInventoryArgumentError(`missing value for --${name}`);
      value = next;
      index += 1;
    }
    if (value === '') throw new TestInventoryArgumentError(`missing value for --${name}`);
    if (values[name] !== undefined) throw new TestInventoryArgumentError(`duplicate flag: --${name}`);
    values[name] = value;
  }
  if (values.guard === undefined && values.inventory === undefined) {
    throw new TestInventoryArgumentError('missing required flag: --inventory <file> (or --guard <file>)');
  }
  const result: ParsedArgs = { validate: flags.validate === true };
  for (const key of ['inventory', 'ledger', 'project', 'candidate', 'guard', 'suiteManifest'] as const) {
    const rawKey = key === 'suiteManifest' ? 'suite-manifest' : key;
    if (values[rawKey] !== undefined) result[key] = values[rawKey];
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface InventoryReviewDocument {
  inventory: unknown;
  embeddedLedger: unknown;
}

/** Split a flat inventory from a `{ inventory, ledger }` wrapper; an embedded ledger is recorded so it can be refused. */
function resolveReviewDocument(document: unknown): InventoryReviewDocument | null {
  if (!isRecord(document)) return null;
  if (isRecord(document.inventory)) {
    return { inventory: document.inventory, embeddedLedger: document.ledger };
  }
  return { inventory: document, embeddedLedger: undefined };
}

function emit(payload: Record<string, unknown>): void {
  console.log(`TEST_INVENTORY_JSON ${JSON.stringify(payload)}`);
}

function schemaViolations(inventory: unknown): string[] {
  const result = validateBySchema('code-health-test-inventory', inventory);
  return result.valid ? [] : result.errorMessages.map((message) => `[schema] ${message}`);
}

async function runValidate(parsed: ParsedArgs): Promise<void> {
  const document = await readJsonOrExit<unknown>(parsed.inventory as string);
  const resolved = resolveReviewDocument(document);
  if (resolved === null) {
    exitWithError({
      category: 'STRUCTURE_INVALID',
      rule: 'P0-2',
      message: 'test inventory 输入必须是对象',
      file: path.resolve(parsed.inventory as string),
      exitCode: 2,
    });
    return;
  }
  const inventory = resolved.inventory;
  const violations: string[] = [...schemaViolations(inventory)];
  const removalProposed = isRecord(inventory) && inventory.removalProof !== undefined;

  if (resolved.embeddedLedger !== undefined) {
    violations.push('an embedded inventory ledger is not an accepted authority; supply a tracked --ledger file');
  }

  if (removalProposed) {
    if (parsed.ledger === undefined) violations.push('removal authorization requires an explicit --ledger <file>');
    if (parsed.project === undefined) {
      violations.push('removal authorization requires --project <dir> to verify stored evidence and repo-owned facts');
    }
    if (parsed.candidate === undefined) {
      violations.push('removal authorization requires an explicit --candidate <file> to bind the stored evidence');
    }
    if (
      parsed.ledger !== undefined &&
      parsed.project !== undefined &&
      parsed.candidate !== undefined &&
      !violations.some((entry) => /embedded inventory ledger/.test(entry))
    ) {
      const projectRoot = path.resolve(parsed.project);
      const ledgerRelative = toTrackedRelativePath(projectRoot, parsed.ledger);
      if (ledgerRelative === null) {
        violations.push('the --ledger authority must be a repository-relative tracked file beneath --project');
      } else {
        const candidate = await readJsonOrExit<CodeHealthCandidate>(parsed.candidate);
        const manifest = await readTrackedGovernanceManifest(projectRoot);
        violations.push(...manifest.violations);
        const ledgerRead = await readTrackedJson(projectRoot, ledgerRelative);
        violations.push(...ledgerRead.violations);
        if (ledgerRead.value === undefined) {
          violations.push('the --ledger authority must be a tracked project file recorded at HEAD');
        } else {
          const evidenceStore: EvidenceStore = createCodeHealthEvidenceStore({
            repositoryRoot: projectRoot,
            rawOutputRoot: '.w-model/code-health/raw',
          });
          const review = evaluateTestInventory({ inventory, ledger: ledgerRead.value }, manifest.facts ?? {});
          const authority = await verifyDeletionEvidence({
            repositoryRoot: projectRoot,
            candidate,
            inventory,
            ledger: ledgerRead.value,
            review,
            evidenceStore,
            revisionProvider: createCodeHealthGitRevisionProvider(),
          });
          violations.push(...authority.violations);
        }
      }
    }
  } else {
    // Structural-only review: no deletion is proposed, so no project authority is needed.
    violations.push(...evaluateTestInventory({ inventory }).violations);
  }

  if (violations.length > 0) {
    for (const violation of violations) console.log(`✗ [test-inventory] ${violation}`);
    emit({
      type: 'code-health-tests',
      exitCode: 1,
      inventoryId: isRecord(inventory) ? inventory.inventoryId : null,
      violations,
    });
    process.exitCode = 1;
    return;
  }
  console.log('✓ protected test inventory 校验通过（删除必须有 ledger 锚定、真实存储证据与 repo-owned facts）');
  emit({ type: 'code-health-tests', exitCode: 0, passed: true, violations: [] });
  process.exitCode = 0;
}

// -------------------- guarded real pre/post deletion --------------------

interface GuardDocument extends Record<string, unknown> {
  inventory: unknown;
  candidate: CodeHealthCandidate;
  approval: ApprovalDecision;
  suiteManifest?: string;
}

function bindingFor(candidate: CodeHealthCandidate, revision: RevisionIdentity): EvidenceBinding {
  return {
    candidate: {
      candidateId: candidate.candidateId,
      phase: candidate.phase,
      action: candidate.action,
      files: candidate.changeScope.files,
      symbols: candidate.changeScope.symbols,
      scopeHash: candidate.changeScope.scopeHash,
    },
    revision,
    rawOutputPath: candidate.changeScope.files[0] ?? '.',
    rawOutputSha256: '0'.repeat(64),
  };
}

async function fileState(
  root: string,
  relativePath: string,
): Promise<{ exists: boolean; sha256: string | null; mtimeMs: number | null }> {
  const resolution = resolveControlledRelativePath(root, relativePath);
  if (!resolution.ok || resolution.absolutePath === undefined) return { exists: false, sha256: null, mtimeMs: null };
  try {
    const bytes = await fs.readFile(resolution.absolutePath);
    const stats = await fs.stat(resolution.absolutePath);
    return { exists: true, sha256: createHash('sha256').update(bytes).digest('hex'), mtimeMs: stats.mtimeMs };
  } catch {
    return { exists: false, sha256: null, mtimeMs: null };
  }
}

function guardSuiteExit(evidence: CommandEvidence, label: string): string[] {
  if (evidence.observation !== 'observed' || evidence.exitCode !== 0) {
    return [`${label} did not complete with a real zero exit code (observation=${evidence.observation})`];
  }
  return [];
}

async function readSuiteFacts(
  root: string,
  evidence: CommandEvidence,
): Promise<{ facts: SuiteFacts; violations: string[] }> {
  const resolution = resolveControlledRelativePath(root, evidence.rawOutputPath);
  if (!resolution.ok || resolution.absolutePath === undefined) {
    return { facts: {}, violations: [`suite raw output path is not controlled: ${evidence.rawOutputPath}`] };
  }
  let raw: string;
  try {
    raw = await fs.readFile(resolution.absolutePath, 'utf8');
  } catch {
    return { facts: {}, violations: ['suite raw output could not be read back from the controlled run'] };
  }
  return parseSuiteFactsFromRawOutput(raw);
}

async function runGuardedDeletion(
  parsed: ParsedArgs,
  guard: GuardDocument,
): Promise<{ code: 0 | 1; violations: string[]; payload: object }> {
  const violations: string[] = [];
  if (parsed.project === undefined) {
    return { code: 1, violations: ['--guard requires an explicit --project <dir>'], payload: { exitCode: 1 } };
  }
  if (parsed.ledger === undefined) {
    return {
      code: 1,
      violations: ['--guard requires an explicit --ledger <file> authority'],
      payload: { exitCode: 1 },
    };
  }
  if (isRecord(guard.ledger)) {
    return {
      code: 1,
      violations: ['an embedded guard ledger is not an accepted authority; supply a tracked --ledger file'],
      payload: { exitCode: 1 },
    };
  }
  const root = path.resolve(parsed.project);
  const inventory = guard.inventory;
  if (!isRecord(inventory))
    return { code: 1, violations: ['guard requires an inventory object'], payload: { exitCode: 1 } };

  const schema = validateBySchema('code-health-test-inventory', inventory);
  if (!schema.valid) violations.push(...schema.errorMessages.map((message) => `[schema] ${message}`));
  const ledgerRelative = toTrackedRelativePath(root, parsed.ledger);
  if (ledgerRelative === null) {
    return {
      code: 1,
      violations: ['the --ledger authority must be a repository-relative tracked file beneath --project'],
      payload: { exitCode: 1 },
    };
  }
  const suiteManifestPath = guard.suiteManifest ?? parsed.suiteManifest ?? DEFAULT_SUITE_MANIFEST;
  const suite = await readTrackedSuiteManifest(root, suiteManifestPath);
  violations.push(...suite.violations);
  const manifest = await readTrackedGovernanceManifest(root);
  violations.push(...manifest.violations);

  const coverage = isRecord(inventory.coverageProvenance) ? inventory.coverageProvenance : {};
  const coveragePath = typeof coverage.path === 'string' ? coverage.path : null;
  const coverageSha = typeof coverage.sha256 === 'string' ? coverage.sha256 : null;
  if (coveragePath === null || coverageSha === null || !HEX64_PATTERN.test(coverageSha)) {
    violations.push('guard requires a controlled coverage provenance path and SHA-256');
  }

  const revisionProvider = createCodeHealthGitRevisionProvider();
  const evidenceStore: EvidenceStore = createCodeHealthEvidenceStore({
    repositoryRoot: root,
    rawOutputRoot: GUARD_RAW_OUTPUT_DIR,
  });
  const ledgerRead = await readTrackedJson(root, ledgerRelative);
  violations.push(...ledgerRead.violations);
  if (ledgerRead.value === undefined) {
    return {
      code: 1,
      violations: [...violations, 'the --ledger authority must be a tracked project file recorded at HEAD'],
      payload: { exitCode: 1 },
    };
  }
  const review = evaluateTestInventory({ inventory, ledger: ledgerRead.value }, manifest.facts ?? {});
  const authority = await verifyDeletionEvidence({
    repositoryRoot: root,
    candidate: guard.candidate,
    inventory,
    ledger: ledgerRead.value,
    review,
    evidenceStore,
    revisionProvider,
  });
  violations.push(...authority.violations);
  const liveRevision = authority.liveRevision;
  if (liveRevision === null) {
    return { code: 1, violations, payload: { exitCode: 1, violations } };
  }
  if (violations.length > 0) {
    // Authorization is refused before any suite runs or any write.
    return {
      code: 1,
      violations,
      payload: { type: 'code-health-tests-guard', exitCode: 1, applied: false, violations },
    };
  }

  const tests = Array.isArray(inventory.tests) ? inventory.tests : [];
  const proof = isRecord(inventory.removalProof) ? inventory.removalProof : null;
  const removalCandidate =
    proof && typeof proof.candidateTestId === 'string'
      ? tests.find((entry) => isRecord(entry) && entry.testId === proof.candidateTestId)
      : undefined;
  const removedIdentity =
    isRecord(removalCandidate) && typeof removalCandidate.file === 'string' ? removalCandidate.file : null;
  if (removedIdentity === null) {
    return { code: 1, violations: ['guard could not resolve the authorized test identity'], payload: { exitCode: 1 } };
  }

  const runner = createCodeHealthCommandRunner({
    repositoryRoot: root,
    rawOutputDir: GUARD_RAW_OUTPUT_DIR,
    evidenceStore,
    revisionProvider,
  });
  const binding = bindingFor(guard.candidate, liveRevision);
  const timeoutMs = DEFAULT_TIMEOUT_MS;

  // Coverage production proof: capture the pre-run state so a pre-placed artifact cannot pass.
  const coverageBefore =
    coveragePath === null ? { exists: false, sha256: null, mtimeMs: null } : await fileState(root, coveragePath);

  const pre = await runner.run(suite.command![0]!, suite.command!.slice(1), { cwd: root, env: {}, timeoutMs, binding });
  violations.push(...guardSuiteExit(pre, 'pre-deletion suite'));
  const preFacts = await readSuiteFacts(root, pre);
  violations.push(...preFacts.violations);
  const preIdentities = Array.isArray(preFacts.facts.identities) ? preFacts.facts.identities : [];
  if (!preIdentities.includes(removedIdentity)) {
    violations.push(`pre-deletion suite did not exercise the authorized test identity ${removedIdentity}`);
  }
  if (typeof preFacts.facts.testCount === 'number' && preFacts.facts.testCount !== preIdentities.length) {
    violations.push('pre-deletion suite testCount does not match its reported identities');
  }
  if (violations.length > 0) {
    return {
      code: 1,
      violations,
      payload: { type: 'code-health-tests-guard', exitCode: 1, applied: false, ranPreSuite: true, violations },
    };
  }

  const applyResult = await runApplyGate(parsed, guard, root);
  violations.push(...applyResult.violations);
  let applied = applyResult.applied;
  let rolledBack = false;
  const postProofStart = violations.length;

  const post = await runner.run(suite.command![0]!, suite.command!.slice(1), {
    cwd: root,
    env: {},
    timeoutMs,
    binding,
  });
  violations.push(...guardSuiteExit(post, 'post-change suite'));
  const postFacts = await readSuiteFacts(root, post);
  violations.push(...postFacts.violations);
  const postIdentities = Array.isArray(postFacts.facts.identities) ? postFacts.facts.identities : [];
  if (postIdentities.includes(removedIdentity)) {
    violations.push(`post-change suite still reports the removed test identity ${removedIdentity}`);
  }
  const expectedRemaining = preIdentities.filter((entry) => entry !== removedIdentity).sort();
  const observedRemaining = [...postIdentities].sort();
  if (expectedRemaining.join('\u0000') !== observedRemaining.join('\u0000')) {
    violations.push('post-change suite changed a test identity other than the authorized removal');
  }
  if (
    typeof preFacts.facts.testCount === 'number' &&
    typeof postFacts.facts.testCount === 'number' &&
    postFacts.facts.testCount !== preFacts.facts.testCount - 1
  ) {
    violations.push('the real pre/post suites did not observe exactly one removed test');
  }
  if (typeof postFacts.facts.testCount === 'number' && postFacts.facts.testCount !== postIdentities.length) {
    violations.push('post-change suite testCount does not match its reported identities');
  }

  // Coverage must be produced by a controlled run: the declared hash is present after the run AND
  // the artifact's bytes/mtime changed relative to the pre-run snapshot, so a pre-placed file that
  // merely happens to carry the declared hash cannot satisfy this.
  if (coveragePath !== null && coverageSha !== null) {
    const coverageAfter = await fileState(root, coveragePath);
    if (!coverageAfter.exists || coverageAfter.sha256 !== coverageSha) {
      violations.push('coverage artifact does not match the declared source-bound SHA-256 after the run');
    }
    const unchanged =
      coverageBefore.exists &&
      coverageAfter.exists &&
      coverageBefore.sha256 === coverageAfter.sha256 &&
      coverageBefore.mtimeMs === coverageAfter.mtimeMs;
    if (unchanged) {
      violations.push('coverage artifact was not produced by the controlled run (bytes and mtime unchanged)');
    }
  }

  // FIX-B: the deletion is irreversible only if every final proof passes. If any post-deletion proof
  // fails, roll the exact approved deletion back before exiting 1 so a failed verification never
  // leaves the tree modified.
  if (violations.length > postProofStart && applied) {
    const rollbackViolations = rollbackAppliedDeletion(root, guard.candidate.candidateId);
    violations.push(...rollbackViolations);
    if (rollbackViolations.length === 0) {
      applied = false;
      rolledBack = true;
    } else {
      violations.push('the failed deletion could not be rolled back; the tree may be left modified');
    }
  }

  const payload = {
    type: 'code-health-tests-guard',
    exitCode: violations.length === 0 ? 0 : 1,
    applied,
    rolledBack,
    removedIdentity,
    removedIdentityPresentPre: preIdentities.includes(removedIdentity),
    removedIdentityAbsentPost: !postIdentities.includes(removedIdentity),
    preTestCount: preFacts.facts.testCount ?? null,
    postTestCount: postFacts.facts.testCount ?? null,
    violations,
  };
  return { code: violations.length === 0 ? 0 : 1, violations, payload };
}

/** Invoke the real Task 3 apply CLI with the inventory + ledger authority; never build a second deletion path. */
async function runApplyGate(
  parsed: ParsedArgs,
  guard: GuardDocument,
  root: string,
): Promise<{ violations: string[]; applied: boolean }> {
  const applyCli = path.join(path.dirname(fileURLToPath(import.meta.url)), 'code-health-apply.ts');
  const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
  const workDir = await fs.mkdtemp(path.join(process.env.TEMP ?? process.cwd(), 'code-health-guard-'));
  try {
    const candidatePath = path.join(workDir, 'candidate.json');
    const approvalPath = path.join(workDir, 'approval.json');
    const inventoryPath = path.join(workDir, 'inventory.json');
    await fs.writeFile(candidatePath, `${JSON.stringify(guard.candidate, null, 2)}\n`, 'utf8');
    await fs.writeFile(approvalPath, `${JSON.stringify(guard.approval, null, 2)}\n`, 'utf8');
    await fs.writeFile(inventoryPath, `${JSON.stringify({ inventory: guard.inventory }, null, 2)}\n`, 'utf8');
    const result = runSync(
      process.execPath,
      [
        tsxCli,
        applyCli,
        '--candidate',
        candidatePath,
        '--approval',
        approvalPath,
        '--root',
        root,
        '--mode',
        'commit',
        '--inventory',
        inventoryPath,
        '--ledger',
        parsed.ledger as string,
      ],
      { cwd: root, timeout: 120_000, env: { ...process.env } },
    );
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    return result.status === 0
      ? { violations: [], applied: true }
      : {
          violations: [
            `apply gate refused the deletion (exit ${String(result.status)}): ${output.trim().split(/\r?\n/).slice(-1)[0]}`,
          ],
          applied: false,
        };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true, maxRetries: 3 });
  }
}

function guardGitEnvironment(): NodeJS.ProcessEnv {
  const keys = [
    'PATH',
    'PATHEXT',
    'SYSTEMROOT',
    'SYSTEMDRIVE',
    'WINDIR',
    'COMSPEC',
    'TEMP',
    'TMP',
    'USERPROFILE',
  ] as const;
  const environment: NodeJS.ProcessEnv = {
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_PAGER: 'cat',
  };
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.length > 0) environment[key] = value;
  }
  return environment;
}

/**
 * Roll back exactly the approved deletion using the recorded rollback patch (FIX-B), then prove the
 * worktree is clean again. Returns blocking reasons; empty means the tree was restored.
 */
function rollbackAppliedDeletion(root: string, rollbackCandidateId: string): string[] {
  const patchRelative = `.w-model/code-health/apply/${rollbackCandidateId}.patch`;
  const resolution = resolveControlledRelativePath(root, patchRelative);
  if (!resolution.ok || resolution.absolutePath === undefined) {
    return ['rollback patch path is not controlled; the tree may be left modified'];
  }
  const reverted = runSync('git', ['apply', '-R', resolution.absolutePath], {
    cwd: root,
    env: guardGitEnvironment(),
    timeout: 30_000,
  });
  if (reverted.status !== 0) {
    return [`rollback command failed (exit ${String(reverted.status)}); the tree may be left modified`];
  }
  const clean = runSync('git', ['diff', '--exit-code'], {
    cwd: root,
    env: guardGitEnvironment(),
    timeout: 30_000,
  });
  if (clean.status !== 0) {
    return ['rollback did not restore a clean worktree'];
  }
  return [];
}

async function main(): Promise<void> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    exitWithError({
      category: 'ARG_INVALID',
      rule: 'P0-1',
      message: error instanceof Error ? error.message : String(error),
      detail:
        'usage: code-health-tests.ts --inventory <file> [--ledger <f>] [--project <dir>] [--candidate <f>] --validate | code-health-tests.ts --guard <file> --project <dir> --ledger <f>',
      exitCode: 2,
    });
    return;
  }

  if (parsed.guard !== undefined) {
    const guard = await readJsonOrExit<GuardDocument>(parsed.guard);
    const result = await runGuardedDeletion(parsed, guard);
    for (const violation of result.violations) console.log(`✗ [test-inventory-guard] ${violation}`);
    console.log(`GUARD_JSON ${JSON.stringify(result.payload)}`);
    process.exitCode = result.code;
    return;
  }
  await runValidate(parsed);
}

runMain(main);

export type { ExpectedGovernanceFacts };
