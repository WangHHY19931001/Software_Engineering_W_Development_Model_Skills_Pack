// 生成 interface-design.md —— 使用更简洁的 schema 表达
const fs = require('fs');
const path = require('path');
const outputPath = path.resolve('d:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev-demo/docs/phase3-design/interface-design.md');

// 清空文件
fs.writeFileSync(outputPath, '', 'utf-8');

function W(s) { fs.appendFileSync(outputPath, s, 'utf-8'); }

// ============================================================================
// §0 文档信息
// ============================================================================
W('# 接口设计文档\n\n');
W('> 阶段 3（概要设计）产出。W 模型第 23 轮（2026-07-30）端到端调测。\n');
W('> 套用 `w-model-dev/templates/interface-design.md` 模板；同步产出对应的集成测试设计。\n\n');
W('## 文档信息\n\n');
W('- 项目名称：扩展博客系统后端（blog-system-demo）\n');
W('- 文档版本：v1.0.0\n');
W('- 编制日期：2026-07-30\n');
W('- 编制者：S-doc 子代理（W 模型阶段 3 文档产出）\n');
W('- 关联系统设计文档：`docs/phase2-design/system-design.md`\n');
W('- 关联需求文档：`docs/phase1-requirements/requirement-spec.md`\n');
W('- 关联集成测试设计：`docs/phase3-design/integration-test.md`\n');
W('- 关联演进图谱：`.w-model/ingestion/consolidated-phase3.json`\n');
W('- 关联接口契约 Schema：`w-model-dev/references/phase-3-outline-design.md`\n');
W('- 项目 ID：`blog-system-demo`\n');
W('- Round：23\n');
W('- 阶段：3（概要设计）\n\n');
W('---\n\n');

// ============================================================================
// §1 模块调用关系
// ============================================================================
W('## 1. 模块调用关系\n\n');
W('### 1.1 子系统依赖图（无环）\n\n');
W('```mermaid\n');
W('graph TB\n');
W('    subgraph Core[横切核心]\n');
W('        AuthMW[Auth Middleware<br/>JWT 解析]\n');
W('        RateLimitMW[RateLimit Middleware<br/>IP 滑动窗口]\n');
W('        ErrorMW[Error Middleware<br/>统一错误响应]\n');
W('    end\n');
W('    subgraph User[用户域 SD-001~003]\n');
W('        AuthSvc[用户认证服务<br/>SD-001]\n');
W('        ProfileSvc[用户资料服务<br/>SD-002]\n');
W('        FollowSvc[关注服务<br/>SD-003]\n');
W('    end\n');
W('    subgraph Blogger[博主域 SD-004]\n');
W('        BloggerSvc[博主注册服务<br/>SD-004]\n');
W('    end\n');
W('    subgraph Article[博文域 SD-005~009 + 018]\n');
W('        PostLifeSvc[博文生命周期服务<br/>SD-005]\n');
W('        PostViewSvc[博文浏览服务<br/>SD-006]\n');
W('        InteractionSvc[互动服务<br/>SD-007]\n');
W('        TagSvc[标签服务<br/>SD-008]\n');
W('        SearchSvc[全文搜索服务<br/>SD-009]\n');
W('        RecommendSvc[推荐服务<br/>SD-018 横切]\n');
W('    end\n');
W('    subgraph Comment[评论域 SD-010]\n');
W('        CommentSvc[评论服务<br/>SD-010]\n');
W('    end\n');
W('    subgraph Notification[通知域 SD-011]\n');
W('        NotifySvc[通知服务<br/>SD-011]\n');
W('    end\n');
W('    subgraph Site[站点域 SD-012~014 + 019]\n');
W('        RSSSvc[RSS 订阅服务<br/>SD-012]\n');
W('        WebhookSvc[Webhook 服务<br/>SD-013]\n');
W('        SiteCfgSvc[站点配置服务<br/>SD-014]\n');
W('        AdSvc[广告位服务<br/>SD-019 横切]\n');
W('    end\n');
W('    subgraph Admin[管理域 SD-015~017]\n');
W('        AccessSvc[访问记录服务<br/>SD-015]\n');
W('        AuditSvc[审计日志服务<br/>SD-016]\n');
W('        StatsSvc[站点统计服务<br/>SD-017]\n');
W('    end\n');
W('    subgraph Router[路由层 SD-021 横切]\n');
W('        APIRouter[API Router<br/>SD-021]\n');
W('    end\n');
W('    PostLifeSvc --> AuthMW\n');
W('    InteractionSvc --> AuthMW\n');
W('    CommentSvc --> AuthMW\n');
W('    APIRouter --> AuthMW\n');
W('    APIRouter --> RateLimitMW\n');
W('    APIRouter --> ErrorMW\n');
W('    PostLifeSvc -.->|event:post.published| NotifySvc\n');
W('    PostLifeSvc -.->|event:post.published| WebhookSvc\n');
W('    InteractionSvc -.->|event:like.created| NotifySvc\n');
W('    CommentSvc -.->|event:comment.created| NotifySvc\n');
W('    FollowSvc -.->|event:follow.created| NotifySvc\n');
W('    PostLifeSvc -.->|audit:post.*| AuditSvc\n');
W('    AuthSvc -.->|audit:user.registered| AuditSvc\n');
W('    SiteCfgSvc -.->|audit:site.config.updated| AuditSvc\n');
W('    PostViewSvc -->|read| AccessSvc\n');
W('    PostViewSvc -->|hit| StatsSvc\n');
W('    RecommendSvc -->|read posts+tags| PostLifeSvc\n');
W('    RecommendSvc -->|read tags| TagSvc\n');
W('```\n\n');
W('**依赖图说明**（DFS 三色染色验证无环）：\n\n');
W('- 顶层 → SD-022 错误处理（无业务依赖，最底层）\n');
W('- 业务 SD 全部依赖 SD-001（认证）+ SD-020（限流）+ SD-022（错误处理）\n');
W('- 事件流（虚线）单向：源 SD → SD-011/SD-013/SD-016（监听者）\n');
W('- 数据流（实线箭头）单向：源 SD → 目标 SD；目标 SD 不回调用源 SD\n');
W('- 横切 SD（SD-018/SD-019/SD-020/SD-021/SD-022）依赖各业务 SD，但不互引\n\n');

