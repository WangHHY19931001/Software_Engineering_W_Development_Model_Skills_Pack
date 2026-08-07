/**
 * UT-032 博主面板四项聚合与趋势补零（bloggerStatsService.getBloggerStats，DD-032/INTF-019）
 */
import { describe, it, expect, vi } from 'vitest';
import { BloggerStatsService } from '../../../src/services/stats/bloggerStatsService';

describe('UT-032 bloggerStatsService.getBloggerStats', () => {
  it('文章数/总阅读量/总评论数聚合 + 近 7 天趋势 7 项（无记录日期补 0）', async () => {
    const articleService: any = {
      countByAuthor: vi.fn().mockResolvedValue(5),
      findByAuthor: vi.fn().mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]),
    };
    const commentService: any = { countByArticleIds: vi.fn().mockResolvedValue(12) };
    const trend = [
      { date: '2026-08-01', views: 10 },
      { date: '2026-08-02', views: 20 },
      { date: '2026-08-03', views: 30 },
      { date: '2026-08-04', views: 0 },
      { date: '2026-08-05', views: 0 },
      { date: '2026-08-06', views: 0 },
      { date: '2026-08-07', views: 0 },
    ];
    const readingStatService: any = {
      getViewCount: vi.fn(() => 100),
      getTrend7d: vi.fn().mockReturnValue(trend),
    };
    const service = new BloggerStatsService(articleService, commentService, readingStatService);

    const result = await service.getBloggerStats('u_0002');

    expect(result.articleCount).toBe(5);
    expect(result.totalComments).toBe(12);
    expect(result.totalViews).toBe(200);
    expect(result.trend).toHaveLength(7);
    expect(result.trend.filter((t) => t.views === 0)).toHaveLength(4);
    expect(commentService.countByArticleIds).toHaveBeenCalledWith(['a1', 'a2']);
  });
});
