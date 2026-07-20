import { describe, it, expect, beforeEach } from 'vitest';
import { articleService } from '../../src/services/article-service.js';
import { articleStore } from '../../src/stores/article-store.js';
import { ForbiddenError, NotFoundError } from '../../src/utils/errors.js';

describe('ArticleService', () => {
  beforeEach(() => {
    articleStore.clear();
  });

  it('UT-008: 创建成功返回 articleId', async () => {
    const result = await articleService.create({ title: 'T', content: 'C' }, 'u1');
    expect(result.articleId).toBeTypeOf('string');
    expect(articleService.list()).toHaveLength(1);
  });

  it('UT-009: 作者更新自己的文章成功', async () => {
    const { articleId } = await articleService.create({ title: 'T', content: 'C' }, 'u1');
    await new Promise(r => setTimeout(r, 5));
    const updated = await articleService.update(articleId, { title: 'T2' }, 'u1');
    expect(updated.title).toBe('T2');
    expect(updated.updatedAt).not.toBe(updated.createdAt);
  });

  it('UT-010: 非作者更新抛 ForbiddenError', async () => {
    const { articleId } = await articleService.create({ title: 'T', content: 'C' }, 'u1');
    await expect(
      articleService.update(articleId, { title: 'Hacked' }, 'u2'),
    ).rejects.toThrow(ForbiddenError);
  });

  it('UT-011: 不存在的文章抛 NotFoundError', async () => {
    await expect(
      articleService.update('non-existent', { title: 'X' }, 'u1'),
    ).rejects.toThrow(NotFoundError);
  });

  it('UT-012: 作者删除自己的文章成功', async () => {
    const { articleId } = await articleService.create({ title: 'T', content: 'C' }, 'u1');
    await articleService.remove(articleId, 'u1');
    expect(articleService.list()).toHaveLength(0);
    expect(articleService.findById(articleId)).toBeNull();
  });

  it('UT-013: 非作者删除抛 ForbiddenError', async () => {
    const { articleId } = await articleService.create({ title: 'T', content: 'C' }, 'u1');
    await expect(
      articleService.remove(articleId, 'u2'),
    ).rejects.toThrow(ForbiddenError);
  });
});
