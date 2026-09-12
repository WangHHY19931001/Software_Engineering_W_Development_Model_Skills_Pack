import { validateBySchema } from '../infrastructure/schema-loader.js';

export interface IcebergFinding {
  findingId: string;
  severity: 'Critical' | 'Required' | 'Optional';
  category:
    | 'same-root-cause-spread'
    | 'same-defect-class'
    | 'fix-induced-regression'
    | 'adjacent-logic'
    | 'coverage-gap'
    | 'cross-artifact-inconsistency';
  location: string;
  description: string;
  evidence: string;
  hypothesis: string;
  relatedFixedPoint: string;
}

export interface IcebergSweepReport {
  reportId: string;
  phase: string;
  triggerType: 'ICEBERG-A' | 'ICEBERG-B';
  icebergRound: number;
  sweptAt: string;
  sweptBy: string;
  线索来源: {
    reworkHintsHistory: string[];
    fixedPoints: string[];
    previousFindings: string[];
  };
  newFindings: IcebergFinding[];
  sweepCoverage: {
    sweptArtifacts: string[];
    sweptDimensions: ('completeness' | 'reliability' | 'security')[];
    /** 本阶段不参与的视角（显式声明，禁止静默跳过 → R7） */
    absentViews?: string[];
  };
  summary: string;
  passed: boolean;
}

/** 冰山扫掠的四个候选视角（graph/TLA/RTM 为阶段 1-4 平权三视角，scope 为阶段 5-8 的变更范围视角）。 */
export type IcebergView = 'graph' | 'tla' | 'rtm' | 'scope';

/**
 * 各阶段冰山扫掠的在场视角集合（D9：代码常量，非文档）。
 *
 * 写进文档会与实现漂移（先例：subagent-delegation.md 的计数漂移）；确定性判据的一部分。
 * 缺席者**不静默跳过**——必须由 R 显式记入 `sweepCoverage.absentViews`，由 R7 校验
 * （理由：`check-signature-chain.ts` R8 在找不到 `project.json` 时静默跳过，正是同类陷阱）。
 *
 * **取值经阶段文献核定**（规格 D23 / 任务 16）：`graph` 在阶段 2-8 全部在场——阶段 2-4
 * 缺 `--graph` 即 `ARG_INVALID`/exit 2（graph 是 D8 的数据源），阶段 5-8 亦以
 * `--graph=.w-model/ingestion/graph.json` 校验 D8 SD Coverage。故 5-8 含 graph；
 * 遗漏会使 graph↔rtm 的设计 ID 漂移在阶段 5-8 静默无人对账。
 */
export const ICEBERG_VIEW_PRESENCE: Record<number, readonly IcebergView[]> = {
  1: ['graph', 'rtm'],
  2: ['graph', 'tla', 'rtm'],
  3: ['graph', 'tla', 'rtm'],
  4: ['graph', 'tla', 'rtm'],
  5: ['graph', 'tla', 'rtm', 'scope'],
  6: ['graph', 'tla', 'rtm', 'scope'],
  7: ['graph', 'tla', 'rtm', 'scope'],
  8: ['graph', 'tla', 'rtm', 'scope'],
};

/**
 * 三视角对账的外部产物注入面（本文件不做 I/O；CLI 层读盘后注入，与 `graph-logic.ts`
 * 的 `GraphCheckExternalEvidence` 同一约定）。
 *
 * 为什么分母不经由报告字段传递（规格 D7）：让 R 自报"该扫多少"仍属自证，
 * 只是从"自报发现了什么"变成"自报该发现多少"——空声明与真扫完仍无法区分。
 * 故分母由 checker 从上游已放行产物实测。未注入即跳过 R6/R7/R8（纯单测无文件系统
 * 上下文；阶段早期上游产物缺失时不得误红，规格 §5）。
 *
 * 各视角的标识符口径（实施期核定，规格 §5 已登记该风险）：取三份产物共有的
 * **设计 ID 命名空间**——graph.json 节点 id / tla-manifest `designIds` /
 * rtm 行经 `designDoc` 解析出的设计 ID / change-scope 的 `changedFiles`。
 * 这是最窄的公共命名空间，差异因此指向真实缺口而非命名空间结构性噪声。
 */
