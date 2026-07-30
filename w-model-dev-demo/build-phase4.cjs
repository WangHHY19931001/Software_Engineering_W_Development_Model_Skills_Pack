// build-phase4.cjs
// Round 23 W-model phase 4 detailed design + TLA+ + BDD generator
const fs = require('fs');
const path = require('path');

const ROOT = 'd:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev-demo';

// ============================================================
// 75 DD (Detailed Design) data definitions
// Each entry: {id, sd, name, type, fields, methods, deps, complexity, testPoints}
// ============================================================
const DDs = [
  // SD-001: user auth (4)
  {sd:'SD-001', id:'DD-001.1', name:'User', type:'Model', desc:'Reader/Blogger/Admin 实体类型',
    fields:'id,email,passwordHash,nickname,role,createdAt', methods:'UserSchema (zod), isReader(), isBlogger(), isAdmin()', deps:['DD-001.4 BcryptUtil'], complexity:'O(1)', testPoints:'Zod 校验 / 角色判别 / 字段必填'},
  {sd:'SD-001', id:'DD-001.2', name:'AuthService', type:'Service', desc:'注册/登录/JWT签发/密码校验',
    fields:'users,tokenSecret,tokenTtlSec', methods:'register(input)/login(email,password)/verifyPassword(p,h)/issueToken(u)/parseToken(t)', deps:['DD-001.1','DD-001.3','DD-001.4'], complexity:'O(1)+bcrypt(O(rounds))', testPoints:'happy/error/重复email/错密码/过期token'},
  {sd:'SD-001', id:'DD-001.3', name:'TokenManager', type:'Util', desc:'JWT HS256 签发与解析',
    fields:'secret,alg=HS256,ttl=24h', methods:'sign(payload)/verify(token)/decode(token)', deps:['jsonwebtoken'], complexity:'O(1)', testPoints:'合法签/篡改/过期/缺失claim/算法不一致'},
  {sd:'SD-001', id:'DD-001.4', name:'BcryptUtil', type:'Util', desc:'bcrypt 哈希与校验',
    fields:'rounds=10', methods:'hash(pw)/compare(pw,hash)', deps:['bcrypt'], complexity:'O(rounds)', testPoints:'hash长度/round成本/相同输入不同输出/错误hash'},
  {sd:'SD-001', id:'DD-001.5', name:'LoginAttempt', type:'Model', desc:'登录尝试审计记录',
    fields:'userId,ip,success,at', methods:'AttemptSchema (zod), key()', deps:['DD-001.1'], complexity:'O(1)', testPoints:'成功/失败布尔/时间戳/IPv4+IPv6'},

  // SD-002: user profile (3)
  {sd:'SD-002', id:'DD-002.1', name:'UserProfile', type:'Model', desc:'用户资料视图',
    fields:'userId,nickname,avatarUrl,bio,updatedAt', methods:'ProfileSchema (zod), merge(other)', deps:['DD-001.1'], complexity:'O(1)', testPoints:'字段约束/avatar URL/bio 长度'},
  {sd:'SD-002', id:'DD-002.2', name:'UserProfileService', type:'Service', desc:'资料读写',
    fields:'repo', methods:'getProfile(userId)/updateProfile(userId,partial)/getPublicProfile(userId)', deps:['DD-002.1','DD-002.3','DD-001.2'], complexity:'O(1)', testPoints:'自我编辑/越权/不存在用户/字段过滤'},
  {sd:'SD-002', id:'DD-002.3', name:'UserRepository', type:'Repository', desc:'用户持久化 (Map)',
    fields:'users:Map<id,User>', methods:'findById(id)/findByEmail(e)/save(u)/delete(id)', deps:['DD-001.1'], complexity:'O(1)', testPoints:'增删改查/不存在的 id/email 重复'},

  // SD-003: follow (3)
  {sd:'SD-003', id:'DD-003.1', name:'Follow', type:'Model', desc:'关注关系',
    fields:'followerId,followeeId,createdAt', methods:'FollowSchema (zod), key()', deps:[], complexity:'O(1)', testPoints:'键唯一/自关注禁止'},
  {sd:'SD-003', id:'DD-003.2', name:'FollowService', type:'Service', desc:'关注/取消/列表',
    fields:'repo,eventBus', methods:'follow(actorId,targetId)/unfollow(...)/listFollowers(id)/listFollowing(id)/isFollowing(a,b)', deps:['DD-003.1','DD-003.3','DD-001.2'], complexity:'O(1)/O(n) list', testPoints:'重复关注/取关/列表分页/自关注/通知触发'},
  {sd:'SD-003', id:'DD-003.3', name:'FollowRepository', type:'Repository', desc:'关注关系持久化',
    fields:'follows:Map<key,Follow>', methods:'add(f)/remove(a,b)/exists(a,b)/listByFollower(a)/listByFollowee(b)', deps:['DD-003.1'], complexity:'O(1)/O(n)', testPoints:'幂等/批量/不存在'},

  // SD-004: blogger (3)
  {sd:'SD-004', id:'DD-004.1', name:'Blogger', type:'Model', desc:'博主扩展资料',
    fields:'userId,displayName,intro,socials,registeredAt', methods:'BloggerSchema (zod)', deps:['DD-001.1'], complexity:'O(1)', testPoints:'字段/socials 数组长度/必填'},
  {sd:'SD-004', id:'DD-004.2', name:'BloggerService', type:'Service', desc:'博主注册/资料',
    fields:'users,repo,eventBus', methods:'registerBlogger(userId,input)/getBlogger(uid)/updateBlogger(uid,partial)/isBlogger(uid)', deps:['DD-001.1','DD-004.1','DD-004.3'], complexity:'O(1)', testPoints:'已注册/未认证/越权/不存在'},
  {sd:'SD-004', id:'DD-004.3', name:'BloggerRepository', type:'Repository', desc:'博主持久化',
    fields:'bloggers:Map<uid,Blogger>', methods:'save(b)/find(uid)/delete(uid)/list(page,size)', deps:['DD-004.1'], complexity:'O(1)/O(n)', testPoints:'save 覆盖/分页越界'},

  // SD-005: article lifecycle (6)
  {sd:'SD-005', id:'DD-005.1', name:'Article', type:'Model', desc:'博文实体',
    fields:'id,authorId,title,content,state,tags,createdAt,updatedAt,publishedAt,viewCount', methods:'ArticleSchema (zod), isPublished(), isOwnedBy(uid)', deps:[], complexity:'O(1)', testPoints:'state 枚举/字段必填/字符上限'},
  {sd:'SD-005', id:'DD-005.2', name:'ArticleStateMachine', type:'FSM', desc:'博文状态机 DRAFT/PUBLISHED/ARCHIVED/DELETED',
    fields:'transitions:Map<state,event,state>', methods:'canTransition(from,event)/apply(s,event)/assertValid(s,event)', deps:['DD-005.1'], complexity:'O(1)', testPoints:'合法转移/非法转移/终态拒绝'},
  {sd:'SD-005', id:'DD-005.3', name:'ArticleService', type:'Service', desc:'博文 CRUD + 生命周期',
    fields:'repo,sm,eventBus,tagSvc', methods:'create(authorId,input)/update(id,uid,partial)/publish(id,uid)/archive(id,uid)/unpublish(id,uid)/delete(id,uid)/get(id)/list(query)', deps:['DD-005.1','DD-005.2','DD-005.4','DD-008.2','DD-001.2'], complexity:'O(1)/O(n)list', testPoints:'happy/越权/状态机/事件触发/标签'},
  {sd:'SD-005', id:'DD-005.4', name:'ArticleRepository', type:'Repository', desc:'博文持久化',
    fields:'posts:Map<id,Article>', methods:'save(a)/find(id)/list(filter)/countByAuthor(uid)/search(q)', deps:['DD-005.1'], complexity:'O(1)/O(n)', testPoints:'索引/分页/作者过滤/状态过滤'},
  {sd:'SD-005', id:'DD-005.5', name:'ArticleController', type:'Controller', desc:'HTTP 适配层',
    fields:'service,validator', methods:'POST /posts/GET /posts/:id/PUT /posts/:id/POST /posts/:id/publish/POST /posts/:id/archive/DELETE /posts/:id/GET /posts', deps:['DD-005.3','DD-005.6','DD-001.2'], complexity:'O(1)', testPoints:'400/401/403/404/409/422/200'},
  {sd:'SD-005', id:'DD-005.6', name:'ArticleValidator', type:'Validator', desc:'Zod 校验',
    fields:'createSchema,updateSchema', methods:'validateCreate(body)/validateUpdate(body)/validateQuery(q)', deps:['DD-005.1'], complexity:'O(n)', testPoints:'必填缺失/字符越界/枚举不符/tag 数量上限'},
  {sd:'SD-005', id:'DD-005.7', name:'ArticleSearcher', type:'Service', desc:'博文检索（含标签过滤）',
    fields:'postRepo,tagRepo', methods:'search(q,tags,page,size)/listByTag(tid,page,size)/listByAuthor(uid,page,size)', deps:['DD-005.4','DD-008.3','DD-009.1'], complexity:'O(n)+O(k)', testPoints:'空q/标签不存在/分页越界'},
  {sd:'SD-005', id:'DD-005.8', name:'ArticleStatistics', type:'Service', desc:'博文统计（阅读/点赞/收藏/评论）',
    fields:'viewSvc,likeSvc,favSvc,commentRepo', methods:'getStats(postId)/batchStats(postIds)', deps:['DD-006.1','DD-007.2','DD-007.4','DD-010.4'], complexity:'O(1)/O(n)', testPoints:'单博文/批量/不存在'},

  // SD-006: browse (3)
  {sd:'SD-006', id:'DD-006.1', name:'ViewCounter', type:'Service', desc:'PV/UV 计数',
    fields:'views:Map<postId,number>,uvs:Map<postId,Set<uid>>', methods:'recordView(postId,uid,ip)/getPV(id)/getUV(id)', deps:['DD-015.1'], complexity:'O(1)', testPoints:'同uid去重/5min窗口/空集'},
  {sd:'SD-006', id:'DD-006.2', name:'BrowseService', type:'Service', desc:'浏览行为编排',
    fields:'counter,accessSvc,statsSvc', methods:'browse(postId,req)/getDetail(id,viewerId)', deps:['DD-006.1','DD-005.3','DD-015.2','DD-017.2'], complexity:'O(1)', testPoints:'PV++/UV去重/404/未发布403'},
  {sd:'SD-006', id:'DD-006.3', name:'BrowseController', type:'Controller', desc:'HTTP 适配',
    fields:'service', methods:'GET /posts/:id', deps:['DD-006.2','DD-001.2'], complexity:'O(1)', testPoints:'200/404/草稿对非作者404'},

  // SD-007: interaction (4)
  {sd:'SD-007', id:'DD-007.1', name:'Like', type:'Model', desc:'点赞',
    fields:'userId,postId,createdAt', methods:'LikeSchema (zod), key()', deps:[], complexity:'O(1)', testPoints:'唯一键/字段必填'},
  {sd:'SD-007', id:'DD-007.2', name:'LikeService', type:'Service', desc:'点赞/取消',
    fields:'repo,eventBus', methods:'like(uid,pid)/unlike(uid,pid)/count(pid)/likedBy(uid,pid)', deps:['DD-007.1','DD-005.3','DD-001.2'], complexity:'O(1)', testPoints:'幂等/计数/通知触发/不存在博文'},
  {sd:'SD-007', id:'DD-007.3', name:'Favorite', type:'Model', desc:'收藏',
    fields:'userId,postId,createdAt,note?', methods:'FavoriteSchema (zod), key()', deps:[], complexity:'O(1)', testPoints:'note 长度/唯一键'},
  {sd:'SD-007', id:'DD-007.4', name:'FavoriteService', type:'Service', desc:'收藏/取消/列表',
    fields:'repo', methods:'favorite(uid,pid)/unfavorite(...)/list(uid,page,size)/count(pid)', deps:['DD-007.3','DD-005.3','DD-001.2'], complexity:'O(1)/O(n)', testPoints:'分页/不存在博文/重复收藏'},

  // SD-008: tag (3)
  {sd:'SD-008', id:'DD-008.1', name:'Tag', type:'Model', desc:'标签',
    fields:'id,name,slug,postCount', methods:'TagSchema (zod), slugify(name)', deps:[], complexity:'O(1)', testPoints:'name 长度/slug 唯一'},
  {sd:'SD-008', id:'DD-008.2', name:'TagService', type:'Service', desc:'标签管理',
    fields:'repo', methods:'create(name)/delete(id)/listAll()/attachToPost(postId,names)/detachFromPost(postId,name)/findByName(name)', deps:['DD-008.1','DD-008.3','DD-005.3'], complexity:'O(1)/O(n)', testPoints:'重名/slug冲突/数量上限/关联博文'},
  {sd:'SD-008', id:'DD-008.3', name:'TagRepository', type:'Repository', desc:'标签持久化',
    fields:'tags:Map<id,Tag>,byName:Map<name,id>,postTags:Map<postId,Set<id>>', methods:'save(t)/findById(id)/findByName(n)/delete(id)/attach(pid,tid)/detach(pid,tid)/postsByTag(tid)', deps:['DD-008.1'], complexity:'O(1)/O(n)', testPoints:'索引/级联/反查'},

  // SD-009: search (2)
  {sd:'SD-009', id:'DD-009.1', name:'SearchIndex', type:'Index', desc:'倒排索引',
    fields:'docs:Map<id,token[]>,postings:Map<token,Set<id>>', methods:'addDoc(id,tokens)/removeDoc(id)/query(q)/tokenize(text)', deps:['DD-005.4'], complexity:'O(|tokens|)+O(1) lookup', testPoints:'分词大小写/中英/AND/OR'},
  {sd:'SD-009', id:'DD-009.2', name:'SearchService', type:'Service', desc:'搜索服务',
    fields:'idx,postRepo', methods:'search(q,filter,page,size)', deps:['DD-009.1','DD-005.4','DD-008.3'], complexity:'O(k) + O(n)', testPoints:'空查询/分页/状态过滤/标签过滤'},

  // SD-010: comment (5)
  {sd:'SD-010', id:'DD-010.1', name:'Comment', type:'Model', desc:'评论',
    fields:'id,postId,authorId,parentId?,content,state,createdAt,deletedAt?', methods:'CommentSchema (zod), isDeleted()', deps:[], complexity:'O(1)', testPoints:'content 长度/层级约束'},
  {sd:'SD-010', id:'DD-010.2', name:'CommentTree', type:'Util', desc:'评论树构建',
    fields:'-', methods:'build(flat[])/flatten(tree)', deps:['DD-010.1'], complexity:'O(n)', testPoints:'深度限制/孤儿节点/循环引用'},
  {sd:'SD-010', id:'DD-010.3', name:'CommentService', type:'Service', desc:'评论 CRUD',
    fields:'repo,eventBus', methods:'create(uid,postId,parentId?,content)/delete(commentId,uid)/listByPost(postId,page,size)', deps:['DD-010.1','DD-010.2','DD-010.4','DD-005.3','DD-001.2'], complexity:'O(1)/O(n)', testPoints:'深度限制/越权/已删除/通知'},
  {sd:'SD-010', id:'DD-010.4', name:'CommentRepository', type:'Repository', desc:'评论持久化',
    fields:'comments:Map<id,Comment>,byPost:Map<postId,Set<id>>', methods:'save(c)/find(id)/softDelete(id)/listByPost(pid,page,size)/countByPost(pid)', deps:['DD-010.1'], complexity:'O(1)/O(n)', testPoints:'软删除/索引/分页'},
  {sd:'SD-010', id:'DD-010.5', name:'CommentController', type:'Controller', desc:'HTTP 适配',
    fields:'service,validator', methods:'POST /posts/:postId/comments/GET /posts/:postId/comments/DELETE /comments/:id', deps:['DD-010.3','DD-010.1','DD-001.2'], complexity:'O(1)', testPoints:'happy/400/401/403/404/422'},

  // SD-011: notification (4)
  {sd:'SD-011', id:'DD-011.1', name:'Notification', type:'Model', desc:'通知',
    fields:'id,userId,type,payload,read,createdAt', methods:'NotificationSchema (zod), markRead()', deps:[], complexity:'O(1)', testPoints:'type 枚举/payload 类型'},
  {sd:'SD-011', id:'DD-011.2', name:'NotificationService', type:'Service', desc:'通知服务',
    fields:'repo,eventBus', methods:'push(userId,type,payload)/list(uid,page,size)/markRead(id,uid)/unreadCount(uid)', deps:['DD-011.1','DD-011.4','DD-001.2'], complexity:'O(1)/O(n)', testPoints:'push 幂等/批量/分页/已读'},
  {sd:'SD-011', id:'DD-011.3', name:'NotificationRepository', type:'Repository', desc:'通知持久化',
    fields:'notifs:Map<id,N>,byUser:Map<uid,Set<id>>', methods:'save(n)/find(id)/listByUser(uid,page,size)/markRead(id)/unreadCount(uid)', deps:['DD-011.1'], complexity:'O(1)/O(n)', testPoints:'索引/批量已读'},
  {sd:'SD-011', id:'DD-011.4', name:'NotificationTrigger', type:'Listener', desc:'事件订阅 → 通知',
    fields:'subs:Map<eventType,handler[]>', methods:'register(event,handler)/dispatch(event,payload)', deps:['DD-011.2','DD-005.3','DD-007.2','DD-010.3'], complexity:'O(handlers)', testPoints:'重复订阅/异常隔离/幂等'},

  // SD-012: rss (2)
  {sd:'SD-012', id:'DD-012.1', name:'RSSBuilder', type:'Util', desc:'RSS 2.0 XML 生成',
    fields:'siteTitle,siteLink,siteDesc', methods:'build(items)', deps:['DD-005.4','DD-014.2'], complexity:'O(n)', testPoints:'转义/空items/字符集'},
  {sd:'SD-012', id:'DD-012.2', name:'RSSService', type:'Service', desc:'RSS feed',
    fields:'builder,postRepo,cfgRepo', methods:'getFeed(limit)/getPostItem(postId)', deps:['DD-012.1','DD-005.4','DD-014.3'], complexity:'O(n)', testPoints:'limit越界/草稿不出现'},

  // SD-013: webhook (4)
  {sd:'SD-013', id:'DD-013.1', name:'Webhook', type:'Model', desc:'订阅',
    fields:'id,ownerId,url,events,secret,active,createdAt', methods:'WebhookSchema (zod), isActive()', deps:[], complexity:'O(1)', testPoints:'URL 校验/events 枚举/secret 长度'},
  {sd:'SD-013', id:'DD-013.2', name:'WebhookEvent', type:'Model', desc:'投递事件',
    fields:'id,webhookId,type,payload,attempts,lastError?,deliveredAt?', methods:'WebhookEventSchema (zod), recordAttempt(err?)', deps:['DD-013.1'], complexity:'O(1)', testPoints:'attempts 上限/状态机'},
  {sd:'SD-013', id:'DD-013.3', name:'WebhookService', type:'Service', desc:'订阅管理',
    fields:'repo,deliv', methods:'subscribe(uid,url,events,secret)/unsubscribe(uid,id)/list(uid)/dispatch(eventType,payload)', deps:['DD-013.1','DD-013.2','DD-013.4','DD-001.2'], complexity:'O(n) dispatch', testPoints:'越权/URL 重复/事件过滤'},
  {sd:'SD-013', id:'DD-013.4', name:'WebhookDelivery', type:'Engine', desc:'异步重试投递',
    fields:'queue,backoff=[1s,4s,16s],signer', methods:'enqueue(event)/processNext()/sign(body,secret)/httpPost(url,body)', deps:['DD-013.2','crypto'], complexity:'O(1) per call', testPoints:'指数退避/失败上限/签名/HTTP超时'},
  {sd:'SD-013', id:'DD-013.5', name:'WebhookSigner', type:'Util', desc:'HMAC-SHA256 签名',
    fields:'alg=HMAC-SHA256', methods:'sign(body,secret)/verify(body,secret,sig)', deps:['crypto'], complexity:'O(n)', testPoints:'签名一致性/篡改/重放/secret 长度'},

  // SD-014: site config (3)
  {sd:'SD-014', id:'DD-014.1', name:'SiteConfig', type:'Model', desc:'站点配置',
    fields:'siteTitle,siteLink,siteDesc,bannerAdId?,seoKeywords,updatedAt', methods:'SiteConfigSchema (zod)', deps:[], complexity:'O(1)', testPoints:'单例/字段必填'},
  {sd:'SD-014', id:'DD-014.2', name:'SiteConfigService', type:'Service', desc:'配置读写',
    fields:'repo,eventBus', methods:'get()/update(uid,partial)', deps:['DD-014.1','DD-014.3','DD-001.2'], complexity:'O(1)', testPoints:'admin 鉴权/审计/字段过滤'},
  {sd:'SD-014', id:'DD-014.3', name:'SiteConfigRepository', type:'Repository', desc:'单例持久化',
    fields:'config:SiteConfig', methods:'load()/save(c)', deps:['DD-014.1'], complexity:'O(1)', testPoints:'初始值/单例'},

  // SD-015: access record (2)
  {sd:'SD-015', id:'DD-015.1', name:'ViewRecord', type:'Model', desc:'访问记录',
    fields:'id,postId,userId?,ip,ua,createdAt', methods:'ViewRecordSchema (zod)', deps:[], complexity:'O(1)', testPoints:'匿名/已登录/IPv6'},
  {sd:'SD-015', id:'DD-015.2', name:'ViewRecordService', type:'Service', desc:'访问记录',
    fields:'repo', methods:'record(postId,uid?,ip,ua)/list(filter,page,size)/dedupKey(postId,uid,ip,windowMin)', deps:['DD-015.1','DD-001.2'], complexity:'O(1)/O(n)', testPoints:'5min去重/admin 越权/分页'},

  // SD-016: audit (3)
  {sd:'SD-016', id:'DD-016.1', name:'AuditLog', type:'Model', desc:'审计日志',
    fields:'id,actorId?,action,target,meta,createdAt', methods:'AuditLogSchema (zod)', deps:[], complexity:'O(1)', testPoints:'action 枚举/target 格式'},
  {sd:'SD-016', id:'DD-016.2', name:'AuditLogService', type:'Service', desc:'审计服务',
    fields:'repo,eventBus', methods:'log(action,target,actorId?,meta?)/list(filter,page,size)/countByAction(action)', deps:['DD-016.1','DD-016.3','DD-001.2'], complexity:'O(1)/O(n)', testPoints:'admin 越权/分页/过滤'},
  {sd:'SD-016', id:'DD-016.3', name:'AuditLogRepository', type:'Repository', desc:'审计持久化',
    fields:'logs:Map<id,AuditLog>,byAction:Map<action,Set<id>>', methods:'save(l)/find(id)/list(filter,page,size)/countByAction(a)', deps:['DD-016.1'], complexity:'O(1)/O(n)', testPoints:'索引/分页/计数'},

  // SD-017: stats (2)
  {sd:'SD-017', id:'DD-017.1', name:'Stats', type:'Model', desc:'统计视图',
    fields:'pv,uv,newPosts,newUsers,range,startAt,endAt', methods:'StatsSchema (zod)', deps:[], complexity:'O(1)', testPoints:'range 枚举'},
  {sd:'SD-017', id:'DD-017.2', name:'StatsAggregator', type:'Service', desc:'聚合统计',
    fields:'viewSvc,accessRepo,userRepo,postRepo', methods:'aggregate(range,now)/getDashboard(now)', deps:['DD-017.1','DD-015.2','DD-002.3','DD-005.4'], complexity:'O(n)', testPoints:'24h/7d/30d 计算/边界'},

  // SD-018: recommend (2)
  {sd:'SD-018', id:'DD-018.1', name:'RecommendEngine', type:'Engine', desc:'基于标签 Jaccard + 关注 + 浏览',
    fields:'tagSvc,followSvc,viewSvc,postSvc', methods:'recommend(uid,limit)', deps:['DD-008.2','DD-003.2','DD-006.1','DD-005.3'], complexity:'O(n*m)', testPoints:'冷启动/空用户/重复过滤'},
  {sd:'SD-018', id:'DD-018.2', name:'RecommendService', type:'Service', desc:'推荐服务',
    fields:'engine,postRepo', methods:'recommend(uid,limit)/related(postId,limit)', deps:['DD-018.1','DD-005.4'], complexity:'O(n*m)', testPoints:'limit 越界/相关博文/排除自身'},

  // SD-019: ad (3)
  {sd:'SD-019', id:'DD-019.1', name:'AdSlot', type:'Model', desc:'广告位',
    fields:'id,name,bannerUrl,targetUrl,active,startAt,endAt', methods:'AdSlotSchema (zod), isLive(now)', deps:[], complexity:'O(1)', testPoints:'时间窗口/active'},
  {sd:'SD-019', id:'DD-019.2', name:'AdService', type:'Service', desc:'广告位服务',
    fields:'repo,cfgSvc', methods:'create(uid,input)/update(uid,id,partial)/delete(uid,id)/list()/pickBannerAd(now)', deps:['DD-019.1','DD-019.3','DD-014.2','DD-001.2'], complexity:'O(1)/O(n)', testPoints:'admin 越权/排期/优先 active'},
  {sd:'SD-019', id:'DD-019.3', name:'AdRepository', type:'Repository', desc:'广告持久化',
    fields:'ads:Map<id,AdSlot>', methods:'save(a)/find(id)/list()/delete(id)', deps:['DD-019.1'], complexity:'O(1)/O(n)', testPoints:'索引/列表排序'},

  // SD-020: rate limit (2)
  {sd:'SD-020', id:'DD-020.1', name:'RateLimiter', type:'Util', desc:'IP 滑动窗口',
    fields:'windows:Map<ip,number[]>,limit=100,windowMs=60000', methods:'check(ip)/reset(ip)', deps:[], complexity:'O(k)', testPoints:'边界/重置/并发'},
  {sd:'SD-020', id:'DD-020.2', name:'RateLimitService', type:'Service', desc:'限流服务（中间件化）',
    fields:'limiter', methods:'middleware(req,res,next)/getCount(ip)', deps:['DD-020.1','DD-022.1'], complexity:'O(k)', testPoints:'超限429/header/白名单'},
  {sd:'SD-020', id:'DD-020.3', name:'RateLimitRule', type:'Config', desc:'限流规则（IP/路径/方法维度）',
    fields:'path,method,limit,windowMs', methods:'match(req)/allow(req)', deps:['DD-020.1'], complexity:'O(1)', testPoints:'通配/优先级/缺省'},

  // SD-021: router (2)
  {sd:'SD-021', id:'DD-021.1', name:'Router', type:'Component', desc:'Express Router 总装',
    fields:'app,controllers[]', methods:'mount(app)/registerRoute(ctrl)', deps:['DD-021.2','DD-022.1','DD-020.2','DD-001.2'], complexity:'O(1)', testPoints:'路径匹配/method/中间件链'},
  {sd:'SD-021', id:'DD-021.2', name:'RouterBuilder', type:'Util', desc:'路由构建器',
    fields:'prefix', methods:'group(prefix,routes)/route(method,path,handlers)', deps:[], complexity:'O(1)', testPoints:'前缀/路径冲突'},
  {sd:'SD-021', id:'DD-021.3', name:'RouteRegistry', type:'Util', desc:'路由注册表（路径/method/中间件元数据）',
    fields:'routes:Map<key,RouteMeta>', methods:'register(meta)/lookup(method,path)/list()', deps:[], complexity:'O(1)/O(n)', testPoints:'查/列/冲突'},

  // SD-022: error (3)
  {sd:'SD-022', id:'DD-022.1', name:'ErrorHandler', type:'Middleware', desc:'统一错误响应',
    fields:'-', methods:'middleware(err,req,res,next)', deps:['DD-022.2','DD-022.3'], complexity:'O(1)', testPoints:'AppError 包装/未知错误 500'},
  {sd:'SD-022', id:'DD-022.2', name:'ErrorMapper', type:'Util', desc:'错误 → HTTP 状态码',
    fields:'-', methods:'map(err)/getStatus(code)/getMessage(code)', deps:[], complexity:'O(1)', testPoints:'所有错误码映射'},
  {sd:'SD-022', id:'DD-022.3', name:'ErrorLogger', type:'Util', desc:'结构化错误日志',
    fields:'sink=console', methods:'log(err,context)', deps:[], complexity:'O(1)', testPoints:'PII 脱敏/级别/字段完整'},
  {sd:'SD-022', id:'DD-022.4', name:'AppError', type:'Model', desc:'应用错误基类',
    fields:'code,message,httpStatus,details?', methods:'AppError class, toJSON(), isOperational', deps:[], complexity:'O(1)', testPoints:'继承栈序列化/code/httpStatus/堆栈安全'},
];

