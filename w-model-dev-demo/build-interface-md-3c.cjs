// Append INTF-009 ~ INTF-014
const fs = require('fs');
const path = require('path');
const outputPath = path.resolve('d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev-demo/docs/phase3-design/interface-design.md');
function W(s) { fs.appendFileSync(outputPath, s, 'utf-8'); }

function writeIntf(idx, id, name, sdId, protocol, basePath, auth, rateLimit, description, provides, consumes, dataSources, endpoints, internalContracts, invariants) {
  W('### 3.' + String(idx).padStart(2, '0') + ' ' + id + ' ' + name + '\n\n');
  W('**基础信息**\n\n');
  W('| 字段 | 值 |\n|---|---|\n');
  W('| INTF ID | `' + id + '` |\n');
  W('| 名称 | ' + name + ' |\n');
  W('| 配对 SD | `' + sdId + '` |\n');
  W('| 协议 | ' + protocol + ' |\n');
  W('| 版本 | 1.0.0 |\n');
  W('| 基础路径 | `' + basePath + '` |\n');
  W('| 认证 | ' + auth + ' |\n');
  W('| 限流 | ' + rateLimit + ' |\n');
  W('| 描述 | ' + description + ' |\n');
  W('| 提供模块 | `' + provides + '` |\n');
  W('| 消费方 | ' + consumes + ' |\n');
  W('| 数据源 | ' + dataSources.map(function(s) { return '`' + s + '`'; }).join(', ') + ' |\n\n');
  W('**端点列表（' + endpoints.length + ' 个）**\n\n');
  endpoints.forEach(function(ep, epIdx) {
    W('#### 3.' + String(idx).padStart(2, '0') + '.' + (epIdx + 1) + ' `' + ep.method + ' ' + ep.path + '` — `' + ep.name + '`\n\n');
    W('**目的**：' + ep.purpose + '\n\n');
    if (ep.headers) {
      W('**请求头**：\n\n');
      Object.keys(ep.headers).forEach(function(k) {
        W('- `' + k + '`: ' + ep.headers[k] + '\n');
      });
      W('\n');
    }
    W('**请求参数**：\n\n');
    W('| 参数 | 位置 | 类型 | 必填 | 约束 | 说明 |\n');
    W('|---|---|---|:---:|---|---|\n');
    ep.params.forEach(function(p) {
      W('| `' + p.name + '` | ' + p.loc + ' | `' + p.type + '` | ' + (p.required ? '✓' : '') + ' | ' + p.constraint + ' | ' + p.desc + ' |\n');
    });
    W('\n');
    W('**响应 schema**（HTTP ' + ep.respStatus + '）：\n\n');
    W('```typescript\n');
    W('interface ' + ep.name.charAt(0).toUpperCase() + ep.name.slice(1) + 'Response {\n');
    ep.respFields.forEach(function(f) {
      W('  ' + f.name + ': ' + f.type + ';  // ' + f.desc + '\n');
    });
    W('}\n');
    W('```\n\n');
    if (ep.errorCodes && ep.errorCodes.length > 0) {
      W('**错误码**：\n\n');
      W('| 错误码 | HTTP | 触发场景 |\n|---|---|---|\n');
      ep.errorCodes.forEach(function(ec) {
        W('| `' + ec.code + '` | ' + ec.status + ' | ' + ec.scene + ' |\n');
      });
      W('\n');
    }
    W('**示例**：\n\n');
    W('```json\n// 请求\n' + JSON.stringify(ep.reqExample, null, 2) + '\n// 响应\n' + JSON.stringify(ep.respExample, null, 2) + '\n```\n\n');
  });
  W('**内部契约**（TS 签名）：\n\n');
  W('```typescript\n');
  internalContracts.forEach(function(ic) {
    W('// ' + ic.name + '\n');
    W(ic.sig);
    if (ic.throws && ic.throws !== 'none') W('  // throws: ' + ic.throws);
    W('\n');
  });
  W('```\n\n');
  W('**接口不变式**：\n\n');
  invariants.forEach(function(inv, i) {
    W((i + 1) + '. ' + inv + '\n');
  });
  W('\n---\n\n');
}

