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
├── SKILL.md            # 入口：YAML frontmatter（name + description）+ 编排逻辑
├── META-SKILL.md       # 元技能可演化配置（可选加载）
├── references/         # 8 阶段细则 + 数据模型 + RTM 指南 + 质量标准（按需加载）
├── templates/          # 需求/设计/测试/RTM 等文档模板
└── examples/           # 需求分析 / 系统设计 / 编码交互示例
```

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

// 默认使用 MockLLMClient，开箱即用（无需 API key）
const ctx = await createCommandContext('./my-project', {
  llm: { model: 'gpt-4' },
  fallbackStrategy: 'text-parse',
});

await dispatch('/wm analyze 用户登录功能', ctx);
await dispatch('/wm design type=架构', ctx);
// ... 完整 8 阶段流程
const result = await dispatch('/wm test type=验收', ctx);
```

### 3.5 验证安装

```bash
npm run example:run   # 跑通 W 模型 8 阶段全流程（Mock LLM）
npm test              # 119 个测试 + 覆盖率
npm run typecheck     # 类型检查
npm run lint          # ESLint
```

---

## 4. 模式 A + B 混合使用

推荐做法：**Agent 模式做编排与决策，程序化模式做执行与持久化**。

- 用 `w-model-dev/SKILL.md` 让 Agent 理解 W 模型流程、产出文档、维护 RTM
- 用 TypeScript 引擎在需要严格评分（LLM-as-a-Verifier 连续评分）、状态持久化、
  质量门自动化检查时调用 [`src/`](../src) 的 API

Agent 在 `SKILL.md` 的「实现位置」章节已标注每个编排步骤对应的实现文件，
可按需调用程序化 API 而非手工执行。

---

## 5. 目录速查

| 你要找的东西 | 位置 |
|---|---|
| Skill 入口与触发条件 | [../w-model-dev/SKILL.md](../w-model-dev/SKILL.md) |
| 各阶段执行细则 | [../w-model-dev/references/](../w-model-dev/references) |
| 文档模板 | [../w-model-dev/templates/](../w-model-dev/templates) |
| 交互示例 | [../w-model-dev/examples/](../w-model-dev/examples) |
| 元技能 / 演化配置 | [../w-model-dev/META-SKILL.md](../w-model-dev/META-SKILL.md) |
| 设计文档（SSoT） | [./skill-design-document_SSoT.md](./skill-design-document_SSoT.md) |
| LLM Verifier 集成设计 | [./llm-verifier-integration-design.md](./llm-verifier-integration-design.md) |
| 实现路线图 | [./IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) |
| TypeScript 实现 | [../src/](../src) |
| 项目导航 | [../README.md](../README.md) |

---

## 6. 常见问题

**Q：模式 A 需要联网或 API key 吗？**
不需要。Agent 模式完全基于本地 Markdown 资产，由 Agent 自身的 LLM 能力执行。
仅当 Agent 自身调用外部 LLM 时才涉及 Agent 框架自身的鉴权。

**Q：模式 A 与模式 B 的产出一致吗？**
编排逻辑一致（同源 `SKILL.md`），但执行精度不同：模式 B 的 LLM-as-a-Verifier
提供 1-20 分连续评分 + 置信度，比 Agent 的二值判断更细。对评分精度有要求时用模式 B。

**Q：能否只安装部分阶段？**
不建议。W 模型的核心是开发与测试并行，阶段之间存在阶段门依赖。`SKILL.md` 已按需
加载 `references/`，无需为节省上下文而拆分安装。
