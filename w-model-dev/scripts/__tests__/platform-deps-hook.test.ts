/* eslint-disable security/detect-non-literal-fs-filename -- 本文件在 os.tmpdir() 下自建临时仓与 hook fixture（mktemp/join 自生成路径），路径非外部输入；与 exit2-failure-atomicity.test.ts 同款豁免 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const ensureScript = path.join(repoRoot, '.githooks', 'ensure-platform-deps.sh');
const prePushScript = path.join(repoRoot, '.githooks', 'pre-push');
const packageJsonPath = path.join(repoRoot, 'package.json');
const tempDirs: string[] = [];

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

let bashPathTool: 'wslpath' | 'cygpath' | null | undefined;
let bashRuntimePath: string | undefined;

function getBashPathTool(): 'wslpath' | 'cygpath' | undefined {
  if (bashPathTool !== undefined) return bashPathTool ?? undefined;
  const result = spawnSync(
    'bash',
    [
      '-c',
      'if command -v wslpath >/dev/null 2>&1; then printf wslpath; elif command -v cygpath >/dev/null 2>&1; then printf cygpath; fi',
    ],
    { encoding: 'utf8', input: '', timeout: 15_000 },
  );
  const tool = String(result.stdout ?? '').trim();
  bashPathTool = tool === 'wslpath' || tool === 'cygpath' ? tool : null;
  return bashPathTool ?? undefined;
}

function getBashRuntimePath(): string {
  if (bashRuntimePath !== undefined) return bashRuntimePath;
  const result = spawnSync('bash', ['-c', 'printenv PATH'], { encoding: 'utf8', input: '', timeout: 15_000 });
  bashRuntimePath = String(result.stdout ?? '').trim();
  return bashRuntimePath;
}

function convertBashPaths(values: string[]): string[] {
  const normalized = values.map((value) => value.replaceAll('\\', '/'));
  if (process.platform !== 'win32') return normalized;
  const windowsPaths = normalized.filter((value) => /^([A-Za-z]):\//.test(value));
  if (windowsPaths.length === 0) return normalized;
  const tool = getBashPathTool();
  if (tool === undefined) return normalized;
  const command = normalized
    .map((value) =>
      /^([A-Za-z]):\//.test(value) ? `${tool} -a -u ${shellQuote(value)}` : `printf '%s\\n' ${shellQuote(value)}`,
    )
    .join('; ');
  const result = spawnSync('bash', ['-c', command], { encoding: 'utf8', input: '', timeout: 15_000 });
  const converted = String(result.stdout ?? '')
    .replace(/\r?\n$/, '')
    .split(/\r?\n/);
  return result.status === 0 && converted.length === normalized.length ? converted : normalized;
}

function toBashPath(value: string): string {
  return convertBashPaths([value])[0] ?? value;
}

function toBashPathList(value: string): string {
  if (process.platform !== 'win32') return value;
  return convertBashPaths(value.split(path.delimiter).filter(Boolean)).join(':');
}

function prependBashPath(binDir: string): string {
  return [toBashPath(binDir), getBashRuntimePath(), toBashPathList(process.env.PATH ?? '')].filter(Boolean).join(':');
}

function bashEnvironment(environment: Record<string, string>): NodeJS.ProcessEnv {
  // 这些值只用于 Bash 内部的显式 export；Windows spawn 必须继续使用宿主原生 PATH。
  const env = { ...environment };
  if (env.PATH !== undefined) env.PATH = toBashPathList(env.PATH);
  for (const key of ['BASH_ENV', 'CALLS', 'CLI_CALLS', 'WM_PREPUSH_CAPTURE', 'WM_PREPUSH_ARTIFACT_DIR']) {
    // eslint-disable-next-line security/detect-object-injection -- key 来自本行字面量数组，env 是本函数内新建的环境副本
    const value = env[key];
    // eslint-disable-next-line security/detect-object-injection -- 同上：key 为字面量白名单项
    if (value !== undefined && /^[A-Za-z]:[\\/]/.test(value)) env[key] = toBashPath(value);
  }
  return env;
}

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function removeTempDir(dir: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}

/**
 * 运行被测 bash 脚本。stdin 缺省时不提供内容——但必须显式关闭子进程 stdin：
 * execFile 的 input 选项对 execFile 无效（子进程 stdin 是永不关闭的管道），
 * hook 一旦读取 stdin 即永久阻塞；spawn + stdin.end() 保证无内容时立即 EOF。
 * stdin 有内容时写入后关闭（模拟 git pre-push 写入 ref 行后关闭管道）。
 */