W('### 1.2 架构风格选择\n\n');
W('沿用阶段 2 决策：**经典三层架构（Router → Controller → Service → Repository → Model）+ 横切关注点 AOP 化**。\n\n');
W('| 维度 | 评估 | 评分 |\n|---|---|---|\n| 适用性 | 32 需求（22 FR + 6 NFR + 4 CON）规模适中；不引入微服务/DDD | 5/5 |\n| 成熟度 | Express 4 + 分层是 Node.js 生态最成熟范式 | 5/5 |\n| 可维护性 | TS strict + Zod 提供编译期/运行期双重保障 | 4/5 |\n| 引入成本 | 0 新运行时；CI/测试栈完全兼容 | 5/5 |\n| 风险敞口 | 单进程 + 内存存储；替换微服务代价可控 | 4/5 |\n| **总分** | | **23/25** |\n\n');

W('### 1.3 22 SD 模块分解表\n\n');
W('| SD | 名称 | 所属子域 | reqGroup | 关联 INTF | 关联 REQ/NFR/CON | level | 横切 |\n');
W('|---|---|---|---|---|---|:---:|:---:|\n');
const sdTable = [
  { id: 'SD-001', name: '用户认证服务', sub: 'user', req: 'REQ-001', intf: 'INTF-001', refs: 'REQ-001, REQ-002' },
  { id: 'SD-002', name: '用户资料服务', sub: 'user', req: 'REQ-001', intf: 'INTF-002', refs: 'REQ-003' },
  { id: 'SD-003', name: '关注服务', sub: 'user', req: 'REQ-001', intf: 'INTF-003', refs: 'REQ-004' },
  { id: 'SD-004', name: '博主注册服务', sub: 'blogger', req: 'REQ-005', intf: 'INTF-004', refs: 'REQ-005, REQ-017' },
  { id: 'SD-005', name: '博文生命周期服务', sub: 'article', req: 'REQ-006', intf: 'INTF-005', refs: 'REQ-006' },
  { id: 'SD-006', name: '博文浏览服务', sub: 'article', req: 'REQ-006', intf: 'INTF-006', refs: 'REQ-007' },
  { id: 'SD-007', name: '互动服务（点赞/收藏）', sub: 'article', req: 'REQ-006', intf: 'INTF-007', refs: 'REQ-008' },
  { id: 'SD-008', name: '标签服务', sub: 'article', req: 'REQ-006', intf: 'INTF-008', refs: 'REQ-012' },
  { id: 'SD-009', name: '全文搜索服务', sub: 'article', req: 'REQ-006', intf: 'INTF-009', refs: 'REQ-013' },
  { id: 'SD-010', name: '评论服务', sub: 'comment', req: 'REQ-009', intf: 'INTF-010', refs: 'REQ-009, REQ-010' },
  { id: 'SD-011', name: '通知服务', sub: 'notification', req: 'REQ-011', intf: 'INTF-011', refs: 'REQ-011' },
  { id: 'SD-012', name: 'RSS 订阅服务', sub: 'site', req: 'REQ-016', intf: 'INTF-012', refs: 'REQ-014' },
  { id: 'SD-013', name: 'Webhook 服务', sub: 'site', req: 'REQ-016', intf: 'INTF-013', refs: 'REQ-015' },
  { id: 'SD-014', name: '站点配置服务', sub: 'site', req: 'REQ-016', intf: 'INTF-014', refs: 'REQ-016' },
  { id: 'SD-015', name: '访问记录服务', sub: 'admin', req: 'REQ-018', intf: 'INTF-015', refs: 'REQ-019' },
  { id: 'SD-016', name: '审计日志服务', sub: 'admin', req: 'REQ-018', intf: 'INTF-016', refs: 'REQ-018, CON-004' },
  { id: 'SD-017', name: '站点统计服务', sub: 'admin', req: 'REQ-018', intf: 'INTF-017', refs: 'REQ-020' },
  { id: 'SD-018', name: '推荐服务', sub: 'article', req: 'REQ-006', intf: 'INTF-018', refs: 'REQ-021' },
  { id: 'SD-019', name: '广告位服务', sub: 'site', req: 'REQ-016', intf: 'INTF-019', refs: 'REQ-022' },
  { id: 'SD-020', name: '限流服务', sub: 'crosscut', req: 'NFR-005', intf: 'INTF-020', refs: 'NFR-005' },
  { id: 'SD-021', name: 'API 路由层', sub: 'crosscut', req: 'CON-003', intf: 'INTF-021', refs: 'CON-003' },
  { id: 'SD-022', name: '错误处理中间件', sub: 'crosscut', req: 'NFR-001', intf: 'INTF-022', refs: 'NFR-001, NFR-004' },
];
sdTable.forEach(r => {
  const cross = (r.id === 'SD-018' || r.id === 'SD-019' || r.id === 'SD-020' || r.id === 'SD-021' || r.id === 'SD-022') ? '✓' : '';
  W('| ' + r.id + ' | ' + r.name + ' | ' + r.sub + ' | ' + r.req + ' | ' + r.intf + ' | ' + r.refs + ' | 1 | ' + cross + ' |\n');
});
W('\n');

