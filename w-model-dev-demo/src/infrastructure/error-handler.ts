/**
 * 错误处理中间件 - 统一错误响应
 */
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { ErrorCode } from '../types/index.js';

export class ErrorHandler {
  static handle(err: unknown, req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof ZodError) {
      res.status(400).json({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'Zod validation failed',
        httpStatus: 400,
        details: { issues: err.issues },
      });
      return;
    }
    if (err instanceof AppError) {
      res.status(err.httpStatus).json(err.toJSON());
      return;
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({
      code: ErrorCode.INTERNAL,
      message,
      httpStatus: 500,
    });
  }

  static wrap<T>(fn: T) {
    return function (req: Request, res: Response, next: NextFunction): void {
      try {
        Promise.resolve((fn as unknown as (req: Request, res: Response, next: NextFunction) => unknown)(req, res, next)).catch(next);
      } catch (e) {
        next(e);
      }
    };
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    code: ErrorCode.NOT_FOUND,
    message: `Route ${req.method} ${req.path} not found`,
    httpStatus: 404,
  });
}
