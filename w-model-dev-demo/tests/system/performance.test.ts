/**
 * 系统测试 · 性能基线（ST-029~031，TC-DES-008 型，NFR-001 testThreshold）
 * 度量环境：CI/验收环境（vitest + supertest 直连，不启真实端口——进程内请求，无网络开销）。
 * 基线阈值：P95 ≤ 2000ms（10 倍放宽）；生产目标 P95 ≤ 200ms 仅登记不断言。
 * 负载模型：预热 30 次 → 100 并发 × 10 轮（等价取样 1000 样本）→ P95 + 错误率 0 断言。
 * 数据规模：seed 100 篇已发布文章（与 ST-004/017 seed 同语义）。
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestEnv, seedUser, seedTag, seedArticle, seedReadingRecord, login, bearer, runLoad } from './helpers';

const P95_THRESHOLD_MS = 2000;

/** seed 100 篇已发布文章（含 2 篇 nodejs 标签，供推荐候选）+ 差异化阅读记录 */
function seedPerfData(env: ReturnType<typeof createTestEnv>): void {
  seedTag(env.stores, 'nodejs');
  seedTag(env.stores, 'typescript');
  for (let i = 0; i < 100; i += 1) {
    const tags = i % 2 === 0 ? ['nodejs'] : ['typescript'];
    seedArticle(env.stores, {
      id: `PA${i}`,
      authorId: env.stores.userStore.findBloggers()[0].id,
      title: `性能基线文章${i}`,
      body: `performance 正文 ${i}`, // 供 ST-030 搜索命中
      summary: `摘要 ${i}`,
      tags,
      status: 'published',
    });
  }
  const now = Date.now();
  // 差异化阅读记录：PA0 最高（热门/推荐候选排序源）
  for (let i = 0; i < 30; i += 1) {
    seedReadingRecord(env.stores, { articleId: 'PA0', clientIp: `10.29.0.${i}`, viewedAt: new Date(now - i * 3600000).toISOString() });
  }
}

async function warmUp(app: ReturnType<typeof createTestEnv>['app'], url: string, count = 30): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    const res = await request(app).get(url);
    expect([200, 401]).toContain(res.status);
  }
}

describe('ST-029 性能基线：浏览列表接口 P95 ≤ 2000ms（性能基线，NFR-001/REQ-017）', () => {
  it('GET /api/articles 100 并发 × 10 轮（1000 样本）：P95 ≤ 2000ms、错误率 0', async () => {
    // 性能度量环境声明：放宽通用限流阈值（NFR-006 限流不参与 P95 度量；取样量 1030 > 生产阈值 100/min）
    const env = createTestEnv({ rateLimitApi: { limit: 100000, windowMs: 60000 } });
    const blogger = await seedUser(env.stores, { username: 'st29_blogger', email: 'st29b@example.com', role: 'blogger' });
    seedPerfData(env);

    // 1 预热：30 次请求无异常
    await warmUp(env.app, '/api/articles?page=1&pageSize=20');

    // 2 施加负载：100 并发 × 10 轮（等价取样 1000 样本）
    const result = await runLoad(
      () => request(env.app).get('/api/articles?page=1&pageSize=20'),
      100,
      10,
    );

    // 3 计算 P95：≤ 2000ms（测试基线）；错误率 0、无崩溃
    expect(result.errorRate).toBe(0);
    expect(result.p95).toBeLessThanOrEqual(P95_THRESHOLD_MS);
    // 4 记录基线（生产目标 200ms 仅登记：P95 实测值写入测试报告）
    console.info(`[ST-029] GET /api/articles P95=${result.p95}ms 样本数=${result.times.length} 错误率=${result.errorRate}`);
    void blogger;
  }, 60000);
});

describe('ST-030 性能基线：全文搜索接口 P95 ≤ 2000ms（性能基线，NFR-001/REQ-023）', () => {
  it('GET /api/search 100 并发 × 10 轮（1000 样本）：P95 ≤ 2000ms、错误率 0', async () => {
    // 性能度量环境声明：放宽通用限流阈值（NFR-006 限流不参与 P95 度量；取样量 1030 > 生产阈值 100/min）
    const env = createTestEnv({ rateLimitApi: { limit: 100000, windowMs: 60000 } });
    const blogger = await seedUser(env.stores, { username: 'st30_blogger', email: 'st30b@example.com', role: 'blogger' });
    seedPerfData(env);
    // seam-STORE：搜索索引同步（发布事件等价 seed，ST-019 同语义）
    for (let i = 0; i < 100; i += 1) {
      const id = `PA${i}`;
      const article = env.stores.articleStore.findById(id)!;
      env.stores.searchIndexStore.index(id, {
        title: article.title,
        body: article.body,
        summary: article.summary,
        tags: article.tags,
      });
    }

    // 1 预热：30 次搜索无异常
    await warmUp(env.app, '/api/search?q=performance&page=1');

    // 2 施加负载：100 并发 × 10 轮
    const result = await runLoad(
      () => request(env.app).get('/api/search?q=performance&page=1'),
      100,
      10,
    );

    // 3 P95 ≤ 2000ms；错误率 0
    expect(result.errorRate).toBe(0);
    expect(result.p95).toBeLessThanOrEqual(P95_THRESHOLD_MS);
    console.info(`[ST-030] GET /api/search P95=${result.p95}ms 样本数=${result.times.length} 错误率=${result.errorRate}`);
    void blogger;
  }, 60000);
});

describe('ST-031 性能基线：个性化推荐接口 P95 ≤ 2000ms（性能基线，NFR-001/REQ-022）', () => {
  it('GET /api/me/recommendations（带阅读历史 JWT）100 并发 × 10 轮：P95 ≤ 2000ms、错误率 0', async () => {
    // 性能度量环境声明：放宽通用限流阈值（NFR-006 限流不参与 P95 度量；取样量 1030 > 生产阈值 100/min）
    const env = createTestEnv({ rateLimitApi: { limit: 100000, windowMs: 60000 } });
    const blogger = await seedUser(env.stores, { username: 'st31_blogger', email: 'st31b@example.com', role: 'blogger' });
    const reader = await seedUser(env.stores, { username: 'st31_reader', email: 'st31r@example.com' });
    seedPerfData(env);
    // 读者阅读历史（偏好 nodejs，PA0 已读；PA2 等 nodejs 文章为推荐候选）
    seedReadingRecord(env.stores, { articleId: 'PA0', clientIp: '10.31.0.1', userId: reader.id, viewedAt: new Date().toISOString() });
    const session = await login(env.app, 'st31r@example.com');

    // 1 预热：30 次推荐请求无异常
    await warmUp(env.app, '/api/me/recommendations', 30);

    // 2 施加负载：100 并发 × 10 轮（带 JWT）
    const fire = () =>
      request(env.app)
        .get('/api/me/recommendations')
        .query({ limit: 10 })
        .set(bearer(session.token));
    const result = await runLoad(fire, 100, 10);

    // 3 P95 ≤ 2000ms；错误率 0
    expect(result.errorRate).toBe(0);
    expect(result.p95).toBeLessThanOrEqual(P95_THRESHOLD_MS);
    console.info(`[ST-031] GET /api/me/recommendations P95=${result.p95}ms 样本数=${result.times.length} 错误率=${result.errorRate}`);
    void blogger;
  }, 60000);
});
