# 设计：信息流校验增强（黑洞 / 奇迹 / 死模块门禁）

> **类型**：设计增量（design delta）
> **状态**：待评审
> **作用范围**：w-model-dev 技能包阶段 1–4（需求分析 → 系统设计 → 概要设计 → 详细设计）的图谱门禁
> **创建日期**：2026-07-23
> **依赖**：[skill-design-document_SSoT.md](./skill-design-document_SSoT.md) §3.4 / §7.7 / §10.7；[ingestion-graph-convergence-design.md](./ingestion-graph-convergence-design.md)；[w-model-dev/scripts/graph-logic.ts](../w-model-dev/scripts/graph-logic.ts)
>
> **与 SSoT 的关系**：本文件为设计输入文档，定义信息流校验层（黑洞/奇迹/死模块）与显式边界节点。实现阶段须先把这些设计合并入 SSoT §7.7（graph.json schema）与 §10.7（图谱门禁），再同步 `w-model-dev/` 资产（遵循 AGENTS.md「SSoT 优先」约束）。

## 0. 背景与目标

### 0.1 设计公理

> **任何软件系统都不会是黑洞或奇迹，也不可能存在没有任何信息流过的模块。**

这是一条数据流图（DFD, Yourdon-DeMarco）经典的信息流完整性约束，形式化为对图谱节点的三条不变量：

| 反常 | 定义 | 图论刻画（非边界节点） |
|---|---|---|
| **黑洞 black hole** | 只进不出——有输入流、无输出流，信息消失 | 信息流出度 = 0 ∧ 信息流入度 > 0 |
| **奇迹 miracle** | 只出不进——有输出流、无输入流，信息凭空产生 | 信息流入度 = 0 ∧ 信息流出度 > 0 |
| **死模块 dead module** | 无信息流经——既不进也不出 | 信息流入度 = 0 ∧ 信息流出度 = 0 |

### 0.2 为什么需要这一层

现有 `check-requirement-graph.ts` 校验的是**结构连通性**：通过 `parent` / `implements` / `defines` / `realizes` 边做 BFS、单根、父唯一性、跨阶段追溯。这些边刻画的是「结构归属与追溯关系」——一个模块可以**结构上追溯完整**（有 `parent`、有 `implements`），但在**信息流层面仍是黑洞**：它消费了上游输入，却没有任何产出流向下游。

因此信息流校验是一个**与现有结构门禁正交的独立维度**，是叠加而非替代：

| 维度 | 校验什么 | 边类型 | 失败信号 |
|---|---|---|---|
| 结构连通（现有） | 节点是否归属单根树、追溯是否完整 | `parent` / `implements` / `defines` / `realizes` | 孤立节点 / 多根 / orphan / 追溯缺失 |
| 信息流闭合（新增） | 节点是否既是信息生产者又是消费者 | `produces` / `consumes`（新增） | 黑洞 / 奇迹 / 死模块 / 边界缺失 |

### 0.3 不在范围内

- 阶段 5–8（编码及之后）：A 角色不活跃，信息流校验随 `graph.json` 冻结而只读，不新增校验。
- LLM 调用：技能包不引入 LLM 调用；信息流边由 A 子代理在分块/合并时提取，校验由确定性脚本完成。
- 数据流的内容级建模（具体字段流转、数据字典）：本设计只校验**信息流拓扑闭合**，不建模数据内容。

## 1. 数据模型扩展（复用 `graph.json`）

### 1.1 新增信息流边类型

在现有 5 类边（`parent` / `depends-on` / `implements` / `defines` / `realizes`）基础上新增 2 类**有方向语义**的信息流边。

**统一方向约定（消除歧义）**：两类边的 `{from, to}` 一律表示**信息流方向**——`from` 是信息来源，`to` 是信息去向。因此对任意节点 `n`，`to=n` 的边即"流入 n"，`from=n` 的边即"流出 n"，不因边类型不同而反向。

| 边类型 | `from` → `to` | 语义 | 数量约束 |
|---|---|---|---|
| `produces` | 生产者 → 消费者 \| 生产者 → `EXT-OUT` | 强调「产出」视角：`from` 节点把信息推给 `to` | 业务节点 ≥ 0 |
| `consumes` | `EXT-IN` → 消费者 \| 生产者 → 消费者 | 强调「消费」视角：`to` 节点从 `from` 拉取信息 | 业务节点 ≥ 0 |

> 两类边方向语义相同（均为信息流方向），区别仅在**语义强调**与**A 子代理提取来源**：`produces` 通常由生产方文档提取，`consumes` 通常由消费方文档提取，合并后可能表征同一条流。校验时二者等价参与 inFlow/outFlow 统计（见 §2.1）。保留两类是为了让 A 子代理在分块提取时能各自记录「我产出了什么 / 我消费了什么」，A-cross 合并时去重为同一条流。

