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
- **LLM-as-a-Verifier（外部 Agent 执行）**：基于 [arXiv:2607.05391](https://arxiv.org/abs/2607.05391) 的连续评分 [0,1]（4 位小数）+ 三维度验证（粒度 / 重复 / 分解）+ PPT 排序；技能提供提示词与输出 Schema，外部 Agent 执行 LLM 调用，技能用校验脚本防漂移
- **RTM 自动维护**：从项目状态自动重建需求跟踪矩阵，双向追溯需求 ↔ 设计 ↔ 代码 ↔ 四级测试
- **状态持久化**：JSON 文件存储，跨多轮交互保持上下文
- **工件质量门**：RTM 需求覆盖率 100% + 四级测试全部通过才允许交付（技能验证门已移除，演化评估移交外部工具；单元测试代码覆盖率阈值 ≥ 80% 属于质量标准，与 RTM 覆盖率是两个独立指标）
- **PPT 排序算法**：O(N×k) 复杂度的概率枢轴锦标赛，用于测试用例优先级排序

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
npm run self-test                           # 退出码 0/1

# 方式二：用 npx tsx 按需拉取（无需 npm install，适合一次性使用）
npx tsx w-model-dev/scripts/check-verifier-output.ts <output.json>
npx tsx w-model-dev/scripts/check-artifact-gate.ts [project-dir]
npx tsx w-model-dev/scripts/self-test.ts
```

> 脚本不调用任何 LLM，仅做结构化门禁判定。
> `self-test.ts` 是校验逻辑的回归基线：每次修改 `gate-logic.ts` / `verifier-logic.ts` 后必须跑通，新增校验项需同步增加样本。

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

**端到端调测结论**（2026-07-20）：

| 指标 | 数值 |
|---|---|
| 单元测试 | 22/22 通过，代码覆盖率 98%（NFR-004 要求 ≥ 80%） |
| 集成测试 | 6/6 通过，覆盖 4 对模块交互 + 5 类错误路径 |
| 系统测试 | 6/6 通过，覆盖 4 模块 + 4 类异常路径 + 4 项安全约束 |
| 验收测试 | 15/15 通过，4/4 需求 RTM 覆盖率 100% |
| 工件质量门 | 通过（RTM 100% + 四级测试全通过） |

过程中发现并修正了 Express 4 不自动捕获 async handler rejected promise 的缺陷（引入 `src/utils/async-handler.ts` 包装器），详见 [w-model-dev-demo/docs/integration-test-report.md](./w-model-dev-demo/docs/integration-test-report.md) §5。

> 该目录是参考实现，**不参与 `/wm` 命令编排**，也不会被 `check-*-gate.ts` 读取。Agent 在向用户解释 W 模型实际产出形态、阶段产物颗粒度、测试用例设计粒度时可指向此目录。

## 项目结构

```
.
├── w-model-dev/                  # Skill 资产（标准 skill 结构，自包含、可独立拷贝分发）
│   ├── SKILL.md                  # Skill 定义（YAML frontmatter + 编排 + 架构定位）
│   ├── references/               # 阶段细则与规范（按需加载）
│   │   ├── phase-1-requirements.md … phase-8-acceptance-test.md
│   │   ├── phase-1-requirements-formalization.md  #   Phase 1 可选增强（委托 SRS-Formalizer）
│   │   ├── anti-patterns.md      #   反例与黑名单（9 条高发陷阱 + 与门禁脚本对应关系 + 实现层经验教训）
│   │   ├── workflow.md           #   完整工作流程（流程图 + 阶段并行表 + 阶段门评审）
│   │   ├── verifier-spec.md      #   LLM-as-a-Verifier 评审规范（提示词 + Schema + 子标准）
│   │   ├── data-models.md        #   项目 / 需求 / 设计 / 测试用例数据模型
│   │   ├── rtm-guide.md          #   RTM 维护规则
│   │   └── quality-standards.md #   质量标准
│   ├── scripts/                  # 只做门禁 / 校验，不调用 LLM（自包含，仅依赖 tsx）
│   │   ├── gate-logic.ts         #   工件质量门纯逻辑（单点事实源）
│   │   ├── check-artifact-gate.ts#   工件质量门 CLI（读 .w-model/rtm.json）
│   │   ├── verifier-logic.ts     #   Verifier 输出校验纯逻辑（单点事实源）
│   │   ├── check-verifier-output.ts  # Verifier 输出校验 CLI（防 Agent 输出漂移）
│   │   ├── self-test.ts          #   校验逻辑自检（samples/ 驱动，回归基线）
│   │   └── samples/              #   端到端样本（verifier/ + gate/）
│   ├── templates/                # 文档模板（需求 / 设计 / 测试 / RTM 等）
│   └── examples/                 # 交互示例（需求分析 / 系统设计 / 编码 / 测试执行）
├── w-model-dev-demo/             # 参考实现：博客系统后端（W 模型 8 阶段端到端调测产物）
│   ├── docs/                     #   8 阶段产出文档（需求 / 设计 / 四级测试用例与报告）
│   ├── src/                      #   实现代码（Express + TS，控制器 / 服务 / 存储 / 中间件）
│   ├── tests/                    #   四级测试（unit / integration / system / acceptance）
│   ├── package.json              #   demo 自身的依赖与脚本（独立于根 package.json）
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
- [LLM-as-a-Verifier 评审规范](./w-model-dev/references/verifier-spec.md) - 提示词 + Schema + 子标准
- [LLM Verifier 集成设计](./docs/llm-verifier-integration-design.md) - 指针文档
- [AI Agent 安装指南](./docs/INSTALL.md)
- [Agent 仓库导航](./AGENTS.md) - 面向 AI Agent 的最小事实集
- [参考实现](./w-model-dev-demo) - W 模型 8 阶段端到端调测产物（博客系统后端）
- [变更日志](./CHANGELOG.md)
- [贡献指南](./CONTRIBUTING.md)

## License

MIT
