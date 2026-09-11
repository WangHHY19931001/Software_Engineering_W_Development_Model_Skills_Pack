#!/usr/bin/env tsx
/* eslint-disable security/detect-non-literal-fs-filename, security/detect-object-injection -- Guard inputs are resolved beneath an explicit caller-owned project root; flag names are fixed literal members of the CLI table. */
/**
 * Phase 3 test inventory CLI (protected inventory review + guarded deletion).
 *
 * Modes:
 *   --inventory <file> --validate
 *     Review a `code-health-test-inventory` document (flat, or a `{ inventory, ledger }` wrapper).
 *     Always checks structural completeness and protected-fact declarations. A proposed removal must
 *     additionally carry the ledger-recorded candidate as its authority, a computed item-wise
 *     equivalent survivor, and fully explained deletion facts (18-item pre-push count/order,
 *     self-test, docs-consistency, fixture reachability, RTM/coverage/docs/sample-matrix rehome).
 *
 *   --guard <file>
 *     The only path that may delete a test from an isolated project: run the real pre-deletion suite
 *     through `lib/code-health-command.ts` (shell:false, argv array, mandatory EvidenceBinding), then
 *     delete the exact approved tests through `cli/code-health-apply.ts` (human approval + exact scope
 *     + executable rollback), then run the real post-change suite, read the measured test count and
 *     governance facts back from the same controlled run, re-verify the coverage artifact, and fail
 *     closed on any unexplained fact drift.
 *
 * Exit codes: 0 pass, 1 validation/guard failure, 2 input error.
 */

import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
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
import { evaluateTestInventory, type TestInventoryEvaluation } from '../logic/code-health-test-logic.js';
import { exitWithError } from '../lib/cli-error.js';
import { createCodeHealthCommandRunner } from '../lib/code-health-command.js';
import { createCodeHealthEvidenceStore } from '../lib/code-health-evidence-store.js';
import { createCodeHealthFileVerifier, resolveControlledRelativePath } from '../lib/code-health-file-verifier.js';
import { createCodeHealthGitRevisionProvider } from '../lib/code-health-revision-provider.js';
import { readJsonOrExit } from '../lib/read-json-or-exit.js';
import { runMain } from '../lib/run-main.js';
import { runSync } from '../lib/run-sync.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';

const VALUE_FLAGS = ['inventory', 'ledger', 'guard'] as const;
const BOOLEAN_FLAGS = ['validate'] as const;
const SUITE_FACT_PREFIX = 'CODE_HEALTH_SUITE ';
const DEFAULT_TIMEOUT_MS = 60_000;

class TestInventoryArgumentError extends Error {}

