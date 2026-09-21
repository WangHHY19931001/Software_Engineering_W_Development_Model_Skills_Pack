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

`change-scope` 的 `baseRef/headRef` 取运行时 `HEAD~1..HEAD`（可用 `REPLAY_BASE` / `REPLAY_HEAD` 覆盖），`changedFiles` 取该区间真实差异；`codegraph-queries`、编码计划制品（`docs/plans/` + `.superpowers/sdd/`）与 `openspec/changes/` 按同一文件列表生成，故 scope 校验恒成立。

**注意 `--scope` 的干净工作树前提**：`verifyScopeGitBinding` 把「commit 区间 + 暂存 + 未暂存 + 未跟踪（限 cwd）」与实际变更精确比对，且 `headRef` 必须等于当前 HEAD。因此任何未提交改动都会让 p5–p8 的 `--scope` 校验失败——先提交改动，再重建 + 重放；工作区重建后 HEAD 一旦前移（如证据入库的新提交），也须重建后方可再跑（这是设计，不是缺陷）。

阶段 5-8 的编码链制品（superpowers 替换批次 3，门禁 `check-coding-plan.ts` R1-R6）：

| 制品       | 路径                                                                                                                                                           | 规则  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 编码计划   | `docs/plans/phase<N>-demo.plan.md`（目标节 + 3 个任务节，逐节一条行首「验证：」命令行）                                                                        | R1/R2 |
| 执行账本   | `.superpowers/sdd/phase<N>-demo.plan/progress.md`（首行身份 + 逐任务 `Task N: complete`）                                                                      | R3    |
| 任务三件套 | 同目录 `task-<N>-brief.md` / `task-<N>-report.md` + `review-*.diff`                                                                                            | R4    |
| stage 审查 | `.w-model/r3-reviews/phase<N>-{plan,execute,finalize}-{completeness,reliability,security}.md` ×9 + `.w-model/v-reviews/phase<N>-{plan,execute,finalize}.md` ×3 | R5    |

旧 opsx 链路制品（`openspec/changes/<changeId>/`）**仍在生成**：`check-opsx-artifacts.ts` 仍在 pre-push 路径上，其契约由 `w-model-dev/scripts/samples/` 的 fixture 覆盖。但 stage 审查文件名已随 R5 迁徙为 `plan/execute/finalize`（旧词表 `explore/propose/coding` 不再生成），故旧门禁若**单独对 demo 运行**会在 R5 报缺失——这是词表迁徙的已知后果，不是回归：旧链路不在 demo 电池 / 轨迹 / 探针内运行，其本体退役见 superpowers 替换批次 4。

## 已实测的坑（务必遵守）

1. **工作区里不能有 `.git`**：残留 `eval/e2e/demo/.git` 会让 `--scope` 的 `headRef` 绑到 demo 自身 HEAD，p5–p8 的 artifact-gate 全部报「headRef 过期」（实测只剩 114/119）。脚本会在这种情形 fail-closed 退出；只有 `--reset` 会清空**全部**（含残留 `.git`/`openspec/`），不带 `--reset` 的常规运行也会重建 `.w-model/.superpowers/tla/features/src/test/docs/archive` 八个目录（`.w-model` 含 run-log / signature-chain / budget 等运行时状态，重建即回到装配器的基准态）。
2. **禁止并发写者**：重放期间不要跑其他 vitest / `npm run prepush`，也不要往 `docs/debug/` 写文件——`exit2-failure-atomicity` 对并发写盘敏感，会产生伪失败并争用 `coverage/`。
3. **超时预算**：聚合门以子进程调用 TLA 模型检查（真实 TLC），子进程预算为 `EXEC_LIMITS.modelCheckChildTimeoutMs`（360s）；机器负载高时可重跑，不要把它误判为门禁缺陷。
4. **九项探针的期望命中词**写死在 `run_negative_probes.sh` 的 `EXPECT`；改动门禁消息文案时必须同步更新，否则探针会以「未命中期望原因」失败。
