---
name: w-model-dev
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

完整反模式、检测信号和回退动作见 [references/anti-patterns.md](references/anti-patterns.md)。

## 编排者-子代理边界

> SSoT §3.4 为权威定义；[references/subagent-delegation.md](references/subagent-delegation.md) 为可执行细则。本节为编排摘要。

**原则**：编排者工作最小化。编排者（O）只负责路由、状态读写、CHECKPOINT 等待、分派子代理、持久化、只读脚本；任何修改、编码、调测、分析、修正、验证产出的实施动作必须由子代理执行。

**角色划分（O / S / V / G）**：

| 角色 | 简称 | 职责 | 关键禁止 |
|---|---|---|---|
| 编排者 | O | 路由 / 状态读写 / CHECKPOINT / 分派子代理 / 持久化 / 只读脚本 | 写产物 / 产出评审 JSON / 改 RTM 实体 / 生成代码 / 跳过 S→V→G |
| 产出子代理 | S | 生成阶段开发产物 + 同步测试设计 + 更新 RTM 实体 | 跑门禁脚本 / 越阶段产出 / 改 project.status |
| 评审子代理 | V | 按 [references/agent-personas.md](references/agent-personas.md) + [references/verifier-spec.md](references/verifier-spec.md) §8 产出 `VerifierOutput` JSON | 跑门禁脚本 / 改产物 / 改 RTM |
| 门禁子代理 | G | 跑 `check-verifier-output.ts` / `check-artifact-gate.ts` + 回填证据摘要 | 改产物 / 产出评审 JSON / 改 RTM / 跑测试运行器 |
| 分析子代理 | A | 分块分析、交叉合并、图谱演进（阶段 1–4）；产出 `.w-model/ingestion/*` 与 `consolidated.json` | 跑 `check-requirement-graph.ts` / 写正式阶段产物 / 改 `project.status` / 越阶段产出 / 删除前阶段图谱节点 |

**每阶段分派时序**：O 路由 → 🔴 CHECKPOINT 进入确认 → **分派 S 产出** → **分派 V 评审** → **分派 G 门禁** → O 展示证据 → 🔴 CHECKPOINT 阶段门放行 → O 更新 `project.status`。阶段 8 终检额外分派 G 跑 `check-artifact-gate.ts`。

**只读脚本例外**：编排者可跑 `check-*.ts` 看退出码（用于展示/路由判定），但**不替代 G 子代理的回填职责**——G 子代理必须独立跑一次并产出证据摘要。

**违反处置**：命中反模式 #10「编排者越权实施」一律回到当前阶段起点，已越权产出的实体作废重做。检测信号与回退动作详见 [references/anti-patterns.md](references/anti-patterns.md) #10 与 [references/subagent-delegation.md](references/subagent-delegation.md)「强制约束」节。

## 核心操作行为

> 吸收自 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `using-agent-skills`，适配 W 模型语境。与「不可违反的约束」互补：约束是硬红线（命中即回退），操作行为是日常准则（违反不回退但降低质量）。SSoT §4A 为权威定义。

### 六条操作行为

| # | 行为 | 在 W 模型中的具体表现 |
|---|---|---|
| 1 | **Surface Assumptions** | `/wm analyze` / `design` / `code` 前显式列出对需求 / 架构 / 范围的假设；不得静默填补歧义 |
| 2 | **Manage Confusion Actively** | RTM 不一致 / 上游缺失 / 术语冲突时：STOP → 命名困惑 → 澄清 → 等待；禁止「猜一个推进」 |
| 3 | **Push Back When Warranted** | 用户选择与硬约束冲突时（跳 CHECKPOINT / 估算覆盖率放行）：指出问题 → 量化代价 → 提替代 → 接受覆盖 |
| 4 | **Enforce Simplicity** | 编码前自问「能否更少行？抽象是否物有所值？」；1000 行能 100 行完成即失败 |
| 5 | **Maintain Scope Discipline** | 只动该动的；不删看不懂的注释 / 不顺手清理无关代码 / 不重构相邻系统 / 不加规格外功能 |
| 6 | **Verify, Don't Assume** | 每阶段须有验证证据（测试退出码 / 脚本输出 / 运行时数据）；「看起来对」永远不够 |

