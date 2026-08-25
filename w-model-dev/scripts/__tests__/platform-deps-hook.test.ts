import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '../../..');
const ensureScript = path.join(repoRoot, '.githooks', 'ensure-platform-deps.sh');
const prePushScript = path.join(repoRoot, '.githooks', 'pre-push');
const packageJsonPath = path.join(repoRoot, 'package.json');
const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function run(script: string, args: string[], environment: Record<string, string> = {}, cwd = repoRoot) {
  try {
    const result = await execFileAsync(
      'bash',
      [
        '-c',
        'source "$BASH_ENV"; export -f git node npm tar cp rm mv mkdir 2>/dev/null || true; script="$1"; shift; bash "$script" "$@"',
        '--',
        script,
        ...args,
      ],
      {
        cwd,
        env: { ...process.env, ...environment },
      },
    );
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error: unknown) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failure.code ?? 1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
  }
}

async function simulatedEnsure(
  args: string[],
  nodeBody: string,
  cliBody?: string,
): Promise<{ code: number; stdout: string; stderr: string; calls: string; cliCalls: string }> {
  const binDir = await makeTempDir('platform-deps-bin-');
  const workspace = await makeTempDir('platform-deps-workspace-');
  const callsPath = path.join(binDir, 'calls.log');
  const cliCallsPath = path.join(binDir, 'cli-calls.log');
  await fs.writeFile(path.join(workspace, '.git'), 'gitdir: irrelevant\n', 'utf8');
  await fs.writeFile(path.join(workspace, 'package-lock.json'), '{}\n', 'utf8');
  if (cliBody !== undefined) {
    const localBin = path.join(workspace, 'node_modules', '.bin');
    await fs.mkdir(localBin, { recursive: true });
    await fs.mkdir(path.join(workspace, 'w-model-dev', 'scripts', 'cli'), { recursive: true });
    await fs.writeFile(
      path.join(workspace, 'w-model-dev', 'scripts', 'cli', 'platform-deps-install.ts'),
      '// offline fixture CLI entrypoint\n',
      'utf8',
    );
    const cliPath = path.join(localBin, 'tsx');
    await fs.writeFile(cliPath, `#!/usr/bin/env bash\nset -u\n${cliBody}\n`, 'utf8');
    await fs.chmod(cliPath, 0o755);
  }
  const bashEnv = path.join(binDir, 'bash-env.sh');
  await fs.writeFile(
    bashEnv,
    `
git() { printf '%s\\n' "$PWD"; }
node() {
${nodeBody}
}
npm() { printf 'npm %s\\n' "$*" >> "$CALLS"; exit 99; }
tar() { printf 'tar %s\\n' "$*" >> "$CALLS"; exit 99; }
cp() { printf 'cp %s\\n' "$*" >> "$CALLS"; exit 99; }
rm() { printf 'rm %s\\n' "$*" >> "$CALLS"; exit 99; }
mv() { printf 'mv %s\\n' "$*" >> "$CALLS"; exit 99; }
mkdir() { printf 'mkdir %s\\n' "$*" >> "$CALLS"; exit 99; }
`,
    'utf8',
  );
  const result = await run(
    ensureScript,
    args,
    {
      PATH: `${binDir}:${process.env.PATH}`,
      CALLS: callsPath,
      CLI_CALLS: cliCallsPath,
      BASH_ENV: bashEnv,
    },
    workspace,
  );
  return {
    ...result,
    calls: await fs.readFile(callsPath, 'utf8').catch(() => ''),
    cliCalls: await fs.readFile(cliCallsPath, 'utf8').catch(() => ''),
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function simulatedPrePushAudit(
  auditCase: 'network' | 'unsupported' | 'network-text' | 'vulnerability' | 'json' | 'permission',
): Promise<{ code: number; stdout: string; stderr: string }> {
  const binDir = await makeTempDir('pre-push-audit-bin-');
  const workspace = await makeTempDir('pre-push-audit-workspace-');
  await fs.writeFile(path.join(workspace, '.git'), 'gitdir: irrelevant\\n', 'utf8');
  await fs.mkdir(path.join(workspace, 'node_modules', '@esbuild', 'linux-x64'), { recursive: true });
  await fs.mkdir(path.join(workspace, 'node_modules', '@rolldown', 'binding-linux-x64-gnu'), { recursive: true });
  const fakeNpx = path.join(binDir, 'npx');
  await fs.writeFile(
    fakeNpx,
    `#!/usr/bin/env bash
for arg in "$@"; do
  case "$arg" in
    --outputFile=*) printf '{"testResults":[],"numTotalTests":0,"numPassedTests":0,"numFailedTests":0,"success":true}' > "\${arg#--outputFile=}" ;;
  esac
done
case "$*" in
  *bad-schema.manifest.json*) exit 2 ;;
esac
exit 0
`,
    'utf8',
  );
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- controlled temporary executable fixture
  await fs.chmod(fakeNpx, 0o755);
  const bashEnv = path.join(binDir, 'bash-env.sh');
  await fs.writeFile(
    bashEnv,
    `
git() { printf '%s\\n' "$PWD"; }
node() {
  case "$*" in
    *process.platform*) printf 'linux\\n' ;;
    *process.arch*) printf 'x64\\n' ;;
    *esbuild/package.json*) printf '0.25.0\\n' ;;
    *rolldown/package.json*) printf '1.0.0\\n' ;;
    *) printf '\\n' ;;
  esac
}
npm() {
  case "$*" in
    'run self-test') return 0 ;;
    'run check:verifier') return 2 ;;
    *'check:verifier -- w-model-dev/scripts/samples/verifier/valid.json'*) return 0 ;;
    *'check:verifier -- w-model-dev/scripts/samples/verifier/bad-ranking-k.json'*) return 1 ;;
    *'run check:gate -- /tmp/nonexistent'*) return 2 ;;
    *'run check:coverage -- '*) return 0 ;;
    *'run check:exemption -- '*) return 0 ;;
    'audit --audit-level=high')
      case "$AUDIT_CASE" in
        network) printf 'npm error code ENOTFOUND\\n'; return 255 ;;
        unsupported) printf 'npm error code ENOTSUP\\n'; return 1 ;;
        network-text) printf 'npm audit report mentions network but is not an npm network error\\n'; return 1 ;;
        vulnerability) printf 'npm audit report: high vulnerability\\n'; return 1 ;;
        json) printf 'npm error Unexpected end of JSON input\\n'; return 1 ;;
        permission) printf 'npm error code EACCES\\n'; return 1 ;;
      esac
      ;;
    'run check:docs-consistency') test -s "$WM_VITEST_COUNT_FILE" || return 97; return 0 ;;
    *) return 97 ;;
  esac
}
`,
    'utf8',
  );
  return run(
    prePushScript,
    ['--force'],
    {
      BASH_ENV: bashEnv,
      PATH: `${binDir}:${process.env.PATH}`,
      AUDIT_CASE: auditCase,
      OSTYPE: 'linux-gnu',
    },
    workspace,
  );
}

describe('ensure-platform-deps supply-chain boundary', () => {
  it('defaults to check mode and reports the explicit install command without package download or extraction', async () => {
    const result = await simulatedEnsure(
      [],
      `
case "$*" in
  *process.platform*) printf 'linux\\n' ;;
  *process.arch*) printf 'x64\\n' ;;
  *esbuild/package.json*) printf '0.25.0\\n' ;;
  *rolldown/package.json*) printf '1.0.0\\n' ;;
  *) printf '\\n' ;;
esac`,
    );

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('npm run platform-deps:install');
    expect(result.calls).toBe('');
  });

  it('treats --check as a probe and fails closed when either primary package is missing', async () => {
    const result = await simulatedEnsure(
      ['--check'],
      `
case "$*" in
  *process.platform*) printf 'linux\\n' ;;
  *process.arch*) printf 'x64\\n' ;;
  *esbuild/package.json*) printf '0.25.0\\n' ;;
  *rolldown/package.json*) printf '\\n' ;;
  *) printf '\\n' ;;
esac`,
    );

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('esbuild / rolldown 主包缺失');
    expect(result.calls).toBe('');
  });

  it('does not invoke the installer, npm, pack, tar, or extraction tools in --check mode', async () => {
    const result = await simulatedEnsure(
      ['--check'],
      `
case "$*" in
  *process.platform*) printf 'linux\\n' ;;
  *process.arch*) printf 'x64\\n' ;;
  *esbuild/package.json*) printf '0.25.0\\n' ;;
  *rolldown/package.json*) printf '1.0.0\\n' ;;
  *) printf '\\n' ;;
esac`,
      `printf '%s\\n' "$*" >> "$CLI_CALLS"; exit 99`,
    );

    expect(result.code).toBe(1);
    expect(result.calls).toBe('');
    expect(result.cliCalls).toBe('');
  });

  it('fails closed for an uncovered platform without package download or extraction', async () => {
    const result = await simulatedEnsure(
      ['--check'],
      `
case "$*" in
  *process.platform*) printf 'darwin\\n' ;;
  *process.arch*) printf 'arm64\\n' ;;
  *) printf '\\n' ;;
esac`,
    );

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('未覆盖平台 darwin-arm64');
    expect(result.calls).toBe('');
  });

  it.each([{ args: ['--unsupported'] }, { args: ['--check', 'unexpected'] }, { args: ['--install', 'unexpected'] }])(
    'rejects unsupported arguments $args with usage error code 2',
    async ({ args }) => {
      const result = await simulatedEnsure(args, 'printf "linux\\n"');

      expect(result.code).toBe(2);
      expect(result.stdout).toContain('用法');
      expect(result.calls).toBe('');
    },
  );

  it('passes the absolute lockfile and every missing package to the local installer, then rechecks', async () => {
    const result = await simulatedEnsure(
      ['--install'],
      `
case "$*" in
  *process.platform*) printf 'linux\\n' ;;
  *process.arch*) printf 'x64\\n' ;;
  *esbuild/package.json*) printf '0.25.0\\n' ;;
  *rolldown/package.json*) printf '1.0.0\\n' ;;
  *) printf '\\n' ;;
esac`,
      `
printf '%s\\n' "$*" >> "$CLI_CALLS"
command mkdir -p "$PWD/node_modules/@esbuild/linux-x64" "$PWD/node_modules/@rolldown/binding-linux-x64-gnu"
exit 0`,
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('平台依赖补装完成');
    expect(result.cliCalls).toContain('--lockfile=');
    expect(result.cliCalls).toContain('--package=@esbuild/linux-x64');
    expect(result.cliCalls).toContain('--package=@rolldown/binding-linux-x64-gnu');
    expect(result.cliCalls).toContain(path.join('package-lock.json'));
    expect(result.calls).toBe('');
  });

  it('fails closed when the explicit local installer succeeds but the recheck still finds a missing package', async () => {
    const result = await simulatedEnsure(
      ['--install'],
      `
case "$*" in
  *process.platform*) printf 'linux\\n' ;;
  *process.arch*) printf 'x64\\n' ;;
  *esbuild/package.json*) printf '0.25.0\\n' ;;
  *rolldown/package.json*) printf '1.0.0\\n' ;;
  *) printf '\\n' ;;
esac`,
      `
printf '%s\\n' "$*" >> "$CLI_CALLS"
exit 0`,
    );

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('补装后仍缺失');
    expect(result.stdout).not.toContain('补装完成');
    expect(result.cliCalls).toContain('--package=@esbuild/linux-x64');
    expect(result.cliCalls).toContain('--package=@rolldown/binding-linux-x64-gnu');
  });

  it('fails closed when the explicit local installer fails and does not claim a recheck passed', async () => {
    const result = await simulatedEnsure(
      ['--install'],
      `
case "$*" in
  *process.platform*) printf 'linux\\n' ;;
  *process.arch*) printf 'x64\\n' ;;
  *esbuild/package.json*) printf '0.25.0\\n' ;;
  *rolldown/package.json*) printf '1.0.0\\n' ;;
  *) printf '\\n' ;;
esac`,
      `
printf '%s\\n' "$*" >> "$CLI_CALLS"
exit 17`,
    );

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('平台依赖补装失败');
    expect(result.stdout).not.toContain('平台依赖补装完成');
    expect(result.cliCalls).toContain('--package=@esbuild/linux-x64');
    expect(result.cliCalls).toContain('--package=@rolldown/binding-linux-x64-gnu');
    expect(result.calls).toBe('');
  });

  it('returns success for complete dependencies in --install mode without claiming to install anything', async () => {
    const binDir = await makeTempDir('platform-deps-complete-bin-');
    const workspace = await makeTempDir('platform-deps-complete-workspace-');
    const callsPath = path.join(binDir, 'calls.log');
    const bashEnv = path.join(binDir, 'bash-env.sh');
    await fs.writeFile(path.join(workspace, '.git'), 'gitdir: irrelevant\n', 'utf8');
    await fs.mkdir(path.join(workspace, 'node_modules', '@esbuild', 'linux-x64'), { recursive: true });
    await fs.mkdir(path.join(workspace, 'node_modules', '@rolldown', 'binding-linux-x64-gnu'), { recursive: true });
    await fs.writeFile(
      bashEnv,
      `
git() { printf '%s\\n' "$PWD"; }
node() {
  case "$*" in
    *process.platform*) printf 'linux\\n' ;;
    *process.arch*) printf 'x64\\n' ;;
    *esbuild/package.json*) printf '0.25.0\\n' ;;
    *rolldown/package.json*) printf '1.0.0\\n' ;;
    *) printf '\\n' ;;
  esac
}
npm() { printf 'npm %s\\n' "$*" >> "$CALLS"; exit 99; }
tar() { printf 'tar %s\\n' "$*" >> "$CALLS"; exit 99; }
cp() { printf 'cp %s\\n' "$*" >> "$CALLS"; exit 99; }
rm() { printf 'rm %s\\n' "$*" >> "$CALLS"; exit 99; }
mv() { printf 'mv %s\\n' "$*" >> "$CALLS"; exit 99; }
mkdir() { printf 'mkdir %s\\n' "$*" >> "$CALLS"; exit 99; }
`,
      'utf8',
    );

    const result = await run(
      ensureScript,
      ['--install'],
      {
        BASH_ENV: bashEnv,
        CALLS: callsPath,
      },
      workspace,
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('平台依赖齐备');
    expect(result.stdout).not.toContain('补装完成');
    expect(await fs.readFile(callsPath, 'utf8').catch(() => '')).toBe('');
  });
});

describe('pre-push dependency boundary and trigger paths', () => {
  it.each(['config/probe.ts', 'scripts/probe.cjs', 'package-lock.json'])(
    'runs the gate for %s',
    async (changedPath) => {
      const binDir = await makeTempDir('pre-push-bin-');
      const workspace = await makeTempDir('pre-push-workspace-');
      const callsPath = path.join(binDir, 'calls.log');
      await fs.writeFile(path.join(workspace, '.git'), 'gitdir: irrelevant\n', 'utf8');
      const bashEnv = path.join(binDir, 'bash-env.sh');
      await fs.writeFile(
        bashEnv,
        `
git() {
  case "$*" in
    *'diff --name-only'*) printf '${changedPath}\\n' ;;
    *) exit 0 ;;
  esac
}
npm() { printf 'npm %s\\n' "$*" >> "$CALLS"; return 98; }
`,
        'utf8',
      );
      const result = await run(
        prePushScript,
        [],
        {
          PATH: `${binDir}:${process.env.PATH}`,
          CALLS: callsPath,
          BASH_ENV: bashEnv,
          PREPUSH_FORCE: '0',
          OSTYPE: 'linux-gnu',
        },
        workspace,
      );

      expect(result.code).toBe(1);
      expect(result.stdout).toContain('node_modules 缺失');
      expect(result.stdout).toContain('npm install');
      expect(await fs.readFile(callsPath, 'utf8').catch(() => '')).toBe('');
    },
  );

  it('skips the gate when changed paths are unrelated', async () => {
    const binDir = await makeTempDir('pre-push-skip-bin-');
    const workspace = await makeTempDir('pre-push-skip-workspace-');
    await fs.writeFile(path.join(workspace, '.git'), 'gitdir: irrelevant\n', 'utf8');
    const bashEnv = path.join(binDir, 'bash-env.sh');
    await fs.writeFile(
      bashEnv,
      `
git() {
  case "$*" in
    *'diff --name-only'*) printf 'eval/probe.json\\n' ;;
    *) exit 0 ;;
  esac
}
`,
      'utf8',
    );
    const result = await run(
      prePushScript,
      [],
      {
        PATH: `${binDir}:${process.env.PATH}`,
        BASH_ENV: bashEnv,
        PREPUSH_FORCE: '0',
        OSTYPE: 'linux-gnu',
      },
      workspace,
    );

    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('跳过门禁');
  });

  it('executes only a read-only platform check before the ordinary gate commands', async () => {
    const binDir = await makeTempDir('pre-push-execution-bin-');
    const workspace = await makeTempDir('pre-push-execution-workspace-');
    const callsPath = path.join(binDir, 'calls.log');
    const bashEnv = path.join(binDir, 'bash-env.sh');
    await fs.writeFile(path.join(workspace, '.git'), 'gitdir: irrelevant\n', 'utf8');
    await fs.mkdir(path.join(workspace, 'node_modules', '@esbuild', 'linux-x64'), { recursive: true });
    await fs.mkdir(path.join(workspace, 'node_modules', '@rolldown', 'binding-linux-x64-gnu'), { recursive: true });
    await fs.writeFile(
      bashEnv,
      `
git() {
  case "$*" in
    *'diff --name-only'*) printf 'config/probe.ts\\n' ;;
    *) printf '%s\\n' "$PWD" ;;
  esac
}
node() {
  case "$*" in
    *process.platform*) printf 'linux\\n' ;;
    *process.arch*) printf 'x64\\n' ;;
    *esbuild/package.json*) printf '0.25.0\\n' ;;
    *rolldown/package.json*) printf '1.0.0\\n' ;;
    *) printf '\\n' ;;
  esac
}
npm() { printf 'npm %s\\n' "$*" >> "$CALLS"; return 98; }
tar() { printf 'tar %s\\n' "$*" >> "$CALLS"; return 98; }
cp() { printf 'cp %s\\n' "$*" >> "$CALLS"; return 98; }
rm() { printf 'rm %s\\n' "$*" >> "$CALLS"; return 98; }
mv() { printf 'mv %s\\n' "$*" >> "$CALLS"; return 98; }
mkdir() { printf 'mkdir %s\\n' "$*" >> "$CALLS"; return 98; }
`,
      'utf8',
    );

    const result = await run(
      prePushScript,
      [],
      {
        BASH_ENV: bashEnv,
        CALLS: callsPath,
        PREPUSH_FORCE: '0',
        OSTYPE: 'linux-gnu',
      },
      workspace,
    );
    const calls = await fs.readFile(callsPath, 'utf8').catch(() => '');

    expect(result.code, `${result.stdout}\n${result.stderr}`).not.toBe(0);
    expect(result.stdout).toContain('平台依赖齐备（linux-x64）');
    expect(calls, `${result.stdout}\n${result.stderr}`).toContain('npm run self-test');
    expect(calls).not.toMatch(/npm (install|pack)|\btar\b|\bcp\b|\bmv\b|\bmkdir\b|\brm\b.*node_modules/);
  });
});

describe('pre-push audit skip boundary', () => {
  it('invokes ensure-platform-deps only with --check', async () => {
    const source = await fs.readFile(prePushScript, 'utf8');
    const ensureCalls = [...source.matchAll(/ensure-platform-deps\.sh[^\n]*/g)].map((match) => match[0]);

    expect(ensureCalls).toEqual(['ensure-platform-deps.sh" --check; then']);
    expect(source).not.toMatch(/ensure-platform-deps\.sh[^\n]*--install/);
  });

  it.each(['network', 'unsupported'] as const)('skips an explicit %s audit failure', async (auditCase) => {
    const result = await simulatedPrePushAudit(auditCase);

    expect(result.code, `${result.stdout}\\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('跳过（不阻断）');
  });

  it.each(['network-text', 'vulnerability', 'json', 'permission'] as const)(
    'blocks an audit %s failure',
    async (auditCase) => {
      const result = await simulatedPrePushAudit(auditCase);

      expect(result.code).toBe(1);
      expect(result.stdout).not.toContain('跳过（不阻断）');
      expect(result.stdout).toContain('npm audit');
    },
  );
});

describe('pre-push evidence lifecycle', () => {
  it('consumes and removes coverage artifacts from a controlled OS temp directory after docs-consistency', async () => {
    const binDir = await makeTempDir('pre-push-lifecycle-bin-');
    const workspace = await makeTempDir('pre-push-lifecycle-workspace-');
    const tempRoot = await makeTempDir('pre-push-lifecycle-tmp-');
    const callsPath = path.join(binDir, 'calls.log');
    const bashEnv = path.join(binDir, 'bash-env.sh');
    const fakeNpx = path.join(binDir, 'npx');
    await fs.writeFile(path.join(workspace, '.git'), 'gitdir: irrelevant\n', 'utf8');
    await fs.mkdir(path.join(workspace, 'node_modules', '@esbuild', 'linux-x64'), { recursive: true });
    await fs.mkdir(path.join(workspace, 'node_modules', '@rolldown', 'binding-linux-x64-gnu'), { recursive: true });
    await fs.writeFile(
      bashEnv,
      `
git() { printf '%s\\n' "$PWD"; }
node() {
  case "$*" in
    *process.platform*) printf 'linux\\n' ;;
    *process.arch*) printf 'x64\\n' ;;
    *esbuild/package.json*) printf '0.25.0\\n' ;;
    *rolldown/package.json*) printf '1.0.0\\n' ;;
    *) printf '\\n' ;;
  esac
}
npm() {
  case "$*" in
    'run self-test') return 0 ;;
    'run check:verifier') return 2 ;;
    *'check:verifier -- w-model-dev/scripts/samples/verifier/valid.json'*) return 0 ;;
    *'check:verifier -- w-model-dev/scripts/samples/verifier/bad-ranking-k.json'*) return 1 ;;
    *'run check:gate -- /tmp/nonexistent'*) return 2 ;;
    *'run check:coverage -- '*) return 0 ;;
    *'run check:exemption -- '*) return 0 ;;
    'audit --audit-level=high') return 0 ;;
    'run check:docs-consistency')
      test -s "$WM_VITEST_COUNT_FILE" || return 97
      printf 'docs-consumed %s\\n' "$WM_VITEST_COUNT_FILE" >> "$CALLS"
      return 0
      ;;
    'run typecheck') return 0 ;;
    *) return 97 ;;
  esac
}
`,
      'utf8',
    );
    await fs.writeFile(
      fakeNpx,
      `#!/usr/bin/env bash
