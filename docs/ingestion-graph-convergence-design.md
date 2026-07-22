# 设计：超大/多目录文档 ingestion 与跨阶段图谱收敛

> **类型**：设计增量（design delta）
> **状态**：待评审
> **作用范围**：w-model-dev 技能包阶段 1–4（需求分析 → 系统设计 → 概要设计 → 详细设计）
> **创建日期**：2026-07-22
> **依赖**：[skill-design-document_SSoT.md](./skill-design-document_SSoT.md) §3.4 / §4 / §7；[w-model-dev/SKILL.md](../w-model-dev/SKILL.md)；[w-model-dev/references/subagent-delegation.md](../w-model-dev/references/subagent-delegation.md)
>
> **与 SSoT 的关系**：本文件为设计输入文档，定义新增的 A 角色、ingestion 子流程、图谱模型与 `check-requirement-graph.ts` 门禁。实现阶段须先把这些设计合并入 SSoT §3.4 / §4 / §7 / §10，再同步 `w-model-dev/` 资产（遵循 AGENTS.md「SSoT 优先」约束）。

## 0. 背景与目标

### 0.1 问题陈述

现有 w-model-dev 技能包的阶段 1（需求分析）假设输入为"自然语言需求描述"，由单个 S 子代理线性产出需求规格。当输入为超大单文件、多文档多目录结构时，存在三个缺陷：

1. **上下文超限**：单个 S 子代理无法在合理上下文窗口内综合超大输入。
2. **跨块关系遗漏**：线性产出无法识别分散在不同文档/目录间的需求依赖、冲突与追溯关系。
3. **门禁缺位**：现有 `check-verifier-output.ts`（评审质量）与 `check-artifact-gate.ts`（RTM 覆盖）均不校验需求/设计实体的**结构连通性**——无孤立节点、单根汇聚、跨阶段追溯完整——这些正是用户提出的"图谱连通性分析 + 单根树分析"要解决的。

### 0.2 目标

- 支持超大单文件、多文档多目录结构输入的**分块并行分析**，每块独立产出落地文件
- **多轮交叉分析**避免跨块关系遗漏，收敛判定由确定性图谱脚本驱动（阈值=零违反）
- 引入 **A 角色（分析子代理）**，在阶段 1–4 整条设计链路活跃，维护**演进图谱** `graph.json`
- 门禁**同步收敛**：随阶段推进，追溯校验项递增、违反数递减，阶段4结束零违反才放行进编码
- **行为一致性**：不论输入是一句话、小文件、大文件还是多目录，都启用 A 角色走同一路径（仅并行度不同）

### 0.3 不在范围内

- 阶段 5–8（编码及之后）：A 角色不活跃，`graph.json` 冻结为只读结构底座
- LLM 调用：技能包不引入 LLM 调用，A 子代理由编排者通过宿主 Agent 子代理机制启动（与现有 V 子代理一致）
- demo 重建：`w-model-dev-demo/` 已归档，本次增强不重建 demo

## 1. 角色契约与子代理分派时序

### 1.1 角色扩展：O / A / S / V / G

在现有 4 角色（O/S/V/G）基础上新增 **A 角色（分析子代理，Analysis Subagent）**，在阶段 1–4 活跃。原 S/V/G 边界不变。

| 角色 | 简称 | 职责 | 允许动作 | 禁止动作 |
|---|---|---|---|---|
| **编排者** | O | （原职责不变）+ ingestion 路由 | ① 原 6 项；② 跑 `plan-chunks.ts` 看分块计划（只读 stdout，不写文件，类比跑 `check-*.ts` 看退出码）；③ 并行分派多个 A-chunk；④ 分派 A-cross/A-evolve；⑤ 分派 G 跑 `check-requirement-graph.ts`；⑥ 维护 `.w-model/ingestion/` 目录的删除/重建（仅状态文件操作，非阶段产物，类比 `/wm reset` 对 `.w-model/*.json` 的操作） | ① 原 5 项禁止；② 写 ingestion 落地文件（md/json）；③ 自行合并图谱；④ 跳过 A→G 收敛循环直接进 S |
| **分析子代理** | A | 分块分析、交叉合并、图谱演进（阶段 1–4） | ① 读原始文档分块 / S 产出的正式文档；② 写 `.w-model/ingestion/<chunk-id>.{md,json}`；③ 读所有 chunk json 合并建图；④ 产出 `consolidated.json` + `cross-analysis-report.md` + `reworkHints`；⑤ 向 `graph.json` 追加当前阶段节点/边（通过晋升 consolidated.json） | ① 跑 `check-requirement-graph.ts`（G 负责）；② 写正式阶段产物（requirement-spec.md / system-design.md / 验收测试 / RTM）；③ 改 `project.status`；④ 越阶段产出；⑤ 删除前阶段已通过的图谱节点 |
| 产出/评审/门禁 | S/V/G | （不变） | — | — |

