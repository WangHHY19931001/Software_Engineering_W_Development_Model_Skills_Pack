/**
 * 运行日志校验纯逻辑（Run-Log Logic）—— 防止运行日志漂移与 O 越权
 *
 * 对应 w-model-dev/references/data-models.md RunLogEntry schema（§运行日志模型）
 * 与 w-model-dev/references/operational-recovery.md §5.2。
 * 校验：R1 阶段动作完整性 + R2 tokens 非负 + R3 返工记录一致
 *       + R4 acknowledgedDecisions 非空 + R5 O 越权检测 + R6 exitCode 一致
 *       + R7 append-only 时序。
 *       + R8 轨迹模板校验（理想阶段轨迹：S→R3×3→V→G→checkpoint）
 *
 * 设计原则（与 budget-logic.ts / graph-logic.ts / tla-logic.ts 一致）：
 *   1. 仅依赖本文件类型形状 + lib/safe-json.js（parseJsonSafe）+ schema-loader.js（validateBySchema），无 I/O 副作用
 *   2. 纯函数：无 I/O、无副作用，便于测试与复用
 *   3. 单点事实：所有「运行日志是否符合规范」的判定均委托至此
 */

import { parseJsonSafe } from '../lib/safe-json.js';

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
    | 'emergency-fix'
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
  /** 决策置信度（可选，0.0-1.0；agentic Ch18） */
  decisionConfidence?: number;
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

