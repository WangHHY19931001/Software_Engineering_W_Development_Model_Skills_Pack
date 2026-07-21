# 贡献指南

感谢你对 W-Model AI Assistant Skill 项目的关注！本文档说明如何参与贡献。

## 行为准则

请保持尊重与专业。任何形式的骚扰或不友善行为都不被接受。

## 开发环境准备

本仓库是单纯的编排 + 校验脚本技能，工程化极简：根目录有一个 `package.json`，但仅声明 `tsx` 作为开发依赖（用于运行 `w-model-dev/scripts/*.ts`），无构建步骤、无 `src/`、无测试框架。

```bash
# 1. 克隆仓库
git clone <repo-url>
cd Software_Engineering_W_Development_Model_Skills_Pack

# 2. 安装开发依赖（仅 tsx）
npm install
# 之后即可用 npm run self-test / check:verifier / check:gate 快捷运行

# 3. 启用本地推送前门禁（一次性，写入本地 .git/config）
npm run setup:hooks
# 等价于 git config core.hooksPath .githooks
# 启用后每次 git push 会自动跑回归基线，详见下方「本地推送前门禁」一节

# 或不安装依赖，按需用 npx tsx 拉取（适合一次性使用）
npx tsx w-model-dev/scripts/self-test.ts
```

技能资产主体（`SKILL.md` / `references/` / `templates/` / `examples/`）是纯 Markdown，无需任何运行时；`w-model-dev/scripts/*.ts` 是自包含 TypeScript，仅依赖 `tsx` 运行 ESM。

## 开发工作流

### 1. 创建分支

```bash
git checkout -b feature/your-feature
# 或
git checkout -b fix/issue-xxx
```

### 2. 修改资产

遵循以下原则：

- **单一职责**：每个 `references/phase-N-*.md` 只描述一个阶段，每个脚本只做一件事
- **类型安全**：`w-model-dev/scripts/*.ts` 启用 TypeScript 严格风格，避免 `any`
- **自包含**：脚本不得 import `src/` 或任何外部业务模块，仅依赖本目录内文件与 Node 标准库
- **中文注释**：注释使用中文（与现有风格一致），标识符用英文
- **避免过度工程**：只实现必要的功能，不为假设的未来需求设计

### 3. 验证校验脚本

修改 `w-model-dev/scripts/*.ts` 后，必须先跑自检脚本，再用端到端方式验证：

```bash
# 3.1 跑自检（samples/ 目录下 17 条样本：verifier 10 + gate 7）
npm run self-test
# 等价于：npx tsx w-model-dev/scripts/self-test.ts
# 退出码 0=全部样本与期望一致 / 1=至少一条不匹配
# 新增校验项时，必须同步增加 samples/ 下通过 / 失败各一条样本并在 self-test.ts 中声明期望

# 3.2 端到端验证（用真实文件走 CLI 入口）
# 准备一个最小 VerifierOutput JSON 样本，校验通过 / 失败两条路径都要走通
npm run check:verifier -- <sample.json>
# 退出码 0=通过 / 1=校验失败 / 2=输入错误

# 准备一个最小 .w-model/rtm.json，校验工件质量门两条路径
npm run check:gate -- <project-dir>
# 退出码 0=通过 / 1=未通过 / 2=输入错误
```

> 本仓库不设单元测试框架。校验纯逻辑（`gate-logic.ts` / `verifier-logic.ts`）的正确性
> 通过 `self-test.ts` + `samples/` 端到端样本验证，二者共同构成回归基线。
>
> 本仓库**不使用远程 CI**：推送前门禁由本地 git hook 承载，详见下方「本地推送前门禁」。

### 本地推送前门禁

为替代远程 CI，仓库内置一个 [`git pre-push`](./.githooks/pre-push) hook，
在 `git push` 时自动跑与原 CI 一致的 5 项检查；任一退出码不符预期即中止推送：

| # | 检查 | 期望退出码 |
|---|---|---|
| 1 | `npm run self-test`（17 条样本回归基线） | 0 |
| 2 | `npm run check:verifier`（无参数） | 2 |
| 3 | `npm run check:gate -- /tmp/nonexistent`（输入错误） | 2 |
| 4 | `npm run check:verifier -- samples/verifier/valid.json`（有效样本） | 0 |
| 5 | `npm run check:verifier -- samples/verifier/bad-ranking-k.json`（无效样本） | 1 |

**启用方式**（仓库克隆后执行一次即可，配置写入本地 `.git/config`，不影响仓库内容）：

```bash
npm run setup:hooks
# 等价于 git config core.hooksPath .githooks
```

**手动触发**（不实际推送，仅跑门禁验证）：

```bash
npm run prepush
```

**触发条件**：hook 会先判断本次推送的提交里是否包含以下路径的变更，命中才跑门禁，
纯文档 / 模板改动直接放行，避免无谓延迟：

- `w-model-dev/scripts/**`
- `package.json`
- `.githooks/pre-push`

**临时跳过**（仅紧急情况，勿用于常规开发）：

```bash
git push --no-verify
```

### 4. 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/)：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

类型：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档变更
- `refactor`: 重构（不改变功能）
- `chore`: 构建 / 工具变更

示例：
```
feat(verifier): 在 verifier-logic.ts 增加对 ranking.temperature 上界的校验
fix(gate): 修复覆盖率统计未考虑待执行用例的问题
docs(ssot): 同步 §3.3 架构原则与外部工具边界
refactor(skill): /wm review 编排指引精简
```

### 5. 提交 Pull Request

- PR 标题遵循 Conventional Commits 格式
- PR 描述说明：改了什么、为什么改、如何验证（构造了什么输入、退出码如何）
- 关联相关 issue（如 `Closes #5`）

## 文档维护规则

