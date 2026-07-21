import type { User } from '../types.js';

class UserStoreImpl {
  private users = new Map<string, User>();
  private usernameIndex = new Map<string, string>();

  save(user: User): void {
    this.users.set(user.id, user);
    this.usernameIndex.set(user.username, user.id);
  }

  findById(id: string): User | undefined {
    return this.users.get(id);
  }

  findByUsername(username: string): User | undefined {
    const id = this.usernameIndex.get(username);
    return id ? this.users.get(id) : undefined;
  }

  clear(): void {
    this.users.clear();
    this.usernameIndex.clear();
  }

  size(): number {
    return this.users.size;
  }
}

export const userStore = new UserStoreImpl();
