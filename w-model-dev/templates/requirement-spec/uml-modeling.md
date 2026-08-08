# UML 需求建模（UML Requirement Modeling）

> 对应 DESIGN.md 附录 A UML 2.0 系统建模图表集。需求级建模，仅用例图 + 领域类图 + 活动图；
> 序列图/状态机图由 TLA+/BDD 覆盖（.feature 文件 + .tla 文件承载），不在此重复。
> 模板版本：v1.0（第 37 轮）。主规格引用块：`> UML 需求建模详见 [uml-modeling.md](./uml-modeling.md)`。

## A.1 用例图

> 参与者 / 用例 / 关系（include/extend/泛化）。需求级，不涉及设计级组件。
> 参与者 = 主规格 §3 User Stories 的 stakeholder；用例 = 主规格 §4 层级树 level=2/3 REQ（FM-3D-09 检测信号）。

```mermaid
graph TB
  Actor1(({{参与者}})) --> UC1({{用例1}})
  UC1 -.->|include| UC2({{用例2}})
```

## A.2 领域类图

> 需求级领域实体 / 关系（关联/聚合/组合/泛化）/ 属性。无方法签名（设计级才补）。
> 领域实体 = 主规格 §4 层级树 level=1/2 REQ 的名词性概念（FM-3D-09 检测信号）。

```mermaid
classDiagram
  class {{DomainEntity1}} {
    +{{属性1}}
  }
  {{DomainEntity1}} "1" --> "*" {{DomainEntity2}} : {{关系}}
```

## A.3 活动图

> 业务流程 / 用户旅程。需求级，不涉及设计级控制流。
> 活动节点 = 主规格 §3 User Stories 正常场景序列（FM-3D-09 检测信号）。
> 注：mermaid 无独立活动图语法，用 `stateDiagram-v2` 表达活动节点流转。

```mermaid
stateDiagram-v2
  [*] --> {{状态1}}
  {{状态1}} --> {{状态2}} : {{事件}}
```

> 门禁：`check-requirement-graph.ts` R8 校验本文件 mermaid 块首尾定界行一一配对。
