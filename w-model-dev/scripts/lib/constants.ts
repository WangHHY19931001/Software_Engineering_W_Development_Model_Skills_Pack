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
 * SANY 语法检查快速失败 60s；TLC 状态爆炸时 300s 防挂死（对齐 ensure-codegraph-opsx.ts 上限）。
 */
export const EXEC_LIMITS = {
  sanyTimeoutMs: 60_000,
  tlcTimeoutMs: 300_000,
  shortTimeoutMs: 15_000,
  maxBufferSmall: 16 * 1024 * 1024,
  maxBufferLarge: 64 * 1024 * 1024,
} as const;