async function run(
  script: string,
  args: string[],
  environment: Record<string, string> = {},
  cwd = repoRoot,
  stdin?: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const convertedEnvironment = bashEnvironment(environment);
    const bashEnv = convertedEnvironment.BASH_ENV;
    const exportedEnvironment = Object.entries(environment).map(([key, value]) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`invalid test environment key: ${key}`);
      // eslint-disable-next-line security/detect-object-injection -- key 已由上一行正则白名单校验（合法环境变量名），convertedEnvironment 为本函数内的环境副本
      return `export ${key}=${shellQuote(convertedEnvironment[key] ?? value)}`;
    });
    const command = [
      ...exportedEnvironment,
      `cd ${shellQuote(toBashPath(cwd))}`,
      bashEnv === undefined ? ':' : `source ${shellQuote(bashEnv)}`,
      'export -f git node npm tar cp rm mv mkdir 2>/dev/null || true',
      `bash ${shellQuote(toBashPath(script))}${args.length === 0 ? '' : ` ${args.map(shellQuote).join(' ')}`}`,
    ].join('; ');
    const childEnvironment: NodeJS.ProcessEnv = { ...process.env };
    const child = spawn('bash', ['-c', command], {
      cwd,
      env: childEnvironment,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => (stdout += chunk));
    child.stderr.on('data', (chunk: string) => (stderr += chunk));
    child.on('error', (error: NodeJS.ErrnoException) => {
      resolve({ code: typeof error.code === 'number' ? error.code : 1, stdout, stderr });
    });
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
    if (stdin !== undefined) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
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
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- workspace is a test-owned mkdtemp fixture
  await fs.writeFile(path.join(workspace, '.git'), 'gitdir: irrelevant\n', 'utf8');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- workspace is a test-owned mkdtemp fixture
  await fs.writeFile(path.join(workspace, 'package-lock.json'), '{}\n', 'utf8');
  if (cliBody !== undefined) {
    const localBin = path.join(workspace, 'node_modules', '.bin');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- localBin is beneath the test-owned workspace
    await fs.mkdir(localBin, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture CLI path is beneath the test-owned workspace
    await fs.mkdir(path.join(workspace, 'w-model-dev', 'scripts', 'cli'), { recursive: true });
    await fs.writeFile(
      path.join(workspace, 'w-model-dev', 'scripts', 'cli', 'platform-deps-install.ts'),
      '// offline fixture CLI entrypoint\n',
      'utf8',
    );
    const cliPath = path.join(localBin, 'tsx');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- cliPath is beneath the test-owned workspace
    await fs.writeFile(cliPath, `#!/usr/bin/env bash\nset -u\n${cliBody}\n`, 'utf8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- cliPath is beneath the test-owned workspace
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
      PATH: prependBashPath(binDir),
      CALLS: callsPath,
      CLI_CALLS: cliCallsPath,
      BASH_ENV: bashEnv,
    },
    workspace,
  );
  return {
    ...result,
    calls: await fs.readFile(callsPath, 'utf8').catch(() => ''),
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- cliCallsPath is beneath the test-owned command fixture
    cliCalls: await fs.readFile(cliCallsPath, 'utf8').catch(() => ''),
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(removeTempDir));
});

type SimulatedAuditCase =
  | 'network'
  | 'unsupported'
  | 'network-text'
  | 'networking'
  | 'endpoint'
  | 'mixed-error'
  | 'vulnerability'
  | 'json'
  | 'permission'
  | 'socket-hangup'
  | 'http-503'
  | 'errno-network'
  | 'e5xx-code'
  // review2-fixes task 5：audit skip 边界表驱动样例（H2 / H3 / H4 + 防回归守卫）
  | 'zero-vulns'
  | 'vulns-high-moderate'
  | 'enotfound-plus-network'
  | 'etimedout'
  | 'errno-econnreset'
  | 'plain-socket-hangup'
  | 'e429'
  | 'network-request-failed'
  | 'npm7-warn-audit-network'
  | 'e404-registry-advisories'
  | 'bare-e404'
  | 'status-word-unanchored'
  | 'request-failed-503'
  | 'registry-502-bad-gateway'
  | 'vulns-with-5xx'
  | 'eacces'
  | 'ejsonparse'
  | 'permission-denied'
  // audit-fixes task 7（F-G5-01）：blocking 语料扩为 vulnerab[a-z]* 的样例
  | 'npm-warn-vulnerable'
  | 'vulnerable-mixed-5xx';

