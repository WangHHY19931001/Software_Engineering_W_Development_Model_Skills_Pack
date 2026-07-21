import { z } from 'zod';

export const ArticleCreateSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题至多 200 字符'),
  content: z.string().min(1, '内容不能为空'),
});

export const ArticleUpdateSchema = ArticleCreateSchema.partial();

export type ArticleCreateDTO = z.infer<typeof ArticleCreateSchema>;
export type ArticleUpdateDTO = z.infer<typeof ArticleUpdateSchema>;
