# k6 性能基线测试

> 独立性能基线测试，对应 `docs/system-design.md` §5.1 ST-003 设计原意（k6 100 QPS × 10min）。
> 本目录脚本由 [k6](https://k6.io) 二进制直接执行，**不依赖 npm install**，不在 vitest 自动化套件中。

## 1. 为什么用 k6 而非 vitest+supertest

| 维度 | vitest + supertest 采样（CI 内） | k6 压测（运维侧） |
|---|---|---|
| 执行环境 | Node.js 进程内（与被测 app 同进程） | 独立 k6 进程（真实 HTTP 客户端） |
| 并发模型 | 串行采样（单 connection） | 多 VU 并发（100+ 并发连接） |
| 持续时间 | ~ 1s（200 次采样） | 30s ~ 10min（长稳压测） |
| 用途 | CI 内快速回归验证 P95 ≤ 200ms | 性能基线 / 容量规划 / 长稳验证 |
| 结果可信度 | 近似值（无真实并发压力） | 真实负载下的性能基线 |

**两者互补**：CI 内用 vitest 采样做快速回归门禁；运维侧用 k6 做正式性能基线验收。

## 2. k6 安装

k6 是 Grafana 出品的开源负载测试工具，**不能通过 npm 安装**（npm 上的 `k6` 包非官方）。

### 2.1 Windows

```powershell
# 方式 1：Chocolatey
choco install k6

# 方式 2：Scoop
scoop install k6

# 方式 3：直接下载二进制
# 从 https://github.com/grafana/k6/releases 下载 windows.zip，解压后将 k6.exe 加入 PATH
```

### 2.2 macOS

```bash
brew install k6
```

### 2.3 Linux

```bash
# Debian/Ubuntu
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt update
sudo apt install k6

# 或直接下载二进制
# https://github.com/grafana/k6/releases
```

### 2.4 Docker（无需本地安装）

```bash
docker run --rm -i grafana/k6 run - < tests/perf/k6-load-test.js
```

### 2.5 验证安装

```bash
k6 version
# 应输出 k6 v0.50.x 或更高版本
```

## 3. 运行压测

### 3.1 前置条件

1. **启动被测服务**（独立终端）：

   ```bash
   # 在项目根目录
   JWT_SECRET=perf-test-secret npm run dev
   # 或构建后运行
   npm run build && JWT_SECRET=perf-test-secret node dist/server.js
   ```

   服务默认监听 `http://localhost:3000`。

2. **确认服务可达**：

   ```bash
   curl http://localhost:3000/api/v1/articles?page=1&pageSize=1
   # 应返回 {"items":[...],"total":...} 或空列表
   ```

### 3.2 执行 k6 脚本

```bash
# 默认目标 http://localhost:3000
k6 run tests/perf/k6-load-test.js

# 自定义目标 URL
k6 run -e BASE_URL=http://localhost:3000 tests/perf/k6-load-test.js

# 自定义目标 + 输出 JSON 结果
k6 run -e BASE_URL=http://localhost:3000 --out json=results.json tests/perf/k6-load-test.js
```

## 4. 脚本说明

### 4.1 压测模型

| 参数 | 值 | 说明 |
|---|---|---|
| VUs | 100 | 100 个虚拟用户并发 |
| 持续时间 | 30s | ramp-up 10s → sustain 10s → ramp-down 10s |
| 阈值 - P95 | < 200ms | NFR-002 性能要求 |
| 阈值 - 失败率 | === 0 | 无 5xx / 网络错误 |
| 阈值 - 业务成功率 | ≥ 99% | HTTP 200 + 响应结构校验 |

### 4.2 覆盖接口

| 接口 | 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|---|
| 文章列表 | GET | `/api/v1/articles?page=1&pageSize=10` | 公开 | 分页查询 |
| 文章详情 | GET | `/api/v1/articles/:id` | 公开 | setup 阶段预创建文章 |
| 登录 | POST | `/api/v1/auth/login` | 公开 | bcrypt 校验 + JWT 签发 |

### 4.3 自定义指标

| 指标 | 类型 | 说明 |
|---|---|---|
| `list_duration` | Trend | 文章列表接口响应时间 |
| `detail_duration` | Trend | 文章详情接口响应时间 |
| `login_duration` | Trend | 登录接口响应时间 |
| `biz_success_rate` | Rate | 业务成功率（HTTP 200 + 结构校验通过） |

### 4.4 setup / teardown

- **setup**：压测前执行一次，注册测试用户 `k6_perf_user` + 登录获取 token + 创建一篇测试文章
- **teardown**：空操作（demo 项目使用内存存储，进程重启即清空）

## 5. 解读结果

### 5.1 成功输出示例

```
         /\      Grafana   /‾‾/
    /\  /  \     |\  __   /  /
   /  \/    \    | |/ / /   ‾‾\
  /          \   |   (  |  (‾)  |
 / __________ \  |\__|\ \_____/ /

     execution: local
        script: tests/perf/k6-load-test.js
        output: -

     scenarios: (100.00%) 1 scenario, 100 max VUs, 1m0s max duration (incl. graceful stop):
              * default: 30s looping, 100 VUs

     ✓ list status 200
     ✓ list has items array
     ✓ detail status 200
     ✓ detail has articleId
     ✓ login status 200
     ✓ login has token

     checks.........................: 99.87% ✓ 12345  ✗ 16
     data_received..................: 12 MB  400 kB/s
     data_sent......................: 2.3 MB 77 kB/s
     http_req_blocked...............: avg=1.2ms   min=1µs   med=5µs   max=245ms p(90)=15µs  p(95)=25µs
     http_req_connecting............: avg=0.8ms   min=0s    med=0s    max=120ms p(90)=0s     p(95)=0s
     http_req_duration..............: avg=15ms    min=2ms   med=12ms  max=180ms p(90)=28ms   p(95)=45ms  ← P95 < 200ms ✓
       { expected_response:true }...: avg=15ms    min=2ms   med=12ms  max=180ms p(90)=28ms   p(95)=45ms
     http_req_failed................: 0.00%  ✓ 12345  ✗ 0    ← 失败率 === 0 ✓
     http_req_receiving.............: avg=0.5ms   min=20µs  med=100µs max=15ms  p(90)=300µs  p(95)=500µs
     http_req_sending...............: avg=0.2ms   min=10µs  med=50µs  max=10ms  p(90)=200µs  p(95)=400µs
     http_req_tls_handshaking.......: avg=0s      min=0s    med=0s    max=0s    p(90)=0s     p(95)=0s
     http_req_waiting...............: avg=14ms    min=2ms   med=11ms  max=170ms p(90)=27ms   p(95)=44ms
     http_reqs......................: 12361  412.03/s
     iteration_duration.............: avg=45ms    min=5ms   med=40ms  max=250ms p(90)=80ms   p(95)=95ms
     iterations.....................: 4120   137.34/s
     biz_success_rate...............: 99.87% ✓ 12345  ✗ 16    ← ≥ 99% ✓
     detail_duration................: avg=12ms    min=2ms   med=10ms  max=150ms p(90)=25ms   p(95)=40ms
     list_duration..................: avg=8ms     min=2ms   med=7ms   max=100ms p(90)=15ms   p(95)=25ms
     login_duration.................: avg=25ms    min=5ms   med=22ms  max=180ms p(90)=45ms   p(95)=65ms
     vus............................: 1      min=0    max=100
     vus_max........................: 100    min=100  max=100

   ✓ All thresholds passed

   running (0m30.0s), 000/100 VUs, 12361 complete and 0 interrupted iterations
   default ✓ [======================================] 1/1 VUs  30s

EXIT CODE: 0
```

### 5.2 关键指标解读

| 指标 | 含义 | 阈值 | 判定 |
|---|---|---|---|
| `http_req_duration p(95)` | 95% 请求的响应时间 | < 200ms | ✓ / ✗ |
| `http_req_failed` | 失败率（5xx / 网络错误） | === 0 | ✓ / ✗ |
| `biz_success_rate` | 业务成功率（HTTP 200 + 结构校验） | ≥ 99% | ✓ / ✗ |
| `iterations` | 总迭代次数 | — | 用于估算 QPS |
| `vus_max` | 最大并发 VU 数 | = 100 | 确认压力达标 |

### 5.3 失败排查

| 现象 | 可能原因 | 解决方式 |
|---|---|---|
| `http_req_failed` > 0 | 服务返回 5xx 或连接被拒 | 检查服务日志、确认服务存活 |
| `p(95) > 200ms` | 响应过慢 | 检查 ArticleStore.findAll 分页、bcrypt cost |
| `setup register failed` | 注册接口异常 | 手动 `curl` 验证注册接口 |
| `setup login failed` | 登录接口异常 | 确认 JWT_SECRET 环境变量已设置 |
| `connection refused` | 服务未启动或端口错误 | 确认 `BASE_URL` 正确、服务已监听 |

## 6. 与 CI 内 vitest 采样的关系

| 场景 | 工具 | 触发时机 | 阈值 |
|---|---|---|---|
| CI 回归门禁 | vitest + supertest | 每次 PR / 提交 | N=200，P95 ≤ 200ms |
| 性能基线验收 | k6 | 发版前 / 运维侧 | 100 VUs × 30s，P95 < 200ms |
| 长稳压测 | k6（扩展 stages） | 季度 / 容量规划 | 100 VUs × 10min，P95 < 200ms |

- **CI 内 vitest 采样**：快速回归验证，确认性能无明显退化（`npm run test:system` 中的 ST-003）
- **k6 独立压测**：真实负载下的性能基线，作为正式发版前验收依据

两者均为 ST-003 的实现方式，vitest 采样是 CI 内近似验证，k6 是独立性能基线测试。
