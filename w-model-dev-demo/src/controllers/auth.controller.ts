/**
 * AuthController：认证 HTTP 适配层（调用 INTF-001）。
 * register 201 / login 200，异常透传 errorHandler。
 */
import type { RequestHandler } from 'express';
import type { AuthService } from '../services/user.service';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register: RequestHandler = async (req, res) => {
    const result = await this.authService.register(req.body);
    res.status(201).json(result);
  };

  login: RequestHandler = async (req, res) => {
    const result = await this.authService.login(req.body);
    res.status(200).json(result);
  };
}
