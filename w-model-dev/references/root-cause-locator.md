# 根因定位者方法论指南（Root Cause Locator Guide）

> **定位**：R 子代理的可执行方法论指南，与 `agent-personas.md` 平级。
> **权威定义**：见 `docs/skill-design-document_SSoT.md` §6.4 R 角色定义节。
> **关联 spec**：`docs/superpowers/specs/2026-07-24-root-cause-locator-and-fixer-roles-design.md` §3 + §9
> **与 agent-personas.md 的关系**：agent-personas.md 定义 V 子代理的评审角色视角；本文件定义 R 子代理的诊断方法论。两者互补，R 不调用 Persona，Persona 不调用 R。

---

## 1. 根因分析方法库（4 种方法，按场景选用）

### 方法 1：5-Why 追溯（默认方法）

**适用**：单一缺陷的纵向根因追溯。

```
现象（V/G 的 reworkHint）
  └─ Why 1: 为什么出现？→ <直接原因>
       └─ Why 2: 为什么出现直接原因？→ <深层原因>
            └─ Why 3: ...
                 └─ Why N: 直到触及 <根因>
```

**终止条件**：触及「流程缺失 / 规格遗漏 / 设计缺陷 / 上游产物缺陷」之一，或达到 5 层。

### 方法 2：鱼骨图分析（多因素缺陷）

**适用**：一个 reworkHint 涉及多因素。

**维度（适配 W 模型）**：
- **需求维度**：需求规格是否清晰/完整/无歧义？
- **设计维度**：设计是否覆盖需求/接口明确/状态机完整？
- **编码维度**：代码是否遵循设计/边界处理/错误路径覆盖？
- **测试维度**：测试是否覆盖该路径/用例正确？
- **流程维度**：阶段门是否跳过/ingestion 是否遗漏/TLA+ 是否建模？
- **工具维度**：门禁脚本是否漏检/Schema 是否缺失校验？

**产出**：每个维度的「是/否/部分」+ 证据 + 主因标记。

### 方法 3：缺陷链追溯（跨产物传播）

**适用**：缺陷在多个产物间传播。

```
需求规格 ──缺陷──► 系统设计 ──继承──► 详细设计 ──实现──► 代码 ──漏测──► 测试
   ↑                      ↑                    ↑              ↑            ↑
  根因                  传播                  传播           表现         未拦截
```

**产出**：缺陷链节点列表 + 每节点「引入/传播/表现/未拦截」标签 + 根因节点标记。

### 方法 4：上游回溯（跨阶段根因）

**适用**：R 在当前阶段产物中找不到根因，怀疑根因在上游阶段。

**约束**：R 仅标记 `upstreamDefect`，不修改上游产物。`upstreamDefect` 经 V 复审通过后，编排者可触发阶段回退（见 spec §6.5 场景 5）。

---

## 2. 方法选择规则

| reworkHint 特征 | 选用方法 |
|---|---|
| 单一明确缺陷（如 null 指针） | 5-Why |
| 多因素复合缺陷 | 鱼骨图 |
| 缺陷在多产物间传播 | 缺陷链追溯 |
| 当前阶段产物无明显缺陷但 V/G 不通过 | 上游回溯 |
| 复杂场景 | 组合（先鱼骨图定位维度，再 5-Why 纵向追溯） |

---

## 2.5 复现测试强制

> 吸收自《重构 2》ch4.7：每当你收到 bug 报告，请先写一个单元测试来暴露这个 bug；仅当测试通过才视为 bug 修完。

- **R 报告须附复现测试要求**：R 产出 RootCauseReport 时，须在修复建议中明确要求"先写复现测试再修复"。
- **S-fix 执行顺序**：S-fix 先写复现 bug 的失败测试 → 确认红 → 修复 → 确认绿（与 TDD 技能"测试构筑四则"第 1 条一致）。
- **覆盖空洞是根因线索**（Clean-Code ch16 T7）：测试覆盖空洞/死分支往往是根因位置（如"变量恒为负导致 if 永不执行"）——R 分析时把覆盖报告作为输入之一。

---

## 2.6 ≥3 次修复失败：架构判据

> 思想来源：`systematic-debugging` 技能的「Question Architecture」判据（台账 S14：`docs/superpowers/sources/2026-09-14-superpowers-adopted-excerpts.md:513-548`，对应上游 `skills/systematic-debugging/SKILL.md:191-212`）。本节为 W 模型侧改写，不复制上游的轮次清单。

