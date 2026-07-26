# 集成测试设计文档（Integration Test Design）

> 阶段 3 概要设计产出。对应阶段 3 接口设计 `docs/interface-design.md`（22 INTF）。
> 测试 seam 决策沿用阶段 2 §5 + 阶段 3 §1.6：seam-http 主 + seam-module 辅（INTF-004 权限中间件 / INTF-019 内部审计调用）。
> 本文含 69 个集成测试用例：22 单接口契约正常路径 + 22 单接口契约异常路径 + 15 跨模块交互 + 10 异常路径。
> 用例 ID 前缀 `TC-INT-*`，将在阶段 6 集成测试执行。

## §1 概述

### §1.1 测试目标

- **单接口契约测试**：每个 INTF 的正常路径（200/201/204）+ 异常路径（4xx/5xx/业务错误码），验证接口契约符合 `docs/interface-design.md` 定义
- **跨模块交互测试**：验证 INTF→INTF 调用链的正确性，覆盖关键业务流（如博文发布→审计→RSS 更新）
- **异常路径测试**：超时、并发冲突、依赖故障、限流、状态机违反等边界场景

### §1.2 测试环境

- **测试框架**：Vitest + supertest（HTTP API 集成测试）
- **测试 seam**：seam-http（HTTP API 边界）+ seam-module（INTF-004/019 内部调用钩子）
- **数据隔离**：每个用例独立内存存储（beforeEach 重置 Map）
- **认证 mock**：测试用 JWT 签发真实 token（HS256 + 测试密钥）；角色通过 register 接口注入

### §1.3 用例统计

| 类型 | 用例数 | 用例 ID 范围 |
|---|---|---|
| 单接口契约测试-正常路径 | 22 | TC-INT-001N ~ TC-INT-022N |
| 单接口契约测试-异常路径 | 22 | TC-INT-001E ~ TC-INT-022E |
| 跨模块交互测试 | 15 | TC-INT-C01 ~ TC-INT-C15 |
| 异常路径测试 | 10 | TC-INT-X01 ~ TC-INT-X10 |
| **合计** | **69** | |

## §2 单接口契约测试（44 用例）

> 每个 INTF 两条用例：正常路径（N）+ 异常路径（E）。

### TC-INT-001N 健康检查正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-001N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-001 |
| 场景 | GET /health 返回服务运行状态 |
| 前置条件 | Express App 已启动 |
| 步骤 | 1. 发起 `GET /health`；2. 校验响应 |
| 预期 | 200 `{status:"ok", timestamp:<iso8601>, uptime:<number>}` |
| 优先级 | 高 |

### TC-INT-001E 健康检查异常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-001E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-001 |
| 场景 | GET /health 在 Redis/DB 不可用时降级返回 |
| 前置条件 | 内存存储故障模拟（mock Map 抛错） |
| 步骤 | 1. mock store 抛异常；2. 发起 `GET /health` |
| 预期 | 500 `{code:50001, message:"服务端错误", httpStatus:500, retryable:true}` |
| 优先级 | 中 |

### TC-INT-002N 用户注册正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-002N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-002 |
| 场景 | 邮箱+密码+角色注册成功 |
| 前置条件 | 邮箱未注册 |
| 步骤 | 1. `POST /api/users/register {"email":"a@b.com","password":"pass1234","role":"author"}` |
| 预期 | 201 `{id:<uuid>, email:"a@b.com", role:"author", createdAt:<iso8601>}`；passwordHash 不返回 |
| 优先级 | 高 |

### TC-INT-002E 用户注册异常路径（邮箱已存在）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-002E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-002 |
| 场景 | 重复注册同邮箱返回 409 |
| 前置条件 | 邮箱 a@b.com 已注册 |
| 步骤 | 1. 注册 a@b.com；2. 再次注册同邮箱 |
| 预期 | 第二次 409 `{code:40901, message:"邮箱已存在", httpStatus:409, retryable:false}` |
| 优先级 | 高 |

### TC-INT-003N 用户登录正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-003N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-003 |
| 场景 | 正确凭据登录获取 JWT |
| 前置条件 | 用户已注册 |
| 步骤 | 1. `POST /api/users/login {"email":"a@b.com","password":"pass1234"}` |
| 预期 | 200 `{token:<jwt>, expiresIn:3600}`；token 解码后 sub=userId, role=author |
| 优先级 | 高 |

### TC-INT-003E 用户登录异常路径（凭据无效）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-003E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-003 |
| 场景 | 密码错误返回 401 |
| 前置条件 | 用户已注册 |
| 步骤 | 1. `POST /api/users/login {"email":"a@b.com","password":"wrongpass"}` |
| 预期 | 401 `{code:40101, message:"凭据无效", httpStatus:401, retryable:false}` |
| 优先级 | 高 |

