# 外部采纳裁定 — 证据血缘图（EVIDENCE_GRAPH）

> **方法论依据**：证据支撑树联合分析模式。原文基准 = [`docs/superpowers/sources/2026-08-31-evidence-anchored-tree-methodology.md`](../sources/2026-08-31-evidence-anchored-tree-methodology.md)（本仓库内唯一拷贝基准）。
> **用途**：为 `2026-09-14-expanded-external-skill-adoption-design.md`（v3，下称"设计 spec"）的 P0 裁定提供证据血缘与状态追踪。
> **性质**：证据台账，非设计决议。裁定结论见同名 plan（`docs/superpowers/plans/2026-09-14-external-absorption-adjudication.md`）。

## 0. 术语与产物映射（术语一致性校验结论）

方法论 §产物结构 规定 `PLAN.md` / `EVIDENCE_GRAPH.md` / `CONTEXT.md` / `ADR/`。逐项与仓库既有术语表与决议碰撞后，**发现一处硬冲突与三处路径差异**，按方法论"冲突时强制中断并抛出矛盾点"规则记录如下：

| 方法论产物 | 仓库既有事实 | 碰撞判定 | 采用的映射 |
| --- | --- | --- | --- |
| `CONTEXT.md`（术语表） | `w-model-dev/references/conventions.md` 已是核心术语**单一权威定义**（含 `_Avoid_` 指令）；且 `references/evidence-anchored-tree.md:72` 有**明确决议**：「新增 CONTEXT.md/ADR/ 文档体系 → 已有 conventions.md + decision-log/ → **不新建目录**」 | **硬冲突 🔴** | **不新建 CONTEXT.md**；术语载体沿用 `conventions.md`。本次未新增术语（见下） |
| `ADR/`（决策记录） | 决策历史由 `docs/changes/decision-log/` + SSoT §10 承载（AGENTS.md §7） | **硬冲突 🔴** | **不新建 `docs/adr/`**；本次裁定结论落 `docs/changes/decision-log/` 与 plan |
| `PLAN.md`（执行蓝图） | 仓库约定：`docs/superpowers/plans/YYYY-MM-DD-<name>.md`；且 `/wm` 运行期**不产计划文件** | 路径差异 🟡 | 落 `docs/superpowers/plans/2026-09-14-external-absorption-adjudication.md` |
| `EVIDENCE_GRAPH.md` | 无既有对应物；`docs/superpowers/sources/` 有"原文唯一拷贝基准"先例 | 无冲突 🟢 | 本文件 |

**新术语校验**：方法论引入的"枝干 / 叶子 / 三色法 / 熔断 / 上行根因分析"在本仓库 `conventions.md` 中**无既有定义、无 `_Avoid_` 冲突**。本次仅作为裁定过程用语使用，**不登记为 W-model 核心术语**（避免引入未被既有决议覆盖的词汇）。

## 1. 根节点与证据源

| 源 | 定位 | 可复核性 |
| --- | --- | --- |
| **E-IN** 内部事实 | 本仓库代码 / 文档 / 门禁 / 测试 | 🟢 可随时直接读取复核 |
| **E-M** mattpocock/skills | `D:/w_skill_opt/skills` @ `3cca18b368ae95cdbdebbff572ccafa662551015` | 🟡 **仅本机可复核**（原文未 vendor） |
| **E-S** obra/superpowers v6.3.0 | `D:/w_skill_opt/superpowers` @ `b36e0829c6d0140e93cfef2ca599b1b07d4a7797` | 🟡 **仅本机可复核**（原文未 vendor） |
| **E-USR** 用户输入 | 本次会话的两条指令（调研该仓库并选择吸收；用本方法论裁定） | 🟢 已记录 |

## 2. 节点挂载表（枝干 → 叶子 → 状态 → 证据）

### B1 外部证据可信性

| 叶 | 主张 | 状态 | 证据与复核方式 |
| --- | --- | --- | --- |
| L1.1 | M 源 commit 与 6 个源文件 SHA-256 与台账逐字符一致 | 🟢 | 本人 `git rev-parse` + `sha256sum` 实测 |
| L1.2 | S 源 commit 为 v6.3.0 发布提交 | 🟢 | 本人 `git log -1` 实测 |
| L1.3 | M/S 两源的**机制级主张**（file:line）可在**仓库内**复核 | 🟢 | **P0a 完成**：原文摘录已 vendor 进 `docs/superpowers/sources/`（M 源 735 行 / S 源 1309 行），复核不再需要外部绝对路径。**AC-1 达成** |
| L1.4 | 外部证据当前状态不影响本次裁定的**方向**，但阻止其**定稿** | 🟢 | 见 §4 R6 与 §6 上行分析 |

