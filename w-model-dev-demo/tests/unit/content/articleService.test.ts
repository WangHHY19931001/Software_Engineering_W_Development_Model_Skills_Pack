/**
 * UT-007 创建文章标签不存在（articleService.createArticle，DD-007/INTF-005）
 */
import { describe, it, expect, vi } from 'vitest';
import { ArticleStore } from '../../../src/stores/articleStore';
import { TagStore } from '../../../src/stores/tagStore';
import { CategoryStore } from '../../../src/stores/categoryStore';
import { ArticleService } from '../../../src/services/content/articleService';
import { ArticleStateMachine } from '../../../src/services/content/articleStateMachine';
import { EventBus } from '../../../src/utils/eventBus';

function makeService(overrides: { articleStore?: ArticleStore; eventBus?: EventBus; auth?: any } = {}) {
  const articleStore = overrides.articleStore ?? new ArticleStore();
  const tagStore = new TagStore();
  const categoryStore = new CategoryStore();
  const authService: any = overrides.auth ?? { isBlogger: vi.fn().mockResolvedValue(true), getUserById: vi.fn().mockResolvedValue({ id: 'u_0002', username: '博主' }) };
  const eventBus = overrides.eventBus ?? new EventBus();
  const service = new ArticleService(articleStore, tagStore, categoryStore, new ArticleStateMachine(), authService, eventBus);
  return { articleStore, tagStore, categoryStore, authService, eventBus, service };
}

function seedPublished(store: ArticleStore, id: string, authorId = 'u_0002'): void {
  store.create({
    id,
    authorId,
    title: `标题${id}`,
    body: '正文',
    summary: '摘要',
    categoryId: null,
    status: 'published',
    tags: [],
    publishedAt: '2026-08-07T10:00:00.000Z',
    createdAt: '2026-08-07T09:00:00.000Z',
    updatedAt: '2026-08-07T09:00:00.000Z',
  });
}

describe('UT-007 articleService.createArticle', () => {
  it('tags 中标签不存在 → 40401，文章未写入 ArticleStore', async () => {
    const articleStore = new ArticleStore();
    const tagStore = new TagStore();
    const categoryStore = new CategoryStore();
    const authService: any = { isBlogger: vi.fn().mockResolvedValue(true) };
    const service = new ArticleService(articleStore, tagStore, categoryStore, new ArticleStateMachine(), authService, new EventBus());

    let error: any;
    try {
      await service.createArticle('u_0002', { title: 't', body: 'b', tags: ['不存在标签'] });
    } catch (err) {
      error = err;
    }

    expect(error.code).toBe(40401);
    expect(error.httpStatus).toBe(404);
    expect(articleStore.findAll()).toHaveLength(0);
  });

  it('非博主创建 → 40301', async () => {
    const articleStore = new ArticleStore();
    const authService: any = { isBlogger: vi.fn().mockResolvedValue(false) };
    const service = new ArticleService(articleStore, new TagStore(), new CategoryStore(), new ArticleStateMachine(), authService, new EventBus());
    const error = await service.createArticle('u_0001', { title: 't', body: 'b' }).catch((e) => e);
    expect(error.code).toBe(40301);
    expect(articleStore.findAll()).toHaveLength(0);
  });

  it('成功创建 draft：标签/分类存在性通过后落库', async () => {
    const { articleStore, tagStore, categoryStore, service } = makeService();
    const tag = tagStore.create({ name: 'W模型', createdAt: new Date().toISOString() });
    const category = categoryStore.create({ parentId: null, name: '工程', depth: 1, createdAt: new Date().toISOString() });

    const article = await service.createArticle('u_0002', { title: 'W 模型实践', body: '正文', summary: '概要', tags: [tag.name], categoryId: category.id });

    expect(article.status).toBe('draft');
    expect(article.tags).toEqual(['W模型']);
    expect(article.categoryId).toBe(category.id);
    expect(articleStore.findAll()).toHaveLength(1);
  });
});

