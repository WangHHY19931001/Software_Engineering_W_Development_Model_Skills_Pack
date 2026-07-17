---
name: w-model-dev
description: >-
  Drive the full W-model software development lifecycle with parallel development
  and test design. Use when the user wants to run requirements analysis, system/outline/detailed
  design, coding with unit tests, integration testing, system testing, or acceptance
  testing as a closed-loop W-model workflow; when the user invokes /wm commands
  (analyze, design, code, test, review, status); or when building software that
  needs synchronized test design alongside each development stage with requirements
  traceability.
---

# W-Model AI Assistant Skill

## 描述

本技能基于 AI 辅助编码技术，实现软件工程中 **W 开发模型**的全流程闭环管理。W 模型由 Evolutif 公司提出，由两个同步推进的"V"字结构组成：左 V 为开发侧（需求分析 → 系统设计 → 概要设计 → 详细设计 → 编码），右 V 为测试侧（验收测试设计 → 系统测试设计 → 集成测试设计 → 单元测试设计 → 测试执行）。

**核心原则**：开发与测试并行推进——每一个开发阶段都同步产出对应的测试设计，使测试前置、缺陷早发现，并通过需求跟踪矩阵（RTM）保证全链路可追溯。

## 架构定位（重要）

本技能遵循「技能包只包含提示词、参考、模板，里面的脚本只做门禁」的架构原则：

- **技能本身不内置 LLM 调用**。阶段产物的 LLM-as-a-Verifier 评审由外部 Agent 按提示词执行，详见 [references/verifier-spec.md](references/verifier-spec.md)；评审输出结构的防漂移校验由 [scripts/check-verifier-output.ts](scripts/check-verifier-output.ts) 完成。
- **技能本身不包含演化机制与轨迹分析**。技能自演化（Rollout / Reflect / Edit / Skill Lift 评估等）由外部工具完成：
  - SkillOpt（微软）：https://github.com/microsoft/SkillOpt
  - darwin-skill：https://github.com/alchaincyf/darwin-skill
