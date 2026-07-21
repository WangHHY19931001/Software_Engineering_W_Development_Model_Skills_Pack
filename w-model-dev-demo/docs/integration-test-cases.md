# 集成测试用例文档

> 阶段 6（集成测试）产出。集成测试用例 IT-001~006 已在 `docs/outline-design.md §5` 设计。
> 本文件补充执行结果。

## 文档信息

- 项目名称：blog-system-demo
- 文档版本：v1.0
- 编制日期：2026-07-21
- 编制者：W-Model Agent
- 关联设计：`docs/outline-design.md §5 集成测试用例设计`
- 测试代码：`tests/integration/integration.test.ts`

## 1. 集成测试范围

- 范围：跨模块集成测试，验证 routes → middleware → controller → service → store 的端到端契约
- 不覆盖：单元测试已覆盖的纯函数逻辑（jwt/password/zod schema）
- 工具：vitest + supertest（HTTP 端到端）

## 2. 用例清单（含执行结果）

| 用例 ID | 关联需求 | 测试目标 | 状态 | 通过数/总数 | 备注 |
|---|---|---|---|---|---|
| IT-001 | REQ-001 | 注册 + 登录模块间契约 | 通过 | 1/1 | token 可被 jwt.verify 解码；userStore 中 passwordHash 以 $2b$10$ 开头；无 password 字段 |
| IT-002 | REQ-001 | 重复注册 → ConflictError → 409 | 通过 | 1/1 | errorHandler 正确序列化 40901 |
| IT-003 | REQ-002 | 文章作者隔离（update/remove 跨用户） | 通过 | 1/1 | B 修改/删除 → 403.40301；A 修改 → 200 |
| IT-004 | REQ-003 | 公开浏览 + 评论聚合 | 通过 | 1/1 | 无 Authorization 可访问；comments 数组聚合 |
| IT-005 | REQ-004 | 评论删除作者隔离 + 文章不存在拦截 | 通过 | 1/1 | B 删除 → 403.40301；A 删除 → 204；不存在 → 404.40401 |
| IT-006 | NFR-001 | 鉴权中间件全链路（缺 token / 伪造 / 过期 / 合法） | 通过 | 1/1 | 四态分别返回 40103 / 40102 / 40102 / 201 |
| 补充-1 | NFR-003 | POST /articles 缺 title → 400 + 40001 | 通过 | 1/1 | zod schema 校验生效 |
| 补充-2 | REQ-003 | GET /articles/non-existent → 404 + 40401 | 通过 | 1/1 | NotFoundError 序列化 |
| 补充-3 | REQ-003 | GET /articles 分页：3 条数据，page=1,pageSize=2 | 通过 | 1/1 | {items:2, total:3, page:1, pageSize:2} |
| 补充-4 | REQ-001 | 登录密码错误 → 401 + 40101 | 通过 | 1/1 | 用 WrongPass（6+ 字符，绕开 zod） |
| 补充-5 | REQ-001 | 登录不存在的用户 → 401 + 40101 | 通过 | 1/1 | 40101 业务码一致 |
| 补充-6 | NFR-003 | 注册参数非法（短用户名） → 400 + 40001 | 通过 | 1/1 | zod min(3) 校验生效 |
| 补充-7 | NFR-001 | bcrypt cost=10 + password 字段不存储 | 通过 | 1/1 | bcrypt.getRounds===10；user.password===undefined |

## 3. 执行命令

```bash
npm run test:integration
# 等价于：cross-env JWT_SECRET=test-secret-blog-demo vitest run tests/integration
```

## 4. 执行结果

```
Test Files  1 passed (1)
     Tests  13 passed (13)
```

- 总数：13
- 通过：13
- 失败：0
- 跳过：0

## 5. 覆盖说明

### 5.1 错误码覆盖

| 业务码 | HTTP 状态 | 触发用例 |
|---|---|---|
| 40001 | 400 | 补充-1（缺 title）、补充-6（短用户名） |
| 40101 | 401 | 补充-4（密码错误）、补充-5（用户不存在） |
| 40102 | 401 | IT-006（伪造 + 过期 token） |
| 40103 | 401 | IT-006（无 Authorization） |
| 40301 | 403 | IT-003（文章 update/remove 跨用户）、IT-005（评论删除跨用户） |
| 40401 | 404 | 补充-2（GET 不存在文章）、IT-005（POST 不存在文章评论） |
| 40901 | 409 | IT-002（重复注册） |

### 5.2 模块间契约覆盖

- routes → middleware → controller → service → store 全链路：IT-001、IT-003、IT-004
- errorHandler 序列化所有 HttpError 子类：IT-002、IT-003、IT-005、IT-006、补充-1~7
- zod schema 入参校验：补充-1、补充-6
- bcrypt + JWT 安全契约：IT-001、IT-006、补充-7

## 6. 阶段 6 自检清单

- [x] 集成测试覆盖所有模块间契约（6 条 IT + 7 条补充 = 13 条）
- [x] 所有错误码（40001/40101/40102/40103/40301/40401/40901）在 HTTP 层验证
- [x] supertest 端到端，无 mock 中间件 / service / store
- [x] 13/13 全部通过
- [x] RTM executionSummary.integrationTest 已更新

## 7. 阶段完成摘要

- 产物路径：
  - `tests/integration/integration.test.ts`（13 条测试）
  - `docs/integration-test-cases.md`（本文件，含执行结果）
  - `docs/integration-test-report.md`（执行报告）
  - `.w-model/rtm.json`（已更新 integrationTest 执行汇总）
- 执行结果：13 passed / 0 failed / 0 skipped
- 阻塞项：无
- 下一步：进入阶段 7（系统测试）
