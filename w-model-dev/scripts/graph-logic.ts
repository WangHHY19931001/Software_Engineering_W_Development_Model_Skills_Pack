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

import { validateBySchema } from './schema-loader.js';

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
  | 'derives' // 派生层：派生规格节点→派生产物
  // 四维识别·维度1/3 扩展边（phase=1 时启用校验）：
  | 'precedes' // 时序层：REQ→REQ 时序先于
  | 'conflicts-with' // 冲突层：REQ→REQ 冲突/互斥（单向写入，语义双向）
  | 'cross-cuts'; // 横切层：NFR/CON→REQ 横切治理

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
  /** REQ 内部层级：1=domain 2=module 3=feature 4=acceptance（REQ 强制必填，无降级） */
  level?: number;
  /** 需求优先级：P0=必须 P1=应该 P2=可以 P3=不会（可选） */
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
  /** 所属 REQ-group ID（level=1 REQ 自身为 group 无此字段；level≥2 须指向 level=1 祖先） */
  reqGroup?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: EdgeType;
  /** 语义来源标记：从设计文档实体派生的边此字段非空（语义来源占比校验用，第24轮 P2 新增） */
  sourceArtifact?: string;
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

export interface ReqHierarchy {
  groups: string[];
  maxDepth: number;
  levelDistribution: Record<number, number>;
  orphanReqs: string[];
  multiParentReqs: string[];
  levelMonotonicViolations: Array<{ from: string; to: string; fromLevel: number; toLevel: number }>;
  missingLevelReqs: string[];
}

export interface CrossLogic {
  dependsOnCycles: string[][];
  precedesCycles: string[][];
  conflictsAsymmetric: string[];
  crossCutsSourceTypeViolations: string[];
  crossCutsTargetTypeViolations: string[];
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
  /** 警告列表（不影响 passed 判定，第24轮 P2 新增：边数下限 + 语义来源占比） */
  warnings?: string[];
  /** REQ 层级树信息（四维·维度1，phase=1 时填充） */
  reqHierarchy?: ReqHierarchy;
  /** 交叉逻辑信息（四维·维度3，phase=1 时填充） */
  crossLogic?: CrossLogic;
}

// ==================== 模块级常量 ====================

/** 业务节点类型集合（信息流校验关注的生产/消费节点） */
const BUSINESS_TYPES = new Set<NodeType>(['REQ', 'SD', 'INTF', 'DD']);

/** 边界节点类型集合（豁免系统层级树根候选 / 死模块判定） */
const BOUNDARY_TYPES = new Set<NodeType>(['EXT-IN', 'EXT-OUT']);

/**
 * 判断节点是否为 NFR/CON 横切关注点（通过 ID 前缀识别）。
 * NFR/CON 节点在 graph.json 中 type 仍为 REQ（schema 不支持 NFR/CON 类型），
 * 但不参与 REQ 层级树（R1-R4）校验，也不作为系统根候选。
 */
