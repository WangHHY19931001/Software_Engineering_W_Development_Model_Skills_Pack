# 第二十六轮（2026-07-30）外部技能设计实践吸收设计规格

> **创建日期**：2026-07-30
> **轮次**：Round 26
> **触发原因**：用户要求深度对比外部参考仓库（`skills/`，Matt Pocock "Skills For Real Engineers"）与本仓库 W-Model skill pack，找出可借鉴增强点
> **修正范围**：5 项高价值借鉴点（verifier 单轴下限（阈值 0.70）/ Fowler 12 气味基线 / GLOSSARY 术语治理 / No-op-Negation 元理论审计 / Agent Brief durability）；全部为低风险文档 + 1 项高风险 verifier 逻辑增强；新增反模式 #41（加权平均掩盖单轴失败，直接转正）
> **执行模式**：待定（spec 评审后由用户选择 Subagent-Driven / Inline）
> **版本变更**：24.0.0 → 25.0.0

---

## 一、背景

### 1.1 触发缘由

用户要求将本仓库与外部参考仓库 `skills/`（Matt Pocock，*Skills For Real Engineers*）做深度对比，识别可借鉴增强点。经全量精读（6 分桶：plugin / ADR / .out-of-scope / changeset / CI / scripts + 写作元理论、triage、code-review 双轴、domain-modeling、prototype、codebase-design、implement 系列、issue-tracker-local、.agents/adr），得出三层次对比结论：

1. **本质差异**：外部仓库是「元层方法论」仓库，本仓库缺的正是 skill-writing 元理论层（No-op / Negation / Predictability / 信息层级阶梯）。
2. **高价值借鉴**：5 项（见 §三）。
3. **反向借鉴**：W-Model 在 6 个维度优于外部（确定性门禁 exit code / 签名链产出来源 / budget-kill-switch / 成熟度阶梯 / 191 条 self-test 回归基线 / 三处版本号同步），无需改动。

### 1.2 设计目标

- 修复 V 评审「加权平均掩盖单轴失败」的合并缺陷（对应外部 code-review 双轴报告永不合并原则）
- 为代码评审提供与 LLM 漂移解耦的固定气味基线（Fowler 12）
- 治理技能包术语同义异写问题（GLOSSARY + `_Avoid_` 指令）
- 审计 SKILL.md 否定式指令（Negation），补正向行为 + 脚本强制不变式
- 强化 S-tickets 票据内容契约的 durability（符号级契约而非文件路径/行号）

---

## 二、调研结论（外部仓库元理论）

### 2.1 外部仓库与本仓库的定位差异

| 维度 | 外部 `skills/` | 本仓库 W-Model |
|---|---|---|
| 定位 | 元层方法论（如何写 skill） | 流程硬化编排（大规模 8 阶段 + ~40 门禁） |
| 门禁 | 无门禁，可 hack | 40 条反模式 + 191 条 self-test 基线 |
| 元理论 | No-op / Negation / Predictability / 信息层级阶梯 | 缺失该层（散落在各轮次教训中） |
| 代码评审 | 双轴报告永不合并 | 5 子标准加权平均单轴可被掩盖 |

### 2.2 高价值借鉴点来源映射

| # | 借鉴点 | 外部来源 | 本仓库现状 |
|---|---|---|---|
| 1 | 双轴评审永不合并 → verifier 单轴下限 | `code-review/SKILL.md`（code quality / readability 独立报告不合并） | verifier-spec §6.3 `passed = (A\|\|B)` 仅看 compositeScore 加权平均，单轴 D 级可被高分掩盖（已核实 verifier-logic.ts:541） |
| 2 | Fowler 12 气味固定基线 | `code-review/SKILL.md`（固定 12 种坏味道基线） | `engineering-code-reviewer.md` 审查清单无固定基线，评审标准随 LLM 漂移 |
| 3 | GLOSSARY + `_Avoid_` 术语治理 | `domain-modeling/CONTEXT-FORMAT.md` | 无 glossary；mappingType「直接/等价/替代」、targetKind 枚举、codeModule 格式等术语散落多文档，第 15 轮曾因 checkRounds 语义混淆出 bug |
| 4 | No-op / Negation 元理论审计 | `writing-great-skills/GLOSSARY.md` | SKILL.md 角色表「关键禁止」列为纯否定式指令，无正向替代动作 |
| 5 | Agent Brief durability | `implement-*/SKILL.md`（只写接口/类型/行为契约） | phase-5-coding.md 票据内容契约未禁止文件路径/行号引用，重构后票据即失效 |

