import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { ZodError, z } from 'zod';
import { errorHandler } from '../../src/middleware/error-handler.js';
import {
  AppError,
  ForbiddenError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../../src/utils/errors.js';

function runErrorHandler(err: unknown): { status: number; body: unknown } {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as Response;
  errorHandler(err, {} as Request, res, vi.fn());
  expect(res.status).toHaveBeenCalledTimes(1);
  const status = (res.status as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as number;
  const jsonBody = (res.json as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
  const sendBody = (res.send as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
  return { status, body: jsonBody ?? sendBody };
}

describe('errorHandler', () => {
  it('UT-020: AppError 转换为对应状态码', () => {
    const cases: Array<{ err: AppError; expectedStatus: number; expectedMessage: string }> = [
      { err: new ValidationError('bad input'), expectedStatus: 400, expectedMessage: 'bad input' },
      { err: new UnauthorizedError(), expectedStatus: 401, expectedMessage: 'Unauthorized' },
      { err: new ForbiddenError(), expectedStatus: 403, expectedMessage: 'Forbidden' },
      { err: new NotFoundError(), expectedStatus: 404, expectedMessage: 'Not Found' },
      { err: new ConflictError('dup'), expectedStatus: 409, expectedMessage: 'dup' },
    ];
    for (const c of cases) {
      const { status, body } = runErrorHandler(c.err);
      expect(status).toBe(c.expectedStatus);
      expect((body as { error: string }).error).toBe(c.expectedMessage);
    }
  });

  it('UT-021: ZodError 转换为 400', () => {
    const schema = z.object({ name: z.string().min(3) });
    let zodErr: ZodError | null = null;
    try {
      schema.parse({ name: 'a' });
    } catch (e) {
      zodErr = e as ZodError;
    }
    expect(zodErr).not.toBeNull();
    const { status, body } = runErrorHandler(zodErr!);
    expect(status).toBe(400);
    expect((body as { error: string }).error).toContain('name');
  });

  it('UT-022: 未知错误转换为 500', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { status, body } = runErrorHandler(new Error('boom'));
    expect(status).toBe(500);
    expect((body as { error: string }).error).toBe('Internal Server Error');
    errSpy.mockRestore();
  });
});