export interface IcebergCheckExternalEvidence {
  /** 已落盘上游产物按视角独立算出的"应扫集合"；缺该键即该视角不在场 */
  viewSets?: Partial<Record<IcebergView, readonly string[]>>;
}

export interface IcebergSweepCheckResult {
  passed: boolean;
  reasons: string[];
  reportSummary: {
    reportId: string;
    triggerType: string;
    icebergRound: number;
    newFindingsCount: number;
    passed: boolean;
  };
}

const MAX_ICEBERG_ROUNDS = 5;

/** 从 `report.phase`（如 `phase3-outline`）解析阶段号；不可解析返回 undefined（不静默按 0 处理） */
export function parseIcebergPhase(phase: unknown): number | undefined {
  if (typeof phase !== 'string') return undefined;
  const m = /^phase([1-8])-/.exec(phase);
  if (!m) return undefined;
  return Number(m[1]);
}

/**
 * 设计 ID 提取（三视角公共命名空间）：SD-NNN / DD-NNN / INTF-NNN。
 *
 * 刻意不含 REQ/NFR/CON：需求命名空间只有 graph 与 rtm 视角有，TLA 侧只有设计 ID，
 * 混入会制造结构性差异（假阳性），违背"最窄公共命名空间"口径（规格 §5 的实施期核定项）。
 */
const DESIGN_ID_PATTERN = /\b(?:SD|DD|INTF)-[A-Z0-9]+(?:-\d+)*(?:\.\d+)*/g;

/** 从自由文本中提取设计 ID 集合（去重） */
export function extractDesignIds(text: string): string[] {
  return text.match(DESIGN_ID_PATTERN) ?? [];
}

/**
 * 各视角"应扫集合"的派生（纯函数；I/O 由 CLI 层完成后注入，D7：分母不由 R 声明）。
 *
 * 口径（实施期核定，规格 §5 已登记）：取三份产物共有的**设计 ID 命名空间**
 * （SD-NNN / DD-NNN / INTF-NNN）——
 *   - graph → graph.json 节点 id 中的设计 ID
 *   - tla   → tla-manifest.json `sdCoverage.coveredSdNodes`（已由 S-ingest-tla 从 .tla @designIds 回填）
 *   - rtm   → rtm.json 各行的 `designDoc` 引用中解析出的设计 ID
 *   - scope → change-scope 的 `changedFiles`（阶段 5-8，变更范围视角，非 ID 命名空间）
 *
 * 产物不存在或形状非法 → 该视角键**缺席**，不合成空集合：空集合会被 R6 当成"真的一致"
 * 从而放行，正是下一个"空即合规"。缺席由 R7 要求显式记入 `sweepCoverage.absentViews`。
 *
 * 在场判定以 `ICEBERG_VIEW_PRESENCE[phase]` 为准：即使产物在盘，不在场的视角也不派生。
 */
