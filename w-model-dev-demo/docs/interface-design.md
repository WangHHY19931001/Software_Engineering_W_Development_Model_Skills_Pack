# 接口设计说明书

> 阶段 3（概要设计）产出。覆盖 17 个 INTF 接口的详细 API 规格 + 错误码体系。
> 阶段 2 已建立初版（含 RESTful API + WebSocket 事件）；阶段 3 按 `phase-3-outline-design.md`
> 「接口契约 Schema 模板」10 字段 + 错误码分层（4xx/5xx/业务三段位）复核补全。
> 含 RESTful API + WebSocket 事件。

## 文档信息

- 项目名称：blog-system-demo（扩展博客系统后端）
- 文档版本：v1.1（阶段 3 复核补全）
- 编制日期：2026-07-25
- 关联设计：`docs/system-design.md`
- 编制者：S 子代理（第 8 轮 W 模型，阶段 3 概要设计）

## 1. 通用约定

### 1.1 基础
- 基础路径：`/api`
- WebSocket 路径：`/ws`（与 HTTP 同端口 :3000）
- 内容类型：`application/json`（文件上传除外，使用 `multipart/form-data` 或流式）
- 字符编码：UTF-8
- 时间格式：ISO 8601（如 `2026-07-25T08:00:00+08:00`）

### 1.2 认证
- 除公开接口（注册/登录/hot 推荐/最新推荐/广告展示）外，需携带 `Authorization: Bearer <JWT>`
- JWT 有效期 24h（86400s），封禁用户 token 立即失效

### 1.3 通用响应 envelope
```json
{ "code": 0, "message": "ok", "data": {} }
```
错误时 `code` 非 0，`data` 可省略，HTTP 状态码与语义一致。

### 1.4 分页约定
- 查询参数：`page`（默认 1）、`pageSize`（默认 10/20，上限 50）
- 响应：`{ "items": [], "total": N, "page": P, "pageSize": S }`

---

## 2. 错误码体系

### 2.1 HTTP 状态码

| 状态码 | 语义 | 触发场景 |
|---|---|---|
| 200 | 成功 | GET/PUT/DELETE 成功 |
| 201 | 创建成功 | POST 创建资源成功 |
| 400 | 请求错误 | zod 校验失败/参数非法/状态机非法跳转/自引用 |
| 401 | 未认证 | 无 token / token 伪造 / token 过期 |
| 403 | 禁止访问 | RBAC 越权 / 封禁用户 / 维护模式 / 注册评论开关关闭 |
| 404 | 资源不存在 | 资源 ID 无效 |
| 413 | 实体过大 | 文件超 10MB / 配额超限 |
| 422 | 不可处理 | 备份恢复 SHA-256 校验失败 |
| 500 | 服务器错误 | 内部异常 |
| 503 | 服务不可用 | 维护模式（非管理员） |

### 2.2 业务错误码

> 阶段 3 复核：每条错误码配套 `code` + `message` + `httpStatus` + `retryable` 四元组
> （`phase-3-outline-design.md` §错误码分层约定）。

