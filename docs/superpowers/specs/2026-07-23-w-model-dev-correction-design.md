# w-model-dev 修正设计（Correction Design）

> 日期：2026-07-23
> 主题：基于 Shell Agent 项目（shell-agent-wm-001）阶段 1-3 实际执行轨迹与产物的深度分析，修正 w-model-dev 技能包的设计与实现缺陷
> 状态：待审阅
> 上游分析：`d:\w_skill_opt\执行情况\`（实际轨迹.log + .w-model/ 全部产物 + frozen/DESIGN.md）

---

## 1. 背景与目标

### 1.1 背景

Shell Agent 项目（shell-agent-wm-001）按 w-model-dev 技能包走 W 模型阶段 1-3（需求分析 / 系统设计 / 概要设计），三个阶段均声明"三个门禁全部通过"并放行。但对 143KB 实际轨迹日志与全部 `.w-model/` 产物的深度分析暴露出 w-model-dev 存在**系统性"门禁形同虚设"问题**：门禁脚本退出码与 passed 字段不一致、Verifier 防漂移未实现、闭环机制无强制校验、O 角色越权无检测、TLA+ 建模覆盖率严重不足。

### 1.2 目标

让 w-model-dev 的门禁真正起作用：**任何违规都无法通过门禁放行**。具体达成：

1. 门禁退出码不可伪（exitCode 与 JSON passed 强一致，存档可追溯）
2. Verifier 防漂移真正实现（rawScores 全同/variance 重算/±0.05 扰动校验）
3. TLA+ 建模覆盖率以系统层级树 SD 层为基准（每个 SD 须有 TLA+ 覆盖）
4. 系统层级树 + 多层图谱作为图谱校验的统一拓扑基
5. budget / run-log / maturity 三套闭环机制由独立脚本强制校验完整性
6. CHECKPOINT 不可伪造（acknowledgedDecisions 须用户原文，O 不得代填）
7. O 角色越权可检测（禁止 O 直接操作 .w-model/*.json）

### 1.3 范围

- **本设计修正**：w-model-dev 技能包的 SSoT、references、scripts、samples、self-test、SKILL.md、AGENTS.md
- **同步修正**：`d:\w_skill_opt\执行情况\` 全部产物作为合规样例
- **不修正**：frozen/DESIGN.md（设计事实文档，不在本设计范围）；阶段 4-8 流程（阶段 1-3 暴露的问题修正后，阶段 4-8 自然受益）

---

## 2. 缺陷清单（D1-D34）

按严重度分 P0（阻塞）/ P1（一致性）/ P2（验证增强）三级。

### 2.1 P0 · 门禁脚本失效

| ID | 缺陷 | 证据 |
|----|------|------|
| D17 | G 门禁记录的 exitCode=0 但 passed=false | 轨迹 L832-844：`"exitCode": 0, "passed": false, "violations": [20 项]`。脚本本身退出码逻辑正确（`process.exit(result.passed ? 0 : 1)`），但 O 记录的 exitCode 与脚本实际 exitCode 不一致 |
| D12 | Verifier 防漂移完全失效 | 轨迹 L2553-2557：V 手工编造 rawScores `[0.92,0.91,0.93]`，差值 0.02 远小于 ±0.05；variance 初版 `0.000278` 最终改 `0.000067`；verifier-output-phase2.json L28 `rawScores:[0.95,0.95,0.95] variance:0.0` 全同未触发防漂移 |
| D10 | TLA+ 建模覆盖严重不足 | DESIGN.md L1094 冻结 11 子系统（S01-S11），tla-manifest.json 仅 3 规格（L1/L2 建 S01，L3 建 S08）。漏建 9 子系统：S02-S07、S09-S11。verifier-output-phase2 L61 自承认"TLA+ L2 未建模 S09/S10，属 L3 细化范围"，但 phase3 L3 只建 S08 |
| D25 | L1.cfg 缺 INV4/INV7 不变式 | tla/L1_shell_agent.cfg INVARIANTS 仅列 9 条，缺失 NoExitTerminal(INV4) 与 ArtifactGateConsistency(INV7)。.tla 定义 10 条 BusinessInvariant，cfg 只验证 9 条 |
| D26 | L3.cfg 含错误 MODULE 声明 | tla/L3_artifact_gate.cfg L1：`---- MODULE L3_artifact_gate ----`——.cfg 文件不应含 MODULE 声明 |
| D27 | L3 不变式数量三处不一致 | 阶段 3 CHECKPOINT（轨迹 L5892）：5 个不变式；L3.cfg 实际：6 条 INVARIANT；verifier-output-phase3 evidence L43：4 个不变式。三处数字不一致 |
| D6 | tla-manifest 虚假声明 | jarPath 路径错误（`.trae/skills/...` 应为 `w-model-dev/tools/...`）；checkRounds=[] 空但轨迹显示 L1 经历 5 项违反返工、阶段 2 又有 4-5 类违反返工——返工历史被系统性抹除；L1 variableCombination=1056>1000 且 L2=8192>1000 都标 kept-below-threshold 无理由 |
| D33 | TLA+ 返工未触发 killSwitch | 轨迹 L4421/L4449："4 类违反"→"5 类违反"，TLA+ 至少 2 轮返工。killSwitch.tlaReworks=3 应触发暂停，但 budget.json/run-log.jsonl 无任何告警 |

### 2.2 P0 · 流程违反

| ID | 缺陷 | 证据 |
|----|------|------|
| D18 | O 越权直接操作产物 JSON | 轨迹 L907-1057/L955/L1002：O 自己分析信息流违反、自己用 `node -e` 添加 22 条 produces 边、自己写 chunk-001.json。O 直接承担 A 子代理职责，违反 SKILL.md 反模式 #10 |
| D19 | CHECKPOINT 用户确认是 O 自问自答 | 轨迹 L3293-3305：`**请确认：放行进入阶段 2？** user：继续 用户确认放行`。user 只说"继续"，O 自己填写 acknowledgedDecisions（含"50个REQ节点完整覆盖"等技术决策） |
| D24 | 阶段 1 直接 cp consolidated.json graph.json | 轨迹 L1398：`cp consolidated.json graph.json`——阶段 1 未走 A-evolve 演进，直接复制。阶段 2/3 才有 A-evolve，ingestion 流程不一致 |

### 2.3 P1 · 闭环机制纸面合规

| ID | 缺陷 | 证据 |
|----|------|------|
| D1 | budget.json 3 阶段未更新 | budget.json `updatedAt==createdAt`（3 阶段未更新），TLA+ 返工应触发 killSwitch 但无告警 |
| D13 | run-log/maturity 三套机制全部失效 | run-log.jsonl 仅 4 条 checkpoint 记录，tokens:0，无 chunk/cross/gate/rework 动作。maturity.json level:L0, history:[]，3 阶段全过应触发 L0→L1 评估，完全没动。实际有图谱 20 项违反→修复、verifier 3 轮修复、TLA+ 5 项+4 类违反修复——全部未入 run-log |
| D31 | V 子代理系统性产出非合规 VerifierOutput | 轨迹 L2169/L2274/L2362/L5635：phase1 V 缺 meta 字段，phase2 V 又有问题，phase3 V 又缺 meta 字段。V 在三个阶段都产出非合规产物，O 反复修正 |

### 2.4 P1 · 证据质量问题

| ID | 缺陷 | 证据 |
|----|------|------|
| D14 | V 编造 TLA+ 证据 | verifier-output-phase1.json L56 evidence 写"TLA+ L1 状态机 11 状态与 REQ-010 主循环一致，5 条不变式"，但 phase1 评审时 L1 尚未建（轨迹 L2153 显示 L1 初版有 5 项违反），且 L1_shell_agent.tla BusinessInvariant 实际 10 条不是 5 条 |
| D15 | phase2/phase3 V 证据互相矛盾 | phase2 summary L61："TLA+ L2 未建模 S09/S10，属 L3 细化范围"；phase3 reworkHints L60："TLA+ L3 聚焦 artifact gate，主循环完整状态机由 L2 覆盖"。两个阶段 V 评审互相打脸，但都 passed=true |
| D20 | S 产物描述与实际 .tla 不符 | 轨迹 L1803："11状态/19转移/6不变式"；L3284："21个可达状态/4个不变式"。实际 L1_shell_agent.tla：StateSet 11 状态、Next 联合 21 个转移、BusinessInvariant 10 条。三处数字都不一致，V 评审未发现 |
| D3 | V 方差阈值跨阶段不一致 | phase1/phase3 varianceThreshold=0.05，phase2 varianceThreshold=0.10 |
| D4 | V phase3 角色错误 | verifier-output-phase3.json L7 `agent:"V-subagent (requirements-analyst)"`——阶段 3 是概要设计评审，应是 design-reviewer |

### 2.5 P1 · 模型/设计问题

| ID | 缺陷 | 证据 |
|----|------|------|
| D11 | graph-logic.ts 单根分析代码缺陷 | graph-logic.ts L209-221：死代码（L209-217 空分支）、orphan 语义错误（多根时把所有根标 orphan）、无环检测缺失、EXT 豁免注释含糊、根节点误判死模块 |
| D21 | consumes 边全为 0 | 轨迹 L4110："总边 244（60 parent + 36 depends-on + 122 produces + 0 consumes + 26 implements）"。信息流模型只用 produces，consumes 是冗余设计 |
| D22 | 测试覆盖薄弱 | UAT 60 条中 50 正常 + 10 异常/边界，正常路径占 83%；ST 30 条覆盖 39/50 REQ（78%），11 个 REQ 无 ST；S04/S06/S10/S11 各只 1 个 ST |
| D23 | INTF-5.2.11 消费方为 "—" | cross-analysis-report.md L34/L144：INTF-5.2.11 派生规格接口文档未明确消费方，靠"模块调用关系图"推测指向 SD-5.2.2 |
| D5 | consolidated.json 历史覆盖 | consolidated.json 只留阶段 3 快照，阶段 1/2 被覆盖。cross-analysis-report.md 能对比 74→85 节点，说明历史应保留 |

### 2.6 P2 · 验证增强（根因）

| ID | 缺陷 | 根因 |
|----|------|------|
| D7 | check-tla-model.ts 无 SD 覆盖率校验 | D10 根因 |
| D8 | 无 check-run-log.ts 脚本 | D13 根因 |
| D9 | 无 check-budget.ts 脚本 | D1 根因 |
| D16 | check-verifier-output.ts 防漂移未实现 | D12 根因 |
| D34 | RTM schema 不支持阶段演进式扩展 | data-models.md 缺字段演进规则 |

---

## 3. 总体架构

### 3.1 设计原则

1. **退出码不可伪**（D17 根因）：所有门禁脚本 JSON 摘要含 exitCode 字段，与 process.exit() 强一致。G 子代理须存档 stdout 到 `.w-model/gate-logs/`，check-run-log.ts 交叉校验。
2. **纯逻辑/CLI 分离不变**：`*-logic.ts` 为纯函数（无 I/O，单点事实源），`check-*.ts` 为 CLI。新增校验项优先落入纯逻辑。
3. **SSoT-first**：所有规则先写 SSoT，再落 references，再落 scripts。
4. **声明与执行分离**：manifest 声明的标志须由 CLI 实际执行后回填，纯逻辑校验"声明值与执行结果一致性"。
5. **闭环机制有 teeth**：budget/run-log/maturity 三套机制由独立脚本强制校验完整性。
6. **根树驱动四维分析**：唯一根（REQ 系统节点）确定后，输入输出/需求关系/多级状态机/多级行为图谱四个维度都基于根树分析。

### 3.2 门禁校验链重组

```
┌─ Layer 0：环境就绪（Java/jar 存在）           ── check-tla-model.ts 内置
├─ Layer 1：产物结构校验（JSON schema/字段）      ── 各 check-*.ts 内置
├─ Layer 2：语义校验（防漂移/覆盖率/单根/cfg 一致）── 各 *-logic.ts 扩展
├─ Layer 3：工具执行校验（SANY/TLC 实际跑）       ── check-tla-model.ts
└─ Layer 4：闭环完整性（budget/run-log/maturity）  ── 4 新脚本

