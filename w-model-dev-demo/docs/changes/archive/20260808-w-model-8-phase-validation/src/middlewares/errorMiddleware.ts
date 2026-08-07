/**
 * errorMiddleware（DD-044 / SD-007 / CON-002）：统一错误响应 { error: { code, message } }。
 * 业务错误码目录映射（40001~60003）；body 解析失败 → 40003；未映射异常 → 50001 通用文案
 * （禁止 unwrapped 堆栈/内部类名直出）。
 */
import type { Request, Response, NextFunction } from 'express';
import { isBizError, ERROR_CATALOG } from '../utils/errors';

interface BodyParseError extends Error {
  type?: string;
  status?: number;
}

export class ErrorMiddleware {
  errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
    if (isBizError(err)) {
      res.status(err.httpStatus).json({ error: { code: err.code, message: err.message } });
      return;
    }
    // express.json 解析失败（Content-Type 非 JSON / body 语法错误）→ 40003
    const parseError = err as BodyParseError;
    if (parseError && (parseError.type === 'entity.parse.failed' || parseError instanceof SyntaxError && parseError.status === 400)) {
      const meta = ERROR_CATALOG[40003];
      res.status(meta.httpStatus).json({ error: { code: 40003, message: meta.message } });
      return;
    }
    // 未映射异常：服务端日志记录，响应仅通用文案（不暴露堆栈/内部类名）
    console.error('[errorMiddleware] unhandled error', err);
    const meta = ERROR_CATALOG[50001];
    res.status(meta.httpStatus).json({ error: { code: 50001, message: meta.message } });
  }

  /** TLA+ L2_BlogSystemInfrastructure "ClearError" 动作对应：清除错误状态（错误即每请求响应，无共享错误状态需清除） */
  clearError(): void {
    // 无共享错误状态：错误处理为请求级即时响应，无需跨请求清理
  }
}

/** 兜底 404（路由注册顺序 29：在全部具体路径之后） */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: { code: 40401, message: '资源不存在' } });
}
