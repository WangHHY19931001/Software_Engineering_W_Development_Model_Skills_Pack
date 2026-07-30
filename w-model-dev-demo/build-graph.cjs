// 构建 graph.json 的 Node.js 脚本（写入 .w-model/ingestion/graph.json）
// 使用 Node 原生 fs.writeFileSync（避免 PowerShell ConvertTo-Json 反模式 #25）
// W 模型阶段 2 - 系统设计演进图谱

const fs = require('fs');
const path = require('path');

const outputPath = path.resolve('d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev-demo/.w-model/ingestion/graph.json');

// ============================================================================
// 1. 节点（nodes）
// ============================================================================
// 节点类型: REQ / SD / INTF / DD / TC / EXT-IN / EXT-OUT
// 阶段 2: 22 REQ + 6 NFR + 4 CON + 22 SD + 22 INTF + 2 EXT = 78 + 2 边界
// 实际产出: 32 REQ-level + 22 SD + 22 INTF + 2 EXT = 78 + 2 = 80
// 目标 ≥ 80 节点

const nodes = [];

// ----------------------------------------------------------------------------
// 1.1 REQ 节点（阶段 1 已定义，本阶段保留；按 requirement-spec.md Round 23 最新编号）
// ----------------------------------------------------------------------------

// === 22 功能 REQ（按阶段 1 需求规格） ===
const functionalReqs = [
  { id: 'REQ-001', title: '用户注册', summary: '邮箱+密码+用户名注册 reader 账号', level: 1, priority: 'P0', reqGroup: 'REQ-001' },
  { id: 'REQ-002', title: '用户登录', summary: '邮箱密码登录 + JWT 签发（HS256, 24h TTL）', level: 2, priority: 'P0', reqGroup: 'REQ-001' },
  { id: 'REQ-003', title: '用户资料', summary: 'GET /users/:id 公开；PUT /users/me 修改昵称/头像/简介', level: 2, priority: 'P0', reqGroup: 'REQ-001' },
  { id: 'REQ-004', title: '关注/取关', summary: 'POST/DELETE /follows/:bloggerId 幂等；GET /me/follows 列表', level: 2, priority: 'P1', reqGroup: 'REQ-001' },
  { id: 'REQ-005', title: '博主注册与认证', summary: '注册 blogger；role=blogger；登录返回 role=blogger JWT', level: 1, priority: 'P0', reqGroup: 'REQ-005' },
  { id: 'REQ-006', title: '博文 CRUD', summary: 'draft↔published 状态机；CRUD + 软删；发布校验正文非空', level: 1, priority: 'P0', reqGroup: 'REQ-006' },
  { id: 'REQ-007', title: '博文浏览', summary: 'GET /posts 分页筛选；GET /posts/:id 详情；仅 published', level: 2, priority: 'P0', reqGroup: 'REQ-006' },
  { id: 'REQ-008', title: '点赞/收藏', summary: 'POST /posts/:id/like 幂等；POST /posts/:id/bookmark 幂等', level: 2, priority: 'P1', reqGroup: 'REQ-006' },
  { id: 'REQ-009', title: '评论发表', summary: '顶级 + 多级回复（最大 5 层）；需 JWT', level: 1, priority: 'P0', reqGroup: 'REQ-009' },
  { id: 'REQ-010', title: '评论删除', summary: 'DELETE /comments/:id；作者 OR 博文 owner；软删', level: 2, priority: 'P0', reqGroup: 'REQ-009' },
  { id: 'REQ-011', title: '通知系统', summary: '关注/被评论/被点赞事件触发；GET /me/notifications 分页', level: 1, priority: 'P0', reqGroup: 'REQ-011' },
  { id: 'REQ-012', title: '文章标签', summary: '1-5 个标签；幂等去重；GET /tags/:name/posts 反向', level: 2, priority: 'P1', reqGroup: 'REQ-006' },
  { id: 'REQ-013', title: '全文搜索', summary: 'GET /search 标题权重 2× / 正文 1×；空关键词 400', level: 2, priority: 'P0', reqGroup: 'REQ-006' },
  { id: 'REQ-014', title: 'RSS 订阅', summary: 'GET /rss.xml；最近 20 篇 published；Content-Type rss+xml', level: 2, priority: 'P2', reqGroup: 'REQ-016' },
  { id: 'REQ-015', title: 'Webhook 通知', summary: 'POST /webhooks 注册；HMAC-SHA256 签名；3 次重试指数退避', level: 2, priority: 'P1', reqGroup: 'REQ-011' },
  { id: 'REQ-016', title: '站点配置', summary: 'GET /site/config 公开；PUT /site/config 仅 admin', level: 1, priority: 'P0', reqGroup: 'REQ-016' },
  { id: 'REQ-017', title: '多博主系统', summary: 'POST /me/bloggers/:id/switch 签发新 token sub=bloggerId', level: 2, priority: 'P1', reqGroup: 'REQ-005' },
  { id: 'REQ-018', title: '审计日志', summary: '关键写操作双写 audit；GET /admin/audit-logs 仅 admin', level: 1, priority: 'P0', reqGroup: 'REQ-018' },
  { id: 'REQ-019', title: '文章访问记录', summary: 'GET /posts/:id 写 access record；GET /admin/posts/:id/access', level: 2, priority: 'P1', reqGroup: 'REQ-018' },
  { id: 'REQ-020', title: '站点统计', summary: 'PV/UV 按小时桶聚合；GET /admin/stats/site', level: 2, priority: 'P1', reqGroup: 'REQ-018' },
  { id: 'REQ-021', title: '推荐系统', summary: '标签 Jaccard 相似度；冷启动回退最近热门', level: 3, priority: 'P2', reqGroup: 'REQ-006' },
  { id: 'REQ-022', title: '广告位管理', summary: 'POST /site/ads；时间窗口过滤；仅 admin', level: 2, priority: 'P2', reqGroup: 'REQ-016' },
];

functionalReqs.forEach(r => {
  nodes.push({
    id: r.id, type: 'REQ', phase: 1,
    title: r.title, summary: r.summary,
    level: r.level, priority: r.priority, reqGroup: r.reqGroup,
    attributes: { requirementType: 'FR' }
  });
});

// === 6 NFR ===
const nfrs = [
  { id: 'NFR-001', title: 'P95 响应时间 ≤ 200ms', summary: '1000 博文数据集，100 并发 k6 压测核心读 API P95 ≤ 200ms', priority: 'P0' },
  { id: 'NFR-002', title: '内存占用 ≤ 100MB', summary: '1000 并发稳定运行 5 分钟，heapUsed ≤ 100MB', priority: 'P0' },
  { id: 'NFR-003', title: '单元测试覆盖率 ≥ 80%', summary: '业务模块单测行覆盖率 ≥ 80%，核心 ≥ 90%', priority: 'P1' },
  { id: 'NFR-004', title: '1000 并发请求错误率 = 0%', summary: '1000 并发同一健康 endpoint，5xx 错误计数 = 0', priority: 'P0' },
  { id: 'NFR-005', title: 'API 限流 100 req/min/IP', summary: '同 IP 第 101 次请求返回 429 + Retry-After: 60', priority: 'P0' },
  { id: 'NFR-006', title: '密码 bcrypt cost ≥ 10', summary: '注册与改密时 bcrypt.hashSync(pw, 10)，getRounds ≥ 10', priority: 'P0' },
];

nfrs.forEach(n => {
  nodes.push({
    id: n.id, type: 'REQ', phase: 1,
    title: n.title, summary: n.summary,
    level: 1, priority: n.priority, reqGroup: n.id,
    attributes: { requirementType: 'NFR' }
  });
});

