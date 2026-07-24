# 根因定位者（R）与修复者（F）角色设计

> **创建日期**：2026-07-24
> **状态**：待审阅
> **关联文档**：[skill-design-document_SSoT.md](../../skill-design-document_SSoT.md) §3.4 / §6.4 / §4A / §10
> **影响范围**：W 模型返工循环全阶段；新增第 6 角色 R；F 由 S 兼任；新增反模式 #18/#19；新增并行多人格分析机制

---

## 0. 背景与问题陈述

### 0.1 现状

W 模型当前 5 角色（O/S/V/G/A）的返工循环为：

```
V/G 不通过 → 分派 S 返工（带 reworkHints）→ 重走 V → G
```

S 子代理既产出又修复，跳过根因定位环节，直接拿 V/G 的 `reworkHints`（现象）返工。

### 0.2 问题

1. **补症状不补根因**：S 拿现象返工，可能只修补表象而不追溯根因，同问题反复出现。
2. **缺陷链未追溯**：缺陷可能在多产物间传播（需求→设计→编码→测试），S 仅修当前产物，不追溯上游。
3. **上游缺陷被掩盖**：根因可能在上游阶段（如需求规格遗漏），但 S 无职责回溯上游，缺陷被反复打补丁。
4. **反复返工无升级**：多次返工未通过时缺乏强制根因分析与阶段回退机制。

### 0.3 目标

新增 **根因定位者（R）** 角色，在 V/G 不通过后、S 修复前，强制介入根因定位。修复者（F）由现有 S 兼任，S 携带 R 报告执行修复。引入并行多人格分析机制，利用 `w-model-dev/subagent/` 中 28 个人格文件从多角度并行诊断。

---

## 1. 角色定义与边界

### 1.1 R（根因定位者）角色定义

| 维度 | 定义 |
|---|---|
| **简称** | R（Root Cause Locator） |
| **职责** | 接收 V/G 的 `reworkHints` + 失败产物 + 上游产物，运用根因分析方法论定位缺陷根因，产出 `RootCauseReport`（含根因链、上游缺陷标记、修复建议、防御措施） |
| **允许动作** | ① 读失败产物文件 + 上游产物（需求/设计/代码/测试/TLA+/graph.json）；② 读 V 的 `VerifierOutput` JSON + G 的 GATE_JSON；③ 运用根因分析方法（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）；④ 产出 `RootCauseReport` JSON + `.md` 报告文件；⑤ 标记 `upstreamDefect`（若根因为上游需求/设计缺陷）；⑥ 作为 R-lead 并行分派 R-persona 子代理并聚合产出（第 9 节） |
| **禁止动作** | ① 改任何产物文件（由 S 修复）；② 跑门禁脚本（由 G 负责）；③ 改 RTM 实体；④ 改 `project.status`；⑤ 跨阶段定位（仅定位当前阶段产物的缺陷根因，上游回溯仅标记不修改）；⑥ 评审其他角色产出 |

### 1.2 F（修复者）角色定义

| 维度 | 定义 |
|---|---|
| **简称** | F（Fixer） |
| **承担者** | **由现有 S 子代理兼任**（S 在返工场景下接受 R 报告作为额外输入，执行修复） |
| **职责** | 接收 R 的 `RootCauseReport`（已经 V 复审通过），按 `fixRecommendation` 修复产物，同步更新 RTM 实体 |
| **允许动作** | ① S 的全部允许动作；② 读 R 的 `RootCauseReport`；③ 按 `fixRecommendation` 修改产物；④ 在返工记录中标注「修复依据：R 报告 `<reportId>`」 |
| **禁止动作** | ① 无视 R 报告自行修复（必须以 R 报告为依据）；② 跳过 R 直接返工（命中反模式 #18） |

### 1.3 与现有角色的关系

- **R 与 V 的区别**：V 评审「产物是否符合标准」（发现 what）；R 诊断「产物为何不符合标准」（追溯 why）。V 输出 `reworkHints`（现象）；R 输出 `RootCauseReport`（根因链）。
- **R 与 A 的区别**：A 分析「原始文档→图谱」的结构化（阶段 1-4 ingestion）；R 分析「失败产物→根因」的诊断（全阶段返工）。两者活动领域不同。
- **F 与 S 的关系**：F 不是新角色，是 S 在返工场景下的「带 R 报告输入」模式。S 首次产出时不带 R 报告；返工时必带 R 报告。

---

## 2. 返工循环时序

### 2.1 当前循环（改造前）

```
S 产出 → V 评审 → G 门禁 ──通过──► 阶段门放行
                       │不通过
                       ▼
                  S 返工（带 reworkHints）→ V → G ──循环──
```

问题：S 直接拿 `reworkHints`（现象）返工，跳过根因定位，易补症状不补根因。

### 2.2 新循环（改造后）

```
S 产出 → V 评审 → G 门禁 ──通过──► 阶段门放行
                       │不通过（exitCode≠0 或 qualityLevel∈{C,D}）
                       ▼
                  O 分派 R 定位（输入：reworkHints + 失败产物 + 上游产物）
                       │
                       ▼
                  R 产出 RootCauseReport（含根因链 + fixRecommendation + upstreamDefect?）
                       │
                       ▼
                  O 分派 V 复审根因报告（targetKind=rootcause）
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
       V 复审不通过            V 复审通过
            │                     │
            ▼                     ▼
       O 重派 R（带 V 的        O 分派 G 门禁（check-rootcause-report.ts）
       rootcause reworkHints）       │
       → R 重定位 ──循环──    ┌──────┴──────┐
                              ▼             ▼
                          G 门禁不通过   G 门禁通过
                              │             │
                              ▼             ▼
                          O 重派 R     O 分派 S 兼 F 修复
                                      （输入：R 报告 + fixRecommendation）
                                           │
                                           ▼
                                      S 修复产物 + 更新 RTM
                                           │
                                           ▼
                                      O 分派 V 评审修复产物
                                           │
                                           ▼
                                      O 分派 G 门禁
                                           │
                                 ┌─────────┴─────────┐
                                 ▼                   ▼
                            G 通过               G 不通过
                                 │                   │
                                 ▼                   ▼
                            阶段门放行          新一轮 R 定位
                                                （round++）
```

### 2.3 关键时序规则

1. **R 介入时机**：G 门禁返回 `exitCode≠0` 或 `qualityLevel∈{C,D}` 时，编排者**必须**分派 R（禁止直接分派 S 返工，命中反模式 #18）。
2. **V 复审根因**：R 产出后**必须**经 V 复审 + G 门禁，确保根因准确性。V 复审不通过 → 重派 R，不进入修复阶段。
3. **S 修复前置条件**：S 兼 F 修复时**必须**携带 R 报告作为输入；无 R 报告的返工命中反模式 #18。
4. **新一轮判定**：S 修复后 V/G 仍不通过 → `round++`，重新分派 R（不沿用上轮 R 报告，因产物已变化）。
5. **阶段门放行**：仅当 S 修复后的 V/G 通过才放行；R 报告通过 ≠ 阶段门放行（R 报告通过仅解锁修复阶段）。

### 2.4 与 ingestion 子流程的衔接

阶段 1-4 的 A 子流程返工（`check-requirement-graph.ts` 不通过）同样走 R→V→G→A 修复循环：
- A-chunk/A-cross/A-evolve 返工时，R 定位「为何 chunk 提取遗漏节点 / 为何跨块边缺失 / 为何信息流违反」
- A 拿 R 报告补漏，重走 G 门禁

---

## 3. R 方法论框架（root-cause-locator.md）

