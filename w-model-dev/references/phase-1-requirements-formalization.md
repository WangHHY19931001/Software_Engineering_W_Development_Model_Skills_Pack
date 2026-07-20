# Phase 1 可选增强：需求形式化（委托 SRS-Formalizer）

> 本文件是 [phase-1-requirements.md](phase-1-requirements.md) 的可选增强附件，默认关闭。
> 仅当满足前置条件时由 Agent 触发；不触发时本文件不参与 Phase 1 流程。

## 触发条件（必须全部满足）

1. 用户提供正式 SRS 文档（Markdown / HTML / 多目录包），而非口头或卡片式需求；
2. 用户显式 opt-in（如"启用形式化"/"生成 BDD"/"做 TLA+ 建模"）；
3. 运行环境具备 SRS-Formalizer 前置依赖（Node.js ≥20；TLA+/Lean 仅在条件触发时需要）。

## 委托范围

将 Phase 1 的部分语义工作委托给 [SRS-Formalizer](https://github.com/WangHHY19931001/SRS-Formalizer)（外部技能，Agent 驱动 + 脚本门禁，架构与本技能同源）：

| 委托子流程 | 产出 | 是否必选 | 对应本阶段产物 |
|---|---|:---:|---|
| Parse → Shard → Extract → 装配 SRS-IR | 结构化需求中间表示 | 必选 | 喂入《需求规格说明书》结构化提取 |
| BDD 场景生成（Gherkin `.feature`） | 验收测试场景 | 必选 | 喂入「验收测试用例设计文档」 |
| 需求知识图谱（Neo4j Cypher） | 需求依赖/冲突图 | 必选 | 喂入「需求冲突检测」与 RTM |
| NFR 标记 + 风险评分 | 非功能需求清单 + 风险等级 | 必选 | 喂入「需求风险评估报告」 |
| TLA+ 形式化规约 | `.tla` 模型 + TLC 验证 | **条件触发** | 仅对含并发/状态机/关键一致性的模块 |
| Lean 4 定理证明 | `.lean` 证明 | **条件触发** | 仅对 security/compliance NFR |

## 权威性约定（重要）

为避免双状态源与双门禁冲突：

1. **RTM 唯一事实源**：本项目的需求追溯以 `.w-model/rtm.json` 为准。SRS-Formalizer 产出的 traceability matrix 仅作为**输入**并入 RTM，不在 `.srs_formalizer/` 内独立持久化追溯结论。
2. **阶段门放行权威**：Phase 1 的阶段门放行仍以本技能的 `check-verifier-output.ts` 校验通过为准（见 phase-1-requirements.md「阶段门评审」）。SRS-Formalizer 的 `verify-gate --stage S1|R3|FINAL` 仅作为 Phase 1 内部的**形式化子门禁**，其结果作为评审输入而非放行依据。
3. **工作目录隔离**：SRS-Formalizer 的所有产物写入 `.srs_formalizer/`，不污染 `.w-model/`；Agent 负责将所需产物（BDD / 图谱 / NFR 报告）抽取并登记到 w-model 的对应文档与 RTM。

## 不应触发的场景

- 无正式 SRS 文档（仅有口头或卡片式需求）—— SRS-Formalizer 前置条件不满足
- 纯 CRUD / 信息管理系统，无并发/状态机/安全合规需求 —— TLA+/Lean 收益低于引入成本
- 运行环境无法安装 Java JRE ≥11（TLA+ TLC）或 Lean 4 —— 仅可用其 BDD+KG 子集，需与用户确认收益

## 委托执行指引（分步命令）

按以下顺序执行，每步必须过门禁脚本才进入下一步：

1. **初始化**：`npx srs-formalizer init --project <dir>`（生成 `.srs_formalizer/`）
2. **Parse → Shard**：`npx srs-formalizer parse <srs.md> && npx srs-formalizer shard` → 门禁 `validate-jsonl`
3. **Extract → 装配 SRS-IR**：`npx srs-formalizer extract && npx srs-formalizer assemble-ir` → 门禁 `validate-semantics`
4. **BDD 场景生成**：`npx srs-formalizer bdd-gen` → 门禁 `validate-bdd`
5. **知识图谱**：`npx srs-formalizer build-kg`
6. **NFR 标记 + 风险评分**：`npx srs-formalizer nfr-tag --risk-score`
7. **（条件触发）TLA+**：`npx srs-formalizer tla-gen --module <name>` → `java -jar tla2tools.jar TLC <model>.tla`
8. **（条件触发）Lean 4**：`npx srs-formalizer lean-gen --nfr <id>` → `lake build`

## 产出物并入清单

| SRS-Formalizer 产物 | 并入目标 | 字段映射 |
|---|---|---|
| `srs-ir.json` | 《需求规格说明书》结构化提取段 | `requirements[].id` → RTM 需求列 |
| `features/*.feature` | 验收测试用例设计文档 | 每个 Scenario → 1 条 UAT 用例 |
| `kg.cypher` 依赖关系 | RTM 需求依赖列 | `DEPENDS_ON` 关系 → 依赖矩阵 |
| `nfr-report.json` | 需求风险评估报告 | `risk_score ≥ 7` 标为高风险 |
| TLA+ 反例 / Lean 证明 | 风险评估报告附录 | 反例路径 → 风险场景；`theorem + proof` → 合规验证 |

## 边界条件与 Fallback

| 异常场景 | 检测条件 | Fallback 路径 |
|---|---|---|
| SRS-Formalizer 调用失败（网络 / 依赖缺失） | `init` 退出码 ≠ 0 或超时 | 记录到 `.srs_formalizer/error.log`；降级为 Agent 手动提取（套 SRS-IR schema）；RTM 标「形式化降级」 |
| 门禁脚本校验失败 | `validate-*` 退出码 ≠ 0 | 输出明细回上一步修复；3 次失败 → 降级仅做 BDD |
| TLA+ 不可用（无 Java JRE） | `java -version` 退出码 ≠ 0 | 跳过 TLA+；风险报告标「未做并发形式化验证」；用户显式接受 |
| Lean 4 不可用 | `lake --version` 退出码 ≠ 0 | 跳过 Lean；security/compliance NFR 改人工审查清单 |
| 产出物冲突（SRS-IR 与 RTM 不一致） | 需求 ID 或字段在两处不同 | 以 `.w-model/rtm.json` 为准；冲突项记入 `decisions/conflicts.md` 等用户裁决 |
