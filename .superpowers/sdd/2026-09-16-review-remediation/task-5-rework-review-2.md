# Task 5 返工审查（第二轮，独立 V）

## Verdict

**CLEAN**

审查范围：`5ce21cd7..fd387daa`（提交 `fd387daa128ff5dd1578e94723e9b031331483d6`），改动文件仅 3 个（`git show --name-status fd387daa`）：`.githooks/pre-commit`、`w-model-dev/scripts/__tests__/pre-commit-hook.test.ts`、本目录的 `task-5-report.md`。

本轮未修改任何代码、测试、审查包，未提交。所有命令均为只读或写入仓外临时目录（`/tmp/vcheck-*`，已清理）。上一轮的两项阻断（I1 进程树终止缺陷、I2 无终态）本轮均已闭合，且我拿到了可归属到本提交的终态证据（见下）。

**一条重要前提**：本工作树在我审查期间被另一 agent 并发修改（见「剩余风险 R1」），因此与本次审查无关的两个 auxiliary suite 的结果只能作参考，不能作冻结态结论。被测提交的两个文件在工作树中未被并发修改，故主证据有效。

## 本轮独立复现的终态（我亲自执行，退出码与汇总均为实测）

| # | 命令（cwd = 工作树根） | 实测结果 |
|---|---|---|
| 1 | `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/pre-commit-hook.test.ts` | `Test Files 1 passed (1)`，`Tests 22 passed (22)`，`VITEST_EXIT=0`，Duration `49.67s`（tests 49.45s）。**单独运行**（09:46:10–09:47:00，早于并发改动 10:01 起） |
| 2 | 同文件 **对旧 hook** 运行（见下「测试完整性」构造的仓外 fake root，旧 hook blob 校验为 `6289d75e950a6fed2d99876c94a3a2e934b26895` = `5ce21cd7:.githooks/pre-commit`） | `Test Files 1 failed (1)`，`Tests 6 failed \| 16 passed (22)`，`OLDHOOK_EXIT=1`，Duration `289.92s`。新超时用例失败于 `expected 70930 to be less than 10000`（70.9s），随后 `EBUSY: resource busy or locked, rmdir '...\wm pre提交 (hook)-Gf2IXq'` |
| 3 | 旧 hook 运行遗留的孤儿证据 | `ps -ef`：`wangh 41587 1 ? 09:56:17 bash -c git cat-file --batch`（**ppid=1，存活 18 分钟**），并有子进程 `54977`；`/tmp/wm pre提交 (hook)-Gf2IXq` 于 09:57 残留。新 hook 运行（#1）无任何孤儿与残留 |
| 4 | `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/platform-deps-hook.test.ts` | 单独重跑：`Tests 87 passed (87)`，`PLATFORM_SOLO_EXIT=0`，`191.51s`。（首次与另外两个 vitest 并发跑得 `2 failed \| 85 passed`，失败均为 30s `Test timed out`，是仓库 `config/vitest.config.ts:8-20` 明确记录的「多个启动子进程的测试文件并行互抢」假失败；串行后消失） |
| 5 | `npx vitest run --config config/vitest.config.ts w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts` | 单独重跑：`Tests 190 passed (190)`，`DOCS_SOLO_EXIT=0`，`455.00s`。**但该次运行期间工作树正被另一 agent 改造**（见 R1），故仅作参考 |
| 6 | `bash -n .githooks/pre-commit` | `bash_n_exit=0` |
| 7 | `git diff --check 5ce21cd7 fd387daa` | **exit 2**，输出 `.superpowers/.../task-5-report.md:99: new blank line at EOF.`（见 M1；`.githooks/pre-commit` 本身无 whitespace 问题） |
| 8 | `git diff --stat` / `git diff -U0 -- <test>` | 测试文件仅 3 行删除（全部是等价替换，见「测试完整性」）；hook 17 行删除 |

## Findings

### BLOCKER

无。

### IMPORTANT

#### I1. 后代闭包在 Git Bash 上**枚举不到** batch 子进程；端到端结果正确，但机制与报告声明不一致，且该依赖未被声明