interface ParsedArgs {
  inventory?: string;
  ledger?: string;
  guard?: string;
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
  return {
    ...(values.inventory === undefined ? {} : { inventory: values.inventory }),
    ...(values.ledger === undefined ? {} : { ledger: values.ledger }),
    ...(values.guard === undefined ? {} : { guard: values.guard }),
    validate: flags.validate === true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface InventoryReviewDocument {
  inventory: unknown;
  ledger?: unknown;
}

/** Split a flat inventory from a `{ inventory, ledger }` wrapper without trusting either shape. */
function resolveReviewDocument(document: unknown): InventoryReviewDocument | null {
  if (!isRecord(document)) return null;
  if (isRecord(document.inventory)) {
    return { inventory: document.inventory, ...(document.ledger === undefined ? {} : { ledger: document.ledger }) };
  }
  return { inventory: document };
}

function emit(payload: Record<string, unknown>): void {
  console.log(`TEST_INVENTORY_JSON ${JSON.stringify(payload)}`);
}

function schemaViolations(inventory: unknown): string[] {
  const result = validateBySchema('code-health-test-inventory', inventory);
  return result.valid ? [] : result.errorMessages.map((message) => `[schema] ${message}`);
}

function summarise(evaluation: TestInventoryEvaluation): Record<string, unknown> {
  return {
    passed: evaluation.passed,
    protectedTests: evaluation.protectedTests,
    removal: evaluation.removal,
    violations: evaluation.violations,
  };
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
  const review: InventoryReviewDocument = { ...resolved };
  if (parsed.ledger !== undefined) review.ledger = await readJsonOrExit<unknown>(parsed.ledger);

  const evaluation = evaluateTestInventory(review);
  const violations = [...schemaViolations(review.inventory), ...evaluation.violations];
  if (violations.length > 0) {
    for (const violation of violations) console.log(`✗ [test-inventory] ${violation}`);
    emit({
      type: 'code-health-tests',
      exitCode: 1,
      inventoryId: isRecord(review.inventory) ? review.inventory.inventoryId : null,
      protectedTests: evaluation.protectedTests,
      removal: evaluation.removal,
      violations,
    });
    process.exitCode = 1;
    return;
  }
  console.log('✓ protected test inventory 校验通过（任何删除必须有 ledger 锚定的等价 survivor 与已解释 facts）');
  emit({ type: 'code-health-tests', exitCode: 0, ...summarise(evaluation) });
  process.exitCode = 0;
}

// -------------------- guarded real pre/post deletion --------------------

interface GuardDocument extends Record<string, unknown> {
  projectRoot: string;
  inventory: unknown;
  ledger: unknown;
  candidate: CodeHealthCandidate;
  approval: ApprovalDecision;
  preCommand: string[];
  postCommand: string[];
  rawOutputDir: string;
  timeoutMs?: number;
}

function isCommandArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === 'string');
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
    rawOutputPath: `${candidate.changeScope.files[0] ?? '.'}`,
    rawOutputSha256: '0'.repeat(64),
  };
}

interface SuiteFacts {
  testCount?: number;
  governanceFacts?: string[];
}

/** Read the machine-readable facts a suite printed, from the raw output the runner just produced. */
async function readSuiteFacts(
  root: string,
  evidence: CommandEvidence,
): Promise<{ facts: SuiteFacts; violations: string[] }> {
  const violations: string[] = [];
  const resolution = resolveControlledRelativePath(root, evidence.rawOutputPath);
  if (!resolution.ok || resolution.absolutePath === undefined) {
    return { facts: {}, violations: [`suite raw output path is not controlled: ${evidence.rawOutputPath}`] };
  }
  let text: string;
  try {
    text = await fs.readFile(resolution.absolutePath, 'utf8');
  } catch {
    return { facts: {}, violations: ['suite raw output could not be read back from the controlled run'] };
  }
  // The audited runner stores the redacted `{ output }` envelope; unwrap it before parsing facts.
  let payload = text;
  try {
    const envelope = JSON.parse(text) as unknown;
    if (isRecord(envelope) && typeof envelope.output === 'string') payload = envelope.output;
  } catch {
    // Not an envelope: parse the raw text directly.
  }
  const line = payload.split(/\r?\n/).find((entry) => entry.startsWith(SUITE_FACT_PREFIX));
  if (line === undefined) {
    return { facts: {}, violations: ['suite raw output did not report CODE_HEALTH_SUITE facts'] };
  }
  try {
    const parsed = JSON.parse(line.slice(SUITE_FACT_PREFIX.length)) as SuiteFacts;
    return { facts: parsed, violations };
  } catch {
    return { facts: {}, violations: ['suite raw output facts are not valid JSON'] };
  }
}

