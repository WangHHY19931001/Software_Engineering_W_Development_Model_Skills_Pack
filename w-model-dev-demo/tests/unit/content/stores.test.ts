/**
 * UT-011 分页参数越界（ArticleStore.filterPublished，DD-011/INTF-008/011）
 * UT-012 按名称查标签不存在（TagStore.findByName，DD-012/INTF-009）
 * UT-013 根分类创建（CategoryStore，DD-013/INTF-010）
 */
import { describe, it, expect } from 'vitest';
import { ArticleStore } from '../../../src/stores/articleStore';
import { TagStore } from '../../../src/stores/tagStore';
import { CategoryStore } from '../../../src/stores/categoryStore';

describe('UT-011 ArticleStore 分页校验', () => {
  it('page=0 与 pageSize=51 → 40002；合法极值 pageSize=50 放行', () => {
    const store = new ArticleStore();
    expect(() => store.filterPublished({}, 0, 20)).toThrow(expect.objectContaining({ code: 40002 }));
    expect(() => store.filterPublished({}, 1, 51)).toThrow(expect.objectContaining({ code: 40002 }));
    const result = store.filterPublished({}, 1, 50);
    expect(result.total).toBe(0);
  });
});

describe('UT-012 TagStore.findByName', () => {
  it('不存在与空串查询均返回 null（不抛异常）', () => {
    const store = new TagStore();
    expect(store.findByName('no_such_tag')).toBeNull();
    expect(store.findByName('')).toBeNull();
  });
});

describe('UT-013 CategoryStore 根分类', () => {
  it('parentId=null 根分类创建，depth=1', () => {
    const store = new CategoryStore();
    const category = store.create({ name: '根分类', parentId: null, depth: 1, createdAt: new Date().toISOString() });
    expect(category.id).toBeDefined();
    expect(category.depth).toBe(1);
    expect(category.parentId).toBeNull();
  });
});

describe('ArticleStore CRUD 与索引', () => {
  function seedArticle(store: ArticleStore, overrides: Partial<Parameters<ArticleStore['create']>[0]> = {}): any {
    return store.create({
      id: 'a_1',
      authorId: 'u_0002',
      title: '标题一',
      body: '正文一',
      summary: '摘要一',
      categoryId: 'c_1',
      status: 'published',
      tags: ['W模型'],
      publishedAt: '2026-08-07T10:00:00.000Z',
      createdAt: '2026-08-07T09:00:00.000Z',
      updatedAt: '2026-08-07T09:00:00.000Z',
      ...overrides,
    });
  }

  it('create 生成自增主键 + 索引维护；findById/findAll', () => {
    const store = new ArticleStore();
    const a = seedArticle(store);
    expect(a.id).toBe('a_1');
    expect(store.findById('a_1')?.title).toBe('标题一');
    expect(store.findAll()).toHaveLength(1);

    const auto = store.create({ authorId: 'u_0002', title: 't', body: 'b', summary: '', categoryId: null, status: 'draft', tags: [], publishedAt: null, createdAt: '2026-08-07T09:00:00.000Z', updatedAt: '2026-08-07T09:00:00.000Z' });
    expect(auto.id).toMatch(/^a_\d{4}$/);
  });

  it('update 同步状态/分类/标签索引；delete 全索引清理', () => {
    const store = new ArticleStore();
    seedArticle(store);

    const updated = store.update('a_1', { status: 'archived', categoryId: 'c_2', tags: ['新标签'], updatedAt: '2026-08-07T11:00:00.000Z' });
    expect(updated.status).toBe('archived');
    expect(updated.tags).toEqual(['新标签']);
    // 旧索引清理验证
    expect(store.findByAuthor('u_0002')).toHaveLength(1);
    const archived = store.filterPublished({}, 1, 50);
    expect(archived.total).toBe(0); // 不再是 published

    store.delete('a_1');
    expect(store.findById('a_1')).toBeNull();
    expect(store.findByAuthor('u_0002')).toHaveLength(0);
    expect(store.countByAuthor('u_0002')).toBe(0);
    expect(store.listPublished()).toHaveLength(0);
  });

  it('listByAuthorAndStatus / findByAuthor / listPublished / countByAuthor / filterPublished 组合筛选', () => {
    const store = new ArticleStore();
    seedArticle(store); // a_1 published, category c_1, tag W模型
    seedArticle(store, { id: 'a_2', title: '其他文章', categoryId: 'c_1', tags: [], status: 'draft', publishedAt: null });

    const myDrafts = store.listByAuthorAndStatus('u_0002', 'draft', 1, 20);
    expect(myDrafts.total).toBe(1);
    expect(myDrafts.items[0].id).toBe('a_2');

    expect(store.findByAuthor('u_0002')).toHaveLength(2);
    expect(store.listPublished()).toHaveLength(1);
    expect(store.countByAuthor('u_0002')).toBe(2);

    expect(store.filterPublished({ categoryId: 'c_1' }, 1, 20).total).toBe(1);
    expect(store.filterPublished({ tag: 'W模型' }, 1, 20).total).toBe(1);
    expect(store.filterPublished({ keyword: '标题' }, 1, 20).total).toBe(1);
  });
});

describe('TagStore / CategoryStore 补充', () => {
  it('TagStore：create 成功 / findById / list', () => {
    const store = new TagStore();
    const tag = store.create({ name: 'W模型', createdAt: new Date().toISOString() });
    expect(store.findById(tag.id)?.name).toBe('W模型');
    expect(store.findByName('W模型')?.id).toBe(tag.id);
    expect(store.list()).toHaveLength(1);
  });

  it('CategoryStore：子分类创建（含 parentId 索引）/ findByName / listByParent / list', () => {
    const store = new CategoryStore();
    const root = store.create({ name: '根', parentId: null, depth: 1, createdAt: new Date().toISOString() });
    const child = store.create({ name: '子', parentId: root.id, depth: 2, createdAt: new Date().toISOString() });
    expect(child.depth).toBe(2);
    expect(store.findByName('子')?.id).toBe(child.id);
    expect(store.listByParent(root.id)).toHaveLength(1);
    expect(store.listByParent(null)).toHaveLength(1);
    expect(store.list()).toHaveLength(2);
  });
});
