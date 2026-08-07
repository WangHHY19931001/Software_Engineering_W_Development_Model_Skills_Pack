/**
 * UT-026 近 7 天阅读量 Top N（hotService.getHotArticles，DD-026/INTF-015）
 */
import { describe, it, expect, vi } from 'vitest';
import { HotService } from '../../../src/services/discovery/hotService';

function publishedArticle(id: string): any {
  return { id, authorId: 'u_0002', title: `标题${id}`, summary: `摘要${id}`, status: 'published', publishedAt: `2026-08-0${id === 'a1' ? 1 : 2}T10:00:00.000Z` };
}

describe('UT-026 hotService.getHotArticles', () => {
  it('7 天窗口阅读量降序 Top N；窗口外不计；limit 超实际返回实际数', async () => {
    const readingStatService: any = {
      getViews7d: vi.fn().mockReturnValue(new Map([['a1', 10], ['a2', 5]])),
    };
    const articleService: any = {
      findAllPublished: vi.fn().mockResolvedValue([publishedArticle('a1'), publishedArticle('a2'), publishedArticle('a_old')]),
    };
    const service = new HotService(readingStatService, articleService);

    const result = await service.getHotArticles(2);
    expect(result.map((i) => i.articleId)).toEqual(['a1', 'a2']);
    expect(result).not.toContainEqual(expect.objectContaining({ articleId: 'a_old' }));
    expect(result[0].viewCount7d).toBe(10);

    const result10 = await service.getHotArticles(10);
    expect(result10).toHaveLength(2);
  });

  it('limit 越界（0/51）→ 40002；无已发布文章返回空', async () => {
    const readingStatService: any = { getViews7d: vi.fn() };
    const articleService: any = { findAllPublished: vi.fn().mockResolvedValue([]) };
    const service = new HotService(readingStatService, articleService);

    expect((await service.getHotArticles(0).catch((e) => e)).code).toBe(40002);
    expect((await service.getHotArticles(51).catch((e) => e)).code).toBe(40002);
    expect(await service.getHotArticles(10)).toEqual([]);
  });
});
