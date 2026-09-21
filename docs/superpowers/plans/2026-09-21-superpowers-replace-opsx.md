# superpowers 替换 OpenSpec（opsx）实施计划

> **面向 AI 代理的工作者：** 必需子技能：superpowers:subagent-driven-development 逐任务实现此计划。步骤使用复选框（`- [ ]`）跟踪。
> **依据规格：** `docs/superpowers/specs/2026-09-21-superpowers-replace-opsx-design.md` v1.0（已批准，四项默认：先收口修复分支 / vendor 进包 / 归档时快照 / 上游 v6.3.0 锚定）。
> **事实基线：** opsx 依赖面盘点（2026-09-21，Explore 代理产出）——本文锚点均来自该盘点，行号以实施当日的 `git grep` 复核为准。

**目标：** 阶段 5-8 的「规格级规划层」从 OpenSpec opsx 三段式（`openspec/changes/<changeId>/` 目录 + 两道制品门）切换为 superpowers 方法论链（writing-plans → SDD → TDD → code-review → finishing-branch）+ W-Model 自有「编码计划制品契约」，门禁改写而非删除；openspec 全部残留转 LEGACY 或退役。

**新制品契约（check-coding-plan.ts 的校验对象，阶段 5-8 门禁锚点）：**

| 制品 | 位置（项目根相对） | 门禁判据 |
|---|---|---|
| 编码计划 | `docs/plans/<changeId>.plan.md` | 存在；含目标节 + ≥1 个任务节；每个任务节含验证命令（`验证：`/`Verify:` 行，禁 `;`/`&`/`\|`/换行，与 RTM evidence command 同规）；changeId 须含 `phase<phase>-` 前缀（沿用） |
| 执行账本 | `.superpowers/sdd/<plan-基名>/progress.md` | 首行 `# SDD ledger — plan: <计划文件路径>`；`Task N: complete` 行数 ≥ plan 任务数 |
| 任务三件套 | `.superpowers/sdd/<plan-基名>/task-<N>-{brief,report}.md` + `review-*.diff` | 每个已完成任务 N 三件齐备且非空 |
| 审查产物 | `.w-model/r3-reviews/phase<N>-<stage>-<dim>.md` ×9、`.w-model/v-reviews/phase<N>-<stage>.md` ×3 | stage ∈ {plan, execute, finalize}（旧 explore/propose/coding 语义平移，文件命名规则不变） |
| 归档 | `docs/changes/archive/<日期>-<changeId>/`（复用既有受控归档位） | 归档时账本+三件套快照复制进归档目录，由 check-archive-integrity 清单覆盖；**不新增第二归档门** |

**全局硬约束（每个涉及脚本增删/词表变化的任务都必须满足）：**
0. **修复分支遗留收口项（最终全分支评审 2026-09-21 裁定：本批次必须显式排期，不得随合并遗忘）**：
   - **① 两门共用归档 matcher（高优先）**：`check-opsx-artifacts.ts` 的 `archiveChangeDirs`（`name === changeId || endsWith('-'+changeId)`）与 `check-openspec-archive.ts` 的锚定 matcher（`<YYYY-MM-DD>-` + 日历回读）不对称 ⇒ 角落假绿（前门绿/后门红）。本批次归档校验并入 archive-integrity 后此不对称应随两门合一自然消解；若批次 4 前两门仍并存，先抽共享 matcher（`^<changeId>$|^<YYYY-MM-DD>-<changeId>$` + 共享日历校验）+ 三态测试。
   - **② R6 CLI 接线锁定测试**：删掉 `check-budget.ts` 的 `tokensUsed` 传参单测仍全绿——补约 20 行 CLI 级测试（含 tokens 的 run-log 临时 fixture → exit 1 且含 `R6：`），下一批次第一项。
   - **③ E-2 规格修正案**：阶段 1 自举的 R8 同源张力（D-6 只解 R11 半边）须在真实项目跑阶段 1 前以规格修正案裁定「R8 同源豁免 vs R0 首阶段形态」；真实 run 期间操作出口=升级 🔴 CHECKPOINT。
   - **④ 顺带收口**：`basedOnReport` 多值/reportId 严格配对、checkpoint 门 legacy 吸收补非阻断 diagnostic、AGENTS check-opsx-artifacts 行补 D-7 一句、SSoT/data-models 的 R7 表述括注「（含 phase-8 身份不完整段）」、`gate-fix-replay.txt` 头部补「复现须 checkout c7721471」、isMain fail-open 登记 repo 级加固项（17 处统一 realpath 化，不在本批次单独改形）。
