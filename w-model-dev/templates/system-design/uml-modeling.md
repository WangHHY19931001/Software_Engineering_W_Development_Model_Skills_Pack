# UML 系统级建模（UML System-Level Modeling）

> 对应 DESIGN.md 附录 A UML 2.0 系统建模图表集（系统级子集）。系统级建模仅部署图 + 顶层组件图 + 包图 + 用例图；
> 接口级图表（序列图/通信图）由阶段 3 承接，类级图表（类图/ER 图/状态机图）由阶段 4 承接，不在此重复。
> **阶段边界**：本文件只产系统级 UML，越界即返工（FM-SD-06）。
> 模板版本：v1.0。主文档引用块：`> UML 系统级建模详见 [{{module}}-uml-modeling.md](./{{module}}-uml-modeling.md)`。

## A.1 部署图

> 节点 + 进程 + 数据流。系统级，不含模块内部组件。

```mermaid
graph TB
  subgraph {{节点1}}
    {{进程1}}
  end
  subgraph {{节点2}}
    {{进程2}}
  end
  {{进程1}} -.->|数据流| {{进程2}}
```

## A.2 顶层组件图

> 分层 + 组件依赖 + 数据流。组件 = 主模板 §3 模块划分的模块（FM-SD-04 检测信号）。

```mermaid
graph TB
  {{组件1}} -->|依赖| {{组件2}}
  {{组件2}} -.->|数据流| {{组件3}}
```

## A.3 包图

> 模块/包依赖。包 = 主模板 §3 模块划分的分组。

```mermaid
graph TB
  {{包1}} --> {{包2}}
```

## A.4 系统级用例图

> 参与者 = 需求规格 §5 stakeholder；用例 = 需求规格 §6 层级树 level≥2 REQ（FM-SD-04 检测信号）。

```mermaid
graph TB
  Actor1(({{参与者}})) --> UC1({{用例1}})
  UC1 -.->|include| UC2({{用例2}})
```

> 门禁：`check-requirement-graph.ts` R10 校验本文件 mermaid 块首尾定界行一一配对（批 3 实现）。
