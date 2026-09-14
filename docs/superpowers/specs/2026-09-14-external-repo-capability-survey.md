# 外部技能仓库能力调研报告（W-model 内化候选台账）

> **状态：调研报告，非决议、非设计。** 本报告只登记"外部有什么、W-model 缺什么、冲突在哪、建议处置"，不构成任何 W-model 能力声明或阶段放行依据。是否采纳由 `2026-09-14-expanded-external-skill-adoption-design.md`（v2）按 SSoT 变更流程决议。
>
> **来源锚定：** 外部仓库 `D:/w_skill_opt/skills`（mattpocock/skills），受控 commit `3cca18b368ae95cdbdebbff572ccafa662551015`（2026-09-04）。本报告全部 `文件:行号` 证据相对该仓库根。commit 或路径变化会使本台账失效。
>
> **原文未 vendor：** 本报告只记录结论与定位证据，未复制外部原文。被采纳项的原文摘录须在实现阶段 vendor 进 `docs/superpowers/sources/`（见 v2 §2.2），否则采纳主张在仓库内不可复核。
>
> **与既有调研的关系（重要）：** 本仓库 **round26**（`2026-07-30-round26-external-skills-absorption-design.md:16`）已对同一外部仓库做过"全量精读 6 分桶"，**round27** 已吸收 wayfinder 的 Fog of War。本报告不是首次调研，而是：(a) 复现且确认 round26 的元理论层结论；(b) 登记 round26 未落地项；(c) 补齐 round26 未覆盖的技能（prototype / setup 系列 / misc / in-progress / 元层工程面）。

## 0. 调研方法与边界

- **分区**：37 个技能按 bucket 分 5 组（engineering 18 / productivity 7 / misc 4 / in-progress 8 / deprecated 0）+ 元层 1 组，共 6 个并行只读子代理。
- **覆盖度**：37 个 `SKILL.md` 全部读完，含同目录附属 md（共 112 个 md）。元层覆盖 README / AGENTS.md / CLAUDE.md / CONTEXT.md / CHANGELOG / `.agents/*` / `.out-of-scope/*` / `.changeset/*` / `.claude-plugin/*` / `package.json` / `scripts/` / `.github/` / `docs/`。
- **判定口径**：每个技能给四档处置之一 —— 直接可内化 / 需改造后内化 / 与既有能力重叠（须点名 W-model 资产）/ 不适用，并要求给出冲突项。
- **对抗性要求**：明确要求区分"真能力"与"提示词风格"；不得为显得有产出而美化。

## 1. 仓库画像

### 1.1 定位与哲学

- 自称"给真实工程师的技能，不是 vibe coding"（`README.md:15`）。
- **明确对立于重流程方案**：GSD / BMAD / Spec-Kit "try to help by owning the process. But while doing so, they take away your control and make bugs in the process hard to resolve."（`README.md:17`）
- 自述设计取向："small, easy to adapt, and composable"（`README.md:19`）。
- **组织轴只有一个：invocation（谁能触发）**，不是生命周期阶段（`README.md:186`：user-invoked 可调 model-invoked，反之不可）。

> **对 W-model 的含义**：这是两大哲学的对立轴。W-model 的资产价值恰恰来自对方拒绝的那部分（确定性门禁 / 退出码 / 签名链 / 审批）。因此"对方这么做所以 W-model 也该这么做"**不是有效论证**；正确姿势是**只要内容标准，不要执行模型**。

### 1.2 工程现实：几乎零自动化门禁（对抗性要点）

- `package.json:11-15` 仅 3 个 npm script；`scripts/` 仅 `link-skills.sh` / `list-skills.sh` / `sync-plugin-version.mjs`；**无 test / lint / vitest / prettier / husky**；`.github/` 下唯一工作流是发版用 `release.yml`。
- 约束靠 `CLAUDE.md` 散文规则 + 维护者自觉。**无任何脚本校验文档/SKILL.md 一致性**（对照面正是 W-model 的 `check-docs-consistency.ts`）。
- **已付出的三次真实代价（该执行模型的实证成本）**：
  1. `.changeset/fix-yaml-frontmatter-colons.md`：em-dash 清扫遗留未加引号的冒号使 6 个 `SKILL.md` 的 YAML frontmatter 非法，`skills.sh` 在 discovery 阶段**静默跳过全部 6 个**。
  2. `.changeset/user-invoked-skill-invocation.md`：两条规则相隔 8 行未对账，**同一 bug 传播到 6 个调用点**才被发现。
  3. `CLAUDE.md:25` 声明 em-dash 禁用覆盖 `CHANGELOG.md`，实测 `CHANGELOG.md` 含 em-dash 68 处，**最新版本节也中招**（规则在生成面上必然漂移）。

### 1.3 分发与分层

- 五桶即生命周期（`CLAUDE.md:1-7`）：engineering / productivity / misc / in-progress / deprecated。一条规则统治全部消费者：promoted 桶必须在 `README.md` 与 `.claude-plugin/plugin.json` 各出现一次，其余桶**一律不得出现**（`CLAUDE.md:9`）。
- `plugin.json:21-47` 是 **25 条显式路径数组**（非通配），精确圈定 promoted 集。
- in-progress 明确标注 Beta："public on purpose，不含在插件、无 docs 页、可能无预警变化或消失"（`skills/in-progress/README.md:3`）；`retro` 更被单独标为 **STUB:仅有设计笔记，尚不可用**。
- deprecated 桶当前**为空**，治理惯例是"退役技能直接删除，删除它的 changeset 里写明它被什么取代"（`skills/deprecated/README.md:1`）。

## 2. 逐技能台账

处置列取值：**内化** / **改造内化** / **重叠**（点名资产）/ **参考**（仅登记）/ **排除**。

### 2.1 engineering（18）