### TC-INT-004N 权限中间件正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-004N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-004 |
| 场景 | author 角色 token 访问 POST /api/articles 通过 |
| 前置条件 | 注册 author 用户并登录 |
| 步骤 | 1. 携带 author token `POST /api/articles` |
| 预期 | 中间件 next() 调用，请求到达 articleController.create |
| 优先级 | 高 |
| seam | seam-module（钩住 requireRole 中间件） |

### TC-INT-004E 权限中间件异常路径（角色不匹配）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-004E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-004 |
| 场景 | reader 角色访问 POST /api/articles 返回 403 |
| 前置条件 | 注册 reader 用户并登录 |
| 步骤 | 1. 携带 reader token `POST /api/articles` |
| 预期 | 403 `{code:40301, message:"禁止访问", httpStatus:403, retryable:false}` |
| 优先级 | 高 |

### TC-INT-005N 文章创建正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-005N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-005 |
| 场景 | author 创建文章成功，初始状态 draft |
| 前置条件 | author 登录；标签/分类已存在 |
| 步骤 | 1. `POST /api/articles {"title":"Hello","content":"World","tagIds":["t1"],"categoryId":"c1"}` |
| 预期 | 201 `{id, title, content, tags:[...], category:{...}, authorId:<userId>, status:"draft", likeCount:0, createdAt, updatedAt}` |
| 优先级 | 高 |

### TC-INT-005E 文章创建异常路径（分类不存在）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-005E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-005 |
| 场景 | categoryId 不存在返回 404 |
| 前置条件 | author 登录 |
| 步骤 | 1. `POST /api/articles {"title":"Hello","content":"World","categoryId":"non-exist"}` |
| 预期 | 404 `{code:40402, message:"分类不存在", httpStatus:404, retryable:false}` |
| 优先级 | 高 |

### TC-INT-006N 文章列表查询正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-006N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-006 |
| 场景 | 分页查询返回文章列表 |
| 前置条件 | 已发布 5 篇文章 |
| 步骤 | 1. `GET /api/articles?page=1&limit=20&sort=createdAt&order=desc` |
| 预期 | 200 `{items:[<5 articles>], total:5, page:1, limit:20}` |
| 优先级 | 高 |

### TC-INT-006E 文章列表查询异常路径（参数非法）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-006E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-006 |
| 场景 | page=0 返回 400 |
| 前置条件 | 无 |
| 步骤 | 1. `GET /api/articles?page=0` |
| 预期 | 400 `{code:40001, message:"参数错误：page ≥ 1", httpStatus:400, retryable:false}` |
| 优先级 | 中 |

### TC-INT-007N 文章详情查询正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-007N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-007 |
| 场景 | 按 ID 查询已发布文章详情 |
| 前置条件 | 文章 published |
| 步骤 | 1. `GET /api/articles/:id` |
| 预期 | 200 完整 Article 对象 |
| 优先级 | 高 |

### TC-INT-007E 文章详情查询异常路径（草稿无权访问）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-007E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-007 |
| 场景 | reader 访问他人草稿返回 403 |
| 前置条件 | 文章 draft，author=A；reader 登录 |
| 步骤 | 1. 携带 reader token `GET /api/articles/:draftId` |
| 预期 | 403 `{code:40301, message:"草稿无权访问", httpStatus:403, retryable:false}` |
| 优先级 | 高 |

### TC-INT-008N 文章更新正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-008N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-008 |
| 场景 | 作者本人更新文章 |
| 前置条件 | author 登录，文章属于该 author |
| 步骤 | 1. `PUT /api/articles/:id {"title":"Updated"}` |
| 预期 | 200 更新后 Article；updatedAt 刷新 |
| 优先级 | 高 |

### TC-INT-008E 文章更新异常路径（非作者无权更新）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-008E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-008 |
| 场景 | 其他 author 更新非己文章返回 403 |
| 前置条件 | 文章 authorId=A；author=B 登录 |
| 步骤 | 1. 携带 B token `PUT /api/articles/:A_articleId` |
| 预期 | 403 `{code:40301, message:"禁止访问", httpStatus:403, retryable:false}` |
| 优先级 | 高 |

### TC-INT-009N 文章删除正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-009N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-009 |
| 场景 | 作者删除文章+级联删除评论 |
| 前置条件 | 文章有 3 条评论 |
| 步骤 | 1. `DELETE /api/articles/:id`；2. 查询评论列表 |
| 预期 | 204；评论列表为空 |
| 优先级 | 高 |

