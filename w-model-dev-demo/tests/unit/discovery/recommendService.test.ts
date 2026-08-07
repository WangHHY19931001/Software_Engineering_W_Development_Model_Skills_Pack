/**
 * UT-027 冷启动推荐回退热门（recommendService.getRecommendations，DD-027/INTF-016）
 * UT-057 标签偏好推荐含已读去重（recommendService.getRecommendations，DD-027/INTF-016）
 */
import { describe, it, expect, vi } from 'vitest';
import { RecommendService } from '../../../src/services/discovery/recommendService';

function hotItem(articleId: string, viewCount7d: number): any {
  return { articleId, title: `t-${articleId}`, summary: `s-${articleId}`, viewCount7d, publishedAt: '2026-08-07T10:00:00.000Z' };
}

describe('UT-027 recommendService 冷启动', () => {
  it('limit 越界 → 40002', async () => {
    const service = new RecommendService({} as any, {} as any, {} as any);
    expect((await service.getRecommendations(undefined, 0).catch((e) => e)).code).toBe(40002);
    expect((await service.getRecommendations('u_1', 51).catch((e) => e)).code).toBe(40002);
  });

  it('匿名（userId=undefined）与无阅读历史均回退热门 hot-fallback', async () => {
    const hotService: any = { getHotArticles: vi.fn().mockResolvedValue([hotItem('h1', 10), hotItem('h2', 5), hotItem('h3', 3)]) };
    const readingStatService: any = { getReadArticleIds: vi.fn().mockResolvedValue([]), getTagPreference: vi.fn() };
    const articleService: any = {};
    const service = new RecommendService(readingStatService, articleService, hotService);

    const anon = await service.getRecommendations(undefined, 10);
    expect(anon.every((i) => i.reason === 'hot-fallback')).toBe(true);

    const cold = await service.getRecommendations('u_0001', 10);
    expect(cold.every((i) => i.reason === 'hot-fallback')).toBe(true);

    expect(hotService.getHotArticles).toHaveBeenCalledTimes(2);
  });
});

describe('UT-057 recommendService 标签偏好', () => {
  it('按标签偏好推荐相似文章；排除已读并去重', async () => {
    const hotService: any = { getHotArticles: vi.fn() };
    const readingStatService: any = {
      getReadArticleIds: vi.fn().mockResolvedValue(['a_read']),
      getTagPreference: vi.fn().mockReturnValue([
        { tag: 'W模型', score: 5 },
        { tag: '其他', score: 2 },
      ]),
    };
    const articleService: any = {
      getArticlesByIds: vi.fn().mockResolvedValue([{ id: 'a_read', tags: ['W模型'] }]),
      findAllPublished: vi.fn().mockResolvedValue([
        { id: 'a_read', tags: ['W模型'], title: 'read', summary: 's' },
        { id: 'a_cand1', tags: ['W模型'], title: 'cand1', summary: 's' },
        { id: 'a_cand2', tags: ['W模型', '其他'], title: 'cand2', summary: 's' },
        { id: 'a_cand3', tags: ['其他'], title: 'cand3', summary: 's' },
      ]),
    };
    const service = new RecommendService(readingStatService, articleService, hotService);

    const result = await service.getRecommendations('u_0001', 10);

    expect(result.every((i) => i.reason === 'tag-preference')).toBe(true);
    expect(new Set(result.map((i) => i.articleId)).size).toBe(result.length);
    expect(result).not.toContainEqual(expect.objectContaining({ articleId: 'a_read' }));
    // a_cand2 命中 2 个偏好标签（5+2=7）> a_cand1（5）> a_cand3（2）
    expect(result.map((i) => i.articleId)).toEqual(['a_cand2', 'a_cand1', 'a_cand3']);
  });
});
