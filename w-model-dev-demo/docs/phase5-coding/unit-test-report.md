# 测试报告（单元测试）

> 阶段 5（编码）产出。套用 `templates/test-report.md` 模板。

## 文档信息

- 项目名称：博客系统后端（blog-system-demo-r35）
- 测试类型：单元测试
- 执行阶段：阶段 5（编码）
- 执行日期：2026-08-07
- 执行者：W 模型 S-coding 子代理（产出变体）

## 1. 测试概要

| 指标 | 数值 |
|---|---|
| 用例总数 | 175（vitest 实现用例；覆盖阶段 4 设计 58 条 UT-001~UT-058，每设计项 ≥1 用例，另含边界/异常补充用例） |
| 通过 | 175 |
| 失败 | 0 |
| 跳过 | 0 |
| 通过率 | 100%（175/175） |
| 覆盖率（单元测试适用） | lines 94.76% / branches 80.71% / functions 92.5% / statements 92.63%（目标 ≥ 80%，NFR-004） |

## 2. 执行命令与退出码

| 命令 | 工作目录 | 退出码 | 结果 |
|---|---|---|---|
| `npm run test:unit`（cross-env JWT_SECRET=test-secret-blog-demo vitest run tests/unit） | w-model-dev-demo | 0 | 45 个测试文件 175 用例全部通过 |
| `npm run test:coverage`（vitest run --coverage） | w-model-dev-demo | 0 | 覆盖率达标（四项阈值均 ≥80%） |
| `npx tsc --noEmit` | w-model-dev-demo | 0 | 0 错误（TypeScript strict） |

## 3. 测试结果明细（58 条设计用例）

