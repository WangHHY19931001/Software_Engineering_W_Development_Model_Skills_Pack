import { describe, it, expect, vi } from 'vitest';
import { asyncHandler } from '../../src/utils/async-handler.js';
import type { Request, Response, NextFunction } from 'express';

describe('async-handler', () => {
  it('成功路径：调用 fn 并返回 Promise resolved', async () => {
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;
    const fn = vi.fn().mockResolvedValue(undefined);
    const handler = asyncHandler(fn);
    await handler(req, res, next);
    expect(fn).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('异常路径：fn reject → next(err) 被调用', async () => {
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;
    const err = new Error('boom');
    const fn = vi.fn().mockRejectedValue(err);
    const handler = asyncHandler(fn);
    handler(req, res, next);
    await new Promise((r) => setTimeout(r, 0));
    expect(next).toHaveBeenCalledWith(err);
  });

  it('同步抛出异常：fn 同步 throw → next(err) 被调用', async () => {
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;
    const err = new Error('sync boom');
    const fn = vi.fn().mockImplementation(() => {
      throw err;
    });
    const handler = asyncHandler(fn);
    handler(req, res, next);
    await new Promise((r) => setTimeout(r, 0));
    expect(next).toHaveBeenCalledWith(err);
  });
});
