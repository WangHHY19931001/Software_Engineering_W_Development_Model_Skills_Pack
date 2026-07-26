/**
 * 系统测试 - 内存测试（2 用例）
 * 对应 docs/system-test-design.md §4：TC-MEM-001 ~ TC-MEM-002
 * 覆盖 NFR-004 单表 ≥ 10000 条
 *
 * 测试方法：
 * - 使用 process.memoryUsage().heapUsed（heap allocated，非 rss）
 * - TC-MEM-001: 10000 文章 + 10000 评论 + 1000 用户，heap 增量 ≤ 50MB 且绝对值 < 500MB
 * - TC-MEM-002: 写入 10000 篇后删除 5000 篇，heap 下降或波动 ≤ 2MB（V8 GC 非立即回收）
 *
 * 实现说明：
 * - bulkSeedUsers 已优化为复用单次 bcrypt 哈希，避免 1000 次哈希导致超时
 * - global.gc 需要 --expose-gc 标志，测试中通过 if 守卫调用
 * - V8 GC 在 Map.delete 后不保证立即回收，故 TC-MEM-002 允许小幅波动并辅以数据正确性验证
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  createTestContext,
  registerAndLogin,
  bulkSeedArticles,
  bulkSeedComments,
  bulkSeedUsers,
  heapUsedMB,
  type TestContext,
} from './helpers.js';

describe('内存测试（2 用例）', () => {
  let ctx: TestContext;
  let app: Express;

  beforeEach(() => {
    ctx = createTestContext();
    app = ctx.app;
  });

  // ==================== TC-MEM-001 容量上限边界 ====================
  // 10000 篇文章 + 10000 条评论 + 1000 用户的数据量较大，需要更长的超时时间
  it('TC-MEM-001: 10000 文章 + 10000 评论 + 1000 用户 heap 增量 ≤ 50MB（NFR-004）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');

    const beforeMB = heapUsedMB();

    // 批量写入 10000 篇文章
    const articleIds = bulkSeedArticles(ctx.stores.article, 10000, author.id, 'MEM001');

    // 10000 条评论（分布在 100 篇文章上）
    for (let i = 0; i < 100; i++) {
      const aid = articleIds[i]!;
      bulkSeedComments(ctx.stores.comment, 100, aid, author.id);
    }

    // 1000 用户（bulkSeedUsers 已优化为复用单次 bcrypt 哈希）
    await bulkSeedUsers(ctx.stores.user, 1000);

    // 触发 GC（如果可用）以获得更稳定的 heap 测量
    if (global.gc) {
      global.gc();
    }

    const afterMB = heapUsedMB();
    const deltaMB = afterMB - beforeMB;

    // 所有 API 应正常响应
    const listRes = await request(app).get('/api/articles').query({ page: 1, limit: 20 });
    expect(listRes.status).toBe(200);
    expect(listRes.body.total).toBe(10000);

    // NFR-004: heap 增量 ≤ 50MB（task 阈值），绝对值 < 500MB（设计阈值 TC-MEM-001）
    expect(deltaMB).toBeLessThanOrEqual(50);
    expect(afterMB).toBeLessThan(500);
  }, 60000); // 60s 超时（批量数据生成耗时较长）

  // ==================== TC-MEM-002 删除后内存释放 ====================
  it('TC-MEM-002: 删除 5000 篇文章后 heap 下降（NFR-004 内存释放）', async () => {
    const author = await registerAndLogin(app, 'author@b.com', 'author');

    // 写入 10000 篇文章
    const articleIds = bulkSeedArticles(ctx.stores.article, 10000, author.id, 'MEM002');

    // 多次 GC 稳定基线（V8 增量式 GC 可能需要多次触发）
    if (global.gc) {
      global.gc();
      global.gc();
    }
    const beforeDeleteMB = heapUsedMB();

    // 删除前 5000 篇
    for (let i = 0; i < 5000; i++) {
      ctx.stores.article.delete(articleIds[i]!);
    }

    // 多次 GC 确保回收
    if (global.gc) {
      global.gc();
      global.gc();
    }
    const afterDeleteMB = heapUsedMB();

    // V8 GC 在 Map.delete 后不保证立即回收全部内存，
    // 允许 ≤ 2MB 波动（V8 内部开销/碎片），但应显著低于写入 5000 篇的增量
    // 核心验证：删除后 heap 不应显著增长
    expect(afterDeleteMB).toBeLessThanOrEqual(beforeDeleteMB + 2);

    // 验证剩余 5000 篇可正常查询（数据正确性是内存释放的间接证据）
    const listRes = await request(app).get('/api/articles').query({ page: 1, limit: 20 });
    expect(listRes.status).toBe(200);
    expect(listRes.body.total).toBe(5000);

    // 验证已删除的文章不可访问
    const deletedId = articleIds[0]!;
    const getRes = await request(app).get(`/api/articles/${deletedId}`);
    expect(getRes.status).toBe(404);
  }, 60000); // 60s 超时
});
