---
name: w-model-dev
version: 41.7.0
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

**交付层**：L0「纯 skill」= `SKILL.md` + `references/` + `templates/` + `examples/` + `subagent/` + `schemas/`，拷贝即可激活；L1「带门禁」= L0 + `scripts/` + `samples/`（需项目根 `npm install` 跑门禁）。安装路径见 [docs/INSTALL.md](../docs/INSTALL.md) §2「交付层选择」。

**设计哲学**：主刀与修正权 / 人机分工线 / 白箱 vs 黑箱 / 受控的失控 / clockware vs swarmware 五条方法论取向见 [references/design-philosophy.md](references/design-philosophy.md)，按需加载。

## 触发决策

按以下优先级判断，不要把普通软件任务升级为 W 模型流程：

| 用户信号 | 行为 |
|---|---|
| `/wm ...`、W-model、W 模型、W 开发模型 | 立即启用 |
| 明确要求 RTM、阶段门/质量门、开发与测试并行 | 立即启用 |
| 只说“完整流程”“从需求到交付”“全生命周期开发” | 先询问“是否采用 W 模型（含并行测试设计、RTM 和阶段门）？”；确认前不初始化 |
| 普通需求、设计、编码、测试、修复或技术解释 | 不启用，按普通任务处理 |

**边界示例**：“用 W 模型开发登录功能” → 启用；“从需求开始走完整流程” → 先询问；“修复 `src/auth.ts` 并运行测试” → 不启用。

## 不可违反的约束

> 14 条硬红线：**命中即回退**（回到当前阶段起点）。完整版（含违反回退、脚本、反模式链接）见 [references/hard-constraints.md](references/hard-constraints.md)，**执行前必读**。

| # | 约束 | 核心语义（完整版见 hard-constraints.md） |
|---|---|---|
| 1 | 测试设计前置 | 阶段 1–4 开发产物完成后立即产出对应测试设计，不得推迟到编码后 |
| 2 | 阶段门放行 | 评审通过 + 🔴 CHECKPOINT 用户确认才推进；豁免审批走 S→R→V→人类四阶段（E1-E8） |
| 3 | RTM 为事实源 | `.w-model/rtm.json` 唯一事实源；实体每阶段回填，coverageStatus 与 coveragePercent 强一致 |
| 4 | 真实执行 | 不得估算覆盖率/测试结果/门禁结果；必须执行真实测试并记录输出 |
| 5 | 失败即回退 | 评审 C/D、测试失败、门禁退出码 1/2 均不得放行 |
| 6 | 按需加载 | 只读当前命令和阶段需要的参考；禁止一次加载整个 `references/` |
| 7 | 如实状态 | 未完成、未评审或未确认的阶段不得标为完成 |
| 8 | 编排者最小化 | O 只做编排；实施动作必须由子代理执行（反模式 #10 回退）；每阶段 S/V/G 各 ≥1 + R ≥3（反模式 #34） |
| 9 | 门禁退出码不可伪 | JSON 摘要含 `exitCode` 与 `process.exit()` 强一致；G 存档 stdout；run-log 交叉校验（SSoT §10E） |
| 10 | 系统层级树 + REQ 层级 | 7 层图谱；REQ `level` 1-4 必填、`level≥2` 须 `reqGroup` 指向 `level=1` 祖先 |
| 11 | 闭环机制 + R3 审查 | 5 脚本（含 check-preventive-review 无条件）每阶段门 exitCode=0；S 产出后 R3 三报告强制（反模式 #33/#42） |
| 12 | 返工必经根因定位 | V/G 不通过先 R 报告 → V 复审 → G 门禁 → S-fix（反模式 #18/#19） |
| 13 | 行为门禁按成熟度分级 | 阶段 1-4 TLA+（L1-L3）+ BDD（L1-L4）按项目成熟度强制（L1 可选 / L2 部分 / L3 全必跑） |
| 14 | 代码改动前后门禁 | 阶段 5-8 修改前 codegraph 影响分析落盘（反模式 #38）+ 改动后回归测试 |

