/**
 * 全局常量（lib/constants.ts）
 *
 * 门禁常量全仓单点事实源（check-*.ts / *-logic.ts 共用）。
 * 退出码语义 0=通过 / 1=校验失败 / 2=输入错误，见 SSoT §10E；
 * 其余 .w-model 工件路径 / 阶段枚举等门禁常量统一在此定义。
 */

/**
 * RTM 追溯字段（SSoT：references/data-models.md §RTM 字段阶段演进，schema 见
 * gate-logic.ts RTMRowShape；对应终检 REQUIRED_TRACE_FIELDS 语义）。
 */
export const RTM_FIELDS = [
  'description',
  'designDoc',
  'codeModule',
  'unitTest',
  'integrationTest',
  'systemTest',
  'acceptanceTest',
] as const;

/**
 * 阶段枚举（SSoT：SKILL.md 8 阶段；数字形态，与 gate-logic.ts PhaseOption 一致）。
 */
export const PHASES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** 阶段号字面量联合类型（1|2|...|8） */
export type Phase = (typeof PHASES)[number];

/**
 * project.status 9 态有序枚举（A14 常数单点，43.1.0；与 project.schema.json status enum 一致，
 * 有序性即阶段前向链：index+1 为合法前向下一步）。终态「项目完成」机器 phase=9、展示收敛 8，
 * 双口径由 PROJECT_STATUS_TO_PHASE 单点承载；消费方（wm-status-logic / check-maturity /
 * gate-logic judgeProjectStatusTransition）一律改引此处，禁止各自维护 9 态字面量表。
 */
export const PROJECT_STATUSES = [
  '需求分析',
  '系统设计',
  '概要设计',
  '详细设计',
  '编码',
  '集成测试',
  '系统测试',
  '验收测试',
  '项目完成',
] as const;

/** project.status 字面量联合类型（9 态） */
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** 终态「项目完成」单点常数（A14b：两消费点相等判据的锚点） */
export const PROJECT_STATUS_COMPLETED: ProjectStatus = '项目完成';

/**
 * project.status → 阶段号单一映射（8/9 双口径统一，43.1.0）：
 *   - phase：机器口径（项目完成=9，超出现有 8 阶段编号；供转移链序判定）
 *   - displayPhase：展示口径（封顶 8；wm-status 快照 phase 字段）
 *   - completedPhases：已完成阶段数（项目完成=8，中间态=phase-1）
 */
export const PROJECT_STATUS_TO_PHASE: Record<
  ProjectStatus,
  { phase: number; displayPhase: number; completedPhases: number }
> = {
  需求分析: { phase: 1, displayPhase: 1, completedPhases: 0 },
  系统设计: { phase: 2, displayPhase: 2, completedPhases: 1 },
  概要设计: { phase: 3, displayPhase: 3, completedPhases: 2 },
  详细设计: { phase: 4, displayPhase: 4, completedPhases: 3 },
  编码: { phase: 5, displayPhase: 5, completedPhases: 4 },
  集成测试: { phase: 6, displayPhase: 6, completedPhases: 5 },
  系统测试: { phase: 7, displayPhase: 7, completedPhases: 6 },
  验收测试: { phase: 8, displayPhase: 8, completedPhases: 7 },
  项目完成: { phase: 9, displayPhase: 8, completedPhases: 8 },
};

/** 工件相对路径（.w-model 下） */
export const ARTIFACT_PATHS = {
  rtm: '.w-model/rtm.json',
  tlaManifest: '.w-model/tla-manifest.json',
  bddManifest: '.w-model/bdd-manifest.json',
} as const;

/**
 * 图谱校验轮次上限（graph.json analysisRounds[].round > 此值 → violation）。
 * 图谱在收敛循环中打转时（> 5 轮仍未通过）应升级人工介入，而非继续机械重跑。
 */
export const MAX_GRAPH_ROUNDS = 5 as const;

/**
 * 子进程执行限额（审计修复 P3/P15：SANY/TLC 无超时可致门禁永久挂死；限额集中单点定义）。
 * SANY 语法检查快速失败 60s；TLC 状态爆炸时 300s 防挂死（对齐 ensure-codegraph.ts 上限）。
 * modelCheckChildTimeoutMs：聚合门以子进程调用模型检查时的预算，须 ≥ 其内部 SANY+TLC 限额之和。
 */
export const EXEC_LIMITS = {
  sanyTimeoutMs: 60_000,
  tlcTimeoutMs: 300_000,
  shortTimeoutMs: 15_000,
  modelCheckChildTimeoutMs: 360_000,
  maxBufferSmall: 16 * 1024 * 1024,
  maxBufferLarge: 64 * 1024 * 1024,
} as const;
