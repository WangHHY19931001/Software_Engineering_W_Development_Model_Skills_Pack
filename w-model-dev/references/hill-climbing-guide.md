# 爬坡循环指南（Hill Climbing Guide）

> 来源：SSoT §10G（`docs/skill-design-document_SSoT.md`）（爬坡循环 Loop 4）。本文件为可执行细则。
>
> **目的**：把 run-log/trace 转成改进 prompt/工具/验证规则的信号。技能只产出改进信号，不自动改 harness（保持"技能自演化不在本仓库"原则）；外部 SkillOpt/darwin-skill 消费信号做演化；人审后手动应用。
>
> **架构原则**：编排者 O 确定性分析 run-log 产出报告，无 LLM 调用；分析基于实际记录，不 LLM 估算（约束4）；O 产出报告属"状态读写+分析"允许动作，非实施（反模式 #10）。

## 目录

- 设计原则
- 爬山法哲学基础
- 侦察 vs 产出两阶段
- MASS 三阶段优化
- HarnessImprovementReport Schema
- 信号检测逻辑
- 触发时机
- 与外部 SkillOpt/darwin-skill 的边界
- 报告消费流程
- 与现有机制的关系
- Loop 4 输入：retro 七类改进源与 no-op 审计

## 设计原则

| 原则 | 本指南的遵守方式 |
|---|---|
| 技能不内置 LLM 调用（§3.3） | HarnessImprovementReport 由编排者 O 确定性分析 run-log 产出，无 LLM |
| 技能自演化不在本仓库（SSoT §11） | 技能只产出改进信号，不自动改 harness；外部 SkillOpt/darwin-skill 消费信号做演化 |
| 编排者最小化（SSoT §3.4） | O 分析 run-log 产出报告属"状态读写+分析"允许动作，非实施 |
| 真实执行（约束4） | 分析基于 run-log 实际记录，不 LLM 估算 |

## 爬山法哲学基础

> 吸收自《失控》第 14 章「形态图书馆」与第 15 章「人工进化」：Loop 4 爬坡循环与 SkillOpt 的理论原型。

- **爬山法 = 沿"越来越好"的等高线必到顶峰**：只要确保始终上坡（每个 HarnessImprovementReport 改进信号都比前一个好），就必然收敛到可接受的改进——完美方案周围有"越来越差的伪方案同心环"（适应度景观）。
- **定向进化 = 监督学习 = 育种**：选择压力由育种者（人/评审）决定——育种者只做选择（淘汰不合格），不做生成；与「编排者最小化」（O 不生成内容产物、只路由/分析）一致。
- **搜索空间足够大时，有效搜索与真正创造力不可区分**：Loop 4 的变异（bounded edit）→ 选择（人审）→ 累积（validation gate 放行）→ 再变异循环，就是智能搜索。
- **死亡是最好的老师**：淘汰是最省信息、最笨的老师，但仅凭"此路不通"的二元反馈（最小信息输入）也足以驱动最大学习输出——改进信号应把失败记录本身当作最有价值的输入。

## 侦察 vs 产出两阶段

> 吸收自《agent 时代的人月神话》第 11 章：侦察成本几美分到几美元，跳过成本可能是几天。

- **Pilot-run 侦察流程**：正式任务前先跑小规模真实样本，产物可弃，学到的结论记入决策记录。
- **两阶段模式分离**：侦察阶段快速勇于犯错；产出阶段严格核对。不要把侦察的宽松带进产出，也不要用产出的严格拖慢侦察。
- **成本对照**：侦察成本几美分到几美元；跳过侦察直接正式执行的失败成本可能是几天。

## MASS 三阶段优化

> 吸收自 Agentic Design Patterns ch17（Multi-Agent System Synergy 三阶段）：先块级优化单智能体提示 → 再拓扑优化 → 最后工作流级联合优化。

- **阶段 1：单智能体提示优化**——先修单个子代理的 prompt/模板（成本最低、收益最快），不先动协作结构。
- **阶段 2：拓扑优化**——单点优化后仍不足，再调整子代理拓扑（角色分工 / persona 选择 / 交接方式）。
- **阶段 3：工作流级联合优化**——最后才动整体流程（阶段顺序 / 门禁策略 / R3 维度组合）。
- **Loop 4 信号分类**：HarnessImprovementReport 的改进信号按上述三档标注 `optimizationLevel: 1|2|3`，人审时按档位排优先级（先 1 后 2 后 3）。
- **与「Loop 4 不自动改 harness」的关系**：本方法论只用于人审时对改进信号排序，不改变"人审后手动应用"的边界。

## HarnessImprovementReport Schema

编排者 O 在用户请求或 L3 定期触发时产出，存 `.w-model/hill-climbing/<timestamp>-report.json`。

