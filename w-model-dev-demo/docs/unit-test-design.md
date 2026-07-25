# 单元测试设计说明书

> 阶段 4（详细设计）产出。type=单元测试。覆盖 17 SD 子系统核心方法，80 TC-UNIT 用例。
> 套用 `templates/phase-4-detailed-design.md` 单元测试模板。技术栈：vitest + TypeScript 5 (strict)。

## 文档信息

- 项目名称：blog-system-demo（扩展博客系统后端）
- 文档版本：v1.0
- 编制日期：2026-07-25
- 关联详细设计：`docs/detailed-design.md`
- 关联接口设计：`docs/interface-design.md`
- 编制者：S 子代理（第 8 轮 W 模型，阶段 4 单元测试设计）

---

## 1. 测试策略

### 1.1 测试范围
- 单元测试覆盖 `docs/detailed-design.md` §3 中 17 SD 子系统的核心方法（≈77 方法）
- 每个方法至少 1 条用例，关键方法（状态机/权限/校验）多条
- 覆盖 TC-DES-002（类图生成验证）/ TC-DES-003（数据结构设计验证）

### 1.2 测试分层
| 层级 | 测试对象 | 隔离策略 |
|---|---|---|
| Store 层 | Map 增删改查 + 索引维护 | 真实 Map 实例，每用例 beforeEach 重置 |
| Service 层 | 业务逻辑 + 状态机 | Mock 依赖的 Store 方法 + Mock bcrypt/jwt |
| Utils 层 | auth/zod/error-handler | Mock bcrypt.hash / jwt.sign / jwt.verify |

### 1.3 覆盖率目标
- **分支覆盖 ≥ 80%**（NFR-004 验收标准）
- 边界必覆盖清单全命中（见 §3）
- 每个公开方法至少 1 条用例

---

## 2. 测试用例清单（TC-UNIT-001 ~ TC-UNIT-080）

> 每条用例含：用例ID / 测试场景 / 前置条件 / 输入 / 预期输出（含 expect 断言）/ 优先级 / 关联方法。
> 优先级：P0（阻塞）/ P1（关键）/ P2（一般）。断言使用 vitest `expect()`。

### 2.1 SD-001 站点管理（TC-UNIT-001 ~ TC-UNIT-005）

| 用例ID | 测试场景 | 前置条件 | 输入 | 预期输出（expect 断言） | 优先级 | 关联方法 |
|---|---|---|---|---|---|---|
| TC-UNIT-001 | 管理员更新站点配置正常 | operator.role=admin | `updateConfig("admin-1", {siteName:"新站"})` | `expect(result.siteName).toBe("新站")` + `expect(result.updatedAt).toBeInstanceOf(Date)` | P0 | SiteStore.updateConfig |
| TC-UNIT-002 | 非管理员更新配置越权 | operator.role=reader | `updateConfig("reader-1", {siteName:"x"})` | `expect(() => updateConfig(...)).toThrow("1021")` | P0 | SiteStore.updateConfig |
| TC-UNIT-003 | 维护模式切换非管理员拦截 503 | maintenanceMode=true, role=reader | 任意请求 | `expect(response.code).toBe(1023)` + `expect(response.httpStatus).toBe(503)` | P1 | SiteService.setMaintenanceMode |
| TC-UNIT-004 | 公告定时发布时间无效 | at=过去时间 | `scheduleAnnouncement("admin-1","text", pastDate)` | `expect(() => ...).toThrow("1001")` | P1 | SiteService.scheduleAnnouncement |
| TC-UNIT-005 | 站点统计概览聚合正确 | 17 SD 各有 N 条 | `getStatsOverview()` | `expect(result.articleCount).toBe(10)` + `expect(result.userCount).toBe(5)` | P2 | SiteService.getStatsOverview |

### 2.2 SD-002 多博主（TC-UNIT-006 ~ TC-UNIT-010）