**触发门槛**：同一问题连续 **≥3 次**修复失败（计数依据 = run-log 既有返工记录：`round` 字段与 `reworkHints` 条目，不新增字段；`metrics-report.ts` 的 `rework.maxConsecutiveRuns` 可作只读旁证）。此时**不得**在无架构讨论的情况下继续尝试第 4 次修复（"DON'T attempt Fix #4 without architectural discussion"）。

**三条技术判据**（同一判据的三个观察面；出现越多，架构判定越确定，但每一条出现过的都必须在架构讨论中正面回答）：

| # | 判据 | 说明 |
|---|---|---|
| 1 | 每次修复都暴露**新的**共享状态 / 耦合 / 别处的问题 | 新暴露的位置与上一轮修复位置**不同**——症状在游走，说明被修的从来不是同一个结构 |
| 2 | 修复需要「大规模重构」才能实施 | 局部补丁无法落地，动一处必须先动多处结构 |
| 3 | 每次修复在别处产生新症状 | 修复的收益被新引入的问题抵消（净收敛为负） |

**结论**：命中上述判据时，**这不是假设失败，是架构错误**（"This is NOT a failed hypothesis - this is a wrong architecture."）。处置 = **停下**，与用户做**架构讨论**，先回答三个问题：

- 这个模式（pattern）从根本上是否成立？
- 我们是否只是在「靠惯性硬撑」（sticking with it through sheer inertia）？
- 应当重构架构，还是继续修症状（refactor architecture vs. continue fixing symptoms）？

**与 `maxReworkRounds` 的关系**：本节只给出「提前停手」的技术判据，**不改变**既有的 `maxReworkRounds` 轮次上限机制（见 §4.1 的多角度强制）——判据命中时应在轮次用尽**之前**就转入架构讨论，而不是把轮次耗完。

**与 R 既有入口的分工**（不冲突、不替代）：

| 既有入口 | 它管什么 | 与本节的分工 |
|---|---|---|
| §2.5 复现测试强制 | **单次**修复的正确性纪律（先红后绿） | 每一轮修复可以各自过红绿，却在**跨轮次模式**上继续暴露新的共享状态 / 耦合 / 别处症状；§2.5 管一轮，本节管多轮分布——复现测试通过**不**等于本节判据不触发 |
| §8 辩解义务强制 | **每次**修复附决策记录（根因 / 所选修法 / 放弃备选） | 判据命中时义务升级：从「再写一条修复理由」转为「写出架构层面的结论并交人类讨论」；§8 的逐次记录义务不消失，只是不再接受以第 4 条修复理由代替架构讨论 |

**产出与处置**：命中时 R 仍须产出完整的 RootCauseReport（R2-R5 门禁判据一概不变；本节不新增 Schema 字段、零脚本影响），差别在内容指向——`rootCauseChain` 与 `prevention` 须显式写出**架构层面**的结论及三条判据的命中情况，`fixRecommendation` 指向**架构层动作**（重构该结构 / 拆分共享状态 / 重划边界），而不是为第 4 次症状再写一条补丁建议。架构问题属人类裁决点：R 只报出，V 复审与 G 门禁照既有链处理，编排者只转达与记录（越权自行裁决命中反模式 #10）。

---

## 2.7 R 入场门（M05）

> 思想来源：`diagnosing-bugs` 技能的入场纪律（台账 M05：`docs/superpowers/specs/2026-09-14-external-repo-capability-survey.md:189`，Instrumentation 边界同台账 :204；对应上游 `skills/engineering/diagnosing-bugs/SKILL.md:53-66,88-96`）。本节为 W 模型侧改写：入场门约束 R 的假设阶段，红信号的构造与运行属 S（§2.8），两者不得合并（角色越界命中反模式 #18）。

**适用位置**：V/G 失败后 R 按普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）接手；本门是 R 展开假设（§1 方法库）**之前**的入场条件——先有红信号，再有假设。

**入场判据（五件套，全部满足才准入）**：R 进入假设阶段前，必须能命名**一条命令**（脚本路径 / 测试调用 / curl），它就是本 bug 的红信号，且满足：

