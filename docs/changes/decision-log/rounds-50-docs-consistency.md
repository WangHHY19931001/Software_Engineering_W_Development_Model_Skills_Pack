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

---

#### 实施期裁定与后续登记（任务 17 追加，2026-10-07 批次 8 收口）

**预飞裁定（R-B8-1…R-B8-3，批次 8 计划执行前登记）**

| # | 裁定 | 内容 |
|---|---|---|
| R-B8-1 | 计数口径 | 主规格 §7 头注 15 项（含 C15）vs 增量规格 §5 表 14 项——本批按「**C15 纳入**」执行（任务 14 落地），销账口径 = 15 C 项 + 增量 §3 三项 + 批次 7 执行期 riders 10 项 |
| R-B8-2 | 行号基准 | 计划行号为 HEAD=42620669 时点参考，实施以内容定位为准（各任务实测漂移 +1~-7 行不等，均按内容命中、无漏改） |
| R-B8-3 | CHANGELOG 样式 | 任务 17 不预写未跑测结论（批次 7 T14 教训）——验证记录占位只写「待任务 18 回填」，耗时数字不引不存在出处 |

**C18 反模式分级判据（R-B8-4，任务 10 实施裁定，控制者独立复核同意）**

- **判据锚 = 条目本体，非例示具体度**：条目本体的缺陷模式与教训跨项目、跨技术栈成立即「通用」；本体教训仅在特定工具链/技术栈下可复现（典型信号：本体陈述不可去除特定工具/命令名）即「项目教训化石」。
- 技能内建方法栈（TLA+/BDD/codegraph/skill 自身 schema 契约）对技能的每个采用者都存在、教训可迁移，按定义计入通用，不因「技能内部」而计化石。
- 结果：48 条 = **47 通用 + 1 项目教训化石**（#25 PowerShell ConvertTo-Json 写入——BOM/深度/中文乱码教训仅在 PowerShell/Windows 工具链可复现）；#22/#23/#24/#36 四条争议条目经「本体抽象化」裁定归通用（如 #22 本体 = 「仅认证未鉴权」，跨栈成立）。
- 形态约束：主清单表行首前缀 `【通用】`/`【项目教训化石】`，**不加表列**——`docs-consistency-logic.ts` 以精确字符串锚定表头与 `\| 48 \|` 区间，加列会破坏门禁锚；前缀形态对全部门禁锚点零影响（任务 10 侦察证据）。
- 同族口径（C17 人格去栈化）：36 个 persona 的工具链残留按「教训保留、参数级 1:1 改写为跨栈表述」处置（jdeps / EXPLAIN ANALYZE / Lighthouse 等命令名清除），与 C18 判据同源（跨栈可迁移性）。

**C9 五处收敛扩张（任务 4 实测，规格登记之外）**

- 规格 §7 登记 C9 时的副本清单不完整：实测全仓 `<r10-contract` 全文副本**五处**（verifier-spec §7.5 / root-cause-locator / command-reference / agent-personas / SSoT），较规格登记多出三处。
- 裁定：权威 = **verifier-spec §7.5 保留全文**；其余四处改一行指针（各保留一句消费语境）；SSoT 处用引用+说明（保留设计语境，不复制 XML）。
- 门禁配套（T4 修复轮 1）：`check-docs-consistency.ts` 的 R10 指针判定加固——非围栏 + 同段 + 否定拒斥 + 跨行，消费方三向 fail-closed；防指针被静默改回复述或被误判为合规。

**C6 矛盾登记的引用规则（承接任务 7 登记，CHANGELOG [43.2.0] 已引用）**

- CHANGELOG [43.2.0] 以本文件 C6 登记为 round23 归档收口状态的唯一消歧位：引用归档 README §三 门禁表须注明「运行中途快照」；收口结论以 `checkpoint-summary.md` 为准；三项无逐项 exit code 直接记录的门（requirement-graph / tla-model --phase=4、bdd-model --phase=8）按「间接证据、非逐项直接记录」标注。归档零改写。

**后续候选登记（本批不修）**

| 来源 | 登记项 | 处置 |
|---|---|---|
| T5 审查次要 5 | 模型档位全覆盖 20 处缺（C12 只保证 S 模板范围内，余量未覆盖） | 后续批次候选 |
| T5 审查登记 | `phase-1-requirements.md` 表 6/7 张力（既存） | 后续 docs 批次候选 |
| T5 审查登记 | subagent-delegation「另读」vs「按需」措辞松紧（:96 附近） | 后续批次候选 |
| T15 审查次要 1 | task-15 报告「无新增漏报」绝对化措辞被析取窗口保守方向证伪、须软化——报告文件在 gitignored 执行账本内，随账本记录，仓库文件不改 | 登记 |
| 各审查 Minor 其余 | 见批次 8 执行账本（`.superpowers/sdd/2026-10-07-batch8-docs-consistency/progress.md`，gitignored 账本）逐条留痕，已逐条指派或登记 | 逐条处置 |

| 维度 | 内容 |
|---|---|
| 版本号 | 43.2.0（本节为该版本实施裁定的收口登记） |
| 门禁影响 | `check-budget.ts` R7 成真（Breaking，见 CHANGELOG [43.2.0]）；`check-docs-consistency.ts` R10 指针判定加固（本批唯一门禁改造） |
| 验证 | docs-consistency 0 违规 + eval 101/101（任务 17 提交前实测）；prepush 19 项待任务 18 回填（R-B8-3 样式纪律） |
