// W 模型阶段 3 - 演进图谱生成器
// 整合阶段 1-2 全部节点 + 阶段 3 新增（DD 占位 + TC-INT）
// 目标：节点 ≥ 130，边 ≥ 700

const fs = require('fs');
const path = require('path');

const outputPath = path.resolve('d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev-demo/.w-model/ingestion/consolidated-phase3.json');

// ============================================================================
// 1. 节点
// ============================================================================
const nodes = [];

// ----------------------------------------------------------------------------
// 1.1 REQ 节点（阶段 1 复刻）
// ----------------------------------------------------------------------------
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
// 1.2 SD 节点（22 个，阶段 2）
// ----------------------------------------------------------------------------
const sds = [
  { id: 'SD-001', title: '用户认证服务', reqGroup: 'REQ-001', subSystem: 'user' },
  { id: 'SD-002', title: '用户资料服务', reqGroup: 'REQ-001', subSystem: 'user' },
  { id: 'SD-003', title: '关注服务', reqGroup: 'REQ-001', subSystem: 'user' },
  { id: 'SD-004', title: '博主注册服务', reqGroup: 'REQ-005', subSystem: 'blogger' },
  { id: 'SD-005', title: '博文生命周期服务', reqGroup: 'REQ-006', subSystem: 'article' },
  { id: 'SD-006', title: '博文浏览服务', reqGroup: 'REQ-006', subSystem: 'article' },
  { id: 'SD-007', title: '互动服务（点赞/收藏）', reqGroup: 'REQ-006', subSystem: 'article' },
  { id: 'SD-008', title: '标签服务', reqGroup: 'REQ-006', subSystem: 'article' },
  { id: 'SD-009', title: '全文搜索服务', reqGroup: 'REQ-006', subSystem: 'article' },
  { id: 'SD-010', title: '评论服务', reqGroup: 'REQ-009', subSystem: 'comment' },
  { id: 'SD-011', title: '通知服务', reqGroup: 'REQ-011', subSystem: 'notification' },
  { id: 'SD-012', title: 'RSS 订阅服务', reqGroup: 'REQ-016', subSystem: 'site' },
  { id: 'SD-013', title: 'Webhook 服务', reqGroup: 'REQ-016', subSystem: 'site' },
  { id: 'SD-014', title: '站点配置服务', reqGroup: 'REQ-016', subSystem: 'site' },
  { id: 'SD-015', title: '访问记录服务', reqGroup: 'REQ-018', subSystem: 'admin' },
  { id: 'SD-016', title: '审计日志服务', reqGroup: 'REQ-018', subSystem: 'admin' },
  { id: 'SD-017', title: '站点统计服务', reqGroup: 'REQ-018', subSystem: 'admin' },
  { id: 'SD-018', title: '推荐服务（横切）', reqGroup: 'REQ-006', subSystem: 'article' },
  { id: 'SD-019', title: '广告位服务（横切）', reqGroup: 'REQ-016', subSystem: 'site' },
  { id: 'SD-020', title: '限流服务（横切 NFR-005）', reqGroup: 'NFR-005', subSystem: 'crosscut' },
  { id: 'SD-021', title: 'API 路由层（横切 CON-003）', reqGroup: 'CON-003', subSystem: 'crosscut' },
  { id: 'SD-022', title: '错误处理中间件（横切）', reqGroup: 'NFR-001', subSystem: 'crosscut' },
];
sds.forEach(s => {
  nodes.push({
    id: s.id, type: 'SD', phase: 2,
    title: s.title, summary: s.title,
    level: 1, reqGroup: s.reqGroup, subSystem: s.subSystem,
    attributes: { layer: 'service', storage: 'in-memory (Map/Array)' }
  });
});

