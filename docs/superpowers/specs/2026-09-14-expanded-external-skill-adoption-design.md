# 扩展外部技能采纳设计（v4，已裁定待实施）

> **状态：P0 裁定已完成，实施未开始。** 本文提出的规则、门禁、Schema 与产物**均尚未实现**；不得把它们当作现有能力、阶段放行依据或已导出的证据。
> **裁定结论**：`docs/superpowers/plans/2026-09-14-external-absorption-adjudication.md` §10 裁定回执。该 plan 的 6 个决策点（**D-1～D-6**）已获用户同意；全部 50 个采纳项现均有归属（50 已裁定 / 0 待裁）。
> **⚠ 编号区分（勿混淆）**：plan 的决策点编号为 **`D-1`～`D-6`**（带连字符），与本文 §9 的架构决议 **`D1`～`D7`**（无连字符）**是两组不同的东西**。用户本次同意的是前者；**§9 的 D1–D7 尚未被逐条确认**，见 §13 AC-0。
> **进入实现计划的前置条件**：① ~~P0a vendor~~ ✅ **已完成**（见 §2.2，两张 vendor 文件已入库，全部采纳项可在仓库内复核）；② §9 的 D1–D7 若有争议须先澄清，但**它们仅在确有"独立能力运行"需求时才生效**，当前不阻塞 P1。**⇒ P1 已可启动。**
> **既有权威边界：** W-model 设计决策以 `docs/skill-design-document_SSoT.md` 为准；RTM 事实源仍是 `.w-model/rtm.json`；核心术语仍由 `w-model-dev/references/conventions.md` 管理；外部采纳的既有记录见 round26 / round27（§12.1）。
> **本版依据（两个外部源）：**
> - [`2026-09-14-external-repo-capability-survey.md`](./2026-09-14-external-repo-capability-survey.md)（mattpocock/skills）—— 候选 **M01–M18**
> - [`2026-09-14-superpowers-capability-survey.md`](./2026-09-14-superpowers-capability-survey.md)（obra/superpowers）—— 候选 **S01–S32**，并对 8 个 M 项给出修正（该台账 §8）
>
> 本文不重复其证据，只做决议与合同。

## 1. 目标、范围与不变式

### 目标

在**不改变** W-model 八阶段、O/A/S/V/G/R 角色边界、V/G 失败链、RTM 与 SSoT 权威的前提下，把两个外部技能仓库中**经证据确认、且本仓库确实缺失**的机制内化进来。采纳判据三条同时成立：

1. 该机制在外部仓库有可定位的原文证据（`文件:行号`）；
2. W-model 确实缺它——须点名既有资产并证明其不存在或不覆盖；
3. 内化后不与任何 W-model 不变式冲突，或冲突有明确处置（§10）。

### 范围

- **以 L0 规则文本为主。** 两个源的调研一致表明：最高价值项集中在"如何写技能资产"与"如何评审判定"的规则层，实现形态是 Markdown，**不需要新命令或新运行机制**。
- **仅当缺口无法用 L0 规则闭合时**，才引入确定性门禁/fixture 扩展（C 级）或新契约（D 级）。
- 每个内化项保留 Context Pointer、审计来源、失败闭锁与角色交接；能成为既有阶段的输入，**不能自行放行阶段**，不新增 RTM 关系、Schema 字段或覆盖率语义。

### 非目标与明确排除

- 不接入 GitHub / GitLab / Jira / Linear 等平台 hook、通知、账户状态、Issue 发布或标签同步；**不引入任何 agent 会话级 hook**（含 superpowers 的 SessionStart 注入）。
- 不引入 `CONTEXT.md` 或 `docs/adr/` 作为平行事实源（沿用既有决议，§12.1）。
- 不引入 `.superpowers/**` 状态目录、运行时计划文件或 tracker 绑定产物。
- 不引入新的 npm 运行时依赖（含 dependency-cruiser / husky / lint-staged / shoehorn / ws）；不引入 python/pytest/jq/yq/shellcheck/shfmt/rsync/gh/tmux 等外部工具链。
- 不引入 HTML 产物、CDN 依赖或本地 HTTP 服务；技能资产保持 Markdown + 自包含 TypeScript。
- 不复制 to-spec / to-tickets / wayfinder / triage / implement 等外部流程产物；规格、追溯与未明事项继续由阶段产物、RTM 与 Fog of War 承担。
- 不实现或暗中推进 `/wm code-health` 的 Phase 5–8。
- 不把诊断、调研、发现或原型本身表述为生产修复、测试通过或阶段放行。

## 2. 来源锚定与原文 vendor 政策

### 2.1 来源

| 源 | 仓库 | 受控 commit | 覆盖 |
| --- | --- | --- | --- |
| **M 源** | `D:/w_skill_opt/skills`（mattpocock/skills） | `3cca18b368ae95cdbdebbff572ccafa662551015` | 37 技能 + 元层 |
| **S 源** | `D:/w_skill_opt/superpowers`（obra/superpowers v6.3.0） | `b36e0829c6d0140e93cfef2ca599b1b07d4a7797` | 14 技能 + 工程层 |

任一 commit 变化使对应侧的采纳清单失效，须更新并重新批准。

### 2.2 原文 vendor（**已执行**）

被采纳项的**原文摘录**已固化进 `docs/superpowers/sources/`，每段标注：来源仓库 commit、repo-relative 路径、行号范围、源文件 SHA-256（实测）。该文件是本仓库内**唯一的采纳证据基准**（同 `2026-08-31-evidence-anchored-tree-methodology.md` 既有先例）；复核**只需比对仓库内文件，无需访问外部仓库的绝对路径**。未被采纳项不 vendor。

| 文件 | 覆盖 | 规模 |
| --- | --- | --- |
| `docs/superpowers/sources/2026-09-14-mattpocock-skills-adopted-excerpts.md` | M01–M18 | 735 行 / 18 节 / 22 个源文件 SHA-256 |
| `docs/superpowers/sources/2026-09-14-superpowers-adopted-excerpts.md` | S01–S32 | 1309 行 / 32 节 |

**vendor 复核同时产出了修正**：两处**实质修正**（M12 的"快慢分层"是 W-model 改造落位而非源文规则；S18 源文实为 6 条而非台账所称"七条"）与 10 处行号偏移，已回写两张台账的 §10，并同步本文相应行。**机制内容无一项被推翻。**

### 2.3 采纳判据的元规则（提案自我适用）

本提案自身受 M01/S03 约束：不得把未落地的推荐表述为已具备的能力；来源主张必须可在仓库内定位；每个内化项必须给出**可观测的验收信号**而非"理解达成"。

## 3. 采纳总览

层：**A** = 纯 L0 文本（零新脚本/零新 Schema）；**C** = 确定性门禁/fixture 扩展；**D** = 需新契约。

### 3.1 资产编写与元理论（A 层）

| ID | 机制 | 源 | 落点 |
| --- | --- | --- | --- |
| **M01** | 资产编写杠杆：no-op test（**存量剪枝**：删掉该行行为是否改变；失败删整句）、leading word、context vs cognitive load、progressive disclosure 判据、指针措辞、completion criteria 与 premature completion 防御顺序、pruning 四刀 | M | 新增 `references/asset-authoring.md` |
| **S03** | **渐进披露数字阈值**（body <500 行 / >100 行拆 / <50 行内联 / 引用一层深 / >100 行加 TOC / 词数 <150/<200/<500）+ 指针约定（REQUIRED SUB-SKILL 标记；**禁 `@` 深链**及 200k context 成本论证） | S | 同上（**作为权威数值**） |
| **S04** | no-guidance control 的**"授权不写"**语义：control 不复现失败即不得写这条规则 | S | 同上（与 M01 双持） |
| **S02** | description 只写 when、**绝不概括工作流**（含因果事故链与正反例） | S | `w-model-dev/SKILL.md` frontmatter（**现有现网违规**） |
| **S05** | 机械约束→自动化，文档只留判断题 | S | SSoT §3.5 / `audit-l0-links` 边界判据 |
| **M02** | 反模式表述整改 | M | `hard-constraints.md` |
| **S01** | **Match the Form to the Failure**（按失败类型选形式）+ **No nuance clauses** + **Exemption clauses don't scope** | S | `hard-constraints.md`（**修正 M02**：不是"去掉否定"） |
| **M16** | 单一权威文案纪律（安装/快速开始文案一处权威、其余指向、禁复述） | M | `README.md` / `docs/INSTALL.md` / `AGENTS.md` |
| **M15** | 调用分类与跨阶段交接写法（**跨阶段动作交接须显式动作句**；分类标注） | M+S | `subagent-delegation.md` / `SKILL.md` |

