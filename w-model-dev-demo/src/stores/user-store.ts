import type { User } from '../types.js';
import { ConflictError } from '../utils/errors.js';

class UserStore {
  private byUsername = new Map<string, User>();
  private byId = new Map<string, User>();

  insert(user: User): void {
    if (this.byUsername.has(user.username)) {
      throw new ConflictError(`Username "${user.username}" already exists`);
    }
    this.byUsername.set(user.username, user);
    this.byId.set(user.id, user);
  }

  findByUsername(username: string): User | undefined {
    return this.byUsername.get(username);
  }

  findById(id: string): User | undefined {
    return this.byId.get(id);
  }

  clear(): void {
    this.byUsername.clear();
    this.byId.clear();
  }
}

export const userStore = new UserStore();
