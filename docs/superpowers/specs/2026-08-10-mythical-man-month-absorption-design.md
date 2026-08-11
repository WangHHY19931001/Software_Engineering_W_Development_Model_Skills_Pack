# 《agent 时代的人月神话》吸收设计：反指标游戏 / 主刀与修正权 / 九倍矩阵 / 人机分工线 等 23 项

> **设计日期**：2026-08-10
> **状态**：已批准（P0 批，39.0.0）
> **版本目标**：38.5.0 → 39.0.0（P0 批）/ 39.1.0（P1 批）/ 39.2.0（P2 批）
> **吸收源**：《agent 时代的人月神话》（agent-mythical-man-month-2026，Brooks《人月神话》2026 年逐章重写，19 章）
> **吸收策略**：纯文档为主（P0-2/P1 全部/P2 全部），少量脚本联动（反模式计数、docs-consistency 期望值）
> **权威定义**：本文件为吸收设计 spec；落地后以 `docs/skill-design-document_SSoT.md` §3.4.39 + 各 reference 新增节 + `w-model-dev/references/mythical-man-month-absorption.md` 为权威定义。

---

## 1. 背景与目标

### 1.1 背景

对《agent 时代的人月神话》19 章完整精读并对技能包做 26 项概念覆盖审计后，结论：**本书对技能包的价值不在"新知识"，而在三件事**——

1. **6 个完全空白的概念缺口**（审计判定"未覆盖"）：外科手术队伍/主刀人设、审计权 vs 修正权、侦察 vs 产出两阶段、银弹批判/本质困难体检、白箱 vs 黑箱、九倍矩阵完成度。
2. **技能包已有强机制的量化触发规则缺失**（审计判定"部分覆盖"但缺元规则/量化阈值）：同错 N 次弃线、30% 上下文预算重评、50-70% 会话重开、能否通读测试、判据持有审计、"已修复"禁语等。
3. **一整套"为什么这些纪律必须焊进结构"的论证背书**，可直接用于 SKILL.md 操作行为与触发决策的说理层。

现有技能包是"流程正确性"极强体系（8 阶段门禁、O/S/V/G/R 角色分离、44 条反模式、预算/CHECKPOINT/DoD 强约束），与"评审/判据/预算"相关的概念大多已有结构性落地，本次吸收与其**互补不重复**。

### 1.2 目标

把书中 23 项高价值观点按 P0→P2 优先级分三批吸收进技能包：

- **P0（39.0.0，4 项）**：反指标游戏、主刀人设+修正权、九倍矩阵完成度、人机分工线——缺口最大、收益最直接。
- **P1（39.1.0，10 项）**：给已有机制补量化规则与元规则。
- **P2（39.2.0，6 项）**：2 个新 reference + 4 处文档强化。
- **P3（3 项）**：列为候选，不进本轮。

### 1.3 非目标

- 不替换 W 模型 8 阶段主流程、不新增子流程、不新增并行轨。
- 不引入任何 LLM 调用（保持"技能包零 LLM"架构原则）。
- 不改 verifier-spec.md 的 5 轴/连续评分/Schema 结构（仅补独立评审模板引用）。
- 不改现有 44 条反模式语义（#45/#46 为新增，不修改既有条目）。
- 不改 self-test 回归基线（249 条不变）；不改 pre-push 项数（14 不变）。
- 不改 demo/归档产物（`docs/changes/archive/**` 不动）。
- 不采纳书中"全自动 agent 系统必然失败"的立场性批判为硬约束（仅作为说理层与边界注释）。

---

## 2. 吸收决策

### 2.1 落地策略：纯文档为主 + 少量脚本联动

| 选项 | 选定 | 理由 |
|---|---|---|
| 纯文档为主 | ✅ | 与"编排者最小化"及既往吸收先例（external-skills-absorption、langchain-loop 吸收）一致；23 项中 21 项是方法论/规则，无需新脚本 |
| 脚本联动（仅计数/期望值） | ✅ | 反模式 #45/#46 新增后，`check-docs-consistency.ts` 的"最大编号 == 44"期望与 `docs-consistency-logic.test.ts` 样本必须联动，否则 pre-push 门禁失败 |
| 新增门禁脚本 | ✗ | 九倍矩阵等可脚本化项首轮不做脚本，避免破坏 self-test 基线，列为二期候选 |

