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
\* @designRef docs/system-design.md#§3.3 分类树无环约束
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
    "id": "L1_blog_system",
    "level": "L1",
    "phase": 1,
    "system": "blog-system",
    "requirementIds": ["REQ-001"],
    "designRef": "docs/requirement-spec.md#§3",
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
> **spec 级返工记录**：每条 checkRounds 元素对应一次 spec 的 TLA+ 校验轮次（`specId` 标识），**不是 phase 级摘要**。phase 级摘要应写在 `run-log.jsonl` 的 `note` 字段，phase 级决策列表应写在 `acknowledgedDecisions` 字段。第 15 轮调测发现子代理误把 phase 级摘要（含 `phaseSummary` / `summary` / `phaseDecisions` 字段）写入 checkRounds（共性问题 D），第 16 轮 R13 校验强制拦截。

**记录时机**：每轮 TLA+ 校验（SANY + TLC）完成后，由 G 子代理向 `checkRounds` 数组追加一条记录。

**单条记录字段**：

| 字段 | 类型 | 说明 |
|---|---|---|
| `phase` | number | 校验时所处阶段（1-8） |
| `round` | number | 本阶段内校验轮次序号（从 1 起） |
| `timestamp` | string | ISO 8601 时间戳 |
| `specId` | string | 校验的 spec id（如 `L1_blog_system`） |
| `syntaxCheck` | boolean | SANY 语法检查是否通过 |
| `tlcCheck` | boolean | TLC 模型检查是否通过（`--skip-tlc` 时填 `false` 并备注） |
| `violations` | string[] | 本轮违反详情列表（死锁 + 不变式违反 + 状态爆炸等合计，每条为具体违反描述，与 [tla-logic.ts](../scripts/tla-logic.ts) 类型定义一致；第 16 轮 P4.3 修正：原 `number` 类型与脚本不一致） |
| `converged` | boolean | 本轮是否零违反收敛（`violations.length === 0`） |

**单调递减规则**：同一 `specId` 跨轮 `violations.length` 应单调递减（每轮返工修复一部分违反）。若某轮 `violations.length` 不降反升 → 视为返工失败，编排者分派 S 子代理返工时须在 prompt 中明确「违反数上升」信号。

**与 run-log R3 交叉校验**：`checkRounds` 数组长度须与 `run-log.jsonl` 中该 spec 对应的 `action=tla-gate` 且 `outcome=rework` 记录数一致（`check-run-log.ts` R3 规则强制校验）。不一致 → `check-run-log.ts` 报 R3 违反。

**空值约定**：项目首次产出 TLA+ 规格前（未跑过任何校验轮次），`checkRounds` 填 `[]`。零返工一次性通过的项目，`checkRounds` 仅含一条 `converged=true` 记录。

### 禁止字段（phase 级摘要）

> checkRounds 元素为 **spec 级返工记录**，不得含 phase 级摘要字段。第 15 轮调测发现子代理误把 phase 级摘要写入 checkRounds（共性问题 D），第 16 轮 R13 校验强制拦截。违反 → `check-tla-model.ts` 退出码 1。

| 禁止字段 | 说明 | 应写入位置 |
|---|---|---|
| `phaseSummary` | phase 级摘要（如"本阶段所有 spec 一次性通过"） | `run-log.jsonl` 的 `note` 字段 |
| `summary` | phase 级摘要（同上，无前缀简写） | `run-log.jsonl` 的 `note` 字段 |
| `phaseDecisions` | phase 级决策列表 | `run-log.jsonl` 的 `acknowledgedDecisions` 字段 |
| `phaseLevelSummary` | phase 级总结 | `run-log.jsonl` 的 `note` 字段 |

R13 校验由 [`tla-logic.ts`](../scripts/tla-logic.ts) `checkRoundsSchema` 函数执行，命中禁止字段 → 报 `R13: checkRounds[i] 含禁止字段 <字段名>（phase 级摘要字段，checkRounds 为 spec 级返工记录）`。

## 校验脚本

```bash
npx tsx w-model-dev/scripts/check-tla-model.ts <tla-manifest.json> [--phase=1|2|3|4|5|6|7|8] [--spec=<id>] [--skip-tlc] [--graph=<graph.json>] [--keep-states]
```

退出码 `0=通过 / 1=失败 / 2=输入错误`。stdout 末尾输出 `TLA_JSON {...}` 供 Agent 解析。

### 参数

| 参数 | 说明 |
|---|---|
| `--phase=N` | 只校验 `phase ≤ N` 的规格 |
| `--spec=<id>` | 只校验单个规格（调试用） |
| `--skip-tlc` | 只跑文件头 + 层次 + SANY 语法检查，跳过 TLC（阶段门放行前不可跳过） |
| `--graph=<graph.json>` | 提供结构层图谱，提取 `type=SD` 节点供 SD 覆盖率校验（见 §10）；未提供时跳过覆盖率校验 |
| `--keep-states` / `-k` | **第 9 轮 P3.8**：保留 TLC `states/` 目录用于调试（默认校验后自动清理） |

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
9. **states 自动清理**（第 9 轮 P3.8，校验后）：见下方「TLA+ states 目录自动清理」节。

