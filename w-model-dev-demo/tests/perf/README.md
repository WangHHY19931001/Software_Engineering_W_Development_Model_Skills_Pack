# 性能基线测试说明

## 1. 目的

验证 NFR-002：读接口 P95 ≤ 200ms（关联 ST-003 系统测试用例）。

## 2. 工具选型

- **主工具**：k6（Go 实现的高性能负载测试工具，与 vitest 测试解耦）
- **次工具**：vitest + supertest 内置的 ST-003 系统测试（200 次采样）

选择 k6 而非 autocannon 的理由：
1. k6 原生支持 ramping-arrival-rate 模型，可精准复刻 ST-003 设计的 ramp-up 30s → sustain 9min → ramp-down 30s 负载模型
2. k6 内置 thresholds + checks + metrics，无需额外断言库
3. k6 输出 JSON / CSV / Prometheus 多格式，便于后续接入 CI

## 3. 前置条件

1. Node.js >= 20，已执行 `npm install`
2. 服务端已启动：`npm run dev`，监听 `http://localhost:3000`
3. 预置文章数据（避免冷启动空查询）：
   ```bash
   # 通过 supertest 启动脚本或手动 curl 预置 ≥ 10000 篇文章
   ```
4. 安装 k6：
   - Windows: `choco install k6`
   - macOS: `brew install k6`
   - Linux: 参考 https://k6.io/docs/getting-started/installation/

## 4. 执行命令

```bash
# 1. 启动服务（另开终端）
npm run dev

# 2. 执行 k6 性能测试（缩短为 3min 便于本地执行）
k6 run tests/perf/k6-load-test.js

# 3. 也可指定 BASE_URL
BASE_URL=http://localhost:3000 k6 run tests/perf/k6-load-test.js
```

## 5. 验收阈值（与 ST-003 设计一致）

| 指标 | 阈值 | 来源 |
|---|---|---|
| `http_req_duration p(95)` | ≤ 200ms | NFR-002 |
| `http_req_failed rate` | < 1% | 通用稳定性的要求 |
| `errors rate` | < 1% | 业务正确性 |
| `http_reqs rate` | ≥ 95 RPS | 接近 100 QPS 目标 |

## 6. 输出示例

```
========== k6 性能基线报告 ==========
P95 延迟       : 4.32 ms  (阈值: ≤ 200ms)
HTTP 失败率    : 0.00%  (阈值: < 1%)
业务错误率     : 0.00%  (阈值: < 1%)
实际 RPS       : 99.87  (目标: ≥ 95)
总请求数       : 18000
总迭代         : 18000
======================================

结论: ✓ 通过
```

## 7. 与 ST-003 vitest 测试的关系

- **ST-003 (vitest)**：200 次轻量采样，纳入 CI 流水线，P95 ≤ 200ms 即过
- **k6-load-test.js**：完整 3min 负载测试，本地或夜间运行，输出更全面的性能数据

两者互为补充：vitest 版快速反馈，k6 版深度验证。

## 8. 已知限制

- 内存 Map 存储无磁盘 IO，P95 远低于 200ms（典型 1-5ms），不代表真实生产环境
- 单进程无并发瓶颈，k6 加压到 100 QPS 也无法触发服务端饱和
- 真实生产场景需替换为 PostgreSQL + 连接池，重新基线
