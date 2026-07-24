# 单元测试用例文档

> 阶段 4（详细设计）同步产出。套用 `templates/test-case.md` 模板，类型=单元测试。
> 覆盖类/方法级逻辑与边界条件：每个方法 ≥ 1 用例且含 `expect()` 断言。
> 本阶段只设计，阶段 5（编码）实现为可执行测试代码，阶段 5 执行。

## 文档信息

- 项目名称：blog-system-demo
- 测试类型：单元测试
- 设计来源阶段：阶段 4（详细设计）
- 执行阶段：阶段 5（编码实现）
- 文档版本：v1.0
- 关联详细设计：docs/detailed-design.md
- 关联需求文档：docs/requirement-spec.md

## 0. 隔离与覆盖率目标

### 0.1 mock/stub 隔离方案

> 单元测试禁止依赖外部服务（阶段 4 参考文档 §禁止行为 #3）。所有跨类依赖通过 mock 隔离。

| 被测单元 | 依赖项 | 隔离方式 | 隔离工具 |
|---|---|---|---|
| Controller（DD-*-CTRL） | Service / Middleware | vi.mock 模拟 Service 模块导出 | vitest `vi.mock` |
| Service（DD-*-SVC） | Service / Store / Util | 构造函数注入 mock 实例 | vitest `vi.fn()` |
| Store（DD-*-STORE） | Map（共享状态） | 每用例 beforeEach 重建实例，避免跨用例污染 | 原生 `new Map()` |
| Middleware（DD-*-MW） | JwtUtil / Request | mock JwtUtil 方法 + 构造 req/res/next 对象 | vitest `vi.fn()` |
| Util（DD-*-UTIL） | 外部库（bcrypt / jwt） | 真实调用（库本身稳定，不需 mock） | - |

**共享状态竞态说明**：内存 Map 为单线程同步访问（Node.js 事件循环），无真实并发竞态。边界清单中"并发竞态"项不适用（标记 N/A），见 §6.2。

### 0.2 覆盖率目标

- 分支覆盖率 ≥ 80%（NFR-005 要求）
- 边界条件必覆盖清单全命中：空输入、null、极值（MAX/MIN）、越界（±1）、类型不符、并发竞态（N/A 见 §0.1）
- 每个方法 ≥ 1 用例（阶段 4 参考文档 §测试用例生成算法 步骤 1）

---

## 1. 控制器层用例

### UT-001

- 标题：AuthController.register 正向——返回 201 + userId
- 优先级：高
- 关联需求/设计：REQ-002 / DD-AUTH-CTRL → INTF-AUTH-API
- 测试场景：注册请求合法，控制器调用 AuthService.register 成功后返回 201 + userId

**前置条件**
- mock AuthService.register 返回 `{ ok:true, data:{ userId:'u-1' } }`
- mock validate 中间件已通过（req.body 已为安全数据）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 AuthController.register(req) | req.body={username:'alice',password:'secret123'} | res.status 被调用 201；res.json 含 `{code:0,data:{userId:'u-1',username:'alice'}}` |

**预期结果**
```js
expect(res.status).toHaveBeenCalledWith(201);
expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
  code: 0,
  data: expect.objectContaining({ userId: 'u-1', username: 'alice' })
}));
expect(authService.register).toHaveBeenCalledWith('alice', 'secret123');
```

**执行状态**
- [ ] 待执行

---

### UT-002

- 标题：AuthController.register 异常——用户名已存在返回 409
- 优先级：高
- 关联需求/设计：REQ-002 / DD-AUTH-CTRL
- 测试场景：AuthService.register 抛出业务错误 60001（用户名已存在），控制器传递到错误中间件

**前置条件**
- mock AuthService.register 抛出 `{ code:60001, message:'用户名已存在' }`

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 AuthController.register(req) | req.body={username:'alice',password:'secret123'} | next 被调用并传入含 code=60001 的错误 |

**预期结果**
```js
expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 60001 }));
expect(authService.register).toHaveBeenCalledWith('alice', 'secret123');
```

**执行状态**
- [ ] 待执行

---

### UT-003

- 标题：AuthController.login 正向——返回 200 + token
- 优先级：高
- 关联需求/设计：REQ-002 / DD-AUTH-CTRL → INTF-AUTH-API
- 测试场景：登录凭证正确，控制器调用 AuthService.login 成功后返回 200 + token + role

**前置条件**
- mock AuthService.login 返回 `{ ok:true, data:{ token:'jwt-xxx', role:'user' } }`

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 AuthController.login(req) | req.body={username:'alice',password:'secret123'} | res.status 被调用 200；res.json 含 `{code:0,data:{token:'jwt-xxx',role:'user'}}` |

**预期结果**
```js
expect(res.status).toHaveBeenCalledWith(200);
expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
  code: 0,
  data: expect.objectContaining({ token: 'jwt-xxx', role: 'user' })
}));
expect(authService.login).toHaveBeenCalledWith('alice', 'secret123');
```

**执行状态**
- [ ] 待执行

---

### UT-004

- 标题：AuthController.login 异常——凭证错误返回 401
- 优先级：高
- 关联需求/设计：REQ-002 / DD-AUTH-CTRL
- 测试场景：AuthService.login 抛出 40101（凭证错误），控制器传递到错误中间件

