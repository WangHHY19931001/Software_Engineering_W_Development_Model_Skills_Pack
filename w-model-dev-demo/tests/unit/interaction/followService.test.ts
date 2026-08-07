/**
 * UT-020 关注非博主被拒（followService.followBlogger，DD-020/INTF-014）
 */
import { describe, it, expect, vi } from 'vitest';
import { FollowStore } from '../../../src/stores/followStore';
import { FollowService } from '../../../src/services/interaction/followService';

describe('UT-020 followService.followBlogger', () => {
  it('followee 为 reader 角色 → 40002，FollowStore 无写入', async () => {
    const followStore = new FollowStore();
    const authService: any = { getUserById: vi.fn().mockResolvedValue({ id: 'u_0003', role: 'reader' }) };
    const articleService: any = { findAllPublished: vi.fn() };
    const eventBus: any = { emit: vi.fn() };
    const service = new FollowService(followStore, authService, articleService, eventBus);

    let error: any;
    try {
      await service.followBlogger('u_0001', 'u_0003');
    } catch (err) {
      error = err;
    }

    expect(error.code).toBe(40002);
    expect(error.httpStatus).toBe(400);
    expect(followStore.listFolloweeIdsByFollower('u_0001')).toEqual([]);
  });

  it('followee 不存在 → 40401', async () => {
    const authService: any = { getUserById: vi.fn().mockResolvedValue(null) };
    const service = new FollowService(new FollowStore(), authService, { findAllPublished: vi.fn() } as any, { emit: vi.fn() } as any);
    const error = await service.followBlogger('u_0001', 'u_9999').catch((e) => e);
    expect(error.code).toBe(40401);
  });

  it('关注成功：follow.created 事件 + followeeId 列表更新；重复关注幂等', async () => {
    const followStore = new FollowStore();
    const authService: any = {
      getUserById: vi.fn().mockImplementation(async (id: string) =>
        id === 'u_0002' ? { id: 'u_0002', role: 'blogger' } : { id: 'u_0001', role: 'reader', username: 'reader1' },
      ),
    };
    const eventBus: any = { emit: vi.fn() };
    const service = new FollowService(followStore, authService, {} as any, eventBus);

    const result = await service.followBlogger('u_0001', 'u_0002');
    expect(result.followeeId).toBe('u_0002');
    expect(eventBus.emit).toHaveBeenCalledWith('follow.created', expect.objectContaining({ followerId: 'u_0001', followeeId: 'u_0002' }));
    expect(followStore.listFolloweeIdsByFollower('u_0001')).toEqual(['u_0002']);

    const again = await service.followBlogger('u_0001', 'u_0002');
    expect(again.followedAt).toBe(result.followedAt); // 幂等返回既有
    expect(followStore.listFolloweeIdsByFollower('u_0001')).toHaveLength(1);
  });

  it('unfollowBlogger：幂等移除（feed 不再推送）', async () => {
    const followStore = new FollowStore();
    followStore.add({ followerId: 'u_0001', followeeId: 'u_0002', createdAt: new Date().toISOString() });
    const service = new FollowService(followStore, {} as any, {} as any, {} as any);
    await service.unfollowBlogger('u_0001', 'u_0002');
    expect(followStore.listFolloweeIdsByFollower('u_0001')).toEqual([]);
    await service.unfollowBlogger('u_0001', 'u_0002'); // 幂等
    expect(followStore.listFolloweeIdsByFollower('u_0001')).toEqual([]);
  });

  it('getFeed：无关注返回空分页；有关注返回已关注博主已发布文章（publishedAt 降序）', async () => {
    const followStore = new FollowStore();
    followStore.add({ followerId: 'u_0001', followeeId: 'u_0002', createdAt: new Date().toISOString() });
    followStore.add({ followerId: 'u_0001', followeeId: 'u_0003', createdAt: new Date().toISOString() });
    const authService: any = { getUserById: vi.fn().mockResolvedValue({ id: 'u_0002', username: '博主' }) };
    const articleService: any = {
      findAllPublished: vi.fn().mockResolvedValue([
        { id: 'a_1', authorId: 'u_0002', title: '新文章', summary: 's', publishedAt: '2026-08-07T10:00:00.000Z' },
        { id: 'a_2', authorId: 'u_0009', title: '他人', summary: 's', publishedAt: '2026-08-07T09:00:00.000Z' },
        { id: 'a_3', authorId: 'u_0003', title: '更早', summary: 's', publishedAt: '2026-08-07T08:00:00.000Z' },
      ]),
    };
    const service = new FollowService(followStore, authService, articleService, {} as any);

    const empty = await service.getFeed('u_9999', 1, 20);
    expect(empty.total).toBe(0);

    const feed = await service.getFeed('u_0001', 1, 20);
    expect(feed.total).toBe(2);
    expect(feed.items[0].articleId).toBe('a_1');
    expect(feed.items[1].articleId).toBe('a_3');
    expect(feed.items[0].author.username).toBe('博主');
  });
});
