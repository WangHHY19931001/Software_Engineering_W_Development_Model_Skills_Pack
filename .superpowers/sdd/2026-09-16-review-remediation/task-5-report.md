# Task 5 第 1 轮返工操作报告：pre-commit staged-only 与跨平台执行

## 范围与 RED 证据

本轮只修改任务 5 写集：`.githooks/pre-commit`、三个相关测试文件和本报告；`config/vitest.config.ts` 已有的三个 subprocess 登记保持不变。工作树中预先存在的 `docs/superpowers/plans/2026-09-16-review-remediation.md` 未修改、未纳入本任务提交。

最小 RED 先行结果：初始 `pre-commit-hook.test.ts` 为 5 个测试、4 个失败。失败实际暴露了 index hash 被旧 hook 改写、旧的 `git archive`/重定向在 staged symlink 上失败，以及工作树 Prettier config/ignore 污染会被错误读取；JSON staged-only 正向用例通过。随后按这些失败逐项收敛实现。

## 已落地修复

- hook 不再使用 `git archive`、`git write-tree` 或 `git show > snapshot_path`。它遍历 `git ls-files --stage -z`，对每个 index blob 先写入 `mktemp` 创建的普通临时文件，再以 `mv --` 放入受控 snapshot；`120000` symlink 条目也只作为普通文件内容物化。父目录逐组件创建并拒绝 snapshot 内 link/非目录，临时目录均位于仓库根的 `.pre-commit-*` 前缀下。
- hook 不再用工作树 cwd 的 `npx --no-install prettier --version` 做 preflight；优先使用绝对的 `node_modules/.bin/prettier`，否则使用 `node_modules/prettier/bin/prettier.cjs`。实际 Prettier 检查仍从 snapshot cwd 执行，显式使用 snapshot 内 `config/prettier.config.cjs` 和 `.prettierignore`（缺失 ignore 时创建 snapshot 内空文件）；TypeScript 的 `npm run typecheck` 也在 snapshot cwd 执行。
- hook 保存并恢复 `GIT_INDEX_FILE` 环境变量、保留原退出码；不调用 `git add`/`git reset`，不覆盖工作树。临时 blob/snapshot 清理含有限重试，清理失败会改变退出码并输出可观察警告。
- 测试覆盖 staged 合法/worktree 非法通过、staged 非法/worktree 合法失败、运行前后 index SHA-256 相同、`git show :path` 内容一致、工作树内容不变、snapshot/blob 临时目录清理，以及真实 staged 外部 symlink 不得触碰 sentinel。不能创建或被 Git 保留为 mode `120000` 时使用带原因的显式 `context.skip`。
- 测试 runner 使用数组和 shell quoting；根据 `wslpath`、`cygpath` 或兼容格式选择 Bash 路径，显式 `cd` 到 Bash cwd，nested `bash -c` 参数不依赖外层 `$input`/`$BASH_ENV` 展开，并显式关闭 stdin。后续定位确认 Windows `spawn` 必须保留宿主原生 PATH，Bash 内部 PATH 单独通过显式 `export` 设置，并保留 Bash 启动时的运行时 PATH（含 `/usr/bin`）；docs runner 的 pre-push 也固定 cwd、显式 EOF，fixture 清理对 `EBUSY`/`EPERM`/`ENOTEMPTY` 有限重试。

## 本轮实际命令与结果

