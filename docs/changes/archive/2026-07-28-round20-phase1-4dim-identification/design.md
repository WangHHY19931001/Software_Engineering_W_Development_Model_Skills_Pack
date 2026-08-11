# 设计文档：阶段 1 需求提取四维识别与豁免审批

> **轮次**：第 20 轮（2026-07-28）
> **版本**：19.0.1 → 20.0.0
> **状态**：设计完成，待用户审查
> **关联 SSoT**：§3.4.16（待新增）

## 1. 设计目标

将阶段 1 需求分析从「扁平 REQ 列表 + 简单层次」升级为「**四维识别模型 + 豁免审批治理**」：

- **维度 1 层级关系**：REQ 内部 4 层（domain→module→feature→acceptance）
- **维度 2 子系统划分**：REQ-group 候选组（level=1 REQ 即 group）
- **维度 3 交叉逻辑**：4 类边矩阵（依赖/横切/冲突/时序）
- **维度 4 覆盖分析**：4 张覆盖矩阵 + 100% 覆盖率
- **豁免审批治理**：强制 S→R→V→人类四阶段流程

## 2. 总体架构

### 2.1 四维识别模型在 ingestion 子流程中的位置

```
阶段 1 ingestion（A→S 路径）增强：

plan-chunks.ts 分块
    ↓
A-chunk 提取 REQ 节点（带 level/priority/reqGroup + 4 类交叉边线索）
    ↓
A-cross 合并建图（REQ 层级树构建 + 4 类边确认 + cross-analysis-report 增 4 维摘要）
    ↓
G 跑 check-requirement-graph.ts --phase=1（新增 R1-R6：层级单根/父唯一/level 单调/REQ-group 非空/依赖无环/时序无环 + conflicts-with 对称 + cross-cuts 源类型校验）
    ↓
G 跑 check-requirement-coverage.ts（新增 C1-C10：4 张矩阵完整性 + 100% 覆盖率 + cross-cuts 一致性）
    ↓
G 跑 check-exemption.ts（若存在豁免：E1-E8 校验 S→R→V→人类四阶段完整性）
    ↓
S-doc 读 graph.json 产出《需求规格说明书》（13 节，§4-§7 为四维识别新增）
    ↓
V 评审（targetKind=doc + checklist 新增三维识别 + 覆盖分析要点）
    ↓
G 跑 check-artifact-gate.ts --phase=1（不变，RTM 字段登记仍走原门禁）
    ↓
CHECKPOINT（展示 9 项 + 豁免审批项，用户放行/返工）
```

### 2.2 与现有结构的关系

- **不向后兼容老图谱**：原有 demo 不回归，历史图谱抛弃。所有 graph.json 修改后重新生成，REQ 节点必须显式标注 `level` 字段（1-4），无降级规则。
- **新增边类型为强制**：`precedes` / `conflicts-with` / `cross-cuts` 三类边必须按四维识别模型识别（无内容时显式声明「无」）。
- **新增节点字段为强制**：`level`（1-4）必填；`reqGroup`（level≥2 REQ 必填）；`priority` 可选。
- **Brownfield 项目**（SSoT §11A.5）：若需迁移历史项目，须在阶段 1 入口一次性补登记 level/group 后重新生成 graph.json，过程产物记入 `acknowledgedDecisions`。

### 2.3 不引入的内容（YAGNI）

- 不引入新节点类型（如 REQ-GROUP、CROSS-CUT）—— level=1 REQ 即 group
- 不引入交叉逻辑的「权重」或「强度」字段
- 不引入自动冲突解决机制
- 不修改 RTM schema
- 不引入新 V 子标准（嵌入现有 5 项）
- 不引入新 CHECKPOINT 暂停点
- 不引入端到端调测（脚本增强非流程变更）
- 不引入老图谱向后兼容机制（历史抛弃，重新生成）

## 3. 图谱 Schema 扩展与校验规则

### 3.1 节点属性扩展

`graph.schema.json` 节点 properties 新增 3 个可选字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `level` | integer 1-4 | REQ 内部层级：1=domain 2=module 3=feature 4=acceptance |
| `priority` | enum P0-P3 | 需求优先级：P0=必须 P1=应该 P2=可以 P3=不会 |
| `reqGroup` | string | 显式声明所属 REQ-group ID（level=1 REQ 自身为 group，无此字段；level=2-4 必填指向 level=1 祖先） |

**字段约束**（graph-logic.ts 业务规则层校验）：
- 仅 REQ 节点有 `level`/`reqGroup` 字段；非 REQ 节点该字段忽略
- `level=1` 的 REQ 即 REQ-group，自身无 `reqGroup`
- `level=2-4` 的 REQ 须有 `reqGroup` 指向某个 level=1 REQ
- `priority` 对所有节点可选

### 3.2 边类型扩展

`graph.schema.json` 边 `type` 枚举新增 3 项：

| 新边类型 | 方向 | 语义 | 阶段 1 用途 |
|---|---|---|---|
| `precedes` | A→B | A 时序先于 B | 阶段 5 编码顺序、阶段 8 验收顺序依据 |
| `conflicts-with` | A→B（单向写入，语义双向） | A 与 B 冲突/互斥 | 冲突对登记，用户决策后须解决或显式标注 |
| `cross-cuts` | NFR/CON→REQ | 该横切关注点治理此 REQ | 横切治理矩阵的图谱表达 |

### 3.3 校验规则扩展（graph-logic.ts 新增 6 类规则）

新增规则全部在 `checkRequirementGraph` 主函数内，phase=1 时全部启用。

#### R1：REQ 子图层级单根

从所有 level=1 的 REQ 出发，仅遍历 REQ→REQ 的 parent 边，应构成单一树。多个 level=1 REQ 且彼此无 parent 关系 → 视为多 group 候选，允许（不 fail），写入 result.reqGroups。REQ→REQ parent 边构成多连通分量且无 level=1 节点 → fail。

#### R2：REQ 层级 parent 唯一

每个 level≥2 的 REQ，其 REQ→REQ parent 入边数必须 = 1。0 条 → orphan；>1 条 → multiParent。

#### R3：REQ 层级 level 单调

对每条 REQ→REQ parent 边 (A→B)：`level(B) = level(A) + 1`。违反 → fail。

#### R4：REQ-group 非空

