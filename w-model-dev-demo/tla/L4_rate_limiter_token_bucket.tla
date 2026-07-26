---- MODULE L4_rate_limiter_token_bucket ----
EXTENDS Naturals

(*
  @system      blog-system
  @requirement SD-003,DD-COMMON-004,DD-COMMON-005
  @design      docs/detailed-design.md#DD-COMMON-004 RateLimitMiddleware / DD-COMMON-005 TokenBucket
  @parent      tla/L3_login_flow.tla
  @sibling     tla/L4_auth_token_lifecycle.tla
  @child       null
  @level       L4
  @phase       4
*)

(*
 * L4 令牌桶限流器原子行为规格：建模容量 C=10、补充速率 1 token/sec 的令牌桶。
 * 状态流转：consume(request 消耗 1 token) / refill(每秒补充 1 token)
 *           桶满时 refill 不溢出（cap=C）
 *           桶空时 consume 拒绝（返回 429）
 * 对应 DD-COMMON-004 (RateLimitMiddleware) / DD-COMMON-005 (TokenBucket)。
 * 关键不变式：令牌数 ∈ [0, C]；C=10 容量不变；令牌数非负。
 *)

VARIABLES tokens

\* 令牌桶容量（NFR-006：每用户 60 次/分钟，建模为 C=10 简化状态空间）
CAPACITY == 10

\* 令牌数范围
TokenCounts == 0..CAPACITY

Init == tokens = CAPACITY

\* 消耗 1 令牌（请求通过）
ConsumeToken ==
  /\ tokens > 0
  /\ tokens' = tokens - 1

\* 请求被拒（令牌不足，返回 429）
RejectRequest ==
  /\ tokens = 0
  /\ tokens' = 0

\* 补充 1 令牌（每秒补充，未满时 +1）
RefillToken ==
  /\ tokens < CAPACITY
  /\ tokens' = tokens + 1

\* 桶满时补充不溢出（保持 CAPACITY）
RefillAtCapacity ==
  /\ tokens = CAPACITY
  /\ tokens' = CAPACITY

Next ==
  \/ ConsumeToken
  \/ RejectRequest
  \/ RefillToken
  \/ RefillAtCapacity

Spec == Init /\ [][Next]_tokens

\* @designRef docs/detailed-design.md#DD-COMMON-005 令牌数始终在有效范围内
TypeInvariant == tokens \in TokenCounts

\* @designRef docs/detailed-design.md#DD-COMMON-005 容量不变式约束：令牌数永不超过 CAPACITY
CapacityInvariant == tokens <= CAPACITY

\* @designRef docs/detailed-design.md#DD-COMMON-005 令牌数非负约束：令牌数永不为负
NonNegativeTokens == tokens >= 0

\* @designRef docs/detailed-design.md#DD-COMMON-005 业务不变式聚合
BusinessInvariant ==
  /\ TypeInvariant
  /\ CapacityInvariant
  /\ NonNegativeTokens

====
