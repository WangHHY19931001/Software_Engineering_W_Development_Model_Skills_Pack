/**
 * lib/parse-phase.ts 单元测试
 *
 * 统一 --phase 校验。
 * 覆盖（spec §3.2 + 2026-09-06 audit-fixes D3）：
 *   - --phase=N 与 --phase N（空格分离）与位置参数三种形态
 *   - 非法值（abc / 0 / 9 / -1 / 空串 / 无值）→ undefined
 *   - min/max 自定义（如 min:5,max:8）
 *   - 无 --phase → undefined
 *   - 重复 --phase（任意形态合并计数）→ DuplicateFlagError（D3/I-3）
 *   - phaseFlagPresent 形态无关存在性判定（D3/I-4）
 *   - C21 值吞噬契约：--phase 后跟 flag 形态 → flag 在而值缺失，解析结果 undefined 且不抛错
 *     （非法值门控由调用方以 phaseFlagPresent 输出 ARG_INVALID，2026-10-04 audit-deep-dive）
 *
 * 同质用例已按「循环内多断言 + 逐行具名消息」聚合（wave 3 第 B 批）。
 */

import { describe, expect, it } from 'vitest';

import { DuplicateFlagError } from '../lib/parse-args.js';
import { parsePhaseArg, phaseFlagPresent } from '../lib/parse-phase.js';

