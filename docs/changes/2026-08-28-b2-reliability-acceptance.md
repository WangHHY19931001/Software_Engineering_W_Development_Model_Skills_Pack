# 批次 2 可靠性红灯清零验收记录（3dim 优化）

> **Implementation reviewed HEAD:** `f79a0ca7ccd66af1ae52a81a3a313ca761a18614`（batch2-3dim worktree `.worktrees/b2-3dim`）
> 本记录的 commit 身份链与门禁矩阵证据均针对上述 implementation reviewed HEAD。
> **Parent baseline:** `6768688`（`docs(agents): close batch-1 handoff, prep batch-2 ...`，main）。
> 本记录只收录本批次实际执行的命令与结果；未执行的命令不作通过声明。

## 变更范围（Task 2.0–2.3）

- `w-model-dev/scripts/__tests__/eval-runner.test.ts`：两个 `execSync` 自检调用补显式 `timeout: 15000`（有界子进程调用，与既有 coverage-logic 15s 先例一致）。
- `w-model-dev/scripts/lib/run-sync.ts`：`SYNC_PROCESS_EXCEPTIONS` 集中异常清单追加 `__tests__/eval-runner.test.ts` L10/L19 两条 `execSync` 条目（`status:'present'`，行号与 TS AST 扫描严格一致）。
- `w-model-dev/scripts/__tests__/docs-consistency-logic.test.ts`：D4 修复轮1 真实执行探针加 per-test `timeout: 90_000`（vitest 位置参数，不动全局 testTimeout，同行尾注说明原因；1 行改动、零行号偏移）。
- `w-model-dev/scripts/__tests__/state-write-logic.test.ts` / `w-model-dev/scripts/__tests__/wm-write.test.ts`：锁获取墙钟预算 `20ms/1000ms → 5000ms`（与既有 `--lock-timeout 5000` 安全预算一致），断言全部原样保留；专门验证 LOCK_TIMEOUT 语义的短预算测试（0/1ms/25ms）未动。
- 未改：`package.json` 版本（保持 41.19.0）、docs 文案、`platform-deps-hook.test.ts`、run-sync.test.ts、eval/ 资产。

## 红灯盘点与根因分析（Task 2.0，预测 vs 实测）

计划预期清单（F3/F4）：`platform-deps-hook.test.ts` 26 失败（退出码 127，F3：PATH 首位 WSL bash 优先于 Git Bash）+ `docs-consistency-logic.test.ts` 2 失败（F4：L2572-2574 bash 裸调用 `execFile('bash', ['.githooks/pre-push', '--force'])`）。

实测（全量 `npm test` 盘点）与预测分歧，按设计 §3.2 以真实红灯为准：

- **F3 未复现**：本轮 Git Bash 显式解析正常（pre-push 经 `bash .githooks/pre-push` 全绿），`platform-deps-hook.test.ts` 无 127 失败。F3 为历史根因，本轮环境未触发，无需修复。
- **F4 未复现**：`docs-consistency-logic.test.ts` L2572-2574 pre-push 探针全量多次通过；该文件唯一真实失败是下述负载敏感 flake，与 bash 无关。
- **真实红灯 A（确定性）— run-sync 集中异常清单漏登**：批次 1 引入 eval 评估资产时，`eval-runner.test.ts` 两个 `execSync` 直调未登记 `SYNC_PROCESS_EXCEPTIONS`。run-sync 审计测试失败（`__tests__/eval-runner.test.ts:10 execSync must be reviewed`），并连带 `check:docs-consistency` 动态门禁 fail-closed（vitest 事实包 1240/1241 不可采信）——docs-consistency 的动态违规是同一根因的下游症状，非独立缺陷。
- **真实红灯 B（负载敏感 flake）— 真实执行探针墙钟预算不足**：`docs-consistency-logic.test.ts`「D4 修复轮1」在 30s testTimeout 刀锋边缘（单独跑约 18s，全量并行负载下可超 30s）；同文件 `state-write-logic.test.ts` / `wm-write.test.ts` 锁并发测试的 20ms/1000ms 预算在 16 worker 全量并行 + 数十真实子进程探针的极限负载下偶发耗尽，返回 LOCK_TIMEOUT/STALE_LOCK 而非期望结果。证据：三条失败测试隔离跑多次全绿、失败测试每次运行各不相同（broken-owner / serializes-writers / readback rollback 轮换中招）、`acquireLock` 为原子 `mkdir` + token + transition 轮询锁（无并发缺陷）。判定为评估机容量问题，非技能代码缺陷。