1. **计数句同提交**：`AGENTS.md` exit-2 计数句（「全仓 46 个脚本」两处）、`conventions.md:119`（`= 46（27 个 check-* + 19 个工具 CLI…）`）、`subagent-delegation.md:369`、`SKILL.md:121/:144`（「47 个 .ts」「references/（43 个 .md）」）、`docs/INSTALL.md:109`——以 `npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts` exit 0 为准绳。
2. **脚本行登记同提交**：AGENTS §8 表行（agents-nav-missing）+ subagent-delegation dispatch-matrix 行（script-registry）。
3. **action 枚举四方同步**：`run-log.schema.json` enum ↔ `conventions.md:57` ↔ `data-models.md:658` ↔ `docs-consistency-logic.ts` `EXPECTED.runLogActionCount`。
4. **四处样本同步**：self-test CASES ↔ `samples/<簇>/` fixtures ↔ `samples/README.md` 矩阵 ↔ `NEGATIVE-COVERAGE.md` 登记（check-samples-coverage 双向强制）。
5. **`config/vitest.config.ts` `SUBPROCESS_TEST_FILES` ↔ `__tests__` 文件名**（vitest-project-split 双向守护）。
6. **examples 文案 ↔ examples-contract.test.ts**（断言 stage8 命令行）。
7. **先改 `eval/mappings.json`（mapping #21 contains "opsx" 断言）再动 SKILL.md**。
8. **`hard-constraints.md` 反模式编号不变**（#39/#40 改写释义与门禁指向，不重编号；`EXPECTED.maxAntiPattern: 48` 不动）。
9. 每任务收尾：`npx vitest run --config config/vitest.config.ts <聚焦测试>` + `npx tsx w-model-dev/scripts/cli/self-test.ts`（358 样本基线，随用例替换按新基线如实更新）+ `npm run --silent lint:security`（新增 0）+ `npm run --silent typecheck`。

**技术栈：** 同仓（TypeScript ESM `.js` 后缀导入、tsx、vitest、ajv）。仓库测试命令 `npx vitest run --config config/vitest.config.ts <path>`；全量门禁 `npm run prepush`。

---

## 批次 1：新门禁与词表（脚本层核心替换）

### 任务 1：`check-coding-plan.ts` 新门禁（logic 纯函数 + CLI）

**文件：** 新增 `w-model-dev/scripts/cli/check-coding-plan.ts` + `w-model-dev/scripts/logic/coding-plan-logic.ts` + `__tests__/coding-plan-logic.test.ts` + `__tests__/check-coding-plan.test.ts`（登记 `SUBPROCESS_TEST_FILES`）+ `samples/coding-plan/`（valid-phase5 / bad-missing-ledger / bad-task-missing-verify 三 fixture）。

