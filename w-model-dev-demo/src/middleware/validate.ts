/**
 * ValidateRequest：zod schema 请求校验中间件工厂（realizes INTF-007 / DD-010）。
 * 校验 req.body / req.query / req.params，失败抛 40001 + zod details。
 */
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { BadRequestError, ErrorCode } from '../utils/errors';

export interface SchemaOptions {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
}

export function validateRequest(schemas: SchemaOptions): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as typeof req.query;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      next();
    } catch (e) {
      const details = (e as z.ZodError).issues;
      next(new BadRequestError(ErrorCode.BAD_REQUEST, '参数校验失败', details));
    }
  };
}