- 代码事实：`collect_descendant_pids`（`.githooks/pre-commit:81-120`）只用进程表里的 `ppid → pid` 链从 root 求闭包（awk 闭包 `.githooks/pre-commit:99-118`）。
- 实测反例（复刻 hook 精确结构：`"$@" &` 子 shell → `node` → `spawn('bash',['-c','git cat-file --batch'])`）：
  - wrapper=34354，`ensure_process_table` → `format=ef`，闭包 = `[34356]`（**只有 node**）；
  - batch 进程（`"C:\Program Files\Git\mingw64\bin\git.exe" cat-file --batch`，pid 34357）在 MSYS `ps -ef` 中 **PPID = 1**，因此不在闭包内、不会被 `kill -TERM` 直接命中。
- 之所以端到端仍然正确：**杀掉 node 就会带走 batch 子进程**。隔离实验（`kill` 只发给枚举到的 node 子进程、wrapper 保持存活）显示 batch 在 2s 内消失；反向实验（只杀顶层 wrapper、node 存活）显示 batch **持续存活**（即旧 hook 的行为）。因此回收来自 node 死亡时 Windows/libuv 的作业对象语义，而非来自「枚举到 batch 并 TERM 它」。
- 影响与判定：本平台（Git Bash/WSL/Linux）目标终态可达成，且新测试断言的是终态（`kill -0 <batchPid>` 必须失败），所以未来该平台语义退化会被测试抓红——这是我不判 BLOCKER 的理由。但报告「枚举后代闭包并向所有后代发送 TERM」的机制描述在 Git Bash 上并不成立，这条平台耦合没有被写进已声明限制。建议：在 hook 注释/报告里把该依赖写明（native node 派生的孙进程在 MSYS `ps` 中为 `ppid=1`，实际回收依赖 node 先死），并考虑把测试断言从「batch pid 已死」补一条「闭包至少含 node 子进程」，以免将来只剩偶然通过。

### MINOR

#### M1. `git diff --check` 不为 0，报告「exit 0」的声明不可复现

- 实测 `git diff --check 5ce21cd7 fd387daa` → exit `2`，唯一输出是 `task-5-report.md:99: new blank line at EOF.`（报告文件末尾确为 `\n\n`，`tail -c` 取证）。hook 与测试文件本身干净。属流程/卫生问题，不影响功能。

#### M2. Node helper 的信号处理在目标平台上是死代码；KILL 升级永远不会触发

- 实测：`node -e 'process.on("SIGTERM", ()=>{写文件}); setTimeout(...)'` 被 MSYS `kill -TERM` 后进程直接消失，**处理函数未运行**（探针文件未生成）。即 `.githooks/pre-commit:507-515` 的 SIGTERM/SIGINT/SIGHUP 处理器在 Git Bash 上不生效，`finally`（`:635-638`）在强杀路径同样不执行。
- `.githooks/pre-commit:499-504` 的 500ms SIGKILL 升级计时器被 `unref()`，而调用方（信号处理 `:508-511`、watchdog `:523-527`）在其后立即 `process.exit(...)`，因此该升级路径在两个调用点都不可能跑到。
- 实际回收仍由 hook 侧杀 node + 平台语义保证（见 I1），故不阻断。

#### M3. 测试中的无操作三元表达式

- `w-model-dev/scripts/__tests__/pre-commit-hook.test.ts:360`：`options.batchResponse ?? (options.batchOnly ? 'happy' : 'happy')` 两侧同值，等价于 `?? 'happy'`。无行为影响，建议清理。

#### M4. 进程表探测只覆盖两种命令形态，BusyBox 等平台会被不必要地 fail-closed

- `ensure_process_table`（`.githooks/pre-commit:64-79`）只尝试 `ps -eo pid=,ppid=` 与 `ps -ef`。BusyBox 的 `ps -o pid,ppid`（带表头、无 `=`）本可用，但不会被探测到，从而落到「只杀顶层 + cleanup_failed」的 fail-closed 分支。属可改进项，与已声明限制同类。

#### M5.（观察，非本提交缺陷）仓库根遗留临时探针文件

- `/tmp` 下存在 4 个 01:03–01:05 的 fixture 根（含完整 `.git`/`node_modules` 目录树，`wm-pre-commit-*`），早于本提交的最后落盘时间，非本提交测试所留：我对新 hook 的整文件运行后仓库根无 `.pre-commit-*`、无 fixture 残留、无孤儿进程（09:49 与 10:13 两次核验一致）。仅作记录。

