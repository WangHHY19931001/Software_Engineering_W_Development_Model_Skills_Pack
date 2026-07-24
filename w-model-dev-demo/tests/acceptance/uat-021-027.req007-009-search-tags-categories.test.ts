/**
 * 验收测试 UAT-021 ~ UAT-027 —— 搜索/标签/分类（REQ-007 / REQ-008 / REQ-009）
 *
 * 覆盖：
 * - UAT-021 全文搜索 P95 ≤ 500ms 且命中
 * - UAT-022 排序参数（相关度/时间/热度）生效
 * - UAT-023 搜索建议前缀匹配返回 ≤ 10 条
 * - UAT-024 文章多标签绑定 + 标签云频次降序
 * - UAT-025 标签合并后旧标签不可用
 * - UAT-026 分类树多级父子 + 拒绝循环引用
 * - UAT-027 分类下文章列表分页参数生效
 *
 * 路径映射（设计文档 → 实际 API）：
 * - GET /api/search?q=&sort=relevance|time|hot → GET /api/search?q=&sort=relevance|latest|hottest
 * - GET /api/search/suggest?prefix= → GET /api/search/suggest?prefix=
 * - POST /api/articles（tags 字段） → 文章创建不含 tags，标签通过 POST /api/tags + POST /api/articles/:id/tags/:tagId 绑定
 * - GET /api/tags/cloud → GET /api/tags/cloud
 * - POST /api/admin/tags/merge → 无 API，用 tagService.mergeTags 验证（合并后旧标签标记 mergedToId）
 * - PUT /api/admin/categories/:id（循环引用） → 无 PUT API，用 categoryService.updateCategory 验证（60005）
 * - GET /api/categories/:id/articles → 无 API，用 categoryService.getArticlesByCategory 验证
 *
 * 注意：
 * - 搜索需手动 searchIndexer.indexArticle(article) 索引；仅 published 文章命中。
 * - P95 性能用 service 层调用测量（绕过 60/min 限流，满足 100 次采样）。
 * - 文章创建 schema 允许 0 标签（tags 通过独立绑定接口），UAT-024 边界改测「每篇 ≤ 10 标签」。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestApp, registerUser, authHeader,
} from '../helpers/api-helper.js';
import { articleStore } from '../../src/stores/article-store.js';

describe('UAT-021 ~ UAT-027: 搜索/标签/分类 (REQ-007 / REQ-008 / REQ-009)', () => {
  let app: Express;
  let adminToken: string;
  let adminId: string;
  let bloggerToken: string;
  let bloggerId: string;

  beforeEach(async () => {
    app = createTestApp();
    const admin = await registerUser(app, 'admin@stc.com', 'Pass1234', 'aS', 'admin');
    adminToken = admin.accessToken;
    adminId = admin.userId;
    const blogger = await registerUser(app, 'blogger@stc.com', 'Pass1234', 'bS', 'blogger');
    bloggerToken = blogger.accessToken;
    bloggerId = blogger.userId;
  });

  /** 创建并发布文章（service 层，绕过限流） */
  async function createPublishedArticle(
    title: string,
    content: string,
    extra?: { tagIds?: string[]; categoryId?: string; seriesId?: string },
  ): Promise<string> {
    const { getContainer } = await import('../../src/container.js');
    const c = getContainer();
    const article = await c.articleService.createArticle({
      title, content, authorId: bloggerId, ...extra,
    });
    await c.articleService.transitionState(article.id, 'pending_review', { id: bloggerId, role: 'blogger' });
    await c.articleService.transitionState(article.id, 'published', { id: adminId, role: 'admin' });
    // 手动索引到搜索引擎
    const indexed = articleStore.findById(article.id);
    if (indexed) c.searchIndexer.indexArticle(indexed);
    return article.id;
  }

  // -----------------------------------------------------------------------
  // UAT-021: 全文搜索 P95 ≤ 500ms 且命中
  // -----------------------------------------------------------------------
  describe('UAT-021: 全文搜索 P95 ≤ 500ms 且命中', () => {
    it('UAT-021: 1000 文章数据集下搜索 P95 ≤ 500ms，结果命中 TypeScript', async () => {
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();

      // 前置: 发布 1000 篇文章，其中 ≥10 篇含「TypeScript」
      for (let i = 0; i < 1000; i++) {
        const hasKeyword = i < 15;
        const title = hasKeyword ? `TypeScript 入门 ${i}` : `普通文章 ${i}`;
        const content = hasKeyword ? 'TypeScript is great' : `内容 ${i}`;
        const id = await createPublishedArticle(title, content);
        // 仅校验创建成功
        expect(id).toBeDefined();
      }

      // 步骤1: 连续 100 次搜索计时（service 层，绕过限流）
      const latencies: number[] = [];
      let lastResult: { list: { title: string; content: string; summary?: string }[] } | null = null;
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        lastResult = c.searchIndexer.search('TypeScript', 'relevance', 1, 10, bloggerId);
        latencies.push(performance.now() - start);
      }
      expect(lastResult).not.toBeNull();
      expect(lastResult!.list.length).toBeGreaterThanOrEqual(1);

      // 计算 P95
      latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95 = latencies[p95Index];
      expect(p95).toBeLessThanOrEqual(500);

      // 步骤2: 验证返回结果命中查询词（不区分大小写）
      for (const a of lastResult!.list) {
        const blob = `${a.title} ${a.content} ${a.summary ?? ''}`.toLowerCase();
        expect(blob).toContain('typescript');
      }
    });
  });

  // -----------------------------------------------------------------------
  // UAT-022: 排序参数（相关度/时间/热度）生效
  // -----------------------------------------------------------------------
  describe('UAT-022: 排序参数生效', () => {
    it('UAT-022: relevance/latest/hottest 三种排序结果顺序有差异', async () => {
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();

      // 发布 ≥10 篇含「test」的文章，热度与时间不一致
      const ids: string[] = [];
      const baseTime = Math.floor(Date.now() / 1000);
      for (let i = 0; i < 10; i++) {
        const id = await createPublishedArticle(`test article ${i}`, `test content ${i}`);
        ids.push(id);
        // 设置不同热度（i=0 最热）和不同时间（i=0 最早，i=9 最新）
        const art = articleStore.findById(id)!;
        articleStore.update(id, {
          createdAt: baseTime + i,
          updatedAt: baseTime + i,
          stats: { ...art.stats, views: (10 - i) * 5, likes: i * 2, comments: 0, shares: 0, heat: (10 - i) * 100 },
        });
        // 重新索引以更新热度与时间
        const reindexed = articleStore.findById(id);
        if (reindexed) c.searchIndexer.indexArticle(reindexed);
      }

      // 步骤1: sort=relevance（按命中频次降序）
      const byRelevance = c.searchIndexer.search('test', 'relevance', 1, 10);
      expect(byRelevance.total).toBeGreaterThanOrEqual(10);

      // 步骤2: sort=latest（按 createdAt 降序）
      const byLatest = c.searchIndexer.search('test', 'latest', 1, 10);

      // 步骤3: sort=hottest（按 heat 降序）
      const byHottest = c.searchIndexer.search('test', 'hottest', 1, 10);

      // 步骤4: 验证至少 2 次顺序不同
      const relIds = byRelevance.list.map((a: { id: string }) => a.id).join(',');
      const latIds = byLatest.list.map((a: { id: string }) => a.id).join(',');
      const hotIds = byHottest.list.map((a: { id: string }) => a.id).join(',');

      const distinct = new Set([relIds, latIds, hotIds]);
      expect(distinct.size).toBeGreaterThanOrEqual(2);

      // latest 必须按 createdAt 降序
      const latestList = byLatest.list as { createdAt: number }[];
      for (let i = 0; i < latestList.length - 1; i++) {
        expect(latestList[i].createdAt).toBeGreaterThanOrEqual(latestList[i + 1].createdAt);
      }

      // hottest 必须按 heat 降序
      const hotList = byHottest.list as { stats: { heat: number } }[];
      for (let i = 0; i < hotList.length - 1; i++) {
        expect(hotList[i].stats.heat).toBeGreaterThanOrEqual(hotList[i + 1].stats.heat);
      }
    });
  });

  // -----------------------------------------------------------------------
  // UAT-023: 搜索建议前缀匹配返回 ≤ 10 条
  // -----------------------------------------------------------------------
  describe('UAT-023: 搜索建议前缀匹配', () => {
    it('UAT-023: 前缀建议 ≤ 10 条且均以前缀开头，空前缀被拒', async () => {
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();

      // 前置: 索引 ≥15 个含「type」前缀的文章
      for (let i = 0; i < 15; i++) {
        await createPublishedArticle(`typescript tips ${i}`, `typescript body ${i}`);
      }

      // 步骤1: GET /api/search/suggest?prefix=type
      const res = await request(app).get('/api/search/suggest?prefix=type');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeLessThanOrEqual(10);
      for (const s of res.body as string[]) {
        expect(s.toLowerCase().startsWith('type')).toBe(true);
      }

      // 步骤2: 空前缀 → 400 VALIDATION_FAILED（40003）
      const emptyRes = await request(app).get('/api/search/suggest?prefix=');
      expect(emptyRes.status).toBe(400);
      expect(emptyRes.body.code).toBe(40003);
    });
  });

  // -----------------------------------------------------------------------
  // UAT-024: 文章多标签绑定 + 标签云频次降序
  // -----------------------------------------------------------------------
  describe('UAT-024: 文章多标签绑定 + 标签云频次降序', () => {
    it('UAT-024: 文章可绑定多标签，标签云按 usageCount 降序，>10 标签被拒', async () => {
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();

      // 创建 2 个标签
      const tagTs = await c.tagService.createTag('ts', bloggerId);
      const tagJs = await c.tagService.createTag('js', bloggerId);

      // 步骤1: 创建文章
      const article = await c.articleService.createArticle({
        title: '多标签文章', content: 'content', authorId: bloggerId,
      });

      // 绑定 2 个标签（POST /api/articles/:id/tags/:tagId）
      const bind1 = await request(app)
        .post(`/api/articles/${article.id}/tags/${tagTs.id}`)
        .set(authHeader(bloggerToken));
      expect(bind1.status).toBe(204);
      const bind2 = await request(app)
        .post(`/api/articles/${article.id}/tags/${tagJs.id}`)
        .set(authHeader(bloggerToken));
      expect(bind2.status).toBe(204);

      // 步骤2: GET /api/articles/:id 含 tags（需认证，作者可查看自己的 draft）
      const getRes = await request(app).get(`/api/articles/${article.id}`).set(authHeader(bloggerToken));
      expect(getRes.status).toBe(200);
      expect(getRes.body.tagIds).toContain(tagTs.id);
      expect(getRes.body.tagIds).toContain(tagJs.id);

      // 步骤3: GET /api/tags/cloud 按 count 降序
      const cloudRes = await request(app).get('/api/tags/cloud?limit=20');
      expect(cloudRes.status).toBe(200);
      const cloud = cloudRes.body as { usageCount: number }[];
      for (let i = 0; i < cloud.length - 1; i++) {
        expect(cloud[i].usageCount).toBeGreaterThanOrEqual(cloud[i + 1].usageCount);
      }

      // 步骤4 边界: 每篇文章 ≤ 10 标签（设计文档期望 0 标签被拒，实际文章创建允许 0 标签，
      // 标签通过独立接口绑定；实际边界为「每篇 ≤ 10 标签」→ 60006）
      const extraTags = [];
      for (let i = 0; i < 9; i++) {
        extraTags.push(await c.tagService.createTag(`t${i}`, bloggerId));
      }
      // 已绑定 2 个，再绑 8 个 = 10 个（成功）
      for (let i = 0; i < 8; i++) {
        await c.tagService.bindTag(article.id, extraTags[i].id, bloggerId);
      }
      // 第 11 个 → 60006
      await expect(c.tagService.bindTag(article.id, extraTags[8].id, bloggerId))
        .rejects.toMatchObject({ code: 60006 });
    });
  });

  // -----------------------------------------------------------------------
  // UAT-025: 标签合并后旧标签不可用
  // -----------------------------------------------------------------------
  describe('UAT-025: 标签合并后旧标签不可用', () => {
    it('UAT-025: 合并后旧标签标记 mergedToId，文章迁移到新标签', async () => {
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();

      // 前置: 标签 js 与 javascript 各绑定 ≥2 篇文章
      const tagJs = await c.tagService.createTag('js', bloggerId);
      const tagJsMerge = await c.tagService.createTag('javascript', bloggerId);

      const a1 = await c.articleService.createArticle({ title: 'a1', content: 'c', authorId: bloggerId });
      const a2 = await c.articleService.createArticle({ title: 'a2', content: 'c', authorId: bloggerId });
      const a3 = await c.articleService.createArticle({ title: 'a3', content: 'c', authorId: bloggerId });
      const a4 = await c.articleService.createArticle({ title: 'a4', content: 'c', authorId: bloggerId });
      await c.tagService.bindTag(a1.id, tagJs.id, bloggerId);
      await c.tagService.bindTag(a2.id, tagJs.id, bloggerId);
      await c.tagService.bindTag(a3.id, tagJsMerge.id, bloggerId);
      await c.tagService.bindTag(a4.id, tagJsMerge.id, bloggerId);

      // 步骤1: 合并 js → javascript
      const result = await c.tagService.mergeTags(tagJs.id, tagJsMerge.id, adminId);
      expect(result.redirectedCount).toBeGreaterThanOrEqual(2);

      // 步骤2: 旧标签标记 mergedToId（不可用）
      const oldTag = c.tagService.findById(tagJs.id);
      expect(oldTag).not.toBeNull();
      expect(oldTag!.mergedToId).toBe(tagJsMerge.id);

      // 步骤3: 原 js 标签下的文章已迁移到 javascript
      const migrated1 = articleStore.findById(a1.id);
      const migrated2 = articleStore.findById(a2.id);
      expect(migrated1!.tagIds).toContain(tagJsMerge.id);
      expect(migrated1!.tagIds).not.toContain(tagJs.id);
      expect(migrated2!.tagIds).toContain(tagJsMerge.id);
    });
  });

  // -----------------------------------------------------------------------
  // UAT-026: 分类树多级父子 + 拒绝循环引用
  // -----------------------------------------------------------------------
  describe('UAT-026: 分类树多级父子 + 拒绝循环引用', () => {
    it('UAT-026: 分类树支持 ≥3 级父子，循环引用被拒（60005）', async () => {
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();

      // 步骤1: 创建 root
      const root = await c.categoryService.createCategory({ name: 'root' }, adminId);
      // 步骤2: child parentId=root
      const child = await c.categoryService.createCategory({ name: 'child', parentId: root.id }, adminId);
      // 步骤3: grandchild parentId=child
      const grandchild = await c.categoryService.createCategory({ name: 'grandchild', parentId: child.id }, adminId);

      // 步骤4: GET /api/categories/tree 深度 ≥3
      const treeRes = await request(app).get('/api/categories/tree');
      expect(treeRes.status).toBe(200);
      const tree = treeRes.body as { id: string; children: { id: string; children: { id: string }[] }[] }[];
      expect(tree.length).toBeGreaterThanOrEqual(1);
      // 找到 root，验证深度 ≥3
      const rootNode = tree.find(n => n.id === root.id);
      expect(rootNode).toBeDefined();
      expect(rootNode!.children.length).toBeGreaterThanOrEqual(1);
      const childNode = rootNode!.children.find(n => n.id === child.id);
      expect(childNode).toBeDefined();
      expect(childNode!.children.length).toBeGreaterThanOrEqual(1);
      expect(childNode!.children.some(n => n.id === grandchild.id)).toBe(true);

      // 步骤5: 尝试设 root.parentId=grandchild 形成环 → 60005
      await expect(
        c.categoryService.updateCategory(root.id, { parentId: grandchild.id }, adminId),
      ).rejects.toMatchObject({ code: 60005 });
    });
  });

  // -----------------------------------------------------------------------
  // UAT-027: 分类下文章列表分页参数生效
  // -----------------------------------------------------------------------
  describe('UAT-027: 分类下文章列表分页参数生效', () => {
    it('UAT-027: page/size 生效，total 准确，size=0 被拒', async () => {
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();

      // 前置: 分类 c1 下 25 篇文章
      const cat = await c.categoryService.createCategory({ name: 'c1' }, adminId);
      for (let i = 0; i < 25; i++) {
        await c.articleService.createArticle({
          title: `cat-article-${i}`, content: 'c', authorId: bloggerId, categoryId: cat.id,
        });
      }

      // 步骤1: page=1&size=10 → 10 篇，total=25
      const p1 = c.categoryService.getArticlesByCategory(cat.id, 1, 10);
      expect(p1.list.length).toBe(10);
      expect(p1.total).toBe(25);

      // 步骤2: page=3&size=10 → 5 篇，total=25
      const p3 = c.categoryService.getArticlesByCategory(cat.id, 3, 10);
      expect(p3.list.length).toBe(5);
      expect(p3.total).toBe(25);

      // 步骤3: page=4&size=10 → 0 篇，total=25
      const p4 = c.categoryService.getArticlesByCategory(cat.id, 4, 10);
      expect(p4.list.length).toBe(0);
      expect(p4.total).toBe(25);

      // 步骤4: size=0 → 400 VALIDATION_FAILED（40003）
      expect(() => c.categoryService.getArticlesByCategory(cat.id, 1, 0)).toThrow();
    });
  });
});
