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

## 第六轮提交前核验（历史记录）

- `bash -n .githooks/pre-commit`：通过。
- `git diff --check`：通过。
- 目标工作树根的 `.pre-commit-snapshot.*` 与 `.pre-commit-blobs.*`：第六轮提交前无残留。

## 第六轮性能收敛

- 逐条 `dd`、`wc` 和 per-object bounded worker 是真实 Git Bash 仓库在约 100 条/30 秒后停滞的剩余性能瓶颈。hook 已改为一个 Node helper 驱动一个 `bash -c 'git cat-file --batch'` 子进程；不再为每个 blob 启动外部读取/计数进程。
- helper 将 NUL 分隔的 index-record 文件与 cat-file 的二进制 payload 分开消费。它逐条验证 mode/object/stage/path、batch header object/type/size、精确 payload、单字节 delimiter、missing/non-blob/短流和安全整数 size；每个 payload 先以 `wx` 写入普通 staging 文件，确认类型/长度后才 rename 到经 parent/symlink 防护的 snapshot 目标。
- 最初显示的 `1.55s`/`1.57s` 不是有效性能证据：heredoc 被 `run_bounded` 消耗，Node helper 没有执行，200 个 Markdown fixture 因没有 Prettier/TypeScript 目标而未暴露空 snapshot。该假绿已撤销，未作为验收依据。
- helper 已改为 Bash 函数内 heredoc，再整体交给 `run_bounded` 执行。随后用一个真实 snapshot 文件边界用例加 batch-only 200 blob fixture 验证：`2 passed | 12 skipped (14)`，exit `0`，tests `4.97s`。200 blob 用例仍断言 `<20s`、新阶段日志 `批量物化 index snapshot`、batch-only fake 拒绝旧 `git cat-file blob` 协议，以及 hook 临时目录 cleanup；未删减安全或性能断言。
- 仍未验证：整文件 `pre-commit-hook.test.ts`、`platform-deps-hook.test.ts`、`docs-consistency-logic.test.ts` 与 platform/docs 聚合；不得表述为通过。

## 第七轮 S-fix：timeout 进程树与 batch 异常回归

