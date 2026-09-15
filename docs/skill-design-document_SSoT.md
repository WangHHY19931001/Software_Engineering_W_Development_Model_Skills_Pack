# W开发模型AI辅助技能设计文档（SSoT）

## 1. 项目概述

### 1.1 项目名称

**W-Model AI Assistant Skill** - 基于AI辅助编码技术的W开发模型闭环工作技能

### 1.2 项目定位

本技能旨在利用AI辅助编码技术，实现软件工程中W开发模型的全流程闭环管理，将开发与测试并行推进，提升软件开发效率和质量。

### 1.3 核心目标

- 实现W模型中开发与测试的并行协作
- 通过AI技术自动化各阶段的文档生成、代码编写和测试设计
- 构建完整的软件开发生命周期闭环
- 提升开发者的工作效率和软件产品质量

### 1.4 文档定位

本文档为W-Model AI Assistant Skill的**单一事实来源（Single Source of Truth, SSoT）**，包含所有设计决策、需求定义、测试用例、集成规范和验收标准。所有相关团队和系统均应以本文档为准。

> **参考实现**：本技能的设计经端到端调测验证（博客系统 8 阶段全流程），调测产物归档于
> [`docs/changes/archive/`](./changes/archive/)（明细见各归档 README 与 [CHANGELOG.md](../CHANGELOG.md)）。

> **架构定位**：本技能为**单纯的编排 + 校验脚本技能**——不包含任何编程式接入（无 TypeScript 引擎、无 npm 包、无 SDK）。技能包只包含提示词、参考、模板，里面的脚本只做门禁，不涉及 LLM 调用。
> LLM-as-a-Verifier 评审由外部 Agent 按提示词执行（规范见 [`w-model-dev/references/verifier-spec.md`](../w-model-dev/references/verifier-spec.md)）；
> 技能自演化由外部工具完成（[SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)）。

---

## 2. W模型理论基础

### 2.1 W模型定义

W模型由Evolutif公司提出，是对V模型的扩展和演进。它由两个相互关联、同步进行的"V"字型结构组成：

- **左V（开发侧）**：需求分析 → 系统设计 → 概要设计 → 详细设计 → 编码
- **右V（测试侧）**：验收测试设计 → 系统测试设计 → 集成测试设计 → 单元测试设计 → 测试执行

### 2.2 W模型核心特点

| 特点           | 描述                                                   |
| -------------- | ------------------------------------------------------ |
| 开发与测试并行 | 测试活动在开发早期即启动，与开发同步推进               |
| 全生命周期测试 | 覆盖需求测试、设计测试、单元测试、集成测试、系统测试等 |
| 测试对象扩展   | 测试对象不仅是程序，还包括需求和设计文档               |
| 缺陷早发现     | 尽早发现需求或设计缺陷，降低修复成本                   |

### 2.3 W模型与其他模型对比

| 模型     | 核心特点                           | 适用场景                       |
| -------- | ---------------------------------- | ------------------------------ |
| 瀑布模型 | 线性阶段式开发，测试后置           | 需求明确、稳定的项目           |
| V模型    | 开发与测试对应，但测试在编码后执行 | 需求明确、变更较少的项目       |
| W模型    | 开发与测试并行，测试前置           | 需求相对稳定、需保证质量的项目 |
| 敏捷模型 | 快速迭代、持续交付                 | 需求频繁变更的项目             |

### 2.4 W模型优势与局限性

**优势**：

- 测试提前介入，缺陷早发现，降低修复成本
- 测试覆盖更全面，减少后期风险
- 结构清晰，易于管理和跟踪
- 全面提升团队质量意识

**局限性**：

- 灵活性差，难以应对需求频繁变更
- 文档依赖重，文档质量直接决定项目成败
- 初期投入大，需要前期设计和测试规划

---

## 3. 技能架构设计

### 3.1 整体架构

```mermaid
graph LR
    subgraph SkillPackage[W-Model Skill 技能包]
        Skill[SKILL.md、references、templates、schemas]
        Gates[确定性 gate scripts]
        Workflow[阶段编排规则与产物契约]
        Skill --> Workflow
        Skill --> Gates
    end

    subgraph Host[宿主 Agent / 外部 LLM]
        Reasoning[推理、子代理调度、LLM-as-Verifier]
    end

    subgraph Tools[可选外部工具]
        TLC[TLA+ TLC]
        CG[CodeGraph]
        OPSX[OpenSpec]
    end

    Host -. 使用技能包规则并执行 .-> SkillPackage
    Host -. 可选调用 .-> Tools
```

图中的边界是交付契约：技能包只交付 Markdown 资产、Schema 与确定性 gate scripts；宿主 Agent / 外部 LLM 负责推理、子代理调度和 LLM-as-Verifier；TLA+ TLC、CodeGraph、OpenSpec 由宿主 Agent 按需接入。外部 Agent 可以使用技能包和这些工具，但它们不属于技能包交付物，仓库也不包含内置模型调用、SDK、业务 `src/` 或编程式 AI 引擎。

### 3.2 核心模块设计

> **去重约定**：本节只描述各核心模块的**设计层面边界**（功能、输入输出、宿主 Agent 能力应用）。模块中的分析、生成、执行和评审动作由宿主 Agent / 外部工具完成，技能包只提供提示词、参考、模板、Schema 与确定性门禁。
> 各模块的详细阶段产物、测试用例设计表、验收标准清单、RTM 登记规则、阶段门评审等内容
> 由 [`w-model-dev/references/phase-N-*.md`](../w-model-dev/references/) 各阶段文档维护，
> 本节不再重复，仅以指针引用。测试用例 ID 命名规则（`UT/IT/ST/UAT-NNN` 运行时用例 vs
> `TC-<PHASE>-NNN` 阶段产物验证用例）见 [`rtm-guide.md`](../w-model-dev/references/rtm-guide.md)。

#### 3.2.1 需求分析模块

**功能描述**：将自然语言需求转化为结构化的需求规格说明书，并同步设计验收测试用例

**输入**：

- 用户自然语言需求描述
- 业务背景信息

**输出**：

- 《需求规格说明书》
- 验收测试用例设计文档
- 需求风险评估报告

**宿主 Agent 能力应用**：

- 自然语言理解与结构化提取
- 需求完整性检查
- 需求冲突检测
- 验收测试用例自动生成

> 详细阶段产物、测试用例设计表（TC-REQ-001~005）、验收标准：
> 见 [`phase-1-requirements.md`](../w-model-dev/references/phase-1-requirements.md)。

#### 3.2.2 设计阶段模块

**功能描述**：基于需求文档进行系统架构设计和详细设计，并同步设计系统测试和集成测试用例

**子模块**：

- **系统设计子模块**：生成系统架构图、技术选型建议、模块划分方案
- **详细设计子模块**：生成类图、数据库设计、接口定义
- **测试设计子模块**：同步生成系统测试用例和集成测试用例

**宿主 Agent 能力应用**：

- 架构设计建议生成
- UML图自动生成
- 接口定义文档生成
- 测试用例设计

> 详细阶段产物、测试用例设计表（TC-DES-001~006）、验收标准：
> 见 [`phase-2-system-design.md`](../w-model-dev/references/phase-2-system-design.md) /
> [`phase-3-outline-design.md`](../w-model-dev/references/phase-3-outline-design.md) /
> [`phase-4-detailed-design.md`](../w-model-dev/references/phase-4-detailed-design.md)。

#### 3.2.3 编码与单元测试模块

**功能描述**：根据详细设计文档生成代码，并同步生成和执行单元测试

**输入**：

- 详细设计文档
- 技术栈要求

**输出**：

- 完整代码实现
- 单元测试用例
- 测试覆盖率报告

**宿主 Agent 能力应用**：

- 代码自动生成
- 代码质量检查
- 单元测试用例生成
- 测试执行与报告生成

> 详细阶段产物、测试用例设计表（TC-COD-001~005）、验收标准（含单元测试代码覆盖率 ≥ 80%）：
> 见 [`phase-5-coding.md`](../w-model-dev/references/phase-5-coding.md)。

#### 3.2.4 集成测试模块

**功能描述**：验证模块间的交互正确性

**输入**：

- 集成测试设计文档
- 已完成的模块代码

**输出**：

- 集成测试执行结果
- 接口兼容性报告

**宿主 Agent 能力应用**：

- 集成测试用例执行
- 接口调用验证
- 测试结果分析

> 详细阶段产物、运行时测试用例（IT-001~005）、验收标准：
> 见 [`phase-6-integration-test.md`](../w-model-dev/references/phase-6-integration-test.md)。

#### 3.2.5 系统测试模块

**功能描述**：在模拟真实环境下验证系统整体功能

**输入**：

- 系统测试设计文档
- 完整系统代码

**输出**：

- 系统测试报告
- 性能测试结果
- 安全测试结果

**宿主 Agent 能力应用**：

- 自动化测试执行
- 性能测试脚本生成
- 安全漏洞检测

> 详细阶段产物、运行时测试用例（ST-001~005）、验收标准：
> 见 [`phase-7-system-test.md`](../w-model-dev/references/phase-7-system-test.md)。

#### 3.2.6 验收测试模块

**功能描述**：确认软件是否满足最初的需求规格

**输入**：

- 验收测试设计文档
- 完整系统

**输出**：

- 验收测试报告
- 用户确认结果

**宿主 Agent 能力应用**：

- 验收测试用例执行
- 用户需求匹配验证

> 详细阶段产物、运行时测试用例（UAT-001~004）、验收标准、项目级验收检查清单：
> 见 [`phase-8-acceptance-test.md`](../w-model-dev/references/phase-8-acceptance-test.md)。

### 3.3 技能架构原则与外部工具边界（重要）

本技能遵循「技能包只包含提示词、参考、模板，里面的脚本只做门禁，不涉及 LLM」的架构原则。该原则决定技能包内部与外部的明确边界：

| 能力                                                                | 归属                                               | 实现位置                                                                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| W 模型阶段编排、RTM 维护、状态管理                                  | 技能内                                             | `w-model-dev/SKILL.md`（编排逻辑，Agent 执行）+ `w-model-dev/references/*`（阶段细则）                          |
| 阶段产物门禁（工件质量门）                                          | 技能内（脚本只做门禁）                             | `w-model-dev/scripts/logic/gate-logic.ts` + `check-artifact-gate.ts`                                            |
| LLM-as-a-Verifier 评审（三维度验证 / 连续评分 / PPT / 子标准）      | **技能内提供提示词与输出 Schema，外部 Agent 执行** | `w-model-dev/references/verifier-spec.md`（提示词）+ `w-model-dev/scripts/cli/check-verifier-output.ts`（校验） |
| LLM 推理本身                                                        | **外部**                                           | 由外部 Agent（Trae / Claude / Cursor 等）自行调用其 LLM 完成                                                    |
| 技能自演化（Rollout / Reflect / Edit / Skill Lift 评估 / 轨迹分析） | **外部**                                           | [SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)  |

要点：

- **技能本身不内置 LLM 调用**。阶段产物的 LLM-as-a-Verifier 评审通过提示词方式让外部 Agent 执行，技能只提供提示词 + 输出 Schema + 校验脚本（防外部 Agent 输出漂移）。`/wm review` 命令仅返回结构化评审指引，不直接调用 LLM。
- **LLM-as-a-Verifier 属于技能内部各阶段产物校验流程的一部分**，是 W 模型阶段门评审的实现方式，并非独立的「LLM 引擎」模块。
- **技能本身不包含演化机制与轨迹分析**。技能演化（Rollout / Reflect / Edit / Skill Lift 评估）由外部工具（SkillOpt / darwin-skill）完成，它们可消费本技能产出的 `VerifierOutput` JSON 作为训练信号。

### 3.3.1 外部工具集成

| 工具      | 定位                                                 | 集成方式                                         | 应用阶段 | 触发条件                                |
| --------- | ---------------------------------------------------- | ------------------------------------------------ | -------- | --------------------------------------- |
| codegraph | 修改前影响分析（callers/callees/blast radius）       | 宿主 Agent MCP（`codegraph_explore`）+ auto-sync | 5-8      | S-coding 任何 Edit/Write 前（约束 #14） |
| OpenSpec  | 规格级任务规划（opsx:explore/propose/apply/archive） | 宿主 Agent CLI/技能（`/opsx:*`）                 | 5-8      | S-explore/S-propose/S-coding 分派时     |

技能包不内置调用上述工具，通过 CHECKPOINT 指令 + 子代理分派模板触发。依赖检测与自动安装由 `ensure-codegraph-opsx.ts` 承载。

**ChangeScope 绑定（2026-09-04 audit-gate-closure）**：阶段 5-8 的 codegraph / opsx / archive 门禁与实际变更绑定——S-coding 阶段产出 ChangeScope manifest（`schemas/change-scope.schema.json`，如落盘 `.w-model/change-scope.json`）声明 `changeId`（须含 `phaseN-` 前缀）/ `phase` / `baseRef` / `headRef` / `scopeCreatedAt` / `changedFiles`，CLI 以 `--scope=<file>` 传入（或 `--change=<id> --base=<ref> --head=<ref>` 薄封装）。scope 必须与实际 Git 变更集合精确一致：`headRef` 解析 sha 须等于当前 HEAD、`changedFiles` 须与实际变更集合（`baseRef..headRef` tracked + worktree staged/unstaged/untracked）集合相等；Git 不可用 / refs 不可解析 / 集合不一致一律 **fail-closed**（exit 1），不是警告跳过。codegraph 查询落盘记录（`codegraph-query.schema.json`）在 strict 模式下须含 `changeId`（精确等于 scope.changeId）与 `targetFiles`（全部属于 scope.changedFiles），且 scope 中每个须覆盖的 code/test 变更文件（`docs/`、`schemas/`、`config/`、`eval/`、`.w-model/`、`openspec/` 等顶层段、dotfile 与 `*.md` 之外，按工程源码/测试扩展名判定）至少被一个合法查询的 `targetFiles` 覆盖；`queryTimestamp` 不得晚于 `scopeCreatedAt`。无 scope → 阶段 5-8 门禁 exit 1。分类纯函数与 Git 绑定校验见 `lib/change-scope.ts`（`isCodeOrTestFile` / `verifyScopeGitBinding`）。

---

### 3.4 编排者-子代理边界（Orchestrator-Subagent Boundary）

> 本节为「编排者最小化」原则的权威定义。与 §3.3「外部工具边界」互补：§3.3 划定**技能包与外部 LLM/演化工具**的边界，本节划定**编排者与实施动作**的边界。
> 实现位置：[`w-model-dev/references/subagent-delegation.md`](../w-model-dev/references/subagent-delegation.md) 为可执行细则；[`w-model-dev/SKILL.md`](../w-model-dev/SKILL.md)「编排者-子代理边界」节为编排摘要。
> 强制等级：违反本节命中反模式 #10「编排者越权实施」（见 [`w-model-dev/references/hard-constraints.md`](../w-model-dev/references/hard-constraints.md)），**命中即回退到当前阶段起点**。

#### 3.4.1 设计目标

编排者工作最小化：编排者只负责**编排**（路由 / 状态读写 / CHECKPOINT 等待 / 分派子代理 / 持久化 / 只读脚本），任何**实施动作**（修改、编码、调测、分析、修正、验证产出）必须由子代理执行。这样做的理由：

1. **上下文隔离**：编排者上下文不被产物内容污染，保留用于全局协调。
2. **评审独立性**：评审子代理不接触产出子代理的内部推理，避免自产自评漂移。
3. **可追溯**：每个产物/评审/门禁结果可归属到具体子代理调用，便于回退与审计。
4. **与现有架构一致**：`verifier-spec.md` §1 设计原则（技能内不做 LLM 调用，评审由外部 Agent 执行）与 `agent-personas.md` Persona 体系天然映射为 V 子代理；门禁脚本由 G 子代理跑，保留「技能不内置 LLM」原则。

#### 3.4.2 角色划分（五层子代理 + 编排者：O / A / S / V / G / R；F 由 S 兼任）

| 角色               | 简称 | 职责                                                                                                                                                                                                            | 允许动作                                                                                                                                                                                                                                                                   | 禁止动作                                                                                                                                              |
| ------------------ | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **编排者**         | O    | 路由、状态读写、CHECKPOINT 等待、分派子代理、持久化                                                                                                                                                             | 读 `.w-model/*.json`、跑 `check-verifier-output.ts` / `check-artifact-gate.ts` 看退出码（只读）、`git status`、`ls`、向用户展示证据、离线进化场景下执行 reflect→bounded edit→validation gate（状态读写+分析，非实施；区别于运行时阶段产物生成，反模式 #10 约束运行时编排） | 写代码、改文档、产出 `VerifierOutput` JSON、生成测试用例、改 RTM 实体（产出 / 评审 / 门禁结果内容）                                                   |
| **产出子代理**     | S    | 生成阶段开发产物 + 同步测试设计 + 更新 RTM 实体 +（阶段 1–4）产出 TLA+ 层次化状态机规格（`.tla` + `.cfg` + `tla-manifest.json` 实体）                                                                           | 写文件、跑测试运行器（仅产出阶段）、改 `.w-model/rtm.json` 实体、写 `tla/*.tla` / `tla/*.cfg` / `.w-model/tla-manifest.json`                                                                                                                                               | 跑 `check-verifier-output.ts` / `check-artifact-gate.ts` / `check-tla-model.ts`、越阶段产出、产出占位/简化/错误 TLA+ 实现（反模式 #16）               |
| **评审子代理**     | V    | 按 [`agent-personas.md`](../w-model-dev/references/agent-personas.md) + [`verifier-spec.md`](../w-model-dev/references/verifier-spec.md) §8 产出 `VerifierOutput` JSON；含 TLA+ 规格与需求/设计的语义一致性评审 | 读产物文件（含 `.tla`）、产出 JSON 评审                                                                                                                                                                                                                                    | 跑门禁脚本、改产物文件、改 RTM                                                                                                                        |
| **门禁子代理**     | G    | 跑 `check-verifier-output.ts` / `check-artifact-gate.ts` / `check-tla-model.ts`（阶段 1–4） + 回填证据摘要                                                                                                      | 跑门禁脚本、读 GATE_JSON / Verifier JSON / TLA_JSON、产出证据摘要字符串                                                                                                                                                                                                    | 改产物文件、产出 `VerifierOutput` JSON、改 RTM 实体、改 `.tla` / `tla-manifest.json` 实体                                                             |
| **分析子代理**     | A    | 分块分析、交叉合并、图谱演进（阶段 1–4 活跃）                                                                                                                                                                   | 读原始文档分块 / S 产出的正式文档、写 `.w-model/ingestion/<chunk-id>.{md,json}`、合并建图产出 `consolidated.json` + `cross-analysis-report.md` + `reworkHints`、通过晋升 `consolidated.json` 更新 `graph.json`                                                             | 跑 `check-requirement-graph.ts`（G 负责）、写正式阶段产物、改 `project.status`、越阶段产出、删除前阶段已通过的图谱节点                                |
| **根因定位子代理** | R    | 接收 V/G 的 `reworkHints` + 失败产物 + 上游产物，运用根因分析方法论定位缺陷根因，产出 `RootCauseReport`（含根因链、上游缺陷标记、修复建议、防御措施）                                                           | 读失败产物文件 + 上游产物、读 V 的 `VerifierOutput` JSON + G 的 GATE_JSON、运用根因分析方法（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）、产出 `RootCauseReport` JSON + `.md` 报告文件、标记 `upstreamDefect`、作为 R-lead 分派 R-persona 子代理（并行或串行均可）并聚合产出  | 改任何产物文件（由 S 修复）、跑门禁脚本（由 G 负责）、改 RTM 实体、改 `project.status`、跨阶段定位（仅当前阶段产物 + 上游回溯标记）、评审其他角色产出 |

> **修复者 F 由 S 兼任**：F 不是新角色，是 S 在返工场景下「携带 R 报告作为额外输入执行修复」的模式。S 首次产出时不带 R 报告；返工时必带已通过 V 复审 + G 门禁的 R 报告（见反模式 #18/#19）。
>
> **只读脚本例外**：编排者可执行 `npx tsx w-model-dev/scripts/cli/check-*.ts`、`git status`、`ls` 等确定性只读命令以核验状态/展示证据，但不得**写入或修改**任何产物/评审/RTM 内容。门禁脚本本身为确定性 TypeScript，不含 LLM 调用，编排者跑它仅用于"看退出码"，不构成实施。

#### 3.4.3 每阶段分派时序（统一）

```
O: 路由 + 读状态 + 检查前置产物 + 加载最小引用集（SKILL.md + 当前阶段 phase-N）
O: 🔴 CHECKPOINT · 项目初始化（首次）或阶段进入确认
  ↓ 分派 S
S: 产出开发文档 + 同步测试设计 + 更新 RTM 实体 → 返回 {产物路径, RTM diff}
  ↓ 分派 V
V: 按 targetKind 路由 Persona → 产出 VerifierOutput JSON
  ↓ 分派 G
G: npx tsx w-model-dev/scripts/cli/check-verifier-output.ts "<json>" → 返回 {exitCode, qualityLevel, passed, reworkHints}
O: 若 exitCode ≠ 0 或 qualityLevel ∈ {C,D} → 分派 S 返工（带 reworkHints），重走 V → G
O: 若通过 → 🔴 CHECKPOINT · 阶段门放行（编排者展示 G 子代理返回的证据给用户）
O: 用户放行 → 编排者更新 project.status → 进入下一阶段
```

阶段 8 终检额外分派 G 跑 `check-artifact-gate.ts`，退出码 0 + 用户确认 → 发布。

阶段 1–4 额外分派 G 跑 `check-tla-model.ts`（TLA+ 行为门禁，见 §10.8）：S 产出 `.tla` + `.cfg` + `tla-manifest.json` 实体后，G 跑脚本校验 SANY 语法 + TLC 模型检查 + 文件头/层次/拆解一致性，退出码 0 才放行；阶段 4 TLA+ 零违反 ∧ 图谱零违反（`check-requirement-graph.ts`）才放行进阶段 5 编码。**TLA+/BDD 行为门禁按成熟度分级执行（约束 #13 可执行化）**：L1 教学/demo 项目 → 门禁可选；L2 生产小项目 → TLA+ L1 + BDD L1 必跑；L3 → 全必跑。分级开关在编排层（SKILL.md「交付层」），非脚本参数（`--skip-tlc` 禁令维持）；本段「退出码 0 才放行」为 L2/L3 下的完整要求。

#### 3.4.4 与现有约束的兼容性

- **约束 4「真实执行」**：G 子代理跑脚本 + 回填退出码 = 真实执行，不冲突。
- **约束 6「按需加载」**：子代理按需加载对应 `phase-N-*.md`，编排者只加载 `SKILL.md` + 状态文件，加载面更窄。
- **约束 2「阶段门放行」**：G 子代理返回证据 → 编排者展示给用户 → CHECKPOINT 等待，不冲突。
- **`verifier-spec.md` §1 设计原则（外部 Agent 执行）**：V 子代理即「外部 Agent」，边界一致。
- **`agent-personas.md` 4 个 Persona**：V 子代理按 `targetKind` 选用，无改动。
- **技能不内置 LLM**：V 子代理由编排者通过宿主 Agent 的子代理机制（如 Task 工具）启动，技能包自身仍只含提示词 + 脚本，不引入 LLM 调用。

#### 3.4.5 强制约束

编排者不得直接执行以下任何动作（命中即触发反模式 #10，回到当前阶段起点重做）：

1. 用 `Write` / `Edit` 写或修改任何阶段产物文件（需求规格 / 设计文档 / 代码 / 测试用例 / 测试报告 / 评审报告）。
2. 直接产出 `VerifierOutput` JSON 内容（评审必须分派 V 子代理）。
3. 修改 `.w-model/rtm.json` 实体字段（需求 / 设计 / 测试用例 / 执行结果；编排者只可更新 `project.status` 与 `updatedAt`）。
4. 生成测试用例代码或业务代码。
5. 跳过 S → V → G 顺序（如编排者自评自审）。

编排者**允许**的动作：

- 读 `.w-model/project.json` / `.w-model/rtm.json` / `.w-model/budget.json` / `.w-model/run-log.jsonl` / `.w-model/maturity.json`；
- 跑 `check-verifier-output.ts` / `check-artifact-gate.ts` 看**退出码**（用于向用户展示或路由判定，不替代 G 子代理的回填职责）；
- `git status` / `ls` / `Read` 等只读核验；
- 在 CHECKPOINT 暂停等待用户决定；
- 用户放行后更新 `project.status` 与 `updatedAt`；
- **维护 budget.json / run-log.jsonl / maturity.json**（状态读写+持久化，非实施；见 §10C / §10D）：项目初始化创建三文件、每次子代理返回/门禁执行/CHECKPOINT 放行后 append run-log、预算检查、成熟度判定与升降级。

> **S-doc 内含票据拆解**：阶段 5 进入时，S 子代理在编码前兼任 S-tickets 角色，产出 `tickets.md`（tracer-bullet 垂直切片 + blocking edges DAG）。编排者只按 frontier 分派 S-coding，不参与拆解决策。详见 [phase-5-coding.md](../w-model-dev/references/phase-5-coding.md)「Tracer-bullet 票据拆解」节（吸收决策记录见 [decision-log/absorptions.md](./changes/decision-log/absorptions.md)）。

#### 3.4.6 门禁增强约束

##### P1.1 TLA+ manifest basePath 强制

- `tla-manifest.json` 须包含 `basePath` 字段（强制必填，非可选）
- `tools.jarPath` / `specs[].tlaPath` / `specs[].cfgPath` 全部相对 `basePath` 解析
- 缺失/非字符串/空字符串 → `check-tla-model.ts` 退出码 1

##### P1.2 TLA+ SD 覆盖率（按成熟度分级，约束 #13）

- L2/L3 项目：所有 spec 须含 `requirementIds` 且至少一个 SD-xxx 标识；每个 SD-xxx 须被至少一个 spec 的 requirementIds 包含
- L1 教学/demo 项目：TLA+ 门禁可选，本条不强制（分级见 §3.4.3 阶段门说明）
- 违反 → `check-tla-model.ts` 退出码 1

##### P1.3 Verifier passed↔qualityLevel 严格一致（无例外）

- `passed` 必须严格等于 `(qualityLevel === 'A' || qualityLevel === 'B')`
- 禁止通过 summary 或任何字段降级
- P0 未解决时 `qualityLevel` 须实际降为 C/D，不得保持 B 级同时 `passed=false`
- 不一致 → `check-verifier-output.ts` 退出码 1

##### P1.4 RTM codeModule 回填时机

- 阶段5编码完成后、code-TLA 一致性检查前，必须回填 RTM.codeModule 列
- 格式：`SD-xxx:src/path/to/file.ts`（多个模块用逗号分隔）
- 缺失 → `check-code-tla-consistency.ts` 维度1 退出码 1

##### P2.5 UAT 路径映射表

- 阶段1设计 UAT 时须产出 `docs/uat-path-mapping.md`
- 阶段5编码后回填实际路径列
- 阶段8验收测试编写时按映射表对应，禁止凭主观判断

##### P2.6 TLA+ 不变式业务语义对齐

- 每个 TLA+ 不变式须在 .tla 文件注释中标注 `@designRef <doc>#<section>`
- V 评审须校验业务语义对齐（非仅语法/模型检查通过）
- 评审者须为每个不变式提供设计文档引用 + 业务语义解释

##### P2.7 phase-8 三段暂停点语义

- A 段（用例执行）：自驱模式下连续执行不暂停
- B 段（每 30% 暂停）：自驱模式下合并为单次中点检查（50% 时）
- C 段（最终用户确认）：任何模式下强制暂停，须用户在 §9 确认

##### P2.8 TLA+ Next 分支命名约定

- TLA+ Action 名：PascalCase（如 `PublishAnnouncement`）
- 代码方法名：camelCase（如 `publishAnnouncement`）
- `check-code-tla-consistency.ts` 维度3 支持 PascalCase→camelCase 自动映射

#### 设计决策历史（历史信息由 CHANGELOG 体系承载）

> 本技能的设计演进记录（轮次决策、关键决策、验证数据）统一由 **CHANGELOG 体系**承载，
> 不再在本文档内维护：变更条目见 [CHANGELOG.md](../CHANGELOG.md)（41.0.0 之后）与
> [CHANGELOG-archive.md](../CHANGELOG-archive.md)（41.0.0 之前）；
> 轮次详细决策记录（原文）归档于 [docs/changes/decision-log/](./changes/decision-log/README.md)；
> 轮次 → 版本 → CHANGELOG 条目映射见 decision-log README。

### 3.5 L0/L1 链接边界（交付分层导航规则）

L0 文档（`SKILL.md` / `references/` / `templates/` / `examples/` / `subagent/` / `schemas/`）中指向 `scripts/`、`samples/`、`tools/` 的相对链接统一为 **L1-only 导航**：L0 副本预期不含这些目标，链接检查必须将其分类为分层边界，不得据此报告「L0 全链接通过」；取得 L1 交付（L0 + `scripts/` + `samples/` + `tools/`）后才校验这些目标。仓库侧审计入口为 `npm run audit:l0-links [-- --root=<skill-root>]`（`w-model-dev/scripts/application/audit-l0-links.ts`，只读，exit 0/1/2；实现与已知近似见 `w-model-dev/references/command-reference.md`「L0/L1 链接边界审计」节）。本节是该边界的权威定义；INSTALL §2 与 w-model-dev 侧描述均以本节为准。

**机械判定与判断题的分工**：能被正则 / 计数 / 存在性机械判定的部分**一律由 `audit:l0-links` 执行**——链接是否存在、是否逃出包根、是否命中 `scripts/`、`samples/`、`tools/` 这三类 L1-only 目标、占位符是否合法；文档**不得**把这部分复述成需要人工核对的规则。本节只保留**判断题**：分层的**归属判据**（哪些目标属于 L0、哪些属于 L1-only），以及「链接检查结论不得表述为『L0 全链接通过』」这类**语义约束**。新增 L0/L1 边界规则时，先问它能否被脚本判定——能则加进审计实现（`npm run audit:l0-links [-- --root=<skill-root>]` / `w-model-dev/scripts/application/audit-l0-links.ts`），不能才写进本节。

### 3.6 触发边界与反例登记册（Trigger Boundary & Anti-Scenario Registry）

技能触发边界由三层资产共同度量，本节为权威定义（规格：docs/superpowers/specs/2026-09-07-trigger-boundary-campaign-design.md）。

**route 三值语义**：每条评估语料归属 `enable`（立即启用）/ `ask`（先询问，确认前不初始化）/ `skip`（不启用，按普通任务处理）之一；L2 机制存在性条目不带 route。

