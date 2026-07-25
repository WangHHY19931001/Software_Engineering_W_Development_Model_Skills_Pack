# 第 11 轮外部技能吸收：claude-tla-plus-plugin 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 吸收 claude-tla-plus-plugin 的 4 份 skill 资料与 review 命令语义，以"阶段内强化 + 纯文档"方式融入 W 模型 TLA+ 子流程。

**Architecture:** 新建 4 份 TLA+ 参考文件（syntax/patterns/tlc/review），修订 SSoT/tla-plus-guide/verifier-spec/SKILL/CHANGELOG 共 5 份既有文档。不新增脚本、不新增约束、不新增子流程。加载矩阵确保按需加载。

**Tech Stack:** Markdown 文档；TLA+ 语法；W 模型 8 阶段流程。

**Spec:** [`docs/superpowers/specs/2026-07-26-tla-plus-plugin-absorption-design.md`](../specs/2026-07-26-tla-plus-plugin-absorption-design.md)

---

## Task 1: SSoT 新增 §3.4.9

**Files:**
- Modify: `docs/skill-design-document_SSoT.md`（在 §3.4.8 之后新增 §3.4.9）

- [ ] **Step 1: 定位 §3.4.8 起始行**

Run（PowerShell，用 Grep 工具）：
- pattern: `^#### 3\.4\.8`
- path: `docs/skill-design-document_SSoT.md`
- Expected: 输出 `449:#### 3.4.8 第 10 轮外部技能吸收约束（2026-07-26）`

- [ ] **Step 2: 定位 §3.4.8 结束位置（下一个 `####` 或 `###` 标题）**

用 Grep 工具搜索 `^#### 3\.4\.9|^### 3\.5|^## 4`，确认 §3.4.8 之后第一个标题位置。

- [ ] **Step 3: 在 §3.4.8 之后插入 §3.4.9**

使用 Edit 工具，old_string 用 §3.4.8 末尾的独特文本 + 下一个标题行，new_string 在中间插入：

```markdown
#### 3.4.9 第 11 轮外部技能吸收（2026-07-26）

> 吸收 `claude-tla-plus-plugin` 的 4 份 skill 资料与 review 命令语义，以"阶段内强化 + 纯文档"方式融入 TLA+ 子流程。不新增脚本、不新增子流程、不新增约束。

**吸收内容**：
- 新建 4 份 TLA+ 参考文件：`tla-plus-syntax-reference.md` / `tla-plus-patterns-examples.md` / `tla-plus-tlc-configuration.md` / `tla-plus-review-checklist.md`
- 修订 `tla-plus-guide.md` 新增 §13 索引节 + S-tla/V-tla 加载矩阵
- 修订 `verifier-spec.md` §7.2 补「TLA+ 审查参考清单」引用（不新增 targetKind 枚举值）
- 修订 `SKILL.md` 阶段路由表 TLA+ 行补参考文件引用

**加载矩阵**（遵循约束 #6「按需加载」）：

| 角色/阶段 | 必读 | 按场景 |
|---|---|---|
| S-tla 阶段 1（L1） | syntax-reference | patterns §KV |
| S-tla 阶段 2-3（L2/L3） | syntax-reference | patterns §Bakery/Producer-Consumer + tlc-configuration |
| S-tla 阶段 4（L3/L4） | syntax-reference | patterns §Consensus/Two-Phase Commit + tlc-configuration |
| V-tla 全阶段 | review-checklist | syntax-reference |

**不新增约束的依据**：现有反模式 #15-17（TLA+ 占位/简化/错误实现、建模不符合需求设计）已覆盖吸收内容的合规边界。4 份参考文件是参考资料，不是新约束。

详见 `w-model-dev/references/tla-plus-guide.md` §13。
```

- [ ] **Step 4: 验证插入成功**

用 Grep 工具搜索 `^#### 3\.4\.9`，Expected: 输出 1 行。

- [ ] **Step 5: 跑 self-test 基线**

Run: `npm run self-test`
Expected: 91/91 通过

- [ ] **Step 6: Commit**

```bash
git add docs/skill-design-document_SSoT.md
git commit -m "docs(ssot): add §3.4.9 round 11 tla-plus-plugin absorption"
```