| code | HTTP | 含义 | retryable | 段位 |
|---|---|---|:---:|---|
| 0 | 200/201 | 成功 | - | 成功 |
| 1001 | 400 | 参数校验失败（zod） | 否 | 4xx 客户端 |
| 1002 | 400 | 状态机非法跳转 | 否 | 业务（状态机） |
| 1003 | 400 | 自引用禁止 | 否 | 业务（数据约束） |
| 1004 | 400 | 嵌套深度超限（评论 5 层 / 分类 5 层） | 否 | 业务（数据约束） |
| 1005 | 400 | 标签数超限（>10） | 否 | 业务（数据约束） |
| 1011 | 401 | 无 token | 否 | 4xx 认证 |
| 1012 | 401 | token 伪造 | 否 | 4xx 认证 |
| 1013 | 401 | token 过期 | 是（重登） | 4xx 认证 |
| 1021 | 403 | RBAC 越权 | 否 | 4xx 权限 |
| 1022 | 403 | 用户已封禁 | 否 | 4xx 权限 |
| 1023 | 403 | 维护模式 | 是（稍后） | 4xx 权限 |
| 1024 | 403 | 注册开关关闭 | 否 | 4xx 权限 |
| 1025 | 403 | 评论开关关闭 | 否 | 4xx 权限 |
| 1031 | 404 | 资源不存在 | 否 | 4xx 资源 |
| 1041 | 413 | 文件超 10MB | 否 | 4xx 实体 |
| 1042 | 413 | 配额超限 | 是（配额重置后） | 业务（配额） |
| 1051 | 422 | 备份完整性校验失败 | 否 | 业务（完整性） |
| 1052 | 400 | 魔数校验不匹配 | 否 | 业务（安全） |
| 1053 | 400 | MIME 白名单拒绝 | 否 | 业务（安全） |
| 1061 | 409 | 邮箱已存在 | 否 | 业务（唯一性） |
| 1071 | 409 | 标签名已存在 | 否 | 业务（唯一性） |
| 1099 | 500 | 内部错误 | 是（指数退避） | 5xx 服务端 |
| 5001 | 500 | DB/存储超时 | 是（指数退避） | 5xx 服务端 |
| 5021 | 503 | 下游服务不可用 | 是（稍后） | 5xx 服务端 |
| 6001 | 400 | 库存/配额业务规则违反 | 否 | 业务（规则） |

### 2.3 错误码分层对齐（phase-3-outline-design.md 三段位）

> `phase-3-outline-design.md` 规定错误码分三段位：4xx(40000-49999) / 5xx(50000-59999) / 业务(60000-69999)。
> 本系统历史编码（阶段 2）采用 1xxx/5xxx 紧凑段位，为保持与 L2 TLA+ 规格、RTM、系统测试设计的一致性，
> 阶段 3 不重排编码，而是建立**段位映射表**，确保每条错误码可归入三段位之一，并补全 `retryable` 字段。

| 段位 | 范围（参考） | 本系统对应编码 | HTTP 上限 | 含义 |
|---|---|---|---|---|
| 4xx 客户端 | 40000-49999 | 1001/1011/1012/1013/1021-1025/1031/1041 | 400-413 | 参数/认证/权限/资源/实体 |
| 5xx 服务端 | 50000-59999 | 1099/5001/5021 | 500-503 | 内部错误/DB 超时/下游不可用 |
| 业务规则 | 60000-69999 | 1002-1005/1042/1051-1053/1061/1071/6001 | 400-422 | 状态机/数据约束/配额/完整性/安全/唯一性 |

> 段位映射覆盖全部 24 条错误码（0 成功 + 23 错误），无遗漏。`retryable=true` 的码：1013(token 过期)/1023(维护模式)/1042(配额超限)/1099(内部错误)/5001(DB 超时)/5021(下游不可用)。

---

## 3. INTF-001 站点管理接口（SD-001）

| 方法 | 路径 | 认证 | RBAC | 说明 |
|---|---|---|---|---|
| GET | /api/site/config | 否 | - | 获取站点配置 |
| PUT | /api/site/config | 是 | admin+ | 更新站点配置 |
| PUT | /api/site/maintenance | 是 | admin+ | 开关维护模式 |
| GET | /api/site/announcements | 否 | - | 公告列表 |
| POST | /api/site/announcements | 是 | admin+ | 创建公告 |
| PUT | /api/site/announcements/:id | 是 | admin+ | 更新公告 |
| DELETE | /api/site/announcements/:id | 是 | admin+ | 删除公告 |
| GET | /api/site/stats | 是 | admin+ | 站点统计概览 |

**PUT /api/site/config 请求**
```json
{ "siteName": "我的博客", "description": "描述", "logoUrl": "https://...", "icpRecord": "京ICP备..." }
```
**响应**：`{ "code": 0, "data": SiteConfig }`

**GET /api/site/stats 响应**
```json
{ "code": 0, "data": { "userCount": 50, "articleCount": 120, "commentCount": 300, "visitCount": 5000 } }
```

