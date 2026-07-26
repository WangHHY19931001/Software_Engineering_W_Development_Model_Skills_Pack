---- MODULE L2_rss_subsystem ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-020
  @design      docs/system-design.md#SD-020 RSS 订阅模块
  @parent      tla/L1_blog_system.tla
  @sibling     null
  @child       null
  @level       L2
  @phase       2
*)

(*
 * L2 RSS 子系统规格：建模 RSS feed 生成状态机。
 * 状态流转：idle → fetching → rendering → done → idle
 * 对应 SD-020 (RSS 订阅源)。
 *)

VARIABLES state

\* RSS 状态枚举：0=idle, 1=fetching, 2=rendering, 3=done
States == 0..3

Init == state = 0

\* 获取已发布文章列表
FetchArticles ==
  /\ state = 0
  /\ state' = 1

\* 获取完成，进入渲染
CompleteFetch ==
  /\ state = 1
  /\ state' = 2

\* 渲染 Atom XML（含 XML 转义）
RenderFeed ==
  /\ state = 2
  /\ state' = 3

\* 输出完成，回到 idle
ResetFeed ==
  /\ state = 3
  /\ state' = 0

Next ==
  \/ FetchArticles
  \/ CompleteFetch
  \/ RenderFeed
  \/ ResetFeed

Spec == Init /\ [][Next]_state

\* @designRef docs/system-design.md#SD-020 RSS 状态始终在有效范围内
TypeInvariant == state \in States

\* @designRef docs/system-design.md#SD-020 RSS 状态边界约束
ValidRssState == state >= 0 /\ state <= 3

\* @designRef docs/system-design.md#SD-020 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ ValidRssState

====