完整反模式、检测信号和回退动作见 [references/anti-patterns.md](references/anti-patterns.md)。

## 编排者-子代理边界

> SSoT §3.4 为权威定义；[references/subagent-delegation.md](references/subagent-delegation.md) 为可执行细则；[references/dispatch-matrix.md](references/dispatch-matrix.md) 为分派总览矩阵（阶段 × 角色 × S 变体 × 产物 × reference × check 脚本）。本节为编排摘要。

**原则**：编排者工作最小化。编排者（O）只负责路由、状态读写、CHECKPOINT 等待、分派子代理、持久化、只读脚本；任何修改、编码、调测、分析、修正、验证产出的实施动作必须由子代理执行。

**角色划分（O / S / V / G / A / R）**：

| 角色 | 简称 | 职责 | 关键职责 + 脚本不变式 |
|---|---|---|---|
| 编排者 | O | 路由 / 状态读写 / CHECKPOINT / 分派子代理 / 持久化 / 只读脚本 | 只做编排，不实施任何产物动作。不变式：`check-role-dispatch.ts` 强制每阶段 S/V/G 各 ≥1 条（约束 #8）；越权实施命中反模式 #10（回退当前阶段起点） |
| 产出子代理 | S | 生成阶段开发产物 + 同步测试设计 + 更新 RTM 实体；**F（修复者）由 S 兼任**——返工时携带 R 报告执行修复 | 产出阶段产物 + 回填 RTM（约束 #3）+ 签名链 `inputProvenance` 来源证明。不变式：`check-signature-chain.ts` R3 校验来源（反模式 #32）；`check-run-log.ts` R7 校验时序；越界跑门禁/改 status 命中反模式 #22 |
| 评审子代理 | V | 按 [references/agent-personas.md](references/agent-personas.md) + [references/verifier-spec.md](references/verifier-spec.md) §8 产出 `VerifierOutput` JSON | 独立评审 + 产出 VerifierOutput（evidence 须具体引用）。不变式：`check-verifier-output.ts` R1-R13（含 R13 单轴下限 <0.70 判失败，反模式 #41）；越界跑门禁/改产物命中反模式 #22 |
| 门禁子代理 | G | 跑 `check-verifier-output.ts` / `check-artifact-gate.ts` + 回填证据摘要 | 独立跑门禁 + 回填 exitCode 证据。不变式：`check-run-log.ts` R6 用 gate-logs 交叉校验 exitCode；越界改产物/产出评审 JSON 命中反模式 #22 |
| 分析子代理 | A | 分块分析、交叉合并、图谱演进（阶段 1–4）；产出 `.w-model/ingestion/*` 与 `consolidated.json` | 只产出 ingestion 分析中间产物。不变式：`check-requirement-graph.ts` 由 G 独立跑（A 跑命中反模式 #22）；越界写正式阶段产物/改 status 命中反模式 #22 |
| 根因定位子代理 | R | 接收 V/G 的 `reworkHints` + 失败产物 + 上游产物，运用根因分析方法（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）定位根因，产出 `RootCauseReport`；可作为 R-lead 分派 R-persona 子代理并聚合产出。详见 [references/root-cause-locator.md](references/root-cause-locator.md) | 只产出根因定位报告，不实施修复。不变式：`check-rootcause-report.ts` R1-R10 由 G 校验 + V 复审后才可派 S-fix（反模式 #18/#19）；越界改产物/跑门禁/跨阶段定位命中反模式 #22 |

**每阶段分派时序**：O 路由 → 🔴 CHECKPOINT 进入确认 → **分派 S 产出** → **分派 V 评审** → **分派 G 门禁** → O 展示证据 → 🔴 CHECKPOINT 阶段门放行 → O 更新 `project.status`。阶段 8 终检额外分派 G 跑 `check-artifact-gate.ts`。