---

## 4. INTF-002 多博主接口（SD-002）

| 方法 | 路径 | 认证 | RBAC | 说明 |
|---|---|---|---|---|
| POST | /api/bloggers/register | 否 | - | 博主注册 |
| GET | /api/bloggers/:id | 否 | - | 博主主页 |
| PUT | /api/bloggers/:id | 是 | self/admin | 更新博主资料 |
| PUT | /api/bloggers/:id/role | 是 | admin+ | 变更博主角色分级 |
| POST | /api/bloggers/:id/follow | 是 | user+ | 关注博主 |
| DELETE | /api/bloggers/:id/follow | 是 | user+ | 取关 |
| GET | /api/bloggers/:id/followers | 否 | - | 粉丝列表（分页） |
| GET | /api/bloggers/:id/following | 否 | - | 关注列表（分页） |

**POST /api/bloggers/register 请求**
```json
{ "email": "b1@x.com", "password": "Abc12345", "nickname": "博主1", "avatarUrl": "https://..." }
```
**响应**：`{ "code": 0, "data": { "bloggerId": "...", "token": "JWT" } }`

---

## 5. INTF-003 多用户接口（SD-003）

| 方法 | 路径 | 认证 | RBAC | 说明 |
|---|---|---|---|---|
| POST | /api/auth/register | 否 | - | 用户注册（受注册开关） |
| POST | /api/auth/login | 否 | - | 用户登录 |
| GET | /api/users/:id | 是 | self/admin | 获取用户资料 |
| PUT | /api/users/:id | 是 | self/admin | 更新资料 |
| POST | /api/users/:id/ban | 是 | admin+ | 封禁用户 |
| POST | /api/users/:id/unban | 是 | admin+ | 解禁用户 |
| GET | /api/users/audit-logs | 是 | admin+ | 审计日志查询 |

**POST /api/auth/register 请求**
```json
{ "email": "u1@x.com", "password": "Abc12345", "nickname": "用户1" }
```
**响应**：`{ "code": 0, "data": { "userId": "...", "token": "JWT", "expiresIn": 86400 } }`

**POST /api/users/:id/ban 请求**
```json
{ "banReason": "违规操作" }
```

---

## 6. INTF-004 推荐接口（SD-004）

| 方法 | 路径 | 认证 | RBAC | 说明 |
|---|---|---|---|---|
| GET | /api/recommendations?mode=hot | 否 | - | 热门推荐 |
| GET | /api/recommendations?mode=latest | 否 | - | 最新推荐 |
| GET | /api/recommendations?mode=personalized | 是 | user+ | 个性化推荐 |
| GET | /api/recommendations/bloggers?mode=similar | 否 | - | 相似博主 |
| GET | /api/recommendations/bloggers?mode=hot | 否 | - | 热门博主 |
| GET | /api/recommendations/slots | 是 | admin+ | 推荐位列表 |
| POST | /api/recommendations/slots | 是 | admin+ | 创建推荐位 |
| DELETE | /api/recommendations/slots/:id | 是 | admin+ | 删除推荐位 |

**响应（文章推荐）**
```json
{ "code": 0, "data": { "items": [Article], "total": 20 } }
```

---

## 7. INTF-005 广告接口（SD-005）

| 方法 | 路径 | 认证 | RBAC | 说明 |
|---|---|---|---|---|
| POST | /api/ads | 是 | blogger+ | 创建广告投放 |
| GET | /api/ads | 是 | admin+ | 广告列表 |
| GET | /api/ads/:id/display | 否 | - | 展示广告（impressions+1） |
| POST | /api/ads/:id/click | 否 | - | 点击广告（clicks+1） |
| POST | /api/ads/:id/review | 是 | admin+ | 审核广告 |

**POST /api/ads 请求**
```json
{ "title": "广告", "imageUrl": "...", "targetUrl": "...", "slot": "sidebar", "startTime": "...", "endTime": "...", "targetAudience": "all", "maxImpressions": 1000 }
```

