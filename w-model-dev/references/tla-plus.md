# TLA+ 层次化建模指南（TLA+ Guide）

> 本文件定义 TLA+ 层次化状态机建模的可执行细则：文件头规范、层级拆解、门禁脚本用法、阶段产出契约。
> S 子代理（产出 .tla + .cfg + 更新 manifest）、V 子代理（评审合规性）、G 子代理（跑 check-tla-model.ts）必读。
> 权威设计见 `docs/tla-plus-modeling-design.md`。

## 速查摘要

> 一页速查：TLA+ 层次化状态机建模细则。行为正确性门禁（第三维度），与结构连通（graph）、信息流（dataflow）正交。S/V/G 子代理必读。

| 维度 | 核心锚点 | 详见 |
|---|---|---|
| 公理 | 正常软件系统不允许死锁，必须定位根因修正而非绕过 | 「公理」节 |
| 命名规范 | MODULE 名 `L<level>_<system>`，禁止连字符/中文 | §2.0 |
| 路径基准 | manifest `basePath` 强制必填，jar/tla/cfg 均相对 basePath | §2.1 |
| 前置清单 | S 产出前 3 项 + G 校验前 3 项（先 SANY 后 TLC） | §2.2 |
| SD 覆盖率 | 每个 spec 须含 SD-xxx；每个 SD 须被覆盖 | §3 / §10 |
| 不变式对齐 | 每个不变式须 `@designRef` 标注 + 业务语义解释 | §4 |
| 层级模型 | L1 系统交互 / L2 子系统 / L3 原子 / L4 递归 | 「层级模型」节 |
| 拆解决策 | 组合数 ≤1k 保留 / >1w 必须拆（反模式 #16） | 「拆解决策」节 |
| 文件头规范 | 8 个 `@` 字段 + @designIds 必填 | 「文件头规范」节 |
| 校验脚本 | check-tla-model.ts（退出码 0/1/2，先 SANY 后 TLC） | 「校验脚本」节 |
| 阶段产出契约 | 阶段 1-4 产出对应层级；5-8 冻结只读 | 「阶段产出契约」节 |
| 合规性约束 | 不允许占位/简化/错误实现；建模须符合需求/设计 | 「合规性约束」节 |
| cfg 一致性 | .cfg INVARIANTS 与 BusinessInvariant 展开集合完全相等 | §11 / §12 |

**按场景只读 §X**：

| 场景 | 应读章节 |
|---|---|
| 产出 .tla 前（命名/文件头/前置清单） | §2.0 + §2.2 + 「文件头规范」节 |
| 填 manifest 路径 / 拆解决策 | §2.1 + 「拆解决策」节 + 「tla-manifest.json」节 |
| G 跑校验脚本 | 「校验脚本」节（步骤 1-9） |
| 建模参考（断路器/TCC/SAGA/State） | 「建模场景库」节 |
| 阶段 1-4 各阶段产出 | 「阶段产出契约」节 |
| 建模不符需求/设计时回退 | 「合规性约束」节 |
| L4 时间推进/保留期建模 | §14 |
| TLA+/BDD 同步校验 | §15 |
| 设计文档↔代码状态机一致性 | §16 |
| S-ingest-tla 回填覆盖率 | 「S-ingest-tla 子代理」节 |

## 公理

> **正常软件系统不允许死锁。任何死锁或矛盾分支必须定位根因并修正，而非绕过。**

TLA+ 门禁是 W 模型第三维度门禁——与结构连通门禁（graph）、信息流门禁（dataflow）正交：

| 维度 | 校验什么 | 脚本 |
|---|---|---|
| 结构连通 | 节点归属单根树、追溯完整 | `check-requirement-graph.ts` |
| 信息流闭合 | 节点既是生产者又是消费者 | `check-requirement-graph.ts` |
| **行为正确性** | **状态机无死锁、不变式成立、无状态爆炸** | **`check-tla-model.ts`** |

## 为什么需要模型检查穷举

> 吸收自《失控》第 11 章：汽车是连续系统（50/60/70mph 通过测试即可推断 55/67mph），但软件/分布式网络/活系统是**不连续系统**——「运行多年后在某组特定值（63.25mph）突然炸掉」，不可能测试每个案例，也不能依赖抽样外推。

- **LLM 评审是抽样性的**（不可靠）：按经验抽几个点评估，可能漏掉不连续边界。
- **确定性脚本对声明式规则是全量校验**：check-*.ts 逐条扫 schema/引用/状态，是「全量而非抽样」。
- **TLA+ TLC 对状态空间是穷举/模型检查**：这是 W 模型为何要 TLA+ 行为门禁的工程根据——不连续系统的正确性不能靠抽样测试外推。
- **BDD 离散覆盖**：BDD scenarios 覆盖离散行为场景（而非抽样），与 TLA+ 穷举互补（tla-bdd-sync 校验 BDD↔TLA+ 状态机等价）。

## 工具链

| 依赖 | 版本 | 位置 |
|---|---|---|
| Java runtime | ≥ 11 | 宿主环境预装（唯一外部依赖） |
| `tla2tools.jar` | TLC2 2.19 of 08 August 2024 | 技能内置 `w-model-dev/tools/tla2tools.jar` |

> jar 含 SANY（语法解析）+ TLC（模型检查）+ PlusCal（翻译器），单文件分发，无网络依赖。
> 版本号 2026-07-23 实测确认：`java -cp tla2tools.jar tlc2.TLC` 输出 `TLC2 Version 2.19 of 08 August 2024`。

## §2.0 命名规范

> TLA+ 标识符与 MODULE 名规则。违反 → `check-tla-model.ts` SANY 阶段退出码 11（语法错误）。

**标识符规则**：

- TLA+ 标识符须匹配 `[A-Za-z][A-Za-z0-9_]*`：以字母开头，仅含字母/数字/下划线。
- **禁止**连字符 `-`、中文、空格及其他特殊符号（TLA+ 词法不允许）。

**MODULE 名规则**：

- 格式：`L<level>_<system>[_<subsystem>]`，层级与系统名以下划线分隔。
- 合法示例：`L1_blog_system`、`L2_auth_subsystem`、`L3_token_store`。
- 文件名须与 MODULE 名完全一致（不含 `.tla` 后缀）：`L1_blog_system.tla` ↔ `---- MODULE L1_blog_system ----`。

**反例**（均非法，SANY 拒绝解析）：

| 反例 | 问题 |
|---|---|
| `L1-blog-system` | 含连字符 `-` |
| `1blog` | 数字开头 |
| `博客系统` | 含中文 |
| `L1.blog` | 含点号 `.` |

> 命名规范是 TLA+ 工具链可解析的硬约束，非风格建议。MODULE 名含连字符时 SANY 直接报 `Fatal errors while parsing`。

## §2.1 路径解析基准

> manifest 与 .tla 头部中所有相对路径的解析基准。路径解析错误 → `check-tla-model.ts` 报「文件不存在」或层次校验失败。

**强制字段 `basePath`**（P1.1）：

- `tla-manifest.json` 顶层 **必须** 含 `basePath: string` 字段；缺失 / 非字符串 / 空字符串 → `checkTlaModel` 返回 `passed=false`，violations 含 `"manifest.basePath 缺失（强制字段，相对 manifest 文件所在目录）"`。
- `basePath` 的值是相对 **manifest 文件所在目录** 的路径（如 `"."` 或 `".."`），由 CLI 解析为绝对基准目录 `baseAbs = path.resolve(manifestDir, basePath)`，再据此解析 `jarPath` / `tlaPath` / `cfgPath`，避免按 cwd 解析导致跨项目试错。
- 向后兼容：旧 manifest 无 `basePath` 时校验会报缺失（脚本不崩溃），CLI 缺省回退 `basePath = '.'`。

**三类路径基准**：

| 字段来源 | 字段 | 解析基准 |
|---|---|---|
| `tla-manifest.json` | `basePath` | 相对 **manifest 文件所在目录**（强制必填，P1.1） |
| `tla-manifest.json` | `tools.jarPath` | 相对 **basePath**（P1.1 起统一基准，不再按 cwd 解析） |
| `tla-manifest.json` | `specs[].tlaPath` / `specs[].cfgPath` | 相对 **basePath** |
| `.tla` 文件头 | `@parent` / `@sibling` / `@child` | 相对 **该 .tla 文件所在目录** |

**示例**（demo 项目布局）：

```
w-model-dev-demo/
├── .w-model/
│   └── tla-manifest.json        ← manifest 在此
└── tla/
    ├── L1_blog_system.tla        ← .tla 在此
    ├── L1_blog_system.cfg
    └── L2_auth_subsystem.tla
```

对应 manifest 字段填写（`basePath="."` 表示以 manifest 所在目录 `.w-model/` 为基准，需上跳一级到 `tla/`）：

```json
{
  "basePath": ".",
  "tools": { "jarPath": "../../w-model-dev/tools/tla2tools.jar" },
  "specs": [{
    "id": "L1_blog_system",
    "tlaPath": "../tla/L1_blog_system.tla",
    "cfgPath": "../tla/L1_blog_system.cfg"
  }]
}
```

- `basePath` 相对 manifest 目录（`.w-model/`），此处填 `"."` 表示基准即 `.w-model/`。
- `jarPath` 相对 basePath 基准（即 `.w-model/`），故填 `../../w-model-dev/tools/...` 上跳到仓库根再进入 `w-model-dev/tools/`。
- `tlaPath`/`cfgPath` 相对 basePath 基准（即 `.w-model/`），故用 `../tla/...` 上跳一级到 `tla/`。
- `L1_blog_system.tla` 头部 `@child tla/L2_auth_subsystem.tla` 相对该 .tla 所在 `tla/` 目录。

> 路径基准混淆是高频返工点（jarPath 误按 cwd 解析、tlaPath 误按 cwd 解析）。P1.1 起所有 manifest 路径统一以 `basePath` 为基准，填路径前先确认 `basePath` 已声明。

## §2.2 前置清单

> S 子代理产出 .tla 前、G 子代理跑校验前的强制检查项。漏检 → 高概率返工。

**S 子代理产出 .tla 前必做（3 项）**：

1. **MODULE 名合规**：符合 §2.0 命名规范（无连字符/中文/特殊符号），文件名与 MODULE 名一致。
2. **BusinessInvariant 聚合**：在 .tla 中定义 `BusinessInvariant == /\ TypeInvariant /\ <其他子不变式>`，聚合所有业务不变式。
3. **.cfg INVARIANTS 一致**：.cfg 的 `INVARIANTS` 列表与 `BusinessInvariant` 展开的子不变式集合完全相等（见 §11 cfg-tla 一致性规则）。

**G 子代理跑校验前必做（3 项）**：

1. **删除轨迹**：清除 `tla/states/` 目录及所有 `.st`/`.fp`/`.dump`/`.out` 残留文件（TLC 复用旧轨迹会误报或漏报）。
2. **确认路径基准**：按 §2.1 核对 manifest 中 `jarPath`/`tlaPath`/`cfgPath` 的解析基准正确。
3. **先 SANY 后 TLC**：先跑 `tla2sany.SANY` 语法检查，退出码 0 后才跑 `tlc2.TLC`；语法未过即跑 TLC 命中反模式 #14。

## §3 SD 覆盖率校验（全规格强制，无例外）

> 每个 spec（L1/L2/L3/L4 无例外）须满足：
> 1. `requirementIds` 非空数组
> 2. `requirementIds` 含至少一个 SD-xxx 标识（正则 `/^SD-/`）
>
> 每个 SD-xxx 须被至少一个 spec 的 requirementIds 包含（现有校验，不变）。
>
> 说明：L1 通常标注其对应的顶层 SD（如 SD-000 系统根），便于追溯；但非强制校验项。
>
> 违反 → `check-tla-model.ts` 退出码 1，violation 明确指出问题 spec。

## §4 不变式业务语义对齐（P2.6）

> 每个 TLA+ 不变式须有对应的设计文档章节引用与业务语义解释。

**要求**：
- 每个 `Invariant` 须在 .tla 文件注释中标注 `@designRef <doc>#<section>`
- V 评审须校验业务语义对齐（非仅语法/模型检查通过）

**示例**：

```tla
\* @designRef docs/phase2-design/blog-system-system-design.md:§3.3 分类树无环约束
CategoryTreeNoCycle == \A c \in Categories : categoryParent[c] # c /\ 
                        \A p \in Categories : categoryParent[p] # c \/ p = None
```

## 层级模型

| 层级 | 抽象内容 | 产出阶段 |
|---|---|---|
| L1 | 系统内外交互（EXT-IN ↔ System ↔ EXT-OUT） | 阶段 1 |
| L2 | 子系统内部行为 + 同级交互 | 阶段 2–3 |
| L3 | 原子化子系统行为 | 阶段 4 |
| L4+ | 递归拆解（下级视为独立系统） | 阶段 4（按需） |

### 拆解判定

> **先写 TLA+，分析变量组合数（取值域笛卡尔积）。组合数 >1k 考虑拆，>1w 必须拆。**

| 组合数 | 决策 | manifest 字段 |
|---|---|---|
| ≤ 1000 | 保留 | `decompositionDecision: "kept-below-threshold"` |
| 1001–10000 | 考虑拆（须在规格「拆解决策」节声明理由） | `"consider-split"` |
| > 10000 | **必须拆**（不拆即反模式 #16） | `"must-split"` → 拆完后改 `"split-done"` |

## 建模场景库

