# TLA+ 规格清单 — 2026-07-27 第十九轮 W 模型 8 阶段端到端调测

> 分层 TLA+ 建模（L1/L2/L3/L4），与 W 模型阶段 1-4 同步产出。
> L4 通过 TLC 模型检验：零死锁、零不变式违反、状态空间可控。

## TLA+ 规格汇总

| 规格 ID | 层级 | 阶段 | 系统 | 变量组合数 | 分解决策 | 语法检查 | TLC 检查 | 无死锁 | 不变式成立 | 状态爆炸 |
|---|---|---|---|---|---|---|---|---|---|---|
| L1-BlogSystem | L1 | 1 | BlogSystem | 504 | split-done | false | false | false | false | false |
| L2-BlogSystem | L2 | 2 | BlogSystem | 480 | kept-below-threshold | false | false | false | false | false |
| L3-BlogSystem | L3 | 3 | BlogSystem | 280 | kept-below-threshold | false | false | false | false | false |
| L4-BlogSystem | L4 | 4 | BlogSystem | 280 | kept-below-threshold | **true** | **true** | **true** | **true** | false |

## 分层结构

```
L1-BlogSystem（系统交互层，阶段1）
  └── L2-BlogSystem（子系统行为+交互层，阶段2）
        └── L3-BlogSystem（原子子系统行为层，阶段3）
              └── L4-BlogSystem（详细方法级状态机层，阶段4）
```

## 需求/设计映射

| 规格 ID | 关联需求 | 关联设计 |
|---|---|---|
| L1-BlogSystem | REQ-001~022 | SD-001~022 |
| L2-BlogSystem | REQ-001~022 | SD-001~022 |
| L3-BlogSystem | REQ-001~022 + SD-001~022 | INTF-001~022 |
| L4-BlogSystem | REQ-001~022 + SD-001~022 + INTF-001~022 | DD-001~075 |

## L4-BlogSystem 状态机（TLC 通过）

- **状态机 ID**：SM-L4-BlogSystem
- **状态转移**：Ready → ValidatingArgs → Executing → Returning → Ready（含 Faulted 异常分支）
- **不变式数量**：7 个
- **TLC 模型检验结果**：零死锁、零不变式违反、状态空间 125 可控

## code-TLA+ 一致性（阶段5 编码实现）

4 维度全部通过：

| 维度 | 项数 | 说明 |
|---|---|---|
| SD→codeModule 映射 | 22 | SD-001~022 → src/modules/*/sd-NNN-*.ts |
| 代码状态转移 | 11 | 代码中提取的状态转移与 TLA+ Next 分支一致 |
| Next 分支对应 | 29 | startArticleOp/receiveRequest 等 Next 分支与代码对应 |
| 断言覆盖不变式 | 16 | 代码断言覆盖 TLA+ 7 个不变式 |
| **总计** | **78** | **4 维度全部通过** |

## checkRounds 记录

- `tla-manifest.json.checkRounds`：空数组（本轮无 TLA+ 修正轮次，L4 首次 TLC 即通过）

## 备注

- L1/L2/L3 未经 TLC 检查（按规范，L4 为最详细层，TLC 检查聚焦 L4）
- L4 变量组合数 280 < 1000 阈值，无需进一步拆分
- L1 变量组合数 504 > 500 但 < 1000，标记 split-done（已通过 L2 分解）
