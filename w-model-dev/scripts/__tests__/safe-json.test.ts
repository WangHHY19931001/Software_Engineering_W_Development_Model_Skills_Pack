/**
 * lib/safe-json.ts 单元测试（安全加固 §3.4）
 *
 * 覆盖：__proto__ 键被丢弃 / 普通键与嵌套对象保留 / 数组 / 标量 / null /
 *       行为与 JSON.parse 一致（含非法 JSON 抛错）。
 */

import { describe, it, expect } from 'vitest';

import { parseJsonSafe, safeJsonReviver } from '../lib/safe-json.js';

describe('parseJsonSafe', () => {
  it('顶层 __proto__ 键被丢弃', () => {
    const obj = parseJsonSafe<Record<string, unknown>>('{"__proto__":{"polluted":true},"a":1}');
    expect(Object.prototype.hasOwnProperty.call(obj, '__proto__')).toBe(false);
    expect(obj.a).toBe(1);
  });

  it('嵌套对象中的 __proto__ 键被丢弃', () => {
    const obj = parseJsonSafe<{ nested: Record<string, unknown> }>('{"nested":{"__proto__":{"x":1},"keep":2}}');
    expect(Object.prototype.hasOwnProperty.call(obj.nested, '__proto__')).toBe(false);
    expect(obj.nested.keep).toBe(2);
  });

  it('普通键与数组行为与原 JSON.parse 一致', () => {
    const obj = parseJsonSafe<{ list: number[]; s: string; b: boolean; n: null }>(
      '{"list":[1,2,3],"s":"x","b":true,"n":null}',
    );
    expect(obj).toEqual({ list: [1, 2, 3], s: 'x', b: true, n: null });
  });

  it('顶层数组 / 标量 / null 行为一致', () => {
    expect(parseJsonSafe<number[]>('[1,2]')).toEqual([1, 2]);
    expect(parseJsonSafe<number>('42')).toBe(42);
    expect(parseJsonSafe<string>('"str"')).toBe('str');
    expect(parseJsonSafe<null>('null')).toBeNull();
  });

  it('非法 JSON 抛 SyntaxError（与原行为一致）', () => {
    expect(() => parseJsonSafe('{not json')).toThrow(SyntaxError);
  });
});

describe('safeJsonReviver', () => {
  it('key=__proto__ 返回 undefined（删除键），其余原样返回', () => {
    expect(safeJsonReviver('__proto__', { polluted: true })).toBeUndefined();
    expect(safeJsonReviver('a', 1)).toBe(1);
    expect(safeJsonReviver('constructor', { c: 1 })).toEqual({ c: 1 }); // constructor 不处理
  });
});
