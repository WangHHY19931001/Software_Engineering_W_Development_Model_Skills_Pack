# 验收测试报告

> 阶段 8 验收测试执行报告 + 工件质量门结果 + 项目归档

## 1. 执行环境

- 项目：blog-system-demo
- 执行日期：2026-07-21
- 执行命令：`npm run test:acceptance` + `npm test` + `npm run coverage`
- 环境变量：`JWT_SECRET=test-secret-blog-demo`
- 测试框架：vitest 1.6.1 + supertest 7.2.2
- Node.js：>= 20
- 操作系统：Windows

## 2. 验收测试执行结果

```
RUN  v1.6.1 D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev-demo

 ✓ tests/acceptance/acceptance.test.ts  (15 tests) 8480ms

 Test Files  1 passed (1)
      Tests  15 passed (15)
   Duration  9.70s
```

| 指标 | 值 |
|---|---|
| 测试文件 | 1 |
| 测试用例总数 | 15 |
| 通过 | 15 |
| 失败 | 0 |
| 跳过 | 0 |
| 总耗时 | 9.70s |
| UAT-013 P95 | 5ms (阈值 ≤ 200ms) |
| UAT-015 覆盖率 | lines=100% / branches=100% / functions=100% / statements=100% |

## 3. 用例明细

| 用例 ID | 关联需求 | 测试目标 | 结果 | 耗时 |
|---|---|---|---|---|
| UAT-001 | REQ-001 | 用户注册成功 | 通过 | ~80ms |
| UAT-002 | REQ-001 | 登录返回 JWT（exp - iat === 3600） | 通过 | ~50ms |
| UAT-003 | REQ-001 | 错误密码登录 → 401.40101 | 通过 | ~80ms |
| UAT-004 | REQ-002 | 创建文章 → 201 + authorId=JWT.userId | 通过 | ~60ms |
| UAT-005 | REQ-002 | 修改自己文章 → 200；updatedAt > createdAt | 通过 | ~80ms |
| UAT-006 | REQ-002 | 删除自己文章 → 204；二次 GET → 404 | 通过 | ~60ms |
| UAT-007 | REQ-003 | 公开列表分页：15 篇 → 10 + 5 | 通过 | ~200ms |
| UAT-008 | REQ-003+004 | 文章详情 + 评论聚合升序 | 通过 | ~150ms |
| UAT-009 | REQ-004 | 发表评论 → 201 + authorId=JWT.userId | 通过 | ~80ms |
| UAT-010 | REQ-004 | 公开评论列表（未认证） | 通过 | ~80ms |
| UAT-011 | NFR-001 | bcrypt cost=10 + 无明文 | 通过 | ~80ms |
| UAT-012 | NFR-001 | 过期 JWT → 401.40102 | 通过 | ~50ms |
| UAT-013 | NFR-002 | 1000 篇文章 200 采样 P95 ≤ 200ms | 通过 | ~4000ms（P95=5ms） |
| UAT-014 | NFR-003 | tsc --noEmit 退出码 0 | 通过 | ~3000ms |
| UAT-015 | NFR-004 | 覆盖率 ≥ 80%（4 维度） | 通过 | ~500ms（实测 100%） |

## 4. 全量测试执行结果（四级测试汇总）

执行命令：`npm test`

```
Test Files  14 passed (14)
      Tests  107 passed (107)
   Duration  9.92s
```

| 测试级别 | 文件数 | 用例数 | 通过 | 失败 |
|---|---|---|---|---|
| 单元测试 (UT) | 11 | 71 | 71 | 0 |
| 集成测试 (IT) | 1 | 13 | 13 | 0 |
| 系统测试 (ST) | 1 | 8 | 8 | 0 |
| 验收测试 (UAT) | 1 | 15 | 15 | 0 |
| **总计** | **14** | **107** | **107** | **0** |

## 5. 覆盖率执行结果

执行命令：`npm run coverage`

```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |     100 |      100 |     100 |     100 |
 middleware        |     100 |      100 |     100 |     100 |
  auth.ts          |     100 |      100 |     100 |     100 |
  error-handler.ts |     100 |      100 |     100 |     100 |
  validate.ts      |     100 |      100 |     100 |     100 |
 services          |     100 |      100 |     100 |     100 |
  article.service.ts |     100 |      100 |     100 |     100 |
  comment.service.ts |     100 |      100 |     100 |     100 |
  user.service.ts  |     100 |      100 |     100 |     100 |
 stores            |     100 |      100 |     100 |     100 |
  article.store.ts |     100 |      100 |     100 |     100 |
  comment.store.ts |     100 |      100 |     100 |     100 |
  user.store.ts    |     100 |      100 |     100 |     100 |
 utils             |     100 |      100 |     100 |     100 |
  async-handler.ts |     100 |      100 |     100 |     100 |
  errors.ts        |     100 |      100 |     100 |     100 |
  jwt.ts           |     100 |      100 |     100 |     100 |
  password.ts      |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
```