export function checkRunLog(entries: unknown, options?: RunLogCheckOptions): RunLogCheckResult {
  const violations: string[] = [];

  // 输入校验（先做）：非法输入返回 violations 而非抛 TypeError
  if (!Array.isArray(entries)) {
    return { passed: false, violations: ['run-log entries 必须为数组'] };
  }

  // 结构校验：narrow 每个元素为 Partial<RunLogEntry>，缺失必需字段则跳过并记录（容错，不 crash）
  // 必需字段为 R1-R8 实际访问的核心字段：runId / timestamp / phase / action / outcome
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
    const phaseEntries = valid.filter((e) => e.phase === phase);
    const actions = new Set(phaseEntries.map((e) => e.action));
    const hasGate = actions.has('gate') || actions.has('tla-gate') || actions.has('graph-gate');
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
      if (!isNonEmptyString(e.rootCauseCategory))
        violations.push(`R1: rootcause 动作 ${e.runId} 须含 rootCauseCategory`);
      if (typeof e.upstreamDefect !== 'boolean')
        violations.push(`R1: rootcause 动作 ${e.runId} 须含 upstreamDefect(boolean)`);
      if (typeof e.rollbackRecommended !== 'boolean')
        violations.push(`R1: rootcause 动作 ${e.runId} 须含 rollbackRecommended(boolean)`);
    }
    if (e.action === 'fix') {
      if (!isNonEmptyString(e.basedOnReport)) violations.push(`R1: fix 动作 ${e.runId} 须含 basedOnReport`);
      if (!Array.isArray(e.artifacts) || e.artifacts.length === 0)
        violations.push(`R1: fix 动作 ${e.runId} 须含 artifacts(非空数组)`);
    }
  }

  // R2 tokens 非负
  for (const e of valid) {
    if (typeof e.tokens === 'number' && e.tokens < 0) {
      violations.push(`R2: 条目 ${e.runId ?? '?'} tokens 为负: ${e.tokens}`);
    }
    // checkpoint success 须 tokens > 0（除非 note 标注首次/L0）
    // L0 首次或 note 含 "首次" 可豁免——简化：仅当 note 不含 "首次" 时报
    if (e.action === 'checkpoint' && e.outcome === 'success' && typeof e.tokens === 'number' && e.tokens === 0) {
      if (!e.note || !e.note.includes('首次')) {
        violations.push(`R2: 条目 ${e.runId ?? '?'} checkpoint success 但 tokens=0`);
      }
    }
  }

  // R3 返工记录一致性（可选校验：仅当 tlaCheckRounds 提供时执行）
  // 按 phase 过滤 + 仅统计 target/note 含 TLA 的返工，与 tla-manifest checkRounds 语义对齐
  if (options?.tlaCheckRounds !== undefined) {
    let reworkEntries = valid.filter((e) => e.action === 'rework');
    if (options.phase !== undefined) {
      reworkEntries = reworkEntries.filter((e) => e.phase === options.phase);
    }
    const tlaReworkCount = reworkEntries.filter(
      (e) => (e.note && /TLA/i.test(e.note)) || (e.target && /TLA/i.test(e.target)),
    ).length;
    if (tlaReworkCount !== options.tlaCheckRounds) {
      violations.push(
        `R3: run-log TLA rework 记录数 ${tlaReworkCount} 与 tla-manifest.checkRounds ${options.tlaCheckRounds} 不一致`,
      );
    }
  }

  // R3 扩展：rootcause ↔ fix 通过 reportId 映射（去重后比较，一个 fix 可覆盖多份 R 报告）
  const rootcauseActions = valid.filter((e) => e.action === 'rootcause');
  const fixActions = valid.filter((e) => e.action === 'fix');
  const rootcauseReviews = valid.filter((e) => e.action === 'review' && e.targetKind === 'rootcause');

  // 收集所有唯一的 reportId
  const uniqueReportIds = new Set(
    rootcauseActions.map((r) => r.reportId).filter((id): id is string => typeof id === 'string' && id.trim() !== ''),
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
      violations.push(`R3: rootcause 报告 ${rid} 无对应 fix 记录（basedOnReport 缺失）`);
    }
  }

  // V 复审 rootcause 记录按 reportId（target 字段）去重计数
  const reviewedReportIds = new Set(
    rootcauseReviews.map((r) => r.target).filter((t): t is string => typeof t === 'string' && t.trim() !== ''),
  );
  if (reviewedReportIds.size !== uniqueReportIds.size) {
    violations.push(
      `R3: V 复审 rootcause 记录数(${reviewedReportIds.size}) ≠ R 记录数(${uniqueReportIds.size})，每份 R 报告须有 V 复审`,
    );
  }

  // ==================== R3 预防性审查记录校验 ====================
  // R3 无条件强制，覆盖所有 S 变体（含 S-fix / S-emergency-fix）。
  // 校验：每个阶段的 S(任意变体)→V 之间须有 3 条 R3 记录（completeness/reliability/security）。
  // S 变体识别：produce（标准）/ fix（返工）/ emergency-fix（紧急修复）。
  const r3Dimensions = ['completeness', 'reliability', 'security'];
  const S_VARIANTS = ['produce', 'fix', 'emergency-fix'];
  const phaseEntries = new Map<number, Array<{ role: string; action: string }>>();

  for (const entry of valid) {
    if (!entry || typeof entry.phase !== 'number') continue;
    if (!phaseEntries.has(entry.phase)) phaseEntries.set(entry.phase, []);
    phaseEntries.get(entry.phase)!.push({ role: entry.role, action: entry.action });
  }

  for (const [phase, entryList] of phaseEntries) {
    // 查找每条 S 变体产出后紧跟的下一条 V 评审，校验其间是否有 3 条 R3 记录。
    // 一个阶段可能有多个 S 变体（如 produce 后返工 fix），每个 S→V 段都须独立有 3 条 R3。
    for (let i = 0; i < entryList.length; i++) {
      const item = entryList[i];
      if (!item) continue;
      if (item.role === 'S' && S_VARIANTS.includes(item.action)) {
        const sVariant = item.action;
        // 找该 S 之后第一条 V review
        let vIndex = -1;
        for (let j = i + 1; j < entryList.length; j++) {
          const candidate = entryList[j];
          if (!candidate) continue;
          if (candidate.role === 'V' && candidate.action === 'review') {
            vIndex = j;
            break;
          }
        }
        if (vIndex > i) {
          const r3Records = entryList
            .slice(i + 1, vIndex)
            .filter((e) => e.role === 'R' && r3Dimensions.some((d) => e.action.includes(d)));
          if (r3Records.length < 3) {
            violations.push(
              `R3 记录校验失败：阶段 ${phase} 的 S(${sVariant})→V 之间仅有 ${r3Records.length} 条 R3 记录，须有 3 条（completeness/reliability/security）`,
            );
          }
        }
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
          violations.push(`R5: gate-log ${logPath} 检测到 O 直接操作 .w-model/ 模式: ${pattern.source}`);
        }
      }
    }
  }

  // R6 gateExitCode 回填检查：gateLogPath 存在但 gateExitCode 非 number → 始终报
  for (const e of valid) {
    if (e.gateLogPath && typeof e.gateExitCode !== 'number') {
      violations.push(`R6: 条目 ${e.runId ?? '?'} gateLogPath 已设但 gateExitCode 未回填`);
    }
  }

  // R6 exitCode 一致（可选校验：仅当 gateLogs 提供时执行）
  // 交叉校验 run-log 条目 gateExitCode 与 gate-log 存档 exitCode 一致（SSoT §10E 防伪造）
  if (options?.gateLogs) {
    for (const e of valid) {
      if (e.gateLogPath && typeof e.gateExitCode === 'number') {
        const logData = options.gateLogs.get(e.gateLogPath);
        if (!logData) {
          violations.push(`R6: 条目 ${e.runId ?? '?'} gateLogPath=${e.gateLogPath} 在 gate-logs 中未找到`);
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
  const rootcauseGateActions = valid.filter((e) => e.action === 'gate' && e.script === 'check-rootcause-report.ts');
  for (const g of rootcauseGateActions) {
    if (typeof g.gateExitCode !== 'number' || g.gateExitCode === null) {
      violations.push(`R6: check-rootcause-report.ts gate 记录 ${g.runId} 缺 gateExitCode`);
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
      violations.push(`R7: rootcause 记录 ${curEntry.runId} 后须有 review(targetKind=rootcause)`);
      continue;
    }
    // fix 须在 review(rootcause) 之后
    let k = j + 1;
    while (k < valid.length && valid[k]?.action !== 'fix') k++;
    if (k >= valid.length || !valid[k]) {
      violations.push(`R7: rootcause 记录 ${curEntry.runId} 后须有 fix 记录`);
    }
  }

  // R8 轨迹模板校验（agentic Ch19 轨迹符合性）
  // 理想阶段轨迹：S 变体(produce/fix/emergency-fix) → R3×3 → V(review) → G(gate 类) → checkpoint(阶段最后)。
  // R8 校验「轨迹正确」（R7 仅「时序正确」）：偏离理想动作序列即违规。
  const GATE_ACTIONS = new Set(['gate', 'tla-gate', 'graph-gate']);
  for (const phase of completedPhases) {
    const phaseEntries = valid.filter((e) => e.phase === phase);
    const checkpointIndexes = phaseEntries
      .map((e, i) => (e.action === 'checkpoint' && e.outcome === 'success' ? i : -1))
      .filter((i) => i >= 0);
    const lastCheckpoint = checkpointIndexes.length > 0 ? checkpointIndexes[checkpointIndexes.length - 1]! : -1;

    // R8-1: checkpoint 必须是该阶段最后一条记录（阶段结束后再无后续动作）
    if (lastCheckpoint >= 0 && lastCheckpoint !== phaseEntries.length - 1) {
      violations.push(
        `R8: 阶段 ${phase} checkpoint 非阶段最后记录（checkpoint 之后仍有 ${phaseEntries.length - 1 - lastCheckpoint} 条动作，理想轨迹中 checkpoint 为阶段终点）`,
      );
    }

    // R8-2: gate 类动作必须出现在最后一个 checkpoint 之前
    for (let i = 0; i < phaseEntries.length; i++) {
      const entry = phaseEntries[i];
      if (entry && GATE_ACTIONS.has(entry.action) && lastCheckpoint >= 0 && i > lastCheckpoint) {
        violations.push(
          `R8: 阶段 ${phase} gate 动作(${entry.action})出现在 checkpoint 之后，理想轨迹中 gate 先于 checkpoint`,
        );
      }
    }
  }

  // R8-3: V(review) 失败后不得直接 S 变体——须先 rootcause（反模式 #18 轨迹检测）
  // 独立于 completedPhases 遍历所有阶段：反模式 #18 是行为级违规，
  // 未完成阶段（尚无 checkpoint success）同样禁止 V 失败后跳过 R 直接 S 返工。
  const r8PhaseGroups = new Map<number, RunLogEntry[]>();
  for (const e of valid) {
    if (!r8PhaseGroups.has(e.phase)) r8PhaseGroups.set(e.phase, []);
    r8PhaseGroups.get(e.phase)!.push(e);
  }
  for (const [, phaseEntries] of r8PhaseGroups) {
    for (let i = 0; i < phaseEntries.length; i++) {
      const entry = phaseEntries[i];
      if (!entry || entry.action !== 'review' || entry.outcome !== 'fail') continue;
      for (let j = i + 1; j < phaseEntries.length; j++) {
        const next = phaseEntries[j];
        if (!next) continue;
        if (next.action === 'rootcause') break; // 正确路径：先 R 再 S-fix
        if (S_VARIANTS.includes(next.action)) {
          violations.push(
            `R8: 阶段 ${entry.phase} V(review) 失败(${entry.runId})后直接 S(${next.action})(${next.runId})，理想轨迹须先 rootcause 再 S-fix（反模式 #18）`,
          );
          break;
        }
        if (next.action === 'checkpoint' && next.outcome === 'success') break; // 阶段结束，不再追溯
      }
    }
  }

  return { passed: violations.length === 0, violations };
}

// ==================== R6 契约：gate-log exitCode 提取与路径索引 ====================

/** 各门禁脚本 stdout 摘要标记 */
const GATE_JSON_PATTERNS: RegExp[] = [
  /GRAPH_JSON\s+(\{.*\})/,
  /VERIFIER_JSON\s+(\{.*\})/,
  /TLA_JSON\s+(\{.*\})/,
  /BUDGET_JSON\s+(\{.*\})/,
  /RUN_LOG_JSON\s+(\{.*\})/,
  /MATURITY_JSON\s+(\{.*\})/,
  /CHECKPOINT_JSON\s+(\{.*\})/,
  /GATE_JSON\s+(\{.*\})/,
  /SIGNATURE_CHAIN_JSON\s+(\{.*\})/,
  /ARCHIVE_INTEGRITY_JSON\s+(\{.*\})/,
  /ROLE_DISPATCH_JSON\s+(\{.*\})/,
  /CODE_TLA_JSON\s+(\{.*\})/,
  /COVERAGE_JSON\s+(\{.*\})/,
  /EXEMPTION_JSON\s+(\{.*\})/,
  /CONTRACT_JSON[:\s]+(\{.*\})/,
  /OPSX_ARTIFACTS_JSON\s+(\{.*\})/,
  /OPENSPEC_ARCHIVE_JSON\s+(\{.*\})/,
  /CODEGRAPH_QUERIES_JSON\s+(\{.*\})/,
  /BDD_JSON\s+(\{.*\})/,
  /PREVENTIVE_REVIEW_JSON\s+(\{.*\})/,
  /ROOTCAUSE_JSON\s+(\{.*\})/,
  /TLA_BDD_SYNC_JSON\s+(\{.*\})/,
  /STATE_MACHINE_JSON\s+(\{.*\})/,
  /STATUS_JSON\s+(\{.*\})/,
  /METRICS_JSON\s+(\{.*\})/,
  /ERROR_JSON\s+(\{.*\})/,
];

/**
 * 从 gate-log 内容提取 exitCode（gate-log 是脚本 stdout 存档，含一行 `XXX_JSON {...}` 摘要）。
 * 纯函数、无 IO。
 */
export function extractExitCode(content: string): number | undefined {
  for (const pattern of GATE_JSON_PATTERNS) {
    const match = content.match(pattern);
    if (match && match[1]) {
      try {
        const json = parseJsonSafe(match[1]) as { exitCode?: unknown };
        if (typeof json.exitCode === 'number') return json.exitCode;
      } catch {
        /* 忽略解析失败 */
      }
    }
  }
  return undefined;
}

/**
 * 构建 gateLogPath 多索引 key 集：basename / 绝对路径 / 相对 cwd 路径 / 各路径双向斜杠归一化（正↔反）。
 * 纯字符串实现（不 import node:path，遵守 *-logic.ts pure 边界）；兼容 Windows 反斜杠。
 * cwd 前缀裁剪：仅覆盖 cwd 内文件，cwd 外无相对 key，依赖 basename/绝对路径兜底；大小写敏感；调用方须保证 cwd 与 fileAbs 同源同分隔符。
 */
export function buildGateLogKeys(fileAbs: string, cwd: string): string[] {
  const basename = fileAbs.split(/[\\/]/).filter(Boolean).pop() ?? fileAbs;
  const keys = new Set<string>([basename, fileAbs]);
  if (cwd) {
    const sep = cwd.includes('\\') ? '\\' : '/';
    const prefix = cwd.endsWith(sep) ? cwd : `${cwd}${sep}`;
    if (fileAbs.startsWith(prefix)) {
      keys.add(fileAbs.slice(prefix.length));
    }
  }
  for (const k of [...keys]) {
    keys.add(k.replace(/\\/g, '/'));
    keys.add(k.replace(/\//g, '\\'));
  }
  return [...keys];
}
