import { z } from 'zod';

/**
 * 用户认证 zod schemas。
 *
 * 设计来源：`docs/outline-design.md` §2.1 / `docs/detailed-design.md` §3.1 / NFR-003。
 * - 用户名：3..32 字母数字下划线。
 * - 注册密码：长度 ≥ 8 + 至少 1 字母 + 1 数字（RISK-006 量化策略）。
 * - 登录密码：非空即可（不强制复杂度，便于已注册用户任意密码登录）。
 */
export const AuthRegisterSchema = z.object({
  username: z
    .string()
    .min(3, '用户名长度需为 3..32')
    .max(32, '用户名长度需为 3..32')
    .regex(/^[A-Za-z0-9_]+$/, '用户名仅允许字母数字下划线'),
  password: z
    .string()
    .min(8, '密码长度至少 8 位')
    .regex(/[A-Za-z]/, '密码需至少包含 1 个字母')
    .regex(/[0-9]/, '密码需至少包含 1 个数字'),
});

export const AuthLoginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

export type AuthRegisterInput = z.infer<typeof AuthRegisterSchema>;
export type AuthLoginInput = z.infer<typeof AuthLoginSchema>;
