# 测试用例文档（单元测试）

> 阶段 4（详细设计）同步产出，类型=单元测试。套用 `templates/test-case.md` 模板。
> 博客系统后端（blog-system-demo-r35）。
> 输入：`docs/phase4-detailed/blog-system-detailed-design.md`（50 个 DD 设计项，DD-001~DD-050）。
> 执行阶段：阶段 5（编码）——用例将在阶段 5 实现为 vitest 可执行测试代码（seam 见详细设计 §4）。

## 文档信息

- 项目名称：博客系统后端（blog-system-demo-r35）
- 测试类型：单元测试
- 设计来源阶段：阶段 4（详细设计）
- 执行阶段：阶段 5（编码）
- 文档版本：v1.0

## 用例列表

### UT-001

- 标题：注册接口成功透传（AuthController.register）
- 优先级：高
- 关联需求/设计：REQ-007 / DD-001（INTF-001）
- 关联 BDD feature：`features/L2/L2_blog_system_auth-001.feature`
- 测试场景：正常路径——校验通过后控制器将 authService.register 返回值组装为 201 响应

**前置条件**

mock `authService.register` 返回固定 User；构造含合法 body 的 req/res 桩。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 `AuthController.register(req, res)` | body: `{username:"reader1",email:"r1@example.com",password:"Passw0rd!x"}` | 服务被调用一次 |
| 2 | 断言响应 | — | `expect(res.status).toHaveBeenCalledWith(201)`；`expect(res.json).toHaveBeenCalledWith({code:0,message:"ok",data:expect.objectContaining({userId:"u_0001",role:"reader"})})` |

**预期结果**

`expect(authService.register).toHaveBeenCalledTimes(1)`；响应 201 且 data 含 userId/username/role。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-002

- 标题：注册成功 bcrypt 哈希且响应不含明文密码（authService.register）
- 优先级：高
- 关联需求/设计：REQ-007 / DD-002（INTF-001）
- 关联 BDD feature：`features/L2/L2_blog_system_auth-001.feature`
- 测试场景：正常路径——密码以 bcrypt 加盐哈希落库；返回对象不含 password/passwordHash（NFR-002）

**前置条件**

真实 UserStore 实例；真实 bcryptjs。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 `authService.register({username,email,password})` | `password:"Passw0rd!x"` | 返回 User |
| 2 | 断言落库哈希 | userStore.findById(result.userId).passwordHash | `expect(hash).not.toBe("Passw0rd!x")`；`expect(await bcrypt.compare("Passw0rd!x", hash)).toBe(true)` |
| 3 | 断言响应字段 | result | `expect(result.password).toBeUndefined()`；`expect(result.passwordHash).toBeUndefined()` |

**预期结果**

密码不落明文；返回体无任何凭据字段（`expect(Object.keys(result)).not.toContain("password")`）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-003

- 标题：修改密码原密码错误（profileService.changePassword）
- 优先级：高
- 关联需求/设计：REQ-010 / DD-003（INTF-004）
- 测试场景：异常路径——`oldPassword` 不匹配返回业务错误 60002

**前置条件**

预置用户（passwordHash=bcrypt("OldPassw0rd!")）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 `changePassword(userId, "WrongPass0!", "NewPassw0rd!")` | 错误原密码 | 抛 BizError |
| 2 | 断言错误码 | err | `expect(err.code).toBe(60002)`；`expect(err.httpStatus).toBe(400)` |

**预期结果**

`expect.assertions(2)` 通过；密码哈希未被修改（`bcrypt.compare("OldPassw0rd!", hash) === true`）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-004

- 标题：邮箱唯一冲突（UserStore.create）
- 优先级：高
- 关联需求/设计：REQ-007 / DD-004（INTF-001）
- 测试场景：异常路径——重复 email 触发唯一索引冲突 40901

**前置条件**

UserStore 已含 email=`dup@example.com` 用户。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 再次 `create({email:"dup@example.com", username:"dup2"})` | 重复 email | 抛 BizError |
| 2 | 断言错误码 | err | `expect(err.code).toBe(40901)`；`expect(err.httpStatus).toBe(409)` |

**预期结果**

唯一索引维护正确（emailIndex/usernameIndex 均回滚），store 内用户数不变。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-005

- 标题：非博主创建文章被拒（ArticleController.createArticle）
- 优先级：高
- 关联需求/设计：REQ-009、REQ-011 / DD-005（INTF-005）
- 关联 BDD feature：`features/L2/L2_blog_system_content-001.feature`
- 测试场景：异常路径——reader 角色用户携带 JWT 创建文章 → 40301（跨模块 user store 博主校验链路）

**前置条件**

mock authMiddleware 已挂 `req.user={userId:"u_0001", role:"reader"}`；`articleService.createArticle` 校验角色抛 40301。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 `createArticle(req, res)` | body: `{title:"t", body:"b"}`；req.user.role="reader" | 抛/响应 40301 |
| 2 | 断言 | — | `expect(res.status).toHaveBeenCalledWith(403)`；`expect(res.json).toHaveBeenCalledWith(expect.objectContaining({error:{code:40301}}))` |

**预期结果**

`expect(articleService.createArticle).not.toHaveBeenCalled()` 或服务内角色校验抛出 40301（reader 无发布权限，REQ-009）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-006

- 标题：分类嵌套深度超限（MetadataController.createCategory）
- 优先级：中
- 关联需求/设计：REQ-016 / DD-006（INTF-010）
- 测试场景：异常路径——第 4 层分类创建 → 60003（嵌套深度 ≤3）

**前置条件**

预置 3 层分类链（c1→c2→c3，depth=1/2/3）；mock categoryService 抛 60003。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `createCategory(req,res)` | `{name:"deep4", parentId:"c3"}` | 响应 400 + code 60003 |
| 2 | 断言 | — | `expect(res.status).toHaveBeenCalledWith(400)`；`expect(res.json).toHaveBeenCalledWith(expect.objectContaining({error:{code:60003}}))` |

**预期结果**

深度计算沿 parentId 链累加至 4 即触发 60003，分类未落库。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-007

- 标题：创建文章标签不存在（articleService.createArticle）
- 优先级：高
- 关联需求/设计：REQ-011 / DD-007（INTF-005）
- 测试场景：异常路径——`tags` 中标签不存在 → 40401

**前置条件**

mock tagStore.findByName 返回 null；mock authService 博主校验通过。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `createArticle("u_0002", {title:"t", body:"b", tags:["不存在标签"]})` | 未知标签 | 抛 BizError |
| 2 | 断言 | err | `expect(err.code).toBe(40401)`；`expect(err.httpStatus).toBe(404)` |

**预期结果**

文章未写入 ArticleStore（`expect(articleStore.findAll()).toHaveLength(0)`）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-008

- 标题：文章状态机 draft→published 合法迁移（articleStateMachine.transition）
- 优先级：高
- 关联需求/设计：REQ-012、REQ-013 / DD-008（INTF-006）
- 关联 BDD feature：`features/L3/L3_blog_system_article_state-001.feature`
- 测试场景：正常路径——草稿发布为 published

