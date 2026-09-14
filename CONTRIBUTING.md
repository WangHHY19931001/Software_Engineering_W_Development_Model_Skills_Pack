# 贡献指南

感谢你对 W-Model AI Assistant Skill 项目的关注！本文档说明如何参与贡献。

### Source-bound provenance 边界

`evidence-provenance.schema.json` 登记受控本机的 source provenance；`npm run wm:verify-evidence-source -- <project-dir>`（`wm-verify-evidence-source.ts`）是 producer+verify 命令，会生产并验证 source provenance。`npm run wm:export-evidence -- <project-dir> <output-dir>` 只从 `.w-model` 下的 `gate-logs/`、`verifier-outputs/`、`signature-chains/`、`codegraph-queries/` 和 `run-log.jsonl` 白名单导出；项目源码、`.zcode/`、`coverage/`、未白名单运行时文件和 `docs/changes/archive/` 不属于当前运行证据。JSON/JSONL/Markdown 会清理敏感字段与绝对路径，manifest 记录稳定相对路径、kind、SHA-256 和 package manifest hash；CLI 成功输出只显示脱敏占位路径。`wm-export-evidence --verify` 在没有 `--source-project` 时只能是 package-only；只有传入 `--source-project <project-dir>` 才能执行 source-bound verify。受控本机 provenance 通过当前 HEAD、source hash、run 身份和 gate measurements 提供流程完整性；它不是密码学签名，也不是第三方不可抵赖证明。package-only 不能表述为 verified source 证据；导出和 producer+verify 都不会自动 Git 提交或发布。

## 行为准则

请保持尊重与专业。任何形式的骚扰或不友善行为都不被接受。

## 开发环境准备

本仓库是单纯的编排 + 校验脚本技能，工程化极简：根目录有一个 `package.json`，声明 `tsx`（运行 `w-model-dev/scripts/cli/*.ts`）+ `ajv`/`ajv-formats`（schema 校验 runtime 依赖）+ `eslint-plugin-security`（安全扫描）+ `@typescript-eslint/*` + `vitest` 等开发依赖，无构建步骤、无 `src/`、无编程式 SDK。