`produces` / `consumes` 不参与 `parent` 单根树约束（它们是信息流层，不是结构归属层），但参与整体连通性 BFS。

### 1.2 新增边界节点类型（DFD terminator）

| 节点类型 | 语义 | 豁免判定 | 数量约束 |
|---|---|---|---|
| `EXT-IN` | 合法信息源（用户输入、外部 API、业务背景） | 豁免奇迹判定（它本就该只产出） | 阶段 1 起 ≥ 1 |
| `EXT-OUT` | 合法信息汇（界面展示、持久化、外部调用、验收输出） | 豁免黑洞判定（它本就该只消费） | 阶段 1 起 ≥ 1 |

边界节点 schema：

```json
{
  "id": "EXT-IN-001",
  "type": "EXT-IN",
  "phase": 1,
  "title": "业务背景/用户输入",
  "summary": "系统外部的信息源"
}
```

边界节点参与信息流连通性，**不参与 `parent` 单根树**（它们挂在 `produces`/`consumes` 边上，不在结构树里），因此不影响现有 `roots.length=1` 判定。

### 1.3 graph.json schema 增量

`graph.json` 顶层结构不变（`version` / `project` / `currentPhase` / `rootId` / `nodes` / `edges` / `analysisRounds`），仅 `nodes` 与 `edges` 数组内容扩展：

- `nodes` 可含 `EXT-IN` / `EXT-OUT` 类型节点；
- `edges` 可含 `produces` / `consumes` 类型边。

`analysisRounds[].violations` 在 `check-requirement-graph.ts` 输出中新增信息流违反项（见 §3.3）。

## 2. 校验算法扩展（`check-requirement-graph.ts` + `graph-logic.ts`）

### 2.1 算法（确定性，无 LLM）

在现有步骤 1–5（连通性 / 单根 / 父唯一性 / 阶段递进追溯）基础上，**新增步骤 6–8**：

```
输入: graph, phase
（步骤 1-5 现有结构校验，保留不变）
6. 信息流校验（新增，仅对当前 phase 活跃的非边界节点）:
   构建 produces/consumes 有向子图
   businessNodes = nodes 中 type ∈ {REQ|SD|INTF|DD} 且 phase ≤ currentPhase 的节点
   for n in businessNodes:
     # 方向已统一（§1.1）：to=n 的边即流入，from=n 的边即流出
     inFlow  = count(edges where (type=produces ∨ type=consumes) ∧ to=n)
     outFlow = count(edges where (type=produces ∨ type=consumes) ∧ from=n)
     - inFlow=0 ∧ outFlow=0 → deadModules.push(n)
     - inFlow=0 ∧ outFlow>0 → miracles.push(n)
     - inFlow>0 ∧ outFlow=0 → blackHoles.push(n)
7. 边界完整性（新增，阶段 1 起）:
   extIn  = count(nodes where type=EXT-IN)
   extOut = count(nodes where type=EXT-OUT)
   - extIn < 1  → boundaryViolation: "缺少 EXT-IN 边界源"
   - extOut < 1 → boundaryViolation: "缺少 EXT-OUT 边界汇"
8. 汇总:
   passed = 现有结构 passed
            ∧ (blackHoles = [])
            ∧ (miracles = [])
            ∧ (deadModules = [])
            ∧ 边界完整
```

**关键不变量**：
- 边界节点（`EXT-IN` / `EXT-OUT`）**豁免**黑洞/奇迹/死模块判定——它们本就是合法的源/汇。
- 信息流校验**仅作用于业务节点**（`REQ`/`SD`/`INTF`/`DD`），且按 `phase` 递进（阶段 N 只校验 `phase ≤ N` 的业务节点，与现有追溯项递进同节奏）。

### 2.2 跨阶段收敛（与现有追溯项同节奏，硬约束）

| 阶段 | 信息流校验项 | 强度 |
|---|---|---|
| 1 | REQ 子图信息流闭合：REQ 间 `produces`/`consumes` 连通 + `EXT-IN`/`EXT-OUT` 边界完整 + 无 REQ 黑洞/奇迹/死模块 | **严格**（与结构连通同级） |
| 2 | + SD 节点无黑洞/奇迹/死模块 | 硬约束 |
| 3 | + INTF 节点无黑洞/奇迹/死模块 | 硬约束 |
| 4 | + DD 节点无黑洞/奇迹/死模块；`--phase=4` 信息流零违反 ∧ 结构零违反才放行进编码 | **硬约束零违反** |

