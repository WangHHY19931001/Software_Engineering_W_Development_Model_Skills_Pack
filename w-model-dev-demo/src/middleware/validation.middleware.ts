/**
 * Validation 中间件 - Zod 校验
 */
import type { Request, Response, NextFunction } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { AppError, ErrorCode } from '../utils/errors.js';

export function validateBody<T extends ZodTypeAny>(schema: T) {
  return function (req: Request, _res: Response, next: NextFunction): void {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(
        new AppError(
          ErrorCode.VALIDATION_FAILED,
          'Request body validation failed',
          400,
          { issues: result.error.issues },
        ),
      );
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T extends ZodTypeAny>(schema: T) {
  return function (req: Request, _res: Response, next: NextFunction): void {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(
        new AppError(
          ErrorCode.VALIDATION_FAILED,
          'Request query validation failed',
          400,
          { issues: result.error.issues },
        ),
      );
    }
    (req as Request & { validatedQuery?: unknown }).validatedQuery = result.data;
    next();
  };
}

export function validateParams<T extends ZodTypeAny>(schema: T) {
  return function (req: Request, _res: Response, next: NextFunction): void {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return next(
        new AppError(
          ErrorCode.VALIDATION_FAILED,
          'Request params validation failed',
          400,
          { issues: result.error.issues },
        ),
      );
    }
    req.params = result.data as typeof req.params;
    next();
  };
}

export const IdParamSchema = z.object({ id: z.string().min(1) });