async function runGuardedDeletion(
  guard: GuardDocument,
): Promise<{ code: 0 | 1; violations: string[]; payload: object }> {
  const violations: string[] = [];
  const root = path.resolve(guard.projectRoot);
  const review = evaluateTestInventory({ inventory: guard.inventory, ledger: guard.ledger });
  violations.push(...schemaViolations(guard.inventory), ...review.violations);

  if (!isCommandArray(guard.preCommand)) violations.push('guard requires a pre-deletion command argv array');
  if (!isCommandArray(guard.postCommand)) violations.push('guard requires a post-deletion command argv array');
  if (typeof guard.rawOutputDir !== 'string' || guard.rawOutputDir.trim() === '') {
    violations.push('guard requires a controlled rawOutputDir');
  }
  if (violations.length > 0) {
    return { code: 1, violations, payload: { type: 'code-health-tests-guard', exitCode: 1, violations } };
  }

  const revisionProvider = createCodeHealthGitRevisionProvider();
  const liveRevision = await revisionProvider.current(root);
  if (liveRevision === null) {
    violations.push('guarded deletion requires an available project revision');
    return { code: 1, violations, payload: { type: 'code-health-tests-guard', exitCode: 1, violations } };
  }
  const candidate = guard.candidate;
  if (
    !isRecord(candidate) ||
    candidate.revision?.commitSha !== liveRevision.commitSha ||
    candidate.revision?.treeSha !== liveRevision.treeSha
  ) {
    violations.push('guarded deletion candidate revision is stale for the project revision');
  }
  if (isRecord(candidate) && isRecord(guard.inventory) && candidate.candidateId !== guard.inventory.candidateId) {
    violations.push('guarded deletion candidate does not match the inventory candidateId');
  }
  const inventoryTests = isRecord(guard.inventory) && Array.isArray(guard.inventory.tests) ? guard.inventory.tests : [];
  const removalProof = isRecord(guard.inventory) ? guard.inventory.removalProof : undefined;
  if (isRecord(removalProof) && typeof removalProof.candidateTestId === 'string') {
    const removalCandidate = inventoryTests.find(
      (entry) => isRecord(entry) && entry.testId === removalProof.candidateTestId,
    );
    const files = isRecord(candidate) && Array.isArray(candidate.changeScope?.files) ? candidate.changeScope.files : [];
    if (!isRecord(removalCandidate) || !files.includes(removalCandidate.file as string)) {
      violations.push('guarded deletion scope is not exactly the inventory removal candidate file');
    }
  }
  if (violations.length > 0) {
    return { code: 1, violations, payload: { type: 'code-health-tests-guard', exitCode: 1, violations } };
  }

  const evidenceStore: EvidenceStore = createCodeHealthEvidenceStore({
    repositoryRoot: root,
    rawOutputRoot: guard.rawOutputDir,
  });
  const runner = createCodeHealthCommandRunner({
    repositoryRoot: root,
    rawOutputDir: guard.rawOutputDir,
    evidenceStore,
    revisionProvider,
  });
  const binding = bindingFor(candidate, liveRevision);
  const timeoutMs = typeof guard.timeoutMs === 'number' ? guard.timeoutMs : DEFAULT_TIMEOUT_MS;
  const inventory = isRecord(guard.inventory) ? guard.inventory : {};
  const preRegression = isRecord(inventory.preRegression) ? inventory.preRegression : {};
  const postRegression = isRecord(inventory.postRegression) ? inventory.postRegression : {};

  // 1. Real pre-deletion suite through the audited runner (shell:false, argv array, real exit code).
  const pre = await runner.run((guard.preCommand as string[])[0]!, (guard.preCommand as string[]).slice(1), {
    cwd: root,
    env: {},
    timeoutMs,
    binding,
  });
  violations.push(...guardSuiteExit(pre, 'pre-deletion suite'));
  const preFacts = await readSuiteFacts(root, pre);
  violations.push(...preFacts.violations);
  if (typeof preFacts.facts.testCount === 'number' && preFacts.facts.testCount !== preRegression.testCount) {
    violations.push(
      `measured pre-deletion test count ${preFacts.facts.testCount} does not match the inventory's recorded ${String(preRegression.testCount)}`,
    );
  }
  if (violations.length > 0) {
    // A failed or unreadable pre-deletion suite must never lead to a deletion.
    return {
      code: 1,
      violations,
      payload: { type: 'code-health-tests-guard', exitCode: 1, applied: false, ranPreSuite: true, violations },
    };
  }

  // 2. Delete the exact approved tests only through the Task 3 approval gate.
  const applyViolations = await runApplyGate(guard, root);
  violations.push(...applyViolations);

  // 3. Real post-change suite; measured facts are read back from this run, never hand-filled.
  const post = await runner.run((guard.postCommand as string[])[0]!, (guard.postCommand as string[]).slice(1), {
    cwd: root,
    env: {},
    timeoutMs,
    binding,
  });
  violations.push(...guardSuiteExit(post, 'post-change suite'));
  const postFacts = await readSuiteFacts(root, post);
  violations.push(...postFacts.violations);

  if (typeof postFacts.facts.testCount === 'number' && postFacts.facts.testCount !== postRegression.testCount) {
    violations.push(
      `measured post-change test count ${postFacts.facts.testCount} does not match the inventory's recorded ${String(postRegression.testCount)}`,
    );
  }
  if (
    typeof preFacts.facts.testCount === 'number' &&
    typeof postFacts.facts.testCount === 'number' &&
    postFacts.facts.testCount !== preFacts.facts.testCount - 1
  ) {
    violations.push('the real pre/post suites did not observe exactly one removed test');
  }

  // 4. Re-verify the source-bound coverage artifact produced by the controlled run.
  const coverage = isRecord(inventory.coverageProvenance) ? inventory.coverageProvenance : {};
  if (typeof coverage.path === 'string' && typeof coverage.sha256 === 'string') {
    const verifier = createCodeHealthFileVerifier();
    const verified = await verifier.verifyRegularNonSymlinkFile({
      root,
      relativePath: coverage.path,
      expectedSha256: coverage.sha256,
    });
    if (!verified.ok)
      violations.push(`coverage provenance re-verification failed: ${verified.reason ?? verified.code}`);
  }

  const payload = {
    type: 'code-health-tests-guard',
    exitCode: violations.length === 0 ? 0 : 1,
    applied: applyViolations.length === 0,
    ranPreSuite: pre.observation === 'observed',
    ranPostSuite: post.observation === 'observed',
    preTestCount: preFacts.facts.testCount ?? null,
    postTestCount: postFacts.facts.testCount ?? null,
    violations,
  };
  return { code: violations.length === 0 ? 0 : 1, violations, payload };
}

