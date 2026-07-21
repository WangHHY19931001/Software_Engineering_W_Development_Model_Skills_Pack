import { type Request, type Response } from 'express';
import { UserService } from '../services/user.service.js';
import type { AuthRegisterDTO, AuthLoginDTO } from '../schemas/auth.schema.js';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    const dto = req.body as AuthRegisterDTO;
    const result = await UserService.register(dto.username, dto.password);
    res.status(201).json(result);
  }

  static async login(req: Request, res: Response): Promise<void> {
    const dto = req.body as AuthLoginDTO;
    const result = await UserService.login(dto.username, dto.password);
    res.status(200).json(result);
  }
}
