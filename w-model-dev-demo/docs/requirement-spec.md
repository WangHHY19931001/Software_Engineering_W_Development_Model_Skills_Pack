# 需求规格说明书

> 阶段 1（需求分析）产出。第 9 轮 W 模型端到端调测。
> 需求总数：32 = 22 REQ + 6 NFR + 4 CON（在第 8 轮 25 需求基础上新增 5 REQ + 1 NFR + 1 CON）。

## 文档信息

- 项目名称：blog-system-demo（扩展博客系统后端）
- 文档版本：v1.0
- 编制日期：2026-07-26
- 编制者：S 子代理（阶段 1）

## 1. 项目概述

### 1.1 项目背景

博客系统后端（blog-system-demo）是一个基于 Express 4 + TypeScript 5 + 内存存储的 REST API 服务。第 9 轮在第 8 轮 25 需求（17 REQ + 5 NFR + 3 CON）基础上扩展，新增 5 个功能需求（密码重置、草稿/发布工作流、文章点赞、审计日志、RSS 订阅）、1 个非功能需求（API 限流）、1 个约束需求（结构化日志规范），总计 32 需求，用于演示 W 模型开发技能的完整 8 阶段流程。

### 1.2 项目目标

- 提供完整的博客系统后端 API，覆盖用户管理、文章管理、评论、标签、分类、搜索等核心功能
- 第 9 轮新增功能：密码重置、草稿/发布工作流、文章点赞、审计日志、RSS 订阅
- 满足性能、安全、可用性等非功能需求，并遵守技术栈与编码约束
- 作为 W 模型开发技能端到端调测的载体，验证 8 阶段流程产出物的完整性与一致性

### 1.3 范围

- 包含：用户注册/登录/权限、文章 CRUD、评论 CRUD、标签/分类管理、搜索、密码重置、草稿/发布工作流、点赞、审计日志、RSS 订阅、用户资料、归档查询
- 不包含：前端界面、持久化数据库（仅内存存储）、邮件真实发送（密码重置仅模拟）、文件上传（头像用 URL 表示）

## User Stories

> 覆盖正常/异常/边界/NFR/CON 全场景。每条 user story 对应 ≥1 个 REQ。

1. As a 访客, I want 注册账号, so that 成为博客作者或读者
2. As a 已注册用户, I want 登录系统, so that 获得 JWT token 访问受保护资源
3. As a admin, I want 分配用户角色, so that 控制不同用户的操作权限
4. As a author, I want 创建文章, so that 发布博客内容
5. As a 读者, I want 浏览文章列表, so that 查看最新文章
6. As a 读者, I want 查看文章详情, so that 阅读完整内容
7. As a author, I want 更新自己的文章, so that 修改内容
8. As a author, I want 删除自己的文章, so that 移除过时内容
9. As a 读者, I want 对文章发表评论, so that 与作者互动
10. As a 读者, I want 查看文章的评论列表, so that 了解他人观点
11. As a 读者, I want 删除自己的评论, so that 撤回不当言论
12. As a author, I want 管理标签, so that 分类组织文章
13. As a author, I want 管理分类, so that 结构化博客内容
14. As a 读者, I want 按关键词搜索文章, so that 快速找到感兴趣的内容
15. As a 忘记密码的用户, I want 通过邮箱重置密码, so that 重新获得账号访问权 [第9轮新增]
16. As a author, I want 将文章保存为草稿再发布, so that 分阶段完善内容 [第9轮新增]
17. As a 读者, I want 给文章点赞, so that 表达对内容的认可 [第9轮新增]
18. As a admin, I want 查看审计日志, so that 追踪关键操作 [第9轮新增]
19. As a 订阅者, I want 通过 RSS 订阅博客更新, so that 在阅读器中获取新文章 [第9轮新增]
20. As a 用户, I want 管理个人资料, so that 完善昵称头像简介
21. As a 读者, I want 按月份归档浏览文章, so that 查找历史内容
22. As a 系统, I want 限制每用户请求频率, so that 防止滥用 [第9轮新增 NFR]
23. As a 开发者, I want 遵循结构化日志规范, so that 便于排查问题 [第9轮新增 CON]

## 2. 需求清单

### 2.1 功能需求