**角色分派完整性确认**（约束 #8）：O 须在 🔴 CHECKPOINT 阶段门放行前确认 run-log 中含 role=S/V/G 各 ≥1 条记录；**无条件须含 role=R ≥3 条记录**（completeness/reliability/security，覆盖所有 S 变体含 S-fix / S-emergency-fix）。缺失任一角色记录命中反模式 #34，回退到当前阶段起点补派。`check-role-dispatch.ts` 自动校验此约束（`--r3-enabled` flag 保留为 no-op 向后兼容）。

**只读脚本例外**：编排者可跑 `check-*.ts` 看退出码（用于展示/路由判定），但**不替代 G 子代理的回填职责**——G 子代理必须独立跑一次并产出证据摘要。

**违反处置**：命中反模式 #10「编排者越权实施」一律回到当前阶段起点，已越权产出的实体作废重做。检测信号与回退动作详见 [references/anti-patterns.md](references/anti-patterns.md) #10 与 [references/subagent-delegation.md](references/subagent-delegation.md)「强制约束」节。

## self-as-verifier 模式

> 单 Agent 兼任 S/V/G/R 多角色的正式定义与独立性保证。

**定义**：self-as-verifier 模式指单 Agent 在同一阶段内兼任 S（产出）/ V（评审）/ G（门禁）/ R（根因/R3）多角色的执行模式。**启用条件**：仅限 demo / 非生产 / 教学演示项目（生产项目禁止）；启用时须在 `project.status` 标记 `selfAsVerifier: true`。

**独立性保证**（关键约束）：兼任时须产出各角色独立产物文件，路径不得相同——S 产出阶段产物；V 产出 `.w-model/verifier-outputs/<phase>-<target>.json`；G 产出 `.w-model/gate-logs/<timestamp>-<script>.json`；R 产出 `RootCauseReport` / `PreventiveReview` JSON。run-log 条目的 `artifacts` 字段须列出各角色独立产物路径。违反独立性（V/G/R 产物与 S 产出同路径）命中反模式 #35。

**与约束 #8 的关系**：self-as-verifier 模式下 S/V/G 可同一 `runId` 条目标记多角色（如 `role="S/V"`），但 `check-role-dispatch.ts` 仍须校验每阶段含 S/V/G 各 ≥1 条记录；R 角色 ≥3 条不可由同一行满足（R3 三报告须独立）。

**校验脚本**：`check-verifier-output.ts --self-as-verifier` 校验 VerifierOutput JSON 路径与 S 产出路径不同。

## 核心操作行为

> 吸收自 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `using-agent-skills`，适配 W 模型语境。与「不可违反的约束」互补：约束是硬红线（命中即回退），操作行为是日常准则（违反不回退但降低质量）。SSoT §4A 为权威定义。完整版（八条操作行为 + 失败模式 F1-F10）见 [references/operation-behaviors.md](references/operation-behaviors.md)，按需加载。

## 执行工作流

每次启用技能后按顺序执行。**编排者只做编排**——所有实施动作（产出 / 评审 / 门禁）必须分派子代理执行（见「编排者-子代理边界」节与 [references/subagent-delegation.md](references/subagent-delegation.md)）。

