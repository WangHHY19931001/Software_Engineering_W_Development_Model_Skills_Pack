# 图谱模型说明（Graph Guide）

> 本文件定义 ingestion 子流程的图谱模型：节点/边类型、单根树约束、阶段递进追溯规则、graph.json 与 rtm.json 的分工。
> A 子代理（A-chunk/A-cross/A-evolve）与 G 子代理（跑 check-requirement-graph.ts）必读。

## 节点类型

| 阶段 | 类型 | 提取者 | 语义 |
|---|---|---|---|
| 1 | REQ | A-chunk | 功能/非功能/约束需求 |
| 2 | SD | A-evolve | 系统模块/组件 |
| 3 | INTF | A-evolve | 接口实体 |
| 4 | DD | A-evolve | 详细设计单元 |

节点 id 格式 `<TYPE>-<NNN>` 全局唯一。

## 边类型

| 类型 | 方向 | 语义 | 数量约束 |
|---|---|---|---|
| parent | 父→子 | 单根树主结构边：REQ→SD→INTF→DD | 非根节点恰好 1 条入边；根 0 条 |
| depends-on | 任意→任意 | 通用依赖 | ≥0 |
| implements | SD→REQ | 设计实现需求（追溯边） | 每 SD ≥1 |
| defines | SD→INTF | 系统设计定义接口 | 每 INTF ≥1（阶段3起校验） |
| realizes | DD→INTF | 详细设计实现接口 | 每 DD ≥1（阶段4起校验） |

单根树由 parent 边构成。implements/defines/realizes 是追溯边，不参与父唯一性但参与连通性。

## 阶段递进追溯（门禁同步收敛）

| 阶段 | 校验项 | 硬约束 |
|---|---|---|
| 1 | 连通 + 单根 + 父唯一 | 是 |
| 2 | + SD_without_implements=0 | 是 |
| 3 | + INTF_without_defines=0 | 是 |
| 4 | + DD_without_realizes=0 | 是（零违反才放行进编码） |

门禁项单调递增，违反数应单调递减至 0。

## graph.json schema

见 [ingestion-graph-convergence-design.md](../../docs/ingestion-graph-convergence-design.md) §2.4。

## 与 rtm.json 的分工

| 文件 | 管什么 | G 跑什么 |
|---|---|---|
| graph.json | 结构拓扑（连通/单根/追溯） | check-requirement-graph.ts |
| rtm.json | 追溯矩阵（需求-设计-代码-测试映射） | check-artifact-gate.ts（阶段8） |

两者并存，各自独立校验，互不替代。graph.json 是结构层，rtm.json 是追溯层。

## 校验脚本

```bash
npx tsx w-model-dev/scripts/check-requirement-graph.ts "<graph.json|consolidated.json>" [--phase=1|2|3|4]
```

退出码 0=通过 / 1=失败 / 2=输入错误。算法详见 [ingestion-graph-convergence-design.md](../../docs/ingestion-graph-convergence-design.md) §3.2。