| 用例ID | 测试场景 | 前置条件 | 输入 | 预期输出（expect 断言） | 优先级 | 关联方法 |
|---|---|---|---|---|---|---|
| TC-UNIT-006 | 博主创建 slug 唯一性校验 | slug="alice" 已存在 | `create("u-1","alice","bio")` | `expect(() => ...).toThrow("1005")` + `expect(slugToId.has("alice")).toBe(true)` | P0 | BloggerStore.create |
| TC-UNIT-007 | slug 格式非法（含大写） | 无 | `create("u-1","Alice","bio")` | `expect(() => ...).toThrow("1001")` | P1 | BloggerStore.create |
| TC-UNIT-008 | 关注博主正常 | follower 与 blogger 不同 | `follow("u-1","b-1")` | `expect(subscriptionStore.size).toBe(1)` + `expect(blogger.followerCount).toBe(1)` | P0 | BloggerService.follow |
| TC-UNIT-009 | 自关注禁止 | followerId=bloggerId 关联 | `follow("u-1","b-own")` | `expect(() => ...).toThrow("1003")` | P1 | BloggerService.follow |
| TC-UNIT-010 | 取消关注不存在关系 | 无关注关系 | `unfollow("u-1","b-1")` | `expect(() => ...).toThrow("1031")` | P2 | BloggerService.unfollow |

### 2.3 SD-003 多用户（TC-UNIT-011 ~ TC-UNIT-015）

| 用例ID | 测试场景 | 前置条件 | 输入 | 预期输出（expect 断言） | 优先级 | 关联方法 |
|---|---|---|---|---|---|---|
| TC-UNIT-011 | 用户注册 email 唯一性 | email 已注册 | `create({email:"a@b.com",...})` | `expect(() => ...).toThrow("1005")` + `expect(emailToId.has("a@b.com")).toBe(true)` | P0 | UserStore.create |
| TC-UNIT-012 | 登录密码错误 | user 存在, password 错误 | `login("a@b.com","wrong")` | `expect(() => ...).toThrow("1012")` | P0 | AuthService.login |
| TC-UNIT-013 | JWT 验证过期 token | token.exp < now | `verifyToken(expiredToken)` | `expect(() => ...).toThrow("1013")` | P0 | AuthService.verifyToken |
| TC-UNIT-014 | 封禁用户 token 立即失效 | user.status=banned | `verifyToken(bannedUserToken)` | `expect(() => ...).toThrow("1022")` + `expect(revokedJtis.size).toBeGreaterThan(0)` | P0 | AuthService.revokeToken |
| TC-UNIT-015 | 不可封禁 admin | target.role=admin | `ban("admin-1","admin-2","r")` | `expect(() => ...).toThrow("1021")` | P1 | UserService.ban |

### 2.4 SD-004 推荐（TC-UNIT-016 ~ TC-UNIT-019）

| 用例ID | 测试场景 | 前置条件 | 输入 | 预期输出（expect 断言） | 优先级 | 关联方法 |
|---|---|---|---|---|---|---|
| TC-UNIT-016 | 热度推荐公式计算 | 3 篇 published 文章不同 viewCount | `hot(1,10)` | `expect(result.items[0].id).toBe(hottestId)` + `expect(result.items).toHaveLength(3)` | P1 | RecommendService.hot |
| TC-UNIT-017 | 个性化推荐需登录 | 无 userId | `personalized("",1,10)` | `expect(() => ...).toThrow("1011")` | P1 | RecommendService.personalized |
| TC-UNIT-018 | 最新推荐按 publishedAt 倒序 | 5 篇不同时间 | `latest(1,10)` | `expect(result.items[0].publishedAt).toBeGreaterThan(result.items[1].publishedAt)` | P2 | RecommendService.latest |
| TC-UNIT-019 | 推荐位设置越权 | operator.role=reader | `setSlot("reader","slot1","a-1",1)` | `expect(() => ...).toThrow("1021")` | P1 | RecommendService.setSlot |

### 2.5 SD-005 广告（TC-UNIT-020 ~ TC-UNIT-023）

| 用例ID | 测试场景 | 前置条件 | 输入 | 预期输出（expect 断言） | 优先级 | 关联方法 |
|---|---|---|---|---|---|---|
| TC-UNIT-020 | 广告时间区间重叠 | 同 slot 已有广告 [s1,e1] | `create(...,{startAt:s1-1,endAt:s1+1})` | `expect(() => ...).toThrow("1005")` | P1 | AdStore.create |
| TC-UNIT-021 | 广告审核状态机非法跳转 | ad.status=rejected | `audit(...,"approve")` | `expect(() => ...).toThrow("1002")` | P0 | AdService.audit |
| TC-UNIT-022 | 广告点击计数自增 | ad.status=approved, now∈[start,end] | `recordClick("ad-1")` | `expect(ad.clickCount).toBe(1)` | P2 | AdService.recordClick |
| TC-UNIT-023 | 广告列表分页 | 25 条广告 | `listBySlot("slot1",2,10)` | `expect(result.items).toHaveLength(10)` + `expect(result.total).toBe(25)` | P2 | AdService.listBySlot |