| 需求 ID | 模块 | 需求描述 | 优先级 | 验收标准 |
|---|---|---|---|---|
| REQ-001 | 系统 | 博客系统后端（系统根需求） | 高 | 系统启动后监听 3000 端口，健康检查 GET /health 返回 200 |
| REQ-002 | 用户 | 用户注册（邮箱+密码+角色） | 高 | POST /api/users/register 接收 email/password/role，返回 201 与用户 ID；邮箱重复返回 409 |
| REQ-003 | 用户 | 用户登录（JWT 签发） | 高 | POST /api/users/login 接收 email/password，校验通过返回 JWT token（HS256，1 小时有效期）；密码错误返回 401 |
| REQ-004 | 用户 | 用户角色权限（admin/author/reader） | 高 | 三种角色：admin 全权限、author 可管理自己的文章/评论、reader 只读+评论；越权返回 403 |
| REQ-005 | 文章 | 文章创建（标题+正文+标签+分类） | 高 | POST /api/articles 接收 title/content/tags/categories，返回 201 与文章 ID；需 author/admin 角色 |
| REQ-006 | 文章 | 文章列表查询（分页+排序） | 中 | GET /api/articles?page=1&limit=10&sort=createdAt:desc 返回分页列表，total/totalPages/items |
| REQ-007 | 文章 | 文章详情查询（按 ID） | 高 | GET /api/articles/:id 返回文章详情；不存在返回 404 |
| REQ-008 | 文章 | 文章更新（权限校验） | 高 | PUT /api/articles/:id，仅作者本人或 admin 可修改；非本人返回 403 |
| REQ-009 | 文章 | 文章删除（权限校验） | 高 | DELETE /api/articles/:id，仅作者本人或 admin 可删除；非本人返回 403 |
| REQ-010 | 评论 | 评论创建（关联文章+用户） | 高 | POST /api/articles/:id/comments 接收 content，返回 201 与评论 ID；文章不存在返回 404 |
| REQ-011 | 评论 | 评论列表查询（按文章） | 中 | GET /api/articles/:id/comments 返回该文章的评论列表，按 createdAt 升序 |
| REQ-012 | 评论 | 评论删除（权限校验） | 高 | DELETE /api/comments/:id，仅评论作者或 admin 可删除；非本人返回 403 |
| REQ-013 | 标签 | 标签管理（增删改查） | 中 | GET/POST/PUT/DELETE /api/tags，admin 角色可增删改，所有角色可查 |
| REQ-014 | 分类 | 分类管理（增删改查） | 中 | GET/POST/PUT/DELETE /api/categories，admin 角色可增删改，所有角色可查 |
| REQ-015 | 搜索 | 文章搜索（关键词+标签+分类） | 中 | GET /api/search?q=keyword&tag=tag1&category=cat1 返回匹配文章列表 |
| REQ-016 | 用户 | 密码重置（邮箱验证流程）[第9轮新增] | 高 | POST /api/users/password/reset-request 接收 email 返回重置 token；POST /api/users/password/reset 接收 token+newPassword 完成重置 |
| REQ-017 | 文章 | 文章草稿/发布工作流（状态机：draft→published）[第9轮新增] | 高 | POST /api/articles 创建默认 draft；POST /api/articles/:id/publish 转 published；POST /api/articles/:id/unpublish 转 draft；GET /api/articles 仅返回 published（admin 可见 draft） |
| REQ-018 | 文章 | 文章点赞（去重+计数）[第9轮新增] | 中 | POST /api/articles/:id/like 切换点赞状态（已点赞则取消）；返回 likeCount；同一用户对同一文章去重 |
| REQ-019 | 审计 | 审计日志（关键操作记录）[第9轮新增] | 高 | 记录登录/注册/文章增删改/评论增删/密码重置等关键操作，含 userId/action/resource/ip timestamp；GET /api/audit-logs 仅 admin 可访问，支持分页 |
| REQ-020 | 订阅 | RSS 订阅源（Atom 格式输出）[第9轮新增] | 中 | GET /api/rss 返回 Atom XML 格式的最新 20 篇 published 文章；Content-Type: application/atom+xml |
| REQ-021 | 用户 | 用户资料管理（昵称+头像+简介） | 中 | PUT /api/users/profile 接收 nickname/avatar/bio，更新当前用户资料；GET /api/users/:id/profile 查询用户公开资料 |
| REQ-022 | 文章 | 文章归档查询（按月份分组） | 低 | GET /api/articles/archive 返回 [{year,month,count}] 数组，按时间倒序 |

### 2.2 非功能需求

| 需求 ID | 类别 | 描述 | 指标 |
|---|---|---|---|
| NFR-001 | 性能 | API 响应时间 | P95 < 200ms（内存存储，单实例） |
| NFR-002 | 安全 | JWT 密钥强度 | HS256，密钥长度 ≥ 256 位（32 字节） |
| NFR-003 | 可用性 | 错误处理 | 100% 接口统一错误响应格式 {error:{code,message}}，无未捕获异常 |
| NFR-004 | 性能 | 内存存储容量 | 单表支持 ≥ 10000 条记录，查询性能无明显下降 |
| NFR-005 | 安全 | 输入验证 | 100% 接口使用 zod schema 校验请求体/参数 |
| NFR-006 | 性能 | API 限流 [第9轮新增] | 每用户 60 次/分钟（基于 JWT userId），超出返回 429 |

### 2.3 约束需求

| 需求 ID | 类别 | 描述 |
|---|---|---|
| CON-001 | 技术栈 | Express 4 + TypeScript 5 + 内存存储（Map），不使用外部数据库 |
| CON-002 | 认证 | JWT（HS256），access token 有效期 1 小时，密钥从环境变量 JWT_SECRET 读取 |
| CON-003 | 编码规范 | TypeScript strict mode，0 编译错误，禁用 any |
| CON-004 | 日志规范 [第9轮新增] | 结构化 JSON 日志（level+timestamp+message+meta），审计日志独立存储 |

