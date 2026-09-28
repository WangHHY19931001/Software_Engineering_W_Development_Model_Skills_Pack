# Wave 1 基线报告 —— 测试/门禁优化（2026-09-28）

全量 `npm run prepush` 基线：**19/19 门禁全绿，总耗时 2144s，vitest 项 2047s，2617/2617 用例通过**。
背景：规格基线 B10 记录历史全量墙钟 1962s；本次为修复 platform-deps-hook 正则回归（首轮全量因此失败）后的重跑，回归修复细节见 SDD 账本。耗时上升的主要构成为 cli-serial 项目（子进程类文件串行）逐例耗时之和 ≈ 2005s（见 ②）。

运行产物（同目录）：

- `prepush-baseline.log` —— 全量门禁运行日志（PREPUSH_EXIT=0）
- `baseline-vitest.json` —— vitest 逐例 JSON（jest 兼容格式，numTotalTests=2617）

---

## ① prepush 逐项耗时表

| # | 门禁项 | 耗时 |
|---|---|---|
| 1 | self-test 全部样本匹配期望 | 2s |
| 2 | check:verifier 无参数退出 2 | 1s |
| 3 | check:gate 不存在目录退出 2 | 2s |
| 4 | check:verifier 有效样本退出 0 | 1s |
| 5 | check:verifier 无效样本退出 1 | 1s |
| 6 | security-scan 无新增风险 | 11s |
| 7 | check-bdd-model 有效 BDD 样本退出 0 | 1s |
| 8 | check-bdd-model schema 不合规 BDD 样本退出 2 | 1s |
| 9 | check:coverage 有效覆盖样本退出 0 | 1s |
| 10 | check:exemption 有效豁免样本退出 0 | 1s |
| 11 | check-signature-chain 有效签名链样本退出 0 | 1s |
| 12 | **vitest 单元测试 + coverage 阈值通过** | **2047s** |
| 13 | 规则层覆盖口径 (logic+lib) 达阈值 | 2s |
| 14 | npm audit 依赖漏洞扫描（high 以上阻断） | （日志未单独计时） |
| 15 | docs-consistency 活体文档一致 | 15s |
| 16 | samples 覆盖矩阵一致（无未登记 fixture） | 22s |
| 17 | prettier 格式一致性（--check） | 11s |
| 18 | tsc 类型检查 0 错误 | 8s |
| 19 | eval 语料断言与覆盖矩阵全绿 | 1s |
| — | **总耗时** | **2144s** |

口径核对：17 个计时项合计 82s + vitest 2047s = 2129s，与总耗时 2144s 差 15s（未计时的 npm audit + 平台依赖检查 + 门禁框架开销）。

**vitest 全量墙钟 ≈ 2062s**（= 总耗时 2144s − 其余计时项之和 82s；该口径含上述未计时开销）。两个独立口径交叉印证：log 中 vitest 项自报 2047s；②中逐例 duration 求和 2062s（2061571ms）。

---

## ② vitest 逐文件耗时 top30

口径：`baseline-vitest.json` 无 `perfStats` 字段（0/106），全部 106 个文件走 `assertionResults[].duration` 求和兜底。106 文件 = cli-serial 45 + unit-parallel 61（SUBPROCESS_TEST_FILES 名单 45 项，`config/vitest.config.ts`；注：该文件头注释「41 个」为陈旧描述）。耗时列 = 逐例 duration 之和；项目归属按 SUBPROCESS 名单判定。

汇总：cli-serial 逐例求和 2005347ms（2005s，占 97.3%）/ 45 文件；unit-parallel 56224ms（56s）/ 61 文件；合计 2061571ms（2062s）。