| 技能 | md/行 | 目的 | 处置 | 关键机制与证据 |
| --- | --- | --- | --- | --- |
| ask-matt | 2/145 | 元路由（该用哪个技能） | **参考** | 7 步 flow 图 + 阶段边界 5 问决策树（`PHASE-BOUNDARIES.md:19-40`）。自述"这些都是口味判断…不是客观的"（`:53-55`）→ 文风非能力 |
| code-review | 1/87 | 固定点 diff 双轴评审 | **重叠→降级为 L0 增量** | 双轴 Standards/Spec（`:6-11`）、三点比较 + commit list（`:21`）、禁跨轴合并（`:76-78`）。**已验证 round26 已吸收**（R13 单轴下限 `verifier-logic.ts:200`；Fowler 12 基线已在 `coding-quality.md:311-322`）。仅剩 Spec 轴 "scope creep" 微增量 |
| codebase-design | 3/195 | 深模块设计词汇 | **改造内化** | 依赖四分类→测试策略（`DEEPENING.md:5-26`）、**两 adapter 才成真 seam**（`:29`）、deletion test（`SKILL.md:63`）、DESIGN-IT-TWICE 3+ 带约束矩阵（`DESIGN-IT-TWICE.md:19-44`）。**硬冲突**：`:34`「旧浅模块单测变成废物，删掉」vs code-health Phase 3 受保护测试 |
| diagnosing-bugs | 1/138 | 造"能变红的 feedback loop" | **改造内化（最高优先）** | Phase 1 四项验收：已跑过 / red-capable 断言用户确切症状 / deterministic / fast / agent-runnable（`:57-64`）；反锚定"红得起之前禁进 Phase 2"（`:66`）；10 种 loop 构造法按序（`:24-35`）；**3–5 条排序可证伪假设 + 预测格式**（`:88-96`）；一次一变量 + 日志唯一前缀（`:100-110`）；无 loop 须停下并向用户要三选一（`:53-55`）；重复率而非干净复现（`:49-51`） |
| domain-modeling | 3/181 | 领域词主动建模 | **部分内化（仅 ADR 门槛）** | ADR 入选三问：难逆 / 无上下文会困惑 / 真取舍（`ADR-FORMAT.md:31-37`）；CONTEXT.md 纯 glossary 禁实现决策（`SKILL.md:64`）。**排除其 CONTEXT.md/ADR 目录体系** —— 已与既有决议冲突（见 §8） |
| grill-with-docs | 1/7 | 访谈同时产 ADR+glossary | **排除** | 全文唯一实体内容为"Call the Skill tool twice"（`:7`），零机制 |
| implement | 1/15 | 按 spec/tickets 实现 | **排除** | "全量测试套件只在最后跑一次"（`:11`）**比 W-model 约束 #14 更松**，照搬会放松纪律 |
| improve-codebase-architecture | 2/194 | 扫深化机会出 HTML 报告 | **重叠（取 2 点）** | deletion test（`SKILL.md:35`）、强度三档 `Strong`/`Worth exploring`/`Speculative`（`:50`）、先候选后接口（`:60,64`）。**主体被 code-health 以严格得多的形式覆盖**；HTML/CDN/temp-dir/ADR 依赖一律丢弃 |
| prototype | 3/205 | 一次性原型答一个问题 | **改造内化（仅 LOGIC 支线 + 捕获纪律）** | question-first（`LOGIC.md:20`）、默认零持久化（`SKILL.md:23`）、跳过打磨无测试（`:24`）、state 可见（`:25`）、**捕获：有效决策折回真实代码 + 原型提交到 main 外 throwaway 分支作一手来源 + 在 issue 留 context pointer**（`:26`）；UI 支线 3 变体上限 5、生产构建隐藏变体开关（`UI.md:38,88-90`）。**未 vendor 的 `CONTEXT-FORMAT.md` 类比问题**：本技能 3 文件已全读，无缺锚问题 |
| research | 1/12 | 后台代理调研写 md | **参考（实为重叠）** | 仅 3 条：派后台代理（`:6`）、只查一手来源并追到源头（`:10`）、写单个 md 每条注明来源（`:11-12`）。与 A 子代理分派 + evidence provenance 重叠且更弱 |
| resolving-merge-conflicts | 1/14 | 解冲突 | **参考（须改写）** | "能并存则保留双方意图 / 不得发明新行为"（`:10`）可取；**"永远解析，绝不 `--abort`"（`:10`）是危险绝对化**，与 CHECKPOINT 用户确认权与可回滚语义冲突 |
| setup-matt-pocock-skills | 6/303 | per-repo 配置脚手架 | **排除** | 写 `docs/agents/*.md` + 编辑根 `CLAUDE.md`/`AGENTS.md`（`:11-13,91-109`）；四 tracker 模板含 GitHub/GitLab（`:44-47`）；把 CONTEXT.md/ADR 设为权威（`domain.md:6-11`）。**正面命中 W-model 两条"不引入"** |
| tdd | 3/174 | RED→GREEN 参考规范 | **改造内化** | **RED 不可验证**：全文不要求运行测试并观察失败（`:36`），无 RED 证据产物；"REFACTOR 不属于循环"与自身 description 自相矛盾（`:3` vs `:38`）。**真正价值是测试质量反模式**：tautological（期望值按代码同法重算，`tests.md:63-77`）、implementation-coupled（`:38-45`）、mock 只在系统边界（`mocking.md:3-13`） |
| to-spec | 1/75 | 从对话合成 spec 发到 tracker | **排除（完全重叠）** | 七段模板逐段命中 `templates/requirement-spec.md` §1/§2/§3/§8/§9/§10；seam-first 已在 phase-2/3/4。**round26/27 已吸收** |
| to-tickets | 1/105 | 拆 tracer-bullet 票据 | **重叠（仅取 1 处兜底）** | 垂直切片/blocking edges/wide refactor 已在 `phase-5-coding.md:105,138-147,175-182`。**唯一缺口**：`:40` 末句 —— migrate 批次自身无法保持 CI 绿时，共享 integration 分支并由一张 integrate-and-verify 票据统一承诺绿 |
| triage | 3/424 | issue/PR 分诊状态机 | **排除（仅登记 2 点）** | 整套平台绑定。可取两点：**`.out-of-scope/` 拒绝知识库**（概念粒度 + 入口概念相似度去重 + `Prior requests` 回链，`OUT-OF-SCOPE.md:3-6,17,70-82,84-88`）；**"先核实主张再受理"**（`SKILL.md:74`，bug 按 reporter 步骤复现、PR 检出跑测试）。round26 已看过该桶未采纳 |
| wayfinder | 1/128 | 大块工作决策地图 | **排除** | Fog 部分 `round27` 已完整吸收（锐利性判据 `phase-1-requirements.md:155`、out-of-scope 永不毕业 `:154`）；剩余 map/claim/并发编辑是 tracker 绑定的规划平行体，**与"单编排者 + CHECKPOINT + 单写者锁"直接冲突** |
| wizard | 1/44 | 生成 bash 人工运维向导 | **排除** | 写 `.env`/CI secret/账户状态，与"不接入平台账户状态"及证据脱敏白名单冲突；零重叠 |

### 2.2 productivity（7）

