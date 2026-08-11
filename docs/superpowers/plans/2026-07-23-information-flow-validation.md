# 信息流校验增强（黑洞 / 奇迹 / 死模块门禁）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 w-model-dev 图谱门禁中新增与结构门禁正交的信息流校验层，检测黑洞（只进不出）/ 奇迹（只出不进）/ 死模块（无流经），并引入显式边界节点 `EXT-IN` / `EXT-OUT`。

**Architecture:** 复用现有 `graph.json` + `check-requirement-graph.ts` 确定性校验（无 LLM）。在 `graph-logic.ts` 纯函数 `checkRequirementGraph` 中扩展节点/边类型、修正单根计算以豁免边界节点、新增信息流子图统计与边界完整性校验；测试沿用 `self-test.ts` 样本驱动机制（无 jest/vitest）。

**Tech Stack:** TypeScript (ESM) + tsx；无测试框架，用 `npm run self-test` 样本对照驱动。

**依赖设计文档:** [information-flow-validation-design.md](../../information-flow-validation-design.md)（已评审通过）

**所有命令 cwd:** `d:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack`

---

## 关键实现约束（必读）

1. **单根计算必须豁免边界节点**：现有 `checkRequirementGraph` 把所有 `parent` 入边为 0 的节点计入 `roots`（graph-logic.ts:167-169）。`EXT-IN`/`EXT-OUT` 无 `parent` 边，若不豁免会被误判为额外根，破坏单根门禁。Task 2 必须修。
2. **信息流校验只作用于业务节点**（`REQ`/`SD`/`INTF`/`DD`）且 `phase ≤ 当前 phase`；边界节点豁免黑洞/奇迹/死模块判定。
3. **只增不减违反项**：新逻辑向 `result.violations` 追加信息流违反，不改动现有结构违反文案，保证 7 个旧 bad 样本的 `expectedReasonPatterns` 仍匹配。
4. **旧 valid 样本按方案 A 补边**：`valid-graph.json` 补 `EXT-IN`/`EXT-OUT` 与信息流边，否则新逻辑上线后其业务节点全变死模块导致回归失败。旧 bad 样本不补边。

---

## 文件结构

| 文件 | 责任 | 动作 |
|---|---|---|
| `w-model-dev/scripts/graph-logic.ts` | 图谱校验纯逻辑（含新信息流校验） | Modify |
| `w-model-dev/scripts/check-requirement-graph.ts` | CLI 输出（人类可读 + GRAPH_JSON） | Modify |
| `w-model-dev/scripts/self-test.ts` | 样本驱动自检 | Modify |
| `w-model-dev/scripts/samples/graph/valid-graph.json` | 旧 valid 样本（补信息流边） | Modify |
| `w-model-dev/scripts/samples/graph/bad-blackhole.json` | 黑洞样本 | Create |
| `w-model-dev/scripts/samples/graph/bad-miracle.json` | 奇迹样本 | Create |
| `w-model-dev/scripts/samples/graph/bad-dead-module.json` | 死模块样本 | Create |
| `w-model-dev/scripts/samples/graph/valid-dataflow.json` | 信息流完整正样本 | Create |
| `w-model-dev/references/graph-guide.md` | 图谱模型说明（加信息流模型节） | Modify |
| `w-model-dev/references/anti-patterns.md` | 反模式（加 #13） | Modify |
| `w-model-dev/references/ingestion-chunk.md` | A-chunk 信息流边提取规则 | Modify |
| `w-model-dev/references/ingestion-cross.md` | A-cross 信息流边确认规则 | Modify |
| `w-model-dev/SKILL.md` | 快速自检加信息流项 | Modify |
| `docs/skill-design-document_SSoT.md` | SSoT §7.7 / §10.7 | Modify |
| `docs/ingestion-graph-convergence-design.md` | §2.1 / §2.3 / §3.2 / §3.4 | Modify |

---

## Task 1: 新增信息流样本 + 更新 valid-graph + 接线 self-test（RED）

**Files:**
- Create: `w-model-dev/scripts/samples/graph/bad-blackhole.json`
- Create: `w-model-dev/scripts/samples/graph/bad-miracle.json`
- Create: `w-model-dev/scripts/samples/graph/bad-dead-module.json`
- Create: `w-model-dev/scripts/samples/graph/valid-dataflow.json`
- Modify: `w-model-dev/scripts/samples/graph/valid-graph.json`
- Modify: `w-model-dev/scripts/self-test.ts`（`GRAPH_CASES` 数组，约 167-223 行）

- [ ] **Step 1: 创建 bad-blackhole.json**

REQ-001 只进不出（in=1, out=0），唯一违反为黑洞。

