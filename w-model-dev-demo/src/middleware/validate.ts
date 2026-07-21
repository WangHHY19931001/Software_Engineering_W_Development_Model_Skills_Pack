import { type Request, type Response, type NextFunction } from 'express';
import { type ZodSchema } from 'zod';
import { BadRequestError } from '../utils/errors.js';

export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new BadRequestError(40001, '请求参数校验失败', result.error.issues));
    }
    req.body = result.data;
    next();
  };
}