### B2 内部缺口真实性（抽样亲自复核，不采信子代理转述）

| 叶 | 主张 | 状态 | 证据 |
| --- | --- | --- | --- |
| L2.1 | `w-model-dev/SKILL.md` 的 description 概括了工作流并挂长串否定链（S02 声称的现网违规） | 🟢 | 本人读 `w-model-dev/SKILL.md:4-11`：含 "stage gates, quality gates, or development and testing in parallel" + "Do NOT use for …" 全列 |
| L2.2 | 反模式 #45「为通过测试而修改断言」无专用脚本（M03/S19/S21 声称的真空） | 🟢 | 本人读 `hard-constraints.md:333`：「无专用脚本（V 评审人工核验断言与需求对应关系）」 |
| L2.3 | 反模式主清单为**单形态**（主表述=禁止），无"按失败类型选形式"判据（S01/M02 前提） | 🟢 | 本人读 `hard-constraints.md:186` 表头：`\| # \| 反模式（不要做） \| 危害 \| 正确做法 \|` |
| L2.4 | 43 个 exit-2 门禁 + 332 条 self-test 只证明"合法输入通过"；`check-samples-coverage.ts` 只校引用与矩阵声明（M06 前提） | 🟢 | 本人核 `EXPECTED`/实测计数 + `check-samples-coverage.ts` 职责 |
| L2.5 | RTM `testSummary` 无 RED/回滚证据字段（M07 缺口） | 🟢 | 本人读 `rtm.schema.json:96-101`：required = total/passed/failed/pending/coverage，且 `additionalProperties:false` |
| L2.6 | `references/` 约 30 份、`subagent/` 28 人格按需加载但**无数值上限门禁**（S03/S30 前提） | 🟢 | 本人实测目录计数 |
| L2.7 | V 侧无"禁止 O 预判 findings"规则（S06 缺口） | 🟢 | `check-verifier-output.ts` 只校 V 输出；全仓无对应反模式 |
| L2.8 | 其余 S/M 项的**具体机制细节**（如 `writing-skills:459-474` 决策表、`find-polluter.sh` 算法、`verification-before-completion:82-86` 回滚协议、`tests/` 各断言模式） | 🟢 | **P0a 完成**：46 个摘录段与源文件逐字节比对 0 mismatch，并实测源文件 SHA-256；本人另复核了 vendor 期间发现的实质修正项（M12/S18）与 8 处 S 侧行号偏移 |

### B3 与既有决议的一致性

| 叶 | 主张 | 状态 | 证据 |
| --- | --- | --- | --- |
| L3.1 | round26 借鉴点 1/2/3/5 已落地，借鉴点 4（No-op/Negation 元理论）从未落地 | 🟢 | `verifier-logic.ts:200`；`coding-quality.md:311-322`；`conventions.md:12,14`；`phase-5-coding.md:162,166-173`；无对应 plan，全仓无 `正向目标`/`leading word` 痕迹 |
| L3.2 | `evidence-anchored-tree.md:72` 拒绝新建 CONTEXT.md/ADR 目录 | 🟢 | 本人读该行原文 |
| L3.3 | `root-cause-locator.md:138-141` 已吸收 superpowers `systematic-debugging`，但**仅 9 个 md 中的 1 个**，并划走"运行时 bug 调试" | 🟢 | 本人读该节原文 + 外部目录实测（9 md / 1,017 行） |
| L3.4 | W-model 自身实现计划把 `superpowers:subagent-driven-development` 当执行工具引用，但**未吸收其方法论进资产** | 🟢 | `docs/superpowers/plans/*.md` 计划头 + `w-model-dev/` 无对应资产 |

### B4 角色与授权边界