**前置条件**

无（纯函数）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `transition("draft", "publish")` | draft + publish | `expect(result).toBe("published")` |
| 2 | `canTransition("draft", "publish")` | 同上 | `expect(result).toBe(true)` |

**预期结果**

合法迁移表返回 published；canTransition 一致。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-009

- 标题：标签重名冲突（tagService.createTag）
- 优先级：中
- 关联需求/设计：REQ-015 / DD-009（INTF-009）
- 测试场景：异常路径——同名标签再次创建 → 40901

**前置条件**

tagStore 已含 `name:"W模型"`。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `createTag("W模型", "u_0002")` | 重名 | 抛 BizError |
| 2 | 断言 | err | `expect(err.code).toBe(40901)`；`expect(err.httpStatus).toBe(409)` |

**预期结果**

标签数不变（`expect(tagStore.findAll()).toHaveLength(1)`）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-010

- 标题：同级分类重名冲突（categoryService.createCategory）
- 优先级：中
- 关联需求/设计：REQ-016 / DD-010（INTF-010）
- 测试场景：异常路径——同一 parentId 下重名 → 40901

**前置条件**

categoryStore 已含 `{parentId:null, name:"技术"}`。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `createCategory("技术", null, "u_0002")` | 同级重名 | 抛 BizError |
| 2 | 断言 | err | `expect(err.code).toBe(40901)` |

**预期结果**

`uq_category_sibling` 索引拦截；分类未落库。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-011

- 标题：分页参数越界（ArticleStore 分页校验）
- 优先级：中
- 关联需求/设计：REQ-014、REQ-017 / DD-011（INTF-008/011）
- 测试场景：边界条件——`page=0`、`pageSize=51` → 40002（1≤page、1≤pageSize≤50）

**前置条件**

ArticleStore 空/任意数据。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `filterPublished({}, 0, 20)` | page=0 | 抛 BizError 40002 |
| 2 | `filterPublished({}, 1, 51)` | pageSize=51 | 抛 BizError 40002 |
| 3 | 边界合法值 | page=1, pageSize=50 | `expect(result.total).toBe(0)`（空数据不抛） |

**预期结果**

越界 ±1 均 40002；合法极值 50 放行。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-012

- 标题：按名称查标签不存在（TagStore.findByName）
- 优先级：中
- 关联需求/设计：REQ-015 / DD-012（INTF-009）
- 测试场景：边界条件——不存在返回 null（不抛异常，404 语义由服务层转译）

**前置条件**

空 TagStore。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `findByName("no_such_tag")` | — | `expect(result).toBeNull()` |
| 2 | 空串查询 | `findByName("")` | `expect(result).toBeNull()`（无匹配不抛） |

**预期结果**

返回 null，无异常。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-013

- 标题：根分类创建（CategoryStore）
- 优先级：中
- 关联需求/设计：REQ-016 / DD-013（INTF-010）
- 测试场景：正常路径——`parentId=null` 根分类 depth=1

**前置条件**

空 CategoryStore。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `create({name:"根分类", parentId:null, depth:1})` | parentId=null | `expect(result.id).toBeDefined()` |
| 2 | 断言 depth | result | `expect(result.depth).toBe(1)`；`expect(result.parentId).toBeNull()` |

**预期结果**

根分类落库且 depth=1。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-014

- 标题：草稿文章对读者不可见（BrowseController.getArticle）
- 优先级：高
- 关联需求/设计：REQ-017 / DD-014（INTF-011）
- 测试场景：异常路径——草稿/归档详情统一 40402 防枚举

**前置条件**

mock articleBrowseService 对非 published 抛 40402。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `getArticle(req,res)` | `req.params.id="a_draft"` | 响应 404 + code 40402 |
| 2 | 断言 | — | `expect(res.status).toHaveBeenCalledWith(404)`；`expect(res.json).toHaveBeenCalledWith(expect.objectContaining({error:{code:40402}}))` |

**预期结果**

草稿对读者呈现 404（防枚举），不泄露状态。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-015

- 标题：未认证评论被拒（CommentController.createComment）
- 优先级：高
- 关联需求/设计：REQ-018 / DD-015（INTF-012）
- 测试场景：异常路径——无 JWT 发表评论 → 40101（authMiddleware 前置拦截）

**前置条件**

req.user 未挂载（认证中间件未通过）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `createComment(req,res)` | req.user 不存在 | 响应 401 + code 40101 |
| 2 | 断言 | — | `expect(res.status).toHaveBeenCalledWith(401)`；`expect(res.json).toHaveBeenCalledWith(expect.objectContaining({error:{code:40101}}))` |

**预期结果**

未认证请求在控制器入口即被拒，commentService 未被调用。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-016

- 标题：禁止自关注（InteractionController.followBlogger）
- 优先级：高
- 关联需求/设计：REQ-020 / DD-016（INTF-014）
- 测试场景：异常路径——`followerId === followeeId` → 40002

**前置条件**

req.user.userId="u_0001"；路径参数 id="u_0001"。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `followBlogger(req,res)` | 自关注 | 响应 400 + code 40002 |
| 2 | 断言 | — | `expect(res.status).toHaveBeenCalledWith(400)`；`expect(res.json).toHaveBeenCalledWith(expect.objectContaining({error:{code:40002}}))` |

**预期结果**

自关注被拒（40002），FollowStore 无写入。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-017

- 标题：详情访问触发阅读事件（articleBrowseService.getPublishedArticleDetail）
- 优先级：高
- 关联需求/设计：REQ-017、REQ-024 / DD-017（INTF-011/018）
- 关联 BDD feature：`features/L3/L3_blog_system_reading_dedup-001.feature`
- 测试场景：正常路径——已发布文章详情访问 emit `reading.viewed`（clientIp 注入）

**前置条件**

mock articleService.getPublishedArticleById 返回 published 文章；mock eventBus。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `getPublishedArticleDetail("a_1001", "127.0.0.1")` | clientIp | 返回详情 |
| 2 | 断言事件 | eventBus.emit mock | `expect(eventBus.emit).toHaveBeenCalledWith("reading.viewed", expect.objectContaining({articleId:"a_1001", clientIp:"127.0.0.1"}))` |
| 3 | 断言 40402 路径 | 草稿 id | `expect(() => getPublishedArticleDetail("a_draft","127.0.0.1")).rejects.toMatchObject({code:40402})` |

**预期结果**

事件已 emit（去重由 SD-005 消费）；非 published 抛 40402 且不 emit。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-018

- 标题：文章作者删除评论成功（commentService.deleteComment，RH-03 授权上下文）
- 优先级：高
- 关联需求/设计：REQ-018 / DD-018（INTF-012）
- 关联 BDD feature：`features/L3/L3_blog_system_comment_flow-001.feature`（BDD-L3-015）
- 测试场景：正常路径——AuthorizeDeletion 上下文使能：actorId === article.authorId → 删除可达（对应阶段 3 reworkHint RH-03 可达性处置）

**前置条件**