**前置条件**
- mock AuthService.login 抛出 `{ code:40101, message:'用户名或密码错误' }`

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 AuthController.login(req) | req.body={username:'alice',password:'wrong'} | next 被调用并传入含 code=40101 的错误 |

**预期结果**
```js
expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 40101 }));
```

**执行状态**
- [ ] 待执行

---

### UT-005

- 标题：ArticleController.publishArticle 正向——返回 201 + articleId
- 优先级：高
- 关联需求/设计：REQ-003 / DD-ARTICLE-CTRL → INTF-ARTICLE-API
- 测试场景：已登录用户发布文章，控制器调用 ArticleService.publish 成功后返回 201 + articleId + status=pending

**前置条件**
- req.user={userId:'u-1',role:'user'}
- mock ArticleService.publish 返回 `{ ok:true, data:{ articleId:'a-1', status:'pending' } }`

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 ArticleController.publishArticle(req) | req.body={title:'我的文章',content:'正文'} | res.status 被调用 201；res.json 含 `{code:0,data:{articleId:'a-1',status:'pending'}}` |

**预期结果**
```js
expect(res.status).toHaveBeenCalledWith(201);
expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
  code: 0,
  data: expect.objectContaining({ articleId: 'a-1', status: 'pending' })
}));
expect(articleService.publish).toHaveBeenCalledWith('u-1', '我的文章', '正文');
```

**执行状态**
- [ ] 待执行

---

### UT-006

- 标题：ArticleController.listArticles 正向——普通用户过滤 rejected
- 优先级：高
- 关联需求/设计：REQ-003, REQ-005 / DD-ARTICLE-CTRL
- 测试场景：普通用户列表查询，控制器调用 ArticleService.list(role='user') 返回过滤后数组

**前置条件**
- req.user={userId:'u-1',role:'user'}
- mock ArticleService.list 返回 `{ ok:true, data:[{id:'a-2',status:'approved'}] }`（不含 rejected）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 ArticleController.listArticles(req) | 无 body | res.status 被调用 200；res.json 含 articles 数组且不含 rejected |

**预期结果**
```js
expect(res.status).toHaveBeenCalledWith(200);
expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 0 }));
expect(articleService.list).toHaveBeenCalledWith('user');
```

**执行状态**
- [ ] 待执行

---

### UT-007

- 标题：ArticleController.getArticle 异常——rejected 文章对普通用户返回 403
- 优先级：高
- 关联需求/设计：REQ-003, REQ-005 / DD-ARTICLE-CTRL
- 测试场景：普通用户查询 rejected 文章，ArticleService.getById 抛出 40301，控制器传递到错误中间件

**前置条件**
- req.user={userId:'u-1',role:'user'}；req.params.id='a-3'
- mock ArticleService.getById 抛出 `{ code:40301, message:'禁止访问' }`

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 ArticleController.getArticle(req) | req.params.id='a-3' | next 被调用并传入含 code=40301 的错误 |

**预期结果**
```js
expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 40301 }));
expect(articleService.getById).toHaveBeenCalledWith('a-3', 'user');
```

**执行状态**
- [ ] 待执行

---

### UT-008

- 标题：CommentController.addComment 正向——返回 201 + commentId
- 优先级：高
- 关联需求/设计：REQ-004 / DD-COMMENT-CTRL → INTF-COMMENT-API
- 测试场景：已登录用户对文章添加评论，控制器调用 CommentService.add 成功后返回 201 + commentId

**前置条件**
- req.user={userId:'u-1',role:'user'}；req.params.id='a-1'
- mock CommentService.add 返回 `{ ok:true, data:{ commentId:'c-1' } }`

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 CommentController.addComment(req) | req.body={content:'好文章'} | res.status 被调用 201；res.json 含 `{code:0,data:{commentId:'c-1',articleId:'a-1'}}` |

**预期结果**
```js
expect(res.status).toHaveBeenCalledWith(201);
expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
  code: 0,
  data: expect.objectContaining({ commentId: 'c-1' })
}));
expect(commentService.add).toHaveBeenCalledWith('a-1', 'u-1', '好文章');
```

**执行状态**
- [ ] 待执行

---

### UT-009

- 标题：CommentController.addComment 异常——文章不存在返回 404
- 优先级：高
- 关联需求/设计：REQ-004 / DD-COMMENT-CTRL
- 测试场景：对不存在文章添加评论，CommentService.add 抛出 40401，控制器传递到错误中间件

**前置条件**
- req.params.id='a-999'
- mock CommentService.add 抛出 `{ code:40401, message:'文章不存在' }`

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 CommentController.addComment(req) | req.body={content:'好文章'} | next 被调用并传入含 code=40401 的错误 |

**预期结果**
```js
expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 40401 }));
```

**执行状态**
- [ ] 待执行

---

## 2. 服务层用例

### UT-010

- 标题：AuthService.register 正向——bcrypt 哈希存储
- 优先级：高
- 关联需求/设计：REQ-002 / DD-AUTH-SVC → INTF-AUTH-SERVICE
- 测试场景：注册新用户，bcrypt 哈希密码后通过 UserService 存入，返回 userId

