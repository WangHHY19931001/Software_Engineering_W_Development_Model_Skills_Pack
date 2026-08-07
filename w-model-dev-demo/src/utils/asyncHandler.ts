/**
 * async 路由处理器异常包装（DD-045）：Express 4 无法捕获 async 拒绝 → wrap 捕获并 next(err)。
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';

export function wrap(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
