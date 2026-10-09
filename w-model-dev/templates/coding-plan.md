# <changeId> 编码计划

> superpowers 编码链（S-plan → S-coding → V → G）的**编码计划制品**模板（阶段 5-8）。套用时替换 `<...>` 占位符。
> 消费门禁：`check-coding-plan.ts`（R1-R6，规则原文见 [coding-plan-logic.ts](../scripts/logic/coding-plan-logic.ts) 头注）；阶段 5-8 由 `check-artifact-gate.ts --scope=<change-scope.json>` 聚合。
> 方法论与角色边界见 [superpowers-adoption.md](../references/superpowers-adoption.md) 与 [phase-5-coding.md](../references/phase-5-coding.md)；本模板自身满足 R1-R6 文法（标题/目标节/任务节/验证命令行均按 `parsePlanStructure` 判据书写），可作为 S-plan 的最小文法示范。

## 目标

<一句话陈述本变更达成什么、完成判据是什么；「目标」节为 R2 必需结构标记（标题含「目标」即计，「非目标」节不充数）>

- 变更标识：`<changeId>`（须含 `phase<phase>-` 前缀，R1 阶段归属一致性）
- 影响半径：<codegraph 修改前影响分析结论摘要（callers/callees/blast radius），查询落盘 `.w-model/codegraph-queries/`（约束 #14）>

## Task 1: <任务名>

<任务做什么：改动点、符号级契约、触达文件；S-coding 只按任务节实施（反模式 #39/#40）>

验证：npx vitest run --config config/vitest.config.ts <test 文件路径>

> 验证命令行文法（R2）：行首（允许前置空白）为「验证：」/「Verify:」（全半角冒号均接受），命令体非空且禁 `;` / `&` / `|`；**每个任务节至少 1 行**。

## Task 2: <任务名>

<任务做什么；无后续任务时可删除本节——任务节数量 ≥1 即满足 R2>

验证：npx vitest run --config config/vitest.config.ts

> 收口前全量：`npm run prepush`（20 项）；迭代期快速车道边界见 README「验证仓库」节。

## 执行账本（R3）

账本落盘 `.superpowers/sdd/<changeId>.plan/progress.md`（目录名 = plan 文件名去扩展名），最小文法：

```text
# SDD ledger — plan: docs/plans/<changeId>.plan.md
Task 1: complete
Task 2: complete
```

- 首行身份严格取**文件第一行**（前导空行不回退），`# SDD ledger — plan: ` 前缀后的路径须以 `<changeId>.plan.md` 结尾；
- `Task N: complete` 须逐任务具名覆盖本计划全部任务节（覆盖数 < 任务节数即违规，缺哪号具名到哪号）；
- 由 S 子代理按任务进度回填，编排者不得代写（编排者最小化）。

## 任务三件套（R4）

每个已完成任务 N 在账本目录（`.superpowers/sdd/<changeId>.plan/`）随附**非空**三件套 + 评审包 diff：

- `task-<N>-brief.md`：任务简报（分派给 S 子代理的输入）；
- `task-<N>-report.md`：任务报告（S 子代理产出）；
- `review-<...>.diff`：任务评审包（账本目录内至少 1 个，`review-package.ts` 产出）。

## 审查产物（R5）

编码链三 stage 审查产物须齐备（**非空且为普通文件（`isFile()` 且 `size > 0`）——判定细则见 [`command-reference.md`](../references/command-reference.md) check-coding-plan 条目**，与 phase 级 preventive 双轨互不替代）：

- **stage 级 12 份 MD**（`check-coding-plan.ts` R5，strict 绑定 changeId）：
  - `.w-model/r3-reviews/phase<phase>-<stage>-<dim>.md` ×9（stage ∈ plan / execute / finalize；dim ∈ completeness / reliability / security）；
  - `.w-model/v-reviews/phase<phase>-<stage>.md` ×3。
  - 每份须**非空且为普通文件**（0 字节或非普通文件即使文件存在也判违规 exit 1；判定细则见 [`command-reference.md`](../references/command-reference.md) check-coding-plan 条目）；**建议**含行级证据锚 `path:Lnn=` / `path:Lnn-mm=` / `path:§sec=`（行首起）——锚只是 CLI stderr 的非阻断诊断，不构成判据。
- **phase 级三份 JSON**（`check-preventive-review.ts`，schema `preventive-review.schema.json`）：`.w-model/preventive-reviews/<phase>-{completeness,reliability,security}.json`（S-fix / emergency / ingest 变体走 `-fix-` / `-emergency-` / `-ingest-` 路径）。stage 级 MD 证「每段审查跑过」，phase 级 JSON 证「三维度结论与 findings（`passed=false ⇒ findings ≥1`）」——二者互不替代。
- **产出前对齐**：`check-coding-plan.ts <project-root> --phase=<5|6|7|8> --scope=<change-scope.json> --preflight` 只读列出固定 14 项清单（9 R3 + 3 V + plan + 账本）与 missing/invalid；变长任务三件套 / `review-*.diff` 单列 `artifacts` 不计数（缺失即 exit 1，不改 R5 判据）。

## 归档快照（R6）

阶段收口归档到 `docs/changes/archive/<YYYY-MM-DD>-<changeId>/`（或 `docs/changes/archive/<changeId>/`；目录名锚定匹配须**恰一**，多匹配 fail-closed），快照须含：

- `<changeId>.plan.md`（本文件快照）；
- `progress.md`（账本快照）；
- 任务三件套（`task-<N>-{brief,report}.md`）与 `review-*.diff`。

活动位 `docs/plans/<changeId>.plan.md` 存在时永远优先；归档态按同契约校验，快照缺失即 fail-closed。
