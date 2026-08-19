# W-Model 技能包排障手册（Troubleshooting）

> 面向对象：G 门禁子代理、手工跑校验脚本 / git 钩子的开发者与使用者。
> 校验失败排查思路与规则依据见 [user-guide.md](./user-guide.md)；本手册只解决「跑不起来 / 环境问题 / 契约声明」。

## 1. FAQ

### 1.1 Windows 非 Git Bash 环境执行钩子 / 门禁报错

**现象**：

- `npm run prepush` 报 `'bash' 不是内部或外部命令` 或类似找不到 bash；
- `git push` 时终端出现 `[pre-push] ⚠ 检测到纯 Windows cmd/PowerShell 环境（无 bash 解释器）` 提示。

**原因**：`.githooks/pre-push` 是 bash 脚本（`package.json` 的 `prepush` 用 `bash .githooks/pre-push` 调用），依赖 bash 解释器；原生 cmd/PowerShell 没有 bash。

**处置**：

1. 安装 [Git for Windows](https://git-scm.com/)，**用 Git Bash** 运行 `npm run prepush` / `git push`；
2. 或使用 WSL，在 WSL 侧运行门禁（平台依赖会自动补装，见 [1.6](#16-wsl--windows-双平台-node_modules)）。

**注意**：pre-push 检测到纯 Windows shell 时会**提示并放行（exit 0），但门禁并未真正执行**——此时推送没有经过任何校验，需要时请手动在 Git Bash 中补跑 `npm run prepush`。

### 1.2 `git push --no-verify`（契约声明）

**声明**：本仓库不集成云端 CI，本地 pre-push 门禁是**唯一质量屏障**。`git push --no-verify` 跳过门禁视为**破坏契约**，仅限紧急情况且后果自负——`.githooks/pre-push` 头部有显式警告，README「CI 策略」节有同样声明。

**正确姿势**：紧急绕过后，事后必须在 Git Bash / WSL 中补跑 `npm run prepush`，确认 17 项门禁全部通过后再合入；不得把 `--no-verify` 作为常规开发手段。

### 1.3 node_modules 缺失

**现象**：`npm run self-test` 报找不到 `tsx`；`git push` 时 pre-push 提示 `node_modules 缺失`。

**处置**：

- pre-push 检测到 `node_modules` 缺失时会**自动执行 `npm install --no-audit --no-fund`**，装不上才报错阻断；
- 手动场景直接 `npm install`（同时触发 `postinstall` 自动启用钩子，见 [1.5](#15-postinstall-未自动启用钩子)）。

### 1.4 eslint security baseline 指纹失效 / 需重生成

**现象**：

- `npm run lint:security` 退出码 1：检出 **baseline 未覆盖的新风险**（`scripts/**` 有变更时 docs-consistency 门禁也会提示 baseline 同步）；
- 退出码 2：baseline 文件损坏或旧版位置指纹格式。

**原因**：安全扫描用 `.eslintsecurity-baseline.json` 的 sha256 指纹豁免已知风险（baseline v2 = `sha256(file + ruleId + 归一化违规行内容)`）；新增 / 修改 `w-model-dev/scripts/**/*.ts` 引入新风险时指纹不匹配。

**处置**：

```bash
# 全量重生成 baseline v2（按当前发现重建豁免清单）
npx tsx w-model-dev/scripts/cli/security-scan.ts --regenerate
```

**注意**：`--regenerate` 会豁免**当前全部发现**——先人工确认新风险不是真实漏洞（真实漏洞应先修复代码），确认属已知/可接受风险后再重生成。

### 1.5 postinstall 未自动启用钩子

**现象**：`npm install` 之后 `git push` 不跑门禁（无 `[pre-push]` 输出）。

**原因**：`postinstall` 通过 `scripts/setup-hooks.cjs` 执行 `git config core.hooksPath .githooks`（仅当 `.githooks/` 存在时；失败仅 warn 不阻断 install）；在已 clone 的旧目录或钩子被覆盖时可能未生效。

**处置**：

```bash
npm run setup:hooks   # 等价于 git config core.hooksPath .githooks
git config core.hooksPath   # 确认输出 .githooks
```

### 1.6 WSL / Windows 双平台 node_modules

**现象**：同一仓库在 Windows 与 WSL 两侧共用 node_modules 时，门禁脚本可能报平台二进制缺失（esbuild / rolldown 等原生包）。

**处置**：pre-push 会自动跑 `.githooks/ensure-platform-deps.sh` 补装当前平台原生二进制（npm pack + 解压，不破坏另一侧依赖树）；补装失败即中止推送。手动补装可执行：

```bash
bash .githooks/ensure-platform-deps.sh
```

### 1.7 docs-consistency 报 vitest 用例数 / 文件数不匹配

**现象**：`npm run check:docs-consistency` 退出码 1，提示 README / AGENTS.md / `.githooks/pre-push` 应含实测用例总数「N tests」或「N 条」，或提示 README 声明「N files」/ AGENTS 声明「N 个 .test.ts」与实测文件数不符。

**原因**：docs-consistency 门禁强制活体文档中的计数与实测一致——实测 vitest 文件数须命中 README「N files」/ AGENTS「N 个 .test.ts」声明集，实测用例总数须出现在 README / AGENTS / pre-push 三处文本；**新增 / 删除 `.test.ts` 文件或增删测试用例**后未同步文档。期望值从文档解析（无代码常量），无需同步 `docs-consistency-logic.ts`。

**处置**：文件数同步 README「N files」+ AGENTS「N 个 .test.ts」；用例总数（vitest 实测）同步 README / AGENTS / pre-push 三处文本（「N tests」/「N 条」表述）。

### 1.8 self-test 新增校验项但未加样本

**现象**：修改 `*-logic.ts` 后 `npm run self-test` 失败（样本期望不匹配 / 新逻辑无样本覆盖）。

**处置**：在 `w-model-dev/scripts/samples/` 补充对应通过 / 失败 / 输入错误三态样本，并同步 `__tests__/README.md` coverage 矩阵（规则：每次修改校验逻辑必须跑通 self-test，新增校验项需同步增加样本）。

## 2. 环境问题矩阵

| 环境 | 场景 | 行为 | 处置 |
|---|---|---|---|
| Windows 原生 cmd / PowerShell | `git push` / `npm run prepush` | pre-push 检测到无 bash 解释器 → 提示 + 放行（exit 0），门禁**未执行** | 改用 Git Bash / WSL 跑门禁（见 [1.1](#11-windows-非-git-bash-环境执行钩子--门禁报错)） |
| Windows + Git Bash | `git push` / `npm run prepush` | 正常执行 17 项门禁 | — |
| WSL | `git push` / `npm run prepush` | 正常执行；自动补装 Linux 侧原生二进制 | 补装失败则中止，检查网络 |
| Linux / macOS | `git push` / `npm run prepush` | 正常执行 | — |
| 任意 | `npm audit` 网络不可达（ENOTFOUND / ETIMEDOUT / ECONNREFUSED） | pre-push 第 13 项 warn 并跳过（不阻断） | 网络恢复后手动补跑 `npm audit --audit-level=high` |
| 任意 | registry 不支持 audit endpoint（ENOTSUP / ENOAUDIT / NOT_IMPLEMENTED） | 同上，跳过不阻断 | 换 registry 后重跑 |
| 任意 | `npm audit` 检出 high 以上漏洞 | pre-push **阻断**（fail-closed，其余输出一律视为真实漏洞） | 升级依赖修复后重跑；见 [user-guide.md §6](./user-guide.md) 依赖巡检流程 |
| 任意 | `node_modules` 缺失 | pre-push 自动 `npm install --no-audit --no-fund` | 装不上则报错阻断，检查网络 / npm 配置 |
| 任意 | 钩子未启用 | push 不触发门禁 | `npm run setup:hooks`（见 [1.5](#15-postinstall-未自动启用钩子)） |

## 3. 快速排查路径

| 现象 | 可能原因 | 处置 |
|---|---|---|
| push 无任何 `[pre-push]` 输出 | 钩子未启用 / 路径过滤未命中 | `npm run setup:hooks`；确认变更触及 `docs/*.md`、`w-model-dev/**` 等触发路径 |
| push 提示「纯 Windows cmd/PowerShell」 | 在 cmd/PowerShell 而非 Git Bash 中操作 | 换 Git Bash / WSL（见 [1.1](#11-windows-非-git-bash-环境执行钩子--门禁报错)） |
| `npm run prepush` 报 `'bash' 不是内部或外部命令` | 无 bash 解释器 | 安装 Git for Windows 用 Git Bash 运行 |
| `npm run lint:security` 退出 1 / 2 | baseline 指纹失效 | 人工确认风险后 `--regenerate`（见 [1.4](#14-eslint-security-baseline-指纹失效--需重生成)） |
| 门禁脚本退出 2（`ERROR_JSON`） | 参数 / 文件路径 / JSON 格式问题 | 按 6 类错误类别排查，见 [user-guide.md §3.3](./user-guide.md) |
| `check-docs-consistency` 退出 1 | 文档计数与代码事实漂移 | 按 violations 文本同步文档（见 [1.7](#17-docs-consistency-报-vitest-用例数--文件数不匹配)） |
| 依赖升级后门禁失败 | 依赖行为变化影响校验逻辑 | 回到当批起点修正，跑全量回归；勿用 `--no-verify` 绕过（见 [1.2](#12-git-push---no-verify契约声明)） |

## 4. 相关文档

- [用户指南（校验失败排查 / 规则依据 / 依赖巡检）](./user-guide.md)
- [README（CI 策略 / 快速上手）](../README.md)
- [安装指南](./INSTALL.md)
