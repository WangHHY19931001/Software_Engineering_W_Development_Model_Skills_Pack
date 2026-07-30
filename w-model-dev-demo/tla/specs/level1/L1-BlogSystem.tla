(* @system        blog-system-demo
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
   公平性: WF_vars(ProcessRequest \/ SendResponse)

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

ASSUME /\ Request # {}
       /\ Response # {}

VARIABLES systemState, pendingRequests, processedResponses, currentReqId, totalProcessed

SystemStates == {"INIT", "RUNNING", "SHUTDOWN"}

vars == <<systemState, pendingRequests, processedResponses, currentReqId, totalProcessed>>

\* =====================================================================
\* 类型约束
\* =====================================================================
TypeOK ==
  /\ systemState \in SystemStates
  /\ pendingRequests \subseteq Request
  /\ processedResponses \subseteq Response
  /\ currentReqId \in Nat
  /\ totalProcessed \in Nat

\* =====================================================================
\* 初始状态
\* =====================================================================
Init ==
  /\ systemState = "INIT"
  /\ pendingRequests = {}
  /\ processedResponses = {}
  /\ currentReqId = 0
  /\ totalProcessed = 0

\* =====================================================================
\* 转移 1: 启动系统
\* 触发: 外部 StartSystem 事件
\* 守卫: 当前处于 INIT 状态
\* 动作: systemState := "RUNNING"
\* =====================================================================
StartSystem ==
  /\ systemState = "INIT"
  /\ systemState' = "RUNNING"
  /\ UNCHANGED <<pendingRequests, processedResponses, currentReqId, totalProcessed>>

\* =====================================================================
\* 转移 2: 接收外部请求
\* 触发: EXT-IN actor (blogger/reader/admin) 发送 HTTP 请求
\* 守卫: 系统处于 RUNNING；req 不在已入队集合（幂等）
\* 动作: req 并入 pendingRequests；currentReqId 累加
\* =====================================================================
ReceiveRequest(req) ==
  /\ systemState = "RUNNING"
  /\ req \in Request
  /\ req \notin pendingRequests
  /\ pendingRequests' = pendingRequests \cup {req}
  /\ currentReqId' = currentReqId + 1
  /\ UNCHANGED <<systemState, processedResponses, totalProcessed>>

\* =====================================================================
\* 转移 3: 内部处理请求
\* 触发: 系统内部调度
\* 守卫: pendingRequests 非空
\* 动作: 取出一个 req，产出一个 resp 并入 processedResponses
\*       req -> resp 映射由 L2 子系统层刻画（此处非确定选取）
\* =====================================================================
ProcessRequest ==
  /\ systemState = "RUNNING"
  /\ pendingRequests # {}
  /\ \E req \in pendingRequests, resp \in Response :
        /\ pendingRequests' = pendingRequests \ {req}
        /\ processedResponses' = processedResponses \cup {resp}
        /\ totalProcessed' = totalProcessed + 1
  /\ UNCHANGED <<systemState, currentReqId>>

\* =====================================================================
\* 转移 4: 发送响应
\* 触发: 系统将已处理响应输出
\* 守卫: processedResponses 非空
\* 动作: 从 processedResponses 取出一个 resp 移除（已发往 EXT-OUT）
\* =====================================================================
SendResponse ==
  /\ systemState = "RUNNING"
  /\ processedResponses # {}
  /\ \E resp \in processedResponses :
        processedResponses' = processedResponses \ {resp}
  /\ UNCHANGED <<systemState, pendingRequests, currentReqId, totalProcessed>>

\* =====================================================================
\* 转移 5: 关闭系统
\* 触发: 外部 ShutdownSystem 事件
\* 守卫: 当前处于 RUNNING；pendingRequests 已排空
\* 动作: systemState := "SHUTDOWN"
\* =====================================================================
ShutdownSystem ==
  /\ systemState = "RUNNING"
  /\ pendingRequests = {}
  /\ systemState' = "SHUTDOWN"
  /\ UNCHANGED <<pendingRequests, processedResponses, currentReqId, totalProcessed>>

\* =====================================================================
\* 转移 6: SHUTDOWN 拒绝新请求
\* 触发: SHUTDOWN 状态下任何 ReceiveRequest
\* 守卫: 系统处于 SHUTDOWN
\* 动作: 自环（拒绝请求，状态不变）
\* =====================================================================
RejectWhenShutdown ==
  /\ systemState = "SHUTDOWN"
  /\ UNCHANGED vars

\* =====================================================================
\* 下一状态动作
\* =====================================================================
Next ==
  \/ StartSystem
  \/ \E req \in Request : ReceiveRequest(req)
  \/ ProcessRequest
  \/ SendResponse
  \/ ShutdownSystem
  \/ RejectWhenShutdown

Spec == Init /\ [][Next]_vars /\ WF_vars(ProcessRequest \/ SendResponse)

\* =====================================================================
\* 不变式（INVARIANT）
\* =====================================================================
InitInvariant == systemState = "INIT" => pendingRequests = {}
ShutdownInvariant == systemState = "SHUTDOWN" => pendingRequests = {}
NoNewRequestInShutdown == systemState = "SHUTDOWN" => currentReqId' = currentReqId

\* =====================================================================
\* 公平性条件（PROPERTY）
\* =====================================================================
FairnessInvariant == [](systemState = "RUNNING" => <> (pendingRequests # {} \/ processedResponses # {}))

Invariants ==
  /\ TypeOK
  /\ InitInvariant
  /\ ShutdownInvariant
====
