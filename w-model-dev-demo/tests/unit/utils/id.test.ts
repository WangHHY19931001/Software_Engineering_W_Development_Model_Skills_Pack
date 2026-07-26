import { describe, it, expect, beforeEach } from 'vitest';
import { generateId, generateUuid, resetCounter } from '../../../src/utils/id.js';

describe('id 工具', () => {
  beforeEach(() => resetCounter());

  it('generateId 正常路径：带前缀生成递增 id', () => {
    const a = generateId('user');
    const b = generateId('user');
    expect(a.startsWith('user-')).toBe(true);
    expect(b.startsWith('user-')).toBe(true);
    expect(a).not.toBe(b);
  });

  it('generateId 异常路径：默认前缀 fallback', () => {
    const id = generateId();
    expect(id.startsWith('id-')).toBe(true);
  });

  it('generateUuid 边界：UUID v4 格式', () => {
    const u = generateUuid();
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('resetCounter：重置后计数器回到 0', () => {
    generateId('x');
    generateId('x');
    resetCounter();
    const id = generateId('x');
    const counterPart = id.split('-')[2];
    expect(counterPart).toBe('1');
  });
});