至少 1 个 level=1 的 REQ。若 0 个 → fail。小项目豁免：REQ 总数 < 5 时允许全部 level=3 且无 level=1，但 cross-analysis-report 须显式声明「单 group」（走豁免审批流程）。

#### R5：依赖与时序无环

对 depends-on 边子图做 DFS 环检测，发现环 → fail。对 precedes 边子图做 DFS 环检测，发现环 → fail。

#### R6：交叉边对称性与源类型

- `conflicts-with` 边 (A→B)：若 (B→A) 不存在 → warning（建议双向登记）。
- `cross-cuts` 边 (A→B)：A 必须是 NFR/CON 行类型（通过 RTM 关联校验），B 必须是 REQ 节点。违反 → fail。
- `precedes` 边 (A→B)：A 和 B 必须都是 REQ 节点。违反 → fail。

### 3.4 RTM 关联校验机制

`check-requirement-graph.ts` 在 phase=1 时新增可选参数 `--rtm=<rtm.json>`：
- 若提供 RTM 路径，则对 `cross-cuts` 边源节点 A 在 RTM.rows 中查找：找到行 `requirementId === A` 且 `type ∈ {NFR, CON}` → 通过；否则 → fail。
- 若不提供 RTM 路径，R6 的 cross-cuts 源类型校验降级为 warning。

### 3.5 GraphCheckResult 扩展

```typescript
/** REQ 层级树信息 */
reqHierarchy: {
  groups: string[];            // level=1 REQ ID 列表
  maxDepth: number;            // 实际最大层级深度（1-4）
  levelDistribution: { [level: number]: number };
  orphanReqs: string[];        // level≥2 但无 parent 的 REQ
  multiParentReqs: string[];
  levelMonotonicViolations: Array<{ from: string; to: string; fromLevel: number; toLevel: number }>;
  missingLevelReqs: string[];  // 缺 level 字段的 REQ（强制 fail）
};

/** 交叉逻辑信息 */
crossLogic: {
  dependsOnCycles: string[][];
  precedesCycles: string[][];
  conflictsAsymmetric: string[];
  crossCutsSourceTypeViolations: string[];
  crossCutsTargetTypeViolations: string[];
};
```

### 3.6 校验脚本 CLI

```bash
npx tsx w-model-dev/scripts/cli/check-requirement-graph.ts <graph.json> \
  [--phase=1|2|3|4] \
  [--rtm=<rtm.json>] \
  [--exemptions=<granted.json>]
```

仅新增可选 `--rtm` 与 `--exemptions` 参数，现有调用方式 100% 兼容。

## 4. 规格书模板增强与 V 评审 Checklist

### 4.1 模板章节结构

`templates/requirement-spec.md` 从现有 5 节扩展为 13 节，§4-§7 为四维识别新增：

| 节 | 标题 | 类型 |
|---|---|---|
| §1 | 问题陈述与背景 | 现有 |
| §2 | 解决方案概述 | 现有 |
| §3 | User Stories | 现有 |
| **§4** | **需求层级树【维度1】** | **新增** |
| **§5** | **候选子系统划分（REQ-group）【维度2】** | **新增** |
| **§6** | **需求交叉逻辑矩阵【维度3】** | **新增** |
| **§7** | **需求覆盖分析【维度4】** | **新增** |
| §8 | Out of Scope | 现有（增强：覆盖缺失声明） |
| §9 | Implementation Decisions | 现有 |
| §10 | Testing Decisions | 现有 |
| §11 | 风险与缓解 | 现有 |
| §12 | RTM 登记 | 现有 |

### 4.2 §4 需求层级树

```markdown
### §4.1 层级树图（mermaid graph TD）
<level 1 domain → level 2 module → level 3 feature → level 4 acceptance>

### §4.2 层级节点表
| REQ ID | level | title | parent | priority | reqGroup |
|---|---|---|---|---|---|

### §4.3 层级规则
- 每个level≥2 REQ须有parent指向level-1 REQ
- level=1 REQ即REQ-group候选（§5详述）
- 小项目豁免：REQ总数<5时可只到level 3，需走豁免审批流程
```

### 4.3 §5 候选子系统划分（REQ-group）

```markdown
### §5.1 REQ-group 清单
| REQ-group ID | group 名 | 职责描述 | 包含 REQ | 阶段2 SD 候选 |
|---|---|---|---|---|

### §5.2 group 划分依据
### §5.3 待阶段2决策事项
```

### 4.4 §6 需求交叉逻辑矩阵

```markdown
### §6.1 依赖逻辑（depends-on）
### §6.2 横切关注点（cross-cuts）
### §6.3 冲突/互斥（conflicts-with）
### §6.4 时序/优先级（precedes）
### §6.5 交叉逻辑总览（若四类矩阵均为空，须显式声明「无交叉逻辑」，禁止省略）
```

### 4.5 §7 需求覆盖分析

```markdown
### §7.1 stakeholder 覆盖矩阵
| stakeholder | 角色 | 关联 REQ | 覆盖状态 | 缺口说明 |
stakeholder 由 A 子代理根据项目上下文识别（不强制类别），
每个识别出的 stakeholder 须至少关联 1 个 REQ。

### §7.2 业务场景/用户旅程覆盖矩阵
| 场景 ID | 场景描述 | 步骤分解 | 关联 REQ | 场景类型 | 覆盖状态 | 缺口说明 |
场景须覆盖以下 3 类（强制）：happy / error / boundary

### §7.3 需求类型覆盖矩阵
| 需求类型 | 已识别 REQ/NFR/CON | 数量 | 覆盖状态 | 缺口说明 |
需求类型须覆盖 REQ/NFR/CON 三类（强制）。
NFR 子类（性能/安全/可用性/可维护性/合规）由 A 按项目识别，不强制类别。

### §7.4 NFR/CON 横切覆盖矩阵
| NFR/CON ID | 治理的 REQ 列表 | 覆盖状态 | 缺口说明 |
§7.4 与 §6.2 cross-cuts 矩阵互补：§6.2 从 NFR/CON→REQ 方向，
§7.4 从 REQ→NFR/CON 方向，双向校验一致性。

### §7.5 覆盖率指标汇总
| 覆盖维度 | 总项数 | 已覆盖 | 部分覆盖 | 缺失 | 覆盖率 |
覆盖率 = (已覆盖 + 0.5×部分覆盖) / 总项数 × 100%
阶段 1 放行阈值：每维度覆盖率 100%
缺失项须在 §8 Out of Scope 显式声明（声明后视为已覆盖，不计入缺失）
```

