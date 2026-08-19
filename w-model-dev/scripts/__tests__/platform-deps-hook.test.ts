import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

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
    const result = await execFileAsync('bash', ['-c', 'source "$BASH_ENV"; export -f git node npm tar 2>/dev/null || true; script="$1"; shift; bash "$script" "$@"', '--', script, ...args], {
      cwd,
      env: { ...process.env, ...environment },
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error: unknown) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failure.code ?? 1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
  }
}

async function simulatedEnsure(args: string[], nodeBody: string): Promise<{ code: number; stdout: string; stderr: string; calls: string }> {
  const binDir = await makeTempDir('platform-deps-bin-');
  const workspace = await makeTempDir('platform-deps-workspace-');
  const callsPath = path.join(binDir, 'calls.log');
  await fs.writeFile(path.join(workspace, '.git'), 'gitdir: irrelevant\n', 'utf8');
  const bashEnv = path.join(binDir, 'bash-env.sh');
  await fs.writeFile(bashEnv, `
git() { printf '%s\\n' "$PWD"; }
node() {
${nodeBody}
}
npm() { printf 'npm %s\\n' "$*" >> "$CALLS"; exit 99; }
tar() { printf 'tar %s\\n' "$*" >> "$CALLS"; exit 99; }
`, 'utf8');
  const result = await run(ensureScript, args, {
    PATH: `${binDir}:${process.env.PATH}`,
    CALLS: callsPath,
    BASH_ENV: bashEnv,
  }, workspace);
  return {
    ...result,
    calls: await fs.readFile(callsPath, 'utf8').catch(() => ''),
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('ensure-platform-deps supply-chain boundary', () => {
  it('defaults to check mode and reports the explicit install command without package download or extraction', async () => {
    const result = await simulatedEnsure([], `
case "$*" in
  *process.platform*) printf 'linux\\n' ;;
  *process.arch*) printf 'x64\\n' ;;
  *esbuild/package.json*) printf '0.25.0\\n' ;;
  *rolldown/package.json*) printf '1.0.0\\n' ;;
  *) printf '\\n' ;;
esac`);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('npm run platform-deps:install');
    expect(result.calls).toBe('');
  });

  it('treats --check as a probe and fails closed when either primary package is missing', async () => {
    const result = await simulatedEnsure(['--check'], `
case "$*" in
  *process.platform*) printf 'linux\\n' ;;
  *process.arch*) printf 'x64\\n' ;;
  *esbuild/package.json*) printf '0.25.0\\n' ;;
  *rolldown/package.json*) printf '\\n' ;;
  *) printf '\\n' ;;
esac`);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('esbuild / rolldown 主包缺失');
    expect(result.calls).toBe('');
  });

  it('fails closed for an uncovered platform without package download or extraction', async () => {
    const result = await simulatedEnsure(['--check'], `
case "$*" in
  *process.platform*) printf 'darwin\\n' ;;
  *process.arch*) printf 'arm64\\n' ;;
  *) printf '\\n' ;;
esac`);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('未覆盖平台 darwin-arm64');
    expect(result.calls).toBe('');
  });

  it('rejects an unknown argument with usage error code 2', async () => {
    const result = await simulatedEnsure(['--unsupported'], 'printf "linux\\n"');

    expect(result.code).toBe(2);
    expect(result.calls).toBe('');
  });
});

describe('pre-push dependency boundary and trigger paths', () => {
  it.each(['config/probe.ts', 'scripts/probe.cjs', 'package-lock.json'])('runs the gate for %s', async (changedPath) => {
    const binDir = await makeTempDir('pre-push-bin-');
    const workspace = await makeTempDir('pre-push-workspace-');
    const callsPath = path.join(binDir, 'calls.log');
    await fs.writeFile(path.join(workspace, '.git'), 'gitdir: irrelevant\n', 'utf8');
    const bashEnv = path.join(binDir, 'bash-env.sh');
    await fs.writeFile(bashEnv, `
git() {
  case "$*" in
    *'diff --name-only'*) printf '${changedPath}\\n' ;;
    *) exit 0 ;;
  esac
}
npm() { printf 'npm %s\\n' "$*" >> "$CALLS"; return 98; }
`, 'utf8');
    const result = await run(prePushScript, [], {
      PATH: `${binDir}:${process.env.PATH}`,
      CALLS: callsPath,
      BASH_ENV: bashEnv,
      PREPUSH_FORCE: '0',
      OSTYPE: 'linux-gnu',
    }, workspace);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain('node_modules 缺失');
    expect(result.stdout).toContain('npm install');
    expect(await fs.readFile(callsPath, 'utf8').catch(() => '')).toBe('');
  });

  it('skips the gate when changed paths are unrelated', async () => {
    const binDir = await makeTempDir('pre-push-skip-bin-');
    const workspace = await makeTempDir('pre-push-skip-workspace-');
    await fs.writeFile(path.join(workspace, '.git'), 'gitdir: irrelevant\n', 'utf8');
    const bashEnv = path.join(binDir, 'bash-env.sh');
    await fs.writeFile(bashEnv, `
git() {
  case "$*" in
    *'diff --name-only'*) printf 'eval/probe.json\\n' ;;
    *) exit 0 ;;
  esac
}
`, 'utf8');
    const result = await run(prePushScript, [], {
      PATH: `${binDir}:${process.env.PATH}`,
      BASH_ENV: bashEnv,
      PREPUSH_FORCE: '0',
      OSTYPE: 'linux-gnu',
    }, workspace);

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
    await fs.writeFile(bashEnv, `
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
npm() { printf 'npm %s\\n' "$*" >> "$CALLS"; return 98; }
`, 'utf8');

    const result = await run(prePushScript, ['--force'], {
      BASH_ENV: bashEnv,
      CALLS: callsPath,
      OSTYPE: 'linux-gnu',
    }, workspace);
    const calls = await fs.readFile(callsPath, 'utf8').catch(() => '');

    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(calls, `${result.stdout}\n${result.stderr}`).toContain('npm run self-test');
    expect(calls).not.toMatch(/npm install|npm pack|\btar\b/);
  });

  it('contains no automatic npm installation, package download, or tar extraction commands', async () => {
    const [prePush, ensure] = await Promise.all([
      fs.readFile(prePushScript, 'utf8'),
      fs.readFile(ensureScript, 'utf8'),
    ]);

    expect(prePush).toMatch(/ensure-platform-deps\.sh"? --check/);
    expect(prePush).not.toMatch(/npm[[:space:]]+install/);
    expect(prePush).not.toMatch(/npm[[:space:]]+pack/);
    expect(prePush).not.toMatch(/\btar\b/);
    expect(ensure).not.toMatch(/npm[[:space:]]+pack/);
    expect(ensure).not.toMatch(/\btar\b/);
    expect(ensure).not.toMatch(/rm -rf.*node_modules/);
  });
});

describe('package scripts', () => {
  it('exposes explicit check and install commands', async () => {
    const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as { scripts: Record<string, string> };

    expect(pkg.scripts['platform-deps:check']).toBe('bash .githooks/ensure-platform-deps.sh --check');
    expect(pkg.scripts['platform-deps:install']).toBe('bash .githooks/ensure-platform-deps.sh --install');
  });
});
