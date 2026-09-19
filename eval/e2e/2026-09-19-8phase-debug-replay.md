# 8 阶段 e2e 重放记录（2026-09-19）

> 资产：`eval/e2e/demo-assets/`（受跟踪）· 工作区：`eval/e2e/demo/`（gitignored，`--reset` 重建）
> 归档对照：`docs/debug/2026-09-19-wm-8phase-full-debug/logs/e2e/trajectory.log`（未跟踪审计产物）

## 环境

- 日期 / 主机 / node / Java / HEAD：`date -Iseconds` · `uname -srm` · `node --version` · `java -version 2>&1 | head -1` · `git rev-parse HEAD`
- 实测值：
  - 日期：`2026-09-19T19:05:52+08:00`（修复轮 2 重放起始，取自 `trajectory.log` 首行）→ `2026-09-19T19:13:14+08:00`（本轮证据采集）（历史：首轮起始 `2026-09-19T18:01:00+08:00` → 修复轮 1 记录落盘 `18:28:59+08:00`）
  - 主机：`MINGW64_NT-10.0-26200 3.6.7-fb42d713.x86_64 x86_64`（Windows 10.0.26200 x64 / Git Bash）
  - node：`v25.8.1`
  - Java：`openjdk version "17.0.4" 2022-07-19`
  - 仓库 HEAD（本轮重放时）：`bf56f8587c629ecbf9683dd58cec7844baa1141e`
- **本证据基于 commit `bf56f8587c629ecbf9683dd58cec7844baa1141e`（重放时 HEAD）的资产**；资产文件最后变更于 `bcea41d9`（修复轮 2：装配器工作区判据护栏 + 探针日志自证 + `quotePath`/`chmod`/`trap`），`bf56f858` 本身只改本记录文件。`git status --porcelain eval/e2e/demo-assets/` 为空（无本地未提交改动）。
  资产指纹（`git rev-parse HEAD:<path>`）：

  | 资产                                          | blob SHA                                   |
  | --------------------------------------------- | ------------------------------------------ |
  | `eval/e2e/demo-assets/README.md`              | `48241ffb07320196a397f0df983ccab8c1b4c077` |
  | `eval/e2e/demo-assets/build_workspace.py`     | `0f6b5116cd075f8e8e78f42d53be1fc61f8dc420` |
  | `eval/e2e/demo-assets/run_trajectory.sh`      | `79b695123c9f716174fbdc048f02401b97a496e9` |
  | `eval/e2e/demo-assets/run_negative_probes.sh` | `8659cc0eb09f5da55a2ad9ae2a5d22039c359277` |

  **其后若资产文件再变更，须重跑并更新本记录。**（三轮重放数字一致：首轮基于 `0170e226`、修复轮 1 基于 `8ae12c56`、修复轮 2 基于 `bcea41d9`（资产）/`bf56f858`（重放 HEAD）。）

- 前置条件：无并发写者（重放前与重放后各实测一次 `Get-CimInstance Win32_Process` 过滤 `vitest|prepush`（限 `node|npm` 进程）= 0；两轮重放之间未启动其他 vitest / `npm run prepush` / 长任务）；重放期间未向工作区外写入状态。
- **工作树须干净（修复轮 2 实测新增）**：`--scope` 绑定的「实际变更集合」= `base..head` + staged + unstaged + untracked（`w-model-dev/scripts/lib/change-scope.ts` 的 `verifyScopeGitBinding`），任何 tracked 文件的未提交改动都会让 p5–p8 的 artifact-gate 报 `[scope] 实际变更未在 changedFiles 声明：<file>` 并 exit 1。修复轮 2 首跑（工作树里本记录文件的 A4/A5 改动未提交）即因此得到 `TOTAL_GATE_RUNS=119` / `NONZERO_EXIT_COUNT=4`；提交该文件后重跑即 119/119。untracked 文件不受影响：`git ls-files --others` 以项目根（`eval/e2e/demo`，已被 gitignore）为前缀过滤，看不到未跟踪的 `docs/debug/`。

## 结果

| 项                                  | 期望                        | 实测        |
| ----------------------------------- | --------------------------- | ----------- |
| 轨迹执行条数 `TOTAL_GATE_RUNS`      | 119                         | 119         |
| 非零退出 `NONZERO_EXIT_COUNT`       | 0                           | 0           |
| 其中门禁脚本 / wm-write / wm-status | 89 / 29 / 1                 | 89 / 29 / 1 |
| 负向探针                            | 9/9 被拦截 + 恢复复绿       | 9/9         |
| `wm-status` RTM 覆盖率              | 4/4（100%，按追溯字段重算） | 4/4（100%） |

原始日志（均为修复轮 2 在 `bf56f858`（工作树 = 该提交）上的重放）：