### 4.6 模板字段规则

**强制项**（V 评审 checklist 校验）：
- §4.2 层级节点表：每个 REQ 必须出现，level 字段必填
- §5.1 REQ-group 清单：至少 1 个 group（小项目豁免除外）
- §6.1-§6.4 四类交叉逻辑矩阵：每类必须出现，无内容时填「无」并加说明
- §7.1-§7.4 四张覆盖矩阵：每张必须出现
- §7.5 覆盖率：每维度 100%

**禁止行为**：
- 禁止省略 §4-§7 任一节（即使内容为「无」也要显式声明）
- 禁止 §6 任一矩阵只写「无」而不加说明
- 禁止 §4.2 层级表与 graph.json 节点不一致

### 4.7 V 评审 Checklist 增强

现有 5 子标准（completeness/clarity/consistency/testability/traceability）**权重不变**，四维识别嵌入既有子标准：

| 子标准 | 权重 | 四维识别新增要点 |
|---|---|---|
| `completeness` (0.30) | 0.30 | + §4 层级树覆盖所有 REQ；§5 REQ-group 覆盖所有 level=1 REQ；§6 四类矩阵无遗漏；§7 四张矩阵完整 + 覆盖率 100% |
| `clarity` (0.25) | 0.25 | + §4.2 层级关系清晰；§5.2 group 划分依据充分；§6 交叉逻辑说明无歧义 |
| `consistency` (0.20) | 0.20 | + §4.2 与 graph.json 一致；§6.3 冲突对均已处理；§6.4 时序无环；§7.4 与 §6.2 双向一致 |
| `testability` (0.15) | 0.15 | + §4 level=4 acceptance 可验证；§6 交叉逻辑可推导测试场景 |
| `traceability` (0.10) | 0.10 | + §5 REQ-group 可映射阶段2 SD；§6 cross-cuts 与 RTM NFR/CON 行交叉一致 |

## 5. Ingestion 子流程与算法步骤增强

### 5.1 算法步骤增强

[phase-1-requirements.md §需求解析算法](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev/references/phase-1-requirements.md) 现有 4 步保留，**步骤 2/3 增强，新增步骤 5/6**：

```
输入: 自然语言需求描述
  1. LLM 意图识别和实体提取（不变）
  2. 构建需求层次结构【维度1 增强】
     【增强】每个 REQ 节点须标注 level（1-4）
          level≥2 REQ 须有 parent 指向 level-1 REQ
          level=1 REQ 即 REQ-group 候选（步骤5详述）
          priority 字段可选标注（P0-P3）
  3. 检测需求冲突和缺失【维度3 部分增强】
     【增强】同步在 graph.json 写入 conflicts-with 边
     【增强】同步识别 depends-on / precedes / cross-cuts 边
  4. 生成验收标准（不变，对应 level=4 REQ 节点）
  5. REQ-group 识别与候选子系统划分【维度2 新增】
     - level=1 REQ 即 REQ-group 候选
     - 验证每个 level≥2 REQ 的 reqGroup 字段指向某个 level=1 REQ
     - 产出 REQ-group 清单
  6. 需求覆盖分析【维度4 新增】
     ├─ 失败: stakeholder 识别后未关联 REQ（FM-4D-01）→ A 补关联或确认不适用
     ├─ 失败: 场景类型缺失（FM-4D-02）→ A 补 happy/error/boundary 场景
     ├─ 失败: 覆盖率 < 100%（FM-4D-03/05）→ 补需求至 covered 或在 §8 声明 Out of Scope
     │        【豁免】status=missing 且 §8 显式声明的项视为 covered
     └─ 成功: 4 张覆盖矩阵完整 + 覆盖率 100% + 缺失项已声明
```

### 5.2 A-chunk 提取规则增强

#### 5.2.1 节点提取规则增强

每个 REQ 节点须额外提取：
- `level`（1-4）：1=domain 2=module 3=feature 4=acceptance（**强制必填**，无降级）
- `priority`（可选，P0-P3）
- `reqGroup`（level=1 REQ 自身为 group，无此字段；level≥2 REQ 须指向 level=1 祖先）

level 字段识别规则（A-chunk 提取时须按以下规则判断，不得省略）：
- 验收标准类描述（含「应该」「须」「≤」「≥」等可量化词）→ level=4
- 功能点描述（动宾结构，如「用户注册」）→ level=3
- 模块描述（含「模块」「子系统」关键词）→ level=2
- 领域描述（含「域」「系统」关键词或为顶层业务概念）→ level=1
- 仍无法判断 → blocked 返回，要求用户重述（禁止默认填 level=3）

#### 5.2.2 边提取规则增强

A-chunk 提取的边类型包括：
- 结构边：parent / depends-on / implements / defines / realizes
- **层级边**：REQ→REQ 的 parent 边（表达 level N→N+1 层级）
- **交叉逻辑边**：
  - `depends-on`：REQ→REQ 功能性依赖（复用现有类型）
  - `precedes`：REQ→REQ 时序关系
  - `conflicts-with`：REQ→REQ 冲突/互斥（单向写入，A-cross 合并时补反向）
  - `cross-cuts`：NFR/CON→REQ 横切治理

#### 5.2.3 crossChunkHints 增强

```json
{
  "target": "<疑似关联的chunk-id>",
  "reason": "<为什么认为有关联>",
  "edgeType": "parent|depends-on|precedes|conflicts-with|cross-cuts",
  "direction": "from-this-to-target|from-target-to-this"
}
```

### 5.3 A-cross 合并算法增强

5 步原算法保留，新增步骤 6-8：

```
6. 【新增】REQ 层级树构建
   - 从所有 level=1 REQ 出发，经 REQ→REQ parent 边构建层级树
   - 验证 level 单调：每条 REQ→REQ parent 边 (A→B) 满足 level(B)=level(A)+1
   - 验证 REQ-group 非空：至少 1 个 level=1 REQ（小项目豁免除外，走豁免审批）
   - 产出层级树摘要到 cross-analysis-report

7. 【新增】REQ-group 识别
   - level=1 REQ 即 REQ-group 候选
   - 验证每个 level≥2 REQ 的 reqGroup 字段指向某个 level=1 REQ
   - 产出 REQ-group 清单到 cross-analysis-report

8. 【新增】交叉逻辑矩阵汇总
   - 汇总四类交叉边到 cross-analysis-report：
     depends-on / precedes / conflicts-with / cross-cuts 矩阵
   - 识别异常项写入 reworkHints
```

