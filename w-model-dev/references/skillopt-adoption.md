# SkillOpt 方法论采用指南（SkillOpt Adoption Guide）

> 来源：SSoT [§10H](../../docs/skill-design-document_SSoT.md)（SkillOpt 方法论吸收）。本文件为可执行细则。
>
> **与 Loop 4 关系**：消费 [hill-climbing-guide.md](hill-climbing-guide.md) 产出的 `HarnessImprovementReport` 信号。Loop 4 产出信号，本指南消费信号。
>
> **架构原则**：吸收 SkillOpt「bounded edit + validation gate」方法论，不引入 Python 依赖、不调用 LLM、不做 rollout 训练。类比第 13 轮 TLA+ §14 方法论吸收。

## 目录

- 设计原则
- 六段式循环类比映射（SkillOpt → w-model-dev）
- 信号→bounded edit→validation gate 流程
- bounded edit 边界规则
- validation gate 标准
- 与 Loop 4 的边界
- 与 §11「技能自演化不在本仓库」的协调
- 与反模式 #10「编排者越权实施」的协调
- 人审流程
- 与现有机制的关系

## 设计原则

| 原则 | 本指南的遵守方式 |
|---|---|
| 技能不内置 LLM 调用（§3.3） | reflect 阶段由人（主代理）审查信号产出 edit proposal，确定性 |
| 技能自演化不在本仓库（§11） | 吸收方法论而非工具运行；不引入 Python 依赖 |
| 编排者最小化（§3.4） | 离线进化场景主代理顺序执行，不分派子代理（资产间有依赖需协调） |
| 真实执行（约束4） | validation gate 用真实 self-test/vitest/tsc 退出码，不 LLM 估算 |
| CHECKPOINT 不可绕过（约束2） | 每个 Phase E 批次完成后 CHECKPOINT 确认 |

## 六段式循环类比映射（SkillOpt → w-model-dev）

