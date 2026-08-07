# Design: 阶段 8 验收测试设计（phase8-acceptance-test）

## 范围

| 维度 | 内容 |
|---|---|
| 被测系统 | blog-system-demo-r35 后端（Express + TypeScript，内存存储）全链路 |
| 测试面 | 验收测试（UAT-001~073），seam-HTTP 主（supertest 直连 createApp）+ seam-STORE 辅（seed/快照断言）+ seam-STATIC（构建期静态断言）+ 本地 mock 回调 |
| 用例来源 | docs/phase1-requirements/acceptance-test-design.md（阶段 1 设计 73 条 UAT） |
| 路径映射 | docs/uat-path-mapping.md（阶段 5 回填实际路径 + 映射类型：等价 20 行/直接 53 行） |
| 接口契约 | docs/phase3-outline/blog-system-interface-design.md（INTF-001~022 + ERROR_CATALOG 40001~60003） |

## 测试架构

- helpers.ts：`export * from '../system/helpers'`（复用 createTestEnv 每用例全新内存 store + Express app、pollUntil 异步收敛、seed 工具；阅读去重窗口 readingDedupWindowMs 参数化注入避免真实时间等待）；
- 运行方式：`npm run test:acceptance`（`cross-env JWT_SECRET=test-secret-blog-demo vitest run tests/acceptance`）；
- 分文件：auth/article/metadata/browse/interaction/discovery/stats/integration/crosscut 9 个测试文件，各文件头域注释 + UAT 编号清单（describe 标题带 UAT-ID + 设计标题 + 需求 ID）。

## 关键设计决策

1. **用户需求匹配验证**（UAT-001~073）：73 条 UAT 与阶段 1 设计标题逐一对应，功能 22/22（REQ-007~028 每需求 ≥2 条正常+异常/边界）、非功能 6/6（NFR-001~006）、约束 4/4（CON-001~004），边界场景齐全（token 过期/状态机非法流转/分类深度/重复点赞幂等/同 IP 去重/限流阈值/分页边界）；
2. **认证失效三态选需认证接口**（UAT-006/012/063）：均选 GET /api/users/me 验证（禁止行为 #12 合规），不选公开接口；
3. **性能验收**（UAT-060/061）：注册/登录/列表/详情各 20 次串行采样 + 组合流量 30 次轮询，P95 ≤ 2000ms（NFR-001 testThreshold）；性能采样放宽限流阈值（rateLimitAuth 1000/rateLimitApi 10000）避免被限流污染，声明「限流不参与 P95 度量」；生产目标 200ms 以 targetValue 登记不断言；
4. **安全验收**（UAT-062/063/072）：bcrypt 同明文两次注册哈希不同（加盐）+ 改密后旧哈希不可用；JWT 密钥仅环境变量引用（源码无字面量，错误密钥 40101）；有效期 exp−iat ≤ 86400s；
5. **契约差异断言**（9 项）：错误码数字契约（字符串→数字 40001~60003 语义映射）、字段名 identifier/body/pageSize/viewCount/categoryId、UAT-020 状态码 409+60001、UAT-049 环境限制 seam-STORE 注入 2 个不同 clientIp、UAT-052 通知类型枚举、UAT-028 分类深度 seed 真实 parentId 链、UAT-046 搜索分词 token 精确匹配、UAT-066/067/070 构建期静态断言、UAT-073 审计 actorId=null 契约——按真实契约断言并登记报告 §5；
6. **异步断言统一 pollUntil**：通知/Webhook 投递/审计落盘轮询收敛（UAT-052/057~059/064/065/073），验收层无固定 sleep（阶段 7 flaky 不传入）；
7. **CON-004 缺陷修复**：auditMiddleware 省略 id 字段交 AuditLogStore.append 以 nextId('au') 生成唯一 id，UAT-073 断言登录/发布/删除三类留痕并存（首轮 14 失败 → 修复 → 73/73）。

## 数据与隔离

- 每用例独立 env（无 beforeAll 全局种子、无跨用例共享 store/app 状态），73 条 UAT 均在各自 it 内独立建 env；
- 本地 mock 回调服务器 per-test try/finally close（UAT-057~059/064/065），避免端口泄漏；
- 越权用例（UAT-008/009/017/035/054）断言 store 快照未被污染；
- 性能/统计用例 seed 确定性数据（差异化阅读记录驱动热门/推荐/趋势）。

## 验收

- [x] 73/73 通过、exitCode=0（Test Files 9 passed/9）
- [x] 全量回归 318/318（175 UT + 30 IT + 40 ST + 73 UAT，npm run test exitCode=0）
- [x] 性能 6 项 P95 ≤ 2000ms（实测 <500ms，错误率 0）
- [x] RTM acceptanceTest 列 32 行回填、executionSummary.acceptanceTest 73/73/0/0、需求覆盖率 100%
- [x] 报告 docs/phase8-acceptance/acceptance-test-report.md 落盘（§2 明细 73 行 + §3 性能 + §4 安全 + §5 契约差异 9 项 + §9 用户确认区）