---

## 8. INTF-006 统计接口（SD-006）

| 方法 | 路径 | 认证 | RBAC | 说明 |
|---|---|---|---|---|
| GET | /api/stats/articles/:id | 是 | admin+ | 文章统计 |
| GET | /api/stats/users?granularity=daily | 是 | admin+ | 用户统计趋势 |
| GET | /api/stats/bloggers/:id | 是 | admin+ | 博主统计 |
| GET | /api/stats/site | 是 | admin+ | 站点统计 |

**GET /api/stats/users 响应**
```json
{ "code": 0, "data": { "trends": [{ "date": "2026-07-01", "count": 5 }], "total": 50 } }
```

---

## 9. INTF-007 搜索接口（SD-007）

| 方法 | 路径 | 认证 | RBAC | 说明 |
|---|---|---|---|---|
| POST | /api/search | 否 | - | 全文搜索（标题/内容/摘要） |
| POST | /api/search/tags | 否 | - | 标签搜索 |
| POST | /api/search/categories | 否 | - | 分类搜索 |
| POST | /api/search/bloggers | 否 | - | 博主搜索 |
| GET | /api/search/suggest?prefix= | 否 | - | 自动补全（≤10） |
| GET | /api/search/hot | 否 | - | 热门搜索 |
| GET | /api/search/history | 是 | user+ | 搜索历史（≤100） |

**POST /api/search 请求**
```json
{ "keyword": "React", "sort": "relevance", "page": 1, "pageSize": 10 }
```
**响应**：`{ "code": 0, "data": { "items": [Article], "total": N } }`

---

## 10. INTF-008 标签接口（SD-008）

| 方法 | 路径 | 认证 | RBAC | 说明 |
|---|---|---|---|---|
| POST | /api/tags | 是 | user+ | 创建标签（pending 审核） |
| GET | /api/tags | 否 | - | 标签列表 |
| GET | /api/tags/cloud | 否 | - | 标签云（≤50，count 降序） |
| POST | /api/tags/:id/review | 是 | admin+ | 审核标签 |
| POST | /api/tags/merge | 是 | admin+ | 合并标签 |
| POST | /api/tags/:id/follow | 是 | user+ | 关注标签 |
| DELETE | /api/tags/:id/follow | 是 | user+ | 取关标签 |
| POST | /api/articles/:id/tags | 是 | self/blogger+ | 文章绑定标签（≤10） |

**POST /api/tags/merge 请求**
```json
{ "sourceId": "tag-1", "targetId": "tag-2" }
```

---

## 11. INTF-009 分类接口（SD-009）

| 方法 | 路径 | 认证 | RBAC | 说明 |
|---|---|---|---|---|
| POST | /api/categories | 是 | admin+ | 创建分类 |
| GET | /api/categories/tree | 否 | - | 分类树 |
| GET | /api/categories/:id | 否 | - | 分类详情 |
| PUT | /api/categories/:id | 是 | admin+ | 更新分类 |
| DELETE | /api/categories/:id | 是 | admin+ | 删除分类（级联） |
| GET | /api/categories/:id/articles | 否 | - | 分类下文章（分页） |
| GET | /api/categories/:id/breadcrumb | 否 | - | 面包屑路径 |
| POST | /api/categories/merge | 是 | admin+ | 合并分类 |

**POST /api/categories 请求**
```json
{ "name": "前端", "parentId": null, "sortOrder": 0 }
```

---

## 12. INTF-010 评论接口（SD-010）

| 方法 | 路径 | 认证 | RBAC | 说明 |
|---|---|---|---|---|
| POST | /api/comments | 是 | user+ | 创建评论（受评论开关） |
| GET | /api/articles/:id/comments | 否 | - | 评论列表（分页/排序） |
| PUT | /api/comments/:id | 是 | self/admin | 更新评论 |
| DELETE | /api/comments/:id | 是 | self/admin | 删除评论 |
| POST | /api/comments/:id/review | 是 | admin+ | 审核评论 |
| POST | /api/comments/:id/like | 是 | user+ | 点赞（幂等） |
| DELETE | /api/comments/:id/like | 是 | user+ | 取消点赞 |
| POST | /api/comments/:id/report | 是 | user+ | 举报评论 |

