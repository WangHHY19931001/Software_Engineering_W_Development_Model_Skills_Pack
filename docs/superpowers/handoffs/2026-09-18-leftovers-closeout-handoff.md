# 交接文档：全部遗留事项收口程序（B/J1/N/O + 推送）

> 日期：2026-09-18 · 状态：**执行中**（供新会话接续；本文件不参与门禁）
> 权威规格：[docs/superpowers/specs/2026-09-18-leftovers-closeout-design.md](../specs/2026-09-18-leftovers-closeout-design.md)（已批准）
> 权威计划：[docs/superpowers/plans/2026-09-18-leftovers-closeout.md](../plans/2026-09-18-leftovers-closeout.md)（任务 1~3.5~10）
> 执行账本（**恢复先读**）：`.superpowers/sdd/2026-09-18-leftovers-closeout/progress.md`（gitignored，但文件在盘上；含全部裁定、每任务提交、延后 minor）
> 执行方法：superpowers **subagent-driven-development**（每任务一个新实现者 + 审查包 + 任务审查者 + 定向复审 + 账本）

## 0. 一句话状态

B（规则层覆盖门）任务 1/2 已完成并通过审查、任务 3 已提交待收口修复轮；J1/N/O 与任务 3.5 未开始；全部完成后跑全量 19 项 `npm run prepush` 并推送 main。

## 1. 用户既定约束（不可违反）

1. **全部任务完成的最终审查必须跑全量**：`npm run prepush`（届时 19 项），不得以 `test:affected` 快速车道作验收依据。
2. 收口后 **push origin/main**（main 当前领先 origin 多个提交，程序内所有提交一并推送）。
3. 行号寻址 → 唯一子串锚的改造（任务 3.5）为用户裁定插入项，范围已含全仓扫描结论。

## 2. 任务状态与下一步（按序）

### 任务 1 ✅ 完成（`d577c01e`，审查通过，4 minor 延后）
### 任务 2 ✅ 完成（`cb7d97ba` + 修复 `5514e64e`，复审通过，6 minor 延后）

### 任务 3 ⚠️ 已提交 `f0eec906`，审查「需要修复」→ 修复轮进行中
- **现状**：修复轮的 5 个文件改动**已在工作树但未提交**（`CONTRIBUTING.md`[13:07 由第二个修复代理写入]、`docs/skill-design-document_SSoT.md`、`scripts/test-affected.cjs`、`w-model-dev/scripts/samples/README.md`、`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`[12:17-12:18 由第一个修复代理写入]）。**两个修复代理先后僵死，改动可能不完整/未验证**——接续者必须按 §5 逐条核对内容正确性，不要假定已完成。另有本次会话写入的 `AGENTS.md`（§7 指针）与 `docs/superpowers/handoffs/`（本文件）同为未提交状态。
- **接续动作**：
  1. `git log --oneline -3` 与 `git status --short` 核实：是否已出现提交 `fix(prepush): close living-surface count drift and gate table for item 13 (review round 1)`。
  2. 若无：派 **fresh** 代理（`run_in_background: true`）按以下修复清单收尾（逐字发现见 §5「任务 3 审查发现」）——核实/修正 5 文件改动 → 跑 `npm run --silent check:docs-consistency` + `npx vitest run --config config/vitest.config.ts docs-consistency-logic` + `node --check scripts/test-affected.cjs` → prettier（markdown 不在仓内 prettier 面内）→ commit → 修复报告**追加**到 `task-3-report.md`。
  3. 无论谁提交：跑定向复审（`scripts/review-package PLAN f0eec906 <新HEAD>` + re-review 模板，逐字发现见 §5）→ 通过后在账本追加 `Task 3: fix round 1/5 …` 与 `Task 3: complete …`。

### 任务 3.5 ⬜ 未开始（简报已生成）
- 简报：`.superpowers/sdd/2026-09-18-leftovers-closeout/task-3.5-brief.md`（44 行，已含全仓扫描扩面）
- 范围：①`NEGATIVE-COVERAGE.md` 46 行 `文件:行号` → `文件#唯一子串锚`（锚=文件内恰出现一次）；②`lib/run-sync.ts` `SYNC_PROCESS_EXCEPTIONS` 10 条 `line: N` → `anchor`（测试改「文件含唯一锚且锚行含 runSync」）；③散文位置引用符号化（`__tests__/README.md:114` 的 `gate-logic.ts:240-248`、`data-models.md:563` 的 `run-log-logic.ts:23`）；④文档语法描述同步（AGENTS §8 行等）。
- 合法保留（不要改）：自产 fixture 行号（run-sync.test.ts 的 `fixtures/aliases.ts`）、verifier-spec/phase-5-coding 的领域示例、聚合计数基线（L0 675 等）、eval/mappings.json。

