# LangChain Loop Engineering 4 层循环模型吸收实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 吸收 LangChain Loop Engineering 的 Loop 3（Event-driven）+ Loop 4（Hill Climbing）到 w-model-dev 技能包，填补架构层缺口，保持现有架构原则不被破坏。

**Architecture:** 方案 A 独立新设计文档——不新增门禁脚本，EventIngress 路由 + HarnessImprovementReport 分析由编排者 O 确定性执行（类比 budget/maturity 状态维护）。Loop 3 仅在 L2+ 成熟度激活棕地条件性路由；Loop 4 只产出改进信号不自动改 harness。四部分顺序：Part A Loop 3 资产 → Part B Loop 4 资产 → Part C 跨切面更新 → Part D 验证。

**Tech Stack:** Markdown 文档、TypeScript schema 声明（仅类型，无运行时）、JSON/JSONL 样本文件

**Spec:** [docs/superpowers/specs/2026-07-25-langchain-loop-engineering-absorption-design.md](../specs/2026-07-25-langchain-loop-engineering-absorption-design.md)

**实现状态评估**：
- Loop 1（Agent）/ Loop 2（Verification）：**已有**，无需实现
- Loop 3（Event-driven）：**需实现**（EventIngress schema + 路由表 + 指南 + 样本 + 运维恢复节）
- Loop 4（Hill Climbing）：**需实现**（HarnessImprovementReport schema + 信号检测 + 指南 + 样本 + 候选反模式节）
- 跨切面：**需更新**（SSoT §10F/§10G/§10A/§10C + data-models + subagent-delegation + definition-of-done + SKILL + AGENTS + README）

**SSoT 章节占用说明**（spec 已修正）：§10C/§10D/§10E 已占用；本计划使用 §10F（Loop 3）+ §10G（Loop 4）。

---

## Part A：Loop 3 Event-driven 资产

### Task A1: 创建 event-ingress-guide.md

**Files:**
- Create: `w-model-dev/references/event-ingress-guide.md`

- [ ] **Step 1: 创建事件接驳指南文档**

写入 `w-model-dev/references/event-ingress-guide.md`：

```markdown
# 事件接驳指南（Event Ingress Guide）

> 来源：SSoT [§10F](../../docs/skill-design-document_SSoT.md)（事件驱动循环 Loop 3）。本文件为可执行细则。
>
> **目的**：为棕地持续维护场景提供事件接驳能力——消费方自行实现 webhook/cron 触发器写入 `event-ingress.jsonl`，编排者 O 按事件类型路由到单阶段（非完整 8 阶段重跑）。
>
> **激活条件**：maturity.json.level ≥ L2（L0/L1 attended 不激活）；greenfield 首次跑不激活。
>
> **架构原则**：技能不内置 cron/webhook/GitHub Actions/Slack bot（遵循 SSoT §11.2"外部集成由消费方自行实现"）；只定义 EventIngress schema + 路由表 + 编排者路由逻辑。

## 目录

- 激活条件与原则调和
- EventIngress Schema
- 事件 → 阶段路由表
- 编排者路由逻辑
- 高风险路径强制 CHECKPOINT
- 消费方实现指引
- 与现有机制的关系

## 激活条件与原则调和

| 条件 | 要求 |
|---|---|
| 成熟度级别 | maturity.json.level ≥ L2（L0/L1 attended 不激活） |
| 项目模式 | 棕地维护（greenfield 首次跑不激活） |
| 高风险路径 | 即使 L3，涉及 auth/加密/发布/架构变更的事件强制决策型 CHECKPOINT |

**与现有原则的调和**：现有"不照搬调度自动化"原则针对 **greenfield 一次性 8 阶段**场景保留；本指南为**棕地持续维护**场景扩展原则——W 模型作为棕地维护组件运行时，可按事件路由到单阶段。

## EventIngress Schema

编排者 O 维护 `.w-model/event-ingress.jsonl`（append-only），类比 run-log.jsonl。消费方自行实现 webhook/cron 触发器写入此文件。

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

## 事件 → 阶段路由表

| eventType | 目标阶段 | 触发条件 | 高风险路径 |
|---|---|---|---|
| `bug-report` | 阶段 5（编码修复） | L2+，bug 涉及已存在代码 | 涉及 auth/加密代码 → 强制 CHECKPOINT |
| `requirement-change` | 阶段 1（需求重跑） | L2+，需求变更须回退到阶段 1 | 架构变更 → 强制 CHECKPOINT |
| `acceptance-failure` | 阶段 8（验收重跑） | L2+，验收失败重跑验收 | 发布放行 → 始终 attended |
| `regression-detected` | 阶段 6/7（集成/系统测试） | L2+，回归测试失败 | - |
| `scheduled-review` | 阶段 8（验收回顾） | L3，定期回顾 | 发布放行 → 始终 attended |
| `security-incident` | 阶段 4（详细设计重审） | L2+，安全事件须回退设计 | 强制 CHECKPOINT |

## 编排者路由逻辑（确定性，无 LLM）

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

## 高风险路径强制 CHECKPOINT

即使 L3 自主度，以下事件路径强制决策型 CHECKPOINT（等用户确认）：

| 高风险路径 | 触发条件 | 强制动作 |
|---|---|---|
| 认证/授权相关 | affectedArtifacts 含 auth 模块路径 | 决策型 CHECKPOINT |
| 加密/密钥相关 | affectedArtifacts 含 jwt/bcrypt/crypto 路径 | 决策型 CHECKPOINT |
| 发布放行 | eventType=acceptance-failure 或 scheduled-review | 始终 attended（L3 亦然） |
| 架构变更 | eventType=requirement-change 且涉及 techStack 变更 | 决策型 CHECKPOINT |
| 安全事件 | eventType=security-incident | 决策型 CHECKPOINT |

## 消费方实现指引

消费方（非技能包）自行实现触发器，写入 `.w-model/event-ingress.jsonl`。示例：

### webhook 触发器示例（伪代码）

```javascript
// 消费方自行部署的 webhook 服务器
app.post('/webhook/bug-report', (req, res) => {
  const event = {
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    source: 'webhook',
    eventType: 'bug-report',
    summary: req.body.title,
    affectedArtifacts: req.body.files,
    affectedRequirements: req.body.requirementIds,
    evidence: [req.body.logUrl]
    // routedTo 由编排者 O 填写，消费方不填
  };
  fs.appendFileSync('.w-model/event-ingress.jsonl', JSON.stringify(event) + '\n');
  res.json({ accepted: true, eventId: event.eventId });
});
```

### cron 触发器示例（伪代码）

```javascript
// 消费方自行部署的 cron 任务
cron.schedule('0 9 * * 1', () => {
  // 每周一 09:00 触发定期回顾
  const event = {
    eventId: `cron-${Date.now()}`,
    timestamp: new Date().toISOString(),
    source: 'cron',
    eventType: 'scheduled-review',
    summary: '每周定期验收回顾'
  };
  fs.appendFileSync('.w-model/event-ingress.jsonl', JSON.stringify(event) + '\n');
});
```

## 与现有机制的关系

| 机制 | 与事件驱动的关系 |
|---|---|
| run-log.jsonl | 事件路由动作 append 到 run-log（action=event-route） |
| maturity.json | L2+ 是事件驱动激活的前置条件；事件路由失败可能触发降级 |
| budget.json | 事件触发的单阶段执行消耗计入预算 |
| acknowledgedDecisions | 事件触发的阶段门放行仍须填理解证据 |
| 反模式 #8（越过 CHECKPOINT） | 高风险路径强制 CHECKPOINT，不因事件驱动而绕过 |
| 反模式 #10（编排者越权） | O 路由是允许动作；不产出实施内容 |
```

