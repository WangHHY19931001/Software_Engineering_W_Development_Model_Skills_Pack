# Task 4 报告：治理收口与终验

日期：2026-09-07
Campaign：gate-count-stale-scan
基线 HEAD：de1e258
最终 HEAD：3157e75
状态：DONE_WITH_CONCERNS

## 文件改动

- `docs/skill-design-document_SSoT.md`
  - 在本地 pre-push 推送范围判定段之后新增机制说明。
  - 明确 `docs-consistency` 的 `gate-count-docs` 扫描 README.md、AGENTS.md、CONTRIBUTING.md、docs/troubleshooting.md 四份活体文档。
  - 明确行含「门禁/检查」标记时全部「N 项」引用绑定 `EXPECTED.prePushCount`；「第 N 项」下标和 CHANGELOG*/docs/changes/docs/superpowers 历史目录排除。
  - 记录 `gate-count-stale-scan，2026-09-07`。

- `CHANGELOG.md`
  - 在 42.2.1 当前版本区域、`trigger-boundary-fastfollow` 之后新增「门禁项数 STALE 扫描（gate-count-stale-scan，2026-09-07）」小节。
  - 记录新增白名单扫描、规格/计划指针及版本保持 42.2.1；未改 dated historical entries。

- `eval/w-model-dev-results.tsv`
  - 追加 2026-09-07T18:04 的 `gate-count-stale-scan` 记录。
  - `old_score` / `new_score` 均为 `-`，`eval_mode=dry_run`，commit 字段引用首笔治理提交 `140f795`。

## 提交

1. `140f795` — `docs: record gate-count stale scan governance (SSoT + CHANGELOG)`
   - 修改 SSoT 与 CHANGELOG。
2. `cdedbd0` — `docs(eval): record gate-count stale scan round in results tsv`
   - 单独修改 TSV 一行。
3. `7081d2c` — `docs(plans): include required sync manifest drift repair in Task 4`
   - 修订 Task 4 计划，纳入审计清单行号漂移修复范围。
4. `3157e75` — `fix(test): sync run-sync exception line numbers after fixture import`
   - 将 `SYNC_PROCESS_EXCEPTIONS` 中 docs-consistency fixture 的 8 个行号同步到真实源码；完成终验修复。

## TSV 核验

使用 Node.js 对 `eval/w-model-dev-results.tsv` 的非空行逐行按 tab 分列：

- 总行数：40（含表头）。
- 表头：9 列。
- 数据行：39 行，全部为 9 列。
- 异常行：0。
- 新增记录 9 列字段符合要求，未伪造分数。
- `git diff --check`：通过。

## 终验命令

### 初次终验（修复前）

以下 `npm run prepush` 失败证据保留为修复前的历史终验记录；失败根因和修复后通过结果见下方「修复报告：审计清单行号漂移」。

### `npm run format`

真实退出码：0。

Prettier 对脚本、配置和 setup 脚本逐项执行，输出均为 `unchanged`。命令输出包含既有 npm warning，原样记录如下：

`npm warn Unknown user config "home". This will stop working in the next major version of npm.`

该 warning 未作为通过依据。

### `npm run prepush`

真实退出码：1，未达到要求的 18 项全绿/exit 0，因此整体状态为 BLOCKED。

已真实启动 `bash .githooks/pre-push --force`。平台依赖检查通过，前 11 个门禁通过：

- self-test
- check:verifier 无参数
- check:gate 不存在目录
- check:verifier 有效样本
- check:verifier 无效样本
- security-scan
- check-bdd-model 有效样本
- check-bdd-model schema 不合规样本
- check:coverage 有效样本
- check:exemption
- check-signature-chain

随后 Vitest + coverage 门禁失败，pre-push 在此处退出，未继续执行 npm audit、docs-consistency、samples coverage、prettier、tsc 和 eval 等后续门禁。失败摘要：

- `w-model-dev/scripts/__tests__/run-sync.test.ts`
- 19 tests：18 passed，1 failed
- 全量 direct `npm test` 复现：70 files，1608 tests；69 files/1607 tests passed，1 failed
- 失败测试：`audits every direct synchronous child-process call against the centralized exception manifest`
- 断言：`expected 2487 to be 2488`
- 位置：`run-sync.test.ts:403`
- 稳定复跑同一失败：定向 Vitest 仍为 exit 1。

根因证据：`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` 当前 `spawnSync('git', ['init'], ...)` 调用位于第 2488 行，而 `w-model-dev/scripts/lib/run-sync.ts` 的 `SYNC_PROCESS_EXCEPTIONS` 对应条目仍登记 `line: 2487`。该行号/集中异常清单漂移属于既有 Task 1-3 代码范围；本任务按约束未修改 Task 1-3 代码，也未伪造 prepush 通过。

所有 Vitest 输出中的既有 npm warning 均未作为通过依据：

- `npm warn Unknown user config "home"...`
- `npm warn Unknown env config "home"...`

### `npx tsx eval/runner.ts`

真实退出码：0。

输出：`eval: 60/60 通过`

### 最终 Git 状态

`git status --short`：无输出，工作树干净。

报告文件位于被 `.superpowers/sdd/.gitignore` 忽略的路径，不影响 Git 工作树状态。

## Concern

必须修正 `docs-consistency-logic.test.ts` 的 `spawnSync` 行号与 `SYNC_PROCESS_EXCEPTIONS` 清单之间的 1 行漂移，并重新运行完整 `npm run prepush`，直到 18 项真实 exit 0。当前不能声称 Task 4 完成或 pre-push 全绿；治理文件、两笔提交、TSV 和 eval 60/60 已完成且已核验。

---

# 修复报告：审计清单行号漂移

