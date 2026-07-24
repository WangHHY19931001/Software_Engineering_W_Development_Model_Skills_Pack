// 全局错误处理中间件
// 对应 detailed-design.md DD-ERROR-MW：捕获异常并按错误类型映射 HTTP 状态码与 code
import type { Request, Response, NextFunction } from 'express';
import { AppError, httpStatusForCode } from '../utils/errors';

export function handleError(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const httpStatus = httpStatusForCode(err.code);
    res.status(httpStatus).json({ code: err.code, message: err.message });
    return;
  }
  // 未知错误统一 500
  res.status(500).json({ code: 50001, message: '服务端内部错误' });
}

export const errorMiddleware = { handleError };
