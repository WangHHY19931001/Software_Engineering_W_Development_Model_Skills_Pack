# Tasks: 阶段 7 系统测试任务清单（phase7-system-test）

## 探索（explore）
- [x] 读取阶段 2 系统测试设计（ST-001~040）与接口契约（INTF-001~022、ERROR_CATALOG 40001~60003）确认测试范围
- [x] codegraph 等价查询落盘（.w-model/codegraph-queries/phase7-*.json ×6：st001-e2e 路由注册/st028-rate-limit/st029-performance/st032-security/st034-password-hash/st035-jwt-secret）
- [x] 识别端到端全链路 seam（Webhook/RSS mock 回调）、性能基线负载模型（NFR-001 testThreshold）、安全基线断言面（CON-002/003/004）
- [x] 阶段 6 遗留核对：IT-012/IT-016 异步断言模式、SSRF 负面断言缺口在 ST-032 注入基线的覆盖边界

## 提案（propose）
- [x] 本变更提案 proposal.md + design.md + specs 落盘（openspec/changes/phase7-system-test/）
- [x] R3 explore/propose 三报告 + V 审查产物落盘（.w-model/r3-reviews/、.w-model/v-reviews/）

## 实施（coding）
- [x] tests/system/helpers.ts（createTestEnv 复用 + runLoad/calcP95 + seed 工具）
- [x] 9 个测试文件落地 40 条 ST（ST-001~ST-040：端到端 5 / 跨模块 23 / 性能 3 / 安全 4 / 边界 5）
- [x] 执行 `npm run test:system`：Test Files 9 passed/9、Tests 40 passed/40、exitCode=0
- [x] 性能基线：浏览 1767ms / 搜索 1912ms / 推荐 1846ms（P95 ≤ 2000ms 全达标，1000 样本错误率 0）
- [x] 安全基线 4 条全过（ST-032 注入 / ST-033 XSS / ST-034 bcrypt / ST-035 JWT_SECRET 注入）
- [x] docs/phase7-system/system-test-report.md 落盘（§2 明细 40 行 + §3 性能 + §4 安全 + §5 契约差异 7 处登记）
- [x] rtm.json systemTest 列回填（32 行需求）+ executionSummary.systemTest 40/40/0/0
- [x] R3 coding 三报告 + V 审查产物落盘（.w-model/preventive-reviews/7-*.json 已存在，r3-reviews/v-reviews phase7-* 落盘）
- [x] check-artifact-gate --phase=7 exitCode=0（GATE_JSON passed=true coveragePercent=100）；O checkpoint 放行（checkpoint-log/phase-7.txt）
