/* eslint-disable security/detect-non-literal-fs-filename -- all paths are generated beneath a mkdtemp-owned fixture. */
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { evidenceFs } from '../infrastructure/evidence-fs.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';
import { exportEvidence, redact, verifyEvidence } from '../logic/evidence-export-logic.js';
import { produceSourceProvenance } from '../logic/evidence-provenance-logic.js';
import { childProcessEnv } from '../lib/run-sync.js';

const execFileAsync = promisify(execFile);
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

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function evidenceContentHash(files: Array<{ path: string; sha256: string }>): string {
  return sha256(
    JSON.stringify([...files].sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))),
  );
}

function evidenceManifestHash(manifest: {
  schemaVersion: string;
  exportedAt: string;
  sourceProject: string;
  provenance: unknown;
  files: unknown;
}): string {
  return sha256(
    JSON.stringify({
      schemaVersion: manifest.schemaVersion,
      exportedAt: manifest.exportedAt,
      sourceProject: manifest.sourceProject,
      provenance: manifest.provenance,
      files: manifest.files,
    }),
  );
}

function refreshManifestHash(manifest: Record<string, unknown>): void {
  manifest.manifestSha256 = evidenceManifestHash(manifest as Parameters<typeof evidenceManifestHash>[0]);
}

async function createProject(
  name = 'project',
  options: { noGit?: boolean; chain?: 'legacy' | 'root' } = {},
): Promise<string> {
  const project = projectPath(name);
  const state = path.join(project, '.w-model');
  await fs.mkdir(path.join(state, 'gate-logs'), { recursive: true });
  await fs.mkdir(path.join(state, 'verifier-outputs'), { recursive: true });
  if ((options.chain ?? 'legacy') === 'legacy')
    await fs.mkdir(path.join(state, 'signature-chains'), { recursive: true });
  await fs.mkdir(path.join(state, 'codegraph-queries'), { recursive: true });
  await fs.writeFile(
    path.join(state, 'gate-logs', 'gate.json'),
    JSON.stringify({
      script: 'check-bdd-model.ts',
      exitCode: 0,
      passed: true,
      reasons: [],
      reportSummary: {
        phase: 1,
        checkedAt: '2026-08-20T00:00:00.000Z',
        summary: 'ok',
        violationsCount: 0,
        exitCode: 0,
        passed: true,
      },
      stdoutSummary: { exitCode: 0, passed: true },
    }),
    'utf8',
  );
  await fs.writeFile(
    path.join(state, 'verifier-outputs', 'verifier.json'),
    JSON.stringify({
      passed: true,
      apiKey: 'verifier-key',
      rows: [{ password: 'verifier-password' }],
    }),
    'utf8',
  );
  await fs.copyFile(
    path.resolve(process.cwd(), 'w-model-dev/scripts/samples/signature-chain/valid-all-roles.jsonl'),
    path.join(
      state,
      (options.chain ?? 'legacy') === 'legacy' ? 'signature-chains/chain.jsonl' : 'signature-chain.jsonl',
    ),
  );
  await fs.writeFile(
    path.join(state, 'codegraph-queries', 'query.json'),
    JSON.stringify({
      sourcePath: '/private/source',
      path: 'D:/private/worktree',
      nested: {
        paths: ['\\\\server\\share\\secret', '/home/alice/private'],
        ACCESS_TOKEN: 'query-access-token',
        'private-key': 'query-private-key',
      },
      token: 'query-token',
    }),
    'utf8',
  );
  await fs.writeFile(
    path.join(state, 'codegraph-queries', 'query.md'),
    'source: D:/private/worktree with spaces\nresult: /home/alice/private\nnetwork: //host/private/share\nAuthorization: Bearer markdown-authorization\nprivate_key = markdown-private-key\nlink: https://example.test/relative\nrelative: docs/relative.md\n',
    'utf8',
  );
  const runLog = await fs.readFile(
    path.resolve(process.cwd(), 'w-model-dev/scripts/samples/run-log/valid.jsonl'),
    'utf8',
  );
  // 只有首个 gate 记录携带 gateLogPath：provenance 契约要求证据目录内每个 gate-log 文件
  // 恰被 run-log 引用一次，而 valid.jsonl 迁移后含每阶段 5 条 R11 闭环 gate 记录——
  // 给所有 gate 行都标注会让同一文件被引用多次（RUN_LOG_NOT_PASSED）。
  const runLogLines = runLog.split(/\r?\n/);
  const taggedGateIndex = runLogLines.findIndex((line) => line.includes('"action":"gate"'));
  if (taggedGateIndex < 0) throw new Error('run-log fixture 缺少 gate 记录');
  // eslint-disable-next-line security/detect-object-injection -- taggedGateIndex 由同一数组 findIndex 得出且上方已断言 >= 0（受控下标，非外部键）
  runLogLines[taggedGateIndex] = runLogLines[taggedGateIndex]!.replace(/\}$/, ',"gateLogPath":"gate.json"}');
  await fs.writeFile(path.join(state, 'run-log.jsonl'), runLogLines.join('\n'));
  if (options.noGit) {
    // 无 git 工作区（遗留⑥a）：provenance 以 no-git 形态产出，导出包永久只能 package-only。
    const noGitProvenance = await produceSourceProvenance(project, { noGitOk: true });
    if (!noGitProvenance.ok) throw new Error(`no-git provenance fixture setup failed: ${noGitProvenance.reason}`);
    return project;
  }
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
  const provenance = await produceSourceProvenance(project);
  if (!provenance.ok) throw new Error(`provenance fixture setup failed: ${provenance.reason}`);
  return project;
}