```json
{
  "version": 1,
  "project": "sample-blackhole",
  "currentPhase": 1,
  "rootId": "REQ-ROOT",
  "nodes": [
    {"id":"REQ-ROOT","type":"REQ","phase":1,"title":"根需求","summary":"系统根"},
    {"id":"REQ-001","type":"REQ","phase":1,"title":"黑洞需求","summary":"只消费不产出"},
    {"id":"EXT-IN-001","type":"EXT-IN","phase":1,"title":"业务背景","summary":"外部信息源"},
    {"id":"EXT-OUT-001","type":"EXT-OUT","phase":1,"title":"验收输出","summary":"外部信息汇"}
  ],
  "edges": [
    {"from":"REQ-ROOT","to":"REQ-001","type":"parent"},
    {"from":"EXT-IN-001","to":"REQ-ROOT","type":"consumes"},
    {"from":"REQ-ROOT","to":"REQ-001","type":"produces"},
    {"from":"REQ-ROOT","to":"EXT-OUT-001","type":"produces"}
  ]
}
```

说明：REQ-ROOT 入流来自 EXT-IN、出流到 REQ-001 与 EXT-OUT（合规）；REQ-001 入流来自 REQ-ROOT 但无出流 → 黑洞。

- [ ] **Step 2: 创建 bad-miracle.json**

REQ-001 只出不进（in=0, out=1），唯一违反为奇迹。

```json
{
  "version": 1,
  "project": "sample-miracle",
  "currentPhase": 1,
  "rootId": "REQ-ROOT",
  "nodes": [
    {"id":"REQ-ROOT","type":"REQ","phase":1,"title":"根需求","summary":"系统根"},
    {"id":"REQ-001","type":"REQ","phase":1,"title":"奇迹需求","summary":"只产出不消费"},
    {"id":"EXT-IN-001","type":"EXT-IN","phase":1,"title":"业务背景","summary":"外部信息源"},
    {"id":"EXT-OUT-001","type":"EXT-OUT","phase":1,"title":"验收输出","summary":"外部信息汇"}
  ],
  "edges": [
    {"from":"REQ-ROOT","to":"REQ-001","type":"parent"},
    {"from":"EXT-IN-001","to":"REQ-ROOT","type":"consumes"},
    {"from":"REQ-ROOT","to":"EXT-OUT-001","type":"produces"},
    {"from":"REQ-001","to":"EXT-OUT-001","type":"produces"}
  ]
}
```

说明：REQ-ROOT 入 EXT-IN、出 EXT-OUT（合规）；REQ-001 无入流、出流到 EXT-OUT → 奇迹。

- [ ] **Step 3: 创建 bad-dead-module.json**

REQ-001 无信息流经（in=0, out=0），但有 `parent` 边保证结构连通，唯一违反为死模块。

```json
{
  "version": 1,
  "project": "sample-dead-module",
  "currentPhase": 1,
  "rootId": "REQ-ROOT",
  "nodes": [
    {"id":"REQ-ROOT","type":"REQ","phase":1,"title":"根需求","summary":"系统根"},
    {"id":"REQ-001","type":"REQ","phase":1,"title":"死模块需求","summary":"无信息流经"},
    {"id":"EXT-IN-001","type":"EXT-IN","phase":1,"title":"业务背景","summary":"外部信息源"},
    {"id":"EXT-OUT-001","type":"EXT-OUT","phase":1,"title":"验收输出","summary":"外部信息汇"}
  ],
  "edges": [
    {"from":"REQ-ROOT","to":"REQ-001","type":"parent"},
    {"from":"EXT-IN-001","to":"REQ-ROOT","type":"consumes"},
    {"from":"REQ-ROOT","to":"EXT-OUT-001","type":"produces"}
  ]
}
```

说明：REQ-001 仅有 `parent` 结构边（不计信息流），无 produces/consumes → 死模块。

- [ ] **Step 4: 创建 valid-dataflow.json**

phase=4 完整图谱，每个业务节点均有入流与出流，边界完整。

```json
{
  "version": 1,
  "project": "sample-dataflow",
  "currentPhase": 4,
  "rootId": "REQ-ROOT",
  "nodes": [
    {"id":"REQ-ROOT","type":"REQ","phase":1,"title":"根需求","summary":"系统根"},
    {"id":"REQ-001","type":"REQ","phase":1,"title":"用户登录","summary":"登录功能"},
    {"id":"SD-001","type":"SD","phase":2,"title":"认证模块","summary":"认证服务"},
    {"id":"INTF-001","type":"INTF","phase":3,"title":"登录接口","summary":"POST /login"},
    {"id":"DD-001","type":"DD","phase":4,"title":"登录处理","summary":"密码校验逻辑"},
    {"id":"EXT-IN-001","type":"EXT-IN","phase":1,"title":"用户输入","summary":"外部信息源"},
    {"id":"EXT-OUT-001","type":"EXT-OUT","phase":1,"title":"界面展示","summary":"外部信息汇"}
  ],
  "edges": [
    {"from":"REQ-ROOT","to":"REQ-001","type":"parent"},
    {"from":"REQ-001","to":"SD-001","type":"parent"},
    {"from":"SD-001","to":"INTF-001","type":"parent"},
    {"from":"INTF-001","to":"DD-001","type":"parent"},
    {"from":"SD-001","to":"REQ-001","type":"implements"},
    {"from":"SD-001","to":"INTF-001","type":"defines"},
    {"from":"DD-001","to":"INTF-001","type":"realizes"},
    {"from":"EXT-IN-001","to":"REQ-ROOT","type":"consumes"},
    {"from":"REQ-ROOT","to":"REQ-001","type":"produces"},
    {"from":"REQ-001","to":"SD-001","type":"produces"},
    {"from":"SD-001","to":"INTF-001","type":"produces"},
    {"from":"INTF-001","to":"DD-001","type":"produces"},
    {"from":"DD-001","to":"EXT-OUT-001","type":"produces"}
  ]
}
```