```typescript
interface HarnessImprovementReport {
  /** 报告 ID */
  reportId: string;
  /** 生成时间 ISO 8601 */
  generatedAt: string;
  /** 分析窗口 */
  analysisWindow: {
    from: string;          // 起始时间
    to: string;            // 结束时间
    runLogEntries: number; // 涉及的 run-log 条目数
    phasesCovered: number[]; // 涉及的阶段
  };
  /** 检测到的改进信号 */
  signals: Array<{
    signalId: string;
    /** 信号类别 */
    category: 'prompt' | 'tool' | 'verification-rule' | 'anti-pattern' | 'maturity' | 'budget';
    /** 严重度（S1=高/S2=中/S3=低） */
    severity: 'S1' | 'S2' | 'S3';
    /** 证据（来自 run-log） */
    evidence: {
      runLogRefs: string[];  // 关联的 run-log 条目 ID
      patterns: string[];    // 检测到的模式描述
      metrics: {             // 量化指标
        occurrences: number;
        trend: 'increasing' | 'stable' | 'decreasing';
      };
    };
    /** 改进建议（人审后手动应用） */
    suggestion: string;
    /** 受影响的技能资产路径 */
    affectedAssets: string[];
    /** 建议的应用优先级（1=立即，2=下个版本，3=backlog） */
    priority: 1 | 2 | 3;
  }>;
  /** 元分析（跨信号聚合） */
  metaAnalysis: {
    /** 高频失败模式 Top 3 */
    topFailurePatterns: string[];
    /** 返工热点阶段（返工次数 > 平均+Nσ） */
    reworkHotspots: string[];
    /** V-G 矛盾次数（V passed=true 但 G exit=1） */
    verifierDisagreements: number;
    /** 预算消耗趋势 */
    budgetBurnTrend: 'increasing' | 'stable' | 'decreasing';
    /** O 系列失败模式命中频次 */
    operationalFailureHits: Record<string, number>;
    /** acknowledgedDecisions 信息质量（重复/空白比例） */
    comprehensionQuality: {
      emptyOrTrivialRate: number;  // 空/trivial 占比
      uniqueDecisionRate: number;  // 唯一决策占比
    };
  };
  /** 改进建议聚合 */
  recommendations: {
    /** prompt 措辞改进建议 */
    promptTweaks: string[];
    /** 工具改进建议 */
    toolImprovements: string[];
    /** 验证规则收紧建议 */
    verificationRuleTightening: string[];
    /** 候选新增反模式（待人审后加入 hard-constraints.md） */
    candidateAntiPatterns: string[];
    /** 成熟度阶梯调整建议 */
    maturityAdjustments: string[];
  };
  /** 应用状态（人审后填写） */
  applicationStatus?: {
    reviewedBy: string;
    reviewedAt: string;
    appliedSignals: string[];   // 已应用的 signalId
    deferredSignals: string[];  // 延后的 signalId
    rejectedSignals: string[];  // 拒绝的 signalId
    notes?: string;
  };
}
```

## 指标映射（metrics-report.ts orchestration 区复用）

`HarnessImprovementReport` 的多项 metaAnalysis 指标可直接由 `metrics-report.ts`（`scripts/cli/metrics-report.ts`）派生，避免重复实现统计逻辑：

| metaAnalysis 指标 | metrics-report 数据源 | 说明 |
|---|---|---|
| `reworkHotspots` | `rework.maxConsecutiveRuns` + `byPhase[].rework` | 按阶段聚合返工次数，超均值 + Nσ 即热点 |
| `verifierDisagreements` | `gate.passed` vs run-log V 记录 `passed` 交叉 | V passed=true 但 G exit=1 的频次 |
| `budgetBurnTrend` | `budget.byPhase[].burnRate` 时间序列 | 窗口切片后比对趋势 |
| `comprehensionQuality` | run-log checkpoint `acknowledgedDecisions` | 直接读 run-log 字段 |
| （补充）R3 审查质量 | `orchestration.r3.findingsBySeverity` / `avgFindingsPerReport` | R3 findings 密度趋势 → prompt 预防效果信号 |
| （补充）冰山扫掠收敛性 | `orchestration.iceberg.roundsDistribution` / `totalNewFindings` / `maxRound` | 轮次分布右移 / 新发现不降 → S-fix 质量信号 |
| （补充）返工提示密度 | `orchestration.reworkHints.avgHintsPerEntry` | 提示密度上升 → V 评审粒度变化信号 |

> `orchestration` 区数据源：run-log + `.w-model/preventive-reviews/` + `.w-model/iceberg/`（存在才统计，缺失 → null）；只读统计，无门禁语义。

## 信号检测逻辑（确定性，无 LLM）

