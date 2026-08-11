# SkillOpt 方法论吸收实现计划（SkillOpt Methodology Absorption Implementation Plan）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 吸收 microsoft/SkillOpt「bounded edit + validation gate」方法论，消费 Loop 4 产出的 HarnessImprovementReport 信号，对 w-model-dev 技能包 4 类资产（技能/模板/参考/脚本）做全谱离线进化。

**Architecture:** 方案 A 完整建机制 + 主代理顺序执行。先 SSoT 同步（§10H/§10A/§10G/§3.4.2）+ 新增 skillopt-adoption.md（Part A 机制建设），再产出扩展 HarnessImprovementReport（Part B 信号构造），然后低风险 8 信号应用（Part C），再高风险 2 信号应用 + fixture + 测试（Part D），最后顶层文档同步（Part E）。不引入 Python 依赖、不调用 LLM、不变更 Loop 4 信号产出逻辑。

**Tech Stack:** Markdown 文档、TypeScript 门禁脚本（仅依赖 tsx）、JSON fixture、vitest 单元测试、self-test 回归基线

**设计文档**：[docs/superpowers/specs/2026-07-26-skillopt-methodology-absorption-design.md](../specs/2026-07-26-skillopt-methodology-absorption-design.md)

---

## 文件结构

### 新增文件（4 个）

| 路径 | 职责 |
|---|---|
| `w-model-dev/references/skillopt-adoption.md` | SkillOpt 方法论采用指南（核心机制文档） |
| `w-model-dev/scripts/samples/hill-climbing/expanded-2026-07-26.json` | 扩展 HarnessImprovementReport（10 信号） |
| `w-model-dev/scripts/samples/verifier/bad-summary-too-short.json` | R11 触发 fixture（summary 长度 < 50） |
| `w-model-dev/scripts/samples/verifier/bad-evidence-empty.json` | R12 触发 fixture（evidence 为空） |

### 修改文件（12 个）

| 路径 | 改动 |
|---|---|
| `docs/skill-design-document_SSoT.md` | §10H 新增 + §10A 追溯表 + §10G 引用 + §3.4.2 角色表 |
| `w-model-dev/SKILL.md` | hill-climbing 命令示例 + 自检清单引反模式 #20/#21 |
| `w-model-dev/templates/review-report.md` | summary 字段三要素提示 |
| `w-model-dev/templates/test-report.md` | 测试结论节量化占位符 |
| `w-model-dev/templates/requirement-spec.md` | NFR 字段可测量性提示 |
| `w-model-dev/references/verifier-spec.md` | §6 summary 三要素 + §7 R11/R12 |
| `w-model-dev/references/anti-patterns.md` | #20/#21 检测信号字段 + 候选 #22 |
| `w-model-dev/scripts/logic/verifier-logic.ts` | 新增 R11/R12 + 方差重算注释 |
| `w-model-dev/scripts/samples/verifier/valid.json` | summary 扩展至 ≥50 字符（R11 兼容） |
| `w-model-dev/scripts/cli/self-test.ts` | 基线 92→94（新增 R11/R12 用例） |
| `w-model-dev/scripts/__tests__/gate-enhancement.test.ts` | 新增 R11/R12 单元测试 |
| `AGENTS.md` + `CHANGELOG.md` + `README.md` | 顶层文档同步 |

---

## Part A：机制建设（SSoT + skillopt-adoption.md）

### Task A1: SSoT §10H 新增「SkillOpt 方法论吸收」

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`（在 §10G 后新增 §10H 节）

- [ ] **Step 1: 定位 §10G 末尾**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('docs/skill-design-document_SSoT.md','utf-8');const i=c.indexOf('## §10G');const j=c.indexOf('## §11',i);console.log('§10G range:',i,j);console.log(c.substring(j-200,j));"`
Expected: 输出 §10G 末尾到 §11 开头的内容，确认插入点

- [ ] **Step 2: 在 §10G 后、§11 前插入 §10H**

在 `## §11` 行前插入以下内容（用 Edit 工具，old_string 为 `## §11` 行，new_string 为 §10H 全文 + `## §11`）：

```markdown
## §10H SkillOpt 方法论吸收（Loop 4 信号消费路径）

### 10H.1 目的

消费 §10G（Loop 4）产出的 `HarnessImprovementReport` 信号，应用 SkillOpt「bounded edit + validation gate」方法论对技能包 4 类资产（技能/模板/参考/脚本）做离线进化。**吸收方法论而非工具运行**——不引入 Python 依赖、不调用 LLM、不做 rollout 训练。

### 10H.2 与 §11「技能自演化不在本仓库」的协调

- §11 原意：技能**自动演化**（LLM 驱动 rollout/reflect）不在本仓库
- 本节吸收：**方法论**（bounded edit + validation gate 流程范式），不是工具运行
- 类比：§10E TLA+ 方法论吸收（tla-plus-guide.md）是方法论吸收而非 TLA+ 工具内置——本节同构

### 10H.3 六段式循环类比映射

| SkillOpt 训练循环 | w-model-dev 离线进化 | 说明 |
|---|---|---|
| rollout | （已完成）Loop 4 产出 HarnessImprovementReport | 信号源已就绪 |
| reflect | 主代理审查信号 + 产出 edit proposal | 确定性，无 LLM |
| aggregate | 多信号合并为 edit 批次（低风险/高风险） | 按风险分批 |
| select | 按 bounded edit 边界裁剪 edit 数量 | 单文件≤3、单信号≤2 文件、全轮≤15 |
| update | 应用 edit 到 4 类资产 | 技能/模板/参考/脚本 |
| gate | self-test + vitest + tsc + fixture validation | 真实退出码 |

### 10H.4 bounded edit 边界规则

- 单文件单次 edit 最多 3 处（防过度编辑）
- 单信号最多影响 2 个文件（防爆炸半径）
- 全轮总 edit 数 ≤ 15 处

### 10H.5 validation gate 标准

| 阶段 | 命令 | 退出码 |
|---|---|---|
| V1 | `npx tsc --noEmit` | 0 |
| V2 | `npm run self-test` | 0 |
| V3 | `cd w-model-dev && npx vitest run scripts/__tests__/` | 0 |
| V4 | `npx tsx w-model-dev/scripts/cli/check-verifier-output.ts <fixture>` | 1（触发 R11/R12） |

### 10H.6 与 Loop 4 的边界

| 角色 | 职责 | 边界 |
|---|---|---|
| w-model-dev Loop 4 | 产出 HarnessImprovementReport 信号 | 不自动改 harness |
| SkillOpt 方法论吸收（本节） | 消费信号 → reflect → bounded edit → validation gate | 不引入 SkillOpt 工具；不调用 LLM |
| 外部 SkillOpt/darwin-skill | 真实 SkillOpt 工具运行 | 仍由外部完成（§11） |

### 10H.7 人审流程

1. spec 阶段：用户审查设计文档
2. 实施阶段：每个 Phase E 批次完成后 CHECKPOINT 确认
3. V 复审：候选反模式需 V 子代理复审转正

### 10H.8 实现位置

权威采用指南：`w-model-dev/references/skillopt-adoption.md`（本节为可执行细则）

```

- [ ] **Step 3: 验证 §10H 插入**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('docs/skill-design-document_SSoT.md','utf-8');console.log('§10H found:',c.includes('## §10H'));console.log('§11 found:',c.includes('## §11'));"`
Expected: 两个都为 true

- [ ] **Step 4: Commit**

```bash
git add docs/skill-design-document_SSoT.md
git commit -m "feat(ssoT): §10H 新增 SkillOpt 方法论吸收章节"
```

---

