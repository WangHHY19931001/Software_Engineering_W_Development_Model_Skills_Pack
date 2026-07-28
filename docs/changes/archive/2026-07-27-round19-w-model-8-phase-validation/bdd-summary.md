# BDD feature 清单 — 2026-07-27 第十九轮 W 模型 8 阶段端到端调测

> 分层 BDD 建模（L1/L2/L3/L4），与 W 模型阶段 1-4 同步产出，与 TLA+ 规格正交协作。
> Cucumber.js v11 + Gherkin 语法。

## BDD features 汇总

| Feature ID | 层级 | 文件 | Scenario 数 | 状态机 ID | TLA+ 规格 ID | 关联需求 |
|---|---|---|---|---|---|---|
| BDD-L1-BlogSystem | L1 | BlogSystemL1.feature | 9 | SM-L1-BlogSystem | L1-BlogSystem | REQ-001~022 |
| BDD-L2-BlogSystem | L2 | BlogSystemL2.feature | 7 | SM-L2-BlogSystem | L2-BlogSystem | REQ-001~022 |
| BDD-L3-BlogSystem | L3 | BlogSystemL3.feature | 9 | SM-L3-BlogSystem | L3-BlogSystem | REQ-001~022 |
| BDD-L4-BlogSystem | L4 | BlogSystemL4.feature | 9 | SM-L4-BlogSystem | L4-BlogSystem | REQ-001~022 |
| **总计** | **4 层** | **4 features** | **34 scenarios** | **4 状态机** | **4 TLA+ 规格** | **22 REQ** |

## 分层结构

```
BDD-L1-BlogSystem（用户验收视角，阶段1需求分析）
  └── BDD-L2-BlogSystem（系统行为视角，阶段2系统设计）
        └── BDD-L3-BlogSystem（接口契约视角，阶段3概要设计）
              └── BDD-L4-BlogSystem（详细方法级 TDD 夹具，阶段4详细设计）
```

## 阶段-BDD 对应关系

| 阶段 | 阶段名 | BDD 角色 |
|---|---|---|
| 1 | 需求分析 | 设计 BDD-L1 features（用户验收场景） |
| 2 | 系统设计 | 设计 BDD-L2 features（系统行为场景） |
| 3 | 概要设计 | 设计 BDD-L3 features（接口契约场景） |
| 4 | 详细设计 | 设计 BDD-L4 features（详细方法级 TDD 夹具） |
| 5 | 编码实现 | 以 L4 features 作为 TDD 夹具驱动编码 |
| 6 | 集成测试 | 执行 L3 cucumber scenarios |
| 7 | 系统测试 | 执行 L2 cucumber scenarios |
| 8 | 验收测试 | 执行 L1 cucumber scenarios |

## BDD↔TLA+ 等价性

- 每个 BDD feature 关联对应层级的 TLA+ 规格（`tlaSpecId` 字段）
- BDD 状态机（`stateMachineId`）与 TLA+ 状态机一致
- `check-bdd-model.ts` D4 维度校验 BDD↔TLA+ 等价性

## check-bdd-model.ts 校验结果

7 维度全部通过：
- D1 头标注：feature 文件头标注所属系统/关联需求和设计/TLA 文件路径
- D2 Gherkin 语法：Scenario/Given/When/Then 语法正确
- D3 状态机：states/initialState/terminalStates/acceptingStates/rejectingStates/transitions/invariants 七要素完整
- D4 BDD↔TLA+ 等价：状态机与 TLA+ 规格一致
- D5 step 绑定：step 与代码绑定
- D6 scenario 路径：scenario 覆盖状态转移路径
- D7 RTM 映射：feature 关联的 REQ 在 RTM 中有对应测试用例

## 备注

- L1 BDD BlogSystemL1.feature cucumber-js 执行报告未生成 JSON（reworkHint，下一周期改进项）
- BDD features 与 RTM 测试列字段值格式：`<Type>-NNN | BDD-L<level>-<system>-<num>.feature`
