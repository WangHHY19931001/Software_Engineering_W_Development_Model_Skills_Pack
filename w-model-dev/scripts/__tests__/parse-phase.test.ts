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
 */

import { describe, expect, it } from 'vitest';

import { DuplicateFlagError } from '../lib/parse-args.js';
import { parsePhaseArg, phaseFlagPresent } from '../lib/parse-phase.js';

describe('parsePhaseArg', () => {
  describe('--phase=N 形态', () => {
    it('--phase=5 → { phase: 5, raw: "5" }', () => {
      expect(parsePhaseArg(['node', 'script.ts', '--phase=5'])).toEqual({ phase: 5, raw: '5' });
    });

    it('--phase=1 与 --phase=8（边界）→ 1 / 8', () => {
      expect(parsePhaseArg(['--phase=1'])).toEqual({ phase: 1, raw: '1' });
      expect(parsePhaseArg(['--phase=8'])).toEqual({ phase: 8, raw: '8' });
    });

    it('出现在其它参数之间也能识别', () => {
      expect(parsePhaseArg(['x.json', '--phase=3', '--spec=a'])).toEqual({ phase: 3, raw: '3' });
    });
  });

  describe('--phase N（空格分离）形态', () => {
    it('--phase 5 → { phase: 5, raw: "5" }', () => {
      expect(parsePhaseArg(['node', 'script.ts', '--phase', '5'])).toEqual({ phase: 5, raw: '5' });
    });

    it('--phase 8 → 8', () => {
      expect(parsePhaseArg(['--phase', '8'])).toEqual({ phase: 8, raw: '8' });
    });
  });

  describe('位置参数（positional）', () => {
    it('positional: 0 → { phase: 5, raw: "5" }', () => {
      expect(parsePhaseArg(['5'], { positional: 0 })).toEqual({ phase: 5, raw: '5' });
    });

    it('未指定 positional 时不读位置参数', () => {
      expect(parsePhaseArg(['5'])).toBeUndefined();
    });
  });

  describe('非法值 → undefined', () => {
    it.each(['abc', '0', '9', '-1', '', ' 5', '5x', '3.7'])('--phase=%s → undefined', (bad) => {
      expect(parsePhaseArg([`--phase=${bad}`])).toBeUndefined();
    });

    it('--phase= 空串 → undefined', () => {
      expect(parsePhaseArg(['--phase='])).toBeUndefined();
    });

    it('--phase 后无值（argv 末尾）→ undefined', () => {
      expect(parsePhaseArg(['--phase'])).toBeUndefined();
    });

    it('空格分离非法值 --phase abc → undefined', () => {
      expect(parsePhaseArg(['--phase', 'abc'])).toBeUndefined();
    });

    it('空格分离越界 --phase 9 → undefined', () => {
      expect(parsePhaseArg(['--phase', '9'])).toBeUndefined();
    });
  });

  describe('min/max 自定义', () => {
    it('min:5,max:8 时 --phase=5 与 --phase=8 通过', () => {
      expect(parsePhaseArg(['--phase=5'], { min: 5, max: 8 })).toEqual({ phase: 5, raw: '5' });
      expect(parsePhaseArg(['--phase=8'], { min: 5, max: 8 })).toEqual({ phase: 8, raw: '8' });
    });

    it('min:5,max:8 时 --phase=4 与 --phase=9 拒绝', () => {
      expect(parsePhaseArg(['--phase=4'], { min: 5, max: 8 })).toBeUndefined();
      expect(parsePhaseArg(['--phase=9'], { min: 5, max: 8 })).toBeUndefined();
    });

    it('min:1,max:4（plan-chunks 语义）时 --phase=4 通过、--phase=5 拒绝', () => {
      expect(parsePhaseArg(['--phase=4'], { min: 1, max: 4 })).toEqual({ phase: 4, raw: '4' });
      expect(parsePhaseArg(['--phase=5'], { min: 1, max: 4 })).toBeUndefined();
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
});