---

## 三、设计：5 项借鉴点（每项含 bounded edit 边界）

> 遵循 [skillopt-adoption.md](../../w-model-dev/references/skillopt-adoption.md) bounded edit 边界规则：单文件单次 edit ≤3 处、单信号 ≤2 文件、全轮总 edit ≤15 处。

### 3.1 借鉴点 1：verifier 单轴下限（高风险，E2 批）

**外部原则**：code-review 双轴报告永不合并——两轴独立报告，任一轴不通过即打回，禁止用另一轴高分掩盖。

**现状核实**：
- `verifier-spec.md` §6.3（第 461 行）：`passed = (qualityLevel === 'A' || qualityLevel === 'B')`，即综合分数 ≥ 0.70 通过。
- `verifier-logic.ts:541`：`const expectedPassed = qualityLevel === 'A' || qualityLevel === 'B';`——**无任何单子标准下限逻辑**。5 子标准加权平均下，某子标准 D 级（如 completeness=0.2）可被其余高分拉至 ≥0.70 放行。

**设计**：新增**单轴下限规则（R13）**（2026-07-30 用户决策：阈值收紧至 0.70）：
- `passed = (qualityLevel === 'A' || qualityLevel === 'B') && 所有 subCriterion.score >= 0.70`
- 阈值 0.70 = qualityLevel **B 级分界**（`>= 0.70 → B`，§6.1）。语义自洽：`passed` 原判据是「加权平均 ≥ B」；单轴下限收紧为「**每个子标准自身 ≥ B**」。任一子标准低于 B 级 = 该维度不达标，即使被其余高分拉过加权平均线也不放行。
- 校验逻辑新增 violation 消息格式：`子标准 <name> 得分 <score> < 0.70（单轴下限）`。
- 与既有规则的关系：不改变 §3.2 重复评估/方差防漂移、§6.1 qualityLevel 映射；仅收紧 `passed` 判定。**qualityLevel 本身不变**（仍反映 compositeScore 映射），仅 `passed` 增加单轴条件——避免破坏既有样本的 qualityLevel 语义。

**bounded edit 边界**（信号 1，≤2 文件）：

| 文件 | 改动 | 处数 |
|---|---|---|
| `w-model-dev/references/verifier-spec.md` | §6.3 通过判定改写 + §3.3 标准分解补单轴下限说明 | 2 |
| `w-model-dev/scripts/verifier-logic.ts` | `expectedPassed` 计算增加单轴条件 + 汇总 violation | 1-2 |

**支撑资产**（随信号 1，不计入信号边界但须同步）：
- `w-model-dev/scripts/samples/verifier/bad-single-axis-low.json`（新增：completeness=0.65，其余 0.95 → compositeScore=0.86 达 A 级，但单轴 <0.70 → passed 应为 false）
- `w-model-dev/scripts/__tests__/verifier-logic.test.ts`（+2 用例：单轴低分失败 / 单轴全合格通过）
- `w-model-dev/scripts/self-test.ts`（+1 bad fixture 注册）
- `w-model-dev/scripts/samples/verifier/valid.json`（检查现有样本是否全部子标准 ≥0.70，必要时调整）

### 3.2 借鉴点 2：Fowler 12 气味固定基线（低风险，E1 批）

**外部原则**：code-review SKILL.md 内嵌固定 12 种代码坏味道基线，评审标准锚定知名清单，与 LLM 漂移解耦。

**现状**：`w-model-dev/subagent/engineering-code-reviewer.md` 审查清单按 🔴/🟡/💭 分级，但无固定基线——每次评审 V 子代理对「什么叫坏味道」的标准随模型漂移。

