# 目标

对 phase5-demo 编码链做阶段 8 归档：归档目录须含编码计划归档快照（plan + 账本 + 三件套）。

## Task 1: 实现归档完整性门

实现 ARCHIVE_INTEGRITY_CHECKLIST 清单校验并接入 CLI。

验证：npx tsx w-model-dev/scripts/cli/check-archive-integrity.ts docs/changes/archive/phase5-demo

## Task 2: 并入编码计划归档快照校验

codingPlanSnapshot 清单项：plan/progress.md + Task N: complete 三件套 fail-closed。

验证：npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/archive-integrity-logic.test.ts
