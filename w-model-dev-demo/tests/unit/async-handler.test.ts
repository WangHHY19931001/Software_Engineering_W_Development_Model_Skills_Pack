import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AsyncHandler } from '../../src/utils/async-handler.js';

/**
 * UT-027：asyncHandler 单元测试。
 * 设计来源：docs/detailed-design.md §4.1 / RISK-002
 */
describe('AsyncHandler', () => {
  // UT-027: 捕获 rejected promise → next(err)
  it('UT-027: async handler 抛出 rejected promise 时通过 next(err) 捕获', async () => {
    const asyncHandler = new AsyncHandler();
    const throwingFn = async (_req: Request, _res: Response, _next: NextFunction) => {
      throw new Error('boom');
    };
    const wrapped = asyncHandler.wrap(throwingFn);

    const next = vi.fn();
    wrapped({} as Request, {} as Response, next);

    // 等待微任务队列刷新（Promise.catch 在微任务中执行）
    await vi.waitFor(() => expect(next).toHaveBeenCalledWith(expect.any(Error)));

    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect((next.mock.calls[0][0] as Error).message).toBe('boom');
  });

  it('UT-027-extra: 正常 async handler 不触发 next(err)', async () => {
    const asyncHandler = new AsyncHandler();
    const okFn = async (_req: Request, _res: Response, _next: NextFunction) => {
      return 'ok';
    };
    const wrapped = asyncHandler.wrap(okFn);

    const next = vi.fn();
    wrapped({} as Request, {} as Response, next);

    // 等待微任务队列刷新，确保 Promise.resolve(...).catch(next) 链已 settle
    await new Promise(resolve => setImmediate(resolve));

    // wrap 实现只在 reject 时调用 next(err)，成功时不会自动调用 next()
    expect(next).not.toHaveBeenCalled();
  });
});
