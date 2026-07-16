# 变更日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 新增（基于设计→实现审查报告的全面修正）

> 本次修正以 SSoT 设计文档为唯一事实来源审查起点，识别设计层与实现层问题后系统性修正。

#### SSoT 设计层补全
- SSoT 新增 §7.6「LLM-as-a-Verifier 数据模型」：补全 `VerificationResult` / `QualityLevel` / `VerificationDimension` / `SubCriterion` / `ContinuousScoringEngine` / `LLMClient` / `LLMClientConfig` / `LLMResponse` / `VerifierConfig` 完整 TypeScript 接口
- SSoT 新增 §7.7「元技能与演化数据模型」：`MetaSkillConfig` / `MetaSkillPhaseConfig` / `RolloutEvidence` / `SkillEdit` / `SkillEvolutionConfig`
- SSoT 新增 §7.8「技术评估数据模型」：`EvalCondition` / `SkillLiftResult` / `ThreeLevelEvalResult` / `SkillEvalReport`
- SSoT 新增 §10.5「两类质量门（重要区分）」：区分工件质量门（RTM 覆盖率 + 测试通过）vs 技能验证门（SkillLift > 0）
- SSoT 新增 §10A「SSoT ↔ 实现追溯表」：13 行追溯表建立设计↔实现双向追溯
- SSoT 新增第 14 章「技能演化机制」（8 节）：SkillOpt ReflectTrainer 训练循环、可训练状态边界、protected region、验证门强制启用、双时间尺度、训练日志、与工件质量门关系
- SSoT 新增第 15 章「技能评估标准」（9 节）：ACES Skill Lift 配对试验、SkillsBench 三条件对照、SkillLearnBench 三级评估、确定性 verifier 优先、留出任务集、与第 14 章对接
- SSoT 第 12 章发展规划新增「第四阶段（自演化版）」：技能自演化 / 评估基准建设 / 多 Agent 框架适配 / MCP Server 化
- SSoT 参考文献重编为 §16，新增 SkillOpt / MetaSkill-Evolve / ACES / SkillsBench / SkillLearnBench / PPT 引用

#### 实现层修正
- `src/commands/router.ts`：移除 `code` 命令「自动标记单元测试通过」的占位实现；`test` 命令新增 `result=pass|fail` 参数支持真实结果回填（恢复工件质量门有效性）
- `src/core/llm-client.ts`：新增 `OpenAICompatibleLLMClient`（基于全局 fetch，覆盖 OpenAI / Azure / DeepSeek / Moonshot / 通义）与 `AnthropicLLMClient`（Messages API）；`createLLMClient` 工厂按 model 名自动选择
- `src/core/meta-skill-config.ts`（新）：将原硬编码子标准 / 评估次数 / 方差阈值上提为 `DEFAULT_META_SKILL_CONFIG`，含 `cloneMetaSkillConfig` / `validateMetaSkillConfig`
- `src/core/w-model-enhancer.ts`：构造函数新增 `metaSkill?` 参数；三个 `verify*` 方法收敛到 `verifyWithPhase`，从 `MetaSkillConfig` 读取参数（消除硬编码）
- `src/evolution/skill-optimizer.ts`（新）：`SkillOptimizer` 实现 SkillOpt ReflectTrainer 训练循环（Rollout → Reflect → Edit → Gate → Commit），含 `RolloutExecutor` / `GateEvaluator` 接口、`createMetaSkillGateEvaluator` 工厂、`extractFailedSubCriteria` 工具
- `src/eval/skill-lift.ts`（新）：`SkillLiftEvaluator` 实现 ACES Skill Lift 配对试验 + SkillsBench 三条件对照 + SkillLearnBench 三级评估，含 `createDefaultEvalExecutor` 工厂与 `DEFAULT_HELD_OUT_TASKS`
- `w-model-dev/META-SKILL.md`（新）：定义可训练外部状态，与代码同源
- `src/index.ts`：导出新增模块；`createCommandContext` 新增 `metaSkill?` 参数；改用 `createLLMClient` 替代 `new MockLLMClient`
- `examples/run-wm-flow.ts`：适配新行为，新增 `result=pass` 回填步骤

#### 测试
- 新增 `tests/meta-skill-config.test.ts`（3 describe）：默认值完整性 / 深拷贝独立性 / 合法性校验
- 新增 `tests/skill-optimizer.test.ts`（4 describe，8 用例）：无失败样本不演化 / 验证门拒绝接受 / 受保护区域过滤 / editBudget 约束 / 强制接受模式 / 训练日志 / extractFailedSubCriteria / 隔离性
- 新增 `tests/skill-lift.test.ts`（3 describe）：正/负/零 lift 方向性 / 批量聚合 / DEFAULT_HELD_OUT_TASKS
- `tests/llm-client.test.ts`：新增 OpenAICompatibleLLMClient / AnthropicLLMClient 构造校验 + createLLMClient 工厂选择测试
- `tests/command-router.test.ts`：完整流程测试改用 `result=pass` 回填；新增「result 参数（修正占位实现）」describe 块（6 用例）
- 验证：`npx tsc --noEmit` 0 错误；`npx jest` 11 个测试套件、163 个测试全部通过