| 技能 | md/行 | 目的 | 处置 | 关键机制与证据 |
| --- | --- | --- | --- | --- |
| writing-for-agents | 2/103 | **写被 agent 消费的文档的元规则** | **内化（最高价值）** | 见 §5 M01；含 `.agents/invocation.md` 对应层见 §3.1 |
| grilling | 1/28 | 不放过的访谈直到设计树解完 | **改造内化** | 设计树 + **frontier（前提已解、现在就能问的问题集）**（`:6,8`）、一轮问整个 frontier 且**每题必须给推荐答案**（`:12-22`）、**找事实是 agent 职责，派 sub-agent 且不阻塞**（`:26`）、结束条件 = frontier 为空且用户确认（`:28`） |
| to-questionnaire | 1/54 | 把决策变成给"能答的人"的问卷 | **改造内化** | **"Grill the send, not the subject"**（只访谈用户永远能答的部分，`:9`）；三步各带 Done 判据（`:12-16`）；每题**一个想法绝不复合** + 答案 stub + 仅在可能被误读时加一行 `_Why this matters_`（`:20-54`）；**明确鼓励 "I don't know"**（`:20-54`） |
| teach | 5/284 | 跨会话教学 | **参考（仅 1 条）** | 仅取 learning-record 的 **"coverage is not learning, wait for evidence"**（`LEARNING-RECORD-FORMAT.md:31-42`）与 glossary 加词时机/必须表态（`GLOSSARY-FORMAT.md:29-35`）。HTML lessons + `./assets/` + "Think Tufte" + 认知科学部分全部排除（与"资产全 Markdown + TS"冲突） |
| handoff | 1/16 | 会话交接摘要 | **改造内化（落盘须改）** | 可取：**suggested skills 节**（`:10`）、**不复述已有工件改为按路径/URL 引用**（`:12`）、脱敏（`:14`）。**排除**"存到 OS 临时目录"（`:8`）—— 与 wm-write 并发/原子性与 provenance 冲突 |
| wait-what | 1/7 | 让 agent 重新 pitch | **参考** | 纯人类沟通风格（STE 英语 + CONTEXT.md 重述，`:7`），无独立机制 |
| grill-me | 1/7 | grilling 的用户入口别名 | **排除** | 一行 shim（`:7`），宿主 skill 机制产物 |

### 2.3 misc（4）

| 技能 | md/行 | 目的 | 处置 | 关键机制与证据 |
| --- | --- | --- | --- | --- |
| setup-pre-commit | 1/91 | 装 husky pre-commit + lint-staged | **改造内化（只取思想）** | **分层快慢分离**：pre-commit 先 staged-only 快层（lint-staged `prettier --ignore-unknown`），全量 typecheck+test 留慢层（`:37-45,91`）；缺脚本即降级告知不臆造（`:47`）；装完立即用新钩子提交一次作 smoke test（`:81-85`）。**硬冲突**：husky 把 `core.hooksPath` 指向 `.husky`，与 W-model `setup:hooks` 的 `.githooks` **直接互斥**，会静默废掉 18 项 pre-push |
| git-guardrails-claude-code | 1/95 | 拦截危险 git 命令 | **参考（不可移植）** | 9 条阻断正则（`scripts/block-dangerous-git.sh:6-16`）、`PreToolUse` hook（`:44-58`）、**exit 2 = 策略阻断**（`:18,95`）。**不可移植**：依赖外部 harness；且 agent 的 Bash 不流经 git hook，W-model 内不存在等价拦截点；退出码语义与 W-model `2 = 输入错误` 冲突 |
| migrate-to-shoehorn | 1/118 | `as` 断言迁到 shoehorn | **排除** | 强绑定 `@total-typescript/shoehorn` npm 包 + TS 测试断言场景；W-model 测试用 JSON fixture |
| scaffold-exercises | 1/106 | 生成课程练习骨架 | **排除** | 强绑定上游私有 CLI `pnpm ai-hero-cli internal lint` 与 aihero 课程布局 |

### 2.4 in-progress（8，上游全标 Beta）

| 技能 | md/行 | 目的 | 处置 | 关键机制与证据 |
| --- | --- | --- | --- | --- |
| setup-ts-deep-modules | 1/102 | dependency-cruiser 强制包边界 | **改造内化（仅反证协议）** | **"证明规则会咬人"**：干净态通过 → 故意注入违规 → 必须失败 → 回滚 → 必须再通过；若不失败说明规则没接对，必须修完（`SKILL.md:79-87`）。工具（dependency-cruiser + `src/packages/` 布局）排除 |
| loop-me | 1/32 | 把 workflow 逼成 spec | **改造内化** | **Push right**：checkpoint 尽量往后推，人"只被问一次，且问得很晚、材料齐备"（`:22`）；**Brief**：checkpoint 只呈现"产出了什么 / 为什么 / 指向资产的链接"，绝不呈现原始输出（`:23`）。**不违反 CHECKPOINT 不可绕过**（只重排位置，不删 checkpoint） |
| retro | 1/44 | 会话后复盘改进 agent 环境 | **改造内化（思想）** | 七类改进源（Navigation / Automated checks / Coding standards / Global AGENTS.md / Tool economy / No-ops / Information access，`:17-23`）；**实现与评审 context 压力不对称** → 硬结论"编码标准应由评审 agent 承担而非实现 agent"（`:31-35`）；`AGENTS.md` 会被推入每个 agent 上下文，必须极度克制（`:41`）；**No-ops 审计**（`:22`）。上游标 STUB，**不可引用为已验收实践** |
| implement-spec | 1/35 | 按任务图实现整份 spec | **改造内化（须剥离 2 处）** | 可取：**tickets 是任务图 + frontier 调度**（`:11`）、**context pointers 优先、子代理通信稀疏**（`:13`）、**每 implementer 独立 worktree**（`:25`）、merger 子代理（`:27-29`）。**须剥离**：建 PR + merger 自动合并 + 标 ready（`:23,27,33`，跳过人类审批）；"一次性修完全部问题"（`:31`，命中反模式 #18 跳过 R） |
| claude-handoff | 1/18 | 交给后台 agent | **参考** | 机制绑定 `claude --bg`（`:8`）；唯一增量"交接时列应加载技能清单"（`:12`）可并入 context-management-guide |
| writing-beats / writing-fragments / writing-shape | 1/67、1/79、1/79 | 散文写作三阶段 | **参考** | 可借的 explore/exploit 分离、grounding 概念账、"只追加不覆盖 + 写前从磁盘重读"——**W-model 已具备或更强**（A/S 分工、迷雾登记册、wm-write 回读） |

### 2.5 deprecated（0）