- [ ] **Step 5: 更新 valid-graph.json（方案 A 补信息流边）**

将 `w-model-dev/scripts/samples/graph/valid-graph.json` 整体替换为：

```json
{
  "version": 1,
  "project": "sample",
  "currentPhase": 4,
  "rootId": "REQ-ROOT",
  "nodes": [
    {"id":"REQ-ROOT","type":"REQ","phase":1,"title":"根需求","summary":"系统根"},
    {"id":"REQ-001","type":"REQ","phase":1,"title":"用户登录","summary":"登录功能"},
    {"id":"SD-001","type":"SD","phase":2,"title":"认证模块","summary":"认证服务"},
    {"id":"INTF-001","type":"INTF","phase":3,"title":"登录接口","summary":"POST /login"},
    {"id":"DD-001","type":"DD","phase":4,"title":"登录处理","summary":"密码校验逻辑"},
    {"id":"EXT-IN-001","type":"EXT-IN","phase":1,"title":"业务背景/用户输入","summary":"外部信息源"},
    {"id":"EXT-OUT-001","type":"EXT-OUT","phase":1,"title":"验收输出/界面展示","summary":"外部信息汇"}
  ],
  "edges": [
    {"from":"REQ-ROOT","to":"REQ-001","type":"parent"},
    {"from":"REQ-001","to":"SD-001","type":"parent"},
    {"from":"SD-001","to":"INTF-001","type":"parent"},
    {"from":"INTF-001","to":"DD-001","type":"parent"},
    {"from":"SD-001","to":"REQ-001","type":"implements"},
    {"from":"SD-001","to":"INTF-001","type":"defines"},
    {"from":"DD-001","to":"INTF-001","type":"realizes"},
    {"from":"EXT-IN-001","to":"REQ-ROOT","type":"consumes"},
    {"from":"REQ-ROOT","to":"REQ-001","type":"produces"},
    {"from":"REQ-001","to":"SD-001","type":"produces"},
    {"from":"SD-001","to":"INTF-001","type":"produces"},
    {"from":"INTF-001","to":"DD-001","type":"produces"},
    {"from":"DD-001","to":"EXT-OUT-001","type":"produces"}
  ]
}
```

- [ ] **Step 6: 在 self-test.ts 的 GRAPH_CASES 数组末尾追加 4 条用例**

在 `w-model-dev/scripts/self-test.ts` 中 `GRAPH_CASES` 数组最后一项（`bad-dd-no-realizes.json` 用例）之后、数组闭合 `];` 之前插入：

```typescript
  {
    file: 'bad-blackhole.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/黑洞 REQ-001/],
    description: 'REQ-001 只进不出，应被信息流黑洞校验拦截',
  },
  {
    file: 'bad-miracle.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/奇迹 REQ-001/],
    description: 'REQ-001 只出不进，应被信息流奇迹校验拦截',
  },
  {
    file: 'bad-dead-module.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/死模块 REQ-001/],
    description: 'REQ-001 无信息流经，应被死模块校验拦截',
  },
  {
    file: 'valid-dataflow.json',
    phase: 4,
    expectedPassed: true,
    description: 'phase=4 完整图谱含信息流：无黑洞/奇迹/死模块 + 边界完整',
  },
```

- [ ] **Step 7: 运行 self-test 确认 RED**

Run: `npm run self-test`
Expected: 退出码 1。`bad-blackhole/bad-miracle/bad-dead-module` 报「未匹配期望原因模式」（当前逻辑无这些文案）；`valid-dataflow.json` 因 `EXT-IN-001`/`EXT-OUT-001` 无 `parent` 入边被误判为额外根 → `passed=false` 与期望不符。

- [ ] **Step 8: Commit**

```bash
git add w-model-dev/scripts/samples/graph/ w-model-dev/scripts/self-test.ts
git commit -m "test: add information-flow samples (blackhole/miracle/dead-module) and dataflow cases"
```

---

## Task 2: 扩展 graph-logic.ts 类型 + 单根豁免边界 + 信息流校验（GREEN）

**Files:**
- Modify: `w-model-dev/scripts/graph-logic.ts`（类型 15-16、结果接口 51-69、初始化 77-93、单根 159-183、汇总 242-256）

- [ ] **Step 1: 扩展节点/边类型**

在 graph-logic.ts 第 15-16 行，把类型定义改为：

