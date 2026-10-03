# 收口文档 ai-native-sdlc-adoption.md 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 撰写五批次吸收计划收官对账文档 `docs/ai-native-sdlc-adoption.md`（六段骨架 × 13 项），完成登记面与总纲回填。

**架构：** 纯 docs/ 交付——新建 1 份对账文档 + 2 处登记（总纲 §4.4 状态句、AGENTS.md §5 第 9 项）；零脚本/schema/版本变更。文档是**导航/对账层**：每行只带「文件+节」锚点，不复制权威内容。

**技术栈：** Markdown + 既有 npm 门禁（无新依赖）。

**规格（唯一权威）：** [docs/superpowers/specs/2026-10-03-ai-native-sdlc-adoption-closeout-design.md](../specs/2026-10-03-ai-native-sdlc-adoption-closeout-design.md)（c5e9039f，D1-D4 已定）。本计划与规格冲突时以规格为准。

**分支：** `feature/ai-native-sdlc-adoption-closeout` 自 main 开启（任务 0）。合并推送由用户指示。

---

## 事实核查（实施者必读的锚点与约束）

| # | 事实 | 锚点 |
|---|---|---|
| F1 | 六段骨架定义（总纲 §4.4）：吸收/不吸收→映射→落点→门禁接线→与既有机制划界→人审锚 | 总纲 :66 |
| F2 | 13 项判定终态（本文档 §1 总表的数据源） | 规格 §2 表（14 行含 C3 排除行） |
| F3 | 批次 1 SSoT 权威节：§10.8「SD-codeModule 双向精确对账」（:1603，SDMAP-1..5）+ §10L.4「一致性差异分类」（:2333）+ §10L.7 StructuredViolation 扩展（:2374） | SSoT 实查行号可能漂移，以节标题 grep 为准 |
| F4 | 批次 2=SSoT §10M；批次 3=SSoT §10L（+§10.8 签名链节）；批次 4=SSoT §10N；批次 5=SSoT §10O + §10K.7 | 各批次规格与 SSoT 互证 |
| F5 | AGENTS.md §5 必读文档为 8 项编号列表（:8 项是 bdd.md） | 任务 2 追加第 9 项 |
| F6 | CHANGELOG 五条目：42.6.0（批次 1）/ 42.7.0（批次 3）/ 42.8.0（批次 2）/ 42.9.0（批次 4）/ 42.10.0（批次 5） | CHANGELOG.md 实查 |
| F7 | 五批次合并提交：6a2029df（批1）/ 9b2a2125（批3）/ b9a8281d（批2）/ 453b22f2（批4）/ 607f3d2f（批5）；版本 42.6.0-42.10.0 | `git log --grep="Merge branch 'feature/batch"` 实查 |
| F8 | **术语口径**：约束口径（既有约束 #4/#9）vs 反模式口径（反模式 #10）——hard-constraints 双编号体系；「知情声明」形态 = 纯文档机制无脚本门禁的登记话术（批次 4 D12 / 批次 5 §10O 先例） | hard-constraints.md / SSoT §10N/§10O |
| F9 | **prettier 边界**：.md 不在 prettier 门禁面——**禁止**对 .md 跑 `prettier --write` | `.githooks/pre-commit` |
| F10 | **不复制权威内容**：收口文档每行只带锚点；判定不复审（以五批次规格+总纲为仓内权威）；早期吸收波次（2026-08-10 四/三来源、2026-09-14 扩展采纳、superpowers v6.3.0 vendor、SkillOpt 吸收）不在范围，§0 一句划界 | 规格 §0/§4 |

## 文件结构

| 文件 | 动作 | 职责 | 任务 |
|---|---|---|---|
| `docs/ai-native-sdlc-adoption.md` | 创建 | 收口对账正文（§0 声明 + §1 判定总表 + §2-§6 六段骨架表 + §7 维护规则） | 1 |
| `docs/superpowers/specs/2026-09-30-absorption-batches-master-outline.md`（§4.4） | 修改 | 收口状态句 | 2 |
| `AGENTS.md`（§5） | 修改 | 必读文档第 9 项 | 2 |
| 本计划 | 修改（任务 2 回填收尾记录） | 账本 | 2 |

---

### 任务 0：开启实现分支