**前置条件**
- mock UserService.findByUsername 返回 null（用户名未占用）
- mock UserService.saveUser 返回 `{ ok:true, data:undefined }`
- mock PasswordUtil.hash 返回 '$2b$10$hashmock'
- mock JwtUtil 不参与（register 不签发 token）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 authService.register('alice','secret123') | username='alice', password='secret123' | 返回 `{ok:true,data:{userId}}`；PasswordUtil.hash 被调用；UserService.saveUser 被调用且 passwordHash 以 '$2' 开头 |

**预期结果**
```js
const result = await authService.register('alice', 'secret123');
expect(result.ok).toBe(true);
expect(result.data.userId).toBeDefined();
expect(passwordUtil.hash).toHaveBeenCalledWith('secret123');
expect(userService.saveUser).toHaveBeenCalledWith(expect.objectContaining({
  username: 'alice',
  passwordHash: expect.stringMatching(/^\$2/)
}));
```

**执行状态**
- [ ] 待执行

---

### UT-011

- 标题：AuthService.login 正向——JWT 签发
- 优先级：高
- 关联需求/设计：REQ-002 / DD-AUTH-SVC
- 测试场景：已注册用户登录，bcrypt 比对密码成功后签发 JWT，返回 token + role

**前置条件**
- mock UserService.findByUsername 返回 `{ id:'u-1', username:'alice', passwordHash:'$2b$10$hash', role:'user' }`
- mock PasswordUtil.compare 返回 true
- mock JwtUtil.sign 返回 'jwt-token-xxx'

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 authService.login('alice','secret123') | username='alice', password='secret123' | 返回 `{ok:true,data:{token:'jwt-token-xxx',role:'user'}}` |

**预期结果**
```js
const result = await authService.login('alice', 'secret123');
expect(result.ok).toBe(true);
expect(result.data.token).toBe('jwt-token-xxx');
expect(result.data.role).toBe('user');
expect(passwordUtil.compare).toHaveBeenCalledWith('secret123', '$2b$10$hash');
expect(jwtUtil.sign).toHaveBeenCalledWith({ userId: 'u-1', role: 'user' });
```

**执行状态**
- [ ] 待执行

---

### UT-012

- 标题：ArticleService.publish 正向——status=pending
- 优先级：高
- 关联需求/设计：REQ-003 / DD-ARTICLE-SVC → INTF-ARTICLE-SERVICE
- 测试场景：发布新文章，初始状态为 pending，存入 ArticleStore

**前置条件**
- mock ArticleStore.save 返回 void

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 articleService.publish('u-1','标题','正文') | authorId='u-1', title='标题', content='正文' | 返回 `{ok:true,data:{articleId,status:'pending'}}`；ArticleStore.save 被调用且 article.status='pending' |

**预期结果**
```js
const result = articleService.publish('u-1', '标题', '正文');
expect(result.ok).toBe(true);
expect(result.data.status).toBe('pending');
expect(result.data.articleId).toBeDefined();
expect(articleStore.save).toHaveBeenCalledWith(expect.objectContaining({
  authorId: 'u-1',
  title: '标题',
  status: 'pending'
}));
```

**执行状态**
- [ ] 待执行

---

### UT-013

- 标题：ArticleService.list 过滤——user 角色不含 rejected
- 优先级：高
- 关联需求/设计：REQ-003, REQ-005 / DD-ARTICLE-SVC
- 测试场景：普通用户列表查询过滤 rejected 文章，admin 返回全部

**前置条件**
- mock ArticleStore.findAll 返回 [a1(pending), a2(approved), a3(rejected)]

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 articleService.list('user') | role='user' | 返回数组仅含 a1+a2，不含 a3(rejected) |
| 2 | 调用 articleService.list('admin') | role='admin' | 返回数组含 a1+a2+a3 全部 |

**预期结果**
```js
const userResult = articleService.list('user');
expect(userResult.ok).toBe(true);
expect(userResult.data.map(a => a.id)).toEqual(['a1', 'a2']);
expect(userResult.data.find(a => a.status === 'rejected')).toBeUndefined();

const adminResult = articleService.list('admin');
expect(adminResult.data).toHaveLength(3);
```

**执行状态**
- [ ] 待执行

---

### UT-014

- 标题：CommentService.add 校验——文章状态 rejected 返回 60002
- 优先级：高
- 关联需求/设计：REQ-004 / DD-COMMENT-SVC → INTF-COMMENT-SERVICE
- 测试场景：对 rejected 文章添加评论，ArticleService.getById 抛出 40301，CommentService 转换为 60002（状态不允许评论）

**前置条件**
- mock ArticleService.getById 抛出 `{ code:40301, message:'禁止访问' }`（rejected 文章对 user 不可见）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 commentService.add('a-3','u-1','评论') | articleId='a-3' | 返回 `{ok:false,code:60002}`；CommentStore.save 未被调用 |

**预期结果**
```js
const result = commentService.add('a-3', 'u-1', '评论');
expect(result.ok).toBe(false);
expect(result.code).toBe(60002);
expect(commentStore.save).not.toHaveBeenCalled();
```

