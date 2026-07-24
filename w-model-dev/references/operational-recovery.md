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
- O 越权检测（编排者越权实施守护）
- 闭环校验脚本调用约定

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
| Rust | `rustc` + `cargo` + `rustfmt` + `clippy` | `cargo test` + `cargo-tarpaulin` / `cargo-llvm-cov` |
| C++ | `g++`/`clang++` + `Make`/`CMake` + `cppcheck` / `Clang-Tidy` | `GTest`/`Catch2` + `gcov` / `lcov` |
| 纯 C | `gcc`/`clang` + `Make`/`CMake` + `cppcheck` / `Clang-Tidy` | `CUnit`/`Ceedling` + `gcov` / `lcov` |
| Erlang | `erlc` + `Rebar3`/`erlang.mk` + `Dialyzer` | `Common Test`/`EUnit` + `cover` (OTP) |
| Haskell | `ghc` + `Stack`/`Cabal` + `HLint` + `Ormolu`/`Fourmolu` | `Hspec`/`Tasty`/`QuickCheck` + `hpc` |
| Fortran | `gfortran` + `fpm`/`CMake` + `fprettify` | `pFUnit` + `gcov` / `fortcov` |
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

### rootcause / fix 动作 token 计量（新增）

> 对应 spec [§5.5](../../docs/superpowers/specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md) run-log 新增动作 + [§9.9](../../docs/superpowers/specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md) Token 预算扩展。返工循环 V/G→R→V→G→S-fix→V→G 中的 token 计量约定。

| 动作 | 计量方式 | 预算校验 |
|---|---|---|
| `rootcause`（R 子代理） | R 子代理（含 R-lead + N 个 R-persona）的 tokens 累计。每条 `rootcause` 动作各记 tokens 字段 | R-lead + N 个 R-persona 的 tokens 之和受 `budget.json.rootcauseParallelBudget` 约束（R4-A 规则） |
| `rootcause`（串行分派） | 串行分派时，每条 `rootcause` 动作各记 tokens，最终汇总校验 R4-A 预算（`maxTotalTokensPerRound`） | 不论并行/串行均累计校验；超限触发 killSwitch |
| `fix`（S 兼 F 修复） | S-fix 子代理的 tokens，记入 `fix` 动作的 tokens 字段 | 纳入单阶段 `perPhase.maxTokens` 与项目级 `project.maxTokensTotal` 统计 |
| `escalate`（upstreamDefect 触发） | 记录 `reportId` 与升级原因；tokens 由触发升级的 CHECKPOINT 会话承担 | 升级本身不消耗额外子代理 tokens（CHECKPOINT 由编排者处理） |

**多角度 R 的 token 预算校验（R4-A）**：

`check-budget.ts` 新增 R4-A 规则（对应 spec §9.9）：一轮内所有 R-persona（不论并行或串行分派）的 tokens 之和超 `rootcauseParallelBudget.maxTotalTokensPerRound` → 触发 killSwitch，强制 🔴 CHECKPOINT。串行分派时，编排者须在每条 `rootcause` 动作记录中累计 tokens，最终汇总校验。

> 未配置 `rootcauseParallelBudget` 字段时不校验 R4-A（向后兼容）。

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
| 阶段回退（场景 5，R 标记 upstreamDefect） | R 标记 `upstreamDefect.present=true` 且 `rollbackRecommended=true`，V 复审通过，`round ≥ 2` | 决策型 CHECKPOINT 等用户（见下方「场景 5：阶段回退」） |

### 场景 5：阶段回退（新增）

> 对应 spec [§6.3 场景 5](../../docs/superpowers/specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md) 阶段回退 + [§6.4](../../docs/superpowers/specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md) 回退路径阶段编号映射。返工循环 V/G→R→V→G→S-fix→V→G 中，R 定位根因为上游缺陷时的阶段回退决策。

**触发条件**（三者全部满足）：

1. `round ≥ 2`（多轮返工，单轮返工不触发回退）
2. R 标记 `upstreamDefect.present=true` 且 `rollbackRecommended=true`（根因跨阶段，R 建议回退）
3. V 复审 R 报告 `passed=true` 且 `upstreamDefect` 字段复审通过（V 同意跨阶段根因）

