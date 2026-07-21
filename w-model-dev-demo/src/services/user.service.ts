import { randomUUID } from 'node:crypto';
import { userStore } from '../stores/user.store.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { ConflictError, UnauthorizedError } from '../utils/errors.js';

export class UserService {
  static async register(
    username: string,
    password: string,
  ): Promise<{ userId: string; username: string }> {
    if (userStore.findByUsername(username)) {
      throw new ConflictError(40901, '用户名已存在');
    }
    const user = {
      id: randomUUID(),
      username,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    userStore.save(user);
    return { userId: user.id, username: user.username };
  }

  static async login(
    username: string,
    password: string,
  ): Promise<{ token: string; userId: string; username: string }> {
    const user = userStore.findByUsername(username);
    if (!user) throw new UnauthorizedError(40101, '用户名或密码错误');
    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) throw new UnauthorizedError(40101, '用户名或密码错误');
    const token = signToken({ userId: user.id, username: user.username });
    return { token, userId: user.id, username: user.username };
  }
}
