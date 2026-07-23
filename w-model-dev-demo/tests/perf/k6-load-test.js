/**
 * k6 性能压测脚本（ST-004 / UAT-013 参考脚本）
 *
 * 用途：对 blog-system-demo 读接口做 100 VUs × 30s 负载压测，验证 NFR-002
 *      P95 ≤ 200ms、错误率 0、无 5xx。
 *
 * 注意：
 *   - 本脚本是「外部压测参考脚本」，不要求在 CI 中真实执行（k6 可能未安装）。
 *   - 阶段 7 系统测试已用 vitest 内近似采样验证 P95（见 tests/system/system.test.ts ST-004）。
 *   - 运行前需先启动服务：npm run dev（默认监听 3000 端口）。
 *   - 压测前需预置数据规模（10000 篇文章）。本脚本通过 /api/v1/articles 公开接口
 *     只读压测；数据预置请通过测试钩子或种子脚本完成。
 *
 * 运行方式：
 *   1. 安装 k6：https://k6.io/docs/getting-started/installation/
 *   2. 启动服务并预置 ≥10000 篇文章
 *   3. 执行：k6 run tests/perf/k6-load-test.js
 *
 * 阈值（NFR-002）：
 *   - p(95) <= 200
 *   - http_req_failed === 0
 *   - no 5xx
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// 自定义指标
const errorRate = new Rate('errors');
const listLatency = new Trend('list_latency_ms');

// 负载模型：ramp-up 10s → sustain 100 VUs 10s → ramp-down 10s（总 30s）
export const options = {
  stages: [
    { duration: '10s', target: 100 }, // ramp-up 到 100 VUs
    { duration: '10s', target: 100 }, // sustain 100 VUs
    { duration: '10s', target: 0 }, // ramp-down
  ],
  thresholds: {
    // NFR-002 验收阈值
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate===0'],
    errors: ['rate===0'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // 读接口压测：GET /api/v1/articles?page=1&pageSize=10（公开，无需鉴权）
  const res = http.get(`${BASE_URL}/api/v1/articles?page=1&pageSize=10`);

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'has items array': (r) => typeof r.json('items') !== 'undefined',
    'has total field': (r) => typeof r.json('total') === 'number',
    'no 5xx': (r) => r.status < 500,
  });

  errorRate.add(!ok);
  listLatency.add(res.timings.duration);

  if (!ok) {
    console.error(`请求失败 status=${res.status} body=${res.body}`);
  }

  sleep(0.01); // 轻微 pacing，避免打满事件循环
}

export function handleSummary(data) {
  return {
    stdout: `
═══════════════════════════════════════════════════
k6 性能压测摘要（ST-004 / UAT-013）
═══════════════════════════════════════════════════
P95 响应时间: ${data.metrics.http_req_duration['p(95)'].toFixed(2)} ms  (阈值 ≤ 200ms)
HTTP 失败率:  ${(data.metrics.http_req_failed.rate * 100).toFixed(2)}%  (阈值 0%)
自定义错误率: ${(data.metrics.errors.rate * 100).toFixed(2)}%  (阈值 0%)
总请求数:    ${data.metrics.http_reqs.count}
平均 RPS:    ${data.metrics.http_reqs.rate.toFixed(2)}
═══════════════════════════════════════════════════
`,
  };
}
