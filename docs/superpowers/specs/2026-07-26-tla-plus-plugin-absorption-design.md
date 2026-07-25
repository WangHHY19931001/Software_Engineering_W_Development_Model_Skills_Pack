# 第 11 轮外部技能吸收：claude-tla-plus-plugin

> **设计日期**：2026-07-26
> **来源**：[`andrueandersoncs/claude-tla-plus-plugin`](https://github.com/andrueandersoncs/claude-tla-plus-plugin)
> **吸收方式**：阶段内强化 + 纯文档（与第 10 轮同构）
> **SSoT 对应**：§3.4.9（新增）

## 1. 背景与动机

W 模型 `tla-plus-guide.md` 已有 17 节流程约束（命名/路径/前置/校验/契约/SD 覆盖率/cfg 一致性等），但**缺少**：

- TLA+ 语法参考（S-tla 子代理产出时需查阅）
- 模式示例库（S-tla 子代理按 SD 子系统类型选模板）
- TLC 配置指南（S-tla 子代理产出 .cfg 时需查阅）
- TLA+ 审查清单（V-tla 子代理审查时需结构化维度）

`claude-tla-plus-plugin` 恰好提供这 4 份资料（`syntax-reference.md` / `patterns-examples.md` / `tlc-configuration.md` / `review.md`）+ 6 个斜杠命令语义。吸收后可补齐 W 模型 TLA+ 子流程的"参考资料层"。

## 2. 吸收边界

### 2.1 吸收的内容

| 来源文件 | 吸收去向 | 改造点 |
|---|---|---|
| `skills/tla-plus-generator/SKILL.md` | tla-plus-guide.md §13 索引 + S-tla 加载矩阵 | 仅取"何时使用"语义，不引入触发词 |
| `skills/tla-plus-generator/syntax-reference.md` | `tla-plus-syntax-reference.md`（新建） | 适配 W 模型 §2.0 命名规范（PascalCase 模块名） |
| `skills/tla-plus-generator/patterns-examples.md` | `tla-plus-patterns-examples.md`（新建） | 8 个示例每个补 W 模型文件头（@level/@sd/@parent/@sibling/@child） |
| `skills/tla-plus-generator/tlc-configuration.md` | `tla-plus-tlc-configuration.md`（新建） | 适配 W 模型 §11 cfg-tla 一致性规则、§12 cfg 结构规则 |
| `commands/review.md` | `tla-plus-review-checklist.md`（新建）+ verifier-spec.md 修订 | 7 项清单转化为 V-tla 产出契约，映射到 5 维度 |
| `commands/{spec,pluscal,invariant,liveness,config}.md` | 仅语义融入上述文件 | 不引入斜杠命令（W 模型用 `/wm` 路由） |

### 2.2 不吸收的内容

- `.claude-plugin/plugin.json`（Claude Code 插件清单，与 W 模型无关）
- `examples/` 子模块（100+ 示例，体积过大；8 个精选示例已覆盖典型场景）
- 6 个斜杠命令的命令行接口（W 模型用 `/wm` 路由，不引入 `/tla-plus:*`）

### 2.3 不新增的约束

- 不新增硬约束（SSoT §3.4.9 纯描述性）
- 不新增反模式（现有 #15-17 已覆盖 TLA+ 合规边界）
- 不新增失败模式（F1-F10 不变）
- 不新增脚本（`check-tla-model.ts` 不变，4 份参考文件是纯文档）
- 不新增子流程（S-tla/V-tla 分派时序不变）

## 3. 总体架构与改动清单

| # | 文件 | 改动类型 | 改动内容摘要 |
|---|---|---|---|
| 1 | `docs/skill-design-document_SSoT.md` | 修订 | 新增 §3.4.9「第 11 轮外部技能吸收」小节（纯描述性） |
| 2 | `w-model-dev/references/tla-plus-guide.md` | 修订 | 新增 §13「第 11 轮吸收的参考资料」索引节 + S-tla/V-tla 加载矩阵 |
| 3 | `w-model-dev/references/tla-plus-syntax-reference.md` | 新建 | 吸收 syntax-reference.md，适配 §2.0 命名规范 |
| 4 | `w-model-dev/references/tla-plus-patterns-examples.md` | 新建 | 吸收 8 个示例，每个补 W 模型文件头 |
| 5 | `w-model-dev/references/tla-plus-tlc-configuration.md` | 新建 | 吸收 tlc-configuration.md，适配 §11/§12 |
| 6 | `w-model-dev/references/tla-plus-review-checklist.md` | 新建 | 吸收 review.md 7 项清单，转化为 V-tla 产出契约 |
| 7 | `w-model-dev/references/verifier-spec.md` | 修订 | §8 VerifierOutput 补 `targetKind=tla` 审查维度映射 |
| 8 | `w-model-dev/SKILL.md` | 修订 | 阶段路由表 TLA+ 行补参考文件引用 + 快速自检补「按需加载 TLA+ 资料」 |
| 9 | `CHANGELOG.md` | 修订 | 新增 [11.0.0] 条目 |

## 4. 关键设计决策

### 4.1 文件命名

4 份新参考文件用 `tla-plus-` 前缀（与 `tla-plus-guide.md` 对称），便于 S-tla/V-tla 子代理按需发现。

### 4.2 加载矩阵（写入 tla-plus-guide.md §13，遵循约束 #6「按需加载」）

| 角色/阶段 | 必读 | 按场景 |
|---|---|---|
| S-tla 阶段 1（L1） | syntax-reference | patterns §KV |
| S-tla 阶段 2-3（L2/L3） | syntax-reference | patterns §Bakery/Producer-Consumer + tlc-configuration |
| S-tla 阶段 4（L3/L4） | syntax-reference | patterns §Consensus/Two-Phase Commit + tlc-configuration |
| V-tla 全阶段 | review-checklist | syntax-reference |

### 4.3 示例适配

8 个示例（KV/Bakery/Producer-Consumer/Echo/Elevator/Cigarette Smokers/Consensus/Two-Phase Commit）每个补 W 模型文件头注释：

```tla
------------------------------- MODULE KeyValueStore -------------------------------
\* @level L2
\* @sd SD-kv-store
\* @parent REQ-kv-store
\* @sibling SD-tx-manager
\* @child DD-kv-get, DD-kv-put
\* 来源：吸收自 claude-tla-plus-plugin patterns-examples.md（第 11 轮）
EXTENDS Naturals, Sequences, FiniteSets, TLC
...
```

示例原 .tla 内容保持不变（仅补文件头）。

### 4.4 审查清单转化（review.md 7 项 → verifier-spec.md 5 维度）

| review.md 清单项 | verifier-spec.md 维度 |
|---|---|
| Structure / Correctness / Type Safety | correctness |
| Properties | coverage（不变式/活性覆盖） |
| Model Checking | priority-reasonableness（cfg 配置合理性） |
| Common Issues | independence（独立缺陷识别） |
| Output | clarity |

### 4.5 不新增约束的依据

SSoT §3.4.9 纯描述性，不新增硬约束。现有反模式 #15-17（TLA+ 占位/简化/错误实现、建模不符合需求设计）已覆盖吸收内容的合规边界：4 份参考文件是参考资料，不是新约束；S-tla 子代理参考示例时仍须遵循 §2.0 命名规范、§文件头规范、§SD 覆盖率规则。

## 5. 明确边界（不变项）

- 11 个 `scripts/check-*.ts` 脚本不变
- self-test 基线 91 条不变
- vitest 测试套件不变
- `tla-plus-guide.md` §1-§12 不变（仅新增 §13）
- TLA+ 层级模型 L1/L2/L3/L4 不变
- 反模式 #15-17 不变
- 失败模式 F1-F10 不变
- verifier-spec.md 5 轴（correctness/coverage/independence/clarity/priority-reasonableness）+ 5 targetKind 不变
- data-models.md 不变
- subagent-delegation.md O-S-V-G-R 边界不变

## 6. 验证

- TypeScript strict 0 错误
- self-test 91/91
- vitest 全通过
- 文档一致性人工检查：
  - SSoT §3.4.9 引用 tla-plus-guide.md §13
  - tla-plus-guide.md §13 引用 4 份新参考文件
  - 4 份新参考文件引用 tla-plus-guide.md §2.0/§11/§12/§文件头规范
  - verifier-spec.md targetKind=tla 引用 tla-plus-review-checklist.md
  - SKILL.md 阶段路由表 TLA+ 行引用 4 份新参考文件
  - CHANGELOG [11.0.0] 引用 SSoT §3.4.9

## 7. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 4 份参考文件体积大，违反约束 #6「按需加载」 | 加载矩阵明确「必读 + 按场景」；S-tla/V-tla 只加载当前阶段所需 |
| 示例文件头 @sd 占位与实际 SD-xxx 不匹配 | 占位符明确标注「示例，实际使用时由 S-tla 子代理回填」 |
| review-checklist 与现有 verifier-spec.md 重复 | 仅补 targetKind=tla 的维度映射，不重复 5 轴定义 |