### 2.6 SD-006 统计（TC-UNIT-024 ~ TC-UNIT-027）

| 用例ID | 测试场景 | 前置条件 | 输入 | 预期输出（expect 断言） | 优先级 | 关联方法 |
|---|---|---|---|---|---|---|
| TC-UNIT-024 | 文章统计按状态聚合 | 10 published + 5 draft | `articleStats()` | `expect(result.published).toBe(10)` + `expect(result.draft).toBe(5)` | P1 | StatsService.articleStats |
| TC-UNIT-025 | 用户统计按角色聚合 | 3 admin + 10 reader | `userStats()` | `expect(result.byRole.admin).toBe(3)` + `expect(result.byRole.reader).toBe(10)` | P1 | StatsService.userStats |
| TC-UNIT-026 | 非管理员访问统计 | role=reader | `articleStats()` | `expect(() => ...).toThrow("1021")` | P0 | StatsService.articleStats |
| TC-UNIT-027 | 站点趋势天数超限 | days=100 | `siteTrend(100)` | `expect(() => ...).toThrow("1001")` | P2 | StatsService.siteTrend |

### 2.7 SD-007 搜索（TC-UNIT-028 ~ TC-UNIT-031）

| 用例ID | 测试场景 | 前置条件 | 输入 | 预期输出（expect 断言） | 优先级 | 关联方法 |
|---|---|---|---|---|---|---|
| TC-UNIT-028 | 全文搜索倒排索引交集 | "hello" 命中 2 篇 | `search("hello","relevance",1,10)` | `expect(result.items).toHaveLength(2)` + `expect(result.items[0].score).toBeGreaterThan(0)` | P0 | SearchService.search |
| TC-UNIT-029 | 搜索历史 FIFO 淘汰 | 已有 20 条历史 | 再搜 1 次 | `expect(history).toHaveLength(20)` + `expect(history[0]).toBe(newestQuery)` | P1 | SearchService.search |
| TC-UNIT-030 | 搜索建议前缀匹配 | invertedIndex 含 "hello" | `suggest("hel")` | `expect(result).toContain("hello")` | P2 | SearchService.suggest |
| TC-UNIT-031 | 搜索查询超长 | query=101 字符 | `search(longQuery,...)` | `expect(() => ...).toThrow("1001")` | P2 | SearchService.search |

### 2.8 SD-008 标签（TC-UNIT-032 ~ TC-UNIT-035）

| 用例ID | 测试场景 | 前置条件 | 输入 | 预期输出（expect 断言） | 优先级 | 关联方法 |
|---|---|---|---|---|---|---|
| TC-UNIT-032 | 标签名特殊字符拒绝 | name=`<script>` | `create("<script>","slug")` | `expect(() => ...).toThrow("1001")` | P1 | TagStore.create |
| TC-UNIT-033 | 文章绑定标签超 10 个 | tagIds.length=11 | `bind("a-1", tagIds11)` | `expect(() => ...).toThrow("1001")` | P0 | TagService.bind |
| TC-UNIT-034 | 标签云按 articleCount 降序 | 3 tag 不同 count | `cloud(3)` | `expect(result[0].articleCount).toBeGreaterThanOrEqual(result[1].articleCount)` | P2 | TagService.cloud |
| TC-UNIT-035 | 标签自合并拒绝 | sourceId=targetId | `merge("admin","t-1","t-1")` | `expect(() => ...).toThrow("1003")` | P1 | TagService.merge |

### 2.9 SD-009 分类（TC-UNIT-036 ~ TC-UNIT-039）

| 用例ID | 测试场景 | 前置条件 | 输入 | 预期输出（expect 断言） | 优先级 | 关联方法 |
|---|---|---|---|---|---|---|
| TC-UNIT-036 | 分类树深度超 5 层拒绝 | parent.depth=5 | `create("c6","parent-5")` | `expect(() => ...).toThrow("1004")` | P0 | CategoryStore.create |
| TC-UNIT-037 | 分类树构建递归 | 3 级分类 | `tree()` | `expect(result[0].children[0].children).toBeDefined()` | P1 | CategoryService.tree |
| TC-UNIT-038 | 面包屑向上回溯 | 3 级分类叶子 | `breadcrumb("c-3")` | `expect(result).toHaveLength(3)` + `expect(result[0].parentId).toBeNull()` | P2 | CategoryService.breadcrumb |
| TC-UNIT-039 | 级联删除子分类 | 父分类有 2 子 | `cascadeDelete("admin","c-parent")` | `expect(categories.size).toBe(initialSize - 3)` | P1 | CategoryService.cascadeDelete |

