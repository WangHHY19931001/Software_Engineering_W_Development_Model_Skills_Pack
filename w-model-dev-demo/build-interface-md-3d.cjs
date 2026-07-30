// Append INTF-015 ~ INTF-022
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

// INTF-015 访问记录 API
writeIntf(15, 'INTF-015', '访问记录 API', 'SD-015',
  'HTTP/REST/JSON', '/api/v1', 'POST /posts/:id/view 公开（异步）/ GET /admin/posts/:id/access Bearer JWT (role=admin)',
  '100 req/min/IP',
  'GET 博文详情时记录访问（postId+userId|anonymous+ts+ip）+ 管理员查询访问记录',
  'src/modules/access-record/access-record.{controller,service}.ts',
  '前端博文详情页（隐式）/ 管理员后台',
  ['posts store (post 存在性)', 'access_records store (AccessRecord[])'],
  [
    {
      method: 'POST', path: '/posts/:id/view', name: 'recordView',
      purpose: '记录博文访问（前端可显式调用；正常情况下由 GET /posts/:id 隐式调用）',
      headers: { 'Content-Type': 'application/json' },
      params: [
        { name: 'id', loc: 'path', type: 'string', required: true, constraint: 'pattern=^p_', desc: '目标 postId' }
      ],
      respStatus: 204,
      respFields: [],
      errorCodes: [
        { code: 'POST_NOT_FOUND', status: 404, scene: 'postId 不存在' }
      ],
      reqExample: { params: { id: 'p_aaa' } },
      respExample: null
    },
    {
      method: 'GET', path: '/admin/posts/:id/access', name: 'listPostAccessRecords',
      purpose: '管理员查询某博文访问记录（分页）',
      headers: { 'Authorization': 'Bearer <admin-jwt>' },
      params: [
        { name: 'id', loc: 'path', type: 'string', required: true, constraint: 'pattern=^p_', desc: '目标 postId' },
        { name: 'page', loc: 'query', type: 'number', required: false, constraint: 'min=1, default=1', desc: '页码' },
        { name: 'pageSize', loc: 'query', type: 'number', required: false, constraint: 'min=1, max=100, default=20', desc: '每页' },
        { name: 'from', loc: 'query', type: 'string', required: false, constraint: 'ISO8601', desc: '起始时间' },
        { name: 'to', loc: 'query', type: 'string', required: false, constraint: 'ISO8601', desc: '截止时间' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'items', type: 'AccessRecord[]', desc: '访问记录' },
        { name: 'page', type: 'number', desc: '当前页' },
        { name: 'total', type: 'number', desc: '总数' },
        { name: 'totalPages', type: 'number', desc: '总页数' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'FORBIDDEN', status: 403, scene: 'role 非 admin' },
        { code: 'POST_NOT_FOUND', status: 404, scene: 'postId 不存在' }
      ],
      reqExample: { params: { id: 'p_aaa' }, query: { page: 1, pageSize: 20 } },
      respExample: { items: [{ accessId: 'ar_1', postId: 'p_aaa', userId: 'u_bob', ip: '192.168.1.1', ts: '2026-07-30T12:00:00.000Z' }], page: 1, total: 1, totalPages: 1 }
    }
  ],
  [
    { name: 'AccessRecordService.record(postId, userId, ip)', sig: '(string, string?, string) => AccessRecord', throws: 'POST_NOT_FOUND' },
    { name: 'AccessRecordService.listByPost(postId, page, pageSize, range)', sig: '(string, number, number, {from?,to?}) => PaginatedAccessRecords', throws: 'POST_NOT_FOUND' }
  ],
  [
    'POST /posts/:id/view 与 GET /posts/:id 都写访问记录（GET 是隐式调用）',
    'userId 可为 null（未登录访问者，anonymous）',
    '同一 userId 5 分钟内重复访问同一 postId 仅计 1 次（去重，UV 计算友好）',
    'access_records 保留 90 天（CON-004）；过期后台清理',
    '记录失败（如 postId 不存在）抛 404，但 GET /posts/:id 仍可继续返回内容（解耦：404 时跳过记录步骤）'
  ]
);