// INTF-009 全文搜索 API
writeIntf(9, 'INTF-009', '全文搜索 API', 'SD-009',
  'HTTP/REST/JSON', '/api/v1', 'GET 公开（限 IP 100 req/min）',
  '100 req/min/IP',
  '关键词搜索 published 博文（标题权重 2× / 正文权重 1×）+ 标签过滤；空关键词返 400；分页',
  'src/modules/search/search.{controller,service,indexer}.ts',
  '前端搜索栏 / 标签聚合页',
  ['posts store (仅 status=published)', 'post_tags store (标签过滤)', 'likes store (可选权重)'],
  [
    {
      method: 'GET', path: '/search', name: 'searchPosts',
      purpose: '全文搜索（标题+正文，标题权重 2×；支持标签过滤；分页）',
      headers: { 'Accept': 'application/json' },
      params: [
        { name: 'q', loc: 'query', type: 'string', required: true, constraint: 'len 1-100, trim 非空', desc: '关键词' },
        { name: 'tags', loc: 'query', type: 'string[]', required: false, constraint: '—', desc: '标签过滤' },
        { name: 'page', loc: 'query', type: 'number', required: false, constraint: 'min=1, default=1', desc: '页码' },
        { name: 'pageSize', loc: 'query', type: 'number', required: false, constraint: 'min=1, max=100, default=20', desc: '每页' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'items', type: 'SearchResultItem[]', desc: '搜索结果（带 score 字段）' },
        { name: 'page', type: 'number', desc: '当前页' },
        { name: 'pageSize', type: 'number', desc: '每页数' },
        { name: 'total', type: 'number', desc: '命中总数' },
        { name: 'totalPages', type: 'number', desc: '总页数' }
      ],
      errorCodes: [
        { code: 'EMPTY_KEYWORD', status: 400, scene: 'q 缺失或 trim 后为空' },
        { code: 'INVALID_PAGINATION', status: 400, scene: 'page<1 或 pageSize>100' }
      ],
      reqExample: { query: { q: 'nodejs', tags: ['tech'], page: 1, pageSize: 20 } },
      respExample: { items: [{ postId: 'p_aaa', title: 'Nodejs 入门', excerpt: '...', authorId: 'b_xxx', authorName: 'Bob', publishedAt: '2026-07-30T08:00:00.000Z', tags: ['tech', 'nodejs'], score: 3.0 }], page: 1, pageSize: 20, total: 1, totalPages: 1 }
    }
  ],
  [
    { name: 'SearchService.search(q, tags, page, pageSize)', sig: '(string, string[]?, number, number) => PaginatedSearchResults', throws: 'EMPTY_KEYWORD' },
    { name: 'SearchIndexer.score(post, q)', sig: '(Post, string) => number', throws: 'none' },
    { name: 'SearchIndexer.tokenize(text)', sig: '(string) => string[]', throws: 'none' }
  ],
  [
    '仅搜索 status=published 博文（draft/deleted 不参与）',
    '标题命中权重 = 2，正文命中权重 = 1；score = 标题命中数×2 + 正文命中数',
    '关键词 trim 后非空；空字符串 → EMPTY_KEYWORD(400)，防止全表扫描',
    '标签过滤是 AND 语义（博文必须同时包含所有指定标签）'
  ]
);