以下场景为 TLA+ 状态机建模的成熟参考模式（可作阶段 1-4 建模起点）：

| 场景 | 状态集 | 转移 | 不变式要点 |
|---|---|---|---|
| 断路器（凤凰 failure.md） | CLOSED / OPEN / HALF OPEN | CLOSED→OPEN（请求数+故障率双阈值）；OPEN→HALF OPEN（超时探测）；HALF OPEN→CLOSED（探测成功）/→OPEN（探测失败） | 双阈值触发条件；HALF OPEN 探测放行不违反不变式 |
| TCC 事务（凤凰 distributed.md） | INIT / TRYING / CONFIRMING / CANCELLING / DONE | TRY 冻结资源；Confirm/Cancel 二选一 | 幂等：Confirm/Cancel 重复执行收敛；冻结资源不可双重使用 |
| SAGA（凤凰 distributed.md） | RUNNING / FAILED / COMPENSATING / DONE | 正向 Ti 失败 → 反向 Ci 补偿；区分正向恢复（重试 Ti）与反向恢复（执行 Ci） | 补偿操作满足交换律；补偿后到达终态 |
| State 模式（GoF） | 各状态对象 | 事件驱动状态切换 | 每个状态的事件处理完备（无未处理事件死锁） |

> Safety vs Liveness（凤凰架构 consensus 术语）：不变式 = Safety（坏事永不发生）；收敛/最终一致 = Liveness 弱化形式（好事终将发生）。TLA+ 中不变式断言对应 Safety，模型检查的"可达性/活性"对应 Liveness。

## 文件头规范（强制）

每个 `.tla` 文件**必须**以结构化注释头开始。缺失任一字段，`check-tla-model.ts` 退出码 1（反模式 #16）。

```tla
(*
  @system        所属系统名称
  @requirement   关联需求 ID（逗号分隔）
  @design        关联设计文档相对路径
  @designIds     关联 SD 节点 ID（逗号分隔，如 SD-001,SD-002,SD-005）
  @parent        上级 TLA 文件相对路径（L1 填 null）
  @sibling       同级 TLA 文件相对路径（逗号分隔，无填 null）
  @child         下级 TLA 文件相对路径（逗号分隔，无填 null）
  @level         层级（L1 / L2 / L3 / L4 ...）
  @phase         产出阶段（1-8）
*)
---- MODULE ModuleName ----
(* 规格正文 *)
================
```

### 字段约束

- `@parent`/`@sibling`/`@child` 路径相对该 `.tla` 文件；`check-tla-model.ts` 校验目标文件存在且 `@system` 一致。
- L1 规格 `@parent=null`；叶子规格 `@child=null`。
- **双向一致性**：A 声明 B 为 sibling → B 须声明 A 为 sibling；A 声明 C 为 child → C 须声明 A 为 parent。
- 层级单调：`child.level = parent.level + 1`。

### @designIds 字段（必填）

`.tla` 文件头部须含 `@designIds` 字段，列出本规格覆盖的所有 SD 节点 ID（逗号分隔）。

```
@designIds     SD-001,SD-002,SD-005
```

S-ingest-tla 子代理据此字段与 graph.json 比对后回填 manifest sdCoverage。

## tla-manifest.json

行为层事实源。S 子代理产出 .tla 后同步更新此文件；G 子代理跑 `check-tla-model.ts` 校验。

```json
{
  "version": 1,
  "project": "<project-id>",
  "currentPhase": 1,
  "tools": { "jarPath": "w-model-dev/tools/tla2tools.jar", "javaMinVersion": 11 },
  "specs": [{
    "id": "L1_blog_system",
    "level": "L1",
    "phase": 1,
    "system": "blog-system",
    "requirementIds": ["REQ-001"],
    "designRef": "docs/phase1-requirements/requirement-spec.md:§3",
    "tlaPath": "tla/L1_blog_system.tla",
    "cfgPath": "tla/L1_blog_system.cfg",
    "parent": null,
    "siblings": [],
    "children": ["tla/L2_auth.tla"],
    "variableCombination": 240,
    "decompositionDecision": "kept-below-threshold",
    "syntaxChecked": true,
    "tlcChecked": true,
    "deadlockFree": true,
    "invariantsHold": true,
    "stateExplosion": false
  }],
  "checkRounds": []
}
```

> `tla-manifest.json`（行为层）与 `graph.json`（结构层）、`rtm.json`（追溯层）并存，各自独立校验，互不替代。

### checkRounds 字段语义

> `checkRounds` 数组记录每次 TLA+ 校验轮次的结果，用于追踪返工收敛趋势。语义权威定义见本节，[data-models.md](data-models.md) `tla-manifest.json` 节字段表指向本节。
>
> **spec 级返工记录**：每条 checkRounds 元素对应一次 spec 的 TLA+ 校验轮次（`specId` 标识），**不是 phase 级摘要**。phase 级摘要应写在 `run-log.jsonl` 的 `note` 字段，phase 级决策列表应写在 `acknowledgedDecisions` 字段。误把 phase 级摘要（含 `phaseSummary` / `summary` / `phaseDecisions` 字段）写入 checkRounds 由 R13 校验强制拦截。

**记录时机**：每轮 TLA+ 校验（SANY + TLC）完成后，由 G 子代理向 `checkRounds` 数组追加一条记录。

**单条记录字段**：

| 字段 | 类型 | 说明 |
|---|---|---|
| `phase` | number | 校验时所处阶段（1-8） |
| `round` | number | 本阶段内校验轮次序号（从 1 起） |
| `timestamp` | string | ISO 8601 时间戳 |
| `specId` | string | 校验的 spec id（如 `L1_blog_system`） |
| `syntaxCheck` | boolean | SANY 语法检查是否通过 |
| `tlcCheck` | boolean | TLC 模型检查是否通过 |
| `violations` | string[] | 本轮违反详情列表（死锁 + 不变式违反 + 状态爆炸等合计，每条为具体违反描述，与 [tla-logic.ts](../scripts/logic/tla-logic.ts) 类型定义一致） |
| `converged` | boolean | 本轮是否零违反收敛（`violations.length === 0`） |

**单调递减规则**：同一 `specId` 跨轮 `violations.length` 应单调递减（每轮返工修复一部分违反）。若某轮 `violations.length` 不降反升 → 视为返工失败，编排者分派 S 子代理返工时须在 prompt 中明确「违反数上升」信号。

**与 run-log R3 交叉校验**：`checkRounds` 数组长度须与 `run-log.jsonl` 中该 spec 对应的 `action=tla-gate` 且 `outcome=rework` 记录数一致（`check-run-log.ts` R3 规则强制校验）。不一致 → `check-run-log.ts` 报 R3 违反。

**空值约定**：项目首次产出 TLA+ 规格前（未跑过任何校验轮次），`checkRounds` 填 `[]`。零返工一次性通过的项目，`checkRounds` 仅含一条 `converged=true` 记录。

### 禁止字段（phase 级摘要）

> checkRounds 元素为 **spec 级返工记录**，不得含 phase 级摘要字段（R13 校验强制拦截）。违反 → `check-tla-model.ts` 退出码 1。

| 禁止字段 | 说明 | 应写入位置 |
|---|---|---|
| `phaseSummary` | phase 级摘要（如"本阶段所有 spec 一次性通过"） | `run-log.jsonl` 的 `note` 字段 |
| `summary` | phase 级摘要（同上，无前缀简写） | `run-log.jsonl` 的 `note` 字段 |
| `phaseDecisions` | phase 级决策列表 | `run-log.jsonl` 的 `acknowledgedDecisions` 字段 |
| `phaseLevelSummary` | phase 级总结 | `run-log.jsonl` 的 `note` 字段 |

R13 校验由 [`tla-logic.ts`](../scripts/logic/tla-logic.ts) `checkRoundsSchema` 函数执行，命中禁止字段 → 报 `R13: checkRounds[i] 含禁止字段 <字段名>（phase 级摘要字段，checkRounds 为 spec 级返工记录）`。

## 校验脚本

```bash
npx tsx w-model-dev/scripts/cli/check-tla-model.ts <tla-manifest.json> [--phase=1|2|3|4|5|6|7|8] [--spec=<id>] [--graph=<graph.json>（phase>=2 强制）] [--keep-states]
```

退出码 `0=通过 / 1=失败 / 2=输入错误`。stdout 末尾输出 `TLA_JSON {...}` 供 Agent 解析。

所有 TLA+ specs（L1/L2/L3/L4+）均须通过 SANY 语法检查 + TLC 模型检查
- 不得使用 `--skip-tlc` 跳过 TLC（参数已移除）
- 若 TLC 因状态爆炸无法完成，须走规格拆解（而非 skip）
- 拆解决策须记录在 `tla-manifest.json` 的 `splitDecision` 字段

### 参数

| 参数 | 说明 |
|---|---|
| `--phase=N` | 只校验 `phase ≤ N` 的规格 |
| `--spec=<id>` | 只校验单个规格（调试用） |
| `--graph=<graph.json>` | 提供结构层图谱，提取 `type=SD` 节点供 SD 覆盖率校验（见 §10）；**phase>=2 时强制必填，缺失 → exitCode=2 ARG_INVALID** |
| `--keep-states` / `-k` | 保留 TLC `states/` 目录用于调试（默认校验后自动清理） |

### 校验步骤（G 子代理执行）

1. **环境检查**：Java ≥ 11、jar 存在。
2. **文件头校验**：8 个 `@` 字段齐全且与 manifest 一致。
3. **层次一致性**：parent/child/sibling 双向、单 L1 根、层级单调。
4. **拆解决策**：组合数 >1w 必须 `split-done`。
5. **清理轨迹**：删除 `*.dump` / `*.out` / `states/`（硬约束，先清后跑；批次 1 安全加固双守卫：仅当目录含 `.tla` 文件才执行清理，且 `states/` 须含 TLC 产物特征——时间戳子目录或 `.st`/`.fp`/`.dump`/`.out` 文件——才删除，防误删同名业务目录）。
   - 实测 TLC 2.19 产物：`states/<YY-MM-DD-HH-MM-SS>/` 子目录下含 `<Module>.st` / `<Module>-0.st`（状态文件）+ `<Module>_0.fp` / `<Module>_1.fp`（指纹文件）。默认不产生 `.dump` / `.out`，但保留清理作为预防。
6. **SANY 语法检查**（cwd 置为 `.tla` 所在目录）：
   ```
   java -cp <jarPath> tla2sany.SANY <module>.tla
   ```
   实测退出码：**0=成功 / 11=语法错误**；输出走 stdout（含 `Fatal errors while parsing` 等错误消息）。
7. **TLC 模型检查**（仅 SANY 通过时；cwd 置为 `.tla` 所在目录）：
   ```
   java -cp <jarPath> tlc2.TLC -nowarning -cleanup -config <spec>.cfg <moduleName>
   ```
   - `-nowarning`：抑制 GC 建议警告（输出更干净，实测有效）。
   - `-cleanup`：运行前自动清理 `states/` 目录（与步骤 5 互补，双保险）。
   - 实测退出码：**0=成功 / 11=死锁 / 12=不变式违反**（其他=内存或配置错误）。
   - 实测输出模式（2026-07-23 tla2tools.jar TLC2 2.19 确认）：
     | 结果 | 输出特征 |
     |---|---|
     | 成功 | `Model checking completed. No error has been found.` |
     | 死锁 | `Error: Deadlock reached.` |
     | 不变式违反 | `Error: Invariant <Inv> is violated.` |
     | 状态爆炸 | `out of memory` / `states ... exceeds ... exceeded` / `too many` |
8. **汇总**：零违反才 `passed=true`。
9. **states 自动清理**：见下方「TLA+ states 目录自动清理」节。

> **编码调试顺序（硬约束）**：先清轨迹 → SANY 语法通过 → 才允许跑 TLC。违反命中反模式 #14。
> **.cfg 模式选择**：`SPECIFICATION Spec` 使用 `[Next]_vars` 带 stuttering，可避免终态被误报为死锁；`INIT Init` + `NEXT Next` 不带 stuttering，终态会触发死锁。建模时通常用 `SPECIFICATION Spec`，仅在刻意要检测终态死锁时才用 `INIT/NEXT`。

### TLA+ states 目录自动清理

> TLA+ 校验完成后必须清理 `<tla-dir>/states/` 目录，避免状态文件残留污染仓库（脚本默认行为，硬约束）。

**`check-tla-model.ts` 行为**：

- **默认清理**：TLC 校验完成后自动清理所有已校验 spec 的 `states/` 子目录（每个 spec 独立清理）
  - 实现细节：脚本遍历 `manifest.specs[]`，对每个 spec 解析 `tlaPath` 所在目录，删除其下 `states/` 目录（含全部 `<YY-MM-DD-HH-MM-SS>/` 时间戳子目录及 `.st` / `.fp` 文件）；批次 1 安全加固双守卫——目录无 `.tla` 文件不清理、`states/` 无 TLC 产物特征（时间戳子目录或 `.st`/`.fp`/`.dump`/`.out`）跳过不删
  - 日志输出：`✓ P3.8 已清理 TLA+ states 目录（<N> 个 spec 目录）`
- **`--keep-states` / `-k` 参数**：调试场景下保留 `states/` 用于排查
  - 日志输出：`⚠ --keep-states 已启用，未清理 states 目录（调试模式）`
  - 适用场景：TLC 报死锁 / 不变式违反时，开发者需要检查 `states/` 中的反例轨迹文件定位具体状态转移
