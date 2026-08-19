/* eslint-disable security/detect-non-literal-fs-filename -- all paths are generated beneath a mkdtemp-owned fixture. */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { validateBySchema } from '../infrastructure/schema-loader.js';
import { exportEvidence, verifyEvidence } from '../logic/evidence-export-logic.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli/wm-export-evidence.ts');

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wm-evidence-export-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function projectPath(name = 'project'): string {
  return path.join(tmpDir, name);
}

async function createProject(name = 'project'): Promise<string> {
  const project = projectPath(name);
  const state = path.join(project, '.w-model');
  await fs.mkdir(path.join(state, 'gate-logs'), { recursive: true });
  await fs.mkdir(path.join(state, 'verifier-outputs'), { recursive: true });
  await fs.mkdir(path.join(state, 'signature-chains'), { recursive: true });
  await fs.mkdir(path.join(state, 'codegraph-queries'), { recursive: true });
  await fs.writeFile(
    path.join(state, 'gate-logs', 'gate.json'),
    JSON.stringify({ token: 'gate-token', nested: { secret: 'gate-secret' } }),
    'utf8',
  );
  await fs.writeFile(
    path.join(state, 'verifier-outputs', 'verifier.json'),
    JSON.stringify({ apiKey: 'verifier-key', rows: [{ password: 'verifier-password' }] }),
    'utf8',
  );
  await fs.writeFile(
    path.join(state, 'signature-chains', 'chain.jsonl'),
    '{"value":"safe","token":"chain-token"}\n',
    'utf8',
  );
  await fs.writeFile(
    path.join(state, 'codegraph-queries', 'query.json'),
    JSON.stringify({ sourcePath: '/private/source', token: 'query-token' }),
    'utf8',
  );
  await fs.writeFile(
    path.join(state, 'run-log.jsonl'),
    '{"secret":"run-secret","nested":{"apiKey":"run-key"}}\n',
    'utf8',
  );
  return project;
}

function runCli(args: string[]): { code: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [tsxCli, SCRIPT, ...args], { encoding: 'utf8', timeout: 15_000 });
  return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function cliSummary(stdout: string): Record<string, unknown> {
  const line = stdout.split(/\r?\n/).find((entry) => entry.startsWith('EVIDENCE_EXPORT_JSON '));
  expect(line).toBeDefined();
  return JSON.parse(line!.slice('EVIDENCE_EXPORT_JSON '.length)) as Record<string, unknown>;
}

