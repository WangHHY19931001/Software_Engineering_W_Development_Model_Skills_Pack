/**
 * 统一错误类
 */
import { ErrorCode, type AppErrorData } from '../types/index.js';

// 重新导出 ErrorCode 作为值
export { ErrorCode };

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    httpStatus: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }

  toJSON(): AppErrorData {
    return {
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      details: this.details,
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_FAILED, message, 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthError extends AppError {
  constructor(message: string = 'Authentication failed', code: ErrorCode = ErrorCode.AUTH_FAILED) {
    super(code, message, 401);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(ErrorCode.FORBIDDEN, message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(ErrorCode.NOT_FOUND, `${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.CONFLICT, message, 409, details);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(ErrorCode.RATE_LIMITED, message, 429);
    this.name = 'RateLimitError';
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function createAppError(
  code: ErrorCode,
  message: string,
  httpStatus: number,
  details?: Record<string, unknown>,
): AppError {
  return new AppError(code, message, httpStatus, details);
}

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new AppError(ErrorCode.INTERNAL, `Invariant failed: ${message}`, 500);
  }
}
