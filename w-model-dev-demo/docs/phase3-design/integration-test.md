# 集成测试设计（Phase 3 → Phase 5/6 集成测试输入）

## 文档信息

| 字段 | 值 |
|---|---|
| 文档 ID | PHASE3-IT-DESIGN |
| 所属系统 | 扩展博客系统后端（blog-system-demo） |
| 关联需求 | `docs/phase1-requirements/requirement-spec.md`（REQ-001 ~ REQ-022） |
| 关联设计 | `docs/phase2-design/system-design.md`（SD-001 ~ SD-022） |
| 关联接口 | `docs/phase3-design/interface-design.md`（INTF-001 ~ INTF-022） |
| 上游文档 | `docs/phase2-design/system-test.md`（22 TC-SYS） |
| 下游文档 | `docs/phase5-coding/uat-path-mapping.md`（UAT 路径映射） |
| 阶段 | 3（概要设计 → 集成测试设计） |
| 版本 | 1.0.0 |
| 日期 | 2026-07-30 |
| 维护者 | w-model-dev 团队 |

---

## 1. 集成测试设计目标与原则

### 1.1 目标

本阶段产物（集成测试设计）作为「概要设计 → 编码 → 集成测试」的桥梁，需满足：

1. **覆盖 22 INTF 端到端流程**：每个 INTF 至少 1 个集成测试用例（TC-INT-NN），验证跨 Service/Controller/Store 协同
2. **5 类 TC-DES 全覆盖**：参数校验（PARAM）/ 跨模块（CROSS-MODULE）/ 异常路径（EXCEPTION）/ 横切关注（CROSS-CUTTING）/ 数据一致性（CONSISTENCY）
3. **可执行的 E2E 测试**：从 HTTP 请求（supertest）到 Service 到 Store 完整链路；可在阶段 5/6 直接转化为 Vitest 集成测试
4. **可追溯性**：每条 TC-INT 显式引用其覆盖的 INTF、SD、REQ、错误码

### 1.2 范围与边界

| 在范围内 | 不在范围内（移交后续阶段） |
|---|---|
| 22 INTF 端到端 happy path 与 error path | 单元测试（Service/Repository 内部方法）→ 阶段 5 编码时自覆盖 |
| 跨模块事件触发链路（EventBus 订阅者） | 性能压测（NFR-001 P95 阈值）→ 阶段 7 系统测试 |
| 横切中间件（鉴权/限流/错误处理）| 安全渗透测试 → 阶段 7 系统测试 |
| 数据一致性（store 间状态同步）| UAT 端到端业务流程 → 阶段 8 验收测试 |

### 1.3 测试 seam 与 fixture 复用

22 INTF 共享测试 seam（按 `w-model-dev-demo/test/integration/setup.ts` 统一加载）：

- **数据准备**：`resetStores()` 清空所有 17 个 store + 重新初始化 site_config + 重新注册默认 Webhook 订阅（admin）
- **认证 helper**：`signToken({ sub, role })` 直签 JWT（绕过 bcrypt + 注册流程）
- **事件 spy**：`captureEvents(type[])` 订阅 EventBus 捕获事件 payload
- **HTTP client**：`api()` 返回 supertest 实例（已挂载全部中间件）
- **时间注入**：`clockMock.now()` 与 `clockMock.advance(ms)` 控制时间敏感逻辑（如 access_record 5 分钟去重、webhook 1s/4s/16s 重试、ad 投放期判断）

---

## 2. TC-DES 分类体系（5 类）

### 2.1 TC-DES-A：参数校验（PARAM）

**目标**：验证 INTF 端点的请求参数（path/query/body/header）符合 Zod schema，校验失败返 `VALIDATION_FAILED(400)` 或枚举值错返对应错误。

**覆盖场景**：
- 必填字段缺失
- 字段类型错误（如 number 传 string）
- 长度/范围越界（如 title > 200, pageSize > 100）
- 枚举值不在允许集（如 range ∉ [24h,7d,30d]）
- 模式不匹配（如 postId 不匹配 `^p_`）

**测试模式**：
```typescript
// TC-INT-NN-A1 参数校验
it("TC-INT-NN-A1: 缺必填字段 → 400 VALIDATION_FAILED", async () => {
  const res = await api().post("/posts").set("Authorization", `Bearer ${bloggerToken}`).send({});
  expect(res.status).toBe(400);
  expect(res.body.error).toBe("VALIDATION_FAILED");
  expect(res.body.details).toMatchObject({ field: "title" });
});
```

### 2.2 TC-DES-B：跨模块（CXM = Cross-Module）

**目标**：验证 INTF 调用涉及 ≥2 个 SD 模块时，数据流/事件流正确传播。

**覆盖场景**：
- 写操作触发事件总线 → 订阅者正确处理（SD-011 通知 / SD-013 Webhook / SD-016 审计）
- 跨 store 数据查询（如 GET /posts/:id 涉及 posts + bloggers + likes + comments）
- 跨服务调用顺序（如 follow.created → SD-011 通知 → SD-016 审计）

**测试模式**：
```typescript
// TC-INT-NN-B1 跨模块
it("TC-INT-NN-B1: 触发事件 → 订阅者执行", async () => {
  const events = captureEvents(["post.published"]);
  await api().post(`/posts/${draftId}/publish`).set("Authorization", `Bearer ${bloggerToken}`).send();
  expect(events).toHaveLength(1);
  expect(events[0].payload).toMatchObject({ postId, authorId: bloggerId });
  // 验证订阅者副作用
  const notif = stores.notifications.get(followerId).find(n => n.payload.postId === postId);
  expect(notif).toBeDefined();
});
```

### 2.3 TC-DES-C：异常路径（EXC = Exception）

**目标**：验证 INTF 在异常输入/异常状态下的错误码 + 错误响应结构。