- [ ] **步骤 1**：确认工作树干净且 main 同步；`git checkout -b feature/ai-native-sdlc-adoption-closeout`（自 main，BASE=c5e9039f）。

### 任务 1：正文撰写 docs/ai-native-sdlc-adoption.md

**文件：**
- 创建：`docs/ai-native-sdlc-adoption.md`

- [ ] **步骤 1：撰写 §0 与 §1（全文照写）**

```markdown
# AI 原生 SDLC 吸收收口（13 来源 → W 模型技能包）

> **本文是什么**：13 来源吸收批次计划（[总纲](./superpowers/specs/2026-09-30-absorption-batches-master-outline.md)）的收官对账文档——按总纲 §4.4 六段骨架（**吸收/不吸收 → 映射 → 落点 → 门禁接线 → 与既有机制划界 → 人审锚**）逐项登记 13 项能力的裁定终态与权威锚点。五批次已全部实现并合入 main（42.6.0 → 42.10.0）。
> **本文不是什么**：不复制任何权威内容——每行只带「文件+节」锚点，权威以其所在文件为准；不复审任何判定——判定争议以总纲与五批次规格为仓内权威。
> **与 [adoption-guide.md](./adoption-guide.md) 的划界**：guide 回答「怎么采用这个技能」（绿地/棕地路径）；本文回答「这个技能从 13 个外部来源吸收了什么、落在哪、由什么守护」。
> **波次划界**：本文只覆盖 13 来源吸收计划（批次 1-5）；更早的吸收波次（2026-08-10 四/三来源、2026-09-14 扩展采纳、superpowers v6.3.0 vendor、SkillOpt 方法论吸收等）各有其规格与 SSoT 节，不在本文范围。

## 0. 证据层级声明

13 项吸收/不吸收的**原始分析**（13 个外部来源逐项吸收分析 + 三轮仓内对比复核，即总纲头部所称「复核报告」）**未随仓交付**；本文判定终态从**仓内证据**重建，证据源与效力排序：

1. **五批次规格**（`docs/superpowers/specs/` 下 2026-09-30-design-code-consistency-anchors-design.md / 2026-10-01-gate-engineering-design.md / 2026-10-02-design-phase-fog-and-optional-capability-design.md / 2026-10-02-batch4-dispatch-contract-design.md / 2026-10-03-batch5-governance-narrative-design.md）——逐项范围与裁定的实现侧权威；
2. **总纲 §1/§3/§7**（批次划分、C3 排除、明确不吸收清单）——跨批次契约权威；
3. **SSoT 权威节**（§10.8 / §10L / §10M / §10N / §10O / §10K.7）——已实现机制的摘要权威；
4. **CHANGELOG 42.6.0-42.10.0**——逐批次交付终值。

## 1. 吸收/不吸收判定总表

| 项 | 能力 | 判定 | 实现批次与版本 |
|---|---|---|---|
| A1 | 档三（锚点+双向对账） | 吸收并实现 | 批次 1（42.6.0） |
| A2 | 诊断增强（阻断性不变） | 吸收并实现 | 批次 1（42.6.0） |
| B6 | 悬空权威引用清零 | 吸收并实现 | 批次 1（42.6.0） |
| A3 | 设计期迷雾登记册 | 吸收并实现（+check-design-fog.ts 脚本门禁） | 批次 2（42.8.0） |
| A4 | 可选能力≠运行时边 | 吸收并实现（方案 A） | 批次 2（42.8.0） |
| B1 | StructuredViolation subject/fixHints | 吸收并实现（四热点先行） | 批次 3（42.7.0） |
| B2 | sigHash v2 + GATE_JSON verifiedArtifacts | 吸收并实现 | 批次 3（42.7.0） |
| B3 | fixRecommendation scope 强制 | 吸收并实现（R4） | 批次 3（42.7.0） |
| B4 | 派单契约两段（前置条件+可验证终态） | 吸收并实现（22 分派模板同构携带） | 批次 4（42.9.0） |
| B5 | 分层反馈回路 L0-L4 | 吸收并实现（收敛视图+候选反模式 C2） | 批次 4（42.9.0） |
| C2 | agent 威胁模型 | 吸收并实现（D1 文档叙事形态） | 批次 5（42.10.0） |
| C4 | 整批否决权/回收路径 | 吸收并实现（D2 纯文档治理规则） | 批次 5（42.10.0） |
| C1 | Phase 5-8 迁移素材 | 素材形态落地（§10K.7 需求框架先行；**实现未立项**，维持「不得据此执行」） | 批次 5（42.10.0） |
| C3 | first-pass 通过率等指标 | **排除**（不属五批次，另行立项；总纲 §3 明文） | — |

**明确不吸收清单**（转载总纲 §7，防重复讨论）：archify 视觉设计系统/渲染器/viewer；DHH「可以不看代码」（域限定个人激进态）；Anthropic managed settings/egress/沙箱具体配置；Stripe devbox/Toolshed/goose fork、Spotify 自研 CLI 等基建实现；Basecamp agent-accessible 产品策略；Endless execution 哲学抒情。
```

