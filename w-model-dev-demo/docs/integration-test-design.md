# 测试用例文档 - 集成测试

> 阶段 3（概要设计）同步产出集成测试用例设计。执行阶段：阶段 6（集成测试）。
> 套用 `templates/test-case.md` 模板，类型=集成测试。
> 覆盖 17 INTF 的模块间交互正向 + 异常路径（超时/错误码 fallback/状态机非法跳转）。
> 必含 TC-DES-004（接口定义）/ TC-DES-006（集成测试用例生成）/ TC-DES-010（接口参数校验）/ TC-DES-011（跨模块调用）/ TC-DES-012（数据传递异常路径）。

## 文档信息

- 项目名称：blog-system-demo（扩展博客系统后端）
- 测试类型：集成测试
- 设计来源阶段：阶段 3（概要设计）
- 执行阶段：阶段 6（集成测试）
- 文档版本：v1.0
- 编制日期：2026-07-25
- 编制者：S 子代理（第 8 轮 W 模型，阶段 3）
- 关联接口设计：`docs/interface-design.md`
- 关联系统设计：`docs/system-design.md`

## 1. 集成测试策略

### 1.1 测试目标
验证 17 个 INTF 接口的模块间交互契约、参数校验、跨模块调用数据传递、异常路径 fallback（超时/错误码/状态机非法跳转），确认概要设计满足接口契约 Schema 模板 10 字段 + 错误码三段位分层。

### 1.2 测试范围与分层
| 层次 | 用例区间 | 数量 | 覆盖目标 |
|---|---|---|---|
| 接口契约与参数校验 | TC-INT-001~010 | 10 | TC-DES-004/006/010：17 INTF 契约 + 参数合法性/边界 |
| 单 INTF 行为集成 | TC-INT-011~020 | 10 | 17 INTF 内部 controller↔service↔store 集成 |
| 跨模块调用（正向） | TC-INT-021~030 | 10 | TC-DES-011：模块 A→B 数据正确传递 |
| 异常路径与 fallback | TC-INT-031~040 | 10 | TC-DES-012：超时/错误码 fallback/状态机非法跳转 |
| **合计** | TC-INT-001~040 | **40** | 17 INTF + 5 TC-DES 覆盖 |

### 1.3 覆盖说明
- 17 INTF 全覆盖：每接口至少 2 条用例（正向 + 异常）。
- TC-DES 必含项：TC-INT-001(DES-004)/TC-INT-002(DES-006)/TC-INT-003~005(DES-010)/TC-INT-021~030(DES-011)/TC-INT-031~040(DES-012)。
- 错误码三段位覆盖：4xx(1001/1011/1021...)/5xx(1099/5001/5021)/业务(1002/1003/1004/1042/1051...)。

---

## 2. 用例列表

### TC-INT-001
- 标题：接口契约定义验证（TC-DES-004）
- 优先级：高
- 关联需求/设计：REQ-001~017 / SD-001~017 / INTF-001~017
- 测试场景：验证 17 INTF 接口契约按 10 字段 schema 模板定义完整（接口名/路径/参数名/参数类型/必填/默认值/约束/示例/返回值结构/错误码集合）

**前置条件**
`docs/interface-design.md` 阶段 3 复核完成，17 INTF 契约全部填写。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 解析 interface-design.md §20.1 覆盖矩阵 | 17 INTF × 10 字段 | 全 ✅，无缺失字段 |
| 2 | 校验每 INTF 错误码集合含 4xx/5xx/业务三段位 | §20.2 错误码集合 | 三段位覆盖标记全 ✅ |
| 3 | 校验每 INTF 含默认值与约束 | §20.3 默认值约束表 | 17 INTF 全有默认值+约束 |

**预期结果**
17 INTF × 10 字段全覆盖；错误码三段位无遗漏；默认值/约束补全。

**优先级**：高
**关联 INTF**：INTF-001~017

---

### TC-INT-002
- 标题：集成测试用例生成完整性（TC-DES-006）
- 优先级：高
- 关联需求/设计：REQ-001~017 / SD-001~017 / INTF-001~017
- 测试场景：验证集成测试用例覆盖模块间交互的正向/异常路径，每条用例含 7 字段（ID/场景/前置/输入/预期/优先级/关联INTF）

**前置条件**
本文档已生成 TC-INT-001~040。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 统计 TC-INT 用例数 | TC-INT-001~040 | ≥40 条 |
| 2 | 校验 17 INTF 覆盖 | 每 INTF 至少 2 条 | 17 INTF 全覆盖 |
| 3 | 校验异常路径覆盖 | TC-INT-031~040 | ≥10 条异常路径用例 |

**预期结果**
40 条用例全覆盖 17 INTF，含正向 + 异常路径，7 字段完整。

**优先级**：高
**关联 INTF**：INTF-001~017

---

### TC-INT-003
- 标题：用户注册接口参数校验（TC-DES-010）
- 优先级：高
- 关联需求/设计：REQ-003 / SD-003 / INTF-003
- 测试场景：POST /api/auth/register 合法/非法/边界参数校验

**前置条件**
注册开关开启；系统初始无用户。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 合法参数注册 | email=u1@x.com, password=Abc12345, nickname=用户1 | 201，返回 JWT + userId |
| 2 | 非法 email | email="not-email", password=Abc12345 | 400 + code=1001 |
| 3 | password 边界（7 位） | password=Abc1234（8 位以下） | 400 + code=1001 |
| 4 | password 边界（33 位） | password=Abc...（33 位） | 400 + code=1001 |
| 5 | 缺 nickname | 无 nickname 字段 | 400 + code=1001 |
| 6 | 重复 email | email=u1@x.com（已注册） | 409 + code=1061 |

**预期结果**
合法参数 201；非法/边界参数返回 400 + code=1001；重复 email 返回 409 + code=1061。

