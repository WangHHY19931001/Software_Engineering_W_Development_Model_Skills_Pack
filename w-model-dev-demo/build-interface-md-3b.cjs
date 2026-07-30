// Append INTF-004 ~ INTF-008
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

// INTF-004 博主认证 API
writeIntf(4, 'INTF-004', '博主认证 API', 'SD-004',
  'HTTP/REST/JSON', '/api/v1', 'POST /bloggers/apply Bearer JWT (role=reader) / POST /me/bloggers/:id/switch Bearer JWT (role=reader)',
  '100 req/min/IP',
  'Reader 申请博主资格；多博主身份切换（签发 sub=bloggerId 的新 JWT）',
  'src/modules/blogger/blogger.{controller,service}.ts',
  '前端博主申请页 / 多博主切换器',
  ['user store (readerId 校验)', 'blogger store (bloggerId 校验)', 'user_blogger_bindings store'],
  [
    {
      method: 'POST', path: '/bloggers/apply', name: 'applyForBlogger',
      purpose: 'Reader 申请博主资格（创建 blogger + 绑定 user↔blogger）',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer <jwt>' },
      params: [
        { name: 'displayName', loc: 'body', type: 'string', required: true, constraint: 'len 1-64', desc: '博主显示名' },
        { name: 'bio', loc: 'body', type: 'string', required: false, constraint: 'len 0-500', desc: '个人简介' }
      ],
      respStatus: 201,
      respFields: [
        { name: 'bloggerId', type: 'string', desc: '新 bloggerId' },
        { name: 'displayName', type: 'string', desc: '回显' },
        { name: 'role', type: 'string', desc: '"blogger"' },
        { name: 'createdAt', type: 'string (ISO8601)', desc: '创建时间' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'VALIDATION_FAILED', status: 400, scene: 'Zod 校验失败' },
        { code: 'ALREADY_A_BLOGGER', status: 409, scene: '该 reader 已是 blogger' }
      ],
      reqExample: { displayName: 'Bob Tech Blog', bio: '全栈技术分享' },
      respExample: { bloggerId: 'b_newbloggerid1234567890ab', displayName: 'Bob Tech Blog', role: 'blogger', createdAt: '2026-07-30T10:20:00.000Z' }
    },
    {
      method: 'POST', path: '/me/bloggers/:id/switch', name: 'switchBlogger',
      purpose: 'Reader 在多博主绑定中切换当前身份（签发新 token sub=bloggerId）',
      headers: { 'Authorization': 'Bearer <reader-jwt>' },
      params: [
        { name: 'id', loc: 'path', type: 'string', required: true, constraint: 'pattern=^b_', desc: '目标 bloggerId' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'token', type: 'string', desc: '新 JWT; sub=bloggerId; role=blogger' },
        { name: 'bloggerId', type: 'string', desc: '回显' },
        { name: 'role', type: 'string', desc: '"blogger"' },
        { name: 'expiresIn', type: 'number', desc: '86400' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'BLOGGER_NOT_FOUND', status: 404, scene: 'bloggerId 不存在' },
        { code: 'FORBIDDEN_NOT_OWNED', status: 403, scene: 'reader 未绑定该 blogger（user_blogger_bindings 缺失）' }
      ],
      reqExample: { params: { id: 'b_b1c2d3e4f5g6h7i8j9k0l1m2' } },
      respExample: { token: 'eyJ...', bloggerId: 'b_b1c2d3e4f5g6h7i8j9k0l1m2', role: 'blogger', expiresIn: 86400 }
    }
  ],
  [
    { name: 'BloggerService.registerBlogger(readerId, input)', sig: '(string, BloggerApplyInput) => Blogger', throws: 'ALREADY_A_BLOGGER' },
    { name: 'BloggerService.switchBlogger(readerId, bloggerId)', sig: '(string, string) => {token, bloggerId, role}', throws: 'BLOGGER_NOT_FOUND, FORBIDDEN_NOT_OWNED' },
    { name: 'BloggerService.isOwnedBy(readerId, bloggerId)', sig: '(string, string) => boolean', throws: 'none' }
  ],
  [
    '切换身份时必须验证 user_blogger_bindings 存在性（防止跨用户越权）',
    '切换后签发新 token，sub=bloggerId role=blogger（不再是 reader sub）',
    'blogger.registered 必须发布事件，SD-016 审计订阅'
  ]
);