预置文章 `a_1001`（authorId="u_0002"）与评论 `c_9001`（authorId="u_0001"）；actorId="u_0002"（文章作者）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 读取文章作者 | mock articleService.getPublishedArticleById("a_1001") | `expect(mock).toHaveBeenCalledWith("a_1001")`；authorId="u_0002" |
| 2 | 调用 `deleteComment("a_1001", "c_9001", "u_0002")` | 授权上下文成立 | `deletionAuthorized := ("u_0002" === "u_0002") = true`；评论删除 |
| 3 | 断言 | commentStore.findById("c_9001") | `expect(deleted).toBeNull()` |

**预期结果**

`expect(deleteComment).resolves.toBeUndefined()`；评论（含回复级联）已删除——删除在代码层可达（RH-03 落地）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-019

- 标题：重复点赞幂等（likeService.likeArticle）
- 优先级：高
- 关联需求/设计：REQ-019 / DD-019（INTF-013）
- 测试场景：正常路径——同用户重复点赞不重复计数（REQ-019 幂等）

**前置条件**

预置 published 文章；LikeStore 已含 `(u_0001, a_1001)`。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `likeArticle("a_1001", "u_0001")` | 已点赞 | 返回 liked=true，不新增 |
| 2 | 断言计数 | likeStore.countByArticle("a_1001") | `expect(count).toBe(1)`（未 +1） |
| 3 | 断言事件次数 | eventBus.emit mock | `expect(eventBus.emit).not.toHaveBeenCalledWith("article.liked", expect.anything())`（首次才触发） |

**预期结果**

幂等成立：计数不重复、事件不重复触发。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-020

- 标题：关注非博主被拒（followService.followBlogger）
- 优先级：高
- 关联需求/设计：REQ-020 / DD-020（INTF-014）
- 测试场景：异常路径——followee 为 reader 角色 → 40002（P7-002：身份校验在 user store，非独立 blogger store）

**前置条件**

mock authService 返回 followee role="reader"。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `followBlogger("u_0001", "u_0003")` | followee 为 reader | 抛 BizError |
| 2 | 断言 | err | `expect(err.code).toBe(40002)`；`expect(err.httpStatus).toBe(400)` |

**预期结果**

非博主 followee 拒绝关注；FollowStore 无写入。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-021

- 标题：评论列表按时间降序分页（CommentStore.listByArticle）
- 优先级：中
- 关联需求/设计：REQ-018 / DD-021（INTF-012）
- 测试场景：正常路径——createdAt 降序 + 分页 total 正确

**前置条件**

预置同一文章 3 条评论（t1<t2<t3）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `listByArticle("a_1001", 1, 2)` | page=1, size=2 | `expect(items[0].id).toBe("c3")`（最新在前） |
| 2 | 断言 total | result | `expect(result.total).toBe(3)` |

**预期结果**

降序正确、分页 total 完整。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-022

- 标题：点赞计数正确（LikeStore.countByArticle）
- 优先级：中
- 关联需求/设计：REQ-019 / DD-022（INTF-011/013）
- 测试场景：正常路径——多用户点赞计数聚合（详情 likeCount 数据源）

**前置条件**

3 个不同用户对 a_1001 点赞。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `countByArticle("a_1001")` | — | `expect(count).toBe(3)` |
| 2 | 无点赞文章 | `countByArticle("a_9999")` | `expect(count).toBe(0)`（空计数边界） |

**预期结果**

计数正确；无记录返回 0。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-023

- 标题：收藏列表仅本人（FavoriteStore.listByUser）
- 优先级：中
- 关联需求/设计：REQ-019 / DD-023（INTF-013）
- 测试场景：正常路径——只返回指定用户收藏（他人收藏不可见）

**前置条件**

u_0001 收藏 2 篇、u_0002 收藏 1 篇。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `listByUser("u_0001", 1, 20)` | — | `expect(result.total).toBe(2)`；`expect(items.every(f => f.userId === "u_0001")).toBe(true)` |

**预期结果**

数据隔离正确。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-024

- 标题：无关注关系返回空 feed 数据源（FollowStore）
- 优先级：中
- 关联需求/设计：REQ-020 / DD-024（INTF-014）
- 测试场景：边界条件——follower 无任何关注 → 空列表（不抛异常）

**前置条件**

空 FollowStore。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `listFolloweeIdsByFollower("u_0001")` | — | `expect(result).toEqual([])` |

**预期结果**

空关注返回空数组（feed 服务层据此返回空分页）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-025

- 标题：热门 limit 越界（DiscoveryController.getHotArticles）
- 优先级：中
- 关联需求/设计：REQ-021 / DD-025（INTF-015）
- 测试场景：边界条件——`limit=0` 与 `limit=51` → 40002（1≤limit≤50）

**前置条件**

mock hotService。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `getHotArticles(req,res)` | limit=0 | 响应 400 + code 40002 |
| 2 | `getHotArticles(req,res)` | limit=51 | 响应 400 + code 40002 |
| 3 | 合法极值 | limit=50 | `expect(hotService.getHotArticles).toHaveBeenCalledWith(50)` |

**预期结果**

越界 ±1 均 40002；极值 50 放行。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-026

- 标题：近 7 天阅读量 Top N（hotService.getHotArticles）
- 优先级：高
- 关联需求/设计：REQ-021 / DD-026（INTF-015）
- 测试场景：正常路径——7 天窗口外阅读不计入；仅已发布文章入榜；降序取 Top N

**前置条件**

mock readingStatService.getViews7d 返回 `{a1:10, a2:5}`；mock articleService 已发布集合含 a1/a2；注入假时钟 now。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `getHotArticles(2)` | limit=2 | `expect(result.map(i => i.articleId)).toEqual(["a1","a2"])`（按 viewCount7d 降序） |
| 2 | 窗口外文章 | 阅读记录 viewedAt < now−7d | `expect(result).not.toContainEqual(expect.objectContaining({articleId:"a_old"}))` |
| 3 | limit 超实际 | `getHotArticles(10)`（实际 2 篇） | `expect(result).toHaveLength(2)`（返回实际数） |

**预期结果**

窗口过滤、已发布过滤、降序 Top N 全部成立。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-027

- 标题：冷启动推荐回退热门（recommendService.getRecommendations）
- 优先级：高
- 关联需求/设计：REQ-022 / DD-027（INTF-016）
- 测试场景：正常路径——无 JWT（userId=undefined）或无阅读历史 → 回退热门 Top N（REQ-022）

**前置条件**

mock hotService.getHotArticles 返回 3 篇；mock readingStatService 返回空历史。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `getRecommendations(undefined, 10)` | 匿名 | `expect(result.every(i => i.reason === "hot-fallback")).toBe(true)` |
| 2 | `getRecommendations("u_0001", 10)`（无历史） | 冷启动 | `expect(hotService.getHotArticles).toHaveBeenCalledTimes(2)` |

**预期结果**

无历史/匿名一律 hot-fallback；无异常。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-028

- 标题：四字段命中与相关性排序（searchService.searchArticles）
- 优先级：高
- 关联需求/设计：REQ-023 / DD-028（INTF-017）
- 测试场景：正常路径——标题命中权重 > 标签 > 摘要 > 正文；降序返回

