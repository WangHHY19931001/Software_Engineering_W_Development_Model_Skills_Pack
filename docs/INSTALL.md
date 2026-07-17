# AI Agent 安装指南

> 本指南面向**AI Agent / 助手框架**（Trae、Claude Code、Cursor 等支持 Skill 机制的客户端），
> 说明如何安装并激活 W-Model AI Assistant Skill。
>
> 设计文档统一存放在 [`docs/`](.) 目录；Skill 资产按标准 skill 结构集中在项目根的
> [`w-model-dev/`](../w-model-dev) 目录。

---

## 1. 两种安装模式

本技能提供两种独立可用的安装路径，按需选择其一（或两者并用）：

| 模式 | 适用对象 | 安装内容 | 依赖 | 执行方式 |
|---|---|---|---|---|
| **A. AI Agent 模式**（推荐） | 任意支持 Skill 的 AI 客户端 | 仅 `w-model-dev/` 目录 | 无（零依赖） | Agent 读取 `SKILL.md`，用自身工具执行 |
| **B. 程序化模式** | Node.js 应用 / 自动化流水线 | 整个 npm 包（`src/` + `w-model-dev/`） | Node.js ≥ 18 | 调用 TypeScript API |

> 两种模式共享同一份 `SKILL.md` 编排逻辑与 `references/` / `templates/` 知识资产，
> 区别仅在执行引擎：A 由 Agent 自身执行，B 由 TypeScript 实现执行。
>
> **架构原则**：技能包只包含提示词、参考、模板，里面的脚本只做门禁，不涉及 LLM 调用。
> LLM-as-a-Verifier 评审由外部 Agent 按 [`w-model-dev/references/verifier-spec.md`](../w-model-dev/references/verifier-spec.md) 执行；
> 技能自演化由外部工具（[SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)）完成。
> 程序化模式不再需要任何 LLM API key 或客户端配置。

---

## 2. 模式 A：AI Agent 安装（零依赖）

### 2.1 前置条件

- 一个支持「Skill 目录 + YAML frontmatter」机制的 AI Agent（如 Trae）
- Agent 具备基础文件操作工具（Read / Write / Edit / Glob / Grep）

无需 Node.js、npm 或任何运行时——Skill 资产是纯 Markdown。

### 2.2 标准安装步骤

```bash
# 1. 定位你的 Agent 的 skills 目录（路径以具体 Agent 文档为准）
#    Trae 示例：~/.trae/skills/
#    通用示例：/path/to/agent/skills/

# 2. 拷贝 skill 目录（注意：拷贝的是 w-model-dev 目录本身，保持其内部结构）
cp -r w-model-dev /path/to/agent/skills/w-model-dev
```

安装后的目录结构应为：

```
/path/to/agent/skills/w-model-dev/
├── SKILL.md            # 入口：YAML frontmatter（name + description）+ 编排逻辑 + 架构定位
├── references/         # 8 阶段细则 + verifier-spec.md（LLM-as-a-Verifier 评审规范）+ 数据模型 + RTM 指南 + 质量标准（按需加载）
├── scripts/            # 只做门禁 / 校验，不调用 LLM
│   ├── gate-logic.ts            # 工件质量门（仅 checkArtifactGate）
│   ├── verifier-logic.ts        # VerifierOutput 校验纯逻辑（SUB_CRITERIA + checkVerifierOutput）
│   └── check-verifier-output.ts # Verifier 输出校验 CLI（防 Agent 输出漂移）
├── templates/          # 需求/设计/测试/RTM 等文档模板
└── examples/           # 需求分析 / 系统设计 / 编码交互示例
```

> Agent 在阶段产物评审时按 [`references/verifier-spec.md`](../w-model-dev/references/verifier-spec.md) §8 的提示词模板执行 LLM 调用，
> 产出 `VerifierOutput` JSON 后立即调用 `scripts/check-verifier-output.ts` 校验防漂移（退出码 0 通过 / 1 校验失败 / 2 用法错误）。

### 2.3 验证安装

向 Agent 发送以下任一触发语，确认技能被激活：

```
/wm help
```

或自然语言触发：

```
我想用 W 模型开发一个用户登录功能
```

预期：Agent 返回 `/wm` 命令一览（analyze / design / code / test / review / status 等），
并按 `SKILL.md` 的「使用场景」识别意图。

### 2.4 激活机制（来自 `SKILL.md` frontmatter）

Agent 通过 `SKILL.md` 顶部的 YAML frontmatter 判断何时激活本技能：

```yaml
name: w-model-dev
description: >
  Drive the full W-model software development lifecycle with parallel development
  and test design. Use when the user wants to run requirements analysis, system/outline/detailed
  design, coding with unit tests, integration testing, system testing, or acceptance
  testing as a closed-loop W-model workflow; when the user invokes /wm commands
  (analyze, design, code, test, review, status); or when building software that
  needs synchronized test design alongside each development stage with requirements
  traceability.
```

触发条件摘要：

- 用户提及「W 模型」「W 开发模型」或「开发与测试并行」
- 用户使用 `/wm` 系列命令
- 用户要从需求出发完成设计 → 编码 → 各级测试的完整交付
- 用户需要需求追溯 / 质量门检查 / 补齐测试设计

### 2.5 卸载

删除 skills 目录下的 `w-model-dev/` 即可：

```bash
rm -rf /path/to/agent/skills/w-model-dev
```

---

## 3. 模式 B：程序化安装（TypeScript 引擎）

### 3.1 前置条件

- Node.js ≥ 18.0.0

### 3.2 从源码安装

