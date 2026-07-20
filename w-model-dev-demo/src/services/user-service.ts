import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { userStore } from '../stores/user-store.js';
import { ConflictError, UnauthorizedError } from '../utils/errors.js';
import { BCRYPT_COST, JWT_EXPIRES_IN, JWT_SECRET } from '../utils/env.js';

class UserService {
  async register(input: { username: string; password: string }): Promise<{ userId: string }> {
    if (userStore.findByUsername(input.username)) {
      throw new ConflictError(`Username "${input.username}" already exists`);
    }
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const user = {
      id: randomUUID(),
      username: input.username,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    userStore.insert(user);
    return { userId: user.id };
  }

  async login(input: { username: string; password: string }): Promise<{ token: string }> {
    const user = userStore.findByUsername(input.username);
    if (!user) throw new UnauthorizedError('Invalid username or password');
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedError('Invalid username or password');
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return { token };
  }

  verifyToken(token: string): { userId: string } | null {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      return { userId: payload.userId };
    } catch {
      return null;
    }
  }
}

export const userService = new UserService();
