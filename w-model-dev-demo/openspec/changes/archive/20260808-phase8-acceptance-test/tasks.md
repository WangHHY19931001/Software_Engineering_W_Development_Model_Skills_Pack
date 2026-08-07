# Tasks: 阶段 8 验收测试任务清单（phase8-acceptance-test）

## 探索（explore）
- [x] 读取阶段 1 验收测试设计（UAT-001~073）与路径映射（docs/uat-path-mapping.md 实际路径回填）确认测试范围
- [x] codegraph 等价查询落盘（.w-model/codegraph-queries/phase8-*.json ×6：uat-auth/uat-article/uat-interaction/uat-webhook/uat-audit/uat-crosscut）
- [x] 识别验收 seam（seam-HTTP/seam-STORE/seam-STATIC/mock 回调）、性能验收模型（NFR-001 testThreshold）、安全验收断言面（CON-002/003/004）
- [x] 阶段 7 遗留核对：ST-028/ST-020 固定 sleep flaky 不传入验收层（pollUntil 收敛）、P95 余量、ST-032/ST-033 断言收紧建议、counters Map 内存增长

## 提案（propose）
- [x] 本变更提案 proposal.md + design.md + specs 落盘（openspec/changes/phase8-acceptance-test/）
- [x] R3 explore/propose 三报告 + V 审查产物落盘（.w-model/r3-reviews/、.w-model/v-reviews/）

## 实施（coding）
- [x] tests/acceptance/helpers.ts（复用 system/helpers createTestEnv + pollUntil + seed 工具）
- [x] 9 个测试文件落地 73 条 UAT（UAT-001~073：auth 12 / article 12 / metadata 5 / browse 3 / interaction 8 / discovery 6 / stats 8 / integration 5 / crosscut 14）
- [x] 执行 `npm run test:acceptance`：Test Files 9 passed/9、Tests 73 passed/73、exitCode=0（首轮 14 失败 → CON-004 缺陷修复 + 13 处测试侧修正 → 全通过）
- [x] 全量回归 `npm run test`：Test Files 72 passed/72、Tests 318 passed/318、exitCode=0（175 UT + 30 IT + 40 ST + 73 UAT）
- [x] 性能验收：UAT-060/061 四接口+组合流量 P95 ≤ 2000ms（实测 <500ms，错误率 0）
- [x] 安全验收：UAT-062 bcrypt 加盐 / UAT-063/072 JWT 注入 / 认证失效三态 / 越权防护全过
- [x] docs/phase8-acceptance/acceptance-test-report.md 落盘（§2 明细 73 行 + §3 性能 + §4 安全 + §5 契约差异 9 项 + §9 用户确认区）
- [x] rtm.json acceptanceTest 列回填（32 行需求）+ executionSummary.acceptanceTest 73/73/0/0 + docs/uat-path-mapping.md 状态列回填
- [x] R3 coding 三报告 + V 审查产物落盘（.w-model/preventive-reviews/8-*.json 已存在，r3-reviews/v-reviews phase8-* 落盘）
- [x] check-artifact-gate --phase=8 终检 exitCode=0（GATE_JSON passed=true coveragePercent=100）；O checkpoint 放行（checkpoint-log/phase-8.txt）+ 归档快照 + check-archive-integrity/check-openspec-archive 双门禁 exitCode=0
