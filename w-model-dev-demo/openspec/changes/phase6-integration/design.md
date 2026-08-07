# Design: 阶段 6 集成测试设计（phase6-integration）

## 范围

| 维度 | 内容 |
|---|---|
| 被测系统 | blog-system-demo-r35 后端（Express + TypeScript，内存存储） |
| 测试面 | 集成测试（IT-001~IT-030），seam-HTTP 主 + seam-STORE 辅 + 外部契约 seam |
| 用例来源 | docs/phase3-outline/blog-system-integration-test.md（阶段 3 设计） |
| 接口契约 | docs/phase3-outline/blog-system-interface-design.md（INTF-001~022） |

## 测试架构

- helpers.ts：createTestEnv（每用例 new StoreFactory + createStores + createApp，天然隔离）、pollUntil（异步收敛）、mock Webhook 服务（http.createServer，per-test try/finally close）；
- 运行方式：`npm run test:integration`（cross-env JWT_SECRET=test-secret-blog-demo vitest run tests/integration）；
- 分文件：auth/article/browse/comment/contract/discovery/integration/interaction/stats 9 个测试文件，各文件头域注释 + IT 编号清单。

## 关键设计决策

1. **双限流器独立实例**（IT-002）：authLimiter 与 apiLimiter 须为独立 RateLimitMiddleware 实例（keyFn=ip+originalUrl 相同会导致同路径计数器叠加、认证限额折半），修复后认证 10/min、API 100/min 语义恢复；
2. **实现契约断言**（IT-013/015/020/022/026/030）：设计预期与实现不一致处按实现契约断言并登记差异表（如 REPLY 通知对象=文章作者 DD-033、热门过滤 viewCount7d>0）；
3. **异步断言统一 pollUntil**：Webhook 投递/通知消费/审计落盘均轮询收敛，避免固定 sleep 时序竞争。

## 数据与隔离

- 每用例独立 env（无 beforeAll 全局种子、无跨用例共享 store/app 状态）；
- 越权用例（IT-003/014/029）断言 store 快照未被污染；
- 分页/排序用例构造确定性数据（如 IT-020 热门 A1(10)>A2(5)>A3(1)）。

## 验收

- [x] 30/30 通过、exitCode=0
- [x] RTM integrationTest 回填
- [x] 报告 docs/phase6-integration/integration-test-report.md 落盘（含 §5 失败分析 + §6 差异登记）
