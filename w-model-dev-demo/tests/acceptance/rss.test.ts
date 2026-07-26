/**
 * 验收测试 - RSS 订阅模块（3 用例）
 * 覆盖 UAT: 020, 047, 048
 * 关联需求: REQ-020
 *
 * 测试方法：supertest → Express app（seam-http），beforeEach 创建独立 container 数据隔离。
 * 实际 API 路径以 docs/uat-path-mapping.md 回填为准。
 * RSS 实际格式为 RSS 2.0（<rss><channel><item>），Content-Type: application/rss+xml。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestContext,
  registerAndLogin,
  createPublishedArticle,
  type AcceptanceTestContext,
} from './helpers.js';

describe('验收测试 - RSS 订阅模块（3 用例）', () => {
  let ctx: AcceptanceTestContext;
  let app: Express;

  beforeEach(() => {
    ctx = createTestContext();
    app = ctx.app;
  });

  // ==================== UAT-020 RSS 订阅输出（REQ-020） ====================
  it('UAT-020: 获取 RSS → 200 application/rss+xml，含 <item> 子元素', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    // 创建 5 篇 published 文章
    for (let i = 0; i < 5; i++) {
      await createPublishedArticle(app, author.token, `RSS 文章 ${i}`, `内容 ${i}`);
    }

    const res = await request(app).get('/api/rss');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('xml');
    // 响应体为合法 RSS XML（含 <rss> 根元素，<item> 子元素）
    expect(res.text).toContain('<rss');
    expect(res.text).toContain('<channel>');
    expect(res.text).toContain('<item>');
    // 仅含 published 文章
    expect(res.text).toContain('RSS 文章');
  });

  // ==================== UAT-047 RSS XML 特殊字符转义（REQ-020 异常） ====================
  it('UAT-047: 文章标题含 XML 特殊字符 → 正确转义', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');
    await createPublishedArticle(
      app,
      author.token,
      '<script>alert("xss")</script> & <b>bold</b>',
      '内容',
    );

    const res = await request(app).get('/api/rss');
    expect(res.status).toBe(200);
    // 特殊字符被转义（&lt; &gt; &amp;）
    expect(res.text).toContain('&lt;script&gt;');
    expect(res.text).toContain('&amp;');
    // 不应包含未转义的 <script>（XSS 防护）
    expect(res.text).not.toContain('<script>alert');
  });

  // ==================== UAT-048 空 RSS Feed（REQ-020 边界） ====================
  it('UAT-048: 无 published 文章 → 200 合法 XML 无 <item>', async () => {
    const res = await request(app).get('/api/rss');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('xml');
    // 合法 XML 根元素，无 item 子元素
    expect(res.text).toContain('<rss');
    expect(res.text).toContain('<channel>');
    expect(res.text).not.toContain('<item>');
  });
});
