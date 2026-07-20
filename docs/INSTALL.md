# AI Agent 安装指南

> 本指南面向**AI Agent / 助手框架**（Trae、Claude Code、Cursor 等支持 Skill 机制的客户端），
> 说明如何安装并激活 W-Model AI Assistant Skill。
>
> 设计文档统一存放在 [`docs/`](.) 目录；Skill 资产按标准 skill 结构集中在项目根的
> [`w-model-dev/`](../w-model-dev) 目录。

---

## 1. 架构定位

本技能是**单纯的编排 + 校验脚本技能**，不包含任何编程式接入（无 TypeScript 引擎、无 npm 包、无 SDK）：

- **编排**：由 `w-model-dev/SKILL.md` 承载，Agent 读取后用自身工具执行 `/wm` 命令、维护状态与 RTM。
- **校验脚本**：`w-model-dev/scripts/*.ts` 自包含，仅做门禁判定，不调用 LLM；运行依赖 [tsx](https://tsx.is/)。
- **LLM-as-a-Verifier 评审**：由外部 Agent 按 [`w-model-dev/references/verifier-spec.md`](../w-model-dev/references/verifier-spec.md) 提示词执行，技能用校验脚本防输出漂移。
- **技能自演化**：不在本仓库，由外部工具（[SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)）完成。

---

## 2. 前置条件

- 一个支持「Skill 目录 + YAML frontmatter」机制的 AI Agent（如 Trae）
- Agent 具备基础文件操作工具与可执行 Node/tsx 的 shell（PowerShell、Bash 等）
- **仅运行门禁脚本时**需要 Node.js ≥20，以及 [tsx](https://tsx.is/)（项目安装或 `npx tsx` 按需拉取）

纯 Markdown 技能资产无需 Node.js 或 `npm install`；Node.js/tsx 只用于执行 `scripts/*.ts` 的确定性门禁。

---

## 3. 标准安装步骤

### Bash / macOS / Linux

```bash
cp -r "w-model-dev" "/path/to/agent/skills/w-model-dev"
```

### PowerShell / Windows

```powershell
Copy-Item -Recurse -Force "w-model-dev" "$env:USERPROFILE\.agent\skills\w-model-dev"
```

目标 skills 路径以具体 Agent 文档为准；路径包含空格时始终使用引号。

安装后的目录结构应为：

```
/path/to/agent/skills/w-model-dev/
├── SKILL.md            # 入口：YAML frontmatter（name + description）+ 编排逻辑 + 架构定位
├── references/         # 8 阶段细则 + verifier-spec.md（LLM-as-a-Verifier 评审规范）+ 数据模型 + RTM 指南 + 质量标准（按需加载）
├── scripts/            # 只做门禁 / 校验，不调用 LLM（自包含，仅依赖 tsx）
│   ├── gate-logic.ts            # 工件质量门纯逻辑（单点事实源）
│   ├── check-artifact-gate.ts   # 工件质量门 CLI（读 .w-model/rtm.json）
│   ├── verifier-logic.ts        # VerifierOutput 校验纯逻辑（单点事实源）
│   └── check-verifier-output.ts # Verifier 输出校验 CLI（防 Agent 输出漂移）
├── templates/          # 需求/设计/测试/RTM 等文档模板
└── examples/           # 需求分析 / 系统设计 / 编码交互示例
```

> Agent 在阶段产物评审时按 [`references/verifier-spec.md`](../w-model-dev/references/verifier-spec.md) §8 的提示词模板执行 LLM 调用，
> 产出 `VerifierOutput` JSON 后立即调用 `scripts/check-verifier-output.ts` 校验防漂移（退出码 0 通过 / 1 校验失败 / 2 用法错误）。

---

## 4. 验证安装

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

### 校验脚本可用性

确认 Agent 能运行门禁脚本（需本地 `tsx`）：

```bash
npx tsx "w-model-dev/scripts/check-verifier-output.ts"
# 预期退出码 2，并输出用法；这同时证明脚本可执行且无依赖错误
```

PowerShell：

```powershell
npx tsx "w-model-dev/scripts/check-verifier-output.ts"
$LASTEXITCODE  # 预期为 2
```

---

## 5. 激活机制（来自 `SKILL.md` frontmatter）

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

---

## 6. 卸载

删除 skills 目录下的 `w-model-dev/` 即可：

Bash：

```bash
rm -rf "/path/to/agent/skills/w-model-dev"
```

PowerShell：

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.agent\skills\w-model-dev"
```

---

## 7. 目录速查

| 你要找的东西 | 位置 |
|---|---|
| Skill 入口与触发条件 | [../w-model-dev/SKILL.md](../w-model-dev/SKILL.md) |
| 各阶段执行细则 | [../w-model-dev/references/](../w-model-dev/references) |
| LLM-as-a-Verifier 评审规范 | [../w-model-dev/references/verifier-spec.md](../w-model-dev/references/verifier-spec.md) |
| Verifier 输出校验逻辑 | [../w-model-dev/scripts/verifier-logic.ts](../w-model-dev/scripts/verifier-logic.ts) |
| Verifier 输出校验 CLI | [../w-model-dev/scripts/check-verifier-output.ts](../w-model-dev/scripts/check-verifier-output.ts) |
| 工件质量门逻辑 | [../w-model-dev/scripts/gate-logic.ts](../w-model-dev/scripts/gate-logic.ts) |
| 工件质量门 CLI | [../w-model-dev/scripts/check-artifact-gate.ts](../w-model-dev/scripts/check-artifact-gate.ts) |
| 文档模板 | [../w-model-dev/templates/](../w-model-dev/templates) |
| 交互示例 | [../w-model-dev/examples/](../w-model-dev/examples) |
| 参考实现（端到端调测样本） | [../w-model-dev-demo/](../w-model-dev-demo) |
| 设计文档（SSoT） | [./skill-design-document_SSoT.md](./skill-design-document_SSoT.md) |
| LLM Verifier 集成设计 | [./llm-verifier-integration-design.md](./llm-verifier-integration-design.md) |
| 项目导航 | [../README.md](../README.md) |
| Agent 仓库导航 | [../AGENTS.md](../AGENTS.md) |

> 技能演化与评估相关能力不在本仓库：参见外部工具
> [SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)。

---

## 8. 常见问题

**Q：安装需要联网或 API key 吗？**
技能资产本身不需要——是纯 Markdown + 自包含 TypeScript 校验脚本，无内置 LLM 调用。
但 Agent 在执行 LLM-as-a-Verifier 评审时需要调用其自身的 LLM，此时按 Agent 框架自身的鉴权方式处理（与技能无关）。
运行校验脚本时需本地具备 `tsx`（首次 `npx tsx` 会按需拉取）。

**Q：为什么没有 `npm install` / `package.json`？**
本技能是单纯的编排 + 校验脚本技能，不包含编程式 SDK。`/wm` 命令、状态持久化、RTM 维护
均由 Agent 按 `SKILL.md` 在项目内（`.w-model/*.json`）完成，无需 Node 项目工程化。
校验脚本仅依赖 `tsx` 运行 ESM，无任何业务依赖。

**Q：技能自演化在哪里？**
不在本仓库。技能演化（Rollout / Reflect / Edit / Skill Lift 评估）由外部工具完成：
[SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)。
本技能产出的 `VerifierOutput` JSON 可作为这些工具的训练信号。

**Q：能否只安装部分阶段？**
不建议。W 模型的核心是开发与测试并行，阶段之间存在阶段门依赖。`SKILL.md` 已按需
加载 `references/`，无需为节省上下文而拆分安装。

**Q：哪里可以看到 W 模型 8 阶段的完整端到端产出样本？**
参见仓库内的参考实现 [`w-model-dev-demo/`](../w-model-dev-demo)（博客系统后端，Express + TypeScript）。
该目录独立于技能资产，包含 8 阶段全部产出文档与可运行代码，2026-07-20 调测结论：单元 22/22（覆盖率 98%）、
集成 6/6、系统 6/6、验收 15/15、RTM 100%、工件质量门通过。详见 SSoT [§10B](./skill-design-document_SSoT.md)。