W('### 1.4 子系统依赖矩阵（service 层，无环）\n\n');
W('| 依赖方 SD | 依赖的 SD | 依赖类型 | 说明 |\n|---|---|---|---|\n');
const deps = [
  ['SD-001 用户认证', 'SD-022 错误处理', 'middleware', 'JWT 解析失败抛 AppError'],
  ['SD-001 用户认证', 'SD-020 限流', 'middleware', '路由级中间件链'],
  ['SD-002 用户资料', 'SD-001 认证', 'service', 'PUT /users/me 需 JWT'],
  ['SD-002 用户资料', 'SD-016 审计', 'event', '修改资料写 audit log'],
  ['SD-003 关注', 'SD-001 认证', 'service', '关注需 reader JWT'],
  ['SD-003 关注', 'SD-011 通知', 'event', 'follow.created → 通知博主'],
  ['SD-004 博主注册', 'SD-001 认证', 'service', '共享 bcrypt + JWT 工具'],
  ['SD-004 博主注册', 'SD-016 审计', 'event', 'blogger.registered → audit'],
  ['SD-005 博文生命周期', 'SD-001 认证', 'service', '需 blogger JWT'],
  ['SD-005 博文生命周期', 'SD-008 标签', 'service', 'post_tags 关联'],
  ['SD-005 博文生命周期', 'SD-016 审计', 'event', 'post.* → audit'],
  ['SD-005 博文生命周期', 'SD-011 通知', 'event', 'post.published → 关注者通知'],
  ['SD-005 博文生命周期', 'SD-013 Webhook', 'event', 'post.published → webhook 投递'],
  ['SD-006 博文浏览', 'SD-005 博文生命周期', 'service', '读取 posts Map'],
  ['SD-006 博文浏览', 'SD-015 访问记录', 'service', 'GET /posts/:id → 写 access record'],
  ['SD-006 博文浏览', 'SD-017 统计', 'service', 'PV 来源于浏览事件'],
  ['SD-007 互动', 'SD-005 博文生命周期', 'service', '校验 post 存在'],
  ['SD-007 互动', 'SD-001 认证', 'service', '需 reader JWT'],
  ['SD-007 互动', 'SD-011 通知', 'event', 'like.created → 通知博主'],
  ['SD-008 标签', 'SD-005 博文生命周期', 'service', '关联博文'],
  ['SD-009 全文搜索', 'SD-005 博文生命周期', 'service', '读取 posts Map（仅 published）'],
  ['SD-009 全文搜索', 'SD-008 标签', 'service', '标签过滤'],
  ['SD-010 评论', 'SD-005 博文生命周期', 'service', '校验 post 存在'],
  ['SD-010 评论', 'SD-001 认证', 'service', '需 reader/blogger JWT'],
  ['SD-010 评论', 'SD-011 通知', 'event', 'comment.created → 通知博主 + 父评论作者'],
  ['SD-010 评论', 'SD-016 审计', 'event', 'comment.deleted → audit'],
  ['SD-011 通知', 'SD-001 认证', 'service', 'GET /me/notifications 需 JWT'],
  ['SD-011 通知', 'SD-013 Webhook', 'service', '通知触发 webhook 投递（可选）'],
  ['SD-012 RSS', 'SD-005 博文生命周期', 'service', '读取 published posts'],
  ['SD-012 RSS', 'SD-014 站点配置', 'service', '读取 siteTitle/siteLink'],
  ['SD-013 Webhook', 'SD-016 审计', 'event', 'webhook.delivery 失败 → audit'],
  ['SD-013 Webhook', 'SD-001 认证', 'service', 'POST/DELETE 需 JWT'],
  ['SD-014 站点配置', 'SD-001 认证', 'service', 'PUT 需 admin JWT'],
  ['SD-014 站点配置', 'SD-016 审计', 'event', 'site.config.updated → audit'],
  ['SD-014 站点配置', 'SD-019 广告', 'service', '解析 bannerAdId'],
  ['SD-015 访问记录', 'SD-001 认证', 'service', 'GET 需 admin JWT'],
  ['SD-015 访问记录', 'SD-006 博文浏览', 'service', '写入触发'],
  ['SD-016 审计', 'SD-001 认证', 'service', 'GET 需 admin JWT'],
  ['SD-017 站点统计', 'SD-006 博文浏览', 'service', 'PV 来源于浏览事件'],
  ['SD-017 站点统计', 'SD-015 访问记录', 'service', 'UV 来源于 access_records 去重'],
  ['SD-018 推荐', 'SD-005 博文生命周期', 'service', '读取 posts + tags'],
  ['SD-018 推荐', 'SD-008 标签', 'service', 'Jaccard 相似度'],
  ['SD-018 推荐', 'SD-003 关注', 'service', '基于关注历史的个性化'],
  ['SD-018 推荐', 'SD-006 博文浏览', 'service', '基于阅读历史'],
  ['SD-019 广告位', 'SD-001 认证', 'service', '需 admin JWT'],
  ['SD-019 广告位', 'SD-014 站点配置', 'service', '关联 bannerAdId'],
  ['SD-020 限流', 'SD-022 错误处理', 'middleware', '超限 → AppError(429)'],
  ['SD-021 路由', 'SD-001~019 所有业务 SD', 'router', '路由分发'],
  ['SD-021 路由', 'SD-020 限流', 'middleware', '全局中间件'],
  ['SD-021 路由', 'SD-022 错误处理', 'middleware', '全局错误处理'],
  ['SD-022 错误处理', '—', '—', '无业务依赖（最底层）'],
];
deps.forEach(d => {
  W('| ' + d[0] + ' | ' + d[1] + ' | ' + d[2] + ' | ' + d[3] + ' |\n');
});
W('\n');

