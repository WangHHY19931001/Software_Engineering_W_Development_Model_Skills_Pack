/**
 * checkpoint-logic.test.ts —— R3 强制用户确认单元测试
 *
 * 覆盖 checkpoint-logic.ts 中 R3 强化逻辑：
 *   - 未提供 checkpointLog → 所有 checkpoint 报 R3 违规
 *   - checkpointLog 含真实用户确认 → R3 通过
 *   - checkpointLog 提供但对应 phase 缺确认 → R3 违规（疑似代签）
 *   - C10：RUN_LOG_ACTION_VALUES 与 run-log.schema.json action 枚举 set 相等（同源守护）
 *   - C14/D3：checkpointLogAmbiguity（同 phase 双候选文件歧义）→ 无条件 fail-closed
 */

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { checkCheckpoint, RUN_LOG_ACTION_VALUES } from '../logic/checkpoint-logic.js';
import { checkRunLog } from '../logic/run-log-logic.js';
import { validateBySchema } from '../infrastructure/schema-loader.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // w-model-dev/scripts/__tests__
const RUN_LOG_SCHEMA_PATH = path.join(HERE, '..', '..', 'schemas', 'run-log.schema.json');

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
 * 故仅 phase-1 确认可支撑自举——初版「Map 非空」条件在「目录仅含 phase-2 确认」时
 * 会放行一个首放行初级证据为零的态。加载器历史宽松形态（canonical 化前的
 * `(?:phase-|checkpoint-)?(\d+)\.(?:txt|md|log)$`，任意 `*-<数字>.txt` 计入 Map）在此
 * 曾成为承重面：Map 里可能有任意后阶段键，由 `get('1')` 收紧兜住；42.13.0 起 loader
 * 已收窄为仅 canonical 形态 `phase-<N>.md`（C14/D3），非 canonical 文件不再计入。
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

  it('②③⑤ 零记录负例（3 态：未提供 checkpointLog / 空语义（missingReason 两态·空 Map）/ 仅 phase-2 或 phase-1 空白）→ R0 违规仍在（fail-closed 回归）', () => {
    const expectR0Violation = (result: ReturnType<typeof checkCheckpoint>, name: string): void => {
      expect(result.passed, `${name}：应不通过`).toBe(false);
      expect(
        result.violations.some((v) => v.includes('零证据不等于合规')),
        `${name}：应含「零证据不等于合规」`,
      ).toBe(true);
      expect(result.diagnostics, `${name}：不得出现 BOOTSTRAP_VALIDATION 诊断`).toBeUndefined();
    };
    // 态 1：未提供 checkpointLog（undefined / 显式 undefined 两形态）
    for (const options of [undefined, { checkpointLog: undefined }]) {
      expectR0Violation(checkCheckpoint([], options), `未提供 checkpointLog（${String(options)}）`);
    }
    // 态 2：空语义——目录已提供但无 phase-N 匹配（S18 语义）/ 不可读 / 空 Map
    const noMatch = checkCheckpoint([], { checkpointLog: undefined, checkpointLogMissingReason: 'no-phase-match' });
    expectR0Violation(noMatch, '空语义·no-phase-match');
    expect(
      noMatch.violations.some((v) => v.includes('checkpoint-log 无 phase-N 匹配记录（目录已提供）')),
      '零记录时 R3 空转，reason 不出现',
    ).toBe(false);
    const unreadable = checkCheckpoint([], { checkpointLog: undefined, checkpointLogMissingReason: 'dir-unreadable' });
    expectR0Violation(unreadable, '空语义·dir-unreadable');
    const emptyMap = checkCheckpoint([], { checkpointLog: new Map() });
    expectR0Violation(emptyMap, '空语义·空 Map（不走自举形态，原违规保留）');
    // 态 3：仅 phase-2 确认（无 phase-1）/ phase-1 条目空白——相位缝隙负例（修复轮 1）。
    // 审查复现态：零放行记录 + 目录仅 phase-2 确认（canonical 形态 phase-2.md）→ 初版
    // 「Map 非空」在此 exit 0（穿透「零证据不等于合规」）。收紧后：首放行的初级证据为零，
    // 自举形态不适用。
    const phase2Only = checkCheckpoint([], {
      checkpointLog: new Map([['2', '用户确认：放行进入阶段 3（user-id: bob）']]),
    });
    expectR0Violation(phase2Only, '仅 phase-2 确认（相位缝隙）');
    // 相位缝隙的另一半：phase-1 条目存在但为空白 → 同样不支撑自举（与 R3 空白同判）
    const blankPhase1 = checkCheckpoint([], { checkpointLog: new Map([['1', '   ']]) });
    expectR0Violation(blankPhase1, 'phase-1 条目空白（相位缝隙）');
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
 * 批次 6 A3/C14：run-log 的 legacy 吸收谓词（D-5 引入的两门共享谓词，批次 6 已删除）
 * 已删除——旧形态数据毁弃，两门对 schema 失败一律 fail-closed，无「吸收 vs blocking」
 * 口径分裂可言。本组锁定：同一旧形态记录在 check-run-log 与 check-checkpoint 两门
 * 均为 blocking（run-log 门报 [rework-hints]/[schema]，checkpoint 门报 [schema]）。
 */
describe('A3/C14 旧形态 fail-closed（两门同判：一律 blocking）', () => {
  /** 旧形态①：failed review 缺非空 reworkHints（reworkHints 族）。 */
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

  /** 旧形态②：携带已删除 action 死词 emergency-fix（批次 6 A15 词表收敛，enum 拒绝）。 */
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

  it('旧形态（reworkHints 族）：run-log 门报 [rework-hints] blocking，checkpoint 门报 [schema] blocking', () => {
    const schemaResult = validateBySchema('run-log', legacyFailedReview);
    expect(schemaResult.valid, '旧形态触发 schema 失败（fail-closed 前提）').toBe(false);
    const runLogResult = checkRunLog([legacyFailedReview]);
    expect(runLogResult.passed, 'run-log 门 blocking').toBe(false);
    expect(runLogResult.violations.some((v) => v.includes('[rework-hints]'))).toBe(true);
    const checkpointResult = checkCheckpoint([legacyFailedReview], confirmed);
    expect(checkpointResult.passed, 'checkpoint 门 blocking').toBe(false);
    expect(checkpointResult.violations.some((v) => v.includes('[schema]'))).toBe(true);
  });

  it('旧形态（2 态：reworkHints 族 / emergency-fix 缺 blocker）→ 两门均 blocking（无吸收绕行）', () => {
    const rows = [
      { name: 'reworkHints 族：failed review 缺非空 reworkHints', entry: legacyFailedReview },
      { name: '死词族：emergency-fix 已从 18 值词表删除', entry: legacyEmergencyFix },
    ] as const;
    for (const row of rows) {
      const schemaResult = validateBySchema('run-log', row.entry);
      expect(schemaResult.valid, `${row.name}：schema 失败`).toBe(false);
      const checkpointResult = checkCheckpoint([validCheckpoint, row.entry], confirmed);
      expect(
        checkpointResult.violations.some((v) => v.includes('[schema]')),
        `${row.name}：checkpoint 门报 [schema]`,
      ).toBe(true);
      expect(checkpointResult.passed, `${row.name}：整体 blocking`).toBe(false);
    }
  });

  it('真实类型错误仍两门 blocking（回归）', () => {
    const broken = { runId: 1, timestamp: 'x', phase: '一', action: 'checkpoint', role: 'O', outcome: 'success' };
    const schemaResult = validateBySchema('run-log', broken);
    expect(schemaResult.valid).toBe(false);
    const checkpointResult = checkCheckpoint([broken], confirmed);
    expect(checkpointResult.passed).toBe(false);
    expect(checkpointResult.violations.some((v) => v.includes('[schema]'))).toBe(true);
    const runLogResult = checkRunLog([broken]);
    expect(runLogResult.passed).toBe(false);
    expect(runLogResult.violations.some((v) => v.includes('[schema]'))).toBe(true);
  });
});

/**
 * C10（2026-10-04 audit-deep-dive）：checkpoint-logic 的 RunLogEntry.action 曾内联
 * 12 值子集联合——schema 枚举扩容后类型对 schema 撒谎（合法 action 被 TS 判非法）。
 * 修复：导出 RUN_LOG_ACTION_VALUES 常量（as const；批次 6 A15 起为 18 值）并派生类型；本组以
 * set 相等测试锁定「常量 ↔ schema 枚举」同源（schema 为单一事实来源）。
 */
describe('C10 action 枚举同源', () => {
  it('RUN_LOG_ACTION_VALUES 与 run-log.schema.json 的 action 枚举 set 相等', () => {
    const schema = JSON.parse(readFileSync(RUN_LOG_SCHEMA_PATH, 'utf-8')) as {
      properties: { action: { enum?: string[] } };
    };
    const schemaEnum: string[] = schema.properties.action.enum ?? [];
    expect(schemaEnum.length, 'schema action enum 应非空（读取路径漂移时显式红）').toBeGreaterThan(0);
    expect(new Set(RUN_LOG_ACTION_VALUES)).toEqual(new Set(schemaEnum));
  });
});

/**
 * C14/D3（2026-10-04 audit-deep-dive）：checkpoint-log 同 phase 双候选文件歧义
 * （如 phase-1.md 与 phase-1.txt 并存）→ 既有 violation 失败路径 fail-closed
 * （exit 1，消息列出冲突路径；不走 exit 2 ARG_INVALID 域）。CLI 层
 * （cli/check-checkpoint.ts）探测歧义并把消息经 checkpointLogAmbiguity 传入；
 * 逻辑层无条件记 violation——歧义态不得因 run-log 形态（含零记录自举形态）被放行。
 */
describe('C14/D3 同 phase 双候选文件歧义 fail-closed', () => {
  const ambiguityMessage = 'checkpoint-log 同 phase 双候选文件歧义（fail-closed）: /a/phase-1.md 与 /a/phase-1.txt';

  it('有 checkpoint success 记录 + 歧义 → 不通过，violations 原文承载冲突路径', () => {
    const checkpointEntry = {
      runId: 'cp1',
      timestamp: '2026-10-04T00:00:00Z',
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
    const result = checkCheckpoint([checkpointEntry], {
      checkpointLog: undefined,
      checkpointLogMissingReason: 'ambiguous-phase-files',
      checkpointLogAmbiguity: ambiguityMessage,
    });
    expect(result.passed).toBe(false);
    expect(result.violations).toContain(ambiguityMessage);
  });

  it('零记录态 + 歧义 → 不通过（R0 与歧义 violation 并存，自举形态不得穿透歧义）', () => {
    const result = checkCheckpoint([], {
      checkpointLog: undefined,
      checkpointLogMissingReason: 'ambiguous-phase-files',
      checkpointLogAmbiguity: ambiguityMessage,
    });
    expect(result.passed).toBe(false);
    expect(result.violations).toContain(ambiguityMessage);
    expect(result.violations.some((v) => v.includes('零证据不等于合规'))).toBe(true);
    expect(result.diagnostics, '歧义态不得出现 BOOTSTRAP_VALIDATION 诊断').toBeUndefined();
  });
});