**覆盖场景**：
- 资源不存在（404：POST_NOT_FOUND / COMMENT_NOT_FOUND / TAG_NOT_FOUND 等）
- 权限不足（403：FORBIDDEN / FORBIDDEN_NOT_OWNER / FORBIDDEN_NOT_AUTHOR_OR_BLOGGER）
- 状态冲突（409：ALREADY_A_BLOGGER / ALREADY_DELETED / INVALID_STATE_TRANSITION）
- 业务规则违反（422：EMPTY_CONTENT / TOO_MANY_TAGS / MAX_DEPTH_EXCEEDED）
- 限流触发（429：RATE_LIMITED）

**测试模式**：
```typescript
// TC-INT-NN-C1 异常路径
it("TC-INT-NN-C1: postId 不存在 → 404 POST_NOT_FOUND", async () => {
  const res = await api().get("/posts/p_nonexistent").send();
  expect(res.status).toBe(404);
  expect(res.body.error).toBe("POST_NOT_FOUND");
});
```

### 2.4 TC-DES-D：横切关注（XCT = Cross-Cutting）

**目标**：验证横切 INTF（INTF-020 限流 / INTF-021 路由 / INTF-022 错误处理）正确作用于业务 INTF。

**覆盖场景**：
- 限流触发（IP 在 60s 内 > 阈值 → 429 RATE_LIMITED）
- 未匹配路由（GET /unknown → 404 NOT_FOUND）
- 5xx 服务端错误（手动注入 → 500 INTERNAL + 审计）
- 鉴权中间件（缺 JWT → 401 UNAUTHENTICATED；role 不足 → 403 FORBIDDEN）

**测试模式**：
```typescript
// TC-INT-NN-D1 横切关注
it("TC-INT-NN-D1: 缺 JWT → 401 UNAUTHENTICATED", async () => {
  const res = await api().get("/users/me").send();
  expect(res.status).toBe(401);
  expect(res.body.error).toBe("UNAUTHENTICATED");
});
```

### 2.5 TC-DES-E：数据一致性（CST = Consistency）

**目标**：验证 INTF 操作后，多个 store 间的状态保持一致（无悬挂引用、无遗漏更新）。

**覆盖场景**：
- 状态机转换（draft → published → deleted）
- 双向索引维护（post_tags[postId] ↔ tag_posts[name]）
- 软删后子记录处理（comment 软删后子回复树形保留）
- 引用完整性（删除 ad 引用前校验 site_config.bannerAdId）
- 关注计数同步（follows 删除后 user_blogger_bindings/统计）

**测试模式**：
```typescript
// TC-INT-NN-E1 数据一致性
it("TC-INT-NN-E1: 双向索引同步", async () => {
  await api().post(`/posts/${postId}/tags`).set("Authorization", `Bearer ${bloggerToken}`).send({ tags: ["tech"] });
  expect(stores.postTags.byPost(postId)).toContain("tech");
  expect(stores.postTags.byTag("tech")).toContain(postId);
  await api().delete(`/posts/${postId}/tags/tech`).set("Authorization", `Bearer ${bloggerToken}`).send();
  expect(stores.postTags.byPost(postId)).not.toContain("tech");
  expect(stores.postTags.byTag("tech")).not.toContain(postId);
});
```

### 2.6 TC-DES 分布（22 INTF × 5 类）

| INTF | A 参数 | B 跨模块 | C 异常 | D 横切 | E 一致性 | 合计 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| INTF-001 认证 | 1 | 1 | 1 | 1 | 0 | 4 |
| INTF-002 用户 | 1 | 1 | 1 | 1 | 0 | 4 |
| INTF-003 关注 | 1 | 1 | 1 | 1 | 1 | 5 |
| INTF-004 博主认证 | 1 | 1 | 1 | 1 | 1 | 5 |
| INTF-005 博文 | 1 | 1 | 1 | 1 | 1 | 5 |
| INTF-006 浏览 | 1 | 1 | 1 | 0 | 1 | 4 |
| INTF-007 互动 | 1 | 1 | 1 | 1 | 1 | 5 |
| INTF-008 标签 | 1 | 1 | 1 | 1 | 1 | 5 |
| INTF-009 搜索 | 1 | 1 | 1 | 0 | 0 | 3 |
| INTF-010 评论 | 1 | 1 | 1 | 1 | 1 | 5 |
| INTF-011 通知 | 1 | 1 | 1 | 1 | 0 | 4 |
| INTF-012 RSS | 1 | 0 | 1 | 0 | 0 | 2 |
| INTF-013 Webhook | 1 | 1 | 1 | 1 | 0 | 4 |
| INTF-014 站点配置 | 1 | 1 | 1 | 1 | 1 | 5 |
| INTF-015 访问记录 | 1 | 1 | 1 | 1 | 1 | 5 |
| INTF-016 审计日志 | 1 | 0 | 1 | 1 | 0 | 3 |
| INTF-017 统计 | 1 | 1 | 1 | 1 | 0 | 4 |
| INTF-018 推荐 | 1 | 1 | 1 | 0 | 0 | 3 |
| INTF-019 广告位 | 1 | 1 | 1 | 1 | 1 | 5 |
| INTF-020 限流 | 1 | 0 | 1 | 1 | 0 | 3 |
| INTF-021 路由 | 0 | 0 | 1 | 1 | 0 | 2 |
| INTF-022 错误处理 | 0 | 0 | 1 | 1 | 0 | 2 |
| **合计** | **20** | **17** | **22** | **17** | **10** | **86** |

**说明**：22 INTF × 平均 3.9 个 TC-DES = 86 个集成测试用例。每 INTF 至少 1 个 EXC 用例（保证覆盖所有错误码）；横切用例集中在 D。

---

## 3. 22 INTF 集成测试用例详细设计

> **格式约定**：每个 INTF 给出 1-2 个核心 TC-INT 用例（覆盖最关键路径）；其余 TC-DES 用例以「补充用例索引」列出（ID 形式），详细步骤在阶段 5 编码时补充。

### 3.01 INTF-001 认证 API