// INTF-005 博文 API
writeIntf(5, 'INTF-005', '博文 API', 'SD-005',
  'HTTP/REST/JSON', '/api/v1', 'POST/PUT/DELETE Bearer JWT (role=blogger)',
  '100 req/min/IP',
  '博文 CRUD + draft↔published 状态机 + 软删 + owner 校验',
  'src/modules/post/post.{controller,service,state-machine}.ts',
  '博主编辑后台',
  ['blogger store (owner 校验)', 'posts store (Map<postId,Post>)', 'post_tags store'],
  [
    {
      method: 'POST', path: '/posts', name: 'createDraft',
      purpose: '创建博文草稿（status=draft）',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer <blogger-jwt>' },
      params: [
        { name: 'title', loc: 'body', type: 'string', required: true, constraint: 'len 1-200', desc: '标题' },
        { name: 'content', loc: 'body', type: 'string', required: true, constraint: 'len 1-100000', desc: '正文' },
        { name: 'tags', loc: 'body', type: 'string[]', required: false, constraint: 'maxItems=5', desc: '可选标签' }
      ],
      respStatus: 201,
      respFields: [
        { name: 'postId', type: 'string', desc: 'p_ 开头 24 字符' },
        { name: 'title', type: 'string', desc: '回显' },
        { name: 'content', type: 'string', desc: '回显' },
        { name: 'status', type: 'string', desc: '"draft"' },
        { name: 'authorId', type: 'string', desc: '当前 bloggerId' },
        { name: 'createdAt', type: 'string (ISO8601)', desc: '创建时间' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'FORBIDDEN', status: 403, scene: 'role 非 blogger' },
        { code: 'VALIDATION_FAILED', status: 400, scene: 'Zod 校验失败' }
      ],
      reqExample: { title: '我的第一篇博文', content: '正文内容...', tags: ['tech', 'nodejs'] },
      respExample: { postId: 'p_postid1234567890abcdef', title: '我的第一篇博文', content: '正文内容...', status: 'draft', authorId: 'b_b1c2d3e4f5g6h7i8j9k0l1m2', createdAt: '2026-07-30T10:30:00.000Z' }
    },
    {
      method: 'PUT', path: '/posts/:id', name: 'updatePost',
      purpose: '编辑博文（仅 owner；draft 任意字段，published 仅允许修改 title/content）',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer <blogger-jwt>' },
      params: [
        { name: 'id', loc: 'path', type: 'string', required: true, constraint: 'pattern=^p_', desc: '目标 postId' },
        { name: 'title', loc: 'body', type: 'string', required: false, constraint: 'len 1-200', desc: '新标题' },
        { name: 'content', loc: 'body', type: 'string', required: false, constraint: 'len 1-100000', desc: '新正文' },
        { name: 'tags', loc: 'body', type: 'string[]', required: false, constraint: 'maxItems=5', desc: '新标签' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'postId', type: 'string', desc: '回显' },
        { name: 'title', type: 'string', desc: '修改后' },
        { name: 'content', type: 'string', desc: '修改后' },
        { name: 'status', type: 'string', desc: '当前状态' },
        { name: 'updatedAt', type: 'string (ISO8601)', desc: '更新时间' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'FORBIDDEN_NOT_OWNER', status: 403, scene: 'token.sub != post.authorId' },
        { code: 'POST_NOT_FOUND', status: 404, scene: 'postId 不存在' }
      ],
      reqExample: { params: { id: 'p_postid1234567890abcdef' }, body: { title: '我的第一篇博文 v2', content: '更新正文...' } },
      respExample: { postId: 'p_postid1234567890abcdef', title: '我的第一篇博文 v2', content: '更新正文...', status: 'draft', updatedAt: '2026-07-30T10:35:00.000Z' }
    },
    {
      method: 'POST', path: '/posts/:id/publish', name: 'publishPost',
      purpose: '发布博文（draft→published；校验正文非空；触发 SD-011 通知 + SD-013 Webhook）',
      headers: { 'Authorization': 'Bearer <blogger-jwt>' },
      params: [
        { name: 'id', loc: 'path', type: 'string', required: true, constraint: 'pattern=^p_', desc: '目标 postId' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'postId', type: 'string', desc: '回显' },
        { name: 'status', type: 'string', desc: '"published"' },
        { name: 'publishedAt', type: 'string (ISO8601)', desc: '发布时间' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'FORBIDDEN_NOT_OWNER', status: 403, scene: '非 owner' },
        { code: 'POST_NOT_FOUND', status: 404, scene: 'postId 不存在' },
        { code: 'EMPTY_CONTENT', status: 422, scene: 'content.trim().length=0' },
        { code: 'INVALID_STATE_TRANSITION', status: 409, scene: '当前状态不允许 published（如已 deleted）' }
      ],
      reqExample: { params: { id: 'p_postid1234567890abcdef' } },
      respExample: { postId: 'p_postid1234567890abcdef', status: 'published', publishedAt: '2026-07-30T10:40:00.000Z' }
    },
    {
      method: 'DELETE', path: '/posts/:id', name: 'softDeletePost',
      purpose: '软删博文（仅 owner；status 改为 deleted）',
      headers: { 'Authorization': 'Bearer <blogger-jwt>' },
      params: [
        { name: 'id', loc: 'path', type: 'string', required: true, constraint: 'pattern=^p_', desc: '目标 postId' }
      ],
      respStatus: 204,
      respFields: [],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'FORBIDDEN_NOT_OWNER', status: 403, scene: '非 owner' },
        { code: 'POST_NOT_FOUND', status: 404, scene: 'postId 不存在' },
        { code: 'ALREADY_DELETED', status: 409, scene: '已删除' }
      ],
      reqExample: { params: { id: 'p_postid1234567890abcdef' } },
      respExample: null
    }
  ],
  [
    { name: 'PostService.createDraft(authorId, input)', sig: '(string, CreatePostInput) => Post', throws: 'VALIDATION_FAILED' },
    { name: 'PostService.updatePost(postId, authorId, updates)', sig: '(string, string, UpdatePostInput) => Post', throws: 'POST_NOT_FOUND, FORBIDDEN_NOT_OWNER' },
    { name: 'PostService.publishPost(postId, authorId)', sig: '(string, string) => Post', throws: 'POST_NOT_FOUND, FORBIDDEN_NOT_OWNER, EMPTY_CONTENT, INVALID_STATE_TRANSITION' },
    { name: 'PostService.softDeletePost(postId, authorId)', sig: '(string, string) => void', throws: 'POST_NOT_FOUND, FORBIDDEN_NOT_OWNER, ALREADY_DELETED' },
    { name: 'PostStateMachine.transitionTo(post, newStatus)', sig: '(Post, PostStatus) => Post', throws: 'INVALID_STATE_TRANSITION' }
  ],
  [
    '状态机：draft → published → deleted（不可逆；published 后只能 → deleted）',
    'owner 校验：post.authorId === token.sub（bloggerId）',
    'publishPost 必须发布 post.published 事件，SD-011/SD-013 订阅',
    'softDelete 不物理删除（status=deleted 标记，保留用于审计）',
    'EMPTY_CONTENT 检查：content.trim().length > 0'
  ]
);

