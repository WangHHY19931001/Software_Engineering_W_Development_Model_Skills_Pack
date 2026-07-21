# 验收测试用例文档

> 阶段 8（验收测试）产出。验收测试用例 UAT-001~015 已在 `docs/requirement-spec.md §5` 设计。
> 本文件补充执行结果。

## 文档信息

- 项目名称：blog-system-demo
- 文档版本：v1.0
- 编制日期：2026-07-21
- 编制者：W-Model Agent
- 关联需求：`docs/requirement-spec.md §5.1 验收测试用例清单`
- 测试代码：`tests/acceptance/acceptance.test.ts`

## 1. 验收测试范围

- 范围：业务验收，从用户视角验证所有 REQ + NFR 是否达成
- 不覆盖：单元测试已覆盖的方法级实现细节
- 工具：vitest + supertest + node:child_process（执行 tsc）+ fs（读取 coverage-summary）

## 2. 用例清单（含执行结果）

| 用例 ID | 关联需求 | 场景 | 状态 | 通过数/总数 | 备注 |
|---|---|---|---|---|---|
| UAT-001 | REQ-001 | 用户注册成功 | 通过 | 1/1 | 201 + {userId, username}；无 password 字段；passwordHash 以 $2b$10$ 开头 |
| UAT-002 | REQ-001 | 用户登录成功并返回 JWT | 通过 | 1/1 | 200 + token（三段式）；exp - iat === 3600 |
| UAT-003 | REQ-001 | 用户登录 - 错误密码 | 通过 | 1/1 | 401 + {code: 40101, message: "用户名或密码错误"}；无 token |
| UAT-004 | REQ-002 | 创建文章（已认证作者） | 通过 | 1/1 | 201 + {id, authorId=JWT.userId, title, content, createdAt} |
| UAT-005 | REQ-002 | 修改自己的文章 | 通过 | 1/1 | 200 + title 已更新；updatedAt > createdAt；其他字段保持 |
| UAT-006 | REQ-002 | 删除自己的文章 | 通过 | 1/1 | 204；随后 GET → 404 + 40401 |
| UAT-007 | REQ-003 | 公开列表分页浏览（未认证） | 通过 | 1/1 | 200 + 10 items；page=2 → 5 items |
| UAT-008 | REQ-003+REQ-004 | 查看文章详情 + 评论聚合 | 通过 | 1/1 | 200 + comments:[] 升序 |
| UAT-009 | REQ-004 | 已登录用户对存在文章发表评论 | 通过 | 1/1 | 201 + {id, articleId, authorId=JWT.userId, content, createdAt} |
| UAT-010 | REQ-004 | 查看文章评论列表（未认证） | 通过 | 1/1 | 200 + {items, total}；按 createdAt 升序 |
| UAT-011 | NFR-001 | 密码 bcrypt 哈希存储（无明文） | 通过 | 1/1 | $2b$10$ 开头；cost=10；无 password 字段 |
| UAT-012 | NFR-001 | JWT 过期后访问受保护资源被拒 | 通过 | 1/1 | 401 + {code: 40102, message: "JWT 已过期或无效"} |
| UAT-013 | NFR-002 | 列表接口 P95 ≤ 200ms | 通过 | 1/1 | 1000 篇文章 + 200 次采样；P95 = 5ms |
| UAT-014 | NFR-003 | tsc strict 0 错误 | 通过 | 1/1 | spawnSync npx tsc --noEmit → status=0；stderr 空 |
| UAT-015 | NFR-004 | 单元测试覆盖率 ≥ 80% | 通过 | 1/1 | lines=100% / branches=100% / functions=100% / statements=100% |

## 3. 执行命令

```bash
npm run test:acceptance
```

## 4. 执行结果

```
Test Files  1 passed (1)
     Tests  15 passed (15)
  Duration  9.70s
```

| 指标 | 值 |
|---|---|
| 测试用例总数 | 15 |
| 通过 | 15 |
| 失败 | 0 |
| 跳过 | 0 |
| UAT-013 P95 | 5ms (阈值 ≤ 200ms) |
| UAT-015 覆盖率 | lines=100% / branches=100% / functions=100% / statements=100% |

## 5. 验收标准量化（来自 requirement-spec.md §5.1）

| 验收项 | 阈值 | 实测 | 结论 |
|---|---|---|---|
| bcrypt cost | = 10 | 10 | ✓ |
| JWT exp | = 3600s | 3600s | ✓ |
| 密钥来源 | process.env.JWT_SECRET | 是 | ✓ |
| 无明文密码 | 存储中无 password 字段 | 是 | ✓ |
| P95 延迟 | ≤ 200ms | 5ms | ✓ |
| tsc 退出码 | 0 | 0 | ✓ |
| 单元覆盖率 lines | ≥ 80% | 100% | ✓ |
| 单元覆盖率 branches | ≥ 80% | 100% | ✓ |
| 单元覆盖率 functions | ≥ 80% | 100% | ✓ |
| 单元覆盖率 statements | ≥ 80% | 100% | ✓ |

## 6. 阶段 8 自检清单

- [x] 15 条 UAT 全部通过
- [x] 4 项功能需求（REQ-001~004）+ 4 项非功能需求（NFR-001~004）全覆盖
- [x] 所有验收标准量化指标全部达成
- [x] RTM executionSummary.acceptanceTest 已更新
- [x] check-artifact-gate.ts 退出码 0（见 acceptance-test-report.md §8）

## 7. 阶段完成摘要

- 产物路径：
  - `tests/acceptance/acceptance.test.ts`（15 条测试）
  - `docs/uat-test-cases.md`（本文件，含执行结果）
  - `docs/acceptance-test-report.md`（执行报告）
  - `.w-model/rtm.json`（已更新 acceptanceTest 执行汇总）
- 执行结果：15 passed / 0 failed / 0 skipped
- 量化指标：P95=5ms、tsc exit 0、覆盖率 100%
- 阻塞项：无
- 下一步：用户在 acceptance-test-report.md §9 填写 confirm 完成归档