### 5.4 cross-analysis-report.md 模板增强

```markdown
# Cross Analysis Report（阶段 N 合并）

## §1 合并摘要（现有）
## §2 跨块边确认（现有）
## §3 信息流分析（现有）
## §4 REQ 层级树【维度1 新增】
## §5 REQ-group 候选清单【维度2 新增】
## §6 交叉逻辑矩阵【维度3 新增】
### §6.1 依赖逻辑（depends-on）
### §6.2 时序逻辑（precedes）
### §6.3 冲突/互斥（conflicts-with）
### §6.4 横切关注点（cross-cuts）
## §7 reworkHints（现有，增强）
```

## 6. 错误处理、返工路径与阶段门 CHECKPOINT

### 6.1 三维识别失败模式

| FM ID | 失败模式 | 触发条件 | 检测方 | 处理路径 |
|---|---|---|---|---|
| FM-3D-01 | REQ level 字段缺失或无法判断 | A-chunk 提取时无法判断 level（强制必填，无降级） | A-chunk 自检（blocked 返回） | 回到步骤 2，要求用户重述或拆解需求 |
| FM-3D-02 | REQ 层级树缺根（0 个 level=1 REQ） | REQ 总数≥5 但无 level=1 REQ | G 跑 R4 规则 | 回到步骤 5，A 重新识别 domain 层；若确无 domain 则走豁免审批 |
| FM-3D-03 | REQ 层级 orphan（level≥2 无 parent） | level≥2 REQ 缺 REQ→REQ parent 入边 | G 跑 R2 规则 | 回到步骤 2，A 补 parent 边或调整 level |
| FM-3D-04 | REQ-group 边界模糊（REQ 同时归多个 group） | 同一 REQ 的 reqGroup 字段在多个 chunk 中冲突 | A-cross 去重时检测 | 标注待澄清，向用户确认归属（禁止 LLM 决定） |
| FM-3D-05 | 依赖/时序环 | depends-on 或 precedes 子图有环 | G 跑 R5 规则 | 回到步骤 3，A 拆解环或修正边方向 |
| FM-3D-06 | conflicts-with 未解决 | §6.3 矩阵状态为「未解决」 | V 评审 + G 提示对称性 | 暂停等用户决策，禁止放行 |

### 6.2 覆盖分析失败模式

| FM ID | 失败模式 | 触发条件 | 检测方 | 处理路径 |
|---|---|---|---|---|
| FM-4D-01 | stakeholder 识别后未关联 REQ | C1：stakeholder 关联 REQ 数=0 | G 跑 C1 | 回到 §7.1，A 补关联或走豁免审批 |
| FM-4D-02 | 场景类型缺失 | C4：缺 happy/error/boundary | G 跑 C4 | 回到 §7.2，A 补场景识别 |
| FM-4D-03 | 覆盖率不达标（< 100%） | C8：某维度 < 100% | G 跑 C8 | 回到 §7 对应矩阵，补需求或在 §8 声明 Out of Scope |
| FM-4D-04 | cross-cuts 与图谱不一致 | C7：§7.4 与 graph.json cross-cuts 边集不一致 | G 跑 C7 | R 定位根因，S-fix 修正 |
| FM-4D-05 | partial 状态未补齐 | C8：存在 partial 项 | G 跑 C8 | 回到 §7 对应矩阵，补齐至 covered 或声明 Out of Scope |

### 6.3 豁免审批失败模式

| FM ID | 失败模式 | 触发条件 | 检测方 | 处理路径 |
|---|---|---|---|---|
| FM-EXEMPT-01 | S 自行决定豁免生效 | exemption-request 未走 R/V/人类审批 | check-exemption E4-E8 | 回到阶段 A，S 重提豁免；命中禁止行为 #11 |
| FM-EXEMPT-02 | R 审查模板化 | rootCauseAnalysis < 30 字符或无 5-Why | check-exemption E6 | 回到阶段 B，R 重新审查 |
| FM-EXEMPT-03 | V 校验未通过即生效 | verification.verified=false 但豁免已应用 | check-exemption E7 | 回到阶段 C，V 重新校验 |
| FM-EXEMPT-04 | 人类未确认即生效 | humanDecision 缺失或 decision≠approve | check-exemption E8 | 暂停 CHECKPOINT，等用户确认 |
| FM-EXEMPT-05 | 豁免掩盖需求遗漏 | R 审查发现豁免理由不成立 | R 审查阶段 | reject 豁免，回到步骤 1 补需求 |

### 6.4 阶段门 CHECKPOINT 增强

CHECKPOINT 展示项从 5 项扩至 9 项 + 豁免审批项：

```
🔴 CHECKPOINT · 阶段门放行（阶段 1）：

【基础五项】
- 需求清单：X 个 REQ（REQ Y + NFR Y + CON Y）
- 冲突与缺失项：Y 项冲突（已解决 Y / 待用户决策 Y）、Z 项缺失
- 验收标准可验证性：Y/X 可量化
- 风险评估：高 Y / 中 Y / 低 Y
- RTM 需求登记：Y/X 已登记

【四维识别四项】
- 需求层级树：最大深度 D，level 分布 {1:Y, 2:Y, 3:Y, 4:Y}，orphan Y / multiParent Y
- REQ-group 候选：Y 个 group
- 交叉逻辑矩阵：依赖 Y / 时序 Y / 冲突 Y（已解决 Y / 待决策 Y）/ 横切 Y
- 需求覆盖分析：stakeholder Y 个、场景 Y 类、类型 Y/3、横切 Y 边；
                覆盖率 {stakeholder:Y%, scenario:Y%, type:Y%, crossCut:Y%}

【豁免审批】（若有）
- 待审批豁免：Y 项（S 已提 / R 审查中 / V 校验中 / 待人类确认）
- 已批准豁免：Y 项（EXEMPT-001~YYY）
- 已拒绝豁免：Y 项（须回到原规则校验补需求）

请用户确认「放行进入阶段 2」或「返工」。
存在以下任一情况 → 一律返工：
  - 未解决的冲突（FM-3D-06）
  - 依赖/时序环（FM-3D-05）
  - 层级缺根且非已批准豁免（FM-3D-02）
  - 层级 orphan 未补 parent（FM-3D-03）
  - REQ-group 边界模糊未用户确认（FM-3D-04）
  - 覆盖率某维度 < 100% 且缺失项未在 §8 声明（FM-4D-03）
  - 存在 partial 项未补齐（FM-4D-05）
  - 存在待审批豁免未走完四阶段流程（FM-EXEMPT-01~04）
  - R 审查发现豁免掩盖需求遗漏（FM-EXEMPT-05）
```