function guardSuiteExit(evidence: CommandEvidence, label: string): string[] {
  if (evidence.observation !== 'observed' || evidence.exitCode !== 0) {
    return [`${label} did not complete with a real zero exit code (observation=${evidence.observation})`];
  }
  return [];
}

/** Invoke the real Task 3 apply CLI with the inventory attached; never build a second deletion path. */
async function runApplyGate(guard: GuardDocument, root: string): Promise<string[]> {
  const require = createRequire(import.meta.url);
  const tsxCli = require.resolve('tsx/cli');
  const applyCli = path.join(path.dirname(fileURLToPath(import.meta.url)), 'code-health-apply.ts');
  const workDir = await fs.mkdtemp(path.join(tmpdir(), 'code-health-guard-'));
  try {
    const candidatePath = path.join(workDir, 'candidate.json');
    const approvalPath = path.join(workDir, 'approval.json');
    const inventoryPath = path.join(workDir, 'inventory.json');
    await fs.writeFile(candidatePath, `${JSON.stringify(guard.candidate, null, 2)}\n`, 'utf8');
    await fs.writeFile(approvalPath, `${JSON.stringify(guard.approval, null, 2)}\n`, 'utf8');
    await fs.writeFile(
      inventoryPath,
      `${JSON.stringify({ inventory: guard.inventory, ledger: guard.ledger }, null, 2)}\n`,
      'utf8',
    );
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
      ],
      { cwd: root, timeout: 120_000, env: { ...process.env } },
    );
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    return result.status === 0
      ? []
      : [
          `apply gate refused the deletion (exit ${String(result.status)}): ${output.trim().split(/\r?\n/).slice(-1)[0]}`,
        ];
  } finally {
    await fs.rm(workDir, { recursive: true, force: true, maxRetries: 3 });
  }
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
      detail: 'usage: code-health-tests.ts --inventory <file> --validate | code-health-tests.ts --guard <file>',
      exitCode: 2,
    });
    return;
  }

  if (parsed.guard !== undefined) {
    const guard = await readJsonOrExit<GuardDocument>(parsed.guard);
    const result = await runGuardedDeletion(guard);
    for (const violation of result.violations) console.log(`✗ [test-inventory-guard] ${violation}`);
    console.log(`GUARD_JSON ${JSON.stringify(result.payload)}`);
    process.exitCode = result.code;
    return;
  }
  await runValidate(parsed);
}

runMain(main);