### 3.2 角色独立性、评审与收敛（A 层）

| ID | 机制 | 源 | 落点 |
| --- | --- | --- | --- |
| **S06** | **禁止编排者预判 findings**（不得在 dispatch prompt 写 "do not flag" / "at most Minor"） | S | `subagent-delegation.md` + 反模式节 |
| **S07** | **"不信任报告"**：作者 rationale 是 claim、不得降级 severity；plan 作者不自评自己的 plan；test output 的 warning 即 finding | S | `verifier-spec.md` |
| **S08** | 面向 V finding 的**误报质疑通道（回流新 V，禁 O 裁决）** | S | `verifier-spec.md` + 返工链 |
| **S09** | scoped re-review：只审 fix delta + 逐 finding `ADDRESSED/NOT ADDRESSED`（"**Attempted is not addressed**"）+ Minor 不进 loop | S | `verifier-spec.md` + `subagent-delegation.md` |
| **S16** | spec self-review 4 项 + 独立 spec reviewer + **calibration 阈值**（治 V 过度判负） | S | V persona / `verifier-spec.md` |
| **M14** | Loop 4 输入：retro 七类改进源 + **no-op 审计** + "标准归评审者" | M | `hill-climbing-guide.md` |
| **S10** | **Ruling 三要素**（含"**若错代价**"）+ 穷尽上缴用户 | S | `command-reference.md` CHECKPOINT 清单 |
| **S11** | **模型档位 × 修复轮次 escalation + 必须显式指定模型** | S | `estimation-guide.md` + `subagent-delegation.md` |
| **S14** | **≥3 次修复失败的技术判据**（暴露新共享状态且位置不同 / 要求大规模重构 / 别处产生新症状 → 架构错误） | S | `root-cause-locator.md`（**修正意见 2：不在既有 MAX_ROUNDS 中逐项列出**） |
| **M09** | 设计压力与 seam 负向判据：**两 adapter 才成真 seam** + 依赖四分类→测试策略 + deletion test + DESIGN-IT-TWICE 约束矩阵 | M | phase-3/4 seam 节 + `coding-quality.md` |

### 3.3 测试质量与门禁可信度（A/C 层）

| ID | 机制 | 源 | 落点 | 层 |
| --- | --- | --- | --- | --- |
| **S21** | change detector / **string-presence trap** / "Name the break" 前置门 / **期望值独立推导** | S | `quality-standards.md` + V checklist | A |
| **S19** | **Mutation Check 5 类变异** | S | 同上（后可升级为门禁） | A/C |
| **S20** | **Mock 三条硬规则**（先学副作用 / 镜像完整结构 / 禁 test-only 方法进生产类） | S | `quality-standards.md`（**W-model 零覆盖**） | A |
| **M03** | 测试质量反模式（tautological / implementation-coupled / mock 边界） | M+S | 同上（**改以 S 为主源**） | A |
| **M06** | **负向 fixture 协议**：注入违规必须失败 | M | `check-samples-coverage.ts` + `samples/README.md` | C |
| **S26** | M06 补强：**fail-closed + 状态逐字节不变**（违规注入后 fixture 未被污染） | S | 同上 | C |
| **S25** | **规则负载性因果测试**（RED/GREEN/PRESSURE：**移除该规则文本必须复现旧行为**） | S | 新增规则级 fixture 协议（**超越 M06**） | C |
| **S28** | "断言必须能失败"的自检纪律（瞄准最小证据单元 + 注释写明所防回归） | S | `samples/README.md` 矩阵 | C |
| **S29** | 测试替身保真（mock 复刻历史 bug 真实契约） | S | 门禁单测 | C |
| **S27** | **回归测试回滚证伪协议**（`revertEvidence`：回滚后必须变红） | S | 门禁扩展（**补反模式 #45**） | C |
| **M07** | RED 证据可验证化 → **改为：把 code-health 的 RED 证据模式扩展到阶段 5-8 RTM `testSummary`** | M+S | `rtm.schema.json` + 门禁 | C |
| **M11** | expand-contract 兜底（integration 分支 + integrate-and-verify 票） | M | `phase-5-coding.md` | A |
| **S31** | **完整性审计**（declared-list + 全仓 grep 未登记载体） | S | `check-docs-consistency.ts` 新维度 | C |
| **S32** | 评审包物化为确定性单文件（diff 包按 range 命名，不进编排者上下文） | S | 新确定性脚本 | C |
| **S30** | 定量预算断言（L0 加载体积/文件数上限） | S | 门禁/单测 | C |

### 3.4 调试、根因与运维（A/C 层）

| ID | 机制 | 源 | 落点 | 层 |
| --- | --- | --- | --- | --- |
| **M05** | R 入场门：红信号四项验收 + **3–5 条排序可证伪假设** + 预测格式 | M | `root-cause-locator.md` | A |
| **M17** | S 的 loop 构造方法清单（10 种按序）+ 提高复现率而非干净复现 | M | 同上 | A |
| **S13** | **"无根因"合法出口**（真环境/时序/外部）+ "95% 反例"警示 | S | `root-cause-locator.md` + `check-rootcause-report.ts` 分支 | A |
| **S24** | **污染源二分定位**（逐文件跑，停在第一个污染源） | S | 新确定性 CLI（vitest 语义） | C |
| **S22** | **条件等待三要素** + 三反模式 | S | `concurrency-guide.md` / 测试纪律 | A |
| **M13** | 事件接驳前置核实（先核实主张再受理） | M | `event-ingress-guide.md` | A |
| **S23** | **worktree 隔离五条**（Step0 检测 + submodule 守卫 / 建前取同意 / 原生工具优先 / `git check-ignore` 强制 / **clean baseline 强制**）+ 清理拥有权 + `git worktree prune` 自愈 | S | `phase-5-coding.md` 新节 + 阶段 8 归档节 | A |
| **M12** | pre-commit 快层（staged-only 快层；**不得引入 husky**）。**注**：源文的 `.husky/pre-commit` 内同时跑全量 typecheck+test，「快慢分层 / 慢层留 pre-push」是 **W-model 的改造落位而非源文规则**（见 M 台账 §10.1） | M | `.githooks/pre-commit` | A |
| **S12** | **preflight 成对冲突扫描表** | S | S-tickets（`phase-5-coding.md`） | A |

### 3.5 交互与阶段规则（A 层）

| ID | 机制 | 源 | 落点 |
| --- | --- | --- | --- |
| **M04** | CHECKPOINT 提问与呈现规范（grill-the-send / 每题一想法 + 答案 stub / 鼓励 "I don't know" / frontier + 必给推荐答案 + 不阻塞派子代理 / **Push right** / **Brief 三段式**） | M | `command-reference.md` + `quick-self-check.md` |
| **S17** | **呈现内核 4 条**：逐问判定 / 2-4 选项 / **后撤屏**（推进时作废上一问的呈现物）/ **提议独占一条消息** | S | 同上（合并进 M04） |
| **S15** | **三路径分诊 + 单向棘轮 + 分类口播** | S | `SKILL.md` 阶段开工前分诊（**须改造**） |
| **S18** | **No Placeholders 黑名单（源文 6 条）** + Buildability 判据 | S | 票据校验（`check-artifact-gate.ts --phase=5`）+ V 必答项 |
| **M10** | ADR 入选三问门槛（难逆 / 无上下文会困惑 / 真取舍） | M | phase-2 ADR 触发收窄 |
| **M18** | 受控低仪式探索通道（question-first + 捕获纪律 + 默认零持久化） | M | phase-1 迷雾毕业证据要求 |

### 3.6 新契约（D 层）

| ID | 机制 | 源 | 说明 |
| --- | --- | --- | --- |
| **M08** | 拒绝知识库（概念粒度 + 入口按概念相似度去重 + `Prior requests` 回链） | M | **必须挂靠既有事实源并加门禁**，不得新建自由目录；不新增 `/wm` 子命令 |

### 3.7 编号与源的对照小结

