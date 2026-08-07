/**
 * UT-043 审计留痕且不含明文凭据（auditMiddleware.audit，DD-043/CON-004/RH-01）
 */
import { describe, it, expect, vi } from 'vitest';
import { AuditMiddleware } from '../../../src/middlewares/auditMiddleware';
import { makeReq, makeRes, makeNext } from '../helpers';

describe('UT-043 auditMiddleware.audit', () => {
  it('登录操作写审计；审计记录不含 password/token/请求体/Bearer 头', () => {
    const append = vi.fn();
    const auditLogStore: any = { append };
    const middleware = new AuditMiddleware(auditLogStore);
    const req = makeReq({
      path: '/api/auth/login',
      ip: '10.0.0.1',
      body: { identifier: 'reader1', password: 'Passw0rd!x' },
      headers: { authorization: 'Bearer secret.token.value', 'x-request-id': 'req-123' },
      user: { userId: 'u_0001', role: 'reader' },
    });
    const res = makeRes();
    res.statusCode = 200;
    const next = makeNext();

    middleware.audit('login')(req, res, next);
    expect(next).toHaveBeenCalled();
    res.emit('finish');

    expect(append).toHaveBeenCalledTimes(1);
    const log = append.mock.calls[0][0];
    expect(log.actionType).toBe('login');
    expect(log.actorId).toBe('u_0001');
    expect(log.resourceType).toBeDefined();
    expect(log.httpStatus).toBe(200);
    expect(log.result).toBe('success');
    expect(log.requestId).toBe('req-123');

    // 负向断言：无任何明文凭据/请求体
    expect(JSON.stringify(log)).not.toContain('Passw0rd!x');
    expect(log).not.toHaveProperty('password');
    expect(log).not.toHaveProperty('token');
    expect(JSON.stringify(log)).not.toContain('Bearer');
  });

  it('失败请求记录 result=failure', () => {
    const append = vi.fn();
    const middleware = new AuditMiddleware({ append } as any);
    const req = makeReq({ path: '/api/articles/a_1', user: { userId: 'u_0002', role: 'blogger' }, params: { id: 'a_1' } });
    const res = makeRes();
    res.statusCode = 404;
    const next = makeNext();
    middleware.audit('publish')(req, res, next);
    res.emit('finish');
    expect(append.mock.calls[0][0].result).toBe('failure');
  });
});