G 子代理在每个阶段门调用全部相关层级，任一层失败 exitCode=1，O 不得放行。
```

### 3.3 新增脚本清单

| 脚本 | 校验对象 | 对应缺陷 |
|------|---------|---------|
| `check-budget.ts` | budget.updatedAt 滞后、killSwitch 触发未告警 | D1/D33 |
| `check-run-log.ts` | 每阶段动作完整性、tokens 非负、返工记录、O 越权检测、exitCode 交叉校验 | D13/D17/D18 |
| `check-maturity.ts` | 成功阶段后 unlockConditions 更新 | D13 |
| `check-checkpoint.ts` | acknowledgedDecisions 非空且非 O 代填 | D19 |

---

## 4. 门禁脚本修正设计

### 4.1 门禁结果防伪机制（D17）

**根因修正**：脚本退出码本身正确，但 O 角色记录的 exitCode 不可信。三层防伪设计：

1. **脚本侧**：JSON 摘要增加 `exitCode` 字段，与 `process.exit()` 强一致。O 必须从 JSON 摘要提取 exitCode，不得自行记录。
   ```typescript
   console.log('SCRIPT_JSON ' + JSON.stringify({
     ...,
     exitCode: result.passed ? 0 : 1,
   }));
   process.exit(result.passed ? 0 : 1);
   ```
2. **存档侧**：G 子代理须把脚本 stdout 完整存档到 `.w-model/gate-logs/phaseN-<script>.log`。
3. **校验侧**：`check-run-log.ts` 交叉校验 run-log.jsonl 中的 `gateExitCode` 与 gate-logs/ 存档中的 `SCRIPT_JSON.exitCode` 一致。不一致 → D17 类问题复发。

### 4.2 verifier-logic.ts 防漂移实现（D12/D16）

新增 3 项校验：

| 校验项 | 规则 | 失败行为 |
|--------|------|---------|
| rawScores 全同检测 | `rawScores` 所有元素相等 → fail（违反 verifier-spec.md §3.2） | `violations.push("rawScores 全同，疑似手工填写")` |
| variance 重算校验 | 用 `rawScores` 重算方差，与声明 `variance` 差异 > 1e-6 → fail | `violations.push("variance 声明值与重算不一致")` |
| ±0.05 扰动范围校验 | text-parse 模式下 `max(rawScores) - min(rawScores)` 须在 [0.01, 0.10] 范围内；<0.01 警告，>0.10 fail | 警告不 fail，记入 reworkHints |

### 4.3 tla-logic.ts 三项扩展（D10/D25/D26/D27）

| 扩展 | 函数名 | 校验内容 |
|------|--------|---------|
| SD 覆盖率 | `checkCoverage(specs, graphSdNodes)` | 每个 SD 节点至少被一个 TLA+ spec 的 requirementIds 或 designRef 覆盖。check-tla-model.ts 增 `--graph=<graph.json>` 入参 |
| cfg-tla 一致性 | `checkCfgInvariantsConsistency(tlaContent, cfgContent)` | .cfg INVARIANTS 列表须与 .tla 中 BusinessInvariant 展开的子不变式集合一致（集合比较，容忍注释/空白差异） |
| cfg 结构校验 | `checkCfgStructure(cfgContent)` | .cfg 禁止含 `---- MODULE` 声明；INVARIANT 行格式校验；不变式数量计数（供跨产物交叉校验） |

### 4.4 graph-logic.ts 系统层级树 + 多层图谱（D11/D21）

#### 4.4.1 系统层级树（递归子系统根）

**根 = 系统本身**，由 type=REQ 的系统级节点（如 REQ-001）担任。每个 SD 节点是其下属子树的根（子系统根），每个 INTF 节点依附子系统根。

```
Level 0:  REQ-001 (系统根)
            │
