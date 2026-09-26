# e2e 调测资产（counter-api 8 阶段轨迹）

> 来源：2026-09-19 全流程调测（报告留在未跟踪目录 `docs/debug/2026-09-19-wm-8phase-full-debug/`）。
> 本目录是**受跟踪**的可重放资产；工作区本身 `eval/e2e/demo/` 仍为 gitignored 瞬态目录。

## 前置条件

- Node ≥ 20 + 仓库根 `npm install`（tsx runtime）
- Python 3（装配器与探针的 JSON 变异）
- Java 17 + `w-model-dev/tools/tla2tools.jar`（真实 SANY/TLC）
- Git Bash / WSL（Windows）或任意 bash

## 重建 + 重放

```bash
cd eval/e2e/demo-assets
python build_workspace.py --reset        # 整树清空的唯一路径；常规运行会重建 .w-model/.superpowers/tla/features/src/test/docs/archive
                                         # 八个目录（同样受工作区判据保护：非本装配器工作区直接 exit，不静默删除）
bash run_trajectory.sh                   # 期望末行：✓ 119/119 exit 0
bash run_negative_probes.sh              # 期望末行：✓ 9/9 探针被拦截 + 恢复复绿
```

`change-scope` 的 `baseRef/headRef` 取运行时 `HEAD~1..HEAD`（可用 `REPLAY_BASE` / `REPLAY_HEAD` 覆盖），`changedFiles` 取该区间真实差异；`codegraph-queries`、编码计划制品（`docs/plans/` + `.superpowers/sdd/`）与 `openspec/changes/` 按同一文件列表生成，故 scope 校验恒成立。查询记录按 D-6（2026-09-25）显式声明证据形态：demo 工作区无 `.codegraph/` 索引 → 一律写 `evidenceKind:'artifact'` + `degradationReason` + ≥1 条 `alternativeEvidence`（判据见 `check-codegraph-queries.ts` 的索引探测；索引在盘时须改为 `'cli'`）。

**注意 `--scope` 的干净工作树前提**：`verifyScopeGitBinding` 把「commit 区间 + 暂存 + 未暂存 + 未跟踪（限 cwd）」与实际变更精确比对，且 `headRef` 必须等于当前 HEAD。因此任何未提交改动都会让 p5–p8 的 `--scope` 校验失败——先提交改动，再重建 + 重放；工作区重建后 HEAD 一旦前移（如证据入库的新提交），也须重建后方可再跑（这是设计，不是缺陷）。

阶段 5-8 的编码链制品（superpowers 替换批次 3，门禁 `check-coding-plan.ts` R1-R6）：

| 制品       | 路径                                                                                                                                                           | 规则  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 编码计划   | `docs/plans/phase<N>-demo.plan.md`（目标节 + 3 个任务节，逐节一条行首「验证：」命令行）                                                                        | R1/R2 |
| 执行账本   | `.superpowers/sdd/phase<N>-demo.plan/progress.md`（首行身份 + 逐任务 `Task N: complete`）                                                                      | R3    |
| 任务三件套 | 同目录 `task-<N>-brief.md` / `task-<N>-report.md` + `review-*.diff`                                                                                            | R4    |
| stage 审查 | `.w-model/r3-reviews/phase<N>-{plan,execute,finalize}-{completeness,reliability,security}.md` ×9 + `.w-model/v-reviews/phase<N>-{plan,execute,finalize}.md` ×3 | R5    |

旧 opsx 链路制品（`openspec/changes/<changeId>/`）在 demo 工作区中仍被生成（装配器未删除），但**对应的门禁已在 2026-09-21 退役**：`check-opsx-artifacts.ts` 与其 fixture（`w-model-dev/scripts/samples/opsx-artifacts/`）已 `git rm`，语义并入 `check-coding-plan.ts` R5 的 R3×9 + V×3（stage 词表 `plan/execute/finalize`，旧词表 `explore/propose/coding` 不充数）。该目录现在只是留作历史对照的静态样本，没有任何门禁读取它。

**归档位（阶段 8 后置）**：`archive/2026-09-19-counter-api/` 除各阶段清单占位文件外，还含**编码计划归档快照**——`phase8-demo.plan.md` + `progress.md` + `task-<N>-{brief,report}.md`（正文与阶段 8 活动位产物同源，装配器有「快照 ↔ 活动位逐字一致」的 fail-fast 自测锚），使 `check-archive-integrity.ts` 的 `codingPlanSnapshot` 条件项经「归档根恰一 `*.plan.md`」的**自动派生**分支激活（驱动不传 `--change-id`；显式形态由 `samples/archive-integrity` 与 CLI 子进程用例覆盖）。快照只覆盖该条件项的结构子集（plan / 账本 / 三件套），`review-*.diff` 等全量契约由 `check-coding-plan.ts` R4/R6 在活动位承担。基准态 `rtm.json` 的 REQ 行 `designDoc` 按真实 RTM 形态登记全设计链（`SD-001,INTF-001,DD-001`，与 graph 声明的设计 ID 集精确相等），使 iceberg R6 宽池 `graph↔rtm` 不再自报差异。