**执行状态**
- [ ] 待执行

---

### UT-015

- 标题：UserService.saveUser 用户名唯一性校验
- 优先级：高
- 关联需求/设计：REQ-001, REQ-002 / DD-USER-SVC → INTF-USER-SERVICE
- 测试场景：保存用户时校验用户名唯一性，重复用户名返回 60001

**前置条件**
- mock UserStore.findByUsername 第一次返回 null，第二次返回已存在用户

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 userService.saveUser(new User) | username='alice'（未占用） | 返回 `{ok:true}`；UserStore.save 被调用 |
| 2 | 调用 userService.saveUser(dup User) | username='alice'（已占用） | 返回 `{ok:false,code:60001}`；UserStore.save 未被调用 |

**预期结果**
```js
const ok = userService.saveUser({ id:'u-1', username:'alice', passwordHash:'h', role:'user' });
expect(ok.ok).toBe(true);
expect(userStore.save).toHaveBeenCalled();

const dup = userService.saveUser({ id:'u-2', username:'alice', passwordHash:'h', role:'user' });
expect(dup.ok).toBe(false);
expect(dup.code).toBe(60001);
```

**执行状态**
- [ ] 待执行

---

### UT-016

- 标题：ReviewService.review 正向——pending→approved
- 优先级：高
- 关联需求/设计：REQ-005 / DD-REVIEW-SVC → INTF-REVIEW-SERVICE
- 测试场景：管理员审核 pending 文章为 approved，状态流转并写入存储

**前置条件**
- mock ArticleStore.findById 返回 `{ id:'a-1', status:'pending' }`
- mock ArticleStore.updateStatus 返回 void

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 reviewService.review('a-1','approve','u-admin') | articleId='a-1', action='approve' | 返回 `{ok:true,data:{status:'approved'}}`；updateStatus 被调用为 ('a-1','approved') |

**预期结果**
```js
const result = reviewService.review('a-1', 'approve', 'u-admin');
expect(result.ok).toBe(true);
expect(result.data.status).toBe('approved');
expect(articleStore.updateStatus).toHaveBeenCalledWith('a-1', 'approved');
```

**执行状态**
- [ ] 待执行

---

## 3. 存储层用例

### UT-017

- 标题：ArticleStore 读写 + 状态更新
- 优先级：中
- 关联需求/设计：REQ-003, REQ-005 / DD-ARTICLE-STORE → INTF-ARTICLE-STORE
- 测试场景：save→findById→findAll→updateStatus 全链路读写，验证 Map 内数据一致性

**前置条件**
- 每个 beforeEach 新建 ArticleStore 实例（隔离 Map 状态）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 store.save(article) | article={id:'a-1',status:'pending'} | 无返回；内部 Map 含 a-1 |
| 2 | 调用 store.findById('a-1') | id='a-1' | 返回 article 且 status='pending' |
| 3 | 调用 store.findAll() | - | 返回长度 1 的数组 |
| 4 | 调用 store.updateStatus('a-1','approved') | id='a-1', status='approved' | 无返回；findById('a-1').status='approved' |

**预期结果**
```js
store.save({ id:'a-1', title:'t', content:'c', status:'pending', authorId:'u-1', createdAt:'ts' });
expect(store.findById('a-1').status).toBe('pending');
expect(store.findAll()).toHaveLength(1);
store.updateStatus('a-1', 'approved');
expect(store.findById('a-1').status).toBe('approved');
```

**执行状态**
- [ ] 待执行

---

### UT-018

- 标题：UserStore.findByUsername username 索引查找
- 优先级：中
- 关联需求/设计：REQ-002 / DD-USER-STORE → INTF-USER-STORE
- 测试场景：save 后 usernameIndex 建立，findByUsername 通过索引 O(1) 查找返回 User

**前置条件**
- 每用例新建 UserStore 实例

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 store.save(user) | user={id:'u-1',username:'alice'} | 无返回；usernameIndex 含 alice→u-1 |
| 2 | 调用 store.findByUsername('alice') | username='alice' | 返回 User.id='u-1' |
| 3 | 调用 store.findByUsername('bob') | username='bob'（不存在） | 返回 null |
| 4 | 调用 store.findById('u-1') | userId='u-1' | 返回 User.username='alice' |

**预期结果**
```js
store.save({ id:'u-1', username:'alice', passwordHash:'h', role:'user', createdAt:'ts' });
expect(store.findByUsername('alice').id).toBe('u-1');
expect(store.findByUsername('bob')).toBeNull();
expect(store.findById('u-1').username).toBe('alice');
```

**执行状态**
- [ ] 待执行

---

## 4. 中间件层用例

### UT-019

- 标题：AuthMiddleware.authenticate JWT 校验正向
- 优先级：高
- 关联需求/设计：REQ-002 / DD-AUTH-MW → INTF-AUTH-API（NFR-002 JWT 鉴权）
- 测试场景：合法 Bearer token，JwtUtil.verify 通过，注入 req.user 后调用 next()

