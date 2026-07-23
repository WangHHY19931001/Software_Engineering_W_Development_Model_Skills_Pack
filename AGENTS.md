# AGENTS.md

> 面向 AI Agent（Trae / Claude Code / Cursor 等）的仓库导航。
> 与 [README.md](./README.md) 互补：README 面向人类读者，本文件聚焦 Agent 在仓库内行动所需的最小事实集。

## 1. 仓库定位

**W-Model AI Assistant Skill** — 单纯的编排 + 校验脚本技能包：

- **技能资产**（`w-model-dev/`）：纯 Markdown + 自包含 TypeScript 门禁脚本，**不内置 LLM 调用、不包含编程式引擎（无 `src/`、无 npm 包、无 SDK）**。
- **`/wm` 命令、状态持久化、RTM 维护** 由 Agent 读取 `w-model-dev/SKILL.md` 后用自身工具执行，状态写入项目内 `.w-model/*.json`。
- **编排者最小化（Orchestrator Minimization）**：Agent 读取 `w-model-dev/SKILL.md` 后承担「编排者」角色，只做路由 / 状态读写 / CHECKPOINT 等待 / 分派子代理 / 持久化 / 只读脚本；任何修改、编码、调测、分析、修正、验证产出的实施动作必须由子代理（S 产出 / V 评审 / G 门禁）执行。详见 `w-model-dev/references/subagent-delegation.md`；违反命中反模式 #10，回到当前阶段起点。
- **LLM-as-a-Verifier 评审** 由 V 子代理按 `w-model-dev/references/verifier-spec.md` 提示词执行（即「外部 Agent」），技能用校验脚本防输出漂移；编排者不得自评。
- **Agent Personas（评审角色提示词）** 由 V 子代理在执行 `/wm review` 时按 `w-model-dev/references/agent-personas.md` 选用对应 Persona（code-reviewer / test-engineer / security-auditor / performance-auditor），Persona 文件本身是 Markdown，不调用 LLM；产出 JSON 须满足 `verifier-spec.md` §7 Schema。
- **技能自演化** 不在本仓库，由外部工具（[SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)）完成。

权威设计决策以 [docs/skill-design-document_SSoT.md](./docs/skill-design-document_SSoT.md) 为单一事实来源（SSoT）。

## 2. 关键目录速查

| 目录 | 用途 | Agent 行动要点 |
|---|---|---|
| `w-model-dev/` | **技能资产主体**（标准 skill 结构，可整体拷贝分发） | 安装时整体拷贝此目录；运行时按阶段加载 `references/phase-N-*.md` |
| `w-model-dev/SKILL.md` | 编排逻辑 + 命令接口 + 架构定位 | Agent 首次进入仓库必读；`/wm` 命令由其承载 |
| `w-model-dev/references/` | 阶段细则 / verifier-spec（含五轴评审 §7.4A）/ agent-personas（4 个评审角色提示词）/ subagent-delegation（O/A/S/V/G 编排者-子代理边界，A 为阶段 1–4 分析子代理）/ definition-of-done（项目级 DoD）/ anti-patterns（17 条流程反模式含 #10 编排者越权实施 + #11 ingestion 跳过图谱校验 + #12 A 自评收敛 + #13 信息流黑洞/奇迹/死模块放行 + #14 跳过 SANY 直接 TLC + #15 死锁/不变式违反放行 + #16 TLA+ 占位/简化/错误实现 + #17 TLA+ 建模不符需求/设计不回退 + L1~L4 教训 + 失败模式 F1~F10）/ ingestion-chunk / ingestion-cross（A 子代理分块与合并细则）/ graph-guide（图谱门禁与收敛准则，含信息流模型）/ tla-plus-guide（TLA+ 层次化状态机建模与行为门禁）/ command-reference / operational-recovery / 数据模型 / RTM 指南 / 质量标准 | **按需加载**，禁止一次性载入全部（反例 #5） |
| `w-model-dev/scripts/` | 自包含门禁脚本（仅依赖 `tsx`）：`gate-logic.ts` + `check-artifact-gate.ts`（工件质量门）/ `verifier-logic.ts` + `check-verifier-output.ts`（Verifier 校验）/ `graph-logic.ts` + `check-requirement-graph.ts`（阶段 1–4 图谱结构门禁 + 信息流校验：黑洞/奇迹/死模块/边界完整性）/ `tla-logic.ts` + `check-tla-model.ts`（阶段 1–4 TLA+ 行为门禁：SANY 语法 + TLC 模型检查 + 文件头/层次/拆解一致性）/ `plan-chunks.ts`（ingestion 分块策略）/ `self-test.ts`（回归基线） | Agent 在阶段门 / 质量门 / 图谱门禁 / TLA+ 行为门禁检查点直接 `npx tsx` 执行 |
| `w-model-dev/templates/` | 文档模板（需求 / 设计 / 测试 / RTM 等） | 产出文档时套用对应模板 |
| `w-model-dev/examples/` | 交互示例（需求分析 / 设计 / 编码 / 测试执行） | 产出前参考对应示例 |
| `w-model-dev-demo/` | **参考实现**：博客系统后端（Express + TypeScript），W 模型 8 阶段端到端调测产物 | 学习 W 模型实际产出形态时参考；不是技能运行时依赖 |
| `docs/` | 设计文档统一存放（SSoT / 集成设计 / 安装指南） | 修改设计先改 SSoT，再改 `w-model-dev/` 资产 |
| `eval/` | 外部工具（darwin-skill）评估产物归档 | 不属技能包，Agent 一般无需读取 |
| `.githooks/pre-push` | 本地推送前门禁（替代远程 CI） | 修改 `w-model-dev/scripts/**` / `package.json` / `.githooks/pre-push` 后会触发 |

