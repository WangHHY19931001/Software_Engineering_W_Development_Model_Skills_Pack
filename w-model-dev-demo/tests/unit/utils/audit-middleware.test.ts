import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuditMiddleware } from '../../../src/utils/audit-middleware.js';
import type { AuditService } from '../../../src/services/audit.service.js';

describe('AuditMiddleware (DD-019-004)', () => {
  it('TC-UNIT-058N: POST 请求 finish 后写入审计', () => {
    const logSpy = vi.fn().mockResolvedValue({});
    const svc = { log: logSpy } as unknown as AuditService;
    const mw = new AuditMiddleware(svc);
    const next = vi.fn();
    const res = { on: vi.fn((evt: string, cb: () => void) => { if (evt === 'finish') cb(); }) } as unknown as Response;
    const req = {
      method: 'POST',
      path: '/api/articles',
      params: {},
      ip: '1.2.3.4',
    } as unknown as Request;
    mw.record()(req, res, next as NextFunction);
    expect(next).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
  });

  it('TC-UNIT-058E: GET 请求不写入审计', () => {
    const logSpy = vi.fn();
    const svc = { log: logSpy } as unknown as AuditService;
    const mw = new AuditMiddleware(svc);
    const next = vi.fn();
    const res = { on: vi.fn() } as unknown as Response;
    const req = { method: 'GET', path: '/api/articles', params: {} } as unknown as Request;
    mw.record()(req, res, next as NextFunction);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('TC-UNIT-058B: audit.log 抛错不阻断主流程（best-effort）', () => {
    const svc = {
      log: vi.fn().mockImplementation(() => { throw new Error('audit fail'); }),
    } as unknown as AuditService;
    const mw = new AuditMiddleware(svc);
    const next = vi.fn();
    const res = { on: vi.fn((evt: string, cb: () => void) => { if (evt === 'finish') cb(); }) } as unknown as Response;
    const req = { method: 'DELETE', path: '/api/articles/x', params: { id: 'x' } } as unknown as Request;
    expect(() => mw.record()(req, res, next as NextFunction)).not.toThrow();
    expect(next).toHaveBeenCalled();
  });
});