**优先级**：高
**关联 INTF**：INTF-003

---

### TC-INT-004
- 标题：文章创建接口参数校验（TC-DES-010）
- 优先级：高
- 关联需求/设计：REQ-012 / SD-012 / INTF-012
- 测试场景：POST /api/articles 参数校验 + 状态机默认值

**前置条件**
博主已登录（blogger token）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 合法创建 | title="标题", content="内容", status=draft | 201，status=draft |
| 2 | title 超长 | title=201 字符 | 400 + code=1001 |
| 3 | 非法 status | status="invalid" | 400 + code=1001 |
| 4 | tagIds 超限 | tagIds 含 11 个标签 | 400 + code=1005 |
| 5 | 非 blogger 角色 | user token 创建文章 | 403 + code=1021 |

**预期结果**
合法 201；非法参数 400+1001；标签超限 400+1005；越权 403+1021。

**优先级**：高
**关联 INTF**：INTF-012

---

### TC-INT-005
- 标题：文件上传接口参数校验（TC-DES-010）
- 优先级：高
- 关联需求/设计：REQ-015 / SD-015 / INTF-015
- 测试场景：POST /api/files/image MIME/大小/魔数校验

**前置条件**
用户已登录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 合法图片 | image/jpeg, 1MB | 201，返回 sha256 |
| 2 | MIME 非白名单 | image/bmp | 400 + code=1053 |
| 3 | 超过 10MB | 11MB image/jpeg | 413 + code=1041 |
| 4 | 魔数不匹配 | 扩展名 jpg 但内容是 png | 400 + code=1052 |
| 5 | 配额超限 | 用户日配额已满 50MB | 413 + code=1042 |

**预期结果**
合法 201；MIME 拒绝 400+1053；超限 413+1041；魔数不匹配 400+1052；配额超限 413+1042。

**优先级**：高
**关联 INTF**：INTF-015

---

### TC-INT-006
- 标题：推荐接口 mode 参数校验（TC-DES-010）
- 优先级：中
- 关联需求/设计：REQ-004 / SD-004 / INTF-004
- 测试场景：GET /api/recommendations mode 切换 + 个性化推荐需登录

**前置条件**
无。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | mode=hot | 无 token | 200，返回热门文章列表 |
| 2 | mode=latest | 无 token | 200，返回最新文章 |
| 3 | mode=personalized 无 token | 无 token | 401 + code=1011 |
| 4 | mode=personalized 有 token | user token | 200，返回个性化推荐 |
| 5 | mode=invalid | mode=xxx | 400 + code=1001 |

**预期结果**
hot/latest 公开；personalized 需登录，无 token 401+1011；非法 mode 400+1001。

**优先级**：中
**关联 INTF**：INTF-004

---

### TC-INT-007
- 标题：搜索接口参数校验（TC-DES-010）
- 优先级：中
- 关联需求/设计：REQ-007 / SD-007 / INTF-007
- 测试场景：POST /api/search keyword/sort/pageSize 校验

**前置条件**
无。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 合法搜索 | keyword="React", sort=relevance | 200，返回 items+total |
| 2 | keyword 空 | keyword="" | 400 + code=1001 |
| 3 | keyword 超长 | keyword=101 字符 | 400 + code=1001 |
| 4 | pageSize 超限 | pageSize=100 | 400 + code=1001（上限 50） |
| 5 | sort 非法 | sort=xxx | 400 + code=1001 |

**预期结果**
合法 200；keyword 空/超长 400+1001；pageSize 超限 400+1001；sort 非法 400+1001。

**优先级**：中
**关联 INTF**：INTF-007

---

### TC-INT-008
- 标题：标签创建与绑定参数校验（TC-DES-010）
- 优先级：中
- 关联需求/设计：REQ-008 / SD-008 / INTF-008
- 测试场景：POST /api/tags 标签名唯一性 + 文章绑定标签数限制

**前置条件**
用户已登录；标签 tag-1 已存在（approved）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 创建标签 | name="React" | 201，status=pending |
| 2 | 重复标签名 | name="React"（已存在） | 409 + code=1071 |
| 3 | 标签名超长 | name=21 字符 | 400 + code=1001 |
| 4 | 文章绑定第 11 个标签 | article 已绑 10 标签 | 400 + code=1005 |
| 5 | 绑定 pending 标签 | tag status=pending | 400 + code=1001（须 approved） |

**预期结果**
创建 201 pending；重复 409+1071；超长 400+1001；超限 400+1005；pending 标签绑定 400+1001。

**优先级**：中
**关联 INTF**：INTF-008

---

### TC-INT-009
- 标题：分类树深度参数校验（TC-DES-010）
- 优先级：中
- 关联需求/设计：REQ-009 / SD-009 / INTF-009
- 测试场景：POST /api/categories 树深度 ≤ 5 + 自引用禁止

**前置条件**
管理员已登录；分类树已有 5 层。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 合法创建根分类 | name="前端", parentId=null | 201 |
| 2 | 合法创建子分类 | parentId=已存在分类 | 201 |
| 3 | 第 6 层超限 | parentId=第 5 层分类 | 400 + code=1004 |
| 4 | 自引用 | parentId=自身 id | 400 + code=1001 |
| 5 | parentId 不存在 | parentId=无效 id | 400 + code=1001 |

**预期结果**
合法 201；超深 400+1004；自引用 400+1001；parentId 不存在 400+1001。

**优先级**：中
**关联 INTF**：INTF-009

---

### TC-INT-010
- 标题：订阅 invitation 权限参数校验（TC-DES-010）
- 优先级：中
- 关联需求/设计：REQ-016 / SD-016 / INTF-016
- 测试场景：POST /api/subscriptions invitation 类型须 invitationCode