### SSoT 原则

- **设计决策**统一记录在 [`docs/skill-design-document_SSoT.md`](./docs/skill-design-document_SSoT.md)
- `docs/skill-design-document.md` 仅作为指针，不再独立维护内容
- 修改设计 → 先改 SSoT → 再改 `w-model-dev/` 资产（`SKILL.md` / `references/` / `scripts/` / `templates/`）→ 最后同步 `README.md` / `AGENTS.md` / `CONTRIBUTING.md` / `CHANGELOG.md` / `docs/INSTALL.md`

### 变更日志

- 每次用户可见的变更都记录在 [`CHANGELOG.md`](./CHANGELOG.md) 的 `[Unreleased]` 段
- 遵循 Keep a Changelog 规范

## 项目结构约定

```
w-model-dev/            # Skill 资产（标准 skill 结构，自包含、可独立拷贝分发）
├── SKILL.md            # 编排逻辑 + 命令接口 + 架构定位
├── references/         # 阶段细则 + verifier-spec.md + 数据模型 + RTM 指南 + 质量标准
├── scripts/            # 只做门禁 / 校验，不调用 LLM（自包含，仅依赖 tsx）
│   ├── gate-logic.ts
│   ├── check-artifact-gate.ts
│   ├── verifier-logic.ts
│   ├── check-verifier-output.ts
│   ├── self-test.ts                # 校验逻辑自检（samples/ 驱动）
│   └── samples/                    # 端到端样本（verifier/ + gate/）
├── templates/          # 文档模板
└── examples/           # 交互示例
w-model-dev-demo/       # 参考实现：博客系统后端（W 模型 8 阶段端到端调测产物，独立于技能资产）
├── docs/               #   8 阶段产出文档（需求 / 设计 / 四级测试用例与报告）
├── src/                #   实现代码（Express + TS）
├── tests/              #   四级测试（unit / integration / system / acceptance）
└── package.json        #   demo 自身的依赖与脚本（独立于根 package.json）
docs/                   # 设计文档统一存放（SSoT、集成设计、安装指南等）
```

> 本仓库不包含 `src/` TypeScript 引擎或 `tests/` 测试套件；根目录的 `package.json` 仅声明 `tsx` 作为开发依赖，不引入构建工具链。
> `/wm` 命令、状态持久化、RTM 维护均由 Agent 按 `SKILL.md` 在项目内（`.w-model/*.json`）完成。
> `w-model-dev-demo/` 是参考实现，独立于技能资产，**不参与 `/wm` 命令编排**，也不被 `check-*-gate.ts` 读取。修改技能资产时无需同步改动 demo。

### 添加新命令

1. 在 [`w-model-dev/SKILL.md`](./w-model-dev/SKILL.md) 的「命令接口」表新增一行
2. 在「指令（执行规则）」节补充新命令的执行步骤（核心命令补到 §1/§2/§3，辅助命令补到 §6）
3. 同步更新 [`README.md`](./README.md) 的「命令一览」表
4. 同步更新 [`docs/skill-design-document_SSoT.md`](./docs/skill-design-document_SSoT.md) §6.1 / §6.2 与附录 A 命令速查
5. 同步更新 `w-model-dev/SKILL.md` YAML frontmatter `description` 中的命令列表（影响 Agent 自动激活触发）

### 修改 LLM-as-a-Verifier 评审规范

LLM 评审逻辑由 `w-model-dev/` 下的提示词 + 校验脚本承载：

1. **修改提示词 / Schema / 子标准**：先改 [`w-model-dev/references/verifier-spec.md`](./w-model-dev/references/verifier-spec.md)（权威来源）
2. **同步校验逻辑**：修改 [`w-model-dev/scripts/verifier-logic.ts`](./w-model-dev/scripts/verifier-logic.ts) 的 `SUB_CRITERIA` 常量与 `checkVerifierOutput` 校验项
3. **端到端验证**：在 `w-model-dev/scripts/samples/verifier/` 增加通过 / 失败各一条样本，运行 `npm run self-test` 确认所有样本期望匹配；再用 `npm run check:verifier -- <sample.json>` 走 CLI 入口验证
4. **同步 SSoT**：更新 [`docs/skill-design-document_SSoT.md`](./docs/skill-design-document_SSoT.md) §7.6 与 §16.2
5. **同步集成设计**：更新 [`docs/llm-verifier-integration-design.md`](./docs/llm-verifier-integration-design.md)

### 技能演化与评估（外部工具边界）

技能自演化（Rollout / Reflect / Edit / Skill Lift 评估 / 轨迹分析）**不在本仓库内贡献**。
相关能力由外部工具实现，本仓库只产出供其消费的 `VerifierOutput` JSON：

- [SkillOpt](https://github.com/microsoft/SkillOpt)（微软）
- [darwin-skill](https://github.com/alchaincyf/darwin-skill)

如需调整 `VerifierOutput` Schema 以更好支持外部演化工具的消费，按上一节「修改 LLM-as-a-Verifier 评审规范」流程进行；演化算法本身的改进请在对应外部工具仓库贡献。

## 发布流程

1. 更新 `CHANGELOG.md`，将 `[Unreleased]` 改为版本号 + 日期
2. 创建 git tag：`git tag v0.x.0`
3. 推送 tag：`git push origin v0.x.0`

> 本仓库版本号以 git tag 为准；`package.json` 中的 `version` 字段仅作开发记录，不发布到 npm（`private: true`）。

## 问题反馈

- Bug 报告：通过 GitHub Issues，使用 Bug 模板
- 功能建议：通过 GitHub Issues，使用 Feature Request 模板
- 安全问题：请勿公开报告，私信维护者

## License

贡献的代码遵循项目的 [MIT License](./LICENSE)。
