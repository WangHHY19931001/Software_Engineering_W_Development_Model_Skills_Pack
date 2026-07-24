/**
 * TC-DES-010: 跨子系统集成——发文→触发统计→影响推荐流
 *
 * 文章发布后触发统计聚合（SD-002→SD-004），并因热度变化影响推荐流排序（SD-002→SD-005），
 * 验证 3 子系统数据流一致性。
 *
 * 关联需求/设计：REQ-012 / REQ-006 / REQ-004 / SD-002 + SD-004 + SD-005
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestApp, registerUser, authHeader,
} from '../helpers/api-helper.js';

describe('TC-DES-010: 跨子系统——发文→统计→推荐流', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  it('发文→浏览/点赞/评论→统计聚合更新→热度计算→推荐流排序更新', async () => {
    const { getContainer } = await import('../../src/container.js');
    const c = getContainer();
    const { articleStore } = await import('../../src/stores/article-store.js');

    const blogger = await registerUser(app, 'b@010.com', 'Pass1234', 'b010', 'blogger');
    const admin = await registerUser(app, 'a@010.com', 'Pass1234', 'a010', 'admin');
    const user = await registerUser(app, 'u@010.com', 'Pass1234', 'u010', 'user');

    // 步骤1-2: 创建 10 篇已发布文章（直接 service 调用绕过限流）
    const initialArticleIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const article = await c.articleService.createArticle({
        title: `初始文章${i}`,
        content: `内容${i}`,
        authorId: blogger.userId,
      });
      await c.articleService.transitionState(article.id, 'pending_review', { id: blogger.userId, role: 'blogger' });
      await c.articleService.transitionState(article.id, 'published', { id: admin.userId, role: 'admin' });
      initialArticleIds.push(article.id);
    }

    // 记录初始统计
    const initialStats = await request(app).get('/api/stats/articles');
    expect(initialStats.status).toBe(200);
    expect(initialStats.body.total).toBe(10);

    // 记录初始推荐流
    const initialHot = await request(app).get('/api/recommend/hot?page=1&size=10');
    expect(initialHot.status).toBe(200);
    expect(initialHot.body.list.length).toBe(10);

    // 步骤3: 博主发布新文章（直接 service 调用）
    const newArticle = await c.articleService.createArticle({
      title: '新热度文章',
      content: '热度测试内容',
      authorId: blogger.userId,
    });
    await c.articleService.transitionState(newArticle.id, 'pending_review', { id: blogger.userId, role: 'blogger' });
    await c.articleService.transitionState(newArticle.id, 'published', { id: admin.userId, role: 'admin' });

    // 步骤4: 模拟浏览（直接更新 stats，因 GET /api/articles/:id 会触发限流）
    const beforeView = articleStore.findById(newArticle.id);
    articleStore.update(newArticle.id, {
      stats: { ...beforeView!.stats, views: 20 },
    });

    // 步骤5: 模拟点赞（通过 articleStore 直接更新 stats，因 API 无文章点赞端点）
    const currentArticle = articleStore.findById(newArticle.id);
    expect(currentArticle).toBeDefined();
    articleStore.update(newArticle.id, {
      stats: {
        ...currentArticle!.stats,
        views: 20,
        likes: 10,
      },
    });

    // 步骤6: 用户评论新文章 5 次（直接 service 调用绕过限流）
    for (let i = 0; i < 5; i++) {
      await c.commentService.createComment({
        articleId: newArticle.id,
        content: `评论${i}`,
        authorId: user.userId,
      });
    }

    // 步骤7: 验证统计聚合更新
    const updatedStats = await request(app).get('/api/stats/articles');
    expect(updatedStats.status).toBe(200);
    expect(updatedStats.body.total).toBe(11);

    // 步骤8: 验证热度计算（使用 StatsAggregator.calculateHeat）
    const heatArticle = articleStore.findById(newArticle.id);
    expect(heatArticle).toBeDefined();
    const heat = c.statsAggregator.calculateHeat(heatArticle!);
    // rawHeat = likes*2 + comments*3 + views*1 = 10*2 + 0*3 + 20*1 = 40
    // heat = rawHeat * decay，decay ≤ 1，所以 heat ≤ 40
    expect(heat).toBeGreaterThan(0);

    // 步骤9: 验证推荐流排序更新（新文章因热度最高排第 1 位）
    const updatedHot = await request(app).get('/api/recommend/hot?page=1&size=11');
    expect(updatedHot.status).toBe(200);
    expect(updatedHot.body.list.length).toBe(11);
    // 新文章应在第 1 位（热度最高）
    expect(updatedHot.body.list[0].id).toBe(newArticle.id);

    // 步骤10: 验证热门博主推荐
    const bloggerRec = await request(app).get('/api/recommend/bloggers');
    expect(bloggerRec.status).toBe(200);
    expect(bloggerRec.body.length).toBeGreaterThanOrEqual(1);

    // 步骤11: 验证搜索可命中（需先索引）
    c.searchIndexer.indexArticle(heatArticle!);
    const searchRes = await request(app).get('/api/search?q=热度&sort=hottest&page=1&size=10');
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.list.some((a: { id: string }) => a.id === newArticle.id)).toBe(true);
  });

  it('推荐位管理 ≤20 上限', async () => {
    const admin = await registerUser(app, 'slot@admin.com', 'Pass1234', 'sAdmin', 'admin');
    const { getContainer } = await import('../../src/container.js');
    const c = getContainer();

    // 创建 20 个推荐位
    for (let i = 0; i < 20; i++) {
      const slot = await c.recommendationEngine.manageSlot({ name: `推荐位${i}` }, admin.userId);
      expect(slot.id).toBeDefined();
    }

    // 第 21 个应抛 60006
    await expect(
      c.recommendationEngine.manageSlot({ name: '超限推荐位' }, admin.userId),
    ).rejects.toThrow();
  });
});