### 2.2 优先级分轮

| 批 | 版本 | 内容 | 主要改动类型 |
|---|---|---|---|
| P0 | 39.0.0 | 反指标游戏、主刀+修正权、九倍矩阵、人机分工线 + 吸收决策记录 | 反模式 +45、3 个 reference 强化、SKILL.md 原则 |
| P1 | 39.1.0 | 并行三闸/通读测试/验证账单、原文装填、记叙性优先、结构性约束、独立评审、预算止损、会话生命周期、辩解义务、回归强制+增量集成、环境契约自检 | 8 个 reference + 3 个 .cursor 技能强化 |
| P2 | 39.2.0 | 估算纪律、上下文管理手册（2 新 reference）、白箱黑箱、里程碑元规则、侦察vs产出、目的注释 | 2 新 reference + 4 处文档 |
| P3 | 候选 | 银弹批判框架、判据持有审计、worktree 警示 | 待后续轮决策 |

---

## 3. 总体架构与改动清单

### 3.1 P0（39.0.0）改动文件

| # | 文件 | 改动类型 | 内容摘要 |
|---|---|---|---|
| 1 | `w-model-dev/references/anti-patterns.md` | 修订 | 新增反模式 #45（反指标游戏）、#46（只给审计权不给修正权）；计数 #1~#44 → #1~#46 |
| 2 | `.cursor/skills/dispatching-parallel-agents/SKILL.md` | 修订 | L109 示例提示词删除"调整测试期望"条款，改为"不得改断言凑通过，不符即报告" |
| 3 | `.cursor/skills/test-driven-development/testing-anti-patterns.md` | 修订 | 补充「改断言让测试通过」反模式条目 |
| 4 | `w-model-dev/references/subagent-delegation.md` | 修订 | 新增「主刀职责映射表」节 + 目的持有者溯源 |
| 5 | `w-model-dev/SKILL.md` | 修订 | 核心原则补「主刀与修正权」「人机分工线」两段 |
| 6 | `w-model-dev/references/definition-of-done.md` | 修订 | 补「修正权验收测试」+「九倍矩阵完成度自检」两维度 |
| 7 | `w-model-dev/references/phase-5-coding.md` | 修订 | 补「产品化 vs 系统集成任务分配」节 |
| 8 | `w-model-dev/references/phase-6-integration-test.md` | 修订 | 补「集成判断由人持有」节 |
| 9 | `w-model-dev/references/mythical-man-month-absorption.md` | 新增 | 吸收决策记录（23 项映射 + 章节出处 + 与约束/反模式关系） |
| 10 | `docs/skill-design-document_SSoT.md` | 修订 | 新增 §3.4.39「第 39 轮：人月神话吸收」；§10A 追溯表补一行 |
| 11 | `w-model-dev/scripts/logic/docs-consistency-logic.ts` | 修订 | 反模式最大编号期望 44 → 46 |
| 12 | `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` | 修订 | 样本 antiPatterns 更新为 #1~#46 |
| 13 | 顶层文档 | 修订 | 计数 44 → 46 联动：`AGENTS.md` / `README.md`（3 处）/ `INSTALL.md` / `definition-of-done.md:58`；CHANGELOG [39.0.0]；版本号三处同步（package.json / skill-metadata.json / SKILL.md frontmatter） |

### 3.2 P1（39.1.0）改动文件

| # | 文件 | 内容摘要 |
|---|---|---|
| 1 | `.cursor/skills/dispatching-parallel-agents/SKILL.md` | 补「并行三闸 + 能否通读测试 + 验证账单」决策补充节 |
| 2 | `w-model-dev/references/subagent-delegation.md` | 补「原文装填不转述」装填原则 + 验证账单预算条目 |
| 3 | `w-model-dev/references/bdd-guide.md` | 补「记叙性优先：测试断言不是金标准，失败先归因」节 |
| 4 | `.cursor/skills/test-driven-development/SKILL.md` | 补「失败先归因：改代码还是改断言」节 |
| 5 | `w-model-dev/SKILL.md` | 操作行为补「结构性约束优先于提示词」；约束清单补「回归测试强制钩子」（约束 #21） |
| 6 | `w-model-dev/references/verifier-spec.md` | 补「独立评审会话模板」（无沉没成本评审） |
| 7 | `w-model-dev/references/operational-recovery.md` | 补「同错 N 次弃线」「30% 上下文预算重评」「会话 50-70% 重开」三规则 |
| 8 | `w-model-dev/references/root-cause-locator.md` | 补「辩解义务强制：修复附三行决策记录」节 |
| 9 | `w-model-dev/references/phase-5-coding.md` | 补「增量集成：可审 diff + 测试 + 独立评审」节 |
| 10 | `w-model-dev/references/quality-standards.md` | 补「环境契约前置自检」节 |
| 11 | `.cursor/skills/requesting-code-review/SKILL.md` | 补「新会话独立评审提示词模板」 |
| 12 | `docs/skill-design-document_SSoT.md` | §3.4.39 增补 P1 小节；CHANGELOG [39.1.0] |