[SkillOpt](https://github.com/microsoft/SkillOpt) 把 skill 文档当可训练状态，用 epoch/batch/lr/validation-gate 范式优化。本指南类比映射其六段式训练循环：

| SkillOpt 训练循环 | w-model-dev 离线进化 | 说明 |
|---|---|---|
| rollout（target 执行任务） | （已完成）Loop 4 产出 HarnessImprovementReport | 信号源已就绪 |
| reflect（optimizer 分析 trajectory 产出 edit patch） | 主代理审查信号 + 产出 edit proposal | 确定性，无 LLM |
| aggregate（合并 edit patches） | 多信号合并为 edit 批次（低风险/高风险） | 按风险分批 |
| select（rank & clip edits，learning_rate=max edits） | 按 bounded edit 边界裁剪 edit 数量 | 单文件≤3、单信号≤2 文件、全轮≤15 |
| update（apply to skill doc） | 应用 edit 到 4 类资产 | 技能/模板/参考/脚本 |
| gate（validate & accept on held-out split） | self-test + vitest + tsc + fixture validation | 真实退出码 |

## 信号→bounded edit→validation gate 流程

### Phase R（Reflect，产出 edit proposal）

| 步骤 | 输入 | 动作 | 产出 |
|---|---|---|---|
| R1 | Loop 4 HarnessImprovementReport 信号 | 主代理读取信号 | 信号清单 |
| R2 | 4 类资产全文 | 主代理审查 + 扩展信号 | 扩展报告（含原信号 + 新信号） |
| R3 | 每个信号 | 主代理产出 edit proposal（文件路径 + old/new 文本片段） | edit proposal 列表 |
| R4 | edit proposal 列表 | 人审（spec 阶段 + 实施阶段 CHECKPOINT） | 确认的 edit proposal |

### Phase E（Bounded Edit，应用 edit proposal）

按风险等级分两批：

| 批次 | 信号类型 | 风险 | 应用方式 |
|---|---|---|---|
| E1 | prompt 类（措辞改进） | 低 | 人审后直接改 |
| E2 | verification-rule/tool 类（逻辑改进） | 高 | 人审 + 回归测试 |

### Phase V（Validation Gate，回归测试）

见下文「validation gate 标准」节。

## bounded edit 边界规则

借鉴 SkillOpt「textual learning-rate budget」概念：

- **单文件单次 edit 最多 3 处**（防过度编辑）
- **单信号最多影响 2 个文件**（防爆炸半径）
- **全轮总 edit 数 ≤ 15 处**（防单轮工作量爆炸）

超出边界时，按信号 priority 排序（1=立即 > 2=下个版本 > 3=backlog），裁剪低优先级信号到下轮。

## validation gate 标准

| 阶段 | 命令 | 退出码要求 | 失败处理 |
|---|---|---|---|
| V1 TypeScript strict | `npx tsc --noEmit` | 0 | 修正 edit，重跑 V1 |
| V2 self-test | `npm run self-test` | 0 | 修正 edit，重跑 V2 |
| V3 vitest | `cd w-model-dev && npx vitest run scripts/__tests__/` | 0 | 修正 edit，重跑 V3 |
| V4 fixture | `npx tsx w-model-dev/scripts/cli/check-verifier-output.ts <bad-fixture>` | 1（触发目标规则） | 修正 fixture，重跑 V4 |
| V5 全量回归 | 重跑 V1-V4 全绿 | 全 0 | 任一失败回到对应阶段 |

## 与 Loop 4 的边界

| 角色 | 职责 | 边界 |
|---|---|---|
| **w-model-dev Loop 4** | 产出 HarnessImprovementReport 信号 | 不自动改 harness（hill-climbing-guide.md 既有边界） |
| **SkillOpt 方法论吸收（本指南）** | 消费信号 → reflect → bounded edit → validation gate | 不引入 SkillOpt Python 包；不调用 LLM；不做 rollout 训练 |
| **外部 SkillOpt/darwin-skill** | 真实 SkillOpt 工具运行（rollout/reflect 用 LLM） | 仍由外部完成，本仓库不内置（§11 既有约束） |

## 与 §11「技能自演化不在本仓库」的协调

- **§11 原意**：技能**自动演化**（LLM 驱动 rollout/reflect）不在本仓库
- **本指南吸收**：**方法论**（bounded edit + validation gate 流程范式），不是工具运行
- **类比**：第 13 轮吸收 TLA+「时间推进建模模式」（tla-plus-guide.md §14）是方法论吸收，非 TLA+ 工具内置——本指南同构

## 与反模式 #10「编排者越权实施」的协调

反模式 #10 禁止运行时编排者越权实施阶段产物。本指南是**离线进化场景**（技能资产维护），非运行时阶段产物生成。

| 场景 | 编排者动作 | 是否允许 |
|---|---|---|
| 运行时阶段产物生成 | 编排者只路由/状态读写/CHECKPOINT/分派子代理；实施由 S/V/G/R 子代理 | 反模式 #10 约束 |
| 离线进化场景（本指南） | 主代理执行 reflect → bounded edit → validation gate | §3.4.2 扩展允许 |

SSoT §3.4.2 角色表已扩展明确限定「离线进化场景下主代理执行 reflect→bounded edit→validation gate」属允许动作，区别于运行时编排。

## 人审流程

1. **spec 阶段**：用户审查设计文档（brainstorming 产出）
2. **实施阶段**：每个 Phase E 批次完成后 CHECKPOINT 确认
3. **V 复审**：候选反模式需 V 子代理复审转正（参考反模式 #19 流程）

## 与现有机制的关系

| 机制 | 关系 |
|---|---|
| [hill-climbing-guide.md](hill-climbing-guide.md) | 上游，产出 HarnessImprovementReport 信号 |
| [anti-patterns.md](anti-patterns.md) | 下游，候选反模式入清单（pending V 复审） |
| `scripts/self-test.ts` | validation gate V2 |
| `scripts/__tests__/` | validation gate V3 |
| [verifier-spec.md](verifier-spec.md) | 信号消费对象 + 规则收紧对象（R11/R12） |
| `scripts/verifier-logic.ts` | 信号消费对象 + 规则实现对象（R11/R12） |
| SSoT §10H | 上游权威定义 |
| SSoT §3.4.2 | 离线进化场景角色表扩展 |
