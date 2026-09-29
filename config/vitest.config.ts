// Vitest 配置：仅扫描技能包门禁脚本单元测试，按「是否启动真实子进程」拆成三个 project
// （unit-parallel 并行 + cli-serial-a / cli-serial-b 两组串行、组间并行）。
// 不依赖 vitest/config 的 defineConfig，纯对象导出避免 vitest 包未装时的 ERR_MODULE_NOT_FOUND。
//
// testTimeout 说明：部分测试用 execSync 启动 `npx tsx <script>` 子进程（CLI 集成测试）。
// 在 WSL（Windows Subsystem for Linux）下访问 /mnt/d 挂载的 node_modules 冷启动较慢，
// 单次子进程可能超过默认 5000ms 超时（Windows 原生无此问题）。调大上限不影响 Windows 表现。
//
// 为什么拆两个 project（背景：docs/changes/vitest-parallel-flakiness-finding.md）：
//   仓库里会真实 execSync/spawnSync/runSync 启动 CLI 子进程的测试文件（成员名单 = 下方
//   SUBPROCESS_TEST_FILES 常量；清单长度以常量为准，
//   由 vitest-project-split.test.ts 双向守护（源码证据 ↔ 登记一一对应））。这些文件
//   **彼此并行**时子进程互相竞争，出现 `expected null to be N`（子进程未真正运行）、
//   STACK_TRACE_ERROR、30s 超时，且每次落在不同文件——同一命令同一代码两次运行失败数
//   可差 10 倍（实测 20 vs 2），量级跳动排除"断言写错"；基线 72081e2 同样复现。
//   --maxWorkers=4 与 --testTimeout=120000 均被实测否定，唯一有效解是子进程类文件互不重叠。
//   故：cli-serial 项目 fileParallelism:false（子进程类串行，互不重叠），其余纯逻辑文件
//   在 unit-parallel 项目保持并行以保速度。**新增会真实 spawn 子进程的测试文件必须登记进
//   SUBPROCESS_TEST_FILES**（vitest-project-split.test.ts 会用源码证据强制此约定，
//   漏登记即红灯）；反向地，不再 spawn 的文件也应从清单移除（该测试双向校验）。
//   判定口径：真实 import node:child_process 或调用 runSync/execSync/spawnSync/execFile
//   （后跟左括号）；vi.mock('node:child_process') 整体替换子进程的文件（artifact-gate-assets）
//   从不真实启动，**不算** spawn。
//   已清（2026-09-28 Wave 2/T5）：run-sync.test.ts 顶部 vi.mock 使文件级判定为
//   非 spawn，但其「terminates a real slow child」用例经 vi.doUnmock 真实 spawn——
//   已如实登记进 SUBPROCESS_TEST_FILES（登记口径优先于判定口径，宁串行勿漏判）。
//   2026-09-29 Wave 2.3 登记：serial 池拆两组（cli-serial-a / cli-serial-b）组间并行。
//   与 B6 已证伪的「全局共享 workers」不同机制：组内仍 fileParallelism:false 互不重叠，
//   仅两组并发（分属不同 project，天然并发跑）。启用判据：vitest 墙钟 1191s > 12 min。
//   前提：3 连跑零 flaky 门槛通过后保留本拆分；任一失败整组回退单一 cli-serial
//   （回退 = 恢复单 project 配置）。

const TEST_DIR = 'w-model-dev/scripts/__tests__';

/**
 * 会启动真实子进程的测试文件（相对 TEST_DIR）。
 * 判定口径：源码含 `from 'node:child_process'` 或调用 `runSync(/execSync(/spawnSync(/execFile(`。
 * 此清单是 **cli-serial-a / cli-serial-b 两组串行项目的成员名单（按索引奇偶派生）+
 * unit-parallel 项目的排除名单**，三处由本常量派生，不会漂移；
 * 清单本身的正确性由 vitest-project-split.test.ts 双向守护。
 */
