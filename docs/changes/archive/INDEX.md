# Archive 调测产物索引

> 顶层导航：各轮完整记录见对应目录 README.md。本索引仅提供一行摘要 + 链接。
> 实际归档目录 5 个（round15 / round19 / round20-phase1-4dim / round20-w8 / round23；round20 有两个独立目录，前者为四维识别设计、后者为 8 阶段端到端调测）。

| 轮次 | 目录 | 时间 | 验证点 | 修复问题 | 样本基线 | 链接 |
|---|---|---|---|---|---|---|
| round15 | 2026-07-26-round15-end-to-end-test | 2026-07-26 | 8 阶段端到端调测（8 阶段 V 评审全 A 级） | — | 32 需求 / 889 测试全通过（708 UT + 74 IT + 35 ST + 72 UAT） | [README](./2026-07-26-round15-end-to-end-test/README.md) |
| round19 | 2026-07-27-round19-w-model-8-phase-validation | 2026-07-27 | W 模型 8 阶段端到端（V 评审 7 A + 1 B，终检 gate 退出码 0） | D7 RTM schema bug（check-bdd-model.ts `rtm.requirements` → `rtm.rows` + requirementId） | 32 需求 / 231 测试全通过（150 UT + 24 IT + 32 ST + 25 UAT） | [README](./2026-07-27-round19-w-model-8-phase-validation/README.md) |
| round20-phase1-4dim | 2026-07-28-round20-phase1-4dim-identification | 2026-07-28 | 阶段 1 需求提取四维识别模型 + 豁免审批治理（设计，19.0.1 → 20.0.0，待用户审查） | — | self-test 基线 121→152 / vitest 108→~146（见链接） | [design](./2026-07-28-round20-phase1-4dim-identification/design.md) |
| round20-w8 | 2026-07-28-round20-w-model-8-phase-validation | 2026-07-28 | W 模型 8 阶段端到端（验证 [20.0.0] 四维识别与豁免审批，第 2 完整 W 模型周期） | AUTH_005/006 状态码 401 修正、PUT undefined 字段过滤、UAT-009-N2 内存度量基线（demo 应用层） | 13 需求 / 126 测试全通过（55 UT + 8 IT + 17 ST + 46 UAT） | [README](./2026-07-28-round20-w-model-8-phase-validation/README.md) |
| round23 | 2026-07-30-round23-w-model-8-phase-validation | 2026-07-30 | W 模型 8 阶段端到端（orchestrator-subagent + R3 预防性审查，门禁全退出码 0） | R23-001~005：性能基线 2000ms、状态机 unarchive 目标、路由 /api/articles/:id/related | 32 需求 / 630 测试全通过（390 UT + 130 IT + 38 ST + 72 UAT），覆盖 94.99% | [README](./2026-07-30-round23-w-model-8-phase-validation/README.md) |