// INTF-016 审计日志 API
writeIntf(16, 'INTF-016', '审计日志 API', 'SD-016',
  'HTTP/REST/JSON', '/api/v1', 'GET Bearer JWT (role=admin)',
  '100 req/min/IP',
  '审计日志查询（actor+type+时间范围筛选；分页；90 天保留）',
  'src/modules/audit-log/audit-log.{controller,service}.ts',
  '管理员后台 / 安全审计',
  ['audit_logs store (AuditLog[]; 按 ts 排序；90 天保留)'],
  [
    {
      method: 'GET', path: '/admin/audit-logs', name: 'listAuditLogs',
      purpose: '查询审计日志（按 actor/type/时间范围筛选；分页）',
      headers: { 'Authorization': 'Bearer <admin-jwt>' },
      params: [
        { name: 'actor', loc: 'query', type: 'string', required: false, constraint: '—', desc: '操作者 ID（userId/bloggerId/adminId）' },
        { name: 'type', loc: 'query', type: 'string', required: false, constraint: 'enum=[user.registered, user.login, blogger.registered, blogger.switched, post.created, post.published, post.deleted, comment.deleted, site.config.updated, webhook.delivery.failed]', desc: '操作类型' },
        { name: 'from', loc: 'query', type: 'string', required: false, constraint: 'ISO8601', desc: '起始时间' },
        { name: 'to', loc: 'query', type: 'string', required: false, constraint: 'ISO8601', desc: '截止时间' },
        { name: 'page', loc: 'query', type: 'number', required: false, constraint: 'min=1, default=1', desc: '页码' },
        { name: 'pageSize', loc: 'query', type: 'number', required: false, constraint: 'min=1, max=100, default=20', desc: '每页' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'items', type: 'AuditLog[]', desc: '审计记录' },
        { name: 'page', type: 'number', desc: '当前页' },
        { name: 'total', type: 'number', desc: '总数' },
        { name: 'totalPages', type: 'number', desc: '总页数' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'FORBIDDEN', status: 403, scene: 'role 非 admin' },
        { code: 'INVALID_TIME_RANGE', status: 400, scene: 'from > to' }
      ],
      reqExample: { query: { type: 'post.published', from: '2026-07-01T00:00:00.000Z', to: '2026-07-30T23:59:59.999Z', page: 1, pageSize: 20 } },
      respExample: { items: [{ logId: 'log_1', actor: 'u_bob', type: 'post.published', payload: { postId: 'p_aaa' }, ts: '2026-07-30T12:00:00.000Z' }], page: 1, total: 1, totalPages: 1 }
    }
  ],
  [
    { name: 'AuditLogService.list(filter, page, pageSize)', sig: '({actor?,type?,from?,to?}, number, number) => PaginatedAuditLogs', throws: 'INVALID_TIME_RANGE' },
    { name: 'AuditLogService.append(actor, type, payload)', sig: '(string, string, object) => AuditLog', throws: 'none' }
  ],
  [
    '所有关键写操作（注册/登录/发布/删除/配置变更/Webhook 失败）均写审计',
    '90 天保留（CON-004）；超过 90 天由后台清理作业删除',
    '审计写入不抛错（事件总线订阅者 fail-safe；记录日志 + 监控告警）',
    '默认仅查询 90 天内记录；可显式 from/to 但最大跨度 90 天',
    'actor 字段支持 userId/bloggerId/adminId（统一字符串）'
  ]
);

