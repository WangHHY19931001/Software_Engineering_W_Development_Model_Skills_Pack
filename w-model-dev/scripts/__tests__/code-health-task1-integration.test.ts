/* eslint-disable security/detect-non-literal-fs-filename -- Every filesystem path in this file is a generated OS temp directory owned by this test process. */
/**
 * Task 1E integration acceptance over a real, isolated Git project.
 *
 * This file only orchestrates the public 1A-1D boundaries; it never copies their verification logic:
 * `RevisionProvider` resolves real commit/tree/source-bundle identity, the command runner spawns real
 * child processes and stores raw output through the exclusive-create `EvidenceStore`, the `FileVerifier`
 * re-reads and hashes every raw output, and every ledger mutation goes through the verified reducer entry
 * points (`transitionCandidateVerified` / `recordVerifiedGateFailure`).
 *
 * Fixture rules:
 *   - `fs.mkdtemp(path.join(os.tmpdir(), ...))` + `git init` per test; the repository root, an existing
 *     worktree, `.w-model` of the real repository, or sample fixtures are never used as the test project;
 *   - the canonical Git environment is copied from `code-health-evidence.test.ts`
 *     (`GIT_CONFIG_NOSYSTEM` + empty `GIT_CONFIG_GLOBAL` + `GIT_TERMINAL_PROMPT=0`) so the source-bundle
 *     digest is machine independent;
 *   - the isolated project gitignores `.w-model/` and `evidence/` exactly like the real repository
 *     convention (runtime evidence is not committed), which is what keeps `git status --porcelain` empty
 *     while real raw outputs and symlink fixtures exist on disk.
 *
 * Boundary: `applyApproved` resolves a real exact-scope patch proposal (it never writes without the
 * human-approved IO executor), while the archive producer/consumer/verifier stay typed `NOT_IMPLEMENTED`.
 * A green 1E run proves the Task 1 contract/evidence/lifecycle integration, never Task 8 archive.
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import { createTask1ArchiveBoundary } from '../lib/code-health-archive-boundary.js';
import { createCodeHealthCommandRunner } from '../lib/code-health-command.js';
import { createCodeHealthEvidenceStore } from '../lib/code-health-evidence-store.js';
import { createCodeHealthFileVerifier } from '../lib/code-health-file-verifier.js';
import { createCodeHealthGitRevisionProvider } from '../lib/code-health-revision-provider.js';
import type {
  ApprovalDecision,
  CandidateSelector,
  CodeHealthCandidate,
  CodeHealthLedger,
  CodeHealthStatus,
  CommandEvidence,
  ErrorCode,
  EvidenceBinding,
  EvidenceRef,
  EvidenceStore,
  FileVerificationContext,
  GapRow,
  LedgerEvent,
  LedgerEventKind,
  RevisionIdentity,
} from '../logic/code-health-contract.js';
import {
  applyApproved,
  CodeHealthError,
  nextRequiredRoles,
  recordVerifiedGateFailure,
  transitionCandidateVerified,
  validateCodeHealthCandidate,
  validateGapMatrix,
  validateGapRow,
} from '../logic/code-health-ledger-logic.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const execFileAsync = promisify(execFile);

const fileVerifier = createCodeHealthFileVerifier();
const revisionProvider = createCodeHealthGitRevisionProvider();

/** Repository-relative raw output directory inside every isolated project. */
const RAW_OUTPUT_ROOT = '.w-model/code-health/raw';
const EMPTY_SHA256 = createHash('sha256').update(Buffer.alloc(0)).digest('hex');
const TIME_BASE = Date.parse('2026-09-07T00:00:00.000Z');
/** Sibling test transient (`code-health-ledger.test.ts` raw outputs) that may appear mid-run. */
const SIBLING_TEST_TRANSIENT = '.tmp-code-health-test-output';

/**
 * Canonical Git environment shared with `code-health-evidence.test.ts`: no system or user Git config and
 * no prompt, so `git archive` source-bundle bytes stay identical across machines and the revision
 * provider, the fixture commits, and this test agree on the same digest.
 */
const GIT_ENV = {
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: 'code-health-task1-integration',
  GIT_AUTHOR_EMAIL: 'code-health-task1-integration@example.test',
  GIT_COMMITTER_NAME: 'code-health-task1-integration',
  GIT_COMMITTER_EMAIL: 'code-health-task1-integration@example.test',
  PATH: process.env.PATH,
  PATHEXT: process.env.PATHEXT,
  SYSTEMROOT: process.env.SYSTEMROOT,
  SYSTEMDRIVE: process.env.SYSTEMDRIVE,
  WINDIR: process.env.WINDIR,
  COMSPEC: process.env.COMSPEC,
  TEMP: process.env.TEMP,
  TMP: process.env.TMP,
  USERPROFILE: process.env.USERPROFILE,
} as NodeJS.ProcessEnv;

const createdRoots: string[] = [];
let contextCounter = 0;

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true, maxRetries: 3 })));
});

/* ------------------------------------------------------------------ filesystem / git helpers */

async function tempRoot(prefix = 'code-health-task1-integration-'): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), prefix));
  createdRoots.push(root);
  return root;
}

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: root, env: GIT_ENV, shell: false, windowsHide: true });
  return stdout;
}

async function gitStatusPorcelain(root: string): Promise<string> {
  return git(root, ['status', '--porcelain', '--untracked-files=all']);
}

async function gitDiffNames(root: string): Promise<string[]> {
  return splitGitNames(await git(root, ['diff', '--name-only']));
}

