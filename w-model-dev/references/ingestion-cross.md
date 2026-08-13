# A-cross/A-evolve 任务指引（Ingestion Cross/Evolve Subagent Guide）

> A-cross（阶段1合并）与 A-evolve（阶段2-4 演进）必读。定义合并建图算法、跨块边确认、reworkHints 产出格式。
> 角色边界见 [subagent-delegation.md](subagent-delegation.md)。

## 任务

读取 `.w-model/ingestion/*.json` 全集（A-evolve 还读现有 graph.json），合并建图，确认跨块边，产出 `consolidated.json` + `cross-analysis-report.md` + `reworkHints[]`。

## A-cross（阶段1）合并算法

1. 收集所有 chunk.json 的 nodes，按 id 去重（同 id 取首个，记录冲突到 report）
2. 收集所有 chunk.json 的 edges（内部边直接采纳）
3. 根据 crossChunkHints 确认跨块边：若两端节点存在且关系合理，写入合并图谱
4. 识别孤立节点、连通分量、根节点、orphan、multiParent
5. 产出 reworkHints：指向具体 chunkId 与原因（孤立节点归属哪个 chunk、缺根、缺跨块边）
6. **REQ 层级树构建**【维度1】：从 level=1 REQ 出发，经 REQ→REQ `parent` 边构建 4 层层级树（domain→module→feature→acceptance）；验证 level 沿 parent 链严格单调递减（子 = 父 + 1）；验证每个 level≥2 REQ 恰好一个 parent（FM-3D-03 multiParent 检测）；验证 REQ-group 非空（每个 level=1 REQ 至少挂一个 level=2 子节点，否则 FM-3D-01 层级缺根）；产出层级树摘要写入 `cross-analysis-report.md` §4
7. **REQ-group 识别**【维度2】：level=1 REQ 即 REQ-group 候选（确定性规则，非 LLM 裁定）；验证每个 level≥2 REQ 的 `reqGroup` 字段指向其 level=1 祖先（指向非 level=1 节点 → FM-3D-04 边界模糊，写入 reworkHints）；产出 REQ-group 候选清单写入 `cross-analysis-report.md` §5
8. **交叉逻辑矩阵汇总**【维度3】：汇总四类交叉边（depends-on / precedes / conflicts-with / cross-cuts）的数量与端点；识别异常项写入 reworkHints（conflicts-with 边无处置记录 → FM-3D-06；depends-on/precedes 形成环 → FM-3D-05；cross-cuts 端点缺失 → FM-4D-04）；产出交叉逻辑矩阵写入 `cross-analysis-report.md` §6（§6.1-§6.4 四类边分表）
9. **迷雾登记册汇总**：读取各 chunk `.md` 叙事文件中的「迷雾项」节，跨块去重；汇总每项疑似 REQ-group 归属（fogGroupHint）与疑似毕业方向（REQ / Out of Scope / 待澄清）供 S 参考，写入 `cross-analysis-report.md` §7。**A-cross 不代 S 决定毕业**（毕业是 S 产出 + R/V 核验职责，见 [phase-1-requirements.md](phase-1-requirements.md)「迷雾登记册（Fog of War）」节）；疑似方向仅作指引，不建图节点。

## A-evolve（阶段2-4）演进算法

1. 读取现有 graph.json（前阶段已通过的图谱）
2. 读取本轮 chunk.json（当前阶段 S 产出的文档分块提取结果）
3. 追加当前阶段节点（SD/INTF/DD），不删除前阶段节点
4. 根据文档内容确认跨阶段边（implements/defines/realizes）
5. 识别违反项，产出 reworkHints

## reworkHints 格式

```json
[{"chunkId":"chunk-003","reason":"REQ-007 孤立，未发现与任何节点的 parent/depends-on 关系"}]
```

### 信息流边跨块确认与 reworkHints

A-cross/A-evolve 合并时：

- 去重跨块重复信息流边（同一条流可能被生产方/消费方各记一次 produces，合并为一条）。
- 对疑似信息流违反写入 `reworkHints`，格式：`{chunkId, reason:"SD-003 疑似黑洞：消费 REQ-002 但无 produces 出边"}`。
- **收敛判定仍由 G 跑 check-requirement-graph.ts 退出码决定**（守护反模式 #12/#13），A 的 reworkHints 仅作指引，不替代脚本判定。

## 关键约束

- **收敛判定不由本子代理决定**：reworkHints 仅作指引，最终收敛由 G 跑 check-requirement-graph.ts 退出码决定
- 合并是幂等的：重跑时全量重读所有 chunk.json，不依赖增量
- 不删除前阶段节点（阶段2-4）

