# AI 原生 SDLC 吸收收口（13 来源 → W 模型技能包）

> **本文是什么**：13 来源吸收批次计划（[总纲](./superpowers/specs/2026-09-30-absorption-batches-master-outline.md)）的收官对账文档——按总纲 §4.4 六段骨架（**吸收/不吸收 → 映射 → 落点 → 门禁接线 → 与既有机制划界 → 人审锚**）逐项登记 13 项能力的裁定终态与权威锚点。五批次已全部实现并合入 main（42.6.0 → 42.10.0）。
> **本文不是什么**：不复制任何权威内容——每行只带「文件+节」锚点，权威以其所在文件为准；不复审任何判定——判定争议以总纲与五批次规格为仓内权威。
> **与 [adoption-guide.md](./adoption-guide.md) 的划界**：guide 回答「怎么采用这个技能」（绿地/棕地路径）；本文回答「这个技能从 13 个外部来源吸收了什么、落在哪、由什么守护」。
> **波次划界**：本文只覆盖 13 来源吸收计划（批次 1-5）；更早的吸收波次（2026-08-10 四/三来源、2026-09-14 扩展采纳、superpowers v6.3.0 vendor、SkillOpt 方法论吸收等）各有其规格与 SSoT 节，不在本文范围。

## 目录

