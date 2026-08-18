# 核心操作行为（Operating Behaviors）

> 吸收自 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) `using-agent-skills`，适配 W 模型语境。与「不可违反的约束」互补：约束是硬红线（命中即回退），操作行为是日常准则（违反不回退但降低质量）。SSoT §4A 为权威定义。

## 八条操作行为

| # | 行为 | 在 W 模型中的具体表现 |
|---|---|---|
| 1 | **Surface Assumptions** | `/wm analyze` / `design` / `code` 前显式列出对需求 / 架构 / 范围的假设；不得静默填补歧义 |
| 2 | **Manage Confusion Actively** | RTM 不一致 / 上游缺失 / 术语冲突时：STOP → 命名困惑 → 澄清 → 等待；禁止「猜一个推进」 |
| 3 | **Push Back When Warranted** | 用户选择与硬约束冲突时（跳 CHECKPOINT / 估算覆盖率放行）：指出问题 → 量化代价 → 提替代 → 接受覆盖 |
| 4 | **Enforce Simplicity** | 编码前自问「能否更少行？抽象是否物有所值？」；1000 行能 100 行完成即失败 |
| 5 | **Maintain Scope Discipline** | 只动该动的；不删看不懂的注释 / 不顺手清理无关代码 / 不重构相邻系统 / 不加规格外功能 |
| 6 | **Verify, Don't Assume** | 每阶段须有验证证据（测试退出码 / 脚本输出 / 运行时数据）；「看起来对」永远不够 |
| 7 | **Choose Highest Seam** | 阶段 2-4 测试设计前置时优先选现有最高 seam；理想零新 seam；私有状态机转移由 TLA+ 不变式覆盖 |
| 8 | **Structure Over Persuasion** | 能焊进结构的约束（权限 / 只读 / 网络隔离 / schema 拦截）就不写进提示词；提示词约束是说服性的、每一步都要选择遵守，结构约束是确定性的 |

## 失败模式清单（F1~F10）

「看似高效实则埋坑」的 10 条行为退化，与 48 条流程反模式互补。命中不触发回退，但应在阶段产物「备注」节或 `reworkHints` 中标注。权威定义与缓解措施见仓库 SSoT §4A.2（`docs/skill-design-document_SSoT.md`）。

| # | 失败模式 | 与反模式的关系 |
|---|---|---|
| F1 | 静默假设未检查就推进 | 与 #9 互补 |
| F2 | 困惑时不暂停、硬猜推进 | 与 #8 互补 |
| F3 | 注意到不一致但不指出 | 与 #4 互补 |
| F4 | 非显然决策不呈现 tradeoff | — |
| F5 | 对明显有问题的方案 sycophantic | 对应 §4A.1 第 3 条 |
| F6 | 过度复杂化代码与 API | 对应 §4A.1 第 4 条 |
| F7 | 修改任务外的代码或注释 | 对应 §4A.1 第 5 条 |
| F8 | 删除未完全理解的代码 | 对应 §4A.1 第 5 条 |
| F9 | 因「显而易见」而无规格就编码 | 与「测试设计前置」冲突 |
| F10 | 因「看起来对」跳过验证 | 与 #3 / #6 互补 |

> Agent 重复命中同一失败模式 ≥2 次时，应在 CHANGELOG 体系（仓库 `docs/changes/decision-log/README.md`）登记为新教训。