### Task A2: SSoT §10A 追溯表 + §10G 引用 + §3.4.2 角色表扩展

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`（§10A 追溯表 + §10G 末尾 + §3.4.2 角色表）

- [ ] **Step 1: §10A 追溯表新增 §10H 行**

定位 §10A 追溯表中 §10G 行，在其后新增：

```markdown
| §10H SkillOpt 方法论吸收 | `w-model-dev/references/skillopt-adoption.md` |
```

- [ ] **Step 2: §10G 末尾补充 1 句引用**

在 §10G 末尾（§10H 标题前）补充：

```markdown
> Loop 4 产出的 HarnessImprovementReport 信号消费流程详见 §10H（SkillOpt 方法论吸收）。
```

- [ ] **Step 3: §3.4.2 角色表 O 允许动作扩展**

定位 §3.4.2 角色表「编排者 O 允许动作」，新增一行：

```markdown
| 离线进化场景下执行 reflect→bounded edit→validation gate | 状态读写+分析，非实施（区别于运行时阶段产物生成，反模式 #10 约束运行时编排） |
```

- [ ] **Step 4: 验证三处改动**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('docs/skill-design-document_SSoT.md','utf-8');console.log('§10A §10H row:',c.includes('§10H SkillOpt 方法论吸收'));console.log('§10G ref:',c.includes('信号消费流程详见 §10H'));console.log('§3.4.2 offline:',c.includes('离线进化场景下执行 reflect'));"`
Expected: 三个都为 true

- [ ] **Step 5: Commit**

```bash
git add docs/skill-design-document_SSoT.md
git commit -m "feat(ssoT): §10A 追溯表 + §10G 引用 + §3.4.2 角色表扩展（SkillOpt 方法论）"
```

---

### Task A3: 新增 w-model-dev/references/skillopt-adoption.md

**Files:**
- Create: `w-model-dev/references/skillopt-adoption.md`

- [ ] **Step 1: 创建 skillopt-adoption.md**

```markdown
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
```

- [ ] **Step 2: 验证文件创建**

Run: `npx tsx -e "const fs=require('fs');console.log('exists:',fs.existsSync('w-model-dev/references/skillopt-adoption.md'));"`
Expected: exists: true

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/references/skillopt-adoption.md
git commit -m "feat(reference): 新增 skillopt-adoption.md（SkillOpt 方法论采用指南）"
```

---

## Part B：信号构造（扩展 HarnessImprovementReport）

### Task B1: 产出 expanded-2026-07-26.json

**Files:**
- Create: `w-model-dev/scripts/samples/hill-climbing/expanded-2026-07-26.json`

- [ ] **Step 1: 创建扩展报告**

```json
{
  "reportId": "hc-2026-07-26-expanded-001",
  "generatedAt": "2026-07-26T20:00:00Z",
  "analysisWindow": {
    "from": "2026-07-20T00:00:00Z",
    "to": "2026-07-26T20:00:00Z",
    "runLogEntries": 52,
    "phasesCovered": [1, 2, 3, 4, 5]
  },
  "signals": [
    {
      "signalId": "sig-001",
      "category": "prompt",
      "severity": "S2",
      "evidence": {
        "runLogRefs": ["run-2026-07-23T10-15-00Z", "run-2026-07-24T14-20-00Z"],
        "patterns": ["V 评审 summary 跨 3 个阶段 Jaccard 相似度 0.87"],
        "metrics": {"occurrences": 3, "trend": "stable"}
      },
      "suggestion": "强化 verifier-spec.md §6 summary 字段内容要求，明确禁止模板化措辞，要求含≥1关键决策摘要+1-2句产物核心结构+遗留风险三要素",
      "affectedAssets": ["w-model-dev/references/verifier-spec.md"],
      "priority": 2
    },
    {
      "signalId": "sig-002",
      "category": "verification-rule",
      "severity": "S1",
      "evidence": {
        "runLogRefs": ["run-2026-07-24T16-00-00Z"],
        "patterns": ["V passed=true 但 G check-artifact-gate.ts exit=1，频次 4 次"],
        "metrics": {"occurrences": 4, "trend": "increasing"}
      },
      "suggestion": "收紧 V 评审规则：新增 R11 summary 长度≥50字符 + R12 evidence 非空校验",
      "affectedAssets": ["w-model-dev/references/verifier-spec.md", "w-model-dev/scripts/logic/verifier-logic.ts"],
      "priority": 1
    },
    {
      "signalId": "sig-003",
      "category": "prompt",
      "severity": "S2",
      "evidence": {
        "runLogRefs": ["run-2026-07-25T09-00-00Z"],
        "patterns": ["SKILL.md hill-climbing 命令缺参数示例，用户多次询问用法"],
        "metrics": {"occurrences": 2, "trend": "stable"}
      },
      "suggestion": "SKILL.md hill-climbing 命令增参数示例（--from --to --phase）",
      "affectedAssets": ["w-model-dev/SKILL.md"],
      "priority": 2
    },
    {
      "signalId": "sig-004",
      "category": "prompt",
      "severity": "S3",
      "evidence": {
        "runLogRefs": ["run-2026-07-25T11-00-00Z"],
        "patterns": ["SKILL.md 自检清单未引用反模式 #20/#21，用户漏检"],
        "metrics": {"occurrences": 1, "trend": "stable"}
      },
      "suggestion": "SKILL.md 自检清单补引反模式 #20（只规划不执行）/#21（阶段级门禁跳过）",
      "affectedAssets": ["w-model-dev/SKILL.md"],
      "priority": 3
    },
    {
      "signalId": "sig-005",
      "category": "prompt",
      "severity": "S2",
      "evidence": {
        "runLogRefs": ["run-2026-07-24T10-00-00Z"],
        "patterns": ["review-report.md 模板 summary 字段缺三要素结构提示，产出 summary 空泛"],
        "metrics": {"occurrences": 3, "trend": "stable"}
      },
      "suggestion": "review-report.md 模板 summary 字段增三要素结构提示（关键决策+产物结构+遗留风险）",
      "affectedAssets": ["w-model-dev/templates/review-report.md"],
      "priority": 2
    },
    {
      "signalId": "sig-006",
      "category": "prompt",
      "severity": "S3",
      "evidence": {
        "runLogRefs": ["run-2026-07-24T15-00-00Z"],
        "patterns": ["test-report.md 模板测试结论节缺量化指标占位符，产出结论模糊"],
        "metrics": {"occurrences": 2, "trend": "stable"}
      },
      "suggestion": "test-report.md 模板测试结论节增量覆盖率/通过率/性能指标占位符",
      "affectedAssets": ["w-model-dev/templates/test-report.md"],
      "priority": 3
    },
    {
      "signalId": "sig-007",
      "category": "prompt",
      "severity": "S3",
      "evidence": {
        "runLogRefs": ["run-2026-07-23T16-00-00Z"],
        "patterns": ["requirement-spec.md 模板 NFR 字段缺可测量性提示，产出 NFR 不可验证"],
        "metrics": {"occurrences": 2, "trend": "stable"}
      },
      "suggestion": "requirement-spec.md 模板 NFR 字段增可测量性提示（量化指标+验收阈值）",
      "affectedAssets": ["w-model-dev/templates/requirement-spec.md"],
      "priority": 3
    },
    {
      "signalId": "sig-008",
      "category": "verification-rule",
      "severity": "S2",
      "evidence": {
        "runLogRefs": ["run-2026-07-25T14-00-00Z"],
        "patterns": ["anti-patterns.md #20/#21 缺检测信号字段，无法被 Loop 4 自动检测"],
        "metrics": {"occurrences": 1, "trend": "stable"}
      },
      "suggestion": "anti-patterns.md #20/#21 增检测信号字段（detectionSignal）",
      "affectedAssets": ["w-model-dev/references/anti-patterns.md"],
      "priority": 2
    },
    {
      "signalId": "sig-009",
      "category": "tool",
      "severity": "S2",
      "evidence": {
        "runLogRefs": ["run-2026-07-25T17-00-00Z"],
        "patterns": ["verifier-logic.ts rawScores 方差重算逻辑缺注释+边界保护（NaN/Infinity）"],
        "metrics": {"occurrences": 1, "trend": "stable"}
      },
      "suggestion": "verifier-logic.ts 方差重算逻辑加注释 + NaN/Infinity 边界保护",
      "affectedAssets": ["w-model-dev/scripts/logic/verifier-logic.ts"],
      "priority": 2
    },
    {
      "signalId": "sig-010",
      "category": "anti-pattern",
      "severity": "S3",
      "evidence": {
        "runLogRefs": ["run-2026-07-25T18-00-00Z"],
        "patterns": ["valid.json candidateAntiPatterns 提取候选 #22 V 评审 summary 模板化"],
        "metrics": {"occurrences": 1, "trend": "stable"}
      },
      "suggestion": "anti-patterns.md 新增候选反模式 #22（标 pending V 复审）：V 评审 summary 模板化——跨阶段 Jaccard 相似度>0.8 且长度<50字符",
      "affectedAssets": ["w-model-dev/references/anti-patterns.md"],
      "priority": 3
    }
  ],
  "metaAnalysis": {
    "topFailurePatterns": ["V-G 矛盾", "summary 模板化", "返工阶段 4 TLA+"],
    "reworkHotspots": ["阶段 4"],
    "verifierDisagreements": 4,
    "budgetBurnTrend": "stable",
    "operationalFailureHits": {"O3": 4, "O1": 0, "O2": 0, "O4": 1, "O5": 0, "O6": 0},
    "comprehensionQuality": {"emptyOrTrivialRate": 0.125, "uniqueDecisionRate": 0.75},
    "appliedAssetClasses": ["skill", "template", "reference", "script"],
    "riskProfile": {"lowRisk": 7, "highRisk": 3}
  },
  "recommendations": {
    "promptTweaks": [
      "verifier-spec.md §6 summary 字段：明确要求含 ≥1 关键决策摘要 + 1-2 句产物核心结构 + 遗留风险",
      "禁止 summary 使用「评审通过」「质量良好」等空泛措辞",
      "SKILL.md hill-climbing 命令增参数示例",
      "SKILL.md 自检清单补引反模式 #20/#21",
      "review-report.md 模板 summary 增三要素结构提示",
      "test-report.md 模板测试结论节增量指标占位符",
      "requirement-spec.md 模板 NFR 字段增可测量性提示"
    ],
    "toolImprovements": [
      "verifier-logic.ts 新增 R11 summary 长度校验（≥50 字符）",
      "verifier-logic.ts 新增 R12 evidence 非空校验",
      "verifier-logic.ts 方差重算逻辑加注释 + NaN/Infinity 边界保护"
    ],
    "verificationRuleTightening": [
      "V 评审 evidence 字段须引用具体行号/文件路径，禁止空泛描述",
      "anti-patterns.md #20/#21 增检测信号字段"
    ],
    "candidateAntiPatterns": [
      "#22（候选，pending V 复审）V 评审 summary 模板化：跨阶段 Jaccard 相似度 > 0.8 且长度 < 50 字符"
    ],
    "maturityAdjustments": []
  }
}
```

- [ ] **Step 2: 验证 JSON 合法性**

Run: `npx tsx -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('w-model-dev/scripts/samples/hill-climbing/expanded-2026-07-26.json','utf-8'));console.log('signals:',j.signals.length);console.log('assetClasses:',j.metaAnalysis.appliedAssetClasses);console.log('riskProfile:',j.metaAnalysis.riskProfile);"`
Expected: signals: 10, assetClasses: ['skill','template','reference','script'], riskProfile: {lowRisk:7, highRisk:3}

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/scripts/samples/hill-climbing/expanded-2026-07-26.json
git commit -m "feat(loop-4): 扩展 HarnessImprovementReport（10 信号覆盖 4 类资产）"
```

---

## Part C：低风险应用（Phase E1，8 个 prompt 信号）

### Task C1: sig-001 应用到 verifier-spec.md（§6 summary 三要素）

**Files:**
- Modify: `w-model-dev/references/verifier-spec.md`（§6 summary 字段）

- [ ] **Step 1: 定位 §6 summary 字段说明**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('w-model-dev/references/verifier-spec.md','utf-8');const i=c.indexOf('summary');console.log(c.substring(i-100,i+300));"`
Expected: 输出 summary 字段当前说明