### 任务 4~9 ⬜ 未开始（J1 两个任务、N 两个任务、O 两个任务）
- 简报生成：`bash "C:\Users\wangh\.agents\skills\subagent-driven-development\scripts\task-brief" docs/superpowers/plans/2026-09-18-leftovers-closeout.md <N>`
- 要点速览：任务 4 = run-log R11 阻断规则 + 11 个 fixture 迁移 + 2 个新负向样本；任务 5 = 约束 #11 文档同步；任务 6 = 7 个 code-health CLI 语义审计表；任务 7 = 真实 git 端到端测试（helper 抽取 + `code-health-e2e.test.ts`）；任务 8 = 通用剥离 helper；任务 9 = 实测选覆盖率最低 5 个 logic 文件建 GREEN/RED/STRIPPED 三态。

### 任务 10 ⬜ 收口
- 计数终值同步（**含已知待办**：`.code-health-governance.json` 的 `selfTestSamples: 354` 与实测 356 不符；`README:31`（352）/`CONTRIBUTING:92`/`docs/user-guide.md:110` 亦各执一词——以 self-test 实测为准统一）
- CHANGELOG + 计划收尾记录（含窄口径实测 84.25/77.87/93.68/87.01 → 阈值 80/75/90/85 的出处）
- `npx tsx w-model-dev/scripts/cli/check-pollution.ts` → **`npm run prepush` 19/19 全绿（唯一验收依据）** → commit → `git push origin main`

### 最终宽范围审查 ⬜
- 全部任务后：`scripts/review-package PLAN <merge-base> HEAD` + requesting-code-review 的 code-reviewer 模板；把账本里的 `minor (deferred)`/`parked` 行交给它甄别。

## 3. 每任务标准闭环（SDD 配方）

1. `scripts/task-brief PLAN <N>` 生成简报；派实现者（**必须 `run_in_background: true`**），提示词含：一行定位 + 简报路径（"你的唯一需求来源"）+ 前序任务接口 + 控制者裁定 + 报告契约（完整报告写 `task-<N>-report.md`，回传 ≤15 行）。
2. **派发前记录 BASE**（`git rev-parse --short HEAD`）；实现者报告后用 `scripts/review-package PLAN <BASE> <HEAD>` 生成审查包，派任务审查者（简报+报告+diff 三路径 + 全局约束逐字）。
3. 审查有 Critical/Important → 修复循环（≤5 轮；1-3 轮唤回原实现者，4-5 轮 fresh+更强模型）；**每轮修复后必须定向复审**（`review-package PLAN <FIX_BASE> <HEAD>` + re-review 模板）。
4. minor → 账本 `minor (deferred)` 行，不进循环。
5. 审查干净 → 账本 `Task <N>: complete (commits <base7>..<head7>, review clean[, K minor deferred])` → 下一任务。

## 4. 环境坑与纪律（本会话实测教训）

1. **宿主看门狗会杀代理**：同步等待 10 分钟无活动即报错/杀。→ 一律 `run_in_background: true` 派发，用 `TaskOutput(block=true, timeout≤600000)` 轮询。
2. **僵死判别靠证据**：`git status` 文件新鲜度 + `Get-CimInstance Win32_Process` 查 node 进程 + 日志 mtime 增长。30 分钟无文件写入、无进程、无提交 = 僵死。
3. **fresh 接管 > resume**：resume 三次里两次僵死（大上下文代理逐步变慢/挂起）；fresh 接管（「前人完成 X 未提交，你审计接管」模式）两次全成功。
4. **绝不杀运行中的 vitest/prepush**：孤儿进程污染 `coverage/`，后续运行报「Something removed the coverage directory」；中断即 `rm -rf coverage` 再重跑。全量 vitest（含 coverage）实测约 29 分钟。
5. **pre-commit 钩子慢**（staged 格式 + 全项目 tsc），等它跑完；`git status` 出现 `.mimosa/` 未跟踪属工具产物。
6. Windows + Git Bash；测试命令 `npx vitest run --config config/vitest.config.ts <filter>`；型检 `npm run --silent typecheck`。
7. 每个 `task-<N>-brief.md` / `task-<N>-report.md` / `review-*.diff` 都在 `.superpowers/sdd/2026-09-18-leftovers-closeout/` 下。

