/**
 * zod schema 校验与统一错误码映射（DD-047 / CON-002）：
 * 缺失/类型不符/格式非法 → 40001；取值越界（分页/长度/枚举）→ 40002；JSON 解析失败 → 40003。
 */
import { z, type ZodType, type ZodError } from 'zod';
import { BizError } from './errors';

/** 取值越界类 zod issue code（长度/枚举/数量）→ 40002 */
const RANGE_CODES = new Set(['too_small', 'too_big', 'invalid_enum_value']);

/** 其余（类型/格式/缺失）→ 40001 */
export function mapError(error: ZodError): BizError {
  const code = error.issues[0]?.code;
  if (code && RANGE_CODES.has(code)) {
    return new BizError(40002);
  }
  return new BizError(40001);
}

export function parse<T>(schema: ZodType<T>, input: unknown): { success: true; data: T } {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw mapError(result.error);
  }
  return { success: true, data: result.data };
}

/** 分页参数解析（INTF §0.2）：page ≥ 1、1 ≤ pageSize ≤ 50，越界 40002（ID-7 默认 page=1/pageSize=20） */
export function parsePage(pageRaw: unknown, pageSizeRaw: unknown): { page: number; pageSize: number } {
  const page = pageRaw === undefined || pageRaw === null ? 1 : Number(pageRaw);
  const pageSize = pageSizeRaw === undefined || pageSizeRaw === null ? 20 : Number(pageSizeRaw);
  if (!Number.isInteger(page) || page < 1) {
    throw new BizError(40002, '分页参数 page 越界');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw new BizError(40002, '分页参数 pageSize 越界');
  }
  return { page, pageSize };
}

/** limit 参数解析（INTF-015/016）：默认 10、1 ≤ limit ≤ 50，越界 40002 */
export function parseLimit(raw: unknown): number {
  const limit = raw === undefined || raw === null ? 10 : Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new BizError(40002, 'limit 参数越界');
  }
  return limit;
}

/* ============ 公共 zod schema（INTF 参数约束） ============ */

export const usernameSchema = z.string().min(3).max(32).regex(/^[A-Za-z0-9_]+$/);

export const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().email(),
  password: z.string().min(8).max(64),
});

export const loginSchema = z.object({
  identifier: z.string().min(3).max(64),
  password: z.string().min(8).max(64),
});

export const profilePatchSchema = z.object({
  nickname: z.string().min(1).max(32).optional(),
  bio: z.string().max(200).optional(),
  avatarUrl: z.string().url().optional(),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(8).max(64),
  newPassword: z.string().min(8).max(64),
});

export const articleCreateSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  summary: z.string().max(500).optional(),
  tags: z.array(z.string().min(1).max(32)).min(0).max(10).optional(),
  categoryId: z.string().optional(),
});

export const articleUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(50000).optional(),
  summary: z.string().max(500).optional(),
  tags: z.array(z.string().min(1).max(32)).min(0).max(10).optional(),
  categoryId: z.string().optional(),
});

export const commentCreateSchema = z.object({
  content: z.string().min(1).max(2000),
  parentId: z.string().optional(),
});

export const tagCreateSchema = z.object({ name: z.string().min(1).max(32) });

export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(64),
  parentId: z.string().optional(),
});

export const webhookCreateSchema = z.object({
  url: z.string(),
  events: z.array(z.enum(['article.published', 'comment.created'])).min(1),
  secret: z.string().optional(),
});
