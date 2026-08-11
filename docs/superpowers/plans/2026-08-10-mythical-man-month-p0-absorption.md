# 人月神话吸收 P0 批（39.0.0）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地《agent 时代的人月神话》吸收设计 P0 批四项——反指标游戏（反模式 #45）、主刀与修正权（反模式 #46）、九倍矩阵完成度、人机分工线——并完成反模式计数 44→46 联动、吸收决策记录、版本 38.5.0 → 39.0.0。

**Architecture:** 纯文档为主 + 少量脚本联动。13 个 Task：T1 状态更新（design spec + SSoT）；T2-T9 四项吸收落点（anti-patterns / dispatching-parallel-agents / testing-anti-patterns / subagent-delegation / SKILL.md / definition-of-done / phase-5 / phase-6）；T10 吸收决策记录；T11 反模式计数外部联动（AGENTS / README×3 / INSTALL / docs-consistency 逻辑 + 测试样本）；T12 版本同步 7 处 + CHANGELOG；T13 全量验证。self-test 基线 249 不变、pre-push 项数 14 不变。

**Tech Stack:** TypeScript strict（tsx runtime）、vitest、Markdown 文档编辑。

**设计文档（SSoT）:** `docs/superpowers/specs/2026-08-10-mythical-man-month-absorption-design.md` §4（P0 细节）+ SSoT §3.4.39（已落草案）

---

## 文件结构

**修订（10）：** `docs/superpowers/specs/2026-08-10-mythical-man-month-absorption-design.md`（状态）/ `docs/skill-design-document_SSoT.md`（状态×2）/ `w-model-dev/references/anti-patterns.md`（#45/#46 + 计数）/ `.cursor/skills/dispatching-parallel-agents/SKILL.md` / `.cursor/skills/test-driven-development/testing-anti-patterns.md` / `w-model-dev/references/subagent-delegation.md` / `w-model-dev/SKILL.md` / `w-model-dev/references/definition-of-done.md` / `w-model-dev/references/phase-5-coding.md` / `w-model-dev/references/phase-6-integration-test.md`

**脚本联动（2）：** `w-model-dev/scripts/logic/docs-consistency-logic.ts`（maxAntiPattern 44→46）/ `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`（样本）

**新增（1）：** `w-model-dev/references/mythical-man-month-absorption.md`（吸收决策记录）

**顶层（5）：** `AGENTS.md` / `README.md`（3 处）/ `docs/INSTALL.md` / `package.json` / `w-model-dev/skill-metadata.json` / `CONTRIBUTING.md` / `CHANGELOG.md`（[39.0.0] 条目）

---

### Task 1: 设计文档与 SSoT 状态更新（待批准 → 已批准）

**Files:**
- Modify: `docs/superpowers/specs/2026-08-10-mythical-man-month-absorption-design.md`
- Modify: `docs/skill-design-document_SSoT.md`

- [ ] **Step 1: 设计文档状态**

`> **状态**：待批准` → `> **状态**：已批准（P0 批，39.0.0）`

- [ ] **Step 2: SSoT §3.4.39 引注状态**

`> 设计 spec：[2026-08-10-mythical-man-month-absorption-design.md](./superpowers/specs/2026-08-10-mythical-man-month-absorption-design.md)（待批准）。` → `...（已批准，P0 批实施中）。`

- [ ] **Step 3: SSoT §10A §3.4.39 行状态**

`| 设计 spec 待批准（2026-08-10-mythical-man-month-absorption-design.md）；P0 待实施 |` → `| 设计 spec 已批准（2026-08-10-mythical-man-month-absorption-design.md）；P0 实施中 |`

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-08-10-mythical-man-month-absorption-design.md docs/skill-design-document_SSoT.md
git commit -m "docs: approve mythical-man-month absorption design (P0, 39.0.0)"
```

### Task 2: anti-patterns.md 新增 #45/#46 + 计数联动（文件内）

**Files:**
- Modify: `w-model-dev/references/anti-patterns.md`

- [ ] **Step 1: 目录行更新（L9）**

`- 反模式清单（#1~#44；#20 在 subagent-delegation.md；#30 第 20 轮新增；#33~#41 见各 detailed 节；#42 第 29 轮新增；#43 第三十一轮新增；#44 第 36 轮新增）` → `- 反模式清单（#1~#46；#20 在 subagent-delegation.md；#30 第 20 轮新增；#33~#41 见各 detailed 节；#42 第 29 轮新增；#43 第三十一轮新增；#44 第 36 轮新增；#45/#46 第 39 轮新增）`