async function simulatedPrePushAudit(auditCase: SimulatedAuditCase): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  const binDir = await makeTempDir('pre-push-audit-bin-');
  const workspace = await makeTempDir('pre-push-audit-workspace-');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- workspace is a test-owned mkdtemp fixture
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
        networking) printf 'npm error networking failure text\\n'; return 1 ;;
        endpoint) printf 'npm error audit endpoint returned an error\\n'; return 1 ;;
        mixed-error)
          printf 'npm error code ENOTFOUND\\nnpm error code EACCES\\nnpm audit high vulnerability\\n'
          return 255
          ;;
        vulnerability) printf 'npm audit report: high vulnerability\\n'; return 1 ;;
        json) printf 'npm error Unexpected end of JSON input\\n'; return 1 ;;
        permission) printf 'npm error code EACCES\\n'; return 1 ;;
        socket-hangup)
          printf 'npm error request to https://registry.npmjs.org/-/npm/v1/security/advisories/bulk failed, reason: socket hang up\\n'
          return 1
          ;;
        http-503)
          printf 'npm error 503 Service Unavailable - GET https://registry.npmjs.org/-/npm/v1/security/advisories/bulk\\n'
          return 1
          ;;
        errno-network)
          printf 'npm error errno ENOTFOUND\\nnpm error syscall getaddrinfo\\nnpm error request to https://registry.npmjs.org/x failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org\\n'
          return 1
          ;;
        e5xx-code) printf 'npm error code E503\\n'; return 1 ;;
        zero-vulns) printf 'found 0 vulnerabilities\\n'; return 1 ;;
        vulns-high-moderate) printf '3 vulnerabilities (1 high 2 moderate)\\n'; return 1 ;;
        enotfound-plus-network) printf 'npm error code ENOTFOUND\\nnpm error network request failed\\n'; return 1 ;;
        etimedout) printf 'npm error code ETIMEDOUT\\n'; return 1 ;;
        errno-econnreset) printf 'npm error errno ECONNRESET\\n'; return 1 ;;
        plain-socket-hangup) printf 'npm error socket hang up\\n'; return 1 ;;
        e429) printf 'npm error code E429\\n'; return 1 ;;
        network-request-failed) printf 'npm error network request failed\\n'; return 1 ;;
        npm7-warn-audit-network) printf 'npm warn audit network request failed\\n'; return 1 ;;
        e404-registry-advisories) printf 'npm error 404 Not Found - GET https://registry.npmjs.org/-/npm/v1/security/advisories\\n'; return 1 ;;
        bare-e404) printf 'npm error code E404\\n'; return 1 ;;
        status-word-unanchored) printf 'npm error Service Unavailable (503)\\n'; return 1 ;;
        request-failed-503) printf 'npm error request failed: 503 Service Unavailable\\n'; return 1 ;;
        registry-502-bad-gateway) printf 'npm error registry request failed: 502 Bad Gateway\\n'; return 1 ;;
        vulns-with-5xx) printf 'found 2 vulnerabilities\\nnpm error 503 Service Unavailable\\n'; return 1 ;;
        eacces) printf 'npm error code EACCES\\n'; return 1 ;;
        ejsonparse) printf 'npm error code EJSONPARSE\\n'; return 1 ;;
        permission-denied) printf 'permission denied\\n'; return 1 ;;
        npm-warn-vulnerable) printf 'npm warn vulnerable packages found\\n'; return 1 ;;
        vulnerable-mixed-5xx)
          printf 'npm error 503 Service Unavailable\\nfound 27 vulnerable packages\\n'
          return 1
          ;;
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
      PATH: prependBashPath(binDir),
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
          PATH: prependBashPath(binDir),
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
    *'diff --name-only'*) printf 'misc/probe.json\\n' ;;
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
        PATH: prependBashPath(binDir),
        BASH_ENV: bashEnv,
        PREPUSH_FORCE: '0',
        OSTYPE: 'linux-gnu',
      },
      workspace,
    );

    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('跳过门禁');
  });

  // F-G5-03/04（audit-fixes task 7）：路径过滤包含口径防回归。bash case 的 * 可跨 /，
  // docs/*.md 命中 docs/ 任意层级的 *.md（含 docs/changes、docs/superpowers 深层，
  // 历史触发语义见 files_need_gate 注释，不做收窄）；根级清单文件、.githooks/**、
  // 深层 w-model-dev/** 命中；eval/** 触发（评估资产是活体门禁第 18 项的触发面）；
  // docs 非 .md 不触发。
  it.each([
    { changedPath: 'docs/changes/2026-09-06.md', expectGate: true },
    { changedPath: 'docs/superpowers/deep/sub.md', expectGate: true },
    { changedPath: '.githooks/pre-push', expectGate: true },
    { changedPath: 'w-model-dev/scripts/a/b/c.ts', expectGate: true },
    { changedPath: 'README.md', expectGate: true },
    { changedPath: 'package.json', expectGate: true },
    { changedPath: 'eval/x.json', expectGate: true },
    { changedPath: 'docs/notes.txt', expectGate: false },
  ])('path filter: $changedPath → $expectGate', async ({ changedPath, expectGate }) => {
    const binDir = await makeTempDir('pre-push-pathfilter-bin-');
    const workspace = await makeTempDir('pre-push-pathfilter-workspace-');
    const callsPath = path.join(binDir, 'calls.log');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- workspace is a test-owned mkdtemp fixture
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
        PATH: prependBashPath(binDir),
        CALLS: callsPath,
        BASH_ENV: bashEnv,
        PREPUSH_FORCE: '0',
        OSTYPE: 'linux-gnu',
      },
      workspace,
    );

    if (expectGate) {
      expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
      expect(result.stdout).toContain('node_modules 缺失');
      expect(result.stdout, `${changedPath}: 应触发门禁，不得跳过`).not.toContain('跳过门禁');
    } else {
      expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(result.stdout, `${changedPath}: 不在触发面，应跳过门禁`).toContain('跳过门禁');
    }
  });

  // F-G5-05（audit-fixes task 7）：quotePath flag 源级断言。git mock 按参数子串分派，
  // flag 丢失不会被任何行为断言发现，故直接对 hook 源码断言（源级模式参照 audit skip
  // describe 内 ensure-platform-deps --check 断言）。真实调用形态为 `git -c
  // core.quotePath=false diff|log`（flag 前插于 git 之后）：:148 log -m 排除集枚举
  // 1 处；:212/:221 stdin ref 行 diff 各 1 处；:252 fallback 双 diff（|| 两侧各 1 处，
  // 同一语句行）——合计 4 条语句 5 处调用，与 docs-consistency-logic.test.ts H1 守卫
  // 「5 个 git log/diff 调用点」口径一致；:121 注释含同形示例，须先剥离注释行。
  it('quotePath=false 覆盖全部 git diff/log 变更枚举调用（4 条语句 5 处）', () => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- prePushScript is a fixed repository test asset
    const src = readFileSync(prePushScript, 'utf8');
    const code = src
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');
    expect(code.match(/git -c core\.quotePath=false (diff|log)/g)).toHaveLength(5);
    expect(code.match(/git -c core\.quotePath=false diff/g)).toHaveLength(4);
    expect(code.match(/git -c core\.quotePath=false log/g)).toHaveLength(1);
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
    expect(result.stdout, `${result.stdout}\n${result.stderr}`).toContain('平台依赖齐备（linux-x64）');
    expect(calls, `${result.stdout}\n${result.stderr}`).toContain('npm run self-test');
    expect(calls).not.toMatch(/npm (install|pack)|\btar\b|\bcp\b|\bmv\b|\bmkdir\b|\brm\b.*node_modules/);
  });
});