| 用例 ID | 标题 | 优先级 | 状态 | 备注 |
|---|---|---|---|---|
| UT-001 | 注册接口成功透传（AuthController.register） | 高 | ✅ 通过 | 201 + data 组装 |
| UT-002 | 注册成功 bcrypt 哈希且响应不含明文密码（authService.register） | 高 | ✅ 通过 | NFR-002 |
| UT-003 | 修改密码原密码错误（profileService.changePassword） | 高 | ✅ 通过 | 60002 + 哈希未变 |
| UT-004 | 邮箱唯一冲突（UserStore.create） | 高 | ✅ 通过 | 40901 + 索引回滚 |
| UT-005 | 非博主创建文章被拒（ArticleController.createArticle） | 高 | ✅ 通过 | 40301，service 未调用 |
| UT-006 | 分类嵌套深度超限（MetadataController.createCategory） | 中 | ✅ 通过 | 60003 |
| UT-007 | 创建文章标签不存在（articleService.createArticle） | 高 | ✅ 通过 | 40401，未落库 |
| UT-008 | 文章状态机 draft→published 合法迁移 | 高 | ✅ 通过 | transition/canTransition 一致 |
| UT-009 | 标签重名冲突（tagService.createTag） | 中 | ✅ 通过 | 40901 |
| UT-010 | 同级分类重名冲突（categoryService.createCategory） | 中 | ✅ 通过 | 40901 |
| UT-011 | 分页参数越界（ArticleStore） | 中 | ✅ 通过 | ±1 边界 40002，极值 50 放行 |
| UT-012 | 按名称查标签不存在（TagStore.findByName） | 中 | ✅ 通过 | 返回 null |
| UT-013 | 根分类创建（CategoryStore） | 中 | ✅ 通过 | depth=1 |
| UT-014 | 草稿文章对读者不可见（BrowseController.getArticle） | 高 | ✅ 通过 | 40402 防枚举 |
| UT-015 | 未认证评论被拒（CommentController.createComment） | 高 | ✅ 通过 | 40101 |
| UT-016 | 禁止自关注（InteractionController.followBlogger） | 高 | ✅ 通过 | 40002，无写入 |
| UT-017 | 详情访问触发阅读事件（articleBrowseService） | 高 | ✅ 通过 | reading.viewed emit |
| UT-018 | 文章作者删除评论成功（RH-03 授权上下文） | 高 | ✅ 通过 | 删除可达 + 回复级联 |
| UT-019 | 重复点赞幂等（likeService.likeArticle） | 高 | ✅ 通过 | 计数/事件不重复 |
| UT-020 | 关注非博主被拒（followService.followBlogger） | 高 | ✅ 通过 | 40002（user store 校验） |
| UT-021 | 评论列表按时间降序分页（CommentStore） | 中 | ✅ 通过 | 降序 + total |
| UT-022 | 点赞计数正确（LikeStore.countByArticle） | 中 | ✅ 通过 | 空计数返回 0 |
| UT-023 | 收藏列表仅本人（FavoriteStore.listByUser） | 中 | ✅ 通过 | 数据隔离 |
| UT-024 | 无关注关系返回空列表（FollowStore） | 中 | ✅ 通过 | 不抛异常 |
| UT-025 | 热门 limit 越界（DiscoveryController） | 中 | ✅ 通过 | 0/51 → 40002，50 放行 |
| UT-026 | 近 7 天阅读量 Top N（hotService） | 高 | ✅ 通过 | 窗口过滤 + 降序 + 实际数 |
| UT-027 | 冷启动推荐回退热门（recommendService） | 高 | ✅ 通过 | hot-fallback |
| UT-028 | 四字段命中与相关性排序（searchService） | 高 | ✅ 通过 | 标题>标签>摘要>正文 |
| UT-029 | 空关键词检索空结果（SearchIndexStore.query） | 中 | ✅ 通过 | 容错返回空 |
| UT-030 | 统计面板非博主被拒（StatsController） | 中 | ✅ 通过 | 40301 |
| UT-031 | 同 IP 5 分钟窗口去重（readingStatService.recordView） | 高 | ✅ 通过 | 窗口内不重复计数 |
| UT-032 | 博主面板四项聚合与趋势补零（bloggerStatsService） | 高 | ✅ 通过 | 7 项趋势 4 项补 0 |
| UT-033 | 评论事件产生被回复通知（notificationService） | 高 | ✅ 通过 | REPLY + 未读 |
| UT-034 | 阅读去重窗口边界判定（ReadingRecordStore） | 中 | ✅ 通过 | =windowMs 闭区间 |
| UT-035 | 通知列表未读过滤（NotificationStore） | 中 | ✅ 通过 | unreadOnly 正确 |
| UT-036 | Webhook url 非 http(s) 被拒（IntegrationController） | 中 | ✅ 通过 | 40002（SSRF 范围） |
| UT-037 | RSS 仅含已发布文章（rssService） | 高 | ✅ 通过 | 草稿/归档不暴露 + XML 转义 |
| UT-038 | Webhook 失败重试 ≤3 次并留失败记录（webhookService） | 高 | ✅ 通过 | attempts≤3 + failed + lastError |
| UT-039 | Webhook 同 url+event 去重（WebhookConfigStore） | 中 | ✅ 通过 | 40901 |
| UT-040 | 投递记录状态流转（WebhookDeliveryStore） | 中 | ✅ 通过 | pending→delivering→failed |
| UT-041 | 认证中间件无令牌/过期令牌（RH-02） | 高 | ✅ 通过 | 40101 / 40102 / 合法挂载 |
| UT-042 | 认证接口限流 10 次/分（rateLimitMiddleware） | 高 | ✅ 通过 | 42901 + 窗口重置 |
| UT-043 | 审计留痕且不含明文凭据（RH-01） | 高 | ✅ 通过 | 负向断言无 password/token |
| UT-044 | 未映射异常统一 50001 通用文案（errorMiddleware） | 高 | ✅ 通过 | 无堆栈/路径直出 |
| UT-045 | async 处理器异常转发（asyncHandler.wrap） | 高 | ✅ 通过 | next(err) |
| UT-046 | JWT HS256 24h 有效期（jwtUtil.sign/verify） | 高 | ✅ 通过 | exp−iat ≤ 86400 |
| UT-047 | zod 校验错误映射 40001/40002（validationUtil） | 高 | ✅ 通过 | 类型/越界分类正确 |
| UT-048 | 存储基座工厂与事务原子性（storeFactory + txManager） | 高 | ✅ 通过 | 14 store + 回滚/提交 |
| UT-049 | 审计日志保留 90 天清理（AuditLogStore） | 中 | ✅ 通过 | prune 边界 |
| UT-050 | 中间件链顺序与静态路径优先（AppFactory.createApp） | 高 | ✅ 通过 | hot/me 先于参数路径 |
| UT-051 | 登录凭据错误统一 40101 防枚举（authService.login） | 高 | ✅ 通过 | code+message 一致 |
| UT-052 | 归档后直跳发布非法（articleStateMachine） | 高 | ✅ 通过 | 60001 |
| UT-053 | 非文章作者删除评论被拒（commentService） | 高 | ✅ 通过 | 40301，评论保留 |
| UT-054 | 去重窗口外重复访问 +1（readingStatService） | 中 | ✅ 通过 | 窗口外新增记录 |
| UT-055 | Webhook 回调 HMAC 签名正确（webhookService） | 高 | ✅ 通过 | X-Blog-Signature 可重算 |
| UT-056 | 篡改令牌验签失败（jwtUtil.verify） | 高 | ✅ 通过 | 40101 |
| UT-057 | 标签偏好推荐含已读去重（recommendService） | 中 | ✅ 通过 | 排除已读 + 去重 |
| UT-058 | 草稿不入搜索索引（searchService.syncIndex） | 中 | ✅ 通过 | 仅 published 可检索 |