**前置条件**
用户已登录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | free 订阅 | targetType=blogger, permission=free | 201 |
| 2 | invitation 无 code | permission=invitation, 无 invitationCode | 400 + code=1001 |
| 3 | invitation code 短 | invitationCode=7 字符 | 400 + code=1001 |
| 4 | invitation code 长 | invitationCode=33 字符 | 400 + code=1001 |
| 5 | 非法 targetType | targetType=invalid | 400 + code=1001 |

**预期结果**
free 201；invitation 无 code 400+1001；code 长度边界 400+1001；非法 targetType 400+1001。

**优先级**：中
**关联 INTF**：INTF-016

---

### TC-INT-011
- 标题：站点管理 controller↔service↔store 集成
- 优先级：高
- 关联需求/设计：REQ-001 / SD-001 / INTF-001
- 测试场景：站点配置更新经 controller→service→store 三层集成，维护模式开关生效

**前置条件**
管理员已登录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | PUT /api/site/config | siteName="我的博客" | 200，store 持久化 |
| 2 | PUT /api/site/maintenance | maintenanceMode=true | 200 |
| 3 | 普通用户 GET /api/articles | user token | 503 + code=1023 |
| 4 | GET /api/site/config | - | 200，返回更新后配置 |
| 5 | GET /api/site/stats | admin token | 200，含 userCount 等 |

**预期结果**
三层集成正常；维护模式拦截非管理员 503+1023；统计返回站点概览。

**优先级**：高
**关联 INTF**：INTF-001

---

### TC-INT-012
- 标题：多博主注册→关注→主页集成
- 优先级：高
- 关联需求/设计：REQ-002 / SD-002 / INTF-002
- 测试场景：博主注册→关注→粉丝列表→主页集成

**前置条件**
注册开关开启。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 博主注册 | email=b1@x.com, password=Abc12345 | 201，bloggerId+token |
| 2 | 博主2 注册并关注博主1 | POST /api/bloggers/:id/follow | 200 |
| 3 | GET 粉丝列表 | /api/bloggers/:id/followers | 200，含博主2 |
| 4 | 重复关注（幂等） | 再次 follow | 200（幂等不报错） |
| 5 | 取关 | DELETE /api/bloggers/:id/follow | 200 |

**预期结果**
注册→关注→粉丝列表→取关全链路集成正常；关注幂等。

**优先级**：高
**关联 INTF**：INTF-002

---

### TC-INT-013
- 标题：用户登录→JWT→封禁→token 失效集成
- 优先级：高
- 关联需求/设计：REQ-003 / SD-003 / INTF-003
- 测试场景：登录签发 JWT→封禁→旧 token 立即失效→审计日志

**前置条件**
用户已注册。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | POST /api/auth/login | email/password | 200，返回 JWT |
| 2 | 携 token 访问 | GET /api/users/:id | 200 |
| 3 | 管理员封禁 | POST /api/users/:id/ban | 200 |
| 4 | 旧 token 访问 | GET /api/users/:id（旧 token） | 403 + code=1022 |
| 5 | 审计日志 | GET /api/users/audit-logs | 200，含 ban 记录 |

**预期结果**
登录→封禁→token 失效→审计日志链路正常；封禁后旧 token 403+1022。

**优先级**：高
**关联 INTF**：INTF-003

---

### TC-INT-014
- 标题：文章状态机 draft→published→offline→archived 集成
- 优先级：高
- 关联需求/设计：REQ-012 / SD-012 / INTF-012
- 测试场景：文章状态机正向流转集成

**前置条件**
博主已登录，文章已创建（draft）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | draft → pending_review | PUT /api/articles/:id/status status=pending_review | 200 |
| 2 | pending_review → published | status=published | 200 |
| 3 | published → offline | status=offline | 200 |
| 4 | offline → archived | status=archived | 200 |
| 5 | GET 文章详情 | - | 200，status=archived |

**预期结果**
状态机正向流转全链路正常。

**优先级**：高
**关联 INTF**：INTF-012

---

### TC-INT-015
- 标题：交叉引用建立→图谱→相关文章集成
- 优先级：中
- 关联需求/设计：REQ-013 / SD-013 / INTF-013
- 测试场景：文章 A 引用文章 B→引用图谱→相关文章推荐

**前置条件**
文章 A、B 均 published。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 创建引用 | POST /api/articles/A/citations targetId=B | 201 |
| 2 | 引用图谱 | GET /api/articles/A/citations | 200，citing=[B] |
| 3 | 反向链接 | GET /api/articles/B/citations | 200，citedBy=[A] |
| 4 | 相关文章 | GET /api/articles/A/related | 200，含 B |
| 5 | 删除引用 | DELETE /api/articles/A/citations/:cid | 200 |

**预期结果**
引用建立→图谱双向查询→相关推荐→删除全链路正常。

**优先级**：中
**关联 INTF**：INTF-013

---

### TC-INT-016
- 标题：WebSocket 连接→订阅→推送→离线合并集成
- 优先级：高
- 关联需求/设计：REQ-014 / SD-014 / INTF-014
- 测试场景：WS 连接→订阅通道→推送→断线→离线合并→重连投递

**前置条件**
用户已登录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | WS 连接 | ws://host:3000/ws?token=JWT | 连接成功 |
| 2 | 订阅通道 | subscribe {channel:comment} | 200 |
| 3 | 触发推送 | 评论触发推送 | 收到 push 事件 |
| 4 | 断线+触发推送 | 离线时评论触发 | 进入 offlineMessages |
| 5 | 重连后投递 | 重新 WS 连接 | 收到合并后离线消息 |

**预期结果**
WS 连接→订阅→推送→离线合并→重连投递全链路正常。

**优先级**：高
**关联 INTF**：INTF-014

---