describe('articleService 生命周期（publish/archive/unarchive/update/delete）', () => {
  it('publishArticle：draft→published，publishedAt 落库，触发 article.published 事件', async () => {
    const { articleStore, eventBus, service } = makeService();
    const emit = vi.spyOn(eventBus, 'emit');
    articleStore.create({ id: 'a_1', authorId: 'u_0002', title: 't', body: 'b', summary: '', categoryId: null, status: 'draft', tags: [], publishedAt: null, createdAt: '2026-08-07T09:00:00.000Z', updatedAt: '2026-08-07T09:00:00.000Z' });

    const published = await service.publishArticle('a_1', 'u_0002');

    expect(published.status).toBe('published');
    expect(published.publishedAt).not.toBeNull();
    expect(emit).toHaveBeenCalledWith('article.published', expect.objectContaining({ articleId: 'a_1', authorId: 'u_0002' }));
  });

  it('publishArticle：已 published 幂等返回 200（不重复发事件）', async () => {
    const { articleStore, eventBus, service } = makeService();
    seedPublished(articleStore, 'a_1');
    const emit = vi.spyOn(eventBus, 'emit');
    const result = await service.publishArticle('a_1', 'u_0002');
    expect(result.status).toBe('published');
    expect(emit).not.toHaveBeenCalledWith('article.published', expect.anything());
  });

  it('publishArticle：archived→published 直跳 60001；越权 40301；不存在 40401', async () => {
    const { articleStore, service } = makeService();
    articleStore.create({ id: 'a_2', authorId: 'u_0002', title: 't', body: 'b', summary: '', categoryId: null, status: 'archived', tags: [], publishedAt: null, createdAt: '2026-08-07T09:00:00.000Z', updatedAt: '2026-08-07T09:00:00.000Z' });
    expect((await service.publishArticle('a_2', 'u_0002').catch((e) => e)).code).toBe(60001);
    expect((await service.publishArticle('a_1', 'u_9999').catch((e) => e)).code).toBe(40401);
    seedPublished(articleStore, 'a_3');
    expect((await service.publishArticle('a_3', 'u_0001').catch((e) => e)).code).toBe(40301);
  });

  it('archiveArticle：published→archived；draft→archived 60001；触发 article.archived', async () => {
    const { articleStore, eventBus, service } = makeService();
    seedPublished(articleStore, 'a_1');
    const emit = vi.spyOn(eventBus, 'emit');
    const archived = await service.archiveArticle('a_1', 'u_0002');
    expect(archived.status).toBe('archived');
    expect(emit).toHaveBeenCalledWith('article.archived', expect.objectContaining({ articleId: 'a_1' }));

    articleStore.create({ id: 'a_2', authorId: 'u_0002', title: 't', body: 'b', summary: '', categoryId: null, status: 'draft', tags: [], publishedAt: null, createdAt: '2026-08-07T09:00:00.000Z', updatedAt: '2026-08-07T09:00:00.000Z' });
    expect((await service.archiveArticle('a_2', 'u_0002').catch((e) => e)).code).toBe(60001);
  });

  it('unarchiveArticle：archived→draft', async () => {
    const { articleStore, service } = makeService();
    articleStore.create({ id: 'a_1', authorId: 'u_0002', title: 't', body: 'b', summary: '', categoryId: null, status: 'archived', tags: [], publishedAt: null, createdAt: '2026-08-07T09:00:00.000Z', updatedAt: '2026-08-07T09:00:00.000Z' });
    const draft = await service.unarchiveArticle('a_1', 'u_0002');
    expect(draft.status).toBe('draft');
    expect((await service.unarchiveArticle('a_1', 'u_0002').catch((e) => e)).code).toBe(60001); // draft→unarchive 非法
  });

  it('updateArticle：published 编辑后置回 draft；触发 article.updated；标签不存在 40401', async () => {
    const { articleStore, tagStore, eventBus, service } = makeService();
    seedPublished(articleStore, 'a_1');
    const emit = vi.spyOn(eventBus, 'emit');
    const updated = await service.updateArticle('a_1', 'u_0002', { title: '新标题' });
    expect(updated.title).toBe('新标题');
    expect(updated.status).toBe('draft'); // published 编辑置回 draft（REQ-012）
    expect(emit).toHaveBeenCalledWith('article.updated', expect.objectContaining({ articleId: 'a_1' }));

    expect((await service.updateArticle('a_1', 'u_0002', { tags: ['无此标签'] }).catch((e) => e)).code).toBe(40401);
    expect(tagStore.list()).toHaveLength(0);
  });

  it('deleteArticle：仅 draft 可删（204）；published 删除 60001', async () => {
    const { articleStore, service } = makeService();
    articleStore.create({ id: 'a_1', authorId: 'u_0002', title: 't', body: 'b', summary: '', categoryId: null, status: 'draft', tags: [], publishedAt: null, createdAt: '2026-08-07T09:00:00.000Z', updatedAt: '2026-08-07T09:00:00.000Z' });
    await service.deleteArticle('a_1', 'u_0002');
    expect(articleStore.findById('a_1')).toBeNull();

    seedPublished(articleStore, 'a_2');
    expect((await service.deleteArticle('a_2', 'u_0002').catch((e) => e)).code).toBe(60001);
    expect(articleStore.findById('a_2')).not.toBeNull();
  });
});