**设计**：在 `engineering-code-reviewer.md` 新增「📌 Fowler 12 坏味道固定基线」节：
- 固定 12 种（取自《Refactoring: Improving the Design of Existing Code》Martin Fowler 的 22 种坏味道中，与 AI 生成代码场景最相关的 12 种），见下节详细清单
- 每种给定义 + 检测信号 + 🔴/🟡/💭 分级映射
- 约束：评审报告命中气味须引用该基线条目名（如「命中 Fowler-01 重复代码」），不得用自造术语

#### Fowler 12 详细清单（写入 engineering-code-reviewer.md）

> 分级约定：🔴 阻塞项（影响正确性/安全/契约）· 🟡 建议项（影响可维护性）· 💭 小改进（风格/可选）。

| 编号 | 中文名 | 英文原名 | 定义 | 检测信号 | AI 生成代码高频场景 | 默认分级 |
|---|---|---|---|---|---|---|
| F-01 | 重复代码 | Duplicated Code | 相同/高度相似的代码块出现在两处及以上，改动需多处同步 | 同一逻辑在不同文件/函数中重复，仅变量名不同；复制粘贴痕迹 | LLM 常为新需求重新生成相似实现而非复用既有模块（service/store 层多处相似 CRUD） | 🟡（≥3 处复制 → 🔴） |
| F-02 | 过长方法 | Long Method | 单方法承担过多职责，行数过长，难以理解与测试 | 方法 >30 行；多个缩进层级；用注释分隔不同逻辑段 | LLM 倾向把端到端流程（校验+业务+持久化）塞进单个 handler/service 方法 | 🟡（>50 行或多职责 → 🔴） |
| F-03 | 过大类 | Large Class | 一个类承担多个不相关职责，字段/方法膨胀，违背单一职责 | 字段 >10 个；方法 >15 个；类实际管理多个领域概念 | LLM 把相似领域对象合并成一个大类（一个 store 管 user+article+comment） | 🟡（>3 概念 → 🔴） |
| F-04 | 过长参数表 | Long Parameter List | 方法参数过多，调用难读、易传错序 | 参数 >4 个；相邻参数类型相同易互换 | LLM 把所有输入全列成参数而非提取参数对象 | 🟡 |
| F-05 | 特征依恋 | Feature Envy | 方法更频繁使用其他对象的数据而非自身，逻辑放错了归属类 | A 类方法大量调用 B 的 getter/字段计算，且不依赖自身状态 | LLM 把校验/计算逻辑放 Controller/Service 而非归属的领域对象；若跨模块则命中反模式 #23 | 🟡（跨模块耦合 → 🔴） |
| F-06 | 数据泥团 | Data Clumps | 同一组字段成组反复出现（坐标三元组 / start+end / 联系信息组） | 3+ 字段在多个参数表/对象中重复成组 | LLM 多处重复声明同一组参数而非提取值对象 | 💭（组≥3 字段且≥3 处 → 🟡） |
| F-07 | 基本类型偏执 | Primitive Obsession | 用基本类型（string/number/boolean）表达本应是领域对象/枚举的概念 | 魔法字符串常量散布；用 string 表达状态 | LLM 用 `status:'active'` 式字符串表达状态而非枚举/状态机——与 TLA+ 状态机建模冲突 | 🟡（与 TLA+ 状态机不一致 → 🔴） |
| F-08 | Switch 语句 | Switch Statements | 用 switch/if-else 链按类型分派，新增类型须改多处 | `switch(type)` 或长 if-else 链按同一字段分派 ≥3 分支 | LLM 为多角色/多类型写分支链而非多态/策略 | 🟡 |
| F-09 | 懒惰类 | Lazy Class | 类职责不足以支撑存在，仅占位 | 类仅 1-2 个方法或纯 wrapper，无独立状态 | LLM 为每个需求生成空壳类但无独立行为 | 💭 |
| F-10 | 臆测式泛化 | Speculative Generality | 为臆想未来需求提前抽象，当前无用（YAGNI 违反） | 抽象基类/接口无多实现；通用参数从未使用 | LLM 倾向提前抽象（接口+默认实现+策略），增加理解成本 | 💭（阻塞理解 → 🟡） |
| F-11 | 临时字段 | Temporary Field | 对象字段只在特定路径被赋值/使用，其余时间无效 | 字段常为 null/undefined，仅个别方法设置 | LLM 把可选数据全声明为字段，多数实例不填充 | 🟡 |
| F-12 | 消息链 | Message Chains | 客户端通过长串 getter 穿越对象图取数据 | 链式 `.x().y().z()` ≥3 层且跨对象 | LLM 从全局 app/service 对象穿越多层取数；若穿越模块边界命中反模式 #23 | 🟡（穿越模块边界 → 🔴） |

