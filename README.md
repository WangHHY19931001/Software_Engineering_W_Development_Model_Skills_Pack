# W-Model AI Assistant Skill

> 基于 AI 辅助编码与 LLM-as-a-Verifier 的 W 开发模型闭环工作技能。
>
> 将软件工程 W 模型（需求 → 设计 → 编码 → 测试）的 8 个阶段编排为可执行的 `/wm` 命令，
> 自动维护需求跟踪矩阵（RTM）、在验收阶段触发工件质量门检查。
>
> **架构定位**：技能包只包含提示词、参考、模板，里面的脚本只做门禁，不涉及 LLM 调用。
> LLM-as-a-Verifier 评审由外部 Agent 按提示词执行；技能自演化由外部工具（SkillOpt / darwin-skill）完成。

## 核心能力

- **W 模型 8 阶段编排**：需求分析 → 系统设计 → 概要设计 → 详细设计 → 编码 → 集成测试 → 系统测试 → 验收测试
- **编排者最小化（Orchestrator Minimization）**：编排者（O）只做编排（路由 / 状态读写 / CHECKPOINT 等待 / 分派子代理 / 持久化 / 只读脚本）；任何修改、编码、调测、分析、修正、验证产出的实施动作必须由子代理（S 产出 / V 评审 / G 门禁 / R 根因定位）执行。违反命中反模式 #10，回到当前阶段起点。详见 [subagent-delegation.md](./w-model-dev/references/subagent-delegation.md)
- **LLM-as-a-Verifier（V 子代理执行）**：基于 [arXiv:2607.05391](https://arxiv.org/abs/2607.05391) 的连续评分 [0,1]（4 位小数）+ 三维度验证（粒度 / 重复 / 分解）+ PPT 排序；技能提供提示词与输出 Schema，V 子代理执行 LLM 调用（即「外部 Agent」），技能用校验脚本防漂移；编排者不得自评
- **Agent Personas（评审角色提示词，V 子代理执行）**：4 个 W 模型适配 Persona（code-reviewer / test-engineer / security-auditor / performance-auditor），由 V 子代理在执行 `/wm review` 时按 `targetKind` 路由选用；Persona 文件本身是 Markdown，不调用 LLM；产出 JSON 须满足 `verifier-spec.md` §7 Schema
- **五轴评审 + Severity 标签**：Correctness / Readability / Architecture / Security / Performance 五轴评审 + Severity 标签（Critical / Required / Optional / Nit / FYI），作为 `reworkHints` 字符串前缀；吸收自 addyosmani/agent-skills `code-review-and-quality`
- **核心操作行为 + 失败模式清单**：6 条核心操作行为（Surface Assumptions / Manage Confusion Actively / Push Back When Warranted / 等）+ 10 条失败模式 F1~F10（行为退化，命中不回退但登记）；与 19 条流程反模式（流程破坏，命中即回退，含 #10 编排者越权实施 / #11 ingestion 跳过图谱校验 / #12 A 自评收敛 / #13 信息流黑洞/奇迹/死模块放行 / #14 跳过 SANY 直接 TLC / #15 死锁/不变式违反放行 / #16 TLA+ 占位/简化/错误实现 / #17 TLA+ 建模不符需求/设计不回退 / #18 跳过 R 直接 S 返工 / #19 R 报告未 V 复审直接 S 修复）二分；F# 重复命中 ≥2 次升级为 L# 教训
- **项目级 Definition of Done**：5 维度（功能 / 质量 / 测试 / 文档 / 部署）的每次变更日常标准，与阶段门质量门互补
- **RTM 自动维护**：从项目状态自动重建需求跟踪矩阵，双向追溯需求 ↔ 设计 ↔ 代码 ↔ 四级测试
- **状态持久化**：JSON 文件存储，跨多轮交互保持上下文
- **工件质量门**：RTM 需求覆盖率 100% + 四级测试全部通过才允许交付（技能验证门已移除，演化评估移交外部工具；单元测试代码覆盖率阈值 ≥ 80% 属于质量标准，与 RTM 覆盖率是两个独立指标）
- **返工循环：R 根因定位者 + S 兼 F 修复者**：V/G 不通过后，必先分派 R（根因定位者，第 6 角色）接收 `reworkHints` + 失败产物 + 上游产物，运用根因分析方法论（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）定位缺陷根因，产出 `RootCauseReport`（含根因链 / 上游缺陷标记 / 修复建议 / 防御措施）；经 V 复审（`targetKind=rootcause`）+ G 门禁（`check-rootcause-report.ts`）通过后，S 兼 F 携 R 报告执行修复（按 `fixRecommendation`）；新增反模式 #18（跳过 R 直接 S 返工）/ #19（R 报告未 V 复审直接 S 修复）；正常路径 `S → V → G → 下一阶段`，返工路径 `V/G 不通过 → R 定位 → V 复审 → G 门禁 → S-fix 修复 → V → G → 下一阶段`；详见 [root-cause-locator.md](./w-model-dev/references/root-cause-locator.md)
- **TLA+ 层次化状态机建模 + 代码-TLA+ 一致性回归**：阶段 1-4 用 TLA+ 建模系统/子系统/原子行为（L1-L3+ 层次化），G 子代理跑 `check-tla-model.ts` 校验 SANY 语法 + TLC 模型检查；阶段 5 G 子代理跑 `check-code-tla-consistency.ts` 四维度校验（SD→codeModule 映射 / 代码状态转移 / Next 分支对应 / 断言覆盖不变式），将 TLA+ 资产作为状态机验证器回归编码产物
- **PPT 排序算法**：O(N×k) 复杂度的概率枢轴锦标赛，用于测试用例优先级排序
- **采用路径（Greenfield vs Brownfield）**：新项目 Day 0 跑全流程 vs 存量项目增量验证优先，见 [采用路径指南](./docs/adoption-guide.md)；吸收自 addyosmani/agent-skills `docs/adoption-guide.md` 并适配 W 模型 8 阶段

## 架构原则与外部工具边界

本技能遵循「技能包只包含提示词、参考、模板，里面的脚本只做门禁，不涉及 LLM」的架构原则。

| 能力 | 归属 | 实现位置 |
|---|---|---|
| W 模型阶段编排、RTM 维护、状态管理 | 技能内 | `w-model-dev/SKILL.md`（编排逻辑，Agent 执行）+ `w-model-dev/references/*`（阶段细则） |
| 工件质量门 | 技能内（脚本只做门禁） | `w-model-dev/scripts/gate-logic.ts` + `check-artifact-gate.ts` |
| LLM-as-a-Verifier 评审（三维度 / 连续评分 / PPT / 子标准） | 技能内提供提示词与 Schema，外部 Agent 执行 | `w-model-dev/references/verifier-spec.md` + `scripts/check-verifier-output.ts` |
| LLM 推理本身 | 外部 | 由外部 Agent（Trae / Claude / Cursor 等）自行调用其 LLM |
| 技能自演化（Rollout / Reflect / Edit / Skill Lift 评估） | 外部 | [SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill) |

详见 SSoT [§3.3 技能架构原则与外部工具边界](./docs/skill-design-document_SSoT.md)。

## 快速上手

### AI Agent 安装（零依赖）

将 [`w-model-dev/`](./w-model-dev) 目录拷贝到你的 AI Agent（Trae / Claude Code 等）的 skills 目录即可。Skill 资产自包含：`SKILL.md` 定义触发条件与编排，`references/` / `templates/` / `examples/` 按需加载，无需 Node.js 或 npm。

```bash
# 拷贝 skill 目录到 agent 的 skills 位置（路径以你的 agent 为准）
cp -r w-model-dev /path/to/agent/skills/w-model-dev
```

安装后，agent 在用户提及 W 模型或 `/wm` 命令时自动激活本技能。详细步骤与验证方法见 [docs/INSTALL.md](./docs/INSTALL.md)。

### 运行门禁校验脚本

技能包内的校验脚本（`w-model-dev/scripts/*.ts`）是自包含的 TypeScript，由外部 Agent 在阶段门评审时直接执行。脚本仅依赖 [tsx](https://tsx.is/) 运行 ESM，无任何业务依赖：

```bash
# 方式一：用 npm run 快捷脚本（需先在仓库根目录 npm install，安装 tsx 一次）
npm install
npm run check:verifier -- <output.json>     # 退出码 0/1/2
npm run check:gate -- [project-dir]         # 退出码 0/1/2
npm run check:graph -- <graph.json> [--phase=1|2|3|4]  # 图谱结构门禁，退出码 0/1/2
npm run check:tla -- <tla-manifest.json> [--phase=1|2|3|4] [--spec=<id>] [--skip-tlc]  # TLA+ 行为门禁，退出码 0/1/2
npm run self-test                           # 退出码 0/1

# 方式二：用 npx tsx 按需拉取（无需 npm install，适合一次性使用）
npx tsx w-model-dev/scripts/check-verifier-output.ts <output.json>
npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]
npx tsx w-model-dev/scripts/check-requirement-graph.ts <graph.json> [--phase=1|2|3|4]
npx tsx w-model-dev/scripts/check-tla-model.ts <tla-manifest.json> [--phase=1|2|3|4] [--skip-tlc]
npx tsx w-model-dev/scripts/check-code-tla-consistency.ts --manifest=<path> --graph=<path> --rtm=<path> --src=<dir>  # 代码-TLA+ 一致性回归，退出码 0/1
npx tsx w-model-dev/scripts/self-test.ts
```

> 脚本不调用任何 LLM，仅做结构化门禁判定。
> `self-test.ts` 是校验逻辑的回归基线：每次修改 `gate-logic.ts` / `verifier-logic.ts` / `graph-logic.ts` 后必须跑通，新增校验项需同步增加样本。

## 命令一览

| 命令 | 说明 |
|---|---|
| `/wm analyze <需求描述>` | 需求分析，同步产出验收测试设计 |
| `/wm design type=<架构\|概要\|详细>` | 设计阶段，同步产出对应测试设计 |
| `/wm code <功能描述>` | 编码实现，同步产出单元测试用例（不自动标记通过） |
| `/wm test type=<单元\|集成\|系统\|验收> result=<pass\|fail>` | 回填指定类型测试真实执行结果 |
| `/wm review <目标ID或文件路径>` | 返回结构化评审指引（指向 `verifier-spec.md` + `check-verifier-output.ts`，不内置 LLM） |
| `/wm status` | 查看当前阶段、进度、RTM 覆盖率 |
| `/wm help` | 显示帮助 |
| `/wm reset` | 重置项目（保留元信息，清空实体） |
| `/wm export [输出目录]` | 导出项目 JSON + RTM Markdown |
| `/wm import <文件路径>` | 从 JSON 导入项目 |

## 参考实现：`w-model-dev-demo/`

[`w-model-dev-demo/`](./w-model-dev-demo) 是 W 模型 8 阶段端到端调测的完整产物——一个博客系统后端（Express 4 + TypeScript 5 + 内存存储），用于验证「编排逻辑 + LLM-as-a-Verifier 阶段门 + 工件质量门」端到端可用。

**端到端调测结论**（2026-07-24，全量删除后从零重跑第五轮，编排者-子代理分派模式，含代码-TLA+ 一致性回归）：

| 指标 | 数值 |
|---|---|
| 单元测试 | 77/77 通过，代码覆盖率 99.37% lines / 92.66% branches / 100% functions / 99.37% statements（NFR-004 要求 ≥ 80%） |
| 集成测试 | 21/21 通过，覆盖 4 对模块交互 + 5 类错误路径，零 mock |
| 系统测试 | 22/22 通过，覆盖端到端业务链路 + 安全约束 + 性能基线 + 异常路径，P95=60.76ms（≤ 200ms） |
| 验收测试 | 15/15 通过，5/5 需求 RTM 覆盖率 100% |
| 阶段门评审 | 8 阶段全部放行（qualityLevel 均为 A，compositeScore 0.9015~0.922） |
| 图谱校验 | 阶段 1-4 退出码 0，最终图谱 35 节点 141 边，信息流零违反（无黑洞/奇迹/死模块），EXT-IN/EXT-OUT 边界完整 |
| TLA+ 行为门禁 | 阶段 1-4 退出码 0，8 个规格（1 L1 + 4 L2 + 3 L3），SANY 语法 + TLC 模型检查全通过，零死锁/不变式违反/状态爆炸 |
| 代码-TLA+ 一致性回归 | 阶段 5 退出码 0，四维度全通过（SD→codeModule 映射 / 代码状态转移 / Next 分支对应 / 断言覆盖不变式） |
| 工件质量门 | 通过（RTM 100% + 单元覆盖率 99.37% + 四级测试全通过 + TLA+ 资产✓，退出码 0） |
| 全量测试 | `npm test` → 8 test files / 135 tests 全通过（77 unit + 21 integration + 22 system + 15 acceptance） |
| 自检基线 | `npm run self-test` → 66/66 通过（13 Verifier + 7 Gate + 17 Graph + 13 TLA + 3 Budget + 4 RunLog + 2 Maturity + 2 Checkpoint + 5 Code-TLA+） |
| 用户确认 | `confirm`（self-as-verifier 模式，调测者代签；2026-07-24 全量重跑通过） |

> 第五轮（2026-07-24）相比第四轮：删除 `.w-model/`/`docs/`/`src/`/`tests/`/`coverage/`/`dist/` 全部阶段产物后，按 W 模型 8 阶段从零端到端重跑，采用编排者-子代理分派模式（每阶段 S→V→G 子代理执行）。重跑产物为独立再实现，单元测试 53→77、覆盖率由 96.37% 提升至 99.37%（lines），集成测试 13→21、系统测试 8→22，验收测试 15 不变，全量测试 89→135。图谱节点 43→35（更精炼的 DD 拆分），边 182→141，零违反保持。TLA+ 规格 8 个（1 L1 + 4 L2 + 3 L3），层次化建模完整。阶段 5 新增代码-TLA+ 一致性回归门禁（`check-code-tla-consistency.ts` 四维度校验）。过程中修正了 check-artifact-gate.ts 缺 exitCode 字段的脚本缺陷。所有门禁退出码 0，未引入新缺陷。

过程中发现并修正的缺陷（累计 5 项）：

1. **Express 4 async handler 不自动捕获 rejected promise**（2026-07-20 首轮）：引入 `src/utils/async-handler.ts` 包装器。详见 [w-model-dev-demo/docs/integration-test-report.md](./w-model-dev-demo/docs/integration-test-report.md) §5。
2. **JWT_SECRET 缺失导致测试套件加载失败**（2026-07-21 回归发现）：`src/utils/env.ts` 在 import 阶段抛错连锁挂掉 4 个测试套件。修正方案：`package.json` 所有 test 脚本统一用 `cross-env JWT_SECRET=test-secret-blog-demo` 注入。
3. **ArticleService 类型导出消失**（2026-07-21 回归发现）：`comment-service.ts` 的 `import type { ArticleService }` 类型丢失。修正方案：恢复 `export class ArticleService`。
4. **vitest mock 与 express NextFunction 类型不兼容**（2026-07-21 回归发现）：`next.mock.calls[0][0]` 报 TS2339。修正方案：用 `(next as ReturnType<typeof vi.fn>).mock.calls[0][0]` 等带类型断言访问。
5. **check-artifact-gate.ts 缺 exitCode 字段**（2026-07-24 第五轮发现）：唯一未在 `GATE_JSON` 输出中包含 `exitCode` 的门禁脚本，导致 `check-run-log.ts` R6 交叉校验无法提取退出码。修正方案：与其它 7 个 `check-*.ts` 脚本对齐，计算并输出 `exitCode`。

> 该目录是参考实现，**不参与 `/wm` 命令编排**，也不会被 `check-*-gate.ts` 读取。Agent 在向用户解释 W 模型实际产出形态、阶段产物颗粒度、测试用例设计粒度时可指向此目录。

## 项目结构

```
.
├── w-model-dev/                  # Skill 资产（标准 skill 结构，自包含、可独立拷贝分发）
│   ├── SKILL.md                  # Skill 定义（YAML frontmatter + 编排 + 架构定位 + 核心操作行为）
│   ├── references/               # 阶段细则与规范（按需加载）
│   │   ├── phase-1-requirements.md … phase-8-acceptance-test.md
│   │   ├── anti-patterns.md      #   反例与黑名单（19 条流程反模式含 #10 编排者越权实施 / #11 ingestion 跳过图谱校验 / #12 A 自评收敛 / #13 信息流黑洞/奇迹/死模块放行 / #14 跳过 SANY 直接 TLC / #15 死锁/不变式违反放行 / #16 TLA+ 占位/简化/错误实现 / #17 TLA+ 建模不符需求/设计不回退 / #18 跳过 R 直接 S 返工 / #19 R 报告未 V 复审直接 S 修复 + 实现层经验教训 L1~L4 + 失败模式清单 F1~F10）
│   │   ├── workflow.md           #   完整工作流程（流程图 + 阶段并行表 + 阶段门评审）
│   │   ├── verifier-spec.md      #   LLM-as-a-Verifier 评审规范（提示词 + Schema + 子标准 + 五轴评审 §7.4A）
│   │   ├── agent-personas.md     #   Agent Personas（4 个评审角色提示词：code-reviewer / test-engineer / security-auditor / performance-auditor）
│   │   ├── subagent-delegation.md#   编排者-子代理边界（O/A/S/V/G/R 六角色 + 分派模板 + 回填契约 + 反模式 #10/#11/#12/#13/#14/#15/#16/#17/#18/#19）
│   │   ├── root-cause-locator.md  #   R 根因定位者方法论（4 种方法 + 质量标准 + 多人格多角度分析）
│   │   ├── ingestion-chunk.md    #   A 子代理分块分析细则（阶段 1–4）
│   │   ├── ingestion-cross.md    #   A 子代理交叉合并与图谱演进细则（阶段 1–4）
│   │   ├── graph-guide.md        #   图谱门禁与收敛准则（check-requirement-graph.ts）
│   │   ├── tla-plus-guide.md     #   TLA+ 层次化状态机建模与行为门禁（check-tla-model.ts）
│   │   ├── definition-of-done.md #   项目级 Definition of Done（每次变更的日常标准，5 维度）
│   │   ├── data-models.md        #   项目 / 需求 / 设计 / 测试用例数据模型
│   │   ├── rtm-guide.md          #   RTM 维护规则
│   │   └── quality-standards.md #   质量标准
│   ├── scripts/                  # 只做门禁 / 校验，不调用 LLM（自包含，仅依赖 tsx）
│   │   ├── gate-logic.ts         #   工件质量门纯逻辑（单点事实源，含 TLA+ 资产 + SD→codeModule 终检）
│   │   ├── check-artifact-gate.ts#   工件质量门 CLI（读 .w-model/rtm.json + graph.json + tla-manifest.json）
│   │   ├── verifier-logic.ts     #   Verifier 输出校验纯逻辑（单点事实源）
│   │   ├── check-verifier-output.ts  # Verifier 输出校验 CLI（防 Agent 输出漂移）
│   │   ├── graph-logic.ts        #   图谱结构门禁纯逻辑（单点事实源，阶段 1–4，含信息流校验：黑洞/奇迹/死模块/边界完整性）
│   │   ├── check-requirement-graph.ts  # 图谱结构门禁 CLI（连通/单根/父唯一/阶段追溯 + 信息流校验，退出码 0/1/2）
│   │   ├── tla-logic.ts          #   TLA+ 行为门禁纯逻辑（单点事实源，阶段 1–4，文件头/层次/拆解一致性校验）
│   │   ├── check-tla-model.ts    #   TLA+ 行为门禁 CLI（SANY 语法 + TLC 模型检查 + 文件头/层次/拆解一致性，退出码 0/1/2）
│   │   ├── code-tla-logic.ts     #   代码-TLA+ 一致性校验纯逻辑（单点事实源，阶段 5，四维度：SD→codeModule/状态转移/Next分支/不变式覆盖）
│   │   ├── check-code-tla-consistency.ts  # 代码-TLA+ 一致性回归 CLI（TypeScript Compiler API 解析 AST，退出码 0/1）
│   │   ├── plan-chunks.ts        #   ingestion 分块策略（混合：文件/目录+超限拆分）
│   │   ├── self-test.ts          #   校验逻辑自检（samples/ 驱动，回归基线）
│   │   └── samples/              #   端到端样本（verifier/ + gate/ + graph/ + tla/ + tla-e2e/ + code-tla/）
│   ├── templates/                # 文档模板（需求 / 设计 / 测试 / RTM 等）
│   └── examples/                 # 交互示例（需求分析 / 系统设计 / 编码 / 测试执行）
├── w-model-dev-demo/             # 参考实现：博客系统后端（W 模型 8 阶段端到端调测产物，已归档）
│   ├── docs/                     #   8 阶段产出文档（需求 / 设计 / 四级测试用例与报告）
│   ├── src/                      #   实现代码（Express + TS，控制器 / 服务 / 存储 / 中间件）
│   ├── tests/                    #   四级测试（unit / integration / system / acceptance）+ perf/（k6 性能基线）
│   ├── .w-model/                 #   项目状态（project.json + rtm.json，用户 confirm 归档）
│   ├── package.json              #   demo 自身的依赖与脚本（独立于根 package.json，test 脚本用 cross-env 注入 JWT_SECRET）
│   ├── tsconfig.json
│   └── vitest.config.ts
├── docs/                         # 设计文档（统一存放）
│   ├── skill-design-document_SSoT.md           # 设计文档（单一事实来源）
│   ├── skill-design-document.md                # 设计文档指针（已废弃独立维护）
│   ├── llm-verifier-integration-design.md      # LLM Verifier 集成设计（指针文档）
│   └── INSTALL.md                              # AI Agent 安装指南
├── eval/                         # 外部工具（darwin-skill）评估产物归档，不属技能包
│   ├── w-model-dev-test-prompts.json           #   评估测试场景（3 个典型 / 歧义场景）
│   └── w-model-dev-results.tsv                 #   评估历史记录（得分轨迹）
├── .githooks/pre-push            # 本地推送前门禁（替代远程 CI，仅触及脚本 / package.json 时触发）
├── AGENTS.md                     # AI Agent 仓库导航（与 README 互补，聚焦 Agent 行动事实集）
├── package.json                  # 仅声明 tsx 开发依赖 + npm run 快捷脚本（private，不发布）
├── CHANGELOG.md                  # 变更日志
├── CONTRIBUTING.md               # 贡献指南
└── README.md                     # 项目导航
```

> 编排逻辑由 `w-model-dev/SKILL.md` 承载，Agent 读取后用自身工具执行；不内置任何
> TypeScript 引擎、npm 包或编程式 SDK。`/wm` 命令、状态持久化、RTM 维护均由 Agent
> 按 `SKILL.md` 与 `references/` 在项目内（`.w-model/*.json`）完成。
> `w-model-dev-demo/` 是参考实现，独立于技能资产，不参与 `/wm` 命令编排。

## 相关文档

- [设计文档（SSoT）](./docs/skill-design-document_SSoT.md) - 单一事实来源
- [Skill 定义](./w-model-dev/SKILL.md) - AI 助理触发命令与阶段流
- [LLM-as-a-Verifier 评审规范](./w-model-dev/references/verifier-spec.md) - 提示词 + Schema + 子标准 + 五轴评审 §7.4A
- [Agent Personas](./w-model-dev/references/agent-personas.md) - 4 个评审角色提示词（code-reviewer / test-engineer / security-auditor / performance-auditor）
- [反例与失败模式](./w-model-dev/references/anti-patterns.md) - 19 条流程反模式（含 #10 编排者越权实施 / #11 ingestion 跳过图谱校验 / #12 A 自评收敛 / #13 信息流黑洞/奇迹/死模块放行 / #14 跳过 SANY 直接 TLC / #15 死锁/不变式违反放行 / #16 TLA+ 占位/简化/错误实现 / #17 TLA+ 建模不符需求/设计不回退 / #18 跳过 R 直接 S 返工 / #19 R 报告未 V 复审直接 S 修复）+ L1~L4 实现层教训 + F1~F10 失败模式
- [编排者-子代理边界](./w-model-dev/references/subagent-delegation.md) - O/A/S/V/G/R 六角色 + 分派模板 + 回填契约 + 反模式 #10/#11/#12/#13/#14/#15/#16/#17/#18/#19
- [根因定位者方法论](./w-model-dev/references/root-cause-locator.md) - R 角色 4 种根因分析方法（5-Why / 鱼骨图 / 缺陷链追溯 / 上游回溯）+ 质量标准 + 多人格多角度分析
- [ingestion 子流程：分块分析](./w-model-dev/references/ingestion-chunk.md) - A 子代理分块分析细则（阶段 1–4）
- [ingestion 子流程：交叉合并与图谱演进](./w-model-dev/references/ingestion-cross.md) - A 子代理合并建图 + 收敛循环（阶段 1–4）
- [图谱门禁与收敛准则](./w-model-dev/references/graph-guide.md) - check-requirement-graph.ts 用法 + 收敛判定
- [TLA+ 层次化状态机建模](./w-model-dev/references/tla-plus-guide.md) - check-tla-model.ts 用法 + 层级模型 + 文件头规范 + SANY/TLC 门禁 + 命名规范 + 路径基准 + 前置清单
- [项目级 DoD](./w-model-dev/references/definition-of-done.md) - 每次变更的日常标准（5 维度）
- [采用路径指南](./docs/adoption-guide.md) - Greenfield vs Brownfield（SSoT §11A 为权威定义）
- [ingestion 与图谱收敛设计](./docs/ingestion-graph-convergence-design.md) - A 角色 / graph.json / check-requirement-graph.ts 权威设计文档
- [信息流校验设计](./docs/information-flow-validation-design.md) - 黑洞/奇迹/死模块门禁 + EXT-IN/EXT-OUT 边界节点 + 正交叠加设计
- [TLA+ 层次化建模设计](./docs/tla-plus-modeling-design.md) - L1–L6 层级模型 + 文件头规范 + SANY/TLC 门禁 + 拆解阈值权威设计文档
- [LLM Verifier 集成设计](./docs/llm-verifier-integration-design.md) - 指针文档
- [AI Agent 安装指南](./docs/INSTALL.md)
- [Agent 仓库导航](./AGENTS.md) - 面向 AI Agent 的最小事实集
- [参考实现](./w-model-dev-demo) - W 模型 8 阶段端到端调测产物（博客系统后端）
- [变更日志](./CHANGELOG.md)
- [贡献指南](./CONTRIBUTING.md)

## License

MIT
