/**
 * UT-021 评论列表按时间降序分页（CommentStore.listByArticle，DD-021/INTF-012）
 * UT-022 点赞计数正确（LikeStore.countByArticle，DD-022/INTF-011/013）
 * UT-023 收藏列表仅本人（FavoriteStore.listByUser，DD-023/INTF-013）
 * UT-024 无关注关系返回空列表（FollowStore，DD-024/INTF-014）
 */
import { describe, it, expect } from 'vitest';
import { CommentStore } from '../../../src/stores/commentStore';
import { LikeStore } from '../../../src/stores/likeStore';
import { FavoriteStore } from '../../../src/stores/favoriteStore';
import { FollowStore } from '../../../src/stores/followStore';

describe('UT-021 CommentStore.listByArticle', () => {
  it('createdAt 降序 + 分页 total 正确', () => {
    const store = new CommentStore();
    store.create({ id: 'c1', articleId: 'a_1001', authorId: 'u_0001', parentId: null, content: 't1', createdAt: '2026-08-07T10:00:00.000Z' });
    store.create({ id: 'c2', articleId: 'a_1001', authorId: 'u_0001', parentId: null, content: 't2', createdAt: '2026-08-07T10:01:00.000Z' });
    store.create({ id: 'c3', articleId: 'a_1001', authorId: 'u_0001', parentId: null, content: 't3', createdAt: '2026-08-07T10:02:00.000Z' });

    const result = store.listByArticle('a_1001', 1, 2);
    expect(result.items[0].id).toBe('c3');
    expect(result.items[1].id).toBe('c2');
    expect(result.total).toBe(3);
  });
});

describe('UT-022 LikeStore.countByArticle', () => {
  it('多用户点赞计数聚合；无点赞返回 0', () => {
    const store = new LikeStore();
    for (const userId of ['u_0001', 'u_0002', 'u_0003']) {
      store.add({ userId, articleId: 'a_1001', createdAt: new Date().toISOString() });
    }
    expect(store.countByArticle('a_1001')).toBe(3);
    expect(store.countByArticle('a_9999')).toBe(0);
  });
});

describe('UT-023 FavoriteStore.listByUser', () => {
  it('只返回指定用户收藏（他人收藏不可见）', () => {
    const store = new FavoriteStore();
    store.add({ userId: 'u_0001', articleId: 'a_1001', createdAt: '2026-08-07T10:00:00.000Z' });
    store.add({ userId: 'u_0001', articleId: 'a_1002', createdAt: '2026-08-07T10:01:00.000Z' });
    store.add({ userId: 'u_0002', articleId: 'a_1003', createdAt: '2026-08-07T10:02:00.000Z' });

    const result = store.listByUser('u_0001', 1, 20);
    expect(result.total).toBe(2);
    expect(result.items.every((f) => f.userId === 'u_0001')).toBe(true);
  });
});

describe('UT-024 FollowStore', () => {
  it('follower 无任何关注 → 空列表（不抛异常）', () => {
    const store = new FollowStore();
    expect(store.listFolloweeIdsByFollower('u_0001')).toEqual([]);
    expect(store.listFollowers('u_0002')).toEqual([]);
  });
});

describe('互动域 store 补充（Comment/Like/Favorite/Follow）', () => {
  it('CommentStore：listReplies / countByArticleIds / delete 级联', () => {
    const store = new CommentStore();
    store.create({ id: 'cm_1', articleId: 'a_1', authorId: 'u_1', parentId: null, content: 'x', createdAt: '2026-08-07T10:00:00.000Z' });
    store.create({ id: 'cm_2', articleId: 'a_1', authorId: 'u_2', parentId: 'cm_1', content: '回复', createdAt: '2026-08-07T10:01:00.000Z' });
    store.create({ id: 'cm_3', articleId: 'a_2', authorId: 'u_1', parentId: null, content: 'y', createdAt: '2026-08-07T10:02:00.000Z' });

    expect(store.listReplies('cm_1')).toHaveLength(1);
    const counts = store.countByArticleIds(['a_1', 'a_2']);
    expect(counts.get('a_1')).toBe(2);
    expect(counts.get('a_2')).toBe(1);

    store.delete('cm_1'); // 级联删除回复
    expect(store.findById('cm_1')).toBeNull();
    expect(store.findById('cm_2')).toBeNull();
    expect(store.findById('cm_3')).not.toBeNull();
  });

  it('LikeStore：add 幂等 / remove / findByUserAndArticle / listByArticle', () => {
    const store = new LikeStore();
    const first = store.add({ userId: 'u_1', articleId: 'a_1', createdAt: '2026-08-07T10:00:00.000Z' });
    const second = store.add({ userId: 'u_1', articleId: 'a_1', createdAt: '2026-08-07T10:01:00.000Z' });
    expect(second.id).toBe(first.id); // 幂等返回既有
    expect(store.listByArticle('a_1')).toHaveLength(1);
    expect(store.findByUserAndArticle('u_1', 'a_1')?.id).toBe(first.id);
    expect(store.remove('u_1', 'a_1')).toBe(true);
    expect(store.remove('u_1', 'a_1')).toBe(false); // 幂等移除
    expect(store.countByArticle('a_1')).toBe(0);
  });

  it('FavoriteStore：add/remove/findByUserAndArticle/countByArticle', () => {
    const store = new FavoriteStore();
    store.add({ userId: 'u_1', articleId: 'a_1', createdAt: '2026-08-07T10:00:00.000Z' });
    expect(store.countByArticle('a_1')).toBe(1);
    expect(store.findByUserAndArticle('u_1', 'a_1')).not.toBeNull();
    expect(store.remove('u_1', 'a_1')).toBe(true);
    expect(store.countByArticle('a_1')).toBe(0);
  });

  it('FollowStore：add 幂等 / remove / findByFollowerAndFollowee / listFollowers', () => {
    const store = new FollowStore();
    const first = store.add({ followerId: 'u_1', followeeId: 'u_2', createdAt: '2026-08-07T10:00:00.000Z' });
    const second = store.add({ followerId: 'u_1', followeeId: 'u_2', createdAt: '2026-08-07T10:01:00.000Z' });
    expect(second.id).toBe(first.id);
    expect(store.findByFollowerAndFollowee('u_1', 'u_2')).not.toBeNull();
    expect(store.listFollowers('u_2')).toEqual(['u_1']);
    expect(store.remove('u_1', 'u_2')).toBe(true);
    expect(store.listFollowers('u_2')).toEqual([]);
  });
});
