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

import { validateBySchema } from './schema-loader.js';

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
    | 'fix'
    | 'r3-completeness'
    | 'r3-reliability'
    | 'r3-security';
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
  /** R3: 当前阶段编号，用于按阶段过滤 rework 条目 */
  phase?: number;
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
    // === Schema 前置校验（借鉴点 2） ===
    const schemaResult = validateBySchema('run-log', raw);
    if (!schemaResult.valid) {
      // schema 拒绝：记录 [schema] 前缀违规并跳过该条
      for (const m of schemaResult.errorMessages) {
        violations.push(`条目 ${i + 1} [schema] ${m}`);
      }
      continue;
    }
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
  // 对每个已完成阶段，按阶段分档检查动作完整性：
  //   阶段 1-4：chunk / cross / gate(类) / checkpoint
  //   阶段 5-8：produce / review / gate(类) / checkpoint
  const completedPhases = new Set<number>();
  for (const e of valid) {
    if (e.action === 'checkpoint' && e.outcome === 'success') {
      completedPhases.add(e.phase);
    }
  }
  for (const phase of completedPhases) {
    const phaseEntries = valid.filter(e => e.phase === phase);
    const actions = new Set(phaseEntries.map(e => e.action));
    const hasGate =
      actions.has('gate') || actions.has('tla-gate') || actions.has('graph-gate');
    const hasCheckpoint = actions.has('checkpoint');
    if (phase >= 1 && phase <= 4) {
      if (!actions.has('chunk')) violations.push(`R1: 阶段 ${phase} 缺 chunk 动作`);
      if (!actions.has('cross')) violations.push(`R1: 阶段 ${phase} 缺 cross 动作`);
    } else {
      if (!actions.has('produce')) violations.push(`R1: 阶段 ${phase} 缺 produce 动作`);
      if (!actions.has('review')) violations.push(`R1: 阶段 ${phase} 缺 review 动作`);
    }
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
  // 按 phase 过滤 + 仅统计 target/note 含 TLA 的返工，与 tla-manifest checkRounds 语义对齐
  if (options?.tlaCheckRounds !== undefined) {
    let reworkEntries = valid.filter(e => e.action === 'rework');
    if (options.phase !== undefined) {
      reworkEntries = reworkEntries.filter(e => e.phase === options.phase);
    }
    const tlaReworkCount = reworkEntries.filter(
      e => (e.note && /TLA/i.test(e.note)) || (e.target && /TLA/i.test(e.target)),
    ).length;
    if (tlaReworkCount !== options.tlaCheckRounds) {
      violations.push(
        `R3: run-log TLA rework 记录数 ${tlaReworkCount} 与 tla-manifest.checkRounds ${options.tlaCheckRounds} 不一致`,
      );
    }
  }

  // R3 扩展：rootcause ↔ fix 通过 reportId 映射（去重后比较，一个 fix 可覆盖多份 R 报告）
  const rootcauseActions = valid.filter(e => e.action === 'rootcause');
  const fixActions = valid.filter(e => e.action === 'fix');
  const rootcauseReviews = valid.filter(e => e.action === 'review' && e.targetKind === 'rootcause');

  // 收集所有唯一的 reportId
  const uniqueReportIds = new Set(
    rootcauseActions.map(r => r.reportId).filter((id): id is string => typeof id === 'string' && id.trim() !== ''),
  );
  const coveredReportIds = new Set<string>();
  for (const f of fixActions) {
    if (typeof f.basedOnReport === 'string' && f.basedOnReport.trim() !== '') {
      for (const rid of f.basedOnReport.split(/[;,]\s*/)) {
        const trimmed = rid.trim();
        if (trimmed) coveredReportIds.add(trimmed);
      }
    }
  }

  // 每个唯一 reportId 须有至少一个 fix
  for (const rid of uniqueReportIds) {
    if (!coveredReportIds.has(rid)) {
      violations.push(
        `R3: rootcause 报告 ${rid} 无对应 fix 记录（basedOnReport 缺失）`,
      );
    }
  }

  // V 复审 rootcause 记录按 reportId（target 字段）去重计数
  const reviewedReportIds = new Set(
    rootcauseReviews.map(r => r.target).filter((t): t is string => typeof t === 'string' && t.trim() !== ''),
  );
  if (reviewedReportIds.size !== uniqueReportIds.size) {
    violations.push(
      `R3: V 复审 rootcause 记录数(${reviewedReportIds.size}) ≠ R 记录数(${uniqueReportIds.size})，每份 R 报告须有 V 复审`,
    );
  }

  // ==================== R3 预防性审查记录校验（第22轮新增） ====================
  // 校验：每个阶段的 S→V 之间须有 3 条 R3 记录（completeness/reliability/security）
  const r3Dimensions = ['completeness', 'reliability', 'security'];
  const phaseEntries = new Map<number, Array<{ role: string; action: string }>>();

  for (const entry of valid) {
    if (!entry || typeof entry.phase !== 'number') continue;
    if (!phaseEntries.has(entry.phase)) phaseEntries.set(entry.phase, []);
    phaseEntries.get(entry.phase)!.push({ role: entry.role, action: entry.action });
  }

  for (const [phase, entryList] of phaseEntries) {
    // 查找 S 产出和 V 评审的位置
    let sIndex = -1, vIndex = -1;
    for (let i = 0; i < entryList.length; i++) {
      const item = entryList[i];
      if (!item) continue;
      if (item.role === 'S' && item.action === 'produce') sIndex = i;
      if (item.role === 'V' && item.action === 'review' && sIndex >= 0 && vIndex === -1) vIndex = i;
    }
    if (sIndex >= 0 && vIndex > sIndex) {
      // 检查 S→V 之间是否有 3 条 R3 记录
      const r3Records = entryList.slice(sIndex + 1, vIndex).filter(
        e => e.role === 'R' && r3Dimensions.some(d => e.action.includes(d)),
      );
      if (r3Records.length < 3) {
        violations.push(
          `R3 记录校验失败：阶段 ${phase} 的 S→V 之间仅有 ${r3Records.length} 条 R3 记录，须有 3 条（completeness/reliability/security）`,
        );
      }
    }
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

  // R6 gateExitCode 回填检查：gateLogPath 存在但 gateExitCode 非 number → 始终报
  for (const e of valid) {
    if (e.gateLogPath && typeof e.gateExitCode !== 'number') {
      violations.push(
        `R6: 条目 ${e.runId ?? '?'} gateLogPath 已设但 gateExitCode 未回填`,
      );
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
    const curEntry = valid[i];
    if (!curEntry || curEntry.action !== 'rootcause') continue;
    // 后续须先有 review(targetKind=rootcause) 再有 fix
    let j = i + 1;
    while (j < valid.length && !(valid[j]?.action === 'review' && valid[j]?.targetKind === 'rootcause')) j++;
    if (j >= valid.length || !valid[j]) {
      violations.push(
        `R7: rootcause 记录 ${curEntry.runId} 后须有 review(targetKind=rootcause)`,
      );
      continue;
    }
    // fix 须在 review(rootcause) 之后
    let k = j + 1;
    while (k < valid.length && valid[k]?.action !== 'fix') k++;
    if (k >= valid.length || !valid[k]) {
      violations.push(
        `R7: rootcause 记录 ${curEntry.runId} 后须有 fix 记录`,
      );
    }
  }

  return { passed: violations.length === 0, violations };
}