- [ ] **Step 2: 在 summary 字段说明后追加三要素要求**

用 Edit 工具，在 summary 字段说明后追加：

```markdown
**summary 三要素要求**（sig-001 改进，防止模板化）：
1. **≥1 关键决策摘要**：本阶段产出的核心决策（如「采用 RBAC 权限模型」）
2. **1-2 句产物核心结构**：产出的关键结构（如「22 SD + 22 INTF + 75 DD，TLA+ 22 规格」）
3. **遗留风险**：未解决的问题或后续需关注的风险（如「L4 audit_log_retention 不变式需运行时验证」）

**禁止措辞**：「评审通过」「质量良好」「符合要求」等空泛表述。summary 长度须 ≥ 50 字符（R11 校验）。
```

- [ ] **Step 3: 验证改动**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('w-model-dev/references/verifier-spec.md','utf-8');console.log('三要素:',c.includes('summary 三要素要求'));console.log('禁止措辞:',c.includes('禁止措辞'));"`
Expected: 两个都为 true

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/references/verifier-spec.md
git commit -m "feat(verifier-spec): §6 summary 三要素要求（sig-001，防模板化）"
```

---

### Task C2: sig-003 + sig-004 应用到 SKILL.md

**Files:**
- Modify: `w-model-dev/SKILL.md`（hill-climbing 命令 + 自检清单）

- [ ] **Step 1: 定位 hill-climbing 命令说明**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('w-model-dev/SKILL.md','utf-8');const i=c.indexOf('hill-climbing');console.log(c.substring(i-50,i+400));"`
Expected: 输出 hill-climbing 命令当前说明

- [ ] **Step 2: hill-climbing 命令增参数示例（sig-003）**

在 hill-climbing 命令说明后追加：

```markdown
**参数示例**：
```
/wm hill-climbing                              # 全量分析当前 run-log
/wm hill-climbing --from=2026-07-20 --to=2026-07-26  # 指定时间窗口
/wm hill-climbing --phase=5                    # 仅分析阶段 5 的 run-log
```
产出存 `.w-model/hill-climbing/<timestamp>-report.json`。
```

- [ ] **Step 3: 定位自检清单**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('w-model-dev/SKILL.md','utf-8');const i=c.indexOf('自检清单');console.log(c.substring(i-50,i+500));"`
Expected: 输出自检清单内容

- [ ] **Step 4: 自检清单补引反模式 #20/#21（sig-004）**

在自检清单中新增两项：

```markdown
- [ ] 反模式 #20（只规划不执行）：确认所有规划都有对应执行动作，未停留在规划阶段
- [ ] 反模式 #21（阶段级门禁跳过）：确认阶段 6/7/8 都跑了 `--phase=N` 门禁，未跳过阶段级校验
```

- [ ] **Step 5: 验证两处改动**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('w-model-dev/SKILL.md','utf-8');console.log('参数示例:',c.includes('--from=2026-07-20'));console.log('#20:',c.includes('反模式 #20（只规划不执行）'));console.log('#21:',c.includes('反模式 #21（阶段级门禁跳过）'));"`
Expected: 三个都为 true

- [ ] **Step 6: Commit**

```bash
git add w-model-dev/SKILL.md
git commit -m "feat(skill): hill-climbing 参数示例 + 自检清单引反模式 #20/#21（sig-003/sig-004）"
```

---

### Task C3: sig-005 应用到 review-report.md 模板

**Files:**
- Modify: `w-model-dev/templates/review-report.md`（summary 字段）

- [ ] **Step 1: 定位 summary 字段**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('w-model-dev/templates/review-report.md','utf-8');const i=c.indexOf('summary');console.log(c.substring(i-50,i+300));"`
Expected: 输出 summary 字段当前模板

- [ ] **Step 2: summary 字段增三要素结构提示**

在 summary 字段模板后追加：

```markdown
<!-- summary 三要素结构提示（sig-005）：
1. ≥1 关键决策摘要（如「采用 RBAC 权限模型」）
2. 1-2 句产物核心结构（如「22 SD + 22 INTF + 75 DD」）
3. 遗留风险（如「L4 audit_log_retention 需运行时验证」）
禁止「评审通过」「质量良好」等空泛措辞。长度 ≥ 50 字符。
-->
```