**回退路径阶段编号映射**（spec §6.4）：

| 当前阶段 | R 根因分类 | upstreamDefect.upstreamPhase | 回退到 |
|---|---|---|---|
| 阶段 2-4 | `requirement-gap` | 阶段 1 | 阶段 1 |
| 阶段 3-4 | `design-flaw` | 阶段 2 | 阶段 2 |
| 阶段 4 | `design-flaw` | 阶段 3 | 阶段 3 |
| 阶段 5-8 | `requirement-gap` | 阶段 1 | 阶段 1（罕见，重大需求缺陷） |
| 阶段 5-8 | `design-flaw` | 阶段 2/3/4 | 阶段 2/3/4 |
| 阶段 5-8 | `coding-error` | — | 阶段 5（当前阶段返工，不回退） |
| 阶段 6-8 | `coding-error` | 阶段 5 | 阶段 5 |

**CHECKPOINT 决策流程**：

编排者检测到回退条件满足 → 强制 🔴 CHECKPOINT · 阶段回退决策（决策型，L0-L3 均等用户），展示内容：
- 返工历史（所有 round 的 R 报告 + V 复审 + S-fix 记录）
- R 的 `upstreamDefect` 详情（上游阶段 / 产物 ID / 缺陷描述）
- V 的复审结论
- 建议回退到的阶段编号

用户选项：

| 选项 | 动作 | run-log 记录 |
|---|---|---|
| A) 确认回退到 `<upstreamPhase>` | O 更新 `project.status` 回退到上游阶段 → 上游阶段重走 S→V→G→（若再次失败）R 循环 | append `escalate` 动作（`reason:"upstreamDefect"`, `reportId:"<RC-...>"`）+ `rollback` 动作 |
| B) 不回退，继续当前阶段返工 | `round++`，但须用户说明理由 | append `rework` 动作，`note` 记用户理由 |
| C) 调整 `maxReworkRounds` 继续尝试 | 更新 `budget.json.perPhase.maxReworkRounds`，继续返工 | append `checkpoint` 动作，`acknowledgedDecisions` 记调整决策 |

**回退后处理**：

- 回退到上游阶段后，上游阶段产物作废重做（S 重新产出）
- 上游阶段通过后，重新进入当前阶段，S 重新产出（不沿用回退前的产物）
- 回退前的 R 报告归档为「历史根因分析」，可供新一轮 R 参考（避免重复定位）

> 场景 5 与 O6（Escalation Failure）运维失败模式一致：返工达 `maxReworkRounds` 或 R 触发场景 5 均强制 🔴 CHECKPOINT，避免循环卡死。

### 升级与降级

| 场景 | 动作 |
|---|---|
| 阶段 8 完成后 unlockConditions 全部达标 | 询问用户是否升级（决策型 CHECKPOINT，不可自动升级）；用户确认 → 更新 maturity.json.level + history |
| O 系列失败模式连续命中 ≥ `downgradeTriggers.operationalFailureStreak` | 自动降级到 L0；run-log append 降级记录 |
| 用户显式请求降级 | 更新 maturity.json.level=L0 + userRequested=true |
| L1+ 自动放行时 acknowledgedDecisions 为空 | 拒绝放行（O4 命中）；自动放行 ≠ 理解豁免，仍须填理解证据 |

### acknowledgedDecisions 真实性约束

> SSoT [§10.6](../../docs/skill-design-document_SSoT.md) 第六维度「理解证据」6.1~6.3 为权威定义；[`check-checkpoint.ts`](../scripts/check-checkpoint.ts) 强制校验。历史缺陷 D19：用户仅说「继续」，O 自行代填 acknowledgedDecisions（含「50个REQ节点完整覆盖」等技术决策）——CHECKPOINT 沦为 O 自问自答。

