# Tasks: 阶段 6 集成测试任务清单（phase6-integration）

## 探索（explore）
- [x] 读取阶段 3 集成测试设计（IT-001~030）与接口契约（INTF-001~022）确认测试范围
- [x] codegraph 等价查询落盘（.w-model/codegraph-queries/phase6-it002-*.json ×6：app 路由注册/authService/articleStore/commentStore/webhookService/rateLimitMiddleware）
- [x] 识别跨模块调用面与外部契约 seam（Webhook/RSS）

## 提案（propose）
- [x] 本变更提案 proposal.md + design.md + specs 落盘（openspec/changes/phase6-integration/）
- [x] R3 explore/propose 三报告 + V 审查产物落盘（.w-model/r3-reviews/、.w-model/v-reviews/）

## 实施（coding）
- [x] tests/integration/helpers.ts（createTestEnv/pollUntil/mock Webhook）
- [x] 9 个测试文件落地 30 条 IT（IT-001~IT-030）
- [x] 修复 IT-002 双限流器共享实例缺陷（authRateLimit/apiRateLimit 独立实例）
- [x] IT-026 seed 真实三层分类链、IT-030 审计断言轮询收敛
- [x] 执行 `npm run test:integration`：Test Files 9 passed/9、Tests 30 passed/30、exitCode=0
- [x] docs/phase6-integration/integration-test-report.md 落盘（§5 失败分析 + §6 设计差异登记）
- [x] rtm.json integrationTest 列回填（22 REQ + NFR-002/003/006 + CON-002/003/004）
- [x] R3 coding 三报告 + V 审查产物落盘
- [x] check-artifact-gate --phase=6 exitCode=0；O checkpoint 放行（checkpoint-log/phase-6.txt）