门禁项随阶段递增、违反数应单调递减至 0——这是"信息不断精细化、门禁同步收敛"在信息流维度的形式化表达，与现有结构追溯收敛同构。

### 2.3 退出码与输出

退出码沿用 `0=通过 / 1=校验失败 / 2=输入错误`。

输出 JSON（G 子代理回填）在现有字段基础上新增 `dataflowViolations` 与 `boundary`：

```json
{
  "exitCode": 1,
  "passed": false,
  "phase": 2,
  "totalNodes": 20,
  "totalEdges": 34,
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
  "dataflowViolations": {
    "blackHoles": ["SD-003"],
    "miracles": [],
    "deadModules": ["SD-007"]
  },
  "boundary": { "extIn": 1, "extOut": 2, "complete": true },
  "violations": ["blackHole:SD-003", "deadModule:SD-007"],
  "converged": false
}
```

## 3. A 子代理职责扩展

现有 A 子代理（A-chunk / A-cross / A-evolve）在提取节点与结构边时，**同步提取信息流边与边界节点**：

### 3.1 A-chunk

从文档分块中识别每个实体的：
- **输入信息**（消费了哪些上游）：写入 `edges` 中 `type=consumes` 的边；
- **输出信息**（产出了哪些下游）：写入 `edges` 中 `type=produces` 的边；
- **边界**：识别外部信息源（`EXT-IN`）与外部信息汇（`EXT-OUT`），写入 `nodes`。

`<chunk-id>.json` schema 不变（仍为 `nodes` + `edges` + `crossChunkHints`），仅 `nodes`/`edges` 内容扩展。

### 3.2 A-cross / A-evolve

合并时：
- 确认跨块信息流边（A-chunk 独立产出时只能初判跨块 `produces`/`consumes`，最终由 A-cross 在合并时确认写入 `graph.json`）；
- 把信息流候选违反（疑似黑洞/奇迹）写入 `reworkHints`，如 `{chunkId:"chunk-003", reason:"SD-003 疑似黑洞：消费 REQ-002 但无 produces 边"}`。

### 3.3 收敛判定权属（守护反模式 #12）

**收敛判定仍由 G 跑 `check-requirement-graph.ts` 退出码决定，不由 A 的 LLM 输出决定**（满足约束 4「真实执行」）。A 的 `reworkHints` 只用于：① 给 G 子代理对照；② 给下一轮 A-chunk 作为补漏指引。这延续了 ingestion 设计既有的「LLM 不自评收敛」铁律，信息流维度不松动。

## 4. 与现有铁律的兼容性

| 现有铁律 | 信息流校验的遵守方式 |
|---|---|
| 编排者最小化（约束 8 / 反模式 #10） | O 仍只跑只读 `check-requirement-graph.ts` 看退出码、分派 A/S/V/G；信息流边由 A 提取，不由 O 写 |
| 真实执行（约束 4） | 信息流收敛判定由 G 跑脚本退出码决定，不由 A 的 LLM 输出决定 |
| 阶段门放行（约束 2） | 信息流违反 = 门禁失败，不得放行；阶段 4 信息流零违反是进编码的硬约束 |
| 按需加载（约束 6） | A 子代理信息流提取规则写入 `ingestion-chunk.md` / `ingestion-cross.md`，按需加载 |
| 失败即回退（约束 5） | G 退出码 1 且 `dataflowViolations` 非空 → 针对性 A-chunk 补漏重跑 |
| 图谱单调演进 | A-evolve 追加信息流边时不删除前阶段已通过的边；删除需 🔴 CHECKPOINT 确认 |

## 5. 文档与脚本改动清单

### 5.1 设计文档（docs/）

| 文件 | 改动 |
|---|---|
| `docs/ingestion-graph-convergence-design.md` | §2.1 节点类型表加 `EXT-IN`/`EXT-OUT` 行；§2.3 边类型表加 `produces`/`consumes` 行；§3.2 算法加步骤 6-8；§3.4 收敛准则加信息流项；§3.5 对照表加"信息流闭合"行 |
| `docs/skill-design-document_SSoT.md` | §7.7 graph.json schema 节加信息流边与边界节点说明；§10.7 图谱门禁节加黑洞/奇迹/死模块校验；§10A 追溯表对应行更新 |

### 5.2 技能资产（w-model-dev/）

