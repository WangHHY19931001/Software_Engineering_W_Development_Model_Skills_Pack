import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';

/**
 * 统一错误响应中间件。
 *
 * 设计来源：`docs/detailed-design.md` §3.5 / NFR-003。
 * - `AppError` 子类映射为 `{ code, message }` + 对应 HTTP status。
 * - 未知错误映射为 `{ code: 50001, message: "内部错误" }` + HTTP 500。
 * - 明文密码不入日志（NFR-001）：错误信息中不含任何 password 字段。
 *
 * 必须 4 个参数（err, req, res, next）才会被 Express 识别为错误处理中间件。
 */
export class ErrorHandler {
  handle(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof AppError) {
      res.status(err.httpStatus).json({ code: err.code, message: err.message });
      return;
    }
    // 未知错误：避免泄露内部堆栈
    res.status(500).json({ code: 50001, message: '内部错误' });
  }
}
