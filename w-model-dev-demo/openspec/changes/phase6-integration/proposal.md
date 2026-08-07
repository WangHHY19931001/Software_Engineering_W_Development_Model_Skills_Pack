# Change Proposal: 阶段 6 集成测试（phase6-integration）

- **Phase**: 6（集成测试）
- **Created**: 2026-08-07
- **Project**: blog-system-demo-r35（W 模型第 35 轮端到端调测）

## 背景与动机

阶段 5 编码已产出 58 个 TS 源码文件与 45 个 UT 测试文件（175 用例，行覆盖率 94.76%），阶段 3 概要设计已登记 30 条集成测试用例（IT-001~IT-030，seam-HTTP 主 + seam-STORE 辅 + 外部契约 seam）。本变更在 demo 环境执行阶段 6 集成测试：将阶段 3 设计的 IT 用例落地为可执行集成测试，验证跨模块交互与接口契约（INTF-001~022）。

## 目标

1. 落地 tests/integration/ 9 个测试文件 + helpers.ts，30 条 IT 全部可执行；
2. 覆盖跨模块链路：身份/内容/交互/发现/统计/通知/RSS/Webhook 子系统间调用；
3. RTM integrationTest 列回填（22 REQ + NFR-002/003/006 + CON-002/003/004）；
4. 通过 check-artifact-gate --phase=6 门禁与 V 评审（qualityLevel=A）。

## 方案要点

- 测试基础设施：createTestEnv（每用例独立 StoreFactory + createStores + createApp）+ pollUntil 异步轮询收敛 + mock Webhook 服务 per-test 生命周期；
- 断言契约：设计预期与实现契约不一致处按实现契约断言并登记报告 §6 差异表（IT-013/015/020/022/026/030）；
- 缺陷修复：IT-002 双限流器共享实例（authRateLimit/apiRateLimit 独立实例）、IT-026 分类深度 seed 真实三层链、IT-030 审计落盘轮询收敛。

## 验收标准

- [x] `npm run test:integration` exitCode=0（Test Files 9 passed/9、Tests 30 passed/30）
- [x] check-artifact-gate --phase=6 exitCode=0（RTM 覆盖率 100%、单元覆盖率 94.76%）
- [x] V 评审 phase6-integration qualityLevel=A（compositeScore=0.9112）passed=true
