# 编排者-子代理边界（Orchestrator-Subagent Boundary）

> SSoT [§3.4](../../docs/skill-design-document_SSoT.md) 为权威定义，本文件为可执行细则。
>
> **目的**：编排者工作最小化——编排者只做编排（路由 / 状态读写 / CHECKPOINT 等待 / 分派子代理 / 持久化 / 只读脚本），任何修改、编码、调测、分析、修正、验证产出的实施动作必须由子代理执行。
>
> **强制等级**：违反本文件「强制约束」节命中反模式 #10「编排者越权实施」（见 [anti-patterns.md](anti-patterns.md)），**命中即回退到当前阶段起点**。
>
> **与 [agent-personas.md](agent-personas.md) / [verifier-spec.md](verifier-spec.md) 的关系**：本文件定义「谁来做」（角色划分与分派），agent-personas.md 定义 V 子代理内部的角色视角，verifier-spec.md §7-§8 定义 V 子代理的输出 Schema 与提示词模板。三者互补，不冲突。

## 目录

- 角色划分（O / S / V / G）
- 每阶段分派时序
- 子代理分派模板
- 回填契约
- 强制约束
- 与现有约束的兼容性
- 失败模式与回退

## 角色划分（O / S / V / G / A / R）

| 角色 | 简称 | 职责 | 允许动作 | 禁止动作 |
|---|---|---|---|---|
| **编排者** | O | 路由、状态读写、CHECKPOINT 等待、分派子代理、持久化 | ① 读 `.w-model/project.json` / `.w-model/rtm.json` / `.w-model/budget.json` / `.w-model/run-log.jsonl` / `.w-model/maturity.json`；② 跑 `check-verifier-output.ts` / `check-artifact-gate.ts` 看**退出码**（只读，用于向用户展示或路由判定）；③ `git status` / `ls` / `Read` 等只读核验；④ 在 CHECKPOINT 暂停等待用户决定；⑤ 用户放行后更新 `project.status` 与 `updatedAt`；⑥ 分派 S / V / G 子代理；⑦ **维护 budget.json / run-log.jsonl / maturity.json**（状态读写+持久化，非实施；见 [operational-recovery.md](operational-recovery.md)「成本预算与运行日志」节 + 「成熟度与 CHECKPOINT 放行」节）：项目初始化创建三文件、每次子代理返回/门禁执行/CHECKPOINT 放行后 append run-log、预算检查、成熟度判定与升降级；⑧ **维护 event-ingress.jsonl + 事件路由**（状态读写+路由判定，非实施；见 [event-ingress-guide.md](event-ingress-guide.md)）：L2+ 激活时读 event-ingress.jsonl 未路由事件、查路由表、写 routedTo、append run-log action=event-route；⑨ **产出 HarnessImprovementReport**（状态分析，非实施；见 [hill-climbing-guide.md](hill-climbing-guide.md)）：分析 run-log 产出改进信号报告，存 `.w-model/hill-climbing/<ts>-report.json`，不自动改 harness | ① 用 `Write` / `Edit` 写或修改任何阶段产物文件；② 产出 `VerifierOutput` JSON 内容；③ 修改 `rtm.json` 实体字段（需求 / 设计 / 测试用例 / 执行结果）；④ 生成测试用例代码或业务代码；⑤ 跳过 S → V → G 顺序（如自评自审） |
| **产出子代理** | S | 生成阶段开发产物 + 同步测试设计 + 更新 RTM 实体 | ① 写文件（需求规格 / 设计文档 / 代码 / 测试用例代码 / 测试报告）；② 跑测试运行器（仅产出阶段，如 `npx vitest run`）；③ 改 `.w-model/rtm.json` 实体字段（需求 / 设计 / 测试用例 / 执行结果）；④ 加载当前阶段 `phase-N-*.md` 与对应模板 | ① 跑 `check-verifier-output.ts` / `check-artifact-gate.ts`（由 G 子代理负责）；② 越阶段产出（仅产当前阶段）；③ 改 `project.status`（由编排者负责） |
| **评审子代理** | V | 按 [agent-personas.md](agent-personas.md) + [verifier-spec.md](verifier-spec.md) §8 产出 `VerifierOutput` JSON | ① 读产物文件（需求规格 / 设计文档 / 代码 / 测试用例 / 测试报告）；② 按 `targetKind` 选用 Persona（code-reviewer / test-engineer / security-auditor / performance-auditor）；③ 产出 `VerifierOutput` JSON（满足 [verifier-spec.md](verifier-spec.md) §7 Schema） | ① 跑门禁脚本（由 G 子代理负责）；② 改产物文件；③ 改 RTM；④ 跨阶段评审 |
| **门禁子代理** | G | 跑 `check-verifier-output.ts` / `check-artifact-gate.ts` + 回填证据摘要 | ① 跑 `npx tsx w-model-dev/scripts/check-verifier-output.ts "<json>"`；② 跑 `npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]`；③ 读 GATE_JSON / Verifier JSON；④ 产出证据摘要字符串（含退出码 / 质量等级 / `passed` / `reworkHints`） | ① 改产物文件；② 产出 `VerifierOutput` JSON（由 V 子代理负责）；③ 改 RTM 实体；④ 跑测试运行器（由 S 子代理负责） |
| **分析子代理** | A | 分块分析、交叉合并、图谱演进（阶段 1–4） | ① 读原始文档分块 / S 产出的正式文档；② 写 `.w-model/ingestion/<chunk-id>.{md,json}`；③ 读所有 chunk json 合并建图；④ 产出 `consolidated.json` + `cross-analysis-report.md` + `reworkHints`；⑤ 通过晋升 consolidated.json 更新 graph.json | ① 跑 `check-requirement-graph.ts`（G 负责）；② 写正式阶段产物；③ 改 `project.status`；④ 越阶段产出；⑤ 删除前阶段已通过的图谱节点 |
| **根因定位子代理** | R | 接收 V/G 的 `reworkHints` + 失败产物 + 上游产物，运用根因分析方法论定位缺陷根因，产出 `RootCauseReport`（含根因链、上游缺陷标记、修复建议、防御措施） | ① 读失败产物文件 + 上游产物（需求/设计/代码/测试/TLA+/graph.json）；② 读 V 的 `VerifierOutput` JSON + G 的 GATE_JSON；③ 运用根因分析方法（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）；④ 产出 `RootCauseReport` JSON + `.md` 报告文件；⑤ 标记 `upstreamDefect`（若根因为上游需求/设计缺陷）；⑥ 作为 R-lead 分派 R-persona 子代理（并行或串行均可）并聚合产出（见 root-cause-locator.md §4） | ① 改任何产物文件（由 S 修复）；② 跑门禁脚本（由 G 负责）；③ 改 RTM 实体；④ 改 `project.status`；⑤ 跨阶段定位（仅定位当前阶段产物的缺陷根因，上游回溯仅标记不修改）；⑥ 评审其他角色产出 |

