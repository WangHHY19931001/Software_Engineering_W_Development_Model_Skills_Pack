/**
 * UT-016 禁止自关注（InteractionController.followBlogger，DD-016/INTF-014）
 */
import { describe, it, expect, vi } from 'vitest';
import { InteractionController } from '../../../src/routes/interaction/interactionController';
import { FollowStore } from '../../../src/stores/followStore';
import { FollowService } from '../../../src/services/interaction/followService';
import { makeReq, makeRes, makeNext } from '../helpers';

describe('UT-016 InteractionController.followBlogger', () => {
  it('followerId === followeeId → 40002，FollowStore 无写入', async () => {
    const followStore = new FollowStore();
    const authService: any = { getUserById: vi.fn() };
    const articleService: any = { findAllPublished: vi.fn().mockResolvedValue([]) };
    const eventBus: any = { emit: vi.fn() };
    const followService = new FollowService(followStore, authService, articleService, eventBus);
    const likeService: any = {};
    const controller = new InteractionController(likeService, followService);

    const req = makeReq({ user: { userId: 'u_0001', role: 'reader' }, params: { id: 'u_0001' } });
    const res = makeRes();

    await controller.followBlogger(req, res, makeNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: 40002 }) }));
    expect(followStore.listFolloweeIdsByFollower('u_0001')).toEqual([]);
  });
});

describe('InteractionController 其余方法', () => {
  it('like/unlike/favorite/unfavorite/listMyFavorites/follow/unfollow/getFeed 成功透传', async () => {
    const likeService: any = {
      likeArticle: vi.fn().mockResolvedValue({ articleId: 'a_1', liked: true }),
      unlikeArticle: vi.fn().mockResolvedValue({ articleId: 'a_1', liked: false }),
      favoriteArticle: vi.fn().mockResolvedValue({ articleId: 'a_1', favorited: true }),
      unfavoriteArticle: vi.fn().mockResolvedValue({ articleId: 'a_1', favorited: false }),
      listMyFavorites: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    };
    const followService: any = {
      followBlogger: vi.fn().mockResolvedValue({ followerId: 'u_0001', followeeId: 'u_0002', followedAt: '2026-08-07T10:00:00.000Z' }),
      unfollowBlogger: vi.fn().mockResolvedValue(undefined),
      getFeed: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    };
    const controller = new InteractionController(likeService, followService);
    const req = makeReq({ user: { userId: 'u_0001', role: 'reader' }, params: { id: 'a_1' } });

    const res1 = makeRes();
    await controller.likeArticle(req, res1, makeNext());
    expect(likeService.likeArticle).toHaveBeenCalledWith('a_1', 'u_0001');

    const res2 = makeRes();
    await controller.unlikeArticle(req, res2, makeNext());
    expect(likeService.unlikeArticle).toHaveBeenCalledWith('a_1', 'u_0001');

    const res3 = makeRes();
    await controller.favoriteArticle(req, res3, makeNext());
    expect(likeService.favoriteArticle).toHaveBeenCalledWith('a_1', 'u_0001');

    const res4 = makeRes();
    await controller.unfavoriteArticle(req, res4, makeNext());
    expect(likeService.unfavoriteArticle).toHaveBeenCalledWith('a_1', 'u_0001');

    const res5 = makeRes();
    await controller.listMyFavorites(makeReq({ user: { userId: 'u_0001', role: 'reader' }, query: { page: '1', pageSize: '20' } }), res5, makeNext());
    expect(likeService.listMyFavorites).toHaveBeenCalledWith('u_0001', 1, 20);

    const reqFollow = makeReq({ user: { userId: 'u_0001', role: 'reader' }, params: { id: 'u_0002' } });
    const res6 = makeRes();
    await controller.followBlogger(reqFollow, res6, makeNext());
    expect(followService.followBlogger).toHaveBeenCalledWith('u_0001', 'u_0002');
    expect(res6.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ followerId: 'u_0001', followeeId: 'u_0002' }) }));

    const res7 = makeRes();
    await controller.unfollowBlogger(reqFollow, res7, makeNext());
    expect(res7.json).toHaveBeenCalledWith(expect.objectContaining({ data: { unfollowed: true } }));

    const res8 = makeRes();
    await controller.getFeed(makeReq({ user: { userId: 'u_0001', role: 'reader' }, query: { page: '1', pageSize: '20' } }), res8, makeNext());
    expect(followService.getFeed).toHaveBeenCalledWith('u_0001', 1, 20);
  });
});