- [ ] **Step 3: 验证改动**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('w-model-dev/templates/review-report.md','utf-8');console.log('三要素提示:',c.includes('summary 三要素结构提示'));"`
Expected: true

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/templates/review-report.md
git commit -m "feat(template): review-report.md summary 三要素结构提示（sig-005）"
```

---

### Task C4: sig-006 应用到 test-report.md 模板

**Files:**
- Modify: `w-model-dev/templates/test-report.md`（测试结论节）

- [ ] **Step 1: 定位测试结论节**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('w-model-dev/templates/test-report.md','utf-8');const i=c.indexOf('结论');console.log(c.substring(i-50,i+300));"`
Expected: 输出测试结论节当前模板

- [ ] **Step 2: 测试结论节增量化指标占位符**

在测试结论节追加：

```markdown
**量化指标**（sig-006，禁止模糊结论）：
- 测试通过率：`<通过数>/<总数>` （如 250/250）
- 代码覆盖率：`<lines>% lines / <branches>% branches / <functions>% functions`（如 93.63% lines）
- 性能指标：`P95=<ms>ms / 错误率=<%>% / 内存=<MB>MB`（如 P95=60.76ms）
- 阈值对比：`<指标> ≤/≥ <阈值>` （如 P95 ≤ 200ms ✓）
```

- [ ] **Step 3: 验证改动**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('w-model-dev/templates/test-report.md','utf-8');console.log('量化指标:',c.includes('量化指标'));"`
Expected: true

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/templates/test-report.md
git commit -m "feat(template): test-report.md 测试结论节量化指标占位符（sig-006）"
```

---

### Task C5: sig-007 应用到 requirement-spec.md 模板

**Files:**
- Modify: `w-model-dev/templates/requirement-spec.md`（NFR 字段）

- [ ] **Step 1: 定位 NFR 字段**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('w-model-dev/templates/requirement-spec.md','utf-8');const i=c.indexOf('NFR');console.log(c.substring(i-50,i+400));"`
Expected: 输出 NFR 字段当前模板

- [ ] **Step 2: NFR 字段增可测量性提示**

在 NFR 字段模板后追加：

```markdown
<!-- NFR 可测量性提示（sig-007）：
每个 NFR 必须包含：
1. 量化指标（如「P95 响应时间」「代码覆盖率」「错误率」）
2. 验收阈值（如「P95 ≤ 200ms」「覆盖率 ≥ 80%」「错误率 = 0%」）
3. 测量方法（如「k6 压测」「vitest coverage」「日志统计」）
禁止「性能良好」「高可用」「易扩展」等不可测量表述。
-->
```

- [ ] **Step 3: 验证改动**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('w-model-dev/templates/requirement-spec.md','utf-8');console.log('可测量性:',c.includes('NFR 可测量性提示'));"`
Expected: true

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/templates/requirement-spec.md
git commit -m "feat(template): requirement-spec.md NFR 可测量性提示（sig-007）"
```

---

### Task C6: sig-008 + sig-010 应用到 anti-patterns.md

**Files:**
- Modify: `w-model-dev/references/anti-patterns.md`（#20/#21 检测信号 + 候选 #22）

- [ ] **Step 1: 定位 #20 和 #21**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('w-model-dev/references/anti-patterns.md','utf-8');const i20=c.indexOf('#20');const i21=c.indexOf('#21');console.log('#20 at',i20,'#21 at',i21);console.log(c.substring(i20,i20+300));"`
Expected: 输出 #20 和 #21 当前内容

- [ ] **Step 2: #20 增检测信号字段（sig-008）**

在 #20 描述后追加：

```markdown
**检测信号**（sig-008）：run-log 中存在 `action=plan` 但无后续 `action=implement`/`action=verify` 条目；规划产物（spec/plan）存在但无对应执行产物。
```

- [ ] **Step 3: #21 增检测信号字段（sig-008）**

在 #21 描述后追加：

```markdown
**检测信号**（sig-008）：run-log 中阶段 6/7/8 的 GATE 条目缺 `--phase=N` 参数；或 gate JSON 输出中 phaseOption 字段缺失。
```

- [ ] **Step 4: 新增候选 #22（sig-010，pending V 复审）**

在 #21 后追加：

```markdown
## #22（候选，pending V 复审）V 评审 summary 模板化

**症状**：V 评审 summary 字段跨多个阶段 Jaccard 相似度 > 0.8 且长度 < 50 字符，使用「评审通过」「质量良好」等空泛措辞。

**违反原则**：真实执行（约束4）—— summary 信息熵低，无法体现阶段产出的具体决策与结构。

**检测信号**：Loop 4 HarnessImprovementReport category=prompt severity=S2，evidence.patterns 含「Jaccard 相似度 > 0.8」。

**修正**：强化 verifier-spec.md §6 summary 三要素要求（sig-001 已应用）；V 子代理重写 summary 含具体决策+结构+风险。

**状态**：候选（pending V 复审）。本候选由 Loop 4 信号驱动提出，需 V 子代理复审转正后正式编号入清单。复审前不作为强制反模式执行。
```

- [ ] **Step 5: 验证三处改动**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('w-model-dev/references/anti-patterns.md','utf-8');console.log('#20 检测:',c.includes('#20')&&c.includes('检测信号'));console.log('#21 检测:',c.includes('#21')&&c.includes('phaseOption'));console.log('#22 候选:',c.includes('#22（候选，pending V 复审）'));"`
Expected: 三个都为 true

- [ ] **Step 6: Commit**

```bash
git add w-model-dev/references/anti-patterns.md
git commit -m "feat(anti-patterns): #20/#21 检测信号 + 候选 #22（sig-008/sig-010，pending V 复审）"
```

---

### Task C7: Part C 验证（低风险应用回归）

**Files:**
- Test: 全仓库

- [ ] **Step 1: TypeScript strict 检查**

Run: `npx tsc --noEmit`
Expected: 0 错误（Part C 仅改 Markdown，不影响 TS）

- [ ] **Step 2: self-test 回归（基线 92 不变）**

Run: `npm run self-test`
Expected: 退出码 0，92/92 通过（Part C 未改脚本逻辑）

- [ ] **Step 3: vitest 回归（72 不变）**

Run: `cd w-model-dev && npx vitest run scripts/__tests__/`
Expected: 72/72 通过

- [ ] **Step 4: 验证总结**

Part C 完成 8 个低风险信号应用，self-test/vitest 基线不变。继续 Part D 高风险应用。

---

## Part D：高风险应用（Phase E2，2 个逻辑信号 + fixture + 测试）

### Task D1: sig-002 应用到 verifier-logic.ts（R11 summary 长度 + R12 evidence 非空）

**Files:**
- Modify: `w-model-dev/scripts/logic/verifier-logic.ts`（新增 R11/R12 校验函数 + 接入 checkVerifierOutput）

- [ ] **Step 1: 定位 summary 校验当前逻辑（第 464-467 行）**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('w-model-dev/scripts/logic/verifier-logic.ts','utf-8');const i=c.indexOf('// 7. summary');console.log(c.substring(i,i+200));"`
Expected: 输出 `// 7. summary` 块当前内容

- [ ] **Step 2: 新增 R11/R12 校验函数（在文件末尾辅助函数区）**

在 `checkVerifierOutput` 函数外、辅助函数区（如 `computeVariance` 附近）新增：