describe('evidence export logic', () => {
  it('exports allowlisted runtime records with stable kinds, sorted paths, and verifiable hashes', async () => {
    const project = await createProject();
    const output = path.join(tmpDir, 'evidence');

    const result = await exportEvidence(project, output);

    expect(result).toMatchObject({ ok: true, exitCode: 0 });
    const manifest = JSON.parse(await fs.readFile(path.join(output, 'evidence-manifest.json'), 'utf8')) as {
      schemaVersion: string;
      sourceProject: string;
      files: Array<{ path: string; kind: string; sha256: string }>;
    };
    expect(validateBySchema('evidence-manifest', manifest).valid).toBe(true);
    expect(manifest.schemaVersion).toBe('1.0');
    expect(manifest.sourceProject).not.toContain(project);
    expect(manifest.files.map((entry) => entry.path)).toEqual([...manifest.files.map((entry) => entry.path)].sort());
    expect(manifest.files.map((entry) => entry.kind)).toEqual([
      'codegraph-query',
      'gate-log',
      'run-log',
      'signature-chain',
      'verifier-output',
    ]);
    expect(manifest.files.every((entry) => /^[0-9a-f]{64}$/.test(entry.sha256))).toBe(true);
    expect(manifest.files.some((entry) => entry.path === 'evidence-manifest.json')).toBe(false);
  });

  it('recursively redacts sensitive JSON and JSONL field values without leaking source values', async () => {
    const project = await createProject();
    const output = path.join(tmpDir, 'evidence');

    await exportEvidence(project, output);

    const combined = await Promise.all(
      [
        'gate-logs/gate.json',
        'verifier-outputs/verifier.json',
        'signature-chains/chain.jsonl',
        'codegraph-queries/query.json',
        'run-log.jsonl',
      ].map(async (relativePath) => fs.readFile(path.join(output, relativePath), 'utf8')),
    );
    const outputText = combined.join('\n');
    for (const secret of [
      'gate-token',
      'gate-secret',
      'verifier-key',
      'verifier-password',
      'chain-token',
      'query-token',
      'run-secret',
      'run-key',
    ]) {
      expect(outputText).not.toContain(secret);
    }
    expect(JSON.parse(combined[0]!)).toMatchObject({ token: '[REDACTED]', nested: { secret: '[REDACTED]' } });
    expect(JSON.parse(combined[2]!.trim())).toMatchObject({ token: '[REDACTED]' });
  });

  it('verifies a valid export and rejects a tampered exported file', async () => {
    const project = await createProject();
    const output = path.join(tmpDir, 'evidence');
    await exportEvidence(project, output);
    const manifest = path.join(output, 'evidence-manifest.json');

    await expect(verifyEvidence(manifest)).resolves.toMatchObject({ ok: true, exitCode: 0 });
    await fs.appendFile(path.join(output, 'gate-logs', 'gate.json'), 'tampered', 'utf8');
    await expect(verifyEvidence(manifest)).resolves.toMatchObject({ ok: false, exitCode: 1 });
  });

  it('rejects output within source, source escapes, symlink escapes, binaries, and mixed nonempty output', async () => {
    const project = await createProject();
    const source = path.join(project, '.w-model');

    await expect(exportEvidence(project, path.join(source, 'export'))).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
    });
    await expect(
      exportEvidence(path.join(project, '..', 'missing'), path.join(tmpDir, 'missing-output')),
    ).resolves.toMatchObject({ ok: false, exitCode: 2 });

    const outside = path.join(tmpDir, 'outside.json');
    await fs.writeFile(outside, '{"token":"outside-token"}', 'utf8');
    await fs.symlink(outside, path.join(source, 'gate-logs', 'escape.json'));
    await expect(exportEvidence(project, path.join(tmpDir, 'symlink-output'))).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
    });
    await fs.unlink(path.join(source, 'gate-logs', 'escape.json'));

    await fs.writeFile(path.join(source, 'gate-logs', 'binary.bin'), Buffer.from([0, 1, 2]));
    await expect(exportEvidence(project, path.join(tmpDir, 'binary-output'))).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
    });
    await fs.unlink(path.join(source, 'gate-logs', 'binary.bin'));

    const nonempty = path.join(tmpDir, 'nonempty');
    await fs.mkdir(nonempty);
    await fs.writeFile(path.join(nonempty, 'leftover.txt'), 'old', 'utf8');
    await expect(exportEvidence(project, nonempty)).resolves.toMatchObject({ ok: false, exitCode: 1 });
  });

  it('rejects invalid strict manifests including extra fields and malformed hashes', async () => {
    const project = await createProject();
    const output = path.join(tmpDir, 'evidence');
    await exportEvidence(project, output);
    const manifestPath = path.join(output, 'evidence-manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as Record<string, unknown>;

    await fs.writeFile(manifestPath, JSON.stringify({ ...manifest, unexpected: true }), 'utf8');
    await expect(verifyEvidence(manifestPath)).resolves.toMatchObject({ ok: false, exitCode: 1 });
    await fs.writeFile(
      manifestPath,
      JSON.stringify({ ...manifest, files: [{ ...(manifest.files as object[])[0], sha256: 'A'.repeat(64) }] }),
      'utf8',
    );
    await expect(verifyEvidence(manifestPath)).resolves.toMatchObject({ ok: false, exitCode: 1 });
  });
});

describe('wm-export-evidence CLI', () => {
  it('uses actual child-process exit codes and EVIDENCE_EXPORT_JSON for success, verification failure, and invalid arguments', async () => {
    const project = await createProject();
    const output = path.join(tmpDir, 'evidence');

    const exported = runCli([project, output]);
    expect(exported.code).toBe(0);
    expect(cliSummary(exported.stdout)).toMatchObject({ ok: true, exitCode: 0, mode: 'export' });

    await fs.appendFile(path.join(output, 'run-log.jsonl'), 'tampered', 'utf8');
    const invalid = runCli(['--verify', path.join(output, 'evidence-manifest.json')]);
    expect(invalid.code).toBe(1);
    expect(cliSummary(invalid.stdout)).toMatchObject({ ok: false, exitCode: 1, mode: 'verify' });

    const argumentError = runCli(['--verify']);
    expect(argumentError.code).toBe(2);
    expect(argumentError.stderr).toContain('✗ [ARG_INVALID]');
    expect(argumentError.stdout).toContain('ERROR_JSON ');
  });
});
