---
name: w-model-dev
version: 19.0.1
description: >-
  Use when the user explicitly invokes /wm, mentions W-model, W 模型 or W 开发模型,
  requests requirements traceability (RTM), stage gates, quality gates, or development
  and testing in parallel. When the user only asks for an end-to-end or complete
  development process without these signals, ask whether to use the W-model first.
---

# W-Model Development

## 核心原则

W 模型将开发与测试设计同步推进：需求分析 ↔ 验收测试设计、系统设计 ↔ 系统测试设计、概要设计 ↔ 集成测试设计、详细设计 ↔ 单元测试设计。通过 RTM 追踪需求、设计、代码和四级测试，并以阶段门阻止未经验证的推进。

技能只提供编排、参考、模板和确定性门禁脚本。LLM-as-a-Verifier 由外部 Agent 按提示词执行；技能脚本不调用 LLM。设计决策以 `docs/skill-design-document_SSoT.md` 为准。

## 触发决策

按以下优先级判断，不要把普通软件任务升级为 W 模型流程：

| 用户信号 | 行为 |
|---|---|
| `/wm ...`、W-model、W 模型、W 开发模型 | 立即启用 |
| 明确要求 RTM、阶段门/质量门、开发与测试并行 | 立即启用 |
| 只说“完整流程”“从需求到交付”“全生命周期开发” | 先询问“是否采用 W 模型（含并行测试设计、RTM 和阶段门）？”；确认前不初始化 |
| 普通需求、设计、编码、测试、修复或技术解释 | 不启用，按普通任务处理 |

**边界示例：**

- “用 W 模型开发登录功能” → 启用。
- “从需求开始走完整流程” → 先询问是否采用 W 模型。
- “修复 `src/auth.ts` 并运行测试” → 不启用。

## 不可违反的约束

1. **测试设计前置**：阶段 1–4 的开发产物完成后，立即产出对应测试设计，不得推迟到编码后。
2. **阶段门放行**：产物评审通过且用户在 🔴 CHECKPOINT 明确确认后，才能推进。L1+ 自主成熟度下的操作型 CHECKPOINT 自动放行是选择性激活（见 [references/operational-recovery.md](references/operational-recovery.md)「成熟度与 CHECKPOINT 放行」节），非绕过；决策型 CHECKPOINT 在所有级别均等用户；阶段门放行须填 `acknowledgedDecisions` 理解证据（见 [references/definition-of-done.md](references/definition-of-done.md) 第六维度）。
3. **RTM 为事实源**：`.w-model/rtm.json` 是追溯与测试状态的唯一事实源；变更产物时同步更新。
4. **真实执行**：不得估算覆盖率、测试结果或门禁结果；必须执行真实测试/脚本并记录输出。
5. **失败即回退**：评审 C/D、测试失败或门禁退出码 1/2 均不得放行。
6. **按需加载**：只读取当前命令和阶段需要的参考；禁止一次加载整个 `references/`。
7. **如实状态**：未完成、未评审或未确认的阶段不得标为完成。
8. **编排者最小化**：编排者只做编排（路由 / 状态读写 / CHECKPOINT 等待 / 分派子代理 / 持久化 / 只读脚本）。任何修改、编码、调测、分析、修正、验证产出的实施动作必须由子代理执行。命中反模式 #10 一律回退到当前阶段起点。详见 [references/subagent-delegation.md](references/subagent-delegation.md)。
9. **TLA+ 行为门禁**：阶段 1–4 须产出对应层级的 TLA+ 状态机规格（L1 系统内外交互 → L2 子系统 → L3 原子行为），G 子代理跑 [`check-tla-model.ts`](scripts/check-tla-model.ts) 校验（语法 + TLC + 无死锁/不变式违反/状态爆炸）。阶段 4 TLA+ 零违反 + 图谱零违反才放行进编码。TLA+ 不接受占位/简化/错误实现（反模式 #16）；建模须符合需求和设计，符合后仍有问题须修正需求/设计并回退重跑（反模式 #17）。详见 [references/tla-plus-guide.md](references/tla-plus-guide.md)。
10. **门禁退出码不可伪**：所有 `check-*.ts` 的 JSON 摘要须含 `exitCode` 字段，与 `process.exit()` 强一致；G 子代理须存档 stdout 到 `.w-model/gate-logs/`；`check-run-log.ts` 交叉校验 run-log 中 `gateExitCode` 与 `gate-logs/` 存档一致，不一致一律视为伪造并回退（SSoT §10E）。
11. **系统层级树 + 多层图谱**：层级树根 = REQ 系统节点，子系统根 = SD（parent 依附），接口根 = INTF；图谱须覆盖 7 层（结构 / 依赖 / 追溯 / 信息流 / 治理 / 协作 / 派生）；横切边（`governs` / `collaborates-with` / `derives`）不依附层级树，但**不替代追溯**——追溯仍以 RTM 为事实源（SSoT §10.10）。
12. **闭环机制强制校验**：`check-budget.ts` / `check-run-log.ts` / `check-maturity.ts` / `check-checkpoint.ts` 4 脚本须在每个阶段门执行，`exitCode=0` 才可放行；任一脚本非 0 视为闭环未达成，回到当前阶段起点（SSoT §10C/§10D）。
13. **返工必经根因定位**：V/G 不通过后，必须先分派 R 子代理产出 RootCauseReport 并经 V 复审 + G 门禁通过，才可分派 S-fix 修复。跳过 R 直接 S 返工命中反模式 #18；R 报告未 V 复审直接 S 修复命中反模式 #19。详见 [references/root-cause-locator.md](references/root-cause-locator.md)。
14. **BDD 行为门禁**：阶段 1-4 必须产出对应层级 L1/L2/L3/L4 BDD features + `bdd-manifest.json`；阶段 5-8 必须执行对应层级 cucumber scenarios 且 [`check-bdd-model.ts`](scripts/check-bdd-model.ts) exitCode=0；BDD↔TLA+ 不等价必须走 R→V→G→S-fix 循环（反模式 #29）。详见 [references/bdd-guide.md](references/bdd-guide.md)。

