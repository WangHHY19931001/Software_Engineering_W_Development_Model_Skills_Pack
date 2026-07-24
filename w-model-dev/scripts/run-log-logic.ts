/**
 * 运行日志校验纯逻辑（Run-Log Logic）—— 防止运行日志漂移与 O 越权
 *
 * 对应 w-model-dev/references/data-models.md RunLogEntry schema（§运行日志模型）
 * 与 w-model-dev/references/operational-recovery.md §5.2。
 * 校验：R1 阶段动作完整性 + R2 tokens 非负 + R3 返工记录一致
 *       + R4 acknowledgedDecisions 非空 + R5 O 越权检测 + R6 exitCode 一致
 *       + R7 append-only 时序。
 *
 * 设计原则（与 budget-logic.ts / graph-logic.ts / tla-logic.ts 一致）：
 *   1. 自包含：仅依赖本文件内定义的最小类型形状，不 import 外部模块
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用
 *   3. 单点事实：所有「运行日志是否符合规范」的判定均委托至此
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
    | 'rollback'
    | 'rootcause'
    | 'fix';
  role: 'O' | 'A' | 'S' | 'V' | 'G' | 'R';
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
  // ---- rootcause/fix 扩展字段（spec §5.5）----
  /** rootcause: R 报告 ID；fix: 所基于的 R 报告 ID */
  reportId?: string;
  /** rootcause: 根因分类 */
  rootCauseCategory?: string;
  /** rootcause: 是否存在上游缺陷 */
  upstreamDefect?: boolean;
  /** rootcause: 是否建议回退 */
  rollbackRecommended?: boolean;
  /** fix: 所基于的 R 报告 ID（语义同 reportId，但字段名与 spec 对齐） */
  basedOnReport?: string;
  /** fix: RTM diff */
  rtmDiff?: Record<string, unknown>;
  /** review: 审查目标类型（'rootcause' 表示复审 R 报告） */
  targetKind?: string;
  /** review: 审查目标产物 */
  target?: string;
  /** review: 质量等级 */
  qualityLevel?: string;
  /** review: 是否通过 */
  passed?: boolean;
  /** review: 返工提示 */
  reworkHints?: string[];
  /** rootcause/fix: 返工轮次 */
  round?: number;
  /** gate: 门禁脚本名 */
  script?: string;
}

export interface RunLogCheckOptions {
  /** R3: tla-manifest 的 checkRounds（TLA+ 返工轮数），用于与 run-log rework 记录数比对 */
  tlaCheckRounds?: number;
  /** R5/R6: gate-logs 数据，key = gateLogPath，value = { exitCode?, content } */
  gateLogs?: Map<string, { exitCode?: number; content: string }>;
}

export interface RunLogCheckResult {
  passed: boolean;
  violations: string[];
}

// ==================== 工具函数 ====================

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.trim() !== '';
}

// ==================== 校验入口 ====================

