import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleWorkflowService, LikeService } from '../../../src/services/article-workflow.service.js';
import { ArticleStore } from '../../../src/stores/article.store.js';
import { LikeStore } from '../../../src/stores/like.store.js';
import { ArticleStateMachine } from '../../../src/utils/article-state-machine.js';
import { NotFoundError, ValidationError } from '../../../src/utils/errors.js';

describe('ArticleWorkflowService (DD-017-002 / L3_article_publish_flow)', () => {
  let articleStore: ArticleStore;
  let sm: ArticleStateMachine;
  let svc: ArticleWorkflowService;

  beforeEach(() => {
    articleStore = new ArticleStore();
    sm = new ArticleStateMachine();
    svc = new ArticleWorkflowService(articleStore, sm);
  });

  it('TC-UNIT-052N: publish 草稿 → 已发布', () => {
    const a = articleStore.insert({ title: 't', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'draft', publishedAt: null });
    const r = svc.publish(a.id, 'u1', 'author');
    expect(r.status).toBe('published');
    expect(r.publishedAt).not.toBeNull();
  });

  it('TC-UNIT-052E: 非作者 publish 抛错', () => {
    const a = articleStore.insert({ title: 't', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'draft', publishedAt: null });
    expect(() => svc.publish(a.id, 'u2', 'author')).toThrow();
  });

  it('TC-UNIT-052B: unpublish 已发布 → 草稿，publishedAt=null', () => {
    const a = articleStore.insert({ title: 't', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'published', publishedAt: '2026-07-26T00:00:00Z' });
    const r = svc.unpublish(a.id, 'u1', 'admin');
    expect(r.status).toBe('draft');
    expect(r.publishedAt).toBeNull();
  });

  it('archive published → archived', () => {
    const a = articleStore.insert({ title: 't', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'published', publishedAt: '2026-07-26T00:00:00Z' });
    const r = svc.archive(a.id, 'u1', 'admin');
    expect(r.status).toBe('archived');
  });

  it('getAvailableTransitions 不存在抛 NotFoundError', () => {
    expect(() => svc.getAvailableTransitions('missing')).toThrow(NotFoundError);
  });
});

describe('LikeService (DD-018-002 / L3_article_like_flow)', () => {
  let articleStore: ArticleStore;
  let likeStore: LikeStore;
  let svc: LikeService;

  beforeEach(() => {
    articleStore = new ArticleStore();
    likeStore = new LikeStore();
    svc = new LikeService(likeStore, articleStore);
  });

  it('TC-UNIT-055N: toggle 点赞 published 文章', () => {
    const a = articleStore.insert({ title: 't', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'published', publishedAt: null });
    const r = svc.toggle('u2', a.id);
    expect(r.liked).toBe(true);
    expect(r.likeCount).toBe(1);
  });

  it('TC-UNIT-055E: toggle 草稿文章抛 ValidationError', () => {
    const a = articleStore.insert({ title: 't', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'draft', publishedAt: null });
    expect(() => svc.toggle('u2', a.id)).toThrow(ValidationError);
  });

  it('TC-UNIT-055B: toggle 二次取消点赞 + 计数减 1', () => {
    const a = articleStore.insert({ title: 't', content: 'c', authorId: 'u1', categoryId: null, tagIds: [], status: 'published', publishedAt: null });
    svc.toggle('u2', a.id);
    const r = svc.toggle('u2', a.id);
    expect(r.liked).toBe(false);
    expect(r.likeCount).toBe(0);
  });

  it('like 不存在文章抛 NotFoundError', () => {
    expect(() => svc.like('u2', 'missing')).toThrow(NotFoundError);
  });
});
