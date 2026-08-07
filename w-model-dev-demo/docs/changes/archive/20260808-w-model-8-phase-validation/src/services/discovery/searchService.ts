/**
 * searchService（DD-028 / SD-004）：全文搜索（REQ-023）。
 * 标题+正文+摘要+标签四字段索引（权重：标题>标签>摘要>正文），仅已发布；
 * 订阅 article.published/article.updated/article.archived/article.deleted 事件同步索引。
 */
import { BizError } from '../../utils/errors';
import type { SearchIndexStore } from '../../stores/searchIndexStore';
import type { ArticleService } from '../content/articleService';
import type { BlogEvent, Page, SearchResultItem } from '../../types';

export class SearchService {
  constructor(
    private readonly searchIndexStore: SearchIndexStore,
    private readonly articleService: ArticleService,
  ) {}

  /** 索引检索 → 关联文章明细（仅已发布）→ 相关性降序分页 */
  async searchArticles(q: string, page: number, pageSize: number): Promise<Page<SearchResultItem>> {
    const keyword = q?.trim() ?? '';
    if (!keyword || keyword.length > 100) {
      throw new BizError(40002, '搜索关键词长度非法（1~100）');
    }
    const hits = await this.searchIndexStore.queryAll(keyword);
    const articles = await this.articleService.getArticlesByIds(hits.map((h) => h.id));
    const publishedById = new Map(
      articles
        .filter((a) => a.status === 'published')
        .map((a) => [a.id, a] as const),
    );
    const scoreMap = new Map(hits.map((h) => [h.id, h.score]));
    const items: SearchResultItem[] = [...publishedById.values()]
      .map((a) => ({
        articleId: a.id,
        title: a.title,
        summary: a.summary,
        score: scoreMap.get(a.id) ?? 0,
      }))
      .sort((x, y) => y.score - x.score);
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
  }

  /** 事件同步：仅已发布入索引；草稿/归档/删除移除索引（保证仅已发布可检索，UT-058） */
  syncIndex(event: Extract<BlogEvent, { type: string }> & { articleId?: string }): void {
    const articleId = event.articleId;
    if (!articleId) return;
    const article = this.articleService.getArticleByIdSync(articleId);
    if (!article || article.status !== 'published') {
      this.searchIndexStore.remove(articleId);
      return;
    }
    this.searchIndexStore.index(articleId, {
      title: article.title,
      body: article.body,
      summary: article.summary,
      tags: article.tags,
    });
  }
}
