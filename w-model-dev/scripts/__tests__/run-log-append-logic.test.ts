/**
 * run-log 追加器纯逻辑单测（logic/run-log-append-logic.ts，D-5①/N-5）
 *
 * 锁定契约（Task 6 / 裁定 A + 裁定 B）：
 *   - 时间戳严格递增：显式时间戳（记录自带 / --timestamp）不递增即拒绝（violation 含「时间戳不递增」）；
 *     now 派生路径同毫秒/倒退时步进到末条 +1ms，并以 diagnostics「时钟调整 +Nms」显式记录（绝不静默）；
 *   - 显式注入（--timestamp）与显式小步进（--allow-clock-adjust）必须在记录 note 留可复核痕迹
 *     （`clock-injected:<iso>` / `clock-adjust:<reason>`）；
 *   - --correct 只生成新记录（note 含 `correction-of:<runId>`），历史行逐字段不变；
 *   - 纯函数：无 I/O、无副作用（输入数组与对象不被就地修改）。
 */
import { describe, expect, it } from 'vitest';

import { planAppend, planCorrection, type RunLogRecord } from '../logic/run-log-append-logic.js';

function mkEntry(patch: Partial<RunLogRecord> = {}): RunLogRecord {
  return {
    runId: 'x',
    phase: 1,
    phaseName: '需求分析',
    action: 'produce',
    role: 'S',
    duration_s: 1,
    tokens: 1,
    estimated: false,
    subagentSpawns: 0,
    gateExitCode: null,
    outcome: 'success',
    ...patch,
  };
}

function codesOf(plan: { violationCodes: string[] }): string[] {
  return plan.violationCodes;
}