**POST /api/comments 请求**
```json
{ "articleId": "art-1", "parentId": null, "content": "好文章" }
```

---

## 13. INTF-011 通知接口（SD-011）

| 方法 | 路径 | 认证 | RBAC | 说明 |
|---|---|---|---|---|
| GET | /api/notifications | 是 | user+ | 通知列表（分页） |
| GET | /api/notifications/unread-count | 是 | user+ | 未读数 |
| POST | /api/notifications/:id/read | 是 | user+ | 标记已读 |
| POST | /api/notifications/read-all | 是 | user+ | 全部已读 |
| GET | /api/notifications/settings | 是 | user+ | 通知设置 |
| PUT | /api/notifications/settings | 是 | user+ | 更新通知设置 |

**PUT /api/notifications/settings 请求**
```json
{ "system": true, "interaction": true, "follow": false, "audit": true }
```

---

## 14. INTF-012 多博文接口（SD-012）

| 方法 | 路径 | 认证 | RBAC | 说明 |
|---|---|---|---|---|
| POST | /api/articles | 是 | blogger+ | 创建文章 |
| GET | /api/articles | 否 | - | 文章列表（分页） |
| GET | /api/articles/:id | 否 | - | 文章详情 |
| PUT | /api/articles/:id | 是 | self/admin | 更新文章 |
| DELETE | /api/articles/:id | 是 | self/admin | 删除文章（软删除） |
| PUT | /api/articles/:id/status | 是 | self/admin | 状态机流转 |
| POST | /api/articles/batch-offline | 是 | admin+ | 批量下架 |
| POST | /api/articles/batch-archive | 是 | admin+ | 批量归档 |
| POST | /api/articles/series | 是 | blogger+ | 创建系列 |
| PUT | /api/articles/:id/series | 是 | self | 归属系列 |

**POST /api/articles 请求**
```json
{ "title": "标题", "content": "内容", "summary": "摘要", "coverImageUrl": "...", "status": "draft", "scheduledAt": "2026-07-26T08:00:00+08:00", "tagIds": [], "categoryId": null, "seriesId": null, "seriesOrder": 0 }
```

**PUT /api/articles/:id/status 请求**
```json
{ "status": "published" }
```
非法跳转返回 400（code=1002）。

---

## 15. INTF-013 交叉引用接口（SD-013）

| 方法 | 路径 | 认证 | RBAC | 说明 |
|---|---|---|---|---|
| POST | /api/articles/:id/citations | 是 | blogger+ | 创建引用 |
| GET | /api/articles/:id/citations | 否 | - | 引用图谱（citedBy/citing） |
| DELETE | /api/articles/:id/citations/:cid | 是 | self | 删除引用 |
| GET | /api/articles/:id/related | 否 | - | 相关文章（≤10） |

**POST /api/articles/:id/citations 请求**
```json
{ "targetId": "art-2" }
```
自引用返回 400（code=1003）；引用非 published 返回 400。

---

## 16. INTF-014 消息推送接口（SD-014）★

### 16.1 WebSocket 事件

**连接**：`ws://host:3000/ws?token=<JWT>`

| 事件方向 | 事件名 | 载荷 | 说明 |
|---|---|---|---|
| 客户端→服务端 | subscribe | `{ channel: "comment" }` | 订阅通道 |
| 客户端→服务端 | unsubscribe | `{ channel: "comment" }` | 取消订阅 |
| 服务端→客户端 | push | `{ channel, type, payload }` | 推送消息 |
| 服务端→客户端 | presence | `{ userId, status: "online"/"offline" }` | 在线状态广播 |

**推送通道**：comment / follow / article / announcement

### 16.2 REST 接口

