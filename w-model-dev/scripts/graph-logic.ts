/**
 * 图谱校验纯逻辑（Graph Logic）—— 防止 ingestion 图谱结构漂移
 *
 * 对应 w-model-dev/references/graph-guide.md 图谱模型（§3 系统层级树 + §7 多层图谱 7 层）。
 * 校验：连通性 + 系统层级树（单 REQ 根 / 层级单调 / orphan BFS / 环检测 / 父唯一）
 *       + 阶段递进追溯 + 信息流（黑洞/奇迹/死模块，根节点豁免死模块）
 *       + 多层图谱横切边（governs / collaborates-with / derives）。
 *
 * 设计原则（与 verifier-logic.ts / gate-logic.ts 一致）：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状，不 import 外部模块
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用
 *   3. 单点事实：所有「图谱是否符合规范」的判定均委托至此
 */

// ==================== 自包含类型形状 ====================

export type NodeType = 'REQ' | 'SD' | 'INTF' | 'DD' | 'EXT-IN' | 'EXT-OUT';
export type EdgeType =
  | 'parent'
  | 'depends-on'
  | 'implements'
  | 'defines'
  | 'realizes'
  | 'produces'
  // consumes 已移除（D21）：信息流层统一用 produces，双向语义由 from/to 表达
  // 多层图谱（横切层）：
  | 'governs' // 治理层：治理类子系统→被治理子系统
  | 'collaborates-with' // 协作层：对等协作（单条边语义双向）
  | 'derives'; // 派生层：派生规格节点→派生产物

export interface GraphNode {
  id: string;
  type: NodeType;
  phase: number;
  title: string;
  summary: string;
  sourceChunk?: string;
  sourceArtifact?: string;
  attributes?: Record<string, unknown>;
  /** 治理类子系统标记（如 S08），governs 边源须此标记为 true（flat 可选，非嵌套） */
  governance?: boolean;
  /** 派生规格节点标记（如 S11），derives 边源须此标记为 true（flat 可选，非嵌套） */
  derivationProduct?: boolean;
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
  dataflowViolations: DataflowViolations;
  boundary: BoundaryInfo;
  violations: string[];
}

// ==================== 模块级常量 ====================

/** 业务节点类型集合（信息流校验关注的生产/消费节点） */
const BUSINESS_TYPES = new Set<NodeType>(['REQ', 'SD', 'INTF', 'DD']);

/** 边界节点类型集合（豁免系统层级树根候选 / 死模块判定） */
const BOUNDARY_TYPES = new Set<NodeType>(['EXT-IN', 'EXT-OUT']);

/**
 * 系统层级树层级映射（graph-guide §3）：
 *   L0=REQ（系统根）→ L1=SD（子系统根）→ L2=INTF（接口根）→ L3=DD（详细设计）
 * parent 边方向 父→子，须满足 子 Level = 父 Level + 1（单调递增）。
 */
const LEVEL_MAP: Record<string, number> = {
  REQ: 0,
  SD: 1,
  INTF: 2,
  DD: 3,
};

/**
 * DFS 三色染色检测 parent 边环（零根场景，graph-guide §3 规则 5）。
 * 颜色：0=白（未访问）/ 1=灰（栈中）/ 2=黑（已完成）；发现灰边（回边）即报环。
 */
function detectParentCycle(
  edges: GraphEdge[],
  nodeIds: Set<string>,
  violations: string[],
): void {
  const color = new Map<string, number>();
  for (const id of nodeIds) color.set(id, 0);
  const parentAdj = new Map<string, string[]>();
  for (const id of nodeIds) parentAdj.set(id, []);
  for (const e of edges) {
    if (e.type === 'parent' && nodeIds.has(e.from) && nodeIds.has(e.to)) {
      parentAdj.get(e.from)!.push(e.to);
    }
  }
  let cycleFound = false;
  const dfs = (u: string): void => {
    if (cycleFound) return;
    color.set(u, 1);
    for (const v of parentAdj.get(u) ?? []) {
      const c = color.get(v) ?? 0;
      if (c === 1) {
        cycleFound = true;
        return;
      }
      if (c === 0) dfs(v);
      if (cycleFound) return;
    }
    color.set(u, 2);
  };
  for (const id of nodeIds) {
    if (color.get(id) === 0) {
      dfs(id);
      if (cycleFound) break;
    }
  }
  if (cycleFound) {
    violations.push('环检测失败：parent 边存在环，无法确定系统根');
  }
}