完整反模式、检测信号和回退动作见 [references/anti-patterns.md](references/anti-patterns.md)。

- **Loop 4 不自动改 harness**：爬坡循环（Loop 4，详见 [hill-climbing-guide.md](references/hill-climbing-guide.md)）只产出 HarnessImprovementReport 改进信号，不自动改 prompt/工具/验证规则。人审后手动应用；外部 SkillOpt/darwin-skill 消费信号做演化。违反命中反模式 #10（编排者越权）。

## 编排者-子代理边界

> SSoT §3.4 为权威定义；[references/subagent-delegation.md](references/subagent-delegation.md) 为可执行细则。本节为编排摘要。

**原则**：编排者工作最小化。编排者（O）只负责路由、状态读写、CHECKPOINT 等待、分派子代理、持久化、只读脚本；任何修改、编码、调测、分析、修正、验证产出的实施动作必须由子代理执行。

**角色划分（O / S / V / G / A / R）**：

| 角色 | 简称 | 职责 | 关键禁止 |
|---|---|---|---|
| 编排者 | O | 路由 / 状态读写 / CHECKPOINT / 分派子代理 / 持久化 / 只读脚本 | 写产物 / .tla/.cfg/tla-manifest.json 实体 / 产出评审 JSON / 改 RTM 实体 / 生成代码 / 跳过 S→V→G |
| 产出子代理 | S | 生成阶段开发产物 + 同步测试设计 + 更新 RTM 实体；**F（修复者）由 S 兼任**——返工时携带 R 报告执行修复 | 跑门禁脚本 / 越阶段产出 / 改 project.status |
| 评审子代理 | V | 按 [references/agent-personas.md](references/agent-personas.md) + [references/verifier-spec.md](references/verifier-spec.md) §8 产出 `VerifierOutput` JSON | 跑门禁脚本 / 改产物 / 改 RTM |
| 门禁子代理 | G | 跑 `check-verifier-output.ts` / `check-artifact-gate.ts` + 回填证据摘要 | 改产物 / 产出评审 JSON / 改 RTM / 跑测试运行器 |
| 分析子代理 | A | 分块分析、交叉合并、图谱演进（阶段 1–4）；产出 `.w-model/ingestion/*` 与 `consolidated.json` | 跑 `check-requirement-graph.ts` / 写正式阶段产物 / 改 `project.status` / 越阶段产出 / 删除前阶段图谱节点 |
| 根因定位子代理 | R | 接收 V/G 的 `reworkHints` + 失败产物 + 上游产物，运用根因分析方法（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）定位根因，产出 `RootCauseReport`（含根因链 + 修复建议 + 防御措施 + `upstreamDefect` 标记）；可作为 R-lead 分派 R-persona 子代理（并行或串行均可）并聚合产出。详见 [references/root-cause-locator.md](references/root-cause-locator.md) | 改任何产物文件（由 S 修复）/ 跑门禁脚本（由 G 负责）/ 改 RTM 实体 / 改 `project.status` / 跨阶段定位（仅当前阶段产物 + 上游回溯标记）/ 评审其他角色产出 |

**每阶段分派时序**：O 路由 → 🔴 CHECKPOINT 进入确认 → **分派 S 产出** → **分派 V 评审** → **分派 G 门禁** → O 展示证据 → 🔴 CHECKPOINT 阶段门放行 → O 更新 `project.status`。阶段 8 终检额外分派 G 跑 `check-artifact-gate.ts`。

**只读脚本例外**：编排者可跑 `check-*.ts` 看退出码（用于展示/路由判定），但**不替代 G 子代理的回填职责**——G 子代理必须独立跑一次并产出证据摘要。

**违反处置**：命中反模式 #10「编排者越权实施」一律回到当前阶段起点，已越权产出的实体作废重做。检测信号与回退动作详见 [references/anti-patterns.md](references/anti-patterns.md) #10 与 [references/subagent-delegation.md](references/subagent-delegation.md)「强制约束」节。

## 核心操作行为

> 吸收自 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `using-agent-skills`，适配 W 模型语境。与「不可违反的约束」互补：约束是硬红线（命中即回退），操作行为是日常准则（违反不回退但降低质量）。SSoT §4A 为权威定义。

### 七条操作行为

| # | 行为 | 在 W 模型中的具体表现 |
|---|---|---|
| 1 | **Surface Assumptions** | `/wm analyze` / `design` / `code` 前显式列出对需求 / 架构 / 范围的假设；不得静默填补歧义 |
| 2 | **Manage Confusion Actively** | RTM 不一致 / 上游缺失 / 术语冲突时：STOP → 命名困惑 → 澄清 → 等待；禁止「猜一个推进」 |
| 3 | **Push Back When Warranted** | 用户选择与硬约束冲突时（跳 CHECKPOINT / 估算覆盖率放行）：指出问题 → 量化代价 → 提替代 → 接受覆盖 |
| 4 | **Enforce Simplicity** | 编码前自问「能否更少行？抽象是否物有所值？」；1000 行能 100 行完成即失败 |
| 5 | **Maintain Scope Discipline** | 只动该动的；不删看不懂的注释 / 不顺手清理无关代码 / 不重构相邻系统 / 不加规格外功能 |
| 6 | **Verify, Don't Assume** | 每阶段须有验证证据（测试退出码 / 脚本输出 / 运行时数据）；「看起来对」永远不够 |
| 7 | **Choose Highest Seam** | 阶段 2-4 测试设计前置时优先选现有最高 seam；理想零新 seam；私有状态机转移由 TLA+ 不变式覆盖 |

