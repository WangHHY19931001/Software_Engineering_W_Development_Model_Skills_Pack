# Ingestion 与跨阶段图谱收敛 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 w-model-dev 技能包新增 A 角色、ingestion 子流程、演进图谱 graph.json 与确定性图谱门禁 check-requirement-graph.ts，支持超大/多目录文档分块并行分析 + 多轮交叉分析 + 阶段1-4 门禁同步收敛。

**Architecture:** 新增 A 角色（分析子代理）在阶段 1-4 活跃，与现有 O/S/V/G 并列；新增 2 个自包含 TS 脚本（plan-chunks.ts 只读分块规划 + check-requirement-graph.ts 图谱门禁）与现有 check-*.ts 同构；新增 graph.json 作为结构层与现有 rtm.json（追溯层）并存；收敛判定由 G 跑脚本退出码驱动，非 LLM 自评。

**Tech Stack:** TypeScript 5（strict）、Node ≥20 标准库、tsx 运行时、无测试框架（self-test.ts 样本驱动）、Markdown 参考文件。

**设计文档：** [docs/ingestion-graph-convergence-design.md](../ingestion-graph-convergence-design.md)

**关键约束（来自 AGENTS.md / SSoT）：**
- 脚本自包含：`scripts/*.ts` 不得 import 任何 `src/` 或外部业务模块，仅依赖本目录内文件与 Node 标准库
- 不引入 LLM 调用：技能包内任何文件都不得直接调用 LLM
- SSoT 优先：修改设计决策先改 SSoT，再同步 w-model-dev/ 资产
- 退出码约定：0=通过 / 1=校验失败 / 2=输入错误

---

## 文件结构总览

### 新增文件

| 路径 | 责任 |
|---|---|
| `w-model-dev/scripts/graph-logic.ts` | 图谱校验纯逻辑（连通性/单根/父唯一/阶段追溯），纯函数无 I/O |
| `w-model-dev/scripts/check-requirement-graph.ts` | CLI 入口，读 JSON → 调 graph-logic → 输出报告 + JSON 摘要 + 退出码 |
| `w-model-dev/scripts/plan-chunks.ts` | CLI 入口，读路径 → 分块规划 → stdout 输出 JSON（不写文件） |
| `w-model-dev/scripts/samples/graph/*.json` | 图谱样本（valid + 4 类 bad） |
| `w-model-dev/references/ingestion-chunk.md` | A-chunk 任务指引 |
| `w-model-dev/references/ingestion-cross.md` | A-cross/A-evolve 任务指引 |
| `w-model-dev/references/graph-guide.md` | 图谱模型说明 |

### 修改文件

| 路径 | 改动性质 |
|---|---|
| `w-model-dev/scripts/self-test.ts` | 追加 GRAPH_CASES + plan-chunks 用例 |
| `w-model-dev/SKILL.md` | 角色表加 A、工作流插入 ingestion、自检加项 |
| `w-model-dev/references/subagent-delegation.md` | 角色表加 A、A 分派模板、回填契约、强制约束 |
| `w-model-dev/references/phase-1-requirements.md` | 插入 ingestion 引用、验收标准加图谱项 |
| `w-model-dev/references/phase-2-system-design.md` | 加 S→A ingestion 节 |
| `w-model-dev/references/phase-3-outline-design.md` | 加 S→A ingestion 节 |
| `w-model-dev/references/phase-4-detailed-design.md` | 加 S→A ingestion 节 + 阶段4硬约束 |
| `w-model-dev/references/workflow.md` | 流程图标注 ingestion、产物清单加 graph.json |
| `w-model-dev/references/anti-patterns.md` | 加 #11/#12 + F 信号补充 |
| `w-model-dev/references/command-reference.md` | /wm analyze 与 /wm design 加 ingestion 字段 |
| `w-model-dev/examples/requirement-analysis.md` | 加超大文档 ingestion 样例片段 |
| `package.json` | 加 check:graph 脚本入口 |
| `docs/skill-design-document_SSoT.md` | §3.4 加 A 角色、§4 加 ingestion 子流程、§7 加 graph.json schema、§10 加图谱门禁 |
| `AGENTS.md` | 关键目录速查加 graph-logic / ingestion 参考 |
| `README.md` | 命令速查加 check:graph |
| `CHANGELOG.md` | 加本次变更条目 |

---

## Task 1: graph-logic.ts 纯逻辑骨架与类型

**Files:**
- Create: `w-model-dev/scripts/graph-logic.ts`

- [ ] **Step 1: 写 graph-logic.ts 类型与骨架**

创建 `w-model-dev/scripts/graph-logic.ts`：

```typescript
/**
 * 图谱校验纯逻辑（Graph Logic）—— 防止 ingestion 图谱结构漂移
 *
 * 对应 w-model-dev/references/graph-guide.md 图谱模型。
 * 校验：连通性（无孤立节点/单连通分量）+ 单根 + 父唯一性 + 阶段递进追溯。
 *
 * 设计原则（与 verifier-logic.ts / gate-logic.ts 一致）：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状，不 import 外部模块
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用
 *   3. 单点事实：所有「图谱是否符合规范」的判定均委托至此
 */

// ==================== 自包含类型形状 ====================

export type NodeType = 'REQ' | 'SD' | 'INTF' | 'DD';
export type EdgeType = 'parent' | 'depends-on' | 'implements' | 'defines' | 'realizes';

export interface GraphNode {
  id: string;
  type: NodeType;
  phase: number;
  title: string;
  summary: string;
  sourceChunk?: string;
  sourceArtifact?: string;
  attributes?: Record<string, unknown>;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: EdgeType;
}

export interface GraphShape {
  version: number;
  project?: string;
  currentPhase: number;
  rootId?: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  analysisRounds?: Array<{
    phase: number;
    round: number;
    timestamp?: string;
    violations: string[];
    converged: boolean;
  }>;
}

export interface TraceabilityViolations {
  SD_without_implements: number;
  INTF_without_defines: number;
  DD_without_realizes: number;
}

export interface GraphCheckResult {
  passed: boolean;
  phase: number;
  totalNodes: number;
  totalEdges: number;
  connectedComponents: number;
  isolatedNodes: string[];
  roots: string[];
  orphans: string[];
  multiParent: string[];
  traceabilityViolations: TraceabilityViolations;
  violations: string[];
}

// ==================== 校验入口 ====================

export function checkRequirementGraph(
  graph: unknown,
  phase: number,
): GraphCheckResult {
  // Step 2-6 逐步填充
  const result: GraphCheckResult = {
    passed: false,
    phase,
    totalNodes: 0,
    totalEdges: 0,
    connectedComponents: 0,
    isolatedNodes: [],
    roots: [],
    orphans: [],
    multiParent: [],
    traceabilityViolations: {
      SD_without_implements: 0,
      INTF_without_defines: 0,
      DD_without_realizes: 0,
    },
    violations: [],
  };
  return result;
}
```

- [ ] **Step 2: 验证文件可被 tsx 解析（无类型错误）**

