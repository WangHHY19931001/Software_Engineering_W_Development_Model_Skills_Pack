import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signToken, verifyToken } from '../../src/utils/jwt.js';
import { UnauthorizedError } from '../../src/utils/errors.js';

describe('UT-006 ~ UT-010: jwt utils', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-blog-demo';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it('UT-006: signToken 正常签发', () => {
    const token = signToken({ userId: 'u1', username: 'alice' }, 3600);
    expect(typeof token).toBe('string');
    const payload = verifyToken(token);
    expect(payload.userId).toBe('u1');
    expect(payload.username).toBe('alice');
  });

  it('UT-007: verifyToken 合法 token', () => {
    const token = signToken({ userId: 'u1', username: 'alice' });
    const payload = verifyToken(token);
    expect(payload.userId).toBe('u1');
    expect(payload.username).toBe('alice');
  });

  it('UT-008: verifyToken 过期 token → UnauthorizedError(40102)', () => {
    const token = signToken({ userId: 'u1', username: 'alice' }, -1);
    expect(() => verifyToken(token)).toThrow(UnauthorizedError);
    try {
      verifyToken(token);
    } catch (e) {
      expect((e as UnauthorizedError).code).toBe(40102);
    }
  });

  it('UT-009: verifyToken 伪造 token → UnauthorizedError(40102)', () => {
    expect(() => verifyToken('fake.token.value')).toThrow(UnauthorizedError);
    try {
      verifyToken('fake.token.value');
    } catch (e) {
      expect((e as UnauthorizedError).code).toBe(40102);
    }
  });

  it('UT-010: JWT_SECRET 缺失 → throw Error', () => {
    delete process.env.JWT_SECRET;
    expect(() => signToken({ userId: 'u1', username: 'alice' })).toThrow(
      /JWT_SECRET 未配置/,
    );
  });
});
