# SkillOpt 方法论吸收设计（SkillOpt Methodology Absorption Design）

> **类型**：设计增量（design delta）
> **状态**：待评审
> **作用范围**：w-model-dev 技能包全资产（技能 / 模板 / 参考 / 脚本 4 类）
> **创建日期**：2026-07-26

> **参考来源**：[microsoft/SkillOpt](https://github.com/microsoft/SkillOpt) — 把 skill 文档当可训练状态，用 epoch/batch/lr/validation-gate 范式优化，输出 compact `best_skill.md`（300-2000 tokens）。

> **与 SSoT 的关系**：本文件为设计输入文档，定义 1 项架构层增强（SkillOpt 方法论吸收）。实现阶段须先把这些设计合并入 SSoT §10H（SkillOpt 方法论吸收）/ §10A（追溯表新增行）/ §10G（补充信号消费流程引用）/ §3.4.2（角色表 O 允许动作扩展），再同步 `w-model-dev/` 资产（遵循 AGENTS.md「SSoT 优先」约束）。

> **SSoT 章节占用说明**：§10C（成熟度阶梯）/ §10D（成本预算与运行日志）/ §10E（门禁退出码不可伪）/ §10F（事件驱动循环 Loop 3）/ §10G（爬坡循环 Loop 4）已占用；本设计使用 **§10H（SkillOpt 方法论吸收）**。

> **与 Loop 4 的关系**：Loop 4（hill-climbing-guide.md）产出 `HarnessImprovementReport` 信号；本设计消费该信号，应用 SkillOpt「bounded edit + validation gate」方法论对 4 类资产做离线进化。本设计是 Loop 4 信号的标准消费路径。

---

## 0. 背景与动机

### 0.1 问题陈述

w-model-dev 技能包第 10 轮（external-skills-absorption）已明确「技能自演化不在本仓库，由外部 SkillOpt/darwin-skill 完成」（SSoT §11）。第 10 轮同时引入 Loop 4（hill-climbing-guide.md）产出 `HarnessImprovementReport` 改进信号。但截至第 13 轮，Loop 4 信号**无标准消费路径**——`samples/hill-climbing/valid.json` 的 2 个信号（sig-001 prompt / sig-002 verification-rule）未被应用，4 类资产（技能/模板/参考/脚本）的离线进化流程未建立。

### 0.2 SkillOpt 与 w-model-dev 的契合度分析

SkillOpt 原始用法：优化单个 compact skill 文档（300-2000 tokens）+ 需要 benchmark/target agent + LLM 驱动 rollout/reflect。w-model-dev 是大型技能包（SKILL.md + 20 references + 12 scripts + 9 templates）+ 无现成 benchmark + 技能不内置 LLM（§3.3）。直接运行 SkillOpt 工具不可行。

但 SkillOpt 的**方法论**可类比映射：
- 「rollout → reflect → aggregate → select → update → gate」六段式训练循环
- 「bounded edit + textual learning-rate budget」（单文件单次 edit 有界）
- 「validation gate on held-out split」（改进须通过验证才接受）

本设计吸收方法论，不引入 Python 依赖、不调用 LLM、不做 rollout 训练。类比第 13 轮吸收 TLA+ 「时间推进建模模式」（tla-plus-guide.md §14）是方法论吸收而非 TLA+ 工具内置——本设计同构。

### 0.3 目标

- **优化1（机制建设）**：新增 `w-model-dev/references/skillopt-adoption.md`（SkillOpt 方法论采用指南），建立 Loop 4 信号 → bounded edit → validation gate 的标准消费路径。
- **优化2（信号应用）**：以 `samples/hill-climbing/valid.json` 2 信号为种子，扩展为覆盖 4 类资产的 10 信号 HarnessImprovementReport，应用 SkillOpt 方法论对 4 类资产做全谱进化（低风险 prompt + 高风险工具/门禁逻辑）。
- **优化3（SSoT 同步）**：SSoT §10H 新增 + §10A 追溯表新增行 + §10G 补充引用 + §3.4.2 角色表扩展。

### 0.4 设计原则

| 原则 | 本设计的遵守方式 |
|---|---|
| 技能不内置 LLM 调用（§3.3） | reflect 阶段由人（主代理）审查信号产出 edit proposal，确定性 |
| 技能自演化不在本仓库（§11） | 吸收方法论而非工具运行；不引入 Python 依赖；不调用 LLM |
| 编排者最小化（§3.4） | 离线进化场景主代理顺序执行 reflect→edit→gate，不分派子代理（资产间有依赖需协调） |
| 真实执行（约束4） | validation gate 用真实 self-test/vitest/tsc 退出码，不 LLM 估算 |
| CHECKPOINT 不可绕过（约束2） | 每个 Phase E 批次完成后 CHECKPOINT 确认 |
| SSoT 优先 | 修改设计决策先改 SSoT §10H/§3.4.2，再同步 w-model-dev/ 资产 |

### 0.5 非目标

- **不引入 SkillOpt Python 包**：不 `pip install skillopt`，不调用 SkillOpt CLI
- **不调用 LLM 做 rollout/reflect**：reflect 阶段由主代理确定性审查产出 edit proposal
- **不做 benchmark 训练**：不构造 mini-benchmark，不做 target agent rollout
- **不变更 Loop 4 信号产出逻辑**：hill-climbing-guide.md 的 HarnessImprovementReport schema 不变，仅消费其产出
- **不变更现有 check-*.ts 门禁脚本逻辑**（除 verifier-logic.ts 新增 R11/R12 + 方差注释）

---

## 1. 架构与边界

### 1.1 核心映射

把 SkillOpt 的「rollout→reflect→aggregate→select→update→gate」六段式训练循环，类比映射到 w-model-dev 的「HarnessImprovementReport 信号→reflect 产出 edit proposal→bounded edit→validation gate」离线进化流程。

| SkillOpt 训练循环 | w-model-dev 离线进化 | 说明 |
|---|---|---|
| rollout（target 执行任务） | （已完成）Loop 4 产出 HarnessImprovementReport | 信号源已就绪 |
| reflect（optimizer 分析 trajectory 产出 edit patch） | 主代理审查信号 + 产出 edit proposal | 确定性，无 LLM |
| aggregate（合并 edit patches） | 多信号合并为 edit 批次（低风险/高风险） | 按风险分批 |
| select（rank & clip edits，learning_rate=max edits） | 按 bounded edit 边界裁剪 edit 数量 | 单文件≤3、单信号≤2 文件、全轮≤15 |
| update（apply to skill doc） | 应用 edit 到 4 类资产 | 技能/模板/参考/脚本 |
| gate（validate & accept on held-out split） | self-test + vitest + tsc + fixture validation | 真实退出码 |

### 1.2 与 Loop 4 设计的边界（保持一致，不破坏）

| 角色 | 职责 | 边界 |
|---|---|---|
| **w-model-dev Loop 4** | 产出 HarnessImprovementReport 信号（已实现，hill-climbing-guide.md） | 不自动改 harness（既有边界） |
| **SkillOpt 方法论吸收（本轮新增）** | 消费信号 → reflect → bounded edit → validation gate（确定性 + 人审，无 LLM） | 不引入 SkillOpt Python 包；不调用 LLM；不做 rollout 训练 |
| **外部 SkillOpt/darwin-skill** | 真实 SkillOpt 工具运行（rollout/reflect 用 LLM） | 仍由外部完成，本仓库不内置（§11 既有约束） |

### 1.3 与 §11「技能自演化不在本仓库」原则的协调

- **§11 原意**：技能**自动演化**（LLM 驱动 rollout/reflect）不在本仓库
- **本轮吸收**：**方法论**（bounded edit + validation gate 的流程范式），不是工具运行
- **类比**：第 13 轮吸收 tla-plus-guide.md §14「时间推进建模模式」是方法论吸收，非 TLA+ 工具内置——本轮同构

### 1.4 SSoT 章节占用

- §10F（Loop 3）/ §10G（Loop 4）/ §10C/§10D/§10E 已占用
- 本轮使用 **§10H「SkillOpt 方法论吸收」**（新增）+ §10A 追溯表新增行 + §10G 补充 1 句引用 + §3.4.2 角色表扩展

### 1.5 与反模式 #10「编排者越权实施」的协调（R5 风险缓解）

反模式 #10 禁止运行时编排者越权实施阶段产物。本轮是**离线进化场景**（技能资产维护），非运行时阶段产物生成。SSoT §3.4.2 角色表扩展明确限定「离线进化场景下主代理执行 reflect→bounded edit→validation gate」属允许动作，区别于运行时编排。

| 场景 | 编排者动作 | 是否允许 |
|---|---|---|
| 运行时阶段产物生成 | 编排者只路由/状态读写/CHECKPOINT/分派子代理；实施由 S/V/G/R 子代理 | 反模式 #10 约束 |
| 离线进化场景（本轮） | 主代理执行 reflect→bounded edit→validation gate | §3.4.2 扩展允许 |

---

## 2. 信号构造与 4 类资产覆盖

### 2.1 信号来源

以 `w-model-dev/scripts/samples/hill-climbing/valid.json` 的 2 个信号为种子（sig-001 prompt / sig-002 verification-rule），扩展为覆盖 4 类资产的 10 信号 HarnessImprovementReport，存 `w-model-dev/scripts/samples/hill-climbing/expanded-2026-07-26.json`。

### 2.2 扩展信号清单（10 个信号，覆盖 4 类资产 × 2 风险等级）

| signalId | category | severity | 资产类 | 来源 | 改进点 |
|---|---|---|---|---|---|
| sig-001 | prompt | S2 | 参考 | valid.json 原信号 | verifier-spec.md §6 summary 字段内容要求收紧 |
| sig-002 | verification-rule | S1 | 脚本 | valid.json 原信号 | verifier-logic.ts 新增 summary 长度+evidence 非空校验 |
| sig-003 | prompt | S2 | 技能 | 主代理审查 SKILL.md | SKILL.md 命令接口说明强化（hill-climbing 命令参数示例） |
| sig-004 | prompt | S3 | 技能 | 主代理审查 SKILL.md | SKILL.md 反模式清单交叉引用补全（#20/#21 在自检清单引用） |
| sig-005 | prompt | S2 | 模板 | 主代理审查 review-report.md 模板 | review-report.md 模板 summary 字段增加「三要素」结构提示 |
| sig-006 | prompt | S3 | 模板 | 主代理审查 test-report.md 模板 | test-report.md 模板「测试结论」节增加量化指标占位符 |
| sig-007 | prompt | S3 | 模板 | 主代理审查 requirement-spec.md 模板 | requirement-spec.md 模板 NFR 字段增加「可测量性」提示 |
| sig-008 | verification-rule | S2 | 参考 | 主代理审查 anti-patterns.md | anti-patterns.md #20/#21 增加「检测信号」字段 |
| sig-009 | tool | S2 | 脚本 | 主代理审查 verifier-logic.ts | verifier-logic.ts rawScores 方差重算逻辑加注释+边界保护 |
| sig-010 | anti-pattern | S3 | 参考 | valid.json recommendations.candidateAntiPatterns | anti-patterns.md 新增候选反模式 #22「V 评审 summary 模板化」（标 pending V 复审） |

### 2.3 扩展报告结构

复用 hill-climbing-guide.md 的 HarnessImprovementReport schema，新增 metaAnalysis 项：

```typescript
interface HarnessImprovementReport {
  // ... 既有字段（reportId / generatedAt / analysisWindow / signals / metaAnalysis / recommendations / applicationStatus）
  
  // 新增字段（本设计扩展，存 expanded-2026-07-26.json）
  metaAnalysis: {
    // ... 既有字段（topFailurePatterns / reworkHotspots / verifierDisagreements / budgetBurnTrend / operationalFailureHits / comprehensionQuality）
    
    /** 本轮覆盖的资产类别（新增） */
    appliedAssetClasses: Array<'skill' | 'template' | 'reference' | 'script'>;
    /** 风险画像（新增，对应全谱进化） */
    riskProfile: {
      lowRisk: number;   // prompt 类信号数
      highRisk: number;  // verification-rule/tool 类信号数
    };
  };
}
```

### 2.4 信号审查流程（reflect 阶段，确定性）

1. 主代理读取 valid.json 2 个原信号 + 系统审查 4 类资产
2. 主代理产出 expanded-2026-07-26.json（含 10 信号 + metaAnalysis + recommendations）
3. 主代理对每个信号产出 edit proposal（bounded edit：明确文件路径 + old/new 文本片段）
4. 人审 edit proposal（本设计中即用户在 spec 阶段确认 + 实施阶段 CHECKPOINT 确认）

### 2.5 bounded edit 边界（借鉴 SkillOpt「textual learning-rate budget」）

- 单文件单次 edit 最多 3 处（防过度编辑）
- 单信号最多影响 2 个文件（防爆炸半径）
- 全轮总 edit 数 ≤ 15 处（本轮 10 信号预估 12-15 处）

---

## 3. 流程编排（reflect → bounded edit → validation gate）

### 3.1 离线进化场景编排原则

主代理顺序执行，不分派子代理。理由：4 类资产改动有依赖链（verifier-spec.md 规则 → verifier-logic.ts 实现 → fixture 样本 → self-test 验证），需顺序协调；离线进化非运行时编排，不触发反模式 #10——本轮是「技能资产维护」非「阶段产物生成」。

### 3.2 Phase R（Reflect，产出 edit proposal）

| 步骤 | 输入 | 动作 | 产出 |
|---|---|---|---|
| R1 | valid.json 2 信号 | 直接采纳为 sig-001/sig-002 | 2 个 edit proposal 草稿 |
| R2 | SKILL.md 全文 | 主代理审查：命令接口缺示例、自检清单未引反模式 #20/#21 → 产出 sig-003/sig-004 | 2 个 edit proposal 草稿 |
| R3 | 9 个 templates/*.md | 主代理审查：review-report.md summary 缺三要素、test-report.md 缺量化占位符、requirement-spec.md NFR 缺可测量性 → 产出 sig-005/sig-006/sig-007 | 3 个 edit proposal 草稿 |
| R4 | anti-patterns.md + verifier-logic.ts | 主代理审查：#20/#21 缺检测信号字段、verifier-logic.ts 方差重算逻辑缺注释 → 产出 sig-008/sig-009 | 2 个 edit proposal 草稿 |
| R5 | valid.json candidateAntiPatterns | 主代理提取候选反模式 #22 → 产出 sig-010（标 pending，需 V 复审） | 1 个 edit proposal 草稿 |
| R6 | R1-R5 汇总 | 主代理产出 expanded-2026-07-26.json（10 信号 + metaAnalysis + recommendations） | 扩展报告 |

### 3.3 Phase E（Bounded Edit，应用 edit proposal）

按风险等级分两批，低风险先行（快速验证流程），高风险紧随（含回归测试）：

| 批次 | 信号 | 文件 | edit 类型 | 风险 |
|---|---|---|---|---|
| E1（低风险-prompt） | sig-001 | verifier-spec.md | §6 summary 字段增「三要素」要求 + 禁模板化措辞 | 低 |
| E1 | sig-003 | SKILL.md | hill-climbing 命令增参数示例 | 低 |
| E1 | sig-004 | SKILL.md | 自检清单引用反模式 #20/#21 | 低 |
| E1 | sig-005 | templates/review-report.md | summary 字段增三要素结构提示 | 低 |
| E1 | sig-006 | templates/test-report.md | 测试结论节增量化占位符 | 低 |
| E1 | sig-007 | templates/requirement-spec.md | NFR 字段增可测量性提示 | 低 |
| E1 | sig-008 | anti-patterns.md | #20/#21 增检测信号字段 | 低 |
| E1 | sig-010 | anti-patterns.md | 新增候选 #22（标 pending V 复审） | 低 |
| E2（高风险-逻辑） | sig-002 | verifier-logic.ts + verifier-spec.md | 新增 R11 summary 长度≥50 + R12 evidence 非空校验（仅改 verifier-logic.ts，check-verifier-output.ts 不改） | 高 |
| E2 | sig-009 | verifier-logic.ts | 方差重算逻辑加注释 + 边界保护（NaN/Infinity） | 高 |

### 3.4 Phase V（Validation Gate，回归测试）

| 阶段 | 命令 | 退出码要求 | 失败处理 |
|---|---|---|---|
| V1 TypeScript strict | `npx tsc --noEmit` | 0 | 修正 edit，重跑 V1 |
| V2 self-test | `npm run self-test` | 0（基线 92→94，新增 verifier R11/R12 测试） | 修正 edit，重跑 V2 |
| V3 vitest | `cd w-model-dev && npx vitest run scripts/__tests__/` | 0（72→74，新增 verifier-logic R11/R12 单元测试） | 修正 edit，重跑 V3 |
| V4 fixture | 新增 `samples/verifier/bad-summary-too-short.json` + `bad-evidence-empty.json` | check-verifier-output exit=1 | 修正 fixture，重跑 V4 |
| V5 全量回归 | 重跑 V1-V4 全绿 | 全 0 | 任一失败回到对应阶段 |

### 3.5 新增 fixture 设计（sig-002 高风险改动配套）

- `samples/verifier/bad-summary-too-short.json`：summary 长度 < 50 字符 → 触发 R11
- `samples/verifier/bad-evidence-empty.json`：evidence 数组为空 → 触发 R12

fixture 设计原则：仅触发目标规则，其余字段保持合法（参考现有 bad-*.json 模式，避免误触发 R1-R10）。

### 3.6 self-test 基线扩展

- 现有 92 条 → 新增 2 条（R11 + R12）= 94 条
- vitest 72 条 → 新增 2 条（verifier-logic R11 + R12 单元测试）= 74 条

### 3.7 check-verifier-output.ts 规则扩展（sig-002 落地）

- 现有 R1-R10 → 新增 R11（summary 长度 ≥ 50）+ R12（evidence 非空）
- 规则文件：verifier-logic.ts 新增 `checkR11SummaryLength` + `checkR12EvidenceNonEmpty`
- 文档同步：verifier-spec.md §7 Schema 新增 R11/R12 字段说明

---

## 4. 机制建设与文档落地范围

### 4.1 新增文件（2 个）

| 路径 | 内容 | 对应决策 |
|---|---|---|
| `w-model-dev/references/skillopt-adoption.md` | SkillOpt 方法论采用指南：六段式循环类比映射 + 信号→bounded edit→validation gate 流程 + 与 Loop 4 边界 + 与 §11 协调 + 人审流程 | 建机制（方案 A 核心） |
| `w-model-dev/scripts/samples/hill-climbing/expanded-2026-07-26.json` | 扩展 HarnessImprovementReport（10 信号 + metaAnalysis + recommendations） | 信号构造产物 |

### 4.2 修改文件（按 4 类资产 + 顶层文档）

| 类别 | 文件 | 改动 | 风险 |
|---|---|---|---|
| 技能 | `w-model-dev/SKILL.md` | hill-climbing 命令增参数示例 + 自检清单引反模式 #20/#21 | 低 |
| 模板 | `w-model-dev/templates/review-report.md` | summary 字段增三要素结构提示 | 低 |
| 模板 | `w-model-dev/templates/test-report.md` | 测试结论节增量化占位符 | 低 |
| 模板 | `w-model-dev/templates/requirement-spec.md` | NFR 字段增可测量性提示 | 低 |
| 参考 | `w-model-dev/references/verifier-spec.md` | §6 summary 三要素 + §7 Schema 新增 R11/R12 | 低+高 |
| 参考 | `w-model-dev/references/anti-patterns.md` | #20/#21 增检测信号字段 + 候选 #22（pending V 复审） | 低 |
| 脚本 | `w-model-dev/scripts/verifier-logic.ts` | 新增 checkR11SummaryLength + checkR12EvidenceNonEmpty + 方差重算注释 | 高 |
| 脚本 | `w-model-dev/scripts/check-verifier-output.ts` | **不改**（CLI 入口仅调用 verifier-logic.ts 的 checkVerifierOutput()，新规则在该函数内追加） | — |
| fixture | `w-model-dev/scripts/samples/verifier/bad-summary-too-short.json` | 新增（R11 触发样本） | 高配套 |
| fixture | `w-model-dev/scripts/samples/verifier/bad-evidence-empty.json` | 新增（R12 触发样本） | 高配套 |
| 测试 | `w-model-dev/scripts/__tests__/verifier-r11-r12.test.ts`（新建） | 新增 R11/R12 单元测试 | 高配套 |
| 测试 | `w-model-dev/scripts/self-test.ts` | 基线 92→94（新增 2 条 R11/R12） | 高配套 |

### 4.3 SSoT 同步点（SSoT 优先原则）

| SSoT 章节 | 改动 | 内容 |
|---|---|---|
| §10H（新增） | 「SkillOpt 方法论吸收」 | 六段式循环类比映射 + bounded edit 边界 + validation gate 标准 + 与 §11 协调 + 人审流程 |
| §10A 追溯表 | 新增行 | §10H → `w-model-dev/references/skillopt-adoption.md` |
| §10G（扩展） | 补充 1 句 | 「Loop 4 产出的 HarnessImprovementReport 信号消费流程详见 §10H」 |
| §3.4.2 角色表 | O 允许动作扩展 | 新增「离线进化场景下主代理执行 reflect→bounded edit→validation gate」（属状态读写+分析，非实施） |

### 4.4 顶层文档同步

| 文件 | 改动 |
|---|---|
| `AGENTS.md` | §2 references 表新增 skillopt-adoption.md 行；§4 新增「第十四轮：SkillOpt 方法论吸收」结论行 |
| `CHANGELOG.md` | 新增 [14.0.0] 条目 |
| `README.md` | §「核心能力」清单新增「SkillOpt 方法论吸收」条目（在第 28 行 Loop 4 条目后）；§「架构原则与外部工具边界」表第 40 行「技能自演化」行补充说明「方法论吸收在技能内（skillopt-adoption.md），工具运行在外部」 |

### 4.5 skillopt-adoption.md 文档结构（核心新增文件大纲）

```markdown
# SkillOpt 方法论采用指南（SkillOpt Adoption Guide）
> 来源：SSoT §10H（SkillOpt 方法论吸收）。本文件为可执行细则。
> 与 Loop 4 关系：消费 Loop 4 产出的 HarnessImprovementReport 信号。

## 目录
- 设计原则
- 六段式循环类比映射（SkillOpt → w-model-dev）
- 信号→bounded edit→validation gate 流程
- bounded edit 边界规则
- validation gate 标准
- 与 Loop 4 的边界
- 与 §11「技能自演化不在本仓库」的协调
- 人审流程
- 与现有机制的关系

## 设计原则
| 原则 | 遵守方式 |
| 技能不内置 LLM（§3.3） | reflect 阶段由人审查信号产出 edit proposal，确定性 |
| 技能自演化不在本仓库（§11） | 吸收方法论而非工具运行；不引入 Python 依赖 |
| 编排者最小化（§3.4） | 离线进化场景主代理顺序执行，不分派子代理 |
| 真实执行（约束4） | validation gate 用真实退出码，不 LLM 估算 |

## 六段式循环类比映射
| SkillOpt | w-model-dev 离线进化 |
| rollout | （已完成）Loop 4 产出 HarnessImprovementReport |
| reflect | 主代理审查信号 + 产出 edit proposal |
| aggregate | 多信号合并为 edit 批次（低风险/高风险） |
| select | 按 bounded edit 边界裁剪 edit 数量 |
| update | 应用 edit 到 4 类资产 |
| gate | self-test + vitest + tsc + fixture validation |

## bounded edit 边界规则
- 单文件单次 edit 最多 3 处
- 单信号最多影响 2 个文件
- 全轮总 edit 数 ≤ 15 处

## validation gate 标准
| 阶段 | 命令 | 退出码 |
| V1 | npx tsc --noEmit | 0 |
| V2 | npm run self-test | 0 |
| V3 | cd w-model-dev && npx vitest run scripts/__tests__/ | 0 |
| V4 | npx tsx check-verifier-output.ts <fixture> | 1（触发 R11/R12） |

## 与 Loop 4 的边界
| 角色 | 职责 | 边界 |
| w-model-dev Loop 4 | 产出信号 | 不自动改 harness |
| SkillOpt 方法论吸收（本轮） | 消费信号→bounded edit→gate | 不引入 SkillOpt 工具 |
| 外部 SkillOpt/darwin-skill | 真实工具运行 | 仍由外部完成 |

## 与 §11 的协调
（§11 原意 vs 本轮吸收 vs 类比第13轮 TLA+ 方法论吸收）

## 人审流程
1. spec 阶段：用户审查设计文档
2. 实施阶段：每个 Phase E 批次完成后 CHECKPOINT 确认
3. V 复审：候选反模式 #22 需 V 子代理复审（如采用）

## 与现有机制的关系
| 机制 | 关系 |
| hill-climbing-guide.md | 上游，产出信号 |
| anti-patterns.md | 下游，候选反模式入清单 |
| self-test.ts | validation gate V2 |
| verifier-spec.md | 信号消费对象 + 规则收紧对象 |
```

---

## 5. 风险与开放问题

### 5.1 风险清单

| ID | 风险 | 影响 | 缓解 |
|---|---|---|---|
| R1 | verifier-logic.ts 新增 R11/R12 可能与现有 R1-R10 规则交叉触发（如 R11 summary 长度与 R3 subcriteria 校验冲突） | self-test/vitest 失败 | 实施前先跑现有 72 vitest 基线确认 R1-R10 语义；R11/R12 在 R1-R10 通过后追加，独立校验 |
| R2 | 新增 fixture bad-summary-too-short.json 可能误触发其他规则（如缺 reportId → R8） | V4 验证不准确 | fixture 仅触发目标规则，其余字段保持合法（参考现有 bad-*.json 模式） |
| R3 | anti-patterns.md 候选 #22「V 评审 summary 模板化」未 V 复审直接入清单，违反反模式 #19 精神 | 反模式清单质量下降 | 候选 #22 标 `pending V 复审`，本轮不正式编号；本轮跳过正式入清单，仅文档化候选（Q1-a 决策） |
| R4 | skillopt-adoption.md 与 hill-climbing-guide.md 内容可能重叠（都涉及信号消费） | 文档冗余 | 明确分工：hill-climbing-guide.md 管「信号产出」，skillopt-adoption.md 管「信号消费+方法论」；交叉引用不重复 |
| R5 | SSoT §3.4.2 角色表扩展「主代理离线进化执行」可能与反模式 #10「编排者越权实施」边界模糊 | 原则冲突 | §3.4.2 扩展明确限定「离线进化场景（技能资产维护）」，区别于「运行时阶段产物生成」；在 skillopt-adoption.md 显式声明此区分（§1.5） |
| R6 | 全谱进化涉及 12+ 文件改动，单轮工作量较大 | 实施周期长 | 按 Phase E1（低风险 8 信号）→ E2（高风险 2 信号）分批，E1 完成即可部分验证流程；E2 失败可回退不阻塞 E1 |

### 5.2 开放问题决策记录

**Q1：候选反模式 #22 的处理方式？**
- **决策**：Q1-a。本轮在 anti-patterns.md 新增候选 #22，标 `pending V 复审`，不正式编号入清单；后续可由 V 子代理复审转正。
- **理由**：遵守 Loop 4 流程；不违反 #19；候选可见可追踪。

**Q2：SSoT §3.4.2 角色表扩展是否必要？**
- **决策**：Q2-a。扩展 §3.4.2，明确「离线进化场景主代理执行 reflect→edit→gate」属允许动作。
- **理由**：与第 13 轮扩展 §3.4.10 一致；消除 R5 模糊；SSoT 优先原则满足。

---

## 6. 实施顺序与验证检查点

### 6.1 实施顺序（Part 划分）

| Part | 内容 | 验证 |
|---|---|---|
| Part A：机制建设 | SSoT §10H/§10A/§10G/§3.4.2 同步 + skillopt-adoption.md 新增 | SSoT 一致性检查 |
| Part B：信号构造 | expanded-2026-07-26.json 产出 | schema 校验（复用 hill-climbing-guide.md schema） |
| Part C：低风险应用（Phase E1） | 8 个低风险信号应用到技能/模板/参考 | V1 tsc + V2 self-test（基线不变，92 通过） |
| Part D：高风险应用（Phase E2） | 2 个高风险信号应用到脚本 + fixture + 测试 | V1-V5 全量回归（92→94, 72→74） |
| Part E：顶层文档同步 | AGENTS.md §2/§4 + CHANGELOG [14.0.0] + README 评估 | 文档一致性检查 |

### 6.2 验证检查点

| 检查点 | 命令 | 退出码 | 时机 |
|---|---|---|---|
| CP1 | `npx tsc --noEmit` | 0 | Part C/D 后 |
| CP2 | `npm run self-test` | 0 | Part C 后（92）/ Part D 后（94） |
| CP3 | `cd w-model-dev && npx vitest run scripts/__tests__/` | 0 | Part D 后（74） |
| CP4 | `npx tsx w-model-dev/scripts/check-verifier-output.ts samples/verifier/bad-summary-too-short.json` | 1 | Part D 后 |
| CP5 | `npx tsx w-model-dev/scripts/check-verifier-output.ts samples/verifier/bad-evidence-empty.json` | 1 | Part D 后 |
| CP6 | `npx tsx w-model-dev/scripts/check-verifier-output.ts samples/verifier/valid.json` | 0 | Part D 后（回归） |

---

## 7. 与现有设计文档的关系

| 文档 | 关系 |
|---|---|
| `docs/skill-design-document_SSoT.md` | 上游权威，本设计合并入 §10H/§10A/§10G/§3.4.2 |
| `docs/superpowers/specs/2026-07-25-langchain-loop-engineering-absorption-design.md` | 上游，Loop 4 信号产出设计；本设计消费其产出 |
| `w-model-dev/references/hill-climbing-guide.md` | 上游，HarnessImprovementReport schema + 信号检测逻辑；本设计消费其产出 |
| `w-model-dev/references/external-skills-absorption.md` | 同级，外部技能吸收；本设计是方法论吸收（不冲突） |
| `w-model-dev/references/anti-patterns.md` | 下游，候选反模式 #22 入清单（pending V 复审） |
| `w-model-dev/references/verifier-spec.md` | 下游，R11/R12 规则文档化 |
| `w-model-dev/scripts/verifier-logic.ts` | 下游，R11/R12 实现 |
| 第 13 轮 `2026-07-26-round13-gate-robustness-and-maturity-semantics-design.md` | 类比，第 13 轮吸收 TLA+ §14 方法论；本轮吸收 SkillOpt 方法论，同构 |

---

## 8. 引用

- [microsoft/SkillOpt](https://github.com/microsoft/SkillOpt) — SkillOpt 主仓库
- [SkillOpt 论文](https://arxiv.org/abs/2605.23904) — SkillOpt: Executive strategy for self-evolving agent skills
- [SkillOpt-Sleep 文档](https://github.com/microsoft/SkillOpt/blob/main/docs/sleep/README.md) — nightly offline self-evolution companion
- SSoT §10G「爬坡循环（Loop 4）」— HarnessImprovementReport 产出
- SSoT §11「技能自演化不在本仓库」— 边界约束
- SSoT §3.3「技能不内置 LLM 调用」— 原则约束
- SSoT §3.4.2「编排者 O 允许动作」— 角色表
- 反模式 #10「编排者越权实施」— 运行时编排边界
- 反模式 #19「R 报告未 V 复审」— 候选反模式处理参考
- `w-model-dev/references/hill-climbing-guide.md` — Loop 4 信号产出指南
- `w-model-dev/scripts/samples/hill-climbing/valid.json` — 信号种子
