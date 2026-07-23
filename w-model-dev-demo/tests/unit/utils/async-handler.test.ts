/**
 * asyncHandler 单元测试（UT-050）。
 * resolve 正常 / reject 转发 next(err)。
 * 用 setTimeout macrotask flush 保证 microtask 队列（含 .catch(next)）全部排空。
 */
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../../../src/utils/async-handler';

function makeReqResNext() {
  const req = {} as Request;
  const res = {} as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('asyncHandler', () => {
  it('UT-050 resolve 正常 / reject 转发 next(err)', async () => {
    // resolve 路径
    const okFn = vi.fn(async (_req: Request, _res: Response, _next: NextFunction) => {
      return 'ok';
    });
    const wrappedOk = asyncHandler(okFn);
    const ctx1 = makeReqResNext();
    wrappedOk(ctx1.req, ctx1.res, ctx1.next);
    await flush();
    expect(ctx1.next).not.toHaveBeenCalled();

    // reject 路径
    const boom = new Error('boom');
    const errFn = vi.fn(async (_req: Request, _res: Response, _next: NextFunction) => {
      throw boom;
    });
    const wrappedErr = asyncHandler(errFn);
    const ctx2 = makeReqResNext();
    wrappedErr(ctx2.req, ctx2.res, ctx2.next);
    await flush();
    expect(ctx2.next).toHaveBeenCalledWith(boom);
  });
});