describe('pre-push stdin ref scope filtering', () => {
  // 40 位假 sha（互不包含、不与 ZERO 冲突）。git() mock 以参数子串分派行为。
  const ZERO = '0'.repeat(40);
  const LOCAL_UNRELATED = 'a'.repeat(40);
  const REMOTE_UNRELATED = '1'.repeat(40);
  const LOCAL_RELATED = 'b'.repeat(40);
  const REMOTE_RELATED = '2'.repeat(40);
  const LOCAL_NEW_BRANCH = 'c'.repeat(40);
  const MERGE_BASE = '3'.repeat(40);
  const REMOTE_DELETED = '4'.repeat(40);

  // mock git 骨架：fallback（HEAD@{push}/origin/HEAD）默认空输出；merge-base / log /
  // diff 行为由各用例 gitBody 覆盖。缺省：无匹配 → exit 0（无输出）。
  // 注：ZERO 入参的 diff（旧实现处理删除行时会以全零 sha 调 git diff）→ 模拟 bad object。
  const gitBody = (lines: string[]): string => [`case "$*" in`, ...lines, `*) exit 0 ;;`, `esac`].join('\n');

  const fallbackEmpty = `*'HEAD@{push}'*|*'origin/HEAD'*) : ;;`;
  const fallbackUnrelated = `*'HEAD@{push}'*|*'origin/HEAD'*) printf 'misc/probe.json\\n' ;;`;
  const fallbackFail = `*'HEAD@{push}'*|*'origin/HEAD'*) exit 1 ;;`;
  const logEmpty = `*'log -m --name-only'*) : ;;`;
  const mergeBaseOk = `*'merge-base'*) printf '${MERGE_BASE}\\n' ;;`;
  const mergeBaseFail = `*'merge-base'*) exit 1 ;;`;
  const zeroDiffBadObject = `*'${ZERO}'*) exit 128 ;;`;
  // A6 remote-tracking 排除集模拟（remote 名 = pre-push hook 第一个参数 origin）
  // git log 必须带 -m（merge commit 默认空 diff，-m 对每个父输出清单——防 merge 冲突
  // 解决产物在排除集中静默漏检）；mock 以 'log -m --name-only' 形态分派。
  const remoteGetUrlOk = `*'remote get-url origin'*) printf 'git@example.com:repo.git\\n' ;;`;
  const remoteGetUrlFail = `*'remote get-url origin'*) exit 1 ;;`;
  const trackingRefsPresent = `*'for-each-ref refs/remotes/origin'*) printf 'refs/remotes/origin/main\\n' ;;`;
  const trackingRefsNone = `*'for-each-ref refs/remotes/origin'*) : ;;`;
  // 前导 - remote 名（--push）的 mock 分派：仅当 hook 信任该 remote 走到 get-url /
  // for-each-ref 时才会命中（选项注入面）；白名单拒绝后不得触达这两支。
  const remoteGetUrlDashPush = `*'remote get-url --push'*) printf 'git@example.com:repo.git\\n' ;;`;
  const trackingRefsDashPush = `*'for-each-ref refs/remotes/--push'*) printf 'refs/remotes/--push/main\\n' ;;`;
  const remoteLogRelated = `*'log -m --name-only'*) printf 'w-model-dev/SKILL.md\\n' ;;`;
  const remoteLogUnrelated = `*'log -m --name-only'*) printf 'misc/probe.json\\n' ;;`;

  const workspaceFiles = {
    '.git': 'gitdir: irrelevant\n',
  };

  async function runFilteredPush(opts: {
    gitBody: string;
    stdin?: string;
    env?: Record<string, string>;
    args?: string[];
  }): Promise<{ code: number; stdout: string; stderr: string }> {
    const binDir = await makeTempDir('pre-push-stdin-bin-');
    const workspace = await makeTempDir('pre-push-stdin-workspace-');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- workspace is a test-owned mkdtemp fixture
    await fs.writeFile(path.join(workspace, '.git'), workspaceFiles['.git'], 'utf8');
    const bashEnv = path.join(binDir, 'bash-env.sh');
    await fs.writeFile(
      bashEnv,
      `git() {
${opts.gitBody}
}
npm() { return 98; }
`,
      'utf8',
    );
    return run(
      prePushScript,
      opts.args ?? [],
      {
        PATH: prependBashPath(binDir),
        BASH_ENV: bashEnv,
        PREPUSH_FORCE: '0',
        OSTYPE: 'linux-gnu',
        ...opts.env,
      },
      workspace,
      opts.stdin,
    );
  }

  const gateRan = (result: { code: number; stdout: string; stderr: string }, why: string) => {
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(result.stdout).toContain('node_modules 缺失');
    expect(result.stdout, `${why}: 不应跳过门禁`).not.toContain('跳过门禁');
  };

  it('多 ref 推送：首行不相关 + 第二行相关（w-model-dev/**）→ 门禁运行（不短路）', async () => {
    const stdin =
      `refs/heads/topic-a ${LOCAL_UNRELATED} refs/heads/topic-a ${REMOTE_UNRELATED}\n` +
      `refs/heads/topic-b ${LOCAL_RELATED} refs/heads/topic-b ${REMOTE_RELATED}\n`;
    const result = await runFilteredPush({
      stdin,
      gitBody: gitBody([
        fallbackEmpty,
        `*'${LOCAL_UNRELATED}'*) printf 'misc/probe.json\\n' ;;`,
        `*'${LOCAL_RELATED}'*) printf 'w-model-dev/SKILL.md\\n' ;;`,
      ]),
    });
    gateRan(result, '相关 ref 在第二行仍须触发门禁');
  });

  it('非空 fallback diff 不相关 + stdin 含相关 ref → 以 stdin 为准，门禁运行', async () => {
    const stdin = `refs/heads/topic-b ${LOCAL_RELATED} refs/heads/topic-b ${REMOTE_RELATED}\n`;
    const result = await runFilteredPush({
      stdin,
      gitBody: gitBody([
        fallbackUnrelated, // 全局 diff 非空但不相关——旧实现据此跳过 stdin，漏检
        `*'${LOCAL_RELATED}'*) printf 'w-model-dev/SKILL.md\\n' ;;`,
      ]),
    });
    gateRan(result, 'stdin 有 ref 时不得以非空 fallback 短路');
  });

  it('existing update ref（两非零 sha，diff 含相关路径）→ 门禁运行', async () => {
    const stdin = `refs/heads/topic-b ${LOCAL_RELATED} refs/heads/topic-b ${REMOTE_RELATED}\n`;
    const result = await runFilteredPush({
      stdin,
      gitBody: gitBody([fallbackEmpty, `*'${LOCAL_RELATED}'*) printf 'w-model-dev/SKILL.md\\n' ;;`]),
    });
    gateRan(result, 'existing update 且 diff 含相关路径');
  });

  it('new branch 且 merge-base 可建立（diff 含相关路径）→ 门禁运行', async () => {
    const stdin = `refs/heads/new-topic ${LOCAL_NEW_BRANCH} refs/heads/new-topic ${ZERO}\n`;
    const result = await runFilteredPush({
      stdin,
      gitBody: gitBody([
        fallbackEmpty,
        logEmpty, // 旧实现以 git log -n 20 截断——新实现不得调用
        mergeBaseOk,
        `*'${LOCAL_NEW_BRANCH}'*) printf 'w-model-dev/SKILL.md\\n' ;;`,
      ]),
    });
    gateRan(result, 'new branch 经 merge-base 证明基线后命中相关路径');
  });

  it('new branch 且 merge-base 不可建立 → fail-closed 门禁运行（绝不 -n 20 截断放行）', async () => {
    const stdin = `refs/heads/new-topic ${LOCAL_NEW_BRANCH} refs/heads/new-topic ${ZERO}\n`;
    const result = await runFilteredPush({
      stdin,
      gitBody: gitBody([fallbackEmpty, logEmpty, mergeBaseFail]),
    });
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(result.stdout).toContain('fail-closed');
    expect(result.stdout, '不可证明基线不得跳过门禁').not.toContain('跳过门禁');
  });

  it('new branch 且 merge-base 退化为推送尖本身（同名本地 ref）→ 非可证明基线，fail-closed 门禁运行', async () => {
    const stdin = `refs/heads/new-topic ${LOCAL_NEW_BRANCH} refs/heads/new-topic ${ZERO}\n`;
    const result = await runFilteredPush({
      stdin,
      // merge-base 返回 local_sha 本身（实测 fork-point/merge-base 对同名 ref 均如此）
      gitBody: gitBody([fallbackEmpty, logEmpty, `*'merge-base'*) printf '${LOCAL_NEW_BRANCH}\\n' ;;`]),
    });
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(result.stdout).toContain('fail-closed');
    expect(result.stdout, '退化为本尖的 merge-base 不得当作可证明基线').not.toContain('跳过门禁');
  });

  it('new branch + merge-base 退化但 remote-tracking 排除集可用（相关路径）→ 门禁运行（不再 fail-closed）', async () => {
    const stdin = `refs/heads/new-topic ${LOCAL_NEW_BRANCH} refs/heads/new-topic ${ZERO}\n`;
    const result = await runFilteredPush({
      args: ['origin'],
      stdin,
      gitBody: gitBody([fallbackEmpty, mergeBaseFail, remoteGetUrlOk, trackingRefsPresent, remoteLogRelated]),
    });
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(result.stdout).toContain('node_modules 缺失');
    expect(result.stdout, 'remote-tracking 排除集已证明相关变更，不应再报 fail-closed').not.toContain('fail-closed');
    expect(result.stdout, '命中相关路径不得跳过门禁').not.toContain('跳过门禁');
  });

  it('new branch + merge-base 退化但 remote-tracking 排除集可用（纯无关路径）→ 跳过门禁', async () => {
    const stdin = `refs/heads/new-topic ${LOCAL_NEW_BRANCH} refs/heads/new-topic ${ZERO}\n`;
    const result = await runFilteredPush({
      args: ['origin'],
      stdin,
      gitBody: gitBody([fallbackEmpty, mergeBaseFail, remoteGetUrlOk, trackingRefsPresent, remoteLogUnrelated]),
    });
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('跳过门禁');
    expect(result.stdout).not.toContain('fail-closed');
  });

  it('new branch + merge-base 退化 + remote 未配置（get-url 失败）→ fail-closed 门禁运行', async () => {
    const stdin = `refs/heads/new-topic ${LOCAL_NEW_BRANCH} refs/heads/new-topic ${ZERO}\n`;
    const result = await runFilteredPush({
      args: ['origin'],
      stdin,
      gitBody: gitBody([fallbackEmpty, mergeBaseFail, remoteGetUrlFail]),
    });
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(result.stdout).toContain('fail-closed');
    expect(result.stdout, 'remote 不可证明不得跳过门禁').not.toContain('跳过门禁');
  });

  it('new branch + merge-base 退化 + remote 无任何 tracking refs → fail-closed 门禁运行', async () => {
    const stdin = `refs/heads/new-topic ${LOCAL_NEW_BRANCH} refs/heads/new-topic ${ZERO}\n`;
    const result = await runFilteredPush({
      args: ['origin'],
      stdin,
      gitBody: gitBody([fallbackEmpty, mergeBaseFail, remoteGetUrlOk, trackingRefsNone]),
    });
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(result.stdout).toContain('fail-closed');
    expect(result.stdout, '无排除集不得缩小范围跳过门禁').not.toContain('跳过门禁');
  });

  it('new branch + merge-base 退化 + remote 名非法（含空白，防注入）→ fail-closed 门禁运行', async () => {
    const stdin = `refs/heads/new-topic ${LOCAL_NEW_BRANCH} refs/heads/new-topic ${ZERO}\n`;
    const result = await runFilteredPush({
      args: ['bad remote'],
      stdin,
      gitBody: gitBody([fallbackEmpty, mergeBaseFail, remoteGetUrlOk]),
    });
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(result.stdout).toContain('fail-closed');
    expect(result.stdout, '非法 remote 名不得参与排除集').not.toContain('跳过门禁');
  });

  it('new branch + merge-base 退化 + remote 名前导 -（--push，选项注入面）→ fail-closed 门禁运行', async () => {
    // D4 回归防护（review D4）：remote 名以 - 开头会被 git 子命令解析为选项（选项注入面）。
    // mock 完整模拟「若被信任则枚举成功」：get-url 命中、tracking refs 存在、log 输出纯无关
    // 路径——旧白名单（- 在字符类内）会放行并走到「跳过门禁」危险路径；hook 必须在白名单
    // 即拒绝（前导 -），让本用例翻转为 fail-closed 全量门禁才绿。
    const stdin = `refs/heads/new-topic ${LOCAL_NEW_BRANCH} refs/heads/new-topic ${ZERO}\n`;
    const result = await runFilteredPush({
      args: ['--push'],
      stdin,
      gitBody: gitBody([fallbackEmpty, mergeBaseFail, remoteGetUrlDashPush, trackingRefsDashPush, remoteLogUnrelated]),
    });
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(result.stdout).toContain('fail-closed');
    expect(result.stdout, '前导 - 的 remote 名不得参与排除集').not.toContain('跳过门禁');
  });

  it('new branch + merge-base 退化 + remote-tracking log 失败 → fail-closed 门禁运行', async () => {
    const stdin = `refs/heads/new-topic ${LOCAL_NEW_BRANCH} refs/heads/new-topic ${ZERO}\n`;
    const result = await runFilteredPush({
      args: ['origin'],
      stdin,
      gitBody: gitBody([
        fallbackEmpty,
        mergeBaseFail,
        remoteGetUrlOk,
        trackingRefsPresent,
        `*'log -m --name-only'*) exit 128 ;;`,
      ]),
    });
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(result.stdout).toContain('fail-closed');
    expect(result.stdout, '枚举命令失败不得跳过门禁').not.toContain('跳过门禁');
  });

  it('merge 形状枚举：-m 使 merge 父 diff 的文件进入排除集（含受保护路径）→ 门禁运行，不静默跳过', async () => {
    // 回归防护（review Important 1）：排除集枚举必须带 -m——merge commit 默认空 diff，
    // merge 冲突解决引入的受保护路径若不出现在输出中，其余路径全无关时门禁会被静默跳过。
    // mock 以 'log -m --name-only' 形态分派做绊线：hook 若去掉 -m，mock 不命中 → 输出为空
    // → 本用例由「门禁运行」翻转为「跳过」即红。
    const stdin = `refs/heads/new-topic ${LOCAL_NEW_BRANCH} refs/heads/new-topic ${ZERO}\n`;
    const result = await runFilteredPush({
      args: ['origin'],
      stdin,
      gitBody: gitBody([
        fallbackEmpty,
        mergeBaseFail,
        remoteGetUrlOk,
        trackingRefsPresent,
        // -m 输出形态：非 merge 提交路径块 + 空行分隔的 merge 每父 diff 路径块
        `*'log -m --name-only'*) printf 'misc/probe.json\\n\\nw-model-dev/SKILL.md\\n' ;;`,
      ]),
    });
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(result.stdout).toContain('node_modules 缺失');
    expect(result.stdout, 'merge 父 diff 的受保护路径被枚举后不得报 fail-closed').not.toContain('fail-closed');
    expect(result.stdout, 'merge 冲突解决产物含受保护路径时不得跳过门禁').not.toContain('跳过门禁');
  });

  it('delete-only ref（local sha 全零）→ 跳过门禁（exit 0 + 说明）', async () => {
    const stdin = `refs/heads/old-topic ${ZERO} refs/heads/old-topic ${REMOTE_DELETED}\n`;
    const result = await runFilteredPush({
      stdin,
      gitBody: gitBody([fallbackEmpty, zeroDiffBadObject]),
    });
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('删除');
    expect(result.stdout).toContain('跳过门禁');
  });

  it('delete + 相关 update 混合 → 删除行跳过收集、update 行命中 → 门禁运行', async () => {
    const stdin =
      `refs/heads/topic-b ${LOCAL_RELATED} refs/heads/topic-b ${REMOTE_RELATED}\n` +
      `refs/heads/old-topic ${ZERO} refs/heads/old-topic ${REMOTE_DELETED}\n`;
    const result = await runFilteredPush({
      stdin,
      gitBody: gitBody([fallbackEmpty, zeroDiffBadObject, `*'${LOCAL_RELATED}'*) printf 'w-model-dev/SKILL.md\\n' ;;`]),
    });
    gateRan(result, 'delete + update 混合推送');
  });

  it('坏行（字段缺失）→ fail-closed 门禁运行', async () => {
    const stdin = `refs/heads/topic-a ${LOCAL_UNRELATED}\n`;
    const result = await runFilteredPush({
      stdin,
      gitBody: gitBody([fallbackEmpty]),
    });
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(result.stdout).toContain('fail-closed');
  });

  it('非法 sha（非 40 位十六进制）→ fail-closed 门禁运行', async () => {
    const stdin = `refs/heads/topic-a not-a-sha refs/heads/topic-a ${REMOTE_UNRELATED}\n`;
    const result = await runFilteredPush({
      stdin,
      gitBody: gitBody([fallbackEmpty]),
    });
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(result.stdout).toContain('fail-closed');
  });

  it('坏行 + 合法相关行混合 → 不信任部分合法行，fail-closed 门禁运行', async () => {
    const stdin = `garbage-line\n` + `refs/heads/topic-b ${LOCAL_RELATED} refs/heads/topic-b ${REMOTE_RELATED}\n`;
    const result = await runFilteredPush({
      stdin,
      gitBody: gitBody([fallbackEmpty, `*'${LOCAL_RELATED}'*) printf 'w-model-dev/SKILL.md\\n' ;;`]),
    });
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(result.stdout).toContain('fail-closed');
  });

  it('合法行但 git diff 失败（对象缺失）→ fail-closed 门禁运行', async () => {
    const stdin = `refs/heads/topic-a ${LOCAL_UNRELATED} refs/heads/topic-a ${REMOTE_UNRELATED}\n`;
    const result = await runFilteredPush({
      stdin,
      gitBody: gitBody([fallbackEmpty, `*'${LOCAL_UNRELATED}'*) exit 128 ;;`]),
    });
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(result.stdout).toContain('fail-closed');
  });

  it('stdin 为空：fallback diff 含相关路径 → 门禁运行', async () => {
    const result = await runFilteredPush({
      gitBody: gitBody([`*'HEAD@{push}'*|*'origin/HEAD'*) printf 'w-model-dev/SKILL.md\\n' ;;`]),
    });
    gateRan(result, 'stdin 为空时回退 HEAD@{push}/origin/HEAD');
  });

  it('stdin 为空：fallback 全部失败 → fail-closed 门禁运行（空 changed_files 不放行）', async () => {
    const result = await runFilteredPush({
      gitBody: gitBody([fallbackFail]),
    });
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(result.stdout).toContain('fail-closed');
    expect(result.stdout, 'fallback 失败不得跳过门禁').not.toContain('跳过门禁');
  });

  it('stdin 为空：fallback diff 不相关 → 跳过门禁（既有手动语义）', async () => {
    const result = await runFilteredPush({
      gitBody: gitBody([fallbackUnrelated]),
    });
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('跳过门禁');
  });

  it('stdin 为空：fallback diff 成功但输出为空（可证明相对上游无差异）→ exit 0 + 回退放行说明', async () => {
    const result = await runFilteredPush({
      gitBody: gitBody([fallbackEmpty]),
    });
    expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('回退范围判断无待推送变更');
    expect(result.stdout).toContain('跳过门禁');
    expect(result.stdout).not.toContain('fail-closed');
  });

  it('--force 绕过路径过滤直接跑门禁，即使 stdin 是垃圾行', async () => {
    const result = await runFilteredPush({
      args: ['--force'],
      stdin: `garbage-no-sha\n`,
      gitBody: gitBody([fallbackEmpty]),
    });
    gateRan(result, '--force 不读 stdin、不做 ref 语义判断');
  });

  it('PREPUSH_FORCE=1 同样绕过过滤；PREPUSH_FORCE=0 且 stdin 不相关 → 跳过', async () => {
    const forced = await runFilteredPush({
      stdin: `refs/heads/topic-a ${LOCAL_UNRELATED} refs/heads/topic-a ${REMOTE_UNRELATED}\n`,
      env: { PREPUSH_FORCE: '1' },
      gitBody: gitBody([fallbackEmpty]),
    });
    gateRan(forced, 'PREPUSH_FORCE=1 强制跑门禁');

    const skipped = await runFilteredPush({
      stdin: `refs/heads/topic-a ${LOCAL_UNRELATED} refs/heads/topic-a ${REMOTE_UNRELATED}\n`,
      gitBody: gitBody([fallbackEmpty, `*'${LOCAL_UNRELATED}'*) printf 'misc/probe.json\\n' ;;`]),
    });
    expect(skipped.code, `${skipped.stdout}\n${skipped.stderr}`).toBe(0);
    expect(skipped.stdout).toContain('跳过门禁');
  });
});

