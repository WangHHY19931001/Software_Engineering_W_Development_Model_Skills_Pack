import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { ErrorHandler } from '../../src/middleware/error-handler.js';
import {
  AppError,
  NotFoundError,
  ValidationError,
  AuthError,
  ForbiddenError,
  ConflictError,
} from '../../src/utils/errors.js';

/**
 * UT-028 / UT-029：ErrorHandler 单元测试。
 * 设计来源：docs/detailed-design.md §4.1
 */
describe('ErrorHandler', () => {
  const errorHandler = new ErrorHandler();

  function buildRes() {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn().mockReturnThis();
    return { res: { status, json } as unknown as Response, status, json };
  }

  // UT-028: AppError → 正确 HTTP status + code
  it('UT-028: NotFoundError 映射为 404 + {code:40401, message:"文章不存在"}', () => {
    const { res, status, json } = buildRes();
    const next = vi.fn() as unknown as NextFunction;

    errorHandler.handle(new NotFoundError('文章不存在'), {} as Request, res, next);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ code: 40401, message: '文章不存在' });
  });

  it('UT-028-extra: 各 AppError 子类 HTTP status 映射正确', () => {
    const cases: Array<{ err: AppError; httpStatus: number; code: number }> = [
      { err: new ValidationError('参数错误'), httpStatus: 400, code: 40001 },
      { err: new AuthError(40101, '认证失败'), httpStatus: 401, code: 40101 },
      { err: new AuthError(40102, 'JWT 无效'), httpStatus: 401, code: 40102 },
      { err: new AuthError(40103, '无令牌'), httpStatus: 401, code: 40103 },
      { err: new ForbiddenError('无权'), httpStatus: 403, code: 40301 },
      { err: new ConflictError('已存在'), httpStatus: 409, code: 40901 },
    ];
    for (const c of cases) {
      const { res, status, json } = buildRes();
      errorHandler.handle(c.err, {} as Request, res, vi.fn() as unknown as NextFunction);
      expect(status).toHaveBeenCalledWith(c.httpStatus);
      expect(json).toHaveBeenCalledWith({ code: c.code, message: c.err.message });
    }
  });

  // UT-029: 未知错误 → 50001
  it('UT-029: 未知错误映射为 500 + {code:50001, message:"内部错误"}', () => {
    const { res, status, json } = buildRes();
    const next = vi.fn() as unknown as NextFunction;

    errorHandler.handle(new Error('unknown'), {} as Request, res, next);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ code: 50001, message: '内部错误' });
  });

  it('UT-029-extra: 字符串错误也映射为 50001', () => {
    const { res, status, json } = buildRes();
    errorHandler.handle('string error', {} as Request, res, vi.fn() as unknown as NextFunction);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ code: 50001, message: '内部错误' });
  });
});