// INTF-017 站点统计 API
writeIntf(17, 'INTF-017', '站点统计 API', 'SD-017',
  'HTTP/REST/JSON', '/api/v1', 'GET Bearer JWT (role=admin)',
  '100 req/min/IP',
  'PV/UV 聚合（按小时桶）+ 趋势 + 范围过滤（24h/7d/30d）',
  'src/modules/stats/stats.{controller,service,aggregator}.ts',
  '管理员后台仪表板',
  ['stats_buckets store (Map<hourKey, {pv, uvSet, posts: Set}>)', 'access_records (UV 去重源)'],
  [
    {
      method: 'GET', path: '/admin/stats/site', name: 'getSiteStats',
      purpose: '获取站点统计（PV/UV/趋势；按 range 聚合）',
      headers: { 'Authorization': 'Bearer <admin-jwt>' },
      params: [
        { name: 'range', loc: 'query', type: 'string', required: false, constraint: 'enum=[24h,7d,30d], default=24h', desc: '范围' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'range', type: 'string', desc: '回显' },
        { name: 'pv', type: 'number', desc: '总 PV' },
        { name: 'uv', type: 'number', desc: '总 UV（userId 去重）' },
        { name: 'trend', type: 'TrendPoint[]', desc: '趋势数据点（按小时或按天）' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'FORBIDDEN', status: 403, scene: 'role 非 admin' },
        { code: 'INVALID_RANGE', status: 400, scene: 'range 不在枚举' }
      ],
      reqExample: { query: { range: '7d' } },
      respExample: { range: '7d', pv: 1234, uv: 567, trend: [{ ts: '2026-07-24', pv: 150, uv: 80 }, { ts: '2026-07-25', pv: 180, uv: 90 }] }
    },
    {
      method: 'GET', path: '/admin/stats/posts', name: 'getPostRankings',
      purpose: '博文排行榜（按 PV 倒序）',
      headers: { 'Authorization': 'Bearer <admin-jwt>' },
      params: [
        { name: 'limit', loc: 'query', type: 'number', required: false, constraint: 'min=1, max=50, default=10', desc: '数量' },
        { name: 'range', loc: 'query', type: 'string', required: false, constraint: 'enum=[24h,7d,30d], default=7d', desc: '范围' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'items', type: 'PostRanking[]', desc: '排行榜（postId/title/pv/uv）' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'FORBIDDEN', status: 403, scene: 'role 非 admin' }
      ],
      reqExample: { query: { limit: 10, range: '7d' } },
      respExample: { items: [{ postId: 'p_aaa', title: 'Nodejs 入门', pv: 250, uv: 120 }] }
    }
  ],
  [
    { name: 'StatsService.getSiteStats(range)', sig: '(string) => SiteStats', throws: 'INVALID_RANGE' },
    { name: 'StatsService.getPostRankings(limit, range)', sig: '(number, string) => PostRanking[]', throws: 'none' },
    { name: 'StatsAggregator.aggregate(buckets, range)', sig: '(Map<string,StatsBucket>, string) => SiteStats', throws: 'none' }
  ],
  [
    'PV 来源：每次 GET /posts/:id（成功）累加 1',
    'UV 来源：access_records 按 userId（或 ip+ua 兜底）去重',
    '24h 趋势按小时（24 个点）；7d/30d 趋势按天（7/30 个点）',
    'stats_buckets 按小时分桶，自动清理超过 30 天的桶',
    '管理员后台仪表板读此端点，禁止非 admin 访问'
  ]
);

// INTF-018 推荐 API
writeIntf(18, 'INTF-018', '推荐 API', 'SD-018',
  'HTTP/REST/JSON', '/api/v1', 'GET Bearer JWT (role=reader|blogger) / GET 公开（降级）',
  '100 req/min/IP',
  '基于标签 Jaccard 相似度推荐博文；冷启动降级「最近热门 10」',
  'src/modules/recommend/recommend.{controller,service,jaccard}.ts',
  '前端首页「推荐」tab',
  ['user store (用户历史)', 'posts store (status=published)', 'post_tags store', 'likes store', 'bookmarks store'],
  [
    {
      method: 'GET', path: '/me/recommendations', name: 'getMyRecommendations',
      purpose: '我的推荐博文（标签 Jaccard 相似度；冷启动降级「最近热门 10」）',
      headers: { 'Authorization': 'Bearer <jwt>（可选，未登录降级）' },
      params: [
        { name: 'limit', loc: 'query', type: 'number', required: false, constraint: 'min=1, max=50, default=10', desc: '数量' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'items', type: 'PostListItem[]', desc: '推荐博文列表（按相似度倒序）' },
        { name: 'strategy', type: 'string', desc: '"jaccard" | "fallback_popular"' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: 'Bearer 缺失（降级到 fallback）' }
      ],
      reqExample: { query: { limit: 10 } },
      respExample: { items: [{ postId: 'p_bbb', title: '类似博文', excerpt: '...', authorId: 'b_yyy', tags: ['tech'] }], strategy: 'jaccard' }
    }
  ],
  [
    { name: 'RecommendService.getRecommendations(userId, limit)', sig: '(string, number) => {items, strategy}', throws: 'none' },
    { name: 'JaccardCalculator.similarity(tagsA, tagsB)', sig: '(string[], string[]) => number (0~1)', throws: 'none' },
    { name: 'RecommendService.fallbackPopular(limit)', sig: '(number) => PostListItem[]', throws: 'none' }
  ],
  [
    '相似度：Jaccard(post.tags, user_history_tags) = |A∩B| / |A∪B|',
    'user_history_tags = 浏览+点赞+收藏过的博文标签 union',
    '冷启动：user_history 为空时降级到 fallback_popular（按 likes 数倒序取前 N）',
    '推荐结果过滤 status=published；draft/deleted 不参与',
    '已浏览/已点赞博文可降权（不强制排除，避免空结果）'
  ]
);

