/* eslint-disable security/detect-non-literal-fs-filename -- all paths are generated beneath a mkdtemp-owned fixture. */
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { produceSourceProvenance, verifySourceProvenance } from '../logic/evidence-provenance-logic.js';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const SOURCE_CLI = path.resolve(process.cwd(), 'w-model-dev/scripts/cli/wm-verify-evidence-source.ts');

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-provenance-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function makeProject(): Promise<string> {
  const project = path.join(tmpDir, 'project');
  const state = path.join(project, '.w-model');
  await fs.mkdir(path.join(state, 'gate-logs'), { recursive: true });
  const runLog = await fs.readFile(
    path.resolve(process.cwd(), 'w-model-dev/scripts/samples/run-log/valid.jsonl'),
    'utf8',
  );
  await fs.writeFile(
    path.join(state, 'run-log.jsonl'),
    runLog
      .split(/\r?\n/)
      .map((line) => (line.includes('"action":"gate"') ? line.replace(/\}$/, ',"gateLogPath":"gate.json"}') : line))
      .join('\n'),
  );
  await fs.writeFile(
    path.join(state, 'gate-logs', 'gate.json'),
    '{"script":"check-bdd-model.ts","exitCode":0,"passed":true,"reasons":[],"reportSummary":{"phase":1,"checkedAt":"2026-08-20T00:00:00.000Z","summary":"ok","violationsCount":0,"exitCode":0,"passed":true},"stdoutSummary":{"exitCode":0,"passed":true}}',
  );
  await fs.mkdir(path.join(state, 'signature-chains'), { recursive: true });
  await fs.copyFile(
    path.resolve(process.cwd(), 'w-model-dev/scripts/samples/signature-chain/valid-all-roles.jsonl'),
    path.join(state, 'signature-chains', 'chain.jsonl'),
  );
  for (const args of [
    ['init'],
    ['add', '.'],
    [
      '-c',
      'user.email=evidence@example.test',
      '-c',
      'user.name=Evidence Test',
      '-c',
      'commit.gpgSign=false',
      'commit',
      '--no-verify',
      '-m',
      'fixture',
    ],
  ]) {
    try {
      await execFileAsync('git', ['-C', project, ...args], { timeout: 5_000 });
    } catch {
      throw new Error('git fixture setup failed');
    }
  }
  return project;
}

type LinkedWorktreeFixture = {
  project: string;
  branch: string;
  sha: string;
  worktreeGitDir: string;
  commonGitDir: string;
};

/**
 * Builds a synthetic linked git worktree layout without invoking `git worktree`:
 * - `.git` is a file pointer (`gitdir: <dir>`) to a worktree-private gitdir;
 * - the worktree gitdir has HEAD=`ref: refs/heads/<branch>`, a `commondir` file
 *   (relative path), a `gitdir` marker, and an empty `refs/` dir;
 * - the common gitdir (commondir target) holds `refs/heads/<branch>=<40hex>`.
 * Ref values are fixtures, not real objects; gitHead only reads the ref text.
 */
async function makeLinkedWorktreeProject(
  branch = 'fix/worktree-synthetic',
  sha = '3041c25d8171b38ced4ce3d029e2d6c452f531fa',
): Promise<LinkedWorktreeFixture> {
  const project = await makeProject();
  const worktreeGitDir = path.join(project, 'gitdir-wt');
  const commonGitDir = path.join(project, 'gitdir-common');
  await fs.mkdir(path.join(worktreeGitDir, 'refs'), { recursive: true });
  await fs.mkdir(path.join(commonGitDir, 'refs', 'heads', path.dirname(branch)), { recursive: true });
  await fs.writeFile(path.join(worktreeGitDir, 'HEAD'), `ref: refs/heads/${branch}\n`, 'utf8');
  await fs.writeFile(path.join(worktreeGitDir, 'commondir'), '../gitdir-common\n', 'utf8');
  await fs.writeFile(path.join(worktreeGitDir, 'gitdir'), `gitdir: ${worktreeGitDir}\n`, 'utf8');
  await fs.writeFile(path.join(commonGitDir, 'refs', 'heads', branch), `${sha}\n`, 'utf8');
  await fs.rm(path.join(project, '.git'), { recursive: true, force: true });
  await fs.writeFile(path.join(project, '.git'), 'gitdir: gitdir-wt\n', 'utf8');
  return { project, branch, sha, worktreeGitDir, commonGitDir };
}