桶为空，仅 `README.md:1` 治理惯例（退役即删除 + changeset 指认替代者）。无内容可迁移。

## 3. 元层台账

### 3.1 invocation 调用模型（`.agents/invocation.md`）

| 规则 | 证据 |
| --- | --- |
| 单一分类轴 = 谁能触发，而非技能做什么 | `:3` |
| user-invoked：frontmatter `disable-model-invocation: true` + `agents/openai.yaml` 的 `policy.allow_implicit_invocation: false`，**两侧必须同步**；description 面向人类、剥掉触发词表 | `:5,10` |
| model-invoked 为默认；description 面向模型，保留 "Use when the user wants…" | `:6` |
| 判定标准："could the model usefully reach for this autonomously?"；并明示 **"Reuse is the reason to extract a skill, not the test."** | `:6` |
| 跨技能依赖必须写成**显式调用**（`Call the Skill tool with "grilling"`）；**禁止** `../other-skill/FILE.md` 深链，也禁止裸 `/skill` 留给模型猜 | `:16` |
| 一次调用一个技能；需要两个就写 "Call the Skill tool **twice**" | `:20` |
| **硬不变量**：user-invoked 永不可被调用；前置条件须改写为让人类执行的指令 | `:22` |

> 该仓库已因违反最后一条付出代价（§1.2 代价 2）。**这直接支持 W-model 现有"跨阶段交接须显式动作句"方向**。

### 3.2 文档写作规格（`.agents/writing-docs.md`，96 行）

固定骨架 `What it does` / `When to reach for it` / `Where it fits`（`:15`）+ 每节可判定门槛：必须陈述 **defining constraint** 且用陈述句（`:25`）、必须写明 **invocation mode**（`:31`）、必须给 **trigger boundary** 并与兄弟技能互指（`:32`）、中段必须**亮出 leading word**（`:42`）、`Common questions` 按真实证据排序禁止凑数（`:52`）、`It's working if` 每条必须**不打开 SKILL.md 就能验证**（`:60`）；**Done when 13 条清单**（`:81-96`）—— 事实上的写作门禁，但以散文存在、**无脚本执行它**。

排除的发布形态特有约束：不写 H1（`:11`）、链接绝对化（`:9`）、不写安装命令。

### 3.3 ADR 机制（`.agents/adr/` + `domain-modeling/ADR-FORMAT.md`）

- 编号 `0001-slug.md` 顺序递增（扫目录取最大号 +1，`:3`）；**惰性建目录**（首个 ADR 出现才建，`:5`）；模板"1-3 句：context + 决定 + 为什么"（`:13`）。
- **入选三问（全真才写）**：hard to reverse / surprising without context / result of a real trade-off（`:31-37`）。
- 合格类型含"边界与范围决策且 **explicit no-s as valuable as yes-s**"、"刻意偏离显然路径"、"代码里看不见的约束"（`:41-47`）。
- 自举观察：本仓格式文件说放 `docs/adr/`，实际放 `.agents/adr/`；`0002` 41 行含带日期的 Update 节，**远超"1-3 句"模板** → 说明该格式是**下限而非上限**，不应被 W-model 过度规格化。

### 3.4 out-of-scope 机制（`.out-of-scope/` + `triage/OUT-OF-SCOPE.md`）

- 双用途：**institutional memory**（为什么拒绝，不随 issue 关闭而丢失）+ **deduplication**（新请求命中旧拒绝时呈现旧决定而非重新辩论）（`:3-6`）。
- **一概念一文件，不是一 issue 一文件**（`:17`）；格式 = 短设计文档（决定 + `## Why this is out of scope` + 技术理由 + `## Prior requests` 回链）（`:23-54`）。
- triage 时**先读完整个目录**，按**概念相似度**匹配（"night theme" 命中 `dark-mode.md`）（`:70-82`）。
- **仅**在 enhancement 被 `wontfix` 时写入；已实现的 wontfix **禁止**写入（"would poison the dedup checks"）（`:84-88`）。
- 改变主意则**删文件**，不回开旧 issue（`:99-106`）。
- 本仓自举 3 篇，各对应一次真实请求（`mainstream-issue-trackers-only.md:25` 等带 `Prior requests` 与真实 issue 号）。

### 3.5 变更、发版与校验

| 项 | 结论 | 证据 |
| --- | --- | --- |
| changeset | 每篇 = frontmatter bump + **面向用户的散文说明**；9 篇几乎都是**元层自身**的规范变更（em-dash 清扫、术语统一、frontmatter 修复、invocation 不变量修复） | `.changeset/config.json:3-12`、`.changeset/*.md` |
| 发版 | `changeset version && sync-plugin-version.mjs`；release PR 由 CI 自动开 | `package.json:13`、`.github/workflows/release.yml:29-34` |
| **唯一真门禁** | `sync-plugin-version.mjs --check`：把 `package.json` version 抄进 `plugin.json`，漂移即 exit 1 | `scripts/sync-plugin-version.mjs:3-8,22-27` |
| **无一致性校验** | 无脚本检查 README/plugin.json 同步、docs 页齐全、frontmatter 合法、em-dash 清零 | 全仓 `scripts/` + `.github/` 实测 |
| local install | `link-skills.sh` 自述 dev-only、不接受修改；排除 deprecated/misc 但**保留 in-progress**（"this local install is exactly where that feedback loop runs"）；防呆：目标目录若指回本仓即报错退出 | `scripts/link-skills.sh:4-6,31,37-46` |

### 3.6 `docs/` 派生文档模型

**手写，不是 SKILL.md 派生摘要；无生成脚本；无一致性门禁。**

- 明确否定派生：`writing-docs.md:3` "The page is not the skill and not a copy of `SKILL.md`"；`:74` "never reproduces the `SKILL.md` steps or template dumps"。
- 内容独立性证据：`docs/engineering/code-review.md:52` 记录与 Claude Code 内置 `/code-review` 的名称冲突与可复现的 50+ agent 扇出 bug；`docs/engineering/triage.md:63,74,77,86` 引用真实 issue 号。
- 体量可比而非摘要（code-review 94 vs SKILL 87）。结构一致性**恰好为真但无人保证**：docs 页 25 = plugin.json 数组 25 = promoted 技能数，全仓 SKILL.md 37 = 25 + 8 + 4 + 0。
- 合规抽检通过：docs 内无安装命令、无相对链接。

> **W-model 可取的只有两个内容要素**：(a) `When to reach for it` 的 invocation mode + trigger boundary（对 `/wm` 子命令与 43 个 exit-2 门禁脚本都有用：每个门禁脚本应有一句"什么时候该跑它"）；(b) `It's working if` 的**不打开源文件即可验证**的可观测信号。形态（一技能一页）不适用。