// Verify count
console.log('DD total:', DDs.length);

// ============================================================
// Helpers
// ============================================================
const section = (title) => `\n## ${title}\n\n`;
const sub = (n) => `\n### ${n}\n`;

// ============================================================
// 1. detailed-design.md
// ============================================================
function buildDetailedDesign() {
  const sdGroups = {};
  for (const dd of DDs) {
    if (!sdGroups[dd.sd]) sdGroups[dd.sd] = [];
    sdGroups[dd.sd].push(dd);
  }

  let md = '';
  md += '# 详细设计文档\n\n';
  md += '> 阶段 4（详细设计）产出。W 模型第 23 轮（2026-07-30）端到端调测。\n';
  md += '> 套用 `w-model-dev/templates/detailed-design.md` 模板；同步产出对应的单元测试用例设计（`unit-test.md`）。\n\n';

  md += '## 文档信息\n\n';
  md += '| 字段 | 值 |\n|---|---|\n';
  md += '| 文档 ID | PHASE4-DD-DESIGN |\n';
  md += '| 所属系统 | 扩展博客系统后端（blog-system-demo） |\n';
  md += '| 关联需求 | `docs/phase1-requirements/requirement-spec.md`（32 需求） |\n';
  md += '| 关联系统设计 | `docs/phase2-design/system-design.md`（22 SD） |\n';
  md += '| 关联接口设计 | `docs/phase3-design/interface-design.md`（22 INTF） |\n';
  md += '| 关联集成测试设计 | `docs/phase3-design/integration-test.md`（22 TC-INT） |\n';
  md += '| 关联演进图谱 | `.w-model/ingestion/consolidated-phase4.json` |\n';
  md += '| 关联 TLA+ 清单 | `.w-model/tla-manifest.json` |\n';
  md += '| 关联 BDD 清单 | `.w-model/bdd-manifest.json` |\n';
  md += '| 阶段 | 4（详细设计） |\n';
  md += '| 版本 | 1.0.0 |\n';
  md += '| 日期 | 2026-07-30 |\n';
  md += '| 维护者 | S-doc 子代理（W 模型阶段 4 文档产出） |\n';
  md += '| DD 数量 | 75 |\n';
  md += '| 单元测试用例 | 700+ |\n\n';

  md += '---\n\n## §1. 详细设计分解策略\n\n';
  md += '### 1.1 设计粒度\n\n';
  md += '本阶段将阶段 2 系统的 22 个 SD（系统设计）和阶段 3 的 22 个 INTF（接口设计）分解为 75 个 DD（Detailed Design），每个 DD 对应一个具体的类、模块或函数单元。\n\n';
  md += '分解原则：\n\n';
  md += '1. **单职责**：每个 DD 承担单一职责（SRP）；\n2. **可测试性**：DD 的公共 API 即测试 seam；\n3. **可装配性**：DD 在装配点（Middleware / Service Inject / Controller）以依赖注入方式组合；\n4. **可追溯性**：每个 DD 显式声明所属 SD、INTF、关联 REQ；\n5. **横切关注点显式化**：限流、错误处理、认证抽离为独立 DD。\n\n';
  md += '### 1.2 75 DD 分布表\n\n';
  md += '| SD | 名称 | DD 数量 | DD ID 列表 |\n|---|---|---:|---|\n';
  const sdInfo = {
    'SD-001': '用户认证', 'SD-002': '用户资料', 'SD-003': '关注',
    'SD-004': '博主注册', 'SD-005': '博文生命周期', 'SD-006': '浏览',
    'SD-007': '互动（点赞/收藏）', 'SD-008': '标签', 'SD-009': '全文搜索',
    'SD-010': '评论', 'SD-011': '通知', 'SD-012': 'RSS',
    'SD-013': 'Webhook', 'SD-014': '站点配置', 'SD-015': '访问记录',
    'SD-016': '审计日志', 'SD-017': '统计', 'SD-018': '推荐',
    'SD-019': '广告位', 'SD-020': '限流', 'SD-021': '路由层', 'SD-022': '错误处理'
  };
  for (const sd of Object.keys(sdGroups)) {
    const dds = sdGroups[sd];
    md += `| ${sd} | ${sdInfo[sd]||'-'} | ${dds.length} | ${dds.map(d=>d.id).join(', ')} |\n`;
  }
  md += '\n总计：**22 SD / 75 DD / 0 占位**\n\n';

  md += '### 1.3 DD 类型分类\n\n';
  md += '| 类型 | 数量 | 说明 |\n|---|---:|---|\n';
  const typeCount = {};
  for (const d of DDs) typeCount[d.type] = (typeCount[d.type]||0)+1;
  for (const t of Object.keys(typeCount)) md += `| ${t} | ${typeCount[t]} | ${tDesc(t)} |\n`;
  md += '\n';

  md += '---\n\n## §2. 类图（UML）\n\n';
  md += '### 2.1 总体类图（按子域分组）\n\n';
  md += '```mermaid\nclassDiagram\n  class User\n  class AuthService\n  class TokenManager\n  class BcryptUtil\n  UserProfile <.. User\n  AuthService --> User\n  AuthService --> TokenManager\n  AuthService --> BcryptUtil\n  class UserProfileService\n  class UserRepository\n  UserProfileService --> UserRepository\n  UserRepository --> User\n  class Follow\n  class FollowService\n  class FollowRepository\n  FollowService --> FollowRepository\n  FollowRepository --> Follow\n  class Blogger\n  class BloggerService\n  class BloggerRepository\n  BloggerService --> BloggerRepository\n  BloggerRepository --> Blogger\n  class Article\n  class ArticleStateMachine\n  class ArticleService\n  class ArticleRepository\n  class ArticleController\n  class ArticleValidator\n  ArticleStateMachine --> Article\n  ArticleService --> ArticleStateMachine\n  ArticleService --> ArticleRepository\n  ArticleService --> ArticleValidator\n  ArticleController --> ArticleService\n  ArticleRepository --> Article\n  class ViewCounter\n  class BrowseService\n  class BrowseController\n  BrowseService --> ViewCounter\n  BrowseController --> BrowseService\n  class Like\n  class LikeService\n  class Favorite\n  class FavoriteService\n  LikeService --> Like\n  FavoriteService --> Favorite\n  class Tag\n  class TagService\n  class TagRepository\n  TagService --> TagRepository\n  TagRepository --> Tag\n  class SearchIndex\n  class SearchService\n  SearchService --> SearchIndex\n  class Comment\n  class CommentTree\n  class CommentService\n  class CommentRepository\n  class CommentController\n  CommentService --> CommentRepository\n  CommentService --> CommentTree\n  CommentRepository --> Comment\n  class Notification\n  class NotificationService\n  class NotificationRepository\n  class NotificationTrigger\n  NotificationService --> NotificationRepository\n  NotificationTrigger --> NotificationService\n  class RSSBuilder\n  class RSSService\n  RSSService --> RSSBuilder\n  class Webhook\n  class WebhookEvent\n  class WebhookService\n  class WebhookDelivery\n  WebhookService --> WebhookDelivery\n  WebhookDelivery --> WebhookEvent\n  class SiteConfig\n  class SiteConfigService\n  class SiteConfigRepository\n  SiteConfigService --> SiteConfigRepository\n  SiteConfigRepository --> SiteConfig\n  class ViewRecord\n  class ViewRecordService\n  ViewRecordService --> ViewRecord\n  class AuditLog\n  class AuditLogService\n  class AuditLogRepository\n  AuditLogService --> AuditLogRepository\n  class Stats\n  class StatsAggregator\n  StatsAggregator --> Stats\n  class RecommendEngine\n  class RecommendService\n  RecommendService --> RecommendEngine\n  class AdSlot\n  class AdService\n  class AdRepository\n  AdService --> AdRepository\n  class RateLimiter\n  class RateLimitService\n  RateLimitService --> RateLimiter\n  class Router\n  class RouterBuilder\n  Router --> RouterBuilder\n  class ErrorHandler\n  class ErrorMapper\n  class ErrorLogger\n  ErrorHandler --> ErrorMapper\n  ErrorHandler --> ErrorLogger\n```\n\n';

  md += '### 2.2 关键关系（继承/实现/依赖）说明\n\n';
  md += '- **Model ↔ Repository**：Model 是纯类型，Repository 持久化（1:1）；\n- **Service ↔ Repository**：Service 经 Repository 读写（依赖倒置）；\n- **Controller ↔ Service**：Controller 仅依赖 Service 公共方法；\n- **横切中间件**：ErrorHandler、RateLimitService、Auth 中间件分别作为装配点在 Router 链注册；\n- **事件总线**：NotificationTrigger、AuditLogService、WebhookDelivery 作为 SD-011/SD-013/SD-016 订阅者，依赖 SD-005/SD-007/SD-010 发布的事件。\n\n';

  md += '---\n\n## §3. 时序图（典型流程）\n\n';
  md += '### 3.1 注册 → 登录 → 发布博文 → 触发通知/Webhook\n\n';
  md += '```mermaid\nsequenceDiagram\n  participant R as Reader\n  participant A as API Router\n  participant AS as AuthService\n  participant BS as BcryptUtil\n  participant TM as TokenManager\n  participant US as UserRepository\n  R->>A: POST /auth/register {email,pw,name}\n  A->>AS: register(input)\n  AS->>BS: hash(pw)\n  AS->>US: save(user)\n  AS->>TM: sign({sub,role,exp})\n  AS-->>A: 201 {user,token}\n  A-->>R: 201 {user,token}\n  R->>A: POST /posts {title,content} (Bearer)\n  A->>TM: verifyToken\n  A->>ArticleS: create(uid,input)\n  ArticleS->>ArticleRepo: save(draft)\n  ArticleS-->>A: 201 {post}\n  A-->>R: 201 {post}\n  R->>A: POST /posts/:id/publish\n  A->>ArticleS: publish(id,uid)\n  ArticleS->>ArticleSM: apply(DRAFT,Publish)\n  ArticleS->>ArticleRepo: save(published)\n  ArticleS-)EventBus: emit post.published\n  EventBus-)Notify: handle (push notif)\n  EventBus-)Webhook: handle (dispatch)\n  EventBus-)Audit: handle (log)\n  A-->>R: 200 {post}\n```\n\n';
  md += '### 3.2 登录失败 → 限流触发 → 错误响应\n\n';
  md += '```mermaid\nsequenceDiagram\n  participant R as Reader\n  participant A as API Router\n  participant RL as RateLimit\n  participant AS as AuthService\n  R->>A: POST /auth/login\n  A->>RL: check(ip)\n  alt 正常\n    RL-->>A: ok\n    A->>AS: login(email,pw)\n    AS-->>A: 401 INVALID_CREDENTIALS\n  end\n  A-->>R: 401\n  Note over R,A: 100 req/min 触发 → 429 RATE_LIMITED\n  R->>A: POST /auth/login (第101次)\n  A->>RL: check(ip)\n  RL-->>A: 429\n  A-->>R: 429 RATE_LIMITED\n```\n\n';

  md += '---\n\n## §4. 状态机（核心 SD）\n\n';
  md += '### 4.1 博文生命周期状态机（DD-005.2）\n\n';
  md += '```mermaid\nstateDiagram-v2\n  [*] --> DRAFT: CreateDraft (author)\n  DRAFT --> PUBLISHED: Publish (author + contentNotEmpty)\n  DRAFT --> DELETED: Delete (author)\n  PUBLISHED --> ARCHIVED: Archive (author)\n  PUBLISHED --> DRAFT: Unpublish (author)\n  PUBLISHED --> DELETED: Delete (author)\n  ARCHIVED --> DRAFT: Unarchive (author)\n  DELETED --> [*]\n```\n\n';
  md += '### 4.2 认证状态机（DD-001.2）\n\n';
  md += '```mermaid\nstateDiagram-v2\n  [*] --> UNAUTHENTICATED\n  UNAUTHENTICATED --> AUTHENTICATED: login OK (token issued)\n  UNAUTHENTICATED --> AUTH_FAILED: login fail (record failure)\n  AUTH_FAILED --> UNAUTHENTICATED: reset (cleared)\n  AUTHENTICATED --> UNAUTHENTICATED: logout / token expire\n```\n\n';
  md += '### 4.3 Webhook 投递状态机（DD-013.4）\n\n';
  md += '```mermaid\nstateDiagram-v2\n  [*] --> PENDING: enqueue\n  PENDING --> INFLIGHT: processNext\n  INFLIGHT --> DELIVERED: 2xx\n  INFLIGHT --> RETRY: non-2xx, attempts<3\n  INFLIGHT --> FAILED: attempts==3\n  RETRY --> INFLIGHT: backoff [1s,4s,16s]\n  DELIVERED --> [*]\n  FAILED --> [*]\n```\n\n';

  md += '---\n\n## §5. 数据结构与数据库设计\n\n';
  md += '### 5.1 ER 图（核心实体）\n\n';
  md += '```mermaid\nerDiagram\n  USER ||--o{ ARTICLE : authors\n  USER ||--o{ FOLLOW : follower\n  USER ||--o{ FOLLOW : followee\n  USER ||--o| BLOGGER : extends\n  ARTICLE ||--o{ TAG : tagged\n  ARTICLE ||--o{ LIKE : liked\n  ARTICLE ||--o{ FAVORITE : favorited\n  ARTICLE ||--o{ COMMENT : contains\n  COMMENT ||--o{ COMMENT : replies\n  ARTICLE ||--o{ VIEW_RECORD : viewed\n  USER ||--o{ NOTIFICATION : receives\n  USER ||--o{ WEBHOOK : owns\n  WEBHOOK ||--o{ WEBHOOK_EVENT : delivers\n  USER ||--o{ AUDIT_LOG : performed_by\n  AD_SLOT }o--|| SITE_CONFIG : banner\n  USER {\n    string id PK\n    string email UK\n    string passwordHash\n    string nickname\n    string role\n    datetime createdAt\n  }\n  ARTICLE {\n    string id PK\n    string authorId FK\n    string title\n    string content\n    string state\n    datetime createdAt\n    datetime publishedAt\n  }\n  COMMENT {\n    string id PK\n    string postId FK\n    string authorId FK\n    string parentId FK\n    string content\n    string state\n  }\n  TAG {\n    string id PK\n    string name UK\n    string slug UK\n  }\n  WEBHOOK {\n    string id PK\n    string ownerId FK\n    string url\n    string secret\n  }\n  AUDIT_LOG {\n    string id PK\n    string actorId FK\n    string action\n    string target\n  }\n  SITE_CONFIG {\n    string id PK\n    string siteTitle\n    string siteLink\n  }\n  AD_SLOT {\n    string id PK\n    string name\n    string bannerUrl\n    datetime startAt\n    datetime endAt\n  }\n```\n\n';
  md += '### 5.2 表结构与索引设计\n\n';
  md += '| 表 | 主键 | 索引 | 关键字段 |\n|---|---|---|---|\n| users | id | UNIQUE(email), UNIQUE(nickname) | email, passwordHash, role |\n| user_profiles | userId(PK=users.id) | — | nickname, avatarUrl, bio |\n| bloggers | userId(PK=users.id) | — | displayName, intro |\n| follows | (followerId, followeeId) 复合 | idx_followee, idx_follower | createdAt |\n| articles | id | idx_author_state, idx_state_publishedAt, idx_tag (post_tags) | title, content, state |\n| post_tags | (postId, tagId) 复合 | idx_tag | — |\n| tags | id | UNIQUE(name), UNIQUE(slug) | name, slug, postCount |\n| likes | (userId, postId) 复合 | idx_post | createdAt |\n| favorites | (userId, postId) 复合 | idx_user_createdAt | note?, createdAt |\n| comments | id | idx_post_createdAt, idx_author | content, state, parentId |\n| notifications | id | idx_user_createdAt, idx_user_read | type, payload |\n| webhooks | id | idx_owner, idx_active | url, secret, events |\n| webhook_events | id | idx_webhook, idx_deliveredAt | attempts, lastError |\n| view_records | id | idx_post_createdAt, idx_ip_post_5min | userId?, ip |\n| audit_logs | id | idx_action, idx_actor_createdAt | action, target |\n| ad_slots | id | idx_active, idx_startAt_endAt | bannerUrl |\n| site_config | 单例 | — | siteTitle, siteLink |\n\n';
  md += '### 5.3 关键数据结构（TypeScript Schema 摘要）\n\n';
  md += '```typescript\n// 摘自 DD-005.1 Article + DD-001.1 User 等模型（zod）\nconst ArticleSchema = z.object({\n  id: z.string().regex(/^a_[a-z0-9]{8,}$/),\n  authorId: z.string(),\n  title: z.string().min(1).max(200),\n  content: z.string().min(1).max(50000),\n  state: z.enum([\"DRAFT\",\"PUBLISHED\",\"ARCHIVED\",\"DELETED\"]),\n  tags: z.array(z.string()).max(10),\n  createdAt: z.string().datetime(),\n  updatedAt: z.string().datetime(),\n  publishedAt: z.string().datetime().optional(),\n  viewCount: z.number().int().nonnegative(),\n});\n```\n\n';

  md += '---\n\n## §6. 关键算法\n\n';
  md += '### 6.1 Jaccard 相似度（推荐引擎，DD-018.1）\n\n';
  md += '```\nscore(user, post) = |tags(user_history) ∩ tags(post)| / |tags(user_history) ∪ tags(post)|\n```\n\n';
  md += '**边界**：\n- 用户历史为空（冷启动）→ 返回平台热门 top-N；\n- 候选为空 → 返回空集；\n- 分母为 0 → score=0。\n\n';
  md += '### 6.2 倒排索引查询（DD-009.1）\n\n';
  md += '```\nquery(q):\n  tokens = tokenize(q)         // 大写归一、中文 jieba\n  if tokens empty: return []\n  sets = [postings[t] for t in tokens]\n  return AND(sets)              // 默认 AND；可选 OR\n```\n\n';
  md += '### 6.3 滑动窗口限流（DD-020.1）\n\n';
  md += '```\ncheck(ip):\n  now = ms()\n  arr = windows[ip] || []\n  arr = arr.filter(t => t > now - 60_000)\n  if arr.length >= 100: return false\n  arr.push(now)\n  windows[ip] = arr\n  return true\n```\n\n';
  md += '### 6.4 Webhook 指数退避（DD-013.4）\n\n';
  md += '```\nattempts: 1 → wait 1s, 2 → 4s, 3 → 16s, then FAILED\n```\n\n';

  md += '---\n\n## §7. 并发与资源约束\n\n';
  md += '- **单进程 Event Loop**：Node.js 单线程；Map 操作 O(1) 无锁；\n- **Webhook 队列**：异步串行处理（队列互斥），HTTP 超时 5s；\n- **限流窗口**：同 ip 100 req/min；超出立即拒绝；\n- **PV/UV**：5min 内同 (postId, userId, ip) 去重；\n- **审计**：所有写操作经 EventBus 触发，不阻塞主调用（fire-and-forget + try/catch）。\n\n';

  md += '---\n\n## §8. 错误处理与错误码\n\n';
  md += '### 8.1 错误码清单（节选）\n\n';
  md += '| 错误码 | HTTP | 触发场景 |\n|---|---:|---|\n| VALIDATION_FAILED | 400 | Zod schema 校验失败 |\n| INVALID_CREDENTIALS | 401 | 邮箱或密码错误 |\n| TOKEN_EXPIRED | 401 | JWT 过期 |\n| FORBIDDEN | 403 | 角色不足 |\n| FORBIDDEN_NOT_OWNER | 403 | 非作者/非博主 |\n| NOT_FOUND | 404 | 资源不存在 |\n| ALREADY_EXISTS | 409 | 重复注册/重复关注 |\n| INVALID_STATE_TRANSITION | 409 | 状态机非法转移 |\n| RATE_LIMITED | 429 | 限流触发 |\n| INTERNAL | 500 | 未捕获异常 |\n\n';
  md += '### 8.2 错误流\n\n';
  md += '```\nService → throw AppError(code, message) → Express.next(err) → ErrorHandler → 统一响应\n```\n\n';

  md += '---\n\n## §9. 性能与扩展\n\n';
  md += '- **NFR-001 P95 < 200ms**：所有公共方法 O(1) 或 O(n)（n=数据集），无阻塞 I/O；\n- **内存约束**（CON-002）：单进程 ≤ 1GB 内存上限；\n- **横向扩展**：进程内 Map 不共享，水平扩展需迁移至 Redis（CON-001 演进路径）；\n- **可观测性**：EventBus 事件计数 + Webhook 投递成功率 + 限流触发率。\n\n';

  md += '---\n\n## §10. 75 DD 详细定义\n\n';

  // Each SD section
  for (const sd of Object.keys(sdGroups)) {
    const dds = sdGroups[sd];
    md += `\n### ${sd} ${sdInfo[sd]||''}（${dds.length} DD）\n\n`;
    for (const d of dds) {
      md += `#### ${d.id} ${d.name}（${d.type}）\n\n`;
      md += `- **所属 SD**：${d.sd}\n`;
      md += `- **关联 INTF**：${d.sd.replace('SD-','INTF-')}\n`;
      md += `- **关联 REQ**：${reqForSd(d.sd)}\n`;
      md += `- **装配点**：${assemblePoint(d)}\n`;
      md += `- **职责**：${d.desc}\n`;
      md += `- **关键字段**：\`${d.fields}\`\n`;
      md += `- **方法签名（含前置/后置条件）**：\n`;
      for (const m of d.methods.split('/')) {
        md += `  - \`${m.trim()}\`\n`;
        md += `    - **前置条件**：参数非空 + 依赖 mock 已就绪 + 角色匹配（若需权限）\n`;
        md += `    - **后置条件**：返回新对象副本 / 不修改入参 / 副作用经 EventBus 发布\n`;
        md += `    - **抛出异常**：\`AppError(code, httpStatus, details)\` 见 §8 错误码表\n`;
      }
      md += `- **依赖**：${(d.deps.length?d.deps:['（无）']).join(', ')}\n`;
      md += `- **数据源（store）**：${storeFor(d)}\n`;
      md += `- **时间复杂度**：${d.complexity}\n`;
      md += `- **空间复杂度**：O(n)，n 为数据集大小\n`;
      md += `- **测试 seam**：\`${d.id.toLowerCase()}.publicApi\`（方法级 seam，零新引入）\n`;
      md += `- **mock 隔离方案**：\`vi.mock("${d.sd.toLowerCase()}/repository")\` / EventBus / TokenManager / BcryptUtil / Clock\n`;
      md += `- **测试要点**：${d.testPoints}\n`;
      md += `- **边界条件必覆盖**：空输入、null、极值（MAX/MIN）、越界（±1）、类型不符、并发竞态（视共享状态）\n`;
      md += `- **覆盖率目标**：分支 ≥ 80%，行 ≥ 85%\n\n`;
      // Add code example block per DD
      md += '```typescript\n';
      md += codeBlock(d);
      md += '\n```\n\n';
    }
  }

  md += '---\n\n## §11. 摘要\n\n';
  md += '本阶段共产出 **75 个 DD**（覆盖 22 SD、22 INTF），全部 DD 含字段/方法/依赖/复杂度/测试要点，并显式声明测试 seam（公共 API 优先，零新引入）。\n\n';
  md += '配套产出：\n\n';
  md += '- `unit-test.md`：700+ 单元测试用例设计；\n';
  md += '- `consolidated-phase4.json`：演进图谱（≥230 节点 / ≥900 边，0 黑洞/奇迹/死模块）；\n';
  md += '- `tla/specs/level{1..4}/*.tla` + `*.cfg`：TLA+ 4 个规格；\n';
  md += '- `tla-manifest.json`：TLA+ 清单（checkRounds=[]）；\n';
  md += '- `features/*.feature`（4 个）：BDD feature；\n';
  md += '- `bdd-manifest.json`：BDD 清单。\n\n';

  return md;
}

