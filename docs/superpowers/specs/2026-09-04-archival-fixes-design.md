# 留档项全量处理设计（保持 42.2.1）

- 日期：2026-09-04
- 状态：方案与四节设计已展示（用户未应答，按批准继续——与 close-outstanding 集成问题的处理一致，最终汇报注明）
- 基线：`548e43a`（上一场战役结束点，main ahead 137）
- 处理对象：13 条留档项 = 最终独立审查 2 条 parked Minor（P1/P2）+ 账本 11 条延后 Minor（D1-D11）
- 后续实现计划：`docs/superpowers/plans/2026-09-04-archival-fixes.md`（由 writing-plans 产出）

## 1. 范围与不可变约束

13 条留档项逐项处置、全部关闭、零残留。约束沿用：版本保持 **42.2.1**（不 bump）；不推送远端；所有 tracked 修改在 worktree（`.worktrees/archival-fixes`，分支 `task/archival-fixes`）由实现子代理完成；`.superpowers/` 不提交；V/G 失败走完整 R 链（`V/G → R → V 复审 → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT`，禁止直接返工 bypass）；已知负载敏感 flake 只隔离 3× 重跑并如实记录；完成后独立审查 clean（0 Critical / 0 Important）才本地 fast-forward 合并；**不推送**。

阶段 5-8 纪律：切片 1 触碰 `w-model-dev/scripts/**/*.ts`，编辑前 codegraph 查询并落盘 `.w-model/codegraph-queries/`（本环境无 .codegraph 索引，沿用 unindexed fallback 记录形态，changeId=`phase5-archivalfix1`，真实时间戳，targetFiles 覆盖全部将改 .ts 文件）。

## 2. 逐项处置设计

### 2.1 代码/测试（切片 1，5 项）

| # | 位置 | 修复 | 测试 |
|---|---|---|---|
| P2 | `w-model-dev/scripts/cli/check-openspec-archive.ts:59` 注释 | 「年 1-9999」→「年 100-9999」并注明 Date.UTC 对 0-99 年按 1900+ 处理（回读校验使 1-99 实际判非法） | 注释级，无新断言；既有 `2026-02-30` 负例保持红绿 |
| D1 | `w-model-dev/scripts/cli/check-artifact-gate.ts` `aggregateExternalChecks` 的 scopeProvidedButFailed 分支 | 形态由 `{provided:false, changeId:null, ...}` 改为 `{provided:true, changeId:<attempted changeId>, violationCount:n, passed:false}`；JSDoc 补「provided=true 含提供后被 Git 绑定拒绝」；与「provided=false=未提供」语义对齐 | `artifact-gate-external.test.ts` 新增该分支用例：断言 provided:true、changeId 透传、passed:false、reasons 含 `[scope]`；更新既有 E2/E4 中引用旧形态的断言 |
| D2 | 薄封装 `--change/--base/--head` 的 exit-2 契约 | 补真实 CLI 子进程用例（复用 `check-codegraph-queries.test.ts` 既有 `runCli` 模式）：`--change=reviewfix`（无 `phaseN-` 前缀）spawn 真实 `npx tsx check-codegraph-queries.ts ... --phase=5 --change=reviewfix`，断言 exit 2 + stdout ERROR_JSON（category=ARG_INVALID） | 同上 |
| D3 | `w-model-dev/scripts/cli/check-docs-consistency.ts:117` `git diff --name-only HEAD` | 前插 `-c core.quotePath=false`（与 change-scope.ts I-1 同款）；**若该 execSync 行在 `run-sync.ts` SYNC_PROCESS_EXCEPTIONS 注册且行号移位，同步 manifest**（以该文件既有执行结果为准，行号由实现者读文件核实） | 无新增断言（ASCII 仓库行为等同）；docs-consistency 回归兜底 |
| D4 | `w-model-dev/scripts/logic/l0-link-audit-logic.ts:67-71` 注释 | 新增句「目标遇 `)` 或空白即终止，与行内链接同属已知近似」 | 注释级，无新断言 |

### 2.2 文档（切片 2，7 项）