**边界不变量**：A 仍是"实施动作子代理"——与 S 同属"由 O 分派、不继承 O 会话历史、产出落地文件"的范畴。`subagent-delegation.md` 的"编排者最小化"铁律不因新增 A 而松动：O 仍不得自行写 ingestion 落地文件。

### 1.2 A 子代理的三种任务变体

| 变体 | 触发 | 输入 | 产出 | 返回 O |
|---|---|---|---|---|
| **A-chunk** | O 并行分派，每块一个 | 单个 chunk 的文件路径 + chunk-id + 上下文摘要（全局目录树 + 相邻 chunk 标题列表，用于跨块边初判） | `<chunk-id>.md`（人类可读分析笔记）+ `<chunk-id>.json`（实体清单，schema 见 §2.5） | `{role:"A", variant:"chunk", chunkId, entities:int, edges:int, blocked?:reason}` |
| **A-cross** | O 在阶段1所有 A-chunk 完成后分派（单实例） | `.w-model/ingestion/*.json` 全集 + 上一轮 `reworkHints`（如有） | `consolidated.json`（合并图谱）+ `cross-analysis-report.md` + `reworkHints[]` | `{role:"A", variant:"cross", totalEntities, totalEdges, isolatedNodes:[...], connectedComponents:int, roots:[...], reworkHints:[{chunkId,reason}]}` |
| **A-evolve** | O 在阶段 2–4 的 A-chunk 完成后分派（单实例） | 现有 `graph.json` + 本轮 chunk.json 全集 + 上一轮 `reworkHints` | `consolidated.json`（在现有图谱上追加当前阶段节点/边）+ `cross-analysis-report.md` + `reworkHints[]` | 同 A-cross |

**关键设计**：A-cross/A-evolve 的产出包含结构化的 `reworkHints`，但**收敛判定不由 A 的 LLM 输出决定**——而由 G 跑 `check-requirement-graph.ts` 的退出码决定（满足约束4「真实执行」）。A 的 `reworkHints` 只用于：① 给 G 子代理对照；② 给下一轮 A-chunk 作为补漏指引。这避免了"LLM 自评收敛"的漂移风险。

### 1.3 阶段 1–4 统一分派时序

每个设计阶段（1–4）进入时，O 按统一路径路由。差异仅在"A→S 还是 S→A"与"提取的节点类型"：

