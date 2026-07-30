/**
 * 博主仓储
 */
import { BaseRepository } from './base.repository.js';
import type { Blogger } from '../types/index.js';

export class BloggerRepository extends BaseRepository<Blogger> {
  async findByUserId(userId: string): Promise<Blogger | null> {
    return this.findOne((b) => b.userId === userId);
  }

  async findVerified(): Promise<Blogger[]> {
    return this.findBy((b) => b.verified === true);
  }
}
