# 最终全量回归 stale-lock 修复报告

## 范围

- 工作树：`D:/w_skill_opt/Software_Engineering_W_Development_Model_Skills_Pack/.worktrees/w-model-reliability`
- 基线 HEAD：`bc568ccd04a642fb32865bc53739c005c6f7f461`
- 修改文件：`w-model-dev/scripts/__tests__/wm-write.test.ts`
- 未修改：`progress.md`、`.w-model/` 及生产锁逻辑。

## 根因与复现时间线

`wm-write` 生产逻辑按安全语义使用 owner metadata 中的 `pid` 参与 stale 判定：TTL 到期但 PID 仍被 `process.kill(pid, 0)` 视为存在时，显式 recovery 必须拒绝 takeover，并返回 `LOCK_TIMEOUT`。原测试 fixture 以 500ms timer 让 holder 退出，但在首个 CLI 返回后直接启动第二个 CLI；没有等待 holder 的 `close` IPC 事件，也没有在 holder 已退出后将测试 owner metadata 变为确定的非存活 PID。

在 full-suite 的子进程 churn 下，holder PID 可能在 holder 退出后被其他进程复用。于是第二次 CLI 读取同一 stale metadata 时看到 PID 仍“存活”，返回 exit 1；这不是生产锁安全语义错误，而是测试中固定时间窗口和 PID 检查之间的竞态。

独立诊断脚本 5/5 次记录到：

- holder `ready` 后，首 CLI 约 705–812ms 返回；
- holder 500ms timer 已退出，owner metadata 仍保留；
- 首 CLI `exit=1`，summary 为 `STALE_LOCK`；
- 观测到 holder `exitCode=0` / `process.kill(pid, 0)` 为 `ESRCH`；
- 第二 CLI `--recover-stale-lock` 5/5 次 `exit=0`，正常写入。

诊断同时保留了 holder PID、owner metadata、stdout、stderr 和 target 是否存在，确认问题是时序敏感而非固定 500ms 必然失败。

## TDD 红绿证据

1. 首先加入对“holder 已完成 close 后 owner metadata 必须被测试显式标记为确定 stale”的断言，但尚未加入 stale 标记 helper。定向运行：

   ```text
   npm test -- --run w-model-dev/scripts/__tests__/wm-write.test.ts -t "atomically rejects" --reporter=verbose
   ```

   真实结果：exit 1；失败为 `expected 16068 to be 999999999`（holder 的真实 PID 与预期 sentinel 不同）。这证明新回归约束确实能抓住 fixture 未完成 stale 状态握手的问题。

2. 绿色修复仅改测试 fixture：
   - `holdLiveLock` 在等待 `ready` 前建立并保存 `close` Promise；
   - `waitForExit` 只等待该 close Promise 并断言 exit code 为 0，而不依赖固定 sleep 或易变的 `child.exitCode`；
   - 首次拒绝后先等待 holder close，再由 `markOwnerStaleAfterExit` 把保留的 owner metadata PID 改为 `999_999_999`，最后执行显式 recovery。

   生产 `state-write-logic.ts` / CLI 未改动，仍保持 active PID 的 fail-closed 保护。

3. 绿色定向结果：

   ```text
   npm test -- --run w-model-dev/scripts/__tests__/wm-write.test.ts -t "atomically rejects" --reporter=verbose
   exit 0
   Test Files 1 passed (1)
   Tests 1 passed | 24 skipped (25)
   ```

   随后完整 `wm-write.test.ts`：`1 passed`、`25 passed`；`wm-write` 与 `state-write-logic` 合并测试在先前一次运行中为 `2 passed`、`70 passed`。跨进程 mtime 回归额外重复 3 次，均为 `1 passed`、目标测试 `1 passed`。

## 验证结果

- `npm run typecheck`：exit 0，`tsc -p config/tsconfig.json` 无错误。
- `npx prettier --config config/prettier.config.cjs --check w-model-dev/scripts/__tests__/wm-write.test.ts`：exit 0，格式通过。
- `git diff --check`：exit 0。
- 最终执行一次有界全量命令：

  ```text
  npm test -- --reporter=dot
  ```

  真实结果：exit 1，`57 passed` / `58` test files，`1221 passed` / `1222` tests。唯一失败为既有、与本修复无关的：

  ```text
  w-model-dev/scripts/__tests__/run-sync.test.ts
  runSync > audits every direct synchronous child-process call against the centralized exception manifest
  AssertionError: expected 35 to be 36
  ```

  失败发生在 `run-sync.test.ts:385`，当前修复文件的 stale-lock 测试未失败。此前在本次 fixture 修复前已真实运行两次全量，均为 `58 passed` / `1222 passed`；修复后按要求只执行了一次有界全量，未继续无界重跑。

## 疑虑与边界

- 最终全量整体仍受 `run-sync` manifest/count 失败阻断，不能宣称 `58/58` 或 `1222/1222`；本报告保留真实失败结果。
- 本修复刻意不放宽生产 stale-lock 的 PID 判定，也不通过增加固定等待时间掩盖竞态。
- `999_999_999` 仅是测试 fixture 的确定非存活 sentinel，并且只在 holder `close` 已确认后写入；owner metadata 仍被保留以验证 recovery 审计路径。
- 本报告和测试变更不涉及 `progress.md` 或 `.w-model/`。
