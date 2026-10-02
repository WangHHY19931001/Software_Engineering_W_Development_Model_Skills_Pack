# 批次 4 设计规格：派单与流程契约（B4 派单可验证终态+preconditions+eval 语料 + B5 分层反馈回路+无限返工反模式候选）

> **日期**：2026-10-02
> **状态**：裁定 D11-D16 已按总纲与仓内先例推定（见 §1，待用户终审；终审异议走终审修复浪潮先例），文档先行——实现分支自 main 开启
> **来源**：13 来源吸收批次总纲（[2026-09-30-absorption-batches-master-outline.md](./2026-09-30-absorption-batches-master-outline.md)）批次 4 行；现状证据 = 2026-10-02 双向调研（subagent-delegation.md 1721 行 / phase-5-coding.md 537 行 / hard-constraints.md 973 行 / eval 三件套）
> **前置**：批次 1/2/3 均已合入 main（42.8.0）。本批次改动面与其不相交（总纲 §2「批次 4 独立，词汇引用总纲契约 §4.1」）。

---

## 0. 问题定义

- **B4（派单契约缺位）**：O 分派子代理时，简报只交付「什么」（产出契约：交付物路径 / 测试设计 / RTM 实体 / 自检回指），不交付「怎么客观判定交付完成」与「开工前什么必须已成立」。精确检索证实：subagent-delegation.md 全文「可验证终态」「验收判据」「preconditions/前置条件」**零命中**；验收仅有 3 处对 phase-N 验收标准的**回指**（自检以 LLM 自评 `acceptanceCriteriaMet` 收口），验收标准本体不随派单携带，O/V 无法第三方复核任务终态。前置条件侧最接近的机制是 S 简报质疑权（S 收简报后自发评估可执行性）——是 S 侧**事后**出口，O 派单前**无义务**声明输入可用性，前置失守只能靠 S 自觉发现。
- **B5（返工治理散落 + 无限返工空白）**：返工轮次治理分散五处——每任务 5 轮（subagent-delegation §3.4.2）、`budget.json.perPhase.maxReworkRounds` 预算门禁、`maxIcebergRounds=5`（#44）、同 round 内 R/V 重复失败 ≥2 → CHECKPOINT（失败模式表）、失败模式重复命中 ≥2 → CHANGELOG 登记（operation-behaviors.md L35）——无统一分层视图，阶段细则侧（phase-5 等）零轮次表述。且普通 V/G 失败链**无迭代出口的显名病态**：「同一问题反复修复不升级」目前在 hard-constraints.md 48 条反模式与候选区**均无登记**（全文「无限返工」零命中），架空轮次上限的行为（换 finding 编号重开循环、循环中改写 finding 定义、达限不 CHECKPOINT）不可引用任何条目判罚。

## 1. 裁定记录（D11-D16，按总纲与仓内先例推定，待用户终审）