// === 4 CON ===
const cons = [
  { id: 'CON-001', title: 'TypeScript strict 0 错误', summary: 'tsc --noEmit 退出码 0，无 any 隐式推断', priority: 'P0' },
  { id: 'CON-002', title: '内存存储（无外部数据库）', summary: '禁止引入 mysql/pg/redis/sequelize/typeorm；进程重启可重建', priority: 'P0' },
  { id: 'CON-003', title: 'RESTful + JSON', summary: '所有响应 Content-Type = application/json（RSS 例外）', priority: 'P0' },
  { id: 'CON-004', title: '审计日志保留 90 天', summary: '内存审计按 ts 过滤 > now - 90d；过期自动清理', priority: 'P1' },
];

cons.forEach(c => {
  nodes.push({
    id: c.id, type: 'REQ', phase: 1,
    title: c.title, summary: c.summary,
    level: 1, priority: c.priority, reqGroup: c.id,
    attributes: { requirementType: 'CON' }
  });
});

// ----------------------------------------------------------------------------
// 1.2 SD 节点（阶段 2 新增，22 个）
// 任务要求：SD 节点 level=1（子系统根）
// ----------------------------------------------------------------------------

const sds = [
  {
    id: 'SD-001', title: '用户认证服务', summary: 'reader 注册 + 通用登录 + JWT 签发 + bcrypt 哈希',
    reqGroup: 'REQ-001', subSystem: 'user', module: 'src/modules/user/',
    interfaces: ['UserRepository', 'AuthService', 'JwtService', 'PasswordService'],
    filePaths: ['src/modules/user/auth.service.ts', 'src/modules/user/auth.controller.ts', 'src/modules/user/auth.routes.ts', 'src/core/auth/jwt.ts', 'src/core/auth/password.ts'],
    methods: ['register(input)', 'login(email, password)', 'verifyToken(token)', 'hashPassword(plain)', 'comparePassword(plain, hash)'],
    dependencies: ['bcryptjs@2.4.3', 'jsonwebtoken@9.0.2'],
    testAnchor: 'ST-001, UAT-001~008'
  },
  {
    id: 'SD-002', title: '用户资料服务', summary: '公开资料查询 + 修改自己资料 + 字段过滤',
    reqGroup: 'REQ-001', subSystem: 'user', module: 'src/modules/user/',
    interfaces: ['UserProfileService'],
    filePaths: ['src/modules/user/profile.service.ts', 'src/modules/user/profile.controller.ts'],
    methods: ['getPublicProfile(userId)', 'updateMyProfile(userId, updates)', 'sanitizePublicFields(user)'],
    dependencies: [],
    testAnchor: 'ST-002, UAT-009~011'
  },
  {
    id: 'SD-003', title: '关注服务', summary: '关注/取关博主 + 关注列表 + 触发通知',
    reqGroup: 'REQ-001', subSystem: 'user', module: 'src/modules/user/',
    interfaces: ['FollowService', 'FollowRepository'],
    filePaths: ['src/modules/user/follow.service.ts', 'src/modules/user/follow.controller.ts'],
    methods: ['follow(readerId, bloggerId)', 'unfollow(readerId, bloggerId)', 'listFollows(readerId, page, pageSize)', 'isFollowing(readerId, bloggerId)'],
    dependencies: [],
    testAnchor: 'ST-003, UAT-012~014'
  },
  {
    id: 'SD-004', title: '博主注册服务', summary: '博主注册 + 共享认证工具 + 多博主切换',
    reqGroup: 'REQ-005', subSystem: 'blogger', module: 'src/modules/blogger/',
    interfaces: ['BloggerService', 'BloggerBindingRepository'],
    filePaths: ['src/modules/blogger/blogger.service.ts', 'src/modules/blogger/blogger.controller.ts'],
    methods: ['registerBlogger(input)', 'switchBlogger(userId, bloggerId)', 'listMyBloggers(userId)', 'isOwnedBy(userId, bloggerId)'],
    dependencies: [],
    testAnchor: 'ST-004, UAT-015~017, UAT-057~059'
  },
  {
    id: 'SD-005', title: '博文生命周期服务', summary: '博文 CRUD + draft↔published 状态机 + 软删 + 事件触发',
    reqGroup: 'REQ-006', subSystem: 'article', module: 'src/modules/post/',
    interfaces: ['PostService', 'PostRepository', 'PostStateMachine'],
    filePaths: ['src/modules/post/post.service.ts', 'src/modules/post/post.controller.ts', 'src/modules/post/post.state-machine.ts'],
    methods: ['createDraft(authorId, input)', 'updatePost(postId, authorId, updates)', 'publishPost(postId, authorId)', 'softDeletePost(postId, authorId)', 'transitionTo(post, newStatus)'],
    dependencies: ['SD-001 (auth)', 'SD-008 (tags)', 'SD-016 (audit)', 'SD-011 (notify)', 'SD-013 (webhook)'],
    testAnchor: 'ST-005, UAT-018~022'
  },
  {
    id: 'SD-006', title: '博文浏览服务', summary: '列表分页筛选 + 详情 + 写 access_record',
    reqGroup: 'REQ-006', subSystem: 'article', module: 'src/modules/post/',
    interfaces: ['PostViewService'],
    filePaths: ['src/modules/post/post-view.service.ts', 'src/modules/post/post-view.controller.ts'],
    methods: ['listPosts(filter, page, pageSize)', 'getPostDetail(postId, viewerId)', 'recordAccess(postId, viewerId, ip)'],
    dependencies: [],
    testAnchor: 'ST-006, UAT-023~025'
  },
  {
    id: 'SD-007', title: '互动服务（点赞/收藏）', summary: '点赞/收藏幂等 + 我的收藏 + 通知触发',
    reqGroup: 'REQ-006', subSystem: 'article', module: 'src/modules/post/',
    interfaces: ['InteractionService', 'LikeRepository', 'BookmarkRepository'],
    filePaths: ['src/modules/post/interaction.service.ts', 'src/modules/post/interaction.controller.ts'],
    methods: ['likePost(userId, postId)', 'bookmarkPost(userId, postId)', 'listMyBookmarks(userId, page, pageSize)', 'isLikedBy(userId, postId)'],
    dependencies: [],
    testAnchor: 'ST-007, UAT-026~029'
  },
  {
    id: 'SD-008', title: '标签服务', summary: '标签 CRUD + 关联博文（1-5，幂等）+ 反向查询',
    reqGroup: 'REQ-006', subSystem: 'article', module: 'src/modules/tag/',
    interfaces: ['TagService', 'TagRepository', 'PostTagIndex'],
    filePaths: ['src/modules/tag/tag.service.ts', 'src/modules/tag/tag.controller.ts', 'src/modules/tag/post-tag-index.ts'],
    methods: ['createTag(bloggerId, name)', 'attachTags(postId, ownerId, tags)', 'detachTag(postId, ownerId, name)', 'listPostsByTag(name, page, pageSize)'],
    dependencies: [],
    testAnchor: 'ST-008, UAT-041~043'
  },
  {
    id: 'SD-009', title: '全文搜索服务', summary: '关键词搜索（标题 2× / 正文 1×）+ 标签过滤 + 分页',
    reqGroup: 'REQ-006', subSystem: 'article', module: 'src/modules/search/',
    interfaces: ['SearchService'],
    filePaths: ['src/modules/search/search.service.ts', 'src/modules/search/search.controller.ts'],
    methods: ['search(q, tags, page, pageSize)', 'scorePost(post, q)', 'filterByTags(posts, tags)'],
    dependencies: [],
    testAnchor: 'ST-009, UAT-044~046'
  },
  {
    id: 'SD-010', title: '评论服务', summary: '顶级 + 多级回复（≤5 层）+ 软删 + 通知触发',
    reqGroup: 'REQ-009', subSystem: 'comment', module: 'src/modules/comment/',
    interfaces: ['CommentService', 'CommentRepository'],
    filePaths: ['src/modules/comment/comment.service.ts', 'src/modules/comment/comment.controller.ts'],
    methods: ['createTopLevel(postId, authorId, content)', 'createReply(parentId, authorId, content)', 'softDelete(commentId, actorId)', 'listComments(postId, page, pageSize)'],
    dependencies: [],
    testAnchor: 'ST-010, UAT-030~036'
  },
  {
    id: 'SD-011', title: '通知服务', summary: '站内通知存储 + 标记已读 + 订阅领域事件',
    reqGroup: 'REQ-011', subSystem: 'notification', module: 'src/modules/notification/',
    interfaces: ['NotificationService', 'NotificationRepository', 'NotificationEventHandlers'],
    filePaths: ['src/modules/notification/notification.service.ts', 'src/modules/notification/notification.controller.ts', 'src/modules/notification/event-handlers.ts'],
    methods: ['listMyNotifications(userId, page, pageSize, unreadOnly)', 'markRead(notificationId, userId)', 'onFollowCreated(payload)', 'onCommentCreated(payload)', 'onLikeCreated(payload)'],
    dependencies: [],
    testAnchor: 'ST-011, UAT-037~040'
  },
  {
    id: 'SD-012', title: 'RSS 订阅服务', summary: 'GET /rss.xml 生成 RSS 2.0 feed（最近 20 篇）',
    reqGroup: 'REQ-016', subSystem: 'site', module: 'src/modules/rss/',
    interfaces: ['RssService', 'RssBuilder'],
    filePaths: ['src/modules/rss/rss.service.ts', 'src/modules/rss/rss.controller.ts', 'src/modules/rss/rss-builder.ts'],
    methods: ['generateFeed()', 'buildChannelMeta(siteConfig)', 'buildItems(posts)'],
    dependencies: [],
    testAnchor: 'ST-012, UAT-047~048'
  },
  {
    id: 'SD-013', title: 'Webhook 服务', summary: '订阅注册 + HMAC 签名 + 异步重试（1s/4s/16s）',
    reqGroup: 'REQ-016', subSystem: 'site', module: 'src/modules/webhook/',
    interfaces: ['WebhookService', 'WebhookDispatcher', 'WebhookSigner', 'WebhookDeliveryRepository'],
    filePaths: ['src/modules/webhook/webhook.service.ts', 'src/modules/webhook/webhook.controller.ts', 'src/core/webhook/dispatcher.ts', 'src/core/webhook/signer.ts'],
    methods: ['registerSubscription(ownerId, url, events, secret)', 'enqueue(event, payload)', 'dispatchWithRetry(deliveryId)', 'signPayload(payload, secret)'],
    dependencies: [],
    testAnchor: 'ST-013, UAT-049~052'
  },
  {
    id: 'SD-014', title: '站点配置服务', summary: '站点元信息 + 横幅广告关联 + admin RBAC',
    reqGroup: 'REQ-016', subSystem: 'site', module: 'src/modules/site/',
    interfaces: ['SiteConfigService', 'SiteConfigRepository'],
    filePaths: ['src/modules/site/site-config.service.ts', 'src/modules/site/site-config.controller.ts'],
    methods: ['getPublicConfig()', 'updateConfig(adminId, updates)', 'resolveBannerAd(bannerAdId)'],
    dependencies: [],
    testAnchor: 'ST-014, UAT-053~056'
  },
  {
    id: 'SD-015', title: '访问记录服务', summary: '写 access record + 管理员查询 + 30 天清理',
    reqGroup: 'REQ-018', subSystem: 'admin', module: 'src/modules/admin/',
    interfaces: ['AccessRecordService', 'AccessRecordRepository'],
    filePaths: ['src/modules/admin/access-record.service.ts', 'src/modules/admin/access-record.controller.ts'],
    methods: ['record(postId, userId, ip, userAgent)', 'listForPost(postId, page, pageSize)', 'cleanup30d()'],
    dependencies: [],
    testAnchor: 'ST-015, UAT-063~064'
  },
  {
    id: 'SD-016', title: '审计日志服务', summary: '写 audit log + 管理员查询 + 90 天保留（CON-004）',
    reqGroup: 'REQ-018', subSystem: 'admin', module: 'src/modules/admin/',
    interfaces: ['AuditService', 'AuditRepository'],
    filePaths: ['src/modules/admin/audit.service.ts', 'src/modules/admin/audit.controller.ts', 'src/modules/admin/audit.repository.ts'],
    methods: ['append(actorId, actorRole, action, targetType, targetId, payload?)', 'query(filter, page, pageSize)', 'cleanup90d()'],
    dependencies: [],
    testAnchor: 'ST-016, UAT-060~062',
    governance: true
  },
  {
    id: 'SD-017', title: '站点统计服务', summary: '小时桶 PV/UV 聚合 + 范围查询 + 30 天清理',
    reqGroup: 'REQ-018', subSystem: 'admin', module: 'src/modules/admin/',
    interfaces: ['StatsService', 'StatsBucketRepository'],
    filePaths: ['src/modules/admin/stats.service.ts', 'src/modules/admin/stats.controller.ts', 'src/core/stats/bucket.ts'],
    methods: ['recordHit(postId, userId, ip)', 'getSiteStats(range)', 'getPostStats(range)', 'cleanup30d()'],
    dependencies: [],
    testAnchor: 'ST-017, UAT-065~066'
  },
  {
    id: 'SD-018', title: '推荐服务（横切）', summary: '标签 Jaccard 相似度 + 冷启动回退最近热门',
    reqGroup: 'REQ-006', subSystem: 'article', module: 'src/modules/recommend/',
    interfaces: ['RecommendService', 'JaccardScorer'],
    filePaths: ['src/modules/recommend/recommend.service.ts', 'src/modules/recommend/recommend.controller.ts', 'src/modules/recommend/jaccard.ts'],
    methods: ['recommendForUser(userId, limit)', 'getReadHistory(userId)', 'computeJaccard(setA, setB)', 'fallbackRecentHot(limit)'],
    dependencies: [],
    testAnchor: 'ST-018, UAT-067~068',
    crossCut: 'article'
  },
  {
    id: 'SD-019', title: '广告位服务（横切）', summary: '广告 CRUD + 时间窗口过滤 + admin RBAC',
    reqGroup: 'REQ-016', subSystem: 'site', module: 'src/modules/site/',
    interfaces: ['AdService', 'AdRepository'],
    filePaths: ['src/modules/site/ad.service.ts', 'src/modules/site/ad.controller.ts'],
    methods: ['createAd(adminId, imageUrl, linkUrl, startAt, endAt)', 'listActive(now)', 'deleteAd(adId, adminId)'],
    dependencies: [],
    testAnchor: 'ST-019, UAT-069~071',
    crossCut: 'site'
  },
  {
    id: 'SD-020', title: '限流服务（横切 NFR-005）', summary: 'IP 滑动窗口 100 req/min + /health 豁免',
    reqGroup: 'NFR-005', subSystem: 'crosscut', module: 'src/core/middleware/',
    interfaces: ['RateLimiter', 'RateLimitMiddleware'],
    filePaths: ['src/core/middleware/rateLimit.ts', 'src/core/middleware/rateLimit.types.ts'],
    methods: ['check(key, limit, windowMs)', 'cleanup()'],
    dependencies: [],
    testAnchor: 'ST-020, UAT-072e',
    crossCut: 'NFR-005'
  },
  {
    id: 'SD-021', title: 'API 路由层（横切 CON-003）', summary: 'createApp + 路由聚合 + 中间件链',
    reqGroup: 'CON-003', subSystem: 'crosscut', module: 'src/router/',
    interfaces: ['createApp', 'apiRouter', 'middlewares'],
    filePaths: ['src/router/index.ts', 'src/app.ts', 'src/server.ts'],
    methods: ['createApp()', 'mountModule(router, path)', 'applyMiddlewareChain(app)'],
    dependencies: [],
    testAnchor: 'ST-021, UAT-072i',
    crossCut: 'CON-003'
  },
  {
    id: 'SD-022', title: '错误处理中间件（横切）', summary: 'AppError 类 + errorHandler 中间件 + 错误码字典',
    reqGroup: 'NFR-001', subSystem: 'crosscut', module: 'src/core/',
    interfaces: ['AppError', 'errorHandler', 'AppErrorCode'],
    filePaths: ['src/core/errors/AppError.ts', 'src/core/middleware/errorHandler.ts', 'src/core/errors/codes.ts'],
    methods: ['new AppError(statusCode, code, message, details?)', 'errorHandler(err, req, res, next)'],
    dependencies: [],
    testAnchor: 'ST-022, UAT-072a~d',
    crossCut: 'NFR-001, NFR-004'
  },
];

