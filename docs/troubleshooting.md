# W-Model 技能包排障手册（Troubleshooting）

> 面向对象：G 门禁子代理、手工跑校验脚本 / git 钩子的开发者与使用者。
> 校验失败排查思路与规则依据见 [user-guide.md](./user-guide.md)；本手册只解决「跑不起来 / 环境问题 / 契约声明」。

## 1. FAQ

### 1.1 Windows 非 Git Bash 环境执行钩子 / 门禁报错

**现象**：

- `npm run prepush` 报 `'bash' 不是内部或外部命令` 或类似找不到 bash；
- `git push` 时终端出现红色 `[pre-push] ✗ 检测到纯 Windows cmd/PowerShell 环境` 与「本次推送未执行 18 项门禁（exit 0 放行）」提示。

**原因**：`.githooks/pre-push` 是 bash 脚本（`package.json` 的 `prepush` 用 `bash .githooks/pre-push` 调用），依赖 bash 解释器；原生 cmd/PowerShell 没有 bash。

**处置**：

1. 安装 [Git for Windows](https://git-scm.com/)，**用 Git Bash** 运行 `npm run prepush` / `git push`；
2. 或使用 WSL，在 WSL 侧运行门禁；平台原生依赖只会被检查，不会自动补装，见 [1.6](#16-wsl--windows-双平台-node_modules)。

**注意**：pre-push 检测到纯 Windows shell 时会**提示并放行（exit 0），但门禁并未真正执行**——此时推送没有经过任何校验，需要时请手动在 Git Bash 中补跑 `npm run prepush`。

### 1.2 `git push --no-verify`（契约声明）

**声明**：本仓库不集成云端 CI，本地 pre-push 门禁是**唯一质量屏障**。`git push --no-verify` 跳过门禁视为**破坏契约**，仅限紧急情况且后果自负——`.githooks/pre-push` 头部有显式警告，README「CI 策略」节有同样声明。

**正确姿势**：紧急绕过后，事后必须在 Git Bash / WSL 中补跑 `npm run prepush`，确认 18 项门禁全部通过后再合入；不得把 `--no-verify` 作为常规开发手段。

### 1.3 node_modules 缺失

**现象**：`npm run self-test` 报找不到 `tsx`；`git push` 时 pre-push 提示 `node_modules 缺失`。

**处置**：

- pre-push 检测到 `node_modules` 缺失时以 exit 1 拒绝推送，并提示开发者先运行 `npm install`；它**不自动**安装依赖；
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

**处置**：pre-push 只运行 `.githooks/ensure-platform-deps.sh --check`，检查当前平台原生包；默认/`--check` 均**不自动**下载、`npm pack`、解包或覆盖 `node_modules`。检查失败即中止推送。使用 Bash（Git Bash / WSL）显式执行：

```bash
npm run platform-deps:check
npm run platform-deps:install  # 用户显式调用：受控验证并安装当前平台缺失包
npm install                    # 完整重装/修复仍可由开发者显式执行
```

显式安装支持 Windows x64 / Linux x64；失败只污染随后由 caller `finally` 删除的私有 staging，不覆盖既有非本包目标。同 UID/同访问令牌进程主动 rename 或篡改 staging、repo、lockfile、tarball、`node_modules` 不在该归档输入威胁模型内。

### 1.7 docs-consistency 报动态测量缺失 / provenance 不可信

**现象**：`npm run check:docs-consistency` 退出码 1，提示动态测量缺失或不可信（如「无法读取受控 vitest facts/provenance」「provenance 与当前 HEAD 不一致」），或静态清单计数与实际不符（schema / references / persona / exit-2 脚本数等）。

**原因**：docs-consistency 的 vitest **文件数与用例数是受控动态 facts**——由同次受控运行产出 `generated-results.json` + provenance（commitSha / runId / artifactSha256）绑定实际提交，**不再要求复制到 README / AGENTS / pre-push 等活体文档**（README / AGENTS 对 vitest 的表述为「以当前命令输出为准」）；静态计数类（schema 清单 25 份等）仍从代码事实核验文档声明。动态侧失败通常是 provenance 缺失、hash/commitSha 不匹配或自采集运行不完整（负载敏感瞬时失败），不是文档复制遗漏。

**处置**：动态侧先按 CLI 提示重跑（`npm run prepush` 会先跑 vitest 再以同次 JSON + provenance 调 docs-consistency；手动验证用 `npx vitest run --reporter=json --outputFile=...` + 环境变量 `WM_VITEST_COUNT_FILE` / `WM_VITEST_PROVENANCE_FILE` / `WM_VITEST_PROVENANCE_ROOT` 传入同次受控运行），确认全部用例通过（用例数以当前命令输出为准）且 provenance 指向当前 HEAD 后重跑；若为负载敏感瞬时失败（读取数 < 全量）须隔离重跑，不得把失败 provenance 写成通过。静态侧按 violations 文本同步文档声明（新增 schema 文件须同步 `data-models.md`「Schema 清单」与 README/AGENTS/CONTRIBUTING/INSTALL 的 schema 计数表述）。

### 1.7a pre-push 第 12 项 vitest 抖动（**已通过 `fileParallelism: false` 消除**）

> **状态：已处置（2026-09-12）。** `config/vitest.config.ts` 的 `test` 内已设 `fileParallelism: false`，门禁改为确定性通过。本节保留现象、根因与排除过程，供后续维护者理解**为何不能回退该开关**。

**现象**（出现于设置该开关之前）：`npm run prepush` 第 12 项「vitest 单元测试 + coverage 阈值通过」exit 1，失败数为 1~2 条（极端时可达 20 条），且**每次落在不同文件**；失败形态为 `AssertionError: expected null to be 1`（子进程退出码读到 `null`，即子进程未真正运行）、`Error: STACK_TRACE_ERROR` 或 `Test timed out in 30000ms`。命中的都是 `execSync` / `spawnSync` 启动真实 CLI 子进程的测试文件（`cli-natural-exit` / `gate-report` / `evidence-export-logic` / `evidence-provenance-logic` / `bdd-cli` / `wm-write` / `platform-deps-*` 等 25 个）。

**原因**：**并发资源竞争，非代码缺陷**。同一命令、同一代码两次运行的失败数可相差 10 倍（实测 20 失败 vs 2 失败），失败集合互不相同——若为断言写错则会稳定复现，量级跳动只能归因于子进程并发。已排除：机器负载（`nproc=16`、CPU 11% 时同样复现）、timeout 过小（`--testTimeout=120000` 仍失败）、worker 数过多（`--maxWorkers=4` 仍失败）、本仓库某次改动引入（**基线 `72081e2` 同样复现**）。

**处置**：

1. **现状**：`fileParallelism: false` 已生效，无需人工干预。若仍见失败，先隔离重跑可疑文件（`npx vitest run --config config/vitest.config.ts <file>`，应全绿）再全量重跑。
2. **不得回退该开关**：回退即恢复抖动。代价是带 coverage 的全量约 1090s（并行约 457s 但 exit 1）；如确需提速，正确方向是按"子进程密集"拆分独立 project 并只对其串行，而非全局放开并行。
3. **不得**放宽断言、加重试掩盖或改写 coverage 阈值——抖动是环境暴露的真实现象，掩盖会同时掩盖真失败。
4. 串行化使全量套件墙钟约翻倍，连带两处配套校准（均已随 `fileParallelism: false` 一并实施）：`check-docs-consistency.ts` 的 `VITEST_SPAWN_TIMEOUT_MS` 600s→1800s（standalone 自采集 spawn 的墙钟上限，600s 会把健康仓库误杀成 fail-closed），及 `lib/run-sync.ts` manifest 中两条 runSync 行号锚（随注释扩充 +2 行顺延）。若后续再改 `check-docs-consistency.ts` 前部行数，run-sync.test.ts 会以行级断言报错提示同步 manifest。

详见 `docs/changes/vitest-parallel-flakiness-finding.md`（含七组对照实测记录）。

### 1.7b pre-push 未跑门禁或误放行（stdin ref 判定）

**现象**：`git push` 未输出 `[pre-push]` 门禁日志（但钩子已启用），或提示「本次推送仅删除远端 ref」「无法证明变更范围」。

**原因**：

- pre-push 以 git push 写入 stdin 的 ref 行（每行 `<local ref> <local sha> <remote ref> <remote sha>` 四字段）判定范围，并支持多 ref 聚合；delete-only 推送（local sha 全零）放行跳过；
- 新分支（remote sha 全零）基线按序解析：`git merge-base --fork-point` → 普通 merge-base → remote-tracking 排除集枚举（remote 名经白名单与 `git remote get-url` 验证后执行 `git log -m --name-only --pretty=format: <local_sha> --not --remotes=<remote>`，`-m` 确保合并提交按父逐个列出避免空 diff 漏检）；
- 变更未触及 `w-model-dev/**`、根级 README/AGENTS/CONTRIBUTING/配置、`config/**`、`scripts/**`、`.githooks/**` 或 `docs/*.md`（bash case 模式 `*` 跨 `/`，实测命中 `docs/` 任意层级）时放行；**任一 ref 行解析失败或新分支三级基线全部失败 → fail-closed（运行全部门禁）**，空 stdin 回退 `HEAD@{push}`/`origin/HEAD` 失败同样 fail-closed——不存在「静默跳过门禁」路径（纯 Windows shell 提示放行除外，见 [1.1](#11-windows-非-git-bash-环境执行钩子--门禁报错)）。

**处置**：确认变更确实触及上述路径（含 `docs/changes`、`docs/superpowers` 下 md）；触及却未跑门禁时用 `bash .githooks/pre-push --force` 或 `npm run prepush` 手动补跑全部门禁。

### 1.8 self-test 新增校验项但未加样本

**现象**：修改 `*-logic.ts` 后 `npm run self-test` 失败（样本期望不匹配 / 新逻辑无样本覆盖）。

**处置**：在 `w-model-dev/scripts/samples/` 补充对应通过 / 失败 / 输入错误三态样本，并同步 `__tests__/README.md` coverage matrix（规则：每次修改校验逻辑必须跑通 self-test，新增校验项需同步增加样本）。

### 1.9 `/wm code-health` CLI 失败

**现象**：`code-health-*` CLI 退出 2（`ERROR_JSON`）、退出 1（候选 `blocked`/guard 拒绝），或 `--guard` 无法读取 suite 清单。

**处置**：

- 退出 2：按 `ARG_INVALID` 等 6 类错误排查参数（未知/重复值 flag、缺 `--ledger`/`--matrix`/`--inventory`/`--project`）；不写任何文件，修正后再跑。
- 退出 1（候选校验/`--guard` 拒绝）：走 code-health 失败链 `gate-failure → blocked → R(root-cause) → V(root-cause-review) → G(root-cause-gate) → S(rework) → evidenced`，顺序不可跳过；失败的删除/抽象必须回滚（`git apply -R` + `git diff --exit-code`=0）。
- `--guard` 的 suite argv 来自 tracked repo-owned suite 清单（默认 `.code-health-suite.json`）；本 checkout 无该文件时 `--guard` 无法执行——不得伪造清单或绕过 `code-health-apply.ts`。
- campaign 归档（`code-health-archive.ts`）已实现：verified 候选经 V/G 复审、G 门禁、observed passing 命令证据、可执行 rollback、clean redaction 与 revision 匹配后才 `archivedAsPassed`；`deferred`/`rejected`/`blocked`/`rolled-back` 只作终态非成功证据。验证分两级：`--verify` 不带 `--source-project` **只能是 package-only**（不得表述为 verified source），显式传 `--source-project` 才做 source-bound 重验。Phase 5–8 迁移仍未实现；无 `.codegraph/` 索引时不得伪造 codegraph 查询。

见 [code-health-governance.md](../w-model-dev/references/code-health-governance.md)。

## 2. 环境问题矩阵

| 环境                          | 场景                                                                   | 行为                                                                  | 处置                                                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Windows 原生 cmd / PowerShell | `git push` / `npm run prepush`                                         | pre-push 检测到无 bash 解释器 → 提示 + 放行（exit 0），门禁**未执行** | 改用 Git Bash / WSL 跑门禁（见 [1.1](#11-windows-非-git-bash-环境执行钩子--门禁报错)）                                                           |
| Windows + Git Bash            | `git push` / `npm run prepush`                                         | 正常执行 18 项门禁                                                    | —                                                                                                                                                |
| WSL                           | `git push` / `npm run prepush`                                         | 正常执行；仅检查 Linux 侧原生二进制                                   | 缺失则中止；在 Bash 中显式运行 `npm run platform-deps:check`，或由用户显式运行 `npm run platform-deps:install` 在受控 staging 中校验并安装缺失包 |
| Linux / macOS                 | `git push` / `npm run prepush`                                         | 正常执行                                                              | —                                                                                                                                                |
| 任意                          | `npm audit` 网络不可达（ENOTFOUND / ETIMEDOUT / ECONNREFUSED）         | pre-push 第 13 项 warn 并跳过（不阻断）                               | 网络恢复后手动补跑 `npm audit --audit-level=high`                                                                                                |
| 任意                          | registry 不支持 audit endpoint（ENOTSUP / ENOAUDIT / NOT_IMPLEMENTED） | 同上，跳过不阻断                                                      | 换 registry 后重跑                                                                                                                               |
| 任意                          | `npm audit` 检出 high 以上漏洞                                         | pre-push **阻断**（fail-closed，其余输出一律视为真实漏洞）            | 升级依赖修复后重跑；见 [user-guide.md §6](./user-guide.md) 依赖巡检流程                                                                          |
| 任意                          | `node_modules` 缺失                                                    | pre-push exit 1，提示先运行 `npm install`                             | 开发者手动执行 `npm install` 后重跑；hook 不自动安装                                                                                             |
| 任意                          | 钩子未启用                                                             | push 不触发门禁                                                       | `npm run setup:hooks`（见 [1.5](#15-postinstall-未自动启用钩子)）                                                                                |

## 3. 快速排查路径

| 现象                                             | 可能原因                                          | 处置                                                                                                                                |
| ------------------------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| push 无任何 `[pre-push]` 输出                    | 钩子未启用 / 路径过滤未命中                       | `npm run setup:hooks`；确认变更触及 `docs/*.md`、`w-model-dev/**` 等触发路径                                                        |
| push 提示「纯 Windows cmd/PowerShell」           | 在 cmd/PowerShell 而非 Git Bash 中操作            | 换 Git Bash / WSL（见 [1.1](#11-windows-非-git-bash-环境执行钩子--门禁报错)）                                                       |
| `npm run prepush` 报 `'bash' 不是内部或外部命令` | 无 bash 解释器                                    | 安装 Git for Windows 用 Git Bash 运行                                                                                               |
| `npm run lint:security` 退出 1 / 2               | baseline 指纹失效                                 | 人工确认风险后 `--regenerate`（见 [1.4](#14-eslint-security-baseline-指纹失效--需重生成)）                                          |
| 门禁脚本退出 2（`ERROR_JSON`）                   | 参数 / 文件路径 / JSON 格式问题                   | 按 6 类错误类别排查，见 [user-guide.md §3.3](./user-guide.md)                                                                       |
| `check-docs-consistency` 退出 1                  | 动态 provenance 缺失/不可信或静态计数漂移         | 按 violations 文本同步文档；动态侧重跑 vitest + 同次 provenance（见 [1.7](#17-docs-consistency-报动态测量缺失--provenance-不可信)） |
| 依赖升级后门禁失败                               | 依赖行为变化影响校验逻辑                          | 回到当批起点修正，跑全量回归；勿用 `--no-verify` 绕过（见 [1.2](#12-git-push---no-verify契约声明)）                                 |
| `code-health-*` CLI 退出 1/2                     | 参数错误 / 候选 `blocked` / 缺 tracked suite 清单 | 按 [1.9](#19-wm-code-health-cli-失败) 处置；不得绕过 `code-health-apply.ts`                                                         |

## 4. 相关文档

- [用户指南（校验失败排查 / 规则依据 / 依赖巡检）](./user-guide.md)
- [README（CI 策略 / 快速上手）](../README.md)
- [安装指南](./INSTALL.md)
