/**
 * zod 校验 schema：文章入参与分页（realizes INTF-007 部分 / SD-006）。
 */
import { z } from 'zod';

export const articleCreateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
  tags: z.array(z.string()).max(10).optional(),
});

export const articleUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10000).optional(),
  tags: z.array(z.string()).max(10).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1),
  pageSize: z.coerce.number().int().min(1).max(100),
});

export const articleIdParamSchema = z.object({
  id: z.string().min(1),
});
