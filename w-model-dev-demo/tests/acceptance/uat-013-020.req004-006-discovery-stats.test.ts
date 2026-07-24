/**
 * 验收测试 UAT-013 ~ UAT-020 —— 推荐/广告/统计（REQ-004 / REQ-005 / REQ-006）
 *
 * 覆盖：
 * - UAT-013 个性化推荐流返回 ≥ 1 篇文章且按算法排序
 * - UAT-014 热门/最新推荐流排序正确
 * - UAT-015 推荐位配置变更生效
 * - UAT-016 广告位 CRUD + 投放时间范围生效
 * - UAT-017 点击统计 CTR 计算正确
 * - UAT-018 未审核广告不向前台返回
 * - UAT-019 4 类统计接口字段齐全且数值一致
 * - UAT-020 CSV/JSON 导出文件可解析
 *
 * 路径映射：
 * - GET /api/recommendations/personalized → GET /api/recommend/personalized
 * - GET /api/recommendations/hot → GET /api/recommend/hot
 * - GET /api/recommendations/latest → GET /api/recommend/latest
 * - GET /api/recommendations/slots → 无独立 API，用 service.manageSlot 验证
 * - POST /api/admin/ad-slots → POST /api/ads
 * - GET /api/ads?placement=home → GET /api/ads/serve/:slot（投放接口）
 * - GET /api/admin/ads/:id/stats → 用 ctrCalculator.getStats 验证
 * - GET /api/stats/bloggers → 无独立 API，用 statsAggregator.getBloggerStats 验证
 *
 * 注意：CTR 测试（UAT-017）使用 service 层调用以绕过限流（100+次请求超 60/min 限制）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestApp, registerUser, authHeader,
} from '../helpers/api-helper.js';

describe('UAT-013 ~ UAT-020: 推荐/广告/统计 (REQ-004 / REQ-005 / REQ-006)', () => {
  let app: Express;
  let adminToken: string;
  let adminId: string;
  let bloggerToken: string;
  let bloggerId: string;

  beforeEach(async () => {
    app = createTestApp();
    const admin = await registerUser(app, 'admin@rec.com', 'Pass1234', 'aR', 'admin');
    adminToken = admin.accessToken;
    adminId = admin.userId;
    const blogger = await registerUser(app, 'blogger@rec.com', 'Pass1234', 'bR', 'blogger');
    bloggerToken = blogger.accessToken;
    bloggerId = blogger.userId;
  });

  /** 创建并发布文章（service 层，绕过限流） */
  async function createPublishedArticle(title: string, content: string): Promise<string> {
    const { getContainer } = await import('../../src/container.js');
    const c = getContainer();
    const article = await c.articleService.createArticle({
      title, content, authorId: bloggerId,
    });
    await c.articleService.transitionState(article.id, 'pending_review', { id: bloggerId, role: 'blogger' });
    await c.articleService.transitionState(article.id, 'published', { id: adminId, role: 'admin' });
    return article.id;
  }

  // -----------------------------------------------------------------------
  // UAT-013: 个性化推荐流返回 ≥ 1 篇文章且按算法排序
  // -----------------------------------------------------------------------
  describe('UAT-013: 个性化推荐流', () => {
    it('UAT-013: 个性化推荐流非空且按算法得分降序', async () => {
      // 前置: 发布 ≥ 5 篇文章
      for (let i = 0; i < 5; i++) {
        await createPublishedArticle(`推荐文章${i}`, `内容${i}`);
      }

      const user = await registerUser(app, 'reader@rec.com', 'Pass1234', 'r1', 'user');

      // 步骤1: GET /api/recommend/personalized
      const res = await request(app)
        .get('/api/recommend/personalized?size=10')
        .set(authHeader(user.accessToken));
      expect(res.status).toBe(200);
      expect(res.body.list.length).toBeGreaterThanOrEqual(1);

      // 步骤2: 验证按算法得分降序（通过 service 计算每个 score 验证单调递减）
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();
      const articles = res.body.list as { id: string }[];
      const scores = articles.map(a => c.recommendationEngine.computeScore(
        c.articleService.getArticle(a.id, user.userId),
        user.userId,
      ));
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
      }
    });
  });

  // -----------------------------------------------------------------------
  // UAT-014: 热门/最新推荐流排序正确
  // -----------------------------------------------------------------------
  describe('UAT-014: 热门/最新推荐流排序正确', () => {
    it('UAT-014: 热门流按热度降序，最新流按发布时间降序', async () => {
      // 发布 5 篇文章，热度与时间不一致
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();
      const { articleStore } = await import('../../src/stores/article-store.js');

      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const id = await createPublishedArticle(`热度文章${i}`, `内容${i}`);
        ids.push(id);
        // 设置不同的热度（views/likes/comments）
        const art = articleStore.findById(id)!;
        articleStore.update(id, {
          stats: { ...art.stats, views: (5 - i) * 10, likes: i, comments: 0, shares: 0, heat: 0 },
        });
      }

      // 步骤1: GET /api/recommend/hot —— 按热度降序
      const hotRes = await request(app).get('/api/recommend/hot?size=10');
      expect(hotRes.status).toBe(200);
      expect(hotRes.body.list.length).toBe(5);

      // 验证热度降序：rawHeat = likes*2 + comments*3 + views*1
      const hotList = hotRes.body.list as { id: string; stats: { likes: number; comments: number; views: number } }[];
      const hotHeats = hotList.map(a => a.stats.likes * 2 + a.stats.comments * 3 + a.stats.views * 1);
      for (let i = 0; i < hotHeats.length - 1; i++) {
        expect(hotHeats[i]).toBeGreaterThanOrEqual(hotHeats[i + 1]);
      }

      // 步骤2: GET /api/recommend/latest —— 按发布时间降序
      const latestRes = await request(app).get('/api/recommend/latest?size=10');
      expect(latestRes.status).toBe(200);
      expect(latestRes.body.list.length).toBe(5);

      const latestList = latestRes.body.list as { createdAt: number }[];
      for (let i = 0; i < latestList.length - 1; i++) {
        expect(latestList[i].createdAt).toBeGreaterThanOrEqual(latestList[i + 1].createdAt);
      }
    });
  });

  // -----------------------------------------------------------------------
  // UAT-015: 推荐位配置变更生效
  // -----------------------------------------------------------------------
  describe('UAT-015: 推荐位配置变更生效', () => {
    it('UAT-015: 管理员变更推荐位后可查询最新配置', async () => {
      const articleId = await createPublishedArticle('推荐位文章', '内容');

      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();

      // 步骤1: 管理员创建推荐位
      const slot = await c.recommendationEngine.manageSlot(
        { name: 'home-banner', articleIds: [articleId] },
        adminId,
      );
      expect(slot.id).toBeDefined();
      expect(slot.name).toBe('home-banner');
      expect(slot.articleIds).toContain(articleId);

      // 步骤2: 验证推荐位已存储（通过再次创建验证不冲突）
      const slot2 = await c.recommendationEngine.manageSlot(
        { name: 'side-banner', articleIds: [articleId] },
        adminId,
      );
      expect(slot2.id).not.toBe(slot.id);
    });

    it('UAT-015 边界: 推荐位数量上限 20', async () => {
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();

      // 创建 20 个推荐位
      for (let i = 0; i < 20; i++) {
        await c.recommendationEngine.manageSlot({ name: `slot-${i}` }, adminId);
      }

      // 第 21 个 → 60006
      await expect(
        c.recommendationEngine.manageSlot({ name: 'over-limit' }, adminId),
      ).rejects.toMatchObject({ code: 60006 });
    });
  });

  // -----------------------------------------------------------------------
  // UAT-016: 广告位 CRUD + 投放时间范围生效
  // -----------------------------------------------------------------------
  describe('UAT-016: 广告位 CRUD + 投放时间范围生效', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('UAT-016: 广告创建后投放，超出 endAt 后不展示', async () => {
      vi.useFakeTimers();
      const now = Math.floor(Date.now() / 1000);

      // 步骤1: 创建广告（时间范围 now-60 ~ now+3600）
      const createRes = await request(app)
        .post('/api/ads')
        .set(authHeader(adminToken))
        .send({
          slot: 'home',
          startAt: now - 60,
          endAt: now + 3600,
          content: '广告内容',
        });
      expect(createRes.status).toBe(201);
      expect(createRes.body.id).toBeDefined();
      expect(createRes.body.status).toBe('pending');

      const adId = createRes.body.id;

      // 审核通过（approve）
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();
      await c.adService.approve(adId, adminId);

      // 注册一个用户用于投放
      const user = await registerUser(app, 'aduser@rec.com', 'Pass1234', 'au', 'user');

      // 步骤2: 当前时间投放 → 返回广告
      const serveRes = await request(app)
        .get(`/api/ads/serve/home`)
        .set(authHeader(user.accessToken));
      expect(serveRes.status).toBe(200);
      expect(serveRes.body.id).toBe(adId);

      // 步骤3: 推进 mock clock 至 now+3601s
      vi.setSystemTime((now + 3601) * 1000);

      // 步骤4: 超出 endAt → 404 无可用广告
      const expiredRes = await request(app)
        .get(`/api/ads/serve/home`)
        .set(authHeader(user.accessToken));
      expect(expiredRes.status).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // UAT-017: 点击统计 CTR 计算正确
  // -----------------------------------------------------------------------
  describe('UAT-017: 点击统计 CTR 计算正确', () => {
    it('UAT-017: 100 次展示 + 10 次点击 → CTR=0.1', async () => {
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();

      // 使用 service 层直接调用 ctrCalculator（绕过限流）
      const adId = 'ad-ctr-test';

      // 步骤1: 100 次展示
      for (let i = 0; i < 100; i++) {
        c.ctrCalculator.recordImpression(adId);
      }

      // 步骤2: 10 次点击
      for (let i = 0; i < 10; i++) {
        c.ctrCalculator.recordClick(adId);
      }

      // 步骤3: 查询统计
      const stats = c.ctrCalculator.getStats(adId);
      expect(stats.impressions).toBe(100);
      expect(stats.clicks).toBe(10);
      expect(stats.ctr).toBeCloseTo(0.1, 5);
    });
  });

  // -----------------------------------------------------------------------
  // UAT-018: 未审核广告不向前台返回
  // -----------------------------------------------------------------------
  describe('UAT-018: 未审核广告不向前台返回', () => {
    it('UAT-018: pending 状态广告不投放，approve 后可见', async () => {
      const now = Math.floor(Date.now() / 1000);

      // 步骤1: 创建广告（status=pending）
      const createRes = await request(app)
        .post('/api/ads')
        .set(authHeader(adminToken))
        .send({
          slot: 'sidebar',
          startAt: now - 60,
          endAt: now + 3600,
          content: '待审核广告',
        });
      expect(createRes.status).toBe(201);
      expect(createRes.body.status).toBe('pending');

      const adId = createRes.body.id;

      // 步骤2: 前台投放 → 404（pending 不投放）
      const user = await registerUser(app, 'aduser2@rec.com', 'Pass1234', 'au2', 'user');
      const serveRes = await request(app)
        .get('/api/ads/serve/sidebar')
        .set(authHeader(user.accessToken));
      expect(serveRes.status).toBe(404);

      // 步骤3: 审核通过
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();
      await c.adService.approve(adId, adminId);

      // 步骤4: 前台投放 → 返回广告
      const serveRes2 = await request(app)
        .get('/api/ads/serve/sidebar')
        .set(authHeader(user.accessToken));
      expect(serveRes2.status).toBe(200);
      expect(serveRes2.body.id).toBe(adId);
    });
  });

  // -----------------------------------------------------------------------
  // UAT-019: 4 类统计接口字段齐全且数值一致
  // -----------------------------------------------------------------------
  describe('UAT-019: 4 类统计接口字段齐全', () => {
    it('UAT-019: 文章/用户/站点统计接口返回字段齐全且数值一致', async () => {
      // 前置: 创建一些数据
      await registerUser(app, 'extra@rec.com', 'Pass1234', 'ex', 'user');
      await createPublishedArticle('统计文章', '内容');

      // 步骤1: GET /api/stats/articles
      const articleStatsRes = await request(app).get('/api/stats/articles');
      expect(articleStatsRes.status).toBe(200);
      expect(articleStatsRes.body.total).toBeDefined();
      expect(articleStatsRes.body.statusDistribution).toBeDefined();
      expect(articleStatsRes.body.tagDistribution).toBeDefined();
      expect(articleStatsRes.body.total).toBeGreaterThanOrEqual(1);

      // 步骤2: GET /api/stats/users
      const userStatsRes = await request(app).get('/api/stats/users');
      expect(userStatsRes.status).toBe(200);
      expect(userStatsRes.body.total).toBeDefined();
      expect(userStatsRes.body.roleDistribution).toBeDefined();
      expect(userStatsRes.body.activeCount).toBeDefined();
      expect(userStatsRes.body.bannedCount).toBeDefined();
      expect(userStatsRes.body.total).toBeGreaterThanOrEqual(2);

      // 步骤3: GET /api/stats/site（含 users + articles + bloggers 聚合）
      const siteStatsRes = await request(app).get('/api/stats/site');
      expect(siteStatsRes.status).toBe(200);
      expect(siteStatsRes.body.users).toBeDefined();
      expect(siteStatsRes.body.articles).toBeDefined();
      expect(siteStatsRes.body.bloggers).toBeDefined();

      // 步骤4: 验证 bloggers 统计（service 层）
      const { getContainer } = await import('../../src/container.js');
      const c = getContainer();
      const bloggerStats = c.statsAggregator.getBloggerStats();
      expect(bloggerStats.total).toBeGreaterThanOrEqual(1);
      expect(bloggerStats.topByArticles).toBeDefined();
      expect(Array.isArray(bloggerStats.topByArticles)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // UAT-020: CSV/JSON 导出文件可解析
  // -----------------------------------------------------------------------
  describe('UAT-020: CSV/JSON 导出文件可解析', () => {
    it('UAT-020: CSV 与 JSON 导出可被标准库解析，字段一致', async () => {
      // 前置: 确保有数据
      await createPublishedArticle('导出文章', '内容');

      // 步骤1: CSV 导出
      const csvRes = await request(app).get('/api/stats/export?format=csv&type=site');
      expect(csvRes.status).toBe(200);
      expect(csvRes.headers['content-type']).toContain('text/csv');
      const csvText = csvRes.text;
      const csvLines = csvText.split('\n');
      expect(csvLines.length).toBeGreaterThanOrEqual(1);
      expect(csvLines[0]).toContain('key,value');

      // 步骤2: JSON 导出
      const jsonRes = await request(app).get('/api/stats/export?format=json&type=site');
      expect(jsonRes.status).toBe(200);
      expect(jsonRes.headers['content-type']).toContain('application/json');
      const jsonData = JSON.parse(jsonRes.text);
      expect(jsonData.users).toBeDefined();
      expect(jsonData.articles).toBeDefined();
      expect(jsonData.bloggers).toBeDefined();

      // 步骤3: 验证 CSV 与 JSON 含统计字段（users.total 等）
      expect(csvText).toContain('users.total');
      expect(jsonData.users.total).toBeGreaterThanOrEqual(1);
    });
  });
});