```
[O] 命令路由 + 读状态 + 检查前置产物（不变）
[O] 加载最小引用集：SKILL.md + 当前 phase-N-*.md + ingestion-{chunk,cross}.md（新增）+ graph-guide.md（新增）
[O] 🔴 CHECKPOINT · 阶段进入确认（原 CHECKPOINT，复用）
  ↓
[O] 跑 plan-chunks.ts "<input-path>" --phase=N --node-type=<REQ|SD|INTF|DD>
    → stdout: {chunks:[{id,path,kind,tokens}], totalChunks, strategy}
    （永远 ≥1 chunk；一句话输入产 1 chunk，行为一致性）
  ↓
[O] 🔴 CHECKPOINT · ingestion 规划确认（泛化通用）
    展示：{分块策略, 总块数, 总token估算, 涉及的现有图谱节点数}
    等待：放行 / 调整分块 / 取消
  ↓
分支判定（按阶段决定 A/S 顺序）：

═══ 阶段 1（A→S）═══
[O] 并行分派 A-chunk_1..N  → 各产 <chunk-id>.{md,json}（REQ 节点）
循环 round=1..MAX_ROUNDS(=5):
  [O] 分派 A-cross → consolidated.json + reworkHints
  [O] 分派 G → check-requirement-graph.ts --phase=1
  - exit 0 → 晋升 consolidated.json 为 graph.json → 跳出
  - exit 1, round<MAX_ROUNDS → 针对性 A-chunk 补漏（仅 reworkHints 涉及的 chunkId，重写其 <chunk-id>.json）→ 重跑 A-cross（全量重读所有 chunk json 合并，合并幂等）→ 重跑 G
  - round=MAX_ROUNDS → 🔴 CHECKPOINT · 未收敛介入
[O] 🔴 CHECKPOINT · ingestion 收敛确认
[O] 分派 S → 读 graph.json + 各 chunk.md → 产 requirement-spec.md + 验收测试 + rtm.json（按现有机制）
[O] 分派 V → 评审（不变）
[O] 分派 G → check-verifier-output.ts（不变）
[O] 🔴 CHECKPOINT · 阶段门放行（不变，展示中追加"图谱摘要"一行）

═══ 阶段 2/3/4（S→A）═══
[O] 分派 S → 按现有 phase-N 流程产出正式文档（system-design.md / interface-design.md / detailed-design.md）+ rtm.json
[O] 并行分派 A-chunk_1..N（对 S 产出文档分块；若 S 产出是单文档则 1 chunk）
    → 各产 <chunk-id>.{md,json}（SD / INTF / DD 节点）
循环 round=1..MAX_ROUNDS(=5):
  [O] 分派 A-evolve → 读现有 graph.json + 本轮 chunk.json → 追加节点/边 → consolidated.json + reworkHints
  [O] 分派 G → check-requirement-graph.ts --phase=N
  - exit 0 → 晋升 → 跳出
  - exit 1, round<MAX_ROUNDS → 针对性 A-chunk 补漏（重写其 <chunk-id>.json）→ 重跑 A-evolve（全量重读所有 chunk json 合并，合并幂等）→ 重跑 G
  - round=MAX_ROUNDS → 🔴 CHECKPOINT · 未收敛介入
[O] 🔴 CHECKPOINT · ingestion 收敛确认
[O] 分派 V → 评审（不变，评审对象含 graph.json 结构完整性）
[O] 分派 G → check-verifier-output.ts（不变）
[O] 🔴 CHECKPOINT · 阶段门放行（不变，展示中追加"图谱摘要"+阶段4时强调"零违反硬约束通过"）
```

**关键不变量**：
- 阶段 1–4 每阶段都跑图谱校验，`--phase` 参数控制追溯项数量（1→2→3 个，见 §3.4）
- 阶段 4 门禁 `passed=false` → 不放行进阶段 5（硬约束）
- 原 phase-N 的 V 评审 + `check-verifier-output.ts` + 阶段门 CHECKPOINT 全部保留，图谱校验是叠加而非替代

### 1.4 与现有铁律的兼容性

| 现有铁律 | ingestion 流程的遵守方式 |
|---|---|
| 编排者最小化（约束8/反模式#10） | O 只跑只读 `plan-chunks.ts`（类比 `check-*.ts` 看退出码）、分派 A/S/V/G、CHECKPOINT 等待、状态持久化；不写 ingestion 落地文件 |
| 真实执行（约束4） | 收敛判定由 G 跑 `check-requirement-graph.ts` 退出码决定，不由 A 的 LLM 输出决定 |
| 阶段门放行（约束2） | ingestion 引入两个新 CHECKPOINT（规划确认 / 收敛确认），均不可绕过；原 phase-N 阶段门 CHECKPOINT 保留 |
| 按需加载（约束6） | A-chunk 只加载 `ingestion-chunk.md` + 全局目录树摘要；A-cross/A-evolve 只加载 `ingestion-cross.md` + chunk json 全集 + 现有 graph.json |
| 失败即回退（约束5） | G 退出码 1 → 针对性 A-chunk 补漏重跑；MAX_ROUNDS 未收敛 → CHECKPOINT 介入，不得静默接受 |

## 2. JSON 实体 schema 与图谱模型

### 2.1 节点类型（每阶段一种）