| # | 判据 | 说明 |
|---|---|---|
| 1 | 已真实跑过 | 该命令已至少真实执行一次，R 报告附调用与脱敏输出；「我能想象它会红」不算 |
| 2 | 断言用户确切症状（red-capable） | 驱动真实 bug 代码路径并断言用户报告的确切症状——对本 bug 能变红、修复后能变绿；「运行不报错」不是红信号 |
| 3 | deterministic | 每次运行同一判定；非确定性 bug 取钉住的高复现率版本（复现率判据见 §2.8） |
| 4 | fast | 秒级而非分钟级 |
| 5 | agent-runnable | 可无人值守运行；人仅经结构化 HITL 脚本参与（§2.8 方法 10） |

**红得起之前禁进假设（反锚定）**：上述命令存在并达标之前，**禁止**进入假设阶段；若发现自己在「读代码以构建理论」，立即停——直接跳到假设正是本门要防的失败（上游原话："No red-capable command, no Phase 2"）。此时 R 的正确动作是把构造红信号作为前置任务交 S 按 §2.8 清单推进。

**红信号就位后：3–5 条排序可证伪假设**：假设阶段开始时先产出 **3–5 条排序假设**，再逐条验证——单假设生成会锚定在第一个看似合理的想法上。每条假设必须**可证伪**：陈述它做出的预测，格式＝「若 X 是因，则改 Y 让 bug 消失 / 改 Z 更糟」。说不出预测的假设是 vibe：丢弃或锐化后再入列。排序假设与各自的预测/验证结果是 §3 质量标准第 1 条（根因可证伪）的入口前置。

**造不出红信号：停下置 blocked 三选一**：按 §2.8 十种方法走到底仍造不出达标红信号时，R **不得**无红信号进入假设，必须显式停下：列出已尝试的方法与各自卡点，向用户要三选一，并在报告中置 blocked（CHECKPOINT 等待用户裁决，不可绕过）：

- (a) 可复现环境的访问权；
- (b) 脱敏的捕获 artifact（HAR / 日志转储 / core dump / 带时间戳的录屏）；
- (c) 临时生产插桩的许可。

**Instrumentation 边界（台账 :204）**：W 模型无自由插桩授权位——即便用户选 (c)，插桩写入也属目标资产变更，须路由到既有 phase 5-8 由 S 按 codegraph 约束实施（约束 #14），R 不自行插桩。

**与 §2.5 的划界**：§2.5 管**修复侧**（R 报告须附复现测试要求、S-fix 先红后绿证明修完）；本节管**入场侧**（进入假设之前必须已有能对本 bug 变红的命令）。入场红信号用于定位，修复复现测试用于证明修完——两者常是同一条命令，但两项义务独立成立。

---

## 2.8 S 侧 loop 构造方法清单（M17）

> 思想来源：`diagnosing-bugs` 技能的 loop 构造清单（台账 M17：`docs/superpowers/specs/2026-09-14-external-repo-capability-survey.md:201`；对应上游 `skills/engineering/diagnosing-bugs/SKILL.md:24-35,49-51`）。台账 M17 缺口列原话：M05 入场门要求红信号，但未给 S 构造信号的方法清单——本节补齐。

**执行者与顺序**：清单由 **S** 执行（编排者分派，R 消费其产出）。十种方法**按序尝试**：从可自动化、确定性高的形态开始，越往后成本越高、人工参与越多；每个方法的尝试形态与卡点要记录，作为 §2.7 blocked 三选一的「已尝试清单」输入。

| 序 | 方法 | 要点 |
|---|---|---|
| 1 | failing test | 在最能触及 bug 的 seam 构造能对本 bug 变红的测试：单元 / 集成 / e2e |
| 2 | curl / HTTP 脚本 | 对运行中的 dev server 直接发起请求 |
| 3 | CLI + fixture diff | 用 fixture 输入调用 CLI，stdout 对比 known-good 快照 |
| 4 | headless browser | Playwright / Puppeteer 驱动 UI，断言 DOM / console / network |
| 5 | replay trace | 真实网络请求 / payload / 事件日志落盘，隔离重放经过代码路径 |
| 6 | throwaway harness | 拉起最小系统子集（单服务 + mock 依赖），以单函数调用驱动 bug 代码路径 |
| 7 | property / fuzz | 「有时输出不对」型 bug：跑大量随机输入寻找出错模式 |
| 8 | bisection | bug 出现在两已知状态（commit / 数据集 / 版本）之间时，自动化「在状态 X 启动 → 检查 → 重复」以接入 `git bisect run` |
| 9 | differential | 同一输入分别过旧版与新版（或两份配置），diff 输出 |
| 10 | HITL 兜底 | 最后手段：确需人操作 UI 时，用结构化脚本驱动人并回传捕获输出，loop 仍有结构 |