### 2.10 SD-010 评论（TC-UNIT-040 ~ TC-UNIT-044）

| 用例ID | 测试场景 | 前置条件 | 输入 | 预期输出（expect 断言） | 优先级 | 关联方法 |
|---|---|---|---|---|---|---|
| TC-UNIT-040 | 评论嵌套超 5 层拒绝 | parent.depth=5 | `create("a-1","u-1","parent-5","x")` | `expect(() => ...).toThrow("1004")` | P0 | CommentStore.create |
| TC-UNIT-041 | 评论开关关闭时拒绝 | siteConfig.commentOpen=false | `create(...)` | `expect(() => ...).toThrow("1025")` | P0 | CommentStore.create |
| TC-UNIT-042 | 评论点赞幂等性 | user 已点赞 | `like("u-1","c-1")` 二次 | `expect(comment.likeCount).toBe(1)` (不重复+1) | P0 | CommentService.like |
| TC-UNIT-043 | 评论审核状态机非法 | status=rejected | `audit(...,"approve")` | `expect(() => ...).toThrow("1002")` | P1 | CommentService.audit |
| TC-UNIT-044 | 评论列表排序 popular | 3 评论不同 likeCount | `listByArticle("a-1",1,10,"popular")` | `expect(result.items[0].likeCount).toBeGreaterThan(result.items[1].likeCount)` | P2 | CommentService.listByArticle |

### 2.11 SD-011 通知（TC-UNIT-045 ~ TC-UNIT-048）

| 用例ID | 测试场景 | 前置条件 | 输入 | 预期输出（expect 断言） | 优先级 | 关联方法 |
|---|---|---|---|---|---|---|
| TC-UNIT-045 | 通知创建未读状态 | 无 | `create("u-1","comment","t","b","r-1")` | `expect(notification.read).toBe(false)` + `expect(userIdUnread.get("u-1").size).toBe(1)` | P0 | NotificationStore.create |
| TC-UNIT-046 | 通知设置关闭某类 | settings.comment.enabled=false | `create("u-1","comment",...)` | `expect(() => ...).toThrow("1001")` 或返回 null | P1 | NotificationStore.create |
| TC-UNIT-047 | 单条标记已读 | read=false | `markRead("u-1","n-1")` | `expect(notification.read).toBe(true)` + `expect(userIdUnread.get("u-1").has("n-1")).toBe(false)` | P1 | NotificationService.markRead |
| TC-UNIT-048 | 全部标记已读 | 5 条未读 | `markAllRead("u-1")` | `expect(userIdUnread.get("u-1").size).toBe(0)` | P2 | NotificationService.markAllRead |

### 2.12 SD-012 多博文（TC-UNIT-049 ~ TC-UNIT-054）

| 用例ID | 测试场景 | 前置条件 | 输入 | 预期输出（expect 断言） | 优先级 | 关联方法 |
|---|---|---|---|---|---|---|
| TC-UNIT-049 | 文章创建字段校验 | title=201 字符 | `create("b-1",{title:"x".repeat(201),...})` | `expect(() => ...).toThrow("1001")` | P0 | ArticleStore.create |
| TC-UNIT-050 | 文章状态机正常流转 | draft | `transition("b-1","a-1","pending_review")` | `expect(article.status).toBe("pending_review")` | P0 | ArticleService.transition |
| TC-UNIT-051 | 文章状态机逆向跳转拒绝 | archived | `transition(...,"published")` | `expect(() => ...).toThrow("1002")` | P0 | ArticleService.transition |
| TC-UNIT-052 | 定时发布调度 | pending_review | `schedule("b-1","a-1", futureDate)` | `expect(publishSchedule["a-1"]).toBe("schedule_pending")` | P1 | ArticleService.schedule |
| TC-UNIT-053 | 定时发布触发 | schedule_pending | `fireScheduledPublish("a-1")` | `expect(article.status).toBe("published")` + `expect(publishSchedule["a-1"]).toBe("schedule_fired")` | P1 | ArticleService.transition (内部) |
| TC-UNIT-054 | 批量下架越权 | operator.role=reader | `batchOffline("reader",["a-1"])` | `expect(() => ...).toThrow("1021")` | P0 | ArticleService.batchOffline |