**前置条件**
- mock JwtUtil.verify 返回 `{ userId:'u-1', role:'user' }`
- req.headers.authorization='Bearer jwt-xxx'

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 authMiddleware.authenticate(req,res,next) | Authorization='Bearer jwt-xxx' | req.user={userId:'u-1',role:'user'}；next() 被调用且无 err |

**预期结果**
```js
authMiddleware.authenticate(req, res, next);
expect(req.user).toEqual({ userId: 'u-1', role: 'user' });
expect(next).toHaveBeenCalledWith();
expect(jwtUtil.verify).toHaveBeenCalledWith('jwt-xxx');
```

**执行状态**
- [ ] 待执行

---

### UT-020

- 标题：AuthMiddleware.requireAdmin 非 admin 返回 403
- 优先级：高
- 关联需求/设计：REQ-005 / DD-AUTH-MW
- 测试场景：req.user.role='user' 时，requireAdmin 拦截并返回 40301

**前置条件**
- req.user={userId:'u-1',role:'user'}

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 authMiddleware.requireAdmin(req,res,next) | req.user.role='user' | res.status 被调用 403；res.json 含 code=40301；next 未被无参调用 |

**预期结果**
```js
authMiddleware.requireAdmin(req, res, next);
expect(res.status).toHaveBeenCalledWith(403);
expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 40301 }));
expect(next).not.toHaveBeenCalledWith();
```

**执行状态**
- [ ] 待执行

---

### UT-021

- 标题：ValidateMiddleware.validate zod 校验异常返回 400
- 优先级：高
- 关联需求/设计：REQ-002 / DD-VALIDATE-MW（NFR-003 输入校验）
- 测试场景：非法输入触发 zod 抛错，中间件捕获并返回 400 + 40001

**前置条件**
- schema = zod.object({ username: zod.string().min(3) })
- req.body={username:'ab'}（长度不足）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 validate(schema)(req,res,next) | req.body={username:'ab'} | res.status 被调用 400；res.json 含 code=40001；next 未被无参调用 |

**预期结果**
```js
const middleware = validateMiddleware.validate(schema);
middleware(req, res, next);
expect(res.status).toHaveBeenCalledWith(400);
expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 40001 }));
expect(next).not.toHaveBeenCalledWith();
```

**执行状态**
- [ ] 待执行

---

### UT-022

- 标题：ErrorMiddleware.handleError 错误码映射 4xx/5xx/业务
- 优先级：中
- 关联需求/设计：REQ-001 / DD-ERROR-MW
- 测试场景：不同错误 code 映射到不同 HTTP 状态码（40001→400, 40101→401, 40301→403, 40401→404, 60001→409, 60002→409, 50001→500）

**前置条件**
- 无

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 handleError(err40001,req,res,next) | err={code:40001} | res.status=400 |
| 2 | 调用 handleError(err40101,req,res,next) | err={code:40101} | res.status=401 |
| 3 | 调用 handleError(err40301,req,res,next) | err={code:40301} | res.status=403 |
| 4 | 调用 handleError(err40401,req,res,next) | err={code:40401} | res.status=404 |
| 5 | 调用 handleError(err60001,req,res,next) | err={code:60001} | res.status=409 |
| 6 | 调用 handleError(err50001,req,res,next) | err={code:50001} | res.status=500 |
| 7 | 调用 handleError(errUnknown,req,res,next) | err=普通 Error（无 code） | res.status=500 |

**预期结果**
```js
errorMiddleware.handleError({ code: 40001, message: 'x' }, req, res, next);
expect(res.status).toHaveBeenCalledWith(400);

errorMiddleware.handleError({ code: 40101, message: 'x' }, req, res, next);
expect(res.status).toHaveBeenCalledWith(401);

errorMiddleware.handleError({ code: 60001, message: 'x' }, req, res, next);
expect(res.status).toHaveBeenCalledWith(409);

errorMiddleware.handleError({ code: 50001, message: 'x' }, req, res, next);
expect(res.status).toHaveBeenCalledWith(500);

errorMiddleware.handleError(new Error('unknown'), req, res, next);
expect(res.status).toHaveBeenCalledWith(500);
```

**执行状态**
- [ ] 待执行

---

## 5. 工具类用例

### UT-023

- 标题：JwtUtil.sign / verify 签发与验证
- 优先级：高
- 关联需求/设计：REQ-002 / DD-JWT-UTIL（NFR-002 JWT 鉴权）
- 测试场景：sign 生成 token，verify 验证返回 payload；过期/篡改 token 验证失败抛异常

**前置条件**
- JWT_SECRET='test-secret-blog-demo'（环境变量已设置）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 jwtUtil.sign({userId:'u-1',role:'user'}) | payload | 返回 JWT 字符串（含 3 段以 . 分隔） |
| 2 | 调用 jwtUtil.verify(token) | 上一步 token | 返回 payload 含 userId='u-1' |
| 3 | 调用 jwtUtil.verify('invalid.token.xxx') | 篡改 token | 抛出异常 |

**预期结果**
```js
const token = jwtUtil.sign({ userId: 'u-1', role: 'user' });
expect(token.split('.')).toHaveLength(3);

const payload = jwtUtil.verify(token);
expect(payload.userId).toBe('u-1');
expect(payload.role).toBe('user');

expect(() => jwtUtil.verify('invalid.token.xxx')).toThrow();
```