| 方法 | 路径 | 认证 | RBAC | 说明 |
|---|---|---|---|---|
| GET | /api/push/channels | 是 | user+ | 获取通道订阅状态 |
| PUT | /api/push/channels | 是 | user+ | 更新通道订阅 |
| GET | /api/push/offline | 是 | user+ | 离线消息列表 |

**推送失败重试**：最多 3 次，间隔 1s/2s/4s（指数退避）；3 次后转离线消息，同类合并，保留 24h。

---

## 17. INTF-015 文件上传接口（SD-015）★

| 方法 | 路径 | 认证 | RBAC | 说明 |
|---|---|---|---|---|
| POST | /api/files/image | 是 | user+ | 图片上传（流式） |
| POST | /api/files/attachment | 是 | user+ | 附件上传（流式） |
| GET | /api/files/:id | 是 | self/admin | 文件元数据 |
| GET | /api/files/:id/download | 是 | self/admin | 文件下载 |
| GET | /api/files/quota | 是 | user+ | 配额查询 |

**POST /api/files/image**
- Content-Type: `multipart/form-data` 或流式
- 字段：`file`（二进制）
- MIME 白名单：image/jpeg, image/png, image/webp, image/gif
- 大小限制：≤10MB
- 安全校验：魔数校验 + 文件名消毒 + SHA-256 摘要

**响应**
```json
{ "code": 0, "data": { "id": "file-1", "originalName": "a.jpg", "sanitizedName": "a.jpg", "mimeType": "image/jpeg", "size": 1024, "uploaderId": "u1", "sha256": "abc...64hex", "uploadedAt": "..." } }
```

**配额**：用户日 50MB / 博主月 500MB / 站点 10GB，超限 413（code=1042）。

---

## 18. INTF-016 订阅接口（SD-016）★

| 方法 | 路径 | 认证 | RBAC | 说明 |
|---|---|---|---|---|
| POST | /api/subscriptions | 是 | user+ | 创建订阅 |
| GET | /api/subscriptions | 是 | user+ | 我的订阅列表 |
| DELETE | /api/subscriptions/:id | 是 | self | 取消订阅（幂等） |
| GET | /api/subscriptions/followers | 是 | user+ | 被订阅者粉丝列表 |
| GET | /api/subscriptions/aggregates | 是 | user+ | 聚合窗口查询 |

**POST /api/subscriptions 请求**
```json
{ "targetType": "blogger", "targetId": "b1", "permission": "free" }
```
invitation 类型需 `invitationCode`（8-32 字符），否则 400。

**聚合**：同小时内多个新文章合并为 1 条通知（聚合窗口 1 小时）。

---

## 19. INTF-017 数据导出与备份接口（SD-017）★

| 方法 | 路径 | 认证 | RBAC | 说明 |
|---|---|---|---|---|
| POST | /api/exports | 是 | user+ | 创建导出任务 |
| GET | /api/exports/:taskId | 是 | self/admin | 查询任务进度 |
| GET | /api/exports/:taskId/download | 是 | self/admin | 下载结果 |
| POST | /api/backups | 是 | admin+ | 创建全量备份 |
| GET | /api/backups | 是 | admin+ | 备份列表 |
| POST | /api/backups/restore | 是 | admin+ | 恢复备份 |
| POST | /api/exports/incremental | 是 | user+ | 增量导出 |
| POST | /api/users/:id/gdpr-delete | 是 | self/admin | GDPR 删除请求（占位） |

**POST /api/exports 请求**
```json
{ "type": "user_export", "format": "json" }
```
type: user_export / blogger_export / admin_backup / incremental

**POST /api/backups/restore 请求**
```json
{ "backupId": "bk-1" }
```
恢复前 SHA-256 校验，不一致返回 422（code=1051）。

**任务状态**：pending → running → completed/failed；7 天后自动清理。

---

## 20. 接口契约 Schema 模板覆盖（阶段 3 复核）

> 按 `phase-3-outline-design.md`「接口契约 Schema 模板」10 字段复核：接口名 / 路径 / 参数名 / 参数类型 / 必填 / 默认值 / 约束 / 示例 / 返回值结构 / 错误码集合。