- [ ] **步骤 2：撰写 §2-§6 六段骨架表（按下方逐行内容规格落笔）**

五张表共用 13 行（A1/A2/B6/A3/A4/B1/B2/B3/B4/B5/C2/C4/C1——C3 已在 §1 排除，不入六表）。每行的**实质内容**如下；行内全部「文件+节」锚点**写入前必须逐一实查**（grep 节标题/关键词确认存在，行号漂移以实查为准；实查不符时修正锚点并在报告中登记偏差）。表列名固定：

**§2 映射**（`| 项 | 来源能力形态 | W 模型语境再诠释 |`）：
- A1：源=证据锚点+双向对账思想 → 再诠释=codeModule 行号锚点语法 + SD↔RTM 双向精确对账（SDMAP-1..5），「断言必须有源证据」落到 RTM codeModule 列
- A2：源=差异分类标签实践 → 再诠释=ChangeClassification 三态词汇（semantic/topology/evidence-only），只服务 R 定位与 reworkHints 排序、不改变阻断语义
- B6：源=悬空引用审计实践 → 再诠释=权威引用（SSoT 节号/文档锚点）悬空清零纪律——引用必须落在真实存在的节
- A3：源=未决项显式登记机制 → 再诠释=设计期迷雾登记册（锐利性测试判「能否精确陈述问题」+ 毕业三选一 + CHECKPOINT 强制清空）
- A4：源=可选能力与承诺区分 → 再诠释=图内无可选语义：进入图=承诺为运行时事实，全部不变量无一豁免；P2（可以）≠可选能力
- B1：源=结构化违规诊断（subject/fixHints）→ 再诠释=面向修复者 LLM 的符号级定位 + ≤3 条祈使句修复话术，四热点门禁先行
- B2：源=内容哈希绑定实践 → 再诠释=sigHash 公式版本化（v1|v2 分流、历史链零破坏）+ GATE_JSON verifiedArtifacts 字节清单——「门禁验的与消费的是同一字节」
- B3：源=修复范围声明实践 → 再诠释=fixRecommendation.scope 双数组（allowed/forbidden）强制，V scoped re-review 对照消费
- B4：源=派单契约化实践 → 再诠释=前置条件（O 派单前逐条自证）+ 可验证终态（第三方可复核、禁自评词）两段进 22 个分派模板
- B5：源=返工轮次治理 → 再诠释=L0-L4 分层反馈回路收敛视图（零新增轮次数值，信号源全为既有机制与既有数值）
- C2：源=agent 威胁建模 → 再诠释=T1-T7 威胁目录→既有缓解机制映射（叙事层三不承诺），不建守卫体系
- C4：源=批量否决/召回治理 → 再诠释=campaign 级整批否决=批量 CHECKPOINT 编组语义；回收=系统性问题触发的逐候选既有原语编组
- C1：源=迁移治理素材 → 再诠释=Phase 5-8 迁移设计锚点素材（五字段待输入表）——需求框架先行、不实现