### 6.5 返工路径增强

新增 4 条三维识别 + 1 条覆盖分析 + 5 条豁免审批返工路径：

```
[新增·三维识别]
- REQ level 缺失/无法判断（FM-3D-01）→ 回到步骤 2，A-chunk blocked 返回
- 层级缺根/orphan/multiParent（FM-3D-02/03）→ 回到步骤 2 或 5
- REQ-group 边界模糊（FM-3D-04）→ 暂停等用户确认归属
- 依赖/时序环（FM-3D-05）→ 回到步骤 3，A 拆解环或修正边方向

[新增·覆盖分析]
- 覆盖率 < 100%（FM-4D-03/05）→ 回到 §7 对应矩阵，补需求或 §8 声明 Out of Scope

[新增·豁免审批]
- S 自行决定豁免（FM-EXEMPT-01）→ 回到阶段 A，S 重提豁免
- R 审查模板化（FM-EXEMPT-02）→ 回到阶段 B，R 重新审查
- V 校验未通过即生效（FM-EXEMPT-03）→ 回到阶段 C，V 重新校验
- 人类未确认即生效（FM-EXEMPT-04）→ 暂停 CHECKPOINT，等用户确认
- 豁免掩盖需求遗漏（FM-EXEMPT-05）→ reject 豁免，回到步骤 1 补需求
```

### 6.6 禁止行为增强

| # | 禁止行为 | 正确做法 |
|---|---|---|
| 7 | REQ 节点不标注 level 字段 | 每个 REQ 须标注 level（1-4）；无法判断时 blocked 返回 |
| 8 | LLM 自行决定 REQ-group 归属 | REQ 同时属于多个 group 时须用户确认 |
| 9 | 省略 §4-§7 任一节 | 必须存在，无内容时显式声明「无」并说明理由 |
| 10 | 覆盖缺失项隐式遗漏 | §7 status=missing 须在 §8 显式声明；覆盖率须 100% |
| 11 | 跳过豁免审批流程 | 任何豁免须 S→R→V→人类四阶段，禁止跳步 |

## 7. 豁免审批治理流程（强制 S→R→V→人类）

### 7.1 适用范围

| 豁免类型 | 触发点 | 原规则 | 豁免后 |
|---|---|---|---|
| 小项目层级豁免 | §4.3 REQ 总数<5 无 level=1 | R4 | 允许无 REQ-group，声明「单 group」 |
| stakeholder 不适用 | §7.1 某 stakeholder 角色不适用 | C1 | 声明「不适用」+ 理由 |
| 场景类型不适用 | §7.2 某 happy/error/boundary 不适用 | C4 | 声明「不适用」+ 理由 |
| 覆盖缺失声明 | §7.x status=missing | C8 | §8 Out of Scope 声明后视为 covered |
| NFR 子类不适用 | §7.3 某子类不适用 | V 评审 | 声明「不适用」+ 理由 |

### 7.2 四阶段流程

```
阶段 A：S 提出（Exemption Request）
  ├─ S 子代理识别需豁免项
  ├─ 产出 exemption-request.json 到 .w-model/exemptions/
  └─ 禁止 S 自行决定豁免生效

阶段 B：R 审查分析（Exemption Review）
  ├─ R 子代理按 root-cause-locator.md 方法论审查
  │   - 5-Why：为什么需要豁免？根因是项目特性还是需求遗漏？
  │   - 上游回溯：豁免是否掩盖了需求识别不充分？
  │   - 可证伪性：豁免理由是否可证伪？
  ├─ 产出 exemption-review.json（reviewDecision=approve/reject/need-more-info）
  └─ R 不得直接批准豁免生效，仅产出审查意见

阶段 C：V 校验（Exemption Verification）
  ├─ V 子代理校验 reviewDecision/rootCauseAnalysis/falsifiabilityCheck/conditions
  ├─ 产出 exemption-verification.json（verified=true/false）
  └─ V 校验失败 → 回到阶段 A，S 修正豁免请求

阶段 D：人类确认（Human Confirmation）
  ├─ 编排者将 exemption-request + review + verification 三件套提交 CHECKPOINT
  ├─ 用户「approve」→ 豁免生效，写入 .w-model/exemptions/granted.json
  ├─ 用户「reject」→ 豁免不生效，回到原规则校验
  └─ 禁止编排者代签
```

