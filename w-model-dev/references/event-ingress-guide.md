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
