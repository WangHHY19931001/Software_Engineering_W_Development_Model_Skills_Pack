/* eslint-disable security/detect-non-literal-fs-filename -- All filesystem paths are generated beneath test-owned temporary roots. */
/** Task 1B tests for the injected FileVerifier, EvidenceStore, RevisionProvider, and command runner. */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import {
  validateCodeHealthCandidate,
  validateCodeHealthEvidence,
  validateCommandEvidence,
  type CandidateSelector,
  type ErrorCode,
  type EvidenceBinding,
  type EvidenceRef,
  type RevisionIdentity,
} from '../logic/code-health-contract.js';
import { createCodeHealthCommandRunner } from '../lib/code-health-command.js';
import { createCodeHealthEvidenceStore } from '../lib/code-health-evidence-store.js';
import { createCodeHealthFileVerifier } from '../lib/code-health-file-verifier.js';
import { createCodeHealthGitRevisionProvider } from '../lib/code-health-revision-provider.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const samplesDir = path.join(repoRoot, 'w-model-dev', 'scripts', 'samples', 'code-health');

const verifier = createCodeHealthFileVerifier();
const gitRevisionProvider = createCodeHealthGitRevisionProvider();
const revisionProvider = gitRevisionProvider;

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'code-health-1b',
  GIT_AUTHOR_EMAIL: 'code-health-1b@example.test',
  GIT_COMMITTER_NAME: 'code-health-1b',
  GIT_COMMITTER_EMAIL: 'code-health-1b@example.test',
};

const createdRoots: string[] = [];

async function tempRoot(prefix = 'code-health-1b-'): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), prefix));
  createdRoots.push(root);
  return root;
}

async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: root, env: GIT_ENV, shell: false, windowsHide: true });
  return stdout;
}

async function createTempGitRoot(): Promise<string> {
  const root = await tempRoot();
  await git(root, ['init', '--quiet']);
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'unused.ts'), 'export const unusedFunction = 1;\n');
  await git(root, ['add', '--all']);
  await git(root, ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'initial']);
  return root;
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function makeSelector(candidateId = 'CHG-P1-20260907-901', files: string[] = ['src/unused.ts']): CandidateSelector {
  return {
    candidateId,
    phase: 'P1',
    action: 'delete-code',
    files,
    symbols: ['unusedFunction'],
    scopeHash: `sha256:${'e'.repeat(64)}`,
  };
}

function makeBinding(selector: CandidateSelector, revision: RevisionIdentity): EvidenceBinding {
  return {
    candidate: selector,
    revision,
    rawOutputPath: '.w-model/code-health/raw/command.log',
    rawOutputSha256: '0'.repeat(64),
  };
}

async function currentRevision(root: string): Promise<RevisionIdentity> {
  const revision = await gitRevisionProvider.current(root);
  expect(revision).not.toBeNull();
  return revision as RevisionIdentity;
}

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true, maxRetries: 3 })));
});