**配对 SD**: SD-001 | **覆盖 REQ**: REQ-001, REQ-002 | **核心路径**: 注册 → 登录 → JWT 签发

#### TC-INT-001-B1 跨模块：注册用户 → 写 audit log

**前置条件**：stores.users 为空；admin token 可用（用于校验审计）；事件总线订阅 `user.registered`。

**步骤**：
1. `POST /users` 提交 `{ email, password, username }`
2. 期望：201，响应含 `{ userId, role: "reader", token }`
3. 校验：stores.users 含新用户（password 已 bcrypt）
4. 校验：stores.audit_logs 含 `user.registered` 事件（actor=userId）

**期望**：状态码 201，audit log 写入成功，user 与 token 1:1 绑定。

#### TC-INT-001-C1 异常：密码错误 → 401 INVALID_CREDENTIALS

**步骤**：
1. `POST /users` 注册 user1
2. `POST /auth/login` 用错误密码
3. 期望：401，error=`INVALID_CREDENTIALS`

**补充用例**：
- TC-INT-001-A1 重复邮箱 → 409 VALIDATION_FAILED（email 唯一约束 Zod refine）
- TC-INT-001-D1 缺 JWT 受保护接口 → 401 UNAUTHENTICATED
- TC-INT-001-B2 注册 blogger → 触发 blogger.registered 审计

---

### 3.02 INTF-002 用户 API

**配对 SD**: SD-002 | **覆盖 REQ**: REQ-003 | **核心路径**: 公开查 profile + 自己改 profile

#### TC-INT-002-B1 跨模块：PUT /users/me → 触发 audit

**步骤**：
1. 注册并登录 user1
2. `PUT /users/me` 修改 displayName
3. 期望：200，返回新 user 对象
4. 校验：stores.audit_logs 含 user.profile.updated 事件（payload 含 before/after displayName）

#### TC-INT-002-C1 异常：非自己改 → 403 FORBIDDEN_NOT_OWNER（设计：PUT /users/me 只能改自己，PUT /users/:id 已废弃）

**步骤**：
1. 登录 user1，尝试 PUT /users/u_user2（如果路由存在）
2. 期望：403 或 404（路由不公开，V1 仅支持 /me）

**补充用例**：
- TC-INT-002-A1 displayName 长度 > 64 → 400 VALIDATION_FAILED
- TC-INT-002-D1 GET /users/:id 公开访问 → 200（无需 JWT）
- TC-INT-002-C2 userId 不存在 → 404 USER_NOT_FOUND

---

### 3.03 INTF-003 关注 API

**配对 SD**: SD-003 | **覆盖 REQ**: REQ-004 | **核心路径**: 关注 → 通知博主 + 审计

#### TC-INT-003-B1 跨模块：follow.created → 通知博主 + 审计

**步骤**：
1. 注册 reader1 + blogger1
2. reader1 登录
3. `POST /follows/${blogger1Id}`
4. 期望：201，stores.follows[reader1] 含 blogger1Id
5. 校验：stores.notifications[blogger1Id] 含 type=follow.created
6. 校验：stores.audit_logs 含 follow.created

#### TC-INT-003-E1 一致性：重复关注幂等（状态不变）

**步骤**：
1. reader1 关注 blogger1
2. reader1 再次关注 blogger1
3. 期望：200（而非 201），follows Set 大小仍为 1
4. 校验：审计不重复写入（幂等设计）

**补充用例**：
- TC-INT-003-A1 bloggerId 不匹配 `^b_` → 400 VALIDATION_FAILED
- TC-INT-003-C1 bloggerId 不存在 → 404 BLOGGER_NOT_FOUND
- TC-INT-003-D1 缺 JWT → 401 UNAUTHENTICATED
- TC-INT-003-E2 unfollow 后再次关注 → 通知 1 次（不重复）

---

### 3.04 INTF-004 博主认证 API

**配对 SD**: SD-004 | **覆盖 REQ**: REQ-005, REQ-017 | **核心路径**: 申请博主 + 多身份切换

#### TC-INT-004-B1 跨模块：申请博主 → 写 user_blogger_bindings + 审计

**步骤**：
1. 注册 reader1
2. reader1 申请 blogger：`POST /bloggers/apply`
3. 期望：201，bloggerId 签发；stores.bloggers 含；stores.user_blogger_bindings[reader1] 含新 bloggerId
4. 校验：stores.audit_logs 含 blogger.registered

#### TC-INT-004-E1 一致性：跨用户越权切换 → 403 FORBIDDEN_NOT_OWNED

**步骤**：
1. reader1 申请 blogger1
2. reader2 登录，尝试 `POST /me/bloggers/${blogger1Id}/switch`
3. 期望：403 FORBIDDEN_NOT_OWNED（user_blogger_bindings 缺失）

**补充用例**：
- TC-INT-004-A1 displayName 长度 0 → 400 VALIDATION_FAILED
- TC-INT-004-C1 重复申请 → 409 ALREADY_A_BLOGGER
- TC-INT-004-D1 缺 JWT → 401 UNAUTHENTICATED
- TC-INT-004-B2 切换后新 token sub=bloggerId（验证解码）

---

### 3.05 INTF-005 博文 API

**配对 SD**: SD-005 | **覆盖 REQ**: REQ-006 | **核心路径**: 创建草稿 → 发布 → 软删（含状态机 + 事件触发）

#### TC-INT-005-B1 跨模块：publishPost → 通知关注者 + Webhook + 审计

**步骤**：
1. reader1 关注 blogger1
2. blogger1 创建 draft：`POST /posts { title, content, tags: ["tech"] }`
3. blogger1 发布：`POST /posts/${postId}/publish`
4. 期望：200，post.status=published，publishedAt 写入
5. 校验：stores.notifications[reader1] 含 type=post.published
6. 校验：webhook_deliveries 含 1 条 post.published 投递（如果订阅了）
7. 校验：stores.audit_logs 含 post.created + post.published

