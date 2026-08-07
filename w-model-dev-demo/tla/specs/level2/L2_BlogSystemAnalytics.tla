(*
  @system        blog-system::analytics_subsystem
  @requirement   SD-005, REQ-024, REQ-025, REQ-026
  @design        docs/phase2-design/blog-system-system-design.md:§3.2
  @designIds     SD-005
  @parent        ../tla/specs/level1/L1_BlogSystem.tla
  @sibling       ../tla/specs/level2/L2_BlogSystemAuth.tla, ../tla/specs/level2/L2_BlogSystemContent.tla, ../tla/specs/level2/L2_BlogSystemInteraction.tla, ../tla/specs/level2/L2_BlogSystemDiscovery.tla, ../tla/specs/level2/L2_BlogSystemIntegration.tla, ../tla/specs/level2/L2_BlogSystemInfrastructure.tla
  @child         ../tla/specs/level3/L3_BlogSystemReadingDedup.tla
  @level         L2
  @phase         2
*)
---- MODULE L2_BlogSystemAnalytics ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    MaxViews    \* 单文章阅读量计数上界（REQ-024 小模型；生产无界，测试取 2）

ASSUME MaxViews > 0

(* ==================== 变量 ==================== *)
VARIABLES
    viewCount,           \* 详情访问阅读量（0..MaxViews，REQ-024）
    visitWindowActive,   \* 同 IP 短窗口去重窗口是否开启（REQ-024，默认 5 分钟）
    panelUpToDate,       \* 博主统计面板数据是否最新（REQ-025）
    eventKind,           \* 待通知事件类型：none / comment / like / follow_publish（REQ-026）
    notificationState    \* 通知状态：none / unread / read（REQ-026）

vars == <<viewCount, visitWindowActive, panelUpToDate, eventKind, notificationState>>

(* ==================== 状态不变式（TypeOK） ==================== *)
\* Invariant: 全部状态变量的类型约束
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.2
TypeOK ==
    /\ viewCount \in 0..MaxViews
    /\ visitWindowActive \in BOOLEAN
    /\ panelUpToDate \in BOOLEAN
    /\ eventKind \in {"none", "comment", "like", "follow_publish"}
    /\ notificationState \in {"none", "unread", "read"}

(* ==================== 业务不变式 ==================== *)
\* Invariant: 通知必由三类事件产生（评论/点赞/关注发文——REQ-026）
\* @designRef docs/phase2-design/blog-system-system-design.md:§1.4 通知事件数据流
NotificationRequiresEvent ==
    notificationState # "none" => eventKind # "none"

\* Invariant: 已读通知必有对应事件（标记已读 PATCH——REQ-026）
\* @designRef docs/phase2-design/blog-system-system-design.md:§4 INTF-020
ReadRequiresEvent ==
    notificationState = "read" => eventKind # "none"

\* Invariant: 统计面板必反映阅读数据（面板含总阅读量——REQ-025）
\* @designRef docs/phase2-design/blog-system-system-design.md:§4 INTF-019
PanelUpToDateRequiresViews ==
    panelUpToDate => viewCount >= 1

\* Invariant: 去重窗口必在访问后开启（同 IP 短窗口去重——REQ-024）
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.1 SD-005 职责 / D-05
ViewGrowthWindowDedup ==
    visitWindowActive => viewCount >= 1

(* ==================== 业务不变式聚合（BusinessInvariant） ==================== *)
(* 聚合全部子不变式（含 TypeOK）；.cfg 的 INVARIANTS 列表须与此展开集合一致 *)
BusinessInvariant ==
    /\ TypeOK
    /\ NotificationRequiresEvent
    /\ ReadRequiresEvent
    /\ PanelUpToDateRequiresViews
    /\ ViewGrowthWindowDedup

(* ==================== 初始状态 ==================== *)
Init ==
    /\ viewCount = 0
    /\ visitWindowActive = FALSE
    /\ panelUpToDate = FALSE
    /\ eventKind = "none"
    /\ notificationState = "none"

(* ==================== 状态转移（Next） ==================== *)
(* ---- 阅读统计（REQ-024）：详情访问 +1，同 IP 短窗口去重 ---- *)
RecordVisit ==
    /\ viewCount < MaxViews
    /\ visitWindowActive = FALSE
    /\ viewCount' = viewCount + 1
    /\ visitWindowActive' = TRUE
    /\ UNCHANGED <<panelUpToDate, eventKind, notificationState>>

(* REQ-024：同 IP 短窗口内重复访问去重（计数不变） *)
VisitDeduped ==
    /\ visitWindowActive
    /\ UNCHANGED vars

(* REQ-024：去重窗口到期（默认 5 分钟，D-05 参数化） *)
WindowExpire ==
    /\ visitWindowActive
    /\ visitWindowActive' = FALSE
    /\ UNCHANGED <<viewCount, panelUpToDate, eventKind, notificationState>>

(* ---- 博主统计面板（REQ-025）：文章数/总阅读量/总评论数/近 7 天趋势 ---- *)
RefreshPanel ==
    /\ panelUpToDate = FALSE
    /\ viewCount >= 1
    /\ panelUpToDate' = TRUE
    /\ UNCHANGED <<viewCount, visitWindowActive, eventKind, notificationState>>

InvalidatePanel ==
    /\ panelUpToDate
    /\ panelUpToDate' = FALSE
    /\ UNCHANGED <<viewCount, visitWindowActive, eventKind, notificationState>>

(* ---- 通知（REQ-026）：评论/点赞/关注发文三类事件产生通知，标记已读 ---- *)
GenerateCommentEvent ==
    /\ eventKind = "none"
    /\ notificationState = "none"
    /\ eventKind' = "comment"
    /\ notificationState' = "unread"
    /\ UNCHANGED <<viewCount, visitWindowActive, panelUpToDate>>

GenerateLikeEvent ==
    /\ eventKind = "none"
    /\ notificationState = "none"
    /\ eventKind' = "like"
    /\ notificationState' = "unread"
    /\ UNCHANGED <<viewCount, visitWindowActive, panelUpToDate>>

GenerateFollowPublishEvent ==
    /\ eventKind = "none"
    /\ notificationState = "none"
    /\ eventKind' = "follow_publish"
    /\ notificationState' = "unread"
    /\ UNCHANGED <<viewCount, visitWindowActive, panelUpToDate>>

MarkNotificationRead ==
    /\ notificationState = "unread"
    /\ notificationState' = "read"
    /\ UNCHANGED <<viewCount, visitWindowActive, panelUpToDate, eventKind>>

Next ==
    \/ RecordVisit
    \/ VisitDeduped
    \/ WindowExpire
    \/ RefreshPanel
    \/ InvalidatePanel
    \/ GenerateCommentEvent
    \/ GenerateLikeEvent
    \/ GenerateFollowPublishEvent
    \/ MarkNotificationRead

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_vars

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积：
   3(viewCount 0..2) x 2(visitWindowActive) x 2(panelUpToDate)
   x 4(eventKind) x 3(notificationState) = 144
   <= 1000: kept-below-threshold（子系统粒度，未触及拆解阈值） *)
====