**前置条件**

SearchIndexStore 预置 4 篇文章（同一关键词分别命中标题/标签/摘要/正文）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `searchArticles("w模型", 1, 20)` | q | `expect(result.items[0].articleId).toBe("a_title")`（标题命中第一） |
| 2 | 断言顺序 | result.items 映射 | `expect(result.items.map(i=>i.articleId)).toEqual(["a_title","a_tag","a_summary","a_body"])`；`expect(result.items[0].score).toBeGreaterThan(result.items[3].score)` |

**预期结果**

相关性排序符合「标题>标签>摘要>正文」权重。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-029

- 标题：空关键词检索空结果（SearchIndexStore.query）
- 优先级：中
- 关联需求/设计：REQ-023 / DD-029（INTF-017）
- 测试场景：边界条件——空串/空白关键词 → 空结果（不抛异常）

**前置条件**

SearchIndexStore 含若干索引项。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `query("", 1, 20)` | 空串 | `expect(result).toEqual([])` |
| 2 | `query("   ", 1, 20)` | 空白 | `expect(result).toEqual([])` |

**预期结果**

空关键词返回空数组（长度校验 40002 由 validationUtil 层承担，store 层容错返回空）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-030

- 标题：统计面板非博主被拒（StatsController.getBloggerStats）
- 优先级：中
- 关联需求/设计：REQ-025 / DD-030（INTF-019）
- 测试场景：异常路径——reader 访问统计面板 → 40301（requireBlogger 守卫）

**前置条件**

req.user.role="reader"。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `getBloggerStats(req,res)` | reader 角色 | 响应 403 + code 40301 |
| 2 | 断言 | — | `expect(res.status).toHaveBeenCalledWith(403)`；`expect(res.json).toHaveBeenCalledWith(expect.objectContaining({error:{code:40301}}))` |

**预期结果**

非博主无面板权限（40301）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-031

- 标题：同 IP 5 分钟窗口去重（readingStatService.recordView）
- 优先级：高
- 关联需求/设计：REQ-024 / DD-031（INTF-018）
- 关联 BDD feature：`features/L3/L3_blog_system_reading_dedup-001.feature`
- 测试场景：正常路径——同 `clientIp+articleId` 5 分钟窗口内重复访问不重复计数

**前置条件**

注入假时钟 now；ReadingRecordStore 空。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `recordView("a_1001", "127.0.0.1")` | 首次 | 写入 1 条 |
| 2 | 推进 3 分钟（<5min）再 `recordView` | 窗口内 | 不新增 |
| 3 | 断言 | readingRecordStore | `expect(count).toBe(1)`；`expect(store.isDuplicated("127.0.0.1","a_1001",300000)).toBe(true)` |

**预期结果**

窗口内去重：记录数保持 1。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-032

- 标题：博主面板四项聚合与趋势补零（bloggerStatsService.getBloggerStats）
- 优先级：高
- 关联需求/设计：REQ-025 / DD-032（INTF-019）
- 测试场景：正常路径——文章数/总阅读量/总评论数聚合 + 近 7 天趋势 7 项（无记录日期补 0）

**前置条件**

mock articleService.countByAuthor=5；mock commentService 评论数=12；mock readingStatService.getViewCount=100、getTrend7d 返回仅 3 天有记录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `getBloggerStats("u_0002")` | — | `expect(result.articleCount).toBe(5)`；`expect(result.totalComments).toBe(12)` |
| 2 | 断言趋势 | result.trend | `expect(result.trend).toHaveLength(7)`；`expect(result.trend.filter(t => t.views === 0)).toHaveLength(4)`（无记录补 0） |

**预期结果**

四项统计 + 7 天趋势补零正确。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-033

- 标题：评论事件产生被回复通知（notificationService.onCommentCreated）
- 优先级：高
- 关联需求/设计：REQ-026 / DD-033（INTF-020）
- 测试场景：正常路径——订阅 `comment.created` → 文章作者收到 REPLY 通知

**前置条件**

mock notificationStore；事件 `{articleId, authorId(回复者), articleAuthorId}`。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `onCommentCreated(event)` | 回复事件 | 通知落库 |
| 2 | 断言 | notificationStore 记录 | `expect(created.type).toBe("REPLY")`；`expect(created.userId).toBe(event.articleAuthorId)`；`expect(created.read).toBe(false)` |

**预期结果**

REPLY 通知产生且指向文章作者、未读。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-034

- 标题：阅读去重窗口判定（ReadingRecordStore.isDuplicated）
- 优先级：中
- 关联需求/设计：REQ-024 / DD-034（INTF-018）
- 测试场景：边界条件——窗口边界（=windowMs 处）判定

**前置条件**

假时钟；预置记录 viewedAt=now−300000（恰好 5 分钟）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `isDuplicated("127.0.0.1","a_1001",300000)` | 恰在窗口边缘 | `expect(result).toBe(true)`（≤windowMs 视为重复） |
| 2 | 推进 1ms | now+1ms | `expect(result).toBe(false)`（超出窗口不重复） |

**预期结果**

窗口边界 ±1 判定正确（去重窗口为闭区间）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-035

- 标题：通知列表未读过滤（NotificationStore.listByUser）
- 优先级：中
- 关联需求/设计：REQ-026 / DD-035（INTF-020）
- 测试场景：正常路径——`unreadOnly=true` 仅返回未读

**前置条件**

预置 u_0001 通知：2 未读 + 1 已读。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `listByUser("u_0001",1,20,true)` | unreadOnly | `expect(result.total).toBe(2)`；`expect(items.every(n => n.read === false)).toBe(true)` |
| 2 | `listByUser("u_0001",1,20,false)` | 全量 | `expect(result.total).toBe(3)` |

**预期结果**

未读过滤与全量均正确。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-036

- 标题：Webhook url 非 http(s) 被拒（IntegrationController.createWebhook）
- 优先级：中
- 关联需求/设计：REQ-028 / DD-036（INTF-022）
- 测试场景：异常路径——非 http(s) url → 40002（SSRF 防护范围声明）

**前置条件**

mock webhookService 对非法 url 抛 40002。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `createWebhook(req,res)` | `{url:"ftp://x/hook", events:["article.published"]}` | 响应 400 + code 40002 |
| 2 | 断言 | — | `expect(res.status).toHaveBeenCalledWith(400)`；`expect(res.json).toHaveBeenCalledWith(expect.objectContaining({error:{code:40002}}))` |

**预期结果**

非 http(s) url 拒绝（40002）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-037

- 标题：RSS 仅含已发布文章（rssService.getBloggerRss）
- 优先级：高
- 关联需求/设计：REQ-027 / DD-037（INTF-021）
- 测试场景：正常路径——草稿/归档不进入 RSS XML；博主不存在 40401

**前置条件**

