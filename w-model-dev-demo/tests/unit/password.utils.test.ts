import { describe, it, expect, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { PasswordUtils } from '../../src/utils/password.js';
import { AppError } from '../../src/utils/errors.js';

/**
 * UT-022 / UT-023 / UT-024B ~ UT-026B：密码哈希工具单元测试。
 * 设计来源：docs/detailed-design.md §4.1
 */
describe('PasswordUtils', () => {
  const passwordUtils = new PasswordUtils();

  // UT-022: hash 返回 $2b$10$ 前缀 + cost=10
  it('UT-022: hash 返回 $2b$10$ 前缀且 cost=10', () => {
    const password = 'Passw0rd!';
    const hash = passwordUtils.hash(password);

    expect(hash).toMatch(/^\$2b\$10\$/);
    expect(bcrypt.getRounds(hash)).toBe(10);
    expect(hash).not.toBe('Passw0rd!');
  });

  // UT-023: compare 正确密码 → true / 错误 → false
  it('UT-023: compare 正确密码返回 true，错误密码返回 false', () => {
    const password = 'Passw0rd!';
    const hash = passwordUtils.hash(password);

    expect(passwordUtils.compare('Passw0rd!', hash)).toBe(true);
    expect(passwordUtils.compare('Wrong', hash)).toBe(false);
  });

  it('UT-023-extra: compare 对非法 hash 返回 false（不抛错）', () => {
    expect(passwordUtils.compare('Passw0rd!', 'not-a-valid-hash')).toBe(false);
  });

  // ===== 边界分支补充（UT-024B ~ UT-026B）=====
  // 目标：将 password.ts branches 覆盖率从 60% 提升至 ≥ 80%

  // UT-024B: bcrypt.hashSync 内部抛错 → hash 捕获并抛 AppError(50002)（覆盖 line 17-19 catch 分支）
  it('UT-024B: bcrypt.hashSync 抛错时 hash 捕获并包装为 AppError(50002)', () => {
    const hashSpy = vi.spyOn(bcrypt, 'hashSync').mockImplementationOnce(() => {
      throw new Error('hash internal failure');
    });
    try {
      passwordUtils.hash('Passw0rd!');
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(50002);
      expect((err as AppError).httpStatus).toBe(500);
      expect((err as AppError).message).toContain('密码哈希失败');
      expect((err as AppError).message).toContain('hash internal failure');
    } finally {
      hashSpy.mockRestore();
    }
  });

  // UT-025B: bcrypt.compareSync 内部抛错 → compare 捕获并返回 false（覆盖 line 25-28 catch 分支）
  it('UT-025B: bcrypt.compareSync 抛错时 compare 捕获并返回 false（不向上抛出）', () => {
    const compareSpy = vi.spyOn(bcrypt, 'compareSync').mockImplementationOnce(() => {
      throw new Error('compare internal failure');
    });
    try {
      const result = passwordUtils.compare('Passw0rd!', '$2b$10$somehash');
      expect(result).toBe(false);
    } finally {
      compareSpy.mockRestore();
    }
  });

  // UT-026B: compare 接受 null/undefined 参数（经类型断言）→ 不抛错，返回 false
  it('UT-026B: compare 传入 undefined hash 时不抛错返回 false', () => {
    // bcrypt.compareSync 对 undefined hash 会抛错，被 catch 后返回 false
    const result = passwordUtils.compare('Passw0rd!', undefined as unknown as string);
    expect(result).toBe(false);
  });
});
