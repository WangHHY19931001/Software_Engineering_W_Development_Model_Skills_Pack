# 集成测试报告

> 阶段 6（集成测试）执行产物。套用 `templates/test-report.md` 模板，类型=集成测试。
> 设计来源：阶段 3 产出的 `docs/integration-test-cases.md`（IT-001 ~ IT-014）。
> 执行阶段：阶段 6。零 mock，真实模块间调用。

## 文档信息

- 项目名称：blog-system-demo
- 测试类型：集成测试
- 设计来源阶段：阶段 3（概要设计）
- 执行阶段：阶段 6（集成测试）
- 文档版本：v1.0
- 关联接口设计：docs/outline-design.md
- 关联需求：REQ-001 ~ REQ-005
- 执行时间：2026-07-24T12:21:00Z

## 1. 执行摘要

| 项目 | 结果 |
|---|---|
| 测试运行器 | vitest 1.6.1 |
| 测试文件 | tests/integration/integration.test.ts |
| 测试用例数（IT 设计） | 14（IT-001 ~ IT-014） |
| vitest `it` 块数 | 21 |
| 通过 | 21 |
| 失败 | 0 |
| 跳过 | 0 |
| 通过率 | 100% |
| 退出码 | 0 |
| 执行耗时 | 633ms（tests） / 1.86s（total） |
| TypeScript 编译 | `npx tsc --noEmit` 退出码 0，0 错误 |
| Mock 使用 | 零 mock（符合阶段6硬约束） |
| 环境变量 | JWT_SECRET=test-secret-blog-demo |

### 1.1 真实执行命令与输出

集成测试执行命令：
```bash
npx cross-env JWT_SECRET=test-secret-blog-demo npx vitest run tests/integration
```

执行输出（关键行）：
```
 ✓ tests/integration/integration.test.ts  (21 tests) 633ms

 Test Files  1 passed (1)
      Tests  21 passed (21)
   Start at  10:21:25
   Duration  1.86s
```

退出码：`0`

TypeScript 编译检查命令：
```bash
npx tsc --noEmit
```
退出码：`0`（零编译错误，符合 NFR-004 strict 模式 0 错误约束）

## 2. 用例执行结果

### 2.1 用例结果汇总

| 用例 ID | 标题 | 优先级 | 关联需求/设计 | 模块交互对 | 结果 | vitest it 数 |
|---|---|---|---|---|---|---|
| IT-001 | 注册正向链路（控制器→服务→存储贯通） | 高 | REQ-002 / INTF-AUTH-* | 控制器↔服务↔存储 | ✓ 通过 | 1 |
| IT-002 | 注册异常——用户名已存在 | 高 | REQ-002 / INTF-AUTH-API→SERVICE | 控制器↔服务 | ✓ 通过 | 1 |
| IT-003 | 登录正向链路（bcrypt 比对 + JWT 签发） | 高 | REQ-002 / INTF-AUTH-* | 控制器↔服务↔工具 | ✓ 通过 | 1 |
| IT-004 | 登录异常——密码错误 | 高 | REQ-002 / INTF-AUTH-SERVICE | 控制器↔服务 | ✓ 通过 | 1 |
| IT-005 | 发布文章正向链路（auth→控制器→服务→存储） | 高 | REQ-003 / INTF-ARTICLE-* | 中间件↔控制器↔服务↔存储 | ✓ 通过 | 1 |
| IT-006 | 发布文章异常——无 JWT 鉴权失败 | 高 | REQ-003 / INTF-AUTH-MW | 中间件链 | ✓ 通过 | 1 |
| IT-007 | 文章列表查询——普通用户过滤 rejected | 高 | REQ-003/005 / INTF-ARTICLE-SERVICE | 服务↔存储 | ✓ 通过 | 1 |
| IT-008 | 评论正向链路（跨模块 comment→article→store） | 高 | REQ-004 / INTF-COMMENT-* | 跨模块调用 | ✓ 通过 | 1 |
| IT-009 | 评论异常——文章不存在（跨模块调用异常路径） | 高 | REQ-004 / INTF-COMMENT→ARTICLE | 跨模块调用 | ✓ 通过 | 1 |
| IT-010 | 审核正向链路（admin→review.service→article.store） | 高 | REQ-005 / INTF-REVIEW-SERVICE | 跨模块调用↔存储 | ✓ 通过 | 1 |
| IT-011 | 审核异常——非 admin 角色被拒 | 高 | REQ-005 / INTF-AUTH-MW | 中间件链 | ✓ 通过 | 1 |
| IT-012 | 审核异常——文章状态非 pending（状态机约束） | 高 | REQ-005 / INTF-REVIEW-SERVICE | 服务↔存储 | ✓ 通过 | 1 |
| IT-013 | 参数校验——zod 非法输入返回 400 | 高 | REQ-002/003 / INTF-VALIDATE-MW | 中间件链 | ✓ 通过 | 3 |
| IT-014 | 错误处理 fallback——error.middleware 捕获非 AppError | 中 | REQ-001 / DD-ERROR-MW | 中间件链 | ✓ 通过 | 2 |
| 汇总 | — | — | — | — | 14/14 通过 | 21 |

