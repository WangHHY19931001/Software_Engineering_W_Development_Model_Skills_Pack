// Error codes + AppError class + Express error handler.

export enum ErrorCode {
  ZodValidation = 1001,
  StateMachineIllegal = 1002,
  SelfReference = 1003,
  DepthLimit = 1004,
  BusinessConflict = 1005,
  NoUser = 1011,
  WrongPassword = 1012,
  ExpiredToken = 1013,
  Rbac = 1021,
  Banned = 1022,
  Maintenance = 1023,
  CommentClosed = 1025,
  NotFound = 1031,
  FileTooLarge = 1041,
}

export const ERROR_HTTP_STATUS: Record<number, number> = {
  [ErrorCode.ZodValidation]: 400,
  [ErrorCode.StateMachineIllegal]: 409,
  [ErrorCode.SelfReference]: 400,
  [ErrorCode.DepthLimit]: 400,
  [ErrorCode.BusinessConflict]: 409,
  [ErrorCode.NoUser]: 401,
  [ErrorCode.WrongPassword]: 401,
  [ErrorCode.ExpiredToken]: 401,
  [ErrorCode.Rbac]: 403,
  [ErrorCode.Banned]: 403,
  [ErrorCode.Maintenance]: 503,
  [ErrorCode.CommentClosed]: 403,
  [ErrorCode.NotFound]: 404,
  [ErrorCode.FileTooLarge]: 413,
};

export class AppError extends Error {
  readonly code: number;
  readonly httpStatus: number;

  constructor(code: number, message?: string) {
    super(message ?? String(code));
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = ERROR_HTTP_STATUS[code] ?? 500;
  }

  toJSON(): { code: number; message: string; httpStatus: number } {
    return {
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
    };
  }
}

/** Throw helper for store/service layers (throws new AppError). */
export function throwAppError(code: number, message?: string): never {
  throw new AppError(code, message ?? String(code));
}

/** Express error-handling middleware. */
export function errorHandler(err: unknown, _req: unknown, res: {
  status(code: number): { json(body: unknown): void };
  json(body: unknown): void;
}, _next: unknown): void {
  if (err instanceof AppError) {
    res.status(err.httpStatus).json(err.toJSON());
    return;
  }
  if (err instanceof Error) {
    res.status(500).json({ code: 500, message: err.message, httpStatus: 500 });
    return;
  }
  res.status(500).json({ code: 500, message: 'Unknown error', httpStatus: 500 });
}

/** Whether an error is an AppError with a specific code (test helper). */
export function hasErrorCode(err: unknown, code: number): boolean {
  return err instanceof AppError && err.code === code;
}