- 采纳项合计 **50 项**（M 侧 18 + S 侧 32），其中 **8 项经 S 源修正**（S 台账 §8）：M01、M02、M03、M04、M05、M06、M07、M17。另 M15（调用分类与跨阶段交接写法）被 S03 的指针约定补充，但主源仍为 M 侧。
- **裁定结果（2026-09-14）**：50 项全部已裁定（44 项直接采纳 + 6 项经 plan 决策点 D-1～D-6 裁定后采纳）。其中 **D-1 与 D-5 的结论是"不采纳完整形态"**：D-1 只落地反模式分流判据、**不做 48 条全量主表述改写**；D-5 **不引入任务级三路径分诊**。**D-6 附前置规则**（worktree 内 `.w-model` 合法性未定稿前只实施 S23-a）。详见 plan §10.2 的四条实施期约束。
- **两源冲突取舍原则**：需要"防锚定/可证伪假设"的取 M 侧；需要"测试断言与行为证据强度"的取 S 侧；需要"交互呈现"的以 M04 为主并并入 S17；两源都不足的（如 seam 规则）单列保留。

## 4. A 级要点（高风险项单列）

以下四项若不按改造后的形态落地，会直接违反既有不变式，故单列其边界。

### 4.1 S01（修正 M02）：按失败类型分流，而非单向去否定

| 项 | 内容 |
| --- | --- |
| 来源证据 | `writing-skills/SKILL.md:459-474,480`（详见 S 台账 §4.1） |
| 内化产物 | `hard-constraints.md` 反模式节新增"失败类型 → 指令形式"分流判据：压力下明知故犯 → 禁令 + rationalization 表；**遵循了但输出形状错/漏必填项 → 正向 recipe / 结构化 REQUIRED 槽位**（此处用禁令会反噬）；条件依赖 → 可观测谓词条件句。另两条硬子规则：**No nuance clauses**、**Exemption clauses don't scope** |
| 边界 | 计数契约不变（`maxAntiPattern: 48` 与 `#1~#48` 连续）。**S 源的量化排序（`:470`）无随仓证据**，不得当作既定事实写入。**本地 A/B 已执行**（[报告](./2026-09-14-d1-local-ab-evidence.md)）：该量化主张**未被裁定**（实验存在 treatment×metric 混淆），且**对照臂未复现失败**→ 按已采纳的 S04「control 不失败则不编写该指引」，**无可修缺陷**。故本项落地范围**仅限"分流判据 + 两条硬子规则"**，**不做 48 条全量主表述改写**（理由三重：规则自洽 / 无可修缺陷 / 证据缺失，见报告 §5.3） |
| 验收 | AC-3 |

### 4.2 S13：R 报告必须新增"无根因"合法分支（否则门禁会诱发编造）

| 项 | 内容 |
| --- | --- |
| 来源证据 | `systematic-debugging/SKILL.md:266-275`；W-model 侧刚性证据: `check-rootcause-report.ts` R2 强制 `rootCauseChain` 长度 [2,5] 单链、R3 强制 `[若...则]`（`root-cause-logic.ts:234-277`） |
| 问题 | 当现象真是环境/时序/外部依赖型时，schema **没有合法分支** → 门禁会诱发"为过门禁而编造一条可证伪根因链" |
| 内化产物 | 新增**显式**的 `noRootCause` / `environmental` 分支，须附调查记录与证据（走完流程 + 记录调查内容 + 实施重试/超时/错误提示 + 加监控），并写明"95% 的'无根因'是调查不完整"的警示 |
| 边界 | **不得放松 R2/R3**（新增分支，不降低既有强度） |
| 验收 | AC-6 |

### 4.3 S25 + S26 + S28：门禁可信度的三层补强

| 项 | 内容 |
| --- | --- |
| 来源证据 | `tests/claude-code/test-worktree-native-preference.sh:10-19,87-89`（RED/GREEN/PRESSURE 三相位）；`tests/version-bump/test-bump-version.sh:61-74`（`cmp -s` 断言前后 manifest 逐字节未变）；`tests/pi/test-pi-extension.mjs:125-136`（只匹配表格行的理由注释） |
| 问题 | W-model 的 43 个 exit-2 门禁 + 332 条 self-test 只证明"**合法输入通过**"；不证明"非法输入会失败"（M06 补），不证明"失败时没留下半成品"（S26 补），也不证明"规则确实是负载性的"（S25 补） |
| 内化产物 | ① M06：每个 exit-2 门禁 ≥1 个负向 fixture 且断言**必须失败**；② S26：同一 fixture 上断言"失败后状态逐字节不变"；③ S25：对关键 L0 规则做"含规则 / 剥离该规则"两态 fixture，断言剥离态**复现违规**；④ S28：矩阵为每个负向 fixture 记一行"若此处放宽匹配将漏掉的回归" |
| 边界 | 零新增依赖。S24/S25 类"逐文件跑"的机制**只能作按需工具，不得当门禁**（会压垮 pre-push）。新增 fixture 须同步 `samples/README.md` 矩阵与计数契约 |
| 验收 | AC-7 |

### 4.4 S23 + Y18：worktree 采纳前必须先定"worktree 内 `.w-model` 合法性"

| 项 | 内容 |
| --- | --- |
| 来源证据 | `using-git-worktrees/SKILL.md:12,26-33,41-45,80-88,121-133,164-167`；`finishing-a-development-branch/SKILL.md:159-201,220-221`；W-model 已踩坑证据见 S 台账 §5 S23 |
| 阻塞性问题 | worktree 有**独立 `.w-model/`**（实测路径存在）；`wm-write.ts` 的锁在**同一文件路径**上，多 worktree 各写各的**不保证全局单写者**，且主仓与 worktree 的 `.w-model/` 构成平行事实源（违反 AGENTS.md 立场）。另 SSoT `:283` 要求 headRef sha == **当前 HEAD**，worktree 有独立 HEAD |
| 内化产物 | ① 先定"worktree 内 `.w-model` 合法性 + 合并回主仓"规则（**此项须先于其他 worktree 条目批准**）；② 五条隔离纪律；③ 清理拥有权判定 + `prune` 自愈；④ clean baseline 强制 |
| 边界 | 不得自动 `git reset` / 自动清理用户文件；原生工具优先（绕过会产生 harness 看不见的 phantom state），但**W-model 不引入平台工具**，故须重写为 git-only |
| 验收 | AC-9 |

## 5. C 级产出清单

| 产物 | 性质 | 说明 |
| --- | --- | --- |
| `check-samples-coverage.ts` 扩展 | 既有脚本增强 | 负向 fixture 必填 + "必须失败"断言 + 状态不变断言 + 覆盖矩阵新列 |
| 规则级 fixture 协议（S25） | 新协议 | "含规则/剥离规则"两态对，断言剥离态复现违规 |
| 污染源定位 CLI（S24） | **新确定性 CLI** | vitest 语义；检查对象含 `.w-model/` 残留、锁文件、`coverage/`；保留"吞掉测试失败只看产物"的语义并显式注释；exit 1 = 发现污染源 |
| 评审包 CLI（S32） | **新确定性 CLI** | 按 range 命名，落盘为可复现的 diff 包 |
| `revertEvidence`（S27） | 门禁/Schema 扩展 | 回滚后必须变红；优先复用既有 `assertionHash` 模式，不新增字段 |
| RTM `testSummary` RED 证据（M07） | Schema 扩展 | 把 code-health 的 `redEvidence` 模式扩展到阶段 5-8 |
| `check-docs-consistency.ts` 完整性审计维度（S31） | 既有脚本增强 | declared-list + 全仓 grep 未登记载体（与既有"计数相等"正交互补） |
| `noRootCause` / `environmental` 分支（S13） | Schema 扩展 | 新增分支，不放松 R2/R3 |

**一切新增/增强的脚本与 Schema 都必须同步** `check-docs-consistency` 的联动计数器（`exit2ScriptCount: 43` / `schemaCount: 34` / `runLogActionCount: 27` / `prePushCount: 18` / `maxAntiPattern: 48` / 资产计数）与 dispatch-matrix 登记表。

## 6. D 级：M08 拒绝知识库

| 项 | 内容 |
| --- | --- |
| 来源证据 | `triage/OUT-OF-SCOPE.md:3-6,17,23-54,70-82,84-88,99-106` |
| W-model 缺口 | 阶段 1 迷雾毕业含"判 Out of Scope"（`phase-1-requirements.md:162`），但**单轮内判断、落于阶段文档、无跨轮次记忆、无入口去重**；全仓 grep `.out-of-scope` 零命中 |
| 内化产物 | 概念粒度的持久拒绝登记（含 `Prior requests` 回链）+ 阶段 1 入口按概念相似度去重的读取动作。**在既有命令内实现，不新增 `/wm` 子命令** |
| 边界 | 照搬自由目录会成为平行事实源 → 必须**挂靠既有事实源**并**加门禁**（外部该机制零校验、是漂移高发面）。仅 rejected enhancement 入册，已实现者拒收 |
| 验收 | AC-10 |

