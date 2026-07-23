/**
 * CommentService 单元测试（UT-032~037）。
 * 真实 CommentStore + ArticleService（真实 ArticleStore + CommentStore）。
 * create 通过 articleService.getById 校验文章存在性，不存在抛 40401 且无脏数据。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CommentStore } from '../../../src/stores/comment.store';
import { ArticleStore } from '../../../src/stores/article.store';
import { ArticleService } from '../../../src/services/article.service';
import { CommentService } from '../../../src/services/comment.service';
import {
  NotFoundError,
  ForbiddenError,
  ErrorCode,
} from '../../../src/utils/errors';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('CommentService', () => {
  let commentStore: CommentStore;
  let articleStore: ArticleStore;
  let commentService: CommentService;
  let articleService: ArticleService;

  beforeEach(() => {
    commentStore = new CommentStore();
    articleStore = new ArticleStore();
    articleService = new ArticleService(articleStore, commentStore);
    commentService = new CommentService(commentStore, articleService);
  });

  it('UT-032 create 文章存在返回评论', async () => {
    const article = await articleService.create({ title: 'Hello', content: 'Body' }, 'u1');
    const comment = await commentService.create(article.id, { content: 'Nice' }, 'u1');
    expect(comment.id).toMatch(UUID_RE);
    expect(comment.authorId).toBe('u1');
    expect(comment.articleId).toBe(article.id);
  });

  it('UT-033 create 文章不存在抛 40401 + 无脏数据', async () => {
    await expect(commentService.create('nope', { content: 'Nice' }, 'u1')).rejects.toThrow(
      NotFoundError,
    );
    try {
      await commentService.create('nope', { content: 'Nice' }, 'u1');
    } catch (err) {
      expect((err as NotFoundError).code).toBe(ErrorCode.NOT_FOUND);
    }
    expect(commentStore.size()).toBe(0);
  });

  it('UT-034 delete 作者匹配返回 void', async () => {
    const article = await articleService.create({ title: 'Hello', content: 'Body' }, 'u1');
    const comment = await commentService.create(article.id, { content: 'Nice' }, 'u1');
    await expect(commentService.delete(comment.id, 'u1')).resolves.toBeUndefined();
    expect(commentStore.findById(comment.id)).toBeNull();
  });

  it('UT-035 delete 非作者抛 40301', async () => {
    const article = await articleService.create({ title: 'Hello', content: 'Body' }, 'alice');
    const comment = await commentService.create(article.id, { content: 'Nice' }, 'alice');
    await expect(commentService.delete(comment.id, 'bob')).rejects.toThrow(ForbiddenError);
    try {
      await commentService.delete(comment.id, 'bob');
    } catch (err) {
      expect((err as ForbiddenError).code).toBe(ErrorCode.FORBIDDEN);
    }
  });

  it('UT-036 delete 评论不存在抛 40401', async () => {
    await expect(commentService.delete('nope', 'u1')).rejects.toThrow(NotFoundError);
    try {
      await commentService.delete('nope', 'u1');
    } catch (err) {
      expect((err as NotFoundError).code).toBe(ErrorCode.NOT_FOUND);
    }
  });

  it('UT-037 listByArticle 返回评论按 createdAt 升序', async () => {
    const article = await articleService.create({ title: 'Hello', content: 'Body' }, 'u1');
    commentStore.insert({
      id: 'c1',
      articleId: article.id,
      authorId: 'u1',
      content: 'second',
      createdAt: '2026-07-23T02:00:00.000Z',
    });
    commentStore.insert({
      id: 'c2',
      articleId: article.id,
      authorId: 'u1',
      content: 'first',
      createdAt: '2026-07-23T01:00:00.000Z',
    });
    const results = await commentService.listByArticle(article.id);
    expect(results.length).toBe(2);
    expect(results[0].createdAt < results[1].createdAt).toBe(true);
  });
});
