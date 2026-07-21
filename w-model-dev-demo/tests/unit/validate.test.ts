import { describe, it, expect, vi } from 'vitest';
import { validate } from '../../src/middleware/validate.js';
import { ArticleCreateSchema } from '../../src/schemas/article.schema.js';
import { BadRequestError } from '../../src/utils/errors.js';
import type { Request, Response, NextFunction } from 'express';

describe('UT-030: validate middleware', () => {
  it('UT-030: zod 校验失败 → next(BadRequestError(40001))', () => {
    const req = { body: {} } as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;
    const middleware = validate(ArticleCreateSchema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const calls = (next as ReturnType<typeof vi.fn>).mock.calls;
    const arg = calls[0][0];
    expect(arg).toBeInstanceOf(BadRequestError);
    expect((arg as BadRequestError).code).toBe(40001);
    expect((arg as BadRequestError).details).toBeTruthy();
  });

  it('补充: 校验通过 → next() 无参数 + req.body 被替换为强类型 DTO', () => {
    const req = { body: { title: 'T1', content: 'C1' } } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;
    const middleware = validate(ArticleCreateSchema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const calls = (next as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toBeUndefined();
    expect(req.body).toEqual({ title: 'T1', content: 'C1' });
  });
});