## 4. 负边界台账（`.out-of-scope/` 三篇）

| 拒绝项 | 拒绝理由（摘要） | 逃生口 | 前例 |
| --- | --- | --- | --- |
| `mainstream-issue-trackers-only.md` | 每接入一个 tracker 后端就把一套 CLI 形状硬编码进技能（命令/flag/输出解析），是**永久维护面**，必须随工具 CLI 演进持续回归。**"mainstream" 是判断不是数字门槛**（准则："typical engineer 会认得出并可能为团队选它吗"） | 已有 `local markdown` 与 `other/custom` | #99 dex |
| `question-limits.md` | 给 grilling 加问题上限会：截断难问题或在简单问题上武断；**混淆两种失败模式**——"方案确实欠定"（设计如此）vs"问了冗余低价值问题"（提示词质量问题，修复属技能提示词而非计数器） | 自然语言随时可叫停 | #44 "Codex just asked me 200 questions" |
| `setup-skill-verify-mode.md` | 加 `--verify` flag 或兄弟技能会：与 setup 技能对话中已完成的工作重复；把**已能用自然语言表达**的功能拆成两个面，并带来两份技能随 seed 模板漂移的维护成本 | "跑 `/setup-…` 并告诉它去核验你当前配置" | #106 |

> **三条的共同启发式（可迁移）**：面对"加一个开关/上限/兄弟产物"的请求，先问它能否被**既有自然语言入口 + 既有逃生口**表达；若能，加面即负债。
>
> **边界声明（对抗性）**：该启发式**不构成削减 W-model 门禁的理由**。它拒绝的是"人类便利性核验入口"，而 W-model 的 `wm-export-evidence --verify` 返回**机器可消费的门禁结果**，属不同用途。该启发式只适用于"是否新增一个可由既有入口表达的人类便利开关"这一狭窄场景。

## 5. 候选机制矩阵（缺口驱动排序）

仪式层级：**A** = 纯 L0 规则文本（零新脚本/零新 schema）；**B** = 既有参考文档的规则增强；**C** = 确定性门禁/负向 fixture 扩展；**D** = 需新契约（schema/产物）。

