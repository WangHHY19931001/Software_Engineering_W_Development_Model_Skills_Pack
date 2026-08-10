# AI Agent 安装指南

> 本指南面向**AI Agent / 助手框架**（Trae、Claude Code、Cursor 等支持 Skill 机制的客户端），
> 说明如何安装并激活 W-Model AI Assistant Skill。
>
> 设计文档统一存放在 [`docs/`](.) 目录；Skill 资产按标准 skill 结构集中在项目根的
> [`w-model-dev/`](../w-model-dev) 目录。

---

## 1. 架构定位

本技能是**单纯的编排 + 校验脚本技能**，不包含任何编程式接入（无 TypeScript 引擎、无 SDK）：

- **编排**：由 `w-model-dev/SKILL.md` 承载，Agent 读取后承担「编排者」角色，用自身工具执行 `/wm` 命令路由、状态维护与 CHECKPOINT 等待。
- **编排者最小化（Orchestrator Minimization）**：编排者（O）只做编排（路由 / 状态读写 / CHECKPOINT 等待 / 分派子代理 / 持久化 / 只读脚本）；任何修改、编码、调测、分析、修正、验证产出的实施动作必须由子代理（A 分析 / S 产出 / V 评审 / G 门禁 / R 根因定位）执行。违反命中反模式 #10，回到当前阶段起点。详见 [`w-model-dev/references/subagent-delegation.md`](../w-model-dev/references/subagent-delegation.md)。
- **校验脚本**：`w-model-dev/scripts/*.ts` 自包含，仅做门禁判定，不调用 LLM；运行依赖 [tsx](https://tsx.is/) + 少量 devDependency（见 §2）；由 G 子代理在门禁节点执行 + 回填证据摘要（编排者可同步跑一次只读脚本看退出码，但不替代 G 的回填）。
- **LLM-as-a-Verifier 评审**：由 V 子代理（即「外部 Agent」）按 [`w-model-dev/references/verifier-spec.md`](../w-model-dev/references/verifier-spec.md) 提示词执行，技能用校验脚本防输出漂移；编排者不得自评。
- **技能自演化**：不在本仓库，由外部工具（[SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)）完成。

---

## 2. 前置条件

- 一个支持「Skill 目录 + YAML frontmatter」机制的 AI Agent（如 Trae）
- Agent 具备基础文件操作工具与可执行 Node/tsx 的 shell（PowerShell、Bash 等）
- **仅运行门禁脚本时**需要：
  - Node.js ≥20
  - [tsx](https://tsx.is/)（项目安装或 `npx tsx` 按需拉取）
  - **devDependencies**（在仓库根目录 `npm install` 一次即可，参见 [`package.json`](../package.json)）：
    - `ajv` + `ajv-formats` — JSON Schema (draft-07) 强约束，由 `w-model-dev/scripts/schema-loader.ts` 在 `*-logic.ts` 顶部自动 import（runtime 依赖）
    - `eslint` + `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` + `eslint-plugin-security` — 安全扫描基线（`npm run lint:security` 时使用，devDep）
    - （无 BDD 专属 devDep）— BDD features 场景解析为手写正则（`w-model-dev/scripts/bdd-logic.ts` 的 `parseFeatureFile`），由 `w-model-dev/scripts/check-bdd-model.ts` 在阶段 1-8 BDD 模型门禁时调用（纯 features 静态校验，无需 Cucumber 运行器）

> 纯 Markdown 技能资产（`SKILL.md` / `references/` / `templates/` / `subagent/`）零依赖、零 Node.js、零 `npm install`，可整目录拷贝分发；Node.js/npm/tsx/devDeps 仅用于执行 `scripts/*.ts` 的确定性门禁与回归基线。

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
├── SKILL.md            # 入口：YAML frontmatter（name + version + description）+ 编排逻辑 + 架构定位 + 编排者-子代理边界 + Bundled Resources 按需加载契约
├── references/         # 8 阶段细则 + verifier-spec.md + subagent-delegation.md + anti-patterns.md + toolbox.md + 数据模型 + RTM 指南 + 质量标准 + TLA+ 指南（按需加载，详见 SKILL.md Bundled Resources 表）
├── subagent/           # 28 个评审 persona 文件（engineering / testing / design / product / project 5 类，按需读取）
├── schemas/            # 20 份 JSON Schema (draft-07) 文件（verifier-output / rtm / project / budget / run-log / maturity / checkpoint-log / tla-manifest / graph / rootcause-report / hill-climbing-report / event-ingress / code-tla-manifest / bdd-manifest / coverage / exemption / signature-chain / preventive-review / design-contract / iceberg-sweep），由 schema-loader.ts 在 logic 层前置加载
├── scripts/            # 自包含门禁 / 校验脚本，不调用 LLM（依赖 tsx + devDeps，见 §2）
│   ├── *-logic.ts               # 纯函数校验逻辑（gate / verifier / graph / tla / code-tla / budget / run-log / maturity / checkpoint / root-cause / signature-chain / archive-integrity / preventive-review / iceberg-sweep / tla-bdd-sync / role-dispatch / design-contract / coverage / exemption / bdd / state-machine / wm-status / metrics-report）
│   ├── check-*.ts               # CLI 入口层（IO 抽离，传纯数据给 logic 层）
│   ├── schema-loader.ts         # ajv 单例 + schemas/*.schema.json 自动加载 + validateBySchema 工具
│   ├── security-scan.ts         # eslint-plugin-security 扫描 + baseline v2 内容敏感指纹豁免（--regenerate 重生成）
│   ├── wm-status.ts             # /wm status 脚本化 CLI（状态快照：阶段 / 进度 / RTM 覆盖率 / 测试汇总 / 下一步建议；退出码 0/2）
│   ├── wm-status-logic.ts       # wm-status 纯逻辑（供单元测试）
│   ├── metrics-report.ts        # 流程度量报告 CLI（run-log + budget 汇总 7 区度量；--from/--to/--phase/--json/--out）
│   ├── metrics-report-logic.ts  # metrics-report 纯逻辑（供单元测试）
│   ├── lib/cli-error.ts         # exit 2 错误结构统一（6 类错误码 + CliError + exitWithError；人类消息 stderr + ERROR_JSON stdout）
│   ├── self-test.ts             # 回归基线（249 条样本）
│   └── __tests__/               # vitest 单元测试（35 个 .test.ts / 530 条 + README.md coverage 矩阵）
├── templates/          # 需求/设计/测试/RTM 等文档模板
└── examples/           # 需求分析 / 系统设计 / 编码交互示例
```

> Skill 资产（除 `scripts/` 外）零依赖、零 Node.js，可整目录拷贝。`scripts/` 需在仓库根目录 `npm install` 一次以拉取 devDeps（ajv / eslint-plugin-security 等），详见 §2。

> Agent 读取 `SKILL.md` 后承担「编排者」（O）角色：每阶段分派 **S 产出子代理**生成开发产物 + 测试设计 + RTM，分派 **V 评审子代理**按 [`references/verifier-spec.md`](../w-model-dev/references/verifier-spec.md) §8 提示词产出 `VerifierOutput` JSON，分派 **G 门禁子代理**跑 `scripts/check-verifier-output.ts` 校验防漂移（退出码 0 通过 / 1 校验失败 / 2 用法错误）并回填证据。编排者只做路由 + 状态 + CHECKPOINT + 持久化，**不得越权实施**（反模式 #10）。详见 [`references/subagent-delegation.md`](../w-model-dev/references/subagent-delegation.md)。

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

确认 Agent 能运行门禁脚本（需先在仓库根目录 `npm install` 拉取 devDeps，详见 §2）：

```bash
# 首次：在仓库根目录安装 devDependencies（ajv / eslint-plugin-security / tsx 等）
npm install

# 验证脚本可执行 + schema 校验链路通：
npx tsx "w-model-dev/scripts/check-verifier-output.ts"
# 预期退出码 2，并输出用法；这同时证明脚本可执行且 ajv + schema-loader 链路无错误

# 验证回归基线（self-test 249 条样本全部通过）：
npm run self-test

# 验证安全扫描基线（exit 0 = 无新增风险）：
npm run lint:security
```

PowerShell：

```powershell
npm install
npx tsx "w-model-dev/scripts/check-verifier-output.ts"
$LASTEXITCODE  # 预期为 2
npm run self-test
$LASTEXITCODE  # 预期为 0
npm run lint:security
$LASTEXITCODE  # 预期为 0
```

---

## 5. 激活机制（来自 `SKILL.md` frontmatter）

Agent 通过 `SKILL.md` 顶部的 YAML frontmatter 判断何时激活本技能：

```yaml
name: w-model-dev
version: 40.0.0
description: >-
  Use when the user explicitly invokes /wm, mentions W-model, W 模型 or W 开发模型,
  requests requirements traceability (RTM), stage gates, quality gates, or development
  and testing in parallel. When the user only asks for an end-to-end or complete
  development process without these signals, ask whether to use the W-model first.
```

触发条件摘要：

- 用户提及「W 模型」「W 开发模型」或「开发与测试并行」
- 用户使用 `/wm` 系列命令
- 用户要从需求出发完成设计 → 编码 → 各级测试的完整交付
- 用户需要需求追溯 / 质量门检查 / 补齐测试设计

> `version` 字段与 [`w-model-dev/skill-metadata.json`](../w-model-dev/skill-metadata.json) 镜像双写，由 [`__tests__/skill-metadata.test.ts`](../w-model-dev/scripts/__tests__/skill-metadata.test.ts) 回归校验一致。

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
| 编排者-子代理边界（O/A/S/V/G/R） | [../w-model-dev/references/subagent-delegation.md](../w-model-dev/references/subagent-delegation.md) |
| LLM-as-a-Verifier 评审规范 | [../w-model-dev/references/verifier-spec.md](../w-model-dev/references/verifier-spec.md) |
| 工具箱决策表（I have X → use Z） | [../w-model-dev/references/toolbox.md](../w-model-dev/references/toolbox.md) |
| 负面知识库（47 条反模式 + 教训） | [../w-model-dev/references/anti-patterns.md](../w-model-dev/references/anti-patterns.md) |
| JSON Schema 文件（draft-07，20 份） | [../w-model-dev/schemas/](../w-model-dev/schemas) |
| Schema 加载与校验工具 | [../w-model-dev/scripts/schema-loader.ts](../w-model-dev/scripts/schema-loader.ts) |
| 安全扫描脚本（baseline v2 内容敏感指纹豁免） | [../w-model-dev/scripts/security-scan.ts](../w-model-dev/scripts/security-scan.ts) |
| 回归基线脚本（249 条样本） | [../w-model-dev/scripts/self-test.ts](../w-model-dev/scripts/self-test.ts) |
| 测试 coverage 矩阵 | [../w-model-dev/scripts/__tests__/README.md](../w-model-dev/scripts/__tests__/README.md) |
| 28 个评审 persona 文件 | [../w-model-dev/subagent/](../w-model-dev/subagent) |
| Verifier 输出校验逻辑 | [../w-model-dev/scripts/verifier-logic.ts](../w-model-dev/scripts/verifier-logic.ts) |
| Verifier 输出校验 CLI | [../w-model-dev/scripts/check-verifier-output.ts](../w-model-dev/scripts/check-verifier-output.ts) |
| 工件质量门逻辑 | [../w-model-dev/scripts/gate-logic.ts](../w-model-dev/scripts/gate-logic.ts) |
| 工件质量门 CLI | [../w-model-dev/scripts/check-artifact-gate.ts](../w-model-dev/scripts/check-artifact-gate.ts) |
| 图谱结构门禁逻辑 | [../w-model-dev/scripts/graph-logic.ts](../w-model-dev/scripts/graph-logic.ts) |
| 图谱结构门禁 CLI | [../w-model-dev/scripts/check-requirement-graph.ts](../w-model-dev/scripts/check-requirement-graph.ts) |
| TLA+ 行为门禁 CLI | [../w-model-dev/scripts/check-tla-model.ts](../w-model-dev/scripts/check-tla-model.ts) |
| 代码-TLA+ 一致性回归 CLI | [../w-model-dev/scripts/check-code-tla-consistency.ts](../w-model-dev/scripts/check-code-tla-consistency.ts) |
| BDD 模型门禁 CLI | [../w-model-dev/scripts/check-bdd-model.ts](../w-model-dev/scripts/check-bdd-model.ts) |
| Budget / RunLog / Maturity / Checkpoint / RootCause / 签名链 / 归档 / R3 / 冰山扫掠 门禁 CLI | [../w-model-dev/scripts/](../w-model-dev/scripts) |
| /wm status 状态快照 CLI + 逻辑 | [../w-model-dev/scripts/wm-status.ts](../w-model-dev/scripts/wm-status.ts) + [../w-model-dev/scripts/wm-status-logic.ts](../w-model-dev/scripts/wm-status-logic.ts) |
| 流程度量报告 CLI + 逻辑 | [../w-model-dev/scripts/metrics-report.ts](../w-model-dev/scripts/metrics-report.ts) + [../w-model-dev/scripts/metrics-report-logic.ts](../w-model-dev/scripts/metrics-report-logic.ts) |
| exit 2 错误结构统一（6 类错误码 + ERROR_JSON） | [../w-model-dev/scripts/lib/cli-error.ts](../w-model-dev/scripts/lib/cli-error.ts) |
| 图谱门禁与收敛准则 | [../w-model-dev/references/graph-guide.md](../w-model-dev/references/graph-guide.md) |
| 冰山扫掠机制说明 | [../w-model-dev/references/iceberg-sweep-guide.md](../w-model-dev/references/iceberg-sweep-guide.md) |
| 文档模板 | [../w-model-dev/templates/](../w-model-dev/templates) |
| 交互示例 | [../w-model-dev/examples/](../w-model-dev/examples) |
| 设计文档（SSoT） | [./skill-design-document_SSoT.md](./skill-design-document_SSoT.md) |
| LLM Verifier 集成设计 | [./llm-verifier-integration-design.md](./llm-verifier-integration-design.md) |
| 项目导航 | [../README.md](../README.md) |
| Agent 仓库导航 | [../AGENTS.md](../AGENTS.md) |

> 技能演化与评估相关能力不在本仓库：参见外部工具
> [SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)。

---

## 8. 常见问题

**Q：安装需要联网或 API key 吗？**
- **纯 Skill 资产**（`SKILL.md` / `references/` / `templates/` / `subagent/`）零依赖、零联网，拷贝即可用。
- **运行门禁脚本** 需联网一次 `npm install` 拉取 devDeps（`ajv` / `ajv-formats` / `eslint-plugin-security` 等，首次安装约 30MB）。之后离线可用。
- Agent 在执行 LLM-as-a-Verifier 评审时需要调用其自身的 LLM，按 Agent 框架自身的鉴权方式处理（与技能无关）。

**Q：为什么有 `package.json` + `npm install`？**
Skill 资产本身零依赖（纯 Markdown）；`package.json` 仅用于支撑 `w-model-dev/scripts/*.ts` 校验脚本：
- **runtime devDep**：`ajv` + `ajv-formats`（由 `schema-loader.ts` 在 `*-logic.ts` 顶部自动 import，提供 JSON Schema draft-07 强约束）
- **devDep（仅安全扫描用）**：`eslint` + `@typescript-eslint/*` + `eslint-plugin-security`（由 `security-scan.ts` 调用，对比 `.eslintsecurity-baseline.json` v2 内容敏感指纹豁免）
- **runtime**：`tsx`（运行 ESM TypeScript）
- **devDep（测试）**：`vitest` + `@vitest/coverage-v8`（`w-model-dev/scripts/__tests__/` 单元测试，35 个 test 文件 / 530 条）

`/wm` 命令、状态持久化、RTM 维护仍由 Agent 按 `SKILL.md` 在项目内（`.w-model/*.json`）完成，无编程式 SDK。
若只读 Markdown 资产不跑脚本，可跳过 `npm install`，但 schema 校验 + 安全扫描 + self-test 不可用。

**Q：技能自演化在哪里？**
不在本仓库。技能演化（Rollout / Reflect / Edit / Skill Lift 评估）由外部工具完成：
[SkillOpt](https://github.com/microsoft/SkillOpt) / [darwin-skill](https://github.com/alchaincyf/darwin-skill)。
本技能产出的 `VerifierOutput` JSON 可作为这些工具的训练信号。详见 SSoT [§12.4 与外部 SkillOpt/darwin-skill 的边界](./skill-design-document_SSoT.md) 与 [§14 技能演化机制（已移除）](./skill-design-document_SSoT.md)。

**Q：能否只安装部分阶段？**
不建议。W 模型的核心是开发与测试并行，阶段之间存在阶段门依赖。`SKILL.md` 已按需
加载 `references/`，无需为节省上下文而拆分安装。

**Q：编排者-子代理边界如何工作？Agent 自身就是编排者吗？**
是的。Agent 读取 `w-model-dev/SKILL.md` 后承担「编排者」（O）角色，只做路由 / 状态读写 / CHECKPOINT 等待 / 分派子代理 / 持久化 / 只读脚本。任何实施动作由五类子代理执行（详见 SSoT [§3.4.2 角色划分](./skill-design-document_SSoT.md)）：
- **A 分析子代理**：L2+ 项目事件接驳 / ingestion 分块分析（阶段 1–4）
- **S 产出子代理**：生成阶段开发产物 + 同步测试设计 + 更新 RTM 实体
- **V 评审子代理**：按 `verifier-spec.md` 提示词产出 `VerifierOutput` JSON（即「外部 Agent 执行 LLM-as-a-Verifier」）；V-lead 可调用多 persona 多角度评审
- **G 门禁子代理**：跑 `check-verifier-output.ts` / `check-artifact-gate.ts` + 回填证据摘要
- **R 根因子代理**：V/G 不通过后，R-lead 按 persona 矩阵选用多角度做根因定位（详见 [`references/root-cause-locator.md`](../w-model-dev/references/root-cause-locator.md)）

子代理通过宿主 Agent 的子代理机制（如 Trae 的 Task 工具 / Claude Code 的 Task 工具 / Cursor 的子代理）启动。编排者越权实施（直接写产物 / 自评 / 替代 G 回填）命中反模式 #10，回到当前阶段起点。详见 [`references/subagent-delegation.md`](../w-model-dev/references/subagent-delegation.md) 与 SSoT [§3.4.5 强制约束](./skill-design-document_SSoT.md)。

**Q：编排者能跑门禁脚本吗？**
可以跑只读脚本（`npx tsx check-*.ts`、`git status`、`ls`）看退出码用于展示或路由判定，但**不替代 G 子代理的回填职责**——G 子代理必须独立跑一次并产出证据摘要。门禁脚本本身为确定性 TypeScript，不含 LLM 调用，编排者跑它仅用于"看退出码"，不构成实施。详见 SSoT [§3.4.5 强制约束](./skill-design-document_SSoT.md)。

**Q：哪里可以看到 W 模型 8 阶段的完整端到端产出样本？**
参考实现是博客系统后端（Express + TypeScript）的端到端调测，**已归档**（按时间倒序，源码不随仓库保留）：
- **最新一轮（第二十三轮）**：[`docs/changes/archive/2026-07-30-round23-w-model-8-phase-validation/`](./changes/archive/2026-07-30-round23-w-model-8-phase-validation/)（32 需求 / 630 测试全通过 / 覆盖率 94.99% lines）
- **第十五轮**：[`docs/changes/archive/2026-07-26-round15-end-to-end-test/`](./changes/archive/2026-07-26-round15-end-to-end-test/)（9 文件：README / proposal / specs / design / tasks / tla-summary / rtm-snapshot / verifier-summary / test-report-snapshot）

**第十五轮最终调测数字**（详见归档 [`README.md`](./changes/archive/2026-07-26-round15-end-to-end-test/README.md)）：
- 需求 32（22 REQ + 6 NFR + 4 CON）/ 设计文档 4 / 接口契约 22 INTF / 详细设计节点 75 DD / TLA+ 规格 22（1 L1 + 9 L2 + 7 L3 + 5 L4）/ 源文件 60 TS
- 单元测试 708 UT（覆盖率 98.66% lines）/ 集成测试 74 IT（100%）/ 系统测试 35 ST（100%）/ 验收测试 72 UAT（100%）
- **四级测试总计 889 测试用例全通过**，8 阶段全完成，V 评审 8 阶段全 A 级，用户 `confirm` 归档

**过程中累计发现并修正 5 项缺陷**（详见 SSoT [§10B.4](./skill-design-document_SSoT.md)）：
1. Express 4 async handler 未包装（rejected promise 未捕获）→ 沉淀为 L1
2. JWT_SECRET 缺失致测试套件 collect 阶段崩溃 → 沉淀为 L2
3. ArticleService 类型导出丢失（TS2724）→ 沉淀为 L3
4. vitest mock 与 express NextFunction 类型不兼容（TS2339）→ 沉淀为 L4
5. check-artifact-gate.ts 缺 exitCode 字段（门禁脚本一致性缺陷，已纳入 self-test 回归基线）

缺陷 1~4 已沉淀到 [`w-model-dev/references/anti-patterns.md`](../w-model-dev/references/anti-patterns.md)「实现层经验教训」节 L1~L4。
SSoT §10B 保留**第五轮**（2026-07-24）快照作历史对照（77/77 UT / 21/21 IT / 22/22 ST / 15/15 UAT）。

## codegraph + OpenSpec 自动安装（第 25 轮新增）

> 阶段 5-8 依赖两个外部工具。技能包通过 `ensure-codegraph-opsx.ts` 自动检测并安装，仅自动失败时需用户手动介入。

### 自动安装

技能包在阶段 5 进入 CHECKPOINT 时自动运行：
```bash
npx tsx w-model-dev/scripts/ensure-codegraph-opsx.ts --phase 5 --project-root . --mode full
```

脚本执行三层检测+自动处置：
1. **L1 CLI**：`codegraph --version` / `openspec --version` → 缺失则 `npm i -g`
2. **L2 MCP 注册**：codegraph 探针查询 → 失败则 `codegraph install --yes`
3. **L3 项目**：`.codegraph/` / `openspec/` 目录 → 缺失则 `codegraph init` / `openspec init`

### 手动安装（自动失败时）

```bash
npm i -g @colbymchenry/codegraph
npm i -g @fission-ai/openspec@latest
codegraph install          # 交互式注册 MCP（自动失败时手动跑）
codegraph init             # 项目图谱初始化
openspec init              # OpenSpec 工作区初始化
```