// INTF-010 评论 API
writeIntf(10, 'INTF-010', '评论 API', 'SD-010',
  'HTTP/REST/JSON', '/api/v1', 'POST/PATCH/DELETE Bearer JWT (role=reader|blogger) / GET 公开',
  '100 req/min/IP',
  '评论发表（顶级+回复，max depth=5）+ 列表 + 软删（作者 OR 博主）+ 评论树',
  'src/modules/comment/comment.{controller,service,tree}.ts',
  '前端博文详情页评论区',
  ['user store', 'blogger store', 'posts store (post 存在性)', 'comments store (Map<commentId,Comment> + Map<postId,Set<commentId>>)'],
  [
    {
      method: 'POST', path: '/posts/:postId/comments', name: 'createTopLevelComment',
      purpose: '发表顶级评论（depth=0）',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer <jwt>' },
      params: [
        { name: 'postId', loc: 'path', type: 'string', required: true, constraint: 'pattern=^p_', desc: '目标 postId' },
        { name: 'content', loc: 'body', type: 'string', required: true, constraint: 'len 1-2000', desc: '评论内容' }
      ],
      respStatus: 201,
      respFields: [
        { name: 'commentId', type: 'string', desc: 'c_ 开头 24 字符' },
        { name: 'postId', type: 'string', desc: '回显' },
        { name: 'authorId', type: 'string', desc: 'userId or bloggerId' },
        { name: 'authorName', type: 'string', desc: '显示名' },
        { name: 'content', type: 'string', desc: '回显' },
        { name: 'depth', type: 'number', desc: '0' },
        { name: 'parentId', type: 'string', desc: 'null' },
        { name: 'createdAt', type: 'string (ISO8601)', desc: '创建时间' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'POST_NOT_FOUND', status: 404, scene: 'postId 不存在' },
        { code: 'VALIDATION_FAILED', status: 400, scene: 'Zod 校验失败' }
      ],
      reqExample: { params: { postId: 'p_aaa' }, body: { content: '很棒的文章！' } },
      respExample: { commentId: 'c_commentid1234567890abc', postId: 'p_aaa', authorId: 'u_user1', authorName: 'Alice', content: '很棒的文章！', depth: 0, parentId: null, createdAt: '2026-07-30T11:00:00.000Z' }
    },
    {
      method: 'POST', path: '/comments/:parentId/replies', name: 'replyComment',
      purpose: '回复评论（depth+1；最大 5 层）',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer <jwt>' },
      params: [
        { name: 'parentId', loc: 'path', type: 'string', required: true, constraint: 'pattern=^c_', desc: '父评论 id' },
        { name: 'content', loc: 'body', type: 'string', required: true, constraint: 'len 1-2000', desc: '回复内容' }
      ],
      respStatus: 201,
      respFields: [
        { name: 'commentId', type: 'string', desc: '新评论 id' },
        { name: 'parentId', type: 'string', desc: '回显' },
        { name: 'postId', type: 'string', desc: '所属 postId' },
        { name: 'depth', type: 'number', desc: 'parent.depth+1' },
        { name: 'content', type: 'string', desc: '回显' },
        { name: 'createdAt', type: 'string (ISO8601)', desc: '创建时间' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'COMMENT_NOT_FOUND', status: 404, scene: 'parentId 不存在' },
        { code: 'MAX_DEPTH_EXCEEDED', status: 400, scene: 'parent.depth >= 4（再加 1 超 5 层）' },
        { code: 'VALIDATION_FAILED', status: 400, scene: 'Zod 校验失败' }
      ],
      reqExample: { params: { parentId: 'c_parent1' }, body: { content: '同意楼上！' } },
      respExample: { commentId: 'c_reply1234567890abcdef', parentId: 'c_parent1', postId: 'p_aaa', depth: 1, content: '同意楼上！', createdAt: '2026-07-30T11:05:00.000Z' }
    },
    {
      method: 'GET', path: '/posts/:postId/comments', name: 'listComments',
      purpose: '列出博文全部评论（含树形结构）',
      headers: { 'Accept': 'application/json' },
      params: [
        { name: 'postId', loc: 'path', type: 'string', required: true, constraint: 'pattern=^p_', desc: '目标 postId' },
        { name: 'sort', loc: 'query', type: 'string', required: false, constraint: 'enum=[newest,oldest], default=newest', desc: '排序' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'items', type: 'CommentTree[]', desc: '评论树（顶级+嵌套回复）' },
        { name: 'total', type: 'number', desc: '评论总数（含已删除占位）' }
      ],
      errorCodes: [
        { code: 'POST_NOT_FOUND', status: 404, scene: 'postId 不存在' }
      ],
      reqExample: { params: { postId: 'p_aaa' }, query: { sort: 'newest' } },
      respExample: { items: [{ commentId: 'c_1', authorName: 'Alice', content: '很棒！', depth: 0, replies: [{ commentId: 'c_2', authorName: 'Bob', content: '同意', depth: 1, replies: [] }] }], total: 2 }
    },
    {
      method: 'DELETE', path: '/comments/:id', name: 'deleteComment',
      purpose: '删除评论（作者本人 OR 博文作者；软删，保留 id 标记 deleted=true）',
      headers: { 'Authorization': 'Bearer <jwt>' },
      params: [
        { name: 'id', loc: 'path', type: 'string', required: true, constraint: 'pattern=^c_', desc: '评论 id' }
      ],
      respStatus: 204,
      respFields: [],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'COMMENT_NOT_FOUND', status: 404, scene: 'id 不存在' },
        { code: 'FORBIDDEN_NOT_AUTHOR_OR_BLOGGER', status: 403, scene: '既非评论作者也非博文作者' }
      ],
      reqExample: { params: { id: 'c_1' } },
      respExample: null
    }
  ],
  [
    { name: 'CommentService.createTopLevel(postId, authorId, content)', sig: '(string, string, string) => Comment', throws: 'POST_NOT_FOUND' },
    { name: 'CommentService.reply(parentId, authorId, content)', sig: '(string, string, string) => Comment', throws: 'COMMENT_NOT_FOUND, MAX_DEPTH_EXCEEDED' },
    { name: 'CommentService.listByPost(postId, sort)', sig: '(string, string) => CommentTree[]', throws: 'POST_NOT_FOUND' },
    { name: 'CommentService.softDelete(commentId, requesterId)', sig: '(string, string) => void', throws: 'COMMENT_NOT_FOUND, FORBIDDEN_NOT_AUTHOR_OR_BLOGGER' },
    { name: 'CommentTree.build(comments)', sig: '(Comment[]) => CommentTree[]', throws: 'none' },
    { name: 'CommentService.canDelete(comment, requesterId, post)', sig: '(Comment, string, Post) => boolean', throws: 'none' }
  ],
  [
    '最大 depth=5（含顶级）；超过返 MAX_DEPTH_EXCEEDED(400)，防止无限嵌套',
    '软删：deleted=true 占位，保留 id 维持子评论树形结构',
    '删除权限：comment.authorId === requesterId OR post.authorId === requesterId（作者本人 OR 博文作者）',
    'comment.created 事件触发 SD-011 通知（通知博主 + 父评论作者）',
    'comment.deleted 事件触发 SD-016 审计'
  ]
);