- 轨迹：`eval/e2e/demo/.replay/trajectory.log`（170333 字节，mtime `2026-09-19 19:10:40`，末行 `TOTAL_GATE_RUNS=119` / `NONZERO_EXIT_COUNT=0`，脚本 stdout 末行 `✓ 119/119 exit 0`，退出码 0；字节数与修复轮 1 **完全相同**）
- 探针：`eval/e2e/demo/.replay/negative-probes.log`（19141 字节，mtime `2026-09-19 19:13:11`，脚本 stdout 末行 `✓ 9/9 探针被拦截 + 恢复复绿`，退出码 0；比修复轮 1 的 18815 字节多 326 字节，即新增的 9 条 `EXPECT_MATCH` 判定行 + 1 条 `probe-orig residue count` 行）

> 三轮重放数字**完全一致**（119 / 0 / 89-29-1 / 9-9 / 4-4），故上表照写；`TOTAL_GATE_RUNS=119` 与 `NONZERO_EXIT_COUNT=0` 由 `run_trajectory.sh` 末段自断言（`[ "$TOTAL" -eq 119 ]` / `[ "$NONZERO" -eq 0 ]`），非脚本退出即为命中。

命令序列（`eval/e2e/demo-assets/` 下执行）：

```bash
python build_workspace.py --reset
bash run_trajectory.sh
bash run_negative_probes.sh
```

### 轨迹产出（89 条门禁脚本退出码全 0）

阶段 1–8 每阶段 `graph / tla / bdd / verifier / artifact-gate`（阶段 5–8 为 `artifact-gate --scope=.w-model/change-scope.p{5..8}.json`）+ 阶段 8 `archive-integrity`，以及每阶段 7 条闭环（`budget / run-log / maturity / checkpoint / preventive-review / role-dispatch / signature-chain`）；29 条 `wm-write` 为状态演化（`graph / tla-manifest / bdd-manifest / project`），1 条 `wm-status` 收尾。

终态 `STATUS_JSON`（节选；完整原文见 `trajectory.log` 末段）：

```json
{
  "phase": 8,
  "completedPhases": 8,
  "progress": "8/8（100%）",
  "status": "项目完成",
  "rtmCoverage": { "covered": 4, "total": 4, "percent": 100 },
  "testSummary": {
    "unit": { "total": 3, "passed": 3, "failed": 0 },
    "integration": { "total": 2, "passed": 2, "failed": 0 },
    "system": { "total": 2, "passed": 2, "failed": 0 },
    "acceptance": { "total": 2, "passed": 2, "failed": 0 }
  }
}
```

### 9 项负向探针逐条结果（均在绿色终态上最小突变 → 被真实拦截 → 恢复复绿）

| #   | 探针                     | 变异                                       | 退出码 | 命中期望词                   |
| --- | ------------------------ | ------------------------------------------ | ------ | ---------------------------- |
| 1   | `sigchain-tamper`        | 签名链第 6 条 `sigHash` 置零               | 1      | `失败规则：.*R6`             |
| 2   | `runlog-missing-closure` | 删除阶段 1 budget 闭环记录                 | 1      | `R11`                        |
| 3   | `tla-invariant-tlc`      | 真实不变式违反 + manifest 自报全 true      | 1      | `不变式违反 *: *[1-9]`       |
| 4   | `tla-phase-mismatch`     | phase 形态错配（后期 manifest 做前期校验） | 1      | `属后续阶段`                 |
| 5   | `graph-blackhole`        | 删除 `DD-001 → EXT-OUT` 信息流边           | 1      | `黑洞`                       |
| 6   | `verifier-floor`         | Verifier 单轴 0.93 → 0.5                   | 1      | `单轴下限`                   |
| 7   | `rtm-codemodule`         | `REQ-001` 的 `codeModule` 置空             | 1      | `codeModule`                 |
| 8   | `checkpoint-vague`       | CHECKPOINT 决策改泛化短句                  | 1      | `R2`                         |
| 9   | `cucumber-failed`        | cucumber 步骤改 `failed`                   | 1      | `--- D5 Step Binding: [1-9]` |

探针 3 的命中词要求报告块出现 `不变式违反 : N 条`（N ≥ 1），即真实 TLC 判定的不变式违反，**与「缺 Java/jar 导致的环境失败」可区分**（后者不打该计数）。本轮日志另给更强的锚点：该条 `TLA_JSON` 报 `"checkedSpecs":2`、`"environmentOk":true`、`"invariantViolations":["规格 L2_counter_service 不变式违反（invariantsHold=false）"]`——两个规格都真跑了 TLC、环境就绪、违反来自判定而非环境。

**判定自证（修复轮 2，B2）**：每条探针的期望词命中由 `probe()` 在 grep 断言**之后**写回日志——`negative-probes.log` 实测 `[NP:<id>] EXPECT_MATCH=yes` **9 条**、`EXPECT_MATCH=no` **0 条**（断言前的行只陈述期望，不再陈述结论）。

