# 贡献指南

感谢你对 W-Model AI Assistant Skill 项目的关注！本文档说明如何参与贡献。

## 行为准则

请保持尊重与专业。任何形式的骚扰或不友善行为都不被接受。

## 开发环境准备

本仓库是单纯的编排 + 校验脚本技能，工程化极简：根目录有一个 `package.json`，声明 `tsx`（运行 `w-model-dev/scripts/cli/*.ts`）+ `ajv`/`ajv-formats`（schema 校验 runtime 依赖）+ `eslint-plugin-security`（安全扫描）+ `@typescript-eslint/*` + `vitest` 等开发依赖，无构建步骤、无 `src/`、无编程式 SDK。

```bash
# 1. 克隆仓库
git clone <repo-url>
cd Software_Engineering_W_Development_Model_Skills_Pack

# 2. 安装开发依赖（tsx / ajv / eslint-plugin-security / vitest 等）
npm install
# 克隆后首次 npm install 即自动启用本地推送前门禁：
# postinstall 自动执行 git config core.hooksPath .githooks（仅当 .githooks/ 存在时，失败仅 warn 不阻断 install）

# 3.（可选）如需手动重置 / 确认钩子配置，执行一次（写入本地 .git/config）
npm run setup:hooks
# 等价于 git config core.hooksPath .githooks
# 启用后每次 git push 会自动跑回归基线，详见下方「本地推送前门禁」一节
```

技能资产主体（`SKILL.md` / `references/` / `templates/` / `examples/`）是纯 Markdown，无需任何运行时；`w-model-dev/scripts/cli/*.ts` 是自包含 TypeScript，仅依赖 `tsx` 运行 ESM。

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
- **类型安全**：`w-model-dev/scripts/cli/*.ts` 启用 TypeScript 严格风格，避免 `any`
- **自包含**：脚本不得 import `src/` 或任何外部业务模块，仅依赖本目录内文件与 Node 标准库
- **逻辑/IO 分离**：校验逻辑放 `*-logic.ts`（纯函数），CLI 入口放 `check-*.ts`（IO 抽离）；新增校验规则优先改 logic 层
- **中文注释**：注释使用中文（与现有风格一致），标识符用英文
- **避免过度工程**：只实现必要的功能，不为假设的未来需求设计

### 3. 验证校验脚本

修改 `w-model-dev/scripts/cli/*.ts` 后，必须先跑回归测试，再跑自检基线：

```bash
# 3.1 单元测试（vitest，35 个 test 文件 / 571 条，含各 *-logic.ts 纯逻辑与 CLI 集成测试）
npx vitest run --config config/vitest.config.ts

# 3.2 自检基线（samples/ 目录下 252 条样本，覆盖全部 check 脚本的通过 / 失败路径）
npm run self-test
# 退出码 0=全部样本与期望一致 / 1=至少一条不匹配
# 新增校验项时，必须同步增加 samples/ 下通过 / 失败各一条样本并在 self-test.ts 中声明期望

# 3.3 端到端验证（用真实文件走 CLI 入口）
# 准备一个最小 VerifierOutput JSON 样本，校验通过 / 失败两条路径都要走通
npm run check:verifier -- <sample.json>
# 退出码 0=通过 / 1=校验失败 / 2=输入错误

# 3.4 格式化（提交前保证格式一致；幂等，覆盖 w-model-dev/scripts/**/*.ts + config/ + scripts/*.cjs）
npm run format
```

> 本仓库的校验正确性由两层保障：
> - **vitest 单元测试**（`w-model-dev/scripts/__tests__/`）覆盖纯逻辑边界路径，coverage 矩阵见 [`__tests__/README.md`](./w-model-dev/scripts/__tests__/README.md)
> - **self-test 回归基线**（`samples/` 端到端样本）覆盖各 CLI 的通过 / 失败 / 输入错误三态

### 本地推送前门禁

为替代远程 CI，仓库内置一个 [`git pre-push`](./.githooks/pre-push) hook，
在 `git push` 时自动跑 15 项检查；任一退出码不符预期即中止推送：