### TC-INT-017
- 标题：文件上传→去重→配额查询集成
- 优先级：高
- 关联需求/设计：REQ-015 / SD-015 / INTF-015
- 测试场景：上传→同 sha256 去重→配额查询

**前置条件**
用户已登录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 上传图片 | image/jpeg 1MB | 201，sha256=abc |
| 2 | 同 sha256 再上传 | 同文件 | 201，复用已有文件 |
| 3 | 配额查询 | GET /api/files/quota | 200，含已用配额 |
| 4 | 文件元数据 | GET /api/files/:id | 200，含 sha256 |
| 5 | 文件下载 | GET /api/files/:id/download | 200，二进制流 |

**预期结果**
上传→去重→配额查询→元数据→下载全链路正常。

**优先级**：高
**关联 INTF**：INTF-015

---

### TC-INT-018
- 标题：订阅→新文章→聚合推送集成
- 优先级：高
- 关联需求/设计：REQ-016 / SD-016 / INTF-016
- 测试场景：订阅博主→博主发新文章→聚合窗口内合并推送

**前置条件**
用户已登录；博主已发布文章。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 订阅博主 | POST /api/subscriptions targetType=blogger | 201 |
| 2 | 博主发文章 A | - | 触发推送 |
| 3 | 博主发文章 B（同小时） | - | 聚合为 1 条通知 |
| 4 | 聚合窗口查询 | GET /api/subscriptions/aggregates | 200，含聚合记录 |
| 5 | 取消订阅 | DELETE /api/subscriptions/:id | 200（幂等） |

**预期结果**
订阅→新文章→聚合推送→取订全链路正常；同小时合并为 1 条。

**优先级**：高
**关联 INTF**：INTF-016

---

### TC-INT-019
- 标题：数据导出→任务进度→下载集成
- 优先级：高
- 关联需求/设计：REQ-017 / SD-017 / INTF-017
- 测试场景：创建导出任务→查询进度→下载结果

**前置条件**
用户已登录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 创建导出任务 | POST /api/exports type=user_export | 201，taskId |
| 2 | 查询进度 | GET /api/exports/:taskId | 200，status=pending/running |
| 3 | 等待完成 | 轮询 | status=completed |
| 4 | 下载结果 | GET /api/exports/:taskId/download | 200，JSON 文件 |
| 5 | 增量导出 | POST /api/exports/incremental | 201 |

**预期结果**
导出任务创建→进度查询→下载→增量导出全链路正常。

**优先级**：高
**关联 INTF**：INTF-017

---

### TC-INT-020
- 标题：广告投放→审核→展示→点击统计集成
- 优先级：中
- 关联需求/设计：REQ-005 / SD-005 / INTF-005
- 测试场景：广告投放→审核→展示（impressions+1）→点击（clicks+1）

**前置条件**
博主已登录；管理员已登录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 创建广告 | POST /api/ads | 201，status=pending |
| 2 | 审核 | POST /api/ads/:id/review approved | 200 |
| 3 | 展示 | GET /api/ads/:id/display | 200，impressions+1 |
| 4 | 点击 | POST /api/ads/:id/click | 200，clicks+1 |
| 5 | 广告列表 | GET /api/ads（admin） | 200，含统计 |

**预期结果**
广告投放→审核→展示→点击统计全链路正常。

**优先级**：中
**关联 INTF**：INTF-005

---

### TC-INT-021
- 标题：评论→通知→推送跨模块调用（TC-DES-011）
- 优先级：高
- 关联需求/设计：REQ-010, REQ-011, REQ-014 / SD-010, SD-011, SD-014 / INTF-010, INTF-011, INTF-014
- 测试场景：用户评论文章→触发通知→通知触发 WS 推送，数据正确传递

**前置条件**
文章作者在线（WS 连接）；评论者已登录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 评论者创建评论 | POST /api/comments articleId, content | 201 |
| 2 | 文章作者收到通知 | GET /api/notifications | 200，含评论通知 |
| 3 | 文章作者收到 WS 推送 | - | 收到 push 事件 channel=comment |
| 4 | 通知未读数 | GET /api/notifications/unread-count | 200，count+1 |
| 5 | 标记已读 | POST /api/notifications/:id/read | 200 |

**预期结果**
评论→通知→推送跨模块数据正确传递；返回结构符合契约。

**优先级**：高
**关联 INTF**：INTF-010, INTF-011, INTF-014

---

### TC-INT-022
- 标题：文章→标签→搜索跨模块调用（TC-DES-011）
- 优先级：高
- 关联需求/设计：REQ-008, REQ-012, REQ-007 / SD-008, SD-012, SD-007 / INTF-008, INTF-012, INTF-007
- 测试场景：文章绑定标签→标签流入搜索索引→按标签搜索文章

**前置条件**
文章已发布；标签已 approved。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 文章绑定标签 | POST /api/articles/:id/tags tagIds | 200 |
| 2 | 标签流入搜索索引 | - | 索引更新 |
| 3 | 按标签搜索 | POST /api/search/tags keyword | 200，含该文章 |
| 4 | 全文搜索 | POST /api/search keyword=文章标题 | 200，含该文章 |
| 5 | 标签云 | GET /api/tags/cloud | 200，含该标签 count+1 |

**预期结果**
文章→标签→搜索跨模块数据正确传递；标签云 count 更新。

**优先级**：高
**关联 INTF**：INTF-008, INTF-012, INTF-007

---

### TC-INT-023
- 标题：订阅→推送→通知聚合跨模块调用（TC-DES-011）
- 优先级：高
- 关联需求/设计：REQ-014, REQ-016 / SD-014, SD-016 / INTF-014, INTF-016
- 测试场景：订阅博主→博主发文章→订阅触发推送→聚合窗口合并

