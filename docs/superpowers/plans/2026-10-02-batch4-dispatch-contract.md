# 批次 4（派单与流程契约：B4 派单可验证终态+preconditions+eval 语料 + B5 分层反馈回路+无限返工反模式候选）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 给派单简报补上「怎么客观判定完成」（可验证终态）与「开工前什么必须成立」（前置条件）两段契约，并把散落五处的返工轮次治理收敛为 L0-L4 分层反馈回路权威视图 + 登记「无限返工循环」C2 候选反模式。

**架构：** 纯文档机制（D12：无新脚本、无 schema 改动、无 pre-push 项扩）——subagent-delegation.md 两新权威节 + 22 个分派模板同构更新；phase-5 两节交叉引用；hard-constraints.md 候选区 C2（48 活体计数零触碰）；eval 语料 +4 条 L2（id 61-64）；SSoT §10N 摘要节；CHANGELOG 42.9.0。

**技术栈：** Markdown 文档 + JSON（eval 双件套）；无代码改动、无新依赖。

**规格：** [2026-10-02-batch4-dispatch-contract-design.md](../specs/2026-10-02-batch4-dispatch-contract-design.md)（D11-D16 已推定）；跨批次契约：[批次总纲 §4](../specs/2026-09-30-absorption-batches-master-outline.md)（§4.1 ChangeClassification 词汇引用约束）。

> **⚠️ 行号口径**：本文行号采集于 main @ b9a8281d（2026-10-02）。文档编辑任务以内容定位为主、行号为辅。

---

## 与规格的实施事实澄清（采集实证，实施前必读）

1. **模板清单 22 个**（subagent-delegation.md，含行号 @b9a8281d）：`### S` :717、`### V` :743、`### G` :776、`### A-chunk` :816、`### A-cross/A-evolve` :841、`#### S-doc` :875、`#### S-tla` :893、`#### S-bdd` :914、`#### S-ingest-tla` :938、`#### S-ingest-bdd` :962、`#### S-plan` :990、`#### S-coding` :998、`#### S-finalize` :1006、`### R` :1013、`### R3 预防性审查` :1059、`### R-iceberg 冰山扫掠` :1117、`### V 复审根因报告` :1186、`### S 兼 F 修复（返工变体）` :1228、`### R-lead 多角度变体` :1265、`#### S 豁免请求` :1597、`#### R 豁免审查` :1613、`#### V 豁免校验` :1631。全部同构加两段；各模板代码块结构不一（S 模板最全），**逐模板以其既有段落形态最小插入**，不重构模板。
2. **C2 插入点**：hard-constraints.md C1（候选）节 :536-546 之后、`### #28` :548 之前；C2 不入主表（:188-235）、不入配套五表（阶段必读 :144-151 / 映射 :166-182 / 高发阶段 :262-310 / 门禁对应 :314-358 / 检测信号 :371-399）、不入目录 :153-160 的正式清单（仿 C1 仅登记于候选注释，如目录已有候选行则跟随其形态）。
3. **48 活体计数零触碰清单**（本批次一个都不许改）：hard-constraints.md :107（节标题）/ :116 / :120（`#1~#48`）/ :155 / :255；跨文件——SKILL.md:74、operation-behaviors.md:20、quick-self-check.md:102（`#1~#48`）、subagent-delegation.md:155、phase-1-requirements.md:194。gate-count-docs 白名单扫描（绑定 prePushCount=18）会抓漏改——本批次目标就是**一个计数都不动**。
4. **eval 双向 1:1**：`mappings.json` 与 `eval/w-model-dev-test-prompts.json` id 双向相等（runner.ts `crossCheckIds`）；新 4 条 id 61-64 **两侧 scenario 文案一致**；L2 条目不带 category/route；`matrix.routeTotals` {enable:12, ask:8, skip:22} 不动；activation-guide.md **零改动**（L2 不入 guide 双向等式）。语料条目形态参照 id 23/24（`id/scenario/prompt/expected` 四字段，scenario 前缀「新机制：」）。
5. **SSoT 插入点**：§10M（:2362-2378「设计期迷雾登记册与可选能力边界」）之后、`## 10.10`（:2379）之前新增 `## 10N. 派单契约与分层反馈回路（批次 4，2026-10-02）`；§10A 追溯表（:2457 起）按批次 2 先例加行。SSoT:1495 的 §10M 指针不受扰。
6. **subagent-delegation.md 文内目录**（:468-478）与「加载导引」（:450-466）：新增两 `##` 节须同步目录行（加载导引若无逐节清单则不动）。
7. **版本**：package.json:3 `"version": "42.8.0"` → `42.9.0`（规格 §5 表已登记）；CHANGELOG.md 顶部新条目置顶于 `## [42.8.0]` 之前。
8. **ChangeClassification 词汇引用**（总纲 §4.1）：分层反馈回路节若登记返工原因分类口径，只许用 `semantic` / `topology` / `evidence-only` 三词，不得另造近义词；本批次不引入 classification 分流（规格 §3.1）。
9. **AGENTS.md 机制索引**：§1「编排者最小化（Orchestrator Minimization）」段（AGENTS.md:12 附近）加一句派单契约 + 分层回路摘要并指向权威节；§8 脚本导航表**零改动**（无新脚本）。

