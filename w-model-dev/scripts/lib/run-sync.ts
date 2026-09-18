import { spawnSync, type SpawnSyncOptions, type SpawnSyncReturns } from 'node:child_process';

import * as ts from 'typescript';

export const DEFAULT_SYNC_TIMEOUT_MS = 15_000;
export const DEFAULT_SYNC_MAX_BUFFER = 64 * 1024 * 1024;

/** Callers may tune safe execution settings but cannot weaken process termination or output typing. */
export type RunSyncOptions = Omit<SpawnSyncOptions, 'encoding' | 'killSignal'>;

export type DirectSyncApi = 'spawnSync' | 'execSync' | 'execFileSync';
type SyncProcessException = {
  api: DirectSyncApi;
  file: string;
  /**
   * 调用位置锚：该文件内唯一的调用特征子串（默认取调用起始行的 trim 后文本）。
   * 2026-09-18 任务 3.5 取代行号——行号是位置（上方插行即全体漂移），锚是内容寻址。
   * 允许非唯一（同一文件内多条字面相同的调用）时，台账须把每个命中行都各登记一条。
   */
  anchor: string;
  symbol: string;
  reason: string;
  /** Retained audit provenance for a call migrated through the centralized runSync wrapper. */
  migratedToRunSync?: true;
  timeout: {
    required: true;
    status: 'present' | 'missing-followup';
  };
};

/**
 * Full scripts-directory inventory of direct synchronous child-process calls.
 * Direct calls are retained only where B4 scope prohibits migration or where their
 * command-specific implementation already needs a distinct API. Calls migrated to
 * runSync retain their entries as audit provenance instead of being deleted.
 */
