import { describe, it, expect, beforeEach } from 'vitest';
import { ArticleService } from '../../src/services/article.service.js';
import { articleStore } from '../../src/stores/article.store.js';
import { ForbiddenError, NotFoundError } from '../../src/utils/errors.js';
import type { Article } from '../../src/types.js';

async function seedArticle(authorId: string, title: string): Promise<Article> {
  return ArticleService.create(authorId, { title, content: 'content-' + title });
}

describe('UT-016 ~ UT-025: ArticleService', () => {
  beforeEach(() => {
    articleStore.clear();
  });

  it('UT-016: create 正常创建 → 返回 Article，含 id/authorId/createdAt', async () => {
    const article = await ArticleService.create('u1', {
      title: 'T1',
      content: 'C1',
    });
    expect(article.id).toBeTruthy();
    expect(article.title).toBe('T1');
    expect(article.content).toBe('C1');
    expect(article.authorId).toBe('u1');
    expect(article.createdAt).toBeTruthy();
    expect(article.updatedAt).toBe(article.createdAt);
  });

  it('UT-017: list 分页 page=1,pageSize=2，3 条数据 → {items:2, total:3, page:1, pageSize:2}', async () => {
    await seedArticle('u1', 'A');
    await seedArticle('u1', 'B');
    await seedArticle('u1', 'C');
    const result = await ArticleService.list(1, 2);
    expect(result.items.length).toBe(2);
    expect(result.total).toBe(3);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(2);
  });

  it('UT-018: list 越界 page=0,pageSize=0 → 自动修正为 page=1,pageSize=10', async () => {
    const result = await ArticleService.list(0, 0);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it('UT-019: getById 存在 → 返回 Article', async () => {
    const created = await seedArticle('u1', 'T1');
    const found = await ArticleService.getById(created.id);
    expect(found.id).toBe(created.id);
    expect(found.title).toBe('T1');
  });

  it('UT-020: getById 不存在 → NotFoundError(40401)', async () => {
    await expect(ArticleService.getById('non-existent')).rejects.toThrow(NotFoundError);
    try {
      await ArticleService.getById('non-existent');
    } catch (e) {
      expect((e as NotFoundError).code).toBe(40401);
    }
  });

  it('UT-021: update 作者本人 → 返回更新后 Article，updatedAt 改变', async () => {
    const article = await seedArticle('u1', 'T1');
    const before = article.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const updated = await ArticleService.update('u1', article.id, { title: 'T2' });
    expect(updated.title).toBe('T2');
    expect(updated.updatedAt).not.toBe(before);
    expect(updated.content).toBe(article.content);
  });

  it('UT-022: update 非作者 → ForbiddenError(40301)', async () => {
    const article = await seedArticle('u1', 'T1');
    await expect(
      ArticleService.update('u2', article.id, { title: 'T2' }),
    ).rejects.toThrow(ForbiddenError);
    try {
      await ArticleService.update('u2', article.id, { title: 'T2' });
    } catch (e) {
      expect((e as ForbiddenError).code).toBe(40301);
    }
  });

  it('UT-023: update 文章不存在 → NotFoundError(40401)', async () => {
    await expect(
      ArticleService.update('u1', 'non-existent', { title: 'T2' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('UT-024: remove 作者本人 → 无返回；articleStore.size 减 1', async () => {
    const article = await seedArticle('u1', 'T1');
    expect(articleStore.size()).toBe(1);
    await ArticleService.remove('u1', article.id);
    expect(articleStore.size()).toBe(0);
  });

  it('UT-025: remove 非作者 → ForbiddenError(40301)', async () => {
    const article = await seedArticle('u1', 'T1');
    await expect(ArticleService.remove('u2', article.id)).rejects.toThrow(ForbiddenError);
    expect(articleStore.size()).toBe(1);
  });

  it('补充: remove 文章不存在 → NotFoundError(40401)', async () => {
    await expect(ArticleService.remove('u1', 'non-existent')).rejects.toThrow(NotFoundError);
  });
});