- [ ] **Step 2: 验证文档结构**

Run: `cd w-model-dev && grep -c "^## " references/event-ingress-guide.md`
Expected: 输出 ≥ 7（目录 + 激活条件 + Schema + 路由表 + 路由逻辑 + 高风险路径 + 消费方指引 + 关系）

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/references/event-ingress-guide.md
git commit -m "feat(loop-3): 添加事件接驳指南（EventIngress schema + 路由表 + 消费方指引）"
```

---

### Task A2: 在 data-models.md 新增 EventIngress schema

**Files:**
- Modify: `w-model-dev/references/data-models.md`（在 maturity schema 后新增 EventIngress 节）

- [ ] **Step 1: 定位插入点**

Run: `cd w-model-dev && grep -n "自主成熟度模型" references/data-models.md`
Expected: 找到 `## 自主成熟度模型（maturity.json）` 行号

- [ ] **Step 2: 在 maturity schema 节后新增 EventIngress schema 节**

在 `w-model-dev/references/data-models.md` 的 maturity schema 节末尾（`## TLA+ manifest 模型` 节之前）插入：

```markdown
## 事件接驳模型（event-ingress.jsonl）

> 来源：SSoT [§10F](../../docs/skill-design-document_SSoT.md)。Append-only JSON Lines 格式，每行一条事件记录。编排者 O 维护，消费方自行实现触发器写入。

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

**示例记录**（webhook 触发的 bug 报告）：

```json
{"eventId":"evt-2026-07-25-001","timestamp":"2026-07-25T10:15:00Z","source":"webhook","eventType":"bug-report","summary":"登录接口返回 500","affectedArtifacts":["src/services/identity/user-service.ts"],"affectedRequirements":["REQ-002"],"evidence":["https://ci.example.com/run/12345/log"]}
```
```

- [ ] **Step 3: 更新目录**

在 `w-model-dev/references/data-models.md` 的「## 目录」节，在「自主成熟度模型（maturity.json）」后新增：

```markdown
- 事件接驳模型（event-ingress.jsonl）
```

- [ ] **Step 4: 验证插入**

Run: `cd w-model-dev && grep -c "EventIngress" references/data-models.md`
Expected: 输出 ≥ 3（目录 + 标题 + schema 引用）

- [ ] **Step 5: 提交**

```bash
git add w-model-dev/references/data-models.md
git commit -m "feat(loop-3): data-models 新增 EventIngress schema"
```

---

### Task A3: 创建 event-ingress 样本文件

**Files:**
- Create: `w-model-dev/scripts/samples/event-ingress/valid.jsonl`
- Create: `w-model-dev/scripts/samples/event-ingress/bad-missing-eventType.jsonl`
- Create: `w-model-dev/scripts/samples/event-ingress/bad-invalid-eventType.jsonl`
- Create: `w-model-dev/scripts/samples/event-ingress/bad-missing-eventId.jsonl`

- [ ] **Step 1: 创建 valid.jsonl**

写入 `w-model-dev/scripts/samples/event-ingress/valid.jsonl`：

```json
{"eventId":"evt-001","timestamp":"2026-07-25T10:15:00Z","source":"webhook","eventType":"bug-report","summary":"登录接口返回 500","affectedArtifacts":["src/services/identity/user-service.ts"],"affectedRequirements":["REQ-002"],"evidence":["https://ci.example.com/run/12345/log"]}
{"eventId":"evt-002","timestamp":"2026-07-25T11:00:00Z","source":"cron","eventType":"scheduled-review","summary":"每周定期验收回顾","routedTo":{"phase":8,"phaseName":"验收测试","routedAt":"2026-07-25T11:05:00Z","highRiskGate":true}}
{"eventId":"evt-003","timestamp":"2026-07-25T14:30:00Z","source":"user-report","eventType":"requirement-change","summary":"新增搜索功能需求","affectedRequirements":["REQ-007"],"evidence":["docs/requirement-change-request.md"]}
```

- [ ] **Step 2: 创建 bad-missing-eventType.jsonl**

写入 `w-model-dev/scripts/samples/event-ingress/bad-missing-eventType.jsonl`：

```json
{"eventId":"evt-bad-001","timestamp":"2026-07-25T10:15:00Z","source":"webhook","summary":"缺 eventType 字段"}
```

- [ ] **Step 3: 创建 bad-invalid-eventType.jsonl**

写入 `w-model-dev/scripts/samples/event-ingress/bad-invalid-eventType.jsonl`：

```json
{"eventId":"evt-bad-002","timestamp":"2026-07-25T10:15:00Z","source":"webhook","eventType":"unknown-type","summary":"eventType 不在枚举内"}
```

- [ ] **Step 4: 创建 bad-missing-eventId.jsonl**

写入 `w-model-dev/scripts/samples/event-ingress/bad-missing-eventId.jsonl`：

```json
{"timestamp":"2026-07-25T10:15:00Z","source":"webhook","eventType":"bug-report","summary":"缺 eventId 字段"}
```

- [ ] **Step 5: 验证样本可解析（valid）**

Run: `cd w-model-dev/scripts/samples/event-ingress && node -e "require('fs').readFileSync('valid.jsonl','utf8').trim().split('\n').forEach((l,i)=>{const o=JSON.parse(l);if(!o.eventId||!o.eventType)throw new Error('line '+(i+1)+' missing required field');console.log('line '+(i+1)+' OK')})"`
Expected: 输出 3 行 `line N OK`

- [ ] **Step 6: 验证 bad 样本确实有缺陷**

Run: `cd w-model-dev/scripts/samples/event-ingress && node -e "const fs=require('fs');['bad-missing-eventType.jsonl','bad-missing-eventId.jsonl'].forEach(f=>{const o=JSON.parse(fs.readFileSync(f,'utf8').trim());const bad=!o.eventId||!o.eventType;if(!bad)throw new Error(f+' should be invalid');console.log(f+' correctly invalid')})"`
Expected: 输出 2 行 `... correctly invalid`

- [ ] **Step 7: 提交**

```bash
git add w-model-dev/scripts/samples/event-ingress/
git commit -m "feat(loop-3): 添加 event-ingress 样本（1 valid + 3 bad）"
```

---

### Task A4: 在 operational-recovery.md 新增「事件驱动与棕地维护」节

**Files:**
- Modify: `w-model-dev/references/operational-recovery.md`（在「成熟度与 CHECKPOINT 放行」节后新增）

- [ ] **Step 1: 定位插入点**

Run: `cd w-model-dev && grep -n "^## 成熟度与 CHECKPOINT 放行" references/operational-recovery.md`
Expected: 找到行号（用于在节后插入）

- [ ] **Step 2: 在「成熟度与 CHECKPOINT 放行」节后插入新节**

在 `w-model-dev/references/operational-recovery.md` 的「成熟度与 CHECKPOINT 放行」节末尾（`## O 越权检测` 节之前）插入：

