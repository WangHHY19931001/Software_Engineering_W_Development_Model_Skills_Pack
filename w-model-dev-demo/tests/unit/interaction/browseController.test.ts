/**
 * UT-014 草稿文章对读者不可见（BrowseController.getArticle，DD-014/INTF-011）
 */
import { describe, it, expect, vi } from 'vitest';
import { BrowseController } from '../../../src/routes/interaction/browseController';
import { BizError } from '../../../src/utils/errors';
import { makeReq, makeRes, makeNext } from '../helpers';

describe('UT-014 BrowseController.getArticle', () => {
  it('草稿/归档详情统一 40402 防枚举', async () => {
    const articleBrowseService: any = { getPublishedArticleDetail: vi.fn().mockRejectedValue(new BizError(40402)) };
    const likeService: any = { countLikes: vi.fn(), countFavorites: vi.fn() };
    const readingStatService: any = { getViewCount: vi.fn(() => 0) };
    const authService: any = { getUserById: vi.fn() };
    const controller = new BrowseController(articleBrowseService, likeService, readingStatService, authService);
    const req = makeReq({ params: { id: 'a_draft' }, ip: '127.0.0.1' });
    const res = makeRes();

    await controller.getArticle(req, res, makeNext());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 40402 }) }));
  });

  it('已发布详情返回 200（正文+作者+阅读量）', async () => {
    const articleBrowseService: any = {
      getPublishedArticleDetail: vi.fn().mockResolvedValue({
        article: { id: 'a_1001', authorId: 'u_0002', title: 't', body: 'b', summary: 's', tags: [], categoryId: null, publishedAt: '2026-08-07T10:00:00.000Z' },
        viewCount: 3,
      }),
    };
    const likeService: any = { countLikes: vi.fn(() => 5), countFavorites: vi.fn(() => 2) };
    const readingStatService: any = { getViewCount: vi.fn(() => 3) };
    const authService: any = { getUserById: vi.fn().mockResolvedValue({ userId: 'u_0002', username: '博主', bio: 'hi' }) };
    const controller = new BrowseController(articleBrowseService, likeService, readingStatService, authService);
    const req = makeReq({ params: { id: 'a_1001' }, ip: '127.0.0.1' });
    const res = makeRes();

    await controller.getArticle(req, res, makeNext());

    // Express 默认 200（控制器不显式调 status(200)），断言响应体数据正确
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ articleId: 'a_1001', viewCount: 3, likeCount: 5, favoriteCount: 2 }),
      }),
    );
  });
});

describe('BrowseController listArticles', () => {
  it('组合筛选参数透传 + 列表项聚合 viewCount/likeCount/favoriteCount', async () => {
    const articleBrowseService: any = {
      listPublishedArticles: vi.fn().mockResolvedValue({
        items: [{ id: 'a_1001', authorId: 'u_0002', title: 't', summary: 's', tags: [], categoryId: 'c_1', publishedAt: '2026-08-07T10:00:00.000Z' }],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
    };
    const likeService: any = { countLikes: vi.fn(() => 5), countFavorites: vi.fn(() => 2) };
    const readingStatService: any = { getViewCount: vi.fn(() => 3) };
    const authService: any = { getUserById: vi.fn().mockResolvedValue({ id: 'u_0002', username: '博主' }) };
    const controller = new BrowseController(articleBrowseService, likeService, readingStatService, authService);

    const res = makeRes();
    await controller.listArticles(makeReq({ query: { categoryId: 'c_1', tag: 'W模型', keyword: 'k', page: '1', pageSize: '20' } }), res, makeNext());

    expect(articleBrowseService.listPublishedArticles).toHaveBeenCalledWith(
      { categoryId: 'c_1', tag: 'W模型', keyword: 'k' },
      1,
      20,
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total: 1,
          items: [
            expect.objectContaining({ articleId: 'a_1001', viewCount: 3, likeCount: 5, favoriteCount: 2 }),
          ],
        }),
      }),
    );
  });
});
