/**
 * 生产 CLI 自然退出契约测试。
 *
 * 静态检查只扫描 w-model-dev/scripts/cli 下的生产入口，不扫描测试工具或 samples fixture；
 * 真实子进程覆盖目标 runner 的代表性 exit 0/1/2 路径。
 */

import { createHash } from 'node:crypto';
import * as fsSync from 'node:fs';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';

import { runSync } from '../lib/run-sync.js';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_ROOT = path.resolve(TEST_DIR, '..');
const CLI_ROOT = path.join(SCRIPTS_ROOT, 'cli');
const METRICS_SCRIPT = path.join(CLI_ROOT, 'metrics-report.ts');
const SECURITY_SCRIPT = path.join(CLI_ROOT, 'security-scan.ts');
const SELF_TEST_SCRIPT = path.join(CLI_ROOT, 'self-test.ts');
const ENSURE_SCRIPT = path.join(CLI_ROOT, 'ensure-codegraph-opsx.ts');
const STATUS_SCRIPT = path.join(CLI_ROOT, 'wm-status.ts');

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

function cliFiles(directory: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- directory is fixed to production CLI root
  return fsSync.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return cliFiles(file);
    return entry.isFile() && entry.name.endsWith('.ts') ? [file] : [];
  });
}

function directProcessExitCalls(source: string, fileName: string): string[] {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const calls: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const callee = node.expression;
      if (callee.name.text === 'exit' && callee.expression.getText(sourceFile) === 'process') {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        calls.push(`${fileName}:${position.line + 1}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return calls;
}

function runScript(script: string, args: string[] = [], options: Parameters<typeof runSync>[2] = {}) {
  return runSync(process.execPath, [tsxCli, script, ...args], options);
}

function envWithPath(directory: string, preload?: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const existingPath = process.env.Path ?? process.env.PATH ?? '';
  if (process.platform === 'win32') {
    delete env.PATH;
    env.Path = `${directory}${path.delimiter}${existingPath}`;
  } else {
    env.PATH = `${directory}${path.delimiter}${existingPath}`;
  }
  if (preload !== undefined) {
    env.NODE_OPTIONS = [env.NODE_OPTIONS, `--require=${preload}`].filter(Boolean).join(' ');
  }
  return env;
}

async function makeEnsureBinary(directory: string, name: string): Promise<string | undefined> {
  if (process.platform !== 'win32') return undefined;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- directory is a test-owned temporary command root
  await fs.copyFile(process.execPath, path.join(directory, `${name}.exe`));
  const shim = path.join(directory, 'ensure-command-shim.cjs');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- shim is beneath the test-owned temporary command root
  await fs.writeFile(
    shim,
    `const fs = require('node:fs');\nconst path = require('node:path');\nconst command = path.basename(process.execPath).toLowerCase().replace('.exe', '');\nif (command !== 'node') {\n  const args = process.argv.slice(1);\n  const action = path.basename(args[0] ?? '').toLowerCase();\n  const checkpoint = process.env.WM_NATURAL_ENSURE_MODE === 'checkpoint' && command === 'codegraph' && action === 'install';\n  if (!checkpoint && action === 'init') fs.mkdirSync(path.join(process.cwd(), command === 'codegraph' ? '.codegraph' : 'openspec'), { recursive: true });\n  process.exit(checkpoint ? 1 : 0);\n}\n`,
    'utf8',
  );
  return shim;
}

async function makeCommand(directory: string, name: string, windowsBody: string, posixBody: string): Promise<void> {
  if (process.platform === 'win32') {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- command fixture is created beneath the test-owned temporary directory
    await fs.writeFile(path.join(directory, `${name}.cmd`), `@echo off\r\n${windowsBody}\r\n`, 'utf8');
    return;
  }
  const file = path.join(directory, name);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- command fixture is created beneath the test-owned temporary directory
  await fs.writeFile(file, `#!/bin/sh\n${posixBody}\n`, 'utf8');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- executable bit is set only on the test-owned command fixture
  await fs.chmod(file, 0o755);
}

async function makeTempDirectory(prefix: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeWModel(directory: string, relativePath: string, content: string): Promise<void> {
  const file = path.join(directory, '.w-model', relativePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- file is built beneath the test-owned temporary project root
  await fs.mkdir(path.dirname(file), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- file is built beneath the test-owned temporary project root
  await fs.writeFile(file, content, 'utf8');
}

const RUN_LOG_JSONL =
  '{"phase":1,"action":"produce","role":"S","outcome":"success","tokens":100,"duration_s":10,"subagentSpawns":1,"gateExitCode":null,"timestamp":"2026-08-05T01:00:00Z"}\n';

// F-G4-14：project.json 读取侧经 project.schema.json 校验——夹具须为 schema 合法形状（全 required 字段）
const PROJECT_JSON =
  '{"id":"natural-exit","name":"Natural Exit","description":"","status":"编码","techStack":{"frontend":[],"backend":[],"database":[],"others":[]},"createdAt":"2026-08-05T00:00:00Z","updatedAt":"2026-08-05T01:00:00Z"}';

async function makeSecurityNpx(directory: string): Promise<void> {
  await makeCommand(directory, 'npx', 'type findings.json\r\nexit /b 0', 'cat findings.json\nexit 0');
}

describe('production CLI static natural-exit contract', () => {
  it('does not allow direct process.exit calls in production CLI entrypoints', async () => {
    const violations: string[] = [];
    for (const file of cliFiles(CLI_ROOT)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- file is discovered only beneath production CLI root
      const source = await fs.readFile(file, 'utf8');
      violations.push(...directProcessExitCalls(source, path.relative(SCRIPTS_ROOT, file).replaceAll(path.sep, '/')));
    }

    expect(violations).toEqual([]);
  });

  it('requires migrated runner targets to assign process.exitCode', async () => {
    for (const file of [METRICS_SCRIPT, ENSURE_SCRIPT, SECURITY_SCRIPT, STATUS_SCRIPT, SELF_TEST_SCRIPT]) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- file is a fixed production CLI target
      const source = await fs.readFile(file, 'utf8');
      expect(source, path.basename(file)).toMatch(/process\.exitCode\s*=/);
    }
  });

  it('documents metrics-report and wm-status as 0/2-only result contracts', async () => {
    for (const file of [METRICS_SCRIPT, STATUS_SCRIPT]) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- file is a fixed production CLI target
      const source = await fs.readFile(file, 'utf8');
      expect(source, path.basename(file)).not.toMatch(/process\.exitCode\s*=\s*1/);
    }
  });
});

describe('production CLI real subprocess exit semantics', () => {
  it('metrics-report has a 0/2 contract: success and input validation failure', async () => {
    const directory = await makeTempDirectory('wm-natural-metrics-');
    await writeWModel(directory, 'run-log.jsonl', RUN_LOG_JSONL);

    const passed = runScript(METRICS_SCRIPT, [directory, '--json']);
    expect(passed.status).toBe(0);
    expect(JSON.parse(passed.stdout ?? '')).toMatchObject({ meta: { recordCount: 1 } });

    const invalid = runScript(METRICS_SCRIPT, [directory, '--phase=99']);
    expect(invalid.status).toBe(2);
    expect(invalid.stdout).toContain('ERROR_JSON');
  });

  it('security-scan preserves exit 0, new-finding exit 1, and input exit 2', async () => {
    const directory = await makeTempDirectory('wm-natural-security-');
    await makeSecurityNpx(directory);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- scanner baseline fixture is beneath the test-owned temporary directory
    await fs.writeFile(
      path.join(directory, '.eslintsecurity-baseline.json'),
      '{"version":2,"algo":"content-line","entries":[]}\n',
      'utf8',
    );
    const env = envWithPath(directory);

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- scanner fixture file is beneath the test-owned temporary directory
    await fs.writeFile(path.join(directory, 'findings.json'), '[]\n', 'utf8');
    const passed = runScript(SECURITY_SCRIPT, [], { cwd: directory, env });
    expect(passed.status).toBe(0);
    expect(passed.stdout).toContain('无新增安全风险');

    const sourceFile = path.join(directory, 'source.ts');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- scanner fixture file is beneath the test-owned temporary directory
    await fs.writeFile(sourceFile, 'eval(input);\n', 'utf8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- scanner fixture file is beneath the test-owned temporary directory
    await fs.writeFile(
      path.join(directory, 'findings.json'),
      JSON.stringify([
        {
          filePath: sourceFile,
          messages: [{ line: 1, column: 1, ruleId: 'security/test', message: 'new finding' }],
        },
      ]) + '\n',
      'utf8',
    );
    const failed = runScript(SECURITY_SCRIPT, [], { cwd: directory, env });
    expect(failed.status).toBe(1);
    expect(failed.stdout).toContain('新增风险详情');

    await fs.rm(path.join(directory, '.eslintsecurity-baseline.json'));
    const invalid = runScript(SECURITY_SCRIPT, [], { cwd: directory, env });
    expect(invalid.status).toBe(2);
    expect(invalid.stdout).toContain('ERROR_JSON');
  });

  it('wm-status has a 0/2 contract: normal status and input validation failure', async () => {
    const directory = await makeTempDirectory('wm-natural-status-');
    await writeWModel(directory, 'project.json', PROJECT_JSON);

    const passed = runScript(STATUS_SCRIPT, [directory, '--json']);
    expect(passed.status).toBe(0);
    expect(JSON.parse(passed.stdout ?? '')).toMatchObject({ status: '编码' });

    await writeWModel(directory, 'project.json', '{bad');
    const invalid = runScript(STATUS_SCRIPT, [directory]);
    expect(invalid.status).toBe(2);
    expect(invalid.stdout).toContain('ERROR_JSON');
  });

  it('ensure-codegraph-opsx preserves exit 0, checkpoint exit 1, and argument exit 2', async () => {
    const directory = await makeTempDirectory('wm-natural-ensure-');
    const binDirectory = path.join(directory, 'bin');
    const projectRoot = path.join(directory, 'project');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- command root is beneath the test-owned temporary directory
    await fs.mkdir(binDirectory, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- project root is beneath the test-owned temporary directory
    await fs.mkdir(projectRoot, { recursive: true });
    let env: NodeJS.ProcessEnv;
    if (process.platform === 'win32') {
      const shim = await makeEnsureBinary(binDirectory, 'codegraph');
      await makeEnsureBinary(binDirectory, 'openspec');
      env = envWithPath(binDirectory, shim);
    } else {
      await makeCommand(
        binDirectory,
        'codegraph',
        'if "%1"=="--version" exit /b 0\r\nif "%1"=="install" exit /b 0\r\nif "%1"=="init" mkdir .codegraph 2>nul\r\nif "%1"=="init" exit /b 0\r\nif "%1"=="query" exit /b 0\r\nexit /b 0',
        'case "$1" in --version|install|query) exit 0;; init) mkdir -p .codegraph; exit 0;; esac\nexit 0',
      );
      await makeCommand(
        binDirectory,
        'openspec',
        'if "%1"=="--version" exit /b 0\r\nif "%1"=="init" mkdir openspec 2>nul\r\nif "%1"=="init" exit /b 0\r\nexit /b 0',
        'case "$1" in --version) exit 0;; init) mkdir -p openspec; exit 0;; esac\nexit 0',
      );
      env = envWithPath(binDirectory);
    }

    const passed = runScript(ENSURE_SCRIPT, ['--phase', '5', '--project-root', projectRoot, '--mode', 'light'], {
      env,
    });
    expect(passed.status, `${passed.stdout}\n${passed.stderr}`).toBe(0);

    await fs.rm(path.join(projectRoot, '.codegraph'), { recursive: true, force: true });
    await fs.rm(path.join(projectRoot, 'openspec'), { recursive: true, force: true });
    if (process.platform === 'win32') {
      env.WM_NATURAL_ENSURE_MODE = 'checkpoint';
    } else {
      await makeCommand(
        binDirectory,
        'codegraph',
        'if "%1"=="--version" exit /b 0\r\nif "%1"=="install" exit /b 1\r\nif "%1"=="query" exit /b 0\r\nexit /b 0',
        'case "$1" in --version|query) exit 0;; install) exit 1;; esac\nexit 0',
      );
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- project fixtures are created beneath the test-owned temporary directory
    await fs.mkdir(path.join(projectRoot, '.codegraph'), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- project fixtures are created beneath the test-owned temporary directory
    await fs.mkdir(path.join(projectRoot, 'openspec'), { recursive: true });
    const checkpoint = runScript(ENSURE_SCRIPT, ['--phase', '5', '--project-root', projectRoot, '--mode', 'full'], {
      env,
    });
    expect(checkpoint.status, `${checkpoint.stdout}\n${checkpoint.stderr}`).toBe(1);

    const invalid = runScript(ENSURE_SCRIPT, ['--phase', '4', '--project-root', projectRoot, '--mode', 'light'], {
      env,
    });
    expect(invalid.status).toBe(2);
    expect(invalid.stdout).toContain('ERROR_JSON');
  });

  it('self-test preserves aggregate failure exit 1 with test-owned samples', async () => {
    const sharedFixture = path.join(SCRIPTS_ROOT, 'samples', 'verifier', 'valid.json');
    const originalHash = createHash('sha256')
      .update(await fs.readFile(sharedFixture))
      .digest('hex');
    const samplesDirectory = await makeTempDirectory('wm-natural-self-test-samples-');
    const sourceSamples = path.join(SCRIPTS_ROOT, 'samples');
    await fs.cp(sourceSamples, samplesDirectory, { recursive: true });
    const fixture = path.join(samplesDirectory, 'verifier', 'valid.json');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture is beneath the test-owned copied samples directory
    const valid = JSON.parse(await fs.readFile(fixture, 'utf8')) as { passed: boolean };
    valid.passed = false;
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture is beneath the test-owned copied samples directory
    await fs.writeFile(fixture, JSON.stringify(valid), 'utf8');

    const env = { ...process.env, WM_SELF_TEST_SAMPLES_DIR: samplesDirectory };
    const result = runScript(SELF_TEST_SCRIPT, [], { env });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('失败');
    expect(result.stdout).toContain('总计');
    expect(
      createHash('sha256')
        .update(await fs.readFile(sharedFixture))
        .digest('hex'),
    ).toBe(originalHash);
  }, 60_000);

  it('self-test preserves its successful aggregate exit 0', () => {
    const result = runScript(SELF_TEST_SCRIPT);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('总计');
  }, 60_000);
});
