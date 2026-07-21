/**
 * k6 性能基线压测脚本。
 *
 * 设计来源：docs/system-design.md §5.1 ST-003（k6 100 QPS × 10min 性能基线）。
 * 本脚本为独立性能基线测试，由 k6 二进制直接执行（不依赖 npm install / vitest 套件）。
 *
 * 覆盖接口：
 *   1. GET  /api/v1/articles?page=1&pageSize=10  —— 文章列表（公开）
 *   2. GET  /api/v1/articles/:id                  —— 文章详情（公开）
 *   3. POST /api/v1/auth/login                    —— 登录（公开）
 *
 * 压测模型：
 *   - 100 VUs × 30s（ramp-up 10s → sustain 10s → ramp-down 10s）
 *   - 阈值：P95 < 200ms，http_req_failed rate === 0
 *
 * 用法：
 *   k6 run tests/perf/k6-load-test.js
 *   # 自定义目标 URL
 *   k6 run -e BASE_URL=http://localhost:3000 tests/perf/k6-load-test.js
 *
 * 前置条件：
 *   - 被测服务已启动（npm run dev 或 npm start）
 *   - 服务端口默认 3000，可通过 BASE_URL 环境变量覆盖
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── 配置 ────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_PREFIX = '/api/v1';

// 自定义指标：各接口响应时间趋势
const listDuration = new Trend('list_duration', true);
const detailDuration = new Trend('detail_duration', true);
const loginDuration = new Trend('login_duration', true);

// 自定义指标：业务成功率（HTTP 200 + 非 5xx）
const bizSuccessRate = new Rate('biz_success_rate');

// ─── 压测选项 ────────────────────────────────────────────────
export const options = {
  // 100 VUs × 30s（ramp-up → sustain → ramp-down）
  stages: [
    { duration: '10s', target: 100 }, // ramp-up：10s 内爬升至 100 VUs
    { duration: '10s', target: 100 }, // sustain：100 VUs 持续 10s
    { duration: '10s', target: 0 }, // ramp-down：10s 内降至 0
  ],
  thresholds: {
    // 设计阈值：P95 < 200ms（NFR-002）
    http_req_duration: ['p(95)<200'],
    // 失败率 === 0（无 5xx / 网络错误）
    http_req_failed: ['rate===0'],
    // 业务成功率 ≥ 99%
    biz_success_rate: ['rate>=0.99'],
    // 子指标 P95 同样 < 200ms
    list_duration: ['p(95)<200'],
    detail_duration: ['p(95)<200'],
    login_duration: ['p(95)<200'],
  },
};

// ─── setup：预置用户 + 文章 ─────────────────────────────────
// 在压测开始前注册一个测试用户 + 创建一篇文章，供 default 函数复用
export function setup() {
  // 1. 注册测试用户（若已存在则忽略 409）
  const registerRes = http.post(
    `${BASE_URL}${API_PREFIX}/auth/register`,
    JSON.stringify({
      username: 'k6_perf_user',
      password: 'PerfTest123!',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  // 409 表示用户已存在，属正常情况
  if (registerRes.status !== 201 && registerRes.status !== 409) {
    console.error(`setup register failed: status=${registerRes.status}, body=${registerRes.body}`);
  }

  // 2. 登录获取 JWT
  const loginRes = http.post(
    `${BASE_URL}${API_PREFIX}/auth/login`,
    JSON.stringify({
      username: 'k6_perf_user',
      password: 'PerfTest123!',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  const token = loginRes.json('token');
  if (!token) {
    console.error(`setup login failed: status=${loginRes.status}, body=${loginRes.body}`);
    return { token: '', articleId: '' };
  }

  // 3. 创建一篇文章供详情接口压测
  const createRes = http.post(
    `${BASE_URL}${API_PREFIX}/articles`,
    JSON.stringify({
      title: 'k6 perf test article',
      content: 'This article is created by k6 load test setup for detail endpoint benchmarking.',
      tags: ['perf', 'k6'],
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const articleId = createRes.json('articleId') || '';

  console.info(`setup done: token=${token ? 'OK' : 'MISSING'}, articleId=${articleId || 'MISSING'}`);

  return { token, articleId };
}

// ─── default：压测主循环 ────────────────────────────────────
// 每个 VU 反复调用 3 个接口，循环至 stages 结束
export default function (data) {
  const { token, articleId } = data;

  // ── 接口 1：GET /articles（文章列表，公开） ──
  group('list articles', () => {
    const res = http.get(`${BASE_URL}${API_PREFIX}/articles?page=1&pageSize=10`);
    listDuration.add(res.timings.duration);
    const ok = check(res, {
      'list status 200': r => r.status === 200,
      'list has items array': r => {
        try {
          const body = r.json();
          return Array.isArray(body.items) || Array.isArray(body.data);
        } catch {
          return false;
        }
      },
    });
    bizSuccessRate.add(ok);
  });

  // ── 接口 2：GET /articles/:id（文章详情，公开） ──
  if (articleId) {
    group('get article detail', () => {
      const res = http.get(`${BASE_URL}${API_PREFIX}/articles/${articleId}`);
      detailDuration.add(res.timings.duration);
      const ok = check(res, {
        'detail status 200': r => r.status === 200,
        'detail has articleId': r => {
          try {
            return r.json('articleId') === articleId;
          } catch {
            return false;
          }
        },
      });
      bizSuccessRate.add(ok);
    });
  }

  // ── 接口 3：POST /auth/login（登录，公开） ──
  group('login', () => {
    const res = http.post(
      `${BASE_URL}${API_PREFIX}/auth/login`,
      JSON.stringify({
        username: 'k6_perf_user',
        password: 'PerfTest123!',
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    loginDuration.add(res.timings.duration);
    const ok = check(res, {
      'login status 200': r => r.status === 200,
      'login has token': r => {
        try {
          return typeof r.json('token') === 'string';
        } catch {
          return false;
        }
      },
    });
    bizSuccessRate.add(ok);
  });

  // 每次迭代间短暂暂停（模拟用户思考时间，避免空转打满 CPU）
  sleep(0.05);
}

// ─── teardown：清理（可选） ─────────────────────────────────
export function teardown(data) {
  // demo 项目使用内存存储，进程重启即清空，无需显式清理
  console.info('k6 load test teardown: skipped (in-memory store, no cleanup needed)');
}