```typescript
export type NodeType = 'REQ' | 'SD' | 'INTF' | 'DD' | 'EXT-IN' | 'EXT-OUT';
export type EdgeType =
  | 'parent'
  | 'depends-on'
  | 'implements'
  | 'defines'
  | 'realizes'
  | 'produces'
  | 'consumes';
```

- [ ] **Step 2: 扩展结果接口**

在 graph-logic.ts 第 51-55 行 `TraceabilityViolations` 接口之后新增两个接口：

```typescript
export interface DataflowViolations {
  blackHoles: string[];
  miracles: string[];
  deadModules: string[];
}

export interface BoundaryInfo {
  extIn: number;
  extOut: number;
  complete: boolean;
}
```

并在 `GraphCheckResult` 接口（第 57-69 行）的 `traceabilityViolations` 字段之后、`violations` 之前新增两个字段：

```typescript
  traceabilityViolations: TraceabilityViolations;
  dataflowViolations: DataflowViolations;
  boundary: BoundaryInfo;
  violations: string[];
```

- [ ] **Step 3: 扩展结果初始化**

在 graph-logic.ts 第 87-92 行 `traceabilityViolations: {...}` 初始化之后，`violations: [],` 之前插入：

```typescript
    traceabilityViolations: {
      SD_without_implements: 0,
      INTF_without_defines: 0,
      DD_without_realizes: 0,
    },
    dataflowViolations: {
      blackHoles: [],
      miracles: [],
      deadModules: [],
    },
    boundary: { extIn: 0, extOut: 0, complete: false },
    violations: [],
```

- [ ] **Step 4: 单根计算豁免边界节点**

问题：第 167-169 行把所有 `parent` 入边为 0 的节点计入 `roots`，`EXT-IN`/`EXT-OUT` 会被误判为额外根。

在 graph-logic.ts 第 159-169 行，将单根统计段落改为构建业务节点集合并跳过边界节点：

原代码：
```typescript
  // 单根检查：统计 parent 入边为 0 的节点
  const parentInCount = new Map<string, number>();
  for (const id of nodeIds) parentInCount.set(id, 0);
  for (const e of g.edges) {
    if (e.type === 'parent') {
      parentInCount.set(e.to, (parentInCount.get(e.to) ?? 0) + 1);
    }
  }
  for (const [id, cnt] of parentInCount) {
    if (cnt === 0) result.roots.push(id);
  }
```

改为：
```typescript
  // 边界节点集合（EXT-IN/EXT-OUT 不参与单根树，仅参与信息流与连通性）
  const nodeTypeById = new Map<string, string>();
  for (const n of g.nodes) nodeTypeById.set(n.id, n.type as string);
  const isBoundary = (id: string): boolean => {
    const t = nodeTypeById.get(id);
    return t === 'EXT-IN' || t === 'EXT-OUT';
  };

  // 单根检查：统计 parent 入边为 0 的节点（豁免边界节点）
  const parentInCount = new Map<string, number>();
  for (const id of nodeIds) parentInCount.set(id, 0);
  for (const e of g.edges) {
    if (e.type === 'parent') {
      parentInCount.set(e.to, (parentInCount.get(e.to) ?? 0) + 1);
    }
  }
  for (const [id, cnt] of parentInCount) {
    if (cnt === 0 && !isBoundary(id)) result.roots.push(id);
  }
```

- [ ] **Step 5: 新增信息流校验段落**

在 graph-logic.ts 阶段追溯检查块（第 230-240 行 `if (phase >= 4) {...}` 块）之后、汇总 `passed` 之前（第 242 行 `// 汇总 passed` 之前）插入信息流校验：

```typescript
  // ============ 信息流校验（黑洞 / 奇迹 / 死模块 + 边界完整性）============
  // 方向统一：produces/consumes 的 {from,to} 均表信息流方向，to=n 即流入 n，from=n 即流出 n
  const flowInCount = new Map<string, number>();
  const flowOutCount = new Map<string, number>();
  for (const id of nodeIds) {
    flowInCount.set(id, 0);
    flowOutCount.set(id, 0);
  }
  for (const e of g.edges) {
    if (e.type === 'produces' || e.type === 'consumes') {
      if (nodeIds.has(e.to)) flowInCount.set(e.to, (flowInCount.get(e.to) ?? 0) + 1);
      if (nodeIds.has(e.from)) flowOutCount.set(e.from, (flowOutCount.get(e.from) ?? 0) + 1);
    }
  }

  const businessTypes = new Set(['REQ', 'SD', 'INTF', 'DD']);
  for (const n of g.nodes) {
    if (!businessTypes.has(n.type as string)) continue;
    if ((n.phase ?? 1) > phase) continue;
    const inFlow = flowInCount.get(n.id) ?? 0;
    const outFlow = flowOutCount.get(n.id) ?? 0;
    if (inFlow === 0 && outFlow === 0) {
      result.dataflowViolations.deadModules.push(n.id);
      result.violations.push(`信息流校验失败：死模块 ${n.id}（无信息流经，in=0 out=0）`);
    } else if (inFlow === 0 && outFlow > 0) {
      result.dataflowViolations.miracles.push(n.id);
      result.violations.push(`信息流校验失败：奇迹 ${n.id}（只出不进，in=0 out=${outFlow}）`);
    } else if (inFlow > 0 && outFlow === 0) {
      result.dataflowViolations.blackHoles.push(n.id);
      result.violations.push(`信息流校验失败：黑洞 ${n.id}（只进不出，in=${inFlow} out=0）`);
    }
  }

  // 边界完整性（阶段 1 起：至少 1 个 EXT-IN 和 1 个 EXT-OUT）
  result.boundary.extIn = g.nodes.filter(n => n.type as string === 'EXT-IN').length;
  result.boundary.extOut = g.nodes.filter(n => n.type as string === 'EXT-OUT').length;
  result.boundary.complete = result.boundary.extIn >= 1 && result.boundary.extOut >= 1;
  if (result.boundary.extIn < 1) {
    result.violations.push('信息流校验失败：缺少 EXT-IN 边界源（系统不能凭空产生信息）');
  }
  if (result.boundary.extOut < 1) {
    result.violations.push('信息流校验失败：缺少 EXT-OUT 边界汇（信息不能进入黑洞消失）');
  }
```

