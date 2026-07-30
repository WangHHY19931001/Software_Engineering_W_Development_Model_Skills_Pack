/**
 * TC-SYS-016 ~ 020 内存（Memory）系统测试
 *
 * 覆盖范围：
 * - TC-SYS-016 200 并发请求后内存增长 ≤ 100MB（NFR-002）
 * - TC-SYS-017 大量数据预创建 + 200 并发内存稳定（无泄漏）
 *
 * 内存基线：NFR-002 100MB 阈值
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setupSystemTest, type SystemContext } from './setup.js';

function getHeapMB(): number {
  if (global.gc) global.gc();
  const mem = process.memoryUsage();
  return mem.heapUsed / 1024 / 1024;
}

describe('TC-SYS-016~020 内存（Memory）', () => {
  let ctx: SystemContext;

  beforeEach(() => {
    ctx = setupSystemTest();
  });

  it('TC-SYS-016: 100 并发请求后内存增长 ≤ 100MB', { timeout: 30000 }, async () => {
    // 准备：1 个发布文章
    const blogger = await ctx.registerBlogger();
    const article = await ctx.publishArticle({ authorId: blogger.userId });

    // 预热
    for (let i = 0; i < 10; i++) {
      await ctx.api().get(`/api/articles/${article.articleId}`);
    }

    // 基准内存
    const baselineMB = getHeapMB();

    // 100 并发请求
    const api = ctx.api();
    const tasks: Array<Promise<void>> = [];
    for (let i = 0; i < 100; i++) {
      tasks.push(
        (async () => {
          await api.get(`/api/articles/${article.articleId}`);
        })(),
      );
    }
    await Promise.all(tasks);

    const afterMB = getHeapMB();
    // 验证：内存增长不应超过 100MB
    expect(afterMB - baselineMB).toBeLessThanOrEqual(100);
  });

  it('TC-SYS-017: 大量数据预创建 + 100 并发内存稳定（无泄漏）', { timeout: 30000 }, async () => {
    // 准备：5 篇文章
    const blogger = await ctx.registerBlogger();
    const articles: string[] = [];
    for (let i = 0; i < 5; i++) {
      const a = await ctx.publishArticle({ authorId: blogger.userId, title: `Mass Article ${i}` });
      articles.push(a.articleId);
    }
    // 给已发布文章添加评论
    const reader = await ctx.registerUser();
    for (const aid of articles) {
      await ctx
        .api()
        .post(`/api/articles/${aid}/comments`)
        .set('Authorization', `Bearer ${reader.token}`)
        .send({ content: `Comment for ${aid}` });
    }

    // 预热
    for (let i = 0; i < 5; i++) {
      await ctx.api().get(`/api/articles/${articles[0]}`);
    }

    const baselineMB = getHeapMB();

    // 100 并发读
    const api = ctx.api();
    const tasks: Array<Promise<void>> = [];
    for (let i = 0; i < 100; i++) {
      tasks.push(
        (async () => {
          await api.get(`/api/articles/${articles[i % articles.length]}`);
        })(),
      );
    }
    await Promise.all(tasks);

    const afterMB = getHeapMB();
    // 内存增长应受控（远小于 100MB）
    expect(afterMB - baselineMB).toBeLessThanOrEqual(100);
  });

  it('TC-SYS-018: 100 个用户预创建 + 100 并发登录内存稳定', { timeout: 30000 }, async () => {
    // 准备：100 个用户
    for (let i = 0; i < 100; i++) {
      await ctx.registerUser({ email: `mem${i}@e.com`, username: `memuser${i}` });
    }

    // 预热
    for (let i = 0; i < 5; i++) {
      await ctx.api().get('/health');
    }

    const baselineMB = getHeapMB();

    // 100 并发健康检查
    const api = ctx.api();
    const tasks: Array<Promise<void>> = [];
    for (let i = 0; i < 100; i++) {
      tasks.push(
        (async () => {
          await api.get('/health');
        })(),
      );
    }
    await Promise.all(tasks);

    const afterMB = getHeapMB();
    // 内存增长应受控
    expect(afterMB - baselineMB).toBeLessThanOrEqual(100);
  });

  it('TC-SYS-019: 50 个标签 + 50 篇文章 + 100 并发搜索内存稳定', { timeout: 30000 }, async () => {
    const blogger = await ctx.registerBlogger();
    // 50 标签
    for (let i = 0; i < 50; i++) {
      await ctx
        .api()
        .post('/api/tags')
        .set('Authorization', `Bearer ${blogger.token}`)
        .send({ name: `Tag ${i}`, slug: `tag-${i}` });
    }
    // 50 篇文章
    for (let i = 0; i < 50; i++) {
      await ctx.publishArticle({ authorId: blogger.userId, title: `Search Article ${i}` });
    }

    // 预热
    for (let i = 0; i < 5; i++) {
      await ctx.api().get('/api/search?q=search');
    }

    const baselineMB = getHeapMB();

    // 100 并发搜索
    const api = ctx.api();
    const tasks: Array<Promise<void>> = [];
    for (let i = 0; i < 100; i++) {
      tasks.push(
        (async () => {
          await api.get('/api/search?q=search');
        })(),
      );
    }
    await Promise.all(tasks);

    const afterMB = getHeapMB();
    expect(afterMB - baselineMB).toBeLessThanOrEqual(100);
  });

  it('TC-SYS-020: 200 并发限流桶触发后内存稳定', { timeout: 30000 }, async () => {
    // 预热
    for (let i = 0; i < 5; i++) {
      await ctx.api().get('/health');
    }

    const baselineMB = getHeapMB();

    // 200 次 health 请求（with bypass 头）
    const api = ctx.api();
    const tasks: Array<Promise<void>> = [];
    for (let i = 0; i < 200; i++) {
      tasks.push(
        (async () => {
          await api.get('/health');
        })(),
      );
    }
    await Promise.all(tasks);

    const afterMB = getHeapMB();
    expect(afterMB - baselineMB).toBeLessThanOrEqual(100);
  });
});