describe('parsePhaseArg', () => {
  describe('正例识别行', () => {
    it('等号形态行（4 行：基本 / 边界 1 / 边界 8 / 夹杂其它参数）', () => {
      const rows: readonly [string, string[], { phase: number; raw: string }][] = [
        ['--phase=5（带前置参数）', ['node', 'script.ts', '--phase=5'], { phase: 5, raw: '5' }],
        ['--phase=1（下边界）', ['--phase=1'], { phase: 1, raw: '1' }],
        ['--phase=8（上边界）', ['--phase=8'], { phase: 8, raw: '8' }],
        ['--phase=3 夹在其它参数间', ['x.json', '--phase=3', '--spec=a'], { phase: 3, raw: '3' }],
      ];
      for (const [name, argv, expected] of rows) {
        expect(parsePhaseArg([...argv]), `${name} 应识别为 phase`).toEqual(expected);
      }
    });

    it('空格形态与位置参数行（4 行）', () => {
      const rows: readonly [string, string[], { phase: number; raw: string }][] = [
        ['--phase 5（空格分离，带前置参数）', ['node', 'script.ts', '--phase', '5'], { phase: 5, raw: '5' }],
        ['--phase 8（空格分离）', ['--phase', '8'], { phase: 8, raw: '8' }],
      ];
      for (const [name, argv, expected] of rows) {
        expect(parsePhaseArg([...argv]), `${name} 应识别为 phase`).toEqual(expected);
      }
      expect(parsePhaseArg(['5'], { positional: 0 }), 'positional:0 时位置参数 5 应识别为 phase').toEqual({
        phase: 5,
        raw: '5',
      });
      expect(parsePhaseArg(['5']), '未指定 positional 时位置参数 5 不应被读取').toBeUndefined();
    });
  });

  describe('非法值 → undefined', () => {
    it('等号形态非法值（8 值）', () => {
      for (const bad of ['abc', '0', '9', '-1', '', ' 5', '5x', '3.7'] as const) {
        expect(parsePhaseArg([`--phase=${bad}`]), `bad=${bad}（--phase=${bad}）应拒绝`).toBeUndefined();
      }
    });

    it('空格/缺值负例族（4 态）', () => {
      expect(parsePhaseArg(['--phase=']), '等号形态空串应拒绝').toBeUndefined();
      expect(parsePhaseArg(['--phase']), '--phase 后无值（argv 末尾）应拒绝').toBeUndefined();
      expect(parsePhaseArg(['--phase', 'abc']), '空格分离非法值 abc 应拒绝').toBeUndefined();
      expect(parsePhaseArg(['--phase', '9']), '空格分离越界 9 应拒绝').toBeUndefined();
    });
  });

  describe('min/max 自定义', () => {
    it('通过行（3 行：min:5,max:8 两边界 + min:1,max:4 上边界）', () => {
      const rows: readonly [string, number, { min: number; max: number }][] = [
        ['--phase=5（min:5,max:8 下边界）', 5, { min: 5, max: 8 }],
        ['--phase=8（min:5,max:8 上边界）', 8, { min: 5, max: 8 }],
        ['--phase=4（min:1,max:4 上边界，plan-chunks 语义）', 4, { min: 1, max: 4 }],
      ];
      for (const [name, phase, range] of rows) {
        expect(parsePhaseArg([`--phase=${phase}`], range), `${name} 应通过`).toEqual({
          phase,
          raw: String(phase),
        });
      }
    });

    it('拒绝行（3 行：min:5,max:8 两侧越界 + min:1,max:4 越上界）', () => {
      const rows: readonly [string, number, { min: number; max: number }][] = [
        ['--phase=4（min:5,max:8 低于下界）', 4, { min: 5, max: 8 }],
        ['--phase=9（min:5,max:8 高于上界）', 9, { min: 5, max: 8 }],
        ['--phase=5（min:1,max:4 高于上界）', 5, { min: 1, max: 4 }],
      ];
      for (const [name, phase, range] of rows) {
        expect(parsePhaseArg([`--phase=${phase}`], range), `${name} 应拒绝`).toBeUndefined();
      }
    });
  });

  describe('无 --phase', () => {
    it('argv 无 --phase → undefined', () => {
      expect(parsePhaseArg(['node', 'script.ts', 'data.json'])).toBeUndefined();
      expect(parsePhaseArg(['node', 'script.ts', '--spec=a'])).toBeUndefined();
    });
  });

  describe('重复检测与形态识别（D3/I-3、I-4）', () => {
    it('重复 --phase（任意形态合并计数）→ DuplicateFlagError', () => {
      expect(() => parsePhaseArg(['--phase=1', '--phase', '2'])).toThrow(DuplicateFlagError);
      expect(() => parsePhaseArg(['--phase=1', '--phase=2'])).toThrow(DuplicateFlagError);
      expect(() => parsePhaseArg(['--phase', '1', '--phase', '2'])).toThrow(DuplicateFlagError);
      expect(() => parsePhaseArg(['--phase', '1', '--phase=2'])).toThrow(DuplicateFlagError);
    });

    it('单个 --phase（任一形态）不抛错', () => {
      expect(() => parsePhaseArg(['--phase=3'])).not.toThrow();
      expect(() => parsePhaseArg(['--phase', '3'])).not.toThrow();
      expect(() => parsePhaseArg(['data.json', '--spec=a'])).not.toThrow();
    });

    it('近似前缀 --phoenix 不计入重复/存在性', () => {
      expect(() => parsePhaseArg(['--phoenix=1', '--phoenix', '2'])).not.toThrow();
      expect(phaseFlagPresent(['--phoenix'])).toBe(false);
    });

    it('phaseFlagPresent 识别两形态', () => {
      expect(phaseFlagPresent(['--phase', '3'])).toBe(true);
      expect(phaseFlagPresent(['--phase=3'])).toBe(true);
      expect(phaseFlagPresent(['data.json'])).toBe(false);
      expect(phaseFlagPresent([])).toBe(false);
    });
  });

  describe('C21 --phase 值吞噬契约（audit-deep-dive C21，类型承重守卫保留）', () => {
    it('--phase 后跟 flag 形态时：flag 在而值缺失 → undefined 且不抛错（ARG_INVALID 门控由调用方 phaseFlagPresent 承担）', () => {
      expect(phaseFlagPresent(['--phase', '--json']), 'flag 形态无关存在性应为 true（flag 在）').toBe(true);
      expect(() => parsePhaseArg(['--phase', '--json']), '值吞噬不得抛错').not.toThrow();
      expect(parsePhaseArg(['--phase', '--json']), '--json 被作为值吞噬，解析结果应为 undefined').toBeUndefined();
    });

    it('--phase=4 正常解析为 4', () => {
      expect(parsePhaseArg(['--phase=4']), '--phase=4 应正常解析').toEqual({ phase: 4, raw: '4' });
    });
  });
});
