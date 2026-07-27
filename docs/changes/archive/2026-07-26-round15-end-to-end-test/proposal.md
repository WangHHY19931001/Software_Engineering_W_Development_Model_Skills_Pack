# Proposal：扩展博客系统后端

> 阶段 1 需求规格的「问题陈述 + 解决方案 + User Stories + Out of Scope」节抽取。

## 问题陈述

构建一个扩展博客系统后端，支持博文 CRUD、博主/用户双账号体系、评论审核、通知、全文搜索、标签、分类树、推荐、广告位、访问统计、站点配置、管理员管理、审计日志等 13 个功能领域，共 32 项需求（22 REQ + 6 NFR + 4 CON）。

系统须满足：
- 性能：API 响应时间 P95 ≤ 200ms（1000 请求压测）
- 可用性：API 错误率 ≤ 0.1%（1000 请求基准）
- 安全：JWT 鉴权 + bcrypt 密码哈希 + Zod 输入校验 + 角色权限矩阵
- 可维护性：TypeScript 5 strict 模式 + 模块化分层 + 无 any
- 限流：每客户端 100 请求/分钟（内存令牌桶），超限返回 429

## 解决方案

采用 Express 4 + TypeScript 5 strict + 内存存储（Map）技术栈，Modular Monolith 架构风格，单进程事件循环。

### 架构分层

- **控制器层（controller）**：13 个控制器，处理 HTTP 请求/响应
- **服务层（service）**：19 个服务，封装业务逻辑
- **存储层（store）**：12 个内存存储，数据持久化
- **中间件层（middleware）**：4 个中间件（auth/error/perf/security）
- **工具层（util）**：7 个工具（bcrypt/jwt/id/env/audit-log/rate-limit/async-handler）
- **根模块**：app.ts + server.ts + schemas.ts + state-machines.ts + types.ts

### 关键技术决策

- **JWT 鉴权**：access token + 角色权限矩阵 reader/editor/admin
- **bcrypt**：cost=10 密码哈希
- **Zod**：输入校验防注入
- **令牌桶限流**：100 req/min，超限 429
- **审计日志**：30 天保留，超期自动清理
- **状态机**：博文（草稿/发布/归档）+ 评论（pending/approved/rejected）+ 用户角色

## User Stories

- 作为博主，我可以注册/登录账号，创建/发布/归档博文，管理个人资料，关注/取关其他博主
- 作为用户，我可以注册/登录账号，评论博文，接收通知，管理个人资料
- 作为管理员，我可以封禁/解封博主和用户，变更用户角色，查看审计日志
- 作为读者，我可以全文搜索博文，按标签/分类浏览，接收博文推荐
- 作为运营，我可以管理广告位与投放时段，查看访问统计，配置站点信息

## Out of Scope

- 前端界面（仅后端 API）
- 外部数据库（内存 Map 存储，进程重启数据丢失可接受）
- 消息队列（同步事件处理）
- 分布式部署（单进程）
- 中文分词器接入 jieba（简化为按字符分词）
- 持久化存储（CON-003 约束：内存存储）
