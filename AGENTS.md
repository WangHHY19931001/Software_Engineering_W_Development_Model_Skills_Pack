# AGENTS.md

> 面向 AI Agent（Trae / Claude Code / Cursor 等）的仓库导航。
> 与 [README.md](./README.md) 互补：README 面向人类读者，本文件聚焦 Agent 在仓库内行动所需的最小事实集。

## 1. 仓库定位

**W-Model AI Assistant Skill** — 单纯的编排 + 校验脚本技能包：

- **技能资产**（`w-model-dev/`）：纯 Markdown + 自包含 TypeScript 门禁脚本，**不内置 LLM 调用、不包含编程式引擎（无 `src/`、无 npm 包、无 SDK）**。
- **`/wm` 命令、状态持久化、RTM 维护** 由 Agent 读取 `w-model-dev/SKILL.md` 后用自身工具执行，状态写入项目内 `.w-model/*.json`。
- **LLM-as-a-Verifier 评审** 由外部 Agent 按 `w-model-dev/references/verifier-spec.md` 提示词执行，技能用校验脚本防输出漂移。
- **Agent Personas（评审角色提示词）** 由外部 Agent 在执行 `/wm review` 时按 `w-model-dev/references/agent-personas.md` 选用对应 Persona（code-reviewer / test-engineer / security-auditor / performance-auditor），Persona 文件本身是 Markdown，不调用 LLM；产出 JSON 须满足 `verifier-spec.md` §7 Schema。
- **技能自演化** 不在本仓库，由外部工具（[SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)）完成。

权威设计决策以 [docs/skill-design-document_SSoT.md](./docs/skill-design-document_SSoT.md) 为单一事实来源（SSoT）。

## 2. 关键目录速查

| 目录 | 用途 | Agent 行动要点 |
|---|---|---|
| `w-model-dev/` | **技能资产主体**（标准 skill 结构，可整体拷贝分发） | 安装时整体拷贝此目录；运行时按阶段加载 `references/phase-N-*.md` |
| `w-model-dev/SKILL.md` | 编排逻辑 + 命令接口 + 架构定位 | Agent 首次进入仓库必读；`/wm` 命令由其承载 |
| `w-model-dev/references/` | 阶段细则 / verifier-spec（含五轴评审 §7.4A）/ agent-personas（4 个评审角色提示词）/ definition-of-done（项目级 DoD）/ anti-patterns（9 条流程反模式 + L1~L4 教训 + 失败模式 F1~F10）/ command-reference / operational-recovery / 数据模型 / RTM 指南 / 质量标准 | **按需加载**，禁止一次性载入全部（反例 #5） |
| `w-model-dev/scripts/` | 自包含门禁脚本（仅依赖 `tsx`） | Agent 在阶段门 / 质量门检查点直接 `npx tsx` 执行 |
| `w-model-dev/templates/` | 文档模板（需求 / 设计 / 测试 / RTM 等） | 产出文档时套用对应模板 |
| `w-model-dev/examples/` | 交互示例（需求分析 / 设计 / 编码 / 测试执行） | 产出前参考对应示例 |
| `w-model-dev-demo/` | **参考实现**：博客系统后端（Express + TypeScript），W 模型 8 阶段端到端调测产物 | 学习 W 模型实际产出形态时参考；不是技能运行时依赖 |
| `docs/` | 设计文档统一存放（SSoT / 集成设计 / 安装指南） | 修改设计先改 SSoT，再改 `w-model-dev/` 资产 |
| `eval/` | 外部工具（darwin-skill）评估产物归档 | 不属技能包，Agent 一般无需读取 |
| `.githooks/pre-push` | 本地推送前门禁（替代远程 CI） | 修改 `w-model-dev/scripts/**` / `package.json` / `.githooks/pre-push` 后会触发 |

## 3. 常用命令

```bash
# 校验脚本（自包含，仅依赖 tsx）
npm run self-test                           # 17 条样本回归基线（10 Verifier + 7 Gate），退出码 0/1
npm run check:verifier -- <output.json>     # Verifier 输出校验，退出码 0/1/2
npm run check:gate -- [project-dir]         # 工件质量门，退出码 0/1/2

# 一次性启用本地推送前门禁（写入本地 .git/config，不影响仓库内容）
npm run setup:hooks

# 手动跑推送前门禁（不实际推送）
npm run prepush
```

退出码约定：`0 = 通过 / 1 = 校验失败 / 2 = 输入错误`。Agent 在 🔴 CHECKPOINT 处必须以脚本退出码为准，**不得用 LLM 估算**（反例 #3 / #6 / #7）。

## 4. 参考实现：`w-model-dev-demo/`

`w-model-dev-demo/` 是 W 模型 8 阶段端到端调测的完整产物，验证「编排逻辑 + LLM-as-a-Verifier 阶段门 + 工件质量门」端到端可用：

- **项目**：博客系统后端（blog-system-demo），Express 4 + TypeScript 5 + 内存存储
- **8 阶段产出**：`docs/`（需求 / 系统 / 概要 / 详细设计 + 四级测试用例与报告）+ `src/`（控制器 / 服务 / 存储 / 中间件）+ `tests/`（单元 / 集成 / 系统 / 验收 / 性能）+ `tests/perf/`（k6 性能基线脚本）
- **端到端调测结论**（2026-07-21，从零重建第二轮）：

| 指标 | 数值 |
|---|---|
| 单元测试 | 65/65 通过，代码覆盖率 98.96% lines / 93.23% branches / 100% functions（NFR-004 要求 ≥ 80%） |
| 集成测试 | 12/12 通过，覆盖 4 对模块交互 + 5 类错误路径 |
| 系统测试 | 6/6 通过，覆盖 4 模块 + 4 类异常路径 + 4 项安全约束 |
| 验收测试 | 15/15 通过，4/4 需求 RTM 覆盖率 100% |
| 性能基线 | k6 脚本就绪（`tests/perf/k6-load-test.js`，100 VUs × 30s，P95 < 200ms），vitest 内近似采样 P95=3ms |
| 阶段门评审 | 8 阶段全部放行 |
| 工件质量门 | 通过（RTM 100% + 四级测试全通过，退出码 0） |
| 用户确认 | `confirm`（2026-07-21，项目已归档） |

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
- **不引入 LLM 调用**：技能包内任何文件都不得直接调用 LLM；LLM-as-a-Verifier 评审通过提示词委托外部 Agent 执行。
- **CHECKPOINT 不可绕过**：`w-model-dev/SKILL.md` 中 `🔴 CHECKPOINT` 标记的暂停点必须等用户确认，不得自动推进。
- **真实测试结果回填**：`/wm test` 不得自动将测试标记为通过，必须由真实测试运行器执行后通过 `result=pass|fail` 回填。