新建 `w-model-dev/references/root-cause-locator.md`，与 `agent-personas.md` 平级，定义 R 的根因分析方法论。

### 3.1 文件定位

> SSoT §6.4（角色定义）扩展为权威定义，本文件为 R 子代理的可执行方法论指南。
> 与 `agent-personas.md` 的关系：agent-personas.md 定义 V 子代理的评审角色视角；本文件定义 R 子代理的诊断方法论。两者互补，R 不调用 Persona，Persona 不调用 R。

### 3.2 根因分析方法库（4 种方法，按场景选用）

#### 方法 1：5-Why 追溯（默认方法）

适用：单一缺陷的纵向根因追溯。

```
现象（V/G 的 reworkHint）
  └─ Why 1: 为什么出现？→ <直接原因>
       └─ Why 2: 为什么出现直接原因？→ <深层原因>
            └─ Why 3: ...
                 └─ Why N: 直到触及 <根因>（流程缺失 / 规格遗漏 / 设计缺陷 / 上游产物缺陷）
```

终止条件：触及「流程缺失 / 规格遗漏 / 设计缺陷 / 上游产物缺陷」之一，或达到 5 层。

#### 方法 2：鱼骨图分析（多因素缺陷）

适用：一个 reworkHint 涉及多因素（如代码缺陷同时涉及需求不清 + 设计遗漏 + 编码错误）。

维度（适配 W 模型）：
- **需求维度**：需求规格是否清晰 / 完整 / 无歧义？
- **设计维度**：设计是否覆盖需求 / 接口是否明确 / 状态机是否完整？
- **编码维度**：代码是否遵循设计 / 边界是否处理 / 错误路径是否覆盖？
- **测试维度**：测试是否覆盖该路径 / 测试用例是否正确？
- **流程维度**：阶段门是否跳过 / ingestion 是否遗漏 / TLA+ 是否建模该行为？
- **工具维度**：门禁脚本是否漏检 / Schema 是否缺失校验？

产出：每个维度的「是/否/部分」+ 证据 + 主因标记。

#### 方法 3：缺陷链追溯（跨产物传播）

适用：缺陷在多个产物间传播（如需求缺陷 → 设计继承 → 编码实现 → 测试漏测）。

```
需求规格 ──缺陷──► 系统设计 ──继承──► 详细设计 ──实现──► 代码 ──漏测──► 测试
   ↑                      ↑                    ↑              ↑            ↑
  根因                  传播                  传播           表现         未拦截
```

产出：缺陷链节点列表 + 每节点的「引入/传播/表现/未拦截」标签 + 根因节点标记。

#### 方法 4：上游回溯（跨阶段根因）

适用：R 在当前阶段产物中找不到根因，怀疑根因在上游阶段。

```
当前阶段产物缺陷
  └─ 回溯上游：读上游阶段产物（需求/设计/TLA+/graph.json）
       └─ 若上游产物含缺陷 → 标记 upstreamDefect = {phase, artifactId, defectDescription}
       └─ 若上游产物无缺陷 → 根因为当前阶段流程缺失
```

约束：R 仅标记 `upstreamDefect`，不修改上游产物。`upstreamDefect` 经 V 复审通过后，编排者可触发阶段回退（见第 6 节）。

### 3.3 方法选择规则

| reworkHint 特征 | 选用方法 |
|---|---|
| 单一明确缺陷（如 null 指针） | 5-Why |
| 多因素复合缺陷（如安全 + 性能 + 可读性同时不合格） | 鱼骨图 |
| 缺陷在多产物间传播（如设计与代码矛盾） | 缺陷链追溯 |
| 当前阶段产物无明显缺陷但 V/G 不通过 | 上游回溯 |
| 复杂场景 | 组合使用（先鱼骨图定位维度，再 5-Why 纵向追溯） |

### 3.4 R 的产出质量标准

1. **根因必须可证伪**：每条根因须附「若根因消除，现象是否消失」的可验证假设。
2. **禁止现象当根因**：「代码写错了」是现象不是根因；「需求规格未规定 null 处理，编码默认不检查」才是根因。
3. **fixRecommendation 必须针对根因**：禁止「建议修复代码」这种泛化建议；须指明「修改 `<文件>:<行>` 的 `<具体内容>`，因为 `<根因>`」。
4. **prevention 必须可执行**：禁止「加强评审」这种泛化建议；须指明「在 `<phase-N>` 的 `<检查项>` 中增加 `<具体检查>`」。
5. **upstreamDefect 必须附证据**：标记上游缺陷须引用上游产物的具体段落 / 行号 / 节点 ID。

### 3.5 与 systematic-debugging 技能的关系

本方法论吸收 `systematic-debugging` 技能的 `root-cause-tracing.md` 原则，但适配 W 模型：
- systematic-debugging 面向「运行时 bug 调试」；
- 本方法论面向「W 模型阶段产物缺陷诊断」；
- 两者共享「根因优先于症状」「可证伪假设」「缺陷链追溯」原则。

---

## 4. RootCauseReport Schema

新建 `RootCauseReport` JSON Schema（与 `VerifierOutput` 平级，由 `check-rootcause-report.ts` 校验）。

### 4.1 Schema 定义

```json
{
  "schemaVersion": "1.0",
  "meta": {
    "reportId": "RC-<phase>-<round>-<seq>",
    "targetKind": "rootcause",
    "targetArtifact": "<被诊断的失败产物路径>",
    "targetPhase": "<阶段 N - 名称>",
    "reworkRound": <int, 从 1 开始>,
    "reworkSource": "verifier | gate",
    "persona": "root-cause-locator",
    "method": "5-why | fishbone | defect-chain | upstream-trace | combined",
    "analysisTimestamp": "<ISO 8601>"
  },
  "input": {
    "reworkHints": ["<V/G 的 reworkHints 原文数组>"],
    "verifierOutputPath": "<V 产出路径，可选>",
    "gateJsonPath": "<G 产出路径，可选>"
  },
  "phenomenon": {
    "summary": "<现象一句话摘要>",
    "severity": "Critical | Required | Optional | Nit | FYI",
    "affectedArtifacts": ["<受影响产物路径>"]
  },
  "rootCauseChain": [
    {
      "step": 1,
      "why": "<为什么出现？>",
      "answer": "<直接原因>",
      "evidence": "<证据：产物段落/行号/节点ID>"
    },
    {
      "step": 2,
      "why": "<为什么出现直接原因？>",
      "answer": "<深层原因>",
      "evidence": "<证据>"
    }
  ],
  "rootCause": {
    "category": "requirement-gap | design-flaw | coding-error | test-gap | process-missing | tool-gap | upstream-defect",
    "description": "<根因一句话描述>",
    "evidence": "<根因证据：上游产物段落/行号/节点ID>",
    "falsifiabilityCheck": "<若根因消除，现象是否消失的可验证假设>"
  },
  "upstreamDefect": {
    "present": <true | false>,
    "upstreamPhase": "<阶段编号，仅 present=true 时>",
    "upstreamArtifactId": "<上游产物 ID，仅 present=true 时>",
    "defectDescription": "<上游缺陷描述，仅 present=true 时>",
    "rollbackRecommended": <true | false>
  },
  "fixRecommendation": [
    {
      "target": "<产物路径>",
      "location": "<文件:行号 / 节点ID / 段落>",
      "action": "<具体修复动作>",
      "rationale": "<为何这样修复能消除根因>"
    }
  ],
  "prevention": [
    {
      "scope": "<phase-N / 检查项 / 模板 / 门禁脚本>",
      "measure": "<具体预防措施>",
      "owner": "<负责落实的角色>"
    }
  ],
  "qualityLevel": "A | B | C | D",
  "passed": <true | false>,
  "summary": "<根因分析一句话结论>",
  "reviewNotes": "<V 复审时填写，R 产出时为空>"
}
```

