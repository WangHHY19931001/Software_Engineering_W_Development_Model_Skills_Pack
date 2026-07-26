/**
 * UserController（DD-002-001 register / DD-003-001 login / DD-016-001 password reset / DD-021-001 profile）。
 */
import type { Request, Response, NextFunction } from 'express';
import type { UserService } from '../services/user.service.js';
import type { AuthService } from '../services/auth.service.js';
import type { PasswordResetService } from '../services/password-reset.service.js';
import type { UserProfileService } from '../services/user-profile.service.js';
import { registerSchema, loginSchema, passwordResetRequestSchema, passwordResetSchema, profileUpdateSchema } from '../utils/schemas.js';
import { ValidationError } from '../utils/errors.js';
import type { AuthenticatedUser } from '../utils/auth-middleware.js';

function getUser(req: Request): AuthenticatedUser {
  const user = (req as unknown as { user?: AuthenticatedUser }).user;
  if (!user) throw new ValidationError('未认证');
  return user;
}

export class UserController {
  constructor(
    private userService: UserService,
    private authService: AuthService,
    private passwordResetService: PasswordResetService,
    private profileService: UserProfileService,
  ) {}

  async register(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const input = registerSchema.parse(req.body);
    const user = await this.userService.createUser(input);
    res.status(201).json(user);
  }

  async login(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const input = loginSchema.parse(req.body);
    const result = await this.authService.login(input.email, input.password);
    res.json(result);
  }

  async passwordResetRequest(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const input = passwordResetRequestSchema.parse(req.body);
    const result = this.passwordResetService.requestReset(input.email);
    res.json({ message: '密码重置令牌已生成', expiresAt: result.expiresAt });
  }

  async passwordReset(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const input = passwordResetSchema.parse(req.body);
    const result = await this.passwordResetService.resetPasswordHashed(input.token, input.newPassword);
    res.json({ message: '密码已重置', userId: result.userId });
  }

  async getProfile(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const user = getUser(req);
    const profile = this.profileService.getProfile(user.id);
    res.json(profile);
  }

  async updateProfile(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const user = getUser(req);
    const input = profileUpdateSchema.parse(req.body);
    const profile = this.profileService.updateProfile(user.id, input);
    res.json(profile);
  }

  async list(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.json(this.userService.list());
  }
}
