import { describe, it, expect, beforeEach } from 'vitest';
import { CommentService } from '../../src/services/comment.service.js';
import { ArticleService } from '../../src/services/article.service.js';
import { commentStore } from '../../src/stores/comment.store.js';
import { ForbiddenError, NotFoundError } from '../../src/utils/errors.js';
import type { Article } from '../../src/types.js';

describe('UT-026 ~ UT-029: CommentService', () => {
  let article: Article;

  beforeEach(async () => {
    commentStore.clear();
    article = await ArticleService.create('u1', {
      title: 'T1',
      content: 'C1',
    });
  });

  it('UT-026: create 文章存在 → 返回 Comment', async () => {
    const comment = await CommentService.create('u1', article.id, { content: 'Hello' });
    expect(comment.id).toBeTruthy();
    expect(comment.articleId).toBe(article.id);
    expect(comment.authorId).toBe('u1');
    expect(comment.content).toBe('Hello');
    expect(comment.createdAt).toBeTruthy();
  });

  it('UT-027: create 文章不存在 → NotFoundError(40401)', async () => {
    await expect(
      CommentService.create('u1', 'non-existent', { content: 'Hello' }),
    ).rejects.toThrow(NotFoundError);
    try {
      await CommentService.create('u1', 'non-existent', { content: 'Hello' });
    } catch (e) {
      expect((e as NotFoundError).code).toBe(40401);
    }
  });

  it('UT-028: remove 作者本人 → 无返回；commentStore.size 减 1', async () => {
    const comment = await CommentService.create('u1', article.id, { content: 'Hello' });
    expect(commentStore.size()).toBe(1);
    await CommentService.remove('u1', comment.id);
    expect(commentStore.size()).toBe(0);
  });

  it('UT-029: remove 非作者 → ForbiddenError(40301)', async () => {
    const comment = await CommentService.create('u1', article.id, { content: 'Hello' });
    await expect(CommentService.remove('u2', comment.id)).rejects.toThrow(ForbiddenError);
    try {
      await CommentService.remove('u2', comment.id);
    } catch (e) {
      expect((e as ForbiddenError).code).toBe(40301);
    }
  });

  it('补充: remove 评论不存在 → NotFoundError(40401)', async () => {
    await expect(CommentService.remove('u1', 'non-existent')).rejects.toThrow(NotFoundError);
  });

  it('补充: listByArticle 返回评论按 createdAt 升序', async () => {
    await CommentService.create('u1', article.id, { content: 'C1' });
    await new Promise((r) => setTimeout(r, 5));
    await CommentService.create('u1', article.id, { content: 'C2' });
    const list = await CommentService.listByArticle(article.id);
    expect(list.length).toBe(2);
    expect(list[0].content).toBe('C1');
    expect(list[1].content).toBe('C2');
  });

  it('补充: listByArticle 不存在的文章 → 空数组', async () => {
    const list = await CommentService.listByArticle('non-existent');
    expect(list).toEqual([]);
  });
});
