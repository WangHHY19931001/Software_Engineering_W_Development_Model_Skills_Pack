# Specs: 阶段 6 集成测试规格（phase6-integration）

## IT-001~IT-030 规格索引

- 规格来源：`docs/phase3-outline/blog-system-integration-test.md`（30 条 IT，seam-HTTP 主）
- 契约来源：`docs/phase3-outline/blog-system-interface-design.md`（INTF-001~022，10 字段模板 + 错误码四元组）
- 执行登记：`docs/phase6-integration/integration-test-report.md`（§2 明细 / §5 失败分析 / §6 设计差异表）

## 关键规格点

1. **认证与限流**：注册/登录/博主申请链路（INTF-001~003）；登录限流 10/min（NFR-006，IT-002 修复后）；JWT exp−iat≤86400（CON-003，IT-028）；
2. **文章与状态机**：发布/归档/删除非法流转 60001（INTF-006~008，IT-005）；非博主写入 403（INTF-005，IT-003）；越权修改 403（IT-029）；
3. **交互与事件**：评论/点赞/收藏/关注幂等（INTF-012~014）；事件分发（comment.created/Webhook，INTF-022，IT-006~008/015/016）；
4. **发现与统计**：热门 Top N（INTF-015）、推荐分流（INTF-016）、搜索相关性（INTF-017）、统计面板聚合（INTF-019）；
5. **外部契约 seam**：Webhook HMAC 验签 + 重试≤3 次（IT-006/007）；RSS 仅发布文章（INTF-021，IT-025）；
6. **横切**：统一错误结构（CON-002，四元组与 ERROR_CATALOG 对照，IT-027）；审计留痕（CON-004，IT-030）。

## 差异登记（设计预期 → 实现契约）

| 用例 | 设计预期 | 实现契约（按此断言） |
|---|---|---|
| IT-013 | 空内容评论 40001 | 40002（zod min(1) too_small） |
| IT-015 | 被回复读者收 REPLY | 通知对象=文章作者（DD-033） |
| IT-020 | Top 3 含 0 阅读 A3 | 过滤 viewCount7d>0，A3 seed 1 条 |
| IT-022 | 空关键词 40001 | 40002 |
| IT-026 | 非法头像 40002 | 40001（URL 格式非 http(s)） |
| IT-030 | 登录审计 actor=B | actorId=null（公开接口） |

## 验收

- [x] 30/30 通过、exitCode=0；RTM integrationTest 回填；check-artifact-gate --phase=6 exitCode=0