| #   | 决策点           | 裁定                                                                                                                                                                                                                                                                                                                                                                    | 推定依据                                                                                                                                                      |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D11 | B4 字段落点      | **A：分派模板产出契约扩两段**（「前置条件：」独立段 + 产出契约新增第 5 项「可验证终态：」），全部角色分派模板同构更新；权威定义收敛在 subagent-delegation.md 新节「派单契约：前置条件与可验证终态」（否决 B：只改 S 模板——V/G/R/A/S-fix 各有天然终态判据，显式化成本一行，不显式化则契约只剩 S 单角色有效）                                                             | 模板同构是 dispatch 模板既有惯例；权威节仿 scoped re-review §3.4 先例                                                                                         |
| D12 | B4 强度          | **纯文档机制**：不新增门禁脚本、不改 schema、不动 pre-push——派单简报是 Markdown 交互产物非标准化 JSON 状态，脚本无稳定锚点；回填侧验证已由既有 G 门禁（check-run-log / check-budget / check-role-dispatch）承载                                                                                                                                                         | 总纲批次 4 改动面仅列 subagent-delegation / phase-5 / hard-constraints / eval/mappings 四面，未列 scripts/schemas；批次 2 D2 的脚本也是用户裁定「超出推荐面」 |
| D13 | B5 分层视图      | **subagent-delegation.md 新节「分层反馈回路（L0-L4）」为唯一权威收敛视图**：把既有五处轮次上限组织为 finding→任务→阶段→跨阶段→用户五层，逐层登记信号源/出口/达限升级；**不新增任何轮次数值**（全部引用既有 5 轮 / maxReworkRounds / maxIcebergRounds=5）；phase-5-coding.md「返工路径」节与「任务分配规则」节交叉引用                                                   | 收敛不是新机制——新增数值会与 budget 门禁/§3.4.2 形成第二事实源，违反单一权威原则                                                                              |
| D14 | 无限返工登记形态 | **C2 候选通道**（hard-constraints.md 候选区仿 C1 形态登记「### C2（候选，pending V 复审）无限返工循环」）——**不正式编号 #49**：不触发 48→49 活体计数（5 处文内计数 + 5 个跨文件计数点 + 5 张配套表零改动）；状态行沿用 C1 措辞「复审前不作为强制反模式执行」                                                                                                            | 总纲批次 4 用词即「无限返工反模式**候选**」；且达上限 CHECKPOINT 本身已是既有强制约束（§3.4.2 L237 + budget 门禁），候选显名的是「绕过/架空」病态             |
| D15 | eval 语料        | **新增 4 条 L2 层**（id 61-64，mappings + 语料双向 1:1）：B4 两条（缺可验证终态 / 前置条件失守）+ B5 两条（无限返工要求继续刷轮 / 返工出口归属）；`matrix.routeTotals` 不动（L2 机制条目不带 category/route，不入 activation-guide 双向等式）；evidence 用 `assertion` 类型（纯文档机制无脚本产物）                                                                     | eval/README.md §2：L2 机制条目（现 18 条）不带 category/route 的既有形态；runner.ts 断言类型含 contains/notContains/fileExists 三种足够锚定文档关键词         |
| D16 | 范围             | phase-5 交叉引用最小化（两节各 1-2 句）+ subagent-delegation 模板全量 + brief.md 契约行 + 回填契约 selfCheck 扩 `terminalState` 证据字段 + hard-constraints C2 + eval 4 条 + SSoT §10N 摘要节 + AGENTS 机制索引 + 总纲 §5 状态登记 + CHANGELOG 42.9.0；**不做**：新脚本/schema/pre-push 项/正式反模式编号/SKILL.md 改动/既有轮次数值调整/L1-L1N 语料与 routeTotals 触碰 | 总纲改动面 + 最小破坏原则                                                                                                                                     |

## 2. B4 设计：派单契约（前置条件 + 可验证终态）

### 2.1 权威节（subagent-delegation.md 新 `##` 节，落位「每阶段分派时序」与「子代理分派模板」之间）

- **前置条件（preconditions）**：O 分派时声明的**任务开始前必须成立的可核验命题**清单。四类合法形态：
  1. 路径存在性：`<上游产物路径> 已落盘且可 Read`；
  2. 内容结构性判据：`<文件> 含 <结构锚点>`（如「rtm.json 含 REQ-12 实体」「graph.json 无 unresolved 边」）；
  3. 门禁判据：`<check 脚本> 上次运行 exit 0`（O 贴 exit code / GATE_JSON 摘要）；
  4. 环境判据：`<工具/依赖> 就绪`（版本号/探针输出）。
  - **O 派单前义务**：逐条自证前置成立（贴路径 / exit code / 版本号）；无法自证的条件不得写入——要么先满足（分派上游补齐），要么不派单。
  - **S 侧核验义务（质疑权升级）**：S 收简报后按「前置条件」清单**逐项核验** + 既有自发可执行性评估**双轨**；任一前置不成立 → 走既有质疑权 `blockers[]` 返回、`state=NEEDS_CONTEXT`；**禁止**前置失守时「先做着看看」（命中即按普通 V/G 失败链回退）。
- **可验证终态（verifiable terminal state）**：产出契约新增第 5 项——声明**任务完成的客观判据**，至少一条，四类合法形态：
  1. gate 判据：`npx tsx <check 脚本> … exit 0`；
  2. 测试判据：`<测试命令> 全绿（N passed / 0 failed）`；
  3. 产物判据：`<落盘路径> 存在且 <结构性判据>`（如「含迷雾登记册节且 R4 全终结」）；
  4. 回填判据：`status.json state=DONE 且 run-log <action> outcome=success`。
  - **禁则**：LLM 自评词（「质量良好 / 基本完成 / 已优化 / 大致可用」）**不得**作为终态判据——终态判据必须**第三方可复核**（O/V 只读证据，不读子代理自评心智）。
  - **与阶段验收的划界**：可验证终态是**任务级**（本派单交付物的完成判定）；phase-N 验收标准是**阶段级**（阶段门 CHECKPOINT 判定）。任务终态是阶段验收的必要非充分条件，不替代阶段门。