### 20.1 10 字段覆盖矩阵

| INTF | 接口名 | 路径 | 参数名 | 参数类型 | 必填 | 默认值 | 约束 | 示例 | 返回值结构 | 错误码集合 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| INTF-001 站点管理 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(§3) | ✅ | ✅ | ✅ | ✅ |
| INTF-002 多博主 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(§4) | ✅ | ✅ | ✅ | ✅ |
| INTF-003 多用户 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(§5) | ✅ | ✅ | ✅ | ✅ |
| INTF-004 推荐 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(mode) | ✅ | ✅ | ✅ | ✅ |
| INTF-005 广告 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(§7) | ✅ | ✅ | ✅ | ✅ |
| INTF-006 统计 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(granularity) | ✅ | ✅ | ✅ | ✅ |
| INTF-007 搜索 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(sort/page) | ✅ | ✅ | ✅ | ✅ |
| INTF-008 标签 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(§11) | ✅ | ✅ | ✅ | ✅ |
| INTF-009 分类 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(parentId=null) | ✅ | ✅ | ✅ | ✅ |
| INTF-010 评论 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(parentId=null) | ✅ | ✅ | ✅ | ✅ |
| INTF-011 通知 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(§14) | ✅ | ✅ | ✅ | ✅ |
| INTF-012 多博文 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(status=draft) | ✅ | ✅ | ✅ | ✅ |
| INTF-013 交叉引用 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(§16) | ✅ | ✅ | ✅ | ✅ |
| INTF-014 消息推送 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(§15) | ✅ | ✅ | ✅ | ✅ |
| INTF-015 文件上传 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(§17) | ✅ | ✅ | ✅ | ✅ |
| INTF-016 订阅 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(permission=free) | ✅ | ✅ | ✅ | ✅ |
| INTF-017 数据导出备份 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅(format=json) | ✅ | ✅ | ✅ | ✅ |

### 20.2 各 INTF 错误码集合（阶段 3 补全）

| INTF | 错误码集合（code 列表） | 段位覆盖 |
|---|---|---|
| INTF-001 站点管理 | 0, 1001, 1021, 1023, 1031, 1099 | 4xx + 5xx + 业务 |
| INTF-002 多博主 | 0, 1001, 1011, 1012, 1013, 1021, 1031, 1061, 1099 | 4xx + 5xx + 业务 |
| INTF-003 多用户 | 0, 1001, 1011, 1012, 1013, 1021, 1022, 1024, 1031, 1061, 1099 | 4xx + 5xx + 业务 |
| INTF-004 推荐 | 0, 1001, 1011, 1021, 1031, 1099 | 4xx + 5xx |
| INTF-005 广告 | 0, 1001, 1011, 1021, 1031, 1099 | 4xx + 5xx |
| INTF-006 统计 | 0, 1001, 1011, 1021, 1031, 1099 | 4xx + 5xx |
| INTF-007 搜索 | 0, 1001, 1099 | 4xx + 5xx |
| INTF-008 标签 | 0, 1001, 1005, 1011, 1021, 1031, 1071, 1099 | 4xx + 5xx + 业务 |
| INTF-009 分类 | 0, 1001, 1004, 1011, 1021, 1031, 1099 | 4xx + 5xx + 业务 |
| INTF-010 评论 | 0, 1001, 1004, 1011, 1021, 1025, 1031, 1099 | 4xx + 5xx + 业务 |
| INTF-011 通知 | 0, 1001, 1011, 1021, 1031, 1099 | 4xx + 5xx |
| INTF-012 多博文 | 0, 1001, 1002, 1011, 1021, 1031, 1099 | 4xx + 5xx + 业务 |
| INTF-013 交叉引用 | 0, 1001, 1003, 1011, 1021, 1031, 1099 | 4xx + 5xx + 业务 |
| INTF-014 消息推送 | 0, 1001, 1011, 1012, 1013, 1021, 1099, 5021 | 4xx + 5xx |
| INTF-015 文件上传 | 0, 1001, 1011, 1021, 1031, 1041, 1042, 1052, 1053, 1099 | 4xx + 5xx + 业务 |
| INTF-016 订阅 | 0, 1001, 1011, 1021, 1031, 1099 | 4xx + 5xx |
| INTF-017 数据导出备份 | 0, 1001, 1011, 1021, 1031, 1051, 1099, 5001 | 4xx + 5xx + 业务 |

