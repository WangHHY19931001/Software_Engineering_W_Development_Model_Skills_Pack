/* eslint-disable security/detect-non-literal-fs-filename -- All filesystem paths are generated beneath test-owned temporary roots. */
/**
 * Task 3 CLI acceptance: `code-health-ledger` (init/append/validate) and `code-health-apply`.
 *
 * Safety boundary: every real write / delete happens inside an isolated temporary Git repository this
 * test creates and removes. The repository worktree is only ever read (`git status` / `git diff`) to
 * prove it was never touched. The `GIT_ENV` recipe is reused from `code-health-evidence.test.ts`.
 */

import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  applyApproved,
  executeRollback,
  type ApprovalDecision,
  type CodeHealthCandidate,
  type CodeHealthLedger,
  type LedgerEvent,
  type RevisionIdentity,
} from '../logic/code-health-ledger-logic.js';
import type { ApplyResult } from '../logic/code-health-contract.js';
import { createCodeHealthGitRevisionProvider } from '../lib/code-health-revision-provider.js';
import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '../../..');
const CLI_DIR = path.join(REPO_ROOT, 'w-model-dev/scripts/cli');
const APPLY_SAMPLES = path.join(REPO_ROOT, 'w-model-dev/scripts/samples/code-health/apply');

const revisionProvider = createCodeHealthGitRevisionProvider();

const GIT_ENV = {
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
  GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: 'code-health-cli',
  GIT_AUTHOR_EMAIL: 'code-health-cli@example.test',
  GIT_COMMITTER_NAME: 'code-health-cli',
  GIT_COMMITTER_EMAIL: 'code-health-cli@example.test',
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

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true, maxRetries: 3 })));
});

interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runCli(script: string, args: string[], cwd: string = REPO_ROOT): CliResult {
  const r = runSync(process.execPath, [tsxCli, path.join(CLI_DIR, script), ...args], {
    cwd,
    timeout: 90_000,
    env: { ...process.env, ...GIT_ENV },
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function jsonLine<T>(stdout: string, prefix: string): T | null {
  const line = stdout.split(/\r?\n/).find((entry) => entry.startsWith(`${prefix} `));
  if (line === undefined) return null;
  try {
    return JSON.parse(line.slice(prefix.length + 1)) as T;
  } catch {
    return null;
  }
}

async function git(root: string, args: string[]): Promise<CliResult> {
  const r = runSync('git', args, { cwd: root, timeout: 30_000, env: GIT_ENV });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

async function gitStatus(root: string): Promise<string> {
  return (await git(root, ['status', '--porcelain', '--untracked-files=all'])).stdout.trim();
}

async function gitHead(root: string): Promise<string> {
  return (await git(root, ['rev-parse', 'HEAD'])).stdout.trim();
}

async function tempRoot(prefix: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), prefix));
  createdRoots.push(root);
  return root;
}

async function createTempGitRepository(): Promise<string> {
  const root = await tempRoot('code-health-cli-repo-');
  await git(root, ['init', '--quiet']);
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'unused.ts'), 'export const unusedFunction = 1;\n');
  await fs.writeFile(path.join(root, '.gitignore'), '.w-model/\n');
  await git(root, ['add', '--all']);
  await git(root, ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'initial']);
  return root;
}

interface ApplyFixture {
  description: string;
  mode: 'dry-run' | 'patch' | 'commit';
  candidate: CodeHealthCandidate;
  approval: ApprovalDecision | null;
}

async function loadApplyFixture(name: string): Promise<ApplyFixture> {
  return JSON.parse(await fs.readFile(path.join(APPLY_SAMPLES, name), 'utf8')) as ApplyFixture;
}

async function writeJson(dir: string, name: string, value: unknown): Promise<string> {
  const target = path.join(dir, name);
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return target;
}

