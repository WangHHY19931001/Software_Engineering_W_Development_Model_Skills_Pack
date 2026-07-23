/**
 * PasswordHasher 单元测试（UT-038~040）。
 * 真实 bcrypt cost=10。
 */
import { describe, it, expect } from 'vitest';
import { PasswordHasher } from '../../../src/utils/password';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('UT-038 hash 返回 $2b$10$ 格式 + 无明文', async () => {
    const hash = await hasher.hash('Passw0rd!');
    expect(hash).toMatch(/^\$2b\$10\$/);
    expect(hash).not.toContain('Passw0rd');
  });

  it('UT-039 compare 正确密码 true / 错误密码 false', async () => {
    const hash = await hasher.hash('Passw0rd!');
    expect(await hasher.compare('Passw0rd!', hash)).toBe(true);
    expect(await hasher.compare('wrong', hash)).toBe(false);
  });

  it('UT-040 getRounds cost=10', async () => {
    const hash = await hasher.hash('Passw0rd!');
    expect(hasher.getRounds(hash)).toBe(10);
  });
});