export const SYNC_PROCESS_EXCEPTIONS: readonly SyncProcessException[] = [
  {
    api: 'spawnSync',
    file: 'cli/check-docs-consistency.ts',
    anchor: "const diff = runSync('git', ['-c', 'core.quotePath=false', 'diff', '--name-only', 'HEAD'], {",
    symbol: 'detectScriptsChanges',
    reason:
      'B3 migrated git diff probe through runSync; retained as audit provenance with a 15-second timeout. 2026-09-04 archival-fixes: git args 前插 -c core.quotePath=false（与 change-scope.ts I-1 同款，非 ASCII 文件名按字面 UTF-8 收集）。',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-docs-consistency.ts',
    anchor: "const status = runSync('git', ['status', '--porcelain'], { cwd: root, timeout: 15_000 });",
    symbol: 'detectScriptsChanges',
    reason:
      'B3 migrated git status probe through runSync; retained as audit provenance with a 15-second timeout.（行号 2026-09-04 archival-fixes 随 diff 调用多行化下移 3 行）',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-docs-consistency.ts',
    anchor: "const result = runSync('git', ['rev-parse', 'HEAD'], { cwd: root, timeout: 15_000 });",
    symbol: 'currentCommitSha',
    reason:
      'B3 migrated the bounded git HEAD probe through runSync; retained as audit provenance.（行号 2026-09-06 audit-fixes task 5 随 ERROR_JSON detail 脱敏 helper 新增下移 17 行）',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-docs-consistency.ts',
    anchor: 'runSync(process.execPath, [vitestBin, ...vitestArgs], {',
    symbol: 'collectVitestMeasurements',
    reason:
      'B3 migrated direct Node Vitest execution through runSync; retained as audit provenance with its VITEST_SPAWN_TIMEOUT_MS (1800 s) timeout.（行号 2026-09-06 audit-fixes task 9 随 VITEST_SPAWN_TIMEOUT_MS 常量提取下移 7 行；2026-09-14 fileParallelism 抖动处置随该常量注释扩充再下移 2 行，600s→1800s 同步改值）',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-docs-consistency.ts',
    anchor: 'runSync(`npx vitest ${vitestArgs.map((a) => (/[ "&=]/.test(a) ? `"${a}"` : a)).join(\' \')}`, [], {',
    symbol: 'collectVitestMeasurements',
    reason:
      'B3 migrated the shell Vitest fallback through runSync; retained as audit provenance with its VITEST_SPAWN_TIMEOUT_MS (1800 s) timeout.（行号 2026-09-06 audit-fixes task 9 同上顺延；2026-09-14 同上再下移 2 行）',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-tla-model.ts',
    anchor: "const res = runSync('java', ['-version'], {",
    symbol: 'checkEnvironment',
    reason:
      'B3 migrated the Java environment probe through runSync with EXEC_LIMITS.shortTimeoutMs.（行号 2026-09-06 audit-fixes 随 D3 参数解析收紧上移 6 行）',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-tla-model.ts',
    anchor: "const res = runSync('java', ['-version'], {",
    symbol: 'main',
    reason:
      'B3 migrated the preflight Java probe through runSync with EXEC_LIMITS.shortTimeoutMs.（行号 2026-09-06 audit-fixes 随 D3 参数解析收紧下移 7 行）',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/security-scan.ts',
    anchor: 'const r = runSync(',
    symbol: 'main',
    reason: 'B3 migrated ESLint execution through runSync with a 300-second timeout and existing 10 MiB maxBuffer.',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/check-tla-model.ts',
    anchor: "const stdout = execFileSync('java', ['-cp', jarAbs, 'tla2sany.SANY', tlaAbs], {",
    symbol: 'runTools',
    reason:
      'B4 excludes check-tla-model; SANY uses a command-specific bounded timeout and SIGKILL.（行号 2026-09-06 audit-fixes 随 D3 参数解析收紧上移 6 行）',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/check-tla-model.ts',
    anchor: 'const stdout = execFileSync(',
    symbol: 'runTools',
    reason:
      'B4 excludes check-tla-model; TLC uses a command-specific bounded timeout and SIGKILL.（行号 2026-09-06 audit-fixes 随 D3 参数解析收紧上移 6 行）',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/ensure-codegraph-opsx.ts',
    anchor: "execFileSync(name, ['--version'], {",
    symbol: 'checkCli',
    reason:
      'Existing CLI version probe has an explicit 10-second timeout.（行号 2026-09-06 audit-fixes 随 D3 参数解析收紧上移 1 行）',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/ensure-codegraph-opsx.ts',
    anchor: "execFileSync('npm', ['i', '-g', packageName], {",
    symbol: 'installCli',
    reason:
      'Existing npm installation command has an explicit 120-second timeout.（行号 2026-09-06 audit-fixes 随 D3 参数解析收紧上移 1 行）',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/ensure-codegraph-opsx.ts',
    anchor: "execFileSync('codegraph', ['query', 'main'], {",
    symbol: 'checkMcpCodegraph',
    reason:
      'Existing codegraph probe has an explicit 15-second timeout.（行号 2026-09-06 audit-fixes 随 D3 参数解析收紧上移 1 行）',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/ensure-codegraph-opsx.ts',
    anchor: "execFileSync('codegraph', ['install'], {",
    symbol: 'registerMcpCodegraph',
    reason:
      'Existing codegraph registration has an explicit 60-second timeout.（行号 2026-09-06 audit-fixes 随 D3 参数解析收紧上移 1 行）',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/ensure-codegraph-opsx.ts',
    anchor: "execFileSync('codegraph', ['init'], {",
    symbol: 'initCodegraph',
    reason:
      'Existing codegraph initialization has an explicit 300-second timeout.（行号 2026-09-06 audit-fixes 随 D3 参数解析收紧上移 1 行）',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/ensure-codegraph-opsx.ts',
    anchor: "execFileSync('openspec', ['init'], {",
    symbol: 'initOpenspec',
    reason:
      'Existing OpenSpec initialization has an explicit 60-second timeout.（行号 2026-09-06 audit-fixes 随 D3 参数解析收紧上移 1 行）',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execSync',
    file: '__tests__/coverage-logic.test.ts',
    anchor: 'execSync(`npx tsx ${scriptPath} ${coveragePath} --out-of-scope=${oosPath}`, {',
    symbol: 'C7 invalid out-of-scope fixture',
    reason: 'Existing real CLI assertion has an explicit 15-second timeout; brief explicitly preserves it.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execSync',
    file: '__tests__/coverage-logic.test.ts',
    anchor: 'execSync(`npx tsx ${scriptPath} ${coveragePath} --out-of-scope=${oosPath}`, {',
    symbol: 'C7 non-array items fixture',
    reason: 'Existing real CLI assertion has an explicit 15-second timeout; brief explicitly preserves it.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execSync',
    file: '__tests__/coverage-logic.test.ts',
    anchor: 'execSync(`npx tsx ${scriptPath} ${coveragePath} --out-of-scope=${oosPath}`, {',
    symbol: 'C7 valid out-of-scope fixture',
    reason: 'Existing real CLI assertion has an explicit 15-second timeout; brief explicitly preserves it.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    anchor: 'const result = spawnSync(',
    symbol: 'toBashPath wslpath/cygpath probe',
    reason:
      'Convert a Windows path to the running Bash form via wslpath/cygpath when the fixture runs on win32; explicit 15-second timeout.（行号 2026-09-18 任务3-B 计数用例顺延 +2 行）',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    anchor: "const gitInit = spawnSync('git', ['init'], { cwd: fixtureRoot, encoding: 'utf-8', timeout: 15_000 });",
    symbol: 'withDocsConsistencyFixture git init',
    reason:
      'D5 creates a real temporary Git repository so provenance binds to an actual HEAD.（行号 2026-09-06 audit-fixes task 5 随 metrics 探针 rawErrorJson.detail 断言扩展下移 7 行；2026-09-12 code-health archive CLI 登记 +1 行；2026-09-15 p2b S31 随完整性审计双维度用例新增下移 159 行；2026-09-18 任务3-B 计数用例顺延 +2 行）',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    anchor: "spawnSync('git', ['config', '--local', 'user.email', 'fixture@example.invalid'], {",
    symbol: 'withDocsConsistencyFixture git config email',
    reason:
      'D5 configures the isolated fixture Git identity before creating its commit.（行号 2026-09-06 audit-fixes task 5 同上顺延；2026-09-15 p2b S31 同上顺延 +159 行；2026-09-18 任务3-B 计数用例顺延 +2 行）',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    anchor:
      "spawnSync('git', ['config', '--local', 'user.name', 'fixture'], { cwd: fixtureRoot, timeout: 15_000 }).status,",
    symbol: 'withDocsConsistencyFixture git config name',
    reason:
      'D5 configures the isolated fixture Git identity before creating its commit.（行号 2026-09-15 p2b S31 同上顺延 +159 行；2026-09-18 任务3-B 计数用例顺延 +2 行）',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    anchor:
      "spawnSync('git', ['config', '--local', 'commit.gpgSign', 'false'], { cwd: fixtureRoot, timeout: 15_000 }).status,",
    symbol: 'withDocsConsistencyFixture git config gpgSign',
    reason:
      'D5 disables inherited signing for the isolated provenance fixture.（行号 2026-09-15 p2b S31 同上顺延 +159 行；2026-09-18 任务3-B 计数用例顺延 +2 行）',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    anchor:
      "expect(spawnSync('git', ['add', '.provenance-fixture'], { cwd: fixtureRoot, timeout: 15_000 }).status).toBe(0);",
    symbol: 'withDocsConsistencyFixture git add',
    reason:
      'D5 stages the copied fixture before creating its provenance-bound commit.（行号 2026-09-15 p2b S31 同上顺延 +159 行；2026-09-18 任务3-B 计数用例顺延 +2 行）',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    anchor: 'const commit = spawnSync(',
    symbol: 'withDocsConsistencyFixture git commit',
    reason:
      'D5 creates the real fixture HEAD with isolated hooks/signing/editor settings and a bounded timeout.（行号 2026-09-15 p2b S31 同上顺延 +159 行；2026-09-18 任务3-B 计数用例顺延 +2 行）',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    anchor:
      "const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: fixtureRoot, encoding: 'utf-8', timeout: 15_000 });",
    symbol: 'fixtureCommitSha',
    reason:
      'D5 reads the isolated fixture HEAD for same-run provenance assertions.（行号 2026-09-15 p2b S31 同上顺延 +159 行；2026-09-18 任务3-B 计数用例顺延 +2 行）',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    anchor: 'const result = spawnSync(process.execPath, [tsxCli, DOCS_CONSISTENCY_CLI, fixtureRoot, ...args], {',
    symbol: 'runDocsConsistencyCli',
    reason:
      'D5 keeps the real docs-consistency CLI boundary test with an explicit bounded timeout for exit-2 probes.（行号 2026-09-15 p2b S31 同上顺延 +159 行；2026-09-18 任务3-B 计数用例顺延 +2 行）',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/evidence-export-logic.test.ts',
    anchor: 'const result = spawnSync(process.execPath, [tsxCli, SCRIPT, ...args], {',
    symbol: 'runCli',
    reason:
      'D3 requires actual CLI child-process exit-code tests; execution uses the default 15-second process timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/wm-write.test.ts',
    anchor: 'const result = spawnSync(process.execPath, [tsxCli, SCRIPT, ...args], {',
    symbol: 'runArgs',
    reason: 'B4 excludes state/wm-write; real CLI helper uses an explicit 15-second timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execSync',
    file: '__tests__/eval-runner.test.ts',
    anchor: "const stdout = execSync(`npx tsx \"${join(repoRoot, 'eval', 'runner.ts')}\" --self-check`, {",
    symbol: 'eval runner --self-check 退出码 0 断言',
    reason: 'eval/runner.ts --self-check 自检命令，显式 15 秒超时保护。',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execSync',
    file: '__tests__/eval-runner.test.ts',
    anchor: "const stdout = execSync(`npx tsx \"${join(repoRoot, 'eval', 'runner.ts')}\" --self-check`, {",
    symbol: 'eval runner --self-check JSON 可解析断言',
    reason: 'eval/runner.ts --self-check 自检命令，显式 15 秒超时保护。',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execSync',
    file: '__tests__/check-codegraph-queries.test.ts',
    anchor: 'const stdout = execSync(`npx tsx "${CLI}" ${args.join(\' \')}`, {',
    symbol: 'runCli',
    reason:
      '2026-09-04 audit-gate-closure task 1 新增：codegraph checker CLI 边界测试，显式 90 秒超时。（行号 2026-09-06 audit-fixes task 5 随 C12/C13/C10g 新用例下移 42 行）',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execSync',
    file: '__tests__/check-opsx-artifacts.test.ts',
    anchor: 'const stdout = execSync(`npx tsx "${CLI}" ${args.join(\' \')}`, {',
    symbol: 'runCli',
    reason: '2026-09-04 audit-gate-closure task 1 新增：opsx checker CLI 边界测试，显式 90 秒超时。',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execSync',
    file: '__tests__/check-openspec-archive.test.ts',
    anchor: 'const stdout = execSync(`npx tsx "${CLI}" ${args.join(\' \')}`, {',
    symbol: 'runCli',
    reason: '2026-09-04 audit-gate-closure task 1 新增：archive checker CLI 边界测试，显式 90 秒超时。',
    timeout: { required: true, status: 'present' },
  },
  // 2026-09-17 review-remediation task 8：task 5 的两个 hook 测试文件新增了直接同步调用但从未登记
  // （该分支从未跑通全量 vitest，run-sync 审计一直是红的）。以下条目补登记，并给这些调用补显式 15 秒
  // 超时——台账不允许 `missing-followup`（另一条守护要求全部 present）。
  {
    api: 'spawnSync',
    file: '__tests__/platform-deps-hook.test.ts',
    anchor: 'const result = spawnSync(',
    symbol: 'getBashPathTool',
    reason: '探测 wslpath/cygpath 是否可用以决定 Bash 路径转换方式；显式 15 秒超时。',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/platform-deps-hook.test.ts',
    anchor:
      "const result = spawnSync('bash', ['-c', 'printenv PATH'], { encoding: 'utf8', input: '', timeout: 15_000 });",
    symbol: 'getBashRuntimePath',
    reason: '读取 Bash 运行时 PATH 以便把测试注入的 bin 目录前置；显式 15 秒超时。',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/platform-deps-hook.test.ts',
    anchor: "const result = spawnSync('bash', ['-c', command], { encoding: 'utf8', input: '', timeout: 15_000 });",
    symbol: 'convertBashPaths',
    reason: '把 Windows 路径批量转成当前 Bash 可识别形态（跨平台 hook 测试的前置）；显式 15 秒超时。',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/pre-commit-hook.test.ts',
    anchor: 'const result = spawnSync(',
    symbol: 'toBashPath',
    reason: '把 fixture 路径转成当前 Bash 形态（win32 下经 wslpath/cygpath）；显式 15 秒超时。',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/pre-commit-hook.test.ts',
    anchor: "const result = spawnSync('bash', ['-c', 'printenv PATH'], {",
    symbol: 'getBashRuntimePath',
    reason: '读取 Bash 运行时 PATH 以便把 fixture 的 test-bin 前置；显式 15 秒超时。',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/pre-commit-hook.test.ts',
    anchor: "const result = spawnSync('git', args, {",
    symbol: 'runGit',
    reason: '在临时 fixture 仓上执行 git 断言命令（index/worktree 身份校验）；显式超时。',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/pre-commit-hook.test.ts',
    anchor: "const result = spawnSync('git', ['show', spec], {",
    symbol: 'gitShow',
    reason: '读取 staged 内容（git show :path）以断言 index 快照语义；显式超时。',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/pre-commit-hook.test.ts',
    anchor: "return spawnSync('bash', ['-c', command], {",
    symbol: 'runHook',
    reason: '以受控环境变量启动真实 pre-commit hook 子进程（staged-only 语义的主探针）；显式超时。',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/pre-commit-hook.test.ts',
    anchor: "const stagedLink = spawnSync('git', ['ls-files', '--stage', '--', 'link.ts'], {",
    symbol: 'staged symlink probe',
    reason: '用 git ls-files --stage 断言暂存 symlink 记录的 mode/object 未被改写；显式超时。',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/pre-commit-hook.test.ts',
    anchor: "const processProbe = spawnSync('bash', ['-c', 'kill -0 \"$1\"', 'batch-process-probe', batchPid], {",
    symbol: 'batch process liveness probe',
    reason: '超时用例里用 kill -0 断言 batch 后代进程已不可存活；显式 15 秒超时。',
    timeout: { required: true, status: 'present' },
  },
];

export interface SynchronousChildProcessCall {
  api: DirectSyncApi;
  file: string;
  line: number;
}

export interface SynchronousChildProcessAuditViolation {
  file: string;
  line: number;
  message: 'dynamic child_process property access cannot be safely audited';
}

export interface SynchronousChildProcessAudit {
  calls: SynchronousChildProcessCall[];
  violations: SynchronousChildProcessAuditViolation[];
}

const SYNC_APIS = new Set<DirectSyncApi>(['spawnSync', 'execSync', 'execFileSync']);
const CHILD_PROCESS_MODULES = new Set(['node:child_process', 'child_process']);

function isSyncApi(name: string): name is DirectSyncApi {
  return SYNC_APIS.has(name as DirectSyncApi);
}

function isChildProcessModule(moduleSpecifier: ts.Expression): boolean {
  return ts.isStringLiteral(moduleSpecifier) && CHILD_PROCESS_MODULES.has(moduleSpecifier.text);
}

function childProcessPropertyName(expression: ts.ElementAccessExpression): DirectSyncApi | undefined {
  const argument = expression.argumentExpression;
  if (argument === undefined) return undefined;
  if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
    return isSyncApi(argument.text) ? argument.text : undefined;
  }
  return undefined;
}