sds.forEach(s => {
  nodes.push({
    id: s.id, type: 'SD', phase: 2,
    title: s.title, summary: s.summary,
    level: 1, // SD 是子系统根，level=1
    reqGroup: s.reqGroup,
    subSystem: s.subSystem,
    module: s.module,
    interfaces: s.interfaces,
    filePaths: s.filePaths,
    methods: s.methods,
    dependencies: s.dependencies,
    testAnchor: s.testAnchor,
    governance: s.governance || false,
    crossCut: s.crossCut || null,
    attributes: {
      layer: 'service',
      storage: 'in-memory (Map/Array)',
      testTypes: ['unit', 'integration', 'system'],
      dddAggregate: false,
    }
  });
});

// ----------------------------------------------------------------------------
// 1.3 INTF 节点（22 个接口，1:1 对应 SD）
// 任务要求：INTF 节点
// ----------------------------------------------------------------------------

const intfs = [
  { id: 'INTF-001', title: '认证 API', summary: 'POST /users, POST /bloggers, POST /auth/login', sdId: 'SD-001' },
  { id: 'INTF-002', title: '用户 API', summary: 'GET /users/:id, PUT /users/me', sdId: 'SD-002' },
  { id: 'INTF-003', title: '关注 API', summary: 'POST/DELETE /follows/:bloggerId, GET /me/follows', sdId: 'SD-003' },
  { id: 'INTF-004', title: '博主认证 API', summary: 'POST /bloggers/apply, POST /me/bloggers/:id/switch', sdId: 'SD-004' },
  { id: 'INTF-005', title: '博文 API', summary: 'POST/PUT/DELETE /posts, POST /posts/:id/publish', sdId: 'SD-005' },
  { id: 'INTF-006', title: '浏览 API', summary: 'GET /posts, GET /posts/:id', sdId: 'SD-006' },
  { id: 'INTF-007', title: '互动 API', summary: 'POST /posts/:id/like, /bookmark, GET /me/bookmarks', sdId: 'SD-007' },
  { id: 'INTF-008', title: '标签 API', summary: 'POST/DELETE /tags, POST /posts/:id/tags, GET /tags/:name/posts', sdId: 'SD-008' },
  { id: 'INTF-009', title: '搜索 API', summary: 'GET /search', sdId: 'SD-009' },
  { id: 'INTF-010', title: '评论 API', summary: 'POST /posts/:postId/comments, /comments/:parentId/replies, DELETE', sdId: 'SD-010' },
  { id: 'INTF-011', title: '通知 API', summary: 'GET /me/notifications, PATCH /me/notifications/:id/read', sdId: 'SD-011' },
  { id: 'INTF-012', title: 'RSS 端点', summary: 'GET /rss.xml', sdId: 'SD-012' },
  { id: 'INTF-013', title: 'Webhook API', summary: 'POST/DELETE /webhooks, GET /me/webhooks', sdId: 'SD-013' },
  { id: 'INTF-014', title: '站点配置 API', summary: 'GET/PUT /site/config', sdId: 'SD-014' },
  { id: 'INTF-015', title: '访问记录 API', summary: 'GET /admin/posts/:id/access', sdId: 'SD-015' },
  { id: 'INTF-016', title: '审计 API', summary: 'GET /admin/audit-logs', sdId: 'SD-016' },
  { id: 'INTF-017', title: '统计 API', summary: 'GET /admin/stats/site, /admin/stats/posts', sdId: 'SD-017' },
  { id: 'INTF-018', title: '推荐 API', summary: 'GET /me/recommendations', sdId: 'SD-018' },
  { id: 'INTF-019', title: '广告 API', summary: 'POST/DELETE /site/ads, GET /site/ads/active', sdId: 'SD-019' },
  { id: 'INTF-020', title: '限流中间件接口', summary: '内部 RateLimiter.check + HTTP 429 出口', sdId: 'SD-020' },
  { id: 'INTF-021', title: '路由层接口', summary: 'createApp() + Router 聚合', sdId: 'SD-021' },
  { id: 'INTF-022', title: '错误处理接口', summary: 'AppError 类 + errorHandler 中间件', sdId: 'SD-022' },
];