### 失败模式清单（F1~F10）

「看似高效实则埋坑」的 10 条行为退化，与 9 条流程反模式互补。命中不触发回退，但应在阶段产物「备注」节或 `reworkHints` 中标注。详细检测信号与处理流程见 [references/anti-patterns.md](references/anti-patterns.md)「失败模式清单」节。

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
6. **分派 S 子代理产出**（O → S）：分派产出子代理生成开发产物 + 同步测试设计 + 更新 RTM 实体；**阶段 1–4 额外产出对应层级 TLA+ 规格（`.tla` + `.cfg`）并更新 `tla-manifest.json`**；S 返回 `{产物路径, RTM diff, selfCheck}`。**编排者不得直接产出**。TLA+ 层级：阶段1=L1、阶段2=L1细化+L2、阶段3=L2细化+L3、阶段4=L3+按需L4。
7. **分派 V 子代理评审**（O → V）：分派评审子代理按 `targetKind` 路由 Persona，产出 `VerifierOutput` JSON。**编排者不得自评**。
8. **分派 G 子代理门禁**（O → G）：分派门禁子代理跑 `check-verifier-output.ts`，返回 `{exitCode, qualityLevel, passed, reworkHints}`。**阶段 1–4 额外分派 G 跑 `check-tla-model.ts`**（TLA+ 行为门禁：文件头 + 层次一致性 + SANY 语法 + TLC 模型检查，无死锁/不变式违反/状态爆炸），返回 TLA+ 证据摘要。编排者**可同步跑一次只读脚本看退出码**用于展示，但 G 子代理的回填不可省略。
9. **验证与暂停**（O）：若 G 返回 `exitCode=1` 或 `qualityLevel ∈ {C,D}` → 分派 S 返工（带 `reworkHints`），重走 6→7→8；若通过 → 🔴 CHECKPOINT 等待用户决定。**阶段 1–4 TLA+ 门禁退出码 1 亦不得放行**（反模式 #15）。
10. **持久化状态**（O）：只有用户放行后才更新 `project.status`；取消时保留产物但不推进状态。

> 🔴 **CHECKPOINT · 项目初始化**：复述"进入阶段 / 同步测试设计 / 预期产物"，获得确认后才能分派 S 子代理。
>
> 🔴 **CHECKPOINT · 阶段门放行**：展示 G 子代理返回的「质量等级 / 各子标准分 / `reworkHints`」，等待用户选择放行或返工。
>
> 🔴 **CHECKPOINT · 发布放行**：阶段 8 终检分派 G 跑 `check-artifact-gate.ts`，退出码 0 后展示 RTM 覆盖率、四级测试结果与 `GATE_JSON`，等待用户选择发布或回到编码。

完整阶段切换、失败回退与质量门流程见 [references/workflow.md](references/workflow.md)。

## 阶段路由

| # | 开发阶段 | 同步/执行测试 | 必读参考 |
|---|---|---|---|
| 1 | 需求分析 | 验收测试设计 | [references/phase-1-requirements.md](references/phase-1-requirements.md) |
| 2 | 系统设计 | 系统测试设计 | [references/phase-2-system-design.md](references/phase-2-system-design.md) |
| 3 | 概要设计 | 集成测试设计 | [references/phase-3-outline-design.md](references/phase-3-outline-design.md) |
| 4 | 详细设计 | 单元测试设计 | [references/phase-4-detailed-design.md](references/phase-4-detailed-design.md) |
| 5 | 编码实现 | 单元测试执行 | [references/phase-5-coding.md](references/phase-5-coding.md) |
| 6 | 集成测试 | 集成测试执行 | [references/phase-6-integration-test.md](references/phase-6-integration-test.md) |
| 7 | 系统测试 | 系统测试执行 | [references/phase-7-system-test.md](references/phase-7-system-test.md) |
| 8 | 验收测试 | 验收测试执行 | [references/phase-8-acceptance-test.md](references/phase-8-acceptance-test.md) |

