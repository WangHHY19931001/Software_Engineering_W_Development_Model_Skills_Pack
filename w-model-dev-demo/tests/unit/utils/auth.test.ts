import { describe, it, expect } from 'vitest';
import { JwtUtil, PasswordHasher, generateRandomToken } from '../../../src/utils/auth.js';
import { AuthenticationError } from '../../../src/utils/errors.js';

const SECRET = 'test-secret-blog-demo-32chars-min!!';

describe('JwtUtil (DD-004-003 / L4_auth_token_lifecycle)', () => {
  it('TC-UNIT-010N: sign+verify 正常往返', () => {
    const jwt = new JwtUtil(SECRET);
    const token = jwt.sign({ sub: 'u1', email: 'a@b.com', role: 'admin' });
    const decoded = jwt.verify(token);
    expect(decoded.sub).toBe('u1');
    expect(decoded.email).toBe('a@b.com');
    expect(decoded.role).toBe('admin');
  });

  it('TC-UNIT-010E: revoke 后 verify 抛 AuthenticationError（TokenNotRevoked 不变式）', () => {
    const jwt = new JwtUtil(SECRET);
    const token = jwt.sign({ sub: 'u1', email: 'a@b.com', role: 'admin' });
    jwt.revoke(token);
    expect(() => jwt.verify(token)).toThrow(AuthenticationError);
    expect(jwt.isRevoked(token)).toBe(true);
  });

  it('TC-UNIT-010B: 非法签名 token verify 失败', () => {
    const jwt = new JwtUtil(SECRET);
    expect(() => jwt.verify('invalid.token.here')).toThrow(AuthenticationError);
  });

  it('构造函数拒绝短 secret', () => {
    expect(() => new JwtUtil('short')).toThrow();
  });

  it('clearRevoked 清空撤销集合', () => {
    const jwt = new JwtUtil(SECRET);
    const t = jwt.sign({ sub: 'u1', email: 'a@b.com', role: 'admin' });
    jwt.revoke(t);
    jwt.clearRevoked();
    expect(jwt.verify(t).sub).toBe('u1');
  });
});

describe('PasswordHasher (DD-002-002 bcrypt)', () => {
  it('TC-UNIT-005N: hash+compare 正常往返', async () => {
    const hash = await PasswordHasher.hash('password123');
    expect(hash).not.toBe('password123');
    expect(await PasswordHasher.compare('password123', hash)).toBe(true);
  });

  it('TC-UNIT-005E: 错误密码 compare 返回 false', async () => {
    const hash = await PasswordHasher.hash('password123');
    expect(await PasswordHasher.compare('wrong', hash)).toBe(false);
  });

  it('TC-UNIT-005B: 相同密码两次 hash 不同（盐随机）', async () => {
    const h1 = await PasswordHasher.hash('password123');
    const h2 = await PasswordHasher.hash('password123');
    expect(h1).not.toBe(h2);
  });
});

describe('generateRandomToken', () => {
  it('返回 hex 字符串长度 = bytes*2', () => {
    const t = generateRandomToken(16);
    expect(t).toMatch(/^[0-9a-f]+$/);
    expect(t.length).toBe(32);
  });

  it('默认 32 bytes', () => {
    expect(generateRandomToken().length).toBe(64);
  });
});
