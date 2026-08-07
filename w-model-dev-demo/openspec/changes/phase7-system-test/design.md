# Design: 阶段 7 系统测试设计（phase7-system-test）

## 范围

| 维度 | 内容 |
|---|---|
| 被测系统 | blog-system-demo-r35 后端（Express + TypeScript，内存存储）全链路 |
| 测试面 | 系统测试（ST-001~ST-040），seam-HTTP 主（supertest 直连 createApp，不启真实端口）+ seam-STORE 辅（seed/快照断言）+ 本地 mock 回调 |
| 用例来源 | docs/phase2-design/blog-system-system-test.md（阶段 2 设计 40 条 ST） |
| 接口契约 | docs/phase3-outline/blog-system-interface-design.md（INTF-001~022 + ERROR_CATALOG 40001~60003） |

## 测试架构

- helpers.ts：复用 integration/helpers 的 createTestEnv（每用例 new StoreFactory + createStores + createApp，天然隔离）+ pollUntil 异步收敛 + runLoad/calcP95（性能基线负载工具）+ seed 工具；
- 运行方式：`npm run test:system`（`cross-env JWT_SECRET=test-secret-blog-demo vitest run tests/system`）；
- 分文件：e2e/auth-content/content-social/discovery/stats-crosscut/error-contract/performance/security/boundary 9 个测试文件，各文件头域注释 + ST 编号清单（describe 标题带 ST-ID + 设计标题 + 需求引用）。

## 关键设计决策

1. **端到端全链路**（ST-001~005）：单用例多步断言（注册→登录→申请博主→创建→发布→浏览→评论/feed/统计/Webhook/RSS），JWT 角色快照契约（申请博主后须重新登录获取博主 JWT，ST-001 §5-1）；外部契约 seam 用本地 mock HTTP 服务（HMAC 验签，ST-005/024 per-test try/finally close）；
2. **性能基线**（ST-029~031）：runLoad 100 并发 × 10 轮 = 1000 样本、calcP95 升序取 ceil(0.95N)-1 索引、错误率 = 非 2xx 比例；单独放宽通用限流阈值（rateLimitApi 100000）并声明「限流不参与 P95 度量」，避免取样被限流污染；P95 阈值 2000ms 对应 NFR-001 testThreshold；
3. **安全基线**（ST-032~035）：注入向量按字面量检索断言（无 500/无全量泄漏/错误结构统一）、XSS 内容三方一致快照（提交→列表→CommentStore）、密码 bcrypt $2a$10$ 前缀 + compare 正反例、JWT_SECRET 环境变量注入行为级证明（存在性 + 错误密钥 40101 + 注入密钥 200 + 对照组）；
4. **契约差异断言**（7 处）：设计预期与实现不一致处按实现契约断言并登记报告 §5（ST-001 JWT 角色快照、ST-002 REPLY 通知对象=文章作者、ST-021 面板按 token.sub 数据隔离、ST-013/025 viewCount/40402 防枚举、ST-026 篡改 payload 必然签名失败、ST-028 IP 隔离降级、ST-039 事件总线隔离无部分状态）；
5. **异步断言统一 pollUntil**：通知/Webhook 投递/审计落盘轮询收敛（e2e/stats-crosscut/error-contract）；ST-028/ST-020 两处固定 sleep 登记 Nit 遗留（margin 100~200ms 轻微 flaky）。

## 数据与隔离

- 每用例独立 env（无 beforeAll 全局种子、无跨用例共享 store/app 状态）；
- 越权用例（ST-007/014/021）断言 store 快照未被污染；
- 性能/统计用例 seed 确定性数据（如 100 篇已发布文章、差异化阅读记录驱动热门/推荐）；
- 本地 mock 回调服务 per-test try/finally close，避免端口泄漏。

## 验收

- [x] 40/40 通过、exitCode=0（Test Files 9 passed/9）
- [x] 性能基线 3 条 P95 ≤ 2000ms（1767/1912/1846ms，1000 样本错误率 0）
- [x] RTM systemTest 列 32 行回填、executionSummary.systemTest 40/40/0/0
- [x] 报告 docs/phase7-system/system-test-report.md 落盘（§2 明细 + §3 性能 + §4 安全 + §5 契约差异登记）