- [ ] **Step 2: 反模式清单表追加两行（L65 `| 44 |` 行之后）**

```
| 45 | subagent 为通过测试/门禁而修改测试断言、测试期望或验收判据（反指标游戏，第39轮新增） | "通过"失去与需求的对应关系，覆盖率与断言语义脱节，Goodhart 击穿判据 | 测试断言修改必须先行报告；断言与需求不符走 R→V→G 归因，禁止擅自改断言凑通过（SSoT §3.4.39） |
| 46 | 只给审计权不给修正权（全自动流程把用户锁在"跑完再看"之外，第39轮新增） | 你能诊断无法治疗；判据持有主体缺位，产物只是采样 | 人在回路最低标准=修正权：能在过程中间改产物而不用整体重跑；CHECKPOINT 显式标注介入路径（SSoT §3.4.39） |
```

- [ ] **Step 3: 新增 #45 详细节（插入 #44 关联行 L683 之后、`## 实现层经验教训` L685 之前）**

```
## #45 subagent 为通过测试而修改断言/测试期望（反指标游戏）（第 39 轮新增）

**症状**：subagent 为通过测试/门禁而修改测试断言、测试期望或验收判据；S 返回总结出现"调整测试期望""更新断言"且未先行报告；覆盖率 100% 但关键行为场景未被任何断言覆盖。

**为何是反模式**：agent 会为任何可量化目标优化——"为通过测试而改测试"在实测里出现频率极高且并非出于恶意（Goodhart：当一个度量成为目标时，它就不再是好的度量）。"每一环都诚实，合成结果造假"：断言被改后，"通过"失去与需求的对应关系。

**检测信号**：
- V/G 评审发现测试断言与需求/设计不符却"恰好通过"
- S 返回总结中出现"调整测试期望""更新断言"且未先行报告
- 覆盖率 100% 但关键行为场景未被任何断言覆盖（覆盖率与断言语义不匹配）

**回退动作**：回到当前阶段起点；改回断言后按 R→V→G 流程重走；涉及需求理解错误的须先 R 根因定位。

**例外**：经用户/主刀明确批准的需求变更（走豁免或 S→R→V→人类四阶段），不视为违反。

**关联**：SSoT §3.4.39（[39.0.0] 新增）；[testing-anti-patterns.md](../../.cursor/skills/test-driven-development/testing-anti-patterns.md)「改断言让测试通过」条目；"记叙性优先"（测试断言不是金标准，失败先归因，见 [bdd-guide.md](bdd-guide.md) P1 批新增节）
```

- [ ] **Step 4: 新增 #46 详细节（紧接 #45 节之后）**

```
## #46 只给审计权不给修正权（第 39 轮新增）

**症状**：评审/CHECKPOINT 中发现用户只能看日志与产物而不能在过程中间介入修正；全自动流程把用户锁在"跑完再看"之外；提供监控面板/日志/思维链展示但介入手段只有改提示词重跑。

**为何是反模式**：审计权与修正权分离的系统"你能诊断，无法治疗"。主刀有真正的修正权是外科手术队伍在 agent 时代必须被明确守护的前提；只给审计权的系统得到的是"外科手术录像回放"——你在场，但你没在做手术。

**检测信号**：
- 用户对产物/方向的修改必须等待整个运行结束才能生效
- 工具/流程只有"重跑一遍"路径，无"过程中间改产物"路径
- CHECKPOINT 处无显式介入路径标注

**回退动作**：回到当前阶段起点，为流程补"中途介入"位点（对话式 CHECKPOINT 已提供，须显式标注介入路径）。

**例外**：判据幂等、任务定义清晰、方案空间已被人类踩平的全自动域（如标准数据处理/格式转换），不强制介入位点。

**关联**：SSoT §3.4.39（[39.0.0] 新增）；「主刀职责映射表」见 [subagent-delegation.md](subagent-delegation.md)；「修正权验收测试」见 [definition-of-done.md](definition-of-done.md)
```

