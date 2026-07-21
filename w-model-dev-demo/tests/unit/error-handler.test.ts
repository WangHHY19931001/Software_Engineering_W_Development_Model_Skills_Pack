import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorHandler } from '../../src/middleware/error-handler.js';
import {
  BadRequestError,
  NotFoundError,
  HttpError,
} from '../../src/utils/errors.js';
import type { Request, Response, NextFunction } from 'express';

describe('error-handler middleware', () => {
  let res: Response;
  let jsonSpy: ReturnType<typeof vi.fn>;
  let statusSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonSpy = vi.fn();
    statusSpy = vi.fn().mockReturnValue({ json: jsonSpy });
    res = { status: statusSpy } as unknown as Response;
  });

  it('HttpError 子类 → 对应 status + 业务码', () => {
    const err = new NotFoundError(40401, '文章不存在');
    errorHandler(err, {} as Request, res, vi.fn() as unknown as NextFunction);
    expect(statusSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith({
      code: 40401,
      message: '文章不存在',
      details: undefined,
    });
  });

  it('HttpError 含 details → details 透传', () => {
    const err = new BadRequestError(40001, '校验失败', [{ path: 'title' }]);
    errorHandler(err, {} as Request, res, vi.fn() as unknown as NextFunction);
    expect(jsonSpy).toHaveBeenCalledWith({
      code: 40001,
      message: '校验失败',
      details: [{ path: 'title' }],
    });
  });

  it('非 HttpError（普通 Error） → 500 + 50001', () => {
    const err = new Error('boom');
    errorHandler(err, {} as Request, res, vi.fn() as unknown as NextFunction);
    expect(statusSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({ code: 50001, message: '内部服务器错误' });
  });

  it('非 HttpError（字符串） → 500 + 50001', () => {
    const err: unknown = 'string error';
    errorHandler(err, {} as Request, res, vi.fn() as unknown as NextFunction);
    expect(statusSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({ code: 50001, message: '内部服务器错误' });
  });

  it('HttpError 抽象类直接实例化（理论不可达，但分支覆盖）', () => {
    // HttpError 是 abstract，但通过子类可覆盖 status 字段
    class CustomError extends HttpError {
      readonly status = 418;
    }
    const err = new CustomError(41801, "I'm a teapot");
    errorHandler(err, {} as Request, res, vi.fn() as unknown as NextFunction);
    expect(statusSpy).toHaveBeenCalledWith(418);
  });
});
