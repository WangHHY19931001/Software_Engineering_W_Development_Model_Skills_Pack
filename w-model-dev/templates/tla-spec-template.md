# TLA+ 规格模板（TLA+ Spec Template）

> 本模板定义 `.tla` 文件与 `.cfg` 文件的标准结构。S 子代理产出 TLA+ 规格时套用本模板。
> 权威设计见 [docs/tla-plus-modeling-design.md](../../docs/tla-plus-modeling-design.md)；可执行细则见 [references/tla-plus-guide.md](../references/tla-plus-guide.md)。

## .tla 文件模板

> 文件名：`<L级别>-<系统名>.tla`（如 `L1-blog-system.tla`、`L2-auth-subsystem.tla`）。
> MODULE 名须与文件名一致（不含 `.tla` 后缀）。

```tla
(*
  @system        <所属系统名称，如 blog-system 或 blog-system::auth-subsystem>
  @requirement   <关联需求 ID，逗号分隔，如 REQ-001, REQ-003>
  @design        <关联设计文档相对路径，如 docs/system-design.md#§3.2>
  @parent        <上级 TLA 文件相对路径；L1 填 null>
  @sibling       <同级 TLA 文件相对路径，逗号分隔；无填 null>
  @child         <下级 TLA 文件相对路径，逗号分隔；叶子填 null>
  @level         <L1 / L2 / L3 / L4 ...>
  @phase         <产出阶段 1-8>
*)
---- MODULE <ModuleName> ----
EXTENDS Naturals, Sequences, TLC

(* ==================== 常量 ==================== *)
CONSTANTS
    (* 声明常量，在 .cfg 中赋值 *)

(* ==================== 变量 ==================== *)
VARIABLES
    (* 声明状态变量 *)

(* ==================== 状态不变式（TypeInvariant） ==================== *)
TypeInvariant ==
    /\ <每个变量的类型约束>

(* ==================== 业务不变式 ==================== *)
(* 刻画系统在所有可达状态下须满足的性质 *)
<InvariantName> ==
    /\ <不变式谓词>

(* ==================== 初始状态 ==================== *)
Init ==
    /\ <变量初始值约束>

(* ==================== 状态转移（Next） ==================== *)
(* 不接受占位实现（Next=[]）/ 简化实现（遗漏需求关键状态）/ 错误实现（与设计矛盾） *)
Next ==
    \/ <转移分支 1>
    \/ <转移分支 2>
    \/ <转移分支 n>

(* ==================== 规范 ==================== *)
Spec == Init /\ [][Next]_<<vars>>

(* ==================== 拆解决策（variableCombination > 1000 时必填） ==================== *)
(* 变量组合数 = 各变量取值域笛卡尔积
   ≤ 1000        : kept-below-threshold（无需说明）
   1001–10000    : consider-split（须在此声明保留理由）
   > 10000       : must-split → 拆解后改 split-done
*)
================
```

## .cfg 文件模板

> 文件名须与对应 `.tla` 文件一致（如 `L1-blog-system.cfg`）。

```cfg
SPECIFICATION Spec
INVARIANT
    TypeInvariant
    <InvariantName1>
    <InvariantName2>

(* 常量赋值 *)
CONSTANTS
    <Const1> = <Value1>
    <Const2> = <Value2>

(* 可选：状态空间限制（缓解状态爆炸） *)
(* VIEW viewFunc *)
```

### `.cfg` 模式选择（实测 2026-07-23）

| 模式 | 写法 | 行为 | 适用场景 |
|---|---|---|---|
| `SPECIFICATION Spec` | `Spec == Init /\ [][Next]_<<vars>>` | `[Next]_vars` 带 stuttering，变量无 Next 转移时保持不变，**不会因终态触发死锁** | 常规建模（默认） |
| `INIT` + `NEXT` | `INIT Init` + `NEXT Next` | 不带 stuttering，Next 为 false 的状态若无可达转移即被 TLC 判定死锁 | 刻意检测终态死锁（如验证「必须永远前进」的活性约束） |