## 销毁前证据保全

`--reset` 与常规运行都会删 `.w-model`（run-log / signature-chain / budget 等运行时状态随之清空）。若当前工作区态可能是某次真实调测/运行的**唯一证据载体**，销毁前必须先完成证据分级裁定并保全，再重建。证据按「类别 × 粒度 × 保全手段」分级：

| 证据类别 | 粒度                                                                              | 保全手段                                                                                                                                                                            |
| -------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 结论层   | 调测/运行结论与经验教训（本文档与「已实测的坑」即其产物）                         | 入库文档（如 `docs/debug/<日期>-<主题>/` 下的报告 Markdown）                                                                                                                        |
| 制品层   | `.w-model/` 运行时产物（run-log / signature-chain / gate-logs 等）                | 整树快照入库 `docs/debug/<日期>-<主题>/`；或走导出链（`npm run wm:verify-evidence-source` + `npm run wm:export-evidence`）——注意导出链 source-bound 强制 git HEAD，对无 `.git` 工作区（含本 demo 工作区）结构性不可用，此形态下以快照入库为准 |

本节为规则成文，**不新增反模式编号**（成本收益裁定，见 RC-2 报告 `docs/debug/2026-09-22-rc2-demo-rebuild-loss/README.md`）。

## 非基准态检测与证据快照（装配器机制位）

上节规则由装配器机制强制：`build_workspace.py` 在删除 `.w-model` 的两条路径（`--reset` 整树清空与常规八目录重建）上**同管**同一个前置检测，命中任一信号即按「该态可能是真实运行/调测的唯一证据载体」处理：

| 信号 | 判据（子串匹配，不解析 JSON）                                                                                        |
| ---- | -------------------------------------------------------------------------------------------------------------------- |
| a    | `.w-model/run-log.jsonl` 行数 ≠ 装配器基准 104 行（基准由装配器写出后自测校验，轨迹改动会 fail-fast 提示同步常量）    |
| b    | `.w-model/` 递归存在 `*.bak.*`（wm-write 备份残留）                                                                   |
| c    | run-log 存在装配器基准之外（runId 非 `p1-cp`…`p8-cp`）的 `"action": "checkpoint"` + `"outcome": "success"` 放行记录   |

两处基准（104 行与 runId 集合 `p1-cp`…`p8-cp`）都有写出后自测锚：run-log 轨迹改动若引起行数或 runId 模式漂移，装配器 fail-fast 提示同步常量，防基准漂移造成误报、侵蚀护栏。

命中后的行为（fail-closed）：

1. 先把 `run-log.jsonl`、`signature-chain.jsonl`、`checkpoint-log/`、`gate-logs/` 拷入 **gitignored** 的 `eval/e2e/demo-snapshots/<UTC时间戳>/`（单文件 `copy2`、目录 `copytree`，源缺失跳过、目标已存在复用）；
2. 未传 `--accept-state-loss` → print 快照路径与命中信号后 `exit 1`，不销毁——先人工核阅快照或按上节完成证据分级裁定；
3. 传了 `--accept-state-loss` → 快照仍执行，随后继续销毁重建（显式接受状态丢失的唯一通道）。

`.w-model` 不存在（首次装配）或为干净基准态时检测静默通过，重建行为与既往完全一致（零行为变化路径）。

## 已实测的坑（务必遵守）

1. **工作区里不能有 `.git`**：残留 `eval/e2e/demo/.git` 会让 `--scope` 的 `headRef` 绑到 demo 自身 HEAD，p5–p8 的 artifact-gate 全部报「headRef 过期」（实测只剩 114/119）。脚本会在这种情形 fail-closed 退出；只有 `--reset` 会清空**全部**（含残留 `.git`/`openspec/`），不带 `--reset` 的常规运行也会重建 `.w-model/.superpowers/tla/features/src/test/docs/archive` 八个目录（`.w-model` 含 run-log / signature-chain / budget 等运行时状态，重建即回到装配器的基准态）。
2. **禁止并发写者**：重放期间不要跑其他 vitest / `npm run prepush`，也不要往 `docs/debug/` 写文件——`exit2-failure-atomicity` 对并发写盘敏感，会产生伪失败并争用 `coverage/`。
3. **超时预算**：聚合门以子进程调用 TLA 模型检查（真实 TLC），子进程预算为 `EXEC_LIMITS.modelCheckChildTimeoutMs`（360s）；机器负载高时可重跑，不要把它误判为门禁缺陷。
4. **九项探针的期望命中词**写死在 `run_negative_probes.sh` 的 `EXPECT`；改动门禁消息文案时必须同步更新，否则探针会以「未命中期望原因」失败。
