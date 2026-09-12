# 证据支撑树方法论参照（Evidence-Anchored Decision Tree）

> **定位**：外部方法论「证据支撑树联合分析模式」的 W 模型适配参照。
> **适用场景**：**路径不确定 / 需求模糊**的决策任务（与阶段 1 迷雾登记册互补）。
> **边界**：本文件是方法论参照，不是新流程——W 模型 8 阶段、CHECKPOINT、门禁脚本、反模式体系为权威流程。
> **集成结论**：该方法论 90% 能力 w-model 已有且更强；唯一增量 = 产出期 `evidenceAnchor` + `evidenceStatus`（阶段 1-4 全节点必填，见 §3）。
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
| **产出期证据锚点** | **graph.json nodes[].evidenceAnchor（阶段 1-4 全节点必填）+ nodes[].evidenceStatus + check-requirement-graph R15a/b/c/e 子项校验** | **新增（唯一增量；🟡 已获一等状态）** |
| EVIDENCE_GRAPH.md 血缘视图 | graph.json + run-log 决策摘要（人类可读视图可选用模板） | 轻量映射 |
| 熔断判定树 Q1-Q4 | 反模式 #18/#19 + R 报告复审 / 根因门禁 / S-fix 后 R3×3 / 预防审查 / V / G / CHECKPOINT 链 | 复用（更强） |
| 每 3 个叶子周期校验 | R3 预防性审查 ×3 + ICEBERG-A/B + 阶段门 | 复用（节奏更强） |

## 3. 唯一增量：evidenceAnchor

- **定义**：图谱节点结论的前提事实锚点，由 A 子代理 ingestion 时声明（A-chunk 提取时对来源声明，A-cross 合并保留）；
  S 子代理产出规格 §4.2 只读同步；V 评审可按 completeness 子标准核验存在性；G 门禁校验格式与对账。
- **格式**：遵循 conventions.md 列定位约定——`path:§section=statement` 或 `path:L42=statement`（复用 EVIDENCE_PATTERN 语义）。
- **必填（41.7.0 起）**：阶段 1-4 全部图谱节点**必填** `evidenceAnchor`，缺失即 `check-requirement-graph.ts` R15a 失败。
  早期版本的"未声明不视为缺陷"是向后兼容让步，已被证明会让"格式合规但事实错误"的锚点混入——批量迁移存量 `graph.json`（补锚点）是升级动作，不是可选清理。
- **`evidenceStatus`**：与锚点同为必填字段，枚举 `confirmed | pending`：
  - `confirmed` = 该锚点已被核验（R15e 要求签名链中存在引用本节点的 V review 环作为证据）；
  - `pending` = 基于逻辑推理、尚未验证。
  两者必须如实填写：把 `pending` 直接标 `confirmed` 而无签名链 V 环，R15e 会失败（禁止「乐观标记」）。
- **三处语义补齐**（本次由「方法论参照」升为门禁事实）：
  1. 🟡 Pending **获得一等状态**——不再是文档里的 emoji，而是 schema 枚举值，可被门禁读取与统计；
  2. R15 由**单一格式校验**扩展为 **R15a/b/c/e 四个可独立定位的子项**（见下），报告不再笼统报 `[schema] required`；
  3. V 侧 `evidence` 与锚点**交叉对账**——锚点声明"我依据这个"，评审证据须指向同一事实，二者矛盾即缺陷。
- **R15 子项**（`check-requirement-graph.ts`，权威为实现）：

  | 子项 | 判据 | 依赖 |
  |---|---|---|
  | R15a | `evidenceAnchor` 缺失 / 空串 / 非字符串 | 无（纯逻辑） |
  | R15b | `evidenceStatus` 非法（缺失或不在枚举内） | 无（纯逻辑） |
  | R15c | 锚点 `path` 部分在磁盘不存在 | CLI 注入真实路径集合 |
  | R15e | `evidenceStatus=confirmed` 但签名链中无引用本节点的 V review 环 | CLI 注入 signature-chain 条目 |

  > **R15d 已刻意不实现**：原设计意图是用 codegraph `--scope` 覆盖度对账锚点，但 `--scope` 的覆盖语义是 `ChangeScope.changedFiles` 上的**集合成员判定**，而 `check-codegraph-queries.ts` 被硬限制在 `--phase 5|6|7|8`（`parsePhaseArg(process.argv, { min: 5, max: 8 })`），阶段 1-4 按设计不产出 codegraph 查询，图谱节点又只存在于阶段 1-4——两者定义域不相交，无可解析的表达式。故 R15 落地为 **R15a/b/c/e 四项**；编号中的空缺是已决议项，不是遗漏。
  >
  > R15c/R15e 依赖外部产物，由 CLI 读盘后经注入面提供；未注入即跳过（纯单测无文件系统上下文；阶段 1 早期签名链尚未生成时不误红）。
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
