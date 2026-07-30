/**
 * 访问记录服务
 */
import { ViewRecordRepository } from '../repositories/view-record.repository.js';
import { ArticleRepository } from '../repositories/article.repository.js';
import { generateId } from '../utils/id.js';
import { NotFoundError } from '../utils/errors.js';
import type { ViewRecord } from '../types/index.js';

export class ViewRecordService {
  constructor(
    private readonly viewRecordRepo: ViewRecordRepository,
    private readonly articleRepo: ArticleRepository,
  ) {}

  async recordView(input: {
    postId: string;
    userId: string | null;
    ip: string;
    userAgent: string;
    referer?: string;
  }): Promise<ViewRecord> {
    const article = await this.articleRepo.findById(input.postId);
    if (!article) {
      throw new NotFoundError('Article');
    }
    const record: ViewRecord = {
      id: generateId('view'),
      postId: input.postId,
      userId: input.userId,
      ip: input.ip,
      userAgent: input.userAgent,
      referer: input.referer ?? '',
      createdAt: Date.now(),
    };
    await this.viewRecordRepo.create(record);
    await this.articleRepo.incrementView(input.postId);
    return record;
  }

  async getByPost(postId: string): Promise<ViewRecord[]> {
    return this.viewRecordRepo.findByPost(postId);
  }

  async countViews(postId: string): Promise<number> {
    return this.viewRecordRepo.countTotalViews(postId);
  }

  async countUniqueVisitors(postId: string): Promise<number> {
    return this.viewRecordRepo.countUniqueVisitors(postId);
  }
}