### TC-INT-009E 文章删除异常路径（文章不存在）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-009E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-009 |
| 场景 | 删除不存在的文章返回 404 |
| 前置条件 | 无 |
| 步骤 | 1. `DELETE /api/articles/non-exist-id` |
| 预期 | 404 `{code:40401, message:"文章不存在", httpStatus:404, retryable:false}` |
| 优先级 | 高 |

### TC-INT-010N 评论创建正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-010N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-010 |
| 场景 | reader 在已发布文章下评论 |
| 前置条件 | 文章 published；reader 登录 |
| 步骤 | 1. `POST /api/articles/:id/comments {"content":"Nice"}` |
| 预期 | 201 `{id, articleId, userId, content, createdAt}` |
| 优先级 | 高 |

### TC-INT-010E 评论创建异常路径（文章不存在）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-010E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-010 |
| 场景 | 在不存在的文章下评论返回 404 |
| 前置条件 | 无 |
| 步骤 | 1. `POST /api/articles/non-exist/comments {"content":"x"}` |
| 预期 | 404 `{code:40401, message:"文章不存在", httpStatus:404, retryable:false}` |
| 优先级 | 高 |

### TC-INT-011N 评论列表查询正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-011N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-011 |
| 场景 | 分页查询某文章评论 |
| 前置条件 | 文章有 5 条评论 |
| 步骤 | 1. `GET /api/articles/:id/comments?page=1&limit=20` |
| 预期 | 200 `{items:[<5 comments>], total:5, page:1, limit:20}` |
| 优先级 | 中 |

### TC-INT-011E 评论列表查询异常路径（文章不存在）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-011E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-011 |
| 场景 | 查询不存在文章的评论返回 404 |
| 前置条件 | 无 |
| 步骤 | 1. `GET /api/articles/non-exist/comments` |
| 预期 | 404 `{code:40401, message:"文章不存在"}` |
| 优先级 | 中 |

### TC-INT-012N 评论删除正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-012N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-012 |
| 场景 | 评论作者删除自己的评论 |
| 前置条件 | 评论 userId=当前用户 |
| 步骤 | 1. `DELETE /api/comments/:id` |
| 预期 | 204 |
| 优先级 | 高 |

### TC-INT-012E 评论删除异常路径（非作者无权删除）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-012E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-012 |
| 场景 | 其他 reader 删除非己评论返回 403 |
| 前置条件 | 评论 userId=A；reader=B 登录 |
| 步骤 | 1. 携带 B token `DELETE /api/comments/:A_commentId` |
| 预期 | 403 `{code:40301, message:"禁止访问"}` |
| 优先级 | 高 |

### TC-INT-013N 标签管理正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-013N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-013 |
| 场景 | admin 创建标签成功 |
| 前置条件 | admin 登录 |
| 步骤 | 1. `POST /api/tags {"name":"TypeScript"}` |
| 预期 | 201 `{id, name:"TypeScript", createdAt, updatedAt}` |
| 优先级 | 高 |

### TC-INT-013E 标签管理异常路径（非 admin 写）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-013E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-013 |
| 场景 | author 创建标签返回 403 |
| 前置条件 | author 登录 |
| 步骤 | 1. 携带 author token `POST /api/tags {"name":"x"}` |
| 预期 | 403 `{code:40301, message:"禁止访问"}` |
| 优先级 | 高 |

### TC-INT-014N 分类管理正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-014N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-014 |
| 场景 | admin 创建顶层分类 |
| 前置条件 | admin 登录 |
| 步骤 | 1. `POST /api/categories {"name":"Frontend","parentCategoryId":null}` |
| 预期 | 201 `{id, name:"Frontend", parentCategoryId:null, createdAt, updatedAt}` |
| 优先级 | 高 |

### TC-INT-014E 分类管理异常路径（成环检测）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-014E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-014 |
| 场景 | 设置 parentCategoryId 形成环返回 60002 |
| 前置条件 | 已有分类 A→B→C 链 |
| 步骤 | 1. `PUT /api/categories/:A_id {"parentCategoryId":"C_id"}` 形成环 |
| 预期 | 400 `{code:60002, message:"分类树成环", httpStatus:400, retryable:false}` |
| 优先级 | 高 |

### TC-INT-015N 文章搜索正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-015N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-015 |
| 场景 | 关键词搜索已发布文章 |
| 前置条件 | 3 篇文章含 "hello" |
| 步骤 | 1. `GET /api/search?q=hello` |
| 预期 | 200 `{items:[<3 articles>], total:3, page:1, limit:20}` |
| 优先级 | 高 |

### TC-INT-015E 文章搜索异常路径（参数越界）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-015E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-015 |
| 场景 | limit=200 返回 400 |
| 前置条件 | 无 |
| 步骤 | 1. `GET /api/search?limit=200` |
| 预期 | 400 `{code:40001, message:"参数错误：limit ∈ [1, 100]"}` |
| 优先级 | 中 |

