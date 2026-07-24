/**
 * DD-027 ErrorHandler —— Express 错误处理中间件
 *
 * 统一错误响应格式；错误码三段位映射 HTTP Status。
 * 三段位：4xx(40000-49999) / 5xx(50000-59999) / 业务(60000-69999)
 */
import type { Request, Response, NextFunction } from 'express';
import { AppError, mapHttpStatus, type ErrorResponse } from '../utils/errors.js';

/** 生成 requestId（简化版，单测中可 mock） */
function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 格式化错误响应（对应 DD-027 formatResponse） */
export function formatResponse(err: unknown): ErrorResponse {
  if (err instanceof AppError) {
    return {
      code: err.code,
      message: err.message,
      detail: err.detail,
      requestId: generateRequestId(),
    };
  }
  if (err instanceof Error) {
    return {
      code: 50000,
      message: err.message || '内部服务器错误',
      requestId: generateRequestId(),
    };
  }
  return {
    code: 50000,
    message: '未知错误',
    requestId: generateRequestId(),
  };
}

/**
 * Express 错误处理中间件（对应 DD-027 handle）。
 * 用法：app.use(ErrorHandler.handle)
 */
export function handle(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const response = formatResponse(err);
  const httpStatus = mapHttpStatus(response.code);
  res.status(httpStatus).json(response);
}

/** ErrorHandler 门面对象（对应 DD-027 类图） */
export const ErrorHandler = {
  handle,
  formatResponse,
};