### 失败模式清单（F1~F10）

「看似高效实则埋坑」的 10 条行为退化，与 29 条流程反模式互补。命中不触发回退，但应在阶段产物「备注」节或 `reworkHints` 中标注。详细检测信号与处理流程见 [references/anti-patterns.md](references/anti-patterns.md)「失败模式清单」节。

| # | 失败模式 | 与反例的关系 |
|---|---|---|
| F1 | 静默假设未检查就推进 | 与 #9 互补 |
| F2 | 困惑时不暂停、硬猜推进 | 与 #8 互补 |
| F3 | 注意到不一致但不指出 | 与 #4 互补 |
| F4 | 非显然决策不呈现 tradeoff | — |
| F5 | 对明显有问题的方案 sycophantic | 对应 §4A.1 第 3 条 |
| F6 | 过度复杂化代码与 API | 对应 §4A.1 第 4 条 |
| F7 | 修改任务外的代码或注释 | 对应 §4A.1 第 5 条 |
| F8 | 删除未完全理解的代码 | 对应 §4A.1 第 5 条 |
| F9 | 因「显而易见」而无规格就编码 | 与「测试设计前置」冲突 |
| F10 | 因「看起来对」跳过验证 | 与 #3 / #6 互补 |

> Agent 重复命中同一失败模式 ≥2 次时，应在 SSoT §10B.4 或 anti-patterns.md「实现层经验教训」节登记为新教训。

## 执行工作流

每次启用技能后按顺序执行。**编排者只做编排**——所有实施动作（产出 / 评审 / 门禁）必须分派子代理执行（见「编排者-子代理边界」节与 [references/subagent-delegation.md](references/subagent-delegation.md)）。

1. **路由任务**（O）：识别命令、当前阶段和用户意图；歧义触发先确认。
2. **读取状态**（O）：若 `.w-model/` 存在，读取 `project.json` 与 `rtm.json`；状态损坏时先恢复，不得继续推进。
3. **检查前置产物**（O）：缺少上游阶段产物时拒绝跳阶段，并指出应返回的命令。
4. **加载最小引用集**（O）：编排者只加载 `SKILL.md` + 当前阶段 `phase-N-*.md` 摘要 + 所需状态文件；阶段细则由 S 子代理按需加载。
5. **初始化确认**（O）：首次进入项目前确认技术栈、当前阶段、同步测试设计和产物清单。
5.5. **ingestion 子流程**（O → A → G，阶段 1–4）：每个设计阶段进入时，O 跑 `plan-chunks.ts`（只读 stdout）产出分块计划 → 🔴 CHECKPOINT · ingestion 规划确认 → 并行分派 A-chunk 产出 `<chunk-id>.{md,json}` → 分派 A-cross（阶段1）/A-evolve（阶段2-4）合并建图产出 `consolidated.json` → 分派 G 跑 `check-requirement-graph.ts` → 收敛循环（MAX_ROUNDS=5，阈值=零违反）→ 🔴 CHECKPOINT · ingestion 收敛确认。详见 [references/ingestion-chunk.md](references/ingestion-chunk.md) 与 [references/ingestion-cross.md](references/ingestion-cross.md)。
6. **分派 S 子代理产出**（O → S）：分派产出子代理生成开发产物 + 同步测试设计 + 更新 RTM 实体；**阶段 1–4 额外产出对应层级 TLA+ 规格（`.tla` + `.cfg`）并更新 `tla-manifest.json`，同时产出对应层级 BDD features（`.feature`）并更新 `bdd-manifest.json`**；S 返回 `{产物路径, RTM diff, selfCheck}`。**编排者不得直接产出**。TLA+ 层级：阶段1=L1、阶段2=L1细化+L2、阶段3=L2细化+L3、阶段4=L3+按需L4；BDD 层级同 TLA+（L1/L2/L3/L4 features）。**S 任务过重时可拆为 S-doc（文档+测试+RTM）/ S-tla（TLA+ 规格）/ S-bdd（BDD features）三次分派，时序：S-doc → S-tla → S-bdd → V → G**（详见 [references/subagent-delegation.md](references/subagent-delegation.md)「S 拆分机制」节）。
7. **分派 V 子代理评审**（O → V）：分派评审子代理按 `targetKind` 路由 Persona，产出 `VerifierOutput` JSON。**编排者不得自评**。
8. **分派 G 子代理门禁**（O → G）：分派门禁子代理跑 `check-verifier-output.ts`，返回 `{exitCode, qualityLevel, passed, reworkHints}`。**阶段 1–4 额外分派 G 跑 `check-tla-model.ts`**（TLA+ 行为门禁：文件头 + 层次一致性 + SANY 语法 + TLC 模型检查，无死锁/不变式违反/状态爆炸）+ `check-bdd-model.ts`（BDD 行为门禁：D1 头标注 / D2 Gherkin 语法 / D3 状态机七要素 / D4 BDD↔TLA+ 等价 / D5 step 绑定 / D6 scenario 路径 / D7 RTM 映射），返回 TLA+ / BDD 证据摘要。**阶段 5 额外分派 G 跑 `check-code-tla-consistency.ts`（代码-TLA+ 一致性回归，四维度校验）**。编排者**可同步跑一次只读脚本看退出码**用于展示，但 G 子代理的回填不可省略。
9. **验证与暂停**（O）：若 G 返回 `exitCode=1` 或 `qualityLevel ∈ {C,D}` → **分派 R 子代理定位根因**（产出 RootCauseReport）→ **分派 V 复审根因报告**（targetKind=rootcause）→ **分派 G 门禁**（check-rootcause-report.ts）→ **分派 S-fix 修复**（携带 R 报告）→ 重走 V → G；若通过 → 🔴 CHECKPOINT 等待用户决定。跳过 R 直接分派 S 返工命中反模式 #18。**阶段 1–4 TLA+ 门禁退出码 1 亦不得放行**（反模式 #15）。
10. **持久化状态**（O）：只有用户放行后才更新 `project.status`；取消时保留产物但不推进状态。