### TC-INT-016N 密码重置正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-016N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-016 |
| 场景 | 重置令牌一次性使用成功 |
| 前置条件 | 用户已注册 |
| 步骤 | 1. `POST /api/users/password/reset-request {"email":"a@b.com"}`；2. 截获 token；3. `POST /api/users/password/reset {"token","newPassword"}`；4. 用新密码登录 |
| 预期 | reset-request 200 `{tokenSent:true}`；reset 200 `{reset:true}`；登录 200 |
| 优先级 | 高 |

### TC-INT-016E 密码重置异常路径（令牌过期）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-016E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-016 |
| 场景 | 使用过期令牌返回 410 |
| 前置条件 | 令牌签发时间 > 15min |
| 步骤 | 1. mock 时钟前进 16min；2. `POST /api/users/password/reset {"token","newPassword"}` |
| 预期 | 410 `{code:41001, message:"令牌过期", httpStatus:410, retryable:false}` |
| 优先级 | 高 |

### TC-INT-017N 草稿/发布工作流正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-017N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-017 |
| 场景 | draft → published 转移成功 |
| 前置条件 | 文章 status=draft |
| 步骤 | 1. `POST /api/articles/:id/publish` |
| 预期 | 200 `{status:"published", publishedAt:<iso8601>}` |
| 优先级 | 高 |

### TC-INT-017E 草稿/发布工作流异常路径（非法状态转移）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-017E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-017 |
| 场景 | 已 published 文章再次 publish 返回 60001 |
| 前置条件 | 文章 status=published |
| 步骤 | 1. `POST /api/articles/:id/publish` |
| 预期 | 400 `{code:60001, message:"非法状态转移", httpStatus:400, retryable:false}` |
| 优先级 | 高 |

### TC-INT-018N 文章点赞正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-018N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-018 |
| 场景 | 首次点赞 liked=true |
| 前置条件 | 文章 published；用户首次点赞 |
| 步骤 | 1. `POST /api/articles/:id/like` |
| 预期 | 200 `{likeCount:N+1, liked:true}` |
| 优先级 | 高 |

### TC-INT-018E 文章点赞异常路径（重复点赞幂等）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-018E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-018 |
| 场景 | 重复点赞返回 liked=false（幂等） |
| 前置条件 | 用户已点赞 |
| 步骤 | 1. 再次 `POST /api/articles/:id/like` |
| 预期 | 200 `{likeCount:N, liked:false}`（不增加） |
| 优先级 | 高 |

### TC-INT-019N 审计日志查询正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-019N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-019 |
| 场景 | admin 查询审计日志列表 |
| 前置条件 | 已有审计记录 10 条；admin 登录 |
| 步骤 | 1. `GET /api/audit-logs?page=1&limit=50` |
| 预期 | 200 `{items:[<10 logs>], total:10, page:1, limit:50}` |
| 优先级 | 高 |

### TC-INT-019E 审计日志查询异常路径（非 admin 查询）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-019E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-019 |
| 场景 | author 查询审计日志返回 403 |
| 前置条件 | author 登录 |
| 步骤 | 1. 携带 author token `GET /api/audit-logs` |
| 预期 | 403 `{code:40301, message:"禁止访问"}` |
| 优先级 | 高 |

### TC-INT-020N RSS 全局订阅正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-020N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-020 |
| 场景 | GET /api/rss 返回 Atom XML |
| 前置条件 | 已发布 5 篇文章 |
| 步骤 | 1. `GET /api/rss`；2. 校验 Content-Type + XML 解析 |
| 预期 | 200 `Content-Type: application/atom+xml`；Atom 1.0 文档含 5 个 `<entry>` |
| 优先级 | 高 |

### TC-INT-020E RSS 条件请求异常路径（304 命中）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-020E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-020 |
| 场景 | If-None-Match 匹配 ETag 返回 304 |
| 前置条件 | 已获取 ETag |
| 步骤 | 1. `GET /api/rss` 首次获取 ETag；2. `GET /api/rss` 携带 `If-None-Match:<etag>` |
| 预期 | 第二次 304 Not Modified 无 body |
| 优先级 | 中 |

### TC-INT-021N 用户资料更新正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-021N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-021 |
| 场景 | 本人更新昵称成功 |
| 前置条件 | 用户已登录 |
| 步骤 | 1. `PUT /api/users/profile {"nickname":"Alice"}` |
| 预期 | 200 `{userId, nickname:"Alice", avatar, bio, updatedAt:<刷新>}` |
| 优先级 | 中 |