#### 文档一致性
- `skill-design-document.md`（指针）：修正「SSoT 第 11 章为 LLM-as-a-Verifier 集成规范」的错误（实际分布在 §7.6 + §8）
- `llm-verifier-integration-design.md`：顶部新增「权威性说明」，明确以 SSoT §7.6 + §8 + §10.5 为权威来源
- SSoT §10A 追溯表修正「11 LLM Verifier 集成 见 11A」错误引用（§11A 不存在）

### 计划中
- Web UI 可视化 RTM 矩阵
- 多项目并行管理
- SkillOptimizer 真实 RolloutExecutor 接入 dispatch 全流程
- 留出 benchmark 集扩充（≥30 个项目）

## [0.1.0] - 2026-07-16

基于 [issue #5](https://github.com/WangHHY19931001/Software_Engineering_W_Development_Model_Skills_Pack/issues/5)
的代码审查报告（评分 8.2/10）进行的项目扩大化优化首版。

### 新增

#### 核心引擎实现（issue Critical #1）
- 将 `llm-verifier-implementation-template.ts`（691 行模板）重构为模块化 `src/` 结构
- 实现 `LLMVerifierEngine`：基于 logits 期望值的连续评分，使用 log-softmax 保证数值稳定
- 实现 `VerificationFramework`：三维度验证（评分粒度 + 重复评估 + 标准分解）
- 实现 `PPTRanker`：O(N×k) 概率枢轴锦标赛排序算法
- 实现 `WModelVerifierEnhancer`：需求 / 设计 / 测试用例三阶段验证增强器

#### LLM Verifier 鲁棒性（issue High Priority #2）
- 新增 `fallbackStrategy` 配置：`text-parse` / `discrete` / `throw`
- 当 LLM 不支持 logits 时自动回退，解析字母（A-T）或数字并加稳定扰动
- `MockLLMClient` 支持模拟 logits / scoreLabel，便于离线测试
- `HttpLLMClient` 骨架，支持自部署推理服务（vLLM / TGI）

#### 状态持久化（issue Critical #2）
- 新增 `ProjectStateManager`：JSON 文件持久化（`.w-model/project.json`）
- 支持项目 / 需求 / 设计 / 测试用例 CRUD，自动 ID 生成
- W 模型阶段合法性校验（禁止跨阶段推进，允许回退返工）
- `exportJSON` / `importJSON` 支持项目迁移

#### RTM 自动化（issue Critical #2 + Medium #1）
- 新增 `RTMManager`：从 `ProjectStore` 自动重建需求跟踪矩阵
- 双向追溯：需求 ↔ 设计 ↔ 代码 ↔ 四级测试用例
- 覆盖率自动统计与缺失列告警
- 质量门检查：覆盖率 100% + 所有测试通过
- Markdown 导出（套用 `templates/rtm.md` 格式）
- 变更日志记录

#### /wm 命令路由（issue Critical #2）
- 新增 `commands/router.ts`：10 个命令（analyze / design / code / test / review / status / help / reset / export / import）
- 阶段校验：确保命令在合法阶段执行
- 实体登记：自动关联需求 ↔ 设计 ↔ 测试用例，保证 RTM 双向追溯
- 验证触发：analyze / design / review 时自动调用 LLM Verifier
- 质量门：验收测试阶段自动检查

#### 测试与覆盖率（issue 验收标准）
- 119 个单元测试，覆盖所有核心模块
- 全局分支覆盖率 83.58%（目标 ≥ 70%）
- 核心模块分支覆盖率 91.89%（目标 ≥ 85%）
- TypeScript 严格模式，`tsc --noEmit` 通过

#### 示例与文档
- 新增 `examples/run-wm-flow.ts`：W 模型 8 阶段全流程示例
- 新增 `README.md`：项目导航与快速上手
- 新增 `CONTRIBUTING.md`：贡献指南
- 新增 `IMPLEMENTATION-PLAN.md`：实现路线图
- 新增 `CHANGELOG.md`：本文件

### 变更

#### 文档同步（issue High Priority #1）
- `skill-design-document.md` 精简为指向 SSoT 的指针文档（570 行 → 37 行）
- 统一以 `skill-design-document_SSoT.md` 为单一事实来源

### 工程化
- 新增 `package.json`：ESM 模块，TypeScript 5.4，Jest + ts-jest
- 新增 `tsconfig.json`：ES2020 target，Bundler resolution，strict mode
- 新增 `jest.config.js`：覆盖率阈值配置（全局 70%，核心 85%）
- 新增 `.eslintrc.cjs`、`.gitignore`
