// 用户内存存储封装：Map 读写 + username 索引
// 对应 detailed-design.md DD-USER-STORE：store Map<userId,User> + usernameIndex Map<username,userId>
import type { User } from '../types';

export class UserStore {
  private store = new Map<string, User>();
  private usernameIndex = new Map<string, string>();

  save(user: User): void {
    this.store.set(user.id, user);
    this.usernameIndex.set(user.username, user.id);
  }

  findById(userId: string | null): User | null {
    if (userId == null) return null;
    return this.store.get(userId) ?? null;
  }

  findByUsername(username: string | null): User | null {
    if (username == null) return null;
    const id = this.usernameIndex.get(username);
    if (!id) return null;
    return this.store.get(id) ?? null;
  }
}

export const userStore = new UserStore();
