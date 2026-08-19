/* eslint-disable security/detect-non-literal-fs-filename -- all paths are generated beneath a mkdtemp-owned fixture. */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { evidenceFs } from '../infrastructure/evidence-fs.js';
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
  it.each([[[]], [['--d4-invalid-argument']], [['--verify']]])(
    'returns structured exit 2 for invalid argument set %j without creating an output directory',
    (args) => {
      const result = runCli(args);
      expect(result.code).toBe(2);
      const line = result.stdout.split(/\r?\n/).find((entry) => entry.startsWith('ERROR_JSON '));
      expect(line).toBeDefined();
      expect(JSON.parse(line!.slice('ERROR_JSON '.length))).toMatchObject({ exitCode: 2 });
    },
  );
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

  it('rejects a non-existent output below a symlink parent targeting source state without polluting source', async () => {
    const project = await createProject();
    const source = path.join(project, '.w-model');
    const outputParent = path.join(tmpDir, 'output-parent');
    await fs.symlink(source, outputParent, 'junction');

    const result = await exportEvidence(project, path.join(outputParent, 'evidence'));

    expect(result).toMatchObject({ ok: false, exitCode: 1, reason: 'UNSAFE_OUTPUT_PATH' });
    await expect(fs.access(path.join(source, 'evidence'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('uses bytewise path ordering for Unicode and mixed-case evidence paths', async () => {
    const project = await createProject();
    const logs = path.join(project, '.w-model', 'gate-logs');
    await fs.writeFile(path.join(logs, 'Z.json'), '{"ok":true}', 'utf8');
    await fs.writeFile(path.join(logs, 'a.json'), '{"ok":true}', 'utf8');
    await fs.writeFile(path.join(logs, 'é.json'), '{"ok":true}', 'utf8');
    const output = path.join(tmpDir, 'unicode-evidence');

    await expect(exportEvidence(project, output)).resolves.toMatchObject({ ok: true });
    const manifest = JSON.parse(await fs.readFile(path.join(output, 'evidence-manifest.json'), 'utf8')) as {
      files: Array<{ path: string }>;
    };
    const paths = manifest.files.map((entry) => entry.path);
    expect(paths).toEqual([...paths].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)));
  });

  it('rejects manifest path traversal, duplicate paths, evidence symlinks, and unmanifested output files', async () => {
    const project = await createProject();
    const output = path.join(tmpDir, 'verify-boundaries');
    await exportEvidence(project, output);
    const manifestPath = path.join(output, 'evidence-manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
      files: Array<Record<string, unknown>>;
    } & Record<string, unknown>;

    await fs.writeFile(
      manifestPath,
      JSON.stringify({ ...manifest, files: [{ ...manifest.files[0], path: '../escape.json' }] }),
      'utf8',
    );
    await expect(verifyEvidence(manifestPath)).resolves.toMatchObject({ ok: false, reason: 'INVALID_MANIFEST' });

    await fs.writeFile(
      manifestPath,
      JSON.stringify({ ...manifest, files: [manifest.files[0], manifest.files[0]] }),
      'utf8',
    );
    await expect(verifyEvidence(manifestPath)).resolves.toMatchObject({ ok: false, reason: 'INVALID_MANIFEST' });

    await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf8');
    await fs.writeFile(path.join(output, 'extra.txt'), 'unexpected', 'utf8');
    await expect(verifyEvidence(manifestPath)).resolves.toMatchObject({ ok: false, reason: 'UNMANIFESTED_OUTPUT' });
    await fs.unlink(path.join(output, 'extra.txt'));

    const linkedFile = path.join(output, 'gate-logs', 'gate.json');
    const outside = path.join(tmpDir, 'outside.json');
    await fs.writeFile(outside, '{"ok":true}', 'utf8');
    await fs.unlink(linkedFile);
    await fs.symlink(outside, linkedFile);
    await expect(verifyEvidence(manifestPath)).resolves.toMatchObject({ ok: false, reason: 'UNSAFE_OUTPUT_PATH' });
  });

  it('returns stable non-sensitive failure categories for invalid JSON evidence', async () => {
    const project = await createProject();
    const unsafeName = 'token=actual-secret.json';
    await fs.writeFile(path.join(project, '.w-model', 'gate-logs', unsafeName), '{not-json', 'utf8');

    const result = await exportEvidence(project, path.join(tmpDir, 'invalid-json-output'));

    expect(result).toEqual(expect.objectContaining({ ok: false, exitCode: 1, reason: 'INVALID_JSON_EVIDENCE' }));
    expect(JSON.stringify(result)).not.toContain('actual-secret');
    expect(JSON.stringify(result)).not.toContain(project);
  });

  it('cleans staged output when atomic publish rename fails', async () => {
    const project = await createProject();
    const output = path.join(tmpDir, 'publish-failure-output');
    const originalRename = evidenceFs.rename;
    const renameSpy = vi.spyOn(evidenceFs, 'rename').mockImplementation(async (from, to) => {
      if (String(to) === output) throw new Error('injected publish failure');
      return originalRename(from, to);
    });

    try {
      await expect(exportEvidence(project, output)).resolves.toMatchObject({
        ok: false,
        exitCode: 1,
        reason: 'EVIDENCE_EXPORT_FAILED',
      });
      expect((await fs.readdir(tmpDir)).filter((entry) => entry.startsWith('publish-failure-output.tmp-'))).toEqual([]);
      await expect(fs.access(output)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      renameSpy.mockRestore();
    }
  });

  it('detects a source file replaced with a symlink between pre-read snapshot and read', async () => {
    const project = await createProject();
    const source = path.join(project, '.w-model', 'gate-logs', 'gate.json');
    const outside = path.join(tmpDir, 'replacement.json');
    await fs.writeFile(outside, '{"token":"outside-secret"}', 'utf8');
    const originalReadFile = evidenceFs.readFile;
    let replaced = false;
    const readSpy = vi.spyOn(evidenceFs, 'readFile').mockImplementation(async (...args) => {
      const target = String(args[0]);
      if (!replaced && target === source) {
        replaced = true;
        await fs.unlink(source);
        await fs.symlink(outside, source);
      }
      return originalReadFile(...args);
    });

    try {
      await expect(exportEvidence(project, path.join(tmpDir, 'race-output'))).resolves.toMatchObject({
        ok: false,
        exitCode: 1,
        reason: 'UNSAFE_SOURCE_PATH',
      });
    } finally {
      readSpy.mockRestore();
    }
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
    expect(invalid.stdout).toContain('ERROR_JSON ');

    const argumentError = runCli(['--verify']);
    expect(argumentError.code).toBe(2);
    expect(argumentError.stderr).toContain('✗ [ARG_INVALID]');
    expect(argumentError.stdout).toContain('ERROR_JSON ');
  });

  it('rejects a source-targeting output-parent symlink through the real CLI without source pollution', async () => {
    const project = await createProject();
    const source = path.join(project, '.w-model');
    const outputParent = path.join(tmpDir, 'cli-output-parent');
    await fs.symlink(source, outputParent, 'junction');

    const result = runCli([project, path.join(outputParent, 'evidence')]);

    expect(result.code).toBe(1);
    expect(cliSummary(result.stdout)).toMatchObject({ ok: false, exitCode: 1, reason: 'UNSAFE_OUTPUT_PATH' });
    expect(result.stdout).toContain('ERROR_JSON ');
    await expect(fs.access(path.join(source, 'evidence'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects verify traversal, duplicate, symlink, and unmanifested output through the real CLI', async () => {
    const project = await createProject();
    const output = path.join(tmpDir, 'cli-verify-boundaries');
    expect(runCli([project, output]).code).toBe(0);
    const manifestPath = path.join(output, 'evidence-manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
      files: Array<Record<string, unknown>>;
    } & Record<string, unknown>;

    await fs.writeFile(
      manifestPath,
      JSON.stringify({ ...manifest, files: [{ ...manifest.files[0], path: '../escape.json' }] }),
      'utf8',
    );
    const traversal = runCli(['--verify', manifestPath]);
    expect(traversal.code).toBe(1);
    expect(traversal.stdout).toContain('ERROR_JSON ');

    await fs.writeFile(
      manifestPath,
      JSON.stringify({ ...manifest, files: [manifest.files[0], manifest.files[0]] }),
      'utf8',
    );
    const duplicate = runCli(['--verify', manifestPath]);
    expect(duplicate.code).toBe(1);
    expect(duplicate.stdout).toContain('ERROR_JSON ');

    await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf8');
    await fs.writeFile(path.join(output, 'extra.txt'), 'extra', 'utf8');
    const extra = runCli(['--verify', manifestPath]);
    expect(extra.code).toBe(1);
    expect(extra.stdout).toContain('ERROR_JSON ');
    await fs.unlink(path.join(output, 'extra.txt'));

    const evidence = path.join(output, 'gate-logs', 'gate.json');
    const outside = path.join(tmpDir, 'outside-cli.json');
    await fs.writeFile(outside, '{"safe":true}', 'utf8');
    await fs.unlink(evidence);
    await fs.symlink(outside, evidence);
    const symlink = runCli(['--verify', manifestPath]);
    expect(symlink.code).toBe(1);
    expect(symlink.stdout).toContain('ERROR_JSON ');
  });

  it('emits safe structured CLI errors for invalid JSON and output safety failures', async () => {
    const project = await createProject();
    const secretName = 'token=actual-secret.json';
    await fs.writeFile(path.join(project, '.w-model', 'gate-logs', secretName), '{invalid', 'utf8');

    const invalidJson = runCli([project, path.join(tmpDir, 'bad-json')]);
    expect(invalidJson.code).toBe(1);
    expect(cliSummary(invalidJson.stdout)).toMatchObject({ ok: false, exitCode: 1, reason: 'INVALID_JSON_EVIDENCE' });
    expect(invalidJson.stdout).toContain('ERROR_JSON ');
    expect(invalidJson.stdout + invalidJson.stderr).not.toContain(project);
    expect(invalidJson.stdout + invalidJson.stderr).not.toContain('actual-secret');

    const binaryProject = await createProject('binary-project');
    await fs.writeFile(path.join(binaryProject, '.w-model', 'gate-logs', 'raw.bin'), Buffer.from([0, 1]));
    const binary = runCli([binaryProject, path.join(tmpDir, 'binary-output')]);
    expect(binary.code).toBe(1);
    expect(binary.stdout).toContain('ERROR_JSON ');

    const nonempty = path.join(tmpDir, 'nonempty-cli-output');
    await fs.mkdir(nonempty);
    await fs.writeFile(path.join(nonempty, 'old.txt'), 'old', 'utf8');
    const nonemptyResult = runCli([binaryProject, nonempty]);
    expect(nonemptyResult.code).toBe(1);
    expect(nonemptyResult.stdout).toContain('ERROR_JSON ');
  });
});