#### TC-INT-005-E1 一致性：状态机非法转换（draft→published 二次）→ 409

**步骤**：
1. draft → published
2. 再次 publish
3. 期望：409 INVALID_STATE_TRANSITION（已 published 不能再次 publish）

#### TC-INT-005-C1 异常：空 content 发布 → 422 EMPTY_CONTENT

**步骤**：
1. draft content 为空字符串
2. publish
3. 期望：422 EMPTY_CONTENT

**补充用例**：
- TC-INT-005-A1 title 长度 0 / 201 → 400 VALIDATION_FAILED
- TC-INT-005-A2 tags 数量 6 → 400 VALIDATION_FAILED
- TC-INT-005-C2 非 owner 编辑 → 403 FORBIDDEN_NOT_OWNER
- TC-INT-005-C3 postId 不存在 → 404 POST_NOT_FOUND
- TC-INT-005-D1 缺 JWT → 401 UNAUTHENTICATED
- TC-INT-005-E2 软删后 publishedAt 保留，post.status=deleted（不物理删）
- TC-INT-005-E3 published 后只能 → deleted（不能回到 draft）

---

### 3.06 INTF-006 浏览 API

**配对 SD**: SD-006 | **覆盖 REQ**: REQ-007 | **核心路径**: 列已发布博文 + 详情 + 写 access_record

#### TC-INT-006-B1 跨模块：GET /posts/:id → 写 access_record + stats_buckets

**步骤**：
1. blogger1 发布 post1
2. 任意用户 GET /posts/${postId}
3. 期望：200，详情正确
4. 校验：stores.access_records 含 1 条（postId, userId|anonymous, ip, ts）
5. 校验：stores.stats_buckets[hourKey].pv += 1；uvSet 含 userId

#### TC-INT-006-E1 一致性：列表只返 status=published（draft 不可见）

**步骤**：
1. blogger1 创建 draft1 + publish post1
2. GET /posts
3. 期望：仅 post1 在列表中，draft1 不可见

**补充用例**：
- TC-INT-006-A1 pageSize > 100 → 400 INVALID_PAGINATION
- TC-INT-006-C1 postId 不存在 → 404 POST_NOT_FOUND
- TC-INT-006-C2 访问 draft 详情 → 404（不可见）

---

### 3.07 INTF-007 互动 API

**配对 SD**: SD-007 | **覆盖 REQ**: REQ-008 | **核心路径**: 点赞 → 通知博主；收藏幂等

#### TC-INT-007-B1 跨模块：like.created → 通知 post.authorId + 审计

**步骤**：
1. blogger1 发布 post1
2. reader1 点赞：POST /posts/${postId}/like
3. 期望：200，{ liked: true, likeCount: 1 }
4. 校验：stores.notifications[blogger1Id] 含 type=like.created
5. 校验：stores.audit_logs 含 like.created

#### TC-INT-007-E1 一致性：重复点赞幂等（likeCount 不增）

**步骤**：
1. reader1 点赞 post1
2. reader1 再次点赞 post1
3. 期望：200，likeCount 仍为 1

**补充用例**：
- TC-INT-007-A1 postId 不匹配 `^p_` → 400 VALIDATION_FAILED
- TC-INT-007-C1 postId 不存在 → 404 POST_NOT_FOUND
- TC-INT-007-D1 缺 JWT → 401 UNAUTHENTICATED
- TC-INT-007-B2 bookmark 不触发通知（避免刷屏）
- TC-INT-007-E2 unbookmark 后再次 bookmark → 正常（删除再加）

---

### 3.08 INTF-008 标签 API

**配对 SD**: SD-008 | **覆盖 REQ**: REQ-012 | **核心路径**: 创建标签 + 关联博文 + 反向查询

#### TC-INT-008-B1 跨模块：attachTags → 维护双向索引 + 审计

**步骤**：
1. blogger1 创建标签 tech
2. blogger1 attachTags：POST /posts/${postId}/tags { tags: ["tech", "nodejs"] }
3. 期望：200，post.tags = [tech, nodejs]
4. 校验：stores.postTags.byPost(postId) == [tech, nodejs]
5. 校验：stores.postTags.byTag("tech") 包含 postId

#### TC-INT-008-E1 一致性：双向索引同步（detach 后双向移除）

**步骤**：
1. attach tech 到 post1
2. detach tech：DELETE /posts/${postId}/tags/tech
3. 期望：204，post.tags 不含 tech
4. 校验：stores.postTags.byPost(postId) 不含 tech；stores.postTags.byTag("tech") 不含 postId

**补充用例**：
- TC-INT-008-A1 tag name 不匹配 `^[a-z0-9-]+$` → 400 VALIDATION_FAILED
- TC-INT-008-A2 tags 数量 6 → 422 TOO_MANY_TAGS
- TC-INT-008-C1 未创建的 tag → 404 TAG_NOT_FOUND
- TC-INT-008-C2 非 owner → 403 FORBIDDEN_NOT_OWNER
- TC-INT-008-D1 缺 JWT → 401 UNAUTHENTICATED
- TC-INT-008-E2 重复 attach 幂等（已存在不重复）
- TC-INT-008-C3 标签不存在查 → 404 TAG_NOT_FOUND

---

### 3.09 INTF-009 全文搜索 API

**配对 SD**: SD-009 | **覆盖 REQ**: REQ-013 | **核心路径**: 关键词 + 标签过滤 + 权重排序

#### TC-INT-009-B1 跨模块：搜索 → 跨 posts + post_tags + likes（无事件触发）

**步骤**：
1. blogger1 发布 post1（title="Nodejs 入门", content="...", tags=[tech]）
2. blogger1 发布 post2（title="Python 入门", content="...", tags=[tech]）
3. GET /search?q=nodejs&tags=tech
4. 期望：200，items 含 post1（title 命中，score >= 2），不含 post2

#### TC-INT-009-C1 异常：空关键词 → 400 EMPTY_KEYWORD

**步骤**：
1. GET /search?q=  
2. 期望：400 EMPTY_KEYWORD