/**
 * Parses one TypeScript source file and inventories synchronous child_process API calls.
 * Imports, aliases, namespace access, and static element access resolve to stable call
 * records. Non-literal namespace element access is reported rather than ignored.
 */
export function auditSynchronousChildProcessSource(source: string, file: string): SynchronousChildProcessAudit {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const directBindings = new Map<string, DirectSyncApi>();
  const namespaceBindings = new Set<string>();
  const calls: SynchronousChildProcessCall[] = [];
  const violations: SynchronousChildProcessAuditViolation[] = [];

  const addCall = (api: DirectSyncApi, node: ts.Node): void => {
    calls.push({ api, file, line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1 });
  };
  const addDynamicViolation = (node: ts.Node): void => {
    violations.push({
      file,
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
      message: 'dynamic child_process property access cannot be safely audited',
    });
  };

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !isChildProcessModule(statement.moduleSpecifier)) continue;
    const clause = statement.importClause;
    if (clause === undefined || clause.namedBindings === undefined) continue;
    if (ts.isNamespaceImport(clause.namedBindings)) {
      namespaceBindings.add(clause.namedBindings.name.text);
      continue;
    }
    for (const element of clause.namedBindings.elements) {
      const imported = element.propertyName?.text ?? element.name.text;
      if (isSyncApi(imported)) directBindings.set(element.name.text, imported);
    }
  }

  const inspectVariableDeclaration = (node: ts.VariableDeclaration): void => {
    if (!ts.isObjectBindingPattern(node.name) || node.initializer === undefined || !ts.isIdentifier(node.initializer))
      return;
    if (!namespaceBindings.has(node.initializer.text)) return;
    for (const element of node.name.elements) {
      const property = element.propertyName?.getText(sourceFile) ?? element.name.getText(sourceFile);
      if (isSyncApi(property)) directBindings.set(element.name.getText(sourceFile), property);
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node)) inspectVariableDeclaration(node);

    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression)) {
        const api = directBindings.get(expression.text);
        // eslint-disable-next-line security/detect-possible-timing-attacks -- AST symbol classification, not a secret comparison
        if (api !== undefined) addCall(api, node);
      } else if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
        if (namespaceBindings.has(expression.expression.text) && isSyncApi(expression.name.text)) {
          addCall(expression.name.text, node);
        }
      } else if (ts.isElementAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
        if (namespaceBindings.has(expression.expression.text)) {
          const api = childProcessPropertyName(expression);
          // eslint-disable-next-line security/detect-possible-timing-attacks -- AST symbol classification, not a secret comparison
          if (api !== undefined) addCall(api, node);
          else addDynamicViolation(node);
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return { calls, violations };
}

function boundedPositiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Executes a child process synchronously with mandatory process-level bounds.
 * Callers may extend a known long-running timeout but cannot override SIGKILL,
 * UTF-8 output decoding, or the finite positive default fallbacks.
 */
export function runSync(command: string, args: string[], options: RunSyncOptions = {}): SpawnSyncReturns<string> {
  return spawnSync(command, args, {
    ...options,
    timeout: boundedPositiveNumber(options.timeout, DEFAULT_SYNC_TIMEOUT_MS),
    killSignal: 'SIGKILL',
    encoding: 'utf-8',
    maxBuffer: boundedPositiveNumber(options.maxBuffer, DEFAULT_SYNC_MAX_BUFFER),
  }) as SpawnSyncReturns<string>;
}
