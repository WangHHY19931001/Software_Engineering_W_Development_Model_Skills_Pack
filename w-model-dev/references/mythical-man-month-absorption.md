# Mythical Man-Month Absorption（人月神话吸收决策记录）

> 吸收源：《agent 时代的人月神话》（Brooks《人月神话》2026 年逐章重写，19 章，agent-mythical-man-month-2026）。
> 权威定义以 [SSoT](../../docs/skill-design-document_SSoT.md) §3.4.39 + 各 reference 新增节为准；本文件为吸收映射与决策回溯。
> 设计 spec：`docs/superpowers/specs/2026-08-10-mythical-man-month-absorption-design.md`。

## 1. 吸收源清单

| 章 | 主题 | 吸收批次 | 落点 |
|---|---|---|---|
| 00-序 / 16-18 | 判断的组织 / 人机分工线 / 停机问题 | P0-4 | SKILL.md「人机分工线」段 |
| 01 焦油坑 | 九倍矩阵（产品化×系统集成） | P0-3 | DoD「完成度矩阵自检」+ phase-5/6 任务分配 |
| 02 人月神话 | 并行三闸 / 通读测试 / 验证账单 / 反指标游戏 | P0-1 + P1 | 反模式 #45 + dispatching-parallel-agents |
| 03 外科手术队伍 | 主刀 / 支持角色 / 审计权 vs 修正权 | P0-2 | 反模式 #46 + subagent-delegation「主刀职责映射表」 |
| 04 贵族专制 | 概念完整性 / Goodhart | P0-1 支撑 | 反模式 #45 说理 |
| 05 画蛇添足 | 提示词最小化 / 预算纪律 | P1（39.1.0） | writing-skills / budget |
| 06 贯彻执行 | 原文装填 / 记叙性优先 / 结构性约束 / 独立评审 | P1（39.1.0） | subagent-delegation / bdd-guide / SKILL.md |
| 07 巴比伦塔 | 入职材料四件套 / 信息隐藏分层 | P1 支撑 | AGENTS.md / context-management |
| 08 胸有成竹 | 估算纪律 / 记账 / mini-spike | P2（39.2.0） | estimation-guide.md（新建） |
| 09 削足适履 | 上下文管理 / KV 缓存 / 档位路由 | P2（39.2.0） | context-management-guide.md（新建） |
| 10 提纲挈领 | 文档即源码 / 决策记录 | 已有机制强化 | SSoT §3.4.39 |
| 11 未雨绸缪 | 侦察 vs 产出 / 辩解义务 / 会话生命周期 / 回归强制 | P1 + P2（39.1.0/39.2.0） | hill-climbing-guide / root-cause-locator / operational-recovery / 约束 #21 |
| 12 干将莫邪 | harness 工程 / 交互式 vs 批处理 | P1 支撑 | SKILL.md 工具选型 |
| 13 整体部分 | Vyssotsky / 环境契约自检 / 增量集成 | P1（39.1.0） | quality-standards / phase-5-coding |
| 14 祸起萧墙 | 里程碑不可自欺 / 止损三规则 / 预注册 | P1 + P2（39.1.0/39.2.0） | operational-recovery / writing-plans |
| 15 另外一面 | 先讨论后动手 / 目的注释 | P2（39.2.0） | format-conventions |
| 16-18 没有银弹 | 本质困难 / 白箱黑箱 / 判据持有审计 | P1/P2 + P3 候选 | SKILL.md / 后续轮 |

## 2. 吸收决策记录

### 2.1 落地策略：纯文档为主 + 少量脚本联动
- 选定：纯文档为主；脚本联动仅限反模式计数 44→46（`docs-consistency-logic.ts` + 测试样本）
- 理由：与"编排者最小化"及既往吸收先例（external-skills-absorption）一致；23 项中 21 项是方法论/规则

### 2.2 优先级分轮
- P0（39.0.0）：反指标游戏 #45 / 主刀与修正权 #46 / 九倍矩阵 / 人机分工线
- P1（39.1.0）：并行三闸 / 原文装填 / 记叙性优先 / 结构性约束 / 独立评审 / 止损三规则 / 会话生命周期 / 辩解义务 / 回归约束 #21 / 环境契约自检
- P2（39.2.0）：estimation-guide / context-management-guide / 白箱黑箱 / 里程碑元规则 / 侦察vs产出 / 目的注释
- P3（候选）：银弹批判框架 / 判据持有审计 / worktree 警示

### 2.3 明确不吸收
- 不把"全自动 agent 系统必然失败"的立场性批判设为硬约束（仅说理层与边界注释）
- 不新增门禁脚本（九倍矩阵可脚本化项列为二期候选）

## 3. 与现有约束/反模式的关系

### 3.1 新增反模式（2）
- #45 反指标游戏：subagent 为通过测试而修改断言/测试期望
- #46 只给审计权不给修正权：全自动流程把用户锁在"跑完再看"之外

### 3.2 新增约束（P1 批）
- 约束 #21 回归测试强制钩子：任何 agent 改动代码后必须跑回归测试

### 3.3 不弱化现有反模式
- 反模式 #10（编排者越权）：修正权属于用户（人侧），O 仍不实施（agent 侧），两层互补不冲突
- 反模式 #18（跳过 R 直接 S 返工）：#45 的归因流程复用 R→V→G，不绕过返工循环

## 4. 立场冲突处理

| 冲突点 | 处理 |
|---|---|
| dispatching-parallel-agents 原允许"调整测试期望" | P0 修订为"不得改断言凑通过"（与 #45 一致） |
| 编排者最小化 vs 修正权 | 层级区分：O 不实施（agent 侧）vs 用户保留修正权（人侧），写入 SKILL.md |
| worktree 使用 | 书中持悲观态度（"各持现实副本漂移"）；列为 P3 候选，待用户确认取舍 |

## 5. 不做的事

- 不改 verifier-spec.md Schema / schemas/*.json / templates/* / subagent/* 人格
- 不改既有 44 条反模式语义（#45/#46 为新增）
- 不改 self-test 基线（249）/ pre-push 项数（14）
- 不改 docs/changes/archive/**