| 阶段 | 节点类型 | 由谁提取 | 语义 |
|---|---|---|---|
| 1 需求分析 | `REQ` | A-chunk 从输入提取 | 功能/非功能/约束需求 |
| 2 系统设计 | `SD` | A-evolve 从 S 的 system-design.md 提取 | 系统模块/组件 |
| 3 概要设计 | `INTF` | A-evolve 从 S 的 outline-design.md（接口设计文档）提取 | 接口实体 |
| 4 详细设计 | `DD` | A-evolve 从 S 的 detailed-design.md 提取 | 详细设计单元 |

### 2.2 节点 schema（统一）

```json
{
  "id": "REQ-001",
  "type": "REQ|SD|INTF|DD",
  "phase": 1,
  "title": "<短标题>",
  "summary": "<一句话描述>",
  "sourceChunk": "<chunk-id>",
  "sourceArtifact": "<S 产出文件路径，阶段2-4>",
  "attributes": {
    "reqType": "functional|nonfunctional|constraint",
    "priority": "high|medium|low",
    "acceptanceCriteria": ["<可量化验收标准>"],
    "module": "<模块名>",
    "interface": "<签名>",
    "algorithm": "<算法简述>"
  }
}
```

`id` 格式 `<TYPE>-<NNN>` 全局唯一；`attributes` 仅填该类型相关字段。

### 2.3 边类型

| 边类型 | 方向 | 语义 | 数量约束 |
|---|---|---|---|
| `parent` | 父→子 | 构成单根树的主结构边：REQ→SD→INTF→DD | 每非根节点**恰好1条**入边；根节点0条 |
| `depends-on` | 任意→任意 | 通用依赖（含同类型间） | ≥0 |
| `implements` | SD→REQ | 设计实现需求（追溯边） | 每 SD ≥1 |
| `defines` | SD→INTF | 系统设计定义接口 | 每 INTF ≥1（阶段3起校验） |
| `realizes` | DD→INTF | 详细设计实现接口 | 每 DD ≥1（阶段4起校验） |

**单根树**由 `parent` 边构成：`REQ-ROOT → REQ-module → SD → INTF → DD`，多级汇聚为一个根。`implements/defines/realizes` 是追溯边，不参与树的父唯一性约束但参与连通性。

### 2.4 graph.json schema

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

### 2.5 chunk 落地文件 schema（A-chunk 产出）

每块产出两个文件到 `.w-model/ingestion/`：

- `<chunk-id>.md` — 人类可读分析笔记（提取的实体、疑点、跨块引用线索）
- `<chunk-id>.json`：

```json
{
  "chunkId": "<chunk-id>",
  "phase": 1,
  "sourcePath": "<原始文档路径>",
  "nodes": [<本块提取的节点>],
  "edges": [<本块内部边>],
  "crossChunkHints": [{"target":"<疑似关联的chunk-id>","reason":"<...>"}]
}
```

`crossChunkHints` 供 A-cross 合并时识别跨块边——A-chunk 独立产出时只能初判跨块关系，最终跨块边由 A-cross 在合并时确认写入 `graph.json`。

### 2.6 consolidated.json（A-cross/A-evolve 产出，收敛循环中间态）

```json
{
  "phase": 1,
  "round": 2,
  "nodes": [<合并后全量节点>],
  "edges": [<合并后全量边，含跨块边>],
  "isolatedNodes": ["<id>"],
  "connectedComponents": 2,
  "roots": ["REQ-001","REQ-007"],
  "reworkHints": [{"chunkId":"<id>","reason":"<孤立节点/缺根/缺跨块边>"}]
}
```

A-cross/A-evolve 把 `consolidated.json` 作为 `graph.json` 的候选态写入；G 跑 `check-requirement-graph.ts` 校验它；通过后晋升为正式 `graph.json`。收敛循环期间 `consolidated.json` 反复重写，`graph.json` 仅在 `passed=true` 时更新。

### 2.7 graph.json 与 rtm.json 的分工

| 文件 | 管什么 | 谁维护 | G 跑什么 |
|---|---|---|---|
| `graph.json` | 结构拓扑（节点/边/连通/单根/跨阶段追溯） | A-chunk/A-cross/A-evolve | `check-requirement-graph.ts` |
| `rtm.json` | 追溯矩阵（需求-设计-代码-测试映射，现有 schema 不变） | S（原机制不变） | `check-artifact-gate.ts`（阶段8终检，不变） |