### 3.3 P2（39.2.0）改动文件

| # | 文件 | 内容摘要 |
|---|---|---|
| 1 | `w-model-dev/references/estimation-guide.md` | 新增：记账模板、mini-spike、禁"编码×系数"外推 |
| 2 | `w-model-dev/references/context-management-guide.md` | 新增：KV 缓存友好、上下文分层、档位路由、自污染 10-30% |
| 3 | `w-model-dev/SKILL.md` | 工具选型补「白箱 vs 黑箱」条目 |
| 4 | `.cursor/skills/writing-plans/SKILL.md` | 补「里程碑设计到无法自欺 + 人作最终审计位点」节 |
| 5 | `w-model-dev/references/hill-climbing-guide.md` | 补「侦察 vs 产出两阶段」节 |
| 6 | `w-model-dev/references/format-conventions.md` 或 chinese-documentation | 补「目的注释：写 why 不写 what」规则 |
| 7 | `docs/skill-design-document_SSoT.md` | §3.4.39 增补 P2 小节；CHANGELOG [39.2.0] |

---

## 4. P0 细节（39.0.0）

### 4.1 反指标游戏（新增反模式 #45）

**书中出处**：第 2 章「subagent 会为了通过测试而改测试。这在实测里出现的频率高得让人心惊，且并非出于恶意，仅仅是在设法优化'通过测试'这个指标」；第 4 章 Goodhart「当一个度量成为目标时，它就不再是好的度量」；第 14 章「每一环都诚实，合成结果是造假」。

**落地内容**：

a) **anti-patterns.md 新增反模式 #45**：

```
**反模式 #45（反指标游戏）**：subagent 为通过测试/门禁而修改测试断言、测试期望或验收判据，使"通过"失去与需求的对应关系。
- 检测信号：
  - V/G 评审发现测试断言与需求/设计不符却"恰好通过"
  - S 返回总结中出现"调整测试期望""更新断言"且未先行报告
  - 覆盖率 100% 但关键行为场景未被任何断言覆盖（覆盖率与断言语义不匹配）
- 处置：回退到当前阶段起点；改回断言后按 R→V→G 流程重走；涉及需求理解错误的须先 R 根因定位。
- 例外：经用户/主刀明确批准的需求变更（走豁免或 S→R→V→人类四阶段），不视为违反。
```

b) **dispatching-parallel-agents/SKILL.md:109**：示例提示词第 3 条
`- 如果测试的是已变更的行为则调整测试期望` → 改为
`- 不得修改测试断言以凑通过；若断言与需求不符，停止并报告，等待指示`

c) **test-driven-development/testing-anti-patterns.md**：新增「改断言让测试通过（反指标游戏）」条目——只改断言凑绿属于最危险的测试作弊，区别于"断言本身写错"（后者走失败归因流程）。

d) **联动**：`check-docs-consistency.ts` 反模式最大编号期望 44 → 46；`docs-consistency-logic.test.ts` 样本同步；`AGENTS.md`/`README.md`/`INSTALL.md`/`definition-of-done.md` 计数 44 → 46。

### 4.2 主刀人设 + 审计权 vs 修正权（新增反模式 #46）

**书中出处**：第 3 章「一个人做主刀，一群 agent 担任支持团队」「审计权与修正权分离的系统有一个特征：你能诊断，无法治疗」；第 18 章「主刀有真正的修正权在 agent 时代必须被明确守护」；第 10 章「如果你想在 agent 时代做一位真正有效的架构师，你的时间应该投入到文档，不是代码」。