- [ ] **Step 6: 更新 passed 汇总**

在 graph-logic.ts 第 242-256 行汇总块，把 `passed` 计算改为纳入信息流：

原代码：
```typescript
  const tv = result.traceabilityViolations;
  const traceabilityOk =
    tv.SD_without_implements === 0 &&
    tv.INTF_without_defines === 0 &&
    tv.DD_without_realizes === 0;
  result.passed =
    result.connectedComponents === 1 &&
    result.isolatedNodes.length === 0 &&
    result.roots.length === 1 &&
    result.orphans.length === 0 &&
    result.multiParent.length === 0 &&
    traceabilityOk &&
    result.violations.length === 0;
  return result;
```

改为：
```typescript
  const tv = result.traceabilityViolations;
  const traceabilityOk =
    tv.SD_without_implements === 0 &&
    tv.INTF_without_defines === 0 &&
    tv.DD_without_realizes === 0;
  const dv = result.dataflowViolations;
  const dataflowOk =
    dv.blackHoles.length === 0 &&
    dv.miracles.length === 0 &&
    dv.deadModules.length === 0 &&
    result.boundary.complete;
  result.passed =
    result.connectedComponents === 1 &&
    result.isolatedNodes.length === 0 &&
    result.roots.length === 1 &&
    result.orphans.length === 0 &&
    result.multiParent.length === 0 &&
    traceabilityOk &&
    dataflowOk &&
    result.violations.length === 0;
  return result;
```

- [ ] **Step 7: 运行 self-test 确认 GREEN**

Run: `npm run self-test`
Expected: 退出码 0。全部用例通过——新增 4 条信息流用例匹配，旧 valid-graph.json（已补边）与 7 条旧 bad 样本仍按原期望通过。

> 若旧 bad 样本（如 bad-isolated.json）现在因缺 EXT-IN/EXT-OUT 触发额外「边界」违反：它们本就 `expectedPassed=false`，`matchReasonPatterns` 只要求匹配到期望的结构违反模式（如 `/连通性校验失败/`），额外边界违反不影响匹配。确认这些用例仍 `passed`（即结构违反模式仍被匹配到）。

- [ ] **Step 8: Commit**

```bash
git add w-model-dev/scripts/graph-logic.ts
git commit -m "feat: add information-flow validation (blackhole/miracle/dead-module) to graph gate"
```

---

## Task 3: 更新 check-requirement-graph.ts CLI 输出

**Files:**
- Modify: `w-model-dev/scripts/check-requirement-graph.ts`（人类可读段 91-92、GRAPH_JSON 109-123）

- [ ] **Step 1: 人类可读输出加信息流行**

在 check-requirement-graph.ts 第 91 行 `追溯违反` 输出行之后插入两行：

```typescript
  console.log(`追溯违反      : SD_without_implements=${result.traceabilityViolations.SD_without_implements}, INTF_without_defines=${result.traceabilityViolations.INTF_without_defines}, DD_without_realizes=${result.traceabilityViolations.DD_without_realizes}`);
  console.log(`信息流违反    : blackHoles=[${result.dataflowViolations.blackHoles.join(', ')}], miracles=[${result.dataflowViolations.miracles.join(', ')}], deadModules=[${result.dataflowViolations.deadModules.join(', ')}]`);
  console.log(`边界完整性    : EXT-IN=${result.boundary.extIn}, EXT-OUT=${result.boundary.extOut}, complete=${result.boundary.complete}`);
```

- [ ] **Step 2: GRAPH_JSON 摘要加新字段**

在 check-requirement-graph.ts 第 120 行 `traceabilityViolations: result.traceabilityViolations,` 之后插入：

```typescript
    traceabilityViolations: result.traceabilityViolations,
    dataflowViolations: result.dataflowViolations,
    boundary: result.boundary,
    violations: result.violations,
```

- [ ] **Step 3: 手动验证 CLI 输出**