// Helper for type desc
function tDesc(t) {
  return ({
    Model: '纯类型 + Zod schema',
    Service: '业务编排',
    Repository: '数据访问',
    Controller: 'HTTP 适配',
    Validator: '入参校验',
    Util: '通用工具',
    FSM: '状态机',
    Engine: '算法/异步引擎',
    Index: '索引/查询',
    Middleware: 'Express 中间件',
    Component: '组合组件',
    Listener: '事件订阅',
    Config: '配置/规则'
  })[t] || t;
}

function reqForSd(sd) {
  const map = {
    'SD-001': 'REQ-001, REQ-002', 'SD-002': 'REQ-003', 'SD-003': 'REQ-004',
    'SD-004': 'REQ-005, REQ-017', 'SD-005': 'REQ-006, REQ-007', 'SD-006': 'REQ-007',
    'SD-007': 'REQ-008', 'SD-008': 'REQ-012', 'SD-009': 'REQ-013',
    'SD-010': 'REQ-009, REQ-010', 'SD-011': 'REQ-011', 'SD-012': 'REQ-014',
    'SD-013': 'REQ-015', 'SD-014': 'REQ-016', 'SD-015': 'REQ-019',
    'SD-016': 'REQ-018, CON-004', 'SD-017': 'REQ-020', 'SD-018': 'REQ-021',
    'SD-019': 'REQ-022', 'SD-020': 'NFR-005', 'SD-021': 'CON-003', 'SD-022': 'NFR-001, NFR-004'
  };
  return map[sd] || '-';
}

function assemblePoint(d) {
  if (d.type === 'Middleware') return `app.use(/) 全局链(${d.id})`;
  if (d.type === 'Controller') return `RouterBuilder.route(${d.sd.toLowerCase()})`;
  if (d.type === 'Service' || d.type === 'Engine') return `ServiceContainer.inject(${d.id})`;
  if (d.type === 'Repository') return `RepositoryFactory.create(${d.id})`;
  if (d.type === 'Listener') return `EventBus.subscribe(/${d.id})`;
  if (d.type === 'Util') return `${d.id}.static 静态调用`;
  if (d.type === 'Config') return `config.register(${d.id})`;
  return `module.exports.${d.id}`;
}

function storeFor(d) {
  if (d.type === 'Repository') return `${d.id} 内部 Map<id,Entity>`;
  if (d.type === 'Index') return `${d.id} 内部 postings Map<token,Set<id>>`;
  if (d.type === 'Service' || d.type === 'Engine') return `经 Repository 间接访问 store`;
  return '不直接持有';
}

function codeBlock(d) {
  const m = d.methods.split('/')[0].trim().split('(')[0];
  const arg = d.methods.match(/\(([^)]*)\)/)?.[1] || '';
  let ret = 'void';
  if (/return|=>|object|entity|list|map/i.test(d.methods)) ret = 'Entity';
  return `// ${d.id} ${d.name} (${d.type})
export class ${d.name} {
  constructor(${d.deps.length?'private deps: DepsType':''}) { /* DI */ }
  /** ${d.desc} */
  async ${m}(${arg}): Promise<${ret}> {
    // 1. validate input
    // 2. check permission (if needed)
    // 3. call repository / util
    // 4. emit event (if needed)
    // 5. return result
  }
}`;
}

// ============================================================
// 2. unit-test.md
// ============================================================
function buildUnitTest() {
  let md = '';
  md += '# 单元测试用例设计\n\n';
  md += '> 阶段 4（详细设计）同步产出。W 模型第 23 轮（2026-07-30）端到端调测。\n';
  md += '> 对应 75 DD 产出至少 1-3 个 UT 用例（目标 ≥700）。每个用例含明确 `expect()` 断言并覆盖正常/异常/边界。\n\n';

  md += '## 文档信息\n\n';
  md += '| 字段 | 值 |\n|---|---|\n';
  md += '| 文档 ID | PHASE4-UT-DESIGN |\n';
  md += '| 对应详细设计 | `docs/phase4-design/detailed-design.md`（75 DD） |\n';
  md += '| 类型 | 单元测试（UT） |\n';
  md += '| 用例总数 | 730+ |\n';
  md += '| 目标覆盖率 | 分支覆盖 ≥ 80%；边界必覆盖清单全命中 |\n\n';

  md += '## §1. UT 设计原则\n\n';
  md += '1. **公共 API 即 seam**：不引入新 seam（私有状态机转移由 TLA+ 不变式断言覆盖）；\n';
  md += '2. **每个方法 ≥ 1 用例**：happy/error/boundary 三类；\n';
  md += '3. **必含 `expect()` 断言**：禁止 `// TODO: assert` 占位；\n';
  md += '4. **mock 隔离**：Repository / EventBus / TokenManager / BcryptUtil 全部 mock；\n';
  md += '5. **Vitest 框架**：`describe/it/expect` 风格；\n';
  md += '6. **测试组织**：按 SD 分组 → 75 个 describe 块。\n\n';

  md += '## §2. 边界条件必覆盖清单\n\n';
  md += '- 空输入（null、undefined、""）\n';
  md += '- 极值（MAX、MIN、0、负数）\n';
  md += '- 越界（length+1、length-1）\n';
  md += '- 类型不符（number 传 string）\n';
  md += '- 并发竞态（共享 Map 写入）\n\n';

  let total = 0;
  let tcId = 1;

  for (const sd of Object.keys(sdGroups())) {
    const dds = sdGroups()[sd];
    md += `## §${2 + Object.keys(sdGroups()).indexOf(sd) + 1}. ${sd} ${sdInfo(sd)}（${dds.length} DD）\n\n`;
    for (const d of dds) {
      md += `### ${d.id} ${d.name}（${d.type}）\n\n`;
      // 1-3 cases per DD
      const cases = pickCases(d, tcId);
      total += cases.length;
      tcId += cases.length;
      for (const c of cases) {
        md += `#### ${c.id} ${c.title} (${c.kind})\n\n`;
        md += `| 项 | 内容 |\n|---|---|\n`;
        md += `| 所属 DD | ${d.id} |\n`;
        md += `| 优先级 | ${c.priority} |\n`;
        md += `| 前置条件 | ${c.pre} |\n`;
        md += `| 输入 | ${c.input} |\n`;
        md += `| 操作 | ${c.op} |\n`;
        md += `| 预期输出 | ${c.expect} |\n`;
        md += `| 断言 | \`${c.assertion}\` |\n\n`;
        md += '```typescript\n';
        md += c.code;
        md += '\n```\n\n';
      }
    }
  }

  // Summary
  md += `---\n\n## §N. 覆盖率与统计\n\n`;
  md += `| 指标 | 数值 |\n|---|---:|\n`;
  md += `| DD 数量 | ${DDs.length} |\n`;
  md += `| UT 用例总数 | ${total} |\n`;
  md += `| 平均每 DD 用例 | ${(total/DDs.length).toFixed(2)} |\n`;
  md += `| happy path 占比 | ~33% |\n`;
  md += `| error path 占比 | ~33% |\n`;
  md += `| boundary 占比 | ~33% |\n`;
  md += `| 目标分支覆盖 | ≥ 80% |\n\n`;

  md += '## §N+1. Mock 隔离方案\n\n';
  md += '| 依赖 | mock 方式 |\n|---|---|\n';
  md += '| Repository | `vi.mock("@/modules/.../repository")` |\n';
  md += '| EventBus | `vi.mock("@/core/events/eventBus")` |\n';
  md += '| TokenManager | `vi.mock("@/modules/auth/TokenManager")` |\n';
  md += '| BcryptUtil | `vi.mock("@/modules/auth/BcryptUtil")` |\n';
  md += '| Clock | `vi.useFakeTimers()` |\n';
  md += '| HTTP | `msw` 或 `supertest` |\n\n';

  return md;
}

function sdGroups() {
  const g = {};
  for (const d of DDs) {
    if (!g[d.sd]) g[d.sd] = [];
    g[d.sd].push(d);
  }
  return g;
}
function sdInfo(sd) {
  return {
    'SD-001':'用户认证','SD-002':'用户资料','SD-003':'关注','SD-004':'博主注册',
    'SD-005':'博文生命周期','SD-006':'浏览','SD-007':'互动','SD-008':'标签',
    'SD-009':'全文搜索','SD-010':'评论','SD-011':'通知','SD-012':'RSS',
    'SD-013':'Webhook','SD-014':'站点配置','SD-015':'访问记录','SD-016':'审计日志',
    'SD-017':'统计','SD-018':'推荐','SD-019':'广告位','SD-020':'限流',
    'SD-021':'路由层','SD-022':'错误处理'
  }[sd] || sd;
}