> **只读脚本例外**：编排者可执行 `npx tsx w-model-dev/scripts/check-*.ts`、`git status`、`ls` 等确定性只读命令以核验状态/展示证据，但不得**写入或修改**任何产物/评审/RTM 内容。门禁脚本本身为确定性 TypeScript，不含 LLM 调用，编排者跑它仅用于"看退出码"，不构成实施，也**不替代 G 子代理的回填职责**——G 子代理必须独立跑一次并产出证据摘要。

## 每阶段分派时序

```
O: 路由 + 读状态 + 检查前置产物 + 加载最小引用集（SKILL.md + 当前阶段 phase-N）
O: 🔴 CHECKPOINT · 项目初始化（首次）或阶段进入确认
  ↓ 分派 S
S: 产出开发文档 + 同步测试设计 + 更新 RTM 实体 → 返回 {产物路径, RTM diff}
  ↓ 分派 V
V: 按 targetKind 路由 Persona → 产出 VerifierOutput JSON
  ↓ 分派 G
G: npx tsx w-model-dev/scripts/check-verifier-output.ts "<json>"
   → 返回 {exitCode, qualityLevel, passed, reworkHints}
O: 若 exitCode ≠ 0 或 qualityLevel ∈ {C,D}
   → 分派 R 定位（输入：reworkHints + 失败产物 + 上游产物）→ R 产出 RootCauseReport
   → 分派 V 复审根因报告（targetKind=rootcause）→ V 返回 {qualityLevel, passed, reworkHints}
   → 分派 G 门禁（check-rootcause-report.ts）→ G 返回 {exitCode, evidence}
   → 分派 S-fix 修复（输入：R 报告 + fixRecommendation）→ S-fix 返回 {artifacts, rtmDiff, fixBasedOn, selfCheck}
   → 重走 V → G（评审修复产物）
O: 若通过
   → 🔴 CHECKPOINT · 阶段门放行（编排者展示 G 子代理返回的证据给用户）
O: 用户放行 → 编排者更新 project.status → 进入下一阶段
```

阶段 8 终检额外分派 G 跑 `check-artifact-gate.ts`：

