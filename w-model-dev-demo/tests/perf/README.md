# 性能压测脚本（k6）

> 阶段 7 系统测试性能基线参考脚本。对应 NFR-002 / ST-004 / UAT-013。

## 说明

本目录提供 k6 外部压测脚本 `k6-load-test.js`，用于对 blog-system-demo 读接口做
100 VUs × 30s 负载压测，验证 NFR-002 性能基线（P95 ≤ 200ms，错误率 0，无 5xx）。

**重要**：阶段 7 系统测试已用 **vitest 内近似采样**验证 P95（见
`tests/system/system.test.ts` 的 ST-004：10000 条数据规模下 N=200 次采样，P95 实测
远低于 200ms）。本 k6 脚本为「外部压测参考脚本」，供需要更高保真度负载测试时使用，
**不要求在 CI 中真实执行**（k6 可能未安装）。

## 前置条件

1. 安装 k6：https://k6.io/docs/getting-started/installation/
2. Node.js >= 18，已执行 `npm install`
3. 服务可启动（`npm run dev`，默认监听 3000 端口）

## 数据预置

NFR-002 要求在 10000 条数据规模下验证 P95。压测前需预置 ≥10000 篇文章：

- 方式 A：通过测试钩子直接向 `ArticleStore` 灌入种子数据（参考
  `tests/system/system.test.ts` 的 `seedArticles(10000)` 辅助函数）。
- 方式 B：编写一次性种子脚本调用 `POST /api/v1/articles`（需鉴权）批量创建。

> 公开读接口 `GET /api/v1/articles` 无需鉴权，可直接压测。

## 运行方式

```bash
# 1. 启动服务（独立终端）
npm run dev

# 2. 预置 10000 篇文章（参考 system.test.ts 的 seedArticles 实现）

# 3. 执行 k6 压测（默认 BASE_URL=http://localhost:3000）
k6 run tests/perf/k6-load-test.js

# 可选：指定目标地址
k6 run -e BASE_URL=http://localhost:3000 tests/perf/k6-load-test.js
```

## 负载模型

| 阶段 | 时长 | 目标 VUs |
|---|---|---|
| ramp-up | 10s | 0 → 100 |
| sustain | 10s | 100 |
| ramp-down | 10s | 100 → 0 |

总时长 30s，峰值 100 VUs。

## 阈值（NFR-002）

| 指标 | 阈值 | 说明 |
|---|---|---|
| `http_req_duration` p(95) | < 200ms | 读接口 P95 响应时间 |
| `http_req_failed` rate | === 0 | HTTP 失败率 |
| `errors` rate | === 0 | 自定义业务错误率（非 200 / 5xx） |

## 阶段 7 已验证结果（vitest 内近似采样）

| 指标 | 实测 | 阈值 | 是否达标 |
|---|---|---|---|
| P95 | 4.66ms | ≤ 200ms | ✅ |
| max | 5.84ms | - | - |
| 采样次数 N | 200 | - | - |
| 5xx 数 | 0 | 0 | ✅ |
| 数据规模 | 10000 篇 | 10000 篇 | ✅ |

> 上述结果来自 `npm run test:system` 真实执行，非估算。内存存储 + 单进程事件循环下
> 读接口响应时间稳定在个位数毫秒级，远低于 200ms 阈值。
