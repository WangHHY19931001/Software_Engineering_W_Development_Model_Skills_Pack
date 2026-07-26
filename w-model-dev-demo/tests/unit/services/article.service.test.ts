import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleService } from '../../../src/services/article.service.js';
import { ArticleStore } from '../../../src/stores/article.store.js';
import { CommentStore } from '../../../src/stores/comment.store.js';
import { TagStore } from '../../../src/stores/tag.store.js';
import { CategoryStore } from '../../../src/stores/category.store.js';
import { NotFoundError, ValidationError } from '../../../src/utils/errors.js';

describe('ArticleService (DD-005-002 / DD-006-002 / DD-007-002 / DD-008-002 / DD-009-002)', () => {
  let articleStore: ArticleStore;
  let commentStore: CommentStore;
  let tagStore: TagStore;
  let categoryStore: CategoryStore;
  let svc: ArticleService;

  beforeEach(() => {
    articleStore = new ArticleStore();
    commentStore = new CommentStore();
    tagStore = new TagStore();
    categoryStore = new CategoryStore();
    svc = new ArticleService(articleStore, commentStore, tagStore, categoryStore);
  });

  it('TC-UNIT-014N: create 正常创建草稿', () => {
    const a = svc.create({ title: 't', content: 'c', authorId: 'u1', tagIds: [], categoryId: null });
    expect(a.id).toBeTruthy();
    expect(a.status).toBe('draft');
    expect(a.publishedAt).toBeNull();
  });

  it('TC-UNIT-014E: 标题空抛 ValidationError', () => {
    expect(() => svc.create({ title: '  ', content: 'c', authorId: 'u1', tagIds: [], categoryId: null }))
      .toThrow(ValidationError);
  });

  it('TC-UNIT-014B: create with status=published 设置 publishedAt', () => {
    const a = svc.create({ title: 't', content: 'c', authorId: 'u1', tagIds: [], categoryId: null, status: 'published' });
    expect(a.status).toBe('published');
    expect(a.publishedAt).not.toBeNull();
  });

  it('TC-UNIT-020N: getById 不存在抛 NotFoundError', () => {
    expect(() => svc.getById('missing')).toThrow(NotFoundError);
  });

  it('TC-UNIT-020B: getById 增量浏览数', () => {
    const a = svc.create({ title: 't', content: 'c', authorId: 'u1', tagIds: [], categoryId: null });
    svc.getById(a.id, true);
    svc.getById(a.id, true);
    expect(articleStore.findById(a.id)?.viewCount).toBe(2);
  });

  it('TC-UNIT-023N: update 作者本人成功', () => {
    const a = svc.create({ title: 't', content: 'c', authorId: 'u1', tagIds: [], categoryId: null });
    const updated = svc.update(a.id, { title: 'new' }, 'u1', 'author');
    expect(updated.title).toBe('new');
  });

  it('TC-UNIT-023E: update 非作者抛错', () => {
    const a = svc.create({ title: 't', content: 'c', authorId: 'u1', tagIds: [], categoryId: null });
    expect(() => svc.update(a.id, { title: 'new' }, 'u2', 'author')).toThrow();
  });

  it('TC-UNIT-029N: remove 级联删除评论', () => {
    const a = svc.create({ title: 't', content: 'c', authorId: 'u1', tagIds: [], categoryId: null });
    commentStore.insert({ articleId: a.id, userId: 'u2', content: 'hi' });
    svc.remove(a.id, 'u1', 'admin');
    expect(articleStore.findById(a.id)).toBeUndefined();
    expect(commentStore.size()).toBe(0);
  });

  it('create 校验 tag 存在', () => {
    expect(() => svc.create({ title: 't', content: 'c', authorId: 'u1', tagIds: ['missing'], categoryId: null }))
      .toThrow(ValidationError);
  });

  it('create 校验 category 存在', () => {
    expect(() => svc.create({ title: 't', content: 'c', authorId: 'u1', tagIds: [], categoryId: 'missing' }))
      .toThrow(ValidationError);
  });
});