| ID | 机制 | 外部证据 | W-model 缺口（点名资产） | 层 | 冲突 |
| --- | --- | --- | --- | --- | --- |
| M01 | 资产编写杠杆：no-op test（**行为性判据**："delete the line and ask whether the agent's behaviour changed"；失败删整句而非删词）、leading word（作为 token 重复而非句子；把模糊门变成二值可观测状态）、context load vs cognitive load、信息层级阶梯 + **progressive disclosure 的 branching 判据**、context pointer **措辞决定命中率** + 三剪枝、completion criteria（clarity + demand）与 premature completion 防御顺序、co-location、pruning 四刀 | `writing-for-agents/SKILL.md:12,16-18,22-27,31-39,41,47-52,63-72,78-81` | **无该层**。`references/` 按需加载是 progressive disclosure 的实现，但未成文；AGENTS.md 反例 #5"禁止一次性载入全部"**只有禁令、无判据**；全仓 grep `leading word/锚词/引导词` = 0 | A | 无 |
| M02 | 反模式**否定式表述整改**：整句否定会把被禁行为拖入上下文并提高其可用性；应写正面目标，禁止只在无法正面表述的硬护栏保留且**必须配正面目标** | `writing-for-agents/SKILL.md:74` | `hard-constraints.md` 48 条反模式主表头为 `\| # \| 反模式（不要做） \| 危害 \| 正确做法 \|`（`:186`），主表述仍是禁止式；**round26 已识别此缺口（其借鉴点 4）但从未落地**（无 plan、全仓无 `正向目标` 痕迹） | A | 无（检测信号列已部分满足"配正面目标"） |
| M03 | 测试质量反模式：tautological（期望值按代码同法重算，"passes by construction and can never disagree with the code"；期望值须来自独立事实源）、implementation-coupled（识别信号="重构但行为未变时测试碎掉"）、mock 只在系统边界、垂直切片禁 horizontal slicing | `tdd/tests.md:63-77`、`:38-45`、`mocking.md:3-13`、`SKILL.md:32` | 四级测试门禁（`check-artifact-gate.ts`）管"跑没跑/覆盖没"，**不管"这条测试是否真能证伪"** | A | 无 |
| M04 | CHECKPOINT 提问与呈现规范：grill-the-send（只问用户能答的，可查事实归 agent）、每题一想法绝不复合 + 答案 stub + 按需一行 `_Why this matters_`、明确鼓励 "I don't know"、每步自带 Done 判据；frontier（前提已解的问题集）+ **每题必给推荐答案** + 一轮一 frontier + 找事实派子代理且不阻塞；Push right + Brief（what/why/link 三段式，绝不抛原始输出） | `to-questionnaire/SKILL.md:9,12-16,20-54`、`grilling/SKILL.md:6,8,12-22,26,28`、`loop-me/SKILL.md:22-23` | `command-reference.md`「CHECKPOINT 统一清单」与 `checkpoint-logic.ts` 只管 decision 非空/内容具体（`:304`），**无提问写法与呈现格式规范** | A | 无（Push right 只重排位置不删 checkpoint，相容） |
| M05 | R 入场门：红信号四项验收（已真实跑过 / red-capable 断言**用户确切症状** / deterministic / fast / agent-runnable）+ 反锚定"红得起之前禁进假设"+ **3–5 条排序可证伪假设 + 预测格式**（"若 X 是因，则改 Y 让 bug 消失/改 Z 更糟"）+ 造不出须停下并向用户要三选一并置 blocked | `diagnosing-bugs/SKILL.md:53-66,88-96` | `root-cause-locator.md` 有 5-Why 纵向链、有"根因可证伪"（`:84`）、有"R 报告须附复现测试要求"（`:72-78`），**但没有"必须先有一个已跑过且能对本 bug 变红的单命令"的入场条件，也没有"测试前先出多条排序假设"** | A | **角色越界风险**：原技能让执行者自假设自插桩自修（= S 兼 R，命中反模式 #18）。内化必须保留 loop 由 S 造/跑、根因由 R 定 |
| M06 | **"证明规则会咬人"负向 fixture 协议**：干净态通过 → 故意注入违规 → 必须失败 → 回滚 → 再通过；若不失败说明规则未接通必须修完 | `setup-ts-deep-modules/SKILL.md:79-87` | 43 个 exit-2 门禁 + `samples/` + 332 条 self-test 只证明"**合法输入通过**"，**不证明"非法输入会失败"**（`check-samples-coverage.ts` 只校引用与矩阵声明） | C | 无（零依赖） |
| M07 | RED 证据可验证化：要求"曾观测到失败"的证据，把不可验证的 RED 变成可验证 | `tdd/SKILL.md:36`（当前不可验证）作为反例 | 同上：测试纪律缺"红过"证据 | C | 无 |
| M08 | `.out-of-scope/` 式**拒绝知识库**：概念粒度（非 issue 粒度）+ 入口处先读全量并按概念相似度去重 + `Prior requests` 回链 + 仅 rejected enhancement 写入 + 改主意则删除 | `triage/OUT-OF-SCOPE.md:3-6,17,23-54,70-82,84-88,99-106` | 阶段 1 迷雾毕业含"判 Out of Scope"（`phase-1-requirements.md:162`），但**单轮内判断、落于阶段文档、无跨轮次记忆、无入口去重**；全仓 grep `.out-of-scope` 零命中 | D | **须改造**：照搬自由目录会成为与 RTM/SSoT 并列的平行事实源（AGENTS.md 明令禁止） |
| M09 | 设计压力与 seam 负向判据：**两 adapter 才成真 seam**（一 adapter 只是假想 seam；无变化处不得引入 port）+ 依赖四分类→测试策略 + deletion test（"删掉是收敛复杂度还是搬家"）+ DESIGN-IT-TWICE（3+ 子代理**各带不同设计约束**：最小接口 / 最大灵活 / 优化最常见调用者 / ports&adapters，各出 5 项固定产物，最后给有主见的推荐） | `codebase-design/DEEPENING.md:5-26,29`、`SKILL.md:63`、`DESIGN-IT-TWICE.md:19-44` | phase-3/4 的 seam 节只回答"**选哪个** seam"（`phase-3-outline-design.md:189-214`、`phase-4-detailed-design.md:98-105`），**缺"该不该引入 seam"的负向判据**；备选方案要求为"≥2 个差异较大的草案"（`:13`），缺制造结构性差异的**约束矩阵** | A | **须改写**：其"旧浅模块单测变成废物，删掉"（`DEEPENING.md:34`）与 code-health Phase 3 受保护测试（`code-health-governance.md:44`）冲突，须改为走 Phase 3 路径 |
| M10 | ADR 入选三问门槛：难逆 / 无上下文会困惑 / 真取舍（全真才立档） | `domain-modeling/ADR-FORMAT.md:31-37` | `phase-2-system-design.md:17` 的 ADR 触发为"技术选型与 ADR"，**未设可逆性/困惑度门槛**，偏宽 | B | 无（**只取门槛，不建目录**，与 §8 既有决议一致） |
| M11 | expand-contract 兜底：migrate 批次自身无法保持 CI 绿时，共享 integration 分支并由一张 integrate-and-verify 票据统一承诺绿 | `to-tickets/SKILL.md:40`（末句） | `phase-5-coding.md:144-147` 只写到"每批 CI 绿"即止，**无 integration 分支 + integrate-and-verify 兜底票** | B | 无（1–2 行 bounded edit） |
| M12 | pre-commit 快层：staged-only（`prettier --ignore-unknown`）留在提交前；缺脚本即降级告知；装完立即提交一次作 smoke test | `setup-pre-commit/SKILL.md:37-45,47,81-85,91` | W-model **只有 pre-push，没有 pre-commit**：每次提交得不到快速反馈，代价全压在 push 时 | B | **硬冲突**：不得装 husky（`core.hooksPath` 互斥会静默废掉 18 项 pre-push）；须在原生 `.githooks/` 增 `pre-commit`。**源文更正见 §10**：源文的 `pre-commit` 内**同时**跑 lint-staged + 全量 typecheck + test，"快慢分层 / 慢层留 pre-push" 是 W-model 的改造落位，**不是源文原话** |
| M13 | 事件接驳前置核实："先核实主张再受理"——按 reporter 步骤复现、检出 PR 跑相关测试后再分类 | `triage/SKILL.md:74` | `event-ingress-guide.md` 无受理前核实；W-model 的复现测试是**失败后** R 流程（`root-cause-locator.md:72-77`） | B | 无 |
| M14 | Loop 4 输入：retro 七类改进源 + no-op 审计（找 steering 文件里**不改变 agent 行为**的指令）+ **"实现压力大、评审压力小，故标准归评审者"** → 风格/标准类规则应进 V 的 persona 与 `verifier-spec.md` 检查项而非 S 的 prompt | `retro/SKILL.md:17-23,31-35,41` | `hill-climbing-guide.md` 缺结构化审计维度；**W-model 尚未明写"标准归评审者"这条角色归位推论** | B | 无（上游标 STUB，须标注"思想来源，非已验收实践"） |
| M15 | 调用分类与跨阶段交接写法：invocation 分类（人类入口 vs 模型可达）+ 依赖写成**显式动作句**、禁深链/裸命令 | `.agents/invocation.md:3,5-6,16,20,22` | `subagent-delegation.md` 有分派完整性校验，但**缺"哪些入口仅人类可触发"的显式分类**；跨阶段交接仍以路径装载为主 | B | 部分：W-model 的"阶段细则按需加载"本身是路径装载，**不能一律废除**；限定为"跨阶段**动作交接**须显式，同阶段**参考装载**可路径化" |
| M16 | 单一权威文案纪律：会被多处复述的文案（安装/快速开始）建立单一权威块，明令消费者**不得复制、改为指向**（曾整体过期，处理方式是删除而非修正） | `.agents/install-block.md:3,39,53,55-57` | 安装/使用措辞散在 `README.md` / `docs/INSTALL.md` / `AGENTS.md`，无"一处权威、其余引用、禁复述"规则；`audit:l0-links` 管链接边界但不管**同段文案多副本漂移** | B | 无 |
| M17 | S 的 loop 构造方法清单（10 种按序：failing test → curl → CLI fixture diff → headless browser → replay trace → throwaway harness → property/fuzz → `git bisect run` → differential → HITL 兜底）+ 非确定性 bug 目标是**提高复现率**而非干净复现 | `diagnosing-bugs/SKILL.md:24-35,49-51` | R 入场门（M05）要求"红信号"，但**未给 S 构造信号的方法清单** | B | 无 |
| M18 | 受控低仪式探索通道：question-first（写代码前把问题写在可见处）+ 捕获纪律（有效决策折回真实代码；原型本体作一手来源保留；main 只留已验证决策）+ 默认零持久化 | `prototype/SKILL.md:23,26`、`LOGIC.md:20` | W-model 每条产物都被门禁/签名绑定，**缺一条被批准的、低仪式的探索通道**；该纪律可支撑迷雾"毕业成 REQ"的证据要求 | B | **须改写**："No tests"与约束 #14 冲突；须登记进 `.w-model` 状态（`disposable: true`）并补最小验证命令 |

