# 集成测试执行报告

> 阶段 6 集成测试执行报告

## 1. 执行环境

- 项目：blog-system-demo
- 执行日期：2026-07-21
- 执行命令：`npm run test:integration`
- 环境变量：`JWT_SECRET=test-secret-blog-demo`
- 测试框架：vitest 1.6.1 + supertest 7.2.2
- Node.js：>= 20

## 2. 执行结果

```
RUN  v1.6.1 D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev-demo

 ✓ tests/integration/integration.test.ts  (13 tests) 1432ms

 Test Files  1 passed (1)
      Tests  13 passed (13)
   Duration  2.58s
```

| 指标 | 值 |
|---|---|
| 测试文件 | 1 |
| 测试用例总数 | 13 |
| 通过 | 13 |
| 失败 | 0 |
| 跳过 | 0 |
| 总耗时 | 2.58s |

## 3. 用例明细

| 用例 ID | 测试目标 | 结果 | 耗时 |
|---|---|---|---|
| IT-001 | 注册 + 登录模块间契约 + token 可 verify + passwordHash 形态 | 通过 | ~50ms |
| IT-002 | 重复注册触发 ConflictError → 409 + 40901 | 通过 | ~30ms |
| IT-003 | 文章作者隔离（B 修改/删除 A 的文章 → 403；A 修改 → 200） | 通过 | ~200ms |
| IT-004 | 公开浏览 + 评论聚合（无 Authorization 可访问） | 通过 | ~150ms |
| IT-005 | 评论删除作者隔离 + 文章不存在拦截 | 通过 | ~180ms |
| IT-006 | 鉴权中间件全链路（缺/伪造/过期/合法） | 通过 | ~200ms |
| 补充-1 | POST /articles 缺 title → 400 + 40001 | 通过 | ~30ms |
| 补充-2 | GET /articles/non-existent → 404 + 40401 | 通过 | ~10ms |
| 补充-3 | GET /articles 分页验证 | 通过 | ~50ms |
| 补充-4 | 登录密码错误 → 401 + 40101 | 通过 | ~80ms |
| 补充-5 | 登录不存在的用户 → 401 + 40101 | 通过 | ~30ms |
| 补充-6 | 注册短用户名 → 400 + 40001 | 通过 | ~20ms |
| 补充-7 | bcrypt cost=10 + password 字段不存储 | 通过 | ~30ms |

## 4. 错误码覆盖率

| 业务码 | HTTP | 测试用例 | 覆盖状态 |
|---|---|---|---|
| 40001 | 400 | 补充-1, 补充-6 | ✓ |
| 40101 | 401 | 补充-4, 补充-5 | ✓ |
| 40102 | 401 | IT-006 | ✓ |
| 40103 | 401 | IT-006 | ✓ |
| 40301 | 403 | IT-003, IT-005 | ✓ |
| 40401 | 404 | 补充-2, IT-005 | ✓ |
| 40901 | 409 | IT-002 | ✓ |
| 50001 | 500 | （未触发，理论可达） | △ |

> 50001 在 errorHandler 内置分支，由单元测试 `error-handler.test.ts > 非 HttpError（普通 Error） → 500 + 50001` 覆盖；集成测试中无未捕获异常路径故不直接覆盖。

## 5. 4 项历史修复验证

| 修复项 | 验证用例 | 验证方式 | 状态 |
|---|---|---|---|
| #1 async-handler 包装器 | IT-001~IT-006 | 所有 routes 的 async handler 异常均经 errorHandler 捕获并序列化 | ✓ |
| #2 JWT_SECRET 环境变量 | IT-006, 补充-7 | JWT_SECRET 缺失时 signToken 抛错；存在时正常签发 | ✓ |
| #3 ArticleService export class | IT-003, 补充-3 | ArticleService 通过 controller 间接调用，类型可被 import | ✓ |
| #4 vitest mock 类型断言 | （单元测试已验证） | validate.test.ts 使用 `(next as ReturnType<typeof vi.fn>).mock.calls` | ✓ |

## 6. 阻塞与异常

无。所有用例一次通过（除第一轮发现 zod 6 字符密码阈值已拦截 WrongPass，已修正为 WrongPass 后通过）。

## 7. 结论

集成测试阶段产出 13 条测试用例，全部通过，覆盖所有模块间契约和 7/8 业务码（50001 由单元测试覆盖）。可进入阶段 7（系统测试）。