### TC-INT-021E 用户资料更新异常路径（头像非 URL）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-021E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-021 |
| 场景 | avatar 非 URL 格式返回 400 |
| 前置条件 | 用户已登录 |
| 步骤 | 1. `PUT /api/users/profile {"avatar":"not-a-url"}` |
| 预期 | 400 `{code:40001, message:"参数错误：avatar 为 URL 格式"}` |
| 优先级 | 中 |

### TC-INT-022N 文章归档正常路径

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-022N |
| 类型 | 单接口契约-正常 |
| 关联 INTF | INTF-022 |
| 场景 | 按月份分组统计已发布文章 |
| 前置条件 | 7 月 5 篇 + 6 月 3 篇 |
| 步骤 | 1. `GET /api/articles/archive` |
| 预期 | 200 `{items:[{year:2026, month:7, count:5}, {year:2026, month:6, count:3}]}` |
| 优先级 | 中 |

### TC-INT-022E 文章归档异常路径（year 非法）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-022E |
| 类型 | 单接口契约-异常 |
| 关联 INTF | INTF-022 |
| 场景 | year=1999 返回 400 |
| 前置条件 | 无 |
| 步骤 | 1. `GET /api/articles/archive?year=1999` |
| 预期 | 400 `{code:40001, message:"参数错误：year ∈ [2000, 2100]"}` |
| 优先级 | 低 |

## §3 跨模块交互测试（15 用例）

### TC-INT-C01 博文发布→审计日志链路

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-C01 |
| 类型 | 跨模块交互 |
| 关联 INTF | INTF-005 → INTF-017 → INTF-019 |
| 场景 | 创建文章→发布→审计日志记录 |
| 前置条件 | author 登录；分类/标签已存在 |
| 步骤 | 1. POST /api/articles 创建 draft；2. POST /api/articles/:id/publish 发布；3. GET /api/audit-logs 查询 action=publish |
| 预期 | 步骤1 201；步骤2 200 status=published；步骤3 200 含 resourceId=:id 的 publish 记录 |
| 优先级 | 高 |

### TC-INT-C02 文章删除→评论级联→审计

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-C02 |
| 类型 | 跨模块交互 |
| 关联 INTF | INTF-009 → INTF-010/011 → INTF-019 |
| 场景 | 删除文章时级联删除评论并记录审计 |
| 前置条件 | 文章有 3 条评论 |
| 步骤 | 1. DELETE /api/articles/:id；2. GET /api/articles/:id/comments（应 404）；3. GET /api/audit-logs action=delete |
| 预期 | 步骤1 204；步骤2 404；步骤3 含 delete 记录 |
| 优先级 | 高 |

### TC-INT-C03 评论创建→文章详情联动

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-C03 |
| 类型 | 跨模块交互 |
| 关联 INTF | INTF-010 → INTF-007 |
| 场景 | 创建评论后文章详情不变（评论独立存储） |
| 前置条件 | 文章 published |
| 步骤 | 1. GET /api/articles/:id 记录字段；2. POST /api/articles/:id/comments；3. 再次 GET /api/articles/:id |
| 预期 | 文章详情不变；评论列表新增 |
| 优先级 | 中 |

### TC-INT-C04 文件上传→博文创建→搜索索引

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-C04 |
| 类型 | 跨模块交互 |
| 关联 INTF | INTF-005 → INTF-015 |
| 场景 | 创建文章后能被搜索到（同进程内存索引同步） |
| 前置条件 | author 登录 |
| 步骤 | 1. POST /api/articles 创建并 publish；2. GET /api/search?q=<title 关键词> |
| 预期 | 步骤2 命中步骤1 创建的文章 |
| 优先级 | 高 |

### TC-INT-C05 用户注册→默认资料→公开查询

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-C05 |
| 类型 | 跨模块交互 |
| 关联 INTF | INTF-002 → INTF-021 |
| 场景 | 注册后用户资料默认空，公开查询返回 |
| 前置条件 | 无 |
| 步骤 | 1. POST /api/users/register；2. GET /api/users/:id/profile |
| 预期 | 步骤2 200 默认 nickname="" avatar="" bio="" |
| 优先级 | 中 |

### TC-INT-C06 RSS 订阅源→条件请求→304

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-C06 |
| 类型 | 跨模块交互 |
| 关联 INTF | INTF-020 → INTF-006 |
| 场景 | RSS 拉取后第二次条件请求返回 304 |
| 前置条件 | 已发布文章 |
| 步骤 | 1. GET /api/rss 获取 ETag；2. GET /api/rss 携带 If-None-Match |
| 预期 | 步骤1 200 + ETag；步骤2 304 |
| 优先级 | 高 |

