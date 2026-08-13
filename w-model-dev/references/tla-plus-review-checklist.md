# TLA+ 审查参考清单

> **来源**：吸收自 [`claude-tla-plus-plugin`](https://github.com/andrueandersoncs/claude-tla-plus-plugin) `commands/review.md`
> **W 模型适配**：不新增 `targetKind=tla`（违反 P2.5 的 4 值枚举约束）。V-tla 子代理评审 TLA+ 时仍用 `targetKind=design`，本清单作为 §7.2「设计」的参考资料
> **加载时机**：V-tla 子代理审查 TLA+ 规格时必读

## 7 项审查清单

### 1. 结构与风格（Structure and Style）

- 模块头是否含文档说明
- 常量/变量/算子是否清晰分离
- 命名约定是否一致（W 模型：PascalCase 模块名）
- 是否有充分注释说明意图

**W 模型增强**：文件头须含 8 字段结构化注释头 @system/@requirement/@design/@parent/@sibling/@child/@level/@phase（见 [tla-plus-guide.md §文件头规范](./tla-plus-guide.md)）。

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

## W 模型交叉引用

- [反模式 #15-17](./anti-patterns.md)：TLA+ 占位/简化/错误实现、建模不符合需求设计
- [tla-plus-guide.md](./tla-plus-guide.md)：TLA+ 流程约束（命名/路径/前置/校验/契约）
- [语法参考](./tla-plus-syntax-reference.md)：TLA+ 完整语法
- [模式示例](./tla-plus-patterns-examples.md)：8 个典型示例
- [TLC 配置](./tla-plus-tlc-configuration.md)：.cfg 文件指南
- [bdd-review-checklist.md](./bdd-review-checklist.md)：BDD features 审查参考清单（与 TLA+ 审查清单对称：TLA+ 用 `targetKind=design` + 本清单，BDD 用 `targetKind=test` + bdd-review-checklist.md；BDD↔TLA+ 等价性由 `check-bdd-model.ts` D4 维度守护）