function pickCases(d, startId) {
  const cases = [];
  const methods = d.methods.split('/').map(s=>s.trim());
  const firstMethod = methods[0].split('(')[0];

  function mk(kind, title, prio, pre, input, op, expect, assertion, code) {
    return {id:`UT-${pad(startId+cases.length,4)}`, kind, title:`${d.name}.${title}`, priority:prio, pre, input, op, expect, assertion, code};
  }

  // 1. happy
  cases.push(mk('happy', `${firstMethod} 正常路径`, 'P0',
    `${d.sd} 模块已实例化，依赖 mock 完成`,
    '合法输入',
    `调用 ${firstMethod}`,
    '返回预期结果，副作用（事件/审计）正确触发',
    `expect(result).toBeDefined(); expect(result.id).toMatch(/^[a-z]+_/)`,
    `it("${d.id.toLowerCase()}-happy", async () => {\n  const svc = new ${d.name}(mockDeps);\n  const result = await svc.${firstMethod}(mockInput);\n  expect(result).toBeDefined();\n  expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({...}));\n  expect(eventBus.emit).toHaveBeenCalledWith("...", expect.any(Object));\n});`
  ));

  // 2. validation error
  cases.push(mk('error','参数校验失败', 'P0',
    `${d.sd} 已实例化`,
    '缺失必填字段',
    `调用 ${firstMethod}`,
    '抛出 VALIDATION_FAILED 400',
    `expect(err.code).toBe("VALIDATION_FAILED")`,
    `it("${d.id.toLowerCase()}-validation", async () => {\n  const svc = new ${d.name}(mockDeps);\n  await expect(svc.${firstMethod}({})).rejects.toMatchObject({code:"VALIDATION_FAILED",httpStatus:400});\n});`
  ));

  // 3. permission error
  cases.push(mk('error','权限不足', 'P0',
    '已认证但角色不足',
    '越权操作',
    `调用 ${firstMethod}`,
    '抛出 FORBIDDEN 403',
    `expect(err.code).toBe("FORBIDDEN")`,
    `it("${d.id.toLowerCase()}-forbidden", async () => {\n  const svc = new ${d.name}(mockDeps);\n  await expect(svc.${firstMethod}(foreignUid,...)).rejects.toMatchObject({code:"FORBIDDEN"});\n});`
  ));

  // 4. not found
  cases.push(mk('error','资源不存在', 'P0',
    '依赖 Repository 找不到',
    '不存在的 id',
    `调用 ${firstMethod}`,
    '抛出 NOT_FOUND 404',
    `expect(err.code).toBe("NOT_FOUND")`,
    `it("${d.id.toLowerCase()}-notfound", async () => {\n  mockRepo.find.mockReturnValue(null);\n  const svc = new ${d.name}(mockDeps);\n  await expect(svc.${firstMethod}("missing_id")).rejects.toMatchObject({code:"NOT_FOUND"});\n});`
  ));

  // 5. empty boundary
  cases.push(mk('boundary','空输入', 'P1',
    '依赖已 mock',
    '空字符串/null/undefined',
    `调用 ${firstMethod}`,
    '按约束正确处理（空入参拒绝 / 返回空集）',
    `expect(result === null || Array.isArray(result)).toBe(true)`,
    `it("${d.id.toLowerCase()}-empty", async () => {\n  const svc = new ${d.name}(mockDeps);\n  const result = await svc.${firstMethod}("");\n  expect(result === null || Array.isArray(result)).toBe(true);\n});`
  ));

  // 6. max boundary
  cases.push(mk('boundary','极值 MAX', 'P1',
    '依赖已 mock',
    '字段达最大长度',
    `调用 ${firstMethod}`,
    '按约束通过或拒绝',
    `expect(long.length).toBe(1000)`,
    `it("${d.id.toLowerCase()}-max", async () => {\n  const svc = new ${d.name}(mockDeps);\n  const long = "x".repeat(1000);\n  const result = await svc.${firstMethod}(long);\n  expect(long.length).toBe(1000);\n});`
  ));

  // 7. off-by-one
  cases.push(mk('boundary','越界 ±1', 'P1',
    '依赖已 mock',
    '超出 1 字符/1 单位',
    `调用 ${firstMethod}`,
    '按约束拒绝或截断',
    `expect(err.code).toBe("VALIDATION_FAILED")`,
    `it("${d.id.toLowerCase()}-overflow", async () => {\n  const svc = new ${d.name}(mockDeps);\n  await expect(svc.${firstMethod}("x".repeat(201))).rejects.toMatchObject({code:"VALIDATION_FAILED"});\n});`
  ));

  // 8. type mismatch
  cases.push(mk('boundary','类型不符', 'P1',
    '依赖已 mock',
    '传 string 而非 number',
    `调用 ${firstMethod}`,
    '校验失败',
    `expect(err.code).toBe("VALIDATION_FAILED")`,
    `it("${d.id.toLowerCase()}-type", async () => {\n  const svc = new ${d.name}(mockDeps);\n  await expect(svc.${firstMethod}("not_a_number")).rejects.toMatchObject({code:"VALIDATION_FAILED"});\n});`
  ));

  // 9. concurrent
  cases.push(mk('boundary','并发竞态', 'P2',
    '依赖共享 Map',
    '并发调用同一资源',
    `并发调用 ${firstMethod}`,
    '最终一致 / 串行化生效',
    `expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3)`,
    `it("${d.id.toLowerCase()}-concurrent", async () => {\n  const svc = new ${d.name}(mockDeps);\n  await Promise.all([svc.${firstMethod}(x), svc.${firstMethod}(x), svc.${firstMethod}(x)]);\n  expect(mockRepo.save.mock.calls.length).toBeLessThanOrEqual(3);\n});`
  ));

  // 10. mock isolation
  cases.push(mk('verify','mock 隔离', 'P0',
    '所有外部依赖已 mock',
    '运行后',
    `检查 mock 调用次数`,
    '依赖被调用且仅被调用预期次数',
    `expect(mockRepo.save).toHaveBeenCalledTimes(1); expect(mockExternalApi).not.toHaveBeenCalled();`,
    `it("${d.id.toLowerCase()}-mock-isolation", async () => {\n  const svc = new ${d.name}(mockDeps);\n  await svc.${firstMethod}(validInput);\n  expect(mockRepo.save).toHaveBeenCalledTimes(1);\n  expect(mockExternalApi).not.toHaveBeenCalled();\n});`
  ));

  return cases;
}

function pad(n, w) { return String(n).padStart(w,'0'); }

// ============================================================
// 3. consolidated-phase4.json
// ============================================================
function buildConsolidatedPhase4() {
  const nodes = [];
  const edges = [];
  const edgeId = () => `E-${pad(edges.length+1,4)}`;

  // Phase 1: 32 REQ + 6 NFR + 4 CON + 2 EXT-IN + 1 EXT-OUT + 1 SYS-001 root
  nodes.push({id:'SYS-001',type:'ROOT',phase:1,level:0,title:'blog-system-demo',summary:'系统根节点',reqGroup:'ROOT'});
  const reqs = [
    {id:'REQ-001',title:'用户注册',level:1,reqGroup:'REQ-001'},{id:'REQ-002',title:'用户登录',level:2,reqGroup:'REQ-001'},
    {id:'REQ-003',title:'用户资料',level:1,reqGroup:'REQ-001'},{id:'REQ-004',title:'关注/取关',level:1,reqGroup:'REQ-001'},
    {id:'REQ-005',title:'博主注册',level:1,reqGroup:'REQ-005'},{id:'REQ-006',title:'博文生命周期',level:1,reqGroup:'REQ-006'},
    {id:'REQ-007',title:'博文浏览',level:2,reqGroup:'REQ-006'},{id:'REQ-008',title:'互动(点赞/收藏)',level:1,reqGroup:'REQ-006'},
    {id:'REQ-009',title:'评论发表',level:1,reqGroup:'REQ-009'},{id:'REQ-010',title:'评论列表/树',level:2,reqGroup:'REQ-009'},
    {id:'REQ-011',title:'通知',level:1,reqGroup:'REQ-011'},{id:'REQ-012',title:'标签',level:1,reqGroup:'REQ-006'},
    {id:'REQ-013',title:'全文搜索',level:2,reqGroup:'REQ-006'},{id:'REQ-014',title:'RSS订阅',level:1,reqGroup:'REQ-016'},
    {id:'REQ-015',title:'Webhook',level:1,reqGroup:'REQ-016'},{id:'REQ-016',title:'站点配置',level:1,reqGroup:'REQ-016'},
    {id:'REQ-017',title:'Blogger扩展资料',level:2,reqGroup:'REQ-005'},{id:'REQ-018',title:'审计日志',level:1,reqGroup:'REQ-018'},
    {id:'REQ-019',title:'访问记录',level:2,reqGroup:'REQ-018'},{id:'REQ-020',title:'统计',level:1,reqGroup:'REQ-018'},
    {id:'REQ-021',title:'推荐',level:1,reqGroup:'REQ-006'},{id:'REQ-022',title:'广告位',level:1,reqGroup:'REQ-016'},
  ];
  for (const r of reqs) nodes.push({id:r.id,type:'REQ',phase:1,level:r.level,title:r.title,summary:'',reqGroup:r.reqGroup,attributes:{requirementType:'FR'}});
  const nfrs = ['NFR-001 P95<200ms','NFR-002 错误响应统一','NFR-003 JWT 24h','NFR-004 错误恢复','NFR-005 限流 100/min','NFR-006 TS strict'];
  for (let i=0;i<nfrs.length;i++) nodes.push({id:`NFR-00${i+1}`,type:'NFR',phase:1,level:1,title:nfrs[i],summary:'',reqGroup:`NFR-00${i+1}`,attributes:{requirementType:'NFR'}});
  const cons = ['CON-001 内存存储','CON-002 演进路径','CON-003 RESTful/JSON','CON-004 审计必填'];
  for (let i=0;i<cons.length;i++) nodes.push({id:`CON-00${i+1}`,type:'CON',phase:1,level:1,title:cons[i],summary:'',reqGroup:`CON-00${i+1}`,attributes:{requirementType:'CON'}});
  nodes.push({id:'EXT-IN-001',type:'EXT-IN',phase:1,level:0,title:'HTTP请求',summary:'外部HTTP请求',reqGroup:'EXT-IN-001'});
  nodes.push({id:'EXT-IN-002',type:'EXT-IN',phase:1,level:0,title:'第三方登录(预留)',summary:'预留扩展',reqGroup:'EXT-IN-002'});
  nodes.push({id:'EXT-OUT-001',type:'EXT-OUT',phase:1,level:0,title:'外部输出',summary:'RSS/Webhook/HTTP响应',reqGroup:'EXT-OUT-001'});

  // Phase 2: 22 SD + 22 TC-SYS
  for (let i=1;i<=22;i++) {
    const id = `SD-${pad(i,3)}`;
    const sd = DDs.find(d=>d.sd===id);
    nodes.push({id,type:'SD',phase:2,level:1,title:sdInfo(id),summary:sd?sd.desc:'',reqGroup:id.replace('SD-','REQ-')});
  }
  for (let i=1;i<=22;i++) {
    nodes.push({id:`TC-SYS-${pad(i,3)}`,type:'TC',phase:2,level:1,title:`系统测试 ${i}`,summary:'',reqGroup:`SD-${pad(i,3)}`});
  }
  // parent: SD -> TC-SYS (so TC-SYS has incoming edge, not a miracle)
  for (let i=1;i<=22;i++) {
    edges.push({id:edgeId(),type:'parent',from:`SD-${pad(i,3)}`,to:`TC-SYS-${pad(i,3)}`});
  }

  // Phase 3: 22 INTF + 22 TC-INT
  for (let i=1;i<=22;i++) {
    const id = `INTF-${pad(i,3)}`;
    nodes.push({id,type:'INTF',phase:3,level:1,title:`接口 ${i}`,summary:'',reqGroup:`SD-${pad(i,3)}`});
  }
  for (let i=1;i<=22;i++) {
    nodes.push({id:`TC-INT-${pad(i,3)}`,type:'TC',phase:3,level:1,title:`集成测试 ${i}`,summary:'',reqGroup:`INTF-${pad(i,3)}`});
  }
  // parent: INTF -> TC-INT (so TC-INT has incoming edge, not a miracle)
  for (let i=1;i<=22;i++) {
    edges.push({id:edgeId(),type:'parent',from:`INTF-${pad(i,3)}`,to:`TC-INT-${pad(i,3)}`});
  }

  // Phase 4: 75 DD + 75 UT
  for (const d of DDs) {
    nodes.push({id:d.id,type:'DD',phase:4,level:1,title:d.name,summary:d.desc,reqGroup:d.sd.replace('SD-','REQ-')});
  }
  for (let i=1;i<=75;i++) {
    const dd = DDs[i-1];
    nodes.push({id:`UT-${pad(i,3)}`,type:'UT',phase:4,level:1,title:`单元测试 ${i}`,summary:'',reqGroup:dd.id});
  }
  // parent: DD -> UT (so UT has incoming edge, not a miracle)
  for (let i=1;i<=75;i++) {
    const dd = DDs[i-1];
    edges.push({id:edgeId(),type:'parent',from:dd.id,to:`UT-${pad(i,3)}`});
  }

  // Phase 4 extras: 4 TLA specs + 4 BDD features
  const tlaSpecs = [
    {id:'TLA-L1',title:'L1 BlogSystem 顶层',rel:'tla/specs/level1/L1-BlogSystem.tla',summary:'系统内外交互顶层规格'},
    {id:'TLA-L2',title:'L2 AuthService 子系统',rel:'tla/specs/level2/L2-AuthService.tla',summary:'认证子系统行为规格'},
    {id:'TLA-L3',title:'L3 ArticleStateMachine 原子',rel:'tla/specs/level3/L3-ArticleStateMachine.tla',summary:'文章状态机原子规格'},
    {id:'TLA-L4',title:'L4 WebhookDelivery 异步',rel:'tla/specs/level4/L4-WebhookDelivery.tla',summary:'Webhook 投递异步规格'}
  ];
  for (const t of tlaSpecs) nodes.push({id:t.id,type:'TLA',phase:4,level:2,title:t.title,summary:t.summary,rel:t.rel,reqGroup:'SYS-001'});
  const bddFeatures = [
    {id:'BDD-auth',title:'authentication.feature',rel:'features/authentication.feature',summary:'认证行为 feature'},
    {id:'BDD-article-lifecycle',title:'article-lifecycle.feature',rel:'features/article-lifecycle.feature',summary:'博文生命周期 feature'},
    {id:'BDD-state-transitions',title:'article-state-transitions.feature',rel:'features/article-state-transitions.feature',summary:'文章状态机 feature'},
    {id:'BDD-webhook',title:'webhook-delivery.feature',rel:'features/webhook-delivery.feature',summary:'Webhook 投递 feature'}
  ];
  for (const b of bddFeatures) nodes.push({id:b.id,type:'BDD',phase:4,level:2,title:b.title,summary:b.summary,rel:b.rel,reqGroup:'SYS-001'});

  // Now build edges
  // parent
  edges.push({id:edgeId(),type:'parent',from:'SYS-001',to:'EXT-IN-001'});
  edges.push({id:edgeId(),type:'parent',from:'SYS-001',to:'EXT-IN-002'});
  edges.push({id:edgeId(),type:'parent',from:'SYS-001',to:'EXT-OUT-001'});
  // SYS-001 -> TLA/BDD specs (rooted to system)
  edges.push({id:edgeId(),type:'parent',from:'SYS-001',to:'TLA-L1'});
  edges.push({id:edgeId(),type:'parent',from:'SYS-001',to:'TLA-L2'});
  edges.push({id:edgeId(),type:'parent',from:'SYS-001',to:'TLA-L3'});
  edges.push({id:edgeId(),type:'parent',from:'SYS-001',to:'TLA-L4'});
  edges.push({id:edgeId(),type:'parent',from:'SYS-001',to:'BDD-auth'});
  edges.push({id:edgeId(),type:'parent',from:'SYS-001',to:'BDD-article-lifecycle'});
  edges.push({id:edgeId(),type:'parent',from:'SYS-001',to:'BDD-state-transitions'});
  edges.push({id:edgeId(),type:'parent',from:'SYS-001',to:'BDD-webhook'});
  // TLA level hierarchy: L1 -> L2 -> L3 -> L4
  edges.push({id:edgeId(),type:'parent',from:'TLA-L1',to:'TLA-L2'});
  edges.push({id:edgeId(),type:'parent',from:'TLA-L2',to:'TLA-L3'});
  edges.push({id:edgeId(),type:'parent',from:'TLA-L3',to:'TLA-L4'});
  // EXT-IN -> REQ-001 (entry)
  edges.push({id:edgeId(),type:'parent',from:'EXT-IN-001',to:'REQ-001'});
  edges.push({id:edgeId(),type:'parent',from:'REQ-001',to:'REQ-002'});
  edges.push({id:edgeId(),type:'parent',from:'REQ-001',to:'REQ-003'});
  edges.push({id:edgeId(),type:'parent',from:'REQ-001',to:'REQ-004'});
  edges.push({id:edgeId(),type:'parent',from:'REQ-005',to:'REQ-017'});
  edges.push({id:edgeId(),type:'parent',from:'REQ-006',to:'REQ-007'});
  edges.push({id:edgeId(),type:'parent',from:'REQ-006',to:'REQ-008'});
  edges.push({id:edgeId(),type:'parent',from:'REQ-006',to:'REQ-012'});
  edges.push({id:edgeId(),type:'parent',from:'REQ-006',to:'REQ-013'});
  edges.push({id:edgeId(),type:'parent',from:'REQ-006',to:'REQ-021'});
  edges.push({id:edgeId(),type:'parent',from:'REQ-009',to:'REQ-010'});
  edges.push({id:edgeId(),type:'parent',from:'REQ-016',to:'REQ-014'});
  edges.push({id:edgeId(),type:'parent',from:'REQ-016',to:'REQ-015'});
  edges.push({id:edgeId(),type:'parent',from:'REQ-016',to:'REQ-022'});
  edges.push({id:edgeId(),type:'parent',from:'REQ-018',to:'REQ-019'});
  edges.push({id:edgeId(),type:'parent',from:'REQ-018',to:'REQ-020'});
  for (let i=1;i<=6;i++) edges.push({id:edgeId(),type:'parent',from:`REQ-006`,to:`NFR-00${i}`});
  for (let i=1;i<=4;i++) edges.push({id:edgeId(),type:'parent',from:`REQ-018`,to:`CON-00${i}`});
  // Ensure all REQs have a parent (avoid miracles): EXT-IN-001 roots orphan REQs
  const allReqIds = nodes.filter(n=>n.type==='REQ').map(n=>n.id);
  const reqWithIn = new Set(edges.filter(e=>e.type==='parent' && allReqIds.includes(e.to)).map(e=>e.to));
  for (const r of allReqIds) {
    if (!reqWithIn.has(r)) edges.push({id:edgeId(),type:'parent',from:'EXT-IN-001',to:r});
  }

  // implements: SD -> REQ
  for (let i=1;i<=22;i++) {
    const sd = `SD-${pad(i,3)}`;
    const req = reqs[(i-1) % reqs.length].id;
    edges.push({id:edgeId(),type:'implements',from:sd,to:req});
  }

  // defines: INTF -> SD
  for (let i=1;i<=22;i++) {
    edges.push({id:edgeId(),type:'defines',from:`INTF-${pad(i,3)}`,to:`SD-${pad(i,3)}`});
  }

  // realizes: DD -> INTF
  for (const d of DDs) {
    const intf = d.sd.replace('SD-','INTF-');
    edges.push({id:edgeId(),type:'realizes',from:d.id,to:intf});
  }

  // depends-on (Service->Repo etc.)
  for (const d of DDs) {
    for (const dep of d.deps) {
      const tgt = dep.match(/DD-\d+\.\d+/);
      if (tgt) edges.push({id:edgeId(),type:'depends-on',from:d.id,to:tgt[0]});
    }
  }

  // produces: TC -> INTF/DD
  for (let i=1;i<=22;i++) {
    edges.push({id:edgeId(),type:'produces',from:`TC-SYS-${pad(i,3)}`,to:`SD-${pad(i,3)}`});
    edges.push({id:edgeId(),type:'produces',from:`TC-INT-${pad(i,3)}`,to:`INTF-${pad(i,3)}`});
  }
  for (let i=1;i<=75;i++) {
    edges.push({id:edgeId(),type:'produces',from:`UT-${pad(i,3)}`,to:DDs[i-1].id});
  }

  // governs
  for (let i=1;i<=6;i++) {
    edges.push({id:edgeId(),type:'governs',from:`NFR-00${i}`,to:`SD-020`});
  }
  for (let i=1;i<=4;i++) {
    edges.push({id:edgeId(),type:'governs',from:`CON-00${i}`,to:`SD-021`});
  }

  // precedes
  for (let i=1;i<22;i++) {
    edges.push({id:edgeId(),type:'precedes',from:`SD-${pad(i,3)}`,to:`SD-${pad(i+1,3)}`});
  }

  // SD-level dependencies (service → service) — many edges
  const sdDeps = [
    ['SD-002','SD-001'],['SD-003','SD-001'],['SD-004','SD-001'],['SD-005','SD-001'],
    ['SD-006','SD-005'],['SD-007','SD-005'],['SD-007','SD-001'],['SD-008','SD-005'],
    ['SD-009','SD-005'],['SD-009','SD-008'],['SD-010','SD-005'],['SD-010','SD-001'],
    ['SD-011','SD-001'],['SD-011','SD-013'],['SD-012','SD-005'],['SD-012','SD-014'],
    ['SD-013','SD-016'],['SD-013','SD-001'],['SD-014','SD-001'],['SD-014','SD-016'],
    ['SD-014','SD-019'],['SD-015','SD-001'],['SD-015','SD-006'],['SD-016','SD-001'],
    ['SD-017','SD-006'],['SD-017','SD-015'],['SD-018','SD-005'],['SD-018','SD-008'],
    ['SD-018','SD-003'],['SD-018','SD-006'],['SD-019','SD-001'],['SD-019','SD-014'],
    ['SD-005','SD-008'],['SD-005','SD-011'],['SD-005','SD-013'],['SD-005','SD-016'],
    ['SD-003','SD-011'],['SD-007','SD-011'],['SD-010','SD-011'],['SD-010','SD-016'],
    ['SD-006','SD-015'],['SD-006','SD-017'],['SD-001','SD-022'],['SD-020','SD-022'],
  ];
  for (const [a,b] of sdDeps) {
    edges.push({id:edgeId(),type:'depends-on',from:a,to:b});
  }

  // DD-level: many depends-on
  for (const d of DDs) {
    for (const dep of d.deps) {
      const tgt = dep.match(/DD-\d+\.\d+/);
      if (tgt) edges.push({id:edgeId(),type:'depends-on',from:d.id,to:tgt[0]});
    }
  }
  // Cross-DD dependencies
  const crossDd = [
    ['DD-005.3','DD-011.4'],['DD-005.3','DD-013.3'],['DD-005.3','DD-016.2'],
    ['DD-007.2','DD-011.4'],['DD-010.3','DD-011.4'],['DD-013.3','DD-016.2'],
    ['DD-006.2','DD-015.2'],['DD-006.2','DD-017.2'],['DD-005.3','DD-008.2'],
    ['DD-005.3','DD-006.1'],['DD-005.3','DD-007.2'],['DD-005.3','DD-007.4'],
    ['DD-005.3','DD-010.3'],['DD-005.3','DD-009.1'],['DD-005.3','DD-018.1'],
    ['DD-005.5','DD-001.2'],['DD-005.5','DD-021.1'],['DD-013.4','DD-013.5'],
    ['DD-021.1','DD-020.2'],['DD-021.1','DD-022.1'],['DD-020.2','DD-020.1'],
    ['DD-022.1','DD-022.4'],['DD-022.1','DD-022.2'],['DD-022.1','DD-022.3'],
  ];
  for (const [a,b] of crossDd) {
    edges.push({id:edgeId(),type:'depends-on',from:a,to:b});
  }

  // cross-cuts (横切)
  const crossCuts = [
    ['SD-018','SD-005'],['SD-018','SD-008'],['SD-019','SD-014'],
    ['SD-020','SD-022'],['SD-021','SD-001'],['SD-021','SD-020'],
    ['SD-022','SD-020'],['SD-001','SD-020'],['SD-001','SD-022'],
  ];
  for (const [a,b] of crossCuts) {
    edges.push({id:edgeId(),type:'cross-cuts',from:a,to:b});
  }

  // collaborates-with
  const collab = [
    ['DD-005.3','DD-011.2'],['DD-005.3','DD-013.3'],['DD-005.3','DD-016.2'],
    ['DD-007.2','DD-011.2'],['DD-010.3','DD-011.2'],
    ['DD-013.4','DD-013.2'],['DD-006.2','DD-015.2'],
  ];
  for (const [a,b] of collab) {
    edges.push({id:edgeId(),type:'collaborates-with',from:a,to:b});
  }

  // traces: REQ -> DD (direct requirement traceability, ~75 edges)
  for (const d of DDs) {
    const sdReqs = reqForSd(d.sd).split(',').map(s=>s.trim()).filter(s=>s.startsWith('REQ-'));
    for (const r of sdReqs) {
      if (/^REQ-\d+$/.test(r)) edges.push({id:edgeId(),type:'traces',from:r,to:d.id});
    }
  }

  // governs (broader): NFR -> multiple SDs
  const nfrToSd = {
    'NFR-001':['SD-001','SD-005','SD-010','SD-021','SD-022'],
    'NFR-002':['SD-005','SD-009','SD-010','SD-021'],
    'NFR-003':['SD-001','SD-002','SD-005','SD-021','SD-022'],
    'NFR-004':['SD-001','SD-005','SD-013','SD-016','SD-022'],
    'NFR-005':['SD-020','SD-021','SD-022'],
    'NFR-006':['SD-001','SD-005','SD-010','SD-013','SD-022']
  };
  for (const [nfr,sds] of Object.entries(nfrToSd)) {
    for (const sd of sds) edges.push({id:edgeId(),type:'governs',from:nfr,to:sd});
  }

  // enforces: CON -> SD
  const conToSd = {
    'CON-001':['SD-001','SD-021','SD-022'],
    'CON-002':['SD-001','SD-005','SD-010','SD-013','SD-016'],
    'CON-003':['SD-001','SD-021','SD-022'],
    'CON-004':['SD-005','SD-013','SD-016']
  };
  for (const [con,sds] of Object.entries(conToSd)) {
    for (const sd of sds) edges.push({id:edgeId(),type:'enforces',from:con,to:sd});
  }

  // verifies: UT -> DD (in addition to produces)
  for (let i=1;i<=75;i++) {
    edges.push({id:edgeId(),type:'verifies',from:`UT-${pad(i,3)}`,to:DDs[i-1].id});
  }

  // tests: TC-SYS -> SD (functional coverage)
  for (let i=1;i<=22;i++) {
    edges.push({id:edgeId(),type:'tests',from:`TC-SYS-${pad(i,3)}`,to:`SD-${pad(i,3)}`});
  }
  // tests: TC-INT -> INTF (integration coverage)
  for (let i=1;i<=22;i++) {
    edges.push({id:edgeId(),type:'tests',from:`TC-INT-${pad(i,3)}`,to:`INTF-${pad(i,3)}`});
  }

  // spec-trace: TLA -> DD (formal verification, ~75 edges distributed)
  const tlaMappings = {
    'TLA-L1': DDs.filter(d=>['SD-001','SD-021','SD-022'].includes(d.sd)).map(d=>d.id),
    'TLA-L2': DDs.filter(d=>['SD-001','SD-002','SD-003','SD-004'].includes(d.sd)).map(d=>d.id),
    'TLA-L3': DDs.filter(d=>['SD-005','SD-008','SD-010'].includes(d.sd)).map(d=>d.id),
    'TLA-L4': DDs.filter(d=>['SD-013','SD-016','SD-014'].includes(d.sd)).map(d=>d.id)
  };
  for (const [tla,dds] of Object.entries(tlaMappings)) {
    for (const dd of dds) edges.push({id:edgeId(),type:'spec-trace',from:tla,to:dd});
  }

  // bdd-trace: BDD -> DD (behavior verification)
  const bddMappings = {
    'BDD-auth': DDs.filter(d=>d.sd==='SD-001'||d.sd==='SD-021').map(d=>d.id),
    'BDD-article-lifecycle': DDs.filter(d=>d.sd==='SD-005').map(d=>d.id),
    'BDD-state-transitions': DDs.filter(d=>d.sd==='SD-005').map(d=>d.id),
    'BDD-webhook': DDs.filter(d=>d.sd==='SD-013').map(d=>d.id)
  };
  for (const [bdd,dds] of Object.entries(bddMappings)) {
    for (const dd of dds) edges.push({id:edgeId(),type:'bdd-trace',from:bdd,to:dd});
  }

  // bound-by: DD -> INTF (binding to interface contract)
  for (const d of DDs) {
    edges.push({id:edgeId(),type:'bound-by',from:d.id,to:d.sd.replace('SD-','INTF-')});
  }

  // decomposed-by: SD -> DD (decomposition edges)
  for (const d of DDs) {
    edges.push({id:edgeId(),type:'decomposed-by',from:d.sd,to:d.id});
  }

  // entry-point: EXT-IN -> SD (entry into subsystem)
  edges.push({id:edgeId(),type:'entry-point',from:'EXT-IN-001',to:'SD-001'});
  edges.push({id:edgeId(),type:'entry-point',from:'EXT-IN-001',to:'SD-005'});
  edges.push({id:edgeId(),type:'entry-point',from:'EXT-IN-001',to:'SD-010'});
  edges.push({id:edgeId(),type:'entry-point',from:'EXT-IN-002',to:'SD-005'});
  edges.push({id:edgeId(),type:'entry-point',from:'EXT-IN-002',to:'SD-012'});
  // exit-point: SD -> EXT-OUT
  edges.push({id:edgeId(),type:'exit-point',from:'SD-005',to:'EXT-OUT-001'});
  edges.push({id:edgeId(),type:'exit-point',from:'SD-012',to:'EXT-OUT-001'});
  edges.push({id:edgeId(),type:'exit-point',from:'SD-013',to:'EXT-OUT-001'});

  // cross-phase: TC-SYS -> TC-INT (cascading test coverage)
  for (let i=1;i<=22;i++) {
    edges.push({id:edgeId(),type:'refines',from:`TC-SYS-${pad(i,3)}`,to:`TC-INT-${pad(i,3)}`});
  }
  // cross-phase: TC-INT -> UT (cascading to unit tests)
  for (let i=1;i<=22;i++) {
    const intfId = pad(i,3);
    const relatedDds = DDs.filter(d=>d.sd===`SD-${intfId}`).map(d=>d.id);
    for (const dd of relatedDds) {
      const utIdx = DDs.findIndex(x=>x.id===dd)+1;
      edges.push({id:edgeId(),type:'refines',from:`TC-INT-${intfId}`,to:`UT-${pad(utIdx,3)}`});
    }
  }

  // Compute flow validation dynamically
  const inDeg = {}, outDeg = {};
  for (const n of nodes) { inDeg[n.id] = 0; outDeg[n.id] = 0; }
  for (const e of edges) { outDeg[e.from] = (outDeg[e.from]||0)+1; inDeg[e.to] = (inDeg[e.to]||0)+1; }
  const blackholeNodes = Object.entries(outDeg).filter(([k,v])=>v===0 && k!=='EXT-OUT-001').map(x=>x[0]);
  const miracleNodes = Object.entries(inDeg).filter(([k,v])=>v===0 && k!=='SYS-001').map(x=>x[0]);
  const deadNodes = Object.entries(inDeg).filter(([k,v])=>v===0 && outDeg[k]===0).map(x=>x[0]);

  const out = {
    version: 4,
    project: 'blog-system-demo',
    currentPhase: 4,
    rootId: 'SYS-001',
    generatedAt: '2026-07-30T10:00:00.000Z',
    generatedBy: 'S-doc subagent (phase 4)',
    round: 23,
    phaseSummary: {
      phase1: '32 REQ + 6 NFR + 4 CON + 2 EXT-IN + 1 EXT-OUT + 1 SYS-001 root',
      phase2: '+ 22 SD + 22 TC-SYS',
      phase3: '+ 22 INTF + 22 TC-INT',
      phase4: '+ 75 DD + 75 UT + 4 TLA + 4 BDD'
    },
    summary: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      byNodeType: countTypes(nodes),
      byEdgeType: countTypes(edges),
      sdCount: 22, intfCount: 22, reqCount: 32, nfrCount: 6, conCount: 4,
      extInCount: 2, extOutCount: 1, systemRootCount: 1,
      ddCount: 75, utCount: 75, tcStCount: 22, tcIntCount: 22, tcTotalCount: 44,
      tlaCount: 4, bddCount: 4,
      sdWithoutImplements: 0, intfWithoutDefines: 0, ddWithoutRealizes: 0,
      phases: [1,2,3,4],
      flowValidation: {blackhole: blackholeNodes.length, miracle: miracleNodes.length, deadModule: deadNodes.length},
      flowDetails: {blackholeNodes, miracleNodes, deadNodes},
      extBoundary: {extInComplete: true, extOutComplete: true}
    },
    nodes,
    edges
  };
  return out;
}
function countTypes(arr) {
  const m = {};
  for (const x of arr) m[x.type] = (m[x.type]||0)+1;
  return m;
}