### 7.3 exemption.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ExemptionShape",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "type", "target", "ruleId", "justification", "evidence", "proposedAlternative", "submittedAt"],
  "properties": {
    "id": { "type": "string", "pattern": "^EXEMPT-\\d{3}$" },
    "type": {
      "enum": [
        "small-project-hierarchy",
        "stakeholder-not-applicable",
        "scenario-type-not-applicable",
        "coverage-missing-declared",
        "nfr-subtype-not-applicable"
      ]
    },
    "target": { "type": "string", "minLength": 1 },
    "ruleId": { "type": "string", "pattern": "^[RC]\\d+$|^C\\d+$" },
    "justification": { "type": "string", "minLength": 20 },
    "evidence": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
    "proposedAlternative": { "type": "string", "minLength": 10 },
    "submittedAt": { "type": "string", "format": "date-time" },
    "review": {
      "type": "object",
      "properties": {
        "reviewDecision": { "enum": ["approve", "reject", "need-more-info"] },
        "rootCauseAnalysis": { "type": "string", "minLength": 30 },
        "falsifiabilityCheck": { "type": "string", "minLength": 10 },
        "riskAssessment": { "type": "string", "minLength": 10 },
        "conditions": { "type": "array", "items": { "type": "string" } },
        "reviewedAt": { "type": "string", "format": "date-time" }
      },
      "required": ["reviewDecision", "rootCauseAnalysis", "falsifiabilityCheck", "riskAssessment", "reviewedAt"]
    },
    "verification": {
      "type": "object",
      "properties": {
        "verified": { "type": "boolean" },
        "reworkHints": { "type": "array", "items": { "type": "string" } },
        "verifiedAt": { "type": "string", "format": "date-time" }
      },
      "required": ["verified", "verifiedAt"]
    },
    "humanDecision": {
      "type": "object",
      "properties": {
        "decision": { "enum": ["approve", "reject"] },
        "decidedAt": { "type": "string", "format": "date-time" },
        "decidedBy": { "type": "string" }
      },
      "required": ["decision", "decidedAt"]
    }
  }
}
```

### 7.4 check-exemption.ts 校验规则（E1-E8）

| 规则 | 校验内容 | 失败行为 |
|---|---|---|
| E1 | schema 完整性 | fail |
| E2 | justification 长度 ≥ 20 字符 | fail |
| E3 | evidence 数组非空 | fail |
| E4 | review 阶段完整 | fail |
| E5 | review.reviewDecision = approve | fail |
| E6 | review.rootCauseAnalysis 长度 ≥ 30 字符 | fail |
| E7 | verification.verified = true | fail |
| E8 | humanDecision.decision = approve | fail |

### 7.5 门禁脚本豁免读取机制

`check-requirement-graph.ts` 与 `check-requirement-coverage.ts` 新增 `--exemptions=<granted.json>` 可选参数。门禁脚本对 `grantedExemptions` 中已批准豁免项：跳过对应规则校验，在 JSON 摘要中标注 `exemptionsApplied`。

### 7.6 反模式 #30

> **反模式 #30：豁免审批跳步**
>
> 任何豁免未按 S→R→V→人类四阶段流程执行。
>
> **典型表现**：S 自行声明豁免 / R 直接批准 / V 跳过 / 编排者代签
>
> **正确做法**：S 提出 → R 审查 → V 校验 → 人类 CHECKPOINT 确认 → check-exemption E1-E8 全通过

## 8. 覆盖分析脚本设计

### 8.1 check-requirement-coverage.ts

**CLI**：
```bash
npx tsx w-model-dev/scripts/cli/check-requirement-coverage.ts <coverage.json> \
  --graph=<graph.json> \
  --out-of-scope=<outOfScope.json> \
  --exemptions=<granted.json>
