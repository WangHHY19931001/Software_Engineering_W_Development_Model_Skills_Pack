# 图谱模型说明（Graph Guide）

> 本文件定义 ingestion 子流程的图谱模型：节点/边类型、系统层级树约束、多层图谱（7 层）、阶段递进追溯规则、graph.json 与 rtm.json 的分工。
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
| parent | 父→子 | 系统层级树主结构边：REQ(L0)→SD(L1)→INTF(L2)→DD(L3) | 非根节点恰好 1 条入边；根 0 条；层级单调（见 §3） |
| depends-on | 同层→同层 | 同层节点依赖（SD→SD / INTF→INTF） | ≥0；禁止环依赖；目标须存在 |
| implements | SD→REQ | 设计实现需求（追溯边） | 每 SD ≥1 |
| defines | SD→INTF | 系统设计定义接口 | 每 INTF ≥1（阶段3起校验） |
| realizes | DD→INTF | 详细设计实现接口 | 每 DD ≥1（阶段4起校验） |
| produces | 生产者→消费者/EXT-OUT | 信息流方向：from 产出信息给 to（双向语义由 from/to 表达；consumes 已移除） | 信息流层，≥0 |
| governs | 治理类子系统→被治理子系统 | 横切治理（如 S08 governs 多个子系统） | ≥0；源须为治理类子系统；不依附层级树（见 §7） |
| collaborates-with | 节点↔节点 | 对等协作（单条边语义双向） | ≥0；禁止指向不存在节点；不依附层级树（见 §7） |
| derives | S11→派生产物 | 派生规格（如 TLA+ spec derives 自设计节点） | ≥0；源须为 S11；不依附层级树（见 §7） |

系统层级树由 parent 边构成（见 §3）。implements/defines/realizes 是追溯边，不参与父唯一性但参与连通性。governs/collaborates-with/derives 是横切边，不依附层级树（见 §7）。consumes 边类型已移除（D21）：信息流层统一用 produces，双向语义由 from/to 表达。

## 系统层级树分析（单根 / 层级单调 / orphan / 环检测）

> 跨阶段的结构主干，由 parent 边构成。根 = 系统本身（系统级 REQ 节点担任），子系统根/接口根逐级依附。本节是多层图谱第 1 层（结构层）的校验规则；信息流不变量（黑洞/奇迹/死模块）见 §7 第 4 层。

**层级定义**：

| Level | 节点类型 | 角色 |
|---|---|---|
| L0 | REQ | 系统根（系统对外代理，如 REQ-001） |
| L1 | SD | 子系统根，通过 parent 依附系统根 |
| L2 | INTF | 接口根，通过 parent 依附子系统根 |
| L3 | DD | 详细设计单元，通过 parent 依附接口根 |

**校验规则**（graph-logic.ts 单点事实源，对齐 SSoT §10.10.1）：

1. **根候选**：parent 入边为 0 的节点（排除 EXT-IN/EXT-OUT 边界节点）。
2. **根类型约束**：
   - 根候选中存在非 REQ 节点 → 违反「根必须是系统」；
   - 多个 REQ 节点 → 多根违反；
   - 零个 REQ 节点 → 报「缺少系统根，可能存在 parent 边环」，转入环检测（规则 5）。
3. **层级单调**：parent 边只能从 Level N → Level N-1（REQ=L0 / SD=L1 / INTF=L2 / DD=L3），禁止跨层或逆向依附；违反 → `hierarchyTreeViolation`，check-requirement-graph.ts 退出码 1。
4. **orphan 检测**：`reachableFromRoot = BFS(parent 边反向，从唯一系统根出发能到达的节点集合)`；orphans = 所有非边界节点 − reachableFromRoot；存在 orphan → 违反。
5. **环检测**：零根场景时对 parent 边做 DFS 三色染色，发现灰边（回边）则报「parent 边存在环」。
6. **根节点豁免死模块**：REQ-001 作为系统根，是系统对外交互的代理，in=0 ∧ out=0 不判死模块（历史缺陷 D11：旧 graph-logic.ts 曾误报根为死模块）。EXT-IN/EXT-OUT 边界节点同样豁免。死模块完整定义见 §7 第 4 层。

implements/defines/realizes 追溯边与 governs/collaborates-with/derives 横切边均不参与父唯一性，也不依附层级树。

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

## 多层图谱（7 层）

> 在系统层级树（§3）之上叠加 7 层正交图谱，各层边类型独立校验。横切层（5/6/7）不依附层级树，但两端节点须已登记于层级树。本节是 graph-logic.ts 多层校验的单点事实源（对齐 SSoT §10.10.2 / §10.10.3）。