## Out of Scope

- 前端界面（本项目仅后端 API）
- 持久化数据库（仅内存存储，重启数据丢失）
- 邮件真实发送（密码重置仅返回重置 token，不实际发邮件）
- 文件上传（头像用 URL 字符串表示，不实现上传接口）
- Refresh token 机制（仅 access token，过期需重新登录）
- WebSocket 实时推送（点赞/评论不实时推送）

## Implementation Decisions

- 采用 Express 4 Router 按模块拆分路由（users/articles/comments/tags/categories/search/audit/rss）
- 内存存储使用 Map 数据结构，每个实体一个 Map（users/articles/comments/tags/categories/auditLogs/likes）
- 认证中间件统一校验 JWT，注入 req.user = {id, role}
- 错误处理中间件统一捕获，返回 {error:{code,message}} 格式
- 文章状态机使用字面量联合类型 'draft' | 'published'，通过显式状态转换接口
- 点赞使用 Set 数据结构存储 articleId → Set<userId>，保证去重
- RSS 输出使用模板字符串拼接 Atom XML（不引入额外 XML 库）
- 限流使用滑动窗口算法（Map<userId, number[]> 存储时间戳）

## Testing Decisions

- 测试框架：Vitest + supertest（HTTP 接口测试）
- 测试分层：单元测试（逻辑层）+ 集成测试（模块间）+ 系统测试（端到端）+ 验收测试（UAT）
- 阶段 1 仅设计验收测试用例（UAT-001~UAT-022），执行在阶段 8
- 内存存储天然隔离，每个测试用例独立 setup/teardown
- JWT_SECRET=test-secret-blog-demo 用于测试环境

## 3. 需求完整性检查

| 检查项 | 状态 | 说明 |
|---|---|---|
| 功能需求闭环 | ✅ | 22 REQ 覆盖用户/文章/评论/标签/分类/搜索/密码重置/草稿发布/点赞/审计/RSS/资料/归档全场景 |
| 非功能需求覆盖 | ✅ | 6 NFR 覆盖性能/安全/可用性/限流 |
| 约束需求覆盖 | ✅ | 4 CON 覆盖技术栈/认证/编码/日志 |
| 冲突检测 | ✅ | 0 冲突（草稿/发布状态机与文章 CRUD 正交；点赞与评论独立） |

## 4. 需求风险评估

| 风险 ID | 风险描述 | 等级 | 缓解措施 |
|---|---|---|---|
| RISK-001 | 内存存储重启数据丢失 | 中 | 明确约束 CON-001 声明，文档与 README 提示 |
| RISK-002 | JWT 密钥泄露 | 高 | 密钥从环境变量读取，.env.example 提供示例，.gitignore 排除 .env |
| RISK-003 | 草稿/发布状态机并发冲突 | 中 | 状态转换通过显式接口，内存存储单线程无并发 |
| RISK-004 | 限流算法内存占用 | 低 | 滑动窗口定期清理过期时间戳 |
| RISK-005 | RSS XML 注入 | 中 | 文章内容做 XML 转义（& < > " '） |

## 5. 验收测试用例索引

> 详细用例见 [acceptance-test-cases.md](acceptance-test-cases.md)。

| 用例 ID | 关联需求 | 场景 | 优先级 |
|---|---|---|---|
| UAT-001 | REQ-001 | 系统健康检查 | 高 |
| UAT-002 | REQ-002 | 用户注册正常流程 | 高 |
| UAT-003 | REQ-003 | 用户登录正常流程 | 高 |
| UAT-004 | REQ-004 | 角色权限校验 | 高 |
| UAT-005 | REQ-005 | 文章创建正常流程 | 高 |
| UAT-006 | REQ-006 | 文章列表分页查询 | 中 |
| UAT-007 | REQ-007 | 文章详情查询 | 高 |
| UAT-008 | REQ-008 | 文章更新权限校验 | 高 |
| UAT-009 | REQ-009 | 文章删除权限校验 | 高 |
| UAT-010 | REQ-010 | 评论创建正常流程 | 高 |
| UAT-011 | REQ-011 | 评论列表查询 | 中 |
| UAT-012 | REQ-012 | 评论删除权限校验 | 高 |
| UAT-013 | REQ-013 | 标签管理 CRUD | 中 |
| UAT-014 | REQ-014 | 分类管理 CRUD | 中 |
| UAT-015 | REQ-015 | 文章搜索 | 中 |
| UAT-016 | REQ-016 | 密码重置流程 [第9轮新增] | 高 |
| UAT-017 | REQ-017 | 草稿/发布工作流 [第9轮新增] | 高 |
| UAT-018 | REQ-018 | 文章点赞去重 [第9轮新增] | 中 |
| UAT-019 | REQ-019 | 审计日志记录与查询 [第9轮新增] | 高 |
| UAT-020 | REQ-020 | RSS 订阅输出 [第9轮新增] | 中 |
| UAT-021 | REQ-021 | 用户资料管理 | 中 |
| UAT-022 | REQ-022 | 文章归档查询 | 低 |
