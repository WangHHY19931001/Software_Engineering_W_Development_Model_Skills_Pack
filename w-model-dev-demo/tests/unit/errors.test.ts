import { describe, it, expect } from 'vitest';
import {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalServerError,
} from '../../src/utils/errors.js';

describe('errors.ts: HttpError 子类', () => {
  it('BadRequestError: status=400, code 透传', () => {
    const e = new BadRequestError(40001, 'bad');
    expect(e.status).toBe(400);
    expect(e.code).toBe(40001);
    expect(e.message).toBe('bad');
    expect(e.name).toBe('BadRequestError');
    expect(e instanceof HttpError).toBe(true);
    expect(e instanceof Error).toBe(true);
  });

  it('BadRequestError: details 透传', () => {
    const e = new BadRequestError(40001, 'bad', [{ path: 'username' }]);
    expect(e.details).toEqual([{ path: 'username' }]);
  });

  it('UnauthorizedError: status=401', () => {
    const e = new UnauthorizedError(40101, 'unauth');
    expect(e.status).toBe(401);
    expect(e.code).toBe(40101);
  });

  it('ForbiddenError: status=403', () => {
    const e = new ForbiddenError(40301, 'forbidden');
    expect(e.status).toBe(403);
  });

  it('NotFoundError: status=404', () => {
    const e = new NotFoundError(40401, 'not found');
    expect(e.status).toBe(404);
  });

  it('ConflictError: status=409', () => {
    const e = new ConflictError(40901, 'conflict');
    expect(e.status).toBe(409);
  });

  it('InternalServerError: status=500', () => {
    const e = new InternalServerError(50001, 'internal');
    expect(e.status).toBe(500);
  });
});