// INTF-006 浏览 API
writeIntf(6, 'INTF-006', '浏览 API', 'SD-006',
  'HTTP/REST/JSON', '/api/v1', 'GET 公开（GET /posts/:id 写 access_record）',
  '100 req/min/IP',
  '博文列表分页筛选 + 详情查询 + 访问记录写入',
  'src/modules/post/post-view.{controller,service}.ts',
  '前端首页 / 博文详情页',
  ['posts store', 'access_records store', 'stats_buckets store'],
  [
    {
      method: 'GET', path: '/posts', name: 'listPosts',
      purpose: '分页列出已发布博文（支持按标签过滤）',
      headers: { 'Accept': 'application/json' },
      params: [
        { name: 'page', loc: 'query', type: 'number', required: false, constraint: 'min=1, default=1', desc: '页码' },
        { name: 'pageSize', loc: 'query', type: 'number', required: false, constraint: 'min=1, max=100, default=20', desc: '每页' },
        { name: 'status', loc: 'query', type: 'string', required: false, constraint: 'enum=[published], default=published', desc: '状态过滤' },
        { name: 'tags', loc: 'query', type: 'string[]', required: false, constraint: '—', desc: '标签过滤（多个逗号分隔）' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'items', type: 'PostListItem[]', desc: '博文列表' },
        { name: 'page', type: 'number', desc: '当前页' },
        { name: 'pageSize', type: 'number', desc: '每页数' },
        { name: 'total', type: 'number', desc: '总数' },
        { name: 'totalPages', type: 'number', desc: '总页数' }
      ],
      errorCodes: [
        { code: 'INVALID_PAGINATION', status: 400, scene: 'page<1 或 pageSize>100' }
      ],
      reqExample: { query: { page: 1, pageSize: 20, status: 'published' } },
      respExample: { items: [{ postId: 'p_aaa', title: '博文1', excerpt: '...', authorId: 'b_xxx', authorName: 'Bob', publishedAt: '2026-07-30T08:00:00.000Z', tags: ['tech'], likeCount: 10 }], page: 1, pageSize: 20, total: 1, totalPages: 1 }
    },
    {
      method: 'GET', path: '/posts/:id', name: 'getPostDetail',
      purpose: '获取博文详情（仅 published；写 access_record）',
      headers: { 'Accept': 'application/json' },
      params: [
        { name: 'id', loc: 'path', type: 'string', required: true, constraint: 'pattern=^p_', desc: '目标 postId' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'postId', type: 'string', desc: '回显' },
        { name: 'title', type: 'string', desc: '标题' },
        { name: 'content', type: 'string', desc: '正文' },
        { name: 'authorId', type: 'string', desc: '作者 bloggerId' },
        { name: 'authorName', type: 'string', desc: '作者显示名' },
        { name: 'publishedAt', type: 'string (ISO8601)', desc: '发布时间' },
        { name: 'tags', type: 'string[]', desc: '标签' },
        { name: 'likeCount', type: 'number', desc: '点赞数' },
        { name: 'commentCount', type: 'number', desc: '评论数' }
      ],
      errorCodes: [
        { code: 'POST_NOT_FOUND', status: 404, scene: 'postId 不存在或非 published' }
      ],
      reqExample: { params: { id: 'p_aaa' } },
      respExample: { postId: 'p_aaa', title: '博文1', content: '正文...', authorId: 'b_xxx', authorName: 'Bob', publishedAt: '2026-07-30T08:00:00.000Z', tags: ['tech'], likeCount: 10, commentCount: 5 }
    }
  ],
  [
    { name: 'PostViewService.listPosts(filter, page, pageSize)', sig: '({status?,tags?}, number, number) => PaginatedPosts', throws: 'none' },
    { name: 'PostViewService.getPostDetail(postId, viewerId)', sig: '(string, string?) => PostDetail', throws: 'POST_NOT_FOUND' },
    { name: 'PostViewService.recordAccess(postId, viewerId, ip)', sig: '(string, string?, string) => void', throws: 'none' }
  ],
  [
    '列表只返回 status=published；draft/deleted 不可见（防泄漏）',
    'GET /posts/:id 必须写 access_record（异步最佳，但内存下同步 OK）',
    '返回字段不包含 content 全文（列表用 excerpt 截断前 200 字）'
  ]
);

