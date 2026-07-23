/**
 * Checkpoint 校验纯逻辑（Checkpoint Logic）—— 防止 checkpoint 决策漂移与 O 自问自答
 *
 * 对应 w-model-dev/references/data-models.md RunLogEntry schema（§运行日志模型）
 * 与 docs/superpowers/specs/2026-07-23-w-model-dev-correction-design.md §5.4。
 * 校验：R1 acknowledgedDecisions 非空 + R2 决策内容具体（黑名单/长度/名词）
 *       + R3 用户确认存在 + R4 决策与阶段匹配 + R5 跨阶段证据一致。
 *
 * 设计原则（与 budget-logic.ts / run-log-logic.ts / maturity-logic.ts 一致）：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状，不 import 外部模块
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用
 *   3. 单点事实：所有「checkpoint 是否符合规范」的判定均委托至此
 */

// ==================== 自包含类型形状 ====================

export interface RunLogEntry {
  runId: string;
  timestamp: string;
  phase: number;
  phaseName: string;
  action:
    | 'chunk'
    | 'cross'
    | 'evolve'
    | 'produce'
    | 'review'
    | 'gate'
    | 'tla-gate'
    | 'graph-gate'
    | 'test'
    | 'checkpoint'
    | 'rework'
    | 'rollback';
  role: 'O' | 'A' | 'S' | 'V' | 'G';
  duration_s: number;
  tokens: number;
  estimated: boolean;
  subagentSpawns: number;
  gateExitCode: number | null;
  gateLogPath?: string;
  outcome: 'success' | 'fail' | 'rework' | 'escalate' | 'blocked' | 'cancelled';
  acknowledgedDecisions?: string[];
  note?: string;
  artifacts?: string[];
}

export interface CheckpointCheckOptions {
  /** R3: checkpoint-log 用户确认数据，key = phase（如 "1"/"2"/"3"），value = 用户确认原文 */
  checkpointLog?: Map<string, string>;
}

export interface CheckpointCheckResult {
  passed: boolean;
  violations: string[];
}

// ==================== R2 规则常量 ====================

// 泛化模板黑名单（大小写敏感，OK/yes 英文原样）
const BLACKLIST = new Set<string>([
  '确认放行',
  '继续',
  '通过',
  'OK',
  'yes',
  '好的',
  '同意',
]);

// 具体名词识别：ID 模式（满足任一即通过）
const ID_PATTERNS: RegExp[] = [
  /REQ-\d+/,
  /SD-[\d.]+/,
  /INTF-[\d.]+/,
  /DD-[\d.]+/,
  /TC-\w+-\d+/,
];

// 具体名词识别：技术关键词（中英，满足任一即通过）
const TECH_KEYWORDS = [
  'REST', 'GraphQL', 'JWT', 'OAuth', 'SQLite', 'PostgreSQL', 'Redis', 'Koa', 'Express',
  'React', 'Vue', 'TypeScript', 'WebSocket', 'HTTP', 'API', 'CRUD',
  '认证', '鉴权', '缓存', '存储', '模块', '接口', '表', '字段', '状态机', '不变式',
  '需求', '设计', '架构', '数据库', '前端', '后端', '网关', '队列', '事务', '锁', '索引',
];

// ==================== R4 阶段关键词 ====================

// 阶段 5-8 暂不强制（关键词集为空/缺省则跳过）
const PHASE_KEYWORDS: Record<number, string[]> = {
  1: ['需求', 'REQ', '用户故事', '验收', '功能', '非功能', '约束', '优先级'],
  2: ['系统', '架构', 'SD', '子系统', '组件', '分层', '部署', '拓扑'],
  3: ['接口', 'INTF', '模块', '交互', '序列', '协议', '契约'],
  4: ['详细', 'DD', '数据结构', '算法', '类图', '字段', '状态'],
};

// ==================== R5 否定关键词 ====================

// 后阶段决策含任一否定关键词 + 该阶段无 rework/rollback → 疑似静默推翻
const NEGATION_KEYWORDS = [
  '否定', '推翻', '否决', '废弃', '不用', '放弃', '改为', '改用', '替换',
  '移除', '删除', '撤销', '回退', '取消', '不采用',
];

// ==================== 校验入口 ====================

