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
 * 视角命名空间（R6 分池依据，D-1/N-1）：`design-wide` 两两精确相等；`design-sd` 只对宽视角的
 * **SD 切片**相等（tla 取 `sdCoverage.coveredSdNodes`，SD-only 是 TLA+ 规约语义——要求它含
 * DD/INTF 是把命名空间宽度差报成缺口）；`path`（scope 的 `changedFiles` 文件路径）不参与
 * R6/R8 的集合比对（与设计 ID 同池比对时，阶段 5-8 只要 change-scope 在盘即结构性必红）。
 *
 * 以 `ReadonlyMap` 承载（键集仍为 `IcebergView` 四值闭集）：查询走 `Map.get` 而非 `obj[key]`，
 * 后者即便键受控也是 `security/detect-object-injection` 的触发形态（键是变量而非字面量）。
 */
const VIEW_NAMESPACE: ReadonlyMap<IcebergView, 'design-wide' | 'design-sd' | 'path'> = new Map([
  ['graph', 'design-wide'],
  ['rtm', 'design-wide'],
  ['tla', 'design-sd'],
  ['scope', 'path'],
]);

/** 设计 ID 是否属于 SD 命名空间（tla 视角的规约覆盖范围；宽视角 SD 切片按此过滤） */
function isSdDesignId(id: string): boolean {
  return id.startsWith('SD-');
}

/** 对称差（a 独有在前、b 独有在后，稳定顺序便于 R 逐条定位；输入各自去重） */
function symmetricDiff(a: readonly string[], b: readonly string[]): string[] {
  const sa = new Set(a);
  const sb = new Set(b);
  return [...sa].filter((x) => !sb.has(x)).concat([...sb].filter((x) => !sa.has(x)));
}

/**
 * 三视角对账的外部产物注入面（本文件不做 I/O；CLI 层读盘后注入，与 `graph-logic.ts`
 * 的 `GraphCheckExternalEvidence` 同一约定）。
 *
 * 为什么分母不经由报告字段传递（规格 D7）：让 R 自报"该扫多少"仍属自证，
 * 只是从"自报发现了什么"变成"自报该发现多少"——空声明与真扫完仍无法区分。
 * 故分母由 checker 从上游已放行产物实测。未注入即跳过 R6/R7/R8（纯单测无文件系统
 * 上下文；阶段早期上游产物缺失时不得误红，规格 §5）。
 *
 * 各视角的标识符口径（实施期核定，规格 §5 已登记该风险）：含设计 ID 命名空间的视角取
 * graph.json 节点 id / tla-manifest `sdCoverage.coveredSdNodes` / rtm 行经 `designDoc`
 * 解析出的设计 ID，`scope` 取 change-scope 的 `changedFiles`（文件路径命名空间）。
 * 视角命名空间宽度不同，故 R6 **分池比对**（见 `VIEW_NAMESPACE`）：宽池精确相等、
 * 窄池对 SD 切片相等、path 命名空间不参与集合比对——同池两两比对会把结构性宽度差
 * 报成缺口（D-1/N-1：阶段 3-8 结构性必红）。
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
  /**
   * 非阻断诊断（`CheckpointCheckResult.diagnostics` 先例）：只在非空时出现，**不进** `reasons`
   * （`reasons` 是阻断面）、不改 `passed` / 退出码。当前来源：宽视角基线集为空时窄池对账跳过。
   */
  diagnostics?: string[];
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
 * 设计 ID 提取（宽视角命名空间）：SD-NNN / DD-NNN / INTF-NNN。
 *
 * 刻意不含 REQ/NFR/CON：需求命名空间只有 graph 与 rtm 视角有，TLA 侧只有设计 ID，
 * 混入会制造结构性差异（假阳性）（规格 §5 的实施期核定项）。
 */
const DESIGN_ID_PATTERN = /\b(?:SD|DD|INTF)-[A-Z0-9]+(?:-\d+)*(?:\.\d+)*/g;

/** 从自由文本中提取设计 ID 集合（去重） */
export function extractDesignIds(text: string): string[] {
  return text.match(DESIGN_ID_PATTERN) ?? [];
}