两者并存：`graph.json` 是本次新增的**结构层**，`rtm.json` 是现有**追溯层**。S 在阶段 1–4 产出正式文档后，同时更新 `rtm.json`（按现有 rtm-guide.md）和通过 A 更新 `graph.json`。`graph.json` 的 `implements/defines/realizes` 边与 `rtm.json` 的追溯列语义重叠但用途不同——`graph.json` 用于**结构连通性门禁**，`rtm.json` 用于**测试覆盖门禁**，各自独立校验，互不替代。

## 3. 图谱校验算法与收敛准则

### 3.1 check-requirement-graph.ts 接口

```bash
npx tsx w-model-dev/scripts/check-requirement-graph.ts "<graph.json or consolidated.json>" [--phase=1|2|3|4]
```

退出码：`0=通过 / 1=校验失败 / 2=输入错误`。stdout 输出 JSON 证据摘要（与 `check-verifier-output.ts` 同构）。

### 3.2 校验算法（确定性，无 LLM）

```
输入: graph(consolidated.json), phase
1. 解析节点/边，构建邻接表（所有边类型参与）
2. 连通性检查: 从任一节点 BFS
   - visited < totalNodes → fail, 记录 isolatedNodes = 未访问节点
   - connectedComponents = 1 才通过
3. 单根检查: 统计入边 type=parent 为 0 的节点
   - roots.length ≠ 1 → fail, 记录 roots[]
4. 父唯一性: 每个非根节点的 parent 入边数
   - 0 → orphan（fail）；>1 → multiParent（fail）
5. 阶段递进追溯检查（"门禁同步收敛"的核心）:
   - phase ≥ 2: 每个 SD 节点出边 implements ≥ 1 → 否则 SD_without_implements++
   - phase ≥ 3: 每个 INTF 节点入边 defines ≥ 1 → 否则 INTF_without_defines++
   - phase ≥ 4: 每个 DD 节点出边 realizes ≥ 1 → 否则 DD_without_realizes++
6. 汇总:
   passed = (connectedComponents=1) ∧ (isolatedNodes=[]) ∧ (roots.length=1)
            ∧ (orphans=[]) ∧ (multiParent=[]) ∧ (所有追溯违反=0)
```

### 3.3 输出 JSON（G 子代理回填）

```json
{
  "exitCode": 0,
  "passed": true,
  "phase": 2,
  "totalNodes": 18,
  "totalEdges": 31,
  "connectedComponents": 1,
  "isolatedNodes": [],
  "roots": ["REQ-ROOT"],
  "orphans": [],
  "multiParent": [],
  "traceabilityViolations": {
    "SD_without_implements": 0,
    "INTF_without_defines": 0,
    "DD_without_realizes": 0
  },
  "violations": [],
  "converged": true
}
```

### 3.4 收敛准则（阈值驱动）

**收敛定义**：`passed=true`（零违反）。

**轮内收敛**（单阶段 ingestion 循环）：
- G 每轮跑 `check-requirement-graph.ts`，A-cross/A-evolve 的 `reworkHints` 指向具体 chunkId 与原因
- `violations` 数应**单调递减**（跨轮）；若某轮 violations 不降反升 → A 产出漂移，O 分派 A 返工而非加轮
- `passed=true` → 收敛，跳出循环
- `round = MAX_ROUNDS(5)` 未收敛 → 🔴 CHECKPOINT 介入（展示 violations + reworkHints，用户决定补漏/强制接受标注/取消）

**跨阶段收敛**（"门禁同步收敛"的语义）：
- 阶段1：仅校验 REQ 子图连通 + 单根（追溯检查项 0 个）
- 阶段2：+ `SD_without_implements=0`（追溯项 1 个）
- 阶段3：+ `INTF_without_defines=0`（追溯项 2 个）
- 阶段4：+ `DD_without_realizes=0`（追溯项 3 个）—— **硬约束零违反才放行进阶段5**
- 门禁项**单调递增**，违反数应**单调递减至 0**：这是"信息不断精细化、门禁同步收敛"的形式化表达