/** Bind the fixture candidate/approval to the isolated repository's real revision. */
function bindRevision(
  fixture: ApplyFixture,
  revision: RevisionIdentity,
): { candidate: CodeHealthCandidate; approval: ApprovalDecision } {
  const candidate: CodeHealthCandidate = structuredClone(fixture.candidate);
  candidate.revision = revision;
  candidate.evidenceBinding = { ...candidate.evidenceBinding, revision };
  candidate.rollback = {
    ...candidate.rollback,
    preChangeRevision: revision.commitSha,
    command: `git apply -R .w-model/code-health/apply/${candidate.candidateId}.patch`,
    patchPath: `.w-model/code-health/apply/${candidate.candidateId}.patch`,
  };
  const approval: ApprovalDecision = { ...(fixture.approval as ApprovalDecision), revision };
  return { candidate, approval };
}

let validFixture: ApplyFixture;
let approvalRequiredFixture: ApplyFixture;
let scopeMismatchFixture: ApplyFixture;
let rollbackFailureFixture: ApplyFixture;

beforeAll(async () => {
  [validFixture, approvalRequiredFixture, scopeMismatchFixture, rollbackFailureFixture] = await Promise.all([
    loadApplyFixture('valid-patch.json'),
    loadApplyFixture('approval-required.json'),
    loadApplyFixture('scope-mismatch.json'),
    loadApplyFixture('rollback-failure.json'),
  ]);
});

describe('code-health-apply CLI guard ordering (R7)', () => {
  it('unknown mode → exit 2 ERROR_JSON，即使 candidate 文件不存在也先报参数错误', () => {
    const r = runCli('code-health-apply.ts', [
      '--candidate',
      path.join(tmpdir(), 'definitely-missing-code-health-candidate.json'),
      '--mode',
      'bad',
    ]);
    expect(r.code).toBe(2);
    expect(r.stdout).toContain('ERROR_JSON');
    expect(r.stdout).not.toContain('HUMAN_APPROVAL_REQUIRED');
  });

  it('duplicated value flag → exit 2 ERROR_JSON', () => {
    const r = runCli('code-health-apply.ts', ['--mode', 'patch', '--mode=commit']);
    expect(r.code).toBe(2);
    expect(r.stdout).toContain('ERROR_JSON');
  });

  it('missing value → exit 2 ERROR_JSON', () => {
    const r = runCli('code-health-apply.ts', ['--candidate']);
    expect(r.code).toBe(2);
    expect(r.stdout).toContain('ERROR_JSON');
  });

  it('unknown flag → exit 2 ERROR_JSON', () => {
    const r = runCli('code-health-apply.ts', ['--candidate', 'x.json', '--force']);
    expect(r.code).toBe(2);
    expect(r.stdout).toContain('ERROR_JSON');
  });
});