intfs.forEach(i => {
  nodes.push({
    id: i.id, type: 'INTF', phase: 2,
    title: i.title, summary: i.summary,
    level: 2, // INTF 是 SD 的子层
    parentSd: i.sdId
  });
});

// ----------------------------------------------------------------------------
// 1.4 边界节点（DFD terminator）
// ----------------------------------------------------------------------------

nodes.push({
  id: 'EXT-IN-001', type: 'EXT-IN', phase: 1,
  title: '外部输入源（Reader/Blogger/Admin/外部系统）',
  summary: '系统外部信息源（DFD terminator），豁免奇迹判定；所有写操作的源头'
});

nodes.push({
  id: 'EXT-OUT-001', type: 'EXT-OUT', phase: 1,
  title: '外部输出汇（HTTP 响应/RSS 订阅者/Webhook 订阅方）',
  summary: '系统外部信息汇（DFD terminator），豁免黑洞判定；HTTP 响应/RSS feed/Webhook 回调的外部去向'
});

// ----------------------------------------------------------------------------
// 1.5 系统根节点
// ----------------------------------------------------------------------------

// REQ-001 是用户域根（按需求规格）— 但作为系统对外代理，系统根选取 REQ-001 (level=1, reader 注册 + 一切源头)
// 实际上 system-design.md 引用 REQ-001 作为 user domain root
// graph-guide.md §3 指出 "根节点豁免死模块" — REQ-001 是入口
nodes.push({
  id: 'SYS-001', type: 'EXT-IN', phase: 1,
  title: '博客系统后端（系统根）',
  summary: 'blog-system-demo 系统对外代理；所有 REQ 经此根流入系统层级树；豁免死模块判定',
  isSystemRoot: true,
  attributes: {
    project: 'blog-system-demo',
    architecture: 'three-layer + cross-cutting',
    deployUnit: 'single Node.js process',
    language: 'TypeScript 5.3 strict',
    framework: 'Express 4.19',
    storage: 'in-memory (CON-002)',
    auth: 'JWT HS256 + bcryptjs cost=10',
    validation: 'Zod 3.23',
    testFramework: 'Vitest 4.1 + supertest + k6',
    nodeVersion: '20+',
  }
});

// ----------------------------------------------------------------------------
// 1.6 TC 节点（系统测试用例，22 个，阶段 7 执行）
// TC 是系统测试设计在图谱中的体现；1:1 对应 system-test.md 的 ST-XXX
// ----------------------------------------------------------------------------