// INTF-019 广告位 API
writeIntf(19, 'INTF-019', '广告位 API', 'SD-019',
  'HTTP/REST/JSON', '/api/v1', 'POST/DELETE /site/ads Bearer JWT (role=admin) / GET /site/ads/active 公开',
  '100 req/min/IP',
  '广告位 CRUD（imageUrl+linkUrl+startAt+endAt）+ 生效期过滤',
  'src/modules/ad/ad.{controller,service,scheduler}.ts',
  '管理员后台 / 前端首页 banner',
  ['ads store (Map<adId, Ad>)', 'site_config (bannerAdId 引用)'],
  [
    {
      method: 'POST', path: '/site/ads', name: 'createAd',
      purpose: '创建广告（投放起止时间）',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer <admin-jwt>' },
      params: [
        { name: 'imageUrl', loc: 'body', type: 'string', required: true, constraint: 'pattern=^https?://', desc: '广告图 URL' },
        { name: 'linkUrl', loc: 'body', type: 'string', required: true, constraint: 'pattern=^https?://', desc: '点击跳转 URL' },
        { name: 'startAt', loc: 'body', type: 'string (ISO8601)', required: true, constraint: 'ISO8601', desc: '投放起始' },
        { name: 'endAt', loc: 'body', type: 'string (ISO8601)', required: true, constraint: 'ISO8601, > startAt', desc: '投放截止' }
      ],
      respStatus: 201,
      respFields: [
        { name: 'adId', type: 'string', desc: 'ad_ 开头' },
        { name: 'imageUrl', type: 'string', desc: '回显' },
        { name: 'linkUrl', type: 'string', desc: '回显' },
        { name: 'startAt', type: 'string (ISO8601)', desc: '回显' },
        { name: 'endAt', type: 'string (ISO8601)', desc: '回显' },
        { name: 'active', type: 'boolean', desc: '当前是否生效' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'FORBIDDEN', status: 403, scene: 'role 非 admin' },
        { code: 'VALIDATION_FAILED', status: 400, scene: 'Zod 校验失败 / endAt <= startAt' }
      ],
      reqExample: { imageUrl: 'https://cdn.example.com/ad1.png', linkUrl: 'https://example.com/promo', startAt: '2026-08-01T00:00:00.000Z', endAt: '2026-08-31T23:59:59.999Z' },
      respExample: { adId: 'ad_aug1', imageUrl: 'https://cdn.example.com/ad1.png', linkUrl: 'https://example.com/promo', startAt: '2026-08-01T00:00:00.000Z', endAt: '2026-08-31T23:59:59.999Z', active: true }
    },
    {
      method: 'GET', path: '/site/ads/active', name: 'getActiveAd',
      purpose: '获取当前生效广告（公开）',
      headers: { 'Accept': 'application/json' },
      params: [],
      respStatus: 200,
      respFields: [
        { name: 'ad', type: 'Ad | null', desc: '当前生效广告（可能为 null）' }
      ],
      errorCodes: [],
      reqExample: {},
      respExample: { ad: { adId: 'ad_aug1', imageUrl: 'https://cdn.example.com/ad1.png', linkUrl: 'https://example.com/promo', startAt: '2026-08-01T00:00:00.000Z', endAt: '2026-08-31T23:59:59.999Z' } }
    },
    {
      method: 'DELETE', path: '/site/ads/:id', name: 'deleteAd',
      purpose: '删除广告',
      headers: { 'Authorization': 'Bearer <admin-jwt>' },
      params: [
        { name: 'id', loc: 'path', type: 'string', required: true, constraint: 'pattern=^ad_', desc: 'adId' }
      ],
      respStatus: 204,
      respFields: [],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'FORBIDDEN', status: 403, scene: 'role 非 admin' },
        { code: 'AD_NOT_FOUND', status: 404, scene: 'id 不存在' }
      ],
      reqExample: { params: { id: 'ad_aug1' } },
      respExample: null
    }
  ],
  [
    { name: 'AdService.create(input)', sig: '(CreateAdInput) => Ad', throws: 'VALIDATION_FAILED' },
    { name: 'AdService.getActive()', sig: '() => Ad | null', throws: 'none' },
    { name: 'AdService.delete(adId)', sig: '(string) => void', throws: 'AD_NOT_FOUND' },
    { name: 'AdScheduler.isActive(ad, now)', sig: '(Ad, Date) => boolean', throws: 'none' }
  ],
  [
    '生效判定：now >= startAt && now <= endAt',
    '返回当前时刻生效的 1 个广告（多则取 endAt 最晚）',
    '无生效广告时返 null（前端展示位空）',
    'site_config.bannerAdId 引用 ads store；删除时需校验是否被引用（防止悬挂引用）',
    'endAt <= startAt → VALIDATION_FAILED(400)'
  ]
);

