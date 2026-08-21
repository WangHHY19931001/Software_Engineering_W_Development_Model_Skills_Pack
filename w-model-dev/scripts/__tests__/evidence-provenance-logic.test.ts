/* eslint-disable security/detect-non-literal-fs-filename -- all paths are generated beneath a mkdtemp-owned fixture. */
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
  await fs.copyFile(
    path.resolve(process.cwd(), 'w-model-dev/scripts/samples/run-log/valid.jsonl'),
    path.join(state, 'run-log.jsonl'),
  );
  await fs.writeFile(
    path.join(state, 'gate-logs', 'gate.json'),
    '{"script":"check-bdd-model.ts","exitCode":0,"passed":true,"reasons":[],"reportSummary":{"phase":1,"checkedAt":"2026-08-20T00:00:00.000Z","summary":"ok","violationsCount":0}}',
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

async function runSourceCli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(process.execPath, [require.resolve('tsx/cli'), SOURCE_CLI, ...args], {
      encoding: 'utf8',
      timeout: 15_000,
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

  it('supports a linked worktree .git file when resolving the source commit', async () => {
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