Run: `npx tsx --eval "import('./w-model-dev/scripts/graph-logic.js').then(m => console.log(Object.keys(m)))"`
Expected: 输出包含 `checkRequirementGraph`, `GraphShape` 等导出键，无 TS 报错。

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/scripts/graph-logic.ts
git commit -m "feat(graph): add graph-logic.ts type skeleton and check entry"
```

---

## Task 2: 连通性校验（BFS + 孤立节点）

**Files:**
- Modify: `w-model-dev/scripts/graph-logic.ts`

- [ ] **Step 1: 实现 checkRequirementGraph 的解析与连通性部分**

替换 `checkRequirementGraph` 函数体为：

```typescript
export function checkRequirementGraph(
  graph: unknown,
  phase: number,
): GraphCheckResult {
  const result: GraphCheckResult = {
    passed: false,
    phase,
    totalNodes: 0,
    totalEdges: 0,
    connectedComponents: 0,
    isolatedNodes: [],
    roots: [],
    orphans: [],
    multiParent: [],
    traceabilityViolations: {
      SD_without_implements: 0,
      INTF_without_defines: 0,
      DD_without_realizes: 0,
    },
    violations: [],
  };

  // 输入校验
  if (!graph || typeof graph !== 'object') {
    result.violations.push('graph 必须为对象');
    return result;
  }
  const g = graph as Partial<GraphShape>;
  if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) {
    result.violations.push('graph.nodes 与 graph.edges 必须为数组');
    return result;
  }
  result.totalNodes = g.nodes.length;
  result.totalEdges = g.edges.length;

  // 构建邻接表（无向，所有边类型参与连通性）
  const nodeIds = new Set(g.nodes.map(n => n.id));
  const adj = new Map<string, Set<string>>();
  for (const id of nodeIds) adj.set(id, new Set());
  for (const e of g.edges) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) {
      result.violations.push(`边引用了不存在的节点: ${e.from} → ${e.to}`);
      continue;
    }
    adj.get(e.from)!.add(e.to);
    adj.get(e.to)!.add(e.from);
  }

  // BFS 连通分量计数
  const visited = new Set<string>();
  let components = 0;
  for (const start of nodeIds) {
    if (visited.has(start)) continue;
    components++;
    const queue = [start];
    visited.add(start);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const next of adj.get(cur) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
  }
  result.connectedComponents = components;

  // 孤立节点 = 度为 0 的节点（无任何边连接）
  for (const id of nodeIds) {
    if ((adj.get(id)?.size ?? 0) === 0 && nodeIds.size > 1) {
      result.isolatedNodes.push(id);
    }
  }

  if (components !== 1) {
    result.violations.push(
      `连通性校验失败：存在 ${components} 个连通分量（应为 1）`,
    );
  }
  if (result.isolatedNodes.length > 0) {
    result.violations.push(
      `孤立节点：${result.isolatedNodes.join(', ')}`,
    );
  }

  // passed 暂不最终判定，留待 Step 6 汇总
  return result;
}
```

- [ ] **Step 2: 写临时验证脚本测试连通性**

Run:
```bash
npx tsx --eval "
import('./w-model-dev/scripts/graph-logic.js').then(({checkRequirementGraph}) => {
  const g = {version:1,currentPhase:1,nodes:[{id:'REQ-001',type:'REQ',phase:1,title:'a',summary:'s'},{id:'REQ-002',type:'REQ',phase:1,title:'b',summary:'s'}],edges:[]};
  const r = checkRequirementGraph(g, 1);
  console.log('components=', r.connectedComponents, 'isolated=', r.isolatedNodes, 'violations=', r.violations);
});
"
```
Expected: `components=2 isolated=['REQ-001','REQ-002'] violations=[两条]`（两个孤立节点构成两个分量）

- [ ] **Step 3: Commit**

```bash
git add w-model-dev/scripts/graph-logic.ts
git commit -m "feat(graph): implement connectivity check (BFS + isolated nodes)"
```

---

## Task 3: 单根与父唯一性校验

**Files:**
- Modify: `w-model-dev/scripts/graph-logic.ts`

- [ ] **Step 1: 在连通性校验后追加单根与父唯一性逻辑**

在 `checkRequirementGraph` 的 `if (result.isolatedNodes.length > 0) {...}` 块之后、`return result` 之前，插入：

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

  // 父唯一性：非根节点的 parent 入边数
  for (const [id, cnt] of parentInCount) {
    if (cnt === 0 && result.roots.length === 1 && id !== result.roots[0]) {
      // 已在 roots 中处理
    } else if (cnt === 0 && result.roots.length !== 1) {
      // 多根或零根场景已在 roots 检查覆盖
    }
    if (cnt > 1) result.multiParent.push(id);
  }
  // orphan = 非根位置但 parent 入边为 0（当 roots 数 ≠ 1 时，所有 roots 中除唯一根外的算 orphan）
  if (result.roots.length !== 1) {
    result.orphans = result.roots.slice();
  }

  if (result.roots.length !== 1) {
    result.violations.push(
      `单根校验失败：存在 ${result.roots.length} 个根节点（应为 1）：${result.roots.join(', ')}`,
    );
  }
  if (result.multiParent.length > 0) {
    result.violations.push(
      `父唯一性校验失败：以下节点有多条 parent 入边：${result.multiParent.join(', ')}`,
    );
  }
```

- [ ] **Step 2: 验证单根通过场景**

Run:
```bash
npx tsx --eval "
import('./w-model-dev/scripts/graph-logic.js').then(({checkRequirementGraph}) => {
  const g = {version:1,currentPhase:1,nodes:[{id:'REQ-ROOT',type:'REQ',phase:1,title:'root',summary:'s'},{id:'REQ-001',type:'REQ',phase:1,title:'a',summary:'s'}],edges:[{from:'REQ-ROOT',to:'REQ-001',type:'parent'}]};
  const r = checkRequirementGraph(g, 1);
  console.log('roots=', r.roots, 'multiParent=', r.multiParent, 'orphans=', r.orphans);
});
"
```
Expected: `roots=['REQ-ROOT'] multiParent=[] orphans=[]`

- [ ] **Step 3: 验证多根失败场景**

Run:
```bash
npx tsx --eval "
import('./w-model-dev/scripts/graph-logic.js').then(({checkRequirementGraph}) => {
  const g = {version:1,currentPhase:1,nodes:[{id:'REQ-001',type:'REQ',phase:1,title:'a',summary:'s'},{id:'REQ-002',type:'REQ',phase:1,title:'b',summary:'s'}],edges:[{from:'REQ-001',to:'REQ-002',type:'depends-on'}]};
  const r = checkRequirementGraph(g, 1);
  console.log('roots=', r.roots, 'orphans=', r.orphans, 'violations含单根=', r.violations.some(v=>v.includes('单根')));
});
"
```
Expected: `roots=['REQ-001','REQ-002'] orphans=['REQ-001','REQ-002'] violations含单根=true`（depends-on 不构成 parent，两个节点都是根）

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/scripts/graph-logic.ts
git commit -m "feat(graph): implement single-root and parent-uniqueness checks"
```

---

## Task 4: 阶段递进追溯校验

**Files:**
- Modify: `w-model-dev/scripts/graph-logic.ts`

- [ ] **Step 1: 在父唯一性校验后追加阶段追溯逻辑**

在 `if (result.multiParent.length > 0) {...}` 块之后、`return result` 之前，插入：

```typescript
  // 阶段递进追溯检查（"门禁同步收敛"的核心）
  const outEdges = new Map<string, GraphEdge[]>();
  const inEdges = new Map<string, GraphEdge[]>();
  for (const id of nodeIds) {
    outEdges.set(id, []);
    inEdges.set(id, []);
  }
  for (const e of g.edges) {
    outEdges.get(e.from)?.push(e);
    inEdges.get(e.to)?.push(e);
  }

  if (phase >= 2) {
    for (const n of g.nodes) {
      if (n.type === 'SD') {
        const has = outEdges.get(n.id)?.some(e => e.type === 'implements') ?? false;
        if (!has) {
          result.traceabilityViolations.SD_without_implements++;
          result.violations.push(`追溯校验失败：SD 节点 ${n.id} 缺少 implements 出边`);
        }
      }
    }
  }
  if (phase >= 3) {
    for (const n of g.nodes) {
      if (n.type === 'INTF') {
        const has = inEdges.get(n.id)?.some(e => e.type === 'defines') ?? false;
        if (!has) {
          result.traceabilityViolations.INTF_without_defines++;
          result.violations.push(`追溯校验失败：INTF 节点 ${n.id} 缺少 defines 入边`);
        }
      }
    }
  }
  if (phase >= 4) {
    for (const n of g.nodes) {
      if (n.type === 'DD') {
        const has = outEdges.get(n.id)?.some(e => e.type === 'realizes') ?? false;
        if (!has) {
          result.traceabilityViolations.DD_without_realizes++;
          result.violations.push(`追溯校验失败：DD 节点 ${n.id} 缺少 realizes 出边`);
        }
      }
    }
  }
```

- [ ] **Step 2: 在函数末尾 return 前追加 passed 汇总**

替换 `return result;`（函数末尾）为：

```typescript
  // 汇总 passed
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

- [ ] **Step 3: 验证 phase=2 SD 缺 implements 失败**

Run:
```bash
npx tsx --eval "
import('./w-model-dev/scripts/graph-logic.js').then(({checkRequirementGraph}) => {
  const g = {version:1,currentPhase:2,nodes:[{id:'REQ-ROOT',type:'REQ',phase:1,title:'r',summary:'s'},{id:'SD-001',type:'SD',phase:2,title:'sd',summary:'s'}],edges:[{from:'REQ-ROOT',to:'SD-001',type:'parent'}]};
  const r = checkRequirementGraph(g, 2);
  console.log('passed=', r.passed, 'SD_without_implements=', r.traceabilityViolations.SD_without_implements);
});
"
```
Expected: `passed=false SD_without_implements=1`

- [ ] **Step 4: 验证全通过场景**

Run:
```bash
npx tsx --eval "
import('./w-model-dev/scripts/graph-logic.js').then(({checkRequirementGraph}) => {
  const g = {version:1,currentPhase:2,nodes:[{id:'REQ-ROOT',type:'REQ',phase:1,title:'r',summary:'s'},{id:'SD-001',type:'SD',phase:2,title:'sd',summary:'s'}],edges:[{from:'REQ-ROOT',to:'SD-001',type:'parent'},{from:'SD-001',to:'REQ-ROOT',type:'implements'}]};
  const r = checkRequirementGraph(g, 2);
  console.log('passed=', r.passed, 'violations=', r.violations);
});
"
```
Expected: `passed=true violations=[]`

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/scripts/graph-logic.ts
git commit -m "feat(graph): implement phase-progressive traceability checks and passed summary"
```

---

## Task 5: 图谱样本文件

**Files:**
- Create: `w-model-dev/scripts/samples/graph/valid-graph.json`
- Create: `w-model-dev/scripts/samples/graph/bad-isolated.json`
- Create: `w-model-dev/scripts/samples/graph/bad-multi-root.json`
- Create: `w-model-dev/scripts/samples/graph/bad-orphan.json`
- Create: `w-model-dev/scripts/samples/graph/bad-multi-parent.json`
- Create: `w-model-dev/scripts/samples/graph/bad-sd-no-implements.json`
- Create: `w-model-dev/scripts/samples/graph/bad-intf-no-defines.json`
- Create: `w-model-dev/scripts/samples/graph/bad-dd-no-realizes.json`

- [ ] **Step 1: 创建 valid-graph.json（phase=4 全通过）**

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
    {"id":"DD-001","type":"DD","phase":4,"title":"登录处理","summary":"密码校验逻辑"}
  ],
  "edges": [
    {"from":"REQ-ROOT","to":"REQ-001","type":"parent"},
    {"from":"REQ-001","to":"SD-001","type":"parent"},
    {"from":"SD-001","to":"INTF-001","type":"parent"},
    {"from":"INTF-001","to":"DD-001","type":"parent"},
    {"from":"SD-001","to":"REQ-001","type":"implements"},
    {"from":"SD-001","to":"INTF-001","type":"defines"},
    {"from":"DD-001","to":"INTF-001","type":"realizes"}
  ]
}
```