```
files=106 fallback_files=106
sum_cli-serial=2005347ms over 45 files
sum_unit-parallel=56224ms over 61 files
sum_all=2061571ms
  466537ms  210t cli-serial    docs-consistency-logic.test.ts
  374094ms   87t cli-serial    platform-deps-hook.test.ts
   78989ms   41t cli-serial    evidence-export-logic.test.ts
   71607ms   28t cli-serial    code-health-cli.test.ts
   70501ms   22t cli-serial    pre-commit-hook.test.ts
   65901ms   32t cli-serial    code-health-task1-integration.test.ts
   65864ms   47t cli-serial    exit2-failure-atomicity.test.ts
   59712ms   28t cli-serial    code-health-tests.test.ts
   56718ms   51t cli-serial    gate-report.test.ts
   56275ms   20t cli-serial    check-coding-plan.test.ts
   56155ms   19t cli-serial    review-package-cli.test.ts
   54715ms    7t cli-serial    code-health-e2e.test.ts
   48552ms   23t cli-serial    check-samples-coverage.test.ts
   37206ms   34t cli-serial    check-codegraph-queries.test.ts
   35501ms   27t cli-serial    wm-write.test.ts
   34902ms   44t cli-serial    gate-ticket-content.test.ts
   33497ms   27t cli-serial    bdd-cli.test.ts
   32282ms   22t cli-serial    check-archive-integrity-cli.test.ts
   31823ms   26t cli-serial    wm-append-runlog-cli.test.ts
   25962ms    9t cli-serial    cli-natural-exit.test.ts
   21566ms   60t cli-serial    platform-deps-install.test.ts
   20559ms   28t cli-serial    code-health-duplicates.test.ts
   19702ms   46t cli-serial    verifier-logic.test.ts
   17324ms   15t cli-serial    check-pollution-cli.test.ts
   17096ms   14t cli-serial    cli-arg-unification.test.ts
   16967ms   16t cli-serial    metrics-report.test.ts
   14477ms   13t cli-serial    wm-status.test.ts
   13107ms   27t cli-serial    evidence-provenance-logic.test.ts
   11547ms   19t unit-parallel run-sync.test.ts
   11393ms   46t cli-serial    change-scope.test.ts
```

要点：top30 全部为 cli-serial（除 run-sync 一文件）；前两名（docs-consistency-logic 466.5s + platform-deps-hook 374.1s）合计 840.6s，单独占 vitest 墙钟约 41%。

---

## ③ spawn 密度 top20

口径：`w-model-dev/scripts/__tests__/*.test.ts` 中含 `runSync( / spawnSync( / execSync( / execFileSync(` 调用的**源码行数**（Select-String 匹配行计数，非调用总次数）。

```
file                            spawns
----                            ------
gate-report.test.ts                 48
docs-consistency-logic.test.ts       9
run-sync.test.ts                     8
pre-commit-hook.test.ts              7
code-health-cli.test.ts              6
code-health-tests.test.ts            5
maturity-logic.test.ts               5
coverage-logic.test.ts               3
code-health-duplicates.test.ts       3
review-package-cli.test.ts           3
platform-deps-hook.test.ts           3
metrics-report.test.ts               2
doctor-logic.test.ts                 2
eval-runner.test.ts                  2
gate-ticket-content.test.ts          2
wm-status.test.ts                    2
project-read-validation.test.ts      2
check-coding-plan.test.ts            2
check-codegraph-queries.test.ts      2
gate-test-evidence.test.ts           1
```

---

## ④ Wave 2/3 选择清单

### Wave 2 · spawn 成本削减：转换候选（②∩③ 交集 14 文件 → 纳入 8 / 排除 6）

交集 = ②top30 与 ③top20 同时出现的文件。排除口径：CLI 自身 spawn（子进程语义即被测对象）/ 依赖真实 stdin / 依赖进程 cwd。判定依据 = 逐文件读 spawn 调用目标与 helper 用法（行号为本 worktree 实测）。

**纳入候选（8 个，逐例耗时合计 ≈ 308.1s，约 vitest 墙钟 15%）：**