export function checkCheckpoint(
  entries: unknown,
  options?: CheckpointCheckOptions,
): CheckpointCheckResult {
  const violations: string[] = [];

  // 输入校验（先做）：非法输入返回 violations 而非抛 TypeError
  if (!entries || !Array.isArray(entries)) {
    return { passed: false, violations: ['checkpoint entries 必须为数组'] };
  }

  // 结构校验：narrow 每个元素为 Partial<RunLogEntry>，缺失必需字段则跳过并记录（容错，不 crash）
  // 必需字段为 R1-R5 实际访问的核心字段：runId / phase / action / outcome
  const valid: RunLogEntry[] = [];
  for (let i = 0; i < entries.length; i++) {
    const raw = entries[i];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      violations.push(`条目 ${i + 1} 非对象，已跳过`);
      continue;
    }
    const e = raw as Partial<RunLogEntry>;
    const missing: string[] = [];
    if (typeof e.runId !== 'string') missing.push('runId');
    if (typeof e.phase !== 'number') missing.push('phase');
    if (typeof e.action !== 'string') missing.push('action');
    if (typeof e.outcome !== 'string') missing.push('outcome');
    if (missing.length > 0) {
      violations.push(`条目 ${i + 1} 缺字段 ${missing.join(', ')}`);
      continue;
    }
    valid.push(e as RunLogEntry);
  }

  // 收集 checkpoint success 记录（R1-R4 的校验对象）
  const checkpoints = valid.filter(
    e => e.action === 'checkpoint' && e.outcome === 'success',
  );

  // R1 acknowledgedDecisions 非空
  // 每个 checkpoint success 须有 ≥1 条 acknowledgedDecisions，防空决策放行（O4 / D19）
  for (const e of checkpoints) {
    if (
      !Array.isArray(e.acknowledgedDecisions) ||
      e.acknowledgedDecisions.length === 0
    ) {
      violations.push(
        `R1: 条目 ${e.runId} checkpoint success 但 acknowledgedDecisions 为空（O4 Comprehension Debt / D19）`,
      );
    }
  }

  // R2 决策内容具体（黑名单 + 长度 + 名词）
  // 对每条 checkpoint success 的每条 acknowledgedDecision 逐项检查：
  //   黑名单命中 → 报黑名单违规（同条决策不再重复报长度/名词，避免噪声）
  //   长度 < 10  → 报长度违规（同条决策不再重复报名词）
  //   无具体名词 → 报名词违规
  for (const e of checkpoints) {
    if (!Array.isArray(e.acknowledgedDecisions)) continue;
    for (const decision of e.acknowledgedDecisions) {
      if (typeof decision !== 'string') continue;
      // 1. 黑名单检查（大小写敏感，OK/yes 英文原样）
      if (BLACKLIST.has(decision)) {
        violations.push(
          `R2: 条目 ${e.runId} 决策 "${decision}" 命中泛化模板黑名单`,
        );
        continue;
      }
      // 2. 长度检查（字符数，中英文都算 1）
      if (decision.length < 10) {
        violations.push(`R2: 条目 ${e.runId} 决策 "${decision}" 长度 < 10`);
        continue;
      }
      // 3. 具体名词检查（启发式）：ID 模式 或 技术关键词，满足任一即通过
      const hasId = ID_PATTERNS.some(p => p.test(decision));
      const hasTech = TECH_KEYWORDS.some(k => decision.includes(k));
      if (!hasId && !hasTech) {
        violations.push(
          `R2: 条目 ${e.runId} 决策 "${decision}" 未含具体名词（技术方案/模块/接口/数据结构名）`,
        );
      }
    }
  }

  // R3 用户确认存在（可选校验：仅当 checkpointLog 提供时执行）
  // 对每个 checkpoint success，查 checkpointLog.get(String(phase))；
  // 不存在或为空 → 疑似 O 自问自答（D19）。options 未提供 → 跳过 R3（不报违规）
  if (options?.checkpointLog) {
    for (const e of checkpoints) {
      const userConfirm = options.checkpointLog.get(String(e.phase));
      if (!userConfirm || userConfirm.trim() === '') {
        violations.push(
          `R3: 阶段 ${e.phase} checkpoint 缺用户确认记录（疑似 O 自问自答 / D19）`,
        );
      }
    }
  }

  // R4 决策与阶段匹配
  // 若该阶段关键词集非空，且决策完全不含任何该阶段关键词 → 与阶段主题不匹配
  // 阶段 5-8 关键词集为空/缺省 → 跳过
  for (const e of checkpoints) {
    const keywords = PHASE_KEYWORDS[e.phase];
    if (!keywords || keywords.length === 0) continue;
    if (!Array.isArray(e.acknowledgedDecisions)) continue;
    for (const decision of e.acknowledgedDecisions) {
      if (typeof decision !== 'string') continue;
      const matches = keywords.some(k => decision.includes(k));
      if (!matches) {
        violations.push(
          `R4: 条目 ${e.runId} 阶段 ${e.phase} 决策 "${decision}" 与阶段主题不匹配`,
        );
      }
    }
  }

  // R5 跨阶段证据一致（检测"静默推翻"）
  // 目标：检测后阶段决策否定前阶段已放行决策，且无对应 rework/rollback 记录。
  // 算法：收集 rework/rollback 的 phase 集合 → 对每条 checkpoint 决策检测否定关键词
  //       → 含否定关键词 且 该阶段无 rework/rollback → 疑似静默推翻（D19）
  // 注意：R5 是启发式检测，宁可漏报不可误报。仅当同时满足两条件才报。
  const reworkedPhases = new Set<number>();
  for (const e of valid) {
    if (e.action === 'rework' || e.action === 'rollback') {
      reworkedPhases.add(e.phase);
    }
  }
  for (const e of checkpoints) {
    if (!Array.isArray(e.acknowledgedDecisions)) continue;
    for (const decision of e.acknowledgedDecisions) {
      if (typeof decision !== 'string') continue;
      const hasNegation = NEGATION_KEYWORDS.some(k => decision.includes(k));
      if (hasNegation && !reworkedPhases.has(e.phase)) {
        violations.push(
          `R5: 阶段 ${e.phase} 决策 "${decision}" 含否定语义，但该阶段无 rework/rollback 记录，疑似静默推翻前阶段决策（D19）`,
        );
      }
    }
  }

  return { passed: violations.length === 0, violations };
}