| 叶 | 主张 | 状态 | 证据 |
| --- | --- | --- | --- |
| L4.1 | 外部主张中与 CHECKPOINT / 反模式 #10 / #18 / #41 / #45 / #46 冲突者共 30 条（M 侧 9 + S 侧 21） | 🟢 | 设计 spec §10 逐条表；本人抽查 #45 与 #46 的判别口径 |
| L4.2 | `code-health-gap.schema.json` 对 RED/GREEN 的强制是**条件化的**（非无条件），此前调研表述不精确 | 🟢 | 本人读 `code-health-gap.schema.json:250-296` 顶层 `allOf`：`status ∈ {implemented, verified}` ⇒ required `[redEvidence, greenEvidence, assertionHash]`；`redEvidence` ⇒ `observation:"observed"` 且 `exitCode` integer **minimum 1**；`greenEvidence` ⇒ `observed` 且 `exitCode` const 0。属性级 "Optional"（`:92,:96`）是因为 `discovered`/`approved`/`blocked` 阶段本不应有 RED |
| L4.3 | S 源 TDD Iron Law 的"删掉已写代码"、SDD 的 O 自主裁决、worktree 自动清理均需剥离 | 🟢 | M/S 台账逐条证据 + D6 决议 |

### B5 事实源与 Schema 边界

| 叶 | 主张 | 状态 | 证据 |
| --- | --- | --- | --- |
| L5.1 | `.w-model/` 为 Git 忽略的本地状态源 | 🟢 | `.gitignore:2` `.w-model/`；`.gitignore:12` `**/samples/.w-model/gate-logs/` |
| L5.2 | 仓库内现存三处 `.w-model`（根 / `w-model-dev/` / `samples/`） | 🟢 | 本人 `find` 实测 |
| L5.3 | `.worktrees/` 已 gitignore，且**当前无任何 worktree** | 🟢 | `.gitignore:65-66`；`git worktree list` 仅主工作区 |
| L5.4 | RTM 的实体/关系/覆盖率语义本次不变；M07 是唯一申请触碰 RTM 的项 | 🟢 | 设计 spec D7 + §5 表 |

### B6 依赖与分发边界

| 叶 | 主张 | 状态 | 证据 |
| --- | --- | --- | --- |
| L6.1 | 分发模型为"整体拷贝 `w-model-dev/`"，无多平台分支 | 🟢 | AGENTS.md §3；仓库无平台插件层 |
| L6.2 | S 源 hooks 层为 **fail-open**（找不到 bash 即静默 `exit /b 0`），与 W-model fail-closed 对立 | 🟢 | **本人直接复验**：`hooks/run-hook.cmd:37-39` 原文 `REM No bash found - exit silently rather than error` + `exit /b 0` |
| L6.3 | S 源 `tests/` 依赖栈超出 W-model devDep 纪律 | 🟢 | **本人直接复验**：`tests/brainstorm-server/package.json` 引入 `ws@^8.21.0`；实测使用 jq(22)/rsync(12)/shfmt(10)/shellcheck(9)/gh(9)/pytest(7)/yq(4)/ruff(2)。注：tmux 未实测命中，原转述中的该项未经证实 |

### B7 门禁可信度

| 叶 | 主张 | 状态 | 证据 |
| --- | --- | --- | --- |
| L7.1 | 全量 vitest 当前**全绿**：410 文件 / 1908 用例 / 0 失败 / success=true / exit 0 | 🟢 | 本人完整运行实测并解析 JSON 报告 |
| L7.2 | `check-docs-consistency.ts` 静态违规 0 | 🟢 | 本人运行实测（`staticViolationCount: 0`） |
| L7.3 | 该门禁此前的 exit 1 来自**文档化既有抖动**，非本次改动 | 🟢 | `docs/changes/vitest-parallel-flakiness-finding.md`：基线 `72081e2`（不含该 campaign 改动）同样 1 个失败；原文"与改动内容无关，与并行度和 coverage 插桩开销共同相关"；"阻断推送但非真实回归" |
| L7.4 | 该门禁的 vitest 动态测量**仅在 pre-push 上下文**有受控来源 | 🟢 | `.githooks/pre-push:420` 是 `WM_VITEST_PROVENANCE_FILE` 的唯一导出点；脱离 pre-push 单独调用会消费磁盘残留产出 |
| L7.5 | `docs/superpowers/**` 不参与该门禁扫描 | 🟢 | `check-docs-consistency.ts:98` 原文：「docs/superpowers/ 与 docs/changes/ 归档不动」 |

### B8 交互与工作流变更

| 叶 | 主张 | 状态 | 证据 |
| --- | --- | --- | --- |
| L8.1 | pre-commit 快层可**不引入 husky** 而在原生 `.githooks/` 实现（M12） | 🟢 | `npm run setup:hooks` 设 `core.hooksPath=.githooks`；husky 会覆盖该路径（X1） |
| L8.2 | `Push right` 只重排 CHECKPOINT 位置、不删任何 checkpoint，故与"CHECKPOINT 不可绕过"相容 | 🟢 | M 台账证据 + `check-checkpoint.ts` R1–R5 契约未变 |
| L8.3 | S15 三路径分诊与"阶段 1–4 设计级产物强制"不相容（bounded 路径在 W-model 无合法对应物） | 🟢 | 设计 spec §10.1；`check-artifact-gate.ts --phase=N` 强制引用块/SSOT/DoD |

