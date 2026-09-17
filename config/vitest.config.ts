// Vitest 配置：仅扫描技能包门禁脚本单元测试，按「是否启动真实子进程」拆成两个 project。
// 不依赖 vitest/config 的 defineConfig，纯对象导出避免 vitest 包未装时的 ERR_MODULE_NOT_FOUND。
//
// testTimeout 说明：部分测试用 execSync 启动 `npx tsx <script>` 子进程（CLI 集成测试）。
// 在 WSL（Windows Subsystem for Linux）下访问 /mnt/d 挂载的 node_modules 冷启动较慢，
// 单次子进程可能超过默认 5000ms 超时（Windows 原生无此问题）。调大上限不影响 Windows 表现。
//
// 为什么拆两个 project（背景：docs/changes/vitest-parallel-flakiness-finding.md）：
//   仓库里 30 个测试文件会真实 execSync/spawnSync/runSync 启动 CLI 子进程。这些文件
//   **彼此并行**时子进程互相竞争，出现 `expected null to be N`（子进程未真正运行）、
//   STACK_TRACE_ERROR、30s 超时，且每次落在不同文件——同一命令同一代码两次运行失败数
//   可差 10 倍（实测 20 vs 2），量级跳动排除"断言写错"；基线 72081e2 同样复现。
//   --maxWorkers=4 与 --testTimeout=120000 均被实测否定，唯一有效解是子进程类文件互不重叠。
//   故：cli-serial 项目 fileParallelism:false（子进程类串行，互不重叠），其余纯逻辑文件
//   在 unit-parallel 项目保持并行以保速度。**新增会真实 spawn 子进程的测试文件必须登记进
//   SUBPROCESS_TEST_FILES**（vitest-project-split.test.ts 会用源码证据强制此约定，
//   漏登记即红灯）；反向地，不再 spawn 的文件也应从清单移除（该测试双向校验）。
//   判定口径：真实 import node:child_process 或调用 runSync/execSync/spawnSync/execFile
//   （后跟左括号）；vi.mock('node:child_process') 的文件（artifact-gate-assets、run-sync）
//   子进程被替换为 mock、从不真实启动，**不算** spawn。

const TEST_DIR = 'w-model-dev/scripts/__tests__';

/**
 * 会启动真实子进程的测试文件（相对 TEST_DIR）。
 * 判定口径：源码含 `from 'node:child_process'` 或调用 `runSync(/execSync(/spawnSync(/execFile(`。
 * 此清单是 **cli-serial 项目的成员名单 + unit-parallel 项目的排除名单**，两处由本常量派生，
 * 不会漂移；清单本身的正确性由 vitest-project-split.test.ts 双向守护。
 */
export const SUBPROCESS_TEST_FILES: readonly string[] = [
  'bdd-cli.test.ts',
  'change-scope.test.ts',
  'check-codegraph-queries.test.ts',
  'check-coverage-scope.test.ts',
  'check-openspec-archive.test.ts',
  'check-opsx-artifacts.test.ts',
  'check-pollution-cli.test.ts',
  'check-samples-coverage.test.ts',
  'cli-arg-unification.test.ts',
  'cli-natural-exit.test.ts',
  'code-health-cli.test.ts',
  'code-health-duplicates.test.ts',
  'code-health-evidence.test.ts',
  'code-health-gap.test.ts',
  'code-health-ledger.test.ts',
  'code-health-phase1.test.ts',
  'code-health-task1-integration.test.ts',
  'code-health-tests.test.ts',
  'coverage-logic.test.ts',
  'docs-consistency-logic.test.ts',
  'eval-runner.test.ts',
  'evidence-export-logic.test.ts',
  'evidence-provenance-logic.test.ts',
  'exit2-failure-atomicity.test.ts',
  'gate-report.test.ts',
  'gate-test-evidence.test.ts',
  'gate-ticket-content.test.ts',
  'l0-link-audit-cli.test.ts',
  'metrics-report.test.ts',
  'platform-deps-hook.test.ts',
  'platform-deps-install.test.ts',
  'pre-commit-hook.test.ts',
  'project-read-validation.test.ts',
  'review-package-cli.test.ts',
  'verifier-logic.test.ts',
  'wm-status.test.ts',
  'wm-write.test.ts',
];

const subprocessGlobs = SUBPROCESS_TEST_FILES.map((f) => `${TEST_DIR}/${f}`);

export default {
  test: {
    // 定义 projects 后，测试收集只发生在各 project 内；coverage / reporter 为仓库级全局配置。
    projects: [
      {
        test: {
          name: 'unit-parallel',
          include: [`${TEST_DIR}/**/*.test.ts`],
          exclude: ['node_modules/**', ...subprocessGlobs],
          testTimeout: 30000,
          hookTimeout: 30000,
          // fileParallelism 缺省即 true：纯逻辑文件无子进程竞争，保持并行。
        },
      },
      {
        test: {
          name: 'cli-serial',
          include: [...subprocessGlobs],
          exclude: ['node_modules/**'],
          testTimeout: 30000,
          hookTimeout: 30000,
          // 子进程类文件串行：同一时刻至多一个文件在 spawn CLI 子进程，
          // 消除子进程互抢导致的偶发失败（见文件头说明）。不要为提速改回 true。
          fileParallelism: false,
        },
      },
    ],
  },
  // 覆盖率门禁：目标是统计门禁核心实现（logic/ + lib/），但**include 不足以限定分母**——
  // 被测试 import 的文件总会进入报告。2026-09-17 审查实测与尝试记录（如实标注，勿读为已解决）：
  //   · 全量运行报告实测 83 个文件（logic 37 / lib 30 / cli 10 / infrastructure 3 / application 2 / __tests__ 1），
  //     合并值 stmts 76.83 / branch 71.64 / funcs 87.86 / lines 78.88 —— statements 距阈值仅约 1.8pp，
  //     「新增一个低覆盖 CLI import 即假红」的风险真实存在，与产品回归无关。
  //   · 已试两种 exclude 写法（相对路径与 `**/` 前缀）：**聚焦运行（单/双测试文件）实测生效**，
  //     **全量运行实测均未生效**（报告仍含 cli/ 等层）；机制未查明，故不保留 exclude（避免发布不实声明）。
  //   · 结论：口径问题**未解决**，仅完成测量与归因；阈值维持 75/65/85/75（不因口径未定而放宽或收紧）。
  coverage: {
    provider: 'v8',
    include: ['w-model-dev/scripts/logic/**', 'w-model-dev/scripts/lib/**'],
    // thresholds 基线 = 2026-08-12 实测（logic+lib 合并）：stmts 75.32 / branch 66.57 / funcs 85.5 / lines 76.62，
    // 取实际值向下取整到 5 的倍数，随测试补充逐步上调。
    thresholds: { statements: 75, branches: 65, functions: 85, lines: 75 },
  },
};