- [0. 证据层级声明](#0-证据层级声明)
- [1. 吸收/不吸收判定总表](#1-吸收不吸收判定总表)
- [2. 映射](#2-映射来源能力形态--w-模型语境再诠释)
- [3. 落点](#3-落点权威文件节)
- [4. 门禁接线](#4-门禁接线)
- [5. 与既有机制划界](#5-与既有机制划界)
- [6. 人审锚](#6-人审锚)
- [7. 维护规则](#7-维护规则)
- [8. 附录：锚点复核命令（维护用）](#8-附录锚点复核命令维护用)
- [9. 附录：五批次规格与 SSoT 权威节对照](#9-附录五批次规格与-ssot-权威节对照)

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

**锚点约定**：§2-§6 全部「文件+节」锚点写入前已逐一实查（grep 节标题/关键词于 2026-10-03 收口时点的 HEAD），实查不符的以实查为准修正；本文锚点一律不写行号——行号随版本漂移，节名以所在文件当前版本为准。锚点失效时按 §7 维护规则修锚，机械复核方式见 §8。

**六段骨架导读**：

| 骨架段 | 节 | 回答的问题 |
|---|---|---|
| 吸收/不吸收 | §1 | 13 项各吸收了什么、C3 为何排除 |
| 映射 | §2 | 来源能力在 W 模型语境里变成什么 |
| 落点 | §3 | 每项的权威文件与节在哪 |
| 门禁接线 | §4 | 每项由什么门禁/机制守护 |
| 与既有机制划界 | §5 | 和相邻既有机制怎么分界 |
| 人审锚 | §6 | 人类检查点在哪 |

## 2. 映射（来源能力形态 → W 模型语境再诠释）

五张骨架表（§2-§6）共用 13 行（A1/A2/B6/A3/A4/B1/B2/B3/B4/B5/C2/C4/C1）——C3 已在 §1 排除，不入六表。每行只带一句话要点与锚点，机制细节以其权威文件为准。

| 项 | 来源能力形态 | W 模型语境再诠释 |
|---|---|---|
| A1 | 证据锚点+双向对账思想 | codeModule 行号锚点语法 + SD↔RTM 双向精确对账（SDMAP-1..5），「断言必须有源证据」落到 RTM codeModule 列 |
| A2 | 差异分类标签实践 | ChangeClassification 三态词汇（semantic/topology/evidence-only），只服务 R 定位与 reworkHints 排序、不改变阻断语义 |
| B6 | 悬空引用审计实践 | 权威引用（SSoT 节号/文档锚点）悬空清零纪律——引用必须落在真实存在的节 |
| A3 | 未决项显式登记机制 | 设计期迷雾登记册（锐利性测试判「能否精确陈述问题」+ 毕业三选一 + CHECKPOINT 强制清空） |
| A4 | 可选能力与承诺区分 | 图内无可选语义：进入图=承诺为运行时事实，全部不变量无一豁免；P2（可以）≠可选能力 |
| B1 | 结构化违规诊断（subject/fixHints） | 面向修复者 LLM 的符号级定位 + ≤3 条祈使句修复话术，四热点门禁先行 |
| B2 | 内容哈希绑定实践 | sigHash 公式版本化（v1\|v2 分流、历史链零破坏）+ GATE_JSON verifiedArtifacts 字节清单——「门禁验的与消费的是同一字节」 |
| B3 | 修复范围声明实践 | fixRecommendation.scope 双数组（allowed/forbidden）强制，V scoped re-review 对照消费 |
| B4 | 派单契约化实践 | 前置条件（O 派单前逐条自证）+ 可验证终态（第三方可复核、禁自评词）两段进 22 个分派模板 |
| B5 | 返工轮次治理 | L0-L4 分层反馈回路收敛视图（零新增轮次数值，信号源全为既有机制与既有数值） |
| C2 | agent 威胁建模 | T1-T7 威胁目录→既有缓解机制映射（叙事层三不承诺），不建守卫体系 |
| C4 | 批量否决/召回治理 | campaign 级整批否决=批量 CHECKPOINT 编组语义；回收=系统性问题触发的逐候选既有原语编组 |
| C1 | 迁移治理素材 | Phase 5-8 迁移设计锚点素材（五字段待输入表）——需求框架先行、不实现 |

## 3. 落点（权威文件+节）

权威落点全部指向 SSoT、references、schemas/scripts 或批次规格节；辅助落点为消费方、模板或旁证。全部锚点实查于 2026-10-03（其中 B6 按「实读批次 1 规格」落笔，见 §8）。

| 项 | 权威落点（文件+节） | 辅助落点 |
|---|---|---|
| A1 | SSoT §10.8「SD-codeModule 双向精确对账」（docs/skill-design-document_SSoT.md） | references/rtm-guide.md「codeModule 格式规范」节；templates/rtm.md 代码模块列示例 |
| A2 | SSoT §10L.4「一致性差异分类（ChangeClassification）」 | w-model-dev/scripts/logic/state-machine-logic.ts 与 code-tla-logic.ts（classification 输出与零交集守卫） |
| B6 | 批次 1 规格「6. B6 悬空引用修复」节（docs/superpowers/specs/2026-09-30-design-code-consistency-anchors-design.md） | w-model-dev/references/operational-recovery.md「超标模块重写」节（悬空括注删除落点） |
| A3 | SSoT §10M；references/phase-2-system-design.md / phase-3-outline-design.md / phase-4-detailed-design.md 各「设计期迷雾登记册（A3，批次 2）」节 | templates/system-design.md / interface-design.md / detailed-design.md 主模板迷雾节；scripts/cli/check-design-fog.ts |
| A4 | references/graph-guide.md「可选能力边界（批次 2 A4）」节 | SSoT §10M A4 行；templates/system-design/system-architecture.md「可选能力（不进图）」注记 |
| B1 | SSoT §10L.8「门禁诊断结构化面（StructuredViolation.subject/fixHints）」 | references/root-cause-locator.md §4.4「R-lead 聚合规则」；references/conventions.md「subject」术语条目 |
| B2 | SSoT §7.9「signature-chain.jsonl schema（角色链式签名产物）」+ §10.11「签名链门禁（check-signature-chain.ts）」 | references/signature-chain-guide.md §6.2「v2 签名与 sha256 抄录（批次 3）」 |
| B3 | w-model-dev/schemas/rootcause-report.schema.json（fixRecommendation.scope 必填）+ scripts/logic/root-cause-logic.ts R4 | references/subagent-delegation.md §3.4.2「scoped re-review 的范围契约」；references/root-cause-locator.md §3（scope 撰写指引） |
| B4 | references/subagent-delegation.md「派单契约：前置条件与可验证终态」节 | SSoT §10N；eval/mappings.json id 61/62 |
| B5 | references/subagent-delegation.md「分层反馈回路（L0-L4）」节 | SSoT §10N；references/hard-constraints.md「C2（候选，pending V 复审）无限返工循环」；references/phase-5-coding.md L0-L4 交叉引用句 |
| C2 | references/agent-threat-model.md「2. 威胁目录（T1-T7）」 | SSoT §10O；references/verifier-spec.md §7.4A（「不构建完整守卫体系」细化句） |
| C4 | references/quality-standards.md「整批否决权与回收路径（campaign 级，批次 5）」节 | references/code-health-governance.md §6「CHECKPOINT 与失败链」（整批否决与回收操作）；SSoT §10O |
| C1 | SSoT §10K.7「Phase 5–8 迁移设计锚点（素材，待需求输入）」 | references/code-health-governance.md 头部实现边界指针句 |

## 4. 门禁接线

脚本门禁判据一律以真实执行退出码为准（0=通过 / 1=校验失败 / 2=输入错误；CHECKPOINT 处不得以 LLM 估算替代——hard-constraints.md #4「真实执行」/ #9「门禁退出码不可伪」约束口径）。「无脚本」行带知情声明话术，如实披露门禁形态、不冒充脚本强制。

| 项 | 门禁形态 | 判据锚点 |
|---|---|---|
| A1 | 脚本门禁 | check-artifact-gate.ts SDMAP-1..5（exit 1 阻断）+ check-code-tla-consistency.ts 维度 1（双实现语义一致，SSoT §10.8/§10.8.1） |
| A2 | 脚本内可选字段 | 三差异输出 classification（不改变阻断语义）；两侧比对键零交集 fail-closed（SSoT §10L.4） |
| B6 | 文档纪律+链接审计 | 批次 1 交付=悬空括注删除（grep 复核核验）；既有审计面 audit:l0-links（分层链接边界）+ check-docs-consistency（出站链接检查） |
| A3 | 脚本门禁 | check-design-fog.ts R1-R6（存在未终结项 exit 1 阻断放行；phase-2/3/4 验收清单接线） |
| A4 | 无脚本门禁（知情声明） | 靠 V 评审 + phase-2/3/4 图谱禁止行为条目承载；图模型无可选语义使可选能力天然不产生对账义务 |
| B1 | 门禁输出扩展 | 四热点 structuredViolations（`--json` 机器可读当前仅 check-artifact-gate 的 `sdmapViolations`/`verifiedArtifacts` 键；三热点透传登记总纲 §5.1 后续批次——SSoT §10L.8 勘误如实转述） |
| B2 | 脚本门禁 | check-signature-chain.ts R6 按 sigHashAlgo 分流重算（signature-chain-logic.ts）+ R11（v2 链 sha256 必填） |
| B3 | 脚本门禁 | check-rootcause-report.ts R4（每条 fixRecommendation 必带合规 scope：{allowed,forbidden} 至少一侧非空） |
| B4 | 无脚本门禁（知情声明，批次 4 D12 形态） | 执行靠 O/V 遵循 + 既有闭环门禁（check-run-log / check-budget / check-role-dispatch）间接承载 |
| B5 | 无脚本（收敛视图） | 轮次上限义务由既有 check-budget / check-run-log R11 / ICEBERG maxIcebergRounds=5（hard-constraints.md 反模式 #44）承载；候选反模式 C2 pending V 复审不作为强制反模式执行 |
| C2 | 无脚本（三不承诺） | R3 security 与 V security-auditor 叙事层参考消费；不新增检测信号、不改任何 G 门禁判定（agent-threat-model.md 定位节） |
| C4 | 无脚本（编组语义） | 全部复用既有 code-health ledger / git apply -R 回滚 / archive produce 原语；零新脚本零 schema（quality-standards.md 回收路径节） |
| C1 | 无（未实现） | SSoT §10K.7「未实现（不得据此执行）」；实现立项前须用户需求输入 |

## 5. 与既有机制划界

每行只记划界结论；机制细节以两侧权威文件为准。

| 项 | 相邻机制 | 边界要点 |
|---|---|---|
| A1 | codeModule 锚点 vs 图节点 evidenceAnchor | 前者=RTM 行级源证据（SDMAP 校验）；后者=图谱结论事实锚点（SSoT §4A.1b，R15 格式校验）——两套锚点各自独立、互不替代 |
| A2 | classification vs Severity 标签 | classification=差异性质三态（机器判定）；Severity=reworkHints 优先级前缀（verifier-spec.md §7.4A.2，字符串约定）——正交并存 |
| B6 | 权威引用清零 vs L0/L1 链接审计 | audit:l0-links 管分层链接边界；B6 管权威节号引用实指（引用必须落在真实存在的节）——两者对象不同 |
| A3 | 设计期迷雾 vs 阶段 1 迷雾 | 分层权威：需求层=templates/requirement-spec.md §8.5「Not yet specified（迷雾登记册）」+ references/phase-1-requirements.md「迷雾登记册（Fog of War）」节；设计层=phase-2/3/4 迷雾节；通道划界四者互斥（ADR/decisions、迷雾册、非目标、Out of Scope） |
| A4 | 可选能力 vs P2 需求 | 两套「可选」显式划界：P2=范围内照常建图承担全部不变量；可选能力=不建图不产生对账义务（graph-guide.md「可选能力边界」节） |
| B1 | fixHints vs reworkHints | fixHints=门禁常量表话术（G 产出）；reworkHints=V 评审产出（带 Severity 前缀）——R 是转写者（至多 3 条），两字段不混用（SSoT §10L.8 消费契约） |
| B2 | sigHash v2 vs evidence provenance | sigHash=签名链条目完整性（篡改声明→R6 重算失败）；provenance=受控本机 source-bound 流程完整性（非密码学签名，command-reference.md「Source-bound provenance 边界」节）——两机制强度如实标注 |
| B3 | scope 强制 vs 角色禁令 | scope 管「修复能碰什么」；角色禁令管「谁能跑什么」——互不替代 |
| B4 | 派单契约 vs 角色边界 | 契约管「派什么/怎么验」；同文件角色边界管「谁能做什么」——两节互补不重复 |
| B5 | L0-L4 视图 vs 既有轮次数值 | 收敛视图零新增数值：每任务 5 轮 / maxReworkRounds / maxIcebergRounds=5 均既有值引用（subagent-delegation.md L1/L2 行） |
| C2 | 威胁叙事 vs 守卫体系 | 叙事层不建自动化守卫（批次 5 D1）；守卫唯一执行体仍是门禁脚本+硬约束 |
| C4 | campaign 整批 vs 阶段回退 | 阶段 5-8 的「整批」形态已存在=阶段回退（references/workflow.md 回退目标阶段映射）；本机制补 campaign 级 |
| C1 | 迁移素材 vs 正常阶段流程 | 待输入字段表将定义「哪些变更不算迁移」；当前一切照常走阶段 5-8 流程 |

## 6. 人审锚

无新增人审点的行如实标「既有阶段门覆盖」——不虚构人审点。

| 项 | 人类检查点 | 形态 |
|---|---|---|
| A1 | 阶段门放行 🔴 CHECKPOINT（既有） | 无新增人审点——既有阶段门覆盖 |
| A2 | 阶段门放行 🔴 CHECKPOINT（既有） | 无新增人审点——既有阶段门覆盖 |
| B6 | 阶段门放行 🔴 CHECKPOINT（既有） | 无新增人审点——既有阶段门覆盖 |
| A3 | 阶段门放行前迷雾册强制清空披露 | 批次 2 既有 CHECKPOINT 接线（phase-2/3/4 验收清单项） |
| A4 | 可选能力后续转正=正式变更（用户确认） | 批次 2 既有（graph-guide.md 转正规则） |
| B1 | 阶段门放行 🔴 CHECKPOINT（既有） | 无新增人审点——既有阶段门覆盖 |
| B2 | 阶段门放行 🔴 CHECKPOINT（既有） | 无新增人审点——既有阶段门覆盖 |
| B3 | 阶段门放行 🔴 CHECKPOINT（既有） | 无新增人审点——既有阶段门覆盖 |
| B4 | 达限强制升级 L4=用户 🔴 CHECKPOINT（继续修复/接受放行/阶段回退/终止） | 批次 4 既有（分层反馈回路 L4） |
| B5 | 达限强制升级 L4=用户 🔴 CHECKPOINT | 批次 4 既有（每任务 5 轮 / maxReworkRounds / maxIcebergRounds=5 均既有上限） |
| C2 | 无新增人审点 | 三不承诺——R3/V 参考消费 |
| C4 | campaign 收口 CHECKPOINT 整批裁定 + 回收发起 | 批次 5 既有（human 唯一授权者，工具/LLM 输出不能授权） |
| C1 | 实现立项时的需求输入（用户裁定） | SSoT §10K.7 待输入字段表 |

## 7. 维护规则

机制演进时本表随之维护：已实现机制变更落点或退役 → 同步 §3/§4 对应行（退役在 §1 判定列加注）；新增吸收项（后续批次/立项）→ §1 总表续行 + §2-§6 各补一行；锚点失效（文件/节改名）→ 修锚不改判定。与 [agent-threat-model.md](../w-model-dev/references/agent-threat-model.md) §4、SSoT §10A 追溯表同款纪律；本文由批次规格流程修改，常规 `/wm` 运行不写本文。

## 8. 附录：锚点复核命令（维护用）

§7「修锚不改判定」的机械核验方式——下列命令逐一执行，预期各命中 ≥1（命中行号随版本漂移，以命中节标题为准）；B6 行的落点以批次 1 规格实读为准。上列 §2-§6 锚点于 2026-10-03 收口时全部实查命中。

```bash
# A1：SSoT §10.8 对账节
grep -n "SD-codeModule 双向精确对账" docs/skill-design-document_SSoT.md
# A2/B1：SSoT §10L.4 / §10L.8
grep -n "^### 10L.4\|^### 10L.8" docs/skill-design-document_SSoT.md
# A3：设计期迷雾登记册（phase-3/phase-4 同名节，替换文件名即可）
grep -n "设计期迷雾登记册" w-model-dev/references/phase-2-system-design.md
# A4：可选能力边界
grep -n "可选能力边界" w-model-dev/references/graph-guide.md
# B4/B5：派单契约与分层反馈回路
grep -n "派单契约：前置条件与可验证终态\|分层反馈回路" w-model-dev/references/subagent-delegation.md
# B2/C1/B4/B5/C2/C4：SSoT 权威节头（§10M/§10N/§10O 批次 2/4/5；§10K.7 素材；§7.9/§10.11 签名链）
grep -n "^### 10K.7\|^### 7.9\|^## 10.11\|^## 10M\|^## 10N\|^## 10O" docs/skill-design-document_SSoT.md
# C4：整批否决权与回收路径
grep -n "整批否决权与回收路径" w-model-dev/references/quality-standards.md
# B6：批次 1 规格 B6 节与交付记录
grep -n "B6\|悬空" docs/superpowers/specs/2026-09-30-design-code-consistency-anchors-design.md
```

## 9. 附录：五批次规格与 SSoT 权威节对照

规格文件均在 `docs/superpowers/specs/` 下；SSoT 指 `docs/skill-design-document_SSoT.md`。

| 批次 | 版本 | 规格文件 | SSoT 权威节 |
|---|---|---|---|
| 1 | 42.6.0 | 2026-09-30-design-code-consistency-anchors-design.md | §10.8 / §10.8.1（A1 对账）；§10L.4（A2 分类词条） |
| 3 | 42.7.0 | 2026-10-01-gate-engineering-design.md | §10L（10L.1/10L.2/10L.8 等）；§7.9 + §10.11（B2 签名链） |
| 2 | 42.8.0 | 2026-10-02-design-phase-fog-and-optional-capability-design.md | §10M（A3/A4） |
| 4 | 42.9.0 | 2026-10-02-batch4-dispatch-contract-design.md | §10N（B4/B5） |
| 5 | 42.10.0 | 2026-10-03-batch5-governance-narrative-design.md | §10O（C2/C4）；§10K.7（C1 素材） |

逐批次交付终值见 [CHANGELOG.md](../CHANGELOG.md) 的 42.6.0 / 42.7.0 / 42.8.0 / 42.9.0 / 42.10.0 五条目。