恢复复验：`restore-check check-signature-chain.ts EXIT=0`、`restore-check check-run-log.ts EXIT=0`（日志末段）；`probe-orig residue count=0`（同段日志自证：全部 `*.probe-orig` 备份已 `mv` 回原位）。

## 与归档的差异（如实列出）

1. 门禁消息措辞随 S2 修复变化：`--phase=1` 校验后期 manifest 时报「属后续阶段（phase=2）…」而非「不在 manifest 中」——归档日志保留旧文案（历史快照），资产重放为新文案（探针 4 即针对该文案的区分度断言）。
2. `wm-status` 的 RTM 覆盖率由 0/4 变为 4/4（F-1 修复：不再按展示字段统计）。
3. 归档日志的 8 项探针含一条归因错误（`NP:tla-invariant-falsify` 实际为 phase 形态错配），本轮拆分为第 3、4 两条探针。

## 重建过程记录（护栏 + Windows 自愈缺口：**已修**）

1. **`--reset` 护栏生效**：工作区残留 `eval/e2e/demo/.git` 时，不带 `--reset` 的装配器按设计 fail-closed 退出（退出码 1），输出：
   `✗ 工作区根存在 .git：它会让 --scope 的 headRef 绑到 demo 自身 HEAD 而使 p5–p8 门禁过期。请先移走/删除该目录，或显式传 --reset 清空重建。`
2. **工作区判据护栏（修复轮 2，B1）**：两处删除点（`--reset` 整树清空、常规 7 目录重建）前加同一条判据——`ROOT` 不存在或为空（首次构建），或含本装配器哨兵（`SPEC.md` 与 `.w-model/project.json` 同时存在）才允许删除；否则 exit 1 并打印处置指引（`--reset` 仍先过既有「以 demo 结尾且不等于仓库根」护栏，删除失败仍抛、不使用 `ignore_errors`）。临时目录实测 4 种形态：非工作区 + 不带 `--reset` → exit 1 且目标文件原样保留；非工作区 + `--reset` → exit 1（同样未删）；`ROOT` 不存在 → 首次构建 exit 0；本装配器工作区（含 `--reset`）→ exit 0。
3. **（首轮发现 → 修复轮 1 已修）`--reset` 在 Windows 上无法自行清空残留 `.git`**：首轮 `python build_workspace.py --reset` 曾以
   `PermissionError: [WinError 5] 拒绝访问。: '...\eval\e2e\demo\.git\objects\pack\pack-aab165774297aa18e90a41b53a1e268156c947e2.idx'`
   失败（退出码 1）——git 把对象/pack 文件置为只读（`attrib` 显示 `R`），而 `shutil.rmtree` 在 Windows 上不解除只读即删除失败，导致护栏推荐的唯一自愈路径失效。

   **修复（commit `8ae12c56`）**：`build_workspace.py` 新增 `rmtree_force(path)`——标准库实现，异常钩子先 `os.chmod(p, stat.S_IWRITE)` 再重试原操作（Python ≥ 3.12 走 `onexc=`，否则 `onerror=`）；`--reset` 全清路径与常规清理循环那 7 个目录**两处**调用点均改用该助手，删除入口未新增（仍只在 `--reset` 分支做整目录删除），且**不使用** `ignore_errors`，解除只读后仍删不掉即抛出（fail-closed 语义不变）。修复轮 2（B4）把该行改为 `os.chmod(p, stat.S_IWRITE | stat.S_IREAD)`——POSIX 异常路径上不再把权限收窄为 `0o200`；本轮 `--reset` 全清重建仍 exit 0。

   **修复后验证（修复轮 1 实测）**：

   | 步骤       | 命令                                                 | 实测结果                                                                                                                                                                            |
   | ---------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | 造障       | `git init -q && git add -A`（在工作区内重建 `.git`） | `.git` 共 263 文件，**243 个只读**（`objects` 243/243 全只读；`attrib .git/objects/00/4a0be402…` → `A  R`）                                                                         |
   | 护栏       | `python build_workspace.py`（不带 `--reset`）        | 退出码 1，输出同第 1 条（`.git` 未被触碰）                                                                                                                                          |
   | 修复前对照 | 旧代码路径等价调用 `shutil.rmtree('eval/e2e/demo')`  | `PermissionError: [WinError 5] 拒绝访问。: 'eval/e2e/demo\.git\objects\00\4a0be402…'`；失败后仍余 481 文件 / 243 只读                                                               |
   | 修复后     | `python build_workspace.py --reset`                  | **退出码 0**，输出 `workspace built at …\eval\e2e\demo`；`.git` 已清除；重建后 183 文件 / **0 只读**，关键产物（`.w-model/`、`tla/`、`features/`、`src/`、`test/`、`archive/`）齐备 |

   即：同一只读障碍下，旧路径以 `WinError 5` 失败、新路径成功清空并重建——`--reset` 现在兑现了护栏与 README 承诺的自愈能力。