---

## Task 2: 新建 tla-plus-syntax-reference.md

**Files:**
- Create: `w-model-dev/references/tla-plus-syntax-reference.md`

- [ ] **Step 1: 创建文件并写入头部 + 适配说明**

使用 Write 工具创建文件，内容结构：

```markdown
# TLA+ 语法参考

> **来源**：吸收自 [`claude-tla-plus-plugin`](https://github.com/andrueandersoncs/claude-tla-plus-plugin) `skills/tla-plus-generator/syntax-reference.md`（第 11 轮外部技能吸收）
> **W 模型约束**：模块名须遵循 [tla-plus-guide.md §2.0 命名规范](./tla-plus-guide.md)（PascalCase，禁止连字符）；文件头须遵循 [§文件头规范](./tla-plus-guide.md)
> **加载时机**：S-tla 子代理产出 TLA+ 规格时必读；V-tla 子代理审查时按场景加载

## 模块结构

\`\`\`tla
---- MODULE ModuleName ----
(* 多行注释用 (* *) *)
\* 单行注释以 \* 开头
EXTENDS Module1, Module2   \* 导入标准模块
CONSTANTS Const1, Const2   \* 声明常量
VARIABLES var1, var2       \* 声明变量
ASSUME Const1 \in Nat      \* 常量假设
\* 定义和算子
====
\`\`\`

**W 模型适配**：模块名须为 PascalCase（如 `KeyValueStore`），禁止连字符（如 `key-value-store` 非法）。
```

- [ ] **Step 2: 写入标准模块节**

完整复制来源文件的「Standard Modules」节（Naturals/Integers/Reals/Sequences/FiniteSets/Bags/TLC），保留所有 \`\`\`tla 代码块原样。

- [ ] **Step 3: 写入算子与表达式节**

完整复制「Operators and Expressions」节（Boolean/Set/Function/Record/Tuple Operators + Quantifiers + CHOOSE + LET-IN + Lambda）。

- [ ] **Step 4: 写入时序逻辑算子节**

完整复制「Temporal Logic Operators」节（State Formulas vs Actions + Temporal Operators + Specification Pattern）。

- [ ] **Step 5: 写入动作与状态变化节**

完整复制「Actions and State Changes」节（Action Composition + ENABLED）。

- [ ] **Step 6: 写入算子定义节**

完整复制「Operator Definitions」节（Constant/Higher-Order/Local Definitions）。

- [ ] **Step 7: 写入模块系统节**

完整复制「Module System」节（EXTENDS/INSTANCE/LOCAL/THEOREM）。

- [ ] **Step 8: 写入 PlusCal 节**

完整复制「PlusCal」节（Basic Structure + Constructs + Fairness）。

- [ ] **Step 9: 文件末尾补 W 模型交叉引用**

```markdown

## W 模型交叉引用

- [命名规范](./tla-plus-guide.md)（§2.0）：模块名 PascalCase
- [文件头规范](./tla-plus-guide.md)：@level/@sd/@parent/@sibling/@child
- [cfg-tla 一致性规则](./tla-plus-guide.md)（§11）：.cfg 与 .tla 对齐
- [模式示例](./tla-plus-patterns-examples.md)：8 个典型示例
- [TLC 配置](./tla-plus-tlc-configuration.md)：.cfg 文件指南
```

- [ ] **Step 10: 跑 self-test 基线**

Run: `npm run self-test`
Expected: 91/91 通过

- [ ] **Step 11: Commit**

```bash
git add w-model-dev/references/tla-plus-syntax-reference.md
git commit -m "docs(tla): add syntax-reference (round 11 absorption)"
```

---

## Task 3: 新建 tla-plus-patterns-examples.md

**Files:**
- Create: `w-model-dev/references/tla-plus-patterns-examples.md`

- [ ] **Step 1: 创建文件并写入头部**

使用 Write 工具：

```markdown
# TLA+ 模式与示例

