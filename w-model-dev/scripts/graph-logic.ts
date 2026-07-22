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

export type NodeType = 'REQ' | 'SD' | 'INTF' | 'DD' | 'EXT-IN' | 'EXT-OUT';
export type EdgeType =
  | 'parent'
  | 'depends-on'
  | 'implements'
  | 'defines'
  | 'realizes'
  | 'produces'
  | 'consumes';

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

  // 单根检查：统计 parent 入边为 0 的节点
  const nodeTypeById = new Map<string, string>();
  for (const n of g.nodes) nodeTypeById.set(n.id, n.type as string);
  const isBoundary = (id: string): boolean => {
    const t = nodeTypeById.get(id);
    return t === 'EXT-IN' || t === 'EXT-OUT';
  };
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