| 约束 | 规则 | 违反处置 |
|---|---|---|
| 决策须用户原文 | `acknowledgedDecisions` 每条须为用户实际确认过的技术决策摘要（如「选用 JWT 而非 session」「数据模型增加 `deletedAt` 软删字段」），由 O 从用户输入中提取，不得编造 | `check-checkpoint.ts` R3 校验无对应用户确认记录 → exitCode=1 |
| O 不得代填技术决策 | O 不得替用户归纳/臆造技术决策——如「50个REQ节点完整覆盖」须用户明确说出，O 不得自行写入 acknowledgedDecisions | `check-checkpoint.ts` R1/R2 校验 → exitCode=1；视为 O4 命中 |
| 泛化词须追问 | 用户仅说「继续」「OK」「确认」「同意」「好的」「yes」等泛化词（非穷举，完整黑名单见 §5.4 R2）时，O **不得**直接放行，须追问「请确认具体技术决策」直至用户给出含具体名词（技术方案名/模块名/接口名/数据结构名）的决策 | 泛化词命中 `check-checkpoint.ts` R2 黑名单 → exitCode=1 |
| 决策与阶段匹配 | 阶段 1 决策须与需求相关；阶段 2 与系统设计相关；阶段 3 与概要设计相关 | `check-checkpoint.ts` R4 校验 → exitCode=1 |
| 跨阶段证据一致 | 后阶段决策不得静默否定前阶段已放行项；矛盾须显式回退修正前阶段产物并重跑 | `check-checkpoint.ts` 交叉比对历史 checkpoint（SSoT §10.6 6.3） → exitCode=1 |

强制校验由 [`check-checkpoint.ts`](../scripts/check-checkpoint.ts) 执行（规则表见修正设计 [§5.4](../../docs/superpowers/specs/2026-07-23-w-model-dev-correction-design.md)）；任一规则违反 → exitCode=1，O 不得放行（反模式 #9 谎报状态守护）。

### maturity.json 维护

| 场景 | 动作 |
|---|---|
| `maturity.json` 不存在 | 项目未初始化；`/wm analyze` 初始化时创建默认 L0 配置 |
| `maturity.json` 字段缺失或类型错误 | 按 [data-models.md](data-models.md) schema 校验；修复后重跑成熟度判定 |
| `maturity.json` 被误删 | 从 git 恢复；无备份时按默认 L0 重建（丢失升级历史） |

## O 越权检测（编排者越权实施守护）