- **需求形式化为可选外部委托**。Phase 1（需求分析）的部分语义工作（结构化提取 / BDD 生成 / 知识图谱 / NFR 标记 / TLA+ / Lean 4）可委托给 [SRS-Formalizer](https://github.com/WangHHY19931001/SRS-Formalizer)（外部技能，Agent 驱动 + 脚本门禁，架构与本技能同源）。委托为 **opt-in**，仅当存在正式 SRS 文档且用户显式启用时触发；TLA+/Lean 仅对并发/状态机/安全合规模块条件触发。权威性约定：RTM 以 `.w-model/rtm.json` 为唯一事实源，SRS-Formalizer 产出的追溯矩阵仅作输入；Phase 1 阶段门放行仍以本技能 `check-verifier-output.ts` 为准，SRS-Formalizer 的 `verify-gate` 仅作内部子门禁。详见 [references/phase-1-requirements.md](references/phase-1-requirements.md)「可选：需求形式化」节。
- **技能包内的脚本只做门禁**：
  - [scripts/check-artifact-gate.ts](scripts/check-artifact-gate.ts)：工件质量门（RTM 覆盖率 + 四级测试通过）
  - [scripts/check-verifier-output.ts](scripts/check-verifier-output.ts)：外部 Agent 评审输出的结构化校验
  - [scripts/gate-logic.ts](scripts/gate-logic.ts) + [scripts/verifier-logic.ts](scripts/verifier-logic.ts)：纯逻辑单点事实源

## 使用场景

触发本技能的条件：

- 用户明确提及 W 模型、W 开发模型，或希望按"开发与测试并行"的方式推进项目
- 用户使用 `/wm` 系列命令（analyze / design / code / test / review / status / help / reset / export / import）
- 用户要从需求出发，逐步完成设计、编码、各级测试的完整软件交付
- 用户需要对已有项目补齐测试设计、做需求追溯或质量门检查
- 用户要求在文档/代码/测试之间建立可追踪的对应关系

## 核心约束

1. **并行原则不可破坏**：进入任一开发阶段时，必须同步启动对应测试类型的设计（见下表），不得将测试设计后置。
2. **阶段门评审（Stage Gate）**：每个阶段产出必须通过评审后才能进入下一阶段；评审不通过则回到当前阶段起点返工。
3. **RTM 同步维护**：每次需求或设计变更，必须同步更新需求跟踪矩阵；定期核验需求覆盖率应为 100%。
4. **质量门**：代码覆盖率 ≥ 80%；代码规范检查通过；安全检测无高危漏洞；各级测试全部通过方可放行。
5. **以 SSoT 为准**：本技能以 `docs/skill-design-document_SSoT.md` 为单一事实来源，所有决策、用例、验收标准以其为准。
6. **最小必要信息**：本文件仅保留编排逻辑，各阶段细则仅加载当前阶段对应的 `references/phase-N-*.md`，模板从 `templates/` 取用。
7. **LLM 评审由外部执行**：阶段产物的 LLM-as-a-Verifier 评审不内置；外部 Agent 按 [references/verifier-spec.md](references/verifier-spec.md) 执行，并通过 [scripts/check-verifier-output.ts](scripts/check-verifier-output.ts) 防漂移。

## 反例与黑名单（不要做什么）

以下反模式均为 W 模型执行中真实高发陷阱，命中任一条即视为流程破坏，必须回退到对应阶段起点：

| # | 反模式（不要做） | 危害 | 正确做法 |
|---|---|---|---|
| 1 | 跳过阶段门评审"直接进入下一阶段" | 缺陷后移，测试前置失效 | 必须按 §2 走完评审 + 🔴 CHECKPOINT 放行 |
| 2 | 将测试设计后置到编码之后 | 破坏 W 模型并行原则，测试失去前置发现能力 | 进入开发阶段时同步产出对应测试设计（见并行对应表） |
| 3 | 用 LLM 自行"估算"质量门结果 | 估算不可信，覆盖率/测试通过状态会被编造 | 必须执行 `check-artifact-gate.ts`，以退出码 + GATE_JSON 为准 |
| 4 | 评审未通过时悄悄小修后继续 | rework 未闭环，缺陷被掩盖 | 回到本阶段起点返工，重新产出并重评 |
| 5 | 一次性载入全部 `references/` | 上下文污染，阶段聚焦丢失 | 仅加载当前阶段所需 `references/phase-N-*.md` |
| 6 | 用 LLM 估算 RTM 覆盖率 | 覆盖率造假，追溯链断裂 | 实际核验 RTM 登记项，覆盖率必须 100% |
| 7 | 质量门脚本退出码 1/2 时放行发布 | 缺陷带病上线 | 退出码非 0 一律回到编码实现，附 GATE_JSON 详情 |
| 8 | 越过 🔴 CHECKPOINT 自动推进 | 用户失去决策权，自主失控 | 到达 CHECKPOINT 必须暂停等用户确认 |
| 9 | 谎报阶段状态（未完成标为完成） | 阶段门依赖断裂，下游全部失真 | `status` 字段如实反映，未完成不得推进 |

## 阶段与测试并行对应表

| # | 开发阶段（左 V） | 同步测试设计（右 V） | 对应执行测试 | 详细指引 |
|---|---|---|---|---|
| 1 | 需求分析 | 验收测试设计 | 验收测试执行 | [phase-1-requirements.md](references/phase-1-requirements.md) |
| 2 | 系统设计 | 系统测试设计 | 系统测试执行 | [phase-2-system-design.md](references/phase-2-system-design.md) |
| 3 | 概要设计 | 集成测试设计 | 集成测试执行 | [phase-3-outline-design.md](references/phase-3-outline-design.md) |
| 4 | 详细设计 | 单元测试设计 | 单元测试执行 | [phase-4-detailed-design.md](references/phase-4-detailed-design.md) |
| 5 | 编码实现 | 单元测试执行 | — | [phase-5-coding.md](references/phase-5-coding.md) |
| 6 | 集成测试 | — | 集成测试执行 | [phase-6-integration-test.md](references/phase-6-integration-test.md) |
| 7 | 系统测试 | — | 系统测试执行 | [phase-7-system-test.md](references/phase-7-system-test.md) |
| 8 | 验收测试 | — | 验收测试执行 | [phase-8-acceptance-test.md](references/phase-8-acceptance-test.md) |

## 完整工作流程

```
需求分析 ──(同步验收测试设计)──► 评审 ──通过──► 系统设计
                                              │不通过► 回到需求分析
系统设计 ──(同步系统测试设计)──► 评审 ──通过──► 概要设计
                                              │不通过► 回到系统设计
概要设计 ──(同步集成测试设计)──► 评审 ──通过──► 详细设计
                                              │不通过► 回到概要设计
详细设计 ──(同步单元测试设计)──► 评审 ──通过──► 编码实现
                                              │不通过► 回到详细设计
编码实现 ──(执行单元测试)──────► 代码审查 ──通过──► 集成测试
                                              │不通过► 回到编码实现
集成测试 ──(接口验证)──────────► 通过──► 系统测试
                              │不通过► 回到编码实现
系统测试 ──(性能/安全测试)─────► 缺陷修复 ──完成──► 验收测试
                              │需修复► 回到编码实现
验收测试 ──(用户确认)──────────► 通过──► 项目完成
                              │不通过► 回到需求分析
```

## 命令接口

### 核心命令

| 命令 | 功能 | 参数 | 产出 |
|---|---|---|---|
| `/wm analyze` | 需求分析 | `input`: 需求描述 | 需求规格说明书、验收测试用例 |
| `/wm design` | 系统设计 | `type`: 架构 / 概要 / 详细 | 设计文档、对应测试用例 |
| `/wm code` | 代码生成 | `feature`: 功能描述 | 代码文件、单元测试 |
| `/wm test` | 测试执行 | `type`: 单元 / 集成 / 系统 / 验收 | 测试报告 |
| `/wm review` | LLM 评审指引 | `target`: REQ-/SD-/AT-/文件路径 | 评审指引（指向 verifier-spec.md） |
| `/wm status` | 项目状态 | 无 | 当前阶段、完成进度 |

### 辅助命令

| 命令 | 功能 |
|---|---|
| `/wm help` | 显示帮助信息 |
| `/wm reset` | 重置当前项目状态 |
| `/wm export` | 导出项目文档 |
| `/wm import` | 导入现有项目 |

## 指令（执行规则）

> **检查点机制**：本流程在关键决策点用 `🔴 CHECKPOINT` 显性标记暂停点。到达该标记时**必须暂停并向用户确认**后再继续——视觉标记是 Agent 解析的扫描锚点，不可用"必须/应当"等措辞替代。

### 0. 任务接入

1. 识别用户意图对应的 W 模型阶段（对照"阶段与测试并行对应表"）。
2. 若项目尚未初始化，先确认技术栈（前端 / 后端 / 数据库 / 其他）并建立项目状态记录。
3. 仅加载当前阶段所需的 `references/` 文件，避免一次性载入全部细则。

> 🔴 **CHECKPOINT · 项目初始化**：技术栈与 W 模型阶段确认后、正式产出前暂停，向用户复述「将进入 X 阶段 / 同步产出 Y 测试设计 / 预期产物清单」，得到确认再进入 §1。

### 1. 执行阶段任务（每个阶段统一遵循）

1. **读取阶段指引**：用 Read 工具加载对应 `references/phase-N-*.md`，严格按其输入 / 输出 / AI 能力 / 测试用例设计 / 验收标准执行。
2. **并行产出测试设计**：在本阶段开发产物产出后，立即同步产出对应测试类型的设计文档（不得推迟）。
3. **套用模板**：从 `templates/` 取对应模板填充产出物，保证格式规范一致。
4. **更新 RTM**：在 `templates/rtm.md`（或项目内 RTM 文件）登记本阶段产物与需求 / 设计的映射，确保覆盖状态可追踪。RTM 维护规则见 [references/rtm-guide.md](references/rtm-guide.md)。
5. **自检验收标准**：对照阶段指引中的"验收标准"逐条核验，未达标不得提交评审。

### 2. 阶段门评审（LLM-as-a-Verifier，外部执行）

阶段门评审采用 LLM-as-a-Verifier 评审流程，**本技能不内置 LLM 调用**，由外部 Agent 按提示词执行：

1. 读取 [references/verifier-spec.md](references/verifier-spec.md) 了解三维度验证 / 连续评分 / PPT / 子标准 / 输出 Schema。
2. 按 §8 提示词模板构造评审请求，由外部 Agent 执行 LLM-as-a-Verifier 评审。
3. 评审结果写入 JSON 文件，立即调用校验脚本防漂移：

```bash
# 退出码 0=通过 / 1=校验失败 / 2=输入错误
npx tsx w-model-dev/scripts/check-verifier-output.ts <output.json>
```

4. 评审通过（`passed=true`，质量等级 A/B） → 进入下一阶段，更新项目状态。
5. 评审不通过（`passed=false`，质量等级 C/D） → 回到本阶段起点返工，按 `reworkHints` 修复。

> 🔴 **CHECKPOINT · 阶段门放行**：评审结果出炉后暂停，向用户展示「质量等级 / 各子标准分 / reworkHints（若有）」，由用户确认「放行进入下一阶段」或「返工」。未确认不得自动推进或自动返工。

### 3. 质量门（编码及之后阶段强制）

执行顺序：代码提交 → 自动化代码审查 → 单元测试 → 集成测试 → 系统测试 → 质量门检查 → 发布。任一环节不通过回到编码实现。质量标准见 [references/quality-standards.md](references/quality-standards.md)。

```
代码提交 → 自动化代码审查 ──通过──► 单元测试 ──通过──► 集成测试
                │不通过                 │不通过              │
                ▼                        ▼                   ▼
              回到编码                回到编码           系统测试 ──通过──► 质量门 ──通过──► 发布
                                                                     │不通过         │不通过
                                                                     ▼               ▼
                                                                  回到编码       回到编码
```

**门禁脚本调用（Agent 执行）**：到达质量门检查点时，Agent 直接执行技能包内的门禁脚本获取确定性判定，而非靠 LLM 自行估算：

```bash
# 工件质量门：读取 .w-model/rtm.json，校验 RTM 覆盖率 100% 且四级测试全部通过
# 退出码 0=通过 / 1=未通过 / 2=输入错误；末尾输出 GATE_JSON {...} 供程序解析
npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]
```

> 🔴 **CHECKPOINT · 发布放行**：质量门脚本返回通过（退出码 0）后暂停，向用户展示「RTM 覆盖率 / 四级测试结果 / GATE_JSON 摘要」，由用户确认「发布」或「回到编码」。退出码 1/2 一律不得放行，直接回到编码实现并附 GATE_JSON 详情。

> 工件质量门的判定逻辑由 [`scripts/gate-logic.ts`](scripts/gate-logic.ts) 提供（单点事实源），
> 由 `scripts/check-artifact-gate.ts` CLI 包装，Agent 直接执行得到确定性判定。
>
> **技能演化不在技能包内**：本技能不包含技能验证门、Skill Lift 评估、Rollout 记录等内容。
> 技能自演化由外部工具完成（[SkillOpt](https://github.com/microsoft/SkillOpt) /
> [darwin-skill](https://github.com/alchaincyf/darwin-skill)），它们可消费本技能产出的
> `VerifierOutput` JSON 作为训练信号。

### 4. 数据与状态管理

- 项目数据模型、需求 / 设计 / 测试用例数据结构见 [references/data-models.md](references/data-models.md)。
- 项目状态字段取值：`需求分析 | 系统设计 | 概要设计 | 详细设计 | 编码 | 集成测试 | 系统测试 | 验收测试`。
- 每次阶段切换更新 `status` 与 `updatedAt`。

## 交互模式示例

完整交互示例见 `examples/`：

- 需求分析交互：[examples/requirement-analysis.md](examples/requirement-analysis.md)
- 设计阶段交互：[examples/system-design.md](examples/system-design.md)
- 编码阶段交互：[examples/coding.md](examples/coding.md)

## 通用输出规范

1. 阶段开始时简要说明"正在执行 X 阶段"，并列出将同步产出的测试设计类型。
2. 产出文档使用 Markdown，文件命名遵循 `<类型>-<模块>-<时间或序号>.md`。
3. 测试用例必须含：用例 ID、测试场景、输入、预期输出、优先级。
4. 涉及缺陷或风险时给出等级与缓解措施。
5. 每个阶段结束输出"阶段完成摘要"：产出清单、RTM 覆盖状态、下一阶段动作。

## 验收检查清单（项目级）

- [ ] 需求规格说明书完整
- [ ] 设计文档完整且符合规范
- [ ] 代码实现完成且通过编译
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 集成测试全部通过
- [ ] 系统测试全部通过
- [ ] 安全测试无高危漏洞
- [ ] 性能测试达标
- [ ] 验收测试通过
- [ ] 用户确认签字
- [ ] 交付文档齐全
- [ ] RTM 覆盖率 100%

## 文件清单

```
w-model-dev/
├── SKILL.md                       # 本文件：编排与命令（YAML frontmatter + 阶段流）
├── scripts/                       # 门禁校验脚本（Agent 可直接执行，自包含）
│   ├── gate-logic.ts              #   工件质量门纯逻辑（单点事实源，CLI 调用）
│   ├── check-artifact-gate.ts     #   工件质量门 CLI（读 .w-model/rtm.json）
│   ├── verifier-logic.ts          #   Verifier 输出校验纯逻辑（单点事实源）
│   └── check-verifier-output.ts   #   Verifier 输出校验 CLI（防外部 Agent 输出漂移）
├── references/                    # 阶段细则与规范（仅当前阶段加载）
│   ├── phase-1-requirements.md
│   ├── phase-2-system-design.md
│   ├── phase-3-outline-design.md
│   ├── phase-4-detailed-design.md
│   ├── phase-5-coding.md
│   ├── phase-6-integration-test.md
│   ├── phase-7-system-test.md
│   ├── phase-8-acceptance-test.md
│   ├── data-models.md
│   ├── rtm-guide.md
│   ├── quality-standards.md
│   └── verifier-spec.md           #   LLM-as-a-Verifier 评审规范（提示词+Schema+子标准）
├── templates/                     # 文档模板
│   ├── requirement-spec.md
│   ├── system-design.md
│   ├── detailed-design.md
│   ├── interface-design.md
│   ├── test-case.md
│   ├── test-report.md
│   ├── review-report.md
│   └── rtm.md
└── examples/                      # 交互示例
    ├── requirement-analysis.md
    ├── system-design.md
    └── coding.md
```

> 本目录为标准 skill 结构，自包含。AI Agent 安装时只需拷贝整个 `w-model-dev/` 目录，
> 详见 [../docs/INSTALL.md](../docs/INSTALL.md)。
>
> **门禁脚本与 Markdown 的配合**：`references/quality-standards.md` 以 Markdown 描述
> 质量标准（人类可读、便于审阅），`scripts/check-*-gate.ts` 是同一套门禁的可执行实现
> （Agent 可直接调用得到结构化结论）。两者指向同一份事实源 `scripts/gate-logic.ts`，
> 避免文档与代码漂移。Agent 在阶段门评审时优先执行脚本获取确定性判定；若需了解判定依据，回查对应 Markdown（如 `references/quality-standards.md`）。
>
> **LLM 评审的配合**：`references/verifier-spec.md` 提供提示词与输出 Schema，
> `scripts/check-verifier-output.ts` 是同一套 Schema 的可执行校验。两者指向同一份事实源
> `scripts/verifier-logic.ts`，避免提示词与校验漂移。


