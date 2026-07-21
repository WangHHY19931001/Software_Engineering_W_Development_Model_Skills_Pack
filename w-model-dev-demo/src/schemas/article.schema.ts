import { z } from 'zod';

/**
 * 文章 zod schemas。
 *
 * 设计来源：`docs/outline-design.md` §2.2 / `docs/detailed-design.md` §3.2 / NFR-003。
 * - title：1..200 字符。
 * - content：1..10000 字符。
 * - tags：0..10 个字符串。
 * - 列表查询：page ≥ 1，pageSize ∈ [1, 100]。
 */
export const ArticleCreateSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题长度不能超过 200'),
  content: z.string().min(1, '正文不能为空').max(10000, '正文长度不能超过 10000'),
  tags: z.array(z.string()).max(10, '标签数量不能超过 10').optional(),
});

export const ArticleUpdateSchema = z
  .object({
    title: z.string().min(1, '标题不能为空').max(200, '标题长度不能超过 200').optional(),
    content: z.string().min(1, '正文不能为空').max(10000, '正文长度不能超过 10000').optional(),
    tags: z.array(z.string()).max(10, '标签数量不能超过 10').optional(),
  })
  .refine(data => data.title !== undefined || data.content !== undefined || data.tags !== undefined, {
    message: '至少需要更新 1 个字段',
  });

export const ArticleListQuerySchema = z.object({
  page: z.coerce.number().int('page 必须为整数').min(1, 'page 至少为 1').default(1),
  pageSize: z.coerce
    .number()
    .int('pageSize 必须为整数')
    .min(1, 'pageSize 至少为 1')
    .max(100, 'pageSize 不能超过 100')
    .default(10),
  tag: z.string().optional(),
});

export type ArticleCreateInput = z.infer<typeof ArticleCreateSchema>;
export type ArticleUpdateInput = z.infer<typeof ArticleUpdateSchema>;
export type ArticleListQueryInput = z.infer<typeof ArticleListQuerySchema>;
