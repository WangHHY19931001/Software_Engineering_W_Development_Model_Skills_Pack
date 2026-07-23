# 需求规格说明书

> 阶段 1（需求分析）产出。W 模型右 V 同步产出验收测试设计。
> 本文件内嵌验收测试用例设计（UAT-001~015），不再外挂独立测试用例文件。

## 文档信息

- 项目名称：blog-system-demo
- 文档版本：v1.0
- 编制日期：2026-07-23
- 编制者：W-Model Agent（self-as-verifier 回归调测）
- 关联 W 模型阶段：阶段 1（需求分析 → 同步验收测试设计）

## 1. 项目概述

### 1.1 项目背景

构建一个博客系统后端 demo，用于演示 W 模型 8 阶段端到端调测流程。系统提供用户认证、文章管理、公开浏览、评论四类核心能力，以 Express + TypeScript + 内存存储的精简技术栈承载业务，刻意不引入数据库与前端，以聚焦后端契约与测试设计本身。

业务角色：

- 访客（未认证）：只能浏览公开文章与评论。
- 作者（已认证用户）：可注册 / 登录、创建文章、修改 / 删除自己的文章、对已存在文章发表评论、删除自己的评论。
- 系统管理员：本 demo 不实现独立管理员角色；作者隔离由 JWT 中的 `userId` 字段保证。

### 1.2 项目目标

1. 在内存存储前提下，端到端跑通注册 → 登录 → 创建文章 → 公开浏览 → 评论的完整业务链路。
2. 满足 4 项非功能需求：安全（bcrypt + JWT）、性能（P95 ≤ 200ms）、可维护性（tsc strict 0 错误）、可测试性（单元覆盖率 ≥ 80%）。
3. 产出 W 模型阶段 1-4 全部设计产物与对应四级测试设计，RTM 覆盖率结构完整。

### 1.3 范围

- 包含：
  - 用户注册、登录、JWT 颁发与校验
  - 文章 CRUD（含作者隔离）
  - 公开浏览（列表 + 详情含评论聚合）
  - 评论增删查
  - 四级测试设计（UAT / ST / IT / UT）
  - RTM 与项目状态文件
- 不包含：
  - 前端 UI（任何 HTML / 模板 / SPA）
  - 数据库持久化（仅内存 `Map`）
  - 邮件验证、第三方 OAuth、SSO
  - 富文本编辑器、图片上传
  - 管理员后台、内容审核工作流
  - 部署运维（容器、CI/CD、监控）

## 2. 需求清单

### 2.1 功能需求

| 需求 ID | 模块 | 需求描述 | 优先级 | 验收标准 |
|---|---|---|---|---|
| REQ-001 | 用户认证 | 用户可使用用户名 + 密码注册账号；登录成功后服务端颁发 JWT；受保护接口通过 `Authorization: Bearer <token>` 校验身份 | 高 | 1) 注册成功返回 201 与用户 ID；重复用户名返回 40901；2) 登录成功返回 200 + JWT；错误密码返回 40101；3) JWT 校验失败返回 40102；4) 密码以 bcrypt 哈希存储，存储中不存在明文密码 |
| REQ-002 | 文章管理 | 已认证用户可创建、读取、更新、删除自己的文章；不能修改 / 删除他人文章 | 高 | 1) 创建文章返回 201 与 articleId；2) 作者修改 / 删除自己文章返回 200 / 204；3) 非作者修改 / 删除返回 40301；4) 文章不存在返回 40401 |
| REQ-003 | 公开浏览 | 访客（未认证）可分页浏览文章列表、查看单篇文章详情（含其评论列表） | 高 | 1) `GET /api/v1/articles?page=1&pageSize=10` 返回 200 + 分页结构；2) `GET /api/v1/articles/:id` 返回文章 + 评论聚合；3) 不存在文章返回 40401；4) 列表分页参数越界返回 40001 |
| REQ-004 | 评论 | 已认证用户可对任意已存在文章发表评论；可删除自己的评论；任意访客可查看文章的评论列表 | 高 | 1) 发表评论返回 201 + commentId；2) 文章不存在时发表评论返回 40401；3) 删除自己评论返回 204；4) 删除他人评论返回 40301；5) 评论列表随文章详情返回 |

### 2.2 非功能需求

