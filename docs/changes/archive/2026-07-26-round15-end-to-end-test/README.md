# Archive：2026-07-26 第十五轮端到端调测

> 项目级放行后 S 子代理执行 archive，沉淀产物到只读目录。
> 触发时机：acceptance-test-report.md §9 用户确认 `confirm` 后。
> archive 规则：archive 产物只读，后续项目引用时只读取不修改；archive 产物禁止具体文件路径（OpenSpec 与 to-spec 共识）。

## 归档元信息

- **归档日期**：2026-07-27
- **归档轮次**：self-as-verifier 第十五轮端到端调测
- **项目 ID**：blog-system-demo
- **项目名称**：Blog System Demo（扩展博客系统后端）
- **归档触发**：acceptance-test-report.md §9 用户确认 `confirm`
- **project.json.status**：项目完成 + 已归档
- **archive 路径**：`docs/changes/archive/2026-07-26-round15-end-to-end-test/`

## 归档产物清单

| 产物 | 文件 | 说明 |
|---|---|---|
| Archive README | README.md | 本文件，归档元信息与产物清单 |
| 需求问题陈述 | proposal.md | 阶段 1 需求规格的「问题陈述 + 解决方案 + User Stories + Out of Scope」节抽取 |
| 需求与验收合并 | specs.md | RTM 需求行 + 验收测试用例（UAT-xxx）合并 |
| 设计决策摘要 | design.md | 阶段 2-4 设计产物的技术决策摘要（不含具体文件路径） |
| 票据清单 | tasks.md | 阶段 5 tickets.md 的票据清单 + 完成状态 |
| TLA+ 规格清单 | tla-summary.md | TLA+ 规格清单（L1/L2/L3/L4 ID + 不变式列表） |
| RTM 最终快照 | rtm-snapshot.json | RTM 最终快照（requirementId → {designDoc, codeModule, tests}） |
| V 评审摘要 | verifier-summary.md | 8 阶段 V 评审 qualityLevel + compositeScore 摘要 |
| 测试报告快照 | test-report-snapshot.json | 阶段 8 验收测试报告快照（72 UAT 全通过） |

## 归档统计

| 维度 | 数值 |
|---|---|
| 需求总数 | 32（22 REQ + 6 NFR + 4 CON） |
| 设计文档 | 4 份（需求/系统/概要/详细） |
| 接口契约 | 22 INTF |
| 详细设计节点 | 75 DD |
| TLA+ 规格 | 22 个（1 L1 + 9 L2 + 7 L3 + 5 L4） |
| 源文件 | 60 TS 文件 |
| 单元测试 | 708 UT（98.66% lines） |
| 集成测试 | 74 IT（100%） |
| 系统测试 | 35 ST（100%） |
| 验收测试 | 72 UAT（100%） |
| 四级测试总计 | 889 测试用例全通过 |
| W 模型阶段 | 8 阶段全完成 |
| V 评审 | 8 阶段全 A 级 |

## 原始产物保留

- `.w-model/` 原始产物保留（不删除，作为可追溯证据）
- archive 产物只读，后续项目引用时只读取不修改
- tickets.md 源路径（docs/tickets.md）保留不动，archive 的 tasks.md 从源路径读取内容写入