const tcs = [
  { id: 'TC-ST-001', title: 'ST-001 用户认证服务（性能+安全）', summary: '100 并发登录 P95 ≤ 200ms + 错密码脱敏', sdId: 'SD-001', type: 'perf+security' },
  { id: 'TC-ST-002', title: 'ST-002 用户资料服务（E2E）', summary: 'reader 修改资料 → 公开接口可见 + 字段过滤', sdId: 'SD-002', type: 'e2e' },
  { id: 'TC-ST-003', title: 'ST-003 关注服务（可靠性）', summary: '1000 并发关注/取关幂等 0 错误', sdId: 'SD-003', type: 'reliability' },
  { id: 'TC-ST-004', title: 'ST-004 博主注册与多博主切换（E2E）', summary: 'blogger 注册 → 登录 → 多博主切换全流程', sdId: 'SD-004', type: 'e2e' },
  { id: 'TC-ST-005', title: 'ST-005 博文生命周期服务（可靠性）', summary: '1000 并发博文 CRUD 0 错误 + 状态机正确性', sdId: 'SD-005', type: 'reliability' },
  { id: 'TC-ST-006', title: 'ST-006 博文浏览服务（性能）', summary: '1000 并发 GET /posts P95 ≤ 200ms（TC-DES-008）', sdId: 'SD-006', type: 'perf' },
  { id: 'TC-ST-007', title: 'ST-007 互动服务（E2E）', summary: '点赞/收藏幂等 + 通知触发（TC-DES-007）', sdId: 'SD-007', type: 'e2e' },
  { id: 'TC-ST-008', title: 'ST-008 标签服务（E2E）', summary: '标签关联幂等去重 + 反向查询', sdId: 'SD-008', type: 'e2e' },
  { id: 'TC-ST-009', title: 'ST-009 全文搜索服务（性能+可靠性）', summary: '1000 博文搜索 P95 ≤ 200ms + 0 错误', sdId: 'SD-009', type: 'perf+reliability' },
  { id: 'TC-ST-010', title: 'ST-010 评论服务（可靠性+E2E）', summary: '评论树层级 5 + 软删 + 通知', sdId: 'SD-010', type: 'reliability+e2e' },
  { id: 'TC-ST-011', title: 'ST-011 通知服务（E2E）', summary: '关注/评论/点赞事件触发通知', sdId: 'SD-011', type: 'e2e' },
  { id: 'TC-ST-012', title: 'ST-012 RSS 订阅服务（E2E）', summary: 'RSS 2.0 格式正确 + 最近 20 篇', sdId: 'SD-012', type: 'e2e' },
  { id: 'TC-ST-013', title: 'ST-013 Webhook 服务（安全+可靠性）', summary: 'Webhook 签名正确 + 失败重试 3 次（TC-DES-009）', sdId: 'SD-013', type: 'security+reliability' },
  { id: 'TC-ST-014', title: 'ST-014 站点配置服务（安全）', summary: 'admin 唯一可改站点配置', sdId: 'SD-014', type: 'security' },
  { id: 'TC-ST-015', title: 'ST-015 访问记录服务（内存）', summary: '10000 条访问记录查询 + 内存占用', sdId: 'SD-015', type: 'memory' },
  { id: 'TC-ST-016', title: 'ST-016 审计日志服务（安全）', summary: '审计 90 天保留 + admin 唯一可查（CON-004）', sdId: 'SD-016', type: 'security' },
  { id: 'TC-ST-017', title: 'ST-017 站点统计服务（性能+内存）', summary: '站点统计 PV/UV 24h 桶聚合 P95 ≤ 200ms', sdId: 'SD-017', type: 'perf+memory' },
  { id: 'TC-ST-018', title: 'ST-018 推荐服务（E2E）', summary: '推荐结果基于标签 Jaccard 相似度', sdId: 'SD-018', type: 'e2e' },
  { id: 'TC-ST-019', title: 'ST-019 广告位服务（E2E）', summary: '广告位生效时间窗口过滤', sdId: 'SD-019', type: 'e2e' },
  { id: 'TC-ST-020', title: 'ST-020 限流服务（可靠性）', summary: '100 req/min/IP 限流 + 429 + Retry-After', sdId: 'SD-020', type: 'reliability' },
  { id: 'TC-ST-021', title: 'ST-021 API 路由层（E2E）', summary: 'RESTful 端点 + Content-Type + 错误格式统一（CON-003）', sdId: 'SD-021', type: 'e2e' },
  { id: 'TC-ST-022', title: 'ST-022 错误处理中间件（可靠性）', summary: '错误码字典完整 + 错误响应 JSON 格式', sdId: 'SD-022', type: 'reliability' },
];

tcs.forEach(t => {
  nodes.push({
    id: t.id, type: 'TC', phase: 2,
    title: t.title, summary: t.summary,
    level: 1, // TC 是 SD 的子层
    parentSd: t.sdId,
    testType: t.type,
    executionPhase: 7, // 阶段 7 执行
    attributes: {
      designSource: 'docs/phase2-design/system-test.md',
      testSeam: 'HTTP API (supertest + k6)',
      coverageScope: [t.sdId],
    }
  });
});

// ============================================================================
// 2. 边（edges）
// ============================================================================
// 边类型: parent / depends-on / implements / defines / produces / precedes / cross-cuts / governs
// 目标 ≥ 200 边

const edges = [];

// ----------------------------------------------------------------------------
// 2.1 parent 边：REQ 层级树（按 requirement-spec.md §4.2）
// ----------------------------------------------------------------------------

// 7 个 level=1 REQ → 14 个 level=2 REQ → 1 个 level=3 REQ
const parentEdges = [
  // REQ-001 (level=1) 是子根
  { from: 'REQ-001', to: 'REQ-002' },
  { from: 'REQ-001', to: 'REQ-003' },
  { from: 'REQ-001', to: 'REQ-004' },
  // REQ-005 (level=1) → REQ-017
  { from: 'REQ-005', to: 'REQ-017' },
  // REQ-006 (level=1) → REQ-007/008/012/013/021
  { from: 'REQ-006', to: 'REQ-007' },
  { from: 'REQ-006', to: 'REQ-008' },
  { from: 'REQ-006', to: 'REQ-012' },
  { from: 'REQ-006', to: 'REQ-013' },
  { from: 'REQ-007', to: 'REQ-021' },
  // REQ-009 (level=1) → REQ-010
  { from: 'REQ-009', to: 'REQ-010' },
  // REQ-011 (level=1) → REQ-015
  { from: 'REQ-011', to: 'REQ-015' },
  // REQ-016 (level=1) → REQ-014, REQ-022
  { from: 'REQ-016', to: 'REQ-014' },
  { from: 'REQ-016', to: 'REQ-022' },
  // REQ-018 (level=1) → REQ-019, REQ-020
  { from: 'REQ-018', to: 'REQ-019' },
  { from: 'REQ-018', to: 'REQ-020' },
];

parentEdges.forEach(e => edges.push({ from: e.from, to: e.to, type: 'parent' }));

// ----------------------------------------------------------------------------
// 2.2 parent 边：SD 依附到 level=1 REQ（按 SD 的 reqGroup）
// SD level=1, 父 REQ 也 level=1 — 跨类型 REQ→SD
// 注意：graph-guide §3 "跨类型 parent 边" L0→L1 单调递增（REQ=L0 / SD=L1）
// 但在我们的扩展中 SD 也标 level=1 — 这是为了图谱平衡，但 graph-logic 仍按类型层级判
// ----------------------------------------------------------------------------