- **与步骤 5 的关系**：步骤 5 是「校验前清理」（避免旧轨迹干扰本轮 TLC），P3.8 是「校验后清理」（避免本轮产物残留）。两者互补，共同保证仓库洁净。

**手动清理脚本**（适用于历史残留清理或 CI 流水线）：

```bash
# 项目根目录运行，清理 w-model-dev-demo/tla/states/ 残留
npm run clean:tla-states
```

对应 `package.json` scripts：

```json
{
  "scripts": {
    "clean:tla-states": "node -e \"require('fs').rmSync('w-model-dev-demo/tla/states', {recursive: true, force: true})\""
  }
}
```

> 项目可将上述 script 加入 `package.json`，或直接使用 `Remove-Item -Recurse -Force w-model-dev-demo/tla/states`（PowerShell）/ `rm -rf w-model-dev-demo/tla/states`（bash）等价命令。

**校验**：

- `check-tla-model.ts` 默认运行（无 `--keep-states`）后，`<tla-dir>/states/` 目录应不存在或为空
- `--keep-states` 运行后，`<tla-dir>/states/` 目录应保留，含 TLC 产物

> 与 `.gitignore` 的配合：项目应在 `.gitignore` 中排除 `tla/states/` 目录，避免 TLC 产物误提交；`tla/states/` 排除规则由项目自行维护（不同项目 `<tla-dir>` 路径不同，技能包不强制约定）。

## 阶段产出契约

### 阶段 1（需求分析）

- **产出**：L1 系统内外交互状态机（`.tla` + `.cfg`）。
- **建模内容**：EXT-IN → System → EXT-OUT 的端到端状态转移；系统级不变式。
- **门禁**：`check-tla-model.ts --phase=1` 通过（L1 语法 + TLC）。
- **更新**：`tla-manifest.json` 初始化 + L1 spec。

### 阶段 2（系统设计）

- **产出**：L1 细化 + L2 子系统拆解。
- **建模内容**：子系统内部状态转移 + 兄弟子系统间协作。
- **门禁**：`--phase=2`：L1+L2 通过，L2 拆解决策合规。
- **更新**：manifest 追加 L2 specs。

### 阶段 3（概要设计）

- **产出**：L2 细化 + L3 原子行为。
- **门禁**：`--phase=3`：L1+L2+L3 通过。

### 阶段 4（详细设计）—— 硬约束

- **产出**：L3+ 按需 L4；变量组合分析。
- **门禁**：`--phase=4`：**全层级零违反**（无死锁 / 无不变式违反 / 无状态爆炸 / 拆解决策合规）+ 图谱零违反，才放行进编码。
- **拆解**：组合数 >1w 必须 `split-done`，否则反模式 #16。

### 阶段 5–8（TLA+ 冻结为只读）

manifest 冻结，TLA+ 不变量作为**测试 oracle**：

| 阶段 | TLA+ 角色 |
|---|---|
| 5 编码 | 不变量作为代码断言依据；单测覆盖每个不变式 |
| 6 集成测试 | 用例覆盖 L2 子系统间交互状态转移 |
| 7 系统测试 | 用例覆盖 L1 端到端状态机路径 |
| 8 验收测试 | 用例覆盖 L1 状态机所有终态 |

## 合规性约束

### 不允许的实现（反模式 #16）

| 类型 | 表现 |
|---|---|
| 占位实现 | `\* TODO` 未实现分支；`Next = []` 空下一步 |
| 简化实现 | 刻意减变量以降组合数而遗漏需求关键状态 |
| 错误实现 | 不变式与需求/设计矛盾；状态转移与设计文档不符 |

### 建模与需求/设计一致性（反模式 #17）

TLA+ 建模必须符合需求和设计。TLC 发现违反时：

```
规格是否忠实于需求/设计？
  ├─ 是 → 需求/设计本身有缺陷 → 回退修正需求/设计 → 重写 TLA+ → 重跑
  └─ 否 → 规格缺陷 → 修正 TLA+ → 重跑（不回退上游）
```

> **TLA+ 建模必须符合需求和设计，对于符合需求和设计仍然有问题的需要修正需求或对应级别设计并回退重跑。**

## 与其他门禁的关系

```
阶段 N（1-4）:
  ingestion 子流程（图谱校验）  ──┐
  S 产出设计文档 + TLA+ 规格 + BDD features ──┤
  V 评审                        ──┤
  G 跑 check-verifier-output.ts  ──┤
  G 跑 check-requirement-graph.ts ─┤  （静态结构）
  G 跑 check-tla-model.ts       ──┤  （动态行为 - TLA+）
  G 跑 check-bdd-model.ts       ──┘  （动态行为 - BDD + BDD↔TLA+ 等价性；项目门传 --require-tla-equivalence）
  CHECKPOINT 阶段门放行
```

图谱门禁管静态结构（节点/边/连通/信息流），TLA+ 门禁管动态行为（状态机/不变式/死锁），BDD 门禁管可执行规格（features/状态机七要素/BDD↔TLA+ 等价性）。三者正交：一个规格可结构完整却仍有死锁，或 TLA+ 通过但 BDD features 与 TLA+ 状态机不等价。BDD↔TLA+ 等价性校验（`check-bdd-model.ts` D4 维度）确保 BDD 状态机的 states/initialState/transitions/invariants 与同层 TLA+ spec 的 State/Init/Next/Invariants 一一对应。项目阶段门在 phase 1-4 必须传 `--require-tla-equivalence --tla-manifest=<path>`；缺证据产生 exit 1 violation，错误 phase 组合为 exit 2。该项目工件门不同于本地 pre-push 的技能包 fixture 回归，后者不直接运行 TLA/TLA↔BDD 项目工件门。

## 10. SD 覆盖率规则

> 每个 SD（子系统设计）节点须被至少一个 TLA+ spec 覆盖；存在未覆盖 SD → violation，exitCode=1。本规则由 SSoT §10.8「追加行为门禁校验项」定义，`check-tla-model.ts` 强制执行。

**覆盖判定**（满足任一即视为该 SD 被覆盖）：

| 判定路径 | 说明 |
|---|---|
| `spec.requirementIds` 命中 | spec 的 `requirementIds` 含该 SD 关联的 REQ ID |
| `spec.designRef` 命中 | spec 的 `designRef` 引用该 SD 对应的设计文档（路径/锚点匹配） |

> 该 SD 关联的 REQ = graph 系统层级树中 SD 的 parent REQ 节点（SSoT §10.10.1）。本表为操作化口径，SSoT §10.8 为权威定义。

**算法**：
1. 从 `--graph=<graph.json>` 提供的 `graph.json` 中提取所有 `type=SD` 节点，得到 SD 集合。
2. 遍历 `tla-manifest.json.specs[]`，按上表两条路径累计已覆盖 SD。
3. 未被任何 spec 覆盖的 SD → `sdCoverageViolation`，列入 `violations`（「以下 SD 节点未被任何 TLA+ spec 覆盖: <SD 列表>」）。

**CLI 入参**：

```bash
npx tsx w-model-dev/scripts/cli/check-tla-model.ts <tla-manifest.json> --graph=<graph.json> [--phase=N] [--spec=<id>]
```

- `--graph=<graph.json>`：提供结构层图谱，提取 SD 节点供覆盖率校验。**phase>=2 时强制必填，缺失 → exitCode=2 ARG_INVALID**。
- 覆盖率违反 → exitCode=1。

> 覆盖率校验与结构层图谱门禁（`check-requirement-graph.ts`）正交：图谱门禁管 SD 是否在层级树中正确依附，本规则管 SD 是否有行为规格。两者均须通过。缺陷对照：D10（11 个子系统但仅 3 个 spec）即本规则检出。

## 11. cfg-tla 一致性规则

> 每个 `.cfg` 的 `INVARIANTS` 列表须与对应 `.tla` 中 `BusinessInvariant` 展开的子不变式集合一致；缺失或多余 → violation，exitCode=1。本规则由 SSoT §10.8 定义，`check-tla-model.ts` 强制执行。

**一致性判定**（集合比较，非逐行匹配）：

- `.tla` 中定义 `BusinessInvariant == /\ Inv1 /\ Inv2 /\ Inv3` → 展开集合 `{Inv1, Inv2, Inv3}`。
- `.cfg` 的 `INVARIANTS`（或多个 `INVARIANT` 行）声明的不变式名集合须与上述集合**完全相等**。
- 比较容忍注释与空白差异（解析时剥离 `\*` 注释与多余空白后再做集合比较）。

**违反情形**：

| 情形 | 集合关系 | 信号 | 危害 |
|---|---|---|---|
| `.cfg` 缺失不变式 | `.cfg` ⊊ `.tla` | `cfgTlaMismatch` | 漏校验关键不变式（如 D25：L1.cfg 缺 INV4/INV7） |
| `.cfg` 多余不变式 | `.cfg` ⊋ `.tla` | `cfgTlaMismatch` | 引用不存在的不变式，TLC 报错或误导 |

任一情形 → exitCode=1。

> 示例：`.tla` 定义 `BusinessInvariant == /\ NoExitTerminal /\ ArtifactGateConsistency`，则 `.cfg` 须列全 `NoExitTerminal` 与 `ArtifactGateConsistency`，缺任一即违反。

## 12. cfg 结构规则

> `.cfg` 文件须符合 TLC 配置语法；结构违反 → violation，exitCode=1。本规则由 SSoT §10.8 定义，`check-tla-model.ts` 强制执行。

**结构约束**：

| 约束 | 规则 | 违反信号 |
|---|---|---|
| 禁止 MODULE 声明 | `.cfg` 不得含 `---- MODULE <Name> ----`（这是 `.tla` 头部语法，混入 `.cfg` 触发 TLC 解析错误，如 D26） | `cfgStructureViolation` |
| INVARIANT 行格式 | `INVARIANT <InvariantName>`（单行单不变式）或 `INVARIANTS` 关键字后跟不变式名列表 | `cfgStructureViolation` |
| 不变式数量计数 | 解析 `.cfg` 得到的不变式数量供跨产物交叉校验 | 计数不一致 → `cfgTlaMismatch` |

**合法 `.cfg` 片段示例**（`INVARIANTS` 关键字后跟列表）：

```cfg
SPECIFICATION Spec
INVARIANTS
  NoExitTerminal
  ArtifactGateConsistency
```

等价的逐行形式：

```cfg
SPECIFICATION Spec
INVARIANT NoExitTerminal
INVARIANT ArtifactGateConsistency
```

> 不变式数量计数是跨产物交叉校验的枢纽：`.cfg` 声明数 = `.tla` `BusinessInvariant` 展开数 = verifier-output 不变式描述数，三者一致才放行（治 D27 三处不一致）。

## 13. 参考资料（claude-tla-plus-plugin）

> 吸收 `claude-tla-plus-plugin` 的 4 份 skill 资料与 review 命令语义。

### 13.1 参考资料索引