## 7. 关于"独立能力运行"

v1 曾为 diagnose / ReviewOverlay / research evidence / architecture discovery / prototype 设计独立 CapabilityRun。v2 已给出处置，v3 维持：

| v1 能力 | 处置 | 理由 |
| --- | --- | --- |
| C1 diagnose | 降级为 A 级规则（M05 + M17 + S13 + S14 + S24 + S22） | 真缺口在 R 的入场条件与收敛判据，可用 L0 规则 + 两个工具闭合 |
| C2 ReviewOverlay | 降级为 L0 微增量（Spec 轴 scope creep）+ S06/S07/S08/S09/S16 | 双轴永不合并已被 round26 以 R13 吸收；真增量在评审独立性与 finding 级处置 |
| C3 research evidence | 排除 | 源技能 12 行，与 A 子代理分派 + evidence provenance 重叠 |
| C4 architecture discovery | 排除（取 deletion test + 三档强度提示） | 主体被 code-health 以严格得多的形式覆盖 |
| C6 prototype | 降级为 B 级探索通道（M18） | 其隔离模型与资产处置状态机在源文件中不存在 |

**结论**：v1 的 §8 机械（CapabilityRun 生命周期、五份新 Schema、五个新命令）**不再需要**。D1–D7 保留为"将来若确有独立能力运行需求时"的约束（当前仅 M08 可能触及，且优先在既有命令内实现），**本提案不申请实现它们**。

## 8. 明确排除

### 8.1 M 源排除（理由见 M 台账 §7）

to-spec、to-tickets（保留 M11）、wayfinder、triage（保留 M08/M13）、wizard、setup-matt-pocock-skills、implement、grill-with-docs、grill-me、wait-what、research（作为能力）、migrate-to-shoehorn、scaffold-exercises、git-guardrails（脚本）、domain-modeling 的 CONTEXT.md/ADR 目录体系（保留 M10）、improve-codebase-architecture（保留 2 点）、code-review（作为新命令）、setup-ts-deep-modules 工具部分（保留 M06）、setup-pre-commit 的 husky/lint-staged（保留 M12 思想）、teach 的 HTML 教学产物、handoff/claude-handoff 的 OS tmp 落盘、implement-spec 的 PR 自动合并与"跳过 R"、writing-beats/fragments/shape、resolving-merge-conflicts 的绝对化条款。

### 8.2 S 源排除（理由见 S 台账 §7）

`hooks/` 全部（平台 hook + **fail-open 静默降级**）、8 个平台插件层、brainstorming 的 5 个脚本（1232 行非 Markdown/TS + 默认外部品牌图 + `.superpowers/**` 平行状态目录 + 本地服务攻击面 + `maybeOpenBrowser` 操作桌面）、`persuasion-principles.md`（Unity/Liking/Reciprocity 与 V 独立性对立）、`render-graphs.js` + graphviz 二进制、`anthropic-best-practices.md` 整体（44% 为上游搬运且与外层矛盾，按需摘取）、`systematic-debugging/SKILL.md:168-190`（自调查自修复，命中 #18）、runtime stack-trace 插桩手艺、SDD 的 O 自主裁决 / 不 stall / 并行 implementer / 无 R 的 fix loop、`requesting-code-review` 与 `finishing-a-development-branch` 的 git 菜单与合并策略自动推断、`receiving-code-review:62-66`（人类反馈可直接实施）、`using-superpowers` 的注入机制、`writing-plans` 的 `path:N-M` 与内联完整实现、`executing-plans` 的 batch 语义与运行时计划文件、`docs/superpowers/plans/` 落盘约定、Codex 镜像同步。

### 8.3 纯提示词风格 / 无迁移价值

M 源：ask-matt flow 图与阶段边界五问树、grilling emoji 版式、`HTML-REPORT.md` 的 CDN/配色/文风、teach 的 quiz 版式与认知科学部分、`docs/` 发布形态约束。
S 源：`finishing-a-development-branch` 的 no-gratitude 话术、`dispatching-parallel-agents` 的整合验证（被 V/G 覆盖）、brainstorming 的 emoji 与 CSS 类清单、`CREATION-LOG.md` / `test-academic.md` / `test-pressure-*.md`（可作 V persona 素材而非机制）。

### 8.4 不因外部启发式削减自身门禁

M 源 `.out-of-scope/question-limits.md` 与 `setup-skill-verify-mode.md` 主张"能由既有自然语言入口表达者不应新增开关"。该启发式**不适用于** W-model 的机器可消费门禁（如 `wm-export-evidence --verify` 返回门禁结果）。它只用于判断"是否新增一个可由既有入口表达的人类便利开关"。

## 9. 架构决议（D1–D7）

> 效力范围：**仅当**某采纳项被判定为需要"独立能力运行"（当前仅 M08 可能触及，且优先在既有命令内实现）时才适用。它们同时是**负向约束**——禁止用它们为 A 级规则项引入多余机械。

| ID | 决议 |
| --- | --- |
| **D1** | 独立运行**不得伪造阶段**。`run-log.schema.json` 与 `signature-chain.schema.json` 均强制 `phase` 为 1–8 整数（已核实），故不得写入伪造 phase / phaseName / 阶段 CHECKPOINT / 阶段签名。若将来需要独立运行，须引入版本化的能力级记录与签名 Schema；在 SSoT 明确扩展兼容性前，既有阶段生命周期 checker 保持不变 |
| **D2** | 独立运行的生命周期与其语义边界：`draft → authorized → running → success / blocked / fail / cancelled`；终态可 `superseded` / `revoked`；`fail` 需改动项目资产时须先形成经 V 复审、G 校验的根因报告再标 `fix-transferred`（**只表示已移交，不表示已修复**）。独立运行**没有阶段放行语义**，其 CHECKPOINT 永不替代阶段控制 |
| **D3** | 状态层不得互相冒充：runLifecycle / 语义状态 / Pointer consumability 三层必须用不同字段与不同判定层；**一层的 success 不得解释为另一层的可消费资格** |
| **D4** | 新技术契约必须是全新严格 Schema；不复用、不扩展、不兼容既有 `VerifierOutput` 等阶段契约；未知字段、身份不一致、非法状态一律 fail-closed，不得降级为 advisory 或 pass |
| **D5** | 阶段可消费性走 Pointer 谓词：目标存在且哈希匹配；所需 producer V/G 均为 pass 且与声明一致；独立运行（若适用）满足 success 且未 superseded/revoked；不存在哈希不匹配或签名断链。任何作者不得自行把 Pointer 标成 consumable；消费后才发现不匹配时，受影响阶段走普通 V/G 失败链 |
| **D6** | 目标资产变更一律路由既有阶段：任何对目标项目源码、配置、依赖、测试、生成文件、工作树元数据或仪表配置的写入/删除/清理，都必须在既有 phase 5–8 内以 ChangeScope + codegraph 影响分析起步，经既有 R3/V/G、回归验证与 CHECKPOINT；不得由任何能力运行自行实施。**此项同时封住 S 源 Iron Law 的自动删除与 worktree 采纳**（Y1/Y18） |
| **D7** | RTM 与 SSoT 不变：不改变 RTM 的实体、关系、Schema、覆盖率语义或维护方式；不创建 `termPointers` 字段、不迁移 RTM Schema、不把术语状态或冲突写成 RTM 覆盖状态；不自动改写 SSoT。**唯一例外是 M07 明确申请把 `redEvidence` 模式扩展到 RTM `testSummary`**，该项须单独走 Schema 变更批准 |

## 10. 冲突台账

### 10.1 M 源（X1–X9）