describe('planAppend：时间戳严格递增（裁定 A）', () => {
  it('追加记录写入严格递增时间戳，拒绝倒退', () => {
    const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' })];
    const r = planAppend(existing, [mkEntry({ runId: 'b', timestamp: '2026-09-25T09:59:00.000Z' })], {
      now: '2026-09-25T09:59:30.000Z',
    });
    expect(r.accepted).toBe(false);
    expect(r.violations.join()).toMatch(/时间戳不递增/);
  });

  it('时间戳倒退的拒绝文案点名末条时间与建议', () => {
    const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' })];
    const r = planAppend(existing, [mkEntry({ runId: 'b', timestamp: '2026-09-25T10:00:00.000Z' })], {
      now: '2026-09-25T10:00:00.000Z',
    });
    expect(r.accepted).toBe(false);
    expect(codesOf(r)).toContain('TIMESTAMP_NOT_INCREASING');
    const text = r.violations.join(' ');
    expect(text).toMatch(/2026-09-25T10:00:00\.000Z/);
    expect(text).toMatch(/--timestamp|--allow-clock-adjust/);
    expect(r.appended).toBe(0);
  });

  it('未显式注入时使用 now 且严格递增', () => {
    const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' })];
    const r = planAppend(existing, [mkEntry({ runId: 'b' })], { now: '2026-09-25T10:00:00.000Z' });
    expect(r.accepted).toBe(true);
    expect(Date.parse(r.entries[1]!.timestamp!)).toBeGreaterThan(Date.parse(existing[0]!.timestamp!));
  });

  it('now 派生路径的 +1ms 步进进入 diagnostics（非静默）', () => {
    const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' })];
    const r = planAppend(existing, [mkEntry({ runId: 'b' })], { now: '2026-09-25T10:00:00.000Z' });
    expect(r.accepted).toBe(true);
    expect(r.diagnostics.join()).toMatch(/时钟调整 \+\d+ms/);
  });

  it('now 晚于末条时不做任何时间调整，且无调整诊断', () => {
    const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' })];
    const r = planAppend(existing, [mkEntry({ runId: 'b' })], { now: '2026-09-25T10:05:00.000Z' });
    expect(r.accepted).toBe(true);
    expect(r.entries[1]!.timestamp).toBe('2026-09-25T10:05:00.000Z');
    expect(r.diagnostics.join()).not.toMatch(/时钟调整/);
  });

  it('批量追加逐条严格递增（同 now 的三条 → now/now+1/now+2）', () => {
    const r = planAppend([], [mkEntry({ runId: 'a' }), mkEntry({ runId: 'b' }), mkEntry({ runId: 'c' })], {
      now: '2026-09-25T10:00:00.000Z',
    });
    expect(r.accepted).toBe(true);
    const stamps = r.entries.map((e) => Date.parse(e.timestamp!));
    expect(stamps).toEqual([
      Date.parse('2026-09-25T10:00:00.000Z'),
      Date.parse('2026-09-25T10:00:00.001Z'),
      Date.parse('2026-09-25T10:00:00.002Z'),
    ]);
    expect(r.diagnostics.filter((d) => d.includes('时钟调整')).length).toBe(2);
    expect(r.appended).toBe(3);
  });

  it('--timestamp 显式注入在 note 留 clock-injected 痕迹', () => {
    const r = planAppend([mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' })], [mkEntry({ runId: 'b' })], {
      now: '2026-09-25T11:00:00.000Z',
      timestamp: '2026-09-25T10:30:00.000Z',
    });
    expect(r.accepted).toBe(true);
    expect(r.entries[1]!.timestamp).toBe('2026-09-25T10:30:00.000Z');
    expect(r.entries[1]!.note).toMatch(/clock-injected:2026-09-25T10:30:00\.000Z/);
  });

  it('--timestamp 注入不递增且无 --allow-clock-adjust 时拒绝', () => {
    const r = planAppend([mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' })], [mkEntry({ runId: 'b' })], {
      now: '2026-09-25T11:00:00.000Z',
      timestamp: '2026-09-25T09:00:00.000Z',
    });
    expect(r.accepted).toBe(false);
    expect(codesOf(r)).toContain('TIMESTAMP_NOT_INCREASING');
  });

  it('--allow-clock-adjust 显式声明小步进：步进 +1ms 且 note 留 clock-adjust 理由', () => {
    const r = planAppend([mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' })], [mkEntry({ runId: 'b' })], {
      now: '2026-09-25T11:00:00.000Z',
      timestamp: '2026-09-25T09:00:00.000Z',
      allowClockAdjust: 'live-run-replay',
    });
    expect(r.accepted).toBe(true);
    expect(Date.parse(r.entries[1]!.timestamp!)).toBe(Date.parse('2026-09-25T10:00:00.001Z'));
    expect(r.entries[1]!.note).toMatch(/clock-adjust:live-run-replay/);
    // 两条痕迹都必须保留：注入来源 + 小步进声明（裁定 A「绝不静默」）
    expect(r.entries[1]!.note).toMatch(/clock-injected:2026-09-25T09:00:00\.000Z/);
    expect(r.diagnostics.join()).toMatch(/时钟调整 \+\d+ms/);
  });

  it('now 早于末条时间（时钟真倒退）默认拒绝：文案点名末条时间与建议', () => {
    const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' })];
    const r = planAppend(existing, [mkEntry({ runId: 'b' })], { now: '2026-09-25T09:00:00.000Z' });
    expect(r.accepted).toBe(false);
    expect(codesOf(r)).toContain('TIMESTAMP_NOT_INCREASING');
    const text = r.violations.join(' ');
    expect(text).toMatch(/now=2026-09-25T09:00:00\.000Z 早于末条时间 2026-09-25T10:00:00\.000Z/);
    expect(text).toMatch(/--allow-clock-adjust/);
    expect(r.appended).toBe(0);
  });

  it('now 早于末条时间 + --allow-clock-adjust：步进末条 +1ms 且 note 留理由痕迹', () => {
    const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' })];
    const r = planAppend(existing, [mkEntry({ runId: 'b' })], {
      allowClockAdjust: 'ntp-rollback',
      now: '2026-09-25T09:00:00.000Z',
    });
    expect(r.accepted).toBe(true);
    expect(Date.parse(r.entries[1]!.timestamp!)).toBe(Date.parse('2026-09-25T10:00:00.001Z'));
    expect(r.entries[1]!.note).toMatch(/clock-adjust:auto\+\d+ms:ntp-rollback/);
    expect(r.diagnostics.join()).toMatch(/时钟调整 \+\d+ms/);
  });

  it('历史末条用宽容口径：小写 t/z 时间戳仍作为单调下界（不被跳过）', () => {
    const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25t10:00:00z' })];
    const lower = planAppend(existing, [mkEntry({ runId: 'b', timestamp: '2026-09-25T09:00:00.000Z' })], {
      now: '2026-09-25T11:00:00.000Z',
    });
    expect(lower.accepted).toBe(false);
    expect(codesOf(lower)).toContain('TIMESTAMP_NOT_INCREASING');
    const sameMs = planAppend(existing, [mkEntry({ runId: 'c' })], { now: '2026-09-25T10:00:00.000Z' });
    expect(sameMs.accepted).toBe(true);
    expect(Date.parse(sameMs.entries[1]!.timestamp!)).toBe(Date.parse('2026-09-25T10:00:00.001Z'));
  });

  it('now 与末条同毫秒仍属良性（步进 +1ms 不拒绝）', () => {
    const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' })];
    const r = planAppend(existing, [mkEntry({ runId: 'b' })], { now: '2026-09-25T10:00:00.000Z' });
    expect(r.accepted).toBe(true);
    expect(r.entries[1]!.note).toMatch(/clock-adjust:auto\+1ms/);
  });

  it('记录自带时间戳与 --timestamp 同时出现即拒绝（绝不静默覆盖）', () => {
    const r = planAppend([], [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' })], {
      now: '2026-09-25T11:00:00.000Z',
      timestamp: '2026-09-25T10:30:00.000Z',
    });
    expect(r.accepted).toBe(false);
    expect(codesOf(r)).toContain('TIMESTAMP_CONFLICT');
  });

  it('非法时间戳文本被拒绝', () => {
    const r = planAppend([], [mkEntry({ runId: 'a', timestamp: 'not-a-date' })], { now: '2026-09-25T11:00:00.000Z' });
    expect(r.accepted).toBe(false);
    expect(codesOf(r)).toContain('TIMESTAMP_INVALID');
  });

  it('空追加载荷被拒绝', () => {
    const r = planAppend([], [], { now: '2026-09-25T11:00:00.000Z' });
    expect(r.accepted).toBe(false);
    expect(codesOf(r)).toContain('EMPTY_APPEND');
  });

  it('重复 runId 被拒绝（不得覆盖既有身份）', () => {
    const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' })];
    const r = planAppend(existing, [mkEntry({ runId: 'a' })], { now: '2026-09-25T11:00:00.000Z' });
    expect(r.accepted).toBe(false);
    expect(codesOf(r)).toContain('DUPLICATE_RUN_ID');
  });

  it('历史行逐字段不变，且输入数组/对象未被就地修改', () => {
    const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z', note: '原记录' })];
    const incoming = [mkEntry({ runId: 'b' })];
    const existingSnapshot = JSON.parse(JSON.stringify(existing));
    const incomingSnapshot = JSON.parse(JSON.stringify(incoming));
    const r = planAppend(existing, incoming, { now: '2026-09-25T10:00:00.000Z' });
    expect(r.accepted).toBe(true);
    expect(r.entries[0]).toEqual(existingSnapshot[0]);
    expect(existing).toEqual(existingSnapshot);
    expect(incoming).toEqual(incomingSnapshot);
    expect(r.appended).toBe(1);
  });

  it('accepted=false 时不产出任何新记录（appended=0 且 entries 保持历史长度）', () => {
    const existing = [
      mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' }),
      mkEntry({ runId: 'b', timestamp: '2026-09-25T10:00:01.000Z' }),
    ];
    const r = planAppend(existing, [mkEntry({ runId: 'c', timestamp: '2026-09-25T09:00:00.000Z' })], {
      now: '2026-09-25T11:00:00.000Z',
    });
    expect(r.accepted).toBe(false);
    expect(r.entries).toHaveLength(2);
    expect(r.appended).toBe(0);
  });
});

