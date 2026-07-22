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

- 去重跨块重复信息流边（同一条流可能被生产方/消费方各记一次 produces/consumes，合并为一条）。
- 对疑似信息流违反写入 `reworkHints`，格式：`{chunkId, reason:"SD-003 疑似黑洞：消费 REQ-002 但无 produces 出边"}`。
- **收敛判定仍由 G 跑 check-requirement-graph.ts 退出码决定**（守护反模式 #12/#13），A 的 reworkHints 仅作指引，不替代脚本判定。

## 关键约束

- **收敛判定不由本子代理决定**：reworkHints 仅作指引，最终收敛由 G 跑 check-requirement-graph.ts 退出码决定
- 合并是幂等的：重跑时全量重读所有 chunk.json，不依赖增量
- 不删除前阶段节点（阶段2-4）

## consolidated.json schema

见 [ingestion-graph-convergence-design.md](../../docs/ingestion-graph-convergence-design.md) §2.6。

## 禁止

- 跑 check-requirement-graph.ts（G 负责）
- 写正式阶段产物
- 改 project.status
- 删除前阶段已通过的图谱节点
