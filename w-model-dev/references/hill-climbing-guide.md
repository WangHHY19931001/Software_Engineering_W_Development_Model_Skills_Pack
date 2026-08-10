# 爬坡循环指南（Hill Climbing Guide）

> 来源：SSoT [§10G](../../docs/skill-design-document_SSoT.md)（爬坡循环 Loop 4）。本文件为可执行细则。
>
> **目的**：把 run-log/trace 转成改进 prompt/工具/验证规则的信号。技能只产出改进信号，不自动改 harness（保持"技能自演化不在本仓库"原则）；外部 SkillOpt/darwin-skill 消费信号做演化；人审后手动应用。
>
> **架构原则**：编排者 O 确定性分析 run-log 产出报告，无 LLM 调用；分析基于实际记录，不 LLM 估算（约束4）；O 产出报告属"状态读写+分析"允许动作，非实施（反模式 #10）。

## 目录

- 设计原则
- HarnessImprovementReport Schema
- 信号检测逻辑
- 触发时机
- 与外部 SkillOpt/darwin-skill 的边界
- 报告消费流程
- 与现有机制的关系
- 侦察 vs 产出两阶段（第 39 轮 P2 批吸收）

## 设计原则

| 原则 | 本指南的遵守方式 |
|---|---|
| 技能不内置 LLM 调用（§3.3） | HarnessImprovementReport 由编排者 O 确定性分析 run-log 产出，无 LLM |
| 技能自演化不在本仓库（SSoT §11） | 技能只产出改进信号，不自动改 harness；外部 SkillOpt/darwin-skill 消费信号做演化 |
| 编排者最小化（§3.4） | O 分析 run-log 产出报告属"状态读写+分析"允许动作，非实施 |
| 真实执行（约束4） | 分析基于 run-log 实际记录，不 LLM 估算 |

## 侦察 vs 产出两阶段（第 39 轮 P2 批吸收）

> 吸收自《agent 时代的人月神话》第 11 章：侦察成本几美分到几美元，跳过成本可能是几天。

- **Pilot-run 侦察流程**：正式任务前先跑小规模真实样本，产物可弃，学到的结论记入决策记录。
- **两阶段模式分离**：侦察阶段快速勇于犯错；产出阶段严格核对。不要把侦察的宽松带进产出，也不要用产出的严格拖慢侦察。
- **成本对照**：侦察成本几美分到几美元；跳过侦察直接正式执行的失败成本可能是几天。

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
| 用户请求 | `/wm hill-climbing` 命令（新增） | O 分析全量 run-log 产出报告 |
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
| anti-patterns.md | Loop 4 产出候选反模式 → 人审后加入清单 |
| 反模式 #10（编排者越权） | O 产出报告是允许动作；不产出实施内容 |