Level 1:  SD-5.2.1 (S01) ── SD-5.2.2 (S02) ── ... ── SD-5.2.11 (S11)
            │                    │                       │
Level 2:  INTF-5.2.1         INTF-5.2.2              INTF-5.2.11
            │
Level 3:  DD-...
```

**层级树校验规则**：

1. 根候选 = parent 入边为 0 的节点（排除 EXT-IN/EXT-OUT 边界豁免）
2. **根类型约束**：根候选中存在非 REQ 节点 → 违反"根必须是系统"；多个 REQ 节点 → 多根违反；零个 REQ 节点 → 报"缺少系统根，可能存在 parent 边环"
3. **每一级节点都有根**：子系统根（SD）通过 parent 依附系统根（REQ）；接口根（INTF）通过 parent 依附子系统根（SD）
4. **层级单调**：parent 边只能从 Level N → Level N-1
5. **orphan 检测**：`reachableFromRoot = BFS(parent 边反向，从唯一根出发能到达的节点集合)`；orphans = 所有非边界节点 - reachableFromRoot
6. **环检测**：零根场景时对 parent 边做 DFS 三色染色，发现灰边（回边）则报"parent 边存在环"
7. **根节点豁免死模块**：REQ-001 作为系统根，是系统对外交互的代理，in=0 out=0 不判死模块

#### 4.4.2 多层图谱（7 层）

| 图谱层 | 边类型 | 语义 | 校验规则 |
|--------|--------|------|---------|
| 结构层 | `parent` | 系统层级树依附 | 单根、层级单调、无环、orphan 检测 |
| 依赖层 | `depends-on` | 同层节点依赖 | 两端 ∈ 同层节点 |
| 追溯层 | `implements`/`defines`/`realizes` | 跨层追溯 | SD_without_implements/INTF_without_defines/DD_without_realizes |
| 信息流层 | `produces` | 信息流转 | 无黑洞/奇迹/死模块（根节点豁免），EXT-IN/OUT 须依附根树 |
| 治理层 | `governs`（新） | 横切治理（S08→多子系统） | governs 源须为治理类子系统，目标须为被治理子系统 |
| 协作层 | `collaborates-with`（新） | 对等协作 | 单条边语义双向：存在 A→B 即视为 A 与 B 协作，不要求同时存在 B→A；但禁止 A→B 无 B 节点（指向不存在的节点） |
| 派生层 | `derives`（新） | 派生规格（S11→派生产物） | derives 源须为 S11，目标须为派生产物 |

**跨层一致性**：

1. 横切边（governs/collaborates-with/derives）不依附系统层级树，但两端节点须存在于层级树
2. 横切边不替代追溯：被治理子系统的 parent 仍是系统根
3. 信息流可跨层流动，但两端须在层级树中

#### 4.4.3 EdgeType 扩展

```typescript
export type EdgeType =
  | 'parent' | 'depends-on' | 'implements' | 'defines' | 'realizes'
  | 'produces'
  // 移除：'consumes'（信息流层统一用 produces）
  // 新增（多层图谱）
  | 'governs'           // 治理层：S08→多子系统
  | 'collaborates-with' // 协作层：对等协作
  | 'derives';          // 派生层：S11→派生产物