## 文件结构（改动面锁定）

| 文件                                                                     | 动作 | 职责                                                                                                          |
| ------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------- |
| `w-model-dev/references/subagent-delegation.md`                          | 修改 | 两新权威节 + 22 模板两段 + brief.md 契约行 + §3.3 追加句 + 回填 terminalState + 失败模式表归属标注 + 文内目录 |
| `w-model-dev/references/phase-5-coding.md`                               | 修改 | 「任务分配规则」「返工路径」两节交叉引用                                                                      |
| `w-model-dev/references/hard-constraints.md`                             | 修改 | C2 候选节（48 计数与配套表零改动）                                                                            |
| `eval/mappings.json` + `eval/w-model-dev-test-prompts.json`              | 修改 | 各 +4 条（id 61-64，L2）                                                                                      |
| `docs/skill-design-document_SSoT.md`                                     | 修改 | §10N 摘要节 + §10A 追溯表行                                                                                   |
| `AGENTS.md`                                                              | 修改 | §1 机制索引摘要句                                                                                             |
| `package.json`                                                           | 修改 | version 42.9.0（+版本镜像五文件：skill-metadata.json / SKILL.md frontmatter / README 当前版本 / INSTALL 激活 YAML / package-lock 两处——docs-consistency version-consistency 七处强制口径）                                                                                                |
| `CHANGELOG.md`                                                           | 修改 | 42.9.0 条目                                                                                                   |
| `docs/superpowers/specs/2026-09-30-absorption-batches-master-outline.md` | 修改 | §5 状态表批次 4 登记（收口任务）                                                                              |

**不新增**：脚本 / schema / pre-push 项 / 正式反模式编号 / SKILL.md 与 conventions.md 改动 / routeTotals 触碰。

版本镜像五文件为 version bump 的门禁强制连带（docs-consistency-logic.ts checkVersionConsistency），非机制改动。

---

### 任务 1：subagent-delegation.md 权威节两处

**文件：** `w-model-dev/references/subagent-delegation.md`（落位：「每阶段分派时序」:668-712 之后、「子代理分派模板」:713 之前插派单契约节；「失败模式与回退」:1657 之前插分层反馈回路节）

- [ ] **步骤 1：新增 `## 派单契约：前置条件与可验证终态`**，含（按规格 §2.1）：
  - 前置条件定义 + 四类合法形态（路径存在性 / 内容结构性判据 / 门禁判据 / 环境判据）；
  - O 派单前逐条自证义务（无法自证不得写入——先补齐或不派）；
  - S 双轨核验（按清单逐项 + 既有自发评估；失守走既有 `blockers[]` / `state=NEEDS_CONTEXT`；禁止「先做着看看」）；
  - 可验证终态定义 + 四类合法形态（gate / 测试 / 产物 / 回填）+ 自评词禁则（第三方可复核原则）；
  - 任务级 vs 阶段级划界（终态 ≠ phase-N 验收标准，必要非充分）；
  - 四重划界（四件事=交接定位 / 质疑权=前置失守出口 / status.json=回填信标对齐 / selfCheck.terminalState 新字段与 acceptanceCriteriaMet 分层并存）+ V 消费句（伪造终态证据走 #4/#9）。
