import { describe, it, expect, beforeEach } from 'vitest';
import { userStore } from '../../src/stores/user.store.js';
import { articleStore } from '../../src/stores/article.store.js';
import { commentStore } from '../../src/stores/comment.store.js';
import type { User, Article, Comment } from '../../src/types.js';

describe('stores', () => {
  beforeEach(() => {
    userStore.clear();
    articleStore.clear();
    commentStore.clear();
  });

  describe('userStore', () => {
    it('save → findById / findByUsername 查询', () => {
      const user: User = {
        id: 'u1',
        username: 'alice',
        passwordHash: '$2b$10$abc',
        createdAt: new Date().toISOString(),
      };
      userStore.save(user);
      expect(userStore.findById('u1')).toEqual(user);
      expect(userStore.findByUsername('alice')).toEqual(user);
    });

    it('findById 不存在 → undefined', () => {
      expect(userStore.findById('non-existent')).toBeUndefined();
    });

    it('findByUsername 不存在 → undefined', () => {
      expect(userStore.findByUsername('non-existent')).toBeUndefined();
    });

    it('clear → size 归零', () => {
      const user: User = {
        id: 'u1',
        username: 'alice',
        passwordHash: '$2b$10$abc',
        createdAt: new Date().toISOString(),
      };
      userStore.save(user);
      expect(userStore.size()).toBe(1);
      userStore.clear();
      expect(userStore.size()).toBe(0);
    });
  });

  describe('articleStore', () => {
    function makeArticle(id: string, title: string, createdAt: string): Article {
      return {
        id,
        title,
        content: 'C',
        authorId: 'u1',
        createdAt,
        updatedAt: createdAt,
      };
    }

    it('save → findById 查询', () => {
      const a = makeArticle('a1', 'T1', '2026-01-01T00:00:00Z');
      articleStore.save(a);
      expect(articleStore.findById('a1')).toEqual(a);
    });

    it('findById 不存在 → undefined', () => {
      expect(articleStore.findById('non-existent')).toBeUndefined();
    });

    it('findAll 按 createdAt 降序排列', () => {
      articleStore.save(makeArticle('a1', 'T1', '2026-01-01T00:00:00Z'));
      articleStore.save(makeArticle('a2', 'T2', '2026-02-01T00:00:00Z'));
      articleStore.save(makeArticle('a3', 'T3', '2026-01-15T00:00:00Z'));
      const result = articleStore.findAll(1, 10);
      expect(result.total).toBe(3);
      expect(result.items.map((a) => a.id)).toEqual(['a2', 'a3', 'a1']);
    });

    it('findAll 分页：page=1,pageSize=2', () => {
      articleStore.save(makeArticle('a1', 'T1', '2026-01-01T00:00:00Z'));
      articleStore.save(makeArticle('a2', 'T2', '2026-02-01T00:00:00Z'));
      articleStore.save(makeArticle('a3', 'T3', '2026-01-15T00:00:00Z'));
      const r1 = articleStore.findAll(1, 2);
      expect(r1.items.length).toBe(2);
      expect(r1.total).toBe(3);
      const r2 = articleStore.findAll(2, 2);
      expect(r2.items.length).toBe(1);
    });

    it('findAll 空存储 → {items:[], total:0}', () => {
      const r = articleStore.findAll(1, 10);
      expect(r.items).toEqual([]);
      expect(r.total).toBe(0);
    });

    it('delete → boolean', () => {
      articleStore.save(makeArticle('a1', 'T1', '2026-01-01T00:00:00Z'));
      expect(articleStore.delete('a1')).toBe(true);
      expect(articleStore.delete('a1')).toBe(false);
    });

    it('clear → size 归零', () => {
      articleStore.save(makeArticle('a1', 'T1', '2026-01-01T00:00:00Z'));
      expect(articleStore.size()).toBe(1);
      articleStore.clear();
      expect(articleStore.size()).toBe(0);
    });
  });

  describe('commentStore', () => {
    function makeComment(id: string, articleId: string, createdAt: string): Comment {
      return {
        id,
        articleId,
        authorId: 'u1',
        content: 'C',
        createdAt,
      };
    }

    it('save → findById 查询', () => {
      const c = makeComment('c1', 'a1', '2026-01-01T00:00:00Z');
      commentStore.save(c);
      expect(commentStore.findById('c1')).toEqual(c);
    });

    it('findById 不存在 → undefined', () => {
      expect(commentStore.findById('non-existent')).toBeUndefined();
    });

    it('findByArticleId 过滤 + createdAt 升序', () => {
      commentStore.save(makeComment('c1', 'a1', '2026-02-01T00:00:00Z'));
      commentStore.save(makeComment('c2', 'a2', '2026-01-01T00:00:00Z'));
      commentStore.save(makeComment('c3', 'a1', '2026-01-15T00:00:00Z'));
      const list = commentStore.findByArticleId('a1');
      expect(list.map((c) => c.id)).toEqual(['c3', 'c1']);
    });

    it('findByArticleId 无匹配 → 空数组', () => {
      commentStore.save(makeComment('c1', 'a1', '2026-01-01T00:00:00Z'));
      const list = commentStore.findByArticleId('a2');
      expect(list).toEqual([]);
    });

    it('delete → boolean', () => {
      commentStore.save(makeComment('c1', 'a1', '2026-01-01T00:00:00Z'));
      expect(commentStore.delete('c1')).toBe(true);
      expect(commentStore.delete('c1')).toBe(false);
    });

    it('clear → size 归零', () => {
      commentStore.save(makeComment('c1', 'a1', '2026-01-01T00:00:00Z'));
      expect(commentStore.size()).toBe(1);
      commentStore.clear();
      expect(commentStore.size()).toBe(0);
    });
  });
});