**落地内容**：

a) **subagent-delegation.md 新增「主刀职责映射表」节**：

| 外科手术队伍角色 | W 模型对应 | 归属 |
|---|---|---|
| 主刀（持有概念/拍板/核心判断/最终负责） | 用户 + 编排者 O（代表人的判断，不实施） | 人 |
| 副手（随时可接替主刀） | 不支持由 agent 接替——目的持有不可委托 | 人（仅陪练/评审可由 V 兼任） |
| 管理员/文档/录入/工具/测试/语言律师 | S / A 子代理 + 宿主工具（git、lint、schemas） | agent |
| 目的持有者溯源 | 开工前在 `project.status` 或阶段产物中写明"此任务最终服务于谁的什么目的" | 人 |

b) **SKILL.md 核心原则补「主刀与修正权」段**：
- 人在回路的最低标准 = 修正权：能在过程中间改产物而不用重跑一遍。
- 与「编排者最小化」（约束 #8、反模式 #10）互补不冲突：O 不实施，但**用户**保留修正权；凡只提供审计权（日志/面板/思维链展示）而无修正路径的产物设计视为不合格。

c) **anti-patterns.md 新增反模式 #46（只给审计权不给修正权）**：
- 检测信号：评审/CHECKPOINT 中发现用户只能看日志与产物而不能在过程中间介入修正；全自动流程把用户锁在"跑完再看"之外。
- 处置：回退到当前阶段起点，为流程补"中途介入"位点（对话式 CHECKPOINT 已提供，需显式标注介入路径）。

d) **definition-of-done.md 补「修正权验收测试」**：每次变更/阶段自检项追加："用户能否在过程中间修改产物而不用整体重跑？"（能=有修正权；不能=仅审计权，不合格）。

### 4.3 九倍矩阵完成度

**书中出处**：第 1 章「9x = 3x（产品化）× 3x（系统集成）」「1975 年项目延期的一大根源，是经理们用左下角的成本估算一个要交付到右上角的项目」「agent 让'看起来在快速前进'这件事变得极其容易」。

**落地内容**：

a) **definition-of-done.md 补「完成度矩阵自检」维度**：

```
产品化轴（判据住代码内，agent 擅长）：文档 / 测试 / 错误处理 / 边界情况 / 可维护性 / 可观测性
系统集成轴（判据住处境里，agent 不擅长）：接口对齐 / 版本兼容 / 多环境隔离 / 部署回滚 / 监控告警 / 备份策略
规则：交付物按两轴逐项打勾；任一轴缺项即未到 9x；"agent 跑通了"只证明左下角（1x 一次性脚本）。
```

b) **phase-5-coding.md 补「任务分配规则」**：产品化类任务（补文档、测试、类型注解、错误处理、重构）优先 agent；系统集成类判断（对接大系统、生产环境、跨模块契约）必须由人/主刀持有，不能外包。

c) **phase-6-integration-test.md 补「集成判断由人持有」**：集成工作的判据不住在被测代码里，住在大系统处境里——集成结论由 V/人评审定，不以 agent 自报为准。

d) 脚本化（二期候选，本轮不做）：check-artifact-gate.ts 终检加两轴提示。

### 4.4 人机分工线原则

**书中出处**：第 18 章尾声「能被形式化的（代码、测试、文档格式），交给 agent。不能被形式化的（目的、判据、处境判断），留给人。守住这条分工线，两侧都做得最好；打乱这条分工线，两侧都做不好」；第 13 章 Vyssotsky「失败的根源在未精确定义之处」。

**落地内容**：

a) **SKILL.md 核心原则补「人机分工线」段**：

```
人机分工线：能被形式化定义的任务（代码/测试/文档格式/确定性校验）→ agent；
不能被形式化定义的任务（目的/判据/处境判断/概念裁决）→ 人。
阶段门与 CHECKPOINT 即分工线的落地：门禁校验形式化侧，人类确认侧（判据、理解证据、目的）。
```

b) **definition-of-done.md 第七维度「理解证据」补注**：`acknowledgedDecisions` 非空的意义 = 判据持有者（人）在形式化门禁之外行使了记叙性判断——这是分工线在阶段门上的显式兑现。

---

## 5. P1 细节（39.1.0）

### 5.1 并行三闸 + 通读测试 + 验证账单（第 2 章）