- [ ] **Step 2: 创建 bad-isolated.json（孤立节点）**

```json
{
  "version": 1,
  "currentPhase": 1,
  "rootId": null,
  "nodes": [
    {"id":"REQ-ROOT","type":"REQ","phase":1,"title":"根","summary":"s"},
    {"id":"REQ-001","type":"REQ","phase":1,"title":"登录","summary":"s"},
    {"id":"REQ-002","type":"REQ","phase":1,"title":"孤立","summary":"无连接"}
  ],
  "edges": [
    {"from":"REQ-ROOT","to":"REQ-001","type":"parent"}
  ]
}
```

- [ ] **Step 3: 创建 bad-multi-root.json（多根）**

```json
{
  "version": 1,
  "currentPhase": 1,
  "rootId": null,
  "nodes": [
    {"id":"REQ-001","type":"REQ","phase":1,"title":"根A","summary":"s"},
    {"id":"REQ-002","type":"REQ","phase":1,"title":"根B","summary":"s"}
  ],
  "edges": [
    {"from":"REQ-001","to":"REQ-002","type":"depends-on"}
  ]
}
```

- [ ] **Step 4: 创建 bad-orphan.json（无 parent 入边的非根位置节点，单节点无边）**

```json
{
  "version": 1,
  "currentPhase": 1,
  "rootId": null,
  "nodes": [
    {"id":"REQ-001","type":"REQ","phase":1,"title":"唯一","summary":"单节点无边，既是根也是孤立"}
  ],
  "edges": []
}
```

> 注：单节点无边时 roots.length=1 但 connectedComponents=1 且 isolatedNodes=[]（因 nodeIds.size=1 不触发孤立判定），实际会 passed=true。此样本用于验证"单节点平凡通过"——调整描述为 valid 单节点场景，或改为真正的 orphan（多节点但某节点无 parent 入边且非唯一根）。

修正 bad-orphan.json 为真正的多节点 orphan 场景：

```json
{
  "version": 1,
  "currentPhase": 1,
  "rootId": null,
  "nodes": [
    {"id":"REQ-ROOT","type":"REQ","phase":1,"title":"根","summary":"s"},
    {"id":"REQ-001","type":"REQ","phase":1,"title":"登录","summary":"s"},
    {"id":"REQ-002","type":"REQ","phase":1,"title":"孤立orphan","summary":"有 depends-on 但无 parent"}
  ],
  "edges": [
    {"from":"REQ-ROOT","to":"REQ-001","type":"parent"},
    {"from":"REQ-002","to":"REQ-001","type":"depends-on"}
  ]
}
```

- [ ] **Step 5: 创建 bad-multi-parent.json（多 parent 入边）**

```json
{
  "version": 1,
  "currentPhase": 1,
  "rootId": "REQ-ROOT",
  "nodes": [
    {"id":"REQ-ROOT","type":"REQ","phase":1,"title":"根","summary":"s"},
    {"id":"REQ-A","type":"REQ","phase":1,"title":"A","summary":"s"},
    {"id":"REQ-B","type":"REQ","phase":1,"title":"B","summary":"s"},
    {"id":"REQ-C","type":"REQ","phase":1,"title":"C有两个parent","summary":"s"}
  ],
  "edges": [
    {"from":"REQ-ROOT","to":"REQ-A","type":"parent"},
    {"from":"REQ-ROOT","to":"REQ-B","type":"parent"},
    {"from":"REQ-A","to":"REQ-C","type":"parent"},
    {"from":"REQ-B","to":"REQ-C","type":"parent"}
  ]
}
```

- [ ] **Step 6: 创建 bad-sd-no-implements.json（phase=2, SD 缺 implements）**

```json
{
  "version": 1,
  "currentPhase": 2,
  "rootId": "REQ-ROOT",
  "nodes": [
    {"id":"REQ-ROOT","type":"REQ","phase":1,"title":"根","summary":"s"},
    {"id":"SD-001","type":"SD","phase":2,"title":"模块","summary":"缺implements"}
  ],
  "edges": [
    {"from":"REQ-ROOT","to":"SD-001","type":"parent"}
  ]
}
```

- [ ] **Step 7: 创建 bad-intf-no-defines.json（phase=3, INTF 缺 defines）**

```json
{
  "version": 1,
  "currentPhase": 3,
  "rootId": "REQ-ROOT",
  "nodes": [
    {"id":"REQ-ROOT","type":"REQ","phase":1,"title":"根","summary":"s"},
    {"id":"SD-001","type":"SD","phase":2,"title":"模块","summary":"s"},
    {"id":"INTF-001","type":"INTF","phase":3,"title":"接口","summary":"缺defines"}
  ],
  "edges": [
    {"from":"REQ-ROOT","to":"SD-001","type":"parent"},
    {"from":"SD-001","to":"INTF-001","type":"parent"},
    {"from":"SD-001","to":"REQ-ROOT","type":"implements"}
  ]
}
```

- [ ] **Step 8: 创建 bad-dd-no-realizes.json（phase=4, DD 缺 realizes）**

```json
{
  "version": 1,
  "currentPhase": 4,
  "rootId": "REQ-ROOT",
  "nodes": [
    {"id":"REQ-ROOT","type":"REQ","phase":1,"title":"根","summary":"s"},
    {"id":"SD-001","type":"SD","phase":2,"title":"模块","summary":"s"},
    {"id":"INTF-001","type":"INTF","phase":3,"title":"接口","summary":"s"},
    {"id":"DD-001","type":"DD","phase":4,"title":"详细","summary":"缺realizes"}
  ],
  "edges": [
    {"from":"REQ-ROOT","to":"SD-001","type":"parent"},
    {"from":"SD-001","to":"INTF-001","type":"parent"},
    {"from":"INTF-001","to":"DD-001","type":"parent"},
    {"from":"SD-001","to":"REQ-ROOT","type":"implements"},
    {"from":"SD-001","to":"INTF-001","type":"defines"}
  ]
}
```

- [ ] **Step 9: Commit**

```bash
git add w-model-dev/scripts/samples/graph/
git commit -m "test(graph): add 8 graph samples (1 valid + 7 bad)"
```

---

## Task 6: check-requirement-graph.ts CLI 入口

**Files:**
- Create: `w-model-dev/scripts/check-requirement-graph.ts`

- [ ] **Step 1: 写 check-requirement-graph.ts**

