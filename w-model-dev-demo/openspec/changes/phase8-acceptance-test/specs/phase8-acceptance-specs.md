# Specs: 阶段 8 验收测试规格（phase8-acceptance-test）

## UAT-001~UAT-073 规格索引

- 规格来源：`docs/phase1-requirements/acceptance-test-design.md`（73 条 UAT，阶段 1 设计）
- 路径映射：`docs/uat-path-mapping.md`（阶段 5 回填实际路径 + 映射类型：等价 20 行/直接 53 行；UAT-066/067/070 三行为不适用静态断言路径）
- 契约来源：`docs/phase3-outline/blog-system-interface-design.md`（INTF-001~022，错误码四元组 ERROR_CATALOG 40001~60003）
- 执行登记：`docs/phase8-acceptance/acceptance-test-report.md`（§2 明细 73 行 / §3 性能 / §4 安全 / §5 契约差异 9 项 / §9 用户确认区）

## 关键规格点

1. **用户需求匹配**（UAT-001~073）：功能 22/22（REQ-007~028 每需求 ≥2 条正常+异常/边界）、非功能 6/6（NFR-001~006）、约束 4/4（CON-001~004）；认证失效三态（UAT-006/012/063）均选需认证接口 GET /api/users/me（禁止行为 #12 合规）；
2. **状态机与边界**（UAT-018~021）：draft→published→archived 合法流转；已发布不可删除 409+60001；archived 直发 409+60001（设计预期 400，INTF §0.3）；分类嵌套 >3 层 60003（computeDepth 沿链实时计算，seed 真实三级链）；
3. **性能验收**（UAT-060/061）：常规 API 四接口各 20 次采样 + 组合流量 30 次轮询，P95 ≤ 2000ms（NFR-001 testThreshold，实测 <500ms 错误率 0）；生产目标 200ms 以 targetValue 登记不断言；性能采样限流阈值放宽（不参与 P95 度量）；
4. **安全验收**（UAT-062/063/072）：bcrypt 同明文两次注册哈希不同（加盐）+ 改密后旧哈希不可用；JWT_SECRET 环境变量注入（源码无字面量，错误密钥 40101）；exp−iat ≤ 86400s；
5. **横切与契约**（UAT-068~073）：限流测试环境 limit=5 第 6 次 429+42901；统一错误结构五类 `{ error: { code, message } }`（CON-002）；技术栈约束（CON-001：Express ^4 + TS ^5、无 DB 驱动、内存 Map）；审计登录/发布/删除三类留痕 + 保留 ≥90 天（CON-004，auditMiddleware 省略 id 字段修复验证）；
6. **异步与集成**（UAT-052/057~059/064/065）：通知/Webhook 投递 pollUntil 轮询收敛（无固定 sleep）；Webhook HMAC-SHA256 签名（X-Blog-Signature）可验、失败重试 ≤3 次（attempts=3/status=failed/lastError 非空）、发布事务一致性（published + 投递最终 failed 收敛无中间态）。

## 差异登记（设计预期 → 实现契约，9 项）

| 用例 | 设计预期 | 实现契约（按此断言） |
|---|---|---|
| UAT-002/003/005/006 | 字符串错误码 | 数字业务码 40001~60003（INTF §0.3） |
| UAT-004/013/022/031/049 | account/content/size/readCount/category | identifier/body/pageSize/viewCount/categoryId（INTF-002/005/011） |
| UAT-020 | 400 | 409 + 60001（INTF §0.3 60001=409） |
| UAT-049 | 真实多 IP | seam-STORE 注入 clientIp 替代（环境限制声明 §5-3） |
| UAT-052 | comment_reply 等 | REPLY/LIKE/NEW_ARTICLE 枚举（INTF-020 + ST-002） |
| UAT-028 | 快照 depth | computeDepth 沿链实时计算（seed 三级链） |
| UAT-046 | 子串匹配 | token 精确匹配（可独立分词） |
| UAT-066/067/070 | HTTP 断言 | seam-STATIC 构建期静态断言 |
| UAT-073 | 登录审计 actorId | actorId=null（公开路由，ST-027 契约） |

## 验收

- [x] 73/73 通过、exitCode=0；全量回归 318/318；性能 6 项 P95 ≤ 2000ms；RTM acceptanceTest 32 行回填覆盖率 100%；check-artifact-gate --phase=8 终检 exitCode=0
