# 实现路线图

> 本文档记录 W-Model AI Assistant Skill 的实现进度与后续规划。
> 对应 [issue #5](https://github.com/WangHHY19931001/Software_Engineering_W_Development_Model_Skills_Pack/issues/5) 的行动路线图。

## 状态图例

- ✅ 已完成
- 🚧 进行中
- ⏳ 计划中
- ❌ 已废弃

---

## Phase 0：核心重构（✅ 已完成）

将 `llm-verifier-implementation-template.ts`（691 行模板）重构为模块化 `src/` 结构。

| 任务 | 状态 | 产出 |
|---|---|---|
| 0.1 重构 verifier template，添加 fallback 机制 | ✅（已被 2.6 取代） | 原 `src/core/{llm-client,scoring-engine,verification-framework,ppt-ranker,w-model-enhancer}.ts` 已在 Phase 2.6 删除，LLM 评审改由外部 Agent 按 `verifier-spec.md` 执行 |
| 0.2 添加项目状态管理（JSON 持久化） | ✅ | `src/state/project-state.ts` |
| 0.3 实现 /wm 命令路由 | ✅ | `src/commands/router.ts`（10 个命令） |
| 0.4 实现 RTM 自动更新模块 | ✅ | `src/state/rtm-manager.ts` |
| 0.5 添加工程化配置（package.json / tsconfig / jest / eslint） | ✅ | `package.json`, `tsconfig.json`, `jest.config.js`, `.eslintrc.cjs` |

## Phase 1：测试与示例（✅ 已完成，测试集在 2.6 重写）

| 任务 | 状态 | 产出 |
|---|---|---|
| 1.1 为核心模块添加单元测试，覆盖率达标 | ✅（测试集在 2.6 重写） | 当前 `tests/*.test.ts` 共 96 个测试（4 套件）：`command-router.test.ts`（63）+ `verifier-logic.test.ts`（33）+ `project-state.test.ts` + `rtm-manager.test.ts`。原 `src/core/*` 相关测试已删除 |
| 1.2 添加完整示例项目走通 W 模型全流程 | ✅ | `examples/run-wm-flow.ts`（2.6 移除 verifierConfig 与 /wm review 步骤） |

### 覆盖率达成情况

> 下表为 Phase 1 阶段的统计数据（针对已删除的 `src/core/*`）。Phase 2.6 后核心模块已不存在，覆盖率口径改为 `src/state/` 与 `src/commands/`，详见 `npm test` 实时输出。

| 范围 | 目标 | 实际（Phase 1 历史） |
|---|---|---|
| 全局语句覆盖率 | ≥ 70% | 95.98% |
| 全局分支覆盖率 | ≥ 70% | 83.58% |
| 核心模块分支覆盖率 | ≥ 85% | 91.89%（核心模块已于 2.6 删除） |
| 状态模块分支覆盖率 | ≥ 80% | 80.20% |

## Phase 2：文档同步（✅ 已完成）

| 任务 | 状态 | 产出 |
|---|---|---|
| 2.1 精简 `skill-design-document.md` 为 SSoT 指针 | ✅ | 570 行 → 37 行指针文档 |
| 2.2 创建 `README.md`（项目导航 + 快速上手） | ✅ | `README.md` |
| 2.3 创建 `CHANGELOG.md`、`CONTRIBUTING.md`、`IMPLEMENTATION-PLAN.md` | ✅ | 三份文档 |
| 2.4 更新 `SKILL.md` 引用实现文件、`llm-verifier-integration-design.md` 引用新实现 | ✅ | 见各文档末尾的"实现位置"章节 |

## Phase 2.5：设计→实现审查全面修正（✅ 已完成，部分被 Phase 2.6 取代）

> 以 SSoT 设计文档为唯一事实来源审查起点，识别设计层与实现层问题后系统性修正。
> 历史对应 SSoT §7.6 / §7.7 / §7.8 / §10.5 / §10A / 第 14 章 / 第 15 章。
>
> **注意**：本阶段的 LLM 引擎 / 元技能 / 演化 / 评估相关实现（2.5.5 / 2.5.6 / 2.5.7 / 2.5.8）
> 与对应的 SSoT 章节（§7.6 LLM 类型 / §7.7 演化类型 / §7.8 评估类型 / §14 演化机制 / §15 评估标准 / §12.4 自演化版）
> 已在 Phase 2.6 架构重构中**整块移除**。下表保留为历史记录，标注「已被 2.6 取代」的行不再有效。

| 任务 | 状态 | 产出 |
|---|---|---|
| 2.5.1 SSoT 数据模型补全 | ✅（部分取代） | SSoT §7.6 改为评审规范摘要（指向 verifier-spec.md）；§7.7 / §7.8 已删除 |
| 2.5.2 SSoT 两类质量门区分 | ✅（部分取代） | SSoT §10.5 改为「工件质量门」单门，技能验证门已移除 |
| 2.5.3 SSoT ↔ 实现追溯表 | ✅（取代） | SSoT §10A 重写，移除指向已删除文件的行 |
| 2.5.4 移除占位实现，恢复质量门有效性 | ✅ | `router.ts` `code` 不自动标记通过；`test` 新增 `result=pass\|fail` 回填（保留） |
| 2.5.5 真实 LLMClient 实现 | ❌（已被 2.6 取代） | `src/core/llm-client.ts` 已删除，技能不再内置 LLM |
| 2.5.6 元技能配置外提（消除硬编码） | ❌（已被 2.6 取代） | `src/core/meta-skill-config.ts` 已删除，子标准定义改由 `verifier-logic.ts` 承载 |
| 2.5.7 SkillOptimizer 训练循环 | ❌（已被 2.6 取代） | `src/evolution/skill-optimizer.ts` 已删除，演化由外部 SkillOpt / darwin-skill 完成 |
| 2.5.8 SkillLiftEvaluator 评估引擎 | ❌（已被 2.6 取代） | `src/eval/skill-lift.ts` 已删除，技能评估由外部工具完成 |
| 2.5.9 SSoT 第 14 章「技能演化机制」 | ❌（已被 2.6 取代） | SSoT §14 已整章移除（保留 tombstone） |
| 2.5.10 SSoT 第 15 章「技能评估标准」 | ❌（已被 2.6 取代） | SSoT §15 已整章移除（保留 tombstone） |
| 2.5.11 SSoT 第 12 章发展规划更新 | ✅（取代） | §12.4 改为「外部演化工具协作」，路线图移除自演化路线 |
| 2.5.12 测试覆盖 | ✅（取代） | 相关测试文件已删除；新测试见 2.6.7 |
| 2.5.13 文档一致性修正 | ✅（取代） | 指针文档 + 集成设计文档 + 追溯表已在 2.6 重新同步 |

## Phase 2.6：架构重构——技能包纯化（✅ 已完成）

> 把技能包纯化为「只包含提示词、参考、模板，里面的脚本只做门禁，不涉及 LLM」。
> LLM-as-a-Verifier 评审改由外部 Agent 按提示词执行；技能演化移交给外部 skillopt / darwin-skill。

| 任务 | 状态 | 产出 |
|---|---|---|
| 2.6.1 删除 LLM / 演化 / 评估源码 | ✅ | 移除 `src/core/{scoring-engine,verification-framework,ppt-ranker,w-model-enhancer,llm-client,meta-skill-config}.ts`、`src/evolution/skill-optimizer.ts`、`src/eval/skill-lift.ts` 及对应测试 |
| 2.6.2 删除技能演化配套资产 | ✅ | 移除 `w-model-dev/scripts/check-skill-gate.ts`、`w-model-dev/META-SKILL.md`、`docs/llm-verifier-implementation-template.ts` |
| 2.6.3 新增 LLM-as-a-Verifier 评审规范 | ✅ | `w-model-dev/references/verifier-spec.md`（三维度验证 / 连续评分 [0,1] / PPT / 子标准 / 输出 Schema / 提示词模板 / 与外部演化工具关系） |
| 2.6.4 新增 Verifier 输出校验纯逻辑 | ✅ | `w-model-dev/scripts/verifier-logic.ts`（`SUB_CRITERIA` 定义 + `checkVerifierOutput` + `determineQualityLevel`，单点事实源） |
| 2.6.5 新增 Verifier 输出校验 CLI | ✅ | `w-model-dev/scripts/check-verifier-output.ts`（防外部 Agent 输出漂移，退出码 0/1/2） |
| 2.6.6 重写核心文件 | ✅ | `src/index.ts`（`createCommandContext(cwd)` 单参，不再注入 verifier）/ `src/types/index.ts`（移除演化/轨迹/LLM 类型，`CommandContext` 仅 projectState/rtm/cwd）/ `src/commands/router.ts`（`/wm review` 改为返回结构化评审指引）/ `w-model-dev/scripts/gate-logic.ts`（移除 `checkSkillGate`，仅保留 `checkArtifactGate`）/ `w-model-dev/SKILL.md`（新增「架构定位」节）/ `examples/run-wm-flow.ts`（移除 verifierConfig 与 /wm review 步骤） |
| 2.6.7 测试重写 | ✅ | `tests/command-router.test.ts` 重写（63 用例）；新增 `tests/verifier-logic.test.ts`（33 用例）；共 96 测试通过 |
| 2.6.8 文档同步 | ✅ | SSoT 删 §7.6/§7.7/§7.8/§14/§15、更新 §10.5/§10A/§12.4/§12.5/§16.3、新增 §3.3；`llm-verifier-integration-design.md` 简化为指针；README / CHANGELOG / CONTRIBUTING / INSTALL 同步 |
| 2.6.9 验证 | ✅ | `npx tsc --noEmit` 0 错误；`npx jest` 96 测试通过（4 套件）；`npx eslint 'src/**/*.ts' --max-warnings=0` 0 warning；`check-verifier-output.ts` 端到端验证通过；`npm run example:run` 通过 |

## Phase 3：生产化（⏳ 计划中）

> Phase 2.6 架构重构后，本阶段不再包含 LLM SDK 适配器类任务——技能本身不内置 LLM，
> LLM 调用由外部 Agent 自行处理。原 3.1「OpenAI / Anthropic SDK 适配器」已整块移除。

| 任务 | 状态 | 说明 |
|---|---|---|
| ~~3.1 OpenAI / Anthropic SDK 适配器~~ | ❌（已被 2.6 取代） | 原 `OpenAICompatibleLLMClient` / `AnthropicLLMClient` 随 `src/core/llm-client.ts` 删除；LLM 调用归外部 Agent |
| 3.2 CLI 工具 | ⏳ | `npx w-model init` / `npx w-model analyze` 等命令行入口 |
| 3.3 Web UI 可视化 RTM | ⏳ | 实时展示 RTM 矩阵、覆盖率、质量门状态 |
| 3.4 多项目并行管理 | ⏳ | 支持 workspace 概念，同时跟踪多个项目 |
| 3.5 Git 集成 | ⏳ | 自动从 commit message 提取代码模块变更，更新 RTM |
| 3.6 CI/CD 集成 | ⏳ | GitHub Actions 中作为质量门，PR 必须通过 W 模型验收 |
| 3.7 外部演化工具对接 | ⏳ | 与 SkillOpt / darwin-skill 约定 `VerifierOutput` JSON 消费协议，作为演化信号源 |

## Phase 4：生态扩展（⏳ 计划中）

| 任务 | 状态 | 说明 |
|---|---|---|
| 4.1 VS Code 插件 | ⏳ | 在 IDE 中直接调用 /wm 命令 |
| 4.2 MCP Server 适配 | ⏳ | 作为 Model Context Protocol 服务端，供其他 AI 助手调用 |
| 4.3 多语言支持 | ⏳ | Python / Go / Java 项目的代码模块识别扩展 |
| 4.4 自定义验证标准 | ⏳ | 允许用户在配置文件中定义自己的子标准与权重（需同步更新 `verifier-logic.ts` 的 `SUB_CRITERIA` 与 `verifier-spec.md` §7） |

---

## 验收标准对照（issue #5）

> Phase 2.6 架构重构后，原验收标准中涉及「LLM 引擎内置」的条目已重新解释：
> LLM-as-a-Verifier 评审改由外部 Agent 按提示词执行，技能只提供提示词 + 输出 Schema + 校验脚本。

| 验收标准 | 达成情况 |
|---|---|
| 核心引擎能运行 /wm 命令 | ✅ 10 个命令全部实现并可运行 |
| LLM-as-a-Verifier 提供连续评分 + 置信度 | ✅ 由 `w-model-dev/references/verifier-spec.md`（提示词 + Schema）+ `scripts/verifier-logic.ts`（校验）+ `scripts/check-verifier-output.ts`（CLI）共同保证；连续评分 [0,1]（4 位小数）+ 三维度验证 + PPT；原 `LLMVerifierEngine` / `VerificationFramework` 已删除，评审由外部 Agent 执行 |
| 测试覆盖率 ≥ 70%（核心 ≥ 85%） | ✅（口径变更）Phase 2.6 后核心模块（`src/core/`）已不存在，覆盖率口径改为 `src/state/` + `src/commands/`；详见 `npm test` 实时输出 |
| `CHANGELOG.md` 与 `CONTRIBUTING.md` | ✅ 已创建并随 2.6 同步 |
| 文档以 SSoT 为单一事实来源 | ✅ `skill-design-document.md` 已转为指针；SSoT §7.6 / §14 / §15 已 tombstone |

## 技术债务

> Phase 2.6 架构重构后，原技术债务表中基于已删除源码（`src/core/*` / `src/evolution/*` / `src/eval/*`）的条目
> 整块失效，下表已替换为新口径。

| 项目 | 优先级 | 说明 |
|---|---|---|
| ~~`HttpLLMClient.generate` 未实现~~ | — | 已随 `src/core/llm-client.ts` 删除（2.6） |
| ~~`SkillOptimizer.getTrainTaskIds` 占位~~ | — | 已随 `src/evolution/skill-optimizer.ts` 删除（2.6），演化移交外部 SkillOpt / darwin-skill |
| ~~`createDefaultEvalExecutor.run` 未接入 dispatch~~ | — | 已随 `src/eval/skill-lift.ts` 删除（2.6），评估移交外部工具 |
| ~~`LLMVerifierEngine.getTokenIdForLabel` 硬编码~~ | — | 已随 `src/core/scoring-engine.ts` 删除（2.6），评分由外部 Agent 按 `verifier-spec.md` 执行 |
| ~~`llm-verifier-implementation-template.ts` 保留~~ | — | 已在 2.6.2 删除 |
| 外部 Agent 评审输出漂移防护 | 低 | 当前由 `check-verifier-output.ts` 在产出后校验；可考虑在 Agent 侧前置嵌入约束 |
| `SUB_CRITERIA` 自定义扩展 | 中 | 当前 `verifier-logic.ts` 中子标准与权重为常量；若需用户自定义，需同步设计 `verifier-spec.md` §7 与 `check-verifier-output.ts` 的协议版本（见 Phase 4.4） |
| 外部演化工具对接协议 | 中 | 需与 SkillOpt / darwin-skill 约定 `VerifierOutput` JSON 消费契约（见 Phase 3.7） |
