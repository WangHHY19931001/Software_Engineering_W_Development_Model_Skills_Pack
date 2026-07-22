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