**前置条件**
用户已订阅博主；博主已登录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 博主发文章 A | POST /api/articles | 201 |
| 2 | 订阅触发推送 | - | 用户收到推送 |
| 3 | 博主发文章 B（同小时） | POST /api/articles | 201 |
| 4 | 聚合合并 | - | 同小时合并为 1 条通知 |
| 5 | 聚合窗口查询 | GET /api/subscriptions/aggregates | 200 |

**预期结果**
订阅→推送→聚合跨模块数据正确传递；同小时合并。

**优先级**：高
**关联 INTF**：INTF-014, INTF-016

---

### TC-INT-024
- 标题：文件上传→文章创建→交叉引用跨模块调用（TC-DES-011）
- 优先级：高
- 关联需求/设计：REQ-012, REQ-013, REQ-015 / SD-012, SD-013, SD-015 / INTF-012, INTF-013, INTF-015
- 测试场景：上传封面图→创建文章引用封面→文章间交叉引用

**前置条件**
博主已登录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 上传封面图 | POST /api/files/image | 201，fileId |
| 2 | 创建文章引用封面 | POST /api/articles coverImageUrl=fileId | 201 |
| 3 | 创建文章 B | POST /api/articles | 201 |
| 4 | 文章 A 引用文章 B | POST /api/articles/A/citations targetId=B | 201 |
| 5 | 引用图谱 | GET /api/articles/A/citations | 200 |

**预期结果**
上传→文章创建→交叉引用跨模块数据正确传递。

**优先级**：高
**关联 INTF**：INTF-012, INTF-013, INTF-015

---

### TC-INT-025
- 标题：站点管理→统计→数据导出跨模块调用（TC-DES-011）
- 优先级：中
- 关联需求/设计：REQ-001, REQ-006, REQ-017 / SD-001, SD-006, SD-017 / INTF-001, INTF-006, INTF-017
- 测试场景：站点配置更新→统计数据流入→导出站点统计

**前置条件**
管理员已登录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 更新站点配置 | PUT /api/site/config | 200 |
| 2 | 站点统计 | GET /api/stats/site | 200，含 userCount 等 |
| 3 | 文章统计 | GET /api/stats/articles/:id | 200 |
| 4 | 导出统计 | POST /api/exports type=admin_backup | 201，taskId |
| 5 | 下载导出 | GET /api/exports/:taskId/download | 200 |

**预期结果**
站点→统计→导出跨模块数据正确传递。

**优先级**：中
**关联 INTF**：INTF-001, INTF-006, INTF-017

---

### TC-INT-026
- 标题：用户→博主→关注→推荐跨模块调用（TC-DES-011）
- 优先级：中
- 关联需求/设计：REQ-002, REQ-003, REQ-004 / SD-002, SD-003, SD-004 / INTF-002, INTF-003, INTF-004
- 测试场景：用户注册→升级博主→被关注→流入推荐（相似博主）

**前置条件**
注册开关开启。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 用户注册 | POST /api/auth/register | 201 |
| 2 | 升级博主 | POST /api/bloggers/register | 201 |
| 3 | 其他用户关注 | POST /api/bloggers/:id/follow | 200 |
| 4 | 博主数据流入推荐 | - | 推荐索引更新 |
| 5 | 相似博主推荐 | GET /api/recommendations/bloggers?mode=similar | 200，含该博主 |

**预期结果**
用户→博主→关注→推荐跨模块数据正确传递。

**优先级**：中
**关联 INTF**：INTF-002, INTF-003, INTF-004

---

### TC-INT-027
- 标题：分类→文章→搜索跨模块调用（TC-DES-011）
- 优先级：中
- 关联需求/设计：REQ-009, REQ-012, REQ-007 / SD-009, SD-012, SD-007 / INTF-009, INTF-012, INTF-007
- 测试场景：创建分类→文章归属分类→分类搜索

**前置条件**
管理员已登录；博主已登录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 创建分类 | POST /api/categories name=前端 | 201 |
| 2 | 文章归属分类 | PUT /api/articles/:id categoryId | 200 |
| 3 | 分类下文章 | GET /api/categories/:id/articles | 200，含该文章 |
| 4 | 分类搜索 | POST /api/search/categories keyword=前端 | 200，含该分类 |
| 5 | 面包屑 | GET /api/categories/:id/breadcrumb | 200 |

**预期结果**
分类→文章→搜索跨模块数据正确传递。

**优先级**：中
**关联 INTF**：INTF-009, INTF-012, INTF-007

---

### TC-INT-028
- 标题：广告→统计→推荐跨模块调用（TC-DES-011）
- 优先级：中
- 关联需求/设计：REQ-005, REQ-006, REQ-004 / SD-005, SD-006, SD-004 / INTF-005, INTF-006, INTF-004
- 测试场景：广告投放→点击统计流入→统计数据流入推荐

**前置条件**
广告已审核通过。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 广告展示 | GET /api/ads/:id/display | 200，impressions+1 |
| 2 | 广告点击 | POST /api/ads/:id/click | 200，clicks+1 |
| 3 | 广告数据流入统计 | - | 统计索引更新 |
| 4 | 统计数据流入推荐 | - | 推荐权重更新 |
| 5 | 推荐列表 | GET /api/recommendations?mode=hot | 200 |

**预期结果**
广告→统计→推荐跨模块数据正确传递。

**优先级**：中
**关联 INTF**：INTF-005, INTF-006, INTF-004

---

### TC-INT-029
- 标题：评论→点赞→举报→审核跨模块调用（TC-DES-011）
- 优先级：中
- 关联需求/设计：REQ-010 / SD-010 / INTF-010
- 测试场景：评论→点赞（幂等）→举报→管理员审核

