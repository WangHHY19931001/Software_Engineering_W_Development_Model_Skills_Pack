/**
 * AppError 类层级与错误码常量（对应 detailed-design.md §5）。
 */

export const ErrorCode = {
  BAD_REQUEST: 40001,
  UNAUTHORIZED_CREDENTIALS: 40101,
  UNAUTHORIZED_TOKEN: 40102,
  UNAUTHORIZED_MISSING_TOKEN: 40103,
  FORBIDDEN: 40301,
  NOT_FOUND: 40401,
  CONFLICT: 40901,
  INTERNAL: 50001,
} as const;

export abstract class AppError extends Error {
  abstract httpStatus: number;
  constructor(
    public readonly code: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  httpStatus = 400;
}

export class UnauthorizedError extends AppError {
  httpStatus = 401;
}

export class ForbiddenError extends AppError {
  httpStatus = 403;
}

export class NotFoundError extends AppError {
  httpStatus = 404;
}

export class ConflictError extends AppError {
  httpStatus = 409;
}

export class InternalError extends AppError {
  httpStatus = 500;
}
