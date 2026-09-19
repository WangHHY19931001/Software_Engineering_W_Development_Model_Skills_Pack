# 8 阶段 e2e 重放记录（2026-09-19）

> 资产：`eval/e2e/demo-assets/`（受跟踪）· 工作区：`eval/e2e/demo/`（gitignored，`--reset` 重建）
> 归档对照：`docs/debug/2026-09-19-wm-8phase-full-debug/logs/e2e/trajectory.log`（未跟踪审计产物）

## 环境

- 日期 / 主机 / node / Java / HEAD：`date -Iseconds` · `uname -srm` · `node --version` · `java -version 2>&1 | head -1` · `git rev-parse HEAD`
- 实测值：
  - 日期：`2026-09-19T18:01:00+08:00`（起始）→ `2026-09-19T18:09:20+08:00`（记录落盘）
  - 主机：`MINGW64_NT-10.0-26200 3.6.7-fb42d713.x86_64 x86_64`（Windows 10.0.26200 x64 / Git Bash）
  - node：`v25.8.1`
  - Java：`openjdk version "17.0.4" 2022-07-19`
  - 仓库 HEAD：`0170e226fb30907f96258c6bfbb984d096ef4efa`
- **本证据基于 commit `0170e226fb30907f96258c6bfbb984d096ef4efa` 的资产**（该提交即 `eval/e2e/demo-assets/` 的最新提交，`git status --porcelain eval/e2e/demo-assets/` 为空，无本地未提交改动）。
  资产指纹（`git rev-parse HEAD:<path>`）：

  | 资产                                          | blob SHA                                   |
  | --------------------------------------------- | ------------------------------------------ |
  | `eval/e2e/demo-assets/README.md`              | `dd77b06fc87014efe998588a6aebac57adf8f52b` |
  | `eval/e2e/demo-assets/build_workspace.py`     | `bfa94bba3be90edc49374936ae0aa3450bc08a26` |
  | `eval/e2e/demo-assets/run_trajectory.sh`      | `79b695123c9f716174fbdc048f02401b97a496e9` |
  | `eval/e2e/demo-assets/run_negative_probes.sh` | `983fa51399179af837b5a50a09fc8caca17a0940` |

  **其后若资产文件再变更，须重跑并更新本记录。**

- 前置条件：无并发写者（重放前 `Get-CimInstance Win32_Process` 过滤 `vitest|prepush` 为空）；重放期间未运行其他 vitest / `npm run prepush`，未向工作区外写入状态。

## 结果

| 项                                  | 期望                        | 实测        |
| ----------------------------------- | --------------------------- | ----------- |
| 轨迹执行条数 `TOTAL_GATE_RUNS`      | 119                         | 119         |
| 非零退出 `NONZERO_EXIT_COUNT`       | 0                           | 0           |
| 其中门禁脚本 / wm-write / wm-status | 89 / 29 / 1                 | 89 / 29 / 1 |
| 负向探针                            | 9/9 被拦截 + 恢复复绿       | 9/9         |
| `wm-status` RTM 覆盖率              | 4/4（100%，按追溯字段重算） | 4/4（100%） |

原始日志：

- 轨迹：`eval/e2e/demo/.replay/trajectory.log`（170333 字节，末行 `TOTAL_GATE_RUNS=119` / `NONZERO_EXIT_COUNT=0`，脚本 stdout 末行 `✓ 119/119 exit 0`，退出码 0）
- 探针：`eval/e2e/demo/.replay/negative-probes.log`（18815 字节，脚本 stdout 末行 `✓ 9/9 探针被拦截 + 恢复复绿`，退出码 0）

命令序列（`eval/e2e/demo-assets/` 下执行）：

```bash
python build_workspace.py --reset
bash run_trajectory.sh
bash run_negative_probes.sh
```

### 轨迹产出（89 条门禁脚本退出码全 0）

阶段 1–8 每阶段 `graph / tla / bdd / verifier / artifact-gate`（阶段 5–8 为 `artifact-gate --scope=.w-model/change-scope.p{5..8}.json`）+ 阶段 8 `archive-integrity`，以及每阶段 7 条闭环（`budget / run-log / maturity / checkpoint / preventive-review / role-dispatch / signature-chain`）；29 条 `wm-write` 为状态演化（`graph / tla-manifest / bdd-manifest / project`），1 条 `wm-status` 收尾。

终态 `STATUS_JSON`（`wm-status .`，退出码 0，探针恢复后复跑一致）：

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

探针 3 的命中词要求报告块出现 `不变式违反 : N 条`（N ≥ 1），即真实 TLC 判定的不变式违反，**与「缺 Java/jar 导致的环境失败」可区分**（后者不打该计数）。本机 Java 17 + `w-model-dev/tools/tla2tools.jar` 就绪，故该命中为真实不变式违反，非环境缺失。

恢复复验：`restore-check check-signature-chain.ts EXIT=0`、`restore-check check-run-log.ts EXIT=0`；工作区内 `*.probe-orig` 残留计数 0。

## 与归档的差异（如实列出）

1. 门禁消息措辞随 S2 修复变化：`--phase=1` 校验后期 manifest 时报「属后续阶段（phase=2）…」而非「不在 manifest 中」——归档日志保留旧文案（历史快照），资产重放为新文案（探针 4 即针对该文案的区分度断言）。
2. `wm-status` 的 RTM 覆盖率由 0/4 变为 4/4（F-1 修复：不再按展示字段统计）。
3. 归档日志的 8 项探针含一条归因错误（`NP:tla-invariant-falsify` 实际为 phase 形态错配），本轮拆分为第 3、4 两条探针。

## 重建过程记录（护栏与一处 Windows 移植性缺口）

1. **`--reset` 护栏生效**：工作区残留 `eval/e2e/demo/.git` 时，不带 `--reset` 的装配器按设计 fail-closed 退出（退出码 1），输出：
   `✗ 工作区根存在 .git：它会让 --scope 的 headRef 绑到 demo 自身 HEAD 而使 p5–p8 门禁过期。请先移走/删除该目录，或显式传 --reset 清空重建。`
2. **`--reset` 在 Windows 上无法自行清空残留 `.git`**：`python build_workspace.py --reset` 首次执行以 `PermissionError: [WinError 5] 拒绝访问。: '...\eval\e2e\demo\.git\objects\pack\pack-aab165774297aa18e90a41b53a1e268156c947e2.idx'` 失败（退出码 1）。原因是 git 将 pack 文件置为只读（`attrib` 显示 `R`），而 Python `shutil.rmtree` 在 Windows 上不解除只读属性即删除失败。按护栏自身给出的替代路径「先移走/删除该目录」手工执行 `rm -rf eval/e2e/demo/.git` 后，`--reset` 正常完成并输出 `workspace built at …\eval\e2e\demo`。
   - 影响：仅限「工作区已有残留 `.git`」这一非默认路径；未修改任何受跟踪资产，未放宽任何断言。
   - 记录为待办改进项（后续任务处理，本任务按硬约束不改 `eval/e2e/demo-assets/`）：`shutil.rmtree(..., onerror=...)` 或先 `os.chmod` 解除只读，使 `--reset` 在 Windows 上具备其承诺的自愈能力。