| # | 外部主张 | 冲突的不变式 | 处置 |
| --- | --- | --- | --- |
| X1 | husky 把 `core.hooksPath` 指向 `.husky` | `setup:hooks` 设 `.githooks`，18 项 pre-push | 不装 husky；原生 `.githooks/pre-commit` |
| X2 | `exit 2` = 策略阻断 | 全仓 `2 = 输入错误 / ERROR_JSON` | 不移植该脚本；任何移植须重映射为 exit 1 |
| X3 | 建 PR → 自动合并 → 标 ready | CHECKPOINT 不可绕过；code-health 人类 ApprovalDecision | 剥离 |
| X4 | "旧浅模块单测变成废物，删掉" | code-health Phase 3 受保护测试 | M09 改写为走 Phase 3 路径 |
| X5 | 原型 "No tests" | 约束 #14（改动后必须跑回归测试） | M18 补最小验证命令 |
| X6 | 报告/交接落 OS 临时目录 | wm-write 锁/原子性；证据白名单 | 改落 `.w-model/` 并走 wm-write |
| X7 | "永远解析，绝不 `--abort`" | CHECKPOINT 用户确认权；可回滚语义 | 不采纳绝对化条款 |
| X8 | `CONTEXT.md` + `docs/adr/` 作权威 | 既有决议不新建目录；不引入平行事实源 | 排除该载体（M10 只取门槛） |
| X9 | "一次性修完全部问题" | 反模式 #18 | 剥离 |

### 10.2 S 源（Y1–Y21，详见 S 台账 §6）

高风险六条：**Y1** TDD Iron Law 自动删除 → 改为"标记废弃 + CHECKPOINT 请求删除"；**Y5** O 对 reviewer 的裁定权 → 必须剥离（争议回流新 V 或 R）；**Y6** fix loop 无 R 入口 → 保留 R 前置；**Y10/Y11** HTML/Node server 与 `.superpowers/**` 状态目录 → 排除；**Y12/Y13** 平台 hook 且 **fail-open 静默降级** → 排除（W-model 是 fail-closed 哲学）；**Y18** worktree 独立 `.w-model/` → 采纳前先定规则（§4.4）。

其余：Y2 例外自裁 → 映射 CHECKPOINT 豁免；Y3 Brownfield 假定缺失 → 显式补分支；Y4 REFACTOR 在内循环 → 取 M 侧"重构归 V 评审"；Y7 不 stall → 只取记录格式；Y8 `path:N-M` 与内联实现 → 否决；Y9 batch 语义 → 拒绝；Y14 无 exit-2 契税 → 不得照抄脚本风格；Y15 镜像同步 → 排除；Y16 persuasion → 排除出 V 提示词；Y17 测试依赖栈 → 只借断言模式；Y19 逐节批准 vs Push right → M04 胜；Y20 superpowers 内部 description 矛盾 → 取 `SKILL.md` 版；Y21 单假设 vs 3–5 排序假设 → M05 胜。

## 11. 分期与依赖

分期遵循 `skillopt-adoption.md:41,69-73` 的 bounded edit 边界：**单文件单次 edit ≤3 处 / 单信号 ≤2 文件 / 全轮总 edit ≤15 处**。

| 分期 | 范围 | 前置 | 交付判据 |
| --- | --- | --- | --- |
| **P0：决议录入** | 用户/SSoT 对 D1–D7 与全部采纳项处置的批准或拒绝记录；拒绝项回本规格修订 | 本提案评审 | 未完成 P0 不写实现计划、不建文件 |
| **P1：元理论层（最高价值）** | M01 + S03 + S04 + S02 + S05 + M02 + S01 + M16 + M15 | P0 | 纯 L0，零 Schema/零脚本；M02/S01 须保持 `#1~#48` 计数契约；S 源无随仓证据的量化主张标注为假设 |
| **P2：门禁可信度** | M06 + S25 + S26 + S28 + S29 + S27 + S31 + S32 + S30 + M07 | P0 | 每 exit-2 门禁 ≥1 个"必须失败"负向 fixture 且断言状态未污染；规则级两态 fixture 成立；同步计数契约 |
| **P3：角色独立性与评审** | S06 + S07 + S08 + S09 + S16 + M14 + S10 + S11 + S14 | P1 | S08 必须禁 O 裁决；S09 必须保留 R 前置 |
| **P4：测试质量与设计规则** | S19 + S20 + S21 + M03 + M09 + M10 + M11 + S18 + S12 | P2 | S20 作用域限定为被测生产代码，不波及门禁 fixture；S18 路径类黑名单换符号类 |
| **P5：调试、运维与交互** | M05 + M17 + S13 + S24 + S22 + M13 + M04 + S17 + M18 + M12 + S15 + S23 | P0（S23 须先定 §4.4 规则） | S13 不放松 R2/R3；S24 只作按需工具；S23 的 `.w-model` 规则先批准 |
| **P6：拒绝知识库** | M08 | P0；D7 确认 | 挂靠既有事实源 + 门禁，不得新建自由目录 |

P1–P6 是未来实现计划的顺序，**不是已完成的工作**。每期先交付可审阅的 L0 契约与负例，再落实现；任一失败均保留既有命令行为不变。

## 12. 相对上一版的变更

### 12.1 与既有决议的一致性

| 既有决议 | 状态 | 本版处理 |
| --- | --- | --- |
| round26 借鉴点 1（verifier 单轴下限） | ✅ `verifier-logic.ts:200` | 不重复采纳；v1 的 C2 因此降级 |
| round26 借鉴点 2（Fowler 12 基线） | ✅ `coding-quality.md:311-322` | 同上 |
| round26 借鉴点 3（GLOSSARY + `_Avoid_`） | ✅ `conventions.md:12,14` | v1 的 C5 与之重叠，降级为 M10 |
| round26 借鉴点 4（No-op / Negation 元理论审计） | ❌ **从未落地**（无 plan，全仓无整改痕迹） | **由 M01 + M02 + S01 + S02 + S03 + S04 承接** —— 本版最高价值项 |
| round26 借鉴点 5（Agent Brief durability） | ✅ `phase-5-coding.md:162,166-173` | 不重复采纳；并据此否决 S 源的 `path:N-M`（Y8） |
| round27（wayfinder → Fog of War） | ✅ `phase-1-requirements.md:147-169` | wayfinder 剩余部分判排除 |
| `evidence-anchored-tree.md:72`（不新建 CONTEXT.md/ADR 目录） | ✅ 既有决议 | v1 的 C5 与之冲突（X8）→ 沿用决议 |
| `root-cause-locator.md:138-141`（曾吸收 systematic-debugging 的 root-cause-tracing） | ✅ 已吸收（仅 9 个 md 中的 1 个） | 本版**复核该边界**（S 台账 §4.2）：真缺口是污染定位 / 条件等待 / "无根因"出口 / 收敛判据，均已列为 S13/S14/S22/S24 |

### 12.2 v2 → v3 的变更

| 变更 | 内容 | 原因 |
| --- | --- | --- |
| **新增第二个源** | 纳入 obra/superpowers v6.3.0（14 技能 + 工程层），新增 S01–S32 | 前一轮只调研了 M 源；S 源在"测试断言强度 / 评审独立性 / 规则负载性"上有 M 源没有的内容 |
| **修正 8 个 M 项** | M01（S03 提供权威数值）、M02（S01 改为按失败类型分流）、M03（改以 S 为主源）、M06（S25/S26/S28 三层补强）、M07（不再作增量，改为扩展 code-health 模式到 RTM）、M04/M05/M17（**保持 M 主源**，S 仅补强） | 两源对比后需择一为主（S 台账 §4.3、§8 逐条给出判据） |
| **新增采纳项** | 32 项 S 候选全部逐条处置（内化 / 改造内化 / 排除） | 同上 |
| **新增高风险专项** | §4 单列 S01 / S13 / S25+S26+S28 / S23+Y18 四项，附边界与阻塞条件 | 这四项若不按改造形态落地会直接违反既有不变式 |
| **冲突台账扩容** | M 源 9 条（X1–X9）+ S 源 21 条（Y1–Y21） | S 源的冲突性质与 M 源不同（如 hook 是 **fail-open vs fail-closed**，不是退出码语义） |
| **D6 / D7 边界澄清** | D6 同时封住 S 源 Iron Law 的自动删除与 worktree 采纳；D7 为 M07 单列一个 Schema 变更例外 | 避免"采纳项绕过既有资产变更路由" |
| **修正一处事实** | S 台账更正：`tests/pi` 并非空目录（137 行测试 + 121 行扩展） | 前一轮分区提问中包含一个基于文件计数的错误前提 |

### 12.3 v1 → v2 的变更（保留摘要）

采纳依据从"挑选六项看起来有价值的能力"改为"缺口驱动三判据"；删去 C4/C3 与 C4 的全树零写证明机械；C1/C2/C6 降级为 L0 规则；修正 C5/C6 的来源归属错误；CapabilityRun 机械不再申请实现；AC-1 从"重算外部绝对路径哈希"改为仓库内 vendor 复核。