### 3.5 "孤立需求/不连通域"与"单根树"的具体落地

对应"图谱连通性分析 + 单根树分析"两个算法分析方法：

| 用户要求 | 脚本实现 |
|---|---|
| 图谱连通性分析（无孤立需求/不连通域） | 步骤2 BFS，`connectedComponents=1` 且 `isolatedNodes=[]` |
| 单根树分析（所有需求汇聚为单根多级系统联通域） | 步骤3 + 步骤4，`roots.length=1` 且无 orphan/multiParent；`parent` 边构成 REQ→SD→INTF→DD 多级树 |

两者均为纯图论确定性算法，无 LLM 参与，满足约束4「真实执行」。

## 4. 与现有阶段衔接、文件清单与脚本接口

### 4.1 现有文件改动清单

| 文件 | 改动 |
|---|---|
| `SKILL.md` | 「编排者-子代理边界」节角色表加 A 行；「执行工作流」步 6 前插入 ingestion 子流程描述；「命令速查」`/wm analyze` 与 `/wm design` 行注明 ingestion 触发；「快速自检」加"图谱校验通过"项 |
| `references/subagent-delegation.md` | 角色表加 A 行；新增「A 子代理分派模板」节（A-chunk/A-cross/A-evolve 三模板）；回填契约加 A 返回格式；强制约束节注明 A 的禁止动作 |
| `references/phase-1-requirements.md` | 「需求解析算法」前插入 ingestion 子流程引用；「执行方法论」表加 graph.json 行；「验收标准」加"图谱连通+单根通过" |
| `references/phase-2-system-design.md` `phase-3-outline-design.md` `phase-4-detailed-design.md` | 各加「ingestion 子流程（S→A 路径）」节；阶段4加"图谱零违反硬约束" |
| `references/workflow.md` | 流程图阶段1-4节点加 ingestion 子流程标注；阶段产物清单表加 graph.json 列 |
| `references/anti-patterns.md` | 新增 #11「ingestion 跳过图谱校验」、#12「A 自评收敛」；F1-F10 失败模式补充 ingestion 相关信号 |
| `references/command-reference.md` | `/wm analyze` 与 `/wm design` 命令条目加 ingestion 字段说明 |
| `scripts/self-test.ts` | 新增 plan-chunks + check-requirement-graph 的样本测试用例（与现有 17 条同构追加） |
| `scripts/samples/graph/` | 新增样本目录：`valid-graph.json`、`bad-isolated.json`、`bad-multi-root.json`、`bad-orphan.json`、`bad-sd-no-implements.json` 等 |
| `examples/requirement-analysis.md` | 加"超大文档 ingestion"交互样例片段 |

### 4.2 新增文件清单

#### 参考文件（references/）

| 文件 | 用途 | 加载方 |
|---|---|---|
| `references/ingestion-chunk.md` | A-chunk 任务指引：节点提取规则、跨块 hint 写法、blocked 返回条件 | A-chunk |
| `references/ingestion-cross.md` | A-cross/A-evolve 任务指引：合并建图算法、跨块边确认、reworkHints 产出格式 | A-cross, A-evolve |
| `references/graph-guide.md` | 图谱模型说明：节点/边类型、单根树约束、阶段递进追溯规则、与 rtm.json 分工 | A-*, G, S（按需） |

#### 脚本（scripts/）

| 脚本 | 跑者 | 接口 | 退出码 |
|---|---|---|---|
| `scripts/plan-chunks.ts` | O（只读 stdout） | `plan-chunks.ts "<path>" --phase=N --node-type=<TYPE> [--max-tokens=8000]` | 0=正常 / 2=输入错误 |
| `scripts/check-requirement-graph.ts` | G | `check-requirement-graph.ts "<graph.json\|consolidated.json>" --phase=N` | 0=通过 / 1=校验失败 / 2=输入错误 |

两个脚本均自包含（仅依赖 tsx + Node 标准库，不 import src/），与现有 `check-verifier-output.ts` / `check-artifact-gate.ts` 同构。

#### 数据文件（.w-model/ingestion/，项目运行时）

