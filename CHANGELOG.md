# 变更日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 架构纯化：移除全部编程式接入

> 把本仓库确定为「单纯的编排 + 校验脚本技能」，不包含任何编程式接入（无 TypeScript 引擎、无 npm 包、无 SDK）。
> 技能包只包含提示词、参考、模板，里面的脚本只做门禁，不涉及 LLM 调用。
> 此变更撤销了此前 [Unreleased] 阶段规划的「内置 `src/` TypeScript 引擎 + `tests/` 测试套件 + `package.json` 工具链」方向，回归纯技能包形态。

#### 删除（编程式引擎与 Node 工具链）

- `src/` 整块移除：`index.ts`、`commands/router.ts`、`state/{project-state,rtm-manager}.ts`、`types/index.ts`（`/wm` 命令路由、状态持久化、RTM 维护改由 Agent 读取 `w-model-dev/SKILL.md` 后用自身工具执行，状态持久化到项目内 `.w-model/*.json`）
- `tests/` 整块移除：`command-router.test.ts`、`project-state.test.ts`、`rtm-manager.test.ts`、`verifier-logic.test.ts`
- `examples/run-wm-flow.ts` 移除（编程式示例，与新架构不符）
- Node 工程化文件移除：`package.json`、`package-lock.json`、`tsconfig.json`、`jest.config.js`、`.eslintrc.cjs`
- `docs/IMPLEMENTATION-PLAN.md` 移除（内置引擎路线图，已不适用）

#### 保留（自包含校验脚本）

- `w-model-dev/scripts/gate-logic.ts`：工件质量门纯逻辑（自包含，仅依赖本目录内文件）
- `w-model-dev/scripts/verifier-logic.ts`：Verifier 输出校验纯逻辑（自包含）
- `w-model-dev/scripts/check-artifact-gate.ts`：工件质量门 CLI（读 `.w-model/rtm.json`，退出码 0/1/2）
- `w-model-dev/scripts/check-verifier-output.ts`：Verifier 输出校验 CLI（防外部 Agent 输出漂移）
- 校验脚本运行依赖仅为 `tsx`（用户通过 `npx tsx` 或全局安装调用），无需 `npm install`

#### 变更（文档同步至纯技能架构）

- `w-model-dev/SKILL.md`：移除「实现位置 / 快速验证 / 编程式接入」尾部章节；文件清单注释中去除 `src/` 引用
- `README.md`：架构边界表「W 模型阶段编排」实现位置改为 `w-model-dev/SKILL.md` + `references/*`；快速上手改为「AI Agent 安装（零依赖）」+「运行门禁校验脚本」；移除「编程式接入」章节与 `src/` / `tests/` / `examples/run-wm-flow.ts` 结构条目
- `docs/INSTALL.md`：重写为单一安装路径（移除模式 B 程序化模式 / 模式 A+B 混合使用 / `npm install` / `createCommandContext` 示例）；新增「为什么没有 npm install / package.json」FAQ
- `docs/skill-design-document_SSoT.md`：§1.4 架构重构说明、§3.3 边界表、§6.3 时序图、§8.1 技术栈表、§10.5 / §10A 追溯表、§11 部署集成方案全面改为纯技能架构描述
- `docs/skill-design-document.md`：用途表「实现入口（TypeScript）| src/index.ts」改为「AI Agent 安装指南 | INSTALL.md」
- `docs/llm-verifier-integration-design.md`：移除「命令路由实现 | ../src/commands/router.ts」引用
- `CONTRIBUTING.md`：移除 `npm test` / `npm run lint` / `npm run typecheck` 工作流与覆盖率阈值；改为 `npx tsx` 端到端校验；新增「脚本不得 import `src/`」自包含规则
- `.gitignore`：移除 `node_modules/` / `dist/` / `build/` / `*.tsbuildinfo` / `coverage/` 等不再相关的条目

#### 验证

- `grep -rE "src/|createCommandContext|dispatch\(|程序化|编程式|模式 ?B|混合使用|npm (run|test|install)|npx (jest|tsc|eslint)"` 在保留文件中无残留编程式接入引用（仅保留明确否定句「不包含编程式接入」与历史 tombstone 说明）
- `w-model-dev/scripts/*.ts` 校验脚本自包含性确认（仅 `import ./gate-logic.js` / `./verifier-logic.js` 与 Node 标准库）

### 已撤销的方向（历史记录）

> 以下为此前 [Unreleased] 阶段规划的「内置 `src/` 引擎」方向，已被上方「架构纯化」整体撤销，所列文件均已删除，保留仅作历史记录。

- 内置 `src/core/*` LLM 评分 / 验证 / 排序 / 增强器 / 客户端 / 元技能配置
- 内置 `src/evolution/skill-optimizer.ts` SkillOpt ReflectTrainer 训练循环
- 内置 `src/eval/skill-lift.ts` ACES Skill Lift 评估
- `w-model-dev/scripts/check-skill-gate.ts` 技能验证门
- `w-model-dev/META-SKILL.md` 可演化元技能配置
- `tests/verifier-logic.test.ts` 等 11 个测试套件、163 个测试
- `examples/run-wm-flow.ts` 编程式全流程示例
- `npx tsc --noEmit` / `npx jest` / `npx eslint` / `npm run example:run` 验证链
- `docs/INSTALL.md` 模式 A / 模式 B 双路径与混合使用说明

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