// INTF-011 通知 API
writeIntf(11, 'INTF-011', '通知 API', 'SD-011',
  'HTTP/REST/JSON', '/api/v1', 'GET/PATCH Bearer JWT (role=reader|blogger)',
  '100 req/min/IP',
  '站内通知列表 + 标记已读 + 未读计数；触发源：follow.created/like.created/comment.created',
  'src/modules/notification/notification.{controller,service,store}.ts',
  '前端通知中心 / 红点徽标',
  ['notifications store (Map<userId, Notification[]>)'],
  [
    {
      method: 'GET', path: '/me/notifications', name: 'listMyNotifications',
      purpose: '我的通知列表（分页；按 createdAt 倒序）',
      headers: { 'Authorization': 'Bearer <jwt>' },
      params: [
        { name: 'unreadOnly', loc: 'query', type: 'boolean', required: false, constraint: 'default=false', desc: '仅未读' },
        { name: 'page', loc: 'query', type: 'number', required: false, constraint: 'min=1, default=1', desc: '页码' },
        { name: 'pageSize', loc: 'query', type: 'number', required: false, constraint: 'min=1, max=100, default=20', desc: '每页' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'items', type: 'Notification[]', desc: '通知列表' },
        { name: 'unreadCount', type: 'number', desc: '未读总数' },
        { name: 'page', type: 'number', desc: '当前页' },
        { name: 'total', type: 'number', desc: '总数' },
        { name: 'totalPages', type: 'number', desc: '总页数' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' }
      ],
      reqExample: { query: { unreadOnly: false, page: 1, pageSize: 20 } },
      respExample: { items: [{ notificationId: 'n_1', type: 'like.created', payload: { postId: 'p_aaa', fromUserId: 'u_bob' }, read: false, createdAt: '2026-07-30T11:00:00.000Z' }], unreadCount: 1, page: 1, total: 1, totalPages: 1 }
    },
    {
      method: 'PATCH', path: '/me/notifications/:id/read', name: 'markNotificationRead',
      purpose: '标记单条通知为已读',
      headers: { 'Authorization': 'Bearer <jwt>' },
      params: [
        { name: 'id', loc: 'path', type: 'string', required: true, constraint: 'pattern=^n_', desc: '通知 id' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'notificationId', type: 'string', desc: '回显' },
        { name: 'read', type: 'boolean', desc: 'true' },
        { name: 'readAt', type: 'string (ISO8601)', desc: '已读时间' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'NOTIFICATION_NOT_FOUND', status: 404, scene: 'id 不存在' },
        { code: 'FORBIDDEN_NOT_OWNED', status: 403, scene: '通知不属于该 user' }
      ],
      reqExample: { params: { id: 'n_1' } },
      respExample: { notificationId: 'n_1', read: true, readAt: '2026-07-30T11:30:00.000Z' }
    },
    {
      method: 'GET', path: '/me/notifications/unread-count', name: 'getUnreadCount',
      purpose: '未读通知数（用于红点徽标）',
      headers: { 'Authorization': 'Bearer <jwt>' },
      params: [],
      respStatus: 200,
      respFields: [
        { name: 'unreadCount', type: 'number', desc: '未读总数' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' }
      ],
      reqExample: {},
      respExample: { unreadCount: 3 }
    }
  ],
  [
    { name: 'NotificationService.listByUser(userId, filter, page, pageSize)', sig: '(string, {unreadOnly?:boolean}, number, number) => PaginatedNotifications', throws: 'none' },
    { name: 'NotificationService.markRead(notificationId, userId)', sig: '(string, string) => Notification', throws: 'NOTIFICATION_NOT_FOUND, FORBIDDEN_NOT_OWNED' },
    { name: 'NotificationService.getUnreadCount(userId)', sig: '(string) => number', throws: 'none' },
    { name: 'NotificationService.push(userId, type, payload)', sig: '(string, string, object) => Notification', throws: 'none' },
    { name: 'NotificationDispatcher.dispatch(event)', sig: '({type, targetUserId, payload}) => void', throws: 'none' }
  ],
  [
    '触发源：follow.created（通知博主）/ like.created（通知博主）/ comment.created（通知博主 + 父评论作者）',
    '通知归属 userId = token.sub；GET 仅返回该 userId 的通知',
    '已读标记幂等（多次 PATCH 结果一致）',
    'bookmark.created 不触发通知（避免刷屏）',
    '通知触发可选触发 SD-013 Webhook 投递（subscription 订阅 type=notification.created）'
  ]
);

// INTF-012 RSS 订阅 API
writeIntf(12, 'INTF-012', 'RSS 订阅 API', 'SD-012',
  'HTTP/RSS+XML', '/', 'GET 公开（无认证；限 IP 60 req/min 较严）',
  '60 req/min/IP（爬虫友好，频次低）',
  '站点级 RSS 订阅源；最近 20 篇 published 博文；Content-Type: application/rss+xml',
  'src/modules/rss/rss.{controller,builder}.ts',
  '第三方 RSS 阅读器',
  ['posts store (仅 status=published)', 'site_config (siteTitle/siteLink/siteDescription)'],
  [
    {
      method: 'GET', path: '/rss.xml', name: 'getRssFeed',
      purpose: '获取 RSS 订阅源（最近 20 篇 published 博文）',
      headers: { 'Accept': 'application/rss+xml, application/xml' },
      params: [],
      respStatus: 200,
      respFields: [
        { name: 'rss', type: 'object', desc: 'RSS 2.0 XML 根' },
        { name: 'rss.channel.title', type: 'string', desc: '来自 site_config.siteTitle' },
        { name: 'rss.channel.link', type: 'string', desc: '来自 site_config.siteLink' },
        { name: 'rss.channel.description', type: 'string', desc: '来自 site_config.siteDescription' },
        { name: 'rss.channel.item[]', type: 'object[]', desc: '最多 20 个 item（title/link/pubDate/description）' }
      ],
      errorCodes: [
        { code: 'INTERNAL', status: 500, scene: 'site_config 缺失（运维错误）' }
      ],
      reqExample: {},
      respExample: { '<?xml version="1.0"?>': '<rss version="2.0"><channel><title>My Blog</title><link>https://blog.example.com</link><description>Tech blog</description><item><title>Post 1</title><link>https://blog.example.com/posts/p_aaa</link><pubDate>Wed, 30 Jul 2026 08:00:00 GMT</pubDate><description>...</description></item></channel></rss>' }
    }
  ],
  [
    { name: 'RssBuilder.build(posts, siteConfig)', sig: '(Post[], SiteConfig) => string (XML)', throws: 'none' },
    { name: 'RssService.getFeed()', sig: '() => string (XML)', throws: 'INTERNAL' }
  ],
  [
    '仅包含 status=published 博文；draft/deleted 绝不出现',
    '取最近 20 篇（按 publishedAt 倒序）',
    'Content-Type 必须是 application/rss+xml；UTF-8 编码',
    'item 必含 title/link/pubDate/description；pubDate 用 RFC-822 格式',
    'site_config 缺失时返 500 INTERNAL（运维错误）'
  ]
);

// INTF-013 Webhook API
writeIntf(13, 'INTF-013', 'Webhook API', 'SD-013',
  'HTTP/REST/JSON', '/api/v1', 'POST /webhooks Bearer JWT (role=admin) / GET /webhooks/:id/deliveries Bearer JWT (role=admin)',
  '100 req/min/IP',
  'Webhook 订阅注册（url+events+secret）+ 事件触发 POST 回调 + HMAC-SHA256 签名 + 失败 3 次指数退避重试 + 投递记录',
  'src/modules/webhook/webhook.{controller,service,dispatcher,signer}.ts',
  '系统集成方（外部订阅者）',
  ['webhook_subscriptions store (Map<subId,Subscription>)', 'webhook_deliveries store (Map<deliveryId,Delivery>)', 'audit_logs (投递失败审计)'],
  [
    {
      method: 'POST', path: '/webhooks', name: 'createWebhookSubscription',
      purpose: '注册 Webhook 订阅（url + events + secret）',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer <admin-jwt>' },
      params: [
        { name: 'url', loc: 'body', type: 'string', required: true, constraint: 'pattern=^https?://', desc: '回调 URL' },
        { name: 'events', loc: 'body', type: 'string[]', required: true, constraint: 'minItems=1', desc: '订阅事件类型（post.published/comment.created/like.created/follow.created）' },
        { name: 'secret', loc: 'body', type: 'string', required: true, constraint: 'len 16-128', desc: 'HMAC 密钥（用于签名验证）' }
      ],
      respStatus: 201,
      respFields: [
        { name: 'subscriptionId', type: 'string', desc: 'wsub_ 开头' },
        { name: 'url', type: 'string', desc: '回显' },
        { name: 'events', type: 'string[]', desc: '回显' },
        { name: 'active', type: 'boolean', desc: 'true' },
        { name: 'createdAt', type: 'string (ISO8601)', desc: '创建时间' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'FORBIDDEN', status: 403, scene: 'role 非 admin' },
        { code: 'VALIDATION_FAILED', status: 400, scene: 'Zod 校验失败' }
      ],
      reqExample: { url: 'https://example.com/webhook', events: ['post.published'], secret: 'mysecret-1234567890' },
      respExample: { subscriptionId: 'wsub_abc123', url: 'https://example.com/webhook', events: ['post.published'], active: true, createdAt: '2026-07-30T12:00:00.000Z' }
    },
    {
      method: 'GET', path: '/webhooks/:id/deliveries', name: 'listWebhookDeliveries',
      purpose: '查询订阅的投递记录（最近 50 条）',
      headers: { 'Authorization': 'Bearer <admin-jwt>' },
      params: [
        { name: 'id', loc: 'path', type: 'string', required: true, constraint: 'pattern=^wsub_', desc: 'subscriptionId' },
        { name: 'status', loc: 'query', type: 'string', required: false, constraint: 'enum=[pending,success,failed]', desc: '状态过滤' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'items', type: 'Delivery[]', desc: '投递记录' },
        { name: 'total', type: 'number', desc: '总数' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'FORBIDDEN', status: 403, scene: 'role 非 admin' },
        { code: 'SUBSCRIPTION_NOT_FOUND', status: 404, scene: 'id 不存在' }
      ],
      reqExample: { params: { id: 'wsub_abc123' }, query: { status: 'failed' } },
      respExample: { items: [{ deliveryId: 'wd_1', eventType: 'post.published', status: 'failed', attempt: 3, lastError: 'timeout', createdAt: '2026-07-30T12:05:00.000Z' }], total: 1 }
    },
    {
      method: 'DELETE', path: '/webhooks/:id', name: 'deactivateWebhook',
      purpose: '停用订阅（软删，active=false）',
      headers: { 'Authorization': 'Bearer <admin-jwt>' },
      params: [
        { name: 'id', loc: 'path', type: 'string', required: true, constraint: 'pattern=^wsub_', desc: 'subscriptionId' }
      ],
      respStatus: 204,
      respFields: [],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'FORBIDDEN', status: 403, scene: 'role 非 admin' },
        { code: 'SUBSCRIPTION_NOT_FOUND', status: 404, scene: 'id 不存在' }
      ],
      reqExample: { params: { id: 'wsub_abc123' } },
      respExample: null
    }
  ],
  [
    { name: 'WebhookService.createSubscription(url, events, secret)', sig: '(string, string[], string) => Subscription', throws: 'VALIDATION_FAILED' },
    { name: 'WebhookService.listDeliveries(subscriptionId, status)', sig: '(string, string?) => Delivery[]', throws: 'SUBSCRIPTION_NOT_FOUND' },
    { name: 'WebhookService.deactivate(subscriptionId)', sig: '(string) => void', throws: 'SUBSCRIPTION_NOT_FOUND' },
    { name: 'WebhookDispatcher.dispatch(event, subscriptions)', sig: '({type, payload}, Subscription[]) => void', throws: 'none' },
    { name: 'WebhookSigner.sign(payload, secret)', sig: '(string, string) => string (HMAC-SHA256 hex)', throws: 'none' },
    { name: 'WebhookRetryPolicy.nextDelay(attempt)', sig: '(number) => number (ms; 1s/4s/16s 指数退避)', throws: 'none' }
  ],
  [
    '签名：X-Webhook-Signature: HMAC-SHA256(payload, secret)；外部验证失败应拒绝（自身不感知）',
    '重试：失败 3 次指数退避（1s/4s/16s）；3 次仍失败标记 failed，触发 SD-016 审计',
    '事件触发：post.published / comment.created / like.created / follow.created（与 SD-016 审计事件对齐）',
    '订阅 status：pending→success/failed；delivery.attempt 计数 0-3',
    '停用订阅（active=false）后不再投递，但保留历史 delivery 记录'
  ]
);