### 4.2 字段说明

| 字段 | 必填 | 说明 |
|---|---|---|
| `meta.reportId` | 是 | 唯一标识，格式 `RC-<phase>-<round>-<seq>`，如 `RC-phase5-2-01` |
| `meta.reworkSource` | 是 | 标识返工来源是 V（评审不通过）还是 G（门禁不通过） |
| `meta.method` | 是 | R 选用的根因分析方法（第 3 节定义） |
| `rootCauseChain` | 是 | 根因追溯链，最少 2 步，最多 5 步；每步须附 `evidence` |
| `rootCause.category` | 是 | 根因分类，7 类（见下表） |
| `rootCause.falsifiabilityCheck` | 是 | 可证伪假设（第 3 节质量标准 1） |
| `upstreamDefect.present` | 是 | 是否检测到上游缺陷；`true` 时须填后续字段 |
| `upstreamDefect.rollbackRecommended` | 是 | R 是否建议回退阶段；最终由 V 复审 + 编排者 + 用户决定 |
| `fixRecommendation` | 是 | 修复建议数组，每条须含 `target`/`location`/`action`/`rationale`（第 3 节质量标准 3） |
| `prevention` | 是 | 预防措施数组，每条须含 `scope`/`measure`/`owner`（第 3 节质量标准 4） |
| `qualityLevel` | 是 | R 自评质量等级；V 复审时可调整 |
| `passed` | 是 | R 自评是否通过；V 复审后最终值由 V 决定 |

### 4.3 rootCause.category 分类

| category | 含义 | 典型场景 |
|---|---|---|
| `requirement-gap` | 需求规格缺陷/遗漏 | 需求未规定 null 处理 → 编码漏检查 |
| `design-flaw` | 设计缺陷 | 状态机未覆盖错误路径 → 代码无错误处理 |
| `coding-error` | 编码错误 | 设计正确但实现偏离 |
| `test-gap` | 测试覆盖缺口 | 测试未覆盖该路径 |
| `process-missing` | 流程缺失 | 阶段门跳过 / ingestion 遗漏 |
| `tool-gap` | 工具/脚本缺口 | 门禁脚本漏检该模式 |
| `upstream-defect` | 上游产物缺陷 | 根因在上游阶段产物（须配合 `upstreamDefect` 字段） |

### 4.4 校验脚本：check-rootcause-report.ts

新建 `w-model-dev/scripts/check-rootcause-report.ts`（与 `check-verifier-output.ts` 平级），由 G 子代理执行。

校验规则（R1-R10）：

| 规则 | 校验内容 | 失败动作 |
|---|---|---|
| R1 | Schema 完整性：所有必填字段非空 | 退出码 1 |
| R2 | `rootCauseChain` 长度 ∈ [2, 5]，每步 `evidence` 非空 | 退出码 1 |
| R3 | `rootCause.falsifiabilityCheck` 非空且含假设句式（「若...则...」） | 退出码 1 |
| R4 | `fixRecommendation` 每条含 `target`/`location`/`action`/`rationale` 四字段 | 退出码 1 |
| R5 | `prevention` 每条含 `scope`/`measure`/`owner` 三字段 | 退出码 1 |
| R6 | `upstreamDefect.present=true` 时，`upstreamPhase`/`upstreamArtifactId`/`defectDescription` 非空 | 退出码 1 |
| R7 | `qualityLevel ∈ {A,B,C,D}`，`passed` 与 `qualityLevel` 一致（A/B→true，C/D→false） | 退出码 1 |
| R8 | `meta.reportId` 格式 `^RC-[a-z0-9]+-\d+-\d+$` | 退出码 1 |
| R9 | 并行场景：附录 PartialReport 路径非空（第 9 节） | 退出码 1 |
| R10 | 并行场景：reality-checker persona 的 confidence ≥ 0.5（第 9 节） | 退出码 1 |

退出码：`0=通过 / 1=校验失败 / 2=输入错误`（与现有脚本约定一致）。

### 4.5 .md 报告文件格式

R 同时产出 `.w-model/rootcause/<reportId>.md`（人类可读版本），结构：

```markdown
# 根因分析报告 <reportId>

## 现象
<phenomenon.summary>
- 严重等级：<phenomenon.severity>
- 受影响产物：<phenomenon.affectedArtifacts>

## 根因追溯链（<method>）
1. Why: <rootCauseChain[0].why>
   Answer: <rootCauseChain[0].answer>
   Evidence: <rootCauseChain[0].evidence>
2. ...

## 根因
- 分类：<rootCause.category>
- 描述：<rootCause.description>
- 证据：<rootCause.evidence>
- 可证伪假设：<rootCause.falsifiabilityCheck>

## 上游缺陷（如有）
- 阶段：<upstreamDefect.upstreamPhase>
- 产物：<upstreamDefect.upstreamArtifactId>
- 描述：<upstreamDefect.defectDescription>
- 建议回退：<upstreamDefect.rollbackRecommended>

## 修复建议
1. <fixRecommendation[0].target> @ <location>
   动作：<action>
   依据：<rationale>
2. ...

## 预防措施
1. [<owner>] <scope>: <measure>
2. ...

## 自评
- 质量等级：<qualityLevel>
- 通过：<passed>
- 结论：<summary>
```

---

## 5. 分派模板与回填契约

### 5.1 R 子代理分派模板

```
角色：根因定位子代理（R）
当前 W 模型阶段：<阶段 N - 名称>
返工轮次：<round，从 1 开始>
任务：诊断 V/G 命中的返工问题根因，产出 RootCauseReport

上下文：
  - 返工来源：<verifier | gate>
  - V/G 的 reworkHints（原文）：<数组>
  - V 的 VerifierOutput JSON 路径：<路径，可选>
  - G 的 GATE_JSON 路径：<路径，可选>
  - 失败产物路径：<被诊断为不合格的产物文件>
  - 上游产物路径（用于上游回溯）：<列出上游阶段产物路径>
  - 当前 RTM：<.w-model/rtm.json 路径>
  - 当前 graph.json（阶段 1-4）：<路径，可选>
  - 上一轮 R 报告（若 round>1）：<路径，用于避免重复根因>

必读：
  - references/root-cause-locator.md（根因分析方法论）
  - references/anti-patterns.md（避免误判流程问题为产物问题）

方法选择：
  - 单一明确缺陷 → 5-Why
  - 多因素复合缺陷 → 鱼骨图
  - 跨产物传播 → 缺陷链追溯
  - 当前阶段无明显缺陷 → 上游回溯
  - 复杂场景 → 组合

产出契约：
  1. RootCauseReport JSON：<路径> .w-model/rootcause/<reportId>.json
  2. 人类可读报告：<路径> .w-model/rootcause/<reportId>.md
  3. 必须满足 RootCauseReport Schema（第 4 节）
  4. 返回编排者：{role:"R", reportId, reportPath, rootCauseCategory, upstreamDefect: {present, rollbackRecommended}, qualityLevel, passed, summary}

禁止：
  - 改任何产物文件（由 S 修复）
  - 跑门禁脚本（由 G 负责）
  - 改 RTM 实体 / project.status
  - 修改上游产物（仅标记 upstreamDefect）
  - 评审其他角色产出
  - 跨阶段定位（仅当前阶段产物 + 上游回溯标记）
```