| 需求 ID | 类别 | 描述 | 指标 |
|---|---|---|---|
| NFR-001 | 安全 | 密码使用 bcrypt 哈希存储，cost ≥ 10；JWT 过期时间 ≤ 3600s；明文密码不入日志 / 响应；JWT 签名密钥不硬编码于代码 | bcrypt cost = 10；JWT exp = 3600s；密钥来自 `process.env.JWT_SECRET` |
| NFR-002 | 性能 | 单实例下，所有读接口 P95 响应时间 ≤ 200ms（内存存储） | P95 ≤ 200ms；100 QPS 持续 10min；无崩溃 |
| NFR-003 | 可维护性 | TypeScript strict 模式开启；`tsc --noEmit` 退出码 0；所有公共 API 输入用 zod 校验 | `tsc --noEmit` exit 0；zod schema 覆盖全部公开接口入参 |
| NFR-004 | 可测试性 | 单元测试代码覆盖率 ≥ 80%（分支 + 行 + 函数 + 语句）；单元测试不依赖外部服务（内存隔离） | 分支 / 行 / 函数 / 语句覆盖均 ≥ 80%；UT 仅依赖内存 mock |

### 2.3 约束需求

| 约束 ID | 类别 | 内容 |
|---|---|---|
| CON-001 | 技术栈 | 后端：Express 4.x + TypeScript 5.x；密码：bcrypt 5.x；JWT：jsonwebtoken 9.x；参数校验：zod 3.x；运行时：Node.js ≥ 18 |
| CON-002 | 存储介质 | 内存存储（`Map`），不引入任何数据库 / 缓存 / 文件系统；进程重启数据丢失可接受 |
| CON-003 | 前端范围 | 不实现任何前端 UI；只产出 RESTful JSON API |
| CON-004 | 单进程 | 单进程单实例；不考虑水平扩展、分布式事务、消息队列 |
| CON-005 | 测试运行器 | 单元测试采用 vitest（与 tsc strict 兼容）；不引入 jest |
| CON-006 | 鉴权方案 | 仅 JWT（HS256）；不引入 OAuth / SSO / Session Cookie |
| CON-007 | 时间约束 | 阶段 1-4 在单一会话内串行完成；阶段 5-8 后续执行 |
| CON-008 | 数据规模 | 单元 / 集成测试：≤ 1000 条文章；系统测试压测：≤ 10000 条 |

## 3. 需求完整性检查

| 检查项 | 状态 | 说明 |
|---|---|---|
| 功能需求闭环 | ✅ | REQ-001~004 覆盖注册 / 登录 / JWT / 文章 CRUD / 作者隔离 / 公开浏览 / 评论 CRUD；无业务断链 |
| 非功能需求覆盖 | ✅ | NFR-001~004 覆盖安全 / 性能 / 可维护性 / 可测试性四类；可用性 / 可观测性本 demo 不强制（约束 CON-003/CON-004 已声明） |
| 约束需求覆盖 | ✅ | CON-001~008 覆盖技术栈 / 存储 / 前端 / 进程 / 测试 / 鉴权 / 时间 / 数据规模 |
| 冲突检测 | ✅ | 0 冲突。已逐项检查：REQ-002 作者隔离与 REQ-003 公开浏览无冲突（不同 API）；NFR-002 性能 P95≤200ms 与内存存储无瓶颈冲突；CON-002 内存存储与 NFR-002 100QPS 在 1 万条数据规模下可达 |
| 缺失项 | ⚠️ | 已识别 2 项潜在缺失（不阻塞，已在风险评估中标注）：1) 密码复杂度策略未在 NFR 中量化（demo 阶段仅要求长度 ≥ 8 + 至少 1 字母 + 1 数字，已写入验收标准）；2) JWT 刷新机制未实现（CON-006 已声明仅 HS256，过期后需重新登录） |

## 4. 需求风险评估