1. **路由任务**（O）：识别命令、当前阶段和用户意图；歧义触发先确认。
2. **读取状态**（O）：若 `.w-model/` 存在，读取 `project.json` 与 `rtm.json`；状态损坏时先恢复，不得继续推进。
3. **检查前置产物**（O）：缺少上游阶段产物时拒绝跳阶段，并指出应返回的命令。
4. **加载最小引用集**（O）：只加载 `SKILL.md` + 当前阶段 `phase-N-*.md` 摘要 + 所需状态文件；阶段细则由 S 子代理按需加载。
5. **初始化确认**（O）：首次进入项目前确认技术栈、当前阶段、同步测试设计和产物清单。
5.5. **ingestion 子流程**（O → A → G，阶段 1–4）：O 跑 `plan-chunks.ts` → 🔴 CHECKPOINT · ingestion 规划确认 → 并行分派 A-chunk → 分派 A-cross（阶段1）/A-evolve（阶段2-4）合并建图产出 `consolidated.json` → 分派 G 跑 `check-requirement-graph.ts` → 收敛循环（MAX_ROUNDS=5）→ 🔴 CHECKPOINT · ingestion 收敛确认。详见 [references/ingestion-chunk.md](references/ingestion-chunk.md) 与 [references/ingestion-cross.md](references/ingestion-cross.md)。
6. **分派 S 子代理产出**（O → S）：生成开发产物 + 同步测试设计 + 更新 RTM 实体；**阶段 1–4 额外产出对应层级 TLA+ 规格（`.tla` + `.cfg` + `tla-manifest.json`）与 BDD features（`.feature` + `bdd-manifest.json`）**（约束 #13，按成熟度分级）；S 返回 `{产物路径, RTM diff, selfCheck}`。**编排者不得直接产出**。S 任务过重时可拆为 S-doc / S-tla / S-bdd 三次分派，时序：S-doc → S-tla → S-bdd → V → G（详见 [references/subagent-delegation.md](references/subagent-delegation.md)「S 拆分机制」节）。
6.5. **分派 R3 预防性审查**（O → R3）：S 产出后、V 评审前，分派 R 子代理执行三阶段预防性审查（completeness/reliability/security），产出 `.w-model/preventive-reviews/<phase>-{completeness,reliability,security}.json`（约束 #11）。R3 三阶段可并行分派。
7. **分派 V 子代理评审**（O → V）：按 `targetKind` 路由 Persona，产出 `VerifierOutput` JSON。**编排者不得自评**。
8. **分派 G 子代理门禁**（O → G）：跑 `check-verifier-output.ts`，返回 `{exitCode, qualityLevel, passed, reworkHints}`。**阶段 1–4 额外分派 G 跑 `check-tla-model.ts` + `check-bdd-model.ts`**（约束 #13）；**阶段 5 额外跑 `check-code-tla-consistency.ts`**（代码-TLA+ 一致性回归，四维度校验）。编排者**可同步跑一次只读脚本看退出码**用于展示，但 G 子代理的回填不可省略。
9. **验证与暂停**（O）：若 G 返回 `exitCode=1` 或 `qualityLevel ∈ {C,D}` → **分派 R 子代理定位根因**（产出 RootCauseReport）→ **分派 V 复审根因报告** → **分派 G 门禁**（check-rootcause-report.ts）→ **分派 S-fix 修复**（携带 R 报告）→ 重走 V → G；若通过 → 🔴 CHECKPOINT 等待用户决定。跳过 R 直接分派 S 返工命中反模式 #18。**阶段 1–4 TLA+ 门禁退出码 1 亦不得放行**（反模式 #15）。
9.5. **冰山扫掠**（O → R-iceberg）：**ICEBERG-A**（S-fix 返工通过后）与 **ICEBERG-B**（阶段门放行前）分派 R-iceberg 子代理做三维度×六类别深挖扫掠，产出 `.w-model/iceberg/<reportId>.json`（IcebergSweepReport）；G 跑 `check-iceberg-sweep.ts`（R1-R8）。`newFindings=[]` 即终止；达 maxIcebergRounds=5 时 CHECKPOINT 升级由用户裁定。新发现须经 V 复审后走标准 R→V→G→S-fix（跳过命中反模式 #44）。详见 [references/iceberg-sweep-guide.md](references/iceberg-sweep-guide.md)。
10. **持久化状态**（O）：只有用户放行后才更新 `project.status`；取消时保留产物但不推进状态。

> 🔴 **CHECKPOINT · 项目初始化**：复述"进入阶段 / 同步测试设计 / 预期产物"，获得确认后才能分派 S 子代理。
>
> 🔴 **CHECKPOINT · 阶段门放行**：展示 G 子代理返回的「质量等级 / 各子标准分 / `reworkHints`」，等待用户选择放行或返工。
>
> 🔴 **CHECKPOINT · 发布放行**：阶段 8 终检分派 G 跑 `check-artifact-gate.ts`，退出码 0 后展示 RTM 覆盖率、四级测试结果与 `GATE_JSON`，等待用户选择发布或回到编码。