### 5.2 V 复审根因报告分派模板（新 targetKind=rootcause）

```
角色：评审子代理（V）- rootcause 变体
评审目标：targetKind=rootcause / <reportId>
任务：复审 R 的根因报告准确性

上下文：
  - 待复审 R 报告 JSON 路径：<路径>
  - 待复审 R 报告 .md 路径：<路径>
  - 失败产物路径（用于核验根因证据）：<路径>
  - 上游产物路径（用于核验 upstreamDefect）：<列出>
  - 原始 V/G reworkHints：<数组>

必读：
  - references/root-cause-locator.md（方法与质量标准）
  - references/verifier-spec.md §7（输出 Schema，rootcause 复审仍用 VerifierOutput）

复审维度（rootcause 专用子标准）：
  - correctness：根因链是否逻辑自洽？证据是否支持？
  - completeness：是否触及根本原因而非停在现象？
  - falsifiability：可证伪假设是否可验证？
  - actionability：fixRecommendation 是否针对根因且可执行？
  - prevention：预防措施是否可落实？

产出契约：
  1. VerifierOutput JSON：<路径> .w-model/verifier/<reportId>-review.json
  2. targetKind=rootcause，persona=code-reviewer（或新增 rootcause-reviewer persona，待定）
  3. reworkHints 含 [Critical]/[Required] 时表示根因报告不准确，须重派 R
  4. 返回编排者：{role:"V", targetKind:"rootcause", qualityLevel, passed, reworkHints}

禁止：
  - 改 R 报告文件
  - 改产物文件
  - 跑门禁脚本
```

### 5.3 S 兼 F 修复分派模板（返工变体）

```
角色：产出子代理-修复变体（S-fix）
当前 W 模型阶段：<阶段 N - 名称>
返工轮次：<round>
任务：按 R 报告的 fixRecommendation 修复产物 + 更新 RTM

上下文：
  - R 报告 JSON 路径（已 V 复审通过）：<路径>
  - R 报告 .md 路径：<路径>
  - 待修复产物路径：<路径>
  - 当前 RTM：<路径>
  - 上游产物路径：<列出>

必读：
  - references/phase-<N>-*.md（当前阶段验收标准）
  - references/rtm-guide.md
  - R 报告的 fixRecommendation（必读，修复依据）

产出契约：
  1. 修复后的产物文件（覆盖原文件）
  2. RTM 实体更新（若修复涉及 RTM）
  3. 返回编排者：{role:"S", variant:"fix", artifacts:<修复文件路径>, rtmDiff, fixBasedOn:"<reportId>", selfCheck}
  4. selfCheck 须含 fixRecommendation 落实情况逐条核验

禁止：
  - 无视 R 报告自行修复（命中反模式 #18）
  - 跑门禁脚本
  - 越阶段产出
  - 改 project.status
  - 修复时引入新缺陷（须自检）
```

### 5.4 R 子代理返回格式

```json
{
  "role": "R",
  "reportId": "RC-<phase>-<round>-<seq>",
  "reportPath": {
    "json": "<.w-model/rootcause/<reportId>.json>",
    "md": "<.w-model/rootcause/<reportId>.md>"
  },
  "rootCauseCategory": "<requirement-gap | design-flaw | ... | upstream-defect>",
  "upstreamDefect": {
    "present": <true | false>,
    "upstreamPhase": "<仅 present=true>",
    "rollbackRecommended": <true | false>
  },
  "qualityLevel": "<A | B | C | D>",
  "passed": <true | false>,
  "summary": "<根因分析一句话结论>"
}
```

编排者收到 R 返回后：
- `passed=true` 且 `qualityLevel∈{A,B}` → 分派 V 复审根因报告
- `passed=false` 或 `qualityLevel∈{C,D}` → 重派 R（R 自评不通过，须重新分析）

### 5.5 run-log.jsonl 新增动作记录

扩展 run-log 动作类型，新增 `rootcause` 与 `fix` 两个动作：

```json
{"action":"rootcause","phase":"<阶段N>","round":<int>,"actor":"R","reportId":"<RC-...>","rootCauseCategory":"<...>","upstreamDefect":<bool>,"rollbackRecommended":<bool>,"tokens":<int>,"timestamp":"<ISO>","note":"<可选>"}

{"action":"fix","phase":"<阶段N>","round":<int>,"actor":"S-fix","basedOnReport":"<reportId>","artifacts":["<修复文件>"],"rtmDiff":{...},"tokens":<int>,"timestamp":"<ISO>","note":"<可选>"}
```

### 5.6 与 run-log R3（返工动作完整性）的交叉校验扩展

现有 `check-run-log.ts` R3 校验返工动作完整性。扩展为：

| 现有 R3 | 扩展后 R3 |
|---|---|
| 每轮返工须有 S 返工记录 | 每轮返工须有 R 定位 + S-fix 修复两条记录（缺一即 R3 失败） |
| — | R 记录的 `reportId` 须与 S-fix 记录的 `basedOnReport` 一致 |
| S-fix 记录数 = R 记录数（一一对应） |
| — | V 复审 rootcause 记录数 = R 记录数（每份 R 报告须有 V 复审） |

### 5.7 子代理返回时序汇总

```
O: 分派 R → R 返回 {reportId, reportPath, rootCauseCategory, upstreamDefect, qualityLevel, passed, summary}
  ↓ R passed=true
O: 分派 V 复审根因 → V 返回 {targetKind:rootcause, qualityLevel, passed, reworkHints}
  ↓ V passed=true
O: 分派 G 门禁 → G 跑 check-rootcause-report.ts → 返回 {exitCode, evidence}
  ↓ G exitCode=0
O: 分派 S-fix 修复 → S-fix 返回 {artifacts, rtmDiff, fixBasedOn, selfCheck}
  ↓
O: 分派 V 评审修复产物 → V 返回 {qualityLevel, passed, reworkHints}
  ↓ V passed=true
O: 分派 G 门禁 → G 跑 check-verifier-output.ts → 返回 {exitCode, evidence}
  ↓ G exitCode=0
O: 🔴 CHECKPOINT · 阶段门放行
```

---

## 6. 触发与终止条件 + 升级路径

### 6.1 R 触发条件（所有返工都走 R→S）

| 触发场景 | 触发条件 | 动作 |
|---|---|---|
| V 评审不通过 | `VerifierOutput.passed=false` 或 `qualityLevel∈{C,D}` | O 分派 R 定位 |
| G 门禁不通过 | `check-verifier-output.ts` exitCode=1 | O 分派 R 定位 |
| G 终检不通过 | `check-artifact-gate.ts` exitCode=1 | O 分派 R 定位 |
| 图谱门禁不通过 | `check-requirement-graph.ts` exitCode=1（阶段 1-4） | O 分派 R 定位（A 子流程返工） |
| TLA+ 门禁不通过 | `check-tla-model.ts` exitCode=1（阶段 1-4） | O 分派 R 定位（TLA+ 返工） |
| 代码-TLA+ 一致性不通过 | `check-code-tla-consistency.ts` exitCode=1（阶段 5） | O 分派 R 定位 |

**禁止跳过 R 直接分派 S 返工**（命中反模式 #18）。

### 6.2 最大轮次（maxReworkRounds）

