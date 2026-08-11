# 阶段 7：系统测试（执行）

> W 模型右 V 测试执行阶段。设计来源：阶段 2（系统设计）产出的系统测试用例。
> 命令入口：`/wm test type=系统`

## 功能描述

在模拟真实环境下验证系统整体功能、性能与安全。执行阶段 2 设计的系统测试用例，并进行缺陷修复。

## 输入

- 系统测试设计文档（阶段 2 产出）
- 完整系统代码（阶段 5 产出 + 集成测试通过）

## 输出

- 系统测试报告（套用 [templates/test-report.md](../templates/test-report.md)，类型=系统测试）
- 性能测试结果
- 安全测试结果

## AI 能力应用

- **自动化测试执行**：端到端业务流程
- **性能测试脚本生成**：负载 / 压力 / 稳定性
- **安全漏洞检测**：常见攻击向量扫描

## 第 25 轮新增：opsx 三段式 S 分派 + codegraph 影响分析

> 对应 SSoT §3.4.21。本阶段（系统测试）产出测试代码，同样适用 opsx 三段式 + codegraph 修改前查询。

**三段式分派**（与阶段 5 一致）：
- S-explore：opsx:explore 探索测试策略 + codegraph 查被测模块影响
- S-propose：opsx:propose 规划测试用例 + S-tickets 拆解测试代码切片
- S-coding：按 tickets.md frontier 逐片编写测试，每片 codegraph_explore 查被测模块影响半径

**约束 #20 适用**：测试代码文件 `Edit`/`Write` 前同样须先 codegraph_explore 查询并落盘。

## 测试用例设计（执行）

| 用例 ID | 测试场景 | 输入 | 预期输出 | 优先级 |
|---|---|---|---|---|
| ST-001 | 端到端功能测试 | 完整业务流程 | 流程顺利完成，数据正确 | 高 |
| ST-002 | 性能测试 | 模拟高负载（ramp-up 5min → sustain 10min @ 100 QPS → ramp-down） | P95 响应 < 2s，无崩溃 | 高 |
| ST-003 | 安全测试 | OWASP Top 10 攻击向量（SQL注入/XSS/CSRF/SSRF/路径遍历） | 无高危漏洞，防御有效 | 高 |
| ST-004 | 兼容性测试 | Chrome/Firefox/Safari/Edge + iOS/Android 主流分辨率 | 功能正常显示和使用 | 中 |
| ST-005 | 可靠性测试 | 持续运行 24h | 系统稳定，无内存泄漏，错误率 < 0.1% | 中 |

## 执行方法论

| 用例 | 工具 / 命令 | 参数 / 阈值 |
|---|---|---|
| ST-001 端到端 | Playwright / Cypress 跑业务流程脚本 | 全流程通过，数据落库正确 |
| ST-002 性能 | `k6 run --stage 5m,10m,5m --vus 100 perf.js` | P95 < 2s，0 崩溃 |
| ST-003 安全 | `zap-cli quick-scan http://target` + `npm audit --audit-level=high` | 高危漏洞 = 0 |
| ST-004 兼容性 | BrowserStack / Sauce Labs 跨浏览器矩阵 | 主流浏览器 + 主流分辨率全通过 |
| ST-005 可靠性 | 长稳脚本 + `node --inspect` 内存监控 | 24h 错误率 < 0.1%，内存增长 < 10% |

**失败分支**：
- ST-001 端到端失败 → 定位失败步骤，回编码修复后重跑
- ST-002 P95 超阈 → k6 tracing 定位慢接口/慢查询，回编码优化
- ST-003 发现高危漏洞 → 阻断发布，回编码修复后重扫，禁止降级为"已知风险"
- ST-004 兼容性问题 → 定位 CSS/JS 兼容根因，回编码加 polyfill 或修复
- ST-005 内存泄漏 → `node --inspect` heap snapshot 定位泄漏点，回编码修复

## 质量门检查

系统测试通过后执行质量门检查（见 [quality-standards.md](quality-standards.md)）：
单元测试代码覆盖率 ≥ 80% ∧ 规范检查通过 ∧ 安全无高危 ∧ 性能达标 ∧ 各级测试通过 → 方可放行。

## RTM 登记

在 [templates/rtm.md](../templates/rtm.md) 中更新：系统测试列的状态。RTM 维护规则见 [rtm-guide.md](rtm-guide.md)。

## 可观测性验收标准（第 41 轮四源吸收，凤凰架构 observability）

> 吸收自《凤凰架构》可观测性三支柱（日志/度量/追踪）。系统测试验收除既有测试维度（功能/性能/安全/兼容性/可靠性）外，须验证系统的"可观测性"是否达交付标准。