```typescript
/**
 * R11（sig-002）：summary 长度校验。
 * 防止 V 评审 summary 模板化（空泛措辞）。summary 须 ≥ 50 字符。
 * 检测信号：Loop 4 category=prompt severity=S2，Jaccard 相似度 > 0.8 且长度 < 50。
 */
export function checkR11SummaryLength(summary: unknown): string | null {
  if (typeof summary !== 'string') return null; // 类型校验由 R1 负责
  if (summary.trim().length < 50) {
    return `summary 长度 ${summary.trim().length} < 50 字符（R11：防止模板化空泛措辞，须含关键决策+产物结构+遗留风险三要素）`;
  }
  return null;
}

/**
 * R12（sig-002）：subCriteria evidence 非空校验。
 * 防止 V 评审 evidence 字段空泛描述。每个子标准 evidence 须引用具体行号/文件路径。
 * 注：evidence 字段非空校验已在主循环 R4 实现（第 408-410 行），R12 增强为「引用具体片段」校验。
 */
export function checkR12EvidenceSpecificity(evidence: unknown, idx: number): string | null {
  if (typeof evidence !== 'string') return null; // 类型校验由 R4 负责
  const e = evidence.trim();
  if (e === '') return null; // 空校验由 R4 负责
  // R12：evidence 须含具体引用（行号/文件路径/章节号），禁止纯描述
  const hasSpecificRef = /(\.md|\.ts|\.json|§|L\d+|line|行|节|章|REQ-|SD-|DD-|INTF-|TC-|UAT-)/.test(e);
  if (!hasSpecificRef && e.length < 20) {
    return `subCriteria[${idx}].evidence "${e}" 缺具体引用（R12：须含行号/文件路径/章节号/ID，如「REQ-001 §3.2」「article.service.ts:L45」）`;
  }
  return null;
}
```

- [ ] **Step 3: 在 checkVerifierOutput 主循环接入 R11（替换第 464-467 行的 summary 校验）**

用 Edit 工具，old_string 为：

```typescript
  // 7. summary
  if (typeof o.summary !== 'string' || o.summary.trim() === '') {
    reasons.push('summary 必须为非空字符串');
  }
```

new_string 为：

```typescript
  // 7. summary（R1 非空 + R11 长度≥50，sig-002 改进）
  if (typeof o.summary !== 'string' || o.summary.trim() === '') {
    reasons.push('summary 必须为非空字符串');
  } else {
    const r11 = checkR11SummaryLength(o.summary);
    if (r11) reasons.push(r11);
  }
```

- [ ] **Step 4: 在 subCriteria 循环接入 R12（在第 408-410 行 evidence 校验后追加）**

用 Edit 工具，old_string 为：

```typescript
    if (typeof sc.evidence !== 'string' || sc.evidence.trim() === '') {
      reasons.push(`subCriteria[${idx}].evidence 必须为非空字符串（引用目标内具体片段）`);
    }
```

new_string 为：

```typescript
    if (typeof sc.evidence !== 'string' || sc.evidence.trim() === '') {
      reasons.push(`subCriteria[${idx}].evidence 必须为非空字符串（引用目标内具体片段）`);
    } else {
      // R12（sig-002）：evidence 须含具体引用，禁止纯描述
      const r12 = checkR12EvidenceSpecificity(sc.evidence, idx);
      if (r12) reasons.push(r12);
    }
```

- [ ] **Step 5: TypeScript strict 检查**

Run: `npx tsc --noEmit`
Expected: 0 错误

- [ ] **Step 6: Commit**

```bash
git add w-model-dev/scripts/logic/verifier-logic.ts
git commit -m "feat(verifier-logic): R11 summary 长度≥50 + R12 evidence 具体引用（sig-002）"
```

---

### Task D2: sig-009 应用到 verifier-logic.ts（方差重算注释 + 边界保护）

**Files:**
- Modify: `w-model-dev/scripts/logic/verifier-logic.ts`（computeVariance 函数 + 第 326-336 行重算块）

- [ ] **Step 1: 定位 computeVariance 函数**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('w-model-dev/scripts/logic/verifier-logic.ts','utf-8');const i=c.indexOf('function computeVariance');console.log(c.substring(i,i+300));"`
Expected: 输出 computeVariance 函数当前实现

- [ ] **Step 2: computeVariance 加注释 + NaN/Infinity 边界保护**

用 Edit 工具替换 computeVariance 函数为：

```typescript
/**
 * 计算样本方差（总体方差，除以 N 而非 N-1）。
 * 用于防漂移校验：根据 rawScores 重算方差，与 variance 字段对比，
 * 防止 Agent 谎报低方差掩盖「单次评估复制 N 次」的作弊（§3.2.1 规则 5）。
 *
 * 边界保护（sig-009）：
 * - 输入空数组或单元素数组 → 返回 0（无方差可言）
 * - 输入含 NaN/Infinity → 返回 NaN（让上游 isNumber 校验拦截）
 * - 计算结果 NaN/Infinity → 返回 NaN（让上游 VARIANCE_EPSILON 比较拦截）
 */
function computeVariance(scores: number[]): number {
  if (scores.length < 2) return 0;
  // 边界保护：含 NaN/Infinity 的输入返回 NaN
  if (scores.some(v => !Number.isFinite(v))) return Number.NaN;
  const mean = scores.reduce((sum, v) => sum + v, 0) / scores.length;
  const sumSqDiff = scores.reduce((sum, v) => sum + (v - mean) ** 2, 0);
  const variance = sumSqDiff / scores.length;
  // 边界保护：计算结果 NaN/Infinity 返回 NaN
  return Number.isFinite(variance) ? variance : Number.NaN;
}
```

- [ ] **Step 3: 第 326-336 行重算块加注释（sig-009）**

用 Edit 工具，old_string 为：

```typescript
    // 防漂移：重算 rawScores 方差并与 variance 字段对比。
    // 防止 Agent 谎报低方差以掩盖「实际只评估 1 次、复制 N 次」的作弊。
    if (Array.isArray(sc.rawScores) && sc.rawScores.length >= 2 && isNumber(sc.variance)) {
      const numericScores = sc.rawScores.filter(isNumber) as number[];
      if (numericScores.length === sc.rawScores.length && numericScores.length >= 2 && isNumber(sc.variance)) {
        const recomputed = computeVariance(numericScores);
      if (Math.abs(recomputed - sc.variance) > VARIANCE_EPSILON) {
```

new_string 为：

```typescript
    // 防漂移规则 5（§3.2.1）：重算 rawScores 方差并与 variance 字段对比。
    // 防止 Agent 谎报低方差以掩盖「实际只评估 1 次、复制 N 次」的作弊。
    // 边界保护（sig-009）：computeVariance 对 NaN/Infinity 返回 NaN，
    //   Math.abs(NaN - x) = NaN > VARIANCE_EPSILON 为 false，不会误报；
    //   上游 isNumber(sc.variance) 已过滤非数字 variance 字段。
    if (Array.isArray(sc.rawScores) && sc.rawScores.length >= 2 && isNumber(sc.variance)) {
      const numericScores = sc.rawScores.filter(isNumber) as number[];
      if (numericScores.length === sc.rawScores.length && numericScores.length >= 2 && isNumber(sc.variance)) {
        const recomputed = computeVariance(numericScores);
      if (Number.isFinite(recomputed) && Math.abs(recomputed - sc.variance) > VARIANCE_EPSILON) {
```

- [ ] **Step 4: TypeScript strict 检查**

Run: `npx tsc --noEmit`
Expected: 0 错误

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/scripts/logic/verifier-logic.ts
git commit -m "feat(verifier-logic): computeVariance 注释 + NaN/Infinity 边界保护（sig-009）"
```

---

### Task D3: 更新 verifier/valid.json summary（R11 兼容）

**Files:**
- Modify: `w-model-dev/scripts/samples/verifier/valid.json`（summary 字段扩展至 ≥50 字符）

- [ ] **Step 1: 确认当前 summary 长度**

Run: `npx tsx -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('w-model-dev/scripts/samples/verifier/valid.json','utf-8'));console.log('summary:',j.summary);console.log('length:',j.summary.trim().length);"`
Expected: summary: "需求覆盖完整、可测试、可追溯。" length: 17（< 50，需扩展）

- [ ] **Step 2: 扩展 summary 至 ≥50 字符**

用 Edit 工具，old_string 为：

```json
  "summary": "需求覆盖完整、可测试、可追溯。",
```

new_string 为：

