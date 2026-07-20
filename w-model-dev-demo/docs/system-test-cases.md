# 测试用例文档

> 阶段 2 设计、阶段 7 执行。系统测试用例。

## 文档信息

- 项目名称：博客系统（blog-system-demo）
- 测试类型：系统测试
- 设计来源阶段：阶段 2（系统设计）
- 执行阶段：阶段 7（系统测试）
- 文档版本：v1.0

## 用例列表

### ST-001

- 标题：注册→登录→创建文章→浏览 全链路
- 优先级：高
- 关联模块：M-001 / M-002
- 测试场景：覆盖完整业务闭环，验证各模块协作无断层

**前置条件**
- 服务已启动，监听 3000 端口
- 内存存储已清空

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/auth/register | `{"username":"alice","password":"Passw0rd!"}` | 201 + userId |
| 2 | POST /api/auth/login | `{"username":"alice","password":"Passw0rd!"}` | 200 + token |
| 3 | POST /api/articles | Header: Bearer + `{"title":"Hello","content":"World"}` | 201 + articleId |
| 4 | GET /api/articles | （无 Authorization） | 200 + 数组长度 1 |
| 5 | GET /api/articles/:articleId | （无 Authorization） | 200 + 完整文章 |

**预期结果**
全链路通畅，最终 GET 详情返回的 `authorId` 与第 1 步的 `userId` 一致。

**执行状态**
- [x] 待执行

---

### ST-002

- 标题：作者隔离端到端验证
- 优先级：高
- 关联模块：M-002
- 测试场景：A 创建文章，B 尝试 PUT/DELETE 该文章应被 403 拒绝

**前置条件**
- 用户 alice、bob 均已注册并登录

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/articles (alice) | Bearer alice + `{"title":"A1",...}` | 201 + articleId=A1 |
| 2 | PUT /api/articles/A1 (bob) | Bearer bob + `{"title":"Hacked"}` | 403 |
| 3 | DELETE /api/articles/A1 (bob) | Bearer bob | 403 |
| 4 | GET /api/articles/A1 | — | 200 + 标题仍为 A1 |

**预期结果**
B 的写操作全部被 403 拒绝，文章内容未被篡改。

**执行状态**
- [x] 待执行

---

### ST-003

- 标题：删除文章后评论不可再创建
- 优先级：中
- 关联模块：M-002 + M-003
- 测试场景：删除文章后对该文章 POST 评论应返回 404

**前置条件**
- 文章 A1 存在；用户 alice 持 JWT

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | DELETE /api/articles/A1 (alice) | Bearer alice | 204 |
| 2 | POST /api/articles/A1/comments (alice) | Bearer alice + `{"content":"Hi"}` | 404 |

**预期结果**
评论创建被拒，不存在孤儿评论。

**执行状态**
- [x] 待执行

---

### ST-004

- 标题：JWT 过期后访问受保护接口被拒
- 优先级：中
- 关联模块：M-001
- 测试场景：使用过期 JWT 访问 POST /api/articles 应返回 401

**前置条件**
- 测试用代码构造一个 exp = now - 1s 的 JWT（用同一密钥签发）

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/articles | Bearer <expired JWT> + `{"title":"X","content":"Y"}` | 401 |

**预期结果**
过期 token 被拒绝。

**执行状态**
- [x] 待执行

---

### ST-005

- 标题：输入校验返回 400
- 优先级：高
- 关联模块：M-004
- 测试场景：缺字段 / 字段类型错误触发 zod 校验失败 → 400

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/auth/register | `{"username":"a"}`（缺 password） | 400 + error 含 zod 信息 |
| 2 | POST /api/articles | Bearer + `{"title":123,"content":"x"}`（title 类型错） | 400 |
| 3 | POST /api/articles/A1/comments | Bearer + `{}`（缺 content） | 400 |

**预期结果**
所有非法输入均返回 400，不写入任何数据。

**执行状态**
- [x] 待执行

---

### ST-006

- 标题：并发创建文章产生不同 articleId
- 优先级：中
- 关联模块：M-002
- 测试场景：同一用户并发发起 2 个 POST /api/articles，2 个返回的 articleId 应不同

**前置条件**
- 用户 alice 持 JWT

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 并发 POST /api/articles ×2 | Bearer + 两个不同的 body | 两个不同的 articleId |
| 2 | GET /api/articles | — | 200 + 数组长度 ≥ 2 |

**预期结果**
两次创建得到不同 ID，列表可见两篇文章。

**执行状态**
- [x] 待执行

---

## 用例汇总

| 用例 ID | 标题 | 优先级 | 关联 | 状态 |
|---|---|---|---|---|
| ST-001 | 全链路 | 高 | M-001/M-002 | 待执行 |
| ST-002 | 作者隔离 | 高 | M-002 | 待执行 |
| ST-003 | 删除后评论不可创建 | 中 | M-002/M-003 | 待执行 |
| ST-004 | JWT 过期被拒 | 中 | M-001 | 待执行 |
| ST-005 | 输入校验 400 | 高 | M-004 | 待执行 |
| ST-006 | 并发创建不同 ID | 中 | M-002 | 待执行 |

## 测试用例覆盖说明

- 模块覆盖：4/4（M-001/M-002/M-003/M-004 均覆盖）
- 跨模块场景：3 个（ST-001 / ST-003 / ST-005 跨多模块）
- 异常路径：401（ST-004）/ 403（ST-002）/ 404（ST-003）/ 400（ST-005）全覆盖
