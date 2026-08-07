# @req: CON-004, NFR-002
# @design: SD-007
# @designIds: SD-007
# @system: L4_blog_system_audit_log
# @tla-spec: L4_BlogSystemAuditLog
# @state-machine: SM-L4_BlogSystemAuditLog
# @parent-features: L3_blog_system_rate_limit-001.feature
# @sibling-features: L4_blog_system_article_store-001.feature, L4_blog_system_audit_log-001.feature, L4_blog_system_rate_limit_window-001.feature, L4_blog_system_token_store-001.feature
# @child-features: (none)
# @scenario-id-prefix: BDD-L4
Feature: 审计日志原子方法行为（追加/年龄推进/保留期清理/敏感字段排除）
  作为基础设施模块的审计日志存储（DD-049 AuditLogStore + DD-043 auditMiddleware）
  我希望完成审计记录追加、时间推进、保留期满清理的原子方法流转，并保证记录不含密码令牌等敏感字段
  以便为关键操作留痕提供与 L4 TLA+ 规格等价的保留期与白名单基线（CON-004/NFR-002/RH-01）

Background:
  # @states: empty, active
  # @initial-state: empty
  # @terminal-states: ()
  # @accepting-states: active
  # @rejecting-states: ()
  # @transitions:
  #   empty + appendLog -> active [action: writeAuditLog]
  #   active + appendLog -> active [guard: belowCapacity] [action: writeAuditLog]
  #   active + advanceTime -> active [action: ageRecords]
  #   active + pruneExpired -> empty [guard: oldestAtRetention] [action: deleteOldest]
  # @invariants:
  #   active => noSensitiveFieldsRecorded
  Given 系统处于初始状态

@CON-004 @UT-049 @BDD-L4-001 @high
Scenario: 关键操作触发审计记录追加进入保留态
  Given 系统处于 "empty" 状态
  And 登录或发布或删除等关键操作已发生
  When 模块执行审计记录追加处理 (appendLog)
  Then 系统应转移到 "active" 状态
  And 不变式 "active => noSensitiveFieldsRecorded" 应成立

@CON-004 @NFR-002 @UT-043 @BDD-L4-002 @high
Scenario: 审计记录仅含白名单字段不记录明文凭据
  Given 系统处于 "active" 状态
  And 请求上下文包含密码与令牌等敏感字段
  When 模块执行审计记录追加处理 (appendLog)
  Then 系统应保持在 "active" 状态
  And 不变式 "active => noSensitiveFieldsRecorded" 应成立

@CON-004 @UT-049 @BDD-L4-003 @medium
Scenario: 时间推进使在库审计记录年龄增长
  Given 系统处于 "active" 状态
  And 系统时钟向前推进
  When 模块执行记录年龄推进处理 (advanceTime)
  Then 系统应保持在 "active" 状态

@CON-004 @UT-049 @BDD-L4-004 @medium
Scenario: 最旧记录达到保留期被清理
  Given 系统处于 "active" 状态
  And 最旧记录年龄已达保留期
  When 模块执行保留期满清理处理 (pruneExpired)
  Then 系统应转移到 "empty" 状态

@CON-004 @UT-043 @UT-049 @BDD-L4-005 @low
Scenario: 追加年龄推进清理的完整保留周期
  Given 系统处于 "empty" 状态
  When 模块执行审计记录追加处理 (appendLog)
  And 模块执行记录年龄推进处理 (advanceTime)
  And 模块执行保留期满清理处理 (pruneExpired)
  Then 系统应转移到 "empty" 状态
