// 异步控制器包装器：捕获 Promise 拒绝并传递给错误中间件
// 对应 detailed-design.md DD-ASYNC-UTIL：Express 4 不自动捕获 rejected promise，
// 须用 wrap 包装 async 控制器，异常自动传递到错误中间件
import type { RequestHandler, Request, Response, NextFunction } from 'express';

export function wrap(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export const asyncHandler = { wrap };
