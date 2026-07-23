# TLA+ 层次化建模指南（TLA+ Guide）

> 本文件定义 TLA+ 层次化状态机建模的可执行细则：文件头规范、层级拆解、门禁脚本用法、阶段产出契约。
> S 子代理（产出 .tla + .cfg + 更新 manifest）、V 子代理（评审合规性）、G 子代理（跑 check-tla-model.ts）必读。
> 权威设计见 [docs/tla-plus-modeling-design.md](../../docs/tla-plus-modeling-design.md)。

## 公理

> **正常软件系统不允许死锁。任何死锁或矛盾分支必须定位根因并修正，而非绕过。**

TLA+ 门禁是 W 模型第三维度门禁——与结构连通门禁（graph）、信息流门禁（dataflow）正交：

| 维度 | 校验什么 | 脚本 |
|---|---|---|
| 结构连通 | 节点归属单根树、追溯完整 | `check-requirement-graph.ts` |
| 信息流闭合 | 节点既是生产者又是消费者 | `check-requirement-graph.ts` |
| **行为正确性** | **状态机无死锁、不变式成立、无状态爆炸** | **`check-tla-model.ts`** |

## 工具链

| 依赖 | 版本 | 位置 |
|---|---|---|
| Java runtime | ≥ 11 | 宿主环境预装（唯一外部依赖） |
| `tla2tools.jar` | TLC2 2.19 of 08 August 2024 | 技能内置 `w-model-dev/tools/tla2tools.jar` |

> jar 含 SANY（语法解析）+ TLC（模型检查）+ PlusCal（翻译器），单文件分发，无网络依赖。
> 版本号 2026-07-23 实测确认：`java -cp tla2tools.jar tlc2.TLC` 输出 `TLC2 Version 2.19 of 08 August 2024`。

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

## 文件头规范（强制）

每个 `.tla` 文件**必须**以结构化注释头开始。缺失任一字段，`check-tla-model.ts` 退出码 1（反模式 #16）。

```tla
(*
  @system        所属系统名称
  @requirement   关联需求 ID（逗号分隔）
  @design        关联设计文档相对路径
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

## tla-manifest.json

行为层事实源。S 子代理产出 .tla 后同步更新此文件；G 子代理跑 `check-tla-model.ts` 校验。

```json
{
  "version": 1,
  "project": "<project-id>",
  "currentPhase": 1,
  "tools": { "jarPath": "w-model-dev/tools/tla2tools.jar", "javaMinVersion": 11 },
  "specs": [{
    "id": "L1-blog-system",
    "level": "L1",
    "phase": 1,
    "system": "blog-system",
    "requirementIds": ["REQ-001"],
    "designRef": "docs/requirement-spec.md#§3",
    "tlaPath": "tla/L1-blog-system.tla",
    "cfgPath": "tla/L1-blog-system.cfg",
    "parent": null,
    "siblings": [],
    "children": ["tla/L2-auth.tla"],
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

## 校验脚本

```bash
npx tsx w-model-dev/scripts/check-tla-model.ts <tla-manifest.json> [--phase=1|2|3|4|5|6|7|8] [--spec=<id>] [--skip-tlc] [--graph=<graph.json>]
```

退出码 `0=通过 / 1=失败 / 2=输入错误`。stdout 末尾输出 `TLA_JSON {...}` 供 Agent 解析。

### 参数

| 参数 | 说明 |
|---|---|
| `--phase=N` | 只校验 `phase ≤ N` 的规格 |
| `--spec=<id>` | 只校验单个规格（调试用） |
| `--skip-tlc` | 只跑文件头 + 层次 + SANY 语法检查，跳过 TLC（阶段门放行前不可跳过） |
| `--graph=<graph.json>` | 提供结构层图谱，提取 `type=SD` 节点供 SD 覆盖率校验（见 §10）；未提供时跳过覆盖率校验 |

### 校验步骤（G 子代理执行）

1. **环境检查**：Java ≥ 11、jar 存在。
2. **文件头校验**：8 个 `@` 字段齐全且与 manifest 一致。
3. **层次一致性**：parent/child/sibling 双向、单 L1 根、层级单调。
4. **拆解决策**：组合数 >1w 必须 `split-done`。
5. **清理轨迹**：删除 `*.dump` / `*.out` / `states/`（硬约束，先清后跑）。
   - 实测 TLC 2.19 产物：`states/<YY-MM-DD-HH-MM-SS>/` 子目录下含 `<Module>.st` / `<Module>-0.st`（状态文件）+ `<Module>_0.fp` / `<Module>_1.fp`（指纹文件）。默认不产生 `.dump` / `.out`，但保留清理作为预防。
6. **SANY 语法检查**（cwd 置为 `.tla` 所在目录）：
   ```
   java -cp <jarPath> tla2sany.SANY <module>.tla
   ```
   实测退出码：**0=成功 / 11=语法错误**；输出走 stdout（含 `Fatal errors while parsing` 等错误消息）。
7. **TLC 模型检查**（仅 SANY 通过且未 `--skip-tlc` 时；cwd 置为 `.tla` 所在目录）：
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

> **编码调试顺序（硬约束）**：先清轨迹 → SANY 语法通过 → 才允许跑 TLC。违反命中反模式 #14。
> **.cfg 模式选择**：`SPECIFICATION Spec` 使用 `[Next]_vars` 带 stuttering，可避免终态被误报为死锁；`INIT Init` + `NEXT Next` 不带 stuttering，终态会触发死锁。建模时通常用 `SPECIFICATION Spec`，仅在刻意要检测终态死锁时才用 `INIT/NEXT`。

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
  S 产出设计文档 + TLA+ 规格    ──┤── 两条门禁均须通过才放行
  V 评审                        ──┤
  G 跑 check-verifier-output.ts  ──┤
  G 跑 check-requirement-graph.ts ─┤  （静态结构）
  G 跑 check-tla-model.ts       ──┘  （动态行为）
  CHECKPOINT 阶段门放行
```

图谱门禁管静态结构（节点/边/连通/信息流），TLA+ 门禁管动态行为（状态机/不变式/死锁）。两者正交，一个规格可结构完整却仍有死锁。

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
npx tsx w-model-dev/scripts/check-tla-model.ts <tla-manifest.json> --graph=<graph.json> [--phase=N] [--spec=<id>] [--skip-tlc]
```

- `--graph=<graph.json>`：提供结构层图谱，提取 SD 节点供覆盖率校验。未提供时跳过覆盖率校验。
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
