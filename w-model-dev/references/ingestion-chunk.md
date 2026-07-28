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

### 阶段1 REQ 节点额外字段（第 20 轮四维识别增强）

每个 REQ 节点须额外提取下列字段（对应 [phase-1-requirements.md](phase-1-requirements.md) 维度1）：

| 字段 | 必填 | 取值 | 说明 |
|---|---|---|---|
| `level` | ✅ 强制必填 | `1` / `2` / `3` / `4` | 层级：1=domain / 2=module / 3=feature / 4=acceptance。**无降级**——无法判定时 blocked 返回，禁止填缺省值 |
| `priority` | ❌ 可选 | `P0` / `P1` / `P2` / `P3` | 优先级；缺省由 S 子代理在产出需求规格时补全 |
| `reqGroup` | level≥2 强制 | 指向 level=1 祖先的 REQ id | REQ-group 归属；level=1 节点的 reqGroup 指向自身 |

### level 字段识别规则

按以下顺序匹配描述特征判定 level（先匹配先返回，不回退降级）：

| 优先级 | 描述特征 | 判定 level |
|---|---|---|
| 1 | 验收标准类描述（含「应该」「须」「≤」「≥」「不大于」「不小于」等可量化措辞） | `4`（acceptance） |
| 2 | 功能点描述（动宾结构，如「导出报告」「发送通知」） | `3`（feature） |
| 3 | 模块描述（含「模块」「子系统」「组件」关键词） | `2`（module） |
| 4 | 领域描述（含「域」「系统」关键词，或顶层业务概念） | `1`（domain） |
| 5 | 无法判断 | **blocked 返回**（`{blocked: "level 无法判定：<原因>"}`），禁止降级为缺省值 |

> level 识别是确定性规则匹配，不是 LLM 估算。匹配失败即 blocked，由 S 子代理或用户澄清后重跑 A-chunk。

## 边提取规则

1. 仅提取本块内部的边（parent/depends-on/implements/defines/realizes）
2. 跨块关系不要直接写边，而是写入 crossChunkHints

### 阶段1 额外边类型（第 20 轮四维识别增强）

阶段1 除现有 `parent`（结构边）外，须同步提取两类边：

- **层级边**（`parent`，REQ→REQ）：子 REQ → 父 REQ，体现 domain→module→feature→acceptance 4 层结构。level≥2 REQ 须有 parent 指向 level-1 祖先链上的直接父节点。
- **交叉逻辑边**（4 类，对应 [phase-1-requirements.md](phase-1-requirements.md) 维度3）：
  - `depends-on`：A 的实现依赖 B 先行提供能力/数据
  - `precedes`：A 须先于 B 交付/上线（时序）
  - `conflicts-with`：A 与 B 互斥/矛盾（一经识别须同步写入 graph.json，触发豁免审批）
  - `cross-cuts`：A 横切影响 B（如 NFR/CON 横切多个 feature）

> 层级边与交叉逻辑边均为本块内部可直接确认的关系；跨块关系仍写入 crossChunkHints 由 A-cross 确认。

## crossChunkHints 写法

```json
{"target":"<疑似关联的chunk-id>","reason":"<为什么认为有关联>"}
```

第 20 轮增强：crossChunkHints 新增 `edgeType` 与 `direction` 字段，便于 A-cross 确认跨块边类型与方向：

```json
{
  "target": "<疑似关联的chunk-id>",
  "reason": "<为什么认为有关联>",
  "edgeType": "parent | depends-on | precedes | conflicts-with | cross-cuts | implements | defines | realizes",
  "direction": "from | to"
}
```

- `edgeType`：初判的跨块边类型（阶段1 含四类交叉逻辑边 + 层级 parent 边）。
- `direction`：`from` 表示本块节点为边源点，`to` 表示本块节点为边终点。

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
