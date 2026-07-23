# 验收测试报告

> 阶段 8（验收测试）执行 UAT-001~015 后产出。W 模型右 V 末段，回归调测最后一关。
> 套用 `w-model-dev/templates/test-report.md` 模板，按验收测试特性扩展 §7~§9。

## 文档信息

- 项目名称：blog-system-demo
- 测试类型：验收测试（UAT）
- 执行阶段：阶段 8（验收测试）
- 执行日期：2026-07-23
- 执行者：W-Model Agent（self-as-verifier 回归调测，test_engineer persona）
- 关联 W 模型阶段：阶段 1（验收测试设计）→ 阶段 8（验收测试执行）
- 验收用例设计源：`docs/requirement-spec.md` §5.1 内嵌 UAT-001~015
- 测试代码：`tests/acceptance/acceptance.test.ts`
- 执行命令：`npm run test:acceptance`（`cross-env JWT_SECRET=test-secret-blog-demo vitest run tests/acceptance`）

## 1. 测试概要

| 指标 | 数值 |
|---|---|
| 用例总数 | 15 |
| 通过 | 15 |
| 失败 | 0 |
| 跳过 / 挂起 | 0 |
| 通过率 | 100% |
| 退出码 | 0 |
| 执行耗时 | 10.24s（tests 9.18s） |
| 单元覆盖率（NFR-004 复核） | lines 96.37% / branches 93.57% / functions 92.30% / statements 96.37%（目标 ≥ 80%） |
| 性能 P95（NFR-002 复核） | 4.64ms（目标 ≤ 200ms，10000 条数据规模） |

## 2. 测试环境

| 项 | 值 |
|---|---|
| 运行时 | Node.js（vitest 1.6.1，environment=node） |
| 测试框架 | vitest 1.6.1 + supertest 7.2.2 |
| 被测对象 | 真实 Express app（`createApp()`），无任何 mock 替代被测模块 |
| 鉴权密钥 | `process.env.JWT_SECRET=test-secret-blog-demo`（cross-env 注入，非硬编码） |
| 存储介质 | 内存 Map（UserStore / ArticleStore / CommentStore 真实实例） |
| 隔离策略 | 每个 `it` 前 `deps.*Store.clear()` 清空内存存储 |
| 操作系统 | Windows |
| 工作目录 | `w-model-dev-demo` |

## 3. 测试结果明细

| 用例 ID | 关联需求 | 标题 | 优先级 | 状态 | 证据 |
|---|---|---|---|---|---|
| UAT-001 | REQ-001 | 用户注册成功 | 高 | ✅ 通过 | POST /auth/register → 201；userId 匹配 UUID v4；username=alice；响应无 password 字段；存储 passwordHash 匹配 `^$2b$10$` |
| UAT-002 | REQ-001 | 用户登录成功并返回 JWT | 高 | ✅ 通过 | POST /auth/login → 200；token 三段式；expiresIn=3600；`jwt.decode` 得 exp-iat===3600 |
| UAT-003 | REQ-001 | 用户登录 - 错误密码 | 高 | ✅ 通过 | POST /auth/login → 401；code=40101；message=「用户名或密码错误」；不返回 token |
| UAT-004 | REQ-002 | 创建文章（已认证作者） | 高 | ✅ 通过 | POST /articles → 201；articleId 匹配 UUID v4；authorId=JWT.userId；title/content/tags 一致；createdAt 有值 |
| UAT-005 | REQ-002 | 修改自己文章 + 非作者修改被拒 | 高 | ✅ 通过 | 非作者 PUT → 403 + 40301；作者 PUT → 200，title 更新，updatedAt≥createdAt |
| UAT-006 | REQ-002 | 删除自己文章 + 非作者删除被拒 | 高 | ✅ 通过 | 非作者 DELETE → 403 + 40301；作者 DELETE → 204；删除后 GET → 404 + 40401 |
| UAT-007 | REQ-003 | 公开列表分页浏览（未认证） | 高 | ✅ 通过 | 无 Authorization GET → 200；page=1 items=10/total=15；page=2 items=5 |
| UAT-008 | REQ-003, REQ-004 | 查看文章详情 + 评论聚合 | 高 | ✅ 通过 | GET /articles/:id → 200；comments.length≥2；按 createdAt 升序 |
| UAT-009 | REQ-004 | 已登录用户对存在文章发表评论 | 高 | ✅ 通过 | POST /articles/:id/comments → 201；commentId 匹配 UUID v4；authorId=JWT.userId（不取自 body） |
| UAT-010 | REQ-004 | 删除自己评论 + 删除他人评论被拒 | 高 | ✅ 通过 | 他人 DELETE /comments/:id → 403 + 40301；自己 DELETE → 204；详情评论列表归零 |
| UAT-011 | NFR-001 | 密码以 bcrypt 哈希存储（无明文） | 高 | ✅ 通过 | passwordHash 匹配 `^$2b$10$`；≠明文；存储无 password 字段；`getRounds===10`（真实 PasswordHasher） |
| UAT-012 | NFR-001 | JWT 过期后访问受保护资源被拒 | 高 | ✅ 通过 | 过期 JWT（exp=now-1s）POST /articles → 401 + 40102；message=「JWT 已过期或无效」；无 articleId；存储无写入 |
| UAT-013 | NFR-002 | 列表接口 P95 ≤ 200ms | 高 | ✅ 通过 | 10000 篇预置；N=150 采样；P95=4.64ms，max=6.32ms，errorRate=0，无 5xx |
| UAT-014 | NFR-003 | tsc strict 模式 0 错误 | 中 | ✅ 通过 | `npx tsc --noEmit` 退出码 0；stderr 无输出 |
| UAT-015 | NFR-004 | 单元测试覆盖率 ≥ 80% | 中 | ✅ 通过 | `npx vitest run tests/unit --coverage` 退出码 0；lines 96.37% / branches 93.57% / functions 92.30% / statements 96.37% |