```
O: 阶段 8 验收测试产物已放行
  ↓ 分派 G
G: npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]
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
  - references/verifier-spec.md §7（输出 Schema）+ §8（提示词模板）+ §7.4A（五轴 + Severity）
  - references/quality-standards.md（如评审代码 / 测试）
  - references/definition-of-done.md（如评审阶段门）
产出契约：
  1. VerifierOutput JSON 文件路径：<约定路径>
  2. 必须满足 verifier-spec.md §7 Schema（subCriteria / compositeScore / qualityLevel / passed / reworkHints）
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
  - 阶段 1~7 门：npx tsx w-model-dev/scripts/check-verifier-output.ts "<verifier-output.json>"
  - 阶段 8 终检：npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]
产出契约：
  1. 退出码（0 / 1 / 2）
  2. 证据摘要：
     - 阶段门：{exitCode, qualityLevel, passed, reworkHints}
     - 终检：{exitCode, GATE_JSON 摘要（RTM 覆盖率 / 四级测试结果）}
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
- **S-tla**：产出对应层级 TLA+ 规格（`.tla` + `.cfg`）+ 更新 `tla-manifest.json`；**依赖 S-doc 已产出的设计文档**作为建模输入。
- **S-bdd**：产出对应层级 BDD features（`.feature`）+ 更新 `bdd-manifest.json`；**依赖 S-doc 已产出的设计文档 + S-tla 已产出的 TLA+ 规格**作为等价性对齐输入（BDD 状态机七要素须与同层 TLA+ spec 的 State/Init/Next/Invariants 等价）。
- **分派时序**：S-doc → S-tla → S-bdd → V → G（V 评审三批产物的合集；G 跑 `check-verifier-output.ts` + `check-tla-model.ts` + `check-bdd-model.ts`）。
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
任务：产出对应层级 TLA+ 规格 + 更新 tla-manifest.json
依据：references/tla-plus-guide.md + templates/tla-spec-template.md + S-doc 已产出的设计文档
产出：
  1. .tla（按 phase-N 层级：L1/L2/L3/L4）
  2. .cfg（TLC 模型检查配置）
  3. tla-manifest.json 实体更新
  4. 返回：{.tla 路径, .cfg 路径, manifest diff, selfCheck}
不产出：
  - 开发文档 / 测试设计 / RTM 实体（由 S-doc 负责）
  - .feature / bdd-manifest.json（由 S-bdd 负责）
  - 跑门禁脚本 / 越阶段产出 / 改 project.status
```

#### S-bdd 子代理分派模板

```
角色：产出子代理-BDD 变体（S-bdd）
当前 W 模型阶段：<阶段 N - 名称>
任务：产出对应层级 BDD features + 更新 bdd-manifest.json
依据：references/bdd-guide.md + templates/feature.template + templates/bdd-manifest.template.json + S-doc 已产出的设计文档 + S-tla 已产出的 TLA+ 规格（用于 BDD↔TLA+ 等价性对齐）
产出：
  1. .feature（按 phase-N 层级：L1/L2/L3/L4，每个 REQ/SD/INTF/DD ≥1 个 .feature 文件）
  2. bdd-manifest.json 实体更新（features + stateMachines + tlaSpecId 关联）
  3. RTM 测试列追加 BDD 引用（`<Type>-NNN | BDD-L<level>-<system>-<num>.feature`）
  4. 返回：{.feature 路径, manifest diff, RTM diff, selfCheck}
不产出：
  - 开发文档 / 测试设计 / RTM 实体（由 S-doc 负责）
  - .tla / .cfg / tla-manifest.json（由 S-tla 负责）
  - 跑门禁脚本 / 越阶段产出 / 改 project.status
约束：
  - BDD 状态机七要素须与同层 TLA+ spec 等价（states↔State / initialState↔Init / transitions↔Next / invariants↔Invariants）
  - 文件头 9 个 @ 字段全部必填（@req / @design / @system / @tla-spec / @state-machine / @parent-features / @sibling-features / @child-features / @scenario-id-prefix）
  - Background 节七要素全部必填（acceptingStates 不可为空，其余可为 ()）
```

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

### R3 预防性审查分派模板（第22轮新增）

> S 产出后、V 评审前触发。R3 复用 R 子代理机制，但目的为预防性审查而非根因定位。

**分派时序**：S 产出 → R3-completeness / R3-reliability / R3-security（可并行）→ V 评审

**R3 子代理输入**：
- 当前阶段产物路径
- 上游产物（需求/设计文档、RTM、TLA+ 规格、BDD features）
- 审查维度（completeness / reliability / security）

**R3 子代理产出**：`.w-model/preventive-reviews/<phase>-{completeness,reliability,security}.json`

**PreventiveReview schema**：见 `schemas/preventive-review.schema.json`

**R3 审查清单（按维度）**：

