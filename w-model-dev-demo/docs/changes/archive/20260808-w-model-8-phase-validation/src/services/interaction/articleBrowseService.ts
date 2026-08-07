/**
 * articleBrowseService（DD-017 / SD-003）：公开浏览（列表/详情）。
 * 详情 40402 防枚举（草稿/归档对读者不可见）；详情访问触发 reading.viewed 事件（REQ-024 副作用，
 * 同 IP 5 分钟窗口去重由 SD-005 消费——事件方向 SD-003→SD-005，无反向依赖）。
 */
import { BizError } from '../../utils/errors';
import type { ArticleService, PublishedFilters } from '../content/articleService';
import type { ReadingStatService } from '../stats/readingStatService';
import type { EventBus } from '../../utils/eventBus';
import type { Article, Page } from '../../types';

export interface ArticleDetail {
  article: Article;
  viewCount: number;
}

export class ArticleBrowseService {
  constructor(
    private readonly articleService: ArticleService,
    private readonly eventBus: EventBus,
    /** 响应 viewCount 聚合（INTF-018：由 SD-005 聚合返回）；可选注入，单元测试不依赖 */
    private readonly readingStatService?: ReadingStatService,
  ) {}

  /** 已发布文章列表（含 viewCount/likeCount/favoriteCount 聚合由控制器经服务补充） */
  async listPublishedArticles(filters: PublishedFilters, page: number, pageSize: number): Promise<Page<Article>> {
    return this.articleService.listPublishedArticles(filters, page, pageSize);
  }

  /** 详情：读取已发布文章 → 不存在/草稿/归档统一 40402（防枚举）→ emit reading.viewed（副作用在响应体构造前完成） */
  async getPublishedArticleDetail(articleId: string, clientIp: string): Promise<ArticleDetail> {
    const article = await this.articleService.getPublishedArticleById(articleId);
    if (!article) {
      throw new BizError(40402, '文章不存在或不可见');
    }
    // 先 emit（同步分发，SD-005 订阅写入 ReadingRecord），再聚合 viewCount → 响应反映已生效的阅读量
    this.eventBus.emit('reading.viewed', { type: 'reading.viewed', articleId, clientIp });
    const viewCount = this.readingStatService ? this.readingStatService.getViewCount(articleId) : 0;
    return { article, viewCount };
  }
}
