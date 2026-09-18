/* eslint-disable security/detect-non-literal-fs-filename -- All filesystem paths are generated beneath test-owned temporary roots. */
/**
 * Shared fixtures for the code-health CLI acceptance suite and the real-Git end-to-end chain:
 * temporary-root bookkeeping, the audited Git environment, CLI spawning helpers, and apply-fixture
 * revision binding.
 *
 * Safety boundary: every real write / delete happens inside an isolated temporary Git repository the
 * caller creates through `createTempGitRepository()` and removes through `cleanupTempRoots()`
 * (registered per test file with `afterEach(cleanupTempRoots)` — the `createdRoots` array is shared
 * module state, so a file that creates roots through `tempRoot()` must register the hook itself).
 *
 * The `GIT_ENV` recipe is reused from `code-health-evidence.test.ts`: `GIT_CONFIG_NOSYSTEM` /
 * `GIT_CONFIG_GLOBAL` keep the local `core.autocrlf=true` system configuration from turning every
 * worktree read-back into a CRLF false diff.
 */

import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ApprovalDecision, CodeHealthCandidate, RevisionIdentity } from '../../logic/code-health-ledger-logic.js';
import { createCodeHealthGitRevisionProvider } from '../../lib/code-health-revision-provider.js';
import { runSync } from '../../lib/run-sync.js';

const require = createRequire(import.meta.url);
export const tsxCli = require.resolve('tsx/cli');
const here = path.dirname(fileURLToPath(import.meta.url));
/** Repository root. Depth note: this file lives one level deeper than the sibling test files. */
export const REPO_ROOT = path.resolve(here, '../../../..');
export const CLI_DIR = path.join(REPO_ROOT, 'w-model-dev/scripts/cli');
export const APPLY_SAMPLES = path.join(REPO_ROOT, 'w-model-dev/scripts/samples/code-health/apply');

/** Real Git revision provider shared by the CLI acceptance suite and the end-to-end chain. */
export const revisionProvider = createCodeHealthGitRevisionProvider();

export const GIT_ENV = {
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

/** Every temporary root created by `tempRoot()`; spliced empty by `cleanupTempRoots()`. */
export const createdRoots: string[] = [];

/** Remove every temporary root created so far. Register once per test file: `afterEach(cleanupTempRoots)`. */
export async function cleanupTempRoots(): Promise<void> {
  // Per-root isolation: one root that cannot be removed (Windows occasionally holds a transient handle on
  // `.git` objects) must neither abort the remaining removals nor leak silently, and must never turn a
  // passing test red through the afterEach hook. The success path is unchanged: every root is removed.
  const roots = createdRoots.splice(0);
  const failures: string[] = [];
  for (const root of roots) {
    try {
      await fs.rm(root, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      try {
        await new Promise((resolve) => setTimeout(resolve, 250));
        await fs.rm(root, { recursive: true, force: true, maxRetries: 5 });
      } catch (error) {
        failures.push(`${root}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  if (failures.length > 0) {
    console.error(
      `code-health fixtures: ${failures.length} temporary root(s) could not be removed after a retry:\n${failures.join('\n')}`,
    );
  }
}

export interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export function runCli(script: string, args: string[], cwd: string = REPO_ROOT): CliResult {
  const r = runSync(process.execPath, [tsxCli, path.join(CLI_DIR, script), ...args], {
    cwd,
    timeout: 90_000,
    env: { ...process.env, ...GIT_ENV },
  });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

export function jsonLine<T>(stdout: string, prefix: string): T | null {
  const line = stdout.split(/\r?\n/).find((entry) => entry.startsWith(`${prefix} `));
  if (line === undefined) return null;
  try {
    return JSON.parse(line.slice(prefix.length + 1)) as T;
  } catch {
    return null;
  }
}

export async function git(root: string, args: string[]): Promise<CliResult> {
  const r = runSync('git', args, { cwd: root, timeout: 30_000, env: GIT_ENV });
  return { code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

export async function gitStatus(root: string): Promise<string> {
  return (await git(root, ['status', '--porcelain', '--untracked-files=all'])).stdout.trim();
}

export async function gitHead(root: string): Promise<string> {
  return (await git(root, ['rev-parse', 'HEAD'])).stdout.trim();
}

export async function tempRoot(prefix: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), prefix));
  createdRoots.push(root);
  return root;
}

export async function createTempGitRepository(): Promise<string> {
  const root = await tempRoot('code-health-cli-repo-');
  await git(root, ['init', '--quiet']);
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'unused.ts'), 'export const unusedFunction = 1;\n');
  await fs.writeFile(path.join(root, '.gitignore'), '.w-model/\n');
  await git(root, ['add', '--all']);
  await git(root, ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'initial']);
  return root;
}

export interface ApplyFixture {
  description: string;
  mode: 'dry-run' | 'patch' | 'commit';
  candidate: CodeHealthCandidate;
  approval: ApprovalDecision | null;
}

export async function loadApplyFixture(name: string): Promise<ApplyFixture> {
  return JSON.parse(await fs.readFile(path.join(APPLY_SAMPLES, name), 'utf8')) as ApplyFixture;
}

export async function writeJson(dir: string, name: string, value: unknown): Promise<string> {
  const target = path.join(dir, name);
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return target;
}

/** Bind the fixture candidate/approval to the isolated repository's real revision. */
export function bindRevision(
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