Run: `npm run check:graph -- w-model-dev/scripts/samples/graph/bad-blackhole.json --phase=1`
Expected: 退出码 1；人类可读段出现 `信息流违反 : blackHoles=[REQ-001]`；末尾 `GRAPH_JSON` 含 `"dataflowViolations":{"blackHoles":["REQ-001"]...}`。

Run: `npm run check:graph -- w-model-dev/scripts/samples/graph/valid-dataflow.json --phase=4`
Expected: 退出码 0；`信息流违反 : blackHoles=[], miracles=[], deadModules=[]`；`边界完整性 : EXT-IN=1, EXT-OUT=1, complete=true`。

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/scripts/check-requirement-graph.ts
git commit -m "feat: surface dataflow violations and boundary info in graph checker CLI"
```

---

## Task 4: 更新 graph-guide.md（信息流模型）

**Files:**
- Modify: `w-model-dev/references/graph-guide.md`

- [ ] **Step 1: 节点类型表加边界行**

在 graph-guide.md「节点类型」表（第 8-13 行）`| 4 | DD | ...` 行之后插入：

```markdown
| 1+ | EXT-IN | A-chunk | 合法外部信息源（用户输入/外部 API/业务背景），豁免奇迹判定 |
| 1+ | EXT-OUT | A-chunk | 合法外部信息汇（界面展示/持久化/验收输出），豁免黑洞判定 |
```

- [ ] **Step 2: 边类型表加信息流边**

在 graph-guide.md「边类型」表（第 19-25 行）`| realizes | ...` 行之后插入：

```markdown
| produces | 生产者→消费者/EXT-OUT | 信息流方向：from 产出信息给 to | 信息流层，≥0 |
| consumes | EXT-IN/生产者→消费者 | 信息流方向：to 从 from 消费信息 | 信息流层，≥0 |
```

- [ ] **Step 3: 新增「信息流模型」节**

在 graph-guide.md「阶段递进追溯（门禁同步收敛）」节（第 29 行）之前插入整节：

```markdown
## 信息流模型（黑洞 / 奇迹 / 死模块）

> 公理：任何软件系统都不是黑洞或奇迹，也不存在无信息流经的模块。
> 与结构连通门禁**正交**——结构边（parent/implements/...）管归属追溯，信息流边（produces/consumes）管信息闭合。一个节点可结构追溯完整却仍是信息流黑洞。

三条不变量（仅对业务节点 REQ/SD/INTF/DD，边界节点豁免）：

| 反常 | 定义 | 判定（信息流入度/出度） |
|---|---|---|
| 黑洞 | 只进不出，信息消失 | in>0 ∧ out=0 |
| 奇迹 | 只出不进，信息凭空产生 | in=0 ∧ out>0 |
| 死模块 | 无信息流经 | in=0 ∧ out=0 |

**方向约定**：produces/consumes 的 `{from,to}` 一律表信息流方向，`to=n` 即流入 n，`from=n` 即流出 n。

**边界节点**：EXT-IN（源）/ EXT-OUT（汇）显式化系统边界（DFD terminator），不参与 parent 单根树，参与连通性与信息流。阶段 1 起须各 ≥1。

**跨阶段收敛**：阶段 1 REQ 信息流闭合（严格）；阶段 2/3/4 各自 SD/INTF/DD 无黑洞/奇迹/死模块；阶段 4 信息流零违反 + 结构零违反才放行进编码。
```

- [ ] **Step 2 校验：无脚本，人工核对 Markdown 表格对齐。** Commit：

```bash
git add w-model-dev/references/graph-guide.md
git commit -m "docs: add information-flow model section to graph-guide"
```

---

## Task 5: 更新 anti-patterns.md（新增反模式 #13）

**Files:**
- Modify: `w-model-dev/references/anti-patterns.md`

- [ ] **Step 1: 目录计数更新**

在 anti-patterns.md 第 9 行，将「12 条流程反模式 #1~#12」改为「13 条流程反模式 #1~#13」。

- [ ] **Step 2: 反模式清单加行**

在 anti-patterns.md「反模式清单」表（第 18-31 行）`| 12 | ...` 行之后插入：

```markdown
| 13 | ingestion 图谱信息流黑洞/奇迹/死模块放行 | 存在只进不出/只出不进/无流经的模块，信息闭合失守，结构追溯通过却仍有信息断点带入编码 | 阶段 1-4 必须通过 [`check-requirement-graph.ts`](../scripts/check-requirement-graph.ts) 信息流校验（无黑洞/奇迹/死模块 + 边界完整），退出码 0 才放行（见 [graph-guide.md](graph-guide.md)「信息流模型」节） |
```

- [ ] **Step 3: 命中高发阶段表加行**

在「命中高发阶段」表（第 35-48 行）`| #12（A 自评收敛） | ...` 行之后插入：

```markdown
| #13（信息流黑洞/奇迹放行） | 阶段 1~4 | [graph-guide.md](graph-guide.md)「信息流模型」节 |
```

- [ ] **Step 4: 门禁脚本对应表加行**

