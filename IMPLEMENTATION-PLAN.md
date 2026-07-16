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

## Phase 3：生产化（⏳ 计划中）

| 任务 | 状态 | 说明 |
|---|---|---|
| 3.1 OpenAI / Anthropic SDK 适配器 | ⏳ | 实现真实的 `LLMClient`，支持 GPT-4 / Claude 的 logits 或 fallback |
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
| `HttpLLMClient.generate` 未实现 | 中 | 当前仅骨架，生产环境需注入具体 SDK 实现 |
| `extractCodeModule` 简化实现 | 低 | 仅从单元测试描述中正则提取，真实场景应显式登记 |
| `LLMVerifierEngine.getTokenIdForLabel` 硬编码 | 低 | 简化实现，实际需按 tokenizer 调整 |
| `llm-verifier-implementation-template.ts` 保留 | 低 | 作为历史参考保留，已被 `src/` 替代 |