describe('code-health-apply approval gate (R5/R7)', () => {
  it('无 approval 或 approval scope 与 candidate 不一致时，apply 只输出 proposal 且工作树不变', async () => {
    const root = await createTempGitRepository();
    const revision = await revisionProvider.current(root);
    expect(revision).not.toBeNull();
    const workDir = await tempRoot('code-health-cli-inputs-');
    const { candidate } = bindRevision(validFixture, revision as RevisionIdentity);
    const candidatePath = await writeJson(workDir, 'candidate.json', candidate);

    const before = await gitStatus(root);
    const headBefore = await gitHead(root);

    const missing = runCli('code-health-apply.ts', ['--candidate', candidatePath, '--root', root, '--mode', 'apply']);
    expect(missing.code).toBe(1);
    expect(missing.stdout).toContain('HUMAN_APPROVAL_REQUIRED');

    const scope = await bindRevision(scopeMismatchFixture, revision as RevisionIdentity);
    const approvalPath = await writeJson(workDir, 'approval.json', scope.approval);
    const mismatched = runCli('code-health-apply.ts', [
      '--candidate',
      candidatePath,
      '--approval',
      approvalPath,
      '--root',
      root,
      '--mode',
      'commit',
    ]);
    expect(mismatched.code).toBe(1);
    expect(mismatched.stdout).toContain('HUMAN_APPROVAL_REQUIRED');

    expect(await gitStatus(root)).toBe(before);
    expect(await gitHead(root)).toBe(headBefore);
  });

  it('approved directory scope fails closed: a directory path is never written as a deletion patch', async () => {
    const root = await createTempGitRepository();
    const revision = (await revisionProvider.current(root)) as RevisionIdentity;
    const workDir = await tempRoot('code-health-cli-inputs-');
    // A human approval whose exact scope names a DIRECTORY (`src`) rather than a regular file. The plan is
    // accepted (approval scope matches the candidate exactly), but the real patch builder must refuse a
    // non-regular path, so nothing is written and the worktree is untouched.
    const directoryCandidate: CodeHealthCandidate = (() => {
      const { candidate } = bindRevision(validFixture, revision);
      return {
        ...candidate,
        changeScope: { ...candidate.changeScope, files: ['src'] },
        files: ['src'],
      };
    })();
    const directoryApproval: ApprovalDecision = {
      ...(validFixture.approval as ApprovalDecision),
      approvedFiles: ['src'],
      revision,
    };
    const candidatePath = await writeJson(workDir, 'candidate.json', directoryCandidate);
    const approvalPath = await writeJson(workDir, 'approval.json', directoryApproval);
    const before = await gitStatus(root);
    const headBefore = await gitHead(root);

    const r = runCli('code-health-apply.ts', [
      '--candidate',
      candidatePath,
      '--approval',
      approvalPath,
      '--root',
      root,
      '--mode',
      'patch',
    ]);
    expect(r.code).toBe(1);
    const summary = jsonLine<{ kind: string; applied: boolean; errorCode: string | null; patchPath: string | null }>(
      r.stdout,
      'APPLY_JSON',
    );
    expect(summary?.kind).toBe('blocked');
    expect(summary?.applied).toBe(false);
    expect(summary?.patchPath).toBeNull();
    expect(summary?.errorCode).toBe('EVIDENCE_INVALID');
    expect(await gitStatus(root)).toBe(before);
    expect(await gitHead(root)).toBe(headBefore);
  });

  it('approved scope with a symlinked parent directory never reads outside file contents into the patch', async () => {
    const root = await createTempGitRepository();
    const revision = (await revisionProvider.current(root)) as RevisionIdentity;
    const workDir = await tempRoot('code-health-cli-inputs-');
    // A real file OUTSIDE the controlled root, reachable only through a symlinked parent directory inside
    // it. The canonical-root containment rule must refuse the read (SECURITY_BLOCKED), not fold the
    // outside bytes into the controlled patch.
    const outsideDir = await tempRoot('code-health-cli-outside-');
    await fs.writeFile(path.join(outsideDir, 'secret.ts'), 'export const outsideSecret = 1;\n', 'utf8');
    const linkPath = path.join(root, 'linked');
    await fs.symlink(outsideDir, linkPath, 'dir');
    const before = await gitStatus(root);

    const { candidate } = bindRevision(validFixture, revision);
    const linkedCandidate: CodeHealthCandidate = {
      ...candidate,
      changeScope: { ...candidate.changeScope, files: ['linked/secret.ts'] },
      files: ['linked/secret.ts'],
    };
    const linkedApproval: ApprovalDecision = {
      ...(validFixture.approval as ApprovalDecision),
      approvedFiles: ['linked/secret.ts'],
      revision,
    };
    const candidatePath = await writeJson(workDir, 'candidate.json', linkedCandidate);
    const approvalPath = await writeJson(workDir, 'approval.json', linkedApproval);

    const r = runCli('code-health-apply.ts', [
      '--candidate',
      candidatePath,
      '--approval',
      approvalPath,
      '--root',
      root,
      '--mode',
      'patch',
    ]);
    expect(r.code).toBe(1);
    const summary = jsonLine<{ kind: string; applied: boolean; errorCode: string | null; patchPath: string | null }>(
      r.stdout,
      'APPLY_JSON',
    );
    expect(summary?.kind).toBe('blocked');
    expect(summary?.applied).toBe(false);
    expect(summary?.patchPath).toBeNull();
    expect(['SECURITY_BLOCKED', 'EVIDENCE_INVALID']).toContain(summary?.errorCode);
    // No controlled patch leaked the outside content, and the real worktree is untouched.
    const patchAbsolute = path.join(root, '.w-model', 'code-health', 'apply', `${linkedCandidate.candidateId}.patch`);
    expect(await fs.readFile(patchAbsolute, 'utf8').catch(() => '')).not.toContain('outsideSecret');
    expect(await gitStatus(root)).toBe(before);
  });

  it('批准的 patch 模式只生成受控 patch，不改变隔离项目工作树', async () => {
    const root = await createTempGitRepository();
    const revision = (await revisionProvider.current(root)) as RevisionIdentity;
    const workDir = await tempRoot('code-health-cli-inputs-');
    const { candidate, approval } = bindRevision(validFixture, revision);
    const candidatePath = await writeJson(workDir, 'candidate.json', candidate);
    const approvalPath = await writeJson(workDir, 'approval.json', approval);
    const before = await gitStatus(root);

    const r = runCli('code-health-apply.ts', [
      '--candidate',
      candidatePath,
      '--approval',
      approvalPath,
      '--root',
      root,
      '--mode',
      'patch',
    ]);
    expect(r.code).toBe(0);
    const summary = jsonLine<{
      applied: boolean;
      patchPath: string | null;
      appliedFiles: string[];
      rollback: { executable: boolean } | null;
    }>(r.stdout, 'APPLY_JSON');
    expect(summary).not.toBeNull();
    expect(summary?.applied).toBe(false);
    expect(summary?.patchPath).toMatch(/\.patch$/);
    expect(summary?.appliedFiles).toEqual([]);
    expect(summary?.rollback?.executable).toBe(true);
    const patchAbsolute = path.join(root, summary?.patchPath as string);
    expect((await fs.stat(patchAbsolute)).isFile()).toBe(true);
    // The patch lives beneath the gitignored `.w-model/`, so the real worktree status is unchanged.
    expect(await gitStatus(root)).toBe(before);
  });

  it('commit 只删除 exact candidate scope，真实 rollback 后 git diff --exit-code 通过', async () => {
    const root = await createTempGitRepository();
    const revision = (await revisionProvider.current(root)) as RevisionIdentity;
    const workDir = await tempRoot('code-health-cli-inputs-');
    const { candidate, approval } = bindRevision(validFixture, revision);
    const candidatePath = await writeJson(workDir, 'candidate.json', candidate);
    const approvalPath = await writeJson(workDir, 'approval.json', approval);

    const r = runCli('code-health-apply.ts', [
      '--candidate',
      candidatePath,
      '--approval',
      approvalPath,
      '--root',
      root,
      '--mode',
      'commit',
    ]);
    expect(r.code).toBe(0);
    const summary = jsonLine<{
      applied: boolean;
      appliedFiles: string[];
      unrelatedFiles: string[];
      rollback: { executable: boolean; patchPath: string; command: string } | null;
    }>(r.stdout, 'APPLY_JSON');
    expect(summary).not.toBeNull();
    expect(summary?.applied).toBe(true);
    expect([...(summary?.appliedFiles ?? [])].sort()).toEqual([...candidate.changeScope.files].sort());
    expect(summary?.unrelatedFiles).toEqual([]);
    expect(summary?.rollback?.executable).toBe(true);
    // Real deletion happened in the isolated repository.
    await expect(fs.stat(path.join(root, 'src', 'unused.ts'))).rejects.toBeTruthy();

    // Real rollback through the recorded exact command; the isolated worktree must return to HEAD.
    const rollbackPatch = path.join(root, summary?.rollback?.patchPath as string);
    const reverted = runSync('git', ['apply', '-R', rollbackPatch], { cwd: root, timeout: 30_000, env: GIT_ENV });
    expect(reverted.status).toBe(0);
    const diff = runSync('git', ['diff', '--exit-code'], { cwd: root, timeout: 30_000, env: GIT_ENV });
    expect(diff.status).toBe(0);
    expect(await gitStatus(root)).toBe('');
  });

  it('dry-run 生成 proposal 且不写工作树；缺 approval 的 dry-run 也 fail-closed', async () => {
    const root = await createTempGitRepository();
    const revision = (await revisionProvider.current(root)) as RevisionIdentity;
    const workDir = await tempRoot('code-health-cli-inputs-');
    const { candidate, approval } = bindRevision(validFixture, revision);
    const candidatePath = await writeJson(workDir, 'candidate.json', candidate);
    const approvalPath = await writeJson(workDir, 'approval.json', approval);
    const before = await gitStatus(root);
    const r = runCli('code-health-apply.ts', [
      '--candidate',
      candidatePath,
      '--approval',
      approvalPath,
      '--root',
      root,
      '--mode',
      'dry-run',
    ]);
    expect(r.code).toBe(0);
    const summary = jsonLine<{ applied: boolean; patchPath: string | null }>(r.stdout, 'APPLY_JSON');
    expect(summary?.applied).toBe(false);
    expect(summary?.patchPath).toMatch(/\.patch$/);
    expect(await gitStatus(root)).toBe(before);

    const unapproved = runCli('code-health-apply.ts', [
      '--candidate',
      candidatePath,
      '--root',
      root,
      '--mode',
      'dry-run',
    ]);
    expect(unapproved.code).toBe(1);
    expect(unapproved.stdout).toContain('HUMAN_APPROVAL_REQUIRED');
    expect(await gitStatus(root)).toBe(before);
  });
});

