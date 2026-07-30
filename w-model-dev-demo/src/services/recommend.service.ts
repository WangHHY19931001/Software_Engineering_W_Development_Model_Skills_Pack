/**
 * 推荐服务
 */
import { ArticleRepository } from '../repositories/article.repository.js';
import { TagRepository } from '../repositories/tag.repository.js';
import { ArticleStatus, type Article, type PaginatedResult } from '../types/index.js';

export class RecommendService {
  constructor(
    private readonly articleRepo: ArticleRepository,
    private readonly tagRepo: TagRepository,
  ) {}

  /**
   * 基于用户最近浏览的博文做 Jaccard 标签相似度推荐
   */
  async recommendByTags(articleId: string, limit: number = 5): Promise<Article[]> {
    const base = await this.articleRepo.findById(articleId);
    if (!base) return [];
    const all = await this.articleRepo.findPublished();
    const candidates = all.filter((a) => a.id !== base.id);

    const scored = candidates
      .map((a) => ({ article: a, score: this.jaccard(base.tagIds, a.tagIds) }))
      .filter((s) => s.score > 0);
    scored.sort((x, y) => y.score - x.score);
    return scored.slice(0, limit).map((s) => s.article);
  }

  /**
   * 热门博文（按 viewCount 降序）
   */
  async popular(limit: number = 10): Promise<Article[]> {
    const all = await this.articleRepo.findPublished();
    all.sort((a, b) => b.viewCount - a.viewCount);
    return all.slice(0, limit);
  }

  /**
   * 最新发布
   */
  async recent(limit: number = 10): Promise<Article[]> {
    const all = await this.articleRepo.findPublished();
    all.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
    return all.slice(0, limit);
  }

  /**
   * 基于博主推荐（同一作者的其他文章）
   */
  async byAuthor(authorId: string, excludeId: string | null = null, limit: number = 5): Promise<Article[]> {
    const all = await this.articleRepo.findByAuthor(authorId);
    return all
      .filter((a) => a.status === ArticleStatus.PUBLISHED && a.id !== excludeId)
      .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
      .slice(0, limit);
  }

  async related(articleId: string, page: number = 1, pageSize: number = 5): Promise<PaginatedResult<Article>> {
    const items = await this.recommendByTags(articleId, pageSize);
    return {
      items,
      total: items.length,
      page,
      pageSize,
      totalPages: 1,
    };
  }

  private jaccard(a: string[], b: string[]): number {
    if (a.length === 0 && b.length === 0) return 0;
    const setA = new Set(a);
    const setB = new Set(b);
    let intersect = 0;
    for (const x of setA) {
      if (setB.has(x)) intersect += 1;
    }
    const union = setA.size + setB.size - intersect;
    return union === 0 ? 0 : intersect / union;
  }

  async getTopTags(limit: number = 10): Promise<Array<{ tagId: string; count: number }>> {
    const all = await this.articleRepo.findPublished();
    const counts = new Map<string, number>();
    for (const a of all) {
      for (const t of a.tagIds) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([tagId, count]) => ({ tagId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async listAllTags(): Promise<Array<{ id: string; name: string }>> {
    const tags = await this.tagRepo.findAll();
    return tags.map((t) => ({ id: t.id, name: t.name }));
  }
}
