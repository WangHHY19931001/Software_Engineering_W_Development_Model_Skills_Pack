// Vitest 配置：仅扫描技能包门禁脚本单元测试，按「是否启动真实子进程」拆成五个 project
// （unit-parallel 并行 + cli-serial-a/b/c/d 四组串行、组间并行）。
// 不依赖 vitest/config 的 defineConfig，纯对象导出避免 vitest 包未装时的 ERR_MODULE_NOT_FOUND。
//
// testTimeout 说明：部分测试用 execSync 启动 `npx tsx <script>` 子进程（CLI 集成测试）。
// 在 WSL（Windows Subsystem for Linux）下访问 /mnt/d 挂载的 node_modules 冷启动较慢，
// 单次子进程可能超过默认 5000ms 超时（Windows 原生无此问题）。调大上限不影响 Windows 表现。
//
// 为什么拆 project（背景：docs/changes/vitest-parallel-flakiness-finding.md）：
//   仓库里会真实 execSync/spawnSync/runSync 启动 CLI 子进程的测试文件（成员名单 = 下方
//   SUBPROCESS_TEST_FILES 常量；清单长度以常量为准，
//   由 vitest-project-split.test.ts 双向守护（源码证据 ↔ 登记一一对应））。这些文件
//   **彼此并行**时子进程互相竞争，出现 `expected null to be N`（子进程未真正运行）、
//   STACK_TRACE_ERROR、30s 超时，且每次落在不同文件——同一命令同一代码两次运行失败数
//   可差 10 倍（实测 20 vs 2），量级跳动排除"断言写错"；基线 72081e2 同样复现。
//   --maxWorkers=4 与 --testTimeout=120000 均被实测否定，唯一有效解是子进程类文件互不重叠。
//   故：cli-serial 项目 fileParallelism:false（子进程类串行，互不重叠），其余纯逻辑文件
//   在 unit-parallel 项目保持并行以保速度。**新增会真实 spawn 子进程的测试文件必须登记进
//   SUBPROCESS_TEST_FILES 并按下方维护规则归入 runtime 估算和最小的组**
//   （vitest-project-split.test.ts 会用源码证据强制此约定，漏登记即红灯）；反向地，
//   不再 spawn 的文件也应从清单与所在组移除（该测试双向校验）。
//   判定口径：真实 import node:child_process 或调用 runSync/execSync/spawnSync/execFile
//   （后跟左括号）；vi.mock('node:child_process') 整体替换子进程的文件（artifact-gate-assets）
//   从不真实启动，**不算** spawn。
//   已清（2026-09-28 Wave 2/T5）：run-sync.test.ts 顶部 vi.mock 使文件级判定为
//   非 spawn，但其「terminates a real slow child」用例经 vi.doUnmock 真实 spawn——
//   已如实登记进 SUBPROCESS_TEST_FILES（登记口径优先于判定口径，宁串行勿漏判）。
//   2026-09-29 Wave 2.3 登记：serial 池拆两组（cli-serial-a / cli-serial-b）组间并行。
//   与 B6 已证伪的「全局共享 workers」不同机制：组内仍 fileParallelism:false 互不重叠，
//   仅两组并发（分属不同 project，天然并发跑）。启用判据：vitest 墙钟 1191s > 12 min。
//   该拆分已通过 3 连跑零 flaky 门槛（2 组形态自此沿用）。
//   2026-09-30 登记：**用户裁定 serial 池再拆 2 组 → 4 组负载均衡**（目标 prepush 墙钟
//   中位 ≤900s）。分组机制改为静态负载均衡名单（见下方 subprocessGroupA-D 注释块），
//   机制与 Wave 2.3 相同（组内串行互不重叠、组间分属不同 project 天然并行）。
//   门槛同前：3 连跑零 flaky 方可保留本 4 组拆分；任一失败整组回退 2 组奇偶派生形态
//   （恢复按索引奇偶 filter 的 Wave 2.3 配置）。

const TEST_DIR = 'w-model-dev/scripts/__tests__';