mock authService 博主校验通过；mock articleService 返回该作者 2 篇 published + 1 篇 draft + 1 篇 archived。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `getBloggerRss("u_0002")` | — | 返回 XML 字符串 |
| 2 | 断言 item 数 | xml | `expect((xml.match(/<item>/g) || [])).toHaveLength(2)`；`expect(xml).not.toContain("草稿标题")` |
| 3 | 断言 channel | xml | `expect(xml).toContain("<channel>")`；`expect(xml).toContain("<pubDate>")` |

**预期结果**

RSS 2.0 结构合法且仅含 published（REQ-027）；XML 转义不破坏结构。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-038

- 标题：Webhook 失败重试 ≤3 次并留失败记录（webhookService.deliverWebhook）
- 优先级：高
- 关联需求/设计：REQ-028、NFR-003 / DD-038（INTF-022）
- 关联 BDD feature：`features/L3/L3_blog_system_webhook_retry-001.feature`
- 测试场景：正常/异常路径——回调持续失败：指数退避重试，attempts 递增至 3 后置 failed 并记 lastError

**前置条件**

fetch stub 恒抛错；假定时器；预置 WebhookConfig（secret）与 delivery 记录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `deliverWebhook("wd_1")` | 持续失败 | 重试发生 |
| 2 | 断言 attempts | delivery 记录 | `expect(delivery.attempts).toBeLessThanOrEqual(3)`；最终 `expect(delivery.status).toBe("failed")` |
| 3 | 断言失败记录 | delivery.lastError | `expect(delivery.lastError).toBeDefined()` |

**预期结果**

`expect(fetch).toHaveBeenCalledTimes(3)`（≤3 次）；最终失败有记录（NFR-003）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-039

- 标题：Webhook 同 url+event 去重（WebhookConfigStore.create）
- 优先级：中
- 关联需求/设计：REQ-028 / DD-039（INTF-022）
- 测试场景：异常路径——同 owner 同 url 同 event 重复 → 40901

**前置条件**

已存在 `{ownerId:"u_0002", url:"http://127.0.0.1:9000/hook", events:["article.published"]}`。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 重复创建同 url+event | 同上 | 抛 BizError |
| 2 | 断言 | err | `expect(err.code).toBe(40901)`；`expect(err.httpStatus).toBe(409)` |

**预期结果**

`uq_webhook_owner_url_event` 拦截；配置数不变。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-040

- 标题：投递记录状态流转（WebhookDeliveryStore.updateStatus）
- 优先级：中
- 关联需求/设计：REQ-028 / DD-040（INTF-022）
- 测试场景：正常路径——pending→delivering→delivered/failed 状态机

**前置条件**

预置 pending 投递记录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `updateStatus("wd_1","delivering")` | — | `expect(record.status).toBe("delivering")` |
| 2 | `updateStatus("wd_1","failed",3,"connect refused")` | 失败终态 | `expect(record.status).toBe("failed")`；`expect(record.attempts).toBe(3)`；`expect(record.lastError).toBe("connect refused")` |

**预期结果**

状态流转与失败信息落库正确。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-041

- 标题：认证中间件无令牌/过期令牌（authMiddleware.authenticate，RH-02）
- 优先级：高
- 关联需求/设计：REQ-008、NFR-002、CON-003 / DD-041（INTF-002）
- 关联 BDD feature：`features/L3/L3_blog_system_auth_flow-001.feature`
- 测试场景：异常/边界——缺失 token → 40101；过期 token（exp 已过，令牌状态 active→expired）→ 40102（对应 RH-02 状态定义）

**前置条件**

mock jwtUtil.verify：对过期 token 抛 40102；对伪造 token 抛 40101。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `authenticate(req,res,next)` | 无 Authorization 头 | `expect(next).toHaveBeenCalledWith(expect.objectContaining({code:40101}))` |
| 2 | `authenticate(req,res,next)` | 过期 token（exp 已过） | `expect(next).toHaveBeenCalledWith(expect.objectContaining({code:40102}))` |
| 3 | 合法 token | 有效 JWT | `expect(req.user.userId).toBe("u_0001")`；`expect(next).toHaveBeenCalledWith()` |

**预期结果**

40101/40102 判定正确；合法 token 挂载 req.user（`active ⇒ registered` 不变式成立——签发侧保证）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-042

- 标题：认证接口限流 10 次/分（rateLimitMiddleware.rateLimit）
- 优先级：高
- 关联需求/设计：NFR-006 / DD-042
- 关联 BDD feature：`features/L3/L3_blog_system_rate_limit-001.feature`
- 测试场景：边界条件——第 11 次请求 → 42901；窗口重置后放行

**前置条件**

假时钟；`rateLimit({limit:10, windowMs:60000})`。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 连续调用 10 次 | 同 IP | 均 next()（放行） |
| 2 | 第 11 次调用 | 同 IP | `expect(next).toHaveBeenCalledWith(expect.objectContaining({code:42901, retryable:true}))` |
| 3 | 推进 60s（窗口重置）后再调用 | 同 IP | `expect(next).toHaveBeenCalledWith()`（放行） |

**预期结果**

超限 42901；窗口重置恢复（NFR-006 阈值语义一致，测试窗口可缩小配置）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-043

- 标题：审计留痕且不含明文凭据（auditMiddleware.audit，RH-01）
- 优先级：高
- 关联需求/设计：CON-004 / DD-043
- 关联 BDD feature：`features/L3/L3_blog_system_auth_flow-001.feature`
- 测试场景：正常+负向——登录操作写审计（actionType/actor/resource/timestamp）；**审计记录不含 password/token/请求体**（阶段 3 reworkHint RH-01 落地）

**前置条件**

mock auditLogStore；构造含 `{password:"Passw0rd!x"}` 的 req.body 与 Bearer token 头的登录请求。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `audit("login")(req,res,next)` 完成请求后 | 登录请求 | auditLogStore.append 被调用 |
| 2 | 断言记录字段 | 捕获 append 入参 | `expect(log.actionType).toBe("login")`；`expect(log.actorId).toBe("u_0001")`；`expect(log.resourceType).toBeDefined()` |
| 3 | 负向断言 | log JSON | `expect(JSON.stringify(log)).not.toContain("Passw0rd!x")`；`expect(log).not.toHaveProperty("password")`；`expect(log).not.toHaveProperty("token")`；`expect(JSON.stringify(log)).not.toContain("Bearer")` |

**预期结果**

留痕字段齐全且**不含任何凭据/请求体**（RH-01 关闭反模式 #43 泄露面）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-044

- 标题：未映射异常统一 50001 通用文案（errorMiddleware.errorHandler）
- 优先级：高
- 关联需求/设计：CON-002 / DD-044
- 测试场景：异常路径——未知异常 → 500 + `{error:{code:50001}}`，响应体不含堆栈/内部类名

**前置条件**

构造含堆栈/内部路径的普通 Error。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `errorHandler(err, req, res, next)` | `new Error("internal: src/services/x.ts:12")` | `expect(res.status).toHaveBeenCalledWith(500)` |
| 2 | 断言响应体 | res.json 入参 | `expect(body).toEqual({error:{code:50001, message:"服务端内部错误"}})`；`expect(JSON.stringify(body)).not.toContain("src/")`；`expect(JSON.stringify(body)).not.toContain("Error")` |