- [ ] **步骤 2：新增 `## 分层反馈回路（L0-L4）`**，含（按规格 §3.1）：
  - 五层收敛表（L0 finding / L1 任务 / L2 阶段 / L3 跨阶段 / L4 用户；信号源全部引用既有机制与既有数值：每任务 5 轮 §3.4.2、maxReworkRounds、maxIcebergRounds=5、upstreamDefect、CHECKPOINT）；
  - 升级单调性原则（绕过手段显名并指向 C2）；
  - 与「普通 V/G 失败链」关系句（L1 的具体展开，不改变步骤顺序）；
  - ChangeClassification 词汇引用约束句（总纲 §4.1 三词，不另造近义词；不引入 classification 分流）。
- [ ] **步骤 3**：文内目录（:468-478）加两行。

### 任务 2：subagent-delegation.md 模板面与配套行

- [ ] **步骤 1：22 个分派模板同构加两段**（澄清事实 1 清单；S 模板为权威样例——「上下文：」后插「前置条件：」段、「产出契约」末项后插「可验证终态：」项；其余模板按各自代码块形态最小插入；角色判据适配：V=`check-verifier-output exit 0` / G=`受派门禁 exit 0 + GATE_JSON 落盘` / R=`check-rootcause-report exit 0` / A=合并报告落盘+图谱校验 exit 0 / S-fix=定点修复+复评门禁 exit 0 / R3 与 R-iceberg=三份或冰山报告落盘+对应校验 / 豁免三模板=check-exemption exit 0）。
- [ ] **步骤 2**：brief.md 契约行（文件落地交接协议表，「brief.md 内容」格）扩为含「前置条件 + 可验证终态」；status.json 语义注释对齐句（`state=DONE` 以终态证据为前提）加在该 Schema 说明附近（schema 本体零改动）。
- [ ] **步骤 3**：§3.3 书写规则「四件事」句后追加一句（完整派单 = 四件事 + 两段契约，指向派单契约节）。
- [ ] **步骤 4**：回填契约节（:1305-1456）S 子代理返回段：selfCheck 新增 `terminalState` 证据字段说明（逐条终态判据核验结果与证据指针）；`acceptanceCriteriaMet` 行不动；V 复审消费句（核验 terminalState 证据真实性，伪造走 #4/#9）。
- [ ] **步骤 5**：「失败模式与回退」表既有两条重复失败升级行（R ≥2 / V rootcause ≥2）标注「→ L1→L4 升级（见分层反馈回路）」；同 round 内语义零改动。

### 任务 3：phase-5-coding.md 交叉引用

- [ ] 「任务分配规则」节（:29-35）追加派单契约引用句；
- [ ] 「返工路径」节（:522-533）末尾追加分层反馈回路引用句（本节「线索化」纪律原句不动）。

### 任务 4：hard-constraints.md C2 候选

- [ ] **步骤 1**：C1 节（:536-546）后新增 `### C2（候选，pending V 复审）无限返工循环`，五字段（症状 / 违反原则 / 检测信号 / 修正 / 状态）按规格 §3.2；状态行沿用「复审前不作为强制反模式执行；转正后正式编号 #49 并同步活体计数」+「达上限 CHECKPOINT 义务是既有强制约束（subagent-delegation §3.4.2 与 budget 门禁），不受候选状态影响」。
- [ ] **步骤 2**：自检——48 计数（澄清事实 3 全清单）零 diff；主表与配套五表零改动。

### 任务 5：eval 语料 +4 条（id 61-64）

**文件：** `eval/mappings.json`、`eval/w-model-dev-test-prompts.json`

