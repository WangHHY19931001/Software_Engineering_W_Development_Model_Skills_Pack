/**
 * ErrorHandler 单元测试（UT-049）。
 * AppError 按 status+code 序列化 / 非 AppError→50001 / 不泄露堆栈。
 */
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../../src/middleware/error-handler';
import { NotFoundError, ErrorCode, AppError } from '../../../src/utils/errors';

function makeReqResNext() {
  const req = {} as Request;
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();
  const res = { status, json } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next, status, json };
}

describe('ErrorHandler', () => {
  it('UT-049 AppError 按 status+code 序列化 / 非 AppError→50001 / 不泄露堆栈', () => {
    // AppError 路径
    const ctx1 = makeReqResNext();
    const appErr = new NotFoundError(ErrorCode.NOT_FOUND, '文章不存在');
    errorHandler(appErr, ctx1.req, ctx1.res, ctx1.next);
    expect(ctx1.status).toHaveBeenCalledWith(404);
    const body1 = ctx1.json.mock.calls[0][0] as Record<string, unknown>;
    expect(body1.code).toBe(40401);
    expect(body1.message).toBe('文章不存在');

    // 非 AppError 路径
    const ctx2 = makeReqResNext();
    const plainErr = new Error('boom');
    plainErr.stack = 'Error: boom\n    at some/file.ts:42';
    errorHandler(plainErr, ctx2.req, ctx2.res, ctx2.next);
    expect(ctx2.status).toHaveBeenCalledWith(500);
    const body2 = ctx2.json.mock.calls[0][0] as Record<string, unknown>;
    expect(body2.code).toBe(50001);
    expect(body2.message).not.toContain('stack');
    expect(body2.message).not.toContain('boom');
    expect(AppError).toBeDefined();
  });
});
