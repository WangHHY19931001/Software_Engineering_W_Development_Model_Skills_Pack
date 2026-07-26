# UAT 路径映射表

> 阶段 1（需求分析）产出初始版。设计路径列已填写，实际路径待阶段 5 编码后回填。
> 第 9 轮 W 模型端到端调测。

## 文档信息

- 项目名称：blog-system-demo
- 文档版本：v1.0
- 编制日期：2026-07-26
- 编制者：S 子代理（阶段 1）

## 映射表

| UAT ID | 关联需求 | 测试场景 | 设计路径（API 端点） | 实际路径（代码模块） | 状态 |
|---|---|---|---|---|---|
| UAT-001 | REQ-001 | 系统健康检查 | GET /health | 待阶段5回填 | 设计完成 |
| UAT-002 | REQ-002 | 用户注册 | POST /api/users/register | 待阶段5回填 | 设计完成 |
| UAT-003 | REQ-003 | 用户登录 | POST /api/users/login | 待阶段5回填 | 设计完成 |
| UAT-004 | REQ-004 | 角色权限校验 | POST /api/articles（多角色） | 待阶段5回填 | 设计完成 |
| UAT-005 | REQ-005 | 文章创建 | POST /api/articles | 待阶段5回填 | 设计完成 |
| UAT-006 | REQ-006 | 文章列表分页 | GET /api/articles | 待阶段5回填 | 设计完成 |
| UAT-007 | REQ-007 | 文章详情查询 | GET /api/articles/:id | 待阶段5回填 | 设计完成 |
| UAT-008 | REQ-008 | 文章更新 | PUT /api/articles/:id | 待阶段5回填 | 设计完成 |
| UAT-009 | REQ-009 | 文章删除 | DELETE /api/articles/:id | 待阶段5回填 | 设计完成 |
| UAT-010 | REQ-010 | 评论创建 | POST /api/articles/:id/comments | 待阶段5回填 | 设计完成 |
| UAT-011 | REQ-011 | 评论列表查询 | GET /api/articles/:id/comments | 待阶段5回填 | 设计完成 |
| UAT-012 | REQ-012 | 评论删除 | DELETE /api/comments/:id | 待阶段5回填 | 设计完成 |
| UAT-013 | REQ-013 | 标签管理 CRUD | GET/POST/PUT/DELETE /api/tags | 待阶段5回填 | 设计完成 |
| UAT-014 | REQ-014 | 分类管理 CRUD | GET/POST/PUT/DELETE /api/categories | 待阶段5回填 | 设计完成 |
| UAT-015 | REQ-015 | 文章搜索 | GET /api/search | 待阶段5回填 | 设计完成 |
| UAT-016 | REQ-016 | 密码重置 [第9轮新增] | POST /api/users/password/reset-request, POST /api/users/password/reset | 待阶段5回填 | 设计完成 |
| UAT-017 | REQ-017 | 草稿/发布工作流 [第9轮新增] | POST /api/articles/:id/publish, POST /api/articles/:id/unpublish | 待阶段5回填 | 设计完成 |
| UAT-018 | REQ-018 | 文章点赞 [第9轮新增] | POST /api/articles/:id/like | 待阶段5回填 | 设计完成 |
| UAT-019 | REQ-019 | 审计日志 [第9轮新增] | GET /api/audit-logs | 待阶段5回填 | 设计完成 |
| UAT-020 | REQ-020 | RSS 订阅 [第9轮新增] | GET /api/rss | 待阶段5回填 | 设计完成 |
| UAT-021 | REQ-021 | 用户资料管理 | PUT /api/users/profile, GET /api/users/:id/profile | 待阶段5回填 | 设计完成 |
| UAT-022 | REQ-022 | 文章归档查询 | GET /api/articles/archive | 待阶段5回填 | 设计完成 |

## 回填规则

- 阶段 5（编码）完成后，将「实际路径」列从「待阶段5回填」更新为具体代码模块文件路径（如 src/controllers/article-controller.ts）
- 阶段 8（验收测试）执行后，将「状态」列从「设计完成」更新为「通过」或「失败」
- 回填时同步更新 .w-model/rtm.json 的 codeModule 字段