| 文件 | 耗时 | spawn 行 | 判定理由 |
|---|---|---|---|
| code-health-cli.test.ts | 71.6s | 6 | 6 处 spawn 全为 `git`（fixture 建仓/回滚验证）；被测 CLI 经 helper `runCli`（`runSync(process.execPath, [tsx, cli, --candidate, --root <显式>, ...])`）启动，root 显式传参不触发 `code-health-apply.ts:546` 的 `?? process.cwd()` 兜底；文件已进程内 import CLI 模块与 logic（L19/L28），无 stdin。 |
| check-coding-plan.test.ts | 56.3s | 2 | CLI 经 `execSync('npx tsx "<CLI>" ...')` 启动，项目 root 以引号位置参数显式传入（L170），`cwd: REPO_ROOT` 仅为稳定启动目录；`check-coding-plan.ts` 无 `process.cwd()`；无 stdin；git spawn 为 fixture 建仓。 |
| review-package-cli.test.ts | 56.2s | 3 | `runReviewPackage` 显式传 `--repo/--base/--head/--out`（L213 等），`review-package.ts:279` 的 cwd 兜底未触发；`git hash-object -w --stdin`（L133）是 fixture 数据管道（喂 git，非被测 CLI 读 stdin）。 |
| check-codegraph-queries.test.ts | 37.2s | 2 | 与 check-coding-plan 同款 helper（execSync npx tsx + 显式参数 + `cwd: REPO_ROOT` 启动目录）；`check-codegraph-queries.ts` 无 `process.cwd()`；无 stdin。 |
| gate-ticket-content.test.ts | 34.9s | 2 | `runGate` 以位置参数显式传项目目录（L483 `runGate([dir, '--phase=8'])`），`check-artifact-gate.ts:196` 的 `process.cwd()` 仅无位置参数时兜底（未触发）；spawn options 为空对象；文件已混用进程内 `parseTicketsArg` 导入（L472）。 |
| code-health-duplicates.test.ts | 20.6s | 3 | `runCli('code-health-duplicates.ts', ['--matrix', <显式路径>, ...])` 传参启动；注意 4 处调用（L558/574/634/637）未传 `--root`，依赖 `runCli` 缺省 `cwd: REPO_ROOT` 兜底（`code-health-duplicates.ts:244/282`）——转换时需补显式 `--root REPO_ROOT`，语义可等价推导。 |
| metrics-report.test.ts | 17.0s | 2 | `runSync(process.execPath, [tsx, SCRIPT, tmpDir, ...])` 位置参数显式传项目目录（L53），`metrics-report.ts:64` 的 `?? process.cwd()` 兜底未触发；无 stdin。 |
| wm-status.test.ts | 14.5s | 2 | 与 metrics-report 同款 helper（L53，位置参数显式传 tmpDir），`wm-status.ts:44` 兜底未触发；无 stdin。 |

**排除（6 个，逐例耗时合计 ≈ 1039.1s）：**

| 文件 | 耗时 | spawn 行 | 排除理由 |
|---|---|---|---|
| docs-consistency-logic.test.ts | 466.5s | 9 | CLI 边界即被测对象——helper 源码注释明示「Do not replace this with a mocked call: the fixture test covers the CLI boundary」（L3056）；pre-push 段经 `execFile('bash', ...)` 真实执行 hook 且以管道 stdin 显式 EOF（L3187-3209）；`runDocsConsistencyCli` 以 `cwd: fixtureRoot` 启动（L3057-3058）。 |
| platform-deps-hook.test.ts | 374.1s | 3 | 测试对象是 `.githooks/ensure-platform-deps.sh` / `pre-push` 两个 bash hook 的进程行为：全部 spawn 为 `spawnSync('bash', ['-c', ...])`（PATH/wslpath 探测、printenv），并以 `input: ''` 模拟 stdin EOF（L25-57）——进程语义即被测物。 |
| pre-commit-hook.test.ts | 70.5s | 7 | `runHook` 以 `bash -c "...; cd <root>; bash <hook>"` 真实执行 pre-commit hook（L285-290），依赖 bash `cd`（进程 cwd）、GIT_INDEX_FILE 与 marker 环境变量——hook 的子进程行为即被测对象。 |
| code-health-tests.test.ts | 59.7s | 5 | 被测物含 test-runner 库的 spawn 行为本身：`runner.run(process.execPath, ['suite.mjs'], { cwd: root, ... })`（L972-974）断言 runner 真实拉起 node 套件——子进程语义即被测物。 |
| gate-report.test.ts | 56.7s | 48 | check-run-log 族用例把 gate-log 以 `path.relative(tmpDir, ...)` 相对路径写入 run-log（L287/L323）并以 `cwd: tmpDir` 启动子进程，而 `check-run-log.ts:162` 以 `process.cwd()` 解析相对引用——真实依赖子进程 cwd。 |
| run-sync.test.ts | 11.5s | 8 | 被测对象就是 `runSync` 子进程封装库本身：真实 spawn node/git 验证超时/maxBuffer/cwd 语义，且 L472-486 经 doUnmock 真实 spawn 断言 ETIMEDOUT（unit-parallel 项目，文件级 vi.mock 已知盲点）。 |

### Wave 3 · 逐文件 it 名称分组（② 前 15 文件，供拆分/标记决策）