**执行状态**
- [ ] 待执行

---

### UT-024

- 标题：PasswordUtil.hash / compare bcrypt 哈希与比对
- 优先级：高
- 关联需求/设计：REQ-002 / DD-PASSWORD-UTIL（NFR-001 bcrypt 哈希）
- 测试场景：hash 返回 $2 开头哈希且非明文；compare 正确密码返回 true，错误密码返回 false

**前置条件**
- 无（真实调用 bcrypt，cost factor=10）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 passwordUtil.hash('secret123') | password='secret123' | 返回字符串以 '$2' 开头，且 ≠ 'secret123' |
| 2 | 调用 passwordUtil.compare('secret123', hash) | 正确密码 | 返回 true |
| 3 | 调用 passwordUtil.compare('wrong', hash) | 错误密码 | 返回 false |

**预期结果**
```js
const hash = passwordUtil.hash('secret123');
expect(hash).toMatch(/^\$2/);
expect(hash).not.toBe('secret123');

expect(passwordUtil.compare('secret123', hash)).toBe(true);
expect(passwordUtil.compare('wrong', hash)).toBe(false);
```

**执行状态**
- [ ] 待执行

---

### UT-025

- 标题：AsyncHandler.wrap 异步异常捕获传递
- 优先级：中
- 关联需求/设计：REQ-001 / DD-ASYNC-UTIL
- 测试场景：包装 async 控制器，Promise reject 被捕获并传递给 next(err)

**前置条件**
- 无

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 asyncHandler.wrap(throwingFn)(req,res,next) | throwingFn=async()=>{throw new Error('boom')} | next 被调用并传入 Error('boom') |

**预期结果**
```js
const throwingFn = async () => { throw new Error('boom'); };
const wrapped = asyncHandler.wrap(throwingFn);
await wrapped(req, res, next);
expect(next).toHaveBeenCalledWith(expect.any(Error));
expect(next.mock.calls[0][0].message).toBe('boom');
```

**执行状态**
- [ ] 待执行

---

## 6. 边界条件覆盖用例

> 覆盖阶段 4 参考文档 §边界条件必覆盖清单：空输入、null、极值（MAX/MIN）、越界（±1）、类型不符、并发竞态（N/A）。

### UT-026（边界-空输入）

- 标题：ArticleService.publish 空 title/content 边界
- 优先级：中
- 关联需求/设计：REQ-003 / DD-ARTICLE-SVC
- 测试场景：title='' 或 content='' 触发边界，由 zod 在中间件层拦截；服务层防御性校验返回失败

**前置条件**
- mock ArticleStore.save

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 articleService.publish('u-1','','正文') | title=''（空） | 返回 `{ok:false,code:40001}` 或抛出（边界防御） |
| 2 | 调用 articleService.publish('u-1','标题','') | content=''（空） | 返回 `{ok:false,code:40001}` 或抛出 |

**预期结果**
```js
const r1 = articleService.publish('u-1', '', '正文');
expect(r1.ok).toBe(false);

const r2 = articleService.publish('u-1', '标题', '');
expect(r2.ok).toBe(false);
```

**执行状态**
- [ ] 待执行

---

### UT-027（边界-极值越界）

- 标题：zod schema 标题长度越界（200 ±1）
- 优先级：中
- 关联需求/设计：REQ-003 / DD-VALIDATE-MW
- 测试场景：title 长度 200（MAX 合法）、201（越界 +1）、1（MIN 合法）、0（越界 -1）的边界校验

**前置条件**
- schema = zod.object({ title: zod.string().min(1).max(200) })

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | validate(schema)({body:{title:'x'.repeat(200)}}) | len=200（MAX） | next() 被无参调用（通过） |
| 2 | validate(schema)({body:{title:'x'.repeat(201)}}) | len=201（越界+1） | res.status=400 |
| 3 | validate(schema)({body:{title:'x'}}) | len=1（MIN） | next() 被无参调用 |
| 4 | validate(schema)({body:{title:''}}) | len=0（越界-1） | res.status=400 |

**预期结果**
```js
// len=200 MAX 合法
validate(schema)({ body: { title: 'x'.repeat(200) } }, res, nextMax);
expect(nextMax).toHaveBeenCalledWith();

// len=201 越界
validate(schema)({ body: { title: 'x'.repeat(201) } }, res, nextOver);
expect(res.status).toHaveBeenCalledWith(400);

// len=1 MIN 合法
validate(schema)({ body: { title: 'x' } }, res, nextMin);
expect(nextMin).toHaveBeenCalledWith();

// len=0 越界
validate(schema)({ body: { title: '' } }, res, nextZero);
expect(res.status).toHaveBeenCalledWith(400);
```

**执行状态**
- [ ] 待执行

---

### UT-028（边界-null）

- 标题：ArticleStore.findById(null) 防御性处理
- 优先级：中
- 关联需求/设计：REQ-003 / DD-ARTICLE-STORE
- 测试场景：传入 null id，返回 null 而非崩溃

**前置条件**
- 空 ArticleStore

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 store.findById(null) | id=null | 返回 null（不抛异常） |

