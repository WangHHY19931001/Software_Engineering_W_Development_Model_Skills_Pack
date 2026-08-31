# 证据支撑树方法论参照（Evidence-Anchored Decision Tree）

> **定位**：外部方法论「证据支撑树联合分析模式」的 W 模型适配参照。
> **适用场景**：**路径不确定 / 需求模糊**的决策任务（与阶段 1 迷雾登记册互补）。
> **边界**：本文件是方法论参照，不是新流程——W 模型 8 阶段、CHECKPOINT、门禁脚本、反模式体系为权威流程。
> **集成结论**：该方法论 90% 能力 w-model 已有且更强；唯一增量 = 产出期 `evidenceAnchor`（见 §3）。
> **原文基准**：`docs/superpowers/sources/2026-08-31-evidence-anchored-tree-methodology.md`（仓库内，非运行时资产）。

## 1. 方法论摘要

证据支撑树联合分析模式（Evidence-Anchored Decision Tree with Upward Root-Cause Analysis）将模糊目标视为决策树：
**决策树穷尽 + 事实交叉验证 + 渐进式文档沉淀**，每个结论挂载证据状态（🟢 Confirmed / 🟡 Pending / 🔴 Invalid），
执行中通过"叶子→枝干→根"上行回溯实现动态自愈。四层架构：
1. **认知引擎层**：苏格拉底式拷问（分支穷尽 / 单线程聚焦 / 信息自足 / 证据锚点声明）
2. **验证校准层**：领域驱动事实交叉验证（术语一致性 / 代码事实核对 / 证据状态快照）
3. **产出沉淀层**：渐进式活文档（PLAN.md / EVIDENCE_GRAPH.md / CONTEXT.md / ADR/）
4. **流程控制层**：范围与保真度管理（Token 预算切分 / 保真度过滤器）

## 2. 与 W 模型映射表

| 证据支撑树组件 | W 模型对应机制 | 复用/新增 |
|---|---|---|
| 决策树穷尽 | ingestion 子流程 + graph.json + check-requirement-graph R1-R15 | 复用（更强） |
| 苏格拉底拷问 | /wm analyze 需求解析步骤 1-2（歧义→暂停要用户重述） | 复用（更强） |
| 三色证据状态 🟢/🟡/🔴 | coverageStatus covered/partial/not-covered + qualityLevel A-D + outcome | 复用（枚举等价） |
| 上行根因分析 | R 子代理 + root-cause-locator.md（5-Why/鱼骨图/缺陷链/上游回溯）+ 反模式 #18/#19 | 复用（更强） |
| 决策日志 | run-log.jsonl RunLogEntry.acknowledgedDecisions + event-ingress.jsonl | 复用 |
| 术语一致性校验 | conventions.md 术语表 + 阶段 1 glossary.md | 复用 |
| Token 预算切分 | budget.json + check-budget.ts | 复用 |
| 代码事实核对 | codegraph_explore 强制（约束 #14）+ check-code-tla-consistency.ts | 复用 |
| **产出期证据锚点** | **graph.json nodes[].evidenceAnchor（新增，可选）+ R15 轻量格式校验** | **新增（唯一增量）** |
| EVIDENCE_GRAPH.md 血缘视图 | graph.json + run-log 决策摘要（人类可读视图可选用模板） | 轻量映射 |
| 熔断判定树 Q1-Q4 | 反模式 #18/#19 + R→V→G→S-fix 循环 | 复用（更强） |
| 每 3 个叶子周期校验 | R3 预防性审查 ×3 + ICEBERG-A/B + 阶段门 | 复用（节奏更强） |

## 3. 唯一增量：evidenceAnchor

- **定义**：图谱节点结论的前提事实锚点，由 A 子代理 ingestion 时声明（A-chunk 提取时对来源声明，A-cross 合并保留）；
  S 子代理产出规格 §4.2 只读同步；V 评审可按 completeness 子标准核验存在性；G 门禁 R15 校验格式。
- **格式**：遵循 conventions.md 列定位约定——`path:§section=statement` 或 `path:L42=statement`（复用 EVIDENCE_PATTERN 语义）。
- **可选**：未声明不视为缺陷（向后兼容存量 graph.json）；声明了则必须合法（R15）。
- **与评审证据区别**：evidenceAnchor = 产出者声明"我依据这个"；VerifierOutput.evidence = 评审者证明"我核验过"。

## 4. 明确拒绝照搬的点（避免破坏 W 模型架构）

| 方法论原文 | 拒绝原因 | W 模型正确做法 |
|---|---|---|
| 阶段 5 清空上下文重载 PLAN.md | 违反编排者持久化 | .w-model/*.json + wm-write.ts 锁写 |
| AI 每叶子声明证据并标 🟡 | 违反编排者最小化（反模式 #10） | A 子代理 ingestion 声明，V 评审核验 |
| 新增三色 emoji 标签体系 | 与 coverageStatus/qualityLevel 语义重叠，schema 漂移风险 | 复用现有枚举 |
| 新增 CONTEXT.md/ADR/ 文档体系 | 已有 conventions.md + decision-log/ | 不新建目录 |
| 每 3 叶子强制校验 | 破坏阶段门节奏 | R3 + ICEBERG-B 兜底 |

## 5. 采用建议

- 路径不确定项目进入 `/wm analyze` 前，可先按 §2 映射表自查已覆盖能力，聚焦补 evidenceAnchor。
- 不新增命令 / 不新增脚本 / 不改 eval。交付物引用本方法论时以本章节映射为准。