| 命令 | 实际结果 |
|---|---|
| `npx --no-install prettier --write --config config/prettier.config.cjs w-model-dev/scripts/__tests__/pre-commit-hook.test.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` | 退出 0；按仓库配置复核三个相关文件；npm 输出 `Unknown user config "home"` 警告 |
| `npm run --silent typecheck` | 本轮最终退出 0，无 stdout/stderr 输出 |
| `npx --no-install vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/pre-commit-hook.test.ts` | PASS：最终 `Test Files 1 passed (1)`、`Tests 7 passed (7)`、`Duration 9.98s`；第 7 项验证不调用 npx preflight；同样有 npm `home` 配置警告 |
| `npx --no-install prettier --check --config config/prettier.config.cjs config/vitest.config.ts w-model-dev/scripts/__tests__/pre-commit-hook.test.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` | 退出 0；输出 `All matched files use Prettier code style!`，另有 npm `home` 配置警告 |
| `git diff --check` | 退出 0；仅报告报告文件和三个测试文件下次写回时的 LF→CRLF 警告 |
| `npx --no-install vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts` | 完整 focused 在共享 runner 修复前超过 60 秒无终态，按上限发送 Ctrl-C，exit 1 且无汇总；最终 runner 修复后未重跑完整 87 项，不能记为通过 |
| `npx --no-install vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts -t "executes only a read-only platform check"` | 修复后 PASS：1 passed、86 skipped，exit 0，Duration 0.77s；证明 host PATH/Bash 环境分离的最小回归 |
| `npx --no-install vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts -t "ensure-platform-deps supply-chain boundary"` | 首次 runner 性能修复后真实失败：11 项中 10 项 exit 127，Duration 11.33s；补回 Bash runtime PATH 后 PASS：11/11，exit 0，Duration 11.10s |
| `npx --no-install vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts -t "pre-push dependency boundary and trigger paths"` | PASS：14/14，exit 0，Duration 11.15s |
| `npx --no-install vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts -t "pre-push stdin ref scope filtering"` | PASS：26/26，exit 0，Duration 20.59s |
| `npx --no-install vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` | 启动后 60 秒内无终态，仅有 Vitest 启动头；随后按有界策略/用户中断停止，退出 1，无测试汇总，不能记为通过 |
| 用户指定三文件 focused 命令 | 未运行；platform/docs 已有未终态记录，本轮不再重复启动，无三文件最终退出码，不宣称全绿 |
| 全量 `npm test` | 未运行 |

## 平台与未解决项

验证主机是 Windows Node，`bash` 通过 WSL 兼容层提供；本轮 runner 使用运行时 `wslpath`/`cygpath` 探测和安全引用，特殊 fixture 根实际包含空格、中文和括号。没有独立 Git Bash、MSYS、MINGW 实机验证，不能宣称这些平台已通过。

platform 完整 focused 的一次实际运行在 60 秒内只输出 Vitest 启动头，随后按上限 Ctrl-C 返回 1；此后已通过最小单例、ensure 分组、pre-push 分组和 stdin 分组，分别得到 1/1、11/11、14/14、26/26，但尚未重跑完整 87 项，不能宣称 87/87。docs focused 没有本轮终态，不能把中断解释为产品 bug。已修复并保留可定位的 runner 风险（外层变量展开、host-native/Bash PATH 分离、cwd/路径传递、stdin EOF、Windows 清理重试及 npx preflight），但这不能替代 platform/docs 的完整证据，也未弱化原有断言。

## 本轮中止时 Git 状态

- 已存在 HEAD：`97b157a1 fix: validate staged content across hook platforms`；这是此前提交，不代表本轮 S-fix 的全部修复已提交。
- 当前允许写集中的 `.githooks/pre-commit`、本报告、`pre-commit-hook.test.ts`、`docs-consistency-logic.test.ts` 仍有已暂存修改；`platform-deps-hook.test.ts` 另有本轮 runner 修复尚未暂存。
- 未执行 reset/checkout/clean，未删除报告或其它用户文件；最近核对根目录没有 `.pre-commit-snapshot.*` / `.pre-commit-blobs.*` 临时目录。
- 本轮未取得新的实现 commit SHA；完整 platform、docs、三文件聚合、typecheck/Prettier/diff-check 的 S-fix 后复核及正常提交均保持未完成。

## 本轮临时目录清理

只读核对确认以下目录均位于当前工作树根、名称严格匹配任务 5 临时前缀，随后已删除：

- `.pre-commit-snapshot.npfnnx`
- `.pre-commit-blobs.YAdmqX`

未删除其它目录或文件。
