/**
 * DD-028 ValidateMiddleware —— zod 输入校验 + 防原型链污染
 *
 * 中间件工厂：validate(schema, source) 返回 Express 中间件。
 * sanitize 递归移除 __proto__/constructor/prototype 键（NFR-003）。
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from './errors.js';

/** 危险键清单（原型链污染防护，NFR-003） */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * 递归消毒输入：移除 __proto__/constructor/prototype 键（NFR-003）。
 * 对应 DD-028 sanitize 算法伪代码。
 */
export function sanitize<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }
  if (typeof input !== 'object') {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map(sanitize) as unknown as T;
  }
  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(input as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(key)) {
      continue;
    }
    const value = (input as Record<string, unknown>)[key];
    cleaned[key] = sanitize(value);
  }
  return cleaned as T;
}

/**
 * 校验中间件工厂（对应 DD-028 validate 方法）。
 * @param schema zod schema
 * @param source 校验来源 'body' | 'query' | 'params'
 * @returns Express RequestHandler
 */
export function validate(
  schema: ZodSchema,
  source: 'body' | 'query' | 'params' = 'body',
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const raw = req[source];
    const cleaned = sanitize(raw);
    const result = schema.safeParse(cleaned);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new AppError(40003, '输入校验失败', { issues, source });
    }
    // 替换 req[source] 为校验后的数据
    (req as unknown as Record<string, unknown>)[source] = result.data;
    next();
  };
}

/** ValidateMiddleware 门面对象（对应 DD-028 类图） */
export const ValidateMiddleware = {
  validate,
  sanitize,
};