| 阶段 | 默认上限 | 触发上限后动作 |
|---|---|---|
| 阶段 1-4（文档/图谱/TLA+） | `maxReworkRounds=3` | 强制 🔴 CHECKPOINT 升级 |
| 阶段 5（编码） | `maxReworkRounds=5` | 强制 🔴 CHECKPOINT 升级 |
| 阶段 6-7（集成/系统测试） | `maxReworkRounds=3` | 强制 🔴 CHECKPOINT 升级 |
| 阶段 8（验收） | `maxReworkRounds=2` | 强制 🔴 CHECKPOINT 升级 |

> 上限可在 `project.json` 的 `phaseConfig.<phase>.maxReworkRounds` 覆盖，由用户在 CHECKPOINT 调整。

**轮次计数规则**：一次「R 定位 → V 复审 → G 门禁 → S-fix 修复 → V 评审 → G 门禁」完整循环记为 1 轮。R 自评/V 复审/G 门禁不通过导致的 R 重派**不**单独计数（同一轮内的重派）。

### 6.3 升级路径（5 种场景）

#### 场景 1：R 自评不通过（`passed=false` 或 `qualityLevel∈{C,D}`）

```
R 自评不通过 → O 重派 R（同一 round，不递增）
  ↓ 若同一 round 内 R 重派 ≥2 次仍不通过
O 强制 🔴 CHECKPOINT：展示 R 重派历史，请用户介入（人工根因分析或调整 maxReworkRounds）
```

#### 场景 2：V 复审根因不通过

```
V 复审不通过 → O 重派 R（带 V 的 rootcause reworkHints，同一 round）
  ↓ 若同一 round 内 V 复审不通过 ≥2 次
O 强制 🔴 CHECKPOINT：展示 R 报告 + V reworkHints，请用户裁定根因
```

#### 场景 3：G 门禁不通过（check-rootcause-report.ts exitCode=1）

```
G 门禁不通过 → O 重派 R（带 G 的校验失败原因，同一 round）
  ↓ G 门禁不通过通常为 Schema 不合规，R 修正报告即可
```

#### 场景 4：S-fix 修复后 V/G 仍不通过

```
S-fix 修复后 V/G 不通过 → round++ → 重新分派 R（不沿用上轮 R 报告，因产物已变化）
  ↓ round 达 maxReworkRounds
O 强制 🔴 CHECKPOINT 升级（见场景 5）
```

#### 场景 5：阶段回退

**触发条件**（三者全部满足）：
1. `round ≥ 2`（多轮返工）
2. R 标记 `upstreamDefect.present=true` 且 `rollbackRecommended=true`（根因跨阶段）
3. V 复审 R 报告 `passed=true` 且 `upstreamDefect` 字段复审通过（V 同意跨阶段根因）

```
O 检测到回退条件满足 → 强制 🔴 CHECKPOINT · 阶段回退决策
  展示内容：
    - 返工历史（所有 round 的 R 报告 + V 复审 + S-fix 记录）
    - R 的 upstreamDefect 详情（上游阶段 / 产物 ID / 缺陷描述）
    - V 的复审结论
    - 建议回退到的阶段编号
  用户选项：
    A) 确认回退到 <upstreamPhase> → O 更新 project.status 回退到上游阶段 → 上游阶段重走 S→V→G→（若再次失败）R 循环
    B) 不回退，继续当前阶段返工（round++，但须用户说明理由，记入 run-log note）
    C) 调整 maxReworkRounds 继续尝试
```

**回退后处理**：
- 回退到上游阶段后，上游阶段产物作废重做（S 重新产出）
- 上游阶段通过后，重新进入当前阶段，S 重新产出（不沿用回退前的产物）
- 回退前的 R 报告归档为「历史根因分析」，可供新一轮 R 参考（避免重复定位）

### 6.4 回退路径阶段编号映射（扩展 workflow.md 现有映射）

| 当前阶段 | R 根因分类 | upstreamDefect.upstreamPhase | 回退到 |
|---|---|---|---|
| 阶段 2-4 | `requirement-gap` | 阶段 1 | 阶段 1 |
| 阶段 3-4 | `design-flaw` | 阶段 2 | 阶段 2 |
| 阶段 4 | `design-flaw` | 阶段 3 | 阶段 3 |
| 阶段 5-8 | `requirement-gap` | 阶段 1 | 阶段 1（罕见，重大需求缺陷） |
| 阶段 5-8 | `design-flaw` | 阶段 2/3/4 | 阶段 2/3/4 |
| 阶段 5-8 | `coding-error` | — | 阶段 5（当前阶段返工，不回退） |
| 阶段 6-8 | `coding-error` | 阶段 5 | 阶段 5 |

### 6.5 循环终止条件

| 终止状态 | 触发条件 | 动作 |
|---|---|---|
| 正常通过 | S-fix 后 V/G 通过 | 🔴 CHECKPOINT · 阶段门放行 |
| 阶段回退 | 场景 5 触发 + 用户确认回退 | 回退到上游阶段 |
| 强制升级 | round 达 maxReworkRounds | 🔴 CHECKPOINT · 升级（用户介入） |
| 用户中止 | 任意 CHECKPOINT 用户选择中止 | 项目暂停，记入 run-log |

### 6.6 与 O6（Escalation Failure）运维失败模式的关系

现有 O6：返工达 maxReworkRounds 但用户未被告知；循环卡死。

扩展后：R 触发场景 5（阶段回退）+ maxReworkRounds 触达均强制 🔴 CHECKPOINT，与 O6 缓解措施一致。`run-log.jsonl` 新增 `escalate` 记录：

```json
{"action":"escalate","phase":"<阶段N>","round":<int>,"reason":"maxReworkRounds | upstreamDefect","reportId":"<RC-...，仅 upstreamDefect>","timestamp":"<ISO>","note":"<可选>"}
```

---

## 7. 与现有约束兼容性

### 7.1 新增反模式（#18、#19）

扩展 `anti-patterns.md` 反模式清单（现有 #1-#17），新增：

| # | 反模式 | 危害 | 正确做法 |
|---|---|---|---|
| **18** | 跳过 R 直接分派 S 返工（V/G 不通过后直接 S-fix，未经 R 根因定位） | 修复针对症状不针对根因，同问题反复出现；缺陷链未追溯，上游缺陷被掩盖 | V/G 不通过 → 必须先分派 R 定位 → V 复审根因 → G 门禁 → S-fix 携 R 报告修复（见 [root-cause-locator.md](root-cause-locator.md)） |
| **19** | R 报告未经 V 复审直接交 S 修复 | 根因准确性无独立保证，S 基于错误根因修复，浪费一轮返工 | R 产出后必须经 V 复审 + G 门禁（check-rootcause-report.ts exitCode=0）才可分派 S-fix |

### 7.2 现有反模式扩展

| 现有反模式 | 扩展内容 |
|---|---|
| **#4**（评审未通过悄悄小修后继续） | 扩展为：V/G 不通过后，未经 R 定位直接小修也命中 #4。修复路径必须经 R→V→G→S-fix。 |
| **#10**（编排者越权实施） | 扩展检测信号：信号6——编排者会话出现根因分析内容（rootCauseChain / rootCause 等 RootCauseReport 字段）；信号7——编排者直接判定根因并分派 S-fix（无 R 报告路径作为 S-fix 输入）。 |
| **#12**（A 自评收敛） | 扩展为：A 子流程返工也须走 R 定位（图谱/TLA+ 返工同样适用 R 循环），禁止 A 自评根因。 |

### 7.3 反模式命中高发阶段扩展

| 反模式 | 最易命中阶段 | 阶段指引 |
|---|---|---|
| #18（跳过 R 直接 S 返工） | 全阶段 | [root-cause-locator.md](root-cause-locator.md) + 各 phase-N「返工路径」节 |
| #19（R 报告未 V 复审） | 全阶段 | [root-cause-locator.md](root-cause-locator.md)「R 产出质量标准」节 |