```markdown
## 事件驱动与棕地维护

> 来源：SSoT [§10F](../../docs/skill-design-document_SSoT.md)。事件驱动循环（Loop 3）仅在 L2+ 成熟度激活，详见 [event-ingress-guide.md](event-ingress-guide.md)。

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

- [ ] **Step 3: 验证插入**

Run: `cd w-model-dev && grep -c "事件驱动与棕地维护" references/operational-recovery.md`
Expected: 输出 ≥ 2（标题 + 引用）

- [ ] **Step 4: 提交**

```bash
git add w-model-dev/references/operational-recovery.md
git commit -m "feat(loop-3): operational-recovery 新增事件驱动与棕地维护节"
```

---

## Part B：Loop 4 Hill Climbing 资产

### Task B1: 创建 hill-climbing-guide.md

**Files:**
- Create: `w-model-dev/references/hill-climbing-guide.md`

- [ ] **Step 1: 创建改进信号指南文档**

写入 `w-model-dev/references/hill-climbing-guide.md`：

```markdown
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

## 设计原则

| 原则 | 本指南的遵守方式 |
|---|---|
| 技能不内置 LLM 调用（§3.3） | HarnessImprovementReport 由编排者 O 确定性分析 run-log 产出，无 LLM |
| 技能自演化不在本仓库（SSoT §11） | 技能只产出改进信号，不自动改 harness；外部 SkillOpt/darwin-skill 消费信号做演化 |
| 编排者最小化（§3.4） | O 分析 run-log 产出报告属"状态读写+分析"允许动作，非实施 |
| 真实执行（约束4） | 分析基于 run-log 实际记录，不 LLM 估算 |

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
```

- [ ] **Step 2: 验证文档结构**

Run: `cd w-model-dev && grep -c "^## " references/hill-climbing-guide.md`
Expected: 输出 ≥ 7（目录 + 设计原则 + Schema + 信号检测 + 触发时机 + 外部边界 + 消费流程 + 关系）

- [ ] **Step 3: 提交**

```bash
git add w-model-dev/references/hill-climbing-guide.md
git commit -m "feat(loop-4): 添加爬坡循环指南（HarnessImprovementReport schema + 信号检测 + 消费流程）"
```

---

### Task B2: 在 data-models.md 新增 HarnessImprovementReport schema

**Files:**
- Modify: `w-model-dev/references/data-models.md`（在 EventIngress schema 节后新增）

- [ ] **Step 1: 定位插入点**

Run: `cd w-model-dev && grep -n "事件接驳模型" references/data-models.md`
Expected: 找到 EventIngress 节行号

- [ ] **Step 2: 在 EventIngress schema 节后新增 HarnessImprovementReport schema 节**

在 `w-model-dev/references/data-models.md` 的 EventIngress schema 节末尾（`## TLA+ manifest 模型` 节之前）插入：

```markdown
## 爬坡循环改进报告模型（hill-climbing/<timestamp>-report.json）

> 来源：SSoT [§10G](../../docs/skill-design-document_SSoT.md)。编排者 O 确定性分析 run-log 产出，存 `.w-model/hill-climbing/<timestamp>-report.json`。详见 [hill-climbing-guide.md](hill-climbing-guide.md)。

```typescript
interface HarnessImprovementReport {
  /** 报告 ID */
  reportId: string;
  /** 生成时间 ISO 8601 */
  generatedAt: string;
  /** 分析窗口 */
  analysisWindow: {
    from: string;
    to: string;
    runLogEntries: number;
    phasesCovered: number[];
  };
  /** 检测到的改进信号 */
  signals: Array<{
    signalId: string;
    category: 'prompt' | 'tool' | 'verification-rule' | 'anti-pattern' | 'maturity' | 'budget';
    severity: 'S1' | 'S2' | 'S3';
    evidence: {
      runLogRefs: string[];
      patterns: string[];
      metrics: {
        occurrences: number;
        trend: 'increasing' | 'stable' | 'decreasing';
      };
    };
    suggestion: string;
    affectedAssets: string[];
    priority: 1 | 2 | 3;
  }>;
  /** 元分析（跨信号聚合） */
  metaAnalysis: {
    topFailurePatterns: string[];
    reworkHotspots: string[];
    verifierDisagreements: number;
    budgetBurnTrend: 'increasing' | 'stable' | 'decreasing';
    operationalFailureHits: Record<string, number>;
    comprehensionQuality: {
      emptyOrTrivialRate: number;
      uniqueDecisionRate: number;
    };
  };
  /** 改进建议聚合 */
  recommendations: {
    promptTweaks: string[];
    toolImprovements: string[];
    verificationRuleTightening: string[];
    candidateAntiPatterns: string[];
    maturityAdjustments: string[];
  };
  /** 应用状态（人审后填写） */
  applicationStatus?: {
    reviewedBy: string;
    reviewedAt: string;
    appliedSignals: string[];
    deferredSignals: string[];
    rejectedSignals: string[];
    notes?: string;
  };
}
```
```

- [ ] **Step 3: 更新目录**

在 `w-model-dev/references/data-models.md` 的「## 目录」节，在「事件接驳模型（event-ingress.jsonl）」后新增：

```markdown
- 爬坡循环改进报告模型（hill-climbing/<timestamp>-report.json）
```

- [ ] **Step 4: 验证插入**

Run: `cd w-model-dev && grep -c "HarnessImprovementReport" references/data-models.md`
Expected: 输出 ≥ 3（目录 + 标题 + schema 引用）

- [ ] **Step 5: 提交**

```bash
git add w-model-dev/references/data-models.md
git commit -m "feat(loop-4): data-models 新增 HarnessImprovementReport schema"
```

---

### Task B3: 创建 hill-climbing 样本文件

**Files:**
- Create: `w-model-dev/scripts/samples/hill-climbing/valid.json`
- Create: `w-model-dev/scripts/samples/hill-climbing/bad-missing-signals.json`
- Create: `w-model-dev/scripts/samples/hill-climbing/bad-invalid-priority.json`
- Create: `w-model-dev/scripts/samples/hill-climbing/bad-missing-reportId.json`

- [ ] **Step 1: 创建 valid.json**

写入 `w-model-dev/scripts/samples/hill-climbing/valid.json`：