function isNfrConNode(node: GraphNode): boolean {
  return node.id.startsWith('NFR-') || node.id.startsWith('CON-');
}

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

  // 警告列表（不影响 passed 判定，第24轮 P2 新增：边数下限 + 语义来源占比）
  const warnings: string[] = [];

  // 输入校验
  if (!graph || typeof graph !== 'object') {
    result.violations.push('graph 必须为对象');
    return result;
  }

  // === Schema 前置校验（借鉴点 2 — 借鉴 drawio-skill/styles/schema.json） ===
  // 结构性约束（additionalProperties / required / type）由 schema 拦截，
  // 通过后才进入下方业务规则校验（连通性 / 层级树 / 信息流等）。
  const schemaResult = validateBySchema('graph', graph);
  if (!schemaResult.valid) {
    for (const m of schemaResult.errorMessages) {
      result.violations.push(`[schema] ${m}`);
    }
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

  // 出/入边索引（供 rootCandidates / orphan BFS / 追溯校验 / cross-cuts 查找使用）
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
  // conflicts-with 对称判定索引（只收录实际存在的边，反查 `${to}->${from}` 判对称）
  const conflictsAdj = new Set<string>();
  for (const e of g.edges) {
    if (e.type === 'conflicts-with') conflictsAdj.add(`${e.from}->${e.to}`);
  }

  // --- §3 规则 1-2：单根校验（根候选 = parent 入边为 0 的节点，排除边界节点）---
  // 四维识别：phase=1 纯 REQ 图（无 SD/INTF/DD/EXT-IN/EXT-OUT）启用多 group 模式，
  // 多个 level=1 REQ 视为 group 候选，允许多根（R1 规则）；NFR/CON 节点排除根候选。
  const isPureReqGraph = g.nodes.length > 0 && g.nodes.every(n => n.type === 'REQ');
  const isPhase1PureReq = phase === 1 && isPureReqGraph;

  const rootCandidates: GraphNode[] = [];
  for (const n of g.nodes) {
    if (BOUNDARY_TYPES.has(n.type)) continue;
    const hasParentIn = inEdges.get(n.id)?.some(e => e.type === 'parent') ?? false;
    if (!hasParentIn) rootCandidates.push(n);
  }
  const reqRoots = rootCandidates.filter(n => n.type === 'REQ' && !isNfrConNode(n));
  const nonReqRoots = rootCandidates.filter(n => n.type !== 'REQ');

  result.roots = reqRoots.map(n => n.id);

  if (nonReqRoots.length > 0) {
    result.violations.push(
      `单根校验失败：根候选含非 REQ 节点: ${nonReqRoots.map(n => n.id).join(', ')}（根必须是系统 REQ 节点）`,
    );
  }

  let singleRoot: GraphNode | null = null;
  /** 多 group 模式下的 level=1 根列表（phase=1 纯 REQ 图允许多 group） */
  let multiGroupRoots: GraphNode[] = [];

  if (isPhase1PureReq) {
    // 四维识别：phase=1 纯 REQ 图——多 group 模式
    if (reqRoots.length === 0) {
      // 零根：可能是 parent 边环，检测环但不报"缺根"（R4 处理）
      detectParentCycle(g.edges, nodeIds, result.violations);
    } else {
      // 多个 level=1 REQ 视为 group 候选，不报多根违反
      multiGroupRoots = reqRoots.filter(n => n.level === 1);
      if (multiGroupRoots.length >= 1) {
        singleRoot = multiGroupRoots[0] ?? null;
      }
    }
  } else {
    // 非 phase=1 纯 REQ 图：保持现有单根校验
    if (reqRoots.length === 0) {
      // §3 规则 5：零根场景，报缺根并转入环检测
      result.violations.push('单根校验失败：缺少 REQ 系统根，可能存在 parent 边环');
      detectParentCycle(g.edges, nodeIds, result.violations);
    } else if (reqRoots.length > 1) {
      result.violations.push(
        `单根校验失败：存在 ${reqRoots.length} 个 REQ 根，多根违反：${reqRoots.map(n => n.id).join(', ')}`,
      );
    } else {
      singleRoot = reqRoots[0] ?? null;
    }
  }

  // --- §3 规则 4：orphan BFS（从根出发，经 parent 边可达性）---
  // 多 group 模式：从所有 level=1 根出发 BFS；单根模式：从 singleRoot 出发
  const bfsStartNodes = (isPhase1PureReq && multiGroupRoots.length > 0)
    ? multiGroupRoots.map(n => n.id)
    : (singleRoot ? [singleRoot.id] : []);

  if (bfsStartNodes.length > 0) {
    const reachable = new Set<string>(bfsStartNodes);
    const queue = [...bfsStartNodes];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const e of outEdges.get(cur) ?? []) {
        if (e.type === 'parent' && !reachable.has(e.to)) {
          reachable.add(e.to);
          queue.push(e.to);
        }
      }
    }
    for (const n of g.nodes) {
      if (BOUNDARY_TYPES.has(n.type)) continue;
      if (isNfrConNode(n)) continue; // NFR/CON 横切节点不参与 orphan 校验
      if (!reachable.has(n.id)) result.orphans.push(n.id);
    }
    if (result.orphans.length > 0) {
      const rootLabel = bfsStartNodes.length === 1 ? bfsStartNodes[0]! : bfsStartNodes.join(', ');
      result.violations.push(
        `orphan 校验失败：以下节点无法从根 ${rootLabel} 经 parent 边追溯: ${result.orphans.join(', ')}`,
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

  // --- §3 规则 3：层级单调校验（parent 边 跨类型 子 Level = 父 Level + 1；同类型内部分解豁免）---
  // 同类型 parent 边（REQ→REQ 需求分解 / SD→SD 子系统分解 / INTF→INTF / DD→DD）属内部分解层级，
  // 不触发跨类型层级单调校验；仅跨类型 parent 边（REQ→SD / SD→INTF / INTF→DD）须满足 子 Level = 父 Level + 1。
  for (const e of g.edges) {
    if (e.type !== 'parent') continue;
    const fromNode = nodeMap.get(e.from);
    const toNode = nodeMap.get(e.to);
    if (!fromNode || !toNode) continue;
    const fromLevel = LEVEL_MAP[fromNode.type];
    const toLevel = LEVEL_MAP[toNode.type];
    if (fromLevel === undefined || toLevel === undefined) continue; // 边界节点不在层级树
    if (fromNode.type === toNode.type) continue; // 同类型内部分解豁免（如 REQ→REQ 系统根→需求模块）
    if (toLevel !== fromLevel + 1) {
      result.violations.push(
        `层级单调校验失败：parent 边 ${e.from}(${fromNode.type})→${e.to}(${toNode.type}) 非相邻层级（应为 L${fromLevel}→L${fromLevel + 1}）`,
      );
    }
  }

  // 阶段递进追溯检查（"门禁同步收敛"的核心）
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
  // 四维识别：phase=1 纯 REQ 图（需求层级树）无 produces 边也无 EXT-IN/EXT-OUT 边界节点，
  // 信息流校验不适用，整体跳过（dataflowOk 视为 true，boundary 视为 complete）。
  if (!isPhase1PureReq) {
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
      // §4.6：根节点豁免死模块（系统根是系统对外代理，in=0 ∧ out=0 不判死模块；不豁免黑洞/奇迹）
      const isRoot = singleRoot !== null && n.id === singleRoot.id;
      const inFlow = flowInCount.get(n.id) ?? 0;
      const outFlow = flowOutCount.get(n.id) ?? 0;
      if (inFlow === 0 && outFlow === 0) {
        if (!isRoot) {
          result.dataflowViolations.deadModules.push(n.id);
          result.violations.push(`信息流校验失败：死模块 ${n.id}（无信息流经，in=0 out=0）`);
        }
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
  } else {
    // 纯 REQ 图：boundary 标记为 complete（不适用而非不完整）
    result.boundary.complete = true;
  }

  // ==================== 四维识别校验（phase=1 时启用）====================
  if (phase === 1) {
    // 四维识别：NFR/CON 节点（通过 ID 前缀识别，type 仍为 REQ）不参与 R1-R4 层级树校验
    const reqNodes = g.nodes.filter(n => n.type === 'REQ' && !isNfrConNode(n));
    const reqIds = new Set(reqNodes.map(n => n.id));

    // R1-R4: REQ 层级树校验
    const missingLevelReqs = reqNodes.filter(n => n.level === undefined).map(n => n.id);
    if (missingLevelReqs.length > 0) {
      result.violations.push(`R1-R4 层级校验失败：REQ 节点缺 level 字段（强制必填，无降级）：${missingLevelReqs.join(', ')}`);
    }

    // R11: level 正整数校验（[21.0.0] 新增）
    const nonPositiveLevelReqs = reqNodes
      .filter(n => n.level !== undefined && (!Number.isInteger(n.level) || n.level < 1))
      .map(n => n.id);
    if (nonPositiveLevelReqs.length > 0) {
      result.violations.push(`R11 level 正整数校验失败：REQ 节点 level 非正整数：${nonPositiveLevelReqs.join(', ')}`);
    }

    const level1Reqs = reqNodes.filter(n => n.level === 1).map(n => n.id);
    const reqParentEdges = g.edges.filter(e => e.type === 'parent' && reqIds.has(e.from) && reqIds.has(e.to));

    // R2: parent 唯一
    const parentInCount: Record<string, number> = {};
    for (const e of reqParentEdges) {
      parentInCount[e.to] = (parentInCount[e.to] ?? 0) + 1;
    }
    const orphanReqs = reqNodes.filter(n => (n.level ?? 0) >= 2 && (parentInCount[n.id] ?? 0) === 0).map(n => n.id);
    const multiParentReqs = reqNodes.filter(n => (parentInCount[n.id] ?? 0) > 1).map(n => n.id);
    if (orphanReqs.length > 0) {
      result.violations.push(`R2 父唯一性校验失败：level≥2 REQ 缺 REQ→REQ parent 入边（orphan）：${orphanReqs.join(', ')}`);
    }
    if (multiParentReqs.length > 0) {
      result.violations.push(`R2 父唯一性校验失败：REQ 有多条 REQ→REQ parent 入边（multiParent）：${multiParentReqs.join(', ')}`);
    }

    // R3: level 单调
    const levelMonotonicViolations: Array<{ from: string; to: string; fromLevel: number; toLevel: number }> = [];
    const nodeLevelMap = new Map(reqNodes.map(n => [n.id, n.level ?? 0]));
    for (const e of reqParentEdges) {
      const fromLevel = nodeLevelMap.get(e.from) ?? 0;
      const toLevel = nodeLevelMap.get(e.to) ?? 0;
      if (toLevel !== fromLevel + 1) {
        levelMonotonicViolations.push({ from: e.from, to: e.to, fromLevel, toLevel });
      }
    }
    if (levelMonotonicViolations.length > 0) {
      result.violations.push(`R3 level 单调校验失败：REQ→REQ parent 边须满足 子level=父level+1，违反：${levelMonotonicViolations.map(v => `${v.from}(${v.fromLevel})→${v.to}(${v.toLevel})`).join(', ')}`);
    }

    // R4: REQ-group 非空
    if (level1Reqs.length === 0 && reqNodes.length >= 5) {
      result.violations.push(`R4 REQ-group 非空校验失败：REQ 总数≥5 但无 level=1 REQ（无候选子系统）`);
    }

    // R5: depends-on 与 precedes 无环
    const detectCycle = (edgeType: 'depends-on' | 'precedes'): string[][] => {
      const adj: Record<string, string[]> = {};
      for (const e of g.edges ?? []) {
        if (e.type === edgeType) {
          (adj[e.from] ??= []).push(e.to);
        }
      }
      const cycles: string[][] = [];
      const visited = new Set<string>();
      const stack = new Set<string>();
      const path: string[] = [];
      const dfs = (node: string): void => {
        if (stack.has(node)) {
          const cycleStart = path.indexOf(node);
          cycles.push([...path.slice(cycleStart), node]);
          return;
        }
        if (visited.has(node)) return;
        visited.add(node);
        stack.add(node);
        path.push(node);
        for (const next of adj[node] ?? []) dfs(next);
        path.pop();
        stack.delete(node);
      };
      for (const node of Object.keys(adj)) dfs(node);
      return cycles;
    };

    const dependsOnCycles = detectCycle('depends-on');
    const precedesCycles = detectCycle('precedes');
    if (dependsOnCycles.length > 0) {
      result.violations.push(`R5 依赖无环校验失败：depends-on 子图有环：${dependsOnCycles.map(c => c.join('→')).join('；')}`);
    }
    if (precedesCycles.length > 0) {
      result.violations.push(`R5 时序无环校验失败：precedes 子图有环：${precedesCycles.map(c => c.join('→')).join('；')}`);
    }

    // R6: 交叉边对称性与源类型
    const conflictsAsymmetric: string[] = [];
    const crossCutsSourceTypeViolations: string[] = [];
    const crossCutsTargetTypeViolations: string[] = [];
    for (const e of g.edges) {
      if (e.type === 'conflicts-with') {
        const hasReverse = conflictsAdj.has(`${e.to}->${e.from}`);
        if (!hasReverse) conflictsAsymmetric.push(`${e.from}→${e.to}`);
      }
      if (e.type === 'cross-cuts') {
        const targetNode = nodeMap.get(e.to);
        if (targetNode && targetNode.type !== 'REQ') {
          crossCutsTargetTypeViolations.push(`${e.from}→${e.to}（目标 ${targetNode.type} 非 REQ）`);
        }
      }
      if (e.type === 'precedes') {
        const sourceNode = g.nodes.find(n => n.id === e.from);
        const targetNode = g.nodes.find(n => n.id === e.to);
        if (sourceNode && sourceNode.type !== 'REQ') {
          result.violations.push(`R6 precedes 源类型校验失败：${e.from}（${sourceNode.type}）非 REQ`);
        }
        if (targetNode && targetNode.type !== 'REQ') {
          result.violations.push(`R6 precedes 目标类型校验失败：${e.to}（${targetNode.type}）非 REQ`);
        }
      }
    }
    // conflicts-with 非对称仅记录到 crossLogic 字段（warning，不 fail）—— 设计文档 §3.3 R6
    if (crossCutsTargetTypeViolations.length > 0) {
      result.violations.push(`R6 cross-cuts 目标类型校验失败：${crossCutsTargetTypeViolations.join('；')}`);
    }

    // 填充 reqHierarchy 与 crossLogic
    const levelDistribution: Record<number, number> = {};
    for (const n of reqNodes) {
      const lv = n.level ?? 0;
      levelDistribution[lv] = (levelDistribution[lv] ?? 0) + 1;
    }
    result.reqHierarchy = {
      groups: level1Reqs,
      maxDepth: Math.max(...reqNodes.map(n => n.level ?? 0), 0),
      levelDistribution,
      orphanReqs,
      multiParentReqs,
      levelMonotonicViolations,
      missingLevelReqs,
    };
    result.crossLogic = {
      dependsOnCycles,
      precedesCycles,
      conflictsAsymmetric,
      crossCutsSourceTypeViolations,
      crossCutsTargetTypeViolations,
    };
  }

  // ==================== 边数下限 + 语义来源占比校验（第24轮 P2 新增） ====================
  const nodeCount = g.nodes.length;
  const edgeCount = g.edges.length;
  const minEdgeCount = nodeCount * 3;

  // 检查 small-project exemption
  const hasSmallProjectExemption = g.nodes.some(n => n?.attributes && typeof n.attributes === 'object' && 'smallProjectExemption' in n.attributes && n.attributes.smallProjectExemption === true);

  if (!hasSmallProjectExemption && edgeCount < minEdgeCount) {
    warnings.push(`边数下限警告：当前边数 ${edgeCount} < 节点数 × 3 = ${minEdgeCount}（可能存在孤立节点或边缺失）`);
  }

  if (!hasSmallProjectExemption && edgeCount > 0) {
    const semanticEdges = g.edges.filter(e => e && typeof (e as GraphEdge).sourceArtifact === 'string' && (e as GraphEdge).sourceArtifact!.trim() !== '').length;
    const semanticRatio = semanticEdges / edgeCount;
    if (semanticRatio < 0.8) {
      warnings.push(`语义来源占比警告：语义来源边占比 ${(semanticRatio * 100).toFixed(1)}% < 80%（可能存在过多人工补丁边）`);
    }
  }

  // 汇总 passed
  const tv = result.traceabilityViolations;
  const traceabilityOk =
    tv.SD_without_implements === 0 &&
    tv.INTF_without_defines === 0 &&
    tv.DD_without_realizes === 0;
  const dv = result.dataflowViolations;
  // 四维识别：phase=1 纯 REQ 图跳过信息流校验，dataflowOk 直接为 true
  const dataflowOk = isPhase1PureReq ? true : (
    dv.blackHoles.length === 0 &&
    dv.miracles.length === 0 &&
    dv.deadModules.length === 0 &&
    result.boundary.complete
  );
  // 四维识别：phase=1 纯 REQ 图允许多个 level=1 REQ 根（多 group 模式）
  const rootsOk = isPhase1PureReq ? result.roots.length >= 1 : result.roots.length === 1;
  result.passed =
    result.connectedComponents === 1 &&
    result.isolatedNodes.length === 0 &&
    rootsOk &&
    result.orphans.length === 0 &&
    result.multiParent.length === 0 &&
    traceabilityOk &&
    dataflowOk &&
    result.violations.length === 0;
  result.warnings = warnings;
  return result;
}

/**
 * 重新计算 passed（供 CLI 层在 violations 变更后调用，保持与 checkRequirementGraph 一致）。
 * @param result 已填充的 GraphCheckResult（violations 可能已变更）
 * @param isPhase1PureReq 是否为 phase=1 纯 REQ 图（多 group 模式允许 roots.length >= 1）
 */
export function recalculatePassed(result: GraphCheckResult, isPhase1PureReq: boolean): void {
  const tv = result.traceabilityViolations;
  const traceabilityOk =
    tv.SD_without_implements === 0 &&
    tv.INTF_without_defines === 0 &&
    tv.DD_without_realizes === 0;
  const dv = result.dataflowViolations;
  const dataflowOk = isPhase1PureReq ? true : (
    dv.blackHoles.length === 0 &&
    dv.miracles.length === 0 &&
    dv.deadModules.length === 0 &&
    result.boundary.complete);
  const rootsOk = isPhase1PureReq ? result.roots.length >= 1 : result.roots.length === 1;
  result.passed =
    result.connectedComponents === 1 &&
    result.isolatedNodes.length === 0 &&
    rootsOk &&
    result.orphans.length === 0 &&
    result.multiParent.length === 0 &&
    traceabilityOk &&
    dataflowOk &&
    result.violations.length === 0;
}

// ==================== R7/R8 需求规格产物校验（第 37 轮） ====================
// 独立于 checkRequirementGraph（其接收 graph.json 结构）：
// 本组函数接收 markdown 纯文本，校验 Phase 1 需求规格独立产物
//（docs/phase1-requirements/：requirement-spec.md / traceability-matrix.md / uml-modeling.md）。
// 仍保持纯函数、无 IO 设计原则，文件读取由 CLI 层负责。

/** 解析 markdown 表格为对象数组（首行作表头；跳过 |---| 分隔行） */
export function parseMarkdownTable(md: string): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  let header: string[] = [];
  for (const line of md.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue; // 分隔行
    if (header.length === 0) { header = cells; continue; }
    const rec: Record<string, string> = {};
    cells.forEach((c, i) => { if (header[i]) rec[header[i]] = c; });
    rows.push(rec);
  }
  return rows;
}

/** 校验 mermaid 代码块定界行配平；返回配平布尔 */
export function countMermaidBlocks(md: string): { pairs: number; balanced: boolean } {
  const lines = md.split(/\r?\n/);
  let inBlock = false;
  let pairs = 0;
  let opens = 0;
  for (const line of lines) {
    const t = line.trim();
    if (t === '```mermaid') {
      if (inBlock) { opens++; continue; }
      inBlock = true;
      opens++;
    } else if (t === '```' && inBlock) {
      inBlock = false;
      pairs++;
    }
  }
  return { pairs, balanced: !inBlock && opens === pairs };
}

/** 从 markdown 引用块提取 `[name](./file.md)` 中的 file.md 列表 */
export function extractRefTargets(md: string): string[] {
  const out: string[] = [];
  const re = /\[[\w.-]+\.md\]\(\.\/([\w.-]+\.md)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) out.push(m[1]!);
  return out;
}

export interface RequirementSpecEnhanceViolations {
  r7: string[];
  r8: string[];
}

/** R7 追踪矩阵一致性 + R8 UML mermaid 配平（第 37 轮）
 *  @param traceMatrixContent  traceability-matrix.md 内容
 *  @param specContent         主规格 requirement-spec.md 内容（用于校验 §4 层级树节存在）
 *  @param umlContent          uml-modeling.md 内容
 *  @param rtmRequirementIds   RTM 需求号集合（可选）
 */
export function checkRequirementSpecEnhance(
  traceMatrixContent: string,
  specContent: string,
  umlContent: string,
  rtmRequirementIds?: Set<string>,
): RequirementSpecEnhanceViolations {
  const v: RequirementSpecEnhanceViolations = { r7: [], r8: [] };
  const mb = countMermaidBlocks(umlContent);
  if (!mb.balanced) {
    v.r8.push(`R8 UML mermaid 块配平失败：pairs=${mb.pairs} 但定界未配对`);
  }
  if (mb.pairs === 0) {
    v.r8.push('R8 UML mermaid 块缺失：uml-modeling.md 无 ```mermaid 代码块');
  }
  const hasSection4 = /^##\s+4[.\s]/m.test(specContent);
  if (!hasSection4) v.r7.push('R7 追踪矩阵一致性失败：主规格缺 §4 层级树节');
  const rows = parseMarkdownTable(traceMatrixContent);
  if (rows.length === 0) {
    v.r7.push('R7 追踪矩阵为空：traceability-matrix.md 无数据行');
    return v;
  }
  for (const row of rows) {
    const id = row['需求号'] ?? '';
    const loc = row['候选落点§'] ?? '';
    const acpt = row['验收关联'] ?? '';
    if (id && !/^(REQ|NFR)-/.test(id)) v.r7.push(`R7 需求号格式失败：${id}`);
    if (loc && !/^§?\s*\d/.test(loc)) v.r7.push(`R7 候选落点§ 引用失败：${id} → ${loc}`);
    if (acpt && !/UAT-|§/.test(acpt)) v.r7.push(`R7 验收关联失败：${id} → ${acpt}`);
    if (rtmRequirementIds && id && !rtmRequirementIds.has(id)) v.r7.push(`R7 RTM 登记缺失：${id}`);
  }
  return v;
}