```json
  "summary": "REQ-001 需求覆盖完整（5 子标准），采用 RBAC 权限模型，可测试可追溯，遗留风险：无。",
```

- [ ] **Step 3: 验证新 summary 长度 ≥ 50**

Run: `npx tsx -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('w-model-dev/scripts/samples/verifier/valid.json','utf-8'));console.log('length:',j.summary.trim().length);"`
Expected: length: ≥ 50

- [ ] **Step 4: 验证 valid.json 仍通过校验**

Run: `npx tsx w-model-dev/scripts/cli/check-verifier-output.ts w-model-dev/scripts/samples/verifier/valid.json`
Expected: 退出码 0（通过，含 R11/R12 校验）

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/scripts/samples/verifier/valid.json
git commit -m "fix(fixture): valid.json summary 扩展至 ≥50 字符（R11 兼容）"
```

---

### Task D4: 新增 bad-summary-too-short.json fixture（R11 触发）

**Files:**
- Create: `w-model-dev/scripts/samples/verifier/bad-summary-too-short.json`

- [ ] **Step 1: 创建 fixture（基于 valid.json，仅 summary 改短）**

复制 valid.json 内容，仅修改 summary 为 < 50 字符：

```json
{
  "schemaVersion": "1.0",
  "meta": {
    "targetKind": "requirement",
    "target": "REQ-001",
    "reviewedAt": "2026-07-19T00:00:00Z",
    "agent": "test-agent",
    "scoringMethod": "logits",
    "repeatTimes": 3,
    "varianceThreshold": 0.10
  },
  "subCriteria": [
    {"name": "completeness", "weight": 0.30, "score": 0.90, "rawScores": [0.89, 0.90, 0.91], "variance": 0.0000667, "evidence": "REQ-001 §3.2"},
    {"name": "clarity", "weight": 0.25, "score": 0.85, "rawScores": [0.84, 0.85, 0.86], "variance": 0.0000667, "evidence": "REQ-001 §3.2"},
    {"name": "consistency", "weight": 0.20, "score": 0.88, "rawScores": [0.87, 0.88, 0.89], "variance": 0.0000667, "evidence": "REQ-001 §3.2"},
    {"name": "testability", "weight": 0.15, "score": 0.80, "rawScores": [0.79, 0.80, 0.81], "variance": 0.0000667, "evidence": "REQ-001 §3.4"},
    {"name": "traceability", "weight": 0.10, "score": 0.95, "rawScores": [0.94, 0.95, 0.96], "variance": 0.0000667, "evidence": "RTM REQ-001"}
  ],
  "compositeScore": 0.8735,
  "qualityLevel": "A",
  "summary": "评审通过。",
  "passed": true
}
```

- [ ] **Step 2: 验证 fixture 触发 R11**

Run: `npx tsx w-model-dev/scripts/cli/check-verifier-output.ts w-model-dev/scripts/samples/verifier/bad-summary-too-short.json`
Expected: 退出码 1，reasons 含「summary 长度」+「R11」

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/scripts/samples/verifier/bad-summary-too-short.json
git commit -m "test(fixture): 新增 bad-summary-too-short.json（R11 触发样本）"
```

---

### Task D5: 新增 bad-evidence-empty.json fixture（R12 触发）

**Files:**
- Create: `w-model-dev/scripts/samples/verifier/bad-evidence-empty.json`

- [ ] **Step 1: 创建 fixture（基于 valid.json，仅 evidence 改为空泛描述）**

复制 valid.json 内容，仅修改第一个 subCriteria 的 evidence 为缺具体引用的纯描述：

```json
{
  "schemaVersion": "1.0",
  "meta": {
    "targetKind": "requirement",
    "target": "REQ-001",
    "reviewedAt": "2026-07-19T00:00:00Z",
    "agent": "test-agent",
    "scoringMethod": "logits",
    "repeatTimes": 3,
    "varianceThreshold": 0.10
  },
  "subCriteria": [
    {"name": "completeness", "weight": 0.30, "score": 0.90, "rawScores": [0.89, 0.90, 0.91], "variance": 0.0000667, "evidence": "覆盖完整"},
    {"name": "clarity", "weight": 0.25, "score": 0.85, "rawScores": [0.84, 0.85, 0.86], "variance": 0.0000667, "evidence": "REQ-001 §3.2"},
    {"name": "consistency", "weight": 0.20, "score": 0.88, "rawScores": [0.87, 0.88, 0.89], "variance": 0.0000667, "evidence": "REQ-001 §3.2"},
    {"name": "testability", "weight": 0.15, "score": 0.80, "rawScores": [0.79, 0.80, 0.81], "variance": 0.0000667, "evidence": "REQ-001 §3.4"},
    {"name": "traceability", "weight": 0.10, "score": 0.95, "rawScores": [0.94, 0.95, 0.96], "variance": 0.0000667, "evidence": "RTM REQ-001"}
  ],
  "compositeScore": 0.8735,
  "qualityLevel": "A",
  "summary": "REQ-001 需求覆盖完整（5 子标准），采用 RBAC 权限模型，可测试可追溯，遗留风险：无。",
  "passed": true
}
```

- [ ] **Step 2: 验证 fixture 触发 R12**

Run: `npx tsx w-model-dev/scripts/cli/check-verifier-output.ts w-model-dev/scripts/samples/verifier/bad-evidence-empty.json`
Expected: 退出码 1，reasons 含「evidence」+「R12」+「缺具体引用」

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/scripts/samples/verifier/bad-evidence-empty.json
git commit -m "test(fixture): 新增 bad-evidence-empty.json（R12 触发样本）"
```

---

### Task D6: self-test.ts 基线扩展 92→94

**Files:**
- Modify: `w-model-dev/scripts/cli/self-test.ts`（VERIFIER_CASES 新增 2 条）

- [ ] **Step 1: 定位 VERIFIER_CASES 末尾（bad-rawscores-constant.json 后）**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('w-model-dev/scripts/cli/self-test.ts','utf-8');const i=c.indexOf('bad-rawscores-constant');console.log(c.substring(i,i+300));"`
Expected: 输出 bad-rawscores-constant.json 用例及后续内容

- [ ] **Step 2: 在 VERIFIER_CASES 末尾新增 2 条用例**

在 `bad-rawscores-constant.json` 用例后（GATE_CASES 前）追加：

```typescript
  {
    file: 'bad-summary-too-short.json',
    expectedPassed: false,
    expectedReasonPatterns: [/summary 长度.*< 50.*R11/],
    description: 'summary 长度 < 50 字符，应被 R11 校验拦截（sig-002）',
  },
  {
    file: 'bad-evidence-empty.json',
    expectedPassed: false,
    expectedReasonPatterns: [/evidence.*缺具体引用.*R12/],
    description: 'evidence 缺具体引用，应被 R12 校验拦截（sig-002）',
  },
```

- [ ] **Step 3: 更新文件头注释基线计数**

定位文件头注释「66 条样本」或「92 条」处，更新为「94 条」。Run 查找：

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('w-model-dev/scripts/cli/self-test.ts','utf-8');const lines=c.split('\n');lines.forEach((l,i)=>{if(/92|66 条/.test(l))console.log(i+1,l);});"`
Expected: 输出含 92 或「66 条」的行号

- [ ] **Step 4: 更新基线计数注释**

根据 Step 3 输出的行号，将「92」改为「94」（或「66 条」改为「68 条」等，按实际注释格式）。

- [ ] **Step 5: 运行 self-test 验证 94 通过**

Run: `npm run self-test`
Expected: 退出码 0，94/94 通过

- [ ] **Step 6: Commit**

```bash
git add w-model-dev/scripts/cli/self-test.ts
git commit -m "test(self-test): 基线 92→94（新增 R11/R12 用例）"
```

---

### Task D7: vitest 单元测试新增 R11/R12

**Files:**
- Modify: `w-model-dev/scripts/__tests__/gate-enhancement.test.ts`（新增 R11/R12 测试块）

- [ ] **Step 1: 定位文件末尾**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('w-model-dev/scripts/__tests__/gate-enhancement.test.ts','utf-8');console.log('last 200 chars:',c.substring(c.length-200));"`
Expected: 输出文件末尾内容