- [ ] **步骤 1**：mappings.json 追加 4 条 L2（断言与 evidence 按规格 §4 表：61/62/64 contains subagent-delegation.md「可验证终态」/「前置条件」/「分层反馈回路」；63 contains hard-constraints.md「无限返工」；evidence 一律 `{"type":"assertion"}`）。
- [ ] **步骤 2**：语料文件追加 4 条（id/scenario/prompt/expected，scenario 与 mappings 一致，形态参照 id 23/24）。
- [ ] **步骤 3**：`npm run eval` 全绿（64/64；routeTotals {12/8/22} 不变；activation-guide 零改动）。

### 任务 6：SSoT §10N + AGENTS 机制索引

- [ ] **步骤 1**：SSoT §10M 后新增 `## 10N. 派单契约与分层反馈回路（批次 4，2026-10-02）`——四件套形态（仿 §10M）：目标一段 / 落点表（subagent-delegation 两节=权威 + phase-5 引用 + hard-constraints C2=候选 + eval 锚定）/ 能力分工不夸大句（纯文档机制，无脚本门禁，执行靠 O/V 遵循——D12 知情声明）/ 判据披露（终态=第三方可复核；C2 候选边界）。
- [ ] **步骤 2**：SSoT §10A 追溯表加行（批次 4，指向 §10N 与本规格）。
- [ ] **步骤 3**：AGENTS.md §1「编排者最小化」段加摘要句（派单契约两段 + L0-L4 分层回路 + C2 候选），指向 subagent-delegation 权威节；§8 表零改动。

### 任务 7：版本收口（CHANGELOG + package.json + 总纲）

- [ ] package.json version → 42.9.0；
- [ ] CHANGELOG.md 新增 `## [42.9.0] - 2026-10-02` 条目（照 42.8.0 头注形态：来源/判据/向后兼容/计数影响——exit-2 47 / schema 34 / persona 33 / references 44 / prepush 19 全不变；eval 语料 60→64）；正文按 B4 / B5 / eval / 索引对齐分小节；
- [ ] 总纲 §5 状态表批次 4 行登记（规格 / 计划 / 实现状态——收口任务完成后填终值）。

### 任务 8：全量验证收口

- [ ] `npm run eval`（64/64）；
- [ ] `npm run --silent typecheck`（零 TS 改动，应恒绿）；
- [ ] `npm run prepush`（19 项全绿；重点：docs-consistency 计数类扫描 / gate-count-docs / eval / prettier 格式）；
- [ ] DoD 逐条对照（规格 §6 五条）自查并在账本记录证据。

---

## 收尾记录

（2026-10-02 回填）**子代理驱动执行**（superpowers:subagent-driven-development）：任务 1-7 各「实现者+任务审查者」双角色分派，全部规格✅+质量通过；最终宽范围审查「可合并」（DoD 1-4 ✅，DoD 5 待终值）+ 终审修复浪潮 fa4a24c2（F1-F6 全 ADDRESSED，定向复审通过）。

- 提交清单：立项 78396d90（规格+计划，main）；实现 d463ad68（t1 两权威节）→ c35aaed6（t2 22 模板）→ 31f6f503（t3 phase-5）→ d90aeb94（t4 C2）→ 39246f37（t5 eval）→ bb95e023（t6 SSoT/AGENTS）→ ca5fc151（t7 版本收口）→ fa4a24c2（终审修复浪潮）→ ab7b2f43（终值回填）。
- prepush 终值：**19/19 全绿**（对 ca5fc151 2513s；对 fa4a24c2 1949s——终值）。
- eval 终值：**64/64**（routeTotals {12/8/22} 不变）；typecheck / docs-consistency / audit:l0-links 全绿。
- 合并：main ← feature/batch4-dispatch-contract（--no-ff，合并提交 453b22f2）；总纲批次 4 状态登记「已实现并合入 main」。
- 延后项（账本 minor deferred，移交后续批次/终审）：§10A 批次不对称（批次 2/3 无行属既有现状）；CHANGELOG:12 双括注措辞观感；被改表格的 prettier 管道对齐（.md 不在格式门禁面）。
