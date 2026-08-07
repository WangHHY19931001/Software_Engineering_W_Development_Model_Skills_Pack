/**
 * UT-046 JWT HS256 24h 有效期（jwtUtil.sign/verify，DD-046/CON-003）
 * UT-056 篡改令牌验签失败（jwtUtil.verify，DD-046/NFR-002）
 */
import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { JwtUtil } from '../../../src/utils/jwtUtil';

describe('UT-046 jwtUtil.sign/verify', () => {
  it('签发令牌 exp−iat ≤ 86400s，HS256 验签返回 sub', () => {
    process.env.JWT_SECRET = 'test-secret-001';
    const jwtUtil = new JwtUtil();
    const token = jwtUtil.sign({ sub: 'u_0001', role: 'reader' });

    expect(token).toMatch(/^eyJ/);
    const decoded: any = jwt.decode(token);
    expect(decoded.exp - decoded.iat).toBeLessThanOrEqual(86400);
    expect(decoded.role).toBe('reader');

    const payload = jwtUtil.verify(token);
    expect(payload.sub).toBe('u_0001');
    expect(payload.role).toBe('reader');
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
  });
});

describe('UT-056 jwtUtil.verify 篡改', () => {
  it('篡改 payload 段 → 40101；错误密钥签发 → 40101', () => {
    process.env.JWT_SECRET = 'test-secret-001';
    const jwtUtil = new JwtUtil();
    const token = jwtUtil.sign({ sub: 'u_0001', role: 'reader' });

    // 篡改 payload 段（sub 改写）后重签
    const parts = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'u_9999', role: 'reader' })).toString('base64url');
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    let error: any;
    try {
      jwtUtil.verify(tampered);
    } catch (err) {
      error = err;
    }
    expect(error.code).toBe(40101);
    expect(error.httpStatus).toBe(401);

    // 错误密钥签发的 token（同一载荷，不同密钥）
    const foreignToken = jwt.sign({ sub: 'u_0001', role: 'reader' }, 'wrong-secret-key', { algorithm: 'HS256', expiresIn: '1h' });
    expect(() => jwtUtil.verify(foreignToken)).toThrow();
  });

  it('过期 token → 40102', () => {
    process.env.JWT_SECRET = 'test-secret-001';
    const jwtUtil = new JwtUtil();
    const expired = jwt.sign({ sub: 'u_0001', role: 'reader' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '-1s' });
    let error: any;
    try {
      jwtUtil.verify(expired);
    } catch (err) {
      error = err;
    }
    expect(error.code).toBe(40102);
  });
});
