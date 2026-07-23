/**
 * JwtService 单元测试（UT-041~044）。
 * HS256，exp=iat+3600，密钥缺失抛 50001。
 * 测试脚本已注入 JWT_SECRET=test-secret-blog-demo；UT-044 临时删除并恢复。
 */
import { describe, it, expect, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { JwtService } from '../../../src/utils/jwt';
import { UnauthorizedError, InternalError, ErrorCode } from '../../../src/utils/errors';

describe('JwtService', () => {
  const service = new JwtService();
  const ORIGINAL_SECRET = process.env.JWT_SECRET;

  afterEach(() => {
    if (ORIGINAL_SECRET !== undefined) {
      process.env.JWT_SECRET = ORIGINAL_SECRET;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  it('UT-041 sign 返回三段式 + exp=iat+3600', () => {
    const token = service.sign({ userId: 'u1', username: 'alice' });
    expect(token.split('.').length).toBe(3);
    const decoded = jwt.decode(token) as { exp: number; iat: number };
    expect(decoded.exp - decoded.iat).toBe(3600);
  });

  it('UT-042 verify 合法返回 payload', () => {
    const token = service.sign({ userId: 'u1', username: 'alice' });
    const payload = service.verify(token);
    expect(payload.userId).toBe('u1');
    expect(payload.username).toBe('alice');
  });

  it('UT-043 verify 过期/伪造抛 40102', () => {
    expect(() => service.verify('fake.token.here')).toThrow(UnauthorizedError);
    try {
      service.verify('fake.token.here');
    } catch (err) {
      expect((err as UnauthorizedError).code).toBe(ErrorCode.UNAUTHORIZED_TOKEN);
      expect((err as UnauthorizedError).httpStatus).toBe(401);
    }
    // 过期 token：用同密钥签发 exp=now-1
    const expired = jwt.sign({ userId: 'u1', username: 'alice' }, ORIGINAL_SECRET!, {
      algorithm: 'HS256',
      expiresIn: -1,
    });
    expect(() => service.verify(expired)).toThrow(UnauthorizedError);
  });

  it('UT-044 sign 密钥缺失抛 50001', () => {
    delete process.env.JWT_SECRET;
    expect(() => service.sign({ userId: 'u1', username: 'alice' })).toThrow(InternalError);
    try {
      service.sign({ userId: 'u1', username: 'alice' });
    } catch (err) {
      expect((err as InternalError).code).toBe(ErrorCode.INTERNAL);
      expect((err as InternalError).httpStatus).toBe(500);
    }
  });
});
