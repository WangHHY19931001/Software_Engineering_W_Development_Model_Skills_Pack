# 运维与恢复参考

> 仅在异常、跨平台路径、技术栈切换或大项目场景下读取。正常阶段执行不加载本文件。
> SSoT [§10C](../../docs/skill-design-document_SSoT.md)（成熟度阶梯）/ [§10D](../../docs/skill-design-document_SSoT.md)（成本预算与运行日志）为权威定义，本文件为可执行细则。

## 目录

- 路径与运行环境
- 状态文件恢复
- 外部评审与门禁异常
- 技术栈与阶段漂移
- 大项目与用户中断
- 成本预算与运行日志
- 成熟度与 CHECKPOINT 放行

## 路径与运行环境

| 场景 | 必须动作 |
|---|---|
| Windows / Unix 路径差异 | 技能文档与脚本路径统一使用 `/`；代码拼接使用 `path.join()` 或等价 API |
| 路径含空格或中文 | 命令行路径使用双引号包裹 |
| `tsx` 不可用 | 项目安装 `npm install -D tsx`，或经用户允许使用 `npx --yes tsx@latest`；不得跳过门禁 |
| 门禁执行超过 30 秒 | 视为失败并停止放行；检查输入体量与运行环境 |
| 未知退出码 | 输出 stderr 前 500 字符并按失败处理，不映射为警告 |

## 状态文件恢复

### `.w-model/` 不存在

只有 `/wm analyze` 可自动初始化：创建 `.w-model/project.json` 与 `.w-model/rtm.json` 空结构，然后在项目初始化检查点确认技术栈。其他命令应说明项目未初始化并引导 `/wm analyze`。

### JSON 无法解析

1. 立即停止阶段推进、测试回填和质量门。
2. 将损坏文件复制为 `<name>.bak.YYYYMMDD-HHMM`，保留取证。
3. 按顺序尝试恢复：最近有效 `.bak` → git 中最近有效版本 → 用户提供的导出。
4. 每个候选恢复后先解析并按 `data-models.md` 校验。
5. 均失败时请求用户选择重建或手工修复；未确认前不得 `/wm reset`。

### 写入冲突或文件锁

- EPERM/EBUSY：提示关闭编辑器锁、同步软件或占用进程，解除后重试当前写入。
- 并发修改：比较读取前后的 mtime；变化时停止覆盖、重新读取并合并差异。
- 所有 JSON 写入使用“临时文件 → 校验 → 原子 rename”。

## 外部评审与门禁异常

| 场景 | 行为 |
|---|---|
| 外部 LLM 超时/不可达 | 状态标记“等待评审”，暂停；不得降级为产出 Agent 自评 |
| Verifier JSON 校验退出码 1 | 展示校验原因，修正输出后重评 |
| Verifier/质量门退出码 2 | 视为输入错误并停止；修复输入后重跑 |
| 门禁脚本未捕获异常 | 展示 stderr 摘要，检查 Schema 与脚本版本；不得放行 |
| 评审 Agent 与产出 Agent 不同 | 允许 JSON 流转；校验基于 Schema，不依赖 Agent 身份 |

## 技术栈与阶段漂移

### 技术栈选择

Agent 应依据项目已有脚本和声明选择真实工具链，不默认伪造命令：

| 项目类型 | 编译/规范 | 测试/覆盖率 |
|---|---|---|
| Node.js / TypeScript | `tsc` + ESLint | Vitest/Jest coverage |
| Python | Ruff + mypy | pytest-cov |
| Java | Maven/Gradle + Checkstyle | JUnit + JaCoCo |
| React/Vue | TypeScript + ESLint | Vitest + Playwright |
| 未知技术栈 | 先检查构建清单并询问用户确认工具链 | 使用项目已有测试命令 |

执行中更改技术栈时，不自动删除已产物：归档旧技术栈产物，评估受影响阶段并在用户确认后回退；只有用户明确要求清空时才使用 `/wm reset`。

### 状态与产物不一致

以可验证产物为准：定位最近一个产物完整且已放行的阶段，修正 `status`，记录修正原因与时间。用户直接请求下游阶段但缺少上游产物时拒绝执行并指出回退命令。

## 大项目与用户中断

- RTM 超过 500 行：建议按模块拆分 `rtm-<module>.json`，主 RTM 维护跨模块映射；质量门前聚合校验。
- 测试用例超过 1000：按模块和优先级分批执行，但最终不得用部分通过代替全量门禁。
- 用户中断：保留已写产物，`status` 停留在上一已放行阶段；下次询问继续断点或重做。
- CHECKPOINT 拒绝：不重试同一请求；询问调整方向，修改后再进入检查点。
- 同一阶段返工超过 2 次：展示失败子标准与证据，询问缺失上下文；必要时经用户确认回退到上游阶段。不得把硬门槛降级为“已知限制”后放行。

## 成本预算与运行日志

> SSoT [§10D](../../docs/skill-design-document_SSoT.md) 为权威定义。编排者 O 维护 `.w-model/budget.json` 与 `.w-model/run-log.jsonl`，属"状态读写+持久化"允许动作（非实施，不触发反模式 #10）。