| # | 位置 | 修复 |
|---|---|---|
| P1 | `docs/skill-design-document_SSoT.md:1339` + `w-model-dev/references/command-reference.md`（Artifact Gate 节） | GATE_JSON external 字段清单补 `provided: boolean`（及 `changeId: string \| null`，若清单未含 null 联合） |
| D5 | `w-model-dev/scripts/__tests__/l0-link-audit-logic.test.ts:183` fixture | `[empty][docs]` 改为简报原意 shortcut 形态 `[docs][]`（语义等价，纯对齐） |
| D6 | `AGENTS.md:51` | remote 枚举命令补 `--pretty=format:`（与其余五处逐字一致） |
| D7 | `w-model-dev/references/data-models.md:258` | 补「阶段 5-8 另须 `--scope=<change-scope.json>`」 |
| D8 | `w-model-dev/schemas/run-log.schema.json` variant/blocker 追加句 | 结尾统一为全角「。」（JSON 合法性不受影响，改后以 schema 校验测试回归） |
| D9 | `docs/user-guide.md:120` | 旧 audit 句改写为与 README/AGENTS/CONTRIBUTING 三处同款扩展句式（瞬态信号枚举 + JSON/权限错误仍阻断） |
| D10 | `CHANGELOG.md:32` | 「父链表现连续覆盖」→「父链表现已连续覆盖」 |

### 2.3 台账收尾（切片 3，D11，最后一提交）

- 追加切片 1/2 产生的 commit 行到两份台账（CHANGELOG.md 与验收记录）父链表末尾：40 字符小写 SHA、subject 逐字、按时间序、无 tip 自引用。
- 刷新「本轮提交身份」表前注与范围限定句：与「父链连续覆盖至合并前 tip 父提交」一致（本追加提交自身按规则不入链）。
- 补一段「2026-09-04 留档项 13 项处置」索引说明：P1/P2/D1-D9/D10 已修复、D11 即本段，指向规格 `docs/superpowers/specs/2026-09-04-archival-fixes-design.md`。
- 验收：逐对 parent-lookup 链条连续、无自引用、subject 逐字与 `git log --format='%s'` 一致。

## 3. 切片划分与流程

| 切片 | 内容 | 主要触点 |
|---|---|---|
| S1 代码/测试 | P2、D1、D2、D3、D4 | check-openspec-archive.ts、check-artifact-gate.ts、check-codegraph-queries.test.ts、check-docs-consistency.ts、run-sync.ts（如行号移位）、l0-link-audit-logic.ts、artifact-gate-external.test.ts + codegraph 落盘 |
| S2 文档 | P1、D5、D6、D7、D8、D9、D10 | SSoT、command-reference、l0 测试、AGENTS.md、data-models.md、run-log.schema.json、user-guide.md、CHANGELOG.md |
| S3 台账收尾 | D11（最后一提交） | CHANGELOG.md、验收记录 |

每切片：全新实现子代理（S1 先 codegraph 落盘再编辑）→ 切片独立审查（规格+质量）→ 修复轮（resume 1-3、更强 4-5，上限 5）→ 定向复审。S1 完成后 S2/S3 无 codegraph 义务。

## 4. 验收矩阵

按顺序执行并留存真实退出码：

1. **定向负例/正例**：D1 分支用例先红后绿（修复前进旧形态/缺测试红，修复后绿）；D2 CLI exit-2 用例先红后绿（修复前无该断言——以「新增用例先跑确认旧实现行为与断言不符」为 RED 或如实记录无红阶段）；D3 若行号移位则 run-sync manifest 与测试同步后 docs-consistency 绿。
2. **全量回归**：`npx vitest run --config config/vitest.config.ts` 全绿；`npm run self-test` 262/262；`npm run eval` 25/25。
3. **静态与契约**：typecheck、lint:security、docs-consistency、samples-coverage、audit:l0-links（649/92/36 不变）、doctor、`npm audit --audit-level=high`。
4. **pre-push**：`npm run prepush`（Git Bash）17 项全绿；flake 只隔离 3× 重跑。
5. **最终独立审查**：范围 `548e43a..task/archival-fixes tip` 全部提交；0 Critical / 0 Important；13 项处置逐条可追溯（含 D11 台账逐对校验）。
6. **集成**：本地 fast-forward 合并 main；清理 worktree 与分支；**不推送**。

## 5. 范围外（本轮不做）

版本 bump、依赖升级、push 远端、往 `check-docs-consistency.ts` 之外继续扩散 quotePath、`-z` NUL 解析重构、metrics/status 查询语义变更、.w-model/.superpowers 入库。