### 7.4 与现有约束的兼容性矩阵

| 现有约束 | 兼容性 | 说明 |
|---|---|---|
| 约束 2「阶段门放行」 | 兼容 | R 介入不改变阶段门判定字段（仍为 VerifierOutput.passed + qualityLevel + GATE_JSON）；R 仅在返工路径介入 |
| 约束 4「真实执行」 | 兼容 | G 跑 check-rootcause-report.ts 真实校验 R 报告，不冲突 |
| 约束 6「按需加载」 | 兼容 | R 子代理按需加载 root-cause-locator.md，编排者不加载 |
| 约束 8「编排者最小化」 | 兼容 | R 是第 6 个子代理角色，编排者仅分派；编排者不做根因分析（命中 #10 信号6/7） |
| 反模式 #10 | 扩展 | 新增信号6/7 检测编排者越权做根因分析 |
| 反模式 #17（TLA+ 不符需求/设计未回退） | 增强 | R 定位若发现 TLA+ 根因为需求/设计缺陷（upstreamDefect），触发场景 5 阶段回退，与 #17 回退要求一致 |
| run-log R3（返工动作完整性） | 扩展 | 每轮返工须有 R + S-fix 两条记录，且 reportId 一一对应（第 5 节） |
| run-log R6（exitCode 一致性） | 扩展 | 新增 check-rootcause-report.ts 退出码交叉校验 |
| O6（Escalation Failure） | 增强 | 场景 5 阶段回退 + maxReworkRounds 触达均强制 CHECKPOINT，与 O6 缓解一致 |

### 7.5 data-models.md run-log schema 扩展

`run-log.jsonl` 动作类型枚举扩展：

```
现有：produce | review | gate | rework | checkpoint | ingest-chunk | ingest-cross | ingest-evolve | escalate
新增：rootcause | fix
```

`action` 字段值约束扩展（由 `check-run-log.ts` R1 校验）：
- `rootcause`：须含 `reportId` / `rootCauseCategory` / `upstreamDefect` / `rollbackRecommended` 字段
- `fix`：须含 `basedOnReport` / `artifacts` 字段

### 7.6 check-run-log.ts 校验规则扩展

| 规则 | 现有 | 扩展 |
|---|---|---|
| R1（动作完整性） | 7 种动作枚举 | 扩展为 9 种（新增 rootcause / fix） |
| R3（返工动作完整性） | 每轮返工须有 S 返工记录 | 每轮返工须有 R + S-fix 两条记录，reportId 一一对应，V 复审 rootcause 记录数 = R 记录数 |
| R6（exitCode 一致性） | 8 种 GATE_JSON 标记 | 新增 ROOTCAUSE_JSON 标记识别（check-rootcause-report.ts 产出） |
| R7（时序） | produce→review→gate 顺序 | 扩展：rootcause→review(rootcause)→gate→fix→review→gate 顺序（返工路径） |

### 7.7 SKILL.md 集成

`SKILL.md` 角色表（O/S/V/G/A）扩展为 6 角色（O/S/V/G/A/R），新增 R 行；F 标注为「S 兼任」。

`SKILL.md`「不可违反的约束」新增第 9 条：
> **返工必经根因定位**：V/G 不通过后，必须先分派 R 子代理产出 RootCauseReport 并经 V 复审 + G 门禁通过，才可分派 S-fix 修复。跳过 R 直接 S 返工命中反模式 #18；R 报告未 V 复审直接 S 修复命中反模式 #19。

### 7.8 SSoT §3.4 / §6.4 扩展

SSoT §3.4（编排者-子代理边界）角色表新增 R 行；§6.4（角色定义）新增 R 角色定义节，F 标注为 S 兼任。

---

## 8. 影响面清单

### 8.1 新建文件（4 个 + 第 9 节新增 1 个 = 5 个）

| 文件路径 | 用途 |
|---|---|
| `w-model-dev/references/root-cause-locator.md` | R 方法论指南（第 3 节内容：4 种方法 + 质量标准 + 方法选择规则 + 并行多人格分析节） |
| `w-model-dev/scripts/check-rootcause-report.ts` | R 报告校验脚本（第 4 节 R1-R10 校验规则） |
| `w-model-dev/scripts/__tests__/root-cause-logic.test.ts` | R 校验逻辑单元测试 |
| `w-model-dev/scripts/samples/rootcause/` | R 报告样本目录（valid.json + 10 个 bad-*.json 对应 R1-R10 失败场景） |
| `w-model-dev/references/subagent-persona-matrix.md` | R-persona / V-persona 选择矩阵（第 9 节表格） |

### 8.2 修改文件（15 个 + 第 9 节新增 2 个 = 17 个）

#### 设计文档层（SSoT 优先）

| 文件 | 修改内容 |
|---|---|
| `docs/skill-design-document_SSoT.md` | §3.4 角色表新增 R 行；§6.4 新增 R 角色定义节（F 标注 S 兼任）；§6.4.x 新增 root-cause-locator 方法论引用 + 并行多人格分析机制说明；§10.x 新增 check-rootcause-report.ts 校验项；§4A 反模式清单新增 #18/#19 |
| `w-model-dev/SKILL.md` | 角色表（O/S/V/G/A/R）；「不可违反的约束」新增第 9 条（返工必经根因定位）；返工路径节更新（R→V→G→S-fix 循环） |
| `AGENTS.md` | §2 角色描述新增 R + subagent/ 目录描述更新；§6 行动约束新增 R 相关；§7 修复记录新增本次；§8 脚本导航表新增 check-rootcause-report.ts |
| `README.md` | 角色概览节新增 R；返工流程图更新 |
| `CHANGELOG.md` | 新增本次变更条目 |

#### references/ 层

| 文件 | 修改内容 |
|---|---|
| `w-model-dev/references/subagent-delegation.md` | 角色表新增 R 行（允许/禁止动作）；新增 R 子代理分派模板；新增 V-rootcause 复审分派模板；新增 S-fix 分派模板；新增 R-lead/V-lead 并行分派模板（第 9 节）；回填契约新增 R/S-fix 返回格式；强制约束新增「跳过 R 命中 #18」；时序图更新；失败模式表新增 R 相关场景 |
| `w-model-dev/references/workflow.md` | 总体流程图返工路径更新（V/G 不通过 → R → V → G → S-fix → V → G）；回退路径阶段编号映射表新增 R 根因分类列；阶段门评审节新增 R 介入说明 |
| `w-model-dev/references/anti-patterns.md` | 反模式清单新增 #18（跳过 R 直接 S 返工）/ #19（R 报告未 V 复审直接 S 修复）；#4 扩展（未经 R 小修也命中）；#10 扩展（信号6/7）；#12 扩展（A 自评根因）；命中高发阶段表新增 #18/#19；检测信号节新增信号6/7 |
| `w-model-dev/references/data-models.md` | run-log.jsonl schema：action 枚举新增 rootcause/fix；rootcause 动作字段约束；fix 动作字段约束；escalate 动作新增 reportId 字段；budget.json 新增 rootcauseParallelBudget 字段 |
| `w-model-dev/references/verifier-spec.md` | §7 targetKind 枚举新增 rootcause；§7.4A 五轴评审映射 rootcause 子标准（correctness/completeness/falsifiability/actionability/prevention） |
| `w-model-dev/references/agent-personas.md` | 新增「与 root-cause-locator.md 的关系」节 + 「与 subagent/ 人格库的关系」节 + 并行分派说明；声明 R 不调用 Persona，Persona 不调用 R |
| `w-model-dev/references/operational-recovery.md` | 成本预算与运行日志节新增 rootcause/fix 动作的 token 计量；CHECKPOINT 放行节新增场景 5 阶段回退说明 |