/**
 * 各视角"应扫集合"的派生（纯函数；I/O 由 CLI 层完成后注入，D7：分母不由 R 声明）。
 *
 * 口径（实施期核定，规格 §5 已登记；分池见 D-1/N-1）：设计 ID 视角与 path 视角分别派生——
 *   - graph → graph.json 节点 id 中的设计 ID（宽池，SD/DD/INTF 全量）
 *   - tla   → tla-manifest.json `sdCoverage.coveredSdNodes`（窄池，SD-only；已由 S-ingest-tla 从 .tla @designIds 回填）
 *   - rtm   → rtm.json 各行的 `designDoc` 引用中解析出的设计 ID（宽池，SD/DD/INTF 全量）
 *   - scope → change-scope 的 `changedFiles`（阶段 5-8，**文件路径命名空间**，不参与 R6/R8 集合比对）
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
  // 非阻断诊断通道（G3-3）：只记「无法对账但也不构成差异」的形态，绝不并入 reasons
  const diagnostics: string[] = [];
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
    // R4: 可证伪 + 证据非空（空白字符不算证据——与 root-cause-logic 的 trim 语义一致）
    if (
      typeof f.hypothesis !== 'string' ||
      f.hypothesis.trim() === '' ||
      typeof f.evidence !== 'string' ||
      f.evidence.trim() === ''
    ) {
      reasons.push(`finding ${f.findingId} 缺 hypothesis 或 evidence（禁止空泛）`);
    }
  }
  // R5: passed 一致性
  const expectedPassed = report.newFindings.length === 0;
  if (report.passed !== expectedPassed) {
    reasons.push(`passed 不一致：newFindings=${report.newFindings.length} 但 passed=${report.passed}`);
  }

  // === R6-R8: 三视角对账（D5/D7/D8 + D-1/N-1 分池）===
  // 分母由 checker 从上游产物实测（经 externalEvidence 注入），非 R 自报；
  // R6 分池比对（宽池精确相等 / 窄池对 SD 切片相等 / path 命名空间不参与），
  // 不归一化、不取并集后放行；池内差异即刻失败（D8：不允许"已说明"豁免）。
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

      // R6 视角间差异（分池比对，逐条列出差异项；不归一化、不取并集后放行）
      const designViews = activeViews.filter((v) => VIEW_NAMESPACE.get(v) !== 'path');
      const wide = designViews.filter((v) => VIEW_NAMESPACE.get(v) === 'design-wide');
      const disagreements: string[] = [];
      // 配对语义与双层下标等价：只遍历 i<j 的唯一组合（entries 取下标 + slice(i+1) 取其后项），
      // 顺序亦与 `for i / for j=i+1` 逐项一致，差异项文案顺序不漂移。
      for (const [i, vi] of wide.entries()) {
        for (const vj of wide.slice(i + 1)) {
          // eslint-disable-next-line security/detect-object-injection -- 键 vi/vj 取自 wide（由 ICEBERG_VIEW_PRESENCE 常量表枚举经 activeViews 过滤而来，IcebergView 四值闭集），viewSets 为 checker 注入的 Partial<Record<IcebergView, string[]>>，越界键不可能出现，非外部可控输入
          const diff = symmetricDiff(viewSets[vi]!, viewSets[vj]!);
          if (diff.length > 0) {
            disagreements.push(`R6[design-wide] ${vi}↔${vj} 差异项：${diff.join(', ')}`);
          }
        }
      }
      // eslint-disable-next-line security/detect-object-injection -- 键 v 同取自 wide（ICEBERG_VIEW_PRESENCE 常量表枚举，IcebergView 四值闭集），非外部可控输入
      const wideUnion = new Set(wide.flatMap((v) => viewSets[v]!));
      if (wideUnion.size === 0) {
        // G3-3 守卫：**宽视角基线集为空**（视角可在场但集合为空，如 graph/rtm 均为空数组）——
        // 无基准集合，窄池既谈不上「超出」也谈不上「漏」（把窄池全部 ID 报成超出是退化解误报）。
        // 跳过比对并记非阻断诊断；R7 视角缺席仍按既有判据报，R8 收敛集仍照常计算（不因此豁免）。
        diagnostics.push('R6[design-sd] 宽视角设计 ID 集为空，窄池对账跳过（无基准）');
      } else {
        const wideSdUnion = new Set([...wideUnion].filter(isSdDesignId));
        for (const v of designViews.filter((x) => VIEW_NAMESPACE.get(x) === 'design-sd')) {
          // eslint-disable-next-line security/detect-object-injection -- 键 v 取自 designViews（常量表枚举，IcebergView 四值闭集），非外部可控输入
          const narrow = viewSets[v]!;
          const narrowSet = new Set(narrow);
          const extra = [...narrowSet].filter((id) => !wideUnion.has(id));
          if (extra.length > 0) {
            disagreements.push(`R6[design-sd] ${v} 超出宽视角设计 ID 集：${extra.join(', ')}`);
          }
          // 漏 SD 方向：窄池须含宽视角的全部 SD 项。跨命名空间（DD/INTF）豁免，SD 缺口不豁免——
          // 该不变量在**阶段 1-4** 由 check-tla-model（--graph，`sdCoverage.uncoveredSdNodes` 为空
          // 并与 `graphSdNodes` 交叉校验）建立；**阶段 5-8 该门不再复检**（SKILL.md:99：
          // check-tla-model 仅阶段 1-4 列入 G 门禁），故该方向由本判据守护，不可省。
          const missing = [...wideSdUnion].filter((id) => !narrowSet.has(id));
          if (missing.length > 0) {
            disagreements.push(`R6[design-sd] 宽视角 SD 项未进入 ${v}：${missing.join(', ')}`);
          }
        }
      }
      if (disagreements.length > 0) {
        reasons.push(
          `R6 视角间存在未对账差异：${disagreements.join('；')}（设计 ID 分池对账，差异即刻失败，走普通 V/G 失败链由 R 定位）`,
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
      // 收敛集只用**设计 ID 视角**的并集（graph/rtm/tla）：path 命名空间（scope 的文件路径）
      // 不参与，否则收敛集混入文件项后 sweptArtifacts 永远无法覆盖（N-1）。
      if (designViews.length > 0 && disagreements.length === 0) {
        // eslint-disable-next-line security/detect-object-injection -- 键 v 取自 designViews（ICEBERG_VIEW_PRESENCE 常量表枚举，IcebergView 四值闭集），非外部可控输入
        const converged = new Set(designViews.flatMap((v) => viewSets[v]!));
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
    // 非阻断诊断仅在非空时出现（check-checkpoint / check-budget 同口径）
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
  };
}