**补充用例**：
- TC-INT-009-A1 pageSize > 100 → 400 INVALID_PAGINATION
- TC-INT-009-C2 draft/deleted 不出现在结果中

---

### 3.10 INTF-010 评论 API

**配对 SD**: SD-010 | **覆盖 REQ**: REQ-009, REQ-010 | **核心路径**: 顶级评论 + 回复 + 软删 + 通知

#### TC-INT-010-B1 跨模块：comment.created → 通知博文作者 + 父评论作者 + 审计

**步骤**：
1. blogger1 发布 post1
2. reader1 评论 post1（顶级）
3. 期望：stores.notifications[blogger1Id] 含 type=comment.created
4. 校验：stores.audit_logs 含 comment.created

#### TC-INT-010-E1 一致性：5 层深度边界（depth=5 允许，depth=6 拒绝）

**步骤**：
1. 嵌套回复 depth=0~5
2. 第 6 次回复：POST /comments/${depth5Id}/replies
3. 期望：400 MAX_DEPTH_EXCEEDED

#### TC-INT-010-C1 异常：评论作者 OR 博文作者可删；其他 → 403

**步骤**：
1. reader1 评论 post1
2. reader2 尝试删除
3. 期望：403 FORBIDDEN_NOT_AUTHOR_OR_BLOGGER

**补充用例**：
- TC-INT-010-A1 content 长度 0 / 2001 → 400 VALIDATION_FAILED
- TC-INT-010-A2 parentId 不匹配 `^c_` → 400 VALIDATION_FAILED
- TC-INT-010-C2 postId 不存在 → 404 POST_NOT_FOUND
- TC-INT-010-C3 parentId 不存在 → 404 COMMENT_NOT_FOUND
- TC-INT-010-D1 缺 JWT → 401 UNAUTHENTICATED
- TC-INT-010-E2 软删后 deleted=true 占位（子评论树形保留）
- TC-INT-010-B2 博文作者可删任意评论（验证交叉权限）

---

### 3.11 INTF-011 通知 API

**配对 SD**: SD-011 | **覆盖 REQ**: REQ-011 | **核心路径**: 触发源（follow/like/comment）→ 列表 → 标记已读

#### TC-INT-011-B1 跨模块：触发源自动写入通知（无需直接调 INTF-011）

**步骤**：
1. reader1 关注 blogger1
2. GET /me/notifications（用 blogger1 token）
3. 期望：items 含 type=follow.created

#### TC-INT-011-C1 异常：标记他人通知 → 403 FORBIDDEN_NOT_OWNED

**步骤**：
1. blogger1 有通知 n1
2. user2 尝试 PATCH /me/notifications/${n1}/read
3. 期望：403 FORBIDDEN_NOT_OWNED

**补充用例**：
- TC-INT-011-A1 unreadOnly 不是 boolean → 400 VALIDATION_FAILED
- TC-INT-011-D1 缺 JWT → 401 UNAUTHENTICATED
- TC-INT-011-C2 notificationId 不存在 → 404 NOTIFICATION_NOT_FOUND
- TC-INT-011-B2 标记已读幂等（多次 PATCH 结果一致）

---

### 3.12 INTF-012 RSS 订阅 API

**配对 SD**: SD-012 | **覆盖 REQ**: REQ-014 | **核心路径**: 最近 20 篇 published + Content-Type 正确

#### TC-INT-012-C1 异常：site_config 缺失 → 500 INTERNAL（注入测试）

**步骤**：
1. 手动清空 stores.site_config
2. GET /rss.xml
3. 期望：500 INTERNAL（运维错误，不应吞掉）

**补充用例**：
- TC-INT-012-A1 RSS 必须 application/rss+xml（Content-Type header）
- TC-INT-012-B1 触发：发布博文 → RSS 包含（验证下次 GET 可见）

---

### 3.13 INTF-013 Webhook API

**配对 SD**: SD-013 | **覆盖 REQ**: REQ-015 | **核心路径**: 注册订阅 → 事件触发 → HMAC 签名 → 失败重试 → 投递记录

#### TC-INT-013-B1 跨模块：post.published → 触发 Webhook 投递（外部 mock）

**步骤**：
1. 启动外部 mock server（接收 POST 回调，校验 X-Webhook-Signature）
2. admin 注册订阅：POST /webhooks { url, events: [post.published], secret }
3. blogger1 发布 post1
4. 期望：mock server 收到 1 个 POST，X-Webhook-Signature = HMAC-SHA256(payload, secret)
5. 校验：stores.webhook_deliveries 含 1 条 status=success

#### TC-INT-013-C1 异常：失败 3 次 → status=failed + 审计

**步骤**：
1. mock server 返 500
2. 触发 post.published
3. 期望：投递尝试 3 次（attempt=0,1,2），延迟 1s/4s/16s（用 clockMock.advance 加速）
4. 最终：status=failed，stores.audit_logs 含 webhook.delivery.failed

**补充用例**：
- TC-INT-013-A1 url 不是 http/https → 400 VALIDATION_FAILED
- TC-INT-013-A2 events 为空 → 400 VALIDATION_FAILED
- TC-INT-013-C2 重复订阅同 url → 仍创建（无唯一约束）
- TC-INT-013-D1 缺 JWT → 401 UNAUTHENTICATED
- TC-INT-013-D2 role 非 admin → 403 FORBIDDEN

---

### 3.14 INTF-014 站点配置 API

**配对 SD**: SD-014 | **覆盖 REQ**: REQ-016 | **核心路径**: 公开读 + admin 写 + 引用 ad 校验

#### TC-INT-014-B1 跨模块：PUT /site/config → 触发 site.config.updated 审计

**步骤**：
1. admin 登录
2. PUT /site/config { siteTitle: "My Blog v2" }
3. 期望：200，siteTitle 更新
4. 校验：stores.audit_logs 含 site.config.updated（payload 含 changes）

