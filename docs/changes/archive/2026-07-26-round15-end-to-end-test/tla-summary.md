# TLA+ 规格清单

> TLA+ 规格清单（L1/L2/L3/L4 ID + 不变式列表）。22 个规格全通过 SANY 语法 + TLC 零违反。

## 层级分布

| 层级 | 数量 | 阶段 | 用途 |
|---|---|---|---|
| L1 | 1 | 阶段 1 | 系统交互规格（根规格） |
| L2 | 9 | 阶段 2 | 子系统行为 + 交互规格 |
| L3 | 7 | 阶段 3 | 原子子系统行为规格 |
| L4 | 5 | 阶段 4 | 原子模块行为规格（状态机/算法） |
| **合计** | **22** | | |

## L1 规格（1 个）

| ID | 规格 | 变量组合 | 不变式 | 状态 |
|---|---|---|---|---|
| L1-blog-system | L1_blog_system.tla | 32 | TypeInvariant, RateLimitRespected, AuditRetentionBounded | TLC 零违反 |

## L2 规格（9 个）

| ID | 规格 | 变量组合 | 关联 SD/REQ | 状态 |
|---|---|---|---|---|
| L2-blog-mgmt | L2_blog_mgmt.tla | 27 | SD-001~003, REQ-001~003 | TLC 零违反 |
| L2-blogger-mgmt | L2_blogger_mgmt.tla | 18 | SD-004~006, REQ-004~006 | TLC 零违反 |
| L2-user-mgmt | L2_user_mgmt.tla | 18 | SD-007~009, REQ-007~009 | TLC 零违反 |
| L2-comment | L2_comment.tla | 18 | SD-010~011, REQ-010~011 | TLC 零违反 |
| L2-notification | L2_notification.tla | 18 | SD-012, REQ-012 | TLC 零违反 |
| L2-search | L2_search.tla | 18 | SD-013, REQ-013 | TLC 零违反 |
| L2-taxonomy | L2_taxonomy.tla | 18 | SD-014~015, REQ-014~015 | TLC 零违反 |
| L2-recommendation-ads | L2_recommendation_ads.tla | 18 | SD-016~017, REQ-016~017 | TLC 零违反 |
| L2-stats-audit-site | L2_stats_audit_site.tla | 27 | SD-018~022, REQ-018~022 | TLC 零违反 |

## L3 规格（7 个）

| ID | 规格 | 变量组合 | 关联 SD/REQ | 状态 |
|---|---|---|---|---|
| L3-blog-crud | L3_blog_crud.tla | 45 | SD-001, REQ-001 | TLC 零违反 |
| L3-blogger-follow | L3_blogger_follow.tla | 12 | SD-006, REQ-006 | TLC 零违反 |
| L3-user-auth | L3_user_auth.tla | 54 | SD-007, REQ-007 | TLC 零违反 |
| L3-comment-moderation | L3_comment_moderation.tla | 81 | SD-011, REQ-011 | TLC 零违反 |
| L3-search-index | L3_search_index.tla | 30 | SD-013, REQ-013 | TLC 零违反 |
| L3-taxonomy-tree | L3_taxonomy_tree.tla | 24 | SD-015, REQ-015 | TLC 零违反 |
| L3-audit-log-retention | L3_audit_log_retention.tla | 36 | SD-022, REQ-022 | TLC 零违反 |

## L4 规格（5 个）

| ID | 规格 | 变量组合 | 关联 SD/REQ | 不变式 | 状态 |
|---|---|---|---|---|---|
| L4-blog-state-machine | L4_blog_state_machine.tla | 18 | SD-002, REQ-002 | StateMachineValid | TLC 零违反 |
| L4-user-session | L4_user_session.tla | 18 | SD-007, REQ-007 | SessionConsistent | TLC 零违反 |
| L4-comment-workflow | L4_comment_workflow.tla | 18 | SD-011, REQ-011 | WorkflowValid | TLC 零违反 |
| L4-token-bucket | L4_token_bucket.tla | 16 | SD-007, NFR-006 | RateLimitRespected | TLC 零违反 |
| L4-audit-log-rotation | L4_audit_log_rotation.tla | 24 | SD-022, REQ-022, CON-004 | oldestLogAge<=30 | TLC 零违反 |

## 不变式汇总

| 不变式 | 所属规格 | 含义 |
|---|---|---|
| TypeInvariant | L1 | 类型不变式 |
| RateLimitRespected | L1, L4-token-bucket | 限流不变式（100 req/min） |
| AuditRetentionBounded | L1 | 审计日志保留有界（30 天） |
| StateMachineValid | L4-blog-state-machine | 博文状态机合法转移 |
| SessionConsistent | L4-user-session | 用户会话一致 |
| WorkflowValid | L4-comment-workflow | 评论审核工作流合法 |
| oldestLogAge<=30 | L4-audit-log-rotation | 审计日志最大保留 30 天 |

## 校验工具

- **SANY 语法检查**：22 规格全通过
- **TLC 模型检查**：22 规格零违反、零死锁、零状态爆炸
- **Java 版本**：Java 21
- **最大变量组合**：81（L3-comment-moderation），远低于 1k 拆分阈值
- **拆分决策**：全部 kept-below-threshold（无需拆分）
