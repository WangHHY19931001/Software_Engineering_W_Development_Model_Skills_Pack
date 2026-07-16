# W-Model Skill 增强路线图

> 基于 SkillOpt（微软，arXiv:2605.23904）、MetaSkill-Evolve（arXiv:2607.05297）、Skill-MAS（arXiv:2606.18837）、SkillX、SkillCoach（arXiv:2607.01874）、AdaRubric（arXiv:2603.21362）、SkillGenBench（arXiv:2605.18693）等研究的差距分析与增强方案。
>
> 本文件为后续逐步处理的索引，每项推进时独立开 spec → plan → implementation。

## 当前项目基线

已有能力（代码锚点）：

- logits 期望值连续评分 + fallback：[src/core/scoring-engine.ts](../src/core/scoring-engine.ts)
- 三维度验证（粒度/重复/分解）：[src/core/verification-framework.ts](../src/core/verification-framework.ts)
- 阶段门 verifyRequirement/Design/TestCase + PPT 排序：[src/core/w-model-enhancer.ts](../src/core/w-model-enhancer.ts)
- 类型与配置：[src/types/index.ts](../src/types/index.ts)
- 技能编排（SKILL.md + references/templates）：[w-model-dev/SKILL.md](../w-model-dev/SKILL.md)
- 119 个测试覆盖基线

## 差距矩阵

| # | 差距 | 现状代码 | 研究对照 |
|---|---|---|---|
| G1 | 技能静态、无进化环 | SKILL.md 与 references 手写后冻结 | SkillOpt Rollout→Reflect→Edit→Gate |
| G2 | 验证 rubric 硬编码 | w-model-enhancer.ts 各 verify* 的 subCriteria 固定 | AdaRubric 任务自适应 + DimensionAwareFilter |
| G3 | 仅结果评估、无过程评估 | verifyRequirement/Design/TestCase 只评产物 | SkillCoach 四维过程 rubric |
| G4 | 无 meta-skill 层 | 验证配置（权重/重复次数/聚合）写死 | MetaSkill-Evolve 双时间尺度递归 |
| G5 | 单体技能、无层次/检索 | references 整文件按需加载 | SkillX 三层 + 轻量检索 |
| G6 | 可靠性无部署级量化 | verification-framework.ts 仅方差→confidence | AdaRubric Krippendorff's α 门控 |

## 增强项（按优先级）

### P0 — 自适应 Rubric + 可靠性门控（对应 G2 / G6）

**目标**：把验证从"硬编码 rubric + 方差置信度"升级为"任务自适应 rubric + 部署级可靠性门"。

**要点**：
- 新增 `RubricGenerator`：输入任务描述，由 LLM 生成 N 个正交维度 + 5 级评分标准 + 权重，复用现有 `LLMVerifierEngine`。
- 在 `verification-framework.ts` 的 `computeConfidence` 旁加 `computeKrippendorffAlpha`：对同一产物多次重复评估的标注做 α 计算，α≥0.80 作为部署门。
- 加 `DimensionAwareFilter`：某维度低于阈值时，即使加权总分高也降级 qualityLevel，防维度级失败被掩盖。
- 扩 `types/index.ts` 的 `SubCriterion` 加 `taskAdaptive: boolean` 与 `minThreshold`。

**落点**：`src/core/verification-framework.ts`、`src/core/w-model-enhancer.ts`、`src/core/rubric-generator.ts`（新）、`src/types/index.ts`。

**风险/约束**：现有 119 个测试依赖硬编码 subCriteria，需保持向后兼容（默认 fallback）。

**状态**：待 spec（本轮 brainstorming 处理）。

---

### P1 — 过程级验证层（对应 G3，SkillCoach 思路）

**目标**：从"只验产物好不好"扩展到"验技能有没有被正确执行"，过程分与结果分分离。

**四维**：
- skill selection：是否加载正确 `references/phase-N-*.md`（对照阶段对应表）
- skill following：是否同步产出对应测试设计（并行原则，SKILL.md 核心约束 1）
- skill composition：RTM 是否同步更新（rtm-manager.ts 已有数据可查）
- skill-grounded reflection：自检是否对照阶段指引的验收标准

**落点**：新增 `src/core/process-verifier.ts`；阶段门评审时与现有结果验证并行。

**价值**：为 P2 进化环提供更细粒度训练信号，避免"偶然通过"被当正样本。

**状态**：待处理（P0 完成后）。

---

### P2 — SkillOpt 式技能进化环（对应 G1，核心增强）

**目标**：把 `w-model-dev/references/` 视为可训练状态，新增 `SkillEvolver` 实现闭环进化。

**核心循环**：
- Rollout：复用现有 8 阶段流程跑批，捕获轨迹（命令调用、verify 结果、RTM 覆盖、返工记录）
- Reflect：用 `VerificationFramework` 对成功/失败 minibatch 分别反思
- Edit：对 reference md 提交 add/delete/replace 补丁，受编辑预算（token delta）约束（SkillOpt 核心差异，防整体重写）
- Gate：在留出任务集上用 P0 的自适应 rubric 评分，仅当提升才 commit，否则进拒绝缓冲区
- Slow update + meta：保留被拒补丁，跨 epoch 喂回 proposer

**落点**：新增 `src/core/skill-evolver.ts`；`project-state.ts` 扩展 `skillHistory` 字段。

**依赖**：P0（自适应 rubric 与门控为 Gate 提供信号）、P1（过程信号更细）。

**状态**：待处理。

---

### P3 — Meta-skill 双时间尺度（对应 G4，最雄心）

**目标**：把验证过程本身参数化进可进化 meta-skill $m=(\psi,\sigma,\alpha,\pi,\varepsilon)$，参数化 Analyzer/Retriever/Allocator/Proposer/Evolver，对自身递归应用同一进化管线。

**机制**：任务技能（references）快循环，meta-skill（VerifierConfig + subCriteria 模板）慢循环。

**落点**：基于 P2 的 `SkillEvolver` 递归升级。

**依赖**：P2 稳定后推进。

**状态**：待处理（远期）。

---

### P4 — 三层技能库 + 检索（对应 G5，SkillX 思路）

**目标**：将 `references/` 的 8 个 phase 文档拆为战略计划 / 功能技能 / 原子技能三层，加轻量检索，按阶段 + 任务关键词注入相关原子技能，控 token 预算，提升跨模型迁移性（SkillOpt transfer 结论：紧凑+验证过的技能才迁移得好）。

**落点**：重构 `w-model-dev/references/` 结构 + 新增检索模块。

**状态**：待处理（远期）。

---

## 推进顺序

P0（立即、低风险、为后续提供信号）→ P1（过程信号）→ P2（进化环核心）→ P3（递归升级）→ P4（结构重构）。

## 研究来源

- SkillOpt: http://microsoft.github.io/SkillOpt/ ｜ arXiv:2605.23904
- SkillOpt-Lite: arXiv:2607.03451
- MetaSkill-Evolve: arXiv:2607.05297
- Skill-MAS: arXiv:2606.18837
- SkillX: OpenReview 091ziax0aV
- SkillCoach: arXiv:2607.01874
- AdaRubric: arXiv:2603.21362
- SkillGenBench: arXiv:2605.18693
