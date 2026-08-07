(*
  @system        blog-system
  @requirement   REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-021, REQ-022, SD-001, SD-002, SD-003, SD-004, SD-005, SD-006, SD-007, SD-008, SD-009, SD-010, SD-011, SD-012, SD-013, SD-014, SD-015, SD-016, SD-017, SD-018, SD-019, SD-020, SD-021
  @design        docs/phase2-design/blog-system-system-design.md:§3
  @designIds     SD-001,SD-002,SD-003,SD-004,SD-005,SD-006,SD-007,SD-008,SD-009,SD-010,SD-011,SD-012,SD-013,SD-014,SD-015,SD-016,SD-017,SD-018,SD-019,SD-020,SD-021
  @parent        null
  @sibling       null
  @child         ../../../tla/specs/level2/L2_BlogSystemAuth.tla, ../../../tla/specs/level2/L2_BlogSystemContent.tla, ../../../tla/specs/level2/L2_BlogSystemEngagement.tla, ../../../tla/specs/level2/L2_BlogSystemDiscovery.tla, ../../../tla/specs/level2/L2_BlogSystemOps.tla, ../../../tla/specs/level2/L2_BlogSystemInfra.tla
  @level         L1
  @phase         1
*)
---- MODULE L1_BlogSystem ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
(* 无常量：L1 系统边界交互抽象，取值域（actor/请求/响应/内容可见性）内联定义 *)

(* ==================== 变量 ==================== *)
VARIABLES
    actor,      \* EXT-IN 发起者角色（visitor 访客 / user 用户 / blogger 博主 / admin 系统管理）
    request,    \* EXT-IN 外部请求动作类别（22 类，一一对应 REQ-001~REQ-022）
    response,   \* EXT-OUT 系统响应类别（2xx 成功 / 400 / 401 / 403 / 404 / 409 / 429）
    published   \* 系统内容可见性状态（FALSE=仅草稿/无已发布内容，TRUE=存在已发布内容）

(* ==================== 取值域 ==================== *)
ACTORS == {"visitor", "user", "blogger", "admin"}

REQUESTS == {
    "Register",           \* REQ-001 用户注册
    "ManageProfile",      \* REQ-002 用户资料管理
    "Login",              \* REQ-003 用户登录与会话
    "OpenBlogger",        \* REQ-004 博主身份管理
    "FollowBlogger",      \* REQ-005 博主关注与粉丝
    "ManageArticle",      \* REQ-006 文章管理
    "PublishArticle",     \* REQ-007 文章发布与草稿
    "BrowseArticle",      \* REQ-008 文章浏览与阅读统计
    "ManageComment",      \* REQ-009 评论管理
    "ReviewComment",      \* REQ-010 评论审核
    "ManageTag",          \* REQ-011 标签管理
    "ManageCategory",     \* REQ-012 分类管理
    "SearchArticle",      \* REQ-013 文章搜索
    "RecommendArticle",   \* REQ-014 内容推荐
    "QueryStats",         \* REQ-015 统计
    "ManageNotification", \* REQ-016 通知
    "SubscribeBlogger",   \* REQ-017 订阅
    "RecordAuditLog",     \* REQ-018 审计日志记录
    "QueryAuditLog",      \* REQ-019 审计日志查询
    "GetRssFeed",         \* REQ-020 RSS 订阅源
    "ManageWebhook",      \* REQ-021 Webhook 配置
    "RetryWebhook"        \* REQ-022 Webhook 失败重试
}

RESPONSES == {
    "ok2xx",           \* 2xx 成功（201 创建 / 200 查询更新）
    "badRequest400",   \* 400 参数错误（zod 入参校验，CON-003）
    "unauthorized401", \* 401 未认证 / 无效过期伪造 token（NFR-002）
    "forbidden403",    \* 403 越权 / 非资源所有者
    "notFound404",     \* 404 资源不存在
    "conflict409",     \* 409 资源冲突 / 重复
    "rateLimited429"   \* 429 单 IP 超限（NFR-006，附 Retry-After）
}

(* ==================== 请求分类 ==================== *)
(* 公开请求：访客无需认证即可发起（REQ-001/003/008/013/014/020） *)
PublicRequests ==
    {"Register", "Login", "BrowseArticle", "SearchArticle",
     "RecommendArticle", "GetRssFeed"}

(* 受保护请求：须认证（认证与授权中间件，NFR-002 横切） *)
ProtectedRequests == REQUESTS \ PublicRequests

(* 博主专属请求：仅博主可执行，非博主越权 403（REQ-006/007/010/011/012/015/021/022） *)
BloggerOnlyRequests ==
    {"ManageArticle", "PublishArticle", "ReviewComment",
     "ManageTag", "ManageCategory", "QueryStats",
     "ManageWebhook", "RetryWebhook"}