| 支柱 | 验收判据 | 检测方法 |
|---|---|---|
| 日志 | 关键事件有日志；含 TraceID；无敏感信息/慢操作/追踪诊断/误导（quality-standards 日志规范 4 反模式） | 抽查日志输出 + 敏感信息扫描 |
| 度量 | 关键指标暴露（Counter/Gauge/Histogram 类，如请求量/P95/错误率）；指标可被采集（Pull/Push 端点） | 指标端点探测 + 采样验证 |
| 追踪 | 核心链路可追踪（Trace/Span 树）；跨模块调用有 TraceID 传递 | 分布式调用链采样验证 |

**不通过 → 动作**：回编码补可观测性（日志 TraceID / 指标暴露 / 追踪埋点），重跑系统测试。

## 验收标准

- [ ] 端到端测试全部通过
- [ ] 性能指标达到预期（响应时间 < 2s）
- [ ] 安全检测无高危漏洞
- [ ] 兼容性测试通过
- [ ] 质量门检查通过
- [ ] 缺陷已修复或已记录遗留
- [ ] 可观测性达标（日志含 TraceID、关键指标暴露、调用链可追踪）

> 🔴 **CHECKPOINT · 阶段门放行**：系统测试 + 质量门检查完成后暂停。Agent 必须执行 `npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts [project-dir]` 获取确定性判定，向用户展示「ST-001~005 结果 / P95 响应 / 安全扫描结果 / GATE_JSON 摘要」，由用户确认「放行进入阶段 8」或「返工」。质量门退出码 1/2 → 一律回编码，不得放行。

## 阶段门评审

系统测试 + 质量门通过 → 进入阶段 8（验收测试）。
需修复 → 回到编码实现返工，按失败分支定位根因，修复后重跑系统测试与质量门检查。

## L2 BDD features 执行

S-test 子代理执行 `npx cucumber-js features/L2/` 运行所有 scenarios：
- 失败走 R→V→G→S-fix 循环（反模式 #29）
- 通过后 G 子代理跑 [`check-bdd-model.ts`](../scripts/check-bdd-model.ts) `--phase=7 --cucumber-report=<report.json>` 门禁
- cucumber 报告不得有 undefined/pending/failed step（D5 校验）

## 禁止行为

| # | 禁止行为 | 正确做法 |
|---|---|---|
| 1 | 仅跑 happy path 判定性能通过 | ST-002 必须按负载模型（ramp-up → sustain → ramp-down）压测 |
| 2 | 安全高危降级为"已知风险"放行 | 高危必须修复后重扫，不得降级 |
| 3 | 用 LLM 估算质量门结果 | 必须执行 `check-artifact-gate.ts` 获取退出码 |
| 4 | 跳过兼容性测试矩阵 | ST-004 必须覆盖 Chrome/Firefox/Safari/Edge + 移动端 |
| 5 | 可靠性测试只跑 1 小时 | ST-005 必须持续 ≥ 24h 才能判定内存泄漏 |
| 6 | 把质量门退出码 1/2 当警告忽略 | 退出码 1/2 一律回编码，禁止放行 |
| 7 | 系统测试未覆盖跨模块数据流校验 / 角色越权检测 / 副作用时序一致性检测 | 系统测试用例须包含：(1) **跨模块数据流用例**（验证 store 选择与 schema 一致，详见 [phase-3-outline-design.md](phase-3-outline-design.md)「跨模块数据源选择约束」节）；(2) **角色越权用例**（验证 `reader` 不能调用 `blogger-only` 端点，应返回 403，详见 [phase-5-coding.md](phase-5-coding.md)「角色校验清单」节）；(3) **副作用时序用例**（验证响应体字段反映已生效状态，详见 [phase-5-coding.md](phase-5-coding.md)「副作用时序一致性清单」节）。第 16 轮 P3.4 新增（预防 P7-001~P7-004 类缺陷） |

## 返工路径

| 失败用例 | 根因定位 | 返工目标 | 修复后重跑 |
|---|---|---|---|
| ST-001 端到端失败 | 定位失败步骤 | 编码修复 | Playwright/Cypress 业务流程脚本 |
| ST-002 P95 超阈 | k6 tracing 定位慢接口/慢查询 | 编码优化 | `k6 run --stage 5m,10m,5m --vus 100 perf.js` |
| ST-003 高危漏洞 | 阻断发布 | 编码修复后重扫 | `zap-cli quick-scan` + `npm audit` |
| ST-004 兼容性问题 | CSS/JS 兼容根因 | 编码加 polyfill/修复 | BrowserStack 跨浏览器矩阵 |
| ST-005 内存泄漏 | `node --inspect` heap snapshot 定位泄漏点 | 编码修复 | 长稳脚本 + 内存监控 |

## 退出状态

项目 `status` 更新为 `验收测试`。