function runCli(args: string[]): {
  code: number | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync(process.execPath, [tsxCli, SCRIPT, ...args], {
    encoding: 'utf8',
    // Load-sensitive: the real `tsx` CLI cold start can exceed 15 s when the full suite runs in parallel
    // (spawnSync then kills it and reports `status: null`). 60 s keeps the bounded-timeout intent while
    // removing the false failure; assertions are unchanged.
    timeout: 60_000,
    env: childProcessEnv(),
  });
  return {
    code: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function cliSummary(stdout: string): Record<string, unknown> {
  const line = stdout.split(/\r?\n/).find((entry) => entry.startsWith('EVIDENCE_EXPORT_JSON '));
  expect(line).toBeDefined();
  return JSON.parse(line!.slice('EVIDENCE_EXPORT_JSON '.length)) as Record<string, unknown>;
}

describe('evidence export logic', () => {
  it('returns structured exit 2 for invalid argument sets（3 形态：无参 / 未知 flag / 裸 --verify）without creating an output directory', () => {
    for (const args of [[], ['--d4-invalid-argument'], ['--verify']] as const) {
      const result = runCli([...args]);
      expect(result.code, `args=${JSON.stringify(args)}: 应 exit 2`).toBe(2);
      const line = result.stdout.split(/\r?\n/).find((entry) => entry.startsWith('ERROR_JSON '));
      expect(line, `args=${JSON.stringify(args)}: 应有 ERROR_JSON 行`).toBeDefined();
      expect(
        JSON.parse(line!.slice('ERROR_JSON '.length)),
        `args=${JSON.stringify(args)}: 摘要应含 exitCode 2`,
      ).toMatchObject({ exitCode: 2 });
    }
  });
  it('exports only runtime evidence and excludes project source, local tools, coverage, and archive paths', async () => {
    const project = await createProject();
    await fs.mkdir(path.join(project, '.zcode'), { recursive: true });
    await fs.mkdir(path.join(project, 'coverage'), { recursive: true });
    await fs.mkdir(path.join(project, 'docs', 'changes', 'archive'), { recursive: true });
    await fs.writeFile(path.join(project, 'src.ts'), 'const source = true;\\n', 'utf8');
    await fs.writeFile(path.join(project, '.zcode', 'session.json'), '{"token":"local-secret"}\\n', 'utf8');
    await fs.writeFile(path.join(project, 'coverage', 'coverage.json'), '{}\\n', 'utf8');
    await fs.writeFile(path.join(project, 'docs', 'changes', 'archive', 'history.md'), 'history\\n', 'utf8');

    const output = path.join(tmpDir, 'allowlist-evidence');
    const result = runCli([project, output]);

    expect(result.code).toBe(0);
    const manifest = JSON.parse(await fs.readFile(path.join(output, 'evidence-manifest.json'), 'utf8')) as {
      files: Array<{ path: string; kind: string }>;
    };
    expect(
      manifest.files.every(
        ({ path: filePath }) =>
          filePath.startsWith('gate-logs/') ||
          filePath.startsWith('verifier-outputs/') ||
          filePath.startsWith('signature-chains/') ||
          filePath === 'signature-chain.jsonl' ||
          filePath.startsWith('codegraph-queries/') ||
          filePath === 'run-log.jsonl',
      ),
    ).toBe(true);
    expect(JSON.stringify(manifest)).not.toContain('.zcode');
    expect(JSON.stringify(manifest)).not.toContain('coverage');
    expect(JSON.stringify(manifest)).not.toContain('docs/changes/archive');
    expect(JSON.stringify(manifest)).not.toContain('src.ts');
  });

  it('exports allowlisted runtime records with stable kinds, sorted paths, and verifiable hashes', async () => {
    const project = await createProject();
    const output = path.join(tmpDir, 'evidence');

    const result = await exportEvidence(project, output);

    expect(result).toEqual(expect.objectContaining({ ok: true, exitCode: 0 }));
    const manifest = JSON.parse(await fs.readFile(path.join(output, 'evidence-manifest.json'), 'utf8')) as {
      schemaVersion: string;
      exportedAt: string;
      sourceProject: string;
      provenance: unknown;
      manifestSha256: string;
      files: Array<{ path: string; kind: string; sha256: string }>;
    };
    expect(validateBySchema('evidence-manifest', manifest).valid).toBe(true);
    expect(manifest.schemaVersion).toBe('1.0');
    expect(manifest.sourceProject).not.toContain(project);
    expect(manifest.files.map((entry) => entry.path)).toEqual([...manifest.files.map((entry) => entry.path)].sort());
    expect(manifest.files.map((entry) => entry.kind)).toEqual([
      'codegraph-query',
      'codegraph-query',
      'gate-log',
      'run-log',
      'signature-chain',
      'verifier-output',
    ]);
    expect(manifest.files.some((entry) => entry.path === 'codegraph-queries/query.md')).toBe(true);
    expect(manifest.files.every((entry) => /^[0-9a-f]{64}$/.test(entry.sha256))).toBe(true);
    expect(manifest.files.some((entry) => entry.path === 'evidence-manifest.json')).toBe(false);
    expect(manifest.manifestSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.manifestSha256).toBe(evidenceManifestHash(manifest as Parameters<typeof evidenceManifestHash>[0]));
  });

  it('binds exported packages to a passed source verification provenance and rejects missing provenance through the real CLI', async () => {
    const project = await createProject();
    const output = path.join(tmpDir, 'provenance-evidence');

    const exported = runCli([project, output]);

    expect(exported.code).toBe(0);
    const manifest = JSON.parse(await fs.readFile(path.join(output, 'evidence-manifest.json'), 'utf8')) as {
      provenance: Record<string, unknown>;
      files: Array<{ path: string; sha256: string }>;
    };
    expect(manifest.provenance).toMatchObject({
      format: 'w-model-evidence-provenance',
      version: 1,
      runId: 'r12',
      commitSha: expect.stringMatching(/^[0-9a-f]{40}$/),
      artifactId: 'evidence-r12',
      verificationStatus: 'passed',
      measurements: {
        gateLogs: {
          count: 1,
          contentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
        verifierOutputs: {
          count: 1,
          contentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
        runLog: {
          count: 1,
          contentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
        signatureChain: {
          count: 1,
          contentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
      },
      contentHash: evidenceContentHash(manifest.files),
    });
    const packageOnly = runCli(['--verify', path.join(output, 'evidence-manifest.json')]);
    expect(packageOnly.code).toBe(0);
    expect(cliSummary(packageOnly.stdout)).toMatchObject({
      ok: true,
      verificationLevel: 'package-only',
    });
    const sourceBound = runCli(['--verify', path.join(output, 'evidence-manifest.json'), '--source-project', project]);
    expect(sourceBound.code).toBe(0);
    expect(cliSummary(sourceBound.stdout)).toMatchObject({
      ok: true,
      verificationLevel: 'source-bound',
      verificationStatus: 'passed',
    });

    await fs.rm(path.join(project, '.w-model', 'evidence-provenance.json'));
    const rejected = runCli([project, path.join(tmpDir, 'missing-provenance-evidence')]);
    expect(rejected.code).toBe(1);
    expect(cliSummary(rejected.stdout)).toMatchObject({
      ok: false,
      reason: 'INVALID_PROVENANCE',
    });

    const unverifiedProject = await createProject('unverified-project');
    const sourceProvenance = path.join(unverifiedProject, '.w-model', 'evidence-provenance.json');
    const unverified = JSON.parse(await fs.readFile(sourceProvenance, 'utf8')) as Record<string, unknown>;
    unverified.verificationStatus = 'unverified';
    await fs.writeFile(sourceProvenance, JSON.stringify(unverified), 'utf8');
    const unverifiedResult = runCli([unverifiedProject, path.join(tmpDir, 'unverified-evidence')]);
    expect(unverifiedResult.code).toBe(1);
    expect(cliSummary(unverifiedResult.stdout)).toMatchObject({
      ok: false,
      reason: 'INVALID_PROVENANCE',
    });

    const sourceTamperedProject = await createProject('source-tampered-project');
    const sourceTamperedOutput = path.join(tmpDir, 'source-tampered-evidence');
    expect(runCli([sourceTamperedProject, sourceTamperedOutput]).code).toBe(0);
    const sourceTamperedManifest = path.join(sourceTamperedOutput, 'evidence-manifest.json');
    const sourceTamperedProvenancePath = path.join(sourceTamperedProject, '.w-model', 'evidence-provenance.json');
    const sourceTamperedProvenance = JSON.parse(await fs.readFile(sourceTamperedProvenancePath, 'utf8')) as Record<
      string,
      unknown
    >;
    sourceTamperedProvenance.artifactId = 'forged-artifact';
    await fs.writeFile(sourceTamperedProvenancePath, JSON.stringify(sourceTamperedProvenance), 'utf8');
    const sourceTampered = runCli(['--verify', sourceTamperedManifest, '--source-project', sourceTamperedProject]);
    expect(sourceTampered.code).toBe(1);
    expect(cliSummary(sourceTampered.stdout)).toMatchObject({
      ok: false,
      reason: 'INVALID_PROVENANCE',
    });

    const manifestTamperedProject = await createProject('manifest-tampered-project');
    const manifestTamperedOutput = path.join(tmpDir, 'manifest-tampered-evidence');
    expect(runCli([manifestTamperedProject, manifestTamperedOutput]).code).toBe(0);
    const manifestTamperedPath = path.join(manifestTamperedOutput, 'evidence-manifest.json');
    const manifestTampered = JSON.parse(await fs.readFile(manifestTamperedPath, 'utf8')) as {
      provenance: {
        runId: string;
        artifactId: string;
        producerVersion: string;
      };
    };
    manifestTampered.provenance.runId = 'forged-run';
    manifestTampered.provenance.artifactId = 'forged-artifact';
    manifestTampered.provenance.producerVersion = 'forged-producer';
    await fs.writeFile(manifestTamperedPath, JSON.stringify(manifestTampered), 'utf8');
    const manifestTamperedResult = runCli([
      '--verify',
      manifestTamperedPath,
      '--source-project',
      manifestTamperedProject,
    ]);
    expect(manifestTamperedResult.code).toBe(1);
    expect(cliSummary(manifestTamperedResult.stdout)).toMatchObject({
      ok: false,
      reason: 'INVALID_PROVENANCE',
    });
  }, 90_000);

  it('exports and measures a root-level signature-chain.jsonl as an allowlisted signature-chain record', async () => {
    const project = await createProject('root-chain-project', { chain: 'root' });
    const output = path.join(tmpDir, 'root-chain-evidence');

    const result = await exportEvidence(project, output);

    expect(result).toEqual(expect.objectContaining({ ok: true, exitCode: 0 }));
    // git 包的导出摘要保持现状：不带 verificationLevel（只有 no-git 包补 package-only）。
    expect(result).not.toHaveProperty('verificationLevel');
    const manifest = JSON.parse(await fs.readFile(path.join(output, 'evidence-manifest.json'), 'utf8')) as {
      provenance: { measurements: { signatureChain: { count: number } } };
      files: Array<{ path: string; kind: string }>;
    };
    expect(validateBySchema('evidence-manifest', manifest).valid).toBe(true);
    expect(manifest.files).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'signature-chain.jsonl', kind: 'signature-chain' })]),
    );
    expect(manifest.provenance.measurements.signatureChain).toMatchObject({ count: 1 });
    expect(await fs.readFile(path.join(output, 'signature-chain.jsonl'), 'utf8')).toContain('sigId');
    await expect(verifyEvidence(path.join(output, 'evidence-manifest.json'), project)).resolves.toMatchObject({
      ok: true,
      exitCode: 0,
      verificationLevel: 'source-bound',
    });
  });

  it('fails closed on both sides when the root-level chain and the legacy signature-chains directory coexist', async () => {
    const project = await createProject('ambiguous-chain-project');
    const output = path.join(tmpDir, 'ambiguous-chain-evidence');
    expect(runCli([project, output]).code).toBe(0);
    const manifestPath = path.join(output, 'evidence-manifest.json');
    // 并存歧义由源工作区引入：唯一根级文件 + legacy 复数目录 → 无法裁定权威链。
    await fs.copyFile(
      path.resolve(process.cwd(), 'w-model-dev/scripts/samples/signature-chain/valid-all-roles.jsonl'),
      path.join(project, '.w-model', 'signature-chain.jsonl'),
    );

    await expect(exportEvidence(project, path.join(tmpDir, 'ambiguous-second-evidence'))).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
      reason: 'SIGNATURE_CHAIN_AMBIGUOUS',
    });
    await expect(verifyEvidence(manifestPath, project)).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
      reason: 'SIGNATURE_CHAIN_AMBIGUOUS',
    });
  });

  it('rejects mutated source bundle and run provenance before creating a passed manifest', async () => {
    const project = await createProject();
    const sourceProvenancePath = path.join(project, '.w-model', 'evidence-provenance.json');
    const sourceProvenance = JSON.parse(await fs.readFile(sourceProvenancePath, 'utf8')) as {
      sourceBundleSha256: string;
      runId: string;
      measurements: unknown;
    };
    const unchangedMeasurements = sourceProvenance.measurements;
    sourceProvenance.sourceBundleSha256 = 'f'.repeat(64);
    sourceProvenance.runId = 'forged-run';
    sourceProvenance.measurements = unchangedMeasurements;
    await fs.writeFile(sourceProvenancePath, JSON.stringify(sourceProvenance), 'utf8');

    const output = path.join(tmpDir, 'forged-provenance-evidence');
    await expect(exportEvidence(project, output)).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
      reason: 'INVALID_PROVENANCE',
    });
    await expect(fs.access(output)).rejects.toThrow();
    await expect(fs.access(path.join(output, 'evidence-manifest.json'))).rejects.toThrow();
  });

  it('redacts spaced sensitive keys in JSONL and Markdown even when values look like URLs or relative paths', async () => {
    const project = await createProject();
    const queryDirectory = path.join(project, '.w-model', 'codegraph-queries');
    await fs.writeFile(
      path.join(queryDirectory, 'sensitive.jsonl'),
      [
        JSON.stringify({ 'api key': 'https://example.test/api-key-secret' }),
        JSON.stringify({ 'access token': './relative-token-secret' }),
        JSON.stringify({ 'private key': 'private-key-secret' }),
      ].join('\n') + '\n',
      'utf8',
    );
    await fs.appendFile(
      path.join(queryDirectory, 'query.md'),
      [
        'Authorization: https://example.test/authorization-secret',
        'api key: ./api-key-secret',
        'access token = https://example.test/access-token-secret',
        'private key: ./private-key-secret',
        '',
      ].join('\n'),
      'utf8',
    );
    expect((await produceSourceProvenance(project)).ok).toBe(true);
    const output = path.join(tmpDir, 'spaced-sensitive-evidence');

    const exported = runCli([project, output]);

    expect(exported.code).toBe(0);
    const markdown = await fs.readFile(path.join(output, 'codegraph-queries', 'query.md'), 'utf8');
    const jsonl = await fs.readFile(path.join(output, 'codegraph-queries', 'sensitive.jsonl'), 'utf8');
    for (const secret of [
      'authorization-secret',
      'api-key-secret',
      'access-token-secret',
      'private-key-secret',
      'relative-token-secret',
    ]) {
      expect(markdown + jsonl).not.toContain(secret);
    }
    expect(markdown).toContain('Authorization: [REDACTED]');
    expect(markdown).toContain('api key: [REDACTED]');
    expect(markdown).toContain('access token = [REDACTED]');
    expect(markdown).toContain('private key: [REDACTED]');
    expect(jsonl).toContain('"api key":"[REDACTED]"');
    expect(jsonl).toContain('"access token":"[REDACTED]"');
    expect(jsonl).toContain('"private key":"[REDACTED]"');
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
        'codegraph-queries/query.md',
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
      'query-access-token',
      'query-private-key',
      'run-secret',
      'run-key',
      'run-credential',
      'markdown-authorization',
      'markdown-private-key',
      'D:/private/worktree with spaces',
      '\\\\server\\share\\secret',
      '/home/alice/private',
      '//host/private/share',
      '/var/private/run',
    ]) {
      expect(outputText).not.toContain(secret);
    }
    expect(outputText).toContain('<redacted-absolute-path>');
    expect(outputText).not.toContain('<redacted-absolute-path> with spaces');
    expect(outputText).toContain('network: <redacted-absolute-path>');
    expect(outputText).toContain('link: https://example.test/relative');
    expect(outputText).toContain('relative: docs/relative.md');
    expect(JSON.parse(combined[2]!.split(/\r?\n/).find((line) => line.trim())!)).toMatchObject({
      sigId: expect.any(String),
    });
    expect(JSON.parse(combined[3]!)).toMatchObject({
      nested: { ACCESS_TOKEN: '[REDACTED]', 'private-key': '[REDACTED]' },
    });
    expect(combined[4]).toContain('Authorization: [REDACTED]');
    expect(combined[4]).toContain('private_key = [REDACTED]');
  });

  it('sanitizes Markdown table cells without changing ordinary values or pipe layout', async () => {
    const project = await createProject();
    const markdownPath = path.join(project, '.w-model', 'codegraph-queries', 'query.md');
    await fs.appendFile(
      markdownPath,
      [
        '| Authorization | Bearer table-secret |',
        '| Name | Authorization |',
        '|---|---|',
        '| Alice | Bearer header-secret |',
        '| private-key | key-secret |',
        '| Access Token | token-secret |',
        '',
        '| Label | Value |',
        '|---|---|',
        '| ordinary | docs/relative.md |',
        '| escaped | keep\\|this |',
        '| authorization | Bearer no-tail-secret',
        '| HTTPS | https://example.test/token |',
        '| Relative | ./docs/readme.md |',
        '',
      ].join('\n'),
      'utf8',
    );
    expect((await produceSourceProvenance(project)).ok).toBe(true);
    const output = path.join(tmpDir, 'markdown-table-evidence');

    await expect(exportEvidence(project, output)).resolves.toMatchObject({
      ok: true,
    });

    const exported = await fs.readFile(path.join(output, 'codegraph-queries', 'query.md'), 'utf8');
    expect(exported).not.toContain('Bearer table-secret');
    expect(exported).not.toContain('Bearer header-secret');
    expect(exported).not.toContain('key-secret');
    expect(exported).not.toContain('token-secret');
    expect(exported).not.toContain('Bearer no-tail-secret');
    expect(exported).toContain('| Authorization | [REDACTED] |');
    expect(exported).toContain('| Alice | [REDACTED] |');
    expect(exported).toContain('| private-key | [REDACTED] |');
    expect(exported).toContain('| Access Token | [REDACTED] |');
    expect(exported).toContain('| ordinary | docs/relative.md |');
    expect(exported).toContain('| escaped | keep\\|this |');
    expect(exported).toContain('| HTTPS | https://example.test/token |');
    expect(exported).toContain('| Relative | ./docs/readme.md |');
  });

  it('conservatively redacts prefixed Markdown key/value lines without damaging URLs or relative paths', async () => {
    const project = await createProject();
    const markdownPath = path.join(project, '.w-model', 'codegraph-queries', 'query.md');
    await fs.appendFile(
      markdownPath,
      [
        '- Authorization: Bearer list-secret',
        '> context | Authorization: Bearer quote-secret',
        '[INFO] Authorization: Bearer log-secret',
        '``` Authorization: Bearer code-secret',
        'context | Authorization: Bearer embedded-secret',
        'link: https://example.test/Authorization:Bearer-safe',
        'relative: docs/Authorization:relative.md',
        '',
      ].join('\n'),
      'utf8',
    );
    expect((await produceSourceProvenance(project)).ok).toBe(true);
    const output = path.join(tmpDir, 'markdown-fallback-evidence');

    await expect(exportEvidence(project, output)).resolves.toMatchObject({ ok: true });
    const exported = await fs.readFile(path.join(output, 'codegraph-queries', 'query.md'), 'utf8');
    for (const secret of ['list-secret', 'quote-secret', 'log-secret', 'code-secret', 'embedded-secret'])
      expect(exported).not.toContain(secret);
    expect(exported).toContain('link: https://example.test/Authorization:Bearer-safe');
    expect(exported).toContain('relative: docs/Authorization:relative.md');
  });

  it('preserves empty Markdown cells so sensitive header columns cannot leak secrets', async () => {
    const project = await createProject();
    const markdownPath = path.join(project, '.w-model', 'codegraph-queries', 'query.md');
    await fs.appendFile(
      markdownPath,
      ['| Name || Authorization |', '|---||---|', '| Alice | ordinary | Bearer empty-cell-secret |', ''].join('\n'),
      'utf8',
    );
    expect((await produceSourceProvenance(project)).ok).toBe(true);
    const output = path.join(tmpDir, 'empty-cell-markdown-evidence');

    await expect(exportEvidence(project, output)).resolves.toMatchObject({
      ok: true,
    });

    const exported = await fs.readFile(path.join(output, 'codegraph-queries', 'query.md'), 'utf8');
    expect(exported).not.toContain('Bearer empty-cell-secret');
    expect(exported).toContain('| Name || Authorization |');
    expect(exported).toContain('|---||---|');
    expect(exported).toContain('| Alice | ordinary | [REDACTED] |');
  });

  it('rejects hash-valid unsanitized Markdown with an empty header cell after recomputing hashes', async () => {
    const project = await createProject();
    const output = path.join(tmpDir, 'empty-cell-verify-evidence');
    await exportEvidence(project, output);
    const manifestPath = path.join(output, 'evidence-manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
      files: Array<{ path: string; sha256: string }>;
      provenance: { contentHash: string };
    };
    const targetPath = path.join(output, 'codegraph-queries', 'query.md');
    const unsafeContent = '| Name || Authorization |\n|---||---|\n| Alice | ordinary | Bearer empty-cell-secret |\n';
    await fs.writeFile(targetPath, unsafeContent, 'utf8');
    const target = manifest.files.find((file) => file.path === 'codegraph-queries/query.md');
    expect(target).toBeDefined();
    target!.sha256 = sha256(unsafeContent);
    manifest.provenance.contentHash = evidenceContentHash(manifest.files);
    refreshManifestHash(manifest as unknown as Record<string, unknown>);
    await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf8');

    await expect(verifyEvidence(manifestPath)).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
      reason: 'UNSANITIZED_EVIDENCE',
    });
  });

  it('verifies exported Markdown with the same sanitizer and rejects hash-valid unsanitized content', async () => {
    const project = await createProject();
    const output = path.join(tmpDir, 'markdown-verify-evidence');
    await exportEvidence(project, output);
    const manifestPath = path.join(output, 'evidence-manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
      files: Array<{ path: string; sha256: string }>;
      provenance: { contentHash: string };
    };
    const targetPath = path.join(output, 'codegraph-queries', 'query.md');
    const unsafeContent = '| Authorization | Bearer manually-added-secret |\n';
    await fs.writeFile(targetPath, unsafeContent, 'utf8');
    const target = manifest.files.find((file) => file.path === 'codegraph-queries/query.md');
    expect(target).toBeDefined();
    target!.sha256 = sha256(unsafeContent);
    manifest.provenance.contentHash = evidenceContentHash(manifest.files);
    refreshManifestHash(manifest as unknown as Record<string, unknown>);
    await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf8');

    await expect(verifyEvidence(manifestPath)).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
      reason: 'UNSANITIZED_EVIDENCE',
    });
  });

  it('verifies a valid export and rejects a tampered exported file', async () => {
    const project = await createProject();
    const output = path.join(tmpDir, 'evidence');
    await exportEvidence(project, output);
    const manifest = path.join(output, 'evidence-manifest.json');

    await expect(verifyEvidence(manifest)).resolves.toMatchObject({
      ok: true,
      exitCode: 0,
    });
    await fs.appendFile(path.join(output, 'gate-logs', 'gate.json'), 'tampered', 'utf8');
    await expect(verifyEvidence(manifest)).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
    });
  });

  it('rejects malicious runId-derived artifactId and filename metadata before creating a manifest', async () => {
    const project = await createProject();
    const state = path.join(project, '.w-model');
    const runLogPath = path.join(state, 'run-log.jsonl');
    const runLog = await fs.readFile(runLogPath, 'utf8');
    await fs.writeFile(runLogPath, runLog.replace(/"runId":"r12"/, '"runId":"token=manifest-secret"'), 'utf8');
    expect((await produceSourceProvenance(project)).ok).toBe(true);
    const output = path.join(tmpDir, 'malicious-id-evidence');

    const idResult = runCli([project, output]);

    expect(idResult.code).toBe(1);
    expect(idResult.stdout + idResult.stderr).not.toContain('manifest-secret');
    await expect(fs.access(path.join(output, 'evidence-manifest.json'))).rejects.toThrow();

    const filenameProject = await createProject('malicious-filename-project');
    const maliciousFile = path.join(filenameProject, '.w-model', 'codegraph-queries', 'token=filename-secret.json');
    await fs.writeFile(maliciousFile, '{"safe":true}\n', 'utf8');
    expect((await produceSourceProvenance(filenameProject)).ok).toBe(true);
    const filenameOutput = path.join(tmpDir, 'malicious-filename-evidence');

    const filenameResult = runCli([filenameProject, filenameOutput]);

    expect(filenameResult.code).toBe(1);
    expect(filenameResult.stdout + filenameResult.stderr).not.toContain('filename-secret');
    await expect(fs.access(path.join(filenameOutput, 'evidence-manifest.json'))).rejects.toThrow();

    const artifactProject = await createProject('malicious-artifact-project');
    const artifactProvenancePath = path.join(artifactProject, '.w-model', 'evidence-provenance.json');
    const artifactProvenance = JSON.parse(await fs.readFile(artifactProvenancePath, 'utf8')) as Record<string, unknown>;
    artifactProvenance.artifactId = 'authorization=artifact-secret';
    await fs.writeFile(artifactProvenancePath, JSON.stringify(artifactProvenance), 'utf8');
    const artifactOutput = path.join(tmpDir, 'malicious-artifact-evidence');

    const artifactResult = runCli([artifactProject, artifactOutput]);

    expect(artifactResult.code).toBe(1);
    expect(artifactResult.stdout + artifactResult.stderr).not.toContain('artifact-secret');
    await expect(fs.access(path.join(artifactOutput, 'evidence-manifest.json'))).rejects.toThrow();
  });

  it('rejects package-only manifests with structural violations（3 态：越单名单路径 / kind 不符 / 乱序）→ INVALID_MANIFEST', async () => {
    for (const { caseName, outputName, mutate } of [
      {
        caseName: '越单名单路径（source 不得作为 runtime evidence）',
        outputName: 'unallowlisted-package',
        mutate: (manifest: {
          files: Array<{ path: string; sha256: string; kind: string }>;
          provenance: { contentHash: string };
        }): void => {
          const content = 'source must not be accepted as runtime evidence\\n';
          manifest.files.push({ path: 'source.ts', sha256: sha256(content), kind: 'gate-log' });
          manifest.provenance.contentHash = evidenceContentHash(manifest.files);
        },
      },
      {
        caseName: 'evidence kind 与 allowlisted 路径不符',
        outputName: 'kind-mismatch-package',
        mutate: async (manifest: {
          files: Array<{ path: string; sha256: string; kind: string }>;
          provenance: { contentHash: string };
        }): Promise<void> => {
          manifest.files[0]!.kind = manifest.files[0]!.kind === 'gate-log' ? 'run-log' : 'gate-log';
        },
      },
      {
        caseName: 'files 不在稳定路径序',
        outputName: 'unsorted-package',
        mutate: async (manifest: {
          files: Array<{ path: string; sha256: string; kind: string }>;
          provenance: { contentHash: string };
        }): Promise<void> => {
          manifest.files.reverse();
        },
      },
    ]) {
      const project = await createProject();
      const output = path.join(tmpDir, outputName);
      await exportEvidence(project, output);
      const manifestPath = path.join(output, 'evidence-manifest.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
        files: Array<{ path: string; sha256: string; kind: string }>;
        provenance: { contentHash: string };
      };
      await mutate(manifest);
      await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf8');

      await expect(verifyEvidence(manifestPath), `${caseName}: 应拒并报 INVALID_MANIFEST`).resolves.toMatchObject({
        ok: false,
        exitCode: 1,
        reason: 'INVALID_MANIFEST',
      });
    }
  });

  it('rejects hash-valid package-only manifests with sensitive provenance IDs and file paths', async () => {
    for (const [field, value, secret] of [
      ['runId', 'token=package-run-secret', 'package-run-secret'],
      ['artifactId', 'authorization=package-artifact-secret', 'package-artifact-secret'],
    ] as const) {
      const project = await createProject(`sensitive-${field}-project`);
      const output = path.join(tmpDir, `sensitive-${field}-output`);
      expect(runCli([project, output]).code).toBe(0);
      const manifestPath = path.join(output, 'evidence-manifest.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
        provenance: Record<string, unknown>;
        files: Array<{ path: string; sha256: string }>;
      };
      if (field === 'runId') manifest.provenance.runId = value;
      else manifest.provenance.artifactId = value;
      manifest.provenance.contentHash = evidenceContentHash(manifest.files);
      refreshManifestHash(manifest as unknown as Record<string, unknown>);
      await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf8');

      const packageOnly = runCli(['--verify', manifestPath]);

      expect(packageOnly.code).toBe(1);
      expect(cliSummary(packageOnly.stdout)).toMatchObject({
        ok: false,
        reason: 'INVALID_PROVENANCE',
      });
      expect(packageOnly.stdout + packageOnly.stderr).not.toContain(secret);
    }

    const project = await createProject('sensitive-file-path-project');
    const output = path.join(tmpDir, 'sensitive-file-path-output');
    expect(runCli([project, output]).code).toBe(0);
    const manifestPath = path.join(output, 'evidence-manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
      provenance: { contentHash: string };
      files: Array<{ path: string; sha256: string; kind: string }>;
    };
    const originalPath = path.join(output, 'gate-logs', 'gate.json');
    const maliciousPath = path.join(output, 'gate-logs', 'token=package-file-secret.json');
    await fs.rename(originalPath, maliciousPath);
    const gate = manifest.files.find((file) => file.path === 'gate-logs/gate.json');
    expect(gate).toBeDefined();
    gate!.path = 'gate-logs/token=package-file-secret.json';
    manifest.provenance.contentHash = evidenceContentHash(manifest.files);
    refreshManifestHash(manifest as unknown as Record<string, unknown>);
    await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf8');

    const packageOnly = runCli(['--verify', manifestPath]);

    expect(packageOnly.code).toBe(1);
    expect(cliSummary(packageOnly.stdout)).toMatchObject({
      ok: false,
      reason: 'INVALID_MANIFEST',
    });
    expect(packageOnly.stdout + packageOnly.stderr).not.toContain('package-file-secret');
  });

  it('rejects the same hash-valid sensitive provenance metadata in source-bound mode', async () => {
    const project = await createProject('source-bound-sensitive-metadata-project');
    const output = path.join(tmpDir, 'source-bound-sensitive-metadata-output');
    expect(runCli([project, output]).code).toBe(0);
    const manifestPath = path.join(output, 'evidence-manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
      provenance: Record<string, unknown>;
      files: Array<{ path: string; sha256: string }>;
    };
    manifest.provenance.runId = 'token=source-bound-secret';
    manifest.provenance.contentHash = evidenceContentHash(manifest.files);
    refreshManifestHash(manifest as unknown as Record<string, unknown>);
    await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf8');

    const sourceBound = runCli(['--verify', manifestPath, '--source-project', project]);

    expect(sourceBound.code).toBe(1);
    expect(cliSummary(sourceBound.stdout)).toMatchObject({
      ok: false,
      reason: 'INVALID_PROVENANCE',
    });
    expect(sourceBound.stdout + sourceBound.stderr).not.toContain('source-bound-secret');
  });

  it('source-bound verification rejects ordinary exported content tampering even when package hashes are recomputed', async () => {
    const project = await createProject();
    const output = path.join(tmpDir, 'source-bound-ordinary-tamper');
    await expect(exportEvidence(project, output)).resolves.toMatchObject({ ok: true });
    const manifestPath = path.join(output, 'evidence-manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
      files: Array<{ path: string; sha256: string }>;
      provenance: { contentHash: string };
    };
    const targetPath = path.join(output, 'codegraph-queries', 'query.json');
    const exportedContent = await fs.readFile(targetPath, 'utf8');
    const tamperedContent = exportedContent.replace('<redacted-absolute-path>', 'attacker-modified');
    expect(tamperedContent).not.toBe(exportedContent);
    await fs.writeFile(targetPath, tamperedContent, 'utf8');
    const target = manifest.files.find((file) => file.path === 'codegraph-queries/query.json');
    expect(target).toBeDefined();
    target!.sha256 = sha256(tamperedContent);
    manifest.provenance.contentHash = evidenceContentHash(manifest.files);
    await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf8');

    await expect(verifyEvidence(manifestPath, project)).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
      reason: 'INVALID_PROVENANCE',
    });
  });

  it('source-bound verification accepts an unchanged export after rebuilding source evidence', async () => {
    const project = await createProject();
    const output = path.join(tmpDir, 'source-bound-valid');
    await expect(exportEvidence(project, output)).resolves.toMatchObject({ ok: true });

    await expect(verifyEvidence(path.join(output, 'evidence-manifest.json'), project)).resolves.toMatchObject({
      ok: true,
      exitCode: 0,
      verificationLevel: 'source-bound',
      verificationStatus: 'passed',
    });
  });

  it('keeps a no-git package package-only and permanently refuses --source-project re-verification', async () => {
    const project = await createProject('no-git-project', { noGit: true });
    const output = path.join(tmpDir, 'no-git-evidence');

    const exported = runCli([project, output]);
    expect(exported.code).toBe(0);
    // 导出摘要与 verify 通道口径一致：no-git 包在成功出口也只自述 package-only。
    expect(cliSummary(exported.stdout)).toMatchObject({
      ok: true,
      mode: 'export',
      verificationLevel: 'package-only',
    });
    const manifestPath = path.join(output, 'evidence-manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as { provenance: Record<string, unknown> };
    expect(manifest.provenance).toMatchObject({
      provenanceKind: 'no-git',
      commitSha: '',
      workspaceDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(validateBySchema('evidence-manifest', manifest).valid).toBe(true);

    const packageOnly = runCli(['--verify', manifestPath]);
    expect(packageOnly.code).toBe(0);
    expect(cliSummary(packageOnly.stdout)).toMatchObject({ ok: true, verificationLevel: 'package-only' });

    const sourceBound = runCli(['--verify', manifestPath, '--source-project', project]);
    expect(sourceBound.code).toBe(1);
    expect(cliSummary(sourceBound.stdout)).toMatchObject({ ok: false, reason: 'NOT_SOURCE_BOUND_NO_GIT' });

    await expect(verifyEvidence(manifestPath, project)).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
      reason: 'NOT_SOURCE_BOUND_NO_GIT',
    });
  });

  it('rejects a hand-assembled hash-valid package that reintroduces an authorization secret through the real CLI', async () => {
    const project = await createProject();
    const output = path.join(tmpDir, 'manually-unsanitized-evidence');
    expect(runCli([project, output]).code).toBe(0);
    const manifestPath = path.join(output, 'evidence-manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
      files: Array<{ path: string; sha256: string }>;
      provenance: { contentHash: string };
    };
    const targetPath = path.join(output, 'gate-logs', 'gate.json');
    const unsafeContent =
      JSON.stringify({ passed: true, authorization: 'Bearer manually-added-secret' }, null, 2) + '\n';
    await fs.writeFile(targetPath, unsafeContent, 'utf8');
    const target = manifest.files.find((file) => file.path === 'gate-logs/gate.json');
    expect(target).toBeDefined();
    target!.sha256 = sha256(unsafeContent);
    manifest.provenance.contentHash = evidenceContentHash(manifest.files);
    refreshManifestHash(manifest as unknown as Record<string, unknown>);
    await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf8');

    const verified = runCli(['--verify', manifestPath]);

    expect(verified.code).toBe(1);
    expect(cliSummary(verified.stdout)).toMatchObject({
      ok: false,
      reason: 'UNSANITIZED_EVIDENCE',
    });
    expect(verified.stdout + verified.stderr).not.toContain('manually-added-secret');
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
    await expect(exportEvidence(project, nonempty)).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
    });
  });

  it('rejects invalid strict manifests including extra fields and malformed hashes', async () => {
    const project = await createProject();
    const output = path.join(tmpDir, 'evidence');
    await exportEvidence(project, output);
    const manifestPath = path.join(output, 'evidence-manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as Record<string, unknown>;

    await fs.writeFile(manifestPath, JSON.stringify({ ...manifest, unexpected: true }), 'utf8');
    await expect(verifyEvidence(manifestPath)).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
    });
    await fs.writeFile(
      manifestPath,
      JSON.stringify({
        ...manifest,
        files: [{ ...(manifest.files as object[])[0], sha256: 'A'.repeat(64) }],
      }),
      'utf8',
    );
    await expect(verifyEvidence(manifestPath)).resolves.toMatchObject({
      ok: false,
      exitCode: 1,
    });
  });

  it('rejects a non-existent output below a symlink parent targeting source state without polluting source', async () => {
    const project = await createProject();
    const source = path.join(project, '.w-model');
    const outputParent = path.join(tmpDir, 'output-parent');
    await fs.symlink(source, outputParent, 'junction');

    const result = await exportEvidence(project, path.join(outputParent, 'evidence'));

    expect(result).toMatchObject({
      ok: false,
      exitCode: 1,
      reason: 'UNSAFE_OUTPUT_PATH',
    });
    await expect(fs.access(path.join(source, 'evidence'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('uses bytewise path ordering for Unicode and mixed-case evidence paths', async () => {
    const project = await createProject();
    const logs = path.join(project, '.w-model', 'gate-logs');
    for (const name of ['Z.json', 'a.json', 'é.json']) {
      await fs.copyFile(path.join(logs, 'gate.json'), path.join(logs, name));
    }
    const runLogPath = path.join(project, '.w-model', 'run-log.jsonl');
    const runLog = await fs.readFile(runLogPath, 'utf8');
    const extraGateEntries = ['Z.json', 'a.json', 'é.json'].map((gateLogPath, index) =>
      JSON.stringify({
        runId: `unicode-gate-${index}`,
        timestamp: `2026-07-10T03:0${index + 1}:30Z`,
        phase: 1,
        phaseName: '需求与范围',
        action: 'gate',
        role: 'G',
        duration_s: 30,
        tokens: 1000,
        estimated: false,
        subagentSpawns: 0,
        gateExitCode: 0,
        gateLogPath,
        outcome: 'success',
      }),
    );
    await fs.writeFile(runLogPath, runLog.replace(/(\{"runId":"r4")/, `${extraGateEntries.join('\n')}\n$1`));
    expect((await produceSourceProvenance(project)).ok).toBe(true);
    const output = path.join(tmpDir, 'unicode-evidence');

    await expect(exportEvidence(project, output)).resolves.toMatchObject({
      ok: true,
    });
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
      JSON.stringify({
        ...manifest,
        files: [{ ...manifest.files[0], path: '../escape.json' }],
      }),
      'utf8',
    );
    await expect(verifyEvidence(manifestPath)).resolves.toMatchObject({
      ok: false,
      reason: 'INVALID_MANIFEST',
    });

    await fs.writeFile(
      manifestPath,
      JSON.stringify({
        ...manifest,
        files: [manifest.files[0], manifest.files[0]],
      }),
      'utf8',
    );
    await expect(verifyEvidence(manifestPath)).resolves.toMatchObject({
      ok: false,
      reason: 'INVALID_MANIFEST',
    });

    await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf8');
    await fs.writeFile(path.join(output, 'extra.txt'), 'unexpected', 'utf8');
    await expect(verifyEvidence(manifestPath)).resolves.toMatchObject({
      ok: false,
      reason: 'UNMANIFESTED_OUTPUT',
    });
    await fs.unlink(path.join(output, 'extra.txt'));

    const linkedFile = path.join(output, 'gate-logs', 'gate.json');
    const outside = path.join(tmpDir, 'outside.json');
    await fs.writeFile(outside, '{"ok":true}', 'utf8');
    await fs.unlink(linkedFile);
    await fs.symlink(outside, linkedFile);
    await expect(verifyEvidence(manifestPath)).resolves.toMatchObject({
      ok: false,
      reason: 'UNSAFE_OUTPUT_PATH',
    });
  });

  it('returns stable non-sensitive failure categories for invalid JSON evidence', async () => {
    const project = await createProject();
    const unsafeName = 'token=actual-secret.json';
    await fs.writeFile(path.join(project, '.w-model', 'gate-logs', unsafeName), '{not-json', 'utf8');

    const result = await exportEvidence(project, path.join(tmpDir, 'invalid-json-output'));

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        exitCode: 1,
        reason: 'INVALID_JSON_EVIDENCE',
      }),
    );
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
  it('does not expose absolute project or output paths in successful CLI output', async () => {
    const project = await createProject();
    const output = path.join(tmpDir, 'redacted-cli-output');

    const result = runCli([project, output]);

    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain(project);
    expect(result.stdout).not.toContain(output);
    expect(result.stdout).toContain('<redacted-output>');
  });

  it('uses actual child-process exit codes and EVIDENCE_EXPORT_JSON for success, verification failure, and invalid arguments', async () => {
    const invalidOutput = path.join(tmpDir, 'invalid-output');
    for (const args of [[], ['--unknown-option'], ['--verify']]) {
      const result = runCli(args);
      expect(result.code).toBe(2);
      expect(result.stdout).toContain('ERROR_JSON ');
      expect(result.stdout).not.toContain('EVIDENCE_EXPORT_JSON ');
      await expect(fs.access(invalidOutput)).rejects.toMatchObject({
        code: 'ENOENT',
      });
    }
    const project = await createProject();
    const output = path.join(tmpDir, 'evidence');

    const exported = runCli([project, output]);
    expect(exported.code).toBe(0);
    expect(cliSummary(exported.stdout)).toMatchObject({
      ok: true,
      exitCode: 0,
      mode: 'export',
    });

    await fs.appendFile(path.join(output, 'run-log.jsonl'), 'tampered', 'utf8');
    const invalid = runCli(['--verify', path.join(output, 'evidence-manifest.json')]);
    expect(invalid.code).toBe(1);
    expect(cliSummary(invalid.stdout)).toMatchObject({
      ok: false,
      exitCode: 1,
      mode: 'verify',
    });
    expect(invalid.stdout).toContain('ERROR_JSON ');

    const argumentError = runCli(['--verify']);
    expect(argumentError.code).toBe(2);
    expect(argumentError.stderr).toContain('✗ [ARG_INVALID]');
    expect(argumentError.stdout).toContain('ERROR_JSON ');
  });

  it('redacts values from unknown CLI options in stderr and ERROR_JSON', () => {
    const option = '--unknown-option=D:/private/actual-secret';
    const result = runCli([option]);
    const output = result.stdout + result.stderr;

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('✗ [ARG_INVALID]');
    expect(result.stdout).toContain('ERROR_JSON ');
    expect(output).not.toContain('D:/private');
    expect(output).not.toContain('actual-secret');
    expect(output).not.toContain(option);
  });

  it('真实 CLI 拒绝对（2 态：output-parent symlink 指向 source / verify 越界四态）不污染 source', async () => {
    // 态 1：output parent 是指向 source 的 symlink → UNSAFE_OUTPUT_PATH，且 source 无污染
    const symlinkProject = await createProject();
    const source = path.join(symlinkProject, '.w-model');
    const outputParent = path.join(tmpDir, 'cli-output-parent');
    await fs.symlink(source, outputParent, 'junction');

    const unsafeResult = runCli([symlinkProject, path.join(outputParent, 'evidence')]);

    expect(unsafeResult.code, 'output-parent symlink: 应 exit 1').toBe(1);
    expect(cliSummary(unsafeResult.stdout), 'output-parent symlink: 应报 UNSAFE_OUTPUT_PATH').toMatchObject({
      ok: false,
      exitCode: 1,
      reason: 'UNSAFE_OUTPUT_PATH',
    });
    expect(unsafeResult.stdout, 'output-parent symlink: 应含 ERROR_JSON').toContain('ERROR_JSON ');
    await expect(
      fs.access(path.join(source, 'evidence')),
      'output-parent symlink: source 不被污染',
    ).rejects.toMatchObject({ code: 'ENOENT' });

    // 态 2：verify 边界四态（traversal / duplicate / unmanifested extra / evidence symlink）
    const project = await createProject();
    const output = path.join(tmpDir, 'cli-verify-boundaries');
    expect(runCli([project, output]).code).toBe(0);
    const manifestPath = path.join(output, 'evidence-manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as {
      files: Array<Record<string, unknown>>;
    } & Record<string, unknown>;

    const mutationCases = [
      {
        caseName: 'verify 路径越界 ../escape.json',
        write: async (): Promise<void> => {
          await fs.writeFile(
            manifestPath,
            JSON.stringify({
              ...manifest,
              files: [{ ...manifest.files[0], path: '../escape.json' }],
            }),
            'utf8',
          );
        },
        cleanup: async (): Promise<void> => {},
      },
      {
        caseName: 'verify 重复路径',
        write: async (): Promise<void> => {
          await fs.writeFile(
            manifestPath,
            JSON.stringify({
              ...manifest,
              files: [manifest.files[0], manifest.files[0]],
            }),
            'utf8',
          );
        },
        cleanup: async (): Promise<void> => {},
      },
      {
        caseName: 'verify 未登记输出文件',
        write: async (): Promise<void> => {
          await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf8');
          await fs.writeFile(path.join(output, 'extra.txt'), 'extra', 'utf8');
        },
        cleanup: async (): Promise<void> => {
          await fs.unlink(path.join(output, 'extra.txt'));
        },
      },
      {
        caseName: 'verify evidence 为 symlink',
        write: async (): Promise<void> => {
          await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf8');
          const evidence = path.join(output, 'gate-logs', 'gate.json');
          const outside = path.join(tmpDir, 'outside-cli.json');
          await fs.writeFile(outside, '{"safe":true}', 'utf8');
          await fs.unlink(evidence);
          await fs.symlink(outside, evidence);
        },
        cleanup: async (): Promise<void> => {},
      },
    ];
    for (const { caseName, write, cleanup } of mutationCases) {
      await write();
      const result = runCli(['--verify', manifestPath]);
      expect(result.code, `${caseName}: 应 exit 1`).toBe(1);
      expect(result.stdout, `${caseName}: 应含 ERROR_JSON`).toContain('ERROR_JSON ');
      await cleanup();
    }
  });

  it('emits safe structured CLI errors for invalid JSON and output safety failures', async () => {
    const project = await createProject();
    const secretName = 'token=actual-secret.json';
    await fs.writeFile(path.join(project, '.w-model', 'gate-logs', secretName), '{invalid', 'utf8');

    const invalidJson = runCli([project, path.join(tmpDir, 'bad-json')]);
    expect(invalidJson.code).toBe(1);
    expect(cliSummary(invalidJson.stdout)).toMatchObject({
      ok: false,
      exitCode: 1,
      reason: 'INVALID_JSON_EVIDENCE',
    });
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

describe('A9 脱敏敏感 key 规范化变体匹配（批次 6 销账）', () => {
  it('A9：db_password_hash / api_key_v2 等变体键值被脱敏', () => {
    const redacted = redact({
      db_password_hash: 'secret',
      api_key_v2: 'tok',
      notes: 'path D:\\x',
      nested: { db_password_hash: 'nested-secret' },
    }) as Record<string, unknown>;
    expect(redacted['db_password_hash']).toBe('[REDACTED]');
    expect(redacted['api_key_v2']).toBe('[REDACTED]');
    expect(redacted['notes']).toBe('path <redacted-absolute-path>');
    expect(redacted['nested']).toEqual({ db_password_hash: '[REDACTED]' });
  });
  it('A9：普通键不被误脱敏（retentionPolicy / path / durationMs / tokens）', () => {
    // I4 起 `passwordPolicy` 因驼峰切分被保守脱敏（见决策4g），本行改用同为 camelCase 但与
    // 敏感词干无关的中性键 `retentionPolicy`，继续锁定「驼峰切分不得误伤中性键」。
    const redacted = redact({
      retentionPolicy: 'ok',
      path: 'D:\\x\\y',
      durationMs: 5,
      tokens: 1000,
    }) as Record<string, unknown>;
    expect(redacted['retentionPolicy']).toBe('ok');
    expect(redacted['durationMs']).toBe(5);
    // run-log 既有键 tokens 不得被误伤（词段精确相等 `tokens` ≠ `token`；后缀分支 ≥6 守卫亦不触发——决策 2026-10-07#4 口径）。
    expect(redacted['tokens']).toBe(1000);
    // path 键名不触发脱敏；值内绝对路径仍按既有路径规则替换。
    expect(redacted['path']).toBe('<redacted-absolute-path>');
  });
  it('A9：恰为名单词干全串的键仍被脱敏（精确匹配是变体匹配的子集）', () => {
    const redacted = redact({
      apikey: 'a',
      credential: 'b',
      token: 'c',
    }) as Record<string, unknown>;
    expect(redacted['apikey']).toBe('[REDACTED]');
    expect(redacted['credential']).toBe('[REDACTED]');
    expect(redacted['token']).toBe('[REDACTED]');
  });
});

describe('决策4：*_token 变体盲区消除 + 防复生（批次 7）', () => {
  it('决策4a：refresh_token/session_token/jwt_token 全部脱敏', () => {
    const redacted = redact({
      refresh_token: 'rt-secret',
      session_token: 'st-secret',
      jwt_token: 'jwt-secret',
      nested: { refresh_token: 'nested-rt-secret' },
    }) as Record<string, unknown>;
    expect(redacted['refresh_token']).toBe('[REDACTED]');
    expect(redacted['session_token']).toBe('[REDACTED]');
    expect(redacted['jwt_token']).toBe('[REDACTED]');
    expect(redacted['nested']).toEqual({ refresh_token: '[REDACTED]' });
  });
  it('决策4b：token_count 被保守脱敏（显式声明代价）', () => {
    // 决策 #4 显式接受的保守代价：词段 token 精确命中使 token_count 类计数键被脱敏，
    // 已登记 samples/NEGATIVE-COVERAGE.md 的 wm-export-evidence 行（防复生锚）。
    // 代价边界：复数词段 `tokens` ≠ 词干 `token`（精确相等），与既有 tokens 负例同判保留。
    const redacted = redact({ token_count: 42, prompt_tokens: 7 }) as Record<string, unknown>;
    expect(redacted['token_count']).toBe('[REDACTED]');
    expect(redacted['prompt_tokens']).toBe(7);
  });
  it('决策4c：path/durationMs/tokens/retentionPolicy 仍零误伤（既有负例保持）', () => {
    const redacted = redact({
      path: 'D:\\x\\y',
      durationMs: 5,
      tokens: 1000,
      retentionPolicy: 'keep-30d',
    }) as Record<string, unknown>;
    expect(redacted['durationMs']).toBe(5);
    expect(redacted['tokens']).toBe(1000);
    expect(redacted['retentionPolicy']).toBe('keep-30d');
    expect(redacted['path']).toBe('<redacted-absolute-path>');
  });
  it('决策4d：mytoken（无分隔后缀）不脱敏（后缀分支 ≥6 守卫保留）', () => {
    const redacted = redact({ mytoken: 'not-a-secret', mypassword: 'also-kept' }) as Record<string, unknown>;
    expect(redacted['mypassword']).toBe('[REDACTED]');
    expect(redacted['mytoken']).toBe('not-a-secret');
  });

  // ==================== I4（终审修复波）：camelCase 家族盲区消除（决策 #4 点名变体） ====================
  it('决策4e：reviewer 实测的 camelCase 家族全脱敏（I4 前整键明文导出）', () => {
    const keys = [
      'refreshToken',
      'sessionToken',
      'jwtToken',
      'authToken',
      'bearerToken',
      'idToken',
      'apiToken',
      'oAuthToken',
      'secretKey',
      'apiKey',
    ] as const;
    const input: Record<string, unknown> = {};
    for (const k of keys) input[k] = 'plaintext-secret';
    input['nested'] = { refreshToken: 'nested-plaintext', oAuthToken: 'nested-oauth' };
    const redacted = redact(input) as Record<string, unknown>;
    for (const k of keys) {
      expect(redacted[k], `${k} 应脱敏（I4 前为明文——决策 #4「不切驼峰」口径撤销）`).toBe('[REDACTED]');
    }
    // 递归脱敏对驼峰键同样生效
    expect(redacted['nested']).toEqual({ refreshToken: '[REDACTED]', oAuthToken: '[REDACTED]' });
  });
  it('决策4f：驼峰切分不引入新误伤（mytoken/tokens/prompt_tokens/durationMs/中性驼峰）', () => {
    const redacted = redact({
      mytoken: 'a',
      tokens: 1,
      prompt_tokens: 2,
      durationMs: 3,
      retentionPolicy: 'b',
    }) as Record<string, unknown>;
    expect(redacted['mytoken']).toBe('a');
    expect(redacted['tokens']).toBe(1);
    expect(redacted['prompt_tokens']).toBe(2);
    expect(redacted['durationMs']).toBe(3);
    expect(redacted['retentionPolicy']).toBe('b');
  });
  it('决策4g：passwordPolicy 类「敏感词干+非敏感词尾」驼峰键被保守脱敏（I4 显式代价）', () => {
    // 与决策 4b 的 token_count 同属显式接受的保守代价：任何能命中 secretKey 的驼峰规则
    // （前段命中）结构上必然命中 passwordPolicy——两者形状同构，不可分离。
    const redacted = redact({ passwordPolicy: 'strict', passwordTtlDays: 90 }) as Record<string, unknown>;
    expect(redacted['passwordPolicy']).toBe('[REDACTED]');
    expect(redacted['passwordTtlDays']).toBe('[REDACTED]');
  });
});
