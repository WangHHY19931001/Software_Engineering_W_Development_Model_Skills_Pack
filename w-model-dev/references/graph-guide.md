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
| 1+ | EXT-IN | A-chunk | 合法外部信息源（用户输入/外部 API/业务背景），豁免奇迹判定 |
| 1+ | EXT-OUT | A-chunk | 合法外部信息汇（界面展示/持久化/验收输出），豁免黑洞判定 |

节点 id 格式 `<TYPE>-<NNN>` 全局唯一。

## 边类型

| 类型 | 方向 | 语义 | 数量约束 |
|---|---|---|---|
| parent | 父→子 | 单根树主结构边：REQ→SD→INTF→DD | 非根节点恰好 1 条入边；根 0 条 |
| depends-on | 任意→任意 | 通用依赖 | ≥0 |
| implements | SD→REQ | 设计实现需求（追溯边） | 每 SD ≥1 |
| defines | SD→INTF | 系统设计定义接口 | 每 INTF ≥1（阶段3起校验） |
| realizes | DD→INTF | 详细设计实现接口 | 每 DD ≥1（阶段4起校验） |
| produces | 生产者→消费者/EXT-OUT | 信息流方向：from 产出信息给 to | 信息流层，≥0 |
| consumes | EXT-IN/生产者→消费者 | 信息流方向：to 从 from 消费信息 | 信息流层，≥0 |

单根树由 parent 边构成。implements/defines/realizes 是追溯边，不参与父唯一性但参与连通性。

## 信息流模型（黑洞 / 奇迹 / 死模块）

> 公理：任何软件系统都不是黑洞或奇迹，也不存在无信息流经的模块。
> 与结构连通门禁**正交**——结构边（parent/implements/...）管归属追溯，信息流边（produces/consumes）管信息闭合。一个节点可结构追溯完整却仍是信息流黑洞。

三条不变量（仅对业务节点 REQ/SD/INTF/DD，边界节点豁免）：

| 反常 | 定义 | 判定（信息流入度/出度） |
|---|---|---|
| 黑洞 | 只进不出，信息消失 | in>0 ∧ out=0 |
| 奇迹 | 只出不进，信息凭空产生 | in=0 ∧ out>0 |
| 死模块 | 无信息流经 | in=0 ∧ out=0 |

**方向约定**：produces/consumes 的 `{from,to}` 一律表信息流方向，`to=n` 即流入 n，`from=n` 即流出 n。

**边界节点**：EXT-IN（源）/ EXT-OUT（汇）显式化系统边界（DFD terminator），不参与 parent 单根树，参与连通性与信息流。阶段 1 起须各 ≥1。

**跨阶段收敛**：阶段 1 REQ 信息流闭合（严格）；阶段 2/3/4 各自 SD/INTF/DD 无黑洞/奇迹/死模块；阶段 4 信息流零违反 + 结构零违反才放行进编码。

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