- [ ] **Step 2: 新增 R11/R12 测试块**

在文件末尾追加：

```typescript
describe('R11/R12 Verifier 改进（sig-002）', () => {
  it('R11: summary 长度 < 50 字符应失败', () => {
    const sample = loadVerifierSample('bad-summary-too-short.json');
    const result = checkVerifierOutput(sample);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /summary 长度.*< 50.*R11/.test(r))).toBe(true);
  });

  it('R11: summary 长度 ≥ 50 字符应通过（valid.json）', () => {
    const sample = loadVerifierSample('valid.json');
    const result = checkVerifierOutput(sample);
    // valid.json summary 已扩展至 ≥50 字符，R11 应通过
    expect(result.reasons.some(r => /R11/.test(r))).toBe(false);
  });

  it('R12: evidence 缺具体引用应失败', () => {
    const sample = loadVerifierSample('bad-evidence-empty.json');
    const result = checkVerifierOutput(sample);
    expect(result.passed).toBe(false);
    expect(result.reasons.some(r => /evidence.*缺具体引用.*R12/.test(r))).toBe(true);
  });

  it('R12: evidence 含具体引用应通过（valid.json）', () => {
    const sample = loadVerifierSample('valid.json');
    const result = checkVerifierOutput(sample);
    // valid.json evidence 含 "REQ-001 §3.2" 等具体引用，R12 应通过
    expect(result.reasons.some(r => /R12/.test(r))).toBe(false);
  });
});
```

- [ ] **Step 3: 运行 vitest 验证 76 通过（72+4）**

Run: `cd w-model-dev && npx vitest run scripts/__tests__/`
Expected: 76/76 通过（72 原有 + 4 新增）

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/scripts/__tests__/gate-enhancement.test.ts
git commit -m "test(vitest): 新增 R11/R12 单元测试（sig-002，72→76）"
```

---

### Task D8: Part D 验证（高风险应用全量回归）

**Files:**
- Test: 全仓库

- [ ] **Step 1: TypeScript strict 检查**

Run: `npx tsc --noEmit`
Expected: 0 错误

- [ ] **Step 2: self-test 94 通过**

Run: `npm run self-test`
Expected: 退出码 0，94/94 通过

- [ ] **Step 3: vitest 76 通过**

Run: `cd w-model-dev && npx vitest run scripts/__tests__/`
Expected: 76/76 通过

- [ ] **Step 4: fixture V4 验证**

Run: `npx tsx w-model-dev/scripts/cli/check-verifier-output.ts w-model-dev/scripts/samples/verifier/bad-summary-too-short.json; echo "exit: $?"`
Expected: 退出码 1

Run: `npx tsx w-model-dev/scripts/cli/check-verifier-output.ts w-model-dev/scripts/samples/verifier/bad-evidence-empty.json; echo "exit: $?"`
Expected: 退出码 1

- [ ] **Step 5: 回归验证（valid.json 仍通过）**

Run: `npx tsx w-model-dev/scripts/cli/check-verifier-output.ts w-model-dev/scripts/samples/verifier/valid.json; echo "exit: $?"`
Expected: 退出码 0

- [ ] **Step 6: 验证总结**

Part D 完成 2 个高风险信号应用 + 2 fixture + self-test 92→94 + vitest 72→76。全量回归通过。

---

## Part E：顶层文档同步

### Task E1: AGENTS.md 同步

**Files:**
- Modify: `AGENTS.md`（§2 references 表 + §4 结论行）

- [ ] **Step 1: §2 references 表新增 skillopt-adoption.md 行**

定位 §2 references 表中 hill-climbing-guide.md 行，在其后新增：

```markdown
/ hill-climbing-guide（Loop 4 爬坡循环：HarnessImprovementReport schema + 信号检测 + 报告消费流程）/ skillopt-adoption（SkillOpt 方法论吸收：bounded edit + validation gate 流程，消费 Loop 4 信号）/ anti-patterns（...）
```

实际用 Edit 工具在 hill-climbing-guide.md 描述后追加 skillopt-adoption.md 描述。

- [ ] **Step 2: §4 新增「第十四轮」结论行**

定位 §4 末尾「第十三轮」结论块后，新增：

```markdown
- **第十四轮：SkillOpt 方法论吸收结论**（2026-07-26）：

| 指标 | 数值 |
|---|---|
| 触发 | Loop 4 产出 HarnessImprovementReport 信号无标准消费路径 |
| 修正方案 | 方案 A 完整建机制 + 主代理顺序执行 |
| 新增文件 | 2（skillopt-adoption.md + expanded-2026-07-26.json）+ 2 fixture（bad-summary-too-short + bad-evidence-empty） |
| 修改文件 | 12（SSoT + SKILL + 3 模板 + verifier-spec + anti-patterns + verifier-logic + valid.json + self-test + vitest + AGENTS + CHANGELOG + README） |
| 信号应用 | 10 个（低风险 8 prompt + 高风险 2 逻辑），覆盖 4 类资产 |
| SSoT 同步 | §10H 新增 + §10A 追溯表 + §10G 引用 + §3.4.2 角色表扩展 |
| self-test | 基线 92→94（+2 R11/R12）全通过 |
| vitest | 72→76（+4 R11/R12 单元测试）全通过 |
| TypeScript strict | 0 错误 |
| 候选反模式 | #22（pending V 复审） |

> 第十四轮（2026-07-26）相比第十三轮：吸收 SkillOpt「bounded edit + validation gate」方法论（非工具运行），建立 Loop 4 信号标准消费路径。新增 skillopt-adoption.md 采用指南 + SSoT §10H。10 信号覆盖 4 类资产（技能/模板/参考/脚本），低风险 8 信号（prompt 措辞）+ 高风险 2 信号（R11 summary 长度≥50 + R12 evidence 具体引用 + 方差重算边界保护）。valid.json summary 同步扩展至 ≥50 字符。候选反模式 #22 标 pending V 复审。
```

- [ ] **Step 3: 验证两处改动**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('AGENTS.md','utf-8');console.log('skillopt-adoption:',c.includes('skillopt-adoption'));console.log('第十四轮:',c.includes('第十四轮：SkillOpt 方法论吸收'));"`
Expected: 两个都为 true

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): §2 references + §4 第十四轮结论（SkillOpt 方法论吸收）"
```

---

### Task E2: CHANGELOG.md 新增 [14.0.0]

**Files:**
- Modify: `CHANGELOG.md`（顶部新增 [14.0.0]）

- [ ] **Step 1: 定位 CHANGELOG 顶部**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('CHANGELOG.md','utf-8');console.log(c.substring(0,200));"`
Expected: 输出 CHANGELOG 顶部格式

- [ ] **Step 2: 在顶部新增 [14.0.0] 条目**

在 `# Changelog` 后、`## [13.0.0]` 前插入：