### 2.13 SD-013 交叉引用（TC-UNIT-055 ~ TC-UNIT-058）

| 用例ID | 测试场景 | 前置条件 | 输入 | 预期输出（expect 断言） | 优先级 | 关联方法 |
|---|---|---|---|---|---|---|
| TC-UNIT-055 | 自引用禁止 | fromId=toId | `create("a-1","a-1")` | `expect(() => ...).toThrow("1003")` | P0 | CrossReferenceStore.create |
| TC-UNIT-056 | 重复引用拒绝 | 引用已存在 | `create("a-1","a-2")` 二次 | `expect(() => ...).toThrow("1005")` | P1 | CrossReferenceStore.create |
| TC-UNIT-057 | 反向链接查询 | a-2 引用 a-1 | `backlinks("a-1")` | `expect(result).toHaveLength(1)` + `expect(result[0].fromArticleId).toBe("a-2")` | P1 | CrossReferenceService.backlinks |
| TC-UNIT-058 | 相关文章 Jaccard 相似度 | a-1/a-2 共享 2 tag | `related("a-1",5)` | `expect(result[0].articleId).toBe("a-2")` + `expect(result[0].score).toBeGreaterThan(0)` | P2 | CrossReferenceService.related |

### 2.14 SD-014 消息推送（TC-UNIT-059 ~ TC-UNIT-064）

| 用例ID | 测试场景 | 前置条件 | 输入 | 预期输出（expect 断言） | 优先级 | 关联方法 |
|---|---|---|---|---|---|---|
| TC-UNIT-059 | 在线用户直接推送 | wsConnections 有 userId | `push("u-1","ch-1",{msg:"hi"})` | `expect(ws.send).toHaveBeenCalledWith(JSON.stringify({msg:"hi"}))` | P0 | PushService.push |
| TC-UNIT-060 | 离线用户入队 | userId 不在线 | `push("u-1","ch-1",{msg:"hi"})` | `expect(offlineMessages.get("u-1")).toHaveLength(1)` | P0 | PushService.push |
| TC-UNIT-061 | 推送失败重试 3 次指数退避 | ws.send 抛错 | `push(...)` | `expect(retryCount).toBe(3)` + `expect(delays).toEqual([1000,2000,4000])` | P0 | PushService.push |
| TC-UNIT-062 | 离线消息合并 ≤24h | offline 有 3 条同 channel 24h 内 | `flushOffline("u-1")` | `expect(mergedCount).toBe(1)` + `expect(offlineMessages.get("u-1")).toHaveLength(0)` | P1 | PushService.flushOffline |
| TC-UNIT-063 | 离线消息 24h 外清理 | offline 有 1 条 25h 前 | `flushOffline("u-1")` | `expect(offlineMessages.get("u-1")).toHaveLength(0)` (过期丢弃) | P1 | PushService.flushOffline |
| TC-UNIT-064 | 广播推送遍历通道用户 | channelToUsers["ch-1"]=3 用户 | `broadcast("ch-1",{msg:"x"})` | `expect(pushCallCount).toBe(3)` | P2 | PushService.broadcast |

### 2.15 SD-015 文件上传（TC-UNIT-065 ~ TC-UNIT-070）

| 用例ID | 测试场景 | 前置条件 | 输入 | 预期输出（expect 断言） | 优先级 | 关联方法 |
|---|---|---|---|---|---|---|
| TC-UNIT-065 | 文件超 10MB 拒绝 | size=11MB | `create("u-1",file11MB)` | `expect(() => ...).toThrow("1041")` | P0 | FileStore.create |
| TC-UNIT-066 | 魔数校验不匹配 | declaredMime=image/png, buffer=JPEG 头 | `validateMagic(jpegBuf,"image/png")` | `expect(result).toBe(false)` | P0 | FileService.validateMagic |
| TC-UNIT-067 | SHA-256 秒传去重 | sha256 已存在 | `create("u-1",fileWithExistingSha)` | `expect(files.size).toBe(initialSize)` (不重复存储) | P1 | FileStore.create |
| TC-UNIT-068 | 文件名消毒移除路径分隔符 | name=`../../etc/passwd` | `sanitizeFilename(name)` | `expect(result).not.toContain("..")` + `expect(result).not.toContain("/")` | P0 | FileService.sanitizeFilename |
| TC-UNIT-069 | 日配额 50MB 超限 | dailyUsed=49MB, upload=2MB | `create("u-1",file2MB)` | `expect(() => ...).toThrow("1005")` | P1 | FileStore.create |
| TC-UNIT-070 | 配额查询聚合正确 | 24h 内上传 3 文件总 10MB | `getQuota("u-1")` | `expect(result.dailyUsed).toBe(10*1024*1024)` | P2 | FileService.getQuota |