export function deriveViewSets(
  phase: number,
  artifacts: {
    graph?: unknown;
    tlaManifest?: unknown;
    rtm?: unknown;
    changeScope?: unknown;
  },
): Partial<Record<IcebergView, readonly string[]>> {
  const present = ICEBERG_VIEW_PRESENCE[phase] ?? [];
  const sets: Partial<Record<IcebergView, readonly string[]>> = {};
  if (present.includes('graph')) {
    const nodes = (artifacts.graph as { nodes?: unknown } | undefined)?.nodes;
    if (Array.isArray(nodes)) {
      const ids = new Set<string>();
      for (const n of nodes) {
        const id = (n as { id?: unknown })?.id;
        if (typeof id !== 'string') continue;
        for (const match of extractDesignIds(id)) ids.add(match);
      }
      sets.graph = [...ids];
    }
  }
  if (present.includes('tla')) {
    const covered = (artifacts.tlaManifest as { sdCoverage?: { coveredSdNodes?: unknown } } | undefined)?.sdCoverage
      ?.coveredSdNodes;
    if (Array.isArray(covered)) {
      sets.tla = covered.filter((id): id is string => typeof id === 'string' && id.trim() !== '');
    }
  }
  if (present.includes('rtm')) {
    const rtm = artifacts.rtm as { rows?: unknown; traceabilityMatrix?: unknown } | undefined;
    const nested = (rtm?.traceabilityMatrix as { rows?: unknown } | undefined)?.rows;
    const rowList = Array.isArray(rtm?.rows) ? rtm.rows : Array.isArray(nested) ? nested : undefined;
    if (Array.isArray(rowList)) {
      const ids = new Set<string>();
      for (const row of rowList) {
        // 只取设计 ID 命名空间：requirementId 是需求命名空间，混入会与 graph/tla 产生结构性差异。
        const designDoc = (row as { designDoc?: unknown })?.designDoc;
        if (typeof designDoc === 'string') for (const id of extractDesignIds(designDoc)) ids.add(id);
      }
      sets.rtm = [...ids];
    }
  }
  if (present.includes('scope')) {
    const changed = (artifacts.changeScope as { changedFiles?: unknown } | undefined)?.changedFiles;
    if (Array.isArray(changed)) {
      sets.scope = changed.filter((f): f is string => typeof f === 'string' && f.trim() !== '');
    }
  }
  return sets;
}