(* 审计域请求：仅系统管理（admin）可执行（REQ-018/019） *)
AuditRequests == {"RecordAuditLog", "QueryAuditLog"}

(* 已认证角色 *)
AuthenticatedActors == {"user", "blogger", "admin"}

(* ==================== 状态不变式（TypeInvariant） ==================== *)
TypeInvariant ==
    /\ actor \in ACTORS
    /\ request \in REQUESTS
    /\ response \in RESPONSES
    /\ published \in BOOLEAN

(* ==================== 业务不变式 ==================== *)
\* @designRef docs/phase1-requirements/requirement-spec.md:§1.1 (NFR-002 横切：受保护接口须认证)
\* 受保护请求的成功响应要求发起者为已认证角色（未认证访问 → 401）
ProtectedSuccessRequiresAuth ==
    \A r \in ProtectedRequests :
        (request = r /\ response = "ok2xx") => (actor \in AuthenticatedActors)

\* @designRef docs/phase1-requirements/requirement-spec.md:§1.1 (REQ-004/REQ-006/REQ-007/REQ-010/REQ-011/REQ-012/REQ-015/REQ-021/REQ-022)
\* 博主专属请求由访客发起 → 401 未认证（限流 429 横切优先于业务响应，NFR-006）
BloggerOnlyVisitorUnauthorized ==
    \A r \in BloggerOnlyRequests :
        (request = r /\ actor = "visitor") =>
            (response \in {"unauthorized401", "rateLimited429"})

\* 博主专属请求由已认证但非博主（user/admin）发起 → 403 越权（限流 429 横切优先，NFR-006）
BloggerOnlyNonOwnerForbidden ==
    \A r \in BloggerOnlyRequests :
        (request = r /\ actor \in {"user", "admin"}) =>
            (response \in {"forbidden403", "rateLimited429"})

\* @designRef docs/phase1-requirements/requirement-spec.md:§1.1 (REQ-008 AC3)
\* 浏览公开文章成功要求内容已发布（访客浏览草稿 → 404）
BrowseOkRequiresPublished ==
    (request = "BrowseArticle" /\ response = "ok2xx") => published

\* @designRef docs/phase1-requirements/requirement-spec.md:§1.1 (REQ-018 AC3 / REQ-019 AC3)
\* 审计域请求的成功响应仅允许系统管理（admin）（普通用户读审计日志 → 403）
AuditActionsAdminOnly ==
    \A r \in AuditRequests :
        (request = r /\ response = "ok2xx") => (actor = "admin")

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合所有子不变式；.cfg 的 INVARIANTS 列表须与此展开集合一致（tla-plus-guide.md §11） *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ ProtectedSuccessRequiresAuth
    /\ BloggerOnlyVisitorUnauthorized
    /\ BloggerOnlyNonOwnerForbidden
    /\ BrowseOkRequiresPublished
    /\ AuditActionsAdminOnly

(* ==================== 初始状态 ==================== *)
(* 系统空闲：访客浏览尚无已发布内容的系统 → 404（REQ-008 AC2/AC3），状态自洽 *)
Init ==
    /\ actor = "visitor"
    /\ request = "BrowseArticle"
    /\ response = "notFound404"
    /\ published = FALSE

