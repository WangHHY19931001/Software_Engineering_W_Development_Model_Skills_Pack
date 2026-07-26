/**
 * 错误类层次 + 错误处理中间件（DD-COMMON-001 统一错误响应 / NFR-003）。
 */
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = 'APP_ERROR',
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = '未认证') {
    super(401, message, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = '无权限') {
    super(403, message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = '资源') {
    super(404, `${resource}不存在`, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT_ERROR');
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = '请求过于频繁') {
    super(429, message, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export interface ErrorResponsePayload {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const message = err.errors[0]?.message ?? '参数验证失败';
    const payload: ErrorResponsePayload = {
      error: {
        code: 'VALIDATION_ERROR',
        message,
        details: { issues: err.errors },
      },
    };
    res.status(400).json(payload);
    return;
  }
  if (err instanceof AppError) {
    const payload: ErrorResponsePayload = {
      error: {
        code: err.code,
        message: err.message,
      },
    };
    if (err.details !== undefined) {
      payload.error.details = err.details;
    }
    res.status(err.statusCode).json(payload);
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
    });
    return;
  }
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: '未知错误' },
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND_ERROR', message: '路由不存在' },
  });
}