### 2.16 SD-016 订阅（TC-UNIT-071 ~ TC-UNIT-075）

| 用例ID | 测试场景 | 前置条件 | 输入 | 预期输出（expect 断言） | 优先级 | 关联方法 |
|---|---|---|---|---|---|---|
| TC-UNIT-071 | 订阅创建幂等性 | 已订阅同 target+targetId | `create("u-1","blogger","b-1")` 二次 | `expect(subscriptions.size).toBe(initialSize)` (幂等) | P0 | SubscriptionStore.create |
| TC-UNIT-072 | 订阅聚合 1h 窗口合并 | 1h 内同 type 3 事件 | `aggregateAndPush("b-1",event3)` | `expect(pushCallCount).toBe(1)` (批量合并) | P1 | SubscriptionService.aggregateAndPush |
| TC-UNIT-073 | 用户订阅列表分页 | 15 条订阅 | `listByUser("u-1",2,10)` | `expect(result.items).toHaveLength(5)` + `expect(result.total).toBe(15)` | P2 | SubscriptionService.listByUser |
| TC-UNIT-074 | 订阅权限分级 basic | role=reader, subs<5 | `permission("u-1","blogger")` | `expect(result).toBe("basic")` | P2 | SubscriptionService.permission |
| TC-UNIT-075 | 订阅目标不存在拒绝 | targetId 不存在 | `create("u-1","blogger","no-exist")` | `expect(() => ...).toThrow("1031")` | P1 | SubscriptionStore.create |

### 2.17 SD-017 数据导出与备份（TC-UNIT-076 ~ TC-UNIT-080）

| 用例ID | 测试场景 | 前置条件 | 输入 | 预期输出（expect 断言） | 优先级 | 关联方法 |
|---|---|---|---|---|---|---|
| TC-UNIT-076 | 备份 SHA-256 完整性校验 | backup 存在 | `verifyIntegrity("bk-1")` | `expect(result).toBe(true)` | P0 | BackupService.verifyIntegrity |
| TC-UNIT-077 | 备份恢复 SHA-256 不匹配 | payload 被篡改 | `restore("admin","bk-tampered")` | `expect(() => ...).toThrow("1001")` | P0 | BackupService.restore |
| TC-UNIT-078 | 用户数据导出 JSON 格式 | user 有文章/评论 | `exportUserData("u-1")` | `expect(JSON.parse(result.toString())).toHaveProperty("user")` + `expect(...).toHaveProperty("articles")` | P1 | BackupService.exportUserData |
| TC-UNIT-079 | 增量导出时间范围 | since=7天前 | `incremental(since7dAgo)` | `expect(result.length).toBeGreaterThan(0)` | P2 | BackupService.incremental |
| TC-UNIT-080 | 备份 payload 超 10MB 拒绝 | payload=11MB | `create("admin","full",payload11MB)` | `expect(() => ...).toThrow("1005")` | P1 | BackupStore.create |

---

## 3. 边界条件必覆盖清单

> 每类方法至少 1 条边界用例，全清单命中。

