/**
 * checkpoint-logic.test.ts —— R3 强制用户确认单元测试
 *
 * 覆盖 checkpoint-logic.ts 中 [21.0.0] R3 强化逻辑：
 *   - 未提供 checkpointLog → 所有 checkpoint 报 R3 违规
 *   - checkpointLog 含真实用户确认 → R3 通过
 *   - checkpointLog 提供但对应 phase 缺确认 → R3 违规（疑似代签）
 */

import { describe, expect, it } from 'vitest';
import { checkCheckpoint } from '../logic/checkpoint-logic.js';

describe('[21.0.0] R3 强制用户确认', () => {
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
