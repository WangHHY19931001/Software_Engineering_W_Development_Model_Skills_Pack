# Design：技术决策摘要

> 阶段 2-4 设计产物的技术决策摘要（不含具体文件路径，符合 OpenSpec 与 to-spec 共识）。

## 架构风格

- **Modular Monolith**：单进程事件循环，模块化分层
- **分层架构**：controller → service → store → util
- **内存存储**：Map 数据结构，进程重启数据丢失可接受（CON-003 约束）

## 子系统分解（13 个）

| 子系统 | 职责 | 关联 REQ |
|---|---|---|
| S01 博客 | 博文 CRUD + 状态机 + 引用 | REQ-001,002,003 |
| S02 博主 | 注册/登录/资料/关注/管理 | REQ-004,005,006,020 |
| S03 用户 | 注册/登录/资料/角色/管理 | REQ-007,008,009,021 |
| S04 评论 | CRUD + 审核状态机 | REQ-010,011 |
| S05 通知 | 评论/关注/系统通知 | REQ-012 |
| S06 搜索 | 全文搜索（内存索引） | REQ-013 |
| S07 标签 | 创建/列表/关联博文 | REQ-014 |
| S08 分类 | 层级分类树（DFS 环检测） | REQ-015 |
| S09 推荐 | 阅读量+标签匹配 Top N | REQ-016 |
| S10 广告 | 广告位 CRUD + 时段重叠检测 | REQ-017 |
| S11 统计 | 访问量聚合（博文/日/小时） | REQ-018 |
| S12 站点 | 站点配置管理 | REQ-019 |
| S13 审计 | 审计日志 + 30 天保留清理 | REQ-022,CON-004 |

## 接口契约（22 INTF）

- 22 个 INTF 一一对应 REQ-001~REQ-022
- 错误码三段位分层：4xx（客户端）/5xx（服务端）/6xxxx（业务）
- JWT 鉴权中间件保护全部受保护接口
- 令牌桶限流中间件（100 req/min）保护全部接口

## 状态机设计

| 状态机 | 状态枚举 | 转移规则 |
|---|---|---|
| 博文状态机 | draft/published/archived | draft→published→archived→published（重新发布） |
| 评论审核状态机 | pending/approved/rejected | pending→approved（不可逆）/ pending→rejected（不可逆） |
| 用户角色 | reader/editor/admin | admin 可变更角色 |
| 用户会话 | active/expired/revoked | JWT 过期/吊销 |

## 算法设计

| 算法 | 用途 | 复杂度 |
|---|---|---|
| DFS 三色染色 | 模块调用关系环检测 | O(V+E) |
| DFS 环检测 | 引用链环检测 | O(V+E) |
| DFS 环检测 | 分类树环检测 | O(V+E) |
| 区间相交 | 广告时段重叠检测 | O(n log n) |
| Jaccard 相似度 | 标签匹配度计算 | O(m+n) |
| log 缩放 | 阅读量归一化 | O(1) |
| 令牌桶 | 限流（100 req/min） | O(1) |

## 数据模型（内存 Map 视角）

- 16 集合：posts, bloggers, users, comments, notifications, tags, categories, adSlots, stats, siteConfig, auditLogs, postRefs, bloggerFollows, sessions, searchIndex, recommendations
- 13 索引：按 authorId/userId/postId/status/createdAt 等建立辅助索引

## 安全设计

- **JWT 鉴权**：access token + 角色权限矩阵 reader/editor/admin
- **bcrypt**：cost=10 密码哈希（非明文）
- **Zod**：输入校验防 SQL 注入/XSS/路径穿越
- **安全头**：helmet-style 中间件
- **错误码**：结构化错误码（6xxxx 业务错误码 + 4xx/5xx HTTP 状态码）

## 测试 seam 决策

- **公共 API 即 seam**：HTTP API 作为主要测试 seam
- **DB seam**：通过 store 的 getter 暴露内部状态供测试校验
- **不引入新 seam**：阶段 4 后禁止引入新 seam，须显式声明理由

## 性能基线

- **P95 ≤ 200ms**（1000 请求压测）
- **内存 ≤ 100MB**（heapUsed）
- **错误率 0%**（1000 请求基准）
- **限流 100 req/min**（令牌桶，超限 429）
