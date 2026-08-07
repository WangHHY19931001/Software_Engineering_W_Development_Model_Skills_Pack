/**
 * UT-044 未映射异常统一 50001 通用文案（errorMiddleware.errorHandler，DD-044/CON-002）
 */
import { describe, it, expect, vi } from 'vitest';
import { ErrorMiddleware, notFoundHandler } from '../../../src/middlewares/errorMiddleware';
import { BizError } from '../../../src/utils/errors';
import { makeReq, makeRes, makeNext } from '../helpers';

describe('UT-044 errorMiddleware.errorHandler', () => {
  it('未知异常 → 500 + {error:{code:50001}}，响应体不含堆栈/内部类名', () => {
    const middleware = new ErrorMiddleware();
    const res = makeRes();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    middleware.errorHandler(new Error('internal: src/services/x.ts:12'), makeReq(), res, makeNext());

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body).toEqual({ error: { code: 50001, message: '服务端内部错误' } });
    expect(JSON.stringify(body)).not.toContain('src/');
    expect(JSON.stringify(body)).not.toContain('Error');
    consoleSpy.mockRestore();
  });

  it('BizError 按错误码目录映射 httpStatus 与统一结构', () => {
    const middleware = new ErrorMiddleware();
    const res = makeRes();
    middleware.errorHandler(new BizError(40401), makeReq(), res, makeNext());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 40401, message: '资源不存在' } });
  });

  it('body 解析失败 → 40003', () => {
    const middleware = new ErrorMiddleware();
    const res = makeRes();
    const err: any = new SyntaxError('Unexpected token');
    err.type = 'entity.parse.failed';
    middleware.errorHandler(err, makeReq(), res, makeNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 40003, message: '请求体 JSON 解析失败' } });
  });
});

describe('notFoundHandler', () => {
  it('兜底 404 统一结构（CON-002）', () => {
    const res = makeRes();
    notFoundHandler(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].error.code).toBe(40401);
  });
});