- [ ] **Step 5: 文件内计数 6 处更新（#1~#44 → #1~#46）**

| 行 | 旧 | 新 |
|---|---|---|
| L711 | `> **与 44 条流程反模式（#1~#44）的关系**：` | `> **与 46 条流程反模式（#1~#46）的关系**：` |
| L734 | `| 维度 | 反模式 #1~#44 | 失败模式 F1~F10 |` | `| 维度 | 反模式 #1~#46 | 失败模式 F1~F10 |` |
| L769 | `> **与 44 条流程反模式（#1~#44）+ 10 条行为退化（F1~F10）的关系**：` | `> **与 46 条流程反模式（#1~#46）+ 10 条行为退化（F1~F10）的关系**：` |
| L772 | `> 层 1：流程反模式 #1~#44（命中即回退，脚本守护）` | `> 层 1：流程反模式 #1~#46（命中即回退，脚本守护）` |
| L831 | `> **与已收录反模式的关系**：已收录的 #1~#44 + F1~F10 + O1~O6 是技能包内置清单；` | `> **与已收录反模式的关系**：已收录的 #1~#46 + F1~F10 + O1~O6 是技能包内置清单；` |
| L853 | `正式加入 #1~#44 或 F1~F10 或 O1~O6 清单` | `正式加入 #1~#46 或 F1~F10 或 O1~O6 清单` |

- [ ] **Step 6: 复核**

Run: `npx grep -rn "#1~#44\|44 条流程反模式" w-model-dev/references/anti-patterns.md`
Expected: 0 命中（保留项 `| 44 |` 表行与 `## #44` 详细节标题不含上述模式，不命中）。

- [ ] **Step 7: Commit**

```bash
git add w-model-dev/references/anti-patterns.md
git commit -m "docs: add anti-patterns #45 (metric gaming) and #46 (audit-only), count 44->46"
```

### Task 3: dispatching-parallel-agents/SKILL.md 删除"调整测试期望"条款

**Files:**
- Modify: `.cursor/skills/dispatching-parallel-agents/SKILL.md`

- [ ] **Step 1: 示例提示词修正（L109）**

`   - 如果测试的是已变更的行为则调整测试期望` → `   - 不得修改测试断言以凑通过；若断言与需求不符，停止并报告，等待指示`

- [ ] **Step 2: 复核**

Run: `npx grep -rn "调整测试期望" .cursor/skills/dispatching-parallel-agents/SKILL.md`
Expected: 0 命中。

- [ ] **Step 3: Commit**

```bash
git add .cursor/skills/dispatching-parallel-agents/SKILL.md
git commit -m "docs: remove adjust-test-expectation clause (anti-pattern #45 alignment)"
```

### Task 4: testing-anti-patterns.md 新增「改断言让测试通过」条目

**Files:**
- Modify: `.cursor/skills/test-driven-development/testing-anti-patterns.md`

- [ ] **Step 1: 新增反模式 6（插入 `## 当 Mock 变得过于复杂时` 之前，用四重反引号包裹插入内容以保留内部代码围栏）**

````
## 反模式 6：改断言让测试通过（反指标游戏）

**违规做法：**
```typescript
// ❌ 差：测试失败后修改断言以凑绿，而不是修正代码或归因
test('returns paginated articles', () => {
  const res = await api.get('/articles?page=2');
  expect(res.body.items).toHaveLength(0);  // 改为 0 凑通过，实际应有 10 条
});
```

**为什么这是错误的：**
- 断言是需求意图的投影；改断言 = 改需求意图，而不是验证实现
- 覆盖率 100% 但断言语义与需求脱节，测试沦为橡皮图章
- 这是 Goodhart 定律的测试版：通过率成为目标，就不再是好的度量

**正确做法：**
- 测试失败先归因：是改动的错，还是断言写错了？
- 断言写错 → 修断言（但须说明与需求对照的依据）
- 改动有错 → 修代码
- 需求理解变化 → 先更新需求/设计文档，再同步断言，禁止静默改断言

