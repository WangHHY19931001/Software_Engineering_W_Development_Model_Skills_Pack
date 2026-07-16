# P0 — 自适应 Rubric + 可靠性门控 设计

- **日期**：2026-07-16
- **状态**：已确认，待写实现计划
- **范围**：W-Model AI Assistant Skill 的验证层增强（对应差距 G2 / G6）
- **研究依据**：AdaRubric（arXiv:2603.21362）、SkillCoach（arXiv:2607.01874）、SkillOpt（arXiv:2605.23904）
- **路线图索引**：[docs/enhancement-roadmap.md](../../enhancement-roadmap.md)

## 1. 背景与动机

当前验证层存在两个差距：

- **G2 rubric 硬编码**：[w-model-enhancer.ts](../../../src/core/w-model-enhancer.ts) 的 `verifyRequirement` / `verifyDesign` / `verifyTestCaseQuality` 各自把 subCriteria（维度、权重、scoringPrompt）写死，无法按任务特点调整。AdaRubric 表明固定 rubric 在 agent 任务上人类相关性仅 r≈0.46，任务自适应可提升至 r≈0.77。
- **G6 可靠性无部署级量化**：[verification-framework.ts](../../../src/core/verification-framework.ts) 的 `computeConfidence` 仅基于评分方差的变异系数，不是部署级可靠性指标。AdaRubric 提倡 Krippendorff's α ≥ 0.80 作为部署门。

P0 目标：把验证从"硬编码 rubric + 方差置信度"升级为"任务自适应 rubric + 部署级可靠性门"，同时为 P2 进化环的 Gate 提供更可靠的留出集信号。

## 2. 范围与非目标

**范围内**：
- 按 Requirement / Design / TestCase 三类生成自适应 rubric
- 基于重复评估的 Krippendorff's α 计算
- DimensionAwareFilter 防止维度级失败被掩盖
- 向后兼容（自适应默认关闭）

**非目标（YAGNI，留给后续）**：
- 实例级 rubric（按每个任务实例生成，含关键词 overlay）
- 真正的多编码者 α（多模型或多 rubric）
- 硬门强制阻断流程（仅提供软标记 + 可配置硬门）
- rubric 自身的进化（属于 P3 meta-skill 范畴）

## 3. 方案选型

| 方案 | 描述 | 取舍 |
|---|---|---|
| A 全替换 | 自适应 rubric 完全取代硬编码 | 最纯粹，但 119 个测试全受影响、回归风险高、强依赖 LLM 可用 |
| B 纯新增 | RubricGenerator + α 独立模块，不接 verify* | 零回归，但自适应无法接入阶段门，形同摆设 |
| **C 双模式叠加（选定）** | 硬编码保留为 fallback；`VerifierConfig.rubric.adaptive` 开关启用自适应；α 与 DimensionAwareFilter 作为后处理 | 低回归、与现有三维度框架正交、为 P2 Gate 提供信号 |

## 4. 默认决策

| 决策项 | 取值 | 理由 |
|---|---|---|
| 自适应粒度 | 按类型（Requirement/Design/TestCase） | 改动可控、与现有 verify* 一一对应、成本低 |
| 向后兼容 | 自适应默认**关闭**，硬编码为 fallback | 现有 119 测试零改动 |
| α 口径 | 复用 `repeatedEvaluation` 的 N 次 run 作为 N 个"编码者"做 ordinal α（单模型代理） | 无需额外 LLM 调用；注明局限，真·多编码者留 P3 |
| 门控行为 | 默认**软标记**（写 `deploymentGate` 字段），不抛错 | 保护现有测试；阈值可配置为硬门 |
| 缓存 | 按 `(type, taskDescriptionHash)` 缓存 rubric | 避免重复生成、降低成本 |
| 维度数 | 默认 5（与现有硬编码一致） | 平衡覆盖与 token 成本 |
| α 阈值 | 默认 0.80（AdaRubric 部署级标准） | 与研究对齐 |
| 维度 minThreshold | 默认 equiv=8（低于 acceptable 下限 10） | 严格于整体阈值，突出维度级失败 |

## 5. 架构与组件

### 5.1 新增组件