> **推荐**：建模时通常用 `SPECIFICATION Spec`，避免终态被误报为死锁。仅在刻意要检测终态死锁时才用 `INIT` + `NEXT`。

## 文件头字段说明

| 字段 | 必填 | 说明 |
|---|---|---|
| `@system` | 是 | 所属系统名称，层次路径用 `::` 分隔（如 `blog-system::auth-subsystem::token-store`） |
| `@requirement` | 是 | 关联需求 ID（逗号分隔），须与 `rtm.json` 需求 ID 一致 |
| `@design` | 是 | 关联设计文档相对路径（可带锚点 `#§`） |
| `@parent` | 是 | 上级 TLA 文件相对路径；L1 根规格填 `null` |
| `@sibling` | 是 | 同级 TLA 文件相对路径（逗号分隔）；无同级填 `null` |
| `@child` | 是 | 下级 TLA 文件相对路径（逗号分隔）；叶子规格填 `null` |
| `@level` | 是 | 层级标识：`L1` / `L2` / `L3` / `L4` ... |
| `@phase` | 是 | 产出该规格的 W 模型阶段（1-8） |

## 层级示例

### L1 根规格（@parent=null）

```tla
(*
  @system        blog-system
  @requirement   REQ-001, REQ-002, REQ-003
  @design        docs/requirement-spec.md#§3
  @parent        null
  @sibling       null
  @child         tla/L2-auth-subsystem.tla, tla/L2-article-subsystem.tla
  @level         L1
  @phase         1
*)
---- MODULE L1-blog-system ----
```

### L2 子规格（@child 非空）

```tla
(*
  @system        blog-system::auth-subsystem
  @requirement   REQ-001
  @design        docs/system-design.md#§3.2
  @parent        tla/L1-blog-system.tla
  @sibling       tla/L2-article-subsystem.tla
  @child         tla/L3-token-store.tla
  @level         L2
  @phase         2
*)
---- MODULE L2-auth-subsystem ----
```

### L3 叶子规格（@child=null）

```tla
(*
  @system        blog-system::auth-subsystem::token-store
  @requirement   REQ-001
  @design        docs/detailed-design.md#§4.1.2
  @parent        tla/L2-auth-subsystem.tla
  @sibling       null
  @child         null
  @level         L3
  @phase         4
*)
---- MODULE L3-token-store ----
```

## 双向一致性校验

`check-tla-model.ts` 校验 parent/child/sibling 双向引用：

- `A.@child` 含 `B` → `B.@parent` 须等于 `A` 的路径。
- `A.@sibling` 含 `B` → `B.@sibling` 须含 `A`。
- 层级单调：`B.level = A.level + 1`（B 是 A 的 child）。

违反双向一致性 → `check-tla-model.ts` 退出码 1（层次违反）。

## 编码调试顺序（硬约束）

1. **清理轨迹**：`check-tla-model.ts` 自动删除 `*.dump` / `*.out` / `states/`（实测 TLC 2.19 轨迹落在 `states/<YY-MM-DD-HH-MM-SS>/` 下，含 `.st` 状态文件与 `.fp` 指纹文件）。
2. **SANY 语法检查**：`java -cp <jarPath> tla2sany.SANY <module>.tla`（cwd 置为 `.tla` 所在目录）。实测退出码 **0=成功 / 11=语法错误**；输出走 stdout。
3. **TLC 模型检查**：语法通过后才允许跑 TLC。语法未通过即跑 TLC → 反模式 #14。
   - 命令：`java -cp <jarPath> tlc2.TLC -nowarning -cleanup -config <spec>.cfg <moduleName>`（cwd 置为 `.tla` 所在目录）。
   - 实测退出码：**0=成功 / 11=死锁 / 12=不变式违反**。
   - 成功输出特征：`Model checking completed. No error has been found.`

> 不接受占位实现 / 简化实现 / 错误实现（反模式 #16）。
> 建模须符合需求和设计；符合后仍有问题须修正需求/设计并回退重跑（反模式 #17）。
