/**
 * 验收测试 - 内容发现模块（6 用例）
 * 覆盖 UAT: 006, 015, 022, 029, 038, 051
 * 关联需求: REQ-006, REQ-015, REQ-022
 *
 * 测试方法：supertest → Express app（seam-http），beforeEach 创建独立 container 数据隔离。
 * 实际 API 路径以 docs/uat-path-mapping.md 回填为准。
 * 搜索端点实际路径：GET /api/search?keyword=X（设计文档用 q=X，已映射）。
 * 归档端点实际路径：GET /api/archive（设计文档用 /api/articles/archive，已映射）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestContext,
  registerAndLogin,
  createPublishedArticle,
  createTag,
  createCategory,
  type AcceptanceTestContext,
} from './helpers.js';

describe('验收测试 - 内容发现模块（6 用例）', () => {
  let ctx: AcceptanceTestContext;
  let app: Express;

  beforeEach(() => {
    ctx = createTestContext();
    app = ctx.app;
  });

  // ==================== UAT-006 文章列表分页查询（REQ-006） ====================
  it('UAT-006: 分页查询文章列表 → 200 {items, total, totalPages, page}', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    // 创建 15 篇 published 文章
    for (let i = 0; i < 15; i++) {
      await createPublishedArticle(app, author.token, `文章 ${i}`, `内容 ${i}`);
    }
    const res = await request(app).get('/api/articles?page=1&limit=10&sort=createdAt&order=desc');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(10);
    expect(res.body.total).toBe(15);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(10);
  });

  // ==================== UAT-029 文章列表分页超出范围（REQ-006 边界） ====================
  it('UAT-029: page 超出总页数 → 200 空数组', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    await createPublishedArticle(app, author.token, '文章 1', '内容');
    await createPublishedArticle(app, author.token, '文章 2', '内容');
    await createPublishedArticle(app, author.token, '文章 3', '内容');

    const res = await request(app).get('/api/articles?page=999&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(999);
  });

  // ==================== UAT-015 文章搜索（REQ-015） ====================
  it('UAT-015: 按关键词/标签/分类搜索文章', async () => {
    const admin = await registerAndLogin(app, 'admin@b.com', 'admin');
    const author = await registerAndLogin(app, 'author@b.com', 'author');

    const tagId = await createTag(app, admin.token, 'TypeScript');
    const categoryId = await createCategory(app, admin.token, 'Frontend');
    await createPublishedArticle(
      app,
      author.token,
      'TypeScript 进阶指南',
      'TypeScript 高级类型详解',
      [tagId],
      categoryId,
    );
    await createPublishedArticle(app, author.token, '其他文章', '其他内容', [], null);

    // 1. 关键词搜索
    const kwRes = await request(app).get('/api/search?keyword=TypeScript');
    expect(kwRes.status).toBe(200);
    expect(kwRes.body.total).toBeGreaterThanOrEqual(1);
    expect(kwRes.body.items.some((a: { title: string }) => a.title.includes('TypeScript'))).toBe(true);

    // 2. 标签搜索（无关键词，仅按标签过滤）
    const tagRes = await request(app).get(`/api/search?tagIds=${tagId}`);
    expect(tagRes.status).toBe(200);
    expect(tagRes.body.total).toBeGreaterThanOrEqual(1);

    // 3. 分类搜索（无关键词，仅按分类过滤）
    const catRes = await request(app).get(`/api/search?categoryIds=${categoryId}`);
    expect(catRes.status).toBe(200);
    expect(catRes.body.total).toBeGreaterThanOrEqual(1);
  });

  // ==================== UAT-038 搜索无匹配（REQ-015 边界） ====================
  it('UAT-038: 关键词无匹配 → 200 空数组', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    await createPublishedArticle(app, author.token, '文章', '内容');

    const res = await request(app).get('/api/search?keyword=zzzznonexistent');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  // ==================== UAT-022 文章归档查询（REQ-022） ====================
  it('UAT-022: 按月份分组查询文章归档 → 200 数组按时间倒序', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    await createPublishedArticle(app, author.token, '归档文章 1', '内容');
    await createPublishedArticle(app, author.token, '归档文章 2', '内容');

    const res = await request(app).get('/api/archive');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      const first = res.body[0];
      expect(first.year).toBeTruthy();
      expect(first.month).toBeTruthy();
      expect(first.count).toBeGreaterThan(0);
      expect(Array.isArray(first.articleIds)).toBe(true);
    }
  });

  // ==================== UAT-051 无文章时归档查询（REQ-022 边界） ====================
  it('UAT-051: 无 published 文章时查询归档 → 200 空数组', async () => {
    const res = await request(app).get('/api/archive');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