| # | 文件 | 用途 | 加载时机 |
|---|---|---|---|
| 1 | [语法速查](#语法速查) | TLA+ 完整语法 | S-tla 必读 |
| 2 | [模式与示例](#模式与示例) | 8 个典型示例 | S-tla 按场景 |
| 3 | [TLC 配置](#tlc-配置) | TLC .cfg 配置指南 | S-tla 产 .cfg 时必读 |
| 4 | [评审清单](#评审清单) | V-tla 审查 7 项清单 | V-tla 必读 |

### 13.2 S-tla/V-tla 加载矩阵

遵循约束 #6「按需加载」——只加载当前阶段所需文件，禁止一次加载全部。

| 角色/阶段 | 必读 | 按场景 |
|---|---|---|
| S-tla 阶段 1（L1） | syntax-reference | patterns §KV |
| S-tla 阶段 2-3（L2/L3） | syntax-reference | patterns §Bakery/Producer-Consumer + tlc-configuration |
| S-tla 阶段 4（L3/L4） | syntax-reference | patterns §Consensus/Two-Phase Commit + tlc-configuration |
| V-tla 全阶段 | review-checklist | syntax-reference |

### 13.3 与现有约束的关系

- 4 份参考文件是**参考资料**，不是新约束
- S-tla 子代理参考示例时仍须遵循 §2.0 命名规范、§文件头规范、§3 SD 覆盖率规则
- V-tla 子代理审查时仍用 `targetKind=design`（不新增 targetKind 枚举值）
- 现有反模式 #15-17（TLA+ 占位/简化/错误实现、建模不符合需求设计）仍为合规边界

## 14. L4 时间推进/保留期建模模式

> S-tla 子代理在 L4 层级建模涉及"时间推进/保留期/过期清理"场景时的模式指引。`AdvanceTime` 越界（`oldestAge` 推至 `RETENTION_DAYS+1` 违反 `Retention90Days` 不变式）是典型缺陷，本节提供正反例与通用规则，降低 S-tla 子代理对 TLC 试错的依赖。

### 14.1 模式概述

时间推进动作（`AdvanceTime`/`Tick`）+ 保留期不变式（`Retention`/`Expiry`）是 L4 状态机常见模式：系统按时间推进，过期数据按保留期清理。

典型场景：
- 审计日志保留 N 天后清理
- Token 过期清理（`L4_auth_token_lifecycle`）
- 密码重置 Token 生命周期（`L4_password_reset_token_lifecycle`）
- 限流器令牌桶补充（`L4_rate_limiter_token_bucket`）

### 14.2 反例

**错误实现**：

```tla
AdvanceTime ==
  oldestAge' = oldestAge + 1

Retention90Days == oldestAge <= RETENTION_DAYS
```

**TLC 报错**：`Invariant Retention90Days is violated.`

**问题分析**：
- `AdvanceTime` 无前置条件，`oldestAge` 可无限推进至 `RETENTION_DAYS+1`、`RETENTION_DAYS+2`...
- 不变式 `Retention90Days` 要求 `oldestAge <= RETENTION_DAYS`，但 `AdvanceTime` 无上限守卫
- 即使有 `PurgeExpiredLogs` 动作，若 `Next` 分支允许连续 `AdvanceTime` 不触发清理，不变式必然违反

### 14.3 正例

```tla
AdvanceTime ==
  /\ logCount > 0                    \* 前置条件 1：无日志时不推进（避免无意义推进）
  /\ oldestAge < RETENTION_DAYS      \* 前置条件 2：上限守卫（不超过保留期）
  /\ oldestAge' = oldestAge + 1
  /\ logCount' = logCount
  /\ unchanged otherVars

PurgeExpiredLogs ==
  /\ oldestAge >= RETENTION_DAYS     \* 触发阈值：达到保留期才清理
  /\ logCount' = logCount - expiredCount
  /\ oldestAge' = oldestAge
  /\ unchanged otherVars

Next == \/ AdvanceTime
        \/ PurgeExpiredLogs
        \/ OtherActions

Retention90Days == oldestAge <= RETENTION_DAYS
```

**关键设计**：
1. `AdvanceTime` 前置条件 `logCount > 0`：无日志时不需要推进时间（避免空集合上的无意义动作）
2. `AdvanceTime` 上限守卫 `oldestAge < RETENTION_DAYS`：确保推进后 `oldestAge' <= RETENTION_DAYS`，不变式保持
3. `PurgeExpiredLogs` 触发阈值 `oldestAge >= RETENTION_DAYS`：与不变式边界对齐（`>=` 触发清理，`<=` 不变式守卫）
4. `Next` 分支覆盖：`AdvanceTime` 与 `PurgeExpiredLogs` 均可达，清理动作不会被饿死

### 14.4 通用规则

1. **时间推进动作必须有前置条件**：
   - 非空集合守卫（如 `logCount > 0`）：避免空集合上的无意义推进
   - 上限约束（如 `oldestAge < RETENTION_DAYS`）：防止越界违反不变式

2. **保留期不变式与清理动作触发阈值一致**：
   - 不变式：`oldestAge <= RETENTION_DAYS`（`<=` 守卫）
   - 触发阈值：`oldestAge >= RETENTION_DAYS`（`>=` 触发清理）
   - 两者边界对齐：`RETENTION_DAYS` 是不变式上界，也是清理触发点

3. **清理动作与时间推进动作分离**：
   - 不要在 `AdvanceTime` 中同时清理（违反单一职责）
   - `PurgeExpiredLogs` 独立动作，由 `Next` 分支调度

4. **Next 分支覆盖**：
   - `Next == \/ AdvanceTime \/ PurgeExpiredLogs \/ ...`
   - 确保清理动作可达（不被 `AdvanceTime` 饿死）
   - `check-tla-model.ts` 维度 3（Next 分支对应）会校验覆盖

5. **与 §4 不变式业务语义对齐的关系**：
   - §4 是 V-tla 评审项（不变式业务语义校验）
   - §14 是 S-tla 产出参考（建模模式指引）
   - 两者互补：S-tla 按 §14 建模，V-tla 按 §4 评审

## 15. TLA+/BDD 自动化同步校验

> TLA+ 与 BDD 等价性维护成本高，手动比对易遗漏。新增 `check-tla-bdd-sync.ts` 脚本自动化 diff 比对。

### 校验内容

从 TLA+ 文件抽取：
- 转移名（`Next == \/ Act1 \/ Act2`）
- 状态名（`vars` 声明）
- 不变式名（`Inv == ...`）

从 BDD feature 文件 Background 节抽取状态机七要素，diff 比对两者差异。

### 脚本调用

```bash
npx tsx w-model-dev/scripts/cli/check-tla-bdd-sync.ts <tla-file> <feature-file>
```

退出码：0=一致 / 1=有差异 / 2=输入错误

### 与 check-bdd-model.ts D4 及项目阶段门的关系

`check-bdd-model.ts` 的 D4 是 BDD 门禁内的 required equivalence 维度；项目阶段 1–4 必须传 `--require-tla-equivalence --tla-manifest=<path>`，缺少或畸形证据由 D4 fail-closed。独立 `check-tla-bdd-sync.ts` 是另一条按文件 pair 执行的同步证据，不被 D4 替代。

项目 Artifact Gate 的独立 pair sync 契约（SSoT §10.5.1）明确为：phase 1–4 且 TLA manifest 与 BDD manifest 均通过真实 schema/资产校验、TLA spec 与 BDD feature 配对集合满足双向完整覆盖时，逐 pair 必须执行本脚本；任一资产缺失/畸形由各自 evidence gate 阻断，不得作为 sync skip。实现以 `isTlaBddSyncContractPhase` 和 `syncRequired` 表达阶段契约，以 `pairCoverageValid` 表达双向配对前置条件。phase 5–8 不执行 TLA↔BDD 文件同步，使用 required Cucumber 执行证据。单独开发调试时仍可直接运行本脚本；该可选工具边界不适用于项目阶段门。

## 16. 设计文档 ↔ 代码状态机一致性

> 现有脚本校验"代码↔TLA+"，本节补充"设计文档↔代码"维度。

### 校验范围

`check-state-machine-consistency.ts` 校验 `docs/phase4-design/detailed-design.md` 中的状态转移表（Markdown 表格格式 `| 状态 | 事件 | 转移 |`）与 `src/state-machines/*.ts` 中的 `TRANSITIONS` 定义的一致性：

1. **状态集一致**：设计文档声明的状态集须与代码 `TRANSITIONS` 派生的状态集一致
2. **转移集一致**：设计文档声明的转移（from→to+event）须与代码 `TRANSITIONS` 完全匹配

### 校验输入格式

`check-state-machine-consistency.ts` 接受 JSON 输入（由编排者或 G 子代理从设计文档与代码中解析后构造）：

```json
{
  "designStates": ["draft", "published", "archived"],
  "codeStates": ["draft", "published", "archived"],
  "designTransitions": [
    {"from": "draft", "to": "published", "event": "publish"}
  ],
  "codeTransitions": [
    {"from": "draft", "to": "published", "event": "publish"}
  ]
}
```

### 豁免条件

- **无状态机的项目跳过**：若项目 `detailed-design.md` 无 `| 状态 | 事件 | 转移 |` 表格格式的章节，则跳过本校验（不视为违反）。
- **TLA+ 已覆盖的项目**：若项目已有 TLA+ 状态机规格且 `check-tla-model.ts` 通过，则 `check-state-machine-consistency.ts` 作为补充校验（不替代 TLA+）。

### 误报处理

- 若设计文档使用非标准表格格式（如 `| from | to | event |` 而非 `| 状态 | 事件 | 转移 |`），解析器可能漏识别 → 须人工确认表格格式后重跑。
- 若代码 `TRANSITIONS` 定义分散在多个文件，须在 input.json 中合并所有文件的转移定义。
- 误报时在 `reworkHints` 中标注"state-machine 误报"，由 V 评审确认后豁免。

### 校验命令

```bash
npx tsx w-model-dev/scripts/cli/check-state-machine-consistency.ts <input.json>
```

退出码：0=一致，1=不一致，2=输入错误。

## S-ingest-tla 子代理

TLA+ 覆盖率数据由独立的 S-ingest-tla 子代理回填，非 S-tla 自填。

分派时序：
1. S-tla 产出 .tla/.cfg/manifest 基础字段 + @designIds 头部
2. S-ingest-tla 从 .tla 提取 @designIds + 比对 graph.json SD 节点 → 回填 manifest sdCoverage
3. R3 → V → G(check-tla-model --graph 校验)



## 语法速查


> **来源**：本文件内容主体复制自 `andrueandersoncs/claude-tla-plus-plugin` 仓库的 `skills/tla-plus-generator/syntax-reference.md`。
> **W 模型约束**：模块名须为 PascalCase（如 `KeyValueStore`），禁止连字符；命名规范遵循 [tla-plus.md](tla-plus.md) §2.0。所有 ```tla 代码块原样保留来源内容，仅作语法速查用途。
> **加载时机**：S-tla 子代理产出 TLA+ 规格时必读；V 子代理评审语法合规性、G 子代理排查 SANY 语法错误（退出码 11）时参考。

### Module Structure
```tla
---- MODULE ModuleName ----
(* Multi-line comments use (* *) *)
\* Single-line comments start with \*
EXTENDS Module1, Module2   \* Import standard modules
CONSTANTS Const1, Const2   \* Declare constants
VARIABLES var1, var2       \* Declare variables
ASSUME Const1 \in Nat      \* Assumptions about constants
\* Definitions and operators
====
```

> **W 模型适配说明**：在 W 模型工程中，MODULE 名须为 PascalCase（如 `KeyValueStore`），**禁止**连字符 `-`、中文、空格及其他特殊符号。命名规范权威定义见 [tla-plus.md](tla-plus.md) §2.0——TLA+ 标识符须匹配 `[A-Za-z][A-Za-z0-9_]*`，违反将导致 `check-tla-model.ts` SANY 阶段退出码 11（语法错误）。文件名须与 MODULE 名完全一致（不含 `.tla` 后缀）。

### Standard Modules
### Naturals
```tla
EXTENDS Naturals
\* Provides: Nat, +, -, *, ^, <, >, <=, >=, %, \div
\* Nat = {0, 1, 2, ...}
\* a..b = {a, a+1, ..., b}  (integer range)
```
### Integers
```tla
EXTENDS Integers
\* Provides: Int, -a (negation)
\* Int = {..., -2, -1, 0, 1, 2, ...}
```
### Reals
```tla
EXTENDS Reals
\* Provides: Real, /, Infinity
```
### Sequences
```tla
EXTENDS Sequences
\* Seq(S) - set of all finite sequences with elements from S
\* Head(s) - first element
\* Tail(s) - all but first element
\* Append(s, e) - append element to sequence
\* s \o t - concatenation
\* Len(s) - length
\* s[i] - element at index i (1-based)
\* SubSeq(s, m, n) - subsequence from m to n
\* SelectSeq(s, Test(_)) - filter sequence
```
### FiniteSets
```tla
EXTENDS FiniteSets
\* IsFiniteSet(S) - TRUE if S is finite
\* Cardinality(S) - number of elements in S
```
### Bags (Multisets)
```tla
EXTENDS Bags
\* EmptyBag - empty bag
\* IsABag(B) - TRUE if B is a bag
\* BagIn(e, B) - TRUE if e is in bag B
\* BagToSet(B) - convert bag to set
\* SetToBag(S) - convert set to bag
\* BagUnion(B1, B2) - bag union
\* CopiesIn(e, B) - count of e in B
```
### TLC
```tla
EXTENDS TLC
\* Print(val, out) - print val, return out
\* PrintT(val) - print val, return TRUE
\* Assert(cond, msg) - assert condition
\* JavaTime - current time in ms
\* Permutations(S) - symmetry set for TLC
\* SortSeq(s, Op(_, _)) - sort sequence
```
### Operators and Expressions
### Boolean Operators
```tla
TRUE                    \* Boolean true
FALSE                   \* Boolean false
~P                      \* Negation (NOT)
P /\ Q                  \* Conjunction (AND)
P \/ Q                  \* Disjunction (OR)
P => Q                  \* Implication
P <=> Q                 \* Equivalence (iff)
P # Q                   \* Not equal (same as /=)
IF P THEN e1 ELSE e2    \* Conditional expression
CASE p1 -> e1           \* Case expression
  [] p2 -> e2
  [] OTHER -> e3
```
### Set Operators
```tla
{e1, e2, e3}            \* Set enumeration
{x \in S : P(x)}        \* Set filter (comprehension)
{f(x) : x \in S}        \* Set map
x \in S                 \* Membership
x \notin S              \* Non-membership
S \cup T                \* Union
S \cap T                \* Intersection
S \ T                   \* Set difference
S \subseteq T           \* Subset or equal
SUBSET S                \* Powerset
UNION S                 \* Distributed union
S \X T                  \* Cartesian product
```
### Function Operators
```tla
[x \in S |-> e]         \* Function definition
f[x]                    \* Function application
DOMAIN f                \* Domain of function
[S -> T]                \* Set of functions from S to T
[f EXCEPT ![a] = b]     \* Function update
[f EXCEPT ![a] = @ + 1] \* Update using current value
[f EXCEPT ![a][b] = c]  \* Nested update
[f EXCEPT ![a] = b,     \* Multiple updates
          ![c] = d]
```
### Record Operators
```tla
[field1 |-> v1, field2 |-> v2]    \* Record construction
r.field                            \* Field access
[field1 : S1, field2 : S2]        \* Set of records
[r EXCEPT !.field = v]            \* Record update
```
### Tuple Operators
```tla
<<e1, e2, e3>>          \* Tuple construction
t[i]                    \* Element access (1-based)
S \X T \X U             \* Set of tuples
```
### Quantifiers
```tla
\A x \in S : P(x)       \* Universal quantifier (for all)
\E x \in S : P(x)       \* Existential quantifier (exists)
\A x, y \in S : P(x,y)  \* Multiple variables
\E x \in S, y \in T : P \* Different sets
```
### CHOOSE Operator
```tla
CHOOSE x \in S : P(x)   \* Choose arbitrary element satisfying P
\* Returns unspecified value if no such element exists
\* Deterministic: always returns same value for same inputs
\* Common pattern for unique element:
CHOOSE x \in S : \A y \in S : P(y) => y = x
```
### LET-IN Expressions
```tla
LET
  x == expr1
  f(a) == expr2
  g(a, b) == expr3
IN
  finalExpr
```
### Lambda Expressions
```tla
LAMBDA x : expr         \* Anonymous function
\* Used with higher-order operators like SelectSeq
```
### Temporal Logic Operators
### State Formulas vs Actions
```tla
\* State formula: predicate on state variables
P == x > 0 /\ y \in S
\* Action: relates current and next state
A == x' = x + 1 /\ y' = y
\* Primed variables refer to next state
x'  \* Value of x in next state
```
### Temporal Operators
```tla
[]P                     \* Always P (box)
<>P                     \* Eventually P (diamond)
P ~> Q                  \* P leads to Q (P => <>Q under fairness)
[][A]_v                 \* Always A or stuttering (v unchanged)
<><<A>>_v               \* Eventually A with v change
\* Fairness
WF_v(A)                 \* Weak fairness of A
SF_v(A)                 \* Strong fairness of A
```
### Specification Pattern
```tla
vars == <<x, y, z>>     \* Tuple of all variables
Init == ...             \* Initial state predicate
Next == ...             \* Next-state relation
Spec == Init /\ [][Next]_vars
\* Init holds initially, then always Next or stutter
FairSpec == Spec /\ WF_vars(Next)
\* Add fairness: if enabled, eventually happens
```
### Actions and State Changes
### Action Composition
```tla
\* Conjunction of actions
A1 /\ A2
\* Disjunction of actions
A1 \/ A2
\* Actions with parameters
Action(param) ==
    /\ precondition
    /\ x' = f(param)
    /\ UNCHANGED <<y, z>>
\* UNCHANGED macro
UNCHANGED <<x, y>>      \* Same as x' = x /\ y' = y
UNCHANGED x             \* Same as x' = x
```
### ENABLED Operator
```tla
ENABLED A               \* TRUE if action A is enabled
\* Useful for checking deadlock freedom
NoDeadlock == ENABLED Next
```
### Operator Definitions
### Constant Operators
```tla
Op == expr                      \* Parameterless operator
Op(a) == expr                   \* Unary operator
Op(a, b) == expr                \* Binary operator
Op(a, b, c) == expr             \* Ternary operator
\* Recursive operator (requires RECURSIVE declaration)
RECURSIVE Fact(_)
Fact(n) == IF n = 0 THEN 1 ELSE n * Fact(n-1)
```
### Higher-Order Operators
```tla
\* Operator that takes operator as parameter
Apply(Op(_), x) == Op(x)
Map(Op(_), S) == {Op(x) : x \in S}
```
### Local Definitions
```tla
Op(x) ==
  LET
    helper == x + 1
    f(y) == y * 2
  IN
    f(helper)
```
### Module System
### EXTENDS
```tla
EXTENDS Module1, Module2
\* Imports all definitions from modules
```
### INSTANCE
```tla
INSTANCE Module WITH const1 <- expr1, const2 <- expr2
\* Import with constant substitution
M == INSTANCE Module WITH ...
\* Prefixed import: use as M!Op
```
### LOCAL
```tla
LOCAL Op == expr
\* Definition not exported from module
```
### THEOREM and PROOF
```tla
THEOREM Spec => []Safety
\* Declare theorem (for documentation or proof)
THEOREM TypeCorrect == Spec => []TypeInvariant
<1>1. Init => TypeInvariant
<1>2. TypeInvariant /\ [Next]_vars => TypeInvariant'
<1>. QED BY <1>1, <1>2, PTL DEF Spec
```
### PlusCal (Algorithmic Language)
PlusCal is translated to TLA+ for model checking.
### Basic Structure
```tla
(*--algorithm AlgorithmName
variables x = 0, y \in 1..10;
define
  \* Operator definitions visible in algorithm
  Max(a, b) == IF a > b THEN a ELSE b
end define;
process ProcName \in ProcSet
variables localVar = 0;
begin
  label1:
    x := x + 1;
  label2:
    while x < 10 do
      x := x + 1;
    end while;
end process;
end algorithm; *)
```
### PlusCal Constructs
```tla
\* Assignment
x := expr;
\* Multiple assignment
x := e1 || y := e2;
\* Conditional
if cond then
  stmt1;
elsif cond2 then
  stmt2;
else
  stmt3;
end if;
\* While loop
while cond do
  stmt;
end while;
\* Either-or (nondeterministic choice)
either
  stmt1;
or
  stmt2;
end either;
\* With (nondeterministic selection)
with v \in Set do
  stmt using v;
end with;
\* Await (blocking)
await condition;
\* Assert
assert condition;
\* Print
print expr;
\* Skip
skip;
\* Goto
goto labelName;
\* Call macro
call MacroName(args);
\* Return
return;
\* Procedure definition
procedure ProcName(param)
variables localVar;
begin
  ...
end procedure;
```
### Fairness in PlusCal
```tla
\* Weak fairness (default)
fair process P \in S
\* Strong fairness
fair+ process P \in S
\* Per-label fairness
label:+ stmt;  \* Strong fairness for this label
label:- stmt;  \* No fairness for this label
```

### W 模型交叉引用

> 本节建立本语法参考与其他 TLA+ 参考文件的导航关系。

| 关联文件 | 关联章节 / 用途 |
|---|---|
| [tla-plus.md](tla-plus.md) | **§2.0 命名规范**——MODULE 名与标识符词法规则（本文件「Module Structure」节 W 模型适配说明的权威来源）；**文件头规范**——每个 `.tla` 须以 `@system`/`@requirement`/`@design`/`@parent`/`@sibling`/`@child`/`@level`/`@phase` 八字段结构化注释头开始；**§11 cfg-tla 一致性规则**——`.cfg` 的 `INVARIANTS` 列表须与 `.tla` 中 `BusinessInvariant` 展开的子不变式集合完全相等 |
| [tla-plus.md](tla-plus.md) | TLA+ 建模模式与示例（本文件提供语法速查，模式示例提供可复用的规格模板） |
| [tla-plus.md](tla-plus.md) | TLC 模型检查器配置参考（`.cfg` 文件结构、`SPECIFICATION`/`INVARIANT`/`INIT`/`NEXT` 关键字、状态空间约束等） |

> S-tla 子代理使用顺序：先查本文件确认语法 → 再查 tla-plus.md 选择建模模式 → 最后查 tla-plus.md 配置 `.cfg`；命名与文件头规范始终以 tla-plus.md §2.0 / 文件头规范为权威。



## 模式与示例


> 本文件为 TLA+ 典型示例库，提供 S-tla 子代理在 SD/DD 阶段按子系统类型选模板用的可复用模式集合。

### 来源说明

- **吸收自**：claude-tla-plus-plugin `skills/tla-plus-generator/patterns-examples.md`。
- **原始来源仓库**：`andrueandersoncs/claude-tla-plus-plugin`（GitHub，commit `60646ae8a549921a58aec0f853e40a9dc53f3fb3`）。
- **内容范围**：8 个完整 `.tla` 示例 + 末尾"Common Specification Patterns Summary"。
- **变更类型**：仅作 W 模型适配（每示例补文件头注释、补示例索引表、补交叉引用），未改动任何 `.tla` 规格体。

### W 模型适配说明

1. **文件头注释**：每个示例在 MODULE 行后插入 `@level` / `@sd`（占位，等价于 `@requirement`+`@design` 的简写）/ `@parent` / `@sibling` / `@child` / 来源六行注释，遵循 `tla-plus.md` §2.1 路径解析基准与"文件头规范（强制）"节定义的 8 个 `@` 字段。
2. **占位符语义与回填规则**：所有 `@sd` / `@parent` / `@sibling` / `@child` 标识均为**示例占位符**，按示例语义命名（如 Bakery → `SD-bakery-mutex`）。实际使用时由 **S-tla 子代理**按目标子系统的真实 RTM/结构层图谱标识回填，**且回填时须补齐 8 字段全集**：将 `@sd` 拆为 `@requirement`（关联需求 ID）+ `@design`（关联设计文档路径），并补 `@system`（所属系统名称）+ `@phase`（产出阶段 1-4），不可直接套用占位形式（违反 `check-tla-model.ts` 文件头校验，反模式 #16）。
3. **层级映射**：`@level` 按示例语义映射，固定为下表取值：
   - **L2**（系统级状态机/事务/共识/分布式算法）：示例 1、4、7、8。
   - **L3**（多进程并发/互斥/协调/经典同步问题）：示例 2、3、5、6。
4. **代码块原样保留**：示例 `.tla` 体从来源完整复制，保持缩进、空行、注释与 `=====` 终止符原样；仅在 MODULE 行后插入文件头注释块。

### 加载时机

- **触发者**：S-tla 子代理。
- **触发场景**：在「按 SD 子系统类型选模板」步骤中，根据目标子系统的场景语义按需加载对应示例作为骨架模板。
- **场景映射建议**（非穷举，S-tla 可按需扩展）：
  | 目标子系统场景 | 推荐加载示例 |
  |---|---|
  | 键值存储 / 事务快照隔离 | 示例 1（Key-Value Store） |
  | 互斥 / 锁协议 | 示例 2（Bakery Algorithm） |
  | 有界缓冲 / 生产者-消费者 | 示例 3（Producer-Consumer） |
  | 分布式生成树 / 网络泛洪 | 示例 4（Echo Algorithm） |
  | 多智能体协调 / 调度 | 示例 5（Elevator System） |
  | 经典同步问题 / 资源分配 | 示例 6（Cigarette Smokers） |
  | 共识 / 法定人数投票 | 示例 7（Consensus Protocol） |
  | 分布式事务提交 / 两阶段提交 | 示例 8（Two-Phase Commit） |
- **回填职责**：S-tla 选定模板后，将占位 `@sd/@parent/@sibling/@child` 替换为真实标识，并将 MODULE 名改为符合 §2.0 命名规范的目标模块名。

### 示例索引

| # | 示例 | 层级 | 典型场景 | W 模型阶段 |
|---|---|---|---|---|
| 1 | Key-Value Store | L2 | 状态机 + 事务 | 阶段 2-3 |
| 2 | Bakery Algorithm | L3 | 互斥 | 阶段 3-4 |
| 3 | Producer-Consumer | L3 | 并发同步 | 阶段 3-4 |
| 4 | Echo Algorithm | L2 | 分布式生成树 | 阶段 2 |
| 5 | Elevator System | L3 | 多智能体协调 | 阶段 3-4 |
| 6 | Cigarette Smokers | L3 | 经典同步问题 | 阶段 3-4 |
| 7 | Consensus Protocol | L2 | 共识 | 阶段 2 |
| 8 | Two-Phase Commit | L2 | 分布式事务 | 阶段 2 |

---

### Example 1: Key-Value Store with Snapshot Isolation

A concurrent key-value store with transactional semantics:

```tla
--------------------------- MODULE KeyValueStore ---------------------------
\* @level L2
\* @sd SD-kv-store（示例占位，实际使用时由 S-tla 子代理回填）
\* @parent REQ-kv-store
\* @sibling SD-tx-manager
\* @child DD-kv-get, DD-kv-put
\* 来源：吸收自 claude-tla-plus-plugin patterns-examples.md
CONSTANTS   Key,            \* The set of all keys
            Val,            \* The set of all values
            TxId            \* The set of all transaction IDs
VARIABLES   store,          \* Data store mapping keys to values
            tx,             \* Set of open snapshot transactions
            snapshotStore,  \* Snapshots of store for each transaction
            written,        \* Log of writes within each transaction
            missed          \* Writes invisible to each transaction
----------------------------------------------------------------------------
NoVal == CHOOSE v : v \notin Val
Store == [Key -> Val \cup {NoVal}]
Init ==
    /\ store = [k \in Key |-> NoVal]
    /\ tx = {}
    /\ snapshotStore = [t \in TxId |-> [k \in Key |-> NoVal]]
    /\ written = [t \in TxId |-> {}]
    /\ missed = [t \in TxId |-> {}]
TypeInvariant ==
    /\ store \in Store
    /\ tx \subseteq TxId
    /\ snapshotStore \in [TxId -> Store]
    /\ written \in [TxId -> SUBSET Key]
    /\ missed \in [TxId -> SUBSET Key]
OpenTx(t) ==
    /\ t \notin tx
    /\ tx' = tx \cup {t}
    /\ snapshotStore' = [snapshotStore EXCEPT ![t] = store]
    /\ UNCHANGED <<written, missed, store>>
Add(t, k, v) ==
    /\ t \in tx
    /\ snapshotStore[t][k] = NoVal
    /\ snapshotStore' = [snapshotStore EXCEPT ![t][k] = v]
    /\ written' = [written EXCEPT ![t] = @ \cup {k}]
    /\ UNCHANGED <<tx, missed, store>>
CloseTx(t) ==
    /\ t \in tx
    /\ missed[t] \cap written[t] = {}   \* No write-write conflicts
    /\ store' = [k \in Key |->
        IF k \in written[t] THEN snapshotStore[t][k] ELSE store[k]]
    /\ tx' = tx \ {t}
    /\ missed' = [otherTx \in TxId |->
        IF otherTx \in tx' THEN missed[otherTx] \cup written[t] ELSE {}]
    /\ snapshotStore' = [snapshotStore EXCEPT ![t] = [k \in Key |-> NoVal]]
    /\ written' = [written EXCEPT ![t] = {}]
Next ==
    \/ \E t \in TxId : OpenTx(t)
    \/ \E t \in tx : \E k \in Key : \E v \in Val : Add(t, k, v)
    \/ \E t \in tx : CloseTx(t)
Spec == Init /\ [][Next]_<<store, tx, snapshotStore, written, missed>>
=============================================================================
```

### Example 2: Mutual Exclusion (Bakery Algorithm)

Lamport's bakery algorithm for mutual exclusion:

```tla
---------------------------- MODULE Bakery ----------------------------
\* @level L3
\* @sd SD-bakery-mutex（示例占位，实际使用时由 S-tla 子代理回填）
\* @parent REQ-mutex
\* @sibling SD-peterson-lock
\* @child DD-bakery-entry, DD-bakery-exit
\* 来源：吸收自 claude-tla-plus-plugin patterns-examples.md
EXTENDS Naturals
CONSTANT N
ASSUME N \in Nat
Procs == 1..N
\* Lexicographic ordering on pairs
a \prec b == \/ a[1] < b[1]
             \/ (a[1] = b[1]) /\ (a[2] < b[2])
VARIABLES num, flag, pc
vars == <<num, flag, pc>>
Init ==
    /\ num = [i \in Procs |-> 0]
    /\ flag = [i \in Procs |-> FALSE]
    /\ pc = [i \in Procs |-> "ncs"]
\* Non-critical section
ncs(self) ==
    /\ pc[self] = "ncs"
    /\ pc' = [pc EXCEPT ![self] = "e1"]
    /\ UNCHANGED <<num, flag>>
\* Entry protocol: set flag and get ticket number
e1(self) ==
    /\ pc[self] = "e1"
    /\ flag' = [flag EXCEPT ![self] = TRUE]
    /\ num' = [num EXCEPT ![self] =
        1 + CHOOSE m \in Nat : \A i \in Procs : num[i] <= m]
    /\ pc' = [pc EXCEPT ![self] = "e2"]
\* Entry protocol: clear flag
e2(self) ==
    /\ pc[self] = "e2"
    /\ flag' = [flag EXCEPT ![self] = FALSE]
    /\ pc' = [pc EXCEPT ![self] = "w1"]
    /\ UNCHANGED num
\* Wait for others with lower numbers
w1(self) ==
    /\ pc[self] = "w1"
    /\ \A j \in Procs \ {self} :
        \/ num[j] = 0
        \/ <<num[self], self>> \prec <<num[j], j>>
    /\ pc' = [pc EXCEPT ![self] = "cs"]
    /\ UNCHANGED <<num, flag>>
\* Critical section
cs(self) ==
    /\ pc[self] = "cs"
    /\ pc' = [pc EXCEPT ![self] = "exit"]
    /\ UNCHANGED <<num, flag>>
\* Exit: reset number
exit(self) ==
    /\ pc[self] = "exit"
    /\ num' = [num EXCEPT ![self] = 0]
    /\ pc' = [pc EXCEPT ![self] = "ncs"]
    /\ UNCHANGED flag
p(self) == ncs(self) \/ e1(self) \/ e2(self) \/ w1(self) \/ cs(self) \/ exit(self)
Next == \E self \in Procs : p(self)
Spec == Init /\ [][Next]_vars /\ \A self \in Procs : WF_vars(p(self))
\* Safety: mutual exclusion
MutualExclusion == \A i, j \in Procs :
    (i /= j) => ~(pc[i] = "cs" /\ pc[j] = "cs")
\* Liveness: starvation freedom
StarvationFree == \A i \in Procs : pc[i] = "e1" ~> pc[i] = "cs"
TypeOK ==
    /\ num \in [Procs -> Nat]
    /\ flag \in [Procs -> BOOLEAN]
    /\ pc \in [Procs -> {"ncs", "e1", "e2", "w1", "cs", "exit"}]
=============================================================================
```

### Example 3: Producer-Consumer with Bounded Buffer

```tla
------------------------ MODULE ProducerConsumer ------------------------
\* @level L3
\* @sd SD-prod-cons-buffer（示例占位，实际使用时由 S-tla 子代理回填）
\* @parent REQ-bounded-buffer
\* @sibling SD-readers-writers
\* @child DD-produce, DD-consume
\* 来源：吸收自 claude-tla-plus-plugin patterns-examples.md
EXTENDS Naturals, Sequences
CONSTANTS Producers, Consumers, BufferSize, Data
VARIABLES buffer, prodState, consState
vars == <<buffer, prodState, consState>>
TypeInvariant ==
    /\ buffer \in Seq(Data)
    /\ Len(buffer) <= BufferSize
    /\ prodState \in [Producers -> {"idle", "producing"}]
    /\ consState \in [Consumers -> {"idle", "consuming"}]
Init ==
    /\ buffer = <<>>
    /\ prodState = [p \in Producers |-> "idle"]
    /\ consState = [c \in Consumers |-> "idle"]
Produce(p, d) ==
    /\ prodState[p] = "idle"
    /\ Len(buffer) < BufferSize
    /\ buffer' = Append(buffer, d)
    /\ prodState' = [prodState EXCEPT ![p] = "producing"]
    /\ UNCHANGED consState
FinishProducing(p) ==
    /\ prodState[p] = "producing"
    /\ prodState' = [prodState EXCEPT ![p] = "idle"]
    /\ UNCHANGED <<buffer, consState>>
Consume(c) ==
    /\ consState[c] = "idle"
    /\ Len(buffer) > 0
    /\ buffer' = Tail(buffer)
    /\ consState' = [consState EXCEPT ![c] = "consuming"]
    /\ UNCHANGED prodState
FinishConsuming(c) ==
    /\ consState[c] = "consuming"
    /\ consState' = [consState EXCEPT ![c] = "idle"]
    /\ UNCHANGED <<buffer, prodState>>
Next ==
    \/ \E p \in Producers, d \in Data : Produce(p, d)
    \/ \E p \in Producers : FinishProducing(p)
    \/ \E c \in Consumers : Consume(c)
    \/ \E c \in Consumers : FinishConsuming(c)
Spec == Init /\ [][Next]_vars
FairSpec == Spec
    /\ \A p \in Producers : WF_vars(\E d \in Data : Produce(p, d))
    /\ \A c \in Consumers : WF_vars(Consume(c))
\* Safety: buffer never overflows or underflows
BufferSafety == Len(buffer) >= 0 /\ Len(buffer) <= BufferSize
\* Liveness: items eventually get consumed
Progress == \A d \in Data :
    (d \in {buffer[i] : i \in 1..Len(buffer)}) ~>
    (d \notin {buffer[i] : i \in 1..Len(buffer)})
=============================================================================
```

### Example 4: Distributed Spanning Tree (Echo Algorithm)

```tla
-------------------------------- MODULE Echo --------------------------------
\* @level L2
\* @sd SD-echo-spanning-tree（示例占位，实际使用时由 S-tla 子代理回填）
\* @parent REQ-spanning-tree
\* @sibling SD-flooding
\* @child DD-echo-init, DD-echo-receive
\* 来源：吸收自 claude-tla-plus-plugin patterns-examples.md
EXTENDS Naturals, FiniteSets
CONSTANTS Node, initiator, R  \* R is adjacency relation
ASSUME /\ initiator \in Node
       /\ R \in [Node \X Node -> BOOLEAN]
NoNode == CHOOSE x : x \notin Node
neighbors(n) == {m \in Node : R[m, n]}
VARIABLES inbox, parent, children, rcvd
vars == <<inbox, parent, children, rcvd>>
\* Network operations
send(net, p, q, knd) == [net EXCEPT ![q] = @ \cup {[kind |-> knd, sndr |-> p]}]
receive(net, p, msg) == [net EXCEPT ![p] = @ \ {msg}]
multicast(net, p, dest, knd) ==
    [m \in Node |-> IF m \in dest
                    THEN net[m] \cup {[kind |-> knd, sndr |-> p]}
                    ELSE net[m]]
Init ==
    /\ inbox = [n \in Node |-> {}]
    /\ parent = [n \in Node |-> NoNode]
    /\ children = [n \in Node |-> {}]
    /\ rcvd = [n \in Node |-> 0]
\* Initiator starts the algorithm
InitiatorStart ==
    /\ rcvd[initiator] = 0
    /\ inbox' = multicast(inbox, initiator, neighbors(initiator), "m")
    /\ rcvd' = [rcvd EXCEPT ![initiator] = Cardinality(neighbors(initiator))]
    /\ UNCHANGED <<parent, children>>
\* Non-initiator receives first message
FirstReceive(n) ==
    /\ n /= initiator
    /\ rcvd[n] = 0
    /\ \E msg \in inbox[n] :
        /\ msg.kind = "m"
        /\ parent' = [parent EXCEPT ![n] = msg.sndr]
        /\ inbox' = multicast(receive(inbox, n, msg), n,
                              neighbors(n) \ {msg.sndr}, "m")
        /\ rcvd' = [rcvd EXCEPT ![n] = 1]
    /\ UNCHANGED children
\* Receive subsequent messages
SubsequentReceive(n) ==
    /\ rcvd[n] > 0
    /\ rcvd[n] < Cardinality(neighbors(n))
    /\ \E msg \in inbox[n] :
        /\ inbox' = receive(inbox, n, msg)
        /\ rcvd' = [rcvd EXCEPT ![n] = @ + 1]
        /\ IF msg.kind = "c"
           THEN children' = [children EXCEPT ![n] = @ \cup {msg.sndr}]
           ELSE UNCHANGED children
    /\ UNCHANGED parent
\* Send acknowledgment to parent
SendAck(n) ==
    /\ n /= initiator
    /\ rcvd[n] = Cardinality(neighbors(n))
    /\ parent[n] /= NoNode
    /\ inbox' = send(inbox, n, parent[n], "c")
    /\ parent' = [parent EXCEPT ![n] = NoNode]  \* Mark as done
    /\ UNCHANGED <<children, rcvd>>
Next ==
    \/ InitiatorStart
    \/ \E n \in Node : FirstReceive(n)
    \/ \E n \in Node : SubsequentReceive(n)
    \/ \E n \in Node : SendAck(n)
Spec == Init /\ [][Next]_vars
\* The initiator never has a parent
InitiatorNoParent == parent[initiator] = NoNode
\* At termination, initiator has all children in spanning tree
SpanningTree ==
    (\A n \in Node : rcvd[n] = Cardinality(neighbors(n))) =>
    \A n \in Node \ {initiator} :
        \E path \in Seq(Node) :
            /\ path[1] = n
            /\ path[Len(path)] = initiator
=============================================================================
```

### Example 5: Multi-Car Elevator System

```tla
------------------------------ MODULE Elevator ------------------------------
\* @level L3
\* @sd SD-elevator-coord（示例占位，实际使用时由 S-tla 子代理回填）
\* @parent REQ-elevator
\* @sibling SD-scheduler
\* @child DD-call-elevator, DD-move-elevator
\* 来源：吸收自 claude-tla-plus-plugin patterns-examples.md
EXTENDS Integers
CONSTANTS Person, Elevator, FloorCount
VARIABLES PersonState, ActiveElevatorCalls, ElevatorState
Vars == <<PersonState, ActiveElevatorCalls, ElevatorState>>
Floor == 1..FloorCount
Direction == {"Up", "Down"}
ElevatorCall == [floor : Floor, direction : Direction]
ElevatorDirectionState == Direction \cup {"Stationary"}
GetDirection[current, destination \in Floor] ==
    IF destination > current THEN "Up" ELSE "Down"
GetDistance[f1, f2 \in Floor] ==
    IF f1 > f2 THEN f1 - f2 ELSE f2 - f1
CanServiceCall[e \in Elevator, c \in ElevatorCall] ==
    LET eState == ElevatorState[e] IN
    /\ c.floor = eState.floor
    /\ c.direction = eState.direction
TypeInvariant ==
    /\ PersonState \in [Person -> [location : Floor \cup Elevator,
                                   destination : Floor,
                                   waiting : BOOLEAN]]
    /\ ActiveElevatorCalls \subseteq ElevatorCall
    /\ ElevatorState \in [Elevator -> [floor : Floor,
                                       direction : ElevatorDirectionState,
                                       doorsOpen : BOOLEAN,
                                       buttonsPressed : SUBSET Floor]]
Init ==
    /\ PersonState \in [Person -> [location : Floor,
                                   destination : Floor,
                                   waiting : {FALSE}]]
    /\ ActiveElevatorCalls = {}
    /\ ElevatorState \in [Elevator -> [floor : Floor,
                                       direction : {"Stationary"},
                                       doorsOpen : {FALSE},
                                       buttonsPressed : {{}}]]
CallElevator(p) ==
    LET
        pState == PersonState[p]
        call == [floor |-> pState.location,
                 direction |-> GetDirection[pState.location, pState.destination]]
    IN
    /\ ~pState.waiting
    /\ pState.location /= pState.destination
    /\ pState.location \in Floor
    /\ ActiveElevatorCalls' = ActiveElevatorCalls \cup {call}
    /\ PersonState' = [PersonState EXCEPT ![p] = [@ EXCEPT !.waiting = TRUE]]
    /\ UNCHANGED ElevatorState
OpenDoors(e) ==
    LET eState == ElevatorState[e] IN
    /\ ~eState.doorsOpen
    /\ \/ \E call \in ActiveElevatorCalls : CanServiceCall[e, call]
       \/ eState.floor \in eState.buttonsPressed
    /\ ElevatorState' = [ElevatorState EXCEPT ![e] =
        [@ EXCEPT !.doorsOpen = TRUE,
                  !.buttonsPressed = @ \ {eState.floor}]]
    /\ ActiveElevatorCalls' = ActiveElevatorCalls \
        {[floor |-> eState.floor, direction |-> eState.direction]}
    /\ UNCHANGED PersonState