- 根因：第六轮 `run_bounded` 超时只向顶层 `$!` PID 发送信号；Node helper 启动的 `bash -c 'git cat-file --batch'` 及其后代可能在顶层退出后继续持有 snapshot/blob 目录，造成 cleanup 竞态或残留。
- 修复：`terminate_child` 先用当前 Git Bash/WSL 可用的真实 `ps -eo pid=,ppid=` 与 `awk` 递归枚举指定顶层 PID 的后代，预先收集完整树；向所有后代和顶层依次发送 TERM，轮询等待 2 秒，未退出者再发送 KILL 并继续轮询，最后 `wait` 顶层子进程。无法使用进程树枚举工具时 fail-closed 并将 cleanup 标记为失败，不退回只杀顶层 PID。EXIT/INT/TERM 均仍汇入 cleanup，cleanup 在删除 snapshot/blob 前再次处理 active child，并保留 bounded cleanup。
- snapshot timeout 默认仍为 `45s`；仅接受 `1–45` 的 `PRE_COMMIT_SNAPSHOT_TIMEOUT_SECONDS`，Node helper 与 Bash bounded 上限使用同一值，测试用 `2s` 直接验证超时而未放宽生产上限。Node helper 的单一 `cat-file --batch`、精确 header/payload/delimiter 读取和 staged-only/path/symlink/snapshot 语义保持不变。
- batch 异常 focused 命令：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/pre-commit-hook.test.ts -t "fails closed for a batch"`；exit `0`，`7 passed | 15 skipped (22)`，Vitest duration `10.70s`（tests `10.50s`）。覆盖 missing、non-blob、malformed header、short header、short payload、missing delimiter 和 bad delimiter；每项均断言非零、index/worktree/sentinel 不变及临时目录清理。草稿首次结果为 exit `1`（6 passed/1 failed），原因是 missing delimiter 的 EOF 实际落入短流分支；断言已按该真实分支修正后重跑通过。
- timeout tree focused 命令：`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/pre-commit-hook.test.ts -t "terminates the batch helper process tree"`；exit `0`，`1 passed | 21 skipped (22)`，Vitest duration `3.94s`（tests `3.73s`）。fixture 让 batch worker 持续运行，hook 在 `2s` 超时；断言命令自然返回 `124`、输出进程树终止日志、记录的 batch PID 已不可存活、index/worktree 不变且 snapshot/blob 无残留。
- 本轮 `bash -n .githooks/pre-commit`：exit `0`；报告更新后的 `git diff --check`：exit `0`（仅有 Git 的 LF→CRLF 提示，无 whitespace error）。最终精确临时目录/后台进程核验随后执行。
- 未验证项保持 pending：`pre-commit-hook.test.ts` 整文件、`platform-deps-hook.test.ts`、`docs-consistency-logic.test.ts` 及 platform/docs 聚合；本轮不运行这些 suite。

## 第八轮 S-fix：整文件终态否定第七轮结论，按真实根因重修

### 第七轮结论被整文件运行否定

`npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/pre-commit-hook.test.ts` 在 `5ce21cd7` 上：**5 failed | 17 passed（22），exit 1，耗时 109.14s**。第七轮“进程树超时已修复”只覆盖 `-t` 过滤子集，未取得整文件终态，在 Git Bash 上并不成立。失败清单：

1. `passes when staged JSON is formatted and the worktree copy is not`
2. `uses a repository-local tsc with the staged snapshot config and not npm discovery`
3. `uses the staged Prettier config instead of a polluted worktree config`
4. `uses the staged Prettier ignore file instead of a polluted worktree ignore file`
5. `terminates the batch helper process tree on snapshot timeout and reclaims its temp dirs`（61,233ms）

### 根因 1：`ps -o` 在 Git Bash 不可用，进程树枚举静默返回空

- 证据：Git Bash（MSYS procps）执行 `ps -eo pid=,ppid=` 输出 `ps: unknown option -- o`，`ps -eo pid=,ppid= | wc -l` = `0`。
- 旧实现只用 `command -v ps` 作守卫，`ps` 存在即通过；`collect_descendant_pids` 因此得到空集合，`terminate_child` 只向顶层包装子 shell 发 TERM，Node helper 及其 `git cat-file --batch` 后代被孤儿化（实测 ppid 变为 `1`）并继续持有管道。
- 观测后果：spawnSync 等管道 EOF 直到 61s；`rmdir` 报 `EBUSY`；`/tmp` 残留 6 个 `wm pre提交 (hook)-*` fixture 根及其中的 `.pre-commit-snapshot.*`。
- 修复：新增 `ensure_process_table`，先探测 `ps -eo pid=,ppid=` 能否列出自身 PID，不可用再退到 Git Bash 支持的 `ps -ef`（列 2=PID、3=PPID，同样以“能否列出自身 PID”判定）；两者都不可用时 fail-closed（warn + 标记 cleanup 失败 + 只终止顶层），不再把空表当成“没有后代”。`collect_descendant_pids` 改为单次进程表快照内求后代闭包，避免逐层重复调用 `ps`。`pid_is_running` 的 zombie 判定只在已探测格式下读取 `stat`。
- 修复后同一用例 `3,385ms`、exit `0`，stderr 含 `终止进程树：批量物化 index snapshot`，记录的 batch PID 已不可存活，index/worktree/sentinel 未变，临时目录清空。

### 根因 2：hook 内部混用两种路径形态

- 证据：`git rev-parse --show-toplevel` 在 Git for Windows 返回 `C:/Users/.../Temp/wm pre提交 (hook)-X`，而 hook 其余路径来自 `mktemp`/`$PWD` 为 `/tmp/...`；同一快照目录以 `C:/...` 形态传给 `--config`，`$PWD` 记录为 `/tmp/...`，4 个断言失败于同一条路径的两种写法。
- 修复：新增 `normalize_bash_path`，读取仓库根后把盘符/反斜杠形态经 `cygpath -a -u`（WSL 用 `wslpath -a -u`）归一到当前 Bash 的 POSIX 形态，无转换工具时保持原样。hook 内 cwd、`--config`、`--ignore-path`、`-p` 与 node 参数由此统一形态。断言未放宽，仍要求 config/ignore 位于 snapshot 根内。

### 根因 3（纵深防御）：Node helper 只依赖 hook 侧终止

- 修复：helper 注册 SIGTERM/SIGINT/SIGHUP 处理，先 `terminateBatchChild()`（destroy stdin → SIGTERM → 500ms 后升级 SIGKILL）再以 143/130/129 退出；新增 `budgetMs + 5s` 预算 watchdog，在 hook 侧终止失效时收回 batch 子进程。watchdog 刻意晚于 hook 阶段超时，保证超时语义仍由 hook 归因为 `124`。`finally` 改为 `clearTimeout(watchdog)` + `terminateBatchChild()`。

### 本轮终态（三个 focused 文件均取得退出码与汇总）

| 命令 | 结果 |
| --- | --- |
| `pre-commit-hook.test.ts` | `1 passed (1)`，22 用例全过，exit `0`，`41.92s`（修复前 5 failed / 109.14s） |
| `platform-deps-hook.test.ts` | `87 passed (87)`，exit `0`，`167.19s` |
| `docs-consistency-logic.test.ts` | `190 passed (190)`，exit `0`，`409.52s` |
| `bash -n .githooks/pre-commit` | exit `0` |

- M1 的 batch 协议负向回归 7 项（missing / non-blob / malformed header / short header / short payload / missing delimiter / bad delimiter）全部通过，每项断言非零退出、index/worktree/sentinel 不变、临时目录清空。
- 200 blob batch-only fixture 通过（`<20s` 阈值与 batch-only 拒绝旧 `git cat-file blob` 协议断言保留）。
- 残留核验：无 `cat-file`/`sleep`/node 孤儿进程；仓库内无 `.pre-commit-snapshot.*`、`.pre-commit-blobs.*`；`/tmp` 无 `wm pre提交 (hook)-*` 残留。

### 剩余已知限制（不得表述为通过）

- 若目标平台的 `ps` 既不支持 `-o` 也无法用 `ps -ef` 列出自身 PID，`terminate_child` 走 fail-closed 分支：只终止顶层进程、`cleanup_failed=1` 并非零退出，但**无法收回已孤儿化的后代**。该平台能力缺失会显式暴露为失败，而不是静默放行。
- platform/docs 聚合、全量 Vitest 与 pre-push 仍 pending，留待任务 8 收口。

## 第九轮：独立 V 复审（第二轮）与机制订正

- 复审范围 `5ce21cd7..fd387daa`，结论 **CLEAN**，记录见
  `.superpowers/sdd/2026-09-16-review-remediation/task-5-rework-review-2.md`。
- 复审独立复现三个 focused 终态（`pre-commit-hook` 22 passed / `platform-deps-hook` 87 passed /
  `docs-consistency-logic` 190 passed，均 exit 0）与 `bash -n` exit 0，并以**反证**证明测试未被放宽：
  把旧 hook blob（`6289d75e…` = `5ce21cd7:.githooks/pre-commit`）取出到仓库外的 fixture 后运行**新**测试文件
  → `6 failed | 16 passed (22)`，同时复现了 18 分钟存活的孤儿 `bash -c git cat-file --batch`（ppid=1）与 EBUSY；
  测试 diff 仅 3 行等价替换、无新增 skip/only、未触碰 200-blob `<20s` 阈值与 45s / 1–45 生产预算。
- **机制订正（重要：本报告第八轮的表述言过其实）**：复审用隔离实验证明，MSYS `ps -ef` 把 node 经
  `spawn('bash', ['-c', 'git cat-file --batch'])` 起的子进程报成 **PPID=1**，因此枚举闭包实际只有 `[node]`；
  `git cat-file` 的回收**来自 node 死亡后 Windows/libuv 的作业对象语义**（只杀枚举出的 node 子进程 →
  batch 在 <2s 内消失；只杀顶层包装进程 → batch 永远存活）。同理 Node helper 的
  SIGTERM/SIGINT/SIGHUP 处理器在该平台上是**死代码**（MSYS `kill -TERM` 打原生 node 绕过 JS handler），
  且 500ms SIGKILL 升级被 unref 定时器 + 立即 `process.exit` 抵消。正确表述是：
  **修复对 Git Bash 有效，但机制是「枚举 + 终止 node，由其 OS 回收子进程」，不是「逐个终止每个后代」**；
  该平台事实已写入 `.githooks/pre-commit` 注释，避免后续读者按第八轮文字误判覆盖范围。
- 复审另指出 `git diff --check 5ce21cd7 fd387daa` 因已提交报告尾随空行 exit 2 → 已修（`957aa1fc`）。
- 复审无法裁决项：真实 `git commit`（1075 文件快照、Prettier 与 tsc 通过、cleanup 通过）那一次运行的
  **独立复现**——复现需产生真实提交，故记为已观测事实（原始输出见提交信息），不作为独立证据。

