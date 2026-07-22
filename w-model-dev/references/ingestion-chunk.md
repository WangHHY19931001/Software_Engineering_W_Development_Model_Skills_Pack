# A-chunk 任务指引（Ingestion Chunk Subagent Guide）

> A-chunk（分析子代理-分块变体）必读。定义节点提取规则、跨块 hint 写法、blocked 返回条件。
> 角色边界见 [subagent-delegation.md](subagent-delegation.md)「A 子代理分派模板」。

## 任务

读取单个 chunk（文件/目录/章节），提取本块内的图谱节点与内部边，产出 `<chunk-id>.md` + `<chunk-id>.json` 到 `.w-model/ingestion/`。

## 节点提取规则

1. 按当前阶段的节点类型提取（阶段1=REQ，阶段2=SD，阶段3=INTF，阶段4=DD）
2. 每个节点必须有 id（`<TYPE>-<NNN>`，本块内编号，最终全局唯一性由 A-cross 合并时去重）、type、phase、title、summary
3. 阶段1：识别功能/非功能/约束需求；非功能需求必须标记 reqType
4. 阶段2-4：从 S 已产出的正式文档提取 SD/INTF/DD 实体

## 边提取规则

1. 仅提取本块内部的边（parent/depends-on/implements/defines/realizes）
2. 跨块关系不要直接写边，而是写入 crossChunkHints

## crossChunkHints 写法

```json
{"target":"<疑似关联的chunk-id>","reason":"<为什么认为有关联>"}
```

A-chunk 独立产出时只能初判跨块关系，最终跨块边由 A-cross 在合并时确认。

### 信息流边与边界节点提取

A-chunk 提取每个实体时，同步识别信息流（与结构边正交）：

- **consumes**：该实体消费了哪些上游信息 → 写 `{from:上游, to:本实体, type:"consumes"}`
- **produces**：该实体产出了哪些下游信息 → 写 `{from:本实体, to:下游, type:"produces"}`
- **边界节点**：识别外部信息源写 `EXT-IN` 节点、外部信息汇写 `EXT-OUT` 节点（DFD terminator）

方向约定：produces/consumes 的 `{from,to}` 一律表信息流方向。目标：让 G 跑 check-requirement-graph.ts 时每个业务节点入流出流均 ≥1、边界各 ≥1（无黑洞/奇迹/死模块）。

## blocked 返回条件

遇到以下情况返回 `{blocked: reason}` 而非强行产出：
- 分块边界切断了实体定义（如一个 REQ 被拆到两个 chunk）
- chunk 内容无法解析（编码错误/格式损坏）
- 缺少必要的上下文（如阶段3提取 INTF 但 S 的接口设计文档未产出）

## 产出 schema

见 [ingestion-graph-convergence-design.md](../../docs/ingestion-graph-convergence-design.md) §2.5。

## 禁止

- 跑 check-requirement-graph.ts（G 负责）
- 写正式阶段产物（requirement-spec.md 等，S 负责）
- 越阶段产出
- 删除前阶段已通过的图谱节点