**bounded edit 边界**（信号 2，1 文件）：

| 文件 | 改动 | 处数 |
|---|---|---|
| `w-model-dev/subagent/engineering-code-reviewer.md` | 新增 1 节（审查清单节前插入） | 1 |

### 3.3 借鉴点 3：GLOSSARY + `_Avoid_` 术语治理（低风险，E1 批）

**外部原则**：domain-modeling/CONTEXT-FORMAT.md 用 GLOSSARY 块固定领域术语 + `_Avoid_` 指令禁用含糊别名。

**现状**：无 glossary 文件。高发术语同义异写：`mappingType`（直接/等价/替代）、`targetKind`（requirement/design/testcase/rootcause）、`codeModule` 格式（`SD-xxx:src/path.ts`）、`checkRounds` 语义（spec 级返工记录，第 15 轮遗留 bug）、`acknowledgedDecisions`、`EventIngress` vs `RunLogEntry` 字段边界（反模式 #26）。术语定义散落在 data-models.md / verifier-spec.md / gate-logic.ts / schemas，无单一权威入口。

**设计**：新增 `w-model-dev/references/glossary.md`（术语表，每条含「规范定义 + 禁用别名 `_Avoid_`」）：
- 覆盖范围（首版 ≥12 条）：mappingType / targetKind / codeModule / checkRounds / coverageStatus / qualityLevel / compositeScore / passed / acknowledgedDecisions / runId vs eventId / action 枚举 / signatureHash
- 每条格式：`### <术语>\n- 规范定义：...\n- _Avoid_：<禁用别名/易混词>`（如 checkRounds：`_Avoid_ phase 级摘要 / 轮次记录`）
- 参考文档互引：data-models.md / verifier-spec.md / phase-3 / phase-5 头部加一行「术语权威定义见 glossary.md」

**bounded edit 边界**（信号 3，≤2 文件）：

| 文件 | 改动 | 处数 |
|---|---|---|
| `w-model-dev/references/glossary.md` | **新增**（首版 ≥12 条） | 1（新文件） |
| `w-model-dev/SKILL.md` | Bundled Resources 或 references 索引补一行 glossary 链接 | 1 |

### 3.4 借鉴点 4：No-op / Negation 元理论审计（低风险，E1 批）

**外部原则**：writing-great-skills/GLOSSARY.md 定义 **No-op**（空操作指令：读起来像要求但无行为改变）与 **Negation**（否定式指令：只说"不要 X"，不说"该做 Y"）。好 skill 指令应为「正向行为 + 脚本强制不变式」。

**现状**：SKILL.md 角色表「关键禁止」列为纯 Negation 式（如「禁止越权」）。Negation 有两个弱点：① 不说替代动作，Agent 可能「不做」而非「做正确的事」；② 无法被脚本校验。

**设计**：对 SKILL.md 角色表「关键禁止」列做 Negation 审计，逐条改「职责 + 脚本强制不变式」双行式：
- 审计清单：S 产出、V 评审、G 门禁、R 根因定位、O 编排 5 角色的关键禁止项
- 改写模板：`| <角色> | 职责：<正向动作>；不变式：<check-*.ts 强制校验>（反模式 #N） |`
- 示例：`S | 职责：产出 <artifact>；不变式：签名链 R3 校验 inputProvenance（反模式 #32）`，删除「禁止代签」这类纯 Negation，或改为「职责：真实执行并回填 → 不变式：signature-chain R1-R10」