**判据句（非确定性 bug）**：目标**不是干净复现，而是提高复现率**——循环触发 100×、并行、加压、收窄时序窗、注入 sleep；50% flake 可调试，1% 不可，持续抬高复现率直到可调试。此处「注入 sleep」服务于复现率，与 `concurrency-guide.md` 条件等待三要素（S22）规范的生产代码等待是两种用途，不得互相援引。

**产出去向**：达标红信号（§2.7 五件套）即 R 的入场输入；探索性脚本与 harness 不构成产物门禁对象，若需保留按既有状态纪律登记，不形成平行事实源。

---

## 2.9 「无根因」合法出口（S13）

> 思想来源：`systematic-debugging` 技能的「When Process Reveals "No Root Cause"」（台账 S13：`docs/superpowers/specs/2026-09-14-superpowers-capability-survey.md:166`；对应上游 `skills/systematic-debugging/SKILL.md:266-275`）。本节为 W 模型侧改写；门禁侧由 `rootcause-report.schema.json` 的 `noRootCause` 分支与 root-cause-logic 校验承载（S13 代码侧；规格 :305 硬约束「S13 不放松 R2/R3」）。

**缺口背景（台账 S13 缺口列）**：R2 强制单链 [2,5]、R3 强制「若…则…」可证伪——对真环境型 / 时序型 / 外部型现象，常规报告没有合法分支，会**诱发编造根因链**。本出口给这三类现象一条显式、受门禁约束的路，而不是放松既有判据。

**三形态（kind）**：

| kind | 含义 | 典型形态 |
|---|---|---|
| environmental | 真环境现象 | 仅在特定环境配置 / 数据规模 / 基础设施状态下出现 |
| timing | 时序现象 | 竞态 / 超时窗口 / 调度顺序依赖；复现率抬升后归因仍落在时序结构本身 |
| external | 外部依赖现象 | 第三方服务 / 网络 / 平台行为，超出本仓控制面 |

**合法出口的四项义务（缺一不可）**：

1. **走完流程**：§1 方法库、§2.7 入场门、§2.8 十种方法全部走到「确无根因可归」的结论点——出口是调查完成后的结论，不是调查中途的放弃；
2. **记录调查**（investigation，非空）：查了什么、排除了什么、每步的证据；「没找到」不等于「查完了」；
3. **落实缓解**（mitigation，非空）：按现象形态实现重试 / 超时 / 明确错误提示，由 S 按既有修复链实施；
4. **加监控/日志**：为未来调查留下证据面——同类现象再现时可升级为可复现并重走本指南全流程。

**「95%」警示（上游原话保留）**：**95% 的「无根因」是调查不完整**。宣告前 R 必须对照此句自检：§2.8 十种方法是否走到底？复现率是否已抬到可调试档？三形态归类是否有证据支撑？任一问不通过，就回到 §2.7/§2.8 继续调查，不得宣告出口。

**R2/R3 不放松声明（规格 :305 硬约束）**：本出口是**新增显式分支**，不放松任何既有判据——R2（单链 [2,5]）与 R3（「若…则…」可证伪）对常规 RootCauseReport 一字不改；`noRootCause` 分支存在时 investigation 与 mitigation 必填非空，滥用形态（**无调查记录宣告无根因**）必须被拒；既有字段按 schema 条件豁免而非删除，豁免仅对三形态且义务完整的报告生效。

**与 §2.5 / §2.6 / §2.8 的分工**：§2.5 管有根因后的修复侧复现纪律；§2.6 管多轮修复后的架构判据；§2.8 十种方法是「走完流程」义务（上方第 1 条）的执行清单——走到底仍无根因可归，才进入本出口；本节管调查走完后「确无根因可归」的合法出口。四者不互相替代：本出口**不豁免** §2.6 的架构讨论义务（≥3 次命中判据仍须先架构讨论），也不替代 §2.5 的修复证明；noRootCause 报告仍是一份 RootCauseReport，V 复审与 G 门禁（`check-rootcause-report.ts` exit 0）照常执行，跳过普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节）直接返工命中反模式 #18/#19。

**出口的下游不变**：出口获准后，mitigation 的实现与监控落地由 S 承担（走既有修复链）；编排者只转达与记录（越权自行裁决命中反模式 #10）。

---

## 3. R 产出质量标准