async function runSourceCli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(process.execPath, [require.resolve('tsx/cli'), SOURCE_CLI, ...args], {
      encoding: 'utf8',
      // Load-sensitive: raised from 15 s because the real `tsx` CLI can exceed it when the full suite runs
      // in parallel (execFileAsync then reports a generic failure). Assertions are unchanged.
      timeout: 60_000,
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const result = error as { code?: number; stdout?: string; stderr?: string };
    return { code: result.code ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  }
}

describe('source provenance', () => {
  it('rejects a project without a real git HEAD and without valid run/gate evidence', async () => {
    const project = await makeProject();
    await fs.rm(path.join(project, '.git'), { recursive: true, force: true });
    await expect(produceSourceProvenance(project)).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
    });
  });

  it('returns source-bound verification with package measurements', async () => {
    const project = await makeProject();
    const produced = await produceSourceProvenance(project);
    expect(produced.ok).toBe(true);
    const verified = await verifySourceProvenance(project);
    expect(verified).toMatchObject({
      ok: true,
      verificationLevel: 'source-bound',
      verificationStatus: 'passed',
    });
  });

  it('includes codegraph query files in sourceFiles and measurements', async () => {
    const project = await makeProject();
    const queryPath = path.join(project, '.w-model', 'codegraph-queries');
    await fs.mkdir(queryPath, { recursive: true });
    await fs.writeFile(path.join(queryPath, 'impact.json'), '{"querySymbol":"exportEvidence"}\n', 'utf8');

    const produced = await produceSourceProvenance(project);

    expect(produced).toMatchObject({ ok: true });
    expect(produced.provenance?.sourceFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'codegraph-queries/impact.json', kind: 'codegraph-query' }),
      ]),
    );
    expect(produced.provenance?.measurements).toHaveProperty('codegraphQueries', {
      count: 1,
      contentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it('relocated full gitdir via .git pointer', async () => {
    const project = await makeProject();
    const gitDir = path.join(project, '.git');
    const linkedGitDir = path.join(project, 'git-metadata');
    await fs.rename(gitDir, linkedGitDir);
    await fs.writeFile(gitDir, 'gitdir: git-metadata\n', 'utf8');
    const gitFiles = await fs.readdir(linkedGitDir);
    expect(gitFiles).toContain('HEAD');

    const produced = await produceSourceProvenance(project);
    expect(produced.reason).toBeUndefined();
    expect(produced).toEqual(expect.objectContaining({ ok: true, verificationLevel: 'source-bound' }));
  });

  it('resolves the source commit through a linked worktree commondir shared ref', async () => {
    const { project, sha } = await makeLinkedWorktreeProject();

    const produced = await produceSourceProvenance(project);

    expect(produced.reason).toBeUndefined();
    expect(produced).toEqual(expect.objectContaining({ ok: true, verificationLevel: 'source-bound' }));
    expect(produced.provenance?.commitSha).toBe('3041c25d8171b38ced4ce3d029e2d6c452f531fa');
    expect(produced.provenance?.commitSha).toBe(sha);
    const verified = await verifySourceProvenance(project);
    expect(verified).toEqual(expect.objectContaining({ ok: true, verificationLevel: 'source-bound' }));
  });

  it('reports MISSING_GIT_HEAD when neither the worktree gitdir nor the common gitdir has the ref', async () => {
    const { project, branch } = await makeLinkedWorktreeProject();
    await fs.rm(path.join(project, 'gitdir-common', 'refs', 'heads', branch), { force: true });

    const produced = await produceSourceProvenance(project);

    expect(produced).toMatchObject({ ok: false, exitCode: 1, reason: 'MISSING_GIT_HEAD' });
    expect(String(produced.reason)).not.toContain('UNSAFE_SOURCE_EVIDENCE');
  });

  it('rejects a project reached through a redirected lexical ancestor', async () => {
    const project = await makeProject();
    const realParent = path.join(tmpDir, 'real-parent');
    const redirectedParent = path.join(tmpDir, 'redirected-parent');
    const lexicalParent = path.join(tmpDir, 'lexical-parent');
    await fs.mkdir(realParent);
    await fs.rename(project, path.join(realParent, path.basename(project)));
    await fs.rename(realParent, redirectedParent);
    try {
      await fs.symlink(redirectedParent, lexicalParent, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      await fs.rename(redirectedParent, realParent);
      await fs.rename(path.join(realParent, path.basename(project)), project);
      if (process.platform === 'win32') return;
      throw error;
    }

    const lexicalProject = path.join(lexicalParent, path.basename(project));
    await expect(produceSourceProvenance(lexicalProject)).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
      reason: 'UNSAFE_SOURCE_EVIDENCE',
    });
  });

  it('rejects a recursive evidence directory symlink', async () => {
    const project = await makeProject();
    const state = path.join(project, '.w-model');
    const redirected = path.join(tmpDir, 'redirected-gates');
    await fs.rm(path.join(state, 'gate-logs'), { recursive: true, force: true });
    await fs.mkdir(redirected);
    await fs.writeFile(path.join(redirected, 'gate.json'), '{}', 'utf8');
    try {
      await fs.symlink(redirected, path.join(state, 'gate-logs'), process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if (process.platform === 'win32') return;
      throw error;
    }

    await expect(produceSourceProvenance(project)).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
      reason: 'UNSAFE_SOURCE_EVIDENCE',
    });
  });

  it('rejects an evidence file symlink', async () => {
    const project = await makeProject();
    const state = path.join(project, '.w-model');
    const redirected = path.join(tmpDir, 'redirected-gate.json');
    await fs.writeFile(redirected, '{}', 'utf8');
    try {
      await fs.symlink(redirected, path.join(state, 'gate-logs', 'redirected.json'));
    } catch (error) {
      if (process.platform === 'win32') return;
      throw error;
    }

    await expect(produceSourceProvenance(project)).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
      reason: 'UNSAFE_SOURCE_EVIDENCE',
    });
  });

  it('rejects a run-log symlink', async () => {
    const project = await makeProject();
    const state = path.join(project, '.w-model');
    const redirected = path.join(tmpDir, 'redirected-run-log.jsonl');
    const runLog = await fs.readFile(path.join(state, 'run-log.jsonl'));
    await fs.writeFile(redirected, runLog);
    await fs.rm(path.join(state, 'run-log.jsonl'));
    try {
      await fs.symlink(redirected, path.join(state, 'run-log.jsonl'));
    } catch (error) {
      if (process.platform === 'win32') return;
      throw error;
    }

    await expect(produceSourceProvenance(project)).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
      reason: 'UNSAFE_SOURCE_EVIDENCE',
    });
  });

  it('fails closed when a source file is replaced after its final stable read', async () => {
    const project = await makeProject();
    const gatePath = path.join(project, '.w-model', 'gate-logs', 'gate.json');
    const originalOpen = fs.open.bind(fs);
    const openSpy = vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      const handle = await originalOpen(...args);
      if (String(args[0]) === gatePath) {
        const originalHandleReadFile = handle.readFile.bind(handle);
        handle.readFile = (async (...readArgs) => {
          const content = await originalHandleReadFile(...readArgs);
          await fs.writeFile(gatePath, `${content.toString()} `, 'utf8');
          return content;
        }) as typeof handle.readFile;
      }
      return handle;
    });

    const result = await produceSourceProvenance(project);

    openSpy.mockRestore();
    expect(result).toMatchObject({ ok: false, exitCode: 1, reason: 'UNSAFE_SOURCE_EVIDENCE' });
  });

  it('fails closed when a source file is replaced with a different inode during reading', async () => {
    const project = await makeProject();
    const gatePath = path.join(project, '.w-model', 'gate-logs', 'gate.json');
    const replacementPath = path.join(project, '.w-model', 'gate-logs', 'gate-replacement.json');
    const originalOpen = fs.open.bind(fs);
    const openSpy = vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
      const handle = await originalOpen(...args);
      if (String(args[0]) === gatePath) {
        const originalHandleReadFile = handle.readFile.bind(handle);
        handle.readFile = (async (...readArgs) => {
          const content = await originalHandleReadFile(...readArgs);
          await fs.rename(gatePath, replacementPath);
          await fs.writeFile(gatePath, content, 'utf8');
          return content;
        }) as typeof handle.readFile;
      }
      return handle;
    });

    const result = await produceSourceProvenance(project);

    openSpy.mockRestore();
    expect(result).toMatchObject({ ok: false, exitCode: 1, reason: 'UNSAFE_SOURCE_EVIDENCE' });
  });

  it('fails closed when the provenance target is replaced during publication', async () => {
    const project = await makeProject();
    expect((await produceSourceProvenance(project)).ok).toBe(true);
    const state = path.join(project, '.w-model');
    const target = path.join(state, 'evidence-provenance.json');
    const redirected = path.join(tmpDir, 'target-secret');
    await fs.writeFile(redirected, 'untouched', 'utf8');
    const originalLink = fs.link.bind(fs);
    const linkSpy = vi.spyOn(fs, 'link').mockImplementation(async (...args) => {
      if (String(args[1]) === target) {
        await fs.rm(target, { force: true });
        await fs.symlink(redirected, target);
      }
      return originalLink(...args);
    });

    const result = await produceSourceProvenance(project);

    linkSpy.mockRestore();
    expect(result).toMatchObject({ ok: false, exitCode: 1, reason: 'UNSAFE_SOURCE_EVIDENCE' });
    expect(await fs.readFile(redirected, 'utf8')).toBe('untouched');
  });

  it('fails closed without overwriting a target when its parent is replaced during publication', async () => {
    const project = await makeProject();
    expect((await produceSourceProvenance(project)).ok).toBe(true);
    const state = path.join(project, '.w-model');
    const movedState = path.join(tmpDir, 'moved-state');
    const redirectedState = path.join(tmpDir, 'redirected-state');
    const redirectedTarget = path.join(redirectedState, 'evidence-provenance.json');
    await fs.rename(state, movedState);
    await fs.mkdir(redirectedState);
    await fs.writeFile(redirectedTarget, 'untouched', 'utf8');
    await fs.rename(movedState, state);
    const originalLink = fs.link.bind(fs);
    const linkSpy = vi.spyOn(fs, 'link').mockImplementation(async (...args) => {
      if (String(args[1]) === path.join(state, 'evidence-provenance.json')) {
        await fs.rename(state, movedState);
        await fs.symlink(redirectedState, state, process.platform === 'win32' ? 'junction' : 'dir');
      }
      return originalLink(...args);
    });

    const result = await produceSourceProvenance(project);

    linkSpy.mockRestore();
    await fs.rm(state, { force: true, recursive: true });
    await fs.rename(movedState, state).catch(() => undefined);
    expect(result).toMatchObject({ ok: false, exitCode: 1, reason: 'UNSAFE_SOURCE_EVIDENCE' });
    expect(await fs.readFile(redirectedTarget, 'utf8')).toBe('untouched');
  });

  it('rejects a symlinked state root instead of authenticating redirected evidence', async () => {
    const project = await makeProject();
    const state = path.join(project, '.w-model');
    const redirected = path.join(tmpDir, 'redirected-state');
    await fs.rename(state, redirected);
    await fs.symlink(redirected, state, 'junction');

    await expect(produceSourceProvenance(project)).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
      reason: 'UNSAFE_SOURCE_EVIDENCE',
    });
  });

  it('rejects verifiedAt tampering through source-bound verification', async () => {
    const project = await makeProject();
    expect((await produceSourceProvenance(project)).ok).toBe(true);
    const provenancePath = path.join(project, '.w-model', 'evidence-provenance.json');
    const provenance = JSON.parse(await fs.readFile(provenancePath, 'utf8')) as Record<string, unknown>;
    provenance.verifiedAt = '2020-01-01T00:00:00.000Z';
    await fs.writeFile(provenancePath, JSON.stringify(provenance), 'utf8');

    await expect(verifySourceProvenance(project)).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
      reason: 'SOURCE_PROVENANCE_MISMATCH',
    });
  });

  it('requires final HEAD binding when a reviewed HEAD is supplied', async () => {
    const project = await makeProject();
    const produced = await produceSourceProvenance(project);
    expect(produced.ok).toBe(true);
    const head = produced.provenance!.commitSha;
    await expect(verifySourceProvenance(project, `${'f'.repeat(40)}`)).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
      reason: 'FINAL_HEAD_MISMATCH',
    });
    await expect(verifySourceProvenance(project, head)).resolves.toMatchObject({ ok: true });
  });

  it('real CLI produces, writes, and reports source-bound provenance', async () => {
    const project = await makeProject();
    const result = await runSourceCli([project]);

    expect(result.code).toBe(0);
    const line = result.stdout.split(/\r?\n/).find((entry) => entry.startsWith('EVIDENCE_SOURCE_JSON '));
    expect(line).toBeDefined();
    expect(JSON.parse(line!.slice('EVIDENCE_SOURCE_JSON '.length))).toMatchObject({
      ok: true,
      verificationLevel: 'source-bound',
      verificationStatus: 'passed',
    });
    expect(
      JSON.parse(await fs.readFile(path.join(project, '.w-model', 'evidence-provenance.json'), 'utf8')),
    ).toMatchObject({
      verificationStatus: 'passed',
      producerVersion: expect.any(String),
    });
  });
});
