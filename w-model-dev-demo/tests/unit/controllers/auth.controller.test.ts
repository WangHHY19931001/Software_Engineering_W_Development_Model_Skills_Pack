/**
 * AuthController 单元测试（UT-051）。
 * mock AuthService，验证 HTTP 适配：register 201 / login 200。
 */
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthController } from '../../../src/controllers/auth.controller';
import type { AuthService } from '../../../src/services/user.service';

function makeRes() {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();
  const end = vi.fn().mockReturnThis();
  return { res: { status, json, end } as unknown as Response, status, json, end };
}

describe('AuthController', () => {
  it('UT-051 register 201 / login 200', async () => {
    const mockService = {
      register: vi.fn().mockResolvedValue({ userId: 'u1', username: 'alice' }),
      login: vi.fn().mockResolvedValue({ token: 'tok.a.b', expiresIn: 3600 }),
      verifyToken: vi.fn(),
    } as unknown as AuthService;
    const controller = new AuthController(mockService);

    // register 201
    const reqReg = { body: { username: 'alice', password: 'Passw0rd!' } } as Request;
    const r1 = makeRes();
    const nextReg = vi.fn() as unknown as NextFunction;
    await controller.register(reqReg, r1.res, nextReg);
    expect(r1.status).toHaveBeenCalledWith(201);
    expect(r1.json.mock.calls[0][0]).toEqual({ userId: 'u1', username: 'alice' });
    expect((r1.json.mock.calls[0][0] as { userId: string }).userId).toBeDefined();

    // login 200
    const reqLogin = { body: { username: 'alice', password: 'Passw0rd!' } } as Request;
    const r2 = makeRes();
    const nextLogin = vi.fn() as unknown as NextFunction;
    await controller.login(reqLogin, r2.res, nextLogin);
    expect(r2.status).toHaveBeenCalledWith(200);
    expect((r2.json.mock.calls[0][0] as { token: string }).token).toBeDefined();
    expect((r2.json.mock.calls[0][0] as { expiresIn: number }).expiresIn).toBe(3600);
  });
});