**§3 落点**（`| 项 | 权威落点（文件+节） | 辅助落点 |`）——权威落点全部指向 SSoT 或 references 节：
- A1：SSoT §10.8「SD-codeModule 双向精确对账」｜辅助=templates/rtm.md + rtm-guide.md（实查锚点语法节）
- A2：SSoT §10L.4「一致性差异分类（ChangeClassification）」｜辅助=w-model-dev/scripts/logic/state-machine-logic.ts 与 code-tla-logic.ts（type-only import）
- B6：批次 1 规格（2026-09-30-design-code-consistency-anchors-design.md）B6 节 + 悬空引用清零的批次 1 交付记录｜辅助=references/templates 权威引用纪律（实查批次 1 规格确认具体落点文件后落笔）
- A3：SSoT §10M + phase-2-system-design.md / phase-3-outline-design.md / phase-4-detailed-design.md 各「设计期迷雾登记册」节｜辅助=templates 三主模板迷雾节 + check-design-fog.ts
- A4：graph-guide.md「可选能力边界（批次 2 A4）」节（权威表述）｜辅助=SSoT §10M A4 行 + templates/system-design/system-architecture.md「可选能力（不进图）」注记位
- B1：SSoT §10L.7「StructuredViolation 扩展」（subject/fixHints 权威定义）｜辅助=root-cause-locator.md §4.4（R 消费）+ conventions.md subject 条目
- B2：SSoT §10.8 签名链节（sigHashAlgo v1|v2 + R11）｜辅助=signature-chain-guide.md 消费契约节（v2 链 sha256 从上游 GATE_JSON verifiedArtifacts 抄录）
- B3：rootcause-report.schema.json fixRecommendation.scope + root-cause-logic.ts R4｜辅助=subagent-delegation.md scoped re-review 节 + root-cause-locator.md Schema 节（scope 撰写指引）
- B4：subagent-delegation.md「派单契约：前置条件与可验证终态」节（权威）｜辅助=SSoT §10N + eval/mappings.json id 61-62
- B5：subagent-delegation.md「分层反馈回路（L0-L4）」节（权威）｜辅助=SSoT §10N + hard-constraints.md 候选 C2 + phase-5-coding.md 交叉引用
- C2：agent-threat-model.md（权威载体）｜辅助=SSoT §10O + verifier-spec.md §7.4A 注入提示行细化
- C4：quality-standards.md「整批否决权与回收路径（campaign 级，批次 5）」节（权威披露）｜辅助=code-health-governance.md §6 操作小节 + SSoT §10O
- C1：SSoT §10K.7「Phase 5–8 迁移设计锚点（素材，待需求输入）」｜辅助=code-health-governance.md 头部指针句

**§4 门禁接线**（`| 项 | 门禁形态 | 判据锚点 |`）——「无脚本」行必须带知情声明话术（F8）：
- A1：脚本门禁｜check-artifact-gate.ts SDMAP-1..5（exit 1 阻断）+ check-code-tla-consistency.ts 维度 1（双实现语义一致，SSoT §10.8）
- A2：脚本内可选字段｜三差异输出 classification（不改变阻断语义；两侧比对键零交集 fail-closed）
- B6：文档纪律+链接审计｜实查批次 1 交付的审计形态（audit:l0-links / docs-consistency 链接检查）后落笔；不得凭推测写
- A3：脚本门禁｜check-design-fog.ts R1-R6（存在未终结项 exit 1 阻断放行）
- A4：无脚本门禁（知情声明）｜靠 V 评审 + phase-2/3/4 禁止行为条目承载；图模型无可选语义使可选能力天然不产生对账义务
- B1：门禁输出扩展｜四热点 structuredViolations（`--json` 机器可读暴露当前仅 check-artifact-gate `sdmapViolations` 键；三热点透传登记总纲 §5.1 后续批次——SSoT §10L.7 勘误如实转述）
- B2：脚本门禁｜check-signature-chain.ts R6 按 sigHashAlgo 分流重算 + R11（v2 链 sha256 必填）
- B3：脚本门禁｜check-rootcause-report.ts R4（每条 fixRecommendation 必带合规 scope）
- B4：无脚本门禁（知情声明，批次 4 D12 形态）｜执行靠 O/V 遵循 + 既有闭环门禁（check-run-log/check-budget）间接承载
- B5：无脚本（收敛视图）｜轮次上限义务由既有 check-budget / check-run-log R11 / ICEBERG maxIcebergRounds=5 承载；C2 候选 pending V 复审不作为强制反模式执行
- C2：无脚本（三不承诺）｜R3 security 与 V security-auditor 叙事层参考消费；不新增检测信号不改 G 门禁
- C4：无脚本（编组语义）｜全部复用既有 code-health ledger / git apply -R 回滚 / archive produce 原语；零新脚本零 schema
- C1：无（未实现）｜§10K.7「不得据此执行」；实现立项前须用户需求输入

