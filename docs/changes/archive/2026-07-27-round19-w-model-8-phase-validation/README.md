# Archive：2026-07-27 第十九轮 W 模型 8 阶段端到端调测

> 项目级放行后 S 子代理执行 archive，沉淀产物到只读目录。
> 触发时机：W 模型 8 阶段全部通过 + check-artifact-gate 终检退出码 0 + 用户确认归档。
> archive 规则：archive 产物只读，后续项目引用时只读取不修改；archive 产物禁止具体文件路径（OpenSpec 与 to-spec 共识）。

## 归档元信息

- **归档日期**：2026-07-27
- **归档轮次**：self-as-verifier 第十九轮 W 模型 8 阶段端到端调测
- **项目 ID**：blog-system-demo
- **项目名称**：博客系统后端（W模型8阶段端到端调测用车）
- **归档触发**：W 模型 8 阶段全部通过 + check-artifact-gate 终检退出码 0 + 用户确认归档
- **project.json.status**：项目完成 + 已归档
- **archive 路径**：`docs/changes/archive/2026-07-27-round19-w-model-8-phase-validation/`
- **maturity.json**：unlockConditions.completedCycles=1（1 完整 W 模型周期闭环）

## 归档产物清单

| 产物 | 文件 | 说明 |
|---|---|---|
| Archive README | README.md | 本文件，归档元信息与产物清单 |
| V 评审摘要 | verifier-summary.md | 8 阶段 V 评审 qualityLevel + compositeScore 摘要 |
| RTM 最终快照 | rtm-snapshot.json | RTM 最终快照（requirementId → {designDoc, codeModule, tests}） |
| 测试报告快照 | test-report-snapshot.json | 8 阶段测试执行汇总（UT/IT/ST/UAT） |
| TLA+ 规格清单 | tla-summary.md | TLA+ 规格清单（L1/L2/L3/L4 ID + 不变式列表） |
| BDD feature 清单 | bdd-summary.md | BDD features（L1/L2/L3/L4 scenario 统计 + 状态机映射） |
| 检查点决策摘要 | checkpoint-summary.md | 8 阶段 checkpoint 决策摘要（acknowledgedDecisions） |

## 归档统计

| 维度 | 数值 |
|---|---|
| 需求总数 | 32（22 REQ + 6 NFR + 4 CON） |
| 设计文档 | 4 份（需求/系统/概要/详细） |
| 接口契约 | 22 INTF |
| 详细设计节点 | 75 DD |
| TLA+ 规格 | 4 个（1 L1 + 1 L2 + 1 L3 + 1 L4），L4 通过 TLC 零死锁零违反 |
| BDD features | 4 个（L1/L2/L3/L4），34 scenarios |
| 源文件 | 41 TS 文件 |
| 单元测试 | 150 UT（100% 通过） |
| 集成测试 | 24 IT（100% 通过） |
| 系统测试 | 32 ST（100% 通过） |
| 验收测试 | 25 UAT（100% 通过） |
| 四级测试总计 | 231 测试用例全通过 |
| W 模型阶段 | 8 阶段全完成（1 完整 W 模型周期） |
| V 评审 | 7 阶段 A 级 + 1 阶段 B 级（阶段1需求分析 0.8245 B 级） |
| 终检 gate | check-artifact-gate phase=8 退出码 0 |

## 8 阶段端到端调测关键节点

| 阶段 | 阶段名 | V 评审分数 | 质量等级 | gate 退出码 |
|---|---|---|---|---|
| 1 | 需求分析 | 0.8245 | B | 0 |
| 2 | 系统设计 | 0.8645 | A | 0 |
| 3 | 概要设计 | 0.881 | A | 0 |
| 4 | 详细设计 | 0.8885 | A | 0 |
| 5 | 编码实现 | 0.8805 | A | 0 |
| 6 | 集成测试 | 0.912 | A | 0 |
| 7 | 系统测试 | 0.909 | A | 0 |
| 8 | 验收测试 | 0.922 | A | 0 |

## 本轮调测发现的真实 bug 修复（保留至技能包）

- `check-bdd-model.ts` D7 RTM 映射校验修正：原读取 `rtm.requirements`（不存在字段），修正为 `rtm.rows` + `requirementId`，与 `gate-logic.ts` 的 `RTMMatrixShape` 对齐

## 原始产物处理

- `w-model-dev-demo/` 整个目录已删除（归档产物已迁移至本目录）
- `update-rtm.cjs`（demo 专用 RTM 批量更新脚本）已删除
- `package.json` demo 专用依赖（bcrypt/express/jsonwebtoken/uuid/zod/supertest/vitest + @types/*）已还原
- `check-bdd-model.ts` RTM schema 修正保留（真实 bug 修复，非 demo 产物）

## 下一周期改进项（reworkHints 汇总）

- L1 BDD BlogSystemL1.feature cucumber-js 执行报告未生成 JSON，建议补充 cucumber-report.json 用于 check-bdd-model.ts --phase=8 门禁
- UAT-002 JWT 过期时间仅以单次响应验证，建议补充时间快进测试（mock jwt.verify 时间）
- UAT 性能/安全横切用例覆盖较薄，建议引入 k6 性能压测 + OWASP ZAP 安全扫描作为 UAT 增强证据
- IT-004 性能用例归入阶段7 k6 负载验证 INTF 接口 P95
- tla-consistency.ts 存根实现记录为后续改进项
- SearchIndexer 索引优化记录为后续改进项