```

#### 4.4.4 与 TLA+ 层次化建模的对齐

TLA+ 层次树与系统层级树同构：

| 系统层级树 | TLA+ 层次树 | 校验 |
|-----------|------------|------|
| REQ-001 系统根 | L1 根规格 | 一一对应 |
| SD-5.2.x 子系统根 | L2 子系统规格 | **每个 SD 须有 L2 覆盖**（D10 根治） |
| INTF-5.2.x 接口 | L3 接口行为规格 | 关键 INTF 须 L3 覆盖 |

横切设计的 TLA+ 建模：S08 治理横切多子系统，TLA+ 可建独立 L2 规格（如 `L2_governance.tla`）覆盖治理行为，其 `@sibling` 关系指向被治理的子系统 L2 规格。

### 4.5 produces/consumes 语义明确（D21）

从 EdgeType 移除 `consumes`，信息流只用 `produces`（双向语义由 from/to 表达）。当前实际执行已证明 produces 单边足够表达信息流，consumes 是冗余设计。

---

## 5. 新增闭环校验脚本设计

### 5.1 check-budget.ts（D1/D33）

**校验对象**：`.w-model/budget.json`

| 规则 | 检测 | 违反示例 |
|------|------|---------|
| R1 时效性 | `updatedAt > createdAt` 当 project.updatedAt > budget.createdAt | 3 阶段推进但 budget 未更新 |
| R2 schema 完整 | perPhase/project/onExceed/killSwitch 字段齐全且类型合法 | 缺 killSwitch |
| R3 onExceed 合法 | `onExceed ∈ {pause, notify, halt}` | 非法值 |
| R4 killSwitch 合法 | 三个阈值字段为非负数且在合理范围 | budgetBurnRate > 1 |
| R5 触发检测 | 交叉 run-log.jsonl 统计返工次数，若 ≥ killSwitch.consecutiveReworks 或 ≥ killSwitch.tlaReworks → 报"killSwitch 应触发但未告警" | TLA+ 返工 2 轮应告警 |

**CLI 用法**：`npx tsx check-budget.ts <budget.json> [--project=<project.json>] [--run-log=<run-log.jsonl>] [--phase=N]`

**退出码**：0 通过 / 1 校验失败 / 2 输入错误

### 5.2 check-run-log.ts（D13/D17/D18）

**校验对象**：`.w-model/run-log.jsonl`

| 规则 | 检测 | 违反示例 |
|------|------|---------|
| R1 阶段动作完整性 | 每个已完成阶段须含至少：1 条 chunk、1 条 cross、1 条 gate、1 条 checkpoint | 阶段 1 缺 chunk |
| R2 tokens 非负 | `tokens ≥ 0`，checkpoint 类 `tokens > 0`（除非 L0 且首次） | tokens=-1 或全程 0 |
| R3 返工记录 | run-log 中 action=rework 的记录数，须与实际返工次数（从 tla-manifest.checkRounds 推断）一致 | TLA+ 返工 2 轮但 run-log 无 rework |
| R4 acknowledgedDecisions 非空 | action=checkpoint 且 outcome=success 时，acknowledgedDecisions 须非空数组 | 空决策放行 |
| R5 O 越权检测 | 交叉 gate-logs/ 检测 O 是否绕过 A/S 子代理直接操作 .w-model/*.json | O 用 node -e 改 JSON |
| R6 exitCode 一致 | gate/tla-gate/graph-gate/checkpoint 类记录的 gateExitCode 须与 gate-logs/ 存档中 SCRIPT_JSON.exitCode 一致 | D17 类伪造 |
| R7 append-only | 时间戳单调递增，无插入历史记录 | 时间戳倒序 |

**CLI 用法**：`npx tsx check-run-log.ts <run-log.jsonl> [--project=<project.json>] [--gate-logs=<dir>] [--tla-manifest=<tla-manifest.json>]`

### 5.3 check-maturity.ts（D13）

**校验对象**：`.w-model/maturity.json`

| 规则 | 检测 | 违反示例 |
|------|------|---------|
| R1 schema 完整 | level/unlockConditions/history/downgradeTriggers 字段齐全 | 缺 history |
| R2 level 合法 | `level ∈ {L0, L1, L2, L3}` | 非法值 |
| R3 成功阶段更新 | project 已完成 N 阶段，但 unlockConditions.completedCycles < N | 3 阶段全过但 completedCycles=0 |
| R4 history 一致 | history 中 leveledUpAt 时间戳须晚于项目 createdAt | history 与 run-log 矛盾 |
| R5 降级触发 | 若 run-log 中 operationalFailures（O1-O6）次数 ≥ downgradeTriggers.operationalFailureStreak → 报"应触发降级评估" | O3 Verifier Theater 连续 2 次未降级 |

**CLI 用法**：`npx tsx check-maturity.ts <maturity.json> [--project=<project.json>] [--run-log=<run-log.jsonl>]`

### 5.4 check-checkpoint.ts（D19）

**校验对象**：`.w-model/run-log.jsonl` 中 checkpoint 类记录

| 规则 | 检测 | 违反示例 |
|------|------|---------|
| R1 acknowledgedDecisions 非空 | 每个 checkpoint success 记录须有 ≥1 条 acknowledgedDecisions | 空决策放行 |
| R2 决策内容具体 | acknowledgedDecisions 不得为泛化模板。泛化模板黑名单：{"确认放行","继续","通过","OK","yes","好的","同意"}。每条决策长度 ≥ 10 字符且须含具体名词（技术方案名/模块名/接口名/数据结构名等） | O 代填"继续" |
| R3 用户确认存在 | checkpoint 须有对应用户确认记录（从轨迹或独立 checkpoint-log 推断） | O 自问自答 |
| R4 决策与阶段匹配 | 阶段 1 checkpoint 决策须与需求相关，阶段 2 与系统设计相关 | 阶段 3 决策谈需求 |

**CLI 用法**：`npx tsx check-checkpoint.ts <run-log.jsonl> [--checkpoint-log=<dir>]`

### 5.5 脚本间依赖关系

```
check-budget.ts ────┐
                    ├──→ check-run-log.ts（交叉校验 exitCode）