**bounded edit 边界**（信号 4，1 文件）：

| 文件 | 改动 | 处数 |
|---|---|---|
| `w-model-dev/SKILL.md` | 角色表「关键禁止」列改写为「职责 + 不变式」双行式 | 1-3 |

### 3.5 借鉴点 5：Agent Brief durability（低风险，E1 批）

**外部原则**：implement 系列 SKILL.md 强调 Agent Brief 只写**接口 / 类型 / 行为契约**，不写文件路径 / 行号——路径是 fragile reference，重构即失效；契约是 durable reference。

**现状**：`phase-5-coding.md` 票据内容契约（S-tickets）只要求垂直切片 + blocking edges，未禁止路径/行号引用。第 21 轮 evidence 要求路径+行号（那是**评审证据**，正确的）；但**实施票据**引用路径会导致重构后票据失效。

**设计**：phase-5-coding.md 票据内容契约新增条款：
- 票据主体 = 符号级契约（接口签名 / 类型 / 行为 / 状态转移），禁止以文件路径+行号作为票据主体
- 位置信息交由 codegraph（约束 #20）查询获得：票据写「实现 `ArticleService.create` 契约」，不写「改 src/services/article-service.ts:42」
- 与评审 evidence 的边界说明：evidence 须路径+行号（verifier-spec §6.2.1），票据**不**须——二者定位不同

**bounded edit 边界**（信号 5，1 文件）：

| 文件 | 改动 | 处数 |
|---|---|---|
| `w-model-dev/references/phase-5-coding.md` | 票据内容契约节新增 durability 条款 | 1-2 |

---

## 四、新增约束 / 反模式 / 逻辑

### 4.1 新增反模式 #41（2026-07-30 用户决策：直接转正）

| # | 名称 | 描述 | 关联门禁 |
|---|---|---|---|
| **#41** | 加权平均掩盖单轴失败 | V 评审 compositeScore 加权平均 ≥0.70 放行，但存在子标准低于 B 级（<0.70）被高分掩盖 | check-verifier-output.ts R13（新增） |

> 反模式 #41 经用户决策**直接转正**（不经 pending V 复审流程）。写入 `anti-patterns.md`（二级标题分节格式 `## #41 加权平均掩盖单轴失败（第26轮新增）`，含危害/检测信号/回退动作/门禁脚本/关联 6 段）。

### 4.2 verifier-logic.ts R13 规则（新增）

| 规则 | 校验逻辑 | 触发 |
|---|---|---|
| R13 单轴下限 | 任一 `subCriterion.score < 0.70` → `passed=false` + violation「子标准 <name> 得分 <score> < 0.70（单轴下限）」 | 无条件强制 |

---

## 五、SSoT 资产同步清单（13 项）

| # | 资产 | 变更内容 |
|---|---|---|
| 1 | `w-model-dev/references/verifier-spec.md` | §6.3 通过判定改写（+单轴下限）+ §3.3 说明 |
| 2 | `w-model-dev/scripts/verifier-logic.ts` | R13 单轴下限逻辑（passed 判定 + violation） |
| 3 | `w-model-dev/scripts/samples/verifier/bad-single-axis-low.json` | 新增 fixture（completeness=0.30 其余 0.90，passed 应 false） |
| 4 | `w-model-dev/scripts/__tests__/verifier-logic.test.ts` | +2 单测（单轴低分失败 / 全合格通过） |
| 5 | `w-model-dev/scripts/self-test.ts` | +1 bad fixture 注册（self-test 基线 191 → 192） |
| 6 | `w-model-dev/subagent/engineering-code-reviewer.md` | +Fowler 12 固定基线节 |
| 7 | `w-model-dev/references/glossary.md` | **新增**术语表（≥12 条 + `_Avoid_` 指令） |
| 8 | `w-model-dev/SKILL.md` | references 索引补 glossary + 角色表 Negation 审计改写 |
| 9 | `w-model-dev/references/phase-5-coding.md` | 票据内容契约 durability 条款 |
| 10 | `w-model-dev/references/anti-patterns.md` | 新增 #41（加权平均掩盖单轴失败，直接转正，二级标题分节格式） |
| 11 | SSoT §3.4.22 | 第 26 轮记录（仿 §3.4.21 格式，版本目标 25.0.0） |
| 12 | SSoT §10A 追溯表 | +§3.4.22 行 |
| 13 | 版本号三处同步 | `package.json` + `SKILL.md` frontmatter + `skill-metadata.json` → 25.0.0 |

