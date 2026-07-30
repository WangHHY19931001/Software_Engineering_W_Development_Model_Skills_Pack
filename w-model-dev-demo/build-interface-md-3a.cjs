// Append §3 header + INTF-001 ~ INTF-007
const fs = require('fs');
const path = require('path');
const outputPath = path.resolve('d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev-demo/docs/phase3-design/interface-design.md');
function W(s) { fs.appendFileSync(outputPath, s, 'utf-8'); }

W('## 3. 接口契约（22 INTF）\n\n');
W('> 每个 INTF 按 OpenAPI 3.0 风格详细定义：路径 / 方法 / 请求 / 响应 / 错误码 / 认证 / 限流。\n');
W('> 集成测试用例索引见 §10 与 `docs/phase3-design/integration-test.md`。\n\n');

// ============================================================================
// Helper: 写一个 INTF 章节
// ============================================================================
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

// ============================================================================
// INTF-001 认证 API
// ============================================================================
writeIntf(1, 'INTF-001', '认证 API', 'SD-001',
  'HTTP/REST/JSON', '/api/v1', 'POST /users 无认证 / POST /auth/login 无认证 / POST /bloggers 无认证',
  '100 req/min/IP（NFR-005）；/auth/login 单独 10 req/min/IP 防爆破',
  '用户与博主注册入口；通用登录端点；JWT 签发（HS256, 24h TTL）；密码 bcrypt cost=10',
  'src/modules/user/auth.{controller,service}.ts + src/modules/blogger/auth.{controller,service}.ts',
  'Reader/Blogger 客户端；密码经 Zod 校验后哈希入库',
  ['user store (Map<userId,User>)', 'blogger store (Map<bloggerId,Blogger>)'],
  [
    {
      method: 'POST', path: '/users', name: 'registerUser',
      purpose: '注册 reader 账号（email+username+password）',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      params: [
        { name: 'email', loc: 'body', type: 'string', required: true, constraint: 'format=email, len 5-254', desc: '邮箱（唯一）' },
        { name: 'username', loc: 'body', type: 'string', required: true, constraint: 'len 3-32, pattern=^[a-zA-Z0-9_-]+$', desc: '用户名（唯一）' },
        { name: 'password', loc: 'body', type: 'string', required: true, constraint: 'len 8-128', desc: '明文密码（入库前 bcrypt）' }
      ],
      respStatus: 201,
      respFields: [
        { name: 'userId', type: 'string', desc: 'u_ 开头 24 字符' },
        { name: 'email', type: 'string', desc: '回显邮箱' },
        { name: 'username', type: 'string', desc: '回显用户名' },
        { name: 'role', type: 'string', desc: '"reader"' },
        { name: 'createdAt', type: 'string (ISO8601)', desc: '创建时间' }
      ],
      errorCodes: [
        { code: 'VALIDATION_FAILED', status: 400, scene: 'Zod 校验失败（邮箱格式/密码长度）' },
        { code: 'EMAIL_ALREADY_EXISTS', status: 409, scene: '邮箱已被注册' },
        { code: 'USERNAME_TAKEN', status: 409, scene: '用户名已被占用' },
        { code: 'RATE_LIMITED', status: 429, scene: 'IP 触发限流（>100/min）' }
      ],
      reqExample: { email: 'alice@example.com', username: 'alice', password: 'pass1234' },
      respExample: { userId: 'u_a1b2c3d4e5f6g7h8i9j0k1l2', email: 'alice@example.com', username: 'alice', role: 'reader', createdAt: '2026-07-30T10:00:00.000Z' }
    },
    {
      method: 'POST', path: '/bloggers', name: 'registerBlogger',
      purpose: '注册 blogger 账号（独立入口，不复用 /users）',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      params: [
        { name: 'email', loc: 'body', type: 'string', required: true, constraint: 'format=email', desc: '邮箱（唯一）' },
        { name: 'username', loc: 'body', type: 'string', required: true, constraint: 'len 3-32, pattern=^[a-zA-Z0-9_-]+$', desc: '用户名（唯一）' },
        { name: 'password', loc: 'body', type: 'string', required: true, constraint: 'len 8-128', desc: '明文密码' },
        { name: 'displayName', loc: 'body', type: 'string', required: true, constraint: 'len 1-64', desc: '显示名（区别 username）' }
      ],
      respStatus: 201,
      respFields: [
        { name: 'bloggerId', type: 'string', desc: 'b_ 开头 24 字符' },
        { name: 'email', type: 'string', desc: '回显邮箱' },
        { name: 'username', type: 'string', desc: '回显用户名' },
        { name: 'displayName', type: 'string', desc: '显示名' },
        { name: 'role', type: 'string', desc: '"blogger"' },
        { name: 'createdAt', type: 'string (ISO8601)', desc: '创建时间' }
      ],
      errorCodes: [
        { code: 'VALIDATION_FAILED', status: 400, scene: 'Zod 校验失败' },
        { code: 'EMAIL_ALREADY_EXISTS', status: 409, scene: '邮箱已被注册' },
        { code: 'USERNAME_TAKEN', status: 409, scene: '用户名已被占用' },
        { code: 'RATE_LIMITED', status: 429, scene: 'IP 触发限流' }
      ],
      reqExample: { email: 'bob@example.com', username: 'bob', password: 'pass1234', displayName: 'Bob the Blogger' },
      respExample: { bloggerId: 'b_b1c2d3e4f5g6h7i8j9k0l1m2', email: 'bob@example.com', username: 'bob', displayName: 'Bob the Blogger', role: 'blogger', createdAt: '2026-07-30T10:00:00.000Z' }
    },
    {
      method: 'POST', path: '/auth/login', name: 'login',
      purpose: '通用登录端点；自动识别 reader/blogger/admin；签发 JWT',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      params: [
        { name: 'email', loc: 'body', type: 'string', required: true, constraint: 'format=email', desc: '邮箱' },
        { name: 'password', loc: 'body', type: 'string', required: true, constraint: 'len 1-128', desc: '明文密码' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'token', type: 'string', desc: 'JWT HS256; sub=accountId; role=reader|blogger|admin' },
        { name: 'userId', type: 'string', desc: 'readerId 或 bloggerId 或 adminId' },
        { name: 'role', type: 'string', desc: '"reader" | "blogger" | "admin"' },
        { name: 'expiresIn', type: 'number', desc: '秒（const 86400，24h TTL）' }
      ],
      errorCodes: [
        { code: 'VALIDATION_FAILED', status: 400, scene: '参数缺失' },
        { code: 'INVALID_CREDENTIALS', status: 401, scene: '账号/密码错（统一脱敏）' },
        { code: 'RATE_LIMITED', status: 429, scene: '登录端点单独限流 >10/min' }
      ],
      reqExample: { email: 'alice@example.com', password: 'pass1234' },
      respExample: { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', userId: 'u_a1b2c3d4e5f6g7h8i9j0k1l2', role: 'reader', expiresIn: 86400 }
    }
  ],
  [
    { name: 'UserRepository.create(user)', sig: '(Omit<User, "userId"|"createdAt">) => User', throws: 'EMAIL_ALREADY_EXISTS' },
    { name: 'UserRepository.findByEmail(email)', sig: '(string) => User | null', throws: 'none' },
    { name: 'BloggerRepository.create(blogger)', sig: '(Omit<Blogger, "bloggerId"|"createdAt">) => Blogger', throws: 'EMAIL_ALREADY_EXISTS' },
    { name: 'BloggerRepository.findByEmail(email)', sig: '(string) => Blogger | null', throws: 'none' },
    { name: 'PasswordService.hash(plain)', sig: '(string) => string (bcrypt cost=10)', throws: 'none' },
    { name: 'PasswordService.compare(plain, hash)', sig: '(string, string) => boolean', throws: 'none' },
    { name: 'JwtService.sign(payload, ttlSec)', sig: '({sub:string,role:string}, number) => string', throws: 'none' },
    { name: 'JwtService.verify(token)', sig: '(string) => {sub,role,iat,exp} | throws TOKEN_EXPIRED', throws: 'TOKEN_EXPIRED, UNAUTHENTICATED' }
  ],
  [
    '密码入库前必须经 bcrypt.hashSync(pw, 10)，getRounds >= 10（NFR-006）',
    '登录失败统一返回 INVALID_CREDENTIALS，不区分账号/密码存在性（NFR-003 账号枚举防护）',
    'JWT payload.sub = accountId；role ∈ {reader, blogger, admin}；exp = iat + 86400',
    '注册时 email 唯一索引；重复注册返回 EMAIL_ALREADY_EXISTS(409)',
    '登录响应严禁返回 passwordHash 字段（NFR-003 敏感信息脱敏）',
    'blogger.registered 事件必须由 SD-016 审计订阅'
  ]
);

// ============================================================================
// INTF-002 用户 API
// ============================================================================
writeIntf(2, 'INTF-002', '用户 API', 'SD-002',
  'HTTP/REST/JSON', '/api/v1', 'GET 公开 / PUT Bearer JWT (role=reader)',
  '100 req/min/IP',
  '用户公开资料查询 + 自助修改（昵称/简介/头像）',
  'src/modules/user/profile.{controller,service}.ts',
  '前端用户主页 / 个人设置页',
  ['user store (Map<userId,User>)'],
  [
    {
      method: 'GET', path: '/users/:id', name: 'getPublicProfile',
      purpose: '获取用户公开资料（不含 email/passwordHash）',
      headers: { 'Accept': 'application/json' },
      params: [
        { name: 'id', loc: 'path', type: 'string', required: true, constraint: 'pattern=^u_[0-9a-f]{24}$', desc: 'userId' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'userId', type: 'string', desc: '回显' },
        { name: 'username', type: 'string', desc: '用户名' },
        { name: 'displayName', type: 'string', desc: '显示名' },
        { name: 'bio', type: 'string', desc: '个人简介' },
        { name: 'avatarUrl', type: 'string', desc: '头像 URL' },
        { name: 'createdAt', type: 'string (ISO8601)', desc: '注册时间' }
      ],
      errorCodes: [
        { code: 'VALIDATION_FAILED', status: 400, scene: 'id 格式错' },
        { code: 'USER_NOT_FOUND', status: 404, scene: 'userId 不存在' }
      ],
      reqExample: { params: { id: 'u_a1b2c3d4e5f6g7h8i9j0k1l2' } },
      respExample: { userId: 'u_a1b2c3d4e5f6g7h8i9j0k1l2', username: 'alice', displayName: 'Alice', bio: '热爱技术', avatarUrl: 'https://cdn.example.com/avatars/u_a1b2c3d4.jpg', createdAt: '2026-07-30T10:00:00.000Z' }
    },
    {
      method: 'PUT', path: '/users/me', name: 'updateMyProfile',
      purpose: '修改自己资料（displayName/bio/avatarUrl）',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer <jwt>' },
      params: [
        { name: 'displayName', loc: 'body', type: 'string', required: false, constraint: 'len 1-64', desc: '新显示名' },
        { name: 'bio', loc: 'body', type: 'string', required: false, constraint: 'len 0-500', desc: '新简介' },
        { name: 'avatarUrl', loc: 'body', type: 'string', required: false, constraint: 'format=uri, len 0-512', desc: '新头像 URL' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'userId', type: 'string', desc: '回显' },
        { name: 'displayName', type: 'string', desc: '修改后' },
        { name: 'bio', type: 'string', desc: '修改后' },
        { name: 'avatarUrl', type: 'string', desc: '修改后' },
        { name: 'updatedAt', type: 'string (ISO8601)', desc: '更新时间' }
      ],
      errorCodes: [
        { code: 'VALIDATION_FAILED', status: 400, scene: 'Zod 校验失败' },
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺/错 Authorization 头' },
        { code: 'FORBIDDEN', status: 403, scene: 'role 非 reader' }
      ],
      reqExample: { displayName: 'Alice 2.0', bio: '前端工程师', avatarUrl: 'https://cdn.example.com/avatars/alice2.jpg' },
      respExample: { userId: 'u_a1b2c3d4e5f6g7h8i9j0k1l2', displayName: 'Alice 2.0', bio: '前端工程师', avatarUrl: 'https://cdn.example.com/avatars/alice2.jpg', updatedAt: '2026-07-30T10:05:00.000Z' }
    }
  ],
  [
    { name: 'UserProfileService.getPublicProfile(userId)', sig: '(string) => PublicUserProfile', throws: 'USER_NOT_FOUND' },
    { name: 'UserProfileService.updateMyProfile(userId, updates)', sig: '(string, ProfileUpdates) => PublicUserProfile', throws: 'UNAUTHENTICATED' },
    { name: 'UserProfileService.sanitizePublicFields(user)', sig: '(User) => PublicUserProfile', throws: 'none' }
  ],
  [
    '公开接口绝不可返回 email/passwordHash（字段过滤 NFR-003）',
    'PUT /users/me 的 token.sub 必须为 userId（reader role，token.sub=userId 强制对齐）',
    '修改资料后必须发布 user.profile.updated 事件，SD-016 审计订阅'
  ]
);

// ============================================================================
// INTF-003 关注 API
// ============================================================================
writeIntf(3, 'INTF-003', '关注 API', 'SD-003',
  'HTTP/REST/JSON', '/api/v1', 'POST/DELETE Bearer JWT (role=reader) / GET Bearer JWT',
  '100 req/min/IP',
  'Reader 关注/取关博主 + 关注列表 + 事件触发（follow.created → 通知）',
  'src/modules/user/follow.{controller,service}.ts',
  '前端博主主页关注按钮 / 我的关注页',
  ['user store (readerId 校验)', 'blogger store (bloggerId 校验)', 'follows store (Map<userId,Set<bloggerId>>)'],
  [
    {
      method: 'POST', path: '/follows/:bloggerId', name: 'followBlogger',
      purpose: 'Reader 关注博主（幂等：重复关注返回 200）',
      headers: { 'Authorization': 'Bearer <jwt>' },
      params: [
        { name: 'bloggerId', loc: 'path', type: 'string', required: true, constraint: 'pattern=^b_[0-9a-f]{24}$', desc: '目标博主 ID' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'followed', type: 'boolean', desc: 'const true' },
        { name: 'bloggerId', type: 'string', desc: '回显' },
        { name: 'createdAt', type: 'string (ISO8601)', desc: '关注时间' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺/错 JWT' },
        { code: 'FORBIDDEN', status: 403, scene: 'role 非 reader' },
        { code: 'BLOGGER_NOT_FOUND', status: 404, scene: 'bloggerId 不在 blogger store' },
        { code: 'SELF_FOLLOW_NOT_ALLOWED', status: 422, scene: '关注自己' }
      ],
      reqExample: { params: { bloggerId: 'b_b1c2d3e4f5g6h7i8j9k0l1m2' } },
      respExample: { followed: true, bloggerId: 'b_b1c2d3e4f5g6h7i8j9k0l1m2', createdAt: '2026-07-30T10:10:00.000Z' }
    },
    {
      method: 'DELETE', path: '/follows/:bloggerId', name: 'unfollowBlogger',
      purpose: '取关博主（幂等：未关注返回 200）',
      headers: { 'Authorization': 'Bearer <jwt>' },
      params: [
        { name: 'bloggerId', loc: 'path', type: 'string', required: true, constraint: 'pattern=^b_', desc: '目标博主 ID' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'followed', type: 'boolean', desc: 'const false' },
        { name: 'bloggerId', type: 'string', desc: '回显' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺/错 JWT' },
        { code: 'BLOGGER_NOT_FOUND', status: 404, scene: 'bloggerId 不存在' }
      ],
      reqExample: { params: { bloggerId: 'b_b1c2d3e4f5g6h7i8j9k0l1m2' } },
      respExample: { followed: false, bloggerId: 'b_b1c2d3e4f5g6h7i8j9k0l1m2' }
    },
    {
      method: 'GET', path: '/me/follows', name: 'listMyFollows',
      purpose: '我的关注列表（分页）',
      headers: { 'Authorization': 'Bearer <jwt>' },
      params: [
        { name: 'page', loc: 'query', type: 'number', required: false, constraint: 'min=1, default=1', desc: '页码' },
        { name: 'pageSize', loc: 'query', type: 'number', required: false, constraint: 'min=1, max=100, default=20', desc: '每页' }
      ],
      respStatus: 200,
      respFields: [
        { name: 'items', type: 'BloggerRef[]', desc: '关注列表' },
        { name: 'page', type: 'number', desc: '当前页' },
        { name: 'pageSize', type: 'number', desc: '每页数' },
        { name: 'total', type: 'number', desc: '总数' },
        { name: 'totalPages', type: 'number', desc: '总页数' }
      ],
      errorCodes: [
        { code: 'UNAUTHENTICATED', status: 401, scene: '缺 JWT' },
        { code: 'INVALID_PAGINATION', status: 400, scene: 'page<1 或 pageSize>100' }
      ],
      reqExample: { query: { page: 1, pageSize: 20 } },
      respExample: { items: [{ bloggerId: 'b_b1c2d3e4f5g6h7i8j9k0l1m2', displayName: 'Bob', followedAt: '2026-07-30T10:10:00.000Z' }], page: 1, pageSize: 20, total: 1, totalPages: 1 }
    }
  ],
  [
    { name: 'FollowService.follow(readerId, bloggerId)', sig: '(string, string) => {followed:boolean, createdAt:number}', throws: 'BLOGGER_NOT_FOUND, SELF_FOLLOW_NOT_ALLOWED' },
    { name: 'FollowService.unfollow(readerId, bloggerId)', sig: '(string, string) => {followed:false}', throws: 'BLOGGER_NOT_FOUND' },
    { name: 'FollowService.listFollows(readerId, page, pageSize)', sig: '(string, number, number) => PaginatedResult<BloggerRef>', throws: 'none' },
    { name: 'FollowService.isFollowing(readerId, bloggerId)', sig: '(string, string) => boolean', throws: 'none' }
  ],
  [
    '关注/取关是幂等操作（多次调用结果相同，HTTP 200）',
    'reader 不能关注自己（reader=blogger 场景在 REQ-017 多博主系统下被允许；本接口禁止 reader 关注自己的 readerId）',
    'follow.created 事件必须触发 SD-011 通知博主；blogger 必须在 blogger store 校验存在（防止 P7-002 缺陷）',
    'token.sub=readerId，校验 readerId 必须在 user store 存在'
  ]
);

console.log('§3.1-§3.3 (INTF-001~003) 写入完成，大小：', fs.statSync(outputPath).size, 'bytes');