```typescript
#!/usr/bin/env tsx
/**
 * 图谱校验脚本（Requirement Graph Checker）
 *
 * 对应 w-model-dev/references/graph-guide.md 图谱模型。
 * 供 G 子代理在 ingestion 收敛循环中调用，校验 graph.json / consolidated.json 的
 * 连通性、单根、父唯一性与阶段递进追溯。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/check-requirement-graph.ts <graph.json> [--phase=1|2|3|4]
 *
 * 参数：
 *   graph.json   graph.json 或 consolidated.json 文件路径
 *   --phase      校验阶段（1-4），控制追溯项数量，默认从 graph.currentPhase 读取
 *
 * 退出码：
 *   0  校验通过（连通 + 单根 + 父唯一 + 阶段追溯完整）
 *   1  校验失败（reasons 列出具体原因，A 子代理按原因补漏）
 *   2  输入错误（文件不存在 / 非法 JSON）
 *
 * 输出：
 *   stdout 打印结构化校验报告（人类可读 + 末尾 JSON 摘要，便于 Agent 解析）
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  checkRequirementGraph,
  type GraphShape,
} from './graph-logic.js';

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error('用法: npx tsx w-model-dev/scripts/check-requirement-graph.ts <graph.json> [--phase=1|2|3|4]');
    process.exit(2);
  }

  // 解析 --phase
  let phase: number | undefined;
  const phaseArg = process.argv.slice(3).find(a => a.startsWith('--phase='));
  if (phaseArg) {
    phase = Number.parseInt(phaseArg.split('=')[1], 10);
    if (![1, 2, 3, 4].includes(phase)) {
      console.error(`✗ --phase 必须为 1-4，实际: ${phase}`);
      process.exit(2);
    }
  }

  const abs = path.resolve(file);
  let raw: string;
  try {
    raw = await fs.readFile(abs, 'utf-8');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      console.error(`✗ 文件不存在: ${abs}`);
      process.exit(2);
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`✗ 文件解析失败（非合法 JSON）: ${abs}`);
    process.exit(2);
  }

  const effectivePhase = phase ?? (parsed as GraphShape)?.currentPhase ?? 1;
  if (!phase && ![1, 2, 3, 4].includes(effectivePhase)) {
    console.error(`✗ 无法确定 phase：未传 --phase 且 graph.currentPhase=${effectivePhase} 无效`);
    process.exit(2);
  }

  const result = checkRequirementGraph(parsed, effectivePhase);

  console.log('═'.repeat(60));
  console.log('图谱校验（Requirement Graph Checker）');
  console.log('═'.repeat(60));
  console.log(`输入文件      : ${abs}`);
  console.log(`校验阶段      : ${result.phase}`);
  console.log(`节点总数      : ${result.totalNodes}`);
  console.log(`边总数        : ${result.totalEdges}`);
  console.log(`连通分量      : ${result.connectedComponents}`);
  console.log(`孤立节点      : ${result.isolatedNodes.length === 0 ? '无' : result.isolatedNodes.join(', ')}`);
  console.log(`根节点        : ${result.roots.length === 0 ? '无' : result.roots.join(', ')}`);
  console.log(`orphan        : ${result.orphans.length === 0 ? '无' : result.orphans.join(', ')}`);
  console.log(`multiParent   : ${result.multiParent.length === 0 ? '无' : result.multiParent.join(', ')}`);
  console.log(`追溯违反      : SD_without_implements=${result.traceabilityViolations.SD_without_implements}, INTF_without_defines=${result.traceabilityViolations.INTF_without_defines}, DD_without_realizes=${result.traceabilityViolations.DD_without_realizes}`);
  console.log(`校验结果      : ${result.passed ? '✓ 通过' : '✗ 未通过'}`);
  console.log('─'.repeat(60));

  if (result.passed) {
    console.log('图谱结构符合 graph-guide.md：连通 + 单根 + 父唯一 + 阶段追溯完整。');
  } else {
    console.log('未通过原因：');
    for (const r of result.violations) {
      console.log(`  - ${r}`);
    }
    console.log('');
    console.log('A 子代理须按上述原因补漏（reworkHints 指向具体 chunkId），详见：');
    console.log('  w-model-dev/references/ingestion-cross.md');
  }

  // 末尾 JSON 摘要（供 Agent 解析；行首标记便于正则截取）
  console.log('─'.repeat(60));
  console.log('GRAPH_JSON ' + JSON.stringify({
    type: 'requirement-graph',
    passed: result.passed,
    phase: result.phase,
    totalNodes: result.totalNodes,
    totalEdges: result.totalEdges,
    connectedComponents: result.connectedComponents,
    isolatedNodes: result.isolatedNodes,
    roots: result.roots,
    orphans: result.orphans,
    multiParent: result.multiParent,
    traceabilityViolations: result.traceabilityViolations,
    violations: result.violations,
    converged: result.passed,
  }));

  process.exit(result.passed ? 0 : 1);
}

main().catch((err) => {
  console.error('图谱校验脚本异常:', err);
  process.exit(2);
});
```

- [ ] **Step 2: 验证 valid-graph.json 通过**

Run: `npx tsx w-model-dev/scripts/check-requirement-graph.ts w-model-dev/scripts/samples/graph/valid-graph.json --phase=4`
Expected: 退出码 0，末尾 `GRAPH_JSON {...,"passed":true,"converged":true}`

- [ ] **Step 3: 验证 bad-sd-no-implements.json 失败**

Run: `npx tsx w-model-dev/scripts/check-requirement-graph.ts w-model-dev/scripts/samples/graph/bad-sd-no-implements.json --phase=2`
Expected: 退出码 1，输出含 `SD 节点 SD-001 缺少 implements 出边`

- [ ] **Step 4: 验证文件不存在退出码 2**