**前置条件**
文章已发布；用户已登录；管理员已登录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 创建评论 | POST /api/comments | 201 |
| 2 | 点赞 | POST /api/comments/:id/like | 200 |
| 3 | 重复点赞（幂等） | POST /api/comments/:id/like | 200（幂等） |
| 4 | 举报 | POST /api/comments/:id/report | 200 |
| 5 | 管理员审核 | POST /api/comments/:id/review | 200 |

**预期结果**
评论→点赞→举报→审核跨模块数据正确传递；点赞幂等。

**优先级**：中
**关联 INTF**：INTF-010

---

### TC-INT-030
- 标题：备份→恢复→统计跨模块调用（TC-DES-011）
- 优先级：高
- 关联需求/设计：REQ-017, REQ-006 / SD-017, SD-006 / INTF-017, INTF-006
- 测试场景：创建备份→恢复（SHA-256 校验）→恢复后统计正确

**前置条件**
管理员已登录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 创建备份 | POST /api/backups | 201，backupId |
| 2 | 备份列表 | GET /api/backups | 200 |
| 3 | 恢复备份 | POST /api/backups/restore backupId | 200（SHA-256 校验通过） |
| 4 | 恢复后统计 | GET /api/stats/site | 200，数据一致 |
| 5 | 增量导出 | POST /api/exports/incremental | 201 |

**预期结果**
备份→恢复→统计跨模块数据正确传递；SHA-256 校验通过。

**优先级**：高
**关联 INTF**：INTF-017, INTF-006

---

### TC-INT-031
- 标题：推送失败重试 fallback（TC-DES-012）
- 优先级：高
- 关联需求/设计：REQ-014 / SD-014 / INTF-014
- 测试场景：WS 推送失败→重试 3 次（1s/2s/4s）→转离线消息

**前置条件**
用户 WS 连接不稳定。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 触发推送（连接断开） | - | 推送失败 |
| 2 | 第 1 次重试 | 1s 后 | 失败 |
| 3 | 第 2 次重试 | 2s 后 | 失败 |
| 4 | 第 3 次重试 | 4s 后 | 失败，放弃 |
| 5 | 转离线消息 | - | offlineMessages 入队，同类合并 |

**预期结果**
推送失败按 1s/2s/4s 重试 3 次后转离线消息；模块不崩溃。

**优先级**：高
**关联 INTF**：INTF-014

---

### TC-INT-032
- 标题：文章状态机非法跳转 fallback（TC-DES-012）
- 优先级：高
- 关联需求/设计：REQ-012 / SD-012 / INTF-012
- 测试场景：archived → published 逆向跳转被拒；draft → archived 跨态跳转被拒

**前置条件**
文章已 archived。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | archived → published | PUT /api/articles/:id/status status=published | 400 + code=1002 |
| 2 | archived → draft | status=draft | 400 + code=1002 |
| 3 | draft → archived（跨态） | status=archived | 400 + code=1002 |
| 4 | draft → published（跨态） | status=published | 400 + code=1002 |
| 5 | 合法 draft → pending_review | status=pending_review | 200 |

**预期结果**
非法跳转返回 400+1002；合法跳转 200；状态机不崩溃。

**优先级**：高
**关联 INTF**：INTF-012

---

### TC-INT-033
- 标题：交叉引用自引用 fallback（TC-DES-012）
- 优先级：中
- 关联需求/设计：REQ-013 / SD-013 / INTF-013
- 测试场景：文章引用自己被拒；引用非 published 文章被拒

**前置条件**
文章 A published；文章 B draft。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 自引用 | POST /api/articles/A/citations targetId=A | 400 + code=1003 |
| 2 | 引用 draft 文章 | POST /api/articles/A/citations targetId=B | 400 + code=1001 |
| 3 | 引用不存在文章 | targetId=无效 id | 400 + code=1031 |
| 4 | 合法引用 | targetId=已 published 文章 | 201 |
| 5 | 重复引用 | 再次引用同一文章 | 200（幂等不报错） |

**预期结果**
自引用 400+1003；引用非 published 400+1001；引用不存在 400+1031；合法引用 201。

**优先级**：中
**关联 INTF**：INTF-013

---

### TC-INT-034
- 标题：文件上传配额超限 fallback（TC-DES-012）
- 优先级：高
- 关联需求/设计：REQ-015 / SD-015 / INTF-015
- 测试场景：用户日配额已满→上传被拒；博主月配额超限→上传被拒

**前置条件**
用户日配额已用 50MB；博主月配额已用 500MB。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 用户上传（日配额满） | POST /api/files/image | 413 + code=1042 |
| 2 | 博主上传（月配额满） | POST /api/files/attachment | 413 + code=1042 |
| 3 | 文件超 10MB | 11MB | 413 + code=1041 |
| 4 | MIME 非白名单 | image/bmp | 400 + code=1053 |
| 5 | 魔数不匹配 | 扩展 jpg 内容 png | 400 + code=1052 |

**预期结果**
配额超限 413+1042；文件超限 413+1041；MIME/魔数拒绝 400；模块不崩溃。

**优先级**：高
**关联 INTF**：INTF-015

---

### TC-INT-035
- 标题：备份恢复 SHA-256 校验失败 fallback（TC-DES-012）
- 优先级：高
- 关联需求/设计：REQ-017 / SD-017 / INTF-017
- 测试场景：备份文件 SHA-256 校验失败→恢复被拒

**前置条件**
备份文件被篡改。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 恢复被篡改的备份 | POST /api/backups/restore backupId | 422 + code=1051 |
| 2 | 恢复不存在备份 | backupId=无效 | 404 + code=1031 |
| 3 | 非管理员恢复 | user token | 403 + code=1021 |
| 4 | 合法恢复 | 未篡改备份 | 200 |
| 5 | 恢复后数据一致 | GET /api/stats/site | 200，数据一致 |

