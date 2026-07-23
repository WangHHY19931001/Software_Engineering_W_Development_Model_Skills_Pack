/**
 * asyncHandler：包装 controller，捕获 Promise rejection 转发 errorHandler
 * （realizes INTF-009 / DD-012）。Express 4 不自动捕获 rejected promise，必须包装。
 * 参数声明为 RequestHandler 以兼容 controller 方法（async 实现但按 Express 约定声明为 RequestHandler）；
 * 运行时 async 函数返回 Promise，Promise.resolve 会正确归一化并捕获 rejection。
 */
import type { RequestHandler } from 'express';

export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