```json
{
  "reportId": "hc-2026-07-25-001",
  "generatedAt": "2026-07-25T18:00:00Z",
  "analysisWindow": {
    "from": "2026-07-20T00:00:00Z",
    "to": "2026-07-25T18:00:00Z",
    "runLogEntries": 47,
    "phasesCovered": [1, 2, 3, 4, 5]
  },
  "signals": [
    {
      "signalId": "sig-001",
      "category": "prompt",
      "severity": "S2",
      "evidence": {
        "runLogRefs": ["run-2026-07-23T10-15-00Z", "run-2026-07-24T14-20-00Z"],
        "patterns": ["V 评审 summary 跨 3 个阶段 Jaccard 相似度 0.87"],
        "metrics": {
          "occurrences": 3,
          "trend": "stable"
        }
      },
      "suggestion": "强化 verifier-spec.md §6 summary 字段内容要求，明确禁止模板化措辞",
      "affectedAssets": ["w-model-dev/references/verifier-spec.md"],
      "priority": 2
    },
    {
      "signalId": "sig-002",
      "category": "verification-rule",
      "severity": "S1",
      "evidence": {
        "runLogRefs": ["run-2026-07-24T16-00-00Z"],
        "patterns": ["V passed=true 但 G check-artifact-gate.ts exit=1，频次 4 次"],
        "metrics": {
          "occurrences": 4,
          "trend": "increasing"
        }
      },
      "suggestion": "收紧 V 评审规则：要求 V 引用具体 evidence 行号，G 校验 evidence 非空",
      "affectedAssets": ["w-model-dev/references/verifier-spec.md", "w-model-dev/scripts/logic/verifier-logic.ts"],
      "priority": 1
    }
  ],
  "metaAnalysis": {
    "topFailurePatterns": ["V-G 矛盾", "summary 模板化", "返工阶段 4 TLA+"],
    "reworkHotspots": ["阶段 4"],
    "verifierDisagreements": 4,
    "budgetBurnTrend": "stable",
    "operationalFailureHits": { "O3": 4, "O1": 0, "O2": 0, "O4": 1, "O5": 0, "O6": 0 },
    "comprehensionQuality": {
      "emptyOrTrivialRate": 0.125,
      "uniqueDecisionRate": 0.75
    }
  },
  "recommendations": {
    "promptTweaks": [
      "verifier-spec.md §6 summary 字段：明确要求含 ≥1 关键决策摘要 + 1-2 句产物核心结构 + 遗留风险",
      "禁止 summary 使用「评审通过」「质量良好」等空泛措辞"
    ],
    "toolImprovements": [
      "verifier-logic.ts 新增 summary 长度校验（≥50 字符）"
    ],
    "verificationRuleTightening": [
      "V 评审 evidence 字段须引用具体行号/文件路径，禁止空泛描述"
    ],
    "candidateAntiPatterns": [
      "#20（候选）V 评审 summary 模板化：跨阶段 Jaccard 相似度 > 0.8 且长度 < 50 字符"
    ],
    "maturityAdjustments": []
  }
}
```

- [ ] **Step 2: 创建 bad-missing-signals.json**

写入 `w-model-dev/scripts/samples/hill-climbing/bad-missing-signals.json`：

```json
{
  "reportId": "hc-bad-001",
  "generatedAt": "2026-07-25T18:00:00Z",
  "analysisWindow": {
    "from": "2026-07-20T00:00:00Z",
    "to": "2026-07-25T18:00:00Z",
    "runLogEntries": 47,
    "phasesCovered": [1, 2, 3, 4, 5]
  }
}
```

- [ ] **Step 3: 创建 bad-invalid-priority.json**

写入 `w-model-dev/scripts/samples/hill-climbing/bad-invalid-priority.json`：

```json
{
  "reportId": "hc-bad-002",
  "generatedAt": "2026-07-25T18:00:00Z",
  "analysisWindow": {
    "from": "2026-07-20T00:00:00Z",
    "to": "2026-07-25T18:00:00Z",
    "runLogEntries": 47,
    "phasesCovered": [1, 2, 3, 4, 5]
  },
  "signals": [
    {
      "signalId": "sig-bad-001",
      "category": "prompt",
      "severity": "S2",
      "evidence": {
        "runLogRefs": ["run-001"],
        "patterns": ["test"],
        "metrics": { "occurrences": 1, "trend": "stable" }
      },
      "suggestion": "test",
      "affectedAssets": [],
      "priority": 5
    }
  ],
  "metaAnalysis": {
    "topFailurePatterns": [],
    "reworkHotspots": [],
    "verifierDisagreements": 0,
    "budgetBurnTrend": "stable",
    "operationalFailureHits": {},
    "comprehensionQuality": { "emptyOrTrivialRate": 0, "uniqueDecisionRate": 1 }
  },
  "recommendations": {
    "promptTweaks": [],
    "toolImprovements": [],
    "verificationRuleTightening": [],
    "candidateAntiPatterns": [],
    "maturityAdjustments": []
  }
}
```

- [ ] **Step 4: 创建 bad-missing-reportId.json**

写入 `w-model-dev/scripts/samples/hill-climbing/bad-missing-reportId.json`：

```json
{
  "generatedAt": "2026-07-25T18:00:00Z",
  "analysisWindow": {
    "from": "2026-07-20T00:00:00Z",
    "to": "2026-07-25T18:00:00Z",
    "runLogEntries": 47,
    "phasesCovered": [1, 2, 3, 4, 5]
  },
  "signals": [],
  "metaAnalysis": {
    "topFailurePatterns": [],
    "reworkHotspots": [],
    "verifierDisagreements": 0,
    "budgetBurnTrend": "stable",
    "operationalFailureHits": {},
    "comprehensionQuality": { "emptyOrTrivialRate": 0, "uniqueDecisionRate": 1 }
  },
  "recommendations": {
    "promptTweaks": [],
    "toolImprovements": [],
    "verificationRuleTightening": [],
    "candidateAntiPatterns": [],
    "maturityAdjustments": []
  }
}
```

- [ ] **Step 5: 验证 valid.json 可解析且字段齐全**

Run: `cd w-model-dev/scripts/samples/hill-climbing && node -e "const o=require('./valid.json');['reportId','generatedAt','analysisWindow','signals','metaAnalysis','recommendations'].forEach(k=>{if(!(k in o))throw new Error('missing '+k)});console.log('valid.json OK')"`
Expected: 输出 `valid.json OK`

- [ ] **Step 6: 验证 bad 样本确实有缺陷**

Run: `cd w-model-dev/scripts/samples/hill-climbing && node -e "const fs=require('fs');['bad-missing-signals.json','bad-missing-reportId.json'].forEach(f=>{const o=JSON.parse(fs.readFileSync(f,'utf8'));const bad=(!o.signals&&f.includes('missing-signals'))||(!o.reportId&&f.includes('missing-reportId'));if(!bad)throw new Error(f+' should be invalid');console.log(f+' correctly invalid')})"`
Expected: 输出 2 行 `... correctly invalid`

- [ ] **Step 7: 验证 bad-invalid-priority.json 的 priority 越界**

Run: `cd w-model-dev/scripts/samples/hill-climbing && node -e "const o=require('./bad-invalid-priority.json');const p=o.signals[0].priority;if(p<1||p>3)console.log('bad-invalid-priority.json correctly invalid (priority='+p+')');else throw new Error('priority should be out of range')"`
Expected: 输出 `bad-invalid-priority.json correctly invalid (priority=5)`

- [ ] **Step 8: 提交**

```bash
git add w-model-dev/scripts/samples/hill-climbing/
git commit -m "feat(loop-4): 添加 hill-climbing 样本（1 valid + 3 bad）"
```

---

### Task B4: 在 anti-patterns.md 新增候选反模式检测信号节

**Files:**
- Modify: `w-model-dev/references/anti-patterns.md`（在「运维失败模式清单」节后新增）

- [ ] **Step 1: 定位插入点**

Run: `cd w-model-dev && grep -n "^## 运维失败模式清单" references/anti-patterns.md`
Expected: 找到 O1~O6 节行号

- [ ] **Step 2: 在「运维失败模式清单」节后新增「候选反模式检测信号」节**

在 `w-model-dev/references/anti-patterns.md` 的「运维失败模式清单（O1~O6）」节末尾插入：