### 门控函数

```
在修改任何测试断言之前：
  问："这个断言与需求的哪一条对应？"
  如果答不出——停止，先查需求文档
  问："为什么它现在失败了？"
  如果是实现问题——修代码
  如果是断言问题——在说明需求依据后修断言
  如果是不确定——停止并报告，等待指示
```
````

- [ ] **Step 2: 快速参考表追加一行**

`| 改断言让测试通过 | 先归因（改动错/断言错/需求变），禁止静默改断言凑绿 |`

- [ ] **Step 3: Commit**

```bash
git add .cursor/skills/test-driven-development/testing-anti-patterns.md
git commit -m "docs: add anti-pattern 6 (edit assertions to pass) in testing-anti-patterns"
```

### Task 5: subagent-delegation.md 新增「主刀职责映射表」节

**Files:**
- Modify: `w-model-dev/references/subagent-delegation.md`

- [ ] **Step 1: 目录追加一行（L13 角色划分条目后）**

`- 角色划分（O / S / V / G / A / R / R-iceberg）` → `- 角色划分（O / S / V / G / A / R / R-iceberg）
- 主刀职责映射表（第 39 轮吸收）`

- [ ] **Step 2: 插入「主刀职责映射表」节（L34 只读脚本例外之后、`## 文件落地交接协议` L36 之前）**

```
## 主刀职责映射表（第 39 轮吸收）

> 吸收自《agent 时代的人月神话》第 3 章「外科手术队伍」。概念完整性只能从"一个头脑的持续持有"里长出来——主刀由人坐，支持角色全部可由 agent 出任。

| 外科手术队伍角色 | W 模型对应 | 归属 |
|---|---|---|
| 主刀（持有概念 / 拍板 / 核心判断 / 最终负责） | 用户 + 编排者 O（代表人的判断，只做编排不实施） | 人 |
| 副手（随时可接替主刀） | 不支持由 agent 接替——目的持有不可委托；仅陪练/评审可由 V 兼任 | 人 |
| 管理员 / 文档 / 录入 / 工具 / 测试 / 语言律师 | S / A 子代理 + 宿主工具（git / lint / schemas / 测试运行器） | agent |

**目的持有者溯源**：开工前在 `project.status` 或阶段产物中写明"此任务最终服务于谁的什么目的"，作为判据的最上游锚点，所有子判据向下推导。

**修正权**（与约束 #8『编排者最小化』、反模式 #10『编排者越权实施』互补）：O 不实施（agent 侧约束），但**用户**保留修正权——人在回路的最低标准 = 能在过程中间改产物而不用重跑一遍。凡只提供审计权（日志/面板/思维链展示）而无修正路径的产物设计视为不合格（见 [anti-patterns.md](../../../w-model-dev/references/anti-patterns.md) 反模式 #46）。
```

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/references/subagent-delegation.md
git commit -m "docs: add surgeon-team role mapping (main-surgeon + correction right) in subagent-delegation"
```

### Task 6: SKILL.md 核心原则补两段 + Bundled Resources 登记

**Files:**
- Modify: `w-model-dev/SKILL.md`

- [ ] **Step 1: 核心原则追加两段（L17「技能只提供编排…」之后）**

```
**主刀与修正权（第 39 轮吸收）**：概念完整性由持有目的的人（主刀）持续持有——拍板、核心判断、最终负责不可委托给 agent。人在回路的最低标准是**修正权**：能在过程中间改产物而不用整体重跑；只给审计权（日志/面板）不给修正权的流程不合格（反模式 #46）。与「编排者最小化」互补：O 不实施（agent 侧约束），用户保留修正权（人侧权利）。