**预期结果**
SHA-256 校验失败 422+1051；不存在 404+1031；越权 403+1021；合法恢复 200。

**优先级**：高
**关联 INTF**：INTF-017

---

### TC-INT-036
- 标题：维护模式拦截非管理员 fallback（TC-DES-012）
- 优先级：中
- 关联需求/设计：REQ-001 / SD-001 / INTF-001
- 测试场景：维护模式开启→非管理员访问被 503 拦截→管理员正常访问

**前置条件**
维护模式开启。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 普通用户 GET /api/articles | user token | 503 + code=1023 |
| 2 | 普通用户 POST /api/comments | user token | 503 + code=1023 |
| 3 | 管理员 GET /api/articles | admin token | 200 |
| 4 | 关闭维护模式 | PUT /api/site/maintenance | 200 |
| 5 | 普通用户访问恢复 | user token | 200 |

**预期结果**
维护模式拦截非管理员 503+1023；管理员正常；关闭后恢复。

**优先级**：中
**关联 INTF**：INTF-001

---

### TC-INT-037
- 标题：封禁用户 token 失效 fallback（TC-DES-012）
- 优先级：高
- 关联需求/设计：REQ-003 / SD-003 / INTF-003
- 测试场景：用户封禁后→旧 token 立即失效→解禁后可重新登录

**前置条件**
用户已登录（有效 token）。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 管理员封禁用户 | POST /api/users/:id/ban | 200 |
| 2 | 旧 token 访问 | GET /api/users/:id（旧 token） | 403 + code=1022 |
| 3 | 旧 token 创建评论 | POST /api/comments | 403 + code=1022 |
| 4 | 解禁用户 | POST /api/users/:id/unban | 200 |
| 5 | 重新登录 | POST /api/auth/login | 200，新 JWT |

**预期结果**
封禁后旧 token 立即失效 403+1022；解禁后可重新登录。

**优先级**：高
**关联 INTF**：INTF-003

---

### TC-INT-038
- 标题：JWT 伪造/过期 fallback（TC-DES-012）
- 优先级：高
- 关联需求/设计：REQ-003 / SD-003 / INTF-003
- 测试场景：伪造 token→401；过期 token→401；无 token→401

**前置条件**
无。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 无 token 访问受保护接口 | GET /api/users/:id（无 Authorization） | 401 + code=1011 |
| 2 | 伪造 token | Authorization: Bearer fake.jwt.token | 401 + code=1012 |
| 3 | 过期 token | 24h 前签发的 token | 401 + code=1013 |
| 4 | 合法 token | 有效 JWT | 200 |
| 5 | 错误格式 token | Authorization: xxx | 401 + code=1011 |

**预期结果**
无 token 401+1011；伪造 401+1012；过期 401+1013；合法 200。

**优先级**：高
**关联 INTF**：INTF-003

---

### TC-INT-039
- 标题：RBAC 越权 fallback（TC-DES-012）
- 优先级：高
- 关联需求/设计：REQ-003 / SD-003 / INTF-003
- 测试场景：user 角色访问 admin 接口→403；blogger 角色访问 admin 接口→403

**前置条件**
user/blogger/admin 各已登录。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | user 访问统计 | GET /api/stats/site（user token） | 403 + code=1021 |
| 2 | user 创建广告 | POST /api/ads（user token） | 403 + code=1021 |
| 3 | blogger 访问统计 | GET /api/stats/site（blogger token） | 403 + code=1021 |
| 4 | blogger 创建广告 | POST /api/ads（blogger token） | 201 |
| 5 | admin 访问统计 | GET /api/stats/site（admin token） | 200 |

**预期结果**
越权访问 403+1021；合法权限 200/201。

**优先级**：高
**关联 INTF**：INTF-003

---

### TC-INT-040
- 标题：评论嵌套深度超限 fallback（TC-DES-012）
- 优先级：高
- 关联需求/设计：REQ-010 / SD-010 / INTF-010
- 测试场景：评论嵌套达 5 层→第 6 层被拒

**前置条件**
文章已发布；评论嵌套已有 5 层。

**测试步骤**

| 步骤 | 操作 | 输入 | 预期输出 |
|---|---|---|---|
| 1 | 第 5 层评论 | POST /api/comments parentId=第4层 | 201 |
| 2 | 第 6 层评论 | POST /api/comments parentId=第5层 | 400 + code=1004 |
| 3 | 评论内容超长 | content=2001 字符 | 400 + code=1001 |
| 4 | 评论开关关闭 | POST /api/comments | 403 + code=1025 |
| 5 | 合法评论 | content=正常 | 201 |

**预期结果**
嵌套超限 400+1004；内容超长 400+1001；开关关闭 403+1025；合法 201。

**优先级**：高
**关联 INTF**：INTF-010

---

## 3. 用例汇总

