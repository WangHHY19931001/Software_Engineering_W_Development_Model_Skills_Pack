# Task 5 报告：batch staged snapshot materialization

## 范围

- 基线 HEAD：`51da8305`。
- 本轮只涉及任务 5 允许写集中的 `.githooks/pre-commit`、`pre-commit-hook.test.ts` 与本报告；不修改 RootCauseReport、platform/docs 测试或聚合计划文件。
- Hook 仍只读取 Git index：保留 mode/object/path 解析、路径/父目录/symlink 防护、普通临时文件安装、Prettier snapshot cwd/config/ignore、staged TypeScript、bounded/progress 与 EXIT/INT/TERM cleanup。

## 性能根因与 batch 修复

- 旧的逐 blob 读取路径在 batch-only fixture 上 RED：旧实现调用 `git cat-file blob <oid>`，fixture 明确拒绝该协议，第一条记录返回 exit `91`；hook 退出非零并完成临时目录清理。
- 新实现只把 NUL 分隔的 index 记录流用于 mode/object/path 解析；blob 内容单独通过一个持续的 `git cat-file --batch` 二进制流读取，绝不混合 NUL 路径流和 blob 内容流。
- 对每个 blob，hook 校验 header 的 object、type=`blob` 和十进制 size，以 size 精确读取字节、消费空 delimiter，并在 missing、非 blob、畸形 header、短流/缺 delimiter、长度不符或 batch 进程异常时 fail-closed。
- `200` blob batch-only fixture 成功完成 snapshot materialization，实测 `11.06s`；回归阈值为 `<20s`，仍显著低于 hook 的 `45s` snapshot 阶段上限。

## 已有 focused 证据

- 既有逐项 pre-commit focused：`13/13` 通过（每次 `1 passed | 12 skipped (13)`，exit `0`）。覆盖 staged/worktree 分离、repo-local Prettier/tsc、index 不变、外部 sentinel、staged config/ignore、超时 cleanup、parent/nested symlink、absolute 与 traversal。
- 本轮 200 blob fixture先 RED（exit `91`），再由 batch 协议完成行为路径；初始 `<10s` 断言因 Windows/WSL fixture 文件系统实测 `11.06s` 而失败，阈值已收敛为 `<20s`，并未提高 hook 的任何运行时上限。

## 未验证项（不得表述为通过）

- `pre-commit-hook.test.ts` 整文件在最后一次启动后没有取得 Vitest 最终汇总，因此不记录为整文件通过。
- `platform-deps-hook.test.ts` 未运行。
- `docs-consistency-logic.test.ts` 未运行。
- platform/docs/聚合验证仍 pending。
- 首次正常 commit 在 Git for Windows coreutils 将 `count=128B` 拒绝为非法数字时 fail-closed；hook 清理成功、无新 SHA。实现已改为该环境支持的 `iflag=count_bytes` 精确字节模式，尚待下一次正常 commit 验证。

## 本轮提交前核验

- `bash -n .githooks/pre-commit`：待本轮提交前重新执行并记录。
- `git diff --check`：待本轮提交前重新执行并记录。
- 目标工作树根的 `.pre-commit-snapshot.*` 与 `.pre-commit-blobs.*`：待本轮提交前精确核验。

## 第六轮性能收敛

- 逐条 `dd`、`wc` 和 per-object bounded worker 是真实 Git Bash 仓库在约 100 条/30 秒后停滞的剩余性能瓶颈。hook 已改为一个 Node helper 驱动一个 `bash -c 'git cat-file --batch'` 子进程；不再为每个 blob 启动外部读取/计数进程。
- helper 将 NUL 分隔的 index-record 文件与 cat-file 的二进制 payload 分开消费。它逐条验证 mode/object/stage/path、batch header object/type/size、精确 payload、单字节 delimiter、missing/non-blob/短流和安全整数 size；每个 payload 先以 `wx` 写入普通 staging 文件，确认类型/长度后才 rename 到经 parent/symlink 防护的 snapshot 目标。
- 最初显示的 `1.55s`/`1.57s` 不是有效性能证据：heredoc 被 `run_bounded` 消耗，Node helper 没有执行，200 个 Markdown fixture 因没有 Prettier/TypeScript 目标而未暴露空 snapshot。该假绿已撤销，未作为验收依据。
- helper 已改为 Bash 函数内 heredoc，再整体交给 `run_bounded` 执行。随后用一个真实 snapshot 文件边界用例加 batch-only 200 blob fixture 验证：`2 passed | 12 skipped (14)`，exit `0`，tests `4.97s`。200 blob 用例仍断言 `<20s`、新阶段日志 `批量物化 index snapshot`、batch-only fake 拒绝旧 `git cat-file blob` 协议，以及 hook 临时目录 cleanup；未删减安全或性能断言。
- 仍未验证：整文件 `pre-commit-hook.test.ts`、`platform-deps-hook.test.ts`、`docs-consistency-logic.test.ts` 与 platform/docs 聚合；不得表述为通过。