**类别全集（13 类）**：负向 N1-N10（一次性数据/文件脚本、样式与小 bug 修复、纯问答与技术解释、环境与配置变更、纯文档撰写与排版、数据查询与正则提取、依赖升级与小重构、非软件开发任务、单点执行指令、已由其他工具接管的请求）与歧义 A1-A3（完整流程未提 W 模型、大型新项目仅说"开始做"、模糊合规表述）。类别增删须先改本节，再同步 activation-guide / prompts / mappings。

**三层资产契约**：

- 数据源 = `eval/w-model-dev-test-prompts.json`（60 条，含 category/route 字段）；
- 视图 = `w-model-dev/references/activation-guide.md`（13 个 `## <code> <canonical 名>` 节，示例行 `- id=N: <prompt 原文>`，每节另含判定理由与边界说明——何时升级为 ask/enable）；
- 一致性 = `eval/mappings.json` 顶层 matrix 声明 + `eval/runner.ts` coverageMatrix 五项校验（route 对齐 / 总数符合声明 / 每类别 ≥ minPerCategory / guide 节示例数 == 语料条数 / 每负向类别 ≥1 组 notContains 守卫）。`npm run eval` 已纳入 pre-push 第 18 项门禁（触发边界快追，2026-09-07）。

**触发面分层**：SKILL.md frontmatter description 保留一句英文反例信号（作用于技能加载器的匹配面）；触发决策表"不启用"行含十类速览并链接 activation-guide.md；完整判定细则只在 activation-guide.md 按需加载——常驻面增量 ≤15 行。

**L0 复用分级**：references 分「可单独拷贝」（方法论自包含：root-cause-locator / iceberg-sweep-guide / agent-personas+subagent / conventions / estimation-guide / context-management-guide / coding-quality / activation-guide / toolbox）与「不可单独拷贝」（依赖编排/状态/门禁：phase-N-* / subagent-delegation / signature-chain-guide / rtm-guide / graph-guide / hard-constraints）；权威清单与版本对齐义务见 docs/INSTALL.md「子能力单独复用」节。

## 4. 技能工作流程

### 4.1 完整工作流程

```mermaid
flowchart TB
    subgraph 需求分析阶段
        R1[用户输入自然语言需求] --> R2[AI解析需求]
        R2 --> R3[生成需求规格说明书]
        R3 --> R4[AI同步设计验收测试用例]
        R4 --> R5[需求评审]
        R5 -->|通过| S1
        R5 -->|不通过| R1
    end

    subgraph 系统设计阶段
        S1[AI生成系统架构设计] --> S2[AI同步设计系统测试用例]
        S2 --> S3[设计评审]
        S3 -->|通过| P1
        S3 -->|不通过| S1
    end

    subgraph 概要设计阶段
        P1[AI生成模块接口设计] --> P2[AI同步设计集成测试用例]
        P2 --> P3[设计评审]
        P3 -->|通过| D1
        P3 -->|不通过| P1
    end

    subgraph 详细设计阶段
        D1[AI生成类/方法级设计] --> D2[AI同步设计单元测试用例]
        D2 --> D3[设计评审]
        D3 -->|通过| C1
        D3 -->|不通过| D1
    end

    subgraph 编码实现阶段
        C1[AI生成代码] --> C2[AI执行单元测试]
        C2 --> C3[代码审查]
        C3 -->|通过| I1
        C3 -->|不通过| C1
    end

    subgraph 集成测试阶段
        I1[AI执行集成测试] --> I2[接口验证]
        I2 -->|通过| ST1
        I2 -->|不通过| C1
    end

    subgraph 系统测试阶段
        ST1[AI执行系统测试] --> ST2[AI执行性能/安全测试]
        ST2 --> ST3[缺陷修复]
        ST3 -->|完成| U1
        ST3 -->|需修复| C1
    end

    subgraph 验收测试阶段
        U1[AI执行验收测试] --> U2[用户确认]
        U2 -->|通过| FIN[项目完成]
        U2 -->|不通过| R1
    end

    style R1 fill:#e3f2fd,stroke:#1976d2
    style FIN fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
```

### 4.2 W模型并行流程

```mermaid
graph TD
    A[需求分析] --> B[系统设计]
    B --> C[概要设计]
    C --> D[详细设计]
    D --> E[编码]
    E --> F[单元测试]
    F --> G[集成测试]
    G --> H[系统测试]
    H --> I[验收测试]

    A -.-> AT[验收测试设计]
    B -.-> ST[系统测试设计]
    C -.-> IT[集成测试设计]
    D -.-> UT[单元测试设计]

    AT --> I
    ST --> H
    IT --> G
    UT --> F

    style A fill:#bbdefb,stroke:#1976d2
    style B fill:#bbdefb,stroke:#1976d2
    style C fill:#bbdefb,stroke:#1976d2
    style D fill:#bbdefb,stroke:#1976d2
    style E fill:#bbdefb,stroke:#1976d2
    style F fill:#c8e6c9,stroke:#388e3c
    style G fill:#c8e6c9,stroke:#388e3c
    style H fill:#c8e6c9,stroke:#388e3c
    style I fill:#c8e6c9,stroke:#388e3c
    style AT fill:#fff3e0,stroke:#ff9800
    style ST fill:#fff3e0,stroke:#ff9800
    style IT fill:#fff3e0,stroke:#ff9800
    style UT fill:#fff3e0,stroke:#ff9800
```

### 4.3 核心交互模式

#### 4.3.1 需求分析交互

```
用户: 我需要一个在线商城系统，支持用户注册、商品浏览、购物车和订单功能
AI: 正在分析需求...
AI: 已生成《需求规格说明书》，包含以下模块：
    1. 用户管理模块
    2. 商品管理模块
    3. 购物车模块
    4. 订单管理模块
AI: 已同步生成验收测试用例，涵盖50+测试场景
```

#### 4.3.2 设计阶段交互

```
用户: 请进行系统架构设计
AI: 正在进行架构设计...
AI: 技术选型建议：
    - 前端: React + TypeScript
    - 后端: Node.js + Express
    - 数据库: MongoDB + Redis
AI: 已生成系统架构图和模块接口定义
AI: 已同步生成系统测试用例，覆盖各模块集成场景
```

#### 4.3.3 编码阶段交互

```
用户: 请实现用户注册功能
AI: 正在生成代码...
AI: 已生成以下文件：
    - src/controllers/userController.ts
    - src/services/userService.ts
    - src/models/User.ts
    - src/routes/userRoutes.ts
AI: 已生成单元测试用例，单元测试代码覆盖率 95%
AI: 执行测试中...测试通过
```

### 4.4 ingestion 子流程与图谱收敛（阶段 1–4）

> 阶段 1–4（需求分析 → 系统设计 → 概要设计 → 详细设计）在原 S→V→G 阶段门基础上**叠加** ingestion 子流程：由 A 角色（分析子代理，§3.4.2）分块并行分析 + 多轮交叉合并，维护演进图谱 `graph.json`，由 G 跑 `check-requirement-graph.ts` 做结构连通性门禁。ingestion 是叠加而非替代——原 phase-N 的 V 评审 + `check-verifier-output.ts` + 阶段门 CHECKPOINT 全部保留。

**统一路径**（差异仅在「A→S 还是 S→A」与「提取的节点类型」）：

- **阶段 1（A→S）**：`plan-chunks` → 并行 A-chunk 提取 REQ 节点 → A-cross 合并 → G 跑 `check-requirement-graph.ts --phase=1`（连通 + 单根）→ 收敛循环 → S 读 `graph.json` 产出需求规格 + 验收测试。
- **阶段 2/3/4（S→A）**：S 先产出正式设计文档 → A-chunk 分块提取 SD/INTF/DD 节点 → A-evolve 图谱演进 → G 跑 `check-requirement-graph.ts --phase=N`（递增追溯项：implements/defines/realizes）→ 收敛循环 → V 评审 → G 跑 `check-verifier-output.ts`。
- **阶段 4 硬约束**：`--phase=4` 零违反（DD realizes 全覆盖）才放行进阶段 5 编码。

ingestion 引入两个新 CHECKPOINT（规划确认 / 收敛确认），均不可绕过（约束 2）。收敛判定由 G 跑脚本退出码决定，不由 A 的 LLM 输出决定（约束 4，反模式 #12）。完整设计见 [`docs/ingestion-graph-convergence-design.md`](./ingestion-graph-convergence-design.md)；可执行细则见 [`w-model-dev/references/ingestion-chunk.md`](../w-model-dev/references/ingestion-chunk.md) / [`ingestion-cross.md`](../w-model-dev/references/ingestion-cross.md) / [`graph-guide.md`](../w-model-dev/references/graph-guide.md)。

---

## 4A. 核心操作行为与失败模式

> 吸收自 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `using-agent-skills` 元技能的 Core Operating Behaviors 与 Failure Modes。
> 适配 W 模型语境：保留「不可违反的约束」（§4 与 [`SKILL.md`](../w-model-dev/SKILL.md)「不可违反的约束」节）作为硬性规则，本节为跨阶段的「日常操作准则」。
> 详细反模式与门禁脚本对应关系见 [`w-model-dev/references/hard-constraints.md`](../w-model-dev/references/hard-constraints.md)。

### 4A.1 八条核心操作行为

> **权威源**：完整版（八条行为 + F1-F10 失败模式）见 [`w-model-dev/references/operation-behaviors.md`](../w-model-dev/references/operation-behaviors.md)）；本表为 SSoT 摘要副本，改行为须先改权威源并同步本表。

以下行为在 W 模型 8 阶段全程适用，与「不可违反的约束」互补：约束是「不可越界」的红线，操作行为是「主动遵守」的准则。

| #   | 行为                                          | 在 W 模型中的具体表现                                                                                                                                                                                    |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Surface Assumptions（显式声明假设）**       | `/wm analyze` 进入阶段 1 前、`/wm design` 选型前、`/wm code` 生成前，显式列出对需求 / 架构 / 范围的假设；不得静默填补歧义需求                                                                            |
| 2   | **Manage Confusion Actively（主动管理困惑）** | 遇到 RTM 不一致、上游产物缺失、跨阶段术语冲突时：STOP → 命名具体困惑 → 向用户提出澄清问题 → 等待解决；禁止「猜一个推进」                                                                                 |
| 3   | **Push Back When Warranted（必要时反驳）**    | 当用户的选择与硬约束冲突（如要求跳过 CHECKPOINT / 估算覆盖率放行）时：直接指出问题 → 量化代价 → 提出替代方案 → 接受用户在完整信息下的覆盖决策                                                            |
| 4   | **Enforce Simplicity（强制简洁）**            | 编码前自问「能否更少行？抽象是否物有所值？资深工程师是否会问『为何不直接……』」；1000 行能 100 行完成即失败                                                                                               |
| 5   | **Maintain Scope Discipline（保持范围纪律）** | 只动该动的；不删除看不懂的注释、不顺手清理无关代码、不重构相邻系统、不删除「看似无用」的代码除非显式批准、不加规格外「看似有用」的功能                                                                   |
| 6   | **Verify, Don't Assume（验证而非假设）**      | 每个阶段都必须有验证证据（测试通过 / 脚本退出码 / 运行时数据）；「看起来对了」永远不够；§10.5 工件质量门是验证的最后一道闸                                                                               |
| 7   | **Choose Highest Seam（选择最高 seam）**      | 阶段 2-4 测试设计前置时，优先选现有最高 seam（系统层 HTTP/CLI/进程边界，模块层公共导出，单元层公共 API）；理想零新 seam；禁止为"覆盖率"新建 seam；私有状态机转移由 TLA+ 不变式断言覆盖（与约束 13 协同） |
| 8   | **Structure Over Persuasion（结构优于说服）** | 能焊进结构的约束（权限 / 只读 / 网络隔离 / schema 拦截）就不写进提示词；提示词约束是说服性的、每一步都要选择遵守，结构约束是确定性的                                                                     |

### 4A.1b 产出期证据锚点声明（evidenceAnchor）

- **行为**：A 子代理 ingestion 提取 REQ 节点时，可对结论来源声明 `evidenceAnchor`（用户原话 / 文档段落 / 外部依赖版本，格式见 conventions.md 列定位约定）；S 子代理产出规格 §4.2 只读同步；S 不改图谱节点（反模式 #11）。
- **强度**：可选——未声明不视为缺陷；声明了则格式必须合法（G 门禁 R15）。
- **与评审证据的关系**：evidenceAnchor 是产出者声明（前提），VerifierOutput.evidence 是评审者核验（证明），二者互补。
- **吸收来源**：外部方法论「证据支撑树联合分析模式」（Evidence-Anchored Decision Tree），参照文档 `w-model-dev/references/evidence-anchored-tree.md`。

### 4A.2 失败模式清单

以下 10 条失败模式是「看似高效实则埋坑」的典型，与 [`hard-constraints.md`](../w-model-dev/references/hard-constraints.md) 的 48 条流程反模式（#1~#48）互补：反模式是「流程破坏」，失败模式是「行为退化」。

| #   | 失败模式                                   | 与 W 模型反例的关系                                                |
| --- | ------------------------------------------ | ------------------------------------------------------------------ |
| F1  | 静默假设未检查就推进                       | 与 #9（谎报状态）互补：#9 是结果撒谎，F1 是过程撒谎                |
| F2  | 困惑时不暂停、硬猜推进                     | 与 #8（越过 CHECKPOINT）互补：#8 是显式节点越过，F2 是隐式困惑越过 |
| F3  | 注意到不一致但不指出                       | 与 #4（评审未通过悄悄小修）互补：#4 是评审后，F3 是评审中          |
| F4  | 非显然决策不呈现 tradeoff                  | —                                                                  |
| F5  | 对明显有问题的方案 sycophantic「当然可以」 | 与 §4A.1 第 3 条直接对应                                           |
| F6  | 过度复杂化代码与 API                       | 与 §4A.1 第 4 条直接对应                                           |
| F7  | 修改任务外的代码或注释                     | 与 §4A.1 第 5 条直接对应                                           |
| F8  | 删除未完全理解的代码                       | 与 §4A.1 第 5 条直接对应                                           |
| F9  | 因「显而易见」而无规格就编码               | 与 W 模型「测试设计前置」冲突                                      |
| F10 | 因「看起来对」跳过验证                     | 与 #3（估算质量门）/ #6（估算 RTM 覆盖率）互补                     |

> F1~F10 命中时不触发门禁脚本回退（它们不是流程反模式），但应在阶段产物的「备注」节或评审报告的 `reworkHints` 中标注。Agent 重复命中同一失败模式 ≥2 次时，应在 CHANGELOG 体系（[`decision-log`](./changes/decision-log/README.md)）登记为新教训。

### 4A.2a 运维失败模式清单（O1~O6）