```

### 8.2 coverage.schema.json

```json
{
  "type": "object",
  "required": ["stakeholders", "scenarios", "requirementTypes", "crossCuts", "metrics"],
  "properties": {
    "stakeholders": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "role", "relatedReqs", "status"],
        "properties": {
          "id": { "type": "string" },
          "role": { "type": "string" },
          "relatedReqs": { "type": "array", "items": { "type": "string" } },
          "status": { "enum": ["covered", "partial", "missing"] },
          "gapDescription": { "type": "string" }
        }
      }
    },
    "scenarios": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "description", "steps", "relatedReqs", "status", "scenarioType"],
        "properties": {
          "id": { "type": "string" },
          "description": { "type": "string" },
          "steps": { "type": "array", "items": { "type": "string" } },
          "relatedReqs": { "type": "array", "items": { "type": "string" } },
          "status": { "enum": ["covered", "partial", "missing"] },
          "scenarioType": { "enum": ["happy", "error", "boundary"] },
          "gapDescription": { "type": "string" }
        }
      }
    },
    "requirementTypes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "reqIds", "status"],
        "properties": {
          "type": { "enum": ["REQ", "NFR", "CON"] },
          "reqIds": { "type": "array", "items": { "type": "string" } },
          "status": { "enum": ["covered", "partial", "missing"] },
          "gapDescription": { "type": "string" }
        }
      }
    },
    "crossCuts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["nfrConId", "governedReqs", "status"],
        "properties": {
          "nfrConId": { "type": "string" },
          "governedReqs": { "type": "array", "items": { "type": "string" } },
          "status": { "enum": ["covered", "partial", "missing"] },
          "gapDescription": { "type": "string" }
        }
      }
    },
    "metrics": {
      "type": "object",
      "required": ["stakeholder", "scenario", "requirementType", "crossCut"],
      "properties": {
        "stakeholder": { "type": "number" },
        "scenario": { "type": "number" },
        "requirementType": { "type": "number" },
        "crossCut": { "type": "number" }
      }
    }
  }
}
```

### 8.3 校验规则（C1-C10）

> **C2/C6 已删除**：原设计 C2（5 类强制 stakeholder 角色）与 C6（5 类强制 NFR 子类）已按用户决策删除——stakeholder 角色与 NFR 子类均由 A 按项目识别，不强制类别。规则编号保留间隙（C2/C6）以避免重编号导致的历史引用断裂。

| 规则 | 校验内容 | 失败行为 |
|---|---|---|
| C1 | stakeholders 数组非空（至少 1 个 stakeholder） | fail |
| C3 | scenarios 数组非空 | fail |
| C4 | scenarios 含 3 类强制场景（happy/error/boundary） | fail，列缺失类型 |
| C5 | requirementTypes 含 REQ/NFR/CON 三类 | fail，列缺失类型 |
| C7 | crossCuts 与 graph.json cross-cuts 边集一致（双向校验） | fail，列不一致项 |
| C8 | metrics 4 项均 = 100% | fail，列不达标项 |
| C9 | status=missing 的项须在 Out of Scope 显式声明 | warning（V 复核）；提供 --out-of-scope 时升级为 fail |
| C10 | metrics 重算一致性 | fail |

**C8 规则细化**（覆盖率 100% 的语义）：
- 覆盖率 = (covered + 0.5×partial) / total × 100%
- 100% 阈值意味着：不允许 partial，不允许 missing
- 唯一豁免：status=missing 且在 §8 Out of Scope 显式声明的项，视为 covered

## 9. 测试策略与样本设计

### 9.1 测试分层

| 层 | 脚本 | 新增内容 |
|---|---|---|
| L1 self-test | `self-test.ts` | 图谱三维识别 13 + 覆盖 10 + 豁免 7 + schema 1 |
| L2 vitest 单元 | `__tests__/graph-logic.test.ts` + `coverage-logic.test.ts` + `exemption-logic.test.ts`（新增） | R1-R6 + C1-C10 + E1-E8 |
| L3 vitest 集成 | `gate-enhancement.test.ts` | 三维识别+覆盖+豁免集成场景 |

### 9.2 图谱样本设计（13 个）

| 样本文件 | 期望 | 触发规则 | 描述 |
|---|---|---|---|
| `valid-req-hierarchy.json` | ✅ | R1/R2/R3/R4 | 4 层 REQ 层级树，单 group 根 |
| `valid-multi-group.json` | ✅ | R1/R4 | 多个 level=1 REQ（多 group 候选） |
| `valid-cross-logic.json` | ✅ | R5/R6 | 含 4 类交叉边，无环 |
| `valid-small-project-exemption.json` | ✅ | R4 豁免 | REQ 总数<5，已批准豁免 |
| `valid-cross-cuts-nfr.json` | ✅ | R6 | cross-cuts 边源为 NFR 行（提供 --rtm） |
| `bad-req-hierarchy-orphan.json` | ❌ | R2 | level=3 REQ 缺 parent 入边 |
| `bad-req-hierarchy-multi-parent.json` | ❌ | R2 | level=2 REQ 有两条 parent 入边 |
| `bad-level-not-monotonic.json` | ❌ | R3 | parent 边 level 不满足 子=父+1 |
| `bad-no-req-group.json` | ❌ | R4 | REQ 总数≥5 但无 level=1 REQ |
| `bad-missing-level.json` | ❌ | R1-R4 | REQ 节点缺 level 字段（强制 fail） |
| `bad-depends-on-cycle.json` | ❌ | R5 | depends-on 子图有环 |
| `bad-precedes-cycle.json` | ❌ | R5 | precedes 子图有环 |
| `bad-cross-logic.json` | ❌ | R6 | 含多场景：conflicts-with 非对称 + cross-cuts 源非 NFR/CON |

### 9.3 覆盖分析样本设计（10 个）

| 样本文件 | 期望 | 触发规则 | 描述 |
|---|---|---|---|
| `valid-full-coverage.json` | ✅ | C1-C10 | 4 张矩阵完整，覆盖率 100% |
| `valid-out-of-scope-declared.json` | ✅ | C9 | status=missing 在 outOfScope.json 声明 |
| `valid-minimal-coverage.json` | ✅ | C1/C3/C5 | 最小合法：1 stakeholder + 3 场景 + 3 类型 |
| `valid-cross-cuts-consistent.json` | ✅ | C7 | §7.4 与 graph.json cross-cuts 一致 |
| `valid-metrics-recalc.json` | ✅ | C10 | metrics 重算与字段一致 |
| `bad-empty-stakeholder.json` | ❌ | C1 | stakeholders 数组空 |
| `bad-missing-scenario-type.json` | ❌ | C4 | 缺 boundary 场景类型 |
| `bad-coverage-below-threshold.json` | ❌ | C8 | stakeholder 覆盖率 50% < 100% |
| `bad-partial-not-resolved.json` | ❌ | C8 | 存在 partial 项未补齐 |
| `bad-cross-cuts-mismatch.json` | ❌ | C7 | §7.4 与 graph.json cross-cuts 不一致 |

### 9.4 豁免审批样本设计（7 个）

| 样本文件 | 期望 | 触发规则 | 描述 |
|---|---|---|---|
| `valid-full-approval.json` | ✅ | E1-E8 | S→R→V→人类四阶段完整 |
| `valid-coverage-exemption.json` | ✅ | E1-E8 | 覆盖缺失声明豁免，人类已批准 |
| `bad-s-self-approve.json` | ❌ | E4 | S 自行决定，无 R/V/人类阶段 |
| `bad-r-template-review.json` | ❌ | E6 | R 审查模板化，rootCauseAnalysis < 30 字符 |
| `bad-v-not-verified.json` | ❌ | E7 | V 校验未通过即生效 |
| `bad-no-human.json` | ❌ | E8 | 人类未确认即生效 |
| `bad-r-reject.json` | ❌ | E5 | R reviewDecision=reject 但已应用 |

### 9.5 self-test 基线扩展

self-test 基线从 121 扩展至 **152**（+31）：

| 类别 | 现有 | 新增 | 合计 |
|---|---|---|---|
| Graph | 17 | +13 | 30 |
| Coverage（新增类别） | 0 | +10 | 10 |
| Exemption（新增类别） | 0 | +7 | 7 |
| Schema | 15 | +1（coverage.schema.json） | 16 |
| 其他 | 89 | 0 | 89 |
| **合计** | **121** | **+31** | **152** |

### 9.6 vitest 基线扩展

vitest 基线从 108 扩展至 **~146**（+38）：

| 测试文件 | 新增用例数 |
|---|---|
| graph-logic.test.ts | +14（R1-R6 + 缺 level 强制 fail + 扩展字段） |
| coverage-logic.test.ts（新增） | +10（C1-C10） |
| exemption-logic.test.ts（新增） | +8（E1-E8） |
| gate-enhancement.test.ts | +5（集成场景） |
| schema-validation.test.ts | +1（coverage.schema.json） |

## 10. SSoT 同步与文档变更清单

### 10.1 SSoT 新增 §3.4.16

```markdown
#### 3.4.16 第 20 轮：阶段 1 需求提取四维识别与豁免审批（2026-07-28）

> 阶段 1 需求分析从「扁平 REQ 列表 + 简单层次」升级为「四维识别模型 + 豁免审批治理」。
> 四维：层级关系 + 子系统划分 + 交叉逻辑 + 覆盖分析。豁免审批强制 S→R→V→人类四阶段流程。

1. **四维识别模型**：层级关系（level/priority/reqGroup + R1-R4）+ 子系统划分（REQ-group）+ 交叉逻辑（precedes/conflicts-with/cross-cuts + R5/R6）+ 覆盖分析（4 张矩阵 + 100% 覆盖率 + C1-C10）
2. **豁免审批治理**（强制 S→R→V→人类）：check-exemption.ts E1-E8 + 反模式 #30 + 禁止行为 #11
3. **图谱 schema 扩展**：节点新增 level/priority/reqGroup；边新增 3 类；不向后兼容（历史抛弃，重新生成）
4. **规格书模板扩展**：5 节 → 13 节（§4-§7 四维识别）
5. **失败模式扩展**：FM-3D-01~06 + FM-4D-01~05 + FM-EXEMPT-01~05，共 16 类
6. **测试基线扩展**：self-test 121→152；vitest 108→~146

