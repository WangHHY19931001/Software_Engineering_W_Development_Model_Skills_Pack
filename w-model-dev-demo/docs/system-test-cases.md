# 系统测试用例文档

> 阶段 7（系统测试执行）产出。
> 设计来源：`docs/system-design.md` §5 系统测试用例设计（ST-001 ~ ST-006）。
> 执行入口：`npm run test:system` → `tests/system/system.test.ts`。

## 文档信息

- 项目名称：blog-system-demo
- 文档版本：v1.0
- 编制日期：2026-07-21
- 编制者：W-Model Agent（阶段 7）
- 关联设计文档：`docs/system-design.md` §5
- 测试运行器：vitest 1.6 + supertest 7.2
- 被测入口：`src/app.ts` 单例 `app`（真实 Express 实例，端到端 HTTP 调用）

## 1. 用例总览

| 用例 ID | 关联需求 | 场景 | 优先级 | 模块覆盖 |
|---|---|---|---|---|
| ST-001 | REQ-001~004 | 端到端：注册→登录→创建文章→浏览→评论→删除→404 全链路 | 高 | 全部 8 模块联动 |
| ST-002 | REQ-002 | 作者隔离验证 - A 修改/删除 B 的文章被拒（40301）；B 改自己成功 | 高 | ArticleService.update/delete + AuthMiddleware + ErrorHandler |
| ST-003 | NFR-002 | 性能基线 - 1000 篇文章预置，200 次 GET 采样，P95 ≤ 200ms + 无 5xx + 进程未崩溃 | 高 | ArticleStore.findAll + ArticleService.list |
| ST-004 | NFR-001 | 安全基线 - 无 token 访问 3 个受保护接口返回 401 + 40103；公开接口不受影响 | 高 | AuthMiddleware.verify + ErrorHandler |
| ST-005 | NFR-001 | 安全基线 - 过期 JWT + 伪造 JWT 一律 401 + 40102；合法 JWT 对照 201 | 高 | AuthMiddleware.verify + JwtUtils.verify |
| ST-006 | NFR-001 | 安全基线 - bcrypt 哈希存储（cost=10 / $2b$10$ 前缀 / 无明文 / 错误密码比对 false） | 高 | UserService.register + PasswordUtils.hash + UserStore |

## 2. 用例详细规格

### ST-001：端到端全链路

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-001 ~ REQ-004 |
| 场景 | 9 步 API 顺序调用：register → login → createArticle → listArticles → getArticle → createComment → getArticle → deleteArticle → getArticle |
| 输入 | alice 注册 → 登录获取 token → 创建文章（Bearer） → 列表浏览（无 token） → 详情浏览（无 token） → 发表评论（Bearer） → 详情浏览（评论聚合） → 删除文章（Bearer） → 删除后详情 |
| 预期输出 | 步骤 1-8 返回 201/200/200/200/200/201/200/204；步骤 9 返回 404 + 40401；公开浏览可在未认证下进行；评论随文章详情聚合 |
| 优先级 | 高 |
| 模块覆盖 | routes/auth + routes/article + AuthMiddleware + AuthController + ArticleController + CommentController + UserService + ArticleService + CommentService + 全部 Store |
| 实现位置 | tests/system/system.test.ts → describe('ST-001') |

### ST-002：作者隔离验证

| 项 | 内容 |
|---|---|
| 关联需求 | REQ-002 |
| 场景 | A 修改 / 删除 B 的文章被拒（40301）；B 修改自己文章返回 200 + title 更新 |
| 输入 | alice 与 bob 各自注册登录；bob 创建文章 X；alice 的 token PATCH/DELETE /articles/X；bob 的 token PATCH /articles/X body {title:"BobTitleV2"} |
| 预期输出 | A 修改 / 删除返回 403 + 40301；B 修改返回 200 + title 已更新；其他字段保持不变；文章 X 仍存在 |
| 优先级 | 高 |
| 模块覆盖 | ArticleService.update/delete（作者隔离校验）+ AuthMiddleware + ErrorHandler |
| 实现位置 | tests/system/system.test.ts → describe('ST-002') |

### ST-003：性能基线 + 可靠性

| 项 | 内容 |
|---|---|
| 关联需求 | NFR-002 |
| 场景 | 预置 1000 篇文章后，循环 200 次 GET /api/v1/articles?page=1&pageSize=10，计算 P95；同时验证可靠性（无 5xx + 进程未崩溃） |
| 输入 | 直接通过 `deps.articleStore.save()` 预置 1000 篇文章；N=200 次串行 HTTP 采样 |
| 预期输出 | `P95 ≤ 200ms`；`errors5xx === 0`；`errorsAny === 0`；循环跑完即证明进程未崩溃 |
| 优先级 | 高 |
| 模块覆盖 | ArticleStore.findAll + ArticleService.list + ArticleController.list |
| 实现位置 | tests/system/system.test.ts → describe('ST-003')（CI 内 vitest 采样）+ tests/perf/k6-load-test.js（独立 k6 性能基线） |
| 工具 | **k6 100QPS × 10min**（设计原意，独立性能基线测试，见 `tests/perf/k6-load-test.js`）；CI 内 vitest+supertest 采样为近似验证（N=200，快速回归门禁） |
| 设计-实现偏差说明 | system-design §5.1 ST-003 原设计「k6 100 QPS × 10min + 预置 10000 篇」。现已提供独立 k6 性能基线脚本 `tests/perf/k6-load-test.js`（100 VUs × 30s，P95 < 200ms），由 k6 二进制直接执行，不在 vitest 套件中。CI 自动化套件内用 vitest + supertest 串行采样 N=200 次做快速回归门禁（近似 P95，预置数据量降至 1000 篇保持单测 < 5s）。两者互补：vitest 采样是 CI 内近似验证，k6 是独立性能基线测试。正式 k6 10min 长稳压测可扩展 stages 字段实现（见 `tests/perf/README.md` §6）。 |

