import { z } from 'zod';

export const createArticleSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
});

export const updateArticleSchema = createArticleSchema.partial();
