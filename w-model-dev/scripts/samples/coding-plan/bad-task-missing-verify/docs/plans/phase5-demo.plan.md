# phase5-demo 编码计划

> 变更：phase5-demo（阶段 5）。依据规格：docs/changes/phase5-demo/spec/proposal.md。

## 目标

交付编码计划制品门的参考制品树：目标节 + 两个任务节 + 逐任务验证命令 + 账本与三件套齐备。

## Task 1: 实现门禁逻辑

- 文件：`w-model-dev/scripts/logic/coding-plan-logic.ts`
- 步骤：先写逻辑测试（正例 + R1-R6 负例），再实现纯函数。

验证：npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/coding-plan-logic.test.ts

## Task 2: 接线 CLI 壳

- 文件：`w-model-dev/scripts/cli/check-coding-plan.ts`
- 步骤：loadCliScope 两形态参数 + strict 入口 + CODING_PLAN_JSON 单行摘要。