#### scripts/ 层

| 文件 | 修改内容 |
|---|---|
| `w-model-dev/scripts/run-log-logic.ts` | R1 动作枚举扩展（9 种）；R3 返工完整性扩展（R + S-fix 一一对应 + V 复审数 = R 数）；R6 exitCode 一致性新增 ROOTCAUSE_JSON 标记；R7 时序校验扩展（rootcause→review→gate→fix→review→gate） |
| `w-model-dev/scripts/check-budget.ts` | 新增 R4-A 规则（并行 token 预算，rootcauseParallelBudget 校验） |
| `w-model-dev/scripts/self-test.ts` | 回归基线新增 R 样本（预计 11 条：1 valid + 10 bad）；总数从 66 增至 77 |
| `w-model-dev/scripts/gate-logic.ts` | 若需在终检门纳入 R 资产归档校验，新增 R 报告归档检查（可选，待评估） |

### 8.3 影响面统计

| 类别 | 数量 |
|---|---|
| 新建文件 | 5 |
| 修改文件 | 17 |
| 新增反模式 | 2（#18, #19） |
| 新增角色 | 1（R；F 由 S 兼任不计） |
| 新增动作类型 | 2（rootcause, fix） |
| 新增校验脚本 | 1（check-rootcause-report.ts，10 条规则） |
| self-test 基线增量 | +11 条（66→77） |
| 新增并行机制 | 1（R-lead/V-lead 并行多人格分析） |

### 8.4 不受影响的部分

- `check-verifier-output.ts` / `check-artifact-gate.ts` / `check-requirement-graph.ts` / `check-tla-model.ts` / `check-code-tla-consistency.ts`：现有门禁脚本逻辑不变，R 仅在返工路径介入
- `check-budget.ts` / `check-maturity.ts` / `check-checkpoint.ts`：不直接受影响（run-log 间接关联；budget 仅新增 R4-A 并行预算规则）
- `w-model-dev/templates/`：现有模板不变（R 报告模板嵌入 root-cause-locator.md）
- `w-model-dev-demo/`：参考实现，可在后续轮次补 R 循环演示，本次不强制

---

## 9. 并行多人格分析机制（整合 subagent/ 人格库）

### 9.1 现有人格库盘点

`w-model-dev/subagent/` 含 28 个人格文件，分 5 类：

| 类别 | 数量 | 人格 | R/V 适用性 |
|---|---|---|---|
| **engineering** | 13 | code-reviewer, senior-developer, software-architect, backend-architect, frontend-developer, ai-engineer, data-engineer, database-optimizer, autonomous-optimization-architect, incident-response-commander, threat-detection-engineer, technical-writer×2 | R + V |
| **testing** | 7 | api-tester, performance-benchmarker, reality-checker, evidence-collector, test-results-analyzer, tool-evaluator, workflow-optimizer | R + V |
| **design** | 3 | ui-designer, ux-architect, ux-researcher | V（阶段 2-3 设计评审） |
| **product** | 3 | product-manager, feedback-synthesizer, trend-researcher, behavioral-nudge-engine | V（阶段 1 需求评审） |
| **project** | 2 | project-manager-senior, experiment-tracker | V（阶段 1-2 流程评审） |

### 9.2 核心机制：O 并行分派 + R/V 聚合

```
O 分派 R-lead（主 R，加载 root-cause-locator.md + 聚合职责）
  ↓ 同时并行分派 N 个 R-persona 子代理
  R-persona-1（加载 engineering-incident-response-commander.md）→ 5-Why 根因角度
  R-persona-2（加载 engineering-code-reviewer.md）→ 代码缺陷根因角度
  R-persona-3（加载 testing-evidence-collector.md）→ 证据收集角度
  R-persona-4（加载 testing-reality-checker.md）→ 现实检验角度（防幻想根因）
  R-persona-N（按缺陷类型选 N 个）
  ↓ 各 R-persona 产出 PartialRootCauseReport
R-lead 聚合 N 份 PartialRootCauseReport → 产出最终 RootCauseReport
  ↓
O 分派 V-lead 复审根因（同样可并行分派 V-persona）
```

### 9.3 R-persona 选择矩阵（按 rootCause.category 与阶段）

| rootCause.category 候选 | 阶段 | 并行加载的 R-persona |
|---|---|---|
| `coding-error` | 5 | engineering-code-reviewer + engineering-senior-developer + testing-evidence-collector |
| `design-flaw` | 2-4 | engineering-software-architect + engineering-backend-architect（或 frontend-developer） + testing-reality-checker |
| `requirement-gap` | 1-4 | product-manager + product-feedback-synthesizer + testing-reality-checker |
| `test-gap` | 4-7 | testing-api-tester + testing-performance-benchmarker + testing-test-results-analyzer |
| `process-missing` | 全阶段 | project-manager-senior + testing-workflow-optimizer + engineering-incident-response-commander |
| `tool-gap` | 全阶段 | engineering-autonomous-optimization-architect + testing-tool-evaluator |
| `upstream-defect` | 全阶段 | engineering-incident-response-commander（5-Why + 缺陷链） + testing-evidence-collector + engineering-technical-writer（追溯文档） |
| 安全相关 Critical | 5-7 | engineering-threat-detection-engineer + engineering-code-reviewer + testing-reality-checker |
| 性能相关 Critical | 5-7 | engineering-database-optimizer + testing-performance-benchmarker + engineering-backend-architect |
| AI/LLM 相关 | 5 | engineering-ai-engineer + engineering-code-reviewer + testing-reality-checker |

### 9.4 V-persona 选择矩阵（评审时并行多角度）

| 评审场景 | 阶段 | 并行加载的 V-persona |
|---|---|---|
| 需求规格评审 | 1 | product-manager + product-feedback-synthesizer + testing-reality-checker |
| 系统设计评审 | 2 | engineering-software-architect + engineering-backend-architect + engineering-threat-detection-engineer + testing-reality-checker |
| 概要/详细设计评审 | 3-4 | engineering-software-architect + design-ux-architect + engineering-database-optimizer + testing-api-tester |
| 代码评审 | 5 | engineering-code-reviewer + engineering-senior-developer + engineering-threat-detection-engineer + testing-evidence-collector |
| 测试评审 | 6-7 | testing-api-tester + testing-performance-benchmarker + testing-reality-checker + testing-test-results-analyzer |
| 根因报告复审（targetKind=rootcause） | 全阶段 | testing-reality-checker + engineering-incident-response-commander + testing-evidence-collector |

### 9.5 PartialRootCauseReport Schema（R-persona 产出）

```json
{
  "schemaVersion": "1.0",
  "partial": true,
  "meta": {
    "reportId": "RC-<phase>-<round>-<seq>",
    "personaSlice": "<人格文件名，如 engineering-code-reviewer>",
    "angle": "<分析角度描述>",
    "analysisTimestamp": "<ISO 8601>"
  },
  "perspective": "<该人格视角下的根因假设>",
  "rootCauseChain": [<该角度的根因链，格式同 RootCauseReport>],
  "evidence": ["<该角度收集的证据>"],
  "confidence": <0.0-1.0>,
  "disagreements": ["<与其他人格视角的分歧点>"]
}
```

### 9.6 R-lead 聚合规则