**预期结果**

错误码目录映射 50001 通用文案，**禁止 unwrapped 堆栈/路径直出**（CON-002/阶段 3 security Optional 处置）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-045

- 标题：async 处理器异常转发（asyncHandler.wrap）
- 优先级：高
- 关联需求/设计：CON-002 / DD-045
- 测试场景：异常路径——async 处理抛错 → next(err)（Express 4 不吞 async 拒绝）

**前置条件**

handler 为 `async () => { throw new BizError(40401); }`。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `wrap(handler)(req,res,next)` | 抛错 handler | `expect(next).toHaveBeenCalledWith(expect.objectContaining({code:40401}))` |
| 2 | 正常 handler | 返回 200 | `expect(next).not.toHaveBeenCalled()`（正常路径不干扰） |

**预期结果**

async 拒绝被捕获并转发至 errorMiddleware。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-046

- 标题：JWT HS256 24h 有效期（jwtUtil.sign/verify）
- 优先级：高
- 关联需求/设计：REQ-008、CON-003 / DD-046
- 关联 BDD feature：`features/L3/L3_blog_system_auth_flow-001.feature`
- 测试场景：正常路径——签发令牌 `exp−iat ≤ 86400s`，验签返回 sub

**前置条件**

`process.env.JWT_SECRET = "test-secret-001"`（测试密钥注入，CON-003）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `sign({sub:"u_0001", role:"reader"})` | — | `expect(token).toMatch(/^eyJ/)`（JWT 三段式） |
| 2 | 解码断言 | token | `expect(payload.exp - payload.iat).toBeLessThanOrEqual(86400)`；`expect(payload.alg ?? "HS256").toBe("HS256")` |
| 3 | `verify(token)` | 合法 token | `expect(payload.sub).toBe("u_0001")` |

**预期结果**

HS256 签名、24h 有效期上限（`exp−iat ≤ 86400s`）成立。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-047

- 标题：zod 校验错误映射 40001/40002（validationUtil.parse）
- 优先级：高
- 关联需求/设计：CON-002 / DD-047
- 测试场景：异常路径——类型不符/缺失 → 40001；取值越界（分页/长度/枚举）→ 40002

**前置条件**

注册 schema（username 3~32、email 格式、password 8~64）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `parse(schema, {username:1})` | 类型不符 | `expect(err.code).toBe(40001)` |
| 2 | `parse(schema, {username:"ab", email:"x", password:"short"})` | 长度越界 | `expect(err.code).toBe(40002)` |
| 3 | `parse(schema, 合法输入)` | 合法 | `expect(result.success).toBe(true)` |

**预期结果**

错误码映射（40001 类型/缺失、40002 越界）与成功路径正确。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-048

- 标题：存储基座工厂与事务原子性（storeFactory + txManager）
- 优先级：高
- 关联需求/设计：CON-001、NFR-003 / DD-048
- 测试场景：正常/异常路径——createStores 全量实例化；begin/commit/rollback 快照一致性（回滚后数据恢复）

**前置步骤**

storeFactory 实例化。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `createStores()` | — | `expect(container).toHaveProperty("userStore")`；`expect(container).toHaveProperty("articleStore")`；…共 14 个 store 均存在 |
| 2 | begin → userStore.create → rollback | 事务回滚 | `expect(userStore.findAll()).toHaveLength(0)`（变更撤销） |
| 3 | begin → 写入 → commit | 事务提交 | `expect(userStore.findAll()).toHaveLength(1)`（变更生效） |

**预期结果**

14 store 实例齐备；事务 begin/commit/rollback 快照语义正确（NFR-003 进程内一致性）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-049

- 标题：审计日志保留 90 天清理（AuditLogStore）
- 优先级：中
- 关联需求/设计：CON-004 / DD-049
- 测试场景：边界条件——append 落库 + prune 按 createdAt 删除 90 天前记录（≥90 天保留策略）

**前置条件**

假时钟；预置 1 条 91 天前 + 1 条 30 天前审计记录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `prune(now − 90天)` | — | `expect(removed).toBe(1)`（仅 91 天前记录删除） |
| 2 | 断言保留 | list() | `expect(list().length).toBe(1)`；30 天前记录仍在 |

**预期结果**

保留策略边界（>90 天删除、≤90 天保留）正确。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-050

- 标题：中间件链顺序与静态路径优先（AppFactory.createApp）
- 优先级：高
- 关联需求/设计：NFR-001、NFR-005 / DD-050
- 测试场景：正常路径——`/api/articles/hot` 先于 `/:id` 注册（`GET /api/articles/hot` 不被 `:id="hot"` 拦截）；`/api/users/me` 先于 `/api/users/:id/follow`；中间件链 order 正确

**前置条件**

createApp() 返回 Express 实例（supertest 直连）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | supertest `GET /api/articles/hot?limit=1` | — | `expect(res.status).not.toBe(404)`（命中热门而非 `:id="hot"`） |
| 2 | supertest `GET /api/users/me`（带 token） | — | `expect(res.status).not.toBe(404)`（命中静态资料路由而非 `:id="me"` follow） |
| 3 | 兜底 404 | `GET /api/no-such` | `expect(res.status).toBe(404)`；`expect(res.body.error).toBeDefined()`（CON-002 结构） |

**预期结果**

静态路径先于参数路径注册；兜底 404 经 errorHandler 统一结构。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-051

- 标题：登录凭据错误统一 40101 防枚举（authService.login）
- 优先级：高
- 关联需求/设计：REQ-008 / DD-002（INTF-002）
- 测试场景：异常路径——用户名不存在与密码错误返回同一错误码（防账号枚举）

**前置条件**

预置用户（username="reader1"）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `login("no_such_user", "Passw0rd!x")` | 用户不存在 | 抛 BizError 40101 |
| 2 | `login("reader1", "WrongPass0!")` | 密码错误 | 抛 BizError 40101 |
| 3 | 断言两错误码一致 | — | `expect(err1.code).toBe(40101)`；`expect(err2.code).toBe(40101)`；`expect(err1.message).toBe(err2.message)` |

**预期结果**

两类失败不可区分（同一 code+message），防枚举。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-052

- 标题：归档后直跳发布非法（articleStateMachine.transition）
- 优先级：高
- 关联需求/设计：REQ-013 / DD-008（INTF-007）
- 测试场景：异常路径——`archived→published` 直跳 → 60001（须先 unarchive 回 draft）

**前置条件**

无（纯函数）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `canTransition("archived","publish")` | — | `expect(result).toBe(false)` |
| 2 | `transition("archived","publish")` | 直跳 | 抛 BizError |
| 3 | 断言 | err | `expect(err.code).toBe(60001)`；`expect(err.httpStatus).toBe(409)` |

**预期结果**

非法迁移 60001（archived→published 直跳、draft→archived 同型）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-053

- 标题：非文章作者删除评论被拒（commentService.deleteComment）
- 优先级：高
- 关联需求/设计：REQ-018 / DD-018（INTF-012）
- 关联 BDD feature：`features/L3/L3_blog_system_comment_flow-001.feature`（BDD-L3-016）
- 测试场景：异常路径——`actorId !== article.authorId` → 40301（越权删除被拒）