```markdown
## 候选反模式检测信号（来自 Loop 4 爬坡循环）

> 来源：SSoT [§10G](../../docs/skill-design-document_SSoT.md)。Loop 4 的 HarnessImprovementReport（详见 [hill-climbing-guide.md](hill-climbing-guide.md)）产出候选反模式信号，人审后手动加入本清单。
>
> **与已收录反模式的关系**：已收录的 #1~#19 + F1~F10 + O1~O6 是技能包内置清单；候选反模式是 Loop 4 从 run-log 模式聚合产出的**待审**信号，须经人审 + 至少 2 个项目的回归验证后才正式加入清单。

### 候选反模式信号来源

Loop 4 的信号检测逻辑（确定性，无 LLM）会从 run-log 聚合以下模式作为候选反模式：

| 检测信号 | 来源 | 转正条件 |
|---|---|---|
| run-log note 字段反复出现同类问题（≥3 次跨 ≥2 阶段） | Loop 4 `anti-pattern` 信号类别 | 人审 + 2 项目回归验证 |
| V 评审 summary 跨阶段 Jaccard 相似度 > 0.8 且长度 < 50 字符 | Loop 4 `prompt` 信号 + 信息熵检测 | 人审 + 2 项目回归验证 |
| V passed=true 但 G exit=1 频次 > 阈值（≥3 次/阶段） | Loop 4 `verification-rule` 信号 | 人审 + 2 项目回归验证 |
| L1+ 自动放行后误判率 > 10% | Loop 4 `maturity` 信号 | 人审 + 2 项目回归验证 |

### 候选反模式生命周期

```
Loop 4 产出候选信号（HarnessImprovementReport.recommendations.candidateAntiPatterns）
  ↓ 人审
人决定 adopt / defer / reject
  ↓ adopt 后
加入本节「待回归验证」清单
  ↓ 2 项目回归验证通过
正式加入 #1~#19 或 F1~F10 或 O1~O6 清单
```

### 待回归验证清单（初始为空）

> 本节随 Loop 4 报告累积。每条记录格式：`候选 ID | 描述 | 来源报告 ID | 首次发现时间 | 验证项目数`

| 候选 ID | 描述 | 来源报告 | 首次发现 | 验证项目数 |
|---|---|---|---|---|
| （初始为空） | | | | |
```

- [ ] **Step 3: 验证插入**

Run: `cd w-model-dev && grep -c "候选反模式检测信号" references/anti-patterns.md`
Expected: 输出 ≥ 2（标题 + 引用）

- [ ] **Step 4: 提交**

```bash
git add w-model-dev/references/anti-patterns.md
git commit -m "feat(loop-4): anti-patterns 新增候选反模式检测信号节"
```

---

## Part C：跨切面更新

### Task C1: SSoT 新增 §10F 事件驱动循环

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`（在 §10E 后新增 §10F）

- [ ] **Step 1: 定位插入点**

Run: `grep -n "^## 10E\." docs/skill-design-document_SSoT.md`
Expected: 找到 §10E 行号

- [ ] **Step 2: 在 §10E 节后插入 §10F**

在 `docs/skill-design-document_SSoT.md` 的 §10E 节末尾（`## 10.10` 节之前）插入：

```markdown
## 10F. 事件驱动循环（Loop 3）

> 权威定义：[docs/superpowers/specs/2026-07-25-langchain-loop-engineering-absorption-design.md](./superpowers/specs/2026-07-25-langchain-loop-engineering-absorption-design.md) §2。
> 实现位置：`w-model-dev/references/event-ingress-guide.md` + `w-model-dev/references/data-models.md`（EventIngress schema）+ `w-model-dev/references/operational-recovery.md`「事件驱动与棕地维护」节。
>
> **与 §10C 成熟度阶梯的关系**：L2+ 是事件驱动激活的前置条件；L0/L1 不支持事件驱动。
> **与 §11.2 的关系**：技能不内置 cron/webhook/GitHub Actions/Slack bot；只定义 EventIngress schema + 路由表 + 编排者路由逻辑，消费方自行实现触发器。

### 激活条件

| 条件 | 要求 |
|---|---|
| 成熟度级别 | maturity.json.level ≥ L2（L0/L1 attended 不激活） |
| 项目模式 | 棕地维护（greenfield 首次跑不激活） |
| 高风险路径 | 即使 L3，涉及 auth/加密/发布/架构变更的事件强制决策型 CHECKPOINT |

### EventIngress Schema

见 [data-models.md](../w-model-dev/references/data-models.md)「事件接驳模型」节。编排者 O 维护 `.w-model/event-ingress.jsonl`（append-only）。

### 事件 → 阶段路由表

| eventType | 目标阶段 | 触发条件 | 高风险路径 |
|---|---|---|---|
| `bug-report` | 阶段 5（编码修复） | L2+，bug 涉及已存在代码 | 涉及 auth/加密代码 → 强制 CHECKPOINT |
| `requirement-change` | 阶段 1（需求重跑） | L2+，需求变更须回退到阶段 1 | 架构变更 → 强制 CHECKPOINT |
| `acceptance-failure` | 阶段 8（验收重跑） | L2+，验收失败重跑验收 | 发布放行 → 始终 attended |
| `regression-detected` | 阶段 6/7（集成/系统测试） | L2+，回归测试失败 | - |
| `scheduled-review` | 阶段 8（验收回顾） | L3，定期回顾 | 发布放行 → 始终 attended |
| `security-incident` | 阶段 4（详细设计重审） | L2+，安全事件须回退设计 | 强制 CHECKPOINT |

### 编排者路由逻辑

编排者 O 确定性执行（无 LLM），详见 [event-ingress-guide.md](../w-model-dev/references/event-ingress-guide.md)「编排者路由逻辑」节。路由动作 append 到 run-log（action=event-route）。

### 不引入的调度基础设施

技能不内置 cron 调度器、webhook 服务器、GitHub Actions 集成、Slack bot（遵循 §11.2）。消费方自行实现触发器写入 `event-ingress.jsonl`。
```

- [ ] **Step 3: 验证插入**

Run: `grep -c "## 10F\." docs/skill-design-document_SSoT.md`
Expected: 输出 1

- [ ] **Step 4: 提交**

```bash
git add docs/skill-design-document_SSoT.md
git commit -m "feat(loop-3): SSoT 新增 §10F 事件驱动循环"
```

---

### Task C2: SSoT 新增 §10G 爬坡循环

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`（在 §10F 后新增 §10G）

- [ ] **Step 1: 在 §10F 节后插入 §10G**

在 `docs/skill-design-document_SSoT.md` 的 §10F 节末尾插入：

```markdown
## 10G. 爬坡循环（Loop 4）

> 权威定义：[docs/superpowers/specs/2026-07-25-langchain-loop-engineering-absorption-design.md](./superpowers/specs/2026-07-25-langchain-loop-engineering-absorption-design.md) §3。
> 实现位置：`w-model-dev/references/hill-climbing-guide.md` + `w-model-dev/references/data-models.md`（HarnessImprovementReport schema）+ `w-model-dev/references/anti-patterns.md`「候选反模式检测信号」节。
>
> **与 §11 的关系**：技能只产出改进信号，不自动改 harness；外部 SkillOpt/darwin-skill 消费信号做演化；人审后手动应用。
> **与 §10D run-log 的关系**：run-log 是 Loop 4 的主要分析输入。
> **与 §4A.2 失败模式的关系**：Loop 4 信号检测关联 O1~O6 运维失败模式。

### 设计原则