1. **根因必须可证伪**：每条根因须附「若根因消除，现象是否消失」的可验证假设。
2. **禁止现象当根因**：「代码写错了」是现象不是根因；「需求规格未规定 null 处理，编码默认不检查」才是根因。
3. **fixRecommendation 必须针对根因**：禁止「建议修复代码」泛化建议；须指明「修改 `<文件>:<行>` 的 `<具体内容>`，因为 `<根因>`」。
4. **prevention 必须可执行**：禁止「加强评审」泛化建议；须指明「在 `<phase-N>` 的 `<检查项>` 中增加 `<具体检查>`」。
5. **upstreamDefect 必须附证据**：标记上游缺陷须引用上游产物的具体段落/行号/节点 ID。

---

## 4. 多人格多角度分析机制

> **本机制的本质是「多角度」，不是「并行」。** 并行只是性能优化，串行同样合法。详见 spec §9.2。

### 4.1 核心原则

在强制多角度场景（Critical/Required 缺陷的 R 定位、根因报告 V 复审、maxReworkRounds 最后一轮）下，R-lead / V-lead **必须**加载 N 个不同 persona，从 N 个不同视角产出 N 份 PartialReport 并聚合——**不论这 N 个 persona 是同时分派（并行）还是依次分派（串行）**。

### 4.2 分派方式选择

| 宿主 Agent 能力 | 分派方式 | 说明 |
|---|---|---|
| 支持并行子代理 | **并行分派**（推荐） | N 个 R-persona 同时执行，R-lead 收齐 N 份后聚合 |
| 仅支持串行子代理 | **串行分派**（合法等价） | R-lead 依次分派 N 个 R-persona，每个产出后收集，N 份齐后聚合 |
| 单会话无子代理 | **单 R-lead 多轮切换 persona**（降级） | R-lead 自身多轮加载不同 persona |

**关键约束（三种方式均强制）**：
1. N 份 PartialReport 必须独立产出
2. 聚合规则不变（见 spec §9.6）
3. PartialReport 归档不变（`.w-model/rootcause/partial/<reportId>/<personaSlice>.json`）
4. run-log 记录不变（每份 PartialReport 各记一条 `rootcause` 动作）

### 4.3 persona 选择矩阵

详见 [agent-personas.md](agent-personas.md)。

### 4.4 R-lead 聚合规则

1. **根因收敛**：≥⌈N×0.6⌉ 个 persona 收敛到同一根因 → 采纳
2. **分歧仲裁**：根因分散时，R-lead 须记录分歧 + 选择主根因 + 标注 minority 视角
3. **证据合并**：合并所有 persona 的 evidence，去重
4. **fixRecommendation 合并**：按根因收敛度排序
5. **upstreamDefect 仲裁**：任一 persona 标记则 R-lead 须复核
6. **reality-check 硬约束**：规范 persona 为 `testing-reality-checker`，其 confidence < 0.5 → 最终 `passed=false`；为兼容已有合法归档，`reality-checker` 仅在 canonical 缺失时作 legacy fallback。若两者同时出现，canonical 优先且同 artifact 不重复计数；跨 artifact 或异常重复/冲突由 R10 fail-closed。

R10 维护契约：
<r10-contract id="canonical-name" relation='{"canonicalPersona":"testing-reality-checker"}'>canonical persona is testing-reality-checker</r10-contract>
<r10-contract id="threshold" relation='{"canonicalPersona":"testing-reality-checker","confidenceMinimum":0.5}'>testing-reality-checker confidence >= 0.5</r10-contract>
<r10-contract id="legacy-fallback" relation='{"legacyPersona":"reality-checker","fallbackWhen":"canonical-absent"}'>legacy reality-checker is fallback only when canonical is absent</r10-contract>
<r10-contract id="same-artifact-dedupe" relation='{"artifactRelation":"same","precedence":"canonical-first","duplicateCount":"once"}'>same artifact canonical-first and not counted twice</r10-contract>
<r10-contract id="cross-artifact-conflict" relation='{"artifactRelation":"different","conflict":"fail-closed"}'>different artifact conflict is fail-closed</r10-contract>
<r10-contract id="canonical-duplicate" relation='{"persona":"canonical","duplicateThreshold":1,"duplicatePolicy":"fail-closed"}'>canonical > 1 duplicate is fail-closed</r10-contract>
<r10-contract id="legacy-duplicate" relation='{"persona":"legacy","duplicateThreshold":1,"duplicatePolicy":"fail-closed"}'>legacy > 1 duplicate is fail-closed</r10-contract>

---

## 5. 与 systematic-debugging 技能的关系

