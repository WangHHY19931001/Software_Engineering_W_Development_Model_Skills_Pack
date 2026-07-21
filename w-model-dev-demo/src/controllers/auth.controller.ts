import type { Request, Response } from 'express';
import type { UserService } from '../services/user.service.js';

/**
 * 用户认证控制器。
 *
 * 设计来源：`docs/outline-design.md` §2.1（接口 1 / 2）。
 * - `POST /api/v1/auth/register` → 201 `{ userId, username }`
 * - `POST /api/v1/auth/login` → 200 `{ token, expiresIn }`
 */
export class AuthController {
  constructor(private readonly userService: UserService) {}

  register = (req: Request, res: Response): void => {
    const { username, password } = req.body as { username: string; password: string };
    const result = this.userService.register(username, password);
    res.status(201).json(result);
  };

  login = (req: Request, res: Response): void => {
    const { username, password } = req.body as { username: string; password: string };
    const result = this.userService.login(username, password);
    res.status(200).json(result);
  };
}
