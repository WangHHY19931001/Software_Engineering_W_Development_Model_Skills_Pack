# 人格选择矩阵（Subagent Persona Matrix）

> **定位**：R-lead / V-lead 在多角度分析时选择 persona 的参考矩阵。
> **关联 spec**：[2026-07-24-root-cause-locator-and-fixer-roles-design.md](../../docs/superpowers/specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md) §9.3 + §9.4
> **人格库**：[w-model-dev/subagent/](../subagent/) 含 28 个人格文件，分 5 类。

---

## 1. 现有人格库盘点

| 类别 | 数量 | 人格 | R/V 适用性 |
|---|---|---|---|
| **engineering** | 12 | code-reviewer, senior-developer, software-architect, backend-architect, frontend-developer, ai-engineer, data-engineer, database-optimizer, autonomous-optimization-architect, incident-response-commander, threat-detection-engineer, technical-writer | R + V |
| **testing** | 7 | api-tester, performance-benchmarker, reality-checker, evidence-collector, test-results-analyzer, tool-evaluator, workflow-optimizer | R + V |
| **design** | 3 | ui-designer, ux-architect, ux-researcher | V（阶段 2-3 设计评审） |
| **product** | 4 | product-manager, feedback-synthesizer, trend-researcher, behavioral-nudge-engine | V（阶段 1 需求评审） |
| **project** | 2 | project-manager-senior, experiment-tracker | V（阶段 1-2 流程评审） |

---

## 2. R-persona 选择矩阵（按 rootCause.category 与阶段）

> 分派方式：并行/串行均可（见 [root-cause-locator.md](root-cause-locator.md) §4.2）

| rootCause.category 候选 | 阶段 | 加载的 R-persona |
|---|---|---|
| `coding-error` | 5 | engineering-code-reviewer + engineering-senior-developer + testing-evidence-collector |
| `design-flaw` | 2-4 | engineering-software-architect + engineering-backend-architect（或 frontend-developer）+ testing-reality-checker |
| `requirement-gap` | 1-4 | product-manager + product-feedback-synthesizer + testing-reality-checker |
| `test-gap` | 4-7 | testing-api-tester + testing-performance-benchmarker + testing-test-results-analyzer |
| `process-missing` | 全阶段 | project-manager-senior + testing-workflow-optimizer + engineering-incident-response-commander |
| `tool-gap` | 全阶段 | engineering-autonomous-optimization-architect + testing-tool-evaluator |
| `upstream-defect` | 全阶段 | engineering-incident-response-commander + testing-evidence-collector + engineering-technical-writer |
| 安全相关 Critical | 5-7 | engineering-threat-detection-engineer + engineering-code-reviewer + testing-reality-checker |
| 性能相关 Critical | 5-7 | engineering-database-optimizer + testing-performance-benchmarker + engineering-backend-architect |
| AI/LLM 相关 | 5 | engineering-ai-engineer + engineering-code-reviewer + testing-reality-checker |

---

## 3. V-persona 选择矩阵（评审多角度）

| 评审场景 | 阶段 | 加载的 V-persona |
|---|---|---|
| 需求规格评审 | 1 | product-manager + product-feedback-synthesizer + testing-reality-checker |
| 系统设计评审 | 2 | engineering-software-architect + engineering-backend-architect + engineering-threat-detection-engineer + testing-reality-checker |
| 概要/详细设计评审 | 3-4 | engineering-software-architect + design-ux-architect + engineering-database-optimizer + testing-api-tester |
| 代码评审 | 5 | engineering-code-reviewer + engineering-senior-developer + engineering-threat-detection-engineer + testing-evidence-collector |
| 测试评审 | 6-7 | testing-api-tester + testing-performance-benchmarker + testing-reality-checker + testing-test-results-analyzer |
| 根因报告复审（targetKind=rootcause） | 全阶段 | testing-reality-checker + engineering-incident-response-commander + testing-evidence-collector |

---

## 4. 分派数量约束

| 场景 | 默认 persona 数 | 上限 | 约束 |
|---|---|---|---|
| R-persona | 3 | 5 | 防止 token 爆炸；incident-response-commander 必含（5-Why 主导） |
| V-persona（评审产物） | 3 | 5 | reality-checker 必含（防幻想通过） |
| V-persona（复审根因） | 2 | 3 | reality-checker + evidence-collector 必含 |

> persona 数量约束与分派方式（并行/串行）无关：串行分派 3 个 persona 与并行分派 3 个 persona 在数量约束上等价。
> 数量可在 `project.json` 的 `phaseConfig.<phase>.parallelPersonas` 覆盖（字段名保留向后兼容，实际含义为「每轮 persona 数」）。

---

## 5. 强制 vs 可选

> 本节的「强制」指**强制多角度**（必须加载 N 个 persona 并聚合），**不要求必须并行**。

| 场景 | 强制/可选 | 说明 |
|---|---|---|
| Critical/Required 缺陷的 R 定位 | **强制多角度** | 严重缺陷须多角度根因（并行或串行均可） |
| Optional/Nit/FYI 缺陷的 R 定位 | 可选多角度（默认单 R-lead） | 轻微缺陷可单 R-lead 产出 |
| 阶段门 V 评审（首次） | 可选多角度（默认单 V） | 首次评审可单 persona |
| 根因报告 V 复审 | **强制多角度** | 根因准确性须多角度保证 |
| maxReworkRounds 达上限前一轮 | **强制多角度** | 最后一轮须多角度穷尽 |