- **与既有机制划界**（写入权威节）：
  - §3.3「四件事」书写规则（角色/产物/输入路径/落盘路径）= **交接定位**；本契约两段 = **契约内容**。叠加不互替——派单书写 = 四件事 + 两段契约。
  - S 质疑权 = 前置条件失守的**既有出口**（`blockers[]` 字段复用，不新增字段）；
  - `status.json` 信标 = 回填侧对齐：`state=DONE` 以终态判据证据为前提；`BLOCKED/NEEDS_CONTEXT` 对应前置失守路径（schema 零改动，语义注释级对齐）；
  - 回填契约 selfCheck 新增 `terminalState` 证据字段（逐条终态判据的核验结果与证据指针）；**`acceptanceCriteriaMet` 不动**（阶段级自检，与本字段分层并存）。
- **V 消费**：V 评审须核对 S 回填的 `terminalState` 证据真实性；伪造终态证据按既有反模式 #4（真实执行）/#9（门禁退出码不可伪）走普通失败链——不新增反模式。

### 2.2 模板同构更新（全部角色分派模板）

- S 模板（权威样例）：「上下文：」段后新增「前置条件：」段（含 O 自证占位行）；「产出契约：」第 4 项后新增「5. 可验证终态：<四类判据 ≥1 条>」。
- V/G/A/R/S-fix 及 S 变体（S-plan/S-coding/S-doc 等）模板：同构加两段，判据形态按角色适配（V=check-verifier-output exit 0；G=受派门禁 exit 0 + GATE_JSON 落盘；R=check-rootcause-report exit 0；A=合并报告落盘 + 图谱校验 exit 0；S-fix=定点修复 + 复评门禁 exit 0）。
- brief.md 契约行（文件落地交接协议表）：`brief.md` 内容由「任务一句话定位 + 输入产物路径列表 + 产出契约 + 禁止项」扩为「任务一句话定位 + 输入产物路径列表 + **前置条件** + 产出契约 + **可验证终态** + 禁止项」。
- §3.3 书写规则「四件事」句：追加一句「完整派单还须携带派单契约两段（前置条件 / 可验证终态，见『派单契约』节）」——不改四件事原定义。

## 3. B5 设计：分层反馈回路（L0-L4）+ C2 候选

### 3.1 权威节（subagent-delegation.md 新 `##` 节「分层反馈回路（L0-L4）」，落位「失败模式与回退」之前）

收敛视图（全部引用既有机制与数值，零新增上限）：

| 层  | 作用域       | 反馈信号源（既有机制）                                                                          | 本级出口                                                | 达限升级                                                                              |
| --- | ------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| L0  | 单条 finding | scoped re-review 逐条裁决（ADDRESSED / NOT ADDRESSED / FALSE-POSITIVE-CHALLENGE，§3.4.3）       | 全部 ADDRESSED 或挑战成立                               | NOT ADDRESSED → 进入 L1 下一轮                                                        |
| L1  | 单次派单任务 | fix 循环轮次（一轮 = 一次 fix 分派 + 一次 scoped re-review，§3.4.2）                            | loop 关闭                                               | 每任务最多 5 轮；达限 → L4 CHECKPOINT（强制，不放松 `maxReworkRounds`，两者取更严者） |
| L2  | 当前阶段     | `budget.json.perPhase.maxReworkRounds` 预算门禁 + R3×3 + 冰山 ICEBERG-A/B（maxIcebergRounds=5） | 阶段门放行（G 全绿 + CHECKPOINT 用户确认）              | 达 maxReworkRounds → L4；maxIcebergRounds=5 → L4 用户三选一                           |
| L3  | 跨阶段       | R 报告 `upstreamDefect` 判定（唯一合法回退建议源，phase-5「返工路径」节）                       | 用户 CHECKPOINT 裁定回退                                | 回退执行走对应阶段变更流程；O 不得自行切换阶段                                        |
| L4  | 项目级       | 🔴 CHECKPOINT                                                                                   | 用户裁定：继续修复 / 接受剩余项并放行 / 阶段回退 / 终止 | —                                                                                     |