describe('articleService 列表与跨模块只读', () => {
  it('listMyArticles：按状态筛选分页', async () => {
    const { articleStore, service } = makeService();
    articleStore.create({ id: 'a_1', authorId: 'u_0002', title: 't', body: 'b', summary: '', categoryId: null, status: 'draft', tags: [], publishedAt: null, createdAt: '2026-08-07T09:00:00.000Z', updatedAt: '2026-08-07T09:00:00.000Z' });
    seedPublished(articleStore, 'a_2');
    seedPublished(articleStore, 'a_3');

    const drafts = await service.listMyArticles('u_0002', 'draft', 1, 20);
    expect(drafts.total).toBe(1);
    expect(drafts.items[0].id).toBe('a_1');

    const all = await service.listMyArticles('u_0002', undefined, 1, 20);
    expect(all.total).toBe(3);
  });

  it('跨模块只读：getPublishedArticleById / getArticleById / listPublishedArticles / getArticlesByIds / findAllPublished / findByAuthor / countByAuthor', async () => {
    const { articleStore, service } = makeService();
    articleStore.create({ id: 'a_1', authorId: 'u_0002', title: 't', body: 'b', summary: '', categoryId: null, status: 'draft', tags: [], publishedAt: null, createdAt: '2026-08-07T09:00:00.000Z', updatedAt: '2026-08-07T09:00:00.000Z' });
    seedPublished(articleStore, 'a_2', 'u_0002');
    seedPublished(articleStore, 'a_3', 'u_0003');

    expect(await service.getPublishedArticleById('a_1')).toBeNull(); // 草稿不可见
    expect((await service.getPublishedArticleById('a_2'))?.id).toBe('a_2');
    expect((await service.getArticleById('a_1'))?.status).toBe('draft');
    expect(await service.getArticleById('a_9999')).toBeNull();

    const listed = await service.listPublishedArticles({ keyword: '标题a_2' }, 1, 20);
    expect(listed.total).toBe(1);

    const byIds = await service.getArticlesByIds(['a_1', 'a_2']);
    expect(byIds).toHaveLength(2);

    expect(await service.findAllPublished()).toHaveLength(2);
    expect(await service.findByAuthor('u_0002')).toHaveLength(2);
    expect(await service.countByAuthor('u_0003')).toBe(1);
    expect(articleStore.findAll()).toHaveLength(3);
  });
});
