# k6 负载测试脚本 - blog-system-demo 性能基线
# 用法：k6 run tests/perf/k6-load-test.js
# 前置：服务端需运行在 http://localhost:3000，并预置文章数据
#
# 期望：
#   - p(95) <= 200ms
#   - error_rate == 0
#   - http_req_failed == 0
#   - actual RPS >= 95 (目标 100 QPS)

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const articleLatency = new Trend('article_latency_ms');

export const options = {
  scenarios: {
    baseline: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { target: 100, duration: '30s' },   // ramp-up
        { target: 100, duration: '2m' },     // sustain（缩短为 2min 便于本地执行）
        { target: 0, duration: '30s' },      // ramp-down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const res = http.get(`${BASE_URL}/api/v1/articles?page=1&pageSize=10`);

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'has items array': (r) => {
      try {
        const body = r.json();
        return Array.isArray(body.items);
      } catch {
        return false;
      }
    },
    'has total field': (r) => {
      try {
        const body = r.json();
        return typeof body.total === 'number';
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!ok);
  articleLatency.add(res.timings.duration);

  sleep(0.01);
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration.values['p(95)'];
  const reqFailed = data.metrics.http_req_failed.values.rate;
  const errors = data.metrics.errors.values.rate;
  const rps = data.metrics.http_reqs.values.rate;

  console.log('\n========== k6 性能基线报告 ==========');
  console.log(`P95 延迟       : ${p95.toFixed(2)} ms  (阈值: ≤ 200ms)`);
  console.log(`HTTP 失败率    : ${(reqFailed * 100).toFixed(2)}%  (阈值: < 1%)`);
  console.log(`业务错误率     : ${(errors * 100).toFixed(2)}%  (阈值: < 1%)`);
  console.log(`实际 RPS       : ${rps.toFixed(2)}  (目标: ≥ 95)`);
  console.log(`总请求数       : ${data.metrics.http_reqs.values.count}`);
  console.log(`总迭代         : ${data.iterations.content}`);
  console.log('======================================\n');

  const pass = p95 <= 200 && reqFailed < 0.01 && errors < 0.01 && rps >= 95;
  console.log(`结论: ${pass ? '✓ 通过' : '✗ 未通过'}`);

  return {};
}