export function checkRunLog(
  entries: unknown,
  options?: RunLogCheckOptions,
): RunLogCheckResult {
  const violations: string[] = [];

  // 输入校验（先做）：非法输入返回 violations 而非抛 TypeError
  if (!Array.isArray(entries)) {
    return { passed: false, violations: ['run-log entries 必须为数组'] };
  }

  // 结构校验：narrow 每个元素为 Partial<RunLogEntry>，缺失必需字段则跳过并记录（容错，不 crash）
  // 必需字段为 R1-R7 实际访问的核心字段：runId / timestamp / phase / action / outcome
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
    if (typeof e.timestamp !== 'string') missing.push('timestamp');
    if (typeof e.phase !== 'number') missing.push('phase');
    if (typeof e.action !== 'string') missing.push('action');
    if (typeof e.outcome !== 'string') missing.push('outcome');
    if (missing.length > 0) {
      violations.push(`条目 ${i + 1} 缺字段 ${missing.join(', ')}`);
      continue;
    }
    valid.push(e as RunLogEntry);
  }

  // R1 阶段动作完整性
  // "已完成阶段"定义：该阶段有 action=checkpoint 且 outcome=success 的记录。
  // 对每个已完成阶段，检查是否含至少 chunk / cross / gate(类) / checkpoint 四类动作。
  const completedPhases = new Set<number>();
  for (const e of valid) {
    if (e.action === 'checkpoint' && e.outcome === 'success') {
      completedPhases.add(e.phase);
    }
  }
  for (const phase of completedPhases) {
    const phaseEntries = valid.filter(e => e.phase === phase);
    const actions = new Set(phaseEntries.map(e => e.action));
    const hasChunk = actions.has('chunk');
    const hasCross = actions.has('cross');
    const hasGate =
      actions.has('gate') || actions.has('tla-gate') || actions.has('graph-gate');
    const hasCheckpoint = actions.has('checkpoint');
    if (!hasChunk) violations.push(`R1: 阶段 ${phase} 缺 chunk 动作`);
    if (!hasCross) violations.push(`R1: 阶段 ${phase} 缺 cross 动作`);
    if (!hasGate) violations.push(`R1: 阶段 ${phase} 缺 gate 类动作`);
    if (!hasCheckpoint) violations.push(`R1: 阶段 ${phase} 缺 checkpoint 动作`);
  }

  // R1 扩展：rootcause/fix 动作字段完整性（spec §7.5）
  for (const e of valid) {
    if (e.action === 'rootcause') {
      if (!isNonEmptyString(e.reportId)) violations.push(`R1: rootcause 动作 ${e.runId} 须含 reportId`);
      if (!isNonEmptyString(e.rootCauseCategory)) violations.push(`R1: rootcause 动作 ${e.runId} 须含 rootCauseCategory`);
      if (typeof e.upstreamDefect !== 'boolean') violations.push(`R1: rootcause 动作 ${e.runId} 须含 upstreamDefect(boolean)`);
      if (typeof e.rollbackRecommended !== 'boolean') violations.push(`R1: rootcause 动作 ${e.runId} 须含 rollbackRecommended(boolean)`);
    }
    if (e.action === 'fix') {
      if (!isNonEmptyString(e.basedOnReport)) violations.push(`R1: fix 动作 ${e.runId} 须含 basedOnReport`);
      if (!Array.isArray(e.artifacts) || e.artifacts.length === 0) violations.push(`R1: fix 动作 ${e.runId} 须含 artifacts(非空数组)`);
    }
  }

  // R2 tokens 非负
  for (const e of valid) {
    if (typeof e.tokens === 'number' && e.tokens < 0) {
      violations.push(`R2: 条目 ${e.runId ?? '?'} tokens 为负: ${e.tokens}`);
    }
    // checkpoint success 须 tokens > 0（除非 note 标注首次/L0）
    // L0 首次或 note 含 "首次" 可豁免——简化：仅当 note 不含 "首次" 时报
    if (
      e.action === 'checkpoint' &&
      e.outcome === 'success' &&
      typeof e.tokens === 'number' &&
      e.tokens === 0
    ) {
      if (!e.note || !e.note.includes('首次')) {
        violations.push(`R2: 条目 ${e.runId ?? '?'} checkpoint success 但 tokens=0`);
      }
    }
  }

  // R3 返工记录一致性（可选校验：仅当 tlaCheckRounds 提供时执行）
  if (options?.tlaCheckRounds !== undefined) {
    const reworkCount = valid.filter(e => e.action === 'rework').length;
    if (reworkCount !== options.tlaCheckRounds) {
      violations.push(
        `R3: run-log rework 记录数 ${reworkCount} 与 tla-manifest.checkRounds ${options.tlaCheckRounds} 不一致`,
      );
    }
  }

  // R3 扩展：rootcause ↔ fix 一一对应 + V 复审 rootcause 记录数 = R 记录数（spec §7.6）
  const rootcauseActions = valid.filter(e => e.action === 'rootcause');
  const fixActions = valid.filter(e => e.action === 'fix');
  const rootcauseReviews = valid.filter(e => e.action === 'review' && e.targetKind === 'rootcause');

  if (rootcauseActions.length !== fixActions.length) {
    violations.push(
      `R3: rootcause 记录数(${rootcauseActions.length}) ≠ fix 记录数(${fixActions.length})，须一一对应`,
    );
  }
  for (const r of rootcauseActions) {
    if (!fixActions.some(f => f.basedOnReport === r.reportId)) {
      violations.push(
        `R3: rootcause 报告 ${r.reportId ?? '?'} 无对应 fix 记录（basedOnReport 缺失）`,
      );
    }
  }
  if (rootcauseReviews.length !== rootcauseActions.length) {
    violations.push(
      `R3: V 复审 rootcause 记录数(${rootcauseReviews.length}) ≠ R 记录数(${rootcauseActions.length})，每份 R 报告须有 V 复审`,
    );
  }

  // R4 acknowledgedDecisions 非空
  for (const e of valid) {
    if (e.action === 'checkpoint' && e.outcome === 'success') {
      if (!Array.isArray(e.acknowledgedDecisions) || e.acknowledgedDecisions.length === 0) {
        violations.push(
          `R4: 条目 ${e.runId ?? '?'} checkpoint success 但 acknowledgedDecisions 为空（O4 Comprehension Debt）`,
        );
      }
    }
  }

  // R5 O 越权检测（可选校验：仅当 gateLogs 提供时执行）
  // 扫描 gate-logs 内容，检测 O 是否绕过 A/S 子代理直接操作 .w-model/*.json
  // 注意：gateLogs Map 可能因 gateLogPath 匹配策略（basename + 绝对路径 + 相对路径）
  //       对同一文件存多 key，此处按 content 去重，避免对同一日志重复报告。
  if (options?.gateLogs) {
    const suspiciousPatterns = [
      /node\s+-e\s+/i, // node -e 直接执行
      /node\s+--eval\s+/i, // node --eval
      /writeFileSync\s*\(\s*['"].*\.w-model\//i, // writeFileSync('.w-model/...')
      /writeFile\s*\(\s*['"].*\.w-model\//i, // writeFile('.w-model/...')
    ];
    const scannedContents = new Set<string>();
    for (const [logPath, logData] of options.gateLogs) {
      if (scannedContents.has(logData.content)) continue;
      scannedContents.add(logData.content);
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(logData.content)) {
          violations.push(
            `R5: gate-log ${logPath} 检测到 O 直接操作 .w-model/ 模式: ${pattern.source}`,
          );
        }
      }
    }
  }

  // R6 exitCode 一致（可选校验：仅当 gateLogs 提供时执行）
  // 交叉校验 run-log 条目 gateExitCode 与 gate-log 存档 exitCode 一致（SSoT §10E 防伪造）
  if (options?.gateLogs) {
    for (const e of valid) {
      if (e.gateLogPath && typeof e.gateExitCode === 'number') {
        const logData = options.gateLogs.get(e.gateLogPath);
        if (!logData) {
          violations.push(
            `R6: 条目 ${e.runId ?? '?'} gateLogPath=${e.gateLogPath} 在 gate-logs 中未找到`,
          );
        } else if (logData.exitCode === undefined) {
          violations.push(`R6: gate-log ${e.gateLogPath} 未提取到 exitCode`);
        } else if (e.gateExitCode !== logData.exitCode) {
          violations.push(
            `R6: 条目 ${e.runId ?? '?'} gateExitCode=${e.gateExitCode} 与 gate-log ${e.gateLogPath} exitCode=${logData.exitCode} 不一致`,
          );
        }
      }
    }
  }

  // R6 扩展：check-rootcause-report.ts gate 须有 exitCode（spec §7.6）
  const rootcauseGateActions = valid.filter(
    e => e.action === 'gate' && e.script === 'check-rootcause-report.ts',
  );
  for (const g of rootcauseGateActions) {
    if (typeof g.gateExitCode !== 'number' || g.gateExitCode === null) {
      violations.push(
        `R6: check-rootcause-report.ts gate 记录 ${g.runId} 缺 gateExitCode`,
      );
    }
  }

  // R7 append-only（时间戳单调递增）
  let prevTimestamp: string | undefined;
  for (const e of valid) {
    if (typeof e.timestamp === 'string' && typeof prevTimestamp === 'string') {
      if (new Date(e.timestamp) < new Date(prevTimestamp)) {
        violations.push(
          `R7: 条目 ${e.runId ?? '?'} 时间戳 ${e.timestamp} 早于前一条 ${prevTimestamp}（非 append-only）`,
        );
      }
    }
    prevTimestamp = e.timestamp;
  }

  // R7 扩展：返工路径时序 rootcause → review(targetKind=rootcause) → fix（spec §7.6）
  for (let i = 0; i < valid.length; i++) {
    if (valid[i].action === 'rootcause') {
      // 后续须先有 review(targetKind=rootcause) 再有 fix
      let j = i + 1;
      while (j < valid.length && valid[j].action !== 'review') j++;
      if (j >= valid.length || valid[j].targetKind !== 'rootcause') {
        violations.push(
          `R7: rootcause 记录 ${valid[i].runId} 后须紧跟 review(targetKind=rootcause)`,
        );
      }
      // fix 须在 review(rootcause) 之后
      while (j < valid.length && valid[j].action !== 'fix') j++;
      if (j >= valid.length) {
        violations.push(
          `R7: rootcause 记录 ${valid[i].runId} 后须有 fix 记录`,
        );
      }
    }
  }

  return { passed: violations.length === 0, violations };
}
