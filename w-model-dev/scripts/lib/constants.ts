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
