import type { User } from '../types.js';

/**
 * 内存用户存储。
 *
 * 设计来源：`docs/detailed-design.md` §1.1 / §2.3 / CON-002。
 * - 主键 `id` 作为 Map key（O(1) 查找）。
 * - `username` 通过遍历查找（数据规模 ≤ 1000，性能可接受）。
 */
export class UserStore {
  private readonly users: Map<string, User> = new Map();

  save(user: User): User {
    this.users.set(user.id, user);
    return user;
  }

  findById(id: string): User | undefined {
    return this.users.get(id);
  }

  findByUsername(username: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.username === username) return user;
    }
    return undefined;
  }

  clear(): void {
    this.users.clear();
  }
}
