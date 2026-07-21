import { z } from 'zod';

export const CommentCreateSchema = z.object({
  content: z.string().min(1, '评论内容不能为空').max(1000, '评论至多 1000 字符'),
});

export type CommentCreateDTO = z.infer<typeof CommentCreateSchema>;
