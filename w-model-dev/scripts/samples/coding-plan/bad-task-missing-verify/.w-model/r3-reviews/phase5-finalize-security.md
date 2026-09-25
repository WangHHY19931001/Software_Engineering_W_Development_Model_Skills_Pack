# phase5-finalize-security（R3 预防性审查 fixture）

- 维度：security（验证命令体禁 ; & | / 越权写入 / 敏感信息）
- 范围：阶段 5 编码链 finalize 段制品（plan / 账本 / 三件套 / review 包）
- 结论：发现阻断项——计划 Task 2 节缺「验证：」/「Verify:」命令行（R2）；本 fixture 以此负例验证门禁对 finalize 段不放行。

证据（行级锚）：

docs/plans/phase5-demo.plan.md:L5=目标节；L9=Task 1 节；L16=Task 2 节。
.superpowers/sdd/phase5-demo.plan/progress.md:L7=Task 1 complete；L8=Task 2 complete。
.superpowers/sdd/phase5-demo.plan/task-2-report.md:L1=任务报告（S-coding 产出）。
.superpowers/sdd/phase5-demo.plan/review-abc1234.diff:L1=任务评审包 diff。