**§5 与既有机制划界**（`| 项 | 相邻机制 | 边界要点 |`）：
- A1：codeModule 锚点 vs 图节点 evidenceAnchor｜前者=RTM 行级源证据（SDMAP 校验）；后者=图谱结论事实锚点（R15 格式校验）——两套锚点各自独立、互不替代
- A2：classification vs Severity 标签｜classification=差异性质三态（机器判定）；Severity=reworkHints 优先级前缀（verifier-spec §7.4A.2，字符串约定）——正交并存
- B6：权威引用清零 vs L0/L1 链接审计｜实查批次 1 交付后落笔（audit:l0-links 管分层链接边界；B6 管权威节号引用实指）——两者对象不同
- A3：设计期迷雾 vs 阶段 1 迷雾｜分层权威：需求层=需求规格 §11.5；设计层=phase-2/3/4 迷雾节；四通道互斥（ADR/decisions、迷雾册、非目标、Out of Scope）
- A4：可选能力 vs P2 需求｜两套「可选」显式划界：P2=范围内照常建图承担全部不变量；可选能力=不建图不产生对账义务
- B1：fixHints vs reworkHints｜fixHints=门禁常量表话术（G 产出）；reworkHints=V 评审产出（带 Severity 前缀）——R 是转写者（至多 3 条），两字段不混用
- B2：sigHash v2 vs evidence provenance｜sigHash=签名链条目完整性（篡改声明→重算失败）；provenance=受控本机 source-bound 流程完整性（**非密码学签名**）——两机制强度如实标注
- B3：scope 强制 vs 角色禁令｜scope 管「修复能碰什么」；角色禁令管「谁能跑什么」——互不替代
- B4：派单契约 vs 角色边界｜契约管「派什么/怎么验」；同文件角色边界管「谁能做什么」——两节互补不重复
- B5：L0-L4 视图 vs 既有轮次数值｜收敛视图零新增数值：每任务 5 轮 / maxReworkRounds / maxIcebergRounds=5 均既有值引用
- C2：威胁叙事 vs 守卫体系｜叙事层不建自动化守卫（批次 5 D1）；守卫唯一执行体仍是门禁脚本+硬约束
- C4：campaign 整批 vs 阶段回退｜阶段 5-8 的「整批」形态已存在=阶段回退（workflow.md）；本机制补 campaign 级
- C1：迁移素材 vs 正常阶段流程｜待输入字段表将定义「哪些变更不算迁移」；当前一切照常走阶段 5-8 流程

**§6 人审锚**（`| 项 | 人类检查点 | 形态 |`）——无新增人审点的行如实标：
- A1/A2/B6/B1/B2/B3：阶段门放行 🔴 CHECKPOINT（既有）｜无新增人审点——既有阶段门覆盖
- A3：阶段门放行前迷雾册强制清空披露｜批次 2 既有 CHECKPOINT 接线
- A4：可选能力后续转正=正式变更（用户确认）｜批次 2 既有
- B4/B5：达限强制升级 L4=用户 🔴 CHECKPOINT（继续修复/接受放行/阶段回退/终止）｜批次 4 既有（分层回路 L4）
- C2：无新增人审点｜三不承诺——R3/V 参考消费
- C4：campaign 收口 CHECKPOINT 整批裁定 + 回收发起｜批次 5 既有（human 唯一授权者，工具/LLM 输出不能授权）
- C1：实现立项时的需求输入（用户裁定）｜§10K.7 待输入字段表

- [ ] **步骤 3：撰写 §7（全文照写）**

```markdown
## 7. 维护规则

机制演进时本表随之维护：已实现机制变更落点或退役 → 同步 §3/§4 对应行（退役在 §1 判定列加注）；新增吸收项（后续批次/立项）→ §1 总表续行 + §2-§6 各补一行；锚点失效（文件/节改名）→ 修锚不改判定。与 [agent-threat-model.md](../w-model-dev/references/agent-threat-model.md) §4、SSoT §10A 追溯表同款纪律；本文由批次规格流程修改，常规 `/wm` 运行不写本文。
```

- [ ] **步骤 4：锚点实查清单（写入报告）**

