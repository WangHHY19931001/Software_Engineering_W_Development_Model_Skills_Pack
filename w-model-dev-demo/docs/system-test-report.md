# 系统测试执行报告

> 阶段 7 系统测试执行报告

## 1. 执行环境

- 项目：blog-system-demo
- 执行日期：2026-07-21
- 执行命令：`npm run test:system`
- 环境变量：`JWT_SECRET=test-secret-blog-demo`
- 测试框架：vitest 1.6.1 + supertest 7.2.2
- Node.js：>= 20

## 2. 执行结果

```
RUN  v1.6.1 D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev-demo

 ✓ tests/system/system.test.ts  (8 tests) 4008ms

 Test Files  1 passed (1)
      Tests  8 passed (8)
   Duration  5.08s
```

| 指标 | 值 |
|---|---|
| 测试文件 | 1 |
| 测试用例总数 | 8 |
| 通过 | 8 |
| 失败 | 0 |
| 跳过 | 0 |
| 总耗时 | 5.08s |

## 3. 用例明细

| 用例 ID | 测试目标 | 结果 | 耗时 |
|---|---|---|---|
| ST-001 | 9 步端到端全链路（注册→登录→创建→浏览→评论→删除） | 通过 | ~250ms |
| ST-002 | 作者隔离（A 操作 B 的文章 → 403） | 通过 | ~200ms |
| ST-003 | 性能基线 1000 篇文章 200 次采样 P95 ≤ 200ms | 通过 | ~3500ms（P95=4ms） |
| ST-004 | 未授权访问受保护资源 → 401.40103 | 通过 | ~30ms |
| ST-005 | JWT 过期 / 伪造 → 401.40102 | 通过 | ~60ms |
| ST-006 | bcrypt cost=10 + password 字段不存储 | 通过 | ~80ms |
| 补充-1 | PUT /articles/:id 不支持 → 404 | 通过 | ~10ms |
| 补充-2 | GET /unknown-path 不存在 → 404 | 通过 | ~10ms |

## 4. 强制场景覆盖（TC-DES-007/008/009）

| 强制场景 | 对应用例 | 验证要点 | 状态 |
|---|---|---|---|
| TC-DES-007 端到端 | ST-001 | 9 步全链路：注册→登录→创建→浏览→评论→删除→404 | ✓ |
| TC-DES-008 性能基线 | ST-003 | P95 ≤ 200ms（实测 4ms） | ✓ |
| TC-DES-009 安全基线 | ST-004, ST-005, ST-006 | 未授权 / JWT 过期 / bcrypt 存储 | ✓ |

## 5. 性能基线明细

### 5.1 vitest 内置性能测试（ST-003）

- 预置数据：1000 篇文章（alice 创建）
- 采样次数：200 次
- 接口：`GET /api/v1/articles?page=1&pageSize=10`
- 实测 P95：4ms
- 阈值：≤ 200ms
- 结论：通过（远低于阈值）

### 5.2 k6 性能脚本（独立运行）

- 脚本：`tests/perf/k6-load-test.js`
- 负载模型：ramp-up 30s → sustain 100 QPS · 2min → ramp-down 30s（共 3min）
- 阈值：
  - `http_req_duration p(95) < 200`
  - `http_req_failed rate < 0.01`
  - `errors rate < 0.01`
- 执行方式：`k6 run tests/perf/k6-load-test.js`（需服务端运行）
- 状态：脚本就绪，未在 CI 中强制执行（本地手动运行）

## 6. 错误码覆盖率

| 业务码 | HTTP | 触发用例 | 覆盖状态 |
|---|---|---|---|
| 40102 | 401 | ST-005 | ✓ |
| 40103 | 401 | ST-004 | ✓ |
| 40301 | 403 | ST-002 | ✓ |
| 40401 | 404 | ST-001 第 9 步 | ✓ |

> 40001 / 40101 / 40901 已在集成测试覆盖；50001 由单元测试覆盖。

## 7. 阻塞与异常

无。所有用例一次通过。

## 8. 结论

系统测试阶段产出 8 条测试用例，全部通过。强制场景 TC-DES-007/008/009 全部覆盖，性能 P95 = 4ms 远低于 200ms 阈值，安全基线 3 项全验证。可进入阶段 8（验收测试 + 质量门 + 归档）。
