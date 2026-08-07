# UAT 路径映射表

> 博客系统后端（blog-system-demo-r35）· 阶段 1 需求分析产出（初始模板）。
> 列语义：**设计路径（阶段1）** = 阶段 1 设计的约定端点（含 HTTP 方法）；**实际路径（阶段5回填）** = 阶段 5 编码后回填真实路由；**映射类型** = `直接`（路径完全一致）/ `等价`（路径不同但语义等价，如路由分组调整）/ `替代`（因技术约束替代，须说明原因）。
> 流程：阶段 1 产出初始表 → 阶段 5 编码后回填实际路径 + 映射类型 → 阶段 8 验收测试编写按此表映射（禁止凭主观判断）。
> 认证要求取值：无需认证 / 需普通用户 token / 需博主 token / 混合 / 不适用。
> 测试执行状态：✅ 通过（阶段 8 执行后回填 passed）。

| UAT ID | 设计路径（阶段1） | 实际路径（阶段5回填） | 映射类型 | 需求 ID | HTTP 方法 | 认证要求 | 测试执行状态 | 说明 |
|---|---|---|---|---|---|---|---|---|
| UAT-001 | POST /api/auth/register | POST /api/auth/register | 直接 | REQ-007 | POST | 无需认证 | ✅ 通过 | 读者注册成功 |
| UAT-002 | POST /api/auth/register | POST /api/auth/register | 直接 | REQ-007 | POST | 无需认证 | ✅ 通过 | 重复邮箱 409 |
| UAT-003 | POST /api/auth/register | POST /api/auth/register | 直接 | REQ-007 | POST | 无需认证 | ✅ 通过 | 缺必填字段/弱密码 400 |
| UAT-004 | POST /api/auth/login | POST /api/auth/login | 直接 | REQ-008 | POST | 无需认证 | ✅ 通过 | 邮箱/用户名登录签发 JWT |
| UAT-005 | POST /api/auth/login | POST /api/auth/login | 直接 | REQ-008 | POST | 无需认证 | ✅ 通过 | 错误凭据 401 |
| UAT-006 | GET /api/users/me | GET /api/users/me | 直接 | REQ-008, CON-003 | GET | 需普通用户 token（过期 token） | ✅ 通过 | 过期 token 验证（需认证接口，禁止行为 #12 合规） |
| UAT-007 | POST /api/users/me/blogger | POST /api/users/me/blogger | 直接 | REQ-009 | POST | 需普通用户 token | ✅ 通过 | 申请成为博主 |
| UAT-008 | POST /api/articles | POST /api/articles | 直接 | REQ-009, REQ-011 | POST | 需普通用户 token | ✅ 通过 | 普通读者发文章 403 |
| UAT-009 | PATCH/DELETE /api/articles/:id | PUT /api/articles/:id、DELETE /api/articles/:id | 等价 | REQ-009, REQ-014 | PATCH/DELETE | 需博主 token（越权） | ✅ 通过 | 越权管理他人文章 403 |
| UAT-010 | GET/PATCH /api/users/me | GET /api/users/me、PATCH /api/users/me | 直接 | REQ-010 | GET/PATCH | 需普通用户 token | ✅ 通过 | 查看/修改资料 |
| UAT-011 | PUT /api/users/me/password | PUT /api/users/me/password | 直接 | REQ-010 | PUT | 需普通用户 token | ✅ 通过 | 修改密码校验原密码 |
| UAT-012 | GET /api/users/me | GET /api/users/me | 直接 | REQ-010, NFR-002 | GET | 无（不带 token） | ✅ 通过 | 未认证访问 401 |
| UAT-013 | POST /api/articles | POST /api/articles | 直接 | REQ-011 | POST | 需博主 token | ✅ 通过 | 创建文章 draft |
| UAT-014 | POST /api/articles | POST /api/articles | 直接 | REQ-011 | POST | 需博主 token | ✅ 通过 | 缺必填字段 400 |
| UAT-015 | POST /api/articles/:id/publish | POST /api/articles/:id/publish | 直接 | REQ-012 | POST | 需博主 token | ✅ 通过 | 发布草稿读者可见 |
| UAT-016 | PATCH /api/articles/:id + POST /api/articles/:id/publish | PUT /api/articles/:id、POST /api/articles/:id/publish | 等价 | REQ-012 | PATCH/POST | 需博主 token | ✅ 通过 | 更新后重新发布 |
| UAT-017 | POST /api/articles/:id/publish | POST /api/articles/:id/publish | 直接 | REQ-012 | POST | 需博主 token | ✅ 通过 | 发布不存在 404/越权 403 |
| UAT-018 | POST /api/articles/:id/publish、POST /api/articles/:id/archive | POST /api/articles/:id/publish、POST /api/articles/:id/archive | 直接 | REQ-013 | POST | 需博主 token | ✅ 通过 | 状态机合法流转 |
| UAT-019 | DELETE /api/articles/:id | DELETE /api/articles/:id | 直接 | REQ-013, REQ-014 | DELETE | 需博主 token | ✅ 通过 | 已发布不可删除 |
| UAT-020 | POST /api/articles/:id/publish | POST /api/articles/:id/publish | 直接 | REQ-013 | POST | 需博主 token | ✅ 通过 | archived 直接发布 400 |
| UAT-021 | POST /api/articles/:id/unarchive + POST /api/articles/:id/publish | POST /api/articles/:id/unarchive、POST /api/articles/:id/publish | 直接 | REQ-013 | POST | 需博主 token | ✅ 通过 | 取消归档后重新发布 |
| UAT-022 | GET /api/users/me/articles | GET /api/blogger/articles | 等价 | REQ-014 | GET | 需博主 token | ✅ 通过 | 文章列表分页 |
| UAT-023 | PATCH /api/articles/:id | PUT /api/articles/:id | 等价 | REQ-014 | PATCH | 需博主 token | ✅ 通过 | 编辑文章 |
| UAT-024 | DELETE /api/articles/:id | DELETE /api/articles/:id | 直接 | REQ-014, REQ-013 | DELETE | 需博主 token | ✅ 通过 | 删草稿 204/删已发布 409 |
| UAT-025 | POST /api/tags | POST /api/tags | 直接 | REQ-015 | POST | 需博主 token | ✅ 通过 | 创建标签 |
| UAT-026 | POST /api/tags | POST /api/tags | 直接 | REQ-015 | POST | 需博主 token | ✅ 通过 | 重复标签名 409 |
| UAT-027 | POST /api/categories | POST /api/categories | 直接 | REQ-016 | POST | 需博主 token | ✅ 通过 | 创建嵌套分类 |
| UAT-028 | POST /api/categories | POST /api/categories | 直接 | REQ-016 | POST | 需博主 token | ✅ 通过 | 深度 >3 层 400 |
| UAT-029 | POST /api/categories | POST /api/categories | 直接 | REQ-016 | POST | 需博主 token | ✅ 通过 | 重复分类名 409 |
| UAT-030 | GET /api/articles | GET /api/articles | 直接 | REQ-017 | GET | 无需认证 | ✅ 通过 | 分页浏览已发布 |
| UAT-031 | GET /api/articles | GET /api/articles | 直接 | REQ-017, REQ-015, REQ-016 | GET | 无需认证 | ✅ 通过 | 分类/标签筛选 |
| UAT-032 | GET /api/articles/:id | GET /api/articles/:id | 直接 | REQ-017 | GET | 无需认证 | ✅ 通过 | 详情含作者；草稿 404 |
| UAT-033 | POST /api/articles/:id/comments | POST /api/articles/:id/comments | 直接 | REQ-018 | POST | 需普通用户 token | ✅ 通过 | 评论自动通过 |
| UAT-034 | POST /api/articles/:id/comments | POST /api/articles/:id/comments | 直接 | REQ-018 | POST | 无（不带 token） | ✅ 通过 | 未登录评论 401 |
| UAT-035 | DELETE /api/comments/:id、POST /api/comments/:id/replies | DELETE /api/articles/:id/comments/:cid、POST /api/articles/:id/comments/:cid/reply | 等价 | REQ-018 | DELETE/POST | 需用户 token | ✅ 通过 | 作者删评/非作者 403/回复 |
| UAT-036 | POST /api/articles/:id/like | POST /api/articles/:id/like | 直接 | REQ-019 | POST | 需普通用户 token | ✅ 通过 | 点赞计数 +1 |
| UAT-037 | POST /api/articles/:id/favorite、GET /api/users/me/favorites | POST /api/articles/:id/favorite、GET /api/me/favorites | 等价 | REQ-019 | POST/GET | 需普通用户 token | ✅ 通过 | 收藏与收藏列表 |
| UAT-038 | POST /api/articles/:id/like | POST /api/articles/:id/like | 直接 | REQ-019 | POST | 需普通用户 token | ✅ 通过 | 重复点赞幂等 |
| UAT-039 | POST /api/users/:id/follow、GET /api/users/me/feed | POST /api/users/:id/follow、GET /api/me/feed | 等价 | REQ-020 | POST/GET | 需普通用户 token | ✅ 通过 | 关注后 feed 出新文 |
| UAT-040 | DELETE /api/users/:id/follow、GET /api/users/me/feed | DELETE /api/users/:id/follow、GET /api/me/feed | 等价 | REQ-020 | DELETE/GET | 需普通用户 token | ✅ 通过 | 取消关注不再推送 |
| UAT-041 | GET /api/articles/popular | GET /api/articles/hot | 等价 | REQ-021 | GET | 无需认证 | ✅ 通过 | 热门 Top10 |
| UAT-042 | GET /api/articles/popular | GET /api/articles/hot | 等价 | REQ-021 | GET | 无需认证 | ✅ 通过 | 空数据空列表 |
| UAT-043 | GET /api/recommendations | GET /api/me/recommendations | 等价 | REQ-022, REQ-024 | GET | 需普通用户 token | ✅ 通过 | 有历史标签偏好推荐 |
| UAT-044 | GET /api/recommendations | GET /api/me/recommendations | 等价 | REQ-022 | GET | 需普通用户 token | ✅ 通过 | 无历史回退热门 |
| UAT-045 | GET /api/search | GET /api/search | 直接 | REQ-023 | GET | 无需认证 | ✅ 通过 | 全文检索四字段 |
| UAT-046 | GET /api/search | GET /api/search | 直接 | REQ-023 | GET | 无需认证 | ✅ 通过 | 分页与无结果 |
| UAT-047 | GET /api/articles/:id | GET /api/articles/:id | 直接 | REQ-024 | GET | 无需认证 | ✅ 通过 | 阅读量 +1 |
| UAT-048 | GET /api/articles/:id | GET /api/articles/:id | 直接 | REQ-024 | GET | 无需认证（同 IP） | ✅ 通过 | 同 IP 去重 |
| UAT-049 | GET /api/articles/:id | GET /api/articles/:id | 直接 | REQ-024 | GET | 无需认证（多 IP） | ✅ 通过 | 不同 IP 累加 |
| UAT-050 | GET /api/users/me/stats | GET /api/blogger/stats | 等价 | REQ-025 | GET | 需博主 token | ✅ 通过 | 统计面板核心指标 |
| UAT-051 | GET /api/users/me/stats | GET /api/blogger/stats | 等价 | REQ-025 | GET | 需博主 token | ✅ 通过 | 7 天趋势 |
| UAT-052 | GET /api/users/me/notifications | GET /api/me/notifications | 等价 | REQ-026 | GET | 需普通用户 token | ✅ 通过 | 三类事件产生通知 |
| UAT-053 | GET /api/users/me/notifications | GET /api/me/notifications | 等价 | REQ-026 | GET | 需普通用户 token | ✅ 通过 | 通知列表分页 |
| UAT-054 | PATCH /api/users/me/notifications/:id/read | PATCH /api/me/notifications/:id/read | 等价 | REQ-026 | PATCH | 需普通用户 token | ✅ 通过 | 标记已读/他人通知 404 |
| UAT-055 | GET /api/feeds/:userId/rss | GET /api/bloggers/:id/rss | 等价 | REQ-027 | GET | 无需认证 | ✅ 通过 | RSS 四字段 |
| UAT-056 | GET /api/feeds/:userId/rss | GET /api/bloggers/:id/rss | 等价 | REQ-027, REQ-012 | GET | 无需认证 | ✅ 通过 | 草稿不在 RSS |
| UAT-057 | POST /api/articles/:id/publish（触发 Webhook） | POST /api/articles/:id/publish（触发 Webhook 分发） | 直接 | REQ-028 | POST | 需博主 token | ✅ 通过 | 发布触发回调+签名 |
| UAT-058 | POST /api/articles/:id/publish（触发 Webhook） | POST /api/articles/:id/publish（触发 Webhook 分发） | 直接 | REQ-028, NFR-003 | POST | 需博主 token | ✅ 通过 | 失败重试 3 次 |
| UAT-059 | POST /api/articles/:id/comments（触发 Webhook） | POST /api/articles/:id/comments（触发 Webhook 分发） | 直接 | REQ-028 | POST | 需普通用户 token | ✅ 通过 | 评论触发回调 |
| UAT-060 | POST /api/auth/register、POST /api/auth/login、GET /api/articles、GET /api/articles/:id | POST /api/auth/register、POST /api/auth/login、GET /api/articles、GET /api/articles/:id | 直接 | NFR-001 | POST/GET | 混合 | ✅ 通过 | 常规 API P95 基线 |
| UAT-061 | GET /api/articles、GET /api/search、GET /api/recommendations | GET /api/articles、GET /api/search、GET /api/me/recommendations | 等价 | NFR-001 | GET | 混合（推荐需 token） | ✅ 通过 | 高流量组合基线 |
| UAT-062 | POST /api/auth/register、PUT /api/users/me/password | POST /api/auth/register、PUT /api/users/me/password | 直接 | NFR-002, REQ-007 | POST/PUT | 注册公开；改密需 token | ✅ 通过 | bcrypt 哈希存储 |
| UAT-063 | GET /api/users/me | GET /api/users/me | 直接 | NFR-002, CON-003 | GET | 需认证接口（错误密钥 token） | ✅ 通过 | JWT 校验与密钥注入 |
| UAT-064 | POST /api/articles/:id/publish | POST /api/articles/:id/publish | 直接 | NFR-003, REQ-012 | POST | 需博主 token | ✅ 通过 | 发布事务一致性 |
| UAT-065 | POST /api/articles/:id/publish（触发 Webhook） | POST /api/articles/:id/publish（触发 Webhook 分发） | 直接 | NFR-003, REQ-028 | POST | 需博主 token | ✅ 通过 | 失败记录留存 |
| UAT-066 | 不适用（vitest coverage 报告） | 不适用（vitest coverage 报告，无 HTTP 路由） | 直接 | NFR-004 | — | 不适用 | ✅ 通过 | 行覆盖率 ≥ 80% |
| UAT-067 | 不适用（静态结构断言） | 不适用（静态结构断言，无 HTTP 路由） | 直接 | NFR-005 | — | 不适用 | ✅ 通过 | 分层约束 |
| UAT-068 | POST /api/auth/login | POST /api/auth/login | 直接 | NFR-006, REQ-008 | POST | 无需认证（同 IP） | ✅ 通过 | 认证接口限流 429 |
| UAT-069 | GET /api/articles | GET /api/articles | 直接 | NFR-006 | GET | 无需认证（同 IP） | ✅ 通过 | 通用 API 限流 429 |
| UAT-070 | 不适用（依赖清单断言） | 不适用（依赖清单断言，无 HTTP 路由） | 直接 | CON-001 | — | 不适用 | ✅ 通过 | 技术栈约束 |
| UAT-071 | POST /api/auth/register、GET /api/users/me、GET /api/articles/art-nonexist、POST /api/tags | POST /api/auth/register、GET /api/users/me、GET /api/articles/art-nonexist（404 兜底）、POST /api/tags | 直接 | CON-002 | 混合 | 混合 | ✅ 通过 | 统一错误结构 |
| UAT-072 | POST /api/auth/login | POST /api/auth/login | 直接 | CON-003, REQ-008 | POST | 无需认证 | ✅ 通过 | JWT 24h 与密钥注入 |
| UAT-073 | POST /api/auth/login、POST /api/articles/:id/publish、DELETE /api/articles/:id | POST /api/auth/login、POST /api/articles/:id/publish、DELETE /api/articles/:id | 直接 | CON-004 | 混合 | 混合 | ✅ 通过 | 审计日志与保留 |
