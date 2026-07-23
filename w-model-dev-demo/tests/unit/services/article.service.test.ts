/**
 * ArticleService 单元测试（UT-021~031）。
 * 真实 ArticleStore + CommentStore；作者隔离 + 评论聚合 + 越界校验。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleStore } from '../../../src/stores/article.store';
import { CommentStore } from '../../../src/stores/comment.store';
import { ArticleService } from '../../../src/services/article.service';
import {
  ForbiddenError,
  NotFoundError,
  BadRequestError,
  ErrorCode,
} from '../../../src/utils/errors';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('ArticleService', () => {
  let articleStore: ArticleStore;
  let commentStore: CommentStore;
  let articleService: ArticleService;

  beforeEach(() => {
    articleStore = new ArticleStore();
    commentStore = new CommentStore();
    articleService = new ArticleService(articleStore, commentStore);
  });

  it('UT-021 create 正常创建 authorId=JWT', async () => {
    const article = await articleService.create(
      { title: 'Hello', content: 'Body', tags: ['intro'] },
      'u1',
    );
    expect(article.id).toMatch(UUID_RE);
    expect(article.authorId).toBe('u1');
    expect(article.tags).toEqual(['intro']);
  });

  it('UT-022 update 作者匹配返回更新后', async () => {
    // 直接 insert 明确更早的 createdAt，保证 update 后 updatedAt（真实 now）> createdAt 严格成立
    articleStore.insert({
      id: 'a1',
      authorId: 'u1',
      title: 'Hello',
      content: 'Body',
      tags: [],
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
    });
    const updated = await articleService.update('a1', { title: 'v2' }, 'u1');
    expect(updated.title).toBe('v2');
    expect(updated.updatedAt > updated.createdAt).toBe(true);
  });

  it('UT-023 update 非作者抛 40301', async () => {
    const article = await articleService.create({ title: 'Hello', content: 'Body' }, 'alice');
    await expect(articleService.update(article.id, { title: 'v2' }, 'bob')).rejects.toThrow(
      ForbiddenError,
    );
    try {
      await articleService.update(article.id, { title: 'v2' }, 'bob');
    } catch (err) {
      expect((err as ForbiddenError).code).toBe(ErrorCode.FORBIDDEN);
    }
  });

  it('UT-024 update 文章不存在抛 40401', async () => {
    await expect(
      articleService.update('nope', { title: 'v2' }, 'u1'),
    ).rejects.toThrow(NotFoundError);
    try {
      await articleService.update('nope', { title: 'v2' }, 'u1');
    } catch (err) {
      expect((err as NotFoundError).code).toBe(ErrorCode.NOT_FOUND);
    }
  });

  it('UT-025 delete 作者匹配返回 void', async () => {
    const article = await articleService.create({ title: 'Hello', content: 'Body' }, 'u1');
    await expect(articleService.delete(article.id, 'u1')).resolves.toBeUndefined();
    expect(articleStore.findById(article.id)).toBeNull();
  });

  it('UT-026 delete 非作者抛 40301', async () => {
    const article = await articleService.create({ title: 'Hello', content: 'Body' }, 'alice');
    await expect(articleService.delete(article.id, 'bob')).rejects.toThrow(ForbiddenError);
    try {
      await articleService.delete(article.id, 'bob');
    } catch (err) {
      expect((err as ForbiddenError).code).toBe(ErrorCode.FORBIDDEN);
    }
  });

  it('UT-027 delete 文章不存在抛 40401', async () => {
    await expect(articleService.delete('nope', 'u1')).rejects.toThrow(NotFoundError);
    try {
      await articleService.delete('nope', 'u1');
    } catch (err) {
      expect((err as NotFoundError).code).toBe(ErrorCode.NOT_FOUND);
    }
  });

  it('UT-028 getById 存在返回文章+评论聚合', async () => {
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
    const detail = await articleService.getById(article.id);
    expect(detail.id).toBe(article.id);
    expect(detail.comments.length).toBe(2);
    expect(detail.comments[0].createdAt < detail.comments[1].createdAt).toBe(true);
  });

  it('UT-029 getById 不存在抛 40401', async () => {
    await expect(articleService.getById('nope')).rejects.toThrow(NotFoundError);
    try {
      await articleService.getById('nope');
    } catch (err) {
      expect((err as NotFoundError).code).toBe(ErrorCode.NOT_FOUND);
    }
  });

  it('UT-030 list 正常分页按 createdAt 降序', async () => {
    // 直接 insert 3 篇控制 createdAt，保证降序可断言
    articleStore.insert({
      id: 'x1',
      authorId: 'u1',
      title: 't1',
      content: 'c',
      tags: [],
      createdAt: '2026-07-23T01:00:00.000Z',
      updatedAt: '2026-07-23T01:00:00.000Z',
    });
    articleStore.insert({
      id: 'x2',
      authorId: 'u1',
      title: 't2',
      content: 'c',
      tags: [],
      createdAt: '2026-07-23T03:00:00.000Z',
      updatedAt: '2026-07-23T03:00:00.000Z',
    });
    articleStore.insert({
      id: 'x3',
      authorId: 'u1',
      title: 't3',
      content: 'c',
      tags: [],
      createdAt: '2026-07-23T02:00:00.000Z',
      updatedAt: '2026-07-23T02:00:00.000Z',
    });
    const page = await articleService.list(1, 2);
    expect(page.items.length).toBe(2);
    expect(page.total).toBe(3);
    expect(page.items[0].createdAt > page.items[1].createdAt).toBe(true);
  });

  it('UT-031 list 越界抛 40001', async () => {
    // list 为 async，须用 rejects.toThrow 捕获 rejected promise
    await expect(articleService.list(0, 10)).rejects.toThrow(BadRequestError);
    try {
      await articleService.list(0, 10);
    } catch (err) {
      expect((err as BadRequestError).code).toBe(ErrorCode.BAD_REQUEST);
    }
    await expect(articleService.list(1, 200)).rejects.toThrow(BadRequestError);
  });
});
