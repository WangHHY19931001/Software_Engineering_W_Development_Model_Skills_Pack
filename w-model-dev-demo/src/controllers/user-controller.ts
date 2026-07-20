import type { Request, Response } from 'express';
import { userService } from '../services/user-service.js';
import { loginSchema, registerSchema } from '../schemas/user-schema.js';

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.parse(req.body);
  const result = await userService.register(parsed);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.parse(req.body);
  const result = await userService.login(parsed);
  res.status(200).json(result);
}