| # | 检查 | 期望退出码 |
|---|---|---|
| 1 | `npm run self-test`（252 条样本回归基线） | 0 |
| 2 | `npm run check:verifier`（无参数） | 2 |
| 3 | `npm run check:gate -- /tmp/nonexistent`（输入错误） | 2 |
| 4 | `npm run check:verifier -- samples/verifier/valid.json`（有效样本） | 0 |
| 5 | `npm run check:verifier -- samples/verifier/bad-ranking-k.json`（无效样本） | 1 |
| 6 | `npx tsx w-model-dev/scripts/cli/security-scan.ts`（安全扫描 + baseline v2 内容比对；--regenerate 重生成） | 0 |
| 7 | `npx tsx w-model-dev/scripts/cli/check-bdd-model.ts samples/bdd/valid-manifest.json --phase=1`（有效 BDD 样本） | 0 |
| 8 | `npx tsx w-model-dev/scripts/cli/check-bdd-model.ts samples/bdd/bad-schema.manifest.json --phase=1`（schema 不合规 BDD 样本） | 2 |
| 9 | `npm run check:coverage -- samples/coverage/valid-minimal-coverage.json`（有效覆盖样本） | 0 |
| 10 | `npm run check:exemption -- samples/exemption/valid-full-approval.json`（有效豁免样本） | 0 |
| 11 | `npx tsx w-model-dev/scripts/cli/check-signature-chain.ts samples/signature-chain/valid-all-roles.jsonl --phase=1`（有效签名链样本） | 0 |
| 12 | `npx vitest run --coverage --config config/vitest.config.ts`（单元测试全量 + 覆盖率阈值门禁：stmts 75 / branch 65 / funcs 85 / lines 75，阈值不达标 vitest exit 1；35 files / 571 tests） | 0 |
| 13 | `npm audit --audit-level=high`（依赖漏洞扫描，high 以上阻断；网络不可达或 registry 不支持 audit endpoint 自动跳过） | — |
| 14 | `npm run check:docs-consistency`（活体文档一致性门禁） | 0 |
| 15 | `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`（samples 覆盖矩阵门禁：每个 fixture 被 self-test.ts 引用 + 子目录在矩阵声明） | 0 |

**启用方式**：克隆后首次 `npm install` 即自动启用（`postinstall` 自动执行 `git config core.hooksPath .githooks`，仅当 `.githooks/` 存在时，失败仅 warn 不阻断 install）。如需手动重置 / 确认，执行一次即可（配置写入本地 `.git/config`，不影响仓库内容）：

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

> Windows 注意：pre-push 依赖 bash。**Git Bash（Git for Windows 自带）下会正常执行门禁**；仅纯 cmd/PowerShell（无 bash 解释器）环境无法执行，hook 检测到后给出指引并放行（exit 0），不误报失败。请使用 Git Bash 运行 `npm run prepush`。
> **WSL / 双平台**：仓库 node_modules 若在 Windows 侧安装，WSL/Linux 下运行门禁前，pre-push 会自动调用 [`.githooks/ensure-platform-deps.sh`](./.githooks/ensure-platform-deps.sh) 补装对应平台的原生二进制（esbuild / rolldown，通过 `npm pack` + 解压，绕过 npm 依赖树以免破坏另一平台二进制），保证 Windows 与 WSL 共用同一份 node_modules 均可跑通门禁。

### 4. 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/)：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**类型（type）**：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档变更
- `refactor`: 重构（不改变功能）
- `test`: 测试相关（新增 / 修改 vitest 用例或 self-test 样本）
- `chore`: 构建 / 工具变更
- `ci`: 门禁 / 钩子相关（`.githooks/`、prepush）

**Scope（可选，按实际模块取有意义的名称）**：
- `scripts`：校验脚本 / 门禁逻辑（`w-model-dev/scripts/`）
- `docs`：文档 / SSoT 同步
- `gate`：阶段门禁规则
- `error`：错误结构 / 退出码
- `config`：工程配置（eslint / tsconfig / vitest）
- `hooks`：git 钩子 / 本地门禁（`.githooks/`）