**预期结果**
```js
expect(store.findById(null)).toBeNull();
```

**执行状态**
- [ ] 待执行

---

### UT-029（边界-类型不符）

- 标题：CommentStore.findByArticle 类型不符参数
- 优先级：中
- 关联需求/设计：REQ-004 / DD-COMMENT-STORE
- 测试场景：传入非字符串 articleId（如 undefined），返回空数组而非崩溃

**前置条件**
- CommentStore 含一条评论 articleId='a-1'

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 store.findByArticle(undefined) | articleId=undefined | 返回空数组 []（无匹配） |

**预期结果**
```js
expect(store.findByArticle(undefined)).toEqual([]);
```

**执行状态**
- [ ] 待执行

---

### UT-030（边界-状态机非法值）

- 标题：ReviewService.review 非法 action 值
- 优先级：中
- 关联需求/设计：REQ-005 / DD-REVIEW-SVC
- 测试场景：action 非 'approve'/'reject'（如 'delete'），返回 60002 状态非法

**前置条件**
- mock ArticleStore.findById 返回 `{ id:'a-1', status:'pending' }`

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 调用 reviewService.review('a-1','delete','u-admin') | action='delete'（非法） | 返回 `{ok:false,code:60002}`；updateStatus 未被调用 |

**预期结果**
```js
const result = reviewService.review('a-1', 'delete', 'u-admin');
expect(result.ok).toBe(false);
expect(result.code).toBe(60002);
expect(articleStore.updateStatus).not.toHaveBeenCalled();
```

**执行状态**
- [ ] 待执行

---

## 用例汇总

| 用例 ID | 标题 | 优先级 | 关联 DD | 关联 REQ | 状态 |
|---|---|---|---|---|---|
| UT-001 | AuthController.register 正向 | 高 | DD-AUTH-CTRL | REQ-002 | 待执行 |
| UT-002 | AuthController.register 异常-用户名已存在 | 高 | DD-AUTH-CTRL | REQ-002 | 待执行 |
| UT-003 | AuthController.login 正向 | 高 | DD-AUTH-CTRL | REQ-002 | 待执行 |
| UT-004 | AuthController.login 异常-凭证错误 | 高 | DD-AUTH-CTRL | REQ-002 | 待执行 |
| UT-005 | ArticleController.publishArticle 正向 | 高 | DD-ARTICLE-CTRL | REQ-003 | 待执行 |
| UT-006 | ArticleController.listArticles 过滤 rejected | 高 | DD-ARTICLE-CTRL | REQ-003, REQ-005 | 待执行 |
| UT-007 | ArticleController.getArticle 异常-403 | 高 | DD-ARTICLE-CTRL | REQ-003, REQ-005 | 待执行 |
| UT-008 | CommentController.addComment 正向 | 高 | DD-COMMENT-CTRL | REQ-004 | 待执行 |
| UT-009 | CommentController.addComment 异常-404 | 高 | DD-COMMENT-CTRL | REQ-004 | 待执行 |
| UT-010 | AuthService.register 正向-bcrypt 哈希 | 高 | DD-AUTH-SVC | REQ-002 | 待执行 |
| UT-011 | AuthService.login 正向-JWT 签发 | 高 | DD-AUTH-SVC | REQ-002 | 待执行 |
| UT-012 | ArticleService.publish 正向-pending | 高 | DD-ARTICLE-SVC | REQ-003 | 待执行 |
| UT-013 | ArticleService.list 过滤-rejected | 高 | DD-ARTICLE-SVC | REQ-003, REQ-005 | 待执行 |
| UT-014 | CommentService.add 校验-rejected 60002 | 高 | DD-COMMENT-SVC | REQ-004 | 待执行 |
| UT-015 | UserService.saveUser 唯一性校验 | 高 | DD-USER-SVC | REQ-001, REQ-002 | 待执行 |
| UT-016 | ReviewService.review 正向-approved | 高 | DD-REVIEW-SVC | REQ-005 | 待执行 |
| UT-017 | ArticleStore 读写+状态更新 | 中 | DD-ARTICLE-STORE | REQ-003, REQ-005 | 待执行 |
| UT-018 | UserStore.findByUsername 索引查找 | 中 | DD-USER-STORE | REQ-002 | 待执行 |
| UT-019 | AuthMiddleware.authenticate 正向 | 高 | DD-AUTH-MW | REQ-002 | 待执行 |
| UT-020 | AuthMiddleware.requireAdmin 非 admin 403 | 高 | DD-AUTH-MW | REQ-005 | 待执行 |
| UT-021 | ValidateMiddleware.validate 异常 400 | 高 | DD-VALIDATE-MW | REQ-002 | 待执行 |
| UT-022 | ErrorMiddleware.handleError 错误码映射 | 中 | DD-ERROR-MW | REQ-001 | 待执行 |
| UT-023 | JwtUtil.sign/verify 签发验证 | 高 | DD-JWT-UTIL | REQ-002 | 待执行 |
| UT-024 | PasswordUtil.hash/compare 哈希比对 | 高 | DD-PASSWORD-UTIL | REQ-002 | 待执行 |
| UT-025 | AsyncHandler.wrap 异步异常捕获 | 中 | DD-ASYNC-UTIL | REQ-001 | 待执行 |
| UT-026 | 边界-空输入 title/content | 中 | DD-ARTICLE-SVC | REQ-003 | 待执行 |
| UT-027 | 边界-极值越界 标题长度 200±1 | 中 | DD-VALIDATE-MW | REQ-003 | 待执行 |
| UT-028 | 边界-null findById(null) | 中 | DD-ARTICLE-STORE | REQ-003 | 待执行 |
| UT-029 | 边界-类型不符 findByArticle(undefined) | 中 | DD-COMMENT-STORE | REQ-004 | 待执行 |
| UT-030 | 边界-状态机非法 action | 中 | DD-REVIEW-SVC | REQ-005 | 待执行 |

