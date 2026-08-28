# Archive Extraction Trust-Boundary Security Report

## Delivery Scope

- Worktree: `D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/w-model-reliability`
- Starting HEAD: `20ab06d2c3cb48b62a1dac3b721b652267fd8770` (SSoT trust-boundary definition already committed)
- Delivery subject: `fix(security): align archive extraction with trust boundary`
- Tracked delivery files: this report, `w-model-dev/scripts/lib/platform-deps-tar.ts`, `w-model-dev/scripts/cli/platform-deps-install.ts`, and `w-model-dev/scripts/__tests__/platform-deps-install.test.ts`.
- Implementation commit SHA: `657f2e971b1b334fe3de51401691ce5a80aaec9e`（`fix(security): align archive extraction with trust boundary`；由 follow-up 提交 `docs(security): bind extraction evidence` 绑定——Git 提交无法在自身内容中如实包含自己的对象 ID）。

## Threat Model（对齐 SSoT `docs/skill-design-document_SSoT.md`，commit `20ab06d`）

**不可信输入**：tarball bytes 与全部 tar metadata——UStar header、PAX `x`/`g` records、GNU `L`/`K` records——以及由此派生的 entry path、`linkname`/`linkpath`、entry type。恶意 archive 可在上述任一维度携带攻击载荷。

**受信主体（caller-owned）**：调用者以 `mkdtemp` 创建并独占的私有 staging 生命周期——verification 临时目录、install staging、`npm pack` 临时目录——均在 success/failure 的 `finally` 中整体删除；以及 repo install target（`node_modules/<name>`）的正常 namespace 生命周期。

**边界外（明确不承诺）**：同 UID / 同 Windows 访问令牌进程对 staging、repo root、lockfile、tarball 或 `node_modules` 的主动 rename、替换或篡改。该主体本就能直接修改这些对象；需要抵御它时必须另设不同安全主体或 OS sandbox，而不是叠加 Node path 检查。本实现不声明「任意 rename 下绝不发生词法 root 外写入」。

## Extraction Hardening（不可信输入防御）

`extractArchive()`（`platform-deps-tar.ts`）在任何 extraction write 前完成整包解析与 canonical preflight：

- 拒绝 absolute/drive-qualified 路径、traversal、dot/empty segment、NUL bytes（复用 `isUnsafeArchivePath`）。
- 拒绝 symlink、hardlink 与一切 `linkname`/`linkpath`（任何携带链接信息的条目），拒绝不支持的 tar entry type。
- 拒绝重复 canonical path（win32 上 case-folded），拒绝 file ancestor/descendant 冲突（含非相邻祖先），拒绝与 staging 内既有目标的任何冲突（写入前 `lstat` preflight）。
- extraction root 必须是已存在、非符号链接的目录（即 caller-owned 私有 staging）。
- 普通文件以独占创建（`wx`）写入，不覆盖任何既有条目；目录按单一 validated component 逐层创建，directory mode 在内容写入后统一应用。
- 自包含 Node 标准库实现：无网络、无 shell、无 LLM 调用。

## Install Commit Path（受信生命周期内的防御）

- 提交到 `node_modules` 前的验证门：lockfile SRI、registry allowlist、package name/version 身份一致性、隔离 `loadModule`（入口逃逸声明被忽略，降级为制品校验）。
- 受控提交：install staging 建在 repo 根同卷保证 rename 原子；既有 `node_modules/<name>` 若不是同一 lockfile 包身份则 `install-conflict` 失败、绝不覆盖；同身份则备份旧目录后换入，最终移动失败时还原备份——本轮改进：还原本身失败时保留备份并聚合报告两个错误（`platform-deps-install.ts`）。
- errorCode 分诊：提取阶段失败为 `extract-failed`，staging 提交/备份还原阶段失败为 `install-commit-failed`（本轮新增），目标冲突为 `install-conflict`；ERROR_JSON 按阶段区分，不再把提交失败误导为提取失败。
- 不覆盖既有包；失败仅污染本次私有 staging（由 caller 的 `finally` 整体删除）或在提交失败后遗留备份（还原失败时 `<target>.wm-backup-*` 保留在 `node_modules` 内等待人工处理）。