### 12.4 v3 → v4 的变更（仅记录裁定，不改设计）

| 变更 | 内容 |
| --- | --- |
| **状态推进** | 由"提案待批准"→"P0 裁定已完成，实施未开始" |
| **裁定记录** | plan §10 裁定回执：D-1～D-6 全部按提案推荐获同意；50 项均有归属（44 直接 + 6 经决策点裁定） |
| **实施期约束入法** | plan §10.2 四条：① 反模式主表述禁止整批改写（D-1）；② M07 仅可新增可选字段且须单独批准（D-2）；③ 不得引入任务级轻量路由（D-5）；④ worktree 隔离阻塞于 `.w-model` 合法性规则（D-6）；另 ⑤ 拒绝知识库须挂靠阶段 1 受控节（D-3） |
| **新增编号区分说明** | 明确 plan 的 `D-1`～`D-6`（决策点）与本文 `D1`～`D7`（架构决议）是两组不同编号，避免误记为同一组已批准 |
| **未变更** | **§3–§8 的全部设计内容、采纳/排除清单、§9 架构决议 D1–D7、§10 冲突台账、§11 分期结构均未改动**。本次仅追加裁定状态与实施约束，属"记录"而非"改设计" |

## 13. 可验证验收标准

以下 AC 是**未来实现**的验收标准，描述需要被脚本、fixture、审计或人工 CHECKPOINT 证明的行为，**不是当前仓库已有的测试结果**。