| 文件 | 产出者 | 生命周期 |
|---|---|---|
| `<chunk-id>.md` | A-chunk | ingestion 期间累积；阶段门通过后可清理（O 执行，类比 `/wm reset`） |
| `<chunk-id>.json` | A-chunk | 同上 |
| `consolidated.json` | A-cross/A-evolve | 收敛循环中间态；晋升为 graph.json 后可清理 |
| `graph.json` | A-cross/A-evolve（晋升写入） | **持久化**，跨阶段演进，阶段4后冻结作为 RTM 结构底座 |
| `cross-analysis-report.md` | A-cross/A-evolve | 每轮重写，最终态随阶段门归档 |
| `graph.phase-N.bak.json` | O（备份） | 每阶段门通过后备份，失败恢复用 |

### 4.3 plan-chunks.ts 分块策略（混合：文件/目录+超限拆分）

```
输入: path, phase, node-type, max-tokens(默认8000)
1. 判定 path 类型:
   - 单文件 → 候选块=[该文件]
   - 目录 → 遍历，按"一个文件或一个叶子子目录=一候选块"
2. 对每个候选块估算 tokens（字符数/4 近似）
3. 超限拆分: 候选块 tokens > max-tokens
   - Markdown: 按 # 标题层级切分，递归至 max-tokens 内
   - 非 Markdown: 按固定行数切分（带 overlap 50 行）
4. 分配 chunk-id: chunk-001, chunk-002, ...
输出 stdout:
{
  "chunks":[{"id":"chunk-001","path":"...","kind":"file|dir|section","tokens":4200}],
  "totalChunks":3,
  "strategy":"file-split|dir-tree|single",
  "phase":1,
  "nodeType":"REQ"
}
```

不写文件——O 读取 stdout 后用于 CHECKPOINT 展示与 A-chunk 分派。一句话输入 → `strategy:single, totalChunks:1`，仍走完整 A 流程（行为一致性）。

### 4.4 与 demo 项目的关系

`w-model-dev-demo/` 是已归档的参考实现（2026-07-21 confirm）。本次增强**不重建 demo**——demo 验证的是"编排+评审+门禁"端到端可用，ingestion 是叠加能力，不改变核心编排逻辑。若后续需验证 ingestion，可作为独立 eval 场景，不纳入 demo 归档范围。

## 5. 失败模式与回退

### 5.1 ingestion 特有失败模式

| # | 失败场景 | 检测信号 | 处理 |
|---|---|---|---|
| 1 | A-chunk 产出 JSON 不满足 schema | G `check-requirement-graph.ts` exit 2 / A-cross 解析失败 | O 分派该 A-chunk 重新产出（带 schema 错误明细） |
| 2 | A-chunk 返回 `blocked`（如分块边界切断了实体定义） | A-chunk 返回 `{blocked:reason}` | O 🔴 CHECKPOINT 介入：展示 blocked reason，用户决定调整分块/手动补/取消 |
| 3 | 收敛循环 violations 不降反升（A 漂移） | 跨轮 `violations.length` 递增 | O 不加轮，分派 A-cross/A-evolve 返工（带上一轮 consolidated.json 作对照） |
| 4 | MAX_ROUNDS=5 未收敛 | round=5 且 passed=false | O 🔴 CHECKPOINT · 未收敛介入：展示 violations + reworkHints，用户三选一（手动补漏重跑/强制接受标注未解决项/取消） |
| 5 | graph.json 损坏（手动编辑/合并冲突） | G exit 2 或 O 读取解析失败 | O 🔴 CHECKPOINT：从 `graph.phase-N.bak.json` 恢复，或回退到该阶段起点重跑 ingestion |
| 6 | 阶段4门禁零违反未达 | G `check-requirement-graph.ts --phase=4` exit 1 | 不放行进阶段5；分派 A-evolve/S 返工补追溯边，重跑 G |
| 7 | A 越权写正式阶段产物（requirement-spec.md 等） | A 会话出现 Write 写非 ingestion 路径文件 | 命中反模式 #10 变体，回退到当前阶段起点，A 产出的越权实体作废 |
| 8 | O 越权自行合并图谱/写 ingestion 文件 | O 会话出现 Write 写 `.w-model/ingestion/*` | 命中反模式 #10，回退到当前阶段起点 |

### 5.2 与现有失败模式的衔接