check-maturity.ts ──┤
                    ├──→ check-checkpoint.ts（依赖 run-log checkpoint 记录）
gate-logs/ ─────────┘
```

**执行顺序**（G 子代理阶段门调用）：
1. check-budget.ts（先校验预算状态）
2. check-run-log.ts（校验日志完整性 + O 越权）
3. check-maturity.ts（校验成熟度状态）
4. check-checkpoint.ts（校验 CHECKPOINT 真实性）
5. 现有三门禁（check-verifier-output / check-requirement-graph / check-tla-model）
6. 任一失败 → exitCode=1，O 不得放行

---

## 6. 数据模型与 SSoT 更新

### 6.1 SSoT 更新清单

#### 6.1.1 SSoT §10.6 DoD 扩展（D14/D15/D20）

第六维度"理解证据"扩展为 3 子项：
- 6.1 acknowledgedDecisions 非空且含具体技术决策（非"继续"等泛化词）
- 6.2 evidence 可追溯：evidence 字段引用产物须标注路径+行号
- 6.3 跨阶段证据一致性：后阶段 evidence 不得否定前阶段已放行项

#### 6.1.2 SSoT §10.8 TLA+ 行为门禁扩展（D10/D25/D26/D27）

新增 3 必检项：
- SD 覆盖率：每个 SD 节点须被至少一个 TLA+ spec 覆盖
- cfg-tla 一致性：.cfg INVARIANTS 须与 .tla BusinessInvariant 集合一致
- cfg 结构：.cfg 禁止含 MODULE 声明，INVARIANT 行格式合法

#### 6.1.3 SSoT §10E 门禁退出码不可伪（D17，新增章节）

- E.1 各 check-*.ts 的 JSON 摘要须含 exitCode 字段，与 process.exit() 强一致
- E.2 G 子代理须将脚本 stdout 完整存档到 .w-model/gate-logs/phaseN-<script>.log
- E.3 check-run-log.ts 交叉校验 run-log.gateExitCode 与 gate-logs 存档一致
- E.4 任一层校验失败 → exitCode=1，O 不得放行

#### 6.1.4 SSoT §10.10 系统层级树与多层图谱（D11/D21，新增章节）

**10.10.1 系统层级树**：
- 根 = 系统级 REQ 节点（如 REQ-001），type=REQ
- 子系统根 = SD 节点，通过 parent 边依附系统根
- 接口根 = INTF 节点，通过 parent 边依附子系统根
- 层级单调：parent 边只能从 Level N → Level N-1

**10.10.2 多层图谱（7 层）**：
- 结构层（parent）：系统层级树依附
- 依赖层（depends-on）：同层节点依赖
- 追溯层（implements/defines/realizes）：跨层追溯
- 信息流层（produces）：信息流转，根节点豁免死模块
- 治理层（governs）：横切治理（S08→多子系统）
- 协作层（collaborates-with）：对等协作，双向对称
- 派生层（derives）：派生规格（S11→派生产物）

**10.10.3 横切设计承载**：
- 横切边（governs/collaborates-with/derives）不依附系统层级树
- 横切边两端节点须存在于层级树，但不构成 parent 关系
- 横切边不替代追溯：被治理子系统的 parent 仍是系统根

#### 6.1.5 SSoT §10C/§10D 闭环机制强化（D1/D13/D33）

**§10C 成熟度补充**：项目每完成一阶段（run-log checkpoint success），unlockConditions.completedCycles 须 +1；check-maturity.ts 强制校验，滞后 → exitCode=1

**§10D 预算与运行日志补充**：预算每个阶段门放行前 budget.updatedAt 须更新；killSwitch 触发条件满足须告警；运行日志每个阶段须含 chunk/cross/gate/checkpoint 4 类动作；返工须有 rework 记录；check-budget.ts / check-run-log.ts 强制校验

### 6.2 references 更新清单

| 文件 | 更新内容 | 对应缺陷 |
|------|---------|---------|
| verifier-spec.md | §3.2 防漂移实现规则；§4.2 V 子代理 prompt 模板（必填字段清单、禁止手工编造 rawScores）；§6.2 证据可追溯约束；新增 §12 跨阶段 evidence 一致性 | D12/D14/D15/D31 |
| tla-plus-guide.md | 新增 §13 SD 覆盖率规则；§14 cfg-tla 一致性规则；§15 cfg 结构规则 | D10/D25/D26 |
| tla-plus-modeling-design.md | §5 建模与需求/设计一致性补充"每个 SD 须有 TLA+ 覆盖" | D10 |
| graph-guide.md | 重写 §3 单根分析（系统层级树+递归子系统根）；新增 §7 多层图谱（7 层）；移除 consumes 边类型；新增 governs/collaborates-with/derives 边类型 | D11/D21 |
| operational-recovery.md | 强化 CHECKPOINT 流程（acknowledgedDecisions 须用户原文）；新增 O 越权检测（禁止 node -e/直接 Write 操作 .w-model/*.json）；补充 budget/run-log/maturity 三脚本校验约定 | D18/D19 |
| anti-patterns.md | #10 orchestrator overreach 强化检测信号（node -e/直接 Write .w-model/*.json） | D18 |
| data-models.md | RunLogEntry 新增 gateLogPath 字段；BudgetConfig 补充 updatedAt 强制更新规则；新增 EdgeType 扩展（governs/collaborates-with/derives）；RTM 字段阶段演进规则 | D21/D34 |
| ingestion-cross.md | 明确 consolidated.json 保留阶段快照（consolidated-phaseN.json）；阶段演进根树保持（只增不减，根不变） | D5 |

### 6.3 数据模型扩展

#### 6.3.1 EdgeType 扩展

见 4.4.3。

#### 6.3.2 RunLogEntry 扩展

```typescript
interface RunLogEntry {
  // ... 现有字段
  /** 新增：门禁脚本 stdout 存档路径（gate/tla-gate/graph-gate 类动作必填） */
  gateLogPath?: string;
}
```

#### 6.3.3 GraphCheckResult 扩展

```typescript
interface GraphCheckResult {
  // ... 现有字段
  /** 新增：系统层级树 */
  systemLevelTree: {
    root: string;
    subsystems: string[];
    levels: number;
    orphanSubsystems: string[];
  };
  /** 新增：多层图谱校验 */
  layeredGraph: {
    structure: LayerCheckResult;
    dependency: LayerCheckResult;
    traceability: LayerCheckResult;
    dataflow: LayerCheckResult;
    governance: LayerCheckResult;
    collaboration: LayerCheckResult;
    derivation: LayerCheckResult;
  };
}
interface LayerCheckResult { passed: boolean; violations: string[]; }
```

#### 6.3.4 TlaCheckResult 扩展

```typescript
interface TlaCheckResult {
  // ... 现有字段
  /** 新增：SD 覆盖率校验 */
  coverageViolations: string[];
  /** 新增：cfg-tla 一致性违反 */
  cfgConsistencyViolations: string[];
  /** 新增：cfg 结构违反 */
  cfgStructureViolations: string[];
}
```

### 6.4 执行情况样例同步修正

| 产物 | 修正内容 | 对应缺陷 |
|------|---------|---------|
| budget.json | updatedAt 更新为阶段 3 时间；补 killSwitch 告警记录 | D1/D33 |
| run-log.jsonl | 补全 chunk/cross/gate/rework 记录；tokens 非零；gateLogPath 填写 | D13/D18 |
| maturity.json | unlockConditions.completedCycles=3；history 补 L0→L1 评估 | D13 |
| tla-manifest.json | jarPath 修正；checkRounds 补实际返工记录；consider-split 补理由 | D6 |
| verifier-output-phase1/2/3.json | 统一 varianceThreshold=0.05；phase3 agent 改为 design-reviewer；rawScores 重构（避免全同）；evidence 补路径+行号 | D3/D4/D12/D14 |
| consolidated.json | 拆为 consolidated-phase1/2/3.json 保留历史 | D5 |
| tla/L1_shell_agent.cfg | 补 INV4/INV7 | D25 |
| tla/L3_artifact_gate.cfg | 移除 MODULE 声明 | D26 |
| graph.json | 补 governs/collaborates-with/derives 边；移除 consumes 边 | D21 |
| 新增 gate-logs/ | 存档各阶段门禁脚本 stdout | D17 |

---

## 7. 测试策略

### 7.1 测试分层

| 层级 | 范围 | 工具 | 验证目标 |
|------|------|------|---------|
| 单元测试 | `*-logic.ts` 纯函数 | self-test.ts | 纯逻辑校验规则正确性 |
| 集成测试 | `check-*.ts` CLI + 样例 | self-test.ts（exitCode 断言） | CLI 退出码与 JSON 一致性 |
| 端到端测试 | 执行情况/ 完整样例 | self-test.ts + 手动校验 | 真实产物合规性 |
| 回归测试 | 全部现有样例 | self-test.ts | 37 现有基线不退化 |

### 7.2 新增样例清单（37 → 61）

**graph 层（+5）**：
- `bad-subsystem-orphan.json` — SD 无 parent 依附系统根
- `bad-parent-cycle.json` — parent 边成环导致零根
- `bad-governance-out-of-scope.json` — governs 源非治理类
- `bad-collaboration-asymmetric.json` — collaborates-with 单向
- `valid-multilayer.json` — 7 层图谱合规

**tla 层（+5）**：
- `bad-coverage-missing-sd.json` — SD 漏建 TLA+ 覆盖
- `bad-cfg-missing-invariant.json` — cfg 缺 INV4/INV7
- `bad-cfg-module-declaration.json` — cfg 含 MODULE 声明
- `bad-invariant-count-mismatch.json` — cfg/tla/checkpoint 三处不一致
- `valid-cfg-consistency.json` — cfg-tla 完全一致

**verifier 层（+3）**：
- `bad-rawscores-all-same.json` — rawScores 全同
- `bad-variance-mismatch.json` — variance 重算不一致
- `bad-perturbation-out-of-range.json` — ±0.05 扰动越界

**budget 层（+3，新目录）**：
- `valid.json` / `bad-stale.json` / `bad-killswitch-triggered.json`

**run-log 层（+4，新目录）**：
- `valid.jsonl` / `bad-incomplete.jsonl` / `bad-o-overreach.jsonl` / `bad-exitcode-mismatch.jsonl`

**maturity 层（+2，新目录）**：
- `valid.json` / `bad-stale.json`

**checkpoint 层（+2，新目录）**：
- `valid.jsonl` / `bad-empty-decisions.jsonl`

**合计**：37 + 24 = 61 样例

### 7.3 防退化回归

- 现有 37 样例不得修改退出码预期（除非该样例本身是 bug 修正，如 bad-orphan.json/bad-multi-root.json 修正后行为变化需同步更新预期）
- self-test 通过标准：61/61 全绿

---

## 8. 实施顺序

```
Phase A：SSoT 与 references 文档更新（规则先行）
  A1. SSoT §10.6/§10.8/§10E/§10.10/§10C/§10D 更新
  A2. verifier-spec.md（防漂移+V prompt+证据可追溯+跨阶段一致性）
  A3. tla-plus-guide.md / tla-plus-modeling-design.md（覆盖率+cfg 校验）
  A4. graph-guide.md（系统层级树+多层图谱+移除 consumes）
  A5. operational-recovery.md（CHECKPOINT+O 越权+三脚本约定）
  A6. anti-patterns.md（#10 强化）
  A7. data-models.md（EdgeType 扩展+RunLogEntry+RTM 演进）
  A8. ingestion-cross.md（快照历史+根树保持）

