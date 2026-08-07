/**
 * UT-041 认证中间件无令牌/过期令牌（authMiddleware.authenticate，DD-041/INTF-002/RH-02）
 */
import { describe, it, expect, vi } from 'vitest';
import { AuthMiddleware } from '../../../src/middlewares/authMiddleware';
import { BizError } from '../../../src/utils/errors';
import { makeReq, makeRes, makeNext } from '../helpers';

describe('UT-041 authMiddleware.authenticate', () => {
  it('无 Authorization 头 → next(40101)', () => {
    const jwtUtil: any = { verify: vi.fn() };
    const middleware = new AuthMiddleware(jwtUtil);
    const next = makeNext();
    middleware.authenticate(makeReq({ headers: {} }), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 40101 }));
  });

  it('过期 token（exp 已过）→ next(40102)（令牌状态 active→expired）', () => {
    const jwtUtil: any = { verify: vi.fn().mockImplementation(() => { throw new BizError(40102); }) };
    const middleware = new AuthMiddleware(jwtUtil);
    const next = makeNext();
    middleware.authenticate(makeReq({ headers: { authorization: 'Bearer expired.token.here' } }), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 40102 }));
  });

  it('合法 token → req.user 挂载（userId/role）且 next() 无参', () => {
    const jwtUtil: any = { verify: vi.fn().mockReturnValue({ sub: 'u_0001', role: 'reader', iat: 1, exp: 86401 }) };
    const middleware = new AuthMiddleware(jwtUtil);
    const req = makeReq({ headers: { authorization: 'Bearer valid.token' } });
    const next = makeNext();
    middleware.authenticate(req, makeRes(), next);
    expect(req.user.userId).toBe('u_0001');
    expect(req.user.role).toBe('reader');
    expect(next).toHaveBeenCalledWith();
  });

  it('requireBlogger：非博主 → next(40301)；博主放行', () => {
    const middleware = new AuthMiddleware({ verify: vi.fn() } as any);
    const next1 = makeNext();
    middleware.requireBlogger(makeReq({ user: { userId: 'u_0001', role: 'reader' } }), makeRes(), next1);
    expect(next1).toHaveBeenCalledWith(expect.objectContaining({ code: 40301 }));

    const next2 = makeNext();
    middleware.requireBlogger(makeReq({ user: { userId: 'u_0002', role: 'blogger' } }), makeRes(), next2);
    expect(next2).toHaveBeenCalledWith();
  });
});