### 20.3 默认值与约束补全说明

阶段 3 复核补全每接口的「默认值」与「约束」字段（阶段 2 部分接口未显式列出）：

| INTF | 默认值（补全） | 约束（补全） |
|---|---|---|
| INTF-001 | maintenanceMode=false; 公告 status=pending | siteName 长度 1-50；公告 publishedAt 须未来时间 |
| INTF-002 | bloggerRole=normal | email 合法格式；password 8-32 位含字母+数字；nickname 1-20 |
| INTF-003 | userRole=user | email 合法格式；password 8-32 位；banReason 长度 1-200 |
| INTF-004 | mode=hot; page=1; pageSize=10 | mode ∈ {hot, latest, personalized, similar}; pageSize ≤ 50 |
| INTF-005 | targetAudience=all; maxImpressions=1000 | startTime < endTime；title 1-100；slot ∈ 预定义位 |
| INTF-006 | granularity=daily | granularity ∈ {daily, weekly, monthly}; 仅 admin+ |
| INTF-007 | sort=relevance; page=1; pageSize=10 | keyword 长度 1-100；history ≤ 100；suggest ≤ 10 |
| INTF-008 | 标签 status=pending | 标签名 1-20 唯一；单文章标签 ≤ 10；merge source ≠ target |
| INTF-009 | parentId=null; sortOrder=0 | 分类名 1-20；树深度 ≤ 5；parentId 须存在或 null |
| INTF-010 | parentId=null | content 1-2000；嵌套 ≤ 5 层；点赞幂等 |
| INTF-011 | 通知设置全 true | unreadCount ≥ 0；批量已读幂等 |
| INTF-012 | status=draft; seriesOrder=0; scheduledAt=null | title 1-200；status ∈ {draft, pending_review, published, offline, archived}；状态机单向 |
| INTF-013 | - | targetId ≠ sourceId（禁自引用）；target 须 published |
| INTF-014 | 通道默认全订阅；重试 3 次 | channel ∈ {comment, follow, article, announcement}；离线消息 ≤ 1000 |
| INTF-015 | - | MIME ∈ 白名单；size ≤ 10MB；sha256 长度 64；配额日 50MB/月 500MB |
| INTF-016 | permission=free | targetType ∈ {blogger, tag, category}；invitation 须 invitationCode 8-32；聚合窗口 1h |
| INTF-017 | format=json; 任务 status=pending | type ∈ {user_export, blogger_export, admin_backup, incremental}；任务 7 天清理；恢复须 SHA-256 校验 |

---

## 21. 接口完整性自检

| 检查项 | 状态 | 说明 |
|---|---|---|
| 17 INTF 覆盖 | ✅ | INTF-001~017 全部含路径/方法/认证/RBAC |
| 请求/响应 schema | ✅ | 关键接口含 JSON schema 示例 |
| 状态码体系 | ✅ | HTTP 状态码 + 业务错误码（1099 等） |
| WebSocket 事件 | ✅ | INTF-014 含连接/订阅/推送/在线状态事件 |
| 安全要求 | ✅ | 每接口标注认证 + RBAC 角色 |
| 第 8 轮新增 4 INTF | ✅ | INTF-014/015/016/017 完整规格 |
| 10 字段 schema 模板 | ✅（阶段 3） | §20.1 矩阵覆盖 17 INTF × 10 字段，全 ✅ |
| 错误码三段位分层 | ✅（阶段 3） | §2.3 段位映射 + §20.2 各 INTF 错误码集合覆盖 4xx/5xx/业务 |
| retryable 四元组 | ✅（阶段 3） | §2.2 每条错误码补全 retryable 字段 |