Phase B：scripts 纯逻辑修正（单点事实源）
  B1. verifier-logic.ts（防漂移 3 项）
  B2. tla-logic.ts（checkCoverage + checkCfgInvariants + checkCfgStructure）
  B3. graph-logic.ts（系统层级树 + 多层图谱 + 单根修正 + 移除 consumes）

Phase C：scripts CLI 修正与新增
  C1. check-requirement-graph.ts（exitCode 防伪 JSON 字段 + 多层图谱输出）
  C2. check-verifier-output.ts（接入防漂移）
  C3. check-tla-model.ts（--graph 入参 + cfg 校验 + 覆盖率校验）
  C4. check-budget.ts（新）
  C5. check-run-log.ts（新）
  C6. check-maturity.ts（新）
  C7. check-checkpoint.ts（新）

Phase D：samples 与 self-test
  D1. 新增 24 个 bad-*/valid-* 样例
  D2. 修正 bad-orphan.json + bad-multi-root.json
  D3. self-test.ts 扩展（基线 37 → 61）
  D4. 跑 self-test 验证 61/61

Phase E：执行情况同步修正
  E1. budget.json / run-log.jsonl / maturity.json
  E2. tla-manifest.json / tla/*.cfg
  E3. verifier-output-phase*.json
  E4. consolidated*.json + graph.json
  E5. 新增 gate-logs/
  E6. 跑全部 7 check-*.ts 验证执行情况合规

Phase F：SKILL.md / AGENTS.md
  F1. SKILL.md 约束更新（退出码不可伪+多层图谱+新脚本）
  F2. AGENTS.md 快速参考更新（self-test 基线 61）
```

### 8.1 验证检查点

| 检查点 | 验证内容 | 通过标准 |
|--------|---------|---------|
| CP1（Phase B 后） | 纯逻辑单元测试 | 新增纯函数对样例输入产出正确 violations |
| CP2（Phase C 后） | CLI 集成测试 | 各 check-*.ts 对 valid 样例 exitCode=0，对 bad 样例 exitCode=1 |
| CP3（Phase D 后） | self-test 全绿 | 61/61 通过 |
| CP4（Phase E 后） | 执行情况合规 | 全部 7 check-*.ts 对执行情况产物 exitCode=0 |
| CP5（Phase F 后） | 文档一致性 | SSoT/references/scripts/SKILL.md 交叉引用无矛盾 |

### 8.2 风险与缓解

| 风险 | 缓解 |
|------|------|
| graph-logic.ts 重构破坏现有 37 样例 | Phase B3 后立即跑现有 37 样例，退化则修正样例预期（仅 bad-orphan/bad-multi-root 允许改预期） |
| cfg-tla 一致性校验误报 | checkCfgInvariants 采用集合比较而非逐行匹配，容忍注释/空白差异 |
| 执行情况同步修正工作量大 | Phase E 可并行处理各产物（无依赖） |
| 新增 EdgeType 导致现有 graph.json 不兼容 | governs/collaborates-with/derives 为可选边类型，现有无这些边的 graph.json 仍合规 |

---

## 9. 修正计划 F1-F15 与缺陷映射

| 缺陷 | 修正动作 | 优先级 | 涉及文件 |
|------|---------|--------|---------|
| D17 | F11: 门禁结果防伪三层机制（JSON exitCode 字段 + gate-logs 存档 + run-log 交叉校验） | P0 | 各 check-*.ts, check-run-log.ts(新), SSoT §10E |
| D12+D16 | F9: verifier-logic.ts 实现防漂移（rawScores 全同/variance 重算/±0.05 扰动）；新增 3 samples | P0 | verifier-logic.ts, verifier-spec.md |
| D10+D7 | F7: tla-logic.ts checkCoverage + check-tla-model.ts --graph 入参；新增 samples | P0 | tla-logic.ts, check-tla-model.ts, tla-plus-guide.md |
| D25 | F12: tla-logic.ts checkCfgInvariantsConsistency；新增 samples | P0 | tla-logic.ts, check-tla-model.ts |
| D26+D27 | F13: tla-logic.ts checkCfgStructure；同步修正 执行情况 L3.cfg | P0 | tla-logic.ts, 执行情况/tla/L3_artifact_gate.cfg |
| D6+D33 | F3: 修正 执行情况 tla-manifest.json | P0 | 执行情况/.w-model/tla-manifest.json |
| D18 | F14: SKILL.md/anti-patterns.md 强化 #10；check-run-log.ts 检测 O 直接操作 | P0 | SKILL.md, anti-patterns.md, check-run-log.ts |
| D19 | F15: operational-recovery.md 强化 CHECKPOINT；新增 check-checkpoint.ts | P0 | operational-recovery.md, check-checkpoint.ts(新) |
| D1+D9+D13 | F1+F10: 新增 check-budget.ts + check-run-log.ts + check-maturity.ts；同步修正 执行情况 | P1 | 3 新脚本, self-test.ts, operational-recovery.md, data-models.md, 执行情况/.w-model/* |
| D31+D14+D15+D20 | F6: verifier-spec.md 防漂移+V prompt+证据可追溯+跨阶段一致性；同步修正 执行情况 verifier-output | P1 | verifier-spec.md, SSoT §10.6, 执行情况/verifier-output-*.json |
| D3+D4 | F4: 修正 执行情况 verifier-output phase2/phase3 | P1 | 执行情况/verifier-output-*.json, verifier-spec.md |
| D21 | F5: graph-guide.md 移除 consumes，graph-logic.ts 同步 | P1 | graph-guide.md, graph-logic.ts |
| D11 | F8: graph-logic.ts 系统层级树+多层图谱+单根修正 | P1 | graph-logic.ts, graph-guide.md, SSoT §10.10 |
| D22+D23 | F2: 测试设计门禁强化（后续阶段实施） | P1 | check-artifact-gate.ts, 执行情况/docs/* |
| D5 | F5 扩展: ingestion-cross.md 快照历史；同步修正 执行情况 consolidated.json | P2 | ingestion-cross.md, 执行情况/consolidated.json |
| D34 | F10 扩展: data-models.md RTM 字段阶段演进规则 | P2 | data-models.md |

---

## 10. 不在范围内

- frozen/DESIGN.md 的设计事实修正（不在本设计范围）
- 阶段 4-8 流程新增（阶段 1-3 修正后阶段 4-8 自然受益）
- BDD/OpenAPI 集成校验（D22/D23 测试覆盖问题留待后续阶段实施）
- LLM-based Verifier 集成（llm-verifier-integration-design.md 已有设计，本设计不涉及）

---

## 11. 验收标准

1. self-test 61/61 全绿
2. 执行情况全部 7 check-*.ts 对产物 exitCode=0
3. SSoT/references/scripts/SKILL.md 交叉引用无矛盾
4. graph-logic.ts 系统层级树 + 多层图谱校验通过 valid-multilayer.json
5. tla-logic.ts SD 覆盖率校验检出 bad-coverage-missing-sd.json
6. verifier-logic.ts 防漂移检出 bad-rawscores-all-same.json + bad-variance-mismatch.json
7. check-run-log.ts 检出 O 越权（bad-o-overreach.jsonl）+ exitCode 伪造（bad-exitcode-mismatch.jsonl）
8. check-checkpoint.ts 检出空决策放行（bad-empty-decisions.jsonl）