> 🔴 **CHECKPOINT · 项目初始化**：复述"进入阶段 / 同步测试设计 / 预期产物"，获得确认后才能分派 S 子代理。
>
> 🔴 **CHECKPOINT · 阶段门放行**：展示 G 子代理返回的「质量等级 / 各子标准分 / `reworkHints`」，等待用户选择放行或返工。
>
> 🔴 **CHECKPOINT · 发布放行**：阶段 8 终检分派 G 跑 `check-artifact-gate.ts`，退出码 0 后展示 RTM 覆盖率、四级测试结果与 `GATE_JSON`，等待用户选择发布或回到编码。

完整阶段切换、失败回退与质量门流程见 [references/workflow.md](references/workflow.md)。

## 阶段路由

| # | 开发阶段 | 同步/执行测试 | 第 10 轮外部技能吸收标记 | 必读参考 |
|---|---|---|---|---|
| 1 | 需求分析 | 验收测试设计 | User Stories + Out of Scope + Implementation/Testing Decisions | [references/phase-1-requirements.md](references/phase-1-requirements.md) |
| 2 | 系统设计 | 系统测试设计 | seam 决策 | [references/phase-2-system-design.md](references/phase-2-system-design.md) |
| 3 | 概要设计 | 集成测试设计 | seam 决策 | [references/phase-3-outline-design.md](references/phase-3-outline-design.md) |
| 4 | 详细设计 | 单元测试设计 | seam 决策 | [references/phase-4-detailed-design.md](references/phase-4-detailed-design.md) |
| 5 | 编码实现 | 单元测试执行 | Tracer-bullet 票据拆解 | [references/phase-5-coding.md](references/phase-5-coding.md) |
| 6 | 集成测试 | 集成测试执行 | — | [references/phase-6-integration-test.md](references/phase-6-integration-test.md) |
| 7 | 系统测试 | 系统测试执行 | — | [references/phase-7-system-test.md](references/phase-7-system-test.md) |
| 8 | 验收测试 | 验收测试执行 | archive 机制 | [references/phase-8-acceptance-test.md](references/phase-8-acceptance-test.md) |

所有阶段另读 [references/rtm-guide.md](references/rtm-guide.md)。只有以下场景追加读取：

- TLA+ 状态机建模（阶段 1–4 产出 `.tla`/`.cfg`，G 跑 `check-tla-model.ts`） → [references/tla-plus-guide.md](references/tla-plus-guide.md)
- TLA+ 规格模板 → [templates/tla-spec-template.md](templates/tla-spec-template.md)
- BDD features 建模（阶段 1–4 产出 `.feature` + `bdd-manifest.json`，G 跑 `check-bdd-model.ts`） → [references/bdd-guide.md](references/bdd-guide.md)
- BDD features 模板 → [templates/feature.template](templates/feature.template)
- BDD manifest 模板 → [templates/bdd-manifest.template.json](templates/bdd-manifest.template.json)
- 阶段门评审或 `/wm review` → [references/verifier-spec.md](references/verifier-spec.md)
- 编码后质量检查 → [references/quality-standards.md](references/quality-standards.md)
- 状态 Schema、导入、导出或恢复 → [references/data-models.md](references/data-models.md)
- 异常、跨平台、技术栈切换或大项目 → [references/operational-recovery.md](references/operational-recovery.md)
- 子代理分派 / O-S-V-G 角色边界 / 编排者越权判定 → [references/subagent-delegation.md](references/subagent-delegation.md)

## Bundled Resources（按需加载契约）

> 借鉴 drawio-skill/skills/drawio-skill/SKILL.md 的 Bundled Resources 设计：明示每个 reference/script/subagent/template 的触发条件，**none of them need to be in context up front**。约束 #6「按需加载」的可执行清单。

### references/（按需读取）