---

## 6. S 子代理「立即执行」约束（第 9 轮 P1.3）

> S 子代理（产出子代理）的分派 prompt 必须包含「立即执行」约束语句，对应反模式 #20（只规划不执行，详见 [subagent-delegation.md](subagent-delegation.md)「反模式 #20」节）。

**强制约束语句**（编排者分派 S 子代理时 prompt 必含）：

> 「你必须立即调用工具执行任务，禁止只返回规划性文字。响应中必须包含至少一次 `Write` / `Edit` / `RunCommand` 调用。若任务需要多步骤，每步都应有对应的工具调用，而非纯文本描述。」

**S 子代理 persona 行为要求**：

| 行为 | 要求 | 检测信号 |
|---|---|---|
| 工具调用 | 响应必须含 ≥1 个 `tool_use` 块 | 无 `tool_use` 块 → 命中 #20 |
| 产物路径 | 响应末尾必须附产物路径或工具调用结果摘要 | 无路径 / `ls` 检查无文件 → 命中 #20 |
| 规划性关键词 | 禁止仅出现「正在准备」「将创建」「我将」而无对应工具调用 | 关键词 + 无工具调用 → 命中 #20 |
| 多步骤任务 | 每步须有工具调用，禁止纯文本描述步骤序列 | 仅文本步骤 → 命中 #20 |

**编排者检测**：

- 收到 S 子代理返回后立即扫描返回中是否存在 `tool_use` 块或产物路径
- 不存在 → 判 #20 命中，回 S 子代理起点重派，prompt 开头追加「⚠ 上次响应只规划未执行（命中反模式 #20），本次必须立即调用工具」
- 同一 S 子代理连续命中 #20 ≥ 2 次 → 🔴 CHECKPOINT 介入

> 与 S 拆分机制（S-doc / S-tla）的关系：拆分后两个子代理都须满足「立即执行」约束，每个子代理返回时都须附各自产物路径（S-doc 附文档路径，S-tla 附 `.tla`/`.cfg` 路径）。

---

## 7. R 子代理「修复既有产物」职责强化（第 9 轮 P2.7）

> R 子代理（根因定位子代理）的修复职责与 S-fix 子代理的协作流程强化。R 定位根因 → S-fix 执行修复 → R 复核紧急修复，形成闭环。对应 [subagent-delegation.md](subagent-delegation.md)「S 子代理修改既有产物的边界」节。

**R 子代理工作流程**（修复既有产物时）：

1. **读取 rootcause 条目**：从 `.w-model/rootcause/rootcause-report.jsonl` 读取最新的 `action=rootcause` 条目（由 S 子代理或前轮 R 产出）
2. **定位 bug 根因**：运用根因分析方法（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯），定位到具体文件、行号、错误逻辑
3. **产出 RootCauseReport**：含 `rootCauseChain` / `fixRecommendation` / `prevention` / `upstreamDefect` 等字段（详见 [root-cause-locator.md](root-cause-locator.md) §4 Schema）
4. **交 V 复审 + G 门禁**：R 报告经 V 复审（targetKind=rootcause）+ G 门禁（`check-rootcause-report.ts`）通过后，分派 S-fix 携 R 报告执行修复
5. **S-fix 修复后**：S-fix 返回 `{artifacts, rtmDiff, fixBasedOn, selfCheck}`，重走 V → G 验证修复有效
6. **紧急修复复核**：若 run-log 中存在 `role=S, action=fix, variant=emergency-fix` 条目，R 子代理须在产出 RootCauseReport 时追加 `emergencyFixReview` 字段：
   - `emergencyFixReview.complete`：紧急修复是否完整解决根因
   - `emergencyFixReview.gaps`：未覆盖的修复点（若有）
   - `emergencyFixReview.recommendation`：`"accept"` / `"supplement"` / `"redo"`
   - `complete=false` 或 `recommendation!="accept"` → 转 S-fix 补充或重做

**R 子代理 persona 强化要求**：

| persona | 强化职责 | 加载时机 |
|---|---|---|
| `engineering-incident-response-commander` | 紧急修复复核（5-Why 主导，判断紧急修复是否触及根因） | run-log 含 `emergency-fix` 条目时必含 |
| `testing-evidence-collector` | 收集 S-fix 修复后的测试证据，验证修复有效 | S-fix 修复后 V 复审时必含 |
| `testing-reality-checker` | 防幻想根因（R 自评根因准确但 S-fix 修复后 bug 仍存在 → 重新定位） | R 重派（round ≥ 2）时必含 |

**R 复核紧急修复的判定矩阵**：

| `emergencyFixReview.complete` | `recommendation` | 编排者动作 |
|---|---|---|
| `true` | `"accept"` | 阶段门放行，紧急修复条目归档 |
| `false` | `"supplement"` | 分派 S-fix 补充修复，重走 V → G |
| `false` | `"redo"` | 回滚紧急修复，分派 S-fix 重做，重走 V → G |

> 与反模式 #18（跳过 R 直接 S 返工）的关系：R 子代理紧急修复复核是 #18 防线的延伸——紧急修复虽由 S 直接执行（受时间压力），但 R 事后复核保证根因未被掩盖。R 复核不通过 → 仍须走标准 S-fix 流程。
