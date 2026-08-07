/**
 * UT-028 四字段命中与相关性排序（searchService.searchArticles，DD-028/INTF-017）
 * UT-058 草稿不入搜索索引（searchService.syncIndex，DD-028/INTF-017）
 */
import { describe, it, expect, vi } from 'vitest';
import { SearchIndexStore } from '../../../src/stores/searchIndexStore';
import { SearchService } from '../../../src/services/discovery/searchService';

describe('UT-028 searchService.searchArticles', () => {
  it('标题命中权重 > 标签 > 摘要 > 正文，降序返回', async () => {
    const indexStore = new SearchIndexStore();
    indexStore.index('a_title', { title: 'W模型 实践', body: '无关', summary: '无关', tags: ['无关'] });
    indexStore.index('a_tag', { title: '无关', body: '无关', summary: '无关', tags: ['W模型'] });
    indexStore.index('a_summary', { title: '无关', body: '无关', summary: 'W模型 概要', tags: ['无关'] });
    indexStore.index('a_body', { title: '无关', body: '正文提到 W模型', summary: '无关', tags: ['无关'] });

    const articleService: any = {
      getArticlesByIds: vi.fn().mockResolvedValue(
        ['a_title', 'a_tag', 'a_summary', 'a_body'].map((id) => ({
          id,
          title: id,
          summary: 's',
          status: 'published',
        })),
      ),
    };
    const service = new SearchService(indexStore, articleService);

    const result = await service.searchArticles('w模型', 1, 20);

    expect(result.items[0].articleId).toBe('a_title');
    expect(result.items.map((i) => i.articleId)).toEqual(['a_title', 'a_tag', 'a_summary', 'a_body']);
    expect(result.items[0].score).toBeGreaterThan(result.items[3].score);
    expect(result.total).toBe(4);
  });

  it('service 层 keyword 校验：空/超长 → 40002', async () => {
    const service = new SearchService(new SearchIndexStore(), {} as any);
    expect((await service.searchArticles('', 1, 20).catch((e) => e)).code).toBe(40002);
    expect((await service.searchArticles('x'.repeat(101), 1, 20).catch((e) => e)).code).toBe(40002);
  });
});

describe('UT-058 searchService.syncIndex', () => {
  it('仅已发布文章同步索引；草稿不可检索', async () => {
    const indexStore = new SearchIndexStore();
    let pubStatus: 'published' | 'archived' = 'published';
    const articleService: any = {
      getArticleByIdSync: vi.fn((id: string) => {
        if (id === 'a_pub') {
          return { id, status: pubStatus, title: '草稿关键词 测试', body: 'b', summary: 's', tags: ['tag'] };
        }
        return { id, status: 'draft', title: '草稿关键词', body: 'b', summary: 's', tags: [] };
      }),
      getArticlesByIds: vi.fn(async (ids: string[]) => ids.map((id: string) => articleService.getArticleByIdSync(id))),
    };
    const service = new SearchService(indexStore, articleService);

    service.syncIndex({ type: 'article.updated', articleId: 'a_draft' });
    const before = await service.searchArticles('草稿关键词', 1, 20);
    expect(before.total).toBe(0);

    service.syncIndex({ type: 'article.published', articleId: 'a_pub' });
    const after = await service.searchArticles('草稿关键词', 1, 20);
    expect(after.total).toBe(1);
    expect(after.items[0].articleId).toBe('a_pub');

    // 归档后移除索引（不可检索）
    pubStatus = 'archived';
    service.syncIndex({ type: 'article.archived', articleId: 'a_pub' });
    const archived = await service.searchArticles('草稿关键词', 1, 20);
    expect(archived.total).toBe(0);
  });
});