完整阶段切换、失败回退与质量门流程见 [references/workflow.md](references/workflow.md)。

## 阶段路由

| # | 开发阶段 | 同步/执行测试 | 外部技能吸收标记 | 必读参考 |
|---|---|---|---|---|
| 1 | 需求分析 | 验收测试设计 | User Stories + Out of Scope + Implementation/Testing Decisions | [references/phase-1-requirements.md](references/phase-1-requirements.md) |
| 2 | 系统设计 | 系统测试设计 | seam 决策 | [references/phase-2-system-design.md](references/phase-2-system-design.md) |
| 3 | 概要设计 | 集成测试设计 | seam 决策 | [references/phase-3-outline-design.md](references/phase-3-outline-design.md) |
| 4 | 详细设计 | 单元测试设计 | seam 决策 | [references/phase-4-detailed-design.md](references/phase-4-detailed-design.md) |
| 5 | 编码实现 | 单元测试执行 | Tracer-bullet 票据拆解 + opsx 三段式 + codegraph 修改前查询 | [references/phase-5-coding.md](references/phase-5-coding.md) |
| 6 | 集成测试 | 集成测试执行 | opsx 三段式 + codegraph 修改前查询 | [references/phase-6-integration-test.md](references/phase-6-integration-test.md) |
| 7 | 系统测试 | 系统测试执行 | opsx 三段式 + codegraph 修改前查询 | [references/phase-7-system-test.md](references/phase-7-system-test.md) |
| 8 | 验收测试 | 验收测试执行 | archive 机制 + opsx 三段式 + codegraph 修改前查询 | [references/phase-8-acceptance-test.md](references/phase-8-acceptance-test.md) |

**设计级别增强**：阶段 1-4 产出升级为主模板（§0 SSOT 头 + 引用块）+ 6 独立子模板（system-context / system-architecture / interface-contract / class-design / data-model / glossary / traceability-matrix / behavior-spec / discipline-dod / uml-modeling，按阶段裁剪），产出目录 `docs/phase<N>-*/`；G 门禁 `check-requirement-graph.ts --phase=N --spec-dir=<dir>`（R7-R14）+ `check-artifact-gate.ts --phase=N --spec-dir=<dir>`（引用块/SSOT/DoD 结构校验）。

所有阶段另读 [references/rtm-guide.md](references/rtm-guide.md)。TLA+（阶段 1-4）→ [references/tla-plus-guide.md](references/tla-plus-guide.md)；BDD（阶段 1-8）→ [references/bdd-guide.md](references/bdd-guide.md)；阶段门评审 → [references/verifier-spec.md](references/verifier-spec.md)；编码后质量检查 → [references/quality-standards.md](references/quality-standards.md)；状态 Schema → [references/data-models.md](references/data-models.md)；异常/跨平台/大项目 → [references/operational-recovery.md](references/operational-recovery.md)；子代理分派 → [references/subagent-delegation.md](references/subagent-delegation.md)。

## Bundled Resources（按需加载契约）

> 借鉴 drawio-skill 的 Bundled Resources 设计：明示每个资源的触发条件，**none of them need to be in context up front**。约束 #6「按需加载」的可执行清单。目录级索引——完整逐文件表见 [references/dispatch-matrix.md](references/dispatch-matrix.md)（阶段 × 角色 × S 变体 × 产物 × reference × check 脚本总览矩阵，编排者分派前必读）与 [references/command-reference.md](references/command-reference.md)（/wm 命令细节）。