**前置条件**

预置文章 a_1001（authorId="u_0002"）与评论 c_9001；actorId="u_0001"（非作者）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `deleteComment("a_1001","c_9001","u_0001")` | 非作者 | 抛 BizError |
| 2 | 断言 | err | `expect(err.code).toBe(40301)`；`expect(err.httpStatus).toBe(403)` |
| 3 | 断言未删 | commentStore.findById("c_9001") | `expect(comment).not.toBeNull()`（评论保留） |

**预期结果**

`deletionAuthorized=FALSE` → 40301；评论未被删除（RH-03 授权上下文未授权分支）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-054

- 标题：去重窗口外重复访问 +1（readingStatService.recordView）
- 优先级：中
- 关联需求/设计：REQ-024 / DD-031（INTF-018）
- 测试场景：边界条件——推进超过 5 分钟窗口后同 IP 再访问 → 新增记录（计数 +1）

**前置条件**

假时钟；首次 recordView 后推进 6 分钟。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 首次 `recordView("a_1001","127.0.0.1")` | now | 写入 1 条 |
| 2 | 推进 6 分钟再 `recordView` | 窗口外 | 新增记录 |
| 3 | 断言 | readingRecordStore | `expect(count).toBe(2)`；`expect(store.isDuplicated(...,300000)).toBe(false)` |

**预期结果**

窗口外边界 +1 正确（去重仅限 5 分钟窗口）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-055

- 标题：Webhook 回调 HMAC 签名正确（webhookService.deliverWebhook）
- 优先级：高
- 关联需求/设计：REQ-028 / DD-038（INTF-022）
- 测试场景：正常路径——请求头 `X-Blog-Signature=HMAC-SHA256(body,secret)`、`X-Blog-Event`、`X-Blog-Timestamp` 正确（接收端可重算验签）

**前置条件**

fetch stub 捕获出站请求；secret="s3cret"；payload 固定。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `deliverWebhook("wd_1")` | — | fetch 被调用 1 次 |
| 2 | 断言签名头 | captured headers | 用 secret 重算：`expect(signature).toBe(crypto.createHmac("sha256", "s3cret").update(JSON.stringify(payload)).digest("hex"))` |
| 3 | 断言其余头 | headers | `expect(eventHeader).toBe("article.published")`；`expect(timestampHeader).toBeDefined()` |

**预期结果**

`X-Blog-Signature` 可被接收端用 secret 重算一致（事件签名闭环，IT-006 语义的单元级）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-056

- 标题：篡改令牌验签失败（jwtUtil.verify）
- 优先级：高
- 关联需求/设计：REQ-008、NFR-002 / DD-046
- 测试场景：异常路径——签名被篡改/伪造 → 40101

**前置条件**

合法 token 生成后篡改 payload 段（或换密钥重签）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `verify(tamperedToken)` | 篡改 token | 抛 BizError |
| 2 | 断言 | err | `expect(err.code).toBe(40101)`；`expect(err.httpStatus).toBe(401)` |
| 3 | 密钥不匹配重签 token | 错误密钥签发 | `expect(() => verify(foreignToken)).toThrow()` |

**预期结果**

伪造/篡改令牌统一 40101（NFR-002 校验 JWT 有效性）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-057

- 标题：标签偏好推荐含已读去重（recommendService.getRecommendations）
- 优先级：中
- 关联需求/设计：REQ-022 / DD-027（INTF-016）
- 测试场景：正常路径——有阅读历史：按标签偏好推荐相似文章；结果排除已读并去重

**前置条件**

mock readingStatService 标签偏好 `[{tag:"W模型",score:5}]`；候选 3 篇含 1 篇已读、1 篇重复标签；mock articleService 返回候选。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `getRecommendations("u_0001", 10)` | 有历史 | `expect(result.every(i => i.reason === "tag-preference")).toBe(true)` |
| 2 | 断言去重/排除已读 | result | `expect(new Set(result.map(i=>i.articleId)).size).toBe(result.length)`（无重复）；`expect(result).not.toContainEqual(expect.objectContaining({articleId:"a_read"}))` |

**预期结果**

标签偏好推荐、已读排除、去重均成立（REQ-022）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

### UT-058

- 标题：草稿不入搜索索引（searchService.syncIndex）
- 优先级：中
- 关联需求/设计：REQ-023 / DD-028（INTF-017）
- 测试场景：异常路径——仅已发布文章同步索引；归档/删除移除索引（草稿/归档不可检索）

**前置条件**

mock articleService 返回某文章 status=draft（另一篇 published）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | `syncIndex({type:"article.updated", articleId:"a_draft"})` | 草稿事件 | 索引不写入该文章 |
| 2 | `searchArticles("草稿关键词",1,20)` | 检索 | `expect(result.total).toBe(0)`（草稿不可检索） |
| 3 | `syncIndex({type:"article.published", articleId:"a_pub"})` → 检索 | 已发布 | `expect(result.total).toBe(1)` |

**预期结果**

索引同步只接受 published（REQ-023 仅已发布语义，与 INTF-011 40402 一致）。

**执行状态**

- [x] 待执行
- [ ] 通过
- [ ] 失败 —— 失败原因：{{}}

---

## 用例汇总