- [ ] 纯函数 `checkCodingPlan(projectRoot, phase, changeId): CheckResult`，骨架复用 `check-opsx-artifacts.ts` 的模式：`loadCliScope` 两形态参数、strict 入口、四态目录解析（活动位=活动变更，归档回退沿 D-7 语义）、stdout 单行 `CODING_PLAN_JSON {type:'coding-plan', passed, phase, changeId, planPath, ledgerPath, tasksTotal, tasksCompleted, artifactsFound, reviewsFound, violations}`、退出码 0/1/2。
- [ ] 校验规则 R1-R6：R1 plan 存在+前缀；R2 任务节与验证命令行（每任务 ≥1）；R3 账本存在+首行身份+complete 行覆盖；R4 三件套齐备非空；R5 R3×9+V×3（stage=plan/execute/finalize）；R6 归档态=归档目录内 plan+账本快照存在（快照校验，fail-closed）。
- [ ] 负例至少：plan 缺验证命令行 / 账本缺 complete 行 / 三件套缺 report / R3×9 缺一份 / 归档态无快照。
- [ ] 登记：AGENTS §8 行、dispatch-matrix 行、samples/README 矩阵行、NEGATIVE-COVERAGE 行（同提交）。
- [ ] Commit: `feat(gates): check-coding-plan 编码计划制品门（superpowers 替换批次 1）`

### 任务 2：run-log 词表扩充 + LEGACY 吸收

**文件：** `schemas/run-log.schema.json`（enum L210-213 后追加 `plan_propose`/`plan_task`/`plan_review`，`opsx_*` 四值**保留**；description「共 27 值」→「共 30 值」并写明 opsx_* 为 LEGACY 仅历史日志合法、新日志须用 plan_*）、`logic/run-log-logic.ts`（action 联合类型 L97-100 增补 + `GATE_JSON_PATTERNS` L1487-1488 增 `CODING_PLAN_JSON`）、`logic/docs-consistency-logic.ts`（`EXPECTED.runLogActionCount: 27→30`）、`conventions.md:57`、`data-models.md:658`。

- [ ] schema description 写明：`plan_propose=S 产编码计划（writing-plans）；plan_task=S 执行一个计划任务（SDD）；plan_review=V 任务评审`；`opsx_*` 标注 LEGACY。
- [ ] 四方同步一处不漏（全局约束 3）；`docs-consistency` exit 0。
- [ ] Commit: `feat(gates): run-log 词表增 plan_* 三动作，opsx_* 转 LEGACY（superpowers 替换批次 1）`

### 任务 3：check-artifact-gate 聚合切换

**文件：** `cli/check-artifact-gate.ts`（L87 import、L196-307 `aggregateExternalChecks` 的 opsx checker 换 `checkCodingPlanStrict`、GATE_JSON `external.opsx` 键改 `external.codingPlan`、L704 人类可读行）、`__tests__/artifact-gate-external.test.ts`（30 处同步）。

- [ ] scope 缺失 fail-closed 文案改为「[coding-plan] 阶段 N：未提供 --scope…」；`changesNames` 语义随新契约（保持 `[changeId]`）。
- [ ] Commit: `feat(gates): artifact-gate 阶段 5-8 聚合切至 coding-plan 门（superpowers 替换批次 1）`

### 任务 4：check-openspec-archive 退役 + 归档校验并入 archive-integrity

**文件：** 退役 `cli/check-openspec-archive.ts` + `__tests__/check-openspec-archive.test.ts`（从 `SUBPROCESS_TEST_FILES` 摘除）；`cli/check-archive-integrity.ts` + 对应 logic 增「编码计划归档快照」清单项（plan.md + progress.md + 三件套在归档目录内）；self-test 的 `OPENSPEC_ARCHIVE_CASES`（L1922-1941）与 `samples/openspec-archive/` 三 fixture 删除；`samples/README.md:44`、`NEGATIVE-COVERAGE.md:86` 行删除；`.eslintsecurity-baseline.json` 再生成（`--regenerate`，专任务提交）。

- [ ] 退役同一提交内完成：AGENTS §8 行删、dispatch-matrix 行删、command-reference L441-454 节改写、`EXIT_CODE` 计数句若变化同步（预期 46→46：+coding-plan −openspec-archive）。
- [ ] Commit: `refactor(gates): 退役 check-openspec-archive，归档校验并入 archive-integrity（superpowers 替换批次 1）`

### 任务 5：ensure 脚本改写（codegraph 收敛为 CLI 依赖） + doctor 清理

**文件：** `cli/ensure-codegraph-opsx.ts` → **改名** `cli/ensure-codegraph.ts`。**codegraph 依赖收敛为对其 CLI 的依赖（用户指令 2026-09-21）：**