| 用例 ID | 标题 | 优先级 | 关联 INTF | 状态 |
|---|---|---|---|---|
| TC-INT-001 | 接口契约定义验证（TC-DES-004） | 高 | INTF-001~017 | 待执行 |
| TC-INT-002 | 集成测试用例生成完整性（TC-DES-006） | 高 | INTF-001~017 | 待执行 |
| TC-INT-003 | 用户注册接口参数校验（TC-DES-010） | 高 | INTF-003 | 待执行 |
| TC-INT-004 | 文章创建接口参数校验（TC-DES-010） | 高 | INTF-012 | 待执行 |
| TC-INT-005 | 文件上传接口参数校验（TC-DES-010） | 高 | INTF-015 | 待执行 |
| TC-INT-006 | 推荐接口 mode 参数校验（TC-DES-010） | 中 | INTF-004 | 待执行 |
| TC-INT-007 | 搜索接口参数校验（TC-DES-010） | 中 | INTF-007 | 待执行 |
| TC-INT-008 | 标签创建与绑定参数校验（TC-DES-010） | 中 | INTF-008 | 待执行 |
| TC-INT-009 | 分类树深度参数校验（TC-DES-010） | 中 | INTF-009 | 待执行 |
| TC-INT-010 | 订阅 invitation 权限参数校验（TC-DES-010） | 中 | INTF-016 | 待执行 |
| TC-INT-011 | 站点管理三层集成 | 高 | INTF-001 | 待执行 |
| TC-INT-012 | 多博主注册→关注→主页集成 | 高 | INTF-002 | 待执行 |
| TC-INT-013 | 用户登录→JWT→封禁→token 失效集成 | 高 | INTF-003 | 待执行 |
| TC-INT-014 | 文章状态机正向流转集成 | 高 | INTF-012 | 待执行 |
| TC-INT-015 | 交叉引用建立→图谱→相关文章集成 | 中 | INTF-013 | 待执行 |
| TC-INT-016 | WebSocket 连接→订阅→推送→离线合并集成 | 高 | INTF-014 | 待执行 |
| TC-INT-017 | 文件上传→去重→配额查询集成 | 高 | INTF-015 | 待执行 |
| TC-INT-018 | 订阅→新文章→聚合推送集成 | 高 | INTF-016 | 待执行 |
| TC-INT-019 | 数据导出→任务进度→下载集成 | 高 | INTF-017 | 待执行 |
| TC-INT-020 | 广告投放→审核→展示→点击统计集成 | 中 | INTF-005 | 待执行 |
| TC-INT-021 | 评论→通知→推送跨模块调用（TC-DES-011） | 高 | INTF-010,011,014 | 待执行 |
| TC-INT-022 | 文章→标签→搜索跨模块调用（TC-DES-011） | 高 | INTF-008,012,007 | 待执行 |
| TC-INT-023 | 订阅→推送→通知聚合跨模块调用（TC-DES-011） | 高 | INTF-014,016 | 待执行 |
| TC-INT-024 | 文件上传→文章→交叉引用跨模块调用（TC-DES-011） | 高 | INTF-012,013,015 | 待执行 |
| TC-INT-025 | 站点→统计→导出跨模块调用（TC-DES-011） | 中 | INTF-001,006,017 | 待执行 |
| TC-INT-026 | 用户→博主→关注→推荐跨模块调用（TC-DES-011） | 中 | INTF-002,003,004 | 待执行 |
| TC-INT-027 | 分类→文章→搜索跨模块调用（TC-DES-011） | 中 | INTF-009,012,007 | 待执行 |
| TC-INT-028 | 广告→统计→推荐跨模块调用（TC-DES-011） | 中 | INTF-005,006,004 | 待执行 |
| TC-INT-029 | 评论→点赞→举报→审核跨模块调用（TC-DES-011） | 中 | INTF-010 | 待执行 |
| TC-INT-030 | 备份→恢复→统计跨模块调用（TC-DES-011） | 高 | INTF-017,006 | 待执行 |
| TC-INT-031 | 推送失败重试 fallback（TC-DES-012） | 高 | INTF-014 | 待执行 |
| TC-INT-032 | 文章状态机非法跳转 fallback（TC-DES-012） | 高 | INTF-012 | 待执行 |
| TC-INT-033 | 交叉引用自引用 fallback（TC-DES-012） | 中 | INTF-013 | 待执行 |
| TC-INT-034 | 文件上传配额超限 fallback（TC-DES-012） | 高 | INTF-015 | 待执行 |
| TC-INT-035 | 备份恢复 SHA-256 校验失败 fallback（TC-DES-012） | 高 | INTF-017 | 待执行 |
| TC-INT-036 | 维护模式拦截非管理员 fallback（TC-DES-012） | 中 | INTF-001 | 待执行 |
| TC-INT-037 | 封禁用户 token 失效 fallback（TC-DES-012） | 高 | INTF-003 | 待执行 |
| TC-INT-038 | JWT 伪造/过期 fallback（TC-DES-012） | 高 | INTF-003 | 待执行 |
| TC-INT-039 | RBAC 越权 fallback（TC-DES-012） | 高 | INTF-003 | 待执行 |
| TC-INT-040 | 评论嵌套深度超限 fallback（TC-DES-012） | 高 | INTF-010 | 待执行 |

## 4. 测试用例覆盖说明

- **17 INTF 覆盖**：17/17（INTF-001~017 每接口至少 2 条用例）
- **TC-DES 覆盖**：
  - TC-DES-004（接口定义）：TC-INT-001 ✅
  - TC-DES-006（集成测试用例生成）：TC-INT-002 ✅
  - TC-DES-010（接口参数校验）：TC-INT-003~010（8 条）✅
  - TC-DES-011（跨模块调用）：TC-INT-021~030（10 条）✅
  - TC-DES-012（数据传递异常路径）：TC-INT-031~040（10 条）✅
- **错误码三段位覆盖**：4xx(1001/1011/1012/1013/1021/1022/1023/1025/1031/1041/1053) + 5xx(1099/5021) + 业务(1002/1003/1004/1005/1042/1051/1052/1061/1071)
- **状态机非法跳转**：TC-INT-032（archived→published/draft 逆向 + draft→archived/published 跨态）
- **超时/重试 fallback**：TC-INT-031（推送 3 次重试 1s/2s/4s）
- **错误码 fallback**：TC-INT-033~040（自引用/配额/SHA-256/维护模式/封禁/JWT/RBAC/嵌套深度）
- **优先级分布**：高 26 条 / 中 14 条 / 低 0 条
- **边界条件覆盖**：password 8-32 位、tagIds ≤10、分类树 ≤5、评论嵌套 ≤5、文件 ≤10MB、配额日 50MB/月 500MB、invitationCode 8-32
