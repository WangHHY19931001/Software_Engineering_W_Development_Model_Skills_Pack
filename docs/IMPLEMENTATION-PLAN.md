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
| 0.1 重构 verifier template，添加 fallback 机制 | ✅ | `src/core/{llm-client,scoring-engine,verification-framework,ppt-ranker,w-model-enhancer}.ts` |
| 0.2 添加项目状态管理（JSON 持久化） | ✅ | `src/state/project-state.ts` |
| 0.3 实现 /wm 命令路由 | ✅ | `src/commands/router.ts`（10 个命令） |
| 0.4 实现 RTM 自动更新模块 | ✅ | `src/state/rtm-manager.ts` |
| 0.5 添加工程化配置（package.json / tsconfig / jest / eslint） | ✅ | `package.json`, `tsconfig.json`, `jest.config.js`, `.eslintrc.cjs` |

## Phase 1：测试与示例（✅ 已完成）

| 任务 | 状态 | 产出 |
|---|---|---|
| 1.1 为核心模块添加单元测试，覆盖率达标 | ✅ | `tests/*.test.ts`（119 个测试，核心分支覆盖率 91.89%） |
| 1.2 添加完整示例项目走通 W 模型全流程 | ✅ | `examples/run-wm-flow.ts` |

### 覆盖率达成情况

| 范围 | 目标 | 实际 |
|---|---|---|
| 全局语句覆盖率 | ≥ 70% | 95.98% |
| 全局分支覆盖率 | ≥ 70% | 83.58% |
| 核心模块分支覆盖率 | ≥ 85% | 91.89% |
| 状态模块分支覆盖率 | ≥ 80% | 80.20% |

## Phase 2：文档同步（✅ 已完成）

| 任务 | 状态 | 产出 |
|---|---|---|
| 2.1 精简 `skill-design-document.md` 为 SSoT 指针 | ✅ | 570 行 → 37 行指针文档 |
| 2.2 创建 `README.md`（项目导航 + 快速上手） | ✅ | `README.md` |
| 2.3 创建 `CHANGELOG.md`、`CONTRIBUTING.md`、`IMPLEMENTATION-PLAN.md` | ✅ | 三份文档 |
| 2.4 更新 `SKILL.md` 引用实现文件、`llm-verifier-integration-design.md` 引用新实现 | ✅ | 见各文档末尾的"实现位置"章节 |

## Phase 2.5：设计→实现审查全面修正（✅ 已完成）

> 以 SSoT 设计文档为唯一事实来源审查起点，识别设计层与实现层问题后系统性修正。
> 对应 SSoT 新增 §7.6 / §7.7 / §7.8 / §10.5 / §10A / 第 14 章 / 第 15 章。

| 任务 | 状态 | 产出 |
|---|---|---|
| 2.5.1 SSoT 数据模型补全 | ✅ | SSoT §7.6（Verifier 类型）/ §7.7（演化类型）/ §7.8（评估类型） |
| 2.5.2 SSoT 两类质量门区分 | ✅ | SSoT §10.5（工件质量门 vs 技能验证门） |
| 2.5.3 SSoT ↔ 实现追溯表 | ✅ | SSoT §10A（13 行双向追溯） |
| 2.5.4 移除占位实现，恢复质量门有效性 | ✅ | `router.ts` `code` 不自动标记通过；`test` 新增 `result=pass\|fail` 回填 |
| 2.5.5 真实 LLMClient 实现 | ✅ | `llm-client.ts` 新增 `OpenAICompatibleLLMClient` + `AnthropicLLMClient` + 工厂 |
| 2.5.6 元技能配置外提（消除硬编码） | ✅ | `meta-skill-config.ts` + `w-model-enhancer.ts` 改读 `MetaSkillConfig` |
| 2.5.7 SkillOptimizer 训练循环 | ✅ | `src/evolution/skill-optimizer.ts`（SkillOpt ReflectTrainer） |
| 2.5.8 SkillLiftEvaluator 评估引擎 | ✅ | `src/eval/skill-lift.ts`（ACES + SkillsBench + SkillLearnBench） |
| 2.5.9 SSoT 第 14 章「技能演化机制」 | ✅ | SSoT §14（8 节） |
| 2.5.10 SSoT 第 15 章「技能评估标准」 | ✅ | SSoT §15（9 节） |
| 2.5.11 SSoT 第 12 章发展规划更新 | ✅ | 新增「第四阶段（自演化版）」+ 路线图 |
| 2.5.12 测试覆盖 | ✅ | 3 个新测试文件 + 2 个测试文件增强；163 测试全过 |
| 2.5.13 文档一致性修正 | ✅ | 指针文档 + 集成设计文档 + 追溯表错误引用 |