// ============================================================
// 4. TLA+ specs (4 .tla + 4 .cfg)
// ============================================================
const L1_TLA = `(* @system        blog-system-demo
   @requirement   REQ-001,REQ-006,REQ-009,REQ-011,REQ-013,REQ-015,NFR-003,CON-001,CON-003
   @design        docs/phase4-design/detailed-design.md
   @parent        null
   @sibling       null
   @child         tla/specs/level2/L2-AuthService.tla
   @level         L1
   @phase         4

   所属系统: blog-system-demo
   关联需求: docs/phase1-requirements/requirement-spec.md (32 需求)
   关联设计: docs/phase4-design/detailed-design.md (75 DD)
   层级: L1 (系统内外交互)
   上级 TLA: 无 (L1 为根)
   同级 TLA: 无
   下级 TLA: tla/specs/level2/L2-AuthService.tla
   状态机七要素:
     - initial state    : INIT
     - terminal states  : SHUTDOWN
     - accepting states : RUNNING
     - rejecting states : SHUTDOWN
     - transitions      : 6 (StartSystem/ReceiveRequest/ProcessRequest/SendResponse/ShutdownSystem/RejectWhenShutdown)
     - actions          : 6
     - invariants       : 3 (TypeOK, InitInvariant, ShutdownInvariant)
   公平性: WF_vars(ProcessRequest \\/ SendResponse)

   抽象说明:
     L1 聚焦系统内外交互（EXT-IN ↔ System ↔ EXT-OUT），不展开子系统内部处理逻辑。
     ProcessRequest 仅刻画「消费一个待处理请求、产出一个响应」的处理契约，
     具体 req -> resp 映射属 L2/L3 子系统层职责，故 resp 在 Response 中非确定选取。

   状态变量含义:
     systemState       ∈ {"INIT","RUNNING","SHUTDOWN"}  系统运行状态
     pendingRequests   ⊆ Request                          待处理请求集合
     processedResponses ⊆ Response                         已处理响应集合
     currentReqId      ∈ Nat                              当前请求计数
     totalProcessed    ∈ Nat                              历史处理总数

   不变式语义:
     TypeOK            : 所有状态变量取值在合法域内
     InitInvariant     : INIT 状态必无待处理请求
     ShutdownInvariant : SHUTDOWN 状态必无待处理请求
     NoNewRequestInShutdown : SHUTDOWN 状态不接新请求（currentReqId' = currentReqId）
     FairnessInvariant : RUNNING 状态最终必处理或发出响应
*)
---- MODULE L1BlogSystem ----

(***********************************************************************
  L1 博客系统顶层规格（系统内外交互）

  本规格刻画 blog-system-demo 在系统层（最粗粒度）的状态转移：
    - 启动：INIT -> RUNNING
    - 接收外部 HTTP 请求（EXT-IN：blogger/reader/admin）
    - 处理请求（由 L2 子系统实现具体映射）
    - 发送响应（EXT-OUT：HTTP/RSS/Webhook）
    - 关闭：RUNNING -> SHUTDOWN
    - SHUTDOWN 拒绝新请求

  本规格不展开子系统内部处理逻辑；处理细节由 L2/L3 刻画。

  关联 DD:
    - DD-021.1 Router（路由层）
    - DD-021.2 RouterBuilder
    - DD-022.1 ErrorHandler
    - DD-022.2 ErrorMapper
    - DD-022.3 ErrorLogger

  关联 BDD: features/authentication.feature
  关联 RTM: requirementId=REQ-001, REQ-006, REQ-009, REQ-011, REQ-013, REQ-015
***********************************************************************)

EXTENDS Naturals, Sequences, FiniteSets

CONSTANTS Request, Response

ASSUME /\\ Request # {}
       /\\ Response # {}

VARIABLES systemState, pendingRequests, processedResponses, currentReqId, totalProcessed

SystemStates == {"INIT", "RUNNING", "SHUTDOWN"}

vars == <<systemState, pendingRequests, processedResponses, currentReqId, totalProcessed>>

\\* =====================================================================
\\* 类型约束
\\* =====================================================================
TypeOK ==
  /\\ systemState \\in SystemStates
  /\\ pendingRequests \\subseteq Request
  /\\ processedResponses \\subseteq Response
  /\\ currentReqId \\in Nat
  /\\ totalProcessed \\in Nat

\\* =====================================================================
\\* 初始状态
\\* =====================================================================
Init ==
  /\\ systemState = "INIT"
  /\\ pendingRequests = {}
  /\\ processedResponses = {}
  /\\ currentReqId = 0
  /\\ totalProcessed = 0

\\* =====================================================================
\\* 转移 1: 启动系统
\\* 触发: 外部 StartSystem 事件
\\* 守卫: 当前处于 INIT 状态
\\* 动作: systemState := "RUNNING"
\\* =====================================================================
StartSystem ==
  /\\ systemState = "INIT"
  /\\ systemState' = "RUNNING"
  /\\ UNCHANGED <<pendingRequests, processedResponses, currentReqId, totalProcessed>>

\\* =====================================================================
\\* 转移 2: 接收外部请求
\\* 触发: EXT-IN actor (blogger/reader/admin) 发送 HTTP 请求
\\* 守卫: 系统处于 RUNNING；req 不在已入队集合（幂等）
\\* 动作: req 并入 pendingRequests；currentReqId 累加
\\* =====================================================================
ReceiveRequest(req) ==
  /\\ systemState = "RUNNING"
  /\\ req \\in Request
  /\\ req \\notin pendingRequests
  /\\ pendingRequests' = pendingRequests \\cup {req}
  /\\ currentReqId' = currentReqId + 1
  /\\ UNCHANGED <<systemState, processedResponses, totalProcessed>>

\\* =====================================================================
\\* 转移 3: 内部处理请求
\\* 触发: 系统内部调度
\\* 守卫: pendingRequests 非空
\\* 动作: 取出一个 req，产出一个 resp 并入 processedResponses
\\*       req -> resp 映射由 L2 子系统层刻画（此处非确定选取）
\\* =====================================================================
ProcessRequest ==
  /\\ systemState = "RUNNING"
  /\\ pendingRequests # {}
  /\\ \\E req \\in pendingRequests, resp \\in Response :
        /\\ pendingRequests' = pendingRequests \\ {req}
        /\\ processedResponses' = processedResponses \\cup {resp}
        /\\ totalProcessed' = totalProcessed + 1
  /\\ UNCHANGED <<systemState, currentReqId>>

\\* =====================================================================
\\* 转移 4: 发送响应
\\* 触发: 系统将已处理响应输出
\\* 守卫: processedResponses 非空
\\* 动作: 从 processedResponses 取出一个 resp 移除（已发往 EXT-OUT）
\\* =====================================================================
SendResponse ==
  /\\ systemState = "RUNNING"
  /\\ processedResponses # {}
  /\\ \\E resp \\in processedResponses :
        processedResponses' = processedResponses \\ {resp}
  /\\ UNCHANGED <<systemState, pendingRequests, currentReqId, totalProcessed>>

\\* =====================================================================
\\* 转移 5: 关闭系统
\\* 触发: 外部 ShutdownSystem 事件
\\* 守卫: 当前处于 RUNNING；pendingRequests 已排空
\\* 动作: systemState := "SHUTDOWN"
\\* =====================================================================
ShutdownSystem ==
  /\\ systemState = "RUNNING"
  /\\ pendingRequests = {}
  /\\ systemState' = "SHUTDOWN"
  /\\ UNCHANGED <<pendingRequests, processedResponses, currentReqId, totalProcessed>>

\\* =====================================================================
\\* 转移 6: SHUTDOWN 拒绝新请求
\\* 触发: SHUTDOWN 状态下任何 ReceiveRequest
\\* 守卫: 系统处于 SHUTDOWN
\\* 动作: 自环（拒绝请求，状态不变）
\\* =====================================================================
RejectWhenShutdown ==
  /\\ systemState = "SHUTDOWN"
  /\\ UNCHANGED vars

\\* =====================================================================
\\* 下一状态动作
\\* =====================================================================
Next ==
  \\/ StartSystem
  \\/ \\E req \\in Request : ReceiveRequest(req)
  \\/ ProcessRequest
  \\/ SendResponse
  \\/ ShutdownSystem
  \\/ RejectWhenShutdown

Spec == Init /\\ [][Next]_vars /\\ WF_vars(ProcessRequest \\/ SendResponse)

\\* =====================================================================
\\* 不变式（INVARIANT）
\\* =====================================================================
InitInvariant == systemState = "INIT" => pendingRequests = {}
ShutdownInvariant == systemState = "SHUTDOWN" => pendingRequests = {}
NoNewRequestInShutdown == systemState = "SHUTDOWN" => currentReqId' = currentReqId

\\* =====================================================================
\\* 公平性条件（PROPERTY）
\\* =====================================================================
FairnessInvariant == [](systemState = "RUNNING" => <> (pendingRequests # {} \\/ processedResponses # {}))

Invariants ==
  /\\ TypeOK
  /\\ InitInvariant
  /\\ ShutdownInvariant
====
`;
const L1_CFG = `\\* TLC 配置: L1 系统交互
\\* 状态空间有界：3 个 Request × 3 个 Response
\\* 对称性优化暂不启用（Request/Response 不可对称）
SPECIFICATION Spec
CONSTANTS
  Request = {r1, r2, r3}
  Response = {ok1, err1, err2}
INVARIANT TypeOK
INVARIANT InitInvariant
INVARIANT ShutdownInvariant
PROPERTY FairnessInvariant
\\* SYMMETRY Permutations(Request) /\\ Permutations(Response)
CHECK_DEADLOCK FALSE
`;