// INTF-007 互动 API
writeIntf(7, 'INTF-007', '互动 API', 'SD-007',
  'HTTP/REST/JSON', '/api/v1', 'POST Bearer JWT (role=reader) / GET Bearer JWT (role=reader)',
  '100 req/min/IP',
  '点赞/收藏（幂等）+ 我的收藏列表 + 通知触发（like.created → 通知博主）',
  'src/modules/post/interaction.{controller,service}.ts',
  '前端博文详情页的点赞/收藏按钮',
  ['user store (userId 校验)', 'posts store (postId 校验)', 'likes store (Map<postId,Set<userId>>)', 'bookmarks store (Map<userId,Set<postId>>)'],
  [
    {
      method: 'POST', path: '/posts/:id/like', name: 'likePost',
      purpose: '点赞（幂等；已点赞返回 200）',
      headers: { 'Authorization': 'Bearer <reader-jwt>' },
      params: [
        { name: 'id', loc: 'path', type: 'string', required: true, constraint: 'pattern=^p_', desc: '目标 postId' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'liked', type: 'boolean', desc: 'const true' },
        { name: 'postId', type: 'string', desc: '回显' },
        { name: 'likeCount', type: 'number', desc: '当前点赞数' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'POST_NOT_FOUND', status: 404, scene: 'postId 不存在' }
      ],
      reqExample: { params: { id: 'p_aaa' } },
      respExample: { liked: true, postId: 'p_aaa', likeCount: 11 }
    },
    {
      method: 'POST', path: '/posts/:id/bookmark', name: 'bookmarkPost',
      purpose: '收藏（幂等；已收藏返回 200）',
      headers: { 'Authorization': 'Bearer <reader-jwt>' },
      params: [
        { name: 'id', loc: 'path', type: 'string', required: true, constraint: 'pattern=^p_', desc: '目标 postId' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'bookmarked', type: 'boolean', desc: 'const true' },
        { name: 'postId', type: 'string', desc: '回显' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'POST_NOT_FOUND', status: 404, scene: 'postId 不存在' }
      ],
      reqExample: { params: { id: 'p_aaa' } },
      respExample: { bookmarked: true, postId: 'p_aaa' }
    },
    {
      method: 'GET', path: '/me/bookmarks', name: 'listMyBookmarks',
      purpose: '我的收藏列表（分页）',
      headers: { 'Authorization': 'Bearer <reader-jwt>' },
      params: [
        { name: 'page', loc: 'query', type: 'number', required: false, constraint: 'min=1, default=1', desc: '页码' },
        { name: 'pageSize', loc: 'query', type: 'number', required: false, constraint: 'min=1, max=100, default=20', desc: '每页' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'items', type: 'BookmarkItem[]', desc: '收藏列表' },
        { name: 'page', type: 'number', desc: '当前页' },
        { name: 'total', type: 'number', desc: '总数' },
        { name: 'totalPages', type: 'number', desc: '总页数' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' }
      ],
      reqExample: { query: { page: 1, pageSize: 20 } },
      respExample: { items: [{ postId: 'p_aaa', title: '博文1', bookmarkedAt: '2026-07-30T10:00:00.000Z' }], page: 1, total: 1, totalPages: 1 }
    }
  ],
  [
    { name: 'InteractionService.likePost(userId, postId)', sig: '(string, string) => {liked:boolean, likeCount:number}', throws: 'POST_NOT_FOUND' },
    { name: 'InteractionService.bookmarkPost(userId, postId)', sig: '(string, string) => {bookmarked:boolean}', throws: 'POST_NOT_FOUND' },
    { name: 'InteractionService.listMyBookmarks(userId, page, pageSize)', sig: '(string, number, number) => PaginatedBookmarks', throws: 'none' }
  ],
  [
    '点赞/收藏幂等（多次调用结果一致）',
    'like.created 事件触发 SD-011 通知博主',
    'token.sub=userId，校验 userId 必须在 user store 存在',
    'bookmark.created 不触发通知（避免刷屏）'
  ]
);

// INTF-008 标签 API
writeIntf(8, 'INTF-008', '标签 API', 'SD-008',
  'HTTP/REST/JSON', '/api/v1', 'POST /tags, POST/DELETE /posts/:id/tags Bearer JWT (role=blogger) / GET 公开',
  '100 req/min/IP',
  '标签 CRUD + 关联博文（1-5 个，幂等去重）+ 反向查询',
  'src/modules/tag/tag.{controller,service}.ts + src/modules/tag/post-tag-index.ts',
  '前端发文页标签选择器 / 标签聚合页',
  ['blogger store', 'posts store', 'tags store (Map<tagName,Tag>)', 'post_tags store (Map<postId,Set<tagName>> + Map<tagName,Set<postId>>)'],
  [
    {
      method: 'POST', path: '/tags', name: 'createTag',
      purpose: '创建标签（全局唯一；已存在返回 200 idempotent）',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer <blogger-jwt>' },
      params: [
        { name: 'name', loc: 'body', type: 'string', required: true, constraint: 'len 1-32, pattern=^[a-z0-9-]+$', desc: '标签名（小写+连字符）' }
      ],
      respStatus: 201,
      respFields: [
        { name: 'tagId', type: 'string', desc: 't_ 开头' },
        { name: 'name', type: 'string', desc: '回显' },
        { name: 'postCount', type: 'number', desc: '关联博文数' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'FORBIDDEN', status: 403, scene: 'role 非 blogger' },
        { code: 'VALIDATION_FAILED', status: 400, scene: 'name 格式错' }
      ],
      reqExample: { name: 'tech' },
      respExample: { tagId: 't_tech001', name: 'tech', postCount: 0 }
    },
    {
      method: 'POST', path: '/posts/:id/tags', name: 'attachTags',
      purpose: '关联标签到博文（1-5 个；幂等去重）',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer <blogger-jwt>' },
      params: [
        { name: 'id', loc: 'path', type: 'string', required: true, constraint: 'pattern=^p_', desc: '目标 postId' },
        { name: 'tags', loc: 'body', type: 'string[]', required: true, constraint: 'minItems=1, maxItems=5', desc: '要关联的标签名列表' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'postId', type: 'string', desc: '回显' },
        { name: 'tags', type: 'string[]', desc: '关联后的全部标签' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'FORBIDDEN_NOT_OWNER', status: 403, scene: '非博文 owner' },
        { code: 'POST_NOT_FOUND', status: 404, scene: 'postId 不存在' },
        { code: 'TAG_NOT_FOUND', status: 404, scene: '某 tag 未在 tags store 创建' },
        { code: 'TOO_MANY_TAGS', status: 422, scene: '>5 个标签' }
      ],
      reqExample: { params: { id: 'p_aaa' }, body: { tags: ['tech', 'nodejs'] } },
      respExample: { postId: 'p_aaa', tags: ['tech', 'nodejs'] }
    },
    {
      method: 'DELETE', path: '/posts/:id/tags/:name', name: 'detachTag',
      purpose: '解除标签关联',
      headers: { 'Authorization': 'Bearer <blogger-jwt>' },
      params: [
        { name: 'id', loc: 'path', type: 'string', required: true, constraint: 'pattern=^p_', desc: 'postId' },
        { name: 'name', loc: 'path', type: 'string', required: true, constraint: 'pattern=^[a-z0-9-]+$', desc: '标签名' }
      ],
      respStatus: 204,
      respFields: [],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'FORBIDDEN_NOT_OWNER', status: 403, scene: '非 owner' },
        { code: 'POST_NOT_FOUND', status: 404, scene: 'postId 不存在' }
      ],
      reqExample: { params: { id: 'p_aaa', name: 'tech' } },
      respExample: null
    },
    {
      method: 'GET', path: '/tags/:name/posts', name: 'listPostsByTag',
      purpose: '按标签查博文（分页）',
      headers: { 'Accept': 'application/json' },
      params: [
        { name: 'name', loc: 'path', type: 'string', required: true, constraint: 'pattern=^[a-z0-9-]+$', desc: '标签名' },
        { name: 'page', loc: 'query', type: 'number', required: false, constraint: 'min=1, default=1', desc: '页码' },
        { name: 'pageSize', loc: 'query', type: 'number', required: false, constraint: 'min=1, max=100, default=20', desc: '每页' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'items', type: 'PostListItem[]', desc: '博文列表' },
        { name: 'page', type: 'number', desc: '当前页' },
        { name: 'total', type: 'number', desc: '总数' },
        { name: 'totalPages', type: 'number', desc: '总页数' }
      ],
      errorCodes: [
        { code: 'TAG_NOT_FOUND', status: 404, scene: '标签不存在' },
        { code: 'INVALID_PAGINATION', status: 400, scene: 'page<1 或 pageSize>100' }
      ],
      reqExample: { params: { name: 'tech' }, query: { page: 1, pageSize: 20 } },
      respExample: { items: [{ postId: 'p_aaa', title: '博文1', authorId: 'b_xxx', publishedAt: '2026-07-30T08:00:00.000Z' }], page: 1, total: 1, totalPages: 1 }
    }
  ],
  [
    { name: 'TagService.createTag(name)', sig: '(string) => Tag', throws: 'VALIDATION_FAILED' },
    { name: 'TagService.attachTags(postId, ownerId, tags)', sig: '(string, string, string[]) => string[]', throws: 'POST_NOT_FOUND, FORBIDDEN_NOT_OWNER, TOO_MANY_TAGS' },
    { name: 'TagService.detachTag(postId, ownerId, name)', sig: '(string, string, string) => void', throws: 'POST_NOT_FOUND, FORBIDDEN_NOT_OWNER' },
    { name: 'TagService.listPostsByTag(name, page, pageSize)', sig: '(string, number, number) => PaginatedPosts', throws: 'TAG_NOT_FOUND' },
    { name: 'PostTagIndex.upsert(postId, name)', sig: '(string, string) => void', throws: 'none' },
    { name: 'PostTagIndex.delete(postId, name)', sig: '(string, string) => void', throws: 'none' }
  ],
  [
    'tag 名小写 + 连字符（[a-z0-9-]+）；max 32 字符',
    '每篇博文 1-5 个标签；超过返 TOO_MANY_TAGS(422)',
    'PostTagIndex 双向维护：post_tags[postId].add(name) && tag_posts[name].add(postId)',
    'attaching tags 时校验每个 tag 已在 tags store 创建；不存在 → TAG_NOT_FOUND(404)',
    'owner 校验：post.authorId === token.sub（bloggerId）'
  ]
);

console.log('§3.4-§3.8 (INTF-004~008) 写入完成，大小：', fs.statSync(outputPath).size, 'bytes');