> **编码调试顺序（硬约束）**：先清轨迹 → SANY 语法通过 → 才允许跑 TLC。违反命中反模式 #14。
> **.cfg 模式选择**：`SPECIFICATION Spec` 使用 `[Next]_vars` 带 stuttering，可避免终态被误报为死锁；`INIT Init` + `NEXT Next` 不带 stuttering，终态会触发死锁。建模时通常用 `SPECIFICATION Spec`，仅在刻意要检测终态死锁时才用 `INIT/NEXT`。

### TLA+ states 目录自动清理（第 9 轮 P3.8）

> TLA+ 校验完成后必须清理 `<tla-dir>/states/` 目录，避免状态文件残留污染仓库。第 8 轮调测发现 demo 项目 `w-model-dev-demo/tla/states/` 累积 229 个残留文件（多轮 TLC 校验产物未清理），第 9 轮将其硬约束化为脚本默认行为。

**`check-tla-model.ts` 行为**（第 9 轮 P3.8 已实施）：

- **默认清理**：TLC 校验完成后自动清理所有已校验 spec 的 `states/` 子目录（每个 spec 独立清理）
  - 实现细节：脚本遍历 `manifest.specs[]`，对每个 spec 解析 `tlaPath` 所在目录，删除其下 `states/` 目录（含全部 `<YY-MM-DD-HH-MM-SS>/` 时间戳子目录及 `.st` / `.fp` 文件）
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

**校验**（第 9 轮 Part C 验收）：

- `check-tla-model.ts` 默认运行（无 `--keep-states`）后，`<tla-dir>/states/` 目录应不存在或为空
- `--keep-states` 运行后，`<tla-dir>/states/` 目录应保留，含 TLC 产物
- 第八轮 demo 残留 229 个文件由 Part C Task C2 集中清理，第 9 轮后不再产生新残留

> 与 `.gitignore` 的配合：项目应在 `.gitignore` 中排除 `tla/states/` 目录，避免 TLC 产物误提交。第 9 轮 Part A Task A7 已增加 `coverage/.tmp/` 排除规则，`tla/states/` 排除规则由项目自行维护（不同项目 `<tla-dir>` 路径不同，技能包不强制约定）。

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

## 13. 第 11 轮吸收的参考资料

> 第 11 轮外部技能吸收（2026-07-26）：吸收 `claude-tla-plus-plugin` 的 4 份 skill 资料与 review 命令语义。详见 SSoT §3.4.9。

### 13.1 参考资料索引

| # | 文件 | 用途 | 加载时机 |
|---|---|---|---|
| 1 | [tla-plus-syntax-reference.md](./tla-plus-syntax-reference.md) | TLA+ 完整语法 | S-tla 必读 |
| 2 | [tla-plus-patterns-examples.md](./tla-plus-patterns-examples.md) | 8 个典型示例 | S-tla 按场景 |
| 3 | [tla-plus-tlc-configuration.md](./tla-plus-tlc-configuration.md) | TLC .cfg 配置指南 | S-tla 产 .cfg 时必读 |
| 4 | [tla-plus-review-checklist.md](./tla-plus-review-checklist.md) | V-tla 审查 7 项清单 | V-tla 必读 |

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

## 14. L4 时间推进/保留期建模模式（第 13 轮 P4.1）

> S-tla 子代理在 L4 层级建模涉及"时间推进/保留期/过期清理"场景时的模式指引。第 12 轮 `L4_audit_log_retention` 靠 TLC 拦截才发现 `AdvanceTime` 越界（`oldestAge` 推至 `RETENTION_DAYS+1` 违反 `Retention90Days` 不变式），本节提供正反例与通用规则，降低 S-tla 子代理对 TLC 试错的依赖。

### 14.1 模式概述

时间推进动作（`AdvanceTime`/`Tick`）+ 保留期不变式（`Retention`/`Expiry`）是 L4 状态机常见模式：系统按时间推进，过期数据按保留期清理。

典型场景：
- 审计日志保留 N 天后清理（第 12 轮 `L4_audit_log_retention`，CON-004 要求 90 天）
- Token 过期清理（`L4_auth_token_lifecycle`）
- 密码重置 Token 生命周期（`L4_password_reset_token_lifecycle`）
- 限流器令牌桶补充（`L4_rate_limiter_token_bucket`）

### 14.2 反例（第 12 轮 L4_audit_log_retention 错误实现）

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

### 14.3 正例（第 12 轮修正后实现）

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