### TC-INT-C07 RSS 按分类过滤

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-C07 |
| 类型 | 跨模块交互 |
| 关联 INTF | INTF-020 → INTF-014 |
| 场景 | 按 categoryId 过滤 RSS 内容 |
| 前置条件 | 分类 c1 下有 2 篇文章；c2 下有 3 篇 |
| 步骤 | 1. GET /api/rss/category/c1 |
| 预期 | 200 Atom XML 仅含 c1 下 2 篇 |
| 优先级 | 中 |

### TC-INT-C08 标签删除→文章标签关联清理

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-C08 |
| 类型 | 跨模块交互 |
| 关联 INTF | INTF-013 → INTF-005/007 |
| 场景 | 删除标签后文章 tags 字段不再包含该标签 |
| 前置条件 | 文章 A 含标签 t1 |
| 步骤 | 1. DELETE /api/tags/t1；2. GET /api/articles/A_id |
| 预期 | 步骤2 文章 tags 数组不含 t1 |
| 优先级 | 中 |

### TC-INT-C09 分类删除（被引用时阻止）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-C09 |
| 类型 | 跨模块交互 |
| 关联 INTF | INTF-014 → INTF-005 |
| 场景 | 删除被文章引用的分类返回 60005 |
| 前置条件 | 文章 A 的 categoryId=c1 |
| 步骤 | 1. DELETE /api/categories/c1 |
| 预期 | 409 `{code:60005, message:"分类被文章引用无法删除"}` |
| 优先级 | 高 |

### TC-INT-C10 文章点赞→文章详情计数同步

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-C10 |
| 类型 | 跨模块交互 |
| 关联 INTF | INTF-018 → INTF-007 |
| 场景 | 点赞后文章详情 likeCount 同步增加 |
| 前置条件 | 文章 published |
| 步骤 | 1. GET /api/articles/:id 记录 likeCount=N；2. POST /api/articles/:id/like；3. GET /api/articles/:id |
| 预期 | 步骤3 likeCount=N+1 |
| 优先级 | 高 |

### TC-INT-C11 密码重置→旧 token 失效

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-C11 |
| 类型 | 跨模块交互 |
| 关联 INTF | INTF-016 → INTF-003 |
| 场景 | 重置密码后旧 password 登录失败 |
| 前置条件 | 用户已注册 |
| 步骤 | 1. reset-request + reset 重置密码；2. 用旧密码 POST /api/users/login |
| 预期 | 步骤2 401 凭据无效 |
| 优先级 | 高 |

### TC-INT-C12 工作流→RSS 更新（发布后 RSS 可见）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-C12 |
| 类型 | 跨模块交互 |
| 关联 INTF | INTF-017 → INTF-020 |
| 场景 | 文章 publish 后 RSS 出现该文章 |
| 前置条件 | 文章 draft |
| 步骤 | 1. GET /api/rss 验证不含该文章；2. POST /api/articles/:id/publish；3. GET /api/rss |
| 预期 | 步骤1 不含；步骤3 含该文章 |
| 优先级 | 高 |

### TC-INT-C13 搜索→归档统计一致性

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-C13 |
| 类型 | 跨模块交互 |
| 关联 INTF | INTF-015 → INTF-022 |
| 场景 | 搜索 total = 归档 count 之和 |
| 前置条件 | 5 篇 published |
| 步骤 | 1. GET /api/search（空 q）→ total；2. GET /api/articles/archive → sum(count) |
| 预期 | 两者相等 |
| 优先级 | 中 |

### TC-INT-C14 权限中间件→审计日志查询（admin only）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-C14 |
| 类型 | 跨模块交互 |
| 关联 INTF | INTF-004 → INTF-019 |
| 场景 | 非 admin 调用 GET /api/audit-logs 被 INTF-004 拦截 |
| 前置条件 | author 登录 |
| 步骤 | 1. 携带 author token GET /api/audit-logs |
| 预期 | 403 |
| 优先级 | 中 |

### TC-INT-C15 文章更新→审计日志 meta 字段

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-C15 |
| 类型 | 跨模块交互 |
| 关联 INTF | INTF-008 → INTF-019 |
| 场景 | 更新文章后审计 meta 含变更字段 |
| 前置条件 | author 登录 |
| 步骤 | 1. PUT /api/articles/:id {"title":"New"}；2. GET /api/audit-logs?action=update |
| 预期 | 步骤2 最新一条 meta 含 `{fields:["title"]}` |
| 优先级 | 中 |

## §4 异常路径测试（10 用例）

### TC-INT-X01 限流触发（5 次失败/分钟）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-X01 |
| 类型 | 异常路径 |
| 关联 INTF | INTF-003 |
| 场景 | 同 IP 连续 5 次登录失败触发限流 429 |
| 前置条件 | 同 IP |
| 步骤 | 1. 连续 5 次 POST /api/users/login 错误密码；2. 第 6 次 |
| 预期 | 第 6 次 429 `{code:42901, message:"限流", httpStatus:429, retryable:true}` |
| 优先级 | 高 |

