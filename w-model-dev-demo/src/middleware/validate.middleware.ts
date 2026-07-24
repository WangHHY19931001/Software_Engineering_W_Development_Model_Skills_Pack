// zod 校验中间件工厂
// 对应 detailed-design.md DD-VALIDATE-MW：validate(schema) 返回中间件，用 schema.parse 校验 req.body
import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from '../utils/errors';

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      // zod 校验失败 → 40001 参数缺失/格式非法
      const message = result.error.issues.map(i => i.message).join('; ');
      next(new AppError(40001, message || '参数缺失/格式非法'));
      return;
    }
    // 替换 req.body 为解析后的安全数据
    req.body = result.data;
    next();
  };
}

export const validateMiddleware = { validate };
