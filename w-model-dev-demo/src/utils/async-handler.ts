import type { RequestHandler } from 'express';

/**
 * Async handler 包装器。
 *
 * 设计来源：`docs/detailed-design.md` §3.8 / RISK-002。
 * Express 4 不会自动捕获 async handler 抛出的 rejected promise，
 * 此包装器将 rejected promise 通过 `next(err)` 传递给 errorHandler 中间件。
 */
export class AsyncHandler {
  wrap(fn: RequestHandler): RequestHandler {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

/** 单例，便于 controllers 直接导入使用。 */
export const asyncHandler = new AsyncHandler();