| 维度 | 阈值 | 实测 | 结论 |
|---|---|---|---|
| Statements | ≥ 80% | 100% | ✓ |
| Branches | ≥ 80% | 100% | ✓ |
| Functions | ≥ 80% | 100% | ✓ |
| Lines | ≥ 80% | 100% | ✓ |

## 6. 工件质量门校验

执行命令：`npx tsx ../w-model-dev/scripts/check-artifact-gate.ts .`

```
════════════════════════════════════════════════════════════
工件质量门校验（Artifact Gate）
════════════════════════════════════════════════════════════
项目目录      : .
RTM 文件      : D:\w_skill_opt\Software_Engineering_W_Development_Model_Skills_Pack\w-model-dev-demo\.w-model\rtm.json
RTM 覆盖率    : 100%
单元覆盖率    : 100%
校验结果      : ✓ 通过
────────────────────────────────────────────────────────────
所有放行条件均满足：RTM 需求覆盖率 100% 且四级测试全部通过。
────────────────────────────────────────────────────────────
GATE_JSON {"type":"artifact","passed":true,"coveragePercent":100,"unitCoveragePercent":100,"missingItems":[],"reasons":[]}
```

退出码：0

## 7. RTM 终检

| 检查项 | 结果 |
|---|---|
| 需求行数 | 8 (REQ-001~004 + NFR-001~004) |
| 7 字段全部非空 | ✓ |
| 需求 ID 唯一 | ✓ |
| RTM 覆盖率 | 100% |
| unitTest 汇总 | total=71 / passed=71 / failed=0 / pending=0 / coverage=100 |
| integrationTest 汇总 | total=13 / passed=13 / failed=0 / pending=0 / coverage=100 |
| systemTest 汇总 | total=8 / passed=8 / failed=0 / pending=0 / coverage=100 |
| acceptanceTest 汇总 | total=15 / passed=15 / failed=0 / pending=0 / coverage=100 |
| 计数守恒 (passed+failed+pending=total) | ✓ 四级均满足 |
| 单元覆盖率 ≥ 80% | ✓ (100%) |

## 8. 4 项历史修复回归验证

| 修复项 | 验证位置 | 状态 |
|---|---|---|
| #1 async-handler 包装所有 async handler | src/routes/*.routes.ts (3 个文件，全部 asyncHandler 包装) | ✓ |
| #2 JWT_SECRET 从 process.env 读取 | src/utils/jwt.ts:8-11 (getSecret 函数) | ✓ |
| #3 ArticleService `export class` | src/services/article.service.ts:9 (export class ArticleService) | ✓ |
| #4 vitest mock 类型断言 | tests/unit/validate.test.ts:15-19 (ReturnType<typeof vi.fn>) | ✓ |

## 9. 用户确认区

> 工件质量门已通过。请用户在下表填写 `confirm` 完成项目归档。

| 项 | 内容 |
|---|---|
| 项目名 | blog-system-demo |
| 工件质量门结果 | ✓ 通过（exit 0） |
| RTM 覆盖率 | 100% |
| 四级测试通过率 | 107/107 (100%) |
| 单元覆盖率 | 100%（4 维度） |
| 用户确认 | confirm |

## 10. 项目归档清单

| 类别 | 文件 | 状态 |
|---|---|---|
| 阶段 1 产物 | docs/requirement-spec.md | ✓ |
| 阶段 2 产物 | docs/system-design.md | ✓ |
| 阶段 3 产物 | docs/outline-design.md | ✓ |
| 阶段 4 产物 | docs/detailed-design.md | ✓ |
| 阶段 5 产物 | src/*.ts (26 个文件) | ✓ |
| 阶段 5 产物 | tests/unit/*.test.ts (11 个文件) | ✓ |
| 阶段 6 产物 | tests/integration/integration.test.ts | ✓ |
| 阶段 6 产物 | docs/integration-test-cases.md | ✓ |
| 阶段 6 产物 | docs/integration-test-report.md | ✓ |
| 阶段 7 产物 | tests/system/system.test.ts | ✓ |
| 阶段 7 产物 | tests/perf/k6-load-test.js | ✓ |
| 阶段 7 产物 | tests/perf/README.md | ✓ |
| 阶段 7 产物 | docs/system-test-cases.md | ✓ |
| 阶段 7 产物 | docs/system-test-report.md | ✓ |
| 阶段 8 产物 | tests/acceptance/acceptance.test.ts | ✓ |
| 阶段 8 产物 | docs/uat-test-cases.md | ✓ |
| 阶段 8 产物 | docs/acceptance-test-report.md (本文件) | ✓ |
| RTM | .w-model/rtm.json | ✓ |
| 配置 | package.json / tsconfig.json / vitest.config.ts | ✓ (保留) |

## 11. 阻塞与异常

无。所有验收用例一次通过；4 项历史修复全部回归验证通过；工件质量门退出码 0。

## 12. 结论

W 模型 8 阶段端到端调测全部完成。项目可归档。