| 风险 ID | 风险描述 | 等级 | 缓解措施 |
|---|---|---|---|
| RISK-001 | 内存存储进程重启数据丢失，影响验收测试可重复性 | 中 | 测试用例显式声明「前置条件：空存储」；UT/IT 通过 beforeEach 重置 Store 单例；ST 通过 `/__test/reset` 维护端点重置 |
| RISK-002 | Express 4 不自动捕获 async handler 抛出的 rejected promise，导致集成测试表现为 Unhandled Rejection | 高 | 强制所有路由 handler 经 `asyncHandler` 包装器；通过 `errorHandler` 中间件统一捕获；IT-006 专门验证此路径 |
| RISK-003 | JWT 密钥若硬编码会触发 NFR-001 安全违规 | 高 | 强制从 `process.env.JWT_SECRET` 读取；启动时缺失即抛错并退出；测试脚本通过 `cross-env JWT_SECRET=test-secret-blog-demo` 注入 |
| RISK-004 | bcrypt cost=10 在低配机器上单次哈希耗时 ~100ms，可能影响注册 / 登录 P95 | 中 | NFR-002 性能基线仅约束读接口（GET），注册 / 登录写接口不纳入 P95；ST-003 显式声明压测范围 |
| RISK-005 | 内存 Map 在高并发下无锁，可能出现评论计数短暂不一致 | 低 | demo 单进程 Node 事件循环天然串行；ST-003 压测仅验证 P95 与无崩溃，不强一致校验 |
| RISK-006 | 密码复杂度策略未量化，可能被「弱密码」绕过 | 中 | 验收标准量化为「长度 ≥ 8 + 至少 1 字母 + 1 数字」；zod schema 强制校验；UAT-001 验证 |
| RISK-007 | 阶段 5 编码时若发现设计缺漏（如方法签名遗漏），需回退到阶段 4 返工 | 低 | 阶段 4 详细设计对每个方法显式定义前置 / 后置条件 + 异常；阶段门评审通过后再编码 |
| RISK-008 | JWT_SECRET 缺失导致测试套件加载失败（历史回归缺陷） | 高 | package.json 全部 test 脚本统一通过 `cross-env JWT_SECRET=test-secret-blog-demo` 注入密钥，避免环境变量缺失 |

## 5. 验收测试用例设计

> 阶段 1 同步产出验收测试设计。本阶段只设计，不执行；执行在阶段 8（验收测试）。
> 覆盖原则：每个 REQ / NFR 至少 1 条 UAT；同时覆盖正常路径、异常路径、边界条件；验收标准全部量化。

### 5.1 验收测试用例清单

| 用例 ID | 关联需求 | 场景 | 输入 | 预期输出 | 优先级 |
|---|---|---|---|---|---|
| UAT-001 | REQ-001 | 用户注册成功 | `POST /api/v1/auth/register` body: `{"username":"alice","password":"Passw0rd!"}` | HTTP 201；响应体含 `userId`（UUID v4）与 `username`；不含 `password` 字段；存储中 `passwordHash` 以 `$2b$10$` 开头 | 高 |
| UAT-002 | REQ-001 | 用户登录成功并返回 JWT | `POST /api/v1/auth/login` body: `{"username":"alice","password":"Passw0rd!"}` | HTTP 200；响应体含 `token`（JWT 三段式）与 `expiresIn: 3600`；`jwt.decode(token).exp - iat === 3600` | 高 |
| UAT-003 | REQ-001 | 用户登录 - 错误密码 | `POST /api/v1/auth/login` body: `{"username":"alice","password":"WrongPass"}` | HTTP 401；`{code: 40101, message: "用户名或密码错误"}`；不返回 token；不区分用户名不存在与密码错误 | 高 |
| UAT-004 | REQ-002 | 创建文章（已认证作者） | `POST /api/v1/articles` Header: `Authorization: Bearer <token>` body: `{"title":"Hello World","content":"My first post.","tags":["intro"]}` | HTTP 201；响应体含 `articleId`（UUID v4）、`authorId`（=JWT.userId）、`title`、`content`、`tags`、`createdAt` | 高 |
| UAT-005 | REQ-002 | 修改自己的文章 + 非作者修改被拒 | 作者 A `PATCH /api/v1/articles/:id` body: `{"title":"Hello World (v2)"}`；作者 B `PATCH /api/v1/articles/:id` 同 body | 作者 A：HTTP 200，`title` 已更新，`updatedAt > createdAt`；作者 B：HTTP 403，`{code: 40301}` | 高 |
| UAT-006 | REQ-002 | 删除自己的文章 + 非作者删除被拒 | 作者 A `DELETE /api/v1/articles/:id`；作者 B `DELETE /api/v1/articles/:id` | 作者 A：HTTP 204 空响应，随后 `GET` 返回 404 + 40401；作者 B（对 A 的文章）：HTTP 403，`{code: 40301}` | 高 |
| UAT-007 | REQ-003 | 公开列表分页浏览（未认证） | `GET /api/v1/articles?page=1&pageSize=10`（无 Authorization 头）；存在 ≥ 15 篇文章 | HTTP 200；`{items: Article[10], total, page: 1, pageSize: 10}`；`page=2` 时 items 长度 = 5 | 高 |
| UAT-008 | REQ-003 + REQ-004 | 查看文章详情 + 评论聚合 | `GET /api/v1/articles/:id`；文章下有 ≥ 2 条评论 | HTTP 200；响应体含 `comments: Comment[]`；`comments.length >= 2`；评论按 `createdAt` 升序 | 高 |
| UAT-009 | REQ-004 | 已登录用户对存在文章发表评论 | `POST /api/v1/articles/:id/comments` Header: `Authorization: Bearer <token>` body: `{"content":"Nice post!"}` | HTTP 201；响应体含 `commentId`、`articleId`、`authorId`（=JWT.userId，不取自 body）、`content`、`createdAt` | 高 |
| UAT-010 | REQ-004 | 删除自己评论 + 删除他人评论被拒 | 作者 A `DELETE /api/v1/comments/:commentId`；作者 B `DELETE /api/v1/comments/:commentId` | 作者 A：HTTP 204；作者 B（对 A 的评论）：HTTP 403，`{code: 40301}` | 高 |
| UAT-011 | NFR-001 | 密码以 bcrypt 哈希存储（无明文） | 注册 `{"username":"bob","password":"Secret123"}` 后读取 `userStore` | `user.passwordHash` 以 `$2b$10$` 开头；`user.passwordHash !== "Secret123"`；存储中无 `password` 字段；`bcrypt.getRounds(hash) === 10` | 高 |
| UAT-012 | NFR-001 | JWT 过期后访问受保护资源被拒 | `POST /api/v1/articles` 使用过期 JWT（exp = now - 1s） + 合法 body | HTTP 401；`{code: 40102, message: "JWT 已过期或无效"}`；不返回 201 / articleId | 高 |
| UAT-013 | NFR-002 | 列表接口 P95 响应时间 ≤ 200ms | k6 / autocannon 100 QPS 持续 10min 压测 `GET /api/v1/articles?page=1&pageSize=10`；预置 10000 篇文章 | `expect(p95).toBeLessThanOrEqual(200)`；`expect(errorRate).toBe(0)`；无 5xx；进程未崩溃 | 高 |
| UAT-014 | NFR-003 | tsc strict 模式 0 错误 | `npx tsc --noEmit` | 退出码 0；stderr 无输出；0 error / 0 warning | 中 |
| UAT-015 | NFR-004 | 单元测试代码覆盖率 ≥ 80% | `npx vitest --coverage` | 退出码 0；`branches % >= 80`；`lines % >= 80`；`functions % >= 80`；`statements % >= 80` | 中 |