所有阶段另读 [references/rtm-guide.md](references/rtm-guide.md)。只有以下场景追加读取：

- TLA+ 状态机建模（阶段 1–4 产出 `.tla`/`.cfg`，G 跑 `check-tla-model.ts`） → [references/tla-plus-guide.md](references/tla-plus-guide.md)
- TLA+ 规格模板 → [templates/tla-spec-template.md](templates/tla-spec-template.md)
- 阶段门评审或 `/wm review` → [references/verifier-spec.md](references/verifier-spec.md)
- 编码后质量检查 → [references/quality-standards.md](references/quality-standards.md)
- 状态 Schema、导入、导出或恢复 → [references/data-models.md](references/data-models.md)
- 异常、跨平台、技术栈切换或大项目 → [references/operational-recovery.md](references/operational-recovery.md)
- 子代理分派 / O-S-V-G 角色边界 / 编排者越权判定 → [references/subagent-delegation.md](references/subagent-delegation.md)

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

每个命令的输入、输出、失败动作和状态更新规则见 [references/command-reference.md](references/command-reference.md)。

## 阶段统一产出契约

每个阶段必须：

1. 按阶段参考定义的输入和算法产出文档。
2. 使用对应 [templates/](templates/) 模板；测试用例至少包含 ID、场景、输入、预期输出和优先级。
3. 同步更新 `.w-model/rtm.json` 的需求、设计、代码与测试映射。
4. 给出风险/缺陷等级和缓解措施。
5. 输出阶段摘要：产物路径、RTM 覆盖状态、验证证据、阻塞项和下一步。

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
- [ ] **编排者未越权实施**：会话内无 `Write` / `Edit` 写阶段产物文件、无直接产出的 `VerifierOutput` JSON 内容、无生成的代码或测试用例；所有实施动作均由 S / V / G 子代理执行（反模式 #10）
- [ ] **图谱校验通过**：阶段 1–4 的 `check-requirement-graph.ts` 退出码 0；阶段 4 零违反硬约束达成才放行进编码
- [ ] 图谱信息流无黑洞/奇迹/死模块，且边界（EXT-IN/EXT-OUT）完整（`check-requirement-graph.ts` 退出码 0，`GRAPH_JSON.dataflowViolations` 全空）
- [ ] **TLA+ 行为门禁通过**：阶段 1–4 的 `check-tla-model.ts` 退出码 0（`TLA_JSON.passed=true`）；阶段 4 TLA+ 零违反（无死锁/不变式违反/状态爆炸/拆解决策合规）+ 图谱零违反才放行进编码；TLA+ 规格无占位/简化/错误实现（反模式 #16）；建模与需求/设计一致（反模式 #17）
- [ ] **阶段门放行已填理解证据**：run-log `acknowledgedDecisions` 非空且含 ≥1 关键决策摘要（非"确认"/"同意"）；为空视为 O4（Comprehension Debt）命中，拒绝放行（见 [references/definition-of-done.md](references/definition-of-done.md) 第六维度）
- [ ] **预算与成熟度已检查**：阶段门放行前跑预算检查（超 `budget.json` 限制按 `onExceed` 处置）；CHECKPOINT 类型由 `maturity.json.level` 决定（L1+ 操作型自动放行仍记录 run-log）；见 [references/operational-recovery.md](references/operational-recovery.md)
- [ ] `check-budget.ts` 是否 exitCode=0
- [ ] `check-run-log.ts` 是否 exitCode=0
- [ ] `check-maturity.ts` 是否 exitCode=0
- [ ] `check-checkpoint.ts` 是否 exitCode=0

交互样例按需读取 [examples/requirement-analysis.md](examples/requirement-analysis.md)、[examples/system-design.md](examples/system-design.md)、[examples/coding.md](examples/coding.md) 或 [examples/test-execution.md](examples/test-execution.md)。
