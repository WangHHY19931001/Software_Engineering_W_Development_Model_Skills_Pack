# Archive：2026-07-28 第二十轮 W 模型 8 阶段端到端调测（四维识别模型验证）

> 项目级放行后 S 子代理执行 archive，沉淀产物到只读目录。
> 触发时机：W 模型 8 阶段全部通过 + check-artifact-gate 终检退出码 0 + 用户确认归档。
> archive 规则：archive 产物只读，后续项目引用时只读取不修改；archive 产物禁止具体文件路径（OpenSpec 与 to-spec 共识）。

## 归档元信息

- **归档日期**：2026-07-28
- **归档轮次**：self-as-verifier 第二十轮 W 模型 8 阶段端到端调测（验证 [20.0.0] 四维识别模型与豁免审批治理）
- **项目 ID**：blog-system-demo
- **项目名称**：博客系统后端 Demo（Express 4 + TypeScript 5 + 内存存储）
- **归档触发**：W 模型 8 阶段全部通过 + check-artifact-gate 终检退出码 0 + 用户确认归档
- **project.json.status**：项目完成 + 已归档
- **archive 路径**：`docs/changes/archive/2026-07-28-round20-w-model-8-phase-validation/`
- **maturity.json**：unlockConditions.completedCycles=2（2 完整 W 模型周期闭环）

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
| 需求总数 | 13（8 REQ + 3 NFR + 2 CON） |
| 设计文档 | 4 份（需求/系统/概要/详细）+ 4 份测试设计（单元/集成/系统/验收） |
| 子系统划分 | 3 个（SD-001 用户管理 / SD-002 内容管理 / SD-003 评论管理） |
| 接口契约 | 3 INTF |
| 详细设计节点 | 5 DD |
| 设计图谱节点 | 26（14 REQ + 4 SD + 3 INTF + 5 DD）|
| TLA+ 规格 | 8 个（1 L1 + 3 L2 + 2 L3 + 2 L4），四层分层建模 |
| BDD features | 8 个（L1/L2/L3/L4），31 scenarios，8 状态机 |
| 源文件 | 15 TS 文件（3 services + 3 stores + 3 routes + 1 middleware + 2 utils + 1 types + 1 app） |
| 单元测试 | 55 UT（100% 通过，覆盖率 Stmts=99.28% Branch=93.75%） |
| 集成测试 | 8 IT（100% 通过） |
| 系统测试 | 17 ST（100% 通过，含 P95 性能 + 内存基线 + 安全） |
| 验收测试 | 46 UAT（100% 通过，含用户场景 + NFR + 合规） |
| 四级测试总计 | 126 测试用例全通过 |
| W 模型阶段 | 8 阶段全完成（第 2 完整 W 模型周期闭环） |
| 终检 gate | check-artifact-gate phase=8 退出码 0 |

## 8 阶段端到端调测关键节点

| 阶段 | 阶段名 | gate 退出码 | 关键产物 |
|---|---|---|---|
| 1 | 需求分析 | 0 | 四维识别模型图谱 + TLA+ L1 + BDD L1 |
| 2 | 系统设计 | 0 | 3 子系统 SD + TLA+ L2(3) + BDD L2(3) |
| 3 | 概要设计 | 0 | 3 接口 INTF + TLA+ L3(2) + BDD L3(2) |
| 4 | 详细设计 | 0 | 5 详细 DD + TLA+ L4(2) + BDD L4(2) + 工件门 |
| 5 | 编码实现 | 0 | 15 TS 源文件 + 55 UT（99% 覆盖率）+ 代码-TLA+ 一致性 |
| 6 | 集成测试 | 0 | 8 IT + jwtUtil.verify 修复 |
| 7 | 系统测试 | 0 | 17 ST + 错误处理中间件 + PUT 路由 + P95+内存基线 |
| 8 | 验收测试 | 0 | 46 UAT + AUTH_005/006 状态码修正 + undefined 字段过滤 |

## 本轮调测发现的真实 bug 修复（保留至技能包）

本轮调测发现的 bug 为 demo 应用代码层修复，不涉及技能包脚本修正（技能包脚本已通过 [19.0.1] 修复 D7 schema 问题）。

- **AUTH_005/AUTH_006 HTTP 状态码**：密码错误应返回 401（认证失败）而非 400（请求错误），修正 `errorCodeToStatus` 映射
- **PUT /api/articles/:id undefined 字段过滤**：未提供的 title/content 不应覆盖原值为 undefined，使用显式 updates 对象做条件赋值
- **UAT-009-N2 内存度量基线**：使用 heapUsed delta（数据内存增量）而非 rss（包含 Node.js 运行时开销），阈值 ≤50MB 反映 NFR-003 ≤100MB 应用数据内存约束

## 原始产物处理

- `w-model-dev-demo/` 整个目录已删除（归档产物已迁移至本目录）
- `package.json` demo 专用依赖（express/jsonwebtoken/supertest + @types/*）已清理

## 下一周期改进项

- 验收测试 UAT-002 JWT 过期时间建议补充时间快进测试（mock jwt.verify 时间）
- 性能/安全横切用例覆盖较薄，建议引入 k6 性能压测 + OWASP ZAP 安全扫描作为 UAT 增强证据
- TLA+ L1/L2 specs 的 TLC 模型检验建议补充实际运行（当前为 SANY 语法 + skip-tlc）