### 5.2 验收测试覆盖说明

- 功能点覆盖：REQ-001~004 全部覆盖（每 REQ ≥ 2 条）
- 非功能点覆盖：NFR-001~004 全部覆盖（每 NFR ≥ 1 条）
- 边界条件覆盖：JWT 过期 / 错误密码 / 不存在文章 / 公开接口未认证 / 删除后查询 / 作者隔离
- 异常路径覆盖：40101 / 40102 / 40301 / 40401 / 40001 全覆盖
- 总计：15 条 UAT，正常路径 8 条 + 异常路径 5 条 + 性能 / 静态检查 2 条

## 6. 阶段 1 自检清单

- [x] 需求规格说明书符合 `templates/requirement-spec.md` 模板规范
- [x] 验收测试用例覆盖所有功能点（REQ-001~004）与非功能点（NFR-001~004），共 15 条
- [x] 需求风险评估报告含风险等级与缓解措施，共 8 条
- [x] 需求冲突 / 缺失项均已处理或标注（0 冲突；2 项缺失已声明不阻塞）
- [x] RTM 已登记 8 行需求（REQ-001~004 + NFR-001~004），见 `.w-model/rtm.json`
- [x] 验收标准可量化（P95 ≤ 200ms / cost ≥ 10 / exp ≤ 3600s / 覆盖率 ≥ 80%），无主观词

## 7. 阶段完成摘要

- 产物路径：
  - `docs/requirement-spec.md`（本文件，内嵌 UAT-001~015）
  - `.w-model/rtm.json`（已登记 REQ-001~004 + NFR-001~004 + UAT-001~015）
  - `.w-model/ingestion/consolidated.json`（阶段 1 图谱，check-requirement-graph.ts 退出码 0）
- RTM 覆盖状态：部分（designDoc / codeModule / UT / IT / ST 待后续阶段填充；acceptanceTest 已填 UAT-001~015）
- 验证证据：需求完整性检查 0 冲突，验收标准全量化，15 条 UAT 覆盖全部 REQ + NFR；图谱信息流零违反（无黑洞 / 奇迹 / 死模块，EXT-IN / EXT-OUT 边界完整）
- 阻塞项：无
- 下一步：进入阶段 2（系统设计），同步产出系统测试设计
