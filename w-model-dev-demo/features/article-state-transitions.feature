# @req: REQ-006,REQ-007,REQ-008
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
