/**
 * 访问记录仓储
 */
import { BaseRepository } from './base.repository.js';
import type { ViewRecord } from '../types/index.js';

export class ViewRecordRepository extends BaseRepository<ViewRecord> {
  async findByPost(postId: string): Promise<ViewRecord[]> {
    return this.findBy((v) => v.postId === postId);
  }

  async countUniqueVisitors(postId: string): Promise<number> {
    const records = await this.findByPost(postId);
    const set = new Set<string>();
    for (const r of records) {
      if (r.userId) {
        set.add(`u:${r.userId}`);
      } else {
        set.add(`ip:${r.ip}`);
      }
    }
    return set.size;
  }

  async countTotalViews(postId: string): Promise<number> {
    return this.countByPost(postId);
  }

  private async countByPost(postId: string): Promise<number> {
    const all = await this.findByPost(postId);
    return all.length;
  }
}
