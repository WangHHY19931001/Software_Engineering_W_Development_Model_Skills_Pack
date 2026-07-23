/**
 * ValidateRequest 单元测试（UT-048）。
 * 合法 body 替换为 DTO / 非法抛 40001 + zod details。
 */
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../../src/middleware/validate';
import { BadRequestError, ErrorCode } from '../../../src/utils/errors';

type MockNext = ReturnType<typeof vi.fn>;

const schema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
});

function makeReqResNext(body: unknown) {
  const req = { body } as unknown as Request;
  const res = {} as Response;
  const next: MockNext = vi.fn();
  return { req, res, next };
}

describe('ValidateRequest', () => {
  it('UT-048 合法 body 替换为 DTO / 非法抛 40001 + details', () => {
    // 合法
    const ctx1 = makeReqResNext({ username: 'alice', password: 'Passw0rd!' });
    const mw1 = validateRequest({ body: schema });
    mw1(ctx1.req, ctx1.res, ctx1.next as unknown as NextFunction);
    expect(ctx1.req.body).toEqual({ username: 'alice', password: 'Passw0rd!' });
    expect(ctx1.next).toHaveBeenCalledWith();

    // 非法（缺字段 + 类型不符）
    const ctx2 = makeReqResNext({ username: 'a' });
    const mw2 = validateRequest({ body: schema });
    mw2(ctx2.req, ctx2.res, ctx2.next as unknown as NextFunction);
    expect(ctx2.next).toHaveBeenCalled();
    const err = ctx2.next.mock.calls[0][0] as BadRequestError;
    expect(err).toBeInstanceOf(BadRequestError);
    expect(err.code).toBe(ErrorCode.BAD_REQUEST);
    expect(err.details).toBeDefined();
    expect(Array.isArray(err.details)).toBe(true);
  });
});