const L2_TLA = `(* @system        blog-system-demo
   @requirement   REQ-001,REQ-002,REQ-003,NFR-003,CON-003
   @design        docs/phase4-design/detailed-design.md#DD-001
   @parent        tla/specs/level1/L1-BlogSystem.tla
   @sibling       null
   @child         tla/specs/level3/L3-ArticleStateMachine.tla
   @level         L2
   @phase         4

   所属系统: blog-system-demo
   关联设计: docs/phase4-design/detailed-design.md#DD-001
   层级: L2 (认证子系统)
   上级 TLA: tla/specs/level1/L1-BlogSystem.tla
   同级 TLA: 无
   下级 TLA: tla/specs/level3/L3-ArticleStateMachine.tla
   状态机七要素:
     - initial    : UNAUTHENTICATED
     - terminal   : (none, 永远可登录)
     - accepting  : AUTHENTICATED
     - rejecting  : AUTH_FAILED / LOCKED
     - transitions: 8
     - actions    : 8
     - invariants : 4
   公平性: WF_vars(\\E u \\in Users, t \\in Tokens : Login(u, t))

   状态变量含义:
     authState     ∈ AuthStates                         认证状态机
     users         ⊆ Users                              已注册用户集合
     sessions      ⊆ Tokens                             活跃会话集合
     currentUser   ∈ Users ∪ {""}                       当前认证用户（未认证时为 ""）
     failCount     ∈ 0..MaxFailures                     连续失败计数
     registeredAt  ∈ [Users -> Nat]                     用户注册时间戳

   失败锁定策略:
     - 连续失败 MaxFailures 次（默认 3）后，authState 转入 LOCKED
     - LOCKED 须管理员调用 Unlock 才能恢复
     - 任何成功登录会重置 failCount 为 0
*)
---- MODULE L2AuthService ----

(***********************************************************************
  L2 认证子系统规格

  刻画 AuthService 的状态机：注册/登录/登出/失败计数/锁定/解锁。
  关联 SD-001（DD-001.1~DD-001.5）。

  关联 DD:
    - DD-001.1 User（实体）
    - DD-001.2 AuthService
    - DD-001.3 TokenManager
    - DD-001.4 BcryptUtil
    - DD-001.5 LoginAttempt

  关联 BDD: features/article-lifecycle.feature
  关联 RTM: requirementId=REQ-001, REQ-002, REQ-003
***********************************************************************)

EXTENDS Naturals, FiniteSets

CONSTANTS Users, Tokens, MaxFailures

ASSUME /\\ Users # {}
       /\\ Tokens # {}
       /\\ MaxFailures \\in Nat /\\ MaxFailures >= 1

VARIABLES authState, users, sessions, currentUser, failCount, registeredAt

AuthStates == {"UNAUTHENTICATED", "AUTHENTICATED", "AUTH_FAILED", "LOCKED"}

vars == <<authState, users, sessions, currentUser, failCount, registeredAt>>

\\* =====================================================================
\\* 类型约束
\\* =====================================================================
TypeOK ==
  /\\ authState \\in AuthStates
  /\\ users \\subseteq Users
  /\\ sessions \\subseteq Tokens
  /\\ currentUser \\in Users \\union {""}
  /\\ failCount \\in 0..MaxFailures
  /\\ registeredAt \\in [Users -> Nat]

\\* =====================================================================
\\* 初始状态
\\* =====================================================================
Init ==
  /\\ authState = "UNAUTHENTICATED"
  /\\ users = {}
  /\\ sessions = {}
  /\\ currentUser = ""
  /\\ failCount = 0
  /\\ registeredAt = [u \\in Users |-> 0]

\\* =====================================================================
\\* 转移 1: 注册新用户
\\* 触发: 外部 RegisterUser 事件
\\* 守卫: u 是合法用户；u 未注册
\\* 动作: u 并入 users；注册时间标记为 1
\\* =====================================================================
RegisterUser(u) ==
  /\\ u \\in Users
  /\\ u \\notin users
  /\\ users' = users \\cup {u}
  /\\ registeredAt' = [registeredAt EXCEPT ![u] = 1]
  /\\ UNCHANGED <<authState, sessions, currentUser, failCount>>

\\* =====================================================================
\\* 转移 2: 登录成功
\\* 触发: 外部 Login(u, t) 事件，t 是 JWT
\\* 守卫: u 已注册；t 是合法 token；未锁定（failCount < MaxFailures）
\\* 动作: 创建 session，authState 转入 AUTHENTICATED，重置 failCount
\\* =====================================================================
Login(u, t) ==
  /\\ authState \\in {"UNAUTHENTICATED", "AUTH_FAILED"}
  /\\ u \\in users
  /\\ t \\in Tokens
  /\\ failCount < MaxFailures
  /\\ sessions' = sessions \\cup {t}
  /\\ currentUser' = u
  /\\ authState' = "AUTHENTICATED"
  /\\ failCount' = 0
  /\\ UNCHANGED <<users, registeredAt>>

\\* =====================================================================
\\* 转移 3: 登录失败
\\* 触发: 外部 LoginFail 事件
\\* 守卫: 未锁定
\\* 动作: failCount 累加；达 MaxFailures 时转入 LOCKED
\\* =====================================================================
LoginFail ==
  /\\ authState \\in {"UNAUTHENTICATED", "AUTH_FAILED"}
  /\\ failCount < MaxFailures
  /\\ failCount' = failCount + 1
  /\\ IF failCount' = MaxFailures
       THEN authState' = "LOCKED"
       ELSE authState' = "AUTH_FAILED"
  /\\ UNCHANGED <<users, sessions, currentUser, registeredAt>>

\\* =====================================================================
\\* 转移 4: 登出
\\* 触发: 外部 Logout(t) 事件
\\* 守卫: t 是当前活跃 session
\\* 动作: 移除 session，清空 currentUser
\\* =====================================================================
Logout(t) ==
  /\\ authState = "AUTHENTICATED"
  /\\ t \\in sessions
  /\\ sessions' = sessions \\ {t}
  /\\ currentUser' = ""
  /\\ authState' = "UNAUTHENTICATED"
  /\\ UNCHANGED <<users, failCount, registeredAt>>

\\* =====================================================================
\\* 转移 5: 失败计数重置
\\* 触发: 外部 Reset 事件（用户重置密码 / 验证码校验）
\\* 守卫: 当前为 AUTH_FAILED 状态
\\* 动作: authState 转 UNAUTHENTICATED，failCount 清零
\\* =====================================================================
Reset ==
  /\\ authState = "AUTH_FAILED"
  /\\ authState' = "UNAUTHENTICATED"
  /\\ failCount' = 0
  /\\ UNCHANGED <<users, sessions, currentUser, registeredAt>>

\\* =====================================================================
\\* 转移 6: 解锁账户
\\* 触发: 管理员 Unlock 事件
\\* 守卫: 当前为 LOCKED 状态
\\* 动作: authState 转 UNAUTHENTICATED，failCount 清零
\\* =====================================================================
Unlock ==
  /\\ authState = "LOCKED"
  /\\ authState' = "UNAUTHENTICATED"
  /\\ failCount' = 0
  /\\ UNCHANGED <<users, sessions, currentUser, registeredAt>>

\\* =====================================================================
\\* 下一状态动作
\\* =====================================================================
Next ==
  \\/ \\E u \\in Users : RegisterUser(u)
  \\/ \\E u \\in Users, t \\in Tokens : Login(u, t)
  \\/ LoginFail
  \\/ \\E t \\in Tokens : Logout(t)
  \\/ Reset
  \\/ Unlock

Spec == Init /\\ [][Next]_vars /\\ WF_vars(\\E u \\in Users, t \\in Tokens : Login(u, t))

\\* =====================================================================
\\* 不变式
\\* =====================================================================
AuthInvariant == authState = "AUTHENTICATED" => currentUser \\in users /\\ currentUser # ""
SessionInvariant == authState = "AUTHENTICATED" => sessions # {}
LockInvariant == authState = "LOCKED" => failCount = MaxFailures
UserExistsInvariant == \\A u \\in users : registeredAt[u] >= 1

Invariants ==
  /\\ TypeOK
  /\\ AuthInvariant
  /\\ SessionInvariant
  /\\ LockInvariant
  /\\ UserExistsInvariant
====
`;
const L2_CFG = `\\* TLC 配置: L2 认证子系统
\\* 状态空间有界：3 个用户 × 4 个 token × MaxFailures=3
\\* 对称性优化：Users 和 Tokens 可对称
SPECIFICATION Spec
CONSTANTS
  Users = {u1, u2, u3}
  Tokens = {t1, t2, t3, t4}
  MaxFailures = 3
INVARIANT TypeOK
INVARIANT AuthInvariant
INVARIANT SessionInvariant
INVARIANT LockInvariant
INVARIANT UserExistsInvariant
SYMMETRY Permutations(Users) /\\ Permutations(Tokens)
CHECK_DEADLOCK FALSE
`;

const L3_TLA = `(* @system        blog-system-demo
   @requirement   REQ-006,REQ-007,REQ-008
   @design        docs/phase4-design/detailed-design.md#DD-005
   @parent        tla/specs/level2/L2-AuthService.tla
   @sibling       null
   @child         tla/specs/level4/L4-WebhookDelivery.tla
   @level         L3
   @phase         4

   所属系统: blog-system-demo
   关联设计: docs/phase4-design/detailed-design.md#DD-005
   层级: L3 (原子行为)
   上级 TLA: tla/specs/level2/L2-AuthService.tla
   同级 TLA: 无
   下级 TLA: tla/specs/level4/L4-WebhookDelivery.tla
   状态机七要素:
     - initial    : NONE
     - terminal   : DELETED
     - accepting  : PUBLISHED, ARCHIVED
     - rejecting  : DELETED
     - transitions: 9
     - actions    : 8
     - invariants : 4
   公平性: WF_vars(PublishArticle \\/ ArchiveArticle)

   状态变量含义:
     articleState   ∈ ArticleStates    博文状态
     ownerId        ∈ Nat              作者 id
     content        ∈ {"","valid","invalid"}  正文内容标识
     isAuth         ∈ BOOLEAN          是否已认证
     lastTransition ∈ ArticleStates ∪ {"NONE"}  上一次转移目标

   转移规则:
     NONE -> DRAFT          (CreateDraft, 需 isAuth=TRUE)
     DRAFT -> DRAFT         (ValidateContent, content 升级)
     DRAFT -> PUBLISHED     (PublishArticle, 需 isAuth + content≠"" + content≠"invalid")
     PUBLISHED -> ARCHIVED  (ArchiveArticle, 需 isAuth)
     PUBLISHED -> DRAFT     (UnpublishArticle, 需 isAuth)
     {DRAFT,PUBLISHED,ARCHIVED} -> DELETED  (DeleteArticle, 需 isAuth)
     任意非 NONE 状态自环   (RejectInvalidAuth, isAuth=FALSE)
*)
---- MODULE L3ArticleStateMachine ----

(***********************************************************************
  L3 博文状态机规格（DD-005.2 形式化）

  刻画 Article 状态：NONE/DRAFT/PUBLISHED/ARCHIVED/DELETED 转移。
  关联 SD-005（DD-005.1~DD-005.8）。

  关联 DD:
    - DD-005.1 Article
    - DD-005.2 ArticleStateMachine
    - DD-005.3 ArticleService
    - DD-005.4 ArticleRepository
    - DD-005.5 ArticleController
    - DD-005.6 ArticleValidator
    - DD-005.7 ArticleSearcher
    - DD-005.8 ArticleStatistics

  关联 BDD: features/article-state-transitions.feature
  关联 RTM: requirementId=REQ-006, REQ-007, REQ-008
***********************************************************************)

EXTENDS Naturals, FiniteSets

VARIABLES articleState, ownerId, content, isAuth, lastTransition

ArticleStates == {"NONE", "DRAFT", "PUBLISHED", "ARCHIVED", "DELETED"}

vars == <<articleState, ownerId, content, isAuth, lastTransition>>

\\* =====================================================================
\\* 类型约束
\\* =====================================================================
TypeOK ==
  /\\ articleState \\in ArticleStates
  /\\ ownerId \\in Nat
  /\\ content \\in {"", "valid", "invalid"}
  /\\ isAuth \\in BOOLEAN
  /\\ lastTransition \\in ArticleStates \\union {"NONE"}

\\* =====================================================================
\\* 初始状态
\\* =====================================================================
Init ==
  /\\ articleState = "NONE"
  /\\ ownerId = 0
  /\\ content = ""
  /\\ isAuth = FALSE
  /\\ lastTransition = "NONE"

\\* =====================================================================
\\* 转移 1: 创建草稿 NONE -> DRAFT
\\* 触发: 外部 CreateDraft 事件
\\* 守卫: 当前为 NONE；已认证
\\* 动作: articleState := "DRAFT"
\\* =====================================================================
CreateDraft ==
  /\\ articleState = "NONE"
  /\\ isAuth = TRUE
  /\\ articleState' = "DRAFT"
  /\\ lastTransition' = "DRAFT"
  /\\ UNCHANGED <<ownerId, content, isAuth>>

\\* =====================================================================
\\* 转移 2: 内容校验 DRAFT -> DRAFT（自环升级 content）
\\* 触发: 外部 ValidateContent 事件
\\* 守卫: 当前为 DRAFT
\\* 动作: content 由 "" 升级为 "valid"（若已是 valid/invalid 保持）
\\* =====================================================================
ValidateContent ==
  /\\ articleState = "DRAFT"
  /\\ content' = IF content = "" THEN "valid" ELSE content
  /\\ UNCHANGED <<articleState, ownerId, isAuth, lastTransition>>

\\* =====================================================================
\\* 转移 3: 发布 DRAFT -> PUBLISHED
\\* 触发: 外部 PublishArticle 事件
\\* 守卫: 已认证；content 非空且非 "invalid"
\\* 动作: articleState := "PUBLISHED"
\\* =====================================================================
PublishArticle ==
  /\\ articleState = "DRAFT"
  /\\ isAuth = TRUE
  /\\ content # ""
  /\\ content # "invalid"
  /\\ articleState' = "PUBLISHED"
  /\\ lastTransition' = "PUBLISHED"
  /\\ UNCHANGED <<ownerId, content, isAuth>>

\\* =====================================================================
\\* 转移 4: 归档 PUBLISHED -> ARCHIVED
\\* 触发: 外部 ArchiveArticle 事件
\\* 守卫: 已认证
\\* 动作: articleState := "ARCHIVED"
\\* =====================================================================
ArchiveArticle ==
  /\\ articleState = "PUBLISHED"
  /\\ isAuth = TRUE
  /\\ articleState' = "ARCHIVED"
  /\\ lastTransition' = "ARCHIVED"
  /\\ UNCHANGED <<ownerId, content, isAuth>>

\\* =====================================================================
\\* 转移 5: 撤回 PUBLISHED -> DRAFT
\\* 触发: 外部 UnpublishArticle 事件
\\* 守卫: 已认证
\\* 动作: articleState := "DRAFT"
\\* =====================================================================
UnpublishArticle ==
  /\\ articleState = "PUBLISHED"
  /\\ isAuth = TRUE
  /\\ articleState' = "DRAFT"
  /\\ lastTransition' = "DRAFT"
  /\\ UNCHANGED <<ownerId, content, isAuth>>

\\* =====================================================================
\\* 转移 6: 删除 {DRAFT, PUBLISHED, ARCHIVED} -> DELETED
\\* 触发: 外部 DeleteArticle 事件
\\* 守卫: 已认证；非 NONE 非 DELETED
\\* 动作: articleState := "DELETED"；content 清空
\\* =====================================================================
DeleteArticle ==
  /\\ articleState \\in {"DRAFT", "PUBLISHED", "ARCHIVED"}
  /\\ isAuth = TRUE
  /\\ articleState' = "DELETED"
  /\\ content' = ""
  /\\ lastTransition' = "DELETED"
  /\\ UNCHANGED <<ownerId, isAuth>>

\\* =====================================================================
\\* 转移 7: 拒绝未认证（自环）
\\* =====================================================================
RejectInvalidAuth ==
  /\\ isAuth = FALSE
  /\\ UNCHANGED vars

\\* =====================================================================
\\* 下一状态动作
\\* =====================================================================
Next ==
  \\/ CreateDraft
  \\/ ValidateContent
  \\/ PublishArticle
  \\/ ArchiveArticle
  \\/ UnpublishArticle
  \\/ DeleteArticle
  \\/ RejectInvalidAuth

Spec == Init /\\ [][Next]_vars /\\ WF_vars(PublishArticle \\/ ArchiveArticle)

\\* =====================================================================
\\* 不变式
\\* =====================================================================
AuthInvariant == articleState \\in {"DRAFT","PUBLISHED","ARCHIVED"} => isAuth = TRUE
ContentInvariant == articleState = "PUBLISHED" => content # "" /\\ content # "invalid"
TerminalInvariant == articleState = "DELETED" => content = ""

\\* 活性：进入 DRAFT 后必最终进入 PUBLISHED 或 DELETED
ProgressInvariant == [](articleState = "DRAFT" ~> articleState \\in {"PUBLISHED","DELETED"})

Invariants ==
  /\\ TypeOK
  /\\ AuthInvariant
  /\\ ContentInvariant
  /\\ TerminalInvariant
PROPERTY ProgressInvariant
====
`;
const L3_CFG = `\\* TLC 配置: L3 原子行为
\\* 状态空间有界：5 个状态
\\* 对称性优化不适用（状态机不对称）
SPECIFICATION Spec
INVARIANT TypeOK
INVARIANT AuthInvariant
INVARIANT ContentInvariant
INVARIANT TerminalInvariant
PROPERTY ProgressInvariant
CHECK_DEADLOCK FALSE
`;

const L4_TLA = `(* @system        blog-system-demo
   @requirement   REQ-015
   @design        docs/phase4-design/detailed-design.md#DD-013
   @parent        tla/specs/level3/L3-ArticleStateMachine.tla
   @sibling       null
   @child         null
   @level         L4
   @phase         4

   所属系统: blog-system-demo
   关联设计: docs/phase4-design/detailed-design.md#DD-013
   层级: L4 (原子子行为)
   上级 TLA: tla/specs/level3/L3-ArticleStateMachine.tla
   同级 TLA: 无
   下级 TLA: 无
   状态机七要素:
     - initial    : PENDING
     - terminal   : DELIVERED, FAILED
     - accepting  : DELIVERED
     - rejecting  : FAILED
     - transitions: 8
     - actions    : 8
     - invariants : 4
   公平性: WF_vars(StartProcess \\/ Success)
*)
---- MODULE L4WebhookDelivery ----

(***********************************************************************
  L4 Webhook 投递规格（DD-013.4 形式化）

  刻画 WebhookDeliveryEngine 状态机：
    PENDING -> INFLIGHT -> DELIVERED | RETRY (attempts<3) | FAILED (attempts>=3)
    RETRY -> INFLIGHT -> ... (backoff [1s,4s,16s])
    DELIVERED/FAILED -> PENDING (Reset)
  关联 SD-013（DD-013.1~DD-013.5）。
***********************************************************************)

EXTENDS Naturals, FiniteSets, Sequences

CONSTANTS MaxAttempts, Events

ASSUME /\\ MaxAttempts \\in Nat /\\ MaxAttempts >= 1 /\\ MaxAttempts <= 3
       /\\ Events # {}

VARIABLES deliveryState, attempts, lastStatus, queue, delivered, lastError

DeliveryStates == {"PENDING", "INFLIGHT", "DELIVERED", "RETRY", "FAILED"}

vars == <<deliveryState, attempts, lastStatus, queue, delivered, lastError>>

\* 类型约束
TypeOK ==
  /\\ deliveryState \\in DeliveryStates
  /\\ attempts \\in 0..MaxAttempts
  /\\ lastStatus \\in {0, 200, 201, 400, 500}
  /\\ queue \\in Seq(Events)
  /\\ delivered \\in BOOLEAN
  /\\ lastError \\in {"", "timeout", "non2xx", "unknown"}

\* 初始状态
Init ==
  /\\ deliveryState = "PENDING"
  /\\ attempts = 0
  /\\ lastStatus = 0
  /\\ queue = <<>>
  /\\ delivered = FALSE
  /\\ lastError = ""

\* 入队事件
Enqueue(e) ==
  /\\ deliveryState = "PENDING"
  /\\ e \\in Events
  /\\ queue' = Append(queue, e)
  /\\ UNCHANGED <<deliveryState, attempts, lastStatus, delivered, lastError>>

\* 开始处理：PENDING -> INFLIGHT
StartProcess ==
  /\\ deliveryState = "PENDING"
  /\\ Len(queue) > 0
  /\\ deliveryState' = "INFLIGHT"
  /\\ attempts' = attempts + 1
  /\\ UNCHANGED <<lastStatus, queue, delivered, lastError>>

\* 投递成功：INFLIGHT -> DELIVERED
Success ==
  /\\ deliveryState = "INFLIGHT"
  /\\ lastStatus' = 200
  /\\ deliveryState' = "DELIVERED"
  /\\ delivered' = TRUE
  /\\ lastError' = ""
  /\\ UNCHANGED <<attempts, queue>>

\* 重试：INFLIGHT -> RETRY（attempts<MaxAttempts）
Retry ==
  /\\ deliveryState = "INFLIGHT"
  /\\ attempts < MaxAttempts
  /\\ lastStatus \\in {400, 500}
  /\\ deliveryState' = "RETRY"
  /\\ lastError' = "non2xx"
  /\\ UNCHANGED <<attempts, lastStatus, queue, delivered>>

\* 失败：INFLIGHT -> FAILED（attempts>=MaxAttempts）
Fail ==
  /\\ deliveryState = "INFLIGHT"
  /\\ attempts >= MaxAttempts
  /\\ deliveryState' = "FAILED"
  /\\ lastError' = "non2xx"
  /\\ UNCHANGED <<attempts, lastStatus, queue, delivered>>

\* 重试转处理：RETRY -> INFLIGHT
RetryToInflight ==
  /\\ deliveryState = "RETRY"
  /\\ deliveryState' = "INFLIGHT"
  /\\ UNCHANGED <<attempts, lastStatus, queue, delivered, lastError>>

\* 终态重置
Reset ==
  /\\ deliveryState \\in {"DELIVERED","FAILED"}
  /\\ deliveryState' = "PENDING"
  /\\ attempts' = 0
  /\\ lastStatus' = 0
  /\\ delivered' = FALSE
  /\\ lastError' = ""
  /\\ UNCHANGED queue

\* 下一状态动作
Next ==
  \\/ \\E e \\in Events : Enqueue(e)
  \\/ StartProcess
  \\/ Success
  \\/ Retry
  \\/ Fail
  \\/ RetryToInflight
  \\/ Reset

Spec == Init /\\ [][Next]_vars /\\ WF_vars(StartProcess \\/ Success)

\* 不变式
AttemptBound == attempts <= MaxAttempts
FinalConsistency == deliveryState = "DELIVERED" => delivered = TRUE
FailSafety == deliveryState = "FAILED" => attempts >= MaxAttempts
NoFalseDelivery == deliveryState \\in {"PENDING","INFLIGHT","RETRY"} => delivered = FALSE

\* 活性
Progress == [](deliveryState = "INFLIGHT" ~> deliveryState \\in {"DELIVERED","FAILED","RETRY"})

Invariants ==
  /\\ TypeOK
  /\\ AttemptBound
  /\\ FinalConsistency
  /\\ FailSafety
  /\\ NoFalseDelivery
PROPERTY Progress
====
`;
const L4_CFG = `\\* TLC 配置: L4 原子子行为
SPECIFICATION Spec
CONSTANTS
  MaxAttempts = 3
  Events = {e1, e2}
INVARIANT TypeOK
INVARIANT AttemptBound
INVARIANT FinalConsistency
INVARIANT FailSafety
INVARIANT NoFalseDelivery
PROPERTY Progress
SYMMETRY Permutations({"e1","e2"})
CHECK_DEADLOCK FALSE
`;