// ==================== 校验入口 ====================

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
    dataflowViolations: {
      blackHoles: [],
      miracles: [],
      deadModules: [],
    },
    boundary: { extIn: 0, extOut: 0, complete: false },
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

  // ============ 系统层级树校验（graph-guide §3）============
  // 节点查找表（供层级单调 / 横切边校验使用）
  const nodeMap = new Map<string, GraphNode>();
  for (const n of g.nodes) nodeMap.set(n.id, n);

  // --- §3 规则 1-2：单根校验（根候选 = parent 入边为 0 的节点，排除边界节点）---
  const rootCandidates: GraphNode[] = [];
  for (const n of g.nodes) {
    if (BOUNDARY_TYPES.has(n.type)) continue;
    const hasParentIn = g.edges.some(e => e.type === 'parent' && e.to === n.id);
    if (!hasParentIn) rootCandidates.push(n);
  }
  const reqRoots = rootCandidates.filter(n => n.type === 'REQ');
  const nonReqRoots = rootCandidates.filter(n => n.type !== 'REQ');

  result.roots = reqRoots.map(n => n.id);

  if (nonReqRoots.length > 0) {
    result.violations.push(
      `单根校验失败：根候选含非 REQ 节点: ${nonReqRoots.map(n => n.id).join(', ')}（根必须是系统 REQ 节点）`,
    );
  }

  let singleRoot: GraphNode | null = null;
  if (reqRoots.length === 0) {
    // §3 规则 5：零根场景，报缺根并转入环检测
    result.violations.push('单根校验失败：缺少 REQ 系统根，可能存在 parent 边环');
    detectParentCycle(g.edges, nodeIds, result.violations);
  } else if (reqRoots.length > 1) {
    result.violations.push(
      `单根校验失败：存在 ${reqRoots.length} 个 REQ 根，多根违反：${reqRoots.map(n => n.id).join(', ')}`,
    );
  } else {
    singleRoot = reqRoots[0];
  }

  // --- §3 规则 4：orphan BFS（从唯一根出发，经 parent 边可达性）---
  if (singleRoot) {
    const reachable = new Set<string>([singleRoot.id]);
    const queue = [singleRoot.id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const e of g.edges) {
        if (e.type === 'parent' && e.from === cur && !reachable.has(e.to)) {
          reachable.add(e.to);
          queue.push(e.to);
        }
      }
    }
    for (const n of g.nodes) {
      if (BOUNDARY_TYPES.has(n.type)) continue;
      if (!reachable.has(n.id)) result.orphans.push(n.id);
    }
    if (result.orphans.length > 0) {
      result.violations.push(
        `orphan 校验失败：以下节点无法从根 ${singleRoot.id} 经 parent 边追溯: ${result.orphans.join(', ')}`,
      );
    }
  }

  // --- §3 规则 6：父唯一性校验（非根节点 parent 入边数 ≤ 1）---
  const parentInCount = new Map<string, number>();
  for (const id of nodeIds) parentInCount.set(id, 0);
  for (const e of g.edges) {
    if (e.type === 'parent' && nodeIds.has(e.to)) {
      parentInCount.set(e.to, (parentInCount.get(e.to) ?? 0) + 1);
    }
  }
  for (const [id, cnt] of parentInCount) {
    if (cnt > 1) result.multiParent.push(id);
  }
  if (result.multiParent.length > 0) {
    result.violations.push(
      `父唯一性校验失败：以下节点有多条 parent 入边：${result.multiParent.join(', ')}`,
    );
  }

  // --- §3 规则 3：层级单调校验（parent 边 子 Level = 父 Level + 1）---
  for (const e of g.edges) {
    if (e.type !== 'parent') continue;
    const fromNode = nodeMap.get(e.from);
    const toNode = nodeMap.get(e.to);
    if (!fromNode || !toNode) continue;
    const fromLevel = LEVEL_MAP[fromNode.type];
    const toLevel = LEVEL_MAP[toNode.type];
    if (fromLevel === undefined || toLevel === undefined) continue; // 边界节点不在层级树
    if (toLevel !== fromLevel + 1) {
      result.violations.push(
        `层级单调校验失败：parent 边 ${e.from}(${fromNode.type})→${e.to}(${toNode.type}) 非相邻层级（应为 L${fromLevel}→L${fromLevel + 1}）`,
      );
    }
  }

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

  // ============ 多层图谱横切边校验（graph-guide §7 第 5/6/7 层）============
  // 治理层（governs）：源须 governance===true 的治理类子系统；目标须存在
  // 协作层（collaborates-with）：目标须存在（单条边语义双向，不要求 B→A）
  // 派生层（derives）：源须 derivationProduct===true 的派生规格节点；目标须存在
  for (const e of g.edges) {
    if (e.type === 'governs') {
      const src = nodeMap.get(e.from);
      if (src && src.governance !== true) {
        result.violations.push(
          `横切边校验失败：governs 边 ${e.from}→${e.to} 源非治理类子系统（须 governance===true）`,
        );
      }
      if (!nodeIds.has(e.to)) {
        result.violations.push(
          `横切边校验失败：governs 边 ${e.from}→${e.to} 目标节点不存在`,
        );
      }
    } else if (e.type === 'collaborates-with') {
      if (!nodeIds.has(e.to)) {
        result.violations.push(
          `横切边校验失败：collaborates-with 边 ${e.from}→${e.to} 目标节点不存在`,
        );
      }
    } else if (e.type === 'derives') {
      const src = nodeMap.get(e.from);
      if (src && src.derivationProduct !== true) {
        result.violations.push(
          `横切边校验失败：derives 边 ${e.from}→${e.to} 源非派生规格节点（须 derivationProduct===true）`,
        );
      }
      if (!nodeIds.has(e.to)) {
        result.violations.push(
          `横切边校验失败：derives 边 ${e.from}→${e.to} 目标节点不存在`,
        );
      }
    }
  }

  // ============ 信息流校验（graph-guide §7 第 4 层：黑洞 / 奇迹 / 死模块 + 边界完整性）============
  // produces 的 {from,to} 表信息流方向：to=n 即流入 n，from=n 即流出 n（consumes 已移除 D21）
  const flowInCount = new Map<string, number>();
  const flowOutCount = new Map<string, number>();
  for (const id of nodeIds) {
    flowInCount.set(id, 0);
    flowOutCount.set(id, 0);
  }
  for (const e of g.edges) {
    if (e.type === 'produces') {
      if (nodeIds.has(e.to)) flowInCount.set(e.to, (flowInCount.get(e.to) ?? 0) + 1);
      if (nodeIds.has(e.from)) flowOutCount.set(e.from, (flowOutCount.get(e.from) ?? 0) + 1);
    }
  }

  for (const n of g.nodes) {
    if (!BUSINESS_TYPES.has(n.type)) continue;
    if ((n.phase ?? 1) > phase) continue;
    // §3 规则 6：根节点豁免死模块（系统根是系统对外代理，in=0 ∧ out=0 不判死模块）
    if (singleRoot && n.id === singleRoot.id) continue;
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
  result.boundary.extIn = g.nodes.filter(n => n.type === 'EXT-IN').length;
  result.boundary.extOut = g.nodes.filter(n => n.type === 'EXT-OUT').length;
  result.boundary.complete = result.boundary.extIn >= 1 && result.boundary.extOut >= 1;
  if (result.boundary.extIn < 1) {
    result.violations.push('信息流校验失败：缺少 EXT-IN 边界源（系统不能凭空产生信息）');
  }
  if (result.boundary.extOut < 1) {
    result.violations.push('信息流校验失败：缺少 EXT-OUT 边界汇（信息不能进入黑洞消失）');
  }

  // 汇总 passed
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
}
