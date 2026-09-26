# phase5-plan-reliability（R3 预防性审查 fixture）

- 维度：reliability（验证命令可复跑 / 账本 complete 与任务节一一对应 / 回滚路径）
- 范围：阶段 5 编码链 plan 段制品（plan / 账本 / 三件套 / review 包）
- 结论：发现阻断项——计划 Task 2 节缺「验证：」/「Verify:」命令行（R2）；本 fixture 以此负例验证门禁对 plan 段不放行。

证据（行级锚）：

docs/plans/phase5-demo.plan.md:L5=目标节；L9=Task 1 节；L16=Task 2 节。
