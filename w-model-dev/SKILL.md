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
2. **阶段门放行**：产物评审通过且用户在 🔴 CHECKPOINT 明确确认后，才能推进。
3. **RTM 为事实源**：`.w-model/rtm.json` 是追溯与测试状态的唯一事实源；变更产物时同步更新。
4. **真实执行**：不得估算覆盖率、测试结果或门禁结果；必须执行真实测试/脚本并记录输出。
5. **失败即回退**：评审 C/D、测试失败或门禁退出码 1/2 均不得放行。
6. **按需加载**：只读取当前命令和阶段需要的参考；禁止一次加载整个 `references/`。
7. **如实状态**：未完成、未评审或未确认的阶段不得标为完成。

完整反模式、检测信号和回退动作见 [references/anti-patterns.md](references/anti-patterns.md)。

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

每次启用技能后按顺序执行：

1. **路由任务**：识别命令、当前阶段和用户意图；歧义触发先确认。
2. **读取状态**：若 `.w-model/` 存在，读取 `project.json` 与 `rtm.json`；状态损坏时先恢复，不得继续推进。
3. **检查前置产物**：缺少上游阶段产物时拒绝跳阶段，并指出应返回的命令。
4. **加载最小引用集**：按“按需导航”读取当前阶段、RTM 指南和所需模板。
5. **初始化确认**：首次进入项目前确认技术栈、当前阶段、同步测试设计和产物清单。
6. **执行阶段**：生成开发产物与对应测试设计，更新 RTM，自检当前阶段验收标准。
7. **验证与暂停**：执行评审或确定性门禁，展示证据，并在对应 🔴 CHECKPOINT 等待用户决定。
8. **持久化状态**：只有放行后才更新 `project.status`；取消时保留产物但不推进状态。

> 🔴 **CHECKPOINT · 项目初始化**：复述“进入阶段 / 同步测试设计 / 预期产物”，获得确认后才能正式产出。
>
> 🔴 **CHECKPOINT · 阶段门放行**：展示质量等级、各子标准分与 `reworkHints`，等待用户选择放行或返工。
>
> 🔴 **CHECKPOINT · 发布放行**：质量门退出码 0 后展示 RTM 覆盖率、四级测试结果与 `GATE_JSON`，等待用户选择发布或回到编码。

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

- 正式 SRS 且用户显式启用形式化 → [references/phase-1-requirements-formalization.md](references/phase-1-requirements-formalization.md)
- 阶段门评审或 `/wm review` → [references/verifier-spec.md](references/verifier-spec.md)
- 编码后质量检查 → [references/quality-standards.md](references/quality-standards.md)
- 状态 Schema、导入、导出或恢复 → [references/data-models.md](references/data-models.md)
- 异常、跨平台、技术栈切换或大项目 → [references/operational-recovery.md](references/operational-recovery.md)

## 命令速查

| 命令 | 路由 | 关键前置/行为 |
|---|---|---|
| `/wm analyze <需求>` | 阶段 1 | 首次初始化并同步验收测试设计 |
| `/wm design type=<架构\|概要\|详细>` | 阶段 2/3/4 | 必须存在上一阶段已放行产物 |
| `/wm code <功能>` | 阶段 5 | 必须存在已放行详细设计；生成并真实执行单元测试 |
| `/wm test type=<单元\|集成\|系统\|验收> result=<pass\|fail>` | 阶段 5–8 | `result` 必填且必须来自真实测试输出 |
| `/wm review <目标>` | 阶段门 | 返回评审指引；外部 Agent 执行评审 |
| `/wm status` | 状态查询 | 读取状态与 RTM，不修改数据 |
| `/wm help` | 帮助 | 不读项目状态 |
| `/wm reset` | 重置 | 🔴 CHECKPOINT 后清空实体，保留项目元信息 |
| `/wm export [目录]` | 导出 | 输出 JSON 与 RTM Markdown |
| `/wm import <文件>` | 导入 | 校验后写入；覆盖现有数据前 🔴 CHECKPOINT |

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

交互样例按需读取 [examples/requirement-analysis.md](examples/requirement-analysis.md)、[examples/system-design.md](examples/system-design.md)、[examples/coding.md](examples/coding.md) 或 [examples/test-execution.md](examples/test-execution.md)。
