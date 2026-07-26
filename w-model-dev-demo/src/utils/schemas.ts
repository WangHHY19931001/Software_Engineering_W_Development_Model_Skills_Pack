/**
 * zod schema 定义（DD-COMMON-003 输入验证 / NFR-005）。
 * 覆盖所有控制器的请求体验证。
 */
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('邮箱格式错误'),
  password: z.string().min(8, '密码至少 8 位').max(128, '密码最多 128 位'),
  role: z.enum(['admin', 'author', 'reader']).default('reader'),
});

export const loginSchema = z.object({
  email: z.string().email('邮箱格式错误'),
  password: z.string().min(1, '密码必填'),
});

export const articleCreateSchema = z.object({
  title: z.string().min(1, '标题必填').max(200, '标题最多 200 字'),
  content: z.string().min(1, '正文必填'),
  tagIds: z.array(z.string()).default([]),
  categoryId: z.string().nullable().default(null),
  status: z.enum(['draft', 'published']).default('draft'),
});

export const articleUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  tagIds: z.array(z.string()).optional(),
  categoryId: z.string().nullable().optional(),
});

export const articleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  authorId: z.string().optional(),
  tagId: z.string().optional(),
  categoryId: z.string().optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'likeCount', 'viewCount']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const commentCreateSchema = z.object({
  content: z.string().min(1, '评论内容必填').max(2000, '评论最多 2000 字'),
});

export const tagCreateSchema = z.object({
  name: z.string().min(1, '标签名必填').max(50, '标签名最多 50 字'),
});

export const tagUpdateSchema = z.object({
  name: z.string().min(1).max(50),
});

export const categoryCreateSchema = z.object({
  name: z.string().min(1, '分类名必填').max(50),
  parentCategoryId: z.string().nullable().default(null),
});

export const categoryUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  parentCategoryId: z.string().nullable().optional(),
});

const stringOrArrayToArray = z.preprocess((v) => {
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) return v;
  return [String(v)];
}, z.array(z.string()).optional());

export const searchQuerySchema = z.object({
  keyword: z.string().default(''),
  tagIds: stringOrArrayToArray,
  categoryIds: stringOrArrayToArray,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email('邮箱格式错误'),
});

export const passwordResetSchema = z.object({
  token: z.string().min(1, '令牌必填'),
  newPassword: z.string().min(8, '新密码至少 8 位'),
});

export const articleWorkflowSchema = z.object({
  action: z.enum(['publish', 'unpublish', 'archive']),
});

export const profileUpdateSchema = z.object({
  nickname: z.string().min(1).max(50).optional(),
  avatar: z.string().url().optional(),
  bio: z.string().max(500).optional(),
});

export const auditLogQuerySchema = z.object({
  userId: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const webhookCreateSchema = z.object({
  url: z.string().url('URL 格式错误'),
  events: z.array(z.string().min(1)).min(1, '至少订阅一个事件'),
  secret: z.string().min(8, '密钥至少 8 位'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ArticleCreateInput = z.infer<typeof articleCreateSchema>;
export type ArticleUpdateInput = z.infer<typeof articleUpdateSchema>;
export type ArticleListQueryInput = z.infer<typeof articleListQuerySchema>;
export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
export type TagCreateInput = z.infer<typeof tagCreateSchema>;
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;
export type WebhookCreateInput = z.infer<typeof webhookCreateSchema>;
