/**
 * UT-001 注册接口成功透传（AuthController.register，DD-001/INTF-001）
 */
import { describe, it, expect, vi } from 'vitest';
import { AuthController } from '../../../src/routes/identity/authController';
import { makeReq, makeRes, makeNext } from '../helpers';

describe('UT-001 AuthController.register', () => {
  it('校验通过后控制器将 authService.register 返回值组装为 201 响应', async () => {
    const authService: any = {
      register: vi.fn().mockResolvedValue({
        userId: 'u_0001',
        username: 'reader1',
        email: 'r1@example.com',
        role: 'reader',
        createdAt: '2026-08-07T10:00:00.000Z',
      }),
    };
    const profileService: any = {};
    const controller = new AuthController(authService, profileService);
    const req = makeReq({ body: { username: 'reader1', email: 'r1@example.com', password: 'Passw0rd!x' } });
    const res = makeRes();
    const next = makeNext();

    await controller.register(req, res, next);

    expect(authService.register).toHaveBeenCalledTimes(1);
    expect(authService.register).toHaveBeenCalledWith({ username: 'reader1', email: 'r1@example.com', password: 'Passw0rd!x' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 0,
        message: 'ok',
        data: expect.objectContaining({ userId: 'u_0001', role: 'reader' }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('login：组装 {token, expiresIn, user} 响应', async () => {
    const authService: any = {
      login: vi.fn().mockResolvedValue({ token: 'jwt-token', expiresIn: 86400, user: { userId: 'u_0001', username: 'reader1', role: 'reader' } }),
    };
    const controller = new AuthController(authService, {});
    const req = makeReq({ body: { identifier: 'reader1', password: 'Passw0rd!x' } });
    const res = makeRes();
    await controller.login(req, res, makeNext());
    expect(authService.login).toHaveBeenCalledWith('reader1', 'Passw0rd!x');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ token: 'jwt-token', expiresIn: 86400 }) }));
  });

  it('applyBlogger：返回 {userId, role: blogger, updatedAt}', async () => {
    const authService: any = { applyBlogger: vi.fn().mockResolvedValue({ userId: 'u_0002', role: 'blogger', createdAt: '2026-08-07T10:00:00.000Z' }) };
    const controller = new AuthController(authService, {});
    const req = makeReq({ user: { userId: 'u_0002', role: 'reader' } });
    const res = makeRes();
    await controller.applyBlogger(req, res, makeNext());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u_0002', role: 'blogger' }) }),
    );
  });

  it('getProfile / updateProfile / changePassword：成功透传', async () => {
    const profileService: any = {
      getProfile: vi.fn().mockResolvedValue({ userId: 'u_0001', username: 'reader1' }),
      updateProfile: vi.fn().mockResolvedValue({ userId: 'u_0001', nickname: '新昵称' }),
      changePassword: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new AuthController({} as any, profileService);

    const res1 = makeRes();
    await controller.getProfile(makeReq({ user: { userId: 'u_0001', role: 'reader' } }), res1, makeNext());
    expect(res1.json).toHaveBeenCalledWith(expect.objectContaining({ data: { userId: 'u_0001', username: 'reader1' } }));

    const res2 = makeRes();
    await controller.updateProfile(makeReq({ user: { userId: 'u_0001', role: 'reader' }, body: { nickname: '新昵称' } }), res2, makeNext());
    expect(profileService.updateProfile).toHaveBeenCalledWith('u_0001', { nickname: '新昵称' });

    const res3 = makeRes();
    await controller.changePassword(makeReq({ user: { userId: 'u_0001', role: 'reader' }, body: { oldPassword: 'OldPassw0!', newPassword: 'NewPassw0rd!' } }), res3, makeNext());
    expect(res3.json).toHaveBeenCalledWith(expect.objectContaining({ data: { updated: true } }));
  });

  it('changePassword：old === new → 40002', async () => {
    const controller = new AuthController({} as any, { changePassword: vi.fn() } as any);
    const res = makeRes();
    await controller.changePassword(makeReq({ user: { userId: 'u_0001', role: 'reader' }, body: { oldPassword: 'SamePass0!', newPassword: 'SamePass0!' } }), res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 40002 }) }));
  });

  it('未认证（req.user 缺失）→ 40101', async () => {
    const controller = new AuthController({} as any, {} as any);
    const res = makeRes();
    await controller.getProfile(makeReq({ user: undefined }), res, makeNext());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 40101 }) }));
  });
});