MoveElevator(e) ==
    LET
        eState == ElevatorState[e]
        nextFloor == IF eState.direction = "Up"
                     THEN eState.floor + 1
                     ELSE eState.floor - 1
    IN
    /\ eState.direction /= "Stationary"
    /\ ~eState.doorsOpen
    /\ nextFloor \in Floor
    /\ ElevatorState' = [ElevatorState EXCEPT ![e] =
        [@ EXCEPT !.floor = nextFloor]]
    /\ UNCHANGED <<PersonState, ActiveElevatorCalls>>
Next ==
    \/ \E p \in Person : CallElevator(p)
    \/ \E e \in Elevator : OpenDoors(e)
    \/ \E e \in Elevator : MoveElevator(e)
Spec == Init /\ [][Next]_Vars
\* Safety: elevator doors only open at valid floors
DoorsOpenAtValidFloor ==
    \A e \in Elevator : ElevatorState[e].doorsOpen =>
        ElevatorState[e].floor \in Floor
\* Liveness: every call eventually serviced
CallsServiced == \A c \in ElevatorCall :
    c \in ActiveElevatorCalls ~> \E e \in Elevator : CanServiceCall[e, c]
=============================================================================
```

### Example 6: Cigarette Smokers Problem

Classic synchronization problem:

```tla
-------------------------- MODULE CigaretteSmokers --------------------------
\* @level L3
\* @sd SD-smokers-sync（示例占位，实际使用时由 S-tla 子代理回填）
\* @parent REQ-sync
\* @sibling SD-dining-philosophers
\* @child DD-start-smoking, DD-stop-smoking
\* 来源：吸收自 claude-tla-plus-plugin patterns-examples.md
EXTENDS Integers, FiniteSets
CONSTANT Ingredients, Offers
VARIABLE smokers, dealer
ASSUME /\ Offers \subseteq (SUBSET Ingredients)
       /\ \A n \in Offers : Cardinality(n) = Cardinality(Ingredients) - 1
