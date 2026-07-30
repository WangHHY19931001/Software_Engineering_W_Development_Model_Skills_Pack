/**
 * 标签仓储
 */
import { BaseRepository } from './base.repository.js';
import type { Tag } from '../types/index.js';

export class TagRepository extends BaseRepository<Tag> {
  async findByName(name: string): Promise<Tag | null> {
    return this.findOne((t) => t.name === name);
  }

  async findBySlug(slug: string): Promise<Tag | null> {
    return this.findOne((t) => t.slug === slug);
  }

  async findByNames(names: string[]): Promise<Tag[]> {
    return this.findBy((t) => names.includes(t.name));
  }
}
