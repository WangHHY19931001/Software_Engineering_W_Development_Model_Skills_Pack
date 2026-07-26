import { describe, it, expect } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  errorHandler,
  notFoundHandler,
} from '../../../src/utils/errors.js';

describe('errors / errorHandler (DD-COMMON-001)', () => {
  it('TC-UNIT-073N: AppError 子类携带正确 statusCode/code', () => {
    const cases = [
      [new ValidationError('bad'), 400, 'VALIDATION_ERROR'],
      [new AuthenticationError(), 401, 'AUTHENTICATION_ERROR'],
      [new AuthorizationError(), 403, 'AUTHORIZATION_ERROR'],
      [new NotFoundError('文章'), 404, 'NOT_FOUND_ERROR'],
      [new ConflictError('重复'), 409, 'CONFLICT_ERROR'],
      [new RateLimitError(), 429, 'RATE_LIMIT_ERROR'],
    ] as const;
    for (const [err, code, name] of cases) {
      expect(err.statusCode).toBe(code);
      expect(err.code).toBe(name);
    }
  });

  it('TC-UNIT-073E: errorHandler 处理非 AppError 异常返回 500', () => {
    const res = {
      status: () => res,
      json: () => res,
    } as unknown as Response;
    let capturedStatus = 0;
    let capturedBody: unknown = null;
    Object.assign(res, {
      status: (s: number) => { capturedStatus = s; return res; },
      json: (b: unknown) => { capturedBody = b; return res; },
    });
    errorHandler(new Error('boom'), {} as Request, res, (() => undefined) as NextFunction);
    expect(capturedStatus).toBe(500);
    expect((capturedBody as { error: { code: string } }).error.code).toBe('INTERNAL_ERROR');
  });

  it('TC-UNIT-073B: errorHandler 包含 details 字段当 AppError.details 存在', () => {
    const res = {} as unknown as Response;
    let capturedStatus = 0;
    let capturedBody: unknown = null;
    Object.assign(res, {
      status: (s: number) => { capturedStatus = s; return res; },
      json: (b: unknown) => { capturedBody = b; return res; },
    });
    errorHandler(
      new ValidationError('字段错误', { field: 'email' }),
      {} as Request,
      res,
      (() => undefined) as NextFunction,
    );
    expect(capturedStatus).toBe(400);
    expect((capturedBody as { error: { details: { field: string } } }).error.details.field).toBe('email');
  });

  it('TC-UNIT-074N: notFoundHandler 返回 404 + NOT_FOUND_ERROR', () => {
    const res = {} as unknown as Response;
    let capturedStatus = 0;
    let capturedBody: unknown = null;
    Object.assign(res, {
      status: (s: number) => { capturedStatus = s; return res; },
      json: (b: unknown) => { capturedBody = b; return res; },
    });
    notFoundHandler({} as Request, res);
    expect(capturedStatus).toBe(404);
    expect((capturedBody as { error: { code: string } }).error.code).toBe('NOT_FOUND_ERROR');
  });

  it('TC-UNIT-074E: 未知非 Error 值仍返回 500', () => {
    const res = {} as unknown as Response;
    let capturedStatus = 0;
    Object.assign(res, {
      status: (s: number) => { capturedStatus = s; return res; },
      json: () => res,
    });
    errorHandler('weird', {} as Request, res, (() => undefined) as NextFunction);
    expect(capturedStatus).toBe(500);
  });

  it('TC-UNIT-074B: AppError name 属性正确', () => {
    expect(new ValidationError('x').name).toBe('ValidationError');
    expect(new NotFoundError().name).toBe('NotFoundError');
  });
});