> **来源**：吸收自 [`claude-tla-plus-plugin`](https://github.com/andrueandersoncs/claude-tla-plus-plugin) `skills/tla-plus-generator/patterns-examples.md`（第 11 轮外部技能吸收）
> **W 模型适配**：每个示例补文件头注释（@level/@sd/@parent/@sibling/@child），占位符标注「示例，实际使用时由 S-tla 子代理回填」
> **加载时机**：S-tla 子代理按 SD 子系统类型选模板时按场景加载（见加载矩阵）

## 示例索引

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
```

- [ ] **Step 2: 写入 Example 1 Key-Value Store**

从来源文件（已保存在 `C:\Users\wangh\AppData\Local\Temp\trae\toolcall-output\1433ccb3-a7f3-4a44-91ff-5245ab3e36f8.txt`）提取完整 KV Store .tla 代码块，在 MODULE 行前补文件头：

```tla
------------------------------- MODULE KeyValueStore -------------------------------
\* @level L2
\* @sd SD-kv-store（示例占位，实际使用时由 S-tla 子代理回填）
\* @parent REQ-kv-store
\* @sibling SD-tx-manager
\* @child DD-kv-get, DD-kv-put
\* 来源：吸收自 claude-tla-plus-plugin patterns-examples.md（第 11 轮）
EXTENDS Naturals, Sequences, FiniteSets, TLC
\* ...（完整原 .tla 内容）
```

- [ ] **Step 3-8: 依次写入 Example 2-8**

每个示例补对应文件头（@level 按索引表：Bakery=L3、Producer-Consumer=L3、Echo=L2、Elevator=L3、Cigarette Smokers=L3、Consensus=L2、Two-Phase Commit=L2），@sd/@parent/@sibling/@child 用示例占位符。原 .tla 内容从来源文件完整复制。

- [ ] **Step 9: 文件末尾补 W 模型交叉引用**

```markdown

## W 模型交叉引用

- [命名规范](./tla-plus-guide.md)（§2.0）：模块名 PascalCase
- [文件头规范](./tla-plus-guide.md)：@level/@sd/@parent/@sibling/@child
- [SD 覆盖率规则](./tla-plus-guide.md)（§3/§10）：每个 SD-xxx 至少 1 个 spec 覆盖
- [语法参考](./tla-plus-syntax-reference.md)：TLA+ 完整语法
- [TLC 配置](./tla-plus-tlc-configuration.md)：.cfg 文件指南
```

- [ ] **Step 10: 跑 self-test 基线**

Run: `npm run self-test`
Expected: 91/91 通过

- [ ] **Step 11: Commit**

```bash
git add w-model-dev/references/tla-plus-patterns-examples.md
git commit -m "docs(tla): add patterns-examples with 8 examples (round 11)"
```

---

## Task 4: 新建 tla-plus-tlc-configuration.md

**Files:**
- Create: `w-model-dev/references/tla-plus-tlc-configuration.md`

- [ ] **Step 1: 创建文件并写入头部 + W 模型适配说明**

使用 Write 工具：

```markdown
# TLC 模型检查器配置指南

> **来源**：吸收自 [`claude-tla-plus-plugin`](https://github.com/andrueandersoncs/claude-tla-plus-plugin) `skills/tla-plus-generator/tlc-configuration.md`（第 11 轮外部技能吸收）
> **W 模型适配**：.cfg 文件须遵循 [tla-plus-guide.md §11 cfg-tla 一致性规则](./tla-plus-guide.md) 与 [§12 cfg 结构规则](./tla-plus-guide.md)；.cfg 不得含 MODULE 声明；须包含 .tla 中所有不变式
> **加载时机**：S-tla 子代理产出 .cfg 时必读；V-tla 子代理审查 .cfg 时按场景加载

## 配置文件格式（.cfg）

\`\`\`cfg
\* 注释以 \* 开头
\* 指定规范公式
SPECIFICATION Spec
\* 或者用 Init/Next 风格
INIT Init
NEXT Next

\* 常量 - 字面值
CONSTANTS
    NumProcesses = 3
    MaxValue = 10

\* 常量 - 模型值（未解释）
CONSTANTS
    Procs = {p1, p2, p3}

\* 不变式（安全属性）
INVARIANTS
    TypeInvariant
    Safety

\* 属性（可含活性）
PROPERTIES
    Liveness
    Termination

\* 对称性优化
SYMMETRY
    Permutations(Procs)

\* 状态约束
CONSTRAINT
    StateConstraint

\* 动作约束
ACTION_CONSTRAINT
    ActionConstraint

\* 死锁检查（默认 true）
CHECK_DEADLOCK TRUE

\* 别名（用于 trace 探索）
ALIAS
    Alias
\`\`\`

**W 模型约束**（§12 cfg 结构规则）：.cfg 不得含 `MODULE` 声明；`INVARIANTS` 须列出 .tla 中所有不变式。
```

- [ ] **Step 2: 写入完整配置示例节**

完整复制来源文件「Complete Configuration Examples」节（6 个示例：KV Store/Bakery/Elevator/Consensus/Two-Phase Commit/Producer-Consumer）。

- [ ] **Step 3: 写入配置选项详解节**

完整复制「Configuration Options Explained」节（SPECIFICATION vs INIT/NEXT + Model Values vs Ordinary Values + Symmetry + State Constraints + Action Constraints）。

- [ ] **Step 4: 写入 TLC 命令行选项节**

完整复制「TLC Command Line Options」节 + 「Common TLC Options」表。

- [ ] **Step 5: 写入最佳实践节**

完整复制「Best Practices」节（Start Small / Use Symmetry / Add State Constraints / Separate Safety and Liveness / Use ALIAS for Debugging）。

- [ ] **Step 6: 写入故障排查节 + W 模型交叉引用**

```markdown
## 故障排查

完整复制来源文件「Troubleshooting」节（CHOOSE 错误 / 状态爆炸 / 活性检查慢 / 不变式违反无 trace）。

## W 模型交叉引用

- [cfg-tla 一致性规则](./tla-plus-guide.md)（§11）：.cfg 与 .tla 对齐
- [cfg 结构规则](./tla-plus-guide.md)（§12）：.cfg 不得含 MODULE 声明
- [前置清单](./tla-plus-guide.md)（§2.2）：跑 TLC 前删除 states/
- [语法参考](./tla-plus-syntax-reference.md)：TLA+ 完整语法
- [模式示例](./tla-plus-patterns-examples.md)：8 个典型示例
```

- [ ] **Step 7: 跑 self-test 基线**

Run: `npm run self-test`
Expected: 91/91 通过

- [ ] **Step 8: Commit**

```bash
git add w-model-dev/references/tla-plus-tlc-configuration.md
git commit -m "docs(tla): add tlc-configuration guide (round 11 absorption)"
```

---

## Task 5: 新建 tla-plus-review-checklist.md

**Files:**
- Create: `w-model-dev/references/tla-plus-review-checklist.md`

- [ ] **Step 1: 创建文件并写入头部 + V-tla 产出契约说明**

使用 Write 工具：

```markdown
# TLA+ 审查参考清单

> **来源**：吸收自 [`claude-tla-plus-plugin`](https://github.com/andrueandersoncs/claude-tla-plus-plugin) `commands/review.md`（第 11 轮外部技能吸收）
> **W 模型适配**：不新增 `targetKind=tla`（违反第 9 轮 P2.5 的 4 值枚举约束）。V-tla 子代理评审 TLA+ 时仍用 `targetKind=design`，本清单作为 §7.2「设计」的参考资料
> **加载时机**：V-tla 子代理审查 TLA+ 规格时必读

## 7 项审查清单

### 1. 结构与风格（Structure and Style）

- 模块头是否含文档说明
- 常量/变量/算子是否清晰分离
- 命名约定是否一致（W 模型：PascalCase 模块名）
- 是否有充分注释说明意图

**W 模型增强**：文件头须含 @level/@sd/@parent/@sibling/@child 注解（见 [tla-plus-guide.md §文件头规范](./tla-plus-guide.md)）。

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

**W 模型增强**：.cfg 须遵循 [§11 cfg-tla 一致性规则](./tla-plus-guide.md) + [§12 cfg 结构规则](./tla-plus-guide.md)。

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
```

- [ ] **Step 2: 写入 5 维度映射节**

```markdown

## 与 verifier-spec.md 5 维度的映射

V-tla 子代理产出 VerifierOutput JSON 时，本清单 7 项按以下映射归入 5 维度（不修改 5 维度定义，仅作参考）：

| 本清单项 | verifier-spec.md 维度 |
|---|---|
| 1 结构与风格 / 2 正确性 / 3 类型安全 | correctness |
| 4 属性 | coverage（不变式/活性覆盖） |
| 5 模型检查 | priority-reasonableness（cfg 配置合理性） |
| 6 常见问题 | independence（独立缺陷识别） |
| 7 输出 | clarity |

详见 [verifier-spec.md §7.2 设计（targetKind = `design`）](./verifier-spec.md)。
```

- [ ] **Step 3: 写入 W 模型交叉引用**

```markdown

## W 模型交叉引用

- [反模式 #15-17](./anti-patterns.md)：TLA+ 占位/简化/错误实现、建模不符合需求设计
- [tla-plus-guide.md](./tla-plus-guide.md)：TLA+ 流程约束（命名/路径/前置/校验/契约）
- [语法参考](./tla-plus-syntax-reference.md)：TLA+ 完整语法
- [模式示例](./tla-plus-patterns-examples.md)：8 个典型示例
- [TLC 配置](./tla-plus-tlc-configuration.md)：.cfg 文件指南
```

- [ ] **Step 4: 跑 self-test 基线**

Run: `npm run self-test`
Expected: 91/91 通过

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/references/tla-plus-review-checklist.md
git commit -m "docs(tla): add review-checklist for V-tla (round 11 absorption)"
```

---

## Task 6: tla-plus-guide.md 新增 §13

**Files:**
- Modify: `w-model-dev/references/tla-plus-guide.md`（在 §12 之后追加 §13）

- [ ] **Step 1: 确认 §12 是最后一节**

用 Grep 工具搜索 `^## ` 在 tla-plus-guide.md 中的所有匹配，确认 §12（行 475）是最后一个 `##` 节。

- [ ] **Step 2: 在文件末尾追加 §13**

使用 Edit 工具，old_string 用文件末尾的独特文本（§12 节的最后几行），new_string 追加 §13：

```markdown

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
```

- [ ] **Step 3: 验证插入成功**

用 Grep 工具搜索 `^## 13\.`，Expected: 输出 1 行。

- [ ] **Step 4: 跑 self-test 基线**

Run: `npm run self-test`
Expected: 91/91 通过

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/references/tla-plus-guide.md
git commit -m "docs(tla): add §13 reference index + loading matrix (round 11)"
```

---

## Task 7: verifier-spec.md §7.2 补 TLA+ 审查参考清单引用

**Files:**
- Modify: `w-model-dev/references/verifier-spec.md`（§7.2 节，行 421-431）

- [ ] **Step 1: 定位 §7.2 节**

用 Grep 工具搜索 `^### 7\.2 设计`，Expected: 输出 `421:### 7.2 设计（targetKind = ` + 反引号 + `design` + 反引号 + `）`

- [ ] **Step 2: 在 §7.2 节末尾（行 431「权重和 = 1.00。」之后）插入引用**

使用 Edit 工具，old_string:
```
权重和 = 1.00。

### 7.3 测试用例（targetKind = `testcase`）
```

new_string:
```
权重和 = 1.00。

**TLA+ 审查参考清单**（第 11 轮外部技能吸收）：评审 `targetKind=design` 且产物为 TLA+ 规格（.tla/.cfg）时，V-tla 子代理须额外参考 [tla-plus-review-checklist.md](./tla-plus-review-checklist.md) 的 7 项清单。该清单与上述 5 维度的映射见 review-checklist 文档「与 verifier-spec.md 5 维度的映射」节。不新增 targetKind 枚举值（仍为 `design`）。

### 7.3 测试用例（targetKind = `testcase`）
```

- [ ] **Step 3: 验证插入成功**

用 Grep 工具搜索 `TLA\+ 审查参考清单`，Expected: 输出 1 行。

- [ ] **Step 4: 跑 self-test 基线**

Run: `npm run self-test`
Expected: 91/91 通过

- [ ] **Step 5: Commit**

```bash
git add w-model-dev/references/verifier-spec.md
git commit -m "docs(verifier): §7.2 add TLA+ review checklist reference (round 11)"
```

---

## Task 8: SKILL.md 同步（路由表 + 快速自检）

**Files:**
- Modify: `w-model-dev/SKILL.md`

- [ ] **Step 1: 在快速自检「上下文窗口已清理」条目后追加 TLA+ 按需加载条目**

使用 Edit 工具，old_string:
```
- [ ] **上下文窗口已清理**（第 10 轮外部技能吸收）：阶段切换时 S 子代理是新会话，不继承前阶段上下文（OpenSpec context hygiene）

交互样例按需读取
```

new_string:
```
- [ ] **上下文窗口已清理**（第 10 轮外部技能吸收）：阶段切换时 S 子代理是新会话，不继承前阶段上下文（OpenSpec context hygiene）
- [ ] **TLA+ 资料按需加载**（第 11 轮外部技能吸收）：S-tla/V-tla 子代理按 [tla-plus-guide.md §13 加载矩阵](references/tla-plus-guide.md) 加载 4 份参考文件，禁止一次加载全部

交互样例按需读取
```

- [ ] **Step 2: 验证插入成功**

用 Grep 工具搜索 `TLA\+ 资料按需加载`，Expected: 输出 1 行。

- [ ] **Step 3: 跑 self-test 基线**

Run: `npm run self-test`
Expected: 91/91 通过

- [ ] **Step 4: Commit**

```bash
git add w-model-dev/SKILL.md
git commit -m "docs(skill): sync self-check with TLA+ on-demand loading (round 11)"
```

---

## Task 9: CHANGELOG.md 新增 [11.0.0] 条目

**Files:**
- Modify: `CHANGELOG.md`（在 [10.0.0] 之前插入 [11.0.0]）

- [ ] **Step 1: 定位 [10.0.0] 起始行**

用 Grep 工具搜索 `^## \[10\.0\.0\]`，Expected: 输出 1 行。

- [ ] **Step 2: 在 [10.0.0] 之前插入 [11.0.0]**

使用 Edit 工具，old_string:
```
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [10.0.0] - 2026-07-26
```

new_string:
```
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [11.0.0] - 2026-07-26

### 第 11 轮外部技能吸收（claude-tla-plus-plugin）

以"阶段内强化 + 纯文档"方式吸收 `claude-tla-plus-plugin` 的 4 份 skill 资料与 review 命令语义，不新增脚本、不新增子流程、不新增约束。

#### 新增

- **tla-plus-syntax-reference.md**：TLA+ 完整语法参考（模块/算子/时序逻辑/PlusCal），适配 §2.0 命名规范
- **tla-plus-patterns-examples.md**：8 个典型示例（KV/Bakery/Producer-Consumer/Echo/Elevator/Cigarette Smokers/Consensus/Two-Phase Commit），每个补 W 模型文件头
- **tla-plus-tlc-configuration.md**：TLC .cfg 配置指南，适配 §11 cfg-tla 一致性规则 + §12 cfg 结构规则
- **tla-plus-review-checklist.md**：V-tla 审查 7 项清单（吸收 review 命令），映射到 verifier-spec.md 5 维度
- **SSoT §3.4.9**：第 11 轮外部技能吸收小节（纯描述性，含加载矩阵）
- **tla-plus-guide.md §13**：参考资料索引 + S-tla/V-tla 加载矩阵

#### 变更

- verifier-spec.md §7.2「设计（targetKind = `design`）」补「TLA+ 审查参考清单」引用（不新增 targetKind 枚举值）
- SKILL.md 快速自检补「TLA+ 资料按需加载」条目

#### 不变（明确边界）

- 11 个 `scripts/check-*.ts` 脚本不变
- self-test 基线 91 条不变
- vitest 测试套件不变
- `tla-plus-guide.md` §1-§12 不变（仅新增 §13）
- TLA+ 层级模型 L1/L2/L3/L4 不变
- 反模式 #15-17 不变
- 失败模式 F1-F10 不变
- verifier-spec.md 4 targetKind 枚举不变（requirement/design/test/file）+ rootcause 独立校验
- data-models.md 不变
- subagent-delegation.md O-S-V-G-R 边界不变

#### 验证

- TypeScript strict 0 错误
- self-test 91/91 全通过
- vitest 全通过
- 文档一致性人工检查：SSoT §3.4.9 / tla-plus-guide.md §13 / 4 份新参考文件 / verifier-spec.md §7.2 / SKILL.md 自检 / CHANGELOG [11.0.0] 互引一致

## [10.0.0] - 2026-07-26
```

- [ ] **Step 3: 跑 self-test 基线**

Run: `npm run self-test`
Expected: 91/91 通过

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): add [11.0.0] tla-plus-plugin absorption entry"
```

---

## Task 10: 最终验证

**Files:**
- 无文件改动，仅验证

- [ ] **Step 1: TypeScript strict 检查**

Run: `npx tsc --noEmit -p w-model-dev`
Expected: 0 错误

- [ ] **Step 2: self-test 基线**

Run: `npm run self-test`
Expected: 91/91 通过

- [ ] **Step 3: vitest 测试套件**

Run: `cd w-model-dev ; npx vitest run scripts/__tests__/`
Expected: 全通过

- [ ] **Step 4: 文档一致性 grep 验证**

并行 Grep 验证（每项 Expected: count ≥ 1）：
- SSoT: `^#### 3\.4\.9`
- tla-plus-guide.md: `^## 13\.`
- tla-plus-syntax-reference.md: `W 模型交叉引用`
- tla-plus-patterns-examples.md: `W 模型交叉引用`
- tla-plus-tlc-configuration.md: `W 模型交叉引用`
- tla-plus-review-checklist.md: `与 verifier-spec.md 5 维度的映射`
- verifier-spec.md: `TLA\+ 审查参考清单`
- SKILL.md: `TLA\+ 资料按需加载`
- CHANGELOG.md: `^## \[11\.0\.0\]`

- [ ] **Step 5: 互引一致性验证**

并行 Grep 验证：
- SSoT §3.4.9 引用 tla-plus-guide.md：搜索 `tla-plus-guide.md.*§13`，Expected: SSoT 中 ≥ 1
- tla-plus-guide.md §13 引用 4 份新文件：搜索 `tla-plus-syntax-reference|tla-plus-patterns-examples|tla-plus-tlc-configuration|tla-plus-review-checklist`，Expected: tla-plus-guide.md 中 ≥ 4
- 4 份新文件引用 tla-plus-guide.md：分别在 4 个文件中搜索 `tla-plus-guide.md`，Expected: 各 ≥ 1
- verifier-spec.md §7.2 引用 tla-plus-review-checklist.md：在 verifier-spec.md 中搜索 `tla-plus-review-checklist`，Expected: ≥ 1
- CHANGELOG [11.0.0] 引用 SSoT §3.4.9：在 CHANGELOG.md 中搜索 `§3\.4\.9`，Expected: ≥ 1

- [ ] **Step 6: git status 确认 clean**

Run: `git status`
Expected: working tree clean

- [ ] **Step 7: 推送到远端**

Run: `git push origin main`
Expected: 推送成功

---

## Self-Review 检查

**1. Spec coverage**：
- §3.4.9 → Task 1 ✅
- tla-plus-guide.md §13 → Task 6 ✅
- 4 份新参考文件 → Task 2/3/4/5 ✅
- verifier-spec.md §7.2 → Task 7 ✅
- SKILL.md 同步 → Task 8 ✅
- CHANGELOG [11.0.0] → Task 9 ✅
- 验证 → Task 10 ✅

**2. Placeholder scan**：无 TBD/TODO/「similar to」/「add appropriate」等占位符。所有步骤含具体 grep 命令或 Edit old/new string。

**3. Type consistency**：文件名一致（tla-plus-syntax-reference / tla-plus-patterns-examples / tla-plus-tlc-configuration / tla-plus-review-checklist）；SSoT §3.4.9 / tla-plus-guide.md §13 / CHANGELOG [11.0.0] 引用一致；targetKind 不新增枚举值（仍为 design）一致。

**4. 顺序依赖**：Task 1（SSoT §3.4.9）→ Task 2-5（4 份新文件，可并行）→ Task 6（tla-plus-guide.md §13 引用新文件）→ Task 7（verifier-spec.md 引用 review-checklist）→ Task 8（SKILL.md）→ Task 9（CHANGELOG）→ Task 10（最终验证）。Task 6 须在 Task 2-5 之后（§13 引用新文件）；Task 7 须在 Task 5 之后（§7.2 引用 review-checklist）。
