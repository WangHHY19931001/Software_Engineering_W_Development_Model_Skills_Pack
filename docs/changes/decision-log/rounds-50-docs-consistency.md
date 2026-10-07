# 轮次决策记录：第 50 批（批次 8 文档与协议一致性，43.2.0）

> 41.7.0 起 SSoT 只承载当前设计事实，本文件登记批次 8（43.2.0）实施前的用户决策与实施期裁定，
> 对应 [43.2.0]（CHANGELOG.md 条目随批次 8 发布回填）。裁定来源：主规格
> [2026-10-06-w-model-remediation-design.md](../../superpowers/specs/2026-10-06-w-model-remediation-design.md) §7 +
> 增量规格 [2026-10-07-remediation-leftovers-design.md](../../superpowers/specs/2026-10-07-remediation-leftovers-design.md) §3 +
> 批次 7 执行账本的 10 项 riders；SSoT 权威摘要见其 §10T（随批次 8 收口回填）。原文保留，不篡改。
>
> **本文件为批次 8 累积登记**：任务 7 建文件并登记 C6 归档矛盾 + Loop 3/4 成熟度标注；批次 8 其余实施裁定由任务 17 追加。

#### 第 50 批：文档与协议一致性（43.2.0，2026-10-07）

**目的**：销账主规格 §7 全部（单一事实源修复 / 协议口径修正 / 计数与覆盖 / 资产质量 / 如实化标注）+ 增量规格 §3 三项（subagentSpawns 门禁化 / C19 三类易残留锚点 / ai-native-sdlc:134）+ 批次 7 执行期登记的 10 项后续 riders。

**C6：round23 归档 README「pending」vs checkpoint-summary「exit 0」矛盾（如实化标注，归档不改写）**

- **现象**：`docs/changes/archive/2026-07-30-round23-w-model-8-phase-validation/` 内两份文档对同一轮收口给出互斥视图——`README.md` §三 门禁表把四道门记为 `pending`（备注「由 G 子代理」），而 `checkpoint-summary.md` 记四门 `exit 0` 且阶段 8 终检 `退出码 0`。
- **两处引文原文**（逐字摘录，不作改写）：

  `README.md:45-48`（§三 门禁表，staged 快照）：

  ```
  | `check-artifact-gate.ts` (阶段 8 终检) | pending | 由 G 子代理（编排者分派） |
  | `check-requirement-graph.ts --phase=4` | pending | 由 G 子代理 |
  | `check-tla-model.ts --phase=4` | pending | 由 G 子代理 |
  | `check-bdd-model.ts --phase=8` | pending | 由 G 子代理 |
  ```

  `checkpoint-summary.md:25-28`（闭环机制表，终态）+ `:32`（总结）：

  ```
  | check-budget.ts | 0 | budget R1-R5 通过 |
  | check-run-log.ts | 0 | run-log R1-R7 通过 |
  | check-maturity.ts | 0 | maturity R1-R5 通过 |
  | check-checkpoint.ts | 0 | checkpoint R1-R5 通过（acknowledgedDecisions 含 ID 模式或 TECH_KEYWORDS） |

  8 阶段 CHECKPOINT 全部通过。阶段 8 终检（check-artifact-gate.ts）退出码 0 = 630 tests pass + RTM 100% + 覆盖率达标 + TLA+/BDD 0 违反。
  ```

  同 README `:122`（§十 结论）：「✅ check-budget / check-run-log / check-maturity / check-checkpoint 全 exitCode=0」。

- **裁定**：
  1. **以 `checkpoint-summary.md` 为终态视图为准**；README §三 门禁表的 `pending` 行为 **staged 快照残留**——快照时点早于 G 子代理执行（表内备注「由 G 子代理（编排者分派）」即该时点的意图登记），非最终判定。同一 README §十 `:122` 已记四门 `exitCode=0`，与 `checkpoint-summary.md:25-28` 一致，故 README 内部即为「staged 表 vs 终态结论」两视图并存，本质是**时间点标注缺失的文档缺陷**，而非两文各执一词的实质冲突。
  2. **引用规则**：该归档的收口状态以 `checkpoint-summary.md` 为准；引用 README §三 门禁表须注明其为运行中途快照，不得作为收口结论的依据。
  3. **如实存疑（不下过头结论）**：`check-requirement-graph.ts --phase=4` / `check-tla-model.ts --phase=4` / `check-bdd-model.ts --phase=8` 三项在归档内**无逐项最终 exit code 的直接记录**——仅有 `checkpoint-summary.md:32`「TLA+/BDD 0 违反」、`tla-summary.md`（SANY/TLC 通过、0 违反）、`bdd-summary.md`（D1-D7 全 ✓）与 `checkpoint-summary.md` 阶段 4 门行（「4 TLA+ L1-L4 / 4 BDD 32 scenarios」）作**间接佐证**。本登记按「间接证据、非逐项直接记录」标注，不复述为 `exit 0`。
  4. `README.md:80` 与 `checkpoint-summary.md:18-19` / `:34` 的「用户确认 pending」（项目级放行须用户在 `acceptance-test-report.md` §9 确认 `confirm`）**两文一致，不属矛盾**，不得并入本矛盾叙述。
  5. **归档不改写**（同「不篡改演进史」原则）：不改 README 的 pending 行、不加脚注、不修订任何归档文件；本登记即为消歧位，后续引用按上述规则执行。

**Loop 3/4 成熟度头部标注（如实化标注）**

- **落点**：`w-model-dev/references/event-ingress-guide.md` 头部（来源行之后）与 `w-model-dev/references/hill-climbing-guide.md` 头部（来源行之后）各加一行：

  ```
  > **成熟度：文档协议，无运行时执行器**（本指南定义协议与判据；执行由 Agent 按协议进行，仓库不含自动执行器）。
  ```

- **依据**：两指南自述「技能不内置 cron/webhook/GitHub Actions/Slack bot」（Loop 3 事件接驳）与「技能只产出改进信号，不自动改 harness」（Loop 4 爬坡循环），但此前头部未显式声明「无运行时执行器」，易被读为已实现自动化能力。标注仅为文档级如实化，**无机制改动、无门禁新增、无运行时行为变化**。

| 维度 | 内容 |
|---|---|
| 版本号 | 43.2.0（批次 8 目标版本） |
| 门禁影响 | 无（decision-log 不参与门禁；两 guide 仅头部加注，无脚本消费该行） |
| 归档处理 | round23 归档零改写；矛盾以本文件登记消歧（C6） |
| 验证 | docs-consistency 0 违规 + eval 68/68（任务 7 实测，见批次 8 执行账本）；其余批次收口见任务 17/18 |