## 4. 性能结果（NFR-002 验收）

| 指标 | 目标 | 实测 | 是否达标 |
|---|---|---|---|
| 读接口 P95 | ≤ 200ms | 4.64ms | ✅ |
| 最大响应时间 | — | 6.32ms | ✅ |
| 错误率（5xx） | 0 | 0 | ✅ |
| 数据规模 | 10000 篇 | 10000 篇 | ✅ |
| 采样次数 | — | 150 | ✅ |
| 进程崩溃 | 无 | 无 | ✅ |

> 说明：UAT-013 采用 vitest 内进程采样（真实 app + supertest，循环 N 次测量 P95），与系统测试 ST-004 同一既定性能测试约定。
> 规范级 k6 100QPS/10min 脚本位于 `tests/perf/k6-load-test.js`（系统测试阶段已执行，ST-004 P95=4.66ms），
> 因 k6 非 vitest 可运行依赖，验收测试以等价内进程真实采样复核 NFR-002，未使用任何 mock。

## 5. 安全结果（NFR-001 验收）

| 检查项 | 状态 | 说明 |
|---|---|---|
| 密码 bcrypt 哈希 | ✅ | UAT-011：passwordHash 匹配 `^$2b$10$`，cost=10，无明文，无 password 字段 |
| JWT 过期/无效处理 | ✅ | UAT-012：过期 JWT → 401 + 40102，受保护资源被拒 |
| 明文密码泄露 | ✅ | UAT-001/UAT-011：响应与存储序列化均无明文 |
| 密钥硬编码 | ✅ | JWT_SECRET 来自 process.env（cross-env 注入） |

## 6. 可维护性 / 可测试性结果（NFR-003 / NFR-004 验收）

| 检查项 | 目标 | 实测 | 是否达标 |
|---|---|---|---|
| tsc strict 0 错误（UAT-014） | exit 0 | exit 0，stderr 空 | ✅ |
| 单元覆盖率 lines（UAT-015） | ≥ 80% | 96.37% | ✅ |
| 单元覆盖率 branches（UAT-015） | ≥ 80% | 93.57% | ✅ |
| 单元覆盖率 functions（UAT-015） | ≥ 80% | 92.30% | ✅ |
| 单元覆盖率 statements（UAT-015） | ≥ 80% | 96.37% | ✅ |

## 7. 失败用例分析

无失败用例。15 条 UAT 全部一次通过，无需返工。

## 8. RTM 覆盖率与四级测试汇总