**Instrumentation 边界（M05 附带）**：原技能**允许**经用户授权的临时生产插桩（`diagnosing-bugs/SKILL.md:55` 的 (c) 项、Phase 4 整段），并要求造不出 loop 时向用户要"可复现环境访问权 / 脱敏 artifact / 插桩许可"。W-model 目前**无此授权位**，须新增人类审批，且插桩写入属目标资产变更 → 应路由到既有 phase 5–8 而非由 R 自行实施。

## 6. 冲突台账（硬冲突，实现前必须解决）

| # | 外部主张 | 冲突的 W-model 不变式 | 处置 |
| --- | --- | --- | --- |
| X1 | husky 将 `core.hooksPath` 指向 `.husky`（`setup-pre-commit/SKILL.md:29-35`） | `npm run setup:hooks` 设 `.githooks`，18 项 pre-push | **不装 husky**，原生 `.githooks/pre-commit` |
| X2 | `exit 2` = 策略阻断（`git-guardrails/scripts/block-dangerous-git.sh:18-23`、`SKILL.md:95`） | 全仓 43 脚本 `2 = 输入错误 / ERROR_JSON` | 任何移植须重映射为 `exit 1` |
| X3 | 建 PR → merger 自动合并 → 标 ready（`implement-spec/SKILL.md:23,27,33`） | CHECKPOINT 不可绕过；code-health 人类 `ApprovalDecision` | 剥离 |
| X4 | "旧浅模块单测变成废物，删掉"（`codebase-design/DEEPENING.md:34`） | code-health Phase 3 受保护测试（默认拒绝删除，删测试须 `--guard` + 真实 pre/post 身份证据） | 改写为走 Phase 3 |
| X5 | 原型"No tests"（`prototype/SKILL.md:24`、`LOGIC.md:62`） | 约束 #14 改动后必须跑回归测试 | 补最小验证命令 |
| X6 | 交接/报告落 OS 临时目录（`handoff/SKILL.md:8`、`improve-codebase-architecture/SKILL.md:39`） | 状态写入经 wm-write（锁/mtime/备份/原子 rename）；provenance 证据白名单 | 改落 `.w-model/` 并走 wm-write |
| X7 | "永远解析，绝不 `--abort`"（`resolving-merge-conflicts/SKILL.md:10`） | CHECKPOINT 用户确认权；可回滚/失败链安全语义 | 改写为"默认继续解析，遇不可判定冲突升级 CHECKPOINT" |
| X8 | `CONTEXT.md` + `docs/adr/` 作为权威领域文档（`setup-matt-pocock-skills/domain.md:6-11`、`domain-modeling/SKILL.md:62`） | 既有决议：**不新建 CONTEXT.md/ADR 目录**（见 §8）；不引入平行事实源 | 排除该载体 |
| X9 | "一次性修完全部问题"（`implement-spec/SKILL.md:31`） | 反模式 #18（跳过 R 直接返工） | 剥离 |

## 7. 排除台账（含理由）

**整套排除**

| 技能/内容 | 理由 |
| --- | --- |
| to-spec | 完全重叠：七段模板逐段命中 `templates/requirement-spec.md`；seam-first 已吸收；round26/27 已处理 |
| to-tickets（整套） | 几乎完全覆盖（`phase-5-coding.md:103-194` 是严格超集）；仅保留 M11 |
| wayfinder | Fog 已被 round27 完整吸收；剩余层是 tracker 绑定的规划平行体，与单编排者/单写者锁冲突 |
| triage（整套） | 平台绑定（tracker + 标签 + issue 发布）；round26 已看过未采纳；仅登记 M08/M13 |
| wizard | 写 `.env`/CI secret/账户状态，与"不接入平台账户状态"及脱敏白名单冲突 |
| setup-matt-pocock-skills | 正面命中"不引入平台集成"+"不引入平行事实源"两条 |
| implement | "全量测试最后跑一次"比约束 #14 更松 |
| grill-with-docs / grill-me / wait-what | 零机制（7 行 shim / 纯沟通风格） |
| research（作为能力） | 12 行提示词，与 A 子代理分派 + evidence provenance 重叠且更弱 |
| migrate-to-shoehorn | 绑定 `@total-typescript/shoehorn` npm 包 + TS 断言场景 |
| scaffold-exercises | 绑定上游私有 CLI `pnpm ai-hero-cli internal lint` |
| git-guardrails-claude-code（脚本） | 依赖外部 harness；无等价拦截点；退出码语义冲突（X2）；仅登记"执行前否决"原则 |
| domain-modeling 的 CONTEXT.md/ADR 目录体系 | 与既有决议冲突（X8）；仅取 M10 门槛 |
| improve-codebase-architecture（作为新能力） | 主体被 code-health 以严格得多的形式覆盖（ledger + 人类审批 + 可回滚 + 门禁）；仅取 M09 的 2 点 |
| code-review（作为新命令/Overlay） | 双轴永不合并已被 round26 以 R13 单轴下限吸收（`verifier-logic.ts:200`）；Fowler 基线已在 `coding-quality.md:311-322`；仅剩 Spec 轴 scope creep 微增量 |
| setup-ts-deep-modules（工具部分） | dependency-cruiser 新 devDep 违反"脚本自包含"；布局绑定 TS 单体仓；仅取 M06 反证协议 |
| setup-pre-commit（husky/lint-staged） | `core.hooksPath` 互斥（X1）+ 新 devDep；仅取 M12 分层思想 |
| teach（HTML 教学产物） | 与"资产全 Markdown + TS"冲突；仅取 1 条证据门槛 |
| claude-handoff / handoff（OS tmp 落盘） | 产品绑定 + 落盘位置冲突（X6）；仅取指针纪律 |
| implement-spec（PR 自动合并 + 跳过 R） | X3 + X9；仅取 frontier/worktree/context pointer |
| writing-beats / writing-fragments / writing-shape | 散文写作域，非生命周期能力；可借的机制 W-model 已具备或更强 |
| resolving-merge-conflicts（绝对化条款） | "绝不 --abort"危险绝对化（X7）；仅登记改写后的版本 |
| deprecated 桶 | 空桶；仅登记"退役即删除 + changeset 指认替代者"惯例 |

