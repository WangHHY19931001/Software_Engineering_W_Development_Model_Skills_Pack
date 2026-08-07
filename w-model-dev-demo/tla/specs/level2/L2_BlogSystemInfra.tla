(*
  @system        blog-system::infra
  @requirement   NFR-005, NFR-006, CON-002, CON-003, REQ-016, REQ-017, REQ-021, SD-018, SD-019, SD-020, SD-021
  @design        docs/phase2-design/blog-system-system-design.md:§3
  @designIds     SD-018,SD-019,SD-020,SD-021
  @parent        ../../../tla/specs/level1/L1_BlogSystem.tla
  @sibling       ../../../tla/specs/level2/L2_BlogSystemAuth.tla, ../../../tla/specs/level2/L2_BlogSystemContent.tla, ../../../tla/specs/level2/L2_BlogSystemEngagement.tla, ../../../tla/specs/level2/L2_BlogSystemDiscovery.tla, ../../../tla/specs/level2/L2_BlogSystemOps.tla
  @child         null
  @level         L2
  @phase         2
*)
---- MODULE L2_BlogSystemInfra ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    RATE_LIMIT_MAX  \* 单 IP 每分钟请求上限（M-018，NFR-006 AC1：100 req/min；.cfg 中赋值，模型值模拟）

(* ==================== 建模层次说明 ==================== *)
(* L2 粒度 = 子系统内部行为（设计级建模），与 L1 的粒度差异： *)
(*   - L1（L1_BlogSystem）：整体系统状态机，以请求-响应类别抽象全部 22 个 REQ。 *)
(*   - L2（本规格）：基础设施子系统内部状态机。基于系统设计文档 §3 模块划分，建模 *)
(*     M-018 限流中间件（单 IP 计数、超限 429 + Retry-After，NFR-006，横切）、 *)
(*     M-019 入参校验中间件（zod schema 校验、错误结构归一化，CON-003，横切）、 *)
(*     M-020 内存数据访问层（Map/数组仓储、基础增删改查，CON-002/NFR-005，基础层）、 *)
(*     M-021 进程内事件总线（post.published / comment.created / follow.created 发布与投递，支撑 M-012/M-013/M-016）。 *)
(*   - L3/L4：原子化子系统行为（令牌桶补充时序、事件负载字段），由阶段 3/4 承担。 *)

(* ==================== 变量 ==================== *)
VARIABLES
    reqCount,       \* M-018 单 IP 当前窗口请求计数（NFR-006 AC1：达上限 → 429）
    limited,        \* M-018 限流状态：TRUE=当前请求被限流 429（附 Retry-After）
    validation,     \* M-019 zod 校验结果：none 未校验 / valid 通过 / invalid 非法入参（CON-003 AC1：400 结构化错误）
    processed,      \* M-020 请求是否已进入存储处理（校验通过才可读写内存仓储）
    busEvent,       \* M-021 事件总线当前事件类型：none 无事件 / post_published / comment_created / follow_created
    busPending,     \* M-021 事件总线是否持有待投递事件（TRUE=已发布未消费）
    eventConsumed   \* M-021 当前事件是否已被消费者接收（投递完成标记）

(* ==================== 取值域 ==================== *)
EVENTS == {"post_published", "comment_created", "follow_created"}

VALIDATIONS == {"none", "valid", "invalid"}

(* ==================== 状态不变式（TypeInvariant） ==================== *)
TypeInvariant ==
    /\ reqCount \in 0..RATE_LIMIT_MAX
    /\ limited \in BOOLEAN
    /\ validation \in VALIDATIONS
    /\ processed \in BOOLEAN
    /\ busEvent \in EVENTS \union {"none"}
    /\ busPending \in BOOLEAN
    /\ eventConsumed \in BOOLEAN

(* ==================== 业务不变式 ==================== *)
\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-018 限流中间件，NFR-006 AC1)
\* 仅当计数达上限才返回 429（阈值内放行；超限 429 + Retry-After）
RateLimitedOnlyAtMax ==
    limited => (reqCount = RATE_LIMIT_MAX)

\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-021 进程内事件总线)
\* 事件总线一致性：总线持有待投递事件 ⇔ 存在非空事件类型（发布后必可被消费，消费后总线必空）
BusPendingIffEvent ==
    /\ (busPending = TRUE) <=> (busEvent \in EVENTS)
    /\ (busPending = FALSE) <=> (busEvent = "none")

\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-021 进程内事件总线，支撑 M-012/M-013/M-016)
\* 消费完成标记仅当总线已空闲（事件投递给订阅者/通知/Webhook 后总线复位，方可发布新事件）
EventConsumedAfterPublish ==
    eventConsumed => (busPending = FALSE /\ busEvent = "none")

