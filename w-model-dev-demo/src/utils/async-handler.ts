import type { NextFunction, Request, Response, RequestHandler } from 'express';

/**
 * 包裹 async controller，让抛出的 rejection 进入 Express 错误处理中间件。
 * Express 4 不会自动捕获 async handler 的 rejected promise，必须显式包裹。
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