| 维度 | 检查项 |
|---|---|
| completeness | 字段齐全 / 模板套用 / RTM 登记 / demo 范围边界 / N-A 标记 / uat-path-mapping 回填 |
| reliability | TLA+/BDD 等价性 / 状态机一致性 / 接口契约 / 字段命名业务语义对齐 / 设计项装配点与测试 seam 一致性 |
| security | 输入校验 / 鉴权 / 越权 / 敏感信息 / 限流装配 / 密码哈希 |

**R3 与返工R的区别**：

| 属性 | 返工R（现有） | 预防R3（新增） |
|---|---|---|
| 触发时机 | V/G 不通过后触发 | S 产出后主动触发 |
| 目的 | 定位根因 | 预防性审查 |
| 产出 | RootCauseReport | PreventiveReview 三份报告 |
| 方法论 | root-cause-locator.md（5-Why / 鱼骨图 / 上游回溯）定位根因 | 借鉴 root-cause-locator.md 分析工具，但目的不同：预防性审查用「完整性清单 + 可靠性核验 + 安全基线」三维度检查产物，不定位根因 |
| schema | rootcause-report.schema.json | preventive-review.schema.json |

**V 评审参考方式**：V 子代理在评审时须读取 R3 三份报告，将 R3 发现的问题纳入 `reworkHints`。V 不得跳过 R3 报告直接评审（命中反模式 #33）。

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
  - references/verifier-spec.md §7（输出 Schema，rootcause 复审仍用 VerifierOutput）

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

## 反模式 #20：只规划不执行（第 9 轮 P1.3）

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

## S 子代理修改既有产物的边界（第 9 轮 P2.7）

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
3. **紧急修复通道**（仅当 bug 阻塞当前阶段推进时启用）：
   - S 子代理可执行**最小修复**（仅修复阻塞点，不扩展功能、不重构）
   - 必须在 `.w-model/run-log.jsonl` 追加 `fix` 条目，标注 `"紧急修复": true` 和阻塞原因
   - 紧急修复条目格式：`{role:"S", action:"fix", variant:"emergency-fix", blocker:<阻塞描述>, fixedLocation, fixBasedOn:"S-self-assessment", needsReview:true}`
   - 阶段完成后由 R 子代理复核紧急修复的完整性（R 复核产出追加到 `RootCauseReport` 的 `emergencyFixReview` 字段）；R 复核认为修复不完整 → 转 S-fix 重做

**违规检测**：

- `run-log.jsonl` 中 S 子代理（`role=S`）的 `action=fix` 条目需特别审查：
  - `variant="emergency-fix"` + `blocker` 非空 → 合法紧急修复通道
  - 无 `variant` 或 `variant` 非 `emergency-fix` / `fix`（S-fix 变体） → 视为越权修复，命中反模式 #10 变体
- 非紧急修复的 `fix` 条目视为越权，需回滚并由 R + S-fix 重做
- 检测脚本：`check-run-log.ts` 校验 `role=S` 的 `action=fix` 条目必须含 `variant` 字段，且 `variant=emergency-fix` 时必须含 `blocker` 字段

> 与反模式 #18（跳过 R 直接 S 返工）的关系：本边界条款是 #18 的细化——S 子代理发现既有 bug 时不得自行修复（即便 S 自评根因准确），必须走「记录 rootcause → 转 R → V 复审 → G 门禁 → S-fix」流程。紧急修复通道是唯一例外，且必须 needsReview=true 由 R 复核。

## 豁免审批角色边界（第 20 轮四维识别与豁免审批扩展）

> 第 20 轮新增。覆盖缺失、conflicts-with 冲突、覆盖率不达标等事项须经强制 S→R→V→人类四阶段审批流程。本节扩展 S/R/V 角色边界，明确各角色在豁免审批中的职责与禁止动作。违反即命中反模式 #30（豁免审批跳步），见 [anti-patterns.md](anti-patterns.md)。

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
O: 分派 G 跑 check-exemption E1-E8 全通过 → 豁免生效
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

> 豁免审批流程的收敛判定由 G 跑 `check-exemption` E1-E8 退出码决定（仿 ingestion 收敛由 G 跑 `check-requirement-graph.ts` 决定）。S/R/V 的产出仅作流程输入，不替代脚本判定。

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
| 子代理分派方式 | 由 Agent 自身决定 | 强制 O / S / V / G 四角色，编排者不得越权实施 |
| 评审独立性 | 由 Agent 自评 | V 子代理物理隔离，不接触 S 子代理内部推理 |
| 门禁执行 | 由 Agent 直接跑 | G 子代理独立跑 + 回填证据摘要 |
| 编排者越权处置 | 无强制机制 | 反模式 #10，命中即回退 |
