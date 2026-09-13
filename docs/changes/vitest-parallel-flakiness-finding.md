# 并行执行下的测试抖动 — 发现记录（2026-09-12）

> **性质：既有问题，非本 campaign 引入。** 本文档是发现记录，不是修复补丁。
> 独立性已由**未改动的基线提交**证明（下文证据 1）。

## 现象

`npx vitest run` 全量跑时，偶发 1-2 个用例失败，且**每次落在不同文件**。失败形态统一为子进程类症状：

- `AssertionError: expected null to be 1 / 0 / 2`（子进程退出码读到 `null`，即子进程未真正运行）
- `Error: STACK_TRACE_ERROR`

命中的文件（每次随机其一或其二，均以 `execSync`/`spawnSync` 启动 `npx tsx <cli>` 子进程）：

| 文件                                                 | 直接原因                   |
| ---------------------------------------------------- | -------------------------- |
| `cli-natural-exit.test.ts`                           | 真机 CLI 子进程退出码断言  |
| `gate-report.test.ts`                                | `check-*` CLI 子进程冒烟   |
| `evidence-export-logic.test.ts`                      | 真实 CLI 导出/校验子进程   |
| `evidence-provenance-logic.test.ts`                  | 真实 CLI provenance 子进程 |
| `wm-write.test.ts` / `platform-deps-install.test.ts` | 真实 CLI 子进程退出契约    |

## 证据（七组对照，均由实测得出）

| #   | 环境                                                                         | 结果                                                        |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | **基线 `72081e2`**（未含本 campaign 任何改动），并行 + 无 coverage           | **1 个失败**（`gate-report.test.ts` → `STACK_TRACE_ERROR`） |
| 2   | 本 campaign worktree，并行 + 无 coverage                                     | 偶发 1-2 个失败，落点每次不同                               |
| 3   | 本 campaign worktree，**串行**（`--no-file-parallelism`）+ 无 coverage       | **1904 / 1904 通过，success=true**                          |
| 4   | 本 campaign worktree，并行 + `--coverage`（第 1 次）                         | **20 个失败**（含 `bdd-cli.test.ts` 的 D5 evidence 用例）   |
| 5   | 本 campaign worktree，并行 + `--coverage`（第 2 次，**同一命令、同一代码**） | **2 个失败**                                                |
| 6   | 本 campaign worktree，**串行 + `--coverage`**                                | **1904 / 1904 通过，success=true**                          |
| 7   | 本 campaign worktree，串行（复测确认）                                       | 再次 1904 / 1904 通过                                       |

**结论**：与改动内容无关，与**并行度**和 **coverage 插桩开销**共同相关。两条决定性证据：

- **证据 1**：基线 `72081e2` 未含本 campaign 任何改动，同样复现 → 非本 campaign 引入。
- **证据 4 vs 5**：同一条命令、同一份代码，两次运行的失败数相差 **10 倍**（20 vs 2），且失败集合不同（一次含 `bdd-cli` 的 20 条，一次是 2 条无关文件）。这种量级跳动排除了"某条断言写错"的可能，只能归因于并发资源竞争。
- **证据 3 / 6 / 7**：串行（含 coverage）三次均确定性全绿 → 给出可复现的绿路径。

补充排除项：失败与机器负载无关（跑时 `nproc=16`、CPU 负载 11%），亦与 30s timeout 无关（单次 CLI 实测约 1.2-1.3s，余量充足）；单文件隔离运行时（含 coverage）全部通过（如 `gate-report.test.ts` 47/47、两文件合计 85/85）。

## 影响

- `npm run prepush` 第 12 项（`vitest run --coverage`）会因此偶发 exit 1，**阻断推送但非真实回归**。
- `check-docs-consistency` 的 standalone 自采集路径（无 `WM_VITEST_COUNT_FILE`）同样会 spawn 并行 vitest，故也会读到含失败的 artifact 而 fail-closed。本轮实测该路径连续 3 次均因该原因 exit 1，而 `staticViolationCount` 恒为 0——**文档侧无一违规**。
- 本 campaign 全量验证期间该现象多次出现，均经"单文件隔离 → 全量串行"两次复测确认非真实失败。

## 建议（**短期项已于 2026-09-12 实施**）

1. **短期（已实施，后被中期方案取代）**：`config/vitest.config.ts` 的 `test` 内曾设全局 `fileParallelism: false`。复验两次均 exit 0、1904/1904 全绿；连带两处配套校准——`check-docs-consistency.ts` `VITEST_SPAWN_TIMEOUT_MS` 600s→1800s（套件 975~1060s 会撞 600s 上限被误杀），`lib/run-sync.ts` manifest 两处行号锚 +2 顺延（run-sync.test.ts 行级断言抓住，属真实失败非抖动）。最终整链验证：`npm run prepush` 18 项全绿 exit 0（1055s）。
2. **中期（2026-09-12 已实施，取代短期项的全局串行）**：配置改为 `test.projects` 双 project——`cli-serial`（30 个真实启动子进程的测试文件，`fileParallelism: false`）+ `unit-parallel`（其余纯逻辑文件，保持并行）。成员清单 `SUBPROCESS_TEST_FILES` 由新增的 `vitest-project-split.test.ts` **双向守护**（真实 spawn 未登记 / 无证据残留 / 文件不存在均红灯；判定口径排除三类已知误报：vi.mock 替换 child_process 的 artifact-gate-assets 与 run-sync、仅类型导入的 dependency-boundaries、注释与正则里的词）。拆分后全量无 coverage 974s / 1908 tests（80 原有 + 4 守护）exit 0。
   **诚实的收益边界**：全量墙钟几乎不变（974s vs 全串行 975s）——子进程文件的执行时间本身占大头，串行集合再小也省不动；拆分的实际收益是**结构性的**：① 并行/串行集合显式化并由守护测试锁定，未来新增测试不会静默落入错误的一侧；② 纯逻辑文件的迭代回归（51 文件）恢复并行，只跑这一侧时明显更快；③ 澄清了"真正提速要把子进程测试本身做轻（减少真实 spawn 次数），而非调并发结构"。
3. **不建议**：放宽断言、重试掩盖、或把 stale artifact 豁免掉——抖动是环境暴露的真实现象，掩盖会同时掩盖真失败。

## 边界声明

本文档**不主张**本 campaign 已修复该问题。第 12 项门禁在本轮多次实测中**既出现过 exit 0 全绿（真实通过），也出现过因抖动的 exit 1**；本 campaign 的交付判定不依赖"抖动恰好没发生"，而是依赖**串行全量 1904/1904** 这一确定性证据。