## 测试完整性（第 4 项，逐条核验）

- **删除行清单**：`git diff -U0 5ce21cd7 fd387daa -- <test 文件>` 只有 3 行 `-`，全部是等价替换：
  1. `options: { batchOnly?: boolean } = {}` → 扩展为含新选项的对象（原字段保留）；
  2. fake git 的 `*'cat-file --batch'*)` 单行 happy path → 多分支 `case`（happy 行为逐字保留：`printf '%s blob %s\n'` + payload + `\n`）；
  3. `return runHook(fixture.root, fixture.index, { bashEnv });` → 透传新选项（默认值仍为 `happy`）。
- **断言无弱化**：无 `.only`/`fit`/`fdescribe`（grep 为空）；两处 `context.skip`（`:494`、`:513`）在 `5ce21cd7` 的同一位置已存在（旧文件第 455/474 行），是条件式 symlink 跳过，非本轮引入。
- **阈值未放宽**：timeout 用例 `12_000`（`:573`，旧 534 行同值）、200 blob 回归 `20_000`（`:767`，旧 644 行同值）均未改；新增的 `10_000`（`:660`）是新增用例的新断言。
- **新测试确实对旧 hook 失败**（我实际跑的，不是推理）：把**旧 hook**（blob 校验一致）与新测试放入仓外 fake root（`node_modules` 用目录 junction，已用 `rd` 安全移除，仓库 `node_modules` 367 项完好）后运行 → `6 failed | 16 passed (22)`，exit `1`。其中新用例「terminates the batch helper process tree…」失败于 70.9s（>10s 断言），并触发 `EBUSY` 与 18 分钟存活孤儿 `bash -c git cat-file --batch`（ppid=1）——与上一轮报告的原始故障现象逐项吻合。
- **新增负向覆盖是真实分支**：7 项 batch 协议负向（missing/non-blob/malformed-header/short-header/short-payload/missing-delimiter/bad-delimiter）在我的整文件运行中全绿；`missing-delimiter` 断言的是「短流」分支（`:602`），与实现 `:555`/`:580` 的真实分支一致。

## 必查项核查

| 核查项 | 结论 | 证据 / 残余 |
|---|---|---|
| 1. 枚举修复是否生效、空列表失败模式是否消失 | 部分成立：格式探测确实可失败（fail-closed 已实证）；但闭包在 Git Bash 上漏掉 node 的批处理孙进程 | `.githooks/pre-commit:64-79`（以「能否列出自身 PID」判据，实测 `ps -eo pid=,ppid=` 在本机输出 `ps: unknown option -- o` 且 0 行 → 退到 `ef`）；屏蔽 `ps` 后 `ensure_process_table` 返回 1、`terminate_child` 返回 1、`process_tree_cleanup_failed=1`、只杀顶层（实测）。**但**闭包 = `[node]`，batch 为 `ppid=1` 不可达 → I1 |
| 2. awk 闭包正确性（终止/深层/root/环） | 通过 | 单快照 + `emitted` 守卫，每轮至少 emit 一个 pid，迭代次数 ≤ 进程数 → 必然终止；实测深度 3 树全部枚举（root 34280 → 闭包 `34282 34283 34284`，含孙进程）；root 仅当表中 `ppid==pid`（自环）时才被输出，无实际影响；环形表因 `emitted` 不会无限循环 |
| 3. 路径归一（Linux/WSL no-op、UNC/盘符相对路径/反斜杠） | 通过 | `.githooks/pre-commit:263-278`：仅当 `*\\*` 或 `[A-Za-z]:/*` 且存在 cygpath/wslpath 时才转换，否则原样输出。实测 6 例：`C:/Users/wangh/repo→/c/Users/wangh/repo`、`D:\w_skill\repo→/d/w_skill/repo`、`/home/user/repo` 与 `/c/Users/...` 不变、`//server/share/repo` 不变、`C:relative` 不变。hook 内其余路径均由归一后的 `repo_root` 派生（`:294-295,371-372,681-684,705-707`），未见其他混用形态 |
| 4. Node helper watchdog 是否严格晚于 hook 阶段超时；信号处理与 finally | 时序通过；信号路径在 Git Bash 无效（M2） | `.githooks/pre-commit:523-528` watchdog = `budgetMs + 5_000`，而 `budgetSeconds` 与 hook 的 `snapshot_timeout_seconds` 同源同值（`:34-43`、`:424-425`，node 侧再夹取 `1–45`），且 hook 侧 `SECONDS` 整数秒判定最多晚 1s 触发 → 5s 余量足够，124 语义不被 watchdog 抢走（实测该用例 `status=124`、用时 3.69s）。`finally`（`:635-638`）覆盖正常返回与抛错；强杀路径不执行（M2） |
| 5. 测试完整性（是否弱化/删除/skip；新测试是否真对旧 hook 失败） | 通过 | 见上一节；删 3 行均为等价替换；无 skip/only 新增；`20_000`/`12_000` 未动；旧 hook 上新测试 `6 failed | 16 passed`，exit 1 |
| 6. 声明的残留限制是否真的标记失败（不静默放行） | 通过 | `.githooks/pre-commit:128-134` fail-closed 分支：warn + `process_tree_cleanup_failed=1` + 只 TERM 顶层 + `return 1`；`cleanup`（`:233`）把它转成 `cleanup_failed=1` → `exit_code=1` → `exit 1`（不再返回 124，该语义偏移已记录）。实测（屏蔽 `ps`）：`rc=1`、`process_tree_cleanup_failed=1`、顶层被杀。对本地 pre-commit 钩子可接受，不构成 blocker |