在「与门禁脚本的对应关系」表（第 52-64 行）`| #12（A 自评收敛） | ...` 行之后插入：

```markdown
| #13（信息流黑洞/奇迹放行） | [`check-requirement-graph.ts`](../scripts/check-requirement-graph.ts)（`dataflowViolations` 全空 + `boundary.complete=true` 才退出码 0） |
```

- [ ] **Step 5: 检测信号表加行**

在「检测信号与回退命令」表（第 77-90 行）`| #12 | ...` 行之后插入：

```markdown
| #13 | `GRAPH_JSON.dataflowViolations` 存在非空数组（blackHoles/miracles/deadModules）或 `boundary.complete=false` | 回到当前阶段起点，分派 A-chunk 补信息流边（produces/consumes）与边界节点（EXT-IN/EXT-OUT），重跑 A→G 收敛循环 | `check-requirement-graph.ts` 退出码 0 才算信息流闭合 |
```

- [ ] **Step 6: 新增 #13 详解小节**

在 anti-patterns.md「#12 A 子代理自评收敛」小节（第 116-122 行）之后插入：

```markdown
## #13 ingestion 图谱信息流黑洞/奇迹/死模块放行

**检测信号**：`GRAPH_JSON.dataflowViolations` 出现非空数组（blackHoles/miracles/deadModules），或 `boundary.complete=false`。

**回退动作**：回到当前阶段起点，分派 A-chunk 补 produces/consumes 信息流边与 EXT-IN/EXT-OUT 边界节点，重跑 A→G 收敛循环。

**与 #11 的关系**：#11 是「结构连通」失守（孤立/多根/追溯断裂），#13 是「信息闭合」失守（黑洞/奇迹/死模块）——两者正交，一个节点可结构追溯完整却仍是信息流黑洞。二者均由 `check-requirement-graph.ts` 退出码守护。
```

- [ ] **Step 7: Commit**

```bash
git add w-model-dev/references/anti-patterns.md
git commit -m "docs: add anti-pattern #13 information-flow blackhole/miracle bypass"
```

---

## Task 6: 更新 A 子代理指引（ingestion-chunk.md + ingestion-cross.md）

**Files:**
- Modify: `w-model-dev/references/ingestion-chunk.md`
- Modify: `w-model-dev/references/ingestion-cross.md`

- [ ] **Step 1: 先读两文件确认现有结构**

Run: 读 `w-model-dev/references/ingestion-chunk.md` 与 `w-model-dev/references/ingestion-cross.md`，定位「边提取规则」或等价小节的锚点。

- [ ] **Step 2: ingestion-chunk.md 加信息流边提取规则**

在 ingestion-chunk.md 描述 A-chunk 边提取的小节末尾追加：

```markdown
### 信息流边与边界节点提取

A-chunk 提取每个实体时，同步识别信息流（与结构边正交）：

- **consumes**：该实体消费了哪些上游信息 → 写 `{from:上游, to:本实体, type:"consumes"}`
- **produces**：该实体产出了哪些下游信息 → 写 `{from:本实体, to:下游, type:"produces"}`
- **边界节点**：识别外部信息源写 `EXT-IN` 节点、外部信息汇写 `EXT-OUT` 节点（DFD terminator）

方向约定：produces/consumes 的 `{from,to}` 一律表信息流方向。目标：让 G 跑 check-requirement-graph.ts 时每个业务节点入流出流均 ≥1、边界各 ≥1（无黑洞/奇迹/死模块）。
```

- [ ] **Step 3: ingestion-cross.md 加信息流边确认规则**

在 ingestion-cross.md 描述 A-cross/A-evolve 合并的小节末尾追加：

```markdown
### 信息流边跨块确认与 reworkHints

A-cross/A-evolve 合并时：

- 去重跨块重复信息流边（同一条流可能被生产方/消费方各记一次 produces/consumes，合并为一条）。
- 对疑似信息流违反写入 `reworkHints`，格式：`{chunkId, reason:"SD-003 疑似黑洞：消费 REQ-002 但无 produces 出边"}`。
- **收敛判定仍由 G 跑 check-requirement-graph.ts 退出码决定**（守护反模式 #12/#13），A 的 reworkHints 仅作指引，不替代脚本判定。
```

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/references/ingestion-chunk.md w-model-dev/references/ingestion-cross.md
git commit -m "docs: add information-flow edge extraction rules for A sub-agents"
```

---

## Task 7: 更新 SKILL.md 快速自检

**Files:**
- Modify: `w-model-dev/SKILL.md`

- [ ] **Step 1: 定位快速自检节**

Run: `grep -n "快速自检\|自检\|图谱校验" w-model-dev/SKILL.md`（用 Grep 工具）确认锚点。

- [ ] **Step 2: 加信息流自检项**

在 SKILL.md 快速自检/图谱校验相关清单中，紧邻「图谱连通/单根/追溯」项之后追加一项：

```markdown
- [ ] 图谱信息流无黑洞/奇迹/死模块，且边界（EXT-IN/EXT-OUT）完整（`check-requirement-graph.ts` 退出码 0，`GRAPH_JSON.dataflowViolations` 全空）
```

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/SKILL.md
git commit -m "docs: add information-flow self-check item to SKILL.md"
```