describe('code-health file verifier', () => {
  it('接受 root 下 regular non-symlink 文件并精确校验字节 SHA-256', async () => {
    const root = await tempRoot();
    await fs.mkdir(path.join(root, 'evidence'), { recursive: true });
    const bytes = Buffer.from('evidence-bytes', 'utf8');
    await fs.writeFile(path.join(root, 'evidence', 'raw.log'), bytes);
    const result = await verifier.verifyRegularNonSymlinkFile({
      root,
      relativePath: 'evidence/raw.log',
      expectedSha256: createHash('sha256').update(bytes).digest('hex'),
    });
    expect(result).toMatchObject({ ok: true, code: null, relativePath: 'evidence/raw.log' });
    expect(result.actualSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  });

  it.each([
    ['../outside.log', 'STRUCTURE_INVALID'],
    [path.resolve('outside.log'), 'STRUCTURE_INVALID'],
    ['evidence/missing.log', 'EVIDENCE_INVALID'],
    ['nested/missing.log', 'EVIDENCE_INVALID'],
  ] as ReadonlyArray<readonly [string, ErrorCode]>)('拒绝路径越界或缺失文件：%s', async (relativePath, code) => {
    const root = await tempRoot();
    const result = await verifier.verifyRegularNonSymlinkFile({ root, relativePath, expectedSha256: '0'.repeat(64) });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(code);
    expect(result.reason ?? '').not.toContain(root);
  });

  it('拒绝目录、文件 symlink 和父目录 symlink，且不读取 link 指向内容', async () => {
    const root = await tempRoot();
    const outside = await tempRoot('code-health-1b-outside-');
    const outsideBytes = Buffer.from('outside-secret-bytes', 'utf8');
    await fs.writeFile(path.join(outside, 'secret.txt'), outsideBytes);
    await fs.mkdir(path.join(root, 'evidence', 'dir-target'), { recursive: true });

    const directoryResult = await verifier.verifyRegularNonSymlinkFile({
      root,
      relativePath: 'evidence/dir-target',
      expectedSha256: sha256(''),
    });
    expect(directoryResult.ok).toBe(false);
    expect(directoryResult.code).toBe('EVIDENCE_INVALID');

    await fs.symlink(path.join(outside, 'secret.txt'), path.join(root, 'evidence', 'file-link.txt'), 'file');
    const fileLinkResult = await verifier.verifyRegularNonSymlinkFile({
      root,
      relativePath: 'evidence/file-link.txt',
      expectedSha256: sha256(outsideBytes),
    });
    expect(fileLinkResult.ok).toBe(false);
    expect(fileLinkResult.code).toBe('SECURITY_BLOCKED');
    expect(fileLinkResult.actualSha256).toBeUndefined();

    await fs.symlink(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    const parentLinkResult = await verifier.verifyRegularNonSymlinkFile({
      root,
      relativePath: 'linked/secret.txt',
      expectedSha256: sha256(outsideBytes),
    });
    expect(parentLinkResult.ok).toBe(false);
    expect(parentLinkResult.code).toBe('SECURITY_BLOCKED');
    expect(parentLinkResult.actualSha256).toBeUndefined();

    // A symlink that stays inside the controlled root is still not a regular file.
    await fs.symlink(path.join(root, 'evidence', 'dir-target'), path.join(root, 'inside-link'), 'dir');
    const insideLinkResult = await verifier.verifyRegularNonSymlinkFile({
      root,
      relativePath: 'inside-link',
      expectedSha256: sha256(''),
    });
    expect(insideLinkResult.code).toBe('SECURITY_BLOCKED');
  });

  it.each([
    ['', 'STRUCTURE_INVALID'],
    ['C:\\outside\\raw.log', 'STRUCTURE_INVALID'],
    ['/outside/raw.log', 'STRUCTURE_INVALID'],
    ['evidence\\raw.log', 'STRUCTURE_INVALID'],
    ['evidence//raw.log', 'STRUCTURE_INVALID'],
    ['evidence/./raw.log', 'STRUCTURE_INVALID'],
    ['evidence/../raw.log', 'STRUCTURE_INVALID'],
    ['evidence/raw.log\u0000', 'STRUCTURE_INVALID'],
  ] as ReadonlyArray<readonly [string, ErrorCode]>)(
    '拒绝非法 repository-relative 路径：%s',
    async (relativePath, code) => {
      const root = await tempRoot();
      const result = await verifier.verifyRegularNonSymlinkFile({ root, relativePath, expectedSha256: '0'.repeat(64) });
      expect(result.ok).toBe(false);
      expect(result.code).toBe(code);
    },
  );

  it('拒绝错误 SHA-256、非 64 位 expected hash 和非目录 root', async () => {
    const root = await tempRoot();
    const bytes = Buffer.from('tamper-me', 'utf8');
    await fs.mkdir(path.join(root, 'evidence'), { recursive: true });
    await fs.writeFile(path.join(root, 'evidence', 'raw.log'), bytes);

    const mismatch = await verifier.verifyRegularNonSymlinkFile({
      root,
      relativePath: 'evidence/raw.log',
      expectedSha256: '0'.repeat(64),
    });
    expect(mismatch).toMatchObject({ ok: false, code: 'EVIDENCE_INVALID' });
    expect(mismatch.actualSha256).toBe(sha256(bytes));

    const badExpected = await verifier.verifyRegularNonSymlinkFile({
      root,
      relativePath: 'evidence/raw.log',
      expectedSha256: 'not-a-sha256',
    });
    expect(badExpected).toMatchObject({ ok: false, code: 'STRUCTURE_INVALID' });

    const fileRoot = path.join(root, 'evidence', 'raw.log');
    const badRoot = await verifier.verifyRegularNonSymlinkFile({
      root: fileRoot,
      relativePath: 'raw.log',
      expectedSha256: sha256(bytes),
    });
    expect(badRoot.ok).toBe(false);
    expect(badRoot.code).toBe('STRUCTURE_INVALID');
  });
});

describe('code-health evidence store', () => {
  it('raw output 使用 exclusive create，既有文件和 symlink 均不能覆盖', async () => {
    const root = await tempRoot();
    const selector = makeSelector();
    const store = createCodeHealthEvidenceStore({ repositoryRoot: root, rawOutputRoot: 'evidence' });
    const first = await store.putRawOutput({
      candidateId: selector.candidateId,
      scopeHash: selector.scopeHash,
      relativePath: 'evidence/raw-001.log',
      bytes: Buffer.from('first'),
    });
    await expect(
      store.putRawOutput({
        candidateId: selector.candidateId,
        scopeHash: selector.scopeHash,
        relativePath: first.relativePath,
        bytes: Buffer.from('overwrite'),
      }),
    ).rejects.toMatchObject({ code: 'SECURITY_BLOCKED' });
    expect(await fs.readFile(path.join(root, first.relativePath), 'utf8')).toBe('first');

    const outside = await tempRoot('code-health-1b-outside-');
    await fs.writeFile(path.join(outside, 'target.log'), 'outside-bytes');
    await fs.symlink(path.join(outside, 'target.log'), path.join(root, 'evidence', 'raw-link.log'), 'file');
    await expect(
      store.putRawOutput({
        candidateId: selector.candidateId,
        scopeHash: selector.scopeHash,
        relativePath: 'evidence/raw-link.log',
        bytes: Buffer.from('linked-overwrite'),
      }),
    ).rejects.toMatchObject({ code: 'SECURITY_BLOCKED' });
    expect(await fs.readFile(path.join(outside, 'target.log'), 'utf8')).toBe('outside-bytes');
  });

  it('putRawOutput 拒绝空 candidate、非法 scope hash、越界路径、越权 root 和非字节输入', async () => {
    const root = await tempRoot();
    const selector = makeSelector();
    const store = createCodeHealthEvidenceStore({ repositoryRoot: root, rawOutputRoot: 'evidence' });
    const cases: Array<[Record<string, unknown>, ErrorCode]> = [
      [
        { candidateId: '', scopeHash: selector.scopeHash, relativePath: 'evidence/raw.log', bytes: Buffer.from('x') },
        'ARG_INVALID',
      ],
      [
        {
          candidateId: 'not-a-candidate',
          scopeHash: selector.scopeHash,
          relativePath: 'evidence/raw.log',
          bytes: Buffer.from('x'),
        },
        'ARG_INVALID',
      ],
      [
        {
          candidateId: selector.candidateId,
          scopeHash: 'sha256:short',
          relativePath: 'evidence/raw.log',
          bytes: Buffer.from('x'),
        },
        'ARG_INVALID',
      ],
      [
        {
          candidateId: selector.candidateId,
          scopeHash: selector.scopeHash,
          relativePath: '../outside.log',
          bytes: Buffer.from('x'),
        },
        'STRUCTURE_INVALID',
      ],
      [
        {
          candidateId: selector.candidateId,
          scopeHash: selector.scopeHash,
          relativePath: 'outside/raw.log',
          bytes: Buffer.from('x'),
        },
        'STRUCTURE_INVALID',
      ],
      [
        {
          candidateId: selector.candidateId,
          scopeHash: selector.scopeHash,
          relativePath: 'evidence/raw.log',
          bytes: 'not-bytes',
        },
        'ARG_INVALID',
      ],
    ];
    for (const [input, code] of cases) {
      await expect(store.putRawOutput(input as never)).rejects.toMatchObject({ code });
    }
    expect(await fs.readdir(path.join(root, 'evidence')).catch(() => [])).toEqual([]);
  });

  it('verify 拒绝 candidate mismatch、scope mismatch、raw hash mismatch 和 stale revision', async () => {
    const root = await createTempGitRoot();
    const revision = await currentRevision(root);
    const selector = makeSelector();
    const store = createCodeHealthEvidenceStore({ repositoryRoot: root, rawOutputRoot: 'evidence' });
    const stored = await store.putRawOutput({
      candidateId: selector.candidateId,
      scopeHash: selector.scopeHash,
      relativePath: 'evidence/raw-002.log',
      bytes: Buffer.from('stored-evidence'),
    });
    const ref: EvidenceRef = {
      ...stored,
      revision,
      observation: 'observed',
    };
    const binding: EvidenceBinding = {
      candidate: selector,
      revision,
      rawOutputPath: stored.relativePath,
      rawOutputSha256: stored.sha256,
    };

    await expect(store.verify(ref, binding)).resolves.toMatchObject({ ok: true, code: null });
    await expect(
      store.verify(ref, { ...binding, candidate: { ...selector, candidateId: 'CHG-P1-20260907-999' } }),
    ).rejects.toMatchObject({ code: 'SCOPE_MISMATCH' });
    await expect(
      store.verify(ref, { ...binding, candidate: { ...selector, scopeHash: `sha256:${'f'.repeat(64)}` } }),
    ).rejects.toMatchObject({ code: 'SCOPE_MISMATCH' });
    await expect(store.verify({ ...ref, sha256: '0'.repeat(64) }, binding)).rejects.toMatchObject({
      code: 'EVIDENCE_INVALID',
    });
    await expect(store.verify({ ...ref, relativePath: 'evidence/other.log' }, binding)).rejects.toMatchObject({
      code: 'EVIDENCE_INVALID',
    });
    await expect(
      store.verify({ ...ref, revision: { ...revision, treeSha: 'f'.repeat(40) } }, binding),
    ).rejects.toMatchObject({ code: 'REVISION_MISMATCH' });
    await expect(store.verify({ ...ref, evidenceId: '' }, binding)).rejects.toMatchObject({
      code: 'STRUCTURE_INVALID',
    });
    await expect(store.verify({ ...ref, observation: 'not_run' }, binding)).resolves.toMatchObject({
      ok: true,
      code: null,
    });
    await expect(store.verify({ ...ref, observation: 'unverified' }, binding)).rejects.toMatchObject({
      code: 'EVIDENCE_INVALID',
    });
    await expect(revisionProvider.verify(root, { ...revision, treeSha: 'f'.repeat(40) })).resolves.toMatchObject({
      ok: false,
      code: 'REVISION_MISMATCH',
    });

    // A stored raw output that disappears or is tampered with after the fact must not verify.
    await fs.writeFile(path.join(root, stored.relativePath), 'tampered');
    await expect(store.verify(ref, binding)).rejects.toMatchObject({ code: 'EVIDENCE_INVALID' });
    await fs.rm(path.join(root, stored.relativePath));
    await expect(store.verify(ref, binding)).rejects.toMatchObject({ code: 'EVIDENCE_INVALID' });
  });

  it('真实 Git revision 同时绑定 commit、tree 和 source bundle，不能只接受 HEAD 名称', async () => {
    const root = await createTempGitRoot();
    const actual = await gitRevisionProvider.current(root);
    expect(actual?.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(actual?.treeSha).toMatch(/^[0-9a-f]{40}$/);
    expect(actual?.sourceBundleSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(actual?.commitSha).toBe((await git(root, ['rev-parse', 'HEAD'])).trim());
    expect(actual?.treeSha).toBe((await git(root, ['rev-parse', 'HEAD^{tree}'])).trim());
    expect(actual?.sourceBundleSha256).toBe(sha256(await gitArchiveBytes(root, actual!.commitSha)));

    await expect(revisionProvider.verify(root, actual as RevisionIdentity)).resolves.toMatchObject({
      ok: true,
      code: null,
    });
    await expect(
      revisionProvider.verify(root, { ...(actual as RevisionIdentity), commitSha: 'f'.repeat(40) }),
    ).resolves.toMatchObject({ ok: false, code: 'REVISION_MISMATCH' });
    await expect(
      revisionProvider.verify(root, { ...(actual as RevisionIdentity), sourceBundleSha256: 'f'.repeat(64) }),
    ).resolves.toMatchObject({ ok: false, code: 'REVISION_MISMATCH' });

    const nonGitRoot = await tempRoot('code-health-1b-nongit-');
    await fs.writeFile(path.join(nonGitRoot, 'plain.txt'), 'not a repository');
    await expect(gitRevisionProvider.current(nonGitRoot)).resolves.toBeNull();
    await expect(revisionProvider.verify(nonGitRoot, actual as RevisionIdentity)).resolves.toMatchObject({
      ok: false,
      code: 'REVISION_MISMATCH',
      actual: null,
    });
  });
});

async function gitArchiveBytes(root: string, commitSha: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    execFile(
      'git',
      ['archive', '--format=tar', commitSha],
      { cwd: root, env: GIT_ENV, encoding: 'buffer', shell: false, windowsHide: true, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(Buffer.from(stdout));
      },
    );
  });
}

describe('code-health command runner', () => {
  it('使用显式 repository root 执行命令、独占写入 raw output 并可被 store 回读验证', async () => {
    const root = await createTempGitRoot();
    const revision = await currentRevision(root);
    const selector = makeSelector();
    const store = createCodeHealthEvidenceStore({ repositoryRoot: root, rawOutputRoot: 'evidence' });
    const runner = createCodeHealthCommandRunner({
      repositoryRoot: root,
      rawOutputDir: 'evidence',
      evidenceStore: store,
      revisionProvider,
    });
    const binding = makeBinding(selector, revision);
    const result = await runner.run(process.execPath, ['--version'], {
      cwd: '.',
      env: { NODE_ENV: 'test' },
      timeoutMs: 5000,
      binding,
    });
    expect(result.exitCode).toBe(0);
    expect(result.observation).toBe('observed');
    expect(result.cwd).toBe('.');
    expect(result.environment).toEqual({ NODE_ENV: 'test' });
    expect(result.rawOutputPath.startsWith('evidence/')).toBe(true);
    expect(result.rawOutputPath).not.toContain('..');

    const storedBytes = await fs.readFile(path.join(root, result.rawOutputPath));
    expect(sha256(storedBytes)).toBe(result.rawOutputSha256);
    const ref: EvidenceRef = {
      evidenceId: `${selector.candidateId}-${result.rawOutputPath}`,
      candidateId: selector.candidateId,
      scopeHash: selector.scopeHash,
      relativePath: result.rawOutputPath,
      sha256: result.rawOutputSha256,
      revision,
      observation: result.observation,
    };
    await expect(
      store.verify(ref, {
        candidate: selector,
        revision,
        rawOutputPath: result.rawOutputPath,
        rawOutputSha256: result.rawOutputSha256,
      }),
    ).resolves.toMatchObject({ ok: true, code: null });
  });

  it('保留真实 non-zero exit code 3 和 7，并把敏感 stdout/stderr 脱敏后落盘', async () => {
    const root = await createTempGitRoot();
    const revision = await currentRevision(root);
    const selector = makeSelector('CHG-P1-20260907-902');
    const store = createCodeHealthEvidenceStore({ repositoryRoot: root, rawOutputRoot: 'evidence' });
    const runner = createCodeHealthCommandRunner({
      repositoryRoot: root,
      rawOutputDir: 'evidence',
      evidenceStore: store,
      revisionProvider,
    });
    const binding = makeBinding(selector, revision);
    for (const exitCode of [3, 7]) {
      const result = await runner.run(process.execPath, ['-e', `process.exit(${exitCode})`], {
        cwd: '.',
        env: {},
        timeoutMs: 5000,
        binding,
      });
      expect(result.exitCode).toBe(exitCode);
      expect(result.observation).toBe('observed');
    }
    const secret = await runner.run(
      process.execPath,
      [
        '-e',
        'process.stdout.write(["pass","word"].join("")+"=stdout-secret"); process.stderr.write(["to","ken"].join("")+"=stderr-secret")',
      ],
      { cwd: '.', env: {}, timeoutMs: 5000, binding },
    );
    const rawOutput = await fs.readFile(path.join(root, secret.rawOutputPath), 'utf8');
    expect(rawOutput).not.toContain('stdout-secret');
    expect(rawOutput).not.toContain('stderr-secret');
    expect(rawOutput).toContain('[REDACTED]');
  });

  it('把不可执行命令记为 unavailable、超时记为 not_run，且 exitCode 均为 null 而不是 0/1', async () => {
    const root = await createTempGitRoot();
    const revision = await currentRevision(root);
    const selector = makeSelector('CHG-P1-20260907-903');
    const store = createCodeHealthEvidenceStore({ repositoryRoot: root, rawOutputRoot: 'evidence' });
    const runner = createCodeHealthCommandRunner({
      repositoryRoot: root,
      rawOutputDir: 'evidence',
      evidenceStore: store,
      revisionProvider,
    });
    const binding = makeBinding(selector, revision);
    const unavailable = await runner.run('definitely-not-a-real-code-health-command', [], {
      cwd: '.',
      env: {},
      timeoutMs: 5000,
      binding,
    });
    expect(unavailable.exitCode).toBeNull();
    expect(unavailable.observation).toBe('unavailable');
    const timeout = await runner.run(process.execPath, ['-e', 'setTimeout(() => {}, 1000)'], {
      cwd: '.',
      env: {},
      timeoutMs: 20,
      binding,
    });
    expect(timeout.exitCode).toBeNull();
    expect(timeout.observation).toBe('not_run');
  });

  it('拒绝未审计环境键、敏感 argv、shell 字符串和非法 UTF-8 输出，且不落盘证据', async () => {
    const root = await createTempGitRoot();
    const revision = await currentRevision(root);
    const selector = makeSelector('CHG-P1-20260907-904');
    const store = createCodeHealthEvidenceStore({ repositoryRoot: root, rawOutputRoot: 'evidence' });
    const runner = createCodeHealthCommandRunner({
      repositoryRoot: root,
      rawOutputDir: 'evidence',
      evidenceStore: store,
      revisionProvider,
    });
    const binding = makeBinding(selector, revision);
    await expect(
      runner.run(process.execPath, ['--version'], {
        cwd: '.',
        env: { CODE_HEALTH_UNAUDITED: 'x' },
        timeoutMs: 5000,
        binding,
      }),
    ).rejects.toMatchObject({ code: 'SECURITY_BLOCKED' });
    await expect(
      runner.run(process.execPath, ['-e', 'console.log("ok")'], {
        cwd: '.',
        env: { NODE_ENV: 'token=must-not-run' },
        timeoutMs: 5000,
        binding,
      }),
    ).rejects.toMatchObject({ code: 'SECURITY_BLOCKED' });
    await expect(
      runner.run(process.execPath, ['-e', 'console.log("password=super-secret")'], {
        cwd: '.',
        env: {},
        timeoutMs: 5000,
        binding,
      }),
    ).rejects.toMatchObject({ code: 'SECURITY_BLOCKED' });
    await expect(
      runner.run('node -e "process.exit(0)"', [], { cwd: '.', env: {}, timeoutMs: 5000, binding }),
    ).rejects.toThrow(/argv/);
    await expect(
      runner.run(process.execPath, ['-e', 'process.stdout.write(Buffer.from([0xff]))'], {
        cwd: '.',
        env: {},
        timeoutMs: 5000,
        binding,
      }),
    ).rejects.toMatchObject({ code: 'SECURITY_BLOCKED' });
    expect(await fs.readdir(path.join(root, 'evidence')).catch(() => [])).toEqual([]);
  });

  it('拒绝 cwd 越界、raw output 目录 symlink 越界和 stale revision binding', async () => {
    const root = await createTempGitRoot();
    const outside = await tempRoot('code-health-1b-outside-');
    const revision = await currentRevision(root);
    const selector = makeSelector('CHG-P1-20260907-905');
    const store = createCodeHealthEvidenceStore({ repositoryRoot: root, rawOutputRoot: 'evidence' });
    const runner = createCodeHealthCommandRunner({
      repositoryRoot: root,
      rawOutputDir: 'evidence',
      evidenceStore: store,
      revisionProvider,
    });
    await expect(
      runner.run(process.execPath, ['--version'], {
        cwd: outside,
        env: {},
        timeoutMs: 5000,
        binding: makeBinding(selector, revision),
      }),
    ).rejects.toMatchObject({ code: 'ARG_INVALID' });
    await expect(
      runner.run(process.execPath, ['--version'], {
        cwd: '.',
        env: {},
        timeoutMs: 5000,
        binding: makeBinding(selector, { ...revision, commitSha: 'f'.repeat(40) }),
      }),
    ).rejects.toMatchObject({ code: 'REVISION_MISMATCH' });

    await fs.symlink(outside, path.join(root, 'linked-output'), process.platform === 'win32' ? 'junction' : 'dir');
    const linkedRunner = createCodeHealthCommandRunner({
      repositoryRoot: root,
      rawOutputDir: 'linked-output',
      evidenceStore: createCodeHealthEvidenceStore({ repositoryRoot: root, rawOutputRoot: 'linked-output' }),
      revisionProvider,
    });
    await expect(
      linkedRunner.run(process.execPath, ['-e', 'process.stdout.write("must-not-write")'], {
        cwd: '.',
        env: {},
        timeoutMs: 5000,
        binding: makeBinding(selector, revision),
      }),
    ).rejects.toThrow(/symlink|controlled|repository/i);
    expect(await fs.readdir(outside)).toEqual([]);
    expect(await fs.readdir(path.join(root, 'evidence')).catch(() => [])).toEqual([]);
  });

  it('runtime 拒绝 endedAt < startedAt（draft-07 无法跨字段比较）而 schema 无跨字段约束', async () => {
    const root = await createTempGitRoot();
    const revision = await currentRevision(root);
    const selector = makeSelector('CHG-P1-20260907-906');
    const store = createCodeHealthEvidenceStore({ repositoryRoot: root, rawOutputRoot: 'evidence' });
    const times = [new Date('2026-09-07T00:00:10.000Z'), new Date('2026-09-07T00:00:01.000Z')];
    const runner = createCodeHealthCommandRunner({
      repositoryRoot: root,
      rawOutputDir: 'evidence',
      evidenceStore: store,
      revisionProvider,
      now: () => times.shift() ?? new Date('2026-09-07T00:00:01.000Z'),
    });
    const command = await runner.run(process.execPath, ['--version'], {
      cwd: '.',
      env: {},
      timeoutMs: 5000,
      binding: makeBinding(selector, revision),
    });
    expect(Date.parse(command.endedAt)).toBeLessThan(Date.parse(command.startedAt));
    const runtimeReasons: string[] = [];
    validateCommandEvidence(command, 'command', runtimeReasons);
    expect(runtimeReasons.join('; ')).toMatch(/timestamp/i);
  });
});

describe('code-health runtime/schema parity residuals', () => {
  async function loadSample(file: string): Promise<Record<string, unknown>> {
    return JSON.parse(await fs.readFile(path.join(samplesDir, file), 'utf8')) as Record<string, unknown>;
  }

  it('evidence runtime validator 与 schema 同步拒绝敏感 environment 键', async () => {
    const evidence = await loadSample('valid-evidence.json');
    expect(validateCodeHealthEvidence(evidence)).toEqual([]);
    expect(validateBySchema('code-health-evidence', evidence).valid).toBe(true);

    const topLevelSecret = {
      ...evidence,
      environment: { ...(evidence.environment as Record<string, string>), API_TOKEN: 'x' },
    };
    expect(validateCodeHealthEvidence(topLevelSecret)).toEqual(
      expect.arrayContaining([expect.stringMatching(/environment/i)]),
    );
    expect(validateBySchema('code-health-evidence', topLevelSecret).valid).toBe(false);

    const commands = evidence.commands as Array<Record<string, unknown>>;
    const commandSecret = {
      ...evidence,
      commands: [
        { ...commands[0], environment: { ...(commands[0]!.environment as Record<string, string>), GITHUB_TOKEN: 'x' } },
      ],
    };
    expect(validateCodeHealthEvidence(commandSecret)).toEqual(
      expect.arrayContaining([expect.stringMatching(/commands\[0\]\.environment/i)]),
    );
    expect(validateBySchema('code-health-evidence', commandSecret).valid).toBe(false);

    const sensitiveValue = {
      ...evidence,
      commands: [{ ...commands[0], environment: { NODE_ENV: 'password=leaked-value' } }],
    };
    expect(validateCodeHealthEvidence(sensitiveValue)).toEqual(
      expect.arrayContaining([expect.stringMatching(/commands\[0\]\.environment/i)]),
    );
  });

  it('candidate commands environment schema 与 runtime 同步拒绝敏感键，且 runtime 保留跨字段时间校验', async () => {
    const candidate = await loadSample('valid-candidate.json');
    expect(validateBySchema('code-health-candidate', candidate).valid).toBe(true);
    expect(validateCodeHealthCandidate(candidate)).toEqual([]);

    const commands = candidate.commands as Array<Record<string, unknown>>;
    const secretEnvironment = {
      ...candidate,
      commands: [
        { ...commands[0], environment: { ...(commands[0]!.environment as Record<string, string>), AUTH_TOKEN: 'x' } },
      ],
    };
    expect(validateBySchema('code-health-candidate', secretEnvironment).valid).toBe(false);
    expect(validateCodeHealthCandidate(secretEnvironment)).toEqual(
      expect.arrayContaining([expect.stringMatching(/environment/i)]),
    );

    const reversedTimes = {
      ...candidate,
      commands: [{ ...commands[0], startedAt: '2026-09-07T00:00:05.000Z', endedAt: '2026-09-07T00:00:01.000Z' }],
    };
    expect(validateBySchema('code-health-candidate', reversedTimes).valid).toBe(true);
    expect(validateCodeHealthCandidate(reversedTimes)).toEqual(
      expect.arrayContaining([expect.stringMatching(/timestamp/i)]),
    );
  });
});
