# Task 6 报告：负向覆盖登记册严格化 + 真实 exit-2 探针

## 范围

基线 `fd387daa`。写集：`cli/check-samples-coverage.ts`、`cli/check-docs-consistency.ts`、新增
`lib/exit2-probe-registry.ts`、`__tests__/check-samples-coverage.test.ts`、`samples/NEGATIVE-COVERAGE.md`、
`AGENTS.md` / `CONTRIBUTING.md` / `references/subagent-delegation.md`（规则描述）。

## 实现事实

1. **唯一探针事实源**：新建 `lib/exit2-probe-registry.ts`，把此前**两份**独立实现
   （`check-docs-consistency.ts` 的中心探针统计 `exit2ScriptCount` + `exit2-failure-atomicity.test.ts`
   的 `negativeProbeFor()`，两者只用注释互相指认「同源」）收敛为一份：门禁集合口径
   `listGateScripts`（`cli/*.ts` 减 `self-test.ts`）、基础探针 `--d4-invalid-argument`、
   4 个专用探针门禁（security-scan / metrics-report / wm-export-evidence×3 / wm-status）、
   exit-2 允许的错误类别（`ErrorCategory` 减 `UNEXPECTED`）。`check-docs-consistency.ts` 改为
   `buildExit2Probes({ cliScriptFiles, workRoot: probeRoot })`，行为按构造等价（探针 id / args / cwd /
   env / outputPath 逐项比对一致：45 门禁 / 47 探针）。
2. **登记册严格化（第 5 条规则）**：`parseNegativeCoverage` 不再静默 `continue` 丢弃坏行，改为具名违规：
   `negative-coverage-malformed`（列数 ≠ 4 或存在空列）、`negative-coverage-unknown-mechanism`、
   `negative-coverage-unknown-gate`（基名不在 exit-2 集合内）、`negative-coverage-duplicate`（同门禁多行）、
   `negative-coverage-empty-evidence`（并入 malformed 的空列判定）；`fixture` 证据仍校验在盘
   （`negative-coverage-dangling`），`invocation` / `mutated-copy` 证据必须解析为 `文件:行号`
   且行号落在 `1..文件总行数` 内（`negative-coverage-evidence-invalid`）——只有文字「由任务 3 提供」不再算证据。
3. **真实 exit-2 探针**：逐门禁**串行**执行注册表探针，cwd 为隔离探针根（`mkdtemp`），每次调用前后比对
   探针根条目集合，断言 **exit code = 2**、stdout 含可解析 `ERROR_JSON` 且 `exitCode=2`、`category` 属
   exit-2 类别、stderr 含**同类别**的人类错误行（`✗ [CATEGORY]`）、探针根零漂移。tsx 不可用等
   探针不可用情形按失败处理（fail-closed），不静默跳过。
4. **登记册补全**：两行占位（doctor / wm-verify-evidence-source「由任务 3 的 … 提供」）替换为真实证据
   `w-model-dev/scripts/__tests__/exit2-failure-atomicity.test.ts:290`（`:273` 起的逐门禁循环对每个门禁断言 exit 2）；
   两处漂移行号修正（**首轮修正自身又失效，见下「独立复审」**）：
   `check-pollution-cli.test.ts:212→222`（`:216→:226`）、`review-package-cli.test.ts:163→415`（`:166→:418`）。
   逐行核对行内容确为 exit-2 / 零写盘断言后才改；`review-package` 两处经复审复核**正确**。
   表头改写为第 4/5 条规则，删除已不成立的「由任务 3 提供」缺口说明。

## 真实命令结果

| 命令 | 结果 |
| --- | --- |
| `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts . --json` | exit `0`；`negativeCoverageRows=45`、`negativeCoverageProbes=47`、`negativeCoverageProbeFailures=0`、`missing=0`、`dangling=0`；耗时 `68.7s` |
| `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/check-samples-coverage.test.ts` | `17 passed (17)`，exit `0`，`135.8s` |
| `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` | `198 passed (198)`，exit `0`（含中心探针 45 计数的既有断言，验证注册表重构等价） |
| `npm run --silent typecheck` | exit `0` |
| `npm run --silent lint:security` | exit `0`，新增发现 `0`（baseline 未改） |