/**
 * 会启动真实子进程的测试文件（相对 TEST_DIR）。
 * 判定口径：源码含 `from 'node:child_process'` 或调用 `runSync(/execSync(/spawnSync(/execFile(`。
 * 此清单是 **cli-serial-a/b/c/d 四组串行项目成员名单的约束基准（下方 subprocessGroupA-D
 * 静态名单的并集必须恰为本清单且四组互不重叠）+ unit-parallel 项目的排除名单（四组并集
 * 派生）**，由 vitest-project-split.test.ts 双向守护（并集相等 + Set 去重排序比对），
 * 漂移即红灯；清单本身的正确性（spawn 证据）也由该测试守护。
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

// 静态负载均衡四组 serial 池（2026-09-30 用户裁定 2 组 → 4 组；**不用耗时快照常量**，
// 名单逐字面静态维护，避免快照与实际耗时漂移的维护面）。四组名单的并集必须恰等于
// SUBPROCESS_TEST_FILES 全集且互不重叠（vitest-project-split.test.ts 运行时双向断言）。
//
// ① 分组依据：2026-09-30 final-vitest.json 逐文件实测（43 文件合计 ~1234s）贪心装箱——
//    耗时降序、放入当前估算和最小的组。两大重文件互斥异组是均衡的本质（无论轻文件怎么
//    漂移，二者永不互抢同组墙钟）：docs-consistency-logic ~340s 独占 A 组、
//    platform-deps-hook ~307s 独占 B 组；次重档 evidence-export-logic ~58s /
//    exit2-failure-atomicity ~49s / pre-commit-hook ~48s / code-health-tests ~41s /
//    gate-report ~39s / code-health-task1-integration ~37s / code-health-e2e ~34s /
//    check-samples-coverage ~27s 按「放入当前和最小组」归入 C/D；其余 33 个轻文件
//    （合计 ~254s，单文件均值 ~7.7s）交替均分。各组估算和：A≈340 / B≈307 / C≈294 /
//    D≈294（轻文件为均值估算，非逐文件实测）。
// ② 维护规则：新增会 spawn 子进程的测试文件时，登记进 SUBPROCESS_TEST_FILES 并按
//    「放入当前 runtime 估算和最小的组」归位（无快照可算，按本注释口径与近期实测估算）；
//    漏登记或跨组重复由 vitest-project-split.test.ts 强制（并集恰为清单且互不重叠）。
// ③ 机制与门槛：与 B6 已证伪的「全局共享 workers」不同机制——组内仍 fileParallelism:false
//    互不重叠，仅四组并发（分属不同 project 天然并行跑）；不要为提速把 fileParallelism
//    改回 true。3 连跑零 flaky 门槛通过后方可保留本 4 组拆分；任一失败整组回退 2 组
//    奇偶派生（Wave 2.3 形态，先例见文件头上一登记段）。
const subprocessGroupA: readonly string[] = [
  // 实测最大文件独占一组（~340s），与 platform-deps-hook 互斥异组
  'docs-consistency-logic.test.ts',
];
const subprocessGroupB: readonly string[] = [
  // 实测次大文件独占一组（~307s），与 docs-consistency-logic 互斥异组
  'platform-deps-hook.test.ts',
];
const subprocessGroupC: readonly string[] = [
  // 次重档（实测耗时逐条标注）
  'evidence-export-logic.test.ts', // ~58s
  'code-health-tests.test.ts', // ~41s
  'code-health-task1-integration.test.ts', // ~37s
  'code-health-e2e.test.ts', // ~34s
  // 轻文件档（未逐文件实测，均值 ~7.7s）
  'budget-cli-wiring.test.ts',
  'check-archive-integrity-cli.test.ts',
  'check-codegraph-queries.test.ts',
  'check-coverage-scope.test.ts',
  'checkpoint-r0-bootstrap-cli.test.ts',
  'cli-natural-exit.test.ts',
  'code-health-cli.test.ts',
  'code-health-evidence.test.ts',
  'code-health-phase1.test.ts',
  'doctor-logic.test.ts',
  'evidence-provenance-logic.test.ts',
  'graph-logic.test.ts',
  'maturity-logic.test.ts',
  'project-read-validation.test.ts',
  'run-sync.test.ts',
  'wm-write.test.ts',
];
const subprocessGroupD: readonly string[] = [
  // 次重档（实测耗时逐条标注）
  'exit2-failure-atomicity.test.ts', // ~49s
  'pre-commit-hook.test.ts', // ~48s
  'gate-report.test.ts', // ~39s
  'check-samples-coverage.test.ts', // ~27s
  // 轻文件档（未逐文件实测，均值 ~7.7s）
  'bdd-cli.test.ts',
  'change-scope.test.ts',
  'check-code-tla-consistency.test.ts',
  'check-coding-plan.test.ts',
  'check-pollution-cli.test.ts',
  'cli-arg-unification.test.ts',
  'cli-subprocess-smoke.test.ts',
  'code-health-duplicates.test.ts',
  'code-health-gap.test.ts',
  'code-health-ledger.test.ts',
  'coverage-logic.test.ts',
  'eval-runner.test.ts',
  'gate-test-evidence.test.ts',
  'l0-link-audit-cli.test.ts',
  'platform-deps-install.test.ts',
  'review-package-cli.test.ts',
  'wm-append-runlog-cli.test.ts',
];

// 字面名单 → project include/exclude 用的 glob 形态。四组并集即 SUBPROCESS_TEST_FILES
// 全集（vitest-project-split.test.ts 断言），unit-parallel 的排除名单取同一并集。
const toGlobs = (files: readonly string[]): string[] => files.map((f) => `${TEST_DIR}/${f}`);
const subprocessGlobsA = toGlobs(subprocessGroupA);
const subprocessGlobsB = toGlobs(subprocessGroupB);
const subprocessGlobsC = toGlobs(subprocessGroupC);
const subprocessGlobsD = toGlobs(subprocessGroupD);
const subprocessGlobsAll = [...subprocessGlobsA, ...subprocessGlobsB, ...subprocessGlobsC, ...subprocessGlobsD];

export default {
  test: {
    // 定义 projects 后，测试收集只发生在各 project 内；coverage / reporter 为仓库级全局配置。
    projects: [
      {
        test: {
          name: 'unit-parallel',
          include: [`${TEST_DIR}/**/*.test.ts`],
          exclude: ['node_modules/**', ...subprocessGlobsAll],
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
          // 消除子进程互抢导致的偶发失败（见文件头说明）；a/b/c/d 四组分属不同
          // project 组间并行（2026-09-30 用户裁定 2 组→4 组负载均衡，机制与
          // Wave 2.3 相同）。不要为提速把 fileParallelism 改回 true。
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
          // 同 cli-serial-a：组内串行、组间并行；成员为静态名单 subprocessGroupB。
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'cli-serial-c',
          include: [...subprocessGlobsC],
          exclude: ['node_modules/**'],
          testTimeout: 30000,
          hookTimeout: 30000,
          // 同 cli-serial-a：组内串行、组间并行；成员为静态名单 subprocessGroupC。
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'cli-serial-d',
          include: [...subprocessGlobsD],
          exclude: ['node_modules/**'],
          testTimeout: 30000,
          hookTimeout: 30000,
          // 同 cli-serial-a：组内串行、组间并行；成员为静态名单 subprocessGroupD。
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
  // T6 销账（2026-09-29）：历史观察「全量运行时 exclude 写法实测均不生效（机制未查明）」
  // 如实保留为历史注记；T1 单口径化后该行为不再相关（强制口径不依赖全分母 exclude）。
  // instrumentation（provider/include/reporter）保留：coverage-final.json 供第 13 项消费。
  coverage: {
    provider: 'v8',
    include: ['w-model-dev/scripts/logic/**', 'w-model-dev/scripts/lib/**'],
    reporter: ['text', 'json'],
  },
};