> SSoT [§3.4.5](../../docs/skill-design-document_SSoT.md)「编排者允许的动作」为权威边界；命中反模式 [#10 编排者越权实施](anti-patterns.md)。历史缺陷 D18：O 用 `node -e` 直接添加 22 条 produces 边、自己写 chunk-001.json，绕过 A 子代理承担实施职责。

### 禁止动作

| 禁止 | 说明 | 正确做法 |
|---|---|---|
| O 用 `node -e` 直接操作 `.w-model/*.json` | `node -e` 内联脚本修改产物 JSON（graph.json 边、consolidated.json、chunk-*.json、tla-manifest.json、rtm.json 实体字段、verifier-output-*.json 等）属实施动作 | 分派 A/S 子代理产出/修改产物 JSON；O 仅从子代理返回值回填状态 |
| O 直接 `Write`/`Edit` 产物 JSON | 同上——产物 JSON 须由 A/S 子代理产出，O 不得直接落盘 | 同上 |

> **边界澄清**：O **允许**维护 `.w-model/budget.json` / `.w-model/run-log.jsonl` / `.w-model/maturity.json` 三个状态文件（SSoT §3.4.5，状态读写+持久化，非实施）；允许更新 `project.status` 与 `updatedAt`。除此之外的 `.w-model/*.json` 产物文件，O 一律不得用 `node -e` 或 `Write`/`Edit` 直接操作，须分派 A/S 子代理。

### 检测机制

[`check-run-log.ts`](../scripts/check-run-log.ts) R5 规则交叉 `gate-logs/` 检测 O 越权：

- 读取本阶段 `gate-logs/phaseN-*.log` 与 run-log.jsonl 中 `role=O` 的动作记录
- 检测 O 是否绕过 A/S 子代理直接操作产物 JSON（`node -e` 命令痕迹、`Write`/`Edit` 落盘产物文件、产物 JSON 的 mtime 与某条 O 动作时间戳吻合但无对应 A/S 子代理分派记录）
- 命中 → exitCode=1，O 不得放行（反模式 #10 守护）；已越权产出的实体作废重做，重新分派 A/S 子代理产出后重走 V → G

检测信号亦可在编排者会话工具调用日志中自查（`Write`/`Edit`/`node -e` 不应出现在 O 会话对产物 JSON 的操作上），详见 [anti-patterns.md](anti-patterns.md) #10 检测信号行。

## 闭环校验脚本调用约定

> 四个闭环校验脚本（`check-budget.ts` / `check-run-log.ts` / `check-maturity.ts` / `check-checkpoint.ts`）在每个阶段门由 G 子代理执行，强制校验 budget / run-log / maturity / checkpoint 四套机制的完整性。规则表见修正设计 [§5.1-5.4](../../docs/superpowers/specs/2026-07-23-w-model-dev-correction-design.md)；SSoT [§10.6](../../docs/skill-design-document_SSoT.md) / [§10C.7](../../docs/skill-design-document_SSoT.md) / [§10D.7](../../docs/skill-design-document_SSoT.md) / [§10E](../../docs/skill-design-document_SSoT.md) 为权威定义。本节仅约定调用时机与校验内容摘要；异常处置（预算超限、kill switch、日志损坏、成熟度降级等）见上方「成本预算与运行日志」「成熟度与 CHECKPOINT 放行」两节，不在此重复。

### 调用时机（阶段门执行顺序）

G 子代理在每个阶段门按以下顺序调用，任一退出码 ≠ 0 → O 不得放行（反模式 #3/#6/#9 守护）：

| 顺序 | 脚本 | 校验对象 | 退出码 ≠ 0 守护 |
|---|---|---|---|
| 1 | `check-budget.ts` | `.w-model/budget.json` | 反模式 #9（谎报状态） |
| 2 | `check-run-log.ts` | `.w-model/run-log.jsonl` + `gate-logs/` | 反模式 #9 / #10（O 越权） |
| 3 | `check-maturity.ts` | `.w-model/maturity.json` | 反模式 #9 |
| 4 | `check-checkpoint.ts` | run-log 中 checkpoint 类记录 | 反模式 #9 / O4 |
| 5 | 现有三门禁 | `check-verifier-output.ts` / `check-requirement-graph.ts` / `check-tla-model.ts` | #1/#4/#11-#17 |

### 校验内容摘要

| 脚本 | 关键校验项（对应修正设计规则表） |
|---|---|
| `check-budget.ts`（§5.1） | R1 时效性（`updatedAt` 滞后）· R2 schema 完整 · R3 onExceed 合法 · R4 killSwitch 合法 · R5 触发检测（返工次数 ≥ killSwitch 阈值但 run-log 无告警） |
| `check-run-log.ts`（§5.2） | R1 阶段动作完整性（chunk/cross/gate/checkpoint 4 类）· R2 tokens 非负 · R3 返工记录一致 · R4 acknowledgedDecisions 非空 · R5 O 越权检测（交叉 `gate-logs/`）· R6 exitCode 一致（SSoT §10E）· R7 append-only |
| `check-maturity.ts`（§5.3） | R1 schema 完整 · R2 level 合法 · R3 成功阶段计数更新（`completedCycles` 滞后）· R4 history 一致 · R5 降级触发 |
| `check-checkpoint.ts`（§5.4） | R1 acknowledgedDecisions 非空 · R2 决策内容具体（泛化词黑名单）· R3 用户确认存在 · R4 决策与阶段匹配 · R5 跨阶段证据一致（SSoT §10.6 6.3） |

### 脚本间依赖

`check-run-log.ts` 交叉校验 `gate-logs/` 存档与 run-log `gateExitCode` 一致（SSoT §10E.3）；`check-checkpoint.ts` 依赖 run-log 中 checkpoint 记录；`check-budget.ts` / `check-maturity.ts` 交叉 run-log 统计返工/成功阶段数。四脚本须在阶段门一并跑完，不得跳过；CLI 用法与退出码语义（0 通过 / 1 校验失败 / 2 输入错误）见修正设计 §5.1-5.4。（依赖关系与执行顺序见修正设计 §5.5）