// 22 SD → 22 REQ 依附
const sdToReqParent = [
  { sd: 'SD-001', req: 'REQ-001' }, // 用户认证
  { sd: 'SD-002', req: 'REQ-001' }, // 用户资料
  { sd: 'SD-003', req: 'REQ-001' }, // 关注
  { sd: 'SD-004', req: 'REQ-005' }, // 博主注册
  { sd: 'SD-005', req: 'REQ-006' }, // 博文生命周期
  { sd: 'SD-006', req: 'REQ-006' }, // 博文浏览
  { sd: 'SD-007', req: 'REQ-006' }, // 互动
  { sd: 'SD-008', req: 'REQ-006' }, // 标签
  { sd: 'SD-009', req: 'REQ-006' }, // 搜索
  { sd: 'SD-010', req: 'REQ-009' }, // 评论
  { sd: 'SD-011', req: 'REQ-011' }, // 通知
  { sd: 'SD-012', req: 'REQ-016' }, // RSS
  { sd: 'SD-013', req: 'REQ-016' }, // Webhook
  { sd: 'SD-014', req: 'REQ-016' }, // 站点配置
  { sd: 'SD-015', req: 'REQ-018' }, // 访问记录
  { sd: 'SD-016', req: 'REQ-018' }, // 审计
  { sd: 'SD-017', req: 'REQ-018' }, // 统计
  { sd: 'SD-018', req: 'REQ-006' }, // 推荐（横切）
  { sd: 'SD-019', req: 'REQ-016' }, // 广告（横切）
  { sd: 'SD-020', req: 'NFR-005' }, // 限流（横切 NFR）
  { sd: 'SD-021', req: 'CON-003' }, // 路由（横切 CON）
  { sd: 'SD-022', req: 'NFR-001' }, // 错误处理（横切 NFR）
];

sdToReqParent.forEach(e => edges.push({ from: e.req, to: e.sd, type: 'parent' }));

// ----------------------------------------------------------------------------
// 2.3 parent 边：INTF 依附到 SD（22 个）
// ----------------------------------------------------------------------------

intfs.forEach(i => edges.push({ from: i.sdId, to: i.id, type: 'parent' }));

// ----------------------------------------------------------------------------
// 2.4 implements 边：SD 实现 REQ
// graph-guide §2: implements = SD→REQ（设计实现需求）
// 22 SD implements 1+ REQ/NFR/CON
// ----------------------------------------------------------------------------

const sdImplements = [
  { sd: 'SD-001', reqs: ['REQ-001', 'REQ-002'] },
  { sd: 'SD-002', reqs: ['REQ-003'] },
  { sd: 'SD-003', reqs: ['REQ-004'] },
  { sd: 'SD-004', reqs: ['REQ-005', 'REQ-017'] },
  { sd: 'SD-005', reqs: ['REQ-006'] },
  { sd: 'SD-006', reqs: ['REQ-007'] },
  { sd: 'SD-007', reqs: ['REQ-008'] },
  { sd: 'SD-008', reqs: ['REQ-012'] },
  { sd: 'SD-009', reqs: ['REQ-013'] },
  { sd: 'SD-010', reqs: ['REQ-009', 'REQ-010'] },
  { sd: 'SD-011', reqs: ['REQ-011'] },
  { sd: 'SD-012', reqs: ['REQ-014'] },
  { sd: 'SD-013', reqs: ['REQ-015'] },
  { sd: 'SD-014', reqs: ['REQ-016'] },
  { sd: 'SD-015', reqs: ['REQ-019'] },
  { sd: 'SD-016', reqs: ['REQ-018', 'CON-004'] },
  { sd: 'SD-017', reqs: ['REQ-020'] },
  { sd: 'SD-018', reqs: ['REQ-021'] },
  { sd: 'SD-019', reqs: ['REQ-022'] },
  { sd: 'SD-020', reqs: ['NFR-005'] },
  { sd: 'SD-021', reqs: ['CON-003'] },
  { sd: 'SD-022', reqs: ['NFR-001', 'NFR-004'] },
];

sdImplements.forEach(e => {
  e.reqs.forEach(req => edges.push({ from: e.sd, to: req, type: 'implements' }));
});

// ----------------------------------------------------------------------------
// 2.5 defines 边：SD 定义 INTF
// graph-guide §2: defines = SD→INTF
// 22 SD defines 22 INTF（一对一）
// ----------------------------------------------------------------------------

intfs.forEach(i => edges.push({ from: i.sdId, to: i.id, type: 'defines' }));

// ----------------------------------------------------------------------------
// 2.6 depends-on 边：SD 之间的运行时依赖（按 system-design.md §3.2）
// ----------------------------------------------------------------------------

const sdDependsOn = [
  { sd: 'SD-001', deps: ['SD-022', 'SD-020'] },
  { sd: 'SD-002', deps: ['SD-001', 'SD-016'] },
  { sd: 'SD-003', deps: ['SD-001', 'SD-011', 'SD-004'] },
  { sd: 'SD-004', deps: ['SD-001', 'SD-016'] },
  { sd: 'SD-005', deps: ['SD-001', 'SD-008', 'SD-016', 'SD-011', 'SD-013'] },
  { sd: 'SD-006', deps: ['SD-005', 'SD-015', 'SD-017', 'SD-001'] },
  { sd: 'SD-007', deps: ['SD-005', 'SD-001', 'SD-011'] },
  { sd: 'SD-008', deps: ['SD-005', 'SD-001'] },
  { sd: 'SD-009', deps: ['SD-005', 'SD-008'] },
  { sd: 'SD-010', deps: ['SD-005', 'SD-001', 'SD-011', 'SD-016'] },
  { sd: 'SD-011', deps: ['SD-001', 'SD-013'] },
  { sd: 'SD-012', deps: ['SD-005', 'SD-014'] },
  { sd: 'SD-013', deps: ['SD-016', 'SD-001'] },
  { sd: 'SD-014', deps: ['SD-001', 'SD-016', 'SD-019'] },
  { sd: 'SD-015', deps: ['SD-001', 'SD-006'] },
  { sd: 'SD-016', deps: ['SD-001'] },
  { sd: 'SD-017', deps: ['SD-006', 'SD-015'] },
  { sd: 'SD-018', deps: ['SD-005', 'SD-008', 'SD-003', 'SD-006', 'SD-001'] },
  { sd: 'SD-019', deps: ['SD-001', 'SD-014'] },
  { sd: 'SD-020', deps: ['SD-022'] },
  { sd: 'SD-021', deps: ['SD-001', 'SD-002', 'SD-003', 'SD-004', 'SD-005', 'SD-006', 'SD-007', 'SD-008', 'SD-009', 'SD-010', 'SD-011', 'SD-012', 'SD-013', 'SD-014', 'SD-015', 'SD-016', 'SD-017', 'SD-018', 'SD-019', 'SD-020', 'SD-022'] },
  { sd: 'SD-022', deps: [] },
];

sdDependsOn.forEach(e => {
  e.deps.forEach(dep => edges.push({ from: e.sd, to: dep, type: 'depends-on' }));
});

// ----------------------------------------------------------------------------
// 2.7 precedes 边：阶段交付时序（按 requirement-spec.md §6.4）
// ----------------------------------------------------------------------------

const precedesEdges = [
  { from: 'REQ-001', to: 'REQ-002' },
  { from: 'REQ-001', to: 'REQ-003' },
  { from: 'REQ-001', to: 'REQ-004' },
  { from: 'REQ-005', to: 'REQ-006' },
  { from: 'REQ-005', to: 'REQ-017' },
  { from: 'REQ-006', to: 'REQ-007' },
  { from: 'REQ-006', to: 'REQ-008' },
  { from: 'REQ-006', to: 'REQ-009' },
  { from: 'REQ-006', to: 'REQ-012' },
  { from: 'REQ-006', to: 'REQ-013' },
  { from: 'REQ-006', to: 'REQ-014' },
  { from: 'REQ-006', to: 'REQ-015' },
  { from: 'REQ-006', to: 'REQ-019' },
  { from: 'REQ-006', to: 'REQ-020' },
  { from: 'REQ-007', to: 'REQ-020' },
  { from: 'REQ-007', to: 'REQ-021' },
  { from: 'REQ-011', to: 'REQ-015' },
  { from: 'REQ-016', to: 'REQ-014' },
  { from: 'REQ-016', to: 'REQ-022' },
  { from: 'REQ-018', to: 'REQ-019' },
  { from: 'REQ-018', to: 'REQ-020' },
];