**PR 标题**：与提交信息同格式 `<type>(<scope>): <summary>`（scope 可省略）。

**提交流程**：

1. 创建分支（见上文「1. 创建分支」）
2. 本地验证：`npm run prepush`（15 项本地门禁，替代云端 CI；纯文档改动可仅跑 `npm run check:docs-consistency`）
3. 按上述格式提交
4. 推送分支并创建 PR，使用 [`.github/PULL_REQUEST_TEMPLATE.md`](./.github/PULL_REQUEST_TEMPLATE.md) 模板（见下节）

示例：
```
feat(verifier): 在 verifier-logic.ts 增加对 ranking.temperature 上界的校验
fix(gate): 修复覆盖率统计未考虑待执行用例的问题
docs(ssot): 同步 §3.3 架构原则与外部工具边界
refactor(skill): /wm review 编排指引精简
```

### 5. 提交 Pull Request

- PR 标题遵循 Conventional Commits 格式（同提交信息：`<type>(<scope>): <summary>`）
- PR 描述使用 [`.github/PULL_REQUEST_TEMPLATE.md`](./.github/PULL_REQUEST_TEMPLATE.md) 模板，说明：改了什么、为什么改、如何验证（构造了什么输入、退出码如何）
- 关联相关 issue（如 `Closes #5`）
- 本仓库无云端 CI：模板中的校验要点由本地 `npm run prepush`（15 项门禁）验证，合入前请确保本地已通过

## 文档维护规则

### SSoT 原则

- **设计决策**统一记录在 [`docs/skill-design-document_SSoT.md`](./docs/skill-design-document_SSoT.md)
- `docs/skill-design-document.md` 仅作为指针，不再独立维护内容（文件头部已标注「已废弃独立维护」）
- 修改设计 → 先改 SSoT → 再改 `w-model-dev/` 资产（`SKILL.md` / `references/` / `scripts/` / `templates/`）→ 最后同步 `README.md` / `AGENTS.md` / `CONTRIBUTING.md` / `CHANGELOG.md` / `docs/INSTALL.md`
- **数字一致性**：文档中出现的 self-test 基线数、vitest 测试数、schema 份数、版本号（package.json / SKILL.md frontmatter / skill-metadata.json / README「当前版本」 / docs/INSTALL.md 激活示例五处）必须与实测一致，改动后全仓库 grep 复查；版本号五处一致性已由 `check-docs-consistency.ts`（version-consistency 检查项）与 `skill-metadata.test.ts` 自动门禁，bump 版本号时同步更新 `docs-consistency-logic.ts` 的 `EXPECTED.currentVersion`
- **BDD 文档维护**：修改 BDD features 结构 / 状态机七要素 / `bdd-manifest.json` schema / `check-bdd-model.ts` 校验维度时，必须同步更新 SSoT §3.4.14 + `bdd-guide.md` + `bdd-review-checklist.md` + `data-models.md` BDD 数据模型节 + `anti-patterns.md` #29 关联节

### 变更日志

- 每次用户可见的变更都记录在 [`CHANGELOG.md`](./CHANGELOG.md) 的 `[Unreleased]` 段
- 遵循 Keep a Changelog 规范

## 项目结构约定