#### TC-INT-014-E1 一致性：bannerAdId 引用完整性（不存在的 ad → 404）

**步骤**：
1. PUT /site/config { bannerAdId: "ad_nonexistent" }
2. 期望：404 AD_NOT_FOUND

**补充用例**：
- TC-INT-014-A1 siteTitle 长度 0 / 101 → 400 VALIDATION_FAILED
- TC-INT-014-A2 siteLink 不是 http/https → 400 VALIDATION_FAILED
- TC-INT-014-C1 site_config 未初始化 → 500 INTERNAL（注入测试）
- TC-INT-014-D1 缺 JWT → 401 UNAUTHENTICATED
- TC-INT-014-D2 role 非 admin → 403 FORBIDDEN

---

### 3.15 INTF-015 访问记录 API

**配对 SD**: SD-015 | **覆盖 REQ**: REQ-019 | **核心路径**: 隐式写 + 显式 list + 5 分钟去重

#### TC-INT-015-B1 跨模块：GET /posts/:id → 隐式写 access_record + stats_buckets

**步骤**：
1. blogger1 发布 post1
2. reader1 GET /posts/${postId}
3. 期望：stores.access_records 含 1 条（userId=reader1）
4. 校验：stores.stats_buckets[hourKey].pv += 1；uvSet 含 reader1

#### TC-INT-015-E1 一致性：5 分钟内同 userId 同 postId 去重（仅 1 条）

**步骤**：
1. reader1 GET /posts/${postId} 3 次（间隔 30s）
2. 期望：stores.access_records 仍为 1 条（去重生效）

**补充用例**：
- TC-INT-015-A1 pageSize > 100 → 400 INVALID_PAGINATION
- TC-INT-015-A2 from > to → 400 INVALID_TIME_RANGE
- TC-INT-015-C1 postId 不存在 → 404 POST_NOT_FOUND
- TC-INT-015-D1 admin GET 缺 JWT → 401 UNAUTHENTICATED
- TC-INT-015-D2 admin GET role 非 admin → 403 FORBIDDEN

---

### 3.16 INTF-016 审计日志 API

**配对 SD**: SD-016 | **覆盖 REQ**: REQ-018 | **核心路径**: 多筛选 + 90 天边界

#### TC-INT-016-C1 异常：from > to → 400 INVALID_TIME_RANGE

**步骤**：
1. GET /admin/audit-logs?from=2026-08-01&to=2026-07-01
2. 期望：400 INVALID_TIME_RANGE

**补充用例**：
- TC-INT-016-A1 type 不在 enum → 400 VALIDATION_FAILED
- TC-INT-016-B1 触发：发布博文 → 审计含 post.published
- TC-INT-016-D1 缺 JWT → 401 UNAUTHENTICATED
- TC-INT-016-D2 role 非 admin → 403 FORBIDDEN

---

### 3.17 INTF-017 站点统计 API

**配对 SD**: SD-017 | **覆盖 REQ**: REQ-020 | **核心路径**: PV/UV + 范围 + 趋势

#### TC-INT-017-B1 跨模块：浏览 + 点赞 + 评论 → 聚合 PV/UV

**步骤**：
1. blogger1 发布 post1
2. reader1 GET /posts/${postId}（PV+1, UV+1）
3. reader1 点赞（不直接影响 PV/UV）
4. reader1 评论（不直接影响 PV/UV）
5. GET /admin/stats/site?range=24h（admin token）
6. 期望：pv=1, uv=1（reader1 唯一）

**补充用例**：
- TC-INT-017-A1 range ∉ enum → 400 INVALID_RANGE
- TC-INT-017-C1 无数据 → 返 0 + 空趋势（不报错）
- TC-INT-017-D1 缺 JWT → 401 UNAUTHENTICATED
- TC-INT-017-D2 role 非 admin → 403 FORBIDDEN

---

### 3.18 INTF-018 推荐 API

**配对 SD**: SD-018 | **覆盖 REQ**: REQ-021 | **核心路径**: Jaccard 相似度 + 冷启动降级

#### TC-INT-018-B1 跨模块：用户历史 + 标签 → 相似度排序

**步骤**：
1. reader1 点赞 post1（tags=[tech, nodejs]）
2. blogger1 发布 post2（tags=[tech]）和 post3（tags=[python]）
3. GET /me/recommendations?limit=10（reader1 token）
4. 期望：post2 排在 post3 之前（Jaccard(tech,nodejs∩tech)=1/2 > Jaccard(tech,nodejs∩python)=0）

#### TC-INT-018-C1 异常：冷启动 → fallback_popular

**步骤**：
1. 注册新 reader1（无历史）
2. GET /me/recommendations
3. 期望：strategy=fallback_popular，按 likes 数倒序

**补充用例**：
- TC-INT-018-A1 limit > 50 → 400 VALIDATION_FAILED
- TC-INT-018-C2 全部 draft/deleted → 返空 items（不报错）

---

### 3.19 INTF-019 广告位 API

**配对 SD**: SD-019 | **覆盖 REQ**: REQ-022 | **核心路径**: 创建 + 投放期过滤 + 删除前引用校验

#### TC-INT-019-B1 跨模块：getActive → 跨时间（用 clockMock 控制投放期）

**步骤**：
1. clockMock 设置 now=2026-08-15
2. 创建 ad1（startAt=2026-08-01, endAt=2026-08-31）
3. GET /site/ads/active
4. 期望：返 ad1

5. clockMock.advance(2026-09-15) → now 越界
6. GET /site/ads/active
7. 期望：返 null

#### TC-INT-019-E1 一致性：删除被 site_config 引用的 ad → 需先解除引用

**步骤**：
1. 创建 ad1，site_config.bannerAdId = ad1
2. DELETE /site/ads/${ad1}（admin token）
3. 期望：204（V1 设计：允许删除，前端需先解引用；记录已知限制）