本方法论吸收 `systematic-debugging` 技能的 `root-cause-tracing.md` 原则，但适配 W 模型：
- systematic-debugging 面向「运行时 bug 调试」
- 本方法论面向「W 模型阶段产物缺陷诊断」
- 两者共享「根因优先于症状」「可证伪假设」「缺陷链追溯」原则
- M05 / M17（本文件 §2.7 / §2.8）吸收自同族 `diagnosing-bugs` 技能（外部仓库能力盘点台账 M05 :189 / M17 :201 / 边界 :204，`docs/superpowers/specs/2026-09-14-external-repo-capability-survey.md`）：入场门与 loop 清单同样内化「根因优先于症状」——先红信号、后假设，且红信号构造（S）与根因定位（R）分角色
- S13（本文件 §2.9）吸收自该技能 `SKILL.md:266-275` 的「无根因」合法出口（superpowers 能力盘点台账 :166，`docs/superpowers/specs/2026-09-14-superpowers-capability-survey.md`）：为真环境 / 时序 / 外部现象提供显式出口，以调查记录与缓解义务约束之；W 模型侧 R2/R3 判据不放松

---

## 6. 分派模板

详见 [subagent-delegation.md](subagent-delegation.md)「R 子代理分派模板」节与「R-lead 子代理分派模板（多角度变体）」节。

---

## 7. R 与 R-iceberg 的边界

冰山扫掠机制新增 R-iceberg 变体（见 [iceberg-sweep-guide.md](iceberg-sweep-guide.md)）。本节点明 R 与 R-iceberg 的职责边界，避免误用：

| 属性 | 返工R（根因定位） | R-iceberg（冰山扫掠） |
|---|---|---|
| 触发时机 | V/G 不通过后触发 | S-fix 后（ICEBERG-A）+ 阶段门前（ICEBERG-B） |
| 目的 | 被动定位**已暴露**问题的根因 | 主动深挖**未暴露**的隐藏问题（找"水面之下"） |
| 输入线索 | 单条 V/G reworkHints + 失败产物 | reworkHints 历史 + fixedPoints + previousFindings（全量线索） |
| 产出 | RootCauseReport（单问题根因链） | IcebergSweepReport（多发现扫掠报告） |
| schema | rootcause-report.schema.json | iceberg-sweep.schema.json |
| 下游 | S-fix 携 R 报告修复后重走 R3×3 / 预防审查 / V / G / CHECKPOINT | V 复审报告 → 每个有效发现走完整 R 报告复审、根因门禁、S-fix 后 R3×3 / 预防审查 / V / G / CHECKPOINT |
| 方法论 | 根因分析方法库（5-Why / 鱼骨图 / 缺陷链 / 上游回溯） | 冰山扫掠方法（三维度×六类别，线索驱动横向扩散） |

**关键边界**：
- **不互相替代**：R 用于"已暴露问题"的根因追溯；R-iceberg 用于"同类/同根因"的横向扩散深挖。R-iceberg 发现的新问题仍走完整 R 报告复审、根因门禁、S-fix 后 R3×3/预防审查/V/G/CHECKPOINT 链（R-iceberg 不直接触发 S-fix，须经 V 复审）。
- **R-iceberg 可复用根因分析方法**：提取 fixedPoint 关联 RootCauseReport 的根因类别（如"状态守卫不完整"），作为 same-root-cause-spread 类别的深挖方向（见 iceberg-sweep-guide.md §4 类别 1 示例）。
- **R 不含冰山职责**：V/G 不通过后的根因定位仍由返工 R 执行，不得由 R-iceberg 替代（命中反模式 #18/#19）。
- **跨阶段边界一致**：R 与 R-iceberg 均仅定位当前阶段产物，上游回溯仅标记不修改。

## 8. 辩解义务强制

> 吸收自《agent 时代的人月神话》第 11 章：agent 被训练成"简洁完成任务"，没有内在动机承担辩解义务——把辩解义务做进结构，让不辩解比辩解更麻烦。

- **"已修复"不可接受**：每个 bug 修复必须附一条决策记录（三行：根因 / 所选修法 / 放弃备选）。
- **大改动附自述**：每个大改动必须附一段"这里发生了什么"的自述。
- **会话收尾总结**：每个 agent 会话结束时留一份"这次会话学到了什么"的简短总结。
- **机制价值**：同一 agent 在"只需要说已修复"和"必须解释为什么这样修"两种约束下的表现质量差别很大。