Run: `npx tsx w-model-dev/scripts/check-requirement-graph.ts nonexistent.json`
Expected: 退出码 2，输出 `✗ 文件不存在`

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/scripts/check-requirement-graph.ts
git commit -m "feat(graph): add check-requirement-graph.ts CLI entry"
```

---

## Task 7: plan-chunks.ts CLI 入口

**Files:**
- Create: `w-model-dev/scripts/plan-chunks.ts`

- [ ] **Step 1: 写 plan-chunks.ts**

```typescript
#!/usr/bin/env tsx
/**
 * 分块规划脚本（Chunk Planner）—— 为 ingestion 子流程产出分块计划
 *
 * 对应 w-model-dev/references/ingestion-chunk.md。
 * 编排者（O）以只读方式调用，脚本不写任何文件，仅 stdout 输出 JSON 分块计划。
 *
 * 用法：
 *   npx tsx w-model-dev/scripts/plan-chunks.ts <path> --phase=N --node-type=<TYPE> [--max-tokens=8000]
 *
 * 参数：
 *   path           文件或目录路径
 *   --phase        阶段 1-4
 *   --node-type    REQ | SD | INTF | DD
 *   --max-tokens   单块 token 上限，默认 8000
 *
 * 退出码：
 *   0  正常输出分块计划
 *   2  输入错误（路径不存在 / 参数非法）
 *
 * 输出：stdout JSON（供编排者读取用于 CHECKPOINT 展示与 A-chunk 分派）
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

interface Chunk {
  id: string;
  path: string;
  kind: 'file' | 'dir' | 'section';
  tokens: number;
}

interface PlanOutput {
  chunks: Chunk[];
  totalChunks: number;
  strategy: 'file-split' | 'dir-tree' | 'single';
  phase: number;
  nodeType: string;
}

const MAX_TOKENS_DEFAULT = 8000;

function parseArgs(argv: string[]): {
  inputPath: string;
  phase: number;
  nodeType: string;
  maxTokens: number;
} {
  const inputPath = argv[2];
  if (!inputPath) {
    console.error('用法: npx tsx w-model-dev/scripts/plan-chunks.ts <path> --phase=N --node-type=<TYPE> [--max-tokens=8000]');
    process.exit(2);
  }
  let phase: number | undefined;
  let nodeType: string | undefined;
  let maxTokens = MAX_TOKENS_DEFAULT;
  for (const a of argv.slice(3)) {
    if (a.startsWith('--phase=')) phase = Number.parseInt(a.split('=')[1], 10);
    else if (a.startsWith('--node-type=')) nodeType = a.split('=')[1];
    else if (a.startsWith('--max-tokens=')) maxTokens = Number.parseInt(a.split('=')[1], 10);
  }
  if (![1, 2, 3, 4].includes(phase ?? 0)) {
    console.error(`✗ --phase 必须为 1-4，实际: ${phase}`);
    process.exit(2);
  }
  if (!['REQ', 'SD', 'INTF', 'DD'].includes(nodeType ?? '')) {
    console.error(`✗ --node-type 必须为 REQ|SD|INTF|DD，实际: ${nodeType}`);
    process.exit(2);
  }
  return { inputPath, phase: phase!, nodeType: nodeType!, maxTokens };
}

function estimateTokens(text: string): number {
  // 字符数 / 4 近似（实现阶段可调，见设计文档 §6 开放问题1）
  return Math.ceil(text.length / 4);
}

async function splitMarkdownByHeaders(
  content: string,
  maxTokens: number,
  filePath: string,
  chunkIdPrefix: string,
): Promise<Chunk[]> {
  // 按 # 标题切分；若单节仍超限，按行数二次切分
  const sections = content.split(/^(#{1,6}\s)/m);
  const chunks: Chunk[] = [];
  let current = '';
  let idx = 1;
  for (let i = 0; i < sections.length; i++) {
    const piece = i === 0 ? sections[i] : sections[i] + (sections[i + 1] ?? '');
    if (i !== 0) i++; // 跳过已消费的标题部分
    const candidate = current + piece;
    if (estimateTokens(candidate) > maxTokens && current.length > 0) {
      chunks.push({
        id: `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`,
        path: filePath,
        kind: 'section',
        tokens: estimateTokens(current),
      });
      idx++;
      current = piece;
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) {
    chunks.push({
      id: `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`,
      path: filePath,
      kind: 'section',
      tokens: estimateTokens(current),
    });
  }
  return chunks;
}

async function planFile(
  filePath: string,
  maxTokens: number,
  chunkIdPrefix: string,
): Promise<Chunk[]> {
  const stat = await fs.stat(filePath);
  if (stat.isDirectory()) {
    // 目录：按叶子文件分块
    const entries = await fs.readdir(filePath, { withFileTypes: true });
    const chunks: Chunk[] = [];
    let idx = 1;
    for (const e of entries) {
      const childPath = path.join(filePath, e.name);
      if (e.isFile()) {
        const sub = await planFile(childPath, maxTokens, `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`);
        chunks.push(...sub);
        idx++;
      }
      // 子目录递归（叶子子目录=一候选块由递归自然处理）
    }
    return chunks;
  }
  // 文件
  const content = await fs.readFile(filePath, 'utf-8');
  const tokens = estimateTokens(content);
  if (tokens <= maxTokens) {
    return [{
      id: `${chunkIdPrefix}-001`,
      path: filePath,
      kind: 'file',
      tokens,
    }];
  }
  // 超限：Markdown 按标题切，非 Markdown 按行切
  if (filePath.endsWith('.md') || filePath.endsWith('.markdown')) {
    return splitMarkdownByHeaders(content, maxTokens, filePath, chunkIdPrefix);
  }
  // 按行切（overlap 50 行）
  const lines = content.split('\n');
  const linesPerChunk = Math.ceil((maxTokens * 4) / 1); // 近似：maxTokens*4 字符 ≈ 行数
  const chunks: Chunk[] = [];
  let idx = 1;
  for (let i = 0; i < lines.length; i += linesPerChunk - 50) {
    const slice = lines.slice(i, i + linesPerChunk).join('\n');
    chunks.push({
      id: `${chunkIdPrefix}-${String(idx).padStart(3, '0')}`,
      path: filePath,
      kind: 'section',
      tokens: estimateTokens(slice),
    });
    idx++;
    if (i + linesPerChunk >= lines.length) break;
  }
  return chunks;
}

async function main(): Promise<void> {
  const { inputPath, phase, nodeType, maxTokens } = parseArgs(process.argv);

  const abs = path.resolve(inputPath);
  try {
    await fs.access(abs);
  } catch {
    console.error(`✗ 路径不存在: ${abs}`);
    process.exit(2);
  }

  const stat = await fs.stat(abs);
  const chunks = await planFile(abs, maxTokens, 'chunk');

  const output: PlanOutput = {
    chunks,
    totalChunks: chunks.length,
    strategy: stat.isDirectory() ? 'dir-tree' : chunks.length > 1 ? 'file-split' : 'single',
    phase,
    nodeType,
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error('分块规划脚本异常:', err);
  process.exit(2);
});
```

- [ ] **Step 2: 验证单文件分块**

创建临时测试文件后运行（或用现有 md 文件）：
Run: `npx tsx w-model-dev/scripts/plan-chunks.ts w-model-dev/SKILL.md --phase=1 --node-type=REQ`
Expected: 退出码 0，stdout 输出 JSON 含 `totalChunks`、`strategy`、`chunks` 数组

- [ ] **Step 3: 验证目录分块**

Run: `npx tsx w-model-dev/scripts/plan-chunks.ts w-model-dev/references --phase=2 --node-type=SD`
Expected: 退出码 0，`strategy: "dir-tree"`，`totalChunks` 等于 references 下文件数

- [ ] **Step 4: 验证路径不存在退出码 2**

Run: `npx tsx w-model-dev/scripts/plan-chunks.ts nonexistent --phase=1 --node-type=REQ`
Expected: 退出码 2，输出 `✗ 路径不存在`

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/scripts/plan-chunks.ts
git commit -m "feat(ingestion): add plan-chunks.ts CLI entry (read-only chunk planner)"
```

---

## Task 8: 扩展 self-test.ts 加入图谱用例

**Files:**
- Modify: `w-model-dev/scripts/self-test.ts`

- [ ] **Step 1: 在 self-test.ts 顶部 import 加入 graph-logic**

修改 import 节（约第 29-30 行）为：

```typescript
import { checkVerifierOutput } from './verifier-logic.js';
import { checkArtifactGate } from './gate-logic.js';
import { checkRequirementGraph } from './graph-logic.js';
```

- [ ] **Step 2: 在 GATE_CASES 数组后追加 GRAPH_CASES 定义**

在 `];`（GATE_CASES 数组结束，约第 156 行）之后插入：

```typescript
interface GraphCase {
  file: string;
  phase: number;
  expectedPassed: boolean;
  expectedReasonPatterns?: RegExp[];
  description: string;
}

const GRAPH_CASES: GraphCase[] = [
  {
    file: 'valid-graph.json',
    phase: 4,
    expectedPassed: true,
    description: 'phase=4 完整图谱：连通 + 单根 + 父唯一 + 全追溯',
  },
  {
    file: 'bad-isolated.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/连通性校验失败/],
    description: '存在孤立节点 REQ-002，应被连通性校验拦截',
  },
  {
    file: 'bad-multi-root.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/单根校验失败.*2 个根节点/],
    description: '两个根节点（depends-on 不构成 parent），应被单根校验拦截',
  },
  {
    file: 'bad-orphan.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/单根校验失败/],
    description: 'REQ-002 无 parent 入边且非唯一根，应被单根/orphan 校验拦截',
  },
  {
    file: 'bad-multi-parent.json',
    phase: 1,
    expectedPassed: false,
    expectedReasonPatterns: [/父唯一性校验失败.*REQ-C/],
    description: 'REQ-C 有两条 parent 入边，应被父唯一性校验拦截',
  },
  {
    file: 'bad-sd-no-implements.json',
    phase: 2,
    expectedPassed: false,
    expectedReasonPatterns: [/SD 节点 SD-001 缺少 implements 出边/],
    description: 'phase=2 时 SD 缺 implements，应被追溯校验拦截',
  },
  {
    file: 'bad-intf-no-defines.json',
    phase: 3,
    expectedPassed: false,
    expectedReasonPatterns: [/INTF 节点 INTF-001 缺少 defines 入边/],
    description: 'phase=3 时 INTF 缺 defines，应被追溯校验拦截',
  },
  {
    file: 'bad-dd-no-realizes.json',
    phase: 4,
    expectedPassed: false,
    expectedReasonPatterns: [/DD 节点 DD-001 缺少 realizes 出边/],
    description: 'phase=4 时 DD 缺 realizes，应被追溯校验拦截',
  },
];
```

- [ ] **Step 3: 在 runGateCases 函数后追加 runGraphCases 函数**

在 `async function runGateCases(...)` 函数结束后（约第 237 行）插入：

```typescript
async function runGraphCases(samplesDir: string): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const c of GRAPH_CASES) {
    const abs = path.join(samplesDir, 'graph', c.file);
    const raw = await fs.readFile(abs, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    const r = checkRequirementGraph(parsed, c.phase);

    const details: string[] = [];
    if (r.passed !== c.expectedPassed) {
      details.push(
        `  - 期望 passed=${c.expectedPassed}，实际 passed=${r.passed}`,
      );
    }
    if (!c.expectedPassed) {
      details.push(...matchReasonPatterns(r.violations, c.expectedReasonPatterns));
    }

    results.push({
      name: `graph/${c.file}`,
      passed: details.length === 0,
      description: c.description,
      details: details.length > 0 ? details : undefined,
    });
  }
  return results;
}
```

- [ ] **Step 4: 在 main() 中加入 graph 用例执行**

修改 main() 中的执行部分（约第 249-257 行）。将：

```typescript
  console.log(`Verifier 用例 : ${VERIFIER_CASES.length}`);
  console.log(`Gate 用例     : ${GATE_CASES.length}`);
  console.log('─'.repeat(60));

  const [verifierResults, gateResults] = await Promise.all([
    runVerifierCases(samplesDir),
    runGateCases(samplesDir),
  ]);
  const all = [...verifierResults, ...gateResults];
```

改为：

```typescript
  console.log(`Verifier 用例 : ${VERIFIER_CASES.length}`);
  console.log(`Gate 用例     : ${GATE_CASES.length}`);
  console.log(`Graph 用例    : ${GRAPH_CASES.length}`);
  console.log('─'.repeat(60));

  const [verifierResults, gateResults, graphResults] = await Promise.all([
    runVerifierCases(samplesDir),
    runGateCases(samplesDir),
    runGraphCases(samplesDir),
  ]);
  const all = [...verifierResults, ...gateResults, ...graphResults];
```

- [ ] **Step 5: 运行 self-test 验证全部通过**

Run: `npm run self-test`
Expected: 退出码 0，输出 `总计 25 条用例：25 通过，0 失败`（原 17 + 新增 8）

- [ ] **Step 6: Commit**

```bash
git add w-model-dev/scripts/self-test.ts
git commit -m "test(graph): add 8 graph cases to self-test (17→25 total)"
```

---

## Task 9: package.json 加入 check:graph 脚本

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 在 scripts 中加入 check:graph**

修改 `package.json` 的 `scripts` 节，在 `"check:gate"` 行后追加：

```json
    "check:gate": "tsx w-model-dev/scripts/check-artifact-gate.ts",
    "check:graph": "tsx w-model-dev/scripts/check-requirement-graph.ts",
```

- [ ] **Step 2: 验证 npm run check:graph 可用**

Run: `npm run check:graph -- w-model-dev/scripts/samples/graph/valid-graph.json --phase=4`
Expected: 退出码 0，输出含 `✓ 通过`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "build: add check:graph npm script"
```

---

## Task 10: references/graph-guide.md 图谱模型说明

**Files:**
- Create: `w-model-dev/references/graph-guide.md`

- [ ] **Step 1: 写 graph-guide.md**

```markdown
# 图谱模型说明（Graph Guide）

> 本文件定义 ingestion 子流程的图谱模型：节点/边类型、单根树约束、阶段递进追溯规则、graph.json 与 rtm.json 的分工。
> A 子代理（A-chunk/A-cross/A-evolve）与 G 子代理（跑 check-requirement-graph.ts）必读。

## 节点类型

| 阶段 | 类型 | 提取者 | 语义 |
|---|---|---|---|
| 1 | REQ | A-chunk | 功能/非功能/约束需求 |
| 2 | SD | A-evolve | 系统模块/组件 |
| 3 | INTF | A-evolve | 接口实体 |
| 4 | DD | A-evolve | 详细设计单元 |

节点 id 格式 `<TYPE>-<NNN>` 全局唯一。

## 边类型

| 类型 | 方向 | 语义 | 数量约束 |
|---|---|---|---|
| parent | 父→子 | 单根树主结构边：REQ→SD→INTF→DD | 非根节点恰好 1 条入边；根 0 条 |
| depends-on | 任意→任意 | 通用依赖 | ≥0 |
| implements | SD→REQ | 设计实现需求（追溯边） | 每 SD ≥1 |
| defines | SD→INTF | 系统设计定义接口 | 每 INTF ≥1（阶段3起校验） |
| realizes | DD→INTF | 详细设计实现接口 | 每 DD ≥1（阶段4起校验） |

单根树由 parent 边构成。implements/defines/realizes 是追溯边，不参与父唯一性但参与连通性。

## 阶段递进追溯（门禁同步收敛）

| 阶段 | 校验项 | 硬约束 |
|---|---|---|
| 1 | 连通 + 单根 + 父唯一 | 是 |
| 2 | + SD_without_implements=0 | 是 |
| 3 | + INTF_without_defines=0 | 是 |
| 4 | + DD_without_realizes=0 | 是（零违反才放行进编码） |

门禁项单调递增，违反数应单调递减至 0。

## graph.json schema

见 [ingestion-graph-convergence-design.md](../../docs/ingestion-graph-convergence-design.md) §2.4。

## 与 rtm.json 的分工

| 文件 | 管什么 | G 跑什么 |
|---|---|---|
| graph.json | 结构拓扑（连通/单根/追溯） | check-requirement-graph.ts |
| rtm.json | 追溯矩阵（需求-设计-代码-测试映射） | check-artifact-gate.ts（阶段8） |

两者并存，各自独立校验，互不替代。graph.json 是结构层，rtm.json 是追溯层。

## 校验脚本

```bash
npx tsx w-model-dev/scripts/check-requirement-graph.ts "<graph.json|consolidated.json>" [--phase=1|2|3|4]
```

退出码 0=通过 / 1=失败 / 2=输入错误。算法详见 [ingestion-graph-convergence-design.md](../../docs/ingestion-graph-convergence-design.md) §3.2。
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/graph-guide.md
git commit -m "docs(graph): add graph-guide.md reference"
```

---

## Task 11: references/ingestion-chunk.md A-chunk 任务指引

**Files:**
- Create: `w-model-dev/references/ingestion-chunk.md`

- [ ] **Step 1: 写 ingestion-chunk.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/ingestion-chunk.md
git commit -m "docs(ingestion): add ingestion-chunk.md A-chunk guide"
```

---

## Task 12: references/ingestion-cross.md A-cross/A-evolve 任务指引

**Files:**
- Create: `w-model-dev/references/ingestion-cross.md`

- [ ] **Step 1: 写 ingestion-cross.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add w-model-dev/references/ingestion-cross.md
git commit -m "docs(ingestion): add ingestion-cross.md A-cross/A-evolve guide"
```

---

## Task 13: SKILL.md 加入 A 角色与 ingestion 子流程

**Files:**
- Modify: `w-model-dev/SKILL.md`

- [ ] **Step 1: 在「编排者-子代理边界」节角色表加 A 行**

在 SKILL.md 第 56-61 行的角色表（O/S/V/G 四行）后追加 A 行。找到：

```
| 门禁子代理 | G | 跑 `check-verifier-output.ts` / `check-artifact-gate.ts` + 回填证据摘要 | 改产物 / 产出评审 JSON / 改 RTM / 跑测试运行器 |
```

在其后追加：

```
| 分析子代理 | A | 分块分析、交叉合并、图谱演进（阶段 1–4）；产出 `.w-model/ingestion/*` 与 `consolidated.json` | 跑 `check-requirement-graph.ts` / 写正式阶段产物 / 改 `project.status` / 越阶段产出 / 删除前阶段图谱节点 |
```

- [ ] **Step 2: 在「执行工作流」节步 5 与步 6 之间插入 ingestion 子流程描述**

找到第 112 行附近：

```
5. **初始化确认**（O）：首次进入项目前确认技术栈、当前阶段、同步测试设计和产物清单。
6. **分派 S 子代理产出**（O → S）：...
```

在步 5 与步 6 之间插入：

```
5.5. **ingestion 子流程**（O → A → G，阶段 1–4）：每个设计阶段进入时，O 跑 `plan-chunks.ts`（只读 stdout）产出分块计划 → 🔴 CHECKPOINT · ingestion 规划确认 → 并行分派 A-chunk 产出 `<chunk-id>.{md,json}` → 分派 A-cross（阶段1）/A-evolve（阶段2-4）合并建图产出 `consolidated.json` → 分派 G 跑 `check-requirement-graph.ts` → 收敛循环（MAX_ROUNDS=5，阈值=零违反）→ 🔴 CHECKPOINT · ingestion 收敛确认。详见 [references/ingestion-chunk.md](references/ingestion-chunk.md) 与 [references/ingestion-cross.md](references/ingestion-cross.md)。
```

- [ ] **Step 3: 在「命令速查」表 /wm analyze 与 /wm design 行的"关键前置/行为"列注明 ingestion**

找到 `/wm analyze <需求>` 行，将"关键前置/行为"列改为：

```
首次初始化并同步验收测试设计；触发 ingestion 子流程（A 角色 + 图谱校验）
```

找到 `/wm design type=<架构\|概要\|详细>` 行，将"关键前置/行为"列改为：

```
必须存在上一阶段已放行产物；触发 ingestion 子流程（A 角色 + 图谱校验，S→A 路径）
```

- [ ] **Step 4: 在「快速自检」清单末尾追加图谱项**

找到第 223 行附近的最后一个自检项后追加：

```
- [ ] **图谱校验通过**：阶段 1–4 的 `check-requirement-graph.ts` 退出码 0；阶段 4 零违反硬约束达成才放行进编码
```

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/SKILL.md
git commit -m "feat(skill): add A role, ingestion subflow, graph check to SKILL.md"
```

---

## Task 14: subagent-delegation.md 加入 A 角色完整定义

**Files:**
- Modify: `w-model-dev/references/subagent-delegation.md`

- [ ] **Step 1: 在角色表加 A 行**

找到第 28 行 G 角色行后，追加 A 角色行：

```
| **分析子代理** | A | 分块分析、交叉合并、图谱演进（阶段 1–4） | ① 读原始文档分块 / S 产出的正式文档；② 写 `.w-model/ingestion/<chunk-id>.{md,json}`；③ 读所有 chunk json 合并建图；④ 产出 `consolidated.json` + `cross-analysis-report.md` + `reworkHints`；⑤ 通过晋升 consolidated.json 更新 graph.json | ① 跑 `check-requirement-graph.ts`（G 负责）；② 写正式阶段产物；③ 改 `project.status`；④ 越阶段产出；⑤ 删除前阶段已通过的图谱节点 |
```

- [ ] **Step 2: 在「子代理分派模板」节追加 A 子代理分派模板**

在 G 子代理分派模板（约第 140 行）之后，插入新节：

```markdown
### A-chunk 子代理分派模板

```
角色：分析子代理-分块变体（A-chunk）
当前 W 模型阶段：<阶段 N - 名称>
任务：读单个 chunk，提取本阶段节点类型实体，产出 <chunk-id>.{md,json}
上下文：
  - chunk 路径：<文件路径>
  - chunk-id：<chunk-001>
  - 阶段与节点类型：<phase=N, node-type=REQ|SD|INTF|DD>
  - 全局目录树摘要 + 相邻 chunk 标题列表（用于跨块边初判）
  - 上一轮 reworkHints（若为补漏轮次）
必读：
  - references/ingestion-chunk.md
  - references/graph-guide.md
产出契约：
  1. 文件路径：.w-model/ingestion/<chunk-id>.md + <chunk-id>.json
  2. JSON 须满足 ingestion-chunk.md schema（nodes/edges/crossChunkHints）
  3. 返回编排者：{role:"A", variant:"chunk", chunkId, entities, edges, blocked?}
禁止：
  - 跑 check-requirement-graph.ts
  - 写正式阶段产物
  - 越阶段产出
```

### A-cross/A-evolve 子代理分派模板

```
角色：分析子代理-合并/演进变体（A-cross 阶段1 / A-evolve 阶段2-4）
任务：合并所有 chunk.json 建图，确认跨块边，产出 consolidated.json + reworkHints
上下文：
  - .w-model/ingestion/*.json 全集
  - 现有 graph.json（仅 A-evolve）
  - 上一轮 reworkHints（若为补漏轮次）
必读：
  - references/ingestion-cross.md
  - references/graph-guide.md
产出契约：
  1. 文件路径：.w-model/ingestion/consolidated.json + cross-analysis-report.md
  2. reworkHints 指向具体 chunkId 与原因
  3. 返回编排者：{role:"A", variant:"cross|evolve", totalEntities, totalEdges, isolatedNodes, connectedComponents, roots, reworkHints}
禁止：
  - 跑 check-requirement-graph.ts（G 负责）
  - 写正式阶段产物
  - 删除前阶段图谱节点（A-evolve）
```
```

- [ ] **Step 3: 在「回填契约」节追加 A 子代理返回格式**

在 G 子代理返回 JSON 块（约第 200 行）之后，插入：

```markdown
### A 子代理返回

```json
{
  "role": "A",
  "variant": "chunk | cross | evolve",
  "chunkId": "<仅 chunk 变体>",
  "entities": "<仅 chunk 变体，int>",
  "edges": "<仅 chunk 变体，int>",
  "totalEntities": "<仅 cross/evolve，int>",
  "totalEdges": "<仅 cross/evolve，int>",
  "isolatedNodes": ["<仅 cross/evolve>"],
  "connectedComponents": "<仅 cross/evolve，int>",
  "roots": ["<仅 cross/evolve>"],
  "reworkHints": [{"chunkId":"<id>","reason":"<...>"}],
  "blocked": "<仅 chunk 变体，可选>"
}
```

编排者收到 A 返回后：
- A-chunk `blocked` 非空 → 🔴 CHECKPOINT 介入；
- A-cross/A-evolve 返回后 → 分派 G 跑 `check-requirement-graph.ts`，按退出码决定收敛或补漏。
```

- [ ] **Step 4: 在「强制约束」节注明 A 的禁止动作**

找到第 209 行"编排者不得直接执行以下任何动作"列表，在第 5 项后追加：

```
6. **自行合并图谱/写 ingestion 文件**：用 `Write` / `Edit` 写 `.w-model/ingestion/*` 文件（必须分派 A 子代理）。命中即触发反模式 #10 变体。
```

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/references/subagent-delegation.md
git commit -m "feat(delegation): add A role definition, dispatch templates, return contract"
```

---

## Task 15: phase-1-requirements.md 加入 ingestion 引用

**Files:**
- Modify: `w-model-dev/references/phase-1-requirements.md`

- [ ] **Step 1: 在「需求解析算法」节前插入 ingestion 子流程引用**

找到第 28 行 `## 需求解析算法` 之前，插入新节：

```markdown
## ingestion 子流程（A→S 路径，阶段 1 专用）

阶段 1 进入时，编排者先跑 `plan-chunks.ts` 对输入分块（一句话输入产 1 chunk，仍走完整流程），并行分派 A-chunk 提取 REQ 节点，再分派 A-cross 合并建图、G 跑 `check-requirement-graph.ts` 校验连通性与单根。收敛后 S 子代理读 `graph.json` 产出正式需求规格。

详见 [ingestion-chunk.md](ingestion-chunk.md) / [ingestion-cross.md](ingestion-cross.md) / [graph-guide.md](graph-guide.md) 与设计文档 [ingestion-graph-convergence-design.md](../../docs/ingestion-graph-convergence-design.md) §1.3。
```

- [ ] **Step 2: 在「执行方法论」表加 graph.json 行**

找到第 52-56 行的方法论表，在风险评估报告行后追加：

```
| graph.json | A 子代理产出，记录 REQ 节点与 parent/depends-on 边 | `.w-model/ingestion/graph.json`（跨阶段演进） |
```

- [ ] **Step 3: 在「验收标准」清单加图谱项**

找到第 80-84 行验收标准，追加：

```
- [ ] 图谱校验通过：`check-requirement-graph.ts --phase=1` 退出码 0（连通 + 单根 + 父唯一）
```

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/references/phase-1-requirements.md
git commit -m "feat(phase-1): add ingestion subflow reference and graph acceptance criteria"
```

---

## Task 16: phase-2/3/4 加入 S→A ingestion 节

**Files:**
- Modify: `w-model-dev/references/phase-2-system-design.md`
- Modify: `w-model-dev/references/phase-3-outline-design.md`
- Modify: `w-model-dev/references/phase-4-detailed-design.md`

- [ ] **Step 1: 读 phase-2/3/4 确认插入位置**

Run: `npx tsx --eval "Promise.all(['phase-2-system-design','phase-3-outline-design','phase-4-detailed-design'].map(f=>import('fs').then(fs=>fs.promises.readFile('w-model-dev/references/'+f+'.md','utf-8')).then(c=>console.log(f, c.indexOf('## 验收标准')))))"`
Expected: 输出三个文件中"## 验收标准"标题的字节偏移，用于定位插入点

- [ ] **Step 2: phase-2 在验收标准前插入 ingestion 节**

在 `phase-2-system-design.md` 的 `## 验收标准` 之前插入：

```markdown
## ingestion 子流程（S→A 路径，阶段 2）

阶段 2 的 S 子代理先产出 system-design.md，再由 A-evolve 从中提取 SD 节点追加到 `graph.json`，G 跑 `check-requirement-graph.ts --phase=2` 校验连通 + 单根 + SD_without_implements=0。

详见 [ingestion-cross.md](ingestion-cross.md) 与 [graph-guide.md](graph-guide.md)。
```

- [ ] **Step 3: phase-3 同样插入（INTF 节点，phase=3）**

在 `phase-3-outline-design.md` 的 `## 验收标准` 之前插入：

```markdown
## ingestion 子流程（S→A 路径，阶段 3）

阶段 3 的 S 子代理先产出接口设计文档，再由 A-evolve 提取 INTF 节点追加到 `graph.json`，G 跑 `check-requirement-graph.ts --phase=3` 校验连通 + 单根 + SD_without_implements=0 + INTF_without_defines=0。

详见 [ingestion-cross.md](ingestion-cross.md) 与 [graph-guide.md](graph-guide.md)。
```

- [ ] **Step 4: phase-4 插入并加阶段4硬约束**

在 `phase-4-detailed-design.md` 的 `## 验收标准` 之前插入：

```markdown
## ingestion 子流程（S→A 路径，阶段 4）

阶段 4 的 S 子代理先产出 detailed-design.md，再由 A-evolve 提取 DD 节点追加到 `graph.json`，G 跑 `check-requirement-graph.ts --phase=4` 校验全部追溯项。

> **阶段 4 硬约束**：`check-requirement-graph.ts --phase=4` 退出码必须为 0（连通 + 单根 + 父唯一 + SD_without_implements=0 + INTF_without_defines=0 + DD_without_realizes=0），否则不放行进阶段 5 编码。阶段 1-3 允许带未解决项强制接受（标注后留后续阶段补），阶段 4 不允许。

详见 [ingestion-cross.md](ingestion-cross.md) 与 [graph-guide.md](graph-guide.md)。
```

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/references/phase-2-system-design.md w-model-dev/references/phase-3-outline-design.md w-model-dev/references/phase-4-detailed-design.md
git commit -m "feat(phase-2-4): add S→A ingestion subflow sections and phase-4 hard constraint"
```

---

## Task 17: workflow.md 加入 ingestion 标注

**Files:**
- Modify: `w-model-dev/references/workflow.md`

- [ ] **Step 1: 在流程图阶段 1-4 节点加 ingestion 标注**

找到第 19-25 行流程图，将阶段 1-4 的行改为（在 `(S 同步...)` 后加 `+(A 图谱)`）：

```
[O 路由] 需求分析 ──(S 同步验收测试设计)+(A 图谱: REQ 节点+连通单根校验)──► [V 评审] ──[G 门禁通过]──► 系统设计
[O 路由] 系统设计 ──(S 同步系统测试设计)+(A 图谱: SD 节点+implements 校验)──► [V 评审] ──[G 门禁通过]──► 概要设计
[O 路由] 概要设计 ──(S 同步集成测试设计)+(A 图谱: INTF 节点+defines 校验)──► [V 评审] ──[G 门禁通过]──► 详细设计
[O 路由] 详细设计 ──(S 同步单元测试设计)+(A 图谱: DD 节点+realizes 校验, 零违反硬约束)──► [V 评审] ──[G 门禁通过]──► 编码实现
```

- [ ] **Step 2: 在阶段产物清单表加 graph.json 列说明**

找到第 58-67 行的产物清单表，在"产物（artifact）"列的每阶段产出后追加 graph.json 相关说明。例如阶段 1 行改为：

```
需求规格说明书（`*-requirement-spec.md`）、RTM 需求列 + 验收测试列、`graph.json`（REQ 节点）
```

阶段 2/3/4 类似追加 `graph.json`（SD/INTF/DD 节点）。

- [ ] **Step 3: 在工作流常见反模式表加 #11/#12 行**

找到第 123-131 行反模式表，在第 8 行后追加：

```
| 9 | ingestion 跳过图谱校验直接进 S 产出 | #11（新增） | 阶段 1-4 必须跑 check-requirement-graph.ts，不得跳过 A→G 收敛循环 |
| 10 | A 子代理自评收敛（用 LLM 输出判定收敛） | #12（新增） | 收敛判定由 G 跑脚本退出码决定，A 的 reworkHints 仅作指引 |
```

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/references/workflow.md
git commit -m "feat(workflow): add ingestion/graph annotations to flow diagram and anti-patterns"
```

---

## Task 18: anti-patterns.md 加入 #11/#12

**Files:**
- Modify: `w-model-dev/references/anti-patterns.md`

- [ ] **Step 1: 读 anti-patterns.md 确认现有编号与结构**

Run: 读文件确认 #1-#10 的格式，找到 #10 节末尾位置。

- [ ] **Step 2: 在 #10 节后追加 #11 与 #12**

在 #10「编排者越权实施」节之后，追加：

```markdown
## #11 ingestion 跳过图谱校验

**检测信号**：阶段 1-4 未跑 `check-requirement-graph.ts` 直接进 S 产出 / V 评审；或编排者跳过 A→G 收敛循环。

**回退动作**：回到当前阶段起点，补跑 ingestion 子流程（A-chunk → A-cross/A-evolve → G 图谱校验）。

**与约束 4 的关系**：图谱校验是"真实执行"在结构层的延伸，不得用 LLM 估算替代脚本退出码。
```

```markdown
## #12 A 子代理自评收敛

**检测信号**：A-cross/A-evolve 的 LLM 输出被直接用作收敛判定，未经 G 跑 `check-requirement-graph.ts`。

**回退动作**：作废 A 的收敛声明，分派 G 跑脚本，按退出码重新判定。

**与反模式 #3/#6 的关系**：这是"LLM 估算质量门"在 ingestion 场景的变体——A 的 reworkHints 是指引不是判定。
```

- [ ] **Step 3: 在 F1-F10 失败模式清单补充 ingestion 信号**

找到 F1-F10 表格（若有），在相关行（如 F1 静默假设、F10 跳过验证）的"与反例的关系"列补充：

```
F1：ingestion 中 A-chunk 静默补全跨块关系（应写入 crossChunkHints 待 A-cross 确认）
F10：ingestion 中跳过 G 图谱校验直接声明收敛
```

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/references/anti-patterns.md
git commit -m "feat(anti-patterns): add #11 ingestion skip, #12 A self-eval convergence"
```

---

## Task 19: command-reference.md / examples / SSoT / AGENTS.md / README / CHANGELOG

**Files:**
- Modify: `w-model-dev/references/command-reference.md`
- Modify: `w-model-dev/examples/requirement-analysis.md`
- Modify: `docs/skill-design-document_SSoT.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: command-reference.md 在 /wm analyze 与 /wm design 条目加 ingestion 字段**

找到 `/wm analyze` 条目，在"输出"或"行为"节追加：

```
ingestion：触发 A 角色 ingestion 子流程（plan-chunks → A-chunk → A-cross → G 图谱校验 → 收敛循环），产出 graph.json（REQ 节点）
```

`/wm design` 各 type 条目类似追加（SD/INTF/DD 节点，S→A 路径）。

- [ ] **Step 2: examples/requirement-analysis.md 加超大文档 ingestion 样例片段**

在文件末尾追加：

```markdown
## 示例：超大/多目录文档 ingestion

```
用户: /wm analyze docs/legacy-specs/（含 20+ 历史需求文档的多目录）

AI: 正在执行【需求分析】阶段，输入为多目录结构，启用 ingestion 子流程...

AI: 分块规划（plan-chunks.ts）：
    - 策略: dir-tree
    - 总块数: 23
    - 总 token 估算: 45000
    🔴 CHECKPOINT · ingestion 规划确认：是否放行此分块计划？

用户: 放行

AI: 并行分派 23 个 A-chunk 提取 REQ 节点...
    （收敛循环 round 1）
    A-cross 合并: 87 个 REQ 节点, 102 条边, 3 个孤立节点, 2 个连通分量
    G 跑 check-requirement-graph.ts --phase=1: exit 1（连通分量=2, 孤立=[REQ-041,REQ-058,REQ-073]）
    reworkHints: chunk-007 补 REQ-041 关系, chunk-015 补 REQ-058/073 关系
    
    （针对性补漏后 round 2）
    G: exit 0, passed=true, 连通分量=1, 单根=REQ-ROOT
    
    🔴 CHECKPOINT · ingestion 收敛确认：图谱 87 节点/115 边，单根 REQ-ROOT，是否放行进入需求产出？

用户: 放行

AI: S 子代理读 graph.json 产出需求规格说明书 + 98 个验收测试用例 + RTM 登记...
```
```

- [ ] **Step 3: SSoT.md §3.4 加 A 角色、§4 加 ingestion、§7 加 graph.json、§10 加图谱门禁**

在 `docs/skill-design-document_SSoT.md`：

- §3.4 编排者-子代理边界：角色划分表加 A 行（与 subagent-delegation.md 一致）
- §4 技能工作流程：在阶段 1-4 描述中加 ingestion 子流程引用
- §7 数据模型设计：加 §7.7 graph.json schema（引用设计文档 §2.4）
- §10 质量保障体系：加 §10.7 图谱门禁（check-requirement-graph.ts，引用设计文档 §3）

- [ ] **Step 4: AGENTS.md 关键目录速查加 graph-logic / ingestion 参考**

在 AGENTS.md §2「关键目录速查」表的 `w-model-dev/scripts/` 与 `w-model-dev/references/` 行更新说明，加入 `graph-logic.ts` / `check-requirement-graph.ts` / `plan-chunks.ts` / `ingestion-*.md` / `graph-guide.md`。

- [ ] **Step 5: README.md 命令速查加 check:graph**

在 README 的常用命令节追加：

```
npm run check:graph -- <graph.json> [--phase=1|2|3|4]  # 图谱结构门禁，退出码 0/1/2
```

- [ ] **Step 6: CHANGELOG.md 加本次变更条目**

在 CHANGELOG.md 顶部追加：

```
## [Unreleased] - 2026-07-22

### Added
- 新增 A 角色（分析子代理），阶段 1-4 活跃，支持超大/多目录文档分块并行分析与多轮交叉分析
- 新增 `scripts/graph-logic.ts` + `check-requirement-graph.ts` 图谱门禁（连通/单根/父唯一/阶段追溯）
- 新增 `scripts/plan-chunks.ts` 只读分块规划
- 新增 `references/ingestion-chunk.md` / `ingestion-cross.md` / `graph-guide.md`
- 新增 `.w-model/ingestion/graph.json` 演进图谱（结构层，与 rtm.json 追溯层并存）
- 阶段 4 图谱零违反硬约束（编码前追溯链完整）
- self-test 用例 17→25（+8 图谱用例）
- 设计文档 `docs/ingestion-graph-convergence-design.md`
```

- [ ] **Step 7: Commit**

```bash
git add w-model-dev/references/command-reference.md w-model-dev/examples/requirement-analysis.md docs/skill-design-document_SSoT.md AGENTS.md README.md CHANGELOG.md
git commit -m "docs: sync SSoT, AGENTS, README, CHANGELOG, command-reference, examples for ingestion"
```

---

## Task 20: 端到端验证

- [ ] **Step 1: 跑完整 self-test**

Run: `npm run self-test`
Expected: 退出码 0，`总计 25 条用例：25 通过，0 失败`

- [ ] **Step 2: 跑 prepush 门禁（若已 setup hooks）**

Run: `npm run prepush`
Expected: 退出码 0（若未 setup hooks 则跳过）

- [ ] **Step 3: 手动验证 check-requirement-graph.ts 各样本**

Run:
```bash
for f in valid-graph bad-isolated bad-multi-root bad-orphan bad-multi-parent bad-sd-no-implements bad-intf-no-defines bad-dd-no-realizes; do
  echo "=== $f ==="
  npx tsx w-model-dev/scripts/check-requirement-graph.ts "w-model-dev/scripts/samples/graph/$f.json" --phase=4 2>&1 | tail -3
  echo "exit=$?"
done
```
Expected: valid 退出 0，其余退出 1（bad-orphan 因 phase=4 无 SD/INTF/DD 节点，追溯项全 0，但连通/单根失败 → 退出 1）

- [ ] **Step 4: 验证 plan-chunks.ts 对单文件/目录/不存在路径**

Run:
```bash
npx tsx w-model-dev/scripts/plan-chunks.ts w-model-dev/SKILL.md --phase=1 --node-type=REQ | head -5
npx tsx w-model-dev/scripts/plan-chunks.ts w-model-dev/references --phase=2 --node-type=SD | head -5
npx tsx w-model-dev/scripts/plan-chunks.ts nonexistent --phase=1 --node-type=REQ
echo "exit=$?"
```
Expected: 前两个退出 0 输出 JSON，第三个退出 2

- [ ] **Step 5: 验证 SKILL.md / subagent-delegation.md 交叉引用完整**

Run: `grep -c "ingestion-chunk.md\|ingestion-cross.md\|graph-guide.md\|check-requirement-graph.ts\|plan-chunks.ts" w-model-dev/SKILL.md w-model-dev/references/subagent-delegation.md w-model-dev/references/phase-1-requirements.md`
Expected: 每个文件至少 1 次匹配（交叉引用已建立）

- [ ] **Step 6: 最终 commit（如有遗漏修正）**

```bash
git add -A
git commit -m "test: e2e verification passed (self-test 25/25, graph samples, plan-chunks)"
```

---

## Self-Review

**1. Spec coverage（对照设计文档 §0-§7）：**
- §1 角色契约 → Task 13 (SKILL.md) + Task 14 (subagent-delegation.md) ✓
- §2 图谱模型 → Task 1-4 (graph-logic.ts) + Task 10 (graph-guide.md) ✓
- §3 校验算法 → Task 1-4 + Task 6 (CLI) ✓
- §4 文件清单 → Task 10-12 (新参考) + Task 13-19 (改动) ✓
- §5 失败模式 → Task 18 (anti-patterns #11/#12) ✓
- §6 开放问题 → 留实现决定，不在计划内 ✓
- §7 验收标准 → Task 20 端到端验证 ✓

**2. Placeholder scan：** 无 TBD/TODO；所有代码步骤含完整代码块；样本 JSON 完整可解析。

**3. Type consistency：** `checkRequirementGraph` 在 graph-logic.ts / check-requirement-graph.ts / self-test.ts 中签名一致；`GraphShape` / `GraphCheckResult` / `TraceabilityViolations` 跨文件引用一致；`plan-chunks.ts` 的 `PlanOutput` / `Chunk` 类型自洽。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-22-ingestion-graph-convergence.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