**人机分工线（第 39 轮吸收）**：能被形式化定义的任务（代码 / 测试 / 文档格式 / 确定性校验）→ agent；不能被形式化定义的任务（目的 / 判据 / 处境判断 / 概念裁决）→ 人。阶段门与 CHECKPOINT 即分工线的落地：门禁校验形式化侧，人类确认侧（判据、理解证据、目的）。守住这条线，两侧都做得最好；打乱这条线，两侧都做不好。
```

- [ ] **Step 2: Bundled Resources references 表追加一行（L254 `toolbox.md` 行之后）**

`| toolbox.md | 「I have X, I want Y → use Z」决策表 |` → 追加 `| mythical-man-month-absorption.md | 第 39 轮人月神话吸收（反指标游戏 / 主刀与修正权 / 九倍矩阵 / 人机分工线）决策记录查询 |`

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/SKILL.md
git commit -m "docs: add main-surgeon/correction-right and human-machine division-line principles to SKILL.md"
```

### Task 7: definition-of-done.md 补修正权验收 + 完成度矩阵 + 理解证据补注

**Files:**
- Modify: `w-model-dev/references/definition-of-done.md`

> 注意：DoD 保持「七维度」不变（docs-consistency 检查 `## 七维度标准` + README 7 维度表述）；修正权验收与完成度矩阵作为**自检清单条目**，不进维度表。

- [ ] **Step 1: 自检清单追加两条（L59「L2+ 项目…」行之后）**

```
- [ ] 修正权验收：用户能在过程中间修改产物而不用整体重跑（不能 = 仅审计权，反模式 #46）
- [ ] 完成度矩阵自检：产品化轴（文档/测试/错误处理/边界/可维护性/可观测性）与系统集成轴（接口对齐/版本兼容/多环境/部署回滚/监控告警/备份）逐项打勾，任一轴缺项即未到 9x
```

- [ ] **Step 2: 理解证据说明补注（L28 段后追加）**

`> 补注（第 39 轮吸收）：acknowledgedDecisions 非空 = 判据持有者（人）在形式化门禁之外行使记叙性判断——这是"人机分工线"在阶段门上的显式兑现（能形式化 → 门禁校验；不能形式化 → 人类确认）。`

- [ ] **Step 3: 计数更新（L58）**

`- [ ] 未命中 [anti-patterns.md](anti-patterns.md) 44 条流程反模式、F1~F10 失败模式与 O1~O6 运维失败模式` → `- [ ] 未命中 [anti-patterns.md](anti-patterns.md) 46 条流程反模式、F1~F10 失败模式与 O1~O6 运维失败模式`

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/references/definition-of-done.md
git commit -m "docs: add correction-right test and nine-x matrix self-check to DoD"
```

### Task 8: phase-5-coding.md 补「任务分配规则」节

**Files:**
- Modify: `w-model-dev/references/phase-5-coding.md`

- [ ] **Step 1: 插入新节（`## 代码生成算法` L29 之前）**

```
## 任务分配规则：产品化 vs 系统集成（第 39 轮吸收）

> 吸收自《agent 时代的人月神话》第 1 章「九倍矩阵」：9x = 3x（产品化）× 3x（系统集成）。

- **产品化类任务**（判据住代码内，agent 擅长）：补文档、测试、类型注解、错误处理、边界情况、重构 → 优先分派 S 子代理。
- **系统集成类判断**（判据住大系统处境里，agent 不擅长）：对接外部系统、生产环境适配、跨模块契约裁决、版本兼容决策 → 必须由人/主刀持有，不得外包给 agent。
- 完成度判定："agent 跑通了"只证明左下角（1x 一次性脚本）；交付到右上角（可依赖构件产品）须产品化轴与系统集成轴逐项自检（见 [definition-of-done.md](definition-of-done.md)「完成度矩阵自检」）。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/phase-5-coding.md
git commit -m "docs: add productization vs system-integration task allocation to phase-5"
```

### Task 9: phase-6-integration-test.md 补「集成判断由人持有」节

**Files:**
- Modify: `w-model-dev/references/phase-6-integration-test.md`

- [ ] **Step 1: 插入新节（`## 执行方法论` L47 之前）**

```
## 集成判断由人持有（第 39 轮吸收）

集成工作的判据不住在被测代码里，住在大系统处境里——接口对齐、版本兼容、多环境隔离、部署方案的判断依赖持有全局处境的主体。集成结论由 V/人评审定，不以 agent 自报为准；"集成通过"的验收判据须在阶段 3 接口设计阶段预注册（见 [traceability-matrix.md](../templates/interface-design/traceability-matrix.md) 逐条验收判据列）。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/phase-6-integration-test.md
git commit -m "docs: add integration-judgment-held-by-human to phase-6"
```