## 5. 任务 3 审查发现（修复轮待办，逐字）

- **重要 1**：`CONTRIBUTING.md:92-109` 门禁表未随第 13 项同步——表仍 18 行，13=audit/14=docs-consistency/15=samples-coverage/16=prettier/17=tsc/18=eval，与 hook 的 19 项编号自 #13 起整体错位，且无 check-coverage-scope 行。修法：在 13 行插入 check-coverage-scope（参照 hook 的 run_expect 语义与退出码 0），原 13~18 顺延 14~19。**该表是 docs-consistency 盲区**（行内无「N 项」文本），oracle 全绿不能证明它对，须与 `.githooks/pre-push` 的 `# N.` 注释逐项比对。
- **重要 2**：活体面陈旧计数未清零——`docs/skill-design-document_SSoT.md:1348`（`不进 pre-push 18 项（prePushCount: 18 不变）`→19；其镜像三处已改）；`scripts/test-affected.cjs:8`（注释）与 `:210`（用户可见 console.log）「18 项」→19；`w-model-dev/scripts/samples/README.md:66`「第 15 项」→第 16 项。
- 次要不修（已入账本）：config 注释引用成环；docs-consistency-logic.test.ts:3443/3445/3466 fixture 串旧序号；`.code-health-governance.json` `selfTestSamples: 354`（并入任务 10）；报告净 +2/+3 措辞。

## 6. 关键数值备忘

| 项 | 值 |
| --- | --- |
| 窄口径（logic+lib）实测 | stmts 84.25-84.26 / branch 77.87-77.88 / funcs 93.68 / lines 87.01 |
| 第 13 项阈值（向下取整 5 的倍数） | 80 / 75 / 90 / 85 |
| 全分母参考（2026-09-17 实测） | 76.83 / 71.64 / 87.86 / 78.88 |
| pre-push 项数 | 19（第 13 项 = check-coverage-scope，第 14 = npm audit） |
| self-test 样本 | 356（任务 4/9 会再增，收口时同步文案） |
| exit-2 脚本 | 46（cli 47 个 .ts − self-test 聚合器）；探针 48 |

## 8. ⚠️ 环境变化：Mimosa 提交门禁（2026-09-18 14:43 起生效）

**新会话必须先处理这件事，否则无法产生任何提交。**

- 2026-09-18 14:43 起，工作区出现 **Mimosa 安全插件**（ZCode 插件，`.mimosa/` 状态目录；PreToolUse 钩子监听 Edit/Write 与 Bash）。
- 其 `git-gate-hook` 在 **`git commit`/`git push` 前执行 L3 全项目深度审计**；本仓触发 **317 高危 / 33 中危**（全部为**既有**内容：测试 fixture 的故意假凭据如 `evidence-export-logic.test.ts`、既有脚本模式如 `check-tla-model.ts`、`coverage-logic.test.ts` 等——与本次改动无关），**提交被强制拦截**。
- 实测：本会话的 docs 提交（交接文档 + AGENTS.md 指针）被拦；修复轮的 5 文件改动同样未提交。
- 官方文档给出的开关（payload/README.md:80-92）：`MIMOSA_NO_GIT_GATE=1` 关闭 git commit/push 前 L3 门；`MIMOSA_GIT_GATE_MODE=graded|ask|deny|warn`（默认 graded：high=强制拒绝、medium=询问）；`MIMOSA_GIT_GATE_FAILURE_MODE=open|strict` **只管扫描不完整时的行为，不能解除本次 high 拦截**；`MIMOSA_HOOK_BLOCK` 是**写入前**门禁模式、与 git 门无关。
- **⚠️ 更正（2026-09-18 15:1x 实测裁定）：「在插件设置里关闭」这条路不存在。** `payload/manifest.json` 顶层键仅 `schema/protection/files/integrity`（**无** `userConfig`/`options`/`settings`），`payload/.zcode-plugin/plugin.json` 只声明 MCP server 的 `env` —— 插件**没有任何可配置项暴露到面板**。故 `MIMOSA_NO_GIT_GATE` 等**只能作为宿主进程环境变量**设置：**在启动 ZCode 的环境里设变量 → 托盘完全退出（`closeToTrayOnWindows: true`，仅关窗不退进程）→ 重开 → 新建任务**。插件 README 亦称「安装、启停或修改插件选项后需要新建任务」。
- **第 0 步验证结果（2026-09-18 15:1x，失败）**：`git commit --dry-run -m probe` 被 PreToolUse(Bash) hook 拦下（两次重复），返回「Mimosa L3 在 commit 前发现 317 个高危、33 个中危，最高等级 high …… 高危已强制拦截」，被拦的 Bash 调用**未执行**。→ 按 §8 末句**停止并回报用户**，未采取任何绕过。
- **用户裁定（2026-09-18，已确认）**：**新会话先关闭/降级 Git 门禁**（`MIMOSA_NO_GIT_GATE=1` 宿主环境变量；变更后新建任务生效），随后照常提交；317 个既有发现与仓内 eslint-security baseline 的对账**另立独立事项**，不混入本收口程序。新会话的**第 0 步**：确认门禁已关（试 `git commit --dry-run`），若仍被拦则停下找用户。
- 当前**未提交**内容（在新会话按上述裁定处理）：`docs/superpowers/handoffs/2026-09-18-leftovers-closeout-handoff.md`（本文件）、`AGENTS.md`（§7 指针）、以及修复轮的 5 文件（`CONTRIBUTING.md`、`docs/skill-design-document_SSoT.md`、`scripts/test-affected.cjs`、`w-model-dev/scripts/samples/README.md`、`w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`）。