for arg in "$@"; do
  case "$arg" in
    --outputFile=*) printf '{"testResults":[],"numTotalTests":0,"numPassedTests":0,"numFailedTests":0,"success":true}' > "\${arg#--outputFile=}" ;;
  esac
done
case "$*" in
  *bad-schema.manifest.json*) exit 2 ;;
  prettier*) exit 1 ;;
  *) exit 0 ;;
esac
`,
      'utf8',
    );
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- controlled mkdtemp executable fixture
    await fs.chmod(fakeNpx, 0o755);

    const result = await run(
      prePushScript,
      ['--force'],
      {
        BASH_ENV: bashEnv,
        CALLS: callsPath,
        PATH: `${binDir}:${process.env.PATH}`,
        TMPDIR: tempRoot,
        OSTYPE: 'linux-gnu',
      },
      workspace,
    );

    expect(result.code).toBe(1);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- controlled mkdtemp call log
    expect(await fs.readFile(callsPath, 'utf8')).toContain('docs-consumed ');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- controlled mkdtemp temp root
    expect(await fs.readdir(tempRoot)).toEqual([]);
  });
});

describe('package scripts', () => {
  it('exposes explicit check and install commands', async () => {
    const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as { scripts: Record<string, string> };

    expect(pkg.scripts['platform-deps:check']).toBe('bash .githooks/ensure-platform-deps.sh --check');
    expect(pkg.scripts['platform-deps:install']).toBe('bash .githooks/ensure-platform-deps.sh --install');
  });
});