**不涉及范围**：不引入新节点类型；不引入新 V 子标准；不引入新 CHECKPOINT 暂停点；不引入端到端调测。
```

### 10.2 文档变更清单（60 文件）

#### 新增文件（37）

| 文件 | 用途 |
|---|---|
| `w-model-dev/schemas/coverage.schema.json` | 覆盖分析 schema |
| `w-model-dev/schemas/exemption.schema.json` | 豁免审批 schema |
| `w-model-dev/scripts/logic/coverage-logic.ts` | C1-C10 纯逻辑层 |
| `w-model-dev/scripts/cli/check-requirement-coverage.ts` | 覆盖分析 CLI |
| `w-model-dev/scripts/logic/exemption-logic.ts` | E1-E8 纯逻辑层 |
| `w-model-dev/scripts/cli/check-exemption.ts` | 豁免审批 CLI |
| `w-model-dev/scripts/__tests__/coverage-logic.test.ts` | C1-C10 单元测试 |
| `w-model-dev/scripts/__tests__/exemption-logic.test.ts` | E1-E8 单元测试 |
| `w-model-dev/scripts/samples/graph/valid-req-hierarchy.json` | 样本 |
| `w-model-dev/scripts/samples/graph/valid-multi-group.json` | 样本 |
| `w-model-dev/scripts/samples/graph/valid-cross-logic.json` | 样本 |
| `w-model-dev/scripts/samples/graph/valid-small-project-exemption.json` | 样本 |
| `w-model-dev/scripts/samples/graph/valid-cross-cuts-nfr.json` | 样本 |
| `w-model-dev/scripts/samples/graph/bad-*.json`（8 个，含 bad-missing-level） | 样本 |
| `w-model-dev/scripts/samples/coverage/`（10 个） | 样本 |
| `w-model-dev/scripts/samples/exemption/`（7 个） | 样本 |

#### 修改文件（23）

| 文件 | 主要变更 |
|---|---|
| `docs/skill-design-document_SSoT.md` | 新增 §3.4.16 + §10A 追溯表 |
| `w-model-dev/schemas/graph.schema.json` | 节点新增 level/priority/reqGroup；边新增 3 类 |
| `w-model-dev/scripts/logic/graph-logic.ts` | 新增 R1-R6 + reqHierarchy/crossLogic + --exemptions 读取 |
| `w-model-dev/scripts/cli/check-requirement-graph.ts` | 新增 --rtm + --exemptions 参数 |
| `w-model-dev/scripts/logic/schema-loader.ts` | 自动加载 coverage/exemption schema |
| `w-model-dev/scripts/cli/self-test.ts` | 新增 GRAPH/COVERAGE/EXEMPTION/SCHEMA 用例 |
| `w-model-dev/scripts/__tests__/graph-logic.test.ts` | 新增 R1-R6 测试组 |
| `w-model-dev/scripts/__tests__/gate-enhancement.test.ts` | 新增集成场景 |
| `w-model-dev/templates/requirement-spec.md` | 5 节 → 13 节 |
| `w-model-dev/references/phase-1-requirements.md` | 算法步骤 2/3 增强 + 新增 5/6 + FM 矩阵 + 禁止行为 #7-#11 |
| `w-model-dev/references/ingestion-chunk.md` | 节点/边提取规则增强 |
| `w-model-dev/references/ingestion-cross.md` | 合并算法新增步骤 6-8 |
| `w-model-dev/references/verifier-spec.md` | §7.1 completeness 增强 |
| `w-model-dev/references/anti-patterns.md` | 新增反模式 #30 |
| `w-model-dev/references/subagent-delegation.md` | S/R/V 角色边界扩展豁免审批职责 |
| `w-model-dev/SKILL.md` | version 20.0.0 + 约束 #15/#16 |
| `w-model-dev/skill-metadata.json` | version 20.0.0 |
| `README.md` | 反模式总数 29→30 + self-test 基线 121→152 |
| `AGENTS.md` | §4 第 20 轮记录 + §8 脚本导航表 |
| `CONTRIBUTING.md` | self-test 基线 121→152 |
| `CHANGELOG.md` | [20.0.0] 节 |
| `package.json` | version 20.0.0 |
| `docs/INSTALL.md` | self-test 基线 121→152 |

### 10.3 版本号三处一致

| 位置 | 现版本 | 新版本 |
|---|---|---|
| `package.json` | 19.0.1 | 20.0.0 |
| `w-model-dev/SKILL.md` frontmatter | 19.0.1 | 20.0.0 |
| `w-model-dev/skill-metadata.json` | 19.0.1 | 20.0.0 |

### 10.4 pre-push 门禁扩展

[.githooks/pre-push](file:///d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.githooks/pre-push) 现有 7 项门禁，扩展至 9 项：

| # | 门禁 | 状态 |
|---|---|---|
| 1-7 | self-test / check:verifier / check:gate / check:graph / check:tla / check:bdd / security-scan | 现有 |
| 8 | **check:coverage** | 新增 |
| 9 | **check:exemption** | 新增 |

## 11. 实施顺序

```
1. SSoT 同步：§3.4.16 + §10A 追溯表
2. schemas/：graph.schema.json 修改 + coverage/exemption.schema.json 新增
3. scripts/ 纯逻辑层：graph-logic.ts 修改 + coverage-logic.ts/exemption-logic.ts 新增
4. scripts/ CLI：check-requirement-graph.ts 修改 + check-requirement-coverage.ts/check-exemption.ts 新增
5. scripts/ schema-loader.ts 修改
6. samples/：graph 12 + coverage 10 + exemption 7
7. scripts/self-test.ts 扩展
8. scripts/__tests__/：graph-logic.test.ts 修改 + coverage-logic.test.ts/exemption-logic.test.ts 新增 + gate-enhancement.test.ts 修改
9. templates/requirement-spec.md 扩展
10. references/：phase-1-requirements.md / ingestion-chunk.md / ingestion-cross.md / verifier-spec.md / anti-patterns.md / subagent-delegation.md
11. SKILL.md + skill-metadata.json
12. 顶层文档：README.md / AGENTS.md / CONTRIBUTING.md / CHANGELOG.md / docs/INSTALL.md / package.json
13. .githooks/pre-push 扩展
14. 回归验证：
    14.1 tsc strict 0 错误
    14.2 npm run self-test 152/152 通过
    14.3 npx vitest run 全通过（~146）
    14.4 npm run prepush 9 项门禁通过
```
