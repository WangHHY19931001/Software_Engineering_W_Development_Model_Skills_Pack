# 变更日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> 41.0.0 之前的历史变更已归档至 [CHANGELOG-archive.md](./CHANGELOG-archive.md)。
> 历史决策详情（轮次记录 / 关键决策 / 验证数据 / 吸收决策记录）归档于
> [`docs/changes/decision-log/`](./docs/changes/decision-log/README.md)（轮次 → 版本 → CHANGELOG 映射见其 README）。

## [42.10.0] - 2026-10-03

### 批次 5：治理与叙事（吸收批次总纲批次 5；规格 D1-D5 已裁定，文档先行）

- **新增 `references/agent-threat-model.md`（C2，D1 文档叙事形态）**：agent 流水线威胁目录 T1-T7（提示注入 / 证据伪造 / 门禁结果冒充 / 字节篡改与抵赖 / 越权实施 / 敏感数据泄漏 / 输出漂移）→ 既有缓解机制映射（覆盖强度：阻断/检测/提示），三不承诺（不建自动化守卫脚本 / 不新增检测信号 / 不改 G 门禁）；`verifier-spec.md` §7.4A 注入提示行边界细化（原句保留 + D1 裁定声明 + 指针）。references 计数 44→45（`checkReferencesCount` 门禁同步）。
- **新增 campaign 级「整批否决权与回收路径」治理规则（C4，D2 纯文档）**：整批否决 = 批量 CHECKPOINT 编组语义（批量判定不新增权限 / 非降门槛 / 逐候选落账）；回收 = 系统性问题触发、人类 CHECKPOINT 发起、逐候选既有回滚原语编组（不建一键回滚）；缺口披露：已外发脱敏证据包不可召回。落 `quality-standards.md` + `code-health-governance.md` §6；零新脚本零 schema。
- **新增 SSoT §10K.7「Phase 5-8 迁移设计锚点（素材，待需求输入）」（C1，D3 需求框架先行）**：定义 + `migrate-code`/`migrate-test` 占位 + 五字段待输入表；维持「未实现（不得据此执行）」，实现单独立项。
- **SSoT §10O 权威摘要节 + §10A 追溯行；AGENTS.md 机制索引句 + §2 表行；总纲 §1/§5 批次 5 状态登记**。
- **纯文档批次**：零新脚本（门禁脚本 48 个 .ts 不变）、零 schema 改动（34 份不变）、零 eval 语料变更（总纲批次 5 改动面不含 eval）；向后兼容（既有句子原样保留，只追加/细化）。
- prepush 19 项全绿（终值由收口任务回填）。

## [42.9.0] - 2026-10-02

> 来源：「批次 4：派单与流程契约」批——规格 `docs/superpowers/specs/2026-10-02-batch4-dispatch-contract-design.md`（78396d90）、计划 `docs/superpowers/plans/2026-10-02-batch4-dispatch-contract.md`（78396d90 同提交），账本 `.superpowers/sdd/2026-10-02-batch4-dispatch-contract/`（gitignored 账本；逐任务三件套 `task-N-{brief,report}.md` + `review-*.diff`），实现 6 提交 d463ad68..bb95e023（分支 feature/batch4-dispatch-contract，自规格/计划提交 78396d90 开启，该基点不计入 6 提交计数）。**版本 bump 42.8.0 → 42.9.0**（判据：minor 级流程契约变更——22 个分派模板新增强制「前置条件 / 可验证终态」两段 + 分层反馈回路（L0-L4）权威视图 + hard-constraints 候选区 C2 登记）。**向后兼容**：纯文档机制零脚本零 schema 零门禁行为变化；分派模板新增段为产出披露要求，既有字段与既有产出物零破坏；eval 仅追加。**计数影响**：schema 34 / prepush 19 / persona 33 / references 44 / exit-2 脚本 47 / CLI 48 全不变；eval 语料 60 → 64（+4 条 L2，routeTotals {12/8/22} 不变）；反模式正式清单仍 48 条（C2 为候选区登记，pending V 复审，不计入活体计数）。**prepush 19/19 全绿**（终值 1949s，对终审修复浪潮提交 fa4a24c2 实测；此前对收口提交 ca5fc151 亦 19/19 全绿 2513s）。

### 派单契约（B4：前置条件 + 可验证终态）

- **权威节**：`subagent-delegation.md` 新增「派单契约：前置条件与可验证终态」节——分派简报在 §3.3「四件事」（角色 / 产物 / 输入路径 / 落盘路径）之外必须携带两段契约，叠加不互替：**前置条件**（任务开始前必须成立的可核验命题，四类合法形态：路径存在性 / 内容结构性判据 / 门禁判据 / 环境判据；O 派单前逐条自证，无法自证的条件不得写入；S 侧核验义务与既有质疑权双轨执行，任一前置不成立走既有质疑权出口 `blockers[]` / `state=NEEDS_CONTEXT`，禁止「先做着看看」）；**可验证终态**（任务完成的客观判据，产出契约新增第 5 项，四类合法形态：gate 判据 / 测试判据 / 产物判据 / 回填判据）。
- **自评词禁则与角色禁令优先**：LLM 自评词（「质量良好 / 基本完成 / 已优化」等）不得作为终态判据——终态判据必须第三方可复核（O/V 只读证据，不读子代理自评心智）；被禁止跑门禁脚本的角色（S / V / R / A 系）不以 gate 判据为终态判据，其 gate 验证由下游 G 子代理承担，终态落在产物判据 + 回填判据；G 自身的 gate 判据语义为「受派门禁全部执行完毕 + 结构化证据摘要回填」（exit 1 也是有效完成——回填真实测量值，exit 1 触发失败链而非「任务未完成」）。
- **任务级 vs 阶段级划界与回填对齐**：可验证终态是任务级判定，phase-N 验收标准是阶段级判定——任务终态是阶段验收的必要非充分条件，不替代阶段门（放行仍走 V/G 证据 + 🔴 CHECKPOINT 用户确认）；回填契约 selfCheck 新增 `terminalState` 证据字段（逐条终态判据的核验结果与证据指针），与既有 `acceptanceCriteriaMet`（阶段级自检）分层并存；status.json `state=DONE` 以终态判据证据为前提、`BLOCKED` / `NEEDS_CONTEXT` 对应前置失守路径（schema 本体零改动，语义注释级对齐）。V 评审须核对 `terminalState` 证据真实性，伪造终态证据按既有约束 #4（真实执行）/#9（门禁退出码不可伪）处置，走普通 V/G 失败链——不新增反模式。
- **22 个分派模板同构携带两段**：S / V / G / R / A 系全部分派模板统一插入「前置条件（派单契约，O 派单前逐条自证）」与「可验证终态（selfCheck.terminalState 逐条核验）」两段。
- **交接书写与交叉引用**：`brief.md` 契约格由四件扩为六件（+前置条件 / +可验证终态）；§3.3 书写规则追加句（完整派单书写 = 四件事 + 两段契约）；phase-5-coding.md「任务分配规则」节交叉引用派单契约权威节。

### 分层反馈回路（B5：L0-L4 收敛视图 + C2 候选）

- **权威节**：`subagent-delegation.md` 新增「分层反馈回路（L0-L4）」节——返工 / 失败信号的收敛视图，按作用域分层、不按缺陷类型分流：L0 单条 finding（scoped re-review 逐条裁决）→ L1 单次派单任务（fix 循环每任务最多 5 轮，达限 → L4，不放松 `budget.json.perPhase.maxReworkRounds`，两者取更严者）→ L2 当前阶段（`maxReworkRounds` 预算门禁 + R3×3 + 冰山 ICEBERG-A/B maxIcebergRounds=5）→ L3 跨阶段（R 报告 `upstreamDefect` 唯一合法回退建议源，用户 🔴 CHECKPOINT 裁定回退）→ L4 项目级（🔴 CHECKPOINT 用户裁定）。信号源全部为既有机制与既有数值，零新增上限、零新机制。
- **升级单调性与词汇约束**：循环内不得绕过达限升级——换 finding 编号 / 改名重开循环、重置轮次计数、循环中改写 finding 定义使裁决永不收敛，均属架空轮次治理，登记为候选 C2；「普通 V/G 失败链」是 L1 的具体展开，分层回路不改变失败链任何步骤顺序；返工原因分类须引用总纲 §4.1 ChangeClassification 词汇（`semantic` / `topology` / `evidence-only`），不另造近义词——本批次不引入 classification 分流。
- **失败模式表归属标注与交叉引用**：「失败模式与回退」表 R 自评不通过 / V 复审根因不通过两行补 L1→L4 升级归属标注；phase-5-coding.md「返工路径」节交叉引用分层出口与升级路径（本节「仅作为 R 定位线索」的线索化纪律不变）。
- **hard-constraints.md 候选区 C2「无限返工循环」**：五字段（症状 / 违反原则 / 检测信号 / 修正 / 状态）仿 C1 登记（违反原则指向约束 #4 + 约束 #2）；候选状态 pending V 复审，复审转正前不作为强制反模式执行——达上限 CHECKPOINT 义务本身是既有强制约束（每任务 5 轮上限与 `maxReworkRounds` 预算门禁），独立于候选状态；反模式活体计数 48 条零触碰。

### eval 语料（+4 条 L2）

- `eval/mappings.json` + `eval/w-model-dev-test-prompts.json` 追加 id 61-64 四条 L2 机制存在性断言，锚定批次 4 新机制：61 派单缺可验证终态 / 62 前置条件失守硬派 / 63 无限返工要求继续刷轮 / 64 返工出口归属询问；`mappings.json` 顶层 `description` 条数口径同步 60 → 64；`npm run eval` 64/64 通过。

### 索引与权威对齐

- SSoT 新增 §10N 摘要节（批次 4 四件套：派单契约权威 / 分层反馈回路权威 / C2 候选 / eval 锚定，含能力分工与判据披露两句——纯文档机制无脚本门禁为 D12 知情声明）+ §10A 追溯表增 §10N 行；AGENTS.md §1「编排者最小化」段追加派单契约与分层回路摘要句（双权威指针）；总纲 `2026-09-30-absorption-batches-master-outline.md` §5 批次 4 状态登记（本提交）。

## [42.8.0] - 2026-10-02

> 来源：「批次 2：设计期未决问题」批——规格 `docs/superpowers/specs/2026-10-02-design-phase-fog-and-optional-capability-design.md`（dea72625）、计划 `docs/superpowers/plans/2026-10-02-design-phase-fog.md`，账本 `.superpowers/sdd/2026-10-02-design-phase-fog/`（gitignored 账本；逐任务三件套 `task-N-{brief,report}.md` + `review-*.diff`），实现 8 提交 56020c75..8d248ee9。**版本 bump 42.7.0 → 42.8.0**（判据：minor 级门禁行为变更——新增 check-design-fog 门禁脚本（R1-R6）与三主模板强制「迷雾登记册」节 + 阶段 2-4 CHECKPOINT 迷雾清空接线）。**向后兼容**：check-design-fog 为新增独立门禁脚本，既有门禁脚本行为与退出码面零变化；三主模板迷雾节与 discipline-dod 勾选项均为产出模板增列，既有字段零改动。**计数影响**：schema 34 / prepush 19 / persona 33 / references 44 均不变；exit-2 脚本 46 → 47、CLI 47 → 48（+check-design-fog，门禁脚本 48 个 .ts）；samples 新增 5 fixture（design-fog：valid-all-terminal / valid-no-fog-marker / bad-missing-section / bad-unresolved-fog / bad-marker-conflict）；self-test 392 用例（+5 DESIGN_FOG_CASES 样本回归，非 vitest）；vitest 用例 1942 → 1958（+16：design-fog-logic.test.ts 12 / design-fog-cli.test.ts 3 / exit2-failure-atomicity 逐门禁派生 +1，本批收口轮同步修正 docs-consistency-logic 测试的计数锚 46→47 / 47→48 / 48→49）；eval 语料 60/60（本批零影响实测）。

### 设计期迷雾登记册（A3：checkDesignFog R1-R6 + check-design-fog CLI + 三模板/三阶段机制）

- **文档机制**：阶段 2-4 设计主模板（system-design / interface-design / detailed-design）新增「迷雾登记册」节——六列表（迷雾项 ID / 模糊描述 / 疑点 / 疑似归属 / 毕业方向 / 毕业处置结果）+ 无雾标记（「本阶段无未终结迷雾项」单行声明）+ check-design-fog 门禁引用；占位词白名单扩「非目标显式标注与迷雾登记册节」。锐利性判据为「能否精确陈述该设计决策的问题」（非能否回答）；毕业三选一：毕业为正式设计项 / 判入非目标 / 需求级回退；CHECKPOINT 前强制清空（未终结项 exit 1 一律返工，披露于迷雾清空披露项）。
- **纯函数门禁（R1-R6）**：`logic/design-fog-logic.ts` `checkDesignFog({markdown, phase})`——R1 节存在 fail-closed / R2 表或无雾标记二选一 / R3 迷雾项 ID 须符合 `FOG-P{phase}-NN` 格式（两位起数字，fogId 阶段前缀与 `--phase` 一致）+ 表行解析（分隔行判定收窄为表头紧邻行，全空/占位横线数据行 fail-closed 命中 R3+R4，终审 Important 修复）/ R4 毕业处置终结性（空/待定即 unresolved 计入 fogStats）/ R5 表数据行与无雾标记互斥 / R6 毕业方向=设计项须疑似归属非空（设计项归属一致性）。
- **CLI**：`cli/check-design-fog.ts`（`--doc` / `--phase` 单值，重复值 flag 一律 `ARG_INVALID`；stdout 单行 `FOG_JSON` 键序 type/passed/doc/phase/reasons/violations/fogStats/exitCode；exit 0/1/2 结构化错误走 `lib/cli-error.ts`）；npm alias `check:fog`；NEGATIVE-COVERAGE 登记（bad-unresolved-fog：放宽 R4 终结性将让未毕业迷雾项静默通过阶段门）。
- **流程接线**：phase-2 / phase-3 / phase-4 机制节（迷雾登记册运作 + 毕业三选一 + 四通道划界 + 失败模式 FM-{SD,OD,DD}-08 迷雾滥用：信号 A 把可精确陈述的决策塞入迷雾册逃避设计义务 / 信号 B CHECKPOINT 前存在未终结项）+ CHECKPOINT 接线（迷雾清空披露 + exit 1 一律返工）+ discipline-dod×3 迷雾清空勾选项 + 验收标准条。

### 可选能力边界（A4：可选能力≠运行时边）

- **graph-guide 新增「可选能力边界」节**：进图 = 承诺运行时事实；设计提及但非本次承诺的可选能力（未来扩展/可选集成/降级路径）不建图节点、不建边——未决的登记迷雾登记册，明确不做/暂缓的登记非目标（附决策引用）；**P2（可以）≠ 可选能力**（priority 是需求排序语义，范围内 P2 照常建 REQ/SD 节点并承担全部不变量）；可选能力后续转正 = 正式变更（走迷雾毕业或需求变更流程）；方案 A 下不设任何豁免标记，SDMAP/codeModule 对账面零受扰（可选能力不产生 SD 节点即无对账义务）。
- **表达位**：system-architecture 模板 §2 注记 + §7 可选能力清单位；phase-2/3/4 禁止行为新增「可选能力建图节点/边」条目；SSoT §10.7 边界句。

### 索引与权威对齐

- ingestion-cross 固化句修订（§4-§7 为阶段 1 专用增强；需求层迷雾于阶段 1 固化，设计层未决项由阶段 2-4 迷雾登记册维护）+ A-evolve 步骤 6（登记入对应阶段主模板迷雾登记册节）；AGENTS.md 机制索引「阶段 1-4 迷雾登记册」双段扩写；SSoT 新增 §10M 摘要节（批次 2 四件套：机制 / 脚本 / 边界 / 权威）+ §10.7 前向引用闭合 + evidenceAnchor 必填口径统一（§4A.1b 两句 + §10A 追溯表行）。

## [42.7.0] - 2026-10-01

> 来源：「批次 3：门禁工程」批——规格 `docs/superpowers/specs/2026-10-01-gate-engineering-design.md`、计划 `docs/superpowers/plans/2026-10-01-gate-engineering.md`，账本 `.superpowers/sdd/2026-10-01-gate-engineering/`（gitignored 账本；逐任务三件套 `task-N-{brief,report}.md` + `review-*.diff`）。**版本 bump 42.6.0 → 42.7.0**（判据：minor 级门禁行为变更——sigHash 公式版本化 + 新规则 R11 + R4 scope 强制 + 四热点结构化双轨与 GATE_JSON 新键）。**向后兼容**：sigHashAlgo 缺省按 v1（既有链逐字节零破坏）；verifiedArtifacts / subject / fixHints / differences 均为只增可选键。**计数影响**：schema 34 / exit-2 脚本 46 / prepush 19 / CLI 47 / persona 33 / references 44 均不变，零新增门禁脚本；samples 新增 4 fixture（signature-chain 14→17：valid-v2 / bad-v2-missing-sha256 / bad-v2-tampered-sha256；rootcause 16→17：bad-r4-scope-missing）；eval 语料 60/60（本批零影响实测）。

### 签名链字节绑定（B2：sigHash v2 版本化 + R11 + verifiedArtifacts）

- **sigHash 公式版本化（D6 裁定 C）**：`SignatureChainEntry` 增可选 `sigHashAlgo`（枚举 `v1`|`v2`，**缺省按 v1**）；v2 公式与 v1 的差别仅在槽位 6 换为 `artifactsV2 = JSON.stringify({ artifacts, sourceArtifacts })`——artifacts 与 sourceArtifacts 两清单整体（含每条 sha256）纳入内容哈希；R6 按条目 `sigHashAlgo` 分流重算（权威入口 `computeSigHashFor`），v1 路径逐字节不变。schema 同步（SourceArtifact 增 `sha256` 64-hex、条目层增 `sigHashAlgo`，`additionalProperties: false` 先行）。
- **新规则 R11（仅 v2 条目适用）**：`inputProvenance.sourceArtifacts[]` 每条 `sha256` 必填且匹配 `^[a-fA-F0-9]{64}$`，缺失或非法即违规（`R11: <sigId> v2 条目来源 sha256 缺失或非法`）；v1 条目（含缺省）不触发，既有样本零破坏。新 fixture ×3（valid-v2 / bad-v2-missing-sha256 / bad-v2-tampered-sha256——后者验证篡改 sha256 字段被 R6 重算抓获）。
- **GATE_JSON `verifiedArtifacts`**：`JsonReport` 与 `gate-log.schema.json` 增顶层可选 `verifiedArtifacts?: Array<{path, sha256, bytes}>`——本次门禁判定承重输入文件字节清单，消费前可复验「门禁验的与消费的是同一字节」；四热点门禁 `--json` 恒存在（空数组允许）。v2 签名方的 `sourceArtifacts[].sha256` 从上游 verifiedArtifacts 按 path 抄录（无上游清单按磁盘现算，见 signature-chain-guide.md §6.2）；「声明 vs 真实字节」的自动核查需 gate-log 索引基建，本批不建（规格 §4.1 知情边界，D6 已裁定接受）。

### 四热点结构化双轨（B1：subject / fixHints，D7 裁定 A）

- `StructuredViolation` 增可选 `subject`（符号级定位，面向修复者 LLM）与 `fixHints`（≤3 条祈使句）——只增可选、既有字段不动。四热点填充：check-artifact-gate（SDMAP_FIX_HINTS 常量表；SDMAP-5 结构化收编为 structuredViolations（rule `SDMAP-5`、classification `semantic`、subject=条目 raw）并入 `sdmapViolations`）、check-design-contract-consistency（structuredViolations 为必填键；subject=`<uatPath> → <routePath>`）、check-code-tla-consistency（CODE_TLA_FIX_HINTS 8 键 11 填充点；subject 按维度取 SD id / transitionKey / action 名 / invariant 名）、check-verifier-output（VERIFIER_FIX_HINTS 5 键 49 填充点；subject=`subCriterion.name`，structuredViolations 为可选键）。budget/maturity 等非热点门禁后续批次渐进。
- **R 消费契约**：R 引用 `subject` 定位根因；reworkHints 按 classification 排序（批次 1 已立）并转写 fixHints（至多 3 条）（root-cause-locator.md §4.4 第 7 条）。

### fixRecommendation scope 强制（B3，D8-D9 裁定）

- `rootcause-report.schema.json` fixRecommendation.items 增 `scope`（`{allowed, forbidden}` 双数组进入 items.required，至少一侧非空数组、每项非空字符串，不做 glob 语法深验）；`root-cause-logic.ts` R4 扩展强制——缺失/空双数组/非字符串项 → R4 违规，消息 `R4: fixRecommendation[N] 缺合规 scope（…）`；存量 samples/rootcause 全量补 scope（硬切）+ 新负向 fixture bad-r4-scope-missing。
- **V scoped re-review 对照消费**：fix diff 触碰 `scope.forbidden` 或超出 `scope.allowed` → 该 finding NOT ADDRESSED / 上报 🔴 CHECKPOINT（subagent-delegation.md §3.4.2；scope 撰写指引 root-cause-locator.md §3 第 6 条）。

### 同期四项（总纲 §5.1）

- `check-state-machine-consistency.ts`：`differences[].classification` 挂钩权威类型 `Extract<ChangeClassification,'topology'>`（type-only import）；CLI `--json` 透传 `differences` 键（`result.differences ?? []`）；sharedTransition 救场路径用例（状态零交集 + 转移同侧有交集不再误报 `cannot prove same system`）。
- **双实现一致性 property 测试**（`code-gate-parity.test.ts`，5 用例）：表驱动 (graph, rtm) 组合下断言 checkArtifactGate SDMAP structured 集合 ≡ checkCodeTlaConsistency 维度 1 集合（按 rule@field 投影相等）；SDMAP-1 field 对齐（code-tla 侧改 `graph.SD[<id>]` id 键形态）。
- **文档与术语同步**：signature-chain-guide（§4 R1-R11 表 + 新 §6.2「v2 签名与 sha256 抄录」）、root-cause-locator（§3 第 6 条 scope 撰写指引 + §4.4 第 7 条 structured 诊断消费）、subagent-delegation（§3.4.2 scope 对照）、command-reference（R4 scope 强制 + state-machine `--json` differences 键）、conventions 术语表 4 条（subject / fixHints / verifiedArtifacts / sigHashAlgo）、SSoT §10.9 / §10L.8 权威措辞修正、AGENTS.md §8 两行（check-signature-chain R11、check-rootcause-report R4 强制 scope）。

## [42.6.0] - 2026-09-30

> 来源：「批次 1：设计↔代码一致性证据化对账」批——规格 `docs/superpowers/specs/2026-09-30-design-code-consistency-anchors-design.md`、批次总纲 `docs/superpowers/specs/2026-09-30-absorption-batches-master-outline.md`、计划 `docs/superpowers/plans/2026-09-30-design-code-consistency-anchors.md`，账本 `.superpowers/sdd/2026-09-30-design-code-consistency-anchors/`（gitignored 账本；逐任务三件套 `task-N-{brief,report}.md` + `review-*.diff`）。**版本 bump 42.5.0 → 42.6.0**（判据：minor 级门禁行为变更——SD→codeModule 对账语义重写 + codeModule 条目语法硬切升级 + GATE_JSON 新增两键）。**破坏性变更（硬切）**：RTM 的 codeModule 条目由文件级升级为行号锚点级语法，**存量项目的 codeModule 条目须补锚点**（子串匹配与数字 id 特判同步废除），未升级条目将被 SDMAP-5 拒收。**计数影响**：schema 34 / exit-2 脚本 46 / prepush 19 / CLI 47 / persona 33 / references 44 均不变，零新增门禁脚本；eval 语料 60/60（mappings.json 仅 fileExists 断言，本批实测零影响）。

### 设计↔代码一致性证据化对账（SDMAP / 锚点语法 / ChangeClassification / 零交集守卫）

- **SD→codeModule 双向精确对账重写（SDMAP-1/2）**：废除 `gate-logic.ts` 拆段子串逻辑与数字 id `${id}:` 特判，统一为前缀解析精确对账——第一向（图→RTM）每个 SD 图节点须有 ≥1 条 REQ 条目其 `SD-<id>:` 前缀精确等于该节点 id（缺映射 SDMAP-1）；第二向（RTM→图）每条 REQ 条目的 SD 前缀须 ∈ 图 SD 节点集合（幽灵 SD 引用 SDMAP-2）；`SD-001` 词形数字与 `SD-2.1` 数字层级两种 id 形态天然兼容。
- **codeModule 锚点条目语法（SDMAP-5，破坏性硬切）**：条目从文件级升级为行号锚点级——REQ 行 `SD-<id>:<src路径>:L<start>(-<end>)?`、NFR/CON 行 `<src路径>:L<start>(-<end>)?`（整格「横切」特例免锚点），逗号多值逐条目校验（原正则对逗号串整体放行属侥幸，一并修正）；新增 `parseCodeModuleEntries` 解析器；倒序区间与双 L 形态拒收。
- **存在性 + 行号校验（SDMAP-3/4）经 srcLineCounts 注入面**：纯函数层不读盘，CLI（`check-artifact-gate.ts` 生产路径恒传 projectRoot）读盘构建 `path → 总行数` 表注入；条目 src 路径不存在 → SDMAP-3，行号违反约束（start<1 / end<start / end>总行数）→ SDMAP-4；注入面缺失时该两子项记 `skipped` 计数（不冒充 `passed`、不判违规），早退分支 skipped 口径统一为 injected 判定。
- **GATE_JSON 扩展（向后兼容）**：`JsonReport` 新增 `sdAnchorCheck` 与 `sdmapViolations` 两键，SDMAP-1..5 进 violations 分布与 structuredViolations；`check-artifact-gate.ts` 接线 srcLineCounts 读盘构建。
- **ChangeClassification 三值词汇 + 零交集守卫**：`topology`（集合成员差异）/ `semantic`（语义/映射/不变式内容差异）/ `evidence-only`（仅证据位置失效）三值；`StructuredViolation` 增可选 `classification` 字段，state-machine 四差异数组与 code-tla 四维度、SDMAP structuredViolations 分类标注（阻断性不变，仅供 R 根因定位与 reworkHints 排序消费）；**零交集 fail-closed 守卫**（cannot prove same system）：设计文档与代码无任何共享 ID 时 state-machine 对账 fail-closed（既有零证据守卫的扩展，两者分开报）；state-machine 新增分类差异清单。
- **code-tla D1 前缀精确对账同步**：代码-TLA+ 一致性回归维度 1（SD→codeModule 映射）与 gate-logic SDMAP 语义对齐，废除子串回退（`!` 行为收紧）。
- **文档与资产同步**：SSoT 先行（双向对账 + 锚点语法 + 分类词汇）；rtm/coding 模板、rtm-guide、phase-5-coding（格式规范与完成判据）、iceberg-sweep-guide §8.7、root-cause-locator（classification 消费排序）、conventions 术语表 3 条、command-reference SDMAP 条目；**B6 悬空引用修复**（`operational-recovery.md` 删除指向 `hard-constraints.md` 不存在锚「错误聚集与超标丢弃」的括注，改为指向本文「超标模块重写」节）；负向样本 ×2 入 NEGATIVE-COVERAGE 登记册 + self-test 用例（48 条 exit-2 探针零漂移）。
- **收口轮（prepush 驱动修复，2026-09-30）**：security-scan 首轮报 4 条新增发现——`import/order` ×2（`gate-enhancement.test.ts` 文件中部 `import type` 上移至顶部 import 块、`code-tla-logic.ts` parent/sibling 组间补空行，均为纯空白/搬移、行为零变化）**代码修复**；`detect-unsafe-regex` ×2（SDMAP-5 锚点正则的「可选 `-<end>` 行段」构造，与既有豁免先例 `iceberg-sweep-logic.ts` `EVIDENCE_ANCHOR_PATTERN` 的 `L\d+(?:-\d+)?` 同构，单正则无法消去嵌套量词）按扫描输出指引方案 2 `--regenerate` 重生成 baseline（265 指纹 / 366 豁免，v2 内容敏感指纹不变）；另有 `npm audit fix` 修复 brace-expansion（high，GHSA-q2hr-2g5m-vwhr 等上游新公告）与 fast-uri / markdown-it（moderate）传递依赖（仅 `package-lock.json`，9 包 semver 兼容 bump，`package.json` 未动），audit 归零。eval 语料 60/60（批次零影响实测）。

## [42.5.0] - 2026-09-29

### 测试/门禁优化（五波；规格 `docs/superpowers/specs/2026-09-28-test-gate-optimization-design.md`，裁定表 `docs/debug/2026-09-28-test-gate-optimization/teeth-adjudication.md`）

- **提速**：
  - prepush 三车道并行重组（Wave 4）：L1 并行车道（静态/独立项）+ L2 主车道（vitest 全量）同时发起、L3 尾车道（coverage-scope / docs-consistency）复用 L2 同次 JSON 与 provenance——19 项语义清单与退出码契约不变；首错即停→全量汇总（跑完全部车道再判定，任一不符 exit 1）如实登记；KEEP 证据复制置于全部 wait 之后（失败路径不丢 vitest JSON）。
  - CLI 测试进程内化（Wave 2）：`cli-invoker` 进程内调用层 + `runMain` VITEST 守卫 + spawn 层 VITEST 剥离（守卫前提经对照实验证伪后由控制者裁定补剥离）；9 个 CLI main 签名化（wrapper 三态收敛 HandledCliError / DuplicateFlagError→ARG_INVALID / UNEXPECTED）；真实子进程保真集中 `cli-subprocess-smoke.test.ts`（每 CLI ≥1 条），48 条 exit-2 探针不动；npx tsx 直调残留 7 处迁移 runSync。
  - 实测：prepush 总时长 **2144s（35.7min）→ 中位 1314s（21.9min，-39%）**；⚠️ **≤15min 硬指标未达**——重组后总时长 ≈ vitest 全量本体（~20min 主导；docs-consistency-logic ~367s 与 platform-deps-hook ~204s 两大慢文件均在规格排除面），达成需动用排除面或 serial 池再拆，超出本计划授权面，留待裁定（`docs/debug/2026-09-28-test-gate-optimization/wave4-closeout.md` 三选项）。
- **瘦身**：同质用例循环内聚合（Wave 3，276 族逐族登记「仍被覆盖/有意退休/核体后退回」，`merge-candidates.md` 执行登记 A-E + 补遗），vitest **2617→1874 例（-743，-28%）**，硬线 ≤2100 达成（余量 226）。形态纪律：循环内多断言（禁 it.each）、expect 消息逐条目指名、每迭代自备夹具、NEGATIVE-COVERAGE 载体逐夹具具名、排除面零触碰。
- **serial 池重组**：cli-serial 拆 a/b 两组组间并行（成员按 SUBPROCESS_TEST_FILES 索引奇偶派生，单一事实源不裂变；组内 fileParallelism:false 保留）——3 连跑零 flaky 门槛通过；清单 47→43（4 个零真实 spawn 文件移入并行项目）。
- **降维护**：SUBPROCESS 注释计数改自描述（清单长度以常量为准，`vitest-project-split.test.ts` 双向守护）；run-sync 台账 coverage-logic 三同锚条目随循环聚合收敛（审计溯源句保留）；台账 reason 行号史清理 17 条（迁移/豁免/超时事实保留）；self-test / eval 重审表 22 行如实登记（删减面未触发，无硬凑）。
- **牙齿重审（teeth-adjudication.md T1-T6，每处「原牙齿→替代承载」）**：
  - T1 coverage 双口径→**单口径化**：第 12 项全分母阈值撤销（2026-09-17 实测全分母 stmts 76.83 距阈值仅 1.8pp，「新增低覆盖 CLI import 即假红」），scope 口径（第 13 项 check-coverage-scope 80/75/90/85）为唯一强制牙齿；`npm run coverage` 不再全分母阻断。
  - T2 npm audit 容错→**收敛为枚举短表**：只识别 npm 前缀行上的明确网络层信号，未识别一律 fail-closed（只缩小可跳过面；5 个边界样例 skip→blocking 为预期收紧）。
  - T3 run-sync 台账锚点手工维护→结构字段确认已脚本守护（锚 1:1/timeout/migrated 齐全），reason 行号史清理。
  - T4 SUBPROCESS 清单注释计数漂移（写 41 实 45）→自描述 + 双向守护销账。
  - T5 run-sync.test.ts mock 盲点→如实登记 SUBPROCESS（宁串行勿漏判）销账。
  - T6 coverage exclude 全量不生效（机制未查明）→T1 后不再相关，历史注记如实保留销账。
- **验收口径**：终局 3 连跑 19/19 全绿零 flaky（1335/1314/1288s）；vitest 1874 例全过；漂移盲点 B9①-④ 全部修复或销账；flaky 零。

## [42.4.1] - 2026-09-28

> 来源：「遗留收口」批（用户裁定：**处理全部遗留**）——上一批「门禁/测试瘦身」（`[42.4.0]`，`73e7e036` 已并入 main）经整分支最终审查判定**可合并 / 无阻断**，同时留下 12 项「可延后」遗留（L1-L12）。规格 `docs/superpowers/specs/2026-09-28-leftovers-closeout-design.md`（§1 逐项处置表 + §4 验收策略 + §5 风险登记）、计划 `docs/superpowers/plans/2026-09-28-leftovers-closeout.md`，账本 `.superpowers/sdd/2026-09-28-leftovers-closeout/`（gitignored 账本，路径为引用非交付物；逐任务三件套 `task-N-{brief,report}.md` + `review-*.diff`）。**版本 bump 42.4.0 → 42.4.1**（判据：patch 级**行为可见变更**——Ajv `additionalProperties` 报错文案点名字段 + run-log schema 字段 description 文字订正；无判据 / 字段集 / 退出码变更）。口径沿用上一批：**修复为主**（不销账）、**零新增门禁**、**历史不改写**（`[42.4.0]` 及以下条目**逐字节不动**，L10 的补记写入本节）。**计数影响**：`vitest 用例数` 2615 → **2617**（+2 = L3 两条新单测；L9 与 L1 均为**既有用例内**补断言，**不增用例数**）；`self-test 381` / `samples 379 / 46 / 48 / 0` / `schema 34` / `exit-2 脚本 46` / `prepush 19` / `CLI 47` / `persona 33` / `references 44` 均不变。

### 逐项处置（L1-L12）

- **L1 · `additionalProperties` 报错点名字段（`fecc3d08` + `36934fe0`）——行为可见变更**：`infrastructure/schema-loader.ts` 抽出单条 Ajv 错误稳定格式化器——`<instancePath|/>: <message> [<keyword>]` 形态**逐字不变**，**仅** `keyword === 'additionalProperties'` 时末尾追加 `(额外字段: <name>)`（字段名取自 `params.additionalProperty`，非 string 时不追加）。原状为多条同文案、无法定位字段（WS-T7 迁移实测三条同文案）。**同族两处**：`lib/load-and-validate.ts`（`STRUCTURE_INVALID` 的 `detail`）与 `cli/wm-append-runlog.ts`（`assertRecordsValid` 的 `detail`）改为取 `errorMessages[0]`（**复用已格式化消息**，与人类可读 violations 同源），原始 Ajv `first.message` 降为兜底——两处 `ERROR_JSON` 的 `category` / `rule` / `field` / `file` / `exitCode` **全同**，`detail` 文案带上字段名（**不止该处**：`lib/load-and-validate.ts` 的 `detail` 前缀与 `[keyword]` 尾缀均新增；`cli/wm-append-runlog.ts` 原已拼 `[keyword]`，此次新增 `<instancePath>: ` 前缀；两处 `additionalProperties` 形态另加 `(额外字段: …)`）。既有 `it` 内补断言锁定（`schema-validation.test.ts` 断言 `(额外字段: unknownExtraField)` 在场）。
- **L2 · `run-log.schema.json` 的 `parentDispatchId` 描述订正（`fecc3d08`）**：原 description 写「在场时同 parentDispatchId 的**不**互计重复组」，与**实现**（`cli/check-budget.ts` 分组键守卫：`parent|timestamp|tokens|duration_s`——同 parentDispatchId 且键全同**仍计组**）及权威 `references/data-models.md`「用量实效校验（R6）」段**相反**。订正为与实现同义（「在场且非空时作为分组键前缀：同 parentDispatchId 且键全同仍计组；不同 parentDispatchId 即使其余键相同也不并组」+「legacy 记录缺字段维持现判定（空前缀）」）。**只改 description 文字**：字段集 / 类型 / `minLength` / 语义不变，description 仍在场（schema 字段 description 门禁不受影响）。
- **L3 · 派生锚块头如实三形态 + 两分支单测（`da82351a` + `9e8e480e`）**：`cli/check-samples-coverage.ts` 的 `[派生锚]` 块头原写「每行 → 覆盖位置（由 self-test.ts 用例条目派生，非手写）」，但 `invocation` / `mutated-copy` 行实际打印**本行落点**、fixture 不可派生时打印**占位**。块头改写为如实三形态：fixture 行 = self-test 派生覆盖位置（`self-test.ts#file: 'x.json'` / `self-test.ts#sampleDir: 'dir'`）；invocation / mutated-copy 行 = 本行落点（登记的第 2 列路径）；不可派生（不在盘 / 无覆盖条目 / 多义覆盖）→ `null`（人类可读侧打印占位说明，机器侧 `SAMPLES_COVERAGE_JSON.derivedAnchors` 的对应元素为 `null`，**数组按行序占位**不静默省略）。新增 **2 条**单测（`check-samples-coverage.test.ts`）：dangling fixture → `derivedAnchors:[null]` + 人类可读占位说明 + 块头三形态断言；`sampleDir:` 目录形态 → `self-test.ts#sampleDir: 'foo'`。**vitest +2 之全部来源**。
- **L4 · `check-budget.ts` 头注同一权威段两处指针合并（`fecc3d08`）**：`:18-21` 与 `:28` 两处同指 `data-models.md`「用量实效校验（R6）」段，合并为一处（指向 `--run-log` 参数说明；**头注内**同段权威指针只留一个入口）。**义务句（R5-b / R6 判据细节与上界口径的权威归属）全保留**；同文件其余位置的同段指针（`:179` / `:324` 注释与运行期诊断 `:334`）不属头注、不在本项合并范围。
- **L5 · `asset-budget.test.ts` 十处「当前实测」→ 历史口径（`da82351a`）**：裸写的「当前实测 N …」改为「立上限时实测 N …（此后以目录实测为准）」形态；文件头与 `ASSET_BUDGET` 块注同步（「注释里的数值只作**历史依据**，实际值以目录实测为准，不追新」）。**上限常量与断言一行未动**，用例数不变。
- **L6 · `examples/README.md` roster 枚举 → 义务摘要 + 双指针（`abcd6bb3` + `fe46cbc6`）**：原句复述闭环五脚本清单 + role-dispatch + signature-chain + 阶段 5-8 两门 + 旧 opsx 退役说明（roster 权威在 `operational-recovery.md`）。改为 ≤1 句义务摘要 + **双指针**：闭环五门 → `operational-recovery.md`「调用时机（阶段门执行顺序）」节；阶段 5-8 两门 → `subagent-delegation.md`「阶段 5-8 门禁顺序与 ChangeScope」节。保留既有 dispatch-matrix 指针（那是角色分派矩阵，非 roster），恢复「归档后」时序词（`codingPlanSnapshot` 条件项）。复审轮（`fe46cbc6`）收窄指针使锚串**按字面命中目标小节名**（上一批 T4 教训）。
- **L7 · `__tests__/README.md` 矩阵行三态复述 → 指针（`abcd6bb3`）**：`run-log-append-logic.test.ts` 与 `wm-append-runlog-cli.test.ts` 两行原内联时间戳三态 ①②③ 与两个逃生口细节，改为义务摘要 + 指针（`command-reference.md` 的 `wm-append-runlog.ts` 条目「时间戳三态」）。**验收口径澄清（写入规格 §4/T4 脚注）**：上一批 T4 的「枚举短语在权威外命中 == 0」口径**限定为「登记落点内 == 0」**——审计表登记的每个落点内应为 0；**摘要句与实现视角描述除外**（T4 例外清单既有）；审计表未登记的既存命中不属本口径校验面（若复述枚举，按新增遗留登记）。
- **L8 · `NEGATIVE-COVERAGE.md` 迁移说明逐条登记——核验已闭合，本批未改**：核验现状已含登记册原词的「其余样本」子句（`check-verifier-output`（D-10 形态三样本）、`check-maturity`（R5 真值通道样本）、`check-codegraph-queries`（G4-2 空查询目录 / 无索引两样本）、`check-coding-plan`（bad-missing-ledger / bad-task-missing-verify）），登记册 `:108-111` 逐行可对账。
- **L9 · docs-consistency 态 1 / 态 2 人类可读标签补断言（`da82351a`）**：态 2（自采集失败 `-1` 哨兵）的统计行文案「`vitest 用例  : 无法采集（不一致）`」原仅在注释中出现。在**既有用例内**补人类可读通道断言（`code === 1` + 该文案在场 + `not.toContain('跳过（未提供受控 vitest 工件）')`，与态 3 文案不混淆）；外层用例超时 120 s → 180 s（该用例含两次真实 CLI spawn，各 60 s 上限，实测 ~28 s，留负载余量）。**不新增用例面**。
- **L10 · `[42.4.0]` WS-T7 小节连带文件清单——补记（本节，历史条目不动）**：`[42.4.0]` 的 WS-T7 小节写「全链条，非仅停写」并指向账本，未点名全部连带文件。**补记（连带文件；本批核对 `43ce56c4` 全量 20 文件后，列出该节按功能面点名时未落名的文件与归档面同步件）**：`lib/run-sync.ts`、`lib/types.ts`、`logic/archive-integrity-logic.ts`、`cli/check-archive-integrity.ts`、`__tests__/README.md` 矩阵行；同次另有两份 archive 测试文件（各 2 行）与 `lib/run-log-append-fs.ts`（共 10 行：3 + / 7 −）等边角同步不逐一列名。该节已按功能面点名者（schema 两字段 / 追加器链计算与 `--correct` 载荷重算 / `check-run-log` R7 链复算段与 LEGACY 吸收分支 / `read-json-or-exit` 原始行数组 / checkpoint 放行锚读写侧与两违规码 / 文档面 / 三测试文件 −49 例）不在补记之列。
- **L11 · 长时门禁执行约定成文（`abcd6bb3` + `fe46cbc6`）**：`references/subagent-delegation.md`「任务合并与审查面」节新增一条：prepush 级门禁（19 项，≈35-45 分钟）与同量级长跑校验由**控制者置后台运行并自行等待结果**；子代理只做编辑与产出报告、**不同步等待**长跑命令（子代理持长跑命令同步等待会被 harness 判定停滞——**2026-09-27/28 两批共两次环境停滞事故均为此形态**）。**只写操作约定，不改脚本、不加门禁**；事故计数口径经最终审查轮定为「**2026-09-27/28 两批共两次**」，与 `references/subagent-delegation.md` 同句逐字一致。
- **L12 · 任务 1 报告处置 #13/#14 标注与报告措辞——核验已闭合，不改**：报告为本地留档（`.superpowers/sdd/**`，不随仓交付）；`[42.4.0]` 条目已如实写「**部分成立**」（见其「删除测试处置摘要」T1 条），未粉饰。本批未改。

### 计数与验收（本批实测）

- **vitest 用例数**：**2615 → 2617**（+2，全部来自 L3 两条新单测；L1 既有 `it` 内补断言、L9 既有用例内断言、L5 仅注释、其余为文档 / 注释面 → 零用例数变化；`testFileCount 106` 不变）。
- **self-test**：**381 → 381**；**samples 覆盖**：`fixtureCount 379` / `negativeCoverageRows 46` / `negativeCoverageProbes 48` / `probeFailures 0` 与基线逐字相同（L3 只改块头与新增用例，未动 fixture / 登记册 / 探针）。
- **门禁强制计数契约**：`schema 34` / `exit-2 脚本 46` / `prepush 19` / `CLI 47` / `persona 33` / `references 44` 均不变；**零新增门禁**。
- **自检（本批实测）**：`check-docs-consistency`（独立运行）exit 0、`npm run self-test` 381/381、`npm run audit:l0-links` exit 0；**终局全量 `npm run prepush` 19 项由控制者后台执行**（本批 L11 约定成文后的首次适用；结果见账本 `task-4-prepush.txt`）。
- **六镜像**：`package.json` / `package-lock.json` / `SKILL.md` frontmatter / `skill-metadata.json` / `docs/INSTALL.md` 激活示例 / `README.md`「当前版本」同步为 **42.4.1**。

## [42.4.0] - 2026-09-27

> 来源：「门禁/测试瘦身」批（用户裁定「不能为了校验而校验，为了测试而测试」）——对**校验机制本身**做外科手术：**留牙齿、砍记账**。规格 `docs/superpowers/specs/2026-09-27-gate-thinning-design.md`（WS-T1..T6 + §5 牙齿替代对照 + §7 风险登记 + **§9 去 hash 化，2026-09-28 追加**）、计划 `docs/superpowers/plans/2026-09-27-gate-thinning.md`，账本 `.superpowers/sdd/2026-09-27-gate-thinning/`（gitignored 账本，路径为引用非交付物；逐任务三件套 `task-N-{brief,report}.md` + `review-*.diff`）。**版本 bump 42.3.0 → 42.4.0**（判据：批次含行为可见的门禁变更——登记册语法与判据收紧、独立运行回退语义变更 + 新 flag、run-log schema 删字段）；节标题日期沿用计划口径 `2026-09-27`，**WS-T7 为其后一日（2026-09-28）追加指令**，见下方该小节。**计数影响**：`schema 34` / `exit-2 脚本 46` / `prepush 19` / `CLI 47` / `persona 33` / `references 44` 均不变（**有门禁强制的计数契约一处未动**）；vitest 用例数**自度量下降** 2674 → **2615**（−59 = T1 −14 / T3 +4 / WS-T7 −49；无任何外部常量断言该总数，见「计数与验收」节）。

### 门禁/测试瘦身（WS-T1..T6）

- **T1 · NEGATIVE-COVERAGE 自动探针化（`0c9c9481` + 修复轮 `e6351acb` / `f8a5f6c5`）**：登记册由 5 列（含手写「证据位置 / 锚」抄本）改为 **4 列** `门禁 | fixture | 机制 | 所防回归`。门禁侧删除 10 个锚机制符号 + 3 个仅服务它们的类型 / 常量 + 4 个违规码（`negative-coverage-evidence-anchor` / `-invalid` / `-relevance` / `-shared-anchor`）；新增**派生锚**（`self-test.ts#<覆盖条目标识>`，由 `collectCaseEntries` / `entryCoversFixture` 现算，进人类可读输出与 `SAMPLES_COVERAGE_JSON.derivedAnchors`（additive 键，控制者裁定②））与两条新违规码 `negative-coverage-not-failing` / `negative-coverage-ambiguous-coverage`。规则 4 收紧为「**fixture 机制行**：fixture 在盘 + 被 self-test 覆盖**恰一处** + 覆盖条目须为**期望失败**」（控制者裁定②：18 条 `invocation` / `mutated-copy` 行的 fixture 列是测试文件路径、无 case 声明覆盖，沿用「落点文件在盘」判据）。**48 条 exit-2 探针的代码与断言一字未动**（每探针独立隔离根 / 有界并发 4 路 / 零漂移断言 / `ERROR_JSON` + 人类错误行；模块头注随「有界并发 4 路」口径订正，属文档面、非牙齿改动）。换件一处：`check-artifact-gate` 行 `samples/gate/valid-phase6.json`（被 3 个 GATE_CASES 条目覆盖、含 1 条通过）→ `samples/gate/bad-rtm-coverage-below-100.json`（1 覆盖 + 期望失败）——原 phase=8 pending **断言仍在 self-test 执行**，登记册文案损失已在登记册「迁移说明」留痕。删行一处：`check-budget` 的次 fixture `samples/run-log/bad-duplicate-groups.jsonl`（G3-15 诊断样本、实测 exit 0 非阻断）按「非失败样本不得占行」删行（该样本仍由 `BUDGET_RUN_LOG_CASES` 执行）。
- **T2 · L0 计数去常量（`c184bd76`）**：`__tests__/helpers/l0-baseline.ts`（95 行：700 / 101 / 36 三常量 + 全部 rebaseline provenance 注释协议）整文件删除；两个测试文件移除 6 条「等于基线常量」断言（`relativeLinkCount` / `l1Only` / `placeholders`，logic 3 + cli 3）、2 条 import、3 行注释——**0 个测试用例（`it`）被删**（logic 38 / cli 11 不变）；`audit:l0-links` 三计数输出保留（可观测、非断言），`violations` 断言与全部负例（悬空 / L1 隔离 / 占位符形态 / exit 2）逐条保留。**fixture 级计数断言保留**（控制者裁定③：`relativeLinkCount: 0` 两处是分类行为的确定性结构性质，零维护成本）。连带清理：`asset-budget.test.ts` 两处注释去掉对已删 helper 的悬空引用（断言与上限值未动）；全仓活体资产「rebaseline / 重基线」指令**零命中**（该义务只存在于历史计划与 CHANGELOG 历史条目）。
- **T3 · docs-consistency 独立运行提速（`90bf568a`）**：动态 facts 组装三态化——**态 1**（`WM_VITEST_COUNT_FILE` / `WM_VITEST_PROVENANCE_FILE` 在场，即 prepush 第 15 项）**fail-closed 语义与实现一字不变**；**态 2** 新增 `--spawn-vitest` 显式逃生口（自采集 + 自生成同目录 provenance + 严格校验，行为等同原自采集路径）；**态 3**（缺省、独立运行）**不再 self-spawn**——跳过动态 facts、输出非阻断诊断（逐字文案入 `diagnostics`），`dynamicMeasurements` 置 `null`（键仍在场、形状稳定，消费者无需改），退出码由静态检查与 exit-2 探针决定。实测：独立运行 **35-45 分钟 → 11.04 s**（其中约 8.5 s 仍为 48 条 exit-2 探针真实 spawn；被移除的只有全量 vitest 自采集）。测试：`docs-consistency-logic.test.ts` 206 → 210（1 例语义替换 + 新增 4 例，含受控 stub vitest 走通态 2「spawn → 自 provenance → 严格校验」成功路径）；`lib/types.ts` 的 `JsonReport.dynamicMeasurements` 放宽为 `Record<string, unknown> | null`。文档同步：`command-reference.md` 新增「活体文档一致性门禁 CLI」节（三态 / 退出码 / 排障），`docs/troubleshooting.md` §1.7 / §1.7a-4 / §3 同步。**语义降级登记（规格 §7）**：独立运行属弱校验（静态 + 探针）+ 显式诊断；前提「终局验收一律 `npm run prepush`」已成文（AGENTS §6「迭代可走快速车道，验收必须全量」）。
- **T4 · pointer 化 8 簇（`ee8133fb` + `862843f1` + `8b718a83` / `fb782417` + `110b20dd` / `35c9c6c6` + `d505b414`）**：同一规则的**枚举只允许出现在权威一处**，其余落点改「≤1 句义务摘要 + 指针（权威文件名 + 可 grep 命中的小节号 / 唯一短语）」；8 簇权威与落点见表。设计决策句可另存 SSoT 但**不得复制枚举**；每簇改完以「指纹短语在权威外命中 == 0（摘要句除外）」grep 校验（逐簇真实证据见各任务报告 §3）。零新增门禁。三处修复轮裁定：① 为过 grep 指纹而改写权威措辞不可接受——`operational-recovery.md:480`（D-6 判据表，表头自称「判据（保留不变）」）**逐字回退**；② 「三形态」指针在权威无同名表述 → 在权威加标签「**证据形态声明（D-6，三形态判据）**」使指针可按字面定位；③ `data-models.md:1066` 删除「未解⑥a」陈旧状态标签。T4-A 另有 6 处纯 prettier 换行（行为中性，控制者裁定⑥：保留、仅如实登记）与两处自引入的错误指针（`check-budget.ts:18-20` 误标「logic 层」/ `:28` 误指「同文件「用量实效校验」段」）经审查发现后修复。
- **T5 · 易漂计数清扫（`3d1fa193` + 修复轮 `8b2d018a`）**：清扫**无门禁强制**的易漂计数 **28 处 / 10 文件**（其中 **8 处实测已漂移**：13→19 / 10→11 / 7→8 / 2→3 / 12→14 / 12→13 / 43→44 / 25→26 schema），处置为自描述（「数量以运行输出 / 目录实测为准」）或去数字；**保留**门禁强制的计数契约、测试断言中的机器事实、阈值 / 默认值 / 超时等契约常量、带日期的历史实测依据。修复轮一并处置审查发现：`command-reference.md:463` 退出码条补限定词（与同节 `:462` 的 `--spawn-vitest=1` 语义不再自相矛盾）、`INSTALL.md:111` 指针拆分为「.ts 总数见 `SKILL.md`「资源计数」段 / exit-2 口径见 `conventions.md`「exit-2 脚本口径」节」、`asset-budget.test.ts` 一处「当前实测」改历史口径（上限值与断言未动）。
- **T6 · 流程约定（`3d1fa193` + `8b2d018a`）**：`references/subagent-delegation.md` 新增「任务合并与审查面」短节（10 行：三条约定 + 边界句）——① **纯文档任务**（零 `.ts` / `.json` / schema / `.py`，且**同一阶段内**）合并为一个任务、单一审查面；② 审查出的 **minor 措辞类发现批量入账本**、随下一批同域任务顺带修复，**不触发逐轮 V→R→S-fix 返工**（明文化现状，与 §3.4.4「Minor 不进 loop」对齐）；③ 计划头部注明可合并分派条件。边界句：合并只减分派 / 审查面，**不减免任何门禁判据**。

#### T4 · 枚举权威表（8 簇，枚举只允许出现在权威一处）

| 簇                                           | 枚举权威（判定）                                                                                                                                                            | 其余落点（≤1 句摘要 + 指针）                                                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ① 时间戳三态（①②③ + 两个逃生口）             | `command-reference.md`（`wm-append-runlog.ts` 条目「时间戳三态」）                                                                                                          | AGENTS §6 / §8、SSoT §10D.6、`data-models.md`、`operational-recovery.md`、`subagent-delegation.md`、`wm-append-runlog.ts` 与 `run-log-append-logic.ts` 头注（实现短式）    |
| ② 非空本质判定族（`isFile()` 且 `size > 0`） | `command-reference.md`（「阶段 5-8 codegraph/coding-plan 门禁 CLI」节 coding-plan checker（R5）条）                                                                         | `hard-constraints.md`、`subagent-delegation.md`、`phase-5-coding.md`、SSoT §10D.8、`templates/coding-plan.md`、`scripts/samples/README.md`                                 |
| ③ `parentDispatchId` 键句与上界口径          | `data-models.md`（「用量实效校验（R6）」段）                                                                                                                                | SSoT §10D.7、`operational-recovery.md`、`toolbox.md`、`subagent-delegation.md`、`check-budget.ts` 注释（短式）、`run-log.schema.json` 字段 description（字段语义短式保留） |
| ④ 记录边界前缀三态                           | `command-reference.md`（「归档前缀性（L4，D-3b）」条）                                                                                                                      | `archive-integrity-logic.ts` / `check-archive-integrity.ts`（实现短式 + 运行文案）、`data-models.md`、`lib/types.ts` 字段语义注                                            |
| ⑤ 预算接线口径（未接线诊断 / 必带 / 上界）   | `data-models.md`（「用量实效校验（R6）」段）                                                                                                                                | SSoT §10D.7、`operational-recovery.md`（调用时机表 + 硬线段）、`toolbox.md`、`subagent-delegation.md`                                                                      |
| ⑥ 五门闭环与放行三步顺序                     | `SKILL.md`「阶段门放行三步」（复用既有权威：五门清单与调用顺序 = `operational-recovery.md`「调用时机」节；D-6 后置窗口 = 同文件「阶段 1 自举豁免（R11 后置窗口，D-6）」节） | `operational-recovery.md`、SSoT §10.6 / §10D.4 / §10D.7、`data-models.md`（R11 条）、`hard-constraints.md`（约束 #11）、`command-reference.md`（check-run-log R11 条）     |
| ⑦ 导出白名单与 provenance 形态               | 枚举 → `command-reference.md`「证据 provenance 与导出验证」节（+「Source-bound provenance 边界」节）；设计决策 → SSoT §7.10（只写决策与指针）                               | AGENTS §1 两节 / §8、`docs/INSTALL.md`、`README.md`、`CONTRIBUTING.md`、`data-models.md`（`evidence-provenance` 结构行保留字段语义短式）                                   |
| ⑧ codegraph 降级契约                         | 设计决策 → SSoT :283 段；操作枚举 → `command-reference.md`「阶段 5-8 …」节 codegraph checker 条（「证据形态声明（D-6，三形态判据）」）                                      | `phase-5-coding.md`、`hard-constraints.md`（约束 #14）、`data-models.md`（`codegraph-query` 结构行）、AGENTS §1、SSoT §10K.5、`scripts/samples/README.md`                  |

**规格外同域命中（grep 发现后一并改，逐条登记）**：`AGENTS.md:159` / `scripts/samples/README.md:21`（T4-A）、SSoT §10.6 :1466（T4-B）、`CONTRIBUTING.md:7` / SSoT §10K.5 :2223 / `scripts/samples/README.md:42`（T4-C）——均为本簇枚举的额外复述，属同域收敛，非扩面。

**例外（保留全文复述，不受 pointer 化约束）**：① AGENTS.md 的**一级红线单句**（导航可读性——如「CHECKPOINT 不可绕过」、run-log 时间戳真值纪律、交付 / 外发红线）；② **代码注释的实现视角描述**（实现自身谓词与短描述保留，**不得复制枚举**）；③ **版本六镜像**（交付契约）；④ **schema / enum / exit-code 等机器契约**（`w-model-dev/schemas/**` 字段 description、`GATE_JSON` / `DOCS_CONSISTENCY_JSON` 键、违规码与退出码字面、负向登记册与 samples 矩阵等门禁直接读取的机器面）。

#### 牙齿替代对照（规格 §5 逐行）

| 删除                       | 原牙齿                          | 替代承载                                                                                                                                                                                                               |
| -------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 手写锚证据与多锚语法（T1） | 「证据位置」指向 self-test 引用 | 门禁**派生**锚（同信息、机器现算、永不回填）+ 既有 rule 1 覆盖强制 + 「fixture 被 self-test 覆盖**恰一处**」新断言                                                                                                     |
| 非失败样本占行（T1 收紧）  | 无（本就无牙）                  | **fixture 机制行**的覆盖条目须为**期望失败**（`negative-coverage-not-failing` / `-ambiguous-coverage`，静态可校验的 `FAILURE_EXPECTATION_PATTERNS` 闭集）；门禁级「真实失败」由 **48 条探针**承担（行粒度 = 门禁粒度） |
| L0 精确计数断言（T2）      | 检测链接增删                    | `violations`（悬空 / L1 隔离 / 占位符形态）——检测「错」不是「变」；三计数仍由 CLI 输出可观测；rebaseline 协议与 `helpers/l0-baseline.ts` 整体退役                                                                      |
| 独立运行动态 facts（T3）   | 无工件时自采集成强校验          | prepush 第 15 项 **fail-closed 不变**（受控 vitest 工件路径一字未改）+ 独立运行**显式非阻断诊断** + `--spawn-vitest` 逃生口（**语义降级登记**，前提「终局一律 prepush」已成文 AGENTS §6）                              |
| 跨文件枚举复述（T4）       | 靠门禁 / 审查在 N 处同步        | 单一权威 + 指针；「枚举短语在权威外命中 == 0（摘要句除外）」可 grep 校验（逐簇证据见任务报告 §3）                                                                                                                      |
| 易漂注释计数（T5）         | 无牙（纯漂移债）                | 自描述表述（「以运行输出 / 目录实测为准」，**无数字可漂**）                                                                                                                                                            |

**WS-T7 的牙齿对照（规格 §9，2026-09-28 追加）**：行级哈希 / 放行锚移除后的替代承载 = R7 追加序 + R8 轨迹模板 + R9-R11 语义判据（源派生）+ 交付时文件级证据链（导出清单 SHA-256 / provenance / 角色签名链）；**逐条与诚实边界见下方 WS-T7 小节**。

#### 批间关系声明（T1 ↔ 清收批 G2-8）

清收批（`[42.3.0]` 节内登记）的 **G2-8 多锚语法**（`主锚 (；纯引用段)*` + 相关度判据 + 共享锚判据）是上一批为「**手写锚如何写完整**」而加的机制；本批 T1 从根上去掉手写锚（锚改由门禁从 `self-test.ts` 用例条目**派生**），该机制失去承载对象，故与其 **6 例测试**一并移除——**非反复**（判据对象已不存在，不是「先加后删」的摇摆；规格 §7 已登记）。

#### 删除测试处置摘要（不静默消失）

- **T1（`check-samples-coverage.test.ts` 35 → 21；删 21 / 增 7）**：其中 **5 条判定「仍被覆盖」**——#1 换判据（invocation 落点非路径 → `dangling`）、#6（fixture 不在盘 → `dangling`）、#21（缺列 → `malformed` 三态扩容）、#13 / #14（同名 fixture 区分；**如实登记为部分成立**：新测试覆盖「被两个条目覆盖 → `ambiguous-coverage`」等条目粒度判据，但「同名 fixture 分属两数组」场景未由新测试单独覆盖——攻击面随手写锚整体消失，按「有意退休」方向登记）；**16 条「有意退休」**：手写锚 / 多锚语法 / 旧行号语法 / 锚零命中 / 锚不唯一 / 空锚 / 相关度 / 共用锚等攻击面**随机制移除而结构性不可达**（逐条理由与替代指向见 `task-1-report.md` §3.2）。
- **T2：删除 6 条基线计数断言、0 个测试用例**（逐条「仍被覆盖 / 有意退休」及指向见 `task-2-report.md` §3）。
- **任务 7 修复轮：删除 1 个死变异半段**（`docs-consistency-logic.test.ts` 中 `install.replace('27 个 check-*.ts', …)`——该字面量随 T5 去数字而恒为 no-op）：**有意退休**（判据载体已不存在；INSTALL 该位置无门禁消费，`exit2ScriptCount === 46` 由同文件另一用例继续覆盖；AGENTS 半段与两条断言逐字保留），登记见 `task-7-report.md` §8.2。
- **WS-T7 / 任务 9：删除 49 条 run-log 用例（`43ce56c4`；三文件逐条对应）**：`run-log-logic.test.ts` **−29**（D-3a 链段 13 + D-3b 锚段 16）、`run-log-append-logic.test.ts` **−13**（D-3a 7 + D-3b 6）、`wm-append-runlog-cli.test.ts` **−7**——**全部「有意退休」**（机制按用户裁定整体移除，行级哈希 / 锚的可检出能力**不再主张**，完整性改由 WS-T7 小节的三类承载承担）；其中 3 例的**等价面仍被覆盖**：`--correct` 更正语义（同文件保留用例：只追加新记录、历史行逐字节不变、`note` 含 `correction-of:<runId>`）、宽容时间戳谓词（`run-log-append-logic.test.ts`「小写 t/z 时间戳仍作为单调下界」）、`check-run-log` CLI 端到端（`checkpoint-r0-bootstrap-cli.test.ts` 真实 spawn 断言 exit 0/1）。逐条处置与 helper 删除清单见 `task-9-report.md` §4。

#### 口径与边界登记（本批裁定与残余）

1. **T4 审计动作含「锚串须 grep 命中目标小节名」的反向校验**（本批实测教训：D-6 锚串与节标题实际含后缀不符，字面 grep 只命中指针行自身 → 7 处 / 5 文件锚串改为可命中的「阶段 1 自举豁免」节名）。零新增门禁，仅成文为审查动作。
2. **`eval/e2e/demo-assets/**` 的 D-6 枚举显式豁免**（控制者裁定⑪）：eval 属**批次外资产**（AGENTS §1「非技能包运行时代码、门禁不读取」），且为 e2e 回放资产、改动牵动 replay 语义——「权威外枚举命中 == 0」口径对该目录不适用（避免同批出现两种口径）。
3. **T2 后 `audit-l0-links` 的 `l1OnlyCount` / `templatePlaceholderCount` 两键仅剩可观测、无任何断言**（显式登记，避免未登记的能力退休；producer 与 `command-reference.md` 声明仍在）。
4. **三数 provenance 链的追踪面变化**：`helpers/l0-baseline.ts` 已删，`CHANGELOG.md` 既有条目（`[42.2.1]` / `[42.3.0]` 节）与 `docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md:476` 中指向该 helper 的锚现为历史锚（§3.5 历史不改写，本批未动）——三数（700 / 101 / 36）来历现仅存于 git 历史与 CHANGELOG 历史条目，后续读者勿按该锚追踪。
5. **T1 登记册「所防回归」子句的承载变化**（审查 deferred minor，如实登记）：换件 / 删行后，6 组同门禁次要样本退出登记册（check-verifier-output 的 D-10 三样本、check-budget 的 run-log 诊断样本、check-maturity 的 R5 真值通道样本、check-codegraph-queries 的两个 sampleDir、check-coding-plan 的 `bad-missing-ledger`）——其**断言与用例描述仍在 `self-test.ts` 逐条执行**，仅少「登记册文案」这一层承载（登记册「迁移说明」已逐条列名）。
6. **历史 / 内部规划面不改写**：`docs/superpowers/**`（含 `2026-09-22-e2-spec-amendment.md` 的旧锚形态）、`docs/changes/**`、`docs/debug/**` 与 `CHANGELOG.md` 历史条目（含 `:81` 一带的旧锚形态）按规格 §3.5 一字未改。
7. **`wm-append-runlog` 的 `digest` 保留定性（规格 §9 审计表末行）**：`digest` = 写入后**整文件**文本的 SHA-256（**文件级**，规格 §9 判定原则 1 允许面）；其唯一读取方是本工具自身的 stdout 机器键 `RUNLOG_APPEND_JSON.digest`（受 §3 全局约束 3「不改机器可读契约」保护），**无外部下游消费者**——故按**文件级遥测保留**，**不适用**「无消费者则移除」（该口径针对**行 / 记录级**哈希）（定性更正见 `task-9-report.md` §11-C；原报告曾误记为「活消费者」）。

### WS-T7 · 去 hash 化（2026-09-28 追加：移除记录级哈希链与 checkpoint 放行锚）

> **用户裁定（逐字）**：「禁止为了hash而hash行为，比如为了证明某个文件更新过程可以有独立签名链和git提交记录，但一行文本不应该有这种东西，概念一致性应该是源派生方式而不是hash一致化，有的以上情况都需要整改。」

**判定原则（规格 §9，全仓 hash 机制审计；覆盖 §3.1「证据防伪链（哈希链）」的冻结）**：① 证明**文件 / 制品**级更新过程 → 允许（独立签名链 / git 提交记录 / 逐文件 SHA-256 / 文件级 provenance / 受控工件绑定 / 供应链校验）；② **行 / 记录**级文本**不得**携带哈希（链）或前缀哈希来证明其更新过程（即「为了 hash 而 hash」）；③ 一致性（计数 / 锚 / 口径）一律走**源派生**（现算 / 实测 / 单一权威 + 指针），不走 hash 一致化。

**移除（`43ce56c4`；全链条，非仅停写）**：**记录级哈希链（D-3a）**——`run-log.schema.json` 的 `prevRecordHash` / `recordHash` 两字段（含分支与 description）、追加器链计算 / 前驱扫描 / 载荷重算覆盖、`check-run-log` **R7 链复算段**与首个带哈希记录之前的 LEGACY 吸收分支、`read-json-or-exit` 仅服务锚的原始行数组；**checkpoint 放行锚（D-3b）**——`runLogAnchor {lines, sha256}` 字段、前缀摘要计算与相关导出函数、写入侧自动填锚与 `ANCHOR_MISMATCH` / `ANCHOR_UNVERIFIABLE` 两个违规码、读侧 `RELEASE_ANCHOR_CUTOFF` 与锚校验段（其存在理由「哈希链只保护链自身、可被整链重算」随链一并消失）；文档两节（`data-models.md`「记录哈希链」「checkpoint 放行锚」）与 `command-reference.md` / `AGENTS.md` / `SKILL.md` / `references/{operational-recovery,hard-constraints,signature-chain-guide}.md` / SSoT 的 D-3a / D-3b 表述；三测试文件 **−49 例**及全部链 / 锚 helper（逐条处置见「删除测试处置摘要」）。活体面指纹（`recordHash|prevRecordHash|runLogAnchor|哈希链|放行锚|D-3a|D-3b`）grep **零命中**（历史面按「历史不改写」原样保留）。**未新增 legacy 吸收分支**——否则会在活体代码中重新引入已删字段字面量。

**保留（文件 / 制品级；规格 §9 审计表逐行）**：角色签名链 `sigHash` / `prevSigHash`；evidence-manifest / evidence-provenance 逐文件 SHA-256、`sourceBundleSha256`、`workspaceDigest`、`commitSha`；code-health 全部哈希（逐文件 sha256 + approval / archive / ledger / candidate / test-inventory 摘要 + file-verifier / deletion-authority 删前校验）；gate-log 内容摘要；docs-consistency 受控 vitest 工件绑定（`artifactSha256` + `commitSha`）与 `runId = sha256(raw)`（派生态）；platform-deps 归档 sha512（供应链）；security-scan baseline 命中指纹。**`wm-append-runlog` stdout `digest`**：经审计定性为**无外部消费者的写入批遥测**（整文件文本 SHA-256，**文件级**、非记录级；产出方与消费方同属本工具，测试的逐字节断言不构成外部消费者）→ **保留并登记**（更正见 `task-9-report.md` §11-C）。

**迁移口径（旧版追加器写入的本地 run-log；实测定性）**：`[42.3.0]` 批（2026-09-25 ~ 2026-09-28）由旧追加器写入的 `.w-model/run-log.jsonl` 含上述三字段，在新 schema（`additionalProperties: false`）下 **invalid → fail-closed**：`check-run-log` 输出 `条目 N [schema] /: must NOT have additional properties [additionalProperties]`（**通用文案、不点名字段**；本批实测三字段逐一命中）并 exit 1；`wm-append-runlog --correct=<旧放行记录>` 因 `planCorrection` 的 `{...base}` **继承被更正记录的字段**而 exit 2（`STRUCTURE_INVALID`；A/B 实测：同一 patch 对无该三字段的历史进入写入流程、对该形态即 exit 2）。**处置 = 重跑追加或重建工作区，不得就地改写历史行**（历史不改写纪律；该判断属项目侧裁定，非本批单方决定）。**仓内实测零命中**：`samples/run-log/**`（26 fixture）、`__tests__/fixtures/**`、`docs/debug/**` 快照（443 行）与全仓 `*.json` / `*.jsonl` grep 均零命中，故本仓门禁与测试不受影响。

**替代承载 + 诚实边界（规格 §9「牙齿对照」）**：run-log 完整性 / 可检测性由 ① R7 追加序（相邻时间戳单调）+ R8 轨迹模板 + R9-R11 语义判据（**全部源派生**）；② 交付时的**文件级**证据链（`wm-export-evidence` 导出清单 SHA-256 / provenance）；③ 角色签名链（文件级 `sigHash`）承担。**诚实边界（已写入 SSoT §10D.6，并由 `data-models.md` 指针指回）**：行级哈希保证**不再主张**——R7 追加序只约束相邻时间戳单调，故 **改 note / 删中段行 / 保持单调的时间戳改写均不再可检出**（这三类改写的可证伪性只在交付时的文件级证据链，不在读侧判据）。R7 追加序的覆盖指向 `w-model-dev/scripts/cli/self-test.ts:1387` + fixture `samples/run-log/bad-exitcode-mismatch.jsonl`（**非** `run-log-logic.test.ts`——该文件 `grep -c "非 append-only"` = 0）。

### 计数与验收（本批实测，含 WS-T7）

- **vitest 全量**：**2674（基线）→ 2660（T1 −14）→ 2664（T3 +4）→ 2615（WS-T7 −49）**，`testFileCount 106` 不变（`helpers/l0-baseline.ts` 是 helper 非 `*.test.ts`）。分项（逐文件，实测）：T1 `check-samples-coverage.test.ts` 35→21；T3 `docs-consistency-logic.test.ts` 206→210；WS-T7 `run-log-logic.test.ts` 161→132（−29）/ `run-log-append-logic.test.ts` 39→26（−13）/ `wm-append-runlog-cli.test.ts` 33→26（−7）；T2（删断言不删用例）/ T4 / T5 / T6 / 任务 7（删 `it` 体内写盘行，用例数结构性不变）用例数均不变。**该总数无任何外部常量断言**（T2 已退役 rebaseline 常量，见「牙齿替代对照」）。
- **self-test**：**381 → 381**（未改 `self-test.ts` 用例数组；T5 / T6 / WS-T7 只改注释与文案）。
- **samples 覆盖**：`fixtureCount 379` / `negativeCoverageRows 46` / `negativeCoverageProbes 48` / `probeFailures 0` 全部与基线逐字相同。
- **门禁强制计数契约**：`schema 34` / `exit-2 脚本 46` / `prepush 19` / `CLI 47` / `persona 33` / `references 44` 均不变（T5 清扫只动**无门禁强制**的计数）。
- **L0 链接审计三计数（T2 后仅可观测、无断言）**：本批文档改动后实测 **725 / 97 / 36**（`relativeLinkCount` / `l1OnlyCount` / `templatePlaceholderCount`；`violations: []` / exit 0）；基线对照 **700 / 101 / 36**（2026-09-27 deferred-closeout 终值）。
- **docs-consistency 独立运行**：**11.04 s**（T3 实测；收口复测 **13.3 s**，冻结节实测——13.96 s 为被覆盖的中间态运行；含 `npx tsx` 启动与 48 条 exit-2 探针约 8.5 s 的真实 spawn）——此前同命令 35-45 分钟；输出含非阻断诊断「动态 facts 未校验」，`dynamicMeasurements: null`，`exitCode 0`（态 3 语义，独立运行不再 self-spawn 全量 vitest）。
- **终局验收（收口实测，2026-09-28）**：`npm run prepush` **19 项全绿 / `PREPUSH_EXIT=0`**（含全量 vitest + coverage 阈值、规则层覆盖口径、npm audit、48 探针、tsc、prettier、eval；逐项输出见账本 `task-8-prepush.txt`）；独立运行 `check-docs-consistency` **13.3 s / exit 0**（`task-8-report.md` 冻结节实测；13.96 s 为被覆盖的中间态运行；证据文件 `task-8-docs-consistency.txt` 含 `DOCS_EXIT=0` 与该次 stdout，**不含计时行**）；`check-samples-coverage` **exit 0**（`task-8-samples-coverage.txt`：`fixtureCount 379` / `negativeCoverageRows 46` / `negativeCoverageProbes 48` / `probeFailures 0` / `derivedAnchors` 在场）。

## [42.3.0] - 2026-09-27

> 来源：8 阶段 live run 调测发现全量修复计划的 Wave C 与收口（发现项 D-9、D-10、遗留 ③④⑥、N-4/N-7；规格 `docs/superpowers/specs/2026-09-25-live-run-findings-remediation-design.md` §5-§6、计划 `docs/superpowers/plans/2026-09-25-live-run-findings-remediation.md` 任务 13-20）。Wave A/B 已在 `[42.2.1]` 节登记（不 bump 惯例）；本节为 Wave C + 全计划收口，**版本 bump 42.2.1 → 42.3.0**（规格 §8 O-3 取值：批次含行为增量——新 flag、新判据、新 schema 字段族）。**计数影响**：Wave C 未新增 CLI / schema / references 文件，exit-2 族保持 **46**、schema 保持 **34**、反模式保持 **48**。

### Wave C：披露面、产物形态与遗留销项（2026-09-27）

- **WS-8 归档披露面规则澄清（D-9，`references/phase-8-acceptance-test.md` + `AGENTS.md` + `docs/INSTALL.md`，commit `ce8748bf`；修复轮 `f72fbf6a`）**：改写「archive 产物禁止具体文件路径」的不可执行口径——**归档允许保留执行证据原貌**（gate-log 头部 `cwd`/输入路径属本机真实执行证据，不得就地脱敏）；**禁止的是设计文档与归档 README 中的具体文件路径**；新增交付义务句「**交付/外发前必须经 `wm-export-evidence` 生成脱敏包；禁止直接外发归档目录**（归档仅作受控留档、不构成交付物；如需交付走脱敏导出链生成独立副本，白名单不含 `docs/changes/archive/`）」，五处同步（phase-8 / AGENTS 两节 / INSTALL / verifier-spec 归因口径）。**D-9 订正**：live-run 报告所称「已在归档 README 与 checkpoint-log 披露」经 grep 复核**不成立**（归档 README 零命中）；实测 185/366（非 186）件含本机绝对路径，tracked `docs/changes/archive/**` 零命中。
- **WS-9 V 产物形态固化（D-10/N-4，`logic/verifier-logic.ts` + `references/subagent-delegation.md` + `references/verifier-spec.md` + `references/agent-personas.md`，commit `e094a730`；修复轮 `f72fbf6a`）**：等差文案追加改进指引（「请改用真实离散值（相邻打分差值不得恒等、不得为 0.01 完美等差）」）；O3 evidence 失败拆两路——正则不匹配 →「**格式不符**（须 `path:Lnn=stmt` 或 `path:§sec=stmt`，单 L 形态）」（双 L 形态 `path:L51-L53=` 从此有正确修法指向），匹配但空泛 → 保留「空泛声明，O3 命中」；V 简报模板固化三条硬约束（rawScores 真实离散 / evidence 单 L 锚定 / `reviewedAt` 真实时刻且不早于被评审产物）+ 自检清单 +2 条；新增 3 负样本 `bad-arithmetic-sequence` / `bad-resolution-floor` / `bad-evidence-double-l.json`（各自 exit 1）。**D-10 标签订正**：等差判据实为 P3.10（非 R13），R13 是单轴下限——报告标签错位。
- **WS-10 遗留销项③：归档快照激活（`eval/e2e/demo-assets/build_workspace.py`，commit `0937b252`）**：归档根补编码计划快照（`phase8-demo.plan.md` + `progress.md` + `task-<N>-{brief,report}.md`，形态对齐 `samples/archive-integrity/valid-coding-plan-snapshot/`），重建后 `check-archive-integrity.ts archive/2026-09-19-counter-api` **exit 0** 且快照判定依据 = 自动派生（归档根恰一 `*.plan.md`；驱动不传 `--change-id`，覆盖自动派生分支）；同时修正装配器 fixture 内部不一致——基准态 `rtm.json` 的 `designDoc` 按真实 RTM 形态登记全设计链 `SD-001,INTF-001,DD-001`，iceberg R6 宽池 `graph↔rtm` 差异在阶段 2/8 复跑实测消失（改前 exit 1 报 `R6[design-wide] 差异项：INTF-001, DD-001`，改后 exit 0）。
- **WS-10 遗留销项④：counter.ts 不变式断言（同装配器，commit `9d02125d`）**：`src/counter.ts` 模板补 `import assert from 'node:assert/strict'`，`inc()` / `reset()` 各加 `assert.ok(this.value >= 0 && this.value <= 10, 'invariant: 0 <= value <= 10')`（与 TLA+ `BusinessInvariant` 的 `TypeInvariant` 同锚）；重建后 `check-code-tla-consistency` **exit 0**（维度 1/2/3 判定一字未动，维度 4 断言覆盖不变式 ✓），门禁未放宽。
- **WS-10 遗留销项⑥(a)：无 git 工作区 no-git provenance（`logic/evidence-provenance-logic.ts` + `cli/wm-verify-evidence-source.ts` + 两 schema，commit `a9654f58`；修复轮 `8b672072`）**：无 `.git` 工作区从「`MISSING_GIT_HEAD` exit 1 结构性不可用」改为**显式 `--no-git-ok` 才产出 `provenanceKind='no-git'` 形态**——`commitSha` 置空、以 `workspaceDigest`（导出源文件集合规范化清单 SHA-256）替代 HEAD 身份；**永久 package-only 护栏**：`--source-project` 复验一律拒绝（`NOT_SOURCE_BOUND_NO_GIT` exit 1），修复轮把「恒自述 package-only」补齐到全部出口——`verifySourceProvenance` 返回值（含 `allowNoGitRecord` 本地一致性例外路径）、`wm-export-evidence` 成功摘要（no-git 包带 `verificationLevel:'package-only'` 键、git 包不带）与两处 schema description 同值说明；**全仓不存在把 no-git 记录表述为 source-bound / verified source 的出口**。
- **WS-10 遗留销项⑥(b)/N-7：导出白名单与 producer 口径统一（`logic/evidence-export-logic.ts` + `logic/evidence-provenance-logic.ts`，commit `557553d4`）**：导出白名单与 provenance 生产者**统一接受根级 `signature-chain.jsonl`**（全仓约定形态，`signature-chains/` 复数目录保留为 legacy 兼容）——修复前真实项目的导出链**整体不可用**（producer 要求复数目录 → 恒 `MISSING_SIGNATURE_CHAIN` exit 1）；根级文件与 legacy 目录**并存即 fail-closed**（`SIGNATURE_CHAIN_AMBIGUOUS`，链位置歧义不作猜测）；两侧（导出与 verify）共用同一白名单函数保持双向对称；`AGENTS.md` / `docs/INSTALL.md` / `command-reference.md` 白名单复述同步。
- **证据保全入库（commit `83d41810`）**：两轮 8 阶段调测证据快照入库 `docs/debug/`——`2026-09-23-wm-8phase-live-run/`（live run #2 报告 = D-1..D-10 发现来源 + snapshots/：run-log 443 行 / signature-chain 166 环 / project.json / orchestrator-state / 11 份终局电池日志）与 `2026-09-19-wm-8phase-full-debug/`（全流程调测报告 + 证据树 + logs/：self-test 358/358 ×2 / prepush 19 项 / 真实 SANY/TLC 正负例 / 119 次命令轨迹 / 9 项篡改探针）；依据 AGENTS.md「销毁前证据保全（快照入库 docs/debug/）」在 Task 19 重建销毁前完成。pre-commit 排除清单补 `docs/debug/*`（与 `docs/changes/*` 同 rationale：执行证据原貌入库，不做 prettier 重排——快照 `project.json` 保持 wm-write 产出字节原貌）。
- **demo 重建重放（Task 19，commit `b39a0acf`）**：`build_workspace.py --reset` 后 `run_trajectory.sh` **119/119 全 exit 0**（真实 SANY/TLC + 四级测试 + 闭环五门 + 签名链，TOTAL_GATE_RUNS=119 / NONZERO_EXIT_COUNT=0）+ `run_negative_probes.sh` **9/9 被拦截 + 恢复复绿**（restore-check 双门 exit 0、探针残留 0）；证据 `docs/debug/2026-09-25-wave-c-replay/`。**首跑实录（scope 前置被真实验证）**：工作树含未提交文档编辑时重放，p5/p6 artifact-gate scope 校验实测拦截（「实际变更未在 changedFiles 声明」×2 → exit 1）——「先提交再重建」不是纸面纪律；作废部分态经装配器销毁前护栏自动快照（gitignored `demo-snapshots/`），裁定 `--accept-state-loss` 重建。
- **收口同步（Task 20，commit `a2bf181c` + 本节）**：SSoT §10D.7 R6 弹补三句（未接线诊断不静默 / 权威调用表必带 `--run-log` + `--phase=N` / Σtokens 上界口径 + R3 三条目归账约定——Task 11 PARKED 销项）；`data-models.md` schema 表 `evidence-provenance` 行补 `provenanceKind` 二形态说明（Task 17-18 疑虑③销项）；SSoT §10L.3（Task 1）与 §4A.2a（Task 4） 复核已在盘。计数核对三项 exit 0：`check-docs-consistency`（schema 34 / CLI 47 / exit-2 族 46 / 测试 106 文件 2615 例全一致）、`check-samples-coverage`（374 fixtures / 48 探针零失败）、`audit:l0-links`（699 链接零违规）。版本 bump 42.3.0 四处同步（package.json / package-lock.json / SKILL.md frontmatter / INSTALL.md 镜像）。

### 报告口径订正（跟踪面登记；debug 报告本体不改写，以规格 §1 核验裁定为准）

> 以下订正针对 `docs/debug/2026-09-23-wm-8phase-live-run/README.md` §四 的发现表述；现象全部成立或部分成立，**归因/口径/计数**按代码事实与实测改写（逐字证据见规格 §1 表）：

- **D-2 计数**：「每阶段需双份 R3×9」不准确——真实成本是 **12 份 stage 级 MD（R3×9 + V×3）+ 3 份 phase 级 JSON（每阶段×变体）**；双轨（MD 证 stage 粒度 / JSON 证 findings 结构）是 `hard-constraints.md:57` 明文设计-of-record，非意外；聚合硬义务属 `check-artifact-gate` strict 聚合的既有语义。
- **D-4 已消解**：「R11 与 check-checkpoint 自我指涉 → 逐阶段自举死锁」在当前 HEAD **不存在**——R0 首阶段自举形态（E-2 方案 B，`checkpoint-logic.ts:241-250`）早于调测起始日已实施；阶段 ≥2 自然时序双门实测 exit 0；残余的是**顺序纪律未成文**（已由 Wave B Task 10 的三步顺序 + 四处例外登记补齐）。
- **D-5 归因**：① 时间戳静默覆盖发生在**调测自建物** `olog.py`（gitignored，非技能包资产）；技能包侧的真因是**缺 O 侧 append 工具**（N-5，已由 Wave B `wm-append-runlog` 补齐）② Σtokens 重复归账实测可归因 **13.9%**（15 组 R3 三条目共 72.8M），非「约一半」；真因是 **9/9 次 `check-budget` 调用均未传 `--run-log`**（N-6，已由 Wave B 接线 + 诊断补齐）。
- **D-8 方向**：「文档称阶段 1 允许后置、实现要求严格早于」**方向写反**——实现确实有 phase-1 × `check-checkpoint` 后置窗口；真实缺口是四处例外登记缺失与 `SKILL.md` 未写「放行记录须为阶段末条」（已由 Task 10 补齐），`AGENTS.md:160` 另有无行号悬空引用（已换实锚）。
- **D-10 标签**：「等差判据属 R13」错位——等差/完美构造判据是 **P3.10**（`verifier-logic.ts:533-555`），R13 是单轴下限；O3「空泛声明」文案的真实成因之一是**双 L 形态**不符 `EVIDENCE_PATTERN` 却被误报（N-4，已由 Wave C 文案拆分修复）。
- **D-9 订正句**：见上 WS-8——「归档 README 已披露」不成立（grep 零命中）；185/366（非 186）。

### 显式不修项（规格 §6，九条，随版本登记）

iceberg `tla` 视角不加宽到 DD/INTF（规约冲突，WS-1 方案 B 否决）；R3 双轨不合并（会弃掉 `passed=false ⇒ findings ≥1` 与反模式 #33 机器挂点）；归档不就地脱敏（破坏执行证据原真性与 sha256 等价契约）；`check-archive-integrity` 绝对路径诊断（中等成本无阻断力，后续可选）；`reviewedAt` 时序门禁（时钟依赖破坏 logic 纯函数）；budget Σtokens 去重字段（去重键在 legacy 记录上不可靠，后续可选）；不新增反模式编号（伪造时序禁令走约束 #11 补充句）；不删除 R11 的 phase-1 后置窗口（会打红历史 run-log）；R5 行级证据锚不阻断化（实测 demo 15 份既有 review 锚命中 0，阻断化立即打红全部历史证据——先以非阻断诊断观察，后续版本按适配情况评估升级）。

### 未解/延后清收（2026-09-27）

> 来源：`docs/superpowers/plans/2026-09-25-live-run-findings-remediation.md` 批次账本（`.superpowers/sdd/2026-09-25-live-run-findings-remediation/progress.md`，gitignored）全部 minor(deferred) 项 + `[42.3.0]` 显式不修项中的「后续可选」2 项 + `docs/debug/2026-09-19` 报告 F-5。规格 `docs/superpowers/specs/2026-09-27-deferred-closeout-design.md`、计划 `docs/superpowers/plans/2026-09-27-deferred-closeout.md`，账本 `.superpowers/sdd/2026-09-27-deferred-closeout/`（gitignored）。版本保持 42.3.0，**不 bump**（纯收口批；先例：Wave A/B 行为增量同样登记于既有版本节内）。

**处置统计（账本行合并口径）：62 = 修 51 + 销账 8 + 显式不修 3。** 四组任务：G1 文档措辞（任务 1-3）/ G2 测试补强（任务 4-5）/ G3 代码小额（任务 6-8，含两处守卫修复轮）/ G4 登记与夹具（任务 9，含 F-5 阶段 2-4 图谱正例 3 份）。

- **G1 文档措辞（`b80eb400` / `28183c65` / `f99180ec`+`06ca4fe0`）**：时间戳三态编号统一（权威序 ①显式≤末条拒绝 / ②无显式且时钟真倒退拒绝 / ③无显式且同毫秒良性步进 `clock-adjust:auto+<N>ms`）与四处补 ③ 形态；command-reference 拒绝原因枚举补全（`TARGET_MISSING_FOR_MTIME`/`INVALID_JSON`/`TIMESTAMP_CONFLICT`）+ `--json` 键（`ok`/`legacyInvalidLines`）；SKILL.md 五门表达与调用表口径对齐；预算接线「读取失败不出未接线诊断」句与「Σtokens 上界口径 + R3 归账」句；「非空(size>0)」族统一为「非空且为普通文件（`isFile()` 且 `size > 0`）」（7+2 处）；WS-1 判据句改宽并集表述；「禁双 L」登记；SSoT §10C/§10D.8 交叉引用；wave-b 证据 README 四处订正（时间窗经日志原件 CreationTime 校正 19:51→20:15 ≈ 24 分钟）。
- **G2 测试补强（`efb6b74` / `98a156fe`）**：maturity 三态断言 + `countSuspectedDuplicateGroups` 直测 + codegraph 两子分支 + artifacts CLI 断言（C12/C12b，**审查实证「预期红」不成立**——门禁路径早已 exit 1，原发现属 `--preflight` 只列不计数语义）+ 窄池退化用例（设计红，任务 6 翻绿）+ 追加器边界三态（CRLF/BOM/无换行）+ 锁时值非法形态；**NEGATIVE-COVERAGE 多锚语法**（`主锚 (；纯引用段)*`，向后兼容——46 行 old/new 逐字节同输出实证；第二锚破坏→exit 1 经控制者与审查者双独立验证）。
- **G3 代码小额（`3320e0e5`+`ea2773e2` / `778fe4b6` / `0c823ef5`）**：索引探测 stat 判别（有效 symlink/junction → present，异常诊断仅 stat 不可达时输出）+ `collectRootFile` isFile + 窄池空基准守卫（`wideUnion.size === 0`，结果类型增可选 `diagnostics`）+ 锚诊断时点（scope 解析成功后）+ preflight 竞态守卫（`FILE_NOT_FOUND` 结构化）；白名单常量单源（**方向裁定：常量归 producer 模块所有、exporter import**——反向会构成运行图环被 `dependency-boundaries` 拒绝）+ 编码链正则/账本路径单源 + 「记录边界前缀」文案 5 处 + 超时注释统一 + security baseline orphan 5 条清理（289→284，新增 0）；**行为增量三项**：`parentDispatchId` 可选字段 + 疑似重复归账键守卫与精确化（`tokens` 有限正数 / `duration_s` 数字才入组；同 parent 且键全同仍计组）/ 归档清单绝对路径非阻断诊断（注入面，zero-fs）/ R5 读路径非 O1~O6 过滤 + 诊断（**语义边界：uniqueItems 与「存在即累加数组长度」口径不变**）。
- **G4 登记与夹具（`205d908f`）**：NEGATIVE-COVERAGE 补回 `bad-missing-ledger`/`bad-empty` 登记 + 新增 `bad-cli-kind-without-index`（check-budget 非失败次锚以第四列「次锚非失败证据」澄清，不改锚）；**F-5 阶段 2-4 图谱正例 3 份**（8/25、10/33、11/36 节点边数，`check-requirement-graph --phase=N` 实测 exit 0，无投机豁免字段）；SSoT §10L.3 `ICEBERG_VIEW_PRESENCE` 在场表按代码常量定值（阶段 1=graph+rtm / 2-4=+tla / 5-8=+scope，与 live-run p1-p8 日志信号一致）。
- **收口前置（`e6952595`，carry-forward 文档对齐）**：AGENTS §6 run-log 条改三态表述（与 §8 对齐）；CHANGELOG Wave B ③ 条补「无显式时间戳且」限定语；预算诊断文案与 data-models/operational-recovery 键句补 `parentDispatchId`；`RunLogEntry` 接口补 `parentDispatchId?`。另注：本批 G3-14 使 Wave B 条目「该 CLI 从不读 `archive-manifest.json`」**字面不再成立**（仅供新增诊断读取归档根清单；其关于快照判定来源的实质结论仍真）。

**销账 8 项（理由全文，销 = 有登记无代码改动）**：① O3「空泛声明」桶恒不可达——`^` 锚定与 `path:` 前缀互斥是既有判据形态，令其可达会改变全部 evidence 判定语义、误伤正常产物，保留为语义兜底并升级为显式不修；② `collectExportSources` 冗余防御——防御性分支在输入异常时给出稳定失败，删除属「为修而修」且降稳健性；③ 归档快照命名不闭合——「目录名须以 changeId 结尾」口径无任何门禁消费，强改破坏「与阶段 8 活动位产物同源」语义；④ `--preflight=true`/拼错旗标静默忽略——全仓布尔 flag 既有语义（`--json` 同），全 CLI 严格化属独立主题；⑤ state-write appended 口径吸收非法 JSON 历史行——与裁定 E「历史行非阻断」一致，收紧会打红合法 legacy 追加场景，产品路径无洞；⑥ 逃生口 `--timestamp` 互斥表述——CLI 头注已在 2026-09-26 修复轮收口（可证纯注释），剩余文档复述已由本批 G1-16 完成；⑦ `test:affected` 无记录——快速车道「不得作验收依据」已成文，为无效通道补记录无信息增量；⑧ writer 比 checker 宽容无告警——追加器写盘时链字段由追加器自身构造（`--correct` 已剔除继承），该形态产品路径不可达且 checker 有牙。

**账本全量审计补充（44 行 deferred 逐一核对，2026-09-27）**：清收批对 2026-09-25 账本全部 44 行 `minor (deferred)` 逐行核对处置落点，结论——**44 = 39 行本批 G1-G4 处置（修/销）+ 4 行前批修复轮已处置（账本 L33/L39/L40/L56）+ 1 行登记为不修（L62）**，另有 4 类情形补充如下：① **审计新增两处一行修复**（`5cd73b19`）：陈旧锁 `STALE_LOCK` 逃生口文案补「手工删除 `<target>.lock/` 目录」与 `wm-write.ts --recover-stale-lock` 双路径；SSoT §10D.4 编排者维护职责表补「放行三步顺序」交叉引用（机器核验指向 `check-run-log` R11）。② **复核确认已处置（前批）**：「`--run-log` 提供但读失败时 R5 静默跳过」——前批修复轮已实装 `⚠ --run-log 文件读取失败，跳过 R5…` 警告（`check-maturity.ts:244/:254`，告别静默），本批复核确认；装配器 `rtm.designDoc` 全设计链引用与 demo `iceberg-reports/` 快照口径改向，均由前批 Tasks 15/16 与验收方式重定处置；「`--correct` 继承 base 链字段致『载荷自带链字段』诊断必然误报」由前批 Task 8 修复轮收口（裁定 D2：`planCorrection` 剔除 `recordHash`/`prevRecordHash`/`runLogAnchor`，同批 L56）。③ **登记为不修（无缺陷属性，风格偏好）**：L62 四项——`validOrigins` 并行数组结构体化（已核三处 push 对齐正确）、`runLogPrefix` 三态枚举化、证据表格 padding 重排、`l0-baseline`/`run-sync` 登记机制（控制者确认属硬线许可）；另含 L58 子项「`valid` 集 vs 原始行」测试前提注释——五项经复核均无行为/判据风险，属重构风格偏好，按「不为改而改」口径不实施。④ 计入上述后，**2026-09-25 账本延后清单清零**（回写见该账本文末「清收回写」节）。

**显式不修 3 项（随本批登记）**：F-6 真实 `/wm` 会话正向导出演练（需真实会话逐 gate 测量文件，另约）；R5 行级证据锚阻断化（维持观察期，先积累诊断命中数据再评估升级）；code-health Phase 5-8 迁移（独立子系统，SSoT §10K「未实现（不得据此执行）」，单独立项）。

## [42.2.1] - 2026-09-01

### Wave A：门禁语义与牙齿（2026-09-25）

> 来源：8 阶段 live run 调测发现全量修复计划的 Wave A（发现项 D-1/N-1、D-2/N-2、D-6、D-7，见 `docs/debug/2026-09-23-wm-8phase-live-run/README.md`；规格 `docs/superpowers/specs/2026-09-25-live-run-findings-remediation-design.md` §3、计划 `docs/superpowers/plans/2026-09-25-live-run-findings-remediation.md`）。四个 WS 已实现并各自通过评审；本小节为**验收登记**——逐条给规格锚、改动一句话与证据路径，验收原始命令/退出码/输出摘录见 `docs/debug/2026-09-25-wave-a-gate-semantics/README.md`。版本保持 42.2.1，**不 bump**；**计数影响**：Wave A 未新增 CLI / schema 文件，**exit-2 族仍 45**（27 个 `check-*` + 18 个工具 CLI）、**schema 仍 34**。

- **WS-1 iceberg R6 命名空间分池（D-1/N-1，`logic/iceberg-sweep-logic.ts`）**：三视角对账从「全体两两精确相等」改为**按命名空间分池**——池 A（设计 ID·宽）`graph ↔ rtm` 精确相等（保留 DD/INTF 漂移检出）；池 B（设计 ID·SD 切片）`tla` 与宽视角 SD 切片**双向**相等（超出=违规、漏 SD 亦=违规，因**阶段 5-8 无 `check-tla-model` 复检** `uncoveredSdNodes` 不变量，该方向由 R6 窄池守护）；`scope`（文件路径命名空间）退出 R6 比对与 R8 收敛集、仅保留 R7 存在性声明；违规文案按池命名（`R6[design-wide]` / `R6[design-sd]`）便于排障。同步面：`samples/iceberg/{bad-r6-wide-dd-drift,valid-phase5-scope-present}.json` 与 `self-test.ts` `ICEBERG_CASES`、`__tests__/iceberg-logic.test.ts` 的 8 例分池用例、`references/iceberg-sweep-guide.md`、SSoT §10L.3、`AGENTS.md`。**证据**：`docs/debug/2026-09-25-wave-a-gate-semantics/README.md` §3（窄池噪声消除的 before/after 差分 + 单测 34/34）。**验收未完全达成项（如实登记）**：demo 工作区的 `iceberg-reports/*.json` 未随装配器保全快照留存（快照只含 run-log/signature-chain/checkpoint-log/gate-logs），简报按报告复跑的形态不可执行，已按规格兜底条款改用 samples/差分取证；且在 demo 既有产物上**池 A `graph↔rtm` 仍报差异**（基准态 rtm 只引用 SD-001 而 graph 含 INTF/DD）——这是池 A 刻意保留的真实装配差异，故「demo 阶段 2-8 复跑 R6 不再差异」不成立，对 live-run 形态的「R6 全绿」不予背书。
- **WS-2 编码链 R5 内容下限 + `--preflight`（D-2/N-2，`logic/coding-plan-logic.ts` + `cli/check-coding-plan.ts`）**：12 份 stage 审查（R3×9 + V×3）由「文件存在」升级为**非空（size > 0）阻断**，「含行级证据锚（`path:Lnn=` / `path:§sec=`）」降级为**非阻断诊断**（stderr 一行，不改退出码；降级理由：demo 既有 15 份 review 产物的锚命中数为 0，设为阻断会打红全部历史证据）；新增只读 `--preflight` 打印本阶段必需清单（plan / 账本 / 三件套 / R3×9 / V×3）与 `missing`/`invalid`，**不执行 R1-R6、不改退出码语义**。新增负样本 `bad-review-empty`（空文件 → exit 1）。**证据**：同 README §4（demo 阶段 5 `--preflight` exit 0、`missing=[] invalid=[]`）。
- **WS-3 codegraph 查询记录显式降级契约与索引探测（D-6，`schemas/codegraph-query.schema.json` + `cli/check-codegraph-queries.ts`）**：新增可选字段 `evidenceKind: 'cli' | 'artifact'`、`degradationReason`、`alternativeEvidence`（≥1 条 `{command, evidencePath}`）；判据 = 项目存在 `.codegraph/` 索引 → 必须 `cli`（否则 violation），不存在 → 必须 `artifact` + 非空理由 + ≥1 条替代证据（否则 violation），**未声明即 violation**（把隐形制品口径变成显式声明）。新增样本 `bad-degraded-without-evidence` / `bad-cli-kind-without-index`。**证据**：同 README §5（单测 C14a-d 锁定三态；demo 记录字段已按新契约声明）。
- **WS-4 maturity R5 真值通道 + 未接线可见化（D-7，`schemas/run-log.schema.json` + `cli/check-maturity.ts` + `logic/maturity-logic.ts`）**：run-log 新增可选 `operationalFailureModes: ('O1'..'O6')[]` 作为 R5 **唯一真值通道**（只统计该字段，每项至多一次）；`note` 中 O1..O6 字样的词法扫描降级为**非阻断诊断**（「疑似引用 N 处…若确为运维失败请以 `operationalFailureModes` 标注」+ 命中 runId 列表）；未提供 `--run-log` 时输出「R5 未生效：未提供 --run-log（O 系列失败模式未校验）」诊断（堵隐性规避通道）。**证据**：同 README §2（D-7 直接验收：live run 保全快照 run-log 的 **17 处引用命中 → exit 0 + 诊断**；未传 `--run-log` → exit 0 + 诊断；3 × `operationalFailureModes` 合成探针 → exit 1 + R5 违规）。
- **security-scan 新增发现清零（卫生）**：Wave A 新代码引入的 security-scan 新增发现逐条内联豁免并写明理由，基线比对回到 0 新增。**证据**：同 README §6（prepush 项 6 `security-scan 无新增风险（exit 0）`）。
- **全量验收**：`npm run test:affected`（未提交改动命中涟漪路径 → 按设计回退全量 vitest，104/104 通过）与 `npm run prepush`（19 项，含全量 vitest + 覆盖率阈值、规则层覆盖口径、security-scan、samples 覆盖矩阵、prettier、tsc、eval 语料）均 **exit 0**；逐项结果与末 30 行原文见 `docs/debug/2026-09-25-wave-a-gate-semantics/README.md` §6。

### Wave B：完整性与纪律（2026-09-26）

> 来源：同一计划的 Wave B（发现项 D-3、D-4、D-5、D-8、N-5、N-6 与 L4，见 `docs/debug/2026-09-23-wm-8phase-live-run/README.md`；规格 `docs/superpowers/specs/2026-09-25-live-run-findings-remediation-design.md` §4、计划同前）。五个 WS 已实现并各自通过评审；本小节为**验收登记**——逐条给规格锚、改动一句话与证据路径，验收原始命令/退出码/输出摘录见 `docs/debug/2026-09-25-wave-b-integrity/README.md`（含五类反伪造探针、归档前缀三态、预算牙齿与 19 项 prepush 逐项）。版本保持 42.2.1，**不 bump**；**计数影响**：Wave B 新增 1 个 CLI（`wm-append-runlog.ts`）→ **exit-2 族 45 → 46**（27 个 `check-*` + 19 个工具 CLI），**schema 仍 34**（哈希链 / 放行锚 / 归档前缀性均并入既有判据编号与既有 `missingFiles` 机制，无新 schema、无新判据编号，反模式仍 48 条）。

- **run-log 追加器 `wm-append-runlog.ts`（D-5①/N-5，新增 `logic/run-log-append-logic.ts` + `cli/wm-append-runlog.ts`）**：把「禁止回溯改写」从文档纪律落成**可执行契约**——O 侧唯一追加入口，时间戳三态（① 显式时间戳 ≤ 末条 → exit 1 拒绝写入、目标不被修改；② 无显式时间戳且时钟真倒退 → exit 1，仅 `--allow-clock-adjust=<reason>` 放行；③ **无显式时间戳且**同毫秒/批内冲突 → 良性 +1ms 步进且 `diagnostics` 明示，绝不静默），历史行按原文本**逐字节保留**（不经 JSON 再序列化），任何时间调整在 `note` 留 `clock-injected:` / `clock-adjust:` 可复核痕迹；`--correct=<runId>` 只**新增**更正记录（`note` 含 `correction-of:<runId>`），历史行不删不改；写盘复用 `wm-write` 既有原子机制（`<target>.lock` 跨进程锁 / 备份 / tmp+rename / 回读），mtime 在读取之前取样（MTIME_CONFLICT 宁可拒绝不丢记录）；目标为已注册状态路径时只强制校验**新增**行，历史行不符当前 schema 属 legacy 形态 → 非阻断诊断。**证据**：同 README §3（追加 2 条 `appended:2` exit 0）与 §2（注册路径语义：非 `.w-model/run-log.jsonl` 目标 exit 1 `INVALID_JSON`）。
- **R7 记录哈希链（D-3a，`logic/run-log-logic.ts` + `schemas/run-log.schema.json`）**：`recordHash = sha256(prevRecordHash + "\n" + canonicalJson(record 去掉 recordHash 字段))`（canonicalJson = 对象键按 Unicode 码点升序、无空白、UTF-8、数组保序；纯 TS SHA-256 不引 `node:crypto` 进 logic），链判定三段——链接（`prevRecordHash` 须等于前一条 `recordHash`，首条为 `""`）、内容（逐条复算）、哈希段之后不得出现未入链记录；首个带哈希记录之前的历史段只记非阻断 `LEGACY` 诊断（禁止回溯补哈希）。**证据**：同 README §3 探针 (a)-(d) —— 改内容 / 改时间戳（保持单调）/ 删行 / 插无哈希行**全部 exit 1**，探针 (b) 仅命中内容维度（reasons=1）证明其独立于既有 R7 时序判据；**修复前**四类突变均为 exit 0 —— 该对照**转录**自 Task 7 的账本报告（`.superpowers/sdd/2026-09-25-live-run-findings-remediation/task-7-report.md` §1 对照表；gitignored 账本，路径为引用非交付物），本轮未重跑未修版本。
- **checkpoint 放行锚 + cutoff（D-3b/裁定 G，同上两文件）**：放行记录带外部锚 `runLogAnchor = { lines, sha256 }`——前缀 = 文件序下 `timestamp ≤` 锚时间戳且不含锚自身的记录，`sha256` = 前缀各行**原始字节**（剥离行终止符、不 trim）以单个 `"\n"` 连接后取 SHA-256；追加器写 `action=checkpoint && outcome=success` 时按写入前前缀**自动填入**（调用方显式提供则须一致，不一致 exit 2 不写盘），**先写锚再算 `recordHash`**（锚自身入链，改锚即断链）；校验按同法重算，不符即 blocking（文案含 `R7` + `runLogAnchor` + runId）。历史兼容以 `RELEASE_ANCHOR_CUTOFF='2026-09-26T00:00:00Z'` 为界：**此前**放行记录缺锚 = LEGACY 非阻断（禁止回溯补锚），**此后**缺锚 = blocking（堵「绕过追加器直写放行记录即让保证静默消失」的 fail-open 窗口）。**证据**：同 README §3(e)（锚自洽 + exit 0）与 §3.2（仓库内 443 行纯 legacy 快照 8 条历史放行记录全部 LEGACY 吸收 → **exit 0** 零回归）。
- **归档记录边界前缀（D-3 / L4，`logic/archive-integrity-logic.ts` + `cli/check-archive-integrity.ts`）**：`check-archive-integrity --live-run-log=<path>` 校验归档快照 `run-log.jsonl` 是 live 的**记录边界字节前缀**——非前缀（两侧不可同真，文案不作因果指认，须人工裁定证据归属）与**中途截断**（快照未以换行结尾，疑似归档写入途中崩溃的半行残留）与**空快照**（0 字节无法证明前缀性）三态一律以 `[runLogPrefix]` 并入 `missingFiles`（exit 1）；未提供 `--live-run-log` 时只输出非阻断诊断（未提供 ≠ 通过）。**证据**：同 README §4 三态 = exit 0 / 1 / 1 + 未接线 exit 0 诊断。
- **禁止回溯改写纪律（D-5①，`references/hard-constraints.md` + `data-models.md` + SSoT + `AGENTS.md`）**：成文「run-log 不得就地改写历史行 / 不得重排 / 不得事后补链补锚；需要更正时用 `--correct` 新增更正记录」；`--correct` 已剔除继承的 `recordHash`/`prevRecordHash`/`runLogAnchor`（保留会导致必然误拒），被更正记录本身是放行动作时按新前缀自动填新锚。**证据**：同 README §1 对应行与 §3。
- **自举顺序纪律与四处例外登记（D-4/D-8，`SKILL.md` + `references/operational-recovery.md`）**：放行三步顺序成文——① `checkpoint-log/phase-N` 确认先落盘（阶段 1 由 R0 自举形态消费）→ ② 闭环五门串行且 `exitCode=0`（五门均须提供 run-log）→ ③ 放行记录为**阶段末条**且**严格晚于**五条 gate 记录（**同秒不算早于**，不可换序、不可并行）；后置窗口（阶段 1 的 check-checkpoint 记录允许晚于本放行但须早于下一放行）定性为**历史日志兼容例外**并显式登记——**权威定义**见 `w-model-dev/references/operational-recovery.md`「阶段 1 自举豁免（R11 后置窗口）」节，**四处例外登记**以搜索短语实锚定位（行号随编辑漂移，不作锚）：`w-model-dev/references/hard-constraints.md` 约束 #11 节「phase-1 后置窗口的历史兼容例外（D-6）」句、`docs/skill-design-document_SSoT.md` §10.6 强制校验脚本条「历史日志兼容例外（D-6）」句、`w-model-dev/references/data-models.md` R11 条「历史日志兼容例外（D-6）」句、`w-model-dev/references/command-reference.md` R11 条「历史日志兼容例外（D-6）」句。**证据**：同 README §5 三态时序回归矩阵（自然时序双门 exit 0 / 先放行后补门 exit 1 含 R8+R11 / 同秒 exit 1 仅 R11）——**转录**自 Tasks 9/10 的账本报告（`.superpowers/sdd/2026-09-25-live-run-findings-remediation/task-9-10-report.md`，gitignored 账本，路径为引用非交付物；原始进程输出在仓外 `%TEMP%\wm-t9t10\`，不在 tracked 面；本轮未重跑）。
- **预算接线与上界口径（D-5②/N-6，`cli/check-budget.ts` + 三处调用表）**：`--run-log` 由「可选」改为**必带**（未传时 R6/R5-b 不生效，但输出非阻断诊断「R6/R5-b 未生效（未提供 run-log）…跳过不等于通过」，退出码语义不变）；Σtokens 明确为**上界口径**（同一分派多条归账重复累计，判定按上界执行、**不去重**，同 `(timestamp, tokens, duration_s)` >1 次出「疑似重复归账 N 组」诊断）。**证据**：同 README §6 —— 同一预算 + 同一 run-log，装配 `--run-log` 后由 exit 0 变 **exit 1** 且 `R6：总 tokens 522358388 > project.maxTokensTotal 300000000（174.1%）` 逐字命中；未接线面 exit 0 + 诊断。
- **固有限制（如实登记，不主张强于设计）**：哈希链只保护**首个带哈希记录起**的段——纯 legacy 段内的就地改写**不可检出**（本轮边界探针：改纯 legacy 副本一条 `note` → exit 0 + 「历史段 N 条无哈希（LEGACY，未参与链校验）」诊断可见但不阻断）；该段完整性主张由归档字节前缀（L4）与 `wm-export-evidence` 的 SHA-256 manifest 承担。放行锚只保证「前缀到最后一个锚为止」，锚之后的新增尾部在下一次锚定前不可证伪。以上均非缺陷，是设计边界，已在 schema description 与 `references/data-models.md` 成文。
- **全量验收**：`npm run prepush`（19 项，含 vitest 全量 + coverage 阈值、规则层覆盖口径、security-scan、docs-consistency、samples 覆盖矩阵、prettier、tsc、eval 语料）在**三个 HEAD 上共三次全部 exit 0**——实现态 `8a9c5561`、交付态 `cfb4bfe3`、交付态最终 `d7cd03db`（约 26 分钟/次，无红项）；三次中第 14 项 `npm audit` 两次因网络不可达按设计跳过、**一次（`cfb4bfe3`）真实执行通过**（`✓ npm audit 未发现 high 以上漏洞`）→ 依赖漏洞面已复核。五类反伪造探针 4/4 拦截 + 1 正确用法放行、归档前缀三态 exit 0/1/1、历史纯 legacy 快照零回归 exit 0、预算牙齿 exit 1。快速车道 `npm run test:affected -- --since 8a9c5561` 记录见 README §7.3（按设计涟漪回退全量 vitest；该次 2600 用例中 **2597 通过 / 3 项时序预算或自重超时断言失败**——两项 `pre-commit-hook` 的墙钟余量断言（其 `status===124` 行为断言均通过）与一项 `evidence-export-logic` 长用例 30s 自重 timeout；两文件隔离复跑 **60/60 通过 exit 0**，同树 prepush 全量 2600/2600 通过 → 判定为负载时序噪声，非内容回归；快速车道本身非验收依据）。三次运行原文（含末 30 行）见 `docs/debug/2026-09-25-wave-b-integrity/README.md` §7 / §7.1 / §7.2；起链载荷原文与完整链哈希见同文件 §3.0（可独立复算）；收口另单独复跑 `check-docs-consistency`（exit 0，**facts 通道 = 自采集**，`2600/2600` + 48 条 exit-2 探针零漂移，`vitestCommitSha=d7cd03db`）与 `self-test`（`373/373`，基线 373）→ 见同文件 §7.4。

### R 三项采纳 + 打磨项清扫（2026-09-22）

> 来源：用户裁定「R 三项全部按推荐进行，打磨项也做」（2026-09-22）。**批次范围**：落地三份根因报告推荐（RC-1 coding-plan fs 注入 / RC-2 销毁前证据保全规则与装配器护栏 / RC-3 eval 基线不可变成文）+ 全量打磨项清扫 + isMain 统一加固；规格见 `docs/superpowers/specs/2026-09-22-rc-closeout-spec.md`、计划见 `docs/superpowers/plans/2026-09-22-rc-closeout.md`，逐任务报告与评审 diff 存 `.superpowers/sdd/2026-09-22-rc-closeout/`（gitignored 账本）。验收：全量 19 项 `npm run prepush` exit 0（记录 `docs/debug/2026-09-22-rc-closeout-acceptance/acceptance.txt`）。版本保持 42.2.1，**不 bump**。
>
> 本小节为终审修复追加：批次期间两项与规格/计划原文有出入的裁定（下述裁定 A/B）此前只存于上述 untracked 账本——按本批 RC-3 自修的规则「处置结论须落在 tracked 面」，现落 CHANGELOG。

- **裁定 A（tokensUsed 判据较规格 WS-D.1 收窄）**：规格 WS-D.1 原文要求「`tokensUsed` 非有限**非负**时 logic 层防御（跳过 + warning，**不静默**）」；实现收窄为「仅非有限（NaN/Infinity）**静默视同未提供**」——`logic/budget-logic.ts` 的守卫为 `usage && Number.isFinite(usage.phase) && Number.isFinite(usage.total)`，非有限时整体跳过 R6/R5-b，不产生 violation/warning、不抛错，与未传 `--run-log` 行为对齐（任务 4 报告 §3 第 6 项；测试⑤「tokensUsed 为 NaN（phase/total 均 NaN）→ 视同未提供：不触发且不抛错」钉死）。与规格原文的两处偏差及收窄理由：①**负数语义**——规格字面含「非负」，实现守卫不拒负数：CLI 侧 `sumTokens` 只累计有限非负数（NaN/Infinity/负数/非数字一律剔除，D-4b 口径），负数无从到达 logic 层（任务 4 报告 §7 裁定 2 记载「CLI 侧 sumTokens 只产有限非负数」）；②**warning 静默**——实现按「视同未提供」语义不输出告警，未按规格原文输出 warning。规格文件 WS-D.1 条目处已补勘误注指向本条（双向可寻）。
- **裁定 B（run-sync 台账登记不适用）**：`lib/is-main.ts` 的 `realpathSync` 未登记进 `lib/run-sync.ts` 台账——实读确认该台账（`SYNC_PROCESS_EXCEPTIONS`）实为**同步 child_process 专用**（`DirectSyncApi = 'spawnSync' | 'execSync' | 'execFileSync'`，审计函数只扫描 `node:child_process` 导入），**无 fs 调用登记机制**；且 `run-sync.test.ts` 对台账做「条目数 == AST 真实调用数」双向对账，强行登记不存在的同步调用条目会类型报错 + 对账红灯。审计痕迹落在 `lib/is-main.ts` 头注（加固语义）与 `realpathSync` 行内 eslint 豁免理由（同 `safe-project-path.ts` 惯例）（任务 10 报告 §3 记载；若需制度化 fs 台账属独立任务，另行立规格）。

### E-2 规格修正案落地：R0 首阶段自举形态（方案 B，2026-09-22）

> 来源：阶段 1 自举死锁（E-2，`docs/debug/2026-09-20-wm-8phase-live-run` 披露、`docs/debug/2026-09-22-e2-r8-r0-rootcause/README.md` 根因定位证实）——放行记录被同时当「放行事件凭证」（R0/R11：先写供门验）与「阶段终点轨迹标记」（R8：最后写），三批独立合入的规则在阶段 1 零记录态联合成死锁；根因实测证实自然时序（确认落盘 → 闭环五门 → 最后写放行记录）在现行 R8/R11 下已 exit 0，R0 是唯一阻塞。用户已批准方案 B（规格 `docs/superpowers/specs/2026-09-22-e2-spec-amendment.md`）。版本保持 42.2.1，**不 bump**。

- **R0 首阶段自举形态（`logic/checkpoint-logic.ts` + `cli/check-checkpoint.ts`）**：run-log 零 checkpoint success 记录且 `--checkpoint-log` 已提供、加载含 **phase-1 用户确认**（`get('1')` 非空白；修复轮 1 由初版「Map 非空」收紧——零放行记录 ⇒ 下一次放行必为首放行，仅首放行确认可支撑自举，堵「目录仅含 phase-2.txt 时 exit 0」的相位缝隙）时，R0 不再违规，改推**非阻断** `BOOTSTRAP_VALIDATION:` 诊断（首阶段放行以 checkpoint-log 的 phase-1 用户确认为初级证据，与 R3 防代签同锚；放行记录将于闭环门后写入，其内容校验由下一阶段全局回溯完成）——自然时序自此合法。未提供 / 空 Map / 无 phase-1 条目（含仅 phase-2+ 确认）/ phase-1 空白 / 目录不可读（`checkpointLogMissingReason` 两态）→ **维持原违规**（fail-closed 不变：零证据不等于合规）；有记录路径零变化（R1-R5 判据一字未动）。`CheckpointCheckResult` 新增可选 `diagnostics`，CLI 人类可读与 `--json` 输出均透传。
- **D-6 后置窗口降级为历史日志兼容（`logic/run-log-logic.ts`，零行为变化）**：R11 全域严格判据（五门严格早于放行）恢复为新建项目常态可满足；`phase===1` × `check-checkpoint.ts` 后置窗口判据、测试、文案不改，仅注释与文档重定性为「历史日志兼容形态」（删除会红掉以旧时序写入的历史 run-log，故保留）。R8 零改动——后置形态仍报 R8 三条（反伪造语义，新建项目不应产生该形态）。
- **测试与登记**：`__tests__/checkpoint-logic.test.ts` 新增 R0 自举形态五例（零记录+phase-1 确认在场 → passed + `BOOTSTRAP_VALIDATION` 诊断 / 零记录+未提供 → R0 违规仍在 / 零记录+missingReason 两态与空 Map → R0 违规仍在 / 零记录+仅 phase-2 确认与 phase-1 空白 → R0 违规仍在（修复轮 1 相位缝隙负例） / 有记录路径零变化）；新增 `__tests__/checkpoint-r0-bootstrap-cli.test.ts`（真实 tsx 子进程端到端：自然时序 `check-run-log.ts` exit 0 且无 R8/R11、D-6 时序 exit 1 恰 3 条 R8、零记录态 `check-checkpoint.ts` exit 0 含诊断、无 phase-N 匹配 exit 1 保留 R0 文案、仅 phase-2.txt 目录 exit 1 保留 R0 文案（修复轮 1）；已登记 `SUBPROCESS_TEST_FILES` 与 `__tests__/README.md` 覆盖矩阵）。负载性登记锚与禁语保留（`checkpoint-logic-rule-loadbearing.test.ts` 三态全绿）。
- **文档销项（SSoT 优先）**：SSoT §10.6 新增 6.0「零记录态的首阶段自举语义」、§10C D-6 段「已知张力」改写为已消解定性；`references/operational-recovery.md`「阶段 1 自举豁免」节改写（自然时序调用约定 + D-6 历史兼容定性 + 已知张力销项）；`references/hard-constraints.md` 约束 #11 补首阶段自举语义一句。**本条即下方批次 3-4 登记「仍未完成」①（E-2）的销项记录**：E-2 已裁定并实施（本节），该①为登记时点状态、按历史可发现性保留原文。

### superpowers 替换 opsx（编码计划契约 + codegraph CLI 收敛，批次 1-2）（2026-09-21）

> 背景：阶段 5-8 的规格级规划原依赖 OpenSpec opsx（`/opsx:*` 四段式 + `openspec/changes/` 制品目录），其**制品格式与门禁不在本仓**、且外部工具缺位时整条链路无可执行契约。现以 [obra/superpowers](https://github.com/obra/superpowers) v6.3.0（commit `b36e082`，MIT）的编码链方法论替代：方法论 vendor 为 `references/superpowers-adoption.md`（只在仓内，不要求宿主安装），机器可查的部分改由本仓脚本承担。规格见 `docs/superpowers/specs/2026-09-21-superpowers-replace-opsx-design.md`、计划见 `docs/superpowers/plans/2026-09-21-superpowers-replace-opsx.md`，逐任务报告与评审 diff 存 `.superpowers/sdd/2026-09-21-superpowers-replace-opsx/`。版本保持 42.2.1，**不 bump**。
>
> **本条目覆盖批次 1（脚本层核心替换，任务 1-5）与批次 2（方法论 vendor 与文档面，任务 6-8）**；批次 3（demo 新链路重放）与批次 4（openspec 残留清理 + 全量 prepush）完成后另行登记。

- **新门禁 `check-coding-plan.ts`（`logic/coding-plan-logic.ts` 纯函数 + CLI，R1-R6）**：R1 plan 存在且 `<changeId>.plan.md` 命名合规 → R2 目标节与任务节「行首 `验证：`/`Verify:`、命令体禁分号/AND/竖线」→ R3 账本首行身份与 `Task N: complete` 覆盖 plan 全部任务 → R4 任务三件套（`task-N-{brief,report}.md`）非空 + `review-*.diff` → R5 stage 级 `R3×9 + V×3`（stage ∈ `plan`/`execute`/`finalize`）→ R6 归档态 plan + 账本快照 fail-closed。全部 R 判据由单测正反例锁定（含「删掉一条 complete 即红」的负例）。
- **run-log action 词表 27 → 30**：新增 `plan_propose` / `plan_task` / `plan_review`（S-plan 计划提案 / 计划任务推进 / V 任务评审）；`opsx_explore` / `opsx_propose` / `opsx_apply` / `opsx_archive` 位置不动、转为 **LEGACY**（历史记录仍可解析，新流程不再产生）。词表四方同步（`run-log.schema.json` ↔ `conventions.md` ↔ `data-models.md` ↔ `docs-consistency-logic.ts` 的 `runLogActionCount`），`ACTION_ROLE_PAIRING` 未随新增动作放宽。**计数口径**：`check-*` 统一按 `cli/check-*.ts` 文件名 glob 实测（28 个），全套 exit-2 = 46。
- **artifact gate 阶段 5-8 聚合切换**：`aggregateExternalChecks` 由 `checkOpsxArtifactsStrict` 改为 `checkCodingPlan`，`GATE_JSON.external` 键为 `{ codegraph, codingPlan }`，违规行前缀 `[coding-plan]`；scope 缺失仍两 checker 各自 fail-closed，`scopeProvidedButFailed` 抑制误导文案的行为不变。
- **`check-openspec-archive.ts` 退役，归档快照并入 `check-archive-integrity.ts`**：归档根含恰一 `*.plan.md` 时自动启用 `codingPlanSnapshot` 清单项（`<changeId>.plan.md` + `progress.md` + `Task N: complete` 三件套），违规以 `[codingPlanSnapshot]` 前缀并入 `missingFiles`；零/多匹配分别走「不启用」与「fail-closed」，legacy 归档零行为变化。退出码契约与 self-test 基线随退役同步回拨（self-test 361 → 360）。
- **`ensure-codegraph-opsx.ts` → `ensure-codegraph.ts`（codegraph 收敛为 CLI 依赖 + superpowers 三层检测）**：codegraph 判据为 L1 CLI + L3 项目 `.codegraph/`；L2 MCP 注册降级为「可选加速（非依赖）」，**未注册不出 CHECKPOINT**；新增 superpowers 三层检测（L1 宿主技能目录 / L2 技能包 `references/superpowers-adoption.md` / L3 项目 `docs/superpowers/`），**只检测不安装**，缺失 → CHECKPOINT。判据单源化（`lib/superpowers-detect.ts`，ensure 与 doctor 共用）；`doctor` 的 codegraph 探针改经统一 CLI 派发（`lib/cli-probe.ts`，Windows `.cmd` shim 经 `cmd.exe`），消除「同机 doctor 报未安装、ensure 报 ready」的两消费者结论相反；openspec 检查项整体删除。
- **文档面同步（SSoT 优先）**：SSoT §3.1 架构图边界（`OPSX[OpenSpec]` → `SP[Superpowers 方法论]`）、§3.3.1 外部工具表与 `ensure-codegraph` 检测语义、§3.3.1 ChangeScope 段（`openspec/` 顶层段仍在 `lib/change-scope.ts` 的 `EXCLUDED_ROOT_SEGMENTS` 中，文档与代码逐字一致）、§8.2.4 doctor 行、§10.5.2 聚合与归档后置门、§10D.3 action 词表片段的 `plan_*` 三值与 LEGACY 口径、§10D.8 R3 矩阵「编码链 stage（9+3 文件）」、§10.5.2/§10D.8 摘要表行、§11A.5 brownfield 吸收句；AGENTS.md 集成段与约束 #14（CLI 优先 + 编码计划契约）及 §8 两行；README.md 阶段门附加项、外部工具集成、references 计数 43 → 44；`references/superpowers-adoption.md` 为新增 vendor 资产（技能路由表与资源计数同步 43 → 44 个 .md）。
- **文档计数与配置漂移收口（本批实测订正）**：`schema-loader.ts` / `schema-fs.ts` 注释「26 个 check 脚本调用链」→ 28；`docs/INSTALL.md` 结构树 `logic/` 36 → 39 个 .ts（38 个 `*-logic.ts` + `code-health-contract.ts`）、`lib/` 29 → 33 个共享工具（均为注释/文案，零行为改动）。
- **eval 语料**：`eval/w-model-dev-test-prompts.json` id=21 由「opsx 三段跳步」负向用例改写为「编码计划契约与执行账本缺口」（期望文案点名 `check-coding-plan.ts` R1-R6 与归档快照条件项），`eval/README.md` 新机制类别清单同步；`npm run eval` 60/60 通过。
- **与上一节 D-1~D-8 修复的关系（本替换后的存续状态，如实登记）**：D-1（签名链返工来源例外）、D-2（run-log R3/R7 接受 V 重发）、D-3（code-tla 按 `manifest.basePath` 装载）、D-4a/4b（killSwitch 返工计数口径与预算用量 R6/R5-b）、D-5（两门共用 legacy 谓词）、D-6（R11 阶段 1 自举豁免）、D-8（设计级布局校验激活条件）**均不受本替换影响**，其判据、测试与文档段落原样保留；**D-7**（`check-opsx-artifacts.ts` 归档回退两态）中「预归档聚合门半边」随旧链路继续在盘生效（仍在 pre-push 路径），「后置门半边」因 `check-openspec-archive.ts` 退役而改由 `check-archive-integrity.ts` 的归档快照条件项承担；该旧链路与其 self-test / samples 登记的**本体已于下方「修复波次登记」全部退役**（本节为批次 1-2 时点状态，旧目录约定自此不再适用）。
- **未完成（显式登记，不视为已完成）**：批次 3 demo 端到端复验、批次 4 openspec 残留清理（`check-opsx-artifacts.ts` 本体 + self-test 用例 + `samples/NEGATIVE-COVERAGE.md` 条目 + `scripts/__tests__/README.md` 覆盖矩阵）、全量 19 项 prepush 复核均未执行。

#### 批次 3-4 登记（2026-09-21；上方「未完成」条为批次 1-2 时点状态，原文保留不改）

- **批次 3 demo 重建为新编码计划契约（`eval/e2e/demo-assets/build_workspace.py` + `README.md`）**：阶段 5-8 构造段由 opsx 三段式改为编码计划契约——`docs/plans/<cid>.plan.md`（`## 目标` + 3 个 `## 任务 N：…` 节，逐节一条行首 `验证：` 命令行）+ `.superpowers/sdd/<cid>.plan/` 账本与三件套（`progress.md` 首行身份 + 逐任务 `Task N: complete`、`task-N-{brief,report}.md`、`review-<cid>-t1.diff`）；R3×9/V×3 的 stage 由 `{explore,propose,coding}` 迁徙为 `{plan,execute,finalize}`（旧词表不再生成）；`openspec/changes/<cid>/` **保留**为 LEGACY 共存样本（旧链路不在 demo 电池/轨迹/探针内运行）；工作区清理面七目录 → 八目录（含 `.superpowers/`，`docs/plans` 随 `docs/` 清理）；README 补「干净工作树前提」（`--scope` 要求 `headRef == 当前 HEAD` 且实际变更集合与 `changedFiles` 精确相等）。
- **批次 3 重放证据（`docs/debug/2026-09-21-superpowers-replace-replay/replay.txt`，519 行）**：门禁电池 18 条（10 项 + 双形态）中 `check-coding-plan.ts --phase=5|6|7|8 --scope=…` **exit 0 ×4**（新门禁 R1-R6 全绿：覆盖 3/3 + 三件套 + R5 12 项）、`check-artifact-gate.ts --phase=8` 的清单与薄封装两形态均 0、`check-archive-integrity.ts` legacy 归档路径 0；全量轨迹 `bash run_trajectory.sh` → **119/119 exit 0**（`TOTAL_GATE_RUNS=119 / NONZERO_EXIT_COUNT=0`）。三项与裁定期望不符者按「登记而不改门禁」处置：`check-code-tla-consistency` D4 红属装配器 `src/counter.ts` 无断言的**既有 fixture 缺口**（未触碰 demo 源码、未放宽门禁）；`check-coding-plan` 不带 `--scope` 的 exit 1 正是既定 fail-closed（裁定期望命令形态漏写 scope）；`check-budget` exit 0 因 `--reset` 重建清空了 live-run 态的返工与用量，D-4a/D-4b 的 demo 实证须由 live-run 态或专门负向 fixture 承载（边界已登记）。
- **批次 3 的 demo 重建副作用（如实登记）**：重建覆盖了 demo 瞬态工作区**重建前的 live-run 终态**（changeId `phase<N>-counter-api` → `phase<N>-demo`，`.w-model/` 整体重造）——该态证据完整保留在 `docs/debug/2026-09-20-wm-8phase-live-run/`，但**不可再在工作区内复现**；`check-archive-integrity.ts` 的 `codingPlanSnapshot` 条件项在 demo 装配器上仍未被激活（归档根无 `*.plan.md`），登记为候选。另：账本回执模板曾写死「验证命令退出码 0」与门禁结论打架，修复轮已去掉该断言（回执正文改为以 G 门禁复核为准）。
- **批次 4 负向探针复跑（`eval/e2e/demo-assets/run_negative_probes.sh`，重建后首次）**：9 项最小突变探针全部被拦截 + 恢复复绿（末行 `✓ 9/9 探针被拦截 + 恢复复绿`；日志自证 `probe-orig residue count=0`，`check-signature-chain` / `check-run-log` 复验 `EXIT=0`）。证据落 `docs/debug/2026-09-21-superpowers-replace-replay/negative-probes.txt`。
- **批次 4 R6 用量实效 CLI 接线常驻回归（修复分支遗留收口②）**：新增 `scripts/__tests__/budget-cli-wiring.test.ts`（真实 `tsx` 子进程 + 临时 run-log；已登记 `config/vitest.config.ts` 的 `SUBPROCESS_TEST_FILES` 与 `__tests__/README.md` 覆盖矩阵）——`--run-log` 阶段 Σtokens 超 `perPhase.maxTokens` → exit 1 且 stdout 含 `R6：阶段 tokens 250000 > perPhase.maxTokens 200000`；未提供 `--run-log` → exit 0 且无 R6 文案；Σtokens=0 → exit 0 + stderr「R6 未生效」。该用例经**突变验证**（手工删除 `check-budget.ts` 的 `tokensUsed` 传参 → 用例转红），堵住「删接线单测仍全绿」缺口。
- **批次 4 活体面残留清理**：`cli/check-opsx-artifacts.ts` 头注中「与已退役后置门在归档态可同时通过」改为退役后的事实陈述（归档态校验改由 `check-archive-integrity.ts` 的 `codingPlanSnapshot` 条件项承担）；`examples/stage8-acceptance-test.md` 与 `references/subagent-delegation.md` 的「退役随批次收尾」前瞻句改为「本批次不退役，按 LEGACY 制品门保留」；`docs/adoption-guide.md`「Brownfield 阶段级适配」补 SSoT §11A.5 的 OpenSpec 退役注并同步「规格驱动（spec-first）」措辞；`cli/self-test.ts` 样本描述「28 人格库」→「33 人格库」（纯打印文案漂移）。活体面其余命中均为**退役声明/并入注**（「已退役」「并入 archive-integrity」等），按历史可发现性保留。
- **批次 1-3 的两处既有红在首次全量 prepush 时暴露并修复（`ea31c22a`；L0 基线按其既有惯例逐次公开登记）**：①**L0 链接基线 rebaseline**——`w-model-dev/scripts/__tests__/helpers/l0-baseline.ts` 的 `relativeLinkCount` **678 → 691**、`l1Only` **95 → 96**（`violations` 仍 0、`placeholders` 仍 36；`npm run audit:l0-links` 实测 exit 0），成因逐文件实测：新增 vendor `references/superpowers-adoption.md` +6、`references/phase-5-coding.md` +2、`SKILL.md` / `hard-constraints.md` / `phase-6-integration-test.md` / `phase-7-system-test.md` / `phase-8-acceptance-test.md` 各 +1（同批 28 增 / 15 删取净 +13），`l1Only` +1 = 新增指向 L1 的 `../scripts/cli/check-coding-plan.ts` 引用多于退役的旧 opsx 脚本引用——**三数与逐文件增量来历单源记于 `w-model-dev/scripts/__tests__/helpers/l0-baseline.ts:59-64`**；②**logic 直接边界过渡例外登记**——新门禁 `logic/coding-plan-logic.ts` 直连 `node:fs` / `node:path`（与 `gate-logic` / `l0-link-audit-logic` 同型的文件图门禁，其头部已写明「直接读取 projectRoot 下的制品文件」），按 `__tests__/dependency-boundaries.test.ts` 既有的**过渡例外表**登记 2 条含理由（Map 与被钉住的期望数组各 +2），**零门禁判据改动**；其 IO 形态另记入下方架构债。即：本次「19 项 exit 0」是以这两项处置为前置代价换来的，不掩饰为「本来全绿」。
- **批次 4 全量验收**：`npm run prepush` **19 项 exit 0**（含全量 vitest + coverage 阈值 + 规则层覆盖口径 `check-coverage-scope` + `check-docs-consistency` + samples 覆盖矩阵 + prettier + tsc + security-scan + eval 语料断言）。
- **仍未完成 / 未解（显式登记，本批时点状态）**：①**E-2（R8 轨迹模板与 R11 阶段 1 后置放行的同源张力）未解**——属须用户裁定的规格修正案，本批次未触碰（口径同 D-6「登记不修」）；②`cli/check-opsx-artifacts.ts` 本体、其 self-test 用例、`samples/` 登记与覆盖矩阵行在本批时点**未退役**（本批次授权范围外）——**已于下方「修复波次登记」全部退役，本条不再反映落地树**；③`check-archive-integrity.ts` 的 `codingPlanSnapshot` 条件项在 demo 装配器上仍未被激活——**已激活（装配器归档根含 plan/progress/三件套；自动派生分支由 e2e 覆盖，2026-09-25 Wave C Task 15）**：`eval/e2e/demo-assets/build_workspace.py` 归档根补编码计划快照（`phase8-demo.plan.md` + `progress.md` + `task-<N>-{brief,report}.md`，与阶段 8 活动位产物同源并有 fail-fast 自测锚），重建后 `npx tsx w-model-dev/scripts/cli/check-archive-integrity.ts archive/2026-09-19-counter-api` **exit 0** 且「快照判定依据 = 自动派生（归档根 *.plan.md 恰一 → changeId=phase8-demo）」（驱动 `run_trajectory.sh` 不传 `--change-id`，覆盖自动派生形态；显式形态由 samples 与 CLI 子进程用例覆盖）；同批修正装配器 fixture 内部不一致（基准态 `rtm.json` 的 `designDoc` 只引 `SD-001` 而 graph 声明 `SD-001/INTF-001/DD-001` → 现按真实 RTM 形态登记 REQ 行的全设计链 `SD-001,INTF-001,DD-001`），iceberg R6 宽池 `graph↔rtm` 差异在阶段 2/8 复跑实测消失（改前 exit 1 报 `R6[design-wide] graph↔rtm 差异项：INTF-001, DD-001`，改后 exit 0）；④`check-code-tla-consistency` D4 所需的 `counter.ts` 不变式断言（fixture 缺口）——**已补（装配器 counter.ts 含不变式断言；门禁未放宽，2026-09-25 Wave C Task 16）**：`eval/e2e/demo-assets/build_workspace.py` 的 `src/counter.ts` 模板补 `import assert from 'node:assert/strict'`，并在 `inc()` / `reset()` 各加一条 `assert.ok(this.value >= 0 && this.value <= 10, 'invariant: 0 <= value <= 10')`（与 TLA+ `BusinessInvariant` 的 `TypeInvariant` 同锚）；重建后 `check-code-tla-consistency --manifest=.w-model/tla-manifest.json --graph=.w-model/ingestion/graph.json --rtm=.w-model/rtm.json --src=src` **exit 0**（维度 1/2/3 的项数与判定一字未动，维度4 断言覆盖不变式 ✓ 通过（1 项）），demo 四级 `node:test` 套件复跑全绿（unit 3/3）；⑤**架构债**——已裁定并实施：`logic/coding-plan-logic.ts` 的 fs 例外摘除（logic 层零 `node:fs`：−1 个导入 / −2 条登记）；`node:path` 依 `gate-logic` 等 6 文件先例转永久登记；原「届时例外表与期望数组各 −2」口径按先例现实修正（2026-09-22 WS-A 收尾）；⑥**导出链两项待独立规格裁定**——`evidence-provenance` source-bound 强制 git HEAD 对无 `.git` 工作区结构性不可用；导出白名单缺根级 `signature-chain.jsonl`（RC-2 报告 §建议）——**已全部销项（2026-09-27 Wave C Tasks 17-18，见 `[42.3.0]` 节）**：(a) 无 `.git` 工作区新增 `provenanceKind='no-git'` 形态（显式 `--no-git-ok`；`commitSha` 空、`workspaceDigest` 替代 HEAD；**永久 package-only**，`--source-project` 复验恒拒 `NOT_SOURCE_BOUND_NO_GIT`，全仓无把它表述为 source-bound 的出口，commit `a9654f58` + 修复轮 `8b672072`）；(b) 导出白名单与 provenance 生产者**统一接受根级 `signature-chain.jsonl`**（`signature-chains/` 保留 legacy 兼容；两者并存 fail-closed `SIGNATURE_CHAIN_AMBIGUOUS`；修复前真实项目导出链整体不可用——producer 恒 `MISSING_SIGNATURE_CHAIN` exit 1，即核验新增 N-7，commit `557553d4`）；定向 66/66 + 全量 2614/0 failed + CLI 取证五形态全符合。

#### 修复波次登记（2026-09-21；最终全分支评审的修复波次，`c84545b7` / `913112c7` / `075e28d5`）

> 最终评审裁定 **C-1**：`check-opsx-artifacts.ts` 走「**彻底退役**」路线。上方两处相关陈述由此失效，以本小节为准（`:16` / `:27` 为时点状态、按 `:29` 例行豁免；本节另订正 `:26` 的 D-7 尾句与 `:39` ②）。

- **C-1 `check-opsx-artifacts.ts` 与其 fixture 彻底退役**：该门的证据要求（`REQUIRED_STAGES = explore/propose/coding` + `openspec/changes/<changeId>/{proposal,design,tasks,tickets}.md + specs/`）与新链路（`CODING_PLAN_STAGES = plan/execute/finalize` + `docs/plans/` + `.superpowers/sdd/`）**互不相容**——同一 changeId 不存在同时满足两门的制品集，而 G 分派模板仍无条件指示运行它（真实项目必假红）。`git rm` 脚本 + `__tests__/check-opsx-artifacts.test.ts` + `samples/opsx-artifacts/`（3 fixture 树）；同时摘除 `config/vitest.config.ts` 的 SUBPROCESS 登记、`self-test.ts` 的 `OPSX_ARTIFACT_CASES`（3 例）/runner/汇总/import、`samples/README.md` 矩阵行、`samples/NEGATIVE-COVERAGE.md` 行、`AGENTS.md` §8 行、`subagent-delegation.md` dispatch-matrix 与 **G 分派模板的执行指令整行**；语义并入 `check-coding-plan.ts` R5 的 R3×9 + V×3。**该旧链路不再存在于本仓任何执行路径**（原 `:26` / `:39`② 的「仍在 pre-push 路径 / 未退役」自本波起作废）。
- **计数回拨（与退役同提交，实测为准）**：`cli/*.ts` 47 → **46**、exit-2 46 → **45**（`check-*` 28 → **27** + 工具 CLI 18）、self-test 360 → **357**（实测 `357/357`）、exit-2 探针 48 → **47**、`EXPECTED_GATE_COUNT` 46 → **45**；落点含 AGENTS / SKILL / conventions / subagent-delegation / INSTALL / README / CONTRIBUTING / user-guide / test-affected.cjs / pre-push 注释 / samples README 与 NEGATIVE-COVERAGE / `docs-consistency-logic.test.ts` 夹具（`CLI_SCRIPT_NAMES` 改为真实 46 项镜像）；`.eslintsecurity-baseline.json` 重生成（仅移除该脚本 6 条指纹 + `line` 偏移）。
- **I-1 归档路径统一**：`docs/changes/archive/<YYYY-MM-DD>-<changeId>/` 为唯一权威（= `coding-plan-logic` 的 `archiveRoot`），修 phase-8「### Archive 路径」、`templates/acceptance-test.md`、`examples/stage8-*.md` 与 `examples/README.md` 的 `docs/archive/`，并在产物清单显式列出编码计划归档快照四件套（`<changeId>.plan.md` + `progress.md` + `task-<N>-{brief,report}.md` + `review-*.diff`）；`examples-contract.test.ts` 断言同步并新增两条反向断言。
- **I-2 归档位 matcher 锚定化 + 日历校验（单实现）**：`endsWith('-'+changeId)` → `matchesArchiveDirName`（`name === changeId` 或定长 `<YYYY-MM-DD>-` 前缀 + 恰为 changeId + `Date.UTC` 回读日历校验，拒 `2026-13-45` / `2026-02-30`）；新增 `invalid-date` 独立 fail-closed 态与「近失」诊断（`<changeId>-extra` / 非日期前缀名不采信）；新增 10 条纯逻辑用例（含闰年 `2024-02-29` 不误拒）。
- **I-4 `codingPlanSnapshot` 显式入口（堵 fail-open）+ 子进程级 CLI 用例**：`check-archive-integrity.ts` 新增 `--change-id=<id>`（仅等号形态）——显式声明**无条件**启用 `codingPlanSnapshot` 并锚定归档根 `<changeId>.plan.md`，不再取决于生产者摆放（plan 快照摆到子目录即把校验静默关成 no-op 的路径被封）；未传时维持自动派生，两个入口都在人类输出与 `--json` 的 `snapshotSource` 字段注明判定依据；参数三态（裸 flag / 空值 / 重复）exit 2 ARG_INVALID。新增 `__tests__/check-archive-integrity-cli.test.ts`（11 例子进程用例，已登记 SUBPROCESS 与测试矩阵）。同时订正 `docs/debug/2026-09-21-superpowers-replace-replay/replay.txt` 的归因：快照项判定来自**归档目录内容**，该 CLI **从不读** `archive-manifest.json`。
- **I-5 schema 描述订正**：`run-log.schema.json` 的 `ensure_deps` 由「codegraph+OpenSpec 依赖检测/安装」改为 `ensure-codegraph.ts` 现语义（codegraph CLI + superpowers 三层检测；缺失自动装 codegraph，superpowers 只检测不安装；OpenSpec 项已退役）。
- **Minor**：新入库证据绝对路径相对化（`negative-probes.txt` 9 处 → `../../../`；`replay.txt` 20 处 → `<demo-workspace>\…`）；`CONTRIBUTING.md` 人格库 28 → 33；SSoT 两处历史「零面承诺」加「（当时）」；`docs-consistency-logic.test.ts` 注释与数组更新为现状；`docs/debug/2026-09-20-.../README.md` 加历史态指引。
- **验收**：`npm run prepush` **19 项 exit 0**（含全量 vitest + coverage 阈值 + 规则层覆盖口径 + docs-consistency + samples 覆盖矩阵 + prettier + tsc + security-scan + eval 语料断言）；`npm run eval` 60/60；`self-test` 357/357；活体面 `grep "退役随批次"` 零命中。**未做（如实登记）**：`eval/e2e/demo/` 的 `openspec/changes/` 目录与 `check-samples-coverage.test.ts` 的合成串 `opsx-artifacts/ghost-phase5` 按裁定保留（前者无门禁读取、后者仅为占位名）。

### 门禁-返工链契约修复 D-1~D-8（2026-09-21）

> 来源：8 阶段全流程真实调测（`docs/debug/2026-09-20-wm-8phase-live-run/README.md`，快照 main @ `fefd56fc`）披露的 8 项「门禁对合法返工链形态误报/漏报」契约缺口；规格见 `docs/superpowers/specs/2026-09-20-gate-contract-fixes-design.md`、计划见 `docs/superpowers/plans/2026-09-20-gate-contract-fixes.md`，逐任务报告与评审 diff 存 `.superpowers/sdd/2026-09-20-gate-contract-fixes/`。版本保持 42.2.1，**不 bump**。

- **D-1 签名链返工来源例外（`logic/signature-chain-logic.ts`）**：`SignatureChainEntry` 新增可选 `targetKind`（`rootcause`/`preventive`/`iceberg`/`standard`，**不入 sigHash**，缺省即 `standard`——既有链行为不变），R9 在禁止来源矩阵之上开三个 role×action×targetKind 具名例外：S@fix/emergency-fix 消费 R（反模式 #18 守护）、V@rootcause 复审 R 报告（反模式 #19 守护）、R@preventive 消费 S（R3 预防性审查）；其余组合一律仍拒。`references/signature-chain-guide.md` §1/§2/§3 已同步（§2 注明 `iceberg` 当前不解锁 R9 例外）。
- **D-2 run-log R3/R7 配对接受 V 重发记录（`logic/run-log-logic.ts`）**：VerifierOutput/预防性报告类缺陷由 V 重发其自有产物修复、无 S-fix 记录时，R3 rootcause↔fix 配对与 R7 返工时序（legacy phase<8 路径）将 `review + role=V + outcome=success + basedOnReport 非空 + artifacts 非空且全命中 V 自有前缀（`.w-model/verifier-outputs/`/`.w-model/v-reviews/`/`.w-model/preventive-reviews/`）`的记录等价视为一次成功修复证据；缺 `basedOnReport`、artifacts 非 V 前缀或 `outcome≠success` 不充数；phase 8 严格分支不变。`subagent-delegation.md` / `data-models.md` 已补段。
- **D-3 code-tla 装载按 manifest.basePath 解析（`cli/check-code-tla-consistency.ts`）**：`tlaAbs = resolve(manifestDir, basePath ?? '.', tlaPath)`，与 `check-tla-model.ts` 同口径（basePath 空/缺省回退 `.`），消除同一 manifest 两门结论不一致；CLI 装载失败 exit 2 契约由回归用例锁定，`tla-plus.md` §2.1 已注。
- **D-4a killSwitch 返工计数对齐真实事件（`cli/check-budget.ts`）**：`reworkCount` = `action ∈ {rework, fix, emergency-fix}` **或** `outcome ∈ {fail, rework}` 的**累计**条数（`countReworks` 导出供测试），替换「只数 `action=rework`」旧口径——真实调测 run-log 中该 action 一条都没有，旧护栏静默失灵；`tlaReworkCount` 仍为其中 note/target 含 TLA 的子集。
- **D-4b budget 用量实效校验 R6 + burnRate 告警（`logic/budget-logic.ts`）**：新增 R6——Σtokens(阶段) 严格大于 `perPhase.maxTokens` 或 Σtokens(全量) 严格大于 `project.maxTokensTotal` → blocking（消息 `R6：` 前缀，附超限占比）；Σtokens(阶段) ≥ `budgetBurnRate` × `perPhase.maxTokens` → killSwitch 用量告警（消息 `R5-b：` 前缀，R5 既有文案逐字不变）。tokens 由 CLI `sumTokens` 从 run-log 累计（NaN/Infinity/负数/非数字一律剔除，防 Σ=NaN 使判定恒假）；未提供 `--run-log` 时 R5 触发检测与 R6/R5-b 行为与新增前一字不变，Σtokens=0 时输出「R6 未生效」非阻断警告。`data-models.md` 与两文件头已注。
- **D-5 checkpoint 门复用 run-log legacy 谓词（`logic/checkpoint-logic.ts` + `logic/run-log-logic.ts`）**：导出 `isLegacyAbsorbableEntry`，check-run-log 与 check-checkpoint 两门对同一条 legacy 记录复用**同一**吸收判定（此前 checkpoint 门持漂移副本，可能同行两门裁定不一）；真实 schema 错误仍 blocking。
- **D-6 R11 阶段 1 自举豁免（`logic/run-log-logic.ts`）**：`check-checkpoint.ts` 自身要求 run-log 已有 checkpoint 记录才可能 exit 0，其成功 gate 记录必然晚于本阶段放行——严格「早于放行」在 phase 1 构成自举死锁。现 phase===1 该脚本允许后置：晚于本放行且早于下一放行（无下一放行则无上界；同秒不算；早于放行的记录照旧充数；记录仍须属本阶段）。其余四脚本与 phase≥2 判据不变。**已知边界**：后置 gate 记录与 R8 轨迹模板的同源张力未解（R11 豁免不放宽 R8），已在 `operational-recovery.md`「已知张力」如实登记。
- **D-7 opsx 预归档门兼容归档位（`cli/check-opsx-artifacts.ts`）**：strict 解析活动位优先；活动位缺失且 `openspec/changes/archive/` 下恰有一个 `<changeId>` 或 `<日期>-<changeId>` 目录 → 按归档位**同契约**校验（不放宽任何项），多匹配 fail-closed——使本 pre-archive 聚合门与 `check-openspec-archive.ts` 后置门在归档态可同时通过。`command-reference.md` 已注明未归档/已归档两态双门期望。
- **D-8 布局校验激活条件文档化（`logic/gate-logic.ts:1445`，零代码改动）**：设计级「主文档 + 6 子模板引用块 + §0 SSOT 头 + DoD 清单」布局校验（`checkPhaseSpecStructure`）仅在 `phase ∈ {1..4}` **且**显式传入 `--spec-dir` 时执行；未传参时整组跳过（`specStructure: 'skipped'`）。SSoT §10.5.2 与 `command-reference.md` 补该激活条件。
- **超范围修复（并入叙述）**：`check-budget.ts` 增 isMain 守卫（导出 `countReworks` 供测试 import 不触发 CLI）；`checkpoint-logic.ts` import 顺序修复（lint:security 零新增）；`docs/debug/2026-09-20-wm-8phase-live-run/README.md` 订正终局状态披露（「12 项门禁全绿」仅对应 13:20Z 快照，放行后修复循环如实披露，非门禁缺陷）。
- **验证**：每项修复均有单测正反例（RED→GREEN；如 D-1 三放行用例在旧矩阵下全红 + 未列组合仍拒、D-2 负例不充数、D-4b 超限/恰平/未提供/Σ=0 四态、D-5 同一条记录两门同判与真 schema 错仍红、D-6 phase≥2 不变回归 + phase 1 后置窗口、D-7 活动位/归档恰一/多匹配三态）；`self-test` 358 与 `lint:security` 零新增已在分支内实测，最终由本分支任务 10 全量 prepush 复核；demo 复验（移除 D-3 junction 绕过物后受影响门禁重跑 + 签名链新形态重放）由任务 10 执行，证据落 `docs/debug/2026-09-20-wm-8phase-live-run/gate-fix-replay.txt`。
- **登记不修（如实列出）**：D-6 的 R8 同源张力（R8 侧豁免超出规格 §6 授权，登记交最终审查甄别）；D-4b CLI 接线无常驻回归锁定（删除 tokensUsed 传参单测其余仍绿，登记为后续任务候选）；R3(fix) 正确动作形态（`r3-{completeness,reliability,security}` + `variant:"fix"`）在文档中缺显式示例（真实执行写错动作名的候选文档改进项）。

### 门禁结构校验入口合并（`checkRequirementSpecStructure` → `checkPhaseSpecStructure`，2026-09-20）

> 背景：第三源吸收收尾时登记的观察——阶段 1 规格结构校验存在**两套并行实现**，其中 `checkRequirementSpecStructure`（阶段 1 专用）只被 `self-test` 与单测调用、**不接任何 CLI**，门禁实际走 `checkPhaseSpecStructure`。两套实现判据集相同而措辞不同，属"改了 A 忘了 B"的结构性风险。版本保持 42.2.1，**不 bump**。

- **删除重复实现**：`checkRequirementSpecStructure` 从 `logic/gate-logic.ts` 移除（-54 行）；其判据集经逐条比对确认已由 `checkPhaseSpecStructure(1, …)` 全覆盖——`PHASE_SPEC_LAYOUT[1].refs` 与旧硬编码的 6 个引用文件名逐字相同，SSOT 头四项、DoD ≥ 8、`checkOutOfScopeRegister` 三组判据的谓词与消息逐字一致（仅"引用块缺失"一处措辞不同，全仓无任何断言依赖它）。
- **fs 注入契约随合并放宽**：`checkPhaseSpecStructure` 的 `fs.readdirSync` 改为**可选**——它只有 phase≥2 的「主文档 glob」需要，phase=1 走固定文件名，合并后 phase-1 调用方不必再为一个用不到的方法写桩。**缺省时 phase≥2 报 `refs` 违规**（fail-closed，不静默跳过整组校验），该分支有单测钉死。
- **调用方重指向**：`cli/self-test.ts`（import + 2 处调用 + 3 处注释）与 `__tests__/gate-enhancement.test.ts`（import + 4 处调用 + 1 处注释）改调 `checkPhaseSpecStructure(1, dir, fs)`；全仓 `checkRequirementSpecStructure` 残留 **0**（`docs/superpowers/plans/` 内的历史规划记录按惯例不改写）。
- **零面与等价性证据**：不新增 CLI/schema/fixture/references 文件；`self-test` 实测 **358/358**、`gate-enhancement` 实测 **75/75**（含新增 2 例 fs 注入契约）、security-scan 零新增、prettier/tsc 全绿。因旧实现的测试断言与门禁消息在新入口下逐字成立，合并**未弱化任何一条判据**。

### 第三源吸收（《需求设计一体化流程》v6.0：§4.2 验收标准可量化 + §5 ADR 三列结构门禁，2026-09-19）

> 吸收决策记录见 [`docs/changes/decision-log/absorptions.md`](./docs/changes/decision-log/absorptions.md)「第三源吸收（《需求设计一体化流程》v6.0 …）」节（含先决事实、逐项判定表、明确不吸收清单与理由、4 项带验证方法的候选）；权威定义见 SSoT §10.5.4。版本保持 42.2.1，**不 bump**。
>
> **来源形态与判据取舍**：源为 Python 栈多智能体协作规格（3116 行，R1–R16 十六角色 + 三循环 + YAML 编排 + SQLite + 补偿 + HITL + 引擎）。精读发现其**概念层与可执行层严重不对齐**——三循环状态名只出现在一张 ASCII 图里、`on_failure`/补偿注册表/死信表/错误分类器/HITL 请求对象**均无执行者**（导入未用或从不读取），设计门禁更由**产出者本人**自审。故其循环与运行时机制**不按"机制"吸收**，只吸收契约层，且**不吸收其任何数字阈值**（源文档内部自相矛盾：同一故事规模阈值 50 与 100 并存、两套技术词黑名单不一致、INVEST 的 Estimable/Testable 是恒真桩）。

- **J1 §4.2 验收标准可量化校验（phase 1）**：`templates/requirement-spec.md` §4.3、§4.2 的 NFR 提示、`discipline-dod.md` 自检项、`phase-1-requirements.md` 禁止行为 #3 —— **四处写了「禁止主观词/不可测量表述」，`主观词` 在全仓脚本命中 0**。现 `check-artifact-gate.ts --phase=1 --spec-dir=<dir>` 新增 `acceptance` 桶逐行校验主规格 §4.2 表：`类型=acceptance` 行的「验收标准」列不得为空，任一行该列不得含 `SUBJECTIVE_ACCEPTANCE_WORDS`（= `快速`/`友好`/`性能良好`/`高可用`/`易扩展`，**单一事实源导出常量，词表来源限定为仓库既有文档自己点名的词，不外扩**）；`{{...}}` / `—` / `-` 视为未填。**判据边界如实声明**：只判字面命中，「标准是否真的可测」仍归 V 评审 `testability` 轴，门禁通过不等于验收标准合格。表不存在即整组跳过（表完整性不在本判据职责内，故无存量夹具受影响）。
- **J2 §5 ADR 三列结构校验（phase 2）**：`templates/system-design/system-architecture.md` §5 写「强制：每条 ADR 有决策 + 上下文 + 后果（**缺则 FM-SD-02**）」，而 **FM-SD-02 在全仓脚本命中 0**——失败模式编号存在、判据不存在。现 `--phase=2` 新增 `adr` 桶逐行校验 `*-system-architecture.md` §5 表的三列非空。**只吸收确定性核**：源侧 ADR 另要 `状态` 与 `备选方案` 并规定「后果须含正负两面」，仓库**不吸收**——`备选方案` 已由阶段 3 `interface-contract.md`「备选方案」节与阶段 4 `class-design.md`「方案权衡」列承载，再加一列即 duplication。**判据边界**：**不判「是否该有 ADR」**（三问门槛是判断型准入，脚本判不了），故不强制条数 ≥1，表为空或缺节均不报。
- **判据不越界**：阶段 1 不施加 ADR 判据、阶段 2 不施加验收判据（各有单测钉死）。
- **端到端实证**：以临时项目实跑 `--phase=2 --spec-dir=…`（ADR-001 缺「后果」→ `GATE_JSON.reasons` 出现该桶、exit 1）与 `--phase=1 --spec-dir=…`（「页面响应快速」→ 主观词桶；「—」→ 空缺桶），两条判据均经门禁退出码生效，非仅单测。
- **文档同步（SSoT 优先）**：SSoT 新增 §10.5.4（按 §10.5.3 M08 体例：落点表 + 零面承诺 + 能力分工 + 判据强化披露 + 判据不越界 + 反模式挂靠）；`templates/requirement-spec.md` §4.3 与 `templates/system-design/system-architecture.md` §5 补门禁指针与判据边界；`references/phase-1-requirements.md`（禁止行为表后补门禁强制注）、`references/phase-2-system-design.md`（FM 表后补「FM-SD-02 的 ADR 半边已门禁化、评分半边仍归 V」注）、`references/command-reference.md`（`--spec-dir` 补**六桶清单**与「读证据须数对应桶条数、不得只看整体退出码」）。
- **刻意不做（避免计数面扩散）**：不新增 CLI（保持 48 个 `cli/*.ts`）、不新增 schema（34 份）、不新增 references 文件、不新增 samples fixture（11 例新单测以 vitest 内联 `mkFs` 表达，self-test 358 不变）、不新增反模式（仍 #48）、不改硬约束条数（仍 14）与 pre-push 项数（19）。两项落地均在既有门禁脚本内。

### 第五源吸收（dsh-normify：R16 节点 id 唯一 + R15f 行号锚点越界 + 覆盖率空集维度显式化 + I4 `--spec-dir` 阶段契约，2026-09-19）

> 吸收决策记录见 [`docs/changes/decision-log/absorptions.md`](./docs/changes/decision-log/absorptions.md)「第五源吸收（dsh-normify …）」节（§1–§7 逐项判定表 + 明确不吸收清单 + 5 项带验证方法的候选；**§8 为深读源码后对前文的订正**；§9 新增落地 I4；§10 同族缺陷定向审计登记）。版本保持 42.2.1，**不 bump**。
>
> **证据基础的自我订正**：§1–§7 最初写于仅读该仓库 `README.md` + `skills/normify-gen/SKILL.md` 两份文档之时。经质疑后补做 `git clone`（HEAD `ed404e5`）并派 5 路子代理精读 `src/`（实测 **7749 行**，其 README 自称 7168 行已过期）、`docs/SPEC.zh-CN.md`（701 行）、`tests/`（585 行）、`CHANGELOG.md`（241 行）与 4 份 release notes，据此订正 6 处不实陈述（K1–K6）——其中 **K1**：被列为一项机制的「几何自检 `check-geometry.mjs`」**在仓库中根本不存在**（`scripts/` 只有 `build.sh`；无删除记录；CI 从不运行；README 的「28 层线压线 0 处」无可用产物可复现），真实存在的只是渲染器内部一个写 3 次读 0 次的降级标志。

- **R16 节点 id 全局唯一（`logic/graph-logic.ts` + `cli/check-requirement-graph.ts`）**：`graph-guide.md` 长期只以散文声明「节点 id 全局唯一」，实现零强制——重复 id 被 `Set` 静默合并后，连通性/孤立/父唯一/环/信息流全部在「多节点合并为一个判定单元」的语义上计算，两个节点各自的问题互相抵消（一个出度 0、另一个入度 0，合并后既非黑洞亦非奇迹）。**已实证复现**：`valid-warnings.json` 追加同 id 节点后 `totalNodes: 5` 而唯一 id 仅 4、`levelDistribution` 出现 `{"4": 2}`，门禁仍 `passed: true`、exit 0。现于构建 id 集合**之前**判重，命中即 violation 并在 `duplicateNodeIds` 暴露定位；新增 2 例回归（唯一/重复）。
- **R15f 行号锚点越界（同上二文件）**：`evidenceAnchor` 此前只验 `path` 存在、不验行号，故 `x.ts:L99999=…` 能通过门禁——锚点在断言一个不存在的行，「证据」退化为「看起来像证据的字符串」。现校验 `1 ≤ start ≤ end ≤ 文件内容行数`（区间倒置与越界同为 violation），行数按**内容行**计（末尾换行不多算一行，否则 `:L<末尾+1>` 会被误放行）。logic 层不做 I/O，由 CLI 仅对行号锚点读盘注入 `anchorLineCounts`；未注入或 path 不可读即跳过（与既有 R15c/R15e 同构，不误红）。**判据边界如实声明**：只判行号是否落在文件内，不判该行内容是否支持 `=statement`（语义判断仍归 V 评审）。新增 5 例回归（越界/倒置/区间内/不可读跳过/section 锚点不受影响）。
- **覆盖率空集维度显式化（`logic/coverage-logic.ts` + `cli/check-requirement-coverage.ts`）**：空集维度的重算覆盖率是 100%（`vacuously true`），与「确实全覆盖」数值不可分——报告里的 100% 若来自空集而被读成"已覆盖"即「零命中当通过」。现新增 `vacuousDimensions` 字段 + 警告项 + CLI 人类可读行；**不升级为 violation**（非空约束已由 C1/C3/C5 与 C7b 分别处置，改判会与既有语义冲突）。可达路径无需任何豁免：项目无横切需求且 graph 亦无 `cross-cuts` 边时 `crossCut` 即为空集。新增 3 例回归。
- **I4 `--spec-dir` 阶段专属参数契约（`cli/check-artifact-gate.ts`）**：缺 `--phase` 时 `--spec-dir` 被**静默丢弃**（`specStructure` 记 `null`，而代码注释中 `null` 的语义是"阶段 5-8 不适用"）⇒ 调用方读不出那个绿是"校验通过"还是"根本没跑"；空格形态 `--spec-dir <dir>` 与空值 `--spec-dir=` 同样落成"未提供"，且人类可读段反过来提示「**未提供 `--spec-dir`**」——调用方明明传了。现与同文件 `--tickets` 的既有契约（其注释原文即「不在低阶段静默跳过参数」）及 `--scope` 条已写明的原则（「**不输出「未提供 --scope」误导文案**」）对齐：空格形态/空值 → `ARG_INVALID`；阶段 5-8 或缺 `--phase` 而给定 → `ARG_INVALID`；缺省不传行为完全不变（阶段 1-4 仍记 `skipped` 并打印「⚠ 未执行」，阶段 5-8 仍记 `null`）。`command-reference.md` 同步补该契约。`gate-ticket-content.test.ts` 新增 5 例（含 `--phase=1` 合法形态**不得误红**），实测 44/44 通过。**为何属吸收**：这正是源侧最严重缺陷「以可选输入为条件的门禁就是可选门禁」的同族实例，而修复依据是本仓库自己已写下的两条原则，非引入外部口味。
- **文档同步（SSoT 优先）**：SSoT §10.10.1 新增「节点 id 全局唯一（R16）」（含「判据须在构建 id 集合之前」的成因与为何按 violation 而非 warning）、§10L.2 R15 子项表补 R15f 行 + 判据边界 + 外部依赖注入口径（`R15a/b/c/e` → `R15a/b/c/e/f`）；`references/evidence-anchored-tree.md`（§2 映射表 + §3 子项表 + R15d 段落措辞）、`references/graph-guide.md`（节点 id 唯一性的 R16 强制口径）、`references/conventions.md`（evidenceAnchor 词条：订正已过期的「可选，R15 不强制」为 41.7.0 起必填，并补 R15f 指针）、`references/command-reference.md`（覆盖分析 CLI 补 `vacuousDimensions` 语义 + artifact gate 补 `--spec-dir` 契约）。
- **L0 链接基线 rebaseline**：`helpers/l0-baseline.ts` 的 `relativeLinkCount` **676 → 678**（`conventions.md` 的 `evidenceAnchor` 词条新增 2 条同目录链接；`npm run audit:l0-links` 实测 `l1Only` 仍 95、`placeholders` 仍 36、`violations` 仍 0）。
- **同族缺陷定向审计（登记不修）**：以「文档保证而机制不保证」三族对本仓库脚本定向普查，登记 A 族（可选输入门禁）7 处、B 族（无人读取的契约字段；抽样 688 个 schema 属性名）4 处、C 族（先过滤再校验）3 处，逐条附 `file:line`。最重的两条登记项：**A2** `check-requirement-graph` 的 R9–R14 整组跳过时 `GRAPH_JSON` **连"未执行"标记都没有**；**B1** `budget.schema.json` 的 `perPhase.maxTokens` 等四个上限在 schema 里承诺「超过触发 onExceed」「强制 CHECKPOINT」，实际无任何门禁校验（四个字段名在非测试脚本中只出现在类型声明处）。判定与处置见决策记录 §10。
- **刻意不做（避免计数面扩散）**：不新增 CLI（保持 46 个 exit-2 脚本）、不新增 schema（34 份）、不新增 references 文件、不新增 samples fixture（新判据用例以 vitest 内联对象表达）、不改 run-log action 枚举与 pre-push 项数（19）。全部落地均在既有门禁脚本内。

### 调测报告订正与技能包诊断修复（2026-09-19，来源：`docs/debug/2026-09-19-wm-8phase-full-debug/`）

> 该目录为**未跟踪审计产物，不随本次提交交付**（同 2026-09-18 外部调测先例）。规格见 `docs/superpowers/specs/2026-09-19-debug-report-corrections-design.md`（含 §5.3 修订 r1、§5.4 修订 r2）、计划见 `docs/superpowers/plans/2026-09-19-debug-report-corrections.md`。版本保持 42.2.1，**不 bump**。
> 验收依据：全量 19 项 `npm run prepush` + 交付资产重放 **119/119**（89 次门禁脚本 + 29 次 wm-write + 1 次 wm-status，0 次非零退出）+ 负向探针 **9/9** 被真实拦截（记录 `eval/e2e/2026-09-19-8phase-debug-replay.md`；首轮证据绑定资产提交 `8ae12c56`，最终审查修复轮重放的证据绑定重放 HEAD `bf56f858` / 资产提交 `bcea41d9`）。

- **S1（聚合门子进程预算与诊断）**：`EXEC_LIMITS` 新增 `modelCheckChildTimeoutMs`（360s），`artifact-gate-assets.ts` 三处 `runSync` 显式传入——原实现落回 15s 默认值（既有用例甚至把该默认值写死在断言里），负载下真实 TLC 子进程被杀只报「退出码 unknown：」；`appendProcessViolation` 现报出信号名与超时语义，前缀形态保持不变。
- **S2（层次校验措辞）**：`checkHierarchy` 增可选 `filteredOutPaths/fullPhaseByPath/phase`，被 `--phase` 过滤掉的 child 报「属后续阶段（phase=N；当前校验 phase=M 不包含它）」，不再误报「不在 manifest 中」——该误报正是审计报告把「phase 形态错配」当成「不变式伪造被 TLC 拒绝」的成因；判定结果不变（仍拦截），缺省入参行为与旧文案逐字不变。
- **F-1（RTM 覆盖率单一事实来源）**：`gate-logic.ts` 抽出并导出 `computeRtmTraceCoverage(rows, phase)`，`wm-status` 与 `check-artifact-gate` 共用；原 `wm-status` 按展示字段字面量 `'100%'` 统计，导致全行 `coverageStatus="完整"` 的矩阵显示 0/4（聚合门判 100%）——现同源，实测 4/4（100%）。
- **F-2/F-3/F-4（BDD 约定文档化，含一处事实订正）**：`bdd-manifest.schema.json` 的 `basePath` description 与 `references/bdd.md` 现写明**两处消费方对 `basePath` 的锚点相同（均 `resolve(projectDir, basePath)`），差异在兜底候选集**（`check-bdd-model` 另有 `.w-model/<filePath>`、`.w-model/bdd/<filePath>`、`<projectDir>/<filePath>` 三条；`check-artifact-gate` 无兜底，直接报 `[artifact:bdd] feature file missing`）——审计报告原写「解析基准不同」为误述，本轮按代码事实订正；同处补 D4 的 `SM-` 前缀配对约定与 D6 的 When/And 行「行末 ASCII 词为事件」约定（含经真实正则实测的可复现示例）。
- **可重放资产交付**：`eval/e2e/demo-assets/`（受跟踪：装配器 + 轨迹驱动 + 9 项负向探针 + README）——装配器改为运行时取 `REPLAY_BASE..REPLAY_HEAD` 真实差异、轨迹驱动去绝对路径并内置 `119/0` 计数自断言、工作区残留 `.git` 时 fail-closed（实测该残留会让 p5–p8 的 `--scope` 过期、只剩 114/119）、`--reset` 在 Windows 上能自愈只读 git 对象；负向探针的期望词经加固（`失败规则：.*R6` / `不变式违反 *: *[1-9]` / `--- D5 Step Binding: [1-9]`），避免环境降级或旁因失败被误判为「真实拦截」。
- **报告订正（未跟踪目录内）**：P1–P9 —— 探针归因拆分为「phase 形态错配」与「真实 TLC 拒绝伪造自报」两条（8→9 项）、执行条数口径改为 89+29+1、签名链 48→49、写入 32→29、日志文件 12→13、阶段 1 无 Verifier、F-7 残留措辞；新增 §6.1 如实登记报告自身 F-2/F-4 两处表述不准。
- **最终审查修复轮（2026-09-19 晚，本子节的第一波修复之后）**：装配器**两处**删除点（`--reset` 整树清空、常规 7 目录重建）前加同一条「本装配器工作区」判据——`ROOT` 不存在或为空（首次构建）或含哨兵（`SPEC.md` 与 `.w-model/project.json` 同时存在）才允许，否则 exit 1 并给处置指引（常规路径不再能静默删除 `WORKSPACE` 误指目录的 `.w-model/tla/features/src/test/docs/archive`）；负向探针在 grep 断言**之后**把 `[NP:<id>] EXPECT_MATCH=yes|no` 写回日志，并追加 `probe-orig residue count`（本轮实测 9 yes / 0 no / 0 残留），归档日志自证「命中期望词」；`git diff --name-only` 前插 `-c core.quotePath=false` 并改按行切分；`os.chmod(..., S_IWRITE | S_IREAD)`；`trap` 改为「信号也恢复并中止」。文档侧：规格 §5.4 修订 r2 入档（F-2 由「基准不同」订正为「锚点相同、兜底候选集不同」）、SSoT 子进程预算改为可证形式（每规格各计一次，N×360s）、RTM 覆盖率口径限定「同一 `phase` 下」、`command-reference.md:234` 补整数百分比、`bdd.md` D6 历史示例注记、重放记录删去无日志证据的 wm-status 复跑括注并刷新为修复轮 2 重放（119/119 + 9/9，数字三轮一致）。
- **登记不修（如实列出）**：`references/bdd.md` 全文 63/72 行 `When`/`And` 示例不符 D6 事件正则（既有文档风格，属独立事项；最终审查修复轮已加注记「历史示例为示意，不参与 D6 校验」）；探针 7 的 `codeModule` 词区分度偏宽（`codeModule` 类文案在多条规则中共用）；`build_workspace.py` 的 `_RP` 解析无 try/except。**（原登记两条已由最终审查修复轮修正：`rmtree_force` 的 POSIX 权限收窄 `0o200` → `S_IWRITE | S_IREAD`；探针脚本 `trap` 信号不中断 → 恢复后 `exit 1`。）**

### 全部遗留事项收口（leftovers-closeout：B / J1 / N / O + 第三方调测 D1-D3，2026-09-18）

> 计划与逐任务记录见 `docs/superpowers/plans/2026-09-18-leftovers-closeout.md`（文末新增「收尾记录」节：计数终值逐处来源、L0 rebaseline 实测、窄口径四值与阈值出处、O 的 5 文件普查、外部审计发现登记）与 `.superpowers/sdd/2026-09-18-leftovers-closeout/`（逐任务报告与审查 diff）。版本保持 42.2.1，**不 bump**。
> 验收依据：`npm run prepush` **19 项全量**——收口实测 **19/19 全绿**、`PREPUSH_EXIT=0`、末行「全部门禁通过，允许推送 ✓」（第 12 项 vitest 全量 + coverage 阈值、第 13 项规则层口径、第 15 项 docs-consistency 同次受控运行全部通过；逐项结果见计划文档「收尾记录」§9 与任务 10 报告）。

- **B（规则层覆盖口径门禁）**：新增 `logic/coverage-scope-logic.ts` + `cli/check-coverage-scope.ts`——按 logic+lib 白名单分母重算 istanbul 四指标并独立强制阈值，作为 pre-push **第 13 项**（门禁总数 18 → **19**）；`config/vitest.config.ts` 增 `reporter: ['text','json']` 产出 `coverage/coverage-final.json` 供其消费（白名单零命中 → exit 2 fail-closed）。阈值 = 2026-09-18 实测（logic+lib，`fileCount` 68）stmts **84.26** / branch **77.88** / funcs **93.68** / lines **87.01**，向下取整到 5 的倍数 = **80 / 75 / 90 / 85**（出处：`.githooks/pre-push` 第 13 项注释 + `config/vitest.config.ts` 的 coverage 块注释）；全分母地板维持既有 75/65/85/75（本次未动）。
- **J1（run-log R11 闭环五脚本）**：`logic/run-log-logic.ts` + `cli/check-run-log.ts` 新增 **R11**——凡有 `action=checkpoint` 且 `outcome=success` 放行的阶段，放行前须已有 `check-budget` / `check-run-log` / `check-maturity` / `check-checkpoint` / `check-preventive-review` **五条** `role=G` + `outcome=success` + `gateExitCode=0` 记录，且时间戳**严格早于**放行（同秒不算、**无时间戳豁免**；无放行的 run 不触发、摘要不出现 `r11` 键）；CLI 摘要增 `r11 {checkedGates, missing}`。新增负向样本 `bad-r11-missing-closure.jsonl` 与 `bad-r11-late-closure.jsonl`（后者**必然同时报 R7 append-only**，R11-only 不可达，已在 `samples/README.md` 说明）；`RUN_LOG_CASES` 17 → **19**，self-test 356 → **358**。
- **N（code-health 语义审计 + 真实 git 端到端）**：7 个 code-health CLI 对治理参考逐条审计，16 行判定 = **一致 × 11 / 文档错 × 3 / 实现错 × 1 / 无测试覆盖 × 1**；3 处文档错改治理参考（Phase 1 候选只 `discovered`/`blocked`、`changedFiles` 非空即只读违规、P4 `under-review` 不是批准），1 处实现错按 TDD 修复（`cli/code-health-apply.ts` 的 `SCOPE_MISMATCH` 分支补真实反向应用 + 按 pre-change 快照做 `git status` 残差回读，拒绝时保留受控 patch 与回滚计划）；`code-health-e2e.test.ts` 新增真实 git 隔离仓 e2e（T7-1…T7-6：apply 拒绝分支、archive 两条链、`--guard` 全链路真删+失败回滚、`duplicates` 只读、`phase1 --scenario` 三形态）。审计方法与逐行证据见计划「任务 6 · N 审计表」。
- **O（规则负载性三态测试）**：按 coverage 实测选 statements 最低 5 个 logic 文件——`tla-logic` **61.22** / `verifier-logic` **69.31** / `checkpoint-logic` **69.47** / `code-health-contract` **69.83** / `root-cause-logic` **72.63**（快照 mtime 2026-09-18 11:38），为 **43 条规则**建 GREEN / RED / STRIPPED 三态测试（`*-rule-loadbearing.test.ts` × 5 + `helpers/strip-rule.ts` 剥离助手；vitest 下「tmpdir 副本 + 绝对路径 import」实测可用，**未启用备选方案**），`rule-loadbearing` 实测 **6 文件 57/57 通过**；**未发现死规则 → 零 `logic/` 实现改动**；不可剥离项（无块体单语句 `if`、`} else` / `} else if` 形态）与 schema 分层防御不可达项已逐条如实登记，未硬凑。第 6 名 `preventive-review-logic` 实测 **78.26**（任务 9 报告写的 79.17 为笔误，已在收尾记录勘误）。
- **D1 / D2 / D3（来源：外部第三方 8 阶段全流程调测 `docs/debug/2026-09-18-wm-8phase-full-trace/REPORT.md` §5.1–§5.3，该目录为未跟踪审计产物、不随本次提交交付）**：D1 `cli/doctor.ts` 的 `TOOLS_DIR` 缺 `dirname()` → `tla2tools.jar` 在盘仍恒报缺失、`--with-tla` 误阻断（修复后 `--with-tla` exit 0）；D2 `cli/check-requirement-graph.ts` 的项目根判定被技能自身产出的 gitignored `.w-model/gate-logs/` 残留截断 → R15c 结论随盘面 1↔0 翻转（改为就近判定 + 仅「含常规文件的 `.w-model/`」计为项目状态目录；**未采纳**「全局优先 `.git/`」，实测会误判嵌套项目到外层仓根）；D3 `cli/check-run-log.ts` 的 `--json` 输出剔除非确定性 `durationMs`（人类通道 `RUN_LOG_JSON` 按规格保留，`JsonReport.durationMs` 改可选并写明契约边界）。三项均补红→绿回归，**断言强度未降**。
- **L0 链接审计 rebaseline**：`w-model-dev/scripts/__tests__/helpers/l0-baseline.ts` 的 `relativeLinkCount` **675 → 676**（`l1Only` 95、`placeholders` 36 不变，`violations` 仍 0；`npm run audit:l0-links` exit 0 实测）——成因是 `references/operational-recovery.md` 补 R9/R10/R11 摘要时新增 1 条同目录链接（`git diff` 实测该文件本次仅此 1 行改动、净 +1 条相对链接），属正当产物、**未回退该链接**。
- **计数与活体文档终值同步**：`self-test` 统一为 **358**（实测「总计 358 条用例：358 通过，0 失败」；44 个 `*_CASES` 数组实加 357 + 1 条元数据用例闭合）——`.code-health-governance.json` 的 `selfTestSamples` 与 `README.md` / `CONTRIBUTING.md`（3 处）/ `.githooks/pre-push` / `AGENTS.md` / `docs/user-guide.md` / `docs/INSTALL.md` / `scripts/test-affected.cjs` / `references/subagent-delegation.md` / `samples/README.md`（含 `RUN_LOG_CASES` 与实加合计）逐处按实测订正；`SUBPROCESS_TEST_FILES` 条目数（实测 **40**，指真实 spawn 子进程的测试文件、非 `*.test.ts` 总数 98）改为「清单长度 + 实测值」表述，不再写死「30 个测试文件」；顺带修正 `samples/README.md` 对 R10 的**已删除**机制（`LEGACY_REVERT_EVIDENCE` cutoff）的描述。
- **登记不修（如实列出）**：外部调测的 **G1–G5** CLI 级正向样本缺口（G1 `check-tla-model` / G2 `GRAPH_CASES` phase 2-4 / G3 `GATE_CASES` phase 7-8 / G4 `ROLE_DISPATCH_CASES` / G5 = 上述计数漂移，**G5 本轮已修**）与 **R-1**（`exit2-failure-atomicity` 的「仓库状态逐字节不变」断言对并发写盘敏感，建议快照范围收窄到门禁自身产物路径）。

### 审查问题修复（review-remediation，2026-09-16 ~ 2026-09-17）

> 计划与逐任务记录见 `docs/superpowers/plans/2026-09-16-review-remediation.md` 与 `.superpowers/sdd/2026-09-16-review-remediation/`（含 3 次独立 V 复审记录）。收口实测：`npm run prepush` 18/18 全绿。

- **严格证据语义，删除时间戳豁免（M07 / R10）**：阶段 5–8 当前阶段层 `total>0` 缺合法 `evidence` **一律阻断**；`fix` / `emergency-fix` 缺合法 `revertEvidence.command` **一律阻断**（`timestamp` / `lastUpdated` 只作日志与 RTM 元数据，不参与信任判定）。`GATE_JSON.testEvidence.legacy` 与 `RUN_LOG_JSON.r10.legacy` 计数键保留但**恒为 0**（含义是「没有时间戳豁免」，不是「历史记录已被证明有效」）。旧数据迁移必须重跑真实命令、保存原始输出与 SHA-256，并经 `wm-verify-evidence-source` producer 记录当前 HEAD / source bundle / 运行身份。
- **安全项目路径**：新增 `lib/safe-project-path.ts`（词法检查 → `lstat`/`realpath` containment → 普通文件判定）；`--tickets` 与 M07 E2 原始输出核验在**任何读取之前**拒绝绝对路径、盘符、UNC、反斜杠、NUL、`..`、symlink/junction 与目录。
- **`review-package.ts`**：只接受等号形态参数（未知参数、空值、无值选项一律 `ARG_INVALID` / exit 2，不回退 cwd）、Git 范围与正文使用**完整 SHA** 与固定日志格式（不受 `core.abbrev` 影响）、同目录**原子写入**（写入失败保留既有目标，不做「先删后改名」降级）。
- **S18 精确符号匹配**：定义与引用按 owner/member 头精确比对，参数名与返回类型不再参与匹配（未定义完整符号头即阻断）；空白 `command` 由 Schema 与逻辑层双重阻断。
- **负向覆盖登记册可执行化（第 5 条规则）**：登记册四列语法严格化、机制枚举、每门禁恰一行、证据必须解析为 `文件:行号` 且在文件行数内；逐门禁**执行真实 exit-2 探针**（探针定义与 `check-docs-consistency` 中心探针共用 `lib/exit2-probe-registry.ts`，每个探针一个独立隔离根 + 有界并发），断言 exit 2 + 可解析 `ERROR_JSON` + 同类别人类错误行 + 探针根零漂移。
- **活体文档一致性**：AGENTS §8 登记判据由**全文子串**收紧为**表格行精确匹配**（正文提及、代码块、相似前缀都不算登记）；新增 `w-model-dev/scripts/__tests__/README.md` 覆盖矩阵与在盘测试文件集合的**双向等价**检查；`check-pollution` 目录排序改为 locale 无关（同输入跨 `LANG`/`LC_ALL` 逐字节一致）。
- **pre-commit 钩子**：判定只读 index 快照（不读工作树同名文件）、hook 内路径统一为当前 Bash 形态、超时按**进程树**终止并在 Git Bash 的 `ps -o` 不可用时探测回退 `ps -ef`（两者都不可用则 fail-closed）。
- **快速车道（DX）**：新增 `npm run test:affected`——按改动映射选择测试文件（触及 `config/**`、`.githooks/**`、`schemas/**`、`references/**`、`samples/**`、`docs/**`、`eval/**`、根 `scripts/**` 与根活体文档时自动退回全量）；**验收必须全量**（`npm run prepush` 18 项）已写入 README「验证仓库」块、CONTRIBUTING「本地推送前门禁」节与 AGENTS §6。
- **门禁自身的既有缺陷一并清偿**：`lint:security` 陈旧 baseline（83 项发现）在代码内逐处具名豁免、baseline 未改；严格 M07 下 `samples/gate/valid-phase6.json` 补真实 evidence；`run-sync` 台账校正行号并补登 10 处未登记的直接子进程调用；`gate-report` 的注释剥离器误报（代码字符串中的 `/*`）与 Windows 跳过的用例一并处置（全仓测试无 `skip`）。

### R-persona 选择可校验化与人格能力声明（r-persona-selection-auditability，2026-09-17）

> 起因：对「R 是否应按需加载证据/定位/code-review 等人格」的分析。结论是 R **已在**按需加载（`subagent/` 28 人格 + 选择矩阵；「R 不调用 Persona」仅指不加载 `agent-personas.md` 的 4 个 V 评审 Persona，理由是 V 之后还要复审 R 的产出，需保持视角独立）。真正的缺口是「按需」不可校验，故本次把三处缺口补齐。

> 收口实测：`npm run prepush` **18/18 全绿**（`PREPUSH_EXIT=0`；经 3 轮才转绿——第 1 轮止于 security-scan 新增发现、第 2 轮止于 `run-sync` 台账行号 provenance 漂移，均按「改代码而非放宽门禁」处置，baseline 未改）。实现记录（含逐轮失败与处置、门禁边界裁定、遗留项）见 `docs/superpowers/plans/2026-09-17-r-persona-selection-auditability.md`。
>
> **兼容性（行为收紧）**：R11 对全部报告生效、**无时间戳豁免**（沿用本版本确立的严格证据语义）——此前可通过的「视角取自矩阵外」或「视角与自述 `category` 不相交」的多角度报告，现在 exit 1。

- **新增 R11 校验规则**（`logic/root-cause-logic.ts`）：多角度报告（`method=combined`）的 `partialReports[].personaSlice` 必须为矩阵内已知 persona，且与 `rootCause.category` 第一键行候选集**有交集**；`partialReports` 缺失由 R9 判失败、`noRootCause` 分支无 category——两者跳过 R11。legacy `reality-checker` 归一化为 canonical 后参与比较。
- **R-persona 两键矩阵**：第一键 `rootCause.category`（R 自述，7 行）+ 第二键风险域信号（安全 / 性能 / AI-LLM，**由 V/G 产出特征读出而非 R 自述**，命中即**叠加**不替换）；新增四条仲裁规则（并集 / 上限 5 时保留必含项与第一键行成员并记录裁剪 / 第一键分歧须改判或记录证据 / 门禁边界如实陈述）。矩阵以 `R_PERSONA_MATRIX`、`R_PERSONA_SIGNAL_MATRIX` 为 R11 判据源。
- **persona 能力声明四字段强制**：28 份 `subagent/*.md` frontmatter 补 `capabilities` / `inputs` / `outputs` / `boundaries`（单行、值内只用全角标点）；`check-docs-consistency.ts` 新增 `persona-capability-declarations` 检查，任一文件缺一字段即 exit 1。`boundaries`（适用 / 换人）是「按需加载」可执行的前提——缺它则人格选择只能照抄矩阵。
- **新增 `rootcause-persona-matrix` 一致性检查**：独立解析 `root-cause-logic.ts` 源码文本（TS AST，不 import 被检查模块）与 `agent-personas.md` §2 两张表的键与候选集**双向等价**，并断言矩阵引用的每个 persona 均存在于 `subagent/<name>.md`。
- **fixture 校正 + 新负向样本**：`bad-r10-no-reality-checker.json` 的 personaSlice 由**不存在的人格名**（`engineering-testability` / `design-architect`）改为真实矩阵人格（保持「仅触发目标规则」的夹具原则，并新增单测钉住该性质）；新增 `bad-r11-unknown-persona.json`（矩阵外人格）与 `bad-r11-category-mismatch.json`（自述 category 与所选视角行无交集），`ROOTCAUSE_CASES` 14 → 16。
- **门禁边界（如实陈述）**：数量约束（默认 3 / 上限 5）与 `incident-response-commander` 必含**不门禁强制**——它们是分派默认，由编排者按 `agent-personas.md` §4 与 token 预算（`budget-logic.ts` R4-A）执行；第二键因报告未声明信号字段亦不门禁强制，仅作分派指导。

### 审查修复第二批：成熟度豁免、覆盖率口径与规则层如实化（audit-remediation-2，2026-09-17）

> 续第一批，处理审查清单中的「建议」级与超范围项；实施记录见 `docs/superpowers/plans/2026-09-17-skill-audit-remediation.md` §8。

- **成熟度豁免落地（行为变更，本批唯一的门禁放宽）**：`check-artifact-gate.ts` 读 `.w-model/maturity.json` 的 `level`；L0/L1（教学 / demo / 小工具）且阶段 1-4 时豁免 TLA+/BDD 资产与同步要求。此前文档承诺该豁免但门禁无 maturity 输入 → 合法 L1 项目按文档走必被阻断。GATE_JSON 新增 `maturityLevel` / `tlaBddWaived`（键恒存在）+ 人类横幅；**缺文件或 level 非法 → 不豁免**（保持严格）。三臂回归：L1+阶段 1 命中豁免、L2+阶段 1 不豁免、L1+阶段 5 不豁免。
- **覆盖率口径：完成测量与归因，问题未解决（如实记录）**。根因确认：**被测试 import 的文件总会进入报告**，`coverage.include` 只影响未被 import 的文件——全量实测 83 个文件（logic 37 / lib 30 / cli 10 / infrastructure 3 / application 2 / **tests** 1），合并值 stmts **76.83** / branch 71.64 / funcs 87.86 / lines 78.88，statements 距阈值仅 **+1.83pp**。两种 `exclude` 写法（相对路径、`**/` 前缀）在**聚焦运行生效、全量运行均不生效**（机制未查明）→ **已回退配置改动**，不发布"已限定口径"的不实声明；阈值维持 75/65/85/75，风险与两次失败尝试如实写入 `config/vitest.config.ts` 注释。
- **弱断言加固（4 处）**：`fileParallelism ?? true).toBe(true)`（恒真）→ `not.toBe(false)`；三处仅断言 `typeof` 的计数/字节/耗时改为可证伪断言（覆盖计数等于必需数、字节等于磁盘实际大小、耗时整数且有界）。
- **fixture 去伪**：删除与 `valid-manifest.json` 逐字节相同的 `bad-no-rtm-mapping.manifest.json`（其「坏」由 `rtmRows` 参数注入），用例改为直接引用前者；samples/README 增「同字节复用」说明（两对 coverage fixture 的差异同样由参数注入，保留并文档化）。
- **规则层如实化**：反模式 #10 的「signature-chain 检测 O 越权」**经复核实现不存在**（R4 允许 O 出现在任意位置）→ 改为标注「无自动化检测，属人工核验」；#36/#43 的「G 门禁人工校验」改为「V 评审人工核验」（G 的允许动作不含核验）；约束 #11 标注「门禁不校验 5 脚本是否执行」；信息密度阈值统一为「< 2/章节 即命中」（消除 [1,2) 空档）；#20 的伪 action 枚举与 #21 的 `phaseOption` 伪字段改为真实判据；清理 4 处悬空括号。
- **自检断言强度：经复核无缺口（撤回本条初版结论）**。初版扫描称"23 条无断言"，两轮复核后证伪：各数组所用字段名不同（`expectedViolationPatterns` / `expectedRulesFailed` / `expectedReasonPatterns` / `expectedErrorPatterns`），用完整字段集重扫 213 条负向用例 → **无任何断言字段者 0 条**。相关插入已全部回退（`self-test.ts` 本批仅保留 BDD fixture 去重一处改动）。
- **三处自我纠正（如实记录）**：① 自检断言强度的两轮误报（`expectedViolationPatterns` → 再是 `expectedRulesFailed`）——最终结论是**无缺口**，初版与二版结论均已撤回；② 锚点规则在编辑后立刻抓出登记册 10 条引用漂移（新增该规则的目的即在此）；L0 链接基线随之 674 → 675；③ 覆盖率 exclude 的"聚焦生效、全量失效"两种结果并存，未查明机制即回退，不保留不可靠的配置声明。
- **未做（如实列出）**：`code-health` 6 个 CLI 的端到端语义（其规则层已由 self-test 43 条 `CODE_HEALTH_*_CASES` 覆盖）、其余 36 个 `logic/*.ts` 的规则负载性变异测试（建议按覆盖率最低者优先）。

### 全面审查修复：fail-open 治理 / 证据链 / 文档矛盾（audit-remediation，2026-09-17）

> 触发：对技能包的四维度独立审计（门禁脚本 / 文档一致性 / 测试与样本 / 规则与角色），发现按优先级修三批；全部 fail-open 结论均由复现探针确认后再修。
> 实施记录见 `docs/superpowers/plans/2026-09-17-skill-audit-remediation.md`。

**第 1 批 · 堵「零证据=通过」（6 处，逐条探针复现）**

- `check-checkpoint`：run-log 无 checkpoint success 记录时由 exit 0 改为 **R0 零证据守卫** exit 1（原状态还打印「已跳过 R3 校验」，自证跳过）。
- `check-state-machine-consistency`：四数组全空由 exit 0 改为 exit 1——CLI 头注本就写着「不得按全空合法图放行」，而单测固化了相反语义，单测已按新语义更新。
- `check-code-tla-consistency`：manifest 指向的 `.tla` 不可读时由「置空串继续」改为 **exit 2 / FILE_NOT_FOUND**（`tlaContent` 内联的自包含 manifest 保留可用）；实现时踩到 `exitWithError` 只设退出码不中断调用链的坑，探针复现后补 `throw new HandledCliError()`。
- `check-budget` R4-A：未配置 `rootcauseParallelBudget` 时改为**可见跳过**（warning，不再静默）；并修 `checkBudget` 只透传子结果 `violations`、丢弃 `warnings` 的缺陷。
- `check-iceberg-sweep`：`evidence` / `hypothesis` 由真值判断改为 trim 语义（单空格不再算证据）。
- `wm-status --json`：未初始化时输出机器可读对象（原为空 stdout，调用方无法区分「未初始化」与「正常空报告」）。

**第 1 批 · 可见性（把静默跳过变成显式可查）**

- `check-artifact-gate`：阶段 1-4 未传 `--spec-dir` 时 GATE_JSON 新增 `specStructure: checked|skipped|null` + 人类横幅提示（原先整组设计级校验静默不执行且输出侧不可分辨）。
- `check-signature-chain`：未提供 `existingPaths` 时 R8 不再计入 `rulesPassed`，新增 `rulesSkipped` 并修正横幅（原先打印「R1-R10 全通过」）。
- `check-verifier-output` R12：原 `!hasSpecificRef && e.length < 20` 放行「长而无引用」→ 改为**仅结构化引用**（文件路径 / §章节 / 第 N 章节行 / L 级 / 仓库 ID）；收紧时发现裸词根 `行/节/章` 会让「执行」「细节」「文章」误判为引用，故模式改为结构化形态。
- R13：非数值 `score` 不再静默跳过，改为显式违规。

**第 2 批 · 治理证据链**

- 负向覆盖登记册：实测 **29 条 fixture 行号全部漂移**（门禁此前只校验「文件存在 + 行号在范围内」）→ 一次性回填（含 3 条 `sampleDir` 目录型），并给 `check-samples-coverage` 新增**内容锚点**规则（`negative-coverage-evidence-anchor`：引用行内容必须出现该 fixture 名）；正/负两臂验证（注入 +3 漂移即精确报出该行）。
- `selfTestSamples` 与 6 处活体文档：352 → **354**（AST 实测：各 `*_CASES` 实加 353 + 1 元数据用例 = 354）。该常量位于 code-health 删除授权判定链上，诚实声明 354 的候选原先会被误判为矛盾。
- R11 负载性：新增 7 行正向 + 5 行负向测试（此前仅 `design-flaw` / `coding-error` 两行被钉住——变异实验证明 `tool-gap` 行换成任意两个真实 persona 后仍全绿）。

**第 3 批 · 文档矛盾（13 项）**

- 冰山放行判据统一为「`newFindings=[]` **且** R6/R7/R8 三视角对账通过；达 `MAX_ICEBERG_ROUNDS` 走 🔴 CHECKPOINT 由用户裁定」（原 `hard-constraints` 的「或达上限即放行」与 guide「零发现不构成终止」冲突）；规则集号 R1-R5 → R1-R8。
- BDD D2（gherkinSyntax）如实标注**未实装为脚本门禁**（门禁 7 维度，D2 由 V 评审人工核验）；`AGENTS.md` / `hard-constraints.md` 同步。
- code-health 发现者角色三方对齐（CLI 由 O 只读 / G 执行，A 只解读并登记发现）；V 规则枚举 R1-R13 → R1-R18；`verifier-spec` targetKind 4 值 → 5 值；删除 `--skip-tlc` 残留描述；maturity L0 与交付层 L0 同名澄清；模板脆锚修正；examples 份数；**矩阵外 6 份人格入册**（V 可按需指定、R 受 R11 限制不可选）并修正指向它们的换人指针。
- **run-log R8：经复核为规范措辞过度而非实现不足**——两条既有测试断言「无 R3 的 S→V→G→checkpoint」合法，且 R3 三维度齐全**已由 `check-role-dispatch` 阶段级无条件强制**，故按「改文档对齐实现」处置（R8 只校验首个 R3 落在 S 与 V 之间），未加码门禁。

### 人格库上游核查与 5 份人格补充（persona-upstream-audit，2026-09-17）

> 触发：核查人格来源仓库 [jnMetaCode/agency-agents-zh](https://github.com/jnMetaCode/agency-agents-zh) 是否有更新、是否有需要补充的人格。结论：**无内容级更新**；按 R/V 多角度价值补 5 份，人格库 **28 → 33**。

- **上游核查结论（实测）**：对导入基线（`550a29fa`，2026-07-24）后的上游逐份比对——吸收的 28 份中 **20 份与上游当前内容逐字一致**；8 份有差异，其中 2 份是**本仓本地增强**（`engineering-code-reviewer` 的 Fowler 12 坏味道基线、`engineering-technical-writer` 的占位符与外链本地化），另 6 份仅上游把 frontmatter `color` 改为十六进制值（`product-manager` 另加「（PM）」后缀与 `tools:` 字段）——**无正文级更新，均未跟随**（本仓不渲染颜色、无 tools 契约）。
- **新增 5 份人格（28 → 33，均按 §1.5 补四字段声明）**：
  - `engineering-security-engineer` —— 应用安全（威胁建模 / 漏洞评估 / 安全代码审查 / 安全架构 / 事件响应），补矩阵缺失的 **AppSec 视角**（既有 `engineering-threat-detection-engineer` 是 SIEM / MITRE ATT&CK 检测向）；
  - `engineering-sre` —— SLO / 错误预算 / 可观测性 / 混沌工程，补**可靠性视角**（原性能行只有数据库 + 基准 + 后端架构）；
  - `engineering-minimal-change-engineer` —— 最小可行差异、拒绝范围蔓延，用于**返工修复评审**（防「修 bug 变重构雪崩」）；
  - `engineering-codebase-onboarding-engineer` —— 只陈述基于代码的事实的追溯纪律，用于**上游回溯**；
  - `testing-accessibility-auditor` —— WCAG + 辅助技术实测、默认立场是找问题，用于**无障碍审核**。
- **接入矩阵**：R 第一键 `upstream-defect` 行 + 代码库入职引导；R 第二键「安全相关 Critical」+ 应用安全、「性能相关 Critical」+ SRE；V「系统设计评审」+ SRE、「代码评审」+ 应用安全、「测试评审」+ 无障碍审核；**新增 V 行**「返工修复评审（S-fix 产出）」= 最小变更 + code-reviewer + evidence-collector（3 候选）。`R_PERSONA_MATRIX` / `R_PERSONA_SIGNAL_MATRIX` 与 `agent-personas.md` §2 两张表同步（`rootcause-persona-matrix` 逐行对账，本轮实测 0 违规）。
- **来源与收录策略入册**：`agent-personas.md` 新增「人格库来源与收录策略」节（来源 URL / 导入基线 / 收录判据 / 收录规模 / 本地契约 / 已知偏离）——此前仓库内除导入提交信息外**无任何来源记录**，无法判断上游是否更新。
- **计数同步**：README / AGENTS / INSTALL / agent-personas 的人格数 28 → 33（README 的「N 个人格文件」是 `checkAssetCounts` 的解析点，改漏即 exit 1）。

### M 程序：外部技能采纳 P0–P6（expanded-external-skill-adoption，2026-09-14 ~ 2026-09-16）

> 采纳判据与逐项验收见 `docs/superpowers/specs/2026-09-14-expanded-external-skill-adoption-design.md` §13（AC-0…AC-12）；各期提交序列、评审轮次与收口实测记于 `docs/superpowers/plans/2026-09-14-external-absorption-adjudication.md`、`2026-09-14-p1-meta-theory-absorption.md`、`2026-09-14-p2a-gate-negative-coverage-and-atomicity.md`、`2026-09-15-p2b-rule-loadbearing-and-completeness.md`、`2026-09-15-m07-rtm-test-evidence.md`、`2026-09-15-p3-role-independence-and-review.md`、`2026-09-15-p4-test-quality-and-design-rules.md`、`2026-09-16-p5-debug-ops-interaction.md`、`2026-09-16-p6-rejection-knowledge-base.md` 的收尾节。**本节计数一律取收口实测**，不沿用各期文档写作时的中间值（43 / 44 / 332 / 340 / 344）。

- **P0 裁定录入（2026-09-14）**：50 个采纳项全部带裁定记录（44 项直接采纳 + 6 个决策点 D-1 至 D-6 由用户裁定），不存在「实现时再决定」的流程语义；两张 vendor 摘录入库，证据图 4 条 🟡 全部解除；D-1 的「不全量改写 48 条反模式主表述」由「未验证」升级为「有本地 A/B 证据支持」——对照臂未复现失败，按已采纳的 S04 属无可修缺陷。
- **P1 元理论层（M01 / S03 / S04 / S02 / S05 / M02 / S01 / M16 / M15，2026-09-14）**：新增 `references/asset-authoring.md`（资产编写杠杆、渐进披露数字阈值、指针约定、no-guidance control 的「授权不写」）；`SKILL.md` 的 description 收敛为只写 when、不概括工作流（仍是完整触发清单）；`hard-constraints.md` 落地「失败类型 → 指令形式」分流判据与 No nuance clauses / Exemption clauses don't scope（48 条主表述不改写）；单一权威文案纪律落到 `README.md` / `docs/INSTALL.md` / `AGENTS.md`，安装与快速开始命令只留一处权威、其余指向。
- **P2-A 门禁负向覆盖与失败原子性（M06 / S26 / S28 / S29，2026-09-14）**：`check-samples-coverage.ts` 新增「每个 exit-2 门禁都有会失败的负向案例」强制不变量（第四条规则：未登记 missing 与证据悬空均 exit 1）；测试层对每个 exit-2 门禁断言「负向路径失败后状态逐字节不变」；`samples/README.md` 矩阵增「所防回归」列；mock 须复刻真实契约的替身保真判据。
- **P2-B 规则负载性与完整性（S25 / S27 / S30 / S31 / S32，2026-09-15）**：新增规则级三态 fixture 协议（RED / GREEN / PRESSURE——移除该规则文本必须复现旧行为）；run-log 新增 R10 `revertEvidence`（回滚后必须变红，否则该修复无证据）；L0 载体定量预算断言；`check-docs-consistency` 增完整性审计双维度；**新增确定性 CLI `review-package.ts`**（评审包按固定顺序落单文件，同输入同字节可复现、不含时间戳）。
- **M07 RTM 测试证据（独立 Schema 批准单元，2026-09-15）**：经用户单独批准（裁定 D-2）后，`rtm.schema.json` 新增**可选** `testSummary.evidence`（`command` / `exitCode` / `observedAt` + 可选 `rawOutputPath` / `rawOutputSha256`）；`check-artifact-gate.ts` 经 `gate-logic.ts` 新增 E1–E4 四规则（配对 / SHA-256 核验 / 结果一致性含 RED 绑定 `failed>0 ⇒ exitCode≥1` / 存在性 + cutoff，早于 cutoff 吸收为非阻断 legacy）；RTM 实体、关系与覆盖率语义不变，schema 文件数不变。
- **P3 角色独立性与评审（S06 / S07 / S08 / S09 / S10 / S11 / S14 / S16 / M14，2026-09-15）**：禁止编排者在派单提示中预判 findings（不得写 "do not flag" / "at most Minor"）；「不信任报告」——作者 rationale 是 claim、不得据此降级 severity，plan 作者不自评自己的 plan，test output 的 warning 即 finding；面向 V finding 的误报质疑通道（回流新 V，禁编排者裁决）；scoped re-review（只审 fix delta 并逐 finding 判 ADDRESSED / NOT ADDRESSED，"Attempted is not addressed"，Minor 不进 loop）；CHECKPOINT Ruling 三要素（含「若错代价」）；模型档位 × 修复轮次 escalation 且必须显式指定模型；≥3 次修复失败的技术判据（暴露新共享状态且位置不同 / 要求大规模重构 / 别处产生新症状 ⇒ 架构错误）；Loop 4 retro 七类改进源。
- **P4 测试质量与设计规则（S21 / S19 / S20 / M03 / M09 / M10 / M11 / S12 / S18，2026-09-15）**：测试质量判据（change detector / string-presence trap / "Name the break" 前置门 / 期望值独立推导 / Mutation Check 五类变异 / Mock 三条硬规则）；设计压力与 seam 负向判据（两 adapter 才成真 seam、deletion test）与 ADR 入选三问门槛；expand-contract 兜底与票据 preflight 成对冲突扫描表；**票据内容门禁**在 `check-artifact-gate.ts --phase=5` 生效（占位符黑名单 + 可构建性判据），V 侧对应必答项。
- **P5 调试运维与交互（M05 / M17 / S13 / S24 / S22 / M13 / M04 / S17 / M18 / M12 / S15 / S23，2026-09-16）**：R 入场门（红信号四项验收 + 3–5 条排序可证伪假设 + 预测格式）；S 的 loop 构造方法清单与「提高复现率而非干净复现」；「无根因」合法出口（`check-rootcause-report.ts` 新增 `noRootCause` 条件分支——R1/R2/R3 判据逐字保留，是条件豁免而非删除）；条件等待三要素与三反模式；事件接驳前置核实（先核实主张再受理）；CHECKPOINT 提问与呈现规范（每题一想法 + 答案 stub、必给推荐答案、Push right、Brief 三段式）；`.w-model` 在 worktree 内的隔离五条纪律定稿；受控低仪式探索通道；阶段开工前三路径分诊与分类口播；clean baseline 强制与 `git worktree prune` 自愈。
- **P6 拒绝知识库（M08，2026-09-16）**：拒绝登记挂靠阶段 1 规格产物的**既有** §8（五列：`conceptKey` / 拒绝理由 / `Prior requests` / 状态 / 来源；一概念一行、`conceptKey` 归一化后唯一、仅 rejected enhancement 入册），零新增目录、零新增 `.w-model/*.json`；需求入口新增「按概念相似度去重」读取动作（surface → Confirm / Reconsider / Disagree 三选一 → 判定必须口播），**不新增 `/wm` 子命令、不改 ingest 既有确定性分流**；门禁（`gate-logic.ts` 的 `checkOutOfScopeRegister`）只校验**登记结构**——**「门禁通过」≠「去重已发生」**：概念相似度由入口的语义匹配承担，证据须引用 `GATE_JSON.reasons` 中 `structure: §8` 桶的计数，不得以整体退出码为据。
- **三处用户会注意到的语义变化（P5 / P6，如实披露）**：
  - **新增一个按需工具 CLI**：`check-pollution.ts`（污染源二分定位：逐文件跑、停在第一个污染源，确定性、不调用 LLM）。**不进 pre-push**、不接入任何阶段门，`prePushCount` 仍 **18**；`cli/*.ts` 44 → **46**（P2-B 的 `review-package.ts` 与 P5 的 `check-pollution.ts`）。
  - **新增提交前快层 `.githooks/pre-commit`**：staged-only 快层（staged prettier `--ignore-unknown` + 增量 `tsc`），慢层全量 suite 仍留 pre-push；**不引入 husky、不改 `package.json`**。按类别排除 `*.md` / `docs/changes/*` / `eval/*` / `samples/*` / `templates/*` / `docs/index.html`（被排除类别内 `.ts`/`.cjs` 计数为 0，故 hook 检查面 ⊇ pre-push 面，属收敛而非放松）。
  - **phase-1 结构门禁的数据要求收紧**：`docs/phase1-requirements/requirement-spec.md` 的 §8 须为合规五列表格（含 ≥1 数据行或哨兵行），否则阶段 1 结构校验报 `structure: §8 …` 违规（exit 1）。属**既有门禁的判据强化**——不新增命令、不新增放行路径、不改 `/wm` 命令的输入 / 输出 / 语义；未引入 legacy 时间豁免。
- **计数变化（2026-09-16 收口实测）**：exit-2 脚本 43 → **45**；`self-test` 332 → **352**；`cli/*.ts` 44 → **46**；`references/*.md` 42 → **43**；`schemas/*.schema.json` 仍 **34**（M07 为既有 schema 增可选字段）；`prePushCount` 仍 **18**；反模式仍 **48**（无 #49）；`audit:l0-links` exit 0（672 / 95 / 36，`violations: []`）；**版本保持 42.2.1，不 bump**。

### vitest 执行模型与推送前门禁确定性（vitest-project-split，2026-09-14）

> 这是**测试基础设施**变更：不影响 `/wm` 命令语义、不改任何门禁判据、pre-push 项数仍 **18**。现象、根因与排除过程记录在 `docs/changes/vitest-parallel-flakiness-finding.md` 与 `docs/troubleshooting.md` 1.7a 节。

- **先全局串行化（`b71c2fe1`）**：`npm run prepush` 第 12 项（vitest + coverage）偶发红，失败数为 1–2 条（极端时达 20 条）且**每次落在不同文件**，形态为 `expected null to be N`（子进程未真正运行）/ `STACK_TRACE_ERROR` / 30s 超时——同一命令同一代码两次运行失败数可差 10 倍，量级跳动排除「断言写错」；基线 `72081e2` 同样复现。`--maxWorkers=4` 与 `--testTimeout=120000` 实测均无效，唯一有效解是**子进程类文件互不重叠**，故设全局 `fileParallelism: false`。代价是墙钟翻倍（带 coverage 457s 抖动 → 1055s 绿），属接受成本。
- **再收敛为两个 project（`5d212e52`）**：`cli-serial`（30 个真实 spawn CLI 子进程的测试文件，`fileParallelism: false`）与 `unit-parallel`（其余纯逻辑文件，保持默认并行），取代全局串行。成员名单是单一常量 `SUBPROCESS_TEST_FILES`，两个 project 的 include / exclude 由它派生，两个视图不会漂移；新增 `vitest-project-split.test.ts` 按**源码证据双向**守护该清单（真实 spawn 未登记、无证据残留、文件不存在均红灯），并显式登记三类判定陷阱：`vi.mock('node:child_process')` 的替身文件、仅类型导入、注释与正则里的词，均**不算**真实 spawn、不登记。
- **配套校准**：`check-docs-consistency.ts` 的 `VITEST_SPAWN_TIMEOUT_MS` 600s → 1800s（串行后套件 975–1060s，旧上限会把健康仓库误杀成 `vitestTestCount: -1`）；`lib/run-sync.ts` 两条 runSync 行号锚随注释扩充 +2 行顺延（`run-sync.test.ts` 有行级断言）。
- **诚实边界**：全量墙钟几乎不变（974s vs 全串行 975s）——**子进程文件自身的执行时间占大头**；本变更的收益在**结构确定性**（并行集合与串行集合显式化并由守护测试锁定），真正的提速方向是降低子进程测试自身耗时，而非调整并发结构。实测结果：`npm run prepush` 首次获得确定性全绿（18 项、exit 0、1055s），含此前无法可靠通过的第 12 项与第 14 项。

### 门禁完整性与证据事实对账（gate-integrity-evidence-reconciliation，2026-09-12）

> 本 campaign 修的四个缺陷共享同一根因：**形态合规但事实不正确**。同义反复的测试可通过四级门；`newFindings: []` 可通过冰山校验；`passed` 在 R3 中从未被读取；捏造的 `evidenceAnchor` 路径可通过 R15 正则。通用修法是**分母来自上游产物，而非自我声明**。

- **A-1 verifier-spec R14-R17 悬空规范修正**：`:278` 原规定四问结论写入 `summary.collaborationReview` 对象，但 `verifier-output.schema.json` 声明 `summary` 为 string 且父对象 `additionalProperties:false`——**无任何输入可同时满足**（实测：对象 → `must be string`）。改为固定前缀文本（`交接：…｜计划坚持：…｜角色匹配：…｜增量价值：…`），零 schema 成本。
- **A-2 死引用修正（8 处）**：全仓 8 处引用 `SKILL.md「阶段门与质量门」`，该章节不存在（实际已拆为 `workflow.md` 的「阶段门评审」与 `quality-standards.md` 的「质量门检查清单」）。含反模式 #1 的安全关键路径。逐处改指真实承载章节。
- **A-3a R3 预防性审查判据接上**：`preventive-review-logic.ts` 原抄录 `passed`/`findingCount` 但从不纳入 `reasons`，三份 `{"findings":[],"passed":true}` 即通过。现 `passed=false` 产生 violation。
- **A-3b 冰山扫掠分母对账**：原 `expectedPassed = newFindings.length === 0`——**通过 ≡ 声明未发现任何东西**，且 `sweptArtifacts` 无 `minItems`。现分母由上游产物实测，graph/TLA/RTM **三视角平权**两两对账（无主分母、不归一化、不取并集放行），差异即刻失败（R6）；在场表为代码常量（D9）；缺席须显式声明（R7，禁止静默跳过）；零发现但覆盖不足为失败信号（R8）。
- **A-3c 证据锚点必填 + 常态扫描**：`evidenceAnchor` 由可选改**阶段 1-4 全节点必填**，新增 `evidenceStatus`（`confirmed`/`pending`）。阶段门放行前扫描 `pending` 即阻断（**常态触发，非返工触发**——pending 是「尚未验证」而非「产物有缺陷」，走 R 会把没做功课误判为产物有缺陷）。R15 拆为 **R15a/b/c/e** 独立定位（缺失/状态/存在性/签名链环）。**不新增第三色**：invalid 由既有 `coverageStatus` + 返工链承载。
- **A-3d 评审偏移检测**：标准偏移（同一产物跨轮次 `qualityLevel` 差 ≥2 档 → **人裁定，不走 R**——评审者自身不一致，R 无法自查评审标准）、校准偏移（`rawScores` 非全等但方差坍缩 → 分辨力不足；与既有「全等检测」区分，不重复报）。
- **A-3e 证据路径存在性**：原只校验格式，`src/nonexistent.ts:L999=捏造` 可通过。现验存在性 + 与签名链对账。**仍不验语义支持**（需判断，属 V 评审）。
- **A-3f 校准集（非门禁）**：新增 `samples/verifier-calibration/`，人工标注正解，**明确声明非门禁**（标注与 LLM 执行均非确定性）。
- 124 个 graph 节点 / 31 个 fixture 迁移至必填字段；`exemption` 新增第 6 类 `evidence-anchor-pending`（复用 E1-E9 四阶段审批）。
- **两处设计中发现的真问题**（均由"实测而非直觉"捕获）：① 计划的 `RESOLUTION_FLOOR = 1e-4` 会误报 **122/137（89%）** 的合法样本（真实合法方差下限约 `6.67e-5`），定稿 `1e-6`（仅命中刻意负样本）；② `ICEBERG_VIEW_PRESENCE` 原把 `graph` 排除在阶段 5-8 之外，但阶段 2-8 **全部**消费 `graph.json`（D8 SD Coverage），遗漏构成真实盲区——同一产物集在阶段 4 可测出的 graph↔rtm 差异，在阶段 5 会因 graph 视角不派生而被静默吞掉。已修正并补两条回归测试锁定。
- **R15d 已决议不实现**：codegraph `--scope` 覆盖语义限定阶段 5-8，图谱节点只在阶段 1-4，定义域不相交。编号空缺为已决议项，非遗漏。
- **顺带闭合 7 处活体文档漂移**（campaign 审计发现，逐处按**实测值**订正，非估算）：① self-test 计数 6 份活体文档共 11 处写 322 / 262，实测 **332**（历史 CHANGELOG 与既往往验收记录保留其当时数值，属审计轨迹不改）；② `user-guide.md` 反模式计数 47 → **48**（`hard-constraints.md:235` 存在 #48）；③ `subagent-delegation.md` 称 `references/` 有 "59 份 .md（39 非 stub + 19 重定向 stub）"，实测 **42 份且无任何 stub**（42.0.0 合并就地完成，从未留下重定向文件）——"19 个 stub"为编造，已改按实测组成表述并说明表格行按**主题**而非文件计数；④ `quality-standards.md` 三处模板计数 13 / 12，权威为 `templates/README.md` 的 **4 个阶段主模板 + 10 种独立子模板**；⑤ `__tests__/README.md` 矩阵漏登 **21 个**测试文件（80 个中仅 59 有行，整套 code-health / platform-deps / wm-write 缺失），已按各文件自身注释补齐并验证无遗漏无幻影——`check-docs-consistency` 只统计目录数、从不与此矩阵交叉核对，故长期无人发现；⑥ `command-reference.md` 引 "SSoT §1338"（不存在）→ **§10.5.2**；⑦ `bdd.md` 头标注字段数 9 → **10**（§2.2 实定义 10）。**核实为非缺陷**：AGENTS.md 的 "43 个 exit-2 脚本" 正确（门禁 `exit2ScriptCount`=43、`cliScriptCount`=44，系两个不同口径），§8 导航表 44 行与 44 个 CLI 脚本精确一致。
- **本轮验证**：pre-push 18 项全绿；self-test 332/332；Vitest 1904 用例；coverage 76.75/71.92/87.69/78.8（阈值 75/65/85/75）；eval 60/60；docs-consistency 静态/动态违规 0。**破坏性验证十项逐项实测**（记录见 `docs/changes/gate-integrity-destructive-verification.md`），其中 2 项曾以无关红灯充数，已如实标注为无效控制并改用有效证据。阈值定稿依据见 `docs/changes/gate-integrity-threshold-calibration.md`。**已知非本 campaign 缺陷**：并行执行下子进程类测试偶发失败（基线 `72081e2` 同样复现，串行 + coverage 可确定性 1904/1904 全绿），记录见 `docs/changes/vitest-parallel-flakiness-finding.md`。版本保持 42.2.1，不 bump。

### 修复（42.2.0 后静态审计整改）

- **模板链接与门禁一致性**：修正 `templates/requirement-spec.md` 的 6 条子模板路径，并将模板漂移门禁及回归 fixture 同步到 `requirement-spec/` 子目录；聚焦 Vitest 52/52、全量 Vitest 1247/1247。
- **编排闭环与示例契约**：SKILL 恢复 `R3×3 → G(check-preventive-review) → V → G` 顺序和完整普通返工链；examples 总览、阶段 1、阶段 5 编码及阶段 6-8 测试执行示例补齐角色隔离、CHECKPOINT、codegraph/OpenSpec、BDD 必填参数、当前 GRAPH_JSON 字段、真实 `result=pass|fail` 回填及阶段 7 `--phase=7`。
- **L0/L1 与历史证据边界**：保留并明确分类 92 条 L1-only 脚本链接，quickstart 将 npm/doctor 验证限定为 L1，技术写作者模板改为消费项目贡献指南占位；41.9.0 real-run evidence 按历史快照锁定，`272/234/15` 不与 42.2.0 的 `282/244/15` 作趋势比较。
- **独立审查第 1 轮闭合**：补齐此前遗漏的 stage 5-8 独立示例、phase references、BDD 指南、workflow、DoD、分派模板和测试模板。普通 V/G 失败统一为 RootCauseReport 的 V 复审、G 根因门禁、S-fix 后 R3×3/预防审查/V/G/用户 CHECKPOINT；所有可复制 `/wm test` 含真实 `result`，所有项目阶段 BDD 调用按 phase 强制 TLA/graph/Cucumber 参数，stage 6/7 BDD_JSON 采用当前摘要形状。新增严格 L0/L1 审计与 8 条 TDD 回归，仅现存 `scripts/samples/tools` 可归 L1-only，其他断链/越界 fail-closed；当前测量为 645 条、L1-only 92、模板占位 36、意外断链 0。
- **独立审查第 2 轮闭合**：phase 5-8 references 的 `/wm test` 入口统一要求真实 `result=<pass|fail>`，诊断表降级为 R 定位线索，实际返工和跨阶段动作只能经 RootCauseReport 的 V 复审、G 根因门禁、S-fix 后 R3/preventive/V/G/用户 CHECKPOINT。旧需求/设计交互示例补普通失败分支。L0/L1 审计对缺失必需 L0 目录/`SKILL.md` 和包外 L0/L1 symlink fail-closed，新增相应 TDD 回归。
- **独立审查第 3/4 轮闭合**：phase 5 的票据化例外不再允许直接 `R→S-fix`，且新增全量 references/examples/templates 文件扫描契约，单一 bug/TLA+ 不变式违反仍走完整普通失败链；L0 审计对顶层及嵌套 L0 目录 symlink/junction、缺失必需 L0 资产和包外 L0/L1 真实路径 fail-closed。新增公开 `npm run audit:l0-links [-- --root=<skill-root>]` 入口，输出结构化 `L0_LINK_AUDIT_JSON` 与真实 exit 0/1/2，不改变 prepush 17 项或 cli 脚本计数。
- 历史/中间验证：初版分层链接检查为 641 条（后续文档链接新增导致当前严格审计为 647 条），L0 CLI 当前审计 `647/92/36/0`（历史测量；后经 workflow.md 新增 2 条合法引用链接更新为 649/92/36/0，见下——字段口径 relativeLinkCount/l1OnlyCount/templatePlaceholderCount/violations），eval 25/25，self-test 262/262，samples coverage 282 fixtures / 244 referenced files / 15 dirs，docs-consistency 静态/动态违规 0，doctor exit 0（0 阻断 / 3 可选提示）。版本同步后 Git Bash `bash -c "npm run prepush"` 真实 exit 0，17 项全绿；独立审查第 1 轮完整 Vitest 为 61 files / 1265 tests / 1265 passed，第 2 轮为 61 files / 1271 tests / 1271 passed，第 3 轮为 62 files / 1277 tests / 1277 passed，第 4 轮为 62 files / 1279 tests / 1279 passed；这些是历史/中间测量，不冒充当前最终 HEAD。
- **独立审查第 5 轮最终修复**：完整 phase references、templates、legacy examples 的普通失败指引均要求 `V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT`；`/wm test` 只接受真实 `result=pass|fail` 占位或运行器实际值 `result=pass`/`result=fail`，非法占位有边界断言。L0 审计以 lstat/realpath fail-closed 拒绝 L0/L1 文件与目录 symlink/junction、包外路径、未允许 broken link 和 malformed percent-encoding，并对未被引用的 L1 链接做不跟随目录扫描；CLI 默认 root、显式 `--root`、exit 0/1/2 和注册表均有契约测试。历史/中间 L0 CLI 测量为 `647/92/36/0`；版本保持 42.2.1。
- **第 5 轮后续收尾**：以 TDD 补齐 Windows drive-letter 正斜杠与反斜杠路径回归；显式识别 `C:/...` 与 `C:\\...`，不依赖 POSIX 上的 `path.isAbsolute`，两类路径均结构化 violation/exit 1。正常 `https:`、`mailto:` 与 fragment URI 继续位于相对链接审计范围之外，畸形 URI 保持 fail-closed。删除 `phase-5-coding.md:262` 尾随 ASCII 空格，并同步验收记录的第 1～5 轮范围与父链提交主题。后续定向测试为 4 files / 68 tests，完整 Vitest 为 62 files / 1303 tests / 1303 passed，串行 docs-consistency 为静态/动态违规 0、provenance 1303/1303；最终 Git Bash prepush 与最终 HEAD 由外部命令核验。

- **最终契约收口**：递归扫描全部 `references/**/*.md`、`templates/**/*.md`、`examples/**/*.md` 的普通失败动作，明确禁止语境与 phase 1 ingestion A-chunk/A-cross→G 专用收敛例外；普通失败均要求完整 `V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT` 链，`/wm test` 值按边界断言。补充 L0 根目录 symlink/junction 与 CLI stderr `ERROR_JSON` 回归；README、toolbox、command-reference、subagent registry、dependency-boundaries/security 契约保持登记，版本 42.2.1 与 fast-uri 3.1.7 保持不变。
- **本轮定向验证**：4 files / 70 tests / exit 0（examples-contract 20/20、L0 logic 29/29、CLI 11/11、dependency-boundaries 10/10）；完整 Vitest 62/1307、串行 docs-consistency 重跑 0（1307/1307）、eval/self-test/doctor/samples/security/typecheck/npm audit 均已实测通过；Git Bash prepush 首次在第 13 项因 registry `ENOTFOUND` / audit endpoint 不可达 exit 1，格式化修复后及最终证据同步后均真实 exit 0、17 项全绿；网络失败作为瞬时 concern 留档，未冒充代码通过。
- **Task 8 最终修复轮（2026-09-03）**：`examples-contract.test.ts` 递归覆盖全部 `references/**/*.md`、`templates/**/*.md`、`examples/**/*.md` 的普通失败动作与多行 `/wm test` 命令；普通失败统一走 `V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT`，phase 1 ingestion 保持 A-chunk/A-cross→G 专用收敛。L0 审计既有 fail-closed 边界补内部非 Markdown 目录 symlink/junction 回归；版本 42.2.1、fast-uri 3.1.7、pre-push 17 项和 CLI 37 项统计均保持不变。
- **最终修复轮验证**：examples-contract 23/23、L0 logic 30/30、L0 CLI 11/11、全量 Vitest 62 files / 1311 tests / 1311 passed；L0 CLI 默认/显式 root 均为 `647/92/36/0`，eval 25/25，self-test 262/262，doctor 0 阻断/3 提示，samples 282/244/15，security 新增 0，typecheck、npm audit high、docs-consistency 均 exit 0。Git Bash `bash -c "npm run prepush"`：证据提交后首次因格式检查发现 1 个文件 exit 1；按 prepush 配置格式化后，在最终记录提交后真实 exit 0、17 项全绿。
- **扫描器收口修复轮（2026-09-03）**：`examples-contract.test.ts` 扫描器改为保留作用域的分析单元——表格行按整行分析（失败信号在「质量门未通过」单元、旁路动作在「回阶段 5 编码返工」单元时不再漏报），普通行按句/单元分析，fenced 代码块跳过；同一单元出现「完整普通失败链」字样或完整箭头链即视为满足，合法 R-first 描述（先分派 R → V 复审 → 才可分派 S-fix）与禁令复述不误报，C/D 仅在路由到动作时构成失败上下文，phase 1 ingestion A-chunk/A-cross→G 专用收敛例外保留。红灯实测定位 6 处真旁路后逐文件闭合：`bdd.md` §4.1 两条独立门禁回退（BDD/TLA+ 门禁失败先走完整普通失败链，S-fix 修复范围限于对应子流程资产、对侧不受影响）、`command-reference.md` `/wm review` 失败动作行（qualityLevel C/D 视为 V/G 失败 → 完整链，`reworkHints` 仅交 R 作定位线索）与 BDD 项目证据门 exit 1 行（扫掠发现同类旁路：先走完整链再按 R 结论由 S-fix 修复/补齐工件）、`hard-constraints.md` 门禁脚本退出码精确对应表 exit-1 两行（改为先走完整普通失败链再按 R 结论返工）。版本保持 42.2.1。

### 审查问题修复（gate-closure，2026-09-04，doc sync）

任务 1/3/4 引入的代码契约在本轮同步进 SSoT、references、活体文档、测试矩阵与验收记录（实现文件为事实源，文档编辑未改任何 `.ts` 校验逻辑；父链现已连续覆盖至合并前 tip 的父提交，完整身份见下表父链追加行——`689e51bd114831a209af92c99e82afea2e97f512` 起至 `7b52d4cd2559abac09abc1c3bb7a04619037ad29`，逐 commit、40 字符完整 SHA、按时间顺序；本追加提交自身按规则不入链）：

- **ChangeScope + codegraph/opsx/archive strict 绑定**：SSoT §3.3.1 补 ChangeScope 段落（`change-scope.schema.json` / `codegraph-query.schema.json`、headRef=当前 HEAD、changedFiles 与实际 Git 变更集合精确一致、缺 scope exit 1 fail-closed）；SSoT §10.5 新增 §10.5.2（阶段 5-8 门禁顺序 codegraph/opsx strict → artifact gate 聚合 → opsx:archive → archive checker 后置门 → CHECKPOINT；GATE_JSON external summary；`scopeProvidedButFailed` 抑制误导文案；gate-logic externalChecks 透传已删除）；phase-5-coding「codegraph 修改前影响分析」节与 phase-6/7/8、hard-constraints #14/#38、command-reference「阶段 5-8 codegraph/opsx/archive 门禁 CLI」节、subagent-delegation G 模板与阶段 8 终检命令同步 `--scope=` 调用与 fail-closed 语义；examples（coding/stage5/stage8/test-execution/README）与 templates/coding.md 的阶段 5-8 门禁命令补齐 `--scope=.w-model/change-scope.json`。
- **artifact gate 聚合与 R3/run-log 语义**：SSoT 新增 §10D.8（R3 三种证明路径矩阵：standard 阶段级 role-dispatch+preventive-review / fix-emergency run-log identity window+preventive-review / opsx stage 9 份 R3+3 份 V；role-dispatch 空/全 invalid fail-closed、R3 只计 role=R+success 的 r3-* 三维度各 ≥1、r3Missing 明细、`--r3-enabled` no-op）；SSoT §10D.3 补 variant/blocker/fixedLocation/fixBasedOn 字段与坏行语义；data-models RunLogEntry 接口与动作字段表、subagent-delegation 检测脚本措辞（fix variant 可选向后兼容、emergency-fix 强制 variant+blocker、双 legacy 行经合并 legacy 谓词吸收为 LEGACY_VARIANT/LEGACY_UNSCOPED 非阻断）、hard-constraints #34 处置行、preventive-review `passed=false ⇒ findings ≥1` 同步至 schema 清单行与 #11 节。
- **pre-push 真实 push stdin 行为**：SSoT §8.2.4、README CI 策略、AGENTS 目录表、INSTALL §3.1、CONTRIBUTING 钩子节、troubleshooting 新增 1.7b 同步四字段 ref 行解析 / 多 ref 聚合 / 新分支 fork-point/merge-base 可证明基线 / delete-only 放行 / 空 stdin 回退 HEAD@{push} / 解析失败与基线不可建一律 fail-closed 全门禁；`docs/*.md` case 跨目录匹配按实测行为表述。
- **活体文档修正**：troubleshooting 1.7 重写为 docs-consistency 现逻辑（vitest 文件数/用例数是受控动态 facts + provenance 绑定实际提交，不再要求复制到 README/AGENTS/pre-push 文本）；CONTRIBUTING/user-guide/pre-push 注释的 self-test 样本数 260→262（实测 `npm run self-test` = 262/262）；新增测试文件登记进 `__tests__/README.md` 矩阵（artifact-gate-external / change-scope / check-codegraph-queries / check-openspec-archive / check-opsx-artifacts），docs-consistency/role-dispatch/run-log/schema-validation 行描述同步新契约；`l0-link-audit-logic.test.ts` 实包审计链接数 647→649（workflow.md 新增 2 条指向 command-reference/subagent-delegation 的引用链接，violations 仍为 0）。
- **本同步的完整普通失败链锚点**：`V/G 失败 → R → V 复审 RootCauseReport → G(check-rootcause-report exit 0) → S-fix → R3×3 → G(check-preventive-review exit 0) → V → G → CHECKPOINT` 在 8 份 phase references、5 份模板、全部 examples 与相关 references 中逐字保留（grep 核对无删除/改写），examples-contract 28/28 通过。
- 版本保持 42.2.1，不 bump；pre-push 17 项、CLI 37 项、schema 25 份统计口径不变。门禁实测与父链追加见下表及验收记录 `docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md`。

### 审查 26 条处置索引（review-fixes，2026-09-03）

2026-09-03 对 `origin/main`（93f6f3a）→ `f0add11` 的 129 提交完成四独立只读审查，共 26 条发现（4 Important + 22 Minor），逐条处置、全部可追溯：4 Important 与 21 Minor 已修复；B7（`docs-consistency-logic.test.ts:2877-2931` 文本级契约测试脆性）裁定 wontfix——in-file 注释已声明为刻意防线（防 hook 语义漂移），保留现状、不归为缺陷。详细设计与逐条处置见规格 `docs/superpowers/specs/2026-09-03-review-fixes-design.md`；版本保持 42.2.1，不 bump。

### 留档项 13 项处置索引（archival-fixes，2026-09-04）

2026-09-04 对 42.2.1 域 13 条留档项（最终独立审查 2 条 parked Minor P1/P2 + 账本 11 条延后 Minor D1-D11）逐条处置、全部可追溯：P1/P2 与 D1-D10 已修复；D11（台账收尾）即本段——父链追加行覆盖 `548e43a3553fc1109349e461458a288d0e48e383`..`09b47e428f3c5ee759d05bd0e8da35c4f9b959d8` 全部 first-parent 提交（4 行，含战役前规格与计划提交）、前注与范围句刷新至合并前 tip 的父提交，本追加提交自身按规则不入链。详细设计与逐条处置见规格 `docs/superpowers/specs/2026-09-04-archival-fixes-design.md`；版本保持 42.2.1，不 bump。

### 留档项 4 项处置索引（archival-fixes-2，2026-09-04）

2026-09-04 对 archival-fixes 最终审查留档的 4 条 Minor（A `ResolvedCliScope` violations 变体 `attemptedChangeId` 必填化 + 薄封装透传断言、B 归档日期前缀注释 0-99 精度、C 上节散文句如实覆盖表述、D L0 内联链接正则注释精度）逐条处置、全部可追溯：4 条全部修复；台账收尾即本段——父链追加行覆盖 `c3636a3b70901f706d15f83bf5daba27ca64fa6a`..`7b52d4cd2559abac09abc1c3bb7a04619037ad29` 全部 first-parent 提交（4 行，含上一战役台账收尾提交与战役前计划提交），上文「审查问题修复（gate-closure）」与验收记录两处范围句终点顺延至 `7b52d4cd2559abac09abc1c3bb7a04619037ad29`，本追加提交自身按规则不入链。处置计划见 `docs/superpowers/plans/2026-09-04-archival-fixes-2.md`；版本保持 42.2.1，不 bump。

### 审查 27 条处置索引（review2-fixes，2026-09-05）

2026-09-05 对本战役独立审查的 27 条发现（2 Important + 25 Minor）逐条处置、全部可追溯：27 条全部修复，零豁免延续。其中 8 项为脚本/钩子行为变更，A1-A5 与 H3 为收紧，H2/H4 在 registry/advisories 上下文锚定与 npm 7 形态前提下扩大瞬态 skip 豁免、对齐既有 ENOAUDIT/registry 不支持 audit endpoint 的瞬态 skip 策略（A1-A3：l0 内联链接先 title 切分再剥尖括号、reference 定义补冒号后无空白与目标换行两形态且单字母 scheme 不再按 URI 放行、`.githooks/` 前缀判 code；A4：parse-args 重复 flag → `ARG_INVALID`/exit 2；A5：LEGACY_VARIANT 吸收加 `2026-09-01T00:00:00Z` 截止；H2：404 Not Found GET registry/advisories 上下文新增 skip；H3：状态词分支补 network/registry/request 同行上下文锚定；H4：npm 7 `npm warn audit network` 形态新增 skip），其中裸 E404（基线即如此）与裸状态词维持阻断，blocking 优先不变量有 18 行表驱动测试钉死。失败链锚点化（D2）：references/templates/SKILL.md 全句内联由 194 处（193 行）收敛为短名引用「普通 V/G 失败链」，全句仅存 2 处权威落点（hard-constraints.md 新增「普通 V/G 失败链（标准返工链）」节 + conventions.md 术语表新增词条），examples/ 教学示例保留全句，examples-contract 扫描器同步接受锚点短名（27/27 通过）。措辞与流程收尾：D1 三处 graph 缺失归因改为「phase>=2 缺 --graph 为 ARG_INVALID/exit 2（进入 D1-D8 前即拒绝；graph 为 D8 的数据源）」、D3 phase-1 豁免 reject 场景改朴素表述、D4 自然退出契约测试句归位生产 CLI 段、P2 acceptance 轮次子表加父链子集注记。l0 基线 relativeLinkCount 649→650（conventions 词条新增 1 条相对链接，violations 仍 0）。I1/I2 两项 Important（templates 6 处 phase 5-8 `check-artifact-gate.ts` 调用补 `--scope`、SSoT L0/L1 链接边界权威节 + INSTALL 同步）随任务 1 先行落地。规格见 `docs/superpowers/specs/2026-09-05-review2-fixes-design.md`、实施计划见 `docs/superpowers/plans/2026-09-05-review2-fixes.md`；版本保持 42.2.1，不 bump。父链追加行覆盖 `11944cd6130b6f3faa1df497fabae3cea6c8385f` 起至 `a5e2c2723a42eb4e17c5ddc7d10cf1453b2b8f6f` 共 13 行（含上一战役三个台账收口提交与本战役全部 10 个提交，逐 commit、40 字符完整 SHA、按时间顺序），本台账收口提交自身按规则不入链。

### 核查发现处置索引（audit-fixes，2026-09-06）

2026-09-06 对独立核查战役（8 域 × 4 子代理共 32 份报告 + 4 份复核裁定，权威去重目录 0C / 6I / 49M + 64 说明级 + 1 已裁定不改）的全部发现逐条处置、全部可追溯：6 Important 与 49 Moderate 已修复、零 defer——其中 F-G4-03（run-log gateLogPath 条件 required，T1-T8 步骤清单均未覆盖的规划遗漏）于 2026-09-07 经定向补修提交 `333a7f3d669a9d599e0cfb68c3264a1a5c176faa` 实现为描述对齐（不加条件 required：262 基线 gate 行均无该字段，条件强制会翻转基线）；64 条说明级中 13 条随任务修复（S2/S3/S4/S18/S19/S20/S22/S25/S46/S49/S56/S57/S64）、51 条 defer；F-G6-03（change-scope 越界 exit 2）维持「已裁定不改」。定向补修的资产变更为 `schemas/run-log.schema.json` 的 `gateLogPath` description 对齐可选审计语义（schema 不做条件强制、省略不阻断校验；填写后受 R6 gateExitCode 回填与 gate-log 交叉校验约束），纯描述变更、不改运行时逻辑、262 基线不变。行为变更按域收口：T1 术语收口——语料 48 处/24 文件归一规范短名「普通 V/G 失败链（hard-constraints.md「普通 V/G 失败链」节 / 表格式（hard-constraints））」两式、`_Avoid_` 增补全族变体、examples-contract 扫描器 `hasChainMarker` 删非规范名分支并增 `CHAIN_MARKER_MENTION` 提及守卫（闭合否定式/提及式旁路）、l0 引用定义 target 换行排除与平衡括号 bare destination 归一（基线 650/92/36 零漂移）；T2 requirement-coverage——空 crossCuts 且未提供 `--graph` → blocking `C7b`（fail-closed），非空无 graph → 非阻断 diagnostic + `skippedRules:['C7']`；T3 CLI 参数统一——8 入口重复值 flag → `ARG_INVALID`/exit 2、parse-phase 统一空格/等号两形态且重复即错、state-machine/tla-model 顶层非对象输入 → `STRUCTURE_INVALID`/exit 2、阶段 5-8 checker「未提供 --scope」消息补等号形态提示；T4 run-log——`review`/`iceberg-review` 行 `passed=false` 强制非空 `reworkHints`（schema allOf + logic 规则），以 `LEGACY_VARIANT_CUTOFF`（2026-09-01T00:00:00Z）为吸收/阻断分界；T5 门禁口径——role-dispatch 坏行并入 blocking exit 1（与 run-log 同一 fixture 同 exit）、iceberg newFindings 内部重复 findingId → blocking、budget/maturity 无 `--project` 补非阻断 `warnings`、schema 前置下不可达死分支删除、scopeCreatedAt 严格校验（拒小写 t/z）、codegraph-query targetFiles 排除 `.` 段、docs-only 变更不再被 codegraph/opsx strict 阻断、artifact gate `--json` 补 external summary；T6 文档契约与计数——project.json 三处读取统一 `loadAndValidate` fail-closed（exit 2）、3 份 schema description 补全并新增属性级全覆盖静态检查、rtm `$defs`→`definitions`、pre-push 17 项强校验（解析连续 #1..#17 编号块）、samples 门禁双向化（`reference-dangling` exit 1 + 矩阵行精确声明）、conventions/subagent-delegation/AGENTS/troubleshooting 计数与措辞修正；T7 pre-push 健壮性——audit blocking 语料补 `vulnerable`（闭合漏报向 skip）、GNU `\b` 改 POSIX 等价边界（macOS BSD grep 兼容）、path-filter 与 `core.quotePath=false` 契约以源级断言钉死（76→87 用例）；T8 测试质量——wm-write 并发用例受控交错去 flake、run-sync 墙钟改相对窗口断言、examples-contract 全句/短名链常量分离加互斥守卫、self-test 头部分项补印 DesignContract（分项合计 257→262 闭合）。任务 9 收口：`check-docs-consistency.ts` vitest 自采集 spawn 超时 300s 提为命名常量 `VITEST_SPAWN_TIMEOUT_MS = 600_000`（随套件规模 1600 用例的基建调整，fail-closed 语义不变，`WM_VITEST_COUNT_FILE` 快路径不受影响，direct-call manifest 行号同步）；`npm run lint:security` 13 条基线漂移逐条 triage（2 个 T6 新增测试文件按同批先例加 file-level disable、2 处生产误报加 inline disable 注明理由，baseline 重生成 295→289 指纹）。规格见 `docs/superpowers/specs/2026-09-06-audit-fixes-design.md`、发现目录（处置列已全量回填）见 `docs/superpowers/specs/2026-09-06-audit-fixes-findings-catalog.md`、实施计划见 `docs/superpowers/plans/2026-09-06-audit-fixes.md`；验证记录与父链见 `docs/changes/2026-09-01-42.2.1-audit-remediation-acceptance.md`「核查发现修复（audit-fixes）验证记录（2026-09-06）」节。版本保持 42.2.1，不 bump。验收记录父链表追加 `98bfda09cb9daaac0ea0f1f1a651b946556f514c` 起至 `e3bb923bd0633e77c437f6a9e77fc2c3debd53c6` 共 12 行（含上一战役两个未链收口提交与本战役全部 10 个提交，逐 commit、40 字符完整 SHA、按时间顺序），本台账收口提交自身按规则不入链。

### 触发边界可度量性 campaign（trigger-boundary-campaign，2026-09-07）

- **触发边界可度量性 campaign**：eval 语料库 25→60 条（负向 22/歧义 8/正向 12，L1N 负向层 + notContains 守卫 + coverageMatrix 五项校验）；新增 `references/activation-guide.md`（第 41 份，13 类反例登记册，与语料双向锚定）；SKILL.md 触发面增反例信号（frontmatter 一句 + 不启用行十类速览）；INSTALL.md 增「子能力单独复用」L0 分级指南；SSoT 新增 §3.6 权威定义。
- 规格见 `docs/superpowers/specs/2026-09-07-trigger-boundary-campaign-design.md`、实施计划见 `docs/superpowers/plans/2026-09-07-trigger-boundary-campaign.md`。
- 版本保持 42.2.1，不 bump。

### 触发边界快追（trigger-boundary-fastfollow，2026-09-07）

- **eval 纳入 pre-push 第 18 项门禁**：路径过滤纳入 `eval/**`（此前 eval/ 变更不触发本地 CI），`EXPECTED.prePushCount` 17→18，编号块/声明文本/CONTRIBUTING 门禁表/README/AGENTS/PR 模板计数全量同步。
- **常驻面速览成员资格钉死**：10 条 `scopeAnchor:"不启用"` contains 断言将十类反例名钉在 SKILL.md「不启用」行——速览删名/改名即 eval 红。
- **selfCheckMatrix 负例扩展**：coverageMatrix 校验①③④⑤各增已知假 fixture（route 失配 / 类别下限 / guide 计数 / 缺守卫），自检从单一 routeTotals 负例扩到五项全覆盖。
- **术语统一**：L1（正向 enable 与歧义 ask）/ L1N（skip 反例）/ L2（机制存在性）口径在 runner 头注释、mappings description、eval/README 三处归一，evidence 明确为字段而非层；eval/README「共 42 条」消歧（category 30 / route 42）。
- 实施计划见 `docs/superpowers/plans/2026-09-07-trigger-boundary-fastfollow.md`（本快追无独立规格文件，计划即需求；最终审查发现来源：主 campaign 宽范围审查）。
- 版本保持 42.2.1，不 bump。

### 代码健康治理（code-health-governance，2026-09-11）

- **新增 `/wm code-health` Phase 1–4 受控治理**：只读发现（P1 静态 inventory + 真实动态 trace + false-positive guard）→ 七维度 gap matrix（P2）→ 受保护测试 inventory（P3，`--guard` 唯一删除路径）→ 重复簇与 abstraction guard（P4）；新增 6 个 CLI（`code-health-phase1` / `code-health-gap` / `code-health-tests` / `code-health-duplicates` / `code-health-ledger` / `code-health-apply`）、纯逻辑与注入边界、9 份 code-health schema、`lib/code-health-tdd-harness.ts` 与 tracked `.code-health-governance.json`。授权链为「人类 approval + HEAD-tracked ledger/evidence/revision 绑定 + 可回滚」；默认拒绝、coverage 仅信号、发现不是结论；`blocked` 走 `gate-failure → R(root-cause) → V(root-cause-review) → G(root-cause-gate) → S(rework)` 失败链。**Phase 5–8 迁移**在此时点未实现，不得文档化为可用（campaign 归档随后由 Task 8 实现，见下）。
- **活体文档同步（SSoT-first）**：SSoT 新增 §10K（权威定义）；新增 `references/code-health-governance.md`（第 42 份 references）；SKILL.md 增 `/wm code-health` 路由 / O-A-S-V-G-R-human 权限 / CHECKPOINT / 按需 reference；command-reference / subagent-delegation（dispatch-matrix 登记 6 个新 CLI）/ hard-constraints / rtm-guide / coding-quality / quality-standards / operation-behaviors / data-models / AGENTS / README / CONTRIBUTING / INSTALL / troubleshooting 同步；版本保持 42.2.1，不 bump。
- **计数收口（实测，Task 8 后为最终值）**：cli `.ts` 44、exit-2 脚本 43、references 42、schema 34、self-test 322；docs-consistency 违规 0；pre-push 18 项不变（code-health 不纳入 hook）。
- 本轮无 `.codegraph/` 索引：未接入 codegraph，也未伪造查询记录。

### 代码健康治理 Task 8B（R11 加固 + flake 稳定化 + archive 文档回填，2026-09-11）

- **campaign 归档落地（Task 8A 实现，本任务回填活体文档）**：`code-health-archive.ts` 真实 producer/consumer/verifier；verified 候选（V/G 复审 + G 门禁 + observed passing 命令证据 + 可执行 rollback + clean redaction + revision 匹配）才 `archivedAsPassed=true`，`deferred`/`rejected`/`blocked`/`rolled-back` 只作终态非成功证据；工件经共享 FileVerifier 重验并按真实内容哈希复制，package 原子写入且不覆盖非空 package。`--verify` 不带 `--source-project` 只能 package-only，**不得**表述为 verified source；显式传 `--source-project` 才做 source-bound 重验。活体文档（AGENTS / CHANGELOG / troubleshooting / SSoT §10K / code-health-governance.md / command-reference.md）由「归档未实现」改为上述真实行为。
- **flake 稳定化（R11.7/R8，保留 fail-closed 不变量）**：`code-health-task1-integration.test.ts` 与 `dependency-boundaries.test.ts` 的共享根竞态改为按紧密路径谓词排除兄弟测试瞬态（`.d2-boundary-fixture-<pid>.ts`、`.tmp-code-health-test-output`），**tracked 文件被改动仍由 `git diff --name-only` 断言捕获**（新增双向单测证明）；`evidence-export-logic` / `evidence-provenance-logic` / `l0-link-audit-cli` / `code-health-cli`（30 s→120 s）/ `docs-consistency-logic` 的负载敏感 spawn 超时改为显式 60–120 s，`state-write-logic` 三个 gated-writer 等待用例 5 s→30 s。**未删除/跳过/弱化任何断言**。
- **R11 加固**：Phase 3 apply 增加目录 scope 单元断言与符号链接父目录 canonical containment（修复真实的「根外字节被读入受控 patch」读不对称，现 `SECURITY_BLOCKED`）；`code-health-ledger --help` 可发现用法面；consumer validator 拒绝 `candidateTests.includes(implementationArtifact)`；删除已无消费者的 `logic/code-health-phase-boundaries.ts`；Phase 4 tracked-blob 比较归一化 CRLF/LF（`core.autocrlf` 检出不再误拒）、畸形 `excluded:` 事实 default-deny、`structuralViewSupport` 值侧闭集校验；Phase 1 usage 说明 `changedFiles` 仅覆盖 analyzed targets；`code-health-deletion-authority.ts` 过时措辞修正并增加 `candidateId` 交叉校验。
- **state-write 锁协议真实缺陷修复（非测试 flake）**：`releaseLock` 把 owner 目录改名为 `.releasing-*` 过渡目录、完成交接后才删除；该窗口内 `staleOwnerState` 读不到 owner 元数据即判定 `'stale'`，使合法并发 writer 收到 `STALE_LOCK`（CPU 负载下复现 4/300，修复后 0/300）。修复为：存在 in-flight 过渡目录时视为「尚未判定」并重试；真正的孤儿过渡仍由 TTL 检查回收/暴露，故**真实陈旧锁的 fail-closed `STALE_LOCK` 语义不变**（既有断言全部保留）。
- **文档修正**：quickstart / user-guide 的 self-test 样本数 262→322；coding-quality「合并条件表达式」行转义竖线恢复单行渲染；INSTALL 的 logic `.ts` 计数与 exit-2 口径（42→43）同步。
- 版本保持 42.2.1，不 bump；pre-push 18 项通过（无 `--retry`）。

## 门禁项数 STALE 扫描（gate-count-stale-scan，2026-09-07）

- **docs-consistency 新增 `gate-count-docs` 白名单扫描**：README/AGENTS/CONTRIBUTING/troubleshooting 四份活体文档的门禁项数引用绑定 `EXPECTED.prePushCount`（行含「门禁/检查」标记时全部「N 项」须一致），防门禁项数 N→N+1 后未测试 docs 文件漏改（trigger-boundary-fastfollow 终审 F1 的结构性 follow-up）。
- 源码位置：`docs/superpowers/specs/2026-09-07-gate-count-stale-scan-design.md` + `docs/superpowers/plans/2026-09-07-gate-count-stale-scan.md`；SSoT 门禁项数扫描一句见 §pre-push 边界。
- 版本保持 42.2.1，不 bump。

### 本轮提交身份（最终 SHA 由外部命令核验）

以下为从 42.2.1 整改起点 `bc48824894ae076ff0e80d87cebd6c9de4437833` 至本次最终记录前已存在 HEAD 的完整父提交清单，来源为外部 Git 日志；历史/中间提交不冒充最终 HEAD，本 CHANGELOG 不自引用本次最终记录提交。

| 完整 SHA                                   | 提交身份                                                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bc48824894ae076ff0e80d87cebd6c9de4437833` | `release(42.2.1): audit remediation fixes`                                                                                                                                           |
| `ea49736869e99d52efe4c66021f235ea621b800f` | `docs(changes): record 42.2.1 audit remediation acceptance`                                                                                                                          |
| `9c1801f9745c3aa95f7be55bd0bb109e173f47a3` | `docs(changes): record final prepush observation`                                                                                                                                    |
| `5bb4dcc7938ec6dde91df503ff722bb013ff15ae` | `test(audit): add strict L0 link boundary coverage`                                                                                                                                  |
| `0da7e05d88e735fb15481ba15cb51ceb336e3148` | `docs(examples): close independent stage rework chains`                                                                                                                              |
| `03f1b249044105f3f28165b4abd60d51943056a3` | `docs(bdd): require complete phase gate arguments`                                                                                                                                   |
| `3c0cbb1644c5b5ea126f7a87498e1414b352e51c` | `docs(workflow): enforce complete rework checkpoints`                                                                                                                                |
| `f3bf1bbb8e4e6c8ae186540f313b0d48727cdb90` | `fix(audit): normalize L0 audit root paths`                                                                                                                                          |
| `664b202936debb5a67e4611f79004c989048a811` | `test(boundaries): register L0 audit filesystem exception`                                                                                                                           |
| `4ea55b44a3f70e56ffae4579c0310fbb166d1317` | `docs(tests): document L0 audit I/O exception`                                                                                                                                       |
| `ef14d03eb5d62a1d47029d35d07fca4305b191f9` | `docs(changes): record review round one remediation`                                                                                                                                 |
| `4d79f04c5d38ba99681e352817b6317790aa6581` | `fix(security): document L0 audit filesystem paths`                                                                                                                                  |
| `7502f6629bd96531d06f6dd430e8372e75f58cc2` | `docs(changes): finalize review round one acceptance`                                                                                                                                |
| `81aed005ae744f25b869e6b16744bd98e7a6560f` | `docs(changes): record review round one final gate`                                                                                                                                  |
| `3fae86e127757027ed40c5e653ca0e0d47083444` | `docs(references): close phase failure routing`                                                                                                                                      |
| `fa30fb982ad080c4ffc11685d9c9411592b20a32` | `fix(audit): fail closed on missing or escaped L0 paths`                                                                                                                             |
| `00f513e6343175fab2db5e3a5360c5b49afc4144` | `test(security): document escaped symlink fixtures`                                                                                                                                  |
| `7319bb716851ceed085c0a13e355df22d8eb6dbb` | `docs(changes): record second review remediation`                                                                                                                                    |
| `b1e364a81a1f877b3fab6e44dea5d46de0279160` | `docs(references): remove direct phase five fix bypass`                                                                                                                              |
| `46a2961937e58a24cc2dc6644dfc39573838c186` | `fix(audit): reject nested L0 directory links`                                                                                                                                       |
| `778ec87fdd2892f1a8c7d68cf5055366c79175f2` | `feat(audit): expose L0 link boundary command`                                                                                                                                       |
| `5ce123a5bd9e2dc2c7d355d7dc31a25a0758cd69` | `test(docs): scan all phase references for fix bypasses`                                                                                                                             |
| `b9958574bbd4be40da2c68da4f5b3beafb9a8ae0` | `fix(audit): reject top-level L0 directory links`                                                                                                                                    |
| `43bd922d0db673c875b9fd72b1e407299742bd76` | `test(docs): include templates in bypass scan`                                                                                                                                       |
| `e3396e5c47226c47e7257c3b0101d4f2a7c0789e` | `docs(changes): record review rounds three and four`                                                                                                                                 |
| `2e3cee897c6ce883468b0d3e53fd1c6453f56c38` | `test(security): avoid unsafe bypass scan regex`                                                                                                                                     |
| `b22191490b9c3d9d56bc47de2d9d33462fc308b5` | `docs(changes): record final audit verification scope`                                                                                                                               |
| `2e78319f8f9a0e25b327aae1509ec1004dcc8a9f` | `docs(changes): register prior audit commit identity`                                                                                                                                |
| `0eee1f48436b1643f14eb449452255e88f4b9418` | `docs(changes): record final audit gate`                                                                                                                                             |
| `cc0a77e9f51771398f309e80754bc15d236b2b1d` | `docs(changes): register final gate commit identity`                                                                                                                                 |
| `0974bc0c6b105d7c486fa30f79f2642a2c9ed7d1` | `docs(changes): register audit history before final gate`                                                                                                                            |
| `15762dde1b62e98d85fb1e5aa2b88ad893446d45` | `docs(changes): record final clean tree gate`                                                                                                                                        |
| `e8f6a5b2c6108b1f31061284551492a79fbc62d1` | `docs(changes): finalize audit acceptance records`                                                                                                                                   |
| `424b91fe57f2ca50dec4f373614c7f0430c2f5b6` | `test(docs): enforce complete ordinary failure routing`                                                                                                                              |
| `1aa684c7226ac1dafdd45b5f05e439e95fb24f1d` | `fix(audit): reject all L0 and L1 symlink boundaries`                                                                                                                                |
| `2a9930a37f91e12dcc3c09d18fb79bb5ab864f34` | `test(audit): close L0 CLI registration contract`                                                                                                                                    |
| `08b80c10916178f8f83d8b5a520dfef290977d9d` | `docs(references): close phase failure fallback paths`                                                                                                                               |
| `88bd58374e17eb737493ae7f75074bd269c48c19` | `fix(audit): report unreadable L1 boundary entries`                                                                                                                                  |
| `46db5fcfd702c3bb8837b0bbfab51ca51105ff4d` | `docs(references): route coding input failures through R`                                                                                                                            |
| `f8ffe0f7b88313af188cdb247586999d447af10f` | `fix(audit): classify L1 directory read failures`                                                                                                                                    |
| `43e60df2fb6582ca8e533f1a7d1fa8781a7475c9` | `test(docs): close ordinary failure routing contract`                                                                                                                                |
| `75d211e8270c16cc8fcb76b4ada70910e6accc4b` | `fix(audit): validate complete link URI encoding`                                                                                                                                    |
| `347f43e796fed39570164b9282e6534afdbd1e1b` | `docs(workflow): enforce complete ordinary failure routing`                                                                                                                          |
| `c6500ed47e36c8d87fc687875af9213ff95bd7ca` | `fix(audit): validate placeholder URI encoding`                                                                                                                                      |
| `d4e0e6788ef362a07edd4be7751893ede0021f07` | `fix(docs): close ordinary failure routing contracts`                                                                                                                                |
| `b030f8087567355147391f4b10203e57d3f5384a` | `fix(audit): close L0 URI and dependency boundaries`                                                                                                                                 |
| `b023dc798916169840d83b2e5411f028d4eb3192` | `fix(test): keep examples contract security-clean`                                                                                                                                   |
| `5f3311f7a889e6a1dc4d3456adb73d0b591a510f` | `fix(deps): patch fast-uri audit vulnerability`                                                                                                                                      |
| `4562e44b71b3544dfcfac4f7d19a966e8e15c810` | `docs(changes): finalize Task 8 acceptance evidence`                                                                                                                                 |
| `60694d336a27c52926eec2d1dc2dcfbd3c6441ae` | `fix(audit): reject Windows drive-letter link paths`                                                                                                                                 |
| `56b7d83d4f3d98497ea00d57902afc4533cbda9c` | `style(references): remove trailing whitespace`                                                                                                                                      |
| `982d051d7804dab1ecc9ef13e7a65cbf37ce04a6` | `test(audit): preserve valid external URI scope`                                                                                                                                     |
| `c74d38ecb4faea1efe20d0b1a47919c16d1c154d` | `test(audit): scan all guidance contracts`                                                                                                                                           |
| `1963406c3ae56ed0e796ffc517f9555fc4b495c2` | `docs(contract): close all ordinary failure routes`                                                                                                                                  |
| `41ebcb6485c7d5aea78745fe853735a6dd18c702` | `test(audit): verify l0 cli error routing`                                                                                                                                           |
| `0e9f1ce3f21f84b73be40017321768a5e5232666` | `test(security): document controlled audit fixtures`                                                                                                                                 |
| `bee1a634d62ac5fce7998cf17ff6c25daa3cc708` | `docs(changes): close task8 audit evidence`                                                                                                                                          |
| `9567415cb861b0fa461540317a8df2b956360827` | `style(test): format workflow contract scanner`                                                                                                                                      |
| `6c6ee22d4e36c93f0a8206449409faee42996f68` | `docs(changes): record final task8 gate`                                                                                                                                             |
| `d997b586afe381c2f8ffcb8edcbcf9d9741fb644` | `docs(changes): finalize task8 evidence`                                                                                                                                             |
| `0b2a62d3be2077b255be3d23204752bb78f1287e` | `docs(changes): record final prepush verification`                                                                                                                                   |
| `a6c805ba51ca7cefc5806f0a779fdbd9b86f4281` | `fix(docs): close ordinary failure routing contract`                                                                                                                                 |
| `751c1e0e172bd49b281e0d5c5919a139440c4e2d` | `test(docs): scan multiline test result tokens`                                                                                                                                      |
| `6ac25be195d3c841360f6ea0ce0c3c7a1399c377` | `test(audit): cover internal non-markdown l0 links`                                                                                                                                  |
| `d1c61732184af15ff563c0d923a316d65caa2397` | `test(docs): harden multiline test command extraction`                                                                                                                               |
| `ebcc2a678362775675972e65a030fa37ccefceec` | `docs(changes): record Task 8 final repair round`                                                                                                                                    |
| `54cdf07e1d178062af02d7146661349231658a10` | `docs(changes): synchronize final parent evidence ledger`                                                                                                                            |
| `7c70e70c0e1f64f22ca6030844ebd7ce524da6ab` | `style(test): align guidance scanner with prepush format`                                                                                                                            |
| `e9062857043ce2e50e2d2ff99b31b0d585b0a397` | `docs(changes): update final verification ledger`                                                                                                                                    |
| `f832febd5f41a831a4e4cce7e9562f1407b31722` | `docs(changes): finalize Task 8 verification evidence`                                                                                                                               |
| `1d148a8a296e159e72f662e2a3b8eaeaa32fa32f` | `docs(changes): record final prepush result`                                                                                                                                         |
| `c24b2442150f65331e98f6ada1862e4d8bfdb968` | `docs(changes): refresh complete final parent ledger`                                                                                                                                |
| `6ddb1978ffc51d790479c25fa9ccb8b9dfb4e81d` | `test(audit): scan whole-row failure routes with chain markers`                                                                                                                      |
| `f63989d12bb7bfe7813b93a6706c3438f82fa69f` | `fix(docs): route BDD/TLA+ gate failures through the complete chain`                                                                                                                 |
| `07832d7b8596ecc93ef49b290ceb4415d2e4dbdf` | `fix(docs): close /wm review C/D and BDD-gate exit-1 routing bypasses`                                                                                                               |
| `7f994e3d1191b671f371e713034ef26b22148b0a` | `fix(docs): route exit-code table rows 363/366 through the full chain`                                                                                                               |
| `44c057a3e342234e9e9faa0cad4744b161659305` | `fix(docs): remove End Patch residue and restore UAT table row`                                                                                                                      |
| `afd99c611b15b5ceb6cb68dac650a7b7fe87cc64` | `docs(changes): record scanner closure round in 42.2.1 changelog`                                                                                                                    |
| `fbfd3363d6961b76dfa8029712e2fc36c5544c73` | `docs(changes): record scanner closure round acceptance`                                                                                                                             |
| `051c688ecb2ddd361ce19bce560664f456355da1` | `style(test): format whole-row failure scanner`                                                                                                                                      |
| `c4e3359176a32e2c623f140c48a352349e8b635c` | `docs(changes): refresh complete final parent ledger`                                                                                                                                |
| `ac91849b7aa27bb605c3fb2f4ac235ac9645129b` | `docs(changelog): expand 2 short SHAs and append c4e3359 to 42.2.1 parent ledger`                                                                                                    |
| `97b91badfc7fe945ab830b5ea4a594d3c25db877` | `docs(changes): expand short SHAs in acceptance records and append ac91849 to 42.2.1 parent ledger`                                                                                  |
| `965095e049bf0688e1b343c5adcdd70407642228` | `docs(changes): annotate verbatim subject citations in parent ledgers`                                                                                                               |
| `689e51bd114831a209af92c99e82afea2e97f512` | `feat(gate): add change-scope and codegraph-query JSON Schemas with inventory sync`                                                                                                  |
| `ac90a78b800e5c163944900d7473136d863136b5` | `feat(gate): bind codegraph/opsx/archive checkers to ChangeScope with strict coverage`                                                                                               |
| `a0f86bbb4c5001f56a3b04143b13834f800b0922` | `refactor(gate): drop dead externalChecks passthrough; aggregate strict codegraph/opsx into artifact gate`                                                                           |
| `5197b21cb97002def958de0f33591ba2f1c73a73` | `fix(gate): suppress misleading no-scope reasons when ChangeScope binding fails`                                                                                                     |
| `ed55ff5b80cc81775c82349648dca81cc17a96bf` | `fix(gate): count R3 by success r3-* dimensions and fail closed on empty role logs`                                                                                                  |
| `ce72badd4373cf99ed236bea816ad3cef90076d6` | `fix(run-log): fail closed on empty and malformed input; block action-role mismatch; align fix variant and preventive schemas`                                                       |
| `36c66581b632571e9bb728edcf3f911776aec280` | `fix(run-log): absorb double-legacy emergency-fix rows via merged legacy predicates`                                                                                                 |
| `6adc3215815cff0d355c13a15a6e00278e393812` | `fix(hooks): consume pre-push stdin refs per-line with fail-closed scope`                                                                                                            |
| `13b942f1c36ae9e92c6d9f8ea22d4854340e117f` | `docs(sot): document ChangeScope gate binding and stage 5-8 aggregation`                                                                                                             |
| `c691023e344864e7262b6776b974fec1f56cc4bc` | `docs(references): sync scope and run-log fail-closed semantics across guidance`                                                                                                     |
| `3da9efa8a2ac4b889af8974029d902743eacc126` | `docs(changes): record gate-closure doc sync in 42.2.1 changelog and acceptance`                                                                                                     |
| `0ee78ea23b21325d186fed0b38be2b554c3d1dfc` | `docs(superpowers): add audit-gate-closure fix plan`                                                                                                                                 |
| `1a032bfab1ae0f224b903024dd3624dfdbfb9733` | `docs(references): state precise R3 dimension counting in summary tables`                                                                                                            |
| `827ebceeb4497a69716a42dd540020b3ae8398c2` | `docs(references): reconcile fix-variant wording and template gate qualifier`                                                                                                        |
| `1a0ed09c460bd42ad1cd964f6b11e35dc1725958` | `fix(gate): report R3 dimension gaps instead of missing R role records`                                                                                                              |
| `25e5bf01a976e234e225bc2bb0397cf5071e2433` | `fix(gate): validate change id in thin scope wrapper`                                                                                                                                |
| `e425642d019d3b2d8d55a4471a867eb81d9661fe` | `refactor(gate): share scope-resolution helper across checkers`                                                                                                                      |
| `f2570709982f458beb2d9bfb4a8e1754d22deb2d` | `docs(schema): align run-log descriptions with enforced pairing`                                                                                                                     |
| `f828b2776a486d674f44d66726d1ab6fa770ed44` | `fix(hooks): skip transient audit network errors and baseline new branches remotely`                                                                                                 |
| `f76dc43fc9571b85964cdefa68bd51df4ccd0e0c` | `docs(references): tighten fix-review wording in violation checks`                                                                                                                   |
| `d17594feb65c9b994a0e637d752355822e1abc84` | `docs(changes): make anchor-grep tally reproducible and date the 647 measurement`                                                                                                    |
| `8a7b503fe6077e36b97d02b24f1a1b3e04130759` | `test(gate): sync direct-call manifest line after change-scope case addition`                                                                                                        |
| `0644a0b740325a2e7eedf9860cfd700ede9b7a99` | `style(test): prettier formatting for hook test additions`                                                                                                                           |
| `f0add116c98b8f4ab109a01aa6f1543312e19bdc` | `fix(hooks): list merge diffs in remote-tracking enumeration with -m`                                                                                                                |
| `6780e109010835df967159ca52796a40f8970730` | `docs(superpowers): add review-fixes design spec (26 findings, 5 slices)`                                                                                                            |
| `a2cab37592f2e622f18eb4a824ea881eb9bd7304` | `docs(superpowers): add review-fixes implementation plan (6 tasks, SDD)`                                                                                                             |
| `de7152224ff2eab6c7be81807b023f05b1692b50` | `fix(scripts): harden change-scope binding (quotePath, shell whitelist, changeId prefix, dot-segment, archive date, phase filenames, external summary)`                              |
| `7076692f9f9aaed021e1a67b8bd155a7658406cf` | `fix(hooks): reject leading-dash remote names in pre-push enumeration (fail-closed)`                                                                                                 |
| `7cd5fcf8e2807db03383c366e010fb931e232afc` | `fix(scripts): parse reference-style links in L0 audit; consolidate pinned baselines; anchor hook failure-source assertion`                                                          |
| `ae73586407c344e1aa2736696414a8808b6f9658` | `docs: require --phase/--scope in gate command examples; document remote-tracking new-branch baseline path`                                                                          |
| `dabbe6bc4f3fd5fa267c7f194121844712c20e57` | `docs: reconcile gate/opsx/run-log/NFR/audit/exit-2-count wording with implementations`                                                                                              |
| `548e43a3553fc1109349e461458a288d0e48e383` | `docs(changes): restore parent-chain continuity (insert 965095e0, append 16 rows through f0add11)`                                                                                   |
| `558075dacc76756ba9909263723950b0f9f70aeb` | `docs(superpowers): add archival-fixes design spec (13 filed items, 3 slices)`                                                                                                       |
| `73b3f600f282bc76bb3a6142f12a844b661aeb86` | `docs(superpowers): add archival-fixes implementation plan (3 tasks, SDD)`                                                                                                           |
| `1c861082066c710847dcd5fac0cd28e8d0f83eaa` | `fix(scripts): close archival items (summary shape, CLI exit-2 coverage, quotePath in docs-consistency, comment precision)`                                                          |
| `09b47e428f3c5ee759d05bd0e8da35c4f9b959d8` | `docs: close archival docs items (GATE_JSON provided, l0 fixture form, AGENTS pretty-format, data-models scope note, run-log punctuation, user-guide audit wording, changelog typo)` |
| `c3636a3b70901f706d15f83bf5daba27ca64fa6a` | `docs(changes): append archival-fixes ledger rows and refresh coverage note (close 13 filed items)`                                                                                  |
| `ccad270ca42706af54ab5911afef6e8c191368b8` | `docs(superpowers): add archival-fixes-2 plan (4 filed minors, single task)`                                                                                                         |
| `34aad9663f5e5cb5c99a8e315e000ad8edc5fbe6` | `fix(scripts): require attemptedChangeId on scope violations; sharpen two comments`                                                                                                  |
| `7b52d4cd2559abac09abc1c3bb7a04619037ad29` | `docs(changes): correct archival index prose to actual ledger coverage`                                                                                                              |
| `11944cd6130b6f3faa1df497fabae3cea6c8385f` | `docs(changes): append archival-fixes-2 ledger rows (close 4 filed minors)`                                                                                                          |
| `e6de501d655406560a91f2f0a69b60f368812fb8` | `docs(changes): backfill review-fixes campaign rows to restore ledger continuity`                                                                                                    |
| `f7f0bba84fce8f780ce7d983785e5caabb4b6ccc` | `docs(changes): chain previous ledger-closing commit c3636a3 (zero-exemption continuity)`                                                                                            |
| `14ccc5f33ee671a67db4d4425a57922ca866ad89` | `docs(superpowers): add review2-fixes design spec (27 findings, 6 tasks)`                                                                                                            |
| `5d7046a0a9737fc3714490cc2703408c63bc9ab9` | `docs(superpowers): add review2-fixes implementation plan (6 tasks, SDD)`                                                                                                            |
| `86162def2f56556bf341a82410cce37bea05dfcd` | `docs: close review2 Importants (template --scope, SSoT L0/L1 boundary anchor)`                                                                                                      |
| `0f9986c25fee563305ca3e4f1b2b7cdba9845708` | `fix(scripts): close l0 parser edge forms and classify .githooks as code`                                                                                                            |
| `63687d42d3b40e937ca95f5f6ab500c8a50cf988` | `fix(scripts): reject duplicate flags, bound legacy variant absorption, unify scope loading`                                                                                         |
| `f79087a6e21c444ebf244e8a0210e30910f6c17f` | `test: close quality minors (dead probe, E5b shape, dedupe scanners, fixed timestamps)`                                                                                              |
| `35f132ee342fbfa5fc359b7768b8d5d430e0757b` | `fix(hooks): quotePath in pre-push git calls and bound audit skip to anchored transient signals`                                                                                     |
| `84fe7cb2be83a4451688575b899f74ab1b4ff382` | `docs: anchor ordinary failure chain and close wording minors (review2-fixes)`                                                                                                       |
| `c38fc88f800281f1e27704f57c718c2b7db8bbb6` | `docs(changes): append review2-fixes ledger rows (close 27 findings)`                                                                                                                |
| `a5e2c2723a42eb4e17c5ddc7d10cf1453b2b8f6f` | `style(scripts): prettier formatting for gate scope files`                                                                                                                           |

注：父链表第二格为提交 subject 逐字引用；subject 内形如短 SHA 的文本（如若干 docs 提交 subject 内嵌的先前提交 SHA）属 commit message 原文，非身份引用，不展开、不补全。

最终记录提交不在 CHANGELOG 的本表中自引用；最终 SHA 与最终 prepush 由外部 `git rev-parse HEAD` / `git status --short --branch` 和 Git Bash 命令核验，`e8f6a5b2c6108b1f31061284551492a79fbc62d1` 保留为历史中间最终记录。

## [42.2.0] - 2026-09-01

### 优化（易用性清债：过期重定向 stub 移除 + SKILL.md 收敛）

- **移除 19 个 42.0.0 wave 合并遗留重定向 stub**（原承诺 42.1.0 移除，因证据支撑树集成顺延至本版）：TLA+ 5 文件 → tla-plus.md、BDD 4 文件 → bdd.md、anti-patterns → hard-constraints.md、dispatch-matrix → subagent-delegation.md、subagent-persona-matrix → agent-personas.md、conventions 三件套 → conventions.md、coding-quality 三件套 → coding-quality.md、definition-of-done → quick-self-check.md。活体引用 13 处先行重链（tools/README ×2、examples ×3、schemas ×8）；references 59 → 40 个 .md，SKILL.md 与 README 资源计数同步。
- **SKILL.md 收敛 106 → 99 非空行**（批次 3 遗留目标 <100 达成）：快速自检节并入工作流尾注、执行工作流 12 步合并为 10 步、触发决策前两行合并、双 CHECKPOINT 引用合并、成熟度指针并入适配节——全部指针与 eval 断言锚点保留，`npm run eval` 25/25。
- 门禁闭合（真实退出码）：eval 25/25、self-test 262/262、docs-consistency、samples-coverage 282 fixtures / unregistered=0、prepush 17 项全绿。

## [42.1.1] - 2026-09-01

### 修复（42.1.0 deferred 项修正收口）

- **run-sync ↔ dependency-boundaries 全量并行竞态**：`collectTypeScriptFiles` 跳过 `.d2-` 瞬态 fixture（dependency-boundaries 并行测试写入的 `scripts/logic/.d2-boundary-fixture-<pid>.ts` 生命周期窗口曾触发 ENOENT），新增回归测试；run-sync × dependency-boundaries 组合 5 连跑全绿（`e20e579` + `0d03b4a`）。
- **security baseline v2 全量对账**：`--regenerate` 消除 49 提交累计卫生债——删除 116 条孤儿条目并修正 line 漂移，411 → 295 条（`7e97baa`）。
- **活体文档/风格微修**：samples/README graph 行 R1-R15、conventions §2.1 evidenceAnchor 复用说明、ingestion-chunk A-chunk L42 代码来源示例、SSoT §10A 4A.1b 表行对齐、subagent-delegation §3.1 触发表补 evidence-anchored-tree 行、graph-logic R15 块 `test()`→`it()` 风格统一（`93f6f3a`）。

## [42.1.0] - 2026-08-31

### 新增（证据支撑树方法论集成）

- **产出期证据锚点（evidenceAnchor）**：图谱节点可选声明结论事实锚点（由 A 子代理 ingestion 时声明、S 规格 §4.2 只读同步、V 评审可核验、G 门禁 R15 格式校验）；复用现有 EVIDENCE_PATTERN 格式，向后兼容存量 graph.json（未声明不阻断）。graph.schema.json / graph-logic.ts / conventions.md / requirement-spec.md 同步。
- **方法论参照文档**：新增 `references/evidence-anchored-tree.md`（证据支撑树 × W 模型映射 + 唯一增量 + 明确拒绝照搬点）。references 58→59。
- **自我纳入机制**：A 子代理 ingestion 指引（ingestion-chunk/cross）注明 evidenceAnchor 可选声明时机；SSoT §4A.1b / §7.7 / §10A 同步；self-test 基线 260→262。
- 设计/SSoT 变更草案与详细设计见 `docs/superpowers/specs/2026-08-31-evidence-anchored-tree-*.md`，实施计划见 `docs/superpowers/plans/2026-08-31-evidence-anchored-tree-integration.md`。

## [42.0.0] - 2026-08-30

### 优化（三维度优化批次 3：易用性大重构 + 终值评估）——版本 42.0.0 发布

三维度优化收官：批次 1（有效性，评估闭环重建）与批次 2（可靠性，红灯清零）后，本批次聚焦**易用性**——技能资产大重构（w-model-dev/），并以同一固定规格重新执行完整 8 阶段 e2e 终值评估对照基线。

**易用性重构（wave-1 + wave-2 合并重链）**

- **去重合并**：TLA+ 指南 5 文件 → `tla-plus.md` 单文件；BDD 指南 4 文件 → `bdd.md` 单文件；anti-patterns 48 条并入 `hard-constraints.md`；角色细则 4 文件 → 2 文件；`conventions.md`（术语表 + 格式 + 目录约定）+ `coding-quality.md` + `quick-self-check.md`（+ DoD）三合一。`references/` 收敛为 58 个 .md，重链 19 文件共 384+ 处交叉引用（跳转 stub 引导旧路径）。
- **SKILL.md 整文件重写**：由约 300 行收敛为 **106 非空行**——「三问」触发决策、14 条硬红线压缩表、编排者-子代理边界表、8 步执行工作流、命令速查、阶段路由表与新「门禁契约与资源清单」节（操作行为指针 / 资源计数 / 状态写锁协议 / 行为门禁 flag / 证据与审计 7 条款）。
- **新增 `references/quickstart.md`**：5 分钟上手（交付层 L0/L1、触发决策、首个任务路径）。
- 门禁契约与评估锚点同步：docs-consistency 13 项契约闭合（单提交内不留隔夜红灯）；`eval/mappings.json` 4 处锚点随文件改名更新（`npm run eval` 保持 25/25）。

**终值评估（Task 3.6，新 SKILL.md 引擎）**

- 同一 todo-rest-demo SPEC（与基线逐字共用）下完整 8 阶段从零重建：**8 阶段 Verifier 全 A**（0.9295 / 0.8770 / 0.886 / 0.894 / 0.8757 / 0.8942 / 0.9028 / 0.9057）；四级测试 **74/74**（UT 35 + IT 17 + ST 11 + UAT 11，coverage 97.56 / 98.00 / 95.45 / 97.67）。
- 易用性收益可量化：**分派 ≈52 vs 基线 ≈74（↓约 30%）**；返工 8 项（1 完整 R 循环 + 7 R3-Required S-fix；基线 R 循环 3）；CHECKPOINT 18（判据代行）。
- **解决基线常驻红灯 D9**：SSoT §10.5.1 阶段 5-8 Cucumber 执行证据 × CON-001 零依赖 × 成熟度 L2 的不可满足，由 S-coding 自建真实 cucumber 报告通道（`.w-model/bdd/generate-bdd-report.ts`，真实 HTTP 往返）消除——阶段 5-8 artifact-gate 全部零常驻红灯。
- 终结偏离登记：阶段 1 R 循环根因为新指南对 TLA↔BDD 同步契约只有「名称完全一致」而无工作示例（基线 D5① 同型未修，本报告登记为 skill-side upstreamDefect，收尾留档）；验收 UAT-002 设计对冻结规格过度收紧（仅空白 title，O 裁定冻结规格权威，D7 谱系）；超限体大客户端 ECONNRESET（R3 security Required 在最终验收门升格，`src/server.ts` 拒绝路径排空 + `Connection: close` 修复，≥1MB 用例防回潮）。
- 评估记录：`eval/w-model-dev-results.tsv` 新增 dry_run（25/25 baseline）与 e2e 终值共 2 行；终值记录 `eval/e2e/2026-08-28-final.md`；`eval/README.md` §4 更新为「评估已恢复（2026-08-28 起）」。

> 本版本累积批次 1（评估闭环：`npm run eval` 25/25 + e2e 基线）与批次 2（可靠性红灯清零：run-sync 清单补登 + 负载敏感探针加固）的变更；完整三维度优化设计与实施计划见 `docs/superpowers/specs/2026-08-28-w-model-dev-3dim-optimization-design.md` 与 `docs/superpowers/plans/2026-08-28-w-model-dev-3dim-optimization.md`。

## [41.19.0] - 2026-08-19

### 修复（D8 run-log lifecycle checker）

- `check-run-log` phase 8 以 `(phase, round, reportId, targetKind, basedOnReport)` 建立 lifecycle segment，严格区分 rootcause V/G 与 implementation V/G，fix 只接受 exact `basedOnReport`，R3/R8 不再跨 report、targetKind 或 phase-wide 首索引误关联。
- 新增 `pending-pre-approval`、`open-approved-lifecycle` 与 `LEGACY_UNSCOPED`/deferred diagnostics；保留真实未完成 implementation lifecycle 的 exit 1，兼容缺身份历史行且不修改 raw JSONL。`--json` 与人类输出均携带 diagnostics，schema/SSoT/运行日志参考同步。
- D8 TDD 新增 8 项 identity、pending/open、R3/R8、legacy diagnostics 与 raw JSONL immutability 回归；focused run-log suite 实测 49/49 通过。

### 修复（R10 persona 契约）

- RootCauseReport R10 采用 canonical-first：接受规范 `testing-reality-checker`，为兼容已有合法归档保留 `reality-checker` legacy fallback；同 artifact 的 canonical+legacy 不虚增 persona 语义，跨 artifact 或异常重复/冲突 fail-closed。同步 rootcause schema、根因定位指南、Verifier 规范、SSoT 与命令参考；本条历史实现说明不把当时的 17 tests / 4 RED 记录表述为已覆盖两个专用 duplicate 分支。保持 R1-R9、退出码 0/1/2 及 `ROOTCAUSE_JSON` / `ERROR_JSON` 合同不变。
- R10 S-fix 补测：新增两个 canonical duplicate 与两个 legacy duplicate 的精确 reason/count 断言，并补充同 artifact canonical 高、legacy 低的优先级用例；当前 root-cause focused 为 20/20，真实全量 Vitest 为 55 files / 942 tests / 942 passed / 0 failed。I1 deterministic metrics probe（显式 projectDir + `--phase=0` + 固定 probe cwd）与 I2 七来源 source×clause mutation 门禁同步完成。
- R10 第二轮 S-fix 澄清：未改写上述历史 17/4、2/2 RED 或 20/20 GREEN 事实；新增语义关系 marker 的 fail-closed contract、Exit2ProbeResult 完整字段/rule 合同、metrics args/cwd identity 规范化及真实七来源 mutation 回归。当前工作区全量 Vitest 实测为 55 files / 954 tests / 954 passed / 0 failed，docs-consistency 的历史 run-log 中间态 exit 1 仍按生命周期事实保留。

### 修复（审计整改批次 B）

- **samples 覆盖门 JSON 退出码对齐**：`check-samples-coverage.ts --json` 复用同一 `exitCode` 输出 JSON 并设置 `process.exitCode`，违规时真实 shell status 与 JSON `exitCode` 均为 1，成功时均为 0；新增真实子进程回归断言。
- **BDD 项目行为证据显式门**：`check-bdd-model.ts` 新增 phase 1-4 的 `--require-tla-equivalence` 与 phase 5-8 的 `--require-cucumber-report`；所需工件缺失均作为 D4/D5 violation / exit 1，错误 phase 组合为 exit 2，未带 flag 保持 fixture 兼容跳过。第 1/5 轮审查修复将 CLI 收紧为参数 allowlist：`=true`、重复、近似拼写和未知 `--*` 统一 `ARG_INVALID` / exit 2，不得静默降级。required Cucumber 报告还必须是 `{ elements: [...] }` 且至少有非空 name scenario 的 `passed` step；failed 仅作诊断，skipped/pending/undefined/未知 status 与匿名 element 不构成执行证据且作为 D5 / exit 1 拒绝。SKILL/指南/命令参考与 pre-push 注释明确区分：pre-push 只直接运行技能包 BDD fixture 回归，TLA、TLA↔BDD 同步和真实项目工件由项目阶段门按成熟度执行。
- **同步子进程边界**：`runSync` 为 B4 受控调用提供 15 秒进程级 timeout、固定 `SIGKILL`、固定 UTF-8 编码和 64 MiB 输出缓冲；非有限/非正 timeout 或 maxBuffer 均回退默认值。artifact gate 的 TLA+/BDD 校验及 gate-report、metrics-report、wm-status 测试调用均迁移至 helper。全目录同步调用已通过 TypeScript AST 与集中清单审计：解析 `node:child_process` 的直接、别名、namespace、解构和静态属性绑定；每处调用均声明理由及现有 timeout 或后续整改状态，动态计算属性访问将阻断审计，未在 B4 范围内的无 timeout 调用不再被默默放过。

### 文档对齐（审计整改批次 C）

- **C3 第 2/5 轮 hooksPath 可执行恢复流程**：README、INSTALL、CONTRIBUTING 分别提供 Bash/PowerShell 的 `git config --local --get` 备份、退出码 1 的原先未设值分支、`git config --local --unset` 撤销和基于 `.git/hooksPath.previous` 的回写；备份文件只保存在本地 `.git/`、不提交，并提示权限与空值注意。文档测试提取统一契约 helper，使用旧 TL;DR、`.agent` 卸载、缺 Bash 边界和缺失 hooksPath 流程的真实文本 fixture 断言失败，同时要求当前文档通过。
- **C3 入口契约加固**：README TL;DR 改为两个独立锚点选择，不再混合 Skill 复制与仓库验证命令；README、INSTALL、CONTRIBUTING 补充 `core.hooksPath` 旧值保存、`git config --unset core.hooksPath` 撤销和按需回写命令；INSTALL 卸载命令统一使用 Agent-specific placeholder，并要求替换安装时目标后再执行破坏性删除；文档测试增加按路径的局部负例和标题顺序、TL;DR、恢复命令、卸载、Bash 边界语义断言。
- **仓库验证与 Skill 安装入口拆分**：README 首屏新增「验证仓库」与「安装 Skill」两个独立入口。仓库验证固定为 canonical GitHub URL、仓库根目录、Node.js ≥20、Git、npm registry/网络、`npm install` → `npm run self-test` → `npm run doctor`；PowerShell 5.1 使用逐行命令，`self-test` / `doctor` 不要求 Git Bash。Skill 安装改为复制 `w-model-dev/` 到 Agent-specific skills 目录，不将 `.agent` 作为通用路径，也不伪造无法验证的 Agent canonical URL。
- **平台与 Hook 边界披露**：文档明确 `postinstall` 运行 `scripts/setup-hooks.cjs` 并设置本地 `core.hooksPath=.githooks`，该副作用不是 Skill 激活必需；Bash 仅用于 `pre-push` 与平台依赖检查；`platform-deps:check` 只检查、`platform-deps:install` 当前 fail-closed 并指引人工 `npm install`；Windows/WSL 不混用同一 checkout 的 `node_modules`。
- **采用与贡献导航**：adoption Day 0 先验证仓库再安装 Skill；INSTALL、AGENTS、CONTRIBUTING 分别引用两个入口，并保留真实测试计数，不新增样本或改变实现逻辑。文档入口的语义由按路径契约测试逐项守护。
- **可执行 Persona Verifier 样例**：将四个 Persona 的失效内嵌 JSON 迁为 `samples/verifier/persona-*.json` 可执行 fixture；每个 fixture 使用当前 Schema 的 meta、子标准、方差与可追溯 evidence，并由 CLI、self-test、samples 覆盖门和 Vitest 逐项验证。`agent-personas.md` 保留字段约束、fixture 链接与校验命令，明确真实评审须基于目标证据重建输出，不能复制固定评分或证据。self-test 基线 256→260，Vitest 实测 52 files / 849→853 tests。
- **SSoT 外部 Agent 边界**：重画 §3.1 架构图，明确技能包仅交付 Markdown 资产、Schema 与确定性 gate scripts；宿主 Agent / 外部 LLM 负责推理、子代理调度和 LLM-as-Verifier；TLA+ TLC、CodeGraph、OpenSpec 为可选外部工具，不属于技能包交付物。同步三项 CLI JSDoc：默认和 `--json` 均先尝试写 gate log，写入失败以 `gateLogWriteError` 报告且不改变主 gate 结果，并由静态测试守护。

### 新增（审计整改批次 D）

- **D7A 可追溯证据包**：`wm-export-evidence` 默认要求 `.w-model/evidence-provenance.json` 证明已通过的运行，并将 run ID、40 位 commit SHA、artifact ID、三类源证据计数/哈希和导出文件清单 content hash 写入严格 manifest。`--verify` 除了路径、Schema 与文件哈希外，重新执行脱敏规范化，拒绝手工同步哈希后重新引入的绝对路径或敏感值。敏感字段识别扩展为 `authorization`、`credential`、`access_token`、`private_key`，忽略大小写及连字符/下划线差异，并覆盖 JSON、JSONL 与 Markdown；真实 CLI 回归覆盖 provenance 缺失/未验证拒绝、合格导出/验证及未脱敏包拒绝。
- **D1 Schema loader 文档路径对齐**：将 `data-models.md`、`docs/INSTALL.md` 与 `docs/user-guide.md` 的 Schema loader 引用统一指向 `w-model-dev/scripts/infrastructure/schema-loader.ts`，并新增文档回归断言防止迁移后的旧 `scripts/logic/` 路径回归；不改变生产逻辑、Schema、hook、package、baseline 或计划/spec。
- **D7C source-bound evidence verification 文档与动态计数**：本条目对应单提交 `d659e82^..d659e82`；仓库外受控 coverage/provenance artifact 绑定测量 HEAD `d659e8239f47c90499066f87ba64731a114cca1a`，相对 artifact ID `vitest/results.json`、SHA-256 `9b4cd0412e95dfc1ec74a19746ebc9c6b4de7955bac224ac9476fe4be0b03af6`、run ID `8f909dd7117df0ac`，实测 23 schemas / 36 CLI scripts / 35 exit-2 scripts / 55 test files / 910 tests / 910 passed / 0 failed / success=true；self-test 为 260/260，samples coverage 为 280 fixtures、242 个文件引用、15 个目录引用、0 未登记。登记 `evidence-provenance.schema.json`、`wm-verify-evidence-source.ts` 与 source-bound/package-only 边界，明确受控本机 provenance 不是密码学签名或第三方不可抵赖证明；D7C 文档与动态门测试保留旧计数负例。**该条目是 historical evidence：measurement commit=d659e8239f47c90499066f87ba64731a114cca1a，不是后续 reviewed/final HEAD 的验收证据。**
- **D8 C1/M1 final-head evidence boundary**：保留 D7C 的历史数值与 artifact/hash/runId 事实，不将其升级为当前验收；最终验证报告必须同时记录 `reviewedHead`、`measurementCommit`、artifact ID/SHA-256、runId 和 provenance，并仅在 `measurementCommit == reviewedHead` 时标记 final-head verification passed。若两者不同，状态只能是 `historical evidence — not final HEAD verification`。
- **D8 I2 natural-exit contract**：D2 约束收窄为 `logic/` 与 `lib/` 不直接退出、gate-report callers 设置 `process.exitCode` 后自然返回；`self-test`、`security-scan`、`wm-status`、`metrics-report`、`ensure-codegraph-opsx` 等 process-level runners 保留直接退出并登记理由，不作无关重构；新增 gate-report caller 或 direct exit 时须同步契约测试与命令参考。
- **D6 同步 D5A 后真实 Vitest 计数**：以当前 HEAD 受控 coverage/provenance artifact 实测的 54 test files / 895 tests / 895 passed / 0 failed / success=true 为唯一来源，同步活体文档、pre-push 第 12 项描述性计数与 docs-consistency fixture；不改变生产逻辑、门禁控制流或 evidence export。
- **D3 可验证运行时审计证据导出**：新增 `wm:export-evidence`，仅导出 `.w-model` 白名单目录与 run-log 的常规文本记录；JSON/JSONL 递归脱敏 `token`、`secret`、`password`、`apiKey` 字段，使用临时目录+原子 rename 发布严格 Schema 的 SHA-256 manifest。`--verify` 会重新执行 manifest Schema、路径安全、文件存在性与哈希校验；输出目录冲突、符号链接/路径逃逸、二进制或未知扩展均 fail-closed，CLI 保持真实 exit 0/1/2 与 `EVIDENCE_EXPORT_JSON` 摘要。
- **D4 动态元数据与本地证据治理**：docs-consistency 保持顶层 `violations` 兼容字段，并按 `staticViolations` / `dynamicViolations` 分组，输出真实 `dynamicMeasurements`。以 coverage JSON 的 `testResults.length` / `numTotalTests` 为事实源同步活体计数；登记 `evidence-manifest` Schema 与 `wm-export-evidence` CLI；README、Agent、安装、贡献、Skill 和命令参考明确 `coverage/` / `.zcode/` / `.w-model/` 是 Git 忽略的本地生成物，审计交付须显式导出脱敏 SHA-256 manifest 包，且与受控 `docs/changes/archive/` 区分。
- **D7B source-bound provenance**：新增 `evidence-provenance` Schema 与 `wm-verify-evidence-source` producer+verify CLI。命令校验真实 Git HEAD、run-log、passed gate-log、signature-chain、source file 清单与 source bundle SHA-256 后原子写入 `.w-model/evidence-provenance.json`；`wm-export-evidence --verify` 无 `--source-project` 明确返回 `package-only`，传入 source project 才返回 `source-bound` 并重验当前源。同步注册表、命令参考、数据模型、测试 fixture 与 55 files / 905 tests 的成功 artifact 计数。

### 修复（审计整改批次 A）

- **状态写并发协议**：`wm-write` 改为 `<target>.lock` 持久目录与可转移 owner 的跨进程锁；锁内执行 mtime、毫秒+UUID 备份、tmp+rename、回读与原子恢复。CLI 增加 `--lock-timeout` 与显式 `--recover-stale-lock`；默认对陈旧锁 fail-closed（`STALE_LOCK` / exit 1），同时保留直接 `writeStateJson` 调用的兼容性隐式恢复。显式恢复仅授权 TTL 已过且 owner/operator PID 已退出的锁或 transition，不能夺取活跃 writer；逻辑层 barrier 与真实 CLI 回归测试覆盖该排他性边界。
- **状态 Schema 写时校验**：`wm-write` 在锁临界区内通过唯一注册表验证 project/rtm/budget/maturity JSON 与 run-log JSONL；未注册 `.w-model` 目标默认以 `UNREGISTERED_TARGET` 拒绝，`--allow-untyped` 只允许该类目标且在 JSON 摘要标识 `untyped:true`，从不绕过注册目标的 `SCHEMA_INVALID` 拒绝。真实子进程回归覆盖两种 exit 1 协议、JSONL 安全行号与无备份/tmp 残留。
- **显式平台修复**：pre-push 不再自动 `npm install`，缺少 `node_modules` 即 exit 1；仅调用 `ensure-platform-deps.sh --check`，默认/`--check` 不下载、不执行 `npm pack`、不解包也不覆盖 `node_modules`。`npm run platform-deps:check` 与 `npm run platform-deps:install` 是显式入口，后者目前 fail-closed 并指引人工 `npm install`。
- **文档契约**：SSoT、skill、状态/命令参考、README、安装/贡献/Agent 指南和 docs-consistency 断言同步上述状态锁与平台依赖边界。
- **Vitest 真实计数同步**：以覆盖率启用的 Vitest JSON `testResults.length` / `numTotalTests` 实测为唯一来源，将活体文档与 pre-push 第 12 项描述性注释统一为 **52 test files / 849 tests**；docs-consistency CLI fixture 保留并断言这两个 JSON 字段，仍通过 `WM_VITEST_COUNT_FILE` 注入真实 CLI。
- **Vitest 计数证据 fail-closed**：无 `WM_VITEST_COUNT_FILE` 时强制采集；Vitest 启动、JSON 或文本解析失败均产生 `vitest-tests` 违规并 exit 1，保留 A8 JSON 注入快路径。SSoT 纳入内链扫描，并修复 CHANGELOG 与 decision-log 三处相对链接。
- **Schema 活体库存同步**：将实际 21 份 Schema 的声明同步至 SSoT、SKILL、anti-patterns 与 user-guide；docs-consistency 对这些权威声明逐一校验实测 Schema 数，缺失或漂移产生 `schema-list` 违规。
- **Prettier 格式阻断修复**：按仓库 `config/prettier.config.cjs` 格式化 `w-model-dev/scripts/logic/docs-consistency-logic.ts`，消除 pre-push 第 16 项格式检查阻断；仅调整尾随逗号与换行，不改变运行时逻辑。

### 修复（核查报告 2026-08-19 六项问题）

- **P1-1 文档数字漂移**：CONTRIBUTING 门禁表 vitest 计数 40/623 → 47/723（与同文件 :214 自相矛盾修复）；docs/INSTALL.md :83/:248 同类漂移一并修正（复核补充）；PR 模板「14 项」→「17 项」；docs-consistency 新增 `vitestExtraDocs` / `prTemplate` 可选输入（checkVitestTestCount 参数化 + checkPrTemplatePrePushCount），堵住 REQUIRED_PATHS 未覆盖 CONTRIBUTING/INSTALL/PR 模板的盲区；CONTRIBUTING 版本机制「五处」→「六处」同步
- **P1-2 typecheck 门禁**：package.json 新增 `typecheck` script；pre-push 第 17 项 `npx tsc -p config/tsconfig.json`（对齐 SSoT §10H.5 V1）——README 健康指标「tsc 0 错误」由手动验证升级为自动化门禁
- **P1-3 IDE 产物出库**：`.trae-html-share-packages/` 移出版本控制并加入 .gitignore（会话生成物，非仓库资产）
- **P1-4 依赖可复现**：package-lock.json 入库（.gitignore 移除忽略行），不同环境 install 结果与 npm audit 行为可复现
- **P2-1 纯 Windows 警告升级**：pre-push 无 bash 环境时黄色 ⚠ 升级为红色 ✗ + 「本次推送未执行 17 项门禁」明示 + 补跑指引（保留 exit 0 刻意妥协）
- **P2-2 PR 模板强化**：校验要点改可勾选清单 + 新增「门禁输出」节要求附 prepush 末尾摘要（远程 runner 仍受限，不加 GitHub Actions）

### 修订（发布后延后项处理）

- version-bump / version-consistency 纳入 package-lock.json 根 version（版本六处 → 七处；防 lock 漂移脏 diff 复发）
- version-bump 顺带刷新 skill-metadata.json updatedAt
- README 健康指标日期更新为 2026-08-19 实测
- docs-consistency CLI 消除 docs/INSTALL.md 重复读取
- pre-push 第 17 项注释括号平衡（纯注释）
- 计划文档残留 grep 验证排除表补 **tests**/logic/cli 源

## [41.18.0] - 2026-08-18

### 修复（审计 2026-08-16 十六项问题）

- **反模式 #48 新增**（子代理越界实施）：修正 SKILL.md 五处 #22 误引（#22 实为目标系统 RBAC 角色越权）；补 #18/#19 详细节；maxAntiPattern 47→48
- **run-log action 枚举同步**：data-models.md interface 15→27 值（补 emergency-fix/r3-_/codegraph_query/opsx__/ensure_deps/iceberg-*），docs-consistency 新增 interface↔enum 语义比对
- **TLA+ 门禁超时**：SANY 60s / TLC 300s（EXEC_LIMITS 集中），TLC 挂死不再阻塞 CHECKPOINT；Java 版本解析单源化（lib/java-version.ts），预检不再硬编码 11
- **wm-write 原子写**：tmpPath 追加 randomUUID（同进程并发安全）；回读失败自动回滚备份（rolledBack 字段）
- **错误出口统一**：HandledCliError + runMain，消除 readJsonOrExit process.exit 截断 ERROR_JSON 风险与 readJsonClassified 双打印
- **分层修复**：plan-chunks 拆分 logic（纯）/cli（入口）；schema-loader 去 process.exit、IO 下沉 lib/schema-fs.ts；bdd-logic 去 as any
- **样板抽取**：lib/parse-args.ts、lib/run-main.ts、lib/gate-log-writer.ts；budget/maturity 复用 readJsonlOptional；artifact-gate 瘦身
- **schema 自描述**：design-contract 补 $id；6 份 schema 补顶层 description
- **persona 统一**：product-manager 删 tools 字段；5 份 hex color 统一命名色
- **文档一致性**：subagent-delegation 六角色矛盾修正；verifier-spec §6/§8 引用修正；command-reference 补 A/R 与 CHECKPOINT 统一清单；INSTALL 目录树 exit-2 脚本计数 31→33 修正；glossary 增反模式/exit-2 口径条目；三个超大引用文件增 §0 分节导引；ensure-codegraph-opsx 吞错加 stderr 日志；gate-logic 首次获得专属单测

## [41.17.0] - 2026-08-15

### Added

- `wm-write` 状态写助手：`.bak` 备份 + mtime 乐观锁 + 原子替换 + 回读校验，状态文件统一经此写入（防手写漂移）
- `doctor` 环境自检：node/tsx/ajv/java/tla2tools/codegraph/openspec 逐项检查 + 修复指引（`--with-tla` 升级 TLA+ 项为阻断级）
- `check-artifact-gate --validate-templates` 模板漂移校验：按 PHASE_SPEC_LAYOUT 校验 templates/ 资产结构标记
- 图谱轮次上限校验（MAX_GRAPH_ROUNDS=5）：防收敛循环无限返工
- 编排质量指标（metrics-report orchestration 区）：R3 套数/findings 分布 + 冰山扫掠轮次分布 + reworkHints 统计
- 评估提示词 15→25 条（w-model-dev-test-prompts.json）
- `templates/README.md` 阶段 × 主模板 × 子模板映射索引

### Changed

- run-log R8 轨迹校验扩展：同阶段内 S 动作 < R3 < V < G < checkpoint 相对顺序约束
- 错误消息补「期望 + 修法」尾注（design-contract-logic / tla-logic 层次校验）
- safe-json BOM 剥离：Windows 下 BOM 导致的 JSON 解析问题修复
- check-docs-consistency 新增文档内链存在性门禁（C3）

### Docs

- 六份重型参考（anti-patterns/verifier-spec/tla-plus-guide/bdd-guide/agent-personas/data-models）分层速查摘要
- anti-patterns 阶段 N 必读反模式索引
- dispatch-matrix S 变体 × R3/V/G 触发矩阵消歧 + 按阶段分节加载导引 + 53 文件触发条件表补全
- subagent-delegation 加载导引（已存在，确认）
- toolbox.md 去孤岛（SKILL.md + dispatch-matrix 指针）

## [41.16.0] - 2026-08-14

### Changed

- 版本号 41.15.0 → 41.16.0（**首次由新脚本 `npm run version:bump` 一处改版、六文件同步**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例 / CHANGELOG.md 节头；`version-consistency` 检查扩展为六处比对）
- **P0-1 消除 vitest 双跑**：pre-push 第 12 项 vitest 落盘 JSON（`--reporter=json --outputFile`），第 14 项 `check-docs-consistency` 经 `WM_VITEST_COUNT_FILE` 复用用例数，不再二次全量 vitest；脚本未变更时跳过重采（软放行）。每次 push vitest 由两次 → 一次，纯文档 push 零次。
- **P0-2 SSoT 章节号归一 + ssot-headings 元门禁**：`3.3.x` → `3.3.1`；`16. 参考文献` → `13. 参考文献`（16.1~~16.3 → 13.1~~13.3，内部 §16.2 引用同步）；新增 `checkSsotHeadings`（顶层章节号 1..N 连续 + 字面 x 占位标题检测），堵住「章节删节未重排」盲点。
- **P1-4 导航表收敛**：`dispatch-matrix.md` §6.4 补全为 31/31 权威登记表（新增/改名门禁脚本只登记一处）；AGENTS.md §2 巨型脚本枚举（~5000 字符）压缩为指针（见 §8 + dispatch-matrix §6），消除唯一整表重复；新增 `script-registry` 检查（全部 cli 脚本名须登记于 dispatch-matrix + SKILL「N 个 .ts」计数一致）。
- **P1-5 eval 状态如实化**：`eval/README.md` 标注「评估暂停中」（v36.0.0~v41.16.0 未外部盲评）+ 待评估版本表 + 恢复评估指引，不再假装闭环在跑。
- **P1-6 硬编码税最小化**：`REQUIRED_PATHS` 补「新增活体文档契约」注释（26 项）+ exit-2 工具数具名常量；`CONTRIBUTING.md` 数字一致性条删陈旧 `EXPECTED.currentVersion` 引用、改指 version:bump。
- 测试增长：vitest 623 → **634 条**（新增 ssot-headings / script-registry / version-consistency CHANGELOG 用例）；同步 README/AGENTS/pre-push 计数表述。
- `check-docs-consistency.ts` REQUIRED_PATHS 增 `dispatch-matrix.md` 与 `CHANGELOG.md`。

## [41.15.0] - 2026-08-14

### Changed

- 版本号 41.14.0 → 41.15.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **README/AGENTS/INSTALL/SSoT 文档同步批次（目录结构等）**：
  - README 项目结构树补 docs/ 缺项（user-guide / troubleshooting / index.html + _sidebar.md / changes/decision-log/；docs/api 注明为 gitignored 生成物）+ 根级 config/、scripts/setup-hooks.cjs、.eslintsecurity-baseline.json；.githooks 行补「16 项」
  - SSoT 追溯表补 7.6A 行（self-as-verifier demo-only 例外：独立产物路径 + Persona 切换 + 反模式 #35 守护）
  - AGENTS §1 补 self-as-verifier 例外指针（SSoT §7.6A）；§2 docs/ 行补排障/用户指南与 docs/api 生成物说明
  - INSTALL 目录树补 skill-metadata.json 行
  - docs/api 本地产物重生成（`npm run docs:build`；docs/api 为 gitignored 生成物，不入库）

## [41.14.0] - 2026-08-14

### Changed

- 版本号 41.13.0 → 41.14.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **self-as-verifier 措辞加固（设计观察 #5）**：
  - SKILL.md self-as-verifier 节新增「偏置缓解」要点：V 评审须切换与 S 产出视角不同的 Persona 提示词 + VerifierOutput `summary` 注明所用 Persona；明确「不消除自我偏置，仅限 demo/教学」
  - verifier-spec §13 补 demo-only 边界复述（原仅 SKILL.md 一处）+ 第 4 条「评审视角独立（偏置缓解）」
  - command-reference `/wm review` 节补 `--self-as-verifier --s-output=<S产出路径>` 参数文档（此前命令参考无该 flag 说明）
  - check-verifier-output.ts 头注释「本脚本自评模式」→ 准确的路径独立性校验措辞（与实现语义一致）
  - **SSoT 补 §7.6A self-as-verifier 模式（demo-only 例外）**——修复 decision-log 声称「SSoT 已新增该节」但正文缺失的文档-实现缺口
- **复杂度收敛引导（设计观察 #6）**：SKILL.md 触发决策节新增「任务规模适配（轻量路径）」小节（极小任务 → L0 交付层 + self-as-verifier + maturity L0/L1；生产小项目 → L2；常规生产 → L3；红线：轻量 = 门禁降载而非跳过阶段）+ SSoT §11A.6 权威段落

## [41.13.0] - 2026-08-14

### Changed

- 版本号 41.12.0 → 41.13.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **format 幂等性修复 + 防复发门禁**：
  - 根因：prettier 版本无漂移（3.9.6 三处一致）；「npm run format 重排 100+ 文件」实为默认 endOfLine=lf 与 Windows CRLF 工作树的行尾归一化 churn，真实格式漂移仅 7 个文件（artifact-gate-assets / phase-doc-map / read-json-or-exit / uat-path-mapping / verifier-logic 五个测试 + check-bdd-model / check-samples-coverage 两个 CLI）
  - `config/prettier.config.cjs` 增加 `endOfLine: 'auto'`（Windows CRLF / WSL LF 双兼容，不改变检出行为）
  - 全量 `npm run format` 统一格式化 7 文件 + `security-scan --regenerate` 重生成 baseline v2（282 → 280 条目）
  - **pre-push 新增第 16 项「prettier --check」格式一致性门禁**：任何 .ts/.cjs 编辑未跑 format 即被阻断，从根上堵住格式漂移复发
  - **15→16 计数级联**：EXPECTED.prePushCount、docs-consistency 测试 fixture、README / AGENTS / CONTRIBUTING（门禁表 +16 行）/ troubleshooting / pre-push 注释全部同步

## [41.12.0] - 2026-08-14

### Changed

- 版本号 41.11.0 → 41.12.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **文档一致性门禁动态化（消除「文件系统 ↔ EXPECTED 常量 ↔ 文档」三方同步）**：
  - `checkVersionConsistency`：package.json 为版本唯一源，其余四处声明与之比对；删除 `EXPECTED.currentVersion`（版本提升不再需第 6 处代码同步）
  - `checkReferencesCount`：期望值改从 SKILL.md「（N 个 .md）」表述解析，与实测比对
  - `checkAssetCounts`：期望值改从 README「N 个人格文件」表述解析，与实测比对
  - `checkVitestFileCount`：期望值改从 README「N files」/ AGENTS「N 个 .test.ts」表述解析（实测须命中声明集）
  - `checkExit2ScriptCount`：期望值改从 AGENTS「N 个脚本」表述解析，与实测比对
  - 删除死代码 `EXPECTED.schemaCount`（schema 检查早已用动态 `schemaFiles`）
  - docs-consistency 测试：baseInput 补 persona token + package.json 漂移用例语义改写（源漂移 → 其余四处报违规）+ 4 个「文档方向」新用例（51 条）
- **README:116 退出码标注漂移**：check-code-tla-consistency.ts「退出码 0/1」→「0/1/2」（全仓唯一漂移点；docs-consistency 只查计数不查退出码标注的盲区）
- ****tests**/README pure/IO 边界与实现对齐**：gate-logic.ts 标注为唯一例外（nodeFsAdapter 依赖注入做 spec 目录 IO）；检测命令补 `from 'node:path'` 并排除 gate-logic.ts；coverage 矩阵「vitest 35」→「vitest 40」
- **计数级联**：vitest 619 → **623 条**（+4 个 docs-consistency「文档方向」新用例）；README/AGENTS/CONTRIBUTING/INSTALL/troubleshooting/pre-push 计数全部同步（动态门禁自动校验捕获，无需再同步 EXPECTED）

## [41.11.0] - 2026-08-13

### Changed

- 版本号 41.10.0 → 41.11.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **遗留五项收尾**（41.10.0「明确不做」清单）：
  - **technical-writer 占位符规范化**：4 个围栏交付物模板各加「占位符说明」注记；5 处坏 URL 占位（`[工具 X](链接)`、`(链接)` 等）改为合法示例 URL（example.com / docs.npmjs.com）；标准占位（your-package、RFC 2606 示例域、[目标成果] 等）保留
  - **--json 声明张力统一（26 个 check-\*.ts 实测，非 8 个）**：--json 参数说明改为「stdout 仅输出单行报告——exit 0/1 为纯 JSON（可整体 JSON.parse）；exit 2 为 ERROR_JSON {...} 单行（带 ERROR_JSON 前缀，见 command-reference.md「错误码与 ERROR_JSON 约定」节）」；实现不动（ERROR_JSON 前缀为权威约定）
  - **批量任务编号注释自解释化（96 处）**：`B4 --json`×50 去前缀；B5/B6/B8/B3 → 直接描述；`A2b 双轨过渡`×19 → 「结构化违规双轨」；Task A1/批次3 Task7/Task 5/Task 3 → 直接描述；借鉴点 2/3/4 ×12 → 直接描述（Schema 前置校验/内容敏感指纹 diff/版本号双写一致性）；规则 ID 与 spec 文件指针保留
  - **readJsonOptional 死导出删除**（零生产调用）：lib 函数 + 3 条测试移除；**tests**/README 矩阵行补登记 readJsonlOptional / readJsonClassified / loadAndValidate
  - **lib 层 4 模块专属测试**（constants / phase-doc-map / uat-path-mapping / artifact-gate-assets 各 1 个测试文件，41 条用例；runModelChecks 用 vi.mock('node:child_process') mock spawnSync，CLI 集成侧由 pre-push 第 3/7/8 项覆盖）
- **计数级联**：vitest 36 → **40 文件** / 581 → **619 条**（-3 死导出测试 + 41 新 lib 测试）；EXPECTED.vitestFileCount、docs-consistency 测试 fixture、README/AGENTS/INSTALL/CONTRIBUTING/troubleshooting/pre-push 计数全部同步；**tests**/README 矩阵 +4 行

## [41.10.0] - 2026-08-13

### Changed

- 版本号 41.9.0 → 41.10.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **全仓校核修复批次**（4 路并行审计 8 高 / 23 中 / ~14 低，按「以实现为事实源」原则修复）：
  - **高**：dispatch-matrix 补 check-iceberg-sweep（§6.2 通用脚本表 + §7 #44 守护行 + §4 ICEBERG-A/B 说明）；`lib/read-json-or-exit.ts` 4 处 exit 路径统一经 `exitWithError` 输出 ERROR_JSON（14 个 CLI 头注释契约补全；read-json-or-exit.test.ts 同步断言；check-preventive-review/check-iceberg-sweep 绕行注释更新）；CONTRIBUTING 六处陈旧计数（571→576×3、252→254×3）；SSoT §10A 追溯表死节名指针 +「10 个 →12 个 /wm 命令」；user-guide/pre-push/dispatch-matrix 的 E1-E8→E1-E9 ×3；examples/stage1 C1~C9→C1-C10；operational-recovery 锚点死链改无锚点链接
  - **中**：SSoT 死指针/误指清零（verifier-spec §7.6→§1、§10E→§10.8 ×2、「17 条→47 条」演进叙事 ×2、§932/§2219 历史叙事注改现状陈述、「候选反模式检测信号」→「C1（候选）」节 + anti-patterns TOC 对齐）；tla-plus-modeling-design 4 处 `--skip-tlc` 对齐「已移除」；skill-design-document §14/§15 结构描述；troubleshooting 558→576；loop-engineering-design 计数快照（17→47 ×7、37→254）+ SSKILL 笔误；README 树移除 3 个已移出吸收文档 + L1~L4 残留 + 补 /wm hill-climbing；INSTALL lib 9→12 + exit-2 构成口径；references 9 处（SKILL.md 节名 ×2、S 变体 8→10、workflow 拆出节名 + 阶段 3/4 产物 ID 前缀 INTF/DD、real-run-evidence 41.5.0→41.9.0、subagent-delegation 锚点、9→10 脚本自检 ×2、dispatch-matrix #21 守护去「run-log R5」）；**signature-chain-logic 入口补 validateBySchema**（反模式 #28 对齐；schema sigId 模式补 P2-/序号变体；self-test/vitest 期望同步）；**新增 maturity-logic.test.ts**（R1-R5 + schema 前置，vitest 35→36 文件 / 576→581 条级联同步）；check-requirement-graph 头注释补 --rtm/--exemptions；bdd-logic exitCode:2 语义注释、check-preventive-review 头注释对齐实现、check-iceberg-sweep CLI「R3」改名
  - **仓库卫生**：git rm `samples/tla-e2e/states/` 4 个 TLC 残留 + .gitignore 补规则；samples/README 矩阵 3 行条数修正（GATE 20 / TLA 15 / BDD 11，合计 253）
  - **低**：AGENTS §2 补 2 个漏列脚本；dispatch-matrix §3 补 check-tla-bdd-sync（阶段 1-4 S-tla 行）/ check-design-contract-consistency（阶段 8）+ §5 ensure-codegraph-opsx 说明；归档目录补第 5 个（README 树 + AGENTS 表）；「§4 约束 N/SSoT 约束 N」前缀 → 硬约束 #N（SSoT ×4 + adoption-guide ×8）；persona 文件 `project-management-experiment-tracker.md` → `project-experiment-tracker.md`（对齐矩阵短名）；SKILL.md templates 行补 budget.template.json / run-log.template.jsonl 全名；脚本注释类 8 处（Round 24 残留、人类可读报告声明 ×2、violations→reasons ×3、bdd [D2] 标签 ×2、run-log-logic「不 import」旧文案、check-run-log 头注释补 R8 + usage 补 --json、parse-phase 13 口径）
  - **明确不做**（观察清单）：technical-writer 围栏内占位符（示例样板合理）；B4/A2b 等批量任务编号注释（内部批次标识可追溯）；--json 模式 exit 2 单行张力（8 脚本一致固有）；readJsonOptional 公开 API；lib 层 4 模块无专属测试

### Docs

- SSoT §4A.2b/#7.6/#12.4 演进叙事改写为当前事实陈述；troubleshooting/CONTRIBUTING/design-docs 计数与事实对齐

## [41.9.0] - 2026-08-13

### Changed

- 版本号 41.8.0 → 41.9.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **文档层 + 脚本层去历史化全量清扫**（历史只由 CHANGELOG 体系承载；41.7.0 已清 references/templates，本轮扩展至 scripts/** 与全部根文档）：
  - **脚本层**（logic 18 / lib 12 / cli 12 / **tests** 18，共 60 文件）：删除注释、usage 帮助文本、运行时展示文本、describe/it 名称中的「（第 N 轮）」「[x.y.z]」「第 N 轮新增/升级/移入」标注与演进叙事（如「第 N 轮调测发现 X」）；schema 3 份 description 字段同步（enum/required/type 等约束字段零改动，run-log action enum 27 值零改动）；规则 ID（R1-R10 / D1-D8 / C1-C10 / E1-E9 / P2.5 / R13 等）与「已废弃」「无条件强制」「no-op 向后兼容」等现状声明保留
  - **文档层**（SKILL / references 37 / templates 5 / examples / subagent / docs 6 / README / AGENTS / CONTRIBUTING / pre-push 共 54 文件）：删除残留轮次标注与「第 N 轮由 SKILL.md 移入」句；41.8.0 批次遗留的历史归档指针（「已归档至 legacy-sections.md」等）统一删除，导航由 CHANGELOG/decision-log README 承担；演进叙事（「与原计划的差异」等）改写为当前事实陈述；pre-push「与原 CI 一致」→「全部门禁共 15 项检查」
  - **收尾修正**：checkpoint-logic 运行时消息、docs-consistency 违规消息、docs-consistency 测试 fixture 中的版本/轮次残留清零；verifier-spec rootcause 枚举行「新增」→「—（无旧值映射）」；README 门禁增强历史导航句去轮次
  - **保留项（B 类设计事实/导航）**：规则 ID、反模式 #N、约束 #N、SSoT §X 指针、文件指针、hard-constraints「原约束 #XX 并入」注记、「已废弃/已移除」现状声明、ISO 时间戳、docs/changes/archive 目录名中的 roundN（归档目录名不可改）、examples/real-run-evidence 快照版本元数据
- **门禁必需字符串复核**：anti-patterns `| 47 |` / `#1~#47`、hard-constraints `## #1`~`## #14`、operation-behaviors 八条表、DoD 七维度标题、data-models Schema 清单 20 份、glossary action 枚举、SKILL「（53 个 .md）」、SSoT 4A.1 权威标题、README/AGENTS/pre-push vitest 计数等全部原样保留

## [41.8.0] - 2026-08-13

### Changed

- 版本号 41.7.0 → 41.8.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **文档-实现一致性全量修正批次**（三路 Explore 扫描 + 逐条核验，以脚本实现为事实源）：
  - **规则编号漂移修正**：run-log 文档 R1-R7 → R1-R8（R8 轨迹模板校验早已实现）；BDD 文档 D1-D7 → D1-D8（D8 SD Coverage；workflow/templates×4 同步）；豁免文档 E1-E8 → E1-E9（E9 时间戳时序；SKILL/hard-constraints/phase-1/operational-recovery/anti-patterns/user-guide/exemption-logic 头注释同步）
  - **iceberg 规则重编号 R1-R8 → R1-R5**：原 R5-R8（轮次边界/去重/可证伪/passed 一致性）重排为 R2-R5，消除 R2-R4 编号空缺；logic 注释 / schema 描述 / self-test 用例描述 / iceberg-logic.test.ts / SKILL/AGENTS/anti-patterns/samples 矩阵同步
  - **S-ingest R3 门禁变体补全**：check-preventive-review.ts 新增 `--variant=ingest`（路径前缀 `<phase>-ingest-{dim}.json`）；hard-constraints/subagent-delegation S 变体清单 8 种 → 10 种（补 S-ingest-tla / S-ingest-bdd）；dispatch-matrix §6.1 同步；preventive-review-logic.test.ts 补 ingest 用例
  - **rootcause targetKind 补全（消解三方矛盾）**：verifier-logic SUB_CRITERIA + verifier-output.schema.json enum 增第 5 种 `rootcause`（§7.5 子标准：correctness 0.25 / completeness 0.25 / falsifiability 0.20 / actionability 0.15 / prevention 0.15）；verifier-spec §2.2/§2.3 重写；anti-patterns #19 检测信号与 dispatch-matrix §4 得以成立；新增 valid/bad rootcause 样本 + verifier-logic.test.ts 4 用例
  - **死锚修正**：anti-patterns.md TOC 三个不存在节（L1~~L4/F1~~F10/O1~O6）改引真实位置（operation-behaviors.md / SSoT §4A.2a / decision-log/legacy-sections.md）；SSoT:599/604/634/640/1969 同步；operation-behaviors:21/36、definition-of-done:59、user-guide:76 同步；#43 两处死锚改指「敏感信息禁令（第三十一轮）」节
  - **SSoT 计数与 typo 修正**：「28 条流程反模式（#1-#19+…）」→「47 条（#1~#47）」×3；「守护反模式 #3/#8」→「#18/#19」×5
  - **闭环脚本 4 → 5 全线统一**：SKILL.md:214 / quick-self-check / workflow / operational-recovery:443 补 check-preventive-review（约束 #11 无条件）
  - **verifier-spec 修正**：variance 重算阈值 §3.2/§11.3 `1e-4` → `1e-6`（对齐 §3.2.1 规则 2 与 VARIANCE_EPSILON；compositeScore 的 1e-4 独立不受影响）；TOC 补 §13；§6 注释「≥3 项」→「==5 项」；§8.0 占位符枚举补 rootcause / 子节号 1-5
  - **过时机制清理**：subagent-persona-matrix §7 移除已废弃 emergencyFixReview 事后复核机制（改由前置 R3×3 + V 兜底）；:93 parallelPersonas 死引用删除
  - **dispatch-matrix 补齐**：阶段 1 补 check-requirement-coverage、阶段 1-4 补 check-tla-bdd-sync、阶段 8 补 check-design-contract-consistency；§3 阶段 4 S-doc 加载 design-patterns-catalog；O 通用加载补 estimation-guide / context-management-guide
  - **模板计数修正**：quality-standards / phase-8「12 个模板」→「13 个」；SKILL.md Bundled Resources 补 schemas/、tools/ 行 + system-test / bdd-manifest.template.json；「6 独立子模板」→「每阶段 6 独立子模板（跨阶段共 10 种）」（SKILL/AGENTS/README）
  - **交付层清单修正**：L1 增加 `tools/`（tla2tools.jar，TLA+ 门禁运行时依赖）——SKILL.md:19 + INSTALL.md §2 交付层表与目录树同步
  - **孤儿 references 补入口**：estimation-guide → phase-1「执行方法论」；context-management-guide → operational-recovery 自检清单；design-patterns-catalog → phase-4「类设计规则引用」
  - **DoD 格式修复**：definition-of-done.md 七维度表补第 7 行（签名链完整性）+ 空粗体「****」修复为「代签判定」
  - **陈旧注释修正**：docs-consistency-logic 注释「57」→「53」×2 + EXPECTED.currentVersion 41.8.0；check-docs-consistency「合计 30」→「31」；run-log-logic「R1-R7」→「R1-R8」；self-test.ts 头部样本目录清单补全为 26 组
  - **samples/vitest 基线增长**：self-test 252 → 254（verifier rootcause 样本 ×2）；vitest 用例 +5（iceberg 重编号无增、preventive ingest +1、verifier rootcause +4）
  - **测试矩阵补齐**：**tests**/README.md 补缺 2 行（docs-consistency-logic / iceberg-logic）+ run-log R8 / preventive ingest / verifier rootcause 描述同步
  - **杂项**：AGENTS.md §8 导航表补 wm-status/metrics-report/security-scan 3 行、移除 gate-enhancement.test.ts 行、`--r3-enabled` 语义修正（无条件 R≥3，flag 为 no-op）；删除 w-model-dev/docs/superpowers 空目录残壳
- **决策记录**：文档与实现矛盾一律「以脚本实现为事实源」回写文档（防漂移门禁已强制计数，本轮补齐编号语义）；L1~L4 教训按 41.7.0 归档决策继续指向 legacy-sections.md，不恢复正文

### Docs

- SSoT §4A 反模式计数与实现位置同步；verifier-spec §2.2/§2.3 rootcause 枚举补全

## [41.7.0] - 2026-08-13

### Changed

- 版本号 41.6.0 → 41.7.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **全仓 md 文档去历史化（架构决策：文档只承载设计事实，历史统一由 CHANGELOG 体系承载）**：
  - **SSoT 纯净化**：删除 §3.4.7-47 全部轮次记录区（~890 行）、§10A 追溯表 37 行轮次行、§10B 参考实现调测史、§14/§15 tombstone；§3.4.1-6 当前定义区与主题章节去轮次标注（~30 处）；历史缺陷引言（§10E/10I/10J/10.10 等 7 处）删除保留规则句；新增「设计决策历史」索引节（指向 decision-log 与 CHANGELOG）；§1.4 参考实现注改指针
  - **新建 decision-log 归档**：`docs/changes/decision-log/`（README 轮次→版本映射 + rounds-09-39 + rounds-40-47 轮次记录原文 + absorptions 4 份吸收决策记录 + legacy-sections 历史段落），原文保留不篡改
  - **根文档去历史化**：AGENTS.md §7 修复记录整节删除（内容已由 CHANGELOG 体系承载）；README/AGENTS/INSTALL/adoption-guide 参考实现节去轮次/指标/修复记录（保留归档导航链接）；SKILL.md 8 处轮次标注去标注
  - **references/templates 批量去标注**：329 处「（第 N 轮）」「[x.y.z] 新增」等 C 类标注清除（规则本体保留，B 类导航指针保留）；A 类叙述（「第 N 轮调测发现 X」等 ~20 处）删除；anti-patterns「实现层经验教训」节与 hard-constraints「编号迁移表」归档；references 中 27 处「SSoT §3.4.7+」轮次指针清理（指向已删节，改指当前定义或删除）
  - **4 份吸收决策文档归档**：four-source / mythical-man-month / external-skills / clean-code-refactoring-agentic absorption 从 references/ 移入 decision-log/absorptions.md（references 57→53，referencesCount 门禁联动）
  - **数据漂移修复**：CONTRIBUTING（249→252 ×3、14→15 项 + 补第 15 行编号表、去「与原 CI 一致」）；user-guide（249→252）；troubleshooting（14→15 ×2）
- **决策逆转记录**：SSoT 按轮次记录设计的旧模式（曾于 41.6.0 以「不篡改演进史」原则保留轮次区）→ 全仓去历史化新模式（CHANGELOG 体系唯一历史承载，SSoT/README/AGENTS/references 只含设计事实）；轮次记录原文无损归档于 decision-log

### Docs

- SSoT 新增「设计决策历史」索引节；CHANGELOG 顶部补 decision-log 指针

## [41.6.0] - 2026-08-13

### Changed

- 版本号 41.5.0 → 41.6.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **SSoT 权威性审查修复**（三路 Explore 全面一致性扫描，41.4.0/41.5.0 两轮变更后核验）：
  - **修 SSoT 内部互斥**：§3.4.3 阶段门 / §3.4.6 P1.2 的 TLA+ 强制门槛（「无例外」绝对式）与 §3.4.44 P1-3 成熟度开关（L1 可选 / L2 / L3）对齐——当前章节补分级说明，P1.2 标题改「按成熟度分级（约束 #13）」
  - **修活体指针**：AGENTS.md 错误结构指针由 §3.4.30 补为「§3.4.30（全量归一化）+ §3.4.42（CliError rule/field，当前定义）」
  - **修 §10A 追溯表**：补缺 §3.4.42 行（CHANGELOG [41.2.0] 声称有而实际缺失）+ 修复 §3.4.36/37/38 三行残缺（2 列 → 完整 4 列，自轮次记录提取补全）
  - **修标题层级**：§3.4.40-46 标题 `###` → `####`（与 §3.4.7-39 轮次记录层级统一，消除 h3/h4 混排）
  - **双副本权威声明**：SSoT §4A.1（八条操作行为）/ §10.6（DoD 七维度）表头标注「权威源 = operation-behaviors.md / definition-of-done.md，本表为摘要副本」；§7 数据模型标注「结构权威 = data-models.md」
  - **历史决策逆转指针**：§3.4.44 关键决策④（C7 重申）追加「已于 41.5.0 §3.4.46 O1 逆转」标注，防误读为现行决策
  - **samples/README.md 基线同步**：头部「249 条回归基线」→「252 条」（41.5.0 轮遗漏，SSoT §3.4.46 已记录 249→252）
- **审查结论**：SSoT 核心职能仍成立（数字全部一致 / 当前状态声明零漂移 / 零死链），无需重写；本轮为止血修复，恢复「当前章节 = 最新决策」的权威一致性

### Docs

- SSoT 新增 §3.4.47 第 47 轮记录 + 追溯表行

## [41.5.0] - 2026-08-13

### Added

- **samples 覆盖矩阵门禁（T1）**：新增 `check-samples-coverage.ts`——自动核对 `samples/` 每个 fixture（文件/嵌套目录）被 `self-test.ts` 用例数组（file / sampleDir / manifestFile / featureFiles 字段）引用，且每个子目录在 `samples/README.md` 覆盖矩阵声明；堵住「新增 fixture 遗忘登记」（未登记 fixture 不参与任何检查，self-test 仍全绿）。新建成 `samples/README.md` 覆盖矩阵（26 子目录 × check 脚本 × 用例数组）；pre-push 第 14 项后新增第 15 项（prePushCount 14→15，docs-consistency EXPECTED 与 README/AGENTS 同步）
- **真实命令证据示例（T2）**：新建 `examples/real-run-evidence.md`——5 个真实门禁命令的 exit 0/1/2 三态输出实录（check-verifier-output / check-requirement-graph / check-samples-coverage）；4 份对话类示例（coding / requirement-analysis / system-design / test-execution）头部标注「伪示例，仅供 LLM 行为对齐」，虚构数字（95% 覆盖率 / 18-18 / 50-50）改为「以真实运行器为准」；coding.md 删除 `echo > .env` 反模式示例（改为环境变量注入两方式）；test-execution.md 质量门语义修正

### Changed

- 版本号 41.4.0 → 41.5.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **孤儿样本登记（check-samples-coverage 首跑发现）**：`samples/` 5 个全仓零引用 fixture——登记 3 个有效样本进 self-test.ts（gate/bad-phase5-codemodule-format → GATE_CASES phase5 codeModule 格式校验；tla/bad-coverage-uncovered-sd → TLA_CASES SD 覆盖完整性；bdd/bad-d8-uncovered-sd → BDD_CASES D8 SD 覆盖）；删除 2 个「名字与实际行为不符」伪样本（gate/valid-phase5-with-uat-path-mapping、gate/bad-phase5-missing-uat-path-mapping）；self-test 基线 249 → 252 条（README / AGENTS / INSTALL / pre-push 同步）；exit-2 脚本计数 30 → 31（新增 check-samples-coverage，AGENTS / SKILL.md / INSTALL / docs-consistency EXPECTED 同步）
- **Markdown 去重（A2 收敛版）**：AGENTS.md §6「编排者最小化」与 §1 同文件双份 → 精简为一句 + 指针；INSTALL.md 安装步骤引导段与 §1/FAQ 重复的角色描述 → 指针化；SKILL.md 内联 14 行硬约束摘要表**保留**（编排入口速查价值，评估结论记录于 SSoT §3.4.46）
- **CHANGELOG 批次拆分（A5）**：41.2.0 的 P0/P1/P2 工程化批次（27 项 Changed + 3 修复 + 文档同步，均不涉及版本语义）移入新建 `docs/changes/engineering-batches/2026-08-11-p0-p2-batches/README.md`；[41.2.0] 条目精简为版本语义 + 批次指针；清理 `docs/changes/` 空目录残留
- **移除 npm workspaces（O1）**：删除根 package.json `workspaces` 字段 + `w-model-dev/package.json`（C7 决策逆转——子包零依赖、全仓零包名引用、createRequire/tsconfig/vitest/pre-push 均不依赖 workspace，空包无实际作用）；INSTALL.md FAQ 改为单根包表述；SSoT §3.4.46 记录决策逆转理由

### Docs

- SSoT 新增 §3.4.46 第 46 轮记录 + 追溯表行

## [41.4.0] - 2026-08-13

### Changed

- 版本号 41.3.1 → 41.4.0（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例）
- **cli/ 分层修正（评审 N1）**：`cli/artifact-gate-assets.ts` / `cli/uat-path-mapping.ts`（check-artifact-gate 拆出的 IO 解析模块）移入 `lib/`；`check-artifact-gate.ts` import/re-export 同步；exit-2 脚本计数 30 不变，`check-docs-consistency` 与 `docs-consistency-logic` 注释修正（5 工具 = 4 工具 CLI + `logic/plan-chunks.ts`，self-test.ts 非 exit-2 不计入）；SKILL.md Bundled Resources `scripts/cli/` 表述改为「30 个 .ts：25 个 check-* 门禁 + 5 个工具 CLI」
- **references 计数修正 + 门禁（评审 D1）**：SKILL.md「references/（53 个 .md）」→「（57 个 .md）」（第 44 轮新建 4 篇未同步）；`check-docs-consistency` 新增 **references-count 检查项**（`EXPECTED.referencesCount=57` + 实测 .md 数 + SKILL.md 表述三重比对，镜像 personaCount 模式）
- **TLA 轨迹清理工具跨层修正（评审 N2）**：`cleanTraceFiles` / `isTlcStatesDir` 自 `cli/check-tla-model.ts` 移入新建 `lib/tla-clean-trace.ts`（IO 辅助归 lib/，logic/ 保持纯函数约定）；`tla-clean-trace.test.ts` import 同步
- `dispatch-matrix.md` 数据来源行移除过时版本号 35.0.0（评审 D2），改为「随版本演进，以当前 SKILL.md 为准」
- AGENTS.md 角色表述澄清（评审 A4）：六类角色 = O（编排者）+ 五类子代理（A/S/V/G/R；R 含 R-iceberg 变体）
- AGENTS.md `docs/` 行声明 `docs/superpowers/` 为内部规划目录（评审 O3），不参与门禁、非面向用户
- 新建 `w-model-dev/tools/README.md`（评审 A6）：tla2tools.jar 版本（TLC2 2.19 of 08 August 2024）/ 来源 / license / 同步策略，权威记录指向 `references/tla-plus-guide.md`

### Docs

- SSoT 新增 §3.4.45 第 45 轮记录 + 追溯表行

## [41.3.1] - 2026-08-13

### Changed

- 版本号 41.3.0 → 41.3.1（**五处一致**：package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」/ docs/INSTALL.md 激活示例；41.3.0 发布时 README 未同步导致漂移，本轮补齐并加门禁防再漂）
- `check-docs-consistency` 新增 **version-consistency 检查项**：`EXPECTED.currentVersion` + 五处版本声明全量比对（package.json / skill-metadata.json / SKILL.md frontmatter / README「当前版本」行 / docs/INSTALL.md 激活示例），任一漂移或不可解析即 exit 1；`REQUIRED_PATHS` 增补 package.json / skill-metadata.json / docs/INSTALL.md；CONTRIBUTING「数字一致性」表述由「三处」更新为「五处」
- `skill-metadata.test.ts` 新增第 5 个用例：README / INSTALL.md 版本与 package.json 一致（五处镜像断言）
- 模板占位符统一：7 份阶段模板 SSOT 头「文档版本」由 `v{{1.0}}`（字面+部分占位）统一为 `{{v1.0}}`（全段占位，与元数据区 9 处既有风格一致）；`format-conventions.md` 新增 §7「模板占位符语法」规范（全段占位约定 + 固定占位符表 + 检查）
- docsify 离线降级：`docs/index.html` 新增 `<noscript>` 提示 + CDN `onerror` 兜底文案（离线/断网白屏时给出解释与本地预览指引）
- **SKILL.md 减负 524 → 216 行**：硬约束完整版 → 新建 `references/hard-constraints.md`；八条操作行为 + F1-F10 → 新建 `references/operation-behaviors.md`；自检清单 → 新建 `references/quick-self-check.md`；顶部 5 段方法论 → 新建 `references/design-philosophy.md`；Bundled Resources 四表压缩为目录级索引；阶段门/质量门说明压缩。`check-docs-consistency` 联动：`checkOperatingBehaviors` 改指针模式（防内联回退），新增 `checkHardConstraints`（## #1-## #14 编号连续性 + SKILL.md 指针）
- **硬约束 21 → 14 条重排**（第 44 轮）：#9 TLA+ 与 #14 BDD 合并为「#13 行为门禁按成熟度分级」；#20 codegraph 与 #21 回归合并为「#14 代码改动前后门禁」；#15/#16/#17/#18/#19 分别并入 #10/#2/#11/#3/#8。全仓活体文件 326+ 处「约束 #N」/「约束 N」引用同步重编号（归档 docs/superpowers、docs/changes、eval 历史记录不动）；`hard-constraints.md` 附「编号迁移表」
- **TLA+/BDD 成熟度开关**（约束 #13 可执行化）：L1 教学/demo 可选 / L2 生产小项目 TLA+ L1 + BDD L1 必跑 / L3 全必跑；编排层开关（非脚本参数，`--skip-tlc` 禁令维持）；`operational-recovery.md` 新增「成熟度与行为门禁」节
- **L0/L1 双交付层**：SKILL.md 顶部「交付层」说明 + INSTALL.md §2「交付层选择」表（L0 纯 Markdown 零依赖拷贝即用 / L1 带门禁需 `npm install`）
- `w-model-dev/test-prompts.json` 删除（14 条孤儿文件，无任何文档/脚本引用；评估场景以 `eval/w-model-dev-test-prompts.json` 15 条为准）
- `CHANGELOG.md` 拆分：41.0.0 之前（含 40.x 及更早）历史条目移入新建 `CHANGELOG-archive.md`（2169 行 → 80 行）
- anti-patterns.md 新增「反模式-硬约束映射」表（14 条硬约束 × 47 条反模式双向定位 + 高频标注）
- vitest 计数 558 → 571（新增 13 条单测），README / AGENTS.md / INSTALL.md / CONTRIBUTING.md / pre-push 同步

### Docs

- SSoT 新增 §3.4.44 第 44 轮记录 + 追溯表行

## [41.3.0] - 2026-08-13

### Changed

- 移除 `.cursor/skills/` 技能包资产残留引用（目录已在 e74b886 中删除，12097 行）：`check-docs-consistency` 门禁解耦——`REQUIRED_PATHS` 移除 `.cursor/skills`（此前缺失直接 exit 2 阻断每次推送）、`EXPECTED` 移除 `cursorSkillCount=23`、`checkAssetCounts` 单参数化（仅 persona）、目录计数删除；`.githooks/pre-push` 变更过滤移除 `.cursor/skills/**` 分支与触发条件注释；AGENTS.md 导航表 / README.md 结构树与 pre-push 注释清理；references 5 处死链修复（phase-5-coding 删除空「相关资源」节、phase-4-detailed-design / anti-patterns / subagent-delegation×2 去链接保留文字、verifier-spec 重定向到技能包内 agent-personas.md）
- 版本号 41.2.0 → 41.3.0（三处一致：package.json / skill-metadata.json / SKILL.md frontmatter；INSTALL.md 示例同步）
- `.gitignore` 追加 `.cursor/`（与 `.claude/` 同款，防误跟踪）

### Docs

- SSoT 新增 §3.4.43 第 43 轮记录 + 追溯表行

## [41.2.0] - 2026-08-10

### Added

- 四源吸收 P2（10 项）：subagent-persona-matrix 证据加权共识、verifier-spec 验证器定位三原则（编辑者非作者/调节器不关心原因/运行系统最短路径）、anti-patterns 候选转正评审判据 + 错误聚集/超标丢弃说理、hill-climbing 爬山法哲学基础、tla-plus 不连续系统穷举「为什么」、operational-recovery 集成混沌预期 + 超标重写、quality-standards 硬约束=结构来源 + 满意化完成、phase-7 可观测性验收标准、SKILL.md 受控的失控 + clockware/swarmware 选择法则

### Changed

- 版本号 41.1.0 → 41.2.0
- P0/P1/P2 工程化批次（2026-08-11 ~ 2026-08-12，不涉及版本语义）已拆分归档至 [`docs/changes/engineering-batches/2026-08-11-p0-p2-batches/`](./docs/changes/engineering-batches/2026-08-11-p0-p2-batches/README.md)（scripts 四层重组 / check-artifact-gate 拆分 / violations 双轨结构化 / --json 可观测性 / config 集中 / vitest 覆盖率入 pre-push / npm Workspace 等 27 项 + 3 项修复 + 文档同步）

### Fixed

- （批次内修复见 engineering-batches 归档：A6 历史归档恢复 / 54 处旧脚本路径修正 / security baseline 重生成）

### Docs

- SSoT 新增 §3.4.42 第 42 轮 P0-P2 批次记录 + 追溯表行（批次详情见 engineering-batches 归档）

## [41.1.0] - 2026-08-10

### Added

- 四源吸收 P1（10 项）：design-patterns-catalog.md（GoF 23 模式目录 + 对照表 + 决策辅助）、refactoring-catalog 目标结构列、phase-2 架构决策框架（CAP/微服务粒度/事务模式/前提四问）、quality-standards 容错设计检查清单 + 日志规范、verifier-spec Architecture/Security 评审问题、tla-plus-guide 建模场景库（断路器/TCC/SAGA/State）+ Safety/Liveness、security-review 认证授权传输维度、phase-6 补偿/故障注入测试

### Changed

- code-smells-checklist 补子类爆炸/继承破坏封装/Getter-Setter 浅方法
- 版本号 41.0.0 → 41.1.0

## [41.0.0] - 2026-08-10

### Added

- 四源吸收 P0（11 项）：code-smells-checklist 组 X 复杂度症状 + 设计判据条目（信息泄露/时间分解/过度专用/特殊情况爆炸/透传变量/实现文档污染接口/难以描述/难以取名/通用容器滥用/隐藏副作用/为拆而拆）、quality-standards 类设计规则补充（深度优先/多类症/组合拆分四信号/通用专用分离）+ 设计投资节、format-conventions 接口注释必备清单 + 命名一致性三要求、phase-3/4 备选方案对比 + 信息隐藏/下沉复杂性/异常策略三选项、verifier-spec 三信息来源 + 复杂三症状 + 设计三项检查、class-design 模板「方案权衡」必填列
- 候选反模式登记：四源-α 复杂性增量累积 / 四源-β 模式装饰性引用 / 四源-γ 过度 swarm 化 / 四源-δ 纸面理由替代真实门禁（候选区，不正式编号）
- 新 reference：four-source-absorption.md（吸收决策记录，挂 Bundled Resources）

### Changed

- 版本号 40.2.0 → 41.0.0