- [ ] **保留**：L1 CLI 检测（`codegraph --version`；缺失保留 `@colbymchenry/codegraph` 自动安装）与 L3 项目 `.codegraph/` 目录层（`codegraph init`）。
- [ ] **降级**：L2 MCP 注册（`codegraph install`，原 L226-243）**不再是依赖**——full 模式不再自动注册 MCP；若宿主已注册 MCP，结果行标 `status: 'ready'` + detail 注明「MCP 可选加速（非依赖）」；未注册不算缺失、不出 checkpoint。
- [ ] **探针改 CLI**：原 L262-279 的 `codegraph query main` MCP 探针改走 CLI 形态（子命令以实施当日 `codegraph --help` 实测为准并写入脚本注释）；探针失败 → checkpoint 项，不得静默跳过。
- [ ] **新增**：superpowers 三层检测（L1 宿主技能目录含 `subagent-driven-development/SKILL.md` 等 ≥3 关键技能 / L2 仓内 `w-model-dev/references/superpowers-adoption.md` 存在 / L3 项目 `docs/superpowers/` 目录；**只检测不安装**，缺失 → checkpoint 项）；`doctor.ts` + `logic/doctor-logic.ts`（L15/L161-176 第 7 项 openspec 删除，可加 superpowers 提示级项）；`__tests__`（cli-natural-exit L235-284、cli-arg-unification、doctor-logic.test 同步）；改名连锁：AGENTS §8 行、dispatch-matrix、`docs/INSTALL.md:109/:384-409`（整节改写为「codegraph CLI 依赖 + superpowers 检测」语义）、SKILL/AGENTS 计数句（若有变化）。
- [ ] **连锁文档（任务 7 承接）**：`hard-constraints.md` 约束 #14、AGENTS §6、SSoT 中「S-coding 须先调用 `codegraph_explore`（MCP 工具）」的表述统一改为「**CLI 优先**（`codegraph query` …），宿主 MCP 工具若可用为可选加速」；`.w-model/codegraph-queries/` 落盘义务与 `check-codegraph-queries.ts` 门禁不变。
- [ ] `npx tsx .../doctor.ts --json` 输出不含 openspec 项。
- [ ] Commit: `feat(gates): ensure-codegraph 收敛为 CLI 依赖并增 superpowers 检测；doctor 清理（superpowers 替换批次 1）`

## 批次 2：方法论 vendor 与文档面

### 任务 6：`references/superpowers-adoption.md`（vendor）

- [ ] 内容：上游 obra/superpowers v6.3.0（commit b36e082，MIT，含版权声明）的编码链七技能方法论要点改编（中文），W-Model 角色映射表（设计稿 §3），宿主已装技能的检测/加速说明；标注「上游锚定 + 本仓适配」。
- [ ] 同提交：`SKILL.md:144` references 计数 43→44；`SKILL.md:131-133` 8 阶段表「方法/范式」列 phase3-8 措辞改写（**先改 `eval/mappings.json:124-126`** mapping #21 断言，再动 SKILL）。
- [ ] Commit: `docs(references): vendor superpowers v6.3.0 方法论（superpowers-adoption）`

### 任务 7：references 15 份 + 硬约束反模式改写