**纯提示词风格、无迁移价值**（明确列出以免再被误当能力）

- ask-matt 的 flow 图与 `PHASE-BOUNDARIES` 五问树（自述为口味判断，`:53-55`）
- grilling 的 ❓/➡️ 版式（`SKILL.md:12-22`，机制本体另有其值）
- `HTML-REPORT.md` 的 Tailwind/Mermaid CDN、配色、"no hedging" 等版式与文风指导（仅"before/after 对比图强制"与"每卡固定字段"算机制）
- teach 的 quiz 答案等长技巧与认知科学部分
- code-review 的 smell baseline 表述（内容已吸收，重复吸收无增量）
- diagnosing-bugs 的 redact 段（W-model 已有 `wm-export-evidence.ts` 脱敏导出）
- `docs/` 的发布形态约束（无 H1 / 绝对链接 / 不写安装命令）

## 8. 与既有决议的关系（避免重复吸收）

**本仓库已有对外部仓库的调研与吸收记录**，本报告须与之一致：

| 既有决议 | 内容 | 本报告结论 |
| --- | --- | --- |
| round26（`2026-07-30-round26-external-skills-absorption-design.md:16`） | 全量精读 6 分桶（plugin / ADR / .out-of-scope / changeset / CI / scripts + 写作元理论、triage、code-review 双轴、domain-modeling、prototype、codebase-design、implement 系列）；认定**最大缺口是 skill-writing 元理论层（No-op / Negation / Predictability / 信息层级阶梯）**；选出 5 项借鉴点 | **一致**。本报告 6 组独立调研得出同一结论（M01 即该层）。round26 的 5 项中 4 项已落地，**其借鉴点 4（No-op/Negation 元理论审计）从未落地**（无对应 plan；全仓 grep `正向目标`/`leading word` 零命中）→ 由 M02 + M01 承接 |
| round26 已落地：借鉴点 1 | verifier 单轴下限 | ✅ `verifier-logic.ts:200` R13 |
| round26 已落地：借鉴点 2 | Fowler 12 气味固定基线 | ✅ `coding-quality.md:311-322` |
| round26 已落地：借鉴点 3 | GLOSSARY + `_Avoid_` 术语治理 | ✅ `conventions.md:12,14`（并标注来源为外部 `CONTEXT-FORMAT.md`） |
| round26 已落地：借鉴点 5 | Agent Brief durability（符号级契约，禁文件路径/行号） | ✅ `phase-5-coding.md:162,166-173` |
| round27（`2026-07-30-round27-wayfinder-fog-absorption-design.md`） | 吸收 wayfinder 的 Fog of War | ✅ `phase-1-requirements.md:147-169`；本报告对 wayfinder 剩余部分判排除 |
| `evidence-anchored-tree.md:72` | 「新增 CONTEXT.md/ADR/ 文档体系」→「已有 conventions.md + decision-log/」→ **不新建目录** | **本报告沿用**：X8；C5 以 CONTEXT.md 形态引入 glossary 会与该决议直接冲突 |
| `skillopt-adoption.md:41,69-73` | bounded edit 边界规则：**单文件单次 ≤3 处 / 单信号 ≤2 文件 / 全轮 ≤15 处** | **本报告 M 项须按此裁剪分批**；v2 分期不得突破该边界 |

**外部仓库自身的演进（须记录）**：round26 引用的 `writing-great-skills/GLOSSARY.md` 在本次 pinned commit 已不存在，对应内容迁入 `skills/productivity/writing-for-agents/`（SKILL.md + SKILL-MECHANICS.md）。同一机制的上游路径已变，**采纳主张必须以本报告的 commit 与路径为准**。

## 9. 台账自检

- **覆盖完整**：37 个 `SKILL.md`（18 + 7 + 4 + 8 + 0）与元层 7 类内容均已登记，无遗漏分组。
- **证据可定位**：全部结论带 `文件:行号`；来源 commit 与路径已固定（§0）。
- **缺口可验证**：M 项的"W-model 缺口"列均点名具体资产与行号，可独立复核。
- **冲突与排除均已记账**：§6 九条硬冲突、§7 全量排除理由，不含"待定"项。
- **未越权**：本报告全程只读，未修改外部仓库与本仓库任何文件；未声称任何能力已存在。

## 10. vendor 复核修正（2026-09-14）

P0a 原文固化时对每个采纳项做了逐字摘录与实测行号复核，结果如下。**权威证据锚点自此为 vendor 文件**（[`docs/superpowers/sources/2026-09-14-mattpocock-skills-adopted-excerpts.md`](../sources/2026-09-14-mattpocock-skills-adopted-excerpts.md)，735 行 / 18 节 / 22 个源文件 SHA-256 实测），本台账的行号降级为导航参考。

### 10.1 实质修正（影响结论表述）

| 项 | 原表述 | 源文实际 | 处置 |
| --- | --- | --- | --- |
| **M12** | "分层快慢分离：pre-commit 先跑 staged-only 快层（lint-staged `prettier --ignore-unknown`），**全量 typecheck+test 留慢层**" | 源文 `setup-pre-commit/SKILL.md:42-44,91` 的 `.husky/pre-commit` **同时**执行 `npx lint-staged`、`npm run typecheck`、`npm run test`（L91 自述 "then full typecheck and tests"）→ **全量 typecheck+test 就在 pre-commit 内** | **"快慢分层 / 慢层留 pre-push" 是 W-model 的改造落位，不是源文规则**。"采纳分层思想"这一处置不变，但不得声称该分层来自源文 |

### 10.2 行号修正（精度）

| 项 | 台账记 | 实测 | 说明 |
| --- | --- | --- | --- |
| M04 | `to-questionnaire/SKILL.md:20-54`（整节） | L36、L40、L42-48 | 按"最小证据"只摘支撑要点的行段；L21-35 / L49-54 为模板版式与收尾句，未 vendor |
| M10 | `ADR-FORMAT.md:31-37` | 三问正文 31-37 一致；摘录块含节标题 L29 | 为可读性含 L29，块内标 `[L29-37]` |

其余 16 项（M01/M02/M03/M05/M06/M07/M08/M09/M11/M13/M14/M15/M16/M17/M18）行号**与台账一致**，无需修正。M07 被判定为**负面证据**（源中不存在"运行并观察失败"的要求），未伪造摘录，已摘最接近的对照原文（`tdd/SKILL.md:36`）并注明核对范围。

### 10.3 未确证项

**无。** 18 项全部完成实测复核，无遗留无法确证之处。