| File | Read it when |
|---|---|
| phase-1-requirements.md | 用户进入阶段 1（需求分析） |
| phase-2-system-design.md | 阶段 2 系统设计 |
| phase-3-outline-design.md | 阶段 3 概要设计 |
| phase-4-detailed-design.md | 阶段 4 详细设计 |
| phase-5-coding.md | 阶段 5 编码 |
| phase-6-integration-test.md | 阶段 6 集成测试 |
| phase-7-system-test.md | 阶段 7 系统测试 |
| phase-8-acceptance-test.md | 阶段 8 验收测试 |
| rtm-guide.md | 任何阶段更新 RTM 时 |
| verifier-spec.md | V 子代理产出 VerifierOutput 前 |
| agent-personas.md | V 子代理选用 Persona 时 |
| subagent-delegation.md | O 分派 S/V/G/R 子代理前 |
| subagent-persona-matrix.md | R-lead / V-lead 多角度分析时 |
| root-cause-locator.md | V/G 不通过后分派 R 子代理时 |
| definition-of-done.md | 阶段门放行判定时 |
| data-models.md | 读写 .w-model/*.json 或 schema 校验失败时 |
| anti-patterns.md | 怀疑命中反模式或新增反模式登记时 |
| command-reference.md | /wm 命令参数细节 |
| workflow.md | 阶段切换 / 失败回退 / 质量门流程 |
| quality-standards.md | 编码后质量检查 |
| operational-recovery.md | 异常 / 跨平台 / 技术栈切换 / 大项目 / 简化行为自检 |
| tla-plus-guide.md | 阶段 1–4 产出 TLA+ 规格时 |
| tla-plus-patterns-examples.md | TLA+ 模式参考 |
| tla-plus-review-checklist.md | TLA+ 规格自审 |
| tla-plus-syntax-reference.md | TLA+ 语法查询 |
| tla-plus-tlc-configuration.md | TLC 配置 |
| graph-guide.md | 图谱门禁与收敛 |
| ingestion-chunk.md | A 子代理分块分析 |
| ingestion-cross.md | A 子代理交叉合并 |
| event-ingress-guide.md | L2+ 项目事件接驳 |
| hill-climbing-guide.md | L2+ 项目爬坡循环 |
| skillopt-adoption.md | SkillOpt 方法论吸收 |
| external-skills-absorption.md | 第 10 轮外部技能吸收 |
| bdd-guide.md | 阶段 1-8 涉及 BDD features 设计时加载 |
| bdd-review-checklist.md | V 子代理评审 BDD features 时加载 |
| bdd-syntax-reference.md | 撰写 features 时加载 |
| bdd-patterns-examples.md | 撰写 features 时按需加载 |
| toolbox.md | 「I have X, I want Y → use Z」决策表 |

### scripts/（按需读取，仅供 G 子代理执行）

| File | Read it when |
|---|---|
| check-verifier-output.ts | V 产出 JSON 后 G 校验 |
| check-artifact-gate.ts | 阶段 8 终检 / 阶段 5/6/7 阶段级校验 |
| check-requirement-graph.ts | 阶段 1–4 图谱门禁 |
| check-tla-model.ts | 阶段 1–4 TLA+ 行为门禁 |
| check-bdd-model.ts | 阶段 1-8 BDD 模型门禁 |
| check-code-tla-consistency.ts | 阶段 5 代码-TLA+ 一致性回归 |
| check-budget.ts | 阶段门放行前 |
| check-run-log.ts | 阶段门放行前 |
| check-maturity.ts | 阶段门放行前 |
| check-checkpoint.ts | 阶段门放行前 |
| check-rootcause-report.ts | R 子代理产出后 |
| schema-loader.ts | logic 层 schema 校验（被自动 import） |
| security-scan.ts | pre-push / 手动安全扫描 |
| self-test.ts | 回归基线（非阶段流程） |
| plan-chunks.ts | ingestion 子流程分块（O 只读） |

### subagent/（按需读取，仅供 V-lead / R-lead 多角度分析）

| File | Read it when |
|---|---|
| engineering-code-reviewer.md | V 评审 code 阶段 |
| engineering-backend-architect.md | V 评审 design 阶段（后端） |
| engineering-software-architect.md | V 评审 system design |
| testing-api-tester.md | V 评审 test 阶段（API） |
| testing-reality-checker.md | V reality check |
| ... | 完整清单见 [references/subagent-persona-matrix.md](references/subagent-persona-matrix.md) |

### templates/（产出时按需读取）

| File | Read it when |
|---|---|
| requirement-spec.md | 阶段 1 产出需求规格 |
| system-design.md | 阶段 2 产出系统设计 |
| detailed-design.md | 阶段 4 产出详细设计 |
| interface-design.md | 阶段 4 产出接口设计 |
| test-case.md | 任何阶段产出测试用例 |
| test-report.md | 阶段 6/7/8 产出测试报告 |
| rtm.md | RTM 维护 |
| review-report.md | V 产出评审报告 |
| tla-spec-template.md | 阶段 1–4 产出 TLA+ 规格 |

## 命令速查

> 编排者（O）只路由 + CHECKPOINT + 状态持久化；产出（S）、评审（V）、门禁（G）均由子代理执行。详见 [references/subagent-delegation.md](references/subagent-delegation.md)。

| 命令 | 路由 | 关键前置/行为 | 子代理分派 |
|---|---|---|---|
| `/wm analyze <需求>` | 阶段 1 | 首次初始化并同步验收测试设计；触发 ingestion 子流程（A 角色 + 图谱校验） | O 路由 → S 产出 → V 评审 → G 门禁 |
| `/wm design type=<架构\|概要\|详细>` | 阶段 2/3/4 | 必须存在上一阶段已放行产物；触发 ingestion 子流程（A 角色 + 图谱校验，S→A 路径） | O 路由 → S 产出 → V 评审 → G 门禁 |
| `/wm code <功能>` | 阶段 5 | 必须存在已放行详细设计；生成并真实执行单元测试 | O 路由 → S 产出代码+单测+RTM → V 评审 → G 门禁 |
| `/wm test type=<单元\|集成\|系统\|验收> result=<pass\|fail>` | 阶段 5–8 | `result` 必填且必须来自真实测试输出 | O 路由 → S 执行测试+回填 RTM → V 评审报告 → G 门禁 |
| `/wm review <目标>` | 阶段门 | 返回评审指引；外部 Agent 执行评审 | O 路由 → V 评审 → G 门禁（不由 O 自评） |
| `/wm status` | 状态查询 | 读取状态与 RTM，不修改数据 | O 只读，不分派子代理 |
| `/wm help` | 帮助 | 不读项目状态 | O 只读，不分派子代理 |
| `/wm reset` | 重置 | 🔴 CHECKPOINT 后清空实体，保留项目元信息 | O 执行（仅状态文件操作，非阶段产物） |
| `/wm export [目录]` | 导出 | 输出 JSON 与 RTM Markdown | O 只读导出，不分派子代理 |
| `/wm import <文件>` | 导入 | 校验后写入；覆盖现有数据前 🔴 CHECKPOINT | O 执行（仅状态文件操作） |
| `/wm hill-climbing` | 改进信号 | L2+ 项目：分析 run-log 产出 HarnessImprovementReport；人审后手动应用改进 | O 分析（状态读写+分析，非实施） |

每个命令的输入、输出、失败动作和状态更新规则见 [references/command-reference.md](references/command-reference.md)。

**参数示例**：
```
/wm hill-climbing                              # 全量分析当前 run-log
/wm hill-climbing --from=2026-07-20 --to=2026-07-26  # 指定时间窗口
/wm hill-climbing --phase=5                    # 仅分析阶段 5 的 run-log
```
产出存 `.w-model/hill-climbing/<timestamp>-report.json`。

## 阶段统一产出契约

每个阶段必须：

1. 按阶段参考定义的输入和算法产出文档。
2. 使用对应 [templates/](templates/) 模板；测试用例至少包含 ID、场景、输入、预期输出和优先级。
3. 同步更新 `.w-model/rtm.json` 的需求、设计、代码与测试映射。
4. 给出风险/缺陷等级和缓解措施。
5. 输出阶段摘要：产物路径、RTM 覆盖状态、验证证据、阻塞项和下一步。
6. **第 10 轮外部技能吸收三要素**（适用阶段）：
   - 阶段 1：User Stories + Out of Scope + Implementation/Testing Decisions
   - 阶段 2-4：测试 seam 决策（三层一致性）
   - 阶段 5：Tracer-bullet 票据拆解（tickets.md）
   - 阶段 8：archive 机制（changes/archive/YYYY-MM-DD-<feature>/）
   - 详见 [references/external-skills-absorption.md](references/external-skills-absorption.md)

模板按产物直接读取：

- 需求：[templates/requirement-spec.md](templates/requirement-spec.md)
- 系统/详细/接口设计：[templates/system-design.md](templates/system-design.md)、[templates/detailed-design.md](templates/detailed-design.md)、[templates/interface-design.md](templates/interface-design.md)
- 测试用例/报告：[templates/test-case.md](templates/test-case.md)、[templates/test-report.md](templates/test-report.md)
- RTM/评审：[templates/rtm.md](templates/rtm.md)、[templates/review-report.md](templates/review-report.md)

## 阶段门与质量门

阶段产物由外部 Agent 按 [references/verifier-spec.md](references/verifier-spec.md) 评审。JSON 产出后立即执行：

```bash
npx tsx w-model-dev/scripts/check-verifier-output.ts "<output.json>"
```

仅当脚本退出码 0、`passed=true` 且 `qualityLevel` 为 A/B，才可进入阶段门用户确认。C/D 或退出码 1/2 回到当前阶段起点。

阶段 1–4 额外执行 TLA+ 行为门禁（与图谱门禁正交叠加）：

```bash
npx tsx w-model-dev/scripts/check-tla-model.ts "<tla-manifest.json>" [--phase=1|2|3|4] [--spec=<id>] [--skip-tlc]
```

退出码 0（`TLA_JSON.passed=true`）才可进入阶段门确认。退出码 1（死锁/不变式违反/状态爆炸/占位实现/拆解未完成）回到当前阶段起点。**阶段 4 TLA+ 零违反 + 图谱零违反才放行进编码**（约束 9）。TLC 发现违反且规格忠实于需求/设计时，须修正需求/设计并回退重跑（反模式 #17）。

### 阶段 5/6/7 阶段级工件校验（第 9 轮 P1.1）

> 阶段 5/6/7 G 门禁推荐使用 `--phase=N` 参数做阶段级校验，避免用终检（`--phase=8`，默认）提前否决 pending 的后续测试层。第 8 轮调测发现：阶段 6 G 门禁若用终检，会因为 `systemTest` / `acceptanceTest` 字段 pending 而误判为不通过，导致阶段无法推进。
>
> **反模式 #21（第 13 轮 P3.1）**：self-as-verifier 模式下不得跳过阶段 6/7 门禁直接跑 `--phase=8` 终检。每阶段完成必须跑对应 `--phase=N`，违反则回到阶段起点。阶段 6/7 跳过 `--phase=N` 直接跑终检会导致阶段级字段缺失（如 REQ 行 `systemTest`）到终检才发现，违反"早发现早修复"原则。详见 [references/anti-patterns.md](references/anti-patterns.md) #21。

[`check-artifact-gate.ts`](scripts/check-artifact-gate.ts) 支持 `--phase=N`（简写 `-p N`）参数，按阶段分层校验：

| 参数 | 校验范围 | RTM 字段校验（REQ 行） | 测试汇总校验 |
|---|---|---|---|
| `--phase=5` | 阶段 5 编码完成 | `designDoc` / `codeModule` / `unitTest` | `unitTest` 汇总（`integrationTest` / `systemTest` / `acceptanceTest` pending 合理跳过） |
| `--phase=6` | 阶段 6 集成测试完成 | `--phase=5` 全部 + `integrationTest` | `--phase=5` 全部 + `integrationTest` 汇总 |
| `--phase=7` | 阶段 7 系统测试完成 | `--phase=6` 全部 + `systemTest` | `--phase=6` 全部 + `systemTest` 汇总 |
| `--phase=8`（默认） | 阶段 8 终检 | `--phase=7` 全部 + `acceptanceTest` | `--phase=7` 全部 + `acceptanceTest` 汇总（终检，向后兼容） |

**NFR/CON 横切行特殊规则**：NFR/CON 行的 RTM 字段校验与 REQ 行不同——

- 阶段 1~4：仅校验 `designDoc` 字段非空（横切登记，详见 [references/phase-1-requirements.md](references/phase-1-requirements.md)「NFR/CON 横切治理字段登记」节）
- 阶段 5~8：校验 `designDoc` + `codeModule` 字段非空（横切回填，详见 [references/phase-5-coding.md](references/phase-5-coding.md)「NFR/CON codeModule 回填」节）
- 不校验 NFR/CON 行的 `unitTest` / `integrationTest` / `systemTest` / `acceptanceTest` 字段（横切测试在阶段 5-8 按需补充）

**用法**：

```bash
# 阶段 6 G 门禁：校验 unit + integration 测试通过，system/acceptance pending 合理跳过
npx tsx w-model-dev/scripts/check-artifact-gate.ts --phase=6 [project-dir]

# 阶段 7 G 门禁：校验 unit + integration + system 测试通过，acceptance pending 合理跳过
npx tsx w-model-dev/scripts/check-artifact-gate.ts --phase=7 [project-dir]

# 阶段 8 终检（默认，向后兼容）：全部测试通过才放行
npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]
```

**阶段 6 G 门禁推荐命令组合**：

```bash
# 1. V 评审产出 VerifierOutput JSON 后，G 跑 check-verifier-output.ts
npx tsx w-model-dev/scripts/check-verifier-output.ts "<verifier-output-phase6.json>"
# 2. G 跑 check-artifact-gate.ts --phase=6（阶段级校验，不否决 pending 的 system/acceptance）
npx tsx w-model-dev/scripts/check-artifact-gate.ts --phase=6 [project-dir]
```

**阶段 7 G 门禁推荐命令组合**：

```bash
# 1. V 评审产出 VerifierOutput JSON 后，G 跑 check-verifier-output.ts
npx tsx w-model-dev/scripts/check-verifier-output.ts "<verifier-output-phase7.json>"
# 2. G 跑 check-artifact-gate.ts --phase=7（阶段级校验，不否决 pending 的 acceptance）
npx tsx w-model-dev/scripts/check-artifact-gate.ts --phase=7 [project-dir]
```

> **阶段 5 G 门禁**：阶段 5 仍以 `check-verifier-output.ts` + `check-code-tla-consistency.ts` 为主（code-TLA+ 一致性回归，四维度校验），`check-artifact-gate.ts --phase=5` 可作为补充校验确认 REQ 行 `codeModule` 字段已回填。
>
> **向后兼容**：未传 `--phase` 参数时默认 `phase=8`（终检），行为与第八轮及更早版本一致。历史 demo / fixture 不需修改即可继续通过终检。
>
> **graph 自动发现**（第 9 轮 P2.6）：`check-artifact-gate.ts` 自动按以下优先级查找 `.w-model/ingestion/` 下 graph 资产：`graph.json` → `consolidated-phase4.json` → `consolidated-phase3.json` → `consolidated-phase2.json` → `consolidated-phase1.json`。无需手动指定 `--graph` 参数。

验收终检执行：

```bash
npx tsx w-model-dev/scripts/check-artifact-gate.ts "<project-dir>"
```

只有退出码 0 且用户在发布检查点确认，项目才可完成。退出码 1/2 一律停止并按 `GATE_JSON` 回退。单元测试代码覆盖率还必须达到 80%，代码规范检查通过且无高危安全漏洞。

## 测试结果真实性

`/wm test` 的 `result` 只用于回填已执行结果，不是用户声明即可信的“通过开关”。回填前必须具有：

- 测试运行器命令与退出码；
- `passed / failed / pending` 数量；
- 单元测试覆盖率（仅单元测试必填）；
- 失败用例与根因（`result=fail` 时）。

缺少证据时拒绝标记通过，保持状态为待执行，并给出应运行的测试命令。

## 快速自检

在任何推进或完成声明前确认：

- [ ] 触发边界已正确判断，歧义请求已经确认
- [ ] 上游产物与项目状态一致
- [ ] 当前阶段开发产物和对应测试设计均已完成
- [ ] RTM 已同步且没有估算值
- [ ] 真实测试/门禁证据可复核
- [ ] 当前 🔴 CHECKPOINT 已获得用户明确决定
- [ ] 未一次性加载无关参考文件
- [ ] **编排者未越权实施**：会话内无 `Write` / `Edit` 写阶段产物文件（含 .tla/.cfg/tla-manifest.json 实体）、无直接产出的 `VerifierOutput` JSON 内容、无生成的代码或测试用例；所有实施动作均由 S / V / G 子代理执行（反模式 #10）
- [ ] **图谱校验通过**：阶段 1–4 的 `check-requirement-graph.ts` 退出码 0；阶段 4 零违反硬约束达成才放行进编码
- [ ] 图谱信息流无黑洞/奇迹/死模块，且边界（EXT-IN/EXT-OUT）完整（`check-requirement-graph.ts` 退出码 0，`GRAPH_JSON.dataflowViolations` 全空）
- [ ] **TLA+ 行为门禁通过**：阶段 1–4 的 `check-tla-model.ts` 退出码 0（`TLA_JSON.passed=true`）；阶段 4 TLA+ 零违反（无死锁/不变式违反/状态爆炸/拆解决策合规）+ 图谱零违反才放行进编码；TLA+ 规格无占位/简化/错误实现（反模式 #16）；建模与需求/设计一致（反模式 #17）
- [ ] **BDD 行为门禁通过**（第 19 轮）：阶段 1–4 的 `check-bdd-model.ts --phase=N` 退出码 0（7 维度 D1-D7 全通过：D1 头标注 / D2 Gherkin 语法 / D3 状态机七要素 / D4 BDD↔TLA+ 等价 / D5 step 绑定 / D6 scenario 路径 / D7 RTM 映射）；BDD features 无占位/简化/错误实现；建模与需求/设计/TLA+ 一致（反模式 #29）
- [ ] **阶段5 codeModule 回填**：RTM.codeModule 列已回填（格式 SD-xxx:src/path，编码后强制）；缺失 → `check-code-tla-consistency.ts` 维度1 退出码 1
- [ ] **阶段门放行已填理解证据**：run-log `acknowledgedDecisions` 非空且含 ≥1 关键决策摘要（非"确认"/"同意"）；为空视为 O4（Comprehension Debt）命中，拒绝放行（见 [references/definition-of-done.md](references/definition-of-done.md) 第六维度）
- [ ] **预算与成熟度已检查**：阶段门放行前跑预算检查（超 `budget.json` 限制按 `onExceed` 处置）；CHECKPOINT 类型由 `maturity.json.level` 决定（L1+ 操作型自动放行仍记录 run-log）；见 [references/operational-recovery.md](references/operational-recovery.md)
- [ ] `check-budget.ts` 是否 exitCode=0
- [ ] `check-run-log.ts` 是否 exitCode=0
- [ ] `check-maturity.ts` 是否 exitCode=0
- [ ] `check-checkpoint.ts` 是否 exitCode=0
- [ ] **上下文窗口已清理**（第 10 轮外部技能吸收）：阶段切换时 S 子代理是新会话，不继承前阶段上下文（OpenSpec context hygiene）
- [ ] **TLA+ 资料按需加载**（第 11 轮外部技能吸收）：S-tla/V-tla 子代理按 [tla-plus-guide.md §13 加载矩阵](references/tla-plus-guide.md) 加载 4 份参考文件，禁止一次加载全部
- [ ] 反模式 #20（只规划不执行）：确认所有规划都有对应执行动作，未停留在规划阶段
- [ ] 反模式 #21（阶段级门禁跳过）：确认阶段 6/7/8 都跑了 `--phase=N` 门禁，未跳过阶段级校验
- [ ] **JSON 文件写入工具**（反模式 #25，第 16 轮 P4.2）：所有 JSON 文件写入用 Node.js `fs.writeFileSync(path, content, 'utf-8')`，禁止 PowerShell `ConvertTo-Json` / `Add-Content` / `Out-File` / `Set-Content`（BOM + 深度 + 中文乱码）。详见 [references/operational-recovery.md](references/operational-recovery.md)「JSON 文件写入工具选择」节
- [ ] **acknowledgedDecisions 关键词**（第 16 轮 P4.1，R2 校验；与反模式 #26 字段混用同属 schema 边界约束但维度不同：#26 管字段归属 R1，本条管字段内容 R2）：每条 `acknowledgedDecisions` 决策条目须命中 ID 模式（`REQ-\d+` / `SD-[\d.]+` / `INTF-[\d.]+` / `DD-[\d.]+` / `TC-\w+-\d+`）或 TECH_KEYWORDS（`REST` / `JWT` / `HTTP` / `状态机` / `不变式` / `接口` / `存储` 等 37 个中英关键词）；「同意」/「确认」/「OK」/「好的」视为空，触发 `check-checkpoint.ts` R2 名词违规。完整集合见 [references/phase-8-acceptance-test.md](references/phase-8-acceptance-test.md)「acknowledgedDecisions 决策条目须含关键词」节
- [ ] **调测者简化行为自检**（反模式 #27，第 17 轮 P5）：self-as-verifier 模式下每阶段须按 [references/operational-recovery.md](references/operational-recovery.md)「调测者简化行为预防」节自检清单逐条核验（硬约束复述 / reworkHints 非空 / 9 脚本全 exitCode=0 / §9 确认 / 长会话重读硬约束）。命中任一简化倾向（S1 上下文压缩丢细节 / S2 追求效率省步骤 / S3 未对照硬约束核验）回阶段起点。
- [ ] **Bundled Resources 按需加载**（第 18 轮 P1，借鉴 drawio-skill）：会话内已加载的文件清单与「Bundled Resources」表对照，未加载无关文件（约束 #6 可执行化）

交互样例按需读取 [examples/requirement-analysis.md](examples/requirement-analysis.md)、[examples/system-design.md](examples/system-design.md)、[examples/coding.md](examples/coding.md) 或 [examples/test-execution.md](examples/test-execution.md)。
