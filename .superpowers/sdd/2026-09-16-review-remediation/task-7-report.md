# Task 7 报告：文档一致性、测试矩阵与确定性缺口

## 范围与结果

基线 `fd387daa`。写集：`logic/docs-consistency-logic.ts`、`cli/check-docs-consistency.ts`、
`cli/check-pollution.ts`、`cli/self-test.ts`（一处用例文案）、`__tests__/docs-consistency-logic.test.ts`、
`__tests__/check-pollution-cli.test.ts`、`__tests__/gate-test-evidence.test.ts`、
`__tests__/README.md`、`references/data-models.md`、`AGENTS.md`、`CONTRIBUTING.md`。

| 步骤 | 状态 | 证据 |
| --- | --- | --- |
| 1 AGENTS §8 精确表格匹配 | 完成 | `checkAgentsNavCoverage` 改为解析 `## 8.` 到下一 H2 之间的表格行首单元格，精确名匹配（`<基名>.ts` 或 `<基名>`）；新增 4 条用例（正文提及不算、相似前缀 `check-foo-bar.ts` 不算、§8 代码块不算、精确行通过）；实测 §8 表 46 行与 cli 46 脚本为**双射**，收紧后零违规 |
| 2 测试矩阵集合等价 | 完成 | 新增 `checkTestsMatrixCoverage`（双向差集 + 重复行），CLI 注入 `__tests__/README.md` 原文与在盘 `*.test.ts` 清单；补齐 **9 个**漏登文件（asset-budget / check-pollution-cli / exit2-failure-atomicity / gate-test-evidence / gate-ticket-content / l0-rule-loadbearing / pre-commit-hook / review-package-cli / safe-project-path），实测 `declared=90 = actual=90`，missing/orphan/dup 均为 0；新增 5 条用例 |
| 3 exit-2 原子性快照扩到完整仓库 | **未完成（显式偏差）** | 见下「偏差 1」 |
| 4 gate-test-evidence CLI 三态 | **部分完成** | 新增真实子进程组：业务违规（阶段层 `total>0` 缺 evidence）→ exit 1 且 reasons 含 `RTM 测试证据 E4: 系统测试 total=12>0 但缺 evidence`；输入错误（项目目录不存在）→ exit 2 且 stdout 为 `ERROR_JSON`。**exit 0 态未断言**（见「偏差 2」） |
| 5 pollution 排序 locale 无关 | 完成 | `entries.sort((a,b)=>a.name.localeCompare(b.name))` → 码元比较；新增用例用 `zebra.lock`/`Ärger.lock`/`Öffnung.lock`/`änderung.lock` 在 `LANG/LC_ALL` 取 `C`/`sv_SE`/`de_DE`/`zh_CN` 四组下断言 `POLLUTION_JSON` **逐字节一致**且顺序等于码元序 |
| 6 活体文档同步 | 完成 | 见下「发现并修复的既有文档漂移」 |

## 发现并修复的既有文档漂移（task 2B 未同步完的部分）

task 2B 删除了 M07/R10 的时间戳吸收路径，但活体文档仍描述已删除的行为，且无任何门禁能发现：

- `references/data-models.md` 三处：M07 段落的 `M07_TEST_EVIDENCE_CUTOFF` + `LEGACY_TEST_EVIDENCE` 吸收、
  `revertEvidence` 字段注释的 cutoff 吸收、整段「revertEvidence 回滚证伪强制与 cutoff 分界」
  （含 `LEGACY_REVERT_EVIDENCE_CUTOFF='2026-09-15T00:00:00Z'`）。已改写为严格语义，
  并按计划 §0.2.4 明示「`legacy` 恒为 0 = 没有时间戳豁免」，同时保留 `LEGACY_VARIANT_CUTOFF` 相关说明
  （那是**另一条仍在生效**的规则，未被删除，不得误删）。
- `AGENTS.md` §8 的 `check-run-log.ts` 行、`cli/self-test.ts:1422` 的用例文案同样还写着 cutoff 吸收，已改。
- 代码侧核对：`grep -rn "M07_TEST_EVIDENCE_CUTOFF|LEGACY_TEST_EVIDENCE|LEGACY_REVERT_EVIDENCE" --include=*.ts`
  在活体代码中零命中（仅测试断言「不得出现该 diagnostic」与历史计划）——文档与实现的不一致确为单侧漂移。

## 偏差（显式登记，未以「已完成」含混）

1. **步骤 3 未执行**：现有 `exit2-failure-atomicity.test.ts` 只快照 3 个门禁可写面
   （`samples/`、`coverage/`、`.w-model/`）+ git 污点单调口径，其 JSDoc 明确记录了「全仓快照对与本任务无关
   的并发工作树变动敏感，会引入抖动（本仓已有 vitest 抖动记录）」的设计裁定。把快照扩到完整仓库会把该
   已知抖动重新引入（pre-push 双 project 并发、审查期间他人提交都会假红），因此**未按步骤 3 执行**：
   保持现状（3 个可写面 sha256 相等 + 污点单调）并在本报告登记为未完成，交由后续裁定是否需要
   以「完整临时仓库副本」而非「真实仓库」为对象重做。本任务新增的探针根不变量（隔离 `mkdtemp` 根
   调用前后逐项相等）是另一条独立证据，不能替代表述步骤 3 已达成。
2. **步骤 4 只覆盖两态**：exit 0 态需要一份能通过阶段 8 全部外检（bdd-manifest、cucumber 报告、
   codegraph scope、opsx 制品等）的完整项目 fixture，仓库内不存在（`samples/gate/valid-rtm.json` 在
   `--phase=8` 下实测 exit 1）。纯函数的基线绿灯（「全绿 + 合法 evidence → passed」）已覆盖同一逻辑，
   故未为此新建整套项目 fixture，如实登记为部分完成。

## 真实命令结果

| 命令 | 结果 |
| --- | --- |
| `npx vitest run --config config/vitest.config.ts …/docs-consistency-logic.test.ts …/check-pollution-cli.test.ts` | `2 passed (2)`、`213 passed (213)`、exit `0`、`497.3s`（docs-consistency-logic 单文件 198 用例） |
| `npx vitest run --config config/vitest.config.ts …/gate-test-evidence.test.ts` | `23 passed (23)`，exit `0` |
| `npm run --silent typecheck` | exit `0` |
| `npm run --silent lint:security` | exit `0`，新增发现 `0` |
| `npm run --silent self-test` | `352 通过，0 失败`，exit `0`（含本轮 fixture 修复，见 task-8 报告） |
| `npx prettier … --check "w-model-dev/scripts/**/*.ts" "config/**/*.{cjs,ts}" "scripts/*.cjs"` | exit `0` |
