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
- **工件质量门**：覆盖率 100% + 所有测试通过才允许交付（技能验证门已移除，演化评估移交外部工具）
- **PPT 排序算法**：O(N×k) 复杂度的概率枢轴锦标赛，用于测试用例优先级排序

## 架构原则与外部工具边界

本技能遵循「技能包只包含提示词、参考、模板，里面的脚本只做门禁，不涉及 LLM」的架构原则。

| 能力 | 归属 | 实现位置 |
|---|---|---|
| W 模型阶段编排、RTM 维护、状态管理 | 技能内 | `src/commands/router.ts` / `src/state/*` / `w-model-dev/SKILL.md` |
| 工件质量门 | 技能内（脚本只做门禁） | `w-model-dev/scripts/gate-logic.ts` |
| LLM-as-a-Verifier 评审（三维度 / 连续评分 / PPT / 子标准） | 技能内提供提示词与 Schema，外部 Agent 执行 | `w-model-dev/references/verifier-spec.md` + `scripts/check-verifier-output.ts` |
| LLM 推理本身 | 外部 | 由外部 Agent（Trae / Claude / Cursor 等）自行调用其 LLM |
| 技能自演化（Rollout / Reflect / Edit / Skill Lift 评估） | 外部 | [SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill) |

详见 SSoT [§3.3 技能架构原则与外部工具边界](./docs/skill-design-document_SSoT.md)。

## 快速上手

本技能提供两种使用方式：**AI Agent 模式**（直接读取 Skill 资产，零依赖）与**程序化模式**（TypeScript 引擎）。

### 方式一：AI Agent 安装（推荐，零依赖）

将 [`w-model-dev/`](./w-model-dev) 目录拷贝到你的 AI Agent（Trae / Claude Code 等）的 skills 目录即可。Skill 资产自包含：`SKILL.md` 定义触发条件与编排，`references/` / `templates/` / `examples/` 按需加载，无需 Node.js 或 npm。

```bash
# 拷贝 skill 目录到 agent 的 skills 位置（路径以你的 agent 为准）
cp -r w-model-dev /path/to/agent/skills/w-model-dev
```

安装后，agent 在用户提及 W 模型或 `/wm` 命令时自动激活本技能。详细步骤与验证方法见 [docs/INSTALL.md](./docs/INSTALL.md)。

### 方式二：程序化安装（TypeScript 引擎）

#### 环境要求

- Node.js ≥ 18.0.0

#### 安装依赖

```bash
npm install
```

#### 运行全流程示例

```bash
npm run example:run
```

该示例走完 W 模型 8 个阶段并导出 RTM。示例不再调用 `/wm review`——LLM-as-a-Verifier 评审由外部 Agent 按 [`w-model-dev/references/verifier-spec.md`](./w-model-dev/references/verifier-spec.md) 执行。

#### 运行测试

```bash
npm test
```

覆盖率目标：全局 ≥ 70%，状态与命令模块 ≥ 80%（Phase 2.6 后核心模块 `src/core/` 已删除）。

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

## 项目结构

```
.
├── src/                          # TypeScript 实现（技能的可选运行时引擎）
│   ├── state/                    # 状态管理
│   │   ├── project-state.ts      # 项目状态持久化
│   │   └── rtm-manager.ts        # RTM 自动更新
│   ├── commands/
│   │   └── router.ts             # /wm 命令路由
│   ├── types/
│   │   └── index.ts              # 共享类型定义（CommandContext 仅 projectState/rtm/cwd）
│   └── index.ts                  # 公共 API 入口（createCommandContext(cwd) 单参）
├── tests/                        # 单元测试（96 个，4 套件）
├── examples/
│   └── run-wm-flow.ts            # W 模型全流程示例（不含 /wm review）
├── w-model-dev/                  # Skill 资产（标准 skill 结构，自包含）
│   ├── SKILL.md                  # Skill 定义（YAML frontmatter + 编排 + 架构定位）
│   ├── references/
│   │   └── verifier-spec.md      # LLM-as-a-Verifier 评审规范（提示词 + Schema + 子标准）
│   ├── scripts/                  # 只做门禁 / 校验，不调用 LLM
│   │   ├── gate-logic.ts         # 工件质量门（仅 checkArtifactGate）
│   │   ├── verifier-logic.ts     # VerifierOutput 校验纯逻辑（SUB_CRITERIA + checkVerifierOutput）
│   │   └── check-verifier-output.ts  # Verifier 输出校验 CLI（防 Agent 输出漂移）
│   ├── templates/                # 文档模板
│   └── examples/                 # 交互示例
├── docs/                         # 设计文档（统一存放）
│   ├── skill-design-document_SSoT.md           # 设计文档（单一事实来源）
│   ├── skill-design-document.md                # 设计文档指针（已废弃独立维护）
│   ├── llm-verifier-integration-design.md      # LLM Verifier 集成设计（指针文档）
│   ├── IMPLEMENTATION-PLAN.md                  # 实现路线图
│   └── INSTALL.md                              # AI Agent 安装指南
├── CHANGELOG.md                  # 变更日志
├── CONTRIBUTING.md               # 贡献指南
└── README.md                     # 项目导航
```

## 编程式接入

```typescript
import { createCommandContext, dispatch } from 'w-model-dev-skill';

// 1. 创建命令上下文（单参数 cwd；本技能不注入 verifier，不内置 LLM）
const ctx = await createCommandContext('./my-project');

// 2. 走 W 模型流程
await dispatch('/wm analyze 用户登录功能', ctx);
await dispatch('/wm design type=架构', ctx);
await dispatch('/wm design type=概要', ctx);
await dispatch('/wm design type=详细', ctx);
await dispatch('/wm code 登录服务 authService.ts', ctx);
await dispatch('/wm test type=集成 result=pass', ctx);
await dispatch('/wm test type=系统 result=pass', ctx);
const result = await dispatch('/wm test type=验收 result=pass', ctx);

if (result.success) {
  console.log('✅ 工件质量门通过，项目可交付');
}
```

> LLM-as-a-Verifier 评审不在 `dispatch` 内执行。如需对阶段产物做评审：
> 1. 调用 `/wm review <target>` 获取结构化评审指引；
> 2. 外部 Agent 按 [`w-model-dev/references/verifier-spec.md`](./w-model-dev/references/verifier-spec.md) §8 提示词模板执行评审；
> 3. 评审输出 JSON 后立即运行 `w-model-dev/scripts/check-verifier-output.ts` 校验防漂移。
>
> 技能自演化（Rollout / Reflect / Edit / Skill Lift 评估）由外部工具完成：
> [SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)。

## 相关文档

- [设计文档（SSoT）](./docs/skill-design-document_SSoT.md) - 单一事实来源
- [Skill 定义](./w-model-dev/SKILL.md) - AI 助理触发命令与阶段流
- [LLM-as-a-Verifier 评审规范](./w-model-dev/references/verifier-spec.md) - 提示词 + Schema + 子标准
- [LLM Verifier 集成设计](./docs/llm-verifier-integration-design.md) - 指针文档
- [实现路线图](./docs/IMPLEMENTATION-PLAN.md)
- [AI Agent 安装指南](./docs/INSTALL.md)
- [变更日志](./CHANGELOG.md)
- [贡献指南](./CONTRIBUTING.md)

## License

MIT