(* ==================== 状态转移（Next） ==================== *)
(* 每步 = 系统接收一个新请求（EXT-IN：request' + actor'）并返回其响应（EXT-OUT：response'） *)
(* 响应分支忠实于需求 AC（201/200/400/401/403/404/409/429）；不允许占位/简化/错误实现（反模式 #16） *)

\* REQ-001 用户注册：合法注册 201 / 重复注册 409 / 非法邮箱或密码<6 位 400
Register ==
    /\ request' = "Register"
    /\ response' \in {"ok2xx", "conflict409", "badRequest400"}
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-002 用户资料管理：认证用户 200 / 未携带 token 401 / 非法字段 400
ManageProfile ==
    /\ request' = "ManageProfile"
    /\ actor' \in ACTORS
    /\ IF actor' = "visitor"
       THEN response' = "unauthorized401"
       ELSE response' \in {"ok2xx", "badRequest400"}
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-003 用户登录与会话：正确凭据 200+JWT / 错误密码 401 / 无效过期伪造 token 401
Login ==
    /\ request' = "Login"
    /\ response' \in {"ok2xx", "unauthorized401"}
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-004 博主身份管理：认证用户开通 201 / 重复开通 409 / 未认证 401
OpenBlogger ==
    /\ request' = "OpenBlogger"
    /\ actor' \in ACTORS
    /\ IF actor' = "visitor"
       THEN response' = "unauthorized401"
       ELSE response' \in {"ok2xx", "conflict409"}
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-005 博主关注与粉丝：关注 200 幂等 / 取关 200 / 关注不存在博主 404
FollowBlogger ==
    /\ request' = "FollowBlogger"
    /\ actor' \in ACTORS
    /\ IF actor' = "visitor"
       THEN response' = "unauthorized401"
       ELSE response' \in {"ok2xx", "notFound404"}
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-006 文章管理：博主创建 201 / 非作者更新删除 403 / 不存在 404 / 标题内容为空 400
ManageArticle ==
    /\ request' = "ManageArticle"
    /\ actor' \in ACTORS
    /\ IF actor' = "visitor"
       THEN response' = "unauthorized401"
       ELSE IF actor' \in {"user", "admin"}
            THEN response' = "forbidden403"
            ELSE response' \in {"ok2xx", "badRequest400", "notFound404"}
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-007 文章发布与草稿：保存草稿 draft 不可见 / 发布 published 公开可见 / 非作者改状态 403
PublishArticle ==
    /\ request' = "PublishArticle"
    /\ actor' \in ACTORS
    /\ \/ /\ actor' = "visitor"
           /\ response' = "unauthorized401"
           /\ published' = published
       \/ /\ actor' \in {"user", "admin"}
           /\ response' = "forbidden403"
           /\ published' = published
       \/ /\ actor' = "blogger"
           /\ \/ /\ response' = "ok2xx" /\ published' = TRUE
              \/ /\ response' \in {"badRequest400", "notFound404"}
                 /\ published' = published

\* REQ-008 文章浏览与阅读统计：浏览公开文章 200 浏览量+1 / 不存在 404 / 草稿 404
BrowseArticle ==
    /\ request' = "BrowseArticle"
    /\ response' \in {"ok2xx", "notFound404"}
    /\ (response' = "ok2xx") => published
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-009 评论管理：认证用户评论 201 / 非评论作者删除 403 / 空或>1000 字符 400 / 文章不存在 404
ManageComment ==
    /\ request' = "ManageComment"
    /\ actor' \in ACTORS
    /\ IF actor' = "visitor"
       THEN response' = "unauthorized401"
       ELSE response' \in {"ok2xx", "forbidden403", "badRequest400", "notFound404"}
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-010 评论审核：博主审核通过公开可见 / 拒绝隐藏 / 非博主 403
ReviewComment ==
    /\ request' = "ReviewComment"
    /\ actor' \in ACTORS
    /\ IF actor' = "visitor"
       THEN response' = "unauthorized401"
       ELSE IF actor' \in {"user", "admin"}
            THEN response' = "forbidden403"
            ELSE response' \in {"ok2xx", "notFound404"}
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-011 标签管理：创建 201 / 重复 409 / 删除被引用标签 409（先解绑后删除）
ManageTag ==
    /\ request' = "ManageTag"
    /\ actor' \in ACTORS
    /\ IF actor' = "visitor"
       THEN response' = "unauthorized401"
       ELSE IF actor' \in {"user", "admin"}
            THEN response' = "forbidden403"
            ELSE response' \in {"ok2xx", "conflict409", "badRequest400"}
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-012 分类管理：创建含 parent 201 / 删除含文章分类 409 / parent 不存在 400
ManageCategory ==
    /\ request' = "ManageCategory"
    /\ actor' \in ACTORS
    /\ IF actor' = "visitor"
       THEN response' = "unauthorized401"
       ELSE IF actor' \in {"user", "admin"}
            THEN response' = "forbidden403"
            ELSE response' \in {"ok2xx", "conflict409", "badRequest400"}
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-013 文章搜索：关键词命中 200 分页列表 / 无命中 200 空列表 / 空关键词 400
SearchArticle ==
    /\ request' = "SearchArticle"
    /\ response' \in {"ok2xx", "badRequest400"}
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-014 内容推荐：推荐 200 列表（≤10 条）/ 无内容 200 空列表 / 结果不含草稿
RecommendArticle ==
    /\ request' = "RecommendArticle"
    /\ response' = "ok2xx"
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-015 统计：文章统计 200 正确 / 无浏览数据 0 / 文章不存在 404
QueryStats ==
    /\ request' = "QueryStats"
    /\ actor' \in ACTORS
    /\ IF actor' = "visitor"
       THEN response' = "unauthorized401"
       ELSE IF actor' \in {"user", "admin"}
            THEN response' = "forbidden403"
            ELSE response' \in {"ok2xx", "notFound404"}
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-016 通知：评论/关注事件入列可查 200 / 标记已读 200 / 查询他人通知 403
ManageNotification ==
    /\ request' = "ManageNotification"
    /\ actor' \in ACTORS
    /\ IF actor' = "visitor"
       THEN response' = "unauthorized401"
       ELSE response' \in {"ok2xx", "forbidden403"}
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-017 订阅：订阅 200 / 重复订阅幂等 200 / 退订 200 / 订阅不存在博主 404
SubscribeBlogger ==
    /\ request' = "SubscribeBlogger"
    /\ actor' \in ACTORS
    /\ IF actor' = "visitor"
       THEN response' = "unauthorized401"
       ELSE response' \in {"ok2xx", "notFound404"}
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-018 审计日志记录：登录/删除/Webhook 配置变更由中间件自动记录 / 记录含 actor/action/timestamp/详情 / 普通用户不可读 403
RecordAuditLog ==
    /\ request' = "RecordAuditLog"
    /\ actor' \in ACTORS
    /\ IF actor' = "visitor"
       THEN response' = "unauthorized401"
       ELSE IF actor' = "admin"
            THEN response' = "ok2xx"
            ELSE response' = "forbidden403"
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-019 审计日志查询：管理员 200 分页 / 按 action/actor/时间筛选过滤正确 / 非管理员 403
QueryAuditLog ==
    /\ request' = "QueryAuditLog"
    /\ actor' \in ACTORS
    /\ IF actor' = "visitor"
       THEN response' = "unauthorized401"
       ELSE IF actor' = "admin"
            THEN response' \in {"ok2xx", "badRequest400"}
            ELSE response' = "forbidden403"
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-020 RSS 订阅源：GET RSS 200 XML 合法 / 无文章 200 空源 / 不存在博主 RSS 404
GetRssFeed ==
    /\ request' = "GetRssFeed"
    /\ response' \in {"ok2xx", "notFound404"}
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-021 Webhook 配置：创建 201 且文章发布事件触发投递 / 更新删除 200 / 非法 URL 400
ManageWebhook ==
    /\ request' = "ManageWebhook"
    /\ actor' \in ACTORS
    /\ IF actor' = "visitor"
       THEN response' = "unauthorized401"
       ELSE IF actor' \in {"user", "admin"}
            THEN response' = "forbidden403"
            ELSE response' \in {"ok2xx", "badRequest400"}
    /\ actor' \in ACTORS
    /\ published' = published

\* REQ-022 Webhook 失败重试：失败自动重试≤3 次指数退避 / 超限标记 failed / 成功不重试
\* L1 以「重试调度受理 ok2xx」建模边界交互；投递/退避/失败标记为系统内部行为，L2 Webhook 子系统细化
RetryWebhook ==
    /\ request' = "RetryWebhook"
    /\ actor' \in ACTORS
    /\ IF actor' = "visitor"
       THEN response' = "unauthorized401"
       ELSE IF actor' \in {"user", "admin"}
            THEN response' = "forbidden403"
            ELSE response' \in {"ok2xx", "badRequest400"}
    /\ actor' \in ACTORS
    /\ published' = published

\* NFR-006 API 限流（横切全部 API）：单 IP 速率 100 req/min，超限对当前请求返回 429 + Retry-After
RateLimit ==
    /\ response' = "rateLimited429"
    /\ request' = request
    /\ actor' = actor
    /\ published' = published

Next ==
    \/ Register
    \/ ManageProfile
    \/ Login
    \/ OpenBlogger
    \/ FollowBlogger
    \/ ManageArticle
    \/ PublishArticle
    \/ BrowseArticle
    \/ ManageComment
    \/ ReviewComment
    \/ ManageTag
    \/ ManageCategory
    \/ SearchArticle
    \/ RecommendArticle
    \/ QueryStats
    \/ ManageNotification
    \/ SubscribeBlogger
    \/ RecordAuditLog
    \/ QueryAuditLog
    \/ GetRssFeed
    \/ ManageWebhook
    \/ RetryWebhook
    \/ RateLimit

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<actor, request, response, published>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积 = |ACTORS| × |REQUESTS| × |RESPONSES| × |published| *)
(*                        = 4 × 22 × 7 × 2 = 1232 *)
(* 1232 < 10000（契约上限）→ decompositionDecision = "kept-below-threshold"（契约指定值） *)
(* 保留理由：L1 为系统级根规格；22 个请求动作类别（REQ-001~022 一一对应）、4 类 actor、 *)
(*   7 类响应（201/200/400/401/403/404/429）均为需求强制语义，L1 抽象粒度下无法在不省略 *)
(*   需求关键状态的前提下进一步缩减；细粒度拆解由阶段 2 的 L2 子系统规格承担 *)
================