> 不涉及：`run-log.schema.json` / `graph.schema.json` / `verifier-output` schema（单轴下限是纯逻辑判定，不改 schema 字段）。

---

## 六、验证策略（validation gate，遵循 skillopt-adoption §validation gate）

| 阶段 | 命令 | 退出码要求 | 失败处理 |
|---|---|---|---|
| V1 TypeScript strict | `npx tsc --noEmit` | 0 | 修正 edit，重跑 V1 |
| V2 self-test | `npm run self-test` | 0（基线 191 → 192） | 修正 edit，重跑 V2 |
| V3 vitest | `cd w-model-dev && npx vitest run scripts/__tests__/` | 0（201 → ~203） | 修正 edit，重跑 V3 |
| V4 fixture | `npx tsx w-model-dev/scripts/check-verifier-output.ts w-model-dev/scripts/samples/verifier/bad-single-axis-low.json` | 1（触发 R13） | 修正 fixture，重跑 V4 |
| V5 全量回归 | 重跑 V1-V4 全绿 | 全 0 | 任一失败回到对应阶段 |
| V6 既有样本兼容 | `check-verifier-output.ts` 跑全部既有 valid/bad verifier 样本 | valid=0 / bad=1 | 确认 R13 不误伤既有样本 |

---

## 七、风险与回退

### 7.1 风险

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 单轴下限误伤既有合法样本（某子标准历史 <0.70 但曾放行） | 中 | 历史样本回灌失败 | V6 全样本回归；如合法样本触发则检查该样本是否本就是缺陷放行 |
| 术语表覆盖不全（首版 12 条漏高频术语） | 中 | 治理不完整 | glossary.md 开放追加，后续轮次按需补条目 |
| Negation 改写破坏既有 Agent 行为契约 | 低 | SKILL.md 角色表语义变化 | 改写仅重构表述，不动角色职责边界；V 复审 |
| R13 阈值 0.70 过严 | 中 | 放行率下降（所有子标准须 ≥ B 级） | 阈值=qualityLevel B 级分界（§6.1 既有定义），与 passed 原判据语义自洽；可调参数集中一处 |

### 7.2 回退

1. 注释 verifier-logic.ts R13 单轴条件，恢复 §6.3 原判定
2. 删除 bad-single-axis-low.json + self-test 对应用例
3. 保留 glossary.md / Fowler 12 / durability 条款（纯文档，无风险）
4. 版本号回退至 24.0.0

---

## 八、执行模式选择

本 spec 评审通过后，由用户选择执行模式：
- **Subagent-Driven**（推荐）：13 项资产同步任务按依赖分批派子代理（S → V → G）
- **Inline Execution**：编排者内联完成所有改动

---

## 九、开放问题（2026-07-30 用户决策后）

1. **单轴下限阈值**：✅ 已决策**收紧至 0.70**（= B 级分界，任一子标准低于 B 即打回）。已同步 §3.1 / §4.1 / §4.2 / §7.1。
2. **反模式 #41**：✅ 已决策**直接转正**（不经 pending V 复审）。已同步 §4.1。
3. **Fowler 12 清单**：✅ 已按用户要求补充详细解释（§3.2 附 12 种坏味道逐条定义 + 检测信号 + AI 生成代码高频场景 + 默认分级）。

其余设计决策已在调研阶段确认，无阻塞项。全部开放问题已关闭，可进入实施。
