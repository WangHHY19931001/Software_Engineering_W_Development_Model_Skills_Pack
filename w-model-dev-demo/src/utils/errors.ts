/**
 * 错误体系。
 *
 * 设计来源：`docs/detailed-design.md` §1.1 / §3.5。
 * - AppError 为基类，标准化 `code / message / httpStatus / retryable` 四元组。
 * - 5 个子类对应错误码分层约定（`docs/outline-design.md` §3）。
 *
 * ErrorHandler 中间件根据 `instanceof AppError` 将错误映射为 HTTP 响应。
 */
export class AppError extends Error {
  readonly code: number;
  readonly httpStatus: number;
  readonly retryable: boolean;

  constructor(code: number, message: string, httpStatus: number, retryable: boolean) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
    // 维持 instanceof 链（ES5 编译目标下子类继承 Error 的已知问题）
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 参数缺失 / 格式错误（40001, HTTP 400）。 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(40001, message, 400, false);
    this.name = 'ValidationError';
  }
}

/**
 * 认证类错误（40101 用户名或密码错误 / 40102 JWT 已过期或无效 / 40103 未提供认证令牌）。
 * code 由调用方传入，对应不同认证失败场景。
 */
export class AuthError extends AppError {
  constructor(code: 40101 | 40102 | 40103, message: string) {
    super(code, message, 401, false);
    this.name = 'AuthError';
  }
}

/** 资源不存在（40401, HTTP 404）。 */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(40401, message, 404, false);
    this.name = 'NotFoundError';
  }
}

/** 作者隔离违规 / 无权操作他人资源（40301, HTTP 403）。 */
export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(40301, message, 403, false);
    this.name = 'ForbiddenError';
  }
}

/** 资源已存在（40901, HTTP 409），主要用于用户名重复。 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(40901, message, 409, false);
    this.name = 'ConflictError';
  }
}