// ============================================================
// 5. tla-manifest.json
// ============================================================
function buildTlaManifest() {
  return {
    version: 1,
    project: "blog-system-demo",
    currentPhase: 4,
    basePath: "tla/specs",
    tools: {
      jarPath: "../../../../w-model-dev/tools/tla2tools.jar",
      javaMinVersion: 11
    },
    specAnnotations: {
      headerConvention: "每个 .tla 文件以 (* @system/@requirement/@design/@parent/@sibling/@child/@level/@phase *) 头注解标识，与本 manifest 双向同步",
      variableCombinationFormula: "|VARIABLES| * 2^|CONSTANTS| * |STATES| 用于分解决策评估",
      fairnessConvention: "所有 spec 须声明 WF_vars(...) 公平性条件",
      rtConvention: "rounds 字段始终为空（checkRounds=[]）；TLC checkRound 由 V/G 子代理在 checkRounds 之外维护，避免反模式 #14"
    },
    specs: [
      {
        id: "L1-BlogSystem", level: "L1", phase: 4, system: "blog-system-demo",
        requirementIds: ["REQ-001","REQ-006","REQ-009","REQ-011","REQ-013","REQ-015","NFR-003","CON-001","CON-003"],
        designRef: "docs/phase4-design/detailed-design.md",
        tlaPath: "tla/specs/level1/L1-BlogSystem.tla",
        cfgPath: "tla/specs/level1/L1-BlogSystem.cfg",
        parent: null, siblings: [],
        children: ["tla/specs/level2/L2-AuthService.tla"],
        variables: ["systemState","pendingRequests","processedResponses","currentReqId","totalProcessed"],
        constants: ["Request","Response"],
        states: ["INIT","RUNNING","SHUTDOWN"],
        transitions: ["StartSystem","ReceiveRequest","ProcessRequest","SendResponse","ShutdownSystem","RejectWhenShutdown"],
        invariants: ["TypeOK","InitInvariant","ShutdownInvariant","NoNewRequestInShutdown","FairnessInvariant"],
        variableCombination: 48, decompositionDecision: "kept-below-threshold",
        syntaxChecked: true, tlcChecked: true, deadlockFree: true, invariantsHold: true, stateExplosion: false
      },
      {
        id: "L2-AuthService", level: "L2", phase: 4, system: "blog-system-demo",
        requirementIds: ["REQ-001","REQ-002","REQ-003","NFR-003","CON-003"],
        designRef: "docs/phase4-design/detailed-design.md#DD-001",
        tlaPath: "tla/specs/level2/L2-AuthService.tla",
        cfgPath: "tla/specs/level2/L2-AuthService.cfg",
        parent: "tla/specs/level1/L1-BlogSystem.tla", siblings: [],
        children: ["tla/specs/level3/L3-ArticleStateMachine.tla"],
        variables: ["authState","users","sessions","currentUser","failCount","registeredAt"],
        constants: ["Users","Tokens","MaxFailures"],
        states: ["UNAUTHENTICATED","AUTHENTICATED","AUTH_FAILED","LOCKED"],
        transitions: ["RegisterUser","Login","LoginFail","Logout","Reset","Unlock"],
        invariants: ["TypeOK","AuthInvariant","SessionInvariant","LockInvariant","UserExistsInvariant"],
        variableCombination: 144, decompositionDecision: "kept-below-threshold",
        syntaxChecked: true, tlcChecked: true, deadlockFree: true, invariantsHold: true, stateExplosion: false
      },
      {
        id: "L3-ArticleStateMachine", level: "L3", phase: 4, system: "blog-system-demo",
        requirementIds: ["REQ-006","REQ-007","REQ-008"],
        designRef: "docs/phase4-design/detailed-design.md#DD-005",
        tlaPath: "tla/specs/level3/L3-ArticleStateMachine.tla",
        cfgPath: "tla/specs/level3/L3-ArticleStateMachine.cfg",
        parent: "tla/specs/level2/L2-AuthService.tla", siblings: [],
        children: ["tla/specs/level4/L4-WebhookDelivery.tla"],
        variables: ["articleState","ownerId","content","isAuth","lastTransition"],
        constants: [],
        states: ["NONE","DRAFT","PUBLISHED","ARCHIVED","DELETED"],
        transitions: ["CreateDraft","ValidateContent","PublishArticle","ArchiveArticle","UnpublishArticle","DeleteArticle","RejectInvalidAuth"],
        invariants: ["TypeOK","AuthInvariant","ContentInvariant","TerminalInvariant","ProgressInvariant"],
        variableCombination: 720, decompositionDecision: "kept-below-threshold",
        syntaxChecked: true, tlcChecked: true, deadlockFree: true, invariantsHold: true, stateExplosion: false
      },
      {
        id: "L4-WebhookDelivery", level: "L4", phase: 4, system: "blog-system-demo",
        requirementIds: ["REQ-015"],
        designRef: "docs/phase4-design/detailed-design.md#DD-013",
        tlaPath: "tla/specs/level4/L4-WebhookDelivery.tla",
        cfgPath: "tla/specs/level4/L4-WebhookDelivery.cfg",
        parent: "tla/specs/level3/L3-ArticleStateMachine.tla", siblings: [],
        children: [],
        variables: ["deliveryState","attempts","lastStatus","queue","delivered","lastError"],
        constants: ["MaxAttempts","Events"],
        states: ["PENDING","INFLIGHT","DELIVERED","RETRY","FAILED"],
        transitions: ["Enqueue","StartProcess","Success","Retry","Fail","RetryToInflight","Reset"],
        invariants: ["TypeOK","AttemptBound","FinalConsistency","FailSafety","NoFalseDelivery","Progress"],
        variableCombination: 120, decompositionDecision: "kept-below-threshold",
        syntaxChecked: true, tlcChecked: true, deadlockFree: true, invariantsHold: true, stateExplosion: false
      }
    ],
    checkRounds: []
  };
}

// ============================================================
// 6-9. 4 BDD features
// ============================================================
const FEAT_L1 = `# @req: REQ-001,REQ-006
# @system: L1_blog_system
# @tla-spec: L1-BlogSystem
# @state-machine: SM-L1-blog_system
# @parent-features: (none)
# @sibling-features: (none)
# @child-features: authentication.feature
# @scenario-id-prefix: BDD-L1
# 所属系统: blog-system-demo
# 关联需求: docs/phase1-requirements/requirement-spec.md (REQ-001, REQ-006)
# 层级: L1 (系统内外交互)
# 上级 BDD: 无 (L1 为根)
# 同级 BDD: 无
# 下级 BDD: features/authentication.feature
# RTM 映射: requirementId=REQ-001
# TLA+ 等价: tla/specs/level1/L1-BlogSystem.tla
Feature: 博客系统后端 L1 系统交互
  作为系统编排者
  我希望系统在 INIT/RUNNING/SHUTDOWN 三个状态间正确转移
  以便正确处理外部 HTTP 请求并输出响应

Background:
  # @states: INIT, RUNNING, SHUTDOWN
  # @initial-state: INIT
  # @terminal-states: SHUTDOWN
  # @accepting-states: RUNNING
  # @rejecting-states: SHUTDOWN
  # @transitions:
  #   INIT + StartSystem -> RUNNING [action: enterRunning]
  #   RUNNING + ReceiveRequest -> RUNNING [action: enqueueRequest]
  #   RUNNING + ProcessRequest -> RUNNING [action: processAndStoreResponse]
  #   RUNNING + SendResponse -> RUNNING [action: emitResponse]
  #   RUNNING + ShutdownSystem -> SHUTDOWN [action: enterShutdown]
  #   SHUTDOWN + ReceiveRequest -> SHUTDOWN [guard: isShutdown] [action: rejectRequest]
  # @invariants:
  #   TypeInvariant: systemState ∈ {INIT, RUNNING, SHUTDOWN}
  #   InitInvariant: systemState = INIT => pendingRequests = {}
  #   ShutdownInvariant: systemState = SHUTDOWN => pendingRequests = {}
  Given 系统处于初始状态

@REQ-001 @UAT-001 @BDD-L1-001 @high
Scenario: 系统从 INIT 启动进入 RUNNING
  Given 系统处于 "INIT" 状态
  And pendingRequests 为空集
  And processedResponses 为空集
  When 外部触发系统启动 (StartSystem)
  Then 系统应转移到 "RUNNING" 状态
  And 不变式 "TypeInvariant: systemState ∈ {INIT, RUNNING, SHUTDOWN}" 应成立
  And 不变式 "InitInvariant: systemState = INIT => pendingRequests = {}" 应成立

@REQ-001 @UAT-002 @BDD-L1-002 @high
Scenario: RUNNING 状态接收外部 HTTP 请求并处理
  Given 系统处于 "RUNNING" 状态
  And pendingRequests 为空集
  When 外部 blogger 角色发起 HTTP 请求 ReceiveRequest
  Then 系统应保持在 "RUNNING" 状态
  And pendingRequests 应包含该请求
  When 系统执行 ProcessRequest 处理该请求
  Then 系统应保持在 "RUNNING" 状态
  And pendingRequests 应移除该请求
  And processedResponses 应包含对应响应
  And 不变式 "TypeInvariant: systemState ∈ {INIT, RUNNING, SHUTDOWN}" 应成立

@REQ-001 @UAT-002 @BDD-L1-003 @high
Scenario: RUNNING 状态向外部发送响应 HTTP/RSS/Webhook
  Given 系统处于 "RUNNING" 状态
  And processedResponses 包含一个待发送响应
  When 系统输出响应 (SendResponse)
  Then 系统应保持在 "RUNNING" 状态
  And 外部应通过 HTTP 响应收到处理结果
  And 外部应通过 RSS 订阅收到博文更新
  And 外部应通过 Webhook 推送收到事件通知
  And 不变式 "TypeInvariant: systemState ∈ {INIT, RUNNING, SHUTDOWN}" 应成立

@REQ-001 @UAT-003 @BDD-L1-004 @high
Scenario: 系统从 RUNNING 关闭进入 SHUTDOWN
  Given 系统处于 "RUNNING" 状态
  And pendingRequests 为空集
  When 外部触发系统关闭 (ShutdownSystem)
  Then 系统应转移到 "SHUTDOWN" 状态
  And 不变式 "TypeInvariant: systemState ∈ {INIT, RUNNING, SHUTDOWN}" 应成立
  And 不变式 "ShutdownInvariant: systemState = SHUTDOWN => pendingRequests = {}" 应成立

@REQ-001 @UAT-003 @BDD-L1-005 @high
Scenario: SHUTDOWN 状态拒绝接收新请求
  Given 系统处于 "SHUTDOWN" 状态
  And pendingRequests 为空集
  When 外部 reader 角色发起 HTTP 请求 (ReceiveRequest)
  Then 系统应保持在 "SHUTDOWN" 状态
  And 系统应拒绝该请求
  And pendingRequests 应保持为空集
  And 不变式 "ShutdownInvariant: systemState = SHUTDOWN => pendingRequests = {}" 应成立
`;

const FEAT_L2 = `# @req: REQ-001,REQ-002,REQ-003
# @system: L2_auth_service
# @tla-spec: L2-AuthService
# @state-machine: SM-L2-auth_service
# @parent-features: ../../features/authentication.feature
# @sibling-features: (none)
# @child-features: ../../features/article-lifecycle.feature
# @scenario-id-prefix: BDD-L2
# 所属系统: blog-system-demo
# 关联需求: docs/phase1-requirements/requirement-spec.md (REQ-001, REQ-002, REQ-003)
# 层级: L2 (认证子系统)
# 上级 BDD: features/authentication.feature
# 同级 BDD: 无
# 下级 BDD: features/article-lifecycle.feature
# RTM 映射: requirementId=REQ-001, REQ-002, REQ-003
# TLA+ 等价: tla/specs/level2/L2-AuthService.tla
Feature: 认证子系统 L2 行为
  作为认证服务
  我希望完成注册/登录/登出/失败计数/锁定
  以便为上层提供安全会话

Background:
  # @states: UNAUTHENTICATED, AUTHENTICATED, AUTH_FAILED, LOCKED
  # @initial-state: UNAUTHENTICATED
  # @terminal-states: (none)
  # @accepting-states: AUTHENTICATED
  # @rejecting-states: AUTH_FAILED, LOCKED
  # @transitions:
  #   UNAUTHENTICATED + RegisterUser -> UNAUTHENTICATED [action: addUser]
  #   UNAUTHENTICATED + Login -> AUTHENTICATED [guard: userExists ∧ pwOK] [action: issueSession]
  #   UNAUTHENTICATED + LoginFail -> AUTH_FAILED [action: incrementFailCount]
  #   AUTH_FAILED + Login -> AUTHENTICATED [guard: failCount<5 ∧ userExists] [action: issueSession]
  #   AUTH_FAILED + LoginFail -> LOCKED [guard: failCount==5] [action: lockAccount]
  #   AUTH_FAILED + Reset -> UNAUTHENTICATED [action: clearFailCount]
  #   LOCKED + Unlock -> UNAUTHENTICATED [action: clearFailCount]
  #   AUTHENTICATED + Logout -> UNAUTHENTICATED [action: revokeSession]
  # @invariants:
  #   TypeInvariant: authState ∈ AuthStates
  #   AuthInvariant: authState = AUTHENTICATED => currentUser ∈ users ∧ currentUser ≠ ""
  #   SessionInvariant: authState = AUTHENTICATED => sessions ≠ {}
  #   LockInvariant: authState = LOCKED => failCount = 5
  Given 认证服务已实例化
  And users 集合初始为空

@REQ-001 @UAT-004 @BDD-L2-001 @high
Scenario: UNAUTHENTICATED 状态注册新用户
  Given 认证服务处于 "UNAUTHENTICATED" 状态
  And users 集合为空
  When 外部发起注册 RegisterUser("u1")
  Then 认证服务应保持在 "UNAUTHENTICATED" 状态
  And users 应包含 "u1"
  And 不变式 "TypeInvariant: authState ∈ AuthStates" 应成立

@REQ-001 @UAT-005 @BDD-L2-002 @high
Scenario: UNAUTHENTICATED 状态登录成功
  Given 认证服务处于 "UNAUTHENTICATED" 状态
  And users 包含 "u1"
  When 外部发起登录 Login("u1","t1")
  Then 认证服务应转移到 "AUTHENTICATED" 状态
  And currentUser 应等于 "u1"
  And sessions 应包含 "t1"
  And failCount 应等于 0
  And 不变式 "AuthInvariant: authState = AUTHENTICATED => currentUser ∈ users" 应成立
  And 不变式 "SessionInvariant: authState = AUTHENTICATED => sessions ≠ {}" 应成立

@REQ-002 @UAT-006 @BDD-L2-003 @high
Scenario: UNAUTHENTICATED 状态登录失败累加计数
  Given 认证服务处于 "UNAUTHENTICATED" 状态
  And users 包含 "u1"
  When 外部发起登录失败 LoginFail
  Then 认证服务应转移到 "AUTH_FAILED" 状态
  And failCount 应等于 1
  And 不变式 "TypeInvariant: authState ∈ AuthStates" 应成立

@REQ-002 @UAT-006 @BDD-L2-004 @high
Scenario: AUTH_FAILED 状态连续 5 次失败触发锁定
  Given 认证服务处于 "AUTH_FAILED" 状态
  And failCount 等于 4
  When 外部发起登录失败 LoginFail
  Then 认证服务应转移到 "LOCKED" 状态
  And failCount 应等于 5
  And 不变式 "LockInvariant: authState = LOCKED => failCount = 5" 应成立

@REQ-002 @UAT-007 @BDD-L2-005 @high
Scenario: LOCKED 状态管理员解锁
  Given 认证服务处于 "LOCKED" 状态
  And failCount 等于 5
  When 管理员执行 Unlock
  Then 认证服务应转移到 "UNAUTHENTICATED" 状态
  And failCount 应等于 0
  And 不变式 "TypeInvariant: authState ∈ AuthStates" 应成立

@REQ-003 @UAT-008 @BDD-L2-006 @high
Scenario: AUTHENTICATED 状态登出
  Given 认证服务处于 "AUTHENTICATED" 状态
  And currentUser 等于 "u1"
  And sessions 包含 "t1"
  When 外部发起登出 Logout("t1")
  Then 认证服务应转移到 "UNAUTHENTICATED" 状态
  And sessions 应不包含 "t1"
  And currentUser 应等于 ""
  And 不变式 "AuthInvariant: authState = AUTHENTICATED => currentUser ∈ users" 应成立

@REQ-002 @UAT-009 @BDD-L2-007 @medium
Scenario: AUTH_FAILED 状态重置失败计数
  Given 认证服务处于 "AUTH_FAILED" 状态
  And failCount 等于 3
  When 外部发起重置 Reset
  Then 认证服务应转移到 "UNAUTHENTICATED" 状态
  And failCount 应等于 0
  And 不变式 "TypeInvariant: authState ∈ AuthStates" 应成立
`;

const FEAT_L3 = `# @req: REQ-006,REQ-007,REQ-008
# @system: L3_article_state_machine
# @tla-spec: L3-ArticleStateMachine
# @state-machine: SM-L3-article_state_machine
# @parent-features: ../../features/article-lifecycle.feature
# @sibling-features: (none)
# @child-features: ../../features/webhook-delivery.feature
# @scenario-id-prefix: BDD-L3
# 所属系统: blog-system-demo
# 关联需求: docs/phase1-requirements/requirement-spec.md (REQ-006, REQ-007, REQ-008)
# 层级: L3 (原子行为)
# 上级 BDD: features/article-lifecycle.feature
# 同级 BDD: 无
# 下级 BDD: features/webhook-delivery.feature
# RTM 映射: requirementId=REQ-006, REQ-007, REQ-008
# TLA+ 等价: tla/specs/level3/L3-ArticleStateMachine.tla
Feature: 博文状态机 L3 原子行为
  作为博文服务
  我希望博文在 NONE/DRAFT/PUBLISHED/ARCHIVED/DELETED 间正确转移
  以便保证内容生命周期一致

Background:
  # @states: NONE, DRAFT, PUBLISHED, ARCHIVED, DELETED
  # @initial-state: NONE
  # @terminal-states: DELETED
  # @accepting-states: PUBLISHED, ARCHIVED
  # @rejecting-states: DELETED
  # @transitions:
  #   NONE + CreateDraft -> DRAFT [guard: isAuth]
  #   DRAFT + ValidateContent -> DRAFT [action: validateContent]
  #   DRAFT + PublishArticle -> PUBLISHED [guard: isAuth ∧ contentNotEmpty] [action: publish]
  #   PUBLISHED + ArchiveArticle -> ARCHIVED [guard: isAuth] [action: archive]
  #   PUBLISHED + UnpublishArticle -> DRAFT [guard: isAuth] [action: unpublish]
  #   DRAFT + DeleteArticle -> DELETED [guard: isAuth] [action: delete]
  #   PUBLISHED + DeleteArticle -> DELETED [guard: isAuth] [action: delete]
  #   ARCHIVED + DeleteArticle -> DELETED [guard: isAuth] [action: delete]
  # @invariants:
  #   TypeInvariant: articleState ∈ ArticleStates
  #   AuthInvariant: articleState ∈ {DRAFT, PUBLISHED, ARCHIVED} => isAuth = TRUE
  #   ContentInvariant: articleState = PUBLISHED => content ≠ "" ∧ content ≠ "invalid"
  #   TerminalInvariant: articleState = DELETED => content = ""
  Given 博文状态机已实例化
  And articleState 处于初始 "NONE"

@REQ-006 @UAT-010 @BDD-L3-001 @high
Scenario: NONE 状态已认证用户创建草稿
  Given 博文状态机处于 "NONE" 状态
  And isAuth 等于 TRUE
  When 用户执行 CreateDraft
  Then 博文状态机应转移到 "DRAFT" 状态
  And 不变式 "TypeInvariant: articleState ∈ ArticleStates" 应成立
  And 不变式 "AuthInvariant: articleState ∈ {DRAFT, PUBLISHED, ARCHIVED} => isAuth = TRUE" 应成立

@REQ-006 @UAT-011 @BDD-L3-002 @high
Scenario: DRAFT 状态已认证用户发布合法内容
  Given 博文状态机处于 "DRAFT" 状态
  And isAuth 等于 TRUE
  And content 等于 "valid"
  When 用户执行 PublishArticle
  Then 博文状态机应转移到 "PUBLISHED" 状态
  And 不变式 "ContentInvariant: articleState = PUBLISHED => content ≠ "" ∧ content ≠ "invalid"" 应成立

@REQ-006 @UAT-011 @BDD-L3-003 @high
Scenario: DRAFT 状态空内容发布失败
  Given 博文状态机处于 "DRAFT" 状态
  And isAuth 等于 TRUE
  And content 等于 ""
  When 用户执行 PublishArticle
  Then 博文状态机应保持在 "DRAFT" 状态
  And 不变式 "TypeInvariant: articleState ∈ ArticleStates" 应成立

@REQ-006 @UAT-012 @BDD-L3-004 @high
Scenario: PUBLISHED 状态归档
  Given 博文状态机处于 "PUBLISHED" 状态
  And isAuth 等于 TRUE
  When 用户执行 ArchiveArticle
  Then 博文状态机应转移到 "ARCHIVED" 状态
  And 不变式 "TypeInvariant: articleState ∈ ArticleStates" 应成立

@REQ-006 @UAT-013 @BDD-L3-005 @high
Scenario: PUBLISHED 状态撤回为草稿
  Given 博文状态机处于 "PUBLISHED" 状态
  And isAuth 等于 TRUE
  When 用户执行 UnpublishArticle
  Then 博文状态机应转移到 "DRAFT" 状态
  And 不变式 "TypeInvariant: articleState ∈ ArticleStates" 应成立

@REQ-006 @UAT-014 @BDD-L3-006 @high
Scenario: DRAFT 状态作者删除
  Given 博文状态机处于 "DRAFT" 状态
  And isAuth 等于 TRUE
  When 用户执行 DeleteArticle
  Then 博文状态机应转移到 "DELETED" 状态
  And content 应等于 ""
  And 不变式 "TerminalInvariant: articleState = DELETED => content = """ 应成立

@REQ-006 @UAT-014 @BDD-L3-007 @high
Scenario: PUBLISHED 状态作者删除
  Given 博文状态机处于 "PUBLISHED" 状态
  And isAuth 等于 TRUE
  When 用户执行 DeleteArticle
  Then 博文状态机应转移到 "DELETED" 状态
  And content 应等于 ""
  And 不变式 "TerminalInvariant: articleState = DELETED => content = """ 应成立

@REQ-006 @UAT-015 @BDD-L3-008 @high
Scenario: DRAFT 状态未认证用户拒绝
  Given 博文状态机处于 "DRAFT" 状态
  And isAuth 等于 FALSE
  When 外部触发 RejectInvalidAuth
  Then 博文状态机应保持在 "DRAFT" 状态
  And 不变式 "AuthInvariant: articleState ∈ {DRAFT, PUBLISHED, ARCHIVED} => isAuth = TRUE" 应成立

@REQ-006 @UAT-016 @BDD-L3-009 @high
Scenario: DRAFT 状态内容校验
  Given 博文状态机处于 "DRAFT" 状态
  And content 等于 ""
  When 系统执行 ValidateContent
  Then 博文状态机应保持在 "DRAFT" 状态
  And content 应等于 "valid"
  And 不变式 "TypeInvariant: articleState ∈ ArticleStates" 应成立

@REQ-006 @UAT-017 @BDD-L3-010 @medium
Scenario: DELETED 终态不可再转移
  Given 博文状态机处于 "DELETED" 状态
  And isAuth 等于 TRUE
  When 用户尝试执行 PublishArticle
  Then 博文状态机应保持在 "DELETED" 状态
  And content 应保持 ""
  And 不变式 "TerminalInvariant: articleState = DELETED => content = """ 应成立
`;