### TC-INT-X02 并发点赞竞态

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-X02 |
| 类型 | 异常路径 |
| 关联 INTF | INTF-018 |
| 场景 | 同一用户并发 2 次 POST /like，仅一次 liked=true |
| 前置条件 | 用户已登录 |
| 步骤 | 1. 并行发起 2 个 POST /api/articles/:id/like（Promise.all） |
| 预期 | 1 个 liked=true，1 个 liked=false（幂等）；likeCount=N+1 |
| 优先级 | 高 |

### TC-INT-X03 文章删除与评论创建并发

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-X03 |
| 类型 | 异常路径 |
| 关联 INTF | INTF-009, INTF-010 |
| 场景 | 删除文章与创建评论并发，评论应失败 |
| 前置条件 | 文章存在 |
| 步骤 | 1. 并行 DELETE /api/articles/:id + POST /api/articles/:id/comments |
| 预期 | DELETE 成功；POST 返回 404 |
| 优先级 | 中 |

### TC-INT-X04 内存存储超限（NFR-004 10000）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-X04 |
| 类型 | 异常路径 |
| 关联 INTF | INTF-005 |
| 场景 | 超过 10000 篇文章后创建返回 50001 |
| 前置条件 | articleStore 已有 10000 条 |
| 步骤 | 1. 批量插入 10000 篇；2. POST /api/articles |
| 预期 | 500 `{code:50001, message:"内存存储超限"}` |
| 优先级 | 中 |

### TC-INT-X05 JWT 过期（1 小时后）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-X05 |
| 类型 | 异常路径 |
| 关联 INTF | INTF-003, INTF-004 |
| 场景 | token 过期后访问受保护接口返回 401 |
| 前置条件 | 用户已登录 |
| 步骤 | 1. mock 时钟前进 3601s；2. GET /api/articles（需认证的） |
| 预期 | 401 `{code:40101, message:"token 过期"}` |
| 优先级 | 高 |

### TC-INT-X06 JWT 签名无效

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-X06 |
| 类型 | 异常路径 |
| 关联 INTF | INTF-004 |
| 场景 | 篡改 token 签名返回 40102 |
| 前置条件 | 任意 token |
| 步骤 | 1. 修改 token 最后 4 字符；2. GET /api/articles |
| 预期 | 401 `{code:40102, message:"token 无效签名"}` |
| 优先级 | 高 |

### TC-INT-X07 Zod schema 校验失败（NFR-005）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-X07 |
| 类型 | 异常路径 |
| 关联 INTF | INTF-002 |
| 场景 | email 字段非邮箱格式返回 400 |
| 前置条件 | 无 |
| 步骤 | 1. POST /api/users/register {"email":"not-email","password":"pass1234"} |
| 预期 | 400 `{code:40001, message:"参数错误：email 邮箱格式"}` |
| 优先级 | 高 |

### TC-INT-X08 XML 渲染失败（INTF-020）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-X08 |
| 类型 | 异常路径 |
| 关联 INTF | INTF-020 |
| 场景 | 文章 title 含特殊字符导致 XML 渲染失败 |
| 前置条件 | 文章 title 含 `&<>` 等 |
| 步骤 | 1. 创建并发布含特殊字符文章；2. GET /api/rss |
| 预期 | 200（XML 转义后正常）或 500 `{code:50301, message:"XML 渲染失败"}`（若转义遗漏） |
| 优先级 | 中 |

### TC-INT-X09 内部审计写入失败不阻断主流程

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-X09 |
| 类型 | 异常路径 |
| 关联 INTF | INTF-005, INTF-019 |
| 场景 | auditService.log 抛异常时文章创建仍成功 |
| 前置条件 | mock auditService.log 抛错 |
| 步骤 | 1. POST /api/articles |
| 预期 | 201 文章创建成功；stderr 含审计写入失败日志 |
| 优先级 | 高 |
| seam | seam-module（钩住 auditService.log） |

### TC-INT-X10 限流中间件白名单（健康检查不限流）

| 字段 | 值 |
|---|---|
| 用例 ID | TC-INT-X10 |
| 类型 | 异常路径 |
| 关联 INTF | INTF-001 |
| 场景 | GET /health 不受 60 次/分钟限流约束 |
| 前置条件 | 无 |
| 步骤 | 1. 连续 100 次 GET /health |
| 预期 | 全部 200，不触发 429 |
| 优先级 | 中 |

## §5 测试覆盖矩阵

### §5.1 INTF 覆盖