**`RubricGenerator`**（新文件 `src/core/rubric-generator.ts`）
- 职责：输入 `(type, taskDescription)`，输出 `SubCriterion[]`
- 实现：复用 `LLMVerifierEngine` 调用 LLM 生成 N 个正交维度，每个含 `id`、`description`、`scoringPrompt`、`weight`（归一化到 1）、`minThreshold`、`levelDescriptors`（5 级）
- 缓存：内存 Map，key = `${type}:${hash(taskDescription)}`
- 失败回退：LLM 失败或解析失败 → 返回硬编码 subCriteria + `rubricFallback=true`
- 依赖：`LLMClient`、`VerifierConfig.rubric`

**可靠性计算**（挂入 `VerificationFramework`）
- 新增方法 `computeKrippendorffAlpha(ordinalLabels: number[][])`：ordinal α，输入为 `[run][dim]` 的序数标签
- 公式：$\alpha = 1 - \frac{D_o}{D_e}$，其中 $D_o$ 为观测不一致量、$D_e$ 为期望不一致量
- N<2 时返回 `null`（无法计算）

**`DimensionAwareFilter`**（挂入 `VerificationFramework`）
- 后处理：检查每个维度 equiv 分是否 < 其 `minThreshold`
- 任一违规 → qualityLevel 上限钳制为 `'poor'`，并在 `dimensionFlags` 标记违规维度
- 无 minThreshold 的维度跳过（向后兼容硬编码 subCriteria）

### 5.2 修改的组件

**[src/types/index.ts](../../../src/types/index.ts)**
- `SubCriterion` 增可选字段：`taskAdaptive?: boolean`、`minThreshold?: number`、`levelDescriptors?: string[]`
- `VerificationResult` 增可选字段：`reliability?: { alpha: number | null; coders: number }`、`deploymentGate?: 'pass' | 'review' | 'fail'`、`dimensionFlags?: { id: string; violated: boolean }[]`、`rubricFallback?: boolean`
- `VerifierConfig` 增可选字段：`rubric?: { adaptive: boolean; dimensions: number; alphaThreshold: number; minThresholdDefault: number; hardGate: boolean; cache: boolean }`

**[src/core/verification-framework.ts](../../../src/core/verification-framework.ts)**
- `verifyWithThreeDimensions` 内联收集每次 run 的 ordinal labels
- 流程末尾追加：`computeKrippendorffAlpha` → `reliability`；`DimensionAwareFilter` → 调整 `qualityLevel` + `dimensionFlags`；据 α 与 flags 决定 `deploymentGate`
- 返回对象保留原字段，新字段全部可选（兼容）

**[src/core/w-model-enhancer.ts](../../../src/core/w-model-enhancer.ts)**
- 三个 `verify*` 方法签名增可选 `taskDescription?: string`
- adaptive 开启时：向 `RubricGenerator` 取 `SubCriterion[]`，失败回退硬编码
- adaptive 关闭时：完全走原硬编码路径（行为不变）

## 6. 数据流

```
verify*(artifact, taskDescription?)
  ├ adaptive?
  │   ├ yes → RubricGenerator.generate(type, taskDescription) [cached]
  │   │        ├ 成功 → SubCriterion[]（taskAdaptive=true）
  │   │        └ 失败 → 硬编码 subCriteria + rubricFallback=true
  │   └ no  → 硬编码 subCriteria（原路径）
  → VerificationFramework.verifyWithThreeDimensions
      ├ per dim: N runs (existing) → aggregate (existing)
      └ 收集 ordinal labels[run][dim]
  → post: computeKrippendorffAlpha(labels) → reliability
  → post: DimensionAwareFilter(subScores, minThreshold) → 调整 qualityLevel + dimensionFlags
  → deploymentGate（按下方真值表，硬门模式将 'review' 升级为 'fail'）
  → VerificationResult(扩展字段，原字段保留)
```

**deploymentGate 真值表**（α₀ = alphaThreshold，dimOK = 无维度违规）：

| α 状态 | dimOK | 软门 gate | 硬门 gate |
|---|---|---|---|
| α ≥ α₀ | 是 | `pass` | `pass` |
| α ≥ α₀ | 否 | `review` | `fail` |
| α < α₀ 或 α=null | 是 | `review` | `fail` |
| α < α₀ 或 α=null | 否 | `review` | `fail` |

