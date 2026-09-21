/**
 * checkpoint-logic.test.ts —— R3 强制用户确认单元测试
 *
 * 覆盖 checkpoint-logic.ts 中 R3 强化逻辑：
 *   - 未提供 checkpointLog → 所有 checkpoint 报 R3 违规
 *   - checkpointLog 含真实用户确认 → R3 通过
 *   - checkpointLog 提供但对应 phase 缺确认 → R3 违规（疑似代签）
 */

import { describe, expect, it } from 'vitest';

import { checkCheckpoint } from '../logic/checkpoint-logic.js';
import { checkRunLog, isLegacyAbsorbableEntry } from '../logic/run-log-logic.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';

describe('R3 强制用户确认', () => {
  const checkpointEntry = {
    runId: 'cp1',
    timestamp: '2026-07-10T04:00:00Z',
    phase: 1,
    phaseName: '需求与范围',
    action: 'checkpoint',
    role: 'O',
    duration_s: 10,
    tokens: 2000,
    estimated: false,
    subagentSpawns: 0,
    gateExitCode: null,
    outcome: 'success',
    acknowledgedDecisions: ['需求 REQ-1.1：采用 REST + JWT 认证方案'],
  };

  it('未提供 checkpointLog 时应报 R3 违规', () => {
    const result = checkCheckpoint([checkpointEntry], { checkpointLog: undefined });
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => /R3/.test(v))).toBe(true);
    expect(result.violations.some((v) => /未提供 --checkpoint-log/.test(v))).toBe(true);
  });

  it('checkpointLog 含真实用户确认时 R3 通过', () => {
    const checkpointLog = new Map([['1', '用户确认：放行进入阶段 2（user-id: alice）']]);
    const result = checkCheckpoint([checkpointEntry], { checkpointLog });
    expect(result.passed).toBe(true);
  });

  it('checkpointLog 提供但对应 phase 缺确认时 R3 违规', () => {
    const checkpointLog = new Map([['2', '用户确认：放行进入阶段 3（user-id: bob）']]);
    const result = checkCheckpoint([checkpointEntry], { checkpointLog });
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => /R3/.test(v))).toBe(true);
    expect(result.violations.some((v) => /疑似 O 自问自答/.test(v))).toBe(true);
  });
});

/**
 * S18（audit-fixes task 5）：--checkpoint-log 目录已提供但空/无 phase-N 匹配时，
 * R3 违规 reason 不得再误导为「未提供 --checkpoint-log」——
 * 须表述为「checkpoint-log 无 phase-N 匹配记录（目录已提供）」。
 */
describe('R3 目录已提供但无匹配记录的 reason 文案（S18）', () => {
  const checkpointEntry = {
    runId: 'cp1',
    timestamp: '2026-07-10T04:00:00Z',
    phase: 1,
    phaseName: '需求与范围',
    action: 'checkpoint',
    role: 'O',
    duration_s: 10,
    tokens: 2000,
    estimated: false,
    subagentSpawns: 0,
    gateExitCode: null,
    outcome: 'success',
    acknowledgedDecisions: ['需求 REQ-1.1：采用 REST + JWT 认证方案'],
  };

  it('目录已提供但无 phase-N 匹配 → reason 为「checkpoint-log 无 phase-N 匹配记录（目录已提供）」', () => {
    const result = checkCheckpoint([checkpointEntry], {
      checkpointLog: undefined,
      checkpointLogMissingReason: 'no-phase-match',
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('checkpoint-log 无 phase-N 匹配记录（目录已提供）'))).toBe(true);
    expect(result.violations.some((v) => v.includes('未提供 --checkpoint-log'))).toBe(false);
  });

  it('目录已提供但不可读 → reason 指明目录不可读（目录已提供），不误导排查方向', () => {
    const result = checkCheckpoint([checkpointEntry], {
      checkpointLog: undefined,
      checkpointLogMissingReason: 'dir-unreadable',
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('checkpoint-log 目录不可读（目录已提供）'))).toBe(true);
  });

  it('目录确实未提供 → 保留「未提供 --checkpoint-log」原文案', () => {
    const result = checkCheckpoint([checkpointEntry], { checkpointLog: undefined });
    expect(result.violations.some((v) => v.includes('未提供 --checkpoint-log'))).toBe(true);
  });
});

