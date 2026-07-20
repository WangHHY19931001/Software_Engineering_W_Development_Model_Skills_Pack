# 测试报告

> 阶段 6（集成测试）执行产出。

## 文档信息

- 项目名称：博客系统（blog-system-demo）
- 测试类型：集成测试
- 执行阶段：阶段 6
- 执行日期：2026-07-20
- 执行者：self-as-verifier

## 1. 测试概要

| 指标 | 数值 |
|---|---|
| 用例总数 | 6 |
| 通过 | 6 |
| 失败 | 0 |
| 跳过 | 0 |
| 通过率 | 100% |
| 执行时长 | 1.18s |
| 测试框架 | vitest 1.6.1 + supertest |

## 2. 测试结果明细

| 用例 ID | 标题 | 优先级 | 状态 | 备注 |
|---|---|---|---|---|
| IT-001 | JWT 跨模块传递（M-001↔M-002） | 高 | ✅ 通过 | 注册→登录→解码 JWT payload.userId 与 article.authorId 一致 |
| IT-002 | 文章 CRUD 全流程（M-002） | 高 | ✅ 通过 | create→findById→list→update→remove→findById(404) 串联无断层 |
| IT-003 | 评论依赖文章存在校验（M-002↔M-003） | 高 | ✅ 通过 | 不存在文章 404；存在文章评论 201 |
| IT-004 | 作者隔离跨用户（M-001↔M-002） | 高 | ✅ 通过 | bob PUT/DELETE alice 文章全部 403，标题未变 |
| IT-005 | 错误中间件统一捕获（M-004↔全部） | 中 | ✅ 通过 | 401/403/404/409/400 全部返回 `{error:string}` |
| IT-006 | 删除后评论不可创建（M-002↔M-003） | 中 | ✅ 通过 | DELETE 文章后 POST 评论返回 404，无孤儿评论 |

## 3. 模块交互覆盖

| 模块交互对 | 关联用例 | 覆盖状态 |
|---|---|---|
| M-001 ↔ M-002（auth → article） | IT-001 / IT-004 | ✅ |
| M-002 内部（article CRUD） | IT-002 | ✅ |
| M-002 ↔ M-003（article → comment） | IT-003 / IT-006 | ✅ |
| M-004 ↔ 全部（错误中间件） | IT-005 | ✅ |

## 4. 错误路径覆盖

| HTTP 状态码 | 关联用例 | 覆盖状态 |
|---|---|---|
| 401 Unauthorized | IT-005 | ✅ |
| 403 Forbidden | IT-004 / IT-005 | ✅ |
| 404 Not Found | IT-002 / IT-003 / IT-005 / IT-006 | ✅ |
| 409 Conflict | IT-005 | ✅ |
| 400 Bad Request | IT-005 | ✅ |

## 5. 过程中修复的缺陷

| 缺陷 | 根因 | 修复 | 验证 |
|---|---|---|---|
| 首轮 4 个 IT 失败：NotFoundError/ForbiddenError 未被中间件捕获，表现为 Unhandled Rejection | Express 4 不自动捕获 async handler 抛出的 rejected promise | 新建 `src/utils/async-handler.ts` 包装器，包裹 `auth-routes.ts` / `article-routes.ts` / `comment-routes.ts` 全部路由 | 重跑 6/6 通过 |

## 6. 结论

- [x] 测试通过，可进入下一阶段
- [ ] 测试未通过，需回到编码实现返工
- [ ] 部分通过，遗留项：—

集成测试 6/6 通过，覆盖全部 4 对模块交互与全部 5 类错误路径。过程中发现并修复了 Express 4 async handler 不自动 catch 的关键缺陷（引入 `asyncHandler` 包装器），证明 W 模型「真实测试执行」原则的有效性。建议放行进入 Phase 7 系统测试。