> 吸收自 [cobusgreyling/loop-engineering](https://github.com/cobusgreyling/loop-engineering) `docs/failure-modes.md`，适配 W 模型语境。
> 与 48 条流程反模式（#1~#48）+ 10 条行为退化（F1~~F10）互补：反模式是流程破坏，失败模式是行为退化，运维失败模式是运行健康问题。
> O 系列命中**不触发脚本回退**（与 F1~~F10 同级），但应在 run-log 的 note 字段标注，并在阶段产物「备注」节或评审报告 reworkHints 中记录。

| #   | 失败模式                                             | 症状                                                              | 与现有反模式/失败模式的关系                                         | 缓解措施                                                                                                                       |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| O1  | Token Burn（子代理链对空/噪声 triage 全跑）          | 单阶段 token 消耗异常高；ingestion 对低信息量输入仍全跑 A-chunk×N | 与 F10（跳过验证）互补：F10 是不验证，O1 是过度验证                 | 预算检查（§10D）+ 早退：triage 发现空输入时 A-chunk 数=1；budgetBurnRate 触发 kill switch                                      |
| O2  | State Rot（状态文件引用已合并/已废弃产物）           | rtm.json/graph.json 引用已删除文件或已废弃 ID                     | 与 #9（谎报状态）互补：#9 是状态造假，O2 是状态腐烂                 | 每阶段门 G 子代理校验产物路径存活（`ls`/`git status`）；ID 失活 → 标记并 prune                                                 |
| O3  | Verifier Theater（V 子代理"looks good"但 CI 挂）     | V 评审 passed=true qualityLevel=A 但下游测试失败                  | 与 #1（跳过评审）对立面：评审走了形式                               | 强化 verifier-spec §1 设计原则：V 默认拒绝姿态（"find reasons to reject"）；V 须引用具体 evidence 非空泛；G 校验 evidence 非空 |
| O4  | Comprehension Debt Spiral（用户橡皮图章 CHECKPOINT） | 用户对所有 CHECKPOINT 输入"确认"无修改意见；阶段产物无人理解      | 与 F5（sycophantic）互补：F5 是 Agent 奉承用户，O4 是用户奉承 Agent | 理解证据机制（§10.6 第六维度）：放行前须填 acknowledgedDecisions ≥1 关键决策；空确认视为 O4 命中                               |
| O5  | Cognitive Surrender（"循环处理了"无设计意见）        | 用户放弃对设计/架构的意见；全权委托 Agent                         | 与 §4A.1 第 3 条（Push Back）对立面                                 | 阶段 2/4 设计 CHECKPOINT 强制用户提出 ≥1 修改意见或替代方案；无意见视为 O5 命中                                                |
| O6  | Escalation Failure（attempt cap 触发但无人被通知）   | 返工达 maxReworkRounds 但用户未被告知；循环卡死                   | 与 #8（越过 CHECKPOINT）互补：#8 是显式越过，O6 是隐式卡死          | attempt cap 触发 → run-log append escalate 记录 + 强制 🔴 CHECKPOINT 展示返工历史                                              |

> O 系列命中不回退，但应在 run-log 的 note 字段标注（如 note="O1 Token Burn"），并在阶段产物「备注」节或评审报告 reworkHints 中记录。O4/O5 直接关联 CHECKPOINT 有效性，命中时拒绝放行。

### 4A.2b 返工循环反模式扩展（#18/#19）

> #18/#19 守护返工循环「必经 R 根因定位」与「R 报告必经 V 复审 + G 门禁」两条硬约束（48 条流程反模式 #1~#48 之一族，权威定义见 [`hard-constraints.md`](../w-model-dev/references/hard-constraints.md)）。命中即回退到当前阶段起点。
> 权威定义见 [`w-model-dev/references/hard-constraints.md`](../w-model-dev/references/hard-constraints.md) + [根因定位者设计 spec](./superpowers/specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md) §7.1。

| #   | 反模式                                                            | 危害                                                                 | 正确做法                                                                                                                                           |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 18  | 跳过 R 直接分派 S 返工（V/G 不通过后直接 S-fix，未经 R 根因定位） | 修复针对症状不针对根因，同问题反复出现；缺陷链未追溯，上游缺陷被掩盖 | `V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT` |
| 19  | R 报告未经 V 复审直接交 S 修复                                    | 根因准确性无独立保证，S 基于错误根因修复，浪费一轮返工               | R 产出后必须经 V 复审 + G 门禁（check-rootcause-report.ts exitCode=0）才可分派 S-fix；S-fix 后仍须 R3×3、预防审查门禁、V、G 与用户 CHECKPOINT      |

> #18/#19 命中即回退（与其余 46 条流程反模式同级）。R 方法论与多角度分析机制详见 §6.4.5 与 [`root-cause-locator.md`](../w-model-dev/references/root-cause-locator.md)；R 报告校验门禁详见 §10.9。

### 4A.3 与现有约束的关系

- **「不可违反的约束」（[`SKILL.md`](../w-model-dev/SKILL.md)）** 是硬红线，命中即触发阶段回退；由门禁脚本或 CHECKPOINT 强制。
- **「核心操作行为」（本节 §4A.1）** 是日常准则，违反不立即触发回退但会降低产物质量；由 Agent 自检或 LLM-as-a-Verifier 在评审中标注。
- **「流程反模式」（[`hard-constraints.md`](../w-model-dev/references/hard-constraints.md) 48 条（#1~#48），含返工循环 #18/#19）** 是流程破坏，命中即回退；与门禁脚本退出码精确对应。
- **「失败模式」（本节 §4A.2 F1~F10）** 是行为退化，命中不回退但应记录；与反模式互补。
- **「运维失败模式」（本节 §4A.2a O1~O6）** 是运行健康问题，命中不回退但应标注；由预算检查（O1/O6）/路径存活校验（O2）/V-G 矛盾检测（O3）/理解证据机制（O4/O5）协同检测。

三层互补架构：流程反模式（层 1，流程是否走对）→ 行为退化（层 2，Agent 行为是否健康）→ 运维失败模式（层 3，运行是否健康）。

实现位置：[`w-model-dev/references/operation-behaviors.md`](../w-model-dev/references/operation-behaviors.md)「失败模式清单」节（F1~~F10）+ 本节 §4A.2a「运维失败模式清单」节（O1~~O6）+ [`w-model-dev/SKILL.md`](../w-model-dev/SKILL.md)「核心操作行为」节。

---

## 5. AI能力集成策略

### 5.1 自然语言处理能力

- **需求解析**：将非结构化自然语言转化为结构化需求
- **意图识别**：理解用户开发意图和技术偏好
- **文档生成**：自动生成各类技术文档

### 5.2 代码生成能力

- **代码生成**：根据设计文档生成高质量代码
- **代码补全**：智能补全代码片段
- **代码重构**：优化现有代码结构

### 5.3 测试生成能力

- **测试用例生成**：根据需求和设计自动生成测试用例
- **测试执行**：自动执行测试并生成报告
- **测试覆盖率分析**：分析测试覆盖情况

### 5.4 智能审查能力

- **代码审查**：检查代码质量、安全漏洞
- **文档审查**：验证文档完整性和一致性
- **需求追踪**：确保代码实现与需求一致

---

## 6. 技能接口设计

### 6.0 触发边界

技能采用“歧义时询问”的触发策略：

- 用户显式使用 `/wm`、提及 W-model / W 模型 / W 开发模型，或明确要求 RTM、阶段门/质量门、开发与测试并行时，直接启用。
- 用户只要求“完整流程”“从需求到交付”或“全生命周期开发”，但未出现上述 W 模型信号时，先询问是否采用 W 模型；确认前不创建 `.w-model/` 或产出 W 模型工件。
- 普通需求、设计、编码、测试、缺陷修复和技术解释不启用本技能。

该边界在保持技能可发现性的同时防止普通软件任务被强制升级为 8 阶段流程。

### 6.1 核心命令

| 命令          | 功能描述                                    | 参数                                                                         | 产出                                                                               |
| ------------- | ------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `/wm analyze` | 需求分析                                    | `input`: 需求描述                                                            | 需求规格说明书、验收测试用例                                                       |
| `/wm design`  | 系统设计                                    | `type`: 设计类型(架构/概要/详细)                                             | 设计文档、测试用例                                                                 |
| `/wm code`    | 代码生成                                    | `feature`: 功能描述                                                          | 代码文件、单元测试                                                                 |
| `/wm test`    | 测试执行与回填                              | `type`: 测试类型(单元/集成/系统/验收)；`result`: pass/fail（必填，真实回填） | 测试报告                                                                           |
| `/wm review`  | LLM 评审指引                                | `target`: 需求/设计/测试用例 ID 或文件路径                                   | 结构化评审指引（指向 `verifier-spec.md` + `check-verifier-output.ts`，不内置 LLM） |
| `/wm status`  | 项目状态（脚本化 `wm-status.ts`，O 只读）   | 无                                                                           | 当前阶段、完成进度、RTM 覆盖率、确定性下一步建议（`--json` 输出 StatusReport）     |
| `/wm metrics` | 流程度量报告（`metrics-report.ts`，O 只读） | `--from`/`--to`/`--phase`/`--json`/`--out`                                   | 7 区流程度量（阶段汇总 / 门禁通过率 / 返工率 / 预算 burn rate 与 killSwitch 预警） |

### 6.2 辅助命令

| 命令         | 功能描述         |
| ------------ | ---------------- |
| `/wm help`   | 显示帮助信息     |
| `/wm reset`  | 重置当前项目状态 |
| `/wm export` | 导出项目文档     |
| `/wm import` | 导入现有项目     |

### 6.3 接口调用流程

> 本技能无编程式接入。`/wm` 命令由 Agent 读取 `SKILL.md` 后用自身工具执行，状态与 RTM 持久化到项目内 `.w-model/*.json`。

```mermaid
sequenceDiagram
    participant User as 用户
    participant Agent as AI Agent
    participant SKILL as SKILL.md + references/
    participant Store as .w-model/*.json

    User->>Agent: /wm analyze "用户登录功能"
    Agent->>SKILL: 加载编排逻辑 + phase-1-requirements.md
    Agent->>Agent: 自然语言解析（Agent 自身 LLM）
    Agent->>Agent: 生成需求规格说明书
    Agent->>Agent: 同步生成验收测试用例
    Agent->>Store: 写入 project.json / rtm.json
    Agent-->>User: 返回需求规格与测试用例
```

### 6.4 Agent Personas（评审角色提示词）

> 吸收自 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `agents/` 目录。
> 适配 W 模型语境：技能不内置 LLM 调用（§3.3 硬约束），故 Persona 是「供外部 Agent 在执行 `/wm review` 时采用的角色提示词」，由 Agent 自身 LLM 加载执行，技能本身不调用 LLM。
> 与 §7.6 LLM-as-a-Verifier 评审规范的关系：§7.6 定义评审的「输出 Schema 与校验脚本」，本节定义评审的「角色视角与关注点」——二者互补，Persona 不替代 Schema。
> 实现位置：[`w-model-dev/references/agent-personas.md`](../w-model-dev/references/agent-personas.md)（提示词，不调用 LLM）。

#### 6.4.1 三层架构（Skill / Persona / Command）

吸收 addyosmani `docs/agents.md` 的三层模型，适配 W 模型语境：

| 层                  | 是什么                             | W 模型中的例子                                                                 | 组合角色                                       |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------- |
| **Skill**（技能）   | 带步骤与退出标准的工作流           | `w-model-dev`（编排 + 8 阶段 + 阶段门 + 工件质量门）                           | 「如何做」——在 Persona 内部被引用              |
| **Persona**（角色） | 单一角色 + 单一视角 + 单一输出格式 | `code-reviewer` / `test-engineer` / `security-auditor` / `performance-auditor` | 「谁来做」——采用一种视角产出报告               |
| **Command**（命令） | 用户面向的入口                     | `/wm review <target>`                                                          | 「何时做」——按 `targetKind` 路由到对应 Persona |

要点（吸收 addyosmani 规则并适配）：

1. **Persona 不调用其他 Persona**：组合由命令或用户完成。在 W 模型中由 `/wm review` 根据 `targetKind` 路由；`code-reviewer` 发现安全问题时不直接调用 `security-auditor`，而是在 `reworkHints` 中标注「建议 security-auditor 深审」。
2. **Persona 可引用技能**：Persona 在评审中可加载 [`verifier-spec.md`](../w-model-dev/references/verifier-spec.md)（评审规范）或 [`quick-self-check.md`](../w-model-dev/references/quick-self-check.md)（DoD 标准，完成定义（DoD）节）作为「如何做」的依据。
3. **每个 Persona 文件以「组合」节结尾**：声明在 W 模型中的直接调用场景、经 `/wm review` 调用场景、禁止从其他 Persona 调用。

#### 6.4.2 W 模型适配的 4 个 Persona

| Persona                 | 角色定位                            | W 模型阶段                                                     | 主要 `targetKind` | 输出格式                                                                             |
| ----------------------- | ----------------------------------- | -------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------ |
| **code-reviewer**       | 资深工程师，五轴代码审查            | 阶段 5 编码                                                    | `code`            | Critical / Required / Optional / Nit / FYI 分级发现项 + 复审结论                     |
| **test-engineer**       | QA 工程师，测试策略与覆盖率分析     | 阶段 4 详细设计（单测设计）/ 阶段 6 集成测试 / 阶段 7 系统测试 | `test`            | 覆盖率缺口清单 + Prove-It 测试 + 优先级（Critical / High / Medium / Low）            |
| **security-auditor**    | 安全工程师，OWASP + STRIDE 威胁建模 | 阶段 7 系统测试（安全子项）                                    | `code` / `design` | Critical / High / Medium / Low / Info 分级漏洞 + PoC + 修复建议                      |
| **performance-auditor** | 性能工程师，性能基线与回归          | 阶段 7 系统测试（性能子项）                                    | `code` / `design` | Critical / High / Medium / Low / Info 分级瓶颈 + Metric-Honesty Rule（禁止编造指标） |

> 性能 Persona 借鉴 addyosmani `web-performance-auditor`，但**适配 W 模型后端场景**：默认无 Lighthouse / CrUX 工件时退化为「源代码结构反模式扫描」，所有发现标注 `potential impact`；只有当用户提供 k6 / JMeter 等工具产出 JSON 时才填入 measured 值。这是 addyosmani「Metric-Honesty Rule」的直接吸收。

#### 6.4.3 与 §7.6 LLM-as-a-Verifier 的关系

| 维度     | §7.6 LLM-as-a-Verifier                                                                                                                | §6.4 Agent Personas                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 关注点   | 评审输出的「结构与有效性」                                                                                                            | 评审执行的「角色与视角」                       |
| 定义内容 | 输出 Schema（`subCriteria[]` / `compositeScore` / `qualityLevel` / `passed` / `reworkHints`）+ 校验脚本（`check-verifier-output.ts`） | 角色提示词（关注点清单 + 严重等级 + 输出模板） |
| 强制性   | JSON Schema 强制（脚本校验）                                                                                                          | 软性约定（提示词，不调用 LLM）                 |
| 互补关系 | Persona 产出的 JSON 必须满足 §7.6 Schema                                                                                              | Persona 决定 JSON 中发现项的内容与质量         |

`/wm review <target>` 命令的路由逻辑：

1. 识别 `target` 的 `targetKind`（`requirement` / `design` / `code` / `test`）；
2. 若 `targetKind=code`：默认路由到 `code-reviewer`；如文件涉及安全敏感面（auth / 加密 / 输入校验），同时建议 `security-auditor` 深审；如涉及性能（热点循环 / DB 查询），建议 `performance-auditor` 深审；
3. 若 `targetKind=test`：路由到 `test-engineer`；
4. 若 `targetKind=design`：默认走 §7.6 通用评审，但如设计涉及安全架构，建议 `security-auditor` 深审；
5. 评审产出 JSON 后必须执行 `check-verifier-output.ts` 校验。

> 「建议深审」不是自动调用：Persona 不互相调用（§6.4.1 规则 1）。建议在评审报告的 `reworkHints` 中以「[建议 security-auditor 深审] xxx」前缀形式呈现，由用户或后续 `/wm review` 显式触发。

#### 6.4.4 R（根因定位者）角色定义

> 伴随返工循环根因定位者（R）角色引入，本节为 R 角色的权威定义（与 §3.4.2 角色表的 R 行互补：§3.4.2 为编排摘要，本节为完整定义）。
> R 不是评审 Persona（§6.4.2 的 4 个 Persona 仍仅服务于 V 子代理），而是独立的诊断子代理角色；R 不调用 Persona，Persona 不调用 R。
> 权威定义见 [根因定位者设计 spec](./superpowers/specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md) §1.1。

**R（Root Cause Locator）角色定义**：

| 维度         | 定义                                                                                                                                                                                                                                                                                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **简称**     | R（Root Cause Locator）                                                                                                                                                                                                                                                                                                                                   |
| **职责**     | 接收 V/G 的 `reworkHints` + 失败产物 + 上游产物，运用根因分析方法论定位缺陷根因，产出 `RootCauseReport`（含根因链、上游缺陷标记、修复建议、防御措施）                                                                                                                                                                                                     |
| **允许动作** | ① 读失败产物文件 + 上游产物（需求/设计/代码/测试/TLA+/graph.json）；② 读 V 的 `VerifierOutput` JSON + G 的 GATE_JSON；③ 运用根因分析方法（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）；④ 产出 `RootCauseReport` JSON + `.md` 报告文件；⑤ 标记 `upstreamDefect`（若根因为上游需求/设计缺陷）；⑥ 作为 R-lead 分派 R-persona 子代理（并行或串行均可）并聚合产出 |
| **禁止动作** | ① 改任何产物文件（由 S 修复）；② 跑门禁脚本（由 G 负责）；③ 改 RTM 实体；④ 改 `project.status`；⑤ 跨阶段定位（仅定位当前阶段产物的缺陷根因，上游回溯仅标记不修改）；⑥ 评审其他角色产出                                                                                                                                                                    |

**F（Fixer）角色定义**（由 S 兼任，非新角色）：

| 维度         | 定义                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **简称**     | F（Fixer）                                                                                                                              |
| **承担者**   | **由现有 S 子代理兼任**（S 在返工场景下接受 R 报告作为额外输入，执行修复）                                                              |
| **职责**     | 接收 R 的 `RootCauseReport`（已经 V 复审通过），按 `fixRecommendation` 修复产物，同步更新 RTM 实体                                      |
| **允许动作** | ① S 的全部允许动作；② 读 R 的 `RootCauseReport`；③ 按 `fixRecommendation` 修改产物；④ 在返工记录中标注「修复依据：R 报告 `<reportId>`」 |
| **禁止动作** | ① 无视 R 报告自行修复（必须以 R 报告为依据）；② 跳过 R 直接返工（命中反模式 #18）                                                       |

> R 与 V 的区别：V 评审「产物是否符合标准」（发现 what）；R 诊断「产物为何不符合标准」（追溯 why）。V 输出 `reworkHints`（现象）；R 输出 `RootCauseReport`（根因链）。
> R 与 A 的区别：A 分析「原始文档→图谱」的结构化（阶段 1-4 ingestion）；R 分析「失败产物→根因」的诊断（全阶段返工）。两者活动领域不同。

#### 6.4.5 R 方法论与多角度机制

R 子代理的方法论详见 [root-cause-locator.md](../w-model-dev/references/root-cause-locator.md)。多角度分析机制（并行/串行均可）详见 spec §9.2 与 [agent-personas.md](../w-model-dev/references/agent-personas.md)。

> R 方法论含 4 种根因分析方法（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）+ 方法选择规则 + 5 条产出质量标准（根因可证伪 / 禁止现象当根因 / fixRecommendation 针对根因 / prevention 可执行 / upstreamDefect 附证据）。
> 多角度机制本质是「多角度」而非「并行」：宿主支持并行子代理时并行分派 N 个 R-persona，仅支持串行时依次分派（等价合法），单会话无子代理时 R-lead 多轮切换 persona（降级）。三种分派方式的产出结构、聚合规则、归档要求、run-log 记录完全一致。

---

## 7. 数据模型设计

> **结构权威**：§7.1-§7.5 数据模型与 Schema 清单（34 份，含 change-scope / codegraph-query 与 evidence-manifest / evidence-provenance）的结构权威为 [`w-model-dev/references/data-models.md`](../w-model-dev/references/data-models.md)；本节约为全量定义，两者须保持一致（schema 增减先改 data-models.md 与 `w-model-dev/schemas/`）。

### 7.1 项目数据模型

```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  status:
    '需求分析' | '系统设计' | '概要设计' | '详细设计' | '编码' | '集成测试' | '系统测试' | '验收测试' | '项目完成';
  techStack: {
    frontend: string[];
    backend: string[];
    database: string[];
    others: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### 7.2 需求数据模型

```typescript
interface Requirement {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: '功能需求' | '非功能需求' | '约束需求';
  priority: '高' | '中' | '低';
  acceptanceCriteria: string[];
  testCases: TestCase[];
  status: '待开发' | '开发中' | '已完成' | '已验证';
}
```

### 7.3 设计数据模型

```typescript
interface Design {
  id: string;
  projectId: string;
  type: '系统设计' | '概要设计' | '详细设计';
  content: string;
  diagrams: Diagram[];
  testCases: TestCase[];
  createdAt: Date;
}
```

### 7.4 测试用例数据模型

```typescript
interface TestCase {
  id: string;
  projectId: string;
  type: '验收测试' | '系统测试' | '集成测试' | '单元测试';
  title: string;
  description: string;
  steps: string[];
  expectedResult: string;
  status: '待执行' | '通过' | '失败';
  priority: '高' | '中' | '低';
}
```

### 7.5 数据模型关系图

```mermaid
erDiagram
    PROJECT ||--o{ REQUIREMENT : contains
    PROJECT ||--o{ DESIGN : contains
    PROJECT ||--o{ TEST_CASE : contains
    REQUIREMENT ||--|{ TEST_CASE : generates
    DESIGN ||--|{ TEST_CASE : generates

    PROJECT {
        string id PK
        string name
        string description
        string status
        date createdAt
        date updatedAt
    }

    REQUIREMENT {
        string id PK
        string projectId FK
        string title
        string description
        string type
        string priority
        string status
    }

    DESIGN {
        string id PK
        string projectId FK
        string type
        string content
        date createdAt
    }

    TEST_CASE {
        string id PK
        string projectId FK
        string requirementId FK
        string designId FK
        string type
        string title
        string description
        string status
        string priority
    }
```

### 7.6 LLM-as-a-Verifier 评审规范（外部 Agent 执行）

> 本技能不内置 LLM 调用：评审由外部 Agent 按 `verifier-spec.md` 提示词执行，技能只提供提示词 + 输出 Schema + 校验脚本（历史内置类型与实现已删除，演进记录见 CHANGELOG 体系）。

LLM-as-a-Verifier 评审由外部 Agent 按提示词执行，**本节不再定义 LLM 相关类型**。权威规范定义在 [`w-model-dev/references/verifier-spec.md`](../w-model-dev/references/verifier-spec.md)，要点如下：

- **适用目标类型**：`requirement` / `design` / `code` / `test`，各自对应一组子标准与权重。
- **三维度验证**：评分粒度（≥3 个子标准，连续评分 `[0,1]` 保留 4 位小数）/ 重复评估（默认 3 次，方差 ≤ 0.10）/ 标准分解（每个子标准须含 `evidence` 引用目标内具体片段）。
- **连续评分实现**：logits 期望值（A/B/C/D 四档 token 概率加权）或文本回退（解析字母 + ±0.05 稳定扰动），Agent 在 `meta.scoringMethod` 标注实际方法。
- **PPT 排序**：多候选场景按 PPT 算法（默认 `k=5` / `temperature=4.0`）输出 `ranking` 字段。
- **输出 Schema**：`schemaVersion="1.0"` + `meta` + `subCriteria[]` + `compositeScore[0,1]` + `qualityLevel(A/B/C/D)` + `summary` + `passed` + 可选 `reworkHints` / `ranking`。
- **质量等级映射**：`[0.85,1.0]=A` / `[0.70,0.85)=B` / `[0.50,0.70)=C` / `[0,0.50)=D`；`passed = (A or B) && 所有 subCriterion.score ≥ 0.70`（R13 单轴下限：加权重平均只用于汇报，放行判据须逐子标准 ≥ B 级分界；反模式 #41 守护）。
- **五轴评审与严重等级标签**（吸收自 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `code-review-and-quality` 技能）：代码评审（`targetKind=code`）的子标准按五轴（Correctness / Readability / Security / Architecture / Performance）组织发现项；每条发现项标注 Severity（Critical / Required / Nit / Optional / FYI），使作者区分必修与可选。详细子标准映射与 Structural Remedies 见 [`w-model-dev/references/verifier-spec.md`](../w-model-dev/references/verifier-spec.md) §7.4A。
- **防漂移校验**：外部 Agent 输出 JSON 后必须调用 `w-model-dev/scripts/cli/check-verifier-output.ts` 校验（退出码 `0=通过 / 1=校验失败 / 2=输入错误`）。校验纯逻辑单点事实源为 `w-model-dev/scripts/logic/verifier-logic.ts`。
- **与外部演化工具的关系**：本规范只覆盖「阶段产物校验流程」，是技能内部的产物质量保障；技能演化（Rollout / Reflect / Edit / Skill Lift）由外部 SkillOpt / darwin-skill 完成，可消费本规范产出的 `VerifierOutput` JSON 作为训练信号。
- **evidence 格式规范**：evidence 字段每条须含 `<文件路径>.<字段路径>=<值>` 格式
  - 合法示例：`coverage.json.matrices.stakeholder.coverage=100%` / `tla-manifest.json.specs[0].tlcChecked=true`
  - 非法示例：`C1-C10 全通过` / `质量良好` / `评审通过`（空泛声明）
  - 空泛声明视为 O3（Verifier Theater）命中，V 评审降级重做
  - evidence 字段为空 → 评审失败

`/wm review <target>` 命令（见 §6）仅返回结构化评审指引——根据目标 ID 识别 `targetKind`，提示对应的子标准集合，并指引外部 Agent 加载 `verifier-spec.md` §8 提示词模板执行评审、再调用校验脚本。命令本身不调用 LLM。

### 7.6A self-as-verifier 模式（demo-only 例外）

> 单 Agent 兼任 S/V/G/R 多角色的例外模式。正式定义与独立性细则见 [`w-model-dev/SKILL.md`](../w-model-dev/SKILL.md)「self-as-verifier 模式」节与 `verifier-spec.md` §13；本节为 SSoT 权威定位。

- **启用边界**：仅限 demo / 非生产 / 教学演示项目，**生产项目禁止**；启用时 `project.status` 标记 `selfAsVerifier: true`。生产路径默认编排仍为 O 编排 + S/V/G/R 子代理分派，独立评审依赖 V 子代理物理隔离（§3.4 编排者-子代理边界），**编排者不得自评**（反模式 #10）。
- **独立性底线**：S/V/G/R 各角色产物文件路径必须独立（VerifierOutput / gate-logs / RootCauseReport / PreventiveReview 三份），违反命中反模式 #35，回退当前阶段起点；R3 预防性审查三份报告无条件强制（不因兼任豁免）。
- **偏置缓解**：V 评审须选用与 S 产出视角不同的 Persona 提示词运行（agent-personas.md 4 个评审 Persona 或 `subagent/` 人格库），并在 VerifierOutput `summary` 注明所用 Persona；该模式不消除自我偏置，仅将其限制在 demo / 教学范围。
- **校验**：`check-verifier-output.ts --self-as-verifier --s-output=<path>`（路径独立）；`check-role-dispatch.ts`（每阶段 S/V/G 各 ≥1；R3 只计 `role=R` 且 `outcome=success` 的 `r3-completeness`/`r3-reliability`/`r3-security` 记录、三维度各 ≥1——rootcause / iceberg-sweep / failed 不充数；空或全无效输入 fail-closed；`--r3-enabled` 为 no-op，见 §10D.8）；代签检测见 §10C（O4）。

### 7.7 graph.json schema（ingestion 子流程产物）

> 阶段 1–4 ingestion 子流程产出的**结构层**图谱 schema。权威定义见 [`docs/ingestion-graph-convergence-design.md`](./ingestion-graph-convergence-design.md) §2.4；本节为摘要，与该设计文档双向追溯。
>
> **与 `rtm.json` 的分工**（设计文档 §2.7）：`graph.json` 管结构拓扑（节点/边/连通/单根/跨阶段追溯），由 A-chunk/A-cross/A-evolve 维护，G 跑 `check-requirement-graph.ts` 校验；`rtm.json` 管追溯矩阵（需求-设计-代码-测试映射），由 S 按现有 `rtm-guide.md` 维护，G 跑 `check-artifact-gate.ts`（阶段 8 终检）。两者并存，各自独立校验，互不替代。

```json
{
  "version": 1,
  "project": "<project-id>",
  "currentPhase": 1,
  "rootId": "REQ-ROOT | null",
  "nodes": [<节点>],
  "edges": [{"from":"<id>","to":"<id>","type":"<边类型>"}],
  "analysisRounds": [
    {"phase":1,"round":1,"timestamp":"...","violations":[],"converged":true}
  ]
}
```

要点：

- **节点类型**（每阶段一种，设计文档 §2.1）：阶段 1 `REQ` / 阶段 2 `SD` / 阶段 3 `INTF` / 阶段 4 `DD`；另含边界节点 `EXT-IN`（合法外部信息源，DFD terminator）/ `EXT-OUT`（合法外部信息汇），二者豁免黑洞/奇迹判定且不参与 `parent` 单根树。节点 schema 统一含 `id` / `type` / `phase` / `sourcePath` / `summary` 等字段（设计文档 §2.2）。
- **可选字段 evidenceAnchor**：节点结论的前提事实锚点（产出期声明，A 子代理 ingestion 时写、S 规格 §4.2 只读同步、G 门禁 R15 格式校验）；未声明不阻断（向后兼容）。
- **REQ level 自适应层级深度**：每个 REQ 节点须标注 level（正整数，从 1 开始单调递增，无上限）
  - 最小层级深度 = 2（domain → acceptance，适用极小项目）
  - 推荐层级深度 = 4（domain → module → feature → acceptance）
  - 最大层级深度 = 不限（复杂项目可扩展至 5+ 层）
  - 校验规则：level 单调性（子节点 level > 父节点 level）+ 根节点 level=1 + 叶节点须可追溯到验收级
- **边类型**（设计文档 §2.3）：结构边 `parent`（同阶段树形）/ `implements`（SD→REQ）/ `defines`（SD→INTF）/ `realizes`（DD→INTF or DD→SD）；信息流边 `produces` / `consumes`（方向=信息流方向，`from`=来源 `to`=去向，两类方向语义相同仅强调视角不同）。
- **信息流边与边界节点**用于黑洞/奇迹/死模块校验，与结构边正交（不参与 `parent` 单根树但参与整体连通性 BFS），详见 [`information-flow-validation-design.md`](./information-flow-validation-design.md)。
- **收敛循环**：A-cross/A-evolve 把 `consolidated.json` 作为 `graph.json` 候选态写入，G 跑 `check-requirement-graph.ts` 校验；`passed=true` 才晋升为正式 `graph.json`（设计文档 §2.6）。
- **阶段 4 硬约束**：`--phase=4` 零违反（结构违反 + 信息流违反均空）才放行进阶段 5 编码（见 §4.4）。
- **维护边界**：A 子代理产出（含晋升 `consolidated.json` → `graph.json`）；编排者不写；S 不改图谱节点。违反命中反模式 #11（见 [`w-model-dev/references/hard-constraints.md`](../w-model-dev/references/hard-constraints.md)）。

### 7.8 tla-manifest.json schema（TLA+ 行为层产物）

> 阶段 1–4 TLA+ 层次化状态机建模产出的**行为层**图谱 schema。权威定义见 [`docs/tla-plus-modeling-design.md`](./tla-plus-modeling-design.md) §2；本节为摘要，与该设计文档双向追溯。
>
> **与 `graph.json` / `rtm.json` 的分工**：`tla-manifest.json` 管动态行为（状态机/不变式/死锁），由 S 产出 .tla + .cfg 后维护，G 跑 `check-tla-model.ts` 校验；`graph.json` 管静态结构拓扑；`rtm.json` 管追溯矩阵。三者并存，各自独立校验，互不替代。

```json
{
  "version": 1,
  "project": "<project-id>",
  "currentPhase": 1,
  "tools": { "jarPath": "w-model-dev/tools/tla2tools.jar", "javaMinVersion": 11 },
  "specs": [
    {
      "id": "L1_blog_system",
      "level": "L1",
      "phase": 1,
      "system": "blog-system",
      "requirementIds": ["REQ-001"],
      "designRef": "docs/requirement-spec.md#§3",
      "tlaPath": "tla/L1_blog_system.tla",
      "cfgPath": "tla/L1_blog_system.cfg",
      "parent": null,
      "siblings": [],
      "children": ["tla/L2_auth_subsystem.tla"],
      "variableCombination": 240,
      "decompositionDecision": "kept-below-threshold",
      "syntaxChecked": true,
      "tlcChecked": true,
      "deadlockFree": true,
      "invariantsHold": true,
      "stateExplosion": false
    }
  ],
  "checkRounds": []
}
```

要点：

- **层级模型**（设计文档 §1.1）：L1 系统内外交互 / L2 子系统内部行为+同级交互 / L3 原子化子系统行为 / L4+ 递归拆解。每个下级子系统可视为独立系统继续拆解。
- **拆解判定**（设计文档 §1.1）：变量组合数 >1k 考虑拆，>1w 必须拆（`decompositionDecision` 字段记录决策）。
- **文件头规范**（设计文档 §1.2）：每个 `.tla` 文件须含 8 个 `@` 字段（`@system`/`@requirement`/`@design`/`@parent`/`@sibling`/`@child`/`@level`/`@phase`），`check-tla-model.ts` 校验完整性与双向一致性。
- **行为校验**（设计文档 §3）：SANY 语法检查 → TLC 模型检查（无死锁/不变式违反/状态爆炸）；编码调试顺序为硬约束（反模式 #14）。
- **阶段 4 硬约束**：`--phase=4` TLA+ 零违反 + 图谱零违反才放行进阶段 5 编码。
- **维护边界**：S 子代理产出（.tla + .cfg + manifest 实体）；G 子代理跑 `check-tla-model.ts` 校验；编排者不写。TLA+ 不接受占位/简化/错误实现（反模式 #16）；建模须符合需求和设计，符合后仍有问题须修正需求/设计并回退重跑（反模式 #17）。
- **工具链**：TLA+/TLC 是外部工具能力；Java ≥ 11 是宿主环境依赖；`w-model-dev/tools/tla2tools.jar` 是 L1 交付层随技能包携带的运行时资产，含 SANY + TLC + PlusCal，由 `check-tla-model.ts` 按 manifest 路径加载。
- **checkRounds 语义**（与 [`w-model-dev/references/tla-plus.md`](../w-model-dev/references/tla-plus.md) 双向追溯）：记录每轮 `check-tla-model.ts` 校验结果（含 violations 摘要与 round 编号）；`violations` 跨轮须单调递减（设计文档 §3.4）；与 `run-log.jsonl` R3（返工动作完整性）交叉校验——每轮 checkRound 须对应 run-log 中一条返工记录；无返工（首次即收敛）填 `[]`。

### 7.9 signature-chain.jsonl schema（角色链式签名产物）

> 阶段 1–8 每角色动作完成后产出的**签名链**记录 schema。权威定义见 [`w-model-dev/references/signature-chain-guide.md`](../w-model-dev/references/signature-chain-guide.md)；schema 文件见 [`w-model-dev/schemas/signature-chain.schema.json`](../w-model-dev/schemas/signature-chain.schema.json)。

```json
{
  "sigId": "wm1-r002-S",
  "phase": 1,
  "phaseName": "需求分析",
  "role": "S",
  "action": "produce",
  "runId": "wm1-r002",
  "artifacts": ["docs/requirements.md", ".w-model/graph.json"],
  "prevSigId": "wm1-r002a-A",
  "prevSigHash": "sha256:...",
  "sigHash": "sha256:...",
  "signedAt": "2026-07-28T10:00:01.000Z",
  "signer": "user-or-agent-id",
  "gateExitCode": null,
  "gateLogPath": null,
  "inputProvenance": {
    "sourceSigIds": ["wm1-r001-O", "wm1-r002a-A"],
    "sourceArtifacts": [
      { "path": ".w-model/graph.json", "sourceSigId": "wm1-r002a-A", "sourceRole": "A" },
      { "path": ".w-model/project.json", "sourceSigId": "wm1-r001-O", "sourceRole": "O" }
    ],
    "transformDescription": "A 子代理合并 REQ 节点建图 → S 子代理产出需求规格"
  }
}
```

要点：

- **链式约束**：`prevSigId` 指向同阶段前一环签名；`sigHash = sha256(sigId + phase + role + action + runId + artifacts + prevSigHash + signedAt + signer + inputProvenance)`；首环 `prevSigId = "genesis"`，`prevSigHash = "0"`。
- **角色签名顺序**（强制链）：`genesis → O(chunk) → A(cross) → S(produce) → V(review) → G(gate) → O(checkpoint-用户确认)`；阶段 5 无 A，阶段 6-8 视具体阶段调整。
- **产出来源正确性**（`inputProvenance`）：各角色产出须声明上游签名 + 上游产物 + 变换描述；强制来源/禁止来源矩阵见 [`signature-chain-guide.md`](../w-model-dev/references/signature-chain-guide.md) §3。
- **G 角色校验职责**：G 跑门禁脚本前先跑 `check-signature-chain.ts`（R1-R10）；O checkpoint 前须跑签名链校验 + 用户确认签名。
- **归档**：`signature-chain.jsonl` 须纳入归档完整性强制快照清单（由 `check-archive-integrity.ts` 校验）。

---

## 8. 技术实现方案

### 8.1 技术栈选择

本技能是单纯的编排 + 校验脚本技能，无运行时框架与数据库：

| 层次       | 技术                                   | 理由                                 |
| ---------- | -------------------------------------- | ------------------------------------ |
| 编排载体   | Markdown（`SKILL.md` + `references/`） | 人类与 Agent 双可读，按需加载        |
| 校验脚本   | TypeScript（自包含，仅依赖 `tsx`）     | 类型安全的纯函数门禁判定，不调用 LLM |
| 文档模板   | Markdown（`templates/`）               | 易于阅读和版本控制                   |
| LLM 推理   | 外部 Agent 自身的 LLM                  | 技能不内置 LLM 调用                  |
| 状态持久化 | JSON 文件（`.w-model/*.json`）         | 跨多轮交互保持上下文，Agent 直接读写 |

### 8.2 核心算法设计

#### 8.2.1 需求解析算法

```mermaid
flowchart TD
    A[输入: 自然语言需求描述] --> B[LLM意图识别和实体提取]
    B --> C[构建需求层次结构]
    C --> D[检测需求冲突和缺失]
    D --> E[生成验收标准]
    E --> F[输出: 结构化需求规格]

    style A fill:#e8f5e9,stroke:#4caf50
    style F fill:#fff3e0,stroke:#ff9800
```

#### 8.2.2 测试用例生成算法

```mermaid
flowchart TD
    A[输入: 需求/设计文档] --> B[分析功能点]
    B --> C[识别输入输出边界条件]
    C --> D[生成正常场景用例]
    C --> E[生成异常场景用例]
    D --> F[评估测试用例覆盖率]
    E --> F
    F --> G[输出: 测试用例集合]

    style A fill:#e8f5e9,stroke:#4caf50
    style G fill:#fff3e0,stroke:#ff9800
```

#### 8.2.3 代码生成算法

```mermaid
flowchart TD
    A[输入: 详细设计文档] --> B[解析类和方法定义]
    B --> C[根据技术栈生成代码模板]
    C --> D[填充业务逻辑实现]
    D --> E[生成单元测试代码]
    E --> F[代码质量检查和优化]
    F --> G[输出: 可运行代码]

    style A fill:#e8f5e9,stroke:#4caf50
    style G fill:#fff3e0,stroke:#ff9800
```

#### 8.2.4 工具脚本

除门禁校验脚本外，技能包另提供两个工具脚本，供编排者 O 与各角色在流程中调用（非阶段门，不参与放行判定）：

| 脚本          | 用途                                                                                                                                                                                                                                                                                                                                                                                             | 实现位置                                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wm-write.ts` | 状态文件安全写助手：以 `<target>.lock` 持久目录和可转移 owner 对象实现跨进程锁；锁内完成 mtime 校验、毫秒+UUID 备份、tmp+rename、回读与原子恢复。CLI 支持 `--lock-timeout <ms>` 与 `--recover-stale-lock`，不带恢复标志的陈旧锁以 `STALE_LOCK` / exit 1 拒绝写入；直接 `writeStateJson` 调用保留隐式恢复兼容行为。`--expect-mtime` 接受有限非负数并向下取整，`--lock-timeout` 必须为安全非负整数 | [`w-model-dev/scripts/cli/wm-write.ts`](../w-model-dev/scripts/cli/wm-write.ts) + [`w-model-dev/scripts/logic/state-write-logic.ts`](../w-model-dev/scripts/logic/state-write-logic.ts) |
| `doctor.ts`   | 环境自检：node / tsx / ajv / java / tla2tools / codegraph / openspec 逐项检查并给出修复指引（`--with-tla` 将 TLA+ 项升级为阻断级）。首次启用或门禁报依赖错误时运行                                                                                                                                                                                                                               | [`w-model-dev/scripts/cli/doctor.ts`](../w-model-dev/scripts/cli/doctor.ts) + [`w-model-dev/scripts/logic/doctor-logic.ts`](../w-model-dev/scripts/logic/doctor-logic.ts)               |

**本地 pre-push 平台依赖与显式安装安全边界**：hook 缺少 `node_modules` 时以 exit 1 拒绝推送并提示开发者运行 `npm install`，不自动安装。它只调用 `ensure-platform-deps.sh --check`；默认/`--check` 始终只读，不进行网络下载、`npm pack`、解包或 `node_modules` 覆盖。开发者可在 Bash 中显式运行 `npm run platform-deps:check` 或 `npm run platform-deps:install`；显式 `--install` 在受支持的 Windows x64 / Linux x64 上使用当前 checkout 的 Node 标准库 CLI，在受控 staging 中校验并安装 lockfile 固定的平台包。

**本地 pre-push 推送范围判定（真实 push stdin 语义）**：hook 触发范围判定以 **git push 写入 stdin 的 ref 行为准**（每行 `<local ref> <local sha> <remote ref> <remote sha>` 四字段，40 位十六进制 sha；全零 sha 合法——第 2 字段全零 = 删除远端 ref，第 4 字段全零 = 全新分支）。逐行聚合变更文件后再做路径命中判断，不再用全局 diff 先行短路（多 ref 推送逐行覆盖，不漏检）。删除 ref 行跳过收集；全新分支先用 `git merge-base --fork-point`、退化为普通 `merge-base` 建立可证明基线（基线为空或退化到推送尖本身时降级经 remote-tracking 排除集枚举证明——remote 名经白名单与 `git remote get-url` 验证后执行 `git log -m --name-only --pretty=format: <local_sha> --not --remotes=<remote>`，`-m` 确保合并提交按父逐个列出避免空 diff 漏检；三级全部失败 → fail-closed 跑全量门禁，绝不使用 `git log -n N` 截断）；常规更新按 `remote_sha..local_sha` 做 `git diff --name-only`（`--` 置于两 sha 之后，避免被当 pathspec 致空输出）。任一 ref 行解析失败 → fail-closed（无法证明变更范围就运行全部门禁）；全部行均为删除（delete-only）→ 放行跳过门禁；stdin 无 ref 行（非 git push 触发）→ 回退 `HEAD@{push}` 相对 HEAD 的 diff（不可用时回退 `origin/HEAD`），回退失败同样 fail-closed。路径命中保持 bash case 模式语义（`*` 可跨 `/`）：`w-model-dev/*`、根级 `README.md` / `AGENTS.md` / `CONTRIBUTING.md` / `.gitignore` / `.eslintsecurity-baseline.json` / `package.json` / `package-lock.json`、`config/*` / `scripts/*` / `.githooks/*`、`eval/*`（评估资产：语料 / mappings / runner，对应 pre-push 第 18 项）、`docs/*.md`（实测命中 `docs/` 任意层级 `*.md`，含 `docs/changes` 归档与 `docs/superpowers` 规划）。`npm run prepush` 以 `--force` 强制跑全部门禁，不读 stdin。

`docs-consistency` 对 README.md / AGENTS.md / CONTRIBUTING.md / docs/troubleshooting.md 四份活体文档执行门禁项数引用扫描（`gate-count-docs`）：行含「门禁/检查」标记时，全部「N 项」计数引用须 == `EXPECTED.prePushCount`；「第 N 项」下标（如「第 13 项 npm audit」）与历史目录（CHANGELOG* / docs/changes / docs/superpowers）不在扫描范围（gate-count-stale-scan，2026-09-07）。

显式安装把 tarball 字节及 UStar、PAX `x`/`g`、GNU `L`/`K` metadata 视为不可信输入。提取器在任何 extraction write 前完成整包解析与 canonical preflight，拒绝 absolute/drive-qualified、traversal、dot/empty/NUL 路径，拒绝 symlink、hardlink 和任何 `linkname`，拒绝重复 canonical path、file ancestor/descendant 冲突及既有类型/名称冲突；普通文件以独占创建写入，并按单一 path component 逐层建目录。SRI、registry allowlist、package name/version 和隔离加载全部验证成功后，安装器才从 repo 同卷 staging 受控提交；既有 `node_modules/<name>` 若不是同一 lockfile 包身份则以冲突失败，不覆盖。verification 临时目录、install staging 与 `npm pack` 临时目录均由调用者在 success/failure 的 `finally` 中整体清理，因此普通 I/O 或部分提取失败只允许污染本次私有 staging，不得污染既有 `node_modules`。

威胁模型信任调用者以 `mkdtemp` 创建并独占的 verification/install staging 生命周期，以及 repo install target 的正常 namespace 生命周期；不承诺抵御同 UID/同 Windows 访问令牌进程主动 rename、替换或篡改 staging、repo root、lockfile、tarball 或 `node_modules`，也不声明“任意 rename 下绝不发生词法 root 外写入”。该主体本就能直接修改这些对象；需要抵御它时必须另设不同安全主体或 OS sandbox，而不是叠加 Node path 检查。`self-test` 与 `doctor` 可在 PowerShell 运行，pre-push 与平台依赖命令需要 Bash。

---

## 9. 需求跟踪矩阵（RTM）

### 9.1 RTM结构

| 需求ID  | 需求描述     | 设计文档 | 代码模块             | 单元测试 | 集成测试 | 系统测试 | 验收测试 | 覆盖状态 |
| ------- | ------------ | -------- | -------------------- | -------- | -------- | -------- | -------- | -------- |
| REQ-001 | 用户注册功能 | SD-3.2.1 | userController.ts    | UT-001   | IT-001   | ST-001   | UAT-001  | 100%     |
| REQ-002 | 用户登录功能 | SD-3.2.2 | authService.ts       | UT-002   | IT-002   | ST-002   | UAT-002  | 100%     |
| REQ-003 | 商品浏览功能 | SD-3.3.1 | productController.ts | UT-003   | IT-003   | ST-003   | UAT-003  | 100%     |
| REQ-004 | 购物车功能   | SD-3.3.2 | cartService.ts       | UT-004   | IT-004   | ST-004   | UAT-004  | 100%     |
| REQ-005 | 订单管理功能 | SD-3.4.1 | orderController.ts   | UT-005   | IT-005   | ST-005   | UAT-005  | 100%     |

### 9.2 RTM跟踪方向

```mermaid
graph LR
    A[业务需求] --> B[系统需求]
    B --> C[设计文档]
    C --> D[代码实现]
    D --> E[测试用例]
    E --> F[测试执行]
    F --> G[缺陷]

    G --> E
    F --> D
    E --> C
    D --> B
    C --> A

    style A fill:#e3f2fd,stroke:#1976d2
    style B fill:#e3f2fd,stroke:#1976d2
    style C fill:#fff3e0,stroke:#ff9800
    style D fill:#c8e6c9,stroke:#388e3c
    style E fill:#f3e5f5,stroke:#7b1fa2
    style F fill:#ffcdd2,stroke:#c62828
    style G fill:#ffcc80,stroke:#ef6c00
```

### 9.3 RTM维护规则

1. **变更同步**：每次需求或设计变更必须同步更新RTM
2. **覆盖检查**：定期检查需求覆盖率，确保100%覆盖
3. **优先级标记**：根据需求优先级确定测试优先级
4. **状态追踪**：实时更新测试执行状态
5. **缺陷关联**：将缺陷与对应的需求和测试用例关联

---

## 10. 质量保障体系

### 10.1 代码质量标准

- 单元测试代码覆盖率 ≥ 80%
- 代码规范检查（ESLint/Prettier）
- 安全漏洞扫描
- 性能指标监控

### 10.2 文档质量标准

- 文档完整性检查
- 文档一致性验证
- 版本控制管理

### 10.3 测试质量标准

- 测试用例评审机制
- 测试覆盖率分析
- 缺陷追踪管理

### 10.4 质量保障流程

```mermaid
flowchart TD
    A[代码提交] --> B[自动化代码审查]
    B -->|通过| C[单元测试]
    B -->|不通过| A
    C -->|通过| D[集成测试]
    C -->|不通过| A
    D -->|通过| E[系统测试]
    D -->|不通过| A
    E -->|通过| F[质量门检查]
    E -->|不通过| A
    F -->|通过| G[发布]
    F -->|不通过| A

    style A fill:#e3f2fd
    style G fill:#c8e6c9,stroke:#388e3c,stroke-width:2px
```

### 10.5 工件质量门（Artifact Gate）

> 质量门定义：本节定义「工件质量门」的判定标准。
> 重构后，**技能验证门已移除**——技能演化（Skill Lift 评估、Rollout / Reflect / Edit 等）不再内置技能包，
> 由外部工具（[SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)）完成。
> 对应地 `w-model-dev/scripts/cli/check-skill-gate.ts`、`w-model-dev/META-SKILL.md`、
> `src/evolution/skill-optimizer.ts`、`src/eval/skill-lift.ts` 等均已删除。
> 本节仅保留「工件质量门」。

| 维度                       | 工件质量门（Artifact Gate）                                                |
| -------------------------- | -------------------------------------------------------------------------- |
| 评估对象                   | W 模型产出物（需求 / 设计 / 代码 / 测试用例）对应的 RTM 覆盖与测试执行结果 |
| 触发时机                   | 验收测试阶段（`/wm test type=验收`）                                       |
| 判定逻辑                   | RTM 覆盖率 100% 且四级测试（单元 / 集成 / 系统 / 验收）全部通过            |
| 判定逻辑实现（单点事实源） | `w-model-dev/scripts/logic/gate-logic.ts` `checkArtifactGate()`            |
| Agent CLI 入口             | `w-model-dev/scripts/cli/check-artifact-gate.ts`                           |
| 失败后果                   | 返工回到编码阶段                                                           |
| 数据来源                   | 真实测试执行结果（`/wm test result=pass\|fail` 回填）                      |
| 票据内容校验（S18）        | **落点**：`w-model-dev/scripts/logic/gate-logic.ts` `checkTicketContent()`（纯函数），由 `checkArtifactGate()` 在给定票据文本时调用；CLI 层 `w-model-dev/scripts/cli/check-artifact-gate.ts` 负责解析 `--tickets=<path>` 并读取文件。**输入**：`--tickets=<path>` 指向的票据文件文本（`.w-model/tickets.md` 或 `docs/tickets.md`）；**参数缺省时不触发**（既有调用方零影响）；`--tickets` 只接受等号形态（空格形态 / 空值 → exit 2 `ARG_INVALID`）；给定但文件不存在 → exit 2 `FILE_NOT_FOUND`，`--phase<5` 时给定 → exit 2 `ARG_INVALID`，校验失败 → exit 1；`GATE_JSON` 输出 `tickets:{checked,criticalMissing,buildabilityMissing}`。**判据集**：六条黑名单（① 占位短语 `TBD`/`TODO`/`implement later`/`fill in details` 等；② 无具体动作的祈使（如「加适当的错误处理」「处理边界情况」）；③ 要求写测试但未给出测试符号或用例名；④ 以「类似任务 N」指代而未重复符号级说明；⑤ 只说要做什么不说怎么做；⑥ 引用任何任务中都未定义的 type/function/method）+ Buildability 三条负面判据（缺接口签名且缺验收标准 / 验收标准引用未定义符号 / 只给路径不给符号）。**全部为符号级判据**：票据须点名接口签名 / 类型约束 / 状态转移，或可执行步骤的具体动作与产出物；**不得要求写文件路径或内联代码块**（与 `phase-5-coding.md`「票据内容 durability」一致）——该改写是**本仓库对源文的适配，非源文原义**。**判据口径（修复轮 1）**：票据块边界只认模板形态 `# <NN> — <标题>` 与关键词形态 `# 票据 N` / `# Ticket N` / `# 任务 N` / `# Task N`（实现同样接受的英文关键词形态；分节标题如 `### 1. 步骤一` 不计入 `checked`）；⑥ 的「已定义」为**结构性**判定——span 自带契约标注 `: T` / `→ b` 任意行成立；**声明式邻接**（专指契约标记词 `接口签名`/`类型约束`/`状态转移`/`符号契约`/`契约`/`定义`/`入参`/`出参` 紧邻 span 之前，仅允许空白/冒号/顿号/引号/括号等间隔符）上裸符号与调用式（含空括号）一律算定义；`What to build` 字段行（无声明式邻接）上裸符号与**带参**调用式算定义、**空括号**调用式不算；标记词的**否定/旁述**出现（如「无接口签名要求，调用 …」）不算声明；通用散文词（`返回` / `参数` / `签名` / `signature` / `returns`）不参与判定 ⇒「只调用从未声明」的符号仍被拦下；⑤ 命中时 Buildability① 缺签名不重复计数（§0.1.5 不重复断言） |

**门禁脚本与 Markdown 的配合**：门禁判定逻辑沉入技能包内 `w-model-dev/scripts/logic/gate-logic.ts`（纯函数、自包含、不依赖任何外部模块），保证技能包可独立分发给 TRAE / Claude 等 Agent。Agent 在质量门检查点直接执行脚本获取确定性判定，而非靠 LLM 自行估算：

```bash
# 退出码 0=通过 / 1=未通过 / 2=输入错误；stdout 末尾输出 GATE_JSON {...} 供 Agent 解析
npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts [project-dir] --phase=<N>
# 阶段 5-8 另须 --scope=<change-scope.json>（缺失或与 Git 实际变更不符即 exit 1，fail-closed；详见 §10.5.2）
```

#### 10.5.1 项目阶段的 TLA+/BDD 行为证据契约

项目 Artifact Gate 的阶段级行为证据采用以下最小兼容契约：

- **适用边界**：成熟度分级决定是否进入额外 TLA+/BDD 行为门；一旦调用项目 `check-artifact-gate.ts`，本节契约对对应 phase 强制生效，不得用 L1 的“额外行为门可选”解释为项目 Artifact Gate 的 fail-open。实现中的阶段矩阵单点事实为 `PROJECT_TLA_BDD_EVIDENCE_PHASES`、`PROJECT_CUCUMBER_EVIDENCE_PHASES`、`PROJECT_TLA_GRAPH_EVIDENCE_PHASES`、`PROJECT_BDD_GRAPH_EVIDENCE_PHASES` 及其谓词（`isProjectTlaBddEvidencePhase`、`isProjectCucumberEvidencePhase`、`requiresProjectTlaGraphEvidence`、`requiresProjectBddGraphEvidence`）。
- **阶段 1–4**：`tla-manifest.json` 与 `bdd-manifest.json` 均必须通过各自真实 schema 与资产校验（包括非空规格/feature、关联文件存在且状态机结构有效）。缺失、非法 JSON、schema 畸形、空资产或关联文件缺失均产生 blocking violation；不得把缺失/畸形资产解释为“未启用同步”或 sync skip。
- **required D4 与独立 pair sync 是两条证据**：项目阶段门调用 `check-bdd-model.ts` 时必须传裸参数 `--require-tla-equivalence --tla-manifest=<path>`，这是 BDD D4 required equivalence；在同一阶段范围内，只有两份 manifest 已通过资产门且 TLA spec ↔ BDD feature 配对集合双向完整覆盖时，才逐 pair 调用独立 `check-tla-bdd-sync.ts`。`isTlaBddSyncContractPhase` 只表达 phase 1–4 的适用矩阵，`syncRequired` 表达该阶段契约已启用；资产无效时由 evidence gate 和 sync blocking violation 双重 fail-closed。D4 通过不替代 pair sync，pair sync 失败也不得由 D4 通过降级。
- **阶段矩阵**：独立 `check-tla-bdd-sync` pair sync 在 phase 1、2、3、4 启用；phase 1 不要求 graph，phase 2–4 另叠加 TLA+ graph 要求，BDD D8 graph 数据源在 phase 2–8 保持要求。配对任一方向存在孤儿、路径映射不完整、没有完整 pair 或子进程返回非 0，均为 blocking violation。
- **阶段 5–8**：不启用 TLA↔BDD 文件 pair sync；TLA manifest 冻结为只读，项目阶段门使用 required Cucumber 执行证据 `--require-cucumber-report --cucumber-report=<path>`。BDD D5/Cucumber 证据不由独立 pair sync 替代。
- **pre-push 边界**：技能包本地 pre-push fixture 回归不调用项目 Artifact Gate，不传上述 required flags，也不运行项目 TLA、TLA↔BDD pair sync 或 Cucumber 证据；该兼容边界不改变项目阶段门契约。

该契约由 `check-artifact-gate.ts` 编排，资产 fail-closed 由 application 层与各自 evidence gate 共同保证；不得用裸 `phase <= 4` 判断替代契约函数。

#### 10.5.2 阶段 5-8 外部校验聚合与归档后置门（2026-09-04 audit-gate-closure）

阶段 5-8 的 codegraph / opsx / archive 门禁与 ChangeScope 绑定（§3.3.1），门禁顺序为：**codegraph 与 opsx strict 校验 → artifact gate（聚合）→ opsx:archive → archive checker（check-openspec-archive.ts）→ 最终 CHECKPOINT**。archive 是 phase 8 `opsx:archive` 的**后置门**：`check-openspec-archive.ts` 在归档后单独运行，不在 pre-archive 的 artifact gate 内强制。

- **聚合**：`check-artifact-gate.ts --phase=5..8 --scope=<change-scope.json>` 在常规 RTM / TLA+ / BDD / Cucumber 校验之外先装载 ChangeScope，把 `checkCodegraphQueriesStrict` 与 `checkOpsxArtifactsStrict` 的 violations 并入 `reasons` 与 exitCode——codegraph/opsx 失败**不得被 RTM 通过掩盖**。scope 缺失 → 两个 checker 各自 fail-closed（exit 1）；scope 已提供但 Git 绑定失败（`headRef` 过期、变更集合不符等）→ 以 `[scope]` 前缀并入 reasons，且**抑制「未提供 --scope」误导文案**（真实原因指向更新过期 scope，见 `aggregateExternalChecks` 的 `scopeProvidedButFailed`）；scope 文件/JSON/schema 非法 → exit 2。`GATE_JSON` 新增 `external` summary：codegraph 的 `passed`/`violationCount`/`provided`/`changeId`/`requiredFileCount`/`coveredFileCount` 与 opsx 的 `passed`/`violationCount`/`provided`/`changeId`/`changesNames`（相对路径计数）。`gate-logic.ts` 的 `ArtifactGateResult` 不再含 `codegraphQueriesValid`/`opsxArtifactsValid`/`openspecArchived` 透传字段（dead externalChecks passthrough 已删除）。
- **checker 各自可独立跑**（G 子代理定位用）：`check-codegraph-queries.ts <project-root> --phase 5|6|7|8 --scope=<file>`（缺 scope exit 1；查询文件须过 `codegraph-query.schema.json`，同 changeId 异 phase 前缀文件属违规，`queryTimestamp` 晚于 `scopeCreatedAt` 违规，未覆盖的 code/test 变更文件逐文件 violation）；`check-opsx-artifacts.ts`（strict 只校验 `openspec/changes/<changeId>/` 一个目录 + R3×9 + V×3 项目级 stage 审查，changeId 不在 active 候选或含多候选 → 失败，不允许任取其一或跳换；changeId 须含 `phase<phase>-` 前缀）；`check-openspec-archive.ts`（strict 锚定匹配 `archive/` 下恰一个 `<changeId>` 或 `<日期>-<changeId>` 目录，多匹配失败；制品 `proposal.md`/`design.md`/`tasks.md`/`tickets.md` + `specs/` 齐全）。三个 checker 均保留 legacy 兼容纯逻辑（`checkCodegraphQueries` / `checkOpsxArtifacts` / `checkOpenspecArchive`，self-test 与 fixture 回归用），CLI 阶段 5-8 一律走 strict。

**`--validate-templates` 模式（模板漂移校验）**：`check-artifact-gate.ts` 支持 `--validate-templates` 独立模式，按 `gate-logic.ts` 的 `PHASE_SPEC_LAYOUT` 校验技能包自身 `templates/` 资产是否含必需结构标记（SSOT 头 / 引用块 / DoD 节），用于检出模板漂移。该模式校验对象是技能包自身 `templates/` 目录（相对脚本定位，与 project-dir 无关），独立分支：不读 RTM、不受 `--phase` 影响，violations 非空 → 退出码 1。支持 `--json` 输出机器可读报告（`type: 'templates'`）。

`references/quality-standards.md` 以 Markdown 描述质量标准（人类可读），与脚本互为参照但不再承载判定逻辑。

**关键约束**：工件质量门的有效性依赖真实测试结果回填。`/wm test` 命令不得自动将测试标记为通过——必须由上游 AI / 测试运行器执行真实测试后通过 `result=pass|fail` 参数回填，否则质量门形同虚设。

### 10.6 项目级 Definition of Done（每次变更的日常标准）

> 吸收自 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `references/definition-of-done.md`。
> 与 §10.5 工件质量门互补：工件质量门是「验收阶段的硬门禁」（退出码 0 才放行），DoD 是「每次变更的日常标准」（每个 `/wm code` / `/wm test` 后自检）。
> 实现位置：[`w-model-dev/references/quick-self-check.md`](../w-model-dev/references/quick-self-check.md)（完成定义（DoD）节）。
> **权威源**：完整版（七维度全表）见 quick-self-check.md「完成定义（DoD）」节「## 七维度标准」；本表为 SSoT 摘要副本，改维度须先改权威源并同步本表。

DoD 不替代阶段产物的验收标准（见各 [`phase-N-*.md`](../w-model-dev/references/)），而是项目级跨阶段的标准：

| 维度             | 标准                                                                                                        | 验证方式                                                                  | 不通过 → 动作                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------- |
| 测试             | 全部测试通过，无回归                                                                                        | 测试运行器退出码 0；新增/修改代码须配套测试                               | 当场补测试或修复回归                      |
| 行为             | 运行时验证行为符合规格                                                                                      | 手动或自动化验证关键路径，不得仅凭单测通过                                | 补运行时验证                              |
| 文档             | 涉及 API / 接口 / 数据模型的变更须同步更新文档                                                              | `git diff` 包含相关 `docs/` 与 `templates/` 更新                          | 补文档更新                                |
| RTM              | 需求 / 设计 / 代码 / 测试映射同步                                                                           | `.w-model/rtm.json` 字段无空缺；覆盖率不下降                              | 补登记 RTM 字段                           |
| 状态             | `Project.status` / `Requirement.status` 如实反映                                                            | 字段值与磁盘产物一致                                                      | 修正 `status` 字段                        |
| **理解证据**     | 阶段门放行须有用户理解证据                                                                                  | run-log acknowledgedDecisions 非空且含 ≥1 关键决策摘要（非"确认"/"同意"） | 拒绝放行；要求用户填入理解证据（O4 命中） |
| **签名链完整性** | 每阶段每角色动作完成后写入 `signature-chain.jsonl`；G 跑门禁前校验 R1-R10 全通过；断裂视为 #32 命中拒绝放行 | `check-signature-chain.ts` R1-R10                                         | 补齐缺失角色签名与来源证明                |

> 第六维度「理解证据」吸收自 [cobusgreyling/loop-engineering](https://github.com/cobusgreyling/loop-engineering) `docs/concepts.md` 的 Comprehension Debt 概念，对抗用户对阶段产物 rubber-stamp。放行 ≠ 理解；acknowledgedDecisions 非空才算放行。

第六维度「理解证据」细化子项（6.1~6.3，由 `check-checkpoint.ts` 强制校验）：

- **6.1 acknowledgedDecisions 非空且含具体技术决策**：`acknowledgedDecisions` 数组须非空，且每条须为具体技术决策摘要（如「选用 JWT 而非 session」「数据模型增加 `deletedAt` 软删字段」），不得为「继续」「确认」「同意」「无意见」等泛化词——泛化词命中 `check-checkpoint.ts` R2 黑名单 → 视为 O4 命中，拒绝放行。
- **6.2 evidence 可追溯**：评审 `VerifierOutput` 的 `subCriteria[].evidence` 字段引用产物时须标注「路径+行号」（如 `docs/system-design.md#L42-L58`），不得仅引用文件名或泛指「见设计文档」；无行号定位 → `check-checkpoint.ts` 视为证据不可追溯，拒绝放行。
- **6.3 跨阶段证据一致性**：后阶段 `evidence` 不得否定前阶段已放行项——若阶段 N 评审 evidence 与阶段 N-1 已放行决策矛盾（如阶段 2 设计否定了阶段 1 已确认的 REQ 优先级），须显式回退修正前阶段产物并重跑，不得在后阶段静默推翻；`check-checkpoint.ts` 交叉比对历史 checkpoint 记录，发现矛盾未回退 → 拒绝放行。

DoD 与工件质量门的关系：

- DoD 是「日常标准」：每次 `/wm code` 或 `/wm test` 后自检，不通过则当场修复。
- 工件质量门是「验收门禁」：阶段 8 验收时执行 `check-artifact-gate.ts`，退出码 0 才放行。
- 二者不互替：DoD 通过不代表工件质量门通过；工件质量门通过要求 DoD 在全程被遵守。

### 10.7 图谱门禁（check-requirement-graph.ts）

> 阶段 1–4 ingestion 子流程的结构连通性门禁，与 §10.5 工件质量门（阶段 8 终检）互补。权威定义见 [`docs/ingestion-graph-convergence-design.md`](./ingestion-graph-convergence-design.md) §3；本节为摘要，与该设计文档双向追溯。
>
> 实现位置：[`w-model-dev/scripts/cli/check-requirement-graph.ts`](../w-model-dev/scripts/cli/check-requirement-graph.ts)（CLI）+ [`w-model-dev/scripts/logic/graph-logic.ts`](../w-model-dev/scripts/logic/graph-logic.ts)（校验纯逻辑，单点事实源）。
> 触发方：G 子代理在每轮 A-cross/A-evolve 产出 `consolidated.json` 后跑（编排者不跑，反模式 #10）。

**CLI 接口**：

```bash
# 退出码 0=通过 / 1=校验失败 / 2=输入错误；stdout 输出 JSON 证据摘要（与 check-verifier-output.ts 同构）
npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts "<graph.json or consolidated.json>" [--phase=1|2|3|4]
```

**校验算法**（确定性，无 LLM；设计文档 §3.2）：

1. **连通性**：从任一节点 BFS，`connectedComponents = 1` 才通过；否则记录 `isolatedNodes`。
2. **单根**：入边 `type=parent` 为 0 的节点数 `roots.length = 1` 才通过（边界节点 `EXT-IN`/`EXT-OUT` 豁免，不计入 `roots`）。
3. **父唯一性**：每个非根节点的 `parent` 入边数 = 1；`0` → `orphan`，`>1` → `multiParent`，均 fail。
4. **阶段递进追溯**（"门禁同步收敛"的核心）：
   - `phase ≥ 2`：每个 SD 节点出边 `implements ≥ 1`，否则 `SD_without_implements++`
   - `phase ≥ 3`：每个 INTF 节点入边 `defines ≥ 1`，否则 `INTF_without_defines++`
   - `phase ≥ 4`：每个 DD 节点出边 `realizes ≥ 1`，否则 `DD_without_realizes++`
5. **信息流校验**（与结构校验正交，详见 [`information-flow-validation-design.md`](./information-flow-validation-design.md)）：
   - 构建 `produces`/`consumes` 有向子图（方向=信息流方向，`to=n` 即流入 `n`，`from=n` 即流出 `n`）；
   - 对业务节点（`REQ`/`SD`/`INTF`/`DD`，`phase ≤ 当前`）统计 `inFlow`（`to=n` 的边数）/ `outFlow`（`from=n` 的边数）：
     - `in=0 ∧ out=0` → `deadModules`（死模块：无信息流经）
     - `in=0 ∧ out>0` → `miracles`（奇迹：只出不进，信息凭空产生）
     - `in>0 ∧ out=0` → `blackHoles`（黑洞：只进不出，信息消失）
   - 边界完整性（阶段 1 起）：`EXT-IN ≥ 1 ∧ EXT-OUT ≥ 1`，否则 `boundary.complete=false`。
6. **汇总**：`passed = (connectedComponents=1) ∧ (isolatedNodes=[]) ∧ (roots.length=1) ∧ (orphans=[]) ∧ (multiParent=[]) ∧ (所有追溯违反=0) ∧ dataflowOk`，其中 `dataflowOk = (blackHoles=[]) ∧ (miracles=[]) ∧ (deadModules=[]) ∧ boundary.complete`。

**收敛准则**（设计文档 §3.4）：`passed=true`（零违反）即收敛；`violations` 跨轮应单调递减，不降反升则分派 A 返工而非加轮；`round = MAX_GRAPH_ROUNDS(5)` 未收敛 → 🔴 CHECKPOINT 介入（展示 violations + reworkHints，用户决定补漏/强制接受标注/取消）。

**轮次上限校验（MAX_GRAPH_ROUNDS=5）**：`graph.json` 校验记录含必填 `round` 字段（schema 已必填），`check-requirement-graph.ts` 校验 `round > MAX_GRAPH_ROUNDS(5)` → 判为 violation（退出码 1）。常量 `MAX_GRAPH_ROUNDS = 5` 定义于 [`w-model-dev/scripts/lib/constants.ts`](../w-model-dev/scripts/lib/constants.ts)，为单点事实源，与收敛准则中的轮次上限保持一致。

**信息流跨阶段收敛**：阶段 1 REQ 信息流闭合（严格，与结构连通同级）；阶段 2/3/4 SD/INTF/DD 各自无黑洞/奇迹/死模块；阶段 4 信息流零违反 + 结构零违反才放行进编码。

**关键约束**：

- **阶段 4 硬约束**：`--phase=4` 信息流零违反 ∧ 结构零违反（DD `realizes` 全覆盖）才放行进阶段 5 编码（见 §4.4）。
- **收敛判定由 G 退出码决定，不由 A 的 LLM 输出决定**（约束 4，反模式 #12）；A 的 `reworkHints` 仅作指引。
- **ingestion 收敛确认 CHECKPOINT 不可绕过**（约束 2，反模式 #11）。
- 守护反模式 #11（ingestion 跳过图谱校验）/ #12（A 自评收敛），见 [`w-model-dev/references/hard-constraints.md`](../w-model-dev/references/hard-constraints.md)。

### 10.8 TLA+ 行为门禁（check-tla-model.ts）

> 阶段 1–4 TLA+ 层次化状态机建模的**行为正确性门禁**，与 §10.7 图谱门禁（结构层 + 信息流层）正交。权威定义见 [`docs/tla-plus-modeling-design.md`](./tla-plus-modeling-design.md) §3；本节为摘要，与该设计文档双向追溯。
>
> 实现位置：[`w-model-dev/scripts/cli/check-tla-model.ts`](../w-model-dev/scripts/cli/check-tla-model.ts)（CLI）+ [`w-model-dev/scripts/logic/tla-logic.ts`](../w-model-dev/scripts/logic/tla-logic.ts)（校验纯逻辑，单点事实源）。
> 触发方：G 子代理在 S 产出 `.tla` + `.cfg` + `tla-manifest.json` 后跑（编排者不跑，反模式 #10）。

**CLI 接口**：

```bash
# 退出码 0=通过 / 1=校验失败 / 2=输入错误；stdout 输出 TLA_JSON 证据摘要（与 check-requirement-graph.ts 同构）
npx tsx w-model-dev/scripts/cli/check-tla-model.ts "<tla-manifest.json>" [--phase=1|2|3|4|5|6|7|8] [--spec=<id>] [--graph=<graph.json>] [--keep-states]
```

> `--skip-tlc` 参数已移除：所有 TLA+ specs（L1/L2/L3/L4+）均须通过 SANY 语法检查 + TLC 模型检查，任何场景不得跳过 TLC。若 TLC 因状态爆炸无法完成，须走规格拆解（而非 skip），拆解决策须记录在 `tla-manifest.json` 的 `splitDecision` 字段。

**校验算法**（确定性，无 LLM；设计文档 §3.1）：

1. **环境就绪**：`java -version` ≥ 11（捕获 stderr，因 `java -version` 在退出码 0 时写 stderr）；L1 随技能包交付的 `w-model-dev/tools/tla2tools.jar` 存在且可由 manifest 路径加载。Java 缺失或版本不满足、或随包 JAR 缺失时，`environmentOk=false`，整体 `passed=false`，退出码 1。
2. **manifest 结构校验**：`version` / `currentPhase` / `tools` / `specs` 字段齐全；`tools.jarPath` / `tools.javaMinVersion` 合法。结构失败 → 退出码 2。
3. **规格字段校验**：每个 spec 的 `id` / `level` / `phase` / `system` / `requirementIds` / `designRef` / `tlaPath` / `cfgPath` / `parent` / `siblings` / `children` / `variableCombination` / `decompositionDecision` / `syntaxChecked` / `tlcChecked` / `deadlockFree` / `invariantsHold` / `stateExplosion` 字段齐全且类型合法。
4. **文件头校验**（每个 spec）：读取 `.tla` 文件内容，`parseTlaHeader()` 解析 8 个 `@` 字段，`validateHeader()` 比对 manifest 中 spec 声明——`@system` / `@requirement` / `@design` / `@parent` / `@sibling` / `@child` / `@level` / `@phase` 八字段须全部存在且与 manifest 一致（`null` ↔ `null` / 空数组；逗号列表集合须相等）。违反 → `headerViolations++`。
5. **层次一致性校验**（设计文档 §3.1 步骤 3）：`checkHierarchy()` 校验 parent/child 双向（A.parent=B ⇒ B.children 含 A；A.children 含 C ⇒ C.parent=A）+ sibling 双向（A.siblings 含 B ⇒ B.siblings 含 A）+ 有且仅有一个 L1 根（`parent=null ∧ level=L1`）+ 层级单调（子规格 `level` = 父规格 `level` + 1）。违反 → `hierarchyViolations++`。
6. **拆解决策校验**（设计文档 §3.1 步骤 4 / §1.1）：`checkDecomposition()` 校验 `variableCombination > MUST_SPLIT_THRESHOLD(10000)` 必须 `decompositionDecision='split-done'`，否则违反；`> CONSIDER_SPLIT_THRESHOLD(1000)` 且 `kept-below-threshold` 为警告（不导致失败）。违反 → `decompositionViolations++`。
7. **轨迹/状态文件清理**（设计文档 §3.4）：每个 spec 校验前删除 `*.dump` / `*.out` / `states/` 目录，避免旧轨迹污染本轮 TLC。实测 TLC 2.19 产物落在 `states/<YY-MM-DD-HH-MM-SS>/` 下（含 `<Module>.st` / `<Module>-0.st` 状态文件与 `<Module>_0.fp` / `<Module>_1.fp` 指纹文件），默认不产生 `.dump` / `.out`。
8. **SANY 语法检查**（设计文档 §3.1 步骤 6，硬约束顺序；cwd 置为 `.tla` 所在目录）：`java -cp <jarPath> tla2sany.SANY <spec>.tla`，捕获 stdout。实测退出码 **0=成功 / 11=语法错误**（输出走 stdout，含 `Fatal errors while parsing` 等错误消息）。语法失败 → `syntaxErrors++`，**跳过该 spec 的 TLC**（反模式 #14 守护），该 spec 标 `syntaxChecked=false`。
9. **TLC 模型检查**（仅 SANY 通过时，无 skip-tlc 选项；cwd 置为 `.tla` 所在目录）：`java -cp <jarPath> tlc2.TLC -nowarning -cleanup -config <spec>.cfg <moduleName>`，捕获 stdout。
   - `-nowarning`：抑制 GC 建议警告（输出更干净）。
   - `-cleanup`：TLC 自身在运行前清理 `states/` 目录（与步骤 7 互补，双保险）。
   - `<moduleName>` 为 `.tla` 文件名去后缀（如 `L1_blog_system.tla` → `L1_blog_system`），**非** `.tla` 路径。
   - 实测退出码 **0=成功 / 11=死锁 / 12=不变式违反**。解析结果：
     - `Error: Deadlock reached.` → `deadlockViolations++`，`deadlockFree=false`
     - `Error: Invariant <Inv> is violated.` → `invariantViolations++`，`invariantsHold=false`
     - `out of memory` / `states ... exceeds ... exceeded` / `too many` → `stateExplosionSpecs++`，`stateExplosion=true`
     - `Model checking completed. No error has been found.` → 通过
10. **汇总**：`passed = environmentOk ∧ (headerViolations=[]) ∧ (hierarchyViolations=[]) ∧ (decompositionViolations=[]) ∧ (syntaxErrors=[]) ∧ (deadlockViolations=[]) ∧ (invariantViolations=[]) ∧ (stateExplosionSpecs=[])`。

**收敛准则**（设计文档 §3.4）：`passed=true`（零违反）即收敛；`violations` 跨轮应单调递减；`round = MAX_ROUNDS(5)` 未收敛 → 🔴 CHECKPOINT 介入（展示 violations，用户决定修正 .tla / 修正需求或设计并回退重跑 / 强制接受标注 / 取消）。

**跨阶段收敛**（设计文档 §4，硬约束）：

| 阶段 | TLA+ 建模范围                                                                                                                                         | 强度                                                      |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | L1 系统内外交互抽象（单 L1 根规格）                                                                                                                   | 严格（SANY 通过 + TLC 通过 + 无死锁/不变式违反/状态爆炸） |
| 2    | + L2 子系统内部行为 + 同级交互抽象                                                                                                                    | 硬约束                                                    |
| 3    | + L3 原子化子系统行为抽象                                                                                                                             | 硬约束                                                    |
| 4    | + L4+ 递归拆解；`--phase=4` TLA+ 零违反 ∧ 图谱零违反才放行进阶段 5 编码                                                                               | **硬约束零违反**                                          |
| 5–8  | `tla-manifest.json` 冻结只读；TLA+ 不变式作为测试 oracle（编码与测试须与不变式一致）；阶段5 须通过 check-code-tla-consistency.ts 代码-TLA+ 一致性回归 | 冻结只读 + 一致性回归                                     |

**关键约束**：

- **阶段 4 硬约束**：`--phase=4` TLA+ 零违反 ∧ 图谱零违反（结构 + 信息流）才放行进阶段 5 编码（见 §4.4）。
- **编码调试顺序为硬约束**：SANY 语法检查未通过的 spec 不得跑 TLC（反模式 #14 守护）；CLI 在 SANY 失败时跳过该 spec 的 TLC。
- **轨迹/状态文件须先清理**：每轮校验前删除 `*.dump` / `*.out` / `states/`（设计文档 §3.4）；TLC 命令行 `-cleanup` 标志提供双保险。
- **TLA+ 不接受占位/简化/错误实现**（反模式 #16）：`.tla` 须为完整规格，不得用 `Skip` / `UNCHANGED` 等占位掩盖未建模行为。
- **TLA+ 建模须符合需求和设计**（反模式 #17）：若规格已符合需求/设计但 TLC 仍失败，须修正需求或对应级别设计并**回退重跑**，不得通过放宽不变式绕过。
- **收敛判定由 G 退出码决定，不由 S 的 LLM 输出决定**（约束 4，反模式 #12 同源）；S 的 `reworkHints` 仅作指引。
- **门禁确认 CHECKPOINT 不可绕过**（约束 2，反模式 #11 同源）。
- 守护反模式 #14（跳过 SANY 直接 TLC）/ #15（死锁/不变式违反放行）/ #16（占位/简化/错误实现）/ #17（建模不符需求/设计不回退），见 [`w-model-dev/references/hard-constraints.md`](../w-model-dev/references/hard-constraints.md)。

**追加行为门禁校验项**（在上述校验算法 1~10 之外，`check-tla-model.ts` 须额外强制；任一违反 → exitCode=1）：

- **SD 覆盖率**：每个 SD 节点（graph.json 中 `type=SD`）须被至少一个 TLA+ spec 覆盖——即 `tla-manifest.json.specs[]` 中存在某 spec 的 `requirementIds` 或 `designRef` 引用该 SD 节点（或其所属 REQ/INTF）；存在未被任何 spec 覆盖的 SD 节点 → `sdCoverageViolation`，exitCode=1。
- **cfg-tla 一致性**：每个 `.cfg` 文件的 `INVARIANTS`（`INVARIANT` 行声明的不变式名集合）须与对应 `.tla` 文件中 `BusinessInvariant` 集合（`THEOREM`/`ASSUME`/显式不变式定义）一致——`INVARIANTS` 多于 `.tla` 定义（引用了不存在的不变式）或少于 `.tla` 定义（遗漏校验）均 → `cfgTlaMismatch`，exitCode=1。
- **cfg 结构**：`.cfg` 文件禁止含 `MODULE` 声明（`MODULE` 属 `.tla` 头部，混入 `.cfg` 会触发 TLC 解析错误）；`INVARIANT` 行格式须合法（`INVARIANT <Name>`，`<Name>` 为合法 TLA+ 标识符，禁止空值/表达式/注释尾随）——违反 → `cfgStructureViolation`，exitCode=1。
- **代码状态转移一致性**（check-code-tla-consistency.ts 维度3）：代码状态转移须与 TLA+ `Next` 分支对应——违反 → exitCode=1。
- **代码断言覆盖不变式**（check-code-tla-consistency.ts 维度4）：代码断言须覆盖 TLA+ 不变式——违反 → exitCode=1。
- **SD-codeModule 对应**（check-code-tla-consistency.ts 维度1 + check-artifact-gate.ts 终检）：每个 SD 子系统须有对应 codeModule——违反 → exitCode=1。

### 10.8.1 代码-TLA+ 一致性回归（check-code-tla-consistency.ts）

> 阶段 5（编码）的**代码与 TLA+ 规格一致性回归门禁**，将 TLA+ 资产作为状态机验证器回归编码产物。与 §10.8 TLA+ 行为门禁（阶段 1-4）互补：行为门禁校验 TLA+ 规格自身正确性，一致性回归校验代码是否符合 TLA+ 规格。
>
> 实现位置：[`w-model-dev/scripts/cli/check-code-tla-consistency.ts`](../w-model-dev/scripts/cli/check-code-tla-consistency.ts)（CLI）+ [`w-model-dev/scripts/logic/code-tla-logic.ts`](../w-model-dev/scripts/logic/code-tla-logic.ts)（校验纯逻辑，单点事实源）。
> 触发方：G 子代理在 S 产出代码后跑（编排者不跑，反模式 #10）。

**CLI 接口**：

```bash
# 退出码 0=通过 / 1=校验失败；stdout 输出 CODE_TLA_JSON 证据摘要
npx tsx w-model-dev/scripts/cli/check-code-tla-consistency.ts \
  --manifest=<tla-manifest.json> \
  --graph=<graph.json> \
  --rtm=<rtm.json> \
  --src=<src-dir>
```

**四维度校验算法**（确定性，无 LLM；使用 TypeScript Compiler API 解析 AST）：

1. **维度1：SD→codeModule 映射完整性**（`checkSdToCodeModule`）：读取 `graph.json` 中所有 `type=SD` 节点，核验 `rtm.json` 中每个 SD 节点均有对应 `codeModule` 映射（多段匹配：SD id 分段后任一段长度≥2 出现在 codeModule 路径中）。违反 → `sdToCodeModule` 维度失败。
2. **维度2：代码状态转移抽取**（`extractCodeStateTransfers` + `checkCodeStateTransfer`）：用 `ts.createSourceFile` 解析 `src/` 下所有 `.ts` 文件 AST，抽取 `BinaryExpression(=)` 赋值语句与 `IfStatement` / `SwitchStatement` 条件分支；无赋值则维度失败（代码无状态转移）。
3. **维度3：Next 分支对应**（`checkNextBranchCoverage`）：正则抽取 TLA+ `Next` 分支动作名，驼峰匹配代码方法名（如 `Logout` → `logout`，`StartNewArticle` → `startNewArticle`）；每个 Next 分支须有对应代码方法。违反 → `nextBranchCoverage` 维度失败。
4. **维度4：断言覆盖不变式**（`checkInvariantCoverage`）：抽取 `.tla` 文件 `BusinessInvariant` 子不变式名，匹配代码中 `assert` / `invariant` / `require` 调用；宽松策略——有断言即认为覆盖。违反 → `invariantCoverage` 维度失败。
5. **汇总**：`passed = 维度1.passed ∧ 维度2.passed ∧ 维度3.passed ∧ 维度4.passed`。

**触发时机**：阶段 5（编码）S 产出代码后，G 子代理额外分派跑 `check-code-tla-consistency.ts`，退出码 0 才放行进阶段 6（集成测试）。阶段 5-8 `tla-manifest.json` 冻结只读，TLA+ 不变式作为测试 oracle。

**与其它门禁的协同**：

- 维度1 与 `check-artifact-gate.ts` 终检的 SD→codeModule 校验双向守护（两处均校验，任一失败即阻断）。
- 维度2/3/4 是 `check-code-tla-consistency.ts` 独有，补充行为层一致性校验。
- `self-test.ts` 含 5 条 code-TLA+ 样本（3 合规 + 2 违规），纳入回归基线。

### 10.9 根因报告门禁（check-rootcause-report.ts）

> 返工循环中 R 子代理产出的 `RootCauseReport` 校验门禁，与 §10.5 工件质量门（阶段 8 终检）/ §10.7 图谱门禁 / §10.8 TLA+ 行为门禁互补：前三者校验阶段产物，本节校验返工路径的根因报告。权威定义见 [根因定位者设计 spec](./superpowers/specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md) §4 RootCauseReport Schema 与 R1-R10 校验规则。
>
> 实现位置：[`w-model-dev/scripts/cli/check-rootcause-report.ts`](../w-model-dev/scripts/cli/check-rootcause-report.ts)（CLI）+ 校验纯逻辑（单点事实源，与 `check-verifier-output.ts` 平级）。
> 触发方：G 子代理在 V 复审根因报告（`targetKind=rootcause`）通过后跑（编排者不跑，反模式 #10）。

**CLI 接口**：

```bash
# 退出码 0=通过 / 1=校验失败 / 2=输入错误；stdout 输出 ROOTCAUSE_JSON 证据摘要（与 check-verifier-output.ts 同构）
npx tsx w-model-dev/scripts/cli/check-rootcause-report.ts "<rootcause-report.json>"
```

**校验规则（R1-R10，确定性，无 LLM）**：

| 规则 | 校验内容                                                                                                                                                                                                                | 失败动作 |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1   | Schema 完整性：所有必填字段非空                                                                                                                                                                                         | 退出码 1 |
| R2   | `rootCauseChain` 长度 ∈ [2, 5]，每步 `evidence` 非空                                                                                                                                                                    | 退出码 1 |
| R3   | `rootCause.falsifiabilityCheck` 非空且含假设句式（「若...则...」）                                                                                                                                                      | 退出码 1 |
| R4   | `fixRecommendation` 每条含 `target`/`location`/`action`/`rationale` 四字段                                                                                                                                              | 退出码 1 |
| R5   | `prevention` 每条含 `scope`/`measure`/`owner` 三字段                                                                                                                                                                    | 退出码 1 |
| R6   | `upstreamDefect.present=true` 时，`upstreamPhase`/`upstreamArtifactId`/`defectDescription` 非空                                                                                                                         | 退出码 1 |
| R7   | `qualityLevel ∈ {A,B,C,D}`，`passed` 与 `qualityLevel` 一致（A/B→true，C/D→false）                                                                                                                                      | 退出码 1 |
| R8   | `meta.reportId` 格式 `^RC-[a-z0-9]+-\d+-\d+$`                                                                                                                                                                           | 退出码 1 |
| R9   | 多角度场景（dispatchMode ∈ {parallel, serial, degraded}）：附录 PartialReport 路径非空                                                                                                                                  | 退出码 1 |
| R10  | 多角度场景：canonical `testing-reality-checker` persona 的 confidence ≥ 0.5；legacy `reality-checker` 仅在 canonical 缺失时作 fallback。canonical 优先，同 artifact 不重复计数；跨 artifact 或异常重复/冲突 fail-closed | 退出码 1 |

R10 维护契约（docs-consistency source×clause 语义门）：
<r10-contract id="canonical-name" relation='{"canonicalPersona":"testing-reality-checker"}'>canonical persona is testing-reality-checker</r10-contract>
<r10-contract id="threshold" relation='{"canonicalPersona":"testing-reality-checker","confidenceMinimum":0.5}'>testing-reality-checker confidence >= 0.5</r10-contract>
<r10-contract id="legacy-fallback" relation='{"legacyPersona":"reality-checker","fallbackWhen":"canonical-absent"}'>legacy reality-checker is fallback only when canonical is absent</r10-contract>
<r10-contract id="same-artifact-dedupe" relation='{"artifactRelation":"same","precedence":"canonical-first","duplicateCount":"once"}'>same artifact canonical-first and not counted twice</r10-contract>
<r10-contract id="cross-artifact-conflict" relation='{"artifactRelation":"different","conflict":"fail-closed"}'>different artifact conflict is fail-closed</r10-contract>
<r10-contract id="canonical-duplicate" relation='{"persona":"canonical","duplicateThreshold":1,"duplicatePolicy":"fail-closed"}'>canonical > 1 duplicate is fail-closed</r10-contract>
<r10-contract id="legacy-duplicate" relation='{"persona":"legacy","duplicateThreshold":1,"duplicatePolicy":"fail-closed"}'>legacy > 1 duplicate is fail-closed</r10-contract>

**退出码**：`0=通过 / 1=校验失败 / 2=输入错误`（与现有脚本约定一致）。

**关键约束**：

- **G 子代理在 V 复审根因报告后跑此脚本，exitCode=0 才可分派 S-fix 修复**（反模式 #19 守护：R 报告未经 V 复审 + G 门禁直接交 S 修复）。
- **校验纯逻辑，不含 LLM 调用**（约束 4 真实执行）；R 的 `qualityLevel`/`passed` 自评仅作指引，最终由 G 退出码 + V 复审决定。
- **门禁确认 CHECKPOINT 不可绕过**（约束 2，反模式 #11 同源）。
- 守护反模式 #18（跳过 R 直接 S 返工）/ #19（R 报告未 V 复审直接 S 修复），见 [`w-model-dev/references/hard-constraints.md`](../w-model-dev/references/hard-constraints.md) + §4A.2b。

---

## 10C. 自主成熟度阶梯（L0~L3）

> 吸收自 [cobusgreyling/loop-engineering](https://github.com/cobusgreyling/loop-engineering) `docs/loop-design-checklist.md` 的 L0~L3 成熟度阶梯，适配 W 模型语境。
> 与 §10D 成本预算与运行日志互补：成熟度决定 CHECKPOINT 放行策略，成本预算决定何时暂停。
> 实现位置：[`w-model-dev/references/operational-recovery.md`](../w-model-dev/references/operational-recovery.md)「成熟度与 CHECKPOINT 放行」节 + [`w-model-dev/references/data-models.md`](../w-model-dev/references/data-models.md)（maturity schema）。
> 设计依据：[`docs/loop-engineering-adoption-design.md`](./loop-engineering-adoption-design.md) §2。

### 10C.1 设计动机

当前每个 🔴 CHECKPOINT 都等用户，等于强制最高介入度（L0）。大项目/成熟团队无法"毕业"，CHECKPOINT 密度成为瓶颈。loop-engineering 的 L0~L3 阶梯按成熟度选择性激活 CHECKPOINT，使团队可渐进到低介入度。

**关键约束**：不违反约束 2（CHECKPOINT 不可绕过）——L3 仍保留高风险路径人工 gate，只是低风险 CHECKPOINT 自动放行。

### 10C.2 CHECKPOINT 分类

现有 🔴 CHECKPOINT 分为两类，按成熟度选择性激活：

| CHECKPOINT 类型                              | 示例                                                                                      | L0        | L1          | L2          | L3                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- | --------- | ----------- | ----------- | --------------------------- |
| **决策型**（设计方向/技术选型/范围变更）     | 项目初始化、阶段进入确认、设计选型、ingestion 规划确认                                    | ✅ 等用户 | ✅ 等用户   | ✅ 等用户   | ✅ 等用户（高风险路径强制） |
| **操作型**（已跑脚本/已执行测试/已产出产物） | 阶段门放行（V 评审通过 + G 退出码 0）、ingestion 收敛确认（G 退出码 0）、测试结果回填确认 | ✅ 等用户 | ⚡ 自动放行 | ⚡ 自动放行 | ⚡ 自动放行                 |

> 「决策型」始终等用户（L3 亦然）——设计方向不可自动决定。「操作型」在 L1+ 可自动放行——已有脚本退出码作为客观证据，人工确认是冗余。

### 10C.3 L0~L3 放行矩阵

| 级别                           | 决策型 CHECKPOINT                                  | 操作型 CHECKPOINT                                | 返工循环                                                           | 发布门                           | 解锁条件                                                                      |
| ------------------------------ | -------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------- | ----------------------------------------------------------------------------- |
| **L0（默认，新项目/棕地）**    | ✅ 等用户                                          | ✅ 等用户                                        | ✅ 每次返工都暂停询问                                              | ✅ 等用户                        | 项目初始化即默认 L0                                                           |
| **L1（操作确认自动化）**       | ✅ 等用户                                          | ⚡ 自动放行（脚本退出码=0 即放行，run-log 记录） | ✅ 每次返工都暂停询问                                              | ✅ 等用户                        | L0 稳定运行 ≥1 个完整 8 阶段周期，无 O 系列失败模式命中                       |
| **L2（返工自主化）**           | ✅ 等用户                                          | ⚡ 自动放行                                      | ⚡ 阶段 5-7 返工可自主（带 attempt cap=maxReworkRounds，超限升级） | ✅ 等用户                        | L1 稳定运行 ≥2 周，attempt cap 达标率 ≥80%，无 Token Burn/O3 Verifier Theater |
| **L3（高风险路径外的全自主）** | ✅ 等用户（仅高风险路径：auth/加密/发布/架构变更） | ⚡ 自动放行                                      | ⚡ 全阶段返工可自主（带 attempt cap）                              | ✅ 等用户（发布门始终 attended） | L2 稳定运行 ≥2 周，误判率 ≤10%，用户显式申请升级                              |

> **L2+ 事件驱动激活**：成熟度达 L2 后，事件驱动循环（Loop 3，详见 §10F）激活。消费方自行实现触发器写入 `event-ingress.jsonl`，编排者 O 按事件类型路由到单阶段（非完整 8 阶段）。L0/L1 不支持事件驱动。

> **全面禁止代签**：任何场景（含技能包内部 dogfooding）均须真实用户确认。编排者 O 不得代替用户在 🔴 CHECKPOINT 处签字放行。`acknowledgedDecisions` 须由用户陈述，O 不得代填（违反反模式 #10）。即使 L3 自动放行路径，CHECKPOINT 节点仍须真实用户确认（仅降低其他门禁的强制程度，不降低用户确认）。签名链 R5 校验 O checkpoint 签名 signer 须为用户 ID（非 O 角色）。

### 10C.4 L3 高风险路径定义（强制人工 gate，不可自动放行）

| 高风险路径                           | 触发条件                                                  | 强制动作                                        |
| ------------------------------------ | --------------------------------------------------------- | ----------------------------------------------- |
| 认证/授权相关                        | 阶段 4 详细设计涉及 auth 模块 / 阶段 5 编码涉及 auth 文件 | 决策型 CHECKPOINT 等用户                        |
| 加密/密钥相关                        | 涉及 JWT_SECRET / 密码哈希 / 加密算法选型                 | 决策型 CHECKPOINT 等用户                        |
| 发布放行                             | 阶段 8 验收终检 + check-artifact-gate.ts                  | 始终 attended（L3 亦然）                        |
| 架构变更                             | 技术栈增删 / 模块边界变更 / 数据模型 schema 变更          | 决策型 CHECKPOINT 等用户                        |
| TLA+ 建模不符需求/设计（反模式 #17） | TLC 发现违反且规格忠实于需求/设计                         | 决策型 CHECKPOINT 等用户（须回退修正需求/设计） |

### 10C.5 maturity.json Schema

> 编排者 O 在项目初始化（`/wm analyze` 首次）时创建，类比 `project.json`/`rtm.json`/`budget.json`。schema 权威定义见 [`data-models.md`](../w-model-dev/references/data-models.md)。

```typescript
interface MaturityConfig {
  schemaVersion: '1.0';
  projectId: string;
  level: 'L0' | 'L1' | 'L2' | 'L3';
  leveledUpAt: string;
  unlockConditions: {
    stableDays: number;
    completedCycles: number;
    attemptCapRate: number;
    misjudgeRate: number;
    operationalFailures: number;
  };
  history: Array<{ from: string; to: string; at: string; reason: string }>;
  downgradeTriggers: {
    operationalFailureStreak: number;
    userRequested: boolean;
  };
}
```

### 10C.6 编排者成熟度判定逻辑（确定性，无 LLM）

编排者 O 在每个 🔴 CHECKPOINT 处读取 maturity.json，按当前 level 决定 CHECKPOINT 类型：

1. 读取 maturity.json.level
2. 识别当前 CHECKPOINT 类型（决策型 / 操作型）
3. 查 L0~L3 放行矩阵：✅ 等用户 → 执行 CHECKPOINT 暂停；⚡ 自动放行 → 跳过暂停，run-log append 记录
4. 检查高风险路径（仅 L3）：命中高风险路径表 → 即使 L3 也强制决策型 CHECKPOINT
5. 升级判定（每次阶段 8 完成后）：汇总 unlockConditions，若全部达标 → 询问用户是否升级（决策型 CHECKPOINT，不可自动升级）
6. 降级判定（每次 O 系列失败模式命中后）：若 operationalFailures ≥ downgradeTriggers.operationalFailureStreak → 自动降级到 L0

**关键约束**：

- **L1+ 自动放行是操作型 CHECKPOINT 的选择性激活，非绕过**（约束 2）：自动放行仍在 run-log 记录 action=checkpoint outcome=success，保留可追溯性。
- **决策型 CHECKPOINT 在所有级别均等用户**：设计方向不可自动决定。
- **升级不可自动**：升级是决策型 CHECKPOINT，须用户显式确认。
- **降级可自动**：O 系列失败模式连续命中触发自动降级回 L0。

### 10C.7 阶段完成计数与强制校验（check-maturity.ts）

> 本节确立阶段完成计数的强制校验。
> 实现位置：[`w-model-dev/scripts/cli/check-maturity.ts`](../w-model-dev/scripts/cli/check-maturity.ts)（CLI 校验，确定性无 LLM）。

- **阶段完成计数强制递增**：项目每完成一阶段（run-log.jsonl 追加 `action=checkpoint` 且 `outcome=success` 记录后），编排者 O 须将 `maturity.json.unlockConditions.completedCycles` +1；漏更 → 计数滞后。
- **check-maturity.ts 强制校验**：`check-maturity.ts` 须交叉校验 `maturity.json.unlockConditions.completedCycles` 与 run-log.jsonl 中 `action=checkpoint ∧ outcome=success` 记录数——`completedCycles < 实际 checkpoint success 数` 即滞后 → 退出码 1。
- **滞后即不放行**：校验发现计数滞后时，编排者 O 不得放行当前阶段门（反模式 #9 谎报状态守护）；须先补更 `completedCycles` 再重跑校验至退出码 0。

---

## 10D. 成本预算与运行日志

> 吸收自 [cobusgreyling/loop-engineering](https://github.com/cobusgreyling/loop-engineering) `docs/operating-loops.md` 的 loop-budget + loop-run-log + kill switch 概念，适配 W 模型语境。
> 与 §10C 成熟度阶梯互补：成本预算决定何时暂停，成熟度决定 CHECKPOINT 放行策略。
> 实现位置：[`w-model-dev/references/operational-recovery.md`](../w-model-dev/references/operational-recovery.md)「成本预算与运行日志」节 + [`w-model-dev/references/data-models.md`](../w-model-dev/references/data-models.md)（budget / run-log schema）。
> 设计依据：[`docs/loop-engineering-adoption-design.md`](./loop-engineering-adoption-design.md) §1。

### 10D.1 设计动机

一次 W 模型 8 阶段全跑 = 多子代理 × 8 阶段 + ingestion 收敛轮 + TLA+ 建模，成本可观且完全不可见。`operational-recovery.md` 只覆盖异常恢复（JSON 损坏/并发写入/技术栈漂移），不覆盖成本预算与 kill switch。

**关键取舍**：不引入 LLM 估算 token（避免约束 4 同源风险）。tokensEstimate 由宿主 Agent 报告实际消耗，技能只做声明 + 暂停判定。

### 10D.2 budget.json Schema

> 编排者 O 在项目初始化（`/wm analyze` 首次）时创建。用户可在任意时刻编辑调整。schema 权威定义见 [`data-models.md`](../w-model-dev/references/data-models.md)。

```typescript
interface BudgetConfig {
  schemaVersion: '1.0';
  projectId: string;
  createdAt: string;
  updatedAt: string;
  perPhase: {
    maxTokens: number;
    maxSubagentSpawns: number;
    maxReworkRounds: number;
  };
  project: {
    maxTokensTotal: number;
    maxTokensPerSession: number;
  };
  onExceed: 'pause' | 'notify' | 'halt';
  killSwitch: {
    consecutiveReworks: number;
    budgetBurnRate: number;
    tlaReworks: number;
  };
}
```

- `onExceed=pause`：暂停后续子代理分派，🔴 CHECKPOINT · 预算告警，等用户决定（增预算/降范围/取消）
- `onExceed=notify`：仅在 run-log 记录告警，继续执行（适合 L2+ 自主度）
- `onExceed=halt`：立即停止当前阶段推进，回退到阶段起点（最保守，L0 默认）

### 10D.3 run-log.jsonl Schema

> Append-only JSON Lines 格式，每行一条记录。编排者 O 在每个子代理分派返回后与每个阶段门/质量门完成后 append 一条。

```typescript
interface RunLogEntry {
  runId: string;
  timestamp: string;
  phase: number;
  phaseName: string;
  action:
    | 'chunk'
    | 'cross'
    | 'evolve'
    | 'produce'
    | 'review'
    | 'gate'
    | 'tla-gate'
    | 'graph-gate'
    | 'test'
    | 'checkpoint'
    | 'rework'
    | 'rollback'
    | 'rootcause'
    | 'fix'
    | 'emergency-fix'
    | 'r3-completeness'
    | 'r3-reliability'
    | 'r3-security'
    | 'codegraph_query'
    | 'opsx_explore'
    | 'opsx_propose'
    | 'opsx_apply'
    | 'opsx_archive'
    | 'ensure_deps'
    | 'iceberg-sweep'
    | 'iceberg-review';
  role: 'O' | 'A' | 'S' | 'V' | 'G' | 'R';
  duration_s: number;
  tokens: number; // 由宿主 Agent 报告实际消耗；无值时填 0 并标注 estimated:false
  estimated: boolean; // true=LLM估算（违反约束4，应避免）；false=实际报告
  subagentSpawns: number;
  gateExitCode: number | null;
  outcome: 'success' | 'fail' | 'rework' | 'escalate' | 'blocked' | 'cancelled';
  acknowledgedDecisions?: string[]; // 阶段门放行时用户填写的理解证据（§10.6 第六维度）
  note?: string;
  artifacts?: string[];
  reportId?: string;
  basedOnReport?: string;
  targetKind?: string;
  target?: string;
  round?: number;
  implementationTarget?: string;
  variant?: 'fix' | 'emergency-fix'; // fix=S-fix 返工变体；emergency-fix=紧急修复通道（2026-09-04 起 schema 强制约束见下）
  blocker?: string; // emergency-fix 的阻塞原因（"为何走紧急通道"审计说明，不意味跳过 R3+V+G 审查）
  fixedLocation?: string; // fix/emergency-fix 修复位置（文件/区域），审计用
  fixBasedOn?: string; // fix/emergency-fix 修复依据（S-self-assessment 或 R 报告 ID），审计用
  lifecycleStatus?: 'CLOSED_UNDER_CURRENT_RULES' | 'NOT_CLOSED_NOT_PROVEN';
}
```

**D8 lifecycle identity contract（phase 8）：** `check-run-log.ts` 按完整 `(phase, round, reportId, targetKind, basedOnReport, implementationTarget)` 关联 lifecycle segment。rootcause R/V/G 仅相互关联同一 reportId/round/targetKind；fix、emergency-fix、implementation V/G/R3 必须显式声明并 exact 对齐 `target===implementationTarget`，且 fix/R3/V/G artifacts 包含 exact target；rootcause review 不计入 implementation V，也不满足 R3。R3 仅在同身份 `S-fix → R3 completeness/reliability/security → implementation V` 窗口计数，R8 在 segment 内校验，禁止 phase/round bucket 或 phase-wide 首索引。缺字段输出 `LEGACY_UNSCOPED`/deferred diagnostics，legacy 证据不进入 credit；生命周期机器状态统一为 `CLOSED_UNDER_CURRENT_RULES` 或 `NOT_CLOSED_NOT_PROVEN`，exit 0 仍不单独证明 closed。诊断不会修改 append-only raw JSONL。

**variant / blocker 与坏行语义（2026-09-04 audit-gate-closure，schema 强制）**：`action=emergency-fix` 强制 `variant=emergency-fix` 且 `blocker` 非空（`variant=emergency-fix` 同样强制 `blocker`）；`action=fix` 的 `variant` **可选**——出现则必须为 `"fix"`（向后兼容 variant 规则引入前的 fix 记录）。缺 identity 字段的历史行（含双 legacy：同时缺 identity 与 variant/blocker 的旧 emergency-fix 行，经合并 legacy 谓词吸收）走 `LEGACY_VARIANT` / `LEGACY_UNSCOPED` **非阻断** diagnostic；已声明 `variant` 却缺 `blocker`、或 variant 值不符 const，属真实不一致 → blocking `[schema]`（吸收不覆盖）。`check-run-log.ts` 的 parseErrors 从纯 diagnostics **并入 blocking violations**：run-log 为空、空白、malformed-only 或 valid+malformed 一律 exit 1（坏行使输入不完整、可能丢失证据，fail-closed），消息保留 `PARSE_INCOMPLETE` 前缀；`checkRunLog([])` 返回 `passed=false` + `NOT_CLOSED_NOT_PROVEN`。action-role 配对由 logic 层 blocking 强制：`r3-*`→R、`fix`/`emergency-fix`/`produce`→S、`review`→V、`gate`/`tla-gate`/`graph-gate`→G。`preventive-review.schema.json` 同步新增条件约束：`passed=false ⇒ findings ≥1`（schema 强制 `findings.minItems=1`，防止无发现的失败审查被空 findings 掩盖）。

### 10D.4 编排者维护职责（O 角色扩展，不改 S/V/G 边界）

> 在 §3.4.5「编排者允许的动作」新增「预算与日志维护」项，与现有「读 .w-model/*.json」「跑只读脚本看退出码」并列。仍属"状态读写+持久化"允许动作，非实施。

| 时机                             | O 的动作                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| 项目初始化（`/wm analyze` 首次） | 创建 `.w-model/budget.json`（默认值）+ 创建空 `.w-model/run-log.jsonl`                          |
| 每次子代理分派返回后             | append 一条 RunLogEntry（action 对应角色动作）                                                  |
| 每个门禁脚本执行后               | append 一条 RunLogEntry（gateExitCode 填实际退出码）                                            |
| 每个 🔴 CHECKPOINT 放行后        | append 一条 RunLogEntry（action=checkpoint，acknowledgedDecisions 填用户输入）                  |
| 每次返工/回退后                  | append 一条 RunLogEntry（action=rework/rollback，note 填原因）                                  |
| 预算检查点（每阶段门后）         | 读 budget.json + 累计本阶段 run-log tokens，若超 maxTokens 或触发 killSwitch → 按 onExceed 处置 |

### 10D.5 预算检查逻辑（确定性，无 LLM）

编排者 O 在阶段门放行前执行：

1. 读取 budget.json
2. 汇总 run-log.jsonl 中本阶段（phase=N）所有记录的 tokens 总和 = phaseTokensUsed
3. 汇总 run-log.jsonl 中本阶段 subagentSpawns 总和 = phaseSpawns
4. 汇总 run-log.jsonl 中全项目 tokens 总和 = projectTokensUsed
5. 判定：超 maxTokens / maxSubagentSpawns / maxTokensTotal → 触发告警；killSwitch 任一条件满足 → 触发 kill switch
6. 按 onExceed 处置：pause（🔴 CHECKPOINT）/ notify（run-log 记录）/ halt（回退阶段起点）

### 10D.6 关键约束

- **不引入 LLM 估算**（约束 4）：tokensEstimate 由宿主 Agent 报告实际消耗（estimated=false）；estimated=true 违反约束4，应避免。
- **预算检查不替代门禁脚本**（反模式 #3/#6）：预算超限触发的是暂停/告警，不是放行/否决；放行仍由 G 子代理退出码决定。
- **kill switch 是暂停不是终止**：触发 kill switch 后须 🔴 CHECKPOINT 展示消耗明细，由用户决定增预算/降范围/取消。
- **run-log 是 append-only**：不得修改历史记录；运行时读取可跳过损坏行并记录 note，但门禁对空/坏行 **fail-closed**（见 §10D.8），不得把坏行静默当作证据缺失放行。

### 10D.7 预算与运行日志强制校验项（check-budget.ts / check-run-log.ts）

> 本节确立强制校验项。
> 实现位置：[`w-model-dev/scripts/cli/check-budget.ts`](../w-model-dev/scripts/cli/check-budget.ts) + [`w-model-dev/scripts/cli/check-run-log.ts`](../w-model-dev/scripts/cli/check-run-log.ts)（CLI 校验，确定性无 LLM）。

- **预算更新时戳**：每个阶段门放行前，`budget.json.updatedAt` 须更新为当前时间戳（证明预算检查已执行，非沿用历史值）；未更新 → `check-budget.ts` 退出码 1。
- **killSwitch 告警**：killSwitch 任一触发条件满足（`consecutiveReworks` / `budgetBurnRate` / `tlaReworks`）时须产出告警（run-log 记录 + 🔴 CHECKPOINT 展示消耗明细），不得静默；`check-budget.ts` 校验 killSwitch 触发但 run-log 无对应告警记录 → 退出码 1。
- **运行日志 4 类动作完备**：每个阶段 run-log.jsonl 须含 `chunk` / `cross` / `gate` / `checkpoint` 4 类动作记录（阶段 1–4 ingestion 含 `chunk`/`cross`；所有阶段含 `gate`/`checkpoint`）；缺类 → `check-run-log.ts` 退出码 1。
- **返工须有 rework 记录**：任一返工发生后，run-log 须追加 `action=rework` 记录（`note` 填原因）；返工发生但无 `rework` 记录 → `check-run-log.ts` 退出码 1。
- **R8 相对顺序约束（同生命周期段内动作链序）**：`check-run-log.ts` 对 phase 8 按 identity segment 校验 **S-fix → R3×3 → implementation V → implementation G → checkpoint**，rootcause R/V/G 不混入实现链；legacy 缺身份记录输出 `LEGACY_UNSCOPED`/deferred，不用 phase-wide 首索引、最近记录或集合数量补齐。其他阶段保留兼容的阶段级轨迹校验。真实顺序缺失仍返回退出码 1。
- **编排质量指标（orchestrationQuality，只读统计，不加门禁）**：`metrics-report.ts` 在 7 区度量基础上新增 `orchestration` 子区，统计编排质量信号——`r3`（R3 预防性审查套数 / 维度分布 / findings 严重度分布，数据源 `.w-model/preventive-reviews/`）、`iceberg`（冰山扫掠轮次分布 / 新发现计数 / 严重度分布，数据源 `.w-model/iceberg/`）、`reworkHints`（V 审查返工提示密度，数据源 run-log 本身）。`r3`/`iceberg` 数据源缺失时对应子区为 `null`（不告警、不阻断）；该指标仅供汇报与诊断，不参与任何门禁放行判定。
- **强制校验脚本**：`check-budget.ts`（预算更新时戳 + killSwitch 告警）与 `check-run-log.ts`（4 类动作 + rework 记录 + §10E 交叉校验）须在每个阶段门由 G 子代理执行；任一退出码 ≠ 0 → O 不得放行（反模式 #3/#6/#9 守护）。

### 10D.8 R3 证明路径矩阵与角色分派精确语义（2026-09-04 audit-gate-closure）

**R3 三种证明路径**（互为替代的合法证明形态；同一 change 内不得混用两套路径冒充一份证明）：

| 路径                                           | 适用场景                                               | 证明载体                                                                                                                                                                  | 门禁守护                                                                               |
| ---------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| standard（阶段级）                             | 常规 S 产出（produce / 各阶段产物）                    | 该阶段 run-log 含 role=R + outcome=success 的 `r3-completeness`/`r3-reliability`/`r3-security` 各 ≥1 条（每条维度唯一，重复维度不充数）+ 三份 preventive-review JSON 齐备 | `check-role-dispatch.ts`（三维度缺口即 fail）+ `check-preventive-review.ts`            |
| fix / emergency-fix（run-log identity window） | S-fix 返工 / 紧急修复通道                              | run-log 同身份窗口内（`S-fix → R3×3 → implementation V/G`，§10D.3 D8）role=R 三维度各 ≥1 条 success + 对应 variant（fix / emergency-fix）的 preventive-review JSON        | `check-run-log.ts` R8 段内校验 + `check-preventive-review.ts --variant=fix\|emergency` |
| opsx stage（9+3 文件）                         | opsx 三段式（explore/propose/coding）项目级 stage 审查 | `.w-model/r3-reviews/phase<N>-<stage>-{completeness,reliability,security}.md` 9 份 + `.w-model/v-reviews/phase<N>-<stage>.md` 3 份                                        | `check-opsx-artifacts.ts`（strict 绑定 changeId 时一并校验）                           |

**role-dispatch 精确语义**（`check-role-dispatch.ts` / `role-dispatch-logic.ts`）：

- **fail-closed**：run-log 为空或解析后无任何可校验阶段（全 invalid）→ blocking violation（无记录不是"完整"）；不再把空输入误判为通过。
- **R3 只计有效记录**：`role=R` + `outcome=success` + `action ∈ {r3-completeness, r3-reliability, r3-security}`；rootcause / iceberg-sweep / outcome≠success 一律不计入，杜绝重复维度或非 R3 动作充数；每 phase 三维度各 ≥1 即满足（已有维度多条不报错）。
- 结果含 `r3Missing`（每 phase 缺失维度明细，人类可读输出逐阶段列出）；`--r3-enabled` 仍为 no-op 向后兼容。

---

## 10E. 门禁退出码不可伪（gate-logs 存档与交叉校验）

> 本节确立退出码不可伪的三层防线。
> 实现位置：各 `w-model-dev/scripts/cli/check-*.ts`（exitCode 字段）+ G 子代理存档职责 + [`w-model-dev/scripts/cli/check-run-log.ts`](../w-model-dev/scripts/cli/check-run-log.ts)（交叉校验 CLI，确定性无 LLM）。

**强制校验项**（E.1~E.4，任一层失败 → exitCode=1，O 不得放行）：

- **E.1 各 check-\*.ts 的 JSON 摘要须含 exitCode 字段，与 process.exit() 强一致**：每个门禁脚本 stdout 末尾的证据摘要（`GATE_JSON` / `TLA_JSON` / `GRAPH_JSON` 等）须显式含 `exitCode` 字段，且与脚本最终 `process.exit(code)` 调用的码值完全一致；字段缺失或二者不一致 → 视为校验失败（exitCode=1）。**ERROR_JSON（exit 2 输入错误的结构化摘要）同属 stdout JSON 摘要家族，遵循本条约定的 exitCode 强一致**（其 `exitCode` 恒为 2，经 `run-log-logic.ts` `extractExitCode` 26 个标记解析，可被 gate-logs 存档后 R6 交叉校验）。
- **E.2 G 子代理须将脚本 stdout 完整存档到 `.w-model/gate-logs/phaseN-<script>.log`**：G 子代理跑完每个 `check-*.ts` 后，须把脚本 stdout 原样（含证据摘要 JSON 行）落盘到 `.w-model/gate-logs/phaseN-<script>.log`（如 `phase1-check-tla-model.log`），作为不可篡改的执行凭证；编排者 O 不得放行无对应 gate-log 的阶段门。
- **E.3 check-run-log.ts 交叉校验 run-log.gateExitCode 与 gate-logs 存档一致**：`check-run-log.ts` 须读取本阶段所有 `gate-logs/phaseN-*.log`，解析其中的 `exitCode`，与 run-log.jsonl 中对应 `action ∈ {gate, tla-gate, graph-gate}` 记录的 `gateExitCode` 逐一比对；任一不一致 → exitCode=1。
- **E.4 任一层校验失败 → exitCode=1，O 不得放行**：E.1（脚本自身 exitCode 字段缺失/不一致）、E.2（gate-log 缺失）、E.3（run-log 与 gate-log 不一致）三层中任一失败，`check-run-log.ts` 须返回退出码 1，编排者 O 不得放行该阶段门（反模式 #9 谎报状态守护）。

---

## 10F. 事件驱动循环（Loop 3）

> 权威定义：[docs/superpowers/specs/2026-07-25-langchain-loop-engineering-absorption-design.md](./superpowers/specs/2026-07-25-langchain-loop-engineering-absorption-design.md) §2。
> 实现位置：`w-model-dev/references/event-ingress-guide.md` + `w-model-dev/references/data-models.md`（EventIngress schema）+ `w-model-dev/references/operational-recovery.md`「事件驱动与棕地维护」节。
>
> **与 §10C 成熟度阶梯的关系**：L2+ 是事件驱动激活的前置条件；L0/L1 不支持事件驱动。
> **与 §11.2 的关系**：技能不内置 cron/webhook/GitHub Actions/Slack bot；只定义 EventIngress schema + 路由表 + 编排者路由逻辑，消费方自行实现触发器。

### 激活条件

| 条件       | 要求                                                             |
| ---------- | ---------------------------------------------------------------- |
| 成熟度级别 | maturity.json.level ≥ L2（L0/L1 attended 不激活）                |
| 项目模式   | 棕地维护（greenfield 首次跑不激活）                              |
| 高风险路径 | 即使 L3，涉及 auth/加密/发布/架构变更的事件强制决策型 CHECKPOINT |

### EventIngress Schema

见 [data-models.md](../w-model-dev/references/data-models.md)「事件接驳模型」节。编排者 O 维护 `.w-model/event-ingress.jsonl`（append-only）。

### 事件 → 阶段路由表

| eventType             | 目标阶段                  | 触发条件                    | 高风险路径                           |
| --------------------- | ------------------------- | --------------------------- | ------------------------------------ |
| `bug-report`          | 阶段 5（编码修复）        | L2+，bug 涉及已存在代码     | 涉及 auth/加密代码 → 强制 CHECKPOINT |
| `requirement-change`  | 阶段 1（需求重跑）        | L2+，需求变更须回退到阶段 1 | 架构变更 → 强制 CHECKPOINT           |
| `acceptance-failure`  | 阶段 8（验收重跑）        | L2+，验收失败重跑验收       | 发布放行 → 始终 attended             |
| `regression-detected` | 阶段 6/7（集成/系统测试） | L2+，回归测试失败           | -                                    |
| `scheduled-review`    | 阶段 8（验收回顾）        | L3，定期回顾                | 发布放行 → 始终 attended             |
| `security-incident`   | 阶段 4（详细设计重审）    | L2+，安全事件须回退设计     | 强制 CHECKPOINT                      |

### 编排者路由逻辑

编排者 O 确定性执行（无 LLM），详见 [event-ingress-guide.md](../w-model-dev/references/event-ingress-guide.md)「编排者路由逻辑」节。路由动作 append 到 run-log（action=event-route）。

### 不引入的调度基础设施

技能不内置 cron 调度器、webhook 服务器、GitHub Actions 集成、Slack bot（遵循 §11.2）。消费方自行实现触发器写入 `event-ingress.jsonl`。

---

## 10G. 爬坡循环（Loop 4）

> 权威定义：[docs/superpowers/specs/2026-07-25-langchain-loop-engineering-absorption-design.md](./superpowers/specs/2026-07-25-langchain-loop-engineering-absorption-design.md) §3。
> 实现位置：`w-model-dev/references/hill-climbing-guide.md` + `w-model-dev/references/data-models.md`（HarnessImprovementReport schema）+ `w-model-dev/references/hard-constraints.md`「C1（候选，pending V 复审）」节。
>
> **与 §11 的关系**：技能只产出改进信号，不自动改 harness；外部 SkillOpt/darwin-skill 消费信号做演化；人审后手动应用。
> **与 §10D run-log 的关系**：run-log 是 Loop 4 的主要分析输入。
> **与 §4A.2 失败模式的关系**：Loop 4 信号检测关联 O1~O6 运维失败模式。

### 设计原则

| 原则                        | 遵守方式                                                            |
| --------------------------- | ------------------------------------------------------------------- |
| 技能不内置 LLM 调用（§3.3） | HarnessImprovementReport 由编排者 O 确定性分析 run-log 产出，无 LLM |
| 技能自演化不在本仓库（§11） | 技能只产出改进信号，不自动改 harness                                |
| 编排者最小化（§3.4）        | O 分析 run-log 产出报告属"状态读写+分析"允许动作，非实施            |
| 真实执行（约束4）           | 分析基于 run-log 实际记录，不 LLM 估算                              |

### HarnessImprovementReport Schema

见 [data-models.md](../w-model-dev/references/data-models.md)「爬坡循环改进报告模型」节。编排者 O 产出存 `.w-model/hill-climbing/<timestamp>-report.json`。

### 信号检测逻辑

详见 [hill-climbing-guide.md](../w-model-dev/references/hill-climbing-guide.md)「信号检测逻辑」节。8 类信号（prompt/tool/verification-rule/anti-pattern/maturity/budget）均确定性检测。

### 触发时机

| 触发方式       | 条件                                  | 动作                        |
| -------------- | ------------------------------------- | --------------------------- |
| 用户请求       | `/wm hill-climbing` 命令              | O 分析全量 run-log 产出报告 |
| 阶段门后自动   | 每个阶段门放行后                      | O 增量分析本阶段 run-log    |
| 定期触发（L3） | maturity.level=L3 且距上次报告 ≥ 7 天 | O 自动产出全量报告          |
| 失败模式命中   | O 系列失败模式命中 ≥ 2 次             | O 强制产出专项报告          |

### 与外部 SkillOpt/darwin-skill 的边界

| 角色                       | 职责                                  | 边界                                    |
| -------------------------- | ------------------------------------- | --------------------------------------- |
| w-model-dev Loop 4         | 产出 HarnessImprovementReport（信号） | 不自动改 harness；不调用 LLM            |
| 外部 SkillOpt/darwin-skill | 消费信号做技能自演化                  | 重写 prompt/工具/验证规则；可能用 LLM   |
| 人                         | 审查报告 + 决定应用哪些信号           | 低风险人审后手动改；高风险人审+回归测试 |

> Loop 4 产出的 HarnessImprovementReport 信号消费流程详见 §10H（SkillOpt 方法论吸收）。

---

## 10H. SkillOpt 方法论吸收（Loop 4 信号消费路径）

### 10H.1 目的

消费 §10G（Loop 4）产出的 `HarnessImprovementReport` 信号，应用 SkillOpt「bounded edit + validation gate」方法论对技能包 4 类资产（技能/模板/参考/脚本）做离线进化。**吸收方法论而非工具运行**——不引入 Python 依赖、不调用 LLM、不做 rollout 训练。

### 10H.2 与 §11「技能自演化不在本仓库」的协调

- §11 原意：技能**自动演化**（LLM 驱动 rollout/reflect）不在本仓库
- 本节吸收：**方法论**（bounded edit + validation gate 流程范式），不是工具运行
- 类比：§10.8 TLA+ 行为门禁（tla-plus.md）是方法论吸收而非 TLA+ 工具内置——本节同构

### 10H.3 六段式循环类比映射

| SkillOpt 训练循环 | w-model-dev 离线进化                           | 说明                             |
| ----------------- | ---------------------------------------------- | -------------------------------- |
| rollout           | （已完成）Loop 4 产出 HarnessImprovementReport | 信号源已就绪                     |
| reflect           | 主代理审查信号 + 产出 edit proposal            | 确定性，无 LLM                   |
| aggregate         | 多信号合并为 edit 批次（低风险/高风险）        | 按风险分批                       |
| select            | 按 bounded edit 边界裁剪 edit 数量             | 单文件≤3、单信号≤2 文件、全轮≤15 |
| update            | 应用 edit 到 4 类资产                          | 技能/模板/参考/脚本              |
| gate              | self-test + vitest + tsc + fixture validation  | 真实退出码                       |

### 10H.4 bounded edit 边界规则

- 单文件单次 edit 最多 3 处（防过度编辑）
- 单信号最多影响 2 个文件（防爆炸半径）
- 全轮总 edit 数 ≤ 15 处

### 10H.5 validation gate 标准

| 阶段 | 命令                                                                 | 退出码                |
| ---- | -------------------------------------------------------------------- | --------------------- |
| V1   | `npx tsc -p config/tsconfig.json`                                    | 0                     |
| V2   | `npm run self-test`                                                  | 0                     |
| V3   | `npx vitest run --config config/vitest.config.ts`                    | 0                     |
| V4   | `npx tsx w-model-dev/scripts/cli/check-verifier-output.ts <fixture>` | 1（触发 R11/R12/R13） |

### 10H.6 与 Loop 4 的边界

| 角色                        | 职责                                                | 边界                             |
| --------------------------- | --------------------------------------------------- | -------------------------------- |
| w-model-dev Loop 4          | 产出 HarnessImprovementReport 信号                  | 不自动改 harness                 |
| SkillOpt 方法论吸收（本节） | 消费信号 → reflect → bounded edit → validation gate | 不引入 SkillOpt 工具；不调用 LLM |
| 外部 SkillOpt/darwin-skill  | 真实 SkillOpt 工具运行                              | 仍由外部完成（§11）              |

### 10H.7 人审流程

1. spec 阶段：用户审查设计文档
2. 实施阶段：每个 Phase E 批次完成后 CHECKPOINT 确认
3. V 复审：候选反模式需 V 子代理复审转正

### 10H.8 实现位置

权威采用指南：`w-model-dev/references/skillopt-adoption.md`（本节为可执行细则）

---

## 10I. 设计契约一致性校验（check-design-contract-consistency.ts）

> 本节确立编码后自动校验设计契约一致性的机制（接口路径 / 参数名 / 状态码 / 响应字段须与设计文档一致）。
> 实现位置：`w-model-dev/scripts/cli/check-design-contract-consistency.ts` + `w-model-dev/references/phase-5-coding.md` 反向对照清单。

**强制校验维度**（D1~D4，任一失败 → exitCode=1，O 不得放行）：

- **D1 路径一致性**：`uat-path-mapping.md` 中「实际路径」须在路由定义中存在
- **D2 参数一致性**：验收测试使用的分页/筛选参数名须与路由定义一致
- **D3 状态码一致性**：验收测试预期状态码须与路由实际返回一致
- **D4 响应字段一致性**：验收测试断言字段须在实际响应体中存在

**校验时机**：

- 阶段 5 编码完成后（G 子代理执行，exitCode=0 才放行进阶段 6）
- 阶段 8 终检时（与 `check-artifact-gate.ts` 并行执行）

**NFR/CON 行例外**：横切治理类需求不强制 D1~D4 校验（允许路径为「横切」）。

---

## 10J. RTM 增量校验修正（phase 1-4 acceptanceTest 补漏）

> 本节修正 `PHASE_TRACE_FIELDS`，确保阶段 1-4 就校验 acceptanceTest。

**修正内容**：

- phase 1-4 `PHASE_TRACE_FIELDS` 增加 `acceptanceTest`（REQ/SD/INTF/DD 行强制非空）
- NFR/CON 行允许 `acceptanceTest` 为 null（横切治理类豁免，已有 `isCrossCutting` 逻辑覆盖）
- 判定规则：rowId 前缀 `REQ-`/`SD-`/`INTF-`/`DD-` 强制校验；`NFR-`/`CON-` 允许 null

**校验阶段映射**：

| Phase | 新增行类型 | acceptanceTest 校验要求         |
| ----- | ---------- | ------------------------------- |
| 1     | REQ 行     | 须非空（UAT 用例在阶段 1 设计） |
| 2     | SD 行      | 须非空（映射到已有 UAT 用例）   |
| 3     | INTF 行    | 须非空（映射到已有 UAT 用例）   |
| 4     | DD 行      | 须非空（映射到已有 UAT 用例）   |

---

## 10K. 代码健康治理（Code Health Governance, Phase 1–4）

> 目标：为「删除死代码 / 补测试 / 删除冗余测试 / 抽象重复」提供**人类授权 + 证据锚定 + 可回滚**的受控流程，避免凭静态猜测或 LLM 结论直接改动生产代码。
> 范围：本仓库已实现并验收 **Phase 1–4**，以及 **campaign 归档**（真实 producer/consumer/verifier，见 §10K.6）。实现位置（单一事实源）：契约与 schema 类型 `w-model-dev/scripts/logic/code-health-contract.ts`；纯逻辑 `code-health-phase1-logic.ts` / `code-health-gap-logic.ts` / `code-health-test-logic.ts` / `code-health-duplicate-logic.ts` / `code-health-ledger-logic.ts`；注入边界 `lib/code-health-command.ts` / `code-health-file-verifier.ts` / `code-health-evidence-store.ts` / `code-health-revision-provider.ts` / `code-health-redaction.ts` / `code-health-tdd-harness.ts` / `code-health-archive-boundary.ts`；CLI `cli/code-health-phase1.ts` / `code-health-ledger.ts` / `code-health-apply.ts` / `code-health-gap.ts` / `code-health-tests.ts` / `code-health-duplicates.ts` / `code-health-archive.ts`。
> 交付层与无 LLM：全部 code-health 资产属 **L1（带门禁）**，位于 `w-model-dev/scripts/**`，L0 纯 skill 副本不含；判定由纯函数 + 确定性 CLI 完成，**不调用 LLM**。
> **未实现（不得据此执行）**：任何 Phase 5–8 迁移能力。campaign 归档已实现（`cli/code-health-archive.ts` + `lib/code-health-archive-boundary.ts`），但 `--verify` 不带 `--source-project` 只能是 package-only，**不得**表述为 verified source。`logic/code-health-phase-boundaries.ts` 占位模块已删除。

### 10K.1 campaign policy 与候选非结论原则

- **任何代码改动都必须有人类授权**：`code-health-apply.ts` 的 `patch` / `commit` 需要人类 `ApprovalDecision`（`human` 角色），精确绑定 candidate id / action / scopeHash / files / symbols；approval 缺失或与 scope/revision 不一致 → exit 1（`HUMAN_APPROVAL_REQUIRED`），且在写入前拒绝。
- **发现 ≠ 结论**：Phase 1/2 只产出候选与 gap，候选初始状态为 `discovered`；`deadness` / “无用” 结论绝不自动生成。coverage 只作**信号**（`coverageIsSignalOnly: true`，数值恒为 `null`），100% 覆盖不授权删除或跳过任何维度。
- **append-only 账本**：`code-health-ledger.ts` 的 `init` / `append` / `validate` 不允许覆盖已有行或复用 candidate/event id；`validate` 重放每个候选历史并 fail-closed。
- **revision 绑定**：证据绑定 `RevisionIdentity`（`commitSha` / `treeSha` / `sourceBundleSha256` / `analyzedAt`）；revision 不可用或漂移即失败。

候选状态机（`CodeHealthStatus`）：`discovered → evidenced → under-review → approved → implemented → verified → archived`，另有 `rejected` / `deferred` / `blocked` / `rolled-back`。动作（`CodeHealthAction`）：`delete-code` / `add-test` / `delete-test` / `abstract`。阶段（`CodeHealthPhase`）：`P1` / `P2` / `P3` / `P4`。

### 10K.2 四阶段（Phase 1–4）

| 阶段              | CLI（`npx tsx w-model-dev/scripts/cli/...`）                                                                                                | 只读/写入                                                       | 产出与要点                                                                                                                                          | 退出码                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| P1 只读发现       | `code-health-phase1.ts --root <dir> --output <file> --scenario <file> [--platform] [--shell]`                                               | 只读（仅外部 report + `.w-model/` 下独占 raw output）           | 静态 inventory + 真实动态 trace + false-positive guard 归一化；候选只 `discovered` / `blocked`；`changedFiles` 为前后 worktree 差分，非空即只读违规 | 0 全部候选通过校验 / 1 候选校验失败或 revision 不可用 / 2 输入错误    |
| P2 gap matrix     | `code-health-gap.ts --matrix <file> [--validate]`                                                                                           | 只读                                                            | 七维度（requirement / public-contract / branch / error / security / concurrency / platform）gap matrix + RED-GREEN 证据校验；coverage 仅信号        | 0 通过 / 1 校验失败 / 2 输入错误                                      |
| P3 测试 inventory | `code-health-tests.ts --inventory <file> [--ledger] [--project] [--candidate] --validate`；`--guard <file> --project <dir> --ledger <file>` | 只读（`--guard` 是唯一删除路径，且仅经 `code-health-apply.ts`） | 受保护测试 inventory、默认拒绝（default-deny）、逐项等价证明、真实 pre/post suite 身份证据；作者/年龄仅 provenance，不构成删除依据                  | 0 通过 / 1 校验或 guard 失败 / 2 输入错误                             |
| P4 重复簇与抽象   | `code-health-duplicates.ts --matrix <file> [--ledger <file>] [--root <dir>] [--validate]`                                                   | 只读                                                            | 重复簇 + abstraction guard；11 维等价证明逐项有证据；`under-review` 不是批准；权威只能来自 HEAD-tracked ledger                                      | 0 `under-review`/`deferred` / 1 `rejected` 或 guard 违规 / 2 输入错误 |

`code-health-apply.ts`：`--candidate <file> [--approval <file>] [--root <dir>] [--mode dry-run|patch|commit]`；`dry-run` 不写、`patch` 写受控 `.patch`、`commit` 以 argv 数组执行 `git apply` 并回读真实状态；任一 scope 外路径变化即拒绝。退出码 0 提案/应用成功 / 1 fail-closed 校验或写入失败 / 2 输入错误。

### 10K.3 证据与权威字段

删除/抽象授权的证据链（缺一即拒）：

1. **CommandEvidence**：`command` / `cwd` / `environment` / `platform` / `toolVersions` / `startedAt` / `endedAt` / `exitCode`（真实数字；`null` 永不算 observed）/ `observation`（`observed` / `not_run` / `unavailable` / `unverified`）/ `rawOutputPath` / `rawOutputSha256`。跳过的环境不伪造 evidence，只进 `unexercisedScenarios`。
2. **RevisionIdentity 与 EvidenceBinding**：candidate / scope / path / hash / revision 绑定；`lib/code-health-evidence-store.ts` 验证存在与 SHA-256，`lib/code-health-file-verifier.ts` 以 canonical 文件校验重算，`lib/code-health-revision-provider.ts` 提供受控 revision；任一不一致即 exit 1。
3. **tracked repo-owned 事实源**：ledger、`.code-health-governance.json`（18 项 pre-push / self-test 样本数 / docs-consistency 违规数 / fixture reachability）与 suite argv 清单（默认 `.code-health-suite.json`）的工作区字节必须等于 HEAD blob；清单声明的计数与仓库期望冲突且无 `explained:<artifact>` 时拒绝。
4. **默认拒绝**：`proveTestRemoval` 把非保护候选一律视作 protected，只有 ledger 记录（candidate action 与精确 test identity 在 scope/tests 内）能正向建立非保护状态；`test-only`、生成代码、死副本、一次性实验、平台/lifecycle/安全/并发差异与「少几行 diff」均不构成删除或抽象依据。
5. **`lib/code-health-tdd-harness.ts`**：RED-GREEN 证据的断言绑定与测试产物哈希；未绑定断言或未减少测试计数不通过。

### 10K.4 人类 CHECKPOINT 与失败链

- **🔴 CHECKPOINT（人类放行）**：候选进入实现前，O 展示候选 ID、action、精确 files/symbols/call sites 与 scopeHash，等待人类 approve / reject / defer；工具或 LLM 输出本身不能授权任何事。
- **code-health 失败链**（`blocked` 后顺序固定，不可跳过）：`gate-failure → 候选 blocked → R(root-cause) → V(root-cause-review) → G(root-cause-gate) → S(rework) → evidenced`。`nextRequiredRoles` 返回下一步必需角色；`appendRootCauseEvent` 拒绝错序或缺角色。
- **回滚**：失败的删除/抽象必须可回滚——`code-health-apply.ts` 记录受控 patch 并以 `git apply -R` 反向应用，随后 `git diff --exit-code` 必须为 0；无法回滚时显式失败（不静默）。P3 `--guard` 在最终证明失败时回滚已应用的删除。

### 10K.5 脱敏、门禁与边界

- **脱敏**：`lib/code-health-redaction.ts` 对 campaign artifact 输出 `status`（`not_reviewed` / `clean` / `blocked`）、`rules` 与 `blockedReasons`；`blocked` 的产物不得导出。
- **18 项 pre-push 不变**：code-health CLI 不纳入 `.githooks/pre-push`，现有 18 项检查、顺序与 exit 语义原样保留。
- **codegraph 前置（约束 #14）**：进入阶段 5–8 的代码修改前须先做 codegraph 影响分析并落盘 `.w-model/codegraph-queries/`；本仓库 checkout 无 `.codegraph/` 索引，code-health Phase 1–4 不消费 codegraph，也不得伪造查询记录。

### 10K.6 campaign 归档（已实现）

- **实现位置**：`lib/code-health-archive-boundary.ts`（producer / consumer / verifier）+ `cli/code-health-archive.ts`（`produce` / `verify` / `--help`）；契约类型 `ArchiveBoundaryResult` / `ArchivePackageFile` / `ArchiveProduceInput` / `ArchiveManifest`（含 `archiveStatus` / `archivedAsPassed`）。
- **授权与证据**：campaign 目录（**由 caller 通过 `--campaign` 指定**）须含 `ledger.json` / `candidate.json` / `approval.json`；生产者校验三者**内部一致性**（candidate/ledger/approval 相互一致、revision 匹配、签名角色、脱敏），但**不**将其锚定到 HEAD 或任何 tracked 记录——**campaign 目录本身的真实性由 caller / 人类负责**，这一点与 Phase 3/4 的 HEAD-tracked ledger 权威不同。verified 候选须同时具备人类 approval、V 复审、G 门禁、observed + `exitCode=0` + 安全仓库相对 `rawOutputPath` + 64 位十六进制 `rawOutputSha256` 的命令证据、可执行 rollback、clean redaction 与匹配 revision 才 `archivedAsPassed=true`；**该边界不读取 raw 输出文件、不重算摘要**，raw 内容的按字节验证属上游 `EvidenceStore` 职责；`deferred` / `rejected` / `blocked` / `rolled-back` 仅可作终态**非成功**证据归档。每个声明工件经共享 FileVerifier 重验（regular / non-symlink / canonical containment）并按真实内容哈希复制；package 原子写入（staging + rename + readback），不覆盖已存在的非空 package；manifest 摘要是**无密钥完整性校验和，不是签名**。
- **两级验证（不得混淆）**：`produce`/`verify` 的 `--verification-level` **可省略，缺省即 `package-only`**（不因省略而升级）；`--verify` 不带 `--source-project` **只能是 package-only**（与 `wm-export-evidence --verify` 语义一致），package-only **不得**表述为 verified source；只有传 `--source-project` 才做 source-bound 重验（HEAD / source hash / run 身份 / gate measurements），复用 `verifySourceProvenance` 规则。
- **归档不代替 CHECKPOINT**：归档仍需人类 approval，`ARCHIVE` 不能作为阶段放行或授权的替代。

---

## 10L. 证据事实对账（门禁完整性战役）

> 本节确立「形状合规 ≠ 实际正确」类缺陷的权威修复定义：**证据须来自上游产物，不得自报**。
> 共同根因：门禁此前只校验产物的**形状**，因此同义重言式测试能通过四级测试、`newFindings: []` 能通过冰山检查、
> `passed` 从未被读取、伪造的 `evidenceAnchor` 路径能通过格式正则。修复模式统一为**由上游产物提供分母/证据**。
> 实现位置：[`w-model-dev/scripts/logic/`](../w-model-dev/scripts/logic/)（各 `*-logic.ts` 纯逻辑）+ 对应 `cli/*.ts`（读盘注入）。

### 10L.1 证据锚点必填化与 `evidenceStatus`（权威定义）

- **必填范围**：阶段 1-4 **全部** `graph.json` 节点必填 `evidenceAnchor` 与 `evidenceStatus`（`graph.schema.json` 强制）。
- **`evidenceAnchor` 格式**：`path:§section=statement` 或 `path:L42=statement`（复用 `EVIDENCE_PATTERN` 语义，禁止第三套解析）。
- **`evidenceStatus` 枚举**：`confirmed` = 已核验；`pending` = 基于逻辑推理尚未验证。**必填**，无默认值。
- **语义**：两者如实反映验证状态；`pending` 是合法中间态而非缺陷，`confirmed` 必须有证据（见 §10L.2 的 R15e）。
- 升级影响：存量 `graph.json` 须补锚点方可过门禁（**批量迁移是升级动作，不是可选清理**：可选锚点会让伪路径混入）。

### 10L.2 R15 子项权威定义

`check-requirement-graph.ts` 证据锚点子项，**在 schema 校验之前**独立运行——schema 的 `required` 会把缺锚点
报成笼统 `[schema] ... required`，子项名将不可定位，而"拆子项"的全部意义就是失败可定位。两层各自独立成立。

| 子项 | 判据 | 依赖 |
| --- | --- | --- |
| R15a | `evidenceAnchor` 缺失 / 空串 / 非字符串 | 无（纯逻辑） |
| R15b | `evidenceStatus` 非法（缺失或不在枚举内） | 无（纯逻辑） |
| R15c | 锚点 `path` 部分在磁盘不存在 | CLI 注入真实路径集合 |
| R15e | `confirmed` 但签名链中无引用本节点的 V review 环 | CLI 注入 signature-chain 条目 |

- **R15d 已决议不实现**：原设计意图为用 codegraph `--scope` 覆盖度对账锚点，但 `--scope` 的覆盖语义是
  `ChangeScope.changedFiles` 上的集合成员判定，而 `check-codegraph-queries.ts` 被硬限制在 `--phase 5|6|7|8`
  （`parsePhaseArg(process.argv, { min: 5, max: 8 })`）；阶段 1-4 按设计不产出 codegraph 查询，图谱节点又只存在于阶段 1-4，
  两者定义域不相交，无可解析表达式。故 R15 落地为 **R15a/b/c/e**；**编号空缺是已决议项，不是遗漏**。
- **外部依赖注入**：R15c/R15e 依赖真实文件系统与 `signature-chain.jsonl`，logic 层不做 I/O，
  由 CLI 读盘后经 `externalEvidence` 注入（与 §10L.3 的 `viewSets` 同一约定）；未注入即**跳过**（不报错也不假红，
  阶段早期产物/签名链尚不存在时不得误红）。
- **R15e 契约**：须存在**同一**签名链条目同时满足 —— `role=V` 且 `action=review`；其 `artifacts` 含该节点 id；
  其 `inputProvenance.sourceArtifacts[].path` 等于锚点 `path` 部分。"审过该节点"与"核验过该锚点"是两件事，二者须同时成立。

### 10L.3 冰山扫掠分母对账（三视角平权）

- **分母来源**：`newFindings: []` 此前即可通过，且 `sweptArtifacts` 允许空数组，导致「最省事的报告」与
  「最彻底的报告」不可区分。分母（该扫多少）改由 checker 从**上游已放行产物实测**，不由 R 声明——
  声明式分母只是把自证从"自报发现了什么"换成"自报该发现多少"。
- **注入约定**：`check-iceberg-sweep.ts` 读盘后经 `externalEvidence.viewSets` 注入（与 §10L.2 的 R15c/R15e 同构）；
  `iceberg-sweep-logic.ts` 保持纯函数。
- **派生口径**：三份产物的**最窄公共命名空间** `SD-NNN / DD-NNN / INTF-NNN`——
  graph 取节点 `id`、tla 取 `sdCoverage.coveredSdNodes`、rtm 取各行 `designDoc` 解析值；
  阶段 5-8 的 `scope` 视角取 `change-scope.json` 的 `changedFiles`。**刻意不含 REQ/NFR/CON**（TLA 侧无此命名空间，混入制造结构性假阳性）。
- **在场表**：`ICEBERG_VIEW_PRESENCE`（**代码常量，非文档**——写文档会与实现漂移，先例见 `subagent-delegation.md` 计数漂移）。
  取值待端到端调测按各阶段实际产出物核定。
- **三视角平权**：graph / TLA / RTM 等权，两两比对，任一差异即刻失败；**无主视角、不仲裁、不取并集后放行**
  （取并集会把真实缺口洗成"已覆盖"）。
- **三类失败信号**：R6 视角间差异（→ 普通 V/G 失败链由 R 定位）/ R7 视角缺席未在 `sweepCoverage.absentViews` 显式声明
  （**禁止静默跳过**；产物缺失时**不合成空集合**，空集合会被当作"真的一致"放行）/ R8 零发现但收敛集合为空或 `sweptArtifacts` 未覆盖。
- **schema 强化**：`sweepCoverage.sweptArtifacts` 加 `minItems: 1`；新增可选 `sweepCoverage.absentViews`。

### 10L.4 三类评审偏移检测（权威定义）

V 评审的失效不止"评错"，还包括"评审者漂移"：

| 类型 | 判据 | 实现 | 处置 |
| --- | --- | --- | --- |
| 标准偏移 | 同一产物跨轮 review 的 `qualityLevel` 档差 ≥ 阈值（A>B>C>D） | `run-log-logic.ts` R9 | **走高成熟度 CHECKPOINT 交人裁定，不走 R** |
| 校准偏移 | 子标准 `rawScores` 方差 < 下限**且非全等**（分布坍缩） | `verifier-logic.ts` R18 | 校准评审方法（重评 / 调阈值） |
| 惰性偏移 | `summary` 空泛 / `evidence` 无具体引用 | 既有 R11 / R12 / O3 | 重评 |

- **标准偏移不走 R 的理由**：此处不一致的是**评审者自身**，而 R 无法自查评审标准；须按人机分工线交人裁定。
  这与"产物之间的客观差异"（→ R6，走 R）必须区分。
- **R9 首次评审豁免**：仅一次评审无不一致可言；按产物聚合避免重复报。
- **R18 与既有全等检测互补、不重复**：既有防漂移规则检 `max === min`（完全相等 = 复制填入作弊），
  R18 检**非全等但方差极小**（打了分但无分辨力）；`max === min` 时 R18 跳过。
- **阈值性质**：`REVIEW_LEVEL_SPREAD` / `RESOLUTION_FLOOR` / 最少数据点均为**代码常量、先行取值**，
  待端到端调测校准；校准依据为仓库 fixture 实测重算（初版 `1e-4` 会命中 100% 合法产物，实测合法方差为 `6.67e-5`）。
- **A-3f 校准集是**非门禁**：不参与阶段门放行、不产生 exitCode，是离线诊断工具；
  不得当作可阻断流程的检查项，也不得因"未接入 CI"判定其失效。
- **参数无需改动**：`k=5` / `temperature=4.0` / `repeatTimes≥3` 与方差坍缩正交，调整它们不会修复坍缩。

### 10L.5 `exemption` 第 6 类：`evidence-anchor-pending`

- **权威定义**：`graph.json` 中 `evidenceStatus=pending` 的节点在阶段门放行前的**合法出口**，
  复用完整 E1-E9 审批链（S→R→V→人类四阶段、justification ≥20 字符、evidence 非空、时间戳时序），**不新增逻辑**。
- **存在理由**：若无合法出口，pending 锚点要么使阶段门死锁，要么迫使产出者无证据地把状态改成 `confirmed`
  （正是 R15e 要防的"自报"）。给出合法出口比堵死更安全。
- **与 R15e 的分工**：`confirmed` 须有签名链证据（R15e）；尚未验证则如实标 `pending` 并走本类豁免，而非标 `confirmed`。

### 10L.6 阶段门 pending 常态扫描

`quick-self-check.md` DoD 自检含「未验证证据锚点已清零」项：阶段门放行前 `graph.json` 中
`evidenceStatus === 'pending'` 的节点数须为 0。**常态触发、非返工触发**——pending 表示"还没做功课"，
不是"产物有缺陷"，走 R 会把前者误判为后者；若补验证后发现结论站不住，那才触发返工链。

---

## 10.10 系统层级树与多层图谱

> 本节确立系统层级树 + 7 层图谱模型。
> 实现位置：[`docs/ingestion-graph-convergence-design.md`](./ingestion-graph-convergence-design.md)（结构层扩展）+ [`w-model-dev/scripts/logic/graph-logic.ts`](../w-model-dev/scripts/logic/graph-logic.ts)（校验纯逻辑，单点事实源）+ [`w-model-dev/scripts/cli/check-requirement-graph.ts`](../w-model-dev/scripts/cli/check-requirement-graph.ts)（CLI）。

### 10.10.1 系统层级树

跨阶段的结构主干，由 `parent` 边构成（与同阶段 parent 树正交但兼容）：

- **根 = 系统级 REQ 节点**（如 `REQ-001`），`type=REQ`，为系统层级树唯一根（系统根）。
- **子系统根 = SD 节点**，通过 `parent` 边依附系统根（`SD.parent → REQ` 系统根）。
- **接口根 = INTF 节点**，通过 `parent` 边依附子系统根（`INTF.parent → SD` 子系统根）。
- **层级单调**：`parent` 边（父→子）只能连接相邻层级，且 **子节点 Level = 父节点 Level + 1**（`REQ=L0` / `SD=L1` / `INTF=L2` / `DD=L3`，即边方向 L0→L1→L2→L3 单调递增），禁止跨层或逆向依附；违反 → `hierarchyTreeViolation`，`check-requirement-graph.ts` 退出码 1。

### 10.10.2 多层图谱（7 层）

在系统层级树之上叠加 7 层正交图谱，各层边类型独立校验：

| #   | 层       | 边类型                                | 语义                                              | 校验要点                                                       |
| --- | -------- | ------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| 1   | 结构层   | `parent`                              | 系统层级树依附（见 §10.10.1）                     | 单根、父唯一、层级单调                                         |
| 2   | 依赖层   | `depends-on`                          | 节点间依赖（SD→SD / INTF→INTF）                   | 禁止环依赖；依赖目标须存在                                     |
| 3   | 追溯层   | `implements` / `defines` / `realizes` | 跨阶段追溯（SD→REQ / SD→INTF / DD→INTF or DD→SD） | 阶段递进追溯（见 §10.7 校验算法 4）                            |
| 4   | 信息流层 | `produces`                            | 信息流向                                          | 黑洞/奇迹/死模块校验；**根节点豁免死模块**（系统根无入流合法） |
| 5   | 治理层   | `governs`                             | 横切治理（如安全治理节点 governs 多个子系统）     | 横切边不依附层级树（见 §10.10.3）                              |
| 6   | 协作层   | `collaborates-with`                   | 对等协作（子系统间对等交互）                      | 无向语义；两端须对等层级                                       |
| 7   | 派生层   | `derives`                             | 派生规格（如 TLA+ spec derives 自设计节点）       | 派生源须存在；派生不替代追溯                                   |

### 10.10.3 横切设计承载

横切边（`governs` / `collaborates-with` / `derives`，即第 5/6/7 层）的承载规则：

- **横切边不依附系统层级树**：横切边两端节点不通过 `parent` 依附，独立于结构层。
- **横切边两端节点须存在于层级树**：两端节点须已在系统层级树中登记（REQ/SD/INTF/DD 之一），但不构成 `parent` 关系。
- **横切边不替代追溯**：被治理子系统的 `parent` 仍是系统根（治理是横切叠加，不改变结构依附）；追溯层（`implements`/`defines`/`realizes`）与横切层并存，互不替代。

## 10.11 签名链门禁（check-signature-chain.ts）

> 阶段 1–8 每角色动作完成后产出的**签名链完整性 + 产出来源正确性**门禁。权威定义见 [`w-model-dev/references/signature-chain-guide.md`](../w-model-dev/references/signature-chain-guide.md)；schema 见 §7.9。
>
> 实现位置：[`w-model-dev/scripts/cli/check-signature-chain.ts`](../w-model-dev/scripts/cli/check-signature-chain.ts)（CLI）+ [`w-model-dev/scripts/logic/signature-chain-logic.ts`](../w-model-dev/scripts/logic/signature-chain-logic.ts)（校验纯逻辑，单点事实源）。
> 触发方：G 子代理跑每个 gate 脚本前 + O 子代理 checkpoint 前 + 归档时。

**CLI 接口**：

```bash
# 退出码 0=通过 / 1=校验失败 / 2=输入错误
npx tsx w-model-dev/scripts/cli/check-signature-chain.ts <signature-chain.jsonl> [--phase=N] [--stage=pre-gate|pre-checkpoint|archive]
```

**校验规则**（R1-R10）：

| 规则 | 校验内容                                                                                                                | 失败后果                        |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| R1   | 当前阶段所有强制角色签名齐全                                                                                            | exitCode=1，标注缺失角色        |
| R2   | 签名链连续（prevSigHash 匹配）                                                                                          | exitCode=1，标注断裂点          |
| R3   | 时间戳单调递增                                                                                                          | exitCode=1，标注时序异常        |
| R4   | 签名角色与阶段角色清单匹配                                                                                              | exitCode=1，标注越权角色        |
| R5   | O checkpoint 签名 signer 为用户 ID（非 O 角色）                                                                         | exitCode=1，标注代签（O4 命中） |
| R6   | sigHash 重算一致（防篡改）                                                                                              | exitCode=1，标注篡改签名        |
| R7   | 各角色 sourceSigIds 均存在于签名链中                                                                                    | exitCode=1，标注悬空来源        |
| R8   | 各角色 sourceArtifacts 路径存在于磁盘（仅当解析到含 .w-model/project.json 的真实项目根时启用；独立链文件/夹具自动跳过） | exitCode=1，标注缺失产物        |
| R9   | 各角色来源符合"强制来源/禁止来源"矩阵                                                                                   | exitCode=1，标注越权消费        |
| R10  | O checkpoint 的 sourceArtifacts 含 G gate 产物 + 用户确认记录                                                           | exitCode=1，标注绕过门禁        |

**跨阶段消费者校验**（`--stage=archive` 时）：

- 阶段 N+1 的 O chunk 签名 sourceSigIds 含阶段 N 的 O checkpoint 签名
- 阶段 5 的 S produce 签名 sourceSigIds 含阶段 1-4 全部 G gate 签名
- 阶段 8 的 G gate 签名 sourceSigIds 含阶段 1-7 全部签名链根 hash

违反任一规则即命中反模式 #32（签名链断裂），拒绝放行。

---

## 10A. SSoT ↔ 实现追溯表

> 本节是 W 模型 RTM 思想在文档层面的自我应用：每个设计章节标注其实现位置，建立双向追溯。
>
> 本表只收录当前设计事实章节；轮次决策的落地追溯见 [decision-log/README.md](./changes/decision-log/README.md)（轮次 → 版本 → CHANGELOG 映射）。

| SSoT 章节                                    | 设计内容                                                                                                                                                                                                                                                                                                                               | 实现位置                                                                                                                                                                                                                                                                                                                           | 一致性                                                                                                                                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.2.1 需求分析模块                           | 需求解析、验收测试生成                                                                                                                                                                                                                                                                                                                 | `w-model-dev/SKILL.md` `/wm analyze` 编排 + `references/phase-1-requirements.md`                                                                                                                                                                                                                                                   | 编排完整（状态登记 + 测试用例设计由 Agent 执行；AI 解析由 Agent 自身 LLM 完成）                                                                                                                     |
| 3.2.2 设计阶段模块                           | 架构 / 概要 / 详细设计 + 对应测试设计                                                                                                                                                                                                                                                                                                  | `w-model-dev/SKILL.md` `/wm design` 编排 + `references/phase-2/3-*.md`                                                                                                                                                                                                                                                             | 编排完整（文档生成由 Agent 完成）                                                                                                                                                                   |
| 3.2.3 编码与单元测试                         | 代码生成、单元测试用例生成                                                                                                                                                                                                                                                                                                             | `w-model-dev/SKILL.md` `/wm code` 编排 + `references/phase-4/5-*.md`                                                                                                                                                                                                                                                               | 编排完整（不自动标记通过，需 `result` 回填）                                                                                                                                                        |
| 3.2.4-3.2.6 测试模块                         | 集成 / 系统 / 验收测试执行                                                                                                                                                                                                                                                                                                             | `w-model-dev/SKILL.md` `/wm test` 编排 + `references/phase-6/7/8-*.md`                                                                                                                                                                                                                                                             | 完整（支持 `result=pass\|fail` 回填）                                                                                                                                                               |
| 3.3 架构原则与外部工具边界                   | 技能不内置 LLM / 演化由外部完成、无编程式接入                                                                                                                                                                                                                                                                                          | `w-model-dev/SKILL.md`「核心原则」节 + `w-model-dev/references/verifier-spec.md`                                                                                                                                                                                                                                                   | 完整                                                                                                                                                                                                |
| 3.4 编排者-子代理边界                        | 编排者最小化（O/A/S/V/G/R 六类核心角色 + R-iceberg 变体，A 为阶段 1–4 分析子代理，R 为返工循环根因定位，F 由 S 兼任）+ 反模式 #10/#11/#12/#18/#19 守护                                                                                                                                                                                 | `w-model-dev/SKILL.md`「编排者-子代理边界」节 + `w-model-dev/references/subagent-delegation.md`（角色/分派/回填契约）+ `w-model-dev/references/hard-constraints.md` #10/#11/#12/#18/#19 + `ingestion-chunk.md` / `ingestion-cross.md` / `graph-guide.md`                                                                           | 完整（编排者只读例外 + G 子代理回填证据 + 编排者不得越权实施 + A 子代理图谱演进 + G 跑 `check-requirement-graph.ts` 守护 #11/#12 + R 返工根因定位守护 #18/#19）                                     |
| 4A 核心操作行为与失败模式                    | 8 条核心操作行为 + 10 条失败模式（F1~~F10）+ 6 条运维失败模式（O1~~O6）+ 返工循环反模式 #18/#19（§4A.2b）+ 与约束/反例的关系                                                                                                                                                                                                           | `w-model-dev/SKILL.md`「核心操作行为」节 + `w-model-dev/references/operation-behaviors.md`「失败模式清单」节（F1~~F10）+ SSoT §4A.2a「运维失败模式清单」节（O1~~O6）+「返工循环反模式」节（#18/#19）                                                                                                                               | 完整（F1~~F10 吸收自 addyosmani/agent-skills；O1~~O6 吸收自 cobusgreyling/loop-engineering `docs/failure-modes.md`，适配 W 模型语境；#18/#19 守护返工必经 R 根因定位）                              |
| 4A.1b 产出期证据锚点（evidenceAnchor）       | 图谱节点可选声明结论事实锚点（A 声明 / S 只读 / V 核验 / G R15 校验格式）                                                                                                                                                                                                                                                              | `w-model-dev/references/conventions.md` 术语表 + `w-model-dev/schemas/graph.schema.json` + `w-model-dev/scripts/logic/graph-logic.ts` R15 + `w-model-dev/references/evidence-anchored-tree.md`                                                                                                                                     | 完整（复用 EVIDENCE_PATTERN 格式；吸收外部方法论唯一增量；遵守 SSoT §7.7 维护边界：A 写 / S 只读）                                                                                                  |
| 6 命令接口                                   | 12 个 `/wm` 命令（含 `/wm hill-climbing`，见 §10G）                                                                                                                                                                                                                                                                                    | `w-model-dev/SKILL.md`「命令速查」节（编排，Agent 执行）                                                                                                                                                                                                                                                                           | 完整                                                                                                                                                                                                |
| 6.4 Agent Personas                           | code-reviewer / test-engineer / security-auditor / performance-auditor 角色提示词 + R（根因定位者）角色定义（§6.4.4）+ R 方法论引用（§6.4.5）                                                                                                                                                                                          | `w-model-dev/references/agent-personas.md`（提示词，不调用 LLM）+ `w-model-dev/references/root-cause-locator.md`（R 方法论）+ `w-model-dev/references/agent-personas.md`（多角度矩阵）                                                                                                                                             | 完整（吸收自 addyosmani/agent-skills `agents/`，由 `/wm review` 路由；R 为独立诊断子代理，不调用 Persona）                                                                                          |
| 7 数据模型                                   | Project / Requirement / Design / TestCase / RTM                                                                                                                                                                                                                                                                                        | `w-model-dev/references/data-models.md`（Agent 维护 `.w-model/*.json` 的 schema）                                                                                                                                                                                                                                                  | 完整                                                                                                                                                                                                |
| 7.6 LLM-as-a-Verifier 评审规范               | 三维度验证 / 连续评分 / PPT / 子标准 / 输出 Schema / 提示词模板 / 五轴评审 / Severity 标签 / Structural Remedies                                                                                                                                                                                                                       | `w-model-dev/references/verifier-spec.md`（规范，含 §7.4A 五轴+Severity+Remedies）+ `w-model-dev/scripts/logic/verifier-logic.ts`（校验纯逻辑）+ `w-model-dev/scripts/cli/check-verifier-output.ts`（CLI 校验）                                                                                                                    | 完整（LLM 推理由外部 Agent 执行；五轴+Severity 吸收自 addyosmani/agent-skills `code-review-and-quality`）                                                                                           |
| 7.6A self-as-verifier 模式（demo-only 例外） | 单 Agent 兼任 S/V/G/R 的例外模式：仅限 demo/教学（生产禁止）+ 各角色独立产物路径 + Persona 切换偏置缓解                                                                                                                                                                                                                                | `w-model-dev/SKILL.md`「self-as-verifier 模式」节 + `w-model-dev/references/verifier-spec.md` §13 + `check-verifier-output.ts --self-as-verifier --s-output=<path>`（路径独立校验）                                                                                                                                                | 完整（反模式 #35 守护产物混合；`check-role-dispatch.ts` 每阶段 S/V/G ≥1 + R3 三维度各 ≥1（role=R 的 r3-* success 记录，语义见 §10D.8）；代签检测见 §10C O4）                                        |
| 7.7 graph.json schema                        | ingestion 子流程结构层图谱（节点/边/连通/单根/跨阶段追溯 + 信息流边与边界节点）                                                                                                                                                                                                                                                        | `docs/ingestion-graph-convergence-design.md` §2.4（权威定义）+ `docs/information-flow-validation-design.md`（信息流层）+ `w-model-dev/references/graph-guide.md` + `w-model-dev/references/ingestion-chunk.md` / `ingestion-cross.md`                                                                                              | 完整（与 `rtm.json` 分工：结构层 vs 追溯层，各自独立校验；信息流边与边界节点用于黑洞/奇迹/死模块校验）                                                                                              |
| 7.8 tla-manifest.json schema                 | TLA+ 层次化状态机建模行为层产物（specs/层级/拆解决策/文件头/SANY+TLC 结果）                                                                                                                                                                                                                                                            | `docs/tla-plus-modeling-design.md` §2（权威定义）+ `w-model-dev/references/tla-plus.md` + `w-model-dev/templates/tla-spec-template.md`                                                                                                                                                                                             | 完整（与 `graph.json`/`rtm.json` 分工：行为层 vs 结构层 vs 追溯层，三者并存各自独立校验；S 产出 .tla+.cfg+manifest，G 跑 `check-tla-model.ts` 校验）                                                |
| 8 技术实现方案                               | 需求解析 / 测试用例生成 / 代码生成算法                                                                                                                                                                                                                                                                                                 | 上游 AI 按提示词执行（`w-model-dev/references/phase-*.md`）                                                                                                                                                                                                                                                                        | 完整（算法由提示词承载，技能不内置 LLM）                                                                                                                                                            |
| 9 RTM                                        | 需求跟踪矩阵                                                                                                                                                                                                                                                                                                                           | `w-model-dev/references/rtm-guide.md` + `templates/rtm.md`（Agent 维护）                                                                                                                                                                                                                                                           | 完整                                                                                                                                                                                                |
| 10 质量保障                                  | 工件质量门                                                                                                                                                                                                                                                                                                                             | 判定逻辑：`w-model-dev/scripts/logic/gate-logic.ts`（单点事实源）；CLI：`w-model-dev/scripts/cli/check-artifact-gate.ts`                                                                                                                                                                                                           | 完整（见 10.5，门禁逻辑已沉入技能包）                                                                                                                                                               |
| 10.6 项目级 Definition of Done               | 每次变更的日常标准（测试 / 行为 / 文档 / RTM / 状态 / 理解证据 / 签名链完整性）                                                                                                                                                                                                                                                        | `w-model-dev/references/quick-self-check.md`（完成定义（DoD）节）                                                                                                                                                                                                                                                                  | 完整（吸收自 addyosmani/agent-skills `references/definition-of-done.md`；第六维度「理解证据」吸收自 cobusgreyling/loop-engineering `docs/concepts.md` Comprehension Debt，与 §10.5 工件质量门互补） |
| 10.7 图谱门禁                                | 阶段 1–4 ingestion 子流程结构连通性门禁（连通/单根/父唯一/阶段递进追溯 + 信息流校验：黑洞/奇迹/死模块/边界完整性）                                                                                                                                                                                                                     | `docs/ingestion-graph-convergence-design.md` §3（权威定义）+ `docs/information-flow-validation-design.md`（信息流层）+ `w-model-dev/scripts/logic/graph-logic.ts`（校验纯逻辑，含 `DataflowViolations`/`BoundaryInfo`）+ `w-model-dev/scripts/cli/check-requirement-graph.ts`（CLI）+ `w-model-dev/references/graph-guide.md`      | 完整（与 §10.5 工件质量门互补：结构层阶段 1–4 vs 追溯层阶段 8 终检；信息流校验与结构校验正交；守护反模式 #11/#12/#13）                                                                              |
| 10.8 TLA+ 行为门禁                           | 阶段 1–4 TLA+ 层次化状态机建模行为正确性门禁（环境/manifest/文件头/层次一致性/拆解决策/SANY 语法/TLC 模型检查）                                                                                                                                                                                                                        | `docs/tla-plus-modeling-design.md` §3（权威定义）+ `w-model-dev/scripts/logic/tla-logic.ts`（校验纯逻辑，含 `parseTlaHeader`/`validateHeader`/`checkHierarchy`/`checkDecomposition`）+ `w-model-dev/scripts/cli/check-tla-model.ts`（CLI）+ `w-model-dev/references/tla-plus.md`                                                   | 完整（与 §10.7 图谱门禁正交：行为层 vs 结构层+信息流层；阶段 4 TLA+ 零违反 ∧ 图谱零违反才放行进编码；守护反模式 #14/#15/#16/#17）                                                                   |
| 10.8.1 代码-TLA+ 一致性回归                  | 阶段 5 代码与 TLA+ 规格一致性回归门禁（四维度：SD→codeModule 映射 / 代码状态转移抽取 / Next 分支对应 / 断言覆盖不变式）                                                                                                                                                                                                                | `w-model-dev/scripts/logic/code-tla-logic.ts`（校验纯逻辑，含 `checkSdToCodeModule`/`extractCodeStateTransfers`/`checkNextBranchCoverage`/`checkInvariantCoverage`）+ `w-model-dev/scripts/cli/check-code-tla-consistency.ts`（CLI，使用 TypeScript Compiler API 解析 AST）                                                        | 完整（与 §10.8 TLA+ 行为门禁互补：行为门禁校验 TLA+ 规格自身，一致性回归校验代码是否符合 TLA+ 规格；维度1 与 `check-artifact-gate.ts` 终检双向守护；`self-test.ts` 含 5 条样本）                    |
| 10.9 根因报告门禁                            | 返工循环 R 子代理 `RootCauseReport` 校验门禁（R1-R10：Schema 完整性 / 根因链 / 可证伪假设 / fixRecommendation / prevention / upstreamDefect / qualityLevel / reportId / 多角度 PartialReport / canonical `testing-reality-checker` confidence，legacy `reality-checker` fallback）                                                     | `w-model-dev/scripts/cli/check-rootcause-report.ts`（CLI，与 `check-verifier-output.ts` 平级）+ 校验纯逻辑（单点事实源）                                                                                                                                                                                                           | 完整（G 子代理在 V 复审根因报告后跑，exitCode=0 才可分派 S-fix；守护反模式 #18/#19；详见 [根因定位者设计 spec](./superpowers/specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md) §4）    |
| 10C 自主成熟度阶梯                           | L0~L3 成熟度 + CHECKPOINT 放行矩阵（决策型始终 attended，操作型按级别自动放行）+ 高风险路径强制人工 gate + maturity.json schema + 升级/降级逻辑                                                                                                                                                                                        | `docs/loop-engineering-adoption-design.md` §2（权威定义）+ `w-model-dev/references/operational-recovery.md`「成熟度与 CHECKPOINT 放行」节 + `w-model-dev/references/data-models.md`（maturity schema）                                                                                                                             | 完整（吸收自 cobusgreyling/loop-engineering `docs/loop-design-checklist.md` L0~L3 阶梯；不违反约束2：L1+ 自动放行是操作型 CHECKPOINT 选择性激活，非绕过；L3 高风险路径强制人工 gate）               |
| 10D 成本预算与运行日志                       | budget.json（perPhase/project 预算 + killSwitch + onExceed）+ run-log.jsonl（append-only 运行历史 + acknowledgedDecisions）+ 编排者预算检查逻辑                                                                                                                                                                                        | `docs/loop-engineering-adoption-design.md` §1（权威定义）+ `w-model-dev/references/operational-recovery.md`「成本预算与运行日志」节 + `w-model-dev/references/data-models.md`（budget / run-log schema）                                                                                                                           | 完整（吸收自 cobusgreyling/loop-engineering `docs/operating-loops.md` loop-budget + loop-run-log + kill switch；不引入 LLM 估算 token，由宿主 Agent 报告实际消耗，遵守约束4）                       |
| 10D.8 角色分派与 run-log fail-closed         | R3 三种证明路径矩阵（standard / fix-emergency identity window / opsx stage 9+3）+ role-dispatch 精确语义（空/全无效 fail-closed、R3 只计 role=R 的 r3-* success、r3Missing 明细）+ run-log 空/坏行 blocking、action-role 配对、variant/blocker 与 LEGACY_VARIANT/LEGACY_UNSCOPED 吸收 + preventive-review `passed=false ⇒ findings ≥1` | `w-model-dev/references/subagent-delegation.md`（R3 矩阵 + dispatch 表）+ `w-model-dev/references/data-models.md`（run-log / preventive-review schema）+ `w-model-dev/scripts/logic/role-dispatch-logic.ts` + `w-model-dev/scripts/logic/run-log-logic.ts` + `w-model-dev/scripts/cli/check-role-dispatch.ts` / `check-run-log.ts` | 完整（R3 无条件强制与维度语义由 logic 层守护；`--r3-enabled` no-op；坏行并入 blocking 不静默）                                                                                                      |
| 10.5.2 阶段 5-8 外部校验聚合                 | ChangeScope 绑定 + codegraph/opsx strict 校验聚合进 artifact gate（violations 并入 reasons/exitCode、GATE_JSON external summary、scopeProvidedButFailed 抑制误导文案）+ archive 为 phase 8 opsx:archive 后置门                                                                                                                         | `w-model-dev/references/command-reference.md`（Artifact Gate 节）+ `w-model-dev/scripts/lib/change-scope.ts` + `check-codegraph-queries.ts` / `check-opsx-artifacts.ts` / `check-openspec-archive.ts` / `check-artifact-gate.ts`（CLI，strict 一律经 resolveCliScope）                                                             | 完整（`gate-logic.ts` externalChecks 透传已删除；legacy 纯逻辑保留给 self-test/fixture）                                                                                                            |
| 10F 事件驱动循环（Loop 3）                   | EventIngress schema + 棕地条件性路由（L2+ 激活，事件→单阶段）+ 高风险路径强制 CHECKPOINT + 编排者路由逻辑                                                                                                                                                                                                                              | `docs/superpowers/specs/2026-07-25-langchain-loop-engineering-absorption-design.md` §2（权威定义）+ `w-model-dev/references/event-ingress-guide.md` + `w-model-dev/references/data-models.md`（EventIngress schema）+ `w-model-dev/references/operational-recovery.md`「事件驱动与棕地维护」节                                     | 完整（吸收自 LangChain "The Art of Loop Engineering" Loop 3 Event-driven；不引入调度基础设施，消费方自行实现触发器；L2+ 激活，L0/L1 不支持；高风险路径强制 CHECKPOINT 不违反约束2）                 |
| 10G 爬坡循环（Loop 4）                       | HarnessImprovementReport（确定性分析 run-log，无 LLM）+ 信号检测逻辑 + 触发时机 + 与外部工具边界 + 报告消费流程                                                                                                                                                                                                                        | `docs/superpowers/specs/2026-07-25-langchain-loop-engineering-absorption-design.md` §3（权威定义）+ `w-model-dev/references/hill-climbing-guide.md` + `w-model-dev/references/data-models.md`（HarnessImprovementReport schema）+ `w-model-dev/references/hard-constraints.md`「C1（候选，pending V 复审）」节                     | 完整（吸收自 LangChain "The Art of Loop Engineering" Loop 4 Hill Climbing；只产出改进信号不自动改 harness，保持"技能自演化不在本仓库"原则；外部 SkillOpt/darwin-skill 消费信号；人审后手动应用）    |
| §10H SkillOpt 方法论吸收                     | SkillOpt「bounded edit + validation gate」方法论吸收（Loop 4 信号消费路径）+ 六段式循环类比映射 + bounded edit 边界 + validation gate 标准 + 人审流程 + 与 §11 协调                                                                                                                                                                    | `w-model-dev/references/skillopt-adoption.md`（可执行细则）                                                                                                                                                                                                                                                                        | 完整（吸收 SkillOpt 方法论而非工具运行；不引入 Python 依赖/LLM；消费 Loop 4 信号；与 §11「技能自演化不在本仓库」协调——方法论吸收类比 §10.8 TLA+）                                                   |
| 11A 采用路径                                 | greenfield vs brownfield 引入 W 模型                                                                                                                                                                                                                                                                                                   | `docs/adoption-guide.md`                                                                                                                                                                                                                                                                                                           | 完整（吸收自 addyosmani/agent-skills `docs/adoption-guide.md`）                                                                                                                                     |

---

## 11. 部署与集成方案

### 11.1 部署方式

本技能是**单纯的编排 + 校验脚本技能**，无独立部署物。技能资产（`w-model-dev/` 目录）作为纯文件分发给 AI Agent 使用：

- **Agent 分发**：将 `w-model-dev/` 拷贝到目标 Agent 的 skills 目录（详见 [`docs/INSTALL.md`](./INSTALL.md)），无需构建、无需服务进程。
- **校验脚本**：`w-model-dev/scripts/cli/*.ts` 由 Agent 在阶段门评审时直接 `npx tsx` 执行，无后端服务。

### 11.2 外部集成（消费方自行实现）

下列集成本技能不提供，由消费方（IDE 插件、CI/CD 流水线、项目管理工具等）按需在外部实现，调用技能的 `/wm` 命令编排或门禁脚本：

- **IDE 集成**：由 Trae / VS Code / JetBrains 等客户端作为 Skill 加载
- **CI/CD 集成**：在 GitHub Actions / GitLab CI 中通过 Agent 调用 `check-artifact-gate.ts` 作为质量门
- **项目管理工具集成**：由外部适配层将 RTM 同步到 Jira / Notion

### 11.3 集成架构

```mermaid
graph TD
    subgraph 消费方[消费方（外部实现）]
        IDE[IDE / Agent 客户端]
        CI[CI/CD 流水线]
        PM[项目管理工具适配层]
    end

    subgraph 技能包[本技能：纯资产]
        SKILL[w-model-dev/SKILL.md<br/>编排逻辑]
        SCRIPTS[w-model-dev/scripts/cli/*.ts<br/>门禁校验]
    end

    subgraph 外部能力[外部能力]
        LLM[Agent 自身 LLM]
        STORE[.w-model/*.json<br/>Agent 维护]
        EVO[SkillOpt / darwin-skill<br/>技能演化]
    end

    IDE -->|读取| SKILL
    IDE -->|执行| SCRIPTS
    CI -->|执行| SCRIPTS
    PM -->|读取| STORE
    SKILL -->|指引 Agent 调用| LLM
    SKILL -->|指引 Agent 写入| STORE
    SCRIPTS -->|消费| STORE
    STORE -->|VerifierOutput JSON| EVO
```

## 11A. 采用路径（Greenfield vs Brownfield）

> 吸收自 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `docs/adoption-guide.md`。
> 适配 W 模型语境：W 模型 8 阶段流程在不同代码库成熟度下采用不同引入策略——绿地项目可 Day 0 全流程启用，棕地项目须增量验证优先。
> 实现位置：[`docs/adoption-guide.md`](./adoption-guide.md)（人类可读的采用指南，不参与门禁判定）。

### 11A.1 路径选择信号

| 信号               | Greenfield（绿地）   | Brownfield（棕地）             |
| ------------------ | -------------------- | ------------------------------ |
| 代码库年龄         | 数天至数周           | 数月至数年                     |
| 测试覆盖率         | Day 0 可控           | 不均匀，部分区域无测试         |
| 约定               | 随开发定义           | 已存在，常未文档化             |
| 团队习惯           | 形成中               | 已固化（好坏皆然）             |
| Agent 错误改动风险 | 影响面小             | 可能破坏无人记得如何修复的部分 |
| **采用策略**       | **Day 0 全流程启用** | **增量、验证优先**             |

> 处于两者之间（年轻项目但已上线）→ 按棕地路径起步并加速，最终收敛到同一稳态。

### 11A.2 路径 A：Greenfield — Day 0 全流程

新项目是最佳场景：无遗留行为需保留，质量门成本几乎为零且从首次提交开始复利。

**Day 0：安装与初始化**

1. 按 [`docs/INSTALL.md`](./INSTALL.md) 安装 `w-model-dev/` 到目标 Agent 的 skills 目录。
2. 首次启用执行 `/wm analyze`，触发 §4A.1「显式声明假设」：列出对需求 / 技术栈 / 范围的假设，等用户确认。
3. 创建 `.w-model/` 持久化目录，初始化 `project.json` / `rtm.json`。

**Day 0：按 W 模型 8 阶段顺序执行**

```
/wm analyze    →  需求规格 + 验收测试设计       (阶段 1)
/wm design type=架构  →  系统设计 + 系统测试设计  (阶段 2)
/wm design type=概要  →  概要设计 + 集成测试设计  (阶段 3)
/wm design type=详细  →  详细设计 + 单元测试设计  (阶段 4)
/wm code        →  代码 + 单元测试执行            (阶段 5)
/wm test type=集成  →  集成测试                    (阶段 6)
/wm test type=系统  →  系统测试 + 性能 + 安全      (阶段 7)
/wm test type=验收  →  验收测试 + 工件质量门       (阶段 8)
```

每个阶段门评审由外部 Agent 按 §7.6 + §6.4 执行；每个 🔴 CHECKPOINT 必须等用户确认（不可绕过）。

**从 Day 0 起视为常开：**

- **测试设计前置**（硬约束 #1）：阶段 1–4 的开发产物完成后立即产出对应测试设计。
- **RTM 维护**（硬约束 #3）：每次产物变更同步更新 `.w-model/rtm.json`。
- **真实执行**（硬约束 #4）：不得估算覆盖率或测试结果，必须执行真实测试 / 脚本并回填。

**项目成长后追加：**

| 触发条件                       | 追加动作                                              |
| ------------------------------ | ----------------------------------------------------- |
| 首个对外 API 或模块边界        | 调用 `code-reviewer` Persona 评审接口设计             |
| 首次涉及认证 / 加密 / 输入校验 | 调用 `security-auditor` Persona 深审                  |
| 首次涉及性能热点循环 / DB 查询 | 调用 `performance-auditor` Persona + 准备 k6 基线脚本 |
| 首次 CI 流水线                 | 在 CI 中调用 `check-artifact-gate.ts` 作为质量门      |
| 首次部署到生产                 | 执行 §10.5 工件质量门 + 用户确认归档                  |

**Greenfield 反模式：**

- **跳过 `/wm analyze` 因为「只是个原型」**：原型会变成产品。需求规格是此代码库最便宜的产物。
- **一次性加载全部 `references/`**：违反 §4 约束 6「按需加载」，污染上下文。按阶段加载，由 SKILL.md 路由。
- **推迟性能基线到「有东西可测」**：阶段 7 系统测试前必须准备 k6 脚本，否则违反 §10.5 工件质量门「性能指标达标」要求。

### 11A.3 路径 B：Brownfield — 增量、验证优先

棕地代码库的风险剖面反转：危险不是「建错东西」，而是「改了无人完整定义过的东西」。因此采用顺序从「读和保护」开始，最后才到「改」。

**Phase 1：上下文与只读技能**

目标：Agent 在修改任何东西前先理解代码库。

1. **项目规则文件优先**：在仓库根 `AGENTS.md` / `CLAUDE.md` 描述真实约定（代码中的，不是 wiki 中的）——构建 / 测试命令、目录含义、已知雷区（「不要碰 `legacy/billing`，无测试 + 三个已知 workaround」）。
2. **`/wm review` on 进来的改动**：评审零风险且立即可用——五轴评审与 Severity 标签在任何 PR 上都可用，与代码库状态无关。
3. **`/wm test type=单元 result=fail` for 既存 bug**：执行五步 triage（重现 → 定位 → 缩减 → 修复 → 加守卫），「加守卫」步骤开始建立你没有的回归测试套件。
4. **§4A.1 行为 3「Push Back」作为安全网**：遗留代码正是「不熟悉的代码 + 错误代价高」的场景。Agent 对遗留系统工作方式的自信声明须经 §7.6 评审验证后再提交。

**Phase 2：先测试后改动**

目标：Agent 将触及的每个区域先加安全网。

- **选择性应用测试设计前置**：不追求全局覆盖率，追求「计划改动处」的覆盖率。对未测试的遗留行为写**特征化测试（characterization tests）**——锁定当前行为（无论对错）后再改。
- **`code-reviewer` on 最差热点**：Chesterton's Fence 是操作原则——Persona 强制 Agent 先理解代码存在的原因再动手。行为保持不变的简化 + 特征化测试是让遗留代码可改的最低风险路径。
- **小原子提交**：~100 行的提交在棕地更重要——改老代码破坏微妙行为时，可二分定位；2000 行「现代化」提交则不可。

**Phase 3：新工作跑全流程**

目标：双速采用，遗留代码留在 Phase 1–2；新功能获得 Greenfield 待遇。

- 老代码库中的新功能？`/wm analyze → /wm design → /wm code → /wm test`。`/wm analyze` 的边界声明节是声明「新功能可触碰 / 不可触碰哪些遗留面」的地方。
- **`security-auditor` at 接缝**：当代码必须与遗留代码对话时，按边界契约设计接口。Hyrum's Law 在数年代码库中不是理论——每个可观察行为（包括 bug）都有人依赖。
- **`security-auditor` as 审计 → 然后作为门**：先在现有攻击面（auth / 输入处理 / 依赖）跑一次，归档发现，然后对新改动强制执行。

**Phase 4：偿还债务、废弃、观测**

- 阶段 8 验收后，将「废弃与迁移」作为下一周期目标：用受控方式缩小遗留面而非仅包裹它。
- 沿实际调试路径回填可观测性：结构化日志 + RED 指标优先放在 Top 事件源上。
- 性能优化在回归重要时启动——`performance-auditor` 的「Measure-First」规则防止「优化从未是瓶颈的代码」这一遗留陷阱。

**Brownfield 反模式：**

- **「大爆炸」采用**：在遗留代码库 Day 0 加载完整 8 阶段流程会为已存在的代码产出规格，并在无安全网下重构。必须分阶段。
- **让 Agent 重构未测试代码**：无特征化测试，不重构。这是棕地采用中最昂贵的捷径。
- **跳过项目规则文件因为「代码就是文档」**：Agent 会从它碰巧读到的最差文件推断约定。告诉它真实的。
- **将遗留系统行为默认视为错误**：Chesterton's Fence：那个奇怪的 retry 循环可能是承重的。先理解，再改。
- **无棘轮**：采用应使质量单调提升——每个 Phase 加一道不再撤回的门。如果一个月后你说不出「现在有什么是强制执行而之前不是的」，采用已停滞。

### 11A.4 两条路径的收敛

两条路径终态相同：新工作跑全 8 阶段、常开 RTM 维护与真实执行、阶段门评审在合并前、`references/` 按阶段加载而非批量。Greenfield 在数天内到达；Brownfield 在约一个季度内到达，差异正是老代码库从未有的安全网（上下文 / 特征化测试 / 边界）。

| 维度             | Greenfield                    | Brownfield                    |
| ---------------- | ----------------------------- | ----------------------------- |
| 首次加载的技能   | `w-model-dev` + `/wm analyze` | 项目规则文件 + `/wm review`   |
| 首次交付的价值   | 规格化、测试先行的首个功能    | 零风险评审与更安全的 bug 修复 |
| 测试设计前置姿态 | 从首次提交全启用              | 选择性：在计划改动处前置      |
| 重构规则         | 罕见（无东西可重构）          | 特征化测试先行，永远          |
| 最高风险反模式   | 跳过 `/wm analyze`            | 重构未测试代码                |
| 到达全流程时间   | Day 0                         | 约一个季度，中间双速          |

### 11A.5 Brownfield 阶段级适配

> 吸收 OpenSpec brownfield 优先理念，对 §11A.3 路径 B 补充阶段级适配细则。权威定义见 [decision-log/absorptions.md](./changes/decision-log/absorptions.md)（Brownfield 阶段级适配节）。

#### 适用场景

- 已有代码库引入 W 模型管理后续迭代
- 历史代码无 RTM/无 TLA+ 规格，需要补建追溯
- OpenSpec 风格的 brownfield 项目迁移到 W 模型

#### 阶段 1 Brownfield 入口

S-doc 子代理在阶段 1 产出需求规格前，先执行 codebase survey：

1. **现状调查**：扫描 src/ 产出模块清单（controller/service/store/utils）
2. **逆向 RTM**：从代码反推需求清单（每个公共 API → 候选 REQ 行）
3. **缺口分析**：标注哪些需求有测试覆盖、哪些无覆盖
4. **User Stories 回填**：从代码行为反推 user stories（与 [phase-1-requirements.md](../w-model-dev/references/phase-1-requirements.md) 阶段 1 强制产出互补）
5. **Out of Scope 声明**：明确本轮 brownfield 迭代不动哪些历史模块

#### 阶段 2-4 Brownfield 适配

- 阶段 2 系统设计：优先复用现有架构，seam 决策优先选现有模块边界
- 阶段 3 概要设计：模块交互 seam 优先选现有公共导出
- 阶段 4 详细设计：新增 DD 仅针对本轮改动模块，历史模块不补 DD（避免范围蔓延）
- TLA+ 规格：仅对本轮改动的 SD 子系统建模（历史模块不补 TLA+）

#### 阶段 5 Brownfield 编码

- 票据拆解时优先 prefactor（to-tickets 原则）：让本轮改动更容易
- Wide refactor 场景（重命名共享符号/重类型）必走 expand-contract
- 历史代码清理不在本轮范围（Out of Scope 声明）

#### Brownfield 不做的事

- 不全量补建历史 RTM（除非用户明确要求，作为独立项目）
- 不全量补建历史 TLA+ 规格（同上）
- 不重构无关历史代码（与 §4A.1 行为 5「Maintain Scope Discipline」协同）

### 11A.6 任务规模维度（轻量路径）

> 采用路径（绿地/棕地）按代码库成熟度选；任务规模维度在其上叠加**门禁强度适配**。「轻量路径」是**门禁降载**（maturity L0/L1 免 TLA+/BDD、L0 交付层无脚本门禁、demo 可 self-as-verifier），**不是阶段裁剪**：阶段流程、RTM、CHECKPOINT 机制与生产项目完全一致，任何「以任务小为由跳过 S→V→G 顺序 / RTM 回填 / 用户确认」的行为命中反模式 #10 / #21 并回退。

| 任务规模                           | 适配形态                                                                                              | 门禁强度                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 极小任务（原型 / demo / 教学演示） | L0 交付层（无脚本门禁，V 评审 + 用户确认把关）+ self-as-verifier（仅 demo，见 §7.6A）+ maturity L0/L1 | TLA+/BDD 可选                                     |
| 生产小项目 / 小工具                | 完整 8 阶段 + maturity L2                                                                             | TLA+ L1 + BDD L1 必跑（L2-L4 可选），其余门禁照跑 |
| 常规生产功能                       | 完整 8 阶段 + maturity L3                                                                             | 全必跑，无降载                                    |

> 实现位置：`SKILL.md`「触发决策 → 任务规模适配（轻量路径）」；maturity 分级权威定义见 §10C；L0/L1 交付层见 INSTALL §2。

---

## 12. 发展规划

### 12.1 第一阶段（基础版）

- 实现需求分析和测试设计的AI辅助
- 支持代码生成和单元测试生成
- 提供基本的项目状态管理

### 12.2 第二阶段（进阶版）

- 实现完整的W模型全流程闭环
- 支持集成测试和系统测试自动化
- 提供代码审查和质量分析功能

### 12.3 第三阶段（高级版）

- 支持多项目并行管理
- 提供团队协作功能
- 集成DevOps流程
- 支持智能缺陷预测和预防

### 12.4 外部演化工具协作

> **技能演化不在本仓库**，由外部工具（[SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)）完成。本技能不包含 Rollout / Reflect / Edit / Skill Lift 评估等内容（历史自演化版规划见 CHANGELOG 体系）。

本技能与外部演化工具的协作方式：

- 本技能产出的 `VerifierOutput` JSON（由外部 Agent 按 `verifier-spec.md` 执行评审、`check-verifier-output.ts` 校验产出）可作为外部演化工具的训练信号。
- 推荐的外部演化工具：
  - [SkillOpt](https://github.com/microsoft/SkillOpt)（微软）：提供 Rollout → Reflect → Edit → Gate → Commit 训练循环
  - [darwin-skill](https://github.com/alchaincyf/darwin-skill)：提供基于进化算法的技能搜索与筛选
- 多 Agent 框架适配（LangGraph / AutoGen / CrewAI 等）与 MCP Server 化等规划仍可推进，但均以「技能只提供提示词 + 模板 + 门禁脚本」为前提，不在技能内引入 LLM 调用或轨迹分析。

### 12.5 路线图

```mermaid
timeline
    title W-Model AI Assistant Skill 发展路线图
    section 第一阶段（基础版）
        需求分析模块 : 2026 Q3
        代码生成模块 : 2026 Q3
        单元测试模块 : 2026 Q4
    section 第二阶段（进阶版）
        集成测试模块 : 2027 Q1
        系统测试模块 : 2027 Q1
        代码审查功能 : 2027 Q2
    section 第三阶段（高级版）
        多项目管理 : 2027 Q3
        团队协作 : 2027 Q3
        DevOps集成 : 2027 Q4
    section 技能演化（外部工具）
        SkillOpt / darwin-skill 消费 VerifierOutput : 随外部工具演进
        多 Agent 框架适配 : 待规划
        MCP Server 化 : 待规划
```

---

---

## 13. 参考文献

### 13.1 W 模型与软件工程基础

1. 软件开发常见模型（瀑布模型、V模型、W模型、敏捷开发模型）. CSDN博客. https://blog.csdn.net/yao_zhuang/article/details/114273475
2. W模型和瀑布模型与"V"模式开发模型有何异同？. 阿里云开发者社区. https://developer.aliyun.com/article/1566339
3. 软件开发测试的W模型：构建高质量产品的坚实蓝图. 掘金. https://juejin.cn/post/7551997631112822794
4. 测试视角下的软件工程：需求、开发模型与测试模型. 腾讯云开发者社区. https://cloud.tencent.com/developer/article/2582288
5. 软件测试模型对比：V模型、W模型、H模型与敏捷测试. 51CTO. https://rk.51cto.com/article/633281.html
6. AI大模型如何重塑软件开发流程. CSDN博客. https://blog.csdn.net/cooldream2009/article/details/149217195
7. 超越Vibe Coding —— AI 辅助编程进阶指南. 掘金. https://juejin.cn/post/7637710008821481499
8. Requirements Traceability Matrix (RTM): The Complete Guide. https://getbestest.com/blog/requirements-traceability-matrix-guide/
9. What is Requirements Traceability Matrix (RTM) in Testing?. https://www.guru99.com/traceability-matrix.html
10. 需求跟踪深度解析：架构师视角下的全链路追溯体系. https://blog.csdn.net/ZxqSoftWare/article/details/149282779

### 13.2 LLM-as-a-Verifier（§7.6 评审规范）

11. LLM-as-a-Verifier: A General-Purpose Verification Framework. arXiv:2607.05391. Stanford University + UC Berkeley + NVIDIA Research.
12. LLM-as-a-Judge: 本技能的评审规范见 [`w-model-dev/references/verifier-spec.md`](../w-model-dev/references/verifier-spec.md)（三维度验证 / 连续评分 / PPT / 子标准 / 输出 Schema / 提示词模板），SSoT §7.6 为摘要。历史集成设计见 `llm-verifier-integration-design.md`（仅作背景，不作为权威来源）。
13. PPT (Probabilistic Pivot Tournament): O(N×k) 复杂度排名算法，本技能在 `verifier-spec.md` §5 以提示词描述，由外部 Agent 执行；不再内置 `src/core/ppt-ranker.ts`。

### 13.3 外部技能演化工具

> 技能演化与评估已移出技能包（原第 14 章 / 第 15 章已移除）。下列工具 / 基准由外部消费本技能产出的 `VerifierOutput` JSON，不在技能内置：
>
> - 训练循环与 Skill Lift 评估 → SkillOpt / darwin-skill
> - 技能评估基准 → ACES / SkillsBench / SkillLearnBench
> - 多候选排序算法 → PPT（已纳入 `verifier-spec.md` 提示词，见 §13.2）

14. SkillOpt: 把技能文档视为可训练外部状态，通过 Rollout → Reflect → Edit → Gate 闭环优化。Microsoft Research. https://github.com/microsoft/SkillOpt （SkillsBench 实证：自生成技能平均 -1.3pp，必须搭配验证门）
15. darwin-skill: 基于进化算法的技能搜索与筛选。 https://github.com/alchaincyf/darwin-skill
16. MetaSkill-Evolve: 5 组件元技能（ψ/σ/α/π/ε）+ 双时间尺度（快循环任务技能 + 慢循环元技能）。
17. ACES (Agentic Capability Evaluation via Skill Lift): with-skill vs without-skill 配对试验差值。
18. SkillsBench: 三条件对照（no-skill / curated-skill / self-generated-skill）。
19. SkillLearnBench: 三级评估（规格质量 / 轨迹分析 / 任务结果）。

---

## 附录

### A. 技能命令速查

| 命令                                                         | 功能                                                                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/wm analyze <需求>`                                         | 分析需求并生成规格说明                                                                                                                           |
| `/wm design type=<架构\|概要\|详细>`                         | 生成对应类型设计文档                                                                                                                             |
| `/wm code <功能>`                                            | 生成代码和单元测试                                                                                                                               |
| `/wm test type=<单元\|集成\|系统\|验收> result=<pass\|fail>` | 执行指定类型测试并真实回填结果                                                                                                                   |
| `/wm review <目标>`                                          | 返回 LLM 评审指引（指向 verifier-spec.md，由外部 Agent 执行）                                                                                    |
| `/wm status`                                                 | 查看项目状态（脚本化 `wm-status.ts`：当前阶段、完成进度、RTM 覆盖率、四级测试汇总、最近 3 条动作、确定性下一步建议；`--json` 输出 StatusReport） |
| `/wm metrics`                                                | 流程度量报告（`metrics-report.ts`：run-log + budget 汇总 7 区度量；支持 `--from/--to/--phase/--json/--out`）                                     |
| `/wm help`                                                   | 显示帮助                                                                                                                                         |
| `/wm reset`                                                  | 重置当前项目状态（保留元信息，清空实体）                                                                                                         |
| `/wm export [输出目录]`                                      | 导出项目 JSON + RTM Markdown                                                                                                                     |
| `/wm import <文件路径>`                                      | 从 JSON 导入项目                                                                                                                                 |

### B. 测试类型对应关系

| 开发阶段 | 对应测试类型 | 测试目的                 |
| -------- | ------------ | ------------------------ |
| 需求分析 | 验收测试设计 | 验证系统是否满足用户需求 |
| 系统设计 | 系统测试设计 | 验证系统整体功能和性能   |
| 概要设计 | 集成测试设计 | 验证模块间交互正确性     |
| 详细设计 | 单元测试设计 | 验证单个模块功能正确性   |
| 编码实现 | 单元测试执行 | 验证代码实现正确性       |
| 集成阶段 | 集成测试执行 | 验证模块集成正确性       |
| 系统阶段 | 系统测试执行 | 验证系统整体质量         |
| 验收阶段 | 验收测试执行 | 用户确认系统满足需求     |

### C. 验收检查清单

- [ ] 需求规格说明书完整
- [ ] 设计文档完整且符合规范
- [ ] 代码实现完成且通过编译
- [ ] 单元测试代码覆盖率 ≥ 80%
- [ ] 集成测试全部通过
- [ ] 系统测试全部通过
- [ ] 安全测试无高危漏洞
- [ ] 性能测试达标
- [ ] 验收测试通过
- [ ] 用户确认签字
- [ ] 交付文档齐全