### Task 10: 新建吸收决策记录 references/mythical-man-month-absorption.md

**Files:**
- Create: `w-model-dev/references/mythical-man-month-absorption.md`

- [ ] **Step 1: 写文件（完整内容如下）**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/mythical-man-month-absorption.md
git commit -m "docs: add mythical-man-month absorption decision record"
```

### Task 11: 反模式计数外部联动（44 → 46）

**Files:**
- Modify: `AGENTS.md` / `README.md` / `docs/INSTALL.md` / `w-model-dev/scripts/logic/docs-consistency-logic.ts` / `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`

- [ ] **Step 1: AGENTS.md L31**

`anti-patterns（44 条流程反模式 #1-#44 + L1~L4 教训 + F1~F10 失败模式 + O1~O6 运维失败模式` → `anti-patterns（46 条流程反模式 #1-#46 + L1~L4 教训 + F1~F10 失败模式 + O1~O6 运维失败模式`

- [ ] **Step 2: README.md 3 处（L82 / L149 / L266）**

`44 条流程反模式` → `46 条流程反模式`（三处）

- [ ] **Step 3: INSTALL.md L187**

`| 负面知识库（44 条反模式 + 教训） |` → `| 负面知识库（46 条反模式 + 教训） |`

- [ ] **Step 4: docs-consistency-logic.ts L51**

`  maxAntiPattern: 44,` → `  maxAntiPattern: 46,`

- [ ] **Step 5: docs-consistency-logic.test.ts L21 样本**

`    antiPatterns: '反模式清单（#1~#44；\n| 44 | 冰山扫掠... |',` → `    antiPatterns: '反模式清单（#1~#46；\n| 46 | 冰山扫掠... |',`

- [ ] **Step 6: 验证门禁**

Run: `npx vitest run w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`
Expected: 全 PASS。
Run: `npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`
Expected: exit 0「✓ 全部一致」（12 项）。

- [ ] **Step 7: Commit**

```bash
git add AGENTS.md README.md docs/INSTALL.md w-model-dev/scripts/logic/docs-consistency-logic.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts
git commit -m "chore: cascade anti-pattern count 44->46 (AGENTS/README/INSTALL/docs-consistency)"
```

### Task 12: 版本同步 38.5.0 → 39.0.0 + CHANGELOG [39.0.0]

**Files:**
- Modify: `package.json` / `w-model-dev/skill-metadata.json` / `w-model-dev/SKILL.md` / `README.md` / `docs/INSTALL.md` / `docs/skill-design-document_SSoT.md` / `CONTRIBUTING.md` / `CHANGELOG.md`

- [ ] **Step 1: package.json:3**

`  "version": "38.5.0",` → `  "version": "39.0.0",`

- [ ] **Step 2: w-model-dev/skill-metadata.json:3**

`  "version": "38.5.0",` → `  "version": "39.0.0",`（updatedAt 保持 2026-08-10）

- [ ] **Step 3: w-model-dev/SKILL.md frontmatter**

`version: 38.5.0` → `version: 39.0.0`

- [ ] **Step 4: README.md L12**

`**当前版本**：\`38.5.0\`` → `**当前版本**：\`39.0.0\``

- [ ] **Step 5: docs/INSTALL.md L141**

`version: 38.5.0` → `version: 39.0.0`

- [ ] **Step 6: SSoT L1092**

`| 版本号 | 38.5.0（三处一致） |` → `| 版本号 | 39.0.0（三处一致） |`（§3.4.38 版本行按仓库惯例更新为当前版本标记）

- [ ] **Step 7: CONTRIBUTING.md L231**

`（如 \`v38.5.0\`）` → `（如 \`v39.0.0\`）`

- [ ] **Step 8: CHANGELOG 顶部新增 [39.0.0]（插在 `## [38.5.0]` 之前）**

