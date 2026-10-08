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
    reason: 'B3 migrated git status probe through runSync; retained as audit provenance with a 15-second timeout.',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-docs-consistency.ts',
    anchor: "const result = runSync('git', ['rev-parse', 'HEAD'], { cwd: root, timeout: 15_000 });",
    symbol: 'currentCommitSha',
    reason: 'B3 migrated the bounded git HEAD probe through runSync; retained as audit provenance.',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-docs-consistency.ts',
    anchor: 'runSync(process.execPath, [vitestBin, ...vitestArgs], {',
    symbol: 'collectVitestMeasurements',
    reason:
      'B3 migrated direct Node Vitest execution through runSync; retained as audit provenance with its VITEST_SPAWN_TIMEOUT_MS (3600 s) timeout. 2026-09-14 fileParallelism 抖动处置 600s→1800s 同步改值；2026-09-26 全量套件 --reporter=json 实测墙钟 1962s 超过 1800s，常量再调至 3600s。',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-tla-model.ts',
    anchor: "const res = runSync('java', ['-version'], {",
    symbol: 'checkEnvironment',
    reason: 'B3 migrated the Java environment probe through runSync with EXEC_LIMITS.shortTimeoutMs.',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: 'cli/check-tla-model.ts',
    anchor: "const res = runSync('java', ['-version'], {",
    symbol: 'main',
    reason: 'B3 migrated the preflight Java probe through runSync with EXEC_LIMITS.shortTimeoutMs.',
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
    reason: 'B4 excludes check-tla-model; SANY uses a command-specific bounded timeout and SIGKILL.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execFileSync',
    file: 'cli/check-tla-model.ts',
    anchor: 'const stdout = execFileSync(',
    symbol: 'runTools',
    reason: 'B4 excludes check-tla-model; TLC uses a command-specific bounded timeout and SIGKILL.',
    timeout: { required: true, status: 'present' },
  },
  // 2026-09-21 修复轮 1（评审裁定 2）：`cli/ensure-codegraph.ts` 的两条 execFileSync 台账随受控
  // CLI 派发抽到 `lib/cli-probe.ts` 并改走本模块的 runSync 而摘除——直接同步调用归零即台账归零
  // （runSync 是受控原语：SIGKILL / utf-8 / 有限 timeout 与 maxBuffer 由本模块统一强制）。
  // 2026-09-29 Wave 3 收口门对账回归修复：原三条同锚 migratedToRunSync 台账（C7 invalid /
  // non-array / valid out-of-scope fixture）随批 B 循环内聚合收敛为单条目——3 处字面相同的
  // 调用合并为循环体内单物理调用点（coverage-logic 26→11 例，循环迭代覆盖原三态输入），
  // 「锚命中行数 == 共用条目数」守护要求台账随物理调用点同步收敛。
  {
    api: 'execSync',
    file: '__tests__/coverage-logic.test.ts',
    anchor: 'const r = runSync(process.execPath, [tsxCli, scriptPath, coveragePath, `--out-of-scope=${oosPath}`], {',
    symbol: 'C7 OOS 文件形状三态（invalid / non-array / valid out-of-scope fixture）',
    reason:
      'Existing real CLI assertion has an explicit 15-second timeout; brief explicitly preserves it. 2026-09-28 Wave 2.1 npx 清理：execSync 字符串模板迁移 runSync 数组形，超时/cwd 语义保留。2026-09-29 Wave 3 批 B 循环内聚合将 3 处字面相同调用收敛为循环体单调用点（coverage-logic 26→11 例），审计溯源随物理调用点合并为单条目。',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    anchor: 'const result = spawnSync(',
    symbol: 'toBashPath wslpath/cygpath probe',
    reason:
      'Convert a Windows path to the running Bash form via wslpath/cygpath when the fixture runs on win32; explicit 15-second timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    anchor: "const gitInit = spawnSync('git', ['init'], { cwd: fixtureRoot, encoding: 'utf-8', timeout: 15_000 });",
    symbol: 'withDocsConsistencyFixture git init',
    reason: 'D5 creates a real temporary Git repository so provenance binds to an actual HEAD.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    anchor: "spawnSync('git', ['config', '--local', 'user.email', 'fixture@example.invalid'], {",
    symbol: 'withDocsConsistencyFixture git config email',
    reason: 'D5 configures the isolated fixture Git identity before creating its commit.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    anchor:
      "spawnSync('git', ['config', '--local', 'user.name', 'fixture'], { cwd: fixtureRoot, timeout: 15_000 }).status,",
    symbol: 'withDocsConsistencyFixture git config name',
    reason: 'D5 configures the isolated fixture Git identity before creating its commit.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    anchor:
      "spawnSync('git', ['config', '--local', 'commit.gpgSign', 'false'], { cwd: fixtureRoot, timeout: 15_000 }).status,",
    symbol: 'withDocsConsistencyFixture git config gpgSign',
    reason: 'D5 disables inherited signing for the isolated provenance fixture.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    anchor:
      "expect(spawnSync('git', ['add', '.provenance-fixture'], { cwd: fixtureRoot, timeout: 15_000 }).status).toBe(0);",
    symbol: 'withDocsConsistencyFixture git add',
    reason: 'D5 stages the copied fixture before creating its provenance-bound commit.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    anchor: 'const commit = spawnSync(',
    symbol: 'withDocsConsistencyFixture git commit',
    reason: 'D5 creates the real fixture HEAD with isolated hooks/signing/editor settings and a bounded timeout.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    anchor:
      "const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: fixtureRoot, encoding: 'utf-8', timeout: 15_000 });",
    symbol: 'fixtureCommitSha',
    reason: 'D5 reads the isolated fixture HEAD for same-run provenance assertions.',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/docs-consistency-logic.test.ts',
    anchor: 'const result = spawnSync(process.execPath, [tsxCli, DOCS_CONSISTENCY_CLI, fixtureRoot, ...args], {',
    symbol: 'runDocsConsistencyCli',
    reason: 'D5 keeps the real docs-consistency CLI boundary test with an explicit bounded timeout for exit-2 probes.',
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
    api: 'spawnSync',
    file: '__tests__/wm-append-runlog-cli.test.ts',
    anchor: 'const result = spawnSync(process.execPath, [tsxCli, SCRIPT, ...args], {',
    symbol: 'run',
    reason: 'run-log 追加器 CLI 子进程用例真实 spawn tsx，显式 20 秒超时（D-5①/N-5 三态取证）。',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'spawnSync',
    file: '__tests__/checkpoint-r0-bootstrap-cli.test.ts',
    anchor: 'const result = spawnSync(process.execPath, [tsxCli, WM_STATUS_CLI], {',
    symbol: 'C1 反证：VITEST=1 子进程不自证旁路',
    reason:
      'C1（2026-10-04）反证用例需以显式 env（VITEST=1）spawn 真实 CLI——runSync 的 childProcessEnv 会剥离 VITEST，无法构造旁路形态，故保留直接同步调用；显式 60 秒超时（对齐本文件 runCli 的 tsx 冷启动口径）。',
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execSync',
    file: '__tests__/eval-runner.test.ts',
    anchor: "const r = runSync(process.execPath, [tsxCli, join(repoRoot, 'eval', 'runner.ts'), '--self-check'], {",
    symbol: 'eval runner --self-check 退出码 0 断言',
    reason:
      'eval/runner.ts --self-check 自检命令，显式 15 秒超时保护。2026-09-28 Wave 2.1 npx 清理：execSync 字符串模板迁移 runSync 数组形，超时/cwd 语义保留。',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  {
    api: 'execSync',
    file: '__tests__/eval-runner.test.ts',
    anchor: "const r = runSync(process.execPath, [tsxCli, join(repoRoot, 'eval', 'runner.ts'), '--self-check'], {",
    symbol: 'eval runner --self-check JSON 可解析断言',
    reason:
      'eval/runner.ts --self-check 自检命令，显式 15 秒超时保护。2026-09-28 Wave 2.1 npx 清理：execSync 字符串模板迁移 runSync 数组形，超时/cwd 语义保留。',
    migratedToRunSync: true,
    timeout: { required: true, status: 'present' },
  },
  // 2026-09-28 修复轮 2（Wave 2 收口门回归修复）：`__tests__/check-codegraph-queries.test.ts` 与
  // `__tests__/check-coding-plan.test.ts` 的两条 migratedToRunSync 台账随 Task 9 批次转换摘除——
  // 两文件的 CLI spawn 已进程内化（runCli 走 helpers/cli-invoker 直调 main），runSync 仅剩 git
  // fixture 建仓调用（非 child_process 直调，无须登记）。锚已 0 命中，而守护
  // （run-sync.test.ts「retains anchor-accurate provenance」）要求 migrated 条目锚命中 ≥1，
  // 失效条目按锚内容寻址判据移除。
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
 * 子进程环境：剥离 vitest worker 泄漏的 VITEST 变量。
 * 真实 CLI 调用（tsx 直跑 / 终端）永不设置 VITEST；vitest worker 内 spawn 的
 * CLI 子进程不应继承 worker 专属变量（C1 后 runMain 已无 VITEST 旁路，剥离
 * 仅为子进程环境保真——与终端直跑同形）。options.env 显式给出时以其为基底
 * （多数测试传入的 curated env 本就无 VITEST，剥离为幂等 no-op）。
 */
export function childProcessEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const child = { ...env };
  delete child.VITEST;
  return child;
}

/**
 * Executes a child process synchronously with mandatory process-level bounds.
 * Callers may extend a known long-running timeout but cannot override SIGKILL,
 * UTF-8 output decoding, or the finite positive default fallbacks.
 */
export function runSync(command: string, args: string[], options: RunSyncOptions = {}): SpawnSyncReturns<string> {
  return spawnSync(command, args, {
    ...options,
    env: childProcessEnv(options.env),
    timeout: boundedPositiveNumber(options.timeout, DEFAULT_SYNC_TIMEOUT_MS),
    killSignal: 'SIGKILL',
    encoding: 'utf-8',
    maxBuffer: boundedPositiveNumber(options.maxBuffer, DEFAULT_SYNC_MAX_BUFFER),
  }) as SpawnSyncReturns<string>;
}