describe('planCorrection：更正记录（裁定 B）', () => {
  it('--correct 生成更正记录且不触碰历史行', () => {
    const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z', note: '错值 4' })];
    const r = planCorrection(existing, 'a', { note: '更正为 5' }, { now: '2026-09-25T10:01:00.000Z' });
    expect(r.entries).toHaveLength(2);
    expect(r.entries[0]).toEqual(existing[0]);
    expect(r.entries[1]!.note).toMatch(/correction-of:a/);
  });

  it('更正记录继承被更正记录的字段并应用 patch，时间戳重新严格递增', () => {
    const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z', tokens: 1 })];
    const r = planCorrection(existing, 'a', { tokens: 42, note: '更正为 5' }, { now: '2026-09-25T10:01:00.000Z' });
    expect(r.accepted).toBe(true);
    const corrected = r.entries[1]!;
    expect(corrected.runId).not.toBe('a');
    expect(corrected.tokens).toBe(42);
    expect(corrected.phase).toBe(1);
    expect(Date.parse(corrected.timestamp!)).toBeGreaterThan(Date.parse(existing[0]!.timestamp!));
    expect(corrected.note).toBe('更正为 5 correction-of:a');
  });

  it('被引用 runId 不存在时拒绝（UNKNOWN_RUN_ID，调用方按 exit 2 处理）', () => {
    const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' })];
    const r = planCorrection(existing, 'zz', { note: '更正' }, { now: '2026-09-25T10:01:00.000Z' });
    expect(r.accepted).toBe(false);
    expect(codesOf(r)).toContain('UNKNOWN_RUN_ID');
    expect(r.appended).toBe(0);
  });

  it('patch 自带 runId 与既有 runId 冲突时拒绝', () => {
    const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' })];
    const r = planCorrection(existing, 'a', { runId: 'a' }, { now: '2026-09-25T10:01:00.000Z' });
    expect(r.accepted).toBe(false);
    expect(codesOf(r)).toContain('DUPLICATE_RUN_ID');
  });

  it('patch 覆盖 note 时保留更正痕迹；无 patch 时继承原 note 并追加痕迹', () => {
    const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z', note: '原始说明' })];
    const bare = planCorrection(existing, 'a', {}, { now: '2026-09-25T10:01:00.000Z' });
    expect(bare.entries[1]!.note).toBe('原始说明 correction-of:a');
  });

  it('--timestamp 注入的更正记录同样以严格递增为约束', () => {
    const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z' })];
    const r = planCorrection(
      existing,
      'a',
      { note: '更正' },
      { now: '2026-09-25T10:01:00.000Z', timestamp: '2026-09-25T09:00:00.000Z' },
    );
    expect(r.accepted).toBe(false);
    expect(codesOf(r)).toContain('TIMESTAMP_NOT_INCREASING');
  });

  it('更正链可连续（对更正记录再更正）', () => {
    const existing = [mkEntry({ runId: 'a', timestamp: '2026-09-25T10:00:00.000Z', note: '错值 4' })];
    const first = planCorrection(existing, 'a', { note: '更正为 5' }, { now: '2026-09-25T10:01:00.000Z' });
    const second = planCorrection(
      first.entries,
      first.entries[1]!.runId!,
      { note: '更正为 6' },
      { now: '2026-09-25T10:02:00.000Z' },
    );
    expect(second.accepted).toBe(true);
    expect(second.entries).toHaveLength(3);
    expect(second.entries[2]!.note).toMatch(/correction-of:/);
  });
});