// INTF-020 限流 API（横切）
writeIntf(20, 'INTF-020', '限流 API（横切）', 'SD-020',
  'HTTP/REST/JSON（中间件）', '/', '全局中间件（所有路由生效）',
  '默认 100 req/min/IP；/auth/login 10 req/min/IP',
  'IP 级滑动窗口限流；超过返 429 RATE_LIMITED；/auth/login 单独严格限流防爆破',
  'src/middleware/rate-limit.middleware.ts + src/modules/rate-limit/rate-limit.service.ts',
  '所有路由（全局中间件）',
  ['rate_limit_windows store (Map<ip, number[]>)'],
  [
    {
      method: '*', path: '*', name: 'rateLimitMiddleware',
      purpose: '全局限流中间件（IP 维度滑动窗口）',
      headers: { 'X-Forwarded-For': '客户端 IP（来自反向代理）' },
      params: [],
      respStatus: 429,
      respFields: [
        { name: 'error', type: 'string', desc: '"RATE_LIMITED"' },
        { name: 'message', type: 'string', desc: '"Too many requests, please retry later."' },
        { name: 'retryAfter', type: 'number', desc: '剩余秒数' }
      ],
      errorCodes: [
        { code: 'RATE_LIMITED', status: 429, scene: 'IP 在窗口内超过阈值' }
      ],
      reqExample: {},
      respExample: { error: 'RATE_LIMITED', message: 'Too many requests, please retry later.', retryAfter: 30 }
    }
  ],
  [
    { name: 'RateLimitService.check(ip, route, now)', sig: '(string, string, number) => {allowed: boolean, remaining: number, retryAfter: number}', throws: 'none' },
    { name: 'RateLimitService.consume(ip, route, now)', sig: '(string, string, number) => void', throws: 'none' },
    { name: 'SlidingWindow.trim(window, now, windowSize)', sig: '(number[], number, number) => number[]', throws: 'none' }
  ],
  [
    '默认阈值：100 req/min/IP（NFR-005）',
    '/auth/login 单独阈值：10 req/min/IP（防爆破）',
    '滑动窗口：保留最近 60s 的请求时间戳数组',
    '超限返 429 RATE_LIMITED + Retry-After 头（剩余秒数）',
    'IP 来源：X-Forwarded-For 第一项（若存在），否则 req.ip',
    '内部服务间调用（无 IP）走不同阈值或白名单（本接口不处理）'
  ]
);