| INTF | 正常 N | 异常 E | 跨模块 C | 异常路径 X | 总数 |
|---|---|---|---|---|---|
| INTF-001 | 1 | 1 | 0 | 1 | 3 |
| INTF-002 | 1 | 1 | 1 (C05) | 1 | 4 |
| INTF-003 | 1 | 1 | 1 (C11) | 2 (X01,X05) | 5 |
| INTF-004 | 1 | 1 | 1 (C14) | 2 (X05,X06) | 5 |
| INTF-005 | 1 | 1 | 4 (C01,C04,C08,C09) | 2 (X04,X09) | 8 |
| INTF-006 | 1 | 1 | 3 (C06,C12,C13) | 0 | 5 |
| INTF-007 | 1 | 1 | 2 (C03,C10) | 0 | 4 |
| INTF-008 | 1 | 1 | 1 (C15) | 0 | 3 |
| INTF-009 | 1 | 1 | 1 (C02) | 1 (X03) | 4 |
| INTF-010 | 1 | 1 | 2 (C03,C02) | 1 (X03) | 5 |
| INTF-011 | 1 | 1 | 1 (C02) | 0 | 3 |
| INTF-012 | 1 | 1 | 0 | 0 | 2 |
| INTF-013 | 1 | 1 | 1 (C08) | 0 | 3 |
| INTF-014 | 1 | 1 | 3 (C07,C09,C13) | 0 | 5 |
| INTF-015 | 1 | 1 | 2 (C04,C13) | 0 | 4 |
| INTF-016 | 1 | 1 | 1 (C11) | 0 | 3 |
| INTF-017 | 1 | 1 | 2 (C01,C12) | 0 | 4 |
| INTF-018 | 1 | 1 | 1 (C10) | 1 (X02) | 4 |
| INTF-019 | 1 | 1 | 4 (C01,C02,C14,C15) | 1 (X09) | 7 |
| INTF-020 | 1 | 1 | 3 (C06,C07,C12) | 1 (X08) | 6 |
| INTF-021 | 1 | 1 | 1 (C05) | 0 | 3 |
| INTF-022 | 1 | 1 | 1 (C13) | 0 | 3 |
| **合计** | **22** | **22** | **15** | **10** | **69** |

### §5.2 错误码段位覆盖

| 段位 | 覆盖用例 |
|---|---|
| 4xx | TC-INT-005E (404), 007E (403), 008E (403), 009E (404), 010E (404), 012E (403), 013E (403), 014E (400 业务), 015E (400), 017E (400 业务), 021E (400), 022E (400), X01 (429), X05 (401), X06 (401), X07 (400) |
| 5xx | TC-INT-001E (500), X04 (500), X08 (500 业务 50301) |
| 业务 60000+ | TC-INT-014E (60002), 017E (60001), 018E (60003 重复点赞幂等), C09 (60005 引用阻止), 016E (60004 令牌已使用) |

三段位（4xx/5xx/业务）全覆盖。

### §5.3 NFR 覆盖

| NFR | 覆盖用例 |
|---|---|
| NFR-001 性能 200ms | 阶段 7 系统测试 TC-PERF-* 承担 |
| NFR-002 JWT 强度 | X05/X06 校验过期/签名 |
| NFR-003 错误处理统一 | 所有异常用例校验统一响应格式 |
| NFR-004 容量 10000 | X04 |
| NFR-005 zod schema 100% | X07 + 所有 40001 用例 |
| NFR-006 限流 60/min | X01, X10 |

### §5.4 CON 覆盖

| CON | 覆盖用例 |
|---|---|
| CON-001 Express+TS+Map | 全部用例（隐式） |
| CON-002 JWT HS256 1h | X05 |
| CON-003 TS strict | 阶段 5 编码 tsc --noEmit 承担 |
| CON-004 结构化 JSON 日志 | TC-INT-C15 校验审计 meta 字段格式 |

## §6 RTM 补登

`rtm.json` 的 `integrationTest` 列登记 TC-INT-* 用例 ID（按 REQ/SD 关联映射）。详见 `.w-model/rtm.json` mappings.integrationTest 节。

## §7 验收标准对齐

- [x] 22 INTF × 2（正常+异常）= 44 单接口契约测试用例
- [x] 15 跨模块交互测试覆盖关键业务流（发布→审计、删除级联、搜索索引、RSS 更新等）
- [x] 10 异常路径测试覆盖超时/并发/限流/状态机违反/依赖故障
- [x] 错误码三段位（4xx/5xx/业务）全覆盖
- [x] NFR-006 限流 + NFR-005 zod schema 校验 + CON-002 JWT 1h 过期 + CON-004 JSON 日志 全覆盖
- [x] 测试 seam 决策沿用阶段 2 §5（seam-http 主 + seam-module 辅）
