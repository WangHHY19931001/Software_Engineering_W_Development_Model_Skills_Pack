export abstract class HttpError extends Error {
  abstract readonly status: number;
  constructor(
    public readonly code: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class BadRequestError extends HttpError {
  readonly status = 400;
}

export class UnauthorizedError extends HttpError {
  readonly status = 401;
}

export class ForbiddenError extends HttpError {
  readonly status = 403;
}

export class NotFoundError extends HttpError {
  readonly status = 404;
}

export class ConflictError extends HttpError {
  readonly status = 409;
}

export class InternalServerError extends HttpError {
  readonly status = 500;
}