// INTF-014 站点配置 API
writeIntf(14, 'INTF-014', '站点配置 API', 'SD-014',
  'HTTP/REST/JSON', '/api/v1', 'GET 公开 / PUT Bearer JWT (role=admin)',
  '100 req/min/IP',
  '站点元信息（title/description/link/logoUrl）+ 当前生效横幅广告；单例对象',
  'src/modules/site-config/site-config.{controller,service}.ts',
  '前端首页（站点信息）/ RSS 读取（title/link）/ 广告位',
  ['site_config (单例对象)'],
  [
    {
      method: 'GET', path: '/site/config', name: 'getSiteConfig',
      purpose: '获取站点配置（公开）',
      headers: { 'Accept': 'application/json' },
      params: [],
      respStatus: 200,
      respFields: [
        { name: 'siteTitle', type: 'string', desc: '站点标题' },
        { name: 'siteDescription', type: 'string', desc: '站点描述' },
        { name: 'siteLink', type: 'string', desc: '站点根 URL' },
        { name: 'logoUrl', type: 'string', desc: 'logo URL' },
        { name: 'bannerAdId', type: 'string', desc: '当前生效横幅广告 id（来自 SD-019）' },
        { name: 'updatedAt', type: 'string (ISO8601)', desc: '最近更新时间' }
      ],
      errorCodes: [
        { code: 'INTERNAL', status: 500, scene: 'site_config 未初始化' }
      ],
      reqExample: {},
      respExample: { siteTitle: 'My Blog', siteDescription: 'Tech blog', siteLink: 'https://blog.example.com', logoUrl: 'https://blog.example.com/logo.png', bannerAdId: 'ad_banner1', updatedAt: '2026-07-30T09:00:00.000Z' }
    },
    {
      method: 'PUT', path: '/site/config', name: 'updateSiteConfig',
      purpose: '更新站点配置（仅 admin）',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer <admin-jwt>' },
      params: [
        { name: 'siteTitle', loc: 'body', type: 'string', required: false, constraint: 'len 1-100', desc: '新标题' },
        { name: 'siteDescription', loc: 'body', type: 'string', required: false, constraint: 'len 0-500', desc: '新描述' },
        { name: 'siteLink', loc: 'body', type: 'string', required: false, constraint: 'pattern=^https?://', desc: '新站点 URL' },
        { name: 'logoUrl', loc: 'body', type: 'string', required: false, constraint: 'pattern=^https?://', desc: '新 logo URL' },
        { name: 'bannerAdId', loc: 'body', type: 'string', required: false, constraint: 'pattern=^ad_', desc: '新横幅广告 id（必须 ads store 存在）' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'siteTitle', type: 'string', desc: '更新后' },
        { name: 'siteDescription', type: 'string', desc: '更新后' },
        { name: 'siteLink', type: 'string', desc: '更新后' },
        { name: 'logoUrl', type: 'string', desc: '更新后' },
        { name: 'bannerAdId', type: 'string', desc: '更新后' },
        { name: 'updatedAt', type: 'string (ISO8601)', desc: '更新时间' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'FORBIDDEN', status: 403, scene: 'role 非 admin' },
        { code: 'VALIDATION_FAILED', status: 400, scene: 'Zod 校验失败' },
        { code: 'AD_NOT_FOUND', status: 404, scene: 'bannerAdId 不在 ads store' }
      ],
      reqExample: { body: { siteTitle: 'My Blog v2', bannerAdId: 'ad_banner2' } },
      respExample: { siteTitle: 'My Blog v2', siteDescription: 'Tech blog', siteLink: 'https://blog.example.com', logoUrl: 'https://blog.example.com/logo.png', bannerAdId: 'ad_banner2', updatedAt: '2026-07-30T13:00:00.000Z' }
    }
  ],
  [
    { name: 'SiteConfigService.get()', sig: '() => SiteConfig', throws: 'INTERNAL（未初始化）' },
    { name: 'SiteConfigService.update(updates, adminId)', sig: '(Partial<SiteConfig>, string) => SiteConfig', throws: 'VALIDATION_FAILED, AD_NOT_FOUND' }
  ],
  [
    '单例对象：site_config 始终存在 1 份（系统启动时初始化默认值）',
    'PUT 部分更新（仅修改传入字段）；updatedAt 自动刷新',
    'bannerAdId 必须在 ads store 存在（由 SD-019 创建）；不存在 → AD_NOT_FOUND(404)',
    'site.config.updated 事件触发 SD-016 审计（adminId + 变更字段 + 变更前后值）',
    '公开 GET 不返回内部字段（如初始化 ts、adminId）'
  ]
);

console.log('§3.9-§3.14 (INTF-009~014) 写入完成，大小：', fs.statSync(outputPath).size, 'bytes');