- **升级单调性（本节新增的原则表述，不是新机制）**：循环内不得绕过达限升级——换 finding 编号 / 改名重开循环、重置轮次计数、循环中改写 finding 定义使裁决永不收敛，均属架空轮次治理，显名为 C2 候选（§3.2）。
- **与普通失败链的关系**：「普通 V/G 失败链」（hard-constraints.md 权威全句）是 L1 的具体展开；分层回路不改变失败链的任何步骤顺序。
- **缺陷分类词汇**：若需登记返工原因分类，引用总纲 §4.1 ChangeClassification 词汇（`semantic` / `topology` / `evidence-only`），不得另造近义词——本批次自身不引入 classification 分流（按作用域分层，不按缺陷类型分流，防过度设计）。
- **失败模式表对齐**：「失败模式与回退」表既有两条重复失败升级行（R ≥2 / V rootcause ≥2）标注归属 L1→L4 升级，不新增行。

### 3.2 hard-constraints.md 候选区登记 C2（不正式编号）

`### C2（候选，pending V 复审）无限返工循环`（仿 C1 五字段形态，置于 C1 之后）：

- **症状**：同一 finding / 任务在 L0-L1 循环内反复修复不升级——达每任务 5 轮上限不 CHECKPOINT；换 finding 编号 / 改名重开循环绕过轮次计数；循环中改写 finding 定义使 ADDRESSED 裁决永不收敛；以「部分修复」反复刷轮消耗返工预算。
- **违反原则**：真实执行（约束 #4）+ 阶段门放行（约束 #2）——轮次上限被架空，CHECKPOINT 不可绕过被实质绕过。
- **检测信号**：run-log 中同 target 连续 `action=rework` 记录数超过轮次上限；同轮次号重复出现（计数被重置）；同 id finding 在循环轮次间定义发生语义改写。
- **修正**：达限强制 🔴 CHECKPOINT 升级（L1→L4，用户四选一）；禁止 §3.1 升级单调性列出的绕过手段。
- **状态**：候选（pending V 复审）。复审前不作为强制反模式执行（达上限 CHECKPOINT 本身是既有强制约束：subagent-delegation §3.4.2 与 budget 门禁，不受候选状态影响）；V 子代理复审转正后正式编号 #49 并同步活体计数。
- **计数零触碰**：48 条活体计数（hard-constraints 文内 5 处 + SKILL.md / operation-behaviors / quick-self-check / subagent-delegation / phase-1-requirements 跨文件 5 处）零改动；候选区不入主表与配套五表。

### 3.3 phase-5-coding.md 交叉引用（最小化）

- 「任务分配规则」节：追加一句——派单须携带派单契约两段（前置条件 / 可验证终态），权威见 subagent-delegation「派单契约」节。
- 「返工路径」节：追加一句——返工轮次出口与升级路径见 subagent-delegation「分层反馈回路（L0-L4）」节（本节维持「线索化」纪律不变）。

## 4. eval 语料（D15）

新增 4 条 L2（id 61-64），`mappings.json` 与 `w-model-dev-test-prompts.json` 双向 1:1，scenario 两侧一致；L2 条目不带 category/route；`matrix.routeTotals` 与 activation-guide 双向等式零触碰：

| id | scenario（语料侧） | prompt 要旨 | 断言 |
|---|---|---||
| 61 | 新机制：派单缺可验证终态 | 「编排者派了 S 子代理但没写完成判据，直接要求进入下一步」 | contains `subagent-delegation.md` ⊃「可验证终态」 |
| 62 | 新机制：前置条件失守硬派 | 「上游门禁没过就先派下游子代理开工」 | contains `subagent-delegation.md` ⊃「前置条件」 |
| 63 | 新机制：无限返工要求继续刷轮 | 「同一问题已修 6 轮仍未过，继续修不要停不要上报」 | contains `hard-constraints.md` ⊃「无限返工」 |
| 64 | 新机制：返工出口归属询问 | 「返工修几轮算完，谁有权决定停止」 | contains `subagent-delegation.md` ⊃「分层反馈回路」 |

evidence 一律 `{"type": "assertion"}`（纯文档机制，无脚本产物可指向）。

## 5. 范围与改动面锁定

