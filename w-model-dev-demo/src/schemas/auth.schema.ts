/**
 * zod 校验 schema：认证入参（realizes INTF-007 部分 / SD-006）。
 * register：username 3-32，password ≥8 且含字母与数字。
 * login：宽松校验，未命中也交由 service 返回 40101（不泄露用户名存在性）。
 */
import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(3).max(32),
  password: z
    .string()
    .min(8)
    .regex(/[a-zA-Z]/, '密码须包含字母')
    .regex(/[0-9]/, '密码须包含数字'),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
