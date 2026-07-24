# 人格选择矩阵（Subagent Persona Matrix）

> **定位**：R-lead / V-lead 在多角度分析时选择 persona 的参考矩阵。
> **关联 spec**：[2026-07-24-root-cause-locator-and-fixer-roles-design.md](../../docs/superpowers/specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md) §9.3 + §9.4
> **人格库**：[w-model-dev/subagent/](../subagent/) 含 28 个人格文件，分 5 类。

---

## 1. 现有人格库盘点

| 类别 | 数量 | 人格 | R/V 适用性 |
|---|---|---|---|
| **engineering** | 13 | code-reviewer, senior-developer, software-architect, backend-architect, frontend-developer, ai-engineer, data-engineer, database-optimizer, autonomous-optimization-architect, incident-response-commander, threat-detection-engineer, technical-writer×2 | R + V |
| **testing** | 7 | api-tester, performance-benchmarker, reality-checker, evidence-collector, test-results-analyzer, tool-evaluator, workflow-optimizer | R + V |
| **design** | 3 | ui-designer, ux-architect, ux-researcher | V（阶段 2-3 设计评审） |
| **product** | 3 | product-manager, feedback-synthesizer, trend-researcher, behavioral-nudge-engine | V（阶段 1 需求评审） |
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