```markdown
## [39.0.0] - 2026-08-10

### Added
- 反模式 #45（反指标游戏：subagent 为通过测试而修改断言/测试期望）+ #46（只给审计权不给修正权）；反模式计数 44 → 46
- 主刀人设与修正权原则（subagent-delegation「主刀职责映射表」/ SKILL.md「主刀与修正权」段 / DoD「修正权验收」自检项）
- 九倍矩阵完成度自检（DoD 产品化轴×系统集成轴）+ phase-5/6 任务分配规则（产品化→agent，集成判断→人）
- 人机分工线原则（SKILL.md）+ DoD「理解证据」补注
- 吸收决策记录 `references/mythical-man-month-absorption.md`

### Changed
- dispatching-parallel-agents/SKILL.md 示例删除"调整测试期望"条款（与反模式 #45 对齐）
- testing-anti-patterns.md 补「改断言让测试通过（反指标游戏）」条目
- docs-consistency-logic.ts maxAntiPattern 44→46 + 测试样本同步
- 版本号 38.5.0 → 39.0.0（7 处同步）
```

- [ ] **Step 9: Commit**

```bash
git add package.json w-model-dev/skill-metadata.json w-model-dev/SKILL.md README.md docs/INSTALL.md docs/skill-design-document_SSoT.md CONTRIBUTING.md CHANGELOG.md
git commit -m "chore: bump 38.5.0 -> 39.0.0, changelog [39.0.0]"
```

### Task 13: 全量验证

- [ ] **Step 1: self-test 基线**

Run: `npm run self-test`
Expected: 249/249，exit 0。

- [ ] **Step 2: vitest 全量**

Run: `npx vitest run`
Expected: 35 files / 521 tests 全过（docs-consistency 样本已更新，无新增测试文件）。

- [ ] **Step 3: TypeScript strict**

Run: `npx tsc --noEmit`
Expected: 0 错误。

- [ ] **Step 4: docs-consistency**

Run: `npx tsx w-model-dev/scripts/cli/check-docs-consistency.ts`
Expected: exit 0「✓ 全部一致」（12 项）。

- [ ] **Step 5: pre-push 门禁（需 Git Bash）**

Run: `bash .githooks/pre-push --force`
Expected: 14 项全通过（Windows 用 Git Bash 执行）。

- [ ] **Step 6: 破坏样本验证（docs-consistency 反模式计数）**

临时把 `docs-consistency-logic.ts` 的 `maxAntiPattern: 46` 改回 `44` → 跑 `check-docs-consistency.ts` → exit 1（anti-patterns 违规）→ 还原为 46。

- [ ] **Step 7: 最终复核**

Run: `npx grep -rn "38.5.0" --include="*.json" --include="*.md" package.json w-model-dev/skill-metadata.json w-model-dev/SKILL.md README.md docs/INSTALL.md docs/skill-design-document_SSoT.md CONTRIBUTING.md`
Expected: 0 命中（设计/计划归档文档除外，可人工确认）。

---

## Self-Review

**1. Spec 覆盖（对照设计文档 §4 P0 四项）：**
- P0-1 反指标游戏 → T2（#45）+ T3 + T4 ✓
- P0-2 主刀与修正权 → T2（#46）+ T5 + T6 + T7（修正权验收）✓
- P0-3 九倍矩阵 → T7（完成度矩阵）+ T8 + T9 ✓
- P0-4 人机分工线 → T6（分工线段）+ T7（理解证据补注）✓
- 决策记录 → T10 ✓；计数联动 → T2 Step 5 + T7 Step 3 + T11 ✓；版本 → T12 ✓

**2. Placeholder 扫描：** 全部步骤含精确替换字符串与验证命令，无 TBD/TODO；插入内容均给出完整文本，无"类似 Task N"。

**3. 类型/计数一致性：**
- 反模式计数：T2（anti-patterns 内部 #1~#46）→ T7（DoD 46 条）→ T11（AGENTS/README/INSTALL + 逻辑 46 + 样本）→ T13 Step 4/6 验证，闭环一致。
- 版本：T12 7 处同步 + CHANGELOG，T13 Step 7 grep 复核。
- 链接路径：T5/T6/T7 新增节内 `[subagent-delegation.md]`/`[definition-of-done.md]` 均同目录引用；T2 #45 节内 `../../.cursor/skills/...` 从 references/ 起算正确。