### B9 worktree 与并行隔离（本次新增探针）

| 叶 | 主张 | 状态 | 证据 |
| --- | --- | --- | --- |
| L9.1 | 新建 worktree **不继承** `.w-model` | 🟢 | **本人可逆探针实测**：`git worktree add .worktrees/probe HEAD` → `ls .worktrees/probe/.w-model` 不存在（`.gitignore:2` 忽略 + worktree 只签出 tracked 文件）；随后 `git worktree remove --force` + `prune`，`rmdir .worktrees` 复原 |
| L9.2 | worktree 内跑 `/wm` 会**新建独立 `.w-model`**（写入位置分叉，非继承bug） | 🟡→🟢(推理+历史实证) | 由 L9.1 + L5.1 结构推出；与历史事故中 worktree 内出现 `.w-model/codegraph-queries/` 一致 |
| L9.3 | 该分叉与 `wm-write.ts` 单写者锁冲突（锁在**同一文件路径**上，跨 worktree 不互斥） | 🟢 | `wm-write.ts` 锁语义（`<target>.lock` 持久目录）+ L9.2 |
| L9.4 | clean baseline 强制 / `git check-ignore` 强制 / 拥有权判定 / `prune` 自愈**不依赖** L9.2 | 🟢 | 四条均为 git-only、单工作区内可判定 |

## 3. 证据状态汇总

> **计数更正（2026-09-14，T9）**：本节初稿误记"46 叶 / 🟢34 / 🟡12"，实为 **38 叶**，🟡 初值 **4**（V1 阶段仅 L1.3/L2.8/L6.2/L6.3 四行被标 🟡，其余 🟢）。下表为更正且经 P0a 刷新后的终值。

| 状态 | 初审 | 终审（P0a 后） | 说明 |
| --- | --- | --- | --- |
| 🟢 Confirmed | 34 | **38** | 含 17 条本人亲自复核的承重事实（12 条读取/运行 + 1 次 worktree 探针 + 4 条排除依据复验）与 3 次实测（全量 vitest、doc-consistency、探针） |
| 🟡 Pending | 4 | **0** | 初审的 4 条（L1.3/L2.8/L6.2/L6.3）已全部解除：前两条由 **P0a vendor** 解除，后两条由本人直接复验解除 |
| 🔴 Invalid | 0 | **0** | 见 §6：本次共触发 **2** 次上行分析，均已收口，无遗留 🔴 |

**解除路径明细**

| 叶 | 初审 🟡 原因 | 解除方式 | 终审证据 |
| --- | --- | --- | --- |
| L1.3 | 外部原文未 vendor，仅本机绝对路径可读 | **P0a vendor** | 两张 vendor 文件入库（M 源 735 行 / S 源 1309 行），复核不再需要外部仓库 |
| L2.8 | 机制细节来自子代理转述，本人未逐条复核 | **P0a vendor** | 46 个摘录段与源文件**逐字节**比对 0 mismatch；本人另复核了其中的实质修正项（M12/S18） |
| L6.2 | 子代理读 `run-hook.cmd` 转述 | **本人直接复验** | `hooks/run-hook.cmd:37-39` 原文：`REM No bash found - exit silently rather than error` / `exit /b 0` → **fail-open 确证** |
| L6.3 | 子代理转述依赖栈 | **本人直接复验** | `tests/brainstorm-server/package.json` 引入 `ws@^8.21.0`；`tests/`+`scripts/` 实测使用 jq(22)/rsync(12)/shfmt(10)/shellcheck(9)/gh(9)/pytest(7)/yq(4)/ruff(2) |

## 4. 本次复核对调研结论的修正（4 条，须回写设计 spec）

