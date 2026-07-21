import { type Request, type Response, type NextFunction } from 'express';
import { HttpError } from '../utils/errors.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      code: err.code,
      message: err.message,
      details: err.details,
    });
    return;
  }
  console.error('未捕获异常:', err);
  res.status(500).json({ code: 50001, message: '内部服务器错误' });
}
