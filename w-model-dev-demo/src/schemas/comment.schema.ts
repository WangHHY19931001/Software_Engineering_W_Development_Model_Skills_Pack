/**
 * zod 校验 schema：评论入参与路径参数（realizes INTF-007 部分 / SD-006）。
 */
import { z } from 'zod';

export const commentCreateSchema = z.object({
  content: z.string().min(1).max(1000),
});

export const commentIdParamSchema = z.object({
  commentId: z.string().min(1),
});