| # | 原结论 | 复核后 | 影响 |
| --- | --- | --- | --- |
| **R1** | "`code-health-gap.schema.json` **强制** redEvidence"（表述为无条件） | 强制是**条件化的**：`status ∈ {implemented, verified}` 才 required；属性级为 Optional 因早期状态不应有 RED。约束强度本身**确认**（`exitCode` minimum 1、`observation` const observed、`assertionHash` required） | M07 的"缺口成立"结论不变；但 spec 引用该证据时须写明条件，否则会被读成"任意状态都强制" |
| **R2** | "worktree 有独立 `.w-model`"（被当作既成事实） | 精确化为：**新建 worktree 不继承 `.w-model`**；风险是 worktree 内跑 `/wm` 会**新建**一份，造成写入位置分叉 | S23 枝干前提成立；风险描述修正为"写入位置分叉"，处置不变（须先立规则） |
| **R3** | 分区前提"`tests/pi` 是 0 行空目录" | **错误**：`tests/pi/test-pi-extension.mjs` 137 行 + `.pi/extensions/superpowers.ts` 121 行；唯一 0 行文件是 `tests/hermes/__init__.py` | 已由子代理当场纠正；S 台账 §9 已记录 |
| **R4** | 采纳项"8 项经 S 源修正" | 实为 **8 项**（M01–M07、M17）；另 M15 由 S03 的指针约定补充但**主源仍为 M 侧** | 设计 spec §3.7 已修正 |

**另有一条过程性更正（R5）**：我在上一轮口头声称 doc-consistency 门禁通过（错，实际 exit 1），本轮查明为抖动并撤销该说法；同时撤销"不能声称全量套件通过"的保守说法（L7.1 已实测全绿）。

| # | 原结论 | 复核后 | 影响 |
| --- | --- | --- | --- |
| **R6** | P0a vendor 前，外部机制细节只能依赖子代理转述 | vendor **逐字节校验**后确认机制内容全部存在，但产出 **2 处实质修正**：① **M12** 的"快慢分层 / 慢层留 pre-push"**不是源文规则**（源文 `.husky/pre-commit` 内同时跑 lint-staged + 全量 typecheck + test），属 W-model 改造落位；② **S18** 源文实为 **6 条**黑名单，台账所称"七条"无依据 | 两处已回写 M 台账 §10.1 / S 台账 §10.1 并同步设计 spec 的 M12 / S18 行。**这是方法论"🟡 优先验证"直接产出的收益**——若跳过 vendor，这两处失真会带进实现 |
| **R7** | D-1 的残留项"48 条反模式全量改写待 A/B 验证" | **A/B 已执行**（[报告](./2026-09-14-d1-local-ab-evidence.md)，3 臂 ×5 次）：① **未能裁定** S01 的量化主张 P2——我的实验存在 **treatment×metric 混淆**（B 臂被要求产出类型签名，而指标惩罚代码式内容）；② 但**对照臂未复现失败**（2/5 零分，均值 3.6/15）→ 按已采纳的 **S04**"control 不失败则不应编写该指引"，**无可修缺陷**；③ 48 条的失败类型盲分类与我初判分歧显著（discipline 12 vs ≈29，口径敏感），但**任一口径下全量改写都违反 P1 自身**（口径稳健） | D-1 的"否"由"未验证"升级为"有本地证据支持"；**残留验证项关闭**。P2 全局仍 🟡（本站无效裁定） |

## 5. 决策日志