## Platform Availability

- 显式 `npm run platform-deps:install` 在 Windows x64 与 Linux x64 均恢复可用（`ensure-platform-deps.sh --install` → 当前 checkout 的本地 tsx CLI），单一受控 staging 代码路径。
- pre-push 与 `ensure-platform-deps.sh --check` 保持只读：无网络下载、无 `npm pack`、无解包、无 `node_modules` 覆盖；安装仅在用户显式调用 `platform-deps:install` 时发生。

## Evolution Attribution（历史轮次）

- `97b405e` harden archive extraction boundary — 初始提取加固。
- `a3e52af` / `4d9f916` / `ecf42f4` / `b469705` close archive race boundary — 递进的 descriptor-relative POSIX 提取、ownership 追踪与 rollback containment 加固。
- `5cf5c9e` bind archive race evidence — 证据报告绑定。
- `20ab06d` define archive extraction trust boundary — SSoT 威胁模型重定义：staging 生命周期受信、同 UID 主动篡改划出边界。
- 本轮：以重定义后的边界对齐实现——提取器简化为受控 staging 提取（移除 POSIX-only descriptor seam 及其 ownership/rollback 机制），恢复 Windows/Linux 显式安装，聚合备份还原失败错误。

## Current Verification Evidence

以下为当前工作树（HEAD `20ab06d2c3cb48b62a1dac3b721b652267fd8770` + 三个实现文件修改）的实测结果：

| Command                                                                                                                                                                                                                                                                                                                                                  | Actual result                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc`                                                                                                                                                                                                                                                                                                                                                | Passed, exit 0.                                                                                                                                                                                                        |
| `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-install.test.ts`                                                                                                                                                                                                                                            | Passed: 57/57.                                                                                                                                                                                                         |
| `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-install.test.ts w-model-dev/scripts/__tests__/platform-deps-repair-core.test.ts w-model-dev/scripts/__tests__/evidence-export-logic.test.ts w-model-dev/scripts/__tests__/evidence-provenance-logic.test.ts w-model-dev/scripts/__tests__/run-sync.test.ts` | Passed: 5 files, 158/158.                                                                                                                                                                                              |
| `npm run lint:security`                                                                                                                                                                                                                                                                                                                                  | Passed: baseline 410, baseline hits 410, new findings 0.                                                                                                                                                               |
| `npm run check:docs-consistency`                                                                                                                                                                                                                                                                                                                         | Passed, exit 0 (1236 tests).                                                                                                                                                                                           |
| `npx prettier --config config/prettier.config.cjs --write` / `--check` on the four delivery files                                                                                                                                                                                                                                                        | Passed: write then check, all matched files use Prettier code style.                                                                                                                                                   |
| `git diff --check`                                                                                                                                                                                                                                                                                                                                       | Passed.                                                                                                                                                                                                                |
| Sequential `npm run prepush`（本轮实测）                                                                                                                                                                                                                                                                                                                 | Passed all 17 gates: platform deps check, self-test, gate probes, security-scan, BDD/coverage/exemption/signature-chain probes, full Vitest with coverage, npm audit, docs-consistency, samples matrix, Prettier, tsc. |

## Residual Limits

- 同 UID / 同访问令牌主体的主动篡改按 SSoT 设计属于边界外；`lstat` preflight 与独占创建不是对该主体的 TOCTOU 保证。
- race-boundary 轮次的 descriptor/ownership/rollback 机制随 descriptor seam 一并移除；其防御目标（同 UID rename 竞态）已由 SSoT 划为边界外，受信 caller 生命周期取代之。
- `npm pack` 生产网络路径仅在用户显式安装时执行；离线测试通过 `--tarball` 注入覆盖 CLI 契约，不覆盖 registry 网络 I/O。
- CodeGraph 在本 worktree 不可用（无 `.codegraph/` 索引）；实现与调用路径经仓库源码检索与测试验证。
- 忽略项 `.w-model` / `coverage` / `.zcode` 输出不属于本交付。