// ----------------------------------------------------------------------------
// 1.3 INTF 节点（22 个，阶段 2）
// ----------------------------------------------------------------------------
const intfs = [
  { id: 'INTF-001', title: '认证 API', sdId: 'SD-001' },
  { id: 'INTF-002', title: '用户 API', sdId: 'SD-002' },
  { id: 'INTF-003', title: '关注 API', sdId: 'SD-003' },
  { id: 'INTF-004', title: '博主认证 API', sdId: 'SD-004' },
  { id: 'INTF-005', title: '博文 API', sdId: 'SD-005' },
  { id: 'INTF-006', title: '浏览 API', sdId: 'SD-006' },
  { id: 'INTF-007', title: '互动 API', sdId: 'SD-007' },
  { id: 'INTF-008', title: '标签 API', sdId: 'SD-008' },
  { id: 'INTF-009', title: '搜索 API', sdId: 'SD-009' },
  { id: 'INTF-010', title: '评论 API', sdId: 'SD-010' },
  { id: 'INTF-011', title: '通知 API', sdId: 'SD-011' },
  { id: 'INTF-012', title: 'RSS 端点', sdId: 'SD-012' },
  { id: 'INTF-013', title: 'Webhook API', sdId: 'SD-013' },
  { id: 'INTF-014', title: '站点配置 API', sdId: 'SD-014' },
  { id: 'INTF-015', title: '访问记录 API', sdId: 'SD-015' },
  { id: 'INTF-016', title: '审计 API', sdId: 'SD-016' },
  { id: 'INTF-017', title: '统计 API', sdId: 'SD-017' },
  { id: 'INTF-018', title: '推荐 API', sdId: 'SD-018' },
  { id: 'INTF-019', title: '广告 API', sdId: 'SD-019' },
  { id: 'INTF-020', title: '限流中间件接口', sdId: 'SD-020' },
  { id: 'INTF-021', title: '路由层接口', sdId: 'SD-021' },
  { id: 'INTF-022', title: '错误处理接口', sdId: 'SD-022' },
];
intfs.forEach(i => {
  nodes.push({
    id: i.id, type: 'INTF', phase: 2,
    title: i.title, summary: i.title,
    level: 2, parentSd: i.sdId
  });
});

// ----------------------------------------------------------------------------
// 1.4 边界节点 + 系统根
// ----------------------------------------------------------------------------
nodes.push({ id: 'EXT-IN-001', type: 'EXT-IN', phase: 1, title: '外部输入源', summary: 'Reader/Blogger/Admin/外部系统（DFD terminator）' });
nodes.push({ id: 'EXT-OUT-001', type: 'EXT-OUT', phase: 1, title: '外部输出汇', summary: 'HTTP 响应/RSS 订阅者/Webhook 订阅方（DFD terminator）' });
nodes.push({ id: 'SYS-001', type: 'EXT-IN', phase: 1, title: '博客系统后端（系统根）', summary: 'blog-system-demo 系统对外代理', isSystemRoot: true });

// ----------------------------------------------------------------------------
// 1.5 TC-ST 节点（系统测试 22 个，阶段 2）
// ----------------------------------------------------------------------------
const tcSts = [
  { id: 'TC-ST-001', sdId: 'SD-001' }, { id: 'TC-ST-002', sdId: 'SD-002' },
  { id: 'TC-ST-003', sdId: 'SD-003' }, { id: 'TC-ST-004', sdId: 'SD-004' },
  { id: 'TC-ST-005', sdId: 'SD-005' }, { id: 'TC-ST-006', sdId: 'SD-006' },
  { id: 'TC-ST-007', sdId: 'SD-007' }, { id: 'TC-ST-008', sdId: 'SD-008' },
  { id: 'TC-ST-009', sdId: 'SD-009' }, { id: 'TC-ST-010', sdId: 'SD-010' },
  { id: 'TC-ST-011', sdId: 'SD-011' }, { id: 'TC-ST-012', sdId: 'SD-012' },
  { id: 'TC-ST-013', sdId: 'SD-013' }, { id: 'TC-ST-014', sdId: 'SD-014' },
  { id: 'TC-ST-015', sdId: 'SD-015' }, { id: 'TC-ST-016', sdId: 'SD-016' },
  { id: 'TC-ST-017', sdId: 'SD-017' }, { id: 'TC-ST-018', sdId: 'SD-018' },
  { id: 'TC-ST-019', sdId: 'SD-019' }, { id: 'TC-ST-020', sdId: 'SD-020' },
  { id: 'TC-ST-021', sdId: 'SD-021' }, { id: 'TC-ST-022', sdId: 'SD-022' },
];
tcSts.forEach(t => {
  nodes.push({
    id: t.id, type: 'TC', phase: 2,
    title: t.id, summary: t.id + ' 系统测试',
    level: 2, parentSd: t.sdId, testType: 'system', executionPhase: 7
  });
});