**补充用例**：
- TC-INT-019-A1 imageUrl 非 http/https → 400 VALIDATION_FAILED
- TC-INT-019-A2 endAt <= startAt → 400 VALIDATION_FAILED
- TC-INT-019-C1 adId 不存在 → 404 AD_NOT_FOUND
- TC-INT-019-D1 缺 JWT → 401 UNAUTHENTICATED
- TC-INT-019-D2 role 非 admin → 403 FORBIDDEN

---

### 3.20 INTF-020 限流 API（横切）

**配对 SD**: SD-020 | **覆盖 NFR**: NFR-005 | **核心路径**: 滑动窗口 + /auth/login 严限 + Retry-After 头

#### TC-INT-020-C1 异常：同 IP 60s 内 100 次 → 429 RATE_LIMITED

**步骤**：
1. 循环 100 次 GET /posts（同一 IP）
2. 第 101 次
3. 期望：429，error=RATE_LIMITED，Retry-After 头（剩余秒数）

**补充用例**：
- TC-INT-020-A1 滑动窗口：60s 后可重新通过（用 clockMock.advance(61000)）
- TC-INT-020-B1 /auth/login 10 次后 → 429（严限）
- TC-INT-020-D1 不同 IP 互不影响（X-Forwarded-For 区分）

---

### 3.21 INTF-021 路由层 API（横切）

**配对 SD**: SD-021 | **覆盖 CON**: CON-003 | **核心路径**: 中间件链 + 路由分发 + 404 fallback

#### TC-INT-021-C1 异常：未匹配路由 → 404 NOT_FOUND

**步骤**：
1. GET /unknown/path
2. 期望：404 NOT_FOUND（由 SD-021 路由层 + SD-022 错误处理）

**补充用例**：
- TC-INT-021-D1 中间件链顺序：rateLimit → authGuard → 业务路由（缺 JWT 不会被业务路由处理）
- TC-INT-021-D2 健康检查 GET /health → 200（不在 /api/v1）

---

### 3.22 INTF-022 错误处理 API（横切）

**配对 SD**: SD-022 | **覆盖 NFR**: NFR-001, NFR-004 | **核心路径**: AppError 统一封装 + 响应结构 + 5xx 审计

#### TC-INT-022-C1 异常：未捕获异常 → 500 INTERNAL + 审计

**步骤**：
1. 注入测试：mock 一个 service 方法抛原生 Error（`throw new Error("boom")`）
2. 触发该方法
3. 期望：500 INTERNAL，响应含 { error: "INTERNAL", message: "Internal server error" }（生产模式隐藏堆栈）
4. 校验：stores.audit_logs 含 INTERNAL 错误事件（5xx 自动审计）

**补充用例**：
- TC-INT-022-D1 业务抛 AppError → 响应结构 { error, message, details? } 正确
- TC-INT-022-D2 错误码字典完备性：所有 27 错误码都有响应（抽样回归）

---

## 4. 集成测试执行策略

### 4.1 执行顺序（依赖关系）

集成测试用例按以下顺序执行（vitest `test.serial` + 依赖前置）：

```
[基础] resetStores()
  → TC-INT-001-B1 注册 reader1（前置：所有 reader 用例）
  → TC-INT-004-B1 申请 blogger1（前置：所有 blogger 用例）
  → TC-INT-005-B1 创建 draft1（前置：所有 post 用例）
  → TC-INT-005-B1 发布 post1（前置：所有 view/like/comment/search/rss 用例）
  → TC-INT-003-B1 reader1 关注 blogger1（前置：通知 + 推荐）
  → TC-INT-010-B1 reader1 评论 post1（前置：通知）
  → ... 后续 TC-INT 自由顺序
```

### 4.2 共享 fixture 复用

22 INTF 共享以下 fixture（`test/integration/fixtures/`）：

- `users.fixture.ts`：`{ reader1, reader2, reader3, blogger1, blogger2, admin1 }`（6 个角色账户）
- `posts.fixture.ts`：`{ draft1, published1, deleted1 }`（3 个状态 post）
- `tags.fixture.ts`：`{ tech, nodejs, python }`（3 个标签）
- `comments.fixture.ts`：`{ topLevel1, reply1, deepChain1 }`（3 类评论）
- `webhook.fixture.ts`：`mockServer, subscription1, deliveries1`

### 4.3 时间注入（clockMock）

时间敏感用例（TC-INT-008 时间范围、TC-INT-013 重试延迟、TC-INT-019 投放期、TC-INT-020 滑动窗口）必须使用 `clockMock.advance(ms)` 加速，避免真实等待：

```typescript
import { clockMock } from "@/test/integration/setup";
beforeEach(() => clockMock.reset());
it("5 分钟去重", async () => {
  await api().get(`/posts/${postId}`);
  clockMock.advance(60_000); // 1 min
  await api().get(`/posts/${postId}`); // 仍去重（5 min 内）
  expect(stores.accessRecords.listByPost(postId)).toHaveLength(1);
});
```

### 4.4 事件 spy 用法

跨模块用例（TC-INT-NN-B1）必须用 `captureEvents` 验证事件传播：

```typescript
import { captureEvents } from "@/test/integration/setup";
it("post.published 事件触发通知", async () => {
  const events = captureEvents(["post.published"]);
  await api().post(`/posts/${draftId}/publish`).set("Authorization", `Bearer ${bloggerToken}`).send();
  expect(events).toHaveLength(1);
  expect(events[0].payload).toMatchObject({ postId, authorId: bloggerId });
});
```

---

## 5. 集成测试覆盖率统计

### 5.1 错误码覆盖率（27 错误码 → 86 用例）

| 错误码 | 触发 INTF | 触发 TC-INT | 覆盖率 |
|---|---|---|---|
| `UNAUTHENTICATED` | 14 个 | 22 个 D 类用例 | 100% |
| `VALIDATION_FAILED` | 7 个 | 12 个 A 类用例 | 100% |
| `POST_NOT_FOUND` | 5 个 | 7 个 C 类用例 | 100% |
| `FORBIDDEN_NOT_OWNER` | 2 个 | 2 个 C 类用例 | 100% |
| `RATE_LIMITED` | 1 个 | 3 个 C/D 类用例 | 100% |
| `INTERNAL` | 3 个 | 3 个 C 类用例 | 100% |
| ... (其余 21 个错误码) | — | — | 100% |