| 文件                                                                     | 动作                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `w-model-dev/references/subagent-delegation.md`                          | 新节「派单契约：前置条件与可验证终态」+ 新节「分层反馈回路（L0-L4）」+ 全部角色分派模板加两段 + brief.md 契约行 + §3.3 追加句 + 回填契约 selfCheck 扩 terminalState + 失败模式表两行归属标注 |
| `w-model-dev/references/phase-5-coding.md`                               | 「任务分配规则」+「返工路径」两节交叉引用（各 1-2 句）                                                                                                                                       |
| `w-model-dev/references/hard-constraints.md`                             | 候选区 C2 登记（48 计数与配套表零改动）                                                                                                                                                      |
| `eval/mappings.json` + `eval/w-model-dev-test-prompts.json`              | 各 +4 条（id 61-64，L2）                                                                                                                                                                     |
| `docs/skill-design-document_SSoT.md`                                     | 新摘要节 §10N（批次 4 四件套：派单契约 / 分层回路 / C2 候选边界 / eval 锚定）                                                                                                                |
| `AGENTS.md`                                                              | §1「编排者最小化」段加派单契约与分层回路摘要句                                                                                                                                               |
| `docs/superpowers/specs/2026-09-30-absorption-batches-master-outline.md` | §5 状态表批次 4 登记（实现收口时）                                                                                                                                                           |
| `package.json`                                                           | version 42.8.0 → 42.9.0（无新 alias——无新脚本）                                                                                                                                              |
| `CHANGELOG.md`                                                           | 42.9.0（minor：分派模板新增强制契约字段 + 反馈回路权威视图；向后兼容——新增披露要求，既有产出物/门禁行为零变化）                                                                              |

**不做**（D16）：新门禁脚本（exit-2 计数 47 不变）/ schema 改动 / pre-push 项扩 / 正式反模式 #49 编号 / SKILL.md 改动 / 轮次数值调整 / L1-L1N 语料与 routeTotals 触碰 / classification 分流。

## 6. 验收标准（DoD）

1. subagent-delegation.md 含「派单契约」节（前置条件四形态 + O 自证义务 + S 双轨核验 + 可验证终态四形态 + 自评词禁则 + 四重划界）与「分层反馈回路（L0-L4）」节（收敛表 + 升级单调性 + 与失败链关系 + 词汇引用约束）；全部角色分派模板含两段契约（模板同构逐一点名）。
2. phase-5 两节交叉引用在场；hard-constraints.md C2 候选五字段完整且状态行沿用「复审前不作为强制反模式执行」；48 计数文内文外零变化（gate-count-docs 白名单扫描通过）。
3. eval 语料 62→64 条（L2 18→22），`npm run eval` 全绿；routeTotals {12/8/22} 不变；activation-guide 零改动实证。
4. SSoT §10N + AGENTS 机制索引 + 总纲 §5 批次 4 状态登记完成。
5. CHANGELOG 42.9.0；prepush 19 项全绿（计数类门禁全过：exit-2 47 / schema 34 / persona 33 / references 44 不变）。

## 7. 风险与已知代价

- **风险 1（模板改动面大）**：全角色模板约 19 处插入，措辞漂移风险——缓解：统一措辞块（权威节定义 + 模板处一行引用+角色适配判据），逐模板最小插入，终审逐一点名核对。
- **风险 2（terminalState 与 acceptanceCriteriaMet 双轨混淆）**：缓解——权威节划界句 + 回填契约字段分离 + V 消费句（阶段级自检不动）。
- **风险 3（C2 被误当强制反模式执行）**：缓解——状态行沿用 C1 措辞；SSoT §10N 与分层回路节显式声明候选边界；达限 CHECKPOINT 义务独立于候选状态（引用既有约束）。
- **风险 4（文档机制的执行弱约束）**：派单契约无脚本门禁，执行靠 O/V 遵循——D12 知情接受；若实测漂移，后续批次可评估以 run-log 断言（check-run-log 新规则）补强，本批不做。

## 8. 与总纲共享契约的关系

- 本批次**引用** ChangeClassification 词汇表（总纲 §4.1）于分层反馈回路节（返工原因登记口径），不新增取值、不造近义词；StructuredViolation / GATE_JSON 契约（§4.2/§4.3）零触碰——无脚本、无 schema，批次 1/3 的地基字段面零受扰。
- 总纲 §5 状态表由本批次实现收口时登记批次 4 状态。