/**
 * E-2 规格修正案（方案 B：R0 首阶段自举形态，2026-09-22；修复轮 1 收紧）：
 * 零 checkpoint 记录态下 R0 的证据源扩展——run-log 零放行记录 + `--checkpoint-log`
 * 已提供且加载含 **phase-1 用户确认**（`get('1')` 非空白）→ R0 不违规，改推非阻断
 * `BOOTSTRAP_VALIDATION:` 诊断（首阶段放行的初级证据 = checkpoint-log 的 phase-1 用户
 * 确认原文，与 R3 防代签同锚）；未提供 / 空 Map / 无 phase-1 条目 / phase-1 空白 /
 * 不可读（checkpointLogMissingReason 两态）→ 维持原违规（fail-closed 不变）。
 * 有记录路径零变化。
 *
 * 收紧依据（修复轮 1，评审发现的相位缝隙）：零放行记录 ⇒ 下一次放行必为首放行，
 * 故仅 phase-1 确认可支撑自举——初版「Map 非空」条件在「目录仅含 phase-2.txt」时
 * 会放行一个首放行初级证据为零的态。加载器既有宽松（`cli/check-checkpoint.ts` 的
 * `(?:phase-|checkpoint-)?(\d+)\.(?:txt|md|log)$` 使任意 `*-<数字>.txt` 计入 Map）在此
 * 成为承重面：Map 里可能有任意后阶段键，由 `get('1')` 收紧兜住。
 *
 * 背景：阶段 1 自举死锁（R0 × R11/D-6 × R8 三批规则联合）——自然时序「确认落盘 →
 * 闭环五门 → 最后写放行记录」下 check-checkpoint 运行时 run-log 尚无放行记录，
 * 旧 R0 一律违规使其成为该时序的唯一阻塞点。规格见
 * `docs/superpowers/specs/2026-09-22-e2-spec-amendment.md`（§2.1 勘误注）；根因见
 * `docs/debug/2026-09-22-e2-r8-r0-rootcause/README.md`（§6-B）。
 */
