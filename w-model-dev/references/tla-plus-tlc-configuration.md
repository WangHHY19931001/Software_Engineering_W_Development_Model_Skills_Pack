# TLC 模型检查器配置指南（TLC Configuration Guide）

> **来源**：吸收自 [`claude-tla-plus-plugin`](https://github.com/andrueandersoncs/claude-tla-plus-plugin) `skills/tla-plus-generator/tlc-configuration.md`
> **W 模型适配**：.cfg 须遵循 [tla-plus-guide.md §11 cfg-tla 一致性规则](./tla-plus-guide.md) + [§12 cfg 结构规则](./tla-plus-guide.md)；不得含 `MODULE` 声明；`INVARIANTS` 须列出 .tla 中所有不变式（即 `BusinessInvariant == /\ Inv1 /\ Inv2 ...` 展开的全部子不变式）
> **加载时机**：S-tla 子代理产出 .cfg 时必读

TLC（Temporal Logic Checker）是 TLA+ 规格的模型检查器。本指南覆盖配置文件格式与最佳实践。

## 配置文件格式（.cfg）

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

- `.cfg` **不得**含 `---- MODULE <Name> ----` 声明（这是 `.tla` 头部语法，混入 `.cfg` 触发 TLC 解析错误；见 [tla-plus-guide.md §12 cfg 结构规则](./tla-plus-guide.md)）
- `INVARIANTS` 须列出 `.tla` 中所有不变式——即 `.tla` 中 `BusinessInvariant == /\ Inv1 /\ Inv2 ...` 展开的全部子不变式，集合须完全相等（见 [tla-plus-guide.md §11 cfg-tla 一致性规则](./tla-plus-guide.md)）
- 等价的逐行形式 `INVARIANT <Name>` 与 `INVARIANTS` 关键字后跟列表均合法，但不变式数量计数须与 `.tla` `BusinessInvariant` 展开数一致

## 完整配置示例

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

## 配置选项详解（Configuration Options Explained）

### SPECIFICATION vs INIT/NEXT

```cfg
\* Use SPECIFICATION for temporal formulas with fairness
SPECIFICATION Spec
\* Where Spec == Init /\ [][Next]_vars /\ Fairness

\* Use INIT/NEXT for simple safety checking
INIT Init
NEXT Next
```

> **W 模型提示**：`SPECIFICATION Spec` 使用 `[Next]_vars` 带 stuttering，可避免终态被误报为死锁；`INIT Init` + `NEXT Next` 不带 stuttering，终态会触发死锁。建模时通常用 `SPECIFICATION Spec`，仅在刻意要检测终态死锁时才用 `INIT/NEXT`（见 [tla-plus-guide.md §校验步骤](./tla-plus-guide.md)）。

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

## TLC 命令行选项（TLC Command Line Options）

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

> **W 模型提示**：W 模型 `check-tla-model.ts` 实际调用形式为 `java -cp <jarPath> tlc2.TLC -nowarning -cleanup -config <spec>.cfg <moduleName>`（cwd 置为 .tla 所在目录）。退出码：0=成功 / 11=死锁 / 12=不变式违反（见 [tla-plus-guide.md §校验步骤](./tla-plus-guide.md)）。

## 常见 TLC 选项（Common TLC Options）

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

## 最佳实践（Best Practices）

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

## 故障排查（Troubleshooting）

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

## W 模型交叉引用

- [tla-plus-guide.md §11 cfg-tla 一致性规则](./tla-plus-guide.md) — `.cfg` `INVARIANTS` 须与 `.tla` `BusinessInvariant` 展开集合完全相等
- [tla-plus-guide.md §12 cfg 结构规则](./tla-plus-guide.md) — `.cfg` 禁止 `MODULE` 声明、`INVARIANT` 行格式、不变式数量计数
- [tla-plus-guide.md §2.2 前置清单](./tla-plus-guide.md) — S 子代理产出 `.tla` 前 3 项必做（含 `.cfg` INVARIANTS 一致）
- [tla-plus-syntax-reference.md](./tla-plus-syntax-reference.md) — TLA+ 语法参考（S-tla 产 `.tla` 时查阅）
- [tla-plus-patterns-examples.md](./tla-plus-patterns-examples.md) — 8 个模式示例（按 SD 子系统类型选模板）
- [tla-plus-review-checklist.md](./tla-plus-review-checklist.md) — V-tla 审查清单（含第 5 项「模型检查」覆盖 .cfg 检查维度）