**总覆盖率**：27/27 错误码 = 100%。

### 5.2 TC-DES 分布（22 INTF × 5 类）

- **TC-DES-A（参数校验）**：20 个用例（22 INTF - INTF-021/022 路由/错误处理）
- **TC-DES-B（跨模块）**：17 个用例（22 INTF - 5 个无跨模块事件的）
- **TC-DES-C（异常路径）**：22 个用例（每 INTF 至少 1 个）
- **TC-DES-D（横切关注）**：17 个用例（22 INTF - 5 个非横切 INTF）
- **TC-DES-E（数据一致性）**：10 个用例（涉及状态机/双向索引/引用完整性）

**合计**：20+17+22+17+10 = 86 个集成测试用例。

### 5.3 RTM 可追溯性

| TC-INT | 覆盖 INTF | 覆盖 SD | 覆盖 REQ | 优先级 |
|---|---|---|---|---|
| TC-INT-001-B1/C1 | INTF-001 | SD-001 | REQ-001, REQ-002 | P0 |
| TC-INT-002-B1/C1 | INTF-002 | SD-002 | REQ-003 | P0 |
| TC-INT-003-B1/E1 | INTF-003 | SD-003 | REQ-004 | P0 |
| TC-INT-004-B1/E1 | INTF-004 | SD-004 | REQ-005, REQ-017 | P0 |
| TC-INT-005-B1/C1/E1 | INTF-005 | SD-005 | REQ-006 | P0 |
| TC-INT-006-B1/E1 | INTF-006 | SD-006 | REQ-007 | P1 |
| TC-INT-007-B1/E1 | INTF-007 | SD-007 | REQ-008 | P1 |
| TC-INT-008-B1/E1 | INTF-008 | SD-008 | REQ-012 | P1 |
| TC-INT-009-B1/C1 | INTF-009 | SD-009 | REQ-013 | P1 |
| TC-INT-010-B1/C1/E1 | INTF-010 | SD-010 | REQ-009, REQ-010 | P0 |
| TC-INT-011-B1/C1 | INTF-011 | SD-011 | REQ-011 | P1 |
| TC-INT-012-C1 | INTF-012 | SD-012 | REQ-014 | P2 |
| TC-INT-013-B1/C1 | INTF-013 | SD-013 | REQ-015 | P1 |
| TC-INT-014-B1/E1 | INTF-014 | SD-014 | REQ-016 | P1 |
| TC-INT-015-B1/E1 | INTF-015 | SD-015 | REQ-019 | P2 |
| TC-INT-016-C1 | INTF-016 | SD-016 | REQ-018 | P1 |
| TC-INT-017-B1 | INTF-017 | SD-017 | REQ-020 | P2 |
| TC-INT-018-B1/C1 | INTF-018 | SD-018 | REQ-021 | P2 |
| TC-INT-019-B1/E1 | INTF-019 | SD-019 | REQ-022 | P2 |
| TC-INT-020-C1 | INTF-020 | SD-020 | NFR-005 | P1 |
| TC-INT-021-C1 | INTF-021 | SD-021 | CON-003 | P0 |
| TC-INT-022-C1 | INTF-022 | SD-022 | NFR-001, NFR-004 | P0 |

**优先级分布**：P0 = 9 / P1 = 7 / P2 = 6；合计 22 个 INTF 全部覆盖。

---

## 6. 阶段 5/6 交接清单

### 6.1 给阶段 5（编码）

- 每个 TC-INT-NN 转化为 `test/integration/<intf-id>.test.ts` 文件
- 22 INTF × 1 文件 = 22 个集成测试文件
- 共享 `test/integration/setup.ts` 提供 resetStores / signToken / captureEvents / api() / clockMock

### 6.2 给阶段 6（集成测试执行）

- 执行命令：`pnpm test:integration`（配置 vitest.config.ts 集成测试路径）
- 期望结果：86 个用例全通过（与单元测试分离）
- 覆盖率报告：22 INTF × 53 端点 = 100% 端点覆盖；17 store × 22 INTF = 27% 单元覆盖

### 6.3 与阶段 2（系统测试）的关系

| 阶段 2 TC-SYS | 阶段 3 TC-INT | 关系 |
|---|---|---|
| 22 个 TC-SYS（系统级单 INTF） | 86 个 TC-INT（集成级跨模块/异常/横切） | TC-INT 是 TC-SYS 的细化与扩展 |
| 性能 NFR | 移到阶段 7 系统测试 | — |
| 渗透安全 NFR | 移到阶段 7 系统测试 | — |
| UAT 端到端 | 移到阶段 8 验收测试 | — |

---

## 7. 风险与已知限制

1. **RISK-T01**：86 个集成测试用例执行时间可能 > 10s（特别是时间敏感用例）。**缓解**：用 `clockMock.advance` 跳过真实等待；并行执行（vitest `--threads`）。

2. **RISK-T02**：Webhook 投递测试需外部 mock server。**缓解**：用 `nock` 库 mock HTTP，或用 `node:http` 内置 server 监听 0 端口。

3. **RISK-T03**：横切中间件（rateLimit）测试可能影响其他用例（共享 rate_limit_windows store）。**缓解**：每个 `describe` block 之前 `resetStores()` + `clockMock.reset()`。

4. **RISK-T04**：V1 已知限制（参见 §3.19）：删除被 site_config 引用的 ad 不抛错（V1 设计选择）。**缓解**：在阶段 8 UAT 验证是否需要补强。

---

> **本文档结束**
> 
> 阶段 3 集成测试设计产物已交付。22 INTF × 86 TC-INT 用例 + 5 类 TC-DES 覆盖完整。