```
w-model-dev/            # Skill 资产（标准 skill 结构，自包含、可独立拷贝分发）
├── SKILL.md            # 编排逻辑 + 命令接口 + 架构定位（frontmatter version 与 package.json 镜像）
├── references/         # 阶段细则 + verifier-spec + 数据模型 + 负面知识库 + 各指南（按需加载）
├── subagent/           # 人格库（28 个 Markdown 文件，分 engineering/testing/design/product/project 5 类）
├── schemas/            # JSON Schema (draft-07) 文件（20 份）
├── scripts/            # 只做门禁 / 校验，不调用 LLM（自包含，仅依赖 tsx）
│   ├── *-logic.ts / check-*.ts    # 纯逻辑层 + CLI 入口层（gate / verifier / graph / tla / code-tla / budget / run-log / maturity / checkpoint / root-cause / signature-chain / archive-integrity / preventive-review / iceberg-sweep / tla-bdd-sync / role-dispatch / design-contract / coverage / exemption / bdd / state-machine）
│   ├── schema-loader.ts           # ajv 单例 + schemas/ 自动加载
│   ├── security-scan.ts           # eslint-plugin-security 扫描 + baseline v2 指纹豁免
│   ├── wm-status.ts / metrics-report.ts   # 只读报告脚本（状态快照 / 流程度量）
│   ├── lib/cli-error.ts           # exit 2 错误结构统一（6 类错误码）
│   ├── self-test.ts               # 校验逻辑自检（252 条样本，samples/ 驱动）
│   ├── __tests__/                 # vitest 单元测试（35 个 .test.ts / 571 条 + README.md coverage 矩阵）
│   └── samples/                   # 端到端样本（verifier/ + gate/ + graph/ + coverage/ + exemption/ + tla/ + bdd/ + signature-chain/ 等）
├── templates/          # 文档模板（需求/设计/测试/RTM 等，阶段 1-4 含主模板 + 6 独立子模板）
├── examples/           # 交互示例
└── skill-metadata.json # 版本号镜像（与 SKILL.md frontmatter 双写）
docs/                   # 设计文档统一存放（SSoT、集成设计、安装指南等）
└── changes/archive/    # 端到端调测归档（按时间倒序）
```

> 本仓库不包含 `src/` TypeScript 引擎或业务 `tests/` 套件；`w-model-dev/scripts/__tests__/` 是技能脚本自身的单元测试，与 W 模型编排产出的四级测试（单元/集成/系统/验收）无关。
> `/wm` 命令、状态持久化、RTM 维护均由 Agent 按 `SKILL.md` 在项目内（`.w-model/*.json`）完成。
> 端到端调测产物归档于 `docs/changes/archive/`，独立于技能资产，**不参与 `/wm` 命令编排**，也不被 `check-*-gate.ts` 读取。修改技能资产时无需同步改动归档。

### 添加新命令

1. 在 [`w-model-dev/SKILL.md`](./w-model-dev/SKILL.md) 的「命令接口」表新增一行
2. 在「指令（执行规则）」节补充新命令的执行步骤（核心命令补到 §1/§2/§3，辅助命令补到 §6）
3. 同步更新 [`README.md`](./README.md) 的「命令一览」表
4. 同步更新 [`docs/skill-design-document_SSoT.md`](./docs/skill-design-document_SSoT.md) §6.1 / §6.2 与附录 A 命令速查
5. 同步更新 `w-model-dev/SKILL.md` YAML frontmatter `description` 中的命令列表（影响 Agent 自动激活触发）

### 修改 LLM-as-a-Verifier 评审规范

LLM 评审逻辑由 `w-model-dev/` 下的提示词 + 校验脚本承载：

1. **修改提示词 / Schema / 子标准**：先改 [`w-model-dev/references/verifier-spec.md`](./w-model-dev/references/verifier-spec.md)（权威来源）
2. **同步校验逻辑**：修改 [`w-model-dev/scripts/logic/verifier-logic.ts`](./w-model-dev/scripts/logic/verifier-logic.ts) 的 `SUB_CRITERIA` 常量与 `checkVerifierOutput` 校验项
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
2. 同步版本号三处：`package.json` `version` + `w-model-dev/SKILL.md` frontmatter `version` + `w-model-dev/skill-metadata.json`（`__tests__/skill-metadata.test.ts` 回归校验一致）
3. 创建 git tag：`git tag v<version>`（如 `v41.2.0`）
4. 推送 tag：`git push origin v<version>`

> 本仓库版本号以 git tag + 三处一致为准；`package.json` 不发布到 npm（`private: true`）。

## 问题反馈

- Bug 报告：通过 GitHub Issues，使用 Bug 模板
- 功能建议：通过 GitHub Issues，使用 Feature Request 模板
- 安全问题：请勿公开报告，私信维护者

## License

贡献的代码遵循项目的 [MIT License](./LICENSE)。
