# 留档项-2（archival-fixes 最终审查 Minor）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 关闭 archival-fixes 战役最终审查留档的 4 条 Minor（含账本延后项 #1/#2 的实体部分），版本保持 42.2.1，零残留。

**架构：** 单任务三提交：① 代码/测试（A 透传必填 + 断言、B 注释 0-99、D l0 注释精度）；② CHANGELOG 散文句（C）；③ 台账收尾（追加①②提交行 + 范围句顺延）。全部在 `.worktrees/archival-fixes-2`（分支 `task/archival-fixes-2`）由一个全新实现子代理完成。

**技术栈：** TypeScript（tsx）、Vitest（`config/vitest.config.ts`）、Markdown 台账。

**规格来源：** archival-fixes 最终审查报告（4 条 Minor，审查者已给出明确修法）——本计划即处置设计，不另立 spec。

**全局纪律：** 工作目录 = worktree 根；npm install 已完成；版本 42.2.1 不 bump；`.superpowers/` 不提交；`.w-model/` 落盘不提交（codegraph unindexed fallback，changeId=`phase5-archivalfix2`）；V/G 失败走完整 R 链；flake 只隔离 3× 重跑；完成后独立审查 clean 才本地 ff 合并，不推送。

---

### 任务 1：四条 Minor 处置（三提交）

**文件：**
- 修改：`w-model-dev/scripts/lib/change-scope.ts`（A：`ResolvedCliScope` violations 变体的 `attemptedChangeId` 去掉 `?` 改必填；4 个 violations 返回点 :401/:430/:440/:444-446 已全部赋值，typecheck 应直接通过）
- 修改：`w-model-dev/scripts/__tests__/change-scope.test.ts`（A：新增一条 in-process 用例——薄封装 violations 结果（如 `--change=reviewfix` 无前缀）断言 `attemptedChangeId === 'reviewfix'`，锁住 resolveCliScope 层透传）
- 修改：`w-model-dev/scripts/cli/check-openspec-archive.ts:197`（B：注释「1-99 实际判非法」→「0-99 实际判非法（年份 0000 同样被拒）」）
- 修改：`w-model-dev/scripts/logic/l0-link-audit-logic.ts:66`（D：注释精度——现句「目标遇 ) 或空白即终止」对非 title 形态不严格（`[^)]+` 捕获可含空白，仅 title 形态遇引号/空白截断）；改为如实两句：行内非 title 形态捕获可含空白（非 CommonMark 级解析的已知近似）；title 形态遇引号或空白截断；URL 含 `)` 即终止）
- 修改：`CHANGELOG.md`（C：「留档项 13 项处置索引」段中「父链追加行覆盖本战役任务 1/2 已存在提交」类散文句改为如实表述「覆盖 548e43a..09b47e4 全部 first-parent 提交（4 行，含战役前规格与计划提交）」；grep 确认验收记录无同句需同步）
- 修改：`CHANGELOG.md` + `docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md`（台账收尾：追加①②提交行到两份台账父链表末尾——40 位小写 SHA、subject 逐字、按时间序、无 tip 自引用；范围句终点顺延至②提交；补一句本批次 4 项处置说明指向本计划文档）

- [ ] **步骤 1：codegraph 落盘**——对本任务将改的每个 `.ts`（change-scope.ts、check-openspec-archive.ts、l0-link-audit-logic.ts、change-scope.test.ts）做影响分析并落盘 `.w-model/codegraph-queries/phase5-archivalfix2-<symbol>.json`（querySymbol/callers/callees/blastRadius/queryTimestamp 真实时间/changeId/targetFiles 覆盖全部将改 .ts/note 注明 unindexed fallback）。
- [ ] **步骤 2：TDD（A）**——先写步骤 A 的新断言用例并运行（对现实现应即绿：字段已赋值；如实记录「无红阶段：断言锁住既有行为」。随后做必填化修改并跑 `npm run typecheck` 确认 4 返回点无编译错误；若 typecheck 红说明存在未赋值返回点，如实上报 NEEDS_CONTEXT 而非擅自补语义）。
- [ ] **步骤 3：B 与 D 注释修改**（读码核对 D 的新注释与正则实际行为逐句相符）。
- [ ] **步骤 4：定向回归**——`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/change-scope.test.ts w-model-dev/scripts/__tests__/check-openspec-archive.test.ts w-model-dev/scripts/__tests__/l0-link-audit-logic.test.ts` 全绿；`npm run typecheck` 0 错误。
- [ ] **步骤 5：Commit ①**——`git add w-model-dev/scripts && git commit -m "fix(scripts): require attemptedChangeId on scope violations; sharpen two comments"`
- [ ] **步骤 6：C**——读 CHANGELOG「留档项 13 项处置索引」段定位散文句，改为如实覆盖表述；grep 验收记录确认无同句。
- [ ] **步骤 7：Commit ②**——`git add CHANGELOG.md && git commit -m "docs(changes): correct archival index prose to actual ledger coverage"`
- [ ] **步骤 8：台账收尾**——`git log --first-parent --reverse --format='%H %s' c3636a3..HEAD` 追加两行到两份台账父链表末尾（行式与既有逐字一致）；范围句终点由 09b47e4 顺延至②提交 SHA；补处置说明句（指向 `docs/superpowers/plans/2026-09-04-archival-fixes-2.md`）；脚本化逐对校验链条连续、无自引用（本提交 SHA 不得出现）、subject 逐字。
- [ ] **步骤 9：Commit ③**——`git add CHANGELOG.md docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md && git commit -m "docs(changes): append archival-fixes-2 ledger rows (close 4 filed minors)"`
- [ ] **步骤 10：收尾验证**——`npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` exit 0（受控 vitest 瞬态按隔离重跑处理）；`npm run self-test` 262/262；报告留存全部输出。

## 收尾（控制者执行）

1. 全量回归：vitest 全量、self-test、eval、typecheck、lint:security、docs-consistency、samples-coverage、audit:l0-links、doctor、npm audit；`npm run prepush` 17 项全绿。
2. 独立审查（范围 `c3636a3..tip`）：0 Critical / 0 Important；4 项处置逐条可追溯（台账逐对校验）。
3. 审查 clean 后本地 ff 合并 main、清理 worktree 与分支；不推送。

## 范围外

版本 bump、依赖升级、push 远端、`__tests__/README.md:23` 缩写补 provided（最终审查裁定无需动）、既往已裁定无需动项的重开。