// INTF-021 路由层 API（横切）
writeIntf(21, 'INTF-021', '路由层 API（横切）', 'SD-021',
  'Express Router', '/api/v1', '中间件链：rateLimit → authGuard → 业务路由',
  '继承各业务路由',
  '22 个业务模块的路由聚合；统一中间件链；OpenAPI 文档导出（可选）',
  'src/router/index.ts + src/router/*.router.ts',
  'HTTP 客户端',
  ['所有业务 store（通过路由 handler）'],
  [
    {
      method: '*', path: '/api/v1/*', name: 'apiRouter',
      purpose: '/api/v1 前缀的路由聚合（22 业务模块）',
      headers: { 'Authorization': 'Bearer <jwt>（按路由可选）' },
      params: [],
      respStatus: 200,
      respFields: [
        { name: 'response', type: 'object', desc: '由具体路由 handler 决定' }
      ],
      errorCodes: [
        { code: 'NOT_FOUND', status: 404, scene: '路由不存在' }
      ],
      reqExample: {},
      respExample: {}
    }
  ],
  [
    { name: 'apiRouter.use(path, subRouter)', sig: '(string, Router) => void', throws: 'none' },
    { name: 'apiRouter.mount()', sig: '() => Router', throws: 'none' }
  ],
  [
    '统一前缀 /api/v1',
    '中间件链：rateLimit（SD-020）→ authGuard（解析 JWT，注入 req.user）→ 业务路由',
    '业务路由：auth/user/follow/blogger/post/interaction/tag/search/comment/notification/rss/webhook/site-config/access-record/audit-log/stats/recommend/ad',
    '错误处理：未匹配路由 → 404 NOT_FOUND；运行时异常 → SD-022 全局错误中间件',
    '健康检查：GET /health（不在 /api/v1 下，返回 200）'
  ]
);

// INTF-022 错误处理 API（横切）
writeIntf(22, 'INTF-022', '错误处理 API（横切）', 'SD-022',
  'Express Error Middleware', '/', '全局错误处理（捕获所有路由的 next(err) 与 throw）',
  '—',
  'AppError 统一封装 + 错误码字典 + 4xx/5xx 错误响应 + 500 INTERNAL fallback',
  'src/middleware/error.middleware.ts + src/shared/errors/app-error.ts',
  '所有路由',
  ['错误码字典（src/shared/errors/error-codes.ts）', 'audit_logs (5xx 自动审计)'],
  [
    {
      method: '*', path: '*', name: 'globalErrorHandler',
      purpose: '全局错误处理中间件（捕获 AppError + 未捕获异常）',
      headers: {},
      params: [],
      respStatus: '4xx/5xx',
      respFields: [
        { name: 'error', type: 'string', desc: '错误码字符串' },
        { name: 'message', type: 'string', desc: '人类可读消息' },
        { name: 'details', type: 'object', desc: '可选：字段级错误详情' }
      ],
      errorCodes: [
        { code: 'INTERNAL', status: 500, scene: '未捕获异常 / 系统错误' }
      ],
      reqExample: {},
      respExample: { error: 'POST_NOT_FOUND', message: 'Post p_aaa not found', details: { postId: 'p_aaa' } }
    }
  ],
  [
    { name: 'AppError(code, status, message, details?)', sig: 'class extending Error', throws: '—' },
    { name: 'globalErrorHandler(err, req, res, next)', sig: '(Error, Request, Response, NextFunction) => void', throws: 'none' },
    { name: 'errorCodeToHttpStatus(code)', sig: '(string) => number', throws: 'none' }
  ],
  [
    '所有业务层抛 AppError(code, status, message, details?)',
    '错误码分层：4xx 客户端错误 / 5xx 服务端错误 / 60000-69999 业务规则错误',
    '5xx 错误自动写 audit_log（SD-016）',
    '响应结构统一：{ error, message, details? }',
    '生产环境隐藏堆栈；开发环境可输出 stack',
    '未匹配路由 → 404 NOT_FOUND（由 SD-021 路由层调用）'
  ]
);

console.log('§3.15-§3.22 (INTF-015~022) 写入完成，大小：', fs.statSync(outputPath).size, 'bytes');
