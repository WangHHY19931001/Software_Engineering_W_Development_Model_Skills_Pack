import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../src/utils/async-handler.js';

describe('asyncHandler', () => {
  it('TC-UNIT-002N: 正常 async 函数调用通过', async () => {
    const fn = async (_req: Request, res: Response, _next: NextFunction) => {
      res.json({ ok: true });
    };
    const wrapped = asyncHandler(fn);
    const res = { json: vi.fn() } as unknown as Response;
    wrapped({} as Request, res, (() => {}) as NextFunction);
    // 等待微任务执行完毕
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('TC-UNIT-002E: async 抛错转发到 next', async () => {
    const fn = async () => { throw new Error('boom'); };
    const wrapped = asyncHandler(fn);
    const next = vi.fn();
    await new Promise<void>((resolve) => {
      next.mockImplementation(() => resolve());
      wrapped({} as Request, {} as Response, next as NextFunction);
    });
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('TC-UNIT-002B: 返回非 Promise 也能处理', async () => {
    const fn = (_req: Request, res: Response, _next: NextFunction) => {
      res.json({ ok: 1 });
    };
    const wrapped = asyncHandler(fn as never);
    const res = { json: vi.fn() } as unknown as Response;
    wrapped({} as Request, res, (() => {}) as NextFunction);
    // 等待微任务执行完毕
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(res.json).toHaveBeenCalled();
  });
});
