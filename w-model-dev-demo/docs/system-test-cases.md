# 系统测试用例文档

> 阶段 7（系统测试）产出。系统测试用例 ST-001~006 已在 `docs/system-design.md §5` 设计。
> 本文件补充执行结果。

## 文档信息

- 项目名称：blog-system-demo
- 文档版本：v1.0
- 编制日期：2026-07-21
- 编制者：W-Model Agent
- 关联设计：`docs/system-design.md §5 系统测试用例设计`
- 测试代码：`tests/system/system.test.ts`、`tests/perf/k6-load-test.js`

## 1. 系统测试范围

- 范围：端到端系统行为验证，包含完整业务链路、性能基线、安全基线
- 不覆盖：单元测试已覆盖的方法级分支
- 工具：vitest + supertest；性能基线另用 k6（独立脚本）

## 2. 用例清单（含执行结果）

| 用例 ID | 关联需求 | 测试目标 | 状态 | 通过数/总数 | 备注 |
|---|---|---|---|---|---|
| ST-001 | REQ-001~004 | 端到端：注册→登录→创建文章→浏览→评论→删除全链路 | 通过 | 1/1 | 9 步全链路；步骤 1-8 返回 201/200/201/200/200/201/200/204；步骤 9 返回 404 + 40401 |
| ST-002 | REQ-002 | 作者隔离验证 - A 修改/删除 B 的文章被拒 | 通过 | 1/1 | A 操作 → 403.40301；B 修改自己 → 200；文章仍存在且 title 已更新 |
| ST-003 | NFR-002 | 性能基线 - 1000 篇文章 200 次采样 P95 ≤ 200ms | 通过 | 1/1 | 实测 P95 = 4ms（远低于阈值） |
| ST-004 | NFR-001 | 安全基线 - 未授权访问受保护资源被拒 | 通过 | 1/1 | 受保护接口 401.40103；公开接口 200 不受影响 |
| ST-005 | NFR-001 | 安全基线 - JWT 过期 / 伪造处理 | 通过 | 1/1 | 过期 → 401.40102；伪造 → 401.40102；合法 → 201 |
| ST-006 | NFR-001 | 安全基线 - 密码 bcrypt 哈希存储（cost=10） | 通过 | 1/1 | $2b$10$ 开头；getRounds===10；无 password 字段；compare 错误密码 false |
| 补充-1 | （健壮性） | PUT /api/v1/articles/:id 不支持 → 404 | 通过 | 1/1 | Express 默认 404 |
| 补充-2 | （健壮性） | GET /api/v1/unknown-path 不存在 → 404 | 通过 | 1/1 | 路由未匹配 |

## 3. 执行命令

```bash
# 系统测试
npm run test:system

# 性能基线（k6，需先启动服务端）
npm run dev &
k6 run tests/perf/k6-load-test.js
```

## 4. 执行结果

```
Test Files  1 passed (1)
     Tests  8 passed (8)
  Duration  5.08s
```

ST-003 性能采样输出：
```
ST-003 P95 = 4ms (samples=200, total articles=1000)
```

| 指标 | 值 |
|---|---|
| 测试用例总数 | 8 |
| 通过 | 8 |
| 失败 | 0 |
| 跳过 | 0 |
| 总耗时 | 5.08s |
| ST-003 P95 | 4ms (阈值 ≤ 200ms) |

## 5. 覆盖说明

### 5.1 强制场景覆盖（来自 system-design.md §5.2）

| 场景类型 | 用例 | 状态 |
|---|---|---|
| 端到端覆盖（TC-DES-007） | ST-001 | ✓ |
| 性能基线覆盖（TC-DES-008） | ST-003 | ✓ |
| 安全基线覆盖（TC-DES-009） | ST-004 / ST-005 / ST-006 | ✓ |
| 异常路径覆盖 | ST-001（40401）/ ST-002（40301）/ ST-004（40103）/ ST-005（40102） | ✓ |

### 5.2 NFR-002 性能基线说明

- 内存 Map 存储无磁盘 IO，P95 远低于 200ms（实测 4ms）
- k6 完整负载测试脚本（`tests/perf/k6-load-test.js`）提供 100 QPS · 3min 持续加压
- 在单进程内存模型下，性能阈值宽裕满足；真实生产场景需替换存储后重新基线

## 6. 阶段 7 自检清单

- [x] 系统测试覆盖端到端全链路（ST-001 9 步）
- [x] 作者隔离在 HTTP 层验证（ST-002 跨用户 A/B）
- [x] 性能基线 P95 ≤ 200ms（ST-003 实测 4ms）
- [x] 安全基线 3 项全验证（ST-004 未授权 / ST-005 JWT 过期伪造 / ST-006 bcrypt 存储）
- [x] 8/8 全部通过
- [x] k6 性能脚本已就绪（`tests/perf/k6-load-test.js` + README）
- [x] RTM executionSummary.systemTest 已更新

## 7. 阶段完成摘要

- 产物路径：
  - `tests/system/system.test.ts`（8 条测试）
  - `tests/perf/k6-load-test.js`（k6 性能脚本）
  - `tests/perf/README.md`（性能测试说明）
  - `docs/system-test-cases.md`（本文件，含执行结果）
  - `docs/system-test-report.md`（执行报告）
  - `.w-model/rtm.json`（已更新 systemTest 执行汇总）
- 执行结果：8 passed / 0 failed / 0 skipped
- 性能数据：ST-003 P95 = 4ms（远低于 200ms 阈值）
- 阻塞项：无
- 下一步：进入阶段 8（验收测试 + 质量门 + 归档）