### ST-004：安全基线 - 未授权访问被拒

| 项 | 内容 |
|---|---|
| 关联需求 | NFR-001 |
| 场景 | 无 Authorization 头访问 3 个受保护接口 → 401 + 40103；公开接口 GET /api/v1/articles 不受影响 |
| 输入 | 1) POST /api/v1/articles（无 token）<br>2) DELETE /api/v1/articles/:id（无 token）<br>3) POST /api/v1/articles/:id/comments（无 token）<br>4) GET /api/v1/articles（无 token，对照） |
| 预期输出 | 1-3) HTTP 401 + code 40103；4) HTTP 200 + 空列表 |
| 优先级 | 高 |
| 模块覆盖 | AuthMiddleware.verify（Authorization 头缺失分支）+ ErrorHandler |
| 实现位置 | tests/system/system.test.ts → describe('ST-004') |

### ST-005：安全基线 - JWT 过期 / 伪造处理

| 项 | 内容 |
|---|---|
| 关联需求 | NFR-001 |
| 场景 | 过期 JWT（exp = now - 10s）+ 伪造签名 JWT（错误 secret）+ 合法 JWT 对照 |
| 输入 | 1) 过期 JWT 调 POST /api/v1/articles<br>2) 伪造 JWT 调同接口<br>3) 合法 JWT 对照 |
| 预期输出 | 1-2) HTTP 401 + code 40102；3) HTTP 201 + articleId |
| 优先级 | 高 |
| 模块覆盖 | AuthMiddleware.verify + JwtUtils.verify（过期 / 伪造签名分支） |
| 实现位置 | tests/system/system.test.ts → describe('ST-005') |

### ST-006：安全基线 - bcrypt 哈希存储

| 项 | 内容 |
|---|---|
| 关联需求 | NFR-001 |
| 场景 | 注册后读取 userStore 记录，校验 passwordHash 格式、bcrypt cost、无明文、错误密码比对 |
| 输入 | POST /api/v1/auth/register body {username:"bob", password:"Secret123"} |
| 预期输出 | `user.passwordHash` 以 `$2b$10$` 开头；`bcrypt.getRounds(hash) === 10`；存储中无 `password` 字段；`bcrypt.compare("WrongPass", hash) === false`；`bcrypt.compare("Secret123", hash) === true` |
| 优先级 | 高 |
| 模块覆盖 | UserService.register + PasswordUtils.hash + UserStore |
| 实现位置 | tests/system/system.test.ts → describe('ST-006') |

## 3. 覆盖说明

### 3.1 强制场景覆盖（TC-DES-007 / 008 / 009）

| 场景类型 | 覆盖用例 | 说明 |
|---|---|---|
| TC-DES-007 端到端 | ST-001 | 9 步 API 全链路 |
| TC-DES-008 性能基线 | ST-003 | P95 ≤ 200ms + 无 5xx + 可靠性 |
| TC-DES-009 安全基线 | ST-004 + ST-005 + ST-006 | 未授权 / JWT 过期 / 伪造 / bcrypt 存储 |

### 3.2 异常路径覆盖

- 40103 未提供认证令牌（ST-004）
- 40102 JWT 已过期或无效（ST-005）
- 40301 无权操作他人资源（ST-002）
- 40401 资源不存在（ST-001 step 9）

### 3.3 总计

- 设计 ST 用例数：6 条（ST-001 ~ ST-006）
- 实际 it() 测试数：6 条
- 全部为高优先级用例

## 4. 测试环境与隔离

| 项 | 内容 |
|---|---|
| 被测 app | `import { app, deps } from '../../src/app.js'`（单例） |
| 状态重置 | `beforeEach` 调 `POST /__test/reset` 清空 3 个内存 Store |
| 性能采样 | `Date.now()` 包裹 supertest 调用，循环 N=200 次后用 percentile 函数计算 P95 |
| JWT 构造 | 过期 JWT 用 `jwt.sign({...exp: now-10}, secret)` 直接构造；伪造 JWT 用错误 secret 签发 |
| bcrypt 校验 | 通过 `bcrypt.getRounds` + `bcrypt.compareSync` 直接读取存储记录验证 |
| 预置数据 | ST-003 直接通过 `deps.articleStore.save()` 预置 1000 篇文章（绕开 HTTP 注册开销） |