describe('applyApproved / executeRollback real result semantics (R1/R4/R9)', () => {
  it('exact human approval resolves to a patch proposal with an executable rollback plan', async () => {
    const revision: RevisionIdentity = {
      commitSha: 'a'.repeat(40),
      treeSha: 'b'.repeat(40),
      sourceBundleSha256: 'c'.repeat(64),
      analyzedAt: '2026-09-07T00:00:00.000Z',
    };
    const { candidate, approval } = bindRevision(validFixture, revision);
    const result: ApplyResult = await applyApproved({
      candidate,
      approval,
      mode: 'patch',
      repositoryRoot: REPO_ROOT,
      currentRevision: revision,
    });
    expect(result.kind).toBe('patch-proposal');
    expect(result.applied).toBe(false);
    expect(result.patchPath).toMatch(/\.patch$/);
    expect(result.appliedFiles).toEqual([]);
    expect(result.rollback?.executable).toBe(true);
  });

  it('scope expansion, non-human actor and stale revision fail closed', async () => {
    const revision: RevisionIdentity = {
      commitSha: 'a'.repeat(40),
      treeSha: 'b'.repeat(40),
      sourceBundleSha256: 'c'.repeat(64),
      analyzedAt: '2026-09-07T00:00:00.000Z',
    };
    const { candidate, approval } = bindRevision(validFixture, revision);
    await expect(
      applyApproved({
        candidate,
        approval: { ...approval, approvedFiles: ['unknown.ts'] },
        mode: 'commit',
        repositoryRoot: REPO_ROOT,
        currentRevision: revision,
      }),
    ).rejects.toThrow(/scope/i);
    await expect(
      applyApproved({
        candidate,
        approval: { ...approval, actor: 'S-agent' },
        mode: 'commit',
        repositoryRoot: REPO_ROOT,
        currentRevision: revision,
      }),
    ).rejects.toThrow(/HUMAN_APPROVAL_REQUIRED/i);
    await expect(
      applyApproved({
        candidate,
        approval: { ...approval, revision: { ...revision, commitSha: 'd'.repeat(40) } },
        mode: 'commit',
        repositoryRoot: REPO_ROOT,
        currentRevision: revision,
      }),
    ).rejects.toThrow(/REVISION_MISMATCH|revision/i);
  });

  it('executeRollback is a real executability gate: non-executable plans never report success', () => {
    const { candidate } = bindRevision(rollbackFailureFixture, {
      commitSha: 'a'.repeat(40),
      treeSha: 'b'.repeat(40),
      sourceBundleSha256: 'c'.repeat(64),
      analyzedAt: '2026-09-07T00:00:00.000Z',
    });
    expect(candidate.rollback.executable).toBe(false);
    return expect(executeRollback(candidate.rollback)).resolves.toBe(false);
  });
});

