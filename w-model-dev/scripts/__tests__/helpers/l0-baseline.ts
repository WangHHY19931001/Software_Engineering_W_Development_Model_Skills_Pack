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
  // 666 = 665 + 1；l1Only 93 = 92 + 1（2026-09-13 gate-integrity Task 13：新增
  // samples/verifier-calibration/README.md——该目录为 L1，正文含 3 条包内相对链接
  // 指向 ../../../references/verifier-spec.md（2 条）与
  // ../../../schemas/verifier-output.schema.json（1 条），其中指向 L0 schemas 的
  // 1 条计为 l1Only、其余计入 relativeLinkCount。原设计规格的仓库外链已改为纯文本
  // 引用（技能包须自包含）。由 npm run audit:l0-links 实测 rebaseline，violations 仍 0）。
  // 670 = 666 + 4（2026-09-14 P1 Task 1：新增 references/asset-authoring.md 的 3 条同目录链接
  // + SKILL.md「门禁契约与资源清单」指向该文件的指针 1 条；由 npm run audit:l0-links 实测
  // rebaseline，l1Only 仍 93、placeholders 仍 36、violations 仍 0）。
  // 671 = 670 + 1（2026-09-14 P1 Task 6：SKILL.md「编排者-子代理边界」节末追加 1 条指向
  // references/subagent-delegation.md 的指针，作为新增「调用分类」与「跨阶段与跨角色交接的
  // 书写规则」两节的入口；由 npm run audit:l0-links 实测 rebaseline，l1Only 仍 93、
  // placeholders 仍 36、violations 仍 0）。
  // 670 = 671 - 1（2026-09-14 P1 最终审查修复：合并 SKILL.md「编排者-子代理边界」节内
  // 指向 references/subagent-delegation.md 的两条同目标链接为一条；由 npm run audit:l0-links
  // 实测 rebaseline，l1Only 仍 93、placeholders 仍 36、violations 仍 0）。
  // 672 = 670 + 2；l1Only 95 = 93 + 2（2026-09-15 P2-B Task 1 / S27：hard-constraints.md
  // 反模式 #45 的「门禁脚本」对照表行与正文行各新增 1 条指向 ../scripts/cli/check-run-log.ts
  // 的链接（R10 revertEvidence 回滚证伪挂点）；由 npm run audit:l0-links 实测 rebaseline，
  // placeholders 仍 36、violations 仍 0）。
  // 674 = 672 + 2（2026-09-17 audit-remediation 文档批：hard-constraints.md 与
  // subagent-delegation.md 各新增 1 条指向 iceberg-sweep-guide.md 的跨引用，用于统一
  // 「冰山放行判据」三口径并指向 §8.4 三视角对账；逐文件回退实验实测各 -1，l1Only 仍 95、
  // placeholders 仍 36、violations 仍 0）。
  // 675 = 674 + 1（同批规则层修正：hard-constraints.md 反模式 #20 检测信号改为指向
  // subagent-delegation.md「反模式 #20」节的行为要求，新增 1 条跨引用；l1Only 仍 95、
  // placeholders 仍 36、violations 仍 0）。
  // 676 = 675 + 1（2026-09-18 leftovers-closeout 任务 5 修复轮：references/operational-recovery.md
  // 的 §门禁顺序表 `check-run-log.ts` 行为补 R9/R10/R11 摘要时新增 1 条同目录链接
  // `[verifier-spec.md](verifier-spec.md)`（该文件 11 → 12 条；`git diff` 实测该文件只有
  // 这一行改动、净 +1 条相对链接）；由 npm run audit:l0-links 实测 rebaseline，
  // l1Only 仍 95、placeholders 仍 36、violations 仍 0）。
  // 678 = 676 + 2（2026-09-19 第五源吸收（dsh-normify）：references/conventions.md 的
  // `evidenceAnchor` 词条补 R15f 指针时新增 2 条同目录链接 `[evidence-anchored-tree.md](evidence-anchored-tree.md)`
  // （该文件 1 → 3 条；`git diff` 实测该文件本次仅此一处新增链接，其余改动为订正过期的
  // 「可选，R15 不强制」措辞，不含链接）；由 npm run audit:l0-links 实测 rebaseline，
  // l1Only 仍 95、placeholders 仍 36、violations 仍 0）。
  relativeLinkCount: 678,
  l1Only: 95,
  placeholders: 36,
} as const;