R-lead 收到 N 份 PartialRootCauseReport 后：

1. **根因收敛**：若 ≥⌈N×0.6⌉ 个 persona 的 rootCauseChain 收敛到同一根因 → 采纳为最终根因。
2. **分歧仲裁**：若根因分散，R-lead 须在最终报告中记录分歧 + 选择主根因 + 标注 minority 视角到 `reviewNotes`。
3. **证据合并**：合并所有 persona 的 evidence，去重后填入最终 RootCauseReport。
4. **fixRecommendation 合并**：合并各 persona 的修复建议，按根因收敛度排序。
5. **upstreamDefect 仲裁**：若任一 persona 标记 upstreamDefect，R-lead 须复核并决定是否纳入最终报告。
6. **reality-check 硬约束**：testing-reality-checker 的 persona 若 confidence < 0.5，最终报告 `passed=false`（防幻想根因）。

### 9.7 V-lead 聚合规则（评审根因报告时）

V-lead 收到 N 份 V-persona 的 VerifierOutput 后：

1. **compositeScore**：取 N 份的加权平均（reality-checker 权重 ×1.5，其余 ×1.0）。
2. **qualityLevel**：按加权平均映射 A/B/C/D。
3. **passed**：任一 V-persona `passed=false` 且其 qualityLevel=D → V-lead `passed=false`（一票否决，防幻想通过）。
4. **reworkHints**：合并所有 V-persona 的 reworkHints，去重，按 Severity 排序。

### 9.8 并行分派数量约束

| 场景 | 默认并行数 | 上限 | 约束 |
|---|---|---|---|
| R-persona | 3 | 5 | 防止 token 爆炸；incident-response-commander 必含（5-Why 主导） |
| V-persona（评审产物） | 3 | 5 | reality-checker 必含（防幻想通过） |
| V-persona（复审根因） | 2 | 3 | reality-checker + evidence-collector 必含 |

> 并行数可在 `project.json` 的 `phaseConfig.<phase>.parallelPersonas` 覆盖。

### 9.9 Token 预算扩展

`budget.json` 新增 `rootcauseParallelBudget` 字段：

```json
{
  "rootcauseParallelBudget": {
    "maxPersonasPerRound": 5,
    "maxTokensPerPersona": 50000,
    "maxTotalTokensPerRound": 200000
  }
}
```

`check-budget.ts` 新增 R4-A 规则：R-persona 并行总 tokens 超 `maxTotalTokensPerRound` → 触发 killSwitch。

### 9.10 与现有「Persona 不调用其他 Persona」规则的兼容

现有规则：Persona 不调用其他 Persona，组合由命令或用户完成。

扩展解读：
- **O 分派并行 persona 子代理** = 「命令/用户完成组合」，不违反规则
- **R-lead / V-lead 聚合 persona 产出** = lead 角色聚合，不是 persona 互相调用
- **persona 子代理之间不通信** = 每个 persona 独立产出 PartialReport，不互相调用

### 9.11 强制 vs 可选

| 场景 | 强制/可选 | 说明 |
|---|---|---|
| Critical/Required 缺陷的 R 定位 | **强制并行** | 严重缺陷须多角度根因 |
| Optional/Nit/FYI 缺陷的 R 定位 | 可选并行（默认单 R-lead） | 轻微缺陷可单 R-lead 产出 |
| 阶段门 V 评审（首次） | 可选并行（默认单 V） | 首次评审可单 persona |
| 根因报告 V 复审 | **强制并行** | 根因准确性须多角度保证 |
| maxReworkRounds 达上限前一轮 | **强制并行** | 最后一轮须多角度穷尽 |

### 9.12 R-lead 子代理分派模板（并行变体）

```
角色：根因定位子代理-主聚合变体（R-lead）
当前 W 模型阶段：<阶段 N - 名称>
返工轮次：<round>
任务：并行分派 N 个 R-persona 子代理 → 聚合产出最终 RootCauseReport

上下文：
  - 返工来源 + reworkHints（同第 5 节 R 模板）
  - 失败产物路径 + 上游产物路径
  - rootCause.category 候选（由 O 根据 reworkHints 初判）
  - 并行 persona 选择矩阵（第 9 节）

必读：
  - references/root-cause-locator.md
  - w-model-dev/subagent/<选中的 persona 文件>（R-lead 至少加载 incident-response-commander）

执行：
  1. 按 rootCause.category 选择 N 个 persona
  2. 并行分派 N 个 R-persona 子代理（宿主 Agent 的并行子代理机制）
  3. 收集 N 份 PartialRootCauseReport
  4. 按聚合规则产出最终 RootCauseReport

产出契约：
  1. 最终 RootCauseReport JSON + .md（同第 4 节 Schema）
  2. 附录：N 份 PartialRootCauseReport 路径
  3. 返回编排者：{role:"R", variant:"lead", reportId, partialReports:[<id>], aggregationMethod, rootCauseCategory, upstreamDefect, qualityLevel, passed, summary, disagreementResolved:<bool>}

禁止：
  - 跳过 persona 直接产出报告（强制并行场景）
  - 无视 reality-checker 的 low confidence（须 passed=false）
  - 改产物 / 跑门禁 / 改 RTM
```

---

## 10. 验收标准

本设计文档的验收标准（供 spec 审阅与后续实施计划参照）：

1. **角色完整性**：R 角色定义覆盖职责/允许动作/禁止动作/与现有角色关系；F 明确由 S 兼任。
2. **循环闭环**：返工循环 V/G→R→V→G→S-fix→V→G 时序完整，含 5 种升级场景与终止条件。
3. **方法论可执行**：4 种根因分析方法有明确适用场景与选择规则；5 条质量标准可校验。
4. **Schema 完整**：RootCauseReport Schema 含所有必填字段；check-rootcause-report.ts 含 R1-R10 校验规则。
5. **分派模板可用**：R / V-rootcause / S-fix / R-lead 四个分派模板含完整上下文/必读/产出契约/禁止。
6. **约束兼容**：新增反模式 #18/#19 + 现有反模式 #4/#10/#12 扩展 + run-log R1/R3/R6/R7 扩展 + SKILL.md 约束第 9 条。
7. **并行机制**：R-lead/V-lead 并行多人格分析含选择矩阵 + 聚合规则 + 强制/可选划分 + token 预算。
8. **影响面完整**：5 新建 + 17 修改文件清单覆盖所有设计点；不受影响部分明确标注。
9. **回退路径**：场景 5 阶段回退三条件 + 回退路径映射表 + 回退后处理完整。

---

## 11. 开放问题（待实施阶段决策）

1. **rootcause-reviewer persona 是否新增**：第 5.2 节 V 复审根因报告时，persona 暂定 `code-reviewer` 或新增 `rootcause-reviewer` persona。实施阶段评估是否需要专属 persona。
2. **gate-logic.ts 终检门纳 R 资产归档**：第 8.2 节标注「可选，待评估」。实施阶段决定是否在终检门纳入 R 报告归档校验。
3. **w-model-dev-demo/ 补 R 循环演示**：第 8.4 节标注「本次不强制」。实施阶段决定是否同步更新 demo。
4. **并行 persona 子代理的宿主机制**：第 9.2 节依赖宿主 Agent 的并行子代理机制（如 Trae Task 工具并行调用）。实施阶段需验证宿主支持。
5. **PartialRootCauseReport 归档策略**：第 9.5 节产出后归档路径 `.w-model/rootcause/partial/<reportId>/<personaSlice>.json`，实施阶段确认是否需压缩或定期清理。
