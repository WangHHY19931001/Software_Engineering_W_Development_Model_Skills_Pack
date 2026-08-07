/**
 * UT-002 注册成功 bcrypt 哈希且响应不含明文密码（authService.register，DD-002/INTF-001/NFR-002）
 * UT-051 登录凭据错误统一 40101 防枚举（authService.login，DD-002/INTF-002）
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { UserStore } from '../../../src/stores/userStore';
import { AuthService } from '../../../src/services/identity/authService';
import { JwtUtil } from '../../../src/utils/jwtUtil';

function makeStore(): UserStore {
  const userStore = new UserStore();
  userStore.create({ id: 'u_0001', username: 'reader1', email: 'r1@example.com', passwordHash: 'h', role: 'reader', createdAt: new Date().toISOString() });
  userStore.create({ id: 'u_0002', username: 'blogger1', email: 'b1@example.com', passwordHash: 'h', role: 'blogger', createdAt: new Date().toISOString() });
  return userStore;
}

describe('UT-002 authService.register', () => {
  it('密码以 bcrypt 加盐哈希落库；返回对象不含 password/passwordHash', async () => {
    const userStore = new UserStore();
    const authService = new AuthService(userStore, new JwtUtil());

    const result = await authService.register({ username: 'reader1', email: 'r1@example.com', password: 'Passw0rd!x' });

    const user = userStore.findById(result.userId);
    expect(user).not.toBeNull();
    const hash = user!.passwordHash;
    expect(hash).not.toBe('Passw0rd!x');
    expect(await bcrypt.compare('Passw0rd!x', hash)).toBe(true);
    expect((result as any).password).toBeUndefined();
    expect((result as any).passwordHash).toBeUndefined();
    expect(Object.keys(result)).not.toContain('password');
  });
});

describe('UT-051 authService.login', () => {
  let authService: AuthService;
  beforeAll(async () => {
    const userStore = new UserStore();
    const passwordHash = await bcrypt.hash('Passw0rd!x', 10);
    userStore.create({ id: 'u_0001', username: 'reader1', email: 'r1@example.com', passwordHash, role: 'reader', createdAt: new Date().toISOString() });
    authService = new AuthService(userStore, new JwtUtil());
  });

  it('用户名不存在与密码错误返回同一错误码（防账号枚举）', async () => {
    const err1 = await authService.login('no_such_user', 'Passw0rd!x').catch((e) => e);
    const err2 = await authService.login('reader1', 'WrongPass0!').catch((e) => e);

    expect(err1.code).toBe(40101);
    expect(err2.code).toBe(40101);
    expect(err1.message).toBe(err2.message);
  });

  it('合法凭据签发 24h JWT（exp−iat ≤ 86400）', async () => {
    const session = await authService.login('reader1', 'Passw0rd!x');
    expect(session.token).toMatch(/^eyJ/);
    expect(session.expiresIn).toBe(86400);
    expect(session.user.userId).toBe('u_0001');
    const payload: any = JSON.parse(Buffer.from(session.token.split('.')[1], 'base64url').toString('utf-8'));
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(86400);
    expect(payload.role).toBe('reader');
  });
});

describe('authService 其余方法（applyBlogger/issueToken/跨模块只读）', () => {
  it('applyBlogger：reader→blogger；幂等（已是 blogger 直接返回）', async () => {
    const service = new AuthService(makeStore(), new JwtUtil());
    const updated = await service.applyBlogger('u_0001');
    expect(updated.role).toBe('blogger');
    const again = await service.applyBlogger('u_0001');
    expect(again.role).toBe('blogger');
  });

  it('applyBlogger 用户不存在 → 40401', async () => {
    const service = new AuthService(makeStore(), new JwtUtil());
    const err = await service.applyBlogger('u_9999').catch((e) => e);
    expect(err.code).toBe(40401);
  });

  it('issueToken：签 {sub, role} 24h 令牌（统一角色声明，reworkHint 处置）', async () => {
    const service = new AuthService(makeStore(), new JwtUtil());
    const token = await service.issueToken('u_0001');
    const payload: any = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf-8'));
    expect(payload.sub).toBe('u_0001');
    expect(payload.role).toBe('reader');
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(86400);
  });

  it('issueToken 前置不变式：userId 未注册 → 40401（active ⇒ registered）', async () => {
    const service = new AuthService(makeStore(), new JwtUtil());
    const err = await service.issueToken('u_9999').catch((e) => e);
    expect(err.code).toBe(40401);
  });

  it('跨模块只读：getUserById / getBloggerById / isBlogger', async () => {
    const service = new AuthService(makeStore(), new JwtUtil());
    expect((await service.getUserById('u_0001'))?.username).toBe('reader1');
    expect(await service.getUserById('u_9999')).toBeNull();
    expect((await service.getBloggerById('u_0002'))?.role).toBe('blogger');
    expect(await service.getBloggerById('u_0001')).toBeNull();
    expect(await service.isBlogger('u_0002')).toBe(true);
    expect(await service.isBlogger('u_0001')).toBe(false);
  });
});