| # | 层名 | 边类型 | 语义 | 校验规则 |
|---|---|---|---|---|
| 1 | 结构层 | `parent` | 系统层级树依附 | 单根、父唯一、层级单调、无环、orphan 检测（见 §3） |
| 2 | 依赖层 | `depends-on` | 同层节点依赖（SD→SD / INTF→INTF） | 两端须为同层节点；禁止环依赖；依赖目标须存在 |
| 3 | 追溯层 | `implements` / `defines` / `realizes` | 跨层追溯（SD→REQ / SD→INTF / DD→INTF） | SD_without_implements=0 / INTF_without_defines=0 / DD_without_realizes=0（阶段递进，见 §4） |
| 4 | 信息流层 | `produces` | 信息流转（from 产出给 to） | 无黑洞/奇迹/死模块；根节点豁免死模块；EXT-IN/OUT 须依附根树 |
| 5 | 治理层 | `governs` | 横切治理（治理类子系统→多子系统，如 S08） | 源须为治理类子系统；目标须为被治理子系统且存在；不依附层级树 |
| 6 | 协作层 | `collaborates-with` | 对等协作 | 单条边语义双向：存在 A→B 即视为 A 与 B 协作，不要求同时存在 B→A；禁止指向不存在节点；不依附层级树 |
| 7 | 派生层 | `derives` | 派生规格（S11→派生产物） | 源须为 S11（派生规格节点）；目标须为派生产物且存在；不依附层级树 |

**信息流层（第 4 层）不变量**（仅对业务节点 REQ/SD/INTF/DD；边界节点 EXT-IN/EXT-OUT 与系统根豁免）：

| 反常 | 定义 | 判定（信息流入度/出度） |
|---|---|---|
| 黑洞 | 只进不出，信息消失 | in>0 ∧ out=0 |
| 奇迹 | 只出不进，信息凭空产生 | in=0 ∧ out>0 |
| 死模块 | 无信息流经 | in=0 ∧ out=0 |

- **方向约定**：produces 的 `{from,to}` 一律表信息流方向，`to=n` 即流入 n，`from=n` 即流出 n。consumes 边类型已移除（D21），信息流层统一用 produces，双向语义由 from/to 表达。
- **边界节点**：EXT-IN（源）/ EXT-OUT（汇）显式化系统边界（DFD terminator），不参与 parent 单根树，参与连通性与信息流。阶段 1 起须各 ≥1。
- **根节点豁免死模块**：系统根 REQ-001（系统对外代理）与边界节点 in=0 ∧ out=0 不判死模块（见 §3）。
- **跨阶段收敛**：阶段 1 REQ 信息流闭合（严格）；阶段 2/3/4 各自 SD/INTF/DD 无黑洞/奇迹/死模块；阶段 4 信息流零违反 ∧ 结构零违反才放行进编码。
- **与结构门禁正交**：结构边（parent/implements/...）管归属追溯，信息流边（produces）管信息闭合。一个节点可结构追溯完整却仍是信息流黑洞。

**跨层一致性**（对齐 SSoT §10.10.3）：

1. 横切边（governs/collaborates-with/derives，即第 5/6/7 层）不依附系统层级树，但两端节点须已登记于层级树（REQ/SD/INTF/DD 之一），不构成 parent 关系。
2. 横切边不替代追溯：被治理子系统的 parent 仍是系统根（治理是横切叠加，不改变结构依附）；追溯层与横切层并存，互不替代。
3. 信息流可跨层流动，但两端须在层级树中。

## 校验脚本

```bash
npx tsx w-model-dev/scripts/check-requirement-graph.ts "<graph.json|consolidated.json>" [--phase=1|2|3|4]
```

退出码 0=通过 / 1=失败 / 2=输入错误。算法详见 [ingestion-graph-convergence-design.md](../../docs/ingestion-graph-convergence-design.md) §3.2。

## 与 TLA+ 行为门禁的关系

图谱门禁（本文件）管**静态结构拓扑**（连通/单根/父唯一/追溯 + 信息流闭合），TLA+ 行为门禁管**动态行为正确性**（状态机/不变式/死锁）。两者**正交**，是阶段 1–4 的两个独立门禁维度：

| 维度 | 校验什么 | 产物 | 门禁脚本 |
|---|---|---|---|
| 结构 + 信息流（本文件） | 节点归属单根树 + 追溯完整 + 无黑洞/奇迹/死模块 | `graph.json` | `check-requirement-graph.ts` |
| 行为正确性（TLA+） | 层次化状态机无死锁/不变式违反/状态爆炸 | `tla-manifest.json` + `.tla` + `.cfg` | `check-tla-model.ts` |

**阶段 4 硬约束**：`--phase=4` 图谱零违反 ∧ TLA+ 零违反才放行进阶段 5 编码。两个门禁均由 G 子代理跑、退出码为准（约束 4，反模式 #12）。

TLA+ 层次化建模（L1–L6）、文件头规范、SANY/TLC 校验顺序、拆解阈值（>1k 考虑拆 / >1w 必须拆）详见 [tla-plus-guide.md](./tla-plus-guide.md) 与 [tla-plus-modeling-design.md](../../docs/tla-plus-modeling-design.md)。
