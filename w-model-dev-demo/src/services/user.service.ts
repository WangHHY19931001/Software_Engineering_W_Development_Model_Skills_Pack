/**
 * AuthService：注册 / 登录 / token 校验（realizes INTF-001 / DD-004）。
 * 依赖 UserStore + PasswordHasher + JwtService。
 */
import { randomUUID } from 'node:crypto';
import type { UserStore } from '../stores/user.store';
import type { PasswordHasher } from '../utils/password';
import type { JwtService } from '../utils/jwt';
import { ConflictError, UnauthorizedError, ErrorCode } from '../utils/errors';
import type { RegisterInput, LoginInput, JwtPayload } from '../types';

const TOKEN_EXPIRES_IN = 3600;
const INVALID_CREDENTIALS_MSG = '用户名或密码错误';

export class AuthService {
  constructor(
    private readonly userStore: UserStore,
    private readonly passwordHasher: PasswordHasher,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<{ userId: string; username: string }> {
    if (this.userStore.findByUsername(input.username)) {
      throw new ConflictError(ErrorCode.CONFLICT, '用户名已存在');
    }
    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = {
      id: randomUUID(),
      username: input.username,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    this.userStore.insert(user);
    return { userId: user.id, username: user.username };
  }

  async login(input: LoginInput): Promise<{ token: string; expiresIn: number }> {
    const user = this.userStore.findByUsername(input.username);
    if (!user) {
      throw new UnauthorizedError(ErrorCode.UNAUTHORIZED_CREDENTIALS, INVALID_CREDENTIALS_MSG);
    }
    const ok = await this.passwordHasher.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedError(ErrorCode.UNAUTHORIZED_CREDENTIALS, INVALID_CREDENTIALS_MSG);
    }
    const token = this.jwtService.sign({ userId: user.id, username: user.username }, TOKEN_EXPIRES_IN);
    return { token, expiresIn: TOKEN_EXPIRES_IN };
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verify(token);
  }
}