describe('code-health-ledger CLI (init/append/validate)', () => {
  const revision: RevisionIdentity = {
    commitSha: 'a'.repeat(40),
    treeSha: 'b'.repeat(40),
    sourceBundleSha256: 'c'.repeat(64),
    analyzedAt: '2026-09-07T00:00:00.000Z',
  };

  function discoveredCandidate(): CodeHealthCandidate {
    return {
      ...structuredClone(approvalRequiredFixture.candidate),
      status: 'discovered',
      review: { findings: [], unresolvedQuestions: [], decision: null, humanDecision: null },
      archive: { state: 'not_archived', manifestPath: null, contentHash: null, redactionStatus: 'not_reviewed' },
    };
  }

  function discoveryEvent(candidate: CodeHealthCandidate): LedgerEvent {
    return {
      eventId: 'EV-1',
      eventKind: 'discovery',
      candidateId: candidate.candidateId,
      from: null,
      to: 'discovered',
      actorRole: 'A',
      at: '2026-09-07T00:10:00.000Z',
      revision: candidate.revision,
      scopeHash: candidate.changeScope.scopeHash,
      evidenceRefs: ['evidence/discovery.json'],
      signatureRef: 'evidence/signature-a.json',
    };
  }

  it('init 初始化 ledger，重复 init fail-closed', async () => {
    const dir = await tempRoot('code-health-ledger-cli-');
    const ledger = path.join(dir, 'campaign.json');
    const baseline = await writeJson(dir, 'baseline.json', revision);
    const first = runCli('code-health-ledger.ts', [
      'init',
      '--ledger',
      ledger,
      '--campaign-id',
      'CH-2026-09',
      '--baseline',
      baseline,
    ]);
    expect(first.code).toBe(0);
    const parsed = JSON.parse(await fs.readFile(ledger, 'utf8')) as CodeHealthLedger;
    expect(parsed.schemaVersion).toBe('1.0');
    expect(parsed.appendOnly).toBe(true);
    expect(parsed.candidates).toEqual([]);
    expect(parsed.events).toEqual([]);
    expect(parsed.baseline).toEqual(revision);

    const second = runCli('code-health-ledger.ts', [
      'init',
      '--ledger',
      ledger,
      '--campaign-id',
      'CH-2026-09',
      '--baseline',
      baseline,
    ]);
    expect(second.code).toBe(1);
  });

  it('append 只接受合法状态转移与未复用 event id，缺 hash/非法转移 fail-closed', async () => {
    const dir = await tempRoot('code-health-ledger-cli-');
    const ledger = path.join(dir, 'campaign.json');
    const baseline = await writeJson(dir, 'baseline.json', revision);
    expect(
      runCli('code-health-ledger.ts', [
        'init',
        '--ledger',
        ledger,
        '--campaign-id',
        'CH-2026-09',
        '--baseline',
        baseline,
      ]).code,
    ).toBe(0);

    const candidate = discoveredCandidate();
    const candidatePath = await writeJson(dir, 'candidate.json', candidate);
    const eventPath = await writeJson(dir, 'event.json', discoveryEvent(candidate));
    const accepted = runCli('code-health-ledger.ts', [
      'append',
      '--ledger',
      ledger,
      '--candidate',
      candidatePath,
      '--event',
      eventPath,
    ]);
    expect(accepted.code).toBe(0);
    const appended = JSON.parse(await fs.readFile(ledger, 'utf8')) as CodeHealthLedger;
    expect(appended.events).toHaveLength(1);
    expect(appended.candidates).toHaveLength(1);
    expect(runCli('code-health-ledger.ts', ['validate', '--ledger', ledger]).code).toBe(0);

    // Duplicate event id must never overwrite an existing ledger line.
    const duplicate = runCli('code-health-ledger.ts', [
      'append',
      '--ledger',
      ledger,
      '--candidate',
      candidatePath,
      '--event',
      eventPath,
    ]);
    expect(duplicate.code).toBe(1);

    // A malformed event (missing scope hash) is rejected.
    const malformedPath = await writeJson(dir, 'event-bad.json', { ...discoveryEvent(candidate), scopeHash: 'oops' });
    const malformed = runCli('code-health-ledger.ts', [
      'append',
      '--ledger',
      ledger,
      '--candidate',
      candidatePath,
      '--event',
      malformedPath,
    ]);
    expect(malformed.code).toBe(1);

    // An illegal transition target is rejected.
    const illegalPath = await writeJson(dir, 'event-illegal.json', {
      ...discoveryEvent(candidate),
      eventId: 'EV-2',
      from: 'discovered',
      to: 'verified',
      at: '2026-09-07T00:11:00.000Z',
    });
    const illegal = runCli('code-health-ledger.ts', [
      'append',
      '--ledger',
      ledger,
      '--candidate',
      candidatePath,
      '--event',
      illegalPath,
    ]);
    expect(illegal.code).toBe(1);
    expect(JSON.parse(await fs.readFile(ledger, 'utf8'))).toMatchObject({ events: [{ eventId: 'EV-1' }] });
    // Six sequential real `tsx` CLI spawns exceed the 30 s default under full-suite parallel load.
    // The explicit bound keeps the long-running case bounded without weakening any assertion.
  }, 120_000);

  it('validate 拒绝 status 与 replayed history 不一致的 ledger', async () => {
    const dir = await tempRoot('code-health-ledger-cli-');
    const ledgerPath = path.join(dir, 'campaign.json');
    const candidate = discoveredCandidate();
    const corrupted: CodeHealthLedger = {
      schemaVersion: '1.0',
      campaignId: 'CH-2026-09',
      createdAt: '2026-09-07T00:00:00.000Z',
      baseline: revision,
      environmentMatrix: [],
      candidates: [{ ...candidate, status: 'archived' }],
      events: [],
      appendOnly: true,
      redaction: { status: 'not_reviewed', rules: [], blockedReasons: [] },
    };
    await fs.writeFile(ledgerPath, `${JSON.stringify(corrupted, null, 2)}\n`, 'utf8');
    const r = runCli('code-health-ledger.ts', ['validate', '--ledger', ledgerPath]);
    expect(r.code).toBe(1);
  });

  it('unknown subcommand / unknown flag → exit 2 ERROR_JSON', async () => {
    const unknown = runCli('code-health-ledger.ts', ['frobnicate']);
    expect(unknown.code).toBe(2);
    expect(unknown.stdout).toContain('ERROR_JSON');
    const badFlag = runCli('code-health-ledger.ts', ['validate', '--nope', 'x']);
    expect(badFlag.code).toBe(2);
    expect(badFlag.stdout).toContain('ERROR_JSON');
  });

  it('--help and help expose a discoverable usage surface without an input error', () => {
    for (const args of [['--help'], ['help'], ['init', '--help']]) {
      const result = runCli('code-health-ledger.ts', args);
      expect(result.code, `code-health-ledger.ts ${args.join(' ')}`).toBe(0);
      expect(result.stdout).toContain('usage: code-health-ledger.ts');
      expect(result.stdout).toContain('init');
      expect(result.stdout).toContain('append');
      expect(result.stdout).toContain('validate');
      expect(result.stdout).not.toContain('ERROR_JSON');
    }
  });
});

