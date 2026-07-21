import { z } from 'zod';

/**
 * 评论 zod schemas。
 *
 * 设计来源：`docs/outline-design.md` §2.3 / `docs/detailed-design.md` §3.3 / NFR-003。
 * - content：1..1000 字符。
 */
export const CommentCreateSchema = z.object({
  content: z.string().min(1, '评论内容不能为空').max(1000, '评论内容不能超过 1000'),
});

export type CommentCreateInput = z.infer<typeof CommentCreateSchema>;