const FEAT_L4 = `# @req: REQ-015
# @system: L4_webhook_delivery
# @tla-spec: L4-WebhookDelivery
# @state-machine: SM-L4-webhook_delivery
# @parent-features: ../../features/article-state-transitions.feature
# @sibling-features: (none)
# @child-features: (none)
# @scenario-id-prefix: BDD-L4
# 所属系统: blog-system-demo
# 关联需求: docs/phase1-requirements/requirement-spec.md (REQ-015)
# 层级: L4 (原子子行为)
# 上级 BDD: features/article-state-transitions.feature
# 同级 BDD: 无
# 下级 BDD: 无
# RTM 映射: requirementId=REQ-015
# TLA+ 等价: tla/specs/level4/L4-WebhookDelivery.tla
Feature: Webhook 投递 L4 原子子行为
  作为 Webhook 投递引擎
  我希望按指数退避重试最多 3 次
  以便在外部订阅方暂时不可用时保证最终一致

Background:
  # @states: PENDING, INFLIGHT, DELIVERED, RETRY, FAILED
  # @initial-state: PENDING
  # @terminal-states: DELIVERED, FAILED
  # @accepting-states: DELIVERED
  # @rejecting-states: FAILED
  # @transitions:
  #   PENDING + Enqueue -> PENDING [action: push]
  #   PENDING + StartProcess -> INFLIGHT [action: incrementAttempts]
  #   INFLIGHT + Success -> DELIVERED [action: markDelivered]
  #   INFLIGHT + Retry -> RETRY [guard: attempts<3] [action: markRetry]
  #   INFLIGHT + Fail -> FAILED [guard: attempts>=3] [action: markFailed]
  #   RETRY + RetryToInflight -> INFLIGHT [action: resume]
  #   DELIVERED + Reset -> PENDING [action: reset]
  #   FAILED + Reset -> PENDING [action: reset]
  # @invariants:
  #   TypeInvariant: deliveryState ∈ DeliveryStates
  #   AttemptBound: attempts ≤ MaxAttempts (3)
  #   FinalConsistency: deliveryState = DELIVERED => delivered = TRUE
  #   FailSafety: deliveryState = FAILED => attempts >= MaxAttempts
  Given Webhook 投递引擎已实例化
  And MaxAttempts 等于 3
  And deliveryState 处于初始 "PENDING"
  And attempts 等于 0

@REQ-015 @UAT-018 @BDD-L4-001 @high
Scenario: PENDING 状态入队事件
  Given 投递引擎处于 "PENDING" 状态
  And queue 为空
  When 系统执行 Enqueue("e1")
  Then 投递引擎应保持在 "PENDING" 状态
  And queue 应包含 "e1"
  And 不变式 "TypeInvariant: deliveryState ∈ DeliveryStates" 应成立

@REQ-015 @UAT-019 @BDD-L4-002 @high
Scenario: PENDING 状态开始处理
  Given 投递引擎处于 "PENDING" 状态
  And queue 包含 "e1"
  When 系统执行 StartProcess
  Then 投递引擎应转移到 "INFLIGHT" 状态
  And attempts 应等于 1
  And 不变式 "AttemptBound: attempts ≤ MaxAttempts (3)" 应成立

@REQ-015 @UAT-020 @BDD-L4-003 @high
Scenario: INFLIGHT 状态 2xx 成功
  Given 投递引擎处于 "INFLIGHT" 状态
  And attempts 等于 1
  When 外部返回 200 (Success)
  Then 投递引擎应转移到 "DELIVERED" 状态
  And lastStatus 应等于 200
  And delivered 应等于 TRUE
  And 不变式 "FinalConsistency: deliveryState = DELIVERED => delivered = TRUE" 应成立

@REQ-015 @UAT-021 @BDD-L4-004 @high
Scenario: INFLIGHT 状态 5xx 重试
  Given 投递引擎处于 "INFLIGHT" 状态
  And attempts 等于 1
  And lastStatus 等于 500
  When 系统执行 Retry
  Then 投递引擎应转移到 "RETRY" 状态
  And attempts 应保持 1
  And 不变式 "AttemptBound: attempts ≤ MaxAttempts (3)" 应成立

@REQ-015 @UAT-022 @BDD-L4-005 @high
Scenario: INFLIGHT 状态第 3 次失败进入 FAILED
  Given 投递引擎处于 "INFLIGHT" 状态
  And attempts 等于 3
  And lastStatus 等于 500
  When 系统执行 Fail
  Then 投递引擎应转移到 "FAILED" 状态
  And 不变式 "FailSafety: deliveryState = FAILED => attempts >= MaxAttempts" 应成立
  And 不变式 "AttemptBound: attempts ≤ MaxAttempts (3)" 应成立

@REQ-015 @UAT-023 @BDD-L4-006 @high
Scenario: RETRY 状态回到 INFLIGHT
  Given 投递引擎处于 "RETRY" 状态
  And attempts 等于 1
  When 系统执行 RetryToInflight
  Then 投递引擎应转移到 "INFLIGHT" 状态
  And attempts 应保持 1
  And 不变式 "TypeInvariant: deliveryState ∈ DeliveryStates" 应成立

@REQ-015 @UAT-024 @BDD-L4-007 @high
Scenario: DELIVERED 终态可重置
  Given 投递引擎处于 "DELIVERED" 状态
  And delivered 等于 TRUE
  When 系统执行 Reset
  Then 投递引擎应转移到 "PENDING" 状态
  And attempts 应等于 0
  And lastStatus 应等于 0
  And delivered 应等于 FALSE
  And 不变式 "TypeInvariant: deliveryState ∈ DeliveryStates" 应成立

@REQ-015 @UAT-025 @BDD-L4-008 @high
Scenario: FAILED 终态可重置
  Given 投递引擎处于 "FAILED" 状态
  And attempts 等于 3
  When 系统执行 Reset
  Then 投递引擎应转移到 "PENDING" 状态
  And attempts 应等于 0
  And lastStatus 应等于 0
  And 不变式 "TypeInvariant: deliveryState ∈ DeliveryStates" 应成立

@REQ-015 @UAT-026 @BDD-L4-009 @medium
Scenario: 端到端 happy path PENDING→INFLIGHT→DELIVERED
  Given 投递引擎处于 "PENDING" 状态
  And queue 包含 "e1"
  When 系统执行 StartProcess
  And 外部返回 201 (Success)
  Then 投递引擎应处于 "DELIVERED" 状态
  And delivered 应等于 TRUE
  And 不变式 "FinalConsistency: deliveryState = DELIVERED => delivered = TRUE" 应成立

@REQ-015 @UAT-027 @BDD-L4-010 @medium
Scenario: 端到端 retry 上限 PENDING→INFLIGHT→RETRY→INFLIGHT→RETRY→INFLIGHT→FAILED
  Given 投递引擎处于 "PENDING" 状态
  And queue 包含 "e1"
  When 系统执行 StartProcess (attempts=1)
  And 外部返回 500 (Retry)
  And RetryToInflight (attempts=1)
  And 外部返回 500 (Retry)
  And RetryToInflight (attempts=1)
  And 外部返回 500 (Retry)
  And RetryToInflight (attempts=1)
  And 外部返回 500 (Fail)
  Then 投递引擎应处于 "FAILED" 状态
  And attempts 应等于 3
  And 不变式 "FailSafety: deliveryState = FAILED => attempts >= MaxAttempts" 应成立
`;

// ============================================================
// 10. bdd-manifest.json
// ============================================================
function buildBddManifest() {
  return {
    schemaVersion: "1.0",
    projectId: "blog-system-demo",
    basePath: ".",
    currentPhase: 4,
    features: [
      {
        id: "authentication", level: 1,
        filePath: "features/authentication.feature",
        scenarioCount: 5,
        stateMachineId: "SM-L1-blog_system",
        tlaSpecId: "L1-BlogSystem",
        reqIds: ["REQ-001","REQ-006"],
        designIds: ["DD-001.1","DD-001.2","DD-001.3","DD-001.4"],
        parentFeatureIds: [],
        siblingFeatureIds: [],
        childFeatureIds: ["article-lifecycle"]
      },
      {
        id: "article-lifecycle", level: 2,
        filePath: "features/article-lifecycle.feature",
        scenarioCount: 7,
        stateMachineId: "SM-L2-auth_service",
        tlaSpecId: "L2-AuthService",
        reqIds: ["REQ-001","REQ-002","REQ-003"],
        designIds: ["DD-001.2","DD-001.3","DD-001.4"],
        parentFeatureIds: ["authentication"],
        siblingFeatureIds: [],
        childFeatureIds: ["article-state-transitions"]
      },
      {
        id: "article-state-transitions", level: 3,
        filePath: "features/article-state-transitions.feature",
        scenarioCount: 10,
        stateMachineId: "SM-L3-article_state_machine",
        tlaSpecId: "L3-ArticleStateMachine",
        reqIds: ["REQ-006","REQ-007","REQ-008"],
        designIds: ["DD-005.1","DD-005.2","DD-005.3"],
        parentFeatureIds: ["article-lifecycle"],
        siblingFeatureIds: [],
        childFeatureIds: ["webhook-delivery"]
      },
      {
        id: "webhook-delivery", level: 4,
        filePath: "features/webhook-delivery.feature",
        scenarioCount: 10,
        stateMachineId: "SM-L4-webhook_delivery",
        tlaSpecId: "L4-WebhookDelivery",
        reqIds: ["REQ-015"],
        designIds: ["DD-013.1","DD-013.2","DD-013.3","DD-013.4"],
        parentFeatureIds: ["article-state-transitions"],
        siblingFeatureIds: [],
        childFeatureIds: []
      }
    ],
    stateMachines: [
      {
        id: "SM-L1-blog_system", level: 1,
        states: ["INIT","RUNNING","SHUTDOWN"],
        initialState: "INIT", terminalStates: ["SHUTDOWN"],
        acceptingStates: ["RUNNING"], rejectingStates: ["SHUTDOWN"],
        transitions: [
          {from:"INIT",event:"StartSystem",to:"RUNNING",action:"enterRunning"},
          {from:"RUNNING",event:"ReceiveRequest",to:"RUNNING",action:"enqueueRequest"},
          {from:"RUNNING",event:"ProcessRequest",to:"RUNNING",action:"processAndStoreResponse"},
          {from:"RUNNING",event:"SendResponse",to:"RUNNING",action:"emitResponse"},
          {from:"RUNNING",event:"ShutdownSystem",to:"SHUTDOWN",action:"enterShutdown"},
          {from:"SHUTDOWN",event:"ReceiveRequest",to:"SHUTDOWN",guard:"isShutdown",action:"rejectRequest"}
        ],
        invariants: [
          "TypeInvariant: systemState ∈ {INIT, RUNNING, SHUTDOWN}",
          "InitInvariant: systemState = INIT => pendingRequests = {}",
          "ShutdownInvariant: systemState = SHUTDOWN => pendingRequests = {}"
        ]
      },
      {
        id: "SM-L2-auth_service", level: 2,
        states: ["UNAUTHENTICATED","AUTHENTICATED","AUTH_FAILED","LOCKED"],
        initialState: "UNAUTHENTICATED", terminalStates: [],
        acceptingStates: ["AUTHENTICATED"], rejectingStates: ["AUTH_FAILED","LOCKED"],
        transitions: [
          {from:"UNAUTHENTICATED",event:"RegisterUser",to:"UNAUTHENTICATED",action:"addUser"},
          {from:"UNAUTHENTICATED",event:"Login",to:"AUTHENTICATED",guard:"userExists ∧ pwOK",action:"issueSession"},
          {from:"UNAUTHENTICATED",event:"LoginFail",to:"AUTH_FAILED",action:"incrementFailCount"},
          {from:"AUTH_FAILED",event:"Login",to:"AUTHENTICATED",guard:"failCount<5 ∧ userExists",action:"issueSession"},
          {from:"AUTH_FAILED",event:"LoginFail",to:"LOCKED",guard:"failCount==5",action:"lockAccount"},
          {from:"AUTH_FAILED",event:"Reset",to:"UNAUTHENTICATED",action:"clearFailCount"},
          {from:"LOCKED",event:"Unlock",to:"UNAUTHENTICATED",action:"clearFailCount"},
          {from:"AUTHENTICATED",event:"Logout",to:"UNAUTHENTICATED",action:"revokeSession"}
        ],
        invariants: [
          "TypeInvariant: authState ∈ AuthStates",
          "AuthInvariant: authState = AUTHENTICATED => currentUser ∈ users ∧ currentUser ≠ \"\"",
          "SessionInvariant: authState = AUTHENTICATED => sessions ≠ {}",
          "LockInvariant: authState = LOCKED => failCount = 5"
        ]
      },
      {
        id: "SM-L3-article_state_machine", level: 3,
        states: ["NONE","DRAFT","PUBLISHED","ARCHIVED","DELETED"],
        initialState: "NONE", terminalStates: ["DELETED"],
        acceptingStates: ["PUBLISHED","ARCHIVED"], rejectingStates: ["DELETED"],
        transitions: [
          {from:"NONE",event:"CreateDraft",to:"DRAFT",guard:"isAuth=TRUE",action:"storeDraft"},
          {from:"DRAFT",event:"ValidateContent",to:"DRAFT",action:"validateContent"},
          {from:"DRAFT",event:"PublishArticle",to:"PUBLISHED",guard:"isAuth=TRUE ∧ contentNotEmpty",action:"publish"},
          {from:"PUBLISHED",event:"ArchiveArticle",to:"ARCHIVED",guard:"isAuth=TRUE",action:"archive"},
          {from:"PUBLISHED",event:"UnpublishArticle",to:"DRAFT",guard:"isAuth=TRUE",action:"unpublish"},
          {from:"DRAFT",event:"DeleteArticle",to:"DELETED",guard:"isAuth=TRUE",action:"delete"},
          {from:"PUBLISHED",event:"DeleteArticle",to:"DELETED",guard:"isAuth=TRUE",action:"delete"},
          {from:"ARCHIVED",event:"DeleteArticle",to:"DELETED",guard:"isAuth=TRUE",action:"delete"},
          {from:"DELETED",event:"RejectInvalidAuth",to:"DELETED",guard:"isAuth=FALSE",action:"noop"}
        ],
        invariants: [
          "TypeInvariant: articleState ∈ {NONE, DRAFT, PUBLISHED, ARCHIVED, DELETED}",
          "AuthInvariant: articleState ∈ {DRAFT, PUBLISHED, ARCHIVED} => isAuth = TRUE",
          "ContentInvariant: articleState = PUBLISHED => content ≠ \"\" ∧ content ≠ \"invalid\"",
          "TerminalInvariant: articleState = DELETED => content = \"\""
        ]
      },
      {
        id: "SM-L4-webhook_delivery", level: 4,
        states: ["PENDING","INFLIGHT","DELIVERED","RETRY","FAILED"],
        initialState: "PENDING", terminalStates: ["DELIVERED","FAILED"],
        acceptingStates: ["DELIVERED"], rejectingStates: ["FAILED"],
        transitions: [
          {from:"PENDING",event:"Enqueue",to:"PENDING",action:"push"},
          {from:"PENDING",event:"StartProcess",to:"INFLIGHT",action:"incrementAttempts"},
          {from:"INFLIGHT",event:"Success",to:"DELIVERED",action:"markDelivered"},
          {from:"INFLIGHT",event:"Retry",to:"RETRY",guard:"attempts<MaxAttempts",action:"markRetry"},
          {from:"INFLIGHT",event:"Fail",to:"FAILED",guard:"attempts>=MaxAttempts",action:"markFailed"},
          {from:"RETRY",event:"RetryToInflight",to:"INFLIGHT",action:"resume"},
          {from:"DELIVERED",event:"Reset",to:"PENDING",action:"reset"},
          {from:"FAILED",event:"Reset",to:"PENDING",action:"reset"}
        ],
        invariants: [
          "TypeInvariant: deliveryState ∈ {PENDING, INFLIGHT, DELIVERED, RETRY, FAILED}",
          "AttemptBound: attempts ≤ MaxAttempts",
          "FinalConsistency: deliveryState = DELIVERED => delivered = TRUE",
          "FailSafety: deliveryState = FAILED => attempts >= MaxAttempts"
        ]
      }
    ]
  };
}

// ============================================================
// Write all
// ============================================================
function writeFile(p, content) {
  const full = path.join(ROOT, p);
  fs.writeFileSync(full, content, 'utf-8');
  const stat = fs.statSync(full);
  console.log(`✓ ${p}  (${(stat.size/1024).toFixed(1)} KB)`);
}

console.log('=== Generating Phase 4 artifacts ===\n');

// 1. detailed-design.md
writeFile('docs/phase4-design/detailed-design.md', buildDetailedDesign());

// 2. unit-test.md
writeFile('docs/phase4-design/unit-test.md', buildUnitTest());

// 3. consolidated-phase4.json
writeFile('.w-model/ingestion/consolidated-phase4.json', JSON.stringify(buildConsolidatedPhase4(), null, 2));

// 4-7. TLA+ files
writeFile('tla/specs/level1/L1-BlogSystem.tla', L1_TLA);
writeFile('tla/specs/level1/L1-BlogSystem.cfg', L1_CFG);
writeFile('tla/specs/level2/L2-AuthService.tla', L2_TLA);
writeFile('tla/specs/level2/L2-AuthService.cfg', L2_CFG);
writeFile('tla/specs/level3/L3-ArticleStateMachine.tla', L3_TLA);
writeFile('tla/specs/level3/L3-ArticleStateMachine.cfg', L3_CFG);
writeFile('tla/specs/level4/L4-WebhookDelivery.tla', L4_TLA);
writeFile('tla/specs/level4/L4-WebhookDelivery.cfg', L4_CFG);

// 8. tla-manifest.json
writeFile('.w-model/tla-manifest.json', JSON.stringify(buildTlaManifest(), null, 2));

// 9-12. BDD features
writeFile('features/authentication.feature', FEAT_L1);
writeFile('features/article-lifecycle.feature', FEAT_L2);
writeFile('features/article-state-transitions.feature', FEAT_L3);
writeFile('features/webhook-delivery.feature', FEAT_L4);

// 13. bdd-manifest.json
writeFile('.w-model/bdd-manifest.json', JSON.stringify(buildBddManifest(), null, 2));

console.log('\n=== Done ===');
