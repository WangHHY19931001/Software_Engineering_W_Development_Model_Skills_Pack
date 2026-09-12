/**
 * 真实技能包 l0 链接审计基线的单一事实来源。
 *
 * 由 `npm run audit:l0-links` 实测产生（以 stdout L0_LINK_AUDIT_JSON 字段为准），
 * l0-link-audit-logic.test.ts 与 l0-link-audit-cli.test.ts 共享，避免两处字面量
 * 各自钉死导致基线漂移时更新遗漏。rebaseline 流程：改动 l0 采集逻辑后先跑
 * `npm run audit:l0-links` 取真实三数更新本模块，两测试文件自动跟随。
 */
export const L0_BASELINE = {
  // 662 = 651（2026-09-05 review2-fixes D2 失败链锚点化 + 2026-09-07
  // trigger-boundary campaign SKILL 触发表 1 条）+ 11（2026-09-11 code-health
  // Task 7：新增 references/code-health-governance.md 的 3 条同目录链接 +
  // SKILL/README/AGENTS/INSTALL/troubleshooting 各 1 条指向该文件的链接 +
  // command-reference/rtm-guide/coding-quality 等新节内的引用链接，violations 仍 0）。
  // 663 = 662 + 1（2026-09-12 gate-integrity Task 11：quick-self-check.md 的
  // 「未验证证据锚点已清零」自检项新增 1 条指向 evidence-anchored-tree.md 的链接，
  // 由 npm run audit:l0-links 实测 rebaseline，violations 仍 0）。
  // 665 = 663 + 2（2026-09-12 gate-integrity Task 12：verifier-spec.md 新增 §14 内的
  // design-philosophy.md 链接 1 条 + signature-chain-guide.md 新增 §6.1 内的
  // evidence-anchored-tree.md 链接 1 条；由 npm run audit:l0-links 实测 rebaseline，
  // l1Only 仍 92、placeholders 仍 36、violations 仍 0）。
  relativeLinkCount: 665,
  l1Only: 92,
  placeholders: 36,
} as const;