1. **docs-consistency-logic.test.ts**（210t，466.5s）：七来源 R10 clause 完整性与逐条 mutation（~20）；反向/否定语义 fail-closed 与结构化宿主外 bypass（~11）；自动安装禁止句式与 mtime 错误安全主张（~19）；文档结构治理族——SSoT 边界/schema 清单/run-log 枚举/DoD 维度/操作行为表/硬约束编号/反模式编号/exit-2 计数/pre-push 编号/glossary/资产计数（~49）；exit-2 probe identity 路径规范化（~10）；动态测量 fail-closed 与 provenance/coverage 注入（~18）；PR 模板与出站链接与 baseline-sync（~10）；version-consistency 七处一致（~12）；ssot-headings/script-registry/run-log-action 漂移（~11）；internal-links/orphan-reference（~17）；agents-nav/tests-matrix（~13）；evidence-manifest 与 D7C provenance 边界（~6）；pre-push 源契约 stdin/fallback/diff（~3）；过期门禁计数扫描（~11）；persona 矩阵对账（~8）。
2. **platform-deps-hook.test.ts**（87t，374.1s）：ensure-deps --check/--install 语义（~11）；变更路径过滤 path filter（~11）；quotePath 覆盖（1）；只读平台检查先行（1）；stdin 多 ref/fallback diff/new branch merge-base/delete-only/坏行/空 stdin/--force 全族（~24）；npm audit skip/block 边界（~38）；coverage 工件消费（1）；命令暴露（1）。
3. **evidence-export-logic.test.ts**（41t，79.0s）：ARG_INVALID exit 2（3）；导出白名单与哈希（~5）；脱敏 redaction（~8）；manifest 严格校验（~10）；source-bound 校验（~5）；输出安全 symlink/目录/遍历（~7）；真实 CLI 边界（~5）。
4. **code-health-cli.test.ts**（28t，71.6s）：argv 校验 exit 2（4）；apply 模式与 approval scope/回滚（~13）；ledger init/append/validate（3）；help/usage（2）；仓库纯度（1）；archive campaign 校验（~6）。
5. **pre-commit-hook.test.ts**（22t，70.5s）：staged vs worktree 快照语义（~9）；batch 协议 fail-closed（~8）；超时清理（1）；symlink/路径攻击 fail-closed（~4）；200 blob 批量物化（1）。
6. **code-health-task1-integration.test.ts**（32t，65.9s）：全链路正向（1）；apply/archive 边界（1）；negative matrix 29 项（29）；repo-root 纯度（1）。
7. **exit2-failure-atomicity.test.ts**（47t，65.9s）：门禁集合动态推导（1）；46 个 CLI 逐个负向 exit 2 原子性（46）。
8. **code-health-tests.test.ts**（28t，59.7s）：保护类测试分类（~5）；删除授权/等价幸存者（~7）；pre-push 计数与顺序漂移（~4）；F-4 命令证据/冗余声明（~4）；guard candidate/回滚（~6）；readTrackedJson/路径声明（~2）。
9. **gate-report.test.ts**（51t，56.7s）：输出契约（分隔线/exitCode/JSON 前缀）（~9）；gate-logs R6 比对（~14）；run-log fail-closed 解析（~7）；TLA/BDD（~4）；iceberg（~3）；maturity 豁免（3）；natural-exit 契约（2）；其余（~9）。
10. **check-coding-plan.test.ts**（20t，56.3s）：argv 校验 C1/C1b/C8/C8b（4）；scope 装载与缺省 C2/C3/C4/C7（4）；输出模式 C5/C6（2）；R5/R4 制品诊断 C11-C14（~7）；preflight C9 系列（~5）。
11. **review-package-cli.test.ts**（19t，56.2s）：成功输出契约（2）；ARG_INVALID 家族（~8）；SHA 前缀碰撞/core.abbrev（2）；输出目标安全 symlink/目录/只读（~5）；原子写失败清理（2）。
12. **code-health-e2e.test.ts**（7t，54.7s）：apply/archive/phase1 发现/guard/duplicates/phase1-CLI 六条真实链路（7）。
13. **check-samples-coverage.test.ts**（23t，48.6s）：正例（~5）；RED 负向矩阵（~15）；派生锚（~3）。
14. **check-codegraph-queries.test.ts**（34t，37.2s）：C1-C9 查询校验（~16）；.codegraph 索引形态（~5）；C10 CLI 薄封装（~8）；C14 降级声明（4）。
15. **wm-write.test.ts**（27t，35.5s）：lock-timeout argv（~6）；锁竞争/stale lock/恢复（~8）；并发写者（1）；注册目标/大小写（~5）；--stdin/--from（~5）；mtime（~3）。
