import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArticleStore } from '../../src/stores/article.store.js';
import { CommentStore } from '../../src/stores/comment.store.js';
import { ArticleService } from '../../src/services/article.service.js';
import { ForbiddenError, NotFoundError } from '../../src/utils/errors.js';
import type { Article } from '../../src/types.js';

/**
 * UT-007 ~ UT-017：ArticleService 单元测试。
 * 设计来源：docs/detailed-design.md §4.1
 */
describe('ArticleService', () => {
  let articleStore: ArticleStore;
  let commentStore: CommentStore;
  let articleService: ArticleService;

  beforeEach(() => {
    articleStore = new ArticleStore();
    commentStore = new CommentStore();
    articleService = new ArticleService(articleStore, commentStore);
  });

  // UT-007: 成功创建文章
  it('UT-007: 创建文章返回 UUID + authorId 来自参数', () => {
    const result = articleService.create('u-1', { title: 'T', content: 'C', tags: ['x'] });

    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.authorId).toBe('u-1');
    expect(result.title).toBe('T');
    expect(result.content).toBe('C');
    expect(result.tags).toEqual(['x']);
  });

  // UT-008: authorId 来自参数而非 body
  it('UT-008: authorId 来自参数，存储中 authorId 一致', () => {
    const result = articleService.create('u-1', { title: 'T', content: 'C' });

    expect(result.authorId).toBe('u-1');
    expect(articleStore.findById(result.id)?.authorId).toBe('u-1');
  });

  // UT-009: 成功更新自己的文章，未更新字段保持不变
  it('UT-009: 作者更新自己的文章，updatedAt > createdAt，未更新字段保持不变', () => {
    vi.useFakeTimers();
    const t0 = new Date('2026-01-01T00:00:00.000Z').getTime();
    vi.setSystemTime(t0);
    const created = articleService.create('u-1', { title: 'T', content: 'C', tags: ['old'] });

    vi.setSystemTime(t0 + 1000);
    const result = articleService.update('u-1', created.id, { title: 'T2' });

    expect(result.title).toBe('T2');
    expect(result.updatedAt > result.createdAt).toBe(true);
    expect(result.content).toBe('C');
    expect(result.tags).toEqual(['old']);
    vi.useRealTimers();
  });

  // UT-010: 非作者更新 → 40301
  it('UT-010: 非作者更新抛 ForbiddenError(40301)', () => {
    const created = articleService.create('u-1', { title: 'T', content: 'C' });

    try {
      articleService.update('u-2', created.id, { title: 'T2' });
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).code).toBe(40301);
    }
  });

  // UT-011: 文章不存在 → 40401
  it('UT-011: 更新不存在的文章抛 NotFoundError(40401)', () => {
    try {
      articleService.update('u-1', 'non-existent', { title: 'T2' });
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
      expect((err as NotFoundError).code).toBe(40401);
    }
  });

  // UT-012: 成功删除自己的文章，评论级联删除
  it('UT-012: 作者删除自己的文章，文章与关联评论均被删除', () => {
    const article = articleService.create('u-1', { title: 'T', content: 'C' });
    commentStore.save({
      id: 'c-1',
      articleId: article.id,
      authorId: 'u-2',
      content: 'Nice',
      createdAt: new Date().toISOString(),
    });

    articleService.delete('u-1', article.id);

    expect(articleStore.findById(article.id)).toBeUndefined();
    expect(commentStore.findByArticleId(article.id)).toHaveLength(0);
  });

  // UT-013: 非作者删除 → 40301
  it('UT-013: 非作者删除抛 ForbiddenError(40301)', () => {
    const created = articleService.create('u-1', { title: 'T', content: 'C' });

    try {
      articleService.delete('u-2', created.id);
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).code).toBe(40301);
    }
  });

  // UT-014: 找到文章 + 聚合评论（按 createdAt 升序）
  it('UT-014: getById 返回文章 + 评论列表（升序），2 条评论', () => {
    const article = articleService.create('u-1', { title: 'T', content: 'C' });
    const baseTime = new Date('2026-01-01T00:00:00.000Z').getTime();
    commentStore.save({
      id: 'c-2',
      articleId: article.id,
      authorId: 'u-2',
      content: 'Second',
      createdAt: new Date(baseTime + 2000).toISOString(),
    });
    commentStore.save({
      id: 'c-1',
      articleId: article.id,
      authorId: 'u-3',
      content: 'First',
      createdAt: new Date(baseTime + 1000).toISOString(),
    });

    const result = articleService.getById(article.id);

    expect(result.id).toBe(article.id);
    expect(result.comments).toHaveLength(2);
    expect(result.comments[0].createdAt <= result.comments[1].createdAt).toBe(true);
    expect(result.comments[0].id).toBe('c-1');
    expect(result.comments[1].id).toBe('c-2');
  });

  // UT-015: 文章不存在 → 40401
  it('UT-015: getById 不存在抛 NotFoundError(40401)', () => {
    try {
      articleService.getById('non-existent');
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
      expect((err as NotFoundError).code).toBe(40401);
    }
  });

  // UT-016: 分页正确（15 篇文章，page=1, pageSize=10）
  it('UT-016: 15 篇文章 page=1 pageSize=10 返回 10 条 + total=15', () => {
    const baseTime = new Date('2026-01-01T00:00:00.000Z').getTime();
    for (let i = 0; i < 15; i++) {
      const a: Article = {
        id: `a-${i}`,
        authorId: 'u-1',
        title: `T-${i}`,
        content: 'C',
        tags: [],
        createdAt: new Date(baseTime + i * 1000).toISOString(),
        updatedAt: new Date(baseTime + i * 1000).toISOString(),
      };
      articleStore.save(a);
    }

    const result = articleService.list({ page: 1, pageSize: 10 });

    expect(result.items).toHaveLength(10);
    expect(result.total).toBe(15);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  // UT-017: 空存储返回空列表
  it('UT-017: 空存储 list 返回空数组 + total=0', () => {
    const result = articleService.list({ page: 1, pageSize: 10 });

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('UT-017-extra: tag 过滤生效', () => {
    const now = new Date().toISOString();
    articleStore.save({
      id: 'a-1',
      authorId: 'u-1',
      title: 'T1',
      content: 'C',
      tags: ['intro'],
      createdAt: now,
      updatedAt: now,
    });
    articleStore.save({
      id: 'a-2',
      authorId: 'u-1',
      title: 'T2',
      content: 'C',
      tags: ['tech'],
      createdAt: now,
      updatedAt: now,
    });

    const result = articleService.list({ page: 1, pageSize: 10, tag: 'intro' });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe('a-1');
  });
});