- **反模式 #10（编排者越权实施）**：扩展覆盖 O 越权写 ingestion 文件、O 自行合并图谱、A 越权写正式产物三种新变体。检测信号与回退动作沿用现有定义。
- **反模式 #3/#6（LLM 估算质量门）**：A 的 LLM 输出不得作为收敛判定，必须由 G 跑脚本退出码决定——这是 ingestion 场景对该反模式的强化。
- **约束4（真实执行）**：`check-requirement-graph.ts` 退出码是收敛的唯一判定源，A 的 `reworkHints` 仅作指引不作判定。
- **约束2（阶段门放行）**：ingestion 引入的两个新 CHECKPOINT（规划确认/收敛确认）+ 阶段4硬约束，均不可绕过。

### 5.3 跨阶段图谱一致性保障

| 保障点 | 机制 |
|---|---|
| 图谱单调演进 | A-evolve 只追加当前阶段节点/边，不删除前阶段节点；删除需 🔴 CHECKPOINT 确认 |
| 备份点 | 每阶段门通过后，O 复制 `graph.json` 为 `graph.phase-N.bak.json`；失败模式5恢复用 |
| 追溯项递增校验 | `--phase` 参数控制校验严格度，阶段4最严（3个追溯项全检） |
| 阶段4冻结 | 阶段4门禁通过后 `graph.json.currentPhase=4` 标记冻结，阶段5+ A 不活跃，图谱作为 RTM 结构底座只读 |

### 5.4 取消与重置语义

- **ingestion 期间取消**：O 清理 `.w-model/ingestion/` 下本轮 chunk/consolidated 文件，保留上一阶段通过的 graph.json，`project.status` 不变
- **`/wm reset` 扩展**：现 reset 清空 rtm.json 实体；扩展为同时清空 graph.json + ingestion/ 目录，保留 project.json 元信息（仍需 🔴 CHECKPOINT）

### 5.5 阶段1-3 与阶段4 的"强制接受"区分

失败模式4 的"强制接受标注未解决项"选项，在阶段1-3 与阶段4 有不同语义：

| 阶段 | 强制接受语义 | 后果 |
|---|---|---|
| 阶段1–3 | 允许：用户可强制接受带未解决项放行，标注到 `graph.json.analysisRounds[].converged=false` 与 cross-analysis-report.md | 未解决项留待后续阶段 A-evolve 补；阶段4 门禁仍要求零违反，届时必须解决 |
| 阶段4 | **不允许**：阶段4 门禁零违反是硬约束，不得强制接受 | 必须返工至零违反才放行进阶段5编码 |

这个区分体现了"门禁同步收敛"的严格性递增：前阶段允许带债推进，后阶段（编码前）必须清债。

## 6. 开放问题（实现阶段决定）

以下问题不影响本设计的整体架构，留待实现阶段（writing-plans → 实施）决定：

1. `plan-chunks.ts` 的 token 估算精度（字符数/4 近似 vs 更精确的 tokenizer）——实现时可调
2. A-chunk 并行度的实际上限（宿主 Agent 子代理并发限制）——由宿主决定，技能包不强制
3. `check-requirement-graph.ts` 的 BFS 起点选择（任一节点 vs 指定根）——实现时定，算法等价
4. graph.json 是否需要版本迁移机制（schema version 升级时）——v1 先不引入，后续按需

## 7. 验收标准（本设计文档自身）

- [ ] A 角色边界与现有 O/S/V/G 不冲突，编排者最小化铁律保持
- [ ] 收敛判定由确定性脚本退出码驱动，无 LLM 自评
- [ ] 行为一致性：一句话/小文件/大文件/多目录走同一路径
- [ ] 图谱连通性 + 单根树 + 跨阶段追溯有确定性算法落地
- [ ] 门禁同步收敛：阶段1→4 追溯项递增、违反数递减、阶段4零违反硬约束
- [ ] 新增 2 脚本与现有 `check-*.ts` 同构（自包含、退出码 0/1/2）
- [ ] 现有 phase-N 的 V 评审 + 阶段门 CHECKPOINT 保留，ingestion 是叠加非替代
- [ ] 失败模式覆盖 ingestion 特有场景，与现有反模式 #10 衔接
