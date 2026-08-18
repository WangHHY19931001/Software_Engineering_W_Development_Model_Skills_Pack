# 编排者-子代理边界（Orchestrator-Subagent Boundary）

> **§0 按需分节加载导引**（约束 #6）：本文件较大，按下表只读所需节，禁止整文件载入上下文。
>
> | 触发场景 | 只读章节 |
> |---|---|
> | 首次分派子代理（谁做 / 何时派 / 禁做什么） | 角色划分 + 每阶段分派时序 + 强制约束 |
> | 阶段 1–4 任务过重需拆分 S | S 拆分机制 |
> | 返工需多角度根因定位 | R-lead 子代理分派模板 |
> | 覆盖缺失 / 冲突 / 覆盖率不达标需豁免 | 豁免审批角色边界 |
> | S 发现既有产物 bug 需紧急修复 | S 子代理修改既有产物的边界 |
>
> 下方「加载导引」节给出更细的锚点加载策略。

## 加载导引

> 本文件较长，按需分段加载，避免一次性全量载入。加载策略如下：

- **首次分派只读**：编排者首次分派子代理前，只读 [§角色划分](#角色划分六类核心角色-o--s--v--g--a--r--r-iceberg-变体) + [§每阶段分派时序](#每阶段分派时序) + [§强制约束](#强制约束) 三节，建立「谁来做 / 何时派 / 什么不能做」的最小认知，即可开始分派。
- **§S 拆分机制**：阶段 1–4 首次分派 S 子代理时加载（见 [S 拆分机制（阶段 1–4 任务过重时）](#s-拆分机制阶段-1-4-任务过重时)），判断是否需将 S 拆为 S-doc / S-tla / S-bdd / S-ingest 变体。
- **§R-lead**：按场景触发——V/G 命中返工且需多角度根因定位时加载（见 [R-lead 子代理分派模板](#r-lead-子代理分派模板多角度变体并行串行均可)）。
- **§豁免审批**：按场景触发——出现覆盖缺失 / conflicts-with / 覆盖率不达标等需豁免事项时加载（见 [豁免审批角色边界](#豁免审批角色边界)）。
- **§S-emergency-fix**：按场景触发——S 子代理发现既有产物 bug 且阻塞当前阶段推进、需走紧急修复通道时加载（见 [S 子代理修改既有产物的边界](#s-子代理修改既有产物的边界)）。

> SSoT [§3.4](../../docs/skill-design-document_SSoT.md) 为权威定义，本文件为可执行细则。
>
> **目的**：编排者工作最小化——编排者只做编排（路由 / 状态读写 / CHECKPOINT 等待 / 分派子代理 / 持久化 / 只读脚本），任何修改、编码、调测、分析、修正、验证产出的实施动作必须由子代理执行。
>
> **强制等级**：违反本文件「强制约束」节命中反模式 #10「编排者越权实施」（见 [anti-patterns.md](anti-patterns.md)），**命中即回退到当前阶段起点**。
>
> **与 [agent-personas.md](agent-personas.md) / [verifier-spec.md](verifier-spec.md) 的关系**：本文件定义「谁来做」（角色划分与分派），agent-personas.md 定义 V 子代理内部的角色视角，verifier-spec.md §6（输出 Schema）+ §8（提示词模板）定义 V 子代理的输出 Schema 与提示词模板。三者互补，不冲突。

## 目录

- 角色划分（O / S / V / G / A / R / R-iceberg）
- 主刀职责映射表
- 文件落地交接协议与编排者状态日志
- 每阶段分派时序
- 子代理分派模板（含 R3 预防性审查 + R-iceberg 冰山扫掠 + V 复审根因 + R-lead）
- 回填契约
- 强制约束
- 与现有约束的兼容性
- 失败模式与回退

## 角色划分（六类核心角色 O / S / V / G / A / R + R-iceberg 变体）

| 角色 | 简称 | 职责 | 允许动作 | 禁止动作 |
|---|---|---|---|---|
| **编排者** | O | 路由、状态读写、CHECKPOINT 等待、分派子代理、持久化 | ① 读 `.w-model/project.json` / `.w-model/rtm.json` / `.w-model/budget.json` / `.w-model/run-log.jsonl` / `.w-model/maturity.json`；② 跑 `check-verifier-output.ts` / `check-artifact-gate.ts` 看**退出码**（只读，用于向用户展示或路由判定）；③ `git status` / `ls` / `Read` 等只读核验；④ 在 CHECKPOINT 暂停等待用户决定；⑤ 用户放行后更新 `project.status` 与 `updatedAt`；⑥ 分派 S / V / G 子代理；⑦ **维护 budget.json / run-log.jsonl / maturity.json**（状态读写+持久化，非实施；见 [operational-recovery.md](operational-recovery.md)「成本预算与运行日志」节 + 「成熟度与 CHECKPOINT 放行」节）：项目初始化创建三文件、每次子代理返回/门禁执行/CHECKPOINT 放行后 append run-log、预算检查、成熟度判定与升降级；⑧ **维护 event-ingress.jsonl + 事件路由**（状态读写+路由判定，非实施；见 [event-ingress-guide.md](event-ingress-guide.md)）：L2+ 激活时读 event-ingress.jsonl 未路由事件、查路由表、写 routedTo、append run-log action=event-route；⑨ **产出 HarnessImprovementReport**（状态分析，非实施；见 [hill-climbing-guide.md](hill-climbing-guide.md)）：分析 run-log 产出改进信号报告，存 `.w-model/hill-climbing/<ts>-report.json`，不自动改 harness | ① 用 `Write` / `Edit` 写或修改任何阶段产物文件；② 产出 `VerifierOutput` JSON 内容；③ 修改 `rtm.json` 实体字段（需求 / 设计 / 测试用例 / 执行结果）；④ 生成测试用例代码或业务代码；⑤ 跳过 S → V → G 顺序（如自评自审） |
| **产出子代理** | S | 生成阶段开发产物 + 同步测试设计 + 更新 RTM 实体 | ① 写文件（需求规格 / 设计文档 / 代码 / 测试用例代码 / 测试报告）；② 跑测试运行器（仅产出阶段，如 `npx vitest run`）；③ 改 `.w-model/rtm.json` 实体字段（需求 / 设计 / 测试用例 / 执行结果）；④ 加载当前阶段 `phase-N-*.md` 与对应模板 | ① 跑 `check-verifier-output.ts` / `check-artifact-gate.ts`（由 G 子代理负责）；② 越阶段产出（仅产当前阶段）；③ 改 `project.status`（由编排者负责） |
| **评审子代理** | V | 按 [agent-personas.md](agent-personas.md) + [verifier-spec.md](verifier-spec.md) §8 产出 `VerifierOutput` JSON | ① 读产物文件（需求规格 / 设计文档 / 代码 / 测试用例 / 测试报告）；② 按 `targetKind` 选用 Persona（code-reviewer / test-engineer / security-auditor / performance-auditor）；③ 产出 `VerifierOutput` JSON（满足 [verifier-spec.md](verifier-spec.md) §6 Schema） | ① 跑门禁脚本（由 G 子代理负责）；② 改产物文件；③ 改 RTM；④ 跨阶段评审 |
| **门禁子代理** | G | 跑 `check-verifier-output.ts` / `check-artifact-gate.ts` + 回填证据摘要 | ① 跑 `npx tsx w-model-dev/scripts/cli/check-verifier-output.ts "<json>"`；② 跑 `npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts [project-dir]`；③ 读 GATE_JSON / Verifier JSON；④ 产出证据摘要字符串（含退出码 / 质量等级 / `passed` / `reworkHints`） | ① 改产物文件；② 产出 `VerifierOutput` JSON（由 V 子代理负责）；③ 改 RTM 实体；④ 跑测试运行器（由 S 子代理负责） |
| **分析子代理** | A | 分块分析、交叉合并、图谱演进（阶段 1–4） | ① 读原始文档分块 / S 产出的正式文档；② 写 `.w-model/ingestion/<chunk-id>.{md,json}`；③ 读所有 chunk json 合并建图；④ 产出 `consolidated.json` + `cross-analysis-report.md` + `reworkHints`；⑤ 通过晋升 consolidated.json 更新 graph.json | ① 跑 `check-requirement-graph.ts`（G 负责）；② 写正式阶段产物；③ 改 `project.status`；④ 越阶段产出；⑤ 删除前阶段已通过的图谱节点 |
| **根因定位子代理** | R | 接收 V/G 的 `reworkHints` + 失败产物 + 上游产物，运用根因分析方法论定位缺陷根因，产出 `RootCauseReport`（含根因链、上游缺陷标记、修复建议、防御措施） | ① 读失败产物文件 + 上游产物（需求/设计/代码/测试/TLA+/graph.json）；② 读 V 的 `VerifierOutput` JSON + G 的 GATE_JSON；③ 运用根因分析方法（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）；④ 产出 `RootCauseReport` JSON + `.md` 报告文件；⑤ 标记 `upstreamDefect`（若根因为上游需求/设计缺陷）；⑥ 作为 R-lead 分派 R-persona 子代理（并行或串行均可）并聚合产出（见 root-cause-locator.md §4） | ① 改任何产物文件（由 S 修复）；② 跑门禁脚本（由 G 负责）；③ 改 RTM 实体；④ 改 `project.status`；⑤ 跨阶段定位（仅定位当前阶段产物的缺陷根因，上游回溯仅标记不修改）；⑥ 评审其他角色产出 |
| **冰山扫掠子代理** | R-iceberg（R 变体） | S-fix 后（ICEBERG-A）或阶段门放行前（ICEBERG-B）以已发现/已修复问题为线索，对全阶段产物做多视角深挖扫掠，产出 `IcebergSweepReport`（多发现扫掠报告，找"水面之下"） | ① 读全阶段产物（需求/设计/代码/测试/TLA+/BDD/graph.json/RTM）；② 读本轮 reworkHints 历史 + 修复点；③ 读上一轮 IcebergSweepReport（避免重复发现）；④ 运用冰山扫掠方法（三维度×六类别，见 [iceberg-sweep-guide.md](iceberg-sweep-guide.md)）；⑤ 产出 IcebergSweepReport JSON + `.md` | ① 改任何产物文件（由 S-fix 修复）；② 跑门禁脚本（由 G 负责）；③ 改 RTM 实体；④ 改 `project.status`；⑤ 跨阶段定位（仅当前阶段产物）；⑥ 评审其他角色产出；⑦ 跳过 V 复审直接触发 S-fix |

> **只读脚本例外**：编排者可执行 `npx tsx w-model-dev/scripts/cli/check-*.ts`、`git status`、`ls` 等确定性只读命令以核验状态/展示证据，但不得**写入或修改**任何产物/评审/RTM 内容。门禁脚本本身为确定性 TypeScript，不含 LLM 调用，编排者跑它仅用于"看退出码"，不构成实施，也**不替代 G 子代理的回填职责**——G 子代理必须独立跑一次并产出证据摘要。

## 主刀职责映射表

> 吸收自《agent 时代的人月神话》第 3 章「外科手术队伍」。概念完整性只能从"一个头脑的持续持有"里长出来——主刀由人坐，支持角色全部可由 agent 出任。

| 外科手术队伍角色 | W 模型对应 | 归属 |
|---|---|---|
| 主刀（持有概念 / 拍板 / 核心判断 / 最终负责） | 用户 + 编排者 O（代表人的判断，只做编排不实施） | 人 |
| 副手（随时可接替主刀） | 不支持由 agent 接替——目的持有不可委托；仅陪练/评审可由 V 兼任 | 人 |
| 管理员 / 文档 / 录入 / 工具 / 测试 / 语言律师 | S / A 子代理 + 宿主工具（git / lint / schemas / 测试运行器） | agent |

**目的持有者溯源**：开工前在 `project.status` 或阶段产物中写明"此任务最终服务于谁的什么目的"，作为判据的最上游锚点，所有子判据向下推导。

**修正权**（与约束 #8『编排者最小化』、反模式 #10『编排者越权实施』互补）：O 不实施（agent 侧约束），但**用户**保留修正权——人在回路的最低标准 = 能在过程中间改产物而不用整体重跑。凡只提供审计权（日志/面板/思维链展示）而无修正路径的产物设计视为不合格（见 [anti-patterns.md](anti-patterns.md) 反模式 #46）。

## 上下文装填原则

> 吸收自《agent 时代的人月神话》第 6 章「贯彻执行」：任何一次转述都是一次未声明的重新定义。

- **原文照搬**：任务背景原文装填，不翻译、不分解、不预处理；补充说明写下来也视为原文。
- **禁止自撰摘要**：长期项目启动禁止给"自己整理的摘要"——让 agent 读原始文档，或 RAG/grep 随用随取；你以为在帮 agent，实际是在替它做你没意识到的判断。
- **验证账单**：每加一个 subagent，预算一笔"主读产出并验证"的 token/时间成本；验证链可省步、省不到零，最终裁决者必须是持有目的的人。

## S 子代理简报质疑权

> 吸收自 Agentic Design Patterns ch19「承包商模型·协商反馈」：承包商对合约可协商——发现数据源不可达/范围歧义时，先返回质疑，而非硬做或静默改动。

- **S 收到简报先评估可执行性**：依赖缺失 / 上游产物不可达 / 范围歧义 / 简报与当前阶段产物矛盾时，S 须返回质疑清单（含缺失项 + 所需输入 + 建议），不得硬做、不得自行改范围。
- **质疑清单格式**：`blockers[]`（阻断项）+ `assumptions[]`（当前假设）+ `requestedInputs[]`（所需输入）+ `suggestedPath`（建议路径）。
- **O 处置**：收到质疑清单 → 补齐输入或裁决范围 → 重发简报；不得忽略质疑直接派下一个动作。
- **与操作行为的关系**：强化操作行为 #2（Manage Confusion）与 #3（Push Back）的 S 侧落点——把返工成本从产物层提前到简报层。
- **与反模式 #9/#10 的关系**：质疑不等于越权——S 不实施 O 的裁决动作，只返回问题；O 保留路由裁决权。

## 文件落地交接协议与编排者状态日志（File-Landing Handoff & Orchestrator Journal）

> **目的**：编排者 token 最小化 + 子代理间信息不经编排者转发 + 编排者工作全程落地可追溯。本节是 [回填契约](#回填契约) 的前置约束：子代理返回 O 的内容须降至最小信标，完整产出以文件为媒介在子代理间直传。
>
> **强制等级**：违反本节「禁止转发」「状态日志强制」命中反模式 #10 变体（编排者越权承担信息搬运），回退到当前分派起点。
>
> **与既有机制的关系**：本节**不替代** `run-log.jsonl`（事件流水 / append-only 审计）、`progress.md`（SDD 完成账本）、task-brief / review-package 文件模式（brief / report 文件雏形）；在它们之上增加「状态日志当前快照」+「status.json 信标」+「O 不读 output」硬约束。

### 1. 编排者状态日志（current / done / next）

编排者在 `.w-model/orchestrator-state.md` 维护一份**当前快照**（非流水），结构固定三段，O 的"我在哪 / 干完了什么 / 下一步干什么"地图：

```markdown
# Orchestrator State
updated: <ISO8601>
phase: <N - 名称>

## CURRENT
- 分派 <role>（<dispatch-id>），等待 <产物 beacon | CHECKPOINT 放行 | 用户澄清>
- started: <ISO8601>

## DONE
- [<dispatch-id>] <role> → <one-line outcome> | beacon: handoff/<dispatch-id>/status.json
- ...

## NEXT
- [<dispatch-id>] <role> 读 handoff/<prev-dispatch-id>/output.md → 产 handoff/<dispatch-id>/output.md
- ...
```

**更新规则**：
- 每次**分派前**与**收到 beacon 后**，O 用 `Write` 整文件覆盖（原子更新，非 append）。
- compaction / 会话恢复后，O 先 `Read` 本文件 + `run-log.jsonl` 尾部重建位置；**不得凭记忆分派**。
- 阶段门 CHECKPOINT 须展示本文件 `DONE` 段作为分派完整性证据（与约束 #8 互补）。

**与既有三文件互补、不替代**：

| 文件 | 性质 | 内容 |
|---|---|---|
| `orchestrator-state.md` | 当前快照（覆盖式） | current / done / next |
| `run-log.jsonl` | 事件流水（append-only） | 审计每条分派 / 门禁 / CHECKPOINT |
| `progress.md` / 阶段门记录 | 完成账本（append-only） | 已完成任务 + 提交区间 |

### 2. 交接目录协议（handoff directory）

根目录：`.w-model/handoff/`。每次分派一个子目录 `handoff/<dispatch-id>/`，`<dispatch-id> = phase<N>-<role>-<seq>`（如 `phase1-S-01`、`phase1-V-01`、`phase1-G-01`、`phase1-R-01`、`phase1-S-fix-01`）。

每个分派目录固定三文件：

| 文件 | 写入者 | 内容 | O 是否可读 |
|---|---|---|---|
| `brief.md` | O（指针型，非内容） | 任务一句话定位 + 输入产物**路径列表** + 产出契约 + 禁止项 | 否（O 已知路径，无需读） |
| `output.md` | 子代理 | 完整产出（报告 / VerifierOutput JSON 内容 / diff 摘要 / 根因报告 / 证据） | **否** |
| `status.json` | 子代理 | 信标（< 200 字节） | **是（唯一可读）** |

`status.json` Schema：

```json
{
  "role": "S|V|G|A|R|S-fix",
  "dispatchId": "phase1-S-01",
  "state": "DONE|BLOCKED|NEEDS_CONTEXT",
  "output_path": "handoff/phase1-S-01/output.md",
  "exit_code": 0,
  "quality_level": "A|B|C|D",
  "one_line_summary": "产出需求规格 + RTM REQ 列 + L1 TLA+，coverage 100%",
  "next_hint": "派 V 评审 handoff/phase1-S-01/output.md"
}
```

**禁止转发规则（核心）**：
- O **只** `Read` 各 `status.json`；**禁止** `Read` 任何 `brief.md` / `output.md` 内容。命中即反模式 #10 变体。
- 下游子代理**直接** `Read` 上游 `output.md`，不经 O 搬运：
  - V 读 S 的 `output.md`（+ R3 三份报告路径）
  - G 读 V 的 `output.md`（VerifierOutput JSON）
  - R 读 V/G 的 `output.md`（reworkHints + 失败产物路径）
  - S-fix 读 R 的 `output.md`（RootCauseReport + fixRecommendation）
- O 在下游 `brief.md` 里只写"读 `handoff/<prev-dispatch-id>/output.md`"指针，不粘贴内容。
- 子代理返回 O 的文本 ≤ 5 行：仅 `{state, dispatchId, status.json 路径, one-line}`。完整产出在 `output.md`。

> 与 task-brief / review-package 文件模式的关系：SDD 的 brief / report 文件即本协议 `brief.md` / `output.md` 的雏形；本协议增加 `status.json` 信标与"O 不读 output"硬约束，把"O 读路径"进一步降为"O 只读信标"。

### 3. 任务拆分预算（simplicity budget）

每个子代理任务须满足**全部**，否则 O 必须先拆分再分派：

- **单一产出类型**：doc / tla / bdd / code / review / gate / rootcause 之一；混合产出 → 用既有变体拆分（S-doc / S-tla / S-bdd、S-explore / S-propose / S-coding、R-lead / R-persona）。
- **单一阶段**：越阶段 → 拆分。
- **输入文件 ≤ 5 个**：超出 → 用 `brief.md` 聚合路径列表，子代理按需 `Read`，禁止全量塞入 brief。
- **产出文件 ≤ 3 个**：超出 → 拆分为多次分派。
- **预期单次往返**：复杂任务须先拆；子代理 `BLOCKED` / 轮次膨胀 / 产出质量稀释 → O 拆分后重派（**不计入返工 round**，属编排拆分而非质量返工）。

**过重信号**（命中即拆分重派）：
- 子代理返回 `NEEDS_CONTEXT` ≥ 2 次（上下文过大信号）
- 单次 `output.md` 超过该角色预算（doc ≤ 1 文件、review ≤ 1 JSON、gate ≤ 1 摘要、rootcause ≤ 1 报告）
- 子代理主动报告"任务过大 / 需要拆分"

### 4. 编排者 token 最小化检查清单

O 会话**禁止**出现：阶段产物正文、VerifierOutput JSON 内容、diff 内容、业务/测试代码正文、根因报告正文。

O **只读**：`project.json` / `rtm.json`（仅状态字段）/ `orchestrator-state.md` / `handoff/*/status.json` / `run-log.jsonl`（尾部）/ `check-*.ts` 退出码与 stdout 末尾 5 行（约束 #9 放行证据）。

O **只写**：`orchestrator-state.md` / `project.status` / `run-log.jsonl`（append）/ `handoff/<id>/brief.md`（指针型）/ `handoff/<id>/` 目录创建。

旁白 ≤ 1 句/工具调用（与 SDD 技能"旁白"约束一致）。

### 5. 分派时序示例（文件落地版）

```
O: Read orchestrator-state.md → 重建位置
O: Write handoff/phase1-S-01/brief.md（指针：输入产物路径 + 契约）
O: Write orchestrator-state.md（CURRENT=派 S-01，NEXT=派 V-01 读 S-01/output.md）
O: 分派 S-01（Task 工具，prompt 只含 brief 路径 + status.json 契约 + ≤5 行返回约束）
S-01: Read brief.md → 产出 → Write output.md + Write status.json → 返回 O ≤5 行
O: Read handoff/phase1-S-01/status.json（唯一可读）
O: Write handoff/phase1-V-01/brief.md（指针：读 handoff/phase1-S-01/output.md + R3 报告路径）
O: Write orchestrator-state.md（DONE+=S-01，CURRENT=派 V-01）
O: 分派 V-01
V-01: Read handoff/phase1-S-01/output.md → 产出 → Write output.md + status.json → 返回 ≤5 行
...（G 读 V/output.md，R 读 V+G/output.md，S-fix 读 R/output.md，全程不经 O 转发内容）
```

## 每阶段分派时序

```
O: 路由 + 读状态 + 检查前置产物 + 加载最小引用集（SKILL.md + 当前阶段 phase-N）
O: 🔴 CHECKPOINT · 项目初始化（首次）或阶段进入确认
  ↓ 分派 S
S: 产出开发文档 + 同步测试设计 + 更新 RTM 实体 → 返回 {产物路径, RTM diff}
  ↓ 分派 V
V: 按 targetKind 路由 Persona → 产出 VerifierOutput JSON
  ↓ 分派 G
G: npx tsx w-model-dev/scripts/cli/check-verifier-output.ts "<json>"
   → 返回 {exitCode, qualityLevel, passed, reworkHints}
O: 若 exitCode ≠ 0 或 qualityLevel ∈ {C,D}
   → 分派 R 定位（输入：reworkHints + 失败产物 + 上游产物）→ R 产出 RootCauseReport
   → 分派 V 复审根因报告（targetKind=rootcause）→ V 返回 {qualityLevel, passed, reworkHints}
   → 分派 G 门禁（check-rootcause-report.ts）→ G 返回 {exitCode, evidence}
   → 分派 S-fix 修复（输入：R 报告 + fixRecommendation）→ S-fix 返回 {artifacts, rtmDiff, fixBasedOn, selfCheck}
   → 重走 V → G（评审修复产物）
O: 若 S-fix 返工通过 → 分派 R-iceberg（ICEBERG-A，输入：reworkHints + fixedPoints + 全阶段产物）
   → R-iceberg 产出 IcebergSweepReport
   → 若 newFindings 非空 → 分派 V 复审冰山报告 → 每个有效发现走 R→V→G→S-fix → 回到 R-iceberg（ICEBERG-A）
   → 若 newFindings=[] → 继续
O: 若通过（首次或返工最终）
   → 分派 R-iceberg（ICEBERG-B，全局扫掠：reworkHints 历史 + fixedPoints + 全阶段产物 + RTM + graph.json）
   → 若 newFindings 非空 → 分派 V 复审 → 每个有效发现走 R→V→G→S-fix → 回到 R-iceberg（ICEBERG-A）
   → 若 newFindings=[] → 🔴 CHECKPOINT · 阶段门放行（编排者展示 G 子代理返回的证据给用户）
O: 用户放行 → 编排者更新 project.status → 进入下一阶段
```

阶段 8 终检额外分派 G 跑 `check-artifact-gate.ts`：

```
O: 阶段 8 验收测试产物已放行
  ↓ 分派 G
G: npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts [project-dir]
   → 返回 {exitCode, GATE_JSON 摘要（RTM 覆盖率 / 四级测试结果）}
O: 若 exitCode ≠ 0 → 分派 S 回阶段 5 返工
O: 若通过 → 🔴 CHECKPOINT · 发布放行（展示 GATE_JSON 给用户）
O: 用户确认 → 编排者更新 project.status = 验收通过 → 项目完成
```

## 子代理分派模板

> 编排者分派子代理时必须使用宿主 Agent 的子代理机制（如 Trae 的 Task 工具 / Claude Code 的 Task 工具 / Cursor 的子代理）。分派指令须包含完整上下文，子代理不得继承编排者会话历史。

### S 子代理分派模板

```
角色：产出子代理（S）
当前 W 模型阶段：<阶段 N - 名称>
任务：按 phase-<N>-*.md 产出本阶段开发产物 + 同步测试设计 + 更新 RTM 实体
上下文：
  - 项目状态：.w-model/project.json（已附）
  - 当前 RTM：.w-model/rtm.json（已附）
  - 上游产物路径：<列出已放行的上游产物路径>
  - 技术栈：<从 project.json.techStack 读取>
必读：
  - references/phase-<N>-*.md（按当前阶段加载）
  - references/rtm-guide.md
  - templates/<对应模板>.md
产出契约：
  1. 文件路径：<按 phase-N 定义>
  2. 同步测试设计：<按并行对应表>
  3. RTM 实体更新：<列出本次新增 / 修改的实体 ID>
  4. 返回编排者：{产物路径, RTM diff 摘要, 自检结果（按 phase-N 验收标准）}
禁止：
  - 跑 check-verifier-output.ts / check-artifact-gate.ts
  - 越阶段产出
  - 改 project.status
```

### V 子代理分派模板

```
角色：评审子代理（V）
评审目标：<targetKind> / <targetId>
任务：按 agent-personas.md 对应 Persona + verifier-spec.md §8 提示词产出 VerifierOutput JSON
上下文：
  - 待评审批产物路径：<列出 S 子代理产出的文件路径>
  - 上游产物路径（用于追溯）：<列出>
必读：
  - references/agent-personas.md（按 targetKind 选用 Persona）
  - references/verifier-spec.md §6（输出 Schema）+ §8（提示词模板）+ §7.4A（五轴 + Severity）
  - references/quality-standards.md（如评审代码 / 测试）
  - references/definition-of-done.md（如评审阶段门）
产出契约：
  1. VerifierOutput JSON 文件路径：<约定路径>
  2. 必须满足 verifier-spec.md §6 Schema（subCriteria / compositeScore / qualityLevel / passed / reworkHints）
  3. Severity 标签作为 reworkHints 前缀（[Critical] / [Required] / [Optional] / [Nit] / [FYI]）
  4. 返回编排者：{VerifierOutput JSON 路径, summary 摘要}
禁止：
  - 跑门禁脚本
  - 改产物文件
  - 改 RTM
  - 跨阶段评审
```

### G 子代理分派模板

```
角色：门禁子代理（G）
任务：跑确定性门禁脚本 + 回填证据摘要
上下文：
  - 待校验文件路径：<V 子代理产出的 VerifierOutput JSON / project-dir>
执行：
  - 阶段 1~7 门：
    1. npx tsx w-model-dev/scripts/cli/check-verifier-output.ts "<verifier-output.json>"
    2. npx tsx w-model-dev/scripts/cli/check-tla-model.ts "<tla-manifest.json>" --phase=<N> --graph=.w-model/ingestion/graph.json
    3. npx tsx w-model-dev/scripts/cli/check-bdd-model.ts "<bdd-manifest.json>" --phase=<N> --graph=.w-model/ingestion/graph.json
    4. npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts [project-dir] --phase=<N>
    5. 其余闭环脚本（按 phase-N 定义）
  - 阶段 8 终检：npx tsx w-model-dev/scripts/cli/check-artifact-gate.ts [project-dir]（内部已调用 check-tla-model + check-bdd-model 并传 --graph）
产出契约：
  1. 退出码（0 / 1 / 2）
  2. 证据摘要：
     - 阶段门：{exitCode, qualityLevel, passed, reworkHints, tlaModelExitCode, bddModelExitCode}
     - 终检：{exitCode, GATE_JSON 摘要（RTM 覆盖率 / 四级测试结果 / Model 校验结果）}
  3. 返回编排者：上述结构化摘要
禁止：
  - 改产物文件
  - 产出 VerifierOutput JSON
  - 改 RTM 实体
  - 跑测试运行器
```

### A-chunk 子代理分派模板

```
角色：分析子代理-分块变体（A-chunk）
当前 W 模型阶段：<阶段 N - 名称>
任务：读单个 chunk，提取本阶段节点类型实体，产出 <chunk-id>.{md,json}
上下文：
  - chunk 路径：<文件路径>
  - chunk-id：<chunk-001>
  - 阶段与节点类型：<phase=N, node-type=REQ|SD|INTF|DD>
  - 全局目录树摘要 + 相邻 chunk 标题列表（用于跨块边初判）
  - 上一轮 reworkHints（若为补漏轮次）
必读：
  - references/ingestion-chunk.md
  - references/graph-guide.md
产出契约：
  1. 文件路径：.w-model/ingestion/<chunk-id>.md + <chunk-id>.json
  2. JSON 须满足 ingestion-chunk.md schema（nodes/edges/crossChunkHints）
  3. 返回编排者：{role:"A", variant:"chunk", chunkId, entities, edges, blocked?}
禁止：
  - 跑 check-requirement-graph.ts
  - 写正式阶段产物
  - 越阶段产出
```

### A-cross/A-evolve 子代理分派模板

```
角色：分析子代理-合并/演进变体（A-cross 阶段1 / A-evolve 阶段2-4）
任务：合并所有 chunk.json 建图，确认跨块边，产出 consolidated.json + reworkHints
上下文：
  - .w-model/ingestion/*.json 全集
  - 现有 graph.json（仅 A-evolve）
  - 上一轮 reworkHints（若为补漏轮次）
必读：
  - references/ingestion-cross.md
  - references/graph-guide.md
产出契约：
  1. 文件路径：.w-model/ingestion/consolidated.json + cross-analysis-report.md
  2. reworkHints 指向具体 chunkId 与原因
  3. 返回编排者：{role:"A", variant:"cross|evolve", totalEntities, totalEdges, isolatedNodes, connectedComponents, roots, reworkHints}
禁止：
  - 跑 check-requirement-graph.ts（G 负责）
  - 写正式阶段产物
  - 删除前阶段图谱节点（A-evolve）
```

### S 拆分机制（阶段 1–4 任务过重时）

> 阶段 1–4 单个 S 子代理任务过重（文档 + 测试设计 + RTM + TLA+ + BDD features 五类产出）时，编排者可将 S 拆为最多三次分派，避免单次上下文超载或产出质量稀释。**拆分为可选项，非强制**；任务粒度可承载时不拆，按标准 S 模板一次产出。

- **S-doc**：产出开发文档 + 同步测试设计 + 更新 RTM 实体；**不产出** `.tla` / `.cfg` / `tla-manifest.json` / `.feature` / `bdd-manifest.json`。
- **S-tla**：产出对应层级 TLA+ 规格（`.tla` + `.cfg`）+ 更新 `tla-manifest.json` 基础字段 + **`.tla` 文件头部含 `@designIds` 字段（列出覆盖的 SD 节点 ID）**；**依赖 S-doc 已产出的设计文档**作为建模输入；**不产出** `tla-manifest.json` 的 `sdCoverage` 字段（由 S-ingest-tla 回填）。
- **S-bdd**：产出对应层级 BDD features（`.feature`）+ 更新 `bdd-manifest.json` 基础字段 + **`.feature` 文件头部含 `@designIds` 字段**；**依赖 S-doc 已产出的设计文档 + S-tla 已产出的 TLA+ 规格**作为等价性对齐输入；**不产出** `bdd-manifest.json` 的 `designCoverage` 字段（由 S-ingest-bdd 回填）。
- **S-ingest-tla**：从 .tla 文件提取 @designIds + 比对 graph.json SD 节点 → 回填 tla-manifest.json sdCoverage；**依赖 S-tla 已产出的 .tla 文件** + A-evolve 已产出的 graph.json。
- **S-ingest-bdd**：从 .feature 文件提取 @designIds + 比对 graph.json SD 节点 → 回填 bdd-manifest.json designCoverage；**依赖 S-bdd 已产出的 .feature 文件** + A-evolve 已产出的 graph.json。
- **分派时序**：S-doc → A-evolve(SD 节点入图谱) → S-tla(产出 .tla/.cfg/manifest 基础字段 + @designIds 头部) → S-ingest-tla(回填 manifest sdCoverage) → S-bdd(产出 .feature/manifest 基础字段 + @designIds 头部) → S-ingest-bdd(回填 manifest designCoverage) → R3 → V → G(check-tla-model + check-bdd-model --graph 校验)。
- **返工边界**：V/G 命中 TLA+ 问题 → 仅返工 S-tla；命中 BDD 问题 → 仅返工 S-bdd（若 TLA+ 规格变更影响 BDD 等价性则同步触发 S-bdd 重评）；命中文档 / 测试设计 / RTM 问题 → 仅返工 S-doc，若设计变更影响 TLA+ 模型或 BDD features 则同步触发 S-tla / S-bdd 重评。

#### S-doc 子代理分派模板

```
角色：产出子代理-文档变体（S-doc）
当前 W 模型阶段：<阶段 N - 名称>
任务：产出开发文档 + 同步测试设计 + 更新 RTM 实体（不产出 TLA+ / BDD 实体）
依据：references/phase-<N>-*.md + templates/<对应模板>.md + references/rtm-guide.md
产出：
  1. 开发文档（按 phase-N 定义）
  2. 同步测试设计（按并行对应表）
  3. RTM 实体更新（需求 / 设计 / 测试用例）
  4. 返回：{产物路径, RTM diff, selfCheck}
不产出：
  - .tla / .cfg / tla-manifest.json（由 S-tla 负责）
  - .feature / bdd-manifest.json（由 S-bdd 负责）
  - 跑门禁脚本 / 越阶段产出 / 改 project.status
```

#### S-tla 子代理分派模板

```
角色：产出子代理-TLA+ 变体（S-tla）
当前 W 模型阶段：<阶段 N - 名称>
任务：产出对应层级 TLA+ 规格 + 更新 tla-manifest.json；`.tla` 文件头部须含 `@designIds` 字段，列出覆盖的 SD 节点 ID
依据：references/tla-plus-guide.md + templates/tla-spec-template.md + S-doc 已产出的设计文档
产出：
  1. .tla（按 phase-N 层级：L1/L2/L3/L4）——头部须含 @designIds 字段，列出覆盖的 SD 节点 ID
  2. .cfg（TLC 模型检查配置）
  3. tla-manifest.json 实体更新（基础字段，不含 sdCoverage——由 S-ingest-tla 回填）
  4. 返回：{.tla 路径, .cfg 路径, manifest diff, selfCheck}
不产出：
  - 开发文档 / 测试设计 / RTM 实体（由 S-doc 负责）
  - .feature / bdd-manifest.json（由 S-bdd 负责）
  - tla-manifest.json 的 sdCoverage 字段（由 S-ingest-tla 回填）
  - 跑门禁脚本 / 越阶段产出 / 改 project.status
约束：
  - .tla 文件头部须含 @designIds 字段（逗号分隔的 SD 节点 ID），读取 .w-model/ingestion/graph.json 提取 SD 节点列表作为覆盖范围依据
```

#### S-bdd 子代理分派模板

```
角色：产出子代理-BDD 变体（S-bdd）
当前 W 模型阶段：<阶段 N - 名称>
任务：产出对应层级 BDD features + 更新 bdd-manifest.json
依据：references/bdd-guide.md + templates/feature.template + templates/bdd-manifest.template.json + S-doc 已产出的设计文档 + S-tla 已产出的 TLA+ 规格（用于 BDD↔TLA+ 等价性对齐）
产出：
  1. .feature（按 phase-N 层级：L1/L2/L3/L4，每个 REQ/SD/INTF/DD ≥1 个 .feature 文件）——头部须含 @designIds 字段，列出覆盖的 SD 节点 ID
  2. bdd-manifest.json 实体更新（features + stateMachines + tlaSpecId 关联，不含 designCoverage——由 S-ingest-bdd 回填）
  3. RTM 测试列追加 BDD 引用（`<Type>-NNN | BDD-L<level>-<system>-<num>.feature`）
  4. 返回：{.feature 路径, manifest diff, RTM diff, selfCheck}
不产出：
  - 开发文档 / 测试设计 / RTM 实体（由 S-doc 负责）
  - .tla / .cfg / tla-manifest.json（由 S-tla 负责）
  - bdd-manifest.json 的 designCoverage 字段（由 S-ingest-bdd 回填）
  - 跑门禁脚本 / 越阶段产出 / 改 project.status
约束：
  - BDD 状态机七要素须与同层 TLA+ spec 等价（states↔State / initialState↔Init / transitions↔Next / invariants↔Invariants）
  - 文件头 10 个 @ 字段全部必填（@req / @design / @designIds / @system / @tla-spec / @state-machine / @parent-features / @sibling-features / @child-features / @scenario-id-prefix）
  - Background 节七要素全部必填（acceptingStates 不可为空，其余可为 ()）
  - .feature 文件头部须含 @designIds 字段（逗号分隔的 SD 节点 ID），读取 .w-model/ingestion/graph.json 提取 SD 节点列表作为覆盖范围依据
```

#### S-ingest-tla 子代理分派模板

```
角色：产出子代理-TLA+ 图谱导入变体（S-ingest-tla）
当前 W 模型阶段：<阶段 N - 名称>
任务：从 .tla 文件提取 @designIds + 比对 graph.json SD 节点 → 回填 tla-manifest.json sdCoverage
依据：references/directory-conventions.md + references/format-conventions.md + references/tla-plus-guide.md §10
输入：
  - .tla 文件路径列表（S-tla 已产出）
  - tla-manifest.json 路径
  - .w-model/ingestion/graph.json 路径
产出：
  1. tla-manifest.json 的 sdCoverage 字段回填（totalSdNodes / coveredSdNodes / uncoveredSdNodes / coverageRate）
  2. 返回：{manifest 路径, sdCoverage 摘要, uncovered 列表}
不产出：
  - .tla / .cfg 文件（由 S-tla 负责，S-ingest 只读不写 .tla）
  - 开发文档 / 测试设计 / RTM 实体
  - 跑门禁脚本 / 越阶段产出 / 改 project.status
约束：
  - 只读 .tla 文件，不修改
  - @designIds 提取须与 .tla 文件头部一致
  - sdCoverage.uncoveredSdNodes 须与 graph.json SD 节点比对结果一致
```

#### S-ingest-bdd 子代理分派模板

```
角色：产出子代理-BDD 图谱导入变体（S-ingest-bdd）
当前 W 模型阶段：<阶段 N - 名称>
任务：从 .feature 文件提取 @designIds + 比对 graph.json SD 节点 → 回填 bdd-manifest.json designCoverage
依据：references/directory-conventions.md + references/format-conventions.md + references/bdd-guide.md D8
输入：
  - .feature 文件路径列表（S-bdd 已产出）
  - bdd-manifest.json 路径
  - .w-model/ingestion/graph.json 路径
产出：
  1. bdd-manifest.json 的 designCoverage 字段回填（totalSdNodes / coveredSdNodes / uncoveredSdNodes / coverageRate）
  2. 返回：{manifest 路径, designCoverage 摘要, uncovered 列表}
不产出：
  - .feature 文件（由 S-bdd 负责，S-ingest 只读不写 .feature）
  - 开发文档 / 测试设计 / RTM 实体
  - 跑门禁脚本 / 越阶段产出 / 改 project.status
约束：
  - 只读 .feature 文件，不修改
  - @designIds 提取须与 .feature 文件头部一致
  - designCoverage.uncoveredSdNodes 须与 graph.json SD 节点比对结果一致
```

### 阶段 5-8 S 三段式变体

> 阶段 5-8 opsx 工作流。阶段 5-8 引入 codegraph + OpenSpec opsx 后，S 角色拆分为三段式变体。每段产物须跑 R3×3 + V 审查。

#### S-explore 子代理分派模板

- **输入**：当前阶段 spec + 上游产物 + codegraph 图谱（已 init）
- **调用**：`/opsx:explore` + `codegraph_explore`（影响初判）
- **产出**：`exploration-analysis.md`（方案对比 / 推荐方案 / codegraph 影响初判）
- **审查**：R3×3（completeness/reliability/security）→ V 评审 → 不合格打回

#### S-propose 子代理分派模板

- **输入**：S-explore 产物（exploration-analysis.md）+ R3/V 审查通过
- **调用**：`/opsx:propose <change>` → 产 proposal.md / specs/ / design.md / tasks.md；随后 S-tickets 拆解 → tickets.md（tracer-bullet + blocking edges DAG）
- **产出**：`openspec/changes/<change>/{proposal,specs,design,tasks}.md` + `tickets.md`
- **审查**：R3×3 → V 评审 → 不合格打回
- **职责边界**：opsx:propose 产 tasks.md（what/why），S-tickets 产 tickets.md（how）。反模式 #40 禁止混淆。

#### S-coding 子代理分派模板

- **输入**：S-propose 产物（tickets.md）+ R3/V 审查通过
- **调用**：按 tickets.md frontier 逐片执行；每片 `codegraph_explore(目标符号)` → 落盘 `.w-model/codegraph-queries/` → `opsx:apply` 推进 → `Edit`/`Write` 代码 + 单元测试 →该片 code-TLA+ 一致性校验
- **产出**：代码 + 测试 + `.w-model/codegraph-queries/` + TLA 校验报告
- **审查**：R3×3 → V 评审 → 不合格打回（指定返工票据）
- **约束 #14**：任何 Edit/Write 前须 codegraph_explore，否则命中反模式 #38

### R 子代理分派模板

```
角色：根因定位子代理（R）
当前 W 模型阶段：<阶段 N - 名称>
返工轮次：<round，从 1 开始>
任务：诊断 V/G 命中的返工问题根因，产出 RootCauseReport

上下文：
  - 返工来源：<verifier | gate>
  - V/G 的 reworkHints（原文）：<数组>
  - V 的 VerifierOutput JSON 路径：<路径，可选>
  - G 的 GATE_JSON 路径：<路径，可选>
  - 失败产物路径：<被诊断为不合格的产物文件>
  - 上游产物路径（用于上游回溯）：<列出上游阶段产物路径>
  - 当前 RTM：<.w-model/rtm.json 路径>
  - 当前 graph.json（阶段 1-4）：<路径，可选>
  - 上一轮 R 报告（若 round>1）：<路径，用于避免重复根因>

必读：
  - references/root-cause-locator.md（根因分析方法论）
  - references/anti-patterns.md（避免误判流程问题为产物问题）

方法选择：
  - 单一明确缺陷 → 5-Why
  - 多因素复合缺陷 → 鱼骨图
  - 跨产物传播 → 缺陷链追溯
  - 当前阶段无明显缺陷 → 上游回溯
  - 复杂场景 → 组合

产出契约：
  1. RootCauseReport JSON：<路径> .w-model/rootcause/<reportId>.json
  2. 人类可读报告：<路径> .w-model/rootcause/<reportId>.md
  3. 必须满足 RootCauseReport Schema（见 spec §4）
  4. 返回编排者：{role:"R", reportId, reportPath, rootCauseCategory, upstreamDefect: {present, rollbackRecommended}, qualityLevel, passed, summary}

禁止：
  - 改任何产物文件（由 S 修复）
  - 跑门禁脚本（由 G 负责）
  - 改 RTM 实体 / project.status
  - 修改上游产物（仅标记 upstreamDefect）
  - 评审其他角色产出
  - 跨阶段定位（仅当前阶段产物 + 上游回溯标记）
```

### R3 预防性审查分派模板

> S 产出后、V 评审前触发。R3 复用 R 子代理机制，但目的为预防性审查而非根因定位。
>
> **无条件强制**：R3 覆盖**所有 S 变体**：S-doc / S-tla / S-bdd / S-ingest-tla / S-ingest-bdd / S-explore / S-propose / S-coding / **S-fix** / **S-emergency-fix**。任意 S 派遣后必须 R3×3 + V，无 flag，无「启用时」措辞。违反字面即违反精神。

**分派时序**：S 产出（任意变体）→ R3-completeness / R3-reliability / R3-security（可并行）→ V 评审

**S 变体与 R3 报告路径对应**：

| S 变体 | action | R3 报告路径前缀 |
|---|---|---|
| 标准 S / S-doc / S-tla / S-bdd | `produce` | `<phase>-{dim}.json` |
| S-ingest-tla / S-ingest-bdd | `produce` | `<phase>-ingest-{dim}.json` |
| S-fix（返工变体） | `fix` | `<phase>-fix-{dim}.json` |
| S-emergency-fix（紧急修复变体） | `emergency-fix` | `<phase>-emergency-{dim}.json` |

`check-preventive-review.ts` 支持 `--variant=standard|fix|emergency|ingest` 参数校验对应路径（ingest 须显式传参）；`--auto-trigger` 模式从 run-log 推断 S 变体。

**R3 子代理输入**：
- 当前阶段产物路径
- 上游产物（需求/设计文档、RTM、TLA+ 规格、BDD features）
- 审查维度（completeness / reliability / security）

**R3 子代理产出**：`.w-model/preventive-reviews/<phase>[-fix|-emergency]-{completeness,reliability,security}.json`

**阶段 5-8 opsx 三段式 stage 级 R3+V 产物**：

opsx 三段式（S-explore → S-propose → S-coding）每段须额外产出 stage 级审查产物：

- **R3（9 份）**：`.w-model/r3-reviews/phase<N>-{explore,propose,coding}-{completeness,reliability,security}.md`
- **V 评审（3 份）**：`.w-model/v-reviews/phase<N>-{explore,propose,coding}.md`

这些 stage 级产物与 `check-opsx-artifacts.ts` 校验口径一致；缺失任一文件命中反模式 #39（跳过 opsx 产物审查）。

**PreventiveReview schema**：见 `schemas/preventive-review.schema.json`

**R3 审查清单（按维度）**：

| 维度 | 检查项 |
|---|---|
| completeness | 字段齐全 / 模板套用 / RTM 登记 / demo 范围边界 / N-A 标记 / uat-path-mapping 回填 |
| reliability | TLA+/BDD 等价性 / 状态机一致性 / 接口契约 / 字段命名业务语义对齐 / 设计项装配点与测试 seam 一致性 |
| security | 输入校验 / 鉴权 / 越权 / 敏感信息 / 限流装配 / 密码哈希 |

**R3 与返工R的区别**：

| 属性 | 返工R | 预防R3 |
|---|---|---|
| 触发时机 | V/G 不通过后触发 | S 产出后主动触发 |
| 目的 | 定位根因 | 预防性审查 |
| 产出 | RootCauseReport | PreventiveReview 三份报告 |
| 方法论 | root-cause-locator.md（5-Why / 鱼骨图 / 上游回溯）定位根因 | 借鉴 root-cause-locator.md 分析工具，但目的不同：预防性审查用「完整性清单 + 可靠性核验 + 安全基线」三维度检查产物，不定位根因 |
| schema | rootcause-report.schema.json | preventive-review.schema.json |

**V 评审参考方式**：V 子代理在评审时须读取 R3 三份报告，将 R3 发现的问题纳入 `reworkHints`。V 不得跳过 R3 报告直接评审（命中反模式 #33）。

### R-iceberg 冰山扫掠分派模板

> S-fix 后（ICEBERG-A）或阶段门放行前（ICEBERG-B）触发。R-iceberg 是 R 子代理的冰山扫掠变体，以已发现/已修复问题为线索主动深挖隐藏问题，与 R（被动定位已暴露问题根因）正交。
> 方法论见 [iceberg-sweep-guide.md](iceberg-sweep-guide.md)；schema 见 `iceberg-sweep.schema.json`；校验脚本 `check-iceberg-sweep.ts`（反模式 #44）。

**分派时序**：
- ICEBERG-A：`S-fix 修复 → R3×3(fix) → V → G → [G 通过] → R-iceberg 扫掠`
- ICEBERG-B：`标准 V/G 通过（首次或返工最终）→ R-iceberg 全局扫掠 → newFindings=[] → CHECKPOINT 放行`

**产出路径**：`.w-model/iceberg/<reportId>.json`（JSON 报告）+ `.w-model/iceberg/<reportId>.md`（人类可读报告）

```
角色：根因定位子代理-冰山扫掠变体（R-iceberg）
当前 W 模型阶段：<阶段 N - 名称>
冰山轮次：<icebergRound，1-5>
触发类型：<ICEBERG-A | ICEBERG-B>

任务：以已发现/已修复问题为线索，对全阶段产物做多视角深挖扫掠，产出 IcebergSweepReport

上下文：
  - 线索来源：
    - reworkHints 历史：<本阶段所有 V/G reworkHints 数组>
    - fixedPoints：<已修复的缺陷位置列表>
    - 关联 RootCauseReport 路径：<列表，用于提取根因类别>
    - 上一轮 IcebergSweepReport 路径：<若 icebergRound>1，用于去重>
  - 全阶段产物路径：<列出本阶段所有产物文件路径>
  - 上游产物路径（用于跨产物一致性检查）：<列出>
  - 当前 RTM：<.w-model/rtm.json 路径>
  - 当前 graph.json（阶段 1-4）：<路径>

必读：
  - references/iceberg-sweep-guide.md（冰山扫掠方法论）
  - references/format-conventions.md（location 格式）
  - references/anti-patterns.md（避免误判流程问题为产物问题）

扫掠方法：
  - 三维度：completeness / reliability / security
  - 六类别：same-root-cause-spread / same-defect-class / fix-induced-regression / adjacent-logic / coverage-gap / cross-artifact-inconsistency
  - 流程：加载线索 → 提取根因类别 → 三维度×六类别扫掠全产物 → 去重 → 产出报告

产出契约：
  1. IcebergSweepReport JSON：.w-model/iceberg/<reportId>.json
  2. 人类可读报告：.w-model/iceberg/<reportId>.md
  3. 必须满足 IcebergSweepReport Schema
  4. newFindings 每项须含可证伪 hypothesis + 具体 evidence
  5. 返回编排者：{role:"R", variant:"iceberg", reportId, reportPath, newFindingsCount, passed, summary}

禁止：
  - 改任何产物文件（由 S-fix 修复）
  - 跑门禁脚本（由 G 负责）
  - 改 RTM 实体 / project.status
  - 跨阶段定位
  - 跳过 V 复审直接触发 S-fix
  - 产出空泛发现（须可证伪 + 具体证据）
```

**ICEBERG 轮次计数**：ICEBERG-A 和 ICEBERG-B 共享 icebergRound 计数器（每阶段独立，阶段进入时重置为 0）。每次 R-iceberg 扫掠递增 1，修复不单独占轮次。达 maxIcebergRounds=5 时 CHECKPOINT 升级由用户裁定（选项：继续深挖 / 接受剩余项并放行 / 阶段回退）。

**R-iceberg 与返工R的区别**：

| 属性 | 返工R | R-iceberg |
|---|---|---|
| 触发时机 | V/G 不通过后触发 | S-fix 后（ICEBERG-A）+ 阶段门前（ICEBERG-B） |
| 目的 | 定位已暴露问题的根因 | 主动深挖未暴露的隐藏问题 |
| 产出 | RootCauseReport（单问题根因链） | IcebergSweepReport（多发现扫掠报告） |
| 线索 | V/G reworkHints 单条 | reworkHints 历史 + fixedPoints + previousFindings |
| schema | rootcause-report.schema.json | iceberg-sweep.schema.json |

### V 复审根因报告分派模板（targetKind=rootcause）

```
角色：评审子代理（V）- rootcause 变体
评审目标：targetKind=rootcause / <reportId>
任务：复审 R 的根因报告准确性

上下文：
  - 待复审 R 报告 JSON 路径：<路径>
  - 待复审 R 报告 .md 路径：<路径>
  - 失败产物路径（用于核验根因证据）：<路径>
  - 上游产物路径（用于核验 upstreamDefect）：<列出>
  - 原始 V/G reworkHints：<数组>

必读：
  - references/root-cause-locator.md（方法与质量标准）
  - references/verifier-spec.md §6（输出 Schema，rootcause 复审仍用 VerifierOutput）

复审维度（rootcause 专用子标准）：
  - correctness：根因链是否逻辑自洽？证据是否支持？
  - completeness：是否触及根本原因而非停在现象？
  - falsifiability：可证伪假设是否可验证？
  - actionability：fixRecommendation 是否针对根因且可执行？
  - prevention：预防措施是否可落实？

产出契约：
  1. VerifierOutput JSON：<路径> .w-model/verifier/<reportId>-review.json
  2. targetKind=rootcause，persona=code-reviewer（或新增 rootcause-reviewer persona，待定）
  3. reworkHints 含 [Critical]/[Required] 时表示根因报告不准确，须重派 R
  4. 返回编排者：{role:"V", targetKind:"rootcause", qualityLevel, passed, reworkHints}

禁止：
  - 改 R 报告文件
  - 改产物文件
  - 跑门禁脚本
```

### S 兼 F 修复分派模板（返工变体）

> S-fix 与标准 S 一视同仁，产出后须 **R3×3 → V → G**（无条件强制，不得跳过 R3+V）。命中反模式 #42（S-fix / emergency-fix 后跳过 R3+V）一律回到 S-fix 产出后起点补跑 R3×3 + V。R3 报告路径走 `<phase>-fix-{completeness,reliability,security}.json`。

```
角色：产出子代理-修复变体（S-fix）
当前 W 模型阶段：<阶段 N - 名称>
返工轮次：<round>
任务：按 R 报告的 fixRecommendation 修复产物 + 更新 RTM

上下文：
  - R 报告 JSON 路径（已 V 复审通过）：<路径>
  - R 报告 .md 路径：<路径>
  - 待修复产物路径：<路径>
  - 当前 RTM：<路径>
  - 上游产物路径：<列出>

必读：
  - references/phase-<N>-*.md（当前阶段验收标准）
  - references/rtm-guide.md
  - R 报告的 fixRecommendation（必读，修复依据）

产出契约：
  1. 修复后的产物文件（覆盖原文件）
  2. RTM 实体更新（若修复涉及 RTM）
  3. 返回编排者：{role:"S", variant:"fix", artifacts:<修复文件路径>, rtmDiff, fixBasedOn:"<reportId>", selfCheck}
  4. selfCheck 须含 fixRecommendation 落实情况逐条核验

禁止：
  - 无视 R 报告自行修复（命中反模式 #18）
  - 跑门禁脚本
  - 越阶段产出
  - 改 project.status
  - 修复时引入新缺陷（须自检）
```

### R-lead 子代理分派模板（多角度变体，并行/串行均可）

```
角色：根因定位子代理-主聚合变体（R-lead）
当前 W 模型阶段：<阶段 N - 名称>
返工轮次：<round>
任务：分派 N 个 R-persona 子代理（并行或串行均可，依宿主能力）→ 聚合产出最终 RootCauseReport

上下文：
  - 返工来源 + reworkHints（同 R 模板）
  - 失败产物路径 + 上游产物路径
  - rootCause.category 候选（由 O 根据 reworkHints 初判）
  - persona 选择矩阵（root-cause-locator.md §4.3）
  - 宿主分派方式：<parallel | serial | single-session-degraded>（由 O 根据宿主能力声明）

必读：
  - references/root-cause-locator.md
  - w-model-dev/subagent/<选中的 persona 文件>（R-lead 至少加载 incident-response-commander）

执行：
  1. 按 rootCause.category 选择 N 个 persona
  2. 按宿主能力选择分派方式：
     - parallel：并行分派 N 个 R-persona 子代理，收齐 N 份 PartialReport
     - serial：依次串行分派 N 个 R-persona 子代理，每个产出后归档并收集，N 份齐后进入聚合
     - single-session-degraded：R-lead 自身在 N 轮对话中分别加载 N 个 persona 文件，每轮产出一份 PartialReport
  3. 收集 N 份 PartialRootCauseReport（三种方式均须收齐 N 份）
  4. 按聚合规则（root-cause-locator.md §4.4）产出最终 RootCauseReport

产出契约：
  1. 最终 RootCauseReport JSON + .md（同 spec §4 Schema）
  2. 附录：N 份 PartialRootCauseReport 路径
  3. 返回编排者：{role:"R", variant:"lead", reportId, partialReports:[<id>], aggregationMethod, dispatchMode:<"parallel"|"serial"|"degraded">, rootCauseCategory, upstreamDefect, qualityLevel, passed, summary, disagreementResolved:<bool>}

禁止：
  - 跳过 persona 直接产出报告（强制多角度场景，不论并行/串行）
  - 串行分派时让后一个 persona 读取前一个 persona 的产出（须独立产出）
  - 无视 reality-checker 的 low confidence（须 passed=false）
  - 改产物 / 跑门禁 / 改 RTM
```

## 回填契约

子代理返回编排者的数据格式（结构化，便于编排者路由判定与 CHECKPOINT 展示）：

> **前置约束（[文件落地交接协议](#文件落地交接协议)）**：启用文件落地模式时，下列结构化数据须写入 `handoff/<dispatch-id>/status.json` + `output.md`，子代理返回 O 的文本进一步降至 ≤ 5 行信标（`state` + `dispatchId` + `status.json` 路径 + 一句话）。O 只 `Read` `status.json`，不读 `output.md`。下文 JSON 结构即 `status.json` / `output.md` 的内容契约。

### S 子代理返回

```json
{
  "role": "S",
  "phase": "<阶段 N - 名称>",
  "artifacts": ["<产物文件路径 1>", "<产物文件路径 2>"],
  "rtmDiff": {
    "added": ["REQ-001", "UAT-001"],
    "modified": ["REQ-002"],
    "removed": []
  },
  "selfCheck": {
    "acceptanceCriteriaMet": true,
    "notes": "<按 phase-N 验收标准自检的结果>"
  }
}
```

**RTM 实体回填强制职责**：
- RTM 实体回填是 S 子代理的强制职责，不得委托给其他角色；S 子代理产出后须立即更新 `.w-model/rtm.json`。
- S 子代理返回时须列出 `rtm.json` 文件路径与 coverage 百分比（如 `coveragePercent=100%`）。
- `coverageStatus` 字段值须与实际 coveragePercent 一致："100%" 对应 100%，"部分" 对应 < 100%，"待覆盖" 不允许（须回退重做）。
- 阶段门 CHECKPOINT 须展示 RTM 文件路径（`.w-model/rtm.json`）与 coverage 字段值，未展示视为约束 #3 违反。

### V 子代理返回

```json
{
  "role": "V",
  "targetKind": "<file | testcase | design>",
  "targetId": "<目标 ID>",
  "persona": "<code-reviewer | test-engineer | security-auditor | performance-auditor>",
  "verifierOutputPath": "<VerifierOutput JSON 文件路径>",
  "summary": "<评审摘要>",
  "qualityLevel": "<A | B | C | D>",
  "passed": <true | false>
}
```

### G 子代理返回

```json
{
  "role": "G",
  "script": "check-verifier-output.ts | check-artifact-gate.ts",
  "exitCode": 0,
  "evidence": {
    "qualityLevel": "<A | B | C | D，仅 check-verifier-output.ts>",
    "passed": <true | false，仅 check-verifier-output.ts>,
    "reworkHints": ["<仅 check-verifier-output.ts，按 Severity 前缀>"],
    "gateJson": {
      "coverage": "<仅 check-artifact-gate.ts，RTM 覆盖率>",
      "unitTestPassed": "<仅 check-artifact-gate.ts>",
      "integrationTestPassed": "<仅 check-artifact-gate.ts>",
      "systemTestPassed": "<仅 check-artifact-gate.ts>",
      "acceptanceTestPassed": "<仅 check-artifact-gate.ts>"
    }
  }
}
```

编排者收到 G 子代理返回后：
- `exitCode=0` 且 `qualityLevel ∈ {A,B}` 且 `passed=true` → 进入 🔴 CHECKPOINT · 阶段门放行；
- `exitCode=1` → 分派 S 子代理返工（带 `reworkHints`），重走 V → G；
- `exitCode=2` → 输入错误，重新分派 V 子代理产出 JSON（阶段门）或修复 `rtm.json`（终检）。

### A 子代理返回

```json
{
  "role": "A",
  "variant": "chunk | cross | evolve",
  "chunkId": "<仅 chunk 变体>",
  "entities": "<仅 chunk 变体，int>",
  "edges": "<仅 chunk 变体，int>",
  "totalEntities": "<仅 cross/evolve，int>",
  "totalEdges": "<仅 cross/evolve，int>",
  "isolatedNodes": ["<仅 cross/evolve>"],
  "connectedComponents": "<仅 cross/evolve，int>",
  "roots": ["<仅 cross/evolve>"],
  "reworkHints": [{"chunkId":"<id>","reason":"<...>"}],
  "blocked": "<仅 chunk 变体，可选>"
}
```

编排者收到 A 返回后：
- A-chunk `blocked` 非空 → 🔴 CHECKPOINT 介入；
- A-cross/A-evolve 返回后 → 分派 G 跑 `check-requirement-graph.ts`，按退出码决定收敛或补漏。

### R 子代理返回

```json
{
  "role": "R",
  "reportId": "RC-<phase>-<round>-<seq>",
  "reportPath": {
    "json": "<.w-model/rootcause/<reportId>.json>",
    "md": "<.w-model/rootcause/<reportId>.md>"
  },
  "rootCauseCategory": "<requirement-gap | design-flaw | ... | upstream-defect>",
  "upstreamDefect": {
    "present": <true | false>,
    "upstreamPhase": "<仅 present=true>",
    "rollbackRecommended": <true | false>
  },
  "qualityLevel": "<A | B | C | D>",
  "passed": <true | false>,
  "summary": "<根因分析一句话结论>"
}
```

编排者收到 R 返回后：
- `passed=true` 且 `qualityLevel∈{A,B}` → 分派 V 复审根因报告（targetKind=rootcause）；
- `passed=false` 或 `qualityLevel∈{C,D}` → 重派 R（R 自评不通过，须重新分析）。

### S-fix 子代理返回（返工变体）

```json
{
  "role": "S",
  "variant": "fix",
  "artifacts": ["<修复后的产物文件路径>"],
  "rtmDiff": {
    "added": [],
    "modified": ["<RTM 实体 ID>"],
    "removed": []
  },
  "fixBasedOn": "<reportId>",
  "selfCheck": {
    "fixRecommendationImplemented": true,
    "notes": "<fixRecommendation 逐条落实情况>"
  }
}
```

编排者收到 S-fix 返回后：
- 分派 V 评审修复产物 → G 门禁 → 通过则阶段门放行 / 不通过则 `round++` 重新分派 R 定位。

## 强制约束

编排者不得直接执行以下任何动作（命中即触发反模式 #10，回到当前阶段起点重做）：

1. **写产物**：用 `Write` / `Edit` 写或修改任何阶段产物文件（需求规格 / 设计文档 / 代码 / 测试用例 / 测试报告 / 评审报告 / `.tla` / `.cfg` / `tla-manifest.json`）。
2. **产出评审**：直接产出 `VerifierOutput` JSON 内容（评审必须分派 V 子代理）。
3. **改 RTM 实体**：修改 `.w-model/rtm.json` 实体字段（需求 / 设计 / 测试用例 / 执行结果；编排者只可更新 `project.status` 与 `updatedAt`）。
4. **生成代码**：生成测试用例代码或业务代码。
5. **跳过顺序**：跳过 S → V → G 顺序（如编排者自评自审、或跳过 V 直接由编排者判断质量）。
6. **自行合并图谱/写 ingestion 文件**：用 `Write` / `Edit` 写 `.w-model/ingestion/*` 文件（必须分派 A 子代理）。命中即触发反模式 #10 变体。

- **跳过 R 命中反模式 #18**：V/G 不通过后，编排者必须先分派 R 子代理产出 RootCauseReport 并经 V 复审 + G 门禁通过，才可分派 S-fix 修复。直接分派 S 返工（无 R 报告作为输入）命中 #18。

编排者**允许**的动作：
- 读 `.w-model/project.json` / `.w-model/rtm.json`；
- 跑 `check-verifier-output.ts` / `check-artifact-gate.ts` 看**退出码**（用于向用户展示或路由判定，不替代 G 子代理的回填职责）；
- `git status` / `ls` / `Read` 等只读核验；
- 在 CHECKPOINT 暂停等待用户决定；
- 用户放行后更新 `project.status` 与 `updatedAt`；
- 分派 S / V / G 子代理。

> **检测信号**（命中任一即触发反模式 #10）：
>
> - 信号1：编排者会话出现 `Write` / `Edit` 调用写阶段产物文件
> - 信号2：编排者直接产出 `VerifierOutput` JSON 内容
> - 信号3：编排者 `git diff` 含非 `.w-model/*.json` 状态文件改动
> - 信号4：编排者会话出现代码 / 测试用例 / 评审 JSON 的生成内容
> - 信号5：编排者会话出现 `Write` / `Edit` 写 `.tla` / `.cfg` / `tla-manifest.json` 实体

> **回退动作**：① 立即停止编排者当前动作；② 已越权产出的实体作废重做；③ 重新分派 S 子代理产出；④ 重走 V → G；⑤ 编排者会话内仅保留路由 / 状态 / CHECKPOINT / 只读脚本记录。

## 反模式 #20：只规划不执行

> 子代理返回规划性内容而未调用任何执行工具，浪费 token + 轮次，任务无实际进展。本反模式由编排者在子代理返回后立即检测，命中即重派并强调「立即执行」约束。

**症状**：子代理响应中无任何 `tool_use` 块（只有纯文本），或响应包含「正在准备」「将创建」「步骤 1：读取...」「我将...」等规划性关键词，而产物文件未被实际创建（`ls` 检查无对应文件）。

**危害**：

- 浪费 token + 轮次，任务无实际进展
- 编排者误判为「子代理已开始执行」继续等待，CHECKPOINT 失守
- 多次重派仍只规划 → 阶段无法推进，预算耗尽

**检测信号**（命中任一即判反模式 #20）：

- 信号1：子代理响应中无任何 `tool_use` 块（只有纯文本）
- 信号2：响应包含「正在准备」「将创建」「步骤」「我将」等规划性关键词且无对应工具调用
- 信号3：产物文件未被实际创建（`ls` / `Read` 检查无对应文件或文件内容为空）

**正确做法**：

- 子代理必须在响应中调用至少一个执行工具（`Write` / `Edit` / `RunCommand` / `Read`）
- 禁止只返回纯文本规划，必须立即执行
- 多步骤任务每步都应有对应的工具调用，而非纯文本描述步骤
- 子代理返回时应附产物路径或工具调用结果摘要，便于编排者核验

**编排者防范**：

- 子代理 prompt 模板必须包含约束语句（强制）：
  > 「你必须立即调用工具执行任务，禁止只返回规划性文字。响应中必须包含至少一次 `Write` / `Edit` / `RunCommand` 调用。」
- 编排者收到子代理返回后，先扫描返回中是否存在 `tool_use` 块或产物路径；不存在即判 #20 命中
- 命中后处理：回子代理起点重派，prompt 开头追加「⚠ 上次响应只规划未执行（命中反模式 #20），本次必须立即调用工具」
- 同一子代理连续命中 #20 ≥ 2 次 → 🔴 CHECKPOINT 介入（人工接管或调整任务粒度）

> 与反模式 #9（谎报状态）的关系：#20 是「未执行却声称在执行」的前兆；若子代理不仅规划还声称「已完成」但产物不存在 → 同时命中 #9 + #20，按 #9 处置（回退 + 标注教训）。

## S 子代理修改既有产物的边界

> S 子代理（产出子代理）与 R 子代理（根因定位）+ S-fix 子代理（修复变体）的职责边界。S 负责新增，R 负责定位，S-fix 负责修复——边界混淆会导致修复无根因依据、新产物污染既有产物、紧急修复无复核。

**职责划分**：

| 子代理 | 产物动作 | 典型场景 |
|---|---|---|
| **S 子代理**（标准变体） | **新增**产物（新文件、新测试用例、新文档章节、新 RTM 实体） | 阶段首次产出：按 phase-N 定义产出本阶段开发产物 + 同步测试设计 |
| **S-fix 子代理**（返工变体） | **修复**既有产物的 bug（覆盖原文件） | V/G 不通过 → R 定位 → V 复审 → G 门禁 → S-fix 携 R 报告执行修复 |
| **R 子代理** | **不修改任何产物**，仅产出 `RootCauseReport` | 定位根因，输出 fixRecommendation 给 S-fix |

> S 子代理**不得**在标准产出阶段直接修复既有产物 bug；发现既有产物 bug 时按下方流程处理。

**S 子代理发现既有产物 bug 时的处理流程**：

1. **记录 rootcause**：S 子代理必须在 `.w-model/rootcause/rootcause-report.jsonl` 追加条目（`action=rootcause`），描述 bug 现象、影响范围、定位过程、初步根因猜测
   - 字段：`{action:"rootcause", phase, foundBy:"S", bugLocation, symptom, impact, guess}`
2. **转交 R 子代理**：非紧急修复一律转 R 子代理正式定位，S 子代理不得越权修改既有产物。R 子代理产出 `RootCauseReport` → V 复审 → G 门禁 → S-fix 修复（标准返工流程）
3. **紧急修复通道**（仅当 bug 阻塞当前阶段推进时启用，前置 R3+V+G）：
   - S 子代理可执行**最小修复**（仅修复阻塞点，不扩展功能、不重构）
   - 必须在 `.w-model/run-log.jsonl` 追加 `fix` 条目，标注 `"紧急修复": true` 和阻塞原因
   - 紧急修复条目格式：`{role:"S", action:"emergency-fix", variant:"emergency-fix", blocker:<阻塞描述>, fixedLocation, fixBasedOn:"S-self-assessment"}`
   - emergency-fix 与其他 S 变体一视同仁，产出后须前置 **R3×3（completeness/reliability/security）→ V → G**，不得跳过。R3 报告路径走 `<phase>-emergency-{completeness,reliability,security}.json`（与 `check-preventive-review.ts --variant=emergency` 一致）。跳过 R3+V 命中反模式 #42。`variant=emergency-fix` + `blocker` 字段保留用于 run-log 审计，仅作为「为何走紧急通道」的说明，不再意味跳过审查。
   - **移除机制**：原「阶段完成后由 R 子代理复核紧急修复的完整性（R 复核产出追加到 `RootCauseReport` 的 `emergencyFixReview` 字段）」事后复核机制已移除。紧急修复的完整性由前置 R3×3 + V 兜底。

**违规检测**：

- `run-log.jsonl` 中 S 子代理（`role=S`）的 `action=fix` 条目需特别审查：
  - `variant="emergency-fix"` + `blocker` 非空 → 合法紧急修复通道
  - 无 `variant` 或 `variant` 非 `emergency-fix` / `fix`（S-fix 变体） → 视为越权修复，命中反模式 #10 变体
- 非紧急修复的 `fix` 条目视为越权，需回滚并由 R + S-fix 重做
- 检测脚本：`check-run-log.ts` 校验 `role=S` 的 `action=fix` 条目必须含 `variant` 字段，且 `variant=emergency-fix` 时必须含 `blocker` 字段

> 与反模式 #18（跳过 R 直接 S 返工）的关系：本边界条款是 #18 的细化——S 子代理发现既有 bug 时不得自行修复（即便 S 自评根因准确），必须走「记录 rootcause → 转 R → V 复审 → G 门禁 → S-fix」流程。紧急修复通道是「与其他 S 变体一视同仁的前置 R3+V+G 通道」——emergency-fix 产出后仍须 R3×3 + V + G，命中反模式 #42 一律回退。

## 豁免审批角色边界

> 覆盖缺失、conflicts-with 冲突、覆盖率不达标等事项须经强制 S→R→V→人类四阶段审批流程。本节扩展 S/R/V 角色边界，明确各角色在豁免审批中的职责与禁止动作。违反即命中反模式 #30（豁免审批跳步），见 [anti-patterns.md](anti-patterns.md)。

### 角色职责划分

| 角色 | 豁免审批职责 | 产出物 | 禁止动作 |
|---|---|---|---|
| **S** | 识别需豁免项（覆盖缺失 / conflicts-with / 覆盖率不达标），产出豁免请求 | `exemption-request.json`（含豁免理由、影响范围、替代方案） | **禁止 S 自行决定豁免生效**（FM-EXEMPT-01） |
| **R** | 按 [root-cause-locator.md](root-cause-locator.md) 方法论审查豁免请求（5-Why / 上游回溯 / 可证伪性） | `exemption-review.json`（含 reviewDecision / rootCauseAnalysis / falsifiabilityCheck / conditions） | **不得直接批准豁免生效**（FM-EXEMPT-02）；R 仅产出审查意见，批准权在人类 |
| **V** | 校验 R 的审查质量：`reviewDecision` / `rootCauseAnalysis` / `falsifiabilityCheck` / `conditions` 是否齐全且可证伪 | `exemption-verification.json`（含 passed / reworkHints） | 禁止跳过校验直接放行（FM-EXEMPT-03） |
| **人类** | CHECKPOINT 确认豁免是否生效 | `granted.json`（approve 写入）/ reject 回到原规则 | —（编排者不得代签，FM-EXEMPT-04） |
| **O（编排者）** | 路由豁免审批流程各阶段，分派 S/R/V，在 CHECKPOINT 暂停等人类确认 | run-log 记录豁免审批各阶段 | 禁止代签人类确认（命中反模式 #10 + #30） |

### 流程时序

```
O: 分派 S 产出需求规格 → V 评审发现覆盖缺失/conflicts-with/覆盖率<100%
  ↓
O: 分派 S 识别需豁免项
S: 产出 exemption-request.json → 返回 {豁免请求路径}
  ↓ （禁止 S 自行声明豁免生效）
O: 分派 R 审查豁免请求
R: 按 root-cause-locator.md 方法论审查 → 产出 exemption-review.json → 返回 {审查路径, reviewDecision}
  ↓ （R 不得直接批准豁免生效）
O: 分派 V 校验审查质量
V: 校验 reviewDecision/rootCauseAnalysis/falsifiabilityCheck/conditions → 产出 exemption-verification.json → 返回 {校验路径, passed}
  ↓
O: 🔴 CHECKPOINT · 豁免审批确认（展示豁免请求 + R 审查 + V 校验给用户）
  ↓
人类: approve → O 写入 granted.json / reject → 回到原规则（补需求或补覆盖）
  ↓
O: 分派 G 跑 check-exemption E1-E9 全通过 → 豁免生效
```

### 分派模板

#### S 豁免请求分派模板

```
角色：产出子代理（S）- 豁免请求变体
任务：识别需豁免项，产出 exemption-request.json
上下文：
  - 豁免来源：<V 评审 reworkHints 中的覆盖缺失/conflicts-with/覆盖率不达标项>
  - 需求规格路径：<路径>
产出契约：
  1. exemption-request.json：含 exemptionId / 豁免理由 / 影响范围 / 替代方案 / 关联 FM ID
  2. 返回编排者：{role:"S", variant:"exemption-request", requestPath, exemptionId}
禁止：
  - 自行决定豁免生效（FM-EXEMPT-01）
  - 用豁免掩盖需求遗漏（FM-EXEMPT-05）
```

#### R 豁免审查分派模板

```
角色：根因定位子代理（R）- 豁免审查变体
任务：按 root-cause-locator.md 方法论审查豁免请求
上下文：
  - exemption-request.json 路径：<路径>
  - 需求规格路径：<路径>
必读：
  - references/root-cause-locator.md
产出契约：
  1. exemption-review.json：含 reviewDecision / rootCauseAnalysis（5-Why）/ upstreamTrace（上游回溯）/ falsifiabilityCheck（可证伪性）/ conditions
  2. 返回编排者：{role:"R", variant:"exemption-review", reviewPath, reviewDecision}
禁止：
  - 直接批准豁免生效（FM-EXEMPT-02）
  - 模板化审查（缺 5-Why/上游回溯/可证伪性）
```

#### V 豁免校验分派模板

```
角色：评审子代理（V）- 豁免校验变体
任务：校验 R 的豁免审查质量
上下文：
  - exemption-request.json 路径：<路径>
  - exemption-review.json 路径：<路径>
产出契约：
  1. exemption-verification.json：含 passed / reworkHints（校验 reviewDecision/rootCauseAnalysis/falsifiabilityCheck/conditions）
  2. 返回编排者：{role:"V", variant:"exemption-verification", verificationPath, passed}
禁止：
  - 跳过校验直接放行（FM-EXEMPT-03）
```

> 豁免审批流程的收敛判定由 G 跑 `check-exemption` E1-E9 退出码决定（仿 ingestion 收敛由 G 跑 `check-requirement-graph.ts` 决定）。S/R/V 的产出仅作流程输入，不替代脚本判定。

## 与现有约束的兼容性

- **约束 4「真实执行」**：G 子代理跑脚本 + 回填退出码 = 真实执行，不冲突。
- **约束 6「按需加载」**：子代理按需加载对应 `phase-N-*.md`，编排者只加载 `SKILL.md` + 状态文件，加载面更窄。
- **约束 2「阶段门放行」**：G 子代理返回证据 → 编排者展示给用户 → CHECKPOINT 等待，不冲突。
- **[`verifier-spec.md`](verifier-spec.md) §7.6「外部 Agent 执行」**：V 子代理即「外部 Agent」，边界一致。
- **[`agent-personas.md`](agent-personas.md) 4 个 Persona**：V 子代理按 `targetKind` 选用，无改动。
- **技能不内置 LLM**：V 子代理由编排者通过宿主 Agent 的子代理机制（如 Task 工具）启动，技能包自身仍只含提示词 + 脚本，不引入 LLM 调用。

## 失败模式与回退

| 失败场景 | 处理 |
|---|---|
| S 子代理产出未通过自检（`acceptanceCriteriaMet=false`） | 编排者不分派 V，直接分派 S 返工 |
| V 子代理产出 JSON 不满足 Schema | G 子代理 `check-verifier-output.ts` 退出码 2 → 编排者分派 V 重新产出 |
| G 子代理 `check-verifier-output.ts` 退出码 1（评审未通过） | 编排者分派 S 返工（带 `reworkHints`），重走 V → G |
| G 子代理 `check-artifact-gate.ts` 退出码 1（质量门未通过） | 编排者分派 S 回阶段 5 返工 |
| 编排者自身越权实施（命中反模式 #10） | 回到当前阶段起点，已越权产出的实体作废重做 |
| 子代理无法独立完成（如 BLOCKED 状态） | 子代理返回 `{"status": "BLOCKED", "reason": "..."}`；编排者向用户澄清后重新分派 |
| R 自评不通过（`passed=false` 或 `qualityLevel∈{C,D}`） | 编排者重派 R（同一 round，不递增）；同一 round 内 R 重派 ≥2 次仍不通过 → 🔴 CHECKPOINT 介入（人工根因分析或调整 maxReworkRounds） |
| V 复审根因不通过（targetKind=rootcause `passed=false`） | 编排者重派 R（带 V 的 rootcause reworkHints，同一 round）；同一 round 内 V 复审不通过 ≥2 次 → 🔴 CHECKPOINT 介入（用户裁定根因） |
| G 门禁不通过（`check-rootcause-report.ts` exitCode=1） | 编排者重派 R（带 G 的校验失败原因，同一 round）；通常为 Schema 不合规，R 修正报告即可 |
| S-fix 修复后 V/G 仍不通过 | `round++` → 重新分派 R（不沿用上轮 R 报告，因产物已变化）；round 达 maxReworkRounds → 🔴 CHECKPOINT 升级（见场景 5 阶段回退） |
| 阶段回退（场景 5：round≥2 + R 标记 upstreamDefect.present=true 且 rollbackRecommended=true + V 复审通过） | 强制 🔴 CHECKPOINT · 阶段回退决策，展示返工历史 + R 的 upstreamDefect 详情 + V 复审结论 + 建议回退阶段编号，由用户选择 A/B/C |

## 与 addyosmani/agent-skills 的差异

| 维度 | addyosmani 原版 | W 模型适配版 |
|---|---|---|
| 子代理分派方式 | 由 Agent 自身决定 | 强制 O / S / V / G / A / R 六角色协同：S/V/G 每阶段必派、R3 无条件 ≥3 条、A 阶段 1-4 必派（见本文件「角色分派完整性校验」节），编排者不得越权实施 |
| 评审独立性 | 由 Agent 自评 | V 子代理物理隔离，不接触 S 子代理内部推理 |
| 门禁执行 | 由 Agent 直接跑 | G 子代理独立跑 + 回填证据摘要 |
| 编排者越权处置 | 无强制机制 | 反模式 #10，命中即回退 |

## 角色分派完整性校验

> 对应约束 #8 + 反模式 #34。`check-role-dispatch.ts` 自动校验。

### 必分派条件

每阶段 run-log 须至少含以下角色记录各 1 条：

| 角色 | 必分派条件 | 校验脚本 |
|---|---|---|
| S（产出） | 每阶段必须（产出开发产物 + 测试设计 + RTM 更新） | check-role-dispatch.ts |
| V（评审） | 每阶段必须（按 verifier-spec.md §6（输出 Schema）+ §8（提示词模板）产出 VerifierOutput JSON） | check-role-dispatch.ts |
| G（门禁） | 每阶段必须（跑 check-*.ts + 回填证据摘要） | check-role-dispatch.ts |
| R（根因/R3） | **无条件必须**（completeness/reliability/security 三阶段各 1 次，共 ≥3 条，无条件强制，覆盖所有 S 变体含 S-fix / S-emergency-fix） | check-role-dispatch.ts（`--r3-enabled` flag 保留为 no-op 向后兼容） |

### 可选条件

- A（分析）子代理仅在阶段 1–4 的分块分析与图谱演进时分派；阶段 5–8 可不分派。
- O（编排者）每阶段固定分派（CHECKPOINT），不在 check-role-dispatch.ts 校验范围（O 由约束 #2 阶段门放行覆盖）。

### 豁免条件

**self-as-verifier 模式豁免**（仅 demo 项目 / 非生产项目）：
- S/V/G/R 任两角色由同一 Agent 兼任时，run-log 中可同一 `runId` 条目标记多角色（如 `role="S/V"`），但须满足：
  1. 产出各角色独立产物文件（VerifierOutput JSON / RootCauseReport / gate-logs JSON / PreventiveReview JSON 三份路径不同）
  2. run-log 条目的 `artifacts` 字段列出各角色独立产物路径
- 详见 SKILL.md「self-as-verifier 模式」节与反模式 #35。

### 校验命令

```bash
# R3 无条件强制，--r3-enabled flag 保留为 no-op 向后兼容
npx tsx w-model-dev/scripts/cli/check-role-dispatch.ts .w-model/run-log.jsonl

# 兼容调用（flag 视为 no-op，行为一致）
npx tsx w-model-dev/scripts/cli/check-role-dispatch.ts .w-model/run-log.jsonl --r3-enabled
```

退出码：0=通过，1=缺角色（违反约束 #8，R≥3 无条件校验），2=输入错误。