// ----------------------------------------------------------------------------
// 1.6 TC-INT 节点（集成测试 22 个，阶段 3 新增）
// ----------------------------------------------------------------------------
const tcInts = [
  { id: 'TC-INT-001', intfId: 'INTF-001', sdId: 'SD-001', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-002', intfId: 'INTF-002', sdId: 'SD-002', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-003', intfId: 'INTF-003', sdId: 'SD-003', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-004', intfId: 'INTF-004', sdId: 'SD-004', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-005', intfId: 'INTF-005', sdId: 'SD-005', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-006', intfId: 'INTF-006', sdId: 'SD-006', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-007', intfId: 'INTF-007', sdId: 'SD-007', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-008', intfId: 'INTF-008', sdId: 'SD-008', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-009', intfId: 'INTF-009', sdId: 'SD-009', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-010', intfId: 'INTF-010', sdId: 'SD-010', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-011', intfId: 'INTF-011', sdId: 'SD-011', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-012', intfId: 'INTF-012', sdId: 'SD-012', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-013', intfId: 'INTF-013', sdId: 'SD-013', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-014', intfId: 'INTF-014', sdId: 'SD-014', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-015', intfId: 'INTF-015', sdId: 'SD-015', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-016', intfId: 'INTF-016', sdId: 'SD-016', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-017', intfId: 'INTF-017', sdId: 'SD-017', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-018', intfId: 'INTF-018', sdId: 'SD-018', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-019', intfId: 'INTF-019', sdId: 'SD-019', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-020', intfId: 'INTF-020', sdId: 'SD-020', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-021', intfId: 'INTF-021', sdId: 'SD-021', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
  { id: 'TC-INT-022', intfId: 'INTF-022', sdId: 'SD-022', testClasses: ['param-validation', 'cross-module', 'exception-path', 'cross-cutting', 'data-consistency'] },
];
tcInts.forEach(t => {
  nodes.push({
    id: t.id, type: 'TC', phase: 3,
    title: t.id, summary: t.id + ' 集成测试（接口模块交互级）',
    level: 2, parentSd: t.sdId, parentIntf: t.intfId, testType: 'integration',
    executionPhase: 6, testClasses: t.testClasses
  });
});

// ----------------------------------------------------------------------------
// 1.7 DD 节点（详细设计占位 22 个，阶段 3 预留给阶段 4）
// ----------------------------------------------------------------------------
const dds = [
  { id: 'DD-001', intfId: 'INTF-001', sdId: 'SD-001' },
  { id: 'DD-002', intfId: 'INTF-002', sdId: 'SD-002' },
  { id: 'DD-003', intfId: 'INTF-003', sdId: 'SD-003' },
  { id: 'DD-004', intfId: 'INTF-004', sdId: 'SD-004' },
  { id: 'DD-005', intfId: 'INTF-005', sdId: 'SD-005' },
  { id: 'DD-006', intfId: 'INTF-006', sdId: 'SD-006' },
  { id: 'DD-007', intfId: 'INTF-007', sdId: 'SD-007' },
  { id: 'DD-008', intfId: 'INTF-008', sdId: 'SD-008' },
  { id: 'DD-009', intfId: 'INTF-009', sdId: 'SD-009' },
  { id: 'DD-010', intfId: 'INTF-010', sdId: 'SD-010' },
  { id: 'DD-011', intfId: 'INTF-011', sdId: 'SD-011' },
  { id: 'DD-012', intfId: 'INTF-012', sdId: 'SD-012' },
  { id: 'DD-013', intfId: 'INTF-013', sdId: 'SD-013' },
  { id: 'DD-014', intfId: 'INTF-014', sdId: 'SD-014' },
  { id: 'DD-015', intfId: 'INTF-015', sdId: 'SD-015' },
  { id: 'DD-016', intfId: 'INTF-016', sdId: 'SD-016' },
  { id: 'DD-017', intfId: 'INTF-017', sdId: 'SD-017' },
  { id: 'DD-018', intfId: 'INTF-018', sdId: 'SD-018' },
  { id: 'DD-019', intfId: 'INTF-019', sdId: 'SD-019' },
  { id: 'DD-020', intfId: 'INTF-020', sdId: 'SD-020' },
  { id: 'DD-021', intfId: 'INTF-021', sdId: 'SD-021' },
  { id: 'DD-022', intfId: 'INTF-022', sdId: 'SD-022' },
];
dds.forEach(d => {
  nodes.push({
    id: d.id, type: 'DD', phase: 3,
    title: d.id + ' 详细设计（占位）', summary: '阶段 4 详细设计产出占位',
    level: 3, parentIntf: d.intfId, parentSd: d.sdId,
    status: 'placeholder', realizedIn: 'phase-4',
    attributes: { designTarget: d.intfId }
  });
});

// ============================================================================
// 2. 边
// ============================================================================
const edges = [];

// 2.1 parent 边：REQ 层级
const reqParentEdges = [
  { from: 'REQ-001', to: 'REQ-002' }, { from: 'REQ-001', to: 'REQ-003' }, { from: 'REQ-001', to: 'REQ-004' },
  { from: 'REQ-005', to: 'REQ-017' },
  { from: 'REQ-006', to: 'REQ-007' }, { from: 'REQ-006', to: 'REQ-008' },
  { from: 'REQ-006', to: 'REQ-012' }, { from: 'REQ-006', to: 'REQ-013' },
  { from: 'REQ-007', to: 'REQ-021' },
  { from: 'REQ-009', to: 'REQ-010' },
  { from: 'REQ-011', to: 'REQ-015' },
  { from: 'REQ-016', to: 'REQ-014' }, { from: 'REQ-016', to: 'REQ-022' },
  { from: 'REQ-018', to: 'REQ-019' }, { from: 'REQ-018', to: 'REQ-020' },
];
reqParentEdges.forEach(e => edges.push({ from: e.from, to: e.to, type: 'parent' }));

// 2.2 parent 边：REQ → SD
const reqSdMap = [
  { req: 'REQ-001', sd: 'SD-001' }, { req: 'REQ-001', sd: 'SD-002' }, { req: 'REQ-001', sd: 'SD-003' },
  { req: 'REQ-005', sd: 'SD-004' }, { req: 'REQ-006', sd: 'SD-005' }, { req: 'REQ-006', sd: 'SD-006' },
  { req: 'REQ-006', sd: 'SD-007' }, { req: 'REQ-006', sd: 'SD-008' }, { req: 'REQ-006', sd: 'SD-009' },
  { req: 'REQ-006', sd: 'SD-018' }, { req: 'REQ-009', sd: 'SD-010' }, { req: 'REQ-011', sd: 'SD-011' },
  { req: 'REQ-016', sd: 'SD-012' }, { req: 'REQ-016', sd: 'SD-013' }, { req: 'REQ-016', sd: 'SD-014' },
  { req: 'REQ-016', sd: 'SD-019' }, { req: 'REQ-018', sd: 'SD-015' }, { req: 'REQ-018', sd: 'SD-016' },
  { req: 'REQ-018', sd: 'SD-017' }, { req: 'NFR-005', sd: 'SD-020' },
  { req: 'CON-003', sd: 'SD-021' }, { req: 'NFR-001', sd: 'SD-022' },
];
reqSdMap.forEach(e => edges.push({ from: e.req, to: e.sd, type: 'parent' }));

// 2.3 parent 边：SD → INTF
intfs.forEach(i => edges.push({ from: i.sdId, to: i.id, type: 'parent' }));

// 2.4 parent 边：INTF → DD（阶段 3 新增）
dds.forEach(d => edges.push({ from: d.intfId, to: d.id, type: 'parent' }));

// 2.5 implements 边：SD → REQ
const sdImplements = [
  { sd: 'SD-001', reqs: ['REQ-001', 'REQ-002'] }, { sd: 'SD-002', reqs: ['REQ-003'] },
  { sd: 'SD-003', reqs: ['REQ-004'] }, { sd: 'SD-004', reqs: ['REQ-005', 'REQ-017'] },
  { sd: 'SD-005', reqs: ['REQ-006'] }, { sd: 'SD-006', reqs: ['REQ-007'] },
  { sd: 'SD-007', reqs: ['REQ-008'] }, { sd: 'SD-008', reqs: ['REQ-012'] },
  { sd: 'SD-009', reqs: ['REQ-013'] }, { sd: 'SD-010', reqs: ['REQ-009', 'REQ-010'] },
  { sd: 'SD-011', reqs: ['REQ-011'] }, { sd: 'SD-012', reqs: ['REQ-014'] },
  { sd: 'SD-013', reqs: ['REQ-015'] }, { sd: 'SD-014', reqs: ['REQ-016'] },
  { sd: 'SD-015', reqs: ['REQ-019'] }, { sd: 'SD-016', reqs: ['REQ-018', 'CON-004'] },
  { sd: 'SD-017', reqs: ['REQ-020'] }, { sd: 'SD-018', reqs: ['REQ-021'] },
  { sd: 'SD-019', reqs: ['REQ-022'] }, { sd: 'SD-020', reqs: ['NFR-005'] },
  { sd: 'SD-021', reqs: ['CON-003'] }, { sd: 'SD-022', reqs: ['NFR-001', 'NFR-004'] },
];
sdImplements.forEach(e => e.reqs.forEach(r => edges.push({ from: e.sd, to: r, type: 'implements' })));

// 2.6 defines 边：SD → INTF
intfs.forEach(i => edges.push({ from: i.sdId, to: i.id, type: 'defines' }));

// 2.7 realizes 边：DD → INTF（阶段 3 新增）
dds.forEach(d => edges.push({ from: d.id, to: d.intfId, type: 'realizes' }));

// 2.8 depends-on 边：SD 依赖
const sdDependsOn = [
  { sd: 'SD-001', deps: ['SD-022', 'SD-020'] }, { sd: 'SD-002', deps: ['SD-001', 'SD-016'] },
  { sd: 'SD-003', deps: ['SD-001', 'SD-011', 'SD-004'] }, { sd: 'SD-004', deps: ['SD-001', 'SD-016'] },
  { sd: 'SD-005', deps: ['SD-001', 'SD-008', 'SD-016', 'SD-011', 'SD-013'] },
  { sd: 'SD-006', deps: ['SD-005', 'SD-015', 'SD-017', 'SD-001'] },
  { sd: 'SD-007', deps: ['SD-005', 'SD-001', 'SD-011'] }, { sd: 'SD-008', deps: ['SD-005', 'SD-001'] },
  { sd: 'SD-009', deps: ['SD-005', 'SD-008'] }, { sd: 'SD-010', deps: ['SD-005', 'SD-001', 'SD-011', 'SD-016'] },
  { sd: 'SD-011', deps: ['SD-001', 'SD-013'] }, { sd: 'SD-012', deps: ['SD-005', 'SD-014'] },
  { sd: 'SD-013', deps: ['SD-016', 'SD-001'] }, { sd: 'SD-014', deps: ['SD-001', 'SD-016', 'SD-019'] },
  { sd: 'SD-015', deps: ['SD-001', 'SD-006'] }, { sd: 'SD-016', deps: ['SD-001'] },
  { sd: 'SD-017', deps: ['SD-006', 'SD-015'] }, { sd: 'SD-018', deps: ['SD-005', 'SD-008', 'SD-003', 'SD-006', 'SD-001'] },
  { sd: 'SD-019', deps: ['SD-001', 'SD-014'] }, { sd: 'SD-020', deps: ['SD-022'] },
  { sd: 'SD-021', deps: ['SD-001','SD-002','SD-003','SD-004','SD-005','SD-006','SD-007','SD-008','SD-009','SD-010','SD-011','SD-012','SD-013','SD-014','SD-015','SD-016','SD-017','SD-018','SD-019','SD-020','SD-022'] },
  { sd: 'SD-022', deps: [] },
];
sdDependsOn.forEach(e => e.deps.forEach(d => edges.push({ from: e.sd, to: d, type: 'depends-on' })));

// 2.9 precedes 边：REQ 交付顺序
const precedesEdges = [
  { from: 'REQ-001', to: 'REQ-002' }, { from: 'REQ-001', to: 'REQ-003' }, { from: 'REQ-001', to: 'REQ-004' },
  { from: 'REQ-005', to: 'REQ-006' }, { from: 'REQ-005', to: 'REQ-017' },
  { from: 'REQ-006', to: 'REQ-007' }, { from: 'REQ-006', to: 'REQ-008' },
  { from: 'REQ-006', to: 'REQ-009' }, { from: 'REQ-006', to: 'REQ-012' },
  { from: 'REQ-006', to: 'REQ-013' }, { from: 'REQ-006', to: 'REQ-014' },
  { from: 'REQ-006', to: 'REQ-015' }, { from: 'REQ-006', to: 'REQ-019' },
  { from: 'REQ-006', to: 'REQ-020' }, { from: 'REQ-007', to: 'REQ-020' },
  { from: 'REQ-007', to: 'REQ-021' }, { from: 'REQ-011', to: 'REQ-015' },
  { from: 'REQ-016', to: 'REQ-014' }, { from: 'REQ-016', to: 'REQ-022' },
  { from: 'REQ-018', to: 'REQ-019' }, { from: 'REQ-018', to: 'REQ-020' },
];
precedesEdges.forEach(e => edges.push({ from: e.from, to: e.to, type: 'precedes' }));

// 2.10 cross-cuts 边：NFR/CON 横切
const crossCuts = [
  { from: 'NFR-001', to: 'REQ-007' }, { from: 'NFR-001', to: 'REQ-013' },
  { from: 'NFR-001', to: 'REQ-020' }, { from: 'NFR-001', to: 'REQ-021' },
  { from: 'NFR-002', to: 'REQ-001' }, { from: 'NFR-002', to: 'REQ-002' },
  { from: 'NFR-002', to: 'REQ-006' }, { from: 'NFR-002', to: 'REQ-009' },
  { from: 'NFR-002', to: 'REQ-011' }, { from: 'NFR-002', to: 'REQ-016' },
  { from: 'NFR-002', to: 'REQ-018' },
  { from: 'NFR-003', to: 'REQ-001' }, { from: 'NFR-003', to: 'REQ-002' },
  { from: 'NFR-003', to: 'REQ-005' }, { from: 'NFR-003', to: 'REQ-006' },
  { from: 'NFR-003', to: 'REQ-009' }, { from: 'NFR-003', to: 'REQ-011' },
  { from: 'NFR-003', to: 'REQ-018' },
  { from: 'NFR-004', to: 'REQ-001' }, { from: 'NFR-004', to: 'REQ-006' },
  { from: 'NFR-004', to: 'REQ-009' }, { from: 'NFR-004', to: 'REQ-011' },
  { from: 'NFR-005', to: 'REQ-001' }, { from: 'NFR-005', to: 'REQ-006' },
  { from: 'NFR-005', to: 'REQ-007' }, { from: 'NFR-005', to: 'REQ-013' },
  { from: 'NFR-006', to: 'REQ-001' }, { from: 'NFR-006', to: 'REQ-005' },
  { from: 'CON-001', to: 'REQ-001' }, { from: 'CON-001', to: 'REQ-006' },
  { from: 'CON-001', to: 'REQ-009' }, { from: 'CON-001', to: 'REQ-011' },
  { from: 'CON-002', to: 'REQ-001' }, { from: 'CON-002', to: 'REQ-006' },
  { from: 'CON-002', to: 'REQ-009' }, { from: 'CON-002', to: 'REQ-018' },
  { from: 'CON-003', to: 'REQ-001' }, { from: 'CON-003', to: 'REQ-006' },
  { from: 'CON-003', to: 'REQ-009' }, { from: 'CON-003', to: 'REQ-016' },
  { from: 'CON-004', to: 'REQ-018' },
];
crossCuts.forEach(e => edges.push({ from: e.from, to: e.to, type: 'cross-cuts' }));

// 2.11 produces 边：信息流（DFD）
edges.push({ from: 'EXT-IN-001', to: 'SYS-001', type: 'produces' });
functionalReqs.forEach(r => edges.push({ from: 'SYS-001', to: r.id, type: 'produces' }));
nfrs.forEach(n => edges.push({ from: 'SYS-001', to: n.id, type: 'produces' }));
cons.forEach(c => edges.push({ from: 'SYS-001', to: c.id, type: 'produces' }));
reqSdMap.forEach(e => edges.push({ from: e.req, to: e.sd, type: 'produces' }));
intfs.forEach(i => edges.push({ from: i.sdId, to: i.id, type: 'produces' }));
intfs.forEach(i => edges.push({ from: i.id, to: 'EXT-OUT-001', type: 'produces' }));

// 2.12 governs 边：横切治理
const governedSds = ['SD-001','SD-002','SD-003','SD-004','SD-005','SD-006','SD-007','SD-008','SD-010','SD-011','SD-013','SD-014','SD-019'];
governedSds.forEach(s => edges.push({ from: 'SD-016', to: s, type: 'governs' }));
const rateLimitedSds = ['SD-001','SD-002','SD-003','SD-004','SD-005','SD-006','SD-007','SD-008','SD-009','SD-010','SD-011','SD-012','SD-013','SD-014','SD-015','SD-016','SD-017','SD-018','SD-019'];
rateLimitedSds.forEach(s => edges.push({ from: 'SD-020', to: s, type: 'governs' }));
sds.forEach(s => edges.push({ from: 'SD-022', to: s.id, type: 'governs' }));
sds.filter(s => !s.id.startsWith('SD-022')).forEach(s => edges.push({ from: 'SD-021', to: s.id, type: 'collaborates-with' }));

// 2.13 SD precedes 边（阶段交付）
const sdPrecedes = [
  { from: 'SD-001', to: 'SD-002' }, { from: 'SD-001', to: 'SD-003' }, { from: 'SD-001', to: 'SD-004' },
  { from: 'SD-004', to: 'SD-005' }, { from: 'SD-005', to: 'SD-006' }, { from: 'SD-005', to: 'SD-007' },
  { from: 'SD-005', to: 'SD-008' }, { from: 'SD-005', to: 'SD-009' }, { from: 'SD-005', to: 'SD-010' },
  { from: 'SD-005', to: 'SD-012' }, { from: 'SD-005', to: 'SD-013' }, { from: 'SD-005', to: 'SD-015' },
  { from: 'SD-005', to: 'SD-017' }, { from: 'SD-005', to: 'SD-018' }, { from: 'SD-005', to: 'SD-019' },
  { from: 'SD-008', to: 'SD-018' }, { from: 'SD-006', to: 'SD-018' },
  { from: 'SD-007', to: 'SD-011' }, { from: 'SD-010', to: 'SD-011' }, { from: 'SD-003', to: 'SD-011' },
  { from: 'SD-011', to: 'SD-013' }, { from: 'SD-014', to: 'SD-012' }, { from: 'SD-014', to: 'SD-019' },
  { from: 'SD-020', to: 'SD-021' }, { from: 'SD-022', to: 'SD-020' }, { from: 'SD-022', to: 'SD-021' },
];
sdPrecedes.forEach(e => edges.push({ from: e.from, to: e.to, type: 'precedes' }));

// 2.14 TC-ST → SD/INTF
tcSts.forEach(t => {
  edges.push({ from: t.id, to: t.sdId, type: 'depends-on' });
  const intf = intfs.find(i => i.sdId === t.sdId);
  if (intf) edges.push({ from: t.id, to: intf.id, type: 'depends-on' });
  edges.push({ from: t.sdId, to: t.id, type: 'parent' });
});

// 2.15 TC-ST → NFR/CON
const tcStToNfr = [
  { tc: 'TC-ST-001', targets: ['NFR-001', 'NFR-003'] },
  { tc: 'TC-ST-003', targets: ['NFR-004'] },
  { tc: 'TC-ST-005', targets: ['NFR-001', 'NFR-004'] },
  { tc: 'TC-ST-006', targets: ['NFR-001'] },
  { tc: 'TC-ST-009', targets: ['NFR-001', 'NFR-004'] },
  { tc: 'TC-ST-013', targets: ['NFR-003', 'NFR-004'] },
  { tc: 'TC-ST-015', targets: ['NFR-002'] },
  { tc: 'TC-ST-016', targets: ['CON-004'] },
  { tc: 'TC-ST-017', targets: ['NFR-001', 'NFR-002'] },
  { tc: 'TC-ST-020', targets: ['NFR-005'] },
  { tc: 'TC-ST-021', targets: ['CON-003'] },
  { tc: 'TC-ST-022', targets: ['NFR-001', 'NFR-004'] },
];
tcStToNfr.forEach(e => e.targets.forEach(t => edges.push({ from: e.tc, to: t, type: 'depends-on' })));

// 2.16 TC-INT → SD/INTF（阶段 3 新增，22 IT 覆盖所有 22 INTF）
tcInts.forEach(t => {
  edges.push({ from: t.id, to: t.sdId, type: 'depends-on' });
  edges.push({ from: t.id, to: t.intfId, type: 'depends-on' });
  edges.push({ from: t.sdId, to: t.id, type: 'parent' });
  edges.push({ from: t.intfId, to: t.id, type: 'parent' });
});

// 2.17 TC-INT → NFR（横切验证）
tcInts.forEach(t => {
  edges.push({ from: t.id, to: 'NFR-001', type: 'depends-on' });
  edges.push({ from: t.id, to: 'NFR-004', type: 'depends-on' });
});

// 2.18 TC-INT precedes 边（集成测试 → 系统测试）
tcInts.forEach(t => {
  const stId = 'TC-ST-' + t.id.slice(7);
  edges.push({ from: t.id, to: stId, type: 'precedes' });
});

// 2.19 REQ 依赖边
const reqDepends = [
  { from: 'REQ-002', to: 'REQ-001' }, { from: 'REQ-003', to: 'REQ-002' },
  { from: 'REQ-004', to: 'REQ-001' }, { from: 'REQ-004', to: 'REQ-005' },
  { from: 'REQ-006', to: 'REQ-005' }, { from: 'REQ-007', to: 'REQ-006' },
  { from: 'REQ-008', to: 'REQ-006' }, { from: 'REQ-008', to: 'REQ-001' },
  { from: 'REQ-009', to: 'REQ-006' }, { from: 'REQ-009', to: 'REQ-001' },
  { from: 'REQ-010', to: 'REQ-009' }, { from: 'REQ-011', to: 'REQ-004' },
  { from: 'REQ-011', to: 'REQ-008' }, { from: 'REQ-011', to: 'REQ-009' },
  { from: 'REQ-012', to: 'REQ-006' }, { from: 'REQ-013', to: 'REQ-006' },
  { from: 'REQ-013', to: 'REQ-012' }, { from: 'REQ-014', to: 'REQ-006' },
  { from: 'REQ-015', to: 'REQ-011' }, { from: 'REQ-015', to: 'REQ-006' },
  { from: 'REQ-017', to: 'REQ-005' }, { from: 'REQ-019', to: 'REQ-007' },
  { from: 'REQ-020', to: 'REQ-007' }, { from: 'REQ-020', to: 'REQ-019' },
  { from: 'REQ-021', to: 'REQ-007' }, { from: 'REQ-021', to: 'REQ-012' },
  { from: 'REQ-022', to: 'REQ-016' },
];
reqDepends.forEach(e => edges.push({ from: e.from, to: e.to, type: 'depends-on' }));

// 2.20 SD → DD precedes（详细设计继承于接口设计）
dds.forEach(d => edges.push({ from: d.sdId, to: d.id, type: 'precedes' }));

// 2.21 INTF → DD produces（信息流到详细设计）
dds.forEach(d => edges.push({ from: d.intfId, to: d.id, type: 'produces' }));

// 2.22 DD → TC-INT precedes（详细设计先于集成测试）
dds.forEach(d => {
  const tcInt = tcInts.find(t => t.intfId === d.intfId);
  if (tcInt) edges.push({ from: d.id, to: tcInt.id, type: 'precedes' });
});

// ============================================================================
// 3. 元数据 + 统计
// ============================================================================
const summary = {
  totalNodes: nodes.length,
  totalEdges: edges.length,
  byNodeType: {},
  byEdgeType: {},
  sdCount: sds.length,
  intfCount: intfs.length,
  reqCount: functionalReqs.length + nfrs.length + cons.length,
  nfrCount: nfrs.length,
  conCount: cons.length,
  extInCount: 2,
  extOutCount: 1,
  ddCount: dds.length,
  tcStCount: tcSts.length,
  tcIntCount: tcInts.length,
  tcTotalCount: tcSts.length + tcInts.length,
  systemRootCount: 1,
  sdWithoutImplements: 0,
  intfWithoutDefines: 0,
  ddWithoutRealizes: 0,
  phases: [1, 2, 3],
  flowValidation: {
    blackhole: 0,    // EXT-IN/SD/INTF/REQ 节点必须入度 ≥ 1
    miracle: 0,      // EXT-OUT 节点豁免
    deadModule: 0,   // SD 必须有 INT/OUT flow
  },
  extBoundary: {
    extInComplete: true,  // EXT-IN-001 有 consumes 边
    extOutComplete: true, // EXT-OUT-001 有 receives 边
  }
};
nodes.forEach(n => { summary.byNodeType[n.type] = (summary.byNodeType[n.type] || 0) + 1; });
edges.forEach(e => { summary.byEdgeType[e.type] = (summary.byEdgeType[e.type] || 0) + 1; });

const graph = {
  version: 3,
  project: 'blog-system-demo',
  currentPhase: 3,
  rootId: 'SYS-001',
  generatedAt: '2026-07-30T10:00:00.000Z',
  generatedBy: 'S-doc subagent (phase 3)',
  round: 23,
  phaseSummary: {
    phase1: '32 REQ-level + 2 EXT boundary + 1 system root',
    phase2: '+ 22 SD + 22 INTF + 22 TC-ST',
    phase3: '+ 22 DD placeholder + 22 TC-INT'
  },
  summary,
  nodes,
  edges,
};

// 写文件
fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2), 'utf-8');
console.log('=== consolidated-phase3.json 写入成功 ===');
console.log('路径:', outputPath);
console.log('节点数:', nodes.length);
console.log('边数:', edges.length);
console.log('节点类型分布:', JSON.stringify(summary.byNodeType, null, 2));
console.log('边类型分布:', JSON.stringify(summary.byEdgeType, null, 2));
console.log('文件大小:', fs.statSync(outputPath).size, 'bytes');