TypeOK ==
    /\ smokers \in [Ingredients -> [smoking: BOOLEAN]]
    /\ dealer \in Offers \/ dealer = {}
vars == <<smokers, dealer>>
ChooseOne(S, P(_)) == CHOOSE x \in S : P(x) /\ \A y \in S : P(y) => y = x
Init ==
    /\ smokers = [r \in Ingredients |-> [smoking |-> FALSE]]
    /\ dealer \in Offers
startSmoking ==
    /\ dealer /= {}
    /\ smokers' = [r \in Ingredients |->
        [smoking |-> {r} \cup dealer = Ingredients]]
    /\ dealer' = {}
stopSmoking ==
    /\ dealer = {}
    /\ LET r == ChooseOne(Ingredients, LAMBDA x : smokers[x].smoking)
       IN smokers' = [smokers EXCEPT ![r].smoking = FALSE]
    /\ dealer' \in Offers
Next == startSmoking \/ stopSmoking
Spec == Init /\ [][Next]_vars
FairSpec == Spec /\ WF_vars(Next)
\* At most one smoker at a time
AtMostOne == Cardinality({r \in Ingredients : smokers[r].smoking}) <= 1
=============================================================================
```

### Example 7: Simple Consensus Protocol

```tla
---------------------------- MODULE Consensus ----------------------------
\* @level L2
\* @sd SD-consensus（示例占位，实际使用时由 S-tla 子代理回填）
\* @parent REQ-consensus
\* @sibling SD-paxos
\* @child DD-vote, DD-decide
\* 来源：吸收自 claude-tla-plus-plugin patterns-examples.md
EXTENDS Naturals, FiniteSets
CONSTANTS Value, Acceptor, Quorum
ASSUME /\ \A Q \in Quorum : Q \subseteq Acceptor
       /\ \A Q1, Q2 \in Quorum : Q1 \cap Q2 /= {}