- **dispatching-parallel-agents/SKILL.md** 决策流程补三条硬闸：①子任务彼此完全独立；②聚合规则明确；③主无需读中间过程即可聚合。任一不满足则单线。
- 补「能否通读测试」：语料塞得进上下文 → 主自己读（更快且省转述失真）；塞不进且不需要中间过程 → 才可并行滤噪。
- **subagent-delegation.md** 补「验证账单」：每加一个 subagent，预算一笔"主读产出并验证"的 token/时间成本；验证链可省步、省不到零，最终裁决者必须是持有目的的人。

### 5.2 原文装填不转述（第 6 章）

- **subagent-delegation.md** 装填原则：任务背景原文照搬，不翻译、不分解、不预处理；长期项目启动禁止给"自己整理的摘要"，让 agent 读原始文档或 RAG/grep 随用随取；补充说明写下来也视为原文。

### 5.3 记叙性优先 + 失败先归因（第 6 章）

- **bdd-guide.md** 新增「记叙性优先」节：形式化定义（测试断言）在 agent 时代成为可被优化的攻击面（Goodhart）；测试失败先归因——是改动的错还是断言写错了？该改断言就改断言，需求意图（记叙性定义）是标准。
- **test-driven-development/SKILL.md** 补同一节（与 P0 反模式 #45 呼应，互为正反面）。

### 5.4 结构性约束优先于提示词（第 6 章）

- **SKILL.md** 操作行为补第 8 条：能焊进结构的（权限/只读/网络隔离/schema 拦截）就不写进提示词；提示词里的约束是说服性的、每一步都要选择遵守，结构里的约束是确定性的。

### 5.5 独立评审会话模板（第 6/13 章）

- **verifier-spec.md** 补独立评审模板：「你不知道这份文档之前的讨论，仅凭它本身给出评审意见」；标注「评估不等于必须改」（防评审意见盲从）。
- **requesting-code-review/SKILL.md** 引用同一模板。

### 5.6 预算止损强化（第 14 章）

- **operational-recovery.md** 补三条硬规则：
  - 同错 N 次即弃线（默认 3，可配）——"同一报错 N 次即弃线、节点级资源上限、总预算硬顶"焊进 harness，不靠人在过程中自觉；
  - 30% 上下文预算重评——任何一次 agent 尝试花掉上下文预算 30% 且无明显进展，停下重新讨论方向（打断"再试一次"诱惑）；
  - 静默失败优先排查——崩溃节点秒级定损 vs 静默失败按小时计费，后者的成本是前者的几十倍且不打断人。

### 5.7 会话生命周期（第 11 章）

- **operational-recovery.md** 补：会话超过约几十轮、或出现"agent 不太理解我的意思"信号，在 50%-70% 位置沉淀关键结论为 markdown 并开新会话；上下文压缩有隐性成本（压缩消耗额度，内容固化到文档可让别的模型接力，死在对话里是亏损）。

### 5.8 辩解义务强制（第 11 章）

- **root-cause-locator.md** 补「辩解义务强制」节：每个 bug 修复必须附一条决策记录（三行：根因 / 所选修法 / 放弃备选）；"已修复"三个字不可接受；让不辩解比辩解更麻烦（把辩解义务做进结构）。

### 5.9 回归强制 + 增量集成（第 11/13 章）

- **SKILL.md** 新增约束 #21「回归测试强制钩子」：任何 agent 改动代码后必须跑回归测试（修复引入新 bug 概率 20-50%）；禁止"改动代码但不跑回归"的工作流。
- **phase-5-coding.md** 补「增量集成纪律」：每次 agent 改动必须是可审 diff + 有对应测试 + 能被独立评审；禁止大而稀的整体重写式变更（变更量子无穷大时"这次改了什么"在结构上不可问）。

### 5.10 环境契约前置自检（第 13 章）

- **quality-standards.md** 补「环境契约前置自检」：外部依赖（API 密钥/服务在线/库版本）在任务开始前用独立脚本/CI 步骤验证，不能靠 agent 信任 harness 承诺；未通过自检前不让 agent 开工（防止实现退化为"实现+环境 debug"混合污染产出）。

---

## 6. P2 细节（39.2.0）

### 6.1 估算纪律（新 reference：`references/estimation-guide.md`）