## consolidated.json schema

见 [ingestion-graph-convergence-design.md](../../docs/ingestion-graph-convergence-design.md) §2.6。

## cross-analysis-report.md 模板

> A-cross 产出的 `cross-analysis-report.md` 须含以下章节（§4-§7 对应 A-cross 算法步骤 6/7/8/9）。

```markdown
# 交叉分析报告

## 1. 节点合并摘要
{{去重后节点总数 / 冲突记录 / 孤立节点 / 连通分量 / 根节点}}

## 2. 跨块边确认
{{根据 crossChunkHints 确认的跨块边清单}}

## 3. reworkHints
{{指向具体 chunkId 与原因}}

## 4. REQ 层级树【维度1】
### 4.1 层级树结构
{{从 level=1 REQ 出发构建的 4 层树摘要：domain→module→feature→acceptance}}
### 4.2 level 单调性校验
{{沿 parent 链 level 严格递减校验结果；违反项列入 reworkHints（FM-3D-03）}}
### 4.3 缺根 / orphan 检测
{{level=1 缺根（FM-3D-01）/ orphan（FM-3D-02）检测结果}}

## 5. REQ-group 候选清单【维度2】
| group ID | 对应 level=1 REQ | 包含 module（level=2） | reqGroup 字段校验 |
|---|---|---|---|
| GROUP-001 | REQ-001 | REQ-002, REQ-005 | ✅ 一致 |
{{reqGroup 指向非 level=1 节点 → FM-3D-04，列入 reworkHints}}

## 6. 交叉逻辑矩阵【维度3】
### 6.1 依赖逻辑（depends-on）
| 源 REQ | 目标 REQ | 依赖类型 | 说明 |
### 6.2 时序优先级（precedes）
| 源 REQ | 目标 REQ | 时序约束 | 说明 |
### 6.3 冲突互斥（conflicts-with）
| 源 REQ | 目标 REQ | 冲突类型 | 处置 |
{{每条 conflicts-with 须有处置记录，无处置 → FM-3D-06}}
### 6.4 横切关注点（cross-cuts）
| 源 REQ | 目标 REQ | 横切类型 | 说明 |
{{端点缺失 → FM-4D-04，列入 reworkHints}}
## 7. 迷雾登记册
> 汇总各 chunk 迷雾项（A-chunk 经锐利性测试入册）。A-cross 只产出疑似方向，不代 S 决定毕业。
### 7.1 迷雾项清单
| fogId | fogDesc | fogBlocker | fogGroupHint | 来源 chunk |
|---|---|---|---|---|
| FOG-001 | {{模糊描述}} | {{疑点}} | {{level=1 REQ id 或空}} | chunk-003 |
### 7.2 疑似毕业方向
| fogId | 疑似方向（REQ / Out of Scope / 待澄清） | 依据 |
|---|---|---|
| FOG-001 | {{方向}} | {{依据}} |
{{疑似跨块迷雾关联（crossChunkHints edgeType=fog 确认结果）}}
```

> §4-§7 是阶段1 专用增强（阶段2-4 的 A-evolve 不产出 §4-§7，因 REQ 层级树与迷雾登记册在阶段1 已固化）。

## 阶段快照保留（consolidated-phaseN.json）

> consolidated.json 在阶段演进时须保留各阶段快照，供跨阶段对比与回溯。对应缺陷 D5（历史快照丢失）。

**保留规则**：

- 每个阶段的合并图谱产物保留为独立快照 `consolidated-phaseN.json`（N = 阶段号 1~4）；当前阶段的活态合并图谱仍写入 `consolidated.json`。
- **阶段演进根树保持**：A-evolve 仅追加当前阶段节点（SD/INTF/DD）与跨阶段边，不删除前阶段节点，系统根（REQ-001）不变（只增不减，根不变）。
- `cross-analysis-report.md` 可对比相邻阶段快照 `consolidated-phaseN-1.json` → `consolidated-phaseN.json`，呈现本阶段新增节点 / 新增边 / 信息流闭合变化。
- 快照一旦写入不得修改（append-only 语义）；损坏时从 `consolidated.json` 当前态重建并标注，不得回改历史快照。

**与 graph.json 的关系**：`graph.json` 是 G 子代理校验用的当前态结构图谱；`consolidated-phaseN.json` 是 A 子代理合并产物的阶段历史快照。两者各自独立，`check-requirement-graph.ts` 接受任一作为输入（见 [graph-guide.md](graph-guide.md) 校验脚本节）。

## 禁止

- 跑 check-requirement-graph.ts（G 负责）
- 写正式阶段产物
- 改 project.status
- 删除前阶段已通过的图谱节点