修复日期：2026-09-07
修复基线：7081d2c
修复范围：仅 `w-model-dev/scripts/lib/run-sync.ts` 的 `SYNC_PROCESS_EXCEPTIONS`，未修改 Task 1-3 代码、api、symbol、reason、timeout 或其他清单项。

## 根因

Task 3 在 `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` 顶部新增 `EXPECTED` import，使该测试文件中 8 个直接同步 child-process 调用整体下移 1 行；集中清单仍保留旧行号，导致 `run-sync.test.ts` 的行号契约断言失败。该问题是审计清单与真实源码的位置漂移，不是运行时逻辑问题。

8 个调用点的真实旧/新行号如下：

| 调用点 | 旧登记 | 真实新行号 |
|---|---:|---:|
| `withDocsConsistencyFixture git init` | 2487 | 2488 |
| `withDocsConsistencyFixture git config email` | 2490 | 2491 |
| `withDocsConsistencyFixture git config name` | 2496 | 2497 |
| `withDocsConsistencyFixture git config gpgSign` | 2499 | 2500 |
| `withDocsConsistencyFixture git add` | 2506 | 2507 |
| `withDocsConsistencyFixture git commit` | 2507 | 2508 |
| `fixtureCommitSha` | 2559 | 2560 |
| `runDocsConsistencyCli` | 2582 | 2583 |

## TDD 证据

### RED

命令：

```bash
npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-sync.test.ts -t "audits every direct synchronous child-process call against the centralized exception manifest"
```

真实结果：exit 1；19 tests 中 1 failed、18 skipped。核心失败输出：

```text
AssertionError: expected 2487 to be 2488 // Object.is equality
at w-model-dev/scripts/__tests__/run-sync.test.ts:403:31
```

同时输出既有 npm warning：`npm warn Unknown user config "home"...`，未作为通过依据。

### GREEN

同步 8 个 `line` 值后重跑同一命令，真实结果：exit 0；1 test file passed，1 test passed、18 skipped。

## 定向静态检查

- `npx prettier --write --config config/prettier.config.cjs w-model-dev/scripts/lib/run-sync.ts`：exit 0，输出 `run-sync.ts (unchanged)`。
- `npx tsc -p config/tsconfig.json --noEmit`：exit 0。
- `git diff --check`：通过；差异仅包含上述 8 个 `line` 值。

## 完整终验

### `npm run format`

真实 exit 0。所有格式化目标输出 `unchanged`。命令输出含既有 warning：

```text
npm warn Unknown user config "home". This will stop working in the next major version of npm.
```

该 warning 未作为通过依据。

### `npm run prepush`

真实 exit 0，18/18 项全部通过，输出结果如下。平台依赖只读检查也通过（`win32-x64`），不计入 18 项编号：

1. self-test：全部样本匹配期望（exit 0）。
2. check:verifier 无参数：exit 2，符合预期。
3. check:gate 不存在目录：exit 2，符合预期。
4. check:verifier 有效样本：exit 0。
5. check:verifier 无效样本：exit 1，符合预期。
6. security-scan：无新增风险（exit 0）。
7. check-bdd-model 有效 BDD 样本：exit 0。
8. check-bdd-model schema 不合规样本：exit 2，符合预期。
9. check:coverage 有效覆盖样本：exit 0。
10. check:exemption 有效豁免样本：exit 0。
11. check-signature-chain 有效签名链样本：exit 0。
12. Vitest 单元测试 + coverage 阈值：exit 0。
13. npm audit：未发现 high 以上漏洞，exit 0。
14. docs-consistency 活体文档一致：exit 0。
15. samples 覆盖矩阵一致：exit 0。
16. prettier 格式一致性：exit 0。
17. tsc 类型检查：exit 0。
18. eval 语料断言与覆盖矩阵全绿：exit 0。

pre-push 最终输出「全部门禁通过，允许推送」。期间出现既有 `npm warn Unknown user config "home"` warning，未作为通过依据；npm audit 本次真实通过，非网络跳过。

### `npx tsx eval/runner.ts`

真实 exit 0，输出：

```text
eval: 60/60 通过
```

### 最终 `git status --short`

修复提交前检查：仅 `w-model-dev/scripts/lib/run-sync.ts` 有修改；修复提交后再次核验：无输出，工作树干净。

## 修复提交

`3157e75` — `fix(test): sync run-sync exception line numbers after fixture import`

## 修复结论

行号契约已按真实源码同步，聚焦测试从 RED 转为 GREEN，完整 18 项 pre-push 和 60/60 eval 均已真实通过。此前的 codegraph concern 保持不变：仓库无 `.codegraph` 索引，本任务未重复调用 codegraph。

---

# 第 1 轮修复：报告元数据对账

修复日期：2026-09-07
修复范围：仅本报告 `task-4-report.md`，未修改代码、SSoT、CHANGELOG、TSV 或其他治理内容。

本轮将顶部元数据与报告正文已记录的最终结果对齐：

- `最终 HEAD`：`cdedbd0` → `3157e75`。
- `状态`：`BLOCKED` → `DONE_WITH_CONCERNS`。
- 提交列表补齐并按时间顺序列出 `7081d2c` 计划修订和 `3157e75` 终验修复；保留 `140f795` SSoT/CHANGELOG 提交与 `cdedbd0` TSV 提交的职责说明。
- 原第 55-104 行的失败证据保留，并新增「初次终验（修复前）」说明，明确其为历史记录。

本轮未重跑测试，因为仅修正报告元数据与提交列表。沿用报告中已核验的修复后结果：`npm run prepush` 真实 18/18、exit 0；`npx tsx eval/runner.ts` 输出 `eval: 60/60 通过`；最终 `git status --short` 无输出。

本轮报告修改后的工作树状态和提交信息见外部汇报；报告路径继续受 `.superpowers/sdd/.gitignore` 忽略。
