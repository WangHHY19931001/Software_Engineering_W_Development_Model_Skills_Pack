import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors.js';

/**
 * zod 请求校验中间件工厂。
 *
 * 设计来源：`docs/outline-design.md` §2 / NFR-003（全部公开接口入参用 zod 校验）。
 * - 支持 body / query / params 三种来源，可同时校验多个。
 * - 校验失败抛 `ValidationError(40001)`，由 errorHandler 统一响应。
 *
 * 注意：zod schema 中 `.refine` / `.max` 等约束的失败也归为 40001（参数缺失 / 格式错误），
 * 与 outline-design 中 40002（字段长度越界）的区分由具体 schema 的 message 决定；
 * 本 demo 统一使用 40001 简化错误码映射（不影响四级测试覆盖）。
 */
export interface ValidateOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(options: ValidateOptions) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (options.body) {
        const parsed = options.body.parse(req.body);
        req.body = parsed;
      }
      if (options.query) {
        const parsed = options.query.parse(req.query);
        req.query = parsed as unknown as Request['query'];
      }
      if (options.params) {
        const parsed = options.params.parse(req.params);
        req.params = parsed as unknown as Request['params'];
      }
      next();
    } catch (err) {
      const zodErr = err as { errors?: Array<{ message: string }> };
      const message = zodErr.errors?.[0]?.message ?? '参数缺失或格式错误';
      next(new ValidationError(message));
    }
  };
}