describe('repository worktree safety (R5)', () => {
  it('CLI 运行不会写入本仓库工作树，也不产生 patch', async () => {
    const before = runSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: REPO_ROOT,
      timeout: 30_000,
      env: GIT_ENV,
    }).stdout?.trim();
    const patchFiles = runSync('git', ['ls-files', '--others', '--exclude-standard', '*.patch'], {
      cwd: REPO_ROOT,
      timeout: 30_000,
      env: GIT_ENV,
    }).stdout?.trim();
    expect(patchFiles).toBe('');
    // The pristine status may contain this test's sibling transients; assert no probe-created path appears.
    expect(before ?? '').not.toContain('.w-model/code-health/apply/');
  });
});

describe('fixture integrity', () => {
  it('four apply states carry distinct human-review expectations', async () => {
    expect(validFixture.approval).not.toBeNull();
    expect(approvalRequiredFixture.approval).toBeNull();
    expect(scopeMismatchFixture.approval?.approvedFiles).not.toEqual(scopeMismatchFixture.candidate.changeScope.files);
    expect(rollbackFailureFixture.candidate.rollback.executable).toBe(false);
    const digest = createHash('sha256').update(JSON.stringify(validFixture.candidate)).digest('hex');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('code-health-archive CLI (Task 8A)', () => {
  it('--help 打印用法且不产生任何 package', () => {
    const result = runCli('code-health-archive.ts', ['--help']);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/--campaign/);
    expect(result.stdout).toMatch(/--verify/);
    expect(result.stdout).toMatch(/package-only/);
  });

  it('缺参数、未知参数与非法 verification-level 都是 exit 2 + ERROR_JSON', () => {
    for (const args of [
      [],
      ['--campaign', '.'],
      ['--bogus', 'x'],
      ['--campaign', '.', '--output', '.', '--verification-level', 'source-verified'],
    ]) {
      const result = runCli('code-health-archive.ts', args);
      expect(result.code).toBe(2);
      expect(result.stdout).toMatch(/ERROR_JSON/);
      expect(result.stdout).toMatch(/ARG_INVALID/);
    }
  });

  it('不存在的 campaign 目录与 verify/produce 混用都是 exit 2', () => {
    const missing = runCli('code-health-archive.ts', [
      '--campaign',
      path.join(REPO_ROOT, '.no-such-campaign'),
      '--output',
      path.join(tmpdir(), 'no-such-out'),
    ]);
    expect(missing.code).toBe(2);

    const mixed = runCli('code-health-archive.ts', ['--verify', REPO_ROOT, '--campaign', REPO_ROOT]);
    expect(mixed.code).toBe(2);
  });

  it('缺少 manifest 的 verify 失败且只报告 package-only，绝不升级为 source-bound', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'code-health-archive-cli-'));
    createdRoots.push(root);
    const result = runCli('code-health-archive.ts', ['--verify', root, '--source-project', root]);
    expect(result.code).toBe(1);
    const payload = jsonLine<{ ok: boolean; verificationLevel: string; archivedAsPassed: boolean }>(
      result.stdout,
      'ARCHIVE_JSON',
    );
    expect(payload?.ok).toBe(false);
    expect(payload?.verificationLevel).toBe('package-only');
    expect(payload?.archivedAsPassed).toBe(false);
  });

  it('没有 V/G/approval 证据的 campaign 无法归档，且不写出 package', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'code-health-archive-cli-'));
    createdRoots.push(root);
    const output = path.join(root, 'archive-out');
    await fs.writeFile(
      path.join(root, 'ledger.json'),
      JSON.stringify({ schemaVersion: '1.0', candidates: [], events: [] }),
      'utf8',
    );
    await fs.writeFile(
      path.join(root, 'candidate.json'),
      JSON.stringify({ candidateId: 'CHG-P1-20260907-001' }),
      'utf8',
    );
    await fs.writeFile(
      path.join(root, 'approval.json'),
      JSON.stringify({ candidateId: 'CHG-P1-20260907-001' }),
      'utf8',
    );

    const result = runCli('code-health-archive.ts', ['--campaign', root, '--output', output]);
    expect(result.code).toBe(1);
    const payload = jsonLine<{ ok: boolean; archivedAsPassed: boolean }>(result.stdout, 'ARCHIVE_JSON');
    expect(payload?.ok).toBe(false);
    expect(payload?.archivedAsPassed).toBe(false);
    await expect(fs.stat(output)).rejects.toBeTruthy();
  });
});
