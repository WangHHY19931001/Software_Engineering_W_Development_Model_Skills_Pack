/**
 * 用户仓储
 */
import { BaseRepository } from './base.repository.js';
import type { User } from '../types/index.js';

export class UserRepository extends BaseRepository<User> {
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne((u) => u.email === email);
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.findOne((u) => u.username === username);
  }

  async findByRole<T extends User['role']>(role: T): Promise<User[]> {
    return this.findBy((u) => u.role === role);
  }
}