describe('R0 首阶段自举形态（E-2 方案 B）', () => {
  it('① 零记录 + checkpointLog 含 phase-1 确认 → passed=true，含 BOOTSTRAP_VALIDATION 诊断，无 R0 违规', () => {
    const result = checkCheckpoint([], {
      checkpointLog: new Map([['1', '用户确认：放行进入阶段 2（user-id: alice）']]),
    });
    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.violations.some((v) => v.includes('零证据不等于合规'))).toBe(false);
    expect((result.diagnostics ?? []).some((d) => d.startsWith('BOOTSTRAP_VALIDATION:'))).toBe(true);
    const diagnostic = (result.diagnostics ?? []).find((d) => d.startsWith('BOOTSTRAP_VALIDATION:')) ?? '';
    expect(diagnostic).toContain('首阶段自举校验');
    expect(diagnostic).toContain('checkpoint-log 的 phase-1 用户确认为初级证据');
    expect(diagnostic).toContain('放行记录将于闭环门后写入');
  });

  it('② 零记录 + 未提供 checkpointLog → R0 违规仍在（fail-closed 回归）', () => {
    for (const options of [undefined, { checkpointLog: undefined }]) {
      const result = checkCheckpoint([], options);
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.includes('零证据不等于合规'))).toBe(true);
      expect(result.diagnostics).toBeUndefined();
    }
  });

  it('③ 零记录 + checkpointLog 空语义（missingReason 两态 / 空 Map）→ R0 违规仍在（fail-closed 回归）', () => {
    // 目录已提供但无 phase-N 匹配（S18 语义：CLI 传 undefined + missingReason）
    const noMatch = checkCheckpoint([], { checkpointLog: undefined, checkpointLogMissingReason: 'no-phase-match' });
    expect(noMatch.passed).toBe(false);
    expect(noMatch.violations.some((v) => v.includes('零证据不等于合规'))).toBe(true);
    expect(noMatch.violations.some((v) => v.includes('checkpoint-log 无 phase-N 匹配记录（目录已提供）'))).toBe(false); // 零记录时 R3 空转，reason 不出现
    // 目录已提供但不可读
    const unreadable = checkCheckpoint([], { checkpointLog: undefined, checkpointLogMissingReason: 'dir-unreadable' });
    expect(unreadable.passed).toBe(false);
    expect(unreadable.violations.some((v) => v.includes('零证据不等于合规'))).toBe(true);
    // 目录已提供但加载结果为空 Map → 不走自举形态，原违规保留
    const emptyMap = checkCheckpoint([], { checkpointLog: new Map() });
    expect(emptyMap.passed).toBe(false);
    expect(emptyMap.violations.some((v) => v.includes('零证据不等于合规'))).toBe(true);
    expect(emptyMap.diagnostics).toBeUndefined();
  });

  it('⑤ 零记录 + Map 仅含 phase-2 确认（无 phase-1）→ R0 违规仍在（相位缝隙负例，修复轮 1）', () => {
    // 审查复现态：零放行记录 + 目录仅 phase-2.txt → 初版「Map 非空」在此 exit 0（穿透
    // 「零证据不等于合规」）。收紧后：首放行的初级证据为零，自举形态不适用。
    const phase2Only = checkCheckpoint([], {
      checkpointLog: new Map([['2', '用户确认：放行进入阶段 3（user-id: bob）']]),
    });
    expect(phase2Only.passed).toBe(false);
    expect(phase2Only.violations.some((v) => v.includes('零证据不等于合规'))).toBe(true);
    expect(phase2Only.diagnostics).toBeUndefined();
    // 相位缝隙的另一半：phase-1 条目存在但为空白 → 同样不支撑自举（与 R3 空白同判）
    const blankPhase1 = checkCheckpoint([], { checkpointLog: new Map([['1', '   ']]) });
    expect(blankPhase1.passed).toBe(false);
    expect(blankPhase1.violations.some((v) => v.includes('零证据不等于合规'))).toBe(true);
    expect(blankPhase1.diagnostics).toBeUndefined();
  });

  it('④ 有记录路径零变化：放行记录在场时不产生 BOOTSTRAP_VALIDATION 诊断（既有用例零回归）', () => {
    const checkpointEntry = {
      runId: 'cp1',
      timestamp: '2026-07-10T04:00:00Z',
      phase: 1,
      phaseName: '需求与范围',
      action: 'checkpoint',
      role: 'O',
      duration_s: 10,
      tokens: 2000,
      estimated: false,
      subagentSpawns: 0,
      gateExitCode: null,
      outcome: 'success',
      acknowledgedDecisions: ['需求 REQ-1.1：采用 REST + JWT 认证方案'],
    };
    const confirmed = { checkpointLog: new Map([['1', '用户确认：放行进入阶段 2（user-id: alice）']]) };
    const result = checkCheckpoint([checkpointEntry], confirmed);
    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.diagnostics).toBeUndefined();
  });
});

/**
 * D-5（2026-09-20 门禁契约修复 · 任务 2）：legacy 吸收谓词两消费者口径统一。
 *
 * 背景：`check-run-log` 对「variant / reworkHints 规则引入前写入的旧记录」（缺
 * reworkHints / variant / blocker 等 required 字段）按 legacy 吸收为非阻断 diagnostic，
 * 而 `check-checkpoint` 对**同一条记录**直接报 `[schema]` blocking——两门对同一事实的
 * 裁定不一致，调测期只能逐条手工补字段绕过。修复：`run-log-logic.ts` 导出
 * `isLegacyAbsorbableEntry`，两门复用同一谓词。
 *
 * 判据不变量（规格 §5）：同一条记录，两门对「blocking vs 非阻断」的裁定必须相同。
 *
 * 形态说明：可被 legacy 吸收的记录必然是**触发 schema required 失败**的旧行
 * （`isLegacySchemaFailure` 只容忍身份/variant/blocker 族字段）。完整合法的
 * checkpoint 对象本身就是 schema-valid（无 schema 失败可吸收），故本组用例以
 * 「LEGACY_VARIANT_CUTOFF 前写入的 failed review 旧行 / 未声明 variant 的
 * emergency-fix 旧行」承载 legacy 形态——这正是 run-log 门报 LEGACY_REWORK_HINTS /
 * LEGACY_VARIANT 诊断而非阻断、而修复前 checkpoint 门报 `[schema]` 的那两类记录。
 */
