import { describe, it, expect, vi, type Mock } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { validate, type ValidateOptions } from '../../src/middleware/validate.js';
import { ValidationError } from '../../src/utils/errors.js';
import {
  AuthRegisterSchema,
  AuthLoginSchema,
} from '../../src/schemas/auth.schema.js';
import {
  ArticleCreateSchema,
  ArticleUpdateSchema,
  ArticleListQuerySchema,
} from '../../src/schemas/article.schema.js';
import { CommentCreateSchema } from '../../src/schemas/comment.schema.js';

/**
 * UT-031 ~ UT-040：validate 中间件单元测试。
 * 设计来源：docs/detailed-design.md §4.1 / NFR-003
 *
 * 直接调用 validate 中间件工厂（不使用 supertest），覆盖：
 * - body / query / params 三种来源的 happy / unhappy path
 * - 无 options（空对象）的 next() 直通分支
 * - 多源同时校验
 * - 错误消息 fallback（zodErr 无 .errors 数组时使用默认消息）
 * - 各路由 schema（auth/register, auth/login, articles 创建/更新, comments 创建, articles 列表查询）
 */
describe('validate middleware', () => {
  function buildReq(overrides: Partial<Request> = {}): Request {
    return {
      body: {},
      query: {},
      params: {},
      ...overrides,
    } as unknown as Request;
  }
  function buildRes(): Response {
    return {} as unknown as Response;
  }
  function buildNext(): Mock & NextFunction {
    return vi.fn() as unknown as Mock & NextFunction;
  }

  // UT-031: body 校验 happy path
  it('UT-031: 合法 body 通过校验，req.body 被 zod 解析结果替换，next() 无错误', () => {
    const req = buildReq({
      body: { username: 'alice', password: 'Passw0rd!' },
    });
    const next = buildNext();

    const mw = validate({ body: AuthRegisterSchema });
    mw(req, buildRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
    // zod 解析后 body 仍是同结构对象
    expect(req.body.username).toBe('alice');
    expect(req.body.password).toBe('Passw0rd!');
  });

  // UT-032: body 校验 unhappy path → next(ValidationError)
  it('UT-032: 非法 body 调 next(ValidationError)，错误消息取 zodErr.errors[0].message', () => {
    const req = buildReq({
      body: { username: 'ab', password: 'short' }, // 用户名过短 + 密码过短
    });
    const next = buildNext();

    const mw = validate({ body: AuthRegisterSchema });
    mw(req, buildRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).code).toBe(40001);
    expect((err as ValidationError).httpStatus).toBe(400);
    // zod 错误消息应为「用户名长度需为 3..32」（字段顺序优先）
    expect((err as ValidationError).message).toBe('用户名长度需为 3..32');
  });

  // UT-033: query 校验 happy path
  it('UT-033: 合法 query 通过校验，req.query 被 zod 解析结果替换', () => {
    const req = buildReq({
      query: { page: '1', pageSize: '10' },
    });
    const next = buildNext();

    const mw = validate({ query: ArticleListQuerySchema });
    mw(req, buildRes(), next);

    expect(next).toHaveBeenCalledWith();
    // ArticleListQuerySchema 有 .default，parse 后 page/pageSize 为 number
    expect(req.query.page).toBe(1);
    expect(req.query.pageSize).toBe(10);
  });

  // UT-034: query 校验 unhappy path → next(ValidationError)
  it('UT-034: 非法 query 调 next(ValidationError)', () => {
    const req = buildReq({
      query: { page: '0', pageSize: '10' }, // page < 1
    });
    const next = buildNext();

    const mw = validate({ query: ArticleListQuerySchema });
    mw(req, buildRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).code).toBe(40001);
    expect((err as ValidationError).message).toBe('page 至少为 1');
  });

  // UT-035: params 校验 happy path
  it('UT-035: 合法 params 通过校验', () => {
    const paramsSchema: ZodSchema = ArticleListQuerySchema; // 复用一个 schema 作 params 校验
    const req = buildReq({
      params: { page: '2', pageSize: '5' },
    });
    const next = buildNext();

    const mw = validate({ params: paramsSchema });
    mw(req, buildRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.params.page).toBe(2);
  });

  // UT-036: params 校验 unhappy path → next(ValidationError)
  it('UT-036: 非法 params 调 next(ValidationError)', () => {
    const paramsSchema: ZodSchema = ArticleListQuerySchema;
    const req = buildReq({
      params: { page: '0', pageSize: '5' }, // page < 1
    });
    const next = buildNext();

    const mw = validate({ params: paramsSchema });
    mw(req, buildRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toBe('page 至少为 1');
  });

  // UT-037: 无 options（空对象）→ 三个 if 均不进入，直接 next()
  it('UT-037: validate({}) 不校验任何来源，直接 next() 无错误', () => {
    const req = buildReq();
    const next = buildNext();

    const mw = validate({} as ValidateOptions);
    mw(req, buildRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  // UT-038: 多源同时校验（body + query + params 均合法）
  it('UT-038: body + query + params 同时校验，三者均合法时 next() 无错误', () => {
    const req = buildReq({
      body: { username: 'alice', password: 'Passw0rd!' },
      query: { page: '1', pageSize: '10' },
      params: { page: '2', pageSize: '5' },
    });
    const next = buildNext();

    const mw = validate({
      body: AuthRegisterSchema,
      query: ArticleListQuerySchema,
      params: ArticleListQuerySchema,
    });
    mw(req, buildRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.username).toBe('alice');
    expect(req.query.page).toBe(1);
    expect(req.params.page).toBe(2);
  });

  // UT-039: 错误消息 fallback - zodErr 无 .errors 数组时使用默认消息
  it('UT-039: 非 zod 异常（无 .errors 数组）时错误消息回退为 "参数缺失或格式错误"', () => {
    // 构造一个会抛出普通 Error（无 .errors 属性）的伪 schema
    const fakeSchema = {
      parse: () => {
        throw new Error('plain non-zod error');
      },
    } as unknown as ZodSchema;

    const req = buildReq({ body: {} });
    const next = buildNext();

    const mw = validate({ body: fakeSchema });
    mw(req, buildRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toBe('参数缺失或格式错误');
  });

  // UT-040: 多源同时校验 - body 失败时 query/params 不再校验
  it('UT-040: body 校验失败时，query / params 不再校验（短路）', () => {
    const req = buildReq({
      body: { username: 'x', password: 'x' }, // 非法
      query: { page: '0', pageSize: '10' }, // 也非法，但不应被校验
      params: { page: '0', pageSize: '10' },
    });
    const next = buildNext();

    const mw = validate({
      body: AuthRegisterSchema,
      query: ArticleListQuerySchema,
      params: ArticleListQuerySchema,
    });
    mw(req, buildRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ValidationError);
    // 错误来自 body（用户名过短），而非 query
    expect((err as ValidationError).message).toBe('用户名长度需为 3..32');
  });

  // UT-041: 各路由 schema 合法输入表驱动测试（覆盖所有被 validate 包裹的路由）
  it('UT-041: 各路由 schema 合法输入均通过 validate（表驱动）', () => {
    const cases: Array<{
      name: string;
      options: ValidateOptions;
      req: Partial<Request>;
    }> = [
      {
        name: 'auth/register body',
        options: { body: AuthRegisterSchema },
        req: { body: { username: 'alice', password: 'Passw0rd!' } },
      },
      {
        name: 'auth/login body',
        options: { body: AuthLoginSchema },
        req: { body: { username: 'alice', password: 'Passw0rd!' } },
      },
      {
        name: 'articles create body',
        options: { body: ArticleCreateSchema },
        req: { body: { title: 't1', content: 'c1', tags: ['a'] } },
      },
      {
        name: 'articles update body (partial)',
        options: { body: ArticleUpdateSchema },
        req: { body: { title: 't2' } },
      },
      {
        name: 'articles list query',
        options: { query: ArticleListQuerySchema },
        req: { query: { page: '1', pageSize: '10' } },
      },
      {
        name: 'comments create body',
        options: { body: CommentCreateSchema },
        req: { body: { content: 'hello' } },
      },
    ];

    for (const c of cases) {
      const req = buildReq(c.req);
      const next = buildNext();
      const mw = validate(c.options);
      mw(req, buildRes(), next);
      expect(next).toHaveBeenCalledWith();
      expect(next).toHaveBeenCalledTimes(1);
    }
  });

  // UT-042: ArticleUpdateSchema refine 失败 - 空对象 → "至少需要更新 1 个字段"
  it('UT-042: ArticleUpdateSchema 空对象触发 refine 失败，错误消息为 "至少需要更新 1 个字段"', () => {
    const req = buildReq({ body: {} });
    const next = buildNext();

    const mw = validate({ body: ArticleUpdateSchema });
    mw(req, buildRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toBe('至少需要更新 1 个字段');
  });

  // UT-043: tags 数组越界（>10）→ ValidationError
  it('UT-043: tags 数量超过 10 触发 ArticleCreateSchema 校验失败', () => {
    const req = buildReq({
      body: {
        title: 't1',
        content: 'c1',
        tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
      },
    });
    const next = buildNext();

    const mw = validate({ body: ArticleCreateSchema });
    mw(req, buildRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).message).toBe('标签数量不能超过 10');
  });
});