## 3. 常用命令

```bash
# 校验脚本（自包含，仅依赖 tsx）
npm run self-test                           # 37 条样本回归基线（10 Verifier + 7 Gate + 12 Graph + 8 TLA），退出码 0/1
npm run check:verifier -- <output.json>     # Verifier 输出校验，退出码 0/1/2
npm run check:gate -- [project-dir]         # 工件质量门，退出码 0/1/2
npm run check:graph -- <graph.json> [--phase=1|2|3|4]  # 阶段 1–4 图谱结构门禁，退出码 0/1/2
npm run check:tla -- <tla-manifest.json> [--phase=1|2|3|4] [--spec=<id>] [--skip-tlc]  # 阶段 1–4 TLA+ 行为门禁，退出码 0/1/2

# 一次性启用本地推送前门禁（写入本地 .git/config，不影响仓库内容）
npm run setup:hooks

# 手动跑推送前门禁（不实际推送）
npm run prepush
```

退出码约定：`0 = 通过 / 1 = 校验失败 / 2 = 输入错误`。Agent 在 🔴 CHECKPOINT 处必须以脚本退出码为准，**不得用 LLM 估算**（反例 #3 / #6 / #7 / #12）。

## 4. 参考实现：`w-model-dev-demo/`

`w-model-dev-demo/` 是 W 模型 8 阶段端到端调测的完整产物，验证「编排逻辑 + LLM-as-a-Verifier 阶段门 + 工件质量门」端到端可用：

- **项目**：博客系统后端（blog-system-demo），Express 4 + TypeScript 5 + 内存存储
- **8 阶段产出**：`docs/`（需求 / 系统 / 概要 / 详细设计 + 四级测试用例与报告）+ `src/`（控制器 / 服务 / 存储 / 中间件）+ `tests/`（单元 / 集成 / 系统 / 验收 / 性能）+ `tests/perf/`（k6 性能基线脚本）
- **端到端调测结论**（2026-07-23，第四轮，全量删除后从零重跑，含信息流校验特性）：

| 指标 | 数值 |
|---|---|
| 单元测试 | 53/53 通过，代码覆盖率 96.37% lines / 93.57% branches / 92.30% functions / 96.37% statements（NFR-004 要求 ≥ 80%） |
| 集成测试 | 13/13 通过，覆盖 4 对模块交互 + 5 类错误路径，零 mock |
| 系统测试 | 8/8 通过，覆盖端到端业务链路 + 安全约束 + 性能基线 + 异常路径，P95=4.66ms（≤ 200ms） |
| 验收测试 | 15/15 通过，4/4 需求 RTM 覆盖率 100% |
| 性能基线 | k6 脚本就绪（`tests/perf/k6-load-test.js`，100 VUs × 30s，P95 < 200ms），vitest 内近似采样 P95=4.66ms |
| 阶段门评审 | 8 阶段全部放行（qualityLevel 均为 A，compositeScore 0.897~0.9405） |
| 图谱校验 | 阶段 1-4 退出码 0，最终图谱 43 节点 182 边，信息流零违反（无黑洞/奇迹/死模块），EXT-IN/EXT-OUT 边界完整，1 轮收敛 |
| 工件质量门 | 通过（RTM 100% + 单元覆盖率 96.37% + 四级测试全通过，退出码 0） |
| 自检基线 | 37/37 通过（10 Verifier + 7 Gate + 12 Graph + 8 TLA，含信息流校验用例） |
| 全量测试 | `npm test` → 18 test files / 89 tests 全通过（53 unit + 13 integration + 8 system + 15 acceptance） |
| 用户确认 | `confirm`（self-as-verifier 模式，调测者代签；2026-07-23 全量重跑通过） |

