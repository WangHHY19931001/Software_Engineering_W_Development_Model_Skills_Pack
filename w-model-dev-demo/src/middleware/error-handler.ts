/**
 * ErrorHandler：Express 四参数错误中间件（realizes INTF-008 / DD-011）。
 * AppError 按 httpStatus+code 序列化；非 AppError 兜底 50001；不泄露堆栈。
 */
import type { ErrorRequestHandler } from 'express';
import { AppError, ErrorCode } from '../utils/errors';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    const body: Record<string, unknown> = { code: err.code, message: err.message };
    if (err.details !== undefined) {
      body.details = err.details;
    }
    res.status(err.httpStatus).json(body);
    return;
  }
  res.status(500).json({ code: ErrorCode.INTERNAL, message: '服务器内部错误' });
};