| 用例 ID | 标题 | 优先级 | 关联 | 状态 |
|---|---|---|---|---|
| UT-001 | 注册接口成功透传 | 高 | REQ-007/DD-001 | 待执行 |
| UT-002 | 注册成功 bcrypt 哈希且响应不含明文密码 | 高 | REQ-007/DD-002 | 待执行 |
| UT-003 | 修改密码原密码错误 | 高 | REQ-010/DD-003 | 待执行 |
| UT-004 | 邮箱唯一冲突 | 高 | REQ-007/DD-004 | 待执行 |
| UT-005 | 非博主创建文章被拒 | 高 | REQ-009/011/DD-005 | 待执行 |
| UT-006 | 分类嵌套深度超限 | 中 | REQ-016/DD-006 | 待执行 |
| UT-007 | 创建文章标签不存在 | 高 | REQ-011/DD-007 | 待执行 |
| UT-008 | 文章状态机 draft→published 合法迁移 | 高 | REQ-012/013/DD-008 | 待执行 |
| UT-009 | 标签重名冲突 | 中 | REQ-015/DD-009 | 待执行 |
| UT-010 | 同级分类重名冲突 | 中 | REQ-016/DD-010 | 待执行 |
| UT-011 | 分页参数越界 | 中 | REQ-014/017/DD-011 | 待执行 |
| UT-012 | 按名称查标签不存在 | 中 | REQ-015/DD-012 | 待执行 |
| UT-013 | 根分类创建 | 中 | REQ-016/DD-013 | 待执行 |
| UT-014 | 草稿文章对读者不可见 | 高 | REQ-017/DD-014 | 待执行 |
| UT-015 | 未认证评论被拒 | 高 | REQ-018/DD-015 | 待执行 |
| UT-016 | 禁止自关注 | 高 | REQ-020/DD-016 | 待执行 |
| UT-017 | 详情访问触发阅读事件 | 高 | REQ-017/024/DD-017 | 待执行 |
| UT-018 | 文章作者删除评论成功（RH-03） | 高 | REQ-018/DD-018 | 待执行 |
| UT-019 | 重复点赞幂等 | 高 | REQ-019/DD-019 | 待执行 |
| UT-020 | 关注非博主被拒 | 高 | REQ-020/DD-020 | 待执行 |
| UT-021 | 评论列表按时间降序分页 | 中 | REQ-018/DD-021 | 待执行 |
| UT-022 | 点赞计数正确 | 中 | REQ-019/DD-022 | 待执行 |
| UT-023 | 收藏列表仅本人 | 中 | REQ-019/DD-023 | 待执行 |
| UT-024 | 无关注关系返回空列表 | 中 | REQ-020/DD-024 | 待执行 |
| UT-025 | 热门 limit 越界 | 中 | REQ-021/DD-025 | 待执行 |
| UT-026 | 近 7 天阅读量 Top N | 高 | REQ-021/DD-026 | 待执行 |
| UT-027 | 冷启动推荐回退热门 | 高 | REQ-022/DD-027 | 待执行 |
| UT-028 | 四字段命中与相关性排序 | 高 | REQ-023/DD-028 | 待执行 |
| UT-029 | 空关键词检索空结果 | 中 | REQ-023/DD-029 | 待执行 |
| UT-030 | 统计面板非博主被拒 | 中 | REQ-025/DD-030 | 待执行 |
| UT-031 | 同 IP 5 分钟窗口去重 | 高 | REQ-024/DD-031 | 待执行 |
| UT-032 | 博主面板四项聚合与趋势补零 | 高 | REQ-025/DD-032 | 待执行 |
| UT-033 | 评论事件产生被回复通知 | 高 | REQ-026/DD-033 | 待执行 |
| UT-034 | 阅读去重窗口边界判定 | 中 | REQ-024/DD-034 | 待执行 |
| UT-035 | 通知列表未读过滤 | 中 | REQ-026/DD-035 | 待执行 |
| UT-036 | Webhook url 非 http(s) 被拒 | 中 | REQ-028/DD-036 | 待执行 |
| UT-037 | RSS 仅含已发布文章 | 高 | REQ-027/DD-037 | 待执行 |
| UT-038 | Webhook 失败重试 ≤3 次并留失败记录 | 高 | REQ-028/NFR-003/DD-038 | 待执行 |
| UT-039 | Webhook 同 url+event 去重 | 中 | REQ-028/DD-039 | 待执行 |
| UT-040 | 投递记录状态流转 | 中 | REQ-028/DD-040 | 待执行 |
| UT-041 | 认证中间件无令牌/过期令牌（RH-02） | 高 | REQ-008/NFR-002/CON-003/DD-041 | 待执行 |
| UT-042 | 认证接口限流 10 次/分 | 高 | NFR-006/DD-042 | 待执行 |
| UT-043 | 审计留痕且不含明文凭据（RH-01） | 高 | CON-004/DD-043 | 待执行 |
| UT-044 | 未映射异常统一 50001 通用文案 | 高 | CON-002/DD-044 | 待执行 |
| UT-045 | async 处理器异常转发 | 高 | CON-002/DD-045 | 待执行 |
| UT-046 | JWT HS256 24h 有效期 | 高 | REQ-008/CON-003/DD-046 | 待执行 |
| UT-047 | zod 校验错误映射 40001/40002 | 高 | CON-002/DD-047 | 待执行 |
| UT-048 | 存储基座工厂与事务原子性 | 高 | CON-001/NFR-003/DD-048 | 待执行 |
| UT-049 | 审计日志保留 90 天清理 | 中 | CON-004/DD-049 | 待执行 |
| UT-050 | 中间件链顺序与静态路径优先 | 高 | NFR-001/NFR-005/DD-050 | 待执行 |
| UT-051 | 登录凭据错误统一 40101 防枚举 | 高 | REQ-008/DD-002 | 待执行 |
| UT-052 | 归档后直跳发布非法 | 高 | REQ-013/DD-008 | 待执行 |
| UT-053 | 非文章作者删除评论被拒 | 高 | REQ-018/DD-018 | 待执行 |
| UT-054 | 去重窗口外重复访问 +1 | 中 | REQ-024/DD-031 | 待执行 |
| UT-055 | Webhook 回调 HMAC 签名正确 | 高 | REQ-028/DD-038 | 待执行 |
| UT-056 | 篡改令牌验签失败 | 高 | REQ-008/NFR-002/DD-046 | 待执行 |
| UT-057 | 标签偏好推荐含已读去重 | 中 | REQ-022/DD-027 | 待执行 |
| UT-058 | 草稿不入搜索索引 | 中 | REQ-023/DD-028 | 待执行 |

## 测试用例覆盖说明

- **功能点覆盖**：50/50 个 DD 设计项（类/模块）各 ≥1 用例（UT-001~UT-050 一一对应）；关键方法追加异常/边界用例（UT-051~UT-058）。22/22 接口方向（INTF-001~022）均有对应单元级用例。
- **reworkHints 专项覆盖**：RH-01 审计不含凭据 → UT-043（负向断言）+ UT-049；RH-02 令牌状态机不变式 → UT-041（40101/40102）+ UT-046/056（签发/验签）+ UT-051（注册-登录链）；RH-03 删除可达性 → UT-018（授权成功）+ UT-053（越权拒绝）；RH-04 调用图边 → UT-018/020/030/052 覆盖 SD-003→SD-001、SD-006→SD-001 身份校验路径。
- **边界条件必覆盖清单**：空值（UT-012/029/024）、null（UT-012/013）、极值 MAX/MIN（UT-011 pageSize=50、UT-025 limit=50/1）、越界 ±1（UT-011 page=0/pageSize=51、UT-025 limit=0/51、UT-034 窗口 ±1ms）、类型不符（UT-047）、共享状态并发竞态（UT-042 限流窗口、UT-031/034/054 去重窗口——以假时钟顺序调用模拟，Node 单线程语义保证）。
- **mock/stub 隔离方案**：服务层 mock 跨模块依赖（authService/articleService/readingStatService 等）与 eventBus；中间件构造 req/res/next 桩；webhookService 注入 fetch stub + 假定时器；时间窗口类注入假时钟；**单元测试不依赖任何外部服务/网络**（禁止行为 #3 合规）。
- **覆盖率预估**：行覆盖率目标 ≥80%（NFR-004 门禁阈值）；分支覆盖聚焦于状态机迁移、去重窗口、限流窗口、授权判定等关键分支；最终以 vitest coverage 报告为准（阶段 5 执行时验证）。
- **断言格式**：全部用例含 `expect()` 断言（正常 `toBe/toHaveBeenCalledWith`、异常 `toThrow/rejects.toMatchObject`、负向 `not.toContain/not.toHaveProperty`），无 `// TODO: assert` 占位。