| 时间 | 失效/修正叶 | 上行路径 | 修改内容 | 影响范围 |
| --- | --- | --- | --- | --- |
| 2026-09-14 T1 | L4.2（RED 强制表述） | 叶 → B4 角色与授权边界 | 表述由"无条件强制"改为"条件化强制（status 门限）" | 设计 spec §5 / M07 行措辞；结论不变 |
| 2026-09-14 T2 | L9.2（worktree `.w-model`） | 叶 → B9 → B6 依赖与分发 | 风险由"继承"改为"写入位置分叉"；新增前置条件叶（须先立规则） | S23 全部 5 条纪律的落地顺序；设计 spec §4.4 |
| 2026-09-14 T3 | L1.3（外部证据可复核性） | 叶 → B1 → 根节点 | 判定为**系统性 🟡**：所有外部机制细节在 vendor 前不可在仓库内复核 | 12 条 🟡 叶；P0 的前置动作（见 §6） |
| 2026-09-14 T4 | 我上一轮的口头门禁结论 | 叶 → B7 | 更正为"静态 0 违规 + 动态读数来自陈旧产出"；并补 L7.1 全绿实测 | 会话结论；三份文档本身不受影响 |
| 2026-09-14 T5 | 分区前提（R3） | 叶 → B2 | `tests/pi` 非空；由子代理纠正 | S 台账 §9 |
| 2026-09-14 T6 | 探针本身 | 叶 → B9 | 建/删 `.worktrees/probe`，`git worktree list` 与工作区复原（仅剩未跟踪文档） | 无遗留副作用 |
| 2026-09-14 T7 | 6 个决策点（D-1～D-6） | 叶 → 根节点（E-USR 用户输入） | 用户同意全部提案推荐 | 决策点 6→0；已裁定 44→50；设计 spec 升 v4；实现面解锁至"待 P0a" |
| 2026-09-14 T8 | **R6 两处实质修正**（M12 快慢分层 / S18 七条→6 条） | 叶 → B2 → 根节点 | 台账与设计 spec 同步改正；vendor 文件为准 | M12/S18 的实施口径不变，但"来自源文"的表述被更正为"W-model 改造落位" |
| 2026-09-14 T9 | **本图自身计数错误**（叶子数与 🟡 数） | 叶 → B1 → 根节点 | §3 初稿误记"46 叶 / 🟢34 / 🟡12"，实为 **38 叶 / 🟢34 / 🟡4**；已更正并在 §3 标注更正说明 | 本图 §3/§6/§7 与 plan §10.1 的计数引用一并校正。**属自检义务内应捕获的错误，故记入日志而非静默修正** |
| 2026-09-14 T10 | D-1 残留项（48 条全量改写待验证） | 叶 → B7（门禁可信度）→ 根节点 | 执行 3 臂 ×5 次本地 A/B 并产出 [证据报告](./2026-09-14-d1-local-ab-evidence.md)；**自曝实验存在 treatment×metric 混淆**（B 臂 recipe 要求类型签名而指标惩罚代码式内容），故**未能裁定 P2**；但据 S04「control 不失败则不编写指引」判定**无可修缺陷** | D-1 由"未验证"升级为"有本地证据支持"；残留项关闭。P2 保持 🟡。**实验本身的缺陷已写入报告 §6 局限，未淡化** |

## 6. 🔴 上行根因分析与熔断判定

本次运行按熔断判定逻辑树（Q1→Q4）执行，共触发 2 次上行分析：

**案例 A：RED 强制表述失真（Q2 = "不成立"→ Q3 = "仅当前枝干问题"）**
- 失效叶 L4.2 的直接父级枝干 B4（角色与授权边界）的前提是"W-model 已有的 RED 强制足以判定 M07 无增量"。复核后：前提**成立但表述需收窄**（条件化）。
- 处置：枝干层修复（收窄表述 + 保留结论），**未上调至根节点**，`PLAN` 不升大版本。状态回 🟢。

**案例 B：worktree 前提质疑（Q2 = "不成立"→ Q3 = "当前枝干"→ Q4 未触发）**
- 曾怀疑父级枝干前提"worktree 隔离对并行 S 净收益为正"不成立（若 worktree 会继承脏 `.w-model`，则隔离本身有害）。
- 上行至 B9 → 探针实测 L9.1：不继承。**前提成立**；但暴露出一个**子问题**（worktree 内 `/wm` 新建独立 `.w-model`）→ 新增前置条件叶 L9.2/L9.3。
- 处置：枝干保留，新增前置条件；**未触及根目标**（"选择性内化外部机制"这一根目标不变），故 Q4 未触发，无需全局重播。

**遗留 🔴：0 条；遗留 🟡：0 条。** 唯一系统性未决项（L1.3 vendor 前置）已按方法论"🟡 优先验证"作为 P0 先行动作执行完毕（T7/T8），另两条排除依据（L6.2/L6.3）由本人直接复验解除。**本图终审状态：38 叶全 🟢。**

## 7. 状态机自检

- **每叶挂载证据来源**：§2 全部 **38 叶**均带证据定位或复核方式；终审无 🟡 / 🔴（§3）。
- **承重事实亲自核对**：**17 条**由本人直接读取/运行/探针/复验得出（L2.1–L2.7、L4.2、L5.1–L5.3、L7.1–L7.5、L9.1，共 12 条读取与运行 + L6.2、L6.3 两条排除依据复验 + 3 次实测），未采信子代理转述；其余外部机制细节由 P0a vendor 的逐字节校验支撑。
- **递归证据请求**：L2.8 依赖 L1.3 → 已沿依赖链上溯至根节点并给出处置（vendor）。
- **术语一致性**：§0 完成碰撞并记录 1 处硬冲突（CONTEXT.md/ADR）+ 3 处路径差异。
- **周期性校验**：本次为一次性裁定，未进入 Phase 5 执行期；执行期按设计 spec §11 分期，每期结束须重跑本图的状态快照。