\* @designRef docs/phase2-design/blog-system-system-design.md:§3 (M-019 入参校验中间件，CON-003 AC1)
\* 非法入参不进入存储处理（校验失败 → 400 结构化错误；仅校验通过可读写 M-020 内存仓储）
InvalidNeverProcessed ==
    processed => (validation = "valid")

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合所有子不变式；.cfg 的 INVARIANTS 列表须与此展开集合一致（tla-plus-guide.md §11） *)
BusinessInvariant ==
    /\ TypeInvariant
    /\ RateLimitedOnlyAtMax
    /\ BusPendingIffEvent
    /\ EventConsumedAfterPublish
    /\ InvalidNeverProcessed

(* ==================== 初始状态 ==================== *)
(* 系统空闲：无请求计数、不限流、未校验、未处理、事件总线空闲 *)
Init ==
    /\ reqCount = 0
    /\ limited = FALSE
    /\ validation = "none"
    /\ processed = FALSE
    /\ busEvent = "none"
    /\ busPending = FALSE
    /\ eventConsumed = FALSE

(* ==================== 状态转移（Next） ==================== *)
(* 转移分支忠实于系统设计文档 §3 模块职责与需求 AC；不允许占位/简化/错误实现（反模式 #16） *)

(* ---- M-018 限流中间件（NFR-006） ---- *)

\* NFR-006 AC1：阈值内请求放行，窗口计数 +1
RequestArrive ==
    /\ reqCount < RATE_LIMIT_MAX
    /\ reqCount' = reqCount + 1
    /\ limited' = FALSE
    /\ UNCHANGED <<validation, processed, busEvent, busPending, eventConsumed>>

\* NFR-006 AC1：计数达上限 → 429 + Retry-After（限流横切优先于业务响应）
RateLimitHit ==
    /\ reqCount = RATE_LIMIT_MAX
    /\ limited' = TRUE
    /\ UNCHANGED <<reqCount, validation, processed, busEvent, busPending, eventConsumed>>

\* NFR-006 AC1：时间窗口滑动/复位（限流解除，计数清零）
WindowReset ==
    /\ limited = TRUE
    /\ limited' = FALSE
    /\ reqCount' = 0
    /\ UNCHANGED <<validation, processed, busEvent, busPending, eventConsumed>>

(* ---- M-019 入参校验中间件（CON-003） ---- *)

\* CON-003 AC1：zod schema 校验（非法入参 → invalid，400 结构化错误 {error:{code,message}}）
ValidateRequest ==
    /\ processed = FALSE
    /\ validation' \in {"valid", "invalid"}
    /\ UNCHANGED <<reqCount, limited, processed, busEvent, busPending, eventConsumed>>

\* CON-003 AC1 / CON-002：校验通过 → 进入处理（M-020 内存仓储读写）
ProcessValid ==
    /\ validation = "valid"
    /\ processed' = TRUE
    /\ UNCHANGED <<reqCount, limited, validation, busEvent, busPending, eventConsumed>>

\* 单请求处理完成（处理标志复位，等待下一请求）
ResetProcessed ==
    /\ processed = TRUE
    /\ processed' = FALSE
    /\ UNCHANGED <<reqCount, limited, validation, busEvent, busPending, eventConsumed>>

(* ---- M-021 进程内事件总线（支撑 M-012/M-013/M-016） ---- *)

\* 服务层发布业务事件到事件总线（M-004 发布 post.published / M-006 发布 comment.created / M-003 发布 follow.created）
PublishEvent ==
    /\ busEvent = "none"
    /\ busEvent' \in EVENTS
    /\ busPending' = TRUE
    /\ eventConsumed' = FALSE
    /\ UNCHANGED <<reqCount, limited, validation, processed>>

\* 事件投递 → 消费者（M-012 通知 / M-013 订阅 / M-016 Webhook），总线复位
ConsumeEvent ==
    /\ busPending = TRUE
    /\ eventConsumed' = TRUE
    /\ busEvent' = "none"
    /\ busPending' = FALSE
    /\ UNCHANGED <<reqCount, limited, validation, processed>>

Next ==
    \/ RequestArrive
    \/ RateLimitHit
    \/ WindowReset
    \/ ValidateRequest
    \/ ProcessValid
    \/ ResetProcessed
    \/ PublishEvent
    \/ ConsumeEvent

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<reqCount, limited, validation, processed, busEvent, busPending, eventConsumed>>

(* ==================== 拆解决策 ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积
   = |reqCount|(RATE_LIMIT_MAX+1=3) × |limited|2 × |VALIDATIONS|3 × |processed|2
     × |busEvent|(|EVENTS|+1=4) × |busPending|2 × |eventConsumed|2
   = 3 × 2 × 3 × 2 × 4 × 2 × 2 = 576 *)
(* 576 ≤ 1000 → decompositionDecision = "kept-below-threshold"（契约指定值） *)
(* 保留理由：基础设施子系统 7 个变量对应限流/校验/存储/事件总线四个横切模块的强制状态， *)
(*   均为设计文档 §3 模块职责与需求 AC 的强制语义，无法在不省略关键状态的前提下缩减； *)
(*   细粒度拆解（限流令牌桶补充时序、事件负载字段）由阶段 3/4 的 L3/L4 承担 *)
================
