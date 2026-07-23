/**
 * UserStore：用户内存存储（realizes INTF-010 / DD-001）。
 * 维护 users 主存储 + usernameIndex 唯一索引，冲突抛 40901。
 */
import type { User } from '../types';
import { ConflictError, ErrorCode } from '../utils/errors';

export class UserStore {
  private readonly users = new Map<string, User>();
  private readonly usernameIndex = new Map<string, string>();

  insert(user: User): void {
    if (this.usernameIndex.has(user.username)) {
      throw new ConflictError(ErrorCode.CONFLICT, '用户名已存在');
    }
    this.users.set(user.id, user);
    this.usernameIndex.set(user.username, user.id);
  }

  findByUsername(username: string): User | undefined {
    const id = this.usernameIndex.get(username);
    if (!id) return undefined;
    return this.users.get(id);
  }

  findById(id: string): User | undefined {
    return this.users.get(id);
  }

  clear(): void {
    this.users.clear();
    this.usernameIndex.clear();
  }

  size(): number {
    return this.users.size;
  }
}
