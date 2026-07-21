import { z } from 'zod';

export const AuthRegisterSchema = z.object({
  username: z.string().min(3, '用户名至少 3 字符').max(32, '用户名至多 32 字符'),
  password: z.string().min(6, '密码至少 6 字符').max(128, '密码至多 128 字符'),
});

export const AuthLoginSchema = AuthRegisterSchema;

export type AuthRegisterDTO = z.infer<typeof AuthRegisterSchema>;
export type AuthLoginDTO = z.infer<typeof AuthLoginSchema>;