| 原则 | 遵守方式 |
|---|---|
| 技能不内置 LLM 调用（§3.3） | HarnessImprovementReport 由编排者 O 确定性分析 run-log 产出，无 LLM |
| 技能自演化不在本仓库（§11） | 技能只产出改进信号，不自动改 harness |
| 编排者最小化（§3.4） | O 分析 run-log 产出报告属"状态读写+分析"允许动作，非实施 |
| 真实执行（约束4） | 分析基于 run-log 实际记录，不 LLM 估算 |

### HarnessImprovementReport Schema

见 [data-models.md](../w-model-dev/references/data-models.md)「爬坡循环改进报告模型」节。编排者 O 产出存 `.w-model/hill-climbing/<timestamp>-report.json`。

### 信号检测逻辑

详见 [hill-climbing-guide.md](../w-model-dev/references/hill-climbing-guide.md)「信号检测逻辑」节。8 类信号（prompt/tool/verification-rule/anti-pattern/maturity/budget）均确定性检测。

### 触发时机

| 触发方式 | 条件 | 动作 |
|---|---|---|
| 用户请求 | `/wm hill-climbing` 命令 | O 分析全量 run-log 产出报告 |
| 阶段门后自动 | 每个阶段门放行后 | O 增量分析本阶段 run-log |
| 定期触发（L3） | maturity.level=L3 且距上次报告 ≥ 7 天 | O 自动产出全量报告 |
| 失败模式命中 | O 系列失败模式命中 ≥ 2 次 | O 强制产出专项报告 |

### 与外部 SkillOpt/darwin-skill 的边界

| 角色 | 职责 | 边界 |
|---|---|---|
| w-model-dev Loop 4 | 产出 HarnessImprovementReport（信号） | 不自动改 harness；不调用 LLM |
| 外部 SkillOpt/darwin-skill | 消费信号做技能自演化 | 重写 prompt/工具/验证规则；可能用 LLM |
| 人 | 审查报告 + 决定应用哪些信号 | 低风险人审后手动改；高风险人审+回归测试 |
```

- [ ] **Step 2: 验证插入**

Run: `grep -c "## 10G\." docs/skill-design-document_SSoT.md`
Expected: 输出 1

- [ ] **Step 3: 提交**

```bash
git add docs/skill-design-document_SSoT.md
git commit -m "feat(loop-4): SSoT 新增 §10G 爬坡循环"
```

---

### Task C3: SSoT §10A 追溯表新增 §10F/§10G 行

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`（在 §10A 追溯表 §10E 行后新增）

- [ ] **Step 1: 定位 §10A 追溯表中 §10E 行**

Run: `grep -n "| 10E " docs/skill-design-document_SSoT.md`
Expected: 找到 §10E 追溯行号

- [ ] **Step 2: 在 §10E 追溯行后新增 §10F/§10G 行**

在 `docs/skill-design-document_SSoT.md` 的 §10A 追溯表中，§10E 行后插入：

```markdown
| 10F 事件驱动循环（Loop 3） | EventIngress schema + 棕地条件性路由（L2+ 激活，事件→单阶段）+ 高风险路径强制 CHECKPOINT + 编排者路由逻辑 | `docs/superpowers/specs/2026-07-25-langchain-loop-engineering-absorption-design.md` §2（权威定义）+ `w-model-dev/references/event-ingress-guide.md` + `w-model-dev/references/data-models.md`（EventIngress schema）+ `w-model-dev/references/operational-recovery.md`「事件驱动与棕地维护」节 | 完整（吸收自 LangChain "The Art of Loop Engineering" Loop 3 Event-driven；不引入调度基础设施，消费方自行实现触发器；L2+ 激活，L0/L1 不支持；高风险路径强制 CHECKPOINT 不违反约束2） |
| 10G 爬坡循环（Loop 4） | HarnessImprovementReport（确定性分析 run-log，无 LLM）+ 信号检测逻辑 + 触发时机 + 与外部工具边界 + 报告消费流程 | `docs/superpowers/specs/2026-07-25-langchain-loop-engineering-absorption-design.md` §3（权威定义）+ `w-model-dev/references/hill-climbing-guide.md` + `w-model-dev/references/data-models.md`（HarnessImprovementReport schema）+ `w-model-dev/references/anti-patterns.md`「候选反模式检测信号」节 | 完整（吸收自 LangChain "The Art of Loop Engineering" Loop 4 Hill Climbing；只产出改进信号不自动改 harness，保持"技能自演化不在本仓库"原则；外部 SkillOpt/darwin-skill 消费信号；人审后手动应用） |
```

- [ ] **Step 3: 验证插入**

Run: `grep -c "| 10F 事件驱动循环\|| 10G 爬坡循环" docs/skill-design-document_SSoT.md`
Expected: 输出 2

- [ ] **Step 4: 提交**

```bash
git add docs/skill-design-document_SSoT.md
git commit -m "feat(loop-3+4): SSoT §10A 追溯表新增 §10F/§10G 行"
```

---

