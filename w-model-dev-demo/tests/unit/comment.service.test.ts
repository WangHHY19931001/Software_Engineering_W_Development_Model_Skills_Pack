import { describe, it, expect, beforeEach } from 'vitest';
import { CommentStore } from '../../src/stores/comment.store.js';
import { ArticleStore } from '../../src/stores/article.store.js';
import { ArticleService } from '../../src/services/article.service.js';
import { CommentService } from '../../src/services/comment.service.js';
import { ForbiddenError, NotFoundError } from '../../src/utils/errors.js';

/**
 * UT-018 ~ UT-021：CommentService 单元测试。
 * 设计来源：docs/detailed-design.md §4.1
 */
describe('CommentService', () => {
  let commentStore: CommentStore;
  let articleStore: ArticleStore;
  let articleService: ArticleService;
  let commentService: CommentService;

  beforeEach(() => {
    commentStore = new CommentStore();
    articleStore = new ArticleStore();
    articleService = new ArticleService(articleStore, commentStore);
    commentService = new CommentService(commentStore, articleService);
  });

  // UT-018: 成功创建评论
  it('UT-018: 对已存在文章发表评论返回 UUID + authorId 来自参数', () => {
    const article = articleService.create('u-1', { title: 'T', content: 'C' });
    const result = commentService.create('u-1', article.id, 'Nice');

    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.authorId).toBe('u-1');
    expect(result.content).toBe('Nice');
    expect(result.articleId).toBe(article.id);
  });

  // UT-019: 文章不存在 → 40401
  it('UT-019: 对不存在文章发表评论抛 NotFoundError(40401)', () => {
    try {
      commentService.create('u-1', 'non-existent', 'Hi');
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
      expect((err as NotFoundError).code).toBe(40401);
    }
  });

  // UT-020: 成功删除自己的评论
  it('UT-020: 作者删除自己的评论，存储中已删除', () => {
    const article = articleService.create('u-1', { title: 'T', content: 'C' });
    const comment = commentService.create('u-1', article.id, 'Nice');

    commentService.delete('u-1', comment.id);

    expect(commentStore.findById(comment.id)).toBeUndefined();
  });

  // UT-021: 非作者删除 → 40301
  it('UT-021: 非作者删除评论抛 ForbiddenError(40301)', () => {
    const article = articleService.create('u-1', { title: 'T', content: 'C' });
    const comment = commentService.create('u-1', article.id, 'Nice');

    try {
      commentService.delete('u-2', comment.id);
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).code).toBe(40301);
    }
  });

  it('UT-021-extra: 删除不存在的评论抛 NotFoundError(40401)', () => {
    try {
      commentService.delete('u-1', 'non-existent');
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
      expect((err as NotFoundError).code).toBe(40401);
    }
  });

  it('UT-021-extra2: listByArticle 文章不存在抛 NotFoundError', () => {
    try {
      commentService.listByArticle('non-existent');
      throw new Error('should not reach');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
    }
  });
});