## 独立验证 vs 采信

**我独立验证（有退出码/原始输出）**：上表 #1–#8 全部命令与其结果；闭包终止性与深度 3 枚举；`normalize_bash_path` 6 例；fail-closed 分支返回值与标志；node 被 MSYS `kill -TERM` 时处理函数不执行；旧 hook 孤儿进程与 `EBUSY` 残留；阈值/预算的旧新对照（`git show` 逐行）；提交文件范围（`git show --name-status`）。

**我采信实现者（未独立复现，且不据此下结论）**：
- 「真实 `git commit` 经 hook：1075 文件快照物化、Prettier 通过、tsc 通过、清理通过」——我没有做真实提交（会产生 commit，属禁用操作）。
- 「`5ce21cd7` 上整文件为 5 failed / 109.14s」——我未检出旧树跑旧测试；我用的是「新测试 × 旧 hook」，得到 6 failed/16 passed，结论方向一致但数字不可直接对齐。
- 性能类数字（我实测 pre-commit-hook 49.67s vs 报告 41.92s；platform 191.51s vs 167.19s；docs 455.00s vs 409.52s）——同一量级，环境差异可解释。

## 剩余风险与放行条件

- **R1（流程，非提交缺陷）并发写入**：审查期间另一 agent 正在同一工作树改 `w-model-dev/scripts/cli/check-docs-consistency.ts`（10:02:13）、`check-samples-coverage.ts`（10:04:55）、`NEGATIVE-COVERAGE.md`（10:07:18）、`check-samples-coverage.test.ts`（10:11:08），并新增 `w-model-dev/scripts/lib/exit2-probe-registry.ts`（10:01:49）。因此：`docs-consistency-logic.test.ts` 的 190 passed 与 `platform-deps-hook.test.ts` 的 87 passed 只能证明「该工作树当时是绿的」，**不能作为 `fd387daa` 冻结态的终态**。二者都不测试本提交改动的文件，对放行结论无实质影响；若要冻结态证据，须在无并发写入的窗口重跑。
- **R2**：I1 的平台耦合需落到文字（hook 注释与报告），并建议把测试断言从「batch 已死」补强为「闭包至少枚举到 node 子进程」，以免终态断言将来靠平台语义偶然通过。
- **R3**：M1 的尾部空行使 `git diff --check` 为 2；建议在收口提交里清掉该报告文件的尾空行，否则 pre-push 相关检查若含 `git diff --check` 会失败。
- **R4**：M4 的 BusyBox 场景仍为 fail-closed；对本地 pre-commit 钩子可接受，若未来要在容器内使用需扩展探测形态。
- **放行结论**：本提交可放行。I1/M2/M3/M4 属「声明与加固」类后续项，不改变本轮 CLEAN 判定；R1 需在收口（任务 8）时以无并发窗口重跑三个 focused suite 以取得冻结态终态。