### Task C4: SSoT §10C 成熟度阶梯补充 L2+ 事件驱动激活条件

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`（在 §10C 节内补充）

- [ ] **Step 1: 定位 §10C L2 行**

Run: `grep -n "L2（返工自主化）" docs/skill-design-document_SSoT.md`
Expected: 找到 L2 放行矩阵行号

- [ ] **Step 2: 在 §10C 的 L2 解锁条件补充事件驱动激活**

在 `docs/skill-design-document_SSoT.md` 的 §10C 节，L2 解锁条件描述后补充：

```markdown
> **L2+ 事件驱动激活**：成熟度达 L2 后，事件驱动循环（Loop 3，详见 §10F）激活。消费方自行实现触发器写入 `event-ingress.jsonl`，编排者 O 按事件类型路由到单阶段（非完整 8 阶段）。L0/L1 不支持事件驱动。
```

- [ ] **Step 3: 验证补充**

Run: `grep -c "L2+ 事件驱动激活" docs/skill-design-document_SSoT.md`
Expected: 输出 1

- [ ] **Step 4: 提交**

```bash
git add docs/skill-design-document_SSoT.md
git commit -m "feat(loop-3): SSoT §10C 成熟度阶梯补充 L2+ 事件驱动激活条件"
```

---

### Task C5: subagent-delegation.md O 角色允许动作扩展

**Files:**
- Modify: `w-model-dev/references/subagent-delegation.md`（角色表 O 行允许动作列扩展）

- [ ] **Step 1: 定位 O 角色行**

Run: `cd w-model-dev && grep -n "维护 budget.json / run-log.jsonl / maturity.json" references/subagent-delegation.md`
Expected: 找到 O 角色允许动作 ⑦ 行号

- [ ] **Step 2: 在 O 角色允许动作 ⑦ 后新增 ⑧ 事件路由 + ⑨ 改进信号分析**

修改 `w-model-dev/references/subagent-delegation.md` 的 O 角色行，在 `⑦ **维护 budget.json...` 后新增：

```markdown
⑧ **维护 event-ingress.jsonl + 事件路由**（状态读写+路由判定，非实施；见 [event-ingress-guide.md](event-ingress-guide.md)）：L2+ 激活时读 event-ingress.jsonl 未路由事件、查路由表、写 routedTo、append run-log action=event-route；⑨ **产出 HarnessImprovementReport**（状态分析，非实施；见 [hill-climbing-guide.md](hill-climbing-guide.md)）：分析 run-log 产出改进信号报告，存 `.w-model/hill-climbing/<ts>-report.json`，不自动改 harness
```

- [ ] **Step 3: 验证扩展**

Run: `cd w-model-dev && grep -c "⑧ \*\*维护 event-ingress.jsonl" references/subagent-delegation.md`
Expected: 输出 1

- [ ] **Step 4: 提交**

```bash
git add w-model-dev/references/subagent-delegation.md
git commit -m "feat(loop-3+4): subagent-delegation O 角色允许动作扩展（事件路由 + 改进信号分析）"
```

---

### Task C6: definition-of-done.md 自检清单新增 Loop 4 报告审查项

**Files:**
- Modify: `w-model-dev/references/definition-of-done.md`（自检清单新增条目）

- [ ] **Step 1: 定位自检清单最后一项**

Run: `cd w-model-dev && grep -n "未命中 \[anti-patterns.md" references/definition-of-done.md`
Expected: 找到自检清单最后一项行号

- [ ] **Step 2: 在自检清单末尾新增 Loop 4 报告审查项**

在 `w-model-dev/references/definition-of-done.md` 的自检清单，最后一项后新增：

```markdown
- [ ] L2+ 项目：阶段门放行后已审查 Loop 4 产出的 HarnessImprovementReport（若有）；appliedSignals/deferredSignals/rejectedSignals 已填入 applicationStatus
```

- [ ] **Step 3: 验证新增**

Run: `cd w-model-dev && grep -c "Loop 4 产出的 HarnessImprovementReport" references/definition-of-done.md`
Expected: 输出 1

- [ ] **Step 4: 提交**

```bash
git add w-model-dev/references/definition-of-done.md
git commit -m "feat(loop-4): definition-of-done 自检清单新增 Loop 4 报告审查项"
```

---

### Task C7: SKILL.md 更新（L2+ 激活 + /wm hill-climbing 命令 + 约束）

**Files:**
- Modify: `w-model-dev/SKILL.md`（命令速查 + 约束补充）

- [ ] **Step 1: 定位命令速查表**

Run: `cd w-model-dev && grep -n "^## 命令速查" SKILL.md`
Expected: 找到命令速查节行号

- [ ] **Step 2: 在命令速查表新增 /wm hill-climbing 行**

在 `w-model-dev/SKILL.md` 的命令速查表，`/wm import` 行后新增：

```markdown
| `/wm hill-climbing` | 改进信号 | L2+ 项目：分析 run-log 产出 HarnessImprovementReport；人审后手动应用改进 | O 分析（状态读写+分析，非实施） |
```

- [ ] **Step 3: 定位不可违反的约束节**

Run: `cd w-model-dev && grep -n "^## 不可违反的约束" SKILL.md`
Expected: 找到约束节行号

- [ ] **Step 4: 在约束节末尾新增 Loop 4 不自动改 harness 约束**

在 `w-model-dev/SKILL.md` 的「不可违反的约束」节末尾新增：

```markdown
- **Loop 4 不自动改 harness**：爬坡循环（Loop 4，详见 [hill-climbing-guide.md](references/hill-climbing-guide.md)）只产出 HarnessImprovementReport 改进信号，不自动改 prompt/工具/验证规则。人审后手动应用；外部 SkillOpt/darwin-skill 消费信号做演化。违反命中反模式 #10（编排者越权）。
```

- [ ] **Step 5: 验证新增**

Run: `cd w-model-dev && grep -c "/wm hill-climbing\|Loop 4 不自动改 harness" SKILL.md`
Expected: 输出 2

- [ ] **Step 6: 提交**

```bash
git add w-model-dev/SKILL.md
git commit -m "feat(loop-3+4): SKILL 新增 /wm hill-climbing 命令 + Loop 4 约束"
```

---

### Task C8: AGENTS.md 更新（§2 目录 + §3 命令）

**Files:**
- Modify: `AGENTS.md`（§2 关键目录速查 + §3 常用命令）

- [ ] **Step 1: 定位 §2 references/ 行**

Run: `grep -n "definition-of-done（项目级 DoD 六维度含理解证据）" AGENTS.md`
Expected: 找到 references/ 描述行号

- [ ] **Step 2: 在 §2 references/ 描述中补充 event-ingress-guide / hill-climbing-guide**

修改 `AGENTS.md` 的 §2 references/ 行，在 `definition-of-done（项目级 DoD 六维度含理解证据）` 后补充：

```markdown
/ event-ingress-guide（Loop 3 事件接驳：EventIngress schema + 路由表 + 消费方指引，L2+ 激活）/ hill-climbing-guide（Loop 4 爬坡循环：HarnessImprovementReport schema + 信号检测 + 报告消费流程）
```

- [ ] **Step 3: 定位 §3 常用命令节**

Run: `grep -n "^## 3. 常用命令" AGENTS.md`
Expected: 找到 §3 行号

- [ ] **Step 4: 在 §3 常用命令节末尾新增 /wm hill-climbing**

在 `AGENTS.md` 的 §3 常用命令节，`npm run prepush` 行后新增：

```markdown
npm run hill-climbing                           # （编排者 O 执行）L2+ 项目：分析 run-log 产出 HarnessImprovementReport；非门禁脚本，O 确定性分析
```

- [ ] **Step 5: 验证新增**

Run: `grep -c "event-ingress-guide\|hill-climbing-guide\|hill-climbing" AGENTS.md`
Expected: 输出 ≥ 3

- [ ] **Step 6: 提交**

```bash
git add AGENTS.md
git commit -m "feat(loop-3+4): AGENTS §2 目录 + §3 命令同步更新"
```

---

### Task C9: README.md 特性列表追加 Loop 3/Loop 4

**Files:**
- Modify: `README.md`（特性列表追加）

- [ ] **Step 1: 定位特性列表**

Run: `grep -n "^## 特性\|^## Features\|Loop Engineering\|成熟度阶梯" README.md`
Expected: 找到特性列表或相关节行号

- [ ] **Step 2: 在特性列表追加 Loop 3/Loop 4 描述**

在 `README.md` 的特性列表（或合适位置）追加：

```markdown
- **Loop 3 事件驱动循环**（L2+ 激活）：棕地维护场景的事件接驳——消费方自行实现 webhook/cron 触发器写入 `event-ingress.jsonl`，编排者 O 按事件类型路由到单阶段（bug 修复/需求变更/验收重跑/回归测试/安全事件）。不内置调度基础设施。详见 [event-ingress-guide.md](w-model-dev/references/event-ingress-guide.md)。
- **Loop 4 爬坡循环**：分析 run-log 产出 HarnessImprovementReport 改进信号（prompt/工具/验证规则/反模式/成熟度/预算 6 类），人审后手动应用。保持"技能自演化不在本仓库"原则——外部 SkillOpt/darwin-skill 消费信号做演化。详见 [hill-climbing-guide.md](w-model-dev/references/hill-climbing-guide.md)。
```

- [ ] **Step 3: 验证追加**

Run: `grep -c "Loop 3 事件驱动循环\|Loop 4 爬坡循环" README.md`
Expected: 输出 2

- [ ] **Step 4: 提交**

```bash
git add README.md
git commit -m "feat(loop-3+4): README 特性列表追加 Loop 3/Loop 4"
```

---

## Part D：验证

### Task D1: 运行 self-test 验证无回归

**Files:**
- 无文件修改（仅验证）

- [ ] **Step 1: 运行 self-test**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && npm run self-test`
Expected: 退出码 0，输出末行含 `总计 N 条用例：N 通过，0 失败`（N 为当前基线数，AGENTS.md §3 标注 66；若 Part A 增强后已升至 82，以实际为准；本计划不改脚本，N 不变）