即：维度违规或 α 不达标任一发生即降级为 `review`（硬门 `fail`）；两者都通过才 `pass`。

## 7. 错误处理

| 场景 | 行为 |
|---|---|
| RubricGenerator LLM 调用失败 | 回退硬编码 subCriteria + `rubricFallback=true`，不中断验证 |
| RubricGenerator 输出解析失败 | 同上 |
| α 无定义（N<2，即 repeatedEvaluation.times<2） | `reliability={alpha:null, coders:N}`、`gate='review'` |
| 软门模式 gate='fail' | 仅写 `deploymentGate='fail'`，不抛错 |
| 硬门模式（`hardGate:true`）gate='fail' | 抛 `ReliabilityGateError`，可被上层捕获 |
| DimensionAwareFilter 触发但所有维度无 minThreshold | 等价于不触发（向后兼容硬编码） |

## 8. 测试策略

**新增测试**：
- `tests/rubric-generator.test.ts`：
  - MockLLMClient 生成维度、解析成功
  - 缓存命中（相同 taskDescription 不重复调用）
  - LLM 失败回退硬编码 + `rubricFallback=true`
  - 权重归一化验证
- `tests/verification-framework.test.ts` 扩展：
  - α 已知夹具：完全一致 → α=1；完全分歧 → α≈0
  - N<2 退化：`reliability.alpha=null`、`gate='review'`
  - DimensionAwareFilter：某维度 < minThreshold → qualityLevel 钳制为 'poor' + flag 标记
  - DimensionAwareFilter：无 minThreshold 时不动 qualityLevel
  - 软门 vs 硬门行为
- `tests/w-model-enhancer.test.ts` 扩展：
  - adaptive 关闭时行为不变（回归保护）
  - adaptive 开启 + taskDescription → 走 RubricGenerator
  - adaptive 开启 + LLM 失败 → 回退硬编码 + rubricFallback=true

**回归保护**：现有 119 测试在 adaptive 默认关闭下全部不受影响。

**集成测试**：adaptive 开启端到端（Mock），验证 `reliability` / `dimensionFlags` / `deploymentGate` 字段完整。

## 9. 集成点与文件清单

| 文件 | 改动类型 |
|---|---|
| `src/core/rubric-generator.ts` | 新增 |
| `src/core/verification-framework.ts` | 修改：加 α 计算 + DimensionAwareFilter + ordinal labels 收集 |
| `src/core/w-model-enhancer.ts` | 修改：三 verify* 接 taskDescription + adaptive 分支 |
| `src/types/index.ts` | 修改：扩展 SubCriterion / VerificationResult / VerifierConfig |
| `tests/rubric-generator.test.ts` | 新增 |
| `tests/verification-framework.test.ts` | 扩展 |
| `tests/w-model-enhancer.test.ts` | 扩展 |

## 10. 成功标准

1. adaptive 关闭时，现有 119 测试全部通过，行为零变化。
2. adaptive 开启 + Mock LLM 时，`verify*` 返回 `reliability`、`dimensionFlags`、`deploymentGate` 字段。
3. α 计算在完全一致夹具上 =1、完全分歧夹具上 ≈0。
4. DimensionAwareFilter 在维度低于 minThreshold 时将 qualityLevel 钳制为 'poor'。
5. RubricGenerator 失败时回退硬编码并置 `rubricFallback=true`。
6. 缓存命中时不再调用 LLM。

## 11. 风险与缓解

| 风险 | 缓解 |
|---|---|
| LLM 生成的 rubric 质量参差 | 失败回退硬编码；维度数固定 5；权重归一化 |
| 单模型 α 不能真反映多编码者可靠性 | spec 明确标注为代理指标；真·多编码者留 P3 |
| 硬门误伤正常流程 | 默认软标记；hardGate 需显式开启 |
| 缓存膨胀 | 内存 Map，进程级；暂不做 LRU（YAGNI） |

## 12. 后续衔接

- P1（过程级验证）将复用 `reliability` / `dimensionFlags` 作为更细训练信号
- P2（SkillOpt 进化环）的 Gate 将直接消费 `deploymentGate` 决定技能补丁是否 commit
- P3（meta-skill）将把 `VerifierConfig.rubric` 本身作为可进化对象
