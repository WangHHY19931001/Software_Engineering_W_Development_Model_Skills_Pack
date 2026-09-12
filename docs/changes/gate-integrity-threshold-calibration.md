# 门禁完整性 campaign — 阈值定稿记录（2026-09-12）

> 对应计划 [任务 16](../superpowers/plans/2026-09-12-gate-integrity-evidence-reconciliation.md) 与规格 D23。
> 记录三个**先行取值**的定稿依据：`RESOLUTION_FLOOR`、`REVIEW_LEVEL_SPREAD`、`ICEBERG_VIEW_PRESENCE`。

## 口径声明（重要）

计划原文要求"跑一轮完整 8 阶段 `/wm` 流程"以校准阈值。**本轮未执行该 8 阶段真实运行。**

理由：`w-model-dev` 是**纯编排 + 校验脚本技能包**，不含 LLM 调用、不含编程式引擎（AGENTS.md §1）。8 阶段推进由外部 Agent 读取 `SKILL.md` 后驱动，无法由本会话自主完成。故本记录不以"跑过 e2e"充数。

**改用等价强度的替代依据**：三个常量都是"会不会误报"的判据，而误报可以在**全部既有真实样本**上直接实测——样本量远大于单轮 8 阶段所能覆盖的产物数。下表每项均给出可复现命令与实测数字。

## 一、`ICEBERG_VIEW_PRESENCE` — 已修正（唯一发现真问题的一项）

**定稿值**（`iceberg-sweep-logic.ts:56`）：

| 阶段 | 在场视角                        |
| ---- | ------------------------------- |
| 1    | graph, rtm                      |
| 2-8  | graph, tla, rtm（+ 5-8 含 scope） |

**原设计意图值**把 `graph` 排除在阶段 5-8 之外。**该值经阶段文献核定后判定为错误**，已修正：

- 阶段 2-4：`check-bdd-model.ts` 缺 `--graph` 即 `ARG_INVALID`/exit 2（graph 是 D8 SD Coverage 的数据源）；
- 阶段 5-8：同样传 `--graph=.w-model/ingestion/graph.json` 校验 D8（见 `phase-5-coding.md:436`、`phase-6/7/8` 对应行）。

**后果不是"表不够精确"而是真实盲区**：`deriveViewSets` 以该表为闸门，故同一产物集在阶段 4 产生的 graph↔rtm 差异，到阶段 5 会因为 graph 视角压根不派生而静默无人对账。实测复现：

```
phase 4: views=graph,tla,rtm graph=["SD-001","SD-002"]   ← 差异可见
phase 5: views=tla,rtm       graph=null                  ← 差异被吞
```

已补两条回归测试锁定（`iceberg-logic.test.ts`）：一条断言 `graph` 在阶段 2-8 均在场，一条断言同产物集在阶段 4/5 派生出相同的 graph 集合。两条均在旧表下**实测失败**后才修：

```
× graph 在阶段 2-8 全部在场：… → AssertionError: expected [ 'tla', 'rtm', 'scope' ] to include 'graph'
× 同一产物集在阶段 4 与阶段 5 派生出相同的 graph 视角 → AssertionError: expected undefined to deeply equal [ 'SD-001', 'SD-002' ]
```

## 二、`RESOLUTION_FLOOR` — 保持 `1e-6`（并把计划中的 `1e-4` 判为错误）

计划先行取值 `1e-4`。**实测该值不可用**：在 28 个 verifier 样本、137 个含非全等 `rawScores`（≥3 点）的子标准中，**122 个（89%）**会被误报——真实合法方差下限约 `6.67e-5`，高于 `1e-4`。

| 取值   | 在 137 个合法子标准上误报 |
| ------ | ------------------------- |
| `1e-4`（计划） | **122 / 137（89%）** ❌   |
| `1e-6`（定稿） | **1 / 137** ✅（仅刻意负样本） |

定稿 `1e-6`，对合法样本留 ~2 个数量级余量（合法下限 `6.67e-5`，下限值 `1e-6`）。**R18 命中面实测**：28 个样本中仅 1 个命中——即刻意构造的负样本 `resolution-collapse-001`（方差 `6.7e-9`，低于下限约 150 倍）。

「全等」形态仍由既有全等检测负责，R18 对其返回 `[]`，**不重复报**（`resolution-exact-equal-001` 实测 `R18=[]` 且由既有规则命中）。

## 三、`REVIEW_LEVEL_SPREAD` — 保持 2 档

**零假阳性实测**：在 19 个 run-log 真实样本中，R9 仅命中 1 个——即刻意构造的负样本 `bad-review-level-drift.jsonl`（A→C，跨 2 档）。

「首次评审豁免」经专门测试覆盖（`同一产物仅一次 review → 不触发（首次评审豁免，无不一致可言）`）；A→B（1 档）不触发，避免把正常波动判为漂移。

## 四、不误报的横向证据

除逐项阈值外，两条新增判据在全量门禁下无副作用：`npm run prepush` 18 项全绿（含 vitest 1904 用例 + coverage 阈值 + self-test 332 条 + eval 60/60）。若任一阈值误报面过宽，既有样本会成片转红——未发生。

## 五、遗留与边界

- **三个常量均为代码常量**，后续若真实 8 阶段运行暴露误报/漏报，改动成本低；`RESOLUTION_FLOOR` 与 `RESOLUTION_MIN_POINTS` 已 `export`，便于校准。
- **R15d 未实现**（见破坏性验证记录），无对应阈值。
- **A-3f 校准集非门禁**：其"校准"需真实运行 LLM 且依赖人工标注正解，二次运行结果可能不同——这正是它不能当门禁的原因，也是本记录不把它算作阈值依据的原因。