async function gitHeadNames(root: string): Promise<string[]> {
  return splitGitNames(await git(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']));
}

function splitGitNames(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function gitHead(root: string): Promise<string> {
  return (await git(root, ['rev-parse', 'HEAD'])).trim();
}

async function gitCommit(root: string, message: string): Promise<void> {
  await git(root, ['add', '--all']);
  await git(root, ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', message]);
}

async function exists(target: string): Promise<boolean> {
  return fs.lstat(target).then(
    () => true,
    () => false,
  );
}

function sha256Hex(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Absolute path of a repository-relative POSIX path inside an isolated project. */
function joinRelative(root: string, relativePath: string): string {
  return path.join(root, ...relativePath.split('/'));
}

/** Relative path snapshot (files with hashes, directories, symlinks) of an isolated project, minus `.git`. */
async function snapshotTree(root: string): Promise<Record<string, string>> {
  const entries = new Map<string, string>();
  async function walk(directory: string, relative: string): Promise<void> {
    const dirents = await fs.readdir(directory, { withFileTypes: true });
    for (const dirent of dirents.sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = relative === '' ? dirent.name : `${relative}/${dirent.name}`;
      if (relativePath === '.git' || relativePath.startsWith('.git/')) continue;
      const absolutePath = path.join(directory, dirent.name);
      const stat = await fs.lstat(absolutePath);
      if (stat.isSymbolicLink()) {
        entries.set(relativePath, `symlink:${String(await fs.readlink(absolutePath))}`);
        continue;
      }
      if (stat.isDirectory()) {
        entries.set(relativePath, 'directory');
        await walk(absolutePath, relativePath);
        continue;
      }
      entries.set(relativePath, `file:${sha256Hex(await fs.readFile(absolutePath))}`);
    }
  }
  await walk(root, '');
  return Object.fromEntries(entries);
}

async function listRelativePaths(root: string, predicate: (relativePath: string) => boolean): Promise<string[]> {
  const found: string[] = [];
  async function walk(directory: string, relative: string): Promise<void> {
    const dirents = await fs.readdir(directory, { withFileTypes: true });
    for (const dirent of dirents) {
      const relativePath = relative === '' ? dirent.name : `${relative}/${dirent.name}`;
      if (relativePath === '.git' || relativePath.startsWith('.git/')) continue;
      const absolutePath = path.join(directory, dirent.name);
      const stat = await fs.lstat(absolutePath);
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        await walk(absolutePath, relativePath);
        continue;
      }
      if (predicate(relativePath)) found.push(relativePath);
    }
  }
  await walk(root, '');
  return found.sort();
}

async function rawOutputNames(root: string): Promise<string[]> {
  return (await fs.readdir(joinRelative(root, RAW_OUTPUT_ROOT)).catch(() => [] as string[])).sort();
}

/** `git status --porcelain` lines that were not present in the start snapshot. */
function addedStatusLines(before: string, after: string): string[] {
  const baseline = new Set(
    before
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
  );
  return after
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !baseline.has(line));
}

/** `git diff --name-only` entries that were not present in the start snapshot. */
function addedDiffNames(before: string[], after: string[]): string[] {
  const baseline = new Set(before);
  return after.filter((entry) => !baseline.has(entry));
}

/** The current repository root must not receive any new tracked/untracked artifact from this test. */
async function expectRepositoryRootUnpolluted(before: string, beforeDiff: string[]): Promise<void> {
  const after = await gitStatusPorcelain(repoRoot);
  const added = addedStatusLines(before, after).filter((line) => !line.includes(SIBLING_TEST_TRANSIENT));
  expect(added).toEqual([]);
  expect(after).not.toContain('.w-model/');
  expect(after).not.toContain('coverage/');
  expect(after).not.toContain('.zcode/');
  expect(addedDiffNames(beforeDiff, await gitDiffNames(repoRoot))).toEqual([]);
}

/* ------------------------------------------------------------------ fixture builders */

function makeSelector(
  candidateId: string,
  files: string[] = ['src/candidate.ts'],
  symbols: string[] = ['candidate'],
  scopeHash = `sha256:${'e'.repeat(64)}`,
): CandidateSelector {
  return { candidateId, phase: 'P1', action: 'abstract', files, symbols, scopeHash };
}

function makeBinding(selector: CandidateSelector, revision: RevisionIdentity): EvidenceBinding {
  return {
    candidate: selector,
    revision,
    rawOutputPath: `${RAW_OUTPUT_ROOT}/binding-placeholder.log`,
    rawOutputSha256: '0'.repeat(64),
  };
}

/** Rebuild a binding that claims the real raw output the runner just produced. */
function bindCommand(binding: EvidenceBinding, command: CommandEvidence): EvidenceBinding {
  return { ...binding, rawOutputPath: command.rawOutputPath, rawOutputSha256: command.rawOutputSha256 };
}

function makeApproval(selector: CandidateSelector, revision: RevisionIdentity): ApprovalDecision {
  return {
    candidateId: selector.candidateId,
    decision: 'approve',
    approvedAction: selector.action,
    approvedFiles: [...selector.files],
    approvedSymbols: [...selector.symbols],
    scopeHash: selector.scopeHash,
    rationale: 'human approved the exact candidate scope after independent verifier review',
    actor: 'human-decision-maker',
    decidedAt: new Date(TIME_BASE - 30_000).toISOString(),
    signatureRef: 'evidence/signature-human-approval.json',
    revision,
  };
}

function makeCandidate(input: {
  selector: CandidateSelector;
  revision: RevisionIdentity;
  status: CodeHealthStatus;
  commands: CommandEvidence[];
  binding: EvidenceBinding;
  evidenceRef: string;
}): CodeHealthCandidate {
  const impact = {
    rtmBefore: ['REQ-001'],
    rtmAfter: ['REQ-001'],
    coverageBefore: { statements: null, branches: null, functions: null, lines: null },
    coverageAfter: { statements: null, branches: null, functions: null, lines: null },
    testLevels: ['integration' as const],
    unmappedScenarios: [],
    coverageIsSignalOnly: true as const,
  };
  return {
    candidateId: input.selector.candidateId,
    phase: input.selector.phase,
    action: input.selector.action,
    status: input.status,
    files: [...input.selector.files],
    symbols: [...input.selector.symbols],
    tests: ['tests/candidate.test.ts'],
    callSites: [],
    sources: ['static-inventory.json'],
    commands: input.commands,
    revision: input.revision,
    confidence: {
      level: 'high',
      score: 0.9,
      rationale: 'static and dynamic evidence agree inside the isolated project',
      uncertainties: [],
    },
    risk: {
      severity: 'low',
      behavior: 'low',
      security: 'none',
      concurrency: 'none',
      platform: 'low',
      lifecycle: 'low',
      governance: 'low',
      rationale: 'isolated single-file scope with a direct rollback command',
    },
    rtmImpact: impact,
    coverageImpact: impact,
    rollback: {
      preChangeRevision: input.revision.commitSha,
      command: 'git revert HEAD',
      patchPath: 'evidence/rollback.patch',
      owner: 'S-agent',
      executable: true,
      patchSha256: '2'.repeat(64),
    },
    review: { findings: [], unresolvedQuestions: [], decision: null, humanDecision: null },
    signatures: [
      {
        role: 'A',
        actor: 'analyst',
        event: 'discovered',
        scopeHash: input.selector.scopeHash,
        provenanceRef: 'evidence/signature-a-creation.json',
        signedAt: new Date(TIME_BASE).toISOString(),
      },
    ],
    changeScope: {
      files: [...input.selector.files],
      symbols: [...input.selector.symbols],
      scopeHash: input.selector.scopeHash,
    },
    evidenceBinding: input.binding,
    evidenceRef: input.evidenceRef,
    archive: { state: 'not_archived', manifestPath: null, contentHash: null, redactionStatus: 'not_reviewed' },
  };
}

function makeLedger(candidates: CodeHealthCandidate[], baseline: RevisionIdentity): CodeHealthLedger {
  return {
    schemaVersion: '1.0',
    campaignId: 'CHC-20260907-TASK1E',
    createdAt: new Date(TIME_BASE - 60_000).toISOString(),
    baseline,
    environmentMatrix: [
      {
        platform: process.platform,
        shell: 'isolated-project-git',
        runtime: `node${process.versions.node}`,
        supported: true,
        observed: 'observed',
        reason: 'real isolated Git project created by the Task 1E integration test',
      },
    ],
    candidates,
    events: [],
    appendOnly: true,
    redaction: { status: 'not_reviewed', rules: ['redact secrets before persistence'], blockedReasons: [] },
  };
}

interface EventSpec {
  eventId: string;
  eventKind: LedgerEventKind;
  candidateId: string;
  from: CodeHealthStatus | null;
  to: CodeHealthStatus;
  actorRole: LedgerEvent['actorRole'];
  at: string;
  revision: RevisionIdentity;
  scopeHash: string;
  evidenceRefs: string[];
  signatureRef: string;
  previousRevision?: RevisionIdentity;
  archiveEvidence?: LedgerEvent['archiveEvidence'];
}

function makeEvent(spec: EventSpec): LedgerEvent {
  return { ...spec };
}

function createClock(): () => string {
  let tick = 0;
  return () => {
    tick += 1;
    return new Date(TIME_BASE + tick * 1000).toISOString();
  };
}

const CHAIN_ORDER: readonly CodeHealthStatus[] = [
  'discovered',
  'evidenced',
  'under-review',
  'approved',
  'implemented',
  'verified',
];

function chainRank(status: CodeHealthStatus): number {
  return CHAIN_ORDER.indexOf(status);
}

function verificationContext(root: string): FileVerificationContext {
  return { repositoryRoot: root, fileVerifier };
}

/** Verified-entry reducer call: every Task 1E ledger mutation goes through this wrapper. */
async function appendChainEvent(
  ledger: CodeHealthLedger,
  spec: EventSpec,
  options: { root: string; approval?: ApprovalDecision },
): Promise<CodeHealthLedger> {
  return transitionCandidateVerified(
    ledger,
    spec.candidateId,
    makeEvent(spec),
    options.approval,
    verificationContext(options.root),
  );
}

/* ------------------------------------------------------------------ real chain execution */

interface IsolatedProject {
  root: string;
  initialRevision: RevisionIdentity;
}

async function requireRevision(root: string): Promise<RevisionIdentity> {
  const revision = await revisionProvider.current(root);
  if (!revision) throw new Error('isolated Git project revision could not be read');
  return revision;
}

/**
 * Create a real isolated Git project: `git init`, an initial commit, and optional outside-reaching
 * symlinks. `.w-model/`, `evidence/`, and `linked/` are gitignored exactly like the runtime evidence
 * convention of the real repository.
 */
async function createIsolatedProject(options: { symlinkTarget?: string } = {}): Promise<IsolatedProject> {
  const root = await tempRoot();
  await git(root, ['init', '--quiet']);
  await fs.writeFile(path.join(root, '.gitignore'), '.w-model/\nevidence/\nlinked/\n', 'utf8');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.mkdir(path.join(root, 'tests'), { recursive: true });
  await fs.mkdir(joinRelative(root, RAW_OUTPUT_ROOT), { recursive: true });
  await fs.mkdir(path.join(root, 'evidence'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'candidate.ts'), 'export const candidate = 1;\n', 'utf8');
  await fs.writeFile(path.join(root, 'tests', 'candidate.test.ts'), 'export const observedCandidate = 1;\n', 'utf8');
  await git(root, ['add', '--all']);
  await git(root, ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'initial isolated project state']);

  if (options.symlinkTarget !== undefined) {
    await fs.symlink(
      path.join(options.symlinkTarget, 'secret.txt'),
      path.join(root, 'evidence', 'file-link.txt'),
      'file',
    );
    await fs.symlink(
      options.symlinkTarget,
      path.join(root, 'linked'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
  }

  return { root, initialRevision: await requireRevision(root) };
}

/** Real second commit: the implemented candidate state, observed through the RevisionProvider. */
async function commitImplementedState(root: string): Promise<RevisionIdentity> {
  await fs.writeFile(path.join(root, 'src', 'candidate.ts'), 'export const candidate = 2;\n', 'utf8');
  await gitCommit(root, 'isolated project implemented state');
  return requireRevision(root);
}

interface ProjectBoundaries {
  root: string;
  evidenceStore: EvidenceStore;
  runner: ReturnType<typeof createCodeHealthCommandRunner>;
}

function createProjectBoundaries(root: string): ProjectBoundaries {
  const evidenceStore = createCodeHealthEvidenceStore({ repositoryRoot: root, rawOutputRoot: RAW_OUTPUT_ROOT });
  const runner = createCodeHealthCommandRunner({
    repositoryRoot: root,
    rawOutputDir: RAW_OUTPUT_ROOT,
    evidenceStore,
    revisionProvider,
  });
  return { root, evidenceStore, runner };
}

/** Run one real child process through the command runner, bound to a candidate and revision. */
async function runBoundCommand(
  boundaries: ProjectBoundaries,
  selector: CandidateSelector,
  revision: RevisionIdentity,
  script: string,
): Promise<CommandEvidence> {
  return boundaries.runner.run(process.execPath, ['-e', script], {
    cwd: boundaries.root,
    env: { NODE_ENV: 'test' },
    timeoutMs: 10_000,
    binding: makeBinding(selector, revision),
  });
}

/**
 * Verify one stored raw output through the injected EvidenceStore: the store binds candidate/scope/revision
 * and re-reads the real file (regular, non-symlink, exact SHA-256) through the FileVerifier.
 */
async function verifyStoredCommand(
  boundaries: ProjectBoundaries,
  selector: CandidateSelector,
  revision: RevisionIdentity,
  command: CommandEvidence,
  evidenceId: string,
): Promise<EvidenceRef> {
  const ref: EvidenceRef = {
    evidenceId,
    candidateId: selector.candidateId,
    scopeHash: selector.scopeHash,
    relativePath: command.rawOutputPath,
    sha256: command.rawOutputSha256,
    revision,
    observation: command.observation,
  };
  const verified = await boundaries.evidenceStore.verify(ref, bindCommand(makeBinding(selector, revision), command));
  expect(verified).toMatchObject({ ok: true, code: null });
  return ref;
}

interface ChainCommands {
  creation: CommandEvidence;
  evidence: CommandEvidence;
  otherCreation: CommandEvidence;
  review?: CommandEvidence;
  humanApproval?: CommandEvidence;
  implementation?: CommandEvidence;
  verification?: CommandEvidence;
  gateFailure?: CommandEvidence;
}

interface LedgerBuildInput {
  boundaries: ProjectBoundaries;
  selector: CandidateSelector;
  otherSelector: CandidateSelector;
  initialRevision: RevisionIdentity;
  implementedRevision: RevisionIdentity | null;
  target: CodeHealthStatus;
  approval: ApprovalDecision;
  commands: ChainCommands;
}

/**
 * Walk a fresh ledger to `target` using only the verified reducer entry points. `blocked` is reached by a
 * real non-zero gate command recorded through `recordVerifiedGateFailure`.
 */
async function buildIsolatedLedger(input: LedgerBuildInput): Promise<CodeHealthLedger> {
  const { boundaries, selector, otherSelector, initialRevision, commands } = input;
  const clock = createClock();
  const candidate = makeCandidate({
    selector,
    revision: initialRevision,
    status: 'discovered',
    commands: [commands.creation, commands.evidence],
    binding: bindCommand(makeBinding(selector, initialRevision), commands.evidence),
    evidenceRef: `evidence/${selector.candidateId}.json`,
  });
  const otherCandidate = makeCandidate({
    selector: otherSelector,
    revision: initialRevision,
    status: 'discovered',
    commands: [commands.otherCreation],
    binding: bindCommand(makeBinding(otherSelector, initialRevision), commands.otherCreation),
    evidenceRef: `evidence/${otherSelector.candidateId}.json`,
  });
  const options = { root: boundaries.root };
  let ledger = makeLedger([candidate, otherCandidate], initialRevision);
  ledger = await appendChainEvent(
    ledger,
    {
      eventId: `EV-${selector.candidateId}-CREATION`,
      eventKind: 'discovery',
      candidateId: selector.candidateId,
      from: null,
      to: 'discovered',
      actorRole: 'A',
      at: clock(),
      revision: initialRevision,
      scopeHash: selector.scopeHash,
      evidenceRefs: [commands.creation.rawOutputPath],
      signatureRef: 'evidence/signature-a-creation.json',
    },
    options,
  );
  ledger = await appendChainEvent(
    ledger,
    {
      eventId: `EV-${otherSelector.candidateId}-CREATION`,
      eventKind: 'discovery',
      candidateId: otherSelector.candidateId,
      from: null,
      to: 'discovered',
      actorRole: 'A',
      at: clock(),
      revision: initialRevision,
      scopeHash: otherSelector.scopeHash,
      evidenceRefs: [commands.otherCreation.rawOutputPath],
      signatureRef: 'evidence/signature-a-other-creation.json',
    },
    options,
  );

  const chainTarget: CodeHealthStatus = input.target === 'blocked' ? 'under-review' : input.target;
  if (chainRank(chainTarget) >= chainRank('evidenced')) {
    ledger = await appendChainEvent(
      ledger,
      {
        eventId: `EV-${selector.candidateId}-EVIDENCE`,
        eventKind: 'evidence',
        candidateId: selector.candidateId,
        from: 'discovered',
        to: 'evidenced',
        actorRole: 'A',
        at: clock(),
        revision: initialRevision,
        scopeHash: selector.scopeHash,
        evidenceRefs: [commands.evidence.rawOutputPath],
        signatureRef: 'evidence/signature-a-evidence.json',
      },
      options,
    );
  }
  if (chainRank(chainTarget) >= chainRank('under-review')) {
    ledger = await appendChainEvent(
      ledger,
      {
        eventId: `EV-${selector.candidateId}-REVIEW`,
        eventKind: 'review',
        candidateId: selector.candidateId,
        from: 'evidenced',
        to: 'under-review',
        actorRole: 'V',
        at: clock(),
        revision: initialRevision,
        scopeHash: selector.scopeHash,
        evidenceRefs: [(commands.review ?? commands.evidence).rawOutputPath],
        signatureRef: 'evidence/signature-v-review.json',
      },
      options,
    );
  }
  if (chainRank(chainTarget) >= chainRank('approved')) {
    ledger = await appendChainEvent(
      ledger,
      {
        eventId: `EV-${selector.candidateId}-APPROVAL`,
        eventKind: 'approval',
        candidateId: selector.candidateId,
        from: 'under-review',
        to: 'approved',
        actorRole: 'human',
        at: clock(),
        revision: initialRevision,
        scopeHash: selector.scopeHash,
        evidenceRefs: [(commands.humanApproval ?? commands.evidence).rawOutputPath],
        signatureRef: 'evidence/signature-human-approval.json',
      },
      { ...options, approval: input.approval },
    );
  }
  if (chainRank(chainTarget) >= chainRank('implemented')) {
    if (!commands.implementation || !input.implementedRevision) {
      throw new Error('implemented ledger fixture requires an implementation command and revision');
    }
    ledger = await appendChainEvent(
      ledger,
      {
        eventId: `EV-${selector.candidateId}-IMPLEMENTATION`,
        eventKind: 'implementation',
        candidateId: selector.candidateId,
        from: 'approved',
        to: 'implemented',
        actorRole: 'S',
        at: clock(),
        previousRevision: initialRevision,
        revision: input.implementedRevision,
        scopeHash: selector.scopeHash,
        evidenceRefs: [commands.implementation.rawOutputPath],
        signatureRef: 'evidence/signature-s-implementation.json',
      },
      options,
    );
  }
  if (chainRank(chainTarget) >= chainRank('verified')) {
    if (!commands.verification || !input.implementedRevision) {
      throw new Error('verified ledger fixture requires a verification command and revision');
    }
    ledger = await appendChainEvent(
      ledger,
      {
        eventId: `EV-${selector.candidateId}-VERIFICATION`,
        eventKind: 'verification',
        candidateId: selector.candidateId,
        from: 'implemented',
        to: 'verified',
        actorRole: 'G',
        at: clock(),
        revision: input.implementedRevision,
        scopeHash: selector.scopeHash,
        evidenceRefs: [commands.verification.rawOutputPath],
        signatureRef: 'evidence/signature-g-verification.json',
      },
      options,
    );
  }
  if (input.target === 'blocked') {
    if (!commands.gateFailure) throw new Error('blocked ledger fixture requires a real failing gate command');
    ledger = await recordVerifiedGateFailure(ledger, selector.candidateId, commands.gateFailure, {
      repositoryRoot: boundaries.root,
      fileVerifier,
      evidenceStore: boundaries.evidenceStore,
      binding: bindCommand(makeBinding(selector, input.initialRevision), commands.gateFailure),
    });
  }
  return ledger;
}

interface RealChainResult {
  boundaries: ProjectBoundaries;
  selector: CandidateSelector;
  otherSelector: CandidateSelector;
  initialRevision: RevisionIdentity;
  implementedRevision: RevisionIdentity;
  approval: ApprovalDecision;
  commands: ChainCommands & {
    review: CommandEvidence;
    humanApproval: CommandEvidence;
    implementation: CommandEvidence;
    verification: CommandEvidence;
  };
  approvedLedger: CodeHealthLedger;
  verifiedLedger: CodeHealthLedger;
}

/**
 * Real positive chain: real child processes produce raw evidence, the FileVerifier authenticates every raw
 * output, the human approval is bound to the real revision, S commits the exact approved scope, the
 * RevisionProvider observes the new revision, and G/V verified events carry independent evidence refs.
 */
async function runRealApprovedChain(): Promise<RealChainResult> {
  const project = await createIsolatedProject();
  const boundaries = createProjectBoundaries(project.root);
  const selector = makeSelector('CHG-P1-20260907-201', ['src/candidate.ts'], ['candidate']);
  const otherSelector = makeSelector(
    'CHG-P1-20260907-202',
    ['tests/candidate.test.ts'],
    ['observedCandidate'],
    `sha256:${'f'.repeat(64)}`,
  );
  const initialRevision = project.initialRevision;
  const approval = makeApproval(selector, initialRevision);

  const commands: ChainCommands = {
    creation: await runBoundCommand(boundaries, selector, initialRevision, 'process.stdout.write("A creation raw")'),
    evidence: await runBoundCommand(boundaries, selector, initialRevision, 'process.stdout.write("raw-evidence")'),
    otherCreation: await runBoundCommand(
      boundaries,
      otherSelector,
      initialRevision,
      'process.stdout.write("A other creation raw")',
    ),
    review: await runBoundCommand(boundaries, selector, initialRevision, 'process.stdout.write("V review raw")'),
    humanApproval: await runBoundCommand(
      boundaries,
      selector,
      initialRevision,
      'process.stdout.write("human approval raw")',
    ),
  };
  for (const command of Object.values(commands)) {
    expect(command).toMatchObject({ observation: 'observed', exitCode: 0 });
  }
  await verifyStoredCommand(boundaries, selector, initialRevision, commands.creation, 'EVD-CREATION-201');
  await verifyStoredCommand(boundaries, selector, initialRevision, commands.evidence, 'EVD-EVIDENCE-201');
  await verifyStoredCommand(boundaries, otherSelector, initialRevision, commands.otherCreation, 'EVD-CREATION-202');
  await verifyStoredCommand(
    boundaries,
    selector,
    initialRevision,
    requireDefined(commands.review, 'review command'),
    'EVD-REVIEW-201',
  );
  await verifyStoredCommand(
    boundaries,
    selector,
    initialRevision,
    requireDefined(commands.humanApproval, 'human approval command'),
    'EVD-HUMAN-APPROVAL-201',
  );

  const approvedLedger = await buildIsolatedLedger({
    boundaries,
    selector,
    otherSelector,
    initialRevision,
    implementedRevision: null,
    target: 'approved',
    approval,
    commands,
  });
  expect(approvedLedger.candidates.find((entry) => entry.candidateId === selector.candidateId)?.status).toBe(
    'approved',
  );

  // S applies the approved exact file in the isolated project; Task 1 applyApproved is never used here.
  await fs.writeFile(path.join(project.root, 'src', 'candidate.ts'), 'export const candidate = 2;\n', 'utf8');
  expect(await gitDiffNames(project.root)).toEqual(['src/candidate.ts']);
  await gitCommit(project.root, 'apply approved exact scope');
  expect(await gitDiffNames(project.root)).toEqual([]);
  expect(await gitHeadNames(project.root)).toEqual(['src/candidate.ts']);

  const implementedRevision = await requireRevision(project.root);
  expect(implementedRevision.commitSha).not.toBe(initialRevision.commitSha);
  expect(implementedRevision.treeSha).not.toBe(initialRevision.treeSha);
  expect(await revisionProvider.verify(project.root, implementedRevision)).toMatchObject({ ok: true, code: null });
  expect(await revisionProvider.verify(project.root, initialRevision)).toMatchObject({
    ok: false,
    code: 'REVISION_MISMATCH',
  });

  const implementationCommand = await runBoundCommand(
    boundaries,
    selector,
    implementedRevision,
    'process.stdout.write("S exact-scope implementation")',
  );
  const verificationCommand = await boundaries.runner.run(
    process.execPath,
    [
      '-e',
      'process.exitCode = require("fs").readFileSync("src/candidate.ts","utf8").includes("candidate = 2") ? 0 : 1',
    ],
    {
      cwd: project.root,
      env: { NODE_ENV: 'test' },
      timeoutMs: 10_000,
      binding: makeBinding(selector, implementedRevision),
    },
  );
  expect(verificationCommand).toMatchObject({ observation: 'observed', exitCode: 0 });
  await verifyStoredCommand(boundaries, selector, implementedRevision, implementationCommand, 'EVD-S-IMPLEMENTED-201');
  await verifyStoredCommand(boundaries, selector, implementedRevision, verificationCommand, 'EVD-G-VERIFIED-201');

  const implementedLedger = await appendChainEvent(
    approvedLedger,
    {
      eventId: `EV-${selector.candidateId}-IMPLEMENTATION`,
      eventKind: 'implementation',
      candidateId: selector.candidateId,
      from: 'approved',
      to: 'implemented',
      actorRole: 'S',
      at: new Date(TIME_BASE + 60_000).toISOString(),
      previousRevision: initialRevision,
      revision: implementedRevision,
      scopeHash: selector.scopeHash,
      evidenceRefs: [implementationCommand.rawOutputPath],
      signatureRef: 'evidence/signature-s-implementation.json',
    },
    { root: project.root },
  );
  const verifiedLedger = await appendChainEvent(
    implementedLedger,
    {
      eventId: `EV-${selector.candidateId}-VERIFICATION`,
      eventKind: 'verification',
      candidateId: selector.candidateId,
      from: 'implemented',
      to: 'verified',
      actorRole: 'G',
      at: new Date(TIME_BASE + 61_000).toISOString(),
      revision: implementedRevision,
      scopeHash: selector.scopeHash,
      evidenceRefs: [verificationCommand.rawOutputPath],
      signatureRef: 'evidence/signature-g-verification.json',
    },
    { root: project.root },
  );

  return {
    boundaries,
    selector,
    otherSelector,
    initialRevision,
    implementedRevision,
    approval,
    commands: {
      ...commands,
      review: requireDefined(commands.review, 'review command'),
      humanApproval: requireDefined(commands.humanApproval, 'human approval command'),
      implementation: implementationCommand,
      verification: verificationCommand,
    },
    approvedLedger,
    verifiedLedger,
  };
}

/* ------------------------------------------------------------------ negative matrix harness */

interface NegativeContext {
  caseId: string;
  root: string;
  outsideRoot: string;
  candidateId: string;
  otherCandidateId: string;
  selector: CandidateSelector;
  otherSelector: CandidateSelector;
  revision: RevisionIdentity;
  implementedRevision: RevisionIdentity | null;
  approval: ApprovalDecision;
  ledger: CodeHealthLedger;
  evidenceStore: EvidenceStore;
  runner: ReturnType<typeof createCodeHealthCommandRunner>;
  binding: EvidenceBinding;
  command: CommandEvidence;
}

interface NegativeOutcome {
  code: ErrorCode | null;
  messages: string[];
}

async function captureTyped(operation: () => Promise<unknown>): Promise<NegativeOutcome> {
  try {
    const value = await operation();
    if (value !== null && typeof value === 'object') {
      const record = value as { code?: unknown; errorCode?: unknown };
      const code = typeof record.code === 'string' ? record.code : record.errorCode;
      return { code: typeof code === 'string' ? (code as ErrorCode) : null, messages: [] };
    }
    return { code: null, messages: [] };
  } catch (error) {
    if (error instanceof CodeHealthError) return { code: error.code, messages: [error.message] };
    throw error;
  }
}

async function createNegativeContext(options: {
  caseId: string;
  targetStatus: CodeHealthStatus;
  symlinks?: boolean;
}): Promise<NegativeContext> {
  contextCounter += 1;
  const candidateId = `CHG-P1-20260907-${300 + contextCounter}`;
  const otherCandidateId = `CHG-P1-20260907-${400 + contextCounter}`;
  const outsideRoot = await tempRoot('code-health-task1-outside-');
  await fs.writeFile(path.join(outsideRoot, 'secret.txt'), 'outside-secret-bytes', 'utf8');
  const project = await createIsolatedProject(options.symlinks === true ? { symlinkTarget: outsideRoot } : {});
  const boundaries = createProjectBoundaries(project.root);
  const selector = makeSelector(candidateId, ['src/candidate.ts'], ['candidate']);
  const otherSelector = makeSelector(
    otherCandidateId,
    ['tests/candidate.test.ts'],
    ['observedCandidate'],
    `sha256:${'f'.repeat(64)}`,
  );
  const initialRevision = project.initialRevision;
  // Commands that belong to the pre-implementation part of the lifecycle are real children of the
  // initial revision; the implementation/verification commands only exist after the second commit.
  const commands: ChainCommands = {
    creation: await runBoundCommand(boundaries, selector, initialRevision, 'process.stdout.write("A creation raw")'),
    evidence: await runBoundCommand(boundaries, selector, initialRevision, 'process.stdout.write("raw-evidence")'),
    otherCreation: await runBoundCommand(
      boundaries,
      otherSelector,
      initialRevision,
      'process.stdout.write("A other creation raw")',
    ),
    review: await runBoundCommand(boundaries, selector, initialRevision, 'process.stdout.write("V review raw")'),
    humanApproval: await runBoundCommand(
      boundaries,
      selector,
      initialRevision,
      'process.stdout.write("human approval raw")',
    ),
  };
  await verifyStoredCommand(boundaries, selector, initialRevision, commands.evidence, `EVD-${candidateId}-EVIDENCE`);

  let implementedRevision: RevisionIdentity | null = null;
  if (chainRank(options.targetStatus) >= chainRank('implemented')) {
    implementedRevision = await commitImplementedState(project.root);
    commands.implementation = await runBoundCommand(
      boundaries,
      selector,
      implementedRevision,
      'process.stdout.write("S isolated implementation")',
    );
    if (chainRank(options.targetStatus) >= chainRank('verified')) {
      commands.verification = await runBoundCommand(
        boundaries,
        selector,
        implementedRevision,
        'process.stdout.write("G isolated verification")',
      );
    }
  }
  if (options.targetStatus === 'blocked') {
    commands.gateFailure = await boundaries.runner.run(process.execPath, ['-e', 'process.exit(7)'], {
      cwd: boundaries.root,
      env: {},
      timeoutMs: 10_000,
      binding: makeBinding(selector, initialRevision),
    });
    expect(commands.gateFailure).toMatchObject({ observation: 'observed', exitCode: 7 });
  }

  const revision = implementedRevision ?? initialRevision;
  const approval = makeApproval(selector, initialRevision);
  const ledger = await buildIsolatedLedger({
    boundaries,
    selector,
    otherSelector,
    initialRevision,
    implementedRevision,
    target: options.targetStatus,
    approval,
    commands,
  });
  expect(ledger.candidates.find((entry) => entry.candidateId === candidateId)?.status).toBe(options.targetStatus);

  return {
    caseId: options.caseId,
    root: boundaries.root,
    outsideRoot,
    candidateId,
    otherCandidateId,
    selector,
    otherSelector,
    revision,
    implementedRevision,
    approval,
    ledger,
    evidenceStore: boundaries.evidenceStore,
    runner: boundaries.runner,
    binding: bindCommand(makeBinding(selector, revision), commands.evidence),
    command: commands.evidence,
  };
}

interface NegativeCase {
  id: string;
  targetStatus: CodeHealthStatus;
  symlinks?: boolean;
  codes: readonly ErrorCode[];
  /** `false` for reasons-returning validators (GapRow) that do not throw typed errors. */
  typedCode?: boolean;
  act: (context: NegativeContext) => Promise<NegativeOutcome>;
}

async function expectVerifierCode(root: string, relativePath: string, code: ErrorCode): Promise<NegativeOutcome> {
  const result = await fileVerifier.verifyRegularNonSymlinkFile({
    root,
    relativePath,
    expectedSha256: EMPTY_SHA256,
  });
  expect(result.ok).toBe(false);
  expect(result.code).toBe(code);
  return { code: result.code, messages: [result.reason ?? ''] };
}

function makeValidGapRow(candidateId: string): GapRow {
  return {
    gapId: 'GAP-TASK1E-001',
    candidateId,
    kind: 'branch',
    testLevels: ['integration'],
    existingTestIds: ['T-INTEGRATION-001'],
    missingScenario: 'candidate scope is verified after a real exact-scope implementation commit',
    evidenceSources: [`${RAW_OUTPUT_ROOT}/stored-command.log`],
    risk: {
      severity: 'low',
      behavior: 'low',
      security: 'none',
      concurrency: 'none',
      platform: 'low',
      lifecycle: 'low',
      governance: 'low',
      rationale: 'integration coverage for the real Task 1 chain',
    },
    priority: 'medium',
    owner: 'test-engineer',
    rtmIds: ['REQ-001'],
    coverageSignal: { statements: null, branches: null, functions: null, lines: null },
    coverageIsSignalOnly: true,
    status: 'discovered',
  };
}

function requireDefined<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) throw new Error(`${label} is unavailable in this fixture`);
  return value;
}

/** Strictly increasing timestamp after the addressed candidate's last recorded event. */
function afterLastEvent(context: NegativeContext, offsetSeconds = 1): string {
  const events = context.ledger.events.filter((entry) => entry.candidateId === context.candidateId);
  const last = events.at(-1);
  const base = last === undefined ? TIME_BASE : Date.parse(last.at);
  return new Date(base + offsetSeconds * 1000).toISOString();
}

const negativeCases: readonly NegativeCase[] = [
  {
    id: 'path-absolute',
    targetStatus: 'under-review',
    codes: ['STRUCTURE_INVALID', 'SECURITY_BLOCKED'],
    act: async (context) => {
      const absoluteInsideRoot = path.resolve(context.root, 'evidence', 'raw.log');
      const first = await expectVerifierCode(context.root, absoluteInsideRoot, 'STRUCTURE_INVALID');
      await expectVerifierCode(context.root, 'C:\\outside\\raw.log', 'STRUCTURE_INVALID');
      await expectVerifierCode(context.root, '/outside/raw.log', 'STRUCTURE_INVALID');
      const stored = await captureTyped(() =>
        context.evidenceStore.putRawOutput({
          candidateId: context.candidateId,
          scopeHash: context.selector.scopeHash,
          relativePath: absoluteInsideRoot,
          bytes: Buffer.from('must-not-write', 'utf8'),
        }),
      );
      expect(stored.code).toBe('STRUCTURE_INVALID');
      return { code: first.code, messages: [...first.messages, ...stored.messages] };
    },
  },
  {
    id: 'path-parent',
    targetStatus: 'under-review',
    codes: ['STRUCTURE_INVALID'],
    act: async (context) => {
      const first = await expectVerifierCode(context.root, '../outside.log', 'STRUCTURE_INVALID');
      await expectVerifierCode(context.root, 'evidence/../../outside.log', 'STRUCTURE_INVALID');
      const stored = await captureTyped(() =>
        context.evidenceStore.putRawOutput({
          candidateId: context.candidateId,
          scopeHash: context.selector.scopeHash,
          relativePath: '../outside.log',
          bytes: Buffer.from('must-not-write', 'utf8'),
        }),
      );
      expect(stored.code).toBe('STRUCTURE_INVALID');
      expect(await exists(path.resolve(context.root, '..', 'outside.log'))).toBe(false);
      return { code: first.code, messages: [...first.messages, ...stored.messages] };
    },
  },
  {
    id: 'file-directory',
    targetStatus: 'under-review',
    codes: ['EVIDENCE_INVALID'],
    act: async (context) => {
      await fs.mkdir(path.join(context.root, 'evidence', 'dir-target'), { recursive: true });
      await fs.mkdir(joinRelative(context.root, `${RAW_OUTPUT_ROOT}/directory-target`), { recursive: true });
      const directory = await expectVerifierCode(context.root, 'evidence/dir-target', 'EVIDENCE_INVALID');
      const stored = await captureTyped(() =>
        context.evidenceStore.putRawOutput({
          candidateId: context.candidateId,
          scopeHash: context.selector.scopeHash,
          relativePath: `${RAW_OUTPUT_ROOT}/directory-target`,
          bytes: Buffer.from('must-not-write', 'utf8'),
        }),
      );
      expect(stored.code).toBe('EVIDENCE_INVALID');
      return { code: directory.code, messages: [...directory.messages, ...stored.messages] };
    },
  },
  {
    id: 'file-symlink',
    targetStatus: 'under-review',
    symlinks: true,
    codes: ['SECURITY_BLOCKED'],
    act: async (context) => {
      const linkedRawOutput = `${RAW_OUTPUT_ROOT}/linked-raw-output.log`;
      await fs.symlink(
        path.join(context.outsideRoot, 'secret.txt'),
        joinRelative(context.root, linkedRawOutput),
        'file',
      );
      const result = await expectVerifierCode(context.root, 'evidence/file-link.txt', 'SECURITY_BLOCKED');
      const stored = await captureTyped(() =>
        context.evidenceStore.putRawOutput({
          candidateId: context.candidateId,
          scopeHash: context.selector.scopeHash,
          relativePath: linkedRawOutput,
          bytes: Buffer.from('must-not-write', 'utf8'),
        }),
      );
      expect(stored.code).toBe('SECURITY_BLOCKED');
      expect(await fs.readFile(path.join(context.outsideRoot, 'secret.txt'), 'utf8')).toBe('outside-secret-bytes');
      return { code: result.code, messages: [...result.messages, ...stored.messages] };
    },
  },
  {
    id: 'file-parent-symlink',
    targetStatus: 'under-review',
    symlinks: true,
    codes: ['SECURITY_BLOCKED'],
    act: async (context) => {
      const linkedParent = `${RAW_OUTPUT_ROOT}/linked-parent`;
      await fs.symlink(
        context.outsideRoot,
        joinRelative(context.root, linkedParent),
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      const result = await expectVerifierCode(context.root, 'linked/secret.txt', 'SECURITY_BLOCKED');
      const stored = await captureTyped(() =>
        context.evidenceStore.putRawOutput({
          candidateId: context.candidateId,
          scopeHash: context.selector.scopeHash,
          relativePath: `${linkedParent}/secret.txt`,
          bytes: Buffer.from('must-not-write', 'utf8'),
        }),
      );
      expect(stored.code).toBe('SECURITY_BLOCKED');
      expect(await fs.readFile(path.join(context.outsideRoot, 'secret.txt'), 'utf8')).toBe('outside-secret-bytes');
      return { code: result.code, messages: [...result.messages, ...stored.messages] };
    },
  },
  {
    id: 'file-missing',
    targetStatus: 'under-review',
    codes: ['EVIDENCE_INVALID'],
    act: async (context) => {
      const result = await expectVerifierCode(context.root, 'evidence/missing.log', 'EVIDENCE_INVALID');
      const stored = await context.evidenceStore.putRawOutput({
        candidateId: context.candidateId,
        scopeHash: context.selector.scopeHash,
        relativePath: `${RAW_OUTPUT_ROOT}/deleted-before-verify.log`,
        bytes: Buffer.from('deleted-before-verify', 'utf8'),
      });
      await fs.rm(joinRelative(context.root, stored.relativePath));
      const verified = await captureTyped(() =>
        context.evidenceStore.verify(
          {
            evidenceId: 'EVD-DELETED-001',
            candidateId: context.candidateId,
            scopeHash: context.selector.scopeHash,
            relativePath: stored.relativePath,
            sha256: stored.sha256,
            revision: context.revision,
            observation: 'observed',
          },
          {
            candidate: context.selector,
            revision: context.revision,
            rawOutputPath: stored.relativePath,
            rawOutputSha256: stored.sha256,
          },
        ),
      );
      expect(verified.code).toBe('EVIDENCE_INVALID');
      return { code: result.code, messages: [...result.messages, ...verified.messages] };
    },
  },
  {
    id: 'hash-tamper',
    targetStatus: 'under-review',
    codes: ['EVIDENCE_INVALID'],
    act: async (context) => {
      const stored = await context.evidenceStore.putRawOutput({
        candidateId: context.candidateId,
        scopeHash: context.selector.scopeHash,
        relativePath: `${RAW_OUTPUT_ROOT}/tamper-target.log`,
        bytes: Buffer.from('original-bytes', 'utf8'),
      });
      await fs.writeFile(joinRelative(context.root, stored.relativePath), 'tampered-bytes', 'utf8');
      const verified = await captureTyped(() =>
        context.evidenceStore.verify(
          {
            evidenceId: 'EVD-TAMPER-001',
            candidateId: context.candidateId,
            scopeHash: context.selector.scopeHash,
            relativePath: stored.relativePath,
            sha256: stored.sha256,
            revision: context.revision,
            observation: 'observed',
          },
          {
            candidate: context.selector,
            revision: context.revision,
            rawOutputPath: stored.relativePath,
            rawOutputSha256: stored.sha256,
          },
        ),
      );
      expect(verified.code).toBe('EVIDENCE_INVALID');
      return verified;
    },
  },
  {
    id: 'utf8-invalid',
    targetStatus: 'under-review',
    codes: ['SECURITY_BLOCKED'],
    act: async (context) => {
      const before = await rawOutputNames(context.root);
      const result = await captureTyped(() =>
        context.runner.run(process.execPath, ['-e', 'process.stdout.write(Buffer.from([0xff]))'], {
          cwd: context.root,
          env: {},
          timeoutMs: 10_000,
          binding: makeBinding(context.selector, context.revision),
        }),
      );
      expect(result.code).toBe('SECURITY_BLOCKED');
      expect(await rawOutputNames(context.root)).toEqual(before);
      return result;
    },
  },
  {
    id: 'revision-commit',
    targetStatus: 'under-review',
    codes: ['REVISION_MISMATCH'],
    act: async (context) => {
      const before = await rawOutputNames(context.root);
      const stale = { ...context.revision, commitSha: 'f'.repeat(40) };
      const result = await captureTyped(() =>
        context.runner.run(process.execPath, ['-e', 'process.stdout.write("must-not-run")'], {
          cwd: context.root,
          env: {},
          timeoutMs: 10_000,
          binding: makeBinding(context.selector, stale),
        }),
      );
      expect(result.code).toBe('REVISION_MISMATCH');
      expect(await revisionProvider.verify(context.root, stale)).toMatchObject({
        ok: false,
        code: 'REVISION_MISMATCH',
      });
      expect(await rawOutputNames(context.root)).toEqual(before);
      return result;
    },
  },
  {
    id: 'revision-tree',
    targetStatus: 'under-review',
    codes: ['REVISION_MISMATCH'],
    act: async (context) => {
      const before = await rawOutputNames(context.root);
      const stale = { ...context.revision, treeSha: 'f'.repeat(40) };
      const result = await captureTyped(() =>
        context.runner.run(process.execPath, ['-e', 'process.stdout.write("must-not-run")'], {
          cwd: context.root,
          env: {},
          timeoutMs: 10_000,
          binding: makeBinding(context.selector, stale),
        }),
      );
      expect(result.code).toBe('REVISION_MISMATCH');
      expect(await rawOutputNames(context.root)).toEqual(before);
      return result;
    },
  },
  {
    id: 'revision-bundle',
    targetStatus: 'under-review',
    codes: ['REVISION_MISMATCH'],
    act: async (context) => {
      const before = await rawOutputNames(context.root);
      const stale = { ...context.revision, sourceBundleSha256: 'f'.repeat(64) };
      const result = await captureTyped(() =>
        context.runner.run(process.execPath, ['-e', 'process.stdout.write("must-not-run")'], {
          cwd: context.root,
          env: {},
          timeoutMs: 10_000,
          binding: makeBinding(context.selector, stale),
        }),
      );
      expect(result.code).toBe('REVISION_MISMATCH');
      expect(await revisionProvider.verify(context.root, stale)).toMatchObject({
        ok: false,
        code: 'REVISION_MISMATCH',
      });
      expect(await rawOutputNames(context.root)).toEqual(before);
      return result;
    },
  },
  {
    id: 'candidate-mismatch',
    targetStatus: 'under-review',
    codes: ['SCOPE_MISMATCH'],
    act: async (context) => {
      const result = await captureTyped(() =>
        context.evidenceStore.verify(
          {
            evidenceId: 'EVD-CANDIDATE-MISMATCH',
            candidateId: context.otherCandidateId,
            scopeHash: context.selector.scopeHash,
            relativePath: context.command.rawOutputPath,
            sha256: context.command.rawOutputSha256,
            revision: context.revision,
            observation: context.command.observation,
          },
          context.binding,
        ),
      );
      expect(result.code).toBe('SCOPE_MISMATCH');
      return result;
    },
  },
  {
    id: 'scope-mismatch',
    targetStatus: 'under-review',
    codes: ['SCOPE_MISMATCH'],
    act: async (context) => {
      const result = await captureTyped(() =>
        context.evidenceStore.verify(
          {
            evidenceId: 'EVD-SCOPE-MISMATCH',
            candidateId: context.candidateId,
            scopeHash: context.otherSelector.scopeHash,
            relativePath: context.command.rawOutputPath,
            sha256: context.command.rawOutputSha256,
            revision: context.revision,
            observation: context.command.observation,
          },
          context.binding,
        ),
      );
      expect(result.code).toBe('SCOPE_MISMATCH');
      return result;
    },
  },
  {
    id: 'cross-candidate',
    targetStatus: 'under-review',
    codes: ['SCOPE_MISMATCH'],
    act: async (context) => {
      const result = await captureTyped(() =>
        context.evidenceStore.verify(
          {
            evidenceId: 'EVD-CROSS-CANDIDATE',
            candidateId: context.candidateId,
            scopeHash: context.selector.scopeHash,
            relativePath: context.command.rawOutputPath,
            sha256: context.command.rawOutputSha256,
            revision: context.revision,
            observation: context.command.observation,
          },
          { ...context.binding, candidate: context.otherSelector },
        ),
      );
      expect(result.code).toBe('SCOPE_MISMATCH');
      return result;
    },
  },
  {
    id: 'env-unaudited',
    targetStatus: 'under-review',
    codes: ['SECURITY_BLOCKED'],
    act: async (context) => {
      const before = await rawOutputNames(context.root);
      const result = await captureTyped(() =>
        context.runner.run(process.execPath, ['-e', 'process.stdout.write("must-not-run")'], {
          cwd: context.root,
          env: { CODE_HEALTH_UNAUDITED: 'x' },
          timeoutMs: 10_000,
          binding: makeBinding(context.selector, context.revision),
        }),
      );
      expect(result.code).toBe('SECURITY_BLOCKED');
      expect(await rawOutputNames(context.root)).toEqual(before);
      return result;
    },
  },
  {
    id: 'command-sensitive',
    targetStatus: 'under-review',
    codes: ['SECURITY_BLOCKED'],
    act: async (context) => {
      const secretValue = 'should-never-appear-secret-value';
      const before = await rawOutputNames(context.root);
      const blocked = await captureTyped(() =>
        context.runner.run(process.execPath, ['-e', `process.stdout.write("authorization=${secretValue}")`], {
          cwd: context.root,
          env: {},
          timeoutMs: 10_000,
          binding: makeBinding(context.selector, context.revision),
        }),
      );
      expect(blocked.code).toBe('SECURITY_BLOCKED');
      expect(blocked.messages.join(' ')).not.toContain(secretValue);
      expect(await rawOutputNames(context.root)).toEqual(before);

      // Output-side secrets are assembled at runtime and must be redacted before persistence.
      const redacted = await context.runner.run(
        process.execPath,
        ['-e', 'process.stdout.write(["pass","word"].join("")+"="+["should","never","appear"].join("-"))'],
        {
          cwd: context.root,
          env: {},
          timeoutMs: 10_000,
          binding: makeBinding(context.selector, context.revision),
        },
      );
      const rawOutput = await fs.readFile(joinRelative(context.root, redacted.rawOutputPath), 'utf8');
      expect(rawOutput).not.toContain('should-never-appear');
      expect(rawOutput).toContain('[REDACTED]');
      return blocked;
    },
  },
  {
    id: 'command-shell',
    targetStatus: 'under-review',
    codes: ['SECURITY_BLOCKED', 'ARG_INVALID'],
    act: async (context) => {
      const before = await rawOutputNames(context.root);
      const result = await captureTyped(() =>
        context.runner.run(`node -e "process.exit(0)"`, [], {
          cwd: context.root,
          env: {},
          timeoutMs: 10_000,
          binding: makeBinding(context.selector, context.revision),
        }),
      );
      expect(result.code).toBe('ARG_INVALID');
      expect(await rawOutputNames(context.root)).toEqual(before);
      return result;
    },
  },
  {
    id: 'command-not-run',
    targetStatus: 'under-review',
    codes: ['EVIDENCE_INVALID'],
    act: async (context) => {
      const timedOut = await context.runner.run(process.execPath, ['-e', 'setTimeout(() => {}, 1000)'], {
        cwd: context.root,
        env: {},
        timeoutMs: 20,
        binding: makeBinding(context.selector, context.revision),
      });
      expect(timedOut).toMatchObject({ observation: 'not_run', exitCode: null });
      const recorded = await captureTyped(() =>
        recordVerifiedGateFailure(context.ledger, context.candidateId, timedOut, {
          repositoryRoot: context.root,
          fileVerifier,
          evidenceStore: context.evidenceStore,
          binding: bindCommand(makeBinding(context.selector, context.revision), timedOut),
        }),
      );
      expect(recorded.code).toBe('EVIDENCE_INVALID');
      return recorded;
    },
  },
  {
    id: 'command-unavailable',
    targetStatus: 'under-review',
    codes: ['EVIDENCE_INVALID'],
    act: async (context) => {
      const unavailable = await context.runner.run('definitely-not-a-real-code-health-command', [], {
        cwd: context.root,
        env: {},
        timeoutMs: 10_000,
        binding: makeBinding(context.selector, context.revision),
      });
      expect(unavailable).toMatchObject({ observation: 'unavailable', exitCode: null });
      const recorded = await captureTyped(() =>
        recordVerifiedGateFailure(context.ledger, context.candidateId, unavailable, {
          repositoryRoot: context.root,
          fileVerifier,
          evidenceStore: context.evidenceStore,
          binding: bindCommand(makeBinding(context.selector, context.revision), unavailable),
        }),
      );
      expect(recorded.code).toBe('EVIDENCE_INVALID');
      return recorded;
    },
  },
  {
    id: 'role-bypass',
    targetStatus: 'implemented',
    codes: ['ROLE_FORBIDDEN'],
    act: async (context) => {
      const implementedRevision = requireDefined(context.implementedRevision, 'implemented revision');
      const verificationEvent = (actorRole: LedgerEvent['actorRole'], offset: number): EventSpec => ({
        eventId: `EV-${context.candidateId}-${actorRole}-VERIFICATION`,
        eventKind: 'verification',
        candidateId: context.candidateId,
        from: 'implemented',
        to: 'verified',
        actorRole,
        at: afterLastEvent(context, offset),
        revision: implementedRevision,
        scopeHash: context.selector.scopeHash,
        evidenceRefs: [context.command.rawOutputPath],
        signatureRef: 'evidence/signature-role-bypass.json',
      });

      // A cannot record an approval/verification transition.
      const agentApproval = await captureTyped(() =>
        appendChainEvent(context.ledger, verificationEvent('A', 1), {
          root: context.root,
          approval: context.approval,
        }),
      );
      expect(agentApproval.code).toBe('ROLE_FORBIDDEN');

      // S cannot verify its own implementation.
      const selfVerified = await captureTyped(() =>
        appendChainEvent(context.ledger, verificationEvent('S', 2), { root: context.root }),
      );
      expect(selfVerified.code).toBe('ROLE_FORBIDDEN');

      // O never records a lifecycle transition.
      const orchestratorVerified = await captureTyped(() =>
        appendChainEvent(context.ledger, verificationEvent('O', 3), { root: context.root }),
      );
      expect(orchestratorVerified.code).toBe('ROLE_FORBIDDEN');

      // V and G are both authorized verifiers; their independence is enforced by distinct evidence refs.
      const vVerified = await appendChainEvent(context.ledger, verificationEvent('V', 4), { root: context.root });
      expect(vVerified.candidates.find((entry) => entry.candidateId === context.candidateId)?.status).toBe('verified');
      return selfVerified;
    },
  },
  {
    id: 'duplicate-event',
    targetStatus: 'under-review',
    codes: ['STRUCTURE_INVALID'],
    act: async (context) => {
      const existing = context.ledger.events[0];
      const result = await captureTyped(() =>
        appendChainEvent(
          context.ledger,
          {
            eventId: requireDefined(existing, 'creation event').eventId,
            eventKind: 'evidence',
            candidateId: context.candidateId,
            from: 'under-review',
            to: 'approved',
            actorRole: 'human',
            at: afterLastEvent(context, 1),
            revision: context.revision,
            scopeHash: context.selector.scopeHash,
            evidenceRefs: [context.command.rawOutputPath],
            signatureRef: 'evidence/signature-duplicate.json',
          },
          { root: context.root, approval: context.approval },
        ),
      );
      expect(result.code).toBe('STRUCTURE_INVALID');
      return result;
    },
  },
  {
    id: 'event-gap',
    targetStatus: 'under-review',
    codes: ['STRUCTURE_INVALID', 'TRANSITION_INVALID'],
    act: async (context) => {
      const previousEvent = context.ledger.events.filter((entry) => entry.candidateId === context.candidateId).at(-1);
      const previousAt = requireDefined(previousEvent, 'previous candidate event').at;
      // Time going backwards is a structural failure.
      const backwards = await captureTyped(() =>
        appendChainEvent(
          context.ledger,
          {
            eventId: `EV-${context.candidateId}-BACKWARDS`,
            eventKind: 'approval',
            candidateId: context.candidateId,
            from: 'under-review',
            to: 'approved',
            actorRole: 'human',
            at: new Date(Date.parse(previousAt) - 5000).toISOString(),
            revision: context.revision,
            scopeHash: context.selector.scopeHash,
            evidenceRefs: [context.command.rawOutputPath],
            signatureRef: 'evidence/signature-backwards.json',
          },
          { root: context.root, approval: context.approval },
        ),
      );
      expect(backwards.code).toBe('STRUCTURE_INVALID');

      // Skipping a lifecycle state is a transition failure.
      const skippedState = await captureTyped(() =>
        appendChainEvent(
          context.ledger,
          {
            eventId: `EV-${context.candidateId}-SKIP-STATE`,
            eventKind: 'verification',
            candidateId: context.candidateId,
            from: 'under-review',
            to: 'verified',
            actorRole: 'G',
            at: afterLastEvent(context, 1),
            revision: context.revision,
            scopeHash: context.selector.scopeHash,
            evidenceRefs: [context.command.rawOutputPath],
            signatureRef: 'evidence/signature-skip-state.json',
          },
          { root: context.root },
        ),
      );
      expect(skippedState.code).toBe('TRANSITION_INVALID');
      return backwards;
    },
  },
  {
    id: 'event-gap-blocked',
    targetStatus: 'blocked',
    codes: ['TRANSITION_INVALID'],
    act: async (context) => {
      // A blocked candidate may only return to evidenced through R→V→G plus an S rework event.
      const skippedChain = await captureTyped(() =>
        appendChainEvent(
          context.ledger,
          {
            eventId: `EV-${context.candidateId}-SKIP-CHAIN`,
            eventKind: 'rework',
            candidateId: context.candidateId,
            from: 'blocked',
            to: 'evidenced',
            actorRole: 'S',
            at: afterLastEvent(context, 1),
            revision: context.revision,
            scopeHash: context.selector.scopeHash,
            evidenceRefs: [context.command.rawOutputPath],
            signatureRef: 'evidence/signature-skip-chain.json',
          },
          { root: context.root },
        ),
      );
      expect(skippedChain.code).toBe('TRANSITION_INVALID');
      expect(nextRequiredRoles(context.ledger, context.candidateId)).toEqual(['R', 'V', 'G', 'S']);
      const archived = await captureTyped(() =>
        appendChainEvent(
          context.ledger,
          {
            eventId: `EV-${context.candidateId}-SKIP-ARCHIVE`,
            eventKind: 'archive',
            candidateId: context.candidateId,
            from: 'blocked',
            to: 'archived',
            actorRole: 'G',
            at: afterLastEvent(context, 2),
            revision: context.revision,
            scopeHash: context.selector.scopeHash,
            evidenceRefs: [context.command.rawOutputPath],
            signatureRef: 'evidence/signature-skip-archive.json',
            archiveEvidence: {
              manifestRef: 'archive/manifest.json',
              manifestSha256: 'a'.repeat(64),
              verificationLevel: 'package-only',
              sourceRevision: context.revision,
              redactionStatus: 'clean',
            },
          },
          { root: context.root },
        ),
      );
      expect(archived.code).toBe('TRANSITION_INVALID');
      return skippedChain;
    },
  },
  {
    id: 'gap-invalid',
    targetStatus: 'under-review',
    codes: [],
    typedCode: false,
    act: async (context) => {
      const validRow = makeValidGapRow(context.candidateId);
      expect(validateGapRow(validRow, context.ledger, new Set())).toEqual([]);
      const reasons = [
        ...validateGapRow({ ...validRow, kind: 'not-a-kind' }, context.ledger, new Set()),
        ...validateGapRow({ ...validRow, priority: 'urgent' }, context.ledger, new Set()),
        ...validateGapRow({ ...validRow, status: 'archived' }, context.ledger, new Set()),
        ...validateGapRow(
          { gapId: validRow.gapId, candidateId: context.candidateId, status: 'discovered' },
          context.ledger,
          new Set(),
        ),
        ...validateGapRow({ ...validRow, unexpectedField: true }, context.ledger, new Set()),
        ...validateGapRow({ ...validRow, coverageIsSignalOnly: false }, context.ledger, new Set()),
      ];
      expect(reasons.length).toBeGreaterThan(0);
      expect(reasons.join('; ')).toMatch(/kind is invalid/i);
      expect(reasons.join('; ')).toMatch(/priority is invalid/i);
      expect(reasons.join('; ')).toMatch(/status is invalid/i);
      expect(reasons.join('; ')).toMatch(/risk is required/i);
      expect(reasons.join('; ')).toMatch(/unknown property/i);
      expect(reasons.join('; ')).toMatch(/coverageIsSignalOnly/i);
      const matrixReasons = validateGapMatrix({ rows: [{ ...validRow, kind: 'not-a-kind' }] }, context.ledger);
      expect(matrixReasons.length).toBeGreaterThan(0);
      return { code: null, messages: [...reasons, ...matrixReasons] };
    },
  },
  {
    id: 'approval-scope',
    targetStatus: 'under-review',
    codes: ['EVIDENCE_INVALID', 'SCOPE_MISMATCH'],
    act: async (context) => {
      const eventIdPrefix = `EV-${context.candidateId}-APPROVAL-SCOPE`;
      const rejected = await captureTyped(() =>
        transitionCandidateVerified(
          context.ledger,
          context.candidateId,
          makeEvent({
            eventId: `${eventIdPrefix}-EXPANDED`,
            eventKind: 'approval',
            candidateId: context.candidateId,
            from: 'under-review',
            to: 'approved',
            actorRole: 'human',
            at: afterLastEvent(context, 1),
            revision: context.revision,
            scopeHash: context.selector.scopeHash,
            evidenceRefs: [context.command.rawOutputPath],
            signatureRef: 'evidence/signature-expanded-approval.json',
          }),
          { ...context.approval, approvedFiles: [...context.selector.files, 'src/extra.ts'] },
          verificationContext(context.root),
        ),
      );
      expect(rejected.code).toBe('EVIDENCE_INVALID');

      const otherCandidate = await captureTyped(() =>
        transitionCandidateVerified(
          context.ledger,
          context.candidateId,
          makeEvent({
            eventId: `${eventIdPrefix}-CANDIDATE`,
            eventKind: 'approval',
            candidateId: context.candidateId,
            from: 'under-review',
            to: 'approved',
            actorRole: 'human',
            at: afterLastEvent(context, 2),
            revision: context.revision,
            scopeHash: context.selector.scopeHash,
            evidenceRefs: [context.command.rawOutputPath],
            signatureRef: 'evidence/signature-other-candidate-approval.json',
          }),
          { ...context.approval, candidateId: context.otherCandidateId },
          verificationContext(context.root),
        ),
      );
      expect(otherCandidate.code).toBe('EVIDENCE_INVALID');

      const agent = await captureTyped(() =>
        transitionCandidateVerified(
          context.ledger,
          context.candidateId,
          makeEvent({
            eventId: `${eventIdPrefix}-AGENT`,
            eventKind: 'approval',
            candidateId: context.candidateId,
            from: 'under-review',
            to: 'approved',
            actorRole: 'human',
            at: afterLastEvent(context, 3),
            revision: context.revision,
            scopeHash: context.selector.scopeHash,
            evidenceRefs: [context.command.rawOutputPath],
            signatureRef: 'evidence/signature-agent-approval.json',
          }),
          { ...context.approval, actor: 'orchestrator-bot' },
          verificationContext(context.root),
        ),
      );
      expect(agent.code).toBe('EVIDENCE_INVALID');

      const candidate = requireDefined(
        context.ledger.candidates.find((entry) => entry.candidateId === context.candidateId),
        'addressed candidate',
      );
      const applyScope = await captureTyped(() =>
        applyApproved({
          candidate,
          approval: { ...context.approval, approvedFiles: [...context.selector.files, 'src/extra.ts'] },
          mode: 'dry-run',
          repositoryRoot: context.root,
          currentRevision: context.revision,
        }),
      );
      expect(applyScope.code).toBe('SCOPE_MISMATCH');
      return rejected;
    },
  },
  {
    id: 'apply-approval-scope-guard',
    targetStatus: 'approved',
    codes: ['SCOPE_MISMATCH'],
    act: async (context) => {
      const candidate = requireDefined(
        context.ledger.candidates.find((entry) => entry.candidateId === context.candidateId),
        'approved candidate',
      );
      const outcome = await captureTyped(() =>
        applyApproved({
          candidate,
          approval: { ...context.approval, approvedFiles: [...context.selector.files, 'src/extra.ts'] },
          mode: 'commit',
          repositoryRoot: context.root,
          currentRevision: context.revision,
        }),
      );
      expect(outcome.code).toBe('SCOPE_MISMATCH');
      return outcome;
    },
  },
  {
    id: 'archive-not-implemented',
    targetStatus: 'verified',
    codes: ['NOT_IMPLEMENTED'],
    act: async (context) => {
      const candidate = requireDefined(
        context.ledger.candidates.find((entry) => entry.candidateId === context.candidateId),
        'verified candidate',
      );
      const boundary = createTask1ArchiveBoundary();
      const results = [
        await boundary.producer.produce({
          candidate,
          ledger: context.ledger,
          approval: context.approval,
          verificationLevel: 'package-only',
        }),
        await boundary.consumer.consume({
          manifestPath: 'archive/manifest.json',
          packageRoot: context.root,
          verificationLevel: 'package-only',
        }),
        await boundary.verifier.verify({
          manifestPath: 'archive/manifest.json',
          packageRoot: context.root,
          verificationLevel: 'source-bound',
          sourceProject: context.root,
          expectedRevision: context.revision,
        }),
      ];
      for (const result of results) {
        expect(result).toMatchObject({ ok: false, errorCode: 'NOT_IMPLEMENTED', manifest: null, createdPaths: [] });
      }
      expect(await exists(path.join(context.root, 'archive'))).toBe(false);
      return { code: results[0]?.errorCode ?? null, messages: results.map((result) => result.reason) };
    },
  },
];

/* ------------------------------------------------------------------ tests */

describe('code-health task1 isolated git integration', () => {
  it('真实 Git command→raw evidence→FileVerifier→candidate→V→human→S implemented→G/V verified 链路通过', async () => {
    const repoStatusBefore = await gitStatusPorcelain(repoRoot);
    const repoDiffBefore = await gitDiffNames(repoRoot);
    const chain = await runRealApprovedChain();
    const { boundaries, selector, initialRevision, implementedRevision, approval, verifiedLedger } = chain;

    expect(await gitStatusPorcelain(boundaries.root)).toBe('');
    expect(await revisionProvider.current(boundaries.root)).not.toBeNull();
    expect(implementedRevision).not.toEqual(initialRevision);
    expect(initialRevision.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(initialRevision.treeSha).toMatch(/^[0-9a-f]{40}$/);
    expect(initialRevision.sourceBundleSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(implementedRevision.treeSha).not.toBe(initialRevision.treeSha);
    expect(implementedRevision.sourceBundleSha256).not.toBe(initialRevision.sourceBundleSha256);

    const verifiedCandidate = requireDefined(
      verifiedLedger.candidates.find((entry) => entry.candidateId === selector.candidateId),
      'verified candidate',
    );
    expect(verifiedCandidate.status).toBe('verified');
    expect(verifiedCandidate.revision).toEqual(implementedRevision);
    expect(verifiedCandidate.evidenceBinding.revision).toEqual(implementedRevision);
    expect(validateCodeHealthCandidate(verifiedCandidate)).toEqual([]);

    const events = verifiedLedger.events.filter((entry) => entry.candidateId === selector.candidateId);
    expect(events.map((entry) => entry.eventKind)).toEqual([
      'discovery',
      'evidence',
      'review',
      'approval',
      'implementation',
      'verification',
    ]);
    expect(events.map((entry) => entry.actorRole)).toEqual(['A', 'A', 'V', 'human', 'S', 'G']);
    const reviewEvent = requireDefined(
      events.find((entry) => entry.eventKind === 'review'),
      'review event',
    );
    const gateEvent = requireDefined(
      events.find((entry) => entry.eventKind === 'verification'),
      'verification event',
    );
    expect(reviewEvent.actorRole).not.toBe(gateEvent.actorRole);
    expect(reviewEvent.evidenceRefs).not.toEqual(gateEvent.evidenceRefs);
    const evidenceRefs = events.flatMap((entry) => entry.evidenceRefs);
    expect(new Set(evidenceRefs).size).toBe(evidenceRefs.length);
    for (const event of events) {
      expect(event.evidenceRefs.length).toBeGreaterThan(0);
      expect(event.revision.commitSha).toMatch(/^[0-9a-f]{40}$/);
    }
    expect(
      requireDefined(
        events.find((entry) => entry.eventKind === 'approval'),
        'approval event',
      ).revision,
    ).toEqual(initialRevision);
    expect(
      requireDefined(
        events.find((entry) => entry.eventKind === 'implementation'),
        'implementation event',
      ).previousRevision,
    ).toEqual(initialRevision);

    const otherCandidate = requireDefined(
      verifiedLedger.candidates.find((entry) => entry.candidateId === chain.otherSelector.candidateId),
      'other candidate',
    );
    expect(otherCandidate.status).toBe('discovered');

    const archive = await createTask1ArchiveBoundary().producer.produce({
      candidate: verifiedCandidate,
      ledger: verifiedLedger,
      approval,
      verificationLevel: 'package-only',
    });
    expect(archive).toMatchObject({ ok: false, errorCode: 'NOT_IMPLEMENTED', manifest: null });
    expect(await fs.stat(path.join(boundaries.root, 'archive')).catch(() => null)).toBeNull();

    expect(await gitStatusPorcelain(boundaries.root)).toBe('');
    await expectRepositoryRootUnpolluted(repoStatusBefore, repoDiffBefore);
  });

  it('applyApproved 生成精确 scope 的 patch proposal，archive boundary 保持 NOT_IMPLEMENTED 且 clean worktree', async () => {
    const repoStatusBefore = await gitStatusPorcelain(repoRoot);
    const repoDiffBefore = await gitDiffNames(repoRoot);
    const project = await createIsolatedProject();
    const boundaries = createProjectBoundaries(project.root);
    const selector = makeSelector('CHG-P1-20260907-211', ['src/candidate.ts'], ['candidate']);
    const otherSelector = makeSelector(
      'CHG-P1-20260907-212',
      ['tests/candidate.test.ts'],
      ['observedCandidate'],
      `sha256:${'f'.repeat(64)}`,
    );
    const approval = makeApproval(selector, project.initialRevision);
    const commands: ChainCommands = {
      creation: await runBoundCommand(
        boundaries,
        selector,
        project.initialRevision,
        'process.stdout.write("A creation raw")',
      ),
      evidence: await runBoundCommand(
        boundaries,
        selector,
        project.initialRevision,
        'process.stdout.write("evidence")',
      ),
      otherCreation: await runBoundCommand(
        boundaries,
        otherSelector,
        project.initialRevision,
        'process.stdout.write("A other creation raw")',
      ),
      review: await runBoundCommand(
        boundaries,
        selector,
        project.initialRevision,
        'process.stdout.write("V review raw")',
      ),
      humanApproval: await runBoundCommand(
        boundaries,
        selector,
        project.initialRevision,
        'process.stdout.write("human approval raw")',
      ),
    };

    const approvedLedger = await buildIsolatedLedger({
      boundaries,
      selector,
      otherSelector,
      initialRevision: project.initialRevision,
      implementedRevision: null,
      target: 'approved',
      approval,
      commands,
    });
    const approvedCandidateFixture = requireDefined(
      approvedLedger.candidates.find((entry) => entry.candidateId === selector.candidateId),
      'approved candidate',
    );

    // Task 3 resolves a real exact-scope approval into a controlled patch proposal; the pure planner never
    // writes and the IO executor is the only delete path (never exercised here).
    const apply = await applyApproved({
      candidate: approvedCandidateFixture,
      approval,
      mode: 'patch',
      repositoryRoot: project.root,
      currentRevision: project.initialRevision,
    });
    expect(apply).toMatchObject({
      kind: 'patch-proposal',
      applied: false,
      errorCode: null,
      mode: 'patch',
      patchPath: expect.stringMatching(/\.patch$/),
      appliedFiles: [],
      unrelatedFiles: [],
    });
    expect(apply.rollback?.executable).toBe(true);

    const implementedRevision = await commitImplementedState(project.root);
    const implementedCommands: ChainCommands = {
      ...commands,
      implementation: await runBoundCommand(
        boundaries,
        selector,
        implementedRevision,
        'process.stdout.write("S implementation")',
      ),
      verification: await runBoundCommand(
        boundaries,
        selector,
        implementedRevision,
        'process.stdout.write("G verification")',
      ),
    };
    const verifiedLedger = await buildIsolatedLedger({
      boundaries,
      selector,
      otherSelector,
      initialRevision: project.initialRevision,
      implementedRevision,
      target: 'verified',
      approval,
      commands: implementedCommands,
    });
    const verifiedCandidateFixture = requireDefined(
      verifiedLedger.candidates.find((entry) => entry.candidateId === selector.candidateId),
      'verified candidate',
    );
    expect(verifiedCandidateFixture.status).toBe('verified');
    expect(verifiedCandidateFixture.archive.state).toBe('not_archived');

    const before = await snapshotTree(project.root);
    const beforeHead = await gitHead(project.root);
    const beforeStatus = await gitStatusPorcelain(project.root);
    const ledgerBefore = structuredClone(verifiedLedger);

    // A stale approval (pre-implementation revision) can never be applied to the implemented revision.
    const staleApply = await captureTyped(() =>
      applyApproved({
        candidate: verifiedCandidateFixture,
        approval,
        mode: 'patch',
        repositoryRoot: project.root,
        currentRevision: implementedRevision,
      }),
    );
    expect(staleApply.code).toBe('REVISION_MISMATCH');

    const boundary = createTask1ArchiveBoundary();
    for (const result of [
      await boundary.producer.produce({
        candidate: verifiedCandidateFixture,
        ledger: verifiedLedger,
        approval,
        verificationLevel: 'package-only',
      }),
      await boundary.consumer.consume({
        manifestPath: 'archive/manifest.json',
        packageRoot: project.root,
        verificationLevel: 'package-only',
      }),
      await boundary.verifier.verify({
        manifestPath: 'archive/manifest.json',
        packageRoot: project.root,
        verificationLevel: 'source-bound',
        sourceProject: project.root,
        expectedRevision: implementedRevision,
      }),
    ]) {
      expect(result.errorCode).toBe('NOT_IMPLEMENTED');
      expect(result.manifest).toBeNull();
      expect(result.ok).toBe(false);
      expect(result.createdPaths).toEqual([]);
    }

    expect(await snapshotTree(project.root)).toEqual(before);
    expect(await gitHead(project.root)).toBe(beforeHead);
    expect(await gitStatusPorcelain(project.root)).toBe(beforeStatus);
    expect(verifiedLedger).toEqual(ledgerBefore);
    expect(await listRelativePaths(project.root, (relativePath) => relativePath.endsWith('.patch'))).toEqual([]);
    expect(await exists(path.join(project.root, 'archive'))).toBe(false);
    for (const candidate of verifiedLedger.candidates) expect(candidate.archive.state).toBe('not_archived');
    await expectRepositoryRootUnpolluted(repoStatusBefore, repoDiffBefore);
  });

  it('negative matrix worktree-clean：正向完成后临时项目与仓库根目录 status 均为空', async () => {
    const repoStatusBefore = await gitStatusPorcelain(repoRoot);
    const repoDiffBefore = await gitDiffNames(repoRoot);
    const chain = await runRealApprovedChain();
    expect(await gitStatusPorcelain(chain.boundaries.root)).toBe('');
    expect(await gitDiffNames(chain.boundaries.root)).toEqual([]);
    expect(await gitHeadNames(chain.boundaries.root)).toEqual(['src/candidate.ts']);
    expect(chain.verifiedLedger.candidates.every((entry) => entry.archive.state === 'not_archived')).toBe(true);
    expect(await exists(path.join(chain.boundaries.root, 'archive'))).toBe(false);
    await expectRepositoryRootUnpolluted(repoStatusBefore, repoDiffBefore);
  });

  it('negative matrix command-nonzero：真实 exit 7 只记录为 blocked 失败链，不能当作 pass', async () => {
    const context = await createNegativeContext({ caseId: 'command-nonzero', targetStatus: 'under-review' });
    const repoStatusBefore = await gitStatusPorcelain(repoRoot);
    const repoDiffBefore = await gitDiffNames(repoRoot);
    const before = structuredClone(context.ledger);
    const failing = await context.runner.run(process.execPath, ['-e', 'process.exit(7)'], {
      cwd: context.root,
      env: {},
      timeoutMs: 10_000,
      binding: makeBinding(context.selector, context.revision),
    });
    expect(failing).toMatchObject({ observation: 'observed', exitCode: 7 });
    expect(failing.exitCode).not.toBe(0);

    const blockedLedger = await recordVerifiedGateFailure(context.ledger, context.candidateId, failing, {
      repositoryRoot: context.root,
      fileVerifier,
      evidenceStore: context.evidenceStore,
      binding: bindCommand(makeBinding(context.selector, context.revision), failing),
    });
    const blockedCandidate = blockedLedger.candidates.find((entry) => entry.candidateId === context.candidateId);
    expect(blockedCandidate?.status).toBe('blocked');
    expect(blockedCandidate?.revision).toEqual(context.revision);
    expect(blockedCandidate?.archive.state).toBe('not_archived');
    expect(nextRequiredRoles(blockedLedger, context.candidateId)).toEqual(['R', 'V', 'G', 'S']);
    expect(context.ledger).toEqual(before);
    expect(blockedLedger.events).toHaveLength(before.events.length + 1);
    const blockedEvent = requireDefined(blockedLedger.events.at(-1), 'blocked event');
    expect(blockedEvent).toMatchObject({ eventKind: 'gate-failure', to: 'blocked', actorRole: 'G' });
    expect(blockedEvent.evidenceRefs).toEqual([failing.rawOutputPath]);
    expect(blockedEvent.gateFailureEvidence?.exitCode).toBe(7);
    expect(blockedLedger.candidates.find((entry) => entry.candidateId === context.otherCandidateId)).toEqual(
      before.candidates.find((entry) => entry.candidateId === context.otherCandidateId),
    );

    const refused = await captureTyped(() =>
      appendChainEvent(
        blockedLedger,
        {
          eventId: `EV-${context.candidateId}-FAILED-PASS`,
          eventKind: 'verification',
          candidateId: context.candidateId,
          from: 'blocked',
          to: 'verified',
          actorRole: 'G',
          at: new Date(Date.parse(blockedEvent.at) + 1000).toISOString(),
          revision: context.revision,
          scopeHash: context.selector.scopeHash,
          evidenceRefs: [failing.rawOutputPath],
          signatureRef: 'evidence/signature-failed-pass.json',
        },
        { root: context.root },
      ),
    );
    expect(refused.code).toBe('TRANSITION_INVALID');
    expect(await exists(path.join(context.root, 'archive'))).toBe(false);
    await expectRepositoryRootUnpolluted(repoStatusBefore, repoDiffBefore);
  });

  for (const testCase of negativeCases) {
    it(`negative matrix ${testCase.id}：fail-closed typed 结果且 ledger/项目无副作用`, async () => {
      const context = await createNegativeContext({
        caseId: testCase.id,
        targetStatus: testCase.targetStatus,
        ...(testCase.symlinks === true ? { symlinks: true } : {}),
      });
      const repoStatusBefore = await gitStatusPorcelain(repoRoot);
      const repoDiffBefore = await gitDiffNames(repoRoot);
      const ledgerBefore = structuredClone(context.ledger);
      const headBefore = await gitHead(context.root);
      const statusBefore = await gitStatusPorcelain(context.root);
      const rawOutputsBefore = await rawOutputNames(context.root);

      const outcome = await testCase.act(context);

      if (testCase.typedCode === false) {
        expect(outcome.messages.length).toBeGreaterThan(0);
      } else {
        expect(testCase.codes).toContain(outcome.code);
        expect(outcome.code).not.toBeNull();
      }

      // Ledger atomicity: the reducer entry points never mutate the input ledger.
      expect(context.ledger).toEqual(ledgerBefore);
      expect(context.ledger.events).toHaveLength(ledgerBefore.events.length);
      for (const candidateBefore of ledgerBefore.candidates) {
        const candidateAfter = context.ledger.candidates.find(
          (entry) => entry.candidateId === candidateBefore.candidateId,
        );
        expect(candidateAfter).toEqual(candidateBefore);
        expect(candidateAfter?.archive.state).not.toBe('archived');
        expect([...(candidateAfter?.changeScope.files ?? [])].sort()).toEqual(
          [...candidateBefore.changeScope.files].sort(),
        );
      }

      // No archive, patch, commit, or manifest may be produced by any failing path.
      expect(await exists(path.join(context.root, 'archive'))).toBe(false);
      expect(await listRelativePaths(context.root, (relativePath) => relativePath.endsWith('.patch'))).toEqual([]);
      expect(await gitHead(context.root)).toBe(headBefore);
      expect(await gitStatusPorcelain(context.root)).toBe(statusBefore);

      // Errors must not leak the temporary absolute paths or secret values.
      const messages = outcome.messages.join(' ');
      expect(messages).not.toContain(context.root);
      expect(messages).not.toContain(context.outsideRoot);
      expect(messages).not.toContain('should-never-appear-secret-value');
      expect(messages.toLowerCase()).not.toContain('authorization=');

      // Non-zero commands may write real raw evidence, but failing checks must not add new raw outputs.
      if (testCase.id === 'utf8-invalid' || testCase.id === 'revision-commit' || testCase.id === 'revision-tree') {
        expect(await rawOutputNames(context.root)).toEqual(rawOutputsBefore);
      }
      await expectRepositoryRootUnpolluted(repoStatusBefore, repoDiffBefore);
    });
  }
});
