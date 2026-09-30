# 13 来源吸收批次总纲（总-分结构的「总」）

> **日期**：2026-09-30
> **状态**：生效（用户裁定采「轻量总纲 + 批次详细规格」折中，不采纯总分）
> **来源**：13 个外部来源吸收分析 + 三轮仓内对比复核 + 批次 1 头脑风暴（全部裁定记录见 §6）
> **定位**：本总纲是五批次**跨批次共享契约的唯一权威**；各批次详细规格管实施细节。共享契约（§4）冲突时以本总纲为准，实施细节以各批次规格为准。批次 5 的未裁事项（C2 边界裁定、C1 需求输入）是**立项时的输入**，本总纲不预定。

---

## 1. 五批次总览

| 批次 | 内容 | 主要改动面 | 状态 |
|---|---|---|---|
| 1 一致性主线 | A1 档三（锚点+双向对账）+ A2 诊断增强 + B6 悬空引用 | templates、gate-logic、state-machine/code-tla logic、rtm-guide | **规格已提交**（[2026-09-30-design-code-consistency-anchors-design.md](./2026-09-30-design-code-consistency-anchors-design.md)），待实现计划 |
| 2 设计期未决问题 | A3 设计期迷雾登记册 + A4 可选能力≠运行时边 | templates/system-design、phase-2/3/4、graph-guide | 未立项 |
| 3 门禁工程 | B1 StructuredViolation 扩展 + B2 GATE_JSON/签名链字节绑定 + B3 fixRecommendation scope 字段 | lib/types、gate-report、gate-log-writer、signature-chain、root-cause + schemas | 未立项 |
| 4 派单与流程契约 | B4 派单可验证终态+preconditions+eval 语料 + B5 分层反馈回路+无限返工反模式候选 | subagent-delegation、phase-5、hard-constraints、eval/mappings | 未立项 |
| 5 治理与叙事 | C2 agent 威胁模型（前置裁定）+ C4 整批否决权/回收路径 + C1 Phase 5-8 迁移素材 | SSoT、verifier-spec、quality-standards、code-health-governance | 未立项（阻塞条件见 §3） |

## 2. 顺序依赖图

```
批次1 ──地基（classification 字段 + GATE_JSON 扩展 + 注入面）──→ 批次3（建造其上）
批次2 ──独立（改动面与 1/3 不相交）
批次4 ──独立（词汇引用总纲契约，见 §4.1）
批次5 ←─阻塞于：C2 须先 SSoT 层裁定是否放宽 verifier-spec:671「不构建守卫体系」；
              C1 须先有 Phase 5-8 需求输入（SSoT 现仅有否定边界，无设计锚点）
```

推荐顺序 **1 → 3 → 2 → 4 → 5**（3 紧跟 1：批次 1 实施暴露的注入面/字段形态事实应趁热塑形批次 3 设计）；1 → 2 → 3 → 4 亦可，无硬依赖。

## 3. 批次 5 立项条件（总纲不预定，仅登记）

- **C2**：先由用户在 SSoT 层裁定「agent 威胁模型是否突破 `verifier-spec.md:671` 既有边界」——这是设计决策，不是文档增补；未裁定前批次 5 不含 C2。
- **C1**：Phase 5-8 迁移能力须先有需求输入（目标迁移类型/规模/边界）；SSoT §10K 现仅「未实现、不得据此执行」。
- **C3（排除）**：first-pass 通过率等指标需先扩 run-log 轮次归组字段，另行立项，不属五批次。

## 4. 跨批次共享契约（唯一权威）

### 4.1 ChangeClassification 词汇表

| 值 | 定义 | 首个产出点 | 后续引用 |
|---|---|---|---|
| `semantic` | 语义/映射/不变式内容差异 | 批次 1：code-tla 维度 1/4、SDMAP-1/2/5 | 批次 3 fixHints 排序、批次 5 C4 回收路径 |
| `topology` | 集合成员差异（状态/转移/分支缺余） | 批次 1：state-machine 全部差异、code-tla 维度 2/3 | 同上 |
| `evidence-only` | 断言未变、仅证据位置失效（路径不存在/锚点行号非法） | 批次 1：SDMAP-3/4 | 同上 |

- `cosmetic` **明确不引入**（archify 的 geometry 类比在流程一致性域无对应物）。
- **演进规则**：新增取值或语义修订须先改本总纲、再入批次规格；批次 3/4/5 引用本表**不得另造近义词**。

### 4.2 StructuredViolation 扩展路线

- 现状：`{rule: string; field?: string; message: string}`（`w-model-dev/scripts/lib/types.ts:11-15`），扩展点单点在 `lib/types.ts`。
- 批次 1：+ 可选 `classification?: ChangeClassification`。
- 批次 3：+ 可选 `subject?: string`（符号级定位，面向修复者 LLM）+ 可选 `fixHints?: string[]`。
- **约束**：新字段一律可选、向后兼容；不得重命名/收窄既有字段。

### 4.3 GATE_JSON 演进约定

- 批次 1：violations 分布**计数口径不变**；structuredViolations 条目可选 classification；SDMAP 计数进分布；注入面子项缺失记 `skipped`（不冒充 `passed`）。
- 批次 3：字节绑定 = **新增可选** artifacts 哈希清单字段（gate-log-writer / JsonReport 层），不改既有字段语义，与批次 1 字段正交。
- **约束**：`XXX_JSON` 消费者向后兼容零破坏；新增键一律可选。

### 4.4 收口物

`ai-native-sdlc-adoption.md`（adoption 文档，skillopt 六段骨架：吸收/不吸收→映射→落点→门禁接线→与既有机制划界→人审锚）：**全部批次完成后作为收口撰写**，不属任何单批次；吸收/不吸收清单以复核报告为源。

## 5. 批次状态登记（随立项更新本表）

| 批次 | 规格 | 实现计划 | 状态 |
|---|---|---|---|
| 1 | 2026-09-30-design-code-consistency-anchors-design.md（commit 31730600） | — | 待计划 |
| 2 | — | — | 未立项 |
| 3 | — | — | 未立项 |
| 4 | — | — | 未立项 |
| 5 | — | — | 未立项（条件见 §3） |

## 6. 已裁定决策登记

| # | 决策 | 裁定 |
|---|---|---|
| D1 | 批次划分 | 五批次，逐批规格→计划→实现 |
| D2 | A1 强度 | 档三（最严） |
| D3 | 存量迁移 | 硬切全量 |
| D4 | A2 形态 | 诊断增强型（阻断性不变） |
| D5 | 总分结构 | 轻量总纲（本文件）+ 批次详细规格；不采纯总分（批次 5 缺裁定/缺需求输入不可预设计；批次 3 应吸收批次 1 实施事实） |

## 7. 明确不吸收清单（防重复讨论，来源：复核报告）

archify 视觉设计系统/渲染器/viewer；DHH「可以不看代码」（域限定个人激进态，与「验收必须全量」相反）；Anthropic managed settings/egress/沙箱具体配置（吸收原则不吸收配置）；Stripe devbox/Toolshed/goose fork、Spotify 自研 CLI 等基建实现；Basecamp agent-accessible 产品策略；Endless execution 哲学抒情。