> 第四轮（2026-07-23）相比第三轮：删除 `.w-model/`/`docs/`/`src/`/`tests/`/`coverage/` 全部阶段产物后，按 W 模型 8 阶段从零端到端重跑，验证信息流校验特性合入后技能编排端到端可用。重跑产物为独立再实现，单元测试 71→53、覆盖率由 100% 全维度回落至 96.37%/93.57%/92.30%（仍 ≥ 80% 阈值），集成/系统/验收测试计数不变，所有门禁退出码仍为 0，图谱零违反收敛 1 轮达成。本轮未引入新缺陷。

- **过程中发现并修正的缺陷**：
  1. **Express 4 async handler 不自动捕获 rejected promise**（2026-07-20 首轮）：新建 `src/utils/async-handler.ts` 包装器，包裹全部路由后重跑 6/6 通过。详见 [w-model-dev-demo/docs/integration-test-report.md](./w-model-dev-demo/docs/integration-test-report.md) §5。
  2. **JWT_SECRET 缺失导致测试套件加载失败**（2026-07-21 回归发现）：`src/utils/env.ts` 在 import 阶段即抛错，连锁导致 4 个测试套件挂掉。修正方案：`package.json` 所有 test 脚本统一用 `cross-env JWT_SECRET=test-secret-blog-demo` 注入。
  3. **ArticleService 类型导出消失**（2026-07-21 回归发现）：`src/services/article-service.ts` 改为内部 `class ArticleService` + `export const articleService` 实例，导致 `comment-service.ts` 的 `import type { ArticleService }` 类型丢失。修正方案：恢复 `export class ArticleService`。
  4. **vitest mock 与 express NextFunction 类型不兼容**（2026-07-21 回归发现）：`vi.fn() as unknown as NextFunction` 丢失 mock 类型，`next.mock.calls[0][0]` 报 TS2339。修正方案：用 `(next as ReturnType<typeof vi.fn>).mock.calls[0][0]` 等带类型断言访问。

  详见 [w-model-dev-demo/docs/integration-test-report.md](./w-model-dev-demo/docs/integration-test-report.md) §5 与 [acceptance-test-report.md](./w-model-dev-demo/docs/acceptance-test-report.md) §9。

- **调测模式**：self-as-verifier（Agent 按本技能编排自驱完成 8 阶段，每阶段跑质量门，不暂停 CHECKPOINT）。

> Agent 在向用户解释 W 模型实际产出形态、阶段产物颗粒度、测试用例设计粒度时，可指向此目录作为具象参考。**不要**把 `w-model-dev-demo/` 视为技能运行时依赖——它不参与 `/wm` 命令编排，也不会被 `check-*-gate.ts` 读取。

## 5. 必读文档

按以下顺序建立上下文：

1. [README.md](./README.md) — 项目导航（人类可读）
2. [docs/skill-design-document_SSoT.md](./docs/skill-design-document_SSoT.md) — 单一事实来源
3. [w-model-dev/SKILL.md](./w-model-dev/SKILL.md) — 编排逻辑与命令执行规则
4. [docs/INSTALL.md](./docs/INSTALL.md) — AI Agent 安装指南
5. [docs/adoption-guide.md](./docs/adoption-guide.md) — 采用路径（Greenfield vs Brownfield，人类可读；SSoT §11A 为权威定义）
6. [CONTRIBUTING.md](./CONTRIBUTING.md) — 贡献与文档维护规则
7. [CHANGELOG.md](./CHANGELOG.md) — 变更历史

## 6. 行动约束

- **SSoT 优先**：修改设计决策先改 `docs/skill-design-document_SSoT.md`，再同步 `w-model-dev/` 资产（`SKILL.md` / `references/` / `scripts/` / `templates/`），最后同步 `README.md` / `CONTRIBUTING.md` / `AGENTS.md` / `CHANGELOG.md`。
- **脚本自包含**：`w-model-dev/scripts/*.ts` 不得 `import` 任何 `src/` 或外部业务模块，仅依赖本目录内文件与 Node 标准库。
- **不引入 LLM 调用**：技能包内任何文件都不得直接调用 LLM；LLM-as-a-Verifier 评审通过提示词委托 V 子代理执行。
- **CHECKPOINT 不可绕过**：`w-model-dev/SKILL.md` 中 `🔴 CHECKPOINT` 标记的暂停点必须等用户确认，不得自动推进。
- **真实测试结果回填**：`/wm test` 不得自动将测试标记为通过，必须由真实测试运行器执行后通过 `result=pass|fail` 回填（由 S 子代理执行回填，编排者不得越权）。
- **编排者最小化**：编排者只做编排（路由 / 状态读写 / CHECKPOINT / 分派子代理 / 持久化 / 只读脚本），任何实施动作由 S / V / G 子代理执行。违反命中反模式 #10，回到当前阶段起点。详见 [`w-model-dev/references/subagent-delegation.md`](./w-model-dev/references/subagent-delegation.md)。