| 边界类型 | 命中用例 | 关联方法 | 断言要点 |
|---|---|---|---|
| **空输入**（空字符串/空数组/空 Map） | TC-UNIT-017（userId=""), TC-UNIT-031（query 边界）, TC-UNIT-054（articleIds=[]） | AuthService/SearchService/ArticleService | `expect(() => ...).toThrow("1001")` |
| **null/undefined** | TC-UNIT-009（自关注边界）, TC-UNIT-036（parentId=null 根分类） | BloggerService/CategoryStore | null 处理不抛异常或抛 1001 |
| **极值（MAX_SAFE_INTEGER/MIN_SAFE_INTEGER/0/-1）** | TC-UNIT-027（days=100 超 90 上限）, TC-UNIT-033（tagIds=11 超 10）, TC-UNIT-069（配额边界） | StatsService/TagService/FileStore | `expect(() => ...).toThrow("1001"/"1005")` |
| **越界（±1）** | TC-UNIT-036（depth=5→6 越界）, TC-UNIT-040（depth=5→6 越界）, TC-UNIT-049（title=201 超 200）, TC-UNIT-065（size=11MB 超 10MB） | CategoryStore/CommentStore/ArticleStore/FileStore | `expect(() => ...).toThrow("1004"/"1001"/"1041")` |
| **类型不符（string 传 number）** | TC-UNIT-007（slug 含大写非法）, TC-UNIT-032（标签名特殊字符） | BloggerStore/TagStore | zod schema 拒绝，`expect(() => ...).toThrow("1001")` |
| **并发竞态（Map 并发读写）** | TC-UNIT-022（clickCount 自增）, TC-UNIT-042（点赞幂等）, TC-UNIT-071（订阅幂等） | AdService/CommentService/SubscriptionStore | 重复操作结果不变，`expect(count).toBe(1)` |
| **状态机非法跳转** | TC-UNIT-021（ad rejected→approve）, TC-UNIT-043（comment rejected→approve）, TC-UNIT-051（archived→published 逆向） | AdService/CommentService/ArticleService | `expect(() => ...).toThrow("1002")` |
| **权限越权** | TC-UNIT-002（reader 更新配置）, TC-UNIT-015（封禁 admin）, TC-UNIT-019（reader 设推荐位）, TC-UNIT-026（reader 看统计）, TC-UNIT-054（reader 批量下架） | SiteStore/UserService/RecommendService/StatsService/ArticleService | `expect(() => ...).toThrow("1021")` |

**清单覆盖结论**：8 类边界全部命中，每类至少 1 条用例，满足 `phase-4-detailed-design.md` 边界必覆盖要求。

---

## 4. Mock/Stub 隔离方案

### 4.1 隔离原则
- 单元测试**不得依赖外部服务**（无数据库/无文件系统/无网络）
- Map 存储使用**真实实例**（每用例 beforeEach 重置，保证隔离）
- 外部依赖（bcrypt/jwt/ws）使用 **vi.mock** 替换

### 4.2 Mock 策略清单

| 模块 | Mock 对象 | Mock 方式 | 验证点 |
|---|---|---|---|
| `bcrypt` | `bcrypt.hash` / `bcrypt.compare` | `vi.mock("bcrypt")` 返回固定 hash | hash 调用次数、compare 返回值 |
| `jsonwebtoken` | `jwt.sign` / `jwt.verify` | `vi.mock("jsonwebtoken")` 返回固定 token/payload | sign 调用参数、verify 抛 expired 错误 |
| `ws.WebSocket` | `ws.send` / `ws.close` | `vi.fn()` 替换 | send 调用次数、参数 JSON 序列化 |
| `crypto` (SHA-256) | 真实调用（Node 内置，无外部依赖） | 不 Mock | 返回 hex 字符串 |
| `setInterval` / `setTimeout` | `vi.useFakeTimers()` | 假定时器 | 定时触发时机、clear |
| Map 存储 | 真实 `new Map()` | 不 Mock（每用例重建） | 增删改查结果 |
| Store 间依赖（如 ArticleService→SearchStore） | `vi.spyOn(searchStore, "index")` | spy 替换 | index 调用次数、参数 |

### 4.3 测试用例隔离

```typescript
// 示例：每用例 beforeEach 重置 Map，避免用例间状态泄漏
describe("ArticleStore", () => {
  let store: ArticleStore;
  beforeEach(() => {
    store = new ArticleStore(); // 内部 new Map() 全新实例
  });
  afterEach(() => {
    vi.clearAllMocks();
  });
  // ... 用例
});
```

### 4.4 Mock 边界
- **不 Mock**：zod schema 校验（真实执行，验证契约）
- **不 Mock**：业务状态机逻辑（真实执行，验证不变式）
- **不 Mock**：Map 增删改查（真实执行，验证索引一致性）
- **Mock**：bcrypt/jwt/ws/setInterval 等外部 IO

---

## 5. 覆盖率目标

### 5.1 目标矩阵