- [ ] `phase-5-coding.md`「OpenSpec opsx 三段式 S 分派」节 →「superpowers 编码链 S 分派」（S-plan/S-coding/S-finalize + 产物路径新契约）；phase-6/7/8 同节改写；`phase-8` L284「opsx:archive 后置门」段 → 归档快照语义；`subagent-delegation.md`（L28/45/54、dispatch-matrix 命令列、L298-322 三段式节、L960-1065 变体定义）；`command-reference.md` L441-454 节改写为 check-coding-plan CLI 参考；`conventions.md:94` tickets/tasks 职责边界 → plan/账本边界；`data-models.md:438-441` TS 片段；`verifier-spec.md` L274-276；`quick-self-check.md:30`；`workflow.md:209`；`phase-1-requirements.md:215` 措辞。
- [ ] `hard-constraints.md`：反模式 #39 详解（L785-796）改为「跳过编码计划审查」语义（检测信号=新门禁 R1-R6）；#40（L800-812）改为「plan 任务与 tickets 切片职责混淆」；主表行 L226-227、阶段映射 L148-151/L302-303/L350-351 同步。**编号不变**（全局约束 8）。
- [ ] **约束 #14 表述改 CLI 优先**（任务 5 的连锁项）：`hard-constraints.md` 约束 #14、`AGENTS.md` §6、SSoT 对应段——「S-coding 须先调用 `codegraph_explore`（MCP 工具）查询影响半径」改为「S-coding 须先经 **codegraph CLI** 查询目标符号影响半径（宿主 MCP 工具若可用为可选加速）」，`.w-model/codegraph-queries/` 落盘义务与反模式 #38 编号不变。
- [ ] Commit: `docs(references): 阶段 5-8 分派与反模式改写为编码计划契约（superpowers 替换批次 2）`

### 任务 8：SSoT / AGENTS / README / INSTALL / templates / examples / eval

- [ ] SSoT 13 处（L98/105/279/281/283/1227/1376-1379/1834-1837/1921/2398-2399/2579/2585）；AGENTS L17/22/41/132 + §8 表；README L148/194；INSTALL L109 + L384-409 节（已于任务 5 改，此处复核）；`templates/coding.md` L6/79-80；`examples/` 8 份（examples-contract.test.ts L708 断言同步）；eval 三件（`eval/README.md:49`、`mappings.json`、`w-model-dev-test-prompts.json:134-136` 负向提示词期望文案点名新门禁）。
- [ ] Commit: `docs: SSoT/AGENTS/README/INSTALL/examples/eval 同步编码计划契约（superpowers 替换批次 2）`

## 批次 3：demo 端到端复验

### 任务 9：build_workspace 改造 + 新链路重放

- [ ] `eval/e2e/demo-assets/build_workspace.py` L746-778：openspec 目录构造 → 新契约构造（`docs/plans/<cid>.plan.md` + `.superpowers/sdd/<plan>/` 账本与三件套 + r3/v-reviews 新 stage 名）；README L23/27 同步。
- [ ] 重建 demo workspace，用新链路重走阶段 5-8（12 项门禁口径更新：opsx 两门 → coding-plan + archive-integrity 快照项）；旧 opsx 产物以 LEGACY 形态共存验证（run-log 含 opsx_* 历史行仍 exit 0）。
- [ ] 证据存 `docs/debug/<日期>-superpowers-replace-replay/`（`.txt` 非 `.log`）。
- [ ] Commit: `test(e2e): demo 新编码计划链路重放记录（superpowers 替换批次 3）`

## 批次 4：收尾

### 任务 10：全量验收与残留清理

- [ ] `npm run prepush`（19 项全绿）；grep 全仓「opsx\|openspec」活性引用清零（历史档案 docs/superpowers/plans|specs、docs/changes、docs/debug、CHANGELOG* 不改）；CHANGELOG 新条目；确认 `.gitignore` 无需为 `.superpowers/sdd/` 新增规则（保持本地瞬态，归档快照入库）。
- [ ] Commit: `chore: superpowers 替换收尾（CHANGELOG + 残留清理）`

---

## 自检记录（编写者执行）

1. **规格覆盖度**：设计稿 §4.1→任务 6/7；§4.2→任务 1/4；§4.3→任务 1-5；§4.4→任务 2/4/7/8；§6 批次 1-5→任务 1-10；§7 风险 1（顺序）→本计划在修复分支收口后执行；风险 2/3/4→已按批准默认固化。
2. **依赖顺序**：盘点报告的 9 条硬同步依赖已映射为全局约束 1-9 与任务内步骤。
3. **占位符**：无「待定」；每个任务的验收命令与同提交约束明确。