| 资源目录 | 触发条件 |
|---|---|
| `references/`（53 个 .md） | 按阶段/角色触发读取——阶段细则 `phase-N-*.md`、评审 `verifier-spec.md` + `agent-personas.md`、分派 `subagent-delegation.md` + `dispatch-matrix.md`、返工 `root-cause-locator.md`、门禁 `hard-constraints.md` + `definition-of-done.md`、行为 `operation-behaviors.md`、自检 `quick-self-check.md`、其余见 dispatch-matrix 逐文件表 |
| `scripts/cli/`（31 个 .ts：26 个 check-* 门禁 + 5 个工具 CLI） | 仅供 G 子代理执行（阶段门 / 质量门 / 图谱门禁 / TLA+ 行为门禁 / 代码-TLA+ 一致性回归 / 签名链 / 归档完整性 / R3 / TLA+/BDD 同步 / 角色分派 / 状态机一致性 / 冰山扫掠检查点）；编排者只读例外见「编排者-子代理边界」节 |
| `subagent/`（28 个 persona） | 仅供 V-lead / R-lead 多角度分析，按 [references/subagent-persona-matrix.md](references/subagent-persona-matrix.md) 选用 |
| `templates/` | 产出时按对应阶段读取（requirement-spec / system-design / interface-design / detailed-design / coding / integration-test / acceptance-test / test-case / test-report / rtm / review-report / tla-spec-template / feature.template / budget / run-log） |

## 命令速查

> 编排者（O）只路由 + CHECKPOINT + 状态持久化；产出（S）、评审（V）、门禁（G）均由子代理执行。详见 [references/subagent-delegation.md](references/subagent-delegation.md)。

| 命令 | 路由 | 关键前置/行为 | 子代理分派 |
|---|---|---|---|
| `/wm analyze <需求>` | 阶段 1 | 首次初始化并同步验收测试设计；触发 ingestion 子流程（A 角色 + 图谱校验） | O 路由 → S 产出 → V 评审 → G 门禁 |
| `/wm design type=<架构\|概要\|详细>` | 阶段 2/3/4 | 必须存在上一阶段已放行产物；触发 ingestion 子流程（A 角色 + 图谱校验，S→A 路径） | O 路由 → S 产出 → V 评审 → G 门禁 |
| `/wm code <功能>` | 阶段 5 | 必须存在已放行详细设计；生成并真实执行单元测试 | O 路由 → S 产出代码+单测+RTM → V 评审 → G 门禁 |
| `/wm test type=<单元\|集成\|系统\|验收> result=<pass\|fail>` | 阶段 5–8 | `result` 必填且必须来自真实测试输出 | O 路由 → S 执行测试+回填 RTM → V 评审报告 → G 门禁 |
| `/wm review <目标>` | 阶段门 | 返回评审指引；外部 Agent 执行评审 | O 路由 → V 评审 → G 门禁（不由 O 自评） |
| `/wm status` | 状态查询 | 读取状态与 RTM，不修改数据；由 wm-status.ts 脚本化输出 | O 只读，不分派子代理 |
| `/wm help` | 帮助 | 不读项目状态 | O 只读，不分派子代理 |
| `/wm reset` | 重置 | 🔴 CHECKPOINT 后清空实体，保留项目元信息 | O 执行（仅状态文件操作，非阶段产物） |
| `/wm export [目录]` | 导出 | 输出 JSON 与 RTM Markdown | O 只读导出，不分派子代理 |
| `/wm import <文件>` | 导入 | 校验后写入；覆盖现有数据前 🔴 CHECKPOINT | O 执行（仅状态文件操作） |
| `/wm hill-climbing` | 改进信号 | L2+ 项目：分析 run-log 产出 HarnessImprovementReport；人审后手动应用改进 | O 分析（状态读写+分析，非实施） |
| `/wm metrics` | 流程度量 | 从 run-log/budget 生成流程度量报告；只读 | O 只读，不分派子代理 |

每个命令的输入、输出、失败动作和状态更新规则见 [references/command-reference.md](references/command-reference.md)。产出存 `.w-model/hill-climbing/<timestamp>-report.json`。

## 阶段统一产出契约

每个阶段必须：

