/**
 * UT-017 详情访问触发阅读事件（articleBrowseService.getPublishedArticleDetail，DD-017/INTF-011/018）
 */
import { describe, it, expect, vi } from 'vitest';
import { ArticleBrowseService } from '../../../src/services/interaction/articleBrowseService';
import { BizError } from '../../../src/utils/errors';

describe('UT-017 articleBrowseService.getPublishedArticleDetail', () => {
  it('已发布文章详情访问 emit reading.viewed（clientIp 注入）', async () => {
    const articleService: any = {
      getPublishedArticleById: vi.fn().mockResolvedValue({ id: 'a_1001', authorId: 'u_0002', title: 't', body: 'b', status: 'published' }),
    };
    const eventBus: any = { emit: vi.fn() };
    const service = new ArticleBrowseService(articleService, eventBus);

    const detail = await service.getPublishedArticleDetail('a_1001', '127.0.0.1');

    expect(detail.article.id).toBe('a_1001');
    expect(eventBus.emit).toHaveBeenCalledWith('reading.viewed', expect.objectContaining({ articleId: 'a_1001', clientIp: '127.0.0.1' }));
  });

  it('草稿/非 published 抛 40402 且不 emit', async () => {
    const articleService: any = { getPublishedArticleById: vi.fn().mockResolvedValue(null) };
    const eventBus: any = { emit: vi.fn() };
    const service = new ArticleBrowseService(articleService, eventBus);

    const error = await service.getPublishedArticleDetail('a_draft', '127.0.0.1').catch((e) => e);
    expect(error).toBeInstanceOf(BizError);
    expect(error.code).toBe(40402);
    expect(eventBus.emit).not.toHaveBeenCalled();
  });
});

describe('articleBrowseService.listPublishedArticles', () => {
  it('委托 articleService 仅取已发布文章分页', async () => {
    const articleService: any = {
      listPublishedArticles: vi.fn().mockResolvedValue({ items: [{ id: 'a_1' }], total: 1, page: 1, pageSize: 20 }),
    };
    const service = new ArticleBrowseService(articleService, {} as any);

    const page = await service.listPublishedArticles({ keyword: 'k' }, 1, 20);

    expect(articleService.listPublishedArticles).toHaveBeenCalledWith({ keyword: 'k' }, 1, 20);
    expect(page.total).toBe(1);
  });
});

describe('articleBrowseService 详情 viewCount 聚合（readingStatService 可选注入）', () => {
  it('注入 readingStatService 时详情返回去重后 viewCount（副作用后聚合）', async () => {
    const articleService: any = {
      getPublishedArticleById: vi.fn().mockResolvedValue({ id: 'a_1001', authorId: 'u_0002', title: 't', status: 'published' }),
    };
    const eventBus: any = { emit: vi.fn() };
    const readingStatService: any = { getViewCount: vi.fn(() => 7) };
    const service = new ArticleBrowseService(articleService, eventBus, readingStatService);

    const detail = await service.getPublishedArticleDetail('a_1001', '127.0.0.1');

    expect(detail.viewCount).toBe(7);
    expect(readingStatService.getViewCount).toHaveBeenCalledWith('a_1001');
  });
});