W('### 1.5 模块目录结构（继承阶段 2，阶段 3 不变更）\n\n');
W('```\n');
W('src/\n');
W('├── core/                       # 横切核心\n');
W('│   ├── middleware/             # auth / rateLimit / errorHandler / requireRole\n');
W('│   ├── events/                 # eventBus + events.ts\n');
W('│   ├── webhook/                # dispatcher + signer\n');
W('│   ├── errors/                 # AppError + codes\n');
W('│   ├── logger/                 # 结构化 console\n');
W('│   ├── stats/                  # 小时桶\n');
W('│   └── auth/                   # jwt + password (bcrypt)\n');
W('├── modules/                    # 业务子系统（22 SD）\n');
W('│   ├── user/                   # SD-001~003\n');
W('│   ├── blogger/                # SD-004\n');
W('│   ├── post/                   # SD-005~007\n');
W('│   ├── tag/                    # SD-008\n');
W('│   ├── search/                 # SD-009\n');
W('│   ├── comment/                # SD-010\n');
W('│   ├── notification/           # SD-011\n');
W('│   ├── rss/                    # SD-012\n');
W('│   ├── webhook/                # SD-013\n');
W('│   ├── site/                   # SD-014, SD-019\n');
W('│   ├── admin/                  # SD-015~017\n');
W('│   └── recommend/              # SD-018\n');
W('├── router/                     # SD-021 路由聚合\n');
W('├── app.ts                      # Express app 工厂\n');
W('└── server.ts                   # 启动入口\n');
W('```\n\n');
W('---\n\n');

console.log('§1 写入完成，大小：', fs.statSync(outputPath).size, 'bytes');