## 9. 新会话开场建议

> **独立运行 `npm run check:docs-consistency` 的坑（2026-09-18 实测）**：不带 `WM_VITEST_COUNT_FILE` 时会走「自采集」路径（内部跑一遍全量 vitest，上限 `VITEST_SPAWN_TIMEOUT_MS = 1800s`）。本次实测该运行 **静态 0 违规、2 条动态违规全是 fact 采集类**（`[vitest-tests] … 无法采集（fail-closed）`，dynamicMeasurements 里 testFileCount/vitestTestCount = -1）——**不是文档漂移**，是自采集未成功。且全量套件已增至 **2184 用例 / 实测 1745s**（常量注释仍按 1904 用例 / 975-1060s 设余量）——**30 分钟上限余量已近耗尽**，这条自采集路径随时可能开始超时（prepush 走 env 快路径不受影响）。判定文档一致性请用 prepush 第 15 项，或以 vitest `--reporter=json --outputFile` 产物导出 `WM_VITEST_COUNT_FILE`/`WM_VITEST_PROVENANCE_FILE` 后运行。

**可粘贴的开场语**（前提：已按 §8 更正后的方法设好 `MIMOSA_NO_GIT_GATE=1` 宿主环境变量并重启 + 新建任务）：

```
读 docs/superpowers/handoffs/2026-09-18-leftovers-closeout-handoff.md 与
.superpowers/sdd/2026-09-18-leftovers-closeout/progress.md，按其中「任务 3 修复轮收尾」继续
subagent-driven 执行，然后依次做任务 3.5 → 4 → … → 10，最终跑全量 19 项 prepush 并推送 main。
已确认：Mimosa Git 门禁已在插件设置关闭/降级（第 0 步先验证），317 既有发现对账另立事项。
```

**第 0 步验证**（做完再动其他）：先试 `git commit --dry-run` 确认门禁确已解除（**仅在插件面板里找开关是找不到的**——见 §8 更正；必须设宿主环境变量 + 托盘退出 + 重开 + 新建任务）。若仍被拦 → 停止并回报用户，不要绕过。门禁解除后按 §3「接续动作」直接 commit 修复轮（其 5 文件内容已于 15:1x 核验通过：`node --check` 通过、`docs-consistency-logic` 206 passed、独立 docs-consistency **静态 0 违规**、CONTRIBUTING 门禁表 19 行与 hook `# 1.`..`# 19.` 逐项对齐）→ 定向复审 → 任务 3.5。

**并发告警**：上一会话 `sess_c958b1a9` 在 15:15:05–15:15:15 仍在写本文件与 `progress.md`。恢复前先确认没有第二个会话在跑同一程序，避免双写 / 双提交。