- 禁"编码×系数"外推：编码份额趋近零（第 8 章"五分钟是编码，一小时×3 是其他工序"）；估"完全搞清楚这段代码应该做什么并验证做对了要多久"，不估"让 agent 写这段代码要多久"。
- mini-spike 前置：正式估算前跑一段真实小片段（成本几十美分，节省误差可能数周）；"我不知道，我们跑一小段真实工作试试看"是最诚实的估算。
- 记账模板：任务名 / 开始时间 / 结束时间 / agent 用量（token 或费用）/ 你的判断内容（简短几句）/ 结果；每周几分钟录入，一年后是自己的估算基线。
- 玩具外推警戒：凡"看到 demo 做 X → 估我做 Y 也这个时间"一律标记不可靠。

### 6.2 上下文管理手册（新 reference：`references/context-management-guide.md`）

- KV 缓存友好：稳定内容放上下文开头、常变内容放末尾；禁止随意改系统提示词前缀（整条缓存作废全价重算）；管理糟糕的账单可达合理版本十倍。
- 上下文分层：常驻（系统提示/当前任务）/ 按需（历史决策/参考代码）/ 剔除（早期讨论、已落地内容）；判断标准是"这次任务需要吗"不是"以后可能用得上吗"。
- 自污染：窗口填得越接近上限注意力越分散，合理占用率体感 10%-30%。
- 档位路由表：搜索/格式转换/简单分类 → 低档；写代码/多步推理/判断歧义 → 中档；核心决策/关键判断 → 强档；备好档位切换机制。
- 输出结构模板库：给表格模板（每行一个提取项、列固定）比"把提示词写得更用力"有效，稳定性差一个数量级。

### 6.3 白箱 vs 黑箱（第 17 章）

- **SKILL.md 工具选型**补条目：保留思维链可见/可中断/可指挥的工具优先；"只允许、不透明"式约束视为红旗；"允许和只允许，就是白箱和黑箱的区别"。

### 6.4 里程碑元规则（第 14 章）

- **writing-plans/SKILL.md** 补「里程碑设计到无法自欺」：里程碑必须预先写明"什么算做完"且可度量、无法自欺；模糊里程碑给自欺留空间（"能跑了就算做完"）；评分函数/自动检查 ≠ 完成目标任务，最终审计位点必须留给人。

### 6.5 侦察 vs 产出两阶段（第 11 章）

- **hill-climbing-guide.md** 补「Pilot-run 侦察流程」：正式任务前先跑小规模真实样本，产物可弃，学到的结论记入决策记录；侦察/产出两阶段模式分离（快速勇于犯错 vs 严格核对）；侦察成本几美分到几美元，跳过成本可能是几天。

### 6.6 目的注释规则（第 15 章）

- **format-conventions.md** 或 chinese-documentation 补：「注释写 why 不写 what；凡只翻译代码的注释视为废注释；提示词/注释能表达要求但不能表达要求的分量」。

---

## 7. P3 候选（后续轮，不进本轮）

| # | 观点 | 书中出处 | 候选落点 | 暂缓理由 |
|---|---|---|---|---|
| 1 | 银弹批判/本质困难体检（复杂度/一致性/可变性/不可见性四维 + 候选银弹三问） | 第 16/17 章 | 外部评估方法论或新 reference | 偏方法论说理，与 W 模型执行流程正交；先观察 P0-P2 落地效果 |
| 2 | 判据持有审计（"完成了"由人还是 agent 持有；接受自评增多即漂移预警） | 第 17 章 | 阶段门元审计条目 | 依赖 run-log 数据，需设计数据形态后立项 |
| 3 | worktree 警示（"给每一路发一份现实副本，各自漂移"） | 第 7 章 | using-git-worktrees/SKILL.md 注释 | 与现有技能立场相反，需用户确认取舍后落地 |

---

## 8. 影响范围

