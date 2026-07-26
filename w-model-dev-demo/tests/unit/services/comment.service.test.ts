import { describe, it, expect, beforeEach } from 'vitest';
import { CommentService } from '../../../src/services/comment.service.js';
import { CommentStore } from '../../../src/stores/comment.store.js';
import { ArticleStore } from '../../../src/stores/article.store.js';
import { AuthorizationError, NotFoundError, ValidationError } from '../../../src/utils/errors.js';

describe('CommentService (DD-010-002 / DD-011-002 / DD-012-002)', () => {
  let commentStore: CommentStore;
  let articleStore: ArticleStore;
  let svc: CommentService;

  beforeEach(() => {
    commentStore = new CommentStore();
    articleStore = new ArticleStore();
    svc = new CommentService(commentStore, articleStore);
  });

  it('TC-UNIT-032N: create 在 published 文章下评论成功', () => {
    const a = articleStore.insert({ title: 't', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'published', publishedAt: null });
    const c = svc.create(a.id, 'u2', 'hello');
    expect(c.id).toBeTruthy();
    expect(c.content).toBe('hello');
  });

  it('TC-UNIT-032E: create 文章不存在抛 NotFoundError', () => {
    expect(() => svc.create('missing', 'u2', 'hi')).toThrow(NotFoundError);
  });

  it('TC-UNIT-032B: create 草稿文章抛 ValidationError', () => {
    const a = articleStore.insert({ title: 't', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'draft', publishedAt: null });
    expect(() => svc.create(a.id, 'u2', 'hi')).toThrow(ValidationError);
  });

  it('remove: 非作者非 admin 抛 AuthorizationError', () => {
    const a = articleStore.insert({ title: 't', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'published', publishedAt: null });
    const c = svc.create(a.id, 'u2', 'hi');
    expect(() => svc.remove(c.id, 'u3', 'reader')).toThrow(AuthorizationError);
  });

  it('remove: admin 删除他人评论', () => {
    const a = articleStore.insert({ title: 't', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'published', publishedAt: null });
    const c = svc.create(a.id, 'u2', 'hi');
    svc.remove(c.id, 'u3', 'admin');
    expect(commentStore.size()).toBe(0);
  });

  it('listByArticle: 文章不存在抛 NotFoundError', () => {
    expect(() => svc.listByArticle('missing')).toThrow(NotFoundError);
  });
});