```bash
git clone <repo-url>
cd Software_Engineering_W_Development_Model_Skills_Pack
npm install
npm run build       # 产出 dist/
```

### 3.3 作为 npm 依赖安装（发布后）

```bash
npm install w-model-dev-skill
```

### 3.4 编程式调用

```typescript
import { createCommandContext, dispatch } from 'w-model-dev-skill';

// 单参数 cwd；本技能不注入 verifier，不内置 LLM，无需任何 API key
const ctx = await createCommandContext('./my-project');

await dispatch('/wm analyze 用户登录功能', ctx);
await dispatch('/wm design type=架构', ctx);
// ... 完整 8 阶段流程（含 result=pass 真实结果回填）
const result = await dispatch('/wm test type=验收 result=pass', ctx);
```

> LLM-as-a-Verifier 评审不在 `dispatch` 内执行。如需对阶段产物做评审：
> 1. 调用 `dispatch('/wm review <target>', ctx)` 获取结构化评审指引；
> 2. 由你的应用层 Agent 按 [`w-model-dev/references/verifier-spec.md`](../w-model-dev/references/verifier-spec.md) §8 提示词模板执行 LLM 调用；
> 3. 评审输出 JSON 后调用 `w-model-dev/scripts/check-verifier-output.ts` 校验。

### 3.5 验证安装

```bash
npm run example:run   # 跑通 W 模型 8 阶段全流程（不含 /wm review，评审由外部 Agent 完成）
npm test              # 96 个测试 + 覆盖率（4 套件）
npm run typecheck     # 类型检查
npm run lint          # ESLint
```

---

## 4. 模式 A + B 混合使用

推荐做法：**Agent 模式做编排与决策，程序化模式做执行与持久化**。

- 用 `w-model-dev/SKILL.md` 让 Agent 理解 W 模型流程、产出文档、维护 RTM
- 用 TypeScript 引擎在需要状态持久化、工件质量门自动化检查时调用 [`src/`](../src) 的 API
- LLM-as-a-Verifier 评审两种模式都由外部 Agent 执行（技能只提供提示词 + Schema + 校验脚本）

Agent 在 `SKILL.md` 的「实现位置」章节已标注每个编排步骤对应的实现文件，
可按需调用程序化 API 而非手工执行。

---

## 5. 目录速查

| 你要找的东西 | 位置 |
|---|---|
| Skill 入口与触发条件 | [../w-model-dev/SKILL.md](../w-model-dev/SKILL.md) |
| 各阶段执行细则 | [../w-model-dev/references/](../w-model-dev/references) |
| LLM-as-a-Verifier 评审规范 | [../w-model-dev/references/verifier-spec.md](../w-model-dev/references/verifier-spec.md) |
| Verifier 输出校验逻辑 | [../w-model-dev/scripts/verifier-logic.ts](../w-model-dev/scripts/verifier-logic.ts) |
| Verifier 输出校验 CLI | [../w-model-dev/scripts/check-verifier-output.ts](../w-model-dev/scripts/check-verifier-output.ts) |
| 工件质量门逻辑 | [../w-model-dev/scripts/gate-logic.ts](../w-model-dev/scripts/gate-logic.ts) |
| 文档模板 | [../w-model-dev/templates/](../w-model-dev/templates) |
| 交互示例 | [../w-model-dev/examples/](../w-model-dev/examples) |
| 设计文档（SSoT） | [./skill-design-document_SSoT.md](./skill-design-document_SSoT.md) |
| LLM Verifier 集成设计 | [./llm-verifier-integration-design.md](./llm-verifier-integration-design.md) |
| 实现路线图 | [./IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) |
| TypeScript 实现 | [../src/](../src) |
| 项目导航 | [../README.md](../README.md) |

> 技能演化与评估相关能力不在本仓库：参见外部工具
> [SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)。

---

## 6. 常见问题

**Q：模式 A 需要联网或 API key 吗？**
Agent 模式本身不需要——技能资产是纯 Markdown + TypeScript 校验脚本，无内置 LLM 调用。
但 Agent 在执行 LLM-as-a-Verifier 评审时需要调用其自身的 LLM，此时按 Agent 框架自身的鉴权方式处理（与技能无关）。

**Q：模式 B 需要 LLM API key 吗？**
不需要。Phase 2.6 架构重构后，程序化引擎不内置任何 LLM 调用。`createCommandContext(cwd)` 是单参数，
不再有 `llm` / `fallbackStrategy` 配置。阶段产物的 LLM 评审由你的应用层 Agent 按 `verifier-spec.md` 执行。

**Q：模式 A 与模式 B 的产出一致吗？**
编排逻辑一致（同源 `SKILL.md`），区别在执行引擎：
- 模式 A：Agent 自身执行 W 模型编排 + LLM 评审
- 模式 B：TypeScript 引擎执行状态持久化 + RTM 维护 + 工件质量门检查；LLM 评审仍由外部 Agent 执行
两种模式的 LLM-as-a-Verifier 评审输出均符合 `verifier-spec.md` §6 Schema（连续评分 [0,1] 4 位小数 + 三维度 + PPT），
并由 `check-verifier-output.ts` 统一校验。

**Q：技能自演化在哪里？**
不在本仓库。技能演化（Rollout / Reflect / Edit / Skill Lift 评估）由外部工具完成：
[SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)。
本技能产出的 `VerifierOutput` JSON 可作为这些工具的训练信号。

**Q：能否只安装部分阶段？**
不建议。W 模型的核心是开发与测试并行，阶段之间存在阶段门依赖。`SKILL.md` 已按需
加载 `references/`，无需为节省上下文而拆分安装。