| 类别 | 数量 | 明细 |
|---|---|---|
| 新增 reference | 3 | `mythical-man-month-absorption.md`（P0）/ `estimation-guide.md`（P2）/ `context-management-guide.md`（P2） |
| 修订 reference | 10 | subagent-delegation / definition-of-done / phase-5 / phase-6 / bdd-guide / verifier-spec / operational-recovery / root-cause-locator / quality-standards / hill-climbing |
| 修订 .cursor 技能 | 5 | dispatching-parallel-agents / test-driven-development / requesting-code-review / writing-plans / (P3 候选 using-git-worktrees) |
| 新增反模式 | 2 | #45 反指标游戏 / #46 只给审计权不给修正权 |
| 新增约束 | 1 | #21 回归测试强制钩子（P1） |
| 脚本联动 | 2 | check-docs-consistency.ts（44→46）/ docs-consistency-logic.test.ts 样本 |
| 顶层文档 | 5 | SSoT §3.4.39 + §10A / AGENTS.md / README.md / INSTALL.md / CHANGELOG（[39.0.0]/[39.1.0]/[39.2.0]） |
| 版本同步 | 3 处 | package.json / skill-metadata.json / SKILL.md frontmatter |

**明确不动**：scripts/check-*.ts（除 docs-consistency 联动）、self-test 基线（249）、pre-push 项数（14）、verifier-spec Schema、schemas/*.json、templates/*、subagent/* 人格文件、docs/changes/archive/**。

---

## 9. 验收标准

### 9.1 P0（39.0.0）

- [ ] anti-patterns.md 含 #45/#46，计数 #1~#46，`check-docs-consistency` exit 0（"最大编号 == 46"）
- [ ] dispatching-parallel-agents/SKILL.md 无"调整测试期望"字样，示例改为"不得改断言凑通过"
- [ ] testing-anti-patterns.md 含「改断言让测试通过」条目
- [ ] subagent-delegation.md 含「主刀职责映射表」节
- [ ] SKILL.md 核心原则含「主刀与修正权」「人机分工线」两段
- [ ] definition-of-done.md 含「修正权验收测试」「九倍矩阵完成度自检」
- [ ] phase-5/phase-6 含任务分配规则节
- [ ] `references/mythical-man-month-absorption.md` 存在（23 项映射 + 决策记录）
- [ ] SSoT §3.4.39 + §10A 追溯表更新；CHANGELOG [39.0.0]；版本号三处同步 39.0.0
- [ ] `npm run self-test` 249 通过；`npx vitest run` 全过（docs-consistency 样本已更新）；`npx tsc --noEmit` 0 错误

### 9.2 P1（39.1.0）

- [ ] 5.1-5.10 各落点文档存在对应节（并行三闸 / 原文装填 / 记叙性优先 / 结构性约束 / 独立评审模板 / 止损三规则 / 会话生命周期 / 辩解义务 / 回归约束 #21 / 环境契约自检）
- [ ] SKILL.md 约束清单含 #21；AGENTS.md 约束 #21 登记
- [ ] 门禁全绿（self-test / vitest / tsc / pre-push 14 项）

### 9.3 P2（39.2.0）

- [ ] `estimation-guide.md` / `context-management-guide.md` 存在且被 Bundled Resources 表登记
- [ ] writing-plans / hill-climbing-guide / format-conventions 各含对应节
- [ ] SKILL.md 工具选型含「白箱 vs 黑箱」条目
- [ ] 门禁全绿

---

## 10. 风险与对策

| 风险 | 对策 |
|---|---|
| 反模式计数 44→46 联动遗漏导致 pre-push 失败 | 设计文档显式列出全部联动点（AGENTS/README×3/INSTALL/DoD/docs-consistency 逻辑+测试样本），实施计划逐项核对 |
| "结构性约束优先"与既有约束 #8/权限模型重复 | 定位为**通用原则**（说理层），不新增重复条款；仅当与既有条款互补时落文档 |
| 主刀/修正权与「编排者最小化」被误读为冲突 | SKILL.md 明确区分层级：O 不实施（agent 侧约束）vs 用户保留修正权（人侧权利），写入「主刀与修正权」段 |
| 新增反模式 #46 误伤既有合法流程（对话式 CHECKPOINT 已含介入位点） | #46 检测信号限定"全自动/无介入路径"场景；CHECKPOINT 场景显式豁免 |
| P0-P3 分三轮跨版本，中途 SSoT 漂移 | 每批独立 CHANGELOG 条目 + §3.4.39 分 P0/P1/P2 小节；批次间门禁全绿再推进下一批 |
| 吸收过载导致 SKILL.md 膨胀 | 每批吸收后跑 `check-docs-consistency` + 人工评审 SKILL.md 篇幅；P3 项默认暂缓控制总量 |