VARIABLES votes, decision
vars == <<votes, decision>>
TypeOK ==
    /\ votes \in [Acceptor -> SUBSET Value]
    /\ decision \in SUBSET Value
Init ==
    /\ votes = [a \in Acceptor |-> {}]
    /\ decision = {}
Vote(a, v) ==
    /\ votes[a] = {}  \* Each acceptor votes once
    /\ votes' = [votes EXCEPT ![a] = {v}]
    /\ UNCHANGED decision
Decide(v) ==
    /\ v \notin decision
    /\ \E Q \in Quorum : \A a \in Q : v \in votes[a]
    /\ decision' = decision \cup {v}
    /\ UNCHANGED votes
Next ==
    \/ \E a \in Acceptor, v \in Value : Vote(a, v)
    \/ \E v \in Value : Decide(v)
Spec == Init /\ [][Next]_vars
\* Agreement: at most one value decided
Agreement == Cardinality(decision) <= 1
\* Validity: only proposed values can be decided
Validity == decision \subseteq Value
=============================================================================
```

### Example 8: Two-Phase Commit

```tla
--------------------------- MODULE TwoPhaseCommit ---------------------------
\* @level L2
\* @sd SD-two-phase-commit（示例占位，实际使用时由 S-tla 子代理回填）
\* @parent REQ-transaction-commit
\* @sibling SD-3pc
\* @child DD-prepare, DD-commit
\* 来源：吸收自 claude-tla-plus-plugin patterns-examples.md
EXTENDS Naturals
CONSTANTS RM  \* Set of resource managers
VARIABLES rmState, tmState, tmPrepared, msgs
vars == <<rmState, tmState, tmPrepared, msgs>>
Message == [type : {"Prepared", "Commit", "Abort"}]
TypeOK ==
    /\ rmState \in [RM -> {"working", "prepared", "committed", "aborted"}]
    /\ tmState \in {"init", "committed", "aborted"}
    /\ tmPrepared \subseteq RM
    /\ msgs \subseteq Message
Init ==
    /\ rmState = [r \in RM |-> "working"]
    /\ tmState = "init"
    /\ tmPrepared = {}
    /\ msgs = {}
\* RM sends Prepared message
RMPrepare(r) ==
    /\ rmState[r] = "working"
    /\ rmState' = [rmState EXCEPT ![r] = "prepared"]
    /\ msgs' = msgs \cup {[type |-> "Prepared"]}
    /\ UNCHANGED <<tmState, tmPrepared>>
\* TM receives Prepared from RM
TMRcvPrepared(r) ==
    /\ tmState = "init"
    /\ [type |-> "Prepared"] \in msgs
    /\ tmPrepared' = tmPrepared \cup {r}
    /\ UNCHANGED <<rmState, tmState, msgs>>
\* TM commits when all RMs prepared
TMCommit ==
    /\ tmState = "init"
    /\ tmPrepared = RM
    /\ tmState' = "committed"
    /\ msgs' = msgs \cup {[type |-> "Commit"]}
    /\ UNCHANGED <<rmState, tmPrepared>>
\* TM aborts
TMAbort ==
    /\ tmState = "init"
    /\ tmState' = "aborted"
    /\ msgs' = msgs \cup {[type |-> "Abort"]}
    /\ UNCHANGED <<rmState, tmPrepared>>
\* RM commits upon receiving Commit
RMRcvCommit(r) ==
    /\ rmState[r] = "prepared"
    /\ [type |-> "Commit"] \in msgs
    /\ rmState' = [rmState EXCEPT ![r] = "committed"]
    /\ UNCHANGED <<tmState, tmPrepared, msgs>>
\* RM aborts upon receiving Abort
RMRcvAbort(r) ==
    /\ rmState[r] \in {"working", "prepared"}
    /\ [type |-> "Abort"] \in msgs
    /\ rmState' = [rmState EXCEPT ![r] = "aborted"]
    /\ UNCHANGED <<tmState, tmPrepared, msgs>>
Next ==
    \/ \E r \in RM : RMPrepare(r)
    \/ \E r \in RM : TMRcvPrepared(r)
    \/ TMCommit
    \/ TMAbort
    \/ \E r \in RM : RMRcvCommit(r)
    \/ \E r \in RM : RMRcvAbort(r)
Spec == Init /\ [][Next]_vars
\* Consistency: all RMs reach same decision
Consistency ==
    /\ \A r1, r2 \in RM : ~(rmState[r1] = "committed" /\ rmState[r2] = "aborted")
    /\ (tmState = "committed") => (\A r \in RM : rmState[r] /= "aborted")
    /\ (tmState = "aborted") => (\A r \in RM : rmState[r] /= "committed")
=============================================================================
```

### Common Specification Patterns Summary

1. **State Machine**: Define states, transitions, and invariants
2. **Concurrent Processes**: Use process IDs as indices into state arrays
3. **Message Passing**: Model channels as sets/sequences of messages
4. **Transactions**: Snapshot isolation with conflict detection
5. **Mutual Exclusion**: Entry/exit protocols with safety properties
6. **Producer-Consumer**: Bounded buffers with blocking
7. **Consensus**: Quorum-based voting
8. **Two-Phase Commit**: Coordinator-participant protocols

---

### W 模型交叉引用

本文件作为 TLA+ 参考体系的示例库，与以下参考文件协同使用：

- **`tla-plus.md`**（主纲）
  - **§2.0 命名规范**：S-tla 选定模板后改 MODULE 名时须遵守（无连字符/中文/特殊符号，文件名与 MODULE 名一致）。
  - **§2.1 路径解析基准 + 「文件头规范（强制）」节**：本文件每示例的 `@level`/`@sd`/`@parent`/`@sibling`/`@child` 字段语义与回填规则依据；`@parent`/`@sibling`/`@child` 相对 `.tla` 文件所在目录解析。
  - **§3 SD 覆盖率校验（全规格强制，无例外）**：本文件提供的 SD 模板最终须落入 SD 覆盖率统计；占位符 `@sd` 回填后即计入 `--graph` 提取的 SD 节点。
  - **§10 SD 覆盖率规则**：缺陷对照 D10（11 个子系统但仅 3 个 spec）的检出依据；本示例库旨在降低该缺陷复发率，提供可复用 SD 骨架。
- **`tla-plus.md`**：示例中 `EXTENDS`、`CHOOSE`、`EXCEPT`、`[][Next]_vars`、`WF_vars`、`~>` 等语法语义查证来源。
- **`tla-plus.md`**：示例 TLC 验证（`Spec`、`FairSpec`、不变式 `TypeInvariant`/`Agreement`/`Consistency` 等）的 `INIT`/`NEXT`/`INVARIANT`/`PROPERTIES` 配置规则。
- **`tla-plus.md`**：S-tla 回填占位符后、提交门禁前的自检清单（文件头 8 字段齐全、与 manifest 一致、SANY 通过、TLC 通过）。

> **回填流程**：S-tla 子代理按子系统场景从「示例索引」或「加载时机」表选定模板 → 复制对应 `.tla` 块 → 将 `@sd/@parent/@sibling/@child` 占位符替换为真实标识 → 改 MODULE 名 → 按 `tla-plus.md` 校验语法 → 按 `tla-plus.md` 配置 TLC → 按 `tla-plus.md` 自检 → 提交 §3/§10 覆盖率门禁。



## 评审清单


> **来源**：吸收自 [`claude-tla-plus-plugin`](https://github.com/andrueandersoncs/claude-tla-plus-plugin) `commands/review.md`
> **W 模型适配**：不新增 `targetKind=tla`（违反 P2.5 的 4 值枚举约束）。V-tla 子代理评审 TLA+ 时仍用 `targetKind=design`，本清单作为 §7.2「设计」的参考资料
> **加载时机**：V-tla 子代理审查 TLA+ 规格时必读

### 7 项审查清单

### 1. 结构与风格（Structure and Style）

- 模块头是否含文档说明
- 常量/变量/算子是否清晰分离
- 命名约定是否一致（W 模型：PascalCase 模块名）
- 是否有充分注释说明意图

**W 模型增强**：文件头须含 8 字段结构化注释头 @system/@requirement/@design/@parent/@sibling/@child/@level/@phase（见 [tla-plus.md §文件头规范](./tla-plus.md)）。

### 2. 正确性（Correctness）

- Init 是否覆盖所有变量
- Next 是否完整（所有可能转移）
- 动作是否有正确前置条件
- UNCHANGED 子句是否正确
- 是否有意外变量遮蔽

### 3. 类型安全（Type Safety）

- TypeInvariant 是否定义
- 所有变量是否有清晰类型
- 集合推导是否良构
- 函数 domain 是否显式

### 4. 属性（Properties）

- 安全属性是否清晰陈述
- 活性属性（若有）是否有 fairness
- 属性是否匹配系统需求

### 5. 模型检查（Model Checking）

- 常量是否适当有界
- 是否使用对称性（如适用）
- 状态约束是否限制爆炸

**W 模型增强**：.cfg 须遵循 [§11 cfg-tla 一致性规则](./tla-plus.md) + [§12 cfg 结构规则](./tla-plus.md)。

### 6. 常见问题（Common Issues）

- 死锁可能性
- 缺失 UNCHANGED 子句
- 过严前置条件
- 无界状态增长
- 活性缺 fairness

### 7. 输出（Output）

- 发现项摘要
- 具体建议（含代码示例）
- 优先级：Critical > Important > Minor

### 与 verifier-spec.md 5 维度的映射

V-tla 子代理产出 VerifierOutput JSON 时，本清单 7 项按以下映射归入 5 维度（不修改 5 维度定义，仅作参考）：

| 本清单项 | verifier-spec.md 维度 |
|---|---|
| 1 结构与风格 / 2 正确性 / 3 类型安全 | correctness |
| 4 属性 | coverage（不变式/活性覆盖） |
| 5 模型检查 | priority-reasonableness（cfg 配置合理性） |
| 6 常见问题 | independence（独立缺陷识别） |
| 7 输出 | clarity |

详见 [verifier-spec.md §7.2 设计（targetKind = `design`）](./verifier-spec.md)。

### W 模型交叉引用

- [反模式 #15-17](./hard-constraints.md)：TLA+ 占位/简化/错误实现、建模不符合需求设计
- [tla-plus.md](./tla-plus.md)：TLA+ 流程约束（命名/路径/前置/校验/契约）
- [语法参考](./tla-plus.md)：TLA+ 完整语法
- [模式示例](./tla-plus.md)：8 个典型示例
- [TLC 配置](./tla-plus.md)：.cfg 文件指南
- [bdd.md](./bdd.md)：BDD features 审查参考清单（与 TLA+ 审查清单对称：TLA+ 用 `targetKind=design` + 本清单，BDD 用 `targetKind=test` + bdd.md；BDD↔TLA+ 等价性由 `check-bdd-model.ts` D4 维度守护）



## TLC 配置


> **来源**：吸收自 [`claude-tla-plus-plugin`](https://github.com/andrueandersoncs/claude-tla-plus-plugin) `skills/tla-plus-generator/tlc-configuration.md`
> **W 模型适配**：.cfg 须遵循 [tla-plus.md §11 cfg-tla 一致性规则](./tla-plus.md) + [§12 cfg 结构规则](./tla-plus.md)；不得含 `MODULE` 声明；`INVARIANTS` 须列出 .tla 中所有不变式（即 `BusinessInvariant == /\ Inv1 /\ Inv2 ...` 展开的全部子不变式）
> **加载时机**：S-tla 子代理产出 .cfg 时必读

TLC（Temporal Logic Checker）是 TLA+ 规格的模型检查器。本指南覆盖配置文件格式与最佳实践。

### 配置文件格式（.cfg）

创建与 `.tla` 文件同名的 `.cfg` 文件：

```cfg
\* Comments start with \*
\* Specify the specification formula
SPECIFICATION Spec