对 §2-§6 全部锚点跑实查并记录（至少）：
```bash
grep -n "^### 10L.4\|^## 10M\|^## 10N\|^## 10O\|^### 10K.7" docs/skill-design-document_SSoT.md
grep -n "SD-codeModule 双向精确对账\|StructuredViolation.*增两个可选字段" docs/skill-design-document_SSoT.md | head -4
grep -n "派单契约：前置条件与可验证终态\|分层反馈回路" w-model-dev/references/subagent-delegation.md | head -4
grep -n "可选能力边界" w-model-dev/references/graph-guide.md
grep -n "整批否决权与回收路径" w-model-dev/references/quality-standards.md
grep -n "设计期迷雾登记册" w-model-dev/references/phase-2-system-design.md
ls docs/superpowers/specs/2026-09-30-design-code-consistency-anchors-design.md
```
每条预期命中 ≥1；B6 行的落点以批次 1 规格实读为准（`grep -n "B6\|悬空" docs/superpowers/specs/2026-09-30-design-code-consistency-anchors-design.md`）。

- [ ] **步骤 5：Commit**

```bash
git add docs/ai-native-sdlc-adoption.md
git commit -m "docs(closeout): ai-native-sdlc-adoption 收口对账文档——六段骨架×13 项（§0 证据层级声明/§1 判定总表/§2-§6 六段表/§7 维护规则），纯导航层不复制权威内容"
```

### 任务 2：登记面 + 收口验证

**文件：**
- 修改：`docs/superpowers/specs/2026-09-30-absorption-batches-master-outline.md`（§4.4）
- 修改：`AGENTS.md`（§5）
- 修改：本计划（收尾记录）

- [ ] **步骤 1：总纲 §4.4 末尾追加状态句（在「`ai-native-sdlc-adoption.md`（adoption 文档…以复核报告为源。」句之后）**

```markdown
**状态（2026-10-03）**：收口文档已撰写并合入 main——`docs/ai-native-sdlc-adoption.md`（〈任务 1 提交短哈希，git log 实查〉）；五批次吸收计划全部收官。
```

- [ ] **步骤 2：AGENTS.md §5 清单追加第 9 项（第 8 项 bdd.md 之后）**

```markdown
9. [docs/ai-native-sdlc-adoption.md](./docs/ai-native-sdlc-adoption.md) — 13 来源吸收收口对账（五批次收官交付物：判定/映射/落点/门禁/划界/人审锚六段对账，纯导航层）
```

- [ ] **步骤 3：机器验证**

运行：`npm run check:docs-consistency`——预期 exit 0（版本不变 42.10.0、references 计数不变 45——docs/ 不在 references-count 面）。

- [ ] **步骤 4：DoD 核验（规格 §5）**

```bash
grep -c "^| " docs/ai-native-sdlc-adoption.md        # 表行计数（报告记录，六表应各 13 数据行 + §1 14 行）
grep -n "证据层级声明\|维护规则" docs/ai-native-sdlc-adoption.md   # §0/§7 在场
grep -rn "ai-native-sdlc-adoption" AGENTS.md docs/superpowers/specs/2026-09-30-absorption-batches-master-outline.md | wc -l   # 预期 ≥2（两处登记）
```

- [ ] **步骤 5：收尾记录回填 + Commit（本计划文末「收尾记录」节：任务提交清单 + 验证输出摘要）**

```bash
git add docs/superpowers/specs/2026-09-30-absorption-batches-master-outline.md AGENTS.md docs/superpowers/plans/2026-10-03-ai-native-sdlc-adoption-closeout.md
git commit -m "docs(closeout): 登记面——总纲 §4.4 收口状态句 + AGENTS §5 必读文档第 9 项 + 收尾记录"
```

- [ ] **步骤 6：跑全量 prepush（后台 + 轮询模式防超时：log 重定向 + 240s 间隔轮询 prepush.exit 文件）**

预期 19/19 全绿；终值回填总纲 §4.4 状态句？——**否**：§4.4 句不承载 prepush 终值（收口文档纯 docs 无版本号，无需批次 4/5 式终值回填），prepush 终值只记本计划收尾记录。若有失败先修再重跑，不得带红收口。

- [ ] **步骤 7：向用户汇报，等待合并指示**

---

## 收尾记录（任务 2 回填）

（待回填：任务提交清单 / check:docs-consistency 与 DoD grep 结果 / prepush 终值）