## 修复方式

- **Task 2.1（红灯 A）**：补显式 `timeout: 15000` + 登记 2 条 `status:'present'` 异常清单条目。杜绝 `'missing-followup'`（会命中「manifest 无未决 timeout follow-up」另一条审计测试）。效果：run-sync 审计 18/18。
- **Task 2.2（EBUSY 条件修复）— N/A**：按 TDD 多次全量运行均未出现 EBUSY（`platform-deps-hook.test.ts` 在 Git Bash 显式解析下全绿），按设计 §3.2 证据基准标记 N/A，不实施条件修复。
- **Task 2.3（红灯 B）**：D4 加 per-test 90s 预算（消除 CPU 饥饿源，不全局抬高掩盖问题）；锁并发测试墙钟预算 20/1000→5000（断言不变）。残余偶发 flake 见 Deferred concern 1。

## 门禁矩阵真实执行记录

| 命令 | 结果 | 备注 |
|---|---|---|
| `npm test`（全量 vitest） | exit 0，59 文件 / 1241 passed | 各门禁串行执行，避免自造负载污染结果 |
| `npm run self-test` | exit 0，260/260 | |
| `npm run typecheck` | exit 0 | `tsc -p config/tsconfig.json` |
| `npm run lint:security` | exit 0，无新增安全风险 | |
| `npm run check:docs-consistency` | exit 0，静态 0 / 动态 0，`"passed":true` | 最终干净运行；过程中一次因负载 flake 报动态违规 1（复跑即绿，见 Deferred 1） |
| `npm run check:gate -- --validate-templates` | exit 0，`GATE_JSON {"passed":true,"exitCode":0}` | |
| `npx tsx w-model-dev/scripts/cli/check-samples-coverage.ts` | exit 0，280 fixtures / `unregistered=0` | |
| `npm run prepush` | exit 0，17 项门禁全绿 | 含 vitest+coverage 阈值、npm audit、prettier、tsc |
| Persona CLI smoke ×4 | 4/4 exit 0 | `persona-{code-reviewer,test-engineer,security-auditor,performance-auditor}.json` |
| `npm run eval` | 25/25 通过 | 批次 1 评估基线锚点未回归 |

## commit 身份链（worktree batch2-3dim，基于 main 6768688）

| commit | 说明 |
|---|---|
| `522099a` | `fix(scripts): register eval-runner execSync calls in run-sync exception manifest (batch-2 reliability red light)` |
| `f79a0ca` | `fix(tests): harden load-sensitive reliability probes (D4 per-test 90s timeout; wm-write lock budgets 20/1000 to 5000, assertions unchanged)` |
| （本记录提交） | `docs(changes): batch-2 reliability acceptance record (all gates green)` |

## 证据与 provenance 级别

- Implementation reviewed HEAD `f79a0ca`；门禁矩阵、prepush 与 eval 均在该 HEAD 实测。
- package-only provenance / source-bound provenance：未生成、未验证（本批次不改 `.w-model/` 证据协议）。
- `.githooks/pre-push --force` 以控制台方式执行并通过，未实际 `git push`。

## Deferred concerns

1. **残余负载敏感 flake（非确定性红灯）**：本机在 16 worker 全量并行 + 数十真实子进程探针 + 外部进程竞争的最重负载下，全量 vitest 仍可能偶发单条超时/锁预算耗尽（本批次验收过程中出现 1 次 `check:docs-consistency` 动态违规 1，重跑即绿；此前 Task 2.3 开发期复跑也印证该规律）。隔离运行始终全绿、失败测试随机不固定 → 环境容量问题。已通过预算加固显著降低频率；若受控 CI 上仍偶发，建议把 docs-consistency 真实执行探针降载或隔离 worker。此处如实记录，不作「零偶发」声明。
2. **run-sync 审计 ENOENT 竞态观察**：`dependency-boundaries.test.ts` 向真实 `scripts/logic/` 写入瞬态 `.d2-boundary-fixture-<pid>.ts` 并在 finally 删除，与 run-sync 审计目录遍历存在 list/read 竞态（Task 2.3 期间观察到 1 次，未复现）。批次 3 可评估改为临时目录方案。
3. **版本号待办**：批次 2 未改版本（package.json 41.19.0）；批次 3 易用性大重构统一升至 42.0.0 时处理。
4. **AGENTS.md §0 交接节**：批次 2 合并后，由批次 3 接手时按前次模式更新本节（关闭批次 2、预备批次 3）。
