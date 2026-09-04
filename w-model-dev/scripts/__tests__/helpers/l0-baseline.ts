/**
 * 真实技能包 l0 链接审计基线的单一事实来源。
 *
 * 由 `npm run audit:l0-links` 实测产生（以 stdout L0_LINK_AUDIT_JSON 字段为准），
 * l0-link-audit-logic.test.ts 与 l0-link-audit-cli.test.ts 共享，避免两处字面量
 * 各自钉死导致基线漂移时更新遗漏。rebaseline 流程：改动 l0 采集逻辑后先跑
 * `npm run audit:l0-links` 取真实三数更新本模块，两测试文件自动跟随。
 */
export const L0_BASELINE = {
  relativeLinkCount: 649,
  l1Only: 92,
  placeholders: 36,
} as const;
