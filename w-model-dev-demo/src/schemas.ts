// zod 请求体校验 schema 定义
// 对应 detailed-design.md DD-VALIDATE-MW + outline-design.md §3 接口契约参数约束
import { z } from 'zod';

// 注册请求体：username len[3,32] 字母数字下划线；password len[6,128]
export const registerSchema = z.object({
  username: z
    .string()
    .min(3, '用户名长度须 3-32')
    .max(32, '用户名长度须 3-32')
    .regex(/^[A-Za-z0-9_]+$/, '用户名仅允许字母数字下划线'),
  password: z
    .string()
    .min(6, '密码长度须 6-128')
    .max(128, '密码长度须 6-128'),
});

// 登录请求体：与注册一致
export const loginSchema = registerSchema;

// 发布文章请求体：title len[1,200]；content len[1,10000]
export const publishArticleSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题长度不超过 200'),
  content: z.string().min(1, '正文不能为空').max(10000, '正文长度不超过 10000'),
});

// 添加评论请求体：content len[1,1000]
export const addCommentSchema = z.object({
  content: z.string().min(1, '评论内容不能为空').max(1000, '评论长度不超过 1000'),
});

// 审核文章请求体：action ∈ ['approve','reject']
export const reviewArticleSchema = z.object({
  action: z.enum(['approve', 'reject'], { message: 'action 须为 approve 或 reject' }),
});