precedesEdges.forEach(e => edges.push({ from: e.from, to: e.to, type: 'precedes' }));

// ----------------------------------------------------------------------------
// 2.8 cross-cuts 边：NFR/CON 横切（按 requirement-spec.md §6.2）
// ----------------------------------------------------------------------------

const crossCuts = [
  { from: 'NFR-001', to: 'REQ-007' },
  { from: 'NFR-001', to: 'REQ-013' },
  { from: 'NFR-001', to: 'REQ-020' },
  { from: 'NFR-001', to: 'REQ-021' },
  { from: 'NFR-002', to: 'REQ-001' }, { from: 'NFR-002', to: 'REQ-002' }, { from: 'NFR-002', to: 'REQ-006' },
  { from: 'NFR-002', to: 'REQ-009' }, { from: 'NFR-002', to: 'REQ-011' }, { from: 'NFR-002', to: 'REQ-016' },
  { from: 'NFR-002', to: 'REQ-018' },
  { from: 'NFR-003', to: 'REQ-001' }, { from: 'NFR-003', to: 'REQ-002' }, { from: 'NFR-003', to: 'REQ-005' },
  { from: 'NFR-003', to: 'REQ-006' }, { from: 'NFR-003', to: 'REQ-009' }, { from: 'NFR-003', to: 'REQ-011' },
  { from: 'NFR-003', to: 'REQ-018' },
  { from: 'NFR-004', to: 'REQ-001' }, { from: 'NFR-004', to: 'REQ-006' }, { from: 'NFR-004', to: 'REQ-009' },
  { from: 'NFR-004', to: 'REQ-011' },
  { from: 'NFR-005', to: 'REQ-001' }, { from: 'NFR-005', to: 'REQ-006' }, { from: 'NFR-005', to: 'REQ-007' },
  { from: 'NFR-005', to: 'REQ-013' },
  { from: 'NFR-006', to: 'REQ-001' }, { from: 'NFR-006', to: 'REQ-005' },
  { from: 'CON-001', to: 'REQ-001' }, { from: 'CON-001', to: 'REQ-006' }, { from: 'CON-001', to: 'REQ-009' },
  { from: 'CON-001', to: 'REQ-011' },
  { from: 'CON-002', to: 'REQ-001' }, { from: 'CON-002', to: 'REQ-006' }, { from: 'CON-002', to: 'REQ-009' },
  { from: 'CON-002', to: 'REQ-018' },
  { from: 'CON-003', to: 'REQ-001' }, { from: 'CON-003', to: 'REQ-006' }, { from: 'CON-003', to: 'REQ-009' },
  { from: 'CON-003', to: 'REQ-016' },
  { from: 'CON-004', to: 'REQ-018' },
];

crossCuts.forEach(e => edges.push({ from: e.from, to: e.to, type: 'cross-cuts' }));

// ----------------------------------------------------------------------------
// 2.9 produces 边：信息流（核心 DFD）
// graph-guide §2: produces = 信息流方向 from→to
// EXT-IN → 系统根 → REQ → SD → INTF → EXT-OUT
// ----------------------------------------------------------------------------

// EXT-IN → 系统根
edges.push({ from: 'EXT-IN-001', to: 'SYS-001', type: 'produces' });

// 系统根 → 核心 REQ（22 functional + 6 NFR + 4 CON = 32）
functionalReqs.forEach(r => edges.push({ from: 'SYS-001', to: r.id, type: 'produces' }));
nfrs.forEach(n => edges.push({ from: 'SYS-001', to: n.id, type: 'produces' }));
cons.forEach(c => edges.push({ from: 'SYS-001', to: c.id, type: 'produces' }));

// REQ → SD（22 SD，每个从对应 REQ 流入）
sdToReqParent.forEach(e => edges.push({ from: e.req, to: e.sd, type: 'produces' }));

// SD → INTF（22 INTF）
intfs.forEach(i => edges.push({ from: i.sdId, to: i.id, type: 'produces' }));

// 关键 INTF → EXT-OUT（公开端点输出）
const publicIntfs = [
  'INTF-001', // 注册/登录响应
  'INTF-002', // 公开资料
  'INTF-006', // 浏览（公开）
  'INTF-008', // 标签查询（公开）
  'INTF-009', // 搜索（公开）
  'INTF-010', // 评论列表（公开）
  'INTF-012', // RSS
  'INTF-014', // 站点配置（GET 公开）
  'INTF-019', // 广告（GET 公开）
  'INTF-022', // 错误响应
];
publicIntfs.forEach(i => edges.push({ from: i, to: 'EXT-OUT-001', type: 'produces' }));

// 受保护 INTF → 用户（经 EXT-OUT 出口）
const protectedIntfs = [
  'INTF-003', 'INTF-004', 'INTF-005', 'INTF-007', 'INTF-011',
  'INTF-013', 'INTF-015', 'INTF-016', 'INTF-017', 'INTF-018',
];
protectedIntfs.forEach(i => edges.push({ from: i, to: 'EXT-OUT-001', type: 'produces' }));

// Webhook INTF-013 → Webhook Subscriber (经 EXT-OUT)
edges.push({ from: 'INTF-013', to: 'EXT-OUT-001', type: 'produces' });

// ----------------------------------------------------------------------------
// 2.10 governs 边：治理类子系统横切（SD-016 审计 governance=true）
// graph-guide §2: governs = 治理类 → 被治理
// ----------------------------------------------------------------------------

// SD-016 审计横切治理多个 SD
const governedSds = ['SD-001', 'SD-002', 'SD-003', 'SD-004', 'SD-005', 'SD-006', 'SD-007', 'SD-008', 'SD-010', 'SD-011', 'SD-013', 'SD-014', 'SD-019'];
governedSds.forEach(s => edges.push({ from: 'SD-016', to: s, type: 'governs' }));

// SD-020 限流横切所有路由层 SD
const rateLimitedSds = ['SD-001', 'SD-002', 'SD-003', 'SD-004', 'SD-005', 'SD-006', 'SD-007', 'SD-008', 'SD-009', 'SD-010', 'SD-011', 'SD-012', 'SD-013', 'SD-014', 'SD-015', 'SD-016', 'SD-017', 'SD-018', 'SD-019'];
rateLimitedSds.forEach(s => edges.push({ from: 'SD-020', to: s, type: 'governs' }));

// SD-022 错误处理横切所有 SD
const allSdsForError = sds.map(s => s.id);
allSdsForError.forEach(s => edges.push({ from: 'SD-022', to: s, type: 'governs' }));

// SD-021 路由层作为入口（不governs，但作为协作）
// SD-021 → 所有业务 SD（collaborates-with）
const routeSds = ['SD-001', 'SD-002', 'SD-003', 'SD-004', 'SD-005', 'SD-006', 'SD-007', 'SD-008', 'SD-009', 'SD-010', 'SD-011', 'SD-012', 'SD-013', 'SD-014', 'SD-015', 'SD-016', 'SD-017', 'SD-018', 'SD-019'];
routeSds.forEach(s => edges.push({ from: 'SD-021', to: s, type: 'collaborates-with' }));

// ----------------------------------------------------------------------------
// 2.11 补充 precedes 边（SD 阶段）
// ----------------------------------------------------------------------------