### 2.2 模块交互对覆盖（4 对）

| 交互对 | 验证用例 | 验证方式 |
|---|---|---|
| 控制器↔服务 | IT-001/003/005/008/010 | HTTP 请求经路由→控制器→服务，断言响应状态码与 body |
| 服务↔存储 | IT-001/005/007/008/010 | 直接调用 `userStore.findById` / `articleStore.findById` / `articleStore.findAll` / `commentStore.findByArticle` 验证存储层状态 |
| 中间件链（auth/validate/admin-guard/error.handler） | IT-005/006/011/013/014 | 无 JWT→401、非 admin→403、非法参数→400、malformed JSON→500 |
| 跨模块调用（comment.service→article.service；review.service→article.store） | IT-008/009/010/012 | 评论依赖文章存在性校验；审核依赖文章状态机流转 |

### 2.3 错误路径覆盖（5 类）

| 错误类型 | 用例 | 状态码 | 业务码 |
|---|---|---|---|
| 鉴权失败（无 JWT） | IT-006 | 401 | 40101 |
| 权限不足（非 admin） | IT-011 | 403 | 40301 |
| 资源不存在 | IT-009 | 404 | 40401 |
| 参数校验失败（zod） | IT-013 | 400 | 40001 |
| 业务规则冲突（重复注册/状态机/重复审核） | IT-002/012 | 409 | 60001/60002 |
| 登录凭证错误 | IT-004 | 401 | 40101 |
| 通用 fallback（非 AppError） | IT-014 | 500 | 50001 |

## 3. 用例执行详情

### IT-001：注册正向链路（控制器→服务→存储贯通）
- **状态**：✓ 通过
- **验证点**：POST /api/auth/register 返回 201 + userId；`userStore.findById(userId)` 返回 User，passwordHash 为 bcrypt `$2b$` 前缀且非明文。
- **存储层验证**：`expect(user!.passwordHash).toMatch(/^\$2[ab]\$/)`

### IT-002：注册异常——用户名已存在
- **状态**：✓ 通过
- **验证点**：重复用户名注册返回 409 + code 60001。

### IT-003：登录正向链路（bcrypt 比对 + JWT 签发）
- **状态**：✓ 通过
- **验证点**：登录返回 200 + token；`jwt.verify` 解析 payload 含 userId/role；`exp - iat <= 3600`（JWT 有效期 ≤ 1 小时）。

### IT-004：登录异常——密码错误
- **状态**：✓ 通过
- **验证点**：错误密码返回 401 + code 40101，data 为 undefined。

### IT-005：发布文章正向链路（auth.middleware→控制器→服务→存储）
- **状态**：✓ 通过
- **验证点**：携带 JWT 发布文章返回 201 + pending；`articleStore.findById(articleId)` 返回 Article，status=pending，authorId=alice 的 userId。

### IT-006：发布文章异常——无 JWT 鉴权失败
- **状态**：✓ 通过
- **验证点**：无 Authorization 头返回 401 + code 40101；`articleStore.findAll()` 不含标题"无鉴权文章"。

### IT-007：文章列表查询——普通用户过滤 rejected，admin 返回全部
- **状态**：✓ 通过
- **验证点**：普通用户 HTTP 列表不含 rejected 文章标题；`articleService.list('admin')` 含全部（含 rejected）。
- **实现说明**：GET /api/articles 路由无 auth 中间件，HTTP 端 role 默认 user；admin 列表通过直接调用 `articleService.list('admin')` 验证。

### IT-008：评论正向链路（跨模块 comment.service→article.service→comment.store）
- **状态**：✓ 通过
- **验证点**：对 approved 文章评论返回 201 + commentId；`commentStore.findByArticle(articleId)` 含该评论。

### IT-009：评论异常——文章不存在（跨模块 comment.service→article.service）
- **状态**：✓ 通过
- **验证点**：对不存在文章评论返回 404 + code 40401；`commentStore.findByArticle('a-nonexistent-id-999')` 长度为 0。