| 信号类别 | 检测逻辑 | 关联失败模式 |
|---|---|---|
| **prompt** | V 评审 summary 信息熵低（重复模板/空泛）→ prompt 不够具体 | O3 Verifier Theater |
| **prompt** | R 根因报告反复定位到同一类根因 → prompt 未预防该类错误 | F1-F10 |
| **tool** | G 门禁脚本同一规则连续失败 → 工具未预防该缺陷 | O2 State Rot |
| **verification-rule** | V passed=true 但 G exit=1 频次 > 阈值 → V 评审规则过松 | O3 Verifier Theater |
| **anti-pattern** | run-log note 字段反复出现同类问题 → 候选新增反模式 | 新候选 |
| **maturity** | L1+ 操作型 CHECKPOINT 自动放行后误判率 > 10% → 成熟度升级过早 | O4/O5 |
| **budget** | 单阶段 token 连续 3 阶段递增 → 范围蔓延或 prompt 膨胀 | O1 Token Burn |
| **budget** | acknowledgedDecisions 重复率 > 30% → O4 命中趋势 | O4 Comprehension Debt |

**信息熵低判定**（确定性启发式，非 LLM）：
- summary 长度 < 50 字符 → 可能信息不足
- summary 跨多个 V 评审的 Jaccard 相似度 > 0.8 → 可能模板化
- summary 不含本阶段具体决策关键词 → 可能空泛

## 触发时机

| 触发方式 | 条件 | 动作 |
|---|---|---|
| 用户请求 | `/wm hill-climbing` 命令 | O 分析全量 run-log 产出报告 |
| 阶段门后自动 | 每个阶段门放行后 | O 增量分析本阶段 run-log，append 信号到当前报告 |
| 定期触发（L3） | maturity.level=L3 且距上次报告 ≥ 7 天 | O 自动产出全量报告 |
| 失败模式命中 | O 系列失败模式命中 ≥ 2 次 | O 强制产出专项报告 |

## 与外部 SkillOpt/darwin-skill 的边界

| 角色 | 职责 | 边界 |
|---|---|---|
| **w-model-dev Loop 4** | 产出 HarnessImprovementReport（信号） | 不自动改 harness；不调用 LLM；不重写 prompt/工具/验证规则 |
| **外部 SkillOpt/darwin-skill** | 消费信号做技能自演化 | 重写 prompt/工具/验证规则；可能用 LLM |
| **人** | 审查报告 + 决定应用哪些信号 | 低风险（prompt 措辞）人审后手动改；高风险（工具/门禁逻辑）人审+回归测试 |

## 报告消费流程

```
1. O 产出 HarnessImprovementReport → 存 .w-model/hill-climbing/<ts>-report.json
2. O 在 CHECKPOINT 展示报告摘要（signals 数 + topFailurePatterns + recommendations）
3. 人审查报告：
   - 决定 appliedSignals / deferredSignals / rejectedSignals
   - 填入 applicationStatus
4. 人手动应用改进：
   - 低风险（prompt 措辞）：直接改 w-model-dev/references/*.md
   - 高风险（工具/门禁逻辑）：改后须跑 self-test + vitest 回归
5. O 将 applicationStatus 写回报告
6. run-log append action=hill-climbing outcome=success
```

## 与现有机制的关系

| 机制 | 与爬坡循环的关系 |
|---|---|
| run-log.jsonl | Loop 4 的主要分析输入 |
| R 根因报告 | Loop 4 的次要分析输入（根因模式聚合） |
| V 评审报告 | Loop 4 的次要分析输入（summary 信息质量） |
| budget.json | Loop 4 检测预算信号（O1 Token Burn） |
| maturity.json | Loop 4 检测成熟度信号（O4/O5）；报告触发时机受 level 影响 |
| hard-constraints.md | Loop 4 产出候选反模式 → 人审后加入清单 |
| 反模式 #10（编排者越权） | O 产出报告是允许动作；不产出实施内容 |

## Loop 4 输入：retro 七类改进源与 no-op 审计

> **来源性质：思想来源，非已验收实践（上游为 STUB）。** 来源为外部仓库 `skills/in-progress/retro/SKILL.md:17-23,31-35,41`（台账 M14：`docs/superpowers/sources/2026-09-14-mattpocock-skills-adopted-excerpts.md:594-624`）。该技能在上游被单独标为 **STUB：仅有设计笔记，尚不可用**（`docs/superpowers/specs/2026-09-14-external-repo-capability-survey.md:42`），同一 survey 在 :99 / :198 明示其**「不可引用为已验收实践」**。本节是按该思想改造出的 W 模型侧输入清单，**未经本仓验收**，不得声称其为外部已验证机制；引用本节时须保留本标注。
>
> **用法**：七类是**人审（或 CHECKPOINT 上编排者只读转述）的提问清单**，对照 run-log 逐项自问"这次会话里有没有这一类改进机会"；它们**不新增自动检测逻辑**，也不引入 LLM 调用（与本文件架构原则一致：确定性信号仍只有「信号检测逻辑」一节的 8 类）。

