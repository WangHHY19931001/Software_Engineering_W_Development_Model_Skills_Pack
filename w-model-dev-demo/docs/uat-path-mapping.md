# UAT 路径映射表

> 阶段 1（需求分析）产出初始模板；阶段 5 编码后回填「实际路径」+「映射类型」；阶段 8 验收时校验完整性。
> 校验规则：phase=1 校验文件存在性；phase=5 校验实际路径非 `_待阶段5回填_` 且 mappingType ∈ {直接,等价,替代}；phase=8 终检校验格式完整（≥4 列）。

## 映射表（UAT-001 ~ UAT-091）

| UAT ID | 设计路径（阶段1） | 实际路径（阶段5回填） | 映射类型 | 说明 |
|---|---|---|---|---|
| UAT-001 | POST /api/auth/register | _待阶段5回填_ | _待填_ | 注册成功 |
| UAT-002 | POST /api/auth/register | _待阶段5回填_ | _待填_ | 重复邮箱 409 |
| UAT-003 | POST /api/auth/register | _待阶段5回填_ | _待填_ | 非法邮箱/短密码 400 |
| UAT-004 | GET /api/users/me | _待阶段5回填_ | _待填_ | 查询资料 |
| UAT-005 | GET /api/users/me | _待阶段5回填_ | _待填_ | 未认证 401 |
| UAT-006 | PUT /api/users/me | _待阶段5回填_ | _待填_ | 超长昵称 400 |
| UAT-007 | POST /api/auth/login | _待阶段5回填_ | _待填_ | 登录换取 JWT |
| UAT-008 | POST /api/auth/login | _待阶段5回填_ | _待填_ | 错误密码 401 |
| UAT-009 | GET /api/users/me | _待阶段5回填_ | _待填_ | 无效 token 401 |
| UAT-010 | POST /api/bloggers | _待阶段5回填_ | _待填_ | 开通博主 |
| UAT-011 | POST /api/bloggers | _待阶段5回填_ | _待填_ | 重复开通 409 |
| UAT-012 | POST /api/bloggers | _待阶段5回填_ | _待填_ | 未认证 401 |
| UAT-013 | POST /api/bloggers/:id/follow | _待阶段5回填_ | _待填_ | 关注博主 |
| UAT-014 | POST /api/bloggers/:id/follow | _待阶段5回填_ | _待填_ | 重复关注幂等 |
| UAT-015 | POST /api/bloggers/:id/follow | _待阶段5回填_ | _待填_ | 博主不存在 404 |
| UAT-016 | POST /api/posts | _待阶段5回填_ | _待填_ | 创建文章 |
| UAT-017 | PUT /api/posts/:id | _待阶段5回填_ | _待填_ | 非作者 403 |
| UAT-018 | POST /api/posts | _待阶段5回填_ | _待填_ | 空标题/内容 400 |
| UAT-019 | POST /api/posts | _待阶段5回填_ | _待填_ | 存草稿不公开 |
| UAT-020 | PATCH /api/posts/:id/status | _待阶段5回填_ | _待填_ | 发布公开可见 |
| UAT-021 | PATCH /api/posts/:id/status | _待阶段5回填_ | _待填_ | 非作者 403 |
| UAT-022 | GET /api/posts/:id | _待阶段5回填_ | _待填_ | 浏览计数 +1 |
| UAT-023 | GET /api/posts/:id | _待阶段5回填_ | _待填_ | 不存在 404 |
| UAT-024 | GET /api/posts/:id | _待阶段5回填_ | _待填_ | 访客浏览草稿 404 |
| UAT-025 | POST /api/posts/:id/comments | _待阶段5回填_ | _待填_ | 发表评论 |
| UAT-026 | DELETE /api/comments/:id | _待阶段5回填_ | _待填_ | 非作者 403 |
| UAT-027 | POST /api/posts/:id/comments | _待阶段5回填_ | _待填_ | 空/超长 400 |
| UAT-028 | PATCH /api/comments/:id/review | _待阶段5回填_ | _待填_ | 审核通过可见 |
| UAT-029 | PATCH /api/comments/:id/review | _待阶段5回填_ | _待填_ | 审核拒绝隐藏 |
| UAT-030 | PATCH /api/comments/:id/review | _待阶段5回填_ | _待填_ | 非博主 403 |
| UAT-031 | POST /api/tags | _待阶段5回填_ | _待填_ | 创建标签 |
| UAT-032 | POST /api/tags | _待阶段5回填_ | _待填_ | 重复标签 409 |
| UAT-033 | DELETE /api/tags/:id | _待阶段5回填_ | _待填_ | 引用中删除 409 |
| UAT-034 | POST /api/categories | _待阶段5回填_ | _待填_ | 创建分类含层级 |
| UAT-035 | DELETE /api/categories/:id | _待阶段5回填_ | _待填_ | 含文章删除 409 |
| UAT-036 | POST /api/categories | _待阶段5回填_ | _待填_ | parent 不存在 400 |
| UAT-037 | GET /api/search?q=TypeScript | _待阶段5回填_ | _待填_ | 关键词命中 |
| UAT-038 | GET /api/search?q=zzzz | _待阶段5回填_ | _待填_ | 无命中空列表 |
| UAT-039 | GET /api/search?q= | _待阶段5回填_ | _待填_ | 空关键词 400 |
| UAT-040 | GET /api/recommendations | _待阶段5回填_ | _待填_ | 推荐文章 |
| UAT-041 | GET /api/recommendations | _待阶段5回填_ | _待填_ | 无内容空列表 |
| UAT-042 | GET /api/recommendations | _待阶段5回填_ | _待填_ | 结果 ≤ 10 条 |
| UAT-043 | GET /api/posts/:id/stats | _待阶段5回填_ | _待填_ | 文章统计 |
| UAT-044 | GET /api/posts/:id/stats | _待阶段5回填_ | _待填_ | 无数据为 0 |
| UAT-045 | GET /api/posts/:id/stats | _待阶段5回填_ | _待填_ | 不存在 404 |
| UAT-046 | GET /api/notifications | _待阶段5回填_ | _待填_ | 事件生成通知 |
| UAT-047 | PATCH /api/notifications/:id/read | _待阶段5回填_ | _待填_ | 标记已读 |
| UAT-048 | GET /api/notifications?userId=<A> | _待阶段5回填_ | _待填_ | 越权查询他人通知 403（REQ-016 AC3） |
| UAT-049 | POST /api/subscriptions | _待阶段5回填_ | _待填_ | 订阅博主 |
| UAT-050 | POST /api/subscriptions | _待阶段5回填_ | _待填_ | 重复订阅幂等 |
| UAT-051 | POST /api/subscriptions | _待阶段5回填_ | _待填_ | 博主不存在 404 |
| UAT-052 | POST /api/auth/login + GET /api/admin/audit-logs | _待阶段5回填_ | _待填_ | 管理员登录触发审计记录（管理员 token） |
| UAT-053 | GET /api/admin/audit-logs | _待阶段5回填_ | _待填_ | 记录字段完整 |
| UAT-054 | GET /api/admin/audit-logs | _待阶段5回填_ | _待填_ | 普通用户 403 |
| UAT-055 | GET /api/admin/audit-logs?page=1&pageSize=10 | _待阶段5回填_ | _待填_ | 分页查询 |
| UAT-056 | GET /api/admin/audit-logs?action=delete_post | _待阶段5回填_ | _待填_ | 条件筛选 |
| UAT-057 | GET /api/admin/audit-logs | _待阶段5回填_ | _待填_ | 非管理员 403 |
| UAT-058 | GET /api/rss | _待阶段5回填_ | _待填_ | 系统级 RSS |
| UAT-059 | GET /api/rss | _待阶段5回填_ | _待填_ | 空源合法 |
| UAT-060 | GET /api/bloggers/:id/rss | _待阶段5回填_ | _待填_ | 博主 RSS 404 |
| UAT-061 | POST /api/webhooks | _待阶段5回填_ | _待填_ | 创建 + 事件触发投递 |
| UAT-062 | PUT /api/webhooks/:id、DELETE /api/webhooks/:id | _待阶段5回填_ | _待填_ | 更新/删除 |
| UAT-063 | POST /api/webhooks | _待阶段5回填_ | _待填_ | 非法 URL 400 |
| UAT-064 | POST /api/webhooks + 发布事件（内部投递队列） | _待阶段5回填_ | _待填_ | 失败自动重试（经日志验证） |
| UAT-065 | POST /api/webhooks + 发布事件（内部投递队列） | _待阶段5回填_ | _待填_ | 重试超限标记 failed |
| UAT-066 | POST /api/webhooks + 发布事件（内部投递队列） | _待阶段5回填_ | _待填_ | 成功不重试 |
| UAT-067 | GET /api/posts（压测） | _待阶段5回填_ | _待填_ | P95 响应时间 |
| UAT-068 | GET /api/posts（并发压测） | _待阶段5回填_ | _待填_ | 并发响应达标 |
| UAT-069 | GET /api/users/me、DELETE /api/posts/:id | _待阶段5回填_ | _待填_ | 未认证 401/越权 403 |
| UAT-070 | POST /api/auth/register | _待阶段5回填_ | _待填_ | 密码哈希验证 |
| UAT-071 | GET /api/posts（1000 次） | _待阶段5回填_ | _待填_ | 零 5xx |
| UAT-072 | 混合 API（1000 次） | _待阶段5回填_ | _待填_ | 混合零 5xx |
| UAT-073 | n/a（静态 vitest coverage） | _待阶段5回填_ | _待填_ | 覆盖率 ≥ 80% |
| UAT-074 | n/a（静态 vitest coverage） | _待阶段5回填_ | _待填_ | 覆盖率可复现 |
| UAT-075 | GET /api/posts（1000 次后测内存） | _待阶段5回填_ | _待填_ | 峰值内存 |
| UAT-076 | GET /api/posts（2000 次后测内存） | _待阶段5回填_ | _待填_ | 内存稳定 |
| UAT-077 | GET /api/posts（60 秒内 ≤100 次） | _待阶段5回填_ | _待填_ | 限流内放行 |
| UAT-078 | GET /api/posts（第 101 次） | _待阶段5回填_ | _待填_ | 429 + Retry-After |
| UAT-079 | n/a（静态 package.json/tsconfig） | _待阶段5回填_ | _待填_ | 技术栈编译运行 |
| UAT-080 | n/a（静态依赖清单） | _待阶段5回填_ | _待填_ | 无其他 Web 框架 |
| UAT-081 | 启动行为（静态检查） | _待阶段5回填_ | _待填_ | 无外部连接 |
| UAT-082 | POST /api/posts → GET /api/posts/:id | _待阶段5回填_ | _待填_ | 内存数据读写 |
| UAT-083 | POST /api/posts | _待阶段5回填_ | _待填_ | 非法入参 400 |
| UAT-084 | n/a（静态源码检查） | _待阶段5回填_ | _待填_ | zod 校验 |
| UAT-085 | 配置检查 + GET /api/admin/audit-logs | _待阶段5回填_ | _待填_ | 保留期配置 |
| UAT-086 | GET /api/admin/audit-logs | _待阶段5回填_ | _待填_ | 超期清理 |
| UAT-087 | DELETE /api/bloggers/:id/follow | _待阶段5回填_ | _待填_ | 取关粉丝数 -1（REQ-005 AC2） |
| UAT-088 | PUT /api/posts/:id | _待阶段5回填_ | _待填_ | 文章不存在 404（REQ-006 AC3） |
| UAT-089 | POST /api/posts/:id/comments | _待阶段5回填_ | _待填_ | 文章不存在 404（REQ-009 AC3） |
| UAT-090 | DELETE /api/subscriptions/:id | _待阶段5回填_ | _待填_ | 退订成功（REQ-017 AC3） |
| UAT-091 | 静态（环境变量与启动日志检查） | _待阶段5回填_ | _待填_ | JWT_SECRET 注入/禁默认/不入日志（NFR-002 AC3） |

## 映射类型说明

- `直接`：路径完全一致（阶段 5 回填）
- `等价`：路径不同但语义等价（如路由分组调整，阶段 5 回填）
- `替代`：因技术约束替代（须说明原因，阶段 5 回填）

## 设计路径约定（阶段 1）

- 认证语义：`POST /api/auth/*` 承载注册/登录；受保护资源通过 Bearer token 中间件鉴权
- 管理端点：`/api/admin/*` 仅管理员角色可访问（审计日志查询）
- 内部机制（REQ-018 审计记录、REQ-022 Webhook 重试）：无独立公开端点，经触发端点 + 日志验证，阶段 5 若实现为独立端点则回填实际路径并标记 `等价`
- 静态验证（NFR-004 覆盖率、CON-001/002/003 约束）：`n/a`，阶段 8 以静态检查/构建产物验证，不映射 HTTP 端点