### IT-010：审核正向链路（admin→review.service→article.store 状态流转）
- **状态**：✓ 通过
- **验证点**：admin approve pending 文章返回 200 + approved；审核前后 `articleStore.findById()` 状态从 pending 流转为 approved。

### IT-011：审核异常——非 admin 角色被拒（admin-guard 中间件）
- **状态**：✓ 通过
- **验证点**：普通用户调用审核接口返回 403 + code 40301；文章状态仍为 pending（未被修改）。

### IT-012：审核异常——文章状态非 pending（状态机约束）
- **状态**：✓ 通过
- **验证点**：对已 approved 文章重复审核（reject）返回 409 + code 60002；文章状态仍为 approved（不变）。

### IT-013：参数校验——zod 非法输入返回 400
- **状态**：✓ 通过（3 个 it 块）
- **验证点**：注册 username 过短 → 400 + 40001；注册 password 过短 → 400 + 40001；发布文章 title 为空 → 400 + 40001。

### IT-014：错误处理 fallback——error.middleware 捕获非 AppError
- **状态**：✓ 通过（2 个 it 块）
- **适配说明**：测试用例设计文档 IT-014 原设计 mock `INTF-ARTICLE-STORE.findById` 抛异常，但阶段6硬约束"零 mock（不得 mock 被测真实模块）"，存储为内部模块不可 mock。改用真实非 AppError 错误（malformed JSON 触发 `express.json()` SyntaxError）验证 `error.middleware` 通用 fallback（500 + 50001）+ 进程存活可继续处理后续请求。
- **验证点**：malformed JSON → 500 + 50001；错误后 `/health` 仍返回 200 + code 0（fallback 不崩溃）。

## 4. 已知偏离

### 4.1 状态码偏离（非阻断）

| 用例 | 文档预期 | 实际实现 | 处理 |
|---|---|---|---|
| IT-001 注册成功 | 200 | 201 | 以实际契约行为为准（RESTful 资源创建应返回 201），符合 `src/controllers/auth.controller.ts` 实现 |
| IT-003 登录成功 | 200 | 200 | 一致 |
| IT-005 发布文章 | 200 | 201 | 以实际契约行为为准（RESTful 资源创建应返回 201），符合 `src/controllers/article.controller.ts` 实现 |
| IT-008 添加评论 | 200 | 201 | 以实际契约行为为准（RESTful 资源创建应返回 201），符合 `src/controllers/comment.controller.ts` 实现 |

> 偏离原因：集成测试用例设计文档（阶段3产出）将成功状态码统一写为 200，而实际控制器实现遵循 RESTful 规范，资源创建类操作返回 201。以实际代码契约为准，测试通过。此偏离为设计文档与实现的轻微不一致，非阻断，不影响集成测试结论。

### 4.2 IT-014 实现方式调整

见 §3 IT-014 适配说明。原设计需 mock 存储层，因阶段6零 mock 硬约束改用真实非 AppError 错误路径验证 error.middleware fallback。覆盖目标不变（验证通用错误处理 fallback + 进程不崩溃）。

## 5. RTM 更新

`.w-model/rtm.json` 的 `executionSummary.integrationTest` 已更新：

```json
"integrationTest": {
  "total": 14,
  "passed": 14,
  "failed": 0,
  "pending": 0,
  "coverage": 100,
  "executedAt": "2026-07-24T12:21:00Z",
  "exitCode": 0,
  "testFile": "tests/integration/integration.test.ts",
  "vitestCases": 21,
  "note": "零 mock，supertest 端到端 + 直接调用真实 store/service 验证状态"
}
```

## 6. 验收标准核对

依据 `phase-6-integration-test.md` §验收标准：

- [x] 所有接口调用验证通过（IT-001/003/005/008/010 正向链路全通过）
- [x] 参数校验逻辑正确（IT-013 zod 校验 3 场景通过；IT-002/004/006/011/012 业务规则校验通过）
- [x] 模块间数据传递无误（IT-001/005/008/010 直接验证存储层状态）
- [x] 失败用例已定位根因并回归（无失败用例，0 failures）

## 7. 结论

集成测试 14 个用例（21 个 vitest `it` 块）全部通过，退出码 0，零 mock。覆盖 4 对模块交互（控制器↔服务、服务↔存储、中间件链、跨模块调用）与 5 类错误路径（鉴权失败/权限不足/资源不存在/参数校验/业务规则冲突 + 通用 fallback）。TypeScript strict 模式编译 0 错误。集成测试阶段产物符合 `phase-6-integration-test.md` 验收标准，可进入阶段门评审。
