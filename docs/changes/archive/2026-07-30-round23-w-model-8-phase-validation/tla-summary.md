# TLA+ 行为门禁摘要（Round 23）

## 总体
- 规格总数：4（1 L1 + 1 L2 + 1 L3 + 1 L4）
- SANY 语法检查：通过
- TLC 模型检查：通过
- 死锁/不变式违反/状态爆炸：0
- 占位/简化/错误实现：0

## 4 个规格清单

| 规格 | 层级 | 路径 | 状态 |
|---|---|---|---|
| L1-BlogSystem | L1 | tla/specs/level1/L1-BlogSystem.tla | ✓ |
| L2-AuthService | L2 | tla/specs/level2/L2-AuthService.tla | ✓ |
| L3-ArticleStateMachine | L3 | tla/specs/level3/L3-ArticleStateMachine.tla | ✓ |
| L4-WebhookDelivery | L4 | tla/specs/level4/L4-WebhookDelivery.tla | ✓ |

## 头注解双向同步

- L1: @child L2-AuthService, L2-ArticleService, ...
- L2: @parent L1-BlogSystem, @sibling L2-...
- L3: @parent L2-ArticleService
- L4: @parent L3-WebhookDelivery

## 状态机/转移/不变式统计

- L1: 5 变量 / 3 状态 / 6 转移 / 5 不变式
- L2: 6 变量 / 4 状态 / 6 转移 / 5 不变式
- L3: 5 变量 / 5 状态 / 7 转移 / 5 不变式
- L4: 6 变量 / 5 状态 / 7 转移 / 6 不变式

## tla-manifest.json 合规性
- checkRounds: []（反模式 #14 合规）
- 所有 4 spec 登记
- 与头注解双向同步