| ID | 可验证的验收标准 |
| --- | --- |
| AC-0 | **部分达成**：50 个采纳项处置**已有裁定记录**（44 项直接采纳 + 6 项经 plan 决策点 D-1～D-6 裁定，见 plan §10 裁定回执），不存在"实现时再决定"的流程语义。**未达成部分**：§9 的架构决议 **D1–D7 尚未被逐条确认**（用户本轮同意的是 plan 的 D-1～D-6，非本节的 D1–D7）；因 D1–D7 只在确有"独立能力运行"需求时生效、当前无该需求，故**不阻塞 P1**，但若将来有该需求须先补确认记录 |
| AC-1 | **已达成（P0a）**：被采纳项的原文摘录已 vendor 进 `docs/superpowers/sources/`（M 源 735 行 / S 源 1309 行），每段含来源 commit、repo-relative 路径、行号范围与实测源文件 SHA-256；**仓库内文件即可完成采纳复核**，无需访问外部仓库绝对路径。vendor 期间发现的 2 处实质修正与 10 处行号偏移已回写台账 §10，机制内容无一项被推翻 |
| AC-2 | M01+S03+S04 的规则文件存在，携带**可观测判据**（no-op test 判据 = "删掉该行后 agent 行为是否改变"）与**数字阈值**；既有 `references/` 加载策略能被该规则解释（progressive disclosure 判据可复算）。**已达成（P1）**：规则文件 = `w-model-dev/references/asset-authoring.md`（170 行）；可观测判据见 §12「no-op test（可观测判据）」；数字阈值见 §5（`SKILL.md` body < 500 行 / 参考文件 > 100 行拆出 / 代码内容 < 50 行内联 / getting-started < 150 词 / 高频加载技能 < 200 词 / 其他技能 < 500 词 / 引用只允许一层深）；§4 渐进披露判据可复算既有 `references/` 按需加载策略。证据命令：`ls w-model-dev/references/*.md \| wc -l` = 43；`grep -n "no-op test（可观测判据）" w-model-dev/references/asset-authoring.md`；`npm run prepush` exit 0（含 docs-consistency） |
| AC-3 | S01/M02 落地范围**限于新增"失败类型 → 指令形式"分流判据**（含 No nuance clauses / Exemption clauses don't scope），并**明确记录不做 48 条全量主表述改写**及其三重理由（规则自洽 / 对照臂未复现失败 / 量化证据缺失，见 [A/B 报告](./2026-09-14-d1-local-ab-evidence.md) §5.3）；**48 条现有的反模式描述、危害、正确做法与检测信号一律保留**，`maxAntiPattern: 48` 与 `#1~#48` 连续区间契约不变；若将来要重测 S01 的量化主张，须先满足该报告 §8 的四条再跑条件（修正 metric×treatment 混淆、换用对照臂能稳定失败的 SUT、提高 reps 并盲评、至少 2 个 SUT） |
| AC-4 | S02 后 `w-model-dev/SKILL.md` 的 description **只描述何时使用、不概括工作流**；现有概括性表述与否定链已整改。**已达成（P1）**：frontmatter description 现仅含 Use-when 触发条件（`/wm`、W-model/W 模型/W 开发模型、RTM/阶段门/质量门、开发测试并行、端到端流程）+ 指向 `references/activation-guide.md` 的触发边界指针，不概括工作流；无 `Do NOT use for` 否定链。证据命令：`sed -n '1,10p' w-model-dev/SKILL.md`；`grep -c "Do NOT use" w-model-dev/SKILL.md` = 0；`npm run prepush` exit 0（含 docs-consistency） |
| AC-5 | M04+S17 后 CHECKPOINT 规范含提问侧（grill-the-send / 每题一想法 / 鼓励"我不知道" / frontier 必给推荐答案 / Push right）与呈现侧（Brief 三段式 / 2-4 选项 / 后撤屏 / 提议独占一条消息）；**Push right 未删除任何 CHECKPOINT**，`check-checkpoint.ts` R1–R5 契约不变 |
| AC-6 | M05+M17+S13+S14 后：R 入场要求红信号四项验收与 3–5 条排序可证伪假设；**存在 `noRootCause`/`environmental` 合法分支且 R2/R3 未被放松**；≥3 次失败的技术判据可判定；**角色分离可验证**（信号由 S 建立运行、根因由 R 产出、修复由 S-fix 执行）。**P3 范围内部分达成（2026-09-15，各证据命令均真实跑）**：①「≥3 次失败的技术判据可判定」**已达成**——`w-model-dev/references/root-cause-locator.md` §2.6「≥3 次修复失败：架构判据」给出触发门槛（同一问题连续 ≥3 次修复失败；计数依据 = run-log 既有 `round` / `reworkHints`，不新增字段，`metrics-report.ts` 的 `rework.maxConsecutiveRuns` 可作只读旁证）与三条技术判据（每次修复暴露新的共享状态/耦合/别处问题**且位置不同** / 修复需「大规模重构」才能实施 / 每次修复在别处产生新症状 → 结论「这不是假设失败，是架构错误」= 停下做架构讨论），并明确只以一句话引用既有 `maxReworkRounds`（不逐项列其清单）、不改变 `root-cause-locator` 与 `check-rootcause-report.ts` 的 R2–R5 门禁、不新增 Schema 字段。②「角色分离可验证」的 **P3 侧已达成**——`subagent-delegation.md` §3.4（§3.4.1 禁止编排者预判 findings：`do not flag` / `don't treat X as a defect` / `at most Minor` / `the plan chose` 逐字命中即停下重写 prompt；§3.4.3 逐 finding 输出 `ADDRESSED | NOT ADDRESSED` 且「Attempted is not addressed」；§3.4.6 **R 前置不变**，scoped re-review 不构成跳过 R 的旁路）与 `verifier-spec.md` §15（§15.1 不信任报告：实现者报告 = 未经核实的 claim、stated rationale 从不降级 severity、测试输出的 warning 即 finding；§15.2 误报质疑通道 `FALSE-POSITIVE-CHALLENGE`——**裁决者 = 新的 V，O 只转达与记录不得裁决**，命中反模式 #10；§15.3 spec 自审四项 + 独立 spec reviewer 五类别 + calibration 阈值），即信号由 S 建立运行、根因由 R 产出、修复由 S-fix 执行，O 侧被禁止预判与裁决。证据命令（实测）：`grep -n '## 2.6\|≥3 次' w-model-dev/references/root-cause-locator.md` → `82:## 2.6 ≥3 次修复失败：架构判据` 等；`grep -c '禁预判\|ADDRESSED' w-model-dev/references/subagent-delegation.md` → **6**；`grep -n '^#### 3\.4\.' w-model-dev/references/subagent-delegation.md` → §3.4.1–§3.4.6 六节齐；`grep -n '^## 15\|^### 15\.' w-model-dev/references/verifier-spec.md` → §15 / §15.1 / §15.2 / §15.3；`npm run self-test` → 「总计 340 条用例：340 通过，0 失败」；`npm run audit:l0-links` → exit 0、`violations: []`、672/95/36；`npm run prepush` → **18/18 全绿、`PREPUSH_EXIT=0`**（2026-09-15 收口实测，耗时 21 分 23 秒）。**未达成部分（属 P5：调试、运维与交互，本节不得声明整体达成）**：R 入场的「红信号四项验收 + 3–5 条排序可证伪假设」= **M05** 未落地；S 的 loop 构造方法清单 = **M17** 未落地；`noRootCause` / `environmental` 合法分支与 `check-rootcause-report.ts` R2/R3 的对应契约 = **S13** 未落地（当前 R2/R3 按现契约收紧，未放松，但也因此尚无「无根因」合法出口）。P3 附带记录：本计划唯一新增门禁面为既有契约测试 `examples-contract.test.ts` 抓到的 §3.4.6 段落缺规范短名「普通 V/G 失败链」的回归，已在 P3 收口前修复（commit `1701adfa`，1 文件 +1/−1，修复后该测试 30/30 全绿）；P3 全范围**零 .ts / 零 Schema / 零新增文件**（`git diff --stat df966a07..HEAD -- 'w-model-dev/**/*.ts'` 为空）。限定：本条仅记录 P3 已落的 S14 与角色分离侧；P5 落地后须以同一组命令复验并补齐 M05/M17/S13 证据 |
| AC-7 | M06+S25+S26+S28 后：每个 exit-2 门禁 ≥1 个负向 fixture 且断言**必须失败**（仅存在不算）+ 断言**失败后状态逐字节不变**；关键 L0 规则有"含规则/剥离规则"两态 fixture 且剥离态复现违规；覆盖矩阵含"所防回归"列。S24 类工具**未被用作门禁**。**P2-A 范围内部分达成**：①「每个 exit-2 门禁 ≥1 个负向案例且断言**必须失败**（仅存在不算）」**部分达成（按实测口径校正）**——43 个 exit-2 门禁的负向机制已逐条登记于 `w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md`（43 行，与「`cli/*.ts` 减 `self-test.ts`」的门禁集合精确等集，分组 A=28 / B=1 / C=14，勘误见 plan §0.1 E2），由 `check-samples-coverage.ts` 第 4 条规则强制（`negative-coverage-missing` / `negative-coverage-dangling`，门禁集合从 `cli/*.ts` 动态推导、不手抄名单），3 条「仅存在不算」的弱断言已强化为会失败的原因断言。**与规格字面的差异**：规格写「负向 fixture」，但 14 个工具类 CLI（C 组）的被测对象不含文件输入，其负向输入是 CLI 参数或测试内变异副本而非 fixture，故按「负向案例（`fixture` / `invocation` / `mutated-copy` 三机制）」落地，机制逐门禁登记、`fixture` 行证据路径须在盘。证据命令：`npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`（exit 0，`negativeCoverageMissing` / `negativeCoverageDangling` 均为 0）；`grep -cE '^\| [a-z]' w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md` = 44（P2-B 收口实测；P2-A 收口时为 43，P2-B S32 新增 review-package 行 +1，判据不变、纯事实同步）。②「断言**失败后状态逐字节不变**」**已达成**——`w-model-dev/scripts/__tests__/exit2-failure-atomicity.test.ts` 对 43 个门禁统一断言（`status===2` + 失败前后仓库路径 sha256 快照相等 + git 污点路径单调不增），证据命令：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/exit2-failure-atomicity.test.ts` → 44 passed。③「关键 L0 规则有"含规则/剥离规则"两态 fixture 且剥离态复现违规」**已达成（P2-B）**——`w-model-dev/scripts/__tests__/l0-rule-loadbearing.test.ts`：3 条关键 L0 规则（{{module}} 占位符规则 / L0 分发边界规则 / 目标存在性规则）各具 GREEN（合规输入该类零违规）/ RED（违规输入报该违规）/ STRIPPED（按唯一子串定位从 audit logic 源码删除该规则块生成临时副本并动态 import，同一违规输入对剥离副本不再报该违规 = 旧行为复现；②③剥离后无其他规则兜底（violations 清零），①剥离后同一输入落回目标存在性规则——正是「其余规则未被剥坏」的健康证据）三态共 9 例。证据命令（实测）：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/l0-rule-loadbearing.test.ts` → 1 file passed / 9 tests passed。④「覆盖矩阵含"所防回归"列」**已达成**——`w-model-dev/scripts/samples/README.md` 覆盖矩阵表头含 `所防回归` 列，33 行逐行补列。P2-A 附带结论：S29 已核对 13 组测试替身，1 处真实分叉已修（`__tests__/run-sync.test.ts` 的 `{status:1, error:ENOENT}` 是 Node `spawnSync` 不可能产生的形状，已改为 `status:null`），2 处非真实形状经裁定保留并说明理由（`artifact-gate-assets.test.ts:661` 的 `undefined` 属被测函数自声明形参契约、有专属防御分支；`run-sync.test.ts:175` 的 status+error 融合形态用于证明 `runSync` 逐字段透传不归一化），上述两条裁定的原文见本轮审阅记录；M07 移出 P2（裁定 D-2 要求 RTM `testSummary` 的 Schema 变更**单独批准**，不得包裹在本计划内）；P2 拆为 P2-A / P2-B（规格 §11 要求每期独立可审阅、独立可回滚：P2-A = M06+S26+S28+S29，P2-B = S25+S31+S32+S30+S27）。`npm run prepush` exit 0（P2-A 收口实测，18 项门禁全绿）。**P2-B 收口（2026-09-15，各证据命令均真实跑）**：③ 已达成（见 ③ 处证据）。P2-B 其余各项落点：S30 = `w-model-dev/scripts/__tests__/asset-budget.test.ts` 将 asset-authoring.md §5 散文阈值钉成 7 项确定性上限断言（SKILL.md 正文 ≤499 行 / 单围栏代码块 ≤50 行 / 单参考文件 ≤2500 行 / references ≤48 文件 / 总行数 ≤20000 / 子目录 ≤0 / >1000 行须含 TOC），证据命令（实测）：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/asset-budget.test.ts` → 5 passed；S31 = `check-docs-consistency.ts` 新增 `orphan-reference` / `agents-nav-missing` 两维度，真实包零违规（prepush `check:docs-consistency` ✓）；S32 = 新增 `w-model-dev/scripts/cli/review-package.ts`（cli 目录 44→45 个 .ts、exit-2 门禁 43→44、NEGATIVE-COVERAGE.md 表体 43→44 行、`exit2-failure-atomicity.test.ts` `EXPECTED_GATE_COUNT=44`），反向证据（实测）：`npx tsx w-model-dev/scripts/cli/review-package.ts --unknown-flag` → exit 2 `✗ [ARG_INVALID]`，`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/review-package-cli.test.ts` → 7 passed；S27 落点见 AC-8 行。`npm run prepush` exit 0（P2-B 收口实测，18 项门禁全绿） |
| AC-8 | S27 后 S-fix 的复现测试携带 `revertEvidence`（回滚后必须变红）并由 G 校验；优先复用既有 `assertionHash` 模式，未新增字段，或新增字段时 `check-docs-consistency` 计数契约同步更新。**已达成（P2-B，实测收口）**——fix/emergency-fix 复现测试须携带 `revertEvidence{command}`（回滚证伪声明：执行回滚后复现测试回到失败态），由 `check-run-log.ts` **R10** 强制：timestamp ≥ `LEGACY_REVERT_EVIDENCE_CUTOFF`（=2026-09-15T00:00:00Z，`run-log-logic.ts`）的记录缺失/空白 `revertEvidence.command` 为 blocking（exitCode=1），cutoff 前旧行吸收为非阻断 `LEGACY_REVERT_EVIDENCE` 诊断。fallback 如实记录：判据首选「优先复用既有 `assertionHash` 模式，未新增字段」经核实不可行——无任何既有字段能承载回滚证伪声明（`assertionHash` 是断言对象指纹，表达不出「回滚后必须变红」），故走第二分支新增 `revertEvidence` 字段：`run-log.schema.json` 登记形态且字段 description 齐全自描述（受 `check-docs-consistency` checkSchemaFieldDescriptions 门禁管理），schema 文件计数仍 34；计数契约同步更新并实测一致（AGENTS.md「全仓 44 个脚本 exit 2」/ SKILL.md「门禁脚本 45 个 .ts」/ SKILL.md「`references/` 43 个 .md」/ schemas 34 份）。反模式 #45 获确定性挂点（`hard-constraints.md` #45 门禁脚本行 → `check-run-log.ts` R10 revertEvidence），未新增反模式条目（总数 48 不变）。证据命令（均真实跑）：`npm run self-test` → 333/333（含 R10 负例样本 `bad-fix-missing-revert-evidence.jsonl`）；`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/run-log-logic.test.ts` → 111 passed（R10 describe 块 5 例覆盖四类：fix/emergency-fix 缺失 → blocking、command 仅空白 → blocking、cutoff 前旧行 → LEGACY 吸收放行、合法携带 → 通过且 r10 计数正确）；`npx tsx w-model-dev/scripts/cli/check-run-log.ts w-model-dev/scripts/samples/run-log/rootcause-valid.jsonl` → exit 0，RUN_LOG_JSON 含 `"r10":{"checked":1,"missing":0,"legacy":0}`；反向 `npx tsx w-model-dev/scripts/cli/check-run-log.ts w-model-dev/scripts/samples/run-log/bad-fix-missing-revert-evidence.jsonl` → exit 1，`"r10":{"checked":1,"missing":1,"legacy":0}` 且 reasons 含 R10 违规 |
| AC-9 | S23 后 worktree 条目：**"worktree 内 `.w-model` 合法性 + 合并回主仓"规则已单独批准**；隔离五条、清理拥有权判定、`prune` 自愈、clean baseline 强制均已落地；不存在自动 `git reset`、自动清理用户文件或绕过 CHECKPOINT 的路径 |
| AC-10 | M08 的拒绝登记**挂靠既有事实源**（非自由目录），含概念粒度条目、`Prior requests` 回链、入口按概念相似度去重的读取动作与对应门禁；仅 rejected enhancement 入册；RTM 未新增关系或字段 |
| AC-11 | 全部采纳项**不改变**既有 `/wm` 命令的输入/输出/语义；不新增阶段放行路径；不新增 RTM 关系或覆盖率语义（M07 的 Schema 变更单独批准）；不引入新 npm 运行时依赖、外部工具链、**平台/会话 hook**、HTML 产物、CDN 依赖或本地服务；`npm run audit:l0-links` 保持 exit 0。**P1 范围内已满足，P2–P6 落地时须复验**：`git diff 228b1168..HEAD -- package.json` 为空（无新 npm 依赖）；P1 仅新增/修改 Markdown 与一个既有测试 helper（`l0-baseline.ts`），无新增脚本/Schema/hook/HTML/CDN/本地服务；`npm run audit:l0-links` exit 0、`violations: []`（`relativeLinkCount`=671 / `l1OnlyCount`=93 / `templatePlaceholderCount`=36）；`npm run prepush` exit 0。限定：P1 改动面为纯文档 + 计数同步 + 既有 helper，故命令/RTM/Schema/依赖语义未变的判定仅覆盖 P1；P2–P6 若触及 `/wm` 命令、RTM 关系、Schema 或依赖，须以同一组命令复验。 **M07 已达成（独立批准单元，2026-09-15 用户单独批准，裁定 D-2；该单元只新增可选字段与校验/文档义务，不改 `/wm` 命令输入/输出语义、不新增阶段放行路径）**：① `rtm.schema.json` 新增**可选** `testSummary.evidence`（`command` / `exitCode` / `observedAt` + 可选 `rawOutputPath` / `rawOutputSha256`），RTM 实体、关系与覆盖率语义不变、schema 文件计数仍 34；② `check-artifact-gate.ts` 经 `gate-logic.ts` 新增 E1–E4 四规则：E1 配对（`rawOutputPath` ↔ `rawOutputSha256` 要么都有要么都无）、E2 哈希核验（相对项目根解析 / 禁越出根 / 文件须存在 / SHA-256 须相符）、E3 结果一致性含 RED 绑定（`failed>0 ⇒ exitCode≥1`）、E4 存在性 + cutoff（`M07_TEST_EVIDENCE_CUTOFF='2026-09-15T00:00:00Z'`，缺失/不可解析保守不吸收，早于 cutoff 吸收为非阻断 `LEGACY_TEST_EVIDENCE`）；③ 六组 `samples/gate/` 夹具（正例携真实 sha256 产物 / legacy 正例 / E1/E2/E3/E4 各一反例）登记进 `GATE_CASES`（26 条）；④ 文档落点：`rtm-guide.md` 新节 / `data-models.md` 语义段 / `command-reference.md` S 义务 / `templates/rtm.md` 注；⑤ 与 run-log `revertEvidence` 载体不同、不得互替。证据命令（本次收口逐条真实跑）：`npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts <临时项目> --phase=6` 对正样本 `testEvidence {"checked":2,"withEvidence":2,"missing":0,"legacy":0,"e1":0,"e2":0,"e3":0,"e4":0}`、legacy 样本 `"legacy":2`（两条 `LEGACY_TEST_EVIDENCE ... deferred`）、四个反样本各恰好命中一条（E1 `"e1":1` / E2 `"e2":1` 且 reason 报 `SHA-256 不符` / E3 `"e3":1` 且 reason 报 `记录 failed=1 但 evidence.exitCode=0` / E4 `"e4":1`）——样本级隔离项目缺 BDD/cucumber/codegraph/opsx 无关必须件，故整门 exitCode=1，上述为证据子结果；`npm run self-test` → 尾行「总计 340 条用例：340 通过，0 失败」（含六组 gate 用例）；`grep -cE '^\| [a-z]' w-model-dev/scripts/samples/NEGATIVE-COVERAGE.md` = 44；`ls w-model-dev/schemas/*.schema.json \| wc -l` = 34；`npm run audit:l0-links` exit 0（`violations: []`，本次 672/95/36）；`npm run prepush` exit 0（18 项门禁全绿，本次复验） |
| AC-12 | 对 §8 排除清单，实现后**仓库内不存在**对应产物（无平台 hook、无 `.superpowers/**`、无 `CONTEXT.md`/`docs/adr` 目录、无 husky、无 tracker/票据系统、无 `persuasion-principles` 进入 V 提示词）；对 §10 的 X1–X9 与 Y1–Y21 逐条证明已按"处置"列解决 |

## 14. 实现表达自由项（不改本规格锁定的语义）

1. M01/S03/S04 规则文件的落点（新增 `references/asset-authoring.md` 或并入 `conventions.md`）、章节划分与条数组织。
2. S01/M02 整改的编辑粒度与批次切分（须遵守 bounded edit 边界）；反模式表的列顺序。
3. C 级各产物的文件名、CLI 参数拼写、fixture 命名与目录组织；S24 检查对象的最终清单。
4. S13 分支的字段名与判定实现；M07 Schema 变更的具体字段形态。
5. S23 的 `.w-model` 合法性规则的具体载体（哪个文档/哪条门禁承载）。
6. 各采纳项落地文件的章节标题与错误码文本。

这些事项只能在 P0 批准后通过实现计划落实；**不得借它们重新解释 D1–D7、角色边界、阶段兼容性、RTM 边界或用户授权条件**。

## 15. 规格自检

- **来源可审计**：全部采纳主张指向两份台账的 `文件:行号` 证据；原文摘录须 vendor（AC-1），复核不依赖外部绝对路径。
- **缺口可证伪**：每个采纳项点名 W-model 既有资产并证明其不存在或不覆盖；不存在"看似有用即采纳"的项。
- **两个源已对比取舍**：§3.7 与 §12.2 逐条给出主源选择与理由；两源冲突（Y19/Y21 等）已判定胜方。
- **不重复吸收**：§12.1 逐条对齐 round26 / round27 / `evidence-anchored-tree` / `root-cause-locator` 的既有决议。
- **冲突已处置**：M 源 9 条 + S 源 21 条逐条给出处置；§8 排除清单给出理由。
- **仪式与价值匹配**：最高价值项为 L0 规则文本；架构机械仅在确有独立运行需求时生效，且明确不因本提案申请实现。
- **高风险项已单列**：§4 四项附边界与阻塞条件，其中 S23 存在**必须先解决的阻塞问题**（worktree 内 `.w-model` 合法性）。
- **范围与真实性**：不声称任何新增能力已存在；不引入平行事实源、平台 hook、新运行时依赖、HTML 产物；不新增 RTM 关系或覆盖率语义；全部失败路径保留普通 V/G 失败链或显式 blocked。