## Phase 3：生产化（⏳ 计划中）

| 任务 | 状态 | 说明 |
|---|---|---|
| 3.1 OpenAI / Anthropic SDK 适配器 | ✅ | 已在 Phase 2.5.5 完成：`OpenAICompatibleLLMClient`（fetch）+ `AnthropicLLMClient`（Messages API） |
| 3.2 CLI 工具 | ⏳ | `npx w-model init` / `npx w-model analyze` 等命令行入口 |
| 3.3 Web UI 可视化 RTM | ⏳ | 实时展示 RTM 矩阵、覆盖率、质量门状态 |
| 3.4 多项目并行管理 | ⏳ | 支持 workspace 概念，同时跟踪多个项目 |
| 3.5 Git 集成 | ⏳ | 自动从 commit message 提取代码模块变更，更新 RTM |
| 3.6 CI/CD 集成 | ⏳ | GitHub Actions 中作为质量门，PR 必须通过 W 模型验收 |

## Phase 4：生态扩展（⏳ 计划中）

| 任务 | 状态 | 说明 |
|---|---|---|
| 4.1 VS Code 插件 | ⏳ | 在 IDE 中直接调用 /wm 命令 |
| 4.2 MCP Server 适配 | ⏳ | 作为 Model Context Protocol 服务端，供其他 AI 助手调用 |
| 4.3 多语言支持 | ⏳ | Python / Go / Java 项目的代码模块识别扩展 |
| 4.4 自定义验证标准 | ⏳ | 允许用户在配置文件中定义自己的子标准与权重 |

---

## 验收标准对照（issue #5）

| 验收标准 | 达成情况 |
|---|---|
| 核心引擎能运行 /wm 命令 | ✅ 10 个命令全部实现并可运行 |
| LLM-as-a-Verifier 提供连续评分 + 置信度 | ✅ `LLMVerifierEngine` + `VerificationFramework` |
| 测试覆盖率 ≥ 70%（核心 ≥ 85%） | ✅ 全局 83.58%，核心 91.89% |
| `CHANGELOG.md` 与 `CONTRIBUTING.md` | ✅ 已创建 |
| 文档以 SSoT 为单一事实来源 | ✅ `skill-design-document.md` 已转为指针 |

## 技术债务

| 项目 | 优先级 | 说明 |
|---|---|---|
| `HttpLLMClient.generate` 未实现 | 低 | 骨架保留；生产环境已改用 `OpenAICompatibleLLMClient` / `AnthropicLLMClient`（Phase 2.5.5） |
| `SkillOptimizer.getTrainTaskIds` 占位 | 中 | 真实场景应从 benchmark 集合加载训练任务，排除 `heldOutTaskIds` |
| `createDefaultEvalExecutor.run` 未接入 dispatch | 中 | 当前仅框架，真实评估需调用 `dispatch('/wm analyze ...')` 走完整流程 |
| `extractCodeModule` 简化实现 | 低 | 仅从单元测试描述中正则提取，真实场景应显式登记 |
| `LLMVerifierEngine.getTokenIdForLabel` 硬编码 | 低 | 简化实现，实际需按 tokenizer 调整 |
| `llm-verifier-implementation-template.ts` 保留 | 低 | 作为历史参考保留，已被 `src/` 替代 |