### 8.1 RTM 需求覆盖率

| 需求 ID | 关联 UAT | 覆盖状态 |
|---|---|---|
| REQ-001（用户认证） | UAT-001, UAT-002, UAT-003 | 完全覆盖 |
| REQ-002（文章管理） | UAT-004, UAT-005, UAT-006 | 完全覆盖 |
| REQ-003（公开浏览） | UAT-007, UAT-008 | 完全覆盖 |
| REQ-004（评论） | UAT-008, UAT-009, UAT-010 | 完全覆盖 |
| NFR-001（安全） | UAT-011, UAT-012 | 完全覆盖 |
| NFR-002（性能） | UAT-013 | 完全覆盖 |
| NFR-003（可维护性） | UAT-014 | 完全覆盖 |
| NFR-004（可测试性） | UAT-015 | 完全覆盖 |

- RTM 需求覆盖率：8/8 = **100%**（REQ-001~004 + NFR-001~004 全部有对应 UAT 且全部通过）
- 异常码覆盖：40101 / 40102 / 40301 / 40401 / 40001 全覆盖（40001 由 UAT-007/008 间接经分页边界与 ST-008 覆盖，UAT 主线聚焦验收标准）

### 8.2 四级测试汇总

| 测试级别 | 用例数 | 通过 | 失败 | 挂起 | 状态 |
|---|---|---|---|---|---|
| 单元测试（UT） | 53 | 53 | 0 | 0 | ✅ 全通过 |
| 集成测试（IT） | 13 | 13 | 0 | 0 | ✅ 全通过 |
| 系统测试（ST） | 8 | 8 | 0 | 0 | ✅ 全通过 |
| 验收测试（UAT） | 15 | 15 | 0 | 0 | ✅ 全通过 |
| **合计** | **89** | **89** | **0** | **0** | ✅ |

## 9. 用户确认节（self-as-verifier 模式声明）

> ⚠️ 模式声明：本项目处于 **self-as-verifier 回归调测模式**。按 `w-model-dev/references/phase-8-acceptance-test.md`
> 规定，验收测试的最终用户确认不得由 Agent 代签。在 self-as-verifier 调测模式下，由**调测者代为确认**，
> 但必须如实标注模式，不得伪造成真实终端用户签字。

| 确认项 | 状态 | 说明 |
|---|---|---|
| UAT-001~015 执行结果 | ✅ 已由调测者复核 | 15/15 真实通过，证据见 §3 |
| 需求满足度 | ✅ REQ-001~004 + NFR-001~004 全部满足 | RTM 覆盖率 100% |
| 四级测试全绿 | ✅ | UT 53/53 + IT 13/13 + ST 8/8 + UAT 15/15 |
| 终检门禁 | ✅ | check-artifact-gate.ts 退出码 0 |
| 真实终端用户签字 | ⏳ pending（self-as-verifier 模式下由调测者代签） | 非真实终端用户签字 |

- 确认模式：self-as-verifier（调测者代签）
- 确认人：W-Model 调测者
- 确认时间：2026-07-23
- 备注：Agent 未代签真实用户确认；如需正式发布，仍建议由真实终端用户复核签字后替换本节。

## 10. 结论

- [x] 测试通过，可进入发布门禁
- [ ] 测试未通过，需返工
- [ ] 部分通过，遗留项：无

**结论**：UAT-001~015 共 15 条验收用例全部真实通过（退出码 0），覆盖 REQ-001~004 全部验收标准与 NFR-001~004 全部非功能指标；RTM 需求覆盖率 100%；四级测试 89/89 全绿；单元覆盖率 96.37%（≥80%）；性能 P95=4.64ms（≤200ms）。满足需求规格，达到发布门禁条件。

## 11. 质量门状态（验收测试后）

- [x] 单元测试代码覆盖率 ≥ 80%（96.37%）
- [x] tsc strict 规范检查通过（exit 0）
- [x] 安全无高危（bcrypt cost=10 + JWT 校验 + 无明文）
- [x] 性能达标（P95=4.64ms ≤ 200ms）
- [x] RTM 需求覆盖率 100%
- [x] 四级测试全部通过（89/89）
- [x] check-artifact-gate.ts 终检退出码 0