### 七类改进源 → 既有信号的映射

| retro 类别（上游行号） | 上游触发条件（_when_） | 输入到既有 8 类信号 / HarnessImprovementReport 字段 |
|---|---|---|
| 导航 Navigation（`:17`） | 会话花了很久才找到某条信息 | **仅作分析视角，不映射信号**——8 类信号无「查找路径 / 导航耗时」检测逻辑，run-log 亦无对应字段；若人审据此行动，改进文本写入 `recommendations.promptTweaks`（导航指针），不新增检测逻辑 |
| 自动化检查 Automated checks（`:18`） | agent 犯了**本可被自动检查捕获**的错误 | `tool`（「G 门禁脚本同一规则连续失败 → 工具未预防该缺陷」）→ `recommendations.toolImprovements` |
| 编码标准 Coding standards（`:19`） | 评审者**没抓到**某类错误 | `verification-rule`（「V passed=true 但 G exit=1 频次 > 阈值 → V 评审规则过松」）→ `recommendations.verificationRuleTightening`；施加者是 V 而非 S（见下「标准归评审者」） |
| 全局 AGENTS.md（`:20`） | steering 文件（仓库或用户全局）特别大 | 规模侧参考 `budget`（「单阶段 token 连续递增」）与 `metaAnalysis.comprehensionQuality`；行动项 = 把指令迁往编码标准（→ `verification-rule`）或自动化检查（→ `tool`），而非继续堆 AGENTS.md |
| 工具经济性 Tool economy（`:21`） | agent 做了昂贵的工具调用 | `budget`（token 膨胀 / 长尾工具调用）→ `recommendations.toolImprovements` |
| **no-op（`:22`）** | steering 文件大而难维护 | **仅作分析视角，不映射信号**——「行为是否改变」在 run-log 中无可观测差异，确定性检测不可得；行动项是**移除**无效指令，写入 `recommendations.promptTweaks`，**不**写入 `candidateAntiPatterns`（见下「no-op 审计」） |
| 信息可达性 Information access（`:23`） | 关键信息对 agent 不可得 | `tool`（日志 tee / 只读接入等工具与信息通道缺失）→ `recommendations.toolImprovements` |

### no-op 审计

**找什么**：steering 文件里**不改变 agent 行为**的指令（"look for instructions in steering files that don't modify the agent's behavior"）——即那些**看起来做了、行为却没有变化**的改动。

- **判定证据**：判断某条指令是 no-op 须附**前后对照证据**（同一输入下产出是否有差异 / 门禁退出码是否变化 / V finding 分布是否变化）；**禁止凭印象判定**（约束 4：不 LLM 估算）。
- **处置**：确认为 no-op 的指令是**删除候选**，不要"换个说法再解释一遍"；建议写入 `recommendations.promptTweaks`，由人审后手动应用（本文件既有边界：技能只产出信号，不自动改 harness）。
- **与既有 `prompt` 信号的关系**：no-op 是 `prompt` 类改进的**镜像**——既有检测逻辑找"该加什么"，no-op 审计找"该删什么"；但它**没有**确定性检测逻辑（见上表），只能作为人审视角。
- **边界（不得升级为反模式）**：no-op 审计是**审计维度，不是新反模式条目**——本节落地不新增 `hard-constraints.md` 反模式（`maxAntiPattern` 计数不变），其产出不得走 `recommendations.candidateAntiPatterns`，以免把「删掉无效指令」变成「新增一条禁令」。

### 标准归评审者

> 上游推理（`:29-35`）：实现者的**上下文压力最大**（要探索、写码、调错）；评审者的压力最小（收到的是 diff，无需探索、通常无需写码调试）——故**编码标准应由评审者施加，而不是实现者**。

- **落位**：风格 / 标准类规则写入 V 的 persona（`agent-personas.md`）与 `verifier-spec.md` 的检查项，**不**写进 S 的 prompt；S 的 prompt 只承载任务上下文与门禁判据。
- **对 AGENTS.md 的增改极度克制**：steering 文件会被推入每个 agent 的上下文窗口（`:41`），应"极度克制"，通常只用于**导航指针**；能迁到编码标准或自动化检查的指令就迁过去（与上表「全局 AGENTS.md」一行的行动项一致）。
- **不改变既有职责划分**：V 仍只通过 finding / `reworkHints` 施加标准，修改仍由 S / R 走既有返工链；本节不授权 V 自行改代码，也不改变「编排者最小化」边界（反模式 #10）。
- **与「技能自演化不在本仓库」的关系**：本节只影响人审时的改进方向取舍（标准类信号优先落 V 侧资产），不改变"人审后手动应用"的边界。