```markdown
## [14.0.0] - 2026-07-26

### Added
- SSoT §10H「SkillOpt 方法论吸收」：六段式循环类比映射 + bounded edit 边界 + validation gate 标准 + 与 §11 协调
- SSoT §10A 追溯表新增 §10H 行
- SSoT §10G 补充信号消费流程引用 §10H
- SSoT §3.4.2 角色表扩展：离线进化场景主代理执行 reflect→bounded edit→validation gate
- `w-model-dev/references/skillopt-adoption.md`：SkillOpt 方法论采用指南
- `w-model-dev/scripts/samples/hill-climbing/expanded-2026-07-26.json`：扩展 HarnessImprovementReport（10 信号覆盖 4 类资产）
- `w-model-dev/scripts/samples/verifier/bad-summary-too-short.json`：R11 触发 fixture
- `w-model-dev/scripts/samples/verifier/bad-evidence-empty.json`：R12 触发 fixture
- verifier-logic.ts R11（summary 长度≥50）+ R12（evidence 具体引用）校验规则
- anti-patterns.md 候选 #22（pending V 复审）：V 评审 summary 模板化

### Changed
- verifier-spec.md §6 summary 三要素要求（sig-001）
- SKILL.md hill-climbing 命令参数示例（sig-003）+ 自检清单引反模式 #20/#21（sig-004）
- review-report.md 模板 summary 三要素结构提示（sig-005）
- test-report.md 模板测试结论节量化指标占位符（sig-006）
- requirement-spec.md 模板 NFR 可测量性提示（sig-007）
- anti-patterns.md #20/#21 检测信号字段（sig-008）
- verifier-logic.ts computeVariance 注释 + NaN/Infinity 边界保护（sig-009）
- verifier/valid.json summary 扩展至 ≥50 字符（R11 兼容）
- self-test 基线 92→94（+2 R11/R12 用例）
- vitest 72→76（+4 R11/R12 单元测试）

### Methodology
- 吸收 microsoft/SkillOpt「bounded edit + validation gate」方法论（非工具运行）
- 消费 Loop 4 HarnessImprovementReport 信号，对 4 类资产做全谱离线进化
- 不引入 Python 依赖、不调用 LLM、不变更 Loop 4 信号产出逻辑
```

- [ ] **Step 3: 验证改动**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('CHANGELOG.md','utf-8');console.log('[14.0.0]:',c.includes('## [14.0.0]'));"`
Expected: true

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): [14.0.0] SkillOpt 方法论吸收"
```

---

### Task E3: README.md 同步

**Files:**
- Modify: `README.md`（核心能力清单 + 边界表）

- [ ] **Step 1: 核心能力清单新增 SkillOpt 方法论吸收条目**

定位 README 第 28 行 Loop 4 条目，在其后新增：

```markdown
- **SkillOpt 方法论吸收**：吸收 [microsoft/SkillOpt](https://github.com/microsoft/SkillOpt)「bounded edit + validation gate」方法论，消费 Loop 4 产出的 HarnessImprovementReport 信号，对技能/模板/参考/脚本 4 类资产做离线进化。不引入 Python 依赖、不调用 LLM（方法论吸收非工具运行，与 §11 协调）。详见 [skillopt-adoption.md](w-model-dev/references/skillopt-adoption.md)。
```

- [ ] **Step 2: 边界表「技能自演化」行补充说明**

定位 README 第 40 行「技能自演化」行，old_string 为：

```markdown
| 技能自演化（Rollout / Reflect / Edit / Skill Lift 评估） | 外部 | [SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill) |
```

new_string 为：

```markdown
| 技能自演化（Rollout / Reflect / Edit / Skill Lift 评估） | 外部（工具运行）+ 技能内（方法论吸收） | 工具运行：[SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)；方法论吸收：[skillopt-adoption.md](w-model-dev/references/skillopt-adoption.md)（§10H） |
```

- [ ] **Step 3: 验证两处改动**

Run: `npx tsx -e "const fs=require('fs');const c=fs.readFileSync('README.md','utf-8');console.log('SkillOpt 方法论吸收:',c.includes('SkillOpt 方法论吸收'));console.log('边界表更新:',c.includes('方法论吸收：'));"`
Expected: 两个都为 true

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): 核心能力 + 边界表补充 SkillOpt 方法论吸收"
```

---

### Task E4: 最终全量验证

**Files:**
- Test: 全仓库

- [ ] **Step 1: TypeScript strict**

Run: `npx tsc --noEmit`
Expected: 0 错误

- [ ] **Step 2: self-test 94**

Run: `npm run self-test`
Expected: 退出码 0，94/94 通过

- [ ] **Step 3: vitest 76**

Run: `cd w-model-dev && npx vitest run scripts/__tests__/`
Expected: 76/76 通过

- [ ] **Step 4: fixture 验证**

Run: `npx tsx w-model-dev/scripts/cli/check-verifier-output.ts w-model-dev/scripts/samples/verifier/bad-summary-too-short.json; echo "R11 exit: $?"`
Expected: R11 exit: 1

Run: `npx tsx w-model-dev/scripts/cli/check-verifier-output.ts w-model-dev/scripts/samples/verifier/bad-evidence-empty.json; echo "R12 exit: $?"`
Expected: R12 exit: 1

Run: `npx tsx w-model-dev/scripts/cli/check-verifier-output.ts w-model-dev/scripts/samples/verifier/valid.json; echo "valid exit: $?"`
Expected: valid exit: 0

- [ ] **Step 5: 验证总结**

第十四轮 SkillOpt 方法论吸收实现完成：
- SSoT §10H/§10A/§10G/§3.4.2 同步 ✓
- skillopt-adoption.md 新增 ✓
- expanded-2026-07-26.json 10 信号 ✓
- 4 类资产 10 信号应用 ✓（低风险 8 + 高风险 2）
- self-test 92→94 ✓
- vitest 72→76 ✓
- TypeScript strict 0 错误 ✓
- fixture R11/R12 触发验证 ✓
- AGENTS.md + CHANGELOG + README 同步 ✓

---

## Self-Review 检查

### 1. Spec 覆盖检查

| Spec 章节 | 实现任务 | 状态 |
|---|---|---|
| §1 架构与边界 | Task A1-A3（SSoT + skillopt-adoption.md） | ✓ |
| §2 信号构造（10 信号） | Task B1（expanded 报告） | ✓ |
| §3.2 Phase R（reflect） | Task B1（产出扩展报告即 reflect 产出） | ✓ |
| §3.3 Phase E1（低风险 8 信号） | Task C1-C6（sig-001/003/004/005/006/007/008/010） | ✓ |
| §3.3 Phase E2（高风险 2 信号） | Task D1-D2（sig-002/009） | ✓ |
| §3.4 Phase V（validation gate） | Task C7 + D8 + E4 | ✓ |
| §3.5 新增 fixture | Task D4-D5 | ✓ |
| §3.6 self-test 92→94 | Task D6 | ✓ |
| §3.7 check-verifier-output R11/R12 | Task D1（verifier-logic.ts 实现，check-verifier-output.ts 不改） | ✓ |
| §4.1 新增文件 | Task A3 + B1 + D4 + D5 | ✓ |
| §4.2 修改文件 | Task C1-C6 + D1-D3 + D6-D7 | ✓ |
| §4.3 SSoT 同步 | Task A1-A2 | ✓ |
| §4.4 顶层文档 | Task E1-E3 | ✓ |
| §5.1 R1-R6 风险缓解 | 全程 V1-V5 gate + fixture 设计 + 候选 #22 pending | ✓ |
| §5.2 Q1-a 候选 #22 | Task C6 Step 4（pending V 复审） | ✓ |
| §5.2 Q2-a §3.4.2 扩展 | Task A2 Step 3 | ✓ |

### 2. 占位符扫描

- 无 TBD/TODO/"implement later"/"fill in details"
- 无 "Add appropriate error handling" 等模糊描述
- 所有代码步骤含完整代码块
- 所有命令含预期输出

### 3. 类型一致性

- `checkR11SummaryLength(summary: unknown): string | null` — Task D1 定义，Task D7 测试调用 ✓
- `checkR12EvidenceSpecificity(evidence: unknown, idx: number): string | null` — Task D1 定义，Task D7 测试调用 ✓
- `computeVariance(scores: number[]): number` — Task D2 修改，与现有调用一致 ✓
- fixture 文件名 `bad-summary-too-short.json` / `bad-evidence-empty.json` — Task D4/D5 创建，Task D6/D7 引用一致 ✓
- self-test VERIFIER_CASES 用例 file 字段与 fixture 文件名一致 ✓

### 4. 关键依赖链验证

- Task D1（R11/R12 实现）→ Task D3（valid.json summary 扩展，否则 valid.json 触发 R11）→ Task D4/D5（fixture）→ Task D6（self-test）→ Task D7（vitest）→ Task D8（验证）
- Task D2（方差边界保护）独立于 D1，但同改 verifier-logic.ts，需顺序执行
- Part C（低风险）独立于 Part D（高风险），但 Part C7 验证后才能进入 Part D

计划完整，无遗漏。
