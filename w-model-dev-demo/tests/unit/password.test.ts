import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword, getHashCost } from '../../src/utils/password.js';

describe('UT-001 ~ UT-005: password utils', () => {
  it('UT-001: hashPassword 返回字符串并以 $2b$10$ 开头', async () => {
    const hash = await hashPassword('Pass1234');
    expect(typeof hash).toBe('string');
    expect(hash.startsWith('$2b$10$')).toBe(true);
  });

  it('UT-002: 不同输入产生不同 hash', async () => {
    const h1 = await hashPassword('A');
    const h2 = await hashPassword('B');
    expect(h1).not.toBe(h2);
  });

  it('UT-003: comparePassword 正确密码 → true', async () => {
    const hash = await hashPassword('Pass1234');
    expect(await comparePassword('Pass1234', hash)).toBe(true);
  });

  it('UT-004: comparePassword 错误密码 → false', async () => {
    const hash = await hashPassword('Pass1234');
    expect(await comparePassword('Wrong', hash)).toBe(false);
  });

  it('UT-005: getHashCost 返回 10', async () => {
    const hash = await hashPassword('Pass1234');
    expect(getHashCost(hash)).toBe(10);
  });
});
