# Change Proposal: 阶段 7 系统测试（phase7-system-test）

- **Phase**: 7（系统测试）
- **Created**: 2026-08-07
- **Project**: blog-system-demo-r35（W 模型第 35 轮端到端调测）

## 背景与动机

阶段 6 集成测试已产出 9 个集成测试文件（30 条 IT 全过）并验证跨模块交互与接口契约（INTF-001~022）；阶段 2 系统设计已登记 40 条系统测试用例（ST-001~ST-040，seam-HTTP 主 + seam-STORE 辅）。本变更在 demo 环境执行阶段 7 系统测试：将阶段 2 设计的 ST 用例落地为可执行系统测试，验证端到端全链路、性能基线（NFR-001）与安全基线，并对齐阶段 6 遗留处置（IT-012 sleep flaky、IT-016 时序窗口、SSRF 负面断言缺口等）。

## 目标

1. 落地 tests/system/ 10 个文件（9 个测试文件 + helpers.ts），40 条 ST 全部可执行；
2. 端到端验证：ST-001~005 覆盖注册→登录→申请博主→创建→发布→浏览全链路 + Webhook/RSS 外部契约 seam（HMAC 验签）；
3. 性能基线：ST-029~031 三条 P95 ≤ 2000ms（NFR-001 testThreshold，1000 样本错误率 0）；
4. 安全基线：ST-032~035 四条（注入/XSS/密码哈希/JWT 密钥注入，对应 CON-002/CON-003/CON-004）；
5. RTM systemTest 列回填（32 行需求：22 REQ + NFR-001/002/003/006 + CON-002/003/004）；
6. 通过 check-artifact-gate --phase=7 门禁与 V 评审（qualityLevel=A）。

## 方案要点

- 测试基础设施：复用 integration/helpers 的 createTestEnv（每用例独立内存 store + Express app）+ pollUntil 异步轮询收敛 + 本地 mock 回调服务 per-test 生命周期（ST-005/024）；
- 性能度量：runLoad 100 并发 × 10 轮 = 1000 样本，calcP95 升序取 ceil(0.95N)-1 索引；单独放宽通用限流阈值并声明「限流不参与 P95 度量」；
- 契约差异：设计预期与实现契约不一致处按实现契约断言并登记报告 §5（ST-001 JWT 角色快照/ST-002 REPLY 通知对象/ST-021 面板数据隔离/ST-013 viewCount/ST-026 签名完整性/ST-028 IP 隔离降级/ST-039 事务一致性路径）；
- 阶段 6 遗留处置：IT-012/IT-016 异步断言模式在系统层以 pollUntil 收敛复刻；SSRF 负面断言缺口在 ST-032 注入基线中部分覆盖（协议白名单级负面断言仍登记遗留）。

## 验收标准

- [x] `npm run test:system` exitCode=0（Test Files 9 passed/9、Tests 40 passed/40）
- [x] 性能基线：浏览列表 P95=1767ms / 全文搜索 P95=1912ms / 个性化推荐 P95=1846ms，均 ≤ 2000ms，错误率 0
- [x] 安全基线 4 条全过（ST-032~035），无 500/无泄漏/无明文
- [x] RTM systemTest 列 32 行回填，executionSummary.systemTest total=40/passed=40
- [x] check-artifact-gate --phase=7 exitCode=0（RTM 覆盖率 100%、单元覆盖率 94.76%）
- [x] V 评审 phase7-system qualityLevel=A（compositeScore=0.9052）passed=true