describe('pre-push audit skip boundary', () => {
  it('invokes ensure-platform-deps only with --check', async () => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- prePushScript is a fixed repository test asset
    const source = await fs.readFile(prePushScript, 'utf8');
    const ensureCalls = [...source.matchAll(/ensure-platform-deps\.sh[^\n]*/g)].map((match) => match[0]);

    expect(ensureCalls).toEqual(['ensure-platform-deps.sh" --check; then']);
    expect(source).not.toMatch(/ensure-platform-deps\.sh[^\n]*--install/);
  });

  it.each(['network', 'unsupported', 'socket-hangup', 'http-503', 'errno-network', 'e5xx-code'] as const)(
    'skips an explicit %s audit failure',
    async (auditCase) => {
      const result = await simulatedPrePushAudit(auditCase);

      expect(result.code, `${result.stdout}\\n${result.stderr}`).toBe(0);
      expect(result.stdout).toContain('跳过（不阻断）');
    },
  );

  it.each(['network-text', 'networking', 'endpoint', 'mixed-error', 'vulnerability', 'json', 'permission'] as const)(
    'blocks an audit %s failure',
    async (auditCase) => {
      const result = await simulatedPrePushAudit(auditCase);

      expect(result.code).toBe(1);
      expect(result.stdout).not.toContain('跳过（不阻断）');
      expect(result.stdout).toContain('npm audit');
    },
  );

  // 20 行表驱动边界样例（review2-fixes task 5 建库 18 行 + audit-fixes task 7
  // F-G5-01 增 2 行）：每行 = 一段假想 npm audit 输出 + 期望
  // can_skip。skip 行与 blocking 行 mock 退出码同为 1——只有 audit_can_skip 的正则判定
  // 决定走「跳过（不阻断）」还是阻断，端到端经 pre-push 全 hook 验证（复用既有 mock 通道）。
  interface AuditBoundaryRow {
    label: string;
    auditCase: SimulatedAuditCase;
    expectSkip: boolean;
  }
  const auditBoundaryRows: AuditBoundaryRow[] = [
    { label: 'found 0 vulnerabilities → blocking', auditCase: 'zero-vulns', expectSkip: false },
    { label: '3 vulnerabilities (1 high 2 moderate) → blocking', auditCase: 'vulns-high-moderate', expectSkip: false },
    {
      label: 'npm error code ENOTFOUND + npm error network line → skip',
      auditCase: 'enotfound-plus-network',
      expectSkip: true,
    },
    { label: 'npm error code ETIMEDOUT → skip', auditCase: 'etimedout', expectSkip: true },
    { label: 'npm error errno ECONNRESET → skip', auditCase: 'errno-econnreset', expectSkip: true },
    { label: 'socket hang up in an npm error line → skip', auditCase: 'plain-socket-hangup', expectSkip: true },
    { label: 'npm error code E429 → skip', auditCase: 'e429', expectSkip: true },
    { label: 'npm error network request failed → skip', auditCase: 'network-request-failed', expectSkip: true },
    // H4：npm7 形态 `npm warn audit network` —— network 词面前允许 audit 前缀
    {
      label: 'npm warn audit network request failed → skip (H4)',
      auditCase: 'npm7-warn-audit-network',
      expectSkip: true,
    },
    // H2：E404 仅在 registry/advisories 上下文跳过
    {
      label: 'npm error 404 Not Found - GET .../security/advisories → skip (H2)',
      auditCase: 'e404-registry-advisories',
      expectSkip: true,
    },
    // H2 保守面：裸 code E404（无 registry/advisories 上下文）保持阻断
    {
      label: 'npm error code E404 without registry/advisories context → blocking',
      auditCase: 'bare-e404',
      expectSkip: false,
    },
    // H3：状态词无 network/registry/request 同行锚定 → 保持阻断
    {
      label: 'Service Unavailable status word, unanchored → blocking (H3)',
      auditCase: 'status-word-unanchored',
      expectSkip: false,
    },
    {
      label: 'npm error request failed: 503 Service Unavailable → skip',
      auditCase: 'request-failed-503',
      expectSkip: true,
    },
    {
      label: 'npm error registry request failed: 502 Bad Gateway → skip',
      auditCase: 'registry-502-bad-gateway',
      expectSkip: true,
    },
    // blocking 优先不变量：漏洞信号在场时永不 skip
    {
      label: 'found 2 vulnerabilities + 503 mixed → blocking (blocking-priority invariant)',
      auditCase: 'vulns-with-5xx',
      expectSkip: false,
    },
    { label: 'npm error code EACCES → blocking', auditCase: 'eacces', expectSkip: false },
    { label: 'npm error code EJSONPARSE → blocking', auditCase: 'ejsonparse', expectSkip: false },
    { label: 'permission denied → blocking', auditCase: 'permission-denied', expectSkip: false },
    // F-G5-01（audit-fixes task 7）：blocking 语料扩为 vulnerab[a-z]*——「vulnerable」
    // 形容词形态（npm 新措辞）必须 blocking。
    {
      label: 'npm warn vulnerable packages found → blocking (F-G5-01)',
      auditCase: 'npm-warn-vulnerable',
      expectSkip: false,
    },
    // F-G5-01 漏报洞端到端钉死：瞬态 5xx 信号在场时，「vulnerable packages」漏洞行
    // 使 blocking 优先成立（改前此混排形态被整单 skip）。
    {
      label: '503 + found 27 vulnerable packages mixed → blocking (F-G5-01 skip-hole)',
      auditCase: 'vulnerable-mixed-5xx',
      expectSkip: false,
    },
  ];

  it.each(auditBoundaryRows)('audit skip boundary: $label', async ({ auditCase, expectSkip }) => {
    const result = await simulatedPrePushAudit(auditCase);

    if (expectSkip) {
      expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(result.stdout).toContain('跳过（不阻断）');
    } else {
      expect(result.code, `${result.stdout}\n${result.stderr}`).toBe(1);
      expect(result.stdout).not.toContain('跳过（不阻断）');
      expect(result.stdout).toContain('npm audit');
    }
  });
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
        PATH: prependBashPath(binDir),
        TMPDIR: tempRoot,
        OSTYPE: 'linux-gnu',
      },
      workspace,
    );

    expect(result.code).toBe(1);
    // 失败来源锚定（2026-09-04 实测 run_expect 失败行真实格式）：该行以
    // `[pre-push] <ANSI 红叉> prettier 格式一致性（--check）（期望 exit 0，实际 1）` 呈现；
    // 唯一失败项是 prettier 格式门禁（fake npx 对其返回 1），断言 exit 1 来自该行而非其他门禁。
    // ANSI 控制码用 `[^\n]*`（同行任意字节）表达，安全扫描 no-control-regex 不豁免 \xNN/\u00NN 转义。
    expect(result.stdout).toMatch(/\[pre-push\] [^\n]*prettier 格式一致性（--check）（期望 exit 0，实际 1）/);
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