贡献者先验证仓库，再参与修改。仓库验证的克隆与依赖安装命令（`git clone` / `npm install`）以 [README.md 的「验证仓库」](./README.md#验证仓库) 快速开始块为唯一权威，本节不复述；以下只列本仓库贡献者专属的钩子步骤。这些命令必须从仓库根目录执行；需要 Node.js ≥20、Git 和 npm registry/网络。普通用户只需按 README 的「验证仓库」或「安装 Skill」入口选择目标，不需要运行贡献者的 pre-push 门禁：

```bash
# 完成克隆与 npm install 后：克隆后首次 npm install 即自动启用本地推送前门禁：
# postinstall 自动执行 git config core.hooksPath .githooks（仅当 .githooks/ 存在时，失败仅 warn 不阻断 install）

# （可选）如需手动重置 / 确认钩子配置，执行一次（写入本地 .git/config）
npm run setup:hooks
# 等价于 git config core.hooksPath .githooks
# 启用后每次 git push 会自动跑回归基线，详见下方「本地推送前门禁」一节
```

技能资产主体（`SKILL.md` / `references/` / `templates/` / `examples/`）是纯 Markdown，无需任何运行时；`w-model-dev/scripts/cli/*.ts` 是自包含 TypeScript，仅依赖 `tsx` 运行 ESM。仓库验证不等于 Skill 安装：安装 Skill 时只复制 `w-model-dev/` 到具体 Agent 的 Agent-specific skills 目录，路径以官方文档为准，不要把 `.agent` 当通用路径。

> **本地生成物与审计证据**：`coverage/`、`.zcode/` 与 `.w-model/` 是 **Git 忽略** 的本地生成物，不应强制提交；`.w-model/` 可含运行期状态与审计证据，默认不随 Git 交付。需要交付时先运行 `npm run wm:verify-evidence-source -- <project-dir>` 由 producer 重建并写入 source-bound provenance，再运行 `npm run wm:export-evidence -- <project-dir> <output-dir>` 生成脱敏、带 SHA-256 manifest 的证据包；`wm-export-evidence --verify` 默认仅做 package-only 校验，传 `--source-project` 才做 source-bound 重验；导出后仍须按项目安全策略审阅，且不会自动提交或发布。受控且被跟踪的历史归档是 `docs/changes/archive/`，与本地 `.w-model/` 不同。

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
# 3.1 单元测试（vitest，文件数与用例数以当前命令输出为准，含各 *-logic.ts 纯逻辑与 CLI 集成测试）
npx vitest run --config config/vitest.config.ts

# 3.2 自检基线（333 条 self-test 运行用例，覆盖全部 check 脚本的通过 / 失败路径；samples/ 为 fixture 载体）
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
>
> - **vitest 单元测试**（`w-model-dev/scripts/__tests__/`）覆盖纯逻辑边界路径，coverage 矩阵见 [`__tests__/README.md`](./w-model-dev/scripts/__tests__/README.md)
> - **self-test 回归基线**（`samples/` 端到端样本）覆盖各 CLI 的通过 / 失败 / 输入错误三态

### 本地推送前门禁

为替代远程 CI，仓库内置一个 [`git pre-push`](./.githooks/pre-push) hook，
在 `git push` 时自动跑 18 项检查；任一退出码不符预期即中止推送：

**触发范围判定**：真实 push 以 git 写入 stdin 的 ref 行（每行 `<local ref> <local sha> <remote ref> <remote sha>` 四字段，多 ref 逐行聚合）为准——local sha 全零（删除远端 ref）跳过该行、remote sha 全零（新分支）经 `git merge-base --fork-point` / merge-base 建立可证明基线（基线为空或退化到推送尖本身时降级经 remote-tracking 排除集枚举证明——remote 名经白名单与 `git remote get-url` 验证后执行 `git log -m --name-only --pretty=format: <local_sha> --not --remotes=<remote>`，`-m` 确保合并提交按父逐个列出避免空 diff 漏检；三级全部失败才 → fail-closed 跑全部门禁）；任一 ref 行解析失败 → fail-closed；delete-only 推送放行；stdin 为空时回退 `HEAD@{push}`/`origin/HEAD` 范围判断，回退失败同样 fail-closed。变更命中 `w-model-dev/**`、根级活体文档/配置、`config/**`、`scripts/**`、`.githooks/**`、`eval/**` 或 `docs/*.md`（bash case 模式 `*` 跨 `/`，含 `docs/` 任意层级归档）才跑门禁，未命中放行。

| #   | 检查                                                                                                                                                                                                                                   | 期望退出码 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | `npm run self-test`（333 条样本回归基线）                                                                                                                                                                                              | 0          |
| 2   | `npm run check:verifier`（无参数）                                                                                                                                                                                                     | 2          |
| 3   | `npm run check:gate -- /tmp/nonexistent`（输入错误）                                                                                                                                                                                   | 2          |
| 4   | `npm run check:verifier -- samples/verifier/valid.json`（有效样本）                                                                                                                                                                    | 0          |
| 5   | `npm run check:verifier -- samples/verifier/bad-ranking-k.json`（无效样本）                                                                                                                                                            | 1          |
| 6   | `npx tsx w-model-dev/scripts/cli/security-scan.ts`（安全扫描 + baseline v2 内容比对；--regenerate 重生成）                                                                                                                             | 0          |
| 7   | `npx tsx w-model-dev/scripts/cli/check-bdd-model.ts samples/bdd/valid-manifest.json --phase=1`（有效 BDD 样本）                                                                                                                        | 0          |
| 8   | `npx tsx w-model-dev/scripts/cli/check-bdd-model.ts samples/bdd/bad-schema.manifest.json --phase=1`（schema 不合规 BDD 样本）                                                                                                          | 2          |
| 9   | `npm run check:coverage -- samples/coverage/valid-minimal-coverage.json`（有效覆盖样本）                                                                                                                                               | 0          |
| 10  | `npm run check:exemption -- samples/exemption/valid-full-approval.json`（有效豁免样本）                                                                                                                                                | 0          |
| 11  | `npx tsx w-model-dev/scripts/cli/check-signature-chain.ts samples/signature-chain/valid-all-roles.jsonl --phase=1`（有效签名链样本）                                                                                                   | 0          |
| 12  | `npx vitest run --coverage --config config/vitest.config.ts`（单元测试全量 + 覆盖率阈值门禁：stmts 75 / branch 65 / funcs 85 / lines 75，阈值不达标 vitest exit 1；文件数/用例数以同次受控 JSON facts 与 provenance 为准）             | 0          |
| 13  | `npm audit --audit-level=high`（依赖漏洞扫描，high 以上阻断；网络瞬态错误（DNS 解析失败、连接被重置/拒绝、超时、HTTP 429/5xx、socket hang up 等）或 registry 不支持 audit endpoint 时自动跳过；漏洞报告、JSON 解析与权限错误仍然阻断） | —          |
| 14  | `npm run check:docs-consistency`（活体文档一致性门禁）                                                                                                                                                                                 | 0          |
| 15  | `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts`（samples 覆盖矩阵门禁：每个 fixture 被 self-test.ts 引用 + 子目录在矩阵声明）                                                                                              | 0          |
| 16  | `npx prettier --config config/prettier.config.cjs --check "w-model-dev/scripts/**/*.ts" "config/**/*.{cjs,ts}" "scripts/*.cjs"`（格式一致性门禁：编辑未跑 `npm run format` 即阻断）                                                    | 0          |
| 17  | `npx tsc -p config/tsconfig.json`（TypeScript strict 类型检查 0 错误，对齐 SSoT §10H.5）                                                                                                                                               | 0          |
| 18  | `npx tsx eval/runner.ts`（触发边界语料断言 + coverageMatrix 五项校验）                                                                                                                                                                 | 0          |

**启用方式**：仓库验证期间首次 `npm install` 即自动启用（`postinstall` 运行 `scripts/setup-hooks.cjs`，在当前 checkout 的本地 `.git/config` 设置 `core.hooksPath=.githooks`；失败仅 warn，不阻断 install）。这是仓库验证的本地 Git 配置副作用，不是 Agent Skill 激活必需。如需手动重置 / 确认，执行一次即可（配置写入本地 `.git/config`，不影响仓库内容）：

```bash
npm run setup:hooks
# 等价于 git config core.hooksPath .githooks
```

如果启用前已有自定义 `core.hooksPath`，请在仓库根目录先保存其本地值。`git config --local --get` 返回码 `1` 表示原先未设值，其他非零码表示读取失败；备份文件只保存在本地 `.git/`，不得提交，请确认文件权限并注意空文件表示原先未设值。

Bash：

```bash
git config --local --get core.hooksPath > .git/hooksPath.previous
status=$?
if [ "$status" -eq 1 ]; then : > .git/hooksPath.previous; elif [ "$status" -ne 0 ]; then exit "$status"; fi
chmod 600 .git/hooksPath.previous
```

PowerShell 5.1：

```powershell
git config --local --get core.hooksPath > .git/hooksPath.previous
$readStatus = $LASTEXITCODE
if ($readStatus -eq 1) { Set-Content -Path .git/hooksPath.previous -Value '' } elseif ($readStatus -ne 0) { throw "无法读取 core.hooksPath，退出码 $readStatus" }
```

撤销或恢复：

```bash
if [ -s .git/hooksPath.previous ]; then git config --local core.hooksPath "$(cat .git/hooksPath.previous)"; else git config --local --unset core.hooksPath; fi
```

PowerShell 5.1：

```powershell
$previousHooksPath = (Get-Content -Raw .git/hooksPath.previous).Trim()
if ([string]::IsNullOrWhiteSpace($previousHooksPath)) { git config --local --unset core.hooksPath } else { git config --local core.hooksPath $previousHooksPath }
```

只有备份文件为空（原先未设值）时才执行 `--unset`；恢复后可按需删除本地 `.git/hooksPath.previous`。

**手动触发**（不实际推送，仅跑门禁验证）：

```bash
npm run prepush
```

**触发条件**：hook 会先判断本次推送的提交里是否包含以下路径的变更，命中才跑门禁；`w-model-dev/**`、根级活体文档/配置（`README.md`/`AGENTS.md`/`CONTRIBUTING.md`/`.gitignore`/`.eslintsecurity-baseline.json`/`package.json`/`package-lock.json`）、`docs/*.md`、`config/**`、根 `scripts/**` 与 `.githooks/**` 均在范围内，未命中上述模式才直接放行；`docs/*.md` 的 `*` 在 shell case 中跨 `/` 匹配，`docs/changes/`、`docs/superpowers/` 等 .md 变更同样触发门禁（过包含方向，安全优先）。

**依赖与平台边界**：pre-push 缺少 `node_modules` 时 exit 1 并提示开发者运行 `npm install`，绝不自动安装。它仅调用 `ensure-platform-deps.sh --check`；默认/`--check` 不进行网络下载、`npm pack`、解包或 `node_modules` 覆盖。缺平台依赖时在 Bash 中显式运行 `npm run platform-deps:check`，或由用户显式运行 `npm run platform-deps:install` 在受控 staging 中校验 lockfile SRI 并安装当前平台缺失包（Windows x64 / Linux x64）；pre-push 不会自动修复：

```bash
npm run platform-deps:check
npm run platform-deps:install  # 用户显式调用：受控验证并安装当前平台缺失包
```

**临时跳过**（仅紧急情况，勿用于常规开发）：

```bash
git push --no-verify
```

> Windows 注意：pre-push 依赖 Bash。Git Bash（Git for Windows 自带）下会执行门禁；纯 cmd/PowerShell 不能执行 `pre-push`，但 `self-test` 与 `doctor` 可在 PowerShell / Windows Terminal 运行。请仅在 Git Bash 中运行 `npm run prepush`。
> **WSL / 双平台**：不要在同一个 checkout 混用 Windows/WSL 的 `node_modules`。建议每个平台使用独立 checkout，或切换平台后重新执行 `npm install`。平台检查失败时使用 Git Bash/WSL 显式运行 `npm run platform-deps:check`，或由用户显式运行 `npm run platform-deps:install` 在受控 staging 中校验并安装缺失包。

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
2. 本地验证：`npm run prepush`（18 项本地门禁，替代云端 CI；纯文档改动可仅跑 `npm run check:docs-consistency`）
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
- 本仓库无云端 CI：模板中的校验要点由本地 `npm run prepush`（18 项门禁）验证，合入前请确保本地已通过

## 文档维护规则

### SSoT 原则

- **设计决策**统一记录在 [`docs/skill-design-document_SSoT.md`](./docs/skill-design-document_SSoT.md)
- `docs/skill-design-document.md` 仅作为指针，不再独立维护内容（文件头部已标注「已废弃独立维护」）
- 修改设计 → 先改 SSoT → 再改 `w-model-dev/` 资产（`SKILL.md` / `references/` / `scripts/` / `templates/`）→ 最后同步 `README.md` / `AGENTS.md` / `CONTRIBUTING.md` / `CHANGELOG.md` / `docs/INSTALL.md`
- **数字一致性**：静态规范计数（self-test 基线、schema 份数、版本号等）必须与权威来源一致；Vitest 文件数/用例数属于动态 facts，只能来自同次受控 JSON 与 provenance，以当前命令输出为准，不从活体文档文本反推或要求多份文档同步。版本号（package.json / SKILL.md frontmatter / skill-metadata.json / README「当前版本」 / docs/INSTALL.md 激活示例 / CHANGELOG.md 首个版本节头 / package-lock.json 根 version 七处）仍由 `check-docs-consistency.ts` 与 `skill-metadata.test.ts` 校验，bump 版本号用 `npm run version:bump -- <新版本>`（`scripts/version-bump.cjs`，一处改版、七文件同步 + 插 CHANGELOG 节头），不再手工多文件改版
- **BDD 文档维护**：修改 BDD features 结构 / 状态机七要素 / `bdd-manifest.json` schema / `check-bdd-model.ts` 校验维度时，必须同步更新 SSoT §10.8 + `bdd.md` + `bdd.md` + `data-models.md` BDD 数据模型节 + `hard-constraints.md` #29 关联节

### 变更日志

- 每次用户可见的变更都记录在 [`CHANGELOG.md`](./CHANGELOG.md) 的 `[Unreleased]` 段
- 遵循 Keep a Changelog 规范

## 项目结构约定

```
w-model-dev/            # Skill 资产（标准 skill 结构，自包含、可独立拷贝分发）
├── SKILL.md            # 编排逻辑 + 命令接口 + 架构定位（frontmatter version 与 package.json 镜像）
├── references/         # 阶段细则 + verifier-spec + 数据模型 + 负面知识库 + 各指南（按需加载）
├── subagent/           # 人格库（28 个 Markdown 文件，分 engineering/testing/design/product/project 5 类）
├── schemas/            # JSON Schema (draft-07) 文件（34 份，含 change-scope / codegraph-query 等）
├── scripts/            # 只做门禁 / 校验，不调用 LLM（自包含，仅依赖 tsx）
│   ├── *-logic.ts / check-*.ts    # 纯逻辑层 + CLI 入口层（gate / verifier / graph / tla / code-tla / budget / run-log / maturity / checkpoint / root-cause / signature-chain / archive-integrity / preventive-review / iceberg-sweep / tla-bdd-sync / role-dispatch / design-contract / coverage / exemption / bdd / state-machine）
│   ├── schema-loader.ts           # ajv 单例 + schemas/ 自动加载
│   ├── security-scan.ts           # eslint-plugin-security 扫描 + baseline v2 指纹豁免
│   ├── wm-status.ts / metrics-report.ts   # 只读报告脚本（状态快照 / 流程度量）
│   ├── lib/cli-error.ts           # exit 2 错误结构统一（6 类错误码）
│   ├── self-test.ts               # 校验逻辑自检（333 条样本，samples/ 驱动）
│   ├── __tests__/                 # vitest 单元测试（文件数与用例数以当前命令输出为准 + README.md coverage 矩阵）
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
2. 同步版本号七处：`package.json` `version` + `w-model-dev/SKILL.md` frontmatter `version` + `w-model-dev/skill-metadata.json` + `README.md`「当前版本」 + `docs/INSTALL.md` 激活示例 + `CHANGELOG.md` 首个版本节头 + `package-lock.json` 根 version（`check-docs-consistency.ts` version-consistency 检查项与 `skill-metadata.test.ts` 回归校验）
3. 创建 git tag：`git tag v<version>`（如 `v41.2.0`）
4. 推送 tag：`git push origin v<version>`

> 本仓库版本号以 git tag + 七处一致为准（门禁校验七处，见上「数字一致性」）；`package.json` 不发布到 npm（`private: true`）。

## 问题反馈

- Bug 报告：通过 GitHub Issues，使用 Bug 模板
- 功能建议：通过 GitHub Issues，使用 Feature Request 模板
- 安全问题：请勿公开报告，私信维护者

## License

贡献的代码遵循项目的 [MIT License](./LICENSE)。