## 4. 覆盖率明细（vitest v8 coverage，目标 ≥80%）

| 指标 | 阈值 | 实测 | 是否达标 |
|---|---|---|---|
| Statements | 80% | 92.63% | ✅ |
| Branches | 80% | 80.71% | ✅ |
| Functions | 80% | 92.5% | ✅ |
| Lines | 80% | 94.76% | ✅ |

分层覆盖要点：stores 94.52% lines / services 94.71% lines / routes（9 控制器）88.58% lines / middlewares 92.58% lines / utils 94.93% lines；`src/app.ts` 经 UT-050 supertest 直连覆盖路由注册与静态路径优先；`src/index.ts`、`src/server.ts` 为入口/启动文件（由阶段 6+ 集成/系统测试覆盖，已在 vitest coverage exclude 声明）。

## 5. reworkHints 处置摘要（阶段 4 V/R3）

| reworkHint | 处置落点 | 验证用例 |
|---|---|---|
| 令牌角色声明一致（DD-002 签 {sub,role} 与 DD-046 verify 一致） | `issueToken` 统一签 `{sub, role}`，verify 返回 `{sub, role, iat, exp}`（代码注释声明统一方案） | UT-046（role 声明断言）、UT-051（签发链） |
| NFR-006 通用限流 100/min/IP | rate-limit middleware 双阈值：`/api/auth/*` 10/min + `/api/*` 100/min（AppFactory 装配） | UT-042（10/min 42901）；通用 100/min 装配在 UT-050 app 层 |
| CON-004 审计不含明文凭据 | auditMiddleware 白名单字段 + AuditLog schema 无 password/token/请求体字段 | UT-043（负向断言）、UT-049 |
| Webhook 时间戳窗口（X-Blog-Timestamp 时效校验） | deliverWebhook 每次尝试签发新鲜 `X-Blog-Timestamp`（秒级）；接收端时效校验属下游契约，由阶段 6/7 集成/系统测试验证 | UT-055（timestamp 头存在且新鲜） |
| INTF-016 补 40102 错误码 | 推荐接口可选 JWT 经 `jwtUtil.verify`：无效 → 40101、过期 → 40102（DiscoveryController.getRecommendations） | UT-025 补充用例（无效 JWT 40101）、jwtUtil UT-056（过期 40102） |

## 6. 失败用例分析

无（175/175 通过，0 失败）。

## 7. 结论

- [x] 测试通过，可进入下一阶段（阶段 6 集成测试）

**量化指标**：
- 测试通过率：`175/175`（100%）
- 代码覆盖率：`94.76% lines / 80.71% branches / 92.5% functions`（92.63% statements）
- 阈值对比：`lines ≥ 80% ✓ / branches ≥ 80% ✓ / functions ≥ 80% ✓ / statements ≥ 80% ✓`
- 编译验证：`npx tsc --noEmit` 退出码 0（0 错误）

## 8. 质量门状态

- [x] 单元测试代码覆盖率 ≥ 80%（94.76% lines）
- [x] 规范检查通过（tsc --noEmit 0 错误；eslint/prettier 门禁由 G 子代理执行）
- [x] RTM 需求覆盖率 100%（32 行 codeModule 已回填，`.w-model/rtm.json`）
- [x] 测试用例汇总计数守恒（175 = 175 passed + 0 failed + 0 pending）
