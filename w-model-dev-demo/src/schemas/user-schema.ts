import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(128),
});

export const loginSchema = registerSchema;