\* Alternatively, for Init/Next style:
INIT Init
NEXT Next

\* Constants - using literal values
CONSTANTS
    NumProcesses = 3
    MaxValue = 10
    BufferSize = 5

\* Constants - using model values (uninterpreted)
CONSTANTS
    Procs = {p1, p2, p3}
    Nodes = {n1, n2, n3, n4}

\* Constants - using sets
CONSTANTS
    Values = {v1, v2, v3}
    Keys = {k1, k2}

\* Invariants to check (safety properties)
INVARIANTS
    TypeInvariant
    Safety
    MutualExclusion

\* Properties to check (including liveness)
PROPERTIES
    Liveness
    Termination
    Progress

\* Symmetry sets for optimization
SYMMETRY
    Permutations(Procs)

\* State constraint to limit search
CONSTRAINT
    StateConstraint

\* Action constraint
ACTION_CONSTRAINT
    ActionConstraint

\* Check deadlock (default: true)
CHECK_DEADLOCK TRUE

\* Alias for trace exploration
ALIAS
    Alias
```

**W 模型约束**（强制，违反 → `check-tla-model.ts` exitCode=1）：

- `.cfg` **不得**含 `---- MODULE <Name> ----` 声明（这是 `.tla` 头部语法，混入 `.cfg` 触发 TLC 解析错误；见 [tla-plus.md §12 cfg 结构规则](./tla-plus.md)）
- `INVARIANTS` 须列出 `.tla` 中所有不变式——即 `.tla` 中 `BusinessInvariant == /\ Inv1 /\ Inv2 ...` 展开的全部子不变式，集合须完全相等（见 [tla-plus.md §11 cfg-tla 一致性规则](./tla-plus.md)）
- 等价的逐行形式 `INVARIANT <Name>` 与 `INVARIANTS` 关键字后跟列表均合法，但不变式数量计数须与 `.tla` `BusinessInvariant` 展开数一致

### 完整配置示例

### 示例 1：键值存储配置（Key-Value Store）

```cfg
\* MCKeyValueStore.cfg
SPECIFICATION Spec

CONSTANTS
    Key = {k1, k2}
    Val = {v1, v2}
    TxId = {t1, t2}

INVARIANTS
    TypeInvariant
    TxLifecycle

SYMMETRY
    Permutations(Key) \union Permutations(Val) \union Permutations(TxId)
```

### 示例 2：Bakery 算法配置（Bakery Algorithm）

```cfg
\* MCBakery.cfg
SPECIFICATION Spec

CONSTANTS
    N = 3

INVARIANTS
    TypeOK
    MutualExclusion

PROPERTIES
    StarvationFree

CHECK_DEADLOCK TRUE
```

### 示例 3：电梯系统配置（Elevator System）

```cfg
\* ElevatorSafety.cfg
SPECIFICATION Spec

CONSTANTS
    Person = {person1, person2}
    Elevator = {e1}
    FloorCount = 3

INVARIANTS
    TypeInvariant
    SafetyInvariant

\* Don't check liveness for safety verification
\* PROPERTIES
\*     TemporalInvariant

SYMMETRY
    Permutations(Person)

CHECK_DEADLOCK FALSE
```

### 示例 4：共识协议配置（Consensus Protocol）

```cfg
\* MCConsensus.cfg
SPECIFICATION Spec

CONSTANTS
    Value = {v1, v2}
    Acceptor = {a1, a2, a3}
    Quorum = {{a1, a2}, {a1, a3}, {a2, a3}}

INVARIANTS
    TypeOK
    Agreement
    Validity

SYMMETRY
    Permutations(Value) \union Permutations(Acceptor)
```

### 示例 5：两阶段提交配置（Two-Phase Commit）

```cfg
\* MC2PC.cfg
SPECIFICATION Spec

CONSTANTS
    RM = {rm1, rm2, rm3}

INVARIANTS
    TypeOK
    Consistency

SYMMETRY
    Permutations(RM)

CHECK_DEADLOCK TRUE
```

### 示例 6：生产者-消费者配置（Producer-Consumer）

```cfg
\* MCProducerConsumer.cfg
SPECIFICATION FairSpec

CONSTANTS
    Producers = {prod1, prod2}
    Consumers = {cons1}
    BufferSize = 3
    Data = {d1, d2}

INVARIANTS
    TypeInvariant
    BufferSafety

PROPERTIES
    Progress

SYMMETRY
    Permutations(Data)

\* Limit state space for testing
CONSTRAINT
    Len(buffer) <= BufferSize
```

### 配置选项详解（Configuration Options Explained）

### SPECIFICATION vs INIT/NEXT

```cfg
\* Use SPECIFICATION for temporal formulas with fairness
SPECIFICATION Spec
\* Where Spec == Init /\ [][Next]_vars /\ Fairness

\* Use INIT/NEXT for simple safety checking
INIT Init
NEXT Next
```

> **W 模型提示**：`SPECIFICATION Spec` 使用 `[Next]_vars` 带 stuttering，可避免终态被误报为死锁；`INIT Init` + `NEXT Next` 不带 stuttering，终态会触发死锁。建模时通常用 `SPECIFICATION Spec`，仅在刻意要检测终态死锁时才用 `INIT/NEXT`（见 [tla-plus.md §校验步骤](./tla-plus.md)）。

### 模型值 vs 普通值（Model Values vs Ordinary Values）

**模型值**（未解释常量）：

```cfg
CONSTANTS
    Procs = {p1, p2, p3}  \* Model values
```

- TLC 创建全新的符号值
- 适合抽象标识符
- 启用对称性归约

**普通值**（具体值）：

```cfg
CONSTANTS
    N = 3
    MaxItems = 10
```

- 使用 Naturals、Integers 等
- 适合数值边界

### 对称性优化（Symmetry Optimization）

对称性通过将置换视为等价来缩减状态空间：

```cfg
SYMMETRY
    Permutations(Procs)

\* Multiple symmetry sets
SYMMETRY
    Permutations(Procs) \union Permutations(Values)
```

**对称性要求**：

- 常量须为模型值
- 规格须对称（对所有元素等价处理）

### 状态约束（State Constraints）

限制探索至满足约束的状态：

```cfg
CONSTRAINT
    counter < 100 /\ Len(buffer) <= 10

\* Multiple constraints (conjuncted)
CONSTRAINT StateConstraint1
CONSTRAINT StateConstraint2
```

### 动作约束（Action Constraints）

限制 TLC 探索哪些动作：

```cfg
ACTION_CONSTRAINT
    \* Only explore actions where counter increases by at most 1
    counter' <= counter + 1
```

### TLC 命令行选项（TLC Command Line Options）

从命令行运行 TLC：

```bash
# Basic run
java -jar tla2tools.jar -config MCSpec.cfg Spec.tla

# With workers for parallelism
java -jar tla2tools.jar -workers 4 -config MCSpec.cfg Spec.tla

# Simulation mode (random exploration)
java -jar tla2tools.jar -simulate -depth 100 Spec.tla

# Generate trace
java -jar tla2tools.jar -dump dot,colorize states.dot Spec.tla

# Check specific properties
java -jar tla2tools.jar -config MCSpec.cfg \
    -invariant TypeOK \
    -property Liveness \
    Spec.tla
```

> **W 模型提示**：W 模型 `check-tla-model.ts` 实际调用形式为 `java -cp <jarPath> tlc2.TLC -nowarning -cleanup -config <spec>.cfg <moduleName>`（cwd 置为 .tla 所在目录）。退出码：0=成功 / 11=死锁 / 12=不变式违反（见 [tla-plus.md §校验步骤](./tla-plus.md)）。

### 常见 TLC 选项（Common TLC Options）

| 选项 | 说明 |
|--------|-------------|
| `-workers N` | 使用 N 个工作线程 |
| `-simulate` | 随机模拟模式 |
| `-depth N` | 最大轨迹深度 |
| `-checkpoint M` | 每 M 分钟检查点 |
| `-recover path` | 从检查点恢复 |
| `-deadlock` | 检查死锁 |
| `-dump fmt file` | 导出状态图 |
| `-coverage M` | 每 M 分钟报告覆盖率 |
| `-debugger` | 启用调试器 |

### 最佳实践（Best Practices）

### 1. 从小模型开始

```cfg
\* Start with minimal constants
CONSTANTS
    N = 2
    MaxValue = 3

\* Gradually increase after verification
```

### 2. 尽可能使用对称性

```cfg
\* Good: symmetric model values
CONSTANTS Procs = {p1, p2, p3}
SYMMETRY Permutations(Procs)

\* Bad: asymmetric (no symmetry possible)
CONSTANTS Procs = {1, 2, 3}
```

### 3. 为大模型添加状态约束

```cfg
\* Limit exploration depth
CONSTRAINT
    clock < 10 /\
    \A p \in Procs : counter[p] < 5
```

### 4. 分离安全性与活性检查

```cfg
\* SafetyCheck.cfg
SPECIFICATION Spec  \* Without fairness
INVARIANTS TypeOK Safety

\* LivenessCheck.cfg
SPECIFICATION FairSpec  \* With fairness
PROPERTIES Liveness
```

### 5. 调试时使用 ALIAS

```cfg
\* Define readable state representation
ALIAS
    [
        state |-> state,
        pending |-> Len(queue),
        active |-> {p \in Procs : pc[p] = "active"}
    ]
```

### 故障排查（Troubleshooting）

### "Attempted to compute CHOOSE..." 错误

- 在 CHOOSE 前确保集合非空
- 为动作添加前置条件

### 状态空间爆炸

- 减小常量值
- 添加状态约束
- 使用对称性归约
- 先尝试模拟模式

### 活性检查缓慢

- 先检查安全属性
- 对活性使用更小模型
- 仔细考虑 fairness 要求

### "Invariant violated" 但无轨迹

- 启用 `-dump` 查看状态
- 先添加 TypeInvariant
- 检查 Init 谓词

### W 模型交叉引用

- [tla-plus.md §11 cfg-tla 一致性规则](./tla-plus.md) — `.cfg` `INVARIANTS` 须与 `.tla` `BusinessInvariant` 展开集合完全相等
- [tla-plus.md §12 cfg 结构规则](./tla-plus.md) — `.cfg` 禁止 `MODULE` 声明、`INVARIANT` 行格式、不变式数量计数
- [tla-plus.md §2.2 前置清单](./tla-plus.md) — S 子代理产出 `.tla` 前 3 项必做（含 `.cfg` INVARIANTS 一致）
- [tla-plus.md](./tla-plus.md) — TLA+ 语法参考（S-tla 产 `.tla` 时查阅）
- [tla-plus.md](./tla-plus.md) — 8 个模式示例（按 SD 子系统类型选模板）
- [tla-plus.md](./tla-plus.md) — V-tla 审查清单（含第 5 项「模型检查」覆盖 .cfg 检查维度）

