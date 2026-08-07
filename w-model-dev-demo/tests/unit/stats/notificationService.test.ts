/**
 * UT-033 评论事件产生被回复通知（notificationService.onCommentCreated，DD-033/INTF-020）
 */
import { describe, it, expect, vi } from 'vitest';
import { NotificationStore } from '../../../src/stores/notificationStore';
import { NotificationService } from '../../../src/services/stats/notificationService';

describe('UT-033 notificationService.onCommentCreated', () => {
  it('订阅 comment.created → 文章作者收到 REPLY 通知（未读）', () => {
    const create = vi.fn();
    const notificationStore: any = { create };
    const authService: any = { getUserById: vi.fn() };
    const service = new NotificationService(notificationStore, authService);

    service.onCommentCreated({
      type: 'comment.created',
      articleId: 'a_1001',
      commentId: 'cm_1',
      authorId: 'u_0001',
      authorName: 'reader1',
      articleAuthorId: 'u_0002',
      parentId: null,
      content: '不错的文章',
    });

    expect(create).toHaveBeenCalledTimes(1);
    const created = create.mock.calls[0][0];
    expect(created.type).toBe('REPLY');
    expect(created.userId).toBe('u_0002');
    expect(created.read).toBe(false);
    expect(created.actorName).toBe('reader1');
  });

  it('回复者即文章作者时不产生通知', () => {
    const create = vi.fn();
    const service = new NotificationService({ create } as any, {} as any);
    service.onCommentCreated({
      type: 'comment.created',
      articleId: 'a_1001',
      commentId: 'cm_2',
      authorId: 'u_0002',
      authorName: '博主',
      articleAuthorId: 'u_0002',
      parentId: null,
      content: '自评',
    });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('notificationService 其余事件与列表/已读', () => {
  it('onArticlePublished：为粉丝生成 NEW_ARTICLE 通知', () => {
    const create = vi.fn();
    const service = new NotificationService({ create } as any, {} as any);
    service.onArticlePublished({
      type: 'article.published',
      articleId: 'a_1001',
      authorId: 'u_0002',
      authorName: '博主',
      title: '新文章',
      publishedAt: '2026-08-07T10:00:00.000Z',
      followerIds: ['u_0003', 'u_0004'],
    });
    expect(create).toHaveBeenCalledTimes(2);
    const first = create.mock.calls[0][0];
    expect(first.type).toBe('NEW_ARTICLE');
    expect(first.userId).toBe('u_0003');
    expect(first.read).toBe(false);
  });

  it('onArticleLiked：文章作者收到 LIKE 通知（actor 名经 authService）', async () => {
    const create = vi.fn();
    const authService: any = { getUserById: vi.fn().mockResolvedValue({ id: 'u_0001', username: 'reader1' }) };
    const service = new NotificationService({ create } as any, authService);
    await service.onArticleLiked({ type: 'article.liked', articleId: 'a_1001', userId: 'u_0001', articleAuthorId: 'u_0002' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ type: 'LIKE', userId: 'u_0002', actorName: 'reader1', read: false }));
  });

  it('onFollowCreated：followee 收到 NEW_FOLLOWER 通知', () => {
    const create = vi.fn();
    const service = new NotificationService({ create } as any, {} as any);
    service.onFollowCreated({ type: 'follow.created', followerId: 'u_0001', followerName: 'reader1', followeeId: 'u_0002' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ type: 'NEW_FOLLOWER', userId: 'u_0002', actorName: 'reader1' }));
  });

  it('listNotifications：分页列表；markNotificationRead：本人可读（幂等）、他人 40401 防枚举', async () => {
    const store = new NotificationStore();
    store.create({ id: 'n_1', userId: 'u_0001', type: 'REPLY', articleId: 'a_1', actorId: 'u_2', actorName: 'x', content: 'c', read: false, createdAt: '2026-08-07T10:00:00.000Z' });
    store.create({ id: 'n_2', userId: 'u_0002', type: 'LIKE', articleId: 'a_1', actorId: 'u_1', actorName: 'y', content: 'z', read: false, createdAt: '2026-08-07T10:01:00.000Z' });
    const service = new NotificationService(store, {} as any);

    const page = service.listNotifications('u_0001', 1, 20);
    expect(page.total).toBe(1);

    const marked = await service.markNotificationRead('u_0001', 'n_1');
    expect(marked.read).toBe(true);
    expect((await service.markNotificationRead('u_0001', 'n_1')).read).toBe(true); // 幂等

    expect((await service.markNotificationRead('u_0001', 'n_2').catch((e) => e)).code).toBe(40401); // 他人通知防枚举
  });
});