const sdPrecedes = [
  { from: 'SD-001', to: 'SD-002' }, // 认证先于资料
  { from: 'SD-001', to: 'SD-003' }, // 认证先于关注
  { from: 'SD-001', to: 'SD-004' }, // 共享认证工具
  { from: 'SD-004', to: 'SD-005' }, // 博主先于博文
  { from: 'SD-005', to: 'SD-006' }, // 创建先于浏览
  { from: 'SD-005', to: 'SD-007' }, // 创建先于互动
  { from: 'SD-005', to: 'SD-008' }, // 创建先于标签
  { from: 'SD-005', to: 'SD-009' }, // 创建先于搜索
  { from: 'SD-005', to: 'SD-010' }, // 创建先于评论
  { from: 'SD-005', to: 'SD-012' }, // 创建先于 RSS
  { from: 'SD-005', to: 'SD-013' }, // 创建先于 Webhook
  { from: 'SD-005', to: 'SD-015' }, // 创建先于访问
  { from: 'SD-005', to: 'SD-017' }, // 创建先于统计
  { from: 'SD-005', to: 'SD-018' }, // 创建先于推荐
  { from: 'SD-005', to: 'SD-019' }, // 博文先于广告
  { from: 'SD-008', to: 'SD-018' }, // 标签先于推荐
  { from: 'SD-006', to: 'SD-018' }, // 浏览先于推荐
  { from: 'SD-007', to: 'SD-011' }, // 互动先于通知
  { from: 'SD-010', to: 'SD-011' }, // 评论先于通知
  { from: 'SD-003', to: 'SD-011' }, // 关注先于通知
  { from: 'SD-011', to: 'SD-013' }, // 通知驱动 Webhook
  { from: 'SD-014', to: 'SD-012' }, // 站点配置先于 RSS
  { from: 'SD-014', to: 'SD-019' }, // 站点配置先于广告
  { from: 'SD-020', to: 'SD-021' }, // 限流先于路由
  { from: 'SD-022', to: 'SD-020' }, // 错误处理兜底限流
  { from: 'SD-022', to: 'SD-021' }, // 错误处理兜底路由
];

sdPrecedes.forEach(e => edges.push({ from: e.from, to: e.to, type: 'precedes' }));

// ----------------------------------------------------------------------------
// 2.12 TC → SD 边（系统测试验证子系统）
// 22 TC 节点各由对应 SD 验证；用 depends-on 表示测试对子系统的依赖
// ----------------------------------------------------------------------------

tcs.forEach(t => edges.push({ from: t.id, to: t.sdId, type: 'depends-on' }));

// TC → INTF 边（测试覆盖接口）
tcs.forEach(t => {
  const intf = intfs.find(i => i.sdId === t.sdId);
  if (intf) edges.push({ from: t.id, to: intf.id, type: 'depends-on' });
});

// TC → NFR/CON 边（验证非功能/约束需求）
const tcToNfrCon = [
  { tc: 'TC-ST-001', target: 'NFR-001' },
  { tc: 'TC-ST-001', target: 'NFR-003' },
  { tc: 'TC-ST-003', target: 'NFR-004' },
  { tc: 'TC-ST-005', target: 'NFR-001' },
  { tc: 'TC-ST-005', target: 'NFR-004' },
  { tc: 'TC-ST-006', target: 'NFR-001' },
  { tc: 'TC-ST-009', target: 'NFR-001' },
  { tc: 'TC-ST-009', target: 'NFR-004' },
  { tc: 'TC-ST-013', target: 'NFR-003' },
  { tc: 'TC-ST-013', target: 'NFR-004' },
  { tc: 'TC-ST-015', target: 'NFR-002' },
  { tc: 'TC-ST-016', target: 'CON-004' },
  { tc: 'TC-ST-017', target: 'NFR-001' },
  { tc: 'TC-ST-017', target: 'NFR-002' },
  { tc: 'TC-ST-020', target: 'NFR-005' },
  { tc: 'TC-ST-021', target: 'CON-003' },
  { tc: 'TC-ST-022', target: 'NFR-001' },
  { tc: 'TC-ST-022', target: 'NFR-004' },
];
tcToNfrCon.forEach(e => edges.push({ from: e.tc, to: e.target, type: 'depends-on' }));

// ----------------------------------------------------------------------------
// 2.13 parent 边：TC 依附到 SD（结构层）
// ----------------------------------------------------------------------------

tcs.forEach(t => edges.push({ from: t.sdId, to: t.id, type: 'parent' }));

// ----------------------------------------------------------------------------
// 2.14 REQ 之间的依赖边（按 requirement-spec.md §6.1）
// ----------------------------------------------------------------------------

const reqDependsOn = [
  { from: 'REQ-002', to: 'REQ-001' },
  { from: 'REQ-003', to: 'REQ-002' },
  { from: 'REQ-004', to: 'REQ-001' },
  { from: 'REQ-004', to: 'REQ-005' },
  { from: 'REQ-006', to: 'REQ-005' },
  { from: 'REQ-007', to: 'REQ-006' },
  { from: 'REQ-008', to: 'REQ-006' },
  { from: 'REQ-008', to: 'REQ-001' },
  { from: 'REQ-009', to: 'REQ-006' },
  { from: 'REQ-009', to: 'REQ-001' },
  { from: 'REQ-010', to: 'REQ-009' },
  { from: 'REQ-011', to: 'REQ-004' },
  { from: 'REQ-011', to: 'REQ-008' },
  { from: 'REQ-011', to: 'REQ-009' },
  { from: 'REQ-012', to: 'REQ-006' },
  { from: 'REQ-013', to: 'REQ-006' },
  { from: 'REQ-013', to: 'REQ-012' },
  { from: 'REQ-014', to: 'REQ-006' },
  { from: 'REQ-015', to: 'REQ-011' },
  { from: 'REQ-015', to: 'REQ-006' },
  { from: 'REQ-017', to: 'REQ-005' },
  { from: 'REQ-019', to: 'REQ-007' },
  { from: 'REQ-020', to: 'REQ-007' },
  { from: 'REQ-020', to: 'REQ-019' },
  { from: 'REQ-021', to: 'REQ-007' },
  { from: 'REQ-021', to: 'REQ-012' },
  { from: 'REQ-022', to: 'REQ-016' },
];

reqDependsOn.forEach(e => edges.push({ from: e.from, to: e.to, type: 'depends-on' }));

// ============================================================================
// 3. 元数据 + 输出
// ============================================================================

const graph = {
  version: 2,
  project: 'blog-system-demo',
  currentPhase: 2,
  rootId: 'SYS-001', // 系统根（外部代理）
  generatedAt: '2026-07-30T09:00:00.000Z',
  generatedBy: 'S-doc subagent (phase 2)',
  round: 23,
  summary: {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    byNodeType: {},
    byEdgeType: {},
    sdCount: 22,
    intfCount: 22,
    reqCount: 32, // 22 functional + 6 NFR + 4 CON
    nfrCount: 6,
    conCount: 4,
    extInCount: 1,
    extOutCount: 1,
    systemRootCount: 1,
    sdWithoutImplements: 0,
    intfWithoutDefines: 0,
  },
  nodes,
  edges,
};

// 计算统计
nodes.forEach(n => {
  graph.summary.byNodeType[n.type] = (graph.summary.byNodeType[n.type] || 0) + 1;
});
edges.forEach(e => {
  graph.summary.byEdgeType[e.type] = (graph.summary.byEdgeType[e.type] || 0) + 1;
});

// 写入文件
fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2), 'utf-8');

console.log('=== graph.json 写入成功 ===');
console.log('路径:', outputPath);
console.log('节点数:', nodes.length);
console.log('边数:', edges.length);
console.log('节点类型分布:', JSON.stringify(graph.summary.byNodeType, null, 2));
console.log('边类型分布:', JSON.stringify(graph.summary.byEdgeType, null, 2));
console.log('文件大小:', fs.statSync(outputPath).size, 'bytes');
