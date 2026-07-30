/**
 * 验证中间件测试
 */
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams, IdParamSchema } from '../../src/middleware/validation.middleware.js';
import { AppError, ErrorCode } from '../../src/utils/errors.js';
import type { Request, Response, NextFunction } from 'express';

function mockReq(body: unknown = {}, query: unknown = {}, params: unknown = {}): Request {
  return { body, query, params } as unknown as Request;
}

describe('validateBody', () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().int().min(0) });

  it('should pass on valid body', () => {
    const mw = validateBody(schema);
    const next = vi.fn() as NextFunction;
    mw(mockReq({ name: 'a', age: 1 }), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should pass on empty body when schema allows', () => {
    const mw = validateBody(z.object({}).strict());
    const next = vi.fn() as NextFunction;
    mw(mockReq({}), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should call next with AppError on invalid body', () => {
    const mw = validateBody(schema);
    const next = vi.fn() as NextFunction;
    mw(mockReq({ name: '' }), {} as Response, next);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('should transform body', () => {
    const mw = validateBody(schema);
    const next = vi.fn() as NextFunction;
    const req = mockReq({ name: 'a', age: 1, extra: 'x' });
    mw(req, {} as Response, next);
    expect((req.body as Record<string, unknown>).extra).toBeUndefined();
  });

  it('should reject missing required field', () => {
    const mw = validateBody(schema);
    const next = vi.fn() as NextFunction;
    mw(mockReq({ name: 'a' }), {} as Response, next);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(err).toBeInstanceOf(AppError);
  });

  it('should include issues in error', () => {
    const mw = validateBody(schema);
    const next = vi.fn() as NextFunction;
    mw(mockReq({}), {} as Response, next);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]![0] as AppError;
    expect(err.details).toBeDefined();
  });
});

describe('validateQuery', () => {
  const schema = z.object({ page: z.coerce.number().int().min(1) });

  it('should pass on valid', () => {
    const mw = validateQuery(schema);
    const next = vi.fn() as NextFunction;
    mw(mockReq({}, { page: '2' }), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should fail on invalid', () => {
    const mw = validateQuery(schema);
    const next = vi.fn() as NextFunction;
    mw(mockReq({}, { page: '0' }), {} as Response, next);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).httpStatus).toBe(400);
  });
});

describe('validateParams', () => {
  it('should pass on valid', () => {
    const mw = validateParams(IdParamSchema);
    const next = vi.fn() as NextFunction;
    mw(mockReq({}, {}, { id: 'abc' }), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should fail on empty id', () => {
    const mw = validateParams(IdParamSchema);
    const next = vi.fn() as NextFunction;
    mw(mockReq({}, {}, { id: '' }), {} as Response, next);
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBeInstanceOf(AppError);
  });
});