describe('D-5 legacy 吸收谓词（两门同判）', () => {
  /** legacy 形态①：cutoff 前写入的 failed review 旧行，缺非空 reworkHints（reworkHints 族）。 */
  const legacyFailedReview = {
    runId: 'p1-v-legacy',
    timestamp: '2026-01-05T00:00:00Z',
    phase: 1,
    phaseName: '需求分析',
    action: 'review',
    role: 'V',
    duration_s: 30,
    tokens: 1200,
    estimated: false,
    subagentSpawns: 1,
    gateExitCode: null,
    outcome: 'fail',
    passed: false,
  };

  /** legacy 形态②：cutoff 前写入、未声明 variant 的 emergency-fix 旧行（identity/variant 族）。 */
  const legacyEmergencyFix = {
    runId: 'p2-s-efix',
    timestamp: '2026-01-05T00:00:00Z',
    phase: 2,
    phaseName: '系统设计',
    action: 'emergency-fix',
    role: 'S',
    duration_s: 30,
    tokens: 1200,
    estimated: false,
    subagentSpawns: 1,
    gateExitCode: null,
    outcome: 'success',
    basedOnReport: 'RC-2-1-1',
    artifacts: ['.w-model/rtm.json'],
    revertEvidence: { command: 'git apply -R /tmp/x.patch' },
  };

  /** 合规 checkpoint success 记录（R1-R5 输入齐备，避免非本任务规则误伤断言）。 */
  const validCheckpoint = {
    runId: 'cp1',
    timestamp: '2026-01-06T00:00:00Z',
    phase: 1,
    phaseName: '需求分析',
    action: 'checkpoint',
    role: 'O',
    duration_s: 10,
    tokens: 2000,
    estimated: false,
    subagentSpawns: 0,
    gateExitCode: 0,
    outcome: 'success',
    acknowledgedDecisions: ['需求 REQ-001：采用 REST + JWT 认证方案（环形计数器 [0,10]）'],
  };
  const confirmed = { checkpointLog: new Map([['1', '用户确认：放行进入阶段 2（user-id: alice）']]) };

  it('legacy 旧行（reworkHints 族）：谓词为真，run-log 门吸收为 LEGACY_REWORK_HINTS 诊断', () => {
    const schemaResult = validateBySchema('run-log', legacyFailedReview);
    expect(schemaResult.valid).toBe(false);
    expect(isLegacyAbsorbableEntry(legacyFailedReview, schemaResult.errorMessages)).toBe(true);
    const result = checkRunLog([legacyFailedReview]);
    expect(result.violations.filter((v) => v.includes('[schema]'))).toEqual([]);
    expect((result.diagnostics ?? []).some((d) => d.startsWith('LEGACY_REWORK_HINTS'))).toBe(true);
  });

  it('同一 legacy 旧行：checkpoint 门不再报 [schema] 且整体通过（D-5 核心）', () => {
    const result = checkCheckpoint([validCheckpoint, legacyFailedReview], confirmed);
    expect(result.violations.filter((v) => v.includes('[schema]'))).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it('legacy 旧行（identity/variant 族）：checkpoint 门同样不再报 [schema] 且整体通过', () => {
    const schemaResult = validateBySchema('run-log', legacyEmergencyFix);
    expect(schemaResult.valid).toBe(false);
    expect(isLegacyAbsorbableEntry(legacyEmergencyFix, schemaResult.errorMessages)).toBe(true);
    const result = checkCheckpoint([validCheckpoint, legacyEmergencyFix], confirmed);
    expect(result.violations.filter((v) => v.includes('[schema]'))).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it('真实类型错误仍 blocking，且两门同判（回归）', () => {
    const broken = { runId: 1, timestamp: 'x', phase: '一', action: 'checkpoint', role: 'O', outcome: 'success' };
    const schemaResult = validateBySchema('run-log', broken);
    expect(schemaResult.valid).toBe(false);
    expect(isLegacyAbsorbableEntry(broken, schemaResult.errorMessages)).toBe(false);
    const checkpointResult = checkCheckpoint([broken], confirmed);
    expect(checkpointResult.passed).toBe(false);
    expect(checkpointResult.violations.some((v) => v.includes('[schema]'))).toBe(true);
    const runLogResult = checkRunLog([broken]);
    expect(runLogResult.violations.some((v) => v.includes('[schema]'))).toBe(true);
  });
});