### 预算超限

| 场景 | 必须动作 |
|---|---|
| 单阶段 token 超过 `budget.json.perPhase.maxTokens` | 按 `onExceed` 处置；默认 `pause` → 🔴 CHECKPOINT · 预算告警 |
| 项目级 token 超过 `budget.json.project.maxTokensTotal` | 立即 `halt`；回退到当前阶段起点；告知用户累计消耗 |
| 单会话 token 超过 `maxTokensPerSession` | 暂停后续子代理分派，建议用户开新会话续接 |
| `onExceed=notify` 但连续 3 次告警 | 自动升级为 `pause`，强制 🔴 CHECKPOINT |

### kill switch 触发

| 触发条件 | 动作 |
|---|---|
| 连续阶段返工次数 ≥ `killSwitch.consecutiveReworks` | 全流程暂停；展示返工历史；询问是否降级范围/取消 |
| 单阶段 token 占 `maxTokens` ≥ `killSwitch.budgetBurnRate` | 暂停后续子代理；展示消耗明细；询问增预算/降范围 |
| TLA+ 规格返工 ≥ `killSwitch.tlaReworks` | 暂停 TLA+ 建模；询问是否简化建模范围或回退修正需求/设计 |

### 运行日志维护

| 场景 | 动作 |
|---|---|
| `run-log.jsonl` 不存在 | 项目未初始化或被误删；引导 `/wm analyze` 初始化，或从 git 恢复 |
| `run-log.jsonl` 解析失败（某行非合法 JSON） | 跳过损坏行，记录到 run-log 末尾一条 note=「日志损坏行已跳过」；不停止流程 |
| `run-log.jsonl` 需要导出运行历史 | `/wm export` 包含 `run-log.jsonl`；可离线分析成本与返工模式 |
| `budget.json` 字段缺失或类型错误 | 按 [data-models.md](data-models.md) schema 校验；修复后重跑预算检查 |

## 成熟度与 CHECKPOINT 放行

> SSoT [§10C](../../docs/skill-design-document_SSoT.md) 为权威定义。编排者 O 维护 `.w-model/maturity.json`，按当前 level 决定 CHECKPOINT 类型（决策型 / 操作型）。

### CHECKPOINT 分类与放行

| CHECKPOINT 类型 | 示例 | L0 | L1 | L2 | L3 |
|---|---|---|---|---|---|
| **决策型**（设计方向/技术选型/范围变更） | 项目初始化、阶段进入确认、设计选型、ingestion 规划确认 | ✅ 等用户 | ✅ 等用户 | ✅ 等用户 | ✅ 等用户（高风险路径强制） |
| **操作型**（已跑脚本/已执行测试/已产出产物） | 阶段门放行（V 评审通过 + G 退出码 0）、ingestion 收敛确认（G 退出码 0）、测试结果回填确认 | ✅ 等用户 | ⚡ 自动放行 | ⚡ 自动放行 | ⚡ 自动放行 |

### L3 高风险路径（强制人工 gate）

| 高风险路径 | 触发条件 | 强制动作 |
|---|---|---|
| 认证/授权相关 | 阶段 4 详细设计涉及 auth 模块 / 阶段 5 编码涉及 auth 文件 | 决策型 CHECKPOINT 等用户 |
| 加密/密钥相关 | 涉及 JWT_SECRET / 密码哈希 / 加密算法选型 | 决策型 CHECKPOINT 等用户 |
| 发布放行 | 阶段 8 验收终检 + check-artifact-gate.ts | 始终 attended（L3 亦然） |
| 架构变更 | 技术栈增删 / 模块边界变更 / 数据模型 schema 变更 | 决策型 CHECKPOINT 等用户 |
| TLA+ 建模不符需求/设计（反模式 #17） | TLC 发现违反且规格忠实于需求/设计 | 决策型 CHECKPOINT 等用户（须回退修正需求/设计） |

### 升级与降级

| 场景 | 动作 |
|---|---|
| 阶段 8 完成后 unlockConditions 全部达标 | 询问用户是否升级（决策型 CHECKPOINT，不可自动升级）；用户确认 → 更新 maturity.json.level + history |
| O 系列失败模式连续命中 ≥ `downgradeTriggers.operationalFailureStreak` | 自动降级到 L0；run-log append 降级记录 |
| 用户显式请求降级 | 更新 maturity.json.level=L0 + userRequested=true |
| L1+ 自动放行时 acknowledgedDecisions 为空 | 拒绝放行（O4 命中）；自动放行 ≠ 理解豁免，仍须填理解证据 |

### maturity.json 维护

| 场景 | 动作 |
|---|---|
| `maturity.json` 不存在 | 项目未初始化；`/wm analyze` 初始化时创建默认 L0 配置 |
| `maturity.json` 字段缺失或类型错误 | 按 [data-models.md](data-models.md) schema 校验；修复后重跑成熟度判定 |
| `maturity.json` 被误删 | 从 git 恢复；无备份时按默认 L0 重建（丢失升级历史） |
