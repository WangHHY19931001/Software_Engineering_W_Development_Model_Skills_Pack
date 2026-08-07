/**
 * 控制器/中间件统一错误响应工具（CON-002）：
 * 控制器直调（单元测试 seam）时由控制器捕获 BizError 自行响应；未知错误转交 next(err)（errorMiddleware 兜底）。
 */
import type { Response, NextFunction } from 'express';
import { BizError, isBizError } from './errors';

export function sendError(res: Response, next: NextFunction | undefined, err: unknown): void {
  if (isBizError(err)) {
    res.status(err.httpStatus).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (next) {
    next(err);
    return;
  }
  // 无 next（单元测试直调）时兜底 50001 通用文案，禁止 unwrapped 堆栈直出
  res.status(500).json({ error: { code: 50001, message: '服务端内部错误' } });
}

export function isBizErrorValue(err: unknown): err is BizError {
  return err instanceof BizError;
}