---

## Task 8: 更新 SSoT 与 ingestion 设计文档

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`（§7.7 graph.json schema、§10.7 图谱门禁）
- Modify: `docs/ingestion-graph-convergence-design.md`（§2.1 节点类型、§2.3 边类型、§3.2 算法、§3.4 收敛准则）

- [ ] **Step 1: 定位 SSoT 锚点**

Run（Grep 工具）: 在 `docs/skill-design-document_SSoT.md` 搜索 `7.7`、`10.7`、`graph.json`、`图谱门禁`，确认 schema 与门禁小节位置。

- [ ] **Step 2: SSoT §7.7 加信息流边与边界节点**

在 §7.7 graph.json schema 的节点类型枚举与边类型枚举处，补充：
- 节点 `type` 枚举加 `EXT-IN` / `EXT-OUT`；
- 边 `type` 枚举加 `produces` / `consumes`；
- 加一句：「信息流边与边界节点用于黑洞/奇迹/死模块校验，与结构边正交，详见 information-flow-validation-design.md」。

- [ ] **Step 3: SSoT §10.7 加信息流门禁**

在 §10.7 图谱门禁描述处追加：「除连通/单根/父唯一/追溯外，新增信息流校验：业务节点无黑洞（in>0 out=0）/奇迹(in=0 out>0)/死模块(in=0 out=0)，边界 EXT-IN/EXT-OUT 各 ≥1；阶段 4 信息流零违反 + 结构零违反才放行进编码。」

- [ ] **Step 4: 定位 ingestion 设计锚点**

Run（Grep 工具）: 在 `docs/ingestion-graph-convergence-design.md` 搜索 `## 2.1`、`## 2.3`、`## 3.2`、`## 3.4` 或等价标题，确认小节位置。

- [ ] **Step 5: ingestion 设计 §2.1/§2.3 加类型**

- §2.1 节点类型表加 `EXT-IN` / `EXT-OUT` 行；
- §2.3 边类型表加 `produces` / `consumes` 行（方向=信息流方向）。

- [ ] **Step 6: ingestion 设计 §3.2/§3.4 加算法与收敛**

- §3.2 算法描述加信息流校验步骤（构建 produces/consumes 有向子图，统计业务节点 in/out，判黑洞/奇迹/死模块 + 边界完整性）；
- §3.4 收敛准则加信息流项（阶段 1 严格闭合，阶段 4 零违反）。

- [ ] **Step 7: Commit**

```bash
git add docs/skill-design-document_SSoT.md docs/ingestion-graph-convergence-design.md
git commit -m "docs: sync SSoT and ingestion design with information-flow validation"
```

---

## Task 9: 最终回归 + 收尾

- [ ] **Step 1: 全量自检**

Run: `npm run self-test`
Expected: 退出码 0，全部用例（verifier + gate + graph 含新增 4 条）通过。

- [ ] **Step 2: 边界抽查三条 bad 样本退出码**

Run:
```
npm run check:graph -- w-model-dev/scripts/samples/graph/bad-blackhole.json --phase=1
npm run check:graph -- w-model-dev/scripts/samples/graph/bad-miracle.json --phase=1
npm run check:graph -- w-model-dev/scripts/samples/graph/bad-dead-module.json --phase=1
```
Expected: 三条均退出码 1，各自 `dataflowViolations` 对应数组含 `REQ-001`。

- [ ] **Step 3: 确认无未提交改动**

Run: `git status --short`
Expected: 无输出（全部已提交）。

---

## 自检记录（写计划时已完成）

**Spec 覆盖：**
- 设计文档 §1 数据模型 → Task 2 Step 1-3（类型/接口/初始化）
- §2 算法 → Task 2 Step 4-6（单根豁免 + 信息流校验 + passed 汇总）
- §3 A 子代理 → Task 6（ingestion-chunk/cross）
- §4 铁律兼容 → Task 5（反模式 #13）+ Task 2（G 跑退出码判定，守护 #12）
- §5 文档清单 → Task 3/4/5/6/7/8
- §6 旧样本方案 A → Task 1 Step 5
- §7 测试 → Task 1（样本）+ Task 9（回归）

**Placeholder 扫描：** 无 TBD/TODO；Task 6/7/8 的「先读文件定位锚点」是有意为之（文档现有结构需实读确认精确行号），非占位——后续步骤给出了待插入的完整内容。

**Type 一致性：** `DataflowViolations` / `BoundaryInfo` 在 Task 2 定义、Task 3 CLI 引用、Task 5 反模式信号引用，命名一致（`blackHoles`/`miracles`/`deadModules`/`extIn`/`extOut`/`complete`）。

**已知边界 case：** Task 2 Step 7 注释说明旧 bad 样本缺边界会触发额外「边界」违反，但因 `matchReasonPatterns` 只要求匹配结构违反模式，不影响用例通过——已显式提示执行者确认。