export const SUBPROCESS_TEST_FILES: readonly string[] = [
  'bdd-cli.test.ts',
  'budget-cli-wiring.test.ts',
  'change-scope.test.ts',
  'check-archive-integrity-cli.test.ts',
  'check-code-tla-consistency.test.ts',
  'check-codegraph-queries.test.ts',
  'check-coding-plan.test.ts',
  'check-coverage-scope.test.ts',
  'check-pollution-cli.test.ts',
  'check-samples-coverage.test.ts',
  'checkpoint-r0-bootstrap-cli.test.ts',
  'cli-arg-unification.test.ts',
  'cli-natural-exit.test.ts',
  'cli-subprocess-smoke.test.ts',
  'code-health-cli.test.ts',
  'code-health-duplicates.test.ts',
  'code-health-e2e.test.ts',
  'code-health-evidence.test.ts',
  'code-health-gap.test.ts',
  'code-health-ledger.test.ts',
  'code-health-phase1.test.ts',
  'code-health-task1-integration.test.ts',
  'code-health-tests.test.ts',
  'coverage-logic.test.ts',
  'docs-consistency-logic.test.ts',
  'doctor-logic.test.ts',
  'eval-runner.test.ts',
  'evidence-export-logic.test.ts',
  'evidence-provenance-logic.test.ts',
  'exit2-failure-atomicity.test.ts',
  'gate-report.test.ts',
  'gate-test-evidence.test.ts',
  'graph-logic.test.ts',
  'l0-link-audit-cli.test.ts',
  'maturity-logic.test.ts',
  'platform-deps-hook.test.ts',
  'platform-deps-install.test.ts',
  'pre-commit-hook.test.ts',
  'project-read-validation.test.ts',
  'review-package-cli.test.ts',
  'run-sync.test.ts',
  'wm-append-runlog-cli.test.ts',
  'wm-write.test.ts',
];

// 奇偶派生两组 serial 池（单一事实源 SUBPROCESS_TEST_FILES 不裂变；2026-09-29 Wave 2.3，
// 见文件头「为什么拆两个 project」注释块末段登记）：
// 偶数索引 → A 组，奇数索引 → B 组；组内串行互不重叠，组间分属不同 project 天然并行。
const subprocessGlobsA = SUBPROCESS_TEST_FILES.filter((_, i) => i % 2 === 0).map((f) => `${TEST_DIR}/${f}`);
const subprocessGlobsB = SUBPROCESS_TEST_FILES.filter((_, i) => i % 2 === 1).map((f) => `${TEST_DIR}/${f}`);

export default {
  test: {
    // 定义 projects 后，测试收集只发生在各 project 内；coverage / reporter 为仓库级全局配置。
    projects: [
      {
        test: {
          name: 'unit-parallel',
          include: [`${TEST_DIR}/**/*.test.ts`],
          exclude: ['node_modules/**', ...subprocessGlobsA, ...subprocessGlobsB],
          testTimeout: 30000,
          hookTimeout: 30000,
          // fileParallelism 缺省即 true：纯逻辑文件无子进程竞争，保持并行。
        },
      },
      {
        test: {
          name: 'cli-serial-a',
          include: [...subprocessGlobsA],
          exclude: ['node_modules/**'],
          testTimeout: 30000,
          hookTimeout: 30000,
          // 子进程类文件组内串行：同一时刻每组至多一个文件在 spawn CLI 子进程，
          // 消除子进程互抢导致的偶发失败（见文件头说明）；a/b 两组分属不同 project
          // 组间并行（Wave 2.3，与 B6 已证伪的「全局共享 workers」不同机制）。
          // 不要为提速把 fileParallelism 改回 true。
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'cli-serial-b',
          include: [...subprocessGlobsB],
          exclude: ['node_modules/**'],
          testTimeout: 30000,
          hookTimeout: 30000,
          // 同 cli-serial-a：组内串行、组间并行；成员为清单奇数索引派生。
          fileParallelism: false,
        },
      },
    ],
  },
  // 覆盖率门禁（2026-09-28 Wave 5/T1 单口径化）：唯一强制口径 = pre-push 第 13 项
  // check-coverage-scope（logic+lib 白名单分母重算，阈值见 pre-push 注释）。
  // 历史注记：全分母阈值（stmts 75/branch 65/funcs 85/lines 75，基线 2026-08-12）已撤销——
  // v8 provider「被 import 文件必入报告」使全分母混入 cli/ 层（2026-09-17 实测全分母
  // stmts 76.83 距阈值仅 1.8pp，「新增低覆盖 CLI import 即假红」与产品回归无关）。
  // instrumentation（provider/include/reporter）保留：coverage-final.json 供第 13 项消费。
  coverage: {
    provider: 'v8',
    include: ['w-model-dev/scripts/logic/**', 'w-model-dev/scripts/lib/**'],
    reporter: ['text', 'json'],
  },
};
