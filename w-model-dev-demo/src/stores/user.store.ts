/**
 * UserStore（DD-002-003 / DD-003-003）— 用户存储 + email 唯一索引。
 */
import type { User } from '../types.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { generateId } from '../utils/id.js';

export class UserStore {
  private users: Map<string, User> = new Map();
  private emailIndex: Map<string, string> = new Map();

  insert(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): User {
    const email = user.email.toLowerCase();
    if (this.emailIndex.has(email)) {
      throw new ConflictError('邮箱已注册');
    }
    const now = new Date().toISOString();
    const record: User = {
      id: user.id ?? generateId('user'),
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(record.id, record);
    this.emailIndex.set(email, record.id);
    return record;
  }

  findById(id: string): User | undefined {
    return this.users.get(id);
  }

  findByEmail(email: string): User | undefined {
    const id = this.emailIndex.get(email.toLowerCase());
    if (!id) return undefined;
    return this.users.get(id);
  }

  update(id: string, patch: Partial<Pick<User, 'passwordHash' | 'role'>>): User {
    const user = this.users.get(id);
    if (!user) throw new NotFoundError('用户');
    const updated: User = {
      ...user,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.users.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    const user = this.users.get(id);
    if (!user) return false;
    this.emailIndex.delete(user.email.toLowerCase());
    return this.users.delete(id);
  }

  list(): User[] {
    return [...this.users.values()];
  }

  size(): number {
    return this.users.size;
  }

  clear(): void {
    this.users.clear();
    this.emailIndex.clear();
  }
}
