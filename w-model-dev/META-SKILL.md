# Meta-Skill 可演化配置（元技能）

> 本文件定义 W-Model AI Assistant Skill 的**可训练外部状态**。
> 对应 SSoT 第 14 章「技能演化机制」与代码 `src/core/meta-skill-config.ts`。
>
> - 权威代码定义：[src/core/meta-skill-config.ts](../src/core/meta-skill-config.ts)（`DEFAULT_META_SKILL_CONFIG`）
> - 类型契约：[src/types/index.ts](../src/types/index.ts)（`MetaSkillConfig` / `MetaSkillPhaseConfig` / `MetaSubCriterion`）
> - 演化引擎：[src/evolution/skill-optimizer.ts](../src/evolution/skill-optimizer.ts)（SkillOpt ReflectTrainer）
> - 评估引擎：[src/eval/skill-lift.ts](../src/eval/skill-lift.ts)（ACES Skill Lift）

---

## 1. 为什么需要元技能

原 `WModelVerifierEnhancer` 的三个 `verify*` 方法把以下参数**硬编码在方法体内**：

- 子标准集合（`subCriteria`：id / description / scoringPrompt / weight）
- 重复评估次数（`times: 5`）
- 方差阈值（`varianceThreshold: 0.1`）

这违背了 MetaSkill-Evolve 的核心思想：**「改进流程本身」应当是第一类可优化对象**。把上述参数上提为 `MetaSkillConfig` 后：

1. `SkillOptimizer` 可读取并修改它（慢循环演化）
2. 人工审阅与版本管理（本文件与代码同源）
3. `SkillLiftEvaluator` 可评估演化是否带来正向 lift（验证门）

---

## 2. 可训练状态边界（Trainable vs Protected）

参照 SkillOpt 的 protected region 机制，技能状态分为两类：

### 2.1 可训练状态（Trainable）

| 文件 / 区域 | 可训练内容 | 演化方向 |
|---|---|---|
| `src/core/meta-skill-config.ts` | 子标准权重 / 评估次数 / 方差阈值 | 慢循环（元技能） |
| `w-model-dev/references/phase-*.md` | 阶段指引（程序性知识） | 快循环（任务技能） |
| `w-model-dev/SKILL.md` 非保护章节 | 阶段流转说明 / 命令示例 | 快循环 |

### 2.2 受保护区域（Protected，不可编辑）

| 区域 | 原因 |
|---|---|
| `w-model-dev/SKILL.md` 第 2.1 节「核心约束」 | 并行原则 / 阶段门 / RTM 同步 / 质量门 / SSoT / 最小必要信息——W 模型的不可变骨架 |
| `src/types/index.ts` | 类型契约，修改会破坏编译 |
| `src/commands/router.ts` 命令注册表 | 命令接口契约 |
| `src/state/*` 持久化结构 | 数据兼容性 |

`SkillEvolutionConfig.protectedRegions` 在运行时强制此约束。

---

## 3. 默认配置（v0.1.0）

> 以下值与代码 `DEFAULT_META_SKILL_CONFIG` 完全同源。修改本文件**必须**同步修改代码。

### 3.1 评分范围

```
scoreRange: { min: 1, max: 20 }
```

对应 20 个字母标签 A-T，与 `LLMVerifierEngine` 的 logits / fallback 路径一致。

### 3.2 需求阶段（requirement）

| 子标准 ID | 描述 | 权重 |
|---|---|---|
| completeness | 需求描述完整性 | 0.25 |
| clarity | 验收标准清晰度 | 0.20 |
| consistency | 需求内部一致性 | 0.20 |
| traceability | 需求可追溯性 | 0.20 |
| feasibility | 技术可行性 | 0.15 |

- `repeatedTimes`: 5
- `varianceThreshold`: 0.1
- `aggregationMethod`: mean

### 3.3 设计阶段（design）

| 子标准 ID | 描述 | 权重 |
|---|---|---|
| arch-clarity | 架构设计清晰度 | 0.20 |
| interface-completeness | 接口定义完整性 | 0.20 |
| scalability | 可扩展性设计 | 0.15 |
| performance | 性能考虑 | 0.15 |
| security | 安全性设计 | 0.15 |
| testability | 可测试性 | 0.15 |

- `repeatedTimes`: 5
- `varianceThreshold`: 0.1
- `aggregationMethod`: mean

### 3.4 测试用例阶段（testCase）

| 子标准 ID | 描述 | 权重 |
|---|---|---|
| coverage | 覆盖完整性 | 0.25 |
| boundary-handling | 边界条件处理 | 0.20 |
| exception-handling | 异常场景覆盖 | 0.20 |
| clarity | 测试步骤清晰度 | 0.15 |
| maintainability | 可维护性 | 0.20 |

- `repeatedTimes`: 5
- `varianceThreshold`: 0.1
- `aggregationMethod`: mean

---

## 4. 演化流程（SkillOpt ReflectTrainer）

```
for epoch in 1..N:
  1. Rollout     —— 在训练集上跑 /wm 全流程，收集 RolloutEvidence
  2. Reflect     —— 分离成功 / 失败 minibatch，optimizer LLM 诊断失败子标准
  3. Edit        —— 产出 SkillEdit 列表（add/delete/replace），受 editBudget 约束
  4. Gate        —— 在留出集上测 Skill Lift，严格提升才接受候选
  5. Commit      —— 通过则 setMetaSkillConfig / 写回 references
```

### 4.1 文本学习率（editBudget）

每轮最大字符编辑预算，对应 SkillOpt 的「学习率」。建议：

- 元技能慢循环：`editBudget: 500`（仅改权重 / 阈值 / prompt 措辞）
- 任务技能快循环：`editBudget: 2000`（可改 references 整段）

### 4.2 验证门（Validation Gate）

**强制启用**。SkillsBench 实证发现：模型自生成技能平均 **-1.3pp**，必须搭配 Gate 才能采纳。

接受条件：候选在留出集上的 `meanSkillLift > 0`（严格正提升）。

---

## 5. 双时间尺度

| 循环 | 频率 | 对象 | 产物 |
|---|---|---|---|
| 快循环 | 每次 `/wm` 命令后 | `references/phase-*.md` | 阶段指引精炼 |
| 慢循环 | 每完成 N 个项目 | `META-SKILL.md` + `meta-skill-config.ts` | 子标准权重 / 评估次数调整 |

---

## 6. 评估对接

演化产物的有效性由 [src/eval/skill-lift.ts](../src/eval/skill-lift.ts) 评估，输出 `SkillEvalReport`：

- `meanSkillLift`：平均 Skill Lift（>0 才接受候选）
- `positiveLiftRate`：正向 lift 任务占比
- 三级评估（SkillLearnBench）：规格质量 / 轨迹对齐 / 任务结果

详见 SSoT 第 15 章「技能评估标准」。
