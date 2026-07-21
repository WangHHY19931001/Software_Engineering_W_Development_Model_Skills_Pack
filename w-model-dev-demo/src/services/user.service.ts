import { randomUUID } from 'node:crypto';
import type { UserStore } from '../stores/user.store.js';
import type { PasswordUtils } from '../utils/password.js';
import type { JwtUtils } from '../utils/jwt.js';
import type { TokenDTO, UserDTO } from '../types.js';
import { AppError, AuthError, ConflictError } from '../utils/errors.js';

/**
 * 用户业务服务。
 *
 * 设计来源：`docs/detailed-design.md` §3.1 / REQ-001 / NFR-001。
 * - `register`：bcrypt 哈希后存入 UserStore，返回不含 password 字段的 DTO。
 * - `login`：用户名 + 密码校验后签发 JWT；用户名不存在与密码错误均返回 40101（防用户枚举）。
 */
export class UserService {
  constructor(
    private readonly userStore: UserStore,
    private readonly passwordUtils: PasswordUtils,
    private readonly jwtUtils: JwtUtils,
  ) {}

  register(username: string, password: string): UserDTO {
    if (this.userStore.findByUsername(username)) {
      throw new ConflictError('用户名已注册');
    }
    const userId = randomUUID();
    const createdAt = new Date().toISOString();
    const passwordHash = this.passwordUtils.hash(password);
    if (!passwordHash || !passwordHash.startsWith('$2b$10$')) {
      throw new AppError(50002, '密码哈希异常', 500, true);
    }
    try {
      this.userStore.save({ id: userId, username, passwordHash, createdAt });
    } catch (err) {
      throw new AppError(50002, `用户写入失败: ${(err as Error).message}`, 500, true);
    }
    return { userId, username };
  }

  login(username: string, password: string): TokenDTO {
    const user = this.userStore.findByUsername(username);
    // 不区分用户名不存在与密码错误（防用户枚举）
    if (!user || !this.passwordUtils.compare(password, user.passwordHash)) {
      throw new AuthError(40101, '用户名或密码错误');
    }
    const token = this.jwtUtils.sign({ userId: user.id, username: user.username });
    return { token, expiresIn: 3600 };
  }
}