1. 按阶段参考定义的输入和算法产出文档。
2. 使用对应 [templates/](templates/) 模板；测试用例至少包含 ID、场景、输入、预期输出和优先级。
3. 同步更新 `.w-model/rtm.json` 的需求、设计、代码与测试映射。
4. 给出风险/缺陷等级和缓解措施。
5. 输出阶段摘要：产物路径、RTM 覆盖状态、验证证据、阻塞项和下一步。
6. **外部技能吸收三要素**（适用阶段）：阶段 1 = User Stories + Out of Scope + Implementation/Testing Decisions；阶段 2-4 = 测试 seam 决策（三层一致性）；阶段 5 = Tracer-bullet 票据拆解（tickets.md）；阶段 8 = archive 机制。详见 [decision-log/absorptions.md](../docs/changes/decision-log/absorptions.md)。

## 阶段门与质量门

阶段产物由外部 Agent 按 [references/verifier-spec.md](references/verifier-spec.md) 评审。JSON 产出后立即执行：

```bash
npx tsx w-model-dev/scripts/cli/check-verifier-output.ts "<output.json>"   # 仅退出码 0 + qualityLevel A/B 才可进入阶段门确认
```

阶段 1–4 额外执行 TLA+ 行为门禁（与图谱门禁正交叠加）：`check-tla-model.ts "<tla-manifest.json>" --graph=<graph.json> [--phase=1|2|3|4]`（`--graph` 在 phase>=2 时强制；`--skip-tlc` 已移除不得跳过 TLC）。**阶段 4 TLA+ 零违反 + 图谱零违反才放行进编码**（约束 #13）。阶段 1-8 BDD 行为门禁：`check-bdd-model.ts --phase=N`（D1-D8）。

阶段 5/6/7 G 门禁推荐使用 `check-artifact-gate.ts --phase=N`（阶段级校验，不否决 pending 的后续测试层；反模式 #21 禁止直接跑终检跳过阶段级校验）：

```bash
npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts --phase=5|6|7|8 [project-dir]   # 默认 phase=8 终检（向后兼容）
```

**NFR/CON 横切行特殊规则**：阶段 1~4 仅校验 `designDoc` 非空（横切登记）；阶段 5~8 校验 `designDoc` + `codeModule` 非空（横切回填）；不校验 NFR/CON 行的四级测试字段。

**graph 自动发现**：`check-artifact-gate.ts` 按 `graph.json` → `consolidated-phase4.json` → … → `consolidated-phase1.json` 优先级自动查找。

验收终检：`check-artifact-gate.ts "<project-dir>"`——退出码 0 且用户在发布检查点确认，项目才可完成；退出码 1/2 一律停止并按 `GATE_JSON` 回退。单元测试代码覆盖率须达 80%，代码规范检查通过且无高危安全漏洞。阶段门与质量门完整说明见 [references/workflow.md](references/workflow.md) 与 [references/quality-standards.md](references/quality-standards.md)。

## 测试结果真实性

`/wm test` 的 `result` 只用于回填已执行结果，不是用户声明即可信的“通过开关”。回填前必须具有：测试运行器命令与退出码；`passed / failed / pending` 数量；单元测试覆盖率（仅单元测试必填）；失败用例与根因（`result=fail` 时）。缺少证据时拒绝标记通过，保持状态为待执行，并给出应运行的测试命令。

## 快速自检

在任何推进或完成声明前，按 [references/quick-self-check.md](references/quick-self-check.md) 逐项核验（触发边界 / 上游一致 / 产物与测试设计齐全 / RTM 无估算 / 真实证据可复核 / CHECKPOINT 确认 / 按需加载 / 编排者未越权 / 图谱与行为门禁通过 / 阶段门理解证据 / 预算与成熟度 / 闭环 4 脚本 exitCode=0）。

交互样例按需读取 [examples/requirement-analysis.md](examples/requirement-analysis.md)、[examples/system-design.md](examples/system-design.md)、[examples/coding.md](examples/coding.md) 或 [examples/test-execution.md](examples/test-execution.md)。