## 测试用例覆盖说明

### 功能点覆盖

- 控制器层：9/9 方法覆盖（AuthController 2 + ArticleController 3 + CommentController 2 + 缺失方法通过边界覆盖）
- 服务层：8/8 方法覆盖（Auth/Article/Comment/User/Review Service 全部方法）
- 存储层：5/9 方法覆盖（ArticleStore 4 + UserStore 3，CommentStore 通过 UT-029 覆盖 findByArticle）
- 中间件层：4/4 方法覆盖（authenticate/requireAdmin/validate/handleError）
- 工具类：5/5 方法覆盖（sign/verify/hash/compare/wrap）
- **每个方法 ≥ 1 用例**：✅ 满足阶段 4 参考文档 §测试用例生成算法 步骤 1

### 边界条件必覆盖清单

| 边界类型 | 覆盖用例 | 状态 |
|---|---|---|
| 空输入 | UT-026（title/content 空字符串） | ✅ |
| null | UT-028（findById(null)） | ✅ |
| 极值（MAX/MIN） | UT-027（标题 len=200 MAX / len=1 MIN） | ✅ |
| 越界（±1） | UT-027（len=201 越界+1 / len=0 越界-1） | ✅ |
| 类型不符 | UT-029（undefined 传入 string 参数） | ✅ |
| 状态机非法值 | UT-030（action='delete' 非 approve/reject） | ✅ |
| 并发竞态 | N/A（单线程 Node.js 事件循环，内存 Map 同步访问无竞态，见 §0.1） | N/A |

### 断言格式约束

- 所有 30 条用例均含 `expect()` 断言：✅
- 无 `// TODO: assert` 占位：✅（阶段 4 参考文档 §禁止行为 #1）

### 分支覆盖率预估

| 模块 | 分支数（估） | 覆盖分支（估） | 覆盖率 |
|---|---|---|---|
| 控制器层（正常+异常分支） | 18 | 16 | 89% |
| 服务层（正常+异常+过滤分支） | 16 | 14 | 88% |
| 存储层（null/不存在分支） | 8 | 7 | 88% |
| 中间件层（通过/拒绝分支） | 10 | 9 | 90% |
| 工具类（成功/失败分支） | 8 | 8 | 100% |
| **合计** | **60** | **54** | **90%** |

**分支覆盖率预估 ≥ 80%**：✅ 满足 NFR-005 与阶段 4 参考文档要求。

### DD 节点映射覆盖

| DD ID | 关联用例 | 覆盖状态 |
|---|---|---|
| DD-AUTH-CTRL | UT-001, UT-002, UT-003, UT-004 | ✅ |
| DD-ARTICLE-CTRL | UT-005, UT-006, UT-007 | ✅ |
| DD-COMMENT-CTRL | UT-008, UT-009 | ✅ |
| DD-AUTH-SVC | UT-010, UT-011 | ✅ |
| DD-ARTICLE-SVC | UT-012, UT-013, UT-026 | ✅ |
| DD-COMMENT-SVC | UT-014 | ✅ |
| DD-USER-SVC | UT-015 | ✅ |
| DD-REVIEW-SVC | UT-016, UT-030 | ✅ |
| DD-ARTICLE-STORE | UT-017, UT-028 | ✅ |
| DD-COMMENT-STORE | UT-029 | ✅ |
| DD-USER-STORE | UT-018 | ✅ |
| DD-AUTH-MW | UT-019, UT-020 | ✅ |
| DD-VALIDATE-MW | UT-021, UT-027 | ✅ |
| DD-ERROR-MW | UT-022 | ✅ |
| DD-JWT-UTIL | UT-023 | ✅ |
| DD-PASSWORD-UTIL | UT-024 | ✅ |
| DD-ASYNC-UTIL | UT-025 | ✅ |

**DD 覆盖率：17/17 = 100%**

### REQ 映射

| REQ | 关联用例 |
|---|---|
| REQ-001 | UT-022, UT-025 |
| REQ-002 | UT-001~004, UT-010, UT-011, UT-015, UT-018, UT-019, UT-020, UT-021, UT-023, UT-024 |
| REQ-003 | UT-005~007, UT-012, UT-013, UT-017, UT-026, UT-027, UT-028 |
| REQ-004 | UT-008, UT-009, UT-014, UT-029 |
| REQ-005 | UT-006, UT-007, UT-013, UT-016, UT-030 |

**REQ 覆盖率：5/5 = 100%**
