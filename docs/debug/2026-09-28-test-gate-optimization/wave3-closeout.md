# Wave 3 收口记录 · 同质用例合并（2026-09-29）

> 规格与计划：`docs/superpowers/specs/2026-09-28-test-gate-optimization-design.md` §5 / 计划 Task 11-13。
> 本记录为 Task 12 Step 3-5 收口产物（计数终核与收口 prepush 合并为一次 KEEP JSON 运行，口径等价）。

## 一、硬指标终核

| 口径                 | Wave 2 收口 | Wave 3 收口                                                                            | 变化                                                                        |
| -------------------- | ----------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| vitest 用例数        | 2631        | 收口门时点 **1888（全过）**；bdd-cli 补遗后终态 **1874（以补遗后收口运行 JSON 为准）** | 收口门时点 **-743（-28%）**、补遗后 -757；硬线 ≤2100 达成（补遗后余量 226） |
| 第 12 项 vitest 墙钟 | 1191s       | 1296s                                                                                  | +105s（见下「墙钟说明」）                                                   |
| prepush 总耗时       | 1262s       | 1369s                                                                                  | +107s（随 vitest 项）                                                       |
| prepush 19 项        | 全绿        | **全绿（PREPUSH_EXIT=0）**                                                             | —                                                                           |

**墙钟说明（如实登记）**：用例数 -28% 但 vitest 墙钟 +105s——聚合把原多个 it 压入单 it 循环后，serial 项目内原「跨 it 间隙」的调度并行度消失，且 platform-deps-hook / docs-consistency-logic 等重 fixture 族的每迭代自备夹具使总 spawn 次数不变、单 it 时长变长。提速主战场按规格本就在 Wave 2（进程内化，已 -856s）与 Wave 4（三车道并行）。

## 二、五批执行汇总（逐族登记见 merge-candidates.md 文末执行登记 A-E）

| 批               | 提交     | 文件数 | 族数 | 实测净减                | 退回                                                         |
| ---------------- | -------- | ------ | ---- | ----------------------- | ------------------------------------------------------------ |
| A                | 1cb381eb | 5      | 70   | 238                     | 1 部分退回（docs-consistency 族17 D7C 核体不同构）           |
| B                | d3af90b6 | 9      | 56   | 169                     | 0（root-cause +3 实测偏差已登记）                            |
| C                | 76e7cd25 | 16     | 65   | 175                     | 0                                                            |
| D                | 0b3da8a1 | 25     | 51   | 119                     | 0（duplicates 口径偏差 -1 已登记）                           |
| E                | be3d2174 | 23     | 31   | 42                      | 0（run-main 守卫互补两例未合并；bdd-logic 口径偏差已登记）   |
| 补遗（修复轮 3） | 本轮提交 | 1      | 3    | 14                      | 0（批次切分遗漏 bdd-cli，登记见 merge-candidates.md 补遗节） |
| 合计             | —        | 79     | 276  | **743 → 757（补遗后）** | 1 部分退回                                                   |

全量合计口径（修复轮 3 订正）：候选 276 族 / 已裁定 276 族（补遗后）。用例数：收口门时点 1888；bdd-cli 补遗后终态 1874（以补遗后收口运行 JSON 为准）。

形态纪律全程执行：循环内多断言（禁 it.each）、expect 消息逐条目指名、每迭代自备夹具、NEGATIVE-COVERAGE 载体逐夹具具名、排除面零触碰。

## 三、收口门回归修复（两轮）

1. **fix round 1（801bd3fb）**：attempt 1 死于第 6 项 security-scan——批改造引入 24 项新增发现（non-literal-regexp×8 / non-literal-fs-filename×10 / object-injection×2 附理由 disable + 范围外补录 no-unused-vars×4）。教训与 Wave 2 收口同型：**批内验证面必须含 lint:security**。
2. **fix round 2（d7a05796）**：attempt 2 死于第 12 项 vitest——全量 1888 例唯一 1 红为 run-sync 台账对账（Task 4 的 coverage-logic 三同锚条目 vs 批 B 循环聚合后单物理调用点 3≠1），台账收敛为单条目、行为无回归。

## 四、计数证据链

- `wave3-vitest.json`：KEEP 开关落盘的收口运行 JSON（收口门时点 numTotalTests=1888，全过）；bdd-cli 补遗后终态以补遗后收口运行 JSON 为准（预期 1874）。
- 诊断存档（修复轮 3 订正）：`wave3-vitest-diag.json`（attempt 2 后的双 reporter 直跑，定位唯一台账红）为瞬态产物，已随工作区清理，未入库也不在工作区——关键结论（全量唯一 1 红为 run-sync 台账对账）已转录于本记录第三节；`wave3-prepush.attempt1-failed.log`（security-scan 20 项清单）原貌保留（工作区本地留档）。
- Task 13（fe54fe38）：self-test/eval 重审表 22 行全保留，删减面未触发如实登记（self-test 381 例进程内非瓶颈、eval 60 提示词零精确重复）。