新测试覆盖（`check-samples-coverage.test.ts`）：未知门禁 / 重复登记 / 缺列 / 未知机制 / 文字型伪证据 /
行号越界 / **门禁 stub 不实现 exit-2 契约 → `negative-coverage-probe-failed`**（探针真执行的反向证明）/
正例（探针数 2、失败 0）。既有「invocation 行不校验路径」的正例已按新契约改写为**指向真实测试文件行号**。

## 设计决策与偏差（显式登记）

1. **探针命令与输入来自共享注册表，而非登记册行内新增列**。计划步骤 3 写「由清单解析出命令和输入」；
   落地为「登记册决定**哪些**门禁必须被探针证明（缺登记 → missing），注册表按门禁名提供**命令与输入**」。
   理由：把 47 条探针参数抄进 Markdown 会与中心探针形成第三份副本，正是本任务要消灭的漂移源；
   注册表现已是唯一事实源并被两个门禁共用。
2. **探针 cwd 为隔离探针根（非仓库根）**，故部分门禁的 exit 2 归因是「隔离根缺输入」而非「未知 flag」。
   实测 45 门禁中 44 个用基础探针在空隔离根即 exit 2（`ARG_INVALID`/`FILE_NOT_FOUND`/`FILE_READ`），
   `wm-status` 需注册表的专用 fixture（损坏 `project.json`）——「未知 flag → exit 2」这条契约由
   `check-docs-consistency` 的中心探针（cwd=仓库根）独立覆盖，两条证据互补而非重复。
3. **成本**：门禁从 <1s 增至 `68.7s`（pre-push 第 15 项 +47 次串行子进程）。计划要求串行执行，
   未并行化；该成本已在本报告与登记册表头明示，供维护者决定是否接受。
4. **探针根漂移只覆盖探针根，不覆盖仓库工作树**：本门禁不写仓库，仓库侧原子性由
   `exit2-failure-atomicity.test.ts` 的 sha256 快照负责（两条证据分工，见 task-7 报告第 3 条偏差）。

## 未完成项

无（本任务 5 个步骤全部落地）。遗留观察：`fixture` 行的 `（self-test.ts:<行>）` 备注为描述性文本，
不参与行号校验（计划步骤 2 只要求 `invocation` / `mutated-copy` 校验行号）——如需覆盖需另立判据。

## 独立复审（task-6-7-review.md）与修复

独立 V 复审范围 `fd387daa..b0d87ec1`，结论 **NEEDS_FIXES**，命中的是**本任务自身造成**的一处缺陷：

- **I-1（已修）**：我先把 `check-pollution` 行从 `:212/:216` 校正为 `:222/:226`（当时确实指向 exit-2 断言），
  随后又在**同一提交**里给 `check-pollution-cli.test.ts` 顶部插入了 6 行（`env` 参数 + locale 用例），
  于是 `:222/:226` 变成 eslint 注释与调用行，真实断言漂到 `:228/:232`。本报告原先写的
  「逐行核对后才改」在写下时成立、却被我自己的后续改动作废——**这正是本任务要消灭的那类
  「引用看似有效但指向错处」**。已重定为 `:228`（exit 2）与 `:232`（快照相等）。
- **I-2（已修，既有）**：另两行同样是错引用，且早于本轮：`check-samples-coverage.test.ts:228` → 实际
  `:387`（`:228` 是 `fs.mkdir`）；`docs-consistency-logic.test.ts:2347` → 实际 `:2352`（`:2347` 是 `});`）。
- **MINOR（已修）**：`exit2-failure-atomicity.test.ts` 的断言在 `:291`（跨行 `expect(` 起于 `:288`），
  doctor / wm-verify 两行原写 `:290` → 已改为 `:291`（循环 `:273` 描述不变）。
- **机制局限（已如实写入登记册表头）**：门禁只校验「文件存在 + 行号在 1..总行数内」，
  **行号语义正确性不在门禁能力内**；同一次改动在文件上方插入若干行即可让引用「仍在范围内但指向错处」
  而门禁保持全绿。复审据此把「引用片段级比对」列为未实现的加固方向（未在本轮实现）。
- 复审未运行任何 vitest / self-test / prepush（其运行时本工作树正有 prepush 在跑，单次 gate 已观察到
  约 5 倍放大），故上述测试终态仍为本报告的观测而非复审的观测——已在两处报告中各自标明。