export function checkIcebergSweep(
  report: IcebergSweepReport,
  externalEvidence?: IcebergCheckExternalEvidence,
): IcebergSweepCheckResult {
  const reasons: string[] = [];
  // R1: schema 前置校验（反模式 #28）
  const schemaResult = validateBySchema('iceberg-sweep', report);
  if (!schemaResult.valid) {
    for (const msg of schemaResult.errorMessages) {
      reasons.push(`[schema] ${msg}`);
    }
    // 结构违规时短路返回：后续 R2-R5 依赖 required 字段（线索来源/newFindings），
    // 结构缺失继续访问会抛 TypeError（反模式 #28 语义：结构错误先报告，不进入业务规则校验）
    return {
      passed: false,
      reasons,
      reportSummary: {
        reportId: report.reportId,
        triggerType: report.triggerType,
        icebergRound: report.icebergRound,
        newFindingsCount: 0,
        passed: false,
      },
    };
  }
  // R2: icebergRound 边界（1-5）
  if (report.icebergRound < 1 || report.icebergRound > MAX_ICEBERG_ROUNDS) {
    reasons.push(`icebergRound 越界：${report.icebergRound}，须 1-${MAX_ICEBERG_ROUNDS}`);
  }
  // R3: newFindings 去重（内部 Set 去重 + 与上一轮 previousFindings 比对，双口径；
  // 内部重复使 newFindingsCount 虚高、破坏去重语义，同为 blocking）
  const prevSet = new Set(report.线索来源.previousFindings);
  const seen = new Set<string>();
  for (const f of report.newFindings) {
    if (seen.has(f.findingId)) {
      reasons.push(`findingId 重复：${f.findingId} 在 newFindings 内部重复`);
    }
    seen.add(f.findingId);
    if (prevSet.has(f.findingId)) {
      reasons.push(`findingId 重复：${f.findingId} 已在上一轮发现`);
    }
    // R4: 可证伪 + 证据非空
    if (!f.hypothesis || !f.evidence) {
      reasons.push(`finding ${f.findingId} 缺 hypothesis 或 evidence（禁止空泛）`);
    }
  }
  // R5: passed 一致性
  const expectedPassed = report.newFindings.length === 0;
  if (report.passed !== expectedPassed) {
    reasons.push(`passed 不一致：newFindings=${report.newFindings.length} 但 passed=${report.passed}`);
  }

  // === R6-R8: 三视角平权对账（D5/D7/D8）===
  // 分母由 checker 从上游产物实测（经 externalEvidence 注入），非 R 自报；三视角平权，
  // 无主分母、不归一化、不取并集后放行，任意两视角差异即刻失败（D8：不允许"已说明"豁免）。
  // 未注入 viewSets 即整块跳过（纯单测无文件系统上下文；阶段早期上游产物缺失时不误红，规格 §5）。
  const viewSets = externalEvidence?.viewSets;
  if (viewSets !== undefined) {
    const phaseNum = parseIcebergPhase(report.phase);
    if (phaseNum === undefined) {
      reasons.push(
        `R6 无法从 report.phase=${JSON.stringify(report.phase)} 解析阶段号（须为 phase<N>-<name>，N∈1-8）；` +
          `在场视角表按阶段裁定，阶段不可解析则对账不可进行`,
      );
    } else {
      const presentViews = ICEBERG_VIEW_PRESENCE[phaseNum] ?? [];
      const activeViews: IcebergView[] = [];
      const absentViews: IcebergView[] = [];
      for (const v of presentViews) {
        if (Array.isArray(viewSets[v])) activeViews.push(v);
        else absentViews.push(v);
      }

      // R6 视角间差异（两两比对，逐条列出差异项；不归一化、不取并集后放行）
      const disagreements: string[] = [];
      for (let i = 0; i < activeViews.length; i++) {
        for (let j = i + 1; j < activeViews.length; j++) {
          const vi = activeViews[i]!;
          const vj = activeViews[j]!;
          const a = new Set(viewSets[vi]!);
          const b = new Set(viewSets[vj]!);
          const diff = [...a].filter((x) => !b.has(x)).concat([...b].filter((x) => !a.has(x)));
          if (diff.length > 0) {
            disagreements.push(`${vi}↔${vj} 差异项：${diff.join(', ')}`);
          }
        }
      }
      if (disagreements.length > 0) {
        reasons.push(
          `R6 视角间存在未对账差异：${disagreements.join('；')}（三视角平权，差异即刻失败，走普通 V/G 失败链由 R 定位）`,
        );
      }

      // R7 缺席必须显式记录，不得静默跳过（重犯 check-signature-chain R8 的同类陷阱）
      if (absentViews.length > 0) {
        const declared = report.sweepCoverage.absentViews ?? [];
        const undeclared = absentViews.filter((v) => !declared.includes(v));
        if (undeclared.length > 0) {
          reasons.push(
            `R7 视角缺席未显式声明：${undeclared.join(', ')}（禁止静默跳过，须记入 sweepCoverage.absentViews）`,
          );
        }
      }

      // R8 分母未覆盖 / 零发现但覆盖不足
      if (activeViews.length > 0 && disagreements.length === 0) {
        const converged = new Set(activeViews.flatMap((v) => viewSets[v]!));
        const swept = new Set(report.sweepCoverage.sweptArtifacts);
        const uncovered = [...converged].filter((x) => !swept.has(x));
        if (uncovered.length > 0 && report.newFindings.length === 0) {
          reasons.push(`R8 零发现但 sweptArtifacts 未覆盖收敛集合，无法证明扫掠发生：${uncovered.join(', ')}`);
        } else if (report.newFindings.length === 0 && converged.size === 0) {
          reasons.push('R8 零发现但收敛集合为空（无法证明扫掠发生）');
        }
      }
    }
  }

  const passed = reasons.length === 0;
  return {
    passed,
    reasons,
    reportSummary: {
      reportId: report.reportId,
      triggerType: report.triggerType,
      icebergRound: report.icebergRound,
      newFindingsCount: report.newFindings.length,
      // 以最终校验结果为准（R5 违规时原始 report.passed 可能为 true，避免误导 gate-logs 消费方）
      passed,
    },
  };
}
