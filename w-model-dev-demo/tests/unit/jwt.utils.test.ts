import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { JwtUtils } from '../../src/utils/jwt.js';
import { AppError, AuthError } from '../../src/utils/errors.js';

/**
 * UT-024 / UT-025 / UT-031B~034B：JWT 工具单元测试。
 * 设计来源：docs/detailed-design.md §4.1
 */
describe('JwtUtils', () => {
  const secret = process.env.JWT_SECRET ?? 'test-secret-blog-demo';
  const jwtUtils = new JwtUtils(secret, 3600);

  // UT-024: sign + verify 签发三段式 + exp=3600 + verify 还原
  it('UT-024: sign 返回三段式 JWT，exp - iat === 3600，verify 还原 payload', () => {
    const payload = { userId: 'u-1', username: 'alice' };
    const token = jwtUtils.sign(payload);

    expect(token.split('.')).toHaveLength(3);

    const p = jwtUtils.verify(token);
    expect(p.userId).toBe('u-1');
    expect(p.username).toBe('alice');
    expect(p.exp).toBeDefined();
    expect(p.iat).toBeDefined();
    expect(p.exp! - p.iat!).toBe(3600);
  });

  // UT-025: 过期 / 无效 token → AuthError 40102
  it('UT-025: 过期 token 抛 AuthError(40102)', () => {
    const expiredToken = jwt.sign(
      { userId: 'u-1', username: 'alice', exp: Math.floor(Date.now() / 1000) - 1 },
      secret,
    );

    try {
      jwtUtils.verify(expiredToken);
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).code).toBe(40102);
    }
  });

  it('UT-025: 伪造签名 token 抛 AuthError(40102)', () => {
    const forgedToken = jwt.sign({ userId: 'u-1', username: 'alice' }, 'wrong-secret');

    try {
      jwtUtils.verify(forgedToken);
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).code).toBe(40102);
    }
  });

  // ===== 边界分支补充（UT-031B ~ UT-035B）=====
  // 目标：将 jwt.ts branches 覆盖率从 57.14% 提升至 ≥ 80%

  // UT-031B: 空 secret 调 sign → 抛 AppError(50001)（覆盖 line 23-25 的 !this.secret 分支）
  it('UT-031B: 空 secret 构造的 JwtUtils.sign 抛 AppError(50001, "JWT_SECRET 未配置")', () => {
    const emptySecretJwt = new JwtUtils('', 3600);
    try {
      emptySecretJwt.sign({ userId: 'u-1', username: 'alice' });
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(50001);
      expect((err as AppError).httpStatus).toBe(500);
      expect((err as AppError).message).toBe('JWT_SECRET 未配置');
    }
  });

  // UT-032B: jwt.sign 内部抛错 → sign 捕获并抛 AppError(50001)（覆盖 line 30-32 catch 分支）
  it('UT-032B: jwt.sign 内部抛错时被捕获并包装为 AppError(50001)', () => {
    const signSpy = vi.spyOn(jwt, 'sign').mockImplementationOnce(() => {
      throw new Error('sign internal failure');
    });
    try {
      jwtUtils.sign({ userId: 'u-1', username: 'alice' });
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe(50001);
      expect((err as AppError).message).toContain('JWT 签发失败');
      expect((err as AppError).message).toContain('sign internal failure');
    } finally {
      signSpy.mockRestore();
    }
  });

  // UT-033B: payload 中 userId/username 不是 string → verify 抛 AuthError(40102)
  // （覆盖 line 38 true 分支 + line 48 instanceof AuthError true 分支 - 内部抛出后被外层 catch 捕获并 re-throw）
  it('UT-033B: token payload userId 为 number 时 verify 抛 AuthError(40102)', () => {
    // 手动构造 userId 为 number 的 token（绕过 JwtUtils.sign 的类型约束）
    const badPayloadToken = jwt.sign({ userId: 123, username: 'alice' }, secret);

    try {
      jwtUtils.verify(badPayloadToken);
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).code).toBe(40102);
    }
  });

  // UT-034B: token 无 iat / exp（noTimestamp + 不设 expiresIn）→ verify 返回 iat/exp 为 undefined
  // （覆盖 line 44 false 分支 + line 45 false 分支）
  it('UT-034B: 无 iat/exp 的 token verify 返回 iat=undefined, exp=undefined', () => {
    const tokenNoTimestamp = jwt.sign({ userId: 'u-1', username: 'alice' }, secret, {
      noTimestamp: true,
    });

    const p = jwtUtils.verify(tokenNoTimestamp);
    expect(p.userId).toBe('u-1');
    expect(p.username).toBe('alice');
    expect(p.iat).toBeUndefined();
    expect(p.exp).toBeUndefined();
  });

  // UT-035B: 格式非法的 token（非 JWT 字符串）→ verify 抛 AuthError(40102)
  // （覆盖 line 47 catch 分支 + line 48 instanceof AuthError false 分支 - jwt.verify 直接抛 JsonWebTokenError）
  it('UT-035B: 非 JWT 格式字符串 verify 抛 AuthError(40102)', () => {
    try {
      jwtUtils.verify('this-is-not-a-jwt');
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).code).toBe(40102);
    }
  });
});