| 维度 | 目标 | 验证方式 |
|---|---|---|
| 分支覆盖 | ≥ 80% | `vitest --coverage` 报告 branches |
| 函数覆盖 | 100% | 所有公开方法至少 1 用例 |
| 行覆盖 | ≥ 85% | 含错误处理分支 |
| 边界必覆盖清单 | 100% 命中 | §3 清单 8 类全有 |
| 状态机分支 | 100% | 所有合法/非法转移各 1 用例 |
| 权限分支 | 100% | admin/blogger/reader 三角色各覆盖 |

### 5.2 覆盖率不达标处理
- 若某方法分支覆盖 < 80%，追加用例至达标
- 若状态机分支遗漏，补 TC-UNIT-081+ 用例
- 边界清单遗漏，立即补用例（不允许 // TODO: assert 占位）

---

## 6. 与 RTM 的追溯关系

> 80 TC-UNIT 分配到 17 REQ，每个 REQ 的核心方法至少覆盖。

| REQ | TC-UNIT 范围 | 数量 | 关联 DD |
|---|---|---|---|
| REQ-001 | TC-UNIT-001~005 | 5 | DD-001~003 |
| REQ-002 | TC-UNIT-006~010 | 5 | DD-004~006 |
| REQ-003 | TC-UNIT-011~015 | 5 | DD-007~009 |
| REQ-004 | TC-UNIT-016~019 | 4 | DD-010~012 |
| REQ-005 | TC-UNIT-020~023 | 4 | DD-013~015 |
| REQ-006 | TC-UNIT-024~027 | 4 | DD-016~018 |
| REQ-007 | TC-UNIT-028~031 | 4 | DD-019~021 |
| REQ-008 | TC-UNIT-032~035 | 4 | DD-022~024 |
| REQ-009 | TC-UNIT-036~039 | 4 | DD-025~027 |
| REQ-010 | TC-UNIT-040~044 | 5 | DD-028~030 |
| REQ-011 | TC-UNIT-045~048 | 4 | DD-031~033 |
| REQ-012 | TC-UNIT-049~054 | 6 | DD-034~036 |
| REQ-013 | TC-UNIT-055~058 | 4 | DD-037~039 |
| REQ-014 | TC-UNIT-059~064 | 6 | DD-040~042 |
| REQ-015 | TC-UNIT-065~070 | 6 | DD-043~045 |
| REQ-016 | TC-UNIT-071~075 | 5 | DD-046~048 |
| REQ-017 | TC-UNIT-076~080 | 5 | DD-049~051 |
| **合计** | TC-UNIT-001~080 | **80** | 51 DD 全覆盖 |

### 6.1 TC-DES-002（类图生成验证）覆盖

| TC-UNIT | 验证类图元素 |
|---|---|
| TC-UNIT-011/012 | User 类 email/passwordHash/role/status 字段 |
| TC-UNIT-049/050 | Article 类 status 状态机字段 |
| TC-UNIT-040/042 | Comment 类 depth/parentId 关联 |
| TC-UNIT-055/057 | CrossReference 类 fromArticleId/toArticleId 关联 |
| TC-UNIT-065/066 | FileAsset 类 sha256/magicType 字段 |
| TC-UNIT-008/009 | Blogger 类 followerCount 关联 |
| TC-UNIT-036/039 | Category 类 parentId/depth 自关联 |
| TC-UNIT-035 | Tag 类 merge 关联 |

### 6.2 TC-DES-003（数据结构设计验证）覆盖

| TC-UNIT | 验证 Map 索引 |
|---|---|
| TC-UNIT-011 | `emailToId` 唯一索引 |
| TC-UNIT-006 | `slugToId` 唯一索引 |
| TC-UNIT-067 | `sha256ToId` 唯一索引（秒传） |
| TC-UNIT-045 | `userIdUnread` 状态索引 |
| TC-UNIT-057 | `toArticleToBackrefs` 二级索引 |
| TC-UNIT-070 | `userIdToFiles` 配额聚合 |
| TC-UNIT-024 | `statusToArticles` 状态索引 |
| TC-UNIT-072 | `targetIdToSubs` 推送反查索引 |

---

## 7. 测试执行约束

- 测试框架：vitest（CON-001 约束）
- 测试文件位置：`test/unit/**/*.spec.ts`
- 命名约定：`<ClassName>.spec.ts`（如 `ArticleStore.spec.ts`）
- 每用例必须含 `expect()` 断言，禁止 `// TODO: assert` 占位
- 测试不得依赖测试顺序（每用例独立）
- 测试不得调用真实网络/文件系统

---

*文档结束。*
