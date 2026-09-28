# Wave 2 收口记录 · spawn 成本削减（2026-09-29）

> 规格与计划：`docs/superpowers/specs/2026-09-28-test-gate-optimization-design.md` §4 / `docs/superpowers/plans/2026-09-28-test-gate-optimization.md` Task 4-10。
> 本记录为 Task 9 Step 5 收口产物：进程内化清单、留守原因、墙钟实测与 Task 10 判定。

## 一、墙钟实测（19/19 全绿，PREPUSH_EXIT=0）

| 口径 | Wave 1 基线 | Wave 2 收口（本次） | 变化 |
| --- | --- | --- | --- |
| prepush 总耗时 | 2144s | **1262s** | **-882s（-41%）** |
| 第 12 项 vitest 全量（含 coverage） | 2047s | **1191s** | **-856s（-42%）** |
| vitest 用例数 | 2617 | 2631（全过） | +14（冒烟 11 + runMain 守卫 2 + wrapper 守护 1，净新增保真面） |

- 收口运行：`PREPUSH_KEEP_VITEST_JSON=…wave2-vitest.json npm run prepush`（逐项耗时见 `wave2-prepush.log`；逐文件耗时见 `wave2-vitest.json`）。
- 失败尝试存档：attempt 1 死于第 6 项 security-scan（转换面 16 项新增发现，`wave2-prepush.attempt1-failed.log`）；attempt 2 死于第 12 项 vitest（60 例 / 4 根因，详见下文修复轮记录）。

## 二、进程内化清单（Task 4-9）

**npx 残留清理（Task 4）**：7 处 `execSync('npx tsx …')` → `runSync(process.execPath, [tsxCli, …])`（coverage-logic×3、eval-runner×2、check-codegraph-queries×1、check-coding-plan×1），台账锚点同步，超时/退出码语义保留。

**守卫与调用层（Task 5/6）**：`lib/run-main.ts` VITEST 自执行守卫 + `runSync`/直连 spawn 剥离 VITEST 继承（守卫前提经对照实验证伪后由控制者裁定补剥离）；`__tests__/helpers/cli-invoker.ts` 进程内调用层（console 三通道 + process 流捕获 + exitCode undefined→0 自然退出映射）；`cli-subprocess-smoke.test.ts` 集中冒烟文件。

**试点（Task 6/7）**：wm-status、check-verifier-output，含进程内 vs 真实子进程逐字节保真对照（对照职责后续移交冒烟）。

**推广（Task 9，3 批组）**：metrics-report、gate-ticket-content、check-coding-plan、check-codegraph-queries、code-health-duplicates、review-package-cli、code-health-cli（+ wm-status/verifier-logic 试点对照移交）。9 个 CLI main 签名化（`export async function main(argv)` + wrapper 三态收敛 HandledCliError / DuplicateFlagError→ARG_INVALID / UNEXPECTED）。

## 三、SUBPROCESS_TEST_FILES 收缩

47 → **43**（基线 45 + 冒烟 + run-sync 登记，移除 4 项零真实 spawn 文件：metrics-report / gate-ticket-content / verifier-logic / wm-status）。注释计数已改自描述（成员名单 = 常量；`vitest-project-split.test.ts` 双向守护）。

## 四、留守与排除面（不转的理由）

- **转换但留守串行清单（5）**：check-coding-plan、check-codegraph-queries、code-health-cli、code-health-duplicates、review-package-cli——仍含 git fixture 真实 spawn（runSync），非 tsx CLI 冷启动。
- **排除面（6，未触碰）**：docs-consistency-logic（CLI 自采集 vitest）、platform-deps-hook / pre-commit-hook（测 bash/git 外部进程本体）、code-health-tests（guard 真实 pre/post suite）、gate-report、run-sync（自身是被测 spawn 层）。
- 48 条 exit-2 探针未触碰。

## 五、收口过程修复轮记录

| 轮 | 提交 | 内容 |
| --- | --- | --- |
| fix 1 | 7923b553 | check-artifact-gate wrapper 补 DuplicateFlagError→ARG_INVALID 分支 + 类别级守护用例（审查发现，复审通过） |
| 收口前置 | c6e58515 | attempt 1 security-scan 16 项新增发现清零（import/order×10 重排 + mkdtemp 夹具 detect-non-literal×6 附理由豁免） |
| fix 2 | 8bdf494d | attempt 2 回归修复：README 矩阵登记 cli-subprocess-smoke（实仓 docs-consistency 恢复 exit 0）；VITEST 剥离三站点（exit2-failure-atomicity / code-health-gap / evidence-provenance-logic，childProcessEnv）；run-sync 台账两条失效锚目摘除（复审三发现全 ADDRESSED） |

## 六、Task 10 判定

启用判据（计划 Task 9 Step 4）：vitest 全量墙钟 >12 min → 执行 Task 10（serial 池分组并行）。实测 **1191s ≈ 19.9 min > 12 min → 执行**。