- [ ] **Step 2: 若失败，回退检查**

若 self-test 失败，检查是否意外修改了 `w-model-dev/scripts/*.ts`。Run: `git diff --name-only w-model-dev/scripts/*.ts`
Expected: 输出为空（本计划不改脚本）

- [ ] **Step 3: 不提交（验证步骤无产物）**

---

### Task D2: 验证所有样本可解析

**Files:**
- 无文件修改（仅验证）

- [ ] **Step 1: 验证 event-ingress 样本**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev/scripts/samples/event-ingress && for f in *.jsonl; do echo "=== $f ==="; node -e "require('fs').readFileSync('$f','utf8').trim().split('\n').forEach((l,i)=>{try{JSON.parse(l);console.log('  line '+((i+1)+': OK'))}catch(e){console.log('  line '+(i+1)+': PARSE ERROR - '+e.message)}})"; done`
Expected: valid.jsonl 3 行全 OK；bad-*.jsonl 各 1 行（bad 样本设计为单行）

- [ ] **Step 2: 验证 hill-climbing 样本**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack/w-model-dev/scripts/samples/hill-climbing && for f in *.json; do echo "=== $f ==="; node -e "try{require('./$f');console.log('  OK')}catch(e){console.log('  ERROR - '+e.message)}"; done`
Expected: 4 个文件均输出 `OK`（JSON 可解析）

- [ ] **Step 3: 不提交（验证步骤无产物）**

---

### Task D3: 验证 SSoT 追溯完整性

**Files:**
- 无文件修改（仅验证）

- [ ] **Step 1: 验证 §10F/§10G 存在**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && grep -c "^## 10F\.\|^## 10G\." docs/skill-design-document_SSoT.md`
Expected: 输出 2

- [ ] **Step 2: 验证 §10A 追溯表含 §10F/§10G 行**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && grep -c "| 10F 事件驱动循环\|| 10G 爬坡循环" docs/skill-design-document_SSoT.md`
Expected: 输出 2

- [ ] **Step 3: 验证 §10C 含 L2+ 事件驱动激活**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && grep -c "L2+ 事件驱动激活" docs/skill-design-document_SSoT.md`
Expected: 输出 1

- [ ] **Step 4: 不提交（验证步骤无产物）**

---

### Task D4: 验证 references 与 SSoT 双向追溯

**Files:**
- 无文件修改（仅验证）

- [ ] **Step 1: 验证 event-ingress-guide.md 引用 SSoT §10F**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && grep -c "§10F\|SSoT.*§10F" w-model-dev/references/event-ingress-guide.md`
Expected: 输出 ≥ 1

- [ ] **Step 2: 验证 hill-climbing-guide.md 引用 SSoT §10G**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && grep -c "§10G\|SSoT.*§10G" w-model-dev/references/hill-climbing-guide.md`
Expected: 输出 ≥ 1

- [ ] **Step 3: 验证 data-models.md 含两个 schema**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && grep -c "EventIngress\|HarnessImprovementReport" w-model-dev/references/data-models.md`
Expected: 输出 ≥ 6（目录 2 + 标题 2 + schema 引用 2）

- [ ] **Step 4: 验证 operational-recovery.md 含事件驱动节**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && grep -c "事件驱动与棕地维护" w-model-dev/references/operational-recovery.md`
Expected: 输出 ≥ 2

- [ ] **Step 5: 验证 anti-patterns.md 含候选反模式节**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && grep -c "候选反模式检测信号" w-model-dev/references/anti-patterns.md`
Expected: 输出 ≥ 2

- [ ] **Step 6: 验证 subagent-delegation.md 含 O 角色扩展**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && grep -c "⑧ \*\*维护 event-ingress.jsonl\|⑨.*HarnessImprovementReport" w-model-dev/references/subagent-delegation.md`
Expected: 输出 ≥ 1

- [ ] **Step 7: 验证 definition-of-done.md 含 Loop 4 项**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && grep -c "Loop 4 产出的 HarnessImprovementReport" w-model-dev/references/definition-of-done.md`
Expected: 输出 1

- [ ] **Step 8: 验证 SKILL.md 含命令 + 约束**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && grep -c "/wm hill-climbing\|Loop 4 不自动改 harness" w-model-dev/SKILL.md`
Expected: 输出 2

- [ ] **Step 9: 验证 AGENTS.md 含目录 + 命令**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && grep -c "event-ingress-guide\|hill-climbing-guide" AGENTS.md`
Expected: 输出 ≥ 2

- [ ] **Step 10: 不提交（验证步骤无产物）**

---

### Task D5: 最终提交 + 总结

**Files:**
- 无文件修改（仅总结）

- [ ] **Step 1: 检查 git 状态**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && git status`
Expected: 工作树干净（所有变更已提交）

- [ ] **Step 2: 查看 commit 历史**

Run: `cd Software_Engineering_W_Development_Model_Skills_Pack && git log --oneline -15`
Expected: 看到 13 个 feat(loop-3)/feat(loop-4) 提交（A1-A4 + B1-B4 + C1-C9）

- [ ] **Step 3: 输出实现总结**

实现总结应包含：
- Part A（Loop 3）：4 个任务完成（event-ingress-guide.md + data-models EventIngress schema + 4 样本 + operational-recovery 节）
- Part B（Loop 4）：4 个任务完成（hill-climbing-guide.md + data-models HarnessImprovementReport schema + 4 样本 + anti-patterns 候选节）
- Part C（跨切面）：9 个任务完成（SSoT §10F/§10G/§10A/§10C + subagent-delegation + definition-of-done + SKILL + AGENTS + README）
- Part D（验证）：5 个任务完成（self-test 无回归 + 样本可解析 + SSoT 追溯完整 + references 双向追溯 + 最终提交）

---

## 自检清单

实现完成后，对照 spec §4.5 验收标准逐项确认：

- [ ] SSoT 新增 §10F/§10G，与本文档双向追溯（Task C1, C2, C3, D3）
- [ ] data-models.md 含 EventIngress + HarnessImprovementReport schema（Task A2, B2, D4）
- [ ] event-ingress-guide.md 含 schema + 路由表 + 激活条件 + 消费方指引（Task A1）
- [ ] hill-climbing-guide.md 含 schema + 信号检测逻辑 + 触发时机 + 消费流程（Task B1）
- [ ] operational-recovery.md 含「事件驱动与棕地维护」节（Task A4, D4）
- [ ] subagent-delegation.md O 角色允许动作扩展（事件路由 + 改进分析）（Task C5, D4）
- [ ] anti-patterns.md 含候选反模式检测信号说明（Task B4, D4）
- [ ] definition-of-done.md 六维度自检新增 Loop 4 报告审查项（Task C6, D4）
- [ ] SKILL.md 含 L2+ 事件驱动激活 + `/wm hill-climbing` 命令（Task C7, D4）
- [ ] AGENTS.md §2/§3 同步更新（Task C8, D4）
- [ ] `npm run self-test` 仍通过（无脚本变更，回归基线不变）（Task D1）
- [ ] 样本文件 valid/bad 齐全（event-ingress + hill-climbing 各 ≥ 1 valid + ≥ 2 bad）（Task A3, B3, D2）
