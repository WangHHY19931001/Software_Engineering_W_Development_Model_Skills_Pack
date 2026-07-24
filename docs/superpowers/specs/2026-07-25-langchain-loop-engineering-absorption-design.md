# 设计：LangChain Loop Engineering 4 层循环模型吸收

> **类型**：设计增量（design delta）
> **状态**：待评审
> **作用范围**：w-model-dev 技能包全阶段（事件驱动循环 Loop 3 + 爬坡循环 Loop 4）
> **创建日期**：2026-07-25
> **依赖**：[skill-design-document_SSoT.md](../../skill-design-document_SSoT.md) §3.3 / §3.4 / §4 / §10C / §10D / §11 / §11.2；[w-model-dev/SKILL.md](../../../w-model-dev/SKILL.md)「不可违反的约束」/「编排者-子代理边界」；[w-model-dev/references/operational-recovery.md](../../../w-model-dev/references/operational-recovery.md)；[w-model-dev/references/data-models.md](../../../w-model-dev/references/data-models.md)；[w-model-dev/references/subagent-delegation.md](../../../w-model-dev/references/subagent-delegation.md)；[w-model-dev/references/anti-patterns.md](../../../w-model-dev/references/anti-patterns.md)；[loop-engineering-adoption-design.md](../../loop-engineering-adoption-design.md)（cobusgreyling 源，互补）
>
> **参考来源**：[The Art of Loop Engineering](https://www.langchain.com/blog/the-art-of-loop-engineering)（LangChain blog, Sydney Runkle, 2026-06-16）—— 4 层循环模型（Agent / Verification / Event-driven / Hill Climbing）+ 人机协同 4 层
>
> **与 SSoT 的关系**：本文件为设计输入文档，定义 2 项架构层增强（Loop 3 事件驱动循环 + Loop 4 爬坡循环）。实现阶段须先把这些设计合并入 SSoT §10F（事件驱动循环）/ §10G（爬坡循环）/ §3.4.2（角色表 O 允许动作扩展）/ §10A（追溯表新增行），再同步 `w-model-dev/` 资产（遵循 AGENTS.md「SSoT 优先」约束）。
>
> **SSoT 章节占用说明**：§10C（成熟度阶梯）/ §10D（成本预算与运行日志）/ §10E（门禁退出码不可伪）已占用；本设计使用 §10F/§10G。

## 0. 背景与目标

### 0.1 问题陈述

对 [LangChain "The Art of Loop Engineering"](https://www.langchain.com/blog/the-art-of-loop-engineering) 的深入调研表明：w-model-dev 在 **Loop 1（Agent）+ Loop 2（Verification）** 上已显著强于 LangChain 模型（O/A/S/V/G/R 五角色 + 确定性门禁脚本 + TLA+ 行为建模 + LLM-as-a-Verifier 双轨），但存在 2 项**架构层缺口**：

1. **Loop 3 Event-driven 缺失**：LangChain 模型把 agent 接到 Slack/webhook/cron 等事件源，使其成为业务流程里的长期组件。w-model-dev 现设计明确"不照搬调度自动化（cron/`/loop`）"——这对 **greenfield 一次性 8 阶段**正确，但对**棕地持续维护**场景（bug 修复、需求变更、回归失败、安全事件）缺失事件接驳能力。
2. **Loop 4 Hill Climbing 缺失**：LangChain 模型用 trace 分析 agent 失败/重试/校验记录，转成改 prompt/工具/验证规则的信号。w-model-dev 的 run-log.jsonl（已有）+ R 根因报告（已有）+ V 评审报告（已有）是天然的 trace 源，但缺分析产出机制。SSoT §11 明确"技能自演化不在本仓库"（由外部 SkillOpt/darwin-skill 完成），但**产出改进信号**与**自动应用改进**是两件事——本设计补前者。

### 0.2 目标

- **优化1（Loop 3）**：引入 EventIngress schema + 棕地条件性路由（L2+ 成熟度激活），事件按类型路由到单阶段（非完整 8 阶段重跑）。不引入 cron/webhook 调度基础设施（遵循 SSoT §11.2"外部集成由消费方自行实现"）。
- **优化2（Loop 4）**：引入 HarnessImprovementReport（确定性分析 run-log 产出，无 LLM），含改进信号 + 元分析 + 建议聚合。人审后手动应用，不自动改 harness（保持"技能自演化不在本仓库"原则）。

### 0.3 设计原则

本设计严格遵循 w-model-dev 现有架构原则，2 项优化均为**增量、声明式、不破坏现有机制**：

| 原则 | 本设计的遵守方式 |
|---|---|
| 技能不内置 LLM 调用（§3.3） | EventIngress 路由 + HarnessImprovementReport 分析均确定性，无 LLM |
| 脚本自包含仅依赖 tsx | 不新增脚本；event-ingress.jsonl / hill-climbing 报告由编排者 O 维护，类比 budget/maturity 状态文件 |
| 编排者最小化（§3.4） | O 事件路由 + 报告产出属"状态读写+分析"允许动作；不改 S/V/G/R 边界 |
| CHECKPOINT 不可绕过（约束2） | Loop 3 高风险路径强制决策型 CHECKPOINT；Loop 4 报告应用须人审 |
| 真实执行（约束4） | 分析基于 run-log 实际记录；不 LLM 估算 |
| 技能自演化不在本仓库（§11） | Loop 4 只产出信号，不自动改 harness；外部 SkillOpt/darwin-skill 消费信号做演化 |
| 外部集成由消费方自行实现（§11.2） | Loop 3 不内置 cron/webhook，只定义 EventIngress schema + 路由表 |
| 按需加载（约束6） | event-ingress/hill-climbing 在 L2+ 激活时加载，不一次性载入 |
| 反模式 #10（编排者越权） | O 路由 + 分析是允许动作；不产出实施内容 |

### 0.4 不在范围内

- **不引入调度基础设施**：技能不内置 cron 调度器、webhook 服务器、GitHub Actions 集成、Slack bot。消费方自行实现触发器写入 `event-ingress.jsonl`。
- **不自动应用 harness 改进**：Loop 4 只产出报告，不自动改 prompt/工具/验证规则。人审后手动应用。
- **不新增门禁脚本**：Loop 3/4 不改 `check-*.ts` 脚本逻辑；EventIngress 路由 + HarnessImprovementReport 分析由编排者 O 确定性执行。
- **不变更现有 loop-engineering-adoption-design.md**：cobusgreyling 源设计独立，通过 SSoT §10A 追溯表统一关联，不互改。
- **不重建 w-model-dev-demo**：参考实现已归档，本次增强不重建 demo。

---

## 1. 4-loop 概念映射与架构定位

### 1.1 LangChain 4-loop 到 w-model-dev 的映射

| LangChain Loop | 抽象定义 | w-model-dev 实现 | 状态 |
|---|---|---|---|
| **Loop 1 Agent** | 模型+工具循环到任务完成 | O/A/S/V/G/R 子代理分派循环（每阶段 S→V→G，返工 V/G→R→V→G→S-fix→V→G） | ✅ 已有 |
| **Loop 2 Verification** | grader+rubric+失败重试 | V 子代理（LLM-as-a-Verifier 五轴评审）+ G 门禁脚本（确定性退出码）+ TLA+ 行为门禁 | ✅ 更强（双轨：LLM 评审 + 确定性门禁） |
| **Loop 3 Event-driven** | Slack/webhook/cron 触发 agent | EventIngress schema + 棕地条件性路由（L2+ 成熟度，事件→单阶段路由） | 🆕 本设计新增 |
| **Loop 4 Hill Climbing** | trace 分析→改进 harness | HarnessImprovementReport 产出（确定性分析 run-log，无 LLM）+ 人审后手动应用 | 🆕 本设计新增 |

### 1.2 人机协同 4 层映射

| LangChain 人机协同点 | w-model-dev 实现 |
|---|---|
| Agent Loop 敏感工具调用前人审 | 🔴 CHECKPOINT 决策型（auth/加密/发布/架构变更高风险路径强制 attended，L3 亦然） |
| Verification Loop 人作为 grader | V 子代理 LLM-as-Verifier + G 确定性门禁双轨；O4 acknowledgedDecisions 防橡皮图章 |
| Event-driven Loop 人审批输出 | 阶段门放行 acknowledgedDecisions（理解证据机制，优化4） |
| Hill Climbing Loop harness 改动人审 | HarnessImprovementReport 由人审查后手动应用（不自动改 harness） |

### 1.3 与现有 loop-engineering-adoption-design.md 的关系

| 维度 | cobusgreyling 源（现有） | LangChain 源（本设计） |
|---|---|---|
| 抽象层级 | 运维模式（budget/run-log/maturity/O1-O6） | 概念架构（4-loop 模型） |
| 关注点 | "运行是否健康、成本是否可控" | "agent 外围 harness 如何分层、如何改进" |
| 互补点 | Loop 4 分析的输入是 Loop 1-3 产生的 run-log | Loop 1/2 已有，Loop 3/4 是本设计补的缺口 |
| 落地形式 | 状态文件 + 编排者维护职责 | 事件 schema + 改进报告 schema + 路由表 |

两份设计文档通过 SSoT §10A 追溯表统一关联，不在文档头部互加 "see also"。

---

## 2. 优化1：Loop 3 Event-driven（棕地条件性路由）

### 2.1 激活条件

| 条件 | 要求 |
|---|---|
| 成熟度级别 | maturity.json.level ≥ L2（L0/L1 attended 不激活） |
| 项目模式 | 棕地维护（greenfield 首次跑不激活） |
| 高风险路径 | 即使 L3，涉及 auth/加密/发布/架构变更的事件强制决策型 CHECKPOINT |

**与现有原则的调和**：现有"不照搬调度自动化"原则针对 **greenfield 一次性 8 阶段**场景保留；本设计为**棕地持续维护**场景扩展原则——W 模型作为棕地维护组件运行时，可按事件路由到单阶段。

### 2.2 EventIngress Schema

> 编排者 O 维护 `.w-model/event-ingress.jsonl`（append-only），类比 run-log.jsonl。消费方自行实现 webhook/cron 触发器写入此文件（遵循 SSoT §11.2"外部集成由消费方自行实现"）。

```typescript
interface EventIngress {
  /** 事件 ID（UUID 或时间戳） */
  eventId: string;
  /** 时间戳 ISO 8601 */
  timestamp: string;
  /** 事件来源（消费方自填，技能不内置触发器） */
  source: 'webhook' | 'cron' | 'manual' | 'external-ci' | 'user-report';
  /** 事件类型，决定路由到哪个阶段 */
  eventType: 'bug-report' | 'requirement-change' | 'acceptance-failure'
           | 'regression-detected' | 'scheduled-review' | 'security-incident';
  /** 事件摘要 */
  summary: string;
  /** 受影响的产物路径（如有） */
  affectedArtifacts?: string[];
  /** 受影响的需求 ID（如有，对应 rtm.json） */
  affectedRequirements?: string[];
  /** 证据（链接/日志/截图路径） */
  evidence?: string[];
  /** 路由决策（编排者 O 填写） */
  routedTo?: {
    phase: number;
    phaseName: string;
    routedAt: string;
    /** 是否触发高风险路径强制 CHECKPOINT */
    highRiskGate: boolean;
  };
}
```

### 2.3 事件 → 阶段路由表

| eventType | 目标阶段 | 触发条件 | 高风险路径 |
|---|---|---|---|
| `bug-report` | 阶段 5（编码修复） | L2+，bug 涉及已存在代码 | 涉及 auth/加密代码 → 强制 CHECKPOINT |
| `requirement-change` | 阶段 1（需求重跑） | L2+，需求变更须回退到阶段 1 | 架构变更 → 强制 CHECKPOINT |
| `acceptance-failure` | 阶段 8（验收重跑） | L2+，验收失败重跑验收 | 发布放行 → 始终 attended |
| `regression-detected` | 阶段 6/7（集成/系统测试） | L2+，回归测试失败 | - |
| `scheduled-review` | 阶段 8（验收回顾） | L3，定期回顾 | 发布放行 → 始终 attended |
| `security-incident` | 阶段 4（详细设计重审） | L2+，安全事件须回退设计 | 强制 CHECKPOINT |

### 2.4 编排者路由逻辑（确定性，无 LLM）

```
1. 读取 event-ingress.jsonl 末尾未路由事件（routedTo 为空）
2. 读取 maturity.json.level
3. 若 level < L2 → 拒绝路由，run-log append note="L<N> 不支持事件驱动"
4. 识别 eventType，查路由表得目标阶段
5. 检查高风险路径：
   - 若 affectedArtifacts 含 auth/加密/发布相关 → highRiskGate=true
   - 若 eventType=requirement-change 且涉及架构变更 → highRiskGate=true
6. 写入 routedTo，append run-log action=event-route
7. 触发目标阶段执行（单阶段，非完整 8 阶段）：
   - 若 highRiskGate=true → 决策型 CHECKPOINT 等用户确认
   - 否则按当前 maturity level 操作型 CHECKPOINT 规则
8. 阶段完成后，事件标记为 resolved
```

### 2.5 不引入的调度基础设施

| 不引入 | 理由 |
|---|---|
| cron 调度器 | SSoT §11.2"外部集成由消费方自行实现"；技能不内置调度 |
| webhook 服务器 | 同上 |
| GitHub Actions 集成 | 同上 |
| Slack bot | 同上 |

技能只定义 **EventIngress schema + 路由表 + 编排者路由逻辑**，消费方自行实现触发器写入 `event-ingress.jsonl`。

### 2.6 operational-recovery.md 扩展

在现有「成本预算与运行日志」节后新增「事件驱动与棕地维护」节：

```markdown
## 事件驱动与棕地维护

### 事件路由失败

| 场景 | 必须动作 |
|---|---|
| event-ingress.jsonl 不存在 | 项目未初始化或 L0/L1 未激活；引导 /wm analyze 初始化或升级到 L2+ |
| event-ingress.jsonl 解析失败（某行非合法 JSON） | 跳过损坏行，记录到 run-log 末尾一条 note=「事件日志损坏行已跳过」；不停止流程 |
| 事件路由到阶段 N 但前序阶段产物缺失 | 标记事件为 blocked；run-log append action=event-route outcome=blocked note="前序产物缺失"；询问用户是否回退到更早阶段 |
| 事件触发的高风险路径 CHECKPOINT 被拒绝 | 事件标记为 cancelled；run-log append action=event-route outcome=cancelled |
| L2+ 但 maturity.json 降级触发回 L0 | 暂停所有未路由事件处理；询问用户是否继续（L0 下事件驱动不激活） |

### event-ingress.jsonl 维护

| 场景 | 动作 |
|---|---|
| 事件累积过多未路由 | CHECKPOINT 展示待路由事件数；建议用户批量处理或归档 |
| 事件指向已删除的产物 | 标记事件为 invalid；run-log append note="事件指向已删除产物" |
| 需要导出事件历史 | /wm export 包含 event-ingress.jsonl |
```

### 2.7 SSoT 同步点

- SSoT §10F「事件驱动循环（Loop 3）」（新增）：权威定义 EventIngress schema + 路由表 + 激活条件 + 高风险路径 + 编排者路由逻辑。
- SSoT §3.4.2 角色表「编排者 O 允许动作」新增：「事件路由（读 event-ingress.jsonl + 写 routedTo）」。
- SSoT §10C 成熟度阶梯补充：L2+ 解锁条件含「事件驱动激活」；L0/L1 不支持事件驱动。
- SSoT §10A 追溯表新增行：§10F → `w-model-dev/references/event-ingress-guide.md` + `data-models.md`（EventIngress schema）+ `operational-recovery.md`「事件驱动与棕地维护」节。

---

## 3. 优化2：Loop 4 Hill Climbing（改进信号产出）

### 3.1 设计原则

| 原则 | 本设计的遵守方式 |
|---|---|
| 技能不内置 LLM 调用（§3.3） | HarnessImprovementReport 由编排者 O 确定性分析 run-log 产出，无 LLM |
| 技能自演化不在本仓库（SSoT §11） | 技能只产出改进信号，不自动改 harness；外部 SkillOpt/darwin-skill 消费信号做演化 |
| 编排者最小化（§3.4） | O 分析 run-log 产出报告属"状态读写+分析"允许动作，非实施 |
| 真实执行（约束4） | 分析基于 run-log 实际记录，不 LLM 估算 |

### 3.2 HarnessImprovementReport Schema

> 编排者 O 在用户请求或 L3 定期触发时产出，存 `.w-model/hill-climbing/<timestamp>-report.json`。

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
      emptyOrTrivialRate: number;  // 空/ trivial 占比
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
    /** 候选新增反模式（待人审后加入 anti-patterns.md） */
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

### 3.3 信号检测逻辑（确定性，无 LLM）

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

### 3.4 触发时机

| 触发方式 | 条件 | 动作 |
|---|---|---|
| 用户请求 | `/wm hill-climbing` 命令（新增） | O 分析全量 run-log 产出报告 |
| 阶段门后自动 | 每个阶段门放行后 | O 增量分析本阶段 run-log，append 信号到当前报告 |
| 定期触发（L3） | maturity.level=L3 且距上次报告 ≥ 7 天 | O 自动产出全量报告 |
| 失败模式命中 | O 系列失败模式命中 ≥ 2 次 | O 强制产出专项报告 |

### 3.5 与外部 SkillOpt/darwin-skill 的边界

| 角色 | 职责 | 边界 |
|---|---|---|
| **w-model-dev Loop 4** | 产出 HarnessImprovementReport（信号） | 不自动改 harness；不调用 LLM；不重写 prompt/工具/验证规则 |
| **外部 SkillOpt/darwin-skill** | 消费信号做技能自演化 | 重写 prompt/工具/验证规则；可能用 LLM |
| **人** | 审查报告 + 决定应用哪些信号 | 低风险（prompt 措辞）人审后手动改；高风险（工具/门禁逻辑）人审+回归测试 |

### 3.6 报告消费流程

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

### 3.7 SSoT 同步点

- SSoT §10G「爬坡循环（Loop 4）」（新增）：权威定义 HarnessImprovementReport schema + 信号检测逻辑 + 触发时机 + 与外部工具边界 + 报告消费流程。
- SSoT §3.4.2 角色表「编排者 O 允许动作」新增：「产出 HarnessImprovementReport（状态分析，非实施）」。
- SSoT §10A 追溯表新增行：§10G → `w-model-dev/references/hill-climbing-guide.md` + `data-models.md`（HarnessImprovementReport schema）。

---

## 4. 文件变更清单与验收标准

### 4.1 新增文件

| 文件 | 用途 | 创建时机 |
|---|---|---|
| `docs/superpowers/specs/2026-07-25-langchain-loop-engineering-absorption-design.md` | 本设计文档 | 立即 |
| `w-model-dev/references/event-ingress-guide.md` | Loop 3 事件接驳指南：EventIngress schema + 路由表 + 激活条件 + 消费方实现指引 | 实现阶段 |
| `w-model-dev/references/hill-climbing-guide.md` | Loop 4 改进信号指南：HarnessImprovementReport schema + 信号检测逻辑 + 触发时机 + 报告消费流程 | 实现阶段 |
| `w-model-dev/scripts/samples/event-ingress/` | EventIngress 样本（valid.json + bad-* 反例） | 实现阶段 |
| `w-model-dev/scripts/samples/hill-climbing/` | HarnessImprovementReport 样本（valid.json + bad-* 反例） | 实现阶段 |

### 4.2 修改文件（遵循 SSoT 优先）

| 文件 | 变更内容 | 对应 Loop |
|---|---|---|
| `docs/skill-design-document_SSoT.md` | 新增 §10F（事件驱动循环 Loop 3）+ §10G（爬坡循环 Loop 4）；§3.4.2 角色表 O 允许动作扩展（事件路由 + 改进报告产出）；§10A 追溯表新增 §10F/§10G 行；§10C 成熟度阶梯补充 L2+ 事件驱动激活条件 | Loop 3+4 |
| `w-model-dev/references/data-models.md` | 新增 EventIngress + HarnessImprovementReport schema | Loop 3+4 |
| `w-model-dev/references/operational-recovery.md` | 新增「事件驱动与棕地维护」节（事件路由失败恢复 + event-ingress.jsonl 损坏处理） | Loop 3 |
| `w-model-dev/references/subagent-delegation.md` | O 角色允许动作新增「事件路由」+「改进信号分析」（仍属状态读写+分析，非实施） | Loop 3+4 |
| `w-model-dev/references/anti-patterns.md` | 新增候选反模式检测信号说明（Loop 4 产出 → 人审后加入反模式清单） | Loop 4 |
| `w-model-dev/references/definition-of-done.md` | 六维度自检清单新增「Loop 4 报告已审查」项（L2+ 项目级 DoD） | Loop 4 |
| `w-model-dev/SKILL.md` | 成熟度阶梯补充 L2+ 事件驱动激活；新增 `/wm hill-climbing` 命令；约束补充"Loop 4 不自动改 harness" | Loop 3+4 |
| `AGENTS.md` | §2 关键目录速查新增 event-ingress-guide/hill-climbing-guide 说明；§3 常用命令新增 `/wm hill-climbing` | Loop 3+4 |
| `README.md` | 特性列表追加 Loop 3/Loop 4（如需） | Loop 3+4 |

### 4.3 不变更文件

| 文件 | 不变更理由 |
|---|---|
| `w-model-dev/scripts/*.ts`（所有门禁脚本） | Loop 3/4 不改门禁逻辑；EventIngress 路由 + HarnessImprovementReport 分析由编排者 O 确定性执行，类比 budget/maturity 状态维护 |
| `w-model-dev/templates/*.md` | 模板不涉及事件/改进报告 |
| `w-model-dev-demo/` | 参考实现已归档；本次增强不重建 demo |
| `docs/loop-engineering-adoption-design.md`（cobusgreyling 源） | 独立设计文档，通过 SSoT §10A 追溯表统一关联，不互改 |
| `docs/ingestion-graph-convergence-design.md` / `information-flow-validation-design.md` / `tla-plus-modeling-design.md` | 已完成的设计，本次增强正交 |

### 4.4 与现有架构原则的兼容性验证

| 现有原则 | Loop 3/4 的兼容性验证 |
|---|---|
| 技能不内置 LLM 调用（§3.3） | ✅ EventIngress 路由 + HarnessImprovementReport 分析均确定性，无 LLM |
| 脚本自包含仅依赖 tsx | ✅ 不新增脚本；event-ingress.jsonl / hill-climbing 报告由编排者 O 维护 |
| 编排者最小化（§3.4） | ✅ O 事件路由 + 报告产出属"状态读写+分析"允许动作；不改 S/V/G/R 边界 |
| CHECKPOINT 不可绕过（约束2） | ✅ Loop 3 高风险路径强制决策型 CHECKPOINT；Loop 4 报告应用须人审 |
| 真实执行（约束4） | ✅ 分析基于 run-log 实际记录；不 LLM 估算 |
| 技能自演化不在本仓库（§11） | ✅ Loop 4 只产出信号，不自动改 harness；外部 SkillOpt/darwin-skill 消费信号 |
| 外部集成由消费方自行实现（§11.2） | ✅ Loop 3 不内置 cron/webhook，只定义 EventIngress schema + 路由表 |
| 按需加载（约束6） | ✅ event-ingress/hill-climbing 在 L2+ 激活时加载，不一次性载入 |
| 反模式 #10（编排者越权） | ✅ O 路由 + 分析是允许动作；不产出实施内容 |

### 4.5 验收标准

本设计文档实现完成后，须满足：

- [ ] SSoT 新增 §10F/§10G，与本文档双向追溯
- [ ] data-models.md 含 EventIngress + HarnessImprovementReport schema
- [ ] event-ingress-guide.md 含 schema + 路由表 + 激活条件 + 消费方指引
- [ ] hill-climbing-guide.md 含 schema + 信号检测逻辑 + 触发时机 + 消费流程
- [ ] operational-recovery.md 含「事件驱动与棕地维护」节
- [ ] subagent-delegation.md O 角色允许动作扩展（事件路由 + 改进分析）
- [ ] anti-patterns.md 含候选反模式检测信号说明
- [ ] definition-of-done.md 六维度自检新增 Loop 4 报告审查项
- [ ] SKILL.md 含 L2+ 事件驱动激活 + `/wm hill-climbing` 命令
- [ ] AGENTS.md §2/§3 同步更新
- [ ] `npm run self-test` 仍通过（无脚本变更，回归基线不变）
- [ ] 样本文件 valid/bad 齐全（event-ingress + hill-climbing 各 ≥ 1 valid + ≥ 2 bad）

### 4.6 实现顺序（按依赖关系）

```
Loop 3 Event-driven  ← 依赖 maturity.json（已有）+ run-log（已有）
  ↓ event-ingress.jsonl 是 Loop 4 的分析输入之一
Loop 4 Hill Climbing  ← 依赖 run-log + event-ingress + R 根因报告
  ↓ 改进信号反哺 anti-patterns 候选
候选反模式补充
```

---

## 5. 与 LangChain 4-loop 模型的对照与取舍

### 5.1 采纳的 LangChain 概念

| LangChain 概念 | w-model-dev 适配方式 | 对应优化 |
|---|---|---|
| Loop 3 Event-driven（事件触发 agent） | EventIngress schema + 棕地条件性路由（L2+ 激活，事件→单阶段） | 优化1 |
| Loop 4 Hill Climbing（trace 分析→改进 harness） | HarnessImprovementReport（确定性分析 run-log，无 LLM）+ 人审后手动应用 | 优化2 |
| 人机协同 4 层 | 已有 CHECKPOINT 决策型 + acknowledgedDecisions + Loop 4 人审 | 已有+优化2 |
| Loop 1 Agent（模型+工具循环） | **w-model-dev 已有**（O/A/S/V/G/R 分派循环） | 不采纳（已有） |
| Loop 2 Verification（grader+rubric+retry） | **w-model-dev 更强**（V+G+TLA+ 双轨） | 不采纳（更强） |

### 5.2 不采纳的 LangChain 概念（架构冲突）

| LangChain 概念 | 不采纳理由 |
|---|---|
| cron 调度器内置 | SSoT §11.2"外部集成由消费方自行实现"；技能只定义 EventIngress schema + 路由表 |
| webhook 服务器内置 | 同上 |
| LangSmith Deployment / Fleet channels | 外部 SaaS 集成，技能不内置连接器 |
| LangSmith Engine（trace 分析 agent） | 与"技能不内置 LLM 调用"冲突；本设计用确定性分析替代 |
| Loop 4 自动应用 harness 改进 | 与"技能自演化不在本仓库"冲突；本设计只产出信号，人审后手动应用 |
| RL fine-tuning 反馈 | 面向 open-weight 模型训练，与 W 模型工程流程不同域 |

---

## 6. 附录：与现有架构原则的兼容性验证（完整版）

| 现有原则 | Loop 3/4 的兼容性验证 |
|---|---|
| 技能不内置 LLM 调用（§3.3） | ✅ EventIngress 路由 + HarnessImprovementReport 分析均确定性，无 LLM |
| 脚本自包含仅依赖 tsx | ✅ 不新增脚本；event-ingress.jsonl / hill-climbing 报告由编排者 O 维护 |
| 编排者最小化（§3.4） | ✅ O 事件路由 + 报告产出属"状态读写+分析"允许动作；不改 S/V/G/R 边界 |
| CHECKPOINT 不可绕过（约束2） | ✅ Loop 3 高风险路径强制决策型 CHECKPOINT；Loop 4 报告应用须人审 |
| 真实执行（约束4） | ✅ 分析基于 run-log 实际记录；不 LLM 估算 |
| 技能自演化不在本仓库（§11） | ✅ Loop 4 只产出信号，不自动改 harness；外部 SkillOpt/darwin-skill 消费信号 |
| 外部集成由消费方自行实现（§11.2） | ✅ Loop 3 不内置 cron/webhook，只定义 EventIngress schema + 路由表 |
| 按需加载（约束6） | ✅ event-ingress/hill-climbing 在 L2+ 激活时加载，不一次性载入 |
| 反模式 #10（编排者越权） | ✅ O 路由 + 分析是允许动作；不产出实施内容 |
| 反模式 #3/#6（估算门禁/RTM） | ✅ Loop 4 分析基于实际 run-log，不估算 |
| 反模式 #8（越过 CHECKPOINT） | ✅ Loop 3 高风险路径强制 CHECKPOINT；Loop 4 应用须人审 |
| TLA+ 行为门禁（约束9） | ✅ 不改 TLA+ 门禁；Loop 3 事件路由不涉及 TLA+ |
| 信息流校验（约束） | ✅ 不改信息流校验；Loop 3 事件路由不改图谱结构 |

---

## 参考文献

1. [The Art of Loop Engineering](https://www.langchain.com/blog/the-art-of-loop-engineering) — LangChain blog, Sydney Runkle, 2026-06-16
   - Loop 1: The Agent（模型+工具循环）
   - Level 2: Verification loop（grader+rubric+retry）
   - Level 3: Event driven loop（Slack/webhook/cron 触发）
   - Level 4: Hill climbing loop（trace 分析→改进 harness）
   - Human oversight and expertise（4 层人机协同）
2. [skill-design-document_SSoT.md](../../skill-design-document_SSoT.md) — w-model-dev 单一事实来源
3. [loop-engineering-adoption-design.md](../../loop-engineering-adoption-design.md) — cobusgreyling 源 loop-engineering 采纳设计（互补）
4. [w-model-dev/references/anti-patterns.md](../../../w-model-dev/references/anti-patterns.md) — 19 流程反模式 + F1~F10 失败模式 + O1~O6 运维失败模式
5. [w-model-dev/references/operational-recovery.md](../../../w-model-dev/references/operational-recovery.md) — 运维与恢复参考
6. [w-model-dev/references/data-models.md](../../../w-model-dev/references/data-models.md) — 数据模型 schema（budget/run-log/maturity）
7. [w-model-dev/references/subagent-delegation.md](../../../w-model-dev/references/subagent-delegation.md) — 编排者-子代理边界
