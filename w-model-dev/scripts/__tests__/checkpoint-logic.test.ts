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