| 文件 | 改动 |
|---|---|
| `w-model-dev/references/graph-guide.md` | 新增「信息流模型」节：三不变量、边界节点、与结构边的正交性、跨阶段收敛 |
| `w-model-dev/references/ingestion-chunk.md` | A-chunk 任务指引加：信息流边提取规则、边界节点识别规则 |
| `w-model-dev/references/ingestion-cross.md` | A-cross/A-evolve 任务指引加：跨块信息流边确认、信息流 `reworkHints` 产出格式 |
| `w-model-dev/references/anti-patterns.md` | 新增 #13「信息流黑洞/奇迹放行」；F1-F10 失败模式补充信息流相关信号 |
| `w-model-dev/scripts/graph-logic.ts` | 新增信息流校验纯函数（黑洞/奇迹/死模块/边界完整性） |
| `w-model-dev/scripts/check-requirement-graph.ts` | 输出 JSON 加 `dataflowViolations` / `boundary` 字段 |
| `w-model-dev/scripts/self-test.ts` | 新增信息流样本测试用例 |
| `w-model-dev/scripts/samples/graph/` | 新增 `bad-blackhole.json` / `bad-miracle.json` / `bad-dead-module.json` / `valid-dataflow.json`；**给现有 `valid-graph.json` 等补信息流边与边界节点**（见 §6） |
| `w-model-dev/SKILL.md` | 「快速自检」加"信息流无黑洞/奇迹/死模块"项 |

## 6. 旧样本向后兼容（方案 A）

现有 `scripts/samples/graph/` 中的 `valid-graph.json` 等 valid 样本**没有 `produces`/`consumes` 边**。信息流校验上线后，这些样本会全部变成"死模块"。

**采用方案 A**：给旧 valid 样本补上信息流边与边界节点，使其继续 valid。理由：

- 设计公理是"不存在无信息流的模块"——那么"合格样本"本就该有信息流，否则样本自身违反公理。
- 设开关（方案 B）等于给公理开后门，且增加校验状态空间。
- 补边工作量可控：每个 valid 样本加 1 个 `EXT-IN` + 1 个 `EXT-OUT` + 每个业务节点至少 1 条 `consumes`（来自 `EXT-IN` 或上游）+ 1 条 `produces`（指向 `EXT-OUT` 或下游）。

补边时遵循：信息流边应真实反映样本图谱的语义（如 `REQ-001` 消费 `EXT-IN`、`SD-001` 消费 `REQ-001` 的产出、`SD-001` 产出到 `EXT-OUT`），不得胡乱连线只为过门禁。

bad 样本（`bad-isolated.json` 等）不补信息流边——它们本就该校验失败，补了反而模糊失败信号。新增的 `bad-blackhole.json` / `bad-miracle.json` / `bad-dead-module.json` 专门触发信息流违反。

## 7. 测试策略

- **单元级**：`self-test.ts` 新增 4 条样本（黑洞/奇迹/死模块各一 bad + 一 valid-dataflow），跑 `npm run self-test` 退出码 0。
- **样本对照**：
  - `bad-blackhole.json` → `dataflowViolations.blackHoles` 非空，`passed=false`；
  - `bad-miracle.json` → `dataflowViolations.miracles` 非空，`passed=false`；
  - `bad-dead-module.json` → `dataflowViolations.deadModules` 非空，`passed=false`；
  - `valid-dataflow.json` → `dataflowViolations` 全空，`passed=true`。
- **回归**：现有 8 条 graph 样本补信息流边后仍 valid（退出码 0）；bad 样本仍按原失败原因失败。
- **门禁集成**：阶段 4 `--phase=4` 样本同时含结构违反与信息流违反时，两者均出现在 `violations` 中。

## 8. 开放问题（实现阶段决定）

1. 信息流边的 `attributes` 是否需要刻画数据内容（如 `{data:"用户凭证", format:"JWT"}`）——v1 先不引入，仅校验拓扑闭合。
2. `EXT-IN`/`EXT-OUT` 是否需要跨阶段复用（阶段 1 的 `EXT-IN-001` 在阶段 2 是否仍是同一源）——v1 按每阶段独立编号，跨阶段关系由 `parent` 树隐含。
3. 信息流边的 BFS 连通性起点选择——与现有结构 BFS 同策略（任一节点起），算法等价。

## 9. 验收标准（本设计文档自身）

- [ ] 三不变量（黑洞/奇迹/死模块）有确定性算法落地，无 LLM 参与
- [ ] 显式边界节点（`EXT-IN`/`EXT-OUT`）正确豁免，不误判 REQ 阶段
- [ ] 信息流校验与现有结构门禁正交，是叠加非替代
- [ ] 跨阶段收敛：阶段 1 严格信息流闭合，阶段 4 信息流零违反硬约束
- [ ] 收敛判定由 G 跑脚本退出码决定，守护反模式 #12
- [ ] 旧 valid 样本补信息流边后继续 valid（方案 A）
- [ ] 新增 4 条样本（3 bad + 1 valid）覆盖三类违反与正常态
- [ ] 与现有铁律（约束 2/4/5/6/8）兼容，不引入 LLM 调用
