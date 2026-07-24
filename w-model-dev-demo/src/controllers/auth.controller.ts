// 认证控制器：处理注册/登录 HTTP 请求，编排 AuthService
// 对应 detailed-design.md DD-AUTH-CTRL
import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import type { AuthService } from '../services/auth.service';
import { AppError } from '../utils/errors';

export class AuthController {
  constructor(private authService: AuthService) {}

  async register(req: Request, res: Response): Promise<void> {
    const { username, password } = req.body as { username: string; password: string };
    const result = await this.authService.register(username, password);
    if (!result.ok) {
      // 业务失败通过抛 AppError 传递到错误中间件（UT-002 场景）
      throw new AppError(result.code, result.message);
    }
    res.status(201).json({
      code: 0,
      message: '注册成功',
      data: { userId: result.data.userId, username },
    });
  }

  async login(req: Request, res: Response): Promise<void> {
    const { username, password } = req.body as { username: string; password: string };
    const result = await this.authService.login(username, password);
    if (!result.ok) {
      throw new AppError(result.code, result.message);
    }
    res.status(200).json({
      code: 0,
      message: '登录成功',
      data: { token: result.data.token, role: result.data.role },
    });
  }

  async logout(req: Request, res: Response): Promise<void> {
    const result = this.authService.logout();
    if (!result.ok) {
      throw new AppError(result.code, result.message);
    }
    res.status(200).json({
      code: 0,
      message: result.data.message,
    });
  }
}

export const authController = new AuthController(authService);